/**
 * dtg-inline-form.js — Vanilla-JS DTG order form for /quote-builders/dtg-quote-builder.html.
 *
 * Replaces the iframed legacy Bootstrap form. Mirrors the order-form UX patterns:
 *  - Customer combobox (calls /api/company-contacts-2026/search exactly like order-form)
 *  - Style search (calls /api/stylesearch)
 *  - Color picker (calls /api/product-colors, renders real swatches)
 *  - Multi-row table with size-grid columns
 *  - Live price preview via window.DTGPricingService (the SAME service /pricing/dtg uses)
 *  - Submit to ShopWorks via /api/submit-order-form (the SAME endpoint the order form uses)
 *
 * Exposes a small DOM-scoped API the chat controller can call:
 *
 *   window.DTGInlineForm = {
 *     fillFromQuote(priceQuote, customerFinal),  // chat → form
 *     getState(),
 *     resetForm(),
 *     submitToShopWorks(),                       // also called by the visible button
 *   };
 *
 * Pricing math is the single canonical formula (driven by Caspio Pricing_Tiers):
 *   garmentCost / tier.MarginDenominator + sum(printCosts) → Math.ceil(*2)/2 → + size upcharges
 *   LTM (resolved tier has LTM_Fee > 0): floor((tier.LTM_Fee / qty) * 100) / 100 per piece.
 * Backed by window.DTGPricingService for the live preview, and by
 * POST /api/dtg/quote-pricing on submit so the wire-side price matches.
 */

