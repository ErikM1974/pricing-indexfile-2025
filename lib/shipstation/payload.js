// Compose the warehouse payload from the selected snapshot, contacts and enriched items.
module.exports = function buildPayload({
    session,
    order,
    safeQuoteId,
    originalSubmission,
    ship,
    items,
    billingContact,
    wasOverridden,
    origMethod,
    method,
    mapped,
    useMapped,
}) {
    // 8. Compose the payload.
    //
    // orderNumber vs orderKey (Erik 2026-05-21):
    //   orderNumber = displayed in ShipStation UI as "Order #" → use WO#
    //                 when known so warehouse cross-references with ShopWorks
    //                 ("pull WO 141899") instead of our internal quote ID.
    //                 Falls back to quote ID until WO# is synced.
    //   orderKey = internal idempotency key → ALWAYS the quote ID so re-sends
    //              dedup correctly. Salted by retry-on-404 logic above when
    //              ShipStation ghosts a deleted-order key.
    const shopworksWoNum = session.ShopWorks_Order_Number || order?.id_Order;
    const displayOrderNumber = shopworksWoNum ? `WO ${shopworksWoNum}` : safeQuoteId;

    // Weight per item — REAL SanMar PIECE_WEIGHT when buildShipStationItems
    // attached it (via /api/inventory lookup), with a hardcoded prefix-based
    // fallback for SKUs SanMar doesn't recognize or where the lookup failed.
    // Sum × quantity = total order weight in oz for the ShipStation payload.
    const GARMENT_WEIGHTS_OZ_FALLBACK = {
        // Hoodies / sweatshirts
        PC90: 24,
        PC78: 22,
        PC850: 22,
        F260: 26,
        F261: 26,
        18000: 16,
        8054: 30,
        ST253: 22,
        ST254: 22,
        // Long sleeves
        PC54LS: 8,
        PC61LS: 8,
        PC55LS: 9,
        ST350LS: 9,
        // Standard adult tees
        PC54: 5.5,
        PC61: 6,
        PC55: 6.5,
        5000: 6,
        3001: 5,
        ST350: 5,
        ST450: 6,
        DT6000: 5,
        // Youth tees
        PC54Y: 4,
        PC61Y: 4,
        PC55Y: 4,
        '5000B': 4,
        // Polos / Caps / Bags
        K500: 8,
        K420: 9,
        K100: 8,
        K110: 8,
        CP80: 3,
        C112: 4,
        STC10: 4,
        C932: 4,
        BG: 8,
    };
    const estimateWeightOz = (it) => {
        const qty = Number(it.quantity) || 0;
        // Prefer real SanMar weight (PIECE_WEIGHT) attached during the
        // /api/inventory lookup in buildShipStationItems
        if (Number.isFinite(it._weightPerPieceOz) && it._weightPerPieceOz > 0) {
            return it._weightPerPieceOz * qty;
        }
        // Fallback — hardcoded prefix lookup. Longest-prefix wins so
        // "PC54LS" matches before "PC54". Default 6 oz per piece.
        const sku = String(it.sku || '');
        let oz = 6;
        let bestLen = 0;
        for (const prefix of Object.keys(GARMENT_WEIGHTS_OZ_FALLBACK)) {
            if (sku.startsWith(prefix) && prefix.length > bestLen) {
                oz = GARMENT_WEIGHTS_OZ_FALLBACK[prefix];
                bestLen = prefix.length;
            }
        }
        return oz * qty;
    };
    const totalWeightOz = items.reduce((s, it) => s + estimateWeightOz(it), 0);
    // Strip the internal _weightPerPieceOz tracker so it doesn't leak to
    // ShipStation's item payload (which would silently ignore unknown keys
    // but we keep it clean for log readability).
    items.forEach((it) => {
        delete it._weightPerPieceOz;
    });

    const payload = {
        orderNumber: displayOrderNumber, // "WO 141899" or fallback "OF-0048"
        orderKey: safeQuoteId, // idempotency — always quote ID
        orderDate:
            (originalSubmission?.info?.dateIn || new Date().toISOString().split('T')[0]) +
            'T00:00:00.000Z',
        orderStatus: 'awaiting_shipment',
        customerEmail:
            order?.ContactEmail || originalSubmission?.info?.email || session.CustomerEmail || '',
        customerUsername:
            order?.CustomerName || session.CompanyName || originalSubmission?.info?.company || '',

        billTo: {
            name:
                billingContact?.ct_NameFull ||
                [billingContact?.NameFirst, billingContact?.NameLast].filter(Boolean).join(' ') ||
                originalSubmission?.info?.name ||
                session.CustomerName ||
                '',
            company:
                billingContact?.Company_Name ||
                originalSubmission?.info?.company ||
                session.CompanyName ||
                '',
            street1: billingContact?.Address || originalSubmission?.info?.address || '',
            street2: billingContact?.Address2 || '',
            city: billingContact?.City || originalSubmission?.info?.city || '',
            state: billingContact?.State || originalSubmission?.info?.state || '',
            postalCode: billingContact?.Zip || originalSubmission?.info?.zip || '',
            country: 'US',
            phone:
                billingContact?.Phone_Best || billingContact?.Company_Phone || session.Phone || '',
        },

        shipTo: (function buildShipTo() {
            // NWCA ship convention: ShipAddress01 = recipient name, ShipAddress02 = street.
            // ShipStation V1 REQUIRES shipTo.name AND shipTo.street1 — both must
            // be non-empty or POST /orders/createorder returns 400.
            const a1 = ship.address1 || '';
            const a2 = ship.address2 || '';
            // Heuristic: when only ONE field is set we don't know if it's a name or
            // a street. Use a digit-count rule — addresses usually start with a number.
            const a1HasDigits = /\d/.test(a1);
            const a2HasDigits = /\d/.test(a2);
            const recipient =
                ship.name ||
                (a1 && !a1HasDigits ? a1 : '') || // a1 looks like a name (no digits)
                (a2 && !a2HasDigits ? a2 : '') || // a2 looks like a name
                originalSubmission?.info?.name ||
                [originalSubmission?.info?.buyerFirst, originalSubmission?.info?.buyerLast]
                    .filter(Boolean)
                    .join(' ') ||
                ship.company ||
                session.CompanyName ||
                'Receiving'; // last-resort non-empty
            const street =
                (a2 && a2HasDigits ? a2 : '') || // prefer the field that has digits
                (a1 && a1HasDigits ? a1 : '') ||
                originalSubmission?.info?.shipAddress ||
                a1 ||
                a2 || // fall through to whatever's set
                'Address on file'; // last-resort non-empty
            const recipientCompany =
                ship.company || originalSubmission?.info?.company || session.CompanyName || '';
            return {
                name: recipient,
                company: recipientCompany,
                street1: street,
                street2: '',
                city: ship.city || originalSubmission?.info?.shipCity || '',
                state: ship.state || originalSubmission?.info?.shipState || '',
                postalCode: ship.zip || originalSubmission?.info?.shipZip || '',
                country: 'US',
                phone: session.Phone || billingContact?.Phone_Best || '',
                residential: false,
            };
        })(),

        items,

        // TotalAmount is pre-tax (2026-06-12); add TaxAmount for the grand total
        // when no ShopWorks invoice exists yet. Old rows have TaxAmount 0/null →
        // (TotalAmount + 0) preserves their tax-inclusive value. Backward-compatible.
        amountPaid:
            Number(order?.cur_TotalInvoice) ||
            Number(session.TotalAmount) + (Number(session.TaxAmount) || 0) ||
            0,
        taxAmount: Number(order?.cur_SalesTaxTotal) || 0,
        shippingAmount: 0, // warehouse sets actual at label-purchase time

        customerNotes: originalSubmission?.info?.orderNotes || '',
        internalNotes: [
            session.ShopWorks_Order_Number ? `WO ${session.ShopWorks_Order_Number}` : '',
            `Sales rep: ${order?.CustomerServiceRep || session.SalesRepName || 'unknown'}`,
            `Quote: ${safeQuoteId}`,
            // Surface the override so warehouse picker sees the rep intentionally
            // re-routed (e.g., "customer originally chose UPS Ground but rep
            // selected Priority Mail for this small package").
            wasOverridden ? `Ship method overridden: ${origMethod} → ${method}` : '',
        ]
            .filter(Boolean)
            .join(' · '),

        // Carrier preset: only when the carrier is actually configured in
        // ShipStation. Otherwise just record the rep's preference as a hint
        // so warehouse staff see "UPS Ground" in the requested-service field
        // even though they'll pick at rate time.
        ...(useMapped ? { carrierCode: mapped.carrier, serviceCode: mapped.service } : {}),
        requestedShippingService: method || undefined,

        // Estimated total weight in ounces — saves the warehouse from
        // weighing before rate-shopping. Approximate per-garment weights;
        // warehouse can override in ShipStation UI at label-buy time.
        ...(totalWeightOz > 0
            ? { weight: { value: Math.round(totalWeightOz), units: 'ounces' } }
            : {}),

        // Custom fields — surface in ShipStation's order detail under "Notes".
        // Warehouse picker uses these to know what they're packing/shipping.
        advancedOptions: {
            customField1: (function () {
                // Decoration method + locations (extract first line from methodNotesBlock).
                // For OF-0048 this looks like: "DTG · Left Chest + Full Back · Tier 24-47..."
                const methodNote =
                    originalSubmission?.info?.methodNotesBlock ||
                    originalSubmission?.methodNotesBlock ||
                    '';
                const firstFew = String(methodNote).split(' · ').slice(0, 2).join(' · ');
                return firstFew || 'Custom Decoration';
            })(),
            customField2: (function () {
                // Design # — from ShopWorks order if synced, else from originalSubmission.designNumbers
                const designId =
                    order?.id_Design ||
                    (Array.isArray(originalSubmission?.designNumbers) &&
                        originalSubmission.designNumbers[0]) ||
                    '';
                return designId ? `Design # ${designId}` : '';
            })(),
            customField3: originalSubmission?.info?.isRush ? '🚨 RUSH' : '',
        },
    };

    return payload;
};
