/**
 * quote-cart-engine.js — PURE orchestration engine for the customer quote cart.
 *
 * Phase 0 of the customer quote-cart project. Design + parity rules:
 *   memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md  (THE bible — worked examples
 *   in that doc are locked by tests/unit/web-quote-cart-parity.test.js)
 *
 * IRON RULE: this module owns ZERO price formulas. Every unit price comes from
 * the SAME authority the staff quote builders use:
 *
 *   EMB / CAP  → the staff EmbroideryPricingCalculator class itself
 *                (shared_components/js/embroidery-quote-pricing.js — Node-loadable,
 *                prices from /api/size-pricing per color, API rounding rules).
 *   DTG        → POST {API}/api/dtg/quote-pricing — the EXACT endpoint the staff
 *                builder submits through (dtg-inline-form.js:4155 → proxy
 *                src/routes/dtg.js:235 → lib/dtg-canonical-pricing.js priceLines()).
 *                Consumed verbatim; never recomputed client-side.
 *   SCP        → ScreenPrintPricingService bundle + EXACT copies of the staff
 *                builder's tier matching (findPricingTier,
 *                screenprint-quote-builder.js:2975-2985) and per-size assembly
 *                (:3139-3152), screens (:108-122), stripes (:3070-3073).
 *                The ONLY replicated math in this file — guarded by a
 *                source-string canary test.
 *   DTF        → DTFPricingService.calculatePriceForQuantity
 *                (dtf-pricing-service.js:369-439) with the staff builder's
 *                upcharge-AFTER-margin convention (dtf-quote-builder.js:1776-1778,
 *                1961-1964) and the builder's garment-cost rule
 *                (min BLANK-bundle size price, dtf-quote-page.js:617-650).
 *
 * What this module DOES own: group partitioning (pooling scope per staff rules),
 * pooled-quantity computation, adapter dispatch, fee assembly via /api/service-codes
 * (visible-warning fallback contract), honest-LTM display math, tier-nudge
 * computation, and a per-group trace object for parity tests/debugging.
 *
 * Pooling scope (mirrors the staff builders EXACTLY — see design doc):
 *   - EMB garments pool together ('emb:garment'); caps pool SEPARATELY
 *     ('emb:cap'); the two never combine for a tier.
 *   - DTG: ONE pool, ONE locationCode for the whole group ('dtg:main').
 *   - SCP: one pool per print DESIGN (groupId 'scp:<design>'), garments+caps
 *     pool together within the design.
 *   - DTF: ONE pool ('dtf:main'), locations uniform across the group.
 *   - Methods NEVER pool with each other.
 *
 * Dual environment: browser global (window.QuoteCartEngine) + require()-able
 * (jest/Node), same pattern as pages/js/custom-caps-pricing.js. Authorities are
 * resolved from options.deps first, then the global scope — the engine never
 * require()s them itself (keeps it loadable in the browser).
 *
 * NO DOM. NO sessionStorage of its own. No customer-visible surface in Phase 0.
 */
