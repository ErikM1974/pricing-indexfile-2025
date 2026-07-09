/**
 * DTF page UI module — Batch 4.3 (2026-07-09): the classic dtf-quote-page.js
 * migrated into the bundle. This half: class-delegating shims (extended-size
 * popup, focus, new-quote), tax/fee/shipping renderers (updateTaxCalculation
 * RENDERS computeFeesAndTotals — Batch 1.3 single money source), email, and
 * the save-success modal. Moved verbatim; cross-module calls stay bare globals
 * resolved via the index.js bridges (SCP pattern).
 * (toggleSaveShare was deleted in the move — zero callers anywhere.)
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global dtfQuoteBuilder, updateDtfPushButtonState, autoExpandFeesOnFirstCharge,
   emailQuote, showToast, hasUnsavedChanges, getServicePrice, event */
import { API_BASE } from './state.js';

export function openExtendedSizePopup(productId) {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.openExtendedSizePopup(productId);
    }
}

export function closeExtendedSizePopup() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.closeExtendedSizePopup();
    }
}

export function applyExtendedSizes() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.applyExtendedSizes();
    }
}

export function focusProductSearch() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.focusProductSearch();
    }
}

// ============================================
// TAX CALCULATION & ADDITIONAL CHARGES
// ============================================

export function updateTaxCalculation() {
    // ONE money source (A-grade Batch 1.3): all fee/discount/tax/total math lives in
    // DTFQuoteBuilder.calculateFromState() → computeFeesAndTotals() — the exact pair
    // save + print already use. This function only RENDERS the result. (The page copy
    // previously re-implemented the whole pipeline and drifted: 10.1% empty-field
    // fallback here vs 10.2% in the class — screen vs saved/printed disagreed.)
    const builder = window.dtfQuoteBuilder;
    if (!builder || typeof builder.computeFeesAndTotals !== 'function') return;
    const totals = builder.computeFeesAndTotals(builder.calculateFromState());

    const subtotalEl = document.getElementById('pre-tax-subtotal');
    const taxRowEl = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalEl = document.getElementById('grand-total-with-tax');
    const taxLabel = document.getElementById('tax-rate-label');

    // Pre-tax subtotal display = products + fees − discount + shipping (adjusted amount)
    if (subtotalEl) {
        subtotalEl.textContent = '$' + totals.preTaxSubtotal.toFixed(2);
    }

    // Sales Tax row stays visible for invoice transparency; label shows the rate when charged,
    // "(exempt)"/"(not charged)" when $0 (best-of-both level-up 2026-06-14).
    const _dtfRateRaw = (document.getElementById('tax-rate-input')?.value || '').trim();
    if (taxRowEl) taxRowEl.style.display = 'flex';
    if (taxLabel) taxLabel.textContent = (totals.includeTax && parseFloat(_dtfRateRaw) > 0)
        ? `Sales Tax (${_dtfRateRaw}%)`
        : ((window._isWholesale || window._taxExempt) ? 'Sales Tax (exempt)' : 'Sales Tax (not charged)');
    if (taxAmountEl) taxAmountEl.textContent = '$' + totals.taxAmount.toFixed(2);
    if (grandTotalEl) grandTotalEl.textContent = '$' + totals.grandTotal.toFixed(2);

    // Always-visible sidebar TOTAL bar (EMB parity 2026-06-11) — mirrors the
    // grand total so the running price never scrolls out of view while building.
    const sidebarBar = document.getElementById('sidebar-total-bar');
    const sidebarTotal = document.getElementById('sidebar-grand-total');
    if (sidebarBar && sidebarTotal) {
        sidebarTotal.textContent = grandTotalEl.textContent;
        sidebarBar.hidden = false;
    }

    // [2026-06-08] keep the order-summary band (recap + ship-to card) current on every recalc / tax / fee change
    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
    // Keep the always-visible Push button + readiness checklist in lock-step with product/fee changes.
    try { if (typeof updateDtfPushButtonState === 'function') updateDtfPushButtonState(); } catch (_) {}
}

