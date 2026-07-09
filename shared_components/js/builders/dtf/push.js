/**
 * DTF push-to-ShopWorks module — DTF decomposition D1 (2026-07-08).
 * One-click save+push (push-button-binding locks the single-async-decl rule
 * against THIS file), review/confirm preview, button state. Moved verbatim.
 * Push state (_dtfPushQuoteId/_dtfPushInFlight) lives on dtfState since D2.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global openAccessibleModal, closeAccessibleModal, dtfQuoteBuilder, escapeHtml, showToast, renderBuilderPushReadiness, confirm */
import { dtfState } from './state.js';

export function showDtfPushButton(quoteId) {
    dtfState._dtfPushQuoteId = quoteId;
    // The Push button is ALWAYS visible now (disabled-until-ready, EMB parity 2026-06-14); this just
    // records the saved quote id (the /preview endpoint needs it) and re-gates the button.
    if (typeof updateDtfPushButtonState === 'function') updateDtfPushButtonState();
}

// Always-visible Push button + "Before you push" readiness checklist gate (EMB parity 2026-06-14).
// Shared renderBuilderPushReadiness() (quote-builder-utils.js) — gates: Customer #, ≥1 item, name, email.
export function updateDtfPushButtonState() {
    if (typeof renderBuilderPushReadiness !== 'function') return;
    renderBuilderPushReadiness({
        btnId: 'dtf-push-shopworks-btn',
        hasProducts: () => { try { return !!(window.dtfQuoteBuilder && dtfQuoteBuilder.getTotalQuantity() > 0); } catch (_) { return false; } }
    });
}
// (window bridge moved to builders/dtf/index.js)

export async function dtfPushToShopWorks() {
    if (dtfState._dtfPushInFlight) return;
    dtfState._dtfPushInFlight = true;
    const label = document.getElementById('dtf-push-shopworks-label');
    if (label) label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    try {
        // Do NOT disable the button — openDtfPushPreview() bails if the button is disabled.
        // Gate on THIS save's return value, not the persistent _dtfPushQuoteId (which
        // survives an edit-load and would push a stale revision if this re-save failed).
        const savedId = await dtfQuoteBuilder.saveAndGetLink({ skipShareModal: true });
        if (!savedId) return;
        await openDtfPushPreview();
    } finally {
        dtfState._dtfPushInFlight = false;
        const _b = document.getElementById('dtf-push-shopworks-btn');
        // Don't clobber the "Pushed ✓" success label once the push completed.
        if (label && (!_b || _b.dataset.pushed !== '1')) label.textContent = 'Push to ShopWorks';
        updateDtfPushButtonState();   // renderBuilderPushReadiness skips re-gating when dataset.pushed==='1'
    }
}
// (window bridge moved to builders/dtf/index.js)

