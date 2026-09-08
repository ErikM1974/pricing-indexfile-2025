// Composes storefront services once; caches belong to their individual factories.
module.exports = function createStorefrontServices(ctx) {
    const {
        CAPS_PRICING,
        CASPIO_PROXY_BASE,
        CTS_PRICING,
        CTS_SHIPDATE,
        STOREFRONT_CHANNEL_CONFIG,
        TDT_PRICING,
        TDT_SHIPDATE,
        fetch,
    } = ctx;
    const TDT_PROXY = CASPIO_PROXY_BASE;
    const { resolveTdtTax } = require('./tax')({ TDT_PROXY, fetch });
    const { capsStockConflicts, ctsStockConflicts, getCtsStock } = require('./inventory')({
        TDT_PROXY,
        fetch,
    });
    const { TDT_SIZES, rebuildTdtQuote, resolveTdtShipping } = require('./three-day-tees')({
        TDT_PRICING,
        TDT_PROXY,
        fetch,
        resolveTdtTax,
    });
    const { getCtsCatalog, getCtsPricingConfig, rebuildCtsQuote, resolveCtsShipping } =
        require('./custom-tees')({
            CTS_PRICING,
            STOREFRONT_CHANNEL_CONFIG,
            TDT_PROXY,
            TDT_SIZES,
            fetch,
            resolveTdtTax,
        });
    const { rebuildCapsQuote } = require('./custom-caps')({
        CAPS_PRICING,
        TDT_PROXY,
        fetch,
        resolveTdtTax,
    });
    const { channelConfig, channelConfigExact } = require('./channels')({
        CASPIO_PROXY_BASE,
        CTS_SHIPDATE,
        STOREFRONT_CHANNEL_CONFIG,
        TDT_SHIPDATE,
        TDT_SIZES,
        capsStockConflicts,
        ctsStockConflicts,
        rebuildCapsQuote,
        rebuildCtsQuote,
        rebuildTdtQuote,
    });
    return {
        TDT_PROXY,
        channelConfig,
        channelConfigExact,
        getCtsCatalog,
        getCtsPricingConfig,
        getCtsStock,
        resolveCtsShipping,
        resolveTdtShipping,
        resolveTdtTax,
    };
};
