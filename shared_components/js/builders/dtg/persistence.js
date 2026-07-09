/**
 * DTG inline form — persistence module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global alert, assertQuoteEditable,
   markAsUnsaved, markAsSaved, showToast,
   */
import { fetchProductColors, fuzzyMatchColor, kickInventoryFetch } from './catalog-search.js';
import { effectiveLocationCode, newBlankRow, render, renderLocationPills, renderTable, updateSubmitEnabled } from './form-core.js';
import { genericConfirm } from './output.js';
import { combinedQty, fetchBundle, renderSummary, schedulePriceUpdate } from './pricing.js';
import { QUOTEID_KEY, STATE_KEY, STATE_VERSION, _designsCacheByCustomer, dtgIF, state } from './state.js';
import { recomputeTaxRate, syncPickupToggleFromShipMethod } from './tax-shipping.js';
import { clearDirty, computeAutoDueDate, escapeHtml, sanitizeLocationState } from './utils.js';

export function scheduleStateSave() {
    clearTimeout(dtgIF._saveTimer);
    dtgIF._saveTimer = setTimeout(() => {
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
export function restoreStateFromSession() {
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

export function clearSessionState() {
    try {
        sessionStorage.removeItem(STATE_KEY);
        sessionStorage.removeItem(QUOTEID_KEY);
    } catch {}
    try { delete window.__dtgQuoteID; } catch {}
}

// Read the AI quoteID. Prefers window scope (set by the chat controller
// when a PRICE_QUOTE block arrives), falls back to sessionStorage so it
// survives page refresh.
export function getQuoteID() {
    if (window.__dtgQuoteID) return window.__dtgQuoteID;
    try { return sessionStorage.getItem(QUOTEID_KEY) || ''; }
    catch { return ''; }
}

export function setQuoteID(qid) {
     
    if (!qid) return;
    // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim IIFE move, Batch 5)
    window.__dtgQuoteID = qid;
    try { sessionStorage.setItem(QUOTEID_KEY, qid); } catch {}
}

// ----- Public API for chat bridge ---------------------------------------
export async function fillFromQuote(priceQuote, customerFinal) {
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

export function getState() {
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

export function resetForm() {
    // Preserve the rep's last-picked sales rep across resets — they
    // typically do many quotes in a row as themselves.
    const preservedRepCode = state.customer.salesRepCode
        || (function () { try { return localStorage.getItem('dtg.lastSalesRep') || 'erik'; } catch { return 'erik'; } })();
    // Clear the design picker cache so a fresh quote doesn't show the
    // previous customer's designs in the picker.
    _designsCacheByCustomer.clear();
    dtgIF._designComboboxCustomerId = null;
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
        taxRate: 0.102, taxRateSource: 'pickup-flat',
        taxAccount: '2200.102', taxAccountName: 'Wash:10.2%',
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
export async function loadSavedDtgQuoteForEdit(quoteId, opts = {}) {
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
    // EXCEPTION: duplicate mode never writes to the source quote, so locked/
    // pushed quotes (the classic reorder case) are fine to duplicate from.
    if (!opts.forDuplicate && typeof assertQuoteEditable === 'function' && !assertQuoteEditable(session)) {
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
    // 10.2% Milton pickup (the EMB/SCP/DTF edit-reload bug class). Source: Notes.shipping
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
    // async DOR re-lookup completes — not the 10.2% default.
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
    // one rep click on the wrongly-ON toggle would flip method→pickup and recompute 10.2%,
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

    if (opts.forDuplicate) {
        // Duplicate mode: this is a brand-NEW quote — never adopt the source's
        // identifiers. Clear any stale editing/session ids so the next save
        // CREATEs with a fresh sequence id from ensureQuoteID() (dtg-quote-page.js):
        // window.open copies sessionStorage into the new tab in most browsers,
        // so a stashed quoteID from the opener could otherwise be silently
        // reused as this copy's QuoteID (duplicate-QuoteID collision).
        try { delete window._dtgEditingQuoteId; } catch (_) {}
        try { delete window._dtgEditingPK_ID; } catch (_) {}
        try { delete window._dtgEditingRevision; } catch (_) {}
        try { delete window.__dtgQuoteID; } catch (_) {}
        try { sessionStorage.removeItem(QUOTEID_KEY); } catch (_) {}
        // dtg-quote-page.js's ensureQuoteID() resume-stash uses its own
        // hardcoded v1 key (NOT QUOTEID_KEY) — clear it too.
        try { sessionStorage.removeItem('dtg.quoteID.v1'); } catch (_) {}
        if (window.aiState) {
            window.aiState.quoteID = null;
            window.aiState.quoteIDPromise = null;
            window.aiState.savedQuoteID = null;
        }
    } else {
        // Stash editing context on window so dtg-quote-page.js's save path
         
        // can branch into the PUT/revision flow.
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim IIFE move, Batch 5)
        window._dtgEditingQuoteId = quoteId;
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim IIFE move, Batch 5)
        window._dtgEditingPK_ID = session.PK_ID;
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim IIFE move, Batch 5)
        window._dtgEditingRevision = Number(session.RevisionNumber) || 1;
        // Also make the quoteID visible to the existing getQuoteID() helper.
        setQuoteID(quoteId);
        // Mark aiState as already saved so the email button (Phase 11.5) works
        // out of the box without requiring a fresh "Save & share link" click.
        if (window.aiState) window.aiState.savedQuoteID = quoteId;
    }

    // Render the populated form + kick inventory hydration so size cells
    // light up.
    renderLocationPills();
    renderTable();
    renderSummary();
    // [2026-06-08] Phase 1 Chunk E — re-derive tax from the just-restored shipping/
    // wholesale/exempt/manual state (single authority). Without this a reopened
    // non-pickup quote would keep the default 10.2% until the rep touched a field.
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

    if (opts.forDuplicate) {
        // Duplicate banner (edit banner intentionally not shown) + toast.
        // The copy is UNSAVED work — arm the leave-guard (DTF/EMB parity).
        showDuplicateModeBanner(quoteId);
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
        if (typeof showToast === 'function') {
            showToast(`Duplicated ${quoteId} — prices refreshed to today's rates. Saving will create a new quote #.`, 'success', 7000);
        }
        return;
    }

    // Show edit-mode banner — explains current rev + that next save is a revision.
    showEditModeBanner(quoteId, window._dtgEditingRevision);

    // Loaded content came FROM Caspio — a freshly reopened quote is NOT
    // dirty. Defensive clear in case any populate step above tripped the
    // leave-guard (the DTF edit-load lesson, 2026-06-10). The async
    // inventory/bundle hydration callbacks don't markDirty, so this can't
    // be un-done by a late fetch.
    if (typeof markAsSaved === 'function') markAsSaved();
}

// Duplicate-mode banner — green "this is a copy" variant of showEditModeBanner
// (EMB/DTF parity 2026-07-05: same wording pattern as their header subtitle).
export function showDuplicateModeBanner(sourceQuoteId) {
    try {
        const mount = document.getElementById('dtgResumeBannerMount');
        if (!mount) return;
        mount.innerHTML = '';
        const banner = document.createElement('div');
        banner.className = 'dtg-duplicate-mode-banner';
        banner.style.cssText =
            'display:flex;align-items:center;gap:8px;padding:10px 14px;' +
            'background:#ecfdf5;border:1px solid #34d399;border-left:4px solid #059669;' +
            'border-radius:6px;color:#065f46;font-size:13px;line-height:1.4;margin-bottom:10px;';
        banner.innerHTML = `
            <i class="fas fa-copy"></i>
            <div>
                <strong>Duplicated from ${escapeHtml(String(sourceQuoteId))}</strong>
                <span class="qb-dim"> — saving creates a NEW quote at today's prices.</span>
            </div>
        `;
        mount.appendChild(banner);
    } catch (err) {
        console.warn('[dtg-inline-form] showDuplicateModeBanner skipped:', err && err.message);
    }
}

export function showEditModeBanner(quoteId, revision) {
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
                <span class="qb-dim"> — Saving will create Rev ${escapeHtml(String(revision + 1))} (same quote ID).</span>
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
export function showResumeBanner() {
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
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
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

// ----- Real-time preview helpers (chat-driven, silent) ----------------
// These let the chat controller fill the form INCREMENTALLY as the bot
// does its work — before the final PRICE_QUOTE block arrives. They do
// NOT mark dirty (so the C9 race guard doesn't fire) and do NOT save
// to sessionStorage (preview state isn't yet authoritative).
//
// The "AI is filling…" indicator class `.dtg-row-ai-touched` is added
// to the touched row and faded out after the next renderTable() call.
