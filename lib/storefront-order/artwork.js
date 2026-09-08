// Paid storefront submission stage; contracts cover Stripe gates and the resulting order.
function buildStorefrontArtwork({ colorConfigs, orderSettings, tempOrderNumber }, pushCfg) {
    const pushC = pushCfg.push;
    // Extract unique product colors from the order for "For Product Colors" field
    const uniqueColors = [
        ...new Set(
            Object.values(colorConfigs)
                .map((config) => config.displayColor)
                .filter(Boolean)
        ),
    ];
    const productColorsString = uniqueColors.join(', ');

    console.log('[3-Day Order] Product colors for design:', productColorsString);

    // Extract artwork URLs and build designs block
    const designs = [];
    const frontLogo = orderSettings?.frontLogo?.fileUrl || orderSettings?.uploadedFiles?.front;
    const backLogo = orderSettings?.backLogo?.fileUrl || orderSettings?.uploadedFiles?.back;
    const printLocation = orderSettings?.printLocationCode || 'LC';

    // Side flags: CTS free-placement orders carry SERVER-VALIDATED
    // frontLocation ('LC'|'FF'|'JF'|null) + backLocation ('FB'|'JB'|null)
    // stamped at checkout; legacy 3DT only has printLocationCode. The old
    // `indexOf('_FB')` gating silently DROPPED back art for the new JB/back-
    // only codes — a paid Jumbo-Back print production never saw. (audit
    // CRITICAL fix 2026-06-10)
    const stampedFront = orderSettings?.frontLocation || null;
    const stampedBack = orderSettings?.backLocation || null;
    const frontCode = stampedFront || printLocation.split('_')[0];
    const hasFrontPrint = stampedFront ? true : !/^(FB|JB)$/.test(printLocation);
    const hasBackPrint = stampedBack ? true : /(^|_)(FB|JB)$/.test(printLocation);

    // Map location codes to exact ShopWorks dropdown values (channel
    // registry — caps will use different OnSite dropdown values).
    // ShopWorks accepts: 'Full Back', 'Full Front', 'Left Chest', 'Right Chest'
    // — jumbos map to the nearest dropdown value; the exact 16×20 dims ride in
    // the location notes + placement spec. (audit HIGH fix 2026-06-10)
    const SW_LOC = pushC.swLocationMap;
    const frontLocationName = SW_LOC[frontCode] || pushC.defaultFrontLocationName;
    const backLocationName = SW_LOC[stampedBack] || pushC.defaultBackLocationName;

    console.log('[3-Day Order] Artwork URLs:', {
        frontLogo,
        backLogo,
        printLocation,
        frontCode,
        stampedBack,
        frontLocationName,
        hasFrontPrint,
        hasBackPrint,
    });

    if (frontLogo || backLogo) {
        const design = {
            name: `${tempOrderNumber} - Customer Logo`, // "name" field expected by proxy transformDesigns
            externalId: `${pushC.designExternalIdPrefix}${tempOrderNumber}`, // External ID for tracking
            productColor: productColorsString, // T-shirt colors from order → "For Product Colors" field
            designTypeId: pushC.designTypeId, // 45 = DTG (channel registry)
            artistId: pushC.artistId, // 224 = 3-Day Tees routing
            locations: [],
        };

        // Front location only when the order actually HAS a front print
        if (frontLogo && hasFrontPrint) {
            design.locations.push({
                location: frontLocationName, // Exact ShopWorks dropdown value
                colors: pushC.designLocationColors, // DTG = Full Color
                code: `${tempOrderNumber}-FRONT`,
                imageUrl: frontLogo,
                customField01: frontLogo, // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
                // No ″ (U+2033): ManageOrders stores cp1252, anything outside it becomes "?"
                notes:
                    'Customer uploaded artwork' +
                    (frontCode === 'JF' ? ' — JUMBO FRONT 16×20 in (see placement spec)' : ''),
                details: pushC.designDetails(),
            });
        }

        // Back location ONLY when the charged order includes a back print —
        // a stray backLogo on a front-only-priced order must not print free.
        if (backLogo && hasBackPrint) {
            design.locations.push({
                location: backLocationName,
                colors: pushC.designLocationColors, // DTG = Full Color
                code: `${tempOrderNumber}-BACK`,
                imageUrl: backLogo,
                customField01: backLogo, // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
                notes:
                    'Customer uploaded artwork (back) - See Attachments tab for image' +
                    (stampedBack === 'JB' ? ' — JUMBO BACK 16×20 in (see placement spec)' : ''),
                details: pushC.designDetails(),
            });
        }

        // Only add design if we have at least one location
        if (design.locations.length > 0) {
            designs.push(design);
        }
    }

    console.log('[3-Day Order] Built designs:', designs.length, 'design(s)');

    // Build attachments array for artwork files (OnSite may download from Attachments)
    const attachments = [];
    if (frontLogo) {
        attachments.push({
            mediaUrl: frontLogo,
            mediaName: `${tempOrderNumber} - Front Artwork`,
            linkNote: 'Customer uploaded artwork (front)',
        });
    }
    if (backLogo && hasBackPrint) {
        attachments.push({
            mediaUrl: backLogo,
            mediaName: `${tempOrderNumber} - Back Artwork`,
            linkNote: 'Customer uploaded artwork (back)',
        });
    }

    // Designer mockups (customer-approved composites) ride along so production
    // sees EXACTLY what the customer approved. Capped to keep payloads sane.
    (orderSettings?.mockups || []).slice(0, 8).forEach((m) => {
        if (m && m.url) {
            attachments.push({
                mediaUrl: m.url,
                mediaName:
                    `${tempOrderNumber} - Approved mockup ${m.color || ''} ${m.view || ''}`.trim(),
                linkNote: 'Customer-approved designer mockup',
            });
        }
    });

    console.log('[3-Day Order] Built attachments:', attachments.length, 'attachment(s)');
    return {
        designs,
        attachments,
        hasFrontPrint,
        hasBackPrint,
        frontLocationName,
        backLocationName,
        frontCode,
        stampedBack,
    };
}
module.exports = { buildStorefrontArtwork };
