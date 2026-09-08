// routes/order-form.js — Order-form submission and legacy cart, catalog and pricing relays
// Extracted VERBATIM from server.js lines 3855-6073 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { API_BASE_URL, CASPIO_PROXY_BASE, CRM_API_SECRET, NWCA_LOCATIONS, SERVER_DIR, SYNC_PROXY_BASE, cacheSubmitResponse, fetch, fs, getCachedSubmitResponse, makeApiRequest, monitor, path, requireStaff, sanitizeFilterInput, withProxySecret } = ctx;

// ============================================================================
// Online Order Form — submit to ShopWorks via caspio-pricing-proxy ManageOrders PUSH
// Mirrors the 3-Day Tees flow (server.js submit-3day-order) but:
//   - ExtSource = "NWCA-OrderForm" (so OnSite can filter these apart)
//   - No Stripe payment block (orders are paid offline via invoice)
//   - TaxTotal: 0 — lets OnSite calculate
//   - Accepts the order-form React state (info/rows/ship/orderNotes/files)
//   - Uses OF-MMDD-nn as ExtOrderID when submitted via a customer share link
// ============================================================================

// ============================================================================
// Notes builders — split a single order's metadata into ShopWorks's four
// note "types", each shown on a different screen to a different role:
//
//   Notes On Order      → CSR / front desk: customer info, source, tax account
//   Notes To Production → production team: method/stitch/location, garment qty breakdown
//   Notes To Shipping   → shipping/receiving: ship method, address, due date
//   Notes To Art        → art team: art notes + file links (only when present)
//
// Pattern adopted from Python Inksoft/web/transform.py:build_notes_array().
// ============================================================================

// NWCA's tax account lookup. Per Erik's rules (2026-05-20):
//   - Pickup at NWCA Milton, WA      -> 10.2% flat (Milton rate)
//   - Shipping out of WA state        → 0.0% (no nexus)
//   - Shipping IN WA state            → destination city rate (DOR lookup)
//
// These three rules ARE Washington's "destination-based sourcing" law, in
// effect since 2008. Authority:
//   - WAC 458-20-145  Sourcing — sale at seller's location vs. destination
//   - WAC 458-20-193  Interstate sales of tangible personal property
//                     (the basis for the "out-of-state ship = no WA tax" rule)
//   - WAC 458-20-110  Delivery charges
//                     ⚠ Shipping CHARGES are taxable too. The legally correct
//                     tax base is (subtotal + shipping) × rate. As of DTG Phase 2
//                     (2026-06-09) the DTG form BILLS shipping: it sends the fee
//                     in ship.fee → cur_Shipping (above) and breakdown.shipping,
//                     and buildOrderNote() uses taxableBase = subtotal + shipping.
//                     The DTG frontend already computes breakdown.taxEstimate on
//                     that base. (The React Order Form still sends no shipping →
//                     shipping defaults to 0, so its notes/total are unchanged.)
//   - DOR rate API:   webgis.dor.wa.gov/webapi/AddressRates.aspx
//                     (called from /api/tax-rates/lookup in this server)
//   - Live tool:      https://webgis.dor.wa.gov/taxratelookup/SalesTax.aspx
//
// The frontend looks up the in-state destination rate via /api/tax-rates/lookup
// and passes the computed taxTotal in the submit payload. The backend re-derives
// the GL account here so AR's books stay clean even if the frontend is wrong.
//
// Motor-vehicle / boat / aircraft sales are an EXCEPTION (taxed at seller's
// location even when delivered) — N/A for NWCA since we sell apparel.
function getTaxAccount(state, isCustomerPickup) {
  if (isCustomerPickup) return { code: '2200.102', label: 'Customer Pickup — Milton, WA 10.2%', rate: 0.102 };
  if (state && state.toUpperCase() !== 'WA') return { code: '2202', label: 'Out of State Sales — No Tax', rate: 0 };
  // In-WA shipping: rate is destination-specific (city of ship-to). The
  // frontend's DOR lookup returns the authoritative rate; we report the GL
  // account here and trust the rate it computed.
  return { code: '2200.102', label: 'WA Sales Tax — Destination City', rate: null };
}

// ============================================================================
// Sales tax accounts cache (Erik 2026-05-22)
// ----------------------------------------------------------------------------
// Caches the 33-row sales_tax_accounts_2026 Caspio table so the note builder
// can look up the rate-specific GL account (2200.101, 2200.102, …) without
// hitting the proxy on every submit. The frontend's /api/tax-rates/lookup
// returns this same data + the rate at once, but if it ever fails to populate
// ship.taxAccount, this server-side fallback prevents the order from landing
// in ShopWorks's generic "2200" parent account (which AR doesn't reconcile).
//
// TTL: 1 hour. The Caspio table changes ~never (WA DOR adjusts rates quarterly).
// ============================================================================
let _taxAccountsCache = null;
let _taxAccountsCacheAt = 0;
let _taxAccountsInFlight = null;
const TAX_ACCOUNTS_TTL_MS = 60 * 60 * 1000;

