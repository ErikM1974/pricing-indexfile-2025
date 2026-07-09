/**
 * EMB pricing-sync module — roadmap 0.4 extraction #8 (2026-07-07).
 *
 * THE hot pricing path: recalculatePricing (the 353-line orchestrator every
 * qty/size/logo change funnels into), collectProductsFromTable (state
 * collection feeding save/print — Rule 7: same inputs everywhere),
 * updatePricingDisplay (351-line renderer), AL/DECG/rush row sync, nudges,
 * digitizing labels, and the tax + shipping UI (lookupTaxRate,
 * updateTaxCalculation, ship mode/modal).
 *
 * Moved verbatim from embroidery-quote-builder.js (~1,808-line contiguous
 * cluster). One mechanical adaptation: the monolith tail's
 * `recalculatePricing = wrapWithRepricingIndicator(recalculatePricing)`
 * becomes an impl + `export let` + module-tail rewrap (see file tail), so
 * module-internal callers, live-binding importers, and the window bridge
 * all invoke the wrapped version — identical to pre-move semantics.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global showToast, escapeHtml,
   wrapWithRepricingIndicator, parseRatePercent, getLtmControlState,
   setLtmControlState, renderOrderRecap, markAsUnsaved, QuoteOrderSummary, structuredClone, updateQuantityNudge,
   renderLtmControlPanel, initLtmControlListeners,
   renderShipToCard, updatePerUnitPrice */
import { getServicePrice } from './pricing.js';
import { updateAdditionalCharges } from './quote-lifecycle.js';
import { renderPushReadiness } from './save-push.js';
import { markEmbroideryDirty } from './persistence.js';
import { getCapEmbellishmentType } from './logo-config.js';
import { createServiceProductRow, updateRowBreakdown } from './product-rows.js';
import { embState, EMB_DEFAULTS, SIZE06_EXTENDED_SIZES, API_BASE } from './state.js';

// Module state — was window._* flags (Batch 3.4, 2026-07-09); nothing outside this file reads them.
let _alPricingCache = null;      // AL tier snapshot (cleared per recalc — stale = wrong price)
let _decgPricingCache = null;    // DECG tier snapshot (same lifecycle)
let _alPricingSvc = null;        // lazy EmbroideryPricingService instance for AL/DECG fetches
let _decgLtmState = null;        // DECG-LTM row bookkeeping { rowId, sig, waivedSig }
let _embRecalcSeq = 0;           // recalc race-guard sequence (newer run supersedes)
let _ddFeeMismatchWarned = false; // once-per-page digitizing-fee mismatch warning

// Debounce utility for input handlers that fire on every keystroke
export function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Build logo configuration from current global state.
 * Shared between recalculatePricing() and saveAndGetLink() to avoid duplication.
 */
export function buildLogoConfiguration() {
    const garmentAL = embState.globalAL.garment.enabled ? [{
        id: 'global-al-garment',
        position: 'AL',
        stitchCount: embState.globalAL.garment.stitchCount,
        needsDigitizing: embState.globalAL.garment.needsDigitizing
    }] : [];
    const capAL = embState.globalAL.cap.enabled ? [{
        id: 'global-al-cap',
        position: 'AL-Cap',
        stitchCount: embState.globalAL.cap.stitchCount,
        needsDigitizing: embState.globalAL.cap.needsDigitizing
    }] : [];

    const logoConfigs = {
        garment: {
            primary: { ...embState.primaryLogo, id: 'primary' },
            additional: garmentAL
        },
        cap: {
            primary: { ...embState.capPrimaryLogo, id: 'cap-primary' },
            additional: capAL
        }
    };

    const allLogos = [
        { ...embState.primaryLogo, id: 'primary' },
        ...garmentAL,
        { ...embState.capPrimaryLogo, id: 'cap-primary' },
        ...capAL
    ];

    return { logoConfigs, allLogos };
}

export const debouncedRecalculatePricing = debounce(() => recalculatePricing(), 250);

/**
 * Rush Fee = 25% of the merchandise subtotal, as a live LINE ITEM (part RUSH /
 * "Rush Charge"), mirroring ShopWorks. Added from the Services bar (Charges ▸ Rush
 * Fee). Recomputed at the END of every recalculatePricing pass: base = #grand-total
 * minus this row's OWN current value (so it never counts itself), rush = 25% × base.
 * Saves + pushes as a normal RUSH service line item (qty 1 → Size01 on import).
 * (2026-06-03)
 */
/**
 * Additional Logo (AL) live pricing — bar-driven line items.
 * Each AL row (data-al-priced) carries a stitch count + item type (garment/cap/fullback).
 * Price is pulled LIVE from the API via EmbroideryPricingService.calculateALPrice (tier-aware
 * + per-1K stitch upcharge), cached once per session. syncALRows() recomputes every AL row at
 * the END of each recalc pass — BEFORE syncRushRow() so the rush base includes the AL totals —
 * adjusting #grand-total the same self-referential way syncRushRow does. NEVER falls back to a
 * guessed price: if the API is unreachable, it shows a visible error and leaves the row at $0
 * (Erik's #1 rule — wrong pricing is worse than an error). (2026-06-03)
 */
/**
 * "Retry pricing" on failed AL/DECG rows (old-audit P2 #9, shipped 2026-07-07):
 * an API blip flagged rows with data-price-error and the only recovery was a FULL
 * PAGE REFRESH — losing unsaved work mid-call. The button clears the pricing
 * caches and re-runs the same live syncs; the save gate stays closed until a
 * retry actually succeeds.
 */
function renderPriceErrorRetries() {
    document.querySelectorAll('#product-tbody tr.service-product-row[data-price-error="true"]').forEach(row => {
        const rid = row.dataset.rowId;
        const cell = document.getElementById(`row-price-${rid}`);
        if (!cell || cell.querySelector('.btn-retry-pricing')) return;
        cell.innerHTML = '<button type="button" class="btn-retry-pricing" onclick="retryRowPricing()" title="Pricing failed to load — retry without refreshing the page"><i class="fas fa-rotate-right"></i> Retry</button>';
    });
}

export async function retryRowPricing() {
    showToast('Retrying pricing…', 'info', 2000);
    _alPricingCache = null;     // force fresh fetches — a stale snapshot is
    _decgPricingCache = null;   // exactly what a failed row must not reuse
    try {
        await syncALRows();
        await syncDECGRows();
        await recalculatePricing();
    } catch (e) {
        console.error('[RetryPricing] resync failed', e);
    }
    const still = document.querySelectorAll('#product-tbody tr[data-price-error="true"]').length;
    showToast(
        still ? 'Pricing is still unavailable — check the connection and retry.' : 'Pricing recovered — rows repriced.',
        still ? 'error' : 'success'
    );
}
window.retryRowPricing = retryRowPricing;

async function loadALPricing() {
    if (_alPricingCache) return _alPricingCache;
    if (!window.EmbroideryPricingService) { console.error('[AL] EmbroideryPricingService unavailable'); return null; }
    try {
        _alPricingSvc = _alPricingSvc || new window.EmbroideryPricingService();
        _alPricingCache = await _alPricingSvc.fetchALPricing();
        return _alPricingCache;
    } catch (e) {
        console.error('[AL] fetchALPricing failed', e);
        showToast("Couldn't load Additional Logo pricing from the server — click Retry on the affected row (no refresh needed).", 'error');
        return null;
    }
}

/**
 * Current piece counts on the order, garment vs cap, summed from the product rows. An
 * Additional Logo is a 2nd decoration that goes on EVERY piece, so its qty should track the
 * order total (not sit at 1) — used to auto-default + auto-sync AL rows. (Erik 2026-06-05)
 */
export function getOrderPieceCounts() {
    const products = collectProductsFromTable().filter(p => !p.isService);
    return {
        garment: products.filter(p => !p.isCap).reduce((s, p) => s + (p.totalQuantity || 0), 0),
        cap: products.filter(p => p.isCap).reduce((s, p) => s + (p.totalQuantity || 0), 0),
    };
}

export async function syncALRows() {
    const alRows = document.querySelectorAll('#product-tbody tr.service-product-row[data-al-priced="true"]');
    if (!alRows.length) return;
    const cache = await loadALPricing();
    // [A3] (audit 2026-06-06): API down → do NOT leave a stale/$0 AL price the save gate would accept. Flag
    // every AL row so saveAndGetLink's priceError gate blocks it (Erik's #1 rule). Toast already surfaced.
    if (!cache) { alRows.forEach(r => { r.dataset.priceError = 'true'; }); return; }
    const svc = _alPricingSvc;
    const counts = getOrderPieceCounts();
    for (const row of alRows) {
        const rid = row.dataset.rowId;
        const itemType = row.dataset.alItemType || 'garment';
        // Auto-tally: a 2nd logo goes on every piece — keep the qty synced to the order's
        // garment/cap count UNLESS the rep overrode it (al-qty-auto === "false"). (Erik 2026-06-05)
        if (row.dataset.alQtyAuto !== 'false') {
            const want = (itemType === 'cap') ? counts.cap : counts.garment;
            const qInput = row.querySelector('.service-qty');
            // Set the qty to the order count even when it's 0 (rep removed all garments) — otherwise a
            // stale auto-tallied AL keeps its old qty and bills against zero pieces. Manual rows
            // (alQtyAuto === 'false') are excluded by the guard above, so a hand-set qty is never zeroed. (audit fix 2026-06-05)
            if (qInput && String(want) !== qInput.value) qInput.value = String(want);
        }
        const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
        const stitch = parseInt(row.dataset.stitchCount, 10) || 8000;
        let unit = 0;
        try {
            const res = await svc.calculateALPrice(qty || 1, stitch, itemType, cache);
            unit = res.unitPrice || 0;
            delete row.dataset.priceError;
        } catch (e) {
            // P1-4 (audit 2026-06-06): a pricing throw must NOT silently bill $0 (Erik's #1 rule). Flag the
            // row so the save/push gate blocks it, and tell the rep.
            console.error('[AL] calculateALPrice failed', e);
            row.dataset.priceError = 'true';
            showToast('Could not price the Additional Logo row — refresh; it will not be saved at $0.', 'error');
        }
        if (!(unit > 0)) row.dataset.priceError = 'true';   // an AL is never legitimately $0
        // Store the live price on the row; the next recalc sums it like any service row.
        row.dataset.unitPrice = String(unit);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const totalCell = document.getElementById(`row-total-${rid}`);
        if (priceCell) priceCell.textContent = '$' + unit.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + (unit * qty).toFixed(2);
    }
}
window.syncALRows = syncALRows;

/**
 * Customer-Supplied (DECG/DECC) live pricing — bar-driven line items, a mirror of the AL path.
 * Each DECG/DECC row (data-decg-priced) carries a stitch count + item type (garment/cap). The
 * per-piece price is LIVE from the API (EmbroideryPricingService.calculateDECGPrice — qty-tier
 * base + per-1K stitch upcharge from the Embroidery_Costs DECG tiers, garment vs cap by itemType),
 * cached once per session. syncDECGRows() recomputes every DECG row whenever the quantity changes.
 * NEVER falls back to a guessed price: if the API is unreachable it shows a visible error and
 * leaves the row at $0 (Erik's #1 rule). Manually-overridden rows are left untouched. (2026-06-04)
 */
