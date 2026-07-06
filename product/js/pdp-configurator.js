/**
 * pdp-configurator.js — the 3-question decoration configurator on the
 * customer product page (root /product.html). Phase 1 of the customer
 * quote-cart project (customer-redesign decisions #17 + #18).
 *
 *   Q1  How many?            qty stepper (default 24, min 1, ±6)
 *   Q2  Where does it go?    placement chips (garments: Left chest / Full
 *                            front / Back / Front + back · caps: Front /
 *                            Front + back) + SCP ink-colors stepper (1-4,
 *                            asked once — applies to both placements)
 *   Q3  Pick a look          one PRICED chip per eligible decoration method
 *
 * IRON RULE: every price comes from QuoteCartEngine.singleItemPreview()
 * (shared_components/js/quote-cart-engine.js) — the same authorities the
 * staff quote builders use. This module computes ZERO prices of its own.
 * The "See every quantity price" matrix uses the same shared pricing-service
 * ladders the old pricing tabs used (display-only, per the product page's
 * established convention).
 *
 * Two locations are priced exactly; anything fancier (sleeves, names,
 * 3rd logos, 3D puff, oversize stitches) is "add it in notes — rep prices
 * it on the proof" (decision #18). Every total carries the universal
 * footer: "Final pricing confirmed with your free proof."
 *
 * Failure posture (Erik's #1 rule — never a silent wrong/stale price):
 *   - one method's authority fails → THAT chip shows a visible error state
 *     ("pricing unavailable — tap to retry"); other chips keep working.
 *   - ALL methods fail → alert-error with a Retry button.
 *   - a method can't do the chosen placement → chip stays rendered in a
 *     "not available for this placement" state (no layout jumps).
 *
 * Public API (consumed by product/js/product-2026.js):
 *   PdpConfigurator.init(ctx)      ctx = { style, isCap, productName,
 *                                    eligibility, getColor(), onChange() }
 *   PdpConfigurator.setColor()     re-price after a swatch change (EMB
 *                                    prices per color via /api/size-pricing)
 *   PdpConfigurator.getSelection() current selection for the quote CTA
 */