async function ensureTaxAccountsCache() {
  const fresh = _taxAccountsCache && (Date.now() - _taxAccountsCacheAt) < TAX_ACCOUNTS_TTL_MS;
  if (fresh) return _taxAccountsCache;
  if (_taxAccountsInFlight) return _taxAccountsInFlight;
  _taxAccountsInFlight = (async () => {
    try {
      const r = await fetch(`${SYNC_PROXY_BASE}/api/tax-rates`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      _taxAccountsCache = data.filter(a => a.Active === 'Yes' && Number.isFinite(Number(a.Tax_Rate)));
      _taxAccountsCacheAt = Date.now();
      console.log(`[tax-accounts] cache refreshed: ${_taxAccountsCache.length} active accounts`);
      return _taxAccountsCache;
    } catch (e) {
      console.warn('[tax-accounts] cache refresh failed (will serve stale or empty):', e.message);
      return _taxAccountsCache || [];
    } finally {
      _taxAccountsInFlight = null;
    }
  })();
  return _taxAccountsInFlight;
}

/**
 * Look up the rate-specific GL account from the cached sales_tax_accounts_2026
 * table. Matches `Tax_Rate` (decimal, e.g. 0.102 = 10.2%) with 0.0001 tolerance
 * to absorb float-rounding. Returns null when no match within ±0.5%.
 */
function findTaxAccountByRate(rateDecimal) {
  if (!Number.isFinite(rateDecimal) || rateDecimal <= 0) return null;
  const accounts = _taxAccountsCache || [];
  if (accounts.length === 0) return null;
  const exact = accounts.find(a => Math.abs(Number(a.Tax_Rate) - rateDecimal) < 0.0001);
  if (exact) {
    return { account: String(exact.Account_Number), accountName: exact.Account_Name };
  }
  // No exact match — find closest within 0.5% tolerance (handles DOR rates
  // that aren't on the standard 0.1% grid, e.g. 10.05%).
  let closest = null;
  for (const a of accounts) {
    const diff = Math.abs(Number(a.Tax_Rate) - rateDecimal);
    if (diff < 0.005 && (!closest || diff < closest.diff)) {
      closest = { a, diff };
    }
  }
  if (closest) {
    console.warn(`[tax-accounts] no exact match for rate=${rateDecimal} — closest ${closest.a.Tax_Rate} (acct ${closest.a.Account_Number})`);
    return { account: String(closest.a.Account_Number), accountName: closest.a.Account_Name };
  }
  return null;
}

// Notes On Order is the SINGLE most-glanced field in ShopWorks for the rep
// reviewing an order. Per Erik (2026-05-20): strip everything that's already
// in a structured ShopWorks field — Order ID is the External ID field,
// timestamp is Date Order Placed, company is the Customer header — and keep
// ONLY the tax-application instructions, which Erik applies manually after
// each order arrives (because the integration's hardcoded Tax_10.1 default (⚠️ Erik: bump ShopWorks integration to Tax_10.2/2200.102)
// would mis-label non-Milton-pickup orders).
//
// 4 possible blocks:
//   1. Pickup (always Milton, 10.2%)            -> APPLY: 2200.102
//   2. In-WA shipping (DOR destination lookup)  → APPLY: matched Caspio account
//   3. Out-of-state shipping                    → DO NOT APPLY
//   4. No tax info available (defensive)        → FLAG: needs rep review
function buildOrderNote({ info, breakdown, draftId, ship, orderNotes, extOrderId, printLocations }) {
  // M1 reverted 2026-05-22: Notes On Order is the primary tab CSR/AR/Production
  // all scan. Keep operational + financial in one place, one fact per line.
  // Tax block lives here (was briefly on Notes To Accounting under M1).
  const lines = [];

  // 0. Customer Warning (Erik 2026-05-23): if the customer record in
  // CompanyContactsMerge2026 has a Customer_Warning flag (e.g. "DO NOT
  // EXTEND CREDIT", "REQUIRES PREPAY"), surface it as the FIRST line so
  // AR sees it before doing anything else. The client passes it through
  // info.customerWarning (originally via the Order Form company picker).
  const cw = String(info?.customerWarning || '').trim();
  if (cw) {
    lines.push(`CUSTOMER WARNING: ${cw}`);
  }

  // 1. Print Locations — Erik's #1 thing he scans for in ShopWorks (2026-05-20).
  const locsClean = String(printLocations || '').trim();
  if (locsClean) {
    lines.push(`Print Locations: ${locsClean}`);
  }

  // 2. Tax block — subtotal / shipping / rate / amount / total / account, one per line.
  const subtotal = Number(breakdown?.subtotal) || 0;
  // [2026-06-09] DTG Phase 2 — billed shipping is TAXABLE in WA (WAC 458-20-110), so the
  // taxable base is (subtotal + shipping) and the total includes it even when tax doesn't
  // apply (wholesale/exempt/out-of-state). Defaults to 0 → unchanged for the React Order
  // Form (which doesn't send breakdown.shipping). breakdown.taxEstimate is ALREADY computed
  // on (subtotal+shipping) by the DTG frontend, so we only add the Shipping line + base/total.
  const shipping = Number(breakdown?.shipping) || 0;
  const taxAmount = Number(breakdown?.taxEstimate) || 0;
  const taxRate = Number(ship?.taxRate) || 0;
  const taxableBase = subtotal + shipping;
  const total = taxableBase + taxAmount;

  const isPickup = ship && (
    ship.method === 'Customer Pickup' ||
    ship.method === 'pickup' ||
    ship.method === 'willcall'
  );
  const shState = String(ship?.state || info?.state || '').toUpperCase();
  const isOutOfState = !isPickup && shState && shState !== 'WA';

  // Wholesale / reseller (WA reseller permit on file) → no tax, GL 2203. HIGHEST
  // priority — matches recomputeTaxRate's ordering (wholesale wins over exempt /
  // out-of-state / pickup), so a wholesale customer with an out-of-state ship-to
  // still books to 2203, not 2202. (2026-06-08 Phase 1 Chunk D — DTG/EMB/SCP/DTF)
  if (info?.isWholesale) {
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: DO NOT APPLY (wholesale / reseller)`);
    lines.push(`Tax Account: 2203 — Wholesale Sales (WA reseller permit)`);
    lines.push(`Reason: Customer marked Wholesale / reseller — sale for resale, no retail tax`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Tax-exempt customer (cert on file) → short-circuit
  if (info?.isTaxExempt) {
    const cert = info.taxExemptNumber || '(no cert # on file)';
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: EXEMPT — DO NOT APPLY`);
    lines.push(`Cert #: ${cert}`);
    lines.push(`Tax Account: 2204 — Tax Exempt`);
    lines.push(`Reason: Customer marked Tax Exempt in CompanyContactsMerge2026`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Out-of-state shipping → no tax (WAC 458-20-193)
  if (isOutOfState) {
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: DO NOT APPLY (out of state)`);
    lines.push(`State: ${shState}`);
    lines.push(`Tax Account: 2202 — Out of State Sales`);
    lines.push(`Reason: WAC 458-20-193 (no nexus on out-of-state delivery)`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Pickup or in-WA shipping → apply tax. Resolve the rate-specific GL account.
  // Source priority:
  //   1. ship.taxAccount — frontend's /api/tax-rates/lookup result (authoritative)
  //   2. findTaxAccountByRate(taxRate) — server-side lookup from cached
  //      sales_tax_accounts_2026 table (fallback if frontend dropped it)
  //   3. Hardcoded '2200.102' for pickup (Milton, 10.2% as of 2026-07)
  // We DON'T fall through to generic '2200' parent — that would land orders in
  // an unreconciled GL account and confuse AR.
  let taxAccount = ship?.taxAccount;
  let taxAccountName = ship?.taxAccountName;
  if (!taxAccount && taxRate > 0) {
    const lookup = findTaxAccountByRate(taxRate);
    if (lookup) {
      taxAccount = lookup.account;
      taxAccountName = lookup.accountName;
    }
  }
  if (!taxAccount && isPickup) {
    taxAccount = '2200.102';   // Milton pickup — rose to 10.2% (DOR 2026-07-06)
    taxAccountName = '10.20%';
  }

  const ratePct = taxRate > 0 ? (taxRate * 100).toFixed(2) : null;

  if (ratePct && taxAccount) {
    const locationLabel = isPickup
      ? 'Milton pickup — flat'
      : `${ship?.city || 'WA destination'} — DOR lookup`;
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) {
      lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
      lines.push(`Taxable Base: $${taxableBase.toFixed(2)} (subtotal + shipping — WAC 458-20-110)`);
    }
    lines.push(`Tax Rate: ${ratePct}% (${locationLabel})`);
    lines.push(`Tax Amount: $${taxAmount.toFixed(2)}`);
    lines.push(`Total with Tax: $${total.toFixed(2)}`);
    lines.push(`Tax Account: ${taxAccount} — ${taxAccountName || ratePct + '%'}`);
    lines.push(`Apply Tax: Manually in ShopWorks`);
  } else {
    // No rate / no account resolved — flag for rep review.
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
    lines.push(`Tax: NEEDS REVIEW`);
    lines.push(`Rep: Confirm destination + apply correct WA rate before invoicing`);
  }

  // 3. Live Quote URL (Erik 2026-05-23) — gives the SW operator a one-click
  // jump back to the customer-facing quote-view (which has the live SW state
  // overlay, the original submission audit panel, all the design info). Saves
  // them looking up the OF# in our system every time they need full context.
  if (extOrderId) {
    lines.push(`Live Quote: https://teamnwca.com/quote/${extOrderId}`);
  }

  // Each line becomes one row in ShopWorks's Notes On Order tab.
  return lines;
}

// (buildAccountingNote removed 2026-05-22 — M1 reverted. Tax block now
// lives inline in buildOrderNote above, where CSR/AR/Production all look.)

// Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
// Production tab (Erik 2026-05-20).
function buildProductionNote({ rows, breakdown, methodNotesBlock }) {
  const lines = [];
  const block = String(methodNotesBlock || '').trim();
  if (block) {
    // The method block is itself a "·"-separated metadata string like
    //   "DTG · Left Chest + Full Back · Tier 1-23 (LTM) · 1 line · 17 combined pieces · Ship: Customer Pickup"
    // Split on " · " so production sees each fact as its own note row.
    for (const piece of block.split(' · ').map(s => s.trim()).filter(Boolean)) {
      lines.push(piece);
    }
  }
  // Garment breakdown: one row per (style, color) listing all sizes
  (rows || []).forEach(r => {
    if (!r || !r.style) return;
    const sizes = r.sizes || {};
    const pairs = Object.keys(sizes)
      .filter(k => Number(sizes[k]) > 0)
      .map(k => `${k}×${Number(sizes[k])}`);
    if (pairs.length === 0) return;
    const totalQty = pairs.reduce((s, p) => s + Number(p.split('×')[1] || 0), 0);
    const colorPart = r.colorName ? ` ${r.colorName}` : '';
    lines.push(`${r.style}${colorPart}: ${pairs.join(', ')} (${totalQty} pcs)`);
  });
  return lines;
}

// NOTE: buildShippingNote() was removed (2026-05-01). All shipping data is
// already populated in MO's structured fields:
//   - ShippingAddresses[]: ShipAddress01/02, ShipCity, ShipState, ShipZip,
//     ShipCompany, ShipMethod, ShipCountry
//   - Order-level: date_OrderRequestedToShip, date_OrderDropDead
// Duplicating in a note created exactly the redundancy Erik flagged.

// Notes To Purchasing — line-by-line list for the sourcing team to pull
// from SanMar. One line per (style, color, size) at the qty the rep
// priced. Prices are intentionally OMITTED here (Erik 2026-05-20) — the
// weighted-average per-row price shown vs. the authoritative per-size
// price in LinesOE confused purchasing. The LinesOE block carries the
// true per-size prices; this note is for what to BUY, not what to charge.
// Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
// Purchasing tab. ONE row per (style, color, size) so sourcing can scan/check
// off each line as they pull from SanMar (Erik 2026-05-20).
function buildPurchasingNote({ rows }) {
  const lines = [];
  (rows || []).forEach(r => {
    if (!r || !r.style) return;
    const sizes = r.sizes || {};
    Object.keys(sizes).forEach(sz => {
      const q = Number(sizes[sz]) || 0;
      if (!q) return;
      const colorPart = r.colorName ? ` - ${r.colorName}` : '';
      lines.push(`${r.style}${colorPart} - ${sz} × ${q}`);
    });
  });
  return lines;
}

function buildArtNote({ info, files }) {
  const parts = [];
  if (info.artNotes) parts.push(info.artNotes);
  if (Array.isArray(files) && files.length) {
    parts.push(files.map(f => {
      const placements = (f.placements || []).join(', ');
      const designNo = f.designNo ? ` (#${f.designNo})` : '';
      const colors = f.colors ? ` — Colors: ${f.colors}` : '';
      return `${f.name || 'file'}${designNo}: ${placements}${colors}`;
    }).join('\n'));
  }
  return parts.join('\n\n');
}

// Generate Order Form order ID — OF-NNNN (globally sequential, zero-padded to 4 digits).
// Reuses the proxy's race-safe counter endpoint that Embroidery uses (same as EMB-2026-N).
// Response shape: { prefix: "OF", year: 2026, sequence: 42 } → we return "OF-0042".
// Falls back to OF-<timestamp> if the counter endpoint is unreachable so a push never 500s.
// NOTE: The endpoint is year-scoped (resets Jan 1). At year-rollover the sequence restarts
// at 1 — if OF-0001 from the prior year is still in quote_sessions, the idempotency check
// on Status=Processed will catch any accidental re-use. Revisit this if we actually hit it.
async function generateOrderFormDraftId() {
  try {
    const r = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/OF`, { headers: withProxySecret() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const n = Number(j && j.sequence);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Bad sequence response: ' + JSON.stringify(j));
    return `OF-${String(n).padStart(4, '0')}`;
  } catch (err) {
    console.warn('[Order Form] quote-sequence endpoint failed, falling back to timestamp:', err.message);
    return `OF-${Date.now()}`;
  }
}

// (The /api/order-form-drafts save + customer-approve routes were removed 2026-07-11
//  along with the Order Form UI — see git history. /api/submit-order-form below is
//  RETAINED because the DTG quote builder pushes through it.)

// Sales-rep slug → full name. Clients of /api/submit-order-form (today the
// DTG builder; originally the retired Order Form) send a lowercase login
// slug ("taneisha") as the value because that's the legacy convention. ShopWorks's CustomerServiceRep field displays
// whatever string we send verbatim, so without translation the rep shows
// up as "taneisha" instead of "Taneisha Clark". Mapping is kept here
// (server-side) instead of changing the dropdown value because saved
// drafts in the Caspio quote_sessions table already use slugs — flipping
// the dropdown values would orphan those drafts.
//
// Note: 'ruth' slug → 'Ruthie Nhoung' to match ShopWorks's Employee record
// (ID 24). The form's dropdown LABEL also says "Ruthie Nhoung" but the
// internal slug stays 'ruth' for back-compat with saved drafts.
const SALES_REP_FULL_NAMES = {
  nika: 'Nika Lao',
  taneisha: 'Taneisha Clark',
  erik: 'Erik Mickelson',
  ruth: 'Ruthie Nhoung',
  jim: 'Jim Mickelson',
};

// Sales-rep slug → ShopWorks Employee ID for id_EmpCreatedBy on the
// order. Per Erik's screenshot of ShopWorks Employees (2026-05-02):
//   Jim Mickelson      = 1
//   Erik Mickelson     = 2
//   Ruthie Nhoung      = 24
//   Nika Lao           = 169
//   Taneisha Clark     = 281
// Unknown rep falls back to 2 (Erik) so orders never land on Employee 0.
const SALES_REP_EMP_IDS = {
  jim: 1,
  erik: 2,
  ruth: 24,
  nika: 169,
  taneisha: 281,
};

// POST /api/submit-order-form — Submit an order-form to ShopWorks.
// Accepts the frontend state verbatim + optional draftId for share-link flow.
app.post('/api/submit-order-form', async (req, res) => {
  try {
    const {
      info = {},
      rows = [],
      ship = {},
      orderNotes = '',
      files = [],
      draftId,                 // present when submitted from a shared customer link
      decoConfig = {},         // form-wide method config from the order form
      breakdown = null,        // computed pricing breakdown { byRow: { rowId: {unitPriceBySize, ...} }, subtotal, ... }
      methodNotesBlock = '',   // method-specific context (frontend-built)
      printLocations = '',     // human-readable print location label (e.g. "Left Chest + Full Back")
      designNumbers = [],      // array of design # strings to look up in ShopWorks
      addOns = [],             // Phase 2a fee/service add-ons → push as ShopWorks LinesOE entries
      submissionId            // optional client-generated UUID for idempotent retries (audit fix H5)
    } = req.body || {};

    // Normalize any date to YYYY-MM-DD before it flows into the ManageOrders
    // payload (orderDate / requestedShipDate). The order-form date pickers emit
    // YYYY-MM-DD already, but a malformed or MM/DD/YYYY value from any other
    // caller would otherwise pass through raw and the downstream MO date
    // formatter (which splits on '-') renders it "undefined/undefined/<date>"
    // in ShopWorks. Belt-and-suspenders so a bad date can never land in SW.
    const toISODate = (d) => {
      if (!d) return '';
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);              // already YYYY-MM-DD
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);                // MM/DD/YYYY → YYYY-MM-DD
      if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      return s; // unknown shape — pass through (better than swallowing)
    };

    // Idempotency check (audit fix H5): if the client retried with the same
    // submissionId within the TTL window, return the cached response instead
    // of allocating a new OF-NNNN + re-pushing. Protects against double-submit
    // on network hiccups despite the frontend's `submitting` guard.
    const idemId = submissionId || req.headers['x-submission-id'] || null;
    if (idemId) {
      const cached = getCachedSubmitResponse(idemId);
      if (cached) {
        console.log('[Order Form Submit] ↻ idempotent retry for submissionId', idemId, '→ returning cached response');
        return res.status(cached.statusCode || 200).json({ ...cached.body, idempotentReplay: true });
      }
    }

    if (!info.email && !info.company) {
      return res.status(400).json({ success: false, error: 'Missing contact info (email or company required)' });
    }

    // Empty-submit guard — at least one row must have a style (or manualMode) AND qty > 0.
    const hasUsableRow = (rows || []).some(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      const hasStyle = !!(r.style && String(r.style).trim());
      const hasManual = !!r.manualMode && Number(r.manualCost) > 0;
      return hasQty && (hasStyle || hasManual);
    });
    if (!hasUsableRow) {
      return res.status(400).json({ success: false, error: 'No line items with style and quantity' });
    }

    const isDryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

    // Every Order Form submission (staff-direct OR customer-via-share-link) uses the same
    // globally-sequential OF-NNNN format. For shared-link submits we reuse the draft's existing ID;
    // for direct submits we allocate a fresh one now (skipped in dry-run so sequence numbers aren't burned).
    let extOrderId = draftId || (isDryRun ? 'OF-DRYRUN' : null);
    let draftPkId = null;

    if (draftId) {
      // Share-link path: look up PK_ID + idempotency check on Draft→Processed.
      // Must use PK_ID path for PUT later (Caspio ?filter= PUT silently no-ops).
      try {
        const safeId = String(draftId).replace(/[^A-Z0-9\-]/gi, '');
        const existing = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeId}'`);
        if (Array.isArray(existing) && existing[0]) {
          draftPkId = existing[0].PK_ID || null;
          if (existing[0].Status === 'Processed') {
            return res.json({ success: true, mode: 'already-processed', extOrderId, message: 'Already pushed' });
          }
        }
      } catch (e) {
        console.warn('[Order Form Submit] Idempotency check skipped:', e.message);
      }
    } else if (!isDryRun) {
      // Direct-staff path: allocate a fresh OF-NNNN and create a Draft quote_sessions row upfront
      // (Status flips to Processed after the push result is known, in the PK_ID PUT block below).
      // Skipped in dry-run so we don't burn sequence numbers or pollute quote_sessions during debugging.
      extOrderId = await generateOrderFormDraftId();
      try {
        const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
        const sessionData = {
          QuoteID: extOrderId,
          SessionID: `orderform_${Date.now()}`,
          Status: 'Draft', // flipped to Processed in the Status PUT block after the push result is known
          CustomerName: [info.buyerFirst, info.buyerLast].filter(Boolean).join(' '),
          CompanyName: info.company || '',
          CustomerEmail: info.email || '',
          Phone: info.phone || '',
          // Pull dollar fields from breakdown (computed by frontend pricing modules).
          // NOTE: breakdown.grandTotal is pre-tax ONLY for the React Order Form
          // (pricing/shared.js sets grandTotal = subtotal). The DTG flagship sends a
          // tax+shipping-INCLUSIVE grandTotal here (dtg-inline-form submitToShopWorks),
          // so this OF-NNNN audit row's TotalAmount is NOT a reliable pre-tax figure for
          // DTG — the canonical customer record is the separate DTG-NNN quote_sessions row
          // (dtg-quote-page.js, TotalAmount pre-tax + a SHIP item + a real TaxAmount). This
          // OF row writes no TaxAmount, so /invoice's grand = TotalAmount + 0 still displays
          // the right (tax-incl) number. Tax is left to OnSite (manual-apply pattern).
          TotalQuantity:   Number(breakdown?.totalQty) || 0,
          SubtotalAmount:  Number(breakdown?.subtotal) || 0,
          // [2026-06-09] Caspio Quote_Sessions.LTMFeeTotal is INTEGER — a fractional value (DTG's
          // amortized LTM, e.g. 49.92) 400s this OF-NNNN tracking-session create (caught + logged,
          // so the SW push still succeeds, but the tracking row was silently dropped on DTG LTM
          // pushes). Round to the whole-dollar nominal fee — informational column, matches the
          // dtg-quote-page.js save fix. (No-op when ltmTotal is already integer, e.g. React OF.)
          LTMFeeTotal:     Math.round(Number(breakdown?.ltmTotal) || 0),
          TotalAmount:     Number(breakdown?.grandTotal || breakdown?.subtotal) || 0,
          ExpiresAt: formattedExpiresAt,
          Notes: JSON.stringify({ info, rows, ship, orderNotes, files, decoConfig, staffFilled: [], submitFlow: 'staff-direct' })
        };
        const createResp = await fetch(`${CASPIO_PROXY_BASE}/api/quote_sessions`, {
          method: 'POST',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(sessionData)
        });
        if (createResp.ok) {
          // NOTE: proxy's POST response has a bogus `PK_ID: "records"` (literal string from Location
          // header tail — it's the collection endpoint URL). Always query back to get the real PK.
          // Small delay helps Caspio be ready for the filter query on the just-inserted row.
          await new Promise(r => setTimeout(r, 500));
          try {
            const existing = await makeApiRequest(`/quote_sessions?filter=QuoteID='${extOrderId}'`);
            if (Array.isArray(existing) && existing[0] && typeof existing[0].PK_ID === 'number') {
              draftPkId = existing[0].PK_ID;
            }
          } catch (_) { /* non-fatal */ }
        } else {
          console.warn('[Order Form Submit] Could not pre-save direct submit record:', createResp.status);
        }
      } catch (e) {
        console.warn('[Order Form Submit] Direct-submit pre-save failed (non-fatal):', e.message);
      }
    }

    // --- Build lineItems (one row × qty-bearing size = one line item) ---
    // Iterate every size key on the row (standard XS-4XL plus any non-standard
    // entries: OSFA, YS-YXL, LT-4XLT, 5XL-7XL). We send the BASE part number
    // + plain size string; ShopWorks's Size Translation Table on ingest both
    // (a) maps the size to the correct Size01-06 column AND (b) appends the
    // configured per-size modifier (`_XS`, `_2X`, `_3XL`, …) to the PN.
    // Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
    const lineItems = [];
    const skippedLines = [];   // sizes with qty>0 the engine couldn't price — returned to caller
    // B1 ($0 line guard, Erik 2026-05-22): manual-mode rows with rep-typed
    // $0 used to push through to MO at price=0, landing in ShopWorks as a
    // $0 line + $0 subtotal (e.g. WO 141918 / OF-0050). Block at submit
    // time instead. Fee/service add-ons are built in a separate loop below
    // and can legitimately be $0 (e.g. included service) — those are
    // unaffected.
    const zeroPriceLines = [];
    rows.forEach(r => {
      if (!r || (!r.style && !r.desc && !r.sizes)) return;
      const partBase = (r.style || 'MISC').trim();
      const desc = r.desc || r.style || 'Custom Apparel';
      const color = r.colorName || r.color || '';        // display name — proxy stores as PartColor
      const catalogColor = r.catalogColor || r.color || ''; // CATALOG_COLOR for inventory mapping
      const fallbackPrice = Number(r.price || 0) || 0;
      // Per-row pricing breakdown carries auto-computed unit prices per size.
      // When the rep clicked the price cell to override (priceOverride=true),
      // we honor the manually-typed `r.price` instead. Otherwise prefer the
      // computed unit price for this specific size.
      const rowBreakdown = breakdown?.byRow?.[r.id];
      const isAutoPriced = !r.priceOverride && rowBreakdown && !rowBreakdown.error && breakdown?.supported;
      const sizes = r.sizes || {};
      Object.keys(sizes).forEach(sz => {
        const qty = parseInt(sizes[sz] || 0, 10);
        if (!qty) return;
        let price = fallbackPrice;
        let priceFromBreakdown = false;
        if (isAutoPriced) {
          const computedUnit = rowBreakdown?.unitPriceBySize?.[sz];
          if (Number.isFinite(Number(computedUnit)) && Number(computedUnit) > 0) {
            price = Number(computedUnit);
            priceFromBreakdown = true;
          }
        }
        // Skip auto-priced lines where the engine has no price for this size
        // (e.g. rep typed XS=2 for PC61, which doesn't carry XS). This stops
        // ShopWorks getting a $0 ghost line. The form's grayed cell + tooltip
        // already warned the rep; the rep can force the line by clicking the
        // price cell to switch to manual override. Manual-price rows pass
        // through at whatever the rep typed (even $0).
        if (isAutoPriced && !priceFromBreakdown) {
          skippedLines.push({
            style: partBase,
            color: color,
            size: sz,
            quantity: qty,
            reason: 'No price available for this size in the pricing engine',
          });
          console.warn('[Order Form Submit] Skipping unpriced line:', partBase, sz, 'qty=' + qty);
          return;
        }
        // B1: hard-block garment lines that ended up at $0 after price
        // resolution (manual override with empty/0 price, or unsupported
        // pricing method with no fallback). Pushing $0 produces invisible
        // garbage in ShopWorks — rep should fix the row, not paper over it.
        if (!(price > 0)) {
          zeroPriceLines.push({
            style: partBase,
            color: color,
            size: sz,
            quantity: qty,
          });
          return;
        }
        // Send the BASE part number + plain size. ShopWorks's Size Translation
        // Table appends the per-size modifier (`_XS`, `_2X`, `_3XL`, etc.) on
        // ingest. Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
        // The frontend breakdown row + inventory wrapper still use
        // orderFormSizeSuffix() — display + SanMar inventory needs the
        // suffixed PN. Only this MO push uses the base PN.
        lineItems.push({
          partNumber: partBase,
          description: desc,
          color: color,
          catalogColor: catalogColor,
          size: sz,
          quantity: qty,
          price: price,
          // WorkOrderNotes = print location(s) for this line (Erik 2026-05-20).
          // Surfaces in ShopWorks's line-level work-order printout so the
          // production-floor operator sees the print location next to the
          // garment SKU/size/qty without flipping to Notes To Production.
          // Frontend sends printLocations as the human-readable label
          // ("Left Chest", "Full Back", "Left Chest + Full Back"). Empty
          // string when not set — proxy strips empty workOrderNotes so no
          // blank field lands in ShopWorks.
          workOrderNotes: printLocations || '',
          // Internal — used below to link this line to the matching design's
          // ExtDesignID after the designs[] array is built. Removed before
          // the payload is sent to the proxy.
          _method: r.deco || decoConfig?.method || ''
        });
      });
    });

    // B1 reject: any garment line that collapsed to $0 above blocks the
    // whole submit. Rep sees the offending row(s) and fixes the price.
    if (zeroPriceLines.length > 0) {
      const summary = zeroPriceLines
        .map(z => `${z.style}${z.color ? ` (${z.color})` : ''} ${z.size} × ${z.quantity}`)
        .join('; ');
      const plural = zeroPriceLines.length === 1;
      console.warn('[Order Form Submit] Rejecting submit — $0 line(s):', summary);
      return res.status(400).json({
        success: false,
        error: '$0 line item',
        details: `${plural ? 'Line' : 'Lines'} ${summary} ${plural ? 'has' : 'have'} no price. Set a price on the row before submitting.`,
        zeroPriceLines,
      });
    }

    // --- Add-on fees (Phase 2a 2026-05-03) ---
    // Server-side companion to window.OrderFormServiceCodes (frontend client).
    // Resolves SellPrice from the in-memory Service_Codes cache and appends
    // a LinesOE entry per add-on. Phase 2a supports FIXED + FLAT only;
    // TIERED / CALCULATED / PASSTHROUGH / HOURLY methods are skipped with a
    // console warn so the rep sees them missing on the next submit (UI in
    // Phase 2b adds proper handling). Service codes that aren't in the
    // KNOWN_FEE_PNS proxy whitelist may still flow but ShopWorks may reject
    // them — server-side validation against KNOWN_FEE_PNS lives at the
    // proxy layer (caspio-pricing-proxy v608+).
    if (Array.isArray(addOns) && addOns.length > 0) {
      const serviceCodesUrl = `${CASPIO_PROXY_BASE}/api/service-codes`;
      let serviceCodes = [];
      try {
        const r = await fetch(serviceCodesUrl);
        if (r.ok) {
          const j = await r.json();
          serviceCodes = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        }
      } catch (err) {
        console.error('[Order Form Submit] Service_Codes fetch failed:', err.message);
      }
      const findCode = (code) => serviceCodes.find(s => s.ServiceCode === code) || null;
      const orderSubtotal = Number(breakdown?.subtotal) || 0;

      for (const a of addOns) {
        if (!a || !a.code) continue;
        const sc = findCode(a.code);
        if (!sc) {
          console.warn('[Order Form Submit] Skipping add-on — code not in Service_Codes:', a.code);
          continue;
        }
        const method = String(sc.PricingMethod || '').toUpperCase();
        const baseSell = Number(sc.SellPrice) || 0;
        const qty = Number(a.qty) || 0;
        if (qty <= 0) continue;

        let unitPrice = null;
        switch (method) {
          case 'FIXED':
          case 'FLAT':
            unitPrice = baseSell;
            break;
          case 'CALCULATED':
            // RUSH = subtotal × percent (default 25). Sent as a single
            // line with qty=1 and price=full surcharge amount.
            if (a.code === 'RUSH' && orderSubtotal > 0) {
              const pct = Number(a?.params?.percent ?? 25) / 100;
              unitPrice = orderSubtotal * pct;
            }
            break;
          case 'PASSTHROUGH':
            // Freight / Pallet / Discount / CDP — rep enters the dollar amount.
            const passAmount = Number(a?.params?.amount);
            if (Number.isFinite(passAmount)) unitPrice = passAmount;
            break;
          case 'HOURLY':
            // Art — rate × hours. SellPrice is the hourly rate.
            const hrs = Number(a?.params?.hours);
            if (Number.isFinite(hrs) && hrs > 0) unitPrice = baseSell * hrs;
            break;
          case 'TIERED':
            // Phase 2c will resolve via /api/al-pricing or stitch surcharge
            // bundles. Until then, allow the rep to override via params.unitPrice
            // (escape hatch) so this isn't a hard blocker.
            const overrideUnit = Number(a?.params?.unitPrice);
            if (Number.isFinite(overrideUnit) && overrideUnit > 0) unitPrice = overrideUnit;
            else console.warn('[Order Form Submit] Skipping TIERED add-on — Phase 2c will wire price lookup:', a.code);
            break;
          default:
            console.warn('[Order Form Submit] Unknown PricingMethod for', a.code, '→', method);
        }

        if (unitPrice == null) continue;  // unresolved — skip rather than push $0

        // Phase 7 — for additional-logo codes (AL, AL-CAP, DECG-FB, CTR-*),
        // build a DisplayAsDescription that includes the position + stitches.
        // Production sees "AL · Right Sleeve · 5,000 stitches" inline on the
        // work order's LinesOE row, so they know exactly where each logo goes
        // without cross-referencing the design's Locations[] array.
        const positionCodes = new Set(['AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap']);
        let displayDescription = '';
        if (positionCodes.has(a.code)) {
          const pos = a?.params?.position || (a.code === 'DECG-FB' ? 'Full Back' : '');
          const stitches = Number(a?.params?.stitchCount) || 0;
          const parts = [pos, stitches > 0 ? `${stitches.toLocaleString()} stitches` : ''].filter(Boolean);
          displayDescription = parts.join(' · ');
        }

        lineItems.push({
          partNumber: a.code,
          description: sc.DisplayName || a.code,
          displayDescription,  // empty string for non-position codes (proxy passes through verbatim)
          color: '',           // services don't carry color
          catalogColor: '',
          size: '',            // services don't carry size
          quantity: qty,
          price: Number(unitPrice.toFixed(4)),
        });
      }
    }

    // --- Designs: one per decoration method present in rows, artwork URLs attached ---
    // DesignType IDs per Erik's "design type translation.csv" (2026-05-02).
    // PRIOR VALUES WERE WRONG — only DTG was correct. All other methods
    // were sending design type 3 ("standard"), which doesn't exist in
    // ShopWorks's design taxonomy. Authoritative IDs from CSV:
    //   1 = Screenprint, 2 = Embroidery, 4 = Advertising Specialty (Stickers),
    //   5 = Emblem, 8 = Transfer (DTF), 45 = DTG
    const DESIGN_TYPE_ID = { embroidery: 2, screenprint: 1, dtg: 45, dtf: 8, sticker: 4, emblem: 5 };
    const DESIGN_LABEL   = { embroidery: 'Embroidery', screenprint: 'Screen Print', dtg: 'DTG', dtf: 'DTF Transfer', sticker: 'Stickers', emblem: 'Embroidered Emblems' };
    // OrderType IDs verified against the live ShopWorks Order Types list
    // (Erik's screenshots, 2026-05-02). The earlier CSV had every ID wrong
    // except none — all six methods were sending to the wrong production
    // queue. Caught after OF-0027 sent id_OrderType=5 and ShopWorks
    // displayed "Digital Printing" instead of the expected "Embroidery".
    //
    //   21 = Custom Embroidery       (account 4050 Custom Embroidered Sales)
    //   13 = Screen Print Subcontract (account 4200 Subcontract Screenprinted Sales)
    //   5  = Digital Printing         (account 4001 Digital Printing Sales)
    //   18 = Transfers                (account 4005 Transfer Sales)
    //   41 = Laser/Ad Specialties     (account 4400 Ad Specialty Sales)
    //   7  = Emblem                   (account 4002 Emblem Sales)
    //   6  = Online Store fallback    (account 4003) — only used when no method selected
    //
    // Per Erik (2026-05-02): order types CANNOT be mixed in ShopWorks, so
    // an order has exactly one decoration method. We use methodsUsed[0]
    // and let the form's UI guard against multi-method submissions.
    const ORDER_TYPE_ID = { embroidery: 21, screenprint: 13, dtg: 5, dtf: 18, sticker: 41, emblem: 7 };
    const ORDER_TYPE_DEFAULT = 6;  // Online Store — fallback when no method picked
    const methodsUsed = [...new Set(rows.map(r => r && r.deco).filter(Boolean))];

    // Audit fix M3 (2026-05-21): ShopWorks doesn't allow mixed-method orders
    // — each order routes to a single production queue (id_OrderType). If the
    // rep accidentally mixes DTG + EMB rows, the push would silently land on
    // whichever method wins the methodsUsed[0] race, and the other method's
    // lines arrive at the wrong production queue. Block at submit time with
    // a clear message; rep should split into separate orders.
    if (methodsUsed.length > 1) {
      console.warn('[Order Form Submit] Mixed-method blocked:', methodsUsed.join(', '), 'for', extOrderId);
      return res.status(400).json({
        success: false,
        error: 'Mixed-method orders not supported',
        details: `This order has rows with ${methodsUsed.length} different decoration methods (${methodsUsed.join(', ')}). ShopWorks orders can only have ONE decoration method. Please split this into separate orders — one per method.`,
        methodsUsed,
      });
    }

    // C2 (Erik 2026-05-22): the prior `designTypeId: DESIGN_TYPE_ID[method] || 3`
    // silently fell to design type 3 ("standard" — doesn't exist in ShopWorks's
    // design taxonomy) when method was missing or unrecognized. Result: orders
    // landed in SW with a bogus type and the quote-view rendered "Type: Unknown"
    // on the Designs panel (e.g. OF-0050). Reject at submit time so reps fix
    // the row's method before the order ships off to MO.
    const primaryMethod = methodsUsed[0] || decoConfig?.method || '';
    if (primaryMethod && !DESIGN_TYPE_ID[primaryMethod]) {
      console.warn('[Order Form Submit] Unmapped method blocked:', primaryMethod, 'for', extOrderId);
      return res.status(400).json({
        success: false,
        error: 'Unsupported decoration method',
        details: `Method "${primaryMethod}" isn't recognized. Pick one of: ${Object.keys(DESIGN_TYPE_ID).join(', ')}.`,
        method: primaryMethod,
      });
    }

    // Design # → id_Design resolution.
    //
    // CASPIO TABLE INSIGHT (Erik confirmed 2026-05-02): the
    // `Design_Lookup_2026` table's `Design_Number` column IS ShopWorks's
    // `id_Design` value — they're the same integer under different column
    // names (the table's `ID_Unique` column is empty). So the autocomplete's
    // pick of design 9449 means we pass `id_Design: 9449` to ShopWorks
    // directly, no second lookup needed.
    //
    // The rep can also type a free-form design# from memory; we accept any
    // integer between 1 and 999999. Non-numeric input falls through to
    // Designs:[] (Phase A behavior — no orphan creation).
    const linkedIdDesigns = (Array.isArray(designNumbers) ? designNumbers : [])
      .map(n => Number(String(n || '').trim()))
      .filter(n => Number.isInteger(n) && n > 0 && n < 1000000);

    // Designs[]: emit when EITHER (a) at least one design# resolved to a real
    // ShopWorks id_Design (existing-design path) OR (b) the rep uploaded at
    // least one artwork file (new-design path — ShopWorks creates a new
    // design record from the metadata + ImageURL). Otherwise return [] so
    // ShopWorks doesn't create an orphan design from DesignName alone.
    //
    // Erik's evolved preference (2026-05-02 → 2026-05-20):
    //   2026-05-02: "if there isn't a design we shouldn't create a new one,
    //                just leave it blank and the sales rep can select the
    //                design inside shopworks"
    //   2026-05-20: "if rep uploads new artwork, create the design with full
    //                metadata + image so the art team doesn't have to chase
    //                emailed attachments separately"
    //
    // The frontend gates the new-design path so it only fires when (a) at
    // least one file IS uploaded AND (b) the rep typed a Design Name AND
    // (c) NO existing Design # was picked (conflict prevention). See
    // memory/MO_NEW_DESIGN_FLOW.md (to be added).
    const hostedAnyFiles = (files || []).some(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))));
    const designs = (linkedIdDesigns.length === 0 && !hostedAnyFiles) ? [] : methodsUsed.map((method) => {
      const hostedFiles = files.filter(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))));
      // Primary location entries (from uploaded artwork files OR placeholder).
      const primaryLocations = (hostedFiles.length ? hostedFiles : [{ name: 'placeholder' }]).map((f, i) => ({
        location: (f.placements && f.placements[0]) || 'Left Chest',
        colors: f.colors || '',
        code: f.designNo || `${method.slice(0,3).toUpperCase()}-${i + 1}`,
        imageUrl: f.hostedUrl || f.preview || '',
        customField01: f.hostedUrl || f.preview || '',
        notes: f.colors ? `Colors: ${f.colors}` : ''
      }));

      // Phase 7 — append additional-logo locations from add-ons.
      // For each AL/AL-CAP/DECG-FB/CTR-* addon with a position param, push
      // a Locations[] entry so ShopWorks's production view shows all logo
      // positions on this design (not just the primary). Sequential codes
      // (EMB-2, EMB-3, …) follow the primary's EMB-1 numbering.
      const positionCodes = new Set(['AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap']);
      const addonLocations = [];
      let nextLocCode = primaryLocations.length + 1;
      const methodPrefix = method.slice(0, 3).toUpperCase();
      (Array.isArray(addOns) ? addOns : []).forEach(a => {
        if (!a || !positionCodes.has(a.code)) return;
        const pos = a?.params?.position || (a.code === 'DECG-FB' ? 'Full Back' : 'Additional');
        const stitches = Number(a?.params?.stitchCount) || 0;
        addonLocations.push({
          location: pos,
          colors: '',
          code: `${methodPrefix}-${nextLocCode++}`,
          imageUrl: '',
          customField01: '',
          notes: stitches > 0 ? `${stitches.toLocaleString()} stitches · ${a.code}` : a.code,
        });
      });

      const base = {
        name: `${info.company || 'Order'} — ${DESIGN_LABEL[method] || method}`,
        externalId: `${extOrderId}-${method.toUpperCase()}`,
        // ForProductColor (proxy maps `productColor` → `ForProductColor`):
        // Use CATALOG_COLOR codes (matches the LinesOE.Color rule from proxy v606)
        // and include rows whose deco isn't explicitly set — those default to
        // the form's primary method (embroidery) and were silently dropped from
        // this aggregation before, which left ShopWorks with a Design that only
        // referenced 3 of 11 colors on multi-row orders. See OF-0025.
        productColor: [...new Set(
          rows
            .filter(r => !r.deco || r.deco === method)
            .map(r => r.catalogColor || r.colorName || r.color)
            .filter(Boolean)
        )].join(', '),
        // C2 (2026-05-22): no `|| 3` fallback — methodsUsed has been validated
        // against DESIGN_TYPE_ID at the guard above, so this lookup always
        // resolves to a real ShopWorks design type ID.
        designTypeId: DESIGN_TYPE_ID[method],
        locations: [...primaryLocations, ...addonLocations],
      };
      // Attach known id_Design references per CLAUDE.md MANAGEORDERS pattern.
      // For methods that primarily use this lookup (embroidery), pass the array
      // so the proxy can link rather than create a new generic design.
      // ALSO: when exactly one design# resolves, set base.idDesign (singular)
      // so the proxy's transformDesigns() actually reads it. The proxy only
      // looks at `idDesign`/`id_Design` on the design object — `linkedDesigns`
      // is currently a no-op until multi-design# support lands. Without this
      // singular alias, even a successful design# lookup silently dropped to
      // id_Design:0 in the ShopWorks payload (orphan).
      // DTG added 2026-05-20 — the new DTG Quote Builder has a customer-aware
      // Design # picker that hands back the existing ShopWorks id_Design.
      // Without DTG in this whitelist, the picked design was silently dropped
      // and ShopWorks created an orphan placeholder design on every DTG push.
      if (linkedIdDesigns.length && (method === 'embroidery' || method === 'screenprint' || method === 'dtf' || method === 'dtg')) {
        base.linkedDesigns = linkedIdDesigns.map(id => ({ id_Design: id }));
        if (linkedIdDesigns.length === 1) base.idDesign = linkedIdDesigns[0];
      }
      // NEW-DESIGN PATH (Erik 2026-05-20): when no existing design# was picked
      // but rep uploaded artwork + typed a Design Name, override the auto-
      // generated "${company} — ${method}" name with the rep's chosen name.
      // This makes the new design searchable in ShopWorks's art library by
      // a meaningful identifier (e.g. "Star Sportswear front logo 2026")
      // rather than a generic auto-name.
      if (!linkedIdDesigns.length && info.newDesignName && String(info.newDesignName).trim()) {
        base.name = String(info.newDesignName).trim();
      }
      return base;
    });

    // --- Attachments: only hosted URLs (not base64 previews) ---
    const attachments = files
      .filter(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))))
      .map(f => ({
        mediaUrl: f.hostedUrl || f.preview,
        mediaName: f.name || 'artwork',
        linkNote: (f.placements || []).join(', ')
      }));

    // --- Notes (4-way split, all targeting separate ShopWorks tabs) ---
    // Each block lands on a different ShopWorks screen for a different role.
    // Verified against the live order #141671 notes UI (Erik's screenshots).
    //
    //   Notes On Order        → CSR/AR header: order audit, CRM Customer ID, tax account
    //   Notes To Production   → production team: stitch/location + garment breakdown
    //   Notes To Purchasing   → sourcing team: line-by-line PN + color + size + price
    //   Notes To Art          → art team (only when rep added art notes or files)
    //
    // ShopWorks's API only accepts these 9 note types: Notes On Order,
    // Notes To Art, Notes To Purchasing, Notes To Subcontract, Notes To
    // Production, Notes To Receiving, Notes To Shipping, Notes To Accounting,
    // Notes On Customer (new customers only). "Notes On Packing List" is NOT
    // a valid type — packing-slip output is a ShopWorks template concern,
    // not a note type. Pushing it caused the proxy's note validator to
    // reject the entire array.
    //
    // NOT sent (intentional — already in MO structured fields):
    //   - Shipping (ShippingAddresses[], date_OrderRequestedToShip, date_OrderDropDead)
    //   - Contact info (Contact*, CustomerPurchaseOrder, CustomerServiceRep)
    // Notes builders now return ARRAYS of strings — push each as a separate
    // notesBlocks entry so ShopWorks displays them as distinct rows in the
    // corresponding Notes tab. Erik (2026-05-20): "the notes need to come in
    // as separate line items in the notes section". One note row per fact
    // beats one row crammed with multi-line text.
    const notesBlocks = [];
    const pushArray = (type, arr) => {
      for (const note of (Array.isArray(arr) ? arr : [arr])) {
        if (note && String(note).trim()) {
          notesBlocks.push({ type, note: String(note).trim() });
        }
      }
    };

    // Pre-warm the sales_tax_accounts_2026 cache so buildOrderNote can do
    // server-side rate→account resolution if the frontend dropped ship.taxAccount.
    // Fire-and-forget — note builder handles cache-miss gracefully (falls back
    // to hardcodes for pickup/OOS, NEEDS REVIEW otherwise).
    await ensureTaxAccountsCache().catch(() => {});

    // Server-side authoritative resolution: if frontend didn't capture the
    // GL account (DOR API hiccup, frontend bug), look it up from Caspio by
    // rate so we never push generic '2200' parent account by mistake.
    if (!ship.taxAccount && Number(ship.taxRate) > 0) {
      const lookup = findTaxAccountByRate(Number(ship.taxRate));
      if (lookup) {
        ship.taxAccount = lookup.account;
        ship.taxAccountName = lookup.accountName;
        console.log(`[submit] tax account auto-resolved by rate ${ship.taxRate} → ${ship.taxAccount}`);
      }
    }

    // Notes On Order — primary tab CSR/AR/Production all read. Includes
    // print locations + full tax block (subtotal/rate/amount/total/account/apply).
    // M1 (2026-05-21) briefly split tax into Notes To Accounting; reverted
    // 2026-05-22 because most users scan Notes On Order first.
    pushArray('Notes On Order',     buildOrderNote({ info, breakdown, draftId, ship, orderNotes, extOrderId, printLocations }));
    pushArray('Notes To Production', buildProductionNote({ rows, breakdown, methodNotesBlock }));
    pushArray('Notes To Purchasing', buildPurchasingNote({ rows }));

    if (info.artNotes || (Array.isArray(files) && files.length)) {
      // Art note remains a single multi-line entry for now (file links + colors
      // belong together for the art team's review). Refactor to array if Erik
      // asks later.
      const artNote = buildArtNote({ info, files });
      if (artNote) notesBlocks.push({ type: 'Notes To Art', note: artNote });
    }

    // --- Link line items to their design via ExtDesignIDBlock --------
    // Without this, ShopWorks imports each line with the "Apply Designs"
    // toggle OFF — the rep then has to manually flip it on every line
    // before production can see the artwork. By setting ExtDesignIDBlock
    // = the design's ExtDesignID, the OnSite import auto-links the line
    // to the design and toggles Apply Designs ON. (Erik confirmed 2026-05-21
    // by inspecting WO 141899 line item PC90H_3XL.)
    //
    // designsByMethod maps "DTG"/"EMB"/etc. → "OF-0048-DTG" (the externalId
    // we sent in the Designs[] array). Lines whose row method has no design
    // (e.g., manual-only fee rows) leave extDesignIdBlock empty — same as
    // pre-fix behavior, no regression.
    const designsByMethod = new Map();
    (designs || []).forEach(d => {
      const m = (d?.externalId || '').match(/-([A-Z0-9]+)$/);
      if (m && m[1]) designsByMethod.set(m[1], d.externalId);
    });
    lineItems.forEach(line => {
      const lineMethod = (line._method || '').toUpperCase();
      if (lineMethod && designsByMethod.has(lineMethod)) {
        line.extDesignIdBlock = designsByMethod.get(lineMethod);
      }
      delete line._method;
    });

    // Build the order Description field — populates ShopWorks's
    // Order Information > Description (visible in order list views).
    // Format: "EMBROIDERY · Left Chest · 8,000 stitches" — gives ShopWorks
    // staff a method-at-a-glance summary without opening the order.
    const orderDescription = String(methodNotesBlock || '')
      .split('\n')[0]                    // first line of method block
      .trim()
      || (rows && rows.length ? `Order — ${rows.length} line${rows.length === 1 ? '' : 's'}` : '');

    // --- Canonical camelCase payload — same shape proxy's manageorders-push-client expects ---
    const manageOrdersPayload = {
      orderNumber: extOrderId,
      customerPurchaseOrder: info.po || extOrderId,
      // Order-level Description — ShopWorks shows this in the order header.
      description: orderDescription,
      customer: {
        company: info.company || '',
        // CRM Customer ID — proxy can use this as ExtCustomerID for repeat-
        // customer matching in ShopWorks (Forma Construction always lands
        // on the same customer record across multiple orders).
        companyId: info.companyId || '',
        firstName: info.buyerFirst || '',
        lastName: info.buyerLast || '',
        email: info.email || '',
        phone: info.phone || ''
      },
      lineItems,
      designs,
      attachments,
      // Shipping block. Two cases (Erik 2026-05-20, refined later same day):
      //
      // (1) Customer Pickup: send the block with NWCA Milton as the address,
      //     ShipAddress01 = "Customer Pickup" as a marker. Earlier we tried
      //     omitting the block entirely for pickup orders, but that left
      //     ShopWorks's order header with no Ship Method — production +
      //     AR reports lost track of these orders. The "Customer Pickup"
      //     marker in ShipAddress01 makes it unambiguous to anyone reading
      //     the order that this isn't a real ship-to. The city/state/zip
      //     are NWCA's actual location so the order has a valid address
      //     for filtering/reporting.
      //
      // (2) Shipping (UPS Ground / Priority Mail / Other): send the real
      //     ship-to address the rep typed in the ship-to block.
      shipping: (ship.method === 'pickup' || ship.method === 'willcall' || ship.method === 'Customer Pickup')
        ? {
          // Customer Pickup — ships to NWCA Milton location.
          // Uses NWCA_LOCATIONS.milton so the address lives in one place.
          // ShipAddress01 is overridden to "Customer Pickup" as a visible
          // marker on ShopWorks / packing slips.
          company: NWCA_LOCATIONS.milton.company,
          firstName: '',
          lastName: '',
          address1: 'Customer Pickup',
          address2: '',
          city: NWCA_LOCATIONS.milton.city,
          state: NWCA_LOCATIONS.milton.state,
          zip: NWCA_LOCATIONS.milton.zip,
          country: NWCA_LOCATIONS.milton.country,
          method: 'Customer Pickup'
        }
        : {
          company: info.company || '',
          firstName: info.buyerFirst || '',
          lastName: info.buyerLast || '',
          // NWCA shipping convention (from the OF ship-to block):
          //   line 1 = recipient name ("Wendy Mickelson")
          //   line 2 = street address ("14805 75th Street Ct East")
          // Bug history: address2 was previously hard-coded to '' so the
          // actual street never reached ShopWorks (WO 141899 landed with
          // only the recipient name in ShipAddress01). Erik 2026-05-21.
          address1: ship.address || info.address || '',
          address2: ship.address2 || info.address2 || '',
          city: ship.city || info.city || '',
          state: ship.state || info.state || '',
          zip: ship.zip || info.zip || '',
          country: 'USA',
          // ShipMethod: frontend now sends ShopWorks-canonical names directly
          // ('UPS Ground' / 'Priority Mail'). Translate legacy codes for
          // backward-compat; pass through anything else verbatim.
          method: (ship.method === 'ups' ? 'UPS Ground'
            : (ship.method === 'other' ? 'Other'
              : (ship.method || 'UPS Ground')))
        },
      billing: {
        company: info.company || '',
        address1: info.address || '',
        address2: '',
        city: info.city || '',
        state: info.state || '',
        zip: info.zip || '',
        country: 'USA'
      },
      notes: notesBlocks,
      // Rush flag (Erik 2026-05-23): was hardcoded false. info.isRush comes
      // from the explicit RUSH checkbox in the order form (audit fix L4
      // 2026-05-21). Used by SW to prioritize in the production queue.
      rushOrder: !!info.isRush,
      // Tax: ALWAYS send 0. (2026-05-20 — see memory/wa-sales-tax-rules.md)
      //
      // Background: the ShopWorks ManageOrders integration is configured with
      // hardcoded Tax Line Item = "Tax_10.1" and Tax Account = "2200.101".
      // Those defaults stamp ALL orders pulled by the integration regardless
      // of payload — there's no per-order override. Sending TaxTotal: $X
      // would auto-create a tax line with the right dollar amount but the
      // WRONG label and GL account for non-Milton destinations (e.g. a Seattle
      // 10.35% order would show as "City of Milton Sales Tax 10.1%" in
      // ShopWorks's books).
      //
      // Erik's chosen workflow: send TaxTotal: 0, no auto-tax-line gets
      // created, Erik manually applies the correct tax line in ShopWorks
      // using the structured Notes On Order block (see buildOrderNote above)
      // which carries the Caspio account number + rate + dollar amount the
      // rep saw at quote time. The customer-facing quote (in the form preview)
      // still shows the correct tax — only the ShopWorks push omits it.
      taxTotal: 0,
      // [2026-06-09] DTG Phase 2 — billed shipping. ship.fee carries the rep's charge
      // (0 for pickup — the frontend's effectiveShipFee() zeroes it). Was hardcoded 0
      // back when the DTG form never billed shipping (UPS cost treated as COGS). The
      // customer-facing tax/total still live in the quote-view + Notes On Order block;
      // OnSite sums line items + cur_Shipping for the order, tax applied manually.
      cur_Shipping: Number(ship?.fee) || 0,
      totals: {
        subtotal: 0, rushFee: 0, salesTax: 0, shipping: Number(ship?.fee) || 0, grandTotal: 0
      },
      payments: [],
      // Source/sales-rep fields — the proxy maps CustomerServiceRep → ShopWorks CSR.
      // SALES_REP_FULL_NAMES translates the form's dropdown slug
      // ("taneisha") to the canonical full name ("Taneisha Clark") that
      // ShopWorks displays. Falls back to whatever's in info.salesRep so
      // unknown values pass through (better than swallowing them).
      extSource: 'NWCA-OrderForm',
      salesRep: SALES_REP_FULL_NAMES[info.salesRep] || info.salesRep || '',
      // Payment terms — one of: "Prepaid" (default) | "Pay On Pickup"
      terms: info.terms || 'Prepaid',
      // Proxy expects camelCase names matching manageorders-push-client: orderDate, requestedShipDate, dropDeadDate
      // Dates (2026-05-20 — Erik split dueDate from dropDeadDate).
      //   orderDate          = today (rep can override via info.dateIn)
      //   requestedShipDate  = production due date — auto-calc from qty in
      //                         frontend (≤24 pcs → 5 BDs, >24 → 10 BDs) OR
      //                         rep-overridden value. Maps to ShopWorks's
      //                         "Req. Ship Date" field.
      //   dropDeadDate       = customer's hard deadline (event/photoshoot).
      //                         Optional — empty when customer has no event.
      //                         Maps to ShopWorks's "Drop Dead Date" field.
      //   Previously both fields shared info.dateDue, which incorrectly
      //   shoved "today" into ShopWorks's Drop Dead column on every order.
      orderDate: toISODate(info.dateIn) || new Date().toISOString().slice(0, 10),
      requestedShipDate: toISODate(info.dateDue || info.dateIn) || new Date().toISOString().slice(0, 10),
      dropDeadDate: toISODate(info.dropDeadDate),
      // Customer routing — when the rep picked a known company from
      // autocomplete, info.companyId carries the real ShopWorks id_Customer
      // (e.g. 1276 for Aaberg's Rentals). Falls back to 2791 (catch-all
      // "Online Order Form Customer") for brand-new typed names.
      idCustomer: Number(info.companyId) || 2791,
      // Employee Created By — maps the picked Sales Rep to their ShopWorks
      // Employee ID so the order header says "created by Taneisha" not
      // "created by Erik". Fallback 2 (Erik) for unknown reps.
      idEmpCreatedBy: SALES_REP_EMP_IDS[info.salesRep] || 2,
      // OrderType per the order's decoration method. Per Erik (2026-05-02)
      // ShopWorks doesn't allow mixed order types, so an order has one
      // method. We take methodsUsed[0]; if the form UI ever lets a
      // multi-method order through, the first method wins (better than
      // misrouting everything to a generic default).
      idOrderType: ORDER_TYPE_ID[methodsUsed[0]] || ORDER_TYPE_DEFAULT,
      // APISource MUST equal the single consolidated "Manage Orders" ShopWorks
      // integration's filter value ("ManageOrders") — that integration imports ONLY
      // orders whose APISource matches it exactly; a blank value is silently skipped.
      // Uniform with the quote-builder / 3-Day-Tees / Inksoft pushes (all "ManageOrders"
      // as of 2026-06-04). The proxy's transformOrder also forces this value, so this
      // is belt-and-suspenders. (Erik 2026-06-04: "ManageOrders" on everything we push.)
      apiSource: 'ManageOrders'
    };

    console.log('[Order Form Submit] Pushing', extOrderId, 'lines:', lineItems.length, 'designs:', designs.length);

    // Dry-run short-circuit: returns the payload without pushing. For debugging + smoke tests.
    if (req.query.dryRun === '1' || req.query.dryRun === 'true') {
      console.log('[Order Form Submit] dryRun=1 — not forwarding to ManageOrders');
      return res.json({ success: true, mode: 'dry-run', extOrderId, payload: manageOrdersPayload, skippedLines });
    }

    const MANAGEORDERS_API = `${CASPIO_PROXY_BASE}/api/manageorders/orders/create`;
    const response = await fetch(MANAGEORDERS_API, {
      method: 'POST',
      // Secret required since proxy v2026.08.05.9 gated this route.
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(manageOrdersPayload)
    });
    const result = await response.json().catch(() => ({}));

    const ok = response.ok && result.success !== false;
    const shopWorksId = result.orderNumber || result.shopWorksId || null;

    // Update Caspio quote_sessions status (audit trail — both share-link AND staff-direct flows).
    // MUST use PK_ID path — ?filter=QuoteID='…' is accepted with 200 but silently no-ops (proxy quirk).
    // NOTE: the public GET via filter is also cached ~5min, so a reload right after submit may still
    // show "Draft" briefly. The submit response itself is authoritative for the UI.
    if (draftPkId) {
      // Use makeApiRequest (known-good Caspio PUT pattern, same as /api/quote_sessions/:id route uses).
      // Only PUT Status — Caspio's Notes column has a ~500-char limit; the form state from the Draft
      // INSERT stays intact. shopWorksId is visible in server logs + ShopWorks UI.
      const newStatus = ok ? 'Processed' : 'Processed - ShopWorks Failed';
      try {
        // Single retry with 1.5s delay for transient post-INSERT write races.
        let success = false;
        try {
          await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
          success = true;
        } catch (firstErr) {
          await new Promise(r => setTimeout(r, 1500));
          await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
          success = true;
        }
        if (success) console.log('[Order Form Submit] ✓', extOrderId, 'marked', newStatus, shopWorksId ? ('→ SW#' + shopWorksId) : '');
      } catch (e) {
        console.warn('[Order Form Submit] Status PUT failed after retry:', e.message);
      }
    } else {
      console.warn('[Order Form Submit] No PK_ID for', extOrderId, '— status not updated in Caspio');
    }

    if (ok) {
      console.log('[Order Form Submit] ✓ Pushed', extOrderId, '→', shopWorksId);

      // Best-effort: save one quote_items row per (row, size) for line-level
      // audit history + analytics. Same schema as DTG/Embroidery/SP/DTF quote
      // builders. Failure here doesn't fail the order — push already succeeded.
      try {
        if (breakdown?.supported && breakdown.byRow) {
          const QUOTE_ITEMS_URL = `${CASPIO_PROXY_BASE}/api/quote_items`;
          const decoMethod = decoConfig?.method || rows.find(r => r?.deco)?.deco || '';
          const cfg = decoConfig || {};
          const primaryLocation = cfg.primaryLocation || cfg.locationCombo || cfg.size || '';
          let lineNumber = 1;
          for (const r of rows) {
            if (!r) continue;
            const rb = breakdown.byRow[r.id];
            if (!rb || rb.error) continue;
            const sizes = r.sizes || {};
            for (const sz of Object.keys(sizes)) {
              const qty = parseInt(sizes[sz] || 0, 10);
              if (!qty) continue;
              const finalUnit = Number(rb.unitPriceBySize?.[sz] ?? 0);
              const baseUnit  = Math.max(0, finalUnit - Number(rb.extras?.ltmPerPiece || 0));
              const item = {
                QuoteID: extOrderId,
                LineNumber: lineNumber++,
                StyleNumber: r.style || '',
                ProductName: r.desc || r.style || '',
                Color: r.colorName || r.color || '',
                ColorCode: r.catalogColor || '',
                EmbellishmentType: decoMethod,
                PrintLocation: primaryLocation,
                PrintLocationName: primaryLocation,
                Quantity: qty,
                HasLTM: rb.tier === '1-7' || rb.tier === '1-23' || rb.tier === '10-23',
                BaseUnitPrice: Number(baseUnit.toFixed(4)),
                LTMPerUnit:    Number((rb.extras?.ltmPerPiece || 0).toFixed(4)),
                FinalUnitPrice: Number(finalUnit.toFixed(2)),
                LineTotal:      Number((finalUnit * qty).toFixed(2)),
                SizeBreakdown:  JSON.stringify({ [sz]: qty }),
                PricingTier:    rb.tier || '',
                ImageURL:       r.imageUrl || '',
              };
              try {
                await fetch(QUOTE_ITEMS_URL, {
                  method: 'POST',
                  headers: withProxySecret({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify(item),
                });
              } catch (_) { /* per-line failure is non-fatal */ }
            }
          }
          console.log('[Order Form Submit] quote_items saved for', extOrderId, '(', lineNumber - 1, 'lines )');
        }
      } catch (e) {
        console.warn('[Order Form Submit] quote_items save failed (non-fatal):', e.message);
      }

      // Phase 6c (2026-05-03) — track customer service history. After every
      // successful ShopWorks push, upsert one row in Customer_Service_History
      // per addOn so the next time this customer's name shows up on an order,
      // their most-used services float to the top of the rail. Best-effort —
      // wrapped in try/catch so a tracking failure NEVER blocks submission.
      try {
        const company = (info?.company || '').trim();
        const uniqueCodes = Array.isArray(addOns)
          ? Array.from(new Set(addOns.filter(a => a?.code).map(a => String(a.code))))
          : [];
        if (company && uniqueCodes.length > 0) {
          const HIST_URL = `${CASPIO_PROXY_BASE}/api/order-form/customer-suggestions/history`;
          // Fire all upserts in parallel — Caspio handles concurrent writes
          // fine since the table's composite unique index serializes the
          // (Customer_Company, Service_Code) pair.
          await Promise.allSettled(uniqueCodes.map(code =>
            fetch(HIST_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ company, serviceCode: code, orderId: extOrderId }),
            }).catch(() => null)
          ));
          console.log('[Order Form Submit] Customer_Service_History tracked', uniqueCodes.length, 'codes for', company);
        }
      } catch (e) {
        console.warn('[Order Form Submit] Customer_Service_History upsert failed (non-fatal):', e.message);
      }

      const successBody = { success: true, extOrderId, shopWorksId, mode: 'live', skippedLines };
      cacheSubmitResponse(idemId, { statusCode: 200, body: successBody });
      return res.json(successBody);
    } else {
      console.error('[Order Form Submit] Push failed:', result);
      const failBody = { success: false, extOrderId, error: result.error || 'ShopWorks submission failed', detail: result };
      // Cache failures too — a client retry after a 502 should get the same
      // result back instead of starting a fresh push (idempotent error path).
      cacheSubmitResponse(idemId, { statusCode: 502, body: failBody });
      return res.status(502).json(failBody);
    }
  } catch (err) {
    console.error('[Order Form Submit] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Monitoring API endpoints (if enabled)
if (monitor) {
  app.get('/api/monitor/stats', (req, res) => {
    res.json(monitor.getStats());
  });

  app.get('/api/monitor/report', (req, res) => {
    const report = monitor.generateReport();
    res.json(report);
  });
}

// Error reporting endpoint (if monitoring enabled)
if (monitor) {
  app.post('/api/error-report', (req, res) => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      page: req.body.page || 'unknown',
      errors: req.body.errors || [],
      userAgent: req.headers['user-agent'],
      sessionId: req.body.sessionId
    };

    // Save error report to file
    const errorReports = [];
    try {
      if (fs.existsSync('error-reports.json')) {
        const existing = fs.readFileSync('error-reports.json', 'utf-8');
        errorReports.push(...JSON.parse(existing));
      }
    } catch (e) {
      console.error('Failed to load existing error reports:', e);
    }

    errorReports.push(errorReport);

    // Keep only last 1000 reports
    if (errorReports.length > 1000) {
      errorReports.splice(0, errorReports.length - 1000);
    }

    try {
      fs.writeFileSync('error-reports.json', JSON.stringify(errorReports, null, 2));
    } catch (e) {
      console.error('Failed to save error report:', e);
    }

    res.json({ received: true });
  });
}

