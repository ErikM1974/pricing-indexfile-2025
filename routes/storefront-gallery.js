// routes/storefront-gallery.js — Storefront gallery pricing and merchandising
// Extracted VERBATIM from server.js lines 2234-2327 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CTS_MERCH, CTS_PRICING, TDT_PROXY, fetch, getCtsCatalog, getCtsPricingConfig } = ctx;

const CTS_REF_ART = { wIn: 8, hIn: 8 };       // → 'FF' (full-front) via locationForArtSize
const CTS_REF_QTYS = [12, 24, 48, 72];        // card price @12 + the hover ladder
const _ctsStyleCopyCache = new Map();          // style → { at, value: { blurb, fabric } }
let _ctsGalleryExtrasCache = { at: 0, value: null };

async function getCtsStyleCopy(style) {
  const hit = _ctsStyleCopyCache.get(style);
  if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000) return hit.value;
  let value = { blurb: '', fabric: '' };
  try {
    const r = await fetch(`${TDT_PROXY}/api/product-details?styleNumber=${encodeURIComponent(style)}`);
    if (r.ok) {
      const rows = await r.json();
      const desc = (Array.isArray(rows) && rows[0] && rows[0].PRODUCT_DESCRIPTION) || '';
      value = {
        blurb: CTS_MERCH.extractBlurb(desc),
        fabric: CTS_MERCH.extractFabric(desc).label,
      };
    } else {
      console.warn(`[CTS gallery] product-details HTTP ${r.status} for ${style} — card ships without a blurb`);
    }
  } catch (e) {
    console.warn(`[CTS gallery] product-details failed for ${style} — card ships without a blurb:`, e.message);
  }
  _ctsStyleCopyCache.set(style, { at: Date.now(), value });
  return value;
}

// Per-piece reference prices for one style at the ladder quantities. Reuses
// the 5-min-cached getCtsPricingConfig (DTG_Store bundle + fail-closed Service_
// Codes; the baked small-batch fee at 12 comes from the DTG_Store tier) and the
// pure quote engine — identical inputs to checkout's reprice, minus tax/shipping.
async function priceCtsStyleRefs(style) {
  const { pricingData, config } = await getCtsPricingConfig(style);
  const loc = CTS_PRICING.locationForArtSize('front', CTS_REF_ART.wIn, CTS_REF_ART.hIn);
  const sizes = config.sizes || [];
  const sizeKey = sizes.includes('M') ? 'M' : sizes[0];
  if (!sizeKey) throw new Error(`No priced sizes for ${style}`);
  const onSale = parseFloat(config.saleOff) > 0;
  const runQuote = (qty, cfg) => CTS_PRICING.quote({
    pricingData, config: cfg,
    cart: [{ catalogColor: 'REF', colorName: 'Reference', qty: { [sizeKey]: qty } }],
    location: loc, backLocation: null, rush: false,
    delivery: { method: 'pickup', taxRate: 0 },
  });
  const prices = {};
  const wasPrices = {};
  CTS_REF_QTYS.forEach((qty) => {
    // perShirt is the ENGINE'S own per-piece figure — (merch + LTM) / qty,
    // baked-LTM aware — the same number the configurator shows customers.
    const ea = Number(runQuote(qty, config).perShirt);
    if (!(ea > 0)) throw new Error(`Reference quote for ${style} @ ${qty} produced no per-shirt price`);
    prices[String(qty)] = ea;
    if (onSale) {
      // Strike-through "was" = the SAME quote with the sale zeroed.
      wasPrices[String(qty)] = Number(runQuote(qty, { ...config, saleOff: 0 }).perShirt);
    }
  });
  return onSale
    ? { prices, wasPrices, salePerShirt: parseFloat(config.saleOff) }
    : { prices };
}

// GET /api/cts/gallery-extras — { qtys, refLocation, styles: { STYLE:
//   { blurb, fabric, prices: { '12': ea, ... } } | { ..., priceError } } }
app.get('/api/cts/gallery-extras', async (req, res) => {
  try {
    if (_ctsGalleryExtrasCache.value
      && Date.now() - _ctsGalleryExtrasCache.at < 5 * 60 * 1000) {  // ≤ the 5-min config cache — card prices must not outlive the configurator's
      return res.json(_ctsGalleryExtrasCache.value);
    }
    const catalog = await getCtsCatalog();
    const styles = [...catalog.keys()];
    const out = {};
    const CHUNK = 5;   // limit cold-cache proxy fan-out (bundle+codes per style)
    for (let i = 0; i < styles.length; i += CHUNK) {
      await Promise.all(styles.slice(i, i + CHUNK).map(async (style) => {
        const copy = await getCtsStyleCopy(style);
        try {
          out[style] = { ...copy, ...(await priceCtsStyleRefs(style)) };
        } catch (e) {
          console.error(`[CTS gallery] reference pricing failed for ${style}:`, e.message);
          out[style] = { ...copy, priceError: 'Pricing unavailable' };
        }
      }));
    }
    const value = { qtys: CTS_REF_QTYS, refLocation: 'FF', styles: out };
    _ctsGalleryExtrasCache = { at: Date.now(), value };
    res.json(value);
  } catch (e) {
    console.error('[CTS gallery] gallery-extras failed:', e.message);
    res.status(502).json({ error: 'Gallery pricing is unavailable right now.' });
  }
});
};