async function loadDECGPricing() {
    if (_decgPricingCache) return _decgPricingCache;
    if (!window.EmbroideryPricingService) { console.error('[DECG] EmbroideryPricingService unavailable'); return null; }
    try {
        _alPricingSvc = _alPricingSvc || new window.EmbroideryPricingService();
        _decgPricingCache = await _alPricingSvc.fetchDECGPricing();
        return _decgPricingCache;
    } catch (e) {
        console.error('[DECG] fetchDECGPricing failed', e);
        showToast("Couldn't load Customer-Supplied (DECG) pricing from the server — click Retry on the affected row (no refresh needed).", 'error');
        return null;
    }
}

export async function syncDECGRows() {
    const rows = document.querySelectorAll('#product-tbody tr.service-product-row[data-decg-priced="true"]');
    if (!rows.length) {
        // Last DECG row deleted → the synthesized small-batch fee goes with it.
        _syncDecgLtmRow({ garment: 0, cap: 0 }, { garment: 0, cap: 0 });
        return;
    }
    const cache = await loadDECGPricing();
    // [A3 + A3-DECG fix] (audit 2026-06-06): API down → flag rows so saveAndGetLink's priceError gate blocks
    // (Erik's #1 rule). But a MANUALLY-overridden DECG row (sellPrice>0) is independent of the API → don't
    // over-block it (fail-closed otherwise). Toast already surfaced.
    if (!cache) { rows.forEach(r => { if (!(parseFloat(r.dataset.sellPrice) > 0)) r.dataset.priceError = 'true'; }); return; }
    const svc = _alPricingSvc;

    // [expert audit 2026-07-07 F10] Tier at the POOLED same-category quantity: 15
    // supplied jackets + 15 supplied hoodies run as ONE 30-pc job (tier 24-47), not
    // two tier-8-23 rows — per-row tiering over-charged vs how the shop runs and vs
    // purchased-garment pooling. Overridden rows still occupy the machine run, so
    // their qty counts toward the tier/fee even though their price isn't touched.
    const pooledQty = { garment: 0, cap: 0 };
    rows.forEach(r => {
        const t = r.dataset.decgItemType === 'cap' ? 'cap' : 'garment';
        pooledQty[t] += parseFloat(r.querySelector('.service-qty')?.value) || 0;
    });
    const decgLtm = { garment: 0, cap: 0 };

    for (const row of rows) {
        const rid = row.dataset.rowId;
        const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
        const stitch = parseInt(row.dataset.stitchCount, 10) || 8000;
        const itemType = row.dataset.decgItemType === 'cap' ? 'cap' : 'garment';
        const heavyweight = row.dataset.decgHeavyweight === 'true';
        const tierQty = Math.max(pooledQty[itemType], qty || 1, 1);
        if (parseFloat(row.dataset.sellPrice) > 0) {
            // manual override — recalc handles the display; still capture the
            // category's small-batch fee so the fee row stays correct.
            try {
                const probe = await svc.calculateDECGPrice(tierQty, stitch, itemType, cache, heavyweight);
                if (probe && probe.ltmFee > 0) decgLtm[itemType] = probe.ltmFee;
            } catch (_) { /* an override row never blocks */ }
            continue;
        }
        let unit = 0;
        try {
            const res = await svc.calculateDECGPrice(tierQty, stitch, itemType, cache, heavyweight);
            unit = res.unitPrice || 0;
            // [expert audit 2026-07-07 F1] the service has ALWAYS returned the ≤7-pc
            // small-batch fee here — the old code read only unitPrice, so every
            // bring-your-own order under the threshold left $50 on the table (the
            // public DECG calculator and the ShopWorks import path both charge it).
            if (res.ltmFee > 0) decgLtm[itemType] = res.ltmFee;
            delete row.dataset.priceError;
        } catch (e) {
            // P1-4 (audit 2026-06-06): never silently bill a customer-supplied row at $0 (Erik's #1 rule).
            console.error('[DECG] calculateDECGPrice failed', e);
            row.dataset.priceError = 'true';
            showToast('Could not price the Customer-Supplied row — refresh; it will not be saved at $0.', 'error');
        }
        if (!(unit > 0)) row.dataset.priceError = 'true';   // a customer-supplied row is never $0
        // Store the live price on the row; the next recalc sums it like any service row.
        row.dataset.unitPrice = String(unit);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const totalCell = document.getElementById(`row-total-${rid}`);
        if (priceCell) priceCell.textContent = '$' + unit.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + (unit * qty).toFixed(2);
    }

    _syncDecgLtmRow(decgLtm, pooledQty);
}
window.syncDECGRows = syncDECGRows;

/**
 * Synthesized "Customer-Supplied Small-Batch Fee" service row (expert audit
 * 2026-07-07 F1). A real ROW — not sidebar math — so it rides every money path
 * for free: recalc totals, saved quote_items, the printed PDF, and the ShopWorks
 * push (PN 'LTM' is proxy-registered in KNOWN_FEE_PNS). Amount comes from the
 * DECG API response (ltmFee at the pooled category qty), never hardcoded.
 * Deleting the row = waiving the fee — it won't re-add until the pooled DECG
 * quantities change the fee (a fresh decision point). Reloaded saved quotes are
 * re-adopted via data-service-type="ltm" so edits keep the amount live.
 */
export function _syncDecgLtmRow(decgLtm, pooledQty) {
    const total = (decgLtm.garment || 0) + (decgLtm.cap || 0);
    const sig = `${decgLtm.garment || 0}|${decgLtm.cap || 0}`;
    const st = (_decgLtmState = _decgLtmState || { rowId: null, sig: null, waivedSig: null });

    let row = st.rowId ? document.getElementById(`row-${st.rowId}`) : null;
    if (!row) row = document.querySelector('#product-tbody tr.service-product-row[data-service-type="ltm"]');

    if (!(total > 0)) {
        if (row) row.remove();
        st.rowId = null; st.sig = null; st.waivedSig = null;
        return;
    }

    if (!row) {
        if (st.sig !== null) {
            // We rendered a fee this session and the row is gone → the rep deleted
            // it (waive). Honor it until the fee itself changes.
            st.waivedSig = st.sig;
            st.rowId = null; st.sig = null;
        }
        if (st.waivedSig === sig) return;
        row = createServiceProductRow('LTM', { quantity: 1, unitPrice: total, total: total, isCap: false });
        if (!row) return;
        row.dataset.decgLtm = 'true';
        const qtyIn = row.querySelector('.service-qty');
        if (qtyIn) { qtyIn.value = 1; qtyIn.readOnly = true; qtyIn.title = 'Small-batch fee — one per order (delete the row to waive)'; }
        st.rowId = row.dataset.rowId; st.sig = sig; st.waivedSig = null;
        const parts = [];
        if (decgLtm.garment > 0) parts.push(`${pooledQty.garment} supplied garment pc`);
        if (decgLtm.cap > 0) parts.push(`${pooledQty.cap} supplied cap pc`);
        if (typeof showToast === 'function') {
            showToast(`Customer-supplied small-batch fee added: $${total.toFixed(2)} (${parts.join(' + ')} under the 8-pc minimum). Delete the row to waive it.`, 'info', 8000);
        }
        return;
    }

    // Row exists → adopt + keep the amount live (unless the rep price-overrode it)
    st.rowId = row.dataset.rowId; st.sig = sig;
    row.dataset.decgLtm = 'true';
    if (!(parseFloat(row.dataset.sellPrice) > 0)) {
        row.dataset.unitPrice = String(total);
        const pc = document.getElementById(`row-price-${row.dataset.rowId}`);
        const tc = document.getElementById(`row-total-${row.dataset.rowId}`);
        if (pc) pc.textContent = '$' + total.toFixed(2);
        if (tc) tc.textContent = '$' + total.toFixed(2);
    }
}

// Rush surcharge rate — sourced from the Service_Codes API (RUSH.UnitCost = 25 → 25%), NOT hardcoded,
// so Erik can change it in Caspio with no deploy (CLAUDE.md "Pricing = API" rule). getServicePrice()
// can't be reused here: it reads SellPrice, which is 0 for RUSH (PricingMethod=CALCULATED) — the rate
// lives in UnitCost. Falls back to 0.25 with a ONE-TIME visible warning if the API didn't load. (audit #13a 2026-06-05)
let _rushRateWarned = false;
export function getRushRate() {
    const sc = window._serviceCodes && window._serviceCodes['RUSH'];
    const pct = sc ? parseFloat(sc.UnitCost) : NaN;
    if (!isNaN(pct) && pct > 0) return pct / 100;
    if (!_rushRateWarned) {
        _rushRateWarned = true;
        if (typeof showToast === 'function') showToast('Using default 25% rush — rush rate not loaded from the pricing service', 'warning', 5000);
        console.warn('[Rush] RUSH service-code UnitCost unavailable; falling back to 25%');
    }
    return 0.25;
}
window.getRushRate = getRushRate;
export function syncRushRow() {
    const rushRows = document.querySelectorAll('#product-tbody tr.service-product-row[data-service-type="rush"]');
    if (!rushRows.length) return;
    const grandEl = document.getElementById('grand-total');
    let grand = parseFloat((grandEl?.textContent || '$0').replace(/[$,]/g, '')) || 0;
    rushRows.forEach((row) => {
        const rid = row.dataset.rowId;
        const totalCell = document.getElementById(`row-total-${rid}`);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const oldTotal = parseFloat((totalCell?.textContent || '$0').replace(/[$,]/g, '')) || 0;
        const base = grand - oldTotal;                 // everything except this rush row
        const rush = +(base * getRushRate()).toFixed(2);
        row.dataset.unitPrice = String(rush);
        if (priceCell) priceCell.textContent = '$' + rush.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + rush.toFixed(2);
        grand = base + rush;                           // adjust running grand total
    });
    if (grandEl) grandEl.textContent = '$' + grand.toFixed(2);
}
window.syncRushRow = syncRushRow;

// [2026-06-08] EMB DRY-rewire: perBoxForCategory (box-density math) removed — it now lives ONLY in the shared
// estimator (quote-order-summary.js), which EMB's estimateShipping delegate calls. Tune box density via Caspio
// Box_Density_Reference (window._boxDensity) as before — no code change needed.

// [2026-06-08] EMB DRY-rewire: thin delegate to the SHARED estimator (quote-order-summary.js). The full UPS-Ground
// weight/box-math (validated vs real ShopWorks/UPS invoices) now lives ONCE in the module; EMB's estimateHooks (in
// configure above) feed it EMB's product source (collectProductsFromTable) + #shipping-fee + #ship-residential + the
// post-apply recalc. Byte-identical to the old inline copy — regression-gated against a fixed order before shipping.
export async function estimateShipping() { return QuoteOrderSummary.estimateShipping(); }
window.estimateShipping = estimateShipping;

/**
 * Which category (garment/cap) is nearer its next EMB tier break — they tier
 * SEPARATELY, so the nudge must target one category, never the combined total.
 * label is set only for mixed orders (where ambiguity exists). (2026-06-10)
 */