// Legacy cart retired 2026-06-11 (orphaned Bootstrap flow, zero inbound links) — customers use the sample cart
app.get('/cart', (req, res) => {
  res.redirect(301, '/pages/sample-cart.html');
});

// Removed duplicate route - inventory-details.html is now served from /pages/ directory (see line 307)

// Comprehensive embroidery pricing page (unified AL/CEMB + DECG page)
app.get('/calculators/embroidery-pricing-all', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'embroidery-pricing-all', 'index.html'));
});

// Serve pricing pages - serve original embroidery calculators
app.get('/pricing/embroidery', (req, res, next) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'embroidery-pricing.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/cap-embroidery', (req, res, next) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'cap-embroidery-pricing-integrated.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/dtg', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'dtg-pricing.html'));
});

app.get('/pricing/screen-print', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'screen-print-pricing.html'));
});

app.get('/pricing/dtf', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'dtf-pricing.html'));
});

// /pricing/stickers MOVED (2026-07-24) then RETIRED (2026-07-29) — it is a 410
// signpost now, and its surviving oversize-decal calculator is /pricing/decals.
// Both are registered before the /calculators static mount so the gate actually
// runs. Search for "STAFF-GATED CALCULATOR PAGES".

// Cart Sessions API
app.get('/api/cart-sessions', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart sessions' });
  }
});

