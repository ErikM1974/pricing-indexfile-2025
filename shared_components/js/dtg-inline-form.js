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

// Shared leave-guard flag (2026-06-10) — quote-builder-utils.js's global
// markAsUnsaved()/markAsSaved()/hasUnsavedChanges() write/read this as a bare
// identifier, so it MUST be a top-level script binding (outside the IIFE), same
// as the `let hasChanges` in the EMB/SCP/DTF builders. Drives setupBeforeUnloadGuard().
let hasChanges = false;

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

    // Shipping methods — values match ShopWorks's ship method list EXACTLY
    // (no client→server translation needed at submit time, value passes
    // through verbatim into payload.ship.method). Erik's curated list
    // (2026-05-20): just the 3 we actually use. Order matches dropdown UI
    // order. First entry = default.
    const SHIP_METHODS = [
        { code: 'Customer Pickup', label: 'Customer Pickup' },
        { code: 'UPS Ground',      label: 'UPS Ground' },
        { code: 'Priority Mail',   label: 'Priority Mail' },
    ];
    function shipLabel(code) {
        const m = SHIP_METHODS.find(x => x.code === code);
        return m ? m.label : 'Customer Pickup';
    }
    function isPickupMethod(method) {
        // Centralized check — covers ShopWorks-canonical "Customer Pickup"
        // PLUS the legacy 'pickup' / 'willcall' codes used in share-link
        // drafts before v2026.05.20.7. Once those drafts age out, can
        // collapse to just the first equality.
        return method === 'Customer Pickup' || method === 'pickup' || method === 'willcall';
    }

    // --- Date helpers (Erik 2026-05-20) -------------------------------------
    // ISO date "YYYY-MM-DD" matches HTML <input type="date"> serialization
    // AND ManageOrders push (proxy reformats to MM/DD/YYYY on its side).
    function isoDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }
    // Add N business days (Mon-Fri only). NOTE: doesn't account for US holidays —
    // rep is expected to bump the date manually for holiday weeks (Thanksgiving,
    // Xmas). Worth adding a holiday-aware version if reps complain.
    function addBusinessDays(start, days) {
        const d = new Date(start);
        let added = 0;
        while (added < days) {
            d.setDate(d.getDate() + 1);
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        return d;
    }
    // Erik's rule: ≤ 24 pcs → 5 business days; > 24 pcs → 10 business days.
    function computeAutoDueDate(combinedQty) {
        const bizDays = combinedQty > 24 ? 10 : 5;
        return isoDate(addBusinessDays(new Date(), bizDays));
    }
    // Human-readable label for the auto-due hint shown next to the field.
    function dueDateAutoLabel(combinedQty) {
        if (combinedQty <= 0) return '5 business days (auto)';
        return combinedQty > 24
            ? `10 business days (auto · 25+ pcs)`
            : `5 business days (auto · ${combinedQty} pcs)`;
    }

    // sessionStorage key prefix + state-shape version (bump if state shape
    // changes incompatibly so old restores don't crash).
    // v2 (2026-05-20): SHIP_METHODS now uses ShopWorks-canonical names
    // ("Customer Pickup" instead of "pickup"); old v1 sessions with
    // method='ups'/'pickup' would no longer match the new dropdown values
    // and would crash the select. Bumping invalidates old sessions cleanly.
    const STATE_VERSION = 2;
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
    // DATA GAP (2026-06-11 parity audit): the pricing layer only supports
    // these 4 front+back combos — dtg-pricing-service.js `this.locations`
    // and the server whitelist in caspio-pricing-proxy/lib/
    // dtg-canonical-pricing.js. DTG_Costs has cost rows for the 5 single
    // locations only; combos are synthesized from that fixed list, so
    // FF_JB and JF_FB are unpriceable — the live preview rendered them as
    // blank/$0 and POST /api/dtg/quote-pricing rejects them with
    // bad_input (verified live). Never offer a combo the data can't back.
    const SUPPORTED_COMBOS = ['LC_FB', 'FF_FB', 'JF_JB', 'LC_JB'];
    function isComboSupported(front, back) {
        if (!front || !back) return true; // single locations always price
        return SUPPORTED_COMBOS.includes(`${front}_${back}`);
    }
    // Drop a back selection the data can't price with the current front.
    // Returns the cleared back code ('' if nothing changed) so callers
    // can surface the change to the rep.
    function sanitizeLocationState() {
        if (state.back && !isComboSupported(state.front, state.back)) {
            const cleared = state.back;
            console.warn(`[dtg-inline-form] Unpriceable location combo ${state.front}_${cleared} — back print cleared (no DTG_Costs rows; /api/dtg/quote-pricing rejects it).`);
            state.back = '';
            return cleared;
        }
        return '';
    }

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
            state: '',      // billing state — flows from company_contacts_2026.State
            city: '',       // billing city  — same source, used as default ship-to city
            po: '',         // customer's purchase order # — passed as info.po → ShopWorks CustomerPurchaseOrder
            designNumber: '',
            terms: 'Prepaid',
            contacts: [],   // populated when a company is picked
            salesRepCode: lastRepCode || 'erik', // A1
            // Curated CRM context (Erik 2026-05-23) — populated by pick()
            // from CompanyContactsMerge2026 fields the proxy now returns.
            // Surfaces in the DTG form as a warning banner, tax chip, and
            // auto-fills the payment terms dropdown. Flows through info.*
            // on submit so the server can suppress tax for exempt customers.
            customerWarning: '',
            isTaxExempt:     false,
            isWholesale:     false,  // [2026-06-08] Phase 1: wholesale/reseller → 0 tax + GL 2203
            taxExemptNumber: '',
            paymentTerms:    '',     // CRM-preferred terms (e.g., "Net 30") — auto-selects in dropdown
            accountTier:     '',     // VIP / GOLD / House — info-only badge
        },
        // Schedule — production due date + customer event ("drop dead") date.
        // Erik's rule (2026-05-20): qty ≤ 24 → 5 business days; qty > 24 → 10
        // business days. Drop dead is optional and only used when the customer
        // has a hard deadline (event, photo shoot, etc.).
        // dueDate / dropDeadDate are ISO strings "YYYY-MM-DD" (matches HTML
        // <input type="date"> format). Backend converts to MM/DD/YYYY for OnSite.
        scheduling: {
            dueDate: '',         // production due date — auto unless rep edits
            dropDeadDate: '',    // optional customer event date
            autoDueDate: true,   // true = recompute on qty change; false = rep manually overrode
        },
        // New-artwork upload (Erik 2026-05-20).
        // Used when the rep has NEW artwork (not in Design_Lookup_2026 / no
        // ShopWorks id_Design yet). Frontend uploads file(s) to Caspio via
        // /api/files/upload; the hosted URLs flow through the submit body as
        // body.files[] → server.js Designs[] gate (now open) → ShopWorks
        // creates a new design with metadata + ImageURL.
        //
        // Mutually exclusive with state.customer.designNumber (the existing-
        // design picker). Readiness panel blocks submit if both are set.
        newArtwork: {
            designName: '',  // required (rep types) — flows to info.newDesignName → base.name in server.js
            files: [],       // [{ fileName, uniqueFileName, hostedUrl, externalKey, fileSize, fileType, placement }]
        },
        shipping: {
            // Default 'Customer Pickup' since ~95% of NWCA orders are local
            // Tacoma-area pickups (Erik 2026-05-20). Reps switch to UPS Ground
            // / Priority Mail only when shipping. Toggling the pickup
            // checkbox flips between this and the prior non-pickup method.
            method: 'Customer Pickup',
            // Ship-to address (only relevant when method !== 'Customer Pickup').
            // Pre-filled from the picked contact's company address; overridable
            // for drop-ships.
            address1: '',
            address2: '',
            city: '',
            state: '',
            zip: '',
            // Computed tax — populated by the DOR /api/tax-rates/lookup call
            // (in-WA shipping) OR hardcoded to 0.101 (pickup) / 0 (out-of-state).
            // Floats 0..1 (NOT a percentage). Read by recalc + submit. Starts at
            // 10.1% so the first preview render shows a plausible Tacoma-ish
            // estimate even before the rep types a ship-to address; the real
            // rate replaces this as soon as recomputeTaxRate() runs.
            taxRate: 0.101,
            taxRateSource: 'default-pre-lookup',
            // Caspio sales_tax_accounts_2026 row matched to this rate. The DOR
            // lookup endpoint returns these so we can surface the right GL
            // account in the ShopWorks Notes On Order block (Erik applies tax
            // manually post-import — see memory/wa-sales-tax-rules.md).
            taxAccount: '2200.101',
            taxAccountName: 'Wash:10.1%',
            // [2026-06-08] Phase 1 tax-control flags. includeTax: rep can opt the whole quote out of tax.
            // taxRateOverride: null = auto (DOR/pickup/exempt/etc.); a number (percent) = the manual rate the rep typed.
            includeTax: true,
            taxRateOverride: null,
            // [2026-06-09] Phase 2 — billed shipping charge. Shipping is TAXABLE in WA
            // (WAC 458-20-110), so this enters the tax BASE + the total at all 4 sites
            // (screen / submit / PDF / save) via effectiveShipFee() (which zeroes it for
            // pickup). 0 = no charge. Read through effectiveShipFee(), never directly.
            fee: 0,
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
    // Two dirty flags with different jobs: dirtyAfterChatFill gates the chat
    // controller's "overwrite your edits?" warning (cleared on fillFromQuote);
    // the shared hasChanges (quote-builder-utils.js markAsUnsaved) drives the
    // beforeunload leave-guard (cleared only on save/push/reset). Every USER
    // mutation site calls markDirty(), so it feeds both; programmatic
    // fills/loads call neither. (2026-06-10)
    function markDirty() {
        state.dirtyAfterChatFill = true;
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
    }
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
                sanitizeLocationState(); // stale session may hold FF_JB/JF_FB
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

    // [2026-06-09] Phase 2 — the billed shipping charge that enters the tax base + total.
    // SINGLE source of the pickup rule: a Customer-Pickup order never carries a shipping
    // charge (the customer collects at Milton), so ALL FOUR total/tax sites (renderSummary,
    // computePriceQuoteFromState, dtgPrintQuote, submitToShopWorks) + the save read THIS,
    // never state.shipping.fee directly. Mirrors recomputeTaxRate being the single tax
    // authority — wire one rule once so the four consumers can't desync on the taxed base.
    function effectiveShipFee() {
        if (isPickupMethod(state.shipping.method)) return 0;
        const f = Number(state.shipping.fee);
        return Number.isFinite(f) && f > 0 ? Math.round(f * 100) / 100 : 0;
    }

    // [2026-06-09] Phase 2 — pull the #dtgShipFee input into state. The shared estimator
    // (quote-order-summary.estimateShipping) writes #dtgShipFee.value DIRECTLY, so its
    // onApplied hook + the manual input handler both call this to sync state before the
    // tax base re-renders.
    function syncShipFeeFromDom() {
        const el = document.getElementById('dtgShipFee');
        if (!el) return;
        const v = parseFloat(el.value);
        state.shipping.fee = (Number.isFinite(v) && v > 0) ? v : 0;
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

    // Search companies with progressive fallback.
    //
    // The backend treats the whole query as one literal substring (LIKE
    // '%full query%'), so "Archterra Landscape Company" returns 0 matches
    // for "Archterra Landscape Service" because of the last word. To fix
    // this client-side without a backend redeploy, we retry with shorter
    // prefixes when the full search returns nothing:
    //
    //   "Archterra Landscape Company"  →  0 matches  →  retry...
    //   "Archterra Landscape"          →  1 match    →  use this
    //
    // Results carry a `_searchedFor` field so the dropdown can show a
    // "did you mean" hint when the rep typed something longer than what
    // actually matched.
    async function fetchCompanies(q) {
        const key = q.toLowerCase();
        if (_companySearchCache.has(key)) return _companySearchCache.get(key);

        const hitApi = async (query) => {
            const r = await fetch(`${API_BASE}/api/company-contacts-2026/search?q=${encodeURIComponent(query)}&limit=10`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            return Array.isArray(data && data.companies) ? data.companies : [];
        };

        try {
            // First attempt: exact query
            let results = await hitApi(q);
            let searchedFor = q;

            // Fallback chain: progressively drop trailing tokens until we
            // find matches OR run out of tokens.
            if (results.length === 0) {
                const tokens = q.trim().split(/\s+/).filter(Boolean);
                for (let n = tokens.length - 1; n >= 1; n--) {
                    const tryQuery = tokens.slice(0, n).join(' ');
                    // Don't retry queries that are too short — backend rejects
                    // very short queries via sanitizeSearchQuery anyway.
                    if (tryQuery.length < 2) break;
                    const tryResults = await hitApi(tryQuery);
                    if (tryResults.length > 0) {
                        results = tryResults;
                        searchedFor = tryQuery;
                        break;
                    }
                }
            }

            // Tag the results so paint() can show a hint if we fell back
            if (searchedFor !== q && results.length > 0) {
                results._fallbackFrom = q;
                results._fallbackTo = searchedFor;
            }

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
            // Return an ERROR SENTINEL (not null) so updateLivePrices surfaces a VISIBLE
            // failure instead of silently pricing the row at $0 — a too-low total a rep
            // could quote. Erik's #1 rule: an API failure must be shown, never a silent
            // fallback to zero. (Not cached → retried on the next recompute.) (2026-06-01)
            return { __pricingError: true, style: sn, message: (err && err.message) || 'pricing unavailable' };
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
            <!-- Design thumbnail lightbox (2026-05-20). Click any design thumbnail
                 in the form → opens full-size image here. Backdrop / Escape / X
                 button close it. Mounted at the top so z-index stacks cleanly. -->
            <div class="dtg-thumb-lightbox" id="dtgThumbLightbox" hidden role="dialog" aria-modal="true" aria-labelledby="dtgThumbLightboxTitle">
                <div class="dtg-thumb-lightbox-backdrop" data-action="close"></div>
                <div class="dtg-thumb-lightbox-panel">
                    <button type="button" class="dtg-thumb-lightbox-close" data-action="close" aria-label="Close design preview">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="dtg-thumb-lightbox-title" id="dtgThumbLightboxTitle"></div>
                    <img id="dtgThumbLightboxImg" alt="" loading="lazy">
                </div>
            </div>
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
                        <!-- 2026-05-19: switched from <table> to card-per-line-item
                             so the form fits cleanly in the new sticky right column
                             of the two-column layout. Each card is self-contained:
                             style + color row at top, size grid wrapping below,
                             totals at the bottom. -->
                        <div class="dtg-rows-cards" id="dtgRowsCards"></div>
                        <button type="button" class="dtg-add-row-btn" id="dtgAddRowBtn"><i class="fas fa-plus"></i> Add row</button>

                        <div id="dtgPriceSummary" class="dtg-price-summary"></div>
                        <!-- [2026-06-08] Order-at-a-glance band (Phase 0) — both :empty-hidden until populated by quote-order-summary.js -->
                        <div class="order-recap" id="order-recap"></div>
                        <div class="ship-to-card" id="ship-to-card"></div>
                    </div>

                    <aside class="dtg-customer-pane dcp-horizontal">
                        <div class="dcp-label"><i class="fas fa-building"></i> Customer + push</div>
                        <div class="dcp-search-label">Search customer</div>
                        <div class="dtg-combobox" id="dtgCompanyCombo">
                            <input type="text" id="dtgCompanyInput" autocomplete="off" placeholder="Company name or contact…">
                        </div>

                        <!-- Curated CRM context banners (Erik 2026-05-23).
                             Populated by renderCustomerContextBadges() after a
                             customer is picked. Hidden when the customer has no
                             warning / no tax exempt / no account tier. -->
                        <div id="dtgCustomerWarning" class="dtg-customer-warning" hidden
                             style="display:flex;align-items:flex-start;gap:10px;background:#fef3c7;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:4px;padding:10px 14px;margin:8px 0;color:#78350f;font-size:13px;line-height:1.45;"></div>
                        <div class="dcp-chip-row" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
                            <span id="dtgTaxExemptChip" hidden
                                  style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;color:#166534;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;"></span>
                            <span id="dtgAccountTierBadge" hidden
                                  style="display:inline-flex;align-items:center;gap:6px;background:#e0e7ff;border:1px solid #c7d2fe;color:#3730a3;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;"></span>
                        </div>

                        <!-- Customer history pill (2026-05-20 — Phase 1: info-only).
                             Appears after a customer is picked. Shows aggregated 90-day
                             order patterns from ManageOrders: order count, last order
                             date, usual ship method + terms, last design used, and any
                             backfill suggestions for missing contact data. Does NOT
                             auto-fill any field values — rep clicks "Use this" buttons
                             to apply suggestions explicitly. -->
                        <div class="dcp-history-pill" id="dtgHistoryPill" hidden>
                            <div class="dhp-head" id="dtgHistoryPillHead">
                                <i class="fas fa-clipboard-list"></i>
                                <span class="dhp-summary" id="dtgHistoryPillSummary">Loading customer history…</span>
                                <button type="button" class="dhp-toggle" id="dtgHistoryPillToggle" aria-label="Expand history" aria-expanded="false">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                            <div class="dhp-body" id="dtgHistoryPillBody" hidden></div>
                        </div>

                        <!-- Contact picker — appears after a customer is picked, showing
                             every contact on file at that company so the rep can switch
                             between them (e.g. Aaberg's has Craig Edward, Accounting,
                             and Alexx Bacon). Hidden when no contacts exist. -->
                        <div class="dcp-contact-row" id="dtgContactRow" hidden>
                            <div class="dcp-field-label">
                                <i class="fas fa-user"></i>
                                Contact at this company
                                <span class="dcp-contact-count" id="dtgContactCount"></span>
                            </div>
                            <select id="dtgContactPicker" class="dcp-contact-select">
                                <option value="">— pick a contact —</option>
                            </select>
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
                            <div class="dcp-field-wrap">
                                <div class="dcp-field-label">Customer PO # <span class="dcp-optional">(optional)</span></div>
                                <input type="text" id="dtgPoNumber" autocomplete="off" placeholder="Customer's purchase order #">
                            </div>
                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">Design # <span class="dcp-optional">(optional)</span></div>
                                    <div class="dtg-design-row">
                                        <div class="dtg-combobox" id="dtgDesignCombo" data-combo-kind="design">
                                            <input type="text" id="dtgDesignNumber" autocomplete="off" placeholder="Pick a customer first to see their DTG designs">
                                            <i class="fas fa-caret-down dtg-combobox-chevron" aria-hidden="true"></i>
                                        </div>
                                        <a id="dtgDesignThumbAnchor" class="dtg-design-thumb-anchor" href="#" hidden>
                                            <img id="dtgDesignThumbImg" alt="" loading="lazy">
                                            <span class="dtg-design-thumb-zoom" aria-hidden="true">
                                                <i class="fas fa-search-plus"></i>
                                            </span>
                                        </a>
                                    </div>
                                </div>
                                <div>
                                    <div class="dcp-field-label">
                                        Payment terms
                                        <span id="dtgTermsMapNote" hidden
                                              style="font-size:11px;color:#92400e;font-weight:600;margin-left:6px;"
                                              title="Customer's CRM term mapped to a term NWCA currently offers"></span>
                                    </div>
                                    <select id="dtgTerms">
                                        <option value="Prepaid">Prepaid</option>
                                        <option value="Net 10">Net 10</option>
                                        <option value="Pay On Pickup">Pay On Pickup</option>
                                    </select>
                                </div>
                            </div>

                            <!-- ============================================================
                                 New-artwork upload block (Erik 2026-05-20).
                                 Visible whenever no existing Design # is picked. Rep uploads
                                 artwork → file is hosted in Caspio's artwork folder → URL flows
                                 to ManageOrders Designs[0].Locations[0].ImageURL → ShopWorks
                                 creates a new design record on import. Multiple files allowed
                                 (one per print placement).
                                 ============================================================ -->
                            <div class="dcp-newart" id="dtgNewArtworkBlock">
                                <div class="dcp-section-head">
                                    <i class="fas fa-paint-brush"></i> Or upload new artwork
                                    <span class="dcp-newart-sub">No design # yet? Upload the file here.</span>
                                </div>
                                <div class="dcp-field-wrap">
                                    <div class="dcp-field-label">
                                        Design name
                                        <span class="dcp-required">required</span>
                                    </div>
                                    <input type="text" id="dtgNewArtworkName"
                                        autocomplete="off"
                                        placeholder="e.g. Star Sportswear front logo 2026"
                                        value="${escapeHtml(state.newArtwork.designName || '')}">
                                    <div class="dcp-field-hint">Used to find this design later in ShopWorks's art library.</div>
                                </div>
                                <div class="dcp-newart-dropzone" id="dtgNewArtworkDropzone" tabindex="0" role="button" aria-label="Upload artwork file">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <div class="dcp-newart-dropzone-msg">
                                        <strong>Drop file here</strong> or <span class="dcp-newart-browse">click to browse</span>
                                    </div>
                                    <div class="dcp-newart-dropzone-sub">AI / EPS / PSD / PDF / PNG / JPG / TIFF · 20 MB max</div>
                                </div>
                                <input type="file" id="dtgNewArtworkInput" class="dcp-newart-input"
                                    accept=".ai,.eps,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.psd,.svg,.webp"
                                    multiple
                                    hidden>
                                <div class="dcp-newart-list" id="dtgNewArtworkList"></div>
                                <div class="dcp-newart-status" id="dtgNewArtworkStatus"></div>
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

                            <!-- Schedule section (2026-05-20).
                                 Due date auto-calculates from combined qty:
                                   ≤24 pcs → 5 business days
                                   >24 pcs → 10 business days
                                 Rep can override either date. Drop dead optional. -->
                            <div class="dcp-dates">
                                <div class="dcp-section-head">
                                    <i class="fas fa-calendar-alt"></i> Schedule
                                </div>
                                <div class="dcp-row">
                                    <div>
                                        <div class="dcp-field-label">
                                            Due date <span class="dcp-field-sub">production ready</span>
                                        </div>
                                        <input type="date" id="dtgDueDate" value="${escapeHtml(state.scheduling.dueDate || '')}">
                                        <div class="dcp-date-hint" id="dtgDueDateHint">${escapeHtml(state.scheduling.autoDueDate ? dueDateAutoLabel(combinedQty()) : 'Manual override')}</div>
                                    </div>
                                    <div>
                                        <div class="dcp-field-label">
                                            Drop dead <span class="dcp-optional">(optional — customer event)</span>
                                        </div>
                                        <input type="date" id="dtgDropDeadDate" value="${escapeHtml(state.scheduling.dropDeadDate || '')}">
                                        <div class="dcp-date-hint">Customer's hard deadline</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Customer Pickup toggle (2026-05-20).
                                 ON  → hides ship-to fields, sets ShipMethod = Customer Pickup,
                                       tax = 10.1% (Milton, WA flat).
                                 OFF → shows ship-to fields, tax = destination lookup if WA
                                       or 0% if out-of-state.
                                 Default: ON (matches state.shipping.method = 'Customer Pickup'). -->
                            <div class="dcp-pickup-toggle">
                                <label class="dcp-toggle-label">
                                    <input type="checkbox" id="dtgPickupToggle"${isPickupMethod(state.shipping.method) ? ' checked' : ''}>
                                    <span class="dcp-toggle-track"><span class="dcp-toggle-thumb"></span></span>
                                    <span class="dcp-toggle-text">
                                        <strong>Customer Pickup</strong>
                                        <span class="dcp-toggle-sub">Pickup at NWCA Milton — no shipping address, tax 10.1% flat</span>
                                    </span>
                                </label>
                            </div>

                            <!-- Ship-to address block (hidden when pickup is ON).
                                 Pre-fills from contact's company address. Override
                                 allowed for drop-ships. -->
                            <div class="dcp-shipto" id="dtgShipToBlock"${isPickupMethod(state.shipping.method) ? ' hidden' : ''}>
                                <div class="dcp-shipto-head">
                                    <i class="fas fa-truck"></i> Ship to
                                    <span class="dcp-shipto-sub">Destination drives the tax rate</span>
                                </div>
                                <div class="dcp-field-wrap">
                                    <div class="dcp-field-label">Address line 1</div>
                                    <input type="text" id="dtgShipAddress1" autocomplete="off" value="${escapeHtml(state.shipping.address1 || '')}">
                                </div>
                                <div class="dcp-field-wrap">
                                    <div class="dcp-field-label">Address line 2 <span class="dcp-optional">(optional)</span></div>
                                    <input type="text" id="dtgShipAddress2" autocomplete="off" value="${escapeHtml(state.shipping.address2 || '')}">
                                </div>
                                <div class="dcp-row dcp-row-3">
                                    <div>
                                        <div class="dcp-field-label">City</div>
                                        <input type="text" id="dtgShipCity" autocomplete="off" value="${escapeHtml(state.shipping.city || '')}">
                                    </div>
                                    <div>
                                        <div class="dcp-field-label">State</div>
                                        <input type="text" id="dtgShipState" autocomplete="off" maxlength="2" placeholder="WA" value="${escapeHtml(state.shipping.state || '')}">
                                    </div>
                                    <div>
                                        <div class="dcp-field-label">ZIP</div>
                                        <input type="text" id="dtgShipZip" autocomplete="off" maxlength="10" value="${escapeHtml(state.shipping.zip || '')}">
                                    </div>
                                </div>
                                <div class="dcp-tax-status" id="dtgTaxStatus"></div>
                                <!-- [2026-06-09] Phase 2 — billed shipping charge + UPS-Ground estimator.
                                     Lives INSIDE #dtgShipToBlock (hidden under Customer Pickup) — pickup
                                     orders never bill shipping, so the field is correctly out of reach there
                                     and effectiveShipFee() zeroes any stale value. Shipping is TAXABLE in WA
                                     (WAC 458-20-110) → the fee enters the tax base. The Estimate button calls
                                     the shared global estimateShipping() (quote-order-summary.js). -->
                                <div class="dcp-field-wrap dcp-shipfee-wrap">
                                    <div class="dcp-field-label">Shipping charge <span class="dcp-optional">billed to customer · taxable in WA</span></div>
                                    <div class="dcp-shipfee-row">
                                        <span class="dcp-shipfee-prefix">$</span>
                                        <input type="number" id="dtgShipFee" step="0.01" min="0" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${Number(state.shipping.fee) > 0 ? Number(state.shipping.fee).toFixed(2) : ''}">
                                        <button type="button" id="dtgEstimateShipBtn" class="dcp-estimate-btn" onclick="estimateShipping()"><i class="fas fa-truck-fast"></i> Estimate UPS Ground</button>
                                    </div>
                                    <div class="dcp-estimate-result" id="dtgEstimateShipResult"></div>
                                </div>
                            </div>
                            <!-- [2026-06-08] Phase 1 tax controls — include-tax / manual rate / wholesale.
                                 MOVED OUT of #dtgShipToBlock (which is hidden when Customer Pickup is ON)
                                 so they're reachable for pickup orders too — ~95% of DTG volume, and
                                 wholesale/reseller customers are largely the local-pickup crowd.
                                 recomputeTaxRate() is the single authority for all three. -->
                            <div class="dtg-tax-controls" id="dtgTaxControls">
                                <label class="dtg-tax-ctl"><input type="checkbox" id="include-tax" ${state.shipping.includeTax !== false ? 'checked' : ''}> Include sales tax</label>
                                <label class="dtg-tax-ctl">Rate <input type="number" id="tax-rate-input" step="0.1" min="0" max="20" placeholder="auto" value="${state.shipping.taxRateOverride != null ? state.shipping.taxRateOverride : ''}"> %</label>
                                <label class="dtg-tax-ctl"><input type="checkbox" id="wholesale-checkbox" ${state.customer.isWholesale ? 'checked' : ''}> Wholesale / reseller — no tax (GL 2203)</label>
                            </div>
                        </div>

                        <!-- Pre-flight readiness panel (2026-05-19). Replaces
                             the old single-line validation banner with a richer
                             checklist showing every item's state (✓ ready,
                             ⚠ warning, ✗ blocker) plus tier-break optimization
                             hints. Click any ⚠ or ✗ item to scroll to / focus
                             the field that needs attention. -->
                        <div id="dtgPreflightPanel" class="dtg-preflight-panel"></div>

                        <button type="button" class="dtg-submit-btn" id="dtgSubmitBtn">
                            <i class="fas fa-upload"></i> Push to ShopWorks
                        </button>
                        <div id="dtgSubmitStatus" class="dtg-submit-status" hidden></div>

                        <!-- Phase 11.4/11.5 (2026-05-24): Print + Email parity with EMB/DTF/SCP.
                             Print works from current state at any time. Email requires a
                             saved quote ID (sets after "Save & share link" in chat panel). -->
                        <div class="dtg-secondary-actions">
                            <!-- [2026-06-08] Phase 1 Chunk C — Save button on the FORM (manual-first
                                 parity with EMB/DTF/SCP). Saves the manual quote (with tax/wholesale)
                                 to quote_sessions via dtg-quote-page's handleSaveQuote; first click
                                 saves, second copies the share link. Manual quotes were previously
                                 unsaveable (the chat-panel Save button is hidden without an AI quote). -->
                            <button type="button" class="dtg-secondary-btn" id="dtgSaveBtn" title="Save this quote &amp; get a shareable link">
                                <i class="fas fa-floppy-disk"></i> Save &amp; Get Link
                            </button>
                            <button type="button" class="dtg-secondary-btn" id="dtgPrintBtn" title="Open printable PDF-quality invoice of this quote">
                                <i class="fas fa-print"></i> Print Quote
                            </button>
                            <button type="button" class="dtg-secondary-btn" id="dtgEmailBtn" title="Email this quote link to the customer (save quote first)">
                                <i class="fas fa-envelope"></i> Email Quote
                            </button>
                        </div>
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
        ` + BACK_LOCATIONS.map((loc) => {
            // Unpriceable combos (FF_JB / JF_FB — see SUPPORTED_COMBOS) render
            // disabled so the rep can't select a price the data can't back.
            const supported = isComboSupported(state.front, loc.code);
            const disabledAttrs = supported ? '' :
                ` disabled title="Not available with ${escapeHtml(LOCATION_LABELS[state.front] || state.front)} — no pricing data for ${escapeHtml(state.front)}_${escapeHtml(loc.code)}"`;
            return `
            <button type="button" class="dtg-location-pill${state.back === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="back"${disabledAttrs}>
                ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
            </button>
        `;
        }).join('');

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
                const clearedBack = sanitizeLocationState();
                if (clearedBack) {
                    showToastSafe(`${LOCATION_LABELS[clearedBack] || clearedBack} isn't available with ${LOCATION_LABELS[state.front] || state.front} — back print cleared.`);
                }
                markDirty();
                scheduleStateSave();
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
        backEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-loc-code') || '';
                // Belt-and-braces: disabled pills don't fire clicks, but never
                // let an unpriceable combo into state regardless.
                if (code && !isComboSupported(state.front, code)) return;
                state.back = code;
                markDirty();
                scheduleStateSave();
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
    }

    // Renders state.rows as a stack of self-contained line-item cards.
    // Replaced the old <table> on 2026-05-19 so the form fits cleanly in the
    // narrow (~520px) sticky right column of the two-column layout. Each
    // card has: style+color row at top, size grid (XS-6XL in 2 rows of 5)
    // in the middle, and totals at the bottom. Per-row size availability
    // (N/A vs editable) replaces the old table-wide column-show logic.
    function renderTable() {
        const container = document.getElementById('dtgRowsCards');
        if (!container) return;

        if (state.rows.length === 0) {
            container.innerHTML = `<div class="dtg-rows-empty">No line items yet — pick a style from the catalog or click <strong>Add row</strong> to start.</div>`;
            return;
        }

        // Fixed size template — always render all 10 size slots per card.
        // Per-row availability hides individual cells as N/A. The card layout
        // doesn't need the table-wide collectSizesShown() compression anymore.
        const SIZE_GRID = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

        const classify = (window.OrderFormInventory && window.OrderFormInventory.classifyInventory)
            || ((q, a) => Number.isFinite(Number(a)) ? (Number(a) === 0 ? 'oos' : (q > a ? 'over' : (q > a * 0.8 ? 'low' : 'good'))) : 'unknown');

        container.innerHTML = state.rows.map((row) => {
            const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            const perPiece = row._perPiece;
            const lineTotal = (perPiece != null && total > 0) ? (perPiece * total) : null;
            const inv = row.inventory || { bySize: {}, status: 'unknown' };
            const invKnown = inv.status === 'ok';

            const sizeCells = SIZE_GRID.map((sz) => {
                const qty = Number((row.sizes || {})[sz]) || 0;
                const avail = row.availableSizes && row.availableSizes.length > 0
                    ? row.availableSizes.includes(sz)
                    : true;
                if (!avail && row.style) {
                    // Style doesn't carry this size — render a dimmed N/A cell.
                    return `<div class="dtg-size-cell dtg-size-cell--na" title="${escapeHtml(row.style)} doesn't come in ${escapeHtml(sz)}">
                        <div class="dtg-size-label">${escapeHtml(sz)}</div>
                        <div class="dtg-size-na">N/A</div>
                    </div>`;
                }
                // Per-size price (tier-adjusted with LTM amortized in). Replaces
                // the raw inventory count Erik removed in v11 — reps see the
                // upcharge for extended sizes at a glance, no mental math.
                const priceForSize = row._priceBySize ? row._priceBySize[sz] : null;
                const priceLabel = (typeof priceForSize === 'number')
                    ? `$${priceForSize.toFixed(2)}`
                    : '';

                // OOS warning — red dot + red border. Does NOT block typing
                // (rep may know stock is incoming); the warning is loud
                // enough to make them verify before promising.
                const invAvailable = inv.bySize ? inv.bySize[sz] : null;
                const stockKnown = invKnown && Number.isFinite(Number(invAvailable));
                const isOOS = stockKnown && Number(invAvailable) === 0;
                const oosDot = isOOS
                    ? `<span class="dtg-size-oos-dot" title="Out of stock at SanMar (${escapeHtml(sz)}) — verify before promising"></span>`
                    : '';

                // Inline warning when a rep types qty into an OOS cell.
                const typedOOS = isOOS && qty > 0;
                const oosWarn = typedOOS
                    ? `<div class="dtg-size-warn" title="Out of stock at SanMar — verify before promising">⚠ OOS</div>`
                    : '';

                // Keep the "over inventory" classification for the typed-too-much
                // case (rep typed 50 but only 12 in stock).
                const klass = stockKnown ? classify(qty, Number(invAvailable)) : 'unknown';
                const overflow = klass === 'over' && !isOOS;

                return `<div class="dtg-size-cell${overflow ? ' dtg-size-cell--overflow' : ''}${isOOS ? ' dtg-size-cell--oos' : ''}">
                    <div class="dtg-size-label">${escapeHtml(sz)}</div>
                    <input type="number" min="0" step="1" value="${qty || ''}" data-row-id="${row.id}" data-size="${escapeHtml(sz)}">
                    <div class="dtg-size-price${isOOS ? ' dtg-size-price--oos' : ''}">${oosDot}${priceLabel}</div>
                    ${oosWarn}
                </div>`;
            }).join('');

            const aiTouchedAgeMs = row._aiTouched ? Date.now() - row._aiTouched : 999999;
            const aiTouchClass = aiTouchedAgeMs < 2000 ? ' dtg-line-card--ai-touched' : '';
            const colorInvalid = isRowColorInvalid(row);

            return `
                <div class="dtg-line-card${aiTouchClass}" data-row-id="${escapeHtml(row.id)}">
                    <div class="dtg-line-head">
                        <div class="dtg-line-style dtg-row-style">
                            <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="style">
                                <input type="text" value="${escapeHtml(row.style)}" placeholder="Style (e.g. PC54)" autocomplete="off">
                            </div>
                        </div>
                        <div class="dtg-line-color dtg-row-color${colorInvalid ? ' dtg-row-color-invalid' : ''}">
                            <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="color">
                                ${row.colorSwatch
                                    ? `<span class="dtg-row-color-swatch" style="background-image:url('${escapeHtml(row.colorSwatch)}');" aria-hidden="true"></span>`
                                    : (row.color ? `<span class="dtg-row-color-swatch dtg-row-color-swatch--blank" aria-hidden="true"></span>` : '')}
                                <input type="text" value="${escapeHtml(row.color)}" placeholder="${row.style ? 'Pick color' : 'Pick style first'}" autocomplete="off" ${row.style ? '' : 'disabled'} ${row.colorSwatch || row.color ? 'data-has-swatch="true"' : ''}>
                                <i class="fas fa-caret-down dtg-combobox-chevron" aria-hidden="true"></i>
                            </div>
                        </div>
                        <div class="dtg-line-actions">
                            <button type="button" class="dtg-line-clone" data-clone-row="${escapeHtml(row.id)}" title="Clone this line (same style + sizes, change color)">
                                <i class="fas fa-clone" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="dtg-line-remove dtg-row-remove" data-remove-row="${escapeHtml(row.id)}" title="Remove line">×</button>
                        </div>
                    </div>
                    ${row.desc ? `<div class="dtg-line-desc" title="${escapeHtml(row.desc)}">${escapeHtml(row.desc)}</div>` : ''}
                    ${colorInvalid ? `<div class="dtg-row-color-warn" title="Pick a valid color from the dropdown">⚠ "${escapeHtml(row.color)}" not in ${escapeHtml(row.style)} catalog — pick from the dropdown above</div>` : ''}
                    <div class="dtg-line-sizes">
                        ${sizeCells}
                    </div>
                    <div class="dtg-line-foot">
                        <span class="dtg-line-qty"><strong>${total}</strong> pc${total === 1 ? '' : 's'}</span>
                        <span class="dtg-line-perpiece">${perPiece != null ? '$' + perPiece.toFixed(2) + '/pc' : '— /pc'}</span>
                        <span class="dtg-line-total">${lineTotal != null ? '$' + lineTotal.toFixed(2) : '$0.00'}</span>
                    </div>
                </div>
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

    // Recompute the due date based on current combined qty. Only fires when
    // the rep hasn't manually overridden the date. Updates both state AND
    // the visible input + hint. Called from renderSummary() so any qty
    // change (add row, edit cell, etc.) triggers it.
    function syncDueDateFromQty() {
        if (!state.scheduling.autoDueDate) return;
        const cq = combinedQty();
        const newDate = computeAutoDueDate(cq);
        if (newDate !== state.scheduling.dueDate) {
            state.scheduling.dueDate = newDate;
            const f = document.getElementById('dtgDueDate');
            if (f) f.value = newDate;
            scheduleStateSave();
        }
        const hint = document.getElementById('dtgDueDateHint');
        if (hint) hint.textContent = dueDateAutoLabel(cq);
    }

    function renderSummary() {
        const el = document.getElementById('dtgPriceSummary');
        if (!el) return;
        const cq = combinedQty();
        // Recompute due date based on current qty (auto-mode only).
        syncDueDateFromQty();
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

        // Tax estimate per Erik's 3 rules (2026-05-20). The taxRate on
        // state.shipping is the authoritative source — populated by
        // recomputeTaxRate() any time the rep toggles pickup OR types a
        // ship-to address. Pickup = 0.101, out-of-state = 0, in-WA = DOR
        // destination city rate.
        const isPickup = isPickupMethod(state.shipping.method);
        const shState = (state.shipping.state || '').toUpperCase();
        // [2026-06-09] Phase 2 — billed shipping is TAXABLE in WA (WAC 458-20-110), so the
        // fee enters the tax BASE here, NOT added after tax. effectiveShipFee() is 0 for
        // pickup. Same base formula at submit / PDF / save so the 4 sites can't desync.
        const shipFee = effectiveShipFee();
        const taxRate = Number(state.shipping.taxRate);
        const taxBase = Math.round((subtotal + shipFee) * 100) / 100;
        const taxEstimate = Math.round(taxBase * (Number.isFinite(taxRate) ? taxRate : 0) * 100) / 100;
        const grandTotal = Math.round((taxBase + taxEstimate) * 100) / 100;
        const taxPct = (taxRate * 100).toFixed(taxRate * 100 < 10 ? 1 : 2);
        // [2026-06-08] Phase 1 — label the new 0% sources (wholesale/exempt/opt-out/manual)
        // set by recomputeTaxRate. The DOLLAR amount is already correct (taxRate is 0 for
        // these); this only makes the row TEXT honest instead of "out of state — 0%".
        const src = state.shipping.taxRateSource;
        const taxLabel =
            src === 'wholesale'   ? 'Tax (wholesale / reseller — 0%)' :
            src === 'tax-exempt'  ? 'Tax (tax-exempt customer — 0%)' :
            src === 'tax-opt-out' ? 'Tax (not included)' :
            src === 'manual'      ? `Tax (manual rate ${taxPct}%)` :
            isPickup
            ? `Tax (pickup, Milton WA ${taxPct}%)`
            : (!shState || shState === 'WA')
                ? (src === 'dor-lookup' || src === 'dor-fallback'
                    ? `Tax (${escapeHtml(state.shipping.city || 'WA destination')} ${taxPct}%)`
                    : `Tax (WA destination — enter city + ZIP)`)
                : `Tax (out of state — 0%)`;

        el.innerHTML = `
            <div class="dps-label">Live DTG quote · ${effectiveLocationLabel()} · ${escapeHtml(shipLabel(state.shipping.method))}</div>
            <div class="dps-grid">
                <div><span class="dps-tier-pill${isLtm ? ' ltm' : ''}">${escapeHtml(tierDisplay)}</span></div>
                <div>${cq} combined pieces${isLtm ? ` · LTM +$${ltmPP.toFixed(2)}/pc` : ''}</div>
                <div class="dps-total">$${fmtMoney(grandTotal)}</div>
            </div>
            <div class="dps-totals-rows">
                <div class="dps-totals-row"><span>Subtotal</span><span class="dps-mono">$${fmtMoney(subtotal)}</span></div>
                ${shipFee > 0 ? `<div class="dps-totals-row dps-ship-row"><span>Shipping</span><span class="dps-mono">$${fmtMoney(shipFee)}</span></div>` : ''}
                <div class="dps-totals-row dps-tax-row"><span>${taxLabel}</span><span class="dps-mono">$${fmtMoney(taxEstimate)}</span></div>
                <div class="dps-totals-row dps-grand-row"><span>Order total</span><span class="dps-mono">$${fmtMoney(grandTotal)}</span></div>
            </div>
            ${isLtm ? `<div class="dps-note">Bump combined qty above this tier and the $${ltmFee} LTM fee disappears.</div>` : ''}
        `;
        updateSubmitEnabled();
        renderBand();  // [2026-06-08] Phase 0: keep the order-summary band current on every priced render
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
    // Compute the pre-flight readiness state for the current form. Returns an
    // array of items + the overall ready flag. Each item describes ONE piece
    // of the order with a state ('ok' / 'warn' / 'block' / 'tip'), a label,
    // a value (or remediation message), and optionally a `jumpId` — the DOM
    // id of the field the rep should click to fix the issue.
    function computeReadiness() {
        const items = [];
        const cq = combinedQty();

        // 1. Print location — has a sensible default (LC), so always ok
        const locCode = effectiveLocationCode();
        const locLabel = effectiveLocationLabel() || locCode;
        if (locCode) {
            items.push({ state: 'ok', label: 'Print location', value: locLabel + (state.back ? ` (${locCode})` : '') });
        } else {
            items.push({ state: 'block', label: 'Print location', value: 'Pick a front location', jumpId: 'dtgFrontOptions' });
        }

        // 2. Line items
        const validLines = state.rows.filter((r) =>
            r.style && r.color && !isRowColorInvalid(r) &&
            Object.values(r.sizes || {}).some((v) => Number(v) > 0)
        );
        const invalidColorRows = state.rows.map((r, i) => ({ r, i })).filter(({ r }) => isRowColorInvalid(r));

        if (state.rows.length === 0) {
            items.push({ state: 'block', label: 'Line items', value: 'No lines yet — pick a style from the catalog or click Add row', jumpId: 'dtgAddRowBtn' });
        } else if (validLines.length === 0) {
            items.push({ state: 'block', label: 'Line items', value: `${state.rows.length} row${state.rows.length === 1 ? '' : 's'} pending — finish style + color + sizes`, jumpId: 'dtgRowsCards' });
        } else {
            const tierLabel = _lastTier ? _lastTier.TierLabel : '?';
            const ltmFee = _lastTier ? Number(_lastTier.LTM_Fee) || 0 : 0;
            const tierNote = ltmFee > 0 ? ` (LTM +$${(Math.floor((ltmFee / cq) * 100) / 100).toFixed(2)}/pc)` : '';
            items.push({
                state: 'ok',
                label: 'Line items',
                value: `${validLines.length} line${validLines.length === 1 ? '' : 's'} · ${cq} combined pcs · tier ${tierLabel}${tierNote}`,
            });
        }

        // 3. Invalid colors — separate items per row so it's clear which fix
        for (const { r, i } of invalidColorRows) {
            items.push({ state: 'block', label: `Row ${i + 1} color`, value: `"${r.color}" not in ${r.style || 'catalog'} — pick from the dropdown`, jumpId: 'dtgRowsCards' });
        }

        // 4. Customer (company or name + email)
        const hasCustomerEmail = !!(state.customer.email && state.customer.email.includes('@'));
        const hasCompanyOrName = !!(state.customer.company || (state.customer.firstName && state.customer.lastName) || state.customer.companyId);
        const custDisplay = state.customer.company
            || `${state.customer.firstName || ''} ${state.customer.lastName || ''}`.trim()
            || state.customer.companyId;
        if (!hasCompanyOrName) {
            items.push({ state: 'block', label: 'Customer', value: 'Search for a company or fill name manually', jumpId: 'dtgCompanyInput' });
        } else if (!hasCustomerEmail) {
            items.push({ state: 'block', label: 'Customer', value: `${custDisplay} — missing email`, jumpId: 'dtgEmail' });
        } else {
            items.push({ state: 'ok', label: 'Customer', value: `${custDisplay} · ${state.customer.email}` });
        }

        // 5. Sales rep
        const repCode = state.customer.salesRepCode;
        if (!repCode) {
            items.push({ state: 'block', label: 'Sales rep', value: 'Pick a sales rep', jumpId: 'dtgSalesRep' });
        } else {
            const repName = (SALES_REPS.find((r) => r.code === repCode) || {}).name || repCode;
            items.push({ state: 'ok', label: 'Sales rep', value: repName });
        }

        // 6. Ship method + ship-to address
        const isPickupReady = isPickupMethod(state.shipping.method);
        if (!state.shipping.method) {
            items.push({ state: 'block', label: 'Ship method', value: 'Pick a ship method or toggle Customer Pickup', jumpId: 'dtgPickupToggle' });
        } else if (isPickupReady) {
            items.push({ state: 'ok', label: 'Ship method', value: 'Customer Pickup — Milton, WA (tax 10.1%)' });
        } else {
            const shipLabel = (SHIP_METHODS.find((m) => m.code === state.shipping.method) || {}).label || state.shipping.method;
            // For non-pickup, check the ship-to address completeness
            const haveCity = !!state.shipping.city;
            const haveStateField = !!state.shipping.state;
            const haveZip = (state.shipping.zip || '').length >= 5;
            if (!haveCity || !haveStateField || !haveZip) {
                items.push({
                    state: 'warn',
                    label: 'Ship to',
                    value: `${shipLabel} — fill city + state + ZIP for accurate tax`,
                    jumpId: 'dtgShipCity',
                });
            } else {
                const taxPct = ((Number(state.shipping.taxRate) || 0) * 100).toFixed(2);
                const taxBit = (state.shipping.state || '').toUpperCase() === 'WA'
                    ? ` · ${taxPct}% tax`
                    : ' · 0% tax (out of state)';
                items.push({
                    state: 'ok',
                    label: 'Ship to',
                    value: `${state.shipping.city}, ${state.shipping.state} ${state.shipping.zip}${taxBit}`,
                });
            }
        }

        // 7. Design — either existing Design # OR new artwork upload (mutually
        // exclusive). Erik 2026-05-20:
        //   (a) No design # AND no files → BLOCK (rep must pick one path)
        //   (b) Files uploaded but no design name → BLOCK
        //   (c) Both design # AND files → BLOCK (conflict — pick one)
        //   (d) Otherwise: ok / warn states like before
        const hasExistingDesign = !!(state.customer.designNumber && String(state.customer.designNumber).trim());
        const newArtworkFiles = state.newArtwork?.files || [];
        const newArtworkName = (state.newArtwork?.designName || '').trim();
        const hasUploadedArtwork = newArtworkFiles.length > 0;

        if (hasExistingDesign && hasUploadedArtwork) {
            // Conflict: rep has both — block until they pick one
            items.push({
                state: 'block',
                label: 'Design',
                value: `Conflict — existing design #${state.customer.designNumber} picked AND ${newArtworkFiles.length} file(s) uploaded. Pick one or the other.`,
                jumpId: 'dtgDesignNumber',
            });
        } else if (!hasExistingDesign && !hasUploadedArtwork) {
            // Neither — block
            items.push({
                state: 'block',
                label: 'Design',
                value: 'Pick an existing design # OR upload new artwork',
                jumpId: 'dtgDesignNumber',
            });
        } else if (hasUploadedArtwork && !newArtworkName) {
            // Files uploaded but no name — block
            items.push({
                state: 'block',
                label: 'Design',
                value: `${newArtworkFiles.length} file(s) uploaded — type a Design name to continue`,
                jumpId: 'dtgNewArtworkName',
            });
        } else if (hasUploadedArtwork) {
            // New artwork ready
            items.push({
                state: 'ok',
                label: 'Design',
                value: `New: "${newArtworkName}" — ${newArtworkFiles.length} file(s) will create a new ShopWorks design`,
            });
        } else {
            // Existing design # — show the matched design's name when available
            const cachedDesigns = _designComboboxCustomerId
                ? (_designsCacheByCustomer.get(String(_designComboboxCustomerId)) || [])
                : [];
            const matched = cachedDesigns.find((d) => d.idDesign === String(state.customer.designNumber).trim());
            if (matched) {
                items.push({ state: 'ok', label: 'Design #', value: `${matched.idDesign} — ${matched.designName || '(no name)'}` });
            } else if (_designComboboxCustomerId && cachedDesigns.length > 0) {
                items.push({ state: 'warn', label: 'Design #', value: `${state.customer.designNumber} — not on file for this customer (manual entry ok)`, jumpId: 'dtgDesignNumber' });
            } else {
                items.push({ state: 'ok', label: 'Design #', value: state.customer.designNumber });
            }
        }

        // 8. OOS-with-qty warnings (any size typed where SanMar shows 0 stock)
        let oosTypedCount = 0;
        for (const row of state.rows) {
            const inv = row.inventory;
            if (!inv || inv.status !== 'ok') continue;
            for (const [sz, qty] of Object.entries(row.sizes || {})) {
                if (Number(qty) > 0 && inv.bySize && Number(inv.bySize[sz]) === 0) oosTypedCount++;
            }
        }
        if (oosTypedCount > 0) {
            items.push({
                state: 'warn',
                label: 'Stock',
                value: `${oosTypedCount} size${oosTypedCount === 1 ? '' : 's'} typed at qty > 0 are showing OOS at SanMar — verify before promising`,
            });
        }

        // 9. Tier-break optimization (free money)
        if (_lastTier && _allTiers && cq > 0) {
            const nextTier = findNextTier(_allTiers, _lastTier, cq);
            if (nextTier) {
                const piecesNeeded = nextTier.MinQty - cq;
                if (piecesNeeded > 0 && piecesNeeded <= 5) {
                    const currentLtmFee = Number(_lastTier.LTM_Fee) || 0;
                    const hint = currentLtmFee > 0
                        ? `Add ${piecesNeeded} more piece${piecesNeeded === 1 ? '' : 's'} to reach tier ${nextTier.TierLabel} and skip the $${currentLtmFee} LTM fee`
                        : `Add ${piecesNeeded} more piece${piecesNeeded === 1 ? '' : 's'} to reach tier ${nextTier.TierLabel} — cheaper per-piece pricing`;
                    items.push({ state: 'tip', label: 'Tier tip', value: hint });
                }
            }
        }

        // Overall readiness — any blocker means submit is gated
        const blockers = items.filter((i) => i.state === 'block').length;
        const warnings = items.filter((i) => i.state === 'warn').length;
        const ready = blockers === 0;
        return { items, blockers, warnings, ready };
    }

    // Return the next tier above the current one in MinQuantity order, or
    // null if currentTier is already the top tier or tiers list is missing.
    function findNextTier(tiers, currentTier, currentQty) {
        if (!Array.isArray(tiers) || !currentTier) return null;
        const sorted = tiers.slice().sort((a, b) => Number(a.MinQuantity) - Number(b.MinQuantity));
        const idx = sorted.findIndex((t) => t.TierLabel === currentTier.TierLabel);
        if (idx < 0 || idx === sorted.length - 1) return null;
        const next = sorted[idx + 1];
        return {
            TierLabel: next.TierLabel,
            MinQty: Number(next.MinQuantity),
            MaxQty: Number(next.MaxQuantity),
            LTM_Fee: Number(next.LTM_Fee) || 0,
        };
    }

    // Render the pre-flight panel and gate the Submit button accordingly.
    // Called whenever state changes (sizes, customer fields, location, etc).
    // Replaced the old single-line validation banner on 2026-05-19 with this
    // richer always-visible checklist.
    function updateSubmitEnabled() {
        const btn = document.getElementById('dtgSubmitBtn');
        const panel = document.getElementById('dtgPreflightPanel');
        if (!btn) return;

        const { items, blockers, warnings, ready } = computeReadiness();
        btn.disabled = state.submitting || !ready;

        // [2026-06-08] Phase 1 Chunk C — enable Save once any row is fully priced
        // (looser than Submit, which also needs email/design). Lets a rep save a
        // draft quote + share link before the full push-readiness gate passes.
        const saveBtn = document.getElementById('dtgSaveBtn');
        if (saveBtn) {
            const anyPriced = state.rows.some(r =>
                r.style && r.color && Object.keys(r.sizes || {}).length > 0 && Number(r._lineTotal) > 0);
            saveBtn.disabled = !anyPriced;
        }

        if (panel) {
            const quoteID = getQuoteID();
            const qidLabel = quoteID ? `<span class="dpp-qid">${escapeHtml(quoteID)}</span>` : '';
            const headerClass = ready ? 'dpp-header dpp-header--ready' : 'dpp-header dpp-header--blocked';
            const headerIcon = ready ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-triangle"></i>';
            const headerText = ready
                ? (warnings > 0
                    ? `Ready to push — ${warnings} thing${warnings === 1 ? '' : 's'} worth a glance`
                    : 'Ready to push to ShopWorks')
                : `${blockers} thing${blockers === 1 ? '' : 's'} need${blockers === 1 ? 's' : ''} attention before push`;

            const itemHtml = items.map((it) => {
                const iconClass = it.state === 'ok'   ? 'fa-check-circle dpp-i--ok'
                                : it.state === 'warn' ? 'fa-exclamation-triangle dpp-i--warn'
                                : it.state === 'block'? 'fa-circle-xmark dpp-i--block'
                                : 'fa-lightbulb dpp-i--tip';
                const cursor = it.jumpId ? 'dpp-item--clickable' : '';
                const jumpAttr = it.jumpId ? `data-jump-id="${escapeHtml(it.jumpId)}"` : '';
                return `
                    <div class="dpp-item ${cursor}" ${jumpAttr}>
                        <i class="fas ${iconClass}" aria-hidden="true"></i>
                        <span class="dpp-label">${escapeHtml(it.label)}:</span>
                        <span class="dpp-value">${escapeHtml(it.value)}</span>
                    </div>
                `;
            }).join('');

            panel.innerHTML = `
                <div class="${headerClass}">
                    ${headerIcon}
                    <span class="dpp-header-text">${escapeHtml(headerText)}</span>
                    ${qidLabel}
                </div>
                <div class="dpp-items">${itemHtml}</div>
            `;
            panel.hidden = false;

            // Wire jump-to-field clicks (delegated would be cleaner, but the
            // panel re-renders on every state change, so per-render attach is fine)
            panel.querySelectorAll('.dpp-item--clickable').forEach((el) => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-jump-id');
                    const target = document.getElementById(id);
                    if (!target) return;
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Focus the underlying input/select if reachable
                    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                        setTimeout(() => target.focus(), 300);
                    } else {
                        // For container ids, find first input inside
                        const firstInput = target.querySelector('input, select, textarea, button');
                        if (firstInput) setTimeout(() => firstInput.focus(), 300);
                    }
                });
            });
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
        // 2026-05-19 — container switched from <table id="dtgRowsTable"> to
        // <div id="dtgRowsCards"> for the new card-per-line-item layout.
        // Same data attributes inside, so all the per-input wiring works
        // unchanged — only the container query changed.
        const table = document.getElementById('dtgRowsCards');
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
                // 2026-05-19 — update the card's qty footer IMMEDIATELY (no
                // debounce, no DOM destruction) so the rep sees the new total
                // the same frame they type. Per-piece price + line total
                // settle ~200ms later via schedulePriceUpdate's re-render.
                const card = input.closest('.dtg-line-card');
                const qtyEl = card?.querySelector('.dtg-line-qty strong');
                if (qtyEl) {
                    const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                    qtyEl.textContent = String(total);
                    const labelEl = qtyEl.nextSibling;
                    if (labelEl && labelEl.nodeType === Node.TEXT_NODE) {
                        labelEl.textContent = total === 1 ? ' pc' : ' pcs';
                    }
                }
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

        // Clone row — duplicate the line (style + color + sizes + availableSizes)
        // into a new row right below it. The common workflow: customer wants
        // the same garment in 2+ colors with the same size mix. Faster than
        // re-adding via catalog + re-typing sizes.
        table.querySelectorAll('[data-clone-row]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const rid = btn.getAttribute('data-clone-row');
                const idx = state.rows.findIndex((r) => r.id === rid);
                if (idx < 0) return;
                const src = state.rows[idx];
                const clone = newBlankRow();
                clone.style = src.style;
                clone.styleUpper = src.styleUpper;
                clone.desc = src.desc;
                clone.color = src.color;
                clone.catalogColor = src.catalogColor;
                clone.colorSwatch = src.colorSwatch;
                clone.colorsAvailable = src.colorsAvailable;
                clone.availableSizes = Array.isArray(src.availableSizes) ? [...src.availableSizes] : [];
                clone.sizes = Object.assign({}, src.sizes || {});
                clone._aiTouched = Date.now(); // pulse animation on the new card
                state.rows.splice(idx + 1, 0, clone); // insert right below source
                markDirty();
                scheduleStateSave();
                renderTable();
                schedulePriceUpdate();
                // Kick an inventory fetch if catalogColor is set — same as a
                // fresh row from the catalog would get.
                if (clone.catalogColor) kickInventoryFetch(clone);
                showToastSafe(`Cloned ${src.style || 'line'} — change the color to differentiate`);
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
                // Update active class in-place on hover (no DOM regeneration)
                // so real mouse clicks reliably hit their target. See note in
                // attachCompanyCombobox.
                item.addEventListener('mouseenter', () => {
                    const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    if (newIdx === activeIndex) return;
                    activeIndex = newIdx;
                    menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                        it.classList.toggle('active', i === activeIndex);
                    });
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
                // Update active class in-place on hover (no DOM regeneration).
                // See note in attachCompanyCombobox.
                item.addEventListener('mouseenter', () => {
                    const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    if (newIdx === activeIndex) return;
                    activeIndex = newIdx;
                    menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                        it.classList.toggle('active', i === activeIndex);
                    });
                });
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

        // [2026-06-08] Phase 1 Chunk C: Save & Get Link — saves the MANUAL quote
        // (with tax/wholesale) to quote_sessions. Delegates to dtg-quote-page's
        // handleSaveQuote (exposed as window.dtgSaveQuote), which now reads this
        // form's quote via getSaveQuote() instead of the AI chat's stale quote.
        // Gated on a fully-priced row so an empty form can't save a blank quote.
        const saveBtn = document.getElementById('dtgSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            if (typeof window.dtgSaveQuote === 'function') {
                window.dtgSaveQuote();
            } else {
                alert('Save is unavailable — please refresh and try again.');
            }
        });

        // Phase 11.4 (2026-05-24): Print Quote — opens a PDF-quality invoice
        // in a new window for the rep to print/save. Works from current form
        // state, no saved quote required.
        const printBtn = document.getElementById('dtgPrintBtn');
        if (printBtn) printBtn.addEventListener('click', () => dtgPrintQuote());

        // Phase 11.5 (2026-05-24): Email Quote — sends the customer a link to
        // the saved quote via EmailJS. Requires the quote to have been saved
        // first (sets aiState.savedQuoteID from the chat panel's "Save & share
        // link" button).
        const emailBtn = document.getElementById('dtgEmailBtn');
        if (emailBtn) emailBtn.addEventListener('click', () => dtgEmailQuote());

        // Customer combobox
        const wrap = document.getElementById('dtgCompanyCombo');
        const input = document.getElementById('dtgCompanyInput');
        if (wrap && input) attachCompanyCombobox(wrap, input);

        // Customer history pill — expand/collapse + "Use this" button handlers.
        // Pill is populated asynchronously after customer is picked (see pick()).
        wireHistoryPillHandlers();

        // New-artwork upload zone (Erik 2026-05-20) — drag-drop + click-to-browse
        // for uploading customer artwork that doesn't have an existing
        // ShopWorks design # yet.
        attachNewArtworkUpload();

        // Contact picker — switches between this company's contacts.
        // When the rep selects a different contact, re-apply that contact's
        // first/last/email/phone to the form. State.customer.contacts must
        // already be populated by attachCompanyCombobox.pick() or previewCustomer().
        const contactPicker = document.getElementById('dtgContactPicker');
        if (contactPicker) contactPicker.addEventListener('change', () => {
            const id = contactPicker.value;
            if (!id) return;
            const ct = (state.customer.contacts || []).find((c) =>
                String(c.ID_Contact || '') === id);
            if (ct) {
                applyContact(ct);
                markDirty();
                scheduleStateSave();
            }
        });

        // Design # combobox (DTG designs for the current customer)
        const designWrap = document.getElementById('dtgDesignCombo');
        const designInput = document.getElementById('dtgDesignNumber');
        if (designWrap && designInput) {
            attachDesignCombobox(designWrap, designInput);
            // On initial mount, if a customer is already loaded (e.g. session
            // restored from a previous quote), kick off the design fetch.
            refreshDesignComboboxForNewCustomer();
        }

        // --- Schedule section: due date + drop dead date (Erik 2026-05-20) ---
        // Initialize due date on mount if it's still blank (qty=0 case picks
        // the 5-BD branch — when first row's qty pushes past 24, recompute
        // fires via syncDueDateFromQty()).
        if (!state.scheduling.dueDate && state.scheduling.autoDueDate) {
            state.scheduling.dueDate = computeAutoDueDate(combinedQty());
            const f = document.getElementById('dtgDueDate');
            if (f) f.value = state.scheduling.dueDate;
        }
        const dueDateEl = document.getElementById('dtgDueDate');
        if (dueDateEl) {
            dueDateEl.addEventListener('input', () => {
                state.scheduling.dueDate = dueDateEl.value;
                state.scheduling.autoDueDate = false; // rep took control
                const hint = document.getElementById('dtgDueDateHint');
                if (hint) hint.textContent = 'Manual override';
                markDirty();
                scheduleStateSave();
            });
        }
        const dropDeadEl = document.getElementById('dtgDropDeadDate');
        if (dropDeadEl) {
            dropDeadEl.addEventListener('input', () => {
                state.scheduling.dropDeadDate = dropDeadEl.value;
                markDirty();
                scheduleStateSave();
            });
        }

        // Design thumbnail click → open lightbox (Erik 2026-05-20).
        // Intercepts the anchor's default href navigation; shows the image
        // full-size in a modal so the rep can verify the artwork before submit.
        const thumbAnchor = document.getElementById('dtgDesignThumbAnchor');
        if (thumbAnchor) {
            thumbAnchor.addEventListener('click', (e) => {
                e.preventDefault();
                const img = document.getElementById('dtgDesignThumbImg');
                if (!img || !img.src) return;
                openDesignLightbox(img.src, img.alt || '');
            });
        }

        // Lightbox close handlers — backdrop click, X button, Escape key
        const lightbox = document.getElementById('dtgThumbLightbox');
        if (lightbox) {
            lightbox.addEventListener('click', (e) => {
                if (e.target.dataset?.action === 'close') closeDesignLightbox();
            });
        }
        // Escape key — global listener (rebound on each render is harmless,
        // browsers dedupe identical listeners)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const lb = document.getElementById('dtgThumbLightbox');
                if (lb && !lb.hidden) closeDesignLightbox();
            }
        });

        // Manual customer fields
        bindInputToState('dtgFirstName', 'firstName');
        bindInputToState('dtgLastName', 'lastName');
        bindInputToState('dtgEmail', 'email');
        bindInputToState('dtgPhone', 'phone');
        bindInputToState('dtgPoNumber', 'po');
        // When the rep types a Company ID manually (rather than picking from
        // the search combobox), also refresh the design picker against that ID.
        bindInputToState('dtgCompanyId', 'companyId');
        const cidInput = document.getElementById('dtgCompanyId');
        if (cidInput) {
            let cidTimer = null;
            cidInput.addEventListener('input', () => {
                clearTimeout(cidTimer);
                cidTimer = setTimeout(() => refreshDesignComboboxForNewCustomer(), 300);
            });
        }
        // dtgDesignNumber is bound to state separately so the combobox's own
        // input handler doesn't conflict. Skip bindInputToState here.
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
            // Keep the pickup toggle in sync with the dropdown (a rep picking
            // "Customer Pickup" from the legacy dropdown should also flip the
            // toggle so the ship-to block hides + tax recomputes).
            syncPickupToggleFromShipMethod();
            recomputeTaxRate();
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
            renderSummary();
        });

        // Customer Pickup toggle (2026-05-20). When ON we override ship.method
        // to 'pickup' (canonical, accepted by the OF push endpoint at server.js
        // line ~1838 + ~2627) and hide the ship-to block. When OFF we restore
        // the previous non-pickup method (default 'ups') and show the block.
        const pickupTgl = document.getElementById('dtgPickupToggle');
        if (pickupTgl) pickupTgl.addEventListener('change', () => {
            if (pickupTgl.checked) {
                // Remember the prior non-pickup method so toggling OFF can restore it.
                if (!isPickupMethod(state.shipping.method)) {
                    state.shipping._prePickupMethod = state.shipping.method;
                }
                state.shipping.method = 'Customer Pickup';
            } else {
                state.shipping.method = state.shipping._prePickupMethod || 'UPS Ground';
                delete state.shipping._prePickupMethod;
            }
            // Sync the dropdown + show/hide ship-to block.
            const sel = document.getElementById('dtgShipMethod');
            if (sel) sel.value = state.shipping.method;
            const block = document.getElementById('dtgShipToBlock');
            if (block) block.hidden = isPickupMethod(state.shipping.method);
            recomputeTaxRate();
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
            renderSummary();
        });

        // Ship-to address fields. Each bound to state.shipping with a debounced
        // tax-rate lookup so the rep sees "Seattle — 10.25%" appear as soon as
        // they finish typing city + state + ZIP.
        const SHIP_FIELDS = [
            ['dtgShipAddress1', 'address1'],
            ['dtgShipAddress2', 'address2'],
            ['dtgShipCity',     'city'],
            ['dtgShipState',    'state'],
            ['dtgShipZip',      'zip'],
        ];
        let taxLookupTimer = null;
        SHIP_FIELDS.forEach(([elId, key]) => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.addEventListener('input', () => {
                state.shipping[key] = el.value.trim();
                if (key === 'state') {
                    // Normalize to uppercase 2-letter code on the fly.
                    state.shipping.state = state.shipping.state.toUpperCase().slice(0, 2);
                    el.value = state.shipping.state;
                }
                markDirty();
                scheduleStateSave();
                // Debounced tax lookup — fires 600ms after the rep stops
                // typing. Only when city + state + ZIP are all present.
                clearTimeout(taxLookupTimer);
                taxLookupTimer = setTimeout(recomputeTaxRate, 600);
            });
        });

        // [2026-06-08] Phase 1 tax-control handlers. All route through recomputeTaxRate() (the SINGLE tax authority)
        // so the on-screen total, the PDF, the saved record, and the ShopWorks push never desync.
        const incTaxEl = document.getElementById('include-tax');
        if (incTaxEl) incTaxEl.addEventListener('change', () => {
            state.shipping.includeTax = incTaxEl.checked;
            markDirty(); scheduleStateSave(); recomputeTaxRate();
        });
        const rateEl = document.getElementById('tax-rate-input');
        if (rateEl) rateEl.addEventListener('input', () => {
            const v = rateEl.value.trim();
            state.shipping.taxRateOverride = (v === '' ? null : Number(v));
            markDirty(); scheduleStateSave(); recomputeTaxRate();
        });
        const wholeEl = document.getElementById('wholesale-checkbox');
        if (wholeEl) wholeEl.addEventListener('change', () => {
            state.customer.isWholesale = wholeEl.checked;
            // UI parity with the trio: wholesale ON → uncheck include-tax; OFF → re-check it. recomputeTaxRate
            // re-derives the rate (wholesale branch zeros it; exempt/out-of-state still win when applicable).
            const it = document.getElementById('include-tax');
            state.shipping.includeTax = !wholeEl.checked;
            if (it) it.checked = !wholeEl.checked;
            markDirty(); scheduleStateSave(); recomputeTaxRate();
        });
        // [2026-06-09] Phase 2 — manual shipping-charge edits. The fee is in the tax base
        // (taxable in WA), so re-render the summary (which recomputes tax on subtotal+fee).
        // NOT recomputeTaxRate() — the fee doesn't change the RATE, and calling it would
        // re-hit the DOR lookup on every keystroke. renderSummary() → renderBand() also
        // refreshes the ship-to card's "· $X" line.
        const shipFeeEl = document.getElementById('dtgShipFee');
        if (shipFeeEl) shipFeeEl.addEventListener('input', () => {
            syncShipFeeFromDom();
            markDirty(); scheduleStateSave();
            renderSummary();
        });
    }

    // Sync the pickup toggle UI to whatever state.shipping.method currently is.
    // Called from the ship-method dropdown handler so dropdown-picked
    // "Customer Pickup" also flips the toggle.
    function syncPickupToggleFromShipMethod() {
        const tgl = document.getElementById('dtgPickupToggle');
        const block = document.getElementById('dtgShipToBlock');
        const isPickup = isPickupMethod(state.shipping.method);
        if (tgl) tgl.checked = isPickup;
        if (block) block.hidden = isPickup;
    }

    // Re-derive state.shipping.taxRate per WA's destination-based sourcing law
    // (WAC 458-20-145 + 458-20-193). Three rules:
    //   - pickup            → 10.1% (Milton flat — WAC 458-20-145, seller's location)
    //   - out of WA state   → 0%    (WAC 458-20-193 — no nexus on out-of-state sales)
    //   - in WA state       → /api/tax-rates/lookup destination city rate
    //                          (backend hits webgis.dor.wa.gov AddressRates API)
    // Writes status text into #dtgTaxStatus + updates state.shipping.taxRate.
    // Caller is responsible for renderSummary() afterwards.
    //
    // Note: shipping CHARGES are taxable in WA (WAC 458-20-110). As of Phase 2 (2026-06-09)
    // DTG BILLS shipping (state.shipping.fee via effectiveShipFee()), so the tax base is now
    // (subtotal + shipping) × rate at all 4 sites (renderSummary / submit / PDF / save) and
    // the push sends cur_Shipping = fee. recomputeTaxRate only owns the RATE — the fee doesn't
    // change it, so the fee handler re-renders without calling this (avoids a redundant DOR hit).
    async function recomputeTaxRate() {
        const status = document.getElementById('dtgTaxStatus');
        const setStatus = (text, cls) => {
            if (!status) return;
            status.textContent = text;
            status.className = 'dcp-tax-status' + (cls ? ' dcp-tax-status--' + cls : '');
        };

        // [2026-06-08] Tax-exempt customer (CRM Is_Tax_Exempt) → force 0% + skip the pickup/DOR lookup (parity with
        // EMB/DTF/SCP). DTG previously showed an "exempt" chip but STILL taxed them on screen + PDF + the saved total.
        // [2026-06-08] Phase 1: wholesale/reseller → 0% + GL 2203 (highest priority; backend resolveTaxAccount routes it).
        if (state.customer && state.customer.isWholesale) {
            state.shipping.taxRate = 0;
            state.shipping.taxRateSource = 'wholesale';
            state.shipping.taxAccount = '2203';
            state.shipping.taxAccountName = 'Wholesale Sales (WA reseller permit)';
            setStatus('Wholesale / reseller — no tax (GL 2203)', 'success');
            renderSummary();
            return;
        }
        if (state.customer && state.customer.isTaxExempt) {
            state.shipping.taxRate = 0;
            state.shipping.taxRateSource = 'tax-exempt';
            state.shipping.taxAccount = '2204';
            state.shipping.taxAccountName = 'Tax Exempt';
            setStatus('Tax-exempt customer — no sales tax', 'success');
            renderSummary();
            return;
        }
        // [2026-06-08] Phase 1: rep opted the quote out of tax (include-tax unchecked) → 0%.
        if (!state.shipping.includeTax) {
            state.shipping.taxRate = 0;
            state.shipping.taxRateSource = 'tax-opt-out';
            state.shipping.taxAccount = '';
            state.shipping.taxAccountName = 'No tax (opted out)';
            setStatus('Tax not included (rep opted out)', 'info');
            renderSummary();
            return;
        }
        // [2026-06-08] Phase 1: rep typed a manual rate override → use it, skip the DOR lookup.
        if (state.shipping.taxRateOverride != null && Number.isFinite(Number(state.shipping.taxRateOverride))) {
            state.shipping.taxRate = Number(state.shipping.taxRateOverride) / 100;
            state.shipping.taxRateSource = 'manual';
            state.shipping.taxAccount = '';
            state.shipping.taxAccountName = 'Manual rate';
            setStatus('Manual rate ' + Number(state.shipping.taxRateOverride).toFixed(2) + '%', 'info');
            renderSummary();
            return;
        }
        const isPickup = isPickupMethod(state.shipping.method);
        if (isPickup) {
            state.shipping.taxRate = 0.101;
            state.shipping.taxRateSource = 'pickup-flat';
            // Milton pickup → Caspio account 2200.101 (Wash:10.1%). Hardcoded
            // since pickup destination doesn't change.
            state.shipping.taxAccount = '2200.101';
            state.shipping.taxAccountName = 'Wash:10.1%';
            setStatus('Pickup at Milton, WA — 10.1% flat', 'success');
            renderSummary();
            return;
        }
        const shState = (state.shipping.state || '').toUpperCase();
        if (shState && shState !== 'WA') {
            state.shipping.taxRate = 0;
            state.shipping.taxRateSource = 'out-of-state';
            // Out-of-state → Caspio account 2202 (Out of State Sales, 0%).
            state.shipping.taxAccount = '2202';
            state.shipping.taxAccountName = 'Out of State Sales';
            setStatus('Out of state — no tax', 'info');
            renderSummary();
            return;
        }
        if (!shState || !state.shipping.city || !state.shipping.zip || state.shipping.zip.length < 5) {
            // Not enough info yet; keep last known rate but show prompt.
            setStatus('Enter ship-to city + WA + ZIP to look up tax rate', 'info');
            return;
        }
        // In-WA shipping → DOR lookup.
        try {
            setStatus('Looking up destination tax rate…', 'loading');
            const r = await fetch(`${API_BASE}/api/tax-rates/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: state.shipping.address1 || '',
                    city: state.shipping.city,
                    state: shState,
                    zip: state.shipping.zip,
                }),
            });
            const j = await r.json();
            if (!r.ok || !j.success) {
                setStatus(j.error || `Lookup failed (HTTP ${r.status})`, 'error');
                return;
            }
            // API returns taxRate as a percentage (e.g. 10.25). Convert to float.
            const ratePct = Number(j.taxRate);
            if (!Number.isFinite(ratePct)) {
                setStatus('Lookup returned no rate', 'error');
                return;
            }
            state.shipping.taxRate = ratePct / 100;
            state.shipping.taxRateSource = j.fallback ? 'dor-fallback' : 'dor-lookup';
            // The lookup endpoint matched the DOR rate to a Caspio
            // sales_tax_accounts_2026 row — capture both for the
            // ShopWorks Notes block.
            state.shipping.taxAccount = j.account || '2200';
            state.shipping.taxAccountName = j.accountName || 'WA Sales Tax';
            const loc = state.shipping.city || j.locationCode || 'WA';
            setStatus(
                j.fallback
                    ? `Default rate ${ratePct.toFixed(2)}% (DOR unavailable)`
                    : `${loc} — ${ratePct.toFixed(2)}%`,
                j.fallback ? 'warning' : 'success'
            );
            renderSummary();
        } catch (err) {
            setStatus('Lookup failed — keeping last known rate', 'error');
        }
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

    // ----- DTG Design picker --------------------------------------------------
    //
    // Per-customer cache of designs fetched from /api/dtg-designs/by-customer.
    // Keyed by customerId so switching customers triggers a fresh fetch but
    // re-picking the same customer is instant. Cleared on resetForm().
    const _designsCacheByCustomer = new Map();
    let _designComboboxCustomerId = null;

    async function fetchDesignsForCustomer(customerId) {
        if (!customerId) return [];
        const key = String(customerId);
        if (_designsCacheByCustomer.has(key)) return _designsCacheByCustomer.get(key);
        try {
            const url = `${API_BASE}/api/dtg-designs/by-customer/${encodeURIComponent(key)}?limit=200`;
            const r = await fetch(url);
            if (!r.ok) {
                console.warn('[dtg-inline-form] DTG designs fetch failed:', r.status);
                _designsCacheByCustomer.set(key, []);
                return [];
            }
            const j = await r.json();
            const designs = Array.isArray(j.designs) ? j.designs : [];
            _designsCacheByCustomer.set(key, designs);
            return designs;
        } catch (err) {
            console.warn('[dtg-inline-form] DTG designs fetch error:', err.message);
            _designsCacheByCustomer.set(key, []);
            return [];
        }
    }

    // Open the design lightbox with a given image URL + caption.
    // The lightbox is mounted at form-render time (see render()) and lives
    // outside the .dtg-form-wrap so its position:fixed z-index isn't trapped
    // by any sticky parent. Body scroll lock prevents background scrolling.
    function openDesignLightbox(src, caption) {
        const lb = document.getElementById('dtgThumbLightbox');
        const img = document.getElementById('dtgThumbLightboxImg');
        const title = document.getElementById('dtgThumbLightboxTitle');
        if (!lb || !img) return;
        img.src = src;
        img.alt = caption || 'Design preview';
        if (title) title.textContent = caption || '';
        lb.hidden = false;
        document.body.style.overflow = 'hidden';
    }
    function closeDesignLightbox() {
        const lb = document.getElementById('dtgThumbLightbox');
        const img = document.getElementById('dtgThumbLightboxImg');
        if (!lb) return;
        lb.hidden = true;
        if (img) img.removeAttribute('src');
        document.body.style.overflow = '';
    }

    // Update the inline thumbnail anchor next to the Design # input. Called
    // whenever a design is picked, the design # is typed, or the customer
    // changes. Hidden when no matching design is loaded.
    function syncDesignThumbnail() {
        const anchor = document.getElementById('dtgDesignThumbAnchor');
        const img = document.getElementById('dtgDesignThumbImg');
        if (!anchor || !img) return;

        const designNum = String(state.customer.designNumber || '').trim();
        if (!designNum || !_designComboboxCustomerId) {
            anchor.hidden = true;
            img.removeAttribute('src');
            return;
        }
        const designs = _designsCacheByCustomer.get(String(_designComboboxCustomerId)) || [];
        const match = designs.find((d) => d.idDesign === designNum);
        if (match && match.thumbnailUrl) {
            img.src = match.thumbnailUrl;
            img.alt = match.designName || `Design ${designNum}`;
            anchor.href = match.thumbnailUrl;
            anchor.title = `${match.designName || 'Design ' + designNum} — click to enlarge`;
            anchor.hidden = false;
        } else {
            anchor.hidden = true;
            img.removeAttribute('src');
        }
    }

    // Combobox machinery for the Design # field. Opens a dropdown of the
    // current customer's DTG designs (DesignType=45) on focus; clicking a
    // row fills the input + shows the thumbnail inline. Mirrors the
    // attachCompanyCombobox pattern below.
    function attachDesignCombobox(wrap, input) {
        let menu = null;
        let designs = [];
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
                menu.className = 'dtg-combobox-menu dtg-design-menu';
                // Portal to body so the menu floats ABOVE the sticky form
                // column's scroll context (matches style/color combobox pattern).
                // Without this the menu gets clipped by the form's overflow:auto.
                document.body.appendChild(menu);
                positionPortaledMenu(menu, input);
                window.addEventListener('scroll', reposition, true);
                window.addEventListener('resize', reposition);
            }
        }
        function filterByQuery(q) {
            const qq = q.toLowerCase().trim();
            if (!qq) return designs;
            return designs.filter((d) =>
                String(d.idDesign).toLowerCase().includes(qq) ||
                String(d.designName || '').toLowerCase().includes(qq)
            );
        }
        function paint(q) {
            if (!menu) return;
            if (!_designComboboxCustomerId) {
                menu.innerHTML = `<div class="dtg-combobox-empty">Pick a customer first to load DTG designs</div>`;
                return;
            }
            const filtered = filterByQuery(q || '');
            if (filtered.length === 0) {
                if (designs.length === 0) {
                    menu.innerHTML = `<div class="dtg-combobox-empty">No DTG designs on file for this customer — type a # manually or mark TBD</div>`;
                } else {
                    menu.innerHTML = `<div class="dtg-combobox-empty">No designs match "${escapeHtml(q)}"</div>`;
                }
                return;
            }
            menu.innerHTML = filtered.slice(0, 30).map((d, i) => {
                const thumb = d.thumbnailUrl
                    ? `<img class="dtg-design-row-thumb" src="${escapeHtml(d.thumbnailUrl)}" alt="" loading="lazy">`
                    : `<div class="dtg-design-row-thumb dtg-design-row-thumb--blank"><i class="fas fa-image"></i></div>`;
                const meta = [];
                if (d.locationCount > 1) meta.push(`${d.locationCount} locations`);
                if (d.isVariation) meta.push('variation');
                if (!d.designComplete) meta.push('in progress');
                return `
                    <div class="dtg-combobox-item dtg-design-row${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                        ${thumb}
                        <div class="dtg-design-row-text">
                            <div class="ci-primary"><strong>${escapeHtml(d.idDesign)}</strong> — ${escapeHtml(d.designName || '(no name)')}</div>
                            <div class="ci-secondary">${meta.length ? meta.join(' · ') : (d.dateCreated || '')}</div>
                        </div>
                    </div>
                `;
            }).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item, idx) => {
                item.addEventListener('mouseenter', () => { activeIndex = idx; });
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const i = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    pick(filtered[i]);
                });
            });
            // Re-position after content change — menu height varies with row count.
            positionPortaledMenu(menu, input);
        }
        function pick(d) {
            if (!d) return;
            input.value = d.idDesign;
            state.customer.designNumber = d.idDesign;
            markDirty();
            scheduleStateSave();
            close();
            syncDesignThumbnail();
            // Hide/show the new-artwork upload block based on whether an
            // existing design # is now set (Erik 2026-05-20).
            if (typeof updateNewArtworkVisibility === 'function') updateNewArtworkVisibility();
            updateSubmitEnabled();
        }
        async function refresh() {
            if (!_designComboboxCustomerId) {
                designs = [];
                if (menu) paint('');
                return;
            }
            designs = await fetchDesignsForCustomer(_designComboboxCustomerId);
            // Update placeholder based on what we found
            if (designs.length === 0) {
                input.placeholder = 'No DTG designs on file — type a # manually or mark TBD';
            } else {
                input.placeholder = `Pick from ${designs.length} DTG design${designs.length === 1 ? '' : 's'} or type a # manually`;
            }
            if (menu) paint(input.value);
            syncDesignThumbnail();
        }

        // Wire events
        input.addEventListener('focus', async () => {
            open();
            paint(input.value);
            // If we haven't loaded yet for this customer, kick a load
            if (_designComboboxCustomerId && designs.length === 0 && !_designsCacheByCustomer.has(String(_designComboboxCustomerId))) {
                await refresh();
            }
        });
        input.addEventListener('input', () => {
            // The rep is typing — could be filtering or entering a custom #
            state.customer.designNumber = input.value;
            markDirty();
            scheduleStateSave();
            if (menu) paint(input.value);
            syncDesignThumbnail();
            // Hide/show upload block on design # change (Erik 2026-05-20).
            if (typeof updateNewArtworkVisibility === 'function') updateNewArtworkVisibility();
            updateSubmitEnabled();
        });
        input.addEventListener('blur', () => {
            // Defer close so mousedown on a menu item still fires pick()
            setTimeout(close, 150);
        });
        input.addEventListener('keydown', (e) => {
            const filtered = filterByQuery(input.value);
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, filtered.length - 1); paint(input.value); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(input.value); }
            else if (e.key === 'Enter') {
                if (filtered[activeIndex]) { e.preventDefault(); pick(filtered[activeIndex]); }
            } else if (e.key === 'Escape') { close(); }
        });

        // Expose a refresh hook so the company picker can trigger reload
        // when a new customer is chosen.
        wrap.__refreshDesigns = refresh;
    }

    // Called by attachCompanyCombobox.pick() whenever a customer is selected
    // (or by previewCustomer() when a chat tool fills the customer pane).
    // Re-points the design picker at the new customer and clears the input
    // if the previously-typed design # doesn't belong to the new customer.
    async function refreshDesignComboboxForNewCustomer() {
        const cid = state.customer.companyId || state.customer.id;
        const newId = (cid != null && String(cid).trim() !== '') ? String(cid).trim() : null;
        if (newId === _designComboboxCustomerId) return; // no change
        _designComboboxCustomerId = newId;
        const wrap = document.getElementById('dtgDesignCombo');
        if (wrap && typeof wrap.__refreshDesigns === 'function') {
            await wrap.__refreshDesigns();
        }
        syncDesignThumbnail();
    }

    function attachCompanyCombobox(wrap, input) {
        let menu = null;
        let timer = null;
        let matches = [];
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
                // Portal to body — was previously appended to `wrap`, which
                // got clipped by the sticky form column's overflow:auto and
                // landed in the wrong place on screen. Matches the style/color
                // combobox pattern. Fixes the 2026-05-19 bug where the
                // customer dropdown appeared below the form panel.
                document.body.appendChild(menu);
                positionPortaledMenu(menu, input);
                window.addEventListener('scroll', reposition, true);
                window.addEventListener('resize', reposition);
            }
        }
        function paint() {
            if (!menu) return;
            if (matches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">${input.value.length >= 2 ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
                positionPortaledMenu(menu, input);
                return;
            }
            // "Did you mean" hint — appears when the rep typed something
            // longer than what actually matched (e.g. typed "Archterra
            // Landscape Company" but only "Archterra Landscape" found hits).
            const fallbackHint = (matches._fallbackFrom && matches._fallbackTo)
                ? `<div class="dtg-combobox-hint">
                       Showing matches for <strong>"${escapeHtml(matches._fallbackTo)}"</strong>
                       — your search <em>"${escapeHtml(matches._fallbackFrom)}"</em> had no exact hits
                   </div>`
                : '';
            menu.innerHTML = fallbackHint + matches.slice(0, 10).map((c, i) => {
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
                // Hover: update active class IN PLACE, don't re-render the menu.
                // (Re-rendering on every mouseenter destroys the DOM under the
                // user's cursor and intermittently kills the click — Erik's
                // real-mouse-click selection bug, 2026-05-20.)
                item.addEventListener('mouseenter', () => {
                    const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    if (newIdx === activeIndex) return;
                    activeIndex = newIdx;
                    menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                        it.classList.toggle('active', i === activeIndex);
                    });
                });
                item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
            });
            // Re-position after content change — menu height can shrink/grow.
            positionPortaledMenu(menu, input);
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
            // Curated CRM context (Erik 2026-05-23) — fields the proxy now
            // returns on /api/company-contacts-2026/search response.
            state.customer.customerWarning = String(c.Customer_Warning || '').trim();
            state.customer.isTaxExempt = c.Is_Tax_Exempt === true || c.Is_Tax_Exempt === 1 || c.Is_Tax_Exempt === '1';
            state.customer.taxExemptNumber = String(c.Tax_Exempt_Number || '').trim();
            state.customer.paymentTerms = String(
                c.Preferred_Terms_FromOrders || c.Payment_Terms || c.CustTerms || ''
            ).trim();
            state.customer.accountTier = String(c.Account_Tier || '').trim();
            renderCustomerContextBadges();
            // Capture company-level address fields BEFORE applyContact runs —
            // the per-contact records from the search endpoint don't carry
            // address data, only the company bucket does. These drive both
            // billing state (info.state on push) AND the ship-to pre-fill.
            const newBillingState = (c.State || '').toString().toUpperCase().slice(0, 2);
            const billingStateChanged = newBillingState !== state.customer.state;
            state.customer.state = newBillingState;
            state.customer.city = (c.City || '').toString();
            // Pre-fill ship-to from company address ONLY if rep hasn't started
            // typing one in (don't clobber an in-progress drop-ship address).
            if (!state.shipping.address1) {
                state.shipping.address1 = (c.Address || '').toString();
                state.shipping.city = (c.City || '').toString();
                state.shipping.state = newBillingState;
                state.shipping.zip = (c.Zip || '').toString();
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('dtgShipAddress1', state.shipping.address1);
                setVal('dtgShipCity', state.shipping.city);
                setVal('dtgShipState', state.shipping.state);
                setVal('dtgShipZip', state.shipping.zip);
            }
            input.value = c.Company_Name || '';
            // Auto-pick first emailable contact (rep can switch via the picker)
            const firstContact = (c.contacts || []).find((ct) => ct.Email || ct.ContactNumbersEmail);
            if (firstContact) {
                applyContact(firstContact);
            }
            // [2026-06-08] Re-derive tax on EVERY customer pick (not just billing-state changes): catches
            // tax-exempt customers (→ 0%) the moment they're selected + exempt↔taxable transitions, plus the
            // original out-of-state-on-pick case. recomputeTaxRate is cheap pre-ship-to (it skips the DOR lookup).
            recomputeTaxRate();

            // Fire-and-forget customer history fetch (Phase 1 info-only pill).
            // Renders in the background ~400ms later — doesn't block any
            // contact-info auto-fill above. Failure → pill stays hidden.
            if (state.customer.companyId) {
                // Show "loading" state immediately so rep knows it's coming
                const pill = document.getElementById('dtgHistoryPill');
                const summary = document.getElementById('dtgHistoryPillSummary');
                if (pill && summary) {
                    pill.hidden = false;
                    summary.textContent = 'Looking up past orders…';
                }
                fetchCustomerHistory(state.customer.companyId)
                    .then(profile => renderCustomerHistoryPill(profile))
                    .catch(() => {
                        // Defensive — hide pill if anything goes wrong
                        if (pill) pill.hidden = true;
                    });
            }
            // Populate the contact dropdown so the rep can switch to a different
            // contact at this company (e.g. Aaberg's has Craig Edward / Accounting /
            // Alexx Bacon; auto-pick lands on Craig, but rep can switch to Alexx).
            populateContactPicker(c.contacts || []);
            // Reflect in companyId field if it's blank
            const cidInput = document.getElementById('dtgCompanyId');
            if (cidInput && !cidInput.value) cidInput.value = state.customer.companyId;
            markDirty();
            scheduleStateSave();
            close();
            // Re-point the Design # picker at the new customer.
            refreshDesignComboboxForNewCustomer();
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
        document.addEventListener('mousedown', (e) => {
            // Menu is portaled to <body>, so wrap.contains() doesn't include it.
            // Without the !menu.contains() guard, clicking a result row triggers
            // close() before the row's own mousedown handler fires pick() —
            // visible symptom: dropdown closes but nothing gets selected.
            // Matches the existing guard pattern in attachStyleCombobox + attachColorCombobox.
            if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
        });
    }

    // ====== NEW-ARTWORK UPLOAD (Erik 2026-05-20) ===========================
    // Rep can upload artwork files for orders that don't have an existing
    // ShopWorks Design # yet. Files are uploaded to Caspio's artwork folder
    // (POST /api/files/upload) → hosted URL flows through submit body into
    // ManageOrders → ShopWorks auto-creates new design with metadata + image.
    //
    // Adapted from the proven 3-Day Tees pattern (pages/js/3-day-tees.js:773).
    // ========================================================================

    const NEW_ARTWORK_MAX_BYTES = 20 * 1024 * 1024;           // 20 MB hard limit
    const NEW_ARTWORK_ACCEPT = /\.(ai|eps|pdf|png|jpe?g|tiff?|psd|svg|webp)$/i;
    const NEW_ARTWORK_PLACEMENTS = [
        { code: 'Left Chest',  label: 'Left Chest' },
        { code: 'Full Front',  label: 'Full Front' },
        { code: 'Full Back',   label: 'Full Back' },
        { code: 'Jumbo Front', label: 'Jumbo Front' },
        { code: 'Jumbo Back',  label: 'Jumbo Back' },
    ];

    function validateArtworkFile(file) {
        if (!file) return 'No file';
        if (file.size > NEW_ARTWORK_MAX_BYTES) {
            return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB · max 20 MB)`;
        }
        if (!NEW_ARTWORK_ACCEPT.test(file.name)) {
            return `File type not allowed (${file.name.split('.').pop()}). Use AI / EPS / PSD / PDF / PNG / JPG / TIFF / SVG / WebP.`;
        }
        return null;
    }

    // Upload a single file to Caspio via /api/files/upload — XHR-based for
    // progress events. Returns { externalKey, hostedUrl, fileName, ... } on
    // success, throws on failure.
    function uploadArtworkFileToCaspio(file, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (e) => {
                if (!e.lengthComputable || !onProgress) return;
                onProgress(Math.round((e.loaded / e.total) * 100));
            });
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        const hostedUrl = `${API_BASE}/api/files/${result.externalKey}`;
                        resolve({
                            externalKey: result.externalKey,
                            hostedUrl,
                            fileName: result.fileName || file.name,
                            originalName: result.originalName || file.name,
                            size: result.size || file.size,
                            mimeType: result.mimeType || file.type,
                        });
                    } catch (e) {
                        reject(new Error(`Upload OK but parse failed: ${e.message}`));
                    }
                } else {
                    reject(new Error(`Upload failed (HTTP ${xhr.status}): ${xhr.responseText.substring(0, 200)}`));
                }
            });
            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
            xhr.open('POST', `${API_BASE}/api/files/upload`);
            xhr.send(formData);
        });
    }

    // Pick an icon for the uploaded file based on extension. Real images
    // (PNG/JPG/WebP/SVG/GIF) get the proxy thumbnail; design files (AI/EPS/
    // PSD/PDF) get a Font Awesome icon since browsers can't preview them.
    function artworkFileThumbHtml(file) {
        const ext = (file.fileName || '').split('.').pop().toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
        if (isImage && file.hostedUrl) {
            return `<img class="dcp-newart-thumb-img" src="${escapeHtml(file.hostedUrl)}" alt="${escapeHtml(file.fileName)}">`;
        }
        // Design file — icon by type
        const iconMap = {
            ai: 'fa-bezier-curve', eps: 'fa-bezier-curve', pdf: 'fa-file-pdf',
            psd: 'fa-layer-group', tiff: 'fa-image', tif: 'fa-image',
        };
        const icon = iconMap[ext] || 'fa-file';
        return `<div class="dcp-newart-thumb-icon"><i class="fas ${icon}"></i><div class="dcp-newart-thumb-ext">${escapeHtml(ext.toUpperCase())}</div></div>`;
    }

    function renderNewArtworkList() {
        const list = document.getElementById('dtgNewArtworkList');
        if (!list) return;
        const files = state.newArtwork.files || [];
        if (files.length === 0) {
            list.innerHTML = '';
            return;
        }
        list.innerHTML = files.map((f, idx) => `
            <div class="dcp-newart-card" data-file-idx="${idx}">
                <div class="dcp-newart-thumb">${artworkFileThumbHtml(f)}</div>
                <div class="dcp-newart-card-body">
                    <div class="dcp-newart-card-name" title="${escapeHtml(f.fileName)}">${escapeHtml(f.fileName)}</div>
                    <div class="dcp-newart-card-meta">${(f.fileSize / 1024).toFixed(0)} KB · ${escapeHtml(f.fileType || 'unknown')}</div>
                    <div class="dcp-newart-card-placement">
                        <label>Placement:
                            <select class="dcp-newart-placement-select" data-file-idx="${idx}">
                                ${NEW_ARTWORK_PLACEMENTS.map(p => `<option value="${escapeHtml(p.code)}"${f.placement === p.code ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
                            </select>
                        </label>
                    </div>
                </div>
                <button type="button" class="dcp-newart-remove" data-file-idx="${idx}" aria-label="Remove ${escapeHtml(f.fileName)}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Wire per-card handlers (event delegation would also work)
        list.querySelectorAll('.dcp-newart-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.fileIdx);
                state.newArtwork.files.splice(idx, 1);
                renderNewArtworkList();
                updateNewArtworkVisibility();
                markDirty();
                scheduleStateSave();
                updateSubmitEnabled();
            });
        });
        list.querySelectorAll('.dcp-newart-placement-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const idx = Number(sel.dataset.fileIdx);
                if (state.newArtwork.files[idx]) {
                    state.newArtwork.files[idx].placement = sel.value;
                    markDirty();
                    scheduleStateSave();
                }
            });
        });
    }

    function setNewArtworkStatus(text, cls) {
        const el = document.getElementById('dtgNewArtworkStatus');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'dcp-newart-status' + (cls ? ' dcp-newart-status--' + cls : '');
    }

    async function handleArtworkFiles(fileList) {
        if (!fileList || fileList.length === 0) return;
        const filesToUpload = Array.from(fileList);
        for (const file of filesToUpload) {
            const err = validateArtworkFile(file);
            if (err) {
                setNewArtworkStatus(`✗ ${file.name}: ${err}`, 'error');
                continue;
            }
            setNewArtworkStatus(`Uploading ${file.name}…`, 'loading');
            try {
                const result = await uploadArtworkFileToCaspio(file, (pct) => {
                    setNewArtworkStatus(`Uploading ${file.name}… ${pct}%`, 'loading');
                });
                state.newArtwork.files.push({
                    fileName: result.fileName,
                    uniqueFileName: result.originalName,
                    hostedUrl: result.hostedUrl,
                    externalKey: result.externalKey,
                    fileSize: result.size,
                    fileType: result.mimeType,
                    // Default placement to the form's currently-selected front
                    // location label (Left Chest / Full Front / Jumbo Front)
                    placement: (LOCATION_LABELS[state.front] || 'Left Chest'),
                });
                setNewArtworkStatus(`✓ Uploaded ${file.name}`, 'success');
                markDirty();
                scheduleStateSave();
                updateSubmitEnabled();
            } catch (e) {
                setNewArtworkStatus(`✗ ${file.name}: ${e.message}`, 'error');
            }
        }
        renderNewArtworkList();
        updateNewArtworkVisibility();
        // Clear the "loading" status after a beat so success/error stays briefly
        setTimeout(() => {
            const el = document.getElementById('dtgNewArtworkStatus');
            if (el && el.classList.contains('dcp-newart-status--success')) {
                el.textContent = '';
                el.className = 'dcp-newart-status';
            }
        }, 2500);
    }

    // Show/hide the new-artwork block based on whether an existing Design # is
    // picked. When rep has an existing design, hide the upload UI to enforce
    // the "one or the other" rule (also enforced as a blocker in the readiness panel).
    function updateNewArtworkVisibility() {
        const block = document.getElementById('dtgNewArtworkBlock');
        if (!block) return;
        const hasExistingDesign = !!(state.customer.designNumber && String(state.customer.designNumber).trim());
        const hasUploads = (state.newArtwork.files || []).length > 0;
        // Visible by default. Becomes "hidden" only when existing design is set
        // AND no uploads exist (avoids stranding rep with uploaded files they
        // can't see). When BOTH exist, show the block + the readiness panel
        // will warn about the conflict.
        if (hasExistingDesign && !hasUploads) {
            block.classList.add('dcp-newart-collapsed');
        } else {
            block.classList.remove('dcp-newart-collapsed');
        }
    }

    function attachNewArtworkUpload() {
        const dropzone = document.getElementById('dtgNewArtworkDropzone');
        const input = document.getElementById('dtgNewArtworkInput');
        const nameInput = document.getElementById('dtgNewArtworkName');
        if (!dropzone || !input || !nameInput) return;

        // Design name input — bind to state
        nameInput.addEventListener('input', () => {
            state.newArtwork.designName = nameInput.value;
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        });

        // Click-to-browse
        dropzone.addEventListener('click', () => input.click());
        dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });

        // File input change
        input.addEventListener('change', (e) => {
            handleArtworkFiles(e.target.files);
            input.value = ''; // Reset so same file can be re-uploaded after removal
        });

        // Drag-drop
        ['dragover', 'dragenter'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dcp-newart-dropzone--over');
            });
        });
        ['dragleave', 'dragend'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dcp-newart-dropzone--over');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dcp-newart-dropzone--over');
            handleArtworkFiles(e.dataTransfer.files);
        });

        renderNewArtworkList();
        updateNewArtworkVisibility();
    }

    // ---- Customer History Pill (Phase 1: info-only) -----------------------
    // Fetches aggregated 90-day order profile from /api/customer-history/:id
    // and renders a compact pill near the customer panel. Phase 1 is READ-ONLY
    // — no auto-fills. Rep clicks "Use this" buttons to apply suggestions
    // explicitly (e.g. fill a missing ship-to address from past orders).
    // After 2 weeks of real usage we'll add surgical auto-fills for fields
    // where signal is high and reps want it.
    // ----------------------------------------------------------------------

    // Per-session cache so re-picking the same customer is instant.
    const _historyCacheByCustomer = new Map(); // idCustomer → profile

    async function fetchCustomerHistory(idCustomer) {
        if (!idCustomer) return null;
        const idNum = Number(idCustomer);
        if (!Number.isInteger(idNum) || idNum <= 0) return null;
        if (_historyCacheByCustomer.has(idNum)) return _historyCacheByCustomer.get(idNum);
        try {
            const r = await fetch(`${API_BASE}/api/customer-history/${idNum}`);
            if (!r.ok) return null;
            const data = await r.json();
            _historyCacheByCustomer.set(idNum, data);
            return data;
        } catch (e) {
            console.warn('[dtg-inline-form] customer-history fetch failed:', e.message);
            return null;
        }
    }

    function renderCustomerHistoryPill(profile) {
        const pill = document.getElementById('dtgHistoryPill');
        const summary = document.getElementById('dtgHistoryPillSummary');
        const body = document.getElementById('dtgHistoryPillBody');
        if (!pill || !summary || !body) return;

        if (!profile || !profile.hasHistory) {
            // Clear stale content from any prior customer's render so the next
            // time this pill is shown there's no flash of old data.
            pill.hidden = true;
            summary.textContent = '';
            body.innerHTML = '';
            return;
        }

        // --- Summary line ---
        const orderCount = profile.orderCount || 0;
        const daysAgo = profile.lastOrderDaysAgo;
        const daysAgoLabel = daysAgo === 0 ? 'today'
            : daysAgo === 1 ? 'yesterday'
            : daysAgo < 30 ? `${daysAgo} days ago`
            : daysAgo < 365 ? `${Math.round(daysAgo / 30)} months ago`
            : `${(daysAgo / 365).toFixed(1)} years ago`;
        summary.textContent = `${orderCount} order${orderCount === 1 ? '' : 's'} on file · last ${daysAgoLabel}`;
        pill.hidden = false;

        // --- Expanded body ---
        const rows = [];

        // Behavior summary
        const usually = [];
        if (profile.topShipMethod) usually.push(profile.topShipMethod);
        if (profile.topTerms) usually.push(profile.topTerms);
        if (usually.length) {
            rows.push(`
                <div class="dhp-row">
                    <span class="dhp-label">Usually:</span>
                    <span class="dhp-value">${escapeHtml(usually.join(' · '))}</span>
                </div>
            `);
        }

        // Last design
        if (profile.lastDesignId) {
            const designLabel = profile.lastDesignName
                ? `#${profile.lastDesignId} — ${profile.lastDesignName}`
                : `#${profile.lastDesignId}`;
            const isAlreadyPicked = String(state.customer.designNumber || '') === String(profile.lastDesignId);
            rows.push(`
                <div class="dhp-row">
                    <span class="dhp-label">Last design:</span>
                    <span class="dhp-value">${escapeHtml(designLabel)}</span>
                    ${isAlreadyPicked ? '<span class="dhp-applied">✓ selected</span>' : `<button type="button" class="dhp-apply" data-apply="design" data-design="${escapeHtml(profile.lastDesignId)}">Use this</button>`}
                </div>
            `);
        }

        // Top items (read-only — Phase 2 might add quick-add buttons)
        if (profile.topItems && profile.topItems.length) {
            const itemsList = profile.topItems.map(t => `${escapeHtml(t.partNumber)} ${escapeHtml(t.color)} (${t.count}×)`).join(' · ');
            rows.push(`
                <div class="dhp-row">
                    <span class="dhp-label">Top items:</span>
                    <span class="dhp-value">${itemsList}</span>
                </div>
            `);
        }

        // Phone backfill suggestion — only show when current state has a default/blank phone
        // AND history found a non-default phone in past orders
        const currentPhone = state.customer.phone || '';
        const phoneLooksDefault = !currentPhone || /^253-(922-5793|229-9214)$/.test(currentPhone);
        if (phoneLooksDefault && profile.contactBackfill?.phone) {
            rows.push(`
                <div class="dhp-row dhp-suggest">
                    <span class="dhp-label">💡 Phone:</span>
                    <span class="dhp-value">${escapeHtml(profile.contactBackfill.phone)}
                        <span class="dhp-meta">from order ${escapeHtml(profile.contactBackfill.phoneFromOrderDate || '')}</span>
                    </span>
                    <button type="button" class="dhp-apply" data-apply="phone" data-phone="${escapeHtml(profile.contactBackfill.phone)}">Use this</button>
                </div>
            `);
        } else if (phoneLooksDefault && !profile.contactBackfill?.phone) {
            rows.push(`
                <div class="dhp-row dhp-warn">
                    <span class="dhp-label">⚠ Phone:</span>
                    <span class="dhp-value">No real phone in ${orderCount} past order${orderCount === 1 ? '' : 's'} — Caspio shows "${escapeHtml(currentPhone || 'blank')}". Ask customer.</span>
                </div>
            `);
        }

        // Last ship-to suggestion — only show when not pickup AND ship-to currently blank
        const currentShipMethod = state.shipping?.method || '';
        const isPickupNow = isPickupMethod(currentShipMethod);
        const shipToBlank = !state.shipping?.address1 && !state.shipping?.city;
        if (profile.lastShipTo && shipToBlank && !isPickupNow) {
            const addr = `${profile.lastShipTo.address1}, ${profile.lastShipTo.city}, ${profile.lastShipTo.state} ${profile.lastShipTo.zip}`.trim();
            const dataAttrs = ['address1', 'city', 'state', 'zip']
                .map(k => `data-${k}="${escapeHtml(profile.lastShipTo[k] || '')}"`).join(' ');
            rows.push(`
                <div class="dhp-row dhp-suggest">
                    <span class="dhp-label">💡 Last ship-to:</span>
                    <span class="dhp-value">${escapeHtml(addr)}
                        <span class="dhp-meta">from order ${escapeHtml(profile.lastShipTo.fromOrderDate || '')}</span>
                    </span>
                    <button type="button" class="dhp-apply" data-apply="shipto" ${dataAttrs}>Use this</button>
                </div>
            `);
        }

        // Source indicator (for debugging — small + subtle)
        if (profile._source === 'cache') {
            rows.push(`<div class="dhp-row dhp-source"><span class="dhp-meta">(from cache · refreshes every 6 hours)</span></div>`);
        }

        body.innerHTML = rows.join('');
    }

    function wireHistoryPillHandlers() {
        const head = document.getElementById('dtgHistoryPillHead');
        const body = document.getElementById('dtgHistoryPillBody');
        const toggle = document.getElementById('dtgHistoryPillToggle');
        if (!head || !body || !toggle) return;

        // Toggle expand/collapse
        const toggleBody = () => {
            const isHidden = body.hidden;
            body.hidden = !isHidden;
            toggle.setAttribute('aria-expanded', String(isHidden));
            toggle.querySelector('i').className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        };
        head.addEventListener('click', (e) => {
            if (e.target.closest('button.dhp-apply')) return; // don't toggle when clicking apply buttons
            toggleBody();
        });

        // "Use this" buttons inside the expanded body — event delegation
        body.addEventListener('click', (e) => {
            const btn = e.target.closest('button.dhp-apply');
            if (!btn) return;
            const action = btn.dataset.apply;
            if (action === 'phone') {
                const newPhone = btn.dataset.phone;
                state.customer.phone = newPhone;
                const f = document.getElementById('dtgPhone');
                if (f) f.value = newPhone;
                btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
                markDirty();
                scheduleStateSave();
            } else if (action === 'design') {
                const newDesign = btn.dataset.design;
                state.customer.designNumber = newDesign;
                const f = document.getElementById('dtgDesignNumber');
                if (f) f.value = newDesign;
                if (typeof syncDesignThumbnail === 'function') syncDesignThumbnail();
                btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
                markDirty();
                scheduleStateSave();
                updateSubmitEnabled();
            } else if (action === 'shipto') {
                state.shipping.address1 = btn.dataset.address1 || '';
                state.shipping.city = btn.dataset.city || '';
                state.shipping.state = btn.dataset.state || '';
                state.shipping.zip = btn.dataset.zip || '';
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('dtgShipAddress1', state.shipping.address1);
                setVal('dtgShipCity', state.shipping.city);
                setVal('dtgShipState', state.shipping.state);
                setVal('dtgShipZip', state.shipping.zip);
                btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
                markDirty();
                scheduleStateSave();
                if (typeof recomputeTaxRate === 'function') recomputeTaxRate();
            }
        });
    }

    function applyContact(ct) {
        state.customer.firstName = ct.NameFirst || '';
        state.customer.lastName = ct.NameLast || '';
        state.customer.email = ct.Email || ct.ContactNumbersEmail || '';
        // Phone priority (Erik 2026-05-23): Phone_Best (curated "best phone
        // for this contact" in CompanyContactsMerge2026) → Phone → Company_Phone.
        // Phone_Best is the field reps should treat as authoritative when
        // present; the others are legacy/imported values.
        state.customer.phone = ct.Phone_Best || ct.Phone || ct.Company_Phone || '';
        state.customer.contactId = ct.ID_Contact != null ? String(ct.ID_Contact) : '';
        // NOTE: Company-level address (state, city, ship-to pre-fill) is
        // captured in pick() at company-pick time. The per-contact records
        // returned by /api/company-contacts-2026/search don't carry address
        // fields, so applyContact only handles per-contact data.
        const fn = document.getElementById('dtgFirstName'); if (fn) fn.value = state.customer.firstName;
        const ln = document.getElementById('dtgLastName'); if (ln) ln.value = state.customer.lastName;
        const em = document.getElementById('dtgEmail'); if (em) em.value = state.customer.email;
        const ph = document.getElementById('dtgPhone'); if (ph) ph.value = state.customer.phone;
        // Keep the contact picker in sync (highlights which contact is active)
        const picker = document.getElementById('dtgContactPicker');
        if (picker && state.customer.contactId) picker.value = state.customer.contactId;
        updateSubmitEnabled();
    }

    // Surface curated CRM context (Erik 2026-05-23): Customer Warning banner,
    // Tax Exempt chip, Account Tier badge, auto-select Payment Terms dropdown.
    // Called from pick() when a customer is selected; also from session
    // restore when state.customer is rehydrated from a saved draft.
    //
    // Phase 10 (2026-05-23): MIGRATED to shared customer-context-banners.js
    // helper for sync hygiene with EMB/DTF/SCP. Single code path; one fix
    // updates all 4 builders. Behavior preserved — DTG's dtg* DOM IDs still
    // used via the helper's config object.
    function renderCustomerContextBadges() {
        if (typeof window.surfaceCustomerContext !== 'function') {
            console.warn('[DTG] customer-context-banners.js not loaded — context badges may not render');
            return;
        }
        // Map DTG's camelCase state back to the raw CRM field shape the
        // shared helper expects (Customer_Warning, Is_Tax_Exempt, etc.)
        window.surfaceCustomerContext({
            Customer_Warning: state.customer.customerWarning,
            Is_Tax_Exempt: state.customer.isTaxExempt,
            Tax_Exempt_Number: state.customer.taxExemptNumber,
            Account_Tier: state.customer.accountTier,
            Payment_Terms: state.customer.paymentTerms,
        }, {
            warningContainerId: 'dtgCustomerWarning',
            taxChipContainerId: 'dtgTaxExemptChip',
            tierBadgeContainerId: 'dtgAccountTierBadge',
            termsSelectId: 'dtgTerms',
            termsNoteId: 'dtgTermsMapNote',
            // NWCA only OFFERS three terms today: Prepaid / Net 10 / Pay On Pickup
            // (Erik 2026-05-23). Legacy CRM terms like NET 30/60 get mapped to
            // Prepaid by the shared helper (most conservative — don't extend
            // credit accidentally) with a ⚠ note surfacing the conversion.
            offeredTerms: ['Prepaid', 'Net 10', 'Pay On Pickup'],
        });
        // The shared helper sets the dropdown value; mirror it to state.customer.terms
        // so downstream save logic picks up the same value.
        const termsSelect = document.getElementById('dtgTerms');
        if (termsSelect && termsSelect.value) {
            state.customer.terms = termsSelect.value;
        }
    }

    // Map a customer's CRM payment term (which may be a legacy / no-longer-offered
    // value like NET 30 / NET 60 / COD) to one of the three terms NWCA currently
    // OFFERS: Prepaid / Net 10 / Pay On Pickup. Returns null when no match.
    //
    // Rationale per Erik (2026-05-23): customer table preserves historical
    // payment-term agreements from past years. NWCA no longer extends NET 30+
    // credit to all customers — only Net 10 max. Unknown net-X terms default
    // to Prepaid (safest — most conservative). Rep can manually switch via
    // the dropdown if they want to honor a legacy agreement.
    function mapToOfferedTerms(crmTerm) {
        if (!crmTerm) return null;
        const t = String(crmTerm).trim().toLowerCase().replace(/\s+/g, ' ');
        // Exact matches to NWCA's offered set
        if (t === 'prepaid' || t === 'pre-paid' || t === 'pre paid' || t === 'pp') return 'Prepaid';
        if (t === 'pay on pickup' || t === 'pay-on-pickup' || t === 'on pickup' || t === 'pop') return 'Pay On Pickup';
        if (t === 'net 10' || t === 'net10' || t === 'n10' || t === 'net-10') return 'Net 10';
        // Legacy/unsupported terms NWCA no longer offers — default conservatively
        // to Prepaid (don't accidentally extend credit). Includes any other Net X.
        if (/^net[\s\-]*\d+$/.test(t)) return 'Prepaid';
        if (t === 'cod' || t === 'c.o.d.' || t === 'cash on delivery') return 'Prepaid';
        if (t === 'cash' || t === 'check') return 'Prepaid';
        // Credit card variants — all imply prepaid (we charge upfront / on file)
        if (t.includes('credit card')) return 'Prepaid';
        // Unknown — return null so caller can decide (we default to Prepaid)
        return null;
    }

    // Populate the contact dropdown with the picked company's contacts so the
    // rep can switch between them. Called from pick() in attachCompanyCombobox
    // (when a company is picked from search) and from previewCustomer() (when
    // the chat fills the customer). Hidden when no contacts on file.
    function populateContactPicker(contacts) {
        const row = document.getElementById('dtgContactRow');
        const picker = document.getElementById('dtgContactPicker');
        const counter = document.getElementById('dtgContactCount');
        if (!row || !picker) return;
        const list = Array.isArray(contacts) ? contacts : [];
        if (!list.length) {
            row.hidden = true;
            picker.innerHTML = '<option value="">— pick a contact —</option>';
            return;
        }
        row.hidden = false;
        if (counter) counter.textContent = `(${list.length} on file)`;
        // Sort: contacts with email first (emailable = useful), then alphabetically
        const sorted = list.slice().sort((a, b) => {
            const ea = !!(a.Email || a.ContactNumbersEmail);
            const eb = !!(b.Email || b.ContactNumbersEmail);
            if (ea !== eb) return ea ? -1 : 1; // emailable first
            return String(a.ct_NameFull || `${a.NameFirst || ''} ${a.NameLast || ''}`).localeCompare(
                String(b.ct_NameFull || `${b.NameFirst || ''} ${b.NameLast || ''}`));
        });
        picker.innerHTML = sorted.map((ct) => {
            const name = ct.ct_NameFull || `${ct.NameFirst || ''} ${ct.NameLast || ''}`.trim() || '(unnamed)';
            const email = ct.Email || ct.ContactNumbersEmail || '';
            const tag = email ? ` — ${email}` : ' (no email)';
            const id = ct.ID_Contact != null ? String(ct.ID_Contact) : '';
            const selected = id === state.customer.contactId ? ' selected' : '';
            return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(name)}${escapeHtml(tag)}</option>`;
        }).join('');
    }

    // ----- Live pricing (via window.DTGPricingService) -----------------------
    //
    // Tier info cache — populated by updateLivePrices() after a successful
    // run, read by the pre-flight panel for tier-break optimization hints.
    // Module-scoped so we don't have to re-fetch the bundle just to render
    // the readiness panel. Cleared on style change / row removal.
    let _lastTier = null;       // current tier object (TierLabel, MinQty, MaxQty, LTM_Fee)
    let _allTiers = null;       // full tiers list (used to find the next tier)
    let _lastPerPiece = null;   // weighted avg per-piece price at current tier (for savings math)
    let _priceTimer = null;
    function schedulePriceUpdate() {
        clearTimeout(_priceTimer);
        _priceTimer = setTimeout(() => updateLivePrices().catch((e) => console.error('[dtg-inline-form] price update failed:', e)), 200);
    }

    async function updateLivePrices() {
        const code = effectiveLocationCode();
        const cq = combinedQty();
        if (!code || cq === 0 || !window.DTGPricingService) {
            for (const r of state.rows) { r._perPiece = null; r._lineTotal = 0; r._priceError = null; r._priceBySize = {}; r._ltmPP = 0; r._baseUnit = null; r._tierLabel = null; }
            _lastTier = null; _allTiers = null; _lastPerPiece = null;
            renderPriceErrorBanner(null);
            renderTable();
            renderSummary();
            return;
        }
        const svc = new window.DTGPricingService();
        _lastPerPiece = null; // reset; first priced row sets it
        let _anyPriceError = false;
        const _erroredStyles = new Set();

        for (const row of state.rows) {
            // [2026-06-08] Phase 1 Chunk C fix — clear ALL derived price fields up front so a
            // row that fails to price (invalid color / API error / no tier) cannot leak STALE
            // _priceBySize/_ltmPP/_baseUnit/_tierLabel into the PDF (dtgPrintQuote re-derives the
            // invoice subtotal from _priceBySize) or the saved quote_items. The success path
            // below repopulates them for priced rows.
            row._priceBySize = {}; row._ltmPP = 0; row._baseUnit = null; row._tierLabel = null;
            if (!row.style || !row.color) { row._perPiece = null; row._lineTotal = 0; continue; }
            // Block pricing on rows where the rep typed a color the catalog
            // doesn't have (no catalogColor → no SanMar match → invalid).
            // Without this guard, the live total includes phantom dollars
            // for orders that would fail in ShopWorks.
            if (isRowColorInvalid(row)) { row._perPiece = null; row._lineTotal = 0; continue; }
            try {
                const bundle = await fetchBundle(row.style);
                if (bundle && bundle.__pricingError) {
                    // Pricing API failed for this style — surface it; do NOT let the row
                    // sit at $0 in the rep-facing total. (2026-06-01)
                    row._perPiece = null; row._lineTotal = 0; row._priceError = bundle.message;
                    _anyPriceError = true; _erroredStyles.add(row.style);
                    continue;
                }
                row._priceError = null;
                if (!bundle) { row._perPiece = null; row._lineTotal = 0; continue; }
                // Resolve the tier ROW from Caspio (incl. LTM_Fee). The
                // row's LTM_Fee column drives per-piece LTM dynamically —
                // no more hardcoded $50.
                const tier = svc.getTierForQuantity(bundle.tiers, cq);
                if (!tier) { row._perPiece = null; row._lineTotal = 0; continue; }
                // Cache for the pre-flight panel's tier-break hint.
                _lastTier = tier;
                _allTiers = bundle.tiers;
                const ltmFee = Number(tier.LTM_Fee) || 0;
                const ltmPP = ltmFee > 0 ? Math.floor((ltmFee / cq) * 100) / 100 : 0;

                const allPrices = svc.calculateAllLocationPrices(bundle, cq);
                if (!allPrices || !allPrices[code]) { row._perPiece = null; row._lineTotal = 0; continue; }
                const locPrices = allPrices[code];

                // Build a per-size price map for the card to render under
                // each cell. Reps see "$30.99" under S and "$33.99" under
                // 2XL at a glance — no mental math for upcharges.
                row._priceBySize = {};
                const sizesToPrice = Array.isArray(row.availableSizes) && row.availableSizes.length
                    ? row.availableSizes
                    : Object.keys(locPrices);
                for (const sz of sizesToPrice) {
                    const priceObj = locPrices[String(sz).toUpperCase()] || locPrices[sz];
                    const base = priceObj && priceObj[tier.TierLabel];
                    if (typeof base === 'number') {
                        row._priceBySize[String(sz).toUpperCase()] = Math.round((base + ltmPP) * 100) / 100;
                    }
                }

                // Sum line total + weighted-average per-piece across typed sizes.
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
                // [2026-06-08] Phase 1 Chunk C — stash the breakdown the SAVE path needs
                // (computePriceQuoteFromState → handleSaveQuote item map). _perPiece is the
                // LTM-amortized weighted unit; ltmPP is added uniformly to every size's final,
                // so the weighted base = _perPiece − ltmPP. _tierLabel drives PricingTier.
                row._ltmPP = ltmPP;
                row._baseUnit = row._perPiece != null ? Math.round((row._perPiece - ltmPP) * 100) / 100 : null;
                row._tierLabel = tier.TierLabel;
                if (row._perPiece && _lastPerPiece == null) _lastPerPiece = row._perPiece;
            } catch (err) {
                console.error('[dtg-inline-form] row price update failed:', row.style, err);
                row._perPiece = null;
                row._lineTotal = 0;
                row._ltmPP = 0;
                row._baseUnit = null;
                row._priceError = (err && err.message) || 'pricing error';
                _anyPriceError = true; _erroredStyles.add(row.style);
            }
        }
        // Surface any pricing failure so the rep never quotes an incomplete total
        // that silently dropped a $0 row. (2026-06-01)
        renderPriceErrorBanner(_anyPriceError ? Array.from(_erroredStyles) : null);
        renderTable();
        renderSummary();
    }

    // Persistent red banner shown when one or more rows failed to price due to a
    // pricing-API error. Pass null/empty to clear it. Erik's #1 rule: a failed
    // pricing call must be visible, never silently zeroed into the total.
    function renderPriceErrorBanner(styles) {
        let banner = document.getElementById('dtg-price-error-banner');
        if (!styles || styles.length === 0) { if (banner) banner.remove(); return; }
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'dtg-price-error-banner';
            banner.setAttribute('role', 'alert');
            banner.style.cssText = 'margin:10px 0;padding:10px 14px;background:#fef2f2;border:1px solid #ef4444;border-left:4px solid #b91c1c;border-radius:6px;color:#991b1b;font-size:13px;font-weight:600;line-height:1.4;';
            const mount = document.getElementById('dtgResumeBannerMount') || document.getElementById('dtgInlineFormMount');
            if (mount) mount.insertBefore(banner, mount.firstChild); else return;
        }
        banner.textContent = `⚠ Live pricing failed for ${styles.join(', ')} — the total below is INCOMPLETE. Refresh and try again before quoting this customer.`;
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

    // ========================================================================
    // Phase 11.4 (2026-05-24) — DTG Print Quote
    // Opens a PDF-quality invoice from the current form state in a new
    // window for the rep to print/save. Mirrors EMB/DTF/SCP printQuote()
    // pattern using the shared EmbroideryInvoiceGenerator class.
    // No saved quote required — works from current in-memory state.
    // ========================================================================
    async function dtgPrintQuote() {
        try {
            if (typeof EmbroideryInvoiceGenerator === 'undefined') {
                alert('Print is unavailable — invoice generator not loaded. Please refresh and try again.');
                return;
            }

            // Collect line items from current state
            const cleanLines = state.rows.filter(r => r.style && r.color && Object.keys(r.sizes || {}).length > 0);
            if (cleanLines.length === 0) {
                alert('Add at least one product with a size before printing.');
                return;
            }

            // Trigger a fresh price calculation so the invoice reads current numbers
            const priceQuote = computePriceQuoteFromState();
            if (!priceQuote || !Array.isArray(priceQuote.lineItems) || priceQuote.lineItems.length === 0) {
                alert('Could not compute pricing. Make sure all rows have a style + color + at least one filled size.');
                return;
            }

            // Build invoice data structure (matches what EmbroideryInvoiceGenerator expects).
            // DTG doesn't use per-logo locations; the print location is shared across rows.
            // Build products in the CANONICAL shape the shared generator's size
            // matrix requires: { product:{style,title,color}, lineItems:[{description,
            // quantity, unitPrice, total}] }. The old flat shape (no lineItems[]) threw
            // a TypeError at generateSizeMatrixTable (pp.lineItems.length) so Print
            // produced no PDF at all. Group each row's sizes by unit price so base
            // sizes share a line and upcharged extended sizes (2XL+) get their own. (2026-06-01)
            const invoiceProducts = priceQuote.lineItems.map(li => {
                const sizes = li.sizes || {};
                const pbs = li.priceBySize || {};
                const groups = {};
                for (const [szRaw, qRaw] of Object.entries(sizes)) {
                    const q = Number(qRaw) || 0; if (q <= 0) continue;
                    const sz = String(szRaw).toUpperCase();
                    const up = Number(pbs[sz]);
                    // A size with no per-size price (absent from _priceBySize) was EXCLUDED
                    // from the on-screen total (updateLivePrices skips it). Skip it here too
                    // so the printed PDF total matches the screen — don't price an
                    // unavailable size at the weighted-average fallback. (2026-06-01)
                    if (isNaN(up)) continue;
                    const price = up;
                    const key = price.toFixed(2);
                    (groups[key] = groups[key] || { price, parts: [], qty: 0 });
                    groups[key].parts.push(`${sz}(${q})`);
                    groups[key].qty += q;
                }
                let lineItems = Object.keys(groups)
                    .sort((a, b) => parseFloat(a) - parseFloat(b))
                    .map(k => {
                        const g = groups[k];
                        return { description: g.parts.join(' '), quantity: g.qty, unitPrice: g.price, total: Math.round(g.price * g.qty * 100) / 100 };
                    });
                if (lineItems.length === 0) {
                    const totalQty = Object.values(sizes).reduce((s, q) => s + (Number(q) || 0), 0);
                    lineItems = [{ description: Object.entries(sizes).map(([s, q]) => `${s}(${q})`).join(' '), quantity: totalQty, unitPrice: Number(li.finalUnitPrice) || 0, total: Number(li.lineTotal) || 0 }];
                }
                return {
                    product: { style: li.style || '', title: li.description || `${li.style} ${li.color}`.trim(), color: li.color || '' },
                    lineItems,
                };
            });
            // Recompute the subtotal from the rendered line items so the printed
            // lines reconcile exactly to the printed total.
            const invoiceSubtotal = Math.round(invoiceProducts.reduce((s, p) =>
                s + p.lineItems.reduce((ss, li) => ss + (Number(li.total) || 0), 0), 0) * 100) / 100;

            // [2026-06-09] Phase 2 — billed shipping. The shared generator taxes preTaxSubtotal
            // and renders the Shipping row + closing Subtotal as the breakdown of it; the FIRST
            // "Subtotal:" row uses grandTotal (products only). So: grandTotal = products,
            // preTaxSubtotal = products + fee (the TAXED base → shipping is taxed in WA),
            // shippingFee = fee (the display row). Pickup → effectiveShipFee() = 0 (no change).
            const shipFee = effectiveShipFee();
            const preTaxWithShip = Math.round((invoiceSubtotal + shipFee) * 100) / 100;
            // Contract derives isDTG from method, normalizes tax, and zero-fills
            // any fee fields not set here (artCharge, rushFee, discount, etc.).
            const pricingData = window.QuotePricingData.buildPricingData({
                method: 'DTG',
                quoteId: getQuoteID() || `DTG-PREVIEW-${Date.now()}`,
                // printLocation feeds generateDTGSpecs.
                printLocation: { front: effectiveLocationCode() },
                tier: priceQuote.tier || 'Standard',
                totalQuantity: priceQuote.combinedQuantity || 0,
                products: invoiceProducts,
                subtotal: invoiceSubtotal,
                // DTG amortizes LTM INTO the per-piece price (_priceBySize), so it is
                // already in every line total — don't add a separate LTM line/double-count.
                ltmFee: 0,
                ltmDistributed: true,
                grandTotal: invoiceSubtotal,
                preTaxSubtotal: preTaxWithShip,
                taxRate: Number(state.shipping?.taxRate) || 0,
                shippingFee: shipFee
            });

            const customerData = {
                name: [state.customer?.firstName, state.customer?.lastName].filter(Boolean).join(' ') || 'Customer',
                company: state.customer?.company || '',
                email: state.customer?.email || '',
                phone: state.customer?.phone || '',
                salesRepEmail: state.customer?.salesRepEmail || 'sales@nwcustomapparel.com',
            };

            const generator = new EmbroideryInvoiceGenerator();
            const invoiceHTML = generator.generateInvoiceHTML(pricingData, customerData);
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Pop-up blocker stopped the print window. Allow pop-ups for this page and try again.');
                return;
            }
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();

            // Wait for fonts/images to settle before triggering the print dialog.
            setTimeout(() => {
                try { printWindow.print(); } catch (_) { /* user can press Ctrl+P manually */ }
            }, 400);
        } catch (e) {
            console.error('[DTG Print] Error:', e);
            alert('Print failed: ' + (e.message || 'unknown error'));
        }
    }

    // Lightweight pricing snapshot the invoice generator can consume. Reads
    // from in-memory `state` + the existing live preview helper rather than
    // running the full async submit flow. Returns null when state is empty.
    function computePriceQuoteFromState() {
        // Build from the AUTHORITATIVE live-price fields updateLivePrices() writes:
        // row._perPiece (LTM-amortized unit), row._lineTotal, row._priceBySize.
        // The old code read window.aiState.lastPriceQuote (never assigned anywhere)
        // and r.previewUnit (never written) → every printed line priced at $0 while
        // the on-screen live table showed correct dollars. (2026-06-01)
        // DTG's print location is shared across all rows (not per-line).
        const locCode = effectiveLocationCode();
        const locLabel = effectiveLocationLabel();
        const lineItems = state.rows
            // [2026-06-08] Phase 1 Chunk C fix — exclude invalid-color rows (mirror combinedQty +
            // updateLivePrices) so the saved record + PDF match the on-screen subtotal, which
            // already drops them. Without this an invalidated row saves a $0 line + inflates qty.
            .filter(r => r.style && r.color && !isRowColorInvalid(r) && Object.keys(r.sizes || {}).length > 0)
            .map(r => {
                const totalQty = Object.values(r.sizes).reduce((s, q) => s + (Number(q) || 0), 0);
                const unitPrice = Number(r._perPiece) || 0;
                const lineTotal = Number(r._lineTotal) || (unitPrice * totalQty);
                // [2026-06-08] Phase 1 Chunk C — emit the FULL item shape handleSaveQuote's item
                // map reads (baseUnitPrice/ltmPerUnit/tier/location). Omitting these saved
                // BaseUnitPrice=0/LTMPerUnit=0/HasLTM=No → LTM silently stripped from the record
                // (the DTF under-pricing bug class). _ltmPP/_baseUnit/_tierLabel come from updateLivePrices.
                const ltmPerUnit = Number(r._ltmPP) || 0;
                const baseUnit = (r._baseUnit != null)
                    ? Number(r._baseUnit)
                    : Math.round((unitPrice - ltmPerUnit) * 100) / 100;
                return {
                    style: r.style,
                    color: r.color,
                    description: r.description || `${r.style} ${r.color}`,
                    sizes: r.sizes,
                    priceBySize: r._priceBySize || {},
                    totalQuantity: totalQty,
                    baseUnitPrice: baseUnit,
                    ltmPerUnit: ltmPerUnit,
                    finalUnitPrice: unitPrice,
                    lineTotal: lineTotal,
                    locationCode: locCode,
                    locationLabel: locLabel,
                    tier: r._tierLabel || (_lastTier && (_lastTier.TierLabel || _lastTier.tierLabel)) || 'Standard',
                };
            });
        const subtotal = Math.round(lineItems.reduce((s, li) => s + (li.lineTotal || 0), 0) * 100) / 100;
        const combinedQuantity = lineItems.reduce((s, li) => s + (li.totalQuantity || 0), 0);
        const totalLtmFee = Math.round(lineItems.reduce((s, li) => s + ((li.ltmPerUnit * li.totalQuantity) || 0), 0) * 100) / 100;
        // [2026-06-08] Phase 1 Chunk C — tax rides from the SINGLE authority
        // (recomputeTaxRate → state.shipping.taxRate, a DECIMAL). It is ALREADY 0 for
        // wholesale / exempt / out-of-state / opt-out, so no re-check is needed here.
        const taxRate = Number(state.shipping.taxRate) || 0;
        // [2026-06-09] Phase 2 — billed shipping (taxable in WA) enters the tax base here too,
        // so the SAVE (handleSaveQuote reads this) + the PDF foot to the same number the screen
        // shows. effectiveShipFee() is 0 for pickup. subtotal stays products-only (→ SubtotalAmount).
        const shippingFee = effectiveShipFee();
        const taxBase = Math.round((subtotal + shippingFee) * 100) / 100;
        const taxAmount = Math.round(taxBase * taxRate * 100) / 100;
        const grandTotal = Math.round((taxBase + taxAmount) * 100) / 100;
        return {
            lineItems,
            combinedQuantity,
            subtotal,
            shippingFee,
            grandTotal,
            totalLtmFee,
            tier: (_lastTier && (_lastTier.TierLabel || _lastTier.tierLabel)) || 'Standard',
            locationCode: locCode,
            locationLabel: locLabel,
            // Tax block consumed by the SAVE path (dtg-quote-page handleSaveQuote).
            // taxRate is a DECIMAL (0.101) — matches EMB; quote-view/invoice normalize >1?/100,
            // so decimal round-trips. DO NOT change to percent or /invoice's verbatim TaxAmount breaks.
            taxRate,
            taxAmount,
            taxAccount: state.shipping.taxAccount || '',
            taxAccountName: state.shipping.taxAccountName || '',
            isWholesale: !!(state.customer && state.customer.isWholesale),
            isTaxExempt: !!(state.customer && state.customer.isTaxExempt),
            taxExemptNumber: (state.customer && state.customer.taxExemptNumber) || '',
            totals: { subtotal, shippingFee, taxRate, taxAmount, grandTotal },
        };
    }

    // ========================================================================
    // Phase 11.5 (2026-05-24) — DTG Email Quote
    // Sends customer a link to the saved quote via the shared emailQuote()
    // helper (EmailJS service_jgrave3 / template_quote_email). Requires a
    // saved quote (aiState.savedQuoteID populated by chat panel's "Save &
    // share link" button). Surfaces a clear "save first" message if not.
    // ========================================================================
    async function dtgEmailQuote() {
        const savedId = (window.aiState && window.aiState.savedQuoteID) || null;
        if (!savedId) {
            alert(
                'Save the quote first before emailing.\n\n' +
                'Open the chat panel (✨ Ask button) and click "Save & share link" — that gives the quote an ID. ' +
                'Then come back here and click Email Quote.'
            );
            return;
        }

        const customerEmail = (state.customer?.email || '').trim();
        if (!customerEmail) {
            alert('Customer email is required. Fill in the email field in the customer panel and try again.');
            return;
        }

        if (typeof emailQuote !== 'function') {
            alert('Email helper not loaded. Please refresh and try again.');
            return;
        }

        const customerName =
            [state.customer?.firstName, state.customer?.lastName].filter(Boolean).join(' ').trim() ||
            state.customer?.company ||
            'Customer';

        await emailQuote({
            quoteId: savedId,
            customerEmail,
            customerName,
            salesRepEmail: state.customer?.salesRepEmail || 'sales@nwcustomapparel.com',
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
            // Exclude invalid-color rows so the push matches the on-screen total /
            // PDF / saved record (the four other consumers all skip these). Without
            // it, a row with an unmatched catalog color could reach the server
            // re-price + land in ShopWorks with a blank color. (2026-06-09)
            .filter((r) => r.style && r.color && !isRowColorInvalid(r) && Object.keys(r.sizes || {}).length > 0)
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
        //
        // SKIP the warning when rep has uploaded new artwork (Erik 2026-05-20)
        // — that path INTENTIONALLY pushes without an existing design # because
        // ShopWorks will create the new design from the upload metadata.
        const hasUploadedArt = (state.newArtwork?.files || []).length > 0;
        if (!state.customer.designNumber && !hasUploadedArt) {
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
        const isPickup = isPickupMethod(state.shipping.method);

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

        // Tax — derive ONLY from state.shipping.taxRate (recomputeTaxRate is the single
        // authority: it already zeroes the rate for out-of-state / exempt / wholesale /
        // opt-out, sets the manual rate, and uses the DOR rate in-WA / 0.101 pickup).
        // [2026-06-08] Phase 1 Chunk D fix — REMOVED the redundant out-of-state guard that
        // re-zeroed tax here: it desynced the push from screen/saved/PDF when a rep set a
        // MANUAL rate on an out-of-state ship-to (manual outranks out-of-state in the authority,
        // so screen/saved showed the manual rate but the push booked $0). Push now == screen.
        const taxRate = Number(state.shipping.taxRate);
        // [2026-06-09] Phase 2 — billed shipping (taxable in WA) enters the push tax base too,
        // so the ShopWorks order + Notes On Order foot to the same total the rep saw on screen.
        // effectiveShipFee() is 0 for pickup. server.js maps ship.fee → cur_Shipping and
        // breakdown.shipping → the Notes "Shipping (taxable)" line + taxable base.
        const shipFee = effectiveShipFee();
        const taxBase = Math.round((subtotal + shipFee) * 100) / 100;
        const taxEstimate = Math.round(taxBase * (Number.isFinite(taxRate) ? taxRate : 0) * 100) / 100;
        const grandTotal = Math.round((taxBase + taxEstimate) * 100) / 100;

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
                // Customer's purchase order # — passes through as the order's
                // CustomerPurchaseOrder field in ShopWorks. Falls back to the
                // OF-NNNN extOrderId on the backend when not provided.
                po: state.customer.po || '',
                // Order schedule. dateIn = today (order placed). dateDue =
                // production-ready date (auto from qty unless rep overrode).
                // dropDeadDate = customer's hard event deadline (optional).
                // Backend maps dateDue → requestedShipDate, dropDeadDate →
                // dropDeadDate. ISO strings YYYY-MM-DD; proxy reformats to
                // MM/DD/YYYY for OnSite.
                dateIn: isoDate(new Date()),
                dateDue: state.scheduling.dueDate || '',
                dropDeadDate: state.scheduling.dropDeadDate || '',
                // Billing state — flows from the picked contact's
                // company_contacts_2026.State so the OF push endpoint can
                // branch tax logic on it (out-of-state customers get 0 tax
                // even if a ship-to wasn't filled in).
                state: state.customer.state || '',
                city: state.customer.city || '',
                designNumber: state.customer.designNumber || null, // A3 — nullable
                // New-artwork design name (Erik 2026-05-20). Required when
                // files are uploaded; server.js uses it to set Designs[0].name
                // (which becomes ShopWorks's DesignName for the new design).
                // Empty/undefined when rep picked an existing Design # instead.
                newDesignName: (state.newArtwork.designName || '').trim(),
                salesRep: rep.name,
                salesRepEmail: rep.email,
                terms: state.customer.terms || 'Prepaid',
                paymentTerms: state.customer.terms || 'Prepaid',
                taxable: true,
                // [2026-06-08] Phase 1 Chunk D — flow the tax-status flags so server.js
                // buildOrderNote renders the right Notes On Order block. Wholesale →
                // GL 2203 (no tax); exempt → DO NOT APPLY. ship.taxAccount already carries
                // 2203/2204/2202, but buildOrderNote branches on these info.* flags.
                isWholesale: !!(state.customer && state.customer.isWholesale),
                isTaxExempt: !!(state.customer && state.customer.isTaxExempt),
                taxExemptNumber: (state.customer && state.customer.taxExemptNumber) || '',
                quoteId: getQuoteID() || '',
            },
            rows,
            ship: {
                method: state.shipping.method, // canonical: ups / pickup / willcall / other
                methodLabel: shipMethodLabel,
                sameAsBilling: !!isPickup, // pickup uses billing as the "ship-to"
                isPickup,
                // Ship-to address (only populated when method !== 'pickup').
                address: isPickup ? '' : (state.shipping.address1 || ''),
                address2: isPickup ? '' : (state.shipping.address2 || ''),
                city: isPickup ? '' : (state.shipping.city || ''),
                state: isPickup ? '' : (state.shipping.state || ''),
                zip: isPickup ? '' : (state.shipping.zip || ''),
                // Tax rate the rep saw at submit time (for audit trail in
                // notes — the actual TaxTotal is sent as 0; Erik applies the
                // tax line manually in ShopWorks per the Notes On Order
                // block).
                taxRate: Number.isFinite(taxRate) ? taxRate : 0,
                taxRateSource: state.shipping.taxRateSource || '',
                taxAccount: state.shipping.taxAccount || '',
                taxAccountName: state.shipping.taxAccountName || '',
                // [2026-06-09] Phase 2 — billed shipping charge → server.js cur_Shipping
                // (was hardcoded 0). 0 for pickup (effectiveShipFee zeroes it).
                fee: shipFee,
            },
            orderNotes: `DTG quote — ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pcs · tier ${pricing.tier}${isPickup ? ' · CUSTOMER PICKUP' : ''}`,
            // New-artwork files (Erik 2026-05-20). When rep uploaded artwork
            // for a brand-new design, each file becomes one entry here. The
            // server.js Designs[] builder reads files[].hostedUrl + .placements
            // and emits a Designs[] entry without id_Design → ShopWorks
            // creates a new design from the metadata. Empty array when rep
            // picked an existing Design # instead.
            files: (state.newArtwork.files || []).map(f => ({
                hostedUrl: f.hostedUrl,
                placements: [f.placement || (LOCATION_LABELS[state.front] || 'Left Chest')],
                colors: '',                // DTG = full-color CMYK, no ink-color tracking
                designNo: '',              // not a real design # — this IS the new design
                name: f.fileName,
            })),
            decoConfig: { method: 'dtg' },
            breakdown: {
                supported: true,
                byRow,
                totalQty: Number(pricing.combinedQuantity) || 0,
                tier: pricing.tier,
                subtotal: Math.round(subtotal * 100) / 100,
                // [2026-06-09] Phase 2 — billed shipping. server.js buildOrderNote reads this
                // for the "Shipping (taxable)" Notes line + the taxable base = subtotal+shipping.
                shipping: shipFee,
                ltmTotal: Math.round(ltmTotal * 100) / 100,
                taxEstimate,
                depositDue: 0,
                grandTotal,
                fees: [],
                errors: [],
            },
            methodNotesBlock: `DTG · ${effectiveLocationLabel()} · Tier ${pricing.tier} · ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pieces · Ship: ${shipMethodLabel}`,
            // Surface the print location(s) as a dedicated field so the
            // server's buildOrderNote() can include a "Print Locations:" line
            // at the top of Notes On Order — Erik scans this in ShopWorks
            // before opening the order details.
            printLocations: effectiveLocationLabel(),
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
                // this quote, next page load starts fresh. Pushed = persisted
                // in ShopWorks, so release the leave-guard too.
                clearSessionState();
                if (typeof markAsSaved === 'function') markAsSaved();
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
            sanitizeLocationState(); // never let an unpriceable combo in via chat fill

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
        // The chat-filled quote itself is NOT yet in Caspio though, so the
        // leave-guard arms (different flag, different job — see markDirty).
        clearDirty();
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
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
        // Clear the design picker cache so a fresh quote doesn't show the
        // previous customer's designs in the picker.
        _designsCacheByCustomer.clear();
        _designComboboxCustomerId = null;
        state.front = 'LC';
        state.back = '';
        state.rows = [newBlankRow()];
        state.customer = {
            company: '', companyId: '', contactId: '',
            firstName: '', lastName: '', email: '', phone: '',
            state: '', city: '', po: '',
            designNumber: '', terms: 'Prepaid', contacts: [],
            salesRepCode: preservedRepCode,
            // [2026-06-08] Phase 1 — MUST reset the tax flags or they bleed into the next
            // quote (a prior wholesale/exempt would keep zeroing tax on a fresh order).
            isWholesale: false, isTaxExempt: false, taxExemptNumber: '',
        };
        state.shipping = {
            method: 'Customer Pickup',  // matches the default in state init (top of file)
            address1: '', address2: '', city: '', state: '', zip: '',
            taxRate: 0.101, taxRateSource: 'pickup-flat',
            taxAccount: '2200.101', taxAccountName: 'Wash:10.1%',
            // [2026-06-08] Phase 1 — CRITICAL: re-seed includeTax/taxRateOverride. Omitting
            // includeTax left it `undefined` after reset → recomputeTaxRate's `!includeTax`
            // opt-out branch fired → every post-reset quote silently dropped to 0% tax while
            // the #include-tax checkbox still rendered checked (a money desync).
            includeTax: true, taxRateOverride: null,
            // [2026-06-09] Phase 2 — re-seed the billed shipping charge or a prior quote's fee
            // bleeds into the next "New Quote" (same reset-bleed class as the Phase 1 tax flags).
            fee: 0,
        };
        // Schedule resets: re-auto-calc due date from qty (will land on 5 BDs
        // since qty starts at 0 → ≤24 branch).
        state.scheduling = {
            dueDate: computeAutoDueDate(0),
            dropDeadDate: '',
            autoDueDate: true,
        };
        // New-artwork upload state: clear all uploaded files + design name.
        state.newArtwork = {
            designName: '',
            files: [],
        };
        state.dirtyAfterChatFill = false;
        state.lastSubmit = null;
        // A reset form has nothing left to lose — release the leave-guard.
        if (typeof markAsSaved === 'function') markAsSaved();
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
    // [2026-06-08] Phase 0: refresh the shared order-summary band (recap + ship-to card). Guarded — a no-op if the
    // module didn't load. Called at the end of renderSummary() so it tracks every priced state change (customer pick,
    // ship-field edits, pickup toggle, recompute, edit-reload all funnel through renderSummary).
    function renderBand() {
        if (typeof QuoteOrderSummary === 'undefined') return;
        try { QuoteOrderSummary.renderOrderRecap(); } catch (_) {}
        try { QuoteOrderSummary.renderShipToCard(); } catch (_) {}
    }

    function init() {
        // [2026-06-10] Shared leave-guard (quote-builder-utils.js) — warn before
        // navigating away with unsaved changes, same as EMB/SCP/DTF. Installed
        // FIRST because the ?edit= branch below early-returns. Safe this early:
        // hasChanges starts false and only user mutations (markDirty) set it.
        if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();
        // [2026-06-08] Phase 0: wire the shared order-summary band to DTG's own #dtgShip*/#dtgCompany* fields
        // (the module is selector-agnostic). No estimate/editOnclick yet → the module hides those buttons.
        if (typeof QuoteOrderSummary !== 'undefined') {
            QuoteOrderSummary.configure({
                orderRecap: '#order-recap',
                shipToCard: '#ship-to-card',
                // [2026-06-09] Phase 2 — ship.fee wires the shared estimator's fee write +
                // the ship-to card's "· $X" line to #dtgShipFee.
                ship: { address: '#dtgShipAddress1', city: '#dtgShipCity', state: '#dtgShipState', zip: '#dtgShipZip', method: '#dtgShipMethod', fee: '#dtgShipFee' },
                recap: { company: '#dtgCompanyInput', custNum: '#dtgCompanyId' },
                logos: function () { return []; },
                // [2026-06-09] Phase 2 — UPS-Ground estimator. collectProducts mirrors the
                // PRICED rows (same isRowColorInvalid filter combinedQty uses) so the weight
                // estimate matches what's billed. onApplied syncs the DOM fee → state then
                // re-renders the summary (fee is in the tax base); no recomputeTaxRate here —
                // the fee doesn't change the RATE, and skipping it avoids a redundant DOR hit.
                estimateHooks: {
                    collectProducts: function () {
                        return state.rows
                            .filter(function (r) { return r.style && !isRowColorInvalid(r); })
                            .map(function (r) { return { style: r.style, color: r.color, catalogColor: r.catalogColor, sizeBreakdown: r.sizes }; });
                    },
                    onApplied: function () { syncShipFeeFromDom(); renderSummary(); },
                    btn: '#dtgEstimateShipBtn',
                    result: '#dtgEstimateShipResult',
                },
            });
        }
        // Phase 11.6 (Erik 2026-05-24): edit-reopen for pre-push revisions.
        // If URL has ?edit=DTG-NNN, fetch the saved quote, populate the form,
        // and enable revision-on-save. Mirrors EMB/DTF/SCP loadQuoteForEditing.
        // Takes priority over the session-restore flow: if rep arrived via
        // an explicit edit URL, that wins over auto-restore.
        const editParam = (new URLSearchParams(window.location.search)).get('edit');
        // DTG QuoteIDs are date-packed with NO hyphen after the prefix
        // (e.g. DTG0311-1), so the old /^DTG-/ guard NEVER matched a real quote
        // and edit-load silently never fired. Match the prefix only. (2026-06-01)
        if (editParam && /^DTG/i.test(editParam)) {
            if (state.rows.length === 0) state.rows.push(newBlankRow());
            render();
            // Kick load in background; render shows immediately, fills in async.
            loadSavedDtgQuoteForEdit(editParam).catch(err => {
                console.error('[DTG Edit] Load failed:', err);
            });
            return;
        }

        // B4 — try to restore from sessionStorage first. If we restored, show
        // a small banner offering to start fresh.
        const restored = restoreStateFromSession();
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        if (restored) {
            showResumeBanner();
            // A restored draft is unsaved work that dies with the tab — arm the
            // leave-guard so closing without saving warns. (Edit-reopen is the
            // opposite: content came FROM Caspio, so that path stays clean.)
            if (typeof markAsUnsaved === 'function') markAsUnsaved();
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

    // ========================================================================
    // Phase 11.6 (2026-05-24) — DTG Edit-Reopen
    //
    // Fetches a saved DTG quote from Caspio, populates the form, and primes
    // the save path for "revision" mode (PUT existing session + replace items
    // instead of creating a fresh DTG-NNN). Mirrors EMB/DTF/SCP's
    // loadQuoteForEditing() pattern but adapted to DTG's chat-panel-driven
    // save flow (the actual revision-save lives in dtg-quote-page.js — this
    // function just hands it the editing context via window globals).
    //
    // SAFETY: assertQuoteEditable() runs first. If the quote is in ShopWorks
    // (Status=Processed/Pending Payment/etc.), it alerts the rep and
    // redirects to the read-only /quote/:id view — never populates the form.
    // This enforces Erik's one-way-sync rule at the load boundary.
    // ========================================================================
    async function loadSavedDtgQuoteForEdit(quoteId) {
        const apiBase = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        let res, data;
        try {
            // /api/quote-sessions/:id/full is a FRONTEND route (server.js), NOT on the
            // proxy — fetch it same-origin (relative). Using APP_CONFIG's proxy BASE_URL
            // here 404'd, which broke DTG edit-load entirely. (2026-06-01)
            res = await fetch(`/api/quote-sessions/${encodeURIComponent(quoteId)}/full`);
            data = await res.json();
        } catch (e) {
            alert(`Failed to load ${quoteId}: ${e.message}`);
            return;
        }
        if (!res.ok || !data || !data.sessionRaw) {
            alert(`${quoteId} not found.`);
            return;
        }

        const session = data.sessionRaw;
        const items = Array.isArray(data.quoteItems) ? data.quoteItems : [];

        // Lock guard — bail if quote is in ShopWorks.
        if (typeof assertQuoteEditable === 'function' && !assertQuoteEditable(session)) {
            return;
        }

        // Parse the Notes JSON to recover customer + designNumber + locationCode.
        let notes = {};
        try { notes = typeof session.Notes === 'string' ? JSON.parse(session.Notes || '{}') : (session.Notes || {}); }
        catch (_) { notes = {}; }

        // Populate customer state from session header + Notes.customer
        const c = notes.customer || {};
        state.customer.company    = session.CompanyName || c.company || '';
        state.customer.companyId  = c.companyId || c.customerNumber || '';
        state.customer.email      = session.CustomerEmail || c.email || '';
        state.customer.phone      = session.Phone || c.phone || '';
        const nameParts = String(session.CustomerName || c.name || '').split(/\s+/);
        state.customer.firstName  = c.firstName || nameParts[0] || '';
        state.customer.lastName   = c.lastName  || nameParts.slice(1).join(' ') || '';
        state.customer.designNumber = notes.designNumber || '';

        // [2026-06-08] Phase 1 Chunk E — restore shipping + tax + wholesale/exempt so a
        // reopened exempt/wholesale/out-of-state/manual quote does NOT silently revert to
        // 10.1% Milton pickup (the EMB/SCP/DTF edit-reload bug class). Source: Notes.shipping
        // (full block) + Notes.tax, with the session.TaxRate/IsWholesale columns as fallback
        // for older records. recomputeTaxRate() (called after render below) then RE-DERIVES
        // authoritatively from the restored state — these flags drive its early-return branches.
        const savedShip = notes.shipping || {};
        const savedTax = notes.tax || {};
        if (savedShip.method) state.shipping.method = savedShip.method;
        state.shipping.address1 = savedShip.address1 || '';
        state.shipping.address2 = savedShip.address2 || '';
        state.shipping.city     = savedShip.city || '';
        state.shipping.state    = savedShip.state || '';
        state.shipping.zip      = savedShip.zip || '';
        // [2026-06-09] Phase 2 — restore the billed shipping charge (Chunk E). Without this a
        // reopened ship quote loses its fee → the taxed total drops on Save Revision.
        state.shipping.fee      = Number(savedShip.fee) || 0;
        state.shipping.includeTax = (savedTax.includeTax != null) ? !!savedTax.includeTax
                                   : (savedShip.includeTax != null ? !!savedShip.includeTax : true);
        state.shipping.taxRateOverride = (savedTax.taxRateOverride != null) ? Number(savedTax.taxRateOverride)
                                       : (savedShip.taxRateOverride != null ? Number(savedShip.taxRateOverride) : null);
        state.customer.isWholesale = (savedTax.isWholesale != null)
            ? !!savedTax.isWholesale
            : (session.IsWholesale === 'Yes' || session.IsWholesale === true || session.IsWholesale === 1);
        if (savedTax.isTaxExempt != null) state.customer.isTaxExempt = !!savedTax.isTaxExempt;
        if (savedTax.taxExemptNumber != null) state.customer.taxExemptNumber = savedTax.taxExemptNumber;
        // Seed the rate from the saved column (DTG stores DECIMAL; normalize >1?/100 for
        // any legacy percent rows) so the first render shows the saved rate before the
        // async DOR re-lookup completes — not the 10.1% default.
        const _savedRate = parseFloat(session.TaxRate);
        if (Number.isFinite(_savedRate)) {
            state.shipping.taxRate = _savedRate > 1 ? _savedRate / 100 : _savedRate;
        } else if (savedTax.taxRate != null) {
            state.shipping.taxRate = Number(savedTax.taxRate);
        }
        if (savedShip.taxRateSource) state.shipping.taxRateSource = savedShip.taxRateSource;
        if (savedTax.taxAccount) state.shipping.taxAccount = savedTax.taxAccount;
        if (savedTax.taxAccountName) state.shipping.taxAccountName = savedTax.taxAccountName;
        // Sync the static ship-to + tax controls (rendered ONCE from default state in render(),
        // BEFORE this runs) to the restored state. CRITICAL: without re-syncing the ship method +
        // pickup toggle, a reopened SHIPPED quote shows pickup-toggle CHECKED + ship-to hidden;
        // one rep click on the wrongly-ON toggle would flip method→pickup and recompute 10.1%,
        // silently re-taxing an out-of-state (0%) or mis-taxing an in-WA-destination quote.
        try {
            const incEl = document.getElementById('include-tax');
            if (incEl) incEl.checked = state.shipping.includeTax !== false;
            const rateEl = document.getElementById('tax-rate-input');
            if (rateEl) rateEl.value = state.shipping.taxRateOverride != null ? state.shipping.taxRateOverride : '';
            const wholeEl = document.getElementById('wholesale-checkbox');
            if (wholeEl) wholeEl.checked = state.customer.isWholesale;
            // Ship method + address inputs + pickup toggle / ship-to block visibility.
            const methodEl = document.getElementById('dtgShipMethod');
            if (methodEl) methodEl.value = state.shipping.method || 'Customer Pickup';
            const setShip = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            setShip('dtgShipAddress1', state.shipping.address1);
            setShip('dtgShipCity', state.shipping.city);
            setShip('dtgShipState', state.shipping.state);
            setShip('dtgShipZip', state.shipping.zip);
            // [2026-06-09] Phase 2 — re-sync the billed shipping-charge input (blank when 0).
            const feeEl = document.getElementById('dtgShipFee');
            if (feeEl) feeEl.value = Number(state.shipping.fee) > 0 ? Number(state.shipping.fee).toFixed(2) : '';
            if (typeof syncPickupToggleFromShipMethod === 'function') syncPickupToggleFromShipMethod();
        } catch (_) { /* controls may be absent on older markup */ }

        // Print location — the saved items all share the same printLocation
        // (DTG: location is global, not per-line). PrintLocation is saved as a
        // STRUCTURED value {front, back, combined} (an object, or a JSON string),
        // NOT a flat "FRONT_BACK" code. The old String(...).split('_') parse
        // stuffed the whole JSON into state.front, so effectiveLocationCode()
        // returned a code absent from the price map and EVERY row priced to $0
        // on reopen (a saved $392 quote showed $0). Parse the structure; fall
        // back to the legacy flat-string handling for older data. (2026-06-01)
        const firstLoc = items.find(it => it && it.PrintLocation);
        if (firstLoc && firstLoc.PrintLocation) {
            let pl = firstLoc.PrintLocation;
            if (typeof pl === 'string' && pl.trim().startsWith('{')) {
                try { pl = JSON.parse(pl); } catch (_) { /* fall through to flat-string parse */ }
            }
            if (pl && typeof pl === 'object') {
                state.front = String(pl.front || 'LC').toUpperCase();
                state.back  = String(pl.back || '').toUpperCase();
            } else {
                const code = String(pl).toUpperCase();
                if (code.includes('_')) {
                    const [front, back] = code.split('_');
                    state.front = front;
                    state.back  = back || '';
                } else {
                    state.front = code;
                    state.back = '';
                }
            }
            sanitizeLocationState(); // legacy quote may carry FF_JB/JF_FB
        }

        // Rebuild rows from quote_items. Each item carries Style/Color/SizeBreakdown.
        const newRows = items
            .filter(it => it && it.EmbellishmentType === 'dtg' && it.StyleNumber)
            .map(it => {
                const row = newBlankRow();
                row.style      = String(it.StyleNumber || '').toUpperCase();
                row.styleUpper = row.style;
                row.color      = it.Color || '';
                row.desc       = it.ProductName || '';
                try {
                    row.sizes = it.SizeBreakdown ? JSON.parse(it.SizeBreakdown) : {};
                } catch (_) {
                    row.sizes = {};
                }
                return row;
            });

        state.rows = newRows.length > 0 ? newRows : [newBlankRow()];

        // Stash editing context on window so dtg-quote-page.js's save path
        // can branch into the PUT/revision flow.
        window._dtgEditingQuoteId = quoteId;
        window._dtgEditingPK_ID = session.PK_ID;
        window._dtgEditingRevision = Number(session.RevisionNumber) || 1;
        // Also make the quoteID visible to the existing getQuoteID() helper.
        setQuoteID(quoteId);
        // Mark aiState as already saved so the email button (Phase 11.5) works
        // out of the box without requiring a fresh "Save & share link" click.
        if (window.aiState) window.aiState.savedQuoteID = quoteId;

        // Render the populated form + kick inventory hydration so size cells
        // light up.
        renderLocationPills();
        renderTable();
        renderSummary();
        // [2026-06-08] Phase 1 Chunk E — re-derive tax from the just-restored shipping/
        // wholesale/exempt/manual state (single authority). Without this a reopened
        // non-pickup quote would keep the default 10.1% until the rep touched a field.
        recomputeTaxRate();
        for (const row of state.rows) {
            if (row.style && row.color) kickInventoryFetch(row);
            if (row.style) {
                fetchBundle(row.style).then(b => {
                    if (b && Array.isArray(b.sizes)) {
                        row.availableSizes = b.sizes.filter(s => Number(s.price) > 0).map(s => String(s.size).toUpperCase());
                        renderTable();
                        schedulePriceUpdate();
                    }
                }).catch(() => {});
            }
        }
        schedulePriceUpdate();

        // Show edit-mode banner — explains current rev + that next save is a revision.
        showEditModeBanner(quoteId, window._dtgEditingRevision);

        // Loaded content came FROM Caspio — a freshly reopened quote is NOT
        // dirty. Defensive clear in case any populate step above tripped the
        // leave-guard (the DTF edit-load lesson, 2026-06-10). The async
        // inventory/bundle hydration callbacks don't markDirty, so this can't
        // be un-done by a late fetch.
        if (typeof markAsSaved === 'function') markAsSaved();
    }

    function showEditModeBanner(quoteId, revision) {
        try {
            const mount = document.getElementById('dtgResumeBannerMount');
            if (!mount) return;
            mount.innerHTML = '';
            const banner = document.createElement('div');
            banner.className = 'dtg-edit-mode-banner';
            banner.style.cssText =
                'display:flex;align-items:center;gap:8px;padding:10px 14px;' +
                'background:#fef3c7;border:1px solid #fbbf24;border-left:4px solid #d97706;' +
                'border-radius:6px;color:#92400e;font-size:13px;line-height:1.4;margin-bottom:10px;';
            banner.innerHTML = `
                <i class="fas fa-pencil-alt"></i>
                <div>
                    <strong>Editing ${escapeHtml(String(quoteId))}</strong> · Rev ${escapeHtml(String(revision))}
                    <span style="opacity:0.85;"> — Saving will create Rev ${escapeHtml(String(revision + 1))} (same quote ID).</span>
                </div>
            `;
            mount.appendChild(banner);
        } catch (err) {
            console.warn('[dtg-inline-form] showEditModeBanner skipped:', err && err.message);
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

        // If the caller didn't pass availableSizes (catalog path), hydrate
        // them from the pricing bundle in the background so PC61's 4XL/5XL/6XL
        // columns actually appear instead of being silently truncated to 3XL.
        // The style-combobox path already does this — this matches it.
        if (!Array.isArray(availableSizes) || !availableSizes.length) {
            fetchBundle(row.style).then((bundle) => {
                if (!bundle || !Array.isArray(bundle.sizes)) return;
                const sizes = bundle.sizes
                    .filter((s) => Number(s.price) > 0)
                    .map((s) => String(s.size).toUpperCase());
                if (sizes.length) {
                    row.availableSizes = sizes;
                    renderTable();
                }
            }).catch((err) => {
                console.warn('[dtg-inline-form] previewStyle: bundle hydration failed', err);
            });
        }
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
        // Surface the customer's contacts in the picker dropdown.
        if (Array.isArray(state.customer.contacts) && state.customer.contacts.length) {
            populateContactPicker(state.customer.contacts);
        }
        // New customer ID → refresh the Design # picker so its dropdown
        // shows THIS customer's DTG designs.
        refreshDesignComboboxForNewCustomer();
        updateSubmitEnabled();
    }

    // Expose API
    window.DTGInlineForm = {
        fillFromQuote,
        getState,
        resetForm,
        submitToShopWorks,
        // [2026-06-08] Phase 1 Chunk C — the SAVE path (dtg-quote-page handleSaveQuote) reads
        // this so the saved quote_session reflects the MANUAL form (the on-screen total), not
        // the AI chat's stale currentPriceQuote. Returns the tax-bearing, item-complete quote
        // plus the customer + shipping/tax blocks the save + edit-reload (Chunk E) need.
        // null when the form has no priced rows (handleSaveQuote then falls back to the AI quote).
        getSaveQuote: () => {
            const pq = computePriceQuoteFromState();
            if (!pq || !pq.lineItems || !pq.lineItems.length) return null;
            pq.customer = {
                name: [state.customer.firstName, state.customer.lastName].filter(Boolean).join(' '),
                firstName: state.customer.firstName || '',
                lastName: state.customer.lastName || '',
                company: state.customer.company || '',
                companyId: state.customer.companyId || '',
                email: state.customer.email || '',
                phone: state.customer.phone || '',
                designNumber: state.customer.designNumber || '',
            };
            pq.shipping = {
                method: state.shipping.method,
                address1: state.shipping.address1 || '',
                address2: state.shipping.address2 || '',
                city: state.shipping.city || '',
                state: state.shipping.state || '',
                zip: state.shipping.zip || '',
                taxRate: state.shipping.taxRate,
                taxRateSource: state.shipping.taxRateSource || '',
                taxAccount: state.shipping.taxAccount || '',
                taxAccountName: state.shipping.taxAccountName || '',
                taxRateOverride: state.shipping.taxRateOverride,
                includeTax: state.shipping.includeTax !== false,
                // [2026-06-09] Phase 2 — persist the billed shipping charge so edit-reload
                // (Chunk E) restores it from Notes.shipping.fee. effectiveShipFee() → 0 for pickup.
                fee: effectiveShipFee(),
            };
            return pq;
        },
        // True when at least one row is fully priced — gates the form's Save button.
        hasCompleteRows: () => state.rows.some(r =>
            r.style && r.color && Object.keys(r.sizes || {}).length > 0 && Number(r._lineTotal) > 0),
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
            // FF_JB / JF_FB have no pricing data (see SUPPORTED_COMBOS) —
            // reject so the chat reports failure instead of silently
            // setting a combo that prices to $0.
            if (b && !isComboSupported(f, b)) return null;
            const changed = (state.front !== f) || (state.back !== b);
            if (!changed) return effectiveLocationCode();
            state.front = f;
            state.back = b;
            // Real (non-preview) mutation — arm the leave-guard. Skips
            // markDirty on purpose (chat-driven, C9 guard shouldn't fire).
            if (typeof markAsUnsaved === 'function') markAsUnsaved();
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
