#!/usr/bin/env node
/**
 * Order-Form Pricing Parity Capture — Phase 0 (2026-06-09)
 *
 * THE SAFETY NET for the order-form redesign. Erik's one hard rule: the order
 * form must price IDENTICALLY to the quote pages.
 *
 * Design (staleness-proof): for each scenario this loads the ORDER FORM page —
 * which already loads every {method}-pricing-service.js the quote builders use —
 * and computes BOTH prices on the same page at the same moment:
 *   (a) the LIVE quote-page price, via the exact PAGE_RUNNERS the builder
 *       baseline capture uses (scripts/capture-pricing-baselines.js), and
 *   (b) the ORDER FORM price, via window.OrderFormPricing.priceForm().
 * Then it diffs (a) vs (b). Because both read the SAME live Caspio data, a
 * legitimate Caspio price change can never cause a false "drift" — only a real
 * order-form ↔ quote-page divergence fails. (Contrast: diffing against the
 * months-old baselines.locked.json gives false positives whenever Caspio pricing
 * changes — which is exactly what bit the first version of this harness on DTG.)
 *
 * The order form drives each method via formCtx.decoConfig (the legacy/non-rail
 * path) — identical priceRow() math to the drag-rail, no virtual-card timing.
 *
 * Usage:
 *   npm start                                   # dev server on :3000
 *   node scripts/capture-order-form-baselines.js
 *   node scripts/capture-order-form-baselines.js --start-server   # CI spawns its own
 *
 * Exit codes: 0 = every covered scenario matches the live quote page.
 *             1 = at least one parity FAIL (real money divergence) or load error.
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { SCENARIOS, PAGE_RUNNERS } = require('./capture-pricing-baselines');

const ROOT = path.join(__dirname, '..');
const ORDER_FORM_PATH = '/pages/order-form.html';
const MONEY_TOL = 0.01; // ±1¢ float tolerance, same as the builder baseline gate
const BUILDERS_COVERED = new Set(['SCP', 'DTG', 'DTF', 'EMB']);

// EMB scenarios the order form supports today = standard flat garment, one primary
// logo (it wraps EmbroideryPricingService). AL / Full-Back-DECG / structured-cap /
// beanie use pricing models the order form deliberately punts to the quote builder
// (embroidery.jsx classifyStitchTier: ">25K → Use Quote Builder for DECG-FB"). Skip
// those with a reason — they're coverage gaps to close in the redesign, not failures.
const EMB_SKIP = {
  'EMB-03': 'order form has no Additional-Logo (AL) path — prices primary only',
  'EMB-04': 'order form has no Full-Back DECG path (uses standard base, not calculateDECGPrice)',
  'EMB-05': 'structured-cap DECG pricing not yet mapped in the order form',
  'EMB-06': 'beanie/flat-headwear DECG pricing not yet mapped in the order form',
};

// ──────────────────────────────────────────────────────────────────────────
// Input mapping — builder scenario inputs → order-form priceForm() args.
// Uses the decoConfig fallback path (no addOns) so the test never depends on
// the drag-rail / virtual-card wiring; priceRow() math is byte-identical.
// ──────────────────────────────────────────────────────────────────────────

function buildOrderFormInputs(scenario) {
  const inp = scenario.inputs;
  const totalQty = Object.values(inp.sizes || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const baseCtx = { totalQty, info: {}, ship: {} };
  const rowBase = { id: 'r1', style: inp.style, color: inp.color, colorName: inp.color, sizes: inp.sizes };

  switch (scenario.builder) {
    case 'SCP': {
      const back = Array.isArray(inp.additionalLocations) && inp.additionalLocations.length
        ? Number(inp.additionalLocations[0]) || 0 : 0;
      return {
        rows: [rowBase],
        formCtx: {
          ...baseCtx, deco: 'screenprint',
          decoConfig: {
            frontColors: Number(inp.primaryColors) || 0,
            backColors: back,
            sleeveColors: 0,
            whiteUnderbase: !!inp.whiteUnderbase, // false for locked scenarios; true for adversarial
          },
        },
        addOns: [],
      };
    }
    case 'DTG':
      return {
        rows: [rowBase],
        formCtx: { ...baseCtx, deco: 'dtg', decoConfig: { locationCombo: inp.location } },
        addOns: [],
      };
    case 'DTF': {
      // capture locations [{code:'LC'|'FB'|'LS', size:'small'|'medium'|'large'}]
      // → order-form decoConfig {front,back,sleeve: size}. Same slot order
      // (front→back→sleeve) so calculatePriceForQuantity gets identical sizeKeys.
      const slotFor = { LC: 'front', FB: 'back', LS: 'sleeve' };
      const decoConfig = { front: 'none', back: 'none', sleeve: 'none' };
      (inp.locations || []).forEach(l => { const slot = slotFor[l.code]; if (slot) decoConfig[slot] = l.size; });
      return { rows: [rowBase], formCtx: { ...baseCtx, deco: 'dtf', decoConfig }, addOns: [] };
    }
    case 'EMB': {
      // Standard flat garment, one primary logo. Stitch + position go on the
      // row's rowDecoConfig (priceRow reads it via the formCtx fallback chain).
      // capOrFlat is set explicitly to match the category the builder runner
      // priced (the runner picks its path from isCap/isFlatHeadwear flags), so
      // detection metadata we don't have (row.desc) can't skew the comparison.
      const stitch = Number(inp.stitches) || 8000;
      const loc = inp.location || (inp.locations && inp.locations[0] && inp.locations[0].name) || 'Left Chest';
      const capOrFlat = inp.isCap ? 'cap' : 'flat';
      return {
        rows: [{ ...rowBase, rowDecoConfig: { primaryStitchCount: stitch, primaryPosition: loc, capOrFlat } }],
        formCtx: { ...baseCtx, deco: 'embroidery', decoConfig: { stitchCount: stitch, primaryLocation: loc } },
        addOns: [],
      };
    }
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Scenario list: covered builder scenarios + synthetic ADVERSARIAL cases.
// ──────────────────────────────────────────────────────────────────────────

function buildScenarioList() {
  const list = [];
  for (const [id, sc] of Object.entries(SCENARIOS)) {
    if (!BUILDERS_COVERED.has(sc.builder)) continue;
    const skipReason = sc.builder === 'EMB' ? (EMB_SKIP[id] || null) : null;
    list.push({ id, ...sc, skipReason });
  }
  // ADVERSARIAL: SCP dark-garment white underbase. The live SCP builder prices
  // the per-piece on RAW front colors and charges underbase only as a setup
  // screen (screenprint-quote-builder.js:109-122 vs :3093). So adding underbase
  // must NOT change the per-piece. The builder runner (runSCP) ignores underbase
  // entirely, so its price IS the correct raw-1c reference; the order-form input
  // flips whiteUnderbase on. Order form must match → it won't today (the bug).
  const scp01 = SCENARIOS['SCP-01'];
  if (scp01) {
    list.push({
      id: 'SCP-ADV-UB',
      builder: 'SCP',
      description: 'ADVERSARIAL: 1c front + white underbase — per-piece must equal raw-1c',
      inputs: { ...scp01.inputs, whiteUnderbase: true },
      adversarial: true,
    });
  }
  return list;
}

// ──────────────────────────────────────────────────────────────────────────
// Diff: LIVE quote-page result (builderExpected) vs order-form result.
// The quote page reports per-piece WITHOUT LTM (LTM is a separate fee). The
// order form BAKES LTM into per-piece — so strip the order form's own
// extras.ltmPerPiece before comparing the garment+print base price.
// ──────────────────────────────────────────────────────────────────────────

function diff(expected, captured, totalQty) {
  const diffs = [];
  if (!expected) return [{ field: '_builderError', expected: 'priced', actual: 'builder runner failed' }];
  if (captured.error) return [{ field: '_orderFormError', expected: 'priced', actual: captured.error }];

  const ltmPP = Number(captured.ltmPerPiece) || 0;

  const sizes = new Set([
    ...Object.keys(expected.perSizeBreakdown || {}),
    ...Object.keys(captured.unitPriceBySize || {}),
  ]);
  for (const sz of sizes) {
    const e = Number(expected.perSizeBreakdown?.[sz]?.perPiece);
    const aRaw = Number(captured.unitPriceBySize?.[sz]);
    const a = +(aRaw - ltmPP).toFixed(4); // strip baked LTM
    if (!Number.isFinite(e) || !Number.isFinite(a) || Math.abs(e - a) > MONEY_TOL) {
      diffs.push({ field: `perPiece.${sz}`, expected: e, actual: a, delta: +(a - e).toFixed(2) });
    }
  }

  // LTM total parity — order form's distributed LTM (ltmPP × qty) ≈ quote page's
  // separate ltmFee, within floor-distribution noise (DTG floors per-piece →
  // up to qty×$0.01 under the nominal fee).
  const expLtm = Number(expected.ltmFee) || 0;
  const ordLtm = ltmPP * totalQty;
  const ltmTol = Math.max(MONEY_TOL, totalQty * 0.01 + 0.01);
  if (Math.abs(expLtm - ordLtm) > ltmTol) {
    diffs.push({ field: 'ltmTotal', expected: expLtm, actual: +ordLtm.toFixed(2), delta: +(ordLtm - expLtm).toFixed(2) });
  }
  return diffs;
}

// ──────────────────────────────────────────────────────────────────────────
// Server readiness (reused pattern from capture-pricing-baselines.js)
// ──────────────────────────────────────────────────────────────────────────

async function waitForServerReady(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, res => {
          res.resume();
          if (res.statusCode === 200 || res.statusCode === 304) resolve();
          else reject(new Error('status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(new Error('timeout')));
      });
      return true;
    } catch (e) { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('Server not ready at ' + url + ' within ' + timeoutMs + 'ms');
}

function spawnServer() {
  console.log('[of-parity] Spawning server.js …');
  const proc = spawn('node', ['server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: '3000', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', d => process.stdout.write('[server] ' + d));
  proc.stderr.on('data', d => process.stderr.write('[server-err] ' + d));
  return proc;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function run({ startServer = false, headless = true, baseUrl = 'http://localhost:3000' } = {}) {
  const scenarios = buildScenarioList();

  let serverProc = null;
  if (startServer) {
    serverProc = spawnServer();
    await waitForServerReady(baseUrl + ORDER_FORM_PATH);
  } else {
    try { await waitForServerReady(baseUrl + ORDER_FORM_PATH, 5000); }
    catch (e) { console.error('[of-parity] ❌ No server at ' + baseUrl + '. Run `npm start` or pass --start-server.'); process.exit(1); }
  }

  const browser = await puppeteer.launch({ headless, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[order-form] pageerror:', e.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log('[order-form:error]', msg.text()); });

  console.log('[of-parity] Loading ' + baseUrl + ORDER_FORM_PATH + ' (in-browser Babel compile — give it a moment) …');
  await page.goto(baseUrl + ORDER_FORM_PATH, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => window.OrderFormPricing && window.OrderFormPricingShared
      && window.OrderFormPricing.hasMethod('screenprint') && window.OrderFormPricing.hasMethod('dtg')
      && window.ScreenPrintPricingService && window.DTGPricingService,
    { timeout: 45000, polling: 250 },
  );
  await new Promise(r => setTimeout(r, 800));

  const results = [];
  for (const scenario of scenarios) {
    if (scenario.skipReason) { results.push({ scenario, skipped: true, skipReason: scenario.skipReason }); continue; }
    const inputs = buildOrderFormInputs(scenario);
    if (!inputs) { results.push({ scenario, skipped: true, skipReason: 'mapper TODO' }); continue; }
    const totalQty = Object.values(scenario.inputs.sizes || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const runnerSrc = PAGE_RUNNERS[scenario.builder].toString();

    let res;
    try {
      res = await page.evaluate(async (runnerSource, builderScenario, ofInputs) => {
        const r = { builder: null, orderForm: null, builderError: null };
        // (a) LIVE quote-page price via the builder's own runner
        try {
          // eslint-disable-next-line no-eval
          const runnerFn = eval('(' + runnerSource + ')');
          r.builder = await runnerFn(builderScenario);
        } catch (e) { r.builderError = String((e && e.message) || e); }
        // (b) order-form price
        try {
          window.OrderFormPricing.clearBundleCache && window.OrderFormPricing.clearBundleCache();
          const bd = await window.OrderFormPricing.priceForm(ofInputs);
          const rb = bd.byRow && (bd.byRow.get ? bd.byRow.get('r1') : bd.byRow['r1']);
          if (!rb) r.orderForm = { error: 'no byRow[r1]; errors ' + JSON.stringify(bd.errors || []) };
          else if (rb.error) r.orderForm = { error: rb.error };
          else r.orderForm = {
            tier: rb.tier, unitPriceBySize: rb.unitPriceBySize || {},
            rowSubtotal: rb.rowSubtotal, ltmPerPiece: (rb.extras && Number(rb.extras.ltmPerPiece)) || 0,
          };
        } catch (e) { r.orderForm = { error: 'priceForm threw: ' + String((e && e.message) || e) }; }
        return r;
      }, runnerSrc, scenario, inputs);
    } catch (e) {
      res = { builderError: 'evaluate failed: ' + e.message, orderForm: { error: 'evaluate failed' } };
    }

    const diffs = res.builderError
      ? [{ field: '_builderError', expected: 'priced', actual: res.builderError }]
      : diff(res.builder, res.orderForm || { error: 'no result' }, totalQty);
    results.push({ scenario, builder: res.builder, captured: res.orderForm, diffs });
  }

  await browser.close();
  if (serverProc) serverProc.kill('SIGTERM');

  console.log('\n══════════ ORDER-FORM ↔ LIVE QUOTE-PAGE PARITY ══════════');
  let failCount = 0, advCaught = 0;
  for (const r of results) {
    const { scenario, builder, captured, diffs, skipped, skipReason } = r;
    if (skipped) { console.log(`  ⏭  ${scenario.id}  SKIP — ${skipReason}`); continue; }
    const tag = scenario.adversarial ? ' [ADVERSARIAL]' : '';
    if (!diffs.length) {
      console.log(`  ✅ ${scenario.id}${tag}  order-form line=$${Number(captured.rowSubtotal).toFixed(2)} == quote page`);
    } else {
      failCount++;
      if (scenario.adversarial) advCaught++;
      console.log(`  ❌ ${scenario.id}${tag}  ${scenario.description}`);
      for (const d of diffs) {
        console.log(`       ${d.field}: quote-page ${d.expected} → order-form ${d.actual}` +
          (d.delta != null ? `  (Δ ${d.delta > 0 ? '+' : ''}${d.delta})` : ''));
      }
    }
  }
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Covered: ${results.filter(r => !r.skipped).length}  ·  Real mismatches: ${failCount}  ·  Adversarial bugs reproduced: ${advCaught}`);
  console.log('(Covered: SCP 5 · DTG 5 · DTF 5 · EMB-standard 3 + underbase adversarial. Pending: EMB AL/Full-Back/cap/beanie paths, SCP setup-fee/underbase screen, DTG S-not-min adversarial.)\n');

  return { failCount, results };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  run({ startServer: args.includes('--start-server'), headless: !args.includes('--headed') })
    .then(({ failCount }) => process.exit(failCount > 0 ? 1 : 0))
    .catch(err => { console.error('[of-parity] FATAL', err); process.exit(1); });
}

module.exports = { run, buildOrderFormInputs, buildScenarioList, diff };
