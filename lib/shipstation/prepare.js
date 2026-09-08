// Select shipping routing before any delivery work. Pure snapshot/selection stage.
module.exports = function prepare(session, overrideShipMethod) {
    // 3. Parse the snapshot + original submission (same logic as /full).
    let originalSubmission = null;
    if (session.Notes) {
        try {
            originalSubmission = JSON.parse(session.Notes);
        } catch (_) {
            /* legacy plain-text */
        }
    }
    let snapshot = null;
    if (session.ShopWorks_Snapshot) {
        try {
            snapshot = JSON.parse(session.ShopWorks_Snapshot);
        } catch (_) {
            /* ignore */
        }
    }
    const order = snapshot?.order || null;
    const lineItems = snapshot?.lineItems || [];
    const pushedShip = (snapshot?.pushed?.ShippingAddresses || [])[0];
    const ship = pushedShip
        ? {
              method: pushedShip.ShipMethod || '',
              address1: pushedShip.ShipAddress01 || '',
              address2: pushedShip.ShipAddress02 || '',
              city: pushedShip.ShipCity || '',
              state: pushedShip.ShipState || '',
              zip: pushedShip.ShipZip || '',
              company: pushedShip.ShipCompany || '',
              name: pushedShip.ShipName || '',
          }
        : originalSubmission?.ship || {};

    // 4. Skip ShipStation entirely for non-USPS orders. NWCA's workflow:
    //   - USPS (small packages, 2-3 shirts) → ShipStation
    //   - UPS (most orders) → WorldShip (desktop app, separate workflow)
    //   - Customer Pickup → no label needed
    //   - FedEx / Other → assume manual / WorldShip until configured
    //
    // BUT — the rep can override at send time by passing body.overrideShipMethod.
    // Example: customer picked "UPS Ground" but it's only 3 shirts — rep clicks
    // Send to ShipStation, modal opens, rep picks "Priority Mail", body has
    // overrideShipMethod="Priority Mail" → we use that instead and push.
    const origMethod = (ship.method || ship.methodLabel || '').toString();
    const overrideMethod = (overrideShipMethod || '').toString().trim();
    const method = overrideMethod || origMethod;
    const methodLower = method.toLowerCase();
    const wasOverridden = !!overrideMethod && overrideMethod !== origMethod;

    if (methodLower.includes('pickup') || methodLower.includes('willcall')) {
        return {
            response: {
                skipped: true,
                reason: 'pickup',
                message: 'Customer Pickup — no shipping label needed.',
            },
        };
    }
    if (methodLower.startsWith('ups')) {
        return {
            response: {
                skipped: true,
                reason: 'ups-uses-worldship',
                message:
                    'UPS orders ship via WorldShip (desktop app), not ShipStation. To use ShipStation, override the method to a USPS service.',
                originalMethod: origMethod,
            },
        };
    }
    if (methodLower.startsWith('fedex')) {
        return {
            response: {
                skipped: true,
                reason: 'fedex-not-configured',
                message:
                    "FedEx is not connected to ShipStation. Use the carrier's own shipping tool, or override to a USPS service.",
                originalMethod: origMethod,
            },
        };
    }
    // Only continue for USPS / Priority Mail / unconfigured-but-supported methods

    // 4b. Already-sent check — idempotency at the Caspio layer. Runs AFTER
    // the routing skips so a stale ShipStation_Order_ID on a UPS order
    // (e.g., from before today's USPS-only routing) doesn't block the skip.
    if (session.ShipStation_Order_ID) {
        return {
            response: {
                success: true,
                alreadySent: true,
                shipstationOrderId: session.ShipStation_Order_ID,
                status: session.ShipStation_Status || 'awaiting_shipment',
                lastSynced: session.ShipStation_Last_Synced,
            },
        };
    }

    // 5. Look up the carrier+service for our ship method.
    //
    // CRITICAL: ShipStation rejects createorder with HTTP 400 (empty body)
    // when carrierCode/serviceCode reference a carrier NOT configured in the
    // account. NWCA currently has only Stamps.com (USPS) connected; UPS and
    // FedEx require a separate "Add Carrier" step in ShipStation Settings.
    //
    // Strategy: only include carrierCode+serviceCode when the carrier is in
    // CONFIGURED_CARRIERS. Otherwise omit those fields entirely (order still
    // creates fine; warehouse picks at label-buy time) and use the freetext
    // `requestedShippingService` hint so the rep's preference still shows
    // in the ShipStation UI.
    const SHIP_METHOD_MAP = {
        'UPS Ground': { carrier: 'ups', service: 'ups_ground' },
        'UPS 2nd Day': { carrier: 'ups', service: 'ups_2nd_day_air' },
        'UPS Next Day': { carrier: 'ups', service: 'ups_next_day_air' },
        'Priority Mail': { carrier: 'stamps_com', service: 'usps_priority_mail' },
        'USPS Priority': { carrier: 'stamps_com', service: 'usps_priority_mail' },
        'USPS First Class': { carrier: 'stamps_com', service: 'usps_first_class_mail' },
        'USPS Ground': { carrier: 'stamps_com', service: 'usps_ground_advantage' },
        'FedEx Ground': { carrier: 'fedex', service: 'fedex_ground' },
    };
    // TODO: replace with dynamic carrier list from ShipStation /carriers
    //       endpoint (cached 24h). For now, hardcoded to what NWCA has set up.
    const CONFIGURED_CARRIERS = new Set(['stamps_com']);
    const mapped = SHIP_METHOD_MAP[method] || { carrier: null, service: null };
    const useMapped = mapped.carrier && CONFIGURED_CARRIERS.has(mapped.carrier);

    return {
        originalSubmission,
        order,
        lineItems,
        ship,
        origMethod,
        method,
        wasOverridden,
        mapped,
        useMapped,
    };
};