// toggleAdditionalCharges() moved to quote-builder-utils.js

export function updateAdditionalCharges() {
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const badge = document.getElementById('charges-badge');

    // [2026-06-11] badge now reflects ALL charges (art + design + rush − discount,
    // with a percent discount converted to dollars) — it used to ignore art/design
    // and subtract a percent value as if it were dollars
    const b = window.dtfQuoteBuilder;
    const t = (b && typeof b.computeFeesAndTotals === 'function' && b.currentPricingData)
        ? b.computeFeesAndTotals(b.calculateFromState()) : null;
    const netCharges = t
        ? (t.artCharge + t.graphicDesignCharge + t.rushFee - t.discount)
        : (rushFee - discountAmount);
    if (netCharges !== 0) {
        badge.textContent = (netCharges >= 0 ? '+' : '') + '$' + netCharges.toFixed(2);
        badge.classList.remove('hidden');
        // Phase A: panel is collapsed by default — the first non-zero charge
        // (edit-load, draft restore) pops it open ONCE so fees never load hidden.
        if (typeof autoExpandFeesOnFirstCharge === 'function') autoExpandFeesOnFirstCharge();
    } else {
        badge.classList.add('hidden');
    }

    // Update fee table rows
    updateFeeTableRows();

    // Recalculate tax with new charges
    updateTaxCalculation();
}

// updateDiscountType()/handleDiscountPresetChange()/handleDiscountReasonPresetChange()
// DELETED 2026-07-07 (expert audit): the DTF discount UI was removed 2026-03-23, so
// these page-local copies had zero references in dtf-quote-builder.html and only
// shadowed the shared quote-builder-utils.js versions that EMB/SCP still use.

// ============================================
// TAX LOOKUP & SHIPPING FUNCTIONS
// (Uses API_BASE defined below in ROW-BASED INPUT section)
// ============================================

export async function lookupTaxRate() {
    // [2026-06-08] P0 (#1 rule): a tax-exempt customer or wholesale order stays 0% — do NOT let a ZIP/state change
    // re-apply WA tax (the async DOR result would silently overwrite the 0). Mirror EMB's guard.
    if (window._taxExempt || window._isWholesale) {
        const _ri = document.getElementById('tax-rate-input');
        if (_ri) _ri.value = '0';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        return false;
    }
    const state = document.getElementById('ship-state')?.value || 'WA';
    const zip = document.getElementById('ship-zip')?.value?.trim() || '';
    const city = document.getElementById('ship-city')?.value?.trim() || '';
    const address = document.getElementById('ship-address')?.value?.trim() || '';

    // Non-WA state → 0% tax
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
        return true;
    }

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
        if (!resp.ok) throw new Error(`API returned ${resp.status}`);
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
            showTaxStatus(`${locationLabel} — ${data.taxRate}%`, 'success');
        }
        return true;
    } catch (err) {
        console.error('[Tax Lookup] Error:', err);
        showTaxStatus('Lookup failed — using current rate', 'error');
        return false;
    }
}

export function showTaxStatus(message, type) {
    const el = document.getElementById('tax-lookup-status');
    if (!el) return;
    const colors = { success: '#059669', error: '#dc2626', warning: '#d97706', info: '#64748b', loading: '#2563eb' };
    el.textContent = message;
    el.style.color = colors[type] || '#64748b';
}

export function onShipStateChange() {
    // [2026-06-08] P0 (#1 rule): exempt/wholesale stays 0% — the WA + short-ZIP branch below writes rate 10.2
    // directly (bypassing lookupTaxRate's guard), which would re-tax an exempt order. Guard here too.
    if (window._taxExempt || window._isWholesale) {
        const _ri = document.getElementById('tax-rate-input'); if (_ri) _ri.value = '0';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        return;
    }
    const state = document.getElementById('ship-state')?.value;
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
    } else {
        const zip = document.getElementById('ship-zip')?.value?.trim() || '';
        if (zip.length >= 5) {
            lookupTaxRate();
        } else {
            document.getElementById('tax-rate-input').value = '10.2';
            updateTaxCalculation();
            showTaxStatus('', 'info');
        }
    }
}