(function () {
    'use strict';

    // ============================================================
    // UTILS (page-local copies — this module is self-contained)
    // ============================================================
    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        const n = Number(value);
        if (value == null || isNaN(n)) return '—';
        return '$' + n.toFixed(2);
    }

    function num(v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }

    function r2(v) {
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }

    /** "24-47" → {min:24,max:47} · "72+" → {min:72,max:Infinity} */
    function parseRange(label) {
        const m = String(label || '').match(/^(\d+)\s*-\s*(\d+)/);
        if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        const p = String(label || '').match(/^(\d+)\s*\+/);
        if (p) return { min: parseInt(p[1], 10), max: Infinity };
        return { min: 0, max: Infinity };
    }

    /** Standard display size: S, else OSFA, else first — mirrors the pricing services. */
    function pickStdSize(sizes) {
        const list = (sizes || []).filter(Boolean);
        return list.find(function (s) { return String(s).toUpperCase() === 'S'; })
            || list.find(function (s) { return String(s).toUpperCase() === 'OSFA'; })
            || list[0]
            || null;
    }

    function alertHtml(kind, title, msg) {
        return '<div class="alert alert-' + kind + '"' + (kind === 'error' ? ' role="alert"' : '') + '>'
            + '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">'
            + '<path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>'
            + '<div class="alert-body"><strong class="alert-title">' + escapeHtml(title) + '</strong>'
            + '<p>' + escapeHtml(msg) + '</p></div></div>';
    }

    // ============================================================
    // SHARED EMB CALCULATOR SINGLETON
    // The engine constructs its EMB authority per pricing call; handing it
    // this factory keeps ONE EmbroideryPricingCalculator alive so its
    // promise-cached initializeConfig()/initializeCapConfig() and per-style
    // size-pricing cache survive across qty/location changes (same instance
    // semantics as the staff builder's page-lifetime calculator).
    // ============================================================
    let sharedEmbCalc = null;
    function SharedEmbCalc(opts) {
        if (!sharedEmbCalc) {
            sharedEmbCalc = new window.EmbroideryPricingCalculator(opts || { skipInit: true });
        }
        return sharedEmbCalc; // constructor-return overrides `this`
    }
    function resetEmbCalc() { sharedEmbCalc = null; }

    function engineDeps() {
        const deps = {};
        if (window.EmbroideryPricingCalculator) deps.EmbroideryPricingCalculator = SharedEmbCalc;
        return deps;
    }

    // ============================================================
    // PLACEMENTS
    // "Front + back" = left-chest-size front + full back — the exact combo
    // every staff authority prices natively (EMB primary+AL · DTG LC_FB ·
    // SCP front+additional · DTF small+large). Decision #18.
    // ============================================================
    const GARMENT_LOCATIONS = [
        { key: 'leftChest', label: 'Left chest', sub: 'Logo size' },
        { key: 'centerFront', label: 'Center front', sub: 'Medium print ≤9×12' },
        { key: 'fullFront', label: 'Full front', sub: 'Big center print' },
        { key: 'back', label: 'Back', sub: 'Full back' },
        { key: 'centerBack', label: 'Center back', sub: 'Medium print ≤9×12' },
        { key: 'frontBack', label: 'Front + back', sub: 'Left chest + full back' }
    ];
    const CAP_LOCATIONS = [
        { key: 'front', label: 'Front', sub: 'Front logo' },
        { key: 'frontBack', label: 'Front + back', sub: 'Front + back logos' }
    ];

    const DTG_CODES = { leftChest: 'LC', fullFront: 'FF', back: 'FB', frontBack: 'LC_FB' };
    const DTF_KEYS = {
        leftChest: { locations: ['left-chest'], sizeKeys: ['small'] },
        centerFront: { locations: ['center-front'], sizeKeys: ['medium'] },
        fullFront: { locations: ['full-front'], sizeKeys: ['large'] },
        back: { locations: ['full-back'], sizeKeys: ['large'] },
        centerBack: { locations: ['center-back'], sizeKeys: ['medium'] },
        frontBack: { locations: ['left-chest', 'full-back'], sizeKeys: ['small', 'large'] }
    };

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        ctx: null,          // init() context from product-2026.js
        methods: [],        // [{id}] eligible, in display order
        qty: 24,
        loc: null,          // placement key
        ink: 1,             // SCP ink colors (asked once — front AND back)
        scpStripes: false,  // SCP safety-stripes upcharge (Caspio Service_Codes SP-STRIPE, +$2/pc/location)
        scpStripeFee: 0,    // captured from the engine preview so the matrix uses the API fee, not a constant
        method: null,       // selected method id
        results: {},        // id -> { status:'loading'|'ok'|'unavailable'|'belowmin'|'error', preview, summary, message }
        matrixOpen: false,
        seq: {},            // per-method reprice tokens (stale-result guard) — id -> counter
        qtyTimer: null,
        matrixCache: {},    // 'method|loc|ink' -> matrix model
        initialized: false
    };

    const prepCache = {}; // methodId -> Promise<prep>

    // ============================================================
    // METHOD DEFINITIONS
    // engineMethod/groups feed QuoteCartEngine; prepare() resolves the
    // method's shared-service bundle (sessionStorage-cached) for the
    // standard size + the display-only tier matrix.
    // ============================================================
    const METHODS = {
        emb: {
            label: 'Embroidery',
            short: 'Emb',       // mobile sticky-bar label (tight space)
            engineMethod: 'EMB',
            supports: { leftChest: true, fullFront: false, back: true, frontBack: true },
            chipNote: function (loc) {
                return loc === 'frontBack' ? 'Two stitched logos — 10K each' : 'Stitched logo up to 10K — included';
            },
            groups: function (loc) {
                const primary = {
                    position: loc === 'back' ? 'Back' : 'Left Chest',
                    stitchCount: 8000,
                    needsDigitizing: false
                };
                const additional = loc === 'frontBack'
                    ? [{ position: 'Back', stitchCount: 8000, needsDigitizing: false }]
                    : [];
                return { 'emb:garment': { logos: { primary: primary, additional: additional } } };
            },
            prepare: prepareEmb
        },
        capemb: {
            label: 'Embroidery',
            short: 'Emb',
            engineMethod: 'CAP',
            isCap: true,
            supports: { front: true, frontBack: true },
            chipNote: function (loc) {
                return loc === 'frontBack' ? 'Front + back logos included' : 'Front logo up to 10K — included';
            },
            groups: function (loc) {
                const additional = loc === 'frontBack'
                    ? [{ position: 'Cap Back', stitchCount: 5000, needsDigitizing: false }]
                    : [];
                return {
                    'emb:cap': {
                        logos: {
                            primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false },
                            additional: additional
                        }
                    }
                };
            },
            prepare: prepareCapEmb
        },
        dtg: {
            label: 'DTG Print',
            short: 'DTG',
            engineMethod: 'DTG',
            supports: { leftChest: true, fullFront: true, back: true, frontBack: true },
            chipNote: function () {
                return state.ctx && state.ctx.dtgBlendWarn
                    ? 'Blend fabric — softer, vintage print'
                    : 'Full color — no color limits';
            },
            groups: function (loc) {
                return { 'dtg:main': { locationCode: DTG_CODES[loc] } };
            },
            prepare: prepareDtg
        },
        scp: {
            label: 'Screen Print',
            short: 'Screen',
            engineMethod: 'SCP',
            supports: { leftChest: true, fullFront: true, back: true, frontBack: true },
            chipNote: function (loc) {
                const inks = state.ink + '-color ink';
                return loc === 'frontBack' ? inks + ', both sides' : inks + ' print';
            },
            groups: function (loc) {
                return {
                    'scp:design-1': {
                        frontColors: state.ink,
                        backColors: loc === 'frontBack' ? state.ink : 0,
                        darkGarment: false,
                        safetyStripes: state.scpStripes
                    }
                };
            },
            prepare: prepareScp
        },
        dtf: {
            label: 'DTF Transfer',
            short: 'DTF',
            engineMethod: 'DTF',
            // Center-front / Center-back = the DTF MEDIUM (<=9x12) transfer band; DTF-only via
            // supports (DTG/SCP/EMB never list them, so the chips render for DTF alone).
            supports: { leftChest: true, centerFront: true, fullFront: true, back: true, centerBack: true, frontBack: true },
            chipNote: function () { return 'Full-color transfer — great on blends'; },
            groups: function (loc) {
                return { 'dtf:main': { locations: DTF_KEYS[loc].locations } };
            },
            prepare: prepareDtf
        }
    };

    // ============================================================
    // PREPARE (per-method shared-service bundles + tier matrices)
    // ============================================================
    function tierFromRow(t) {
        return {
            label: t.TierLabel,
            min: num(t.MinQuantity) || parseRange(t.TierLabel).min,
            max: t.MaxQuantity != null && num(t.MaxQuantity) > 0 ? num(t.MaxQuantity) : parseRange(t.TierLabel).max,
            ltmFee: num(t.LTM_Fee)
        };
    }

    /** Flat embroidery — EmbroideryPricingService ladder (+ per-tier AL for front+back). */
    async function prepareEmb() {
        if (typeof EmbroideryPricingService === 'undefined') throw new Error('EmbroideryPricingService not loaded');
        const svc = new EmbroideryPricingService();
        const b = await svc.fetchPricingData(state.ctx.style);
        if (!b || !b.pricing) throw new Error('Empty embroidery pricing bundle');
        const std = pickStdSize(b.uniqueSizes);
        const tiers = (b.tierData || []).slice()
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(function (t) {
                const row = tierFromRow(t);
                row.base = b.pricing[t.TierLabel] ? b.pricing[t.TierLabel][std] : null;
                return row;
            });
        if (tiers.length === 0) throw new Error('No embroidery tiers returned');
        let alPricing = null;

        return {
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            buildMatrix: async function (loc) {
                const alByLabel = {};
                if (loc === 'frontBack') {
                    // Per-tier AL (additional location) cost from /api/al-pricing —
                    // the same authority the engine's EMB adapter ends up using.
                    if (!alPricing) alPricing = await svc.fetchALPricing();
                    for (let i = 0; i < tiers.length; i++) {
                        const rep = Math.max(tiers[i].min, 1);
                        const al = await svc.calculateALPrice(rep, 8000, 'garment', alPricing);
                        alByLabel[tiers[i].label] = al.unitPrice; // unitPrice ONLY — its ltmFee would double-count
                    }
                }
                return {
                    note: loc === 'frontBack'
                        ? 'Per-piece price includes the garment plus TWO embroidered logos (left chest + back), up to 10,000 stitches each.'
                        : 'Per-piece price includes the garment plus an embroidered logo up to 10,000 stitches ('
                            + (loc === 'back' ? 'back' : 'left chest') + ').',
                    foot: 'Larger logos and extra locations are quoted per design.',
                    stdSize: std,
                    multiSize: (b.uniqueSizes || []).length > 1,
                    tiers: tiers.map(function (t) {
                        return {
                            label: t.label, min: t.min, max: t.max, ltmFee: t.ltmFee,
                            price: t.base != null ? r2(t.base + (alByLabel[t.label] || 0)) : null
                        };
                    })
                };
            }
        };
    }

    /** Cap embroidery — CapEmbroideryPricingService ladder (+ per-tier cap AL for front+back). */
    async function prepareCapEmb() {
        if (typeof CapEmbroideryPricingService === 'undefined') throw new Error('CapEmbroideryPricingService not loaded');
        if (typeof EmbroideryPricingService === 'undefined') throw new Error('EmbroideryPricingService not loaded');
        const svc = new CapEmbroideryPricingService();
        const alSvc = new EmbroideryPricingService(); // calculateALPrice('cap') lives here
        const b = await svc.fetchPricingData(state.ctx.style);
        if (!b || !b.pricing) throw new Error('Empty cap pricing bundle');
        const std = pickStdSize(b.uniqueSizes);
        const tiers = (b.tierData || []).slice()
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(function (t) {
                const row = tierFromRow(t);
                row.base = b.pricing[t.TierLabel] ? b.pricing[t.TierLabel][std] : null;
                return row;
            });
        if (tiers.length === 0) throw new Error('No cap tiers returned');
        let alPricing = null;

        return {
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            buildMatrix: async function (loc) {
                const alByLabel = {};
                if (loc === 'frontBack') {
                    if (!alPricing) alPricing = await alSvc.fetchALPricing();
                    for (let i = 0; i < tiers.length; i++) {
                        const rep = Math.max(tiers[i].min, 1);
                        // Cap back logo = cap AL at its 5,000-stitch included base
                        const al = await alSvc.calculateALPrice(rep, 5000, 'cap', alPricing);
                        alByLabel[tiers[i].label] = al.unitPrice;
                    }
                }
                return {
                    note: loc === 'frontBack'
                        ? 'Per-cap price includes a front logo (up to 10,000 stitches) plus a back logo.'
                        : 'Per-cap price includes an embroidered front logo up to 10,000 stitches.',
                    foot: 'Side logos, 3D puff, and leather patches are quoted per design.',
                    stdSize: std,
                    multiSize: (b.uniqueSizes || []).length > 1,
                    tiers: tiers.map(function (t) {
                        return {
                            label: t.label, min: t.min, max: t.max, ltmFee: t.ltmFee,
                            price: t.base != null ? r2(t.base + (alByLabel[t.label] || 0)) : null
                        };
                    })
                };
            }
        };
    }

    /** DTG — DTGPricingService ladder for the placement's native location code. */
    async function prepareDtg() {
        if (typeof DTGPricingService === 'undefined') throw new Error('DTGPricingService not loaded');
        const svc = new DTGPricingService();
        const data = await svc.fetchPricingData(state.ctx.style);
        if (!data || !data.sizes || data.sizes.length === 0) throw new Error('Empty DTG pricing bundle');
        const std = pickStdSize(data.sizes.map(function (s) { return s.size; }));

        return {
            stdSize: std,
            multiSize: data.sizes.length > 1,
            buildMatrix: async function (loc) {
                const rows = svc.calculateAllTierPricesForLocation(data, DTG_CODES[loc]);
                if (!rows || rows.length === 0) throw new Error('No DTG tiers returned');
                const locName = {
                    leftChest: 'left-chest size', fullFront: 'full-front', back: 'full-back',
                    frontBack: 'left chest + full back'
                }[loc];
                return {
                    note: 'Per-piece price includes the garment plus a full-color DTG print (' + locName + ').',
                    foot: 'Photo-quality, no color limits. DTG color availability is confirmed on your proof.',
                    stdSize: std,
                    multiSize: data.sizes.length > 1,
                    tiers: rows.map(function (r) {
                        const range = parseRange(r.label);
                        return {
                            label: r.label, min: range.min, max: range.max,
                            price: r.basePrices ? r.basePrices[std] : null,
                            ltmFee: num(r.ltmFee)
                        };
                    })
                };
            }
        };
    }

    /** Screen print — bundle finalPrices ladder at the chosen ink count (+ additional-location matrix for front+back). */
    async function prepareScp() {
        if (typeof ScreenPrintPricingService === 'undefined') throw new Error('ScreenPrintPricingService not loaded');
        const svc = new ScreenPrintPricingService();
        const b = await svc.fetchPricingData(state.ctx.style);
        if (!b || !b.finalPrices || !b.finalPrices.PrimaryLocation) throw new Error('Empty screen print bundle');
        const std = pickStdSize(b.uniqueSizes);
        const tiers = Object.keys(b.tierData || {})
            .map(function (label) { return b.tierData[label]; })
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(tierFromRow);
        if (tiers.length === 0) throw new Error('No screen print tiers returned');
        const setup = num(b.screenSetupFeePerScreen);

        return {
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            buildMatrix: async function (loc, ink) {
                const cc = String(ink);
                const addl = b.additionalLocationPricing && b.additionalLocationPricing[cc];
                // Safety stripes are a flat per-piece adder ($2 × print locations) — the same
                // number on every tier. state.scpStripeFee is the API value captured from the
                // last engine preview (falls back to $2 only if the preview hasn't run yet).
                // Use ?? semantics, not ||, so a legitimate $0 stripe fee from the API
                // isn't treated as "missing" and replaced with the $2 fallback.
                const stripePer = state.scpStripeFee != null ? num(state.scpStripeFee) : 2;
                const stripeAdder = state.scpStripes ? stripePer * (loc === 'frontBack' ? 2 : 1) : 0;
                const rows = tiers.map(function (t) {
                    const cell = b.finalPrices.PrimaryLocation[t.label];
                    let price = cell && cell[cc] ? cell[cc][std] : null;
                    if (loc === 'frontBack' && price != null) {
                        const aRow = addl && (addl.tiers || []).find(function (x) {
                            return t.min >= x.minQty && t.min <= x.maxQty;
                        });
                        price = (aRow && typeof aRow.pricePerPiece === 'number')
                            ? r2(price + aRow.pricePerPiece) : null;
                    }
                    if (price != null && stripeAdder) price = r2(price + stripeAdder);
                    return { label: t.label, min: t.min, max: t.max, price: price, ltmFee: t.ltmFee };
                });
                const screens = loc === 'frontBack' ? ink * 2 : ink;
                return {
                    note: 'Per-piece price includes the garment plus a ' + ink + '-color print'
                        + (loc === 'frontBack' ? ' on the front AND back' : '')
                        + (stripeAdder ? ', plus safety stripes' : '') + '.',
                    foot: 'Plus a one-time screen setup of ' + formatPrice(setup) + ' per screen ('
                        + screens + ' screen' + (screens === 1 ? '' : 's') + ' for this design). '
                        + 'Dark garments may need a white underbase screen — confirmed on your proof.',
                    stdSize: std,
                    multiSize: (b.uniqueSizes || []).length > 1,
                    tiers: rows
                };
            }
        };
    }

    /** DTF — DTFPricingService ladder for the placement's transfer size(s). */
    async function prepareDtf() {
        if (typeof DTFPricingService === 'undefined') throw new Error('DTFPricingService not loaded');
        const svc = new DTFPricingService();
        const data = await svc.fetchPricingData(state.ctx.style);
        const rawSizes = (data && data.raw && data.raw.sizes) || [];
        if (rawSizes.length === 0) throw new Error('DTF bundle missing garment sizes');
        const sorted = rawSizes.slice().sort(function (a, z) {
            return (a.sortOrder || Infinity) - (z.sortOrder || Infinity);
        });
        const stdEntry = sorted.find(function (s) { return String(s.size).toUpperCase() === 'S'; }) || sorted[0];
        const garmentCost = num(stdEntry.price);
        if (!(garmentCost > 0)) throw new Error('DTF bundle missing garment cost');

        return {
            stdSize: stdEntry.size,
            multiSize: rawSizes.length > 1,
            buildMatrix: async function (loc) {
                const keys = DTF_KEYS[loc].sizeKeys;
                const rows = svc.calculateAllTierPrices(garmentCost, data, keys[0], keys[1] || null);
                if (!rows || rows.length === 0) throw new Error('No DTF tiers returned');
                const locName = {
                    leftChest: 'left-chest size', fullFront: 'full-front', back: 'full-back',
                    frontBack: 'left chest + full back'
                }[loc];
                return {
                    note: 'Per-piece price includes the garment plus full-color DTF transfer(s) — ' + locName
                        + '. Great on blends and dark garments.',
                    foot: 'Other placements and transfer sizes are quoted per design.',
                    stdSize: stdEntry.size,
                    multiSize: rawSizes.length > 1,
                    tiers: rows.map(function (r) {
                        const range = parseRange(r.label);
                        return { label: r.label, min: range.min, max: range.max, price: r.basePrice, ltmFee: num(r.ltmFee) };
                    })
                };
            }
        };
    }

    function prep(methodId) {
        if (!prepCache[methodId]) {
            prepCache[methodId] = METHODS[methodId].prepare().catch(function (e) {
                delete prepCache[methodId]; // allow retry to refetch
                throw e;
            });
        }
        return prepCache[methodId];
    }

    // ============================================================
    // PRICING (engine calls)
    // ============================================================
    function buildItem(def, prepData) {
        const color = (state.ctx.getColor && state.ctx.getColor()) || {};
        const sizes = {};
        sizes[prepData.stdSize] = state.qty;
        return {
            id: '__cfg__',
            method: def.engineMethod,
            styleNumber: state.ctx.style,
            title: state.ctx.productName,
            colorName: color.name || '',
            catalogColor: color.catalog || '',
            isCap: def.isCap === true,
            sizes: sizes
        };
    }

    /** All-in per-piece (everything that scales with qty, incl. LTM share) — one-time fees excluded. */
    function summarize(preview) {
        const fees = preview.fees || [];
        const oneTime = fees.reduce(function (s, f) { return s + (f.oneTime ? f.amount : 0); }, 0);
        const qty = preview.itemQuantity || state.qty;
        return {
            total: preview.groupTotal,
            perPiece: r2((preview.groupTotal - oneTime) / qty),
            oneTimeFees: fees.filter(function (f) { return f.oneTime; }),
            ltm: preview.ltm || { fee: 0 },
            nudge: preview.nudge || null,
            serviceLines: preview.serviceLines || [],
            tierLabel: preview.tierLabel,
            warnings: preview.warnings || []
        };
    }

    /** Bump and return this method's reprice token. Per-method so a single-method
     *  re-price (setInk/setStripes/retryMethod) invalidates only its own in-flight
     *  request — never a sibling method mid-flight from a concurrent repriceAll. */
    function nextSeq(id) {
        state.seq[id] = (state.seq[id] || 0) + 1;
        return state.seq[id];
    }

    async function priceMethod(id, token) {
        const def = METHODS[id];
        state.results[id] = { status: 'loading' };
        renderMethodChip(id);
        if (id === state.method) renderTotal();

        try {
            if (!def.supports[state.loc]) {
                state.results[id] = { status: 'unavailable' };
            } else if (!window.QuoteCartEngine) {
                throw new Error('Pricing engine not loaded');
            } else {
                const prepData = await prep(id);
                if (token !== state.seq[id]) return;
                const preview = await window.QuoteCartEngine.singleItemPreview(
                    buildItem(def, prepData),
                    { groups: def.groups(state.loc), deps: engineDeps(), nudge: true }
                );
                if (token !== state.seq[id]) return;
                if (!preview.ok) {
                    if (preview.error && preview.error.code === 'BELOW_MINIMUM') {
                        state.results[id] = {
                            status: 'belowmin',
                            message: preview.error.message,
                            minQuantity: preview.error.minQuantity
                        };
                    } else {
                        throw new Error((preview.error && preview.error.message) || 'Pricing failed');
                    }
                } else {
                    state.results[id] = { status: 'ok', preview: preview, summary: summarize(preview) };
                    if (id === 'scp' && preview.trace && preview.trace.fees && preview.trace.fees.stripe != null) {
                        state.scpStripeFee = preview.trace.fees.stripe; // API stripe fee → matrix uses it, not a constant
                    }
                }
            }
        } catch (err) {
            if (token !== state.seq[id]) return;
            console.error('[pdp-configurator] Pricing failed for ' + id + ':', err);
            state.results[id] = { status: 'error', message: err.message };
            if (id === 'emb' || id === 'capemb') resetEmbCalc(); // un-poison a failed init for retry
        }

        if (token !== state.seq[id]) return;
        renderMethodChip(id);
        renderAllFailedAlert();
        if (id === state.method) renderTotal();
        notifyChange();
    }

    function repriceAll() {
        ensureSelectedSupported();
        state.methods.forEach(function (m) { priceMethod(m.id, nextSeq(m.id)); });
        renderMatrix(); // re-renders only if open
    }

    function retryMethod(id) {
        delete prepCache[id];
        if (id === 'emb' || id === 'capemb') resetEmbCalc();
        priceMethod(id, nextSeq(id));
        renderMatrix();
    }

    /** If the selected method can't do the new placement, hop to the first that can. */
    function ensureSelectedSupported() {
        const def = METHODS[state.method];
        if (def && def.supports[state.loc]) return;
        const next = state.methods.find(function (m) { return METHODS[m.id].supports[state.loc]; });
        if (next) state.method = next.id;
    }

    // ============================================================
    // RENDER — placement chips + ink stepper
    // ============================================================
    function currentLocations() {
        return state.ctx.isCap ? CAP_LOCATIONS : GARMENT_LOCATIONS;
    }

    function renderLocations() {
        const row = $('cfgLocations');
        row.innerHTML = currentLocations().map(function (l) {
            const on = l.key === state.loc;
            return '<button class="pdp-cfg-chip" type="button" data-loc="' + l.key + '"'
                + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
                + '<span class="pdp-cfg-chip-label">' + escapeHtml(l.label) + '</span>'
                + '<span class="pdp-cfg-chip-sub">' + escapeHtml(l.sub) + '</span>'
                + '</button>';
        }).join('');
        Array.prototype.forEach.call(row.querySelectorAll('[data-loc]'), function (btn) {
            btn.addEventListener('click', function () {
                if (btn.dataset.loc === state.loc) return;
                state.loc = btn.dataset.loc;
                state.matrixCache = {};
                renderLocations();
                repriceAll();
            });
        });
    }

    function renderInkRow() {
        const row = $('cfgInkRow');
        const stripeRow = $('cfgStripeRow');
        const eligible = !state.ctx.isCap
            && state.methods.some(function (m) { return m.id === 'scp'; });
        row.hidden = !eligible;
        if (stripeRow) stripeRow.hidden = !eligible;
        if (!eligible) return;
        $('cfgInkInput').value = state.ink;
        if ($('cfgStripeInput')) $('cfgStripeInput').checked = state.scpStripes;
    }

    function setInk(v) {
        const n = Math.min(4, Math.max(1, Math.round(num(v) || 1)));
        if (n === state.ink) { $('cfgInkInput').value = n; return; }
        state.ink = n;
        $('cfgInkInput').value = n;
        // Ink only changes SCP pricing (and its matrix)
        delete state.matrixCache[matrixKey('scp')];
        priceMethod('scp', nextSeq('scp'));
        if (state.method === 'scp') renderMatrix();
        notifyChange();
    }

    function setStripes(on) {
        const v = !!on;
        if (v === state.scpStripes) return;
        state.scpStripes = v;
        if ($('cfgStripeInput')) $('cfgStripeInput').checked = v;
        // Safety stripes only change SCP pricing (and its matrix)
        delete state.matrixCache[matrixKey('scp')];
        priceMethod('scp', nextSeq('scp'));
        if (state.method === 'scp') renderMatrix();
        notifyChange();
    }

    // ============================================================
    // RENDER — qty stepper
    // ============================================================
    function setQty(v, immediate) {
        const n = Math.min(9999, Math.max(1, Math.round(num(v) || 0) || state.qty));
        $('cfgQtyInput').value = n;
        if (n === state.qty) return;
        state.qty = n;
        state.matrixCache = {}; // tier highlight depends on qty; matrices stay valid but re-render
        if (state.qtyTimer) clearTimeout(state.qtyTimer);
        if (immediate) {
            repriceAll();
        } else {
            state.qtyTimer = setTimeout(repriceAll, 350);
        }
    }

    function wireInputs() {
        $('cfgQtyMinus').addEventListener('click', function () { setQty(state.qty - 6, true); });
        $('cfgQtyPlus').addEventListener('click', function () { setQty(state.qty + 6, true); });
        $('cfgQtyInput').addEventListener('input', function () {
            const v = parseInt($('cfgQtyInput').value, 10);
            if (!isNaN(v) && v > 0) setQty(v, false);
        });
        $('cfgQtyInput').addEventListener('blur', function () {
            setQty($('cfgQtyInput').value, false);
        });

        $('cfgInkMinus').addEventListener('click', function () { setInk(state.ink - 1); });
        $('cfgInkPlus').addEventListener('click', function () { setInk(state.ink + 1); });
        $('cfgInkInput').addEventListener('change', function () { setInk($('cfgInkInput').value); });
        const stripeInput = $('cfgStripeInput');
        if (stripeInput) stripeInput.addEventListener('change', function () { setStripes(stripeInput.checked); });

        // Mobile sticky-bar CTA: with a live price it triggers the EXISTING
        // add-to-quote action (#cfgAddToQuote — wired by product-2026.js, so
        // pooling-conflict guards + the toast all run); otherwise it falls
        // through to its default anchor scroll to the configurator.
        const mobileBtn = $('ctaQuoteMobile');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', function (e) {
                const add = $('cfgAddToQuote');
                const res = state.results[state.method];
                if (add && !add.disabled && res && res.status === 'ok') {
                    e.preventDefault();
                    add.click();
                }
            });
        }

        const toggle = $('cfgMatrixToggle');
        toggle.addEventListener('click', function () {
            state.matrixOpen = !state.matrixOpen;
            toggle.setAttribute('aria-expanded', state.matrixOpen ? 'true' : 'false');
            toggle.textContent = state.matrixOpen ? 'Hide the full price table ▴' : 'See every quantity price ▾';
            $('cfgMatrix').hidden = !state.matrixOpen;
            renderMatrix();
        });
    }

    // ============================================================
    // RENDER — method chips
    // ============================================================
    function renderMethods() {
        const wrap = $('cfgMethods');
        wrap.innerHTML = state.methods.map(function (m) {
            return '<button class="pdp-cfg-method" type="button" data-method="' + m.id + '" aria-pressed="false">'
                + '<span class="pdp-cfg-method-name"></span>'
                + '<span class="pdp-cfg-method-price"></span>'
                + '<span class="pdp-cfg-method-note"></span>'
                + '</button>';
        }).join('');
        Array.prototype.forEach.call(wrap.querySelectorAll('[data-method]'), function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.dataset.method;
                const res = state.results[id];
                if (res && res.status === 'error') { retryMethod(id); }
                if (state.method !== id) {
                    state.method = id;
                    state.methods.forEach(renderChipPressed);
                    renderTotal();
                    renderMatrix();
                    notifyChange();
                }
            });
        });
        state.methods.forEach(function (m) { renderMethodChip(m.id); });
    }

    function renderChipPressed(m) {
        const btn = $('cfgMethods') && document.querySelector('[data-method="' + m.id + '"]');
        if (btn) btn.setAttribute('aria-pressed', m.id === state.method ? 'true' : 'false');
    }

    function renderMethodChip(id) {
        const btn = document.querySelector('[data-method="' + id + '"]');
        if (!btn) return;
        const def = METHODS[id];
        const res = state.results[id] || { status: 'loading' };
        btn.classList.remove('is-loading', 'is-unavailable', 'is-error', 'is-belowmin');
        btn.setAttribute('aria-pressed', id === state.method ? 'true' : 'false');

        const nameEl = btn.querySelector('.pdp-cfg-method-name');
        const priceEl = btn.querySelector('.pdp-cfg-method-price');
        const noteEl = btn.querySelector('.pdp-cfg-method-note');
        nameEl.textContent = def.label;

        if (res.status === 'loading') {
            btn.classList.add('is-loading');
            priceEl.innerHTML = '<span class="skeleton pdp-cfg-price-skel" aria-hidden="true"></span>';
            noteEl.textContent = 'Getting your live price…';
        } else if (res.status === 'ok') {
            priceEl.innerHTML = escapeHtml(formatPrice(res.summary.perPiece))
                + '<span class="pdp-cfg-method-per">/pc</span>';
            noteEl.textContent = def.chipNote(state.loc);
        } else if (res.status === 'unavailable') {
            btn.classList.add('is-unavailable');
            priceEl.textContent = 'Not available for this placement';
            noteEl.textContent = 'Ask your rep — add it in your quote notes';
        } else if (res.status === 'belowmin') {
            btn.classList.add('is-belowmin');
            // Per-method minimum from the engine's BELOW_MINIMUM error
            // (DTF 10, screen print 13 — data-derived, never assume one number)
            priceEl.textContent = res.minQuantity
                ? 'Starts at ' + res.minQuantity + ' pieces'
                : 'Below the order minimum';
            noteEl.textContent = 'Bump the quantity to see a price';
        } else {
            btn.classList.add('is-error');
            priceEl.textContent = 'Pricing unavailable';
            noteEl.textContent = 'Tap to retry — or call 253-922-5793';
        }
    }

    function renderAllFailedAlert() {
        const slot = $('cfgAlert');
        if (!slot) return;
        const settled = state.methods.filter(function (m) {
            const r = state.results[m.id];
            return r && r.status !== 'loading';
        });
        const failed = settled.filter(function (m) { return state.results[m.id].status === 'error'; });
        if (settled.length === state.methods.length && failed.length === state.methods.length && state.methods.length > 0) {
            slot.innerHTML = alertHtml('error', 'Unable to load live pricing',
                'Our pricing system is unreachable right now. Please retry, or call 253-922-5793 for a quote — we never guess at prices.')
                + '<button class="btn btn-primary" id="cfgRetryAll" type="button">Retry</button>';
            const retry = $('cfgRetryAll');
            if (retry) retry.addEventListener('click', function () {
                slot.innerHTML = '';
                Object.keys(prepCache).forEach(function (k) { delete prepCache[k]; });
                resetEmbCalc();
                repriceAll();
            });
        } else {
            slot.innerHTML = '';
        }
    }

    // ============================================================
    // RENDER — total block (+ mobile sticky bar, same chokepoint)
    // ============================================================
    /**
     * Single render chokepoint for the selected method's price: every caller
     * (reprice, chip select, ink/stripe change) goes through here, so the
     * mobile sticky bar can never disagree with the total card — same
     * state.results[state.method].summary, zero duplicated math.
     */
    function renderTotal() {
        renderTotalCard();
        renderMobileBar();
    }

    function renderTotalCard() {
        const box = $('cfgTotal');
        const res = state.results[state.method];
        const def = METHODS[state.method];
        if (!def) { box.innerHTML = ''; return; }
        const unitWord = state.ctx.isCap ? 'cap' : 'piece';

        if (!res || res.status === 'loading') {
            box.innerHTML = '<div class="skeleton skeleton-title" aria-hidden="true"></div>'
                + '<div class="skeleton skeleton-text" aria-hidden="true"></div>';
            return;
        }
        if (res.status === 'unavailable') {
            box.innerHTML = '<p class="pdp-cfg-total-msg">' + escapeHtml(def.label)
                + ' isn\'t offered for this placement — pick another look above, or request a quote and your rep will price it on your proof.</p>';
            return;
        }
        if (res.status === 'belowmin') {
            const minTxt = res.minQuantity ? escapeHtml(String(res.minQuantity)) + ' pieces' : 'a higher quantity';
            box.innerHTML = '<p class="pdp-cfg-total-msg"><strong>' + escapeHtml(def.label) + '</strong> starts at <strong>'
                + minTxt + '</strong> — bump the quantity above, or pick another look.</p>';
            return;
        }
        if (res.status === 'error') {
            box.innerHTML = alertHtml('error', 'Unable to load ' + def.label + ' pricing',
                'Live pricing is unavailable right now. Please retry, or call 253-922-5793 — we never guess at prices.')
                + '<button class="btn btn-primary" id="cfgTotalRetry" type="button">Retry</button>';
            const retry = $('cfgTotalRetry');
            if (retry) retry.addEventListener('click', function () { retryMethod(state.method); });
            return;
        }

        const s = res.summary;
        const lines = [];

        // Per-piece service lines folded into the per-piece price (EMB back logo, etc.)
        s.serviceLines.forEach(function (sl) {
            lines.push('<li>Includes ' + escapeHtml(sl.label || sl.code) + ' — '
                + escapeHtml(formatPrice(sl.unitPrice)) + '/' + unitWord + '</li>');
        });

        // One-time fees (SCP screen setup) — outside the per-piece price
        s.oneTimeFees.forEach(function (f) {
            lines.push('<li>One-time ' + escapeHtml(f.label) + ' = ' + escapeHtml(formatPrice(f.amount)) + '</li>');
        });

        // Below-minimum honesty — the method's own billed convention, all-in
        if (s.ltm && s.ltm.fee > 0) {
            lines.push('<li class="is-ltm">' + escapeHtml('$' + Math.round(s.ltm.fee))
                + ' small-batch fee included — ' + escapeHtml(formatPrice(s.perPiece)) + '/' + unitWord + ' all-in</li>');
        }

        // Next-tier dollar-savings nudge. Every figure is the ENGINE's own nudge
        // (trace tierTable + a boosted re-probe INSIDE the same singleItemPreview
        // call — see quote-cart-engine.js computeNudge) — never a parallel
        // calculation, never an extra engine call. The engine returns null unless
        // a higher tier exists AND the per-piece savings are > 0; if the data
        // isn't there yet, no line renders. Clicking jumps the qty to the tier.
        if (s.nudge && s.nudge.nextTierMinQty > state.qty
            && num(s.nudge.nextPerPiece) > 0 && num(s.nudge.perPieceSavings) > 0) {
            const n = s.nudge;
            lines.push('<li class="is-nudge">'
                + '<button class="pdp-cfg-nudge-btn" id="cfgNudgeJump" type="button"'
                + ' aria-label="Set the quantity to ' + n.nextTierMinQty + '">'
                + 'At ' + n.nextTierMinQty + '+ ' + unitWord + 's: '
                + escapeHtml(formatPrice(n.nextPerPiece)) + '/' + unitWord
                + ' — save ' + escapeHtml(formatPrice(n.perPieceSavings)) + '/' + unitWord
                + '</button>'
                + (n.ltmDisappears
                    ? ' <span class="pdp-cfg-nudge-note">(small-batch fee disappears)</span>'
                    : '')
                + '</li>');
        }

        if (state.method === 'dtg' && state.ctx.dtgBlendWarn) {
            lines.push('<li>Cotton-blend garment — DTG prints with a softer, vintage look. We confirm on your proof.</li>');
        }
        if (state.method === 'emb' || state.method === 'capemb') {
            lines.push('<li>New logo? One-time digitizing is confirmed with your proof.</li>');
        }

        const warnHtml = s.warnings.length
            ? alertHtml('warn', 'Heads up', s.warnings.join(' '))
            : '';

        box.innerHTML = warnHtml
            + '<p class="pdp-cfg-total-big">' + escapeHtml(formatPrice(s.total)) + '</p>'
            + '<p class="pdp-cfg-total-sub">for ' + state.qty + ' ' + unitWord + (state.qty === 1 ? '' : 's')
            + ' · ' + escapeHtml(formatPrice(s.perPiece)) + '/' + unitWord
            + ' <span class="pdp-cfg-total-tier">' + escapeHtml(s.tierLabel || '') + ' tier</span></p>'
            + (lines.length ? '<ul class="pdp-cfg-total-lines">' + lines.join('') + '</ul>' : '')
            + '<p class="pdp-delivery-promise" id="cfgDeliveryPromise" style="display:none"></p>'
            + '<p class="pdp-cfg-total-foot">Final pricing confirmed with your free proof.</p>';

        // Delivery promise (BAW adoption #1, 2026-07-06): method-aware ship-by
        // estimate from Service_Codes LEAD-DAYS-*. Fills async; hides on any miss.
        if (window.DeliveryPromise) {
            window.DeliveryPromise.render($('cfgDeliveryPromise'), def.engineMethod);
        }

        const nudgeBtn = $('cfgNudgeJump');
        if (nudgeBtn && s.nudge) {
            const targetQty = s.nudge.nextTierMinQty;
            nudgeBtn.addEventListener('click', function () { setQty(targetQty, true); });
        }
    }

    /**
     * Mobile sticky bar (product.html #mobileCtaBar): mirrors the selected
     * method's LIVE engine summary — "24 × Emb · $14.50/pc · $348.00" — and
     * flips the CTA to "Add to quote". No price yet (loading / error /
     * unavailable / below-min) → the price line hides and the CTA reverts to
     * "Price it" (the original scroll-to-configurator anchor). Reads the SAME
     * res.summary the total card just rendered — never its own math.
     */
    function renderMobileBar() {
        const priceEl = $('cfgMobilePrice');
        const btn = $('ctaQuoteMobile');
        if (!priceEl || !btn) return;
        const def = METHODS[state.method];
        const res = state.results[state.method];
        if (def && res && res.status === 'ok' && res.summary) {
            const s = res.summary;
            priceEl.textContent = state.qty + ' × ' + (def.short || def.label)
                + ' · ' + formatPrice(s.perPiece) + '/pc · ' + formatPrice(s.total);
            priceEl.hidden = false;
            btn.textContent = 'Add to quote';
        } else {
            priceEl.hidden = true;
            priceEl.textContent = '';
            btn.textContent = 'Price it';
        }
    }

    // ============================================================
    // RENDER — "See every quantity price" matrix
    // ============================================================
    function matrixKey(methodId) {
        return methodId + '|' + state.loc + '|' + (methodId === 'scp' ? state.ink + (state.scpStripes ? 'S' : '') : '-');
    }

    // Engine-authoritative price ladder: prices a representative qty in each tier through the
    // SAME QuoteCartEngine.singleItemPreview() the headline uses, so the "see every quantity"
    // matrix can NEVER disagree with the quoted price (the safety-stripe matrix gap is impossible
    // once the matrix IS the engine). Itemized-LTM methods (SCP/EMB) keep the small-order fee on
    // its own row (base is LTM-stripped); baked-LTM methods (DTG/DTF) bake it into the per-piece
    // (ltmFee→0 so no row, no double-count). Mirrors calculators/quick-quote.js. (2026-06-20 audit #1)
    const MATRIX_PROBE_QTYS = {
        emb: [4, 12, 36, 60, 100], capemb: [4, 12, 36, 60, 100],
        // DTG probes qty 6 so the 1-11 small-batch tier appears (quick-quote fixed
        // this in 83c0e3ae; kept in sync so the catalog table isn't missing a tier).
        dtg: [6, 12, 36, 60, 100], scp: [24, 50, 100, 200], dtf: [15, 36, 60, 100]
    };
    async function probeLadder(methodId, loc) {
        const def = METHODS[methodId];
        const prepData = await prep(methodId);
        const probes = MATRIX_PROBE_QTYS[methodId] || [12, 36, 60, 100];
        const byTier = {};
        let lastTierTable = null;   // discovered from the engine's own trace (live Caspio tiers)

        // Probe ONE qty and, if new, record its tier row. Per-tier base rate = everything
        // that scales with qty EXCEPT the one-time setup fees and the flat small-order (LTM)
        // fee (disclosed on its own row). base + ltmFlat/qty === the headline's all-in
        // per-piece EXACTLY for every method — itemized (SCP/EMB) where baseUnit is
        // LTM-stripped AND baked (DTG/DTF) where it isn't — so the matrix can never disagree
        // with the quote. (groupTotal already folds in per-piece service lines: stitch
        // surcharge, AL.) Guarded by `!byTier[label]` → additive only: re-probing an
        // already-seen tier can NEVER overwrite/change its recorded price.
        async function probeQty(pq) {
            const item = buildItem(def, prepData);
            item.sizes = {};
            item.sizes[prepData.stdSize] = pq;
            let preview;
            try {
                preview = await window.QuoteCartEngine.singleItemPreview(item, { groups: def.groups(loc), deps: engineDeps(), nudge: false });
            } catch (e) { preview = null; }
            if (!(preview && preview.ok && preview.lines && preview.lines.length)) return;
            if (preview.trace && preview.trace.tierTable && preview.trace.tierTable.length) {
                lastTierTable = preview.trace.tierTable;
            }
            const label = preview.tierLabel;
            if (!label || byTier[label]) return;
            const oneTimeT = (preview.fees || []).reduce(function (s, f) { return s + (f.oneTime ? (Number(f.amount) || 0) : 0); }, 0);
            const ltmFlat = (preview.ltm && preview.ltm.fee) || 0;
            const range = parseRange(label);
            byTier[label] = {
                label: label, min: range.min, max: range.max,
                price: r2((preview.groupTotal - oneTimeT - ltmFlat) / pq),
                ltmFee: ltmFlat
            };
        }

        // 1) Bootstrap: probe the hardcoded representative qtys (one inside each tier we
        //    KNOW about today). These also make the engine hand back its live tierTable.
        for (let i = 0; i < probes.length; i++) {
            await probeQty(probes[i]);
        }

        // 2) Self-heal against a Caspio tier restructure: probe the min qty of any LIVE
        //    tier the constants didn't already land in, so a re-tiering (added/renamed
        //    tier) can't silently drop a row from the catalog table. Purely additive —
        //    tiers already covered above are skipped by the `!byTier[label]` guard, and a
        //    tier's base is constant within it, so this never changes an existing row.
        if (lastTierTable) {
            const seenMins = {};
            Object.keys(byTier).forEach(function (k) { seenMins[byTier[k].min] = true; });
            const missing = lastTierTable
                .map(function (t) { return Number(t.minQty); })
                .filter(function (m) { return Number.isFinite(m) && m > 0 && !seenMins[m]; })
                .sort(function (a, b) { return a - b; });
            for (let j = 0; j < missing.length; j++) {
                await probeQty(missing[j]);
            }
        }

        return Object.keys(byTier).map(function (k) { return byTier[k]; }).sort(function (a, b) { return a.min - b.min; });
    }

    let matrixSeq = 0;
    async function renderMatrix() {
        if (!state.matrixOpen) return;
        const box = $('cfgMatrix');
        const def = METHODS[state.method];
        if (!def) { box.innerHTML = ''; return; }
        if (!def.supports[state.loc]) {
            box.innerHTML = '<p class="pdp-cfg-total-msg">' + escapeHtml(def.label)
                + ' isn\'t offered for this placement — no price table to show.</p>';
            return;
        }
        const key = matrixKey(state.method);
        const token = ++matrixSeq;
        let model = state.matrixCache[key];
        if (!model) {
            box.innerHTML = '<div class="skeleton skeleton-block" aria-hidden="true"></div>';
            try {
                const prepData = await prep(state.method);
                // Engine-authoritative ladder (single source = the quoted headline). buildMatrix
                // is kept for the note/foot text + as a fallback ladder if the probe yields
                // nothing (engine hiccup → show the prepared ladder rather than erroring).
                const probed = await probeLadder(state.method, state.loc);
                let meta = null;
                try { meta = await prepData.buildMatrix(state.loc, state.ink); } catch (e) { meta = null; }
                const usedEngine = !!(probed && probed.length);
                const tiers = usedEngine ? probed : ((meta && meta.tiers) || []);
                if (!tiers.length) throw new Error('No price tiers returned');
                model = {
                    note: (meta && meta.note) || '',
                    foot: (meta && meta.foot) || '',
                    // Engine probe failed → this ladder is the non-engine fallback, which
                    // can drift from the quoted headline. Flag it so we warn (never show a
                    // silent approximate price as if it were live — Erik's #1 rule).
                    approx: !usedEngine,
                    stdSize: prepData.stdSize,
                    multiSize: prepData.multiSize,
                    tiers: tiers
                };
                state.matrixCache[key] = model;
            } catch (err) {
                if (token !== matrixSeq) return;
                console.error('[pdp-configurator] Matrix failed for ' + state.method + ':', err);
                box.innerHTML = alertHtml('error', 'Unable to load the price table',
                    'Live pricing is unavailable right now. Please retry, or call 253-922-5793.');
                return;
            }
            if (token !== matrixSeq) return;
        }

        const showFeeRow = model.tiers.some(function (t) { return t.ltmFee > 0; });
        const head = model.tiers.map(function (t) {
            return '<th data-min="' + t.min + '" data-max="' + (t.max === Infinity ? '' : t.max) + '">'
                + escapeHtml(t.label) + '</th>';
        }).join('');
        const priceRow = model.tiers.map(function (t) {
            return '<td>' + formatPrice(t.price) + '</td>';
        }).join('');
        const feeRow = showFeeRow ? '<tr><td>Small-order fee</td>' + model.tiers.map(function (t) {
            return '<td>' + (t.ltmFee > 0 ? '+' + formatPrice(t.ltmFee) + ' per order' : '—') + '</td>';
        }).join('') + '</tr>' : '';

        box.innerHTML =
            (model.approx ? '<p class="pdp-panel-note pdp-panel-note--warn" role="status">⚠ Live pricing is temporarily unavailable — this table is approximate. Your free proof confirms exact pricing.</p>' : '')
            + '<p class="pdp-panel-note">' + escapeHtml(model.note) + '</p>'
            + '<div class="table-wrap"><table class="data-table tier-table">'
            + '<thead><tr><th>Quantity</th>' + head + '</tr></thead>'
            + '<tbody><tr><td>Price per ' + (state.ctx.isCap ? 'cap' : 'piece') + '</td>' + priceRow + '</tr>' + feeRow + '</tbody>'
            + '</table></div>'
            + '<p class="pdp-panel-foot">'
            + (model.multiSize ? 'Prices shown for size ' + escapeHtml(model.stdSize) + ' — extended sizes carry a small upcharge. ' : '')
            + escapeHtml(model.foot || '')
            + ' Final pricing confirmed with your free proof.</p>';

        highlightTier(box);
    }

    function highlightTier(scope) {
        const table = scope.querySelector('table');
        if (!table) return;
        const ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
        let activeCol = -1;
        ths.forEach(function (th, col) {
            if (!th.hasAttribute('data-min')) return;
            const min = parseInt(th.getAttribute('data-min'), 10);
            const maxAttr = th.getAttribute('data-max');
            const max = maxAttr === '' ? Infinity : parseInt(maxAttr, 10);
            if (state.qty >= min && state.qty <= max) activeCol = col;
        });
        ths.forEach(function (th, col) { th.classList.toggle('is-active-tier', col === activeCol); });
        Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
            Array.prototype.forEach.call(tr.children, function (td, col) {
                td.classList.toggle('is-active-tier', col === activeCol);
            });
        });
    }

    // ============================================================
    // EMPTY STATE (zero eligible methods — shouldn't happen, never dead-end)
    // ============================================================
    function renderEmpty() {
        const root = $('pdpConfigurator');
        root.hidden = false;
        root.innerHTML = '<div class="empty-state">'
            + '<div class="empty-state-icon" aria-hidden="true">🧵</div>'
            + '<h3 class="empty-state-title">Let\'s price this one personally</h3>'
            + '<p class="empty-state-sub">This garment needs a quick human look to pick the right decoration method — it takes a minute.</p>'
            + '<a class="btn btn-primary" href="tel:253-922-5793">Call 253-922-5793</a> '
            + '<a class="btn btn-ghost" href="mailto:sales@nwcustomapparel.com?subject='
            + encodeURIComponent('Quote request — ' + state.ctx.style) + '">Email for a quote</a>'
            + '</div>';
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    function notifyChange() {
        if (state.ctx && typeof state.ctx.onChange === 'function') state.ctx.onChange();
    }

    /**
     * @param {Object} ctx
     *   style        style number (required)
     *   isCap        cap product → cap placements + cap-embroidery pricing
     *   productName  display name for CTAs
     *   eligibility  DecorationMethods.eligibleFor() result (garments; null for caps)
     *   getColor     () → { name: COLOR_NAME, catalog: CATALOG_COLOR } | null
     *   onChange     () → notify the page (CTA mailto refresh)
     */
    function init(ctx) {
        state.ctx = ctx;
        state.ctx.dtgBlendWarn = !ctx.isCap && ctx.eligibility && ctx.eligibility.DTG === 'warn';
        state.qty = 24;
        state.ink = 1;
        state.scpStripes = false;
        state.scpStripeFee = 0;
        state.loc = ctx.isCap ? 'front' : 'leftChest';
        state.results = {};
        state.matrixCache = {};

        if (ctx.isCap) {
            state.methods = [{ id: 'capemb' }];
        } else {
            const e = ctx.eligibility || { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' };
            state.methods = [
                { id: 'emb', on: e.EMB },
                { id: 'dtg', on: e.DTG !== 'no' },
                { id: 'scp', on: e.SCP },
                { id: 'dtf', on: e.DTF }
            ].filter(function (m) { return m.on; }).map(function (m) { return { id: m.id }; });
        }

        if (state.methods.length === 0) {
            state.initialized = true;
            renderEmpty();
            notifyChange();
            return;
        }

        state.method = state.methods[0].id;
        if (!state.initialized) {
            wireInputs();
        }
        state.initialized = true;
        $('cfgQtyInput').value = state.qty;
        $('pdpConfigurator').hidden = false;
        renderLocations();
        renderInkRow();
        renderMethods();
        repriceAll();
        notifyChange();
    }

    /** Swatch change — EMB prices per color via /api/size-pricing, so re-price. */
    function setColor() {
        if (!state.initialized || !state.ctx || state.methods.length === 0) return;
        repriceAll();
    }

    /** Current selection for the quote CTA (null until init). */
    function getSelection() {
        if (!state.initialized || !state.ctx || !state.method) return null;
        const def = METHODS[state.method];
        const res = state.results[state.method];
        const loc = currentLocations().find(function (l) { return l.key === state.loc; });
        const sel = {
            qty: state.qty,
            locationKey: state.loc,
            locationLabel: loc ? loc.label : '',
            methodId: state.method,
            methodLabel: def ? def.label : '',
            engineMethod: def ? def.engineMethod : null, // 'EMB'|'CAP'|'DTG'|'SCP'|'DTF'
            isCap: !!(def && def.isCap),
            inkColors: state.method === 'scp' ? state.ink : null,
            safetyStripes: state.method === 'scp' ? state.scpStripes : false,
            status: res ? res.status : 'loading',
            price: null,
            sizes: null,
            belowMin: false
        };
        if (res && res.status === 'ok') {
            sel.price = {
                total: res.summary.total,
                perPiece: res.summary.perPiece,
                tierLabel: res.summary.tierLabel,
                oneTimeFees: res.summary.oneTimeFees.map(function (f) {
                    return { label: f.label, amount: f.amount };
                })
            };
            // The exact size breakdown the engine priced (std size only) —
            // the quote cart stores it so its reprices match this preview.
            const inputs = res.preview && res.preview.trace && res.preview.trace.inputs;
            const cfgItem = inputs && inputs.items && inputs.items.filter(function (i) {
                return i.id === '__cfg__';
            })[0];
            if (cfgItem && cfgItem.sizes) sel.sizes = cfgItem.sizes;
        } else if (res && res.status === 'belowmin') {
            sel.belowMin = true;
        }
        return sel;
    }

    window.PdpConfigurator = {
        init: init,
        setColor: setColor,
        getSelection: getSelection
    };
})();
