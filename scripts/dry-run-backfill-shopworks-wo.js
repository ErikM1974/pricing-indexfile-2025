/**
 * dry-run-backfill-shopworks-wo.js  (READ-ONLY — makes NO writes)
 *
 * Finds quote_sessions that are stuck: they have a real ShopWorks order in
 * ManageOrders (so the order DID land in OnSite) but their
 * quote_sessions.ShopWorks_Order_Number is empty — which means the per-quote
 * sync can never resolve the order and the design name + status freeze forever
 * (see server.js sync-from-shopworks: a missing WO# + empty /v1/getorderno =>
 * snapshot.found=false => the snapshot/order block is never refreshed).
 *
 * Approach (no Caspio creds required — all via the proxy's PUBLIC API):
 *   1. Pull ManageOrders orders for a date window (one call). Each order carries
 *      CustomerPurchaseOrder (= our QuoteID for pushed web/builder orders) and
 *      id_Order (the ShopWorks WO#).
 *   2. Keep orders whose PO matches one of our quote-ID prefixes.
 *   3. For each, read the matching quote_sessions row by QuoteID and check
 *      ShopWorks_Order_Number.
 *   4. Classify + report what a backfill WOULD set. NOTHING is written.
 *
 * Usage:
 *   node scripts/dry-run-backfill-shopworks-wo.js            # last 30 days
 *   DAYS_BACK=90 node scripts/dry-run-backfill-shopworks-wo.js
 *
 * The real backfill (separate, write-enabled, Erik-approved) would PUT
 * ShopWorks_Order_Number = id_Order onto each WOULD-LINK row, then let the next
 * cron sync pull the fresh snapshot. This script intentionally does neither.
 *
 * SCOPE / LIMITATION (verified 2026-06-16): ShopWorks CustomerPurchaseOrder holds
 * the QuoteID ONLY for storefront orders (custom-tees / custom-caps webhook —
 * e.g. DTG0613-8320). For BUILDER quotes (EMB/SCP/DTF/OF) the PO field is the
 * customer's own PO, so the QuoteID↔WO# link is via ExtOrderID (EMB-2026-NNN),
 * NOT this PO join — those quotes are invisible to this tool. Auditing/backfilling
 * the builder class needs an ExtOrderID bridge (MO /order-pull by api_source, or a
 * fixed upstream /v1/getorderno mapping). First 45-day run: 440 MO orders, 1
 * QuoteID-as-PO (already linked), 0 stuck storefront orders.
 */

const PROXY = process.env.PROXY_BASE || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const DAYS_BACK = Number(process.env.DAYS_BACK || 30);
// Our staff + storefront quote-ID prefixes (CLAUDE.md "Quote Prefixes").
const QUOTE_PREFIX = /^(DTG|EMBC|CEMB|EMB|SPC|SSC|SP|DTF|OF|RICH|LT|PATCH|WQ|CAP)[-\d]/i;
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 700);

function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJSON(url, { retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(url);
    if (r.status === 429 && attempt < retries) {
      console.log(`  …429 rate-limited, waiting 60s (attempt ${attempt + 1})`);
      await sleep(61000);
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
}

(async () => {
  const start = isoDaysAgo(DAYS_BACK);
  const end = isoDaysAgo(-1); // tomorrow, so today is inclusive
  console.log(`\n=== DRY-RUN: backfill quote_sessions.ShopWorks_Order_Number (NO writes) ===`);
  console.log(`MO order window: ${start} .. ${end}  (DAYS_BACK=${DAYS_BACK})`);

  const ordersResp = await getJSON(`${PROXY}/api/manageorders/orders?date_Ordered_start=${start}&date_Ordered_end=${end}`);
  const orders = ordersResp.result || [];
  console.log(`ManageOrders orders in window: ${orders.length}`);

  // PO -> [id_Order...] for orders whose PO looks like one of our quote IDs.
  const poToIds = new Map();
  const poToName = new Map();
  for (const o of orders) {
    const po = String(o.CustomerPurchaseOrder || '').trim();
    if (!po || !QUOTE_PREFIX.test(po)) continue;
    if (!poToIds.has(po)) poToIds.set(po, []);
    poToIds.get(po).push(o.id_Order);
    poToName.set(po, o.DesignName || '');
  }
  const pos = [...poToIds.keys()];
  console.log(`Candidate POs matching a quote prefix: ${pos.length}\n`);

  const wouldLink = [], alreadyLinked = [], mismatch = [], noQuote = [], errors = [];
  let i = 0;
  for (const po of pos) {
    i++;
    const ids = poToIds.get(po);
    let rows;
    try {
      const resp = await getJSON(`${PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(po)}`);
      rows = Array.isArray(resp) ? resp : [];
    } catch (e) {
      errors.push({ po, error: e.message });
      await sleep(THROTTLE_MS);
      continue;
    }
    if (!rows.length) { noQuote.push({ po, ids }); await sleep(THROTTLE_MS); continue; }
    const row = rows[0]; // proxy returns PK_ID DESC — newest first
    const wo = String(row.ShopWorks_Order_Number || '').trim();
    const idOrder = ids[0];
    const meta = { po, status: row.Status, pushed: !!row.PushedToShopWorks, multi: ids.length > 1 ? ids : null, name: poToName.get(po) };
    if (!wo) wouldLink.push({ ...meta, wouldSet: idOrder });
    else if (Number(wo) === Number(idOrder)) alreadyLinked.push({ po, wo });
    else mismatch.push({ po, stored: wo, moIds: ids });
    if (i % 20 === 0) console.log(`  …checked ${i}/${pos.length}`);
    await sleep(THROTTLE_MS);
  }

  console.log(`\n=== RESULT (READ-ONLY — nothing was written) ===`);
  console.log(`WOULD LINK (stuck quote → set ShopWorks_Order_Number): ${wouldLink.length}`);
  console.log(`Already linked (no action): ${alreadyLinked.length}`);
  console.log(`MISMATCH (stored WO# ≠ MO id_Order — REVIEW, never auto-touch): ${mismatch.length}`);
  console.log(`MO order PO has no quote_session in our table: ${noQuote.length}`);
  console.log(`Lookup errors: ${errors.length}`);

  if (wouldLink.length) {
    console.log(`\n-- WOULD LINK (up to 50) --`);
    for (const w of wouldLink.slice(0, 50)) {
      console.log(`  ${w.po.padEnd(18)} → WO# ${w.wouldSet}   status=${w.status || '?'} pushed=${w.pushed}${w.multi ? '  MULTI:' + w.multi.join('/') : ''}   "${(w.name || '').slice(0, 40)}"`);
    }
  }
  if (mismatch.length) {
    console.log(`\n-- MISMATCH (manual review — these would NOT be auto-linked) --`);
    for (const m of mismatch.slice(0, 50)) console.log(`  ${m.po.padEnd(18)} stored=${m.stored}  MO=${m.moIds.join('/')}`);
  }
  if (errors.length) {
    console.log(`\n-- ERRORS --`);
    for (const e of errors.slice(0, 20)) console.log(`  ${e.po}: ${e.error}`);
  }
  console.log(`\nDry-run complete. To apply, a separate write-enabled pass (Erik-approved) would PUT only the WOULD-LINK rows.`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