// Minimal HTML escaper for preview output (self-contained — no util dependency).
function _dtfEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Open the preview-and-confirm modal — parity with EMB/SCP's openScpPushPreview().
// Fetches the exact ExternalOrderJson the backend would push (read-only /preview
// endpoint) so the rep reviews line items, order type and total before the order
// is created. If the modal or preview can't load, falls back to a direct
// confirm()-push so the rep is never blocked.
export async function openDtfPushPreview() {
    const btn = document.getElementById('dtf-push-shopworks-btn');
    if (!btn || btn.disabled || !dtfState._dtfPushQuoteId) return;
    // Warn before pushing with no ShopWorks Customer # — the order would silently
    // attach to placeholder customer 3739 instead of the real customer. EMB gates its
    // button on this; SCP/DTF warn at push time for parity. (2026-06-01)
    const _dtfCust = document.getElementById('customer-number')?.value?.trim();
    if (!_dtfCust && !confirm('No ShopWorks Customer # is set.\n\nThis order will attach to the placeholder customer (3739) instead of the real customer. Continue anyway?')) {
        return;
    }

    const modal = document.getElementById('dtf-push-modal');
    const statusEl = document.getElementById('dtf-push-status');
    const previewEl = document.getElementById('dtf-push-preview');
    const confirmBtn = document.getElementById('dtf-push-confirm');
    if (!modal || !previewEl || !confirmBtn) {
        return confirmDtfPush(true); // modal markup missing → legacy direct push
    }

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div class="qb-loading-pad">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('show');
    if (typeof openAccessibleModal === 'function') openAccessibleModal(modal, { label: 'Push to ShopWorks preview', onEsc: closeDtfPushPreview }); // 1.8

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/dtf-push/preview/${encodeURIComponent(dtfState._dtfPushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderDtfPushPreview(data.orderJson || {});
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (err) {
        console.error('[DTF Push] Preview error:', err);
        previewEl.innerHTML = '<div class="qb-err-16">' +
            '<i class="fas fa-exclamation-triangle"></i> Could not load preview: ' + _dtfEsc(err.message) +
            '<br><span class="qb-muted">You can still push below.</span></div>';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    }
}

// Render the modal body from the /preview orderJson.
export function renderDtfPushPreview(o) {
    const previewEl = document.getElementById('dtf-push-preview');
    if (!previewEl) return;
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    const shipping = parseFloat(o.cur_Shipping) || 0;
    const discount = parseFloat(o.TotalDiscounts) || 0;
    const lineSum = lines.reduce((s, l) => s + (parseFloat(l.Price) || 0) * (parseFloat(l.Qty) || 0), 0);
    const preTax = lineSum + shipping - discount;

    let html = '<div class="qb-grid-2col">';
    html += '<div><span class="qb-muted">ShopWorks Order:</span> <strong>' + _dtfEsc(o.ExtOrderID || '') + '</strong></div>';
    html += '<div><span class="qb-muted">Order type:</span> <strong>' + _dtfEsc(String(o.id_OrderType || '')) + '</strong> <span class="qb-muted">(18 = Transfers)</span></div>';
    html += '<div><span class="qb-muted">Customer #:</span> ' + _dtfEsc(String(o.id_Customer || '')) + '</div>';
    html += '<div><span class="qb-muted">Designs:</span> ' + designs.length + '</div>';
    html += '</div>';

    html += '<table class="qb-table-13">';
    html += '<thead><tr class="qb-th">' +
        '<th class="qb-td">Part</th><th class="qb-td">Description</th>' +
        '<th class="qb-td--c">Size</th><th class="qb-td--r">Qty</th>' +
        '<th class="qb-td--r">Price</th></tr></thead><tbody>';
    if (lines.length === 0) {
        html += '<tr><td colspan="5" class="qb-err-8">No line items</td></tr>';
    } else {
        for (const l of lines) {
            html += '<tr class="qb-row-line">' +
                '<td class="qb-td--b">' + _dtfEsc(l.PartNumber || '') + '</td>' +
                '<td class="qb-td">' + _dtfEsc(l.Description || '') + '</td>' +
                '<td class="qb-td--c">' + _dtfEsc(l.Size || '') + '</td>' +
                '<td class="qb-td--r">' + _dtfEsc(String(l.Qty || '')) + '</td>' +
                '<td class="qb-td--r">$' + (parseFloat(l.Price) || 0).toFixed(2) + '</td></tr>';
        }
    }
    html += '</tbody></table>';
    html += '<div class="qb-total-line">' +
        'Order total (pre-tax): $' + preTax.toFixed(2) + '</div>';
    if (designs.length === 0) {
        html += '<div class="qb-warn-box--mt">' +
            '<i class="fas fa-exclamation-triangle"></i> No design linked — a rep must assign the design in ShopWorks.</div>';
    }
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): preview html built above with _dtfEsc on every dynamic value
    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). directFallback=true is the legacy
// path used when the modal couldn't open.
export async function confirmDtfPush(directFallback) {
    const mainBtn = document.getElementById('dtf-push-shopworks-btn');
    const mainLabel = document.getElementById('dtf-push-shopworks-label');
    const confirmBtn = document.getElementById('dtf-push-confirm');
    const statusEl = document.getElementById('dtf-push-status');
    if (!dtfState._dtfPushQuoteId) return;

    if (directFallback) {
        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const companyName = document.getElementById('company-name')?.value?.trim() || '';
        const displayName = companyName || customerName || 'N/A';
        if (!confirm(
            `Push to ShopWorks?\n\nQuote: ${dtfState._dtfPushQuoteId}\nCustomer: ${displayName}\n\n` +
            `This creates a new DTF order in ShopWorks OnSite with the products, sizes, charges, and ship-to from this quote.`
        )) return;
        if (mainBtn) { mainBtn.disabled = true; mainBtn.style.opacity = '0.6'; }
        if (mainLabel) mainLabel.textContent = 'Pushing...';
    } else if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';
    }

    const notifyToast = (msg, type) => {
        if (typeof showToast === 'function') showToast(msg, type);
        else if (dtfQuoteBuilder?.showToast) dtfQuoteBuilder.showToast(msg, type);
    };

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const response = await fetch(`${apiBase}/api/dtf-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: dtfState._dtfPushQuoteId, isTest: false, force: false }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                if (statusEl) statusEl.innerHTML = '<div class="qb-warn-box">Already pushed to ShopWorks.</div>';
                if (mainLabel) mainLabel.textContent = 'Already Pushed';
                if (mainBtn) mainBtn.style.background = '#28a745';
                notifyToast('Already pushed to ShopWorks', 'info');
                closeDtfPushPreview();
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // Success
        if (mainLabel) mainLabel.textContent = `Pushed ✓ (${data.extOrderId})`;
        if (mainBtn) { mainBtn.style.background = '#28a745'; mainBtn.disabled = true; mainBtn.dataset.pushed = '1'; }
        notifyToast(`Pushed to ShopWorks as ${data.extOrderId}`, 'success');
        console.log('[DTF Push] Success:', data);
        closeDtfPushPreview();

    } catch (error) {
        console.error('[DTF Push] Push error:', error);
        if (statusEl) statusEl.innerHTML = '<div class="qb-err-8">Push failed: ' + _dtfEsc(error.message) + '</div>';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks'; }
        if (mainBtn) { mainBtn.disabled = false; mainBtn.style.opacity = '1'; }
        if (mainLabel) mainLabel.textContent = 'Push to ShopWorks';
        notifyToast(`Push failed: ${error.message}`, 'error');
    }
}

export function closeDtfPushPreview() {
    const modal = document.getElementById('dtf-push-modal');
    if (modal) modal.classList.remove('show');
    if (typeof closeAccessibleModal === 'function') closeAccessibleModal(modal); // 1.8
}

// NOTE: dtfPushToShopWorks (async, auto-save → preview) is declared above near the
// button-state helper and is the ONE bound to window.dtfPushToShopWorks + the HTML
// onclick. Do NOT re-declare a back-compat alias here — a second `function
// dtfPushToShopWorks()` at module scope hoists OVER the async version, so the button
// would call openDtfPushPreview() WITHOUT the auto-save and silently no-op on a
// never-saved quote (_dtfPushQuoteId === null). Call openDtfPushPreview() directly if
// you need the bare preview. (regression fixed 2026-06-14)

// (window bridges for HTML onclick + cross-file callers moved to builders/dtf/index.js)