(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const SUBMIT_URL = '/api/submit-order-form'; // relative — same-origin (sanmar-inventory-app)

    const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

    // Sales reps — mirrors pages/order-form/components/paper-form.jsx:2128-2132.
    // Tech debt: if a 6th rep joins, edit this list AND the order form's list.
    // No /api/sales-reps endpoint today.
    const SALES_REPS = [
        { code: 'nika',     name: 'Nika Lao',       email: 'nika@nwcustomapparel.com' },
        { code: 'erik',     name: 'Erik Mickelson', email: 'erik@nwcustomapparel.com' },
        { code: 'ruth',     name: 'Ruthie Nhoung',  email: 'ruth@nwcustomapparel.com' },
        { code: 'taneisha', name: 'Taneisha Clark', email: 'taneisha@nwcustomapparel.com' },
        { code: 'jim',      name: 'Jim Mickelson',  email: 'jim@nwcustomapparel.com' },
    ];
    function repByCode(code) {
        return SALES_REPS.find(r => r.code === code) || SALES_REPS[1]; // default Erik
    }

    // Shipping methods — match the order form (paper-form.jsx:2371).
    const SHIP_METHODS = [
        { code: 'ups',      label: 'UPS Ground' },
        { code: 'pickup',   label: 'Customer Pickup' },
        { code: 'willcall', label: 'Will Call' },
        { code: 'other',    label: 'Other' },
    ];
    function shipLabel(code) {
        const m = SHIP_METHODS.find(x => x.code === code);
        return m ? m.label : 'UPS Ground';
    }

    // sessionStorage key prefix + state-shape version (bump if state shape
    // changes incompatibly so old restores don't crash).
    const STATE_VERSION = 1;
    const STATE_KEY = 'dtg.formState.v' + STATE_VERSION;
    const QUOTEID_KEY = 'dtg.quoteID.v' + STATE_VERSION;

    const LOCATION_LABELS = {
        LC: 'Left Chest',
        FF: 'Full Front',
        JF: 'Jumbo Front',
        FB: 'Full Back',
        JB: 'Jumbo Back',
    };
    const FRONT_LOCATIONS = [
        { code: 'LC', label: 'Left Chest', dim: '4″×4″' },
        { code: 'FF', label: 'Full Front', dim: '12″×16″' },
        { code: 'JF', label: 'Jumbo Front', dim: '16″×20″' },
    ];
    const BACK_LOCATIONS = [
        { code: 'FB', label: 'Full Back', dim: '12″×16″' },
        { code: 'JB', label: 'Jumbo Back', dim: '16″×20″' },
    ];

    // ----- Caches (same pattern as line-items.jsx in order form) -------------
    const _styleSearchCache = new Map(); // query → [{value,label}]
    const _colorsCache = new Map();      // style → {colors, productTitle}
    const _companySearchCache = new Map(); // query → [{Company_Name, contacts, ...}]
    const _bundleCache = new Map();      // style → bundle (for live preview math)

    // ----- State -------------------------------------------------------------
    // Restore last-used sales rep from localStorage (per-rep preference,
    // not per-quote — survives page refresh AND across quotes).
    const lastRepCode = (function () {
        try { return localStorage.getItem('dtg.lastSalesRep') || ''; }
        catch { return ''; }
    })();

    const state = {
        formVersion: STATE_VERSION,
        front: 'LC',
        back: '',
        rows: [],
        customer: {
            company: '',
            companyId: '',  // ManageOrders id_Customer
            contactId: '',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            designNumber: '',
            terms: 'Prepaid',
            contacts: [],   // populated when a company is picked
            salesRepCode: lastRepCode || 'erik', // A1
        },
        shipping: {
            method: 'ups', // A2 — UPS Ground default; pickup / willcall / other
        },
        submitting: false,
        // C9 dirty-tracking: set to true when the rep touches any form field
        // AFTER the chat last filled it. Cleared when chat re-fills (with
        // confirmation) or when rep resets. Used to gate fillFromQuote()
        // overwrites.
        dirtyAfterChatFill: false,
        // B5 retry: cached payload for the last submit attempt + its pricing
        // result so Retry doesn't re-fetch /api/dtg/quote-pricing.
        lastSubmit: null, // { body, pricing }
    };

    function newBlankRow() {
        return {
            id: 'r-' + Math.random().toString(36).slice(2, 10),
            style: '',
            styleUpper: '',
            desc: '',
            color: '',         // COLOR_NAME
            catalogColor: '',  // CATALOG_COLOR (for ShopWorks)
            colorSwatch: '',   // small swatch image url
            colorsAvailable: [],
            sizes: {},         // { S: 4, M: 8, ... }
            availableSizes: [],
            // Inventory state populated by kickInventoryFetch() after a style+
            // color pick. Mirrors the order form's row.inventory shape so the
            // sz-inv-badge classes (good/low/over/oos/unknown) work the same.
            inventory: { bySize: {}, status: 'unknown', grandTotal: 0 },
        };
    }

    // ----- C9 dirty tracking ------------------------------------------------
    // Mark the form as having rep-edits since the last chat fill. Used to
    // guard against silent overwrite when the chat emits a new PRICE_QUOTE
    // while the rep is editing.
    function markDirty() { state.dirtyAfterChatFill = true; }
    function clearDirty() { state.dirtyAfterChatFill = false; }

    // ----- C8 bulk size paste -----------------------------------------------
    // Parses "S:2 M:4 L:6 2XL:1" (and variants with /, -, =, comma, semicolon
    // separators) into { S: 2, M: 4, L: 6, '2XL': 1 }. Returns empty object if
    // the text doesn't look like a size list (so plain paste falls through).
    function parseBulkSizes(text) {
        const result = {};
        // Tokens: SIZE [:/=\-\s] QTY  separated by [,;\s]
        // Size names: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL (case insensitive)
        const re = /\b(XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL|XXL)\s*[:\/\-=]\s*(\d{1,4})\b/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
            let key = m[1].toUpperCase();
            if (key === 'XXL') key = '2XL'; // standardize
            const q = parseInt(m[2], 10);
            if (Number.isFinite(q) && q >= 0) result[key] = q;
        }
        return result;
    }

    function showToastSafe(text) {
        const toast = document.getElementById('shareToast');
        const txt = document.getElementById('shareToastText');
        if (!toast || !txt) {
            // Fallback — log
            console.info('[dtg-inline-form]', text);
            return;
        }
        txt.textContent = text;
        toast.classList.add('show');
        clearTimeout(showToastSafe._t);
        showToastSafe._t = setTimeout(() => toast.classList.remove('show'), 2800);
    }

    // ----- B4 sessionStorage persistence -----------------------------------
    // Save a slim snapshot of the form state every 500ms (debounced). Rep
    // refreshes the browser → next page load offers to restore. Stops the
    // "I closed my tab and lost 10 minutes of work" disaster.
    let _saveTimer = null;
    function scheduleStateSave() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
            try {
                sessionStorage.setItem(STATE_KEY, JSON.stringify({
                    v: STATE_VERSION,
                    savedAt: Date.now(),
                    front: state.front,
                    back: state.back,
                    rows: state.rows.map(r => ({
                        // Strip transient + heavy fields (inventory, colorsAvailable
                        // are re-hydrated on restore; _perPiece/_lineTotal are
                        // recomputed by updateLivePrices).
                        style: r.style,
                        color: r.color,
                        catalogColor: r.catalogColor,
                        colorSwatch: r.colorSwatch,
                        desc: r.desc,
                        sizes: r.sizes,
                        availableSizes: r.availableSizes,
                    })),
                    customer: state.customer,
                    shipping: state.shipping,
                }));
            } catch (e) { /* quota or disabled storage — ignore */ }
        }, 500);
    }

    // Attempt to restore form state from sessionStorage. Returns true if
    // something was restored (so the caller can show the "Resumed" banner).
    function restoreStateFromSession() {
        try {
            const raw = sessionStorage.getItem(STATE_KEY);
            if (!raw) return false;
            const snap = JSON.parse(raw);
            if (!snap || snap.v !== STATE_VERSION) {
                sessionStorage.removeItem(STATE_KEY);
                return false;
            }
            if (Array.isArray(snap.rows) && snap.rows.length > 0) {
                state.rows = snap.rows.map(r => {
                    const fresh = newBlankRow();
                    return { ...fresh, ...r };
                });
                state.front = snap.front || 'LC';
                state.back = snap.back || '';
                if (snap.customer) state.customer = { ...state.customer, ...snap.customer };
                if (snap.shipping) state.shipping = { ...state.shipping, ...snap.shipping };
                return true;
            }
        } catch (e) {
            // Corrupt JSON / quota error — nuke it and start fresh.
            try { sessionStorage.removeItem(STATE_KEY); } catch {}
        }
        return false;
    }

    function clearSessionState() {
        try {
            sessionStorage.removeItem(STATE_KEY);
            sessionStorage.removeItem(QUOTEID_KEY);
        } catch {}
        try { delete window.__dtgQuoteID; } catch {}
    }

    // Read the AI quoteID. Prefers window scope (set by the chat controller
    // when a PRICE_QUOTE block arrives), falls back to sessionStorage so it
    // survives page refresh.
    function getQuoteID() {
        if (window.__dtgQuoteID) return window.__dtgQuoteID;
        try { return sessionStorage.getItem(QUOTEID_KEY) || ''; }
        catch { return ''; }
    }
    function setQuoteID(qid) {
        if (!qid) return;
        window.__dtgQuoteID = qid;
        try { sessionStorage.setItem(QUOTEID_KEY, qid); } catch {}
    }

    // Fetch SanMar inventory for a row's style+catalogColor combo via the
    // shared window.OrderFormInventory module. Idempotent; results are cached
    // 5 min in the inventory module itself, so calling on every input event
    // is cheap. Re-renders the table when the data lands.
    async function kickInventoryFetch(row) {
        if (!row || !row.style || !row.catalogColor) return;
        if (!window.OrderFormInventory || typeof window.OrderFormInventory.getInventoryForRow !== 'function') {
            return; // graceful — script not loaded
        }
        try {
            const result = await window.OrderFormInventory.getInventoryForRow(
                row.style, row.catalogColor
            );
            // Only update if this row is still in state (rep didn't remove it
            // while the fetch was in flight).
            const current = state.rows.find(r => r.id === row.id);
            if (current) {
                current.inventory = result || { bySize: {}, status: 'unknown' };
                renderTable();
            }
        } catch (err) {
            console.warn('[dtg-inline-form] inventory fetch failed', err);
        }
    }

    function effectiveLocationCode() {
        if (!state.front) return '';
        if (state.back) return `${state.front}_${state.back}`;
        return state.front;
    }
    function effectiveLocationLabel() {
        const code = effectiveLocationCode();
        if (!code) return '—';
        if (code.includes('_')) {
            const parts = code.split('_').map((c) => LOCATION_LABELS[c] || c);
            return parts.join(' + ');
        }
        return LOCATION_LABELS[code] || code;
    }

    function combinedQty() {
        // Exclude invalid-color rows from the tier / piece count. They're
        // not real orders until the rep picks a valid catalog color.
        return state.rows.reduce((sum, r) => {
            if (isRowColorInvalid(r)) return sum;
            return sum + Object.values(r.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        }, 0);
    }

    /**
     * Is this row's color valid?
     *
     * A row is INVALID when the rep typed a color the catalog doesn't have:
     *   row.color === "Pink" + row.catalogColor === ""  → invalid
     * vs VALID when the rep picked from the dropdown (which sets both):
     *   row.color === "Jet Black" + row.catalogColor === "Jet Black"
     * OR when the row is partially filled (no style/color yet, mid-typing):
     *   row.color === ""  → not invalid (just incomplete)
     *
     * Used by:
     *   - updateLivePrices() to skip invalid rows in the dollar total
     *   - updateSubmitEnabled() to disable Submit when any row is invalid
     *   - renderTable() to render a red ⚠ warning next to the bad cell
     */
    function isRowColorInvalid(row) {
        if (!row) return false;
        // Empty color is not invalid — just incomplete
        if (!row.color || String(row.color).trim().length === 0) return false;
        // Style not yet picked — color hasn't had a chance to validate
        if (!row.style) return false;
        // colorsAvailable not hydrated yet (still fetching) — defer judgment
        if (!Array.isArray(row.colorsAvailable) || row.colorsAvailable.length === 0) return false;
        // Color is set but no catalogColor → no dropdown match → invalid
        return !row.catalogColor || String(row.catalogColor).trim().length === 0;
    }

    // ----- Fetchers ----------------------------------------------------------
    async function fetchStyleSearch(q) {
        const key = q.toLowerCase();
        if (_styleSearchCache.has(key)) return _styleSearchCache.get(key);
        try {
            const r = await fetch(`${API_BASE}/api/stylesearch?term=${encodeURIComponent(q)}`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const results = Array.isArray(data) ? data : (data.results || []);
            _styleSearchCache.set(key, results);
            return results;
        } catch (err) {
            console.error('[dtg-inline-form] style search failed:', err);
            return [];
        }
    }

    /**
     * Find the best matching color in a SanMar color list for a free-form query.
     *
     * The bot frequently emits rep-shorthand like "black" / "navy" / "athl heather"
     * but SanMar's canonical COLOR_NAME is "Jet Black" / "True Navy" / "Athletic
     * Heather". An exact-match lookup leaves `catalogColor` empty, which breaks
     * the ShopWorks push (and the inventory badge, and the swatch image).
     *
     * Strategy (first hit wins):
     *   1. Exact case-insensitive match.
     *   2. Whole-word match (\bblack\b) → prefer shortest canonical (the "plain" one).
     *   3. Substring contains (q in name) → prefer shortest.
     *   4. Reverse contains (name in q) → prefer longest (most specific).
     *   5. null — leave it, the rep can click a swatch.
     */
    function fuzzyMatchColor(colorsList, query) {
        if (!Array.isArray(colorsList) || !colorsList.length) return null;
        const q = String(query || '').trim().toLowerCase();
        if (!q) return null;
        // Handle BOTH shapes: SanMar's /api/product-colors returns
        // { COLOR_NAME, CATALOG_COLOR, COLOR_SQUARE_IMAGE } whereas the bot's
        // lookup_product_details tool returns { name, catalogColor,
        // swatchImageUrl, mainImageUrl }. fillFromQuote uses the first
        // shape; previewStyle uses the second.
        const norm = (c) => String(c.COLOR_NAME || c.colorName || c.name || '').trim();

        // 1. exact match (case-insensitive)
        const exact = colorsList.find((c) => norm(c).toLowerCase() === q);
        if (exact) return exact;

        // 2. multi-word query: score canonical colors by how many of the query's
        //    words match. "athletic heather" against ["Athletic Heather",
        //    "Black Heather", "Dark Heather Grey"] → AH=2, BH=1, DHG=1, AH wins.
        //    Fixes a bug where rep typed "athletic heather" but the matcher
        //    picked "Black Heather" because shortest-length sort came first.
        const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryWords = (q.match(/[a-z]+/g) || []).filter((w) => w.length >= 3);
        if (queryWords.length > 1) {
            const scored = colorsList.map((c) => {
                const name = norm(c).toLowerCase();
                let hits = 0;
                for (const w of queryWords) {
                    if (new RegExp('\\b' + escapeRe(w) + '\\b').test(name)) hits++;
                }
                return { c, hits, len: name.length };
            }).filter((s) => s.hits > 0);
            if (scored.length) {
                scored.sort((a, b) => (b.hits - a.hits) || (a.len - b.len));
                return scored[0].c;
            }
        }
        // Single-word query: original whole-word match, shortest wins.
        const wordRe = new RegExp('\\b' + escapeRe(q) + '\\b', 'i');
        const wordHits = colorsList.filter((c) => wordRe.test(norm(c)));
        if (wordHits.length) {
            wordHits.sort((a, b) => norm(a).length - norm(b).length);
            return wordHits[0];
        }

        // 3. substring contains — "athl heather" finds "Athletic Heather"
        const containsHits = colorsList.filter((c) => norm(c).toLowerCase().includes(q));
        if (containsHits.length) {
            containsHits.sort((a, b) => norm(a).length - norm(b).length);
            return containsHits[0];
        }

        // 4. reverse contains — "navy blue" finds "Navy"
        const reverseHits = colorsList.filter((c) => {
            const n = norm(c).toLowerCase();
            return n && q.includes(n);
        });
        if (reverseHits.length) {
            reverseHits.sort((a, b) => norm(b).length - norm(a).length);
            return reverseHits[0];
        }

        return null;
    }

    async function fetchProductColors(style) {
        const sn = String(style || '').trim().toUpperCase();
        if (!sn) return { colors: [], productTitle: '' };
        if (_colorsCache.has(sn)) return _colorsCache.get(sn);
        try {
            const r = await fetch(`${API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(sn)}`);
            if (r.status === 404) {
                const empty = { colors: [], productTitle: '' };
                _colorsCache.set(sn, empty);
                return empty;
            }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const result = {
                colors: (data && data.colors) || [],
                productTitle: (data && data.productTitle) || '',
            };
            _colorsCache.set(sn, result);
            return result;
        } catch (err) {
            console.error('[dtg-inline-form] product-colors failed:', err);
            return { colors: [], productTitle: '' };
        }
    }

    async function fetchCompanies(q) {
        const key = q.toLowerCase();
        if (_companySearchCache.has(key)) return _companySearchCache.get(key);
        try {
            const r = await fetch(`${API_BASE}/api/company-contacts-2026/search?q=${encodeURIComponent(q)}&limit=10`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const results = Array.isArray(data && data.companies) ? data.companies : [];
            _companySearchCache.set(key, results);
            return results;
        } catch (err) {
            console.error('[dtg-inline-form] company search failed:', err);
            return [];
        }
    }

    async function fetchBundle(style) {
        const sn = String(style || '').trim().toUpperCase();
        if (!sn) return null;
        if (_bundleCache.has(sn)) return _bundleCache.get(sn);
        if (!window.DTGPricingService) {
            console.warn('[dtg-inline-form] window.DTGPricingService unavailable — preview disabled');
            return null;
        }
        try {
            const svc = new window.DTGPricingService();
            const b = await svc.fetchPricingData(sn);
            if (b) _bundleCache.set(sn, b);
            return b;
        } catch (err) {
            console.error('[dtg-inline-form] bundle fetch failed:', err);
            return null;
        }
    }

    // ----- Render ------------------------------------------------------------
    function render() {
        const host = document.getElementById('dtgInlineFormMount');
        if (!host) {
            console.warn('[dtg-inline-form] mount point #dtgInlineFormMount not found');
            return;
        }
        host.innerHTML = `
            <div class="dtg-form-wrap">
                <header class="dtg-form-header">
                    <div class="dfh-title"><i class="fas fa-clipboard-list"></i> DTG order form</div>
                    <div class="dfh-sub">
                        <strong>Every field is editable.</strong> After the AI fills it, you can swap colors, change sizes, add or remove rows, switch print location, or edit the customer/design # — then click Submit. Same canonical pricing as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> and the order form.
                    </div>
                </header>
                <!-- Inline resume banner — only shown when restoreStateFromSession()
                     restored a saved state. Empty placeholder otherwise. -->
                <div id="dtgResumeBannerMount"></div>

                <section class="dtg-form-section">
                    <div class="dfs-label"><i class="fas fa-print"></i> Print location (shared across all rows)</div>
                    <div class="dtg-location-row">
                        <div class="dlr-group">
                            <div class="dlr-group-label">FRONT (pick one)</div>
                            <div class="dlr-options" id="dtgFrontOptions"></div>
                        </div>
                        <div class="dlr-group">
                            <div class="dlr-group-label">BACK (optional)</div>
                            <div class="dlr-options" id="dtgBackOptions"></div>
                        </div>
                        <div class="dtg-location-summary" id="dtgLocationSummary"></div>
                    </div>
                </section>

                <div class="dtg-form-body">
                    <div class="dtg-rows-pane">
                        <div class="dfs-label" style="margin-bottom:8px;"><i class="fas fa-list"></i> Line items</div>
                        <div style="overflow-x:auto;">
                            <table class="dtg-rows-table" id="dtgRowsTable">
                                <thead></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <button type="button" class="dtg-add-row-btn" id="dtgAddRowBtn"><i class="fas fa-plus"></i> Add row</button>

                        <div id="dtgPriceSummary" class="dtg-price-summary"></div>
                    </div>

                    <aside class="dtg-customer-pane dcp-horizontal">
                        <div class="dcp-label"><i class="fas fa-building"></i> Customer + push</div>
                        <div class="dcp-search-label">Search customer</div>
                        <div class="dtg-combobox" id="dtgCompanyCombo">
                            <input type="text" id="dtgCompanyInput" autocomplete="off" placeholder="Company name or contact…">
                        </div>

                        <div class="dcp-divider">Or fill manually</div>

                        <div class="dcp-manual">
                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">First name</div>
                                    <input type="text" id="dtgFirstName" autocomplete="off">
                                </div>
                                <div>
                                    <div class="dcp-field-label">Last name</div>
                                    <input type="text" id="dtgLastName" autocomplete="off">
                                </div>
                            </div>
                            <div class="dcp-field-wrap dcp-field-email">
                                <div class="dcp-field-label">Email</div>
                                <input type="email" id="dtgEmail" autocomplete="off">
                            </div>
                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">Phone</div>
                                    <input type="tel" id="dtgPhone" autocomplete="off">
                                </div>
                                <div>
                                    <div class="dcp-field-label">Company ID (optional)</div>
                                    <input type="text" id="dtgCompanyId" autocomplete="off" placeholder="ShopWorks ID">
                                </div>
                            </div>
                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">Design # <span class="dcp-optional">(optional)</span></div>
                                    <input type="text" id="dtgDesignNumber" autocomplete="off" placeholder="add later if TBD">
                                </div>
                                <div>
                                    <div class="dcp-field-label">Payment terms</div>
                                    <select id="dtgTerms">
                                        <option value="Prepaid">Prepaid</option>
                                        <option value="Net 10">Net 10</option>
                                        <option value="Net 30">Net 30</option>
                                        <option value="Pay On Pickup">Pay On Pickup</option>
                                    </select>
                                </div>
                            </div>

                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">Sales rep</div>
                                    <select id="dtgSalesRep">
                                        ${SALES_REPS.map(r => `<option value="${escapeHtml(r.code)}"${state.customer.salesRepCode === r.code ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <div class="dcp-field-label">Ship method</div>
                                    <select id="dtgShipMethod">
                                        ${SHIP_METHODS.map(m => `<option value="${escapeHtml(m.code)}"${state.shipping.method === m.code ? ' selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div id="dtgValidationBanner" class="dtg-validation-banner" hidden></div>

                        <button type="button" class="dtg-submit-btn" id="dtgSubmitBtn">
                            <i class="fas fa-truck"></i> Submit to ShopWorks
                        </button>
                        <div id="dtgSubmitStatus" class="dtg-submit-status" hidden></div>
                    </aside>
                </div>

                <footer class="dtg-form-foot">
                    <span>Canonical pricing — round to $0.50 ceiling. Same numbers as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> + order form.</span>
                    <button type="button" class="dff-reset-btn" id="dtgResetBtn">Reset form</button>
                </footer>
            </div>
        `;

        renderLocationPills();
        renderTable();
        renderSummary();
        wireGlobalHandlers();
    }

    function renderLocationPills() {
        const frontEl = document.getElementById('dtgFrontOptions');
        const backEl = document.getElementById('dtgBackOptions');
        if (!frontEl || !backEl) return;
        frontEl.innerHTML = FRONT_LOCATIONS.map((loc) => `
            <button type="button" class="dtg-location-pill${state.front === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="front">
                ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
            </button>
        `).join('');
        backEl.innerHTML = `
            <button type="button" class="dtg-location-pill${state.back === '' ? ' selected' : ''}" data-loc-code="" data-loc-group="back">
                None
            </button>
        ` + BACK_LOCATIONS.map((loc) => `
            <button type="button" class="dtg-location-pill${state.back === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="back">
                ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
            </button>
        `).join('');

        const sum = document.getElementById('dtgLocationSummary');
        if (sum) {
            const code = effectiveLocationCode();
            sum.innerHTML = `
                <div>${escapeHtml(effectiveLocationLabel())}</div>
                <span class="dls-code">Code: ${escapeHtml(code || '—')}</span>
            `;
        }

        frontEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.front = btn.getAttribute('data-loc-code') || 'LC';
                markDirty();
                scheduleStateSave();
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
        backEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.back = btn.getAttribute('data-loc-code') || '';
                markDirty();
                scheduleStateSave();
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
    }

    function renderTable() {
        const table = document.getElementById('dtgRowsTable');
        if (!table) return;
        // Determine which sizes any row has so we can show those columns.
        const sizesShown = collectSizesShown();
        const head = `
            <tr>
                <th>Style</th>
                <th>Description</th>
                <th>Color</th>
                ${sizesShown.map((s) => `<th class="size-col">${escapeHtml(s)}</th>`).join('')}
                <th class="total-col">Total</th>
                <th class="price-col">$/pc</th>
                <th></th>
            </tr>
        `;
        table.querySelector('thead').innerHTML = head;

        const tbody = table.querySelector('tbody');
        if (state.rows.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="${sizesShown.length + 5}" style="text-align:center;color:#9ca3af;font-style:italic;padding:18px;">Add a row to start — or open the AI chat (right) to draft a quote</td></tr>
            `;
            return;
        }
        tbody.innerHTML = state.rows.map((row) => {
            const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            const perPiece = row._perPiece;
            const inv = row.inventory || { bySize: {}, status: 'unknown' };
            const invKnown = inv.status === 'ok';
            const classify = (window.OrderFormInventory && window.OrderFormInventory.classifyInventory)
                || ((q, a) => Number.isFinite(Number(a)) ? (Number(a) === 0 ? 'oos' : (q > a ? 'over' : (q > a * 0.8 ? 'low' : 'good'))) : 'unknown');

            const sizeCells = sizesShown.map((sz) => {
                const qty = Number((row.sizes || {})[sz]) || 0;
                const avail = row.availableSizes && row.availableSizes.length > 0
                    ? row.availableSizes.includes(sz)
                    : true;
                if (!avail && row.style) {
                    // Product doesn't carry this size — render an N/A cell
                    // (matches the order form's .sz-unavail pattern).
                    return `<td class="size-col sz-unavail" title="${escapeHtml(row.style)} doesn't come in ${escapeHtml(sz)}"><span class="sz-na">N/A</span></td>`;
                }
                // Render input + inventory badge underneath if we have stock data.
                const invAvailable = inv.bySize ? inv.bySize[sz] : null;
                const showBadge = invKnown && Number.isFinite(Number(invAvailable));
                const klass = showBadge ? classify(qty, Number(invAvailable)) : 'unknown';
                const overflow = klass === 'over';
                const badge = showBadge
                    ? `<span class="sz-inv-badge sz-inv-${klass}" title="SanMar stock: ${Number(invAvailable).toLocaleString()} ${escapeHtml(sz)}${overflow ? ' — exceeds available' : ''}">${Number(invAvailable).toLocaleString()}</span>`
                    : '';
                return `<td class="size-col${overflow ? ' sz-overflow' : ''}">
                    <input type="number" min="0" step="1" value="${qty || ''}" data-row-id="${row.id}" data-size="${escapeHtml(sz)}">
                    ${badge}
                </td>`;
            }).join('');

            // Description tooltip for narrow viewports — hover the style cell
            // to see the product title even when the Description column is hidden.
            const styleTitle = row.desc
                ? `${row.style || ''} — ${row.desc}`
                : (row.style || '');
            // _aiTouched: timestamp set when previewStyle filled the row from a
            // chat tool. Render a small "AI is filling…" pulse for 2s then fade.
            const aiTouchedAgeMs = row._aiTouched ? Date.now() - row._aiTouched : 999999;
            const aiTouchClass = aiTouchedAgeMs < 2000 ? ' dtg-row-ai-touched' : '';
            return `
                <tr data-row-id="${escapeHtml(row.id)}" class="${aiTouchClass.trim()}">
                    <td class="dtg-row-style" title="${escapeHtml(styleTitle)}">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="style">
                            <input type="text" value="${escapeHtml(row.style)}" placeholder="PC54" autocomplete="off">
                        </div>
                    </td>
                    <td class="dtg-row-desc" title="${escapeHtml(row.desc || '')}">${escapeHtml(row.desc || '—')}</td>
                    <td class="dtg-row-color${isRowColorInvalid(row) ? ' dtg-row-color-invalid' : ''}">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="color">
                            ${row.colorSwatch
                                ? `<span class="dtg-row-color-swatch" style="background-image:url('${escapeHtml(row.colorSwatch)}');" aria-hidden="true"></span>`
                                : (row.color ? `<span class="dtg-row-color-swatch dtg-row-color-swatch--blank" aria-hidden="true"></span>` : '')}
                            <input type="text" value="${escapeHtml(row.color)}" placeholder="${row.style ? 'Pick color' : 'Pick style first'}" autocomplete="off" ${row.style ? '' : 'disabled'} ${row.colorSwatch || row.color ? 'data-has-swatch="true"' : ''}>
                        </div>
                        ${isRowColorInvalid(row)
                            ? `<div class="dtg-row-color-warn" title="Pick a valid color from the dropdown">⚠ Not in catalog</div>`
                            : ''}
                    </td>
                    ${sizeCells}
                    <td class="total-col"><strong>${total}</strong></td>
                    <td class="price-col">${perPiece != null ? '$' + perPiece.toFixed(2) : '—'}</td>
                    <td><button type="button" class="dtg-row-remove" data-remove-row="${escapeHtml(row.id)}" title="Remove row">×</button></td>
                </tr>
            `;
        }).join('');

        wireRowHandlers();
    }

    function collectSizesShown() {
        // Default standard sizes that always render. Augment with any size the
        // bundle reported as available on any row.
        const setSizes = new Set(['S', 'M', 'L', 'XL', '2XL', '3XL']);
        for (const row of state.rows) {
            for (const sz of (row.availableSizes || [])) {
                setSizes.add(String(sz).toUpperCase());
            }
            for (const sz of Object.keys(row.sizes || {})) {
                setSizes.add(String(sz).toUpperCase());
            }
        }
        return STANDARD_SIZES.filter((s) => setSizes.has(s));
    }

    function renderSummary() {
        const el = document.getElementById('dtgPriceSummary');
        if (!el) return;
        const cq = combinedQty();
        if (cq === 0) {
            el.innerHTML = `<div class="dps-empty">Add at least one row with sizes to see live pricing.</div>`;
            updateSubmitEnabled();
            return;
        }
        // Resolve tier from the FIRST row's cached bundle so we get the
        // Caspio Pricing_Tiers row (incl. real LTM_Fee). Falls back to the
        // standard label buckets if no bundle is cached yet.
        const firstRowWithBundle = state.rows.find((r) => r.style && _bundleCache.has(r.style.toUpperCase()));
        const tierRow = firstRowWithBundle
            ? findTierRowInBundle(_bundleCache.get(firstRowWithBundle.style.toUpperCase()), cq)
            : null;
        const tier = tierRow ? tierRow.TierLabel : tierLabelFromQty(cq);
        const ltmFee = Number(tierRow && tierRow.LTM_Fee) || 0;
        const isLtm = ltmFee > 0;
        const ltmPP = isLtm ? Math.floor((ltmFee / cq) * 100) / 100 : 0;
        const subtotal = state.rows.reduce((s, r) => s + (Number(r._lineTotal) || 0), 0);
        const tierDisplay = isLtm ? `${tier} (LTM)` : tier;

        // C7 — tax estimate. WA Tacoma rate fallback 10.1% per MEMORY.md.
        // For pickup orders, no shipping in the tax base. For UPS Ground we
        // don't capture a shipping $ amount on the form today, so tax base
        // is still just subtotal (rep can override in ShopWorks if needed).
        const TAX_RATE = 0.101;
        const taxEstimate = Math.round(subtotal * TAX_RATE * 100) / 100;
        const grandTotal = Math.round((subtotal + taxEstimate) * 100) / 100;
        const isPickup = state.shipping.method === 'pickup' || state.shipping.method === 'willcall';

        el.innerHTML = `
            <div class="dps-label">Live DTG quote · ${effectiveLocationLabel()} · ${escapeHtml(shipLabel(state.shipping.method))}</div>
            <div class="dps-grid">
                <div><span class="dps-tier-pill${isLtm ? ' ltm' : ''}">${escapeHtml(tierDisplay)}</span></div>
                <div>${cq} combined pieces${isLtm ? ` · LTM +$${ltmPP.toFixed(2)}/pc` : ''}</div>
                <div class="dps-total">$${fmtMoney(grandTotal)}</div>
            </div>
            <div class="dps-totals-rows">
                <div class="dps-totals-row"><span>Subtotal</span><span class="dps-mono">$${fmtMoney(subtotal)}</span></div>
                <div class="dps-totals-row dps-tax-row"><span>Tax (est, WA 10.1%${isPickup ? ' · pickup' : ''})</span><span class="dps-mono">$${fmtMoney(taxEstimate)}</span></div>
                <div class="dps-totals-row dps-grand-row"><span>Order total</span><span class="dps-mono">$${fmtMoney(grandTotal)}</span></div>
            </div>
            ${isLtm ? `<div class="dps-note">Bump combined qty above this tier and the $${ltmFee} LTM fee disappears.</div>` : ''}
        `;
        updateSubmitEnabled();
    }

    // Display-only tier-label buckets — used when no bundle has been cached
    // yet (initial render before the first style search resolves). Matches
    // the Caspio Pricing_Tiers row labels (1-23, 24-47, 48-71, 72+).
    function tierLabelFromQty(qty) {
        if (qty < 24) return '1-23';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    }

    // Find the tier ROW in a bundle's Caspio-driven tiers list.
    function findTierRowInBundle(bundle, qty) {
        const tiers = (bundle && bundle.tiers) || [];
        if (!tiers.length || qty <= 0) return null;
        return tiers.find((t) =>
            qty >= Number(t.MinQuantity) && qty <= Number(t.MaxQuantity)
        ) || null;
    }

    // B6 — Inline validation banner. Lists the SPECIFIC currently-missing
    // required fields above the Submit button, updating live as the rep
    // fills things in. Design # is intentionally NOT a hard requirement —
    // A3 handles it as a soft warning at click time.
    function updateSubmitEnabled() {
        const btn = document.getElementById('dtgSubmitBtn');
        const banner = document.getElementById('dtgValidationBanner');
        if (!btn) return;
        const cq = combinedQty();
        const hasLines = state.rows.some((r) => r.style && r.color && Object.values(r.sizes || {}).some((v) => Number(v) > 0));
        const hasCustomerEmail = !!(state.customer.email && state.customer.email.includes('@'));
        const hasCompanyOrName = !!(state.customer.company || (state.customer.firstName && state.customer.lastName) || state.customer.companyId);
        const hasShipMethod = !!state.shipping.method;
        const hasSalesRep = !!state.customer.salesRepCode;
        const invalidColorRows = state.rows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => isRowColorInvalid(r));

        const missing = [];
        if (cq < 1)            missing.push('Add a line with sizes');
        if (!hasLines)         missing.push('Pick a style + color');
        if (invalidColorRows.length) {
            // Use a single human-readable item — e.g. "Row 2: 'Pink' not in PC90H catalog"
            for (const { r, i } of invalidColorRows) {
                missing.push(`Row ${i + 1}: "${r.color}" not in ${r.style || 'catalog'} — pick from dropdown`);
            }
        }
        if (!hasCustomerEmail) missing.push('Customer email');
        if (!hasCompanyOrName) missing.push('Company or contact name');
        if (!hasShipMethod)    missing.push('Ship method');
        if (!hasSalesRep)      missing.push('Sales rep');

        const ready = missing.length === 0;
        btn.disabled = state.submitting || !ready;

        if (banner) {
            if (ready || state.submitting) {
                banner.hidden = true;
                banner.innerHTML = '';
            } else {
                banner.hidden = false;
                banner.innerHTML = `<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Need: ${missing.map(m => `<span class="dvb-item">${escapeHtml(m)}</span>`).join(' · ')}`;
            }
        }

        btn.title = ready
            ? (state.customer.designNumber ? 'Push this quote to ShopWorks' : 'Push to ShopWorks — design # is optional, can be added in ShopWorks after')
            : '';
    }

    /**
     * Position a combobox menu as a fixed-position portal that floats above
     * all stacking contexts. Used by the style + color comboboxes so the
     * dropdown is fully visible regardless of nearby chrome (chat panel,
     * customer pane below the table, live pricing card, etc.).
     *
     * Reads the input's current rect each call so the menu stays pinned
     * during scroll.
     */
    function positionPortaledMenu(menu, input) {
        const rect = input.getBoundingClientRect();
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top;
        const maxMenuHeight = 280;
        // Flip to open ABOVE the input when there's more room above than
        // below AND below would be cramped (< 180px).
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
        menu.style.position = 'fixed';
        if (openUp) {
            menu.style.top = '';
            menu.style.bottom = (vh - rect.top + 2) + 'px';
            menu.style.maxHeight = Math.min(maxMenuHeight, spaceAbove - 16) + 'px';
        } else {
            menu.style.bottom = '';
            menu.style.top = (rect.bottom + 2) + 'px';
            menu.style.maxHeight = Math.min(maxMenuHeight, spaceBelow - 16) + 'px';
        }
        menu.style.left = rect.left + 'px';
        // Color names like "Athletic Heather" need ~220px to read cleanly;
        // the cell itself is only ~110px wide.
        menu.style.minWidth = Math.max(rect.width, 240) + 'px';
        menu.style.maxWidth = '340px';
    }

    // ----- Row + combobox handlers ------------------------------------------
    function wireRowHandlers() {
        const table = document.getElementById('dtgRowsTable');
        if (!table) return;

        // Size qty inputs
        table.querySelectorAll('input[type="number"][data-row-id][data-size]').forEach((input) => {
            input.addEventListener('input', () => {
                const rid = input.getAttribute('data-row-id');
                const sz = input.getAttribute('data-size');
                const row = state.rows.find((r) => r.id === rid);
                if (!row) return;
                const q = Math.max(0, parseInt(input.value || '0', 10) || 0);
                if (!row.sizes) row.sizes = {};
                if (q > 0) row.sizes[sz] = q;
                else delete row.sizes[sz];
                markDirty();
                scheduleStateSave();
                schedulePriceUpdate();
            });
            // C8 — bulk size paste. Accept formats like:
            //   "S:2 M:4 L:6 2XL:1"   "S/4, M/6, L/6"   "S-2 M-4 L-6"
            // Distribute parsed values across this row's size cells.
            input.addEventListener('paste', (e) => {
                const text = (e.clipboardData || window.clipboardData)?.getData('text');
                if (!text) return; // fall through to default paste
                const parsed = parseBulkSizes(text);
                const sizesParsed = Object.keys(parsed);
                if (sizesParsed.length < 2) return; // single value → keep default behavior
                e.preventDefault();
                const rid = input.getAttribute('data-row-id');
                const row = state.rows.find((r) => r.id === rid);
                if (!row) return;
                let totalAdded = 0;
                for (const [sz, qty] of Object.entries(parsed)) {
                    if (!row.sizes) row.sizes = {};
                    if (qty > 0) row.sizes[sz] = qty;
                    else delete row.sizes[sz];
                    totalAdded += qty;
                }
                markDirty();
                scheduleStateSave();
                renderTable();
                schedulePriceUpdate();
                showToastSafe(`Distributed ${totalAdded} pieces across ${sizesParsed.length} sizes`);
            });
        });

        // Remove row
        table.querySelectorAll('[data-remove-row]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const rid = btn.getAttribute('data-remove-row');
                state.rows = state.rows.filter((r) => r.id !== rid);
                markDirty();
                scheduleStateSave();
                renderTable();
                schedulePriceUpdate();
            });
        });

        // Style combobox (per row)
        table.querySelectorAll('.dtg-combobox[data-combo-kind="style"]').forEach((wrap) => {
            const rid = wrap.getAttribute('data-row-id');
            const input = wrap.querySelector('input');
            attachStyleCombobox(wrap, input, rid);
        });
        // Color combobox (per row)
        table.querySelectorAll('.dtg-combobox[data-combo-kind="color"]').forEach((wrap) => {
            const rid = wrap.getAttribute('data-row-id');
            const input = wrap.querySelector('input');
            attachColorCombobox(wrap, input, rid);
        });
    }

    function attachStyleCombobox(wrap, input, rid) {
        let menu = null;
        let timer = null;
        let lastMatches = [];
        let activeIndex = 0;
        const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

        function close() {
            if (menu) {
                menu.remove();
                menu = null;
                window.removeEventListener('scroll', reposition, true);
                window.removeEventListener('resize', reposition);
            }
        }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                // Portal to body so the dropdown floats above the chat
                // panel, customer pane, live pricing card, etc.
                document.body.appendChild(menu);
                positionPortaledMenu(menu, input);
                window.addEventListener('scroll', reposition, true);
                window.addEventListener('resize', reposition);
            }
        }
        function paint() {
            if (!menu) return;
            if (lastMatches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">${input.value ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
                positionPortaledMenu(menu, input);
                return;
            }
            menu.innerHTML = lastMatches.slice(0, 10).map((m, i) => `
                <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                    <div class="ci-primary">${escapeHtml(m.value || m.style || m.styleNumber || m.label || '')}</div>
                    <div class="ci-secondary">${escapeHtml(m.label || m.PRODUCT_TITLE || '')}</div>
                </div>
            `).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => {
                    activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    paint();
                });
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    pick(lastMatches[parseInt(item.getAttribute('data-idx'), 10)]);
                });
            });
            positionPortaledMenu(menu, input);
        }
        async function search(q) {
            if (q.length < 2) { lastMatches = []; paint(); return; }
            lastMatches = await fetchStyleSearch(q);
            activeIndex = 0;
            paint();
        }
        async function pick(m) {
            if (!m) return;
            const style = String(m.value || m.style || m.styleNumber || '').toUpperCase();
            const desc = String(m.label || m.PRODUCT_TITLE || '');
            const row = state.rows.find((r) => r.id === rid);
            if (!row) return;
            row.style = style;
            row.styleUpper = style;
            row.desc = desc;
            // Reset color when style changes
            row.color = '';
            row.catalogColor = '';
            row.colorSwatch = '';
            row.colorsAvailable = [];
            row.availableSizes = [];
            markDirty();
            scheduleStateSave();
            close();
            renderTable();
            // Asynchronously: fetch colors, fetch bundle (for live price + available sizes)
            const [colorsInfo, bundle] = await Promise.all([
                fetchProductColors(style),
                fetchBundle(style),
            ]);
            row.colorsAvailable = colorsInfo.colors || [];
            if (!row.desc && colorsInfo.productTitle) row.desc = colorsInfo.productTitle;
            if (bundle && Array.isArray(bundle.sizes)) {
                row.availableSizes = bundle.sizes
                    .filter((s) => Number(s.price) > 0)
                    .map((s) => String(s.size).toUpperCase());
            }
            renderTable();
            schedulePriceUpdate();
        }
        input.addEventListener('input', () => {
            open();
            clearTimeout(timer);
            timer = setTimeout(() => search(input.value.trim()), 200);
        });
        input.addEventListener('focus', () => { open(); paint(); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, lastMatches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (lastMatches[activeIndex]) { e.preventDefault(); pick(lastMatches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => {
            // Menu is portaled to body, so wrap.contains() doesn't include it.
            if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
        });
    }

    function attachColorCombobox(wrap, input, rid) {
        const row = state.rows.find((r) => r.id === rid);
        if (!row || !row.style) return;
        let menu = null;
        let activeIndex = 0;
        let matches = row.colorsAvailable || [];
        const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

        function close() {
            if (menu) {
                menu.remove();
                menu = null;
                window.removeEventListener('scroll', reposition, true);
                window.removeEventListener('resize', reposition);
            }
        }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                document.body.appendChild(menu);
                positionPortaledMenu(menu, input);
                window.addEventListener('scroll', reposition, true);
                window.addEventListener('resize', reposition);
            }
        }
        function filter(q) {
            const qq = q.toLowerCase().trim();
            if (!qq) { matches = row.colorsAvailable || []; }
            else matches = (row.colorsAvailable || []).filter((c) =>
                String(c.COLOR_NAME || c.colorName || '').toLowerCase().includes(qq) ||
                String(c.CATALOG_COLOR || c.catalogColor || '').toLowerCase().includes(qq)
            );
            activeIndex = 0;
            paint();
        }
        function paint() {
            if (!menu) return;
            if (matches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">No colors</div>`;
                return;
            }
            menu.innerHTML = matches.slice(0, 30).map((c, i) => {
                const name = c.COLOR_NAME || c.colorName || '';
                const cat = c.CATALOG_COLOR || c.catalogColor || '';
                const swatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
                return `
                    <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${swatch ? `<img class="ci-swatch-mini" src="${escapeHtml(swatch)}" alt="">` : ''}
                            <div>
                                <div class="ci-primary">${escapeHtml(name)}</div>
                                ${cat ? `<div class="ci-secondary">${escapeHtml(cat)}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => { activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0; paint(); });
                item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
            });
            positionPortaledMenu(menu, input);
        }
        function pick(c) {
            if (!c) return;
            row.color = c.COLOR_NAME || c.colorName || '';
            row.catalogColor = c.CATALOG_COLOR || c.catalogColor || '';
            row.colorSwatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
            markDirty();
            scheduleStateSave();
            close();
            renderTable();
            schedulePriceUpdate();
            // Kick off SanMar inventory fetch — badges appear once data lands.
            kickInventoryFetch(row);
        }
        input.addEventListener('input', () => { open(); filter(input.value); });
        input.addEventListener('focus', () => { open(); filter(input.value); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => {
            if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
        });
    }

    // ----- Customer combobox + manual fields --------------------------------
    function wireGlobalHandlers() {
        // Add row
        const addBtn = document.getElementById('dtgAddRowBtn');
        if (addBtn) addBtn.addEventListener('click', () => {
            state.rows.push(newBlankRow());
            markDirty();
            scheduleStateSave();
            renderTable();
        });

        // Reset
        const reset = document.getElementById('dtgResetBtn');
        if (reset) reset.addEventListener('click', () => resetForm());

        // Submit
        const submit = document.getElementById('dtgSubmitBtn');
        if (submit) submit.addEventListener('click', () => submitToShopWorks());

        // Customer combobox
        const wrap = document.getElementById('dtgCompanyCombo');
        const input = document.getElementById('dtgCompanyInput');
        if (wrap && input) attachCompanyCombobox(wrap, input);

        // Manual customer fields
        bindInputToState('dtgFirstName', 'firstName');
        bindInputToState('dtgLastName', 'lastName');
        bindInputToState('dtgEmail', 'email');
        bindInputToState('dtgPhone', 'phone');
        bindInputToState('dtgCompanyId', 'companyId');
        bindInputToState('dtgDesignNumber', 'designNumber');
        const termsSel = document.getElementById('dtgTerms');
        if (termsSel) termsSel.addEventListener('change', () => {
            state.customer.terms = termsSel.value;
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        });
        // A1 sales rep — remember last pick in localStorage so the next quote
        // starts on the same rep.
        const repSel = document.getElementById('dtgSalesRep');
        if (repSel) repSel.addEventListener('change', () => {
            state.customer.salesRepCode = repSel.value;
            try { localStorage.setItem('dtg.lastSalesRep', repSel.value); } catch {}
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        });
        // A2 shipping method
        const shipSel = document.getElementById('dtgShipMethod');
        if (shipSel) shipSel.addEventListener('change', () => {
            state.shipping.method = shipSel.value;
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
            renderSummary(); // tax recompute (C7)
        });
    }
    function bindInputToState(elId, stateKey) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', () => {
            state.customer[stateKey] = el.value.trim();
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        });
    }

    function attachCompanyCombobox(wrap, input) {
        let menu = null;
        let timer = null;
        let matches = [];
        let activeIndex = 0;

        function close() { if (menu) { menu.remove(); menu = null; } }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                wrap.appendChild(menu);
            }
        }
        function paint() {
            if (!menu) return;
            if (matches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">${input.value.length >= 2 ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
                return;
            }
            menu.innerHTML = matches.slice(0, 10).map((c, i) => {
                const loc = [c.City, c.State].filter(Boolean).join(', ');
                const contactCount = (c.contacts || []).length;
                return `
                    <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                        <div class="ci-primary">${escapeHtml(c.Company_Name || '')}</div>
                        <div class="ci-secondary">${escapeHtml(loc || '—')}${contactCount > 0 ? ` · ${contactCount} contact${contactCount === 1 ? '' : 's'}` : ' · no email contacts'}</div>
                    </div>
                `;
            }).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => { activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0; paint(); });
                item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
            });
        }
        async function search(q) {
            if (q.length < 2) { matches = []; paint(); return; }
            matches = await fetchCompanies(q);
            activeIndex = 0;
            paint();
        }
        function pick(c) {
            if (!c) return;
            state.customer.company = c.Company_Name || '';
            state.customer.companyId = c.id_Customer != null ? String(c.id_Customer) : '';
            state.customer.contacts = c.contacts || [];
            input.value = c.Company_Name || '';
            // If only one emailable contact, auto-pick them
            const firstContact = (c.contacts || []).find((ct) => ct.Email || ct.ContactNumbersEmail);
            if (firstContact) {
                applyContact(firstContact);
            }
            // Reflect in companyId field if it's blank
            const cidInput = document.getElementById('dtgCompanyId');
            if (cidInput && !cidInput.value) cidInput.value = state.customer.companyId;
            markDirty();
            scheduleStateSave();
            close();
            updateSubmitEnabled();
        }
        input.addEventListener('input', () => {
            open();
            clearTimeout(timer);
            timer = setTimeout(() => search(input.value.trim()), 200);
        });
        input.addEventListener('focus', () => { open(); paint(); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => { if (menu && !wrap.contains(e.target)) close(); });
    }

    function applyContact(ct) {
        state.customer.firstName = ct.NameFirst || '';
        state.customer.lastName = ct.NameLast || '';
        state.customer.email = ct.Email || ct.ContactNumbersEmail || '';
        state.customer.phone = ct.Phone || ct.Company_Phone || '';
        const fn = document.getElementById('dtgFirstName'); if (fn) fn.value = state.customer.firstName;
        const ln = document.getElementById('dtgLastName'); if (ln) ln.value = state.customer.lastName;
        const em = document.getElementById('dtgEmail'); if (em) em.value = state.customer.email;
        const ph = document.getElementById('dtgPhone'); if (ph) ph.value = state.customer.phone;
        updateSubmitEnabled();
    }

    // ----- Live pricing (via window.DTGPricingService) -----------------------
    let _priceTimer = null;
    function schedulePriceUpdate() {
        clearTimeout(_priceTimer);
        _priceTimer = setTimeout(() => updateLivePrices().catch((e) => console.error('[dtg-inline-form] price update failed:', e)), 200);
    }

    async function updateLivePrices() {
        const code = effectiveLocationCode();
        const cq = combinedQty();
        if (!code || cq === 0 || !window.DTGPricingService) {
            for (const r of state.rows) { r._perPiece = null; r._lineTotal = 0; }
            renderTable();
            renderSummary();
            return;
        }
        const svc = new window.DTGPricingService();

        for (const row of state.rows) {
            if (!row.style || !row.color) { row._perPiece = null; row._lineTotal = 0; continue; }
            // Block pricing on rows where the rep typed a color the catalog
            // doesn't have (no catalogColor → no SanMar match → invalid).
            // Without this guard, the live total includes phantom dollars
            // for orders that would fail in ShopWorks.
            if (isRowColorInvalid(row)) { row._perPiece = null; row._lineTotal = 0; continue; }
            try {
                const bundle = await fetchBundle(row.style);
                if (!bundle) { row._perPiece = null; row._lineTotal = 0; continue; }
                // Resolve the tier ROW from Caspio (incl. LTM_Fee). The
                // row's LTM_Fee column drives per-piece LTM dynamically —
                // no more hardcoded $50.
                const tier = svc.getTierForQuantity(bundle.tiers, cq);
                if (!tier) { row._perPiece = null; row._lineTotal = 0; continue; }
                const ltmFee = Number(tier.LTM_Fee) || 0;
                const ltmPP = ltmFee > 0 ? Math.floor((ltmFee / cq) * 100) / 100 : 0;

                const allPrices = svc.calculateAllLocationPrices(bundle, cq);
                if (!allPrices || !allPrices[code]) { row._perPiece = null; row._lineTotal = 0; continue; }
                const locPrices = allPrices[code];
                let lineTotal = 0;
                let count = 0;
                let aggregate = 0;
                for (const [sz, qty] of Object.entries(row.sizes || {})) {
                    const q = Number(qty) || 0; if (q <= 0) continue;
                    const priceObj = locPrices[String(sz).toUpperCase()] || locPrices[sz];
                    const base = priceObj && priceObj[tier.TierLabel];
                    if (typeof base !== 'number') continue;
                    const final = base + ltmPP;
                    lineTotal += final * q;
                    aggregate += final * q;
                    count += q;
                }
                row._perPiece = count > 0 ? Math.round((aggregate / count) * 100) / 100 : null;
                row._lineTotal = Math.round(lineTotal * 100) / 100;
            } catch (err) {
                console.error('[dtg-inline-form] row price update failed:', row.style, err);
                row._perPiece = null;
                row._lineTotal = 0;
            }
        }
        renderTable();
        renderSummary();
    }

    // ----- Submit ------------------------------------------------------------
    // Walk every row's sizes against its row.inventory and collect any
    // size+qty combos that exceed available stock. Returns [] when stock
    // is OK or unknown (no false alarms). Matches the order form's
    // submit-time stock check pattern.
    function collectStockIssues() {
        const issues = [];
        for (const row of state.rows) {
            if (!row.style || !row.color) continue;
            const inv = row.inventory || { bySize: {}, status: 'unknown' };
            if (inv.status !== 'ok') continue; // no data → don't false-alarm
            for (const [size, qtyRaw] of Object.entries(row.sizes || {})) {
                const qty = Number(qtyRaw) || 0;
                if (qty <= 0) continue;
                const available = Number(inv.bySize[size]);
                if (!Number.isFinite(available)) continue; // missing data for this size
                if (qty > available) {
                    issues.push({
                        style: row.style,
                        color: row.color,
                        size,
                        qty,
                        available,
                    });
                }
            }
        }
        return issues;
    }

    // Generic confirm-modal helper used by both A3 (design # soft warning)
    // and C9 (chat-form overwrite warning). Promise resolves true on proceed,
    // false on cancel/Esc/backdrop-click. Buttons take string labels;
    // proceedClass controls the proceed-button color (default amber/warn).
    function genericConfirm({ icon, title, body, cancelLabel, proceedLabel, proceedClass }) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'dtg-stock-confirm-backdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');
            backdrop.innerHTML = `
                <div class="dtg-stock-confirm-modal" role="document">
                    <div class="dscm-head">
                        <span class="dscm-head-icon" aria-hidden="true">${escapeHtml(icon || '⚠')}</span>
                        <h3 class="dscm-title">${escapeHtml(title)}</h3>
                    </div>
                    <p class="dscm-body">${body /* trusted — caller controls */}</p>
                    <div class="dscm-actions">
                        <button type="button" class="dscm-btn dscm-btn-cancel" data-action="cancel">${escapeHtml(cancelLabel || 'Cancel')}</button>
                        <button type="button" class="dscm-btn ${proceedClass || 'dscm-btn-proceed'}" data-action="confirm">${escapeHtml(proceedLabel || 'Proceed')}</button>
                    </div>
                </div>
            `;
            function cleanup(result) {
                document.removeEventListener('keydown', onKey);
                backdrop.remove();
                resolve(result);
            }
            function onKey(e) { if (e.key === 'Escape') cleanup(false); }
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(false); });
            backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
            backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
            document.addEventListener('keydown', onKey);
            document.body.appendChild(backdrop);
            backdrop.querySelector('[data-action="cancel"]').focus();
        });
    }

    // Show the stock-confirm modal. Returns a Promise that resolves to true
    // (proceed) or false (cancel). Backdrop click / Escape / Cancel = false.
    function confirmStockOverflow(issues) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'dtg-stock-confirm-backdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');

            const itemsHtml = issues.map((it) => `
                <li class="dscm-item">
                    <span class="dscm-style">${escapeHtml(it.style)}</span>
                    <span class="dscm-color">${escapeHtml(it.color || '(no color)')}</span>
                    <span class="dscm-size">${escapeHtml(it.size)} × ${it.qty}</span>
                    <span class="dscm-stock">${it.available.toLocaleString()} in stock</span>
                </li>
            `).join('');

            backdrop.innerHTML = `
                <div class="dtg-stock-confirm-modal" role="document">
                    <div class="dscm-head">
                        <span class="dscm-head-icon" aria-hidden="true">⚠</span>
                        <h3 class="dscm-title">Stock check</h3>
                    </div>
                    <p class="dscm-body">
                        ${issues.length === 1 ? '1 size exceeds' : `${issues.length} sizes exceed`}
                        SanMar's current stock. May need backorder, drop-ship, or
                        extended lead time. Push to ShopWorks anyway?
                    </p>
                    <ul class="dscm-list">${itemsHtml}</ul>
                    <div class="dscm-actions">
                        <button type="button" class="dscm-btn dscm-btn-cancel" data-action="cancel">Cancel</button>
                        <button type="button" class="dscm-btn dscm-btn-proceed" data-action="confirm">Proceed anyway</button>
                    </div>
                </div>
            `;

            function cleanup(result) {
                document.removeEventListener('keydown', onKey);
                backdrop.remove();
                resolve(result);
            }
            function onKey(e) { if (e.key === 'Escape') cleanup(false); }

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });
            backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
            backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
            document.addEventListener('keydown', onKey);

            document.body.appendChild(backdrop);
            // Focus the "Cancel" button by default — safer than auto-confirming.
            backdrop.querySelector('[data-action="cancel"]').focus();
        });
    }

    async function submitToShopWorks() {
        const statusEl = document.getElementById('dtgSubmitStatus');
        const setStatus = (cls, msg) => {
            if (!statusEl) return;
            statusEl.className = `dtg-submit-status ${cls}`;
            statusEl.innerHTML = msg;
            statusEl.hidden = false;
        };

        // Build lines array
        const code = effectiveLocationCode();
        const cleanLines = state.rows
            .filter((r) => r.style && r.color && Object.keys(r.sizes || {}).length > 0)
            .map((r) => ({ styleNumber: r.style, color: r.color, sizes: { ...r.sizes } }));
        if (!code || cleanLines.length === 0) {
            setStatus('error', 'Need a location + at least one filled row.');
            return;
        }
        if (!state.customer.email) {
            setStatus('error', 'Need customer email before pushing.');
            return;
        }

        // A3 — Design # soft warning. Submit is no longer hard-blocked when the
        // design # is empty. Instead we confirm with the rep, then push with
        // designNumber: null. Rep adds the design # directly in ShopWorks
        // after the art team assigns one.
        if (!state.customer.designNumber) {
            const proceedNoDesign = await genericConfirm({
                icon: '🎨',
                title: 'No design # entered',
                body: 'The art team can assign one in ShopWorks after you push. The order will be created with no Design ID and the rep can add it manually. Push anyway?',
                cancelLabel: 'Cancel',
                proceedLabel: 'Push without design #',
                proceedClass: 'dscm-btn-proceed',
            });
            if (!proceedNoDesign) {
                setStatus('error', 'Push cancelled — add a design # and try again, or push without one when ready.');
                return;
            }
        }

        // Stock check — if any cell exceeds SanMar inventory, ask the rep
        // to confirm before pushing.
        const stockIssues = collectStockIssues();
        if (stockIssues.length > 0) {
            const proceed = await confirmStockOverflow(stockIssues);
            if (!proceed) {
                setStatus('error', 'Push cancelled — adjust quantities and try again.');
                return;
            }
        }

        // Resolve sales rep from the state.customer.salesRepCode
        const rep = repByCode(state.customer.salesRepCode);
        const shipMethodLabel = shipLabel(state.shipping.method);
        const isPickup = state.shipping.method === 'pickup' || state.shipping.method === 'willcall';

        state.submitting = true;
        updateSubmitEnabled();
        setStatus('busy', '<i class="fas fa-circle-notch fa-spin"></i> Pricing + pushing…');

        // 1) Authoritative price via canonical endpoint
        let pricing;
        try {
            const r = await fetch(`${API_BASE}/api/dtg/quote-pricing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationCode: code, lines: cleanLines }),
            });
            pricing = await r.json();
            if (!r.ok || pricing.error) {
                setStatus('error', `Pricing failed: ${escapeHtml(pricing && pricing.message ? pricing.message : 'HTTP ' + r.status)}`);
                state.submitting = false; updateSubmitEnabled();
                return;
            }
        } catch (err) {
            setStatus('error', `Pricing failed: ${escapeHtml(err.message)}`);
            state.submitting = false; updateSubmitEnabled();
            return;
        }

        // 2) Build the order-form-shaped payload
        const items = Array.isArray(pricing.lineItems) ? pricing.lineItems : [];
        const totals = pricing.totals || {};
        const subtotal = Number(pricing.subtotal) || items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
        const ltmTotal = items.reduce((s, it) => s + (Number(it.ltmPerUnit) || 0) * (Number(it.totalQuantity) || 0), 0);

        const rows = items.map((it, i) => ({
            id: `dtg-row-${i + 1}`,
            style: it.styleNumber || it.style || '',
            desc: it.description || `${it.styleNumber || ''} ${it.color || ''}`.trim(),
            color: it.color || '',
            colorName: it.color || '',
            catalogColor: (state.rows.find((r) => r.style === it.styleNumber && r.color === it.color)?.catalogColor) || '',
            imageUrl: '',
            sizes: it.sizes || {},
            deco: 'dtg',
            rowDecoConfig: { method: 'dtg', locationCode: it.locationCode || code },
            price: Number(it.finalUnitPrice) || 0,
            priceOverride: false,
            manualMode: false,
            manualCost: '',
        }));

        const byRow = {};
        items.forEach((it, i) => {
            byRow[`dtg-row-${i + 1}`] = {
                unitPriceBySize: (it.lineSizes || []).reduce((m, s) => { m[s.size] = s.finalUnit; return m; }, {}),
                rowSubtotal: Number(it.lineTotal) || 0,
                tier: it.tier || pricing.tier,
            };
        });

        // C7 — tax estimate. Use what the canonical endpoint returned if
        // available; otherwise fallback to subtotal × 10.1% (WA Tacoma rate
        // per MEMORY.md). For pickup orders, shipping = 0 so tax = subtotal × rate.
        const taxEstimate = Number(totals.taxEstimate) || Math.round(subtotal * 0.101 * 100) / 100;
        const grandTotal = Number(totals.grandTotal) || Math.round((subtotal + taxEstimate) * 100) / 100;

        const body = {
            info: {
                company: state.customer.company || '',
                buyer: `${state.customer.firstName} ${state.customer.lastName}`.trim(),
                buyerFirst: state.customer.firstName || '',
                buyerLast: state.customer.lastName || '',
                buyerEmail: state.customer.email || '',
                email: state.customer.email || '',
                companyName: state.customer.company || '',
                companyId: state.customer.companyId || '',
                phone: state.customer.phone || '',
                designNumber: state.customer.designNumber || null, // A3 — nullable
                salesRep: rep.name,
                salesRepEmail: rep.email,
                terms: state.customer.terms || 'Prepaid',
                paymentTerms: state.customer.terms || 'Prepaid',
                taxable: true,
                quoteId: getQuoteID() || '',
            },
            rows,
            ship: {
                method: state.shipping.method, // A2 — real value (ups / pickup / willcall / other)
                methodLabel: shipMethodLabel,
                sameAsBilling: true,
                isPickup,
            },
            orderNotes: `DTG quote — ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pcs · tier ${pricing.tier}${isPickup ? ' · CUSTOMER PICKUP' : ''}`,
            files: [],
            decoConfig: { method: 'dtg' },
            breakdown: {
                supported: true,
                byRow,
                totalQty: Number(pricing.combinedQuantity) || 0,
                tier: pricing.tier,
                subtotal: Math.round(subtotal * 100) / 100,
                ltmTotal: Math.round(ltmTotal * 100) / 100,
                taxEstimate,
                depositDue: 0,
                grandTotal,
                fees: [],
                errors: [],
            },
            methodNotesBlock: `DTG · ${effectiveLocationLabel()} · Tier ${pricing.tier} · ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pieces · Ship: ${shipMethodLabel}`,
            designNumbers: state.customer.designNumber ? [state.customer.designNumber] : [],
            addOns: [],
        };

        // B5 — cache for retry. If the push fails, the retry button reuses
        // this exact body so we don't double-fetch pricing.
        state.lastSubmit = { body, pricing, subtotal };

        await postPayloadToShopWorks(body, { subtotal, items });
        state.submitting = false;
        updateSubmitEnabled();
    }

    // B5 — extracted POST handler so the Retry button can re-call without
    // recomputing the payload. Shows a structured error card with
    // [Retry] [Copy payload] on failure.
    async function postPayloadToShopWorks(body, ctx) {
        const statusEl = document.getElementById('dtgSubmitStatus');
        const setStatus = (cls, msg) => {
            if (!statusEl) return;
            statusEl.className = `dtg-submit-status ${cls}`;
            statusEl.innerHTML = msg;
            statusEl.hidden = false;
        };
        setStatus('busy', '<i class="fas fa-circle-notch fa-spin"></i> Pushing to ShopWorks…');
        try {
            const r = await fetch(SUBMIT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await r.json().catch(() => ({}));
            if (r.ok && data.success) {
                const id = data.shopWorksId || data.extOrderId;
                setStatus('success',
                    `<strong>Pushed to ShopWorks.</strong> Order: <code>${escapeHtml(id || 'submitted')}</code> · ${ctx.items.length} line${ctx.items.length === 1 ? '' : 's'} · $${fmtMoney(ctx.subtotal)}`
                );
                // Clear sessionStorage on success — the rep is done with
                // this quote, next page load starts fresh.
                clearSessionState();
            } else {
                renderRetryCard(setStatus, `HTTP ${r.status}: ${data.error || 'unknown error'}${data.detail ? ' — ' + data.detail : ''}`);
            }
        } catch (err) {
            renderRetryCard(setStatus, `Network error: ${err.message}`);
        }
    }

    function renderRetryCard(setStatus, errorMsg) {
        setStatus('error', `
            <div class="dts-error-head"><strong>Push failed.</strong> ${escapeHtml(errorMsg)}</div>
            <div class="dts-error-actions">
                <button type="button" class="dts-retry-btn" data-action="retry"><i class="fas fa-rotate-right"></i> Retry</button>
                <button type="button" class="dts-copy-btn" data-action="copy-payload"><i class="fas fa-copy"></i> Copy payload</button>
            </div>
        `);
        const statusEl = document.getElementById('dtgSubmitStatus');
        if (!statusEl) return;
        statusEl.querySelector('[data-action="retry"]')?.addEventListener('click', async () => {
            if (!state.lastSubmit) {
                setStatus('error', 'No cached payload to retry — please re-click Submit.');
                return;
            }
            state.submitting = true;
            updateSubmitEnabled();
            await postPayloadToShopWorks(state.lastSubmit.body, {
                subtotal: state.lastSubmit.subtotal,
                items: state.lastSubmit.pricing.lineItems || [],
            });
            state.submitting = false;
            updateSubmitEnabled();
        });
        statusEl.querySelector('[data-action="copy-payload"]')?.addEventListener('click', () => {
            if (!state.lastSubmit) return;
            try {
                navigator.clipboard.writeText(JSON.stringify(state.lastSubmit.body, null, 2));
                showToastSafe('Payload copied — paste to support or stash for retry');
            } catch (e) {
                showToastSafe('Clipboard failed — payload in console');
                console.log('[dtg-inline-form] retry payload:', state.lastSubmit.body);
            }
        });
    }

    // ----- Public API for chat bridge ---------------------------------------
    async function fillFromQuote(priceQuote, customerFinal) {
        // C9 — race guard. If the rep has touched the form since the last
        // chat fill, ask before overwriting. Only triggers when there are
        // actual user edits AND the chat is delivering a new PRICE_QUOTE
        // (customer-only fills bypass — those don't clobber rows).
        if (priceQuote && state.dirtyAfterChatFill) {
            const proceed = await genericConfirm({
                icon: '✏️',
                title: 'AI updated the quote',
                body: 'You have edits on the form. The AI just sent a new quote. Apply it (overwrites your edits) or keep your edits (ignore the new quote)?',
                cancelLabel: 'Keep my edits',
                proceedLabel: 'Apply new quote',
                proceedClass: 'dscm-btn-proceed',
            });
            if (!proceed) {
                // Rep kept their edits — bail without overwriting.
                return;
            }
        }

        if (priceQuote) {
            // Set location
            const code = priceQuote.locationCode || (priceQuote.lineItems && priceQuote.lineItems[0] && priceQuote.lineItems[0].locationCode) || 'LC';
            if (code.includes('_')) {
                const [front, back] = code.split('_');
                state.front = front;
                state.back = back || '';
            } else {
                state.front = code;
                state.back = '';
            }

            // Build rows from PRICE_QUOTE lineItems
            const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
            const newRows = items.map((it) => {
                const r = newBlankRow();
                r.style = (it.styleNumber || it.style || '').toUpperCase();
                r.styleUpper = r.style;
                r.color = it.color || '';
                r.desc = it.description || '';
                r.sizes = { ...(it.sizes || {}) };
                return r;
            });
            state.rows = newRows.length > 0 ? newRows : [newBlankRow()];

            // Cache the AI quoteID + persist to sessionStorage so it survives
            // a page refresh.
            if (priceQuote.quoteID) setQuoteID(priceQuote.quoteID);

            // IMMEDIATE render so the rep sees the rows right away. Hydration
            // (catalog colors, available sizes, swatch URLs) happens in the
            // background in parallel — when each row's hydrate completes we
            // re-render so the description / catalog color fill in. Without
            // this the form looks empty until ALL hydrates finish (8+ seconds
            // for a 4-line quote with cold caches).
            renderLocationPills();
            renderTable();

            const hydrates = state.rows
                .filter((row) => row.style)
                .map(async (row) => {
                    try {
                        const [info, bundle] = await Promise.all([
                            fetchProductColors(row.style),
                            fetchBundle(row.style),
                        ]);
                        row.colorsAvailable = info.colors || [];
                        if (!row.desc && info.productTitle) row.desc = info.productTitle;
                        // Fuzzy match — bot often emits rep shorthand ("black") but
                        // canonical is "Jet Black". Exact-match would leave catalogColor
                        // empty → broken inventory check + bad ShopWorks push.
                        const matchColor = fuzzyMatchColor(info.colors || [], row.color);
                        if (matchColor) {
                            row.catalogColor = matchColor.CATALOG_COLOR || matchColor.catalogColor || '';
                            row.colorSwatch = matchColor.COLOR_SQUARE_IMAGE || '';
                            // Promote canonical name so the row displays "Jet Black"
                            // even if the bot sent "black".
                            const canonical = matchColor.COLOR_NAME || matchColor.colorName || '';
                            if (canonical) row.color = canonical;
                        }
                        if (bundle && Array.isArray(bundle.sizes)) {
                            row.availableSizes = bundle.sizes
                                .filter((s) => Number(s.price) > 0)
                                .map((s) => String(s.size).toUpperCase());
                        }
                        // Once we know the catalogColor, kick off the inventory
                        // fetch. The fetch resolves async + re-renders independently.
                        kickInventoryFetch(row);
                    } catch (e) {
                        console.warn('[dtg-inline-form] hydrate failed for', row.style, e);
                    }
                });
            // Re-render once all parallel hydrates complete (description column
            // and catalog colors fill in). Doesn't block fillFromQuote returning.
            Promise.all(hydrates).then(() => { renderTable(); schedulePriceUpdate(); });
        }

        if (customerFinal) {
            // Accept several shapes the bot might emit:
            //   - `name`: "First Last"
            //   - `firstName` + `lastName` (order-form shape)
            //   - `contact_name` (lookup_customer shape)
            const fullName = customerFinal.name || customerFinal.contact_name || '';
            const nameParts = fullName.split(/\s+/);
            const first = customerFinal.firstName || customerFinal.contact_first || nameParts[0] || '';
            const last = customerFinal.lastName || customerFinal.contact_last || nameParts.slice(1).join(' ') || '';
            state.customer.company = customerFinal.company || state.customer.company;
            state.customer.companyId = customerFinal.customer_number || customerFinal.companyId || state.customer.companyId;
            state.customer.firstName = first || state.customer.firstName;
            state.customer.lastName = last || state.customer.lastName;
            state.customer.email = customerFinal.email || customerFinal.buyerEmail || state.customer.email;
            state.customer.phone = customerFinal.phone || state.customer.phone;
            state.customer.designNumber = customerFinal.designNumber || state.customer.designNumber;
            state.customer.terms = customerFinal.payment_terms || customerFinal.terms || state.customer.terms;

            // Reflect into DOM
            const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            set('dtgCompanyInput', state.customer.company);
            set('dtgCompanyId', state.customer.companyId);
            set('dtgFirstName', state.customer.firstName);
            set('dtgLastName', state.customer.lastName);
            set('dtgEmail', state.customer.email);
            set('dtgPhone', state.customer.phone);
            set('dtgDesignNumber', state.customer.designNumber);
            const termsSel = document.getElementById('dtgTerms');
            if (termsSel && state.customer.terms) termsSel.value = state.customer.terms;
        }

        // Re-render once more in case only customer fields were touched (no
        // priceQuote rebuild). Cheap; safe.
        if (!priceQuote) {
            renderLocationPills();
            renderTable();
            schedulePriceUpdate();
        }

        // C9 — clear dirty flag now that the form reflects the chat. Save
        // the current state to sessionStorage so refresh recovery works.
        clearDirty();
        scheduleStateSave();
        updateSubmitEnabled();

        // Scroll the form into view so the rep sees the fill happen.
        const wrap = document.querySelector('.dtg-form-wrap');
        if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getState() {
        return JSON.parse(JSON.stringify({
            front: state.front,
            back: state.back,
            locationCode: effectiveLocationCode(),
            combinedQty: combinedQty(),
            rows: state.rows.map((r) => ({
                style: r.style, color: r.color, catalogColor: r.catalogColor,
                desc: r.desc, sizes: r.sizes,
            })),
            customer: state.customer,
        }));
    }

    function resetForm() {
        // Preserve the rep's last-picked sales rep across resets — they
        // typically do many quotes in a row as themselves.
        const preservedRepCode = state.customer.salesRepCode
            || (function () { try { return localStorage.getItem('dtg.lastSalesRep') || 'erik'; } catch { return 'erik'; } })();
        state.front = 'LC';
        state.back = '';
        state.rows = [newBlankRow()];
        state.customer = {
            company: '', companyId: '', contactId: '',
            firstName: '', lastName: '', email: '', phone: '',
            designNumber: '', terms: 'Prepaid', contacts: [],
            salesRepCode: preservedRepCode,
        };
        state.shipping = { method: 'ups' };
        state.dirtyAfterChatFill = false;
        state.lastSubmit = null;
        const statusEl = document.getElementById('dtgSubmitStatus');
        if (statusEl) statusEl.hidden = true;
        render();
    }

    // ----- Utilities ---------------------------------------------------------
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtMoney(n) {
        if (!Number.isFinite(Number(n))) return '0.00';
        return Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // ----- Init --------------------------------------------------------------
    function init() {
        // B4 — try to restore from sessionStorage first. If we restored, show
        // a small banner offering to start fresh.
        const restored = restoreStateFromSession();
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        if (restored) {
            showResumeBanner();
            // Hydrate the restored rows' inventory + bundle data in the
            // background so the size cells + badges fill in.
            for (const row of state.rows) {
                if (row.style && row.color) {
                    kickInventoryFetch(row);
                }
                if (row.style) {
                    // refresh available sizes from bundle (cached if hot)
                    fetchBundle(row.style).then(b => {
                        if (b && Array.isArray(b.sizes)) {
                            row.availableSizes = b.sizes.filter(s => Number(s.price) > 0).map(s => String(s.size).toUpperCase());
                            renderTable();
                            schedulePriceUpdate();
                        }
                    }).catch(() => {});
                }
            }
        }
    }

    // B4 — "Resumed from your last session" banner shown after a successful
    // restoreStateFromSession(). Renders INLINE at the top of the form (into
    // #dtgResumeBannerMount) so it can't get visually clipped by the chat
    // panel overlay or be misplaced at any viewport size.
    //
    // The mount point is a permanent div inside .dtg-form-wrap. We append a
    // child instead of writing to innerHTML so subsequent render() calls
    // that touch the form don't wipe the banner.
    function showResumeBanner() {
        try {
            const mount = document.getElementById('dtgResumeBannerMount');
            if (!mount) return;
            // Clear any prior banner content
            mount.innerHTML = '';

            // Build a contextual message with row count + quote ID
            const rowCount = state.rows.filter(r => r.style || Object.values(r.sizes || {}).some(q => Number(q) > 0)).length;
            const totalPcs = state.rows.reduce((s, r) => s + Object.values(r.sizes || {}).reduce((a, b) => a + (Number(b) || 0), 0), 0);
            const quoteID = getQuoteID();

            const parts = [];
            if (rowCount > 0) parts.push(`${rowCount} row${rowCount === 1 ? '' : 's'}`);
            if (totalPcs > 0) parts.push(`${totalPcs} piece${totalPcs === 1 ? '' : 's'}`);
            if (state.customer && state.customer.company) parts.push(state.customer.company);
            const summary = parts.length ? ` — ${parts.join(' · ')}` : '';
            const qidLabel = (quoteID && typeof quoteID === 'string') ? ` <strong>${escapeHtml(quoteID)}</strong>` : '';

            const banner = document.createElement('div');
            banner.className = 'dtg-resume-banner-inline';
            banner.innerHTML = `
                <span class="drbi-icon"><i class="fas fa-clock-rotate-left"></i></span>
                <span class="drbi-msg">Resumed your last quote${qidLabel}${escapeHtml(summary)}. Continue editing below, or start over.</span>
                <button type="button" class="drbi-dismiss" data-action="dismiss">
                    <i class="fas fa-trash-can"></i> Start fresh
                </button>
                <button type="button" class="drbi-close" data-action="close" aria-label="Dismiss this notice">
                    <i class="fas fa-times"></i>
                </button>
            `;
            const dismissBtn = banner.querySelector('[data-action="dismiss"]');
            const closeBtn = banner.querySelector('[data-action="close"]');
            if (dismissBtn) dismissBtn.addEventListener('click', () => {
                clearSessionState();
                resetForm();
                banner.remove();
            });
            if (closeBtn) closeBtn.addEventListener('click', () => banner.remove());
            mount.appendChild(banner);
            // No auto-dismiss — banner persists until the rep clicks
            // "Start fresh" or ×. Inline placement means it's not
            // visually intrusive, and reps can take their time deciding.
        } catch (err) {
            console.warn('[dtg-inline-form] showResumeBanner skipped:', err && err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ----- Real-time preview helpers (chat-driven, silent) ----------------
    // These let the chat controller fill the form INCREMENTALLY as the bot
    // does its work — before the final PRICE_QUOTE block arrives. They do
    // NOT mark dirty (so the C9 race guard doesn't fire) and do NOT save
    // to sessionStorage (preview state isn't yet authoritative).
    //
    // The "AI is filling…" indicator class `.dtg-row-ai-touched` is added
    // to the touched row and faded out after the next renderTable() call.

    // Find the row to preview into. Returns the first empty row (no style),
    // or null if every row already has a style (rep is mid-edit; don't
    // clobber). Used by previewStyle.
    function findPreviewableRow() {
        return state.rows.find((r) => !r.style) || null;
    }

    function previewStyle({ style, desc, color, colorsAvailable, availableSizes }) {
        if (!style) return;
        // Resolve a target row in this order:
        //   1. The first row with no style yet (catalog open, empty form)
        //   2. Otherwise, append a brand-new row (rep already has lines and
        //      is adding a second style/color from the catalog).
        //
        // Until 2026-05-19 this returned silently when every row already had
        // a style, which made the "Add Pink" CTA on a second catalog card
        // appear to do nothing — exactly the bug Erik reported. Mirrors the
        // same pattern previewLineItems() already uses.
        let row = findPreviewableRow();
        if (!row) {
            row = newBlankRow();
            state.rows.push(row);
        }
        row.style = String(style).toUpperCase();
        row.styleUpper = row.style;
        if (desc) row.desc = desc;
        if (Array.isArray(colorsAvailable)) row.colorsAvailable = colorsAvailable;
        if (Array.isArray(availableSizes)) row.availableSizes = availableSizes;

        // If the chat detected a color (from rep's message OR existing rows),
        // push it through fuzzyMatchColor to resolve canonical + catalogColor
        // + swatch image. Saves a 2nd round-trip via quote_dtg_pricing for
        // the color cell to fill.
        if (color && !row.color) {
            const matched = fuzzyMatchColor(row.colorsAvailable || [], color);
            if (matched) {
                row.color = matched.COLOR_NAME || matched.colorName || matched.name || color;
                row.catalogColor = matched.CATALOG_COLOR || matched.catalogColor || '';
                row.colorSwatch = matched.COLOR_SQUARE_IMAGE || matched.swatchImageUrl || '';
                if (row.catalogColor) kickInventoryFetch(row);
            } else {
                // No match in the catalog — store the rep's text and let the
                // hydrate path (in fillFromQuote) try again with a longer list.
                row.color = String(color);
            }
        }

        row._aiTouched = Date.now(); // for the visual indicator
        // Re-render WITHOUT marking dirty / saving to sessionStorage —
        // this is a transient preview, not a rep edit.
        renderTable();
    }

    /**
     * Fill the form's rows from a `quote_dtg_pricing` tool result. Each lineItem
     * has the shape returned by `caspio-pricing-proxy/lib/dtg-canonical-pricing.js`:
     *   { styleNumber, color, sizes: {S: 2, ...}, totalQuantity, ... }
     *
     * Strategy per line:
     *   1. Find a row matching (style, color) case-insensitive.
     *   2. Else use the first empty row (no style).
     *   3. Else append a new row at the end.
     *
     * For each filled row:
     *   - row.style + row.color (via fuzzyMatchColor when colorsAvailable is hydrated)
     *   - row.sizes merged into existing — only fill cells the rep hasn't typed
     *   - row.catalogColor + row.colorSwatch (when colorsAvailable hits)
     *   - row._aiTouched timestamp for the pulse indicator
     *   - kickInventoryFetch() once catalogColor is resolved
     */
    function previewLineItems(lineItems) {
        if (!Array.isArray(lineItems) || !lineItems.length) return;
        let mutated = false;
        for (const item of lineItems) {
            const style = String(item.styleNumber || item.style || '').toUpperCase();
            const color = String(item.color || '').trim();
            if (!style) continue;

            // Find an existing row by (style, color) — case-insensitive.
            let row = state.rows.find((r) =>
                String(r.style || '').toUpperCase() === style &&
                String(r.color || '').toLowerCase() === color.toLowerCase()
            );
            // Fall back to first empty-style row.
            if (!row) row = state.rows.find((r) => !r.style) || null;
            // Fall back to creating a new row.
            if (!row) {
                row = newBlankRow();
                state.rows.push(row);
            }

            row.style = style;
            row.styleUpper = style;

            // Color resolution: use fuzzyMatchColor when we have hydrated
            // colorsAvailable (set by previewStyle or fillFromQuote earlier).
            // Otherwise store the raw color text and let the next hydrate
            // pass resolve it.
            if (color && !row.color) {
                const matched = fuzzyMatchColor(row.colorsAvailable || [], color);
                if (matched) {
                    row.color = matched.COLOR_NAME || matched.colorName || matched.name || color;
                    row.catalogColor = matched.CATALOG_COLOR || matched.catalogColor || '';
                    row.colorSwatch = matched.COLOR_SQUARE_IMAGE || matched.swatchImageUrl || '';
                    if (row.catalogColor) kickInventoryFetch(row);
                } else {
                    row.color = color;
                }
            }

            // Size merge — per-cell, only fill cells the rep hasn't typed.
            // row.sizes[size] === undefined → fill. === 0 → fill (rep didn't
            // type 0 explicitly; that's the "empty" state). > 0 → keep rep's
            // value (they typed it, we don't clobber).
            const sizes = (item.sizes && typeof item.sizes === 'object') ? item.sizes : {};
            for (const [size, qty] of Object.entries(sizes)) {
                const n = Number(qty);
                if (!Number.isFinite(n) || n < 0) continue;
                const existing = Number(row.sizes[size]) || 0;
                if (existing === 0) row.sizes[size] = n;
            }

            row._aiTouched = Date.now();
            mutated = true;
        }
        if (mutated) {
            renderTable();
            schedulePriceUpdate();
        }
    }

    function previewCustomer(match) {
        if (!match) return;
        // Only fill if the rep hasn't already typed customer info.
        if (state.customer.email || state.customer.company || state.customer.companyId) return;
        const nameParts = String(match.contact_name || '').split(/\s+/);
        state.customer.company = match.company || state.customer.company;
        state.customer.companyId = match.customer_number || state.customer.companyId;
        state.customer.firstName = match.contact_first || nameParts[0] || state.customer.firstName;
        state.customer.lastName  = match.contact_last  || nameParts.slice(1).join(' ') || state.customer.lastName;
        state.customer.email = match.email || state.customer.email;
        state.customer.phone = match.phone || state.customer.phone;
        // Reflect into DOM
        const set = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value) el.value = val; };
        set('dtgCompanyInput', state.customer.company);
        set('dtgCompanyId', state.customer.companyId);
        set('dtgFirstName', state.customer.firstName);
        set('dtgLastName', state.customer.lastName);
        set('dtgEmail', state.customer.email);
        set('dtgPhone', state.customer.phone);
        updateSubmitEnabled();
    }

    // Expose API
    window.DTGInlineForm = {
        fillFromQuote,
        getState,
        resetForm,
        submitToShopWorks,
        // C9 — chat controller calls this before fillFromQuote() to decide
        // whether to warn about overwriting user edits.
        isDirty: () => state.dirtyAfterChatFill,
        clearDirty,
        // Real-time chat-driven preview hooks (silent, no dirty marking).
        previewStyle,
        previewCustomer,
        previewLineItems,
        // Read-only row inspector — used by the chat's product-details card
        // to detect a preselected color so it can collapse the swatch grid.
        getRows: () => state.rows.map((r) => ({
            style: r.style, color: r.color, catalogColor: r.catalogColor,
        })),
        /**
         * Write the print location to the form from the chat side.
         * Used when the rep types an explicit location code in chat
         * ("pc61 jet black FF s:2 m:13" → setLocation('FF', '')) so
         * the form pill switches automatically without making the rep
         * click. Returns the new effective location code (e.g. "LC_FB").
         *
         * front: one of 'LC', 'FF', 'JF' (front-only options)
         * back:  one of '', 'FB', 'JB' (optional back)
         */
        setLocation: (front, back) => {
            const VALID_FRONT = ['LC', 'FF', 'JF'];
            const VALID_BACK = ['', 'FB', 'JB'];
            const f = String(front || '').toUpperCase();
            const b = String(back || '').toUpperCase();
            if (!VALID_FRONT.includes(f)) return null;
            if (!VALID_BACK.includes(b)) return null;
            const changed = (state.front !== f) || (state.back !== b);
            if (!changed) return effectiveLocationCode();
            state.front = f;
            state.back = b;
            scheduleStateSave();
            renderLocationPills();
            schedulePriceUpdate();
            return effectiveLocationCode();
        },
        /**
         * Snapshot of form state for the chat backend. Sent on every chat
         * request as `calcContext.formState` so the bot knows what's
         * already on the form and doesn't re-ask. The bot uses this
         * to skip questions for fields the rep has already filled.
         */
        getFormSnapshot: () => ({
            locationCode: effectiveLocationCode() || 'LC',
            locationLabel: effectiveLocationLabel(),
            front: state.front || 'LC',
            back: state.back || '',
            rows: state.rows
                .filter((r) => r.style || Object.values(r.sizes || {}).some((q) => Number(q) > 0))
                .map((r) => ({
                    style: r.style || '',
                    color: r.color || '',
                    sizes: r.sizes || {},
                    totalQty: Object.values(r.sizes || {}).reduce((s, q) => s + (Number(q) || 0), 0),
                })),
            customer: {
                company: state.customer.company || '',
                companyId: state.customer.companyId || '',
                firstName: state.customer.firstName || '',
                lastName: state.customer.lastName || '',
                email: state.customer.email || '',
                phone: state.customer.phone || '',
                designNumber: state.customer.designNumber || '',
            },
            shipping: { method: state.shipping.method || 'ups' },
        }),
    };
})();
