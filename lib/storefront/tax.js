// Storefront tax: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const { TDT_PROXY, fetch } = ctx;

    // Destination tax, server-derived (client value is advisory): pickup → Milton,
    // out-of-state → 0, in-WA → DOR destination lookup. Lookup failure THROWS —
    // checkout fails visibly rather than charging a guessed rate.
    async function resolveTdtTax(customerData) {
        const pickup = customerData.deliveryMethod === 'pickup';
        const state = String(customerData.state || '')
            .trim()
            .toUpperCase();
        if (!pickup && state && state !== 'WA' && state !== 'WASHINGTON') {
            return { rate: 0, account: '2202', accountName: 'Out of State Sales' };
        }
        const body = pickup
            ? { address: '', city: 'Milton', state: 'WA', zip: '98354' }
            : {
                  address: customerData.address1 || '',
                  city: customerData.city || '',
                  state: 'WA',
                  zip: customerData.zip || '',
              };
        const r = await fetch(`${TDT_PROXY}/api/tax-rates/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const j = r.ok ? await r.json() : null;
        if (!j || j.success === false || !Number.isFinite(parseFloat(j.rate))) {
            throw new Error('Sales-tax lookup failed for the shipping address');
        }
        return {
            rate: parseFloat(j.rate),
            account: j.account || null,
            accountName: j.accountName || null,
        };
    }

    return { resolveTdtTax };
};