app.get('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart session' });
  }
});

app.post('/api/cart-sessions', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart session' });
  }
});

app.put('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart session' });
  }
});

app.delete('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-sessions/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart session' });
  }
});

// Cart Items API
app.get('/api/cart-items', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-items');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart items' });
  }
});

app.get('/api/cart-items/session/:sessionId', requireStaff, async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const sessionId = sanitizeFilterInput(req.params.sessionId);

    // Get cart items for the session
    const itemsData = await makeApiRequest(`/cart-items?filter=SessionID='${sessionId}'`);

    // If no items, return empty array
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      return res.json([]);
    }

    // For each item, get its sizes
    const itemsWithSizes = await Promise.all(itemsData.map(async (item) => {
      try {
        // CartItemID is from our own DB, but sanitize anyway for defense in depth
        const cartItemId = sanitizeFilterInput(item.CartItemID);
        const sizesData = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${cartItemId}`);

        // Reconstruct PRODUCT_TITLE from stored fields if it doesn't exist
        if (!item.PRODUCT_TITLE) {
          console.log(`[CART_ITEMS_GET] Reconstructing PRODUCT_TITLE for item ${item.CartItemID}`);

          // Option 1: Try to get from Description field
          if (item.Description) {
            item.PRODUCT_TITLE = item.Description;
            console.log(`[CART_ITEMS_GET] Using Description field: ${item.Description}`);
          }
          // Option 2: Try to get from Notes field
          else if (item.Notes) {
            item.PRODUCT_TITLE = item.Notes;
            console.log(`[CART_ITEMS_GET] Using Notes field: ${item.Notes}`);
          }
          // Option 3: Try to extract from EmbellishmentOptions
          else if (item.EmbellishmentOptions) {
            try {
              const embOptions = typeof item.EmbellishmentOptions === 'string'
                ? JSON.parse(item.EmbellishmentOptions)
                : item.EmbellishmentOptions;

              if (embOptions.productTitle) {
                item.PRODUCT_TITLE = embOptions.productTitle;
                console.log(`[CART_ITEMS_GET] Extracted from EmbellishmentOptions: ${embOptions.productTitle}`);
              }
            } catch (jsonError) {
              console.error(`[CART_ITEMS_GET] Error parsing EmbellishmentOptions for item ${item.CartItemID}:`, jsonError);
            }
          }

          // Fallback: Generate a title from StyleNumber and Color
          if (!item.PRODUCT_TITLE && item.StyleNumber && item.Color) {
            item.PRODUCT_TITLE = `${item.StyleNumber} - ${item.Color}`;
            console.log(`[CART_ITEMS_GET] Generated fallback title: ${item.PRODUCT_TITLE}`);
          }
        }

        return {
          ...item,
          sizes: sizesData || []
        };
      } catch (error) {
        console.error(`Error fetching sizes for item ${item.CartItemID}:`, error);
        return {
          ...item,
          sizes: [],
          sizesError: 'Failed to load sizes for this item'
        };
      }
    }));

    res.json(itemsWithSizes);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({
      error: 'Failed to fetch cart items for session',
      message: error.message
    });
  }
});

app.post('/api/cart-items', requireStaff, async (req, res) => {
  try {
    // Clone the request body to avoid modifying the original
    const modifiedBody = { ...req.body };

    // Check if PRODUCT_TITLE exists in the request
    if (modifiedBody.PRODUCT_TITLE) {
      console.log('[CART_ITEMS] PRODUCT_TITLE found in request:', modifiedBody.PRODUCT_TITLE);

      // Store PRODUCT_TITLE in a field that might exist in Caspio
      // Option 1: Try to use a Description field if it exists
      modifiedBody.Description = modifiedBody.PRODUCT_TITLE;

      // Option 2: Store in Notes field if it exists
      modifiedBody.Notes = modifiedBody.PRODUCT_TITLE;

      // Option 3: Append to EmbellishmentOptions JSON if it exists
      if (modifiedBody.EmbellishmentOptions) {
        try {
          let embOptions = modifiedBody.EmbellishmentOptions;

          // If EmbellishmentOptions is a string (JSON), parse it
          if (typeof embOptions === 'string') {
            embOptions = JSON.parse(embOptions);
          }

          // Add PRODUCT_TITLE to the options
          embOptions.productTitle = modifiedBody.PRODUCT_TITLE;

          // Stringify back to JSON
          modifiedBody.EmbellishmentOptions = JSON.stringify(embOptions);
          console.log('[CART_ITEMS] Added PRODUCT_TITLE to EmbellishmentOptions');
        } catch (jsonError) {
          console.error('[CART_ITEMS] Error adding PRODUCT_TITLE to EmbellishmentOptions:', jsonError);
        }
      }
    }

    // Log the modified body being sent to the API
    console.log('[CART_ITEMS] Sending modified request body to API:', JSON.stringify(modifiedBody));

    const data = await makeApiRequest('/cart-items', 'POST', modifiedBody);

    // Store the original PRODUCT_TITLE in the response for client-side use
    if (req.body.PRODUCT_TITLE) {
      data.PRODUCT_TITLE = req.body.PRODUCT_TITLE;
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item' });
  }
});

app.put('/api/cart-items/:id', requireStaff, async (req, res) => {
  try {
    // Clone the request body to avoid modifying the original
    const modifiedBody = { ...req.body };

    // Check if PRODUCT_TITLE exists in the request
    if (modifiedBody.PRODUCT_TITLE) {
      console.log('[CART_ITEMS_UPDATE] PRODUCT_TITLE found in request:', modifiedBody.PRODUCT_TITLE);

      // Store PRODUCT_TITLE in a field that might exist in Caspio
      // Option 1: Try to use a Description field if it exists
      modifiedBody.Description = modifiedBody.PRODUCT_TITLE;

      // Option 2: Store in Notes field if it exists
      modifiedBody.Notes = modifiedBody.PRODUCT_TITLE;

      // Option 3: Append to EmbellishmentOptions JSON if it exists
      if (modifiedBody.EmbellishmentOptions) {
        try {
          let embOptions = modifiedBody.EmbellishmentOptions;

          // If EmbellishmentOptions is a string (JSON), parse it
          if (typeof embOptions === 'string') {
            embOptions = JSON.parse(embOptions);
          }

          // Add PRODUCT_TITLE to the options
          embOptions.productTitle = modifiedBody.PRODUCT_TITLE;

          // Stringify back to JSON
          modifiedBody.EmbellishmentOptions = JSON.stringify(embOptions);
          console.log('[CART_ITEMS_UPDATE] Added PRODUCT_TITLE to EmbellishmentOptions');
        } catch (jsonError) {
          console.error('[CART_ITEMS_UPDATE] Error adding PRODUCT_TITLE to EmbellishmentOptions:', jsonError);
        }
      }
    }

    // Log the modified body being sent to the API
    console.log('[CART_ITEMS_UPDATE] Sending modified request body to API:', JSON.stringify(modifiedBody));

    const data = await makeApiRequest(`/cart-items/${req.params.id}`, 'PUT', modifiedBody);

    // Store the original PRODUCT_TITLE in the response for client-side use
    if (req.body.PRODUCT_TITLE) {
      data.PRODUCT_TITLE = req.body.PRODUCT_TITLE;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

app.delete('/api/cart-items/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-items/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

// Cart Item Sizes API
app.get('/api/cart-item-sizes', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.get('/api/cart-item-sizes/cart-item/:cartItemId', requireStaff, async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const cartItemId = sanitizeFilterInput(req.params.cartItemId);
    const data = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${cartItemId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.post('/api/cart-item-sizes', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item size' });
  }
});

app.put('/api/cart-item-sizes/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-item-sizes/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart item size' });
  }
});

app.delete('/api/cart-item-sizes/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-item-sizes/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart item size' });
  }
});

// Customers API
app.get('/api/customers', async (req, res) => {
  try {
    const data = await makeApiRequest('/customers');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.get('/api/customers/email/:email', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const email = sanitizeFilterInput(req.params.email);
    const data = await makeApiRequest(`/customers?filter=Email='${email}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer by email' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const data = await makeApiRequest('/customers', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/customers/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Orders API
app.get('/api/orders', async (req, res) => {
  try {
    const data = await makeApiRequest('/orders');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/orders/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const data = await makeApiRequest('/orders', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/orders/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Style Search API
app.get('/api/stylesearch', async (req, res) => {
  try {
    const { term } = req.query;

    if (!term) {
      return res.status(400).json({ error: 'term parameter is required' });
    }

    const data = await makeApiRequest(`/stylesearch?term=${encodeURIComponent(term)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search styles' });
  }
});

// Product Colors API
app.get('/api/product-colors', async (req, res) => {
  try {
    const { styleNumber } = req.query;

    if (!styleNumber) {
      return res.status(400).json({ error: 'styleNumber parameter is required' });
    }

    const data = await makeApiRequest(`/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product colors' });
  }
});

// Sizes by Style and Color API
app.get('/api/sizes-by-style-color', async (req, res) => {
  try {
    const { styleNumber, color } = req.query;

    if (!styleNumber || !color) {
      return res.status(400).json({ error: 'styleNumber and color parameters are required' });
    }

    const data = await makeApiRequest(`/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sizes' });
  }
});

// Base Item Costs API
app.get('/api/base-item-costs', async (req, res) => {
  try {
    const { styleNumber } = req.query;

    if (!styleNumber) {
      return res.status(400).json({ error: 'styleNumber parameter is required' });
    }

    const data = await makeApiRequest(`/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch base item costs' });
  }
});

// Inventory API
app.get('/api/inventory', async (req, res) => {
  try {
    const { styleNumber, color } = req.query;

    if (!styleNumber || !color) {
      return res.status(400).json({ error: 'styleNumber and color parameters are required' });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);

    const data = await makeApiRequest(`/inventory?filter=catalog_no='${safeStyle}' AND catalog_color='${safeColor}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Pricing Matrix API
app.get('/api/pricing-matrix', async (req, res) => {
  try {
    const { styleNumber, color, embType } = req.query;

    if (!styleNumber || !color || !embType) {
      return res.status(400).json({ error: 'styleNumber, color, and embType parameters are required' });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);
    const safeEmbType = sanitizeFilterInput(embType);

    const data = await makeApiRequest(`/pricing-matrix?filter=StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing matrix data' });
  }
});

app.post('/api/pricing-matrix', async (req, res) => {
  try {
    const data = await makeApiRequest('/pricing-matrix', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pricing matrix data' });
  }
});

app.put('/api/pricing-matrix/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/pricing-matrix/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing matrix data' });
  }
});

// Pricing Matrix Lookup API - NEW ENDPOINT
app.get('/api/pricing-matrix/lookup', async (req, res) => {
  try {
    const { styleNumber, color, embellishmentType, sessionID } = req.query;

    if (!styleNumber || !color || !embellishmentType) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'styleNumber, color, and embellishmentType are required query parameters'
      });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);
    const safeEmbType = sanitizeFilterInput(embellishmentType);
    const safeSessionID = sessionID ? sanitizeFilterInput(sessionID) : null;

    // Build the filter based on required parameters
    let filter = encodeURIComponent(`StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}'`);

    // Add sessionID to filter if provided
    if (safeSessionID) {
      filter = encodeURIComponent(`StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}' AND SessionID='${safeSessionID}'`);
    }

    // Query the pricing matrix table with the filter
    // Order by CaptureDate DESC to get the most recent entry if multiple exist
    const requestUrl = `${API_BASE_URL}/pricing-matrix?filter=${filter}&sort=CaptureDate%20DESC&limit=1`;
    console.log(`[Pricing Matrix Lookup] Requesting URL: ${requestUrl}`);
    console.log(`[Pricing Matrix Lookup] Using filter: ${decodeURIComponent(filter)}`); // Decode for readability
    const data = await makeApiRequest(`/pricing-matrix?filter=${filter}&sort=CaptureDate%20DESC&limit=1`);
    console.log('[Pricing Matrix Lookup] Raw API Response Data:', JSON.stringify(data, null, 2)); // Log raw data

    // Check if any records were found
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`[Pricing Matrix Lookup] No records found for ${styleNumber}, ${color}, ${embellishmentType}`);
        return res.status(404).json({
            error: 'Pricing matrix not found',
            message: `No pricing matrix found for styleNumber=${styleNumber}, color=${color}, embellishmentType=${embellishmentType}${sessionID ? `, sessionID=${sessionID}` : ''}`
        });
    }

    // Search through all returned records for an exact match
    let matchingRecord = null;
    for (const record of data) {
        if (record.StyleNumber === styleNumber &&
            record.Color === color &&
            record.EmbellishmentType === embellishmentType) {
            matchingRecord = record;
            console.log(`[Pricing Matrix Lookup] Found exact match: ID ${record.PK_ID} for (${styleNumber}, ${color}, ${embellishmentType})`);
            break;
        }
    }

    // If no exact match was found
    if (!matchingRecord) {
        console.log('[Pricing Matrix Lookup] No exact match found in returned records');
        console.warn(`[Pricing Matrix Lookup] API returned ${data.length} records, but none matched (${styleNumber}, ${color}, ${embellishmentType})`);

        // Log the first record for debugging
        if (data.length > 0) {
            console.warn(`[Pricing Matrix Lookup] First record was: (${data[0].StyleNumber}, ${data[0].Color}, ${data[0].EmbellishmentType}) with ID ${data[0].PK_ID}`);
        }

        return res.status(404).json({
            error: 'Pricing matrix not found',
            message: `No exact pricing matrix found for styleNumber=${styleNumber}, color=${color}, embellishmentType=${embellishmentType}${sessionID ? `, sessionID=${sessionID}` : ''}`
        });
    }

    // If we reach here, matchingRecord exists and matches the request
    res.json({
        pricingMatrixId: matchingRecord.PK_ID,
        message: 'Exact pricing matrix found'
    });

  } catch (error) {
    console.error('Error in pricing matrix lookup:', error);
    res.status(500).json({
      error: 'Failed to lookup pricing matrix',
      message: error.message
    });
  }
});

// Get specific pricing matrix by ID
app.get('/api/pricing-matrix/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/pricing-matrix/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing matrix by ID' });
  }
});

