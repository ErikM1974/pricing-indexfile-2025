// Payment quote-integrity: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { crypto } = ctx;

    // Binds a payment link to the exact numbers the rep enabled. Recomputed from
    // the CURRENT row before every Stripe session and again at the webhook — a rep
    // edit after enablement can never be charged at stale amounts.
    //
    // 🔐 v2 (2026-07-24) is an HMAC. v1 was a bare SHA-256 over
    // quoteID|subtotal|grandTotal|depositAmount — every input of which is visible to
    // (or guessable by) the payer, so anyone could compute a "valid" hash for
    // amounts of their choosing. That is not an integrity check on a link that
    // charges a card.
    //
    // Deposits enabled BEFORE the cutover carry no hashVersion and are still
    // verified with v1, so no rep has to re-enable anything. New deposits are
    // stamped hashVersion:2 and are verified with the HMAC ONLY — accepting either
    // form for a new deposit would leave the v1 forgery open and make this pointless.
    function totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount) {
        return [
            quoteID,
            Number(subtotal).toFixed(2),
            Number(grandTotal).toFixed(2),
            Number(depositAmount).toFixed(2),
        ].join('|');
    }

    const QUOTE_TOTALS_HASH_VERSION = 2;

    function quoteTotalsSecret() {
        return process.env.QUOTE_TOTALS_HMAC_SECRET || process.env.CRM_API_SECRET || '';
    }

    function computeQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount) {
        const secret = quoteTotalsSecret();
        if (!secret) {
            // Fail CLOSED. A missing secret must not silently degrade a money-path
            // integrity check back to a forgeable digest.
            throw new Error(
                'QUOTE_TOTALS_HMAC_SECRET/CRM_API_SECRET not configured — refusing to sign quote totals'
            );
        }
        return crypto
            .createHmac('sha256', secret)
            .update(totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount))
            .digest('hex')
            .slice(0, 16);
    }

    // v1, retained ONLY to verify deposits enabled before the cutover.
    function legacyQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount) {
        return crypto
            .createHash('sha256')
            .update(totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount))
            .digest('hex')
            .slice(0, 16);
    }

    /**
     * Verify a stored deposit's totals-hash against freshly-computed amounts.
     * Picks the algorithm from the deposit's own stamped version — never "try both".
     */
    function totalsHashMatches(dep, quoteID, subtotal, grandTotal, depositAmount) {
        if (!dep || !dep.totalsHash) return false;
        const expected =
            Number(dep.hashVersion) === QUOTE_TOTALS_HASH_VERSION
                ? computeQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount)
                : legacyQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount);
        const a = Buffer.from(String(dep.totalsHash));
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    return { QUOTE_TOTALS_HASH_VERSION, computeQuoteTotalsHash, totalsHashMatches };
};
