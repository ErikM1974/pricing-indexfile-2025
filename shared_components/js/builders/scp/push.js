/**
 * SCP push-to-ShopWorks module — SCP decomposition S1b (2026-07-08).
 * One-click save+push (push-button-binding locks the single-async-decl rule
 * against THIS file), review/confirm preview, button state. Moved verbatim.
 * Push state (_scpPushQuoteId/_scpPushInFlight) lives on scpState since S2.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global openAccessibleModal, closeAccessibleModal, saveAndGetLink, escapeHtml, showToast,
   renderBuilderPushReadiness, collectProductsFromTable, confirm */
import { scpState } from './state.js';

export function showScpPushButton(quoteId) {
    scpState._scpPushQuoteId = quoteId;
    // The Push button is ALWAYS visible now (disabled-until-ready, EMB parity 2026-06-14); this just
    // records the saved quote id (the /preview endpoint needs it) and re-gates the button.
    if (typeof updateScpPushButtonState === 'function') updateScpPushButtonState();
}

// Always-visible Push button + "Before you push" readiness checklist gate (EMB parity 2026-06-14).
// Uses the shared renderBuilderPushReadiness() (quote-builder-utils.js) — gates: Customer #, ≥1 item,
// customer name, customer email — so the button is enabled only when a push/save can actually succeed.
export function updateScpPushButtonState() {
    if (typeof renderBuilderPushReadiness !== 'function') return;
    renderBuilderPushReadiness({
        btnId: 'scp-push-shopworks-btn',
        hasProducts: () => { try { return collectProductsFromTable().length > 0; } catch (_) { return false; } }
    });
}
// (window bridge moved to builders/scp/index.js)

export async function scpPushToShopWorks() {
    if (scpState._scpPushInFlight) return;                 // re-entrancy guard (a double-click must not save/push twice)
    scpState._scpPushInFlight = true;
    const label = document.getElementById('scp-push-shopworks-label');
    if (label) label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    try {
        // NOTE: do NOT disable the button here — openScpPushPreview() bails if the button is disabled.
        // Gate the push on THIS save's return value — not the persistent _scpPushQuoteId,
        // which survives from an edit-load/earlier save and would let a failed re-save
        // push the previous (stale) revision to ShopWorks.
        const savedId = await saveAndGetLink({ skipShareModal: true });
        if (!savedId) return;                              // this save failed / was blocked (error already shown)
        await openScpPushPreview();
    } finally {
        scpState._scpPushInFlight = false;
        const _b = document.getElementById('scp-push-shopworks-btn');
        // Don't clobber the "Pushed ✓" success label once the push completed.
        if (label && (!_b || _b.dataset.pushed !== '1')) label.textContent = 'Push to ShopWorks';
        updateScpPushButtonState();   // renderBuilderPushReadiness skips re-gating when dataset.pushed==='1'
    }
}
// (window bridge moved to builders/scp/index.js)

// Minimal HTML escaper for preview output (self-contained — no util dependency).
function _scpEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Open the preview-and-confirm modal — parity with EMB's openPushPreview().
// Fetches the exact ExternalOrderJson the backend would push (read-only /preview
// endpoint) so the rep reviews line items, order type and total before the order
// is created. If the modal or preview can't load, falls back to a direct
// confirm()-push so the rep is never blocked.
export async function openScpPushPreview() {
    const btn = document.getElementById('scp-push-shopworks-btn');
    if (!btn || btn.disabled || !scpState._scpPushQuoteId) return;
    // Warn before pushing with no ShopWorks Customer # — the order would silently
    // attach to placeholder customer 3739 instead of the real customer. EMB gates its
    // button on this; SCP/DTF warn at push time for parity. (2026-06-01)
    const _scpCust = document.getElementById('customer-number')?.value?.trim();
    if (!_scpCust && !confirm('No ShopWorks Customer # is set.\n\nThis order will attach to the placeholder customer (3739) instead of the real customer. Continue anyway?')) {
        return;
    }

    const modal = document.getElementById('scp-push-modal');
    const statusEl = document.getElementById('scp-push-status');
    const previewEl = document.getElementById('scp-push-preview');
    const confirmBtn = document.getElementById('scp-push-confirm');
    if (!modal || !previewEl || !confirmBtn) {
        return confirmScpPush(true); // modal markup missing → legacy direct push
    }

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div class="qb-loading-pad">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('show');
    if (typeof openAccessibleModal === 'function') openAccessibleModal(modal, { label: 'Push to ShopWorks preview', onEsc: closeScpPushPreview }); // 1.8

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/scp-push/preview/${encodeURIComponent(scpState._scpPushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderScpPushPreview(data.orderJson || {});
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (err) {
        console.error('[SCP Push] Preview error:', err);
        previewEl.innerHTML = '<div class="qb-err-16">' +
            '<i class="fas fa-exclamation-triangle"></i> Could not load preview: ' + _scpEsc(err.message) +
            '<br><span class="qb-muted">You can still push below.</span></div>';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    }
}

// Render the modal body from the /preview orderJson.
export function renderScpPushPreview(o) {
    const previewEl = document.getElementById('scp-push-preview');
    if (!previewEl) return;
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    const shipping = parseFloat(o.cur_Shipping) || 0;
    const discount = parseFloat(o.TotalDiscounts) || 0;
    const lineSum = lines.reduce((s, l) => s + (parseFloat(l.Price) || 0) * (parseFloat(l.Qty) || 0), 0);
    const preTax = lineSum + shipping - discount;

    let html = '<div class="qb-grid-2col">';
    html += '<div><span class="qb-muted">ShopWorks Order:</span> <strong>' + _scpEsc(o.ExtOrderID || '') + '</strong></div>';
    html += '<div><span class="qb-muted">Order type:</span> <strong>' + _scpEsc(String(o.id_OrderType || '')) + '</strong> <span class="qb-muted">(13 = Screen Print)</span></div>';
    html += '<div><span class="qb-muted">Customer #:</span> ' + _scpEsc(String(o.id_Customer || '')) + '</div>';
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
                '<td class="qb-td--b">' + _scpEsc(l.PartNumber || '') + '</td>' +
                '<td class="qb-td">' + _scpEsc(l.Description || '') + '</td>' +
                '<td class="qb-td--c">' + _scpEsc(l.Size || '') + '</td>' +
                '<td class="qb-td--r">' + _scpEsc(String(l.Qty || '')) + '</td>' +
                '<td class="qb-td--r">$' + (parseFloat(l.Price) || 0).toFixed(2) + '</td></tr>';
        }
    }
    html += '</tbody></table>';
    html += '<div class="qb-total-line">' +
        'Order total (pre-tax): $' + preTax.toFixed(2) + '</div>';
    if (designs.length === 0) {
        html += '<div class="qb-warn-box--mt">' +
            '<i class="fas fa-exclamation-triangle"></i> No design linked — a rep must assign the design + screens in ShopWorks.</div>';
    }
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): preview html built above with _scpEsc on every dynamic value
    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). directFallback=true is the legacy
