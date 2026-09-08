// Paid storefront submission stage; contracts cover Stripe gates and the resulting order.
function buildStorefrontLines({ colorConfigs, orderSettings, pricingData, orderTotals }, pushCfg) {
    const pushC = pushCfg.push;
    // Build line items from colorConfigs
    // Structure: { catalogColor: { displayColor, sizeBreakdown: { size: { quantity, unitPrice } } } }
    // Style: Custom-Tees orders carry the SERVER-VALIDATED style in
    // orderSettings (stamped at checkout from the curated-catalog whitelist);
    // legacy 3DT orders fall through to PC54.
    const lineItems = [];
    const styleNumber =
        orderSettings?.styleNumber || pricingData?.styleNumber || pushC.fallbackStyleNumber;
    const productName =
        orderSettings?.styleName || pricingData?.productName || pushCfg.fallbackProductName;

    for (const [catalogColor, config] of Object.entries(colorConfigs)) {
        if (config.sizeBreakdown) {
            for (const [size, sizeData] of Object.entries(config.sizeBreakdown)) {
                if (sizeData && sizeData.quantity > 0) {
                    lineItems.push({
                        partNumber: styleNumber,
                        description: productName,
                        // CATALOG_COLOR keys ShopWorks/inventory — COLOR_NAME is display
                        // only ("Dark Heather Grey" would not match SKU color
                        // "Dk Hthr Grey"). Rule #2 in CLAUDE.md; review fix 2026-06-09.
                        color: config.catalogColor || catalogColor,
                        size: size,
                        quantity: parseInt(sizeData.quantity),
                        price: sizeData.unitPrice || 0,
                    });
                }
            }
        }
    }

    console.log('[3-Day Order] Built lineItems:', lineItems.length, 'items');

    // Add Less Than Minimum fee as a line item (if applicable).
    // partNumber stays 'LTM-75' (a stable ShopWorks SKU, via the channel
    // registry); the description reflects the ACTUAL fee from Caspio
    // Service_Codes 3DT-LTM.
    if (orderTotals?.ltmFee && orderTotals.ltmFee > 0) {
        lineItems.push({
            partNumber: pushC.ltmPartNumber,
            description: `Less Than Minimum $${Number(orderTotals.ltmFee).toFixed(2)}`,
            color: '',
            size: '',
            quantity: 1,
            price: orderTotals.ltmFee,
        });
        console.log('[3-Day Order] Added LTM fee line item: $' + orderTotals.ltmFee);
    }
    return lineItems;
}
module.exports = { buildStorefrontLines };
