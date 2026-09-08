// Storefront channels: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const {
        CASPIO_PROXY_BASE,
        CTS_SHIPDATE,
        STOREFRONT_CHANNEL_CONFIG,
        TDT_SHIPDATE,
        TDT_SIZES,
        capsStockConflicts,
        ctsStockConflicts,
        rebuildCapsQuote,
        rebuildCtsQuote,
        rebuildTdtQuote,
    } = ctx;

    // Stamped artwork refs must point at OUR files API — see sanitizeUploadedLogoRef.
    const { sanitizeUploadedLogoRef } = STOREFRONT_CHANNEL_CONFIG;

    const UPLOADED_ARTWORK_URL_PREFIX = `${CASPIO_PROXY_BASE}/api/files/`;

    // ── Storefront channel registry (2026-06-11) ────────────────────────────────
    // ONE switchboard for everything that differs per storefront channel
    // (orderSettings.channel). The pure/static half (QuoteID builders, ShopWorks
    // push constants, banners, EmailJS templates) lives in
    // config/storefront-channels.js and is jest-locked by
    // tests/unit/storefront-channels.test.js; this const binds the SERVER-ONLY
    // behaviors on top. Adding a channel ('custom-caps') = one entry in the
    // config module + one matching entry here — see the field-by-field checklist
    // in that file. Do NOT add per-channel ternaries back into the routes.
    const CHANNELS = {
        'custom-tees': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-tees'], {
            rebuildQuote: (colorConfigs, orderSettings, customerData) =>
                rebuildCtsQuote(colorConfigs, orderSettings, customerData),
            // Per-style size whitelist from the SERVER-fetched bundle (load-bearing:
            // an unknown client size key must never inflate the tier while pricing $0).
            sizeWhitelist: (priced) => priced.sizes,
            stockGate: true,
            // Per-channel conflict math: tees compare per color+size (the feed's
            // size rows are real for garments).
            stockConflicts: (cleanConfigs, stock) => ctsStockConflicts(cleanConfigs, stock),
            // Standard orders promise the END of the 7-10 business-day window; the
            // opt-in rush toggle uses the 3-day cutoff promise.
            shipPromise: (priced) =>
                priced.rush
                    ? { promise: CTS_SHIPDATE.promise(new Date()), mode: 'rush-3day' }
                    : { promise: CTS_SHIPDATE.standardPromise(new Date()), mode: 'standard-7to10' },
            // Server-validated style facts become the order of record (the client's
            // were advisory) — the push + success page read THESE.
            stampedOrderSettings: (priced, stockChecked) => ({
                channel: 'custom-tees',
                styleNumber: priced.style,
                styleName: priced.productName,
                rush: priced.rush,
                frontLocation: priced.frontLocation,
                backLocation: priced.backLocation,
                // false = the live stock gate couldn't run (inventory API hiccup,
                // fail-open) — the push note tells production to verify garments.
                stockChecked,
            }),
        }),
        '3-day-tees': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['3-day-tees'], {
            rebuildQuote: (colorConfigs, orderSettings, customerData) =>
                rebuildTdtQuote(colorConfigs, orderSettings, customerData),
            sizeWhitelist: () => TDT_SIZES,
            stockGate: false,
            stockConflicts: (cleanConfigs, stock) => ctsStockConflicts(cleanConfigs, stock), // unreachable (no gate) — shape parity
            shipPromise: () => ({ promise: TDT_SHIPDATE.promise(new Date()), mode: 'rush-3day' }),
            stampedOrderSettings: () => ({}),
        }),
        // Custom Hats — OSFA cap embroidery storefront (server core 2026-06-11;
        // pages pending). Erik's locked decisions: 8-cap minimum (NO LTM — the 1-7
        // tier is unreachable), free logo setup (no digitizing line), proof-first
        // always, back logo = flat tiered CAP-AL add-on.
        'custom-caps': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-caps'], {
            rebuildQuote: (colorConfigs, orderSettings, customerData) =>
                rebuildCapsQuote(colorConfigs, orderSettings, customerData),
            sizeWhitelist: (priced) => priced.sizes, // ['OSFA'] — one-click qty, no size grid
            // SanMar live inventory gate (same getCtsStock SanMar path the tees use —
            // caps never hit the Milton PC54 branch because rush is always false).
            stockGate: true,
            // C402 lesson (2026-06-11): cap feeds carry stale sized partIds (XL/SM
            // rows at 0 qty next to the real OSFA rows) — conflicts must aggregate
            // live qty by CATALOG_COLOR, never by size.
            stockConflicts: (cleanConfigs, stock) => capsStockConflicts(cleanConfigs, stock),
            // Proof-first promise: the 7-10 business-day window WORDING is "after
            // proof approval" everywhere (banners/emails read the registry strings).
            // PROPOSED window: digitizing 1-3 days + embroidery production, stamped
            // as the end of a 7-10 biz-day window from checkout — assumes prompt
            // proof approval. ERIK-DECISION: confirm 7-10 (vs a wider 10-12) before
            // the page goes live; the binding date stamps at checkout, but the clock
            // honestly starts at proof approval.
            shipPromise: () => ({
                promise: CTS_SHIPDATE.standardPromise(new Date()),
                mode: 'proof-first-standard',
            }),
            // Server-validated cap facts become the order of record. Stitch counts
            // are NEVER exposed (decision #2) — the 8K-included assumption lives in
            // the pricing module, not on the order. needsArtReview is forced ON
            // (proof-first, decision #11) regardless of what the client sent.
            stampedOrderSettings: (priced, stockChecked, clientSettings) => ({
                channel: 'custom-caps',
                styleNumber: priced.style,
                styleName: priced.productName,
                rush: false,
                // {fileUrl,fileName} refs, sanitized to OUR files API — the ShopWorks
                // push (designs + attachments), quote-view and the success page all
                // read .fileUrl. Stamping booleans here shipped CAP orders with NO
                // artwork attached (first caps E2E, 2026-08-25). backLogo rides ONLY
                // when the reprice actually charged it — an uncharged file must never
                // reach production.
                frontLogo: sanitizeUploadedLogoRef(
                    clientSettings && clientSettings.frontLogo,
                    UPLOADED_ARTWORK_URL_PREFIX
                ),
                backLogo: priced.backLogo
                    ? sanitizeUploadedLogoRef(
                          clientSettings && clientSettings.backLogo,
                          UPLOADED_ARTWORK_URL_PREFIX
                      )
                    : null,
                frontLocation: 'CF', // → 'Cap Front' via swLocationMap at push
                backLocation: priced.backLogo ? 'CB' : null, // → 'Cap Back'
                printLocationName: priced.backLogo ? 'Cap Front + Cap Back' : 'Cap Front',
                needsArtReview: true, // ALWAYS proof-first
                stockChecked,
            }),
        }),
        // Sample Program (2026-07-06) — registry entry exists so save3DTQuoteSession
        // Notes labels, shipped emails, and channelConfig lookups resolve correctly,
        // but sample carts are MULTI-STYLE and NEVER go through this shared
        // single-style route: the dedicated POST /api/samples/create-checkout-session
        // owns the reprice + Stripe session, and the webhook's
        // metadata.kind === 'samples-order' branch owns fulfillment.
        samples: Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['samples'], {
            rebuildQuote: () => {
                throw Object.assign(
                    new Error('Sample orders check out via /api/samples/create-checkout-session'),
                    { code: 'STYLE_NOT_ALLOWED' } // → clean 400, never a 502
                );
            },
            sizeWhitelist: () => [],
            stockGate: false,
            stockConflicts: () => [],
            shipPromise: () => ({
                promise: CTS_SHIPDATE.standardPromise(new Date()),
                mode: 'samples-2to3day',
            }),
            stampedOrderSettings: () => ({}),
        }),
    };

    // Absent/unknown channel → legacy 3DT (exactly the pre-registry `isCTS`
    // else-branch; historical Caspio rows have no channel stamped and must keep
    // working). Use channelConfigExact for whitelist-gated paths where an
    // unregistered channel must stay EXCLUDED (e.g. the shipped email).
    function channelConfig(channel) {
        return (
            CHANNELS[String(channel || '')] || CHANNELS[STOREFRONT_CHANNEL_CONFIG.DEFAULT_CHANNEL]
        );
    }

    function channelConfigExact(channel) {
        return CHANNELS[String(channel || '')] || null;
    }

    return { channelConfig, channelConfigExact };
};