// path used when the modal couldn't open.
export async function confirmScpPush(directFallback) {
    const mainBtn = document.getElementById('scp-push-shopworks-btn');
    const mainLabel = document.getElementById('scp-push-shopworks-label');
    const confirmBtn = document.getElementById('scp-push-confirm');
    const statusEl = document.getElementById('scp-push-status');
    if (!scpState._scpPushQuoteId) return;

    if (directFallback) {
        if (!confirm(`Push quote ${scpState._scpPushQuoteId} to ShopWorks?\n\nThis creates a new screen print order in OnSite.`)) return;
        if (mainBtn) { mainBtn.disabled = true; mainBtn.style.opacity = '0.6'; }
        if (mainLabel) mainLabel.textContent = 'Pushing...';
    } else if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';
    }

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const response = await fetch(`${apiBase}/api/scp-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: scpState._scpPushQuoteId, isTest: false, force: false }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                if (statusEl) statusEl.innerHTML = '<div class="qb-warn-box">Already pushed to ShopWorks.</div>';
                if (mainLabel) mainLabel.textContent = 'Already Pushed';
                if (mainBtn) mainBtn.style.background = '#28a745';
                if (typeof showToast === 'function') showToast('Already pushed to ShopWorks', 'info');
                closeScpPushPreview();
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // Success
        if (mainLabel) mainLabel.textContent = `Pushed ✓ (${data.extOrderId})`;
        if (mainBtn) { mainBtn.style.background = '#28a745'; mainBtn.disabled = true; mainBtn.dataset.pushed = '1'; }
        if (typeof showToast === 'function') showToast(`Pushed to ShopWorks as ${data.extOrderId}`, 'success');
        console.log('[SCP Push] Success:', data);
        closeScpPushPreview();

    } catch (error) {
        console.error('[SCP Push] Push error:', error);
        if (statusEl) statusEl.innerHTML = '<div class="qb-err-8">Push failed: ' + _scpEsc(error.message) + '</div>';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks'; }
        if (mainBtn) { mainBtn.disabled = false; mainBtn.style.opacity = '1'; }
        if (mainLabel) mainLabel.textContent = 'Push to ShopWorks';
        if (typeof showToast === 'function') showToast(`Push failed: ${error.message}`, 'error');
    }
}

export function closeScpPushPreview() {
    const modal = document.getElementById('scp-push-modal');
    if (modal) modal.classList.remove('show');
    if (typeof closeAccessibleModal === 'function') closeAccessibleModal(modal); // 1.8
}

// NOTE: scpPushToShopWorks (async, auto-save → preview) is declared above near the
// button-state helper and is the ONE bound to window.scpPushToShopWorks + the HTML
// onclick. Do NOT re-declare a back-compat alias here — a second `function
// scpPushToShopWorks()` at module scope hoists OVER the async version, so the button
// would call openScpPushPreview() WITHOUT the auto-save and silently no-op on a
// never-saved quote (_scpPushQuoteId === null). Call openScpPushPreview() directly if
// you need the bare preview. (regression fixed 2026-06-14)

// (window bridges for HTML onclick + cross-file callers moved to builders/scp/index.js)