// ⛔ GET /api/christmas-products — DELETED 2026-08-17. Do not re-add.
//
// It made no API call: it returned a hardcoded 7-product list, and each product
// carried `sanmar_cost` (the raw blank vendor cost) NEXT TO `basePrice`. The route
// was anonymous, so our gross margin was published to anyone who asked
// (CTJ162: basePrice 141.00 / sanmar_cost 84.60 = 40% GP). Verified zero callers
// repo-wide before deleting — the Christmas storefront never used it; it carries
// its own inline product data.
//
// The 2025 figures live in git if the October rebuild wants them:
//   git show v2026.08.17.3:server.js
// Whatever replaces it must read from Caspio and MUST NOT project cost fields to
// a customer-reachable surface (see lib/page-access.js: pricing-analysis.html is
// admin-only for exactly this reason).

// Embroidery Pricing API
app.get('/api/embroidery-pricing', async (req, res) => {
  try {
    // Return tiered embroidery pricing
    const embroideryPricing = {
      '1-23': 15.00,
      '24-47': 13.00,
      '48-71': 12.00,
      '72+': 11.00
    };

    res.json(embroideryPricing);
  } catch (error) {
    console.error('Error fetching embroidery pricing:', error);
    res.status(500).json({ error: 'Failed to fetch embroidery pricing' });
  }
});

