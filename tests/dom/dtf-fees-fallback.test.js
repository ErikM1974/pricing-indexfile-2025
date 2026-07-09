/**
 * DTF computeFeesAndTotals empty-field tax fallback — A-grade Batch 1.3 lock.
 *
 * Milton is 10.2% (2026-07-06). The class is now the ONE fee/tax pipeline for
 * screen + save + print, so its fallback IS the quote's fallback: a cleared
 * tax field must price at 10.2, an explicit rate must be honored, and 0 must
 * stay 0 (out-of-state/exempt — never "helpfully" restored to the default).
 */

const path = require('path');

// Pre-bundled by tests/dom/global-setup.js (esbuild cannot run inside jsdom).
const { DTFQuoteBuilder } = require(path.join(__dirname, '.bundles', 'dtf-quote-builder-class.cjs'));

function setDom(rateValue) {
    document.body.innerHTML = `
        <input type="checkbox" id="include-tax" checked>
        <input id="tax-rate-input" value="${rateValue}">
        <input id="art-charge" value="">
        <input id="graphic-design-hours" value="">
        <input id="rush-fee" value="">
        <input id="discount-amount" value="">
        <select id="discount-type"><option value="fixed" selected>fixed</option></select>
        <input id="dtf-shipping-fee" value="">`;
}

function compute(subtotal) {
    return DTFQuoteBuilder.prototype.computeFeesAndTotals.call({ showToast() {} }, { subtotal });
}

beforeEach(() => {
    window.getServicePrice = (code, fallback) => fallback;
    // Same semantics as the shared quote-builder-utils implementation.
    window.parseRatePercent = (v, fb) => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : fb;
    };
});

describe('computeFeesAndTotals tax-rate fallback (Batch 1.3)', () => {
    test('cleared tax field falls back to 10.2 (the page copy said 10.1)', () => {
        setDom('');
        const t = compute(100);
        expect(t.taxRatePct).toBe(10.2);
        expect(t.taxAmount).toBe(10.2);
        expect(t.grandTotal).toBeCloseTo(110.2, 2);
    });

    test('explicit rate honored to the cent', () => {
        setDom('8.8');
        const t = compute(100);
        expect(t.taxRatePct).toBe(8.8);
        expect(t.taxAmount).toBe(8.8);
    });

    test('zero is a VALID rate — never falls back', () => {
        setDom('0');
        const t = compute(100);
        expect(t.taxRatePct).toBe(0);
        expect(t.taxAmount).toBe(0);
        expect(t.grandTotal).toBe(100);
    });

    test('fallback also 10.2 when parseRatePercent is unavailable (inline branch)', () => {
        delete window.parseRatePercent;
        setDom('');
        expect(compute(100).taxRatePct).toBe(10.2);
    });
});
