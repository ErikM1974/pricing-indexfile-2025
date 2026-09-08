// ShipStation reserves deleted order keys; retry that specific 404 once.
module.exports = function createDelivery({ CASPIO_PROXY_BASE, CRM_API_SECRET, fetch }) {
    return async function deliver(payload) {
        // 9. POST to proxy
        const PROXY_BASE = CASPIO_PROXY_BASE;
        let proxyResp = await fetch(`${PROXY_BASE}/api/shipstation/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
            body: JSON.stringify(payload),
        });
        let result = await proxyResp.json().catch(() => ({}));

        // Retry-on-404: ShipStation returns 404 if the orderKey was previously
        // associated with a deleted order (they reserve the key forever).
        // Salt the orderKey with a millisecond timestamp and retry once.
        if (proxyResp.status === 404 && !payload._retried) {
            console.warn(
                `[send-to-shipstation] 404 on orderKey '${payload.orderKey}' — likely deleted-order ghost. Retrying with salted orderKey.`
            );
            payload.orderKey = `${payload.orderKey}-r${Date.now()}`;
            payload._retried = true;
            proxyResp = await fetch(`${PROXY_BASE}/api/shipstation/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
                body: JSON.stringify(payload),
            });
            result = await proxyResp.json().catch(() => ({}));
        }

        return { proxyResp, result };
    };
};