function computeEmbNudgeTarget(garmentQty, capQty) {
    const breaks = [8, 24, 48, 72];
    const nextBreak = q => breaks.find(b => q < b) || null;
    const mixed = garmentQty > 0 && capQty > 0;
    const mk = (q, category) => {
        const nb = nextBreak(q);
        return nb ? { qty: q, needed: nb - q, nextBreak: nb, category, label: mixed ? category : '' } : null;
    };
    const g = garmentQty > 0 ? mk(garmentQty, 'garment') : null;
    const c = capQty > 0 ? mk(capQty, 'cap') : null;
    if (g && c) return g.needed <= c.needed ? g : c;
    return g || c || { qty: 0, needed: 0, nextBreak: null, category: '', label: '' };
}

/**
 * Price-break ladder (2026-06-10): simulate the order at the next tier with the
 * REAL engine (clone + pad the target category) and show the actual $/pc savings
 * in the nudge — "Add 3 more garment pieces … save ~$1.62/piece". Fire-and-forget
 * after each recalc; the seq guard discards stale results.
 */
async function computeNudgeSavingsAsync(productList, allLogos, logoConfigs, ltmEnabled, pricing, mySeq) {
    try {
        const t = computeEmbNudgeTarget(pricing.garmentQuantity || 0, pricing.capQuantity || 0);
        if (!t.qty || !t.needed || !t.nextBreak) return;
        if (t.needed > Math.ceil(t.nextBreak * 0.30)) return;   // nudge not visible — skip the sim
        const isCapTarget = t.category === 'cap';
        const idx = productList.findIndex(p => !!p.isCap === isCapTarget);
        if (idx === -1) return;
        let clone;
        try { clone = structuredClone(productList); } catch (_) { clone = JSON.parse(JSON.stringify(productList)); }
        const target = clone[idx];
        target.totalQuantity = (target.totalQuantity || 0) + t.needed;
        const sb = target.sizeBreakdown || target.sizes;
        if (sb && typeof sb === 'object') {
            const k = Object.keys(sb).find(key => sb[key] > 0) || 'L';
            sb[k] = (Number(sb[k]) || 0) + t.needed;
        }
        const sim = await embState.pricingCalculator.calculateQuote(clone, allLogos, logoConfigs, { ltmEnabled });
        if (mySeq !== _embRecalcSeq) return;   // a newer recalc superseded this sim
        if (!sim || sim.success === false) return;
        const unitOf = (res) => {
            const pp = (res.products || []).find(p => !!(p.product && p.product.isCap) === isCapTarget);
            const li = pp && (pp.lineItems || [])[0];
            const v = li && Number(li.unitPriceWithLTM ?? li.unitPrice);
            return Number.isFinite(v) && v > 0 ? v : null;
        };
        const cur = unitOf(pricing);
        const next = unitOf(sim);
        if (cur == null || next == null) return;
        const savings = cur - next;
        if (savings > 0.01) {
            updateQuantityNudge(t.qty, 'emb', savings, 'quantity-nudge', t.label);
        }
    } catch (e) {
        console.warn('[Nudge] savings simulation skipped:', e);
    }
}

/**
 * Digitizing fee has TWO Caspio homes (expert audit 2026-07-07): the logo-card
 * checkboxes bill the pricing-bundle's Embroidery_Costs.DigitizingFee
 * (embroidery-quote-pricing.js loadPricingData → engine :1811/:1823) while the
 * services-bar DD chip bills Service_Codes['DD']. Keep the static "$100" card
 * labels synced to the value the checkbox actually bills, and WARN once if the
 * two Caspio sources diverge — a silent mismatch is how the same quote grows
 * two different digitizing prices.
 */
export function syncDigitizingPriceLabels() {
    const bundleFee = (typeof embState.pricingCalculator !== 'undefined' && embState.pricingCalculator && Number(embState.pricingCalculator.digitizingFee) > 0)
        ? Number(embState.pricingCalculator.digitizingFee) : null;
    const ddFee = (typeof getServicePrice === 'function') ? getServicePrice('DD', bundleFee ?? 100) : (bundleFee ?? 100);
    const billed = bundleFee ?? ddFee;
    document.querySelectorAll('[data-dd-price]').forEach(el => {
        el.textContent = `$${Number(billed).toFixed(0)}`;
    });
    if (bundleFee != null && Math.abs(ddFee - bundleFee) > 0.005 && !_ddFeeMismatchWarned) {
        _ddFeeMismatchWarned = true;
        if (typeof showToast === 'function') {
            showToast(`Digitizing fee mismatch in Caspio: Embroidery_Costs says $${bundleFee} (logo-card checkbox) but Service_Codes DD says $${ddFee} (services bar). Align them so both paths bill the same.`, 'warning', 10000);
        }
    }
}

/**
 * No-design-number nudge (expert audit 2026-07-07): a logo with no Design #
 * linked is usually a NEW logo, and forgetting the $100 new-logo setup is the
 * classic new-CSR under-quote. Soft hint only — repeat logos legitimately skip it.
 */
export function updateDigitizingNudges() {
    [
        { designId: 'garment-design-number', checkboxId: 'primary-digitizing', nudgeId: 'garment-digitizing-nudge' },
        { designId: 'cap-design-number', checkboxId: 'cap-primary-digitizing', nudgeId: 'cap-digitizing-nudge' }
    ].forEach(({ designId, checkboxId, nudgeId }) => {
        const designEl = document.getElementById(designId);
        const cb = document.getElementById(checkboxId);
        const host = cb ? cb.closest('.digitizing-checkbox') : null;
        if (!designEl || !cb || !host) return;
        let nudge = document.getElementById(nudgeId);
        const cardVisible = host.offsetParent !== null;   // hidden card (e.g. no caps in quote) → no nudge
        const show = cardVisible && !designEl.value.trim() && !cb.checked;
        if (!show) { if (nudge) nudge.remove(); return; }
        if (nudge) return;   // already showing
        nudge = document.createElement('span');
        nudge.id = nudgeId;
        nudge.className = 'digitizing-nudge';
        nudge.textContent = 'No design # — new logo? Add new-logo setup';
        host.insertAdjacentElement('afterend', nudge);
    });
}

