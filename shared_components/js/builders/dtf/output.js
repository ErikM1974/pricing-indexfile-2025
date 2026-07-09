/**
 * DTF output module — DTF decomposition D1 (2026-07-08).
 * HTML-onclick wrappers (copyToClipboard/printQuote →
 * class methods) + the "auto %" rush chip. Moved verbatim.
 */
/* global dtfQuoteBuilder, showToast, getSharedRushRate, Event */

// Global function wrappers for HTML onclick handlers
export function copyToClipboard() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.copyQuoteToClipboard();
    }
}
// Legacy alias

export function printQuote() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.printQuote();
    }
}

/**
 * "auto %" rush chip (old-audit P2, 2026-07-07) — see the SCP twin. Base =
 * products + art + design (the terms DTF's own % discount uses, excluding
 * rush itself), from the SAME state math save/print use.
 */
export function applyRushPercent() {
    const b = window.dtfQuoteBuilder;
    if (!b || !b.currentPricingData || !b.pricingCalculator) { showToast('Add products first — rush is a % of the quote.', 'info'); return; }
    const rate = (typeof getSharedRushRate === 'function') ? getSharedRushRate() : 0.25;
    const t = b.computeFeesAndTotals(b.calculateFromState());
    const base = (t.subtotal || 0) + (t.artCharge || 0) + (t.graphicDesignCharge || 0);
    if (!(base > 0)) { showToast('Add products first — rush is a % of the quote.', 'info'); return; }
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'));
    if (!el) return;
    el.value = (base * rate).toFixed(2);
    el.dispatchEvent(new Event('change', { bubbles: true }));   // runs updateAdditionalCharges()
    showToast(`Rush set to ${(rate * 100).toFixed(0)}% of $${base.toFixed(2)} — adjust if needed; re-click if the quote changes.`, 'success');
}
