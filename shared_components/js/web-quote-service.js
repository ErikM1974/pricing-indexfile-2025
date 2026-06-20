/**
 * web-quote-service.js — SAVE / SHARE / EMAIL for the customer quote cart
 * (Phase 3 of the customer quote-cart project; prefix WQ).
 *
 * Design: memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md (§Save flow) + the
 * locked Erik decisions: WQ prefix via GET /api/quote-sequence/WQ; emails to
 * sales@nwcustomapparel.com + immediate customer copy with the /quote/WQ-…
 * share link; v1 saved quotes are FROZEN (view + request-changes mailto).
 *
 * IRON RULE — zero price math: every dollar in the saved payload comes from a
 * QuoteCartEngine.priceCart() result (the staff-authority orchestrator). The
 * only arithmetic in this file is SUMMING the rows it just built to assert
 * they FOOT to the engine's group totals (readers' contract: /quote and
 * /invoice foot from line items; subtotal display = quote_sessions.TotalAmount).
 *
 * Save flow (saveQuote):
 *   1. RE-PRICE with forceRefresh:true (busts the services' 5-min caches).
 *   2. PARITY GATE: any group total moved > $0.01 vs what the customer saw →
 *      return { success:false, code:'PRICING_CHANGED', fresh } — the page
 *      re-renders the fresh prices and asks the customer to confirm. We never
 *      save totals the customer didn't see (custom-tees pattern).
 *   3. Build quote_sessions + quote_items payloads from the FRESH result.
 *   4. FOOTING ASSERT: per group, Σ(row LineTotal) must equal groupTotal
 *      within $0.02 (the EMB builder's own LTM penny-drift tolerance) — else
 *      abort with a visible FOOTING_MISMATCH (never save rows that don't foot).
 *   5. POST /api/quote_sessions, then POST /api/quote_items per row (proxy
 *      CRUD — the same endpoints every staff builder uses).
 *   6. Returns { quoteId, shareUrl:'/quote/'+quoteId }. Emails are a separate
 *      fire-and-forget call (sendEmails) — an email failure NEVER fails a save.
 *
 * Conventions mirrored from shared_components/js/embroidery-quote-service.js:
 *   - QuoteID = WQ-{year}-{seq} via /api/quote-sequence (random-suffix fallback
 *     + caller-visible warning when the sequence API is down).
 *   - SubtotalAmount === TotalAmount = pre-tax all-in grand total.
 *   - TaxRate/TaxAmount saved as 0 — the rep calculates tax at confirmation
 *     (customer web quotes carry no shipping address yet; documented in the
 *     Notes JSON taxNote so quote-view + reps see why).
 *   - Fee/service rows save as quote_items with EmbellishmentType:'fee' and
 *     StyleNumber = the service code (DD / AL / CB / AS-GARM / SPSU / LTM /
 *     SP-STRIPE / 3D-EMB …) — quote-view's fee emitters + catch-all render
 *     them once each, and the staff fee-routing map already knows the codes.
 *   - Method-specific quote_sessions columns (PrintLocation/StitchCount/Cap*)
 *     are NOT sent — the 2026-06-04 phantom-default lesson.
 *
 * Dual environment: browser global (window.WebQuoteService) + module.exports
 * for jest (tests/unit/web-quote-service.test.js). No DOM access.
 */
