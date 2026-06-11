#!/usr/bin/env node
/**
 * Pricing Baseline Capture — Phase 0b
 *
 * Runs the live pricing engines for all 22 baseline scenarios and writes the
 * results to tests/pricing-baselines/baselines.captured.json. Used by:
 *   - Devs: `npm run capture:pricing` (uses your running dev server on :3000)
 *   - CI:   `npm run test:pricing-baselines` (starts its own server, captures, diffs vs locked)
 *
 * Why it exists: locks down current pricing math so any future refactor that
 * accidentally drifts a price by even $0.50 fails CI with a clear diff.
 *
 * Architecture:
 *   1. Spawn or reuse a server on http://localhost:3000
 *   2. Launch Puppeteer headless
 *   3. For each builder, navigate to its quote-builder page, wait for pricing
 *      services to be available on window, then evaluate the scenario.
 *   4. Capture per-piece + line-subtotal + LTM + grand-total + per-size breakdown
 *   5. Write everything to baselines.captured.json
 *
 * Exit codes:
 *   0 = all scenarios captured successfully
 *   1 = capture failed (browser, server, network, or service error)
 *   2 = bad CLI args
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'tests', 'pricing-baselines', 'baselines.captured.json');

// ──────────────────────────────────────────────────────────────────────────
// SCENARIO DEFINITIONS — single source of truth
// ──────────────────────────────────────────────────────────────────────────
// Each scenario specifies a builder, inputs, and is run by the corresponding
// runner function below. The runner returns the captured result, which gets
// merged into the output JSON keyed by scenario ID.

const SCENARIOS = {
  // ── DTG (5 scenarios) ─────────────────────────────────────────────────
  'DTG-01': {
    builder: 'DTG', description: 'Small order LC only',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 12, location: 'LC',
              sizes: { M: 4, L: 4, XL: 4 } }
  },
  'DTG-02': {
    builder: 'DTG', description: 'LTM threshold (24 = no fee)',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 24, location: 'LC',
              sizes: { M: 8, L: 8, XL: 8 } }
  },
  'DTG-03': {
    builder: 'DTG', description: 'Multi-location (LC + FB)',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 48, location: 'LC_FB',
              sizes: { M: 12, L: 16, XL: 20 } }
  },
  'DTG-04': {
    builder: 'DTG', description: 'Hoodie larger order',
    inputs: { style: 'F260', color: 'Charcoal Heather', qty: 72, location: 'LC',
              sizes: { M: 24, L: 24, XL: 24 } }
  },
  'DTG-05': {
    builder: 'DTG', description: 'Extended size mix (upcharges)',
    inputs: { style: 'PC54', color: 'Black', qty: 12, location: 'LC',
              sizes: { M: 1, L: 1, XL: 1, '2XL': 3, '3XL': 3, '4XL': 3 } }
  },

  // ── EMB (7 scenarios) ─────────────────────────────────────────────────
  'EMB-01': {
    builder: 'EMB', description: 'Small standard garment 8K LC',
    inputs: { style: 'PC54', color: 'Navy', qty: 24, location: 'Left Chest',
              stitches: 8000, sizes: { M: 8, L: 8, XL: 8 } }
  },
  'EMB-02': {
    builder: 'EMB', description: 'LTM edge (qty<=7)',
    inputs: { style: 'PC54', color: 'Black', qty: 7, location: 'Left Chest',
              stitches: 8000, sizes: { M: 3, L: 2, XL: 2 } }
  },
  'EMB-03': {
    builder: 'EMB', description: 'Primary 8K LC + AL 5K right sleeve',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 48,
              locations: [{ name: 'Left Chest', stitches: 8000 },
                          { name: 'Right Sleeve', stitches: 5000, isAL: true }],
              sizes: { M: 16, L: 16, XL: 16 } }
  },
  'EMB-04': {
    builder: 'EMB', description: 'Full Back 15K (DECG path)',
    inputs: { style: 'PC54', color: 'Black', qty: 24, location: 'Full Back',
              stitches: 15000, sizes: { M: 8, L: 8, XL: 8 } }
  },
  'EMB-05': {
    builder: 'EMB', description: 'Cap C112 8K front',
    inputs: { style: 'C112', color: 'Navy', qty: 24, location: 'Cap Front',
              stitches: 8000, sizes: { OSFA: 24 }, isCap: true }
  },
  'EMB-06': {
    builder: 'EMB', description: 'Beanie CP90 5K (flat headwear)',
    inputs: { style: 'CP90', color: 'Black', qty: 24, location: 'Beanie Front',
              stitches: 5000, sizes: { OSFA: 24 }, isFlatHeadwear: true }
  },
  'EMB-07': {
    builder: 'EMB', description: 'Extended sizes 2XL/3XL upcharge',
    inputs: { style: 'PC54', color: 'Black', qty: 24, location: 'Left Chest',
              stitches: 8000, sizes: { M: 8, XL: 8, '2XL': 4, '3XL': 4 } }
  },

  // ── DTF (5 scenarios) ─────────────────────────────────────────────────
  'DTF-01': {
    builder: 'DTF', description: 'Small qty 1 location (LTM tier 10-23)',
    inputs: { style: 'PC54', color: 'Navy', qty: 10,
              locations: [{ code: 'LC', size: 'small' }],
              sizes: { M: 4, L: 3, XL: 3 } }
  },
  'DTF-02': {
    builder: 'DTF', description: 'LTM edge same color black',
    inputs: { style: 'PC54', color: 'Black', qty: 10,
              locations: [{ code: 'LC', size: 'small' }],
              sizes: { M: 4, L: 3, XL: 3 } }
  },
  'DTF-03': {
    builder: 'DTF', description: 'Two locations (LC small + FB large)',
    inputs: { style: 'PC54', color: 'Black', qty: 24,
              locations: [{ code: 'LC', size: 'small' },
                          { code: 'FB', size: 'large' }],
              sizes: { M: 8, L: 8, XL: 8 } }
  },
  'DTF-04': {
    builder: 'DTF', description: 'Three locations max (LC + FB + LS)',
    inputs: { style: 'PC54', color: 'White', qty: 48,
              locations: [{ code: 'LC', size: 'small' },
                          { code: 'FB', size: 'large' },
                          { code: 'LS', size: 'small' }],
              sizes: { M: 16, L: 16, XL: 16 } }
  },
  'DTF-05': {
    builder: 'DTF', description: 'Large size combo (LC small + FB medium)',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 24,
              locations: [{ code: 'LC', size: 'small' },
                          { code: 'FB', size: 'medium' }],
              sizes: { M: 8, L: 8, XL: 8 } }
  },

  // ── SCP (5 scenarios) ─────────────────────────────────────────────────
  'SCP-01': {
    builder: 'SCP', description: 'Simplest — 1 color 1 location',
    inputs: { style: 'PC54', color: 'Black', qty: 24, primaryColors: 1,
              additionalLocations: [], sizes: { M: 8, L: 8, XL: 8 } }
  },
  'SCP-02': {
    builder: 'SCP', description: 'Multi-color (4) 1 location',
    inputs: { style: 'PC54', color: 'Navy', qty: 48, primaryColors: 4,
              additionalLocations: [], sizes: { M: 16, L: 16, XL: 16 } }
  },
  'SCP-03': {
    builder: 'SCP', description: '1c LC + 1c FB',
    inputs: { style: 'PC54', color: 'Athletic Heather', qty: 24, primaryColors: 1,
              additionalLocations: [1], sizes: { M: 8, L: 8, XL: 8 } }
  },
  'SCP-04': {
    builder: 'SCP', description: 'Max colors (6) 1 location',
    inputs: { style: 'PC54', color: 'Black', qty: 48, primaryColors: 6,
              additionalLocations: [], sizes: { M: 16, L: 16, XL: 16 } }
  },
  'SCP-05': {
    builder: 'SCP', description: 'Tier break edge — qty 73',
    inputs: { style: 'PC54', color: 'White', qty: 73, primaryColors: 2,
              additionalLocations: [], sizes: { M: 25, L: 24, XL: 24 } }
  }
};

// Per-builder URL paths (preview server)
const BUILDER_URLS = {
  DTG: '/quote-builders/dtg-quote-builder.html',
  EMB: '/quote-builders/embroidery-quote-builder.html',
  DTF: '/quote-builders/dtf-quote-builder.html',
  SCP: '/quote-builders/screenprint-quote-builder.html'
};

// ──────────────────────────────────────────────────────────────────────────
// PER-BUILDER RUNNERS — evaluated inside the page context (window scope)
// ──────────────────────────────────────────────────────────────────────────
// These functions are serialized + injected. They MUST be self-contained:
// no closures, no require, just `window` access.

const PAGE_RUNNERS = {
  // SCP: uses ScreenPrintPricingService
  SCP: async function runSCP(scenario) {
    const service = new window.ScreenPrintPricingService();
    const data = await service.fetchPricingData(scenario.inputs.style, { forceRefresh: true });
    const screenSetupFee = data.screenSetupFeePerScreen || 0;
    const qty = scenario.inputs.qty;
    const sizes = scenario.inputs.sizes;
    const primaryColors = scenario.inputs.primaryColors;
    const additionalLocations = scenario.inputs.additionalLocations || [];

    const getTierEntry = (locPricing, colorCount, q) => {
      const arr = (locPricing && locPricing[String(colorCount)] && locPricing[String(colorCount)].tiers) || [];
      return arr.find(t => q >= t.minQty && q <= (t.maxQty || Infinity));
    };

    const primaryTier = getTierEntry(data.primaryLocationPricing, primaryColors, qty);
    if (!primaryTier) throw new Error('No primary tier found for qty=' + qty + ' colors=' + primaryColors);

    const additionalPerPiece = additionalLocations.reduce((sum, addColors) => {
      const t = getTierEntry(data.additionalLocationPricing, addColors, qty);
      return sum + (t ? (t.pricePerPiece || 0) : 0);
    }, 0);

    const perSizeBreakdown = {};
    let lineSubtotal = 0;
    for (const size of Object.keys(sizes)) {
      const q = sizes[size];
      const basePrimary = primaryTier.prices && primaryTier.prices[size];
      if (basePrimary == null) throw new Error('No size price for ' + size);
      const perPiece = +(basePrimary + additionalPerPiece).toFixed(2);
      const sizeTotal = +(perPiece * q).toFixed(2);
      perSizeBreakdown[size] = { qty: q, perPiece: perPiece, sizeTotal: sizeTotal };
      lineSubtotal += sizeTotal;
    }
    lineSubtotal = +lineSubtotal.toFixed(2);
    const ltmFee = primaryTier.ltmFee || 0;
    const totalColors = primaryColors + additionalLocations.reduce((a, b) => a + b, 0);
    const setupFee = totalColors * screenSetupFee;
    const tierLabel = primaryTier.minQty + '-' + primaryTier.maxQty;

    return {
      tier: tierLabel,
      ltmFee: ltmFee,
      screenSetupFee: setupFee,
      totalColors: totalColors,
      perSizeBreakdown: perSizeBreakdown,
      lineSubtotal: lineSubtotal,
      grandTotalBeforeTax: +(lineSubtotal + ltmFee + setupFee).toFixed(2)
    };
  },

  // DTG: uses DTGPricingService.calculateAllLocationPrices(bundle, qty)
  // Returns: result[locationCode][size][tierLabel] = perPiece
  // LTM is order-level, from bundle.tiers[].LTM_Fee
  DTG: async function runDTG(scenario) {
    const service = new window.DTGPricingService();
    const bundle = await service.fetchPricingData(scenario.inputs.style);
    const qty = scenario.inputs.qty;
    const location = scenario.inputs.location;
    const sizes = scenario.inputs.sizes;

    const grid = service.calculateAllLocationPrices(bundle, qty);
    const locGrid = grid[location];
    if (!locGrid) throw new Error('No price grid for location ' + location);

    // Find tier for qty
    const tier = (bundle.tiers || []).find(t => qty >= t.MinQuantity && qty <= t.MaxQuantity);
    if (!tier) throw new Error('No tier found for qty ' + qty);
    const tierLabel = tier.TierLabel;
    const ltmFee = tier.LTM_Fee || 0;

    const perSizeBreakdown = {};
    let lineSubtotal = 0;
    for (const size of Object.keys(sizes)) {
      const q = sizes[size];
      const perPiece = locGrid[size] && locGrid[size][tierLabel];
      if (perPiece == null) throw new Error('No price for size ' + size + ' at tier ' + tierLabel);
      const sizeTotal = +(perPiece * q).toFixed(2);
      perSizeBreakdown[size] = { qty: q, perPiece: perPiece, sizeTotal: sizeTotal };
      lineSubtotal += sizeTotal;
    }
    lineSubtotal = +lineSubtotal.toFixed(2);

    return {
      tier: tierLabel,
      ltmFee: ltmFee,
      perSizeBreakdown: perSizeBreakdown,
      lineSubtotal: lineSubtotal,
      grandTotalBeforeTax: +(lineSubtotal + ltmFee).toFixed(2)
    };
  },

  // EMB: routes per scenario type:
  //   - Standard LC garment (8K stitches) → fetchPricingData → data.prices[size][tier]
  //   - Full Back → calculateDECGPrice(qty, stitchCount, 'garment')
  //   - Cap → calculateDECGPrice(qty, stitchCount, 'cap') with cap style
  //   - Flat headwear (beanie) → routed to garment (shirt) path via product category
  //   - Additional Logo → calculateALPrice() summed with primary
  EMB: async function runEMB(scenario) {
    const inputs = scenario.inputs;
    const service = new window.EmbroideryPricingService();
    const qty = inputs.qty;
    const sizes = inputs.sizes;

    // ── EMB-04: Full Back DECG path ───────────────────────────────
    if (inputs.location === 'Full Back') {
      const decg = await service.calculateDECGPrice(qty, inputs.stitches || 8000, 'garment');
      const perSizeBreakdown = {};
      let lineSubtotal = 0;
      for (const size of Object.keys(sizes)) {
        const q = sizes[size];
        const sizeTotal = +(decg.unitPrice * q).toFixed(2);
        perSizeBreakdown[size] = { qty: q, perPiece: decg.unitPrice, sizeTotal: sizeTotal };
        lineSubtotal += sizeTotal;
      }
      lineSubtotal = +lineSubtotal.toFixed(2);
      return {
        tier: decg.tier,
        ltmFee: decg.ltmFee,
        stitchCount: decg.stitchCount,
        perSizeBreakdown: perSizeBreakdown,
        lineSubtotal: lineSubtotal,
        grandTotalBeforeTax: +(lineSubtotal + decg.ltmFee).toFixed(2),
        _path: 'DECG-garment'
      };
    }

    // ── EMB-05: Cap embroidery ────────────────────────────────────
    if (inputs.isCap) {
      const decg = await service.calculateDECGPrice(qty, inputs.stitches || 8000, 'cap');
      const perSizeBreakdown = {};
      let lineSubtotal = 0;
      for (const size of Object.keys(sizes)) {
        const q = sizes[size];
        const sizeTotal = +(decg.unitPrice * q).toFixed(2);
        perSizeBreakdown[size] = { qty: q, perPiece: decg.unitPrice, sizeTotal: sizeTotal };
        lineSubtotal += sizeTotal;
      }
      lineSubtotal = +lineSubtotal.toFixed(2);
      return {
        tier: decg.tier,
        ltmFee: decg.ltmFee,
        stitchCount: decg.stitchCount,
        perSizeBreakdown: perSizeBreakdown,
        lineSubtotal: lineSubtotal,
        grandTotalBeforeTax: +(lineSubtotal + decg.ltmFee).toFixed(2),
        _path: 'DECG-cap'
      };
    }

    // ── EMB-06: Flat headwear (beanie) — routes to garment path ───
    // Beanies use shirt-style pricing despite being headwear
    if (inputs.isFlatHeadwear) {
      const decg = await service.calculateDECGPrice(qty, inputs.stitches || 8000, 'garment');
      const perSizeBreakdown = {};
      let lineSubtotal = 0;
      for (const size of Object.keys(sizes)) {
        const q = sizes[size];
        const sizeTotal = +(decg.unitPrice * q).toFixed(2);
        perSizeBreakdown[size] = { qty: q, perPiece: decg.unitPrice, sizeTotal: sizeTotal };
        lineSubtotal += sizeTotal;
      }
      lineSubtotal = +lineSubtotal.toFixed(2);
      return {
        tier: decg.tier,
        ltmFee: decg.ltmFee,
        stitchCount: decg.stitchCount,
        perSizeBreakdown: perSizeBreakdown,
        lineSubtotal: lineSubtotal,
        grandTotalBeforeTax: +(lineSubtotal + decg.ltmFee).toFixed(2),
        _path: 'DECG-flat-headwear'
      };
    }

    // ── EMB-03: Primary + Additional Logo ─────────────────────────
    if (inputs.locations && inputs.locations.some(l => l.isAL)) {
      const primaryLoc = inputs.locations.find(l => !l.isAL);
      const alLoc = inputs.locations.find(l => l.isAL);

      // Primary uses standard fetchPricingData path (8K LC)
      const data = await service.fetchPricingData(inputs.style);
      const tier = Object.values(data.tierData || {}).find(t => qty >= t.MinQuantity && qty <= t.MaxQuantity);
      if (!tier) throw new Error('No tier for qty ' + qty);
      const primaryTier = tier.TierLabel;

      // AL price for the additional logo
      const al = await service.calculateALPrice(qty, alLoc.stitches);
      const alPerPiece = al.unitPrice || al.pricePerPiece || al;

      const perSizeBreakdown = {};
      let lineSubtotal = 0;
      for (const size of Object.keys(sizes)) {
        const q = sizes[size];
        const primaryPerPiece = data.prices?.[size]?.[primaryTier];
        if (primaryPerPiece == null) throw new Error('No primary price for size ' + size);
        const combinedPerPiece = +(primaryPerPiece + (typeof alPerPiece === 'number' ? alPerPiece : 0)).toFixed(2);
        const sizeTotal = +(combinedPerPiece * q).toFixed(2);
        perSizeBreakdown[size] = { qty: q, perPiece: combinedPerPiece, sizeTotal: sizeTotal };
        lineSubtotal += sizeTotal;
      }
      lineSubtotal = +lineSubtotal.toFixed(2);
      return {
        tier: primaryTier,
        ltmFee: tier.LTM_Fee || 0,
        primaryPerPiece: data.prices?.M?.[primaryTier],
        alPerPiece: typeof alPerPiece === 'number' ? alPerPiece : null,
        perSizeBreakdown: perSizeBreakdown,
        lineSubtotal: lineSubtotal,
        grandTotalBeforeTax: +(lineSubtotal + (tier.LTM_Fee || 0)).toFixed(2),
        _path: 'PRIMARY+AL'
      };
    }

    // ── Default: standard LC 8K garment path ──────────────────────
    const data = await service.fetchPricingData(inputs.style);
    const tier = data.tierData ? Object.values(data.tierData).find(t => qty >= t.MinQuantity && qty <= t.MaxQuantity) : null;
    if (!tier) throw new Error('No tier found for qty ' + qty);
    const tierLabel = tier.TierLabel;
    const ltmFee = tier.LTM_Fee || 0;

    const perSizeBreakdown = {};
    let lineSubtotal = 0;
    for (const size of Object.keys(sizes)) {
      const q = sizes[size];
      const perPiece = data.prices && data.prices[size] && data.prices[size][tierLabel];
      if (perPiece == null) throw new Error('No price for size ' + size + ' at tier ' + tierLabel);
      const sizeTotal = +(perPiece * q).toFixed(2);
      perSizeBreakdown[size] = { qty: q, perPiece: perPiece, sizeTotal: sizeTotal };
      lineSubtotal += sizeTotal;
    }
    lineSubtotal = +lineSubtotal.toFixed(2);

    return {
      tier: tierLabel,
      ltmFee: ltmFee,
      perSizeBreakdown: perSizeBreakdown,
      lineSubtotal: lineSubtotal,
      grandTotalBeforeTax: +(lineSubtotal + ltmFee).toFixed(2),
      _path: 'PRIMARY'
    };
  },

  // DTF: matches DTF builder UI — garment + decoration + LTM-distributed, rounded
  //   garmentSell = baseCost / marginDenom (+ size upcharge if applicable, not used in our scenarios)
  //   total = garmentSell + transfer + labor + freight + ltmPerUnit, rounded to next $0.50
  // baseCost fetched from /api/base-item-costs?styleNumber=X (returns CASE_PRICE)
  // sizeKey: lowercase 'small'/'medium'/'large'
  DTF: async function runDTF(scenario) {
    const service = new window.DTFPricingService();
    const data = await service.fetchPricingData(scenario.inputs.style);
    const qty = scenario.inputs.qty;
    const sizes = scenario.inputs.sizes;
    const locations = scenario.inputs.locations || [];

    // Fetch garment baseCost the same way the DTF builder UI does:
    //   GET /api/pricing-bundle?method=BLANK&styleNumber=X → min(sizes[].price)
    // (see shared_components/js/dtf-quote-page.js:602-606)
    const blankRes = await fetch(
      'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=BLANK&styleNumber=' +
      encodeURIComponent(scenario.inputs.style)
    );
    const blankData = await blankRes.json();
    const blankSizes = blankData.sizes || [];
    const baseCost = blankSizes.length > 0 ? Math.min(...blankSizes.map(s => s.price)) : 0;
    if (!baseCost) throw new Error('Could not derive baseCost from BLANK bundle for ' + scenario.inputs.style);

    const sizeKeys = locations.map(l => String(l.size).toLowerCase());

    // Pass real garment cost — matches DTF builder UI
    const result = service.calculatePriceForQuantity(baseCost, service.apiData || data, sizeKeys, qty);
    const perPiece = result.finalUnitPrice;
    const tierLabel = result.tierLabel;

    const perSizeBreakdown = {};
    let lineSubtotal = 0;
    for (const size of Object.keys(sizes)) {
      const q = sizes[size];
      // Our test scenarios use M/L/XL only — no size upcharge handling needed yet
      // (Phase 0b.1: add upcharge for 2XL+ scenarios if/when we add any)
      const sizeTotal = +(perPiece * q).toFixed(2);
      perSizeBreakdown[size] = { qty: q, perPiece: perPiece, sizeTotal: sizeTotal };
      lineSubtotal += sizeTotal;
    }
    lineSubtotal = +lineSubtotal.toFixed(2);

    return {
      tier: tierLabel,
      ltmFee: 0, // LTM is distributed into per-piece, not order-level in DTF
      ltmDistributedPerPiece: result.ltmFeePerUnit || 0,
      garmentBaseCost: baseCost,
      garmentSellPerPiece: result.marginDenominator ? +(baseCost / result.marginDenominator).toFixed(2) : null,
      perSizeBreakdown: perSizeBreakdown,
      lineSubtotal: lineSubtotal,
      grandTotalBeforeTax: lineSubtotal
    };
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Server lifecycle
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
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Server did not become ready at ' + url + ' within ' + timeoutMs + 'ms');
}

function spawnServer() {
  console.log('[capture] Spawning server.js …');
  const proc = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '3000', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stdout.on('data', d => process.stdout.write('[server] ' + d));
  proc.stderr.on('data', d => process.stderr.write('[server-err] ' + d));
  return proc;
}

// ──────────────────────────────────────────────────────────────────────────
// Main capture loop
// ──────────────────────────────────────────────────────────────────────────
async function captureAll({ startServer = false, headless = true, baseUrl = 'http://localhost:3000' } = {}) {
  let serverProc = null;
  if (startServer) {
    serverProc = spawnServer();
    await waitForServerReady(baseUrl + '/quote-builders/dtg-quote-builder.html');
  } else {
    console.log('[capture] Using existing server at ' + baseUrl + ' (pass --start-server to spawn one)');
    try {
      await waitForServerReady(baseUrl + '/quote-builders/dtg-quote-builder.html', 5000);
    } catch (e) {
      console.error('[capture] ❌ No server detected at ' + baseUrl + '. Start one with `npm start` or use --start-server.');
      process.exit(1);
    }
  }

  console.log('[capture] Launching Puppeteer (headless=' + headless + ') …');
  const browser = await puppeteer.launch({
    headless: headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const captured = {};
  const errors = [];

  // Group scenarios by builder so we only navigate once per builder
  const byBuilder = {};
  for (const [id, scenario] of Object.entries(SCENARIOS)) {
    byBuilder[scenario.builder] = byBuilder[scenario.builder] || [];
    byBuilder[scenario.builder].push([id, scenario]);
  }

  for (const [builder, scenarios] of Object.entries(byBuilder)) {
    const url = baseUrl + BUILDER_URLS[builder];
    console.log('\n[capture] === ' + builder + ' === navigating to ' + url);
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[' + builder + '] pageerror:', e.message));
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') console.log('[' + builder + ':' + type + ']', msg.text());
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait for the builder's main pricing service to be available on window
      const serviceReady = {
        SCP: () => typeof window.ScreenPrintPricingService !== 'undefined',
        DTG: () => typeof window.DTGPricingService !== 'undefined',
        EMB: () => typeof window.EmbroideryPricingService !== 'undefined',
        DTF: () => typeof window.DTFPricingService !== 'undefined' || typeof window.DTFPricingCalculator !== 'undefined'
      };
      await page.waitForFunction(serviceReady[builder].toString().replace(/^function[^{]+\{/, '').replace(/\}$/, ''), { timeout: 15000 })
        .catch(() => console.log('[' + builder + '] Warning: pricing service did not signal ready in 15s, proceeding'));
      // small additional pad for any async init
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error('[capture] ❌ Failed to load ' + url + ': ' + e.message);
      errors.push({ builder, error: 'page-load: ' + e.message });
      await page.close();
      continue;
    }

    for (const [id, scenario] of scenarios) {
      console.log('  [' + id + '] ' + scenario.description + ' …');

      // Retry transient failures (network race, API timeout, page state).
      // Up to MAX_TRIES total. Each try clears sessionStorage cache + re-evaluates.
      // Real pricing regressions reproduce on every try, so they still fail loudly.
      const MAX_TRIES = 3;
      let lastError = null;
      let success = false;

      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        try {
          // Clear any cached pricing data in sessionStorage before each attempt
          // — prevents stale cache from poisoning a retry
          await page.evaluate(() => {
            Object.keys(sessionStorage).filter(k =>
              /PricingData|pricingBundle|dtg|dtf|emb|scp|screenprint/i.test(k)
            ).forEach(k => sessionStorage.removeItem(k));
          });

          const runnerSrc = PAGE_RUNNERS[builder].toString();
          const result = await page.evaluate(async (runnerSource, scenarioData) => {
            // eslint-disable-next-line no-eval
            const runnerFn = eval('(' + runnerSource + ')');
            return await runnerFn(scenarioData);
          }, runnerSrc, scenario);

          captured[id] = {
            builder: scenario.builder,
            description: scenario.description,
            inputs: scenario.inputs,
            expected: result
          };
          if (result._stub) {
            console.log('    ⏳ stub (Phase 0b.1)');
          } else {
            const retryNote = attempt > 1 ? ' (retry ' + attempt + ')' : '';
            console.log('    ✅ grand=$' + result.grandTotalBeforeTax + ' line=$' + result.lineSubtotal + retryNote);
          }
          success = true;
          break;
        } catch (e) {
          lastError = e;
          if (attempt < MAX_TRIES) {
            console.log('    ⚠ attempt ' + attempt + ' failed: ' + e.message + ' — retrying after 1.5s …');
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      if (!success) {
        console.error('    ❌ ' + lastError.message + ' (after ' + MAX_TRIES + ' tries)');
        errors.push({ id, error: lastError.message, attempts: MAX_TRIES });
      }
    }

    await page.close();
  }

  await browser.close();
  if (serverProc) {
    console.log('[capture] Shutting down spawned server …');
    serverProc.kill('SIGTERM');
  }

  // Wrap with meta
  const output = {
    _meta: {
      capturedAt: new Date().toISOString(),
      capturedBy: 'scripts/capture-pricing-baselines.js',
      scenarios: Object.keys(SCENARIOS).length,
      successful: Object.keys(captured).filter(k => !captured[k].expected._stub).length,
      stubs: Object.keys(captured).filter(k => captured[k].expected._stub).length,
      errors: errors.length,
      errorList: errors
    },
    ...captured
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log('\n[capture] ✅ Wrote ' + OUTPUT_PATH);
  console.log('[capture] Summary: ' + output._meta.successful + ' captured, ' +
              output._meta.stubs + ' stubs, ' + output._meta.errors + ' errors');

  return { captured: output, errorCount: errors.length };
}

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = {
    startServer: args.includes('--start-server'),
    headless: !args.includes('--headed'),
    baseUrl: 'http://localhost:3000'
  };
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node scripts/capture-pricing-baselines.js [--start-server] [--headed]

Options:
  --start-server   Spawn server.js on port 3000 (default: assume already running)
  --headed         Show the browser window (default: headless)
  --help           Show this help

Output: tests/pricing-baselines/baselines.captured.json
`);
    process.exit(0);
  }
  captureAll(opts).then(({ errorCount }) => {
    process.exit(errorCount > 0 ? 1 : 0);
  }).catch(err => {
    console.error('[capture] FATAL:', err);
    process.exit(1);
  });
}

module.exports = { captureAll, SCENARIOS, BUILDER_URLS, PAGE_RUNNERS };