// [2026-06-08] Wholesale / reseller toggle (mirror EMB). Per-order checkbox by the sales tax → 0 tax + push GL 2203.
export function toggleWholesale() {
    const cb = document.getElementById('wholesale-checkbox');
    // eslint-disable-next-line no-restricted-syntax -- cross-file contract: _isWholesale is read by computeFeesAndTotals (class) + shared utils (documented contract set, Batch 3.4)
    window._isWholesale = !!(cb && cb.checked);
    const incTax = document.getElementById('include-tax');
    const rateInput = document.getElementById('tax-rate-input');
    if (window._isWholesale) {
        if (incTax) incTax.checked = false;
        if (rateInput) rateInput.value = '0';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
    } else {
        if (incTax) incTax.checked = true;
        if (rateInput) rateInput.value = '10.2';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        if (typeof lookupTaxRate === 'function') lookupTaxRate();  // re-fetch the real rate for the ship address
    }
}

export function onShipZipBlur() {
    const state = document.getElementById('ship-state')?.value || 'WA';
    const zip = document.getElementById('ship-zip')?.value?.trim() || '';
    if (state === 'WA' && zip.length >= 5) {
        lookupTaxRate();
    }
}

export async function dtfEmailQuote() {
    // [2026-06-11] also accept lastSavedQuoteId — a fresh save never set
    // editingQuoteId, so Email Quote was a dead end for never-edited quotes.
    // [2026-07-07 expert audit] save-if-dirty first, like EMB: the /quote link
    // renders the SAVED row, so emailing after an un-saved edit silently sent
    // the customer the OLD prices while the rep read the new ones aloud.
    let quoteId = window.dtfQuoteBuilder?.editingQuoteId || window.dtfQuoteBuilder?.lastSavedQuoteId;
    const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : false;
    if ((!quoteId || dirty) && window.dtfQuoteBuilder?.saveAndGetLink) {
        showToast('Saving quote before emailing…', 'info', 2500);
        await window.dtfQuoteBuilder.saveAndGetLink({ skipShareModal: true });
        quoteId = window.dtfQuoteBuilder?.editingQuoteId || window.dtfQuoteBuilder?.lastSavedQuoteId;
    }
    if (!quoteId) {
        showToast('Please save the quote first before emailing', 'error');
        return;
    }
    await emailQuote({
        quoteId,
        customerEmail: document.getElementById('customer-email')?.value?.trim(),
        customerName: document.getElementById('customer-name')?.value?.trim(),
        salesRepEmail: document.getElementById('sales-rep')?.value
    });
}

export function toggleOrderDetails() {
    const content = document.getElementById('order-details-content');
    const chevron = document.getElementById('order-details-chevron');
    if (content && chevron) {
        content.classList.toggle('hidden');
        chevron.style.transform = content.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0)';
    }
}

// ============================================
// ARTWORK SERVICES FUNCTIONS
// toggleArtworkServices(), toggleArtCharge(), updateArtworkCharges()
// moved to quote-builder-utils.js
// ============================================