(function (global) {
    'use strict';

    var VERSION = '2026.06.11-phase0';

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------
    function QuoteCartError(message, code, extra) {
        var e = new Error(message);
        e.name = 'QuoteCartError';
        e.code = code || 'PRICING_ERROR';
        if (extra) Object.assign(e, extra);
        return e;
    }

    // ------------------------------------------------------------------
    // Structural constants (whitelists / location maps — NOT prices)
    // ------------------------------------------------------------------

    // The 9 priceable DTG location codes — dtg-pricing-service.js:32-42 and
    // caspio-pricing-proxy/lib/dtg-canonical-pricing.js:36-38. The staff UI's
    // FF_JB / JF_FB pills are UNPRICEABLE (server rejects bad_input) and MUST
    // NOT be offered to customers (design doc, DTG risks).
    var DTG_LOCATION_CODES = ['LC', 'FF', 'FB', 'JF', 'JB', 'LC_FB', 'FF_FB', 'JF_JB', 'LC_JB'];

    // DTF location → transfer-size lock + conflict zones. Used only when the
    // DTFConfig authority (dtf-quote-pricing.js:55-77, window.DTFConfig) is not
    // supplied/loaded; values are an exact structural copy of that config.
    var DTF_LOCATIONS_FALLBACK = [
        { value: 'left-chest', size: 'small', zone: 'front' },
        { value: 'right-chest', size: 'small', zone: 'front' },
        { value: 'left-sleeve', size: 'small', zone: 'sleeve-left' },
        { value: 'right-sleeve', size: 'small', zone: 'sleeve-right' },
        { value: 'back-of-neck', size: 'small', zone: 'back' },
        { value: 'center-front', size: 'medium', zone: 'front' },
        { value: 'center-back', size: 'medium', zone: 'back' },
        { value: 'full-front', size: 'large', zone: 'front' },
        { value: 'full-back', size: 'large', zone: 'back' }
    ];
    var DTF_CONFLICT_ZONES = { front: true, back: true }; // one pick per zone; sleeves independent (dtf-quote-pricing.js:73-77)
    var DTF_ZERO_UPCHARGE_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
    var DTF_SIZE_ALIASES = { XXL: '2XL', XXXL: '3XL' }; // dtf-quote-builder.js:2005-2010

    // API-unreachable fee fallbacks ONLY (Erik's Pricing=API rule). Any use is
    // surfaced on result.warnings — the UI must render these as a visible banner.
    var FEE_FALLBACKS = { 'SPSU': 30.00, 'SP-STRIPE': 2.00 };

    var DEFAULT_API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ------------------------------------------------------------------
    // EXACT COPY — screenprint-quote-builder.js:2975-2985 (findPricingTier).
    // Includes the below-lowest-tier fallback (LTM territory) and the
    // above-top-tier clamp (qty > 576 prices at 145-576). Do NOT edit without
    // changing the builder first — the canary test in
    // tests/unit/web-quote-cart-parity.test.js compares this source string
    // against the builder's.
    // ------------------------------------------------------------------
    function findPricingTier(tiers, qty) {
        if (!tiers || tiers.length === 0) return null;
        const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
        const match = sorted.find(t =>
            qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)
        );
        if (match) return match;
        const top = sorted[sorted.length - 1];
        if (qty > (top.maxQty ?? Infinity)) return top;
        return sorted[0];
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    function r2(v) {
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }

    function sumSizes(sizes) {
        var total = 0;
        Object.keys(sizes || {}).forEach(function (k) {
            var q = Number(sizes[k]);
            if (Number.isFinite(q) && q > 0) total += q;
        });
        return total;
    }

    function itemQty(item) {
        return sumSizes(item.sizes);
    }

    function itemColor(item) {
        // COLOR_NAME for pricing/display (two-color-field rule; CATALOG_COLOR is
        // inventory-only and never used for price lookups).
        return item.colorName || item.color || '';
    }

    // ------------------------------------------------------------------
    // Context (per priceCart call — the engine itself keeps no state)
    // ------------------------------------------------------------------
    function makeCtx(options) {
        options = options || {};
        var deps = options.deps || {};
        var fetchImpl = options.fetch || deps.fetch ||
            (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
        return {
            deps: deps,
            fetch: fetchImpl,
            apiBase: options.apiBase || deps.apiBase ||
                (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) ||
                DEFAULT_API_BASE,
            forceRefresh: !!options.forceRefresh,
            warnings: [],
            serviceCodes: undefined, // lazy-loaded
            embCalc: null,           // one EmbroideryPricingCalculator per call
            scpSvc: null,            // one ScreenPrintPricingService per call
            dtfSvc: null             // one DTFPricingService per call
        };
    }

    function resolveDep(ctx, name) {
        return ctx.deps[name] || global[name] || null;
    }

    async function fetchJson(ctx, url) {
        if (!ctx.fetch) throw QuoteCartError('No fetch implementation available', 'NO_FETCH');
        var resp = await ctx.fetch(url);
        if (!resp.ok) {
            throw QuoteCartError('API request failed (' + resp.status + '): ' + url, 'API_ERROR');
        }
        return resp.json();
    }

    // ------------------------------------------------------------------
    // Service-code fees — Caspio Service_Codes via GET /api/service-codes
    // (same source as quote-builder-utils.js loadServiceCodePrices/
    // getServicePrice, :23-48). Fallback constants fire ONLY when the API is
    // unreachable and ALWAYS push a visible warning (Erik's #1 rule).
    // ------------------------------------------------------------------
    async function ensureServiceCodes(ctx) {
        if (ctx.serviceCodes !== undefined) return ctx.serviceCodes;
        try {
            var json = await fetchJson(ctx, ctx.apiBase + '/api/service-codes');
            var map = {};
            (json.data || []).forEach(function (sc) {
                if (sc.ServiceCode) map[String(sc.ServiceCode).toUpperCase()] = sc;
            });
            ctx.serviceCodes = map;
        } catch (e) {
            ctx.serviceCodes = null;
            ctx.warnings.push('Live service fees unavailable (/api/service-codes failed: ' + e.message +
                ') — fallback fee amounts in use. Verify fees before quoting.');
        }
        return ctx.serviceCodes;
    }

    function getFee(ctx, code, fallback) {
        var sc = ctx.serviceCodes && ctx.serviceCodes[String(code).toUpperCase()];
        if (sc) {
            var sell = parseFloat(sc.SellPrice);
            if (Number.isFinite(sell)) return sell;
        }
        if (ctx.serviceCodes) {
            // API reachable but the code row is missing/unparseable — still a fallback, still visible.
            ctx.warnings.push('Service fee ' + code + ' missing from /api/service-codes — using fallback $' + fallback + '.');
        }
        ctx.usedFeeFallback = true;
        return fallback;
    }

    // ------------------------------------------------------------------
    // Grouping / partitioning (the pooling-scope rules)
    // ------------------------------------------------------------------
    function groupIdForItem(item) {
        var m = String(item.method || '').toUpperCase();
        // EMB/CAP/DTG/DTF pools are FIXED by the staff builders' scope — a custom
        // groupId would price configurations staff cannot reproduce (rule 7), so
        // it is ignored for those methods. SCP pools per print design.
        if (m === 'CAP' || (m === 'EMB' && item.isCap === true)) return 'emb:cap';
        if (m === 'EMB') return 'emb:garment';
        if (m === 'DTG') return 'dtg:main';
        if (m === 'DTF') return 'dtf:main';
        if (m === 'SCP') return item.groupId || 'scp:design-1';
        throw QuoteCartError("Unknown decoration method '" + item.method + "' — supported: EMB, CAP, DTG, SCP, DTF.", 'UNKNOWN_METHOD');
    }

    function methodForGroupId(gid) {
        if (gid === 'emb:cap') return 'CAP';
        if (gid === 'emb:garment') return 'EMB';
        if (gid === 'dtg:main') return 'DTG';
        if (gid === 'dtf:main') return 'DTF';
        return 'SCP';
    }

    function partition(cart) {
        var items = (cart && cart.items) || [];
        var groupsCfg = (cart && cart.groups) || {};
        var byId = {};
        var order = [];
        items.forEach(function (item) {
            if (!item || !item.styleNumber) {
                throw QuoteCartError('Cart item missing styleNumber.', 'BAD_ITEM');
            }
            if (itemQty(item) <= 0) {
                throw QuoteCartError('Cart item ' + item.styleNumber + ' has no quantity.', 'BAD_ITEM');
            }
            var gid = groupIdForItem(item);
            if (!byId[gid]) {
                byId[gid] = { groupId: gid, method: methodForGroupId(gid), items: [], options: groupsCfg[gid] || {} };
                order.push(gid);
            }
            byId[gid].items.push(item);
        });
        return order.map(function (gid) { return byId[gid]; });
    }

    // ------------------------------------------------------------------
    // EMB / CAP adapter — runs the staff EmbroideryPricingCalculator class
    // itself (exact parity by construction; design doc "EMB ADAPTER").
    // ------------------------------------------------------------------
    async function getEmbCalculator(ctx, needsCaps) {
        var CalcClass = resolveDep(ctx, 'EmbroideryPricingCalculator');
        if (!CalcClass) {
            throw QuoteCartError('EmbroideryPricingCalculator is not loaded — include shared_components/js/embroidery-quote-pricing.js.', 'MISSING_AUTHORITY');
        }
        if (!ctx.embCalc) {
            ctx.embCalc = new CalcClass({ skipInit: true });
        }
        await ctx.embCalc.initializeConfig();
        if (needsCaps) await ctx.embCalc.initializeCapConfig();
        if (ctx.embCalc.apiError) {
            throw QuoteCartError('Embroidery pricing configuration unavailable (API failure).', 'AUTHORITY_ERROR');
        }
        return ctx.embCalc;
    }

    function buildEmbLogoConfigs(group, isCap) {
        var logos = group.options.logos || {};
        var primary = logos.primary || {
            position: isCap ? 'Cap Front' : 'Left Chest',
            stitchCount: 8000,
            needsDigitizing: false
        };
        var additional = logos.additional || [];
        return {
            primary: primary,
            additional: additional,
            logoConfigs: {
                garment: {
                    primary: isCap ? null : primary,
                    additional: isCap ? [] : additional
                },
                cap: {
                    primary: isCap ? primary : null,
                    additional: isCap ? additional : []
                }
            }
        };
    }

    async function priceEmbGroup(ctx, group) {
        var isCap = group.groupId === 'emb:cap';
        var calc = await getEmbCalculator(ctx, isCap);
        var cfg = buildEmbLogoConfigs(group, isCap);

        // Map cart items → the calculator's product shape (design doc §EMB
        // "Service APIs for the cart engine"). The additional-logo assignment
        // quantity = the item's full quantity: in the staff builder a global AL
        // applies to EVERY piece of the category (embroidery-quote-builder.js:6926-6933).
        var products = group.items.map(function (item) {
            var qty = itemQty(item);
            return {
                cartItemId: item.id,
                style: item.styleNumber,
                color: itemColor(item),
                catalogColor: item.catalogColor || '',
                title: item.title || item.styleNumber,
                sizeBreakdown: item.sizes,
                totalQuantity: qty,
                isCap: isCap,
                sellPriceOverride: 0,
                sizeOverrides: {},
                logoAssignments: {
                    primary: { logoId: 'primary', quantity: qty },
                    additional: cfg.additional.map(function (al, i) {
                        return {
                            id: 'al-' + i,
                            position: al.position,
                            stitchCount: al.stitchCount,
                            quantity: qty
                        };
                    })
                }
            };
        });

        var result = await calc.calculateQuote(products, [], cfg.logoConfigs, { ltmEnabled: true });
        if (!result || result.success === false) {
            throw QuoteCartError((result && result.message) || 'Embroidery pricing failed.', 'AUTHORITY_ERROR');
        }
        if (result.failedProducts && result.failedProducts.length > 0) {
            throw QuoteCartError('Unable to price: ' + result.failedProducts.map(function (f) { return f.style; }).join(', ') +
                ' — size pricing unavailable.', 'PRICE_UNAVAILABLE');
        }

        var pooledQty = isCap ? result.capQuantity : result.garmentQuantity;
        var tierLabel = isCap ? result.capTier : result.garmentTier;
        var ltmFee = isCap ? result.capLtmFee : result.garmentLtmFee;

        // Per-line output: the calculator groups sizes by upcharge level (one
        // lineItem per group, description like 'S(6) M(6)'). lineTotal = rounded
        // base × qty; LTM rides as full-precision unitPriceWithLTM for DISPLAY
        // only — the foot adds the EXACT $50 (never re-multiply the rounded
        // effective unit; 49.98 penny-drift rule).
        var lines = [];
        (result.products || []).forEach(function (pp) {
            (pp.lineItems || []).forEach(function (li) {
                var effective = (li.unitPriceWithLTM != null) ? li.unitPriceWithLTM : li.unitPrice;
                lines.push({
                    itemId: pp.product.cartItemId,
                    styleNumber: pp.product.style,
                    color: pp.product.color,
                    label: li.description,
                    qty: li.quantity,
                    baseUnit: li.basePrice,
                    effectiveUnit: effective,
                    effectiveUnitDisplay: r2(effective),
                    lineTotal: r2(li.total)
                });
            });
        });

        // Service lines (per-piece, qty-scaling): AL/CB/CS/DECG-FB from the
        // calculator, plus AS-GARM/AS-CAP stitch surcharge and puff/patch
        // upcharges — all separate lines, exactly like the staff invoice.
        var serviceLines = (result.additionalServices || []).map(function (svc) {
            return {
                code: svc.partNumber,
                label: svc.description,
                unitPrice: svc.unitPrice,
                quantity: svc.quantity,
                total: r2(svc.total)
            };
        });
        var stitchTotal = isCap ? result.capStitchTotal : result.garmentStitchTotal;
        if (stitchTotal > 0) {
            serviceLines.push({
                code: isCap ? 'AS-CAP' : 'AS-GARM',
                label: 'Stitch-count surcharge (primary logo over 10K)',
                unitPrice: r2(stitchTotal / pooledQty),
                quantity: pooledQty,
                total: r2(stitchTotal)
            });
        }
        if (result.puffUpchargeTotal > 0) {
            serviceLines.push({ code: '3D-EMB', label: '3D puff embroidery', unitPrice: result.puffUpchargePerCap, quantity: pooledQty, total: r2(result.puffUpchargeTotal) });
        }
        if (result.patchUpchargeTotal > 0) {
            serviceLines.push({ code: 'PATCH', label: 'Laser patch', unitPrice: result.patchUpchargePerCap, quantity: pooledQty, total: r2(result.patchUpchargeTotal) });
        }

        var fees = [];
        if (result.setupFees > 0) {
            fees.push({ code: 'DD', label: 'Digitizing / design setup', amount: r2(result.setupFees), oneTime: true });
        }

        // Tier table for nudges — labels straight from the API-built tier maps.
        var tierSource = isCap ? calc.capTiers : calc.tiers;
        var tierTable = Object.keys(tierSource || {}).map(function (label) {
            return { label: label, minQty: parseInt(label, 10) };
        }).filter(function (t) { return Number.isFinite(t.minQty); })
            .sort(function (a, b) { return a.minQty - b.minQty; });

        return {
            method: group.method,
            groupId: group.groupId,
            pooledQty: pooledQty,
            tierLabel: tierLabel,
            lines: lines,
            serviceLines: serviceLines,
            fees: fees,
            ltm: { fee: ltmFee || 0, perUnit: ltmFee > 0 ? ltmFee / pooledQty : 0, mode: 'baked' },
            subtotal: r2(result.subtotal),
            groupTotal: r2(result.grandTotal),
            nudge: null,
            trace: {
                source: 'emb-calculator',
                authority: 'EmbroideryPricingCalculator.calculateQuote (shared_components/js/embroidery-quote-pricing.js)',
                inputs: traceInputs(group, { isCap: isCap, logos: cfg.logoConfigs }),
                tierTable: tierTable,
                tier: tierLabel,
                marginDenominator: isCap
                    ? (calc.capTiers[tierLabel] && calc.capTiers[tierLabel].marginDenominator)
                    : calc.getMarginDenominator(tierLabel),
                embCost: isCap
                    ? (calc.capTiers[tierLabel] && calc.capTiers[tierLabel].embCost)
                    : calc.getEmbroideryCost(tierLabel),
                roundingMethod: isCap ? calc.capRoundingMethod : calc.roundingMethod,
                raw: {
                    subtotal: result.subtotal,
                    ltmFee: ltmFee,
                    setupFees: result.setupFees,
                    additionalServicesTotal: result.additionalServicesTotal,
                    stitchTotal: stitchTotal,
                    grandTotal: result.grandTotal
                }
            }
        };
    }

    // ------------------------------------------------------------------
    // DTG adapter — server-authoritative. POST /api/dtg/quote-pricing, the
    // exact endpoint the staff builder submits through. Orphaned-'12-23' cost
    // fallback, floor-LTM, half-dollar-ceil and combo summation all live
    // server-side (lib/dtg-canonical-pricing.js) — consumed verbatim here.
    // ------------------------------------------------------------------
    async function priceDtgGroup(ctx, group) {
        var locationCode = group.options.locationCode;
        if (!locationCode || DTG_LOCATION_CODES.indexOf(locationCode) === -1) {
            throw QuoteCartError("Unsupported DTG location code '" + locationCode + "' — supported: " +
                DTG_LOCATION_CODES.join(', ') + '.', 'BAD_LOCATION');
        }
        if (!ctx.fetch) throw QuoteCartError('No fetch implementation available', 'NO_FETCH');

        var body = {
            locationCode: locationCode,
            lines: group.items.map(function (item) {
                return { styleNumber: item.styleNumber, color: itemColor(item), sizes: item.sizes };
            })
        };
        var resp = await ctx.fetch(ctx.apiBase + '/api/dtg/quote-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            var detail = '';
            try { detail = await resp.text(); } catch (e) { /* best effort */ }
            throw QuoteCartError('DTG pricing endpoint failed (' + resp.status + '). ' + detail, 'API_ERROR');
        }
        var data = await resp.json();

        var lines = [];
        (data.lineItems || []).forEach(function (li, idx) {
            var item = group.items[idx] || {};
            (li.lineSizes || []).forEach(function (ls) {
                lines.push({
                    itemId: item.id,
                    styleNumber: li.styleNumber,
                    color: li.color,
                    label: ls.size + '(' + ls.quantity + ')',
                    size: ls.size,
                    qty: ls.quantity,
                    baseUnit: ls.baseUnit,
                    effectiveUnit: ls.finalUnit,
                    effectiveUnitDisplay: r2(ls.finalUnit),
                    lineTotal: r2(ls.lineTotal)
                });
            });
        });

        return {
            method: 'DTG',
            groupId: group.groupId,
            pooledQty: data.combinedQuantity,
            tierLabel: data.tier,
            tierLabelBase: data.baseTier, // for nudge derivation (API label, not a hardcoded table)
            lines: lines,
            serviceLines: [],
            fees: [],
            ltm: {
                fee: data.isLtmTier ? data.ltmFee : 0,
                perUnit: data.ltmPerUnit || 0,
                mode: 'baked' // floored into every unit server-side; never re-add a $50 line
            },
            subtotal: r2(data.subtotal),
            groupTotal: r2(data.subtotal),
            nudge: null,
            trace: {
                source: 'dtg-endpoint',
                authority: 'POST /api/dtg/quote-pricing (caspio-pricing-proxy lib/dtg-canonical-pricing.js priceLines)',
                inputs: traceInputs(group, { locationCode: locationCode }),
                request: body,
                tier: data.tier,
                baseTier: data.baseTier,
                marginDenominator: data.marginDenominator,
                appliedRules: data.appliedRules,
                raw: {
                    combinedQuantity: data.combinedQuantity,
                    ltmFee: data.ltmFee,
                    ltmPerUnit: data.ltmPerUnit,
                    subtotal: data.subtotal
                }
            }
        };
    }

    // ------------------------------------------------------------------
    // SCP adapter — replicated builder math (the only method without a
    // loadable staff engine or server endpoint). Bundle via
    // ScreenPrintPricingService; tier matching via the EXACT findPricingTier
    // copy above; per-size assembly mirrors screenprint-quote-builder.js
    // :3139-3152 EXCEPT the silent M→L size fallback, which is replaced by a
    // hard error (a customer page must never price an unknown size at a
    // guessed price — Erik's #1 rule).
    // LTM is ITEMIZED (the builder's 'separate' display mode): exact-cents
    // footing, identical grand total, avoids the builtin-mode floor drift.
    // ------------------------------------------------------------------
    async function priceScpGroup(ctx, group) {
        var SvcClass = resolveDep(ctx, 'ScreenPrintPricingService');
        if (!SvcClass) {
            throw QuoteCartError('ScreenPrintPricingService is not loaded — include shared_components/js/screenprint-pricing-service.js.', 'MISSING_AUTHORITY');
        }
        var opts = group.options || {};
        var frontColors = parseInt(opts.frontColors, 10);
        var backColors = parseInt(opts.backColors || 0, 10) || 0;
        if (!Number.isFinite(frontColors) || frontColors < 1 || frontColors > 6) {
            throw QuoteCartError('Screen print front color count must be 1-6 (got ' + opts.frontColors + ').', 'BAD_OPTIONS');
        }
        if (backColors < 0 || backColors > 6) {
            throw QuoteCartError('Screen print back color count must be 0-6.', 'BAD_OPTIONS');
        }
        // Sleeves: each entry = ONE sleeve print at its OWN ink-color count — left and right may
        // differ (e.g. [2,4] = a 2-color left + a 4-color right). Each is an ADDITIONAL print
        // location priced like the back (additionalLocationPricing at THAT color count). Canonical
        // input is sleeveColorsList; legacy uniform sleeveCount+sleeveColors still accepted. An empty
        // list keeps the legacy front+back path byte-identical.
        var sleeveColorsList = Array.isArray(opts.sleeveColorsList)
            ? opts.sleeveColorsList.map(function (c) { return parseInt(c, 10); })
            : [];
        if (!sleeveColorsList.length) {
            var legacyCount = parseInt(opts.sleeveCount || 0, 10) || 0;
            var legacyColors = parseInt(opts.sleeveColors || 0, 10) || 0;
            for (var lsc = 0; lsc < legacyCount; lsc++) sleeveColorsList.push(legacyColors);
        }
        if (sleeveColorsList.length > 2) {
            throw QuoteCartError('Screen print supports at most 2 sleeves.', 'BAD_OPTIONS');
        }
        sleeveColorsList.forEach(function (c) {
            if (!Number.isFinite(c) || c < 1 || c > 6) {
                throw QuoteCartError('Screen print sleeve color count must be 1-6 (each sleeve).', 'BAD_OPTIONS');
            }
        });
        var sleeveCount = sleeveColorsList.length;
        var sleeveScreens = sleeveColorsList.reduce(function (a, c) { return a + c; }, 0);
        var darkGarment = !!opts.darkGarment;
        var safetyStripes = !!opts.safetyStripes;

        await ensureServiceCodes(ctx);
        var spsu = getFee(ctx, 'SPSU', FEE_FALLBACKS['SPSU']);
        var stripeFee = getFee(ctx, 'SP-STRIPE', FEE_FALLBACKS['SP-STRIPE']);

        var frontBackLocations = backColors > 0 ? 2 : 1;          // front + back (drives safety stripes)
        var printedLocations = frontBackLocations + sleeveCount;  // + sleeves (dark underbase prints on each)
        // Safety stripes: $/piece × FRONT/BACK locations only (sleeves don't get hi-vis stripes),
        // flat AFTER rounding (builder :3070-3073).
        var stripesPerPiece = safetyStripes ? stripeFee * frontBackLocations : 0;

        if (!ctx.scpSvc) ctx.scpSvc = new SvcClass();
        var svc = ctx.scpSvc;

        var pooledQty = 0;
        group.items.forEach(function (item) { pooledQty += itemQty(item); });

        var lines = [];
        var subtotal = 0;
        var ltmFee = null;
        var tierLabel = null;
        var tierTable = null;
        var perStyleTrace = [];

        // Customer-supplied-garment orders (calculators/screenprint-customer): the
        // customer brings their own blank, so garment cost is $0 — reuse the SAME
        // manual-cost machinery every other pricing service already exposes for
        // "cost not looked up by style" (Order Form manual rows, screen-print-
        // pricing.html's manual calculator; generateManualPricingData(0) runs the
        // identical calculatePricing()/transformToExistingFormat() pipeline with a
        // $0 garment cost substituted in). Print/tier/LTM data is style-INDEPENDENT
        // (Ed_Cost rows aren't keyed by garment), so the fixed PC61 reference
        // fetchPricingBundle() already uses internally is exact, not an approximation.
        var customerSuppliedGarment = !!opts.customerSuppliedGarment;
        for (var i = 0; i < group.items.length; i++) {
            var item = group.items[i];
            var bundle = customerSuppliedGarment
                ? await svc.generateManualPricingData(0)
                : await svc.fetchPricingData(item.styleNumber, { forceRefresh: ctx.forceRefresh });
            if (!bundle) {
                throw QuoteCartError('No screen print pricing data' + (customerSuppliedGarment ? ' (customer-supplied garment).' : (' for ' + item.styleNumber + '.')), 'PRICE_UNAVAILABLE');
            }
            var primary = bundle.primaryLocationPricing && bundle.primaryLocationPricing[String(frontColors)];
            if (!primary || !primary.tiers) {
                throw QuoteCartError('No screen print pricing for a ' + frontColors + '-color front (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
            }
            // CUSTOMER minimum gate (Erik 2026-06-11): the builder's
            // findPricingTier deliberately lets below-lowest-tier quantities
            // fall into the lowest tier so a REP can consciously quote LTM
            // territory — but customers can't order below the method's real
            // minimum (lowest tier minQty from the live bundle, 13 today).
            // Mirrors the DTF BELOW_MINIMUM gate; data-derived, never a literal.
            var scpMinQty = primary.tiers.reduce(function (m, t) {
                return (typeof t.minQty === 'number' && t.minQty < m) ? t.minQty : m;
            }, Infinity);
            if (isFinite(scpMinQty) && pooledQty < scpMinQty) {
                throw QuoteCartError('Screen print starts at ' + scpMinQty + ' pieces (you have ' + pooledQty + ').', 'BELOW_MINIMUM', { minQuantity: scpMinQty });
            }
            var tierRow = findPricingTier(primary.tiers, pooledQty);
            if (!tierRow) {
                throw QuoteCartError('No screen print price tier for quantity ' + pooledQty + ' (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
            }

            // Tier label + table from the bundle's Caspio tier rows.
            if (!tierTable) {
                tierTable = Object.keys(bundle.tierData || {}).map(function (label) {
                    var t = bundle.tierData[label];
                    return { label: label, minQty: Number(t.MinQuantity), maxQty: Number(t.MaxQuantity) };
                }).sort(function (a, b) { return a.minQty - b.minQty; });
                var labelRow = tierTable.filter(function (t) { return t.minQty === Number(tierRow.minQty); })[0];
                tierLabel = labelRow ? labelRow.label : (tierRow.minQty + '-' + tierRow.maxQty);
            }

            // LTM from the MATCHED tier row (extends to 71 pcs — $50 at 48!).
            if (ltmFee === null) ltmFee = Number(tierRow.ltmFee) || 0;

            // Back/additional location: matrix price is pre-margined in Caspio,
            // HalfDollarCeil'd SEPARATELY in the service transform, summed here —
            // never re-rounded (builder :3115-3124, :3146).
            var addlPerPiece = 0;
            if (backColors > 0) {
                var addl = bundle.additionalLocationPricing && bundle.additionalLocationPricing[String(backColors)];
                if (!addl || !addl.tiers) {
                    throw QuoteCartError('No additional-location pricing for a ' + backColors + '-color back (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
                }
                var addlRow = findPricingTier(addl.tiers, pooledQty);
                if (!addlRow || typeof addlRow.pricePerPiece !== 'number') {
                    throw QuoteCartError('No additional-location price tier for quantity ' + pooledQty + ' (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
                }
                addlPerPiece = addlRow.pricePerPiece;
            }

            // Each sleeve = another additional location, priced like the back at ITS OWN color count
            // (left and right may differ). Summed per piece — each sleeve is a separate print pass.
            var addlSleevePerPiece = 0;
            for (var svi = 0; svi < sleeveColorsList.length; svi++) {
                var svColors = sleeveColorsList[svi];
                var sleeveAddl = bundle.additionalLocationPricing && bundle.additionalLocationPricing[String(svColors)];
                if (!sleeveAddl || !sleeveAddl.tiers) {
                    throw QuoteCartError('No additional-location pricing for a ' + svColors + '-color sleeve (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
                }
                var sleeveRow = findPricingTier(sleeveAddl.tiers, pooledQty);
                if (!sleeveRow || typeof sleeveRow.pricePerPiece !== 'number') {
                    throw QuoteCartError('No additional-location price tier for quantity ' + pooledQty + ' (' + item.styleNumber + ').', 'PRICE_UNAVAILABLE');
                }
                addlSleevePerPiece += sleeveRow.pricePerPiece;
            }

            var sizes = item.sizes || {};
            var sizeKeys = Object.keys(sizes);
            for (var s = 0; s < sizeKeys.length; s++) {
                var size = sizeKeys[s];
                var qty = Number(sizes[size]);
                if (!(qty > 0)) continue;
                var sizePrice = tierRow.prices ? tierRow.prices[size] : undefined;
                if (typeof sizePrice !== 'number') {
                    // Builder falls back M→L silently (:3140-3143) — the customer
                    // engine refuses instead.
                    throw QuoteCartError('No ' + size + ' price for ' + item.styleNumber + ' at the ' + tierLabel + ' tier.', 'PRICE_UNAVAILABLE');
                }
                var unit = sizePrice + addlPerPiece + addlSleevePerPiece + stripesPerPiece;
                var effective = unit + (ltmFee > 0 ? ltmFee / pooledQty : 0);
                lines.push({
                    itemId: item.id,
                    styleNumber: item.styleNumber,
                    color: itemColor(item),
                    label: size + '(' + qty + ')',
                    size: size,
                    qty: qty,
                    baseUnit: unit,
                    effectiveUnit: effective,        // display only (LTM share)
                    effectiveUnitDisplay: r2(effective),
                    lineTotal: r2(unit * qty)        // footing uses the BASE unit; LTM is itemized
                });
                subtotal += unit * qty;
            }

            perStyleTrace.push({
                styleNumber: item.styleNumber,
                tierRow: { minQty: tierRow.minQty, maxQty: tierRow.maxQty, ltmFee: tierRow.ltmFee },
                addlPerPiece: addlPerPiece,
                marginDenominator: bundle.tierData && bundle.tierData[tierLabel] && bundle.tierData[tierLabel].MarginDenominator
            });
        }

        // Screens: front + back colors, +1 per printed location when dark —
        // setup ONLY, never the per-piece lookup (builder :108-122 and the
        // 2026-06-09 order-form parity ruling).
        var screens = frontColors + (backColors > 0 ? backColors : 0) + sleeveScreens + (darkGarment ? printedLocations : 0);
        var setupFee = r2(screens * spsu);

        subtotal = r2(subtotal);
        ltmFee = ltmFee || 0;
        var fees = [
            { code: 'SPSU', label: 'Screen setup — ' + screens + ' screen' + (screens === 1 ? '' : 's') + ' × $' + spsu, amount: setupFee, oneTime: true }
        ];
        if (ltmFee > 0) {
            fees.push({ code: 'LTM', label: 'Small order fee', amount: r2(ltmFee), oneTime: false });
        }

        return {
            method: 'SCP',
            groupId: group.groupId,
            pooledQty: pooledQty,
            tierLabel: tierLabel,
            lines: lines,
            serviceLines: [],
            fees: fees,
            ltm: { fee: ltmFee, perUnit: pooledQty > 0 ? ltmFee / pooledQty : 0, mode: 'itemized' },
            subtotal: subtotal,
            groupTotal: r2(subtotal + ltmFee + setupFee),
            nudge: null,
            trace: {
                source: 'scp-replica',
                authority: 'ScreenPrintPricingService bundle + EXACT copies of screenprint-quote-builder.js findPricingTier (:2975-2985), per-size assembly (:3139-3152), screens (:108-122)',
                inputs: traceInputs(group, { frontColors: frontColors, backColors: backColors, sleeveColorsList: sleeveColorsList, darkGarment: darkGarment, safetyStripes: safetyStripes, customerSuppliedGarment: customerSuppliedGarment }),
                tierTable: tierTable,
                tier: tierLabel,
                perStyle: perStyleTrace,
                screens: screens,
                fees: { spsu: spsu, stripe: stripeFee, usedFallback: !!ctx.usedFeeFallback },
                raw: { subtotal: subtotal, ltmFee: ltmFee, setupFee: setupFee }
            }
        };
    }

    // ------------------------------------------------------------------
    // DTF adapter — DTFPricingService.calculatePriceForQuantity (the
    // authoritative formula, dtf-pricing-service.js:369-439) at the POOLED
    // quantity; garment cost per the BUILDER rule (min BLANK-bundle size
    // price, dtf-quote-page.js:617-650); extended sizes use the builder's
    // upcharge-AFTER-margin convention (dtf-quote-builder.js:1776-1778,
    // 1961-1964). NEVER DTFQuotePricing.calculateProductPricing — it margins
    // the upcharge and overcharges 2XL+ (design doc, DTF risks).
    // ------------------------------------------------------------------
    function dtfLocationInfo(ctx, locationValue) {
        var cfg = resolveDep(ctx, 'DTFConfig');
        if (cfg && cfg.transferLocations) {
            var loc = cfg.transferLocations.find(function (l) { return l.value === locationValue; });
            return loc ? { size: loc.size, zone: loc.zone } : null;
        }
        var fb = DTF_LOCATIONS_FALLBACK.find(function (l) { return l.value === locationValue; });
        return fb ? { size: fb.size, zone: fb.zone } : null;
    }

    function dtfSizeUpcharge(size, addons, blankSizes, baseCost) {
        var normalized = DTF_SIZE_ALIASES[size] || size;
        var v = addons ? addons[normalized] : undefined;
        if (v !== undefined && v !== null) return Number(v);
        if (DTF_ZERO_UPCHARGE_SIZES.indexOf(normalized) !== -1) return 0;
        // Combined / range size NAMES (vests + jackets price as S/M, L/XL, 2/3X, 4/5X) aren't in the
        // standard S–6XL upcharge map. If the garment's OWN size price equals the base cost, it's a
        // BASE size → 0 upcharge (lets these products price at standard sizes). We do NOT invent a
        // positive upcharge from the price delta — that would under-charge vs the real selling
        // upcharge — so EXTENDED combined sizes (price > base) still error (Erik's #1 rule).
        if (Array.isArray(blankSizes) && Number.isFinite(baseCost)) {
            var row = blankSizes.find(function (bs) { return bs && bs.size === size; });
            if (row && Number.isFinite(Number(row.price)) && Math.abs(Number(row.price) - baseCost) < 0.005) return 0;
        }
        // Missing API upcharge for an extended size = visible error, never the
        // builder's hardcoded {2XL:$2...} fallback (Erik's #1 rule).
        throw QuoteCartError('No size-upcharge data for ' + size + ' — cannot price it.', 'PRICE_UNAVAILABLE');
    }

    async function priceDtfGroup(ctx, group) {
        var SvcClass = resolveDep(ctx, 'DTFPricingService');
        if (!SvcClass) {
            throw QuoteCartError('DTFPricingService is not loaded — include shared_components/js/dtf-pricing-service.js.', 'MISSING_AUTHORITY');
        }
        var locations = group.options.locations;
        if (!Array.isArray(locations) || locations.length === 0) {
            throw QuoteCartError('DTF group needs at least one transfer location.', 'BAD_OPTIONS');
        }

        // Conflict-zone validation (dtf-quote-pricing.js:73-77): one front-zone
        // pick, one back-zone pick, sleeves independent.
        var zonesUsed = {};
        var sizeKeys = [];
        for (var i = 0; i < locations.length; i++) {
            var loc = locations[i];
            if (locations.indexOf(loc) !== i) {
                throw QuoteCartError('Duplicate DTF location: ' + loc + '.', 'BAD_OPTIONS');
            }
            var info = dtfLocationInfo(ctx, loc);
            if (!info) {
                throw QuoteCartError("Unknown DTF location '" + loc + "'.", 'BAD_LOCATION');
            }
            if (DTF_CONFLICT_ZONES[info.zone]) {
                if (zonesUsed[info.zone]) {
                    throw QuoteCartError('DTF locations ' + zonesUsed[info.zone] + ' and ' + loc + ' conflict — pick one per zone.', 'BAD_OPTIONS');
                }
                zonesUsed[info.zone] = loc;
            }
            sizeKeys.push(info.size);
        }

        var pooledQty = 0;
        group.items.forEach(function (item) { pooledQty += itemQty(item); });
        if (pooledQty < 10) {
            // No tier exists below 10 in the API; the builder's /10 estimate
            // under-collects LTM — hard block (design doc, DTF risks).
            throw QuoteCartError('DTF starts at 10 pieces (you have ' + pooledQty + ').', 'BELOW_MINIMUM', { minQuantity: 10 });
        }

        if (!ctx.dtfSvc) ctx.dtfSvc = new SvcClass();
        var svc = ctx.dtfSvc;
        var data = await svc.fetchPricingData(null, { forceRefresh: ctx.forceRefresh });

        var lines = [];
        var subtotal = 0;
        var sharedResult = null;
        var perStyleTrace = [];

        for (var p = 0; p < group.items.length; p++) {
            var item = group.items[p];
            // Garment cost — BUILDER rule: min(BLANK bundle size prices)
            // (dtf-quote-page.js:643-646). No CASE_PRICE fallback here: missing
            // size data is a visible error on a customer surface.
            var blank = await fetchJson(ctx, ctx.apiBase + '/api/pricing-bundle?method=BLANK&styleNumber=' + encodeURIComponent(item.styleNumber));
            var blankSizes = (blank && blank.sizes) || [];
            if (!blankSizes.length) {
                throw QuoteCartError('No blank garment pricing for ' + item.styleNumber + '.', 'PRICE_UNAVAILABLE');
            }
            var baseCost = Math.min.apply(null, blankSizes.map(function (s) { return Number(s.price); }));
            if (!Number.isFinite(baseCost) || baseCost <= 0) {
                throw QuoteCartError('Invalid blank garment cost for ' + item.styleNumber + '.', 'PRICE_UNAVAILABLE');
            }
            var addons = blank.sellingPriceDisplayAddOns || {};

            var r = svc.calculatePriceForQuantity(baseCost, data, sizeKeys, pooledQty);
            sharedResult = sharedResult || r;

            var sizes = item.sizes || {};
            var sizeNames = Object.keys(sizes);
            for (var s = 0; s < sizeNames.length; s++) {
                var size = sizeNames[s];
                var qty = Number(sizes[size]);
                if (!(qty > 0)) continue;
                var upcharge = dtfSizeUpcharge(size, addons, blankSizes, baseCost);
                // Upcharge AFTER margin, half-dollar ceil as the FINAL step —
                // identical to dtf-quote-builder.js:1776-1778 / 1961-1964.
                var unit = upcharge > 0
                    ? Math.ceil((r.subtotalBeforeRounding + upcharge) * 2) / 2
                    : r.finalUnitPrice;
                lines.push({
                    itemId: item.id,
                    styleNumber: item.styleNumber,
                    color: itemColor(item),
                    label: size + '(' + qty + ')',
                    size: size,
                    qty: qty,
                    baseUnit: unit,           // billed price IS LTM-inclusive (2026-06-01 rule)
                    effectiveUnit: unit,
                    effectiveUnitDisplay: r2(unit),
                    lineTotal: r2(unit * qty)
                });
                subtotal += unit * qty;
            }

            perStyleTrace.push({
                styleNumber: item.styleNumber,
                baseGarmentCost: baseCost,
                subtotalBeforeRounding: r.subtotalBeforeRounding,
                finalUnitPrice: r.finalUnitPrice
            });
        }

        var tierTable = (data.pricingTiers || []).map(function (t) {
            return { label: t.tierLabel, minQty: t.minQuantity, maxQty: t.maxQuantity };
        }).sort(function (a, b) { return a.minQty - b.minQty; });

        return {
            method: 'DTF',
            groupId: group.groupId,
            pooledQty: pooledQty,
            tierLabel: sharedResult.tierLabel,
            lines: lines,
            serviceLines: [],
            fees: [],
            ltm: {
                fee: sharedResult.ltmFee || 0,
                perUnit: sharedResult.ltmFeePerUnit || 0,
                mode: 'baked' // inside the HalfDollarCeil — never itemize, never re-add
            },
            subtotal: r2(subtotal),
            groupTotal: r2(subtotal),
            nudge: null,
            trace: {
                source: 'dtf-service',
                authority: 'DTFPricingService.calculatePriceForQuantity (shared_components/js/dtf-pricing-service.js:369-439) + builder upcharge-after-margin convention',
                inputs: traceInputs(group, { locations: locations, sizeKeys: sizeKeys }),
                tierTable: tierTable,
                tier: sharedResult.tierLabel,
                marginDenominator: sharedResult.marginDenominator,
                components: {
                    totalTransferCost: sharedResult.totalTransferCost,
                    totalLaborCost: sharedResult.totalLaborCost,
                    freightPerTransfer: sharedResult.freightPerTransfer,
                    ltmFeePerUnit: sharedResult.ltmFeePerUnit
                },
                perStyle: perStyleTrace,
                raw: { subtotal: r2(subtotal), ltmFee: sharedResult.ltmFee }
            }
        };
    }

    // ------------------------------------------------------------------
    // Dispatch + nudges
    // ------------------------------------------------------------------
    function traceInputs(group, options) {
        return {
            pooledQty: group.items.reduce(function (s, it) { return s + itemQty(it); }, 0),
            options: options,
            items: group.items.map(function (it) {
                return { id: it.id, styleNumber: it.styleNumber, color: itemColor(it), qty: itemQty(it), sizes: it.sizes };
            })
        };
    }

    async function priceGroup(ctx, group) {
        switch (group.groupId === 'emb:cap' ? 'EMB' : group.method) {
            case 'EMB': return priceEmbGroup(ctx, group);
            case 'DTG': return priceDtgGroup(ctx, group);
            case 'SCP': return priceScpGroup(ctx, group);
            case 'DTF': return priceDtfGroup(ctx, group);
            default:
                throw QuoteCartError("No pricing adapter for method '" + group.method + "'.", 'UNKNOWN_METHOD');
        }
    }

    // Per-piece basis for nudge comparison: everything that scales with
    // quantity (unit prices, per-piece services, LTM) — one-time fees excluded
    // (they don't change with qty). Always diff the EFFECTIVE per-piece incl.
    // LTM — base-price diffs lie at the DTG 1-23 inversion (design doc).
    function perPieceBasis(gr) {
        var oneTime = (gr.fees || []).reduce(function (s, f) { return s + (f.oneTime ? f.amount : 0); }, 0);
        return (gr.groupTotal - oneTime) / gr.pooledQty;
    }

    function cloneGroupWithExtraQty(group, addQty) {
        var items = group.items.map(function (it) {
            return Object.assign({}, it, { sizes: Object.assign({}, it.sizes) });
        });
        // Deterministic filler: largest line, then its largest size bucket.
        var target = items.reduce(function (best, it) {
            return (!best || itemQty(it) > itemQty(best)) ? it : best;
        }, null);
        var sizeKeys = Object.keys(target.sizes);
        var size = sizeKeys.reduce(function (best, k) {
            return (best === null || Number(target.sizes[k]) > Number(target.sizes[best])) ? k : best;
        }, null);
        target.sizes[size] = Number(target.sizes[size]) + addQty;
        return { groupId: group.groupId, method: group.method, items: items, options: group.options };
    }

    function nextTierFor(gr) {
        var table = gr.trace && gr.trace.tierTable;
        if (Array.isArray(table) && table.length) {
            var next = table.filter(function (t) { return t.minQty > gr.pooledQty; })
                .sort(function (a, b) { return a.minQty - b.minQty; })[0];
            return next ? { minQty: next.minQty, label: next.label } : null;
        }
        // DTG: derive from the API's own baseTier label ('1-23' → next min 24).
        var label = gr.tierLabelBase || gr.tierLabel || '';
        var m = /^(\d+)\s*-\s*(\d+)/.exec(label);
        if (m) return { minQty: parseInt(m[2], 10) + 1, label: null };
        return null;
    }

    async function computeNudge(ctx, group, gr) {
        var next = nextTierFor(gr);
        if (!next || next.minQty <= gr.pooledQty) return null;
        var addQty = next.minQty - gr.pooledQty;
        var boosted = cloneGroupWithExtraQty(group, addQty);
        var nextResult;
        try {
            nextResult = await priceGroup(ctx, boosted);
        } catch (e) {
            return null; // nudge is best-effort; never blocks pricing
        }
        var savings = r2(perPieceBasis(gr) - perPieceBasis(nextResult));
        if (!(savings > 0)) return null; // suppress non-savings (inversion guard)
        return {
            addQty: addQty,
            nextTierMinQty: next.minQty,
            nextTierLabel: next.label || nextResult.tierLabel,
            perPieceSavings: savings,
            currentPerPiece: r2(perPieceBasis(gr)),
            nextPerPiece: r2(perPieceBasis(nextResult)),
            ltmDisappears: (gr.ltm && gr.ltm.fee > 0) && (!nextResult.ltm || !(nextResult.ltm.fee > 0))
        };
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Price a whole cart, pooled per the staff builders' rules.
     * @param {Object} cart    { items:[...], groups:{ groupId: options } }
     *   item  = { id, method:'EMB'|'CAP'|'DTG'|'SCP'|'DTF', styleNumber, title,
     *             colorName, catalogColor, sizes:{S:6,...}, isCap, groupId(SCP) }
     *   groups options per method:
     *     emb:garment / emb:cap → { logos:{ primary:{position,stitchCount,needsDigitizing},
     *                                        additional:[{position,stitchCount,needsDigitizing}] } }
     *     dtg:main  → { locationCode:'LC'|'FF'|'FB'|'JF'|'JB'|'LC_FB'|'FF_FB'|'JF_JB'|'LC_JB' }
     *     scp:*     → { frontColors:1-6, backColors:0-6, sleeveColorsList:[1-6,…] (≤2; or legacy sleeveCount/sleeveColors), darkGarment, safetyStripes, customerSuppliedGarment (bool, default false — $0 garment cost via generateManualPricingData(0); calculators/screenprint-customer) }
     *     dtf:main  → { locations:['left-chest','full-back',...] }
     * @param {Object} options { deps, fetch, apiBase, forceRefresh, nudge }
     * @returns {Promise<{groups:Array, grandTotal:number|null, warnings:Array, errors:Array}>}
     *   grandTotal is WITHHELD (null) when any group failed — partial sums are
     *   wrong prices (Erik's #1 rule).
     */
    async function priceCart(cart, options) {
        options = options || {};
        var ctx = makeCtx(options);
        var groups;
        try {
            groups = partition(cart);
        } catch (e) {
            return { groups: [], grandTotal: null, warnings: ctx.warnings, errors: [{ groupId: null, method: null, code: e.code || 'BAD_CART', message: e.message }] };
        }
        var results = [];
        var errors = [];
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            try {
                var gr = await priceGroup(ctx, group);
                if (options.nudge === true) {
                    gr.nudge = await computeNudge(ctx, group, gr);
                }
                results.push(gr);
            } catch (e2) {
                errors.push({
                    groupId: group.groupId,
                    method: group.method,
                    code: e2.code || 'PRICING_ERROR',
                    message: e2.message,
                    // carry QuoteCartError extras (e.g. BELOW_MINIMUM's
                    // minQuantity) so UIs can render per-method copy
                    minQuantity: e2.minQuantity
                });
            }
        }
        var grandTotal = errors.length > 0 ? null : r2(results.reduce(function (s, g) { return s + g.groupTotal; }, 0));
        return { groups: results, grandTotal: grandTotal, warnings: ctx.warnings, errors: errors };
    }

    /**
     * Single-item preview for the product-page configurator (customer-redesign
     * decision #17): qty + options + method → unit price, total, fees,
     * effective per-piece, next-tier nudge. Pass options.cartItems to preview
     * at the CURRENT CART POOL ("with the 12 DTG shirts already in your quote,
     * these price at the 24-47 tier").
     */
    async function singleItemPreview(item, options) {
        options = options || {};
        var previewItem = Object.assign({}, item, { id: item.id || '__preview__' });
        var cartItems = (options.cartItems || []).filter(function (ci) { return ci.id !== previewItem.id; });
        var cart = { items: cartItems.concat([previewItem]), groups: options.groups || {} };
        var res = await priceCart(cart, Object.assign({}, options, { nudge: options.nudge !== false }));

        var gid;
        try {
            gid = groupIdForItem(previewItem);
        } catch (e) {
            return { ok: false, error: { groupId: null, code: e.code, message: e.message }, warnings: res.warnings };
        }
        var err = res.errors.filter(function (er) { return er.groupId === gid || er.groupId === null; })[0];
        if (err) return { ok: false, error: err, warnings: res.warnings };

        var groupResult = res.groups.filter(function (g) { return g.groupId === gid; })[0];
        if (!groupResult) {
            return { ok: false, error: { groupId: gid, code: 'NO_GROUP', message: 'Preview group missing from result.' }, warnings: res.warnings };
        }
        var lines = groupResult.lines.filter(function (l) { return l.itemId === previewItem.id; });
        var qty = itemQty(previewItem);
        var itemTotal = r2(lines.reduce(function (s, l) { return s + l.lineTotal; }, 0));
        var effectivePerPiece = qty > 0
            ? r2(lines.reduce(function (s, l) { return s + l.effectiveUnit * l.qty; }, 0) / qty)
            : 0;
        return {
            ok: true,
            method: groupResult.method,
            groupId: gid,
            pooledQty: groupResult.pooledQty,
            pooledWithCart: cartItems.length > 0,
            tierLabel: groupResult.tierLabel,
            lines: lines,
            itemQuantity: qty,
            itemTotal: itemTotal,
            effectivePerPiece: effectivePerPiece,
            serviceLines: groupResult.serviceLines,
            fees: groupResult.fees,
            ltm: groupResult.ltm,
            nudge: groupResult.nudge,
            groupTotal: groupResult.groupTotal,
            warnings: res.warnings,
            trace: groupResult.trace
        };
    }

    var QuoteCartEngine = {
        priceCart: priceCart,
        singleItemPreview: singleItemPreview,
        VERSION: VERSION,
        // Exposed for parity tests (canary + unit coverage) — not a public API.
        _internals: {
            findPricingTier: findPricingTier,
            groupIdForItem: groupIdForItem,
            partition: partition,
            dtfSizeUpcharge: dtfSizeUpcharge,
            cloneGroupWithExtraQty: cloneGroupWithExtraQty,
            perPieceBasis: perPieceBasis,
            DTG_LOCATION_CODES: DTG_LOCATION_CODES,
            DTF_LOCATIONS_FALLBACK: DTF_LOCATIONS_FALLBACK,
            FEE_FALLBACKS: FEE_FALLBACKS
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuoteCartEngine;
    }
    if (typeof global.window !== 'undefined' || typeof window !== 'undefined') {
        global.QuoteCartEngine = QuoteCartEngine;
    }
})(typeof window !== 'undefined' ? window : globalThis);
