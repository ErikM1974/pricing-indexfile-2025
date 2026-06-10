/**
 * cts-e2e-local.js — local end-to-end for the Custom T-Shirts channel.
 *
 * Step 1: POST /api/create-checkout-session with a CTS payload (channel:
 *         'custom-tees', PC54, 12×M Jet Black, PICKUP — no shipping drift,
 *         standard turnaround). Expects the server's authoritative reprice
 *         to ACCEPT the client totals computed with the same module + data.
 * Step 2: Read the Caspio session row back and assert the stamps
 *         (DTG-prefix QuoteID, styleNumber, rush:false, standard promise).
 * Step 3: Print the exact fire-test-webhook command for the push leg.
 *
 * Usage: node tests/cts-e2e-local.js   (server must be running on :3000)
 * The webhook leg pushes a REAL test order into ManageOrders — void after.
 */
const CTS_PRICING = require('../pages/js/custom-tees-pricing.js');

const PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const LOCAL = 'http://localhost:3000';

async function grab(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
  return r.json();
}

(async () => {
  // Live pricing inputs — the same sources the server repricer uses.
  const pricingData = await grab(`${PROXY}/api/pricing-bundle?method=DTG&styleNumber=PC54`);
  const sizes = (pricingData.sizes || []).map(s => s.size).filter(Boolean);

  // Milton pickup tax = 10.1 — but derive via the same DOR endpoint the server uses.
  const taxResp = await fetch(`${PROXY}/api/tax-rates/lookup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: '', city: 'Milton', state: 'WA', zip: '98354' }),
  });
  const taxJ = await taxResp.json();
  const taxRate = parseFloat(taxJ.rate);
  if (!Number.isFinite(taxRate)) throw new Error('tax lookup failed');

  // Online LTM (CTS-LTM $25) — same Service_Code the server loads; without it
  // the client/server totals diverge and the 409 mismatch guard fires.
  const ltmResp = await grab(`${PROXY}/api/service-codes?code=CTS-LTM`);
  const ltmFee = parseFloat(ltmResp.data && ltmResp.data[0] && ltmResp.data[0].SellPrice);
  if (!Number.isFinite(ltmFee)) throw new Error('CTS-LTM service code missing');

  // Threshold shipping codes (UberPrints model 2026-06-10) — mirror the page.
  const shipCodes = await Promise.all(['CTS-SHIP-FLAT', 'CTS-SHIP-FREE-OVER'].map(async (c) => {
    const j = await grab(`${PROXY}/api/service-codes?code=${c}`);
    return parseFloat(j.data && j.data[0] && j.data[0].SellPrice);
  }));

  const cart = [{ catalogColor: 'Jet Black', colorName: 'Jet Black', qty: { M: 12 } }];
  const quote = CTS_PRICING.quote({
    pricingData,
    config: { rushPct: 25, ltmFee, bakeLtm: true, shipFlat: shipCodes[0], shipFreeOver: shipCodes[1], sizes },
    cart,
    location: 'LC',
    backLocation: null,
    rush: false,
    delivery: { method: 'pickup', taxRate },
  });
  console.log('[E2E] Client quote:', {
    unitM: quote.unitBySize.M.finalPrice, ltmFee: quote.ltmFee,
    tax: quote.tax, total: quote.total, tier: quote.tierLabel,
  });

  const payload = {
    customer_email: 'erik@nwcustomapparel.com',
    customerData: {
      firstName: 'TEST', lastName: 'CustomTees-E2E',
      email: 'erik@nwcustomapparel.com', phone: '253-922-5793',
      company: 'NWCA INTERNAL TEST — VOID ME',
      deliveryMethod: 'pickup', state: 'WA', city: 'Milton', zip: '98354',
      notes: 'SYNTHETIC E2E ORDER — DO NOT PRODUCE. Void in ShopWorks.',
    },
    colorConfigs: {
      'Jet Black': {
        catalogColor: 'Jet Black', displayColor: 'Jet Black',
        totalQuantity: 12,
        sizeBreakdown: { M: { quantity: 12, unitPrice: quote.unitBySize.M.finalPrice } },   // baked price (15.08)
      },
    },
    orderTotals: {
      totalQuantity: quote.combinedQty, subtotal: quote.shirtsSubtotal,
      ltmFee: quote.ltmFee, shipping: 0, salesTax: quote.tax,
      taxRate: quote.taxRate, grandTotal: quote.total,
    },
    orderSettings: {
      channel: 'custom-tees',
      styleNumber: 'PC54',
      productTitle: 'Port & Company Core Cotton Tee',
      rush: false,
      frontLocation: 'LC',
      backLocation: null,
      printLocationCode: 'LC',
      printLocationName: 'Left Chest',
      placement: { front: { wIn: 4, hIn: 4, xIn: 0, yIn: 2.5 } },
      mockups: [],
      needsArtReview: true,
      // Required since 2026-06-10: server 400s storefront orders without it
      rightsAck: { checked: true, ts: new Date().toISOString() },
    },
  };

  const resp = await fetch(`${LOCAL}/api/create-checkout-session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json();
  if (!resp.ok) {
    console.error('[E2E] ✗ create-checkout-session failed:', resp.status, body);
    process.exit(1);
  }
  console.log('[E2E] ✓ Checkout session created:', { quoteID: body.quoteID, hasStripeUrl: !!body.url });
  if (!/^DTG\d{4}-\d{4}$/.test(body.quoteID)) {
    console.error('[E2E] ✗ QuoteID is not DTG-prefixed:', body.quoteID);
    process.exit(1);
  }

  // Step 2 — read the Caspio row back and assert the stamps.
  const rowsR = await fetch(`${PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(body.quoteID)}&refresh=true`);
  const rows = await rowsR.json();
  const row = (Array.isArray(rows) ? rows : (rows.data || [])).find(s => s.QuoteID === body.quoteID);
  if (!row) { console.error('[E2E] ✗ Caspio row not found'); process.exit(1); }
  const os = JSON.parse(row.OrderSettingsJSON || '{}');
  const ot = JSON.parse(row.OrderTotalsJSON || '{}');
  const checks = {
    channel: os.channel === 'custom-tees',
    style: os.styleNumber === 'PC54',
    rushOff: os.rush === false,
    standardPromise: os.shipPromise && os.shipPromise.mode === 'standard-7to10' && !!os.shipPromise.rangeLabel,
    totalMatches: Math.abs(parseFloat(ot.grandTotal) - quote.total) < 0.01,
    // Save convention: Status column = 'Pending Payment'; the 'Checkout
    // Created' breadcrumb lives in Notes.
    statusCreated: /Pending Payment/i.test(row.Status || '') && /Checkout Created/i.test(row.Notes || ''),
  };
  console.log('[E2E] Caspio stamps:', checks, { promise: os.shipPromise && os.shipPromise.rangeLabel, grandTotal: ot.grandTotal });
  const allOk = Object.values(checks).every(Boolean);
  if (!allOk) { console.error('[E2E] ✗ stamp assertions failed'); process.exit(1); }

  console.log('\n[E2E] ✓✓ Steps 1-2 PASSED. To run the push leg (creates a REAL ManageOrders test order):');
  console.log(`  node tests/3dt-fire-test-webhook.js ${body.quoteID} ${Math.round(quote.total * 100)}`);
})().catch(e => { console.error('[E2E] FAILED:', e); process.exit(1); });
