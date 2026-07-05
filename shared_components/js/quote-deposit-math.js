// quote-deposit-math.js — deposit terms for the online quote-deposit checkout
// (Storefront Checkout Phase 1, 2026-07-05).
//
// PURE dual-environment module (browser + Node, same pattern as
// pages/js/3-day-tees-pricing.js): no DOM, no fetch, no Date. The server is the
// pricing authority — quote-view only uses this for a live PREVIEW while the rep
// types; the stored numbers always come back from the server response.
//
// Money rules (locked by tests/unit/quote-deposit-math.test.js):
//   - WA destination tax applies to (subtotal + shipping) — memory/wa-sales-tax-rules.md
//   - tax is rounded to cents BEFORE summing (memory/common-gotchas.md)
//   - deposit % comes from Caspio Service_Codes `DEPOSIT-PCT`. Callers pass it in;
//     this module never hardcodes it (CLAUDE.md: pricing = API, never hardcoded).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.QuoteDepositMath = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

    // computeDepositTerms({ subtotal, shipping, taxRatePct, depositPct })
    //   subtotal   — quote_sessions.TotalAmount (pre-tax all-in merchandise total)
    //   shipping   — rep-confirmed shipping dollars (0 for pickup)
    //   taxRatePct — rep-confirmed sales-tax rate as a PERCENT (e.g. 10.1; 0 = out of state)
    //   depositPct — Service_Codes DEPOSIT-PCT SellPrice (e.g. 50)
    // Returns the full terms object or THROWS on invalid input (fail-closed:
    // a bad number must never silently become a $0 charge).
    function computeDepositTerms(input) {
        const subtotal = Number(input && input.subtotal);
        const shipping = Number(input && input.shipping);
        const taxRatePct = Number(input && input.taxRatePct);
        const depositPct = Number(input && input.depositPct);
        if (!(subtotal > 0)) throw new Error('subtotal must be a positive number');
        if (!(shipping >= 0)) throw new Error('shipping must be zero or a positive number');
        if (!(taxRatePct >= 0 && taxRatePct <= 15)) throw new Error('taxRatePct out of range (0-15)');
        if (!(depositPct > 0 && depositPct <= 100)) throw new Error('depositPct out of range (0-100]');

        const taxAmount = r2((subtotal + shipping) * (taxRatePct / 100));
        const grandTotal = r2(r2(subtotal) + r2(shipping) + taxAmount);
        const depositAmount = r2(grandTotal * (depositPct / 100));
        const balanceAmount = r2(grandTotal - depositAmount);
        if (!(depositAmount > 0)) throw new Error('computed deposit is not positive');

        return {
            subtotal: r2(subtotal),
            shipping: r2(shipping),
            taxRatePct: taxRatePct,
            taxAmount: taxAmount,
            grandTotal: grandTotal,
            depositPct: depositPct,
            depositAmount: depositAmount,
            balanceAmount: balanceAmount,
        };
    }

    return { computeDepositTerms: computeDepositTerms, r2: r2 };
}));