// Size Pricing API - NEW ENDPOINT FOR DTG/EMBROIDERY
app.get('/api/size-pricing', async (req, res) => {
  try {
    const { styleNumber } = req.query;

    if (!styleNumber) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'styleNumber is required'
      });
    }

    // Try to get size pricing data from inventory or create fallback
    console.log(`[SIZE-PRICING] Fetching size pricing for: ${styleNumber}`);

    // Generate fallback size pricing data for now
    const fallbackSizePricing = {
      styleNumber: styleNumber,
      sizes: [
        { size: 'S', available: true, upcharge: 0 },
        { size: 'M', available: true, upcharge: 0 },
        { size: 'L', available: true, upcharge: 0 },
        { size: 'XL', available: true, upcharge: 0 },
        { size: '2XL', available: true, upcharge: 2.00 },
        { size: '3XL', available: true, upcharge: 4.00 },
        { size: '4XL', available: true, upcharge: 6.00 },
        { size: '5XL', available: true, upcharge: 8.00 }
      ],
      addOns: [
        { name: 'Rush Service', price: 25.00, available: true },
        { name: 'Design Service', price: 50.00, available: true },
        { name: 'Color Matching', price: 15.00, available: true }
      ],
      commonData: {
        ltmThreshold: 24,
        ltmFee: 50.00,
        tiers: ['24-47', '48-71', '72+']
      }
    };

    res.json(fallbackSizePricing);

  } catch (error) {
    console.error('Error in size pricing endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch size pricing',
      message: error.message
    });
  }
});