async function _recalculatePricingImpl() {
    // Keep the digitizing card labels honest + surface the new-logo nudge on every
    // reprice (both are cheap, idempotent DOM updates). (expert audit 2026-07-07)
    try { syncDigitizingPriceLabels(); updateDigitizingNudges(); } catch (_) {}
    // Stale-response guard: rapid edits fire overlapping recalcs, and an OLDER
    // calculateQuote resolving after a newer one overwrote fresher totals on
    // screen (the save path then snapshotted them). Only the latest call may
    // apply results. (audit 2026-06-10)
    const mySeq = (_embRecalcSeq = (_embRecalcSeq || 0) + 1);
    // Keep Additional-Logo rows tallied to the order's piece count + re-priced for the current
    // tier BEFORE we read the table — so a garment add/remove/qty change flows into the AL line.
    // (syncALRows early-returns if there are no AL rows; sets the qty programmatically so it
    //  doesn't re-fire onServiceQtyChange → no loop.) (Erik 2026-06-05)
    try { await syncALRows(); } catch (_) {}
    renderOrderRecap();  // keep the bottom Order Recap (customer / ship / logos) current on any recalc
    renderPushReadiness();  // keep the "At least one product" push-readiness check current (audit #8)
    // Collect products from table (parent rows only)
    const allItems = collectProductsFromTable();
    const productList = allItems.filter(p => !p.isService);
    const serviceItems = allItems.filter(p => p.isService);

    if (productList.length === 0) {
        // Sum ALL service items (DECG, DECC, Monogram, AL, etc.)
        let serviceOnlyTotal = 0;
        let totalQty = 0;
        let hasGarments = false;
        let hasCaps = false;

        serviceItems.forEach(si => {
            serviceOnlyTotal += si.unitPrice * si.totalQuantity;
            totalQty += si.totalQuantity;
            if (si.serviceType === 'decg' || !si.isCap) hasGarments = true;
            if (si.serviceType === 'decc' || si.isCap) hasCaps = true;

            // Update service row price/total cells (reflects overrides)
            const siRow = document.getElementById(`row-${si.rowId}`);
            const siPriceCell = document.getElementById(`row-price-${si.rowId}`);
            const siTotalCell = document.getElementById(`row-total-${si.rowId}`);
            const siHasOverride = siRow && parseFloat(siRow.dataset.sellPrice) > 0;
            if (siPriceCell) {
                if (siHasOverride) {
                    siPriceCell.classList.add('price-overridden');
                    siPriceCell.innerHTML = `<span class="price-override-wrapper">$${escapeHtml(si.unitPrice.toFixed(2))}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${escapeHtml(String(si.rowId))})" title="Clear override">&times;</button></span>`;
                } else {
                    siPriceCell.classList.remove('price-overridden');
                    siPriceCell.textContent = `$${si.unitPrice.toFixed(2)}`;
                }
            }
            if (siTotalCell) {
                siTotalCell.textContent = `$${(si.unitPrice * si.totalQuantity).toFixed(2)}`;
            }
        });

        // Check for laser-patch cap setup fee
        const capEmbType = getCapEmbellishmentType();
        const capHasStyle = document.querySelector('tr[data-style]:not(.child-row) .cap-badge') !== null || hasCaps;
        const showPatchSetup = capEmbType === 'laser-patch' && capHasStyle && embState.capPrimaryLogo.needsSetup;
        // Engine's patchSetupFee is the live Service_Codes GRT-50 value; EMB_DEFAULTS is fallback-only.
        const patchSetupFee = showPatchSetup
            ? (Number.isFinite(embState.pricingCalculator?.patchSetupFee) ? embState.pricingCalculator.patchSetupFee : EMB_DEFAULTS.PATCH_SETUP_FEE)
            : 0;

        // Determine tier based on total quantity
        const tier = totalQty <= 7 ? '1-7' : totalQty <= 23 ? '8-23' : totalQty <= 47 ? '24-47' : totalQty <= 71 ? '48-71' : '72+';

        updatePricingDisplay({
            totalQuantity: totalQty,
            tier: tier,
            subtotal: serviceOnlyTotal,
            ltmFee: 0,
            setupFees: patchSetupFee,
            capSetupFees: patchSetupFee,
            garmentSetupFees: 0,
            hasCaps: hasCaps || capHasStyle,
            hasGarments: hasGarments || serviceOnlyTotal > 0,
            grandTotal: serviceOnlyTotal + patchSetupFee
        });

        // Clear product price cells (not service rows)
        document.querySelectorAll('tr[data-style]:not(.service-product-row) .cell-price').forEach(cell => {
            cell.textContent = '-';
            cell.classList.remove('price-overridden');
        });
        return;
    }

    // Build logo configuration from global state (shared helper)
    const { logoConfigs, allLogos } = buildLogoConfiguration();

    // Show/hide LTM control panel based on quantities
    const garmentQtyForLtm = productList.filter(p => !p.isCap).reduce((s, p) => s + p.totalQuantity, 0);
    const capQtyForLtm = productList.filter(p => p.isCap).reduce((s, p) => s + p.totalQuantity, 0);
    const garmentHasLTM = garmentQtyForLtm > 0 && garmentQtyForLtm <= 7;
    const capHasLTM = capQtyForLtm > 0 && capQtyForLtm <= 7;
    const wouldHaveLTM = garmentHasLTM || capHasLTM;
    const ltmWrapper = document.getElementById('emb-ltm-wrapper');
    if (ltmWrapper) {
        if (wouldHaveLTM) {
            ltmWrapper.style.display = '';
            // Engine's ltmFee is the API-loaded LTM (Service_Codes); 50 is fallback-only.
            const apiLtmFee = Number.isFinite(parseFloat(embState.pricingCalculator?.ltmFee)) ? parseFloat(embState.pricingCalculator.ltmFee) : 50;
            const garmentLtmFee = garmentHasLTM ? apiLtmFee : 0;
            const capLtmFee = capHasLTM ? apiLtmFee : 0;
            const totalLtmFee = garmentLtmFee + capLtmFee;
            // Build label showing which types have LTM
            let feeLabel = 'Small Order Fee';
            if (garmentHasLTM && capHasLTM) {
                feeLabel = `Small Order Fee — Garments ($${apiLtmFee}) + Caps ($${apiLtmFee})`;
            } else if (garmentHasLTM) {
                feeLabel = 'Small Order Fee — Garments';
            } else if (capHasLTM) {
                feeLabel = 'Small Order Fee — Caps';
            }
            // Render panel if not yet rendered, or update fee amount
            if (!document.querySelector('#emb-ltm-panel .ltm-control-panel')) {
                renderLtmControlPanel('emb-ltm-panel', { feeAmount: totalLtmFee, feeLabel: feeLabel });
                initLtmControlListeners('emb-ltm-panel', () => {
                    recalculatePricing();
                    markAsUnsaved();
                });
            } else {
                setLtmControlState('emb-ltm-panel', { feeAmount: totalLtmFee });
                // Update header label for garment/cap changes
                const headerSpan = document.querySelector('#emb-ltm-panel .ltm-control-header span');
                if (headerSpan) headerSpan.textContent = feeLabel;
            }
        } else {
            ltmWrapper.style.display = 'none';
            setLtmControlState('emb-ltm-panel', { enabled: true, displayMode: 'builtin' });
        }
    }

    // Read LTM control state
    const ltmState = getLtmControlState('emb-ltm-panel');
    const ltmEnabled = wouldHaveLTM ? ltmState.enabled : true;
    const ltmDisplayMode = ltmState.displayMode || 'builtin';

    try {
        const pricing = await embState.pricingCalculator.calculateQuote(productList, allLogos, logoConfigs, { ltmEnabled });

        // A newer recalc started while we were awaiting — discard this stale result.
        if (mySeq !== _embRecalcSeq) return;

        // Never render $0.00 on a hard API/config failure — calculateQuote returns {success:false} in that
        // case; surface it instead of silently showing a wrong (zero) price. (review C4 — Erik's #1 rule)
        if (!pricing || pricing.success === false) {
            showToast((pricing && pricing.message) || 'Pricing unavailable — cannot price this quote. Refresh and try again.', 'error', 6000);
            return;
        }

        if (pricing) {
            // Update row prices - match line items to rows by style AND color
            // With different colors per extended size, we now get separate products for each color
            pricing.products.forEach((pp) => {
                const style = pp.product.style;
                const productCatalogColor = pp.product.catalogColor;
                // Match by BOTH style AND catalogColor to handle duplicate styles with different colors
                const parentRow = document.querySelector(`tr[data-style="${style}"][data-catalog-color="${productCatalogColor}"]:not(.child-row)`);

                if (!parentRow) return;

                const rowId = parentRow.dataset.rowId;
                const isParentColor = productCatalogColor === parentRow.dataset.catalogColor;

                if (pp.lineItems.length > 0) {
                    // For products matching the parent's color, update parent row price
                    if (isParentColor) {
                        // Find standard sizes line item (no upcharge)
                        const standardLineItem = pp.lineItems.find(li => !li.hasUpcharge);
                        if (standardLineItem) {
                            const priceCell = document.getElementById(`row-price-${rowId}`);
                            const totalCell = document.getElementById(`row-total-${rowId}`);
                            if (priceCell) {
                                // Display unit price — builtin mode shows LTM in price, separate mode shows base price
                                const displayPrice = (ltmDisplayMode === 'builtin')
                                    ? (standardLineItem.unitPriceWithLTM || standardLineItem.unitPrice || 0)
                                    : (standardLineItem.unitPrice || 0);
                                const hasOverride = parseFloat(parentRow.dataset.sellPrice) > 0;
                                const isNsRow = parentRow.dataset.nonSanmar === 'true';

                                if (isNsRow) {
                                    // Non-SanMar: pencil icon, no clear button (price override IS the price)
                                    priceCell.classList.remove('price-overridden');
                                    priceCell.classList.remove('ns-price-zero');
                                    priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${escapeHtml(String(rowId))})" title="Click to edit price">$${escapeHtml(displayPrice.toFixed(2))} <i class="fas fa-pencil-alt"></i></span>`;
                                } else if (hasOverride) {
                                    priceCell.classList.add('price-overridden');
                                    priceCell.innerHTML = `<span class="price-override-wrapper">$${escapeHtml(displayPrice.toFixed(2))}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${escapeHtml(String(rowId))})" title="Clear override">&times;</button></span>`;
                                } else {
                                    priceCell.classList.remove('price-overridden');
                                    priceCell.textContent = `$${displayPrice.toFixed(2)}`;
                                }

                                // Calculate and display line total
                                if (totalCell) {
                                    // Use parent row's displayed qty (excludes child rows)
                                    // standardLineItem.quantity includes child sizes, which is wrong for parent display
                                    const parentQtyCell = document.getElementById(`row-qty-${rowId}`);
                                    const qty = parseInt(parentQtyCell?.textContent) || 0;
                                    const lineTotal = displayPrice * qty;
                                    totalCell.textContent = qty > 0 ? `$${lineTotal.toFixed(2)}` : '-';
                                }
                            }

                            // Update pricing breakdown in description cell
                            const logoConfig = pp.isCap ? logoConfigs.cap.primary : logoConfigs.garment.primary;

                            // Find AL cost for this row from additionalServices
                            // eslint-disable-next-line eqeqeq -- pre-existing loose compare (string/number rowId — verbatim move)
                            const rowAL = pricing.additionalServices?.find(al => al.rowId == rowId);
                            const lineItemWithAL = {
                                ...standardLineItem,
                                alCost: rowAL ? rowAL.unitPrice : 0
                            };
                            updateRowBreakdown(rowId, pp.product, lineItemWithAL, logoConfig);
                        }
                    }

                    // Update child row prices - match by BOTH size AND color
                    // A child row price only updates if its color matches this product's color
                    pp.lineItems.forEach(li => {
                        // First, try to get size from lineItem.size property (garments have this)
                        // If not available, fall back to parsing description (caps use "3XL(2)" format)
                        let sizesToCheck = [];
                        if (li.size) {
                            sizesToCheck = [li.size];
                        } else {
                            // Match ALL extended sizes in description (handles caps with "3XL(2)" format)
                            const description = li.description || '';
                            const extendedSizeRegex = new RegExp(
                                // 2XL + XXL concat explicitly: both are Size05-column child rows,
                                // deliberately NOT in the Size06 list (Batch 2.0).
                                '(' + SIZE06_EXTENDED_SIZES.map(s => s.replace(/\//g, '\\/')).concat(['2XL', 'XXL', '\\d{4}']).join('|') + ')(?=\\(|\\s|$)',
                                'g'
                            );
                            sizesToCheck = description.match(extendedSizeRegex) || [];
                        }

                        sizesToCheck.forEach(size => {
                            const childRowId = embState.childRowMap[rowId]?.[size];
                            if (childRowId) {
                                const childRow = document.getElementById(`row-${childRowId}`);
                                // Only update price if child row's color matches this product's color
                                if (childRow && childRow.dataset.catalogColor === productCatalogColor) {
                                    const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                                    const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                                    if (childPriceCell) {
                                        // Display unit price — builtin mode shows LTM in price, separate mode shows base price
                                        const displayPrice = (ltmDisplayMode === 'builtin')
                                            ? (li.unitPriceWithLTM || li.unitPrice || 0)
                                            : (li.unitPrice || 0);
                                        // Check parent override (child-specific overrides handled in post-processing)
                                        const childHasOwnOverride = parseFloat(childRow.dataset.sellPrice) > 0;
                                        const hasParentOverride = parseFloat(parentRow.dataset.sellPrice) > 0;
                                        if (hasParentOverride && !childHasOwnOverride) {
                                            childPriceCell.classList.add('price-overridden');
                                        } else if (!childHasOwnOverride) {
                                            childPriceCell.classList.remove('price-overridden');
                                        }
                                        childPriceCell.textContent = `$${displayPrice.toFixed(2)}`;

                                        // Calculate and display line total for child row
                                        if (childTotalCell) {
                                            // Extract quantity for THIS size from description
                                            // Format: "M(3) L(2) XL(1) XS(1)" - parse qty in parentheses after size
                                            const sizeQtyMatch = (li.description || '').match(new RegExp(size + '\\((\\d+)\\)'));
                                            const qty = sizeQtyMatch ? parseInt(sizeQtyMatch[1]) : (li.quantity || 0);
                                            const lineTotal = displayPrice * qty;
                                            childTotalCell.textContent = qty > 0 ? `$${lineTotal.toFixed(2)}` : '-';
                                        }
                                    }
                                }
                            }
                        });
                    });
                }
            });

            // Add service item totals (DECG/DECC) to pricing for mixed orders
            if (serviceItems.length > 0) {
                let serviceTotal = 0;
                serviceItems.forEach(si => {
                    serviceTotal += si.unitPrice * si.totalQuantity;

                    // Update service row price/total cells (reflects overrides)
                    const siRow = document.getElementById(`row-${si.rowId}`);
                    const siPriceCell = document.getElementById(`row-price-${si.rowId}`);
                    const siTotalCell = document.getElementById(`row-total-${si.rowId}`);
                    const siHasOverride = siRow && parseFloat(siRow.dataset.sellPrice) > 0;
                    if (siPriceCell) {
                        if (siHasOverride) {
                            siPriceCell.classList.add('price-overridden');
                            siPriceCell.innerHTML = `<span class="price-override-wrapper">$${escapeHtml(si.unitPrice.toFixed(2))}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${escapeHtml(String(si.rowId))})" title="Clear override">&times;</button></span>`;
                        } else {
                            siPriceCell.classList.remove('price-overridden');
                            siPriceCell.textContent = `$${si.unitPrice.toFixed(2)}`;
                        }
                    }
                    if (siTotalCell) {
                        siTotalCell.textContent = `$${(si.unitPrice * si.totalQuantity).toFixed(2)}`;
                    }
                });
                pricing.subtotal += serviceTotal;
                pricing.grandTotal += serviceTotal;
            }

            // Post-process: per-size price overrides on child rows
            let childOverrideDelta = 0;
            document.querySelectorAll('#product-tbody tr.child-row').forEach(childRow => {
                const childOverride = parseFloat(childRow.dataset.sellPrice) || 0;
                if (childOverride <= 0) return;

                const childRowId = childRow.dataset.rowId;
                const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                const childQtyCell = document.getElementById(`row-qty-${childRowId}`);
                if (!childPriceCell) return;

                // Get the calculated price currently in the cell
                const currentText = childPriceCell.textContent.replace(/[^0-9.]/g, '');
                const calculatedPrice = parseFloat(currentText) || 0;
                const qty = parseInt(childQtyCell?.textContent) || 0;

                // Override display
                childPriceCell.classList.add('price-overridden');
                childPriceCell.innerHTML = `<span class="price-override-wrapper">$${escapeHtml(childOverride.toFixed(2))}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${escapeHtml(String(childRowId))})" title="Clear override">&times;</button></span>`;

                if (childTotalCell && qty > 0) {
                    childTotalCell.textContent = `$${(childOverride * qty).toFixed(2)}`;
                }

                // Track delta for total adjustment
                childOverrideDelta += (childOverride - calculatedPrice) * qty;
            });

            // Adjust totals if child overrides changed prices
            if (childOverrideDelta !== 0) {
                pricing.subtotal += childOverrideDelta;
                pricing.grandTotal += childOverrideDelta;
            }

            updatePricingDisplay(pricing);

            // Price-break ladder: fire-and-forget engine sim → fills in the real
            // $/pc savings on the nudge when it lands (seq-guarded). (2026-06-10)
            computeNudgeSavingsAsync(productList, allLogos, logoConfigs, ltmEnabled, pricing, mySeq);
        }
    } catch (error) {
        console.error('Pricing calculation error:', error);
        showToast('Pricing calculation error. Please try again.', 'error');
    }

    // Mark as dirty for auto-save (2026 consolidation)
    markEmbroideryDirty();
}

export function collectProductsFromTable() {
    const products = [];
    // Only collect from parent rows (not child rows or AL config rows)
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row):not(.al-config-row):not(.fee-row):not(#empty-state-row)');

    rows.forEach(row => {
        const rowId = parseInt(row.id.replace('row-', ''));
        const style = row.dataset.style;

        // Handle SERVICE product rows (DECG, DECC, AL, MONOGRAM, etc.)
        if (row.dataset.productType === 'service') {
            const qtyInput = row.querySelector('.service-qty');
            const quantity = parseFloat(qtyInput?.value) || 0;  // parseFloat → fractional service qty (GRT-75 hours)

            if (quantity > 0) {
                const serviceType = row.dataset.serviceType;
                const isCap = row.dataset.isCap === 'true';
                const stitchCount = parseInt(row.dataset.stitchCount) || 8000;
                const position = row.dataset.position || '';
                // Use sell price override if set (DECG/DECC), otherwise original unit price
                const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
                const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);

                products.push({
                    style: style,
                    isService: true,
                    serviceType: serviceType,
                    position: position,
                    stitchCount: stitchCount,
                    totalQuantity: quantity,
                    sizeBreakdown: { 'SVC': quantity }, // Use SVC as pseudo-size for services
                    isCap: isCap,
                    rowId: rowId,
                    unitPrice: unitPrice,
                    color: '',
                    catalogColor: '',
                    productName: row.querySelector('.service-description')?.textContent || style,
                    title: row.querySelector('.service-description')?.textContent || style
                });
            }
            return; // Skip normal product processing for service rows
        }

        const parentColor = row.dataset.color;
        const parentCatalogColor = row.dataset.catalogColor || '';

        if (!style || !parentColor) {
            console.warn(`[collectProducts] Skipping row ${rowId}: style="${style || ''}", color="${parentColor || ''}"`, row.dataset.importData || '');
            return;
        }

        // Group sizes by color - different colors become separate products
        const colorGroups = {};

        // Initialize parent color group
        colorGroups[parentCatalogColor] = {
            color: parentColor,
            catalogColor: parentCatalogColor,
            sizeBreakdown: {},
            totalQty: 0
        };

        // Collect size inputs from parent row (standard or remapped sizes)
        // IMPORTANT: Exclude .xxxl-picker-btn (shows TOTAL) and .osfa-qty-input (handled separately)
        // Note: For non-standard products (combo, youth, toddler, tall), data-size is remapped
        // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
        const sizeCategory = row.dataset.sizeCategory;
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            if (qty > 0 && size) {
                colorGroups[parentCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[parentCatalogColor].totalQty += qty;
            }
        });

        // Handle OSFA-only products (beanies, caps, bags)
        // OSFA qty is stored in parent row, not child rows
        if (row.dataset.isOsfaOnly === 'true') {
            const osfaQty = parseInt(row.dataset.osfaQty) || 0;
            if (osfaQty > 0) {
                colorGroups[parentCatalogColor].sizeBreakdown['OSFA'] = osfaQty;
                colorGroups[parentCatalogColor].totalQty += osfaQty;
            }
        }

        // Collect extended sizes from CHILD ROWS - GROUP BY COLOR
        // Child rows may have different colors than parent
        // Also collect per-size price overrides from child rows
        const sizeOverrides = {};
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const size = childRow.dataset.extendedSize;
            const childColor = childRow.dataset.color;
            const childCatalogColor = childRow.dataset.catalogColor || '';
            const qtyDisplay = childRow.querySelector('.qty-display');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0 && size) {
                // Initialize color group if different from parent
                if (!colorGroups[childCatalogColor]) {
                    colorGroups[childCatalogColor] = {
                        color: childColor,
                        catalogColor: childCatalogColor,
                        sizeBreakdown: {},
                        totalQty: 0
                    };
                }

                colorGroups[childCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[childCatalogColor].totalQty += qty;

                // Collect per-size price override if set
                const childOverride = parseFloat(childRow.dataset.sellPrice) || 0;
                if (childOverride > 0) {
                    sizeOverrides[size] = childOverride;
                }
            }
        });

        // Create product entry for each color group with quantities
        Object.entries(colorGroups).forEach(([_catalogColor, group]) => {
            if (group.totalQty > 0) {
                const isCap = row.dataset.isCap === 'true';

                // Get global AL config for this product type
                const alConfig = isCap ? embState.globalAL.cap : embState.globalAL.garment;
                const additionalLogos = alConfig.enabled ? [{
                    id: `global-al-${isCap ? 'cap' : 'garment'}`,
                    position: alConfig.position,
                    stitchCount: alConfig.stitchCount,
                    quantity: group.totalQty
                }] : [];

                products.push({
                    style: style,
                    color: group.color,
                    catalogColor: group.catalogColor,
                    productName: row.dataset.productName || style,
                    title: row.dataset.productName || style,  // For invoice PDF description column
                    sizeBreakdown: group.sizeBreakdown,
                    totalQuantity: group.totalQty,
                    isCap: isCap,  // Cap detection for pricing routing
                    rowId: rowId,  // Track row for AL price updates
                    imageUrl: row.dataset.imageUrl || '',  // Image URL for quote view display
                    sellPriceOverride: parseFloat(row.dataset.sellPrice) || 0,  // Non-SanMar fixed sell price
                    sizeOverrides: sizeOverrides,  // Per-size price overrides from child rows (e.g., { '2XL': 27, '3XL': 29 })
                    _swUnitPrice: parseFloat(row.dataset.swUnitPrice) || 0,  // ShopWorks charged price for audit
                    logoAssignments: {
                        primary: { logoId: 'primary', quantity: group.totalQty },
                        additional: additionalLogos
                    }
                });
            }
        });
    });

    // Sort products: garments first, caps last (for consistent pricing display)
    products.sort((a, b) => {
        if (a.isCap === b.isCap) return 0;
        return a.isCap ? 1 : -1; // Garments first, caps last
    });

    return products;
}

