/**
 * Shared pricingData contract for the 4 quote-builder → EmbroideryInvoiceGenerator pipeline.
 *
 * Why: DTG/EMB/SCP/DTF each built `pricingData` slightly differently, so the
 * spring 2026 invoice-totals fix had to be applied 4 times (preTaxSubtotal,
 * includeTax, tax decimal-vs-percent, shipping row). This module locks the
 * shape every builder must produce. Generator math is unchanged — the contract
 * just normalizes the inputs (method → flags, percent tax → decimal, zero-fills
 * missing fee fields) so the generator sees one consistent shape.
 *
 * Loaded as a browser global before embroidery-quote-invoice.js. Exposes
 * window.QuotePricingData.
 */
(function (global) {
    const CONTRACT_VERSION = '3.1.0';
    const METHODS = ['DTG', 'EMB', 'SCP', 'DTF'];

    const REQUIRED = ['quoteId', 'method', 'tier', 'totalQuantity', 'products',
                      'subtotal', 'preTaxSubtotal', 'grandTotal',
                      'taxRate', 'includeTax'];

    const FEE_FIELDS = ['setupFees', 'setupFeesCount', 'additionalServicesTotal',
                        'safetyStripesTotal', 'artCharge', 'graphicDesignCharge',
                        'graphicDesignHours', 'rushFee', 'shippingFee',
                        'discount', 'ltmFee',
                        'decgQty', 'decgUnit', 'decgTotal',
                        'deccQty', 'deccUnit', 'deccTotal',
                        'capPatchSetupFee', 'puffUpchargePerCap',
                        // SCP setup parts (Erik's official list, 2026-06-27)
                        'vellumFee', 'vellumQty', 'colorChangeFee', 'colorChangeQty'];

    // Percent (>1) → decimal; decimal kept as-is; blank/NaN → 0.
    function normalizeTaxRate(raw) {
        if (raw == null || raw === '' || isNaN(parseFloat(raw))) return 0;
        const n = parseFloat(raw);
        return n > 1 ? n / 100 : n;
    }

    function buildPricingData(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('[pricingData] input must be an object');
        }
        const method = input.method;
        if (!METHODS.includes(method)) {
            throw new Error('[pricingData] method must be DTG/EMB/SCP/DTF, got: ' + method);
        }

        const out = Object.assign({}, input);

        // Derive dispatch flags from method (generator dispatches on these — unchanged).
        out.isDTG = method === 'DTG';
        out.isScreenprint = method === 'SCP';
        out.isDTF = method === 'DTF';

        // Tax always decimal at the contract boundary.
        out.taxRate = normalizeTaxRate(input.taxRate);
        out.includeTax = input.includeTax !== false;

        // Zero-fill numeric fee fields so the generator's `(x || 0) > 0` checks
        // don't surface undefined when a builder legitimately has nothing to set.
        FEE_FIELDS.forEach(function (k) {
            if (typeof out[k] !== 'number' || isNaN(out[k])) out[k] = 0;
        });

        // Legacy fallback: when builder skipped grandTotal, mirror preTaxSubtotal.
        if (out.grandTotal == null) out.grandTotal = out.preTaxSubtotal;

        if (typeof out.ltmDistributed !== 'boolean') {
            out.ltmDistributed = (out.ltmFee === 0);
        }

        validatePricingData(out);
        return out;
    }

    function isDevHost() {
        if (typeof location === 'undefined') return false;
        const h = (location.hostname || '').toLowerCase();
        // Throw only on local dev. Production heroku must warn (never break a live print).
        return h === 'localhost' || h === '127.0.0.1';
    }

    function validatePricingData(pd) {
        const problems = [];
        REQUIRED.forEach(function (k) {
            if (pd[k] === undefined || pd[k] === null) problems.push('missing: ' + k);
        });
        if (!Array.isArray(pd.products)) problems.push('products must be an Array');
        if (typeof pd.taxRate === 'number' && pd.taxRate > 1) {
            problems.push('taxRate must be a decimal (got ' + pd.taxRate + ')');
        }
        if (problems.length === 0) return;

        const msg = '[pricingData v' + CONTRACT_VERSION + '] '
                  + (pd && pd.method ? pd.method : '?') + '/' + (pd && pd.quoteId ? pd.quoteId : '?')
                  + ' — ' + problems.join('; ');
        if (isDevHost()) throw new Error(msg);
        console.warn(msg);
    }

    global.QuotePricingData = {
        buildPricingData: buildPricingData,
        validatePricingData: validatePricingData,
        normalizeTaxRate: normalizeTaxRate,
        CONTRACT_VERSION: CONTRACT_VERSION
    };
})(typeof window !== 'undefined' ? window : globalThis);
