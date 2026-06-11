// ============================================================================
// Storefront channel registry — PURE config (no server/DOM/fetch deps).
//
// One entry per storefront channel (orderSettings.channel). Everything that
// used to be a scattered `channel === 'custom-tees'` ternary / hardcoded
// constant in server.js reads from here instead, so adding a channel is
// ADDITIVE (one new entry) rather than a hunt for silent-exclusion bugs
// (e.g. a new channel's orders never getting a shipped email because a
// whitelist deep in server.js didn't know the string).
//
// server.js requires this module and binds the SERVER-ONLY behaviors
// (rebuildQuote, shipPromise, sizeWhitelist, stockGate, stampedOrderSettings)
// on top of each entry — see `const CHANNELS = ...` in server.js's storefront
// section. Characterization tests locking the exact strings/values for both
// live channels: tests/unit/storefront-channels.test.js.
//
// ── Adding a channel (e.g. 'custom-caps') ───────────────────────────────────
// 1. Add an entry below with EVERY field listed here (the jest suite has a
//    required-fields completeness check):
//      label                   display name (logs/docs)
//      logPrefix               checkout-route console prefix
//      quoteIdPrefix           QuoteID prefix (DECIDE DELIBERATELY — co-locates
//                              orders in Quote Mgmt; irreversible once live)
//      buildQuoteId()          → '{prefix}{MMDD}-{rand4}' candidate (the
//                              checkout route still does the uniqueness check)
//      requireRightsAck        bool — 400 the checkout without rightsAck.checked
//      rushEligible            array of style numbers allowed to opt into rush
//      orderNoteLabel({rush, styleNumber}) → Caspio quote_sessions Notes label
//      stripeSource            Stripe metadata.source value
//      stripeLineName(priced, line) → Stripe line-item product name
//      stripeSuccessPath(quoteID) → success redirect path (keep the literal
//                              '{CHECKOUT_SESSION_ID}' placeholder for Stripe)
//      stripeCancelPath()      → cancel redirect path
//      fallbackProductName     style-name fallback when orderSettings.styleName
//                              is absent (emails, order-status, push lines)
//      push: {                 ShopWorks/ManageOrders push constants
//        fallbackStyleNumber     part number when no style is stamped
//        ltmPartNumber           LTM fee line part number (stable SW SKU)
//        designTypeId            OnSite design type (45 = DTG; EMB differs!)
//        artistId                OnSite artist routing id
//        designExternalIdPrefix  design block ExternalID prefix
//        designLocationColors    design location `colors` value
//        designDetails()         → fresh details[] array per location
//        swLocationMap           location code → EXACT OnSite dropdown value
//        defaultFrontLocationName / defaultBackLocationName
//        serviceBanner(rush)     → first line of the Notes On Order banner
//        artReviewClock(rush)    → clock wording in the art-review banner
//        stockBanner             bool — emit '*** STOCK NOT VERIFIED ***' when
//                                orderSettings.stockChecked === false
//        rushOrderFlag(orderSettings) → ManageOrders rushOrder boolean
//        taxPartNumber(pct)      → tax directive part ('Tax_10.1' / 'Tax_0')
//      }
//      emails: {               EmailJS template wiring
//        confirmationCustomerTemplate / confirmationSalesTemplate
//        shippedEnabled          bool — sendOrderShippedEmail gate. A channel
//                                missing from this registry NEVER gets the
//                                shipped email (exact-match lookup, like the
//                                old whitelist) — so don't forget the entry.
//        shippedTemplate
//      }
// 2. In server.js, add the matching server-bound entry to `CHANNELS`
//    (rebuildQuote, buildQuoteId binding, shipPromise, sizeWhitelist,
//    stockGate, stampedOrderSettings).
// 3. Service_Codes rows, catalog table, pricing module etc. are per-channel
//    work outside this file — see memory/CUSTOMER_SITE_REDESIGN_2026-06.md.
// ============================================================================

'use strict';

