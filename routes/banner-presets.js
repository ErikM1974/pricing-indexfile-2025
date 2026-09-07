// routes/banner-presets.js — Public banner presets (custom-banners boot payload)
// Extracted VERBATIM from server.js lines 13253-13324 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CASPIO_PROXY_BASE, fetch } = ctx;

// PUBLIC BANNER PRESETS — /custom-banners boot payload (Phase 3, 2026-07-24)
//
// The banner rate card has NO volume break ($10/sqft flat), so the sticker
// page's quantity ladder has nothing to attach to. What varies on a banner is
// SIZE — so the ladder is a size ladder, and this prices every preset in ONE
// round trip instead of the browser firing seven /quote calls on load.
//
// Every price still comes from computeBannerQuote via the proxy; this only
// fans out and collects, so there is no second banner pricing implementation.
// The proxy's 15-min TTL cache means the fan-out is one Caspio read, not seven.
// =============================================================================
const BANNER_PRESET_SIZES = [
  { w: 2, h: 4,  label: '2 × 4 ft',  note: 'Table banner' },
  { w: 2, h: 6,  label: '2 × 6 ft',  note: 'Table / rail' },
  { w: 3, h: 5,  label: '3 × 5 ft',  note: 'Fence banner' },
  { w: 3, h: 6,  label: '3 × 6 ft',  note: 'Most popular' },
  { w: 3, h: 8,  label: '3 × 8 ft',  note: 'Wide fence' },
  { w: 4, h: 8,  label: '4 × 8 ft',  note: 'Field / building' },
  { w: 4, h: 10, label: '4 × 10 ft', note: 'Large format' },
];

app.get('/api/public/banner-presets', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  try {
    const cardRes = await fetch(`${CASPIO_PROXY_BASE}/api/banner-pricing`);
    if (!cardRes.ok) throw new Error('rate card HTTP ' + cardRes.status);
    const card = await cardRes.json();

    const priced = await Promise.all(BANNER_PRESET_SIZES.map(async (p) => {
      const w = Math.round(p.w * 12), h = Math.round(p.h * 12);
      const r = await fetch(`${CASPIO_PROXY_BASE}/api/banner-pricing/quote?width=${w}&height=${h}&qty=1`);
      if (!r.ok) throw new Error(`preset ${p.label} HTTP ${r.status}`);
      const q = await r.json();
      return {
        key: `${p.w}x${p.h}`,
        label: p.label,
        note: p.note,
        widthFt: p.w, heightFt: p.h, widthIn: w, heightIn: h,
        sqft: q.dimensions ? q.dimensions.sqft : null,
        price: q.orderTotal,
        atMinimum: !!(q.appliedRules && q.appliedRules.minimum),
      };
    }));

    const rate = (pn) => {
      const row = (card.rates || []).find(x => x.PartNumber === pn);
      return row ? Number(row.Rate) : null;
    };

    res.json({
      presets: priced,
      rateCard: {
        perSqft: rate('BAN-SQFT'),
        minimum: rate('BAN-MIN'),
        grommet: rate('BAN-GROMMET'),
        polePocketPerFt: rate('BAN-POLE-POCKET'),
        doubleSidedMultiplier: rate('BAN-DOUBLE-SIDE'),
      },
      setupFee: card.setupFee || null,
      source: card.source,
      // 52in is the printable roll width; anything whose SHORT side exceeds it
      // has to be panelled and seamed.
      safeRollWidthIn: 52,
    });
  } catch (err) {
    console.error('[banner-presets] failed:', err.message);
    // Rule 4: no price rather than a guessed one.
    res.status(502).json({ error: 'Banner pricing unavailable' });
  }
});

// =============================================================================
};