export function updatePricingDisplay(pricing) {
    // Failed AL/DECG rows get their Retry button here — this runs AFTER the recalc
    // body has repainted service-row cells, so the button isn't overwritten. (2026-07-07)
    try { renderPriceErrorRetries(); } catch (_) { }
    const totalQty = pricing.totalQuantity || 0;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('subtotal').textContent = `$${((pricing.subtotal || 0) + (pricing.ltmFee || 0)).toFixed(2)}`;
    updatePerUnitPrice((pricing.subtotal || 0) + (pricing.ltmFee || 0), pricing.totalQuantity || 0);
    // Category-aware nudge: EMB caps + garments tier SEPARATELY, so the combined
    // total promised tier breaks that adding the other category could never hit.
    // Savings $/pc arrives async from a real engine simulation (recalculatePricing).
    const nudgeTarget = computeEmbNudgeTarget(pricing.garmentQuantity || 0, pricing.capQuantity || 0);
    updateQuantityNudge(nudgeTarget.qty, 'emb', null, 'quantity-nudge', nudgeTarget.label);
    document.getElementById('grand-total').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;

    // Minimum order warning banner — LTM is assessed PER CATEGORY (garments ≤7 and
    // caps ≤7 independently). Keying off combined qty hid the banner on a 5+5 mixed
    // order that carries TWO $50 fees, and understated when both applied.
    const minWarning = document.getElementById('min-order-warning');
    if (minWarning) {
        const gQ = pricing.garmentQuantity || 0;
        const cQ = pricing.capQuantity || 0;
        const gLtm = gQ > 0 && gQ <= 7;
        const cLtm = cQ > 0 && cQ <= 7;
        minWarning.style.display = (gLtm || cLtm) ? 'flex' : 'none';
        const msgEl = minWarning.querySelector('.min-order-warning-text') || minWarning.querySelector('span') || minWarning;
        const fee = Number.isFinite(parseFloat(embState.pricingCalculator?.ltmFee)) ? parseFloat(embState.pricingCalculator.ltmFee) : 50;
        if (gLtm && cLtm) {
            msgEl.textContent = `Garments (${gQ} pcs) and caps (${cQ} pcs) are each under the 8-piece minimum — two $${fee} small-order fees apply.`;
        } else if (gLtm) {
            msgEl.textContent = `Garments (${gQ} pcs) are under the 8-piece minimum — a $${fee} small-order fee applies.`;
        } else if (cLtm) {
            msgEl.textContent = `Caps (${cQ} pcs) are under the 8-piece minimum — a $${fee} small-order fee applies.`;
        }
    }

    // Update products label based on embellishment type
    const productsLabel = document.getElementById('products-label');
    if (productsLabel) {
        const capEmbType = getCapEmbellishmentType();
        if (capEmbType === 'laser-patch' && pricing.hasCaps && !pricing.hasGarments) {
            // Caps-only laser patch order - show "Products (Laser Patch):"
            productsLabel.textContent = 'Products (Laser Patch):';
        } else {
            // Default - embroidery with stitch count
            productsLabel.textContent = 'Products (Base 8K):';
        }
    }
    // Update the pre-tax subtotal (same as grand-total before tax)
    document.getElementById('pre-tax-subtotal').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;

    // Quantity breakdown for mixed quotes
    const garmentQtyRow = document.getElementById('garment-qty-row');
    const capQtyRow = document.getElementById('cap-qty-row');
    const isMixedQuote = pricing.hasCaps && pricing.hasGarments;

    if (isMixedQuote) {
        garmentQtyRow.style.display = 'flex';
        capQtyRow.style.display = 'flex';
        document.getElementById('garment-qty').textContent = pricing.garmentQuantity || 0;
        document.getElementById('cap-qty').textContent = pricing.capQuantity || 0;
    } else {
        garmentQtyRow.style.display = 'none';
        capQtyRow.style.display = 'none';
    }

    // Tier display - show separate tiers for mixed quotes
    const pricingTierEl = document.getElementById('pricing-tier');
    const garmentTierRow = document.getElementById('garment-tier-row');
    const capTierRow = document.getElementById('cap-tier-row');

    if (isMixedQuote) {
        // Mixed quote - show "Mixed" and separate tier breakdown
        pricingTierEl.textContent = 'Mixed';
        garmentTierRow.style.display = 'flex';
        capTierRow.style.display = 'flex';
        document.getElementById('garment-tier').textContent = pricing.garmentTier || '1-7';
        document.getElementById('cap-tier').textContent = pricing.capTier || '1-7';
    } else if (pricing.hasCaps) {
        // Caps only
        pricingTierEl.textContent = pricing.capTier || '1-7';
        garmentTierRow.style.display = 'none';
        capTierRow.style.display = 'none';
    } else {
        // Garments only or no products
        pricingTierEl.textContent = pricing.garmentTier || pricing.tier || '1-7';
        garmentTierRow.style.display = 'none';
        capTierRow.style.display = 'none';
    }

    // Mixed quote subtotal breakdown (caps + garments)
    const garmentSubtotalRow = document.getElementById('garment-subtotal-row');
    const capSubtotalRow = document.getElementById('cap-subtotal-row');

    if (isMixedQuote) {
        // Show breakdown rows (LTM baked into subtotals)
        garmentSubtotalRow.style.display = 'flex';
        capSubtotalRow.style.display = 'flex';
        document.getElementById('garment-subtotal').textContent = `$${((pricing.garmentSubtotal || 0) + (pricing.garmentLtmFee || 0)).toFixed(2)}`;
        document.getElementById('cap-subtotal').textContent = `$${((pricing.capSubtotal || 0) + (pricing.capLtmFee || 0)).toFixed(2)}`;
    } else if (pricing.hasCaps && !pricing.hasGarments) {
        // Caps only - show just cap breakdown (LTM baked in)
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'flex';
        document.getElementById('cap-subtotal').textContent = `$${((pricing.capSubtotal || 0) + (pricing.capLtmFee || 0)).toFixed(2)}`;
    } else if (pricing.hasGarments && !pricing.hasCaps) {
        // Garments only - hide breakdown rows (default view)
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'none';
    } else {
        // No products
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'none';
    }

    // LTM fee rows: show only in "separate" display mode
    const ltmState = getLtmControlState('emb-ltm-panel');
    const ltmDisplayMode = ltmState.displayMode || 'builtin';
    const ltmEnabled = ltmState.enabled;
    const garmentLtmTableRow = document.getElementById('garment-ltm-table-row');
    const capLtmTableRow = document.getElementById('cap-ltm-table-row');
    if (ltmDisplayMode === 'separate' && ltmEnabled) {
        if (garmentLtmTableRow) {
            const showGarment = (pricing.garmentLtmFee || 0) > 0;
            garmentLtmTableRow.style.display = showGarment ? 'table-row' : 'none';
            if (showGarment) {
                document.getElementById('garment-ltm-unit').textContent = `$${pricing.garmentLtmFee.toFixed(2)}`;
                document.getElementById('garment-ltm-table-total').textContent = `$${pricing.garmentLtmFee.toFixed(2)}`;
            }
        }
        if (capLtmTableRow) {
            const showCap = (pricing.capLtmFee || 0) > 0;
            capLtmTableRow.style.display = showCap ? 'table-row' : 'none';
            if (showCap) {
                document.getElementById('cap-ltm-unit').textContent = `$${pricing.capLtmFee.toFixed(2)}`;
                document.getElementById('cap-ltm-table-total').textContent = `$${pricing.capLtmFee.toFixed(2)}`;
            }
        }
    } else {
        // builtin mode or LTM waived: hide fee rows
        if (garmentLtmTableRow) garmentLtmTableRow.style.display = 'none';
        if (capLtmTableRow) capLtmTableRow.style.display = 'none';
    }

    // Setup (Digitizing) row - table row only (sidebar removed in 2026 refactor)
    const setupFeeTableRow = document.getElementById('setup-fee-table-row');
    const setupFeeUnit = document.getElementById('setup-fee-unit');
    const setupFeeTotal = document.getElementById('setup-fee-total');

    // Check cap embellishment type for label
    const capEmbType = getCapEmbellishmentType();
    const isCapLaserPatch = capEmbType === 'laser-patch';

    if (pricing.setupFees > 0) {
        if (setupFeeTableRow) {
            setupFeeTableRow.style.display = 'table-row';
            // Update label based on what's in quote
            const hasCapSetup = (pricing.capSetupFees || 0) > 0;
            const hasGarmentSetup = (pricing.garmentSetupFees || 0) > 0;
            const setupLabel = setupFeeTableRow.querySelector('.fee-label');
            if (setupLabel) {
                if (hasCapSetup && !hasGarmentSetup && isCapLaserPatch) {
                    setupLabel.innerHTML = '<i class="fas fa-cog"></i> GRT-50 : Laser Patch Setup';
                } else {
                    setupLabel.innerHTML = '<i class="fas fa-cog"></i> Digitizing/Setup Fee';
                }
            }
            if (setupFeeUnit) setupFeeUnit.textContent = `$${pricing.setupFees.toFixed(2)}`;
            if (setupFeeTotal) setupFeeTotal.textContent = `$${pricing.setupFees.toFixed(2)}`;
        }
    } else {
        if (setupFeeTableRow) setupFeeTableRow.style.display = 'none';
    }

    // Additional Stitches fee rows (AS-GARM / AS-CAP)
    // Stitch fees are calculated by the pricing engine and included in grandTotal
    // These rows provide visible feedback to the user
    const garmentStitchFeeRow = document.getElementById('garment-stitch-fee-row');
    const capStitchFeeRow = document.getElementById('cap-stitch-fee-row');

    if (pricing.garmentStitchTotal > 0) {
        if (garmentStitchFeeRow) {
            garmentStitchFeeRow.style.display = 'table-row';
            const garmentQty = pricing.garmentQuantity || 0;
            const unitPrice = garmentQty > 0 ? pricing.garmentStitchTotal / garmentQty : 0;
            document.getElementById('garment-stitch-fee-qty').textContent = garmentQty;
            document.getElementById('garment-stitch-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
            document.getElementById('garment-stitch-fee-total').textContent = `$${pricing.garmentStitchTotal.toFixed(2)}`;
        }
    } else {
        if (garmentStitchFeeRow) garmentStitchFeeRow.style.display = 'none';
    }

    if (pricing.capStitchTotal > 0) {
        if (capStitchFeeRow) {
            capStitchFeeRow.style.display = 'table-row';
            const capQty = pricing.capQuantity || 0;
            const unitPrice = capQty > 0 ? pricing.capStitchTotal / capQty : 0;
            document.getElementById('cap-stitch-fee-qty').textContent = capQty;
            document.getElementById('cap-stitch-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
            document.getElementById('cap-stitch-fee-total').textContent = `$${pricing.capStitchTotal.toFixed(2)}`;
        }
    } else {
        if (capStitchFeeRow) capStitchFeeRow.style.display = 'none';
    }

    // ============================================
    // Additional Logo (AL) fee rows + sidebar display
    // Uses pricing engine's additionalServices — no duplicate calculation
    // ============================================
    const garmentAlFeeRow = document.getElementById('garment-al-fee-row');
    const capAlFeeRow = document.getElementById('cap-al-fee-row');

    // Find garment AL and cap AL from pricing engine results
    const garmentALServices = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && !s.isCap);
    const capALServices = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && s.isCap);

    // Garment AL fee row
    const garmentALTotal = garmentALServices.reduce((sum, s) => sum + s.total, 0);
    if (garmentALTotal > 0 && garmentALServices.length > 0) {
        if (garmentAlFeeRow) {
            garmentAlFeeRow.style.display = 'table-row';
            const garmentALQty = garmentALServices.reduce((sum, s) => sum + s.quantity, 0);
            const garmentALUnitPrice = garmentALQty > 0 ? garmentALTotal / garmentALQty : 0;
            document.getElementById('garment-al-fee-qty').textContent = garmentALQty;
            document.getElementById('garment-al-fee-unit').textContent = `$${garmentALUnitPrice.toFixed(2)}`;
            document.getElementById('garment-al-fee-total').textContent = `$${garmentALTotal.toFixed(2)}`;
        }
    } else {
        if (garmentAlFeeRow) garmentAlFeeRow.style.display = 'none';
    }

    // Cap AL fee row
    const capALTotal = capALServices.reduce((sum, s) => sum + s.total, 0);
    if (capALTotal > 0 && capALServices.length > 0) {
        if (capAlFeeRow) {
            capAlFeeRow.style.display = 'table-row';
            const capALQty = capALServices.reduce((sum, s) => sum + s.quantity, 0);
            const capALUnitPrice = capALQty > 0 ? capALTotal / capALQty : 0;
            document.getElementById('cap-al-fee-qty').textContent = capALQty;
            document.getElementById('cap-al-fee-unit').textContent = `$${capALUnitPrice.toFixed(2)}`;
            document.getElementById('cap-al-fee-total').textContent = `$${capALTotal.toFixed(2)}`;
        }
    } else {
        if (capAlFeeRow) capAlFeeRow.style.display = 'none';
    }

    // Sidebar summary display
    const alContainer = document.getElementById('additional-logos-pricing');
    if (garmentALTotal > 0) {
        const garmentALSideQty = garmentALServices.reduce((sum, s) => sum + s.quantity, 0);
        const garmentALSideUnit = garmentALSideQty > 0 ? garmentALTotal / garmentALSideQty : 0;
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): AL sync rows — internal labels + numeric qty/fees only
        alContainer.innerHTML = `
            <div class="pricing-row al-pricing-row">
                <span class="label"><i class="fas fa-tshirt" style="font-size: 10px; margin-right: 3px;"></i> AL:</span>
                <span class="value">$${garmentALTotal.toFixed(2)}</span>
            </div>
            <div class="pricing-row sub-breakdown">
                <span class="label">$${garmentALSideUnit.toFixed(2)} × ${garmentALSideQty}</span>
                <span class="value sub-value"></span>
            </div>
        `;
    } else {
        alContainer.innerHTML = '';
    }

    const capAlContainer = document.getElementById('cap-additional-logos-pricing');
    if (capALTotal > 0) {
        const capALSideQty = capALServices.reduce((sum, s) => sum + s.quantity, 0);
        const capALSideUnit = capALSideQty > 0 ? capALTotal / capALSideQty : 0;
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): AL sync rows — internal labels + numeric qty/fees only
        capAlContainer.innerHTML = `
            <div class="pricing-row al-pricing-row cap-al">
                <span class="label"><i class="fas fa-hat-cowboy" style="font-size: 10px; margin-right: 3px;"></i> AL-Cap:</span>
                <span class="value">$${capALTotal.toFixed(2)}</span>
            </div>
            <div class="pricing-row sub-breakdown">
                <span class="label">$${capALSideUnit.toFixed(2)} × ${capALSideQty}</span>
                <span class="value sub-value"></span>
            </div>
        `;
    } else {
        capAlContainer.innerHTML = '';
    }

    // ============================================
    // Cap Embellishment Upcharge Fee Row (3D-EMB / Laser Patch)
    // Extracted from per-piece price as separate fee item for ShopWorks
    // ============================================
    const capEmbFeeRow = document.getElementById('cap-embellishment-fee-row');
    const capEmbFeeLabel = document.getElementById('cap-embellishment-fee-label');
    const puffTotal = pricing.puffUpchargePerCap > 0 ? pricing.puffUpchargePerCap * (pricing.capQuantity || 0) : 0;
    const patchTotal = pricing.patchUpchargePerCap > 0 ? pricing.patchUpchargePerCap * (pricing.capQuantity || 0) : 0;
    const capEmbTotal = puffTotal + patchTotal;

    if (capEmbTotal > 0 && capEmbFeeRow) {
        capEmbFeeRow.style.display = 'table-row';
        const capQty = pricing.capQuantity || 0;
        const unitPrice = pricing.puffUpchargePerCap || pricing.patchUpchargePerCap || 0;
        if (capEmbFeeLabel) {
            if (puffTotal > 0) {
                capEmbFeeLabel.textContent = '3D-EMB : 3D Puff Upcharge';
            } else {
                capEmbFeeLabel.textContent = 'Laser Patch : Patch Upcharge';
            }
        }
        document.getElementById('cap-embellishment-fee-qty').textContent = capQty;
        document.getElementById('cap-embellishment-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
        document.getElementById('cap-embellishment-fee-total').textContent = `$${capEmbTotal.toFixed(2)}`;
    } else {
        if (capEmbFeeRow) capEmbFeeRow.style.display = 'none';
    }

    // ============================================
    // Additional Logo Digitizing Fee Rows
    // Digitizing fees are now counted in pricing engine via logoConfigs.additional
    // These display rows show/hide based on globalAL state
    // ============================================
    const garmentAlDigitizingRow = document.getElementById('garment-al-digitizing-row');
    const garmentAlDigitizingPosition = document.getElementById('garment-al-digitizing-position');

    if (embState.globalAL.garment.enabled && embState.globalAL.garment.needsDigitizing && pricing.garmentQuantity > 0) {
        if (garmentAlDigitizingRow) garmentAlDigitizingRow.style.display = 'table-row';
        if (garmentAlDigitizingPosition) garmentAlDigitizingPosition.textContent = 'AL';
    } else {
        if (garmentAlDigitizingRow) garmentAlDigitizingRow.style.display = 'none';
    }

    const capAlDigitizingRow = document.getElementById('cap-al-digitizing-row');
    const capAlDigitizingPosition = document.getElementById('cap-al-digitizing-position');

    if (embState.globalAL.cap.enabled && embState.globalAL.cap.needsDigitizing && pricing.capQuantity > 0) {
        if (capAlDigitizingRow) capAlDigitizingRow.style.display = 'table-row';
        if (capAlDigitizingPosition) capAlDigitizingPosition.textContent = 'AL-Cap';
    } else {
        if (capAlDigitizingRow) capAlDigitizingRow.style.display = 'none';
    }

    // (Additional Logo rows are re-priced from the API on add / qty-change — their
    // dataset.unitPrice is already current here, so they sum in like any service row.)
    // Rush Fee = 25% of the merchandise subtotal — recompute its line item before tax
    syncRushRow();
    // Update tax calculation at the end of pricing display
    updateTaxCalculation();
}

