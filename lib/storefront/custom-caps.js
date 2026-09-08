// Storefront custom-caps: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const { CAPS_PRICING, TDT_PROXY, fetch, resolveTdtTax } = ctx;

    // ── Custom Hats ('custom-caps') server core (2026-06-11) ────────────────────
    // Server twin of pages/js/custom-caps-pricing.js: fetches the CAP + CAP-AL
    // bundles and the CAPS-SHIP-* Service_Codes FRESH (fail-closed), reprices
    // server-side, and the shared checkout route enforces the 1-cent tolerance
    // against the client total. qty < 8 → the module's structured BELOW_MINIMUM
    // error → 400 (never a 1-7-tier price, never an LTM fee).

    const _capsCfgCache = new Map();

    // styleNumber → { at, value }
    async function getCapsPricingConfig(styleNumber) {
        const style = String(styleNumber || '')
            .trim()
            .toUpperCase();
        if (!/^[A-Z0-9_-]{2,20}$/.test(style))
            throw new Error(`Invalid style number: ${styleNumber}`);
        const hit = _capsCfgCache.get(style);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

        const grab = async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
            return r.json();
        };
        const code = async (c) => {
            const j = await grab(`${TDT_PROXY}/api/service-codes?code=${c}`);
            const row = j && j.data && j.data[0];
            if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
                throw new Error(`Service code ${c} missing/inactive in Caspio`);
            }
            return parseFloat(row.SellPrice);
        };

        // ALL fail-closed: a missing bundle or Caspio code 502s the checkout
        // visibly — never a guessed price (Erik's #1 rule). NOTE the FREE-OVER
        // trap: its SellPrice holds the THRESHOLD dollars (mirrors CTS).
        const [capBundle, capAlBundle, shipFlat, shipFreeOver] = await Promise.all([
            grab(
                `${TDT_PROXY}/api/pricing-bundle?method=CAP&styleNumber=${encodeURIComponent(style)}`
            ),
            grab(`${TDT_PROXY}/api/pricing-bundle?method=CAP-AL`),
            code('CAPS-SHIP-FLAT'),
            code('CAPS-SHIP-FREE-OVER'),
        ]);
        if (!Array.isArray(capBundle.tiersR) || !capBundle.tiersR.length) {
            throw new Error(`No cap pricing tiers for style ${style}`);
        }
        // OSFA-only store (v1): a fitted cap (S/M-M/L-L/XL) reaching this point is
        // a catalog-seeding mistake — refuse it visibly rather than mis-price.
        const hasOsfa = (capBundle.sizes || []).some(
            (s) =>
                String(s && s.size)
                    .trim()
                    .toUpperCase() === 'OSFA' && parseFloat(s.price) > 0
        );
        if (!hasOsfa) {
            throw Object.assign(
                new Error(
                    `Style ${style} has no OSFA blank price (fitted caps are not sold on Custom Hats)`
                ),
                { code: 'STYLE_NOT_ALLOWED' }
            );
        }
        const value = {
            capBundle,
            capAlBundle,
            config: { shipFlat, shipFreeOver, sizes: ['OSFA'] },
        };
        _capsCfgCache.set(style, { at: Date.now(), value });
        return value;
    }

    // Curated caps catalog — Caspio table CAPS_Catalog_2026 (one row per
    // style+hero-color, displayOrder + is_active) is the system of record,
    // served by the proxy route GET /api/caps/catalog. Until that proxy route
    // ships (follow-up — clone of dtg-top-sellers.js), the registry-pinned
    // CAPS_FALLBACK_LINEUP below mirrors the seeded rows so checkout works; the
    // fallback logs LOUDLY and only whitelists styles/names (every PRICE still
    // comes fail-closed from the APIs above). When the route goes live, Caspio
    // takes over automatically — no deploy.
    const CAPS_FALLBACK_LINEUP = [
        { style: '112', product_title: 'Richardson Trucker Cap 112' },
        { style: 'C402', product_title: 'Port Authority Snapback Trucker Cap. C402' },
        { style: '112PFP', product_title: 'Richardson Printed Five-Panel Trucker 112PFP' },
        { style: '256', product_title: 'Richardson Umpqua Gramps Cap 256' },
        { style: '258', product_title: 'Richardson 5-Panel Classic Rope Cap 258' },
        { style: '220', product_title: 'Richardson Relaxed Performance Lite 220' },
        { style: 'C914', product_title: 'Port Authority Six-Panel Unstructured Twill Cap. C914' },
        { style: 'STC26', product_title: 'Sport-Tek PosiCharge RacerMesh Cap. STC26' },
        { style: 'CT105298', product_title: 'Carhartt Canvas Mesh Back Cap CT105298' },
    ];

    let _capsCatalogCache = null;

    let _capsCatalogAt = 0;

    async function getCapsCatalog() {
        if (_capsCatalogCache && Date.now() - _capsCatalogAt < 60 * 60 * 1000)
            return _capsCatalogCache;
        const map = new Map();
        try {
            const r = await fetch(`${TDT_PROXY}/api/caps/catalog`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            const rows = Array.isArray(j) ? j : j.records || j.data || j.styles || [];
            rows.forEach((row) => {
                if (!row || row.is_active === false) return;
                const k = String(row.style || row.styleNumber || '').toUpperCase();
                if (k && !map.has(k)) map.set(k, row);
            });
            if (!map.size) throw new Error('caps catalog returned no active styles');
        } catch (e) {
            console.warn(
                `[Custom Caps] catalog API unavailable (${e.message}) — using the registry-pinned 9-style lineup (styles/names only; all pricing stays API-fed)`
            );
            map.clear();
            CAPS_FALLBACK_LINEUP.forEach((row) => map.set(row.style.toUpperCase(), row));
        }
        _capsCatalogCache = map;
        _capsCatalogAt = Date.now();
        return map;
    }

    // Rebuild the full Custom-Hats quote server-side (authoritative). Same shape
    // contract as rebuildCtsQuote so the shared checkout route consumes it
    // unchanged: { quote, tax, config, shipping, style, rush, sizes, productName }
    // plus the caps facts (backLogo) stampedOrderSettings reads.
    async function rebuildCapsQuote(colorConfigs, orderSettings, customerData) {
        const styleRaw = orderSettings && orderSettings.styleNumber;
        const style = String(styleRaw || '')
            .trim()
            .toUpperCase();
        const catalog = await getCapsCatalog();
        if (!catalog.has(style)) {
            throw Object.assign(
                new Error(`Style ${styleRaw || '(none)'} is not in the Custom Hats catalog`),
                { code: 'STYLE_NOT_ALLOWED' }
            );
        }
        const product = catalog.get(style);

        // NO rush on caps v1 (registry rushEligible is []) — digitizing + proof
        // approval make a 3-day promise unsafe. A doctored rush flag 400s.
        if (orderSettings && orderSettings.rush) {
            throw Object.assign(new Error('Rush service is not available for Custom Hats'), {
                code: 'RUSH_NOT_ELIGIBLE',
            });
        }

        const { capBundle, capAlBundle, config } = await getCapsPricingConfig(style);
        const tax = await resolveTdtTax(customerData);

        // Back logo: a server-recognized FLAG (true, or an uploaded-file object) —
        // pricing keys on the server's reading, never on client prices.
        const bl = orderSettings && orderSettings.backLogo;
        const backLogo = bl === true || !!(bl && typeof bl === 'object' && (bl.fileUrl || bl.url));

        // OSFA-only cart: one quantity per color (sizeWhitelist is ['OSFA'], so an
        // unknown size key can neither inflate the tier nor ride along unpriced).
        const cart = Object.values(colorConfigs || {})
            .map((c) => {
                const sd = (c && c.sizeBreakdown) || {};
                const q = parseInt(sd.OSFA && sd.OSFA.quantity, 10) || 0;
                return {
                    catalogColor: c && c.catalogColor,
                    colorName: (c && (c.displayColor || c.catalogColor)) || '',
                    quantity: q,
                };
            })
            .filter((c) => c.catalogColor && c.quantity > 0);
        const method = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';

        // The module enforces the 8-cap minimum (BELOW_MINIMUM, mapped to 400 by
        // the checkout route) and the CeilDollar EMB-cap chain; shipping is the
        // CAPS-SHIP-* threshold model. NOTE: with the launch $100 threshold every
        // ≥8-cap order ships free — Erik tunes CAPS-SHIP-FREE-OVER in Caspio.
        const quote = CAPS_PRICING.quote({
            capBundle,
            capAlBundle,
            config,
            cart,
            backLogo,
            delivery: { method, taxRate: tax.rate },
        });
        const shipResolved =
            method === 'pickup'
                ? { amount: 0, source: 'pickup' }
                : {
                      amount: quote.shipping,
                      source: quote.shipping > 0 ? 'flat-under-threshold' : 'free-over-threshold',
                  };
        return {
            quote,
            tax,
            config,
            shipping: shipResolved,
            style,
            rush: false,
            backLogo,
            sizes: config.sizes,
            productName: product.product_title || product.productName || `${style} Cap`,
        };
    }

    return { rebuildCapsQuote };
};
