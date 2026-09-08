// Billing enrichment is optional; preserve the original submission fallback.
module.exports = function createBilling({ CASPIO_PROXY_BASE, fetch, withProxySecret }) {
    return async function loadBilling({ order, originalSubmission }) {
        // 6. Build the bill-to (CompanyContactsMerge2026 → originalSubmission fallback)
        //    Reuse the billingContact lookup pattern from /full — fetch one-shot here.
        let billingContact = null;
        const idCustomer = order?.id_Customer || originalSubmission?.info?.companyId || null;
        if (idCustomer) {
            try {
                const PROXY_BASE = CASPIO_PROXY_BASE;
                const resp = await fetch(
                    `${PROXY_BASE}/api/company-contacts/by-customer/${encodeURIComponent(idCustomer)}`,
                    { headers: withProxySecret() }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
                    const complete = contacts.find((c) => c.Has_Complete_Address && c.Address);
                    billingContact =
                        complete || contacts.find((c) => c.Address) || contacts[0] || null;
                }
            } catch (e) {
                console.warn(`[send-to-shipstation] billing-contact fetch failed:`, e.message);
            }
        }

        return billingContact;
    };
};