/**
 * Calculate the discountable subtotal consistently across all functions.
 * Includes: products grandTotal + art charge + graphic design + rush fee + sample fees
 * LTM is already baked into grandTotal so no separate LTM addition needed.
 * @returns {{ baseSubtotal: number, additionalCharges: number, discountableSubtotal: number, discount: number, adjustedSubtotal: number }}
 */
export function calculateDiscountableSubtotal() {
    const baseSubtotalText = document.getElementById('grand-total')?.textContent || '$0.00';
    const baseSubtotal = parseFloat(baseSubtotalText.replace(/[$,]/g, '')) || 0;

    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked
        ? (parseFloat(document.getElementById('art-charge')?.value) || 0) : 0;
    const designFee = (parseFloat(document.getElementById('graphic-design-hours')?.value) || 0) * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API, not hardcoded (review C8)
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value) || 0;
    const sampleFee = parseFloat(document.getElementById('sample-fee')?.value) || 0;
    const sampleQty = parseInt(document.getElementById('sample-qty')?.value) || 1;
    const shippingFee = parseFloat(document.getElementById('shipping-fee')?.value) || 0;

    const additionalCharges = artCharge + designFee + rushFee + (sampleFee * sampleQty) + shippingFee;
    const discountableSubtotal = baseSubtotal + additionalCharges;

    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    let discount = 0;
    if (discountType === 'percent') {
        discount = discountableSubtotal * (discountAmount / 100);
    } else {
        discount = discountAmount;
    }

    // Cap discount at subtotal to prevent negative totals
    if (discount > discountableSubtotal && discountableSubtotal > 0) {
        discount = discountableSubtotal;
        showToast('Discount capped at subtotal amount', 'warning');
    }

    return {
        baseSubtotal,
        additionalCharges,
        discountableSubtotal,
        discount,
        adjustedSubtotal: discountableSubtotal - discount
    };
}