// NEW: Image Proxy Endpoint
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send('Missing image URL parameter');
  }

  try {
    // Basic validation to prevent fetching non-http URLs (could be enhanced)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return res.status(400).send('Invalid image URL protocol');
    }

    console.log(`[Image Proxy] Fetching: ${imageUrl}`);
    const externalResponse = await fetch(imageUrl);

    if (!externalResponse.ok) {
      console.error(`[Image Proxy] Failed to fetch ${imageUrl}: Status ${externalResponse.status}`);
      // Forward the status code if it's an error code, otherwise use 500
      const statusCode = externalResponse.status >= 400 ? externalResponse.status : 500;
      return res.status(statusCode).send(`Failed to fetch image: ${externalResponse.statusText}`);
    }

    const contentType = externalResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
      console.log(`[Image Proxy] Proxying ${imageUrl} with Content-Type: ${contentType}`);
    } else {
      console.warn(`[Image Proxy] Content-Type header missing for ${imageUrl}. Sending without Content-Type.`);
    }

    // Pipe the image data directly to the client response
    externalResponse.body.pipe(res);

  } catch (error) {
    console.error(`[Image Proxy] Error fetching ${imageUrl}:`, error);
    res.status(500).send('Error fetching image');
  }
});
// Serve cart-integration.js for Caspio DataPages
app.get('/api/cart-integration.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin access
  res.sendFile(path.join(SERVER_DIR, 'cart-integration.js'));
});

};