// '{prefix}{MM}{DD}-{4-digit random}' — the shape both storefronts have always
// used (3DT0610-0042 / DTG0610-1187). Random, NOT sequential: the checkout
// route retries against a live uniqueness lookup.
function buildDateRandQuoteId(prefix) {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}${month}${day}-${sequence}`;
}

// Shared DTG push constants — BOTH tee channels push identical DTG design
// blocks today. A hats channel overrides every one of these (designTypeId,
// details, location map are embroidery-shaped there).
const DTG_SW_LOCATION_MAP = Object.freeze({
  LC: 'Left Chest', FF: 'Full Front', JF: 'Full Front', FB: 'Full Back', JB: 'Full Back',
});
const dtgDesignDetails = () => [{
  color: 'Full Color DTG',
  paramLabel: 'Print Type',
  paramValue: 'Direct to Garment',
}];
const taxPartNumber = (pct) => (pct ? `Tax_${pct}` : 'Tax_0');

const RUSH_SERVICE_BANNER = '3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.';
const STANDARD_SERVICE_BANNER = 'STANDARD DTG SERVICE - 7-10 business days from artwork approval.';

const CHANNELS = {
  // Custom T-Shirts — multi-style DTG storefront (LIVE since 2026-06-10).
  'custom-tees': {
    label: 'Custom T-Shirts',
    logPrefix: '[Custom Tees Checkout]',
    quoteIdPrefix: 'DTG',   // deliberate: co-locates with internal DTG builder quotes in Quote Mgmt (Erik 2026-06-10)
    buildQuoteId: () => buildDateRandQuoteId('DTG'),
    requireRightsAck: true,
    rushEligible: ['PC54'],   // 3-Day Rush launch scope (config, expand later)
    orderNoteLabel: ({ rush, styleNumber } = {}) =>
      `Custom T-Shirts DTG Order${rush ? ' (3-Day Rush)' : ''} — ${styleNumber || ''}`,
    stripeSource: 'custom-tees',
    stripeLineName: (priced, l) =>
      `${priced.style} ${priced.productName ? '— ' + String(priced.productName).slice(0, 60) : 'Tee'} — ${l.colorName}, ${l.size}${priced.rush ? ' (3-Day Rush)' : ''}`,
    stripeSuccessPath: (quoteID) =>
      `/pages/custom-tees-success.html?session_id={CHECKOUT_SESSION_ID}&quote_id=${quoteID}`,
    stripeCancelPath: () => '/custom-tees?canceled=1',
    fallbackProductName: 'Port & Company Core Cotton Tee',
    push: {
      fallbackStyleNumber: 'PC54',
      ltmPartNumber: 'LTM-75',
      designTypeId: 45,   // DTG
      artistId: 224,      // 3-Day Tees routing
      designExternalIdPrefix: '3DT-',
      designLocationColors: 'Full Color',
      designDetails: dtgDesignDetails,
      swLocationMap: DTG_SW_LOCATION_MAP,
      defaultFrontLocationName: 'Left Chest',
      defaultBackLocationName: 'Full Back',
      // Rush is OPT-IN on this channel; standard orders must never get the
      // rush banner (production would rush them).
      serviceBanner: (rush) => (rush ? RUSH_SERVICE_BANNER : STANDARD_SERVICE_BANNER),
      artReviewClock: (rush) => (rush ? '3-day clock' : 'production clock'),
      stockBanner: true,
      rushOrderFlag: (orderSettings) => !!(orderSettings && orderSettings.rush),
      taxPartNumber,
    },
    emails: {
      confirmationCustomerTemplate: 'template_sample_customer',
      confirmationSalesTemplate: 'template_sample_sales',
      shippedEnabled: true,
      shippedTemplate: 'template_order_shipped',
    },
  },

  // 3-Day Tees — legacy single-style (PC54) rush storefront. Entry URLs 301
  // to /custom-tees since 2026-06-10, but in-flight orders / old rows (often
  // with NO channel stamped) still resolve here via DEFAULT_CHANNEL.
  '3-day-tees': {
    label: '3-Day Tees',
    logPrefix: '[3-Day Tees Checkout]',
    quoteIdPrefix: '3DT',
    buildQuoteId: () => buildDateRandQuoteId('3DT'),
    requireRightsAck: false,
    rushEligible: ['PC54'],   // every 3DT order IS rush; list kept for shape parity
    orderNoteLabel: () => '3-Day Tees Rush Order',
    stripeSource: '3day-tees',   // historical value — no hyphen between 3 and day
    stripeLineName: (priced, l) => `PC54 Tee — ${l.colorName}, ${l.size}`,
    stripeSuccessPath: (quoteID) =>
      `/pages/3-day-tees-success.html?session_id={CHECKOUT_SESSION_ID}&quote_id=${quoteID}`,
    stripeCancelPath: () => '/pages/3-day-tees.html?canceled=1',
    fallbackProductName: 'Port & Company Core Cotton Tee',
    push: {
      fallbackStyleNumber: 'PC54',
      ltmPartNumber: 'LTM-75',
      designTypeId: 45,
      artistId: 224,
      designExternalIdPrefix: '3DT-',
      designLocationColors: 'Full Color',
      designDetails: dtgDesignDetails,
      swLocationMap: DTG_SW_LOCATION_MAP,
      defaultFrontLocationName: 'Left Chest',
      defaultBackLocationName: 'Full Back',
      serviceBanner: () => RUSH_SERVICE_BANNER,   // legacy 3DT is ALWAYS rush
      artReviewClock: () => '3-day clock',
      stockBanner: false,
      rushOrderFlag: () => true,
      taxPartNumber,
    },
    emails: {
      confirmationCustomerTemplate: 'template_sample_customer',
      confirmationSalesTemplate: 'template_sample_sales',
      shippedEnabled: true,
      shippedTemplate: 'template_order_shipped',
    },
  },
};

// Rows with an absent/unknown channel are legacy 3DT — the pre-registry code
// treated "anything other than 'custom-tees'" as 3DT, and that default must
// keep working for every historical Caspio row.
const DEFAULT_CHANNEL = '3-day-tees';

module.exports = { CHANNELS, DEFAULT_CHANNEL, buildDateRandQuoteId };
