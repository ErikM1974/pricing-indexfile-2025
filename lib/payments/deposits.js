// Payment deposits: explicit shared application dependencies.
module.exports = function create(ctx) {
    const {
        QUOTE_TOTALS_HASH_VERSION,
        TDT_PROXY,
        alertQuotePay,
        computeQuoteTotalsHash,
        fetch,
        resolveTdtTax,
    } = ctx;

    // ══ Online quote-deposit payments (Storefront Checkout Phase 1, 2026-07-05) ══
    // Rep-in-loop model: a rep ENABLES the deposit on an Accepted quote (confirming
    // the shipping $ + tax-rate % that WQ web quotes intentionally save as 0 — see
    // web-quote-service.js "rep calculates tax at confirmation"), the customer pays
    // through Stripe HOSTED Checkout from the quote page, and the shared Stripe
    // webhook records it via the metadata.kind branch. The deposit block + payments
    // array live in the quote's Notes JSON (primary record); the Order_Payments
    // Caspio ledger is a fail-soft mirror. Money math is in the dual-load module
    // below (jest-locked); deposit % comes from Service_Codes DEPOSIT-PCT.
    const QuoteDepositMath = require('../../shared_components/js/quote-deposit-math.js');

    // Append-only Order_Payments ledger mirror via the proxy. FAIL-SOFT: the quote
    // row's Notes JSON is the primary record — a ledger outage must never black-hole
    // a webhook — but every miss is alerted for manual backfill.
    async function recordOrderPayment(entry) {
        try {
            const r = await fetch(`${TDT_PROXY}/api/order-payments/entry`, {
                method: 'POST',
                headers: Object.assign(
                    { 'Content-Type': 'application/json' },
                    process.env.CRM_API_SECRET
                        ? { 'X-CRM-API-Secret': process.env.CRM_API_SECRET }
                        : {}
                ),
                body: JSON.stringify(entry),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        } catch (e) {
            alertQuotePay(
                `${entry.quoteID}: payment RECORDED on the quote but the Order_Payments ledger write failed (${e.message}) — backfill the ledger row manually.`
            );
        }
    }

    // Deposit % — Caspio Service_Codes DEPOSIT-PCT, fail-closed (never a hardcoded
    // percent, Erik's rule). Throws with an Erik-actionable message; callers pick
    // the surface (staff endpoint → 502, pickup auto-enable → fail-soft skip).
    async function getDepositPct() {
        const r = await fetch(`${TDT_PROXY}/api/service-codes?code=DEPOSIT-PCT`);
        if (!r.ok) throw new Error(`HTTP ${r.status} from service-codes`);
        const j = await r.json();
        const codeRow = j && j.data && j.data[0];
        if (!codeRow || !codeRow.IsActive)
            throw new Error('DEPOSIT-PCT missing/inactive in Caspio Service_Codes');
        const pct = parseFloat(codeRow.SellPrice);
        if (!(pct > 0 && pct <= 100))
            throw new Error(`DEPOSIT-PCT SellPrice '${codeRow.SellPrice}' out of range (0-100]`);
        return pct;
    }

    // Pickup skip-the-rep (BAW teardown adoption #2, 2026-07-06 —
    // memory/BAW_CHECKOUT_TEARDOWN_2026-07.md): a pickup order has $0 shipping and
    // the fixed Milton DOR tax rate, so nothing is left for a rep to confirm — the
    // payment link auto-enables AT ACCEPTANCE and the customer can pay in the same
    // sitting. Ship-to orders keep the rep gate (shipping must be quoted).
    // Mutates `notes` with the same deposit block the staff enable-deposit endpoint
    // writes (enabledBy 'auto-pickup'); THROWS on any lookup/math failure — the
    // accept endpoint catches and falls back to plain acceptance (rep enables
    // manually, exactly the pre-existing flow; acceptance itself is never blocked).
    async function autoEnablePickupDeposit(quoteId, row, notes) {
        const depositPct = await getDepositPct();
        // Honour the quote's own taxability. A reseller-permit / tax-exempt customer
        // (Notes.taxable === false) was previously charged Milton WA sales tax anyway,
        // because this always resolved the pickup rate — a real over-charge on a
        // self-serve pay link with no rep in the loop (2026-07-24).
        const taxable = notes && notes.taxable === false ? false : true;
        const tax = taxable
            ? await resolveTdtTax({ deliveryMethod: 'pickup' }) // Milton DOR, same as 3DT pickup
            : { rate: 0 };
        const taxRatePct = Math.round(tax.rate * 100000) / 1000; // decimal (0.102) -> percent (10.2)
        const terms = QuoteDepositMath.computeDepositTerms({
            subtotal: parseFloat(row.TotalAmount),
            shipping: 0,
            taxRatePct,
            depositPct,
        });
        const totalsHash = computeQuoteTotalsHash(
            quoteId,
            terms.subtotal,
            terms.grandTotal,
            terms.depositAmount
        );
        notes.deposit = Object.assign({}, terms, {
            enabled: true,
            totalsHash,
            hashVersion: QUOTE_TOTALS_HASH_VERSION,
            enabledAt: new Date().toISOString(),
            enabledBy: 'auto-pickup',
        });
        return notes.deposit;
    }

    return { QuoteDepositMath, autoEnablePickupDeposit, getDepositPct, recordOrderPayment };
};