(function (global) {
    'use strict';

    var DEFAULT_API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var QUOTE_PREFIX = 'WQ';
    var PARITY_TOLERANCE = 0.01;   // pre-save reprice gate (per group + grand)
    var FOOTING_TOLERANCE = 0.02;  // EMB builder's LTM penny-drift tolerance

    // EmailJS — the builders' notification stack (quote-builder-utils.js
    // emailQuote + embroidery-quote-service.js init key). template_quote_email
    // is the existing generic customer quote-link template — REUSED, never an
    // invented ID.
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    var EMAILJS_SERVICE_ID = 'service_jgrave3';
    var EMAILJS_TEMPLATE_QUOTE = 'template_quote_email';

    // Engine method → quote_items.EmbellishmentType (cross-builder canonical
    // values; quote-view groups product rows by these).
    var METHOD_EMBELLISHMENT = {
        EMB: 'embroidery',
        CAP: 'cap',
        DTG: 'dtg',
        SCP: 'screenprint',
        DTF: 'dtf'
    };

    // Structural display labels (NOT prices) for PrintLocationName.
    var DTG_LOCATION_LABELS = {
        LC: 'Left Chest', FF: 'Full Front', FB: 'Full Back',
        JF: 'Jumbo Front', JB: 'Jumbo Back'
    };
    var DTF_LOCATION_LABELS = {
        'left-chest': 'Left Chest', 'right-chest': 'Right Chest',
        'left-sleeve': 'Left Sleeve', 'right-sleeve': 'Right Sleeve',
        'back-of-neck': 'Back of Neck', 'center-front': 'Center Front',
        'center-back': 'Center Back', 'full-front': 'Full Front',
        'full-back': 'Full Back'
    };

    function r2(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }

    function isoNoMillis(d) {
        return (d || new Date()).toISOString().replace(/\.\d{3}Z$/, '');
    }

    /** "S(6) M(6)" → {S:6, M:6} (embroidery-quote-service.js pattern). */
    function parseLabelToSizeBreakdown(label) {
        var out = {};
        if (!label) return out;
        var re = /([A-Z0-9\/]+)\((\d+)\)/gi;
        var m;
        while ((m = re.exec(label)) !== null) {
            var qty = parseInt(m[2], 10);
            if (qty > 0) out[m[1].toUpperCase()] = qty;
        }
        return out;
    }

    /** PrintLocation code string + human name for a group's options. */
    function locationFields(method, options) {
        options = options || {};
        if (method === 'EMB' || method === 'CAP') {
            var logos = options.logos || {};
            var positions = [];
            if (logos.primary && logos.primary.position) positions.push(logos.primary.position);
            (logos.additional || []).forEach(function (l) { if (l && l.position) positions.push(l.position); });
            var joined = positions.join(' + ');
            return { code: joined, name: joined };
        }
        if (method === 'DTG') {
            var code = options.locationCode || '';
            var name = code.split('_').map(function (c) { return DTG_LOCATION_LABELS[c] || c; }).join(' + ');
            return { code: code, name: name };
        }
        if (method === 'SCP') {
            var parts = ['Front ' + (options.frontColors || 1) + '-color'];
            if (Number(options.backColors) > 0) parts.push('Back ' + options.backColors + '-color');
            var label = parts.join(' + ');
            if (options.safetyStripes) label += ' + Safety stripes';
            return { code: label, name: label };
        }
        if (method === 'DTF') {
            var locs = options.locations || [];
            return {
                code: locs.join(' + '),
                name: locs.map(function (l) { return DTF_LOCATION_LABELS[l] || l; }).join(' + ')
            };
        }
        return { code: '', name: '' };
    }

    /** Compact per-group options JSON for the first item row's LogoSpecs (≤250 chars, EMB pattern). */
    function logoSpecsFor(group, options) {
        try {
            var specs = JSON.stringify({ method: group.method, tier: group.tierLabel, options: options || {} });
            if (specs.length > 250) {
                specs = JSON.stringify({ method: group.method, tier: group.tierLabel });
            }
            return specs;
        } catch (e) {
            return '';
        }
    }

    function WebQuoteService(opts) {
        opts = opts || {};
        this.apiBase = opts.apiBase ||
            (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) ||
            DEFAULT_API_BASE;
        this.fetch = opts.fetch ||
            (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
        this.engine = opts.engine || global.QuoteCartEngine || null;
        this.emailjs = opts.emailjs !== undefined ? opts.emailjs : (global.emailjs || null);
        this.dryRun = !!opts.dryRun;
        // Init EmailJS once if the SDK is on the page (idempotent; same public
        // key as every staff builder).
        if (this.emailjs && typeof this.emailjs.init === 'function' && !opts.skipEmailInit) {
            try { this.emailjs.init(EMAILJS_PUBLIC_KEY); } catch (e) { /* already inited */ }
        }
    }

    /**
     * Mint WQ-{year}-{NNN} via the shared sequence endpoint (the same call
     * every builder makes — embroidery-quote-service.js:69-93). On failure:
     * WQmmdd-nnnn random fallback + usedFallback:true so the UI can warn
     * (Erik's #1 rule — no silent fallbacks).
     */
    WebQuoteService.prototype.generateQuoteID = async function () {
        try {
            var resp = await this.fetch(this.apiBase + '/api/quote-sequence/' + QUOTE_PREFIX);
            if (!resp.ok) throw new Error('API returned ' + resp.status);
            var data = await resp.json();
            return {
                quoteId: data.prefix + '-' + data.year + '-' + String(data.sequence).padStart(3, '0'),
                usedFallback: false
            };
        } catch (error) {
            console.warn('[WebQuoteService] Quote sequence API failed, using fallback:', error);
            var now = new Date();
            var mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
            var seq = Math.floor(Math.random() * 9000) + 1000;
            return { quoteId: QUOTE_PREFIX + mmdd + '-' + seq, usedFallback: true };
        }
    };

    WebQuoteService.prototype.generateSessionID = function () {
        return 'web_quote_cart_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    };

    /**
     * Build the quote_sessions + quote_items payloads from an engine result.
     * PURE — no network, no DOM. Every money field is copied (at most rounded
     * to cents) from the engine result; nothing is computed here.
     *
     * @param {Object} p { quoteId, sessionId, result (engine priceCart result),
     *   storeItems (QuoteCartStore items — display fields keyed by id),
     *   groups (groupId → engine options map), customer {name,email,phone,
     *   company,notes}, artwork [{groupId,externalKey,fileName,url}], now? }
     * @returns {{ session:Object, items:Array }}
     */
    WebQuoteService.prototype.buildPayloads = function (p) {
        var result = p.result;
        var storeById = {};
        (p.storeItems || []).forEach(function (it) { storeById[it.id] = it; });
        var groupsCfg = p.groups || {};
        var now = p.now || new Date();
        var addedAt = isoNoMillis(now);
        var customer = p.customer || {};
        var artwork = p.artwork || [];

        var totalQuantity = (p.storeItems || []).reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
        var ltmFeeTotal = (result.groups || []).reduce(function (s, g) { return s + ((g.ltm && g.ltm.fee) || 0); }, 0);

        // ---------------- quote_items ----------------
        var items = [];
        var lineNumber = 1;

        (result.groups || []).forEach(function (group) {
            var options = groupsCfg[group.groupId] || {};
            var loc = locationFields(group.method, options);
            var embType = METHOD_EMBELLISHMENT[group.method] || group.method.toLowerCase();
            var baked = !!(group.ltm && group.ltm.mode === 'baked' && group.ltm.fee > 0);
            var firstRowOfGroup = true;

            // Product rows — one per engine line. Billed unit follows each
            // method's own convention (the readers' contract):
            //   baked LTM (EMB/CAP/DTG/DTF): FinalUnitPrice = effective unit
            //     (LTM share inside), LineTotal = full-precision effective × qty
            //     — the staff EMB save's exact rule, so rows foot to
            //     groupTotal without a separate LTM row. BaseUnitPrice ALSO
            //     stores the billed unit (the staff EMB convention: quote-view's
            //     Unit column reads BaseUnitPrice first, so unit × qty must
            //     equal the row total); the pre-LTM base is recoverable as
            //     FinalUnitPrice − LTMPerUnit.
            //   itemized LTM (SCP): FinalUnitPrice = base unit; the LTM fee is
            //     its own fee row below.
            (group.lines || []).forEach(function (line) {
                var store = storeById[line.itemId] || {};
                var billedUnit = baked ? line.effectiveUnit : line.baseUnit;
                var sizeBreakdown = line.size
                    ? (function () { var o = {}; o[line.size] = line.qty; return o; })()
                    : parseLabelToSizeBreakdown(line.label);
                items.push({
                    QuoteID: p.quoteId,
                    LineNumber: lineNumber++,
                    StyleNumber: line.styleNumber,
                    ProductName: (store.productTitle || line.styleNumber) + (line.color ? ' - ' + line.color : ''),
                    Color: line.color || '',                       // COLOR_NAME (display)
                    ColorCode: store.catalogColor || '',           // CATALOG_COLOR (inventory)
                    EmbellishmentType: embType,
                    PrintLocation: loc.code,
                    PrintLocationName: loc.name,
                    Quantity: line.qty,
                    HasLTM: baked ? 'Yes' : 'No',
                    BaseUnitPrice: r2(billedUnit),
                    LTMPerUnit: baked ? r2(group.ltm.perUnit) : 0,
                    FinalUnitPrice: r2(billedUnit),
                    LineTotal: r2(billedUnit * line.qty),
                    SizeBreakdown: JSON.stringify(sizeBreakdown),
                    PricingTier: group.tierLabel || '',
                    ImageURL: store.imageUrl || '',
                    AddedAt: addedAt,
                    LogoSpecs: firstRowOfGroup ? logoSpecsFor(group, options) : ''
                });
                firstRowOfGroup = false;
            });

            // Per-piece service lines (EMB AL/CB/CS/DECG-FB, AS surcharges,
            // puff/patch) — fee rows with the service code as StyleNumber,
            // exactly like the staff fee-item convention.
            (group.serviceLines || []).forEach(function (sl) {
                items.push({
                    QuoteID: p.quoteId,
                    LineNumber: lineNumber++,
                    StyleNumber: sl.code,
                    ProductName: sl.label || sl.code,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'fee',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: sl.quantity || 1,
                    HasLTM: 'No',
                    BaseUnitPrice: r2(sl.unitPrice),
                    LTMPerUnit: 0,
                    FinalUnitPrice: r2(sl.unitPrice),
                    LineTotal: r2(sl.total),
                    SizeBreakdown: '',
                    PricingTier: group.tierLabel || '',
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                });
            });

            // Order-level fees (DD digitizing, SPSU screen setup, itemized LTM…)
            (group.fees || []).forEach(function (f) {
                items.push({
                    QuoteID: p.quoteId,
                    LineNumber: lineNumber++,
                    StyleNumber: f.code,
                    ProductName: f.label || f.code,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'fee',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: 1,
                    HasLTM: 'No',
                    BaseUnitPrice: r2(f.amount),
                    LTMPerUnit: 0,
                    FinalUnitPrice: r2(f.amount),
                    LineTotal: r2(f.amount),
                    SizeBreakdown: '',
                    PricingTier: group.tierLabel || '',
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                });
            });
        });

        // ---------------- quote_sessions ----------------
        var expiresAt = isoNoMillis(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
        var notesJson = {
            channel: 'web-quote-cart',
            // Customer web quotes carry no shipping address yet, so no tax base
            // exists — the rep calculates WA sales tax + shipping at
            // confirmation. TaxRate/TaxAmount are saved as 0 by design.
            taxNote: 'Tax calculated by your rep when the quote is confirmed.',
            customerNotes: customer.notes || '',
            groups: (result.groups || []).map(function (g) {
                return {
                    groupId: g.groupId,
                    method: g.method,
                    tierLabel: g.tierLabel,
                    pooledQty: g.pooledQty,
                    groupTotal: g.groupTotal,
                    options: groupsCfg[g.groupId] || {}
                };
            }),
            artworkKeys: artwork.map(function (a) {
                return { groupId: a.groupId, externalKey: a.externalKey, fileName: a.fileName, url: a.url };
            })
        };

        // NOTE: method-specific session columns (PrintLocation, StitchCount,
        // Cap*, AL*) are deliberately ABSENT — phantom defaults poisoned
        // production notes on staff quotes (2026-06-04 lesson). All structure
        // lives in the item rows + Notes JSON.
        var session = {
            QuoteID: p.quoteId,
            SessionID: p.sessionId,
            CustomerEmail: customer.email || '',
            CustomerName: customer.name || 'Guest',
            CompanyName: customer.company || 'Not Provided',
            Phone: customer.phone || '',
            SalesRepEmail: 'sales@nwcustomapparel.com',
            SalesRepName: 'Web Quote',
            TotalQuantity: totalQuantity,
            // Readers' contract (quote-view/invoice): SubtotalAmount and
            // TotalAmount are the IDENTICAL pre-tax all-in amount the visible
            // line items foot to. Straight copy of the engine grand total.
            SubtotalAmount: r2(result.grandTotal),
            TotalAmount: r2(result.grandTotal),
            LTMFeeTotal: r2(ltmFeeTotal), // informational (baked fees live inside unit prices)
            TaxRate: 0,
            TaxAmount: 0,
            Status: 'Web Quote Request',
            CreatedAt_Quote: addedAt,
            ExpiresAt: expiresAt,
            Notes: JSON.stringify(notesJson),
            // Object-form ImportNotes — the proxy transformers already parse
            // referenceArtwork[] from this shape (Phase 11.3 convention).
            ImportNotes: JSON.stringify({
                importNotes: ['Web quote request from teamnwca.com quote cart.'],
                referenceArtwork: artwork.map(function (a) { return a.url; }),
                newDesignName: ''
            })
        };

        return { session: session, items: items };
    };

    /**
     * FOOTING ASSERT — the only summing in this file: each group's rows must
     * foot to the engine's groupTotal (±$0.02 LTM amortization drift), and all
     * rows to grandTotal. Returns { ok, detail }.
     */
    WebQuoteService.prototype.assertFooting = function (result, items) {
        var byGroup = {};
        var idx = 0;
        // Rows were emitted group-by-group in result.groups order; re-walk the
        // same order to slice them per group.
        for (var g = 0; g < (result.groups || []).length; g++) {
            var group = result.groups[g];
            var rowCount = (group.lines || []).length + (group.serviceLines || []).length + (group.fees || []).length;
            var sum = 0;
            for (var i = 0; i < rowCount; i++) sum += items[idx + i].LineTotal;
            idx += rowCount;
            byGroup[group.groupId] = { sum: r2(sum), expected: group.groupTotal };
            if (Math.abs(sum - group.groupTotal) > FOOTING_TOLERANCE) {
                return {
                    ok: false,
                    detail: group.groupId + ' rows foot to $' + r2(sum).toFixed(2) +
                        ' but the engine group total is $' + group.groupTotal.toFixed(2)
                };
            }
        }
        var grand = items.reduce(function (s, it) { return s + it.LineTotal; }, 0);
        var grandTol = FOOTING_TOLERANCE * Math.max(1, (result.groups || []).length);
        if (result.grandTotal != null && Math.abs(grand - result.grandTotal) > grandTol) {
            return {
                ok: false,
                detail: 'All rows foot to $' + r2(grand).toFixed(2) +
                    ' but the engine grand total is $' + result.grandTotal.toFixed(2)
            };
        }
        return { ok: true, byGroup: byGroup };
    };

    /**
     * Upload one artwork file to the proxy files API (the proven custom-tees
     * pattern: POST /api/files/upload multipart, 20 MB cap enforced by caller,
     * hosted at {apiBase}/api/files/{externalKey}).
     */
    WebQuoteService.prototype.uploadArtwork = async function (file) {
        var fd = new FormData();
        fd.append('file', file);
        var resp = await this.fetch(this.apiBase + '/api/files/upload', { method: 'POST', body: fd });
        if (!resp.ok) throw new Error('Upload failed (' + resp.status + ')');
        var data = await resp.json();
        if (!data.externalKey) throw new Error('Upload response missing externalKey');
        return {
            externalKey: data.externalKey,
            fileName: data.fileName || file.name,
            url: this.apiBase + '/api/files/' + data.externalKey
        };
    };

    /** Fetch with retry on 5xx/429/network (embroidery-quote-service pattern,
     *  trimmed). The FINAL failed 5xx response is RETURNED (callers branch on
     *  resp.ok); only repeated network errors throw. */
    WebQuoteService.prototype._fetchWithRetry = async function (url, options, maxRetries) {
        maxRetries = maxRetries == null ? 2 : maxRetries;
        var lastError;
        for (var attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                var response = await this.fetch(url, options);
                if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                    return response;
                }
                if (attempt === maxRetries) return response;
                lastError = new Error('HTTP ' + response.status);
            } catch (networkError) {
                lastError = networkError;
                if (attempt === maxRetries) throw lastError;
            }
            await new Promise(function (r) { setTimeout(r, 1000 * Math.pow(2, attempt)); });
        }
        throw lastError;
    };

    /**
     * Save the cart as a frozen WQ quote.
     *
     * @param {Object} p {
     *   cart: { items (engine-ready), groups (groupId → options) },
     *   storeItems: QuoteCartStore items (display fields),
     *   displayedResult: the engine result the customer is LOOKING AT,
     *   customer: { name, email, phone, company, notes },
     *   artwork: [{groupId, externalKey, fileName, url}],
     *   engineOptions: { deps } passed through to priceCart,
     *   dryRun: log payloads instead of POSTing (preview walk-throughs)
     * }
     * @returns {Promise<Object>} success path: { success:true, quoteId,
     *   shareUrl, sharePath, result, idFallback, partialSave?, warning? }
     *   gates: { success:false, code:'PRICING_CHANGED', fresh } |
     *          { success:false, code:'PRICING_FAILED'|'FOOTING_MISMATCH'|'SAVE_FAILED', message }
     */
    WebQuoteService.prototype.saveQuote = async function (p) {
        p = p || {};
        if (!this.engine || typeof this.engine.priceCart !== 'function') {
            return { success: false, code: 'NO_ENGINE', message: 'Quote engine unavailable — refresh the page.' };
        }

        // 1-2. Fresh reprice + parity gate ---------------------------------
        var fresh = await this.engine.priceCart(p.cart, Object.assign({}, p.engineOptions || {}, { forceRefresh: true }));
        if (fresh.grandTotal == null || (fresh.errors || []).length > 0) {
            var msg = (fresh.errors && fresh.errors[0] && fresh.errors[0].message) || 'Pricing failed.';
            return { success: false, code: 'PRICING_FAILED', message: msg, fresh: fresh };
        }
        var displayed = p.displayedResult;
        if (displayed && displayed.grandTotal != null) {
            var displayedByGid = {};
            (displayed.groups || []).forEach(function (g) { displayedByGid[g.groupId] = g.groupTotal; });
            var changed = [];
            (fresh.groups || []).forEach(function (g) {
                var was = displayedByGid[g.groupId];
                if (was == null || Math.abs(was - g.groupTotal) > PARITY_TOLERANCE) {
                    changed.push({ groupId: g.groupId, was: was, now: g.groupTotal });
                }
            });
            if (changed.length > 0 || Math.abs(displayed.grandTotal - fresh.grandTotal) > PARITY_TOLERANCE) {
                return { success: false, code: 'PRICING_CHANGED', fresh: fresh, changed: changed };
            }
        }

        // 3. Payloads from the FRESH result --------------------------------
        var idInfo = await this.generateQuoteID();
        var payloads = this.buildPayloads({
            quoteId: idInfo.quoteId,
            sessionId: this.generateSessionID(),
            result: fresh,
            storeItems: p.storeItems || [],
            groups: (p.cart && p.cart.groups) || {},
            customer: p.customer || {},
            artwork: p.artwork || []
        });

        // 4. Footing assert -------------------------------------------------
        var footing = this.assertFooting(fresh, payloads.items);
        if (!footing.ok) {
            console.error('[WebQuoteService] FOOTING_MISMATCH:', footing.detail);
            return { success: false, code: 'FOOTING_MISMATCH', message: 'Quote rows did not foot to the engine total — save aborted. ' + footing.detail };
        }

        var sharePath = '/quote/' + idInfo.quoteId;
        var siteOrigin = (global.APP_CONFIG && global.APP_CONFIG.SITE_ORIGIN) ||
            (global.location && global.location.origin) || 'https://www.teamnwca.com';
        var shareUrl = siteOrigin + sharePath;

        // Dry-run: log + return payloads, POST nothing (used by preview
        // walk-throughs; the orchestrator does the single real E2E save).
        if (this.dryRun || p.dryRun) {
            console.log('[WebQuoteService] DRY RUN — quote_sessions payload:', payloads.session);
            console.log('[WebQuoteService] DRY RUN — quote_items payloads (' + payloads.items.length + '):', payloads.items);
            return { success: true, dryRun: true, quoteId: idInfo.quoteId, shareUrl: shareUrl, sharePath: sharePath, idFallback: idInfo.usedFallback, result: fresh, payloads: payloads };
        }

        // 5. POST session, then items ---------------------------------------
        var sessionResp;
        try {
            sessionResp = await this._fetchWithRetry(this.apiBase + '/api/quote_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloads.session)
            });
        } catch (netErr) {
            return { success: false, code: 'SAVE_FAILED', message: 'Could not reach the quote service — nothing was saved. ' + netErr.message };
        }
        if (!sessionResp.ok) {
            var errText = '';
            try { errText = await sessionResp.text(); } catch (e) { /* best effort */ }
            return { success: false, code: 'SAVE_FAILED', message: 'Could not save the quote (' + sessionResp.status + '). ' + errText };
        }

        var failedItems = 0;
        for (var i = 0; i < payloads.items.length; i++) {
            try {
                var itemResp = await this._fetchWithRetry(this.apiBase + '/api/quote_items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloads.items[i])
                });
                if (!itemResp.ok) {
                    failedItems++;
                    console.error('[WebQuoteService] Item save failed (line ' + payloads.items[i].LineNumber + '): HTTP ' + itemResp.status);
                }
            } catch (e2) {
                failedItems++;
                console.error('[WebQuoteService] Item save failed (line ' + payloads.items[i].LineNumber + '):', e2);
            }
        }

        return {
            success: true,
            quoteId: idInfo.quoteId,
            shareUrl: shareUrl,
            sharePath: sharePath,
            idFallback: idInfo.usedFallback,
            result: fresh,
            partialSave: failedItems > 0,
            warning: failedItems > 0
                ? failedItems + ' of ' + payloads.items.length + ' lines failed to save — our team will verify your quote.'
                : null
        };
    };

    /**
     * Fire-and-forget notification emails per the locked decision:
     * (1) immediate customer copy with the share link, (2) the same existing
     * template addressed to sales@nwcustomapparel.com (reply-to = customer so
     * the rep replies straight to them). Reuses template_quote_email — the
     * builders' generic customer quote-link template. NEVER throws; an email
     * failure never fails a save.
     * @returns {Promise<{customerSent:boolean, salesSent:boolean, skipped:boolean}>}
     */
    WebQuoteService.prototype.sendEmails = async function (p) {
        p = p || {};
        var out = { customerSent: false, salesSent: false, skipped: false };
        if (this.dryRun || p.dryRun) {
            console.log('[WebQuoteService] DRY RUN — emails suppressed (would notify ' +
                ((p.customer && p.customer.email) || 'customer') + ' + sales@nwcustomapparel.com).');
            out.skipped = true;
            return out;
        }
        if (!this.emailjs || typeof this.emailjs.send !== 'function') {
            console.warn('[WebQuoteService] EmailJS not loaded — skipping notification emails.');
            out.skipped = true;
            return out;
        }
        var customer = p.customer || {};
        var common = {
            quote_id: p.quoteId,
            quote_link: p.shareUrl,
            company_name: 'Northwest Custom Apparel',
            company_phone: '253-922-5793'
        };
        if (customer.email) {
            try {
                await this.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_QUOTE, Object.assign({
                    to_email: customer.email,
                    customer_name: customer.name || 'Customer',
                    reply_to: 'sales@nwcustomapparel.com'
                }, common));
                out.customerSent = true;
            } catch (e) {
                console.error('[WebQuoteService] Customer email failed:', e);
            }
        }
        try {
            var who = (customer.name || 'a customer') + (customer.company ? ' (' + customer.company + ')' : '');
            await this.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_QUOTE, Object.assign({
                to_email: 'sales@nwcustomapparel.com',
                customer_name: 'NWCA Sales — new web quote from ' + who,
                reply_to: customer.email || 'sales@nwcustomapparel.com'
            }, common));
            out.salesSent = true;
        } catch (e2) {
            console.error('[WebQuoteService] Sales notification email failed:', e2);
        }
        return out;
    };

    // Exposed for tests
    WebQuoteService._internals = {
        parseLabelToSizeBreakdown: parseLabelToSizeBreakdown,
        locationFields: locationFields,
        METHOD_EMBELLISHMENT: METHOD_EMBELLISHMENT,
        PARITY_TOLERANCE: PARITY_TOLERANCE,
        FOOTING_TOLERANCE: FOOTING_TOLERANCE,
        EMAILJS_SERVICE_ID: EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_QUOTE: EMAILJS_TEMPLATE_QUOTE
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WebQuoteService;
    }
    global.WebQuoteService = WebQuoteService;
})(typeof window !== 'undefined' ? window : globalThis);
