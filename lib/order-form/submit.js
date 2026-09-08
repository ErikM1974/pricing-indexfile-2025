// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
const { buildGarmentLines } = require('./garments');
const { appendServiceLines } = require('./services');
const { DESIGN_TYPE_ID, buildArtwork, linkGarmentDesigns } = require('./artwork');
const createOrderNotes = require('./notes');
const { buildManageOrdersPayload } = require('./payload');
const createOrderDrafts = require('./drafts');
const { completeSubmission } = require('./completion');

module.exports = function createOrderSubmission(ctx) {
    const { getCachedSubmitResponse, fetch, CASPIO_PROXY_BASE, CRM_API_SECRET } = ctx;
    const buildNotes = createOrderNotes(ctx);
    const prepareDraft = createOrderDrafts(ctx);
    return async function submitOrderForm(req, res) {
        try {
            const {
                info = {},
                rows = [],
                ship = {},
                orderNotes = '',
                files = [],
                draftId, // present when submitted from a shared customer link
                decoConfig = {}, // form-wide method config from the order form
                breakdown = null, // computed pricing breakdown { byRow: { rowId: {unitPriceBySize, ...} }, subtotal, ... }
                methodNotesBlock = '', // method-specific context (frontend-built)
                printLocations = '', // human-readable print location label (e.g. "Left Chest + Full Back")
                designNumbers = [], // array of design # strings to look up in ShopWorks
                addOns = [], // Phase 2a fee/service add-ons → push as ShopWorks LinesOE entries
                submissionId, // optional client-generated UUID for idempotent retries (audit fix H5)
            } = req.body || {};

            // Normalize any date to YYYY-MM-DD before it flows into the ManageOrders
            // payload (orderDate / requestedShipDate). The order-form date pickers emit
            // YYYY-MM-DD already, but a malformed or MM/DD/YYYY value from any other
            // caller would otherwise pass through raw and the downstream MO date
            // formatter (which splits on '-') renders it "undefined/undefined/<date>"
            // in ShopWorks. Belt-and-suspenders so a bad date can never land in SW.

            // Idempotency check (audit fix H5): if the client retried with the same
            // submissionId within the TTL window, return the cached response instead
            // of allocating a new OF-NNNN + re-pushing. Protects against double-submit
            // on network hiccups despite the frontend's `submitting` guard.
            const idemId = submissionId || req.headers['x-submission-id'] || null;
            if (idemId) {
                const cached = getCachedSubmitResponse(idemId);
                if (cached) {
                    console.log(
                        '[Order Form Submit] ↻ idempotent retry for submissionId',
                        idemId,
                        '→ returning cached response'
                    );
                    return res
                        .status(cached.statusCode || 200)
                        .json({ ...cached.body, idempotentReplay: true });
                }
            }

            if (!info.email && !info.company) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error: 'Missing contact info (email or company required)',
                    });
            }

            // Empty-submit guard — at least one row must have a style (or manualMode) AND qty > 0.
            const hasUsableRow = (rows || []).some((r) => {
                if (!r) return false;
                const hasQty = Object.values(r.sizes || {}).some((v) => Number(v) > 0);
                const hasStyle = !!(r.style && String(r.style).trim());
                const hasManual = !!r.manualMode && Number(r.manualCost) > 0;
                return hasQty && (hasStyle || hasManual);
            });
            if (!hasUsableRow) {
                return res
                    .status(400)
                    .json({ success: false, error: 'No line items with style and quantity' });
            }

            const isDryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

            const draft = await prepareDraft({
                draftId,
                isDryRun,
                info,
                breakdown,
                rows,
                ship,
                orderNotes,
                files,
                decoConfig,
            });
            if (draft.alreadyProcessed) return res.json(draft.alreadyProcessed);
            const { extOrderId, draftPkId } = draft;

            const { lineItems, skippedLines, zeroPriceLines } = buildGarmentLines({
                rows,
                breakdown,
                decoConfig,
                printLocations,
            });

            // B1 reject: any garment line that collapsed to $0 above blocks the
            // whole submit. Rep sees the offending row(s) and fixes the price.
            if (zeroPriceLines.length > 0) {
                const summary = zeroPriceLines
                    .map(
                        (z) =>
                            `${z.style}${z.color ? ` (${z.color})` : ''} ${z.size} × ${z.quantity}`
                    )
                    .join('; ');
                const plural = zeroPriceLines.length === 1;
                console.warn('[Order Form Submit] Rejecting submit — $0 line(s):', summary);
                return res.status(400).json({
                    success: false,
                    error: '$0 line item',
                    details: `${plural ? 'Line' : 'Lines'} ${summary} ${plural ? 'has' : 'have'} no price. Set a price on the row before submitting.`,
                    zeroPriceLines,
                });
            }

            await appendServiceLines({ addOns, breakdown, lineItems }, ctx);

            const methodsUsed = [...new Set(rows.map((r) => r && r.deco).filter(Boolean))];

            // Audit fix M3 (2026-05-21): ShopWorks doesn't allow mixed-method orders
            // — each order routes to a single production queue (id_OrderType). If the
            // rep accidentally mixes DTG + EMB rows, the push would silently land on
            // whichever method wins the methodsUsed[0] race, and the other method's
            // lines arrive at the wrong production queue. Block at submit time with
            // a clear message; rep should split into separate orders.
            if (methodsUsed.length > 1) {
                console.warn(
                    '[Order Form Submit] Mixed-method blocked:',
                    methodsUsed.join(', '),
                    'for',
                    extOrderId
                );
                return res.status(400).json({
                    success: false,
                    error: 'Mixed-method orders not supported',
                    details: `This order has rows with ${methodsUsed.length} different decoration methods (${methodsUsed.join(', ')}). ShopWorks orders can only have ONE decoration method. Please split this into separate orders — one per method.`,
                    methodsUsed,
                });
            }

            // C2 (Erik 2026-05-22): the prior `designTypeId: DESIGN_TYPE_ID[method] || 3`
            // silently fell to design type 3 ("standard" — doesn't exist in ShopWorks's
            // design taxonomy) when method was missing or unrecognized. Result: orders
            // landed in SW with a bogus type and the quote-view rendered "Type: Unknown"
            // on the Designs panel (e.g. OF-0050). Reject at submit time so reps fix
            // the row's method before the order ships off to MO.
            const primaryMethod = methodsUsed[0] || decoConfig?.method || '';
            if (primaryMethod && !DESIGN_TYPE_ID[primaryMethod]) {
                console.warn(
                    '[Order Form Submit] Unmapped method blocked:',
                    primaryMethod,
                    'for',
                    extOrderId
                );
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported decoration method',
                    details: `Method "${primaryMethod}" isn't recognized. Pick one of: ${Object.keys(DESIGN_TYPE_ID).join(', ')}.`,
                    method: primaryMethod,
                });
            }

            const { designs, attachments } = buildArtwork({
                designNumbers,
                files,
                methodsUsed,
                addOns,
                info,
                rows,
                extOrderId,
            });

            const notesBlocks = await buildNotes({
                info,
                breakdown,
                ship,
                extOrderId,
                printLocations,
                rows,
                methodNotesBlock,
                files,
            });

            linkGarmentDesigns(lineItems, designs);

            const manageOrdersPayload = buildManageOrdersPayload(
                {
                    info,
                    extOrderId,
                    methodNotesBlock,
                    rows,
                    lineItems,
                    designs,
                    attachments,
                    ship,
                    notesBlocks,
                    methodsUsed,
                },
                ctx
            );

            console.log(
                '[Order Form Submit] Pushing',
                extOrderId,
                'lines:',
                lineItems.length,
                'designs:',
                designs.length
            );

            // Dry-run short-circuit: returns the payload without pushing. For debugging + smoke tests.
            if (req.query.dryRun === '1' || req.query.dryRun === 'true') {
                console.log('[Order Form Submit] dryRun=1 — not forwarding to ManageOrders');
                return res.json({
                    success: true,
                    mode: 'dry-run',
                    extOrderId,
                    payload: manageOrdersPayload,
                    skippedLines,
                });
            }

            const MANAGEORDERS_API = `${CASPIO_PROXY_BASE}/api/manageorders/orders/create`;
            const response = await fetch(MANAGEORDERS_API, {
                method: 'POST',
                // Secret required since proxy v2026.08.05.9 gated this route.
                headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
                body: JSON.stringify(manageOrdersPayload),
            });
            const result = await response.json().catch(() => ({}));

            return await completeSubmission(
                {
                    response,
                    result,
                    draftPkId,
                    extOrderId,
                    breakdown,
                    rows,
                    decoConfig,
                    info,
                    addOns,
                    idemId,
                    skippedLines,
                },
                res,
                ctx
            );
        } catch (err) {
            console.error('[Order Form Submit] Error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    };
};