export function updateFeeTableRows() {
    // Art charge row
    const artChargeRow = document.getElementById('art-charge-row');
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    if (artChargeRow) {
        if (artChargeToggle?.checked && artCharge > 0) {
            artChargeRow.style.display = 'table-row';
            document.getElementById('art-charge-unit').textContent = '$' + artCharge.toFixed(2);
            document.getElementById('art-charge-total').textContent = '$' + artCharge.toFixed(2);
        } else {
            artChargeRow.style.display = 'none';
        }
    }

    // Graphic design row
    const graphicDesignRow = document.getElementById('graphic-design-row');
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designTotal = designHours * (typeof getServicePrice === 'function' ? getServicePrice('GRT-75', 75) : 75);
    if (graphicDesignRow) {
        if (designHours > 0) {
            graphicDesignRow.style.display = 'table-row';
            document.getElementById('design-hours-label').textContent = designHours;
            document.getElementById('graphic-design-unit').textContent = '$' + designTotal.toFixed(2);
            document.getElementById('graphic-design-total-row').textContent = '$' + designTotal.toFixed(2);
        } else {
            graphicDesignRow.style.display = 'none';
        }
    }

    // Rush fee row
    const rushFeeRow = document.getElementById('rush-fee-row');
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    if (rushFeeRow) {
        if (rushFee > 0) {
            rushFeeRow.style.display = 'table-row';
            document.getElementById('rush-fee-unit').textContent = '$' + rushFee.toFixed(2);
            document.getElementById('rush-fee-total').textContent = '$' + rushFee.toFixed(2);
        } else {
            rushFeeRow.style.display = 'none';
        }
    }

    // Discount row
    const discountRow = document.getElementById('discount-row');
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    if (discountRow) {
        if (discountAmount > 0) {
            discountRow.style.display = 'table-row';
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                // [2026-06-11] same source as the charged totals. The old inline
                // math parsed #ltm-row-total — which shows '(included)' in separate
                // LTM mode → NaN → the row printed '-$NaN' — and double-counted the
                // baked LTM into the discount base vs updateTaxCalculation.
                const b = window.dtfQuoteBuilder;
                const t = (b && typeof b.computeFeesAndTotals === 'function' && b.currentPricingData)
                    ? b.computeFeesAndTotals(b.calculateFromState()) : null;
                if (t) {
                    actualDiscount = t.discount;
                } else {
                    const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '') || 0) || 0;
                    actualDiscount = productsSubtotal * (discountAmount / 100);
                }
            }
            const reasonLabel = document.getElementById('discount-reason-label');
            if (reasonLabel) {
                let labelParts = [];
                if (discountType === 'percent') {
                    labelParts.push(`${discountAmount}%`);
                }
                if (discountReason) {
                    labelParts.push(discountReason);
                }
                reasonLabel.textContent = labelParts.length > 0 ? `(${labelParts.join(' - ')})` : '';
            }
            document.getElementById('discount-unit').textContent = '-$' + actualDiscount.toFixed(2);
            document.getElementById('discount-total').textContent = '-$' + actualDiscount.toFixed(2);
        } else {
            discountRow.style.display = 'none';
        }
    }
}


// ============================================
// New Quote Functionality (UX Improvement)
// ============================================

/**
 * Wrapper function for header button - calls class method
 */
export function confirmNewQuote() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.confirmNewQuote();
    }
}

// ============================================================
// ROW-BASED INPUT FUNCTIONS (Match other quote builders)
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
export function showSaveModal(quoteId) {
    const url = `${window.location.origin}/quote/${quoteId}`;
    document.getElementById('saved-quote-id').textContent = quoteId;
    document.getElementById('shareable-url').value = url;
    document.getElementById('save-success-modal').style.display = 'flex';
}

export function closeSaveModal() {
    document.getElementById('save-success-modal').style.display = 'none';
}

export function copyShareableUrl() {
    const urlInput = document.getElementById('shareable-url');
    urlInput.select();
    document.execCommand('copy');

    // Visual feedback
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
     
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.style.background = '#28a745';
    setTimeout(() => {
        // eslint-disable-next-line no-unsanitized/property -- self-restore of markup captured from this element
        btn.innerHTML = originalHTML;
        btn.style.background = '';
    }, 2000);
}

// Close modal on backdrop click
document.getElementById('save-success-modal').addEventListener('click', function(e) {
    if (e.target === this) closeSaveModal();
});