// ============================================================
// TAX RATE LOOKUP (WA DOR API)
// ============================================================

/**
 * Show status message in the tax lookup status area
 * @param {string} message - Status text
 * @param {string} type - 'success'|'warning'|'error'|'loading'|'info'
 */
function showTaxStatus(message, type) {
    const el = document.getElementById('tax-lookup-status');
    if (!el) return;

    const colors = {
        success: '#16a34a',
        warning: '#d97706',
        error: '#dc2626',
        loading: '#6366f1',
        info: '#0284c7'
    };

    const icons = {
        success: '<i class="fas fa-check-circle"></i> ',
        warning: '<i class="fas fa-exclamation-triangle"></i> ',
        error: '<i class="fas fa-times-circle"></i> ',
        loading: '<i class="fas fa-spinner fa-spin"></i> ',
        info: '<i class="fas fa-info-circle"></i> '
    };

    el.style.color = colors[type] || '#64748b';
    // eslint-disable-next-line no-unsanitized/property -- icons = internal literal map; message escapeHtml'd (1.4 audit: callers pass literals + DOR API strings)
    el.innerHTML = (icons[type] || '') + escapeHtml(message);
}

// [2026-06-07] Wholesale / reseller toggle (per-order checkbox by the sales tax). ON → zero the tax, uncheck
// include-tax, and flag the order so the ShopWorks push routes it to the Wholesale Sales account (2203). OFF →
// re-enable tax + re-look-up the destination rate. The flag is the ONLY trigger for wholesale — never inferred
// from a $0 rate (a failed lookup must not silently become wholesale → no tax). Erik's #1 rule.
export function toggleWholesale() {
    const cb = document.getElementById('wholesale-checkbox');
    window._isWholesale = !!(cb && cb.checked);
    const incTax = document.getElementById('include-tax');
    const rateInput = document.getElementById('tax-rate-input');
    if (window._isWholesale) {
        if (incTax) incTax.checked = false;
        if (rateInput) rateInput.value = '0';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        if (typeof showTaxStatus === 'function') showTaxStatus('Wholesale / reseller — no tax', 'info');
    } else {
        if (incTax) incTax.checked = true;
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        if (typeof lookupTaxRate === 'function') lookupTaxRate(); // re-fetch the real rate for the ship address
    }
}

/**
 * Look up WA tax rate via DOR API
 * Called on ZIP blur, state change, and manual button click
 */
