/* Campaign validation and SanMar inventory interpretation; no UI or business writes. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ChristmasCampaign = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const categories = ['jackets', 'hoodies', 'beanies', 'gloves'];
    const normalize = (value) =>
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    const amount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    function validateCampaign(data) {
        if (
            !data ||
            !/^holiday-[a-z0-9-]+$/.test(data.id || '') ||
            !Number.isInteger(data.year) ||
            !/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(data.closesAt || '') ||
            !Number.isFinite(Date.parse(data.closesAt)) ||
            !/^[A-Z0-9-]{1,30}$/.test(data.boxServiceCode || '') ||
            !/^[A-Z0-9-]{1,30}$/.test(data.shippingServiceCode || '')
        )
            throw new Error('Campaign settings are incomplete.');
        for (const key of ['headline', 'introduction', 'eligibility', 'deadlineLabel']) {
            if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 500)
                throw new Error('Campaign copy is incomplete.');
        }
        const seen = new Set();
        for (const category of categories) {
            const products = data.products?.[category];
            if (!Array.isArray(products) || !products.length || products.length > 8)
                throw new Error('Each gift-box category needs one to eight products.');
            for (const product of products) {
                if (
                    !/^[A-Z0-9][A-Z0-9-]{0,29}$/.test(product.style || '') ||
                    seen.has(product.style)
                )
                    throw new Error('Campaign products need unique styles.');
                for (const key of ['name', 'brand', 'summary']) {
                    if (
                        typeof product[key] !== 'string' ||
                        !product[key].trim() ||
                        product[key].length > 250
                    )
                        throw new Error('Product descriptions are incomplete.');
                }
                if (
                    !Array.isArray(product.excludedColors) ||
                    product.excludedColors.some((c) => typeof c !== 'string') ||
                    typeof product.preferredColor !== 'string'
                )
                    throw new Error('Product color settings are invalid.');
                seen.add(product.style);
            }
        }
        return data;
    }
    function inventorySizes(data, style, color) {
        if (normalize(data?.style) !== normalize(style) || !Array.isArray(data?.inventory))
            throw new Error('Inventory response is incomplete.');
        const names = new Set(
            [color.CATALOG_COLOR, color.COLOR_NAME].filter(Boolean).map(normalize)
        );
        const rows = data.inventory.filter((row) => names.has(normalize(row.color)));
        if (!rows.length) throw new Error('No verified inventory returned for this color.');
        const sizes = new Map(),
            parts = new Map();
        for (const row of rows) {
            const size = String(row.size || '').trim();
            // Empty, null or malformed quantities are unknown, never zero stock.
            if (!size || !amount(row.totalQty) || !Number.isInteger(row.totalQty))
                throw new Error('Inventory quantities could not be verified.');
            if (row.partId && parts.has(row.partId)) {
                const prior = parts.get(row.partId);
                if (prior.size !== size || prior.quantity !== row.totalQty)
                    throw new Error('Inventory contains conflicting product quantities.');
                continue;
            }
            if (row.partId) parts.set(row.partId, { size, quantity: row.totalQty });
            if (sizes.has(size)) throw new Error('Inventory contains ambiguous duplicate sizes.');
            sizes.set(size, { size, quantity: row.totalQty });
        }
        return [...sizes.values()];
    }
    const isClosed = (campaign, now = Date.now()) => now >= Date.parse(campaign.closesAt);
    return { validateCampaign, inventorySizes, isClosed };
});
