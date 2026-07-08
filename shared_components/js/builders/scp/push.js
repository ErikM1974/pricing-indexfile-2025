/**
 * SCP push-to-ShopWorks module — SCP decomposition S1b (2026-07-08).
 * One-click save+push (push-button-binding locks the single-async-decl rule
 * against THIS file), review/confirm preview, button state. Moved verbatim.
 * _scpPushQuoteId/_scpPushInFlight stay in the shell until S2 state.js.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global _scpPushQuoteId:writable, _scpPushInFlight:writable,
   saveAndGetLink, editingQuoteId, escapeHtml, showToast, API_BASE,
   renderBuilderPushReadiness, collectProductsFromTable, confirm */

export function showScpPushButton(quoteId) {
    _scpPushQuoteId = quoteId;
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
    if (_scpPushInFlight) return;                 // re-entrancy guard (a double-click must not save/push twice)
    _scpPushInFlight = true;
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
        _scpPushInFlight = false;
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
    if (!btn || btn.disabled || !_scpPushQuoteId) return;
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
    previewEl.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('show');

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/scp-push/preview/${encodeURIComponent(_scpPushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderScpPushPreview(data.orderJson || {});
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (err) {
        console.error('[SCP Push] Preview error:', err);
        previewEl.innerHTML = '<div style="padding:16px; color:#b91c1c;">' +
            '<i class="fas fa-exclamation-triangle"></i> Could not load preview: ' + _scpEsc(err.message) +
            '<br><span style="color:#64748b;">You can still push below.</span></div>';
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

    let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:13px;">';
    html += '<div><span style="color:#64748b;">ShopWorks Order:</span> <strong>' + _scpEsc(o.ExtOrderID || '') + '</strong></div>';
    html += '<div><span style="color:#64748b;">Order type:</span> <strong>' + _scpEsc(String(o.id_OrderType || '')) + '</strong> <span style="color:#64748b;">(13 = Screen Print)</span></div>';
    html += '<div><span style="color:#64748b;">Customer #:</span> ' + _scpEsc(String(o.id_Customer || '')) + '</div>';
    html += '<div><span style="color:#64748b;">Designs:</span> ' + designs.length + '</div>';
    html += '</div>';

    html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<thead><tr style="text-align:left; border-bottom:1px solid #e5e7eb; color:#64748b;">' +
        '<th style="padding:4px;">Part</th><th style="padding:4px;">Description</th>' +
        '<th style="padding:4px; text-align:center;">Size</th><th style="padding:4px; text-align:right;">Qty</th>' +
        '<th style="padding:4px; text-align:right;">Price</th></tr></thead><tbody>';
    if (lines.length === 0) {
        html += '<tr><td colspan="5" style="padding:8px; color:#b91c1c;">No line items</td></tr>';
    } else {
        for (const l of lines) {
            html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="padding:4px; font-weight:600;">' + _scpEsc(l.PartNumber || '') + '</td>' +
                '<td style="padding:4px;">' + _scpEsc(l.Description || '') + '</td>' +
                '<td style="padding:4px; text-align:center;">' + _scpEsc(l.Size || '') + '</td>' +
                '<td style="padding:4px; text-align:right;">' + _scpEsc(String(l.Qty || '')) + '</td>' +
                '<td style="padding:4px; text-align:right;">$' + (parseFloat(l.Price) || 0).toFixed(2) + '</td></tr>';
        }
    }
    html += '</tbody></table>';
    html += '<div style="text-align:right; margin-top:10px; font-size:14px; font-weight:700;">' +
        'Order total (pre-tax): $' + preTax.toFixed(2) + '</div>';
    if (designs.length === 0) {
        html += '<div style="margin-top:10px; padding:8px 10px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:12px; color:#92400e;">' +
            '<i class="fas fa-exclamation-triangle"></i> No design linked — a rep must assign the design + screens in ShopWorks.</div>';
    }
    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). directFallback=true is the legacy
// path used when the modal couldn't open.
export async function confirmScpPush(directFallback) {
    const mainBtn = document.getElementById('scp-push-shopworks-btn');
    const mainLabel = document.getElementById('scp-push-shopworks-label');
    const confirmBtn = document.getElementById('scp-push-confirm');
    const statusEl = document.getElementById('scp-push-status');
    if (!_scpPushQuoteId) return;

    if (directFallback) {
        if (!confirm(`Push quote ${_scpPushQuoteId} to ShopWorks?\n\nThis creates a new screen print order in OnSite.`)) return;
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
            body: JSON.stringify({ quoteId: _scpPushQuoteId, isTest: false, force: false }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:6px;">Already pushed to ShopWorks.</div>';
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
        if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#b91c1c;">Push failed: ' + _scpEsc(error.message) + '</div>';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks'; }
        if (mainBtn) { mainBtn.disabled = false; mainBtn.style.opacity = '1'; }
        if (mainLabel) mainLabel.textContent = 'Push to ShopWorks';
        if (typeof showToast === 'function') showToast(`Push failed: ${error.message}`, 'error');
    }
}

export function closeScpPushPreview() {
    const modal = document.getElementById('scp-push-modal');
    if (modal) modal.classList.remove('show');
}

// NOTE: scpPushToShopWorks (async, auto-save → preview) is declared above near the
// button-state helper and is the ONE bound to window.scpPushToShopWorks + the HTML
// onclick. Do NOT re-declare a back-compat alias here — a second `function
// scpPushToShopWorks()` at module scope hoists OVER the async version, so the button
// would call openScpPushPreview() WITHOUT the auto-save and silently no-op on a
// never-saved quote (_scpPushQuoteId === null). Call openScpPushPreview() directly if
// you need the bare preview. (regression fixed 2026-06-14)

// (window bridges for HTML onclick + cross-file callers moved to builders/scp/index.js)