export async function lookupTaxRate() {
    // P0 (audit 2026-06-06, Erik's #1 rule): during an edit-reload the saved tax rate is restored
    // synchronously, but a pickup quote's onShipMethodChange fires this async lookup, which resolves
    // LATER and would silently overwrite the frozen rate with today's live Milton DOR rate. No-op while
    // restoring — the saved rate stands; the load's finally re-enables live lookups for the rep.
    if (window._restoringQuote) return false;
    // [B8] (audit 2026-06-06): a tax-exempt customer — OR a wholesale/reseller order ([2026-06-07]) — must
    // stay 0% even after a Pickup→Ship toggle re-runs this lookup, else WA tax is silently re-applied. #1 rule.
    if (window._taxExempt || window._isWholesale) {
        const rateInput = document.getElementById('tax-rate-input');
        if (rateInput) rateInput.value = '0';
        const incTax = document.getElementById('include-tax');
        if (incTax) incTax.checked = false;
        updateTaxCalculation();
        showTaxStatus(window._isWholesale ? 'Wholesale / reseller — no tax' : 'Tax Exempt customer — no tax', 'info');
        return false;
    }
    const state = document.getElementById('ship-state').value;
    const zip = document.getElementById('ship-zip').value.trim();
    const city = document.getElementById('ship-city').value.trim();
    const address = document.getElementById('ship-address').value.trim();

    // Non-WA state → 0% tax
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
        return true;
    }

    // Need at least a ZIP code
    if (!zip || zip.length < 5) {
        showTaxStatus('Enter ZIP code to look up rate', 'info');
        return false;
    }

    try {
        showTaxStatus('Looking up tax rate...', 'loading');
        const resp = await fetch(`${API_BASE}/api/tax-rates/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, city, state, zip })
        });
        if (!resp.ok) {
            throw new Error(`API returned ${resp.status}`);
        }
        const data = await resp.json();

        if (!data.success) {
            showTaxStatus(data.error || 'Lookup failed', 'error');
            return false;
        }

        document.getElementById('tax-rate-input').value = data.taxRate;
        updateTaxCalculation();

        if (data.outOfState) {
            showTaxStatus('Out of State — No Tax', 'info');
        } else if (data.fallback) {
            showTaxStatus(`Default rate ${data.taxRate}% (DOR unavailable)`, 'warning');
        } else {
            const locationLabel = city || data.locationCode || 'WA';
            showTaxStatus(`${locationLabel} — ${data.taxRate}% (Account ${data.account})`, 'success');
        }
        return true;
    } catch (err) {
        console.error('[Tax Lookup] Error:', err);
        showTaxStatus('Lookup failed — using current rate', 'error');
        return false;
    }
}

/**
 * Handle state dropdown change
 * If non-WA, set tax to 0%. If WA with ZIP, trigger lookup.
 */
export function onShipStateChange() {
    const state = document.getElementById('ship-state').value;
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
    } else {
        const zip = document.getElementById('ship-zip').value.trim();
        if (zip && zip.length >= 5) {
            lookupTaxRate();
        } else {
            // Reset to WA default
            document.getElementById('tax-rate-input').value = '10.2';
            updateTaxCalculation();
            showTaxStatus('', 'info');
        }
    }
}

/**
 * Handle ZIP code blur — trigger lookup if WA + valid ZIP
 */
export function onShipZipBlur() {
    const state = document.getElementById('ship-state').value;
    const zip = document.getElementById('ship-zip').value.trim();
    if (state === 'WA' && zip.length >= 5) {
        lookupTaxRate();
    }
}

/**
 * Handle ship method dropdown change.
 * When "Customer Pickup" selected, hide address fields and auto-set Milton, WA for tax.
 * When "Other" selected, show custom text input.
 */
export function onShipMethodChange() {
    const method = document.getElementById('ship-method').value;
    const isPickup = method === 'Customer Pickup';
    const carrierWrap = document.getElementById('ship-carrier-wrap');
    const pickupNotice = document.getElementById('pickup-notice');
    const otherInput = document.getElementById('ship-method-other');
    const pickupBtn = document.getElementById('ship-mode-pickup');
    const shipBtn = document.getElementById('ship-mode-ship');

    // Keep the Pickup / Ship-it segmented toggle in sync with the method value
    // (so a programmatic change — load, import, draft restore — repaints it too).
    if (pickupBtn) pickupBtn.classList.toggle('active', isPickup);
    if (shipBtn) shipBtn.classList.toggle('active', !isPickup);
    if (carrierWrap) carrierWrap.style.display = isPickup ? 'none' : '';

    if (isPickup) {
        if (pickupNotice) pickupNotice.style.display = 'block';
        if (otherInput) otherInput.style.display = 'none';
        // Auto-set Milton, WA 98354 + clear estimated freight — but NOT during an edit-reload.
        // P2-7 (audit 2026-06-06): a saved Pickup quote may hold a real ship-to (e.g. an imported OOS
        // address) that restoreEmbOrderShipping just restored; clobbering it to Milton here would wipe it
        // and a Save Revision would persist Milton. Skip the clobber + freight-clear while restoring.
        if (!window._restoringQuote) {
            document.getElementById('ship-address').value = '';
            document.getElementById('ship-city').value = 'Milton';
            document.getElementById('ship-state').value = 'WA';
            document.getElementById('ship-zip').value = '98354';
            // P1-1 (audit 2026-06-06): clear any previously-estimated freight when switching back to Pickup —
            // otherwise phantom freight is billed + taxed + saved as a SHIP line + pushed to cur_Shipping.
            const _pickupShipFee = document.getElementById('shipping-fee');
            if (_pickupShipFee && parseFloat(_pickupShipFee.value) > 0) {
                _pickupShipFee.value = '0';
                if (typeof updateAdditionalCharges === 'function') updateAdditionalCharges();
            }
        }
        lookupTaxRate();
    } else {
        if (pickupNotice) pickupNotice.style.display = 'none';
        // Show/hide the "Other" free-text method input
        if (otherInput) {
            otherInput.style.display = (method === 'Other') ? 'block' : 'none';
        }
    }
    updateShippingSummary();
    renderShipToCard();  // [2026-06-07] refresh the ship-to card on mode/method change
}

/**
 * Pickup / Ship-it segmented toggle (2026-06-02 order-flow redesign).
 * Sets the underlying #ship-method value, then lets onShipMethodChange()
 * render the conditional UI. Switching to Ship restores the last looked-up
 * customer ship-to (stashed in applyContact) so the rep doesn't retype it.
 */
export function setShipMode(mode) {
    const select = document.getElementById('ship-method');
    if (!select) return;
    if (mode === 'pickup') {
        select.value = 'Customer Pickup';
    } else {
        // Leaving pickup → default to UPS Ground (most common carrier)
        const wasPickup = select.value === 'Customer Pickup';
        if (wasPickup) select.value = 'UPS Ground';
        // [2026-06-07] Clear the Milton pickup defaults (onShipMethodChange stamps city=Milton/state=WA/zip=98354
        // for the pickup tax) so they don't masquerade as the ship-to DESTINATION — bug: Pickup→Ship left "Milton"
        // in the city. The rep types the real address, or it's restored from the last customer just below. Guard
        // on _restoringQuote so an edit-reload of a real saved ship-to isn't wiped.
        if (wasPickup && !window._restoringQuote) {
            ['ship-address', 'ship-city', 'ship-state', 'ship-zip'].forEach((id) => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        }
        // Pre-fill the address from the last selected customer, if we have it
        const stash = window._lastCustomerShipTo;
        const zipEl = document.getElementById('ship-zip');
        if (stash && zipEl && !zipEl.value.trim()) {
            const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
            set('ship-address', stash.address);
            set('ship-city', stash.city);
            if (stash.state) { const st = document.getElementById('ship-state'); if (st) st.value = stash.state; }
            set('ship-zip', stash.zip);
        }
    }
    onShipMethodChange();
    // In ship mode, refresh the tax rate for the shown address (if any)
    if (mode === 'ship') {
        const zip = document.getElementById('ship-zip')?.value?.trim();
        if (zip && zip.length >= 5) lookupTaxRate();
    }
}
window.setShipMode = setShipMode;

/**
 * Update the Step-3 shipping summary line from the current shipping state.
 * (2026-06-02 — the shipping editor moved into #shipping-modal; Step 3 and the
 * invoice "Shipping" totals line both open it and show this summary.)
 */
export function updateShippingSummary() {
    const el = document.getElementById('shipping-summary');
    if (!el) return;
    const method = document.getElementById('ship-method')?.value || '';
    const isPickup = method === 'Customer Pickup';
    const rate = (document.getElementById('tax-rate-input')?.value || '').trim();
    const ratePart = rate ? ` · ${rate}% tax` : '';
    if (isPickup) {
        el.textContent = `Customer Pickup — Milton, WA${ratePart}`;
    } else {
        const city = (document.getElementById('ship-city')?.value || '').trim();
        const state = document.getElementById('ship-state')?.value || '';
        const zip = (document.getElementById('ship-zip')?.value || '').trim();
        const loc = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ');
        const m = (method === 'Other')
            ? ((document.getElementById('ship-method-other')?.value || '').trim() || 'Other')
            : method;
        el.textContent = `${m}${loc ? ' — ' + loc : ' — (enter address)'}${ratePart}`;
    }
}
window.updateShippingSummary = updateShippingSummary;

/** Open the shipping editor modal (from the totals line or Step 3). (2026-06-02) */
export function openShippingModal() {
    const m = document.getElementById('shipping-modal');
    if (m) m.classList.add('open');
}
/** Close the shipping modal and refresh the summary + totals. */
export function closeShippingModal() {
    const m = document.getElementById('shipping-modal');
    if (m) m.classList.remove('open');
    updateShippingSummary();
    updateTaxCalculation();
    renderShipToCard();  // [2026-06-07] show the entered ship-to address in the glance band
}
window.openShippingModal = openShippingModal;
window.closeShippingModal = closeShippingModal;

/**
 * Update tax calculation based on toggle state
 * Uses shared calculateDiscountableSubtotal() for consistent discount math
 * Called after pricing updates and when any charge input changes
 */
export function updateTaxCalculation() {
    const includeTax = document.getElementById('include-tax')?.checked ?? true;
    const { adjustedSubtotal } = calculateDiscountableSubtotal();

    const rateInput = document.getElementById('tax-rate-input');
    // parseRatePercent: an empty/cleared input rendered "$NaN" and saved a
    // "Sales Tax (NaN%)" item; 0 stays a valid rate. Same fallback as the save path.
    const taxRate = parseRatePercent(rateInput?.value, 10.2) / 100;

    const taxRow = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalWithTax = document.getElementById('grand-total-with-tax');
    const preTaxSubtotal = document.getElementById('pre-tax-subtotal');

    if (!taxRow || !taxAmountEl || !grandTotalWithTax) return;

    // #pre-tax-subtotal is the CANONICAL full pre-tax amount (products + services
    // + shipping − discount). The save path reads it, so keep it accurate. It is
    // a hidden carrier now; the visible "Subtotal" line below excludes shipping.
    if (preTaxSubtotal) {
        preTaxSubtotal.textContent = '$' + adjustedSubtotal.toFixed(2);
    }

    // Shipping line under the invoice: "Customer Pickup" when picking up,
    // otherwise the shipping charge. (2026-06-02 — totals moved under line items)
    const shippingFee = parseFloat(document.getElementById('shipping-fee')?.value) || 0;
    const isPickup = (document.getElementById('ship-method')?.value === 'Customer Pickup');
    const shipAmtEl = document.getElementById('it-shipping-amt');
    if (shipAmtEl) {
        if (isPickup) {
            shipAmtEl.textContent = 'Customer Pickup';
            shipAmtEl.classList.add('is-pickup');
        } else {
            shipAmtEl.classList.remove('is-pickup');
            if (shippingFee > 0) {
                shipAmtEl.textContent = '$' + shippingFee.toFixed(2);
            } else {
                // No charge entered yet — show the carrier so it doesn't read as "$0.00"
                const m = document.getElementById('ship-method')?.value || '';
                shipAmtEl.textContent = (m === 'Other')
                    ? ((document.getElementById('ship-method-other')?.value || '').trim() || 'Other')
                    : (m || 'Ship');
            }
        }
    }

    // Visible "Subtotal" line = everything pre-tax EXCEPT shipping (shipping is
    // its own line). Subtotal + Shipping = the taxable base (adjustedSubtotal).
    const subtotalDisplay = document.getElementById('invoice-subtotal-display');
    if (subtotalDisplay) subtotalDisplay.textContent = '$' + (adjustedSubtotal - shippingFee).toFixed(2);

    // Sales Tax label shows the effective rate when charged; "(exempt)"/"(not charged)" when $0,
    // and the row stays visible for invoice transparency (best-of-both level-up 2026-06-14).
    const taxLabel = document.getElementById('tax-label');
    const _embRateRaw = (document.getElementById('tax-rate-input')?.value || '').trim();
    if (taxLabel) taxLabel.textContent = (includeTax && parseFloat(_embRateRaw) > 0)
        ? `Sales Tax (${_embRateRaw}%)`
        : ((window._isWholesale || window._taxExempt) ? 'Sales Tax (exempt)' : 'Sales Tax (not charged)');

    if (includeTax) {
        // Round tax BEFORE summing (gotcha rule) — the save path does, so an
        // unrounded sum here could show a grand total 1¢ off the saved one.
        const tax = Math.round(adjustedSubtotal * taxRate * 100) / 100;
        taxAmountEl.textContent = '$' + tax.toFixed(2);
        grandTotalWithTax.textContent = '$' + (adjustedSubtotal + tax).toFixed(2);
    } else {
        // Keep the tax row visible (it holds the re-enable checkbox); zero the amount.
        taxAmountEl.textContent = '$0.00';
        grandTotalWithTax.textContent = '$' + adjustedSubtotal.toFixed(2);
    }

    // Always-visible sidebar TOTAL bar (ux-flow 2026-06-10) — mirrors the invoice
    // grand total so the running price never scrolls out of view while building.
    const sidebarBar = document.getElementById('sidebar-total-bar');
    const sidebarTotal = document.getElementById('sidebar-grand-total');
    if (sidebarBar && sidebarTotal) {
        sidebarTotal.textContent = grandTotalWithTax.textContent;
        sidebarBar.hidden = false;
    }

    // Keep the Step-3 shipping summary's tax-rate in sync after a rate lookup.
    if (typeof updateShippingSummary === 'function') updateShippingSummary();
}

// ── recalculatePricing live binding (verbatim tail statement from the
//    monolith): the reprice pill wraps the impl; `export let` keeps every
//    importer AND the window bridge on the wrapped version. ──────────────
export let recalculatePricing = _recalculatePricingImpl;
if (typeof wrapWithRepricingIndicator === 'function') {
    recalculatePricing = wrapWithRepricingIndicator(_recalculatePricingImpl);
}
