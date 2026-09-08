// Coordinates the tested shipping stages; all failures retain their original HTTP contract.
const prepare = require('./prepare');
const buildPayload = require('./payload');
module.exports = function createSubmit(ctx) {
    const { makeApiRequest, sanitizeFilterInput } = ctx;
    const loadBilling = require('./billing')(ctx);
    const { buildShipStationItems } = require('./items')(ctx);
    const deliver = require('./delivery')(ctx);
    return async (req, res) => {
        try {
            const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

            // 1. Fetch the quote
            const sessions = await makeApiRequest(
                `/quote_sessions?filter=QuoteID='${safeQuoteId}'`
            );
            if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
                return res.status(404).json({ success: false, error: 'Quote not found' });
            }
            const session = sessions[0];
            const pkId = session.PK_ID;

            const prepared = prepare(session, req.body?.overrideShipMethod);
            if (prepared.response) return res.json(prepared.response);
            const billingContact = await loadBilling({
                order: prepared.order,
                originalSubmission: prepared.originalSubmission,
            });
            const items = await buildShipStationItems(
                prepared.lineItems,
                prepared.originalSubmission
            );
            const payload = buildPayload({
                order: prepared.order,
                originalSubmission: prepared.originalSubmission,
                ship: prepared.ship,
                wasOverridden: prepared.wasOverridden,
                origMethod: prepared.origMethod,
                method: prepared.method,
                mapped: prepared.mapped,
                useMapped: prepared.useMapped,
                session,
                safeQuoteId,
                billingContact,
                items,
            });
            const { proxyResp, result } = await deliver(payload);

            if (!proxyResp.ok || !result.success) {
                console.error(`[send-to-shipstation] proxy returned ${proxyResp.status}:`, result);
                return res.status(proxyResp.status || 502).json({
                    success: false,
                    error: result.error || 'ShipStation push failed',
                    details: result.details || null,
                });
            }

            // 10. Write back to Caspio
            const nowIso = new Date().toISOString();
            try {
                await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
                    ShipStation_Order_ID: result.shipstationOrderId,
                    ShipStation_Status: result.orderStatus || 'awaiting_shipment',
                    ShipStation_Last_Synced: nowIso,
                });
            } catch (e) {
                console.warn(
                    `[send-to-shipstation] Caspio PUT failed (order is in ShipStation, but Caspio out of sync):`,
                    e.message
                );
            }

            return res.json({
                success: true,
                shipstationOrderId: result.shipstationOrderId,
                status: result.orderStatus || 'awaiting_shipment',
                lastSynced: nowIso,
            });
        } catch (error) {
            console.error('[send-to-shipstation] unexpected error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
};
