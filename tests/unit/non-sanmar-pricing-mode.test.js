/**
 * Non_SanMar_Products compatibility contract.
 *
 * `PricingMethod` exists in production with THREE spellings written by three different
 * places over time — 'FIXED' (the builder's Add-Product modal and the proxy seed row),
 * 'FixedPrice' and 'Margin' (the staff Product Manager dashboard) — plus older rows
 * where it is blank. resolveNonSanmarPricingMode() is the single tolerant reader; if it
 * regresses, existing rows silently mis-price (a Margin row read as fixed prices at $0
 * and blocks the save; a fixed row read as cost-plus prices off a cost of 0).
 *
 * Also locks the vendor list against the dashboard's own copy — the two are duplicated
 * because the dashboard does not load the builder utils bundle.
 */
const fs = require('fs');
const path = require('path');

const { NON_SANMAR_VENDORS, vendorLabel, resolveNonSanmarPricingMode } =
    require('../../shared_components/js/quote-builder-utils.js');

describe('resolveNonSanmarPricingMode — every spelling in production', () => {
    const cases = [
        // [PricingMethod, DefaultCost, DefaultSellPrice, expected]
        ['Margin', 8.42, 0, 'costPlus'],
        ['margin', 8.42, 0, 'costPlus'],
        ['MARGIN', 8.42, 0, 'costPlus'],
        ['FixedPrice', 0, 29.5, 'fixed'],
        ['FIXED', 0, 29.5, 'fixed'],
        ['fixed', 0, 29.5, 'fixed'],

        // The live bug this work fixed: a Margin row carries DefaultSellPrice 0, and
        // reading it as "fixed" is what made it unquotable in the builder.
        ['Margin', 8.42, 0, 'costPlus'],
        // Declared mode wins over a stray value in the other column.
        ['Margin', 8.42, 29.5, 'costPlus'],
        ['FixedPrice', 8.42, 29.5, 'fixed'],

        // Declared mode with no usable number → unpriced, never a $0 price.
        ['Margin', 0, 0, 'unpriced'],
        ['FixedPrice', 0, 0, 'unpriced'],
        ['Margin', 0, 29.5, 'unpriced'],
        ['FixedPrice', 8.42, 0, 'unpriced'],

        // Blank/legacy PricingMethod → infer from whichever number the row carries.
        ['', 8.42, 0, 'costPlus'],
        ['', 0, 29.5, 'fixed'],
        [null, 8.42, 0, 'costPlus'],
        [undefined, 0, 29.5, 'fixed'],
        ['', 0, 0, 'unpriced'],
        ['', 8.42, 29.5, 'costPlus'],
    ];

    test.each(cases)('PricingMethod=%p cost=%p sell=%p → %s', (pm, cost, sell, expected) => {
        expect(resolveNonSanmarPricingMode({
            PricingMethod: pm, DefaultCost: cost, DefaultSellPrice: sell
        })).toBe(expected);
    });

    test('string numbers from Caspio are handled', () => {
        expect(resolveNonSanmarPricingMode({
            PricingMethod: 'Margin', DefaultCost: '8.42', DefaultSellPrice: '0'
        })).toBe('costPlus');
    });

    test('a junk row never claims to be priced', () => {
        expect(resolveNonSanmarPricingMode({})).toBe('unpriced');
        expect(resolveNonSanmarPricingMode({ DefaultCost: 'abc', DefaultSellPrice: null })).toBe('unpriced');
    });
});

describe('vendorLabel', () => {
    test('resolves curated codes, case-insensitively', () => {
        expect(vendorLabel('SSA')).toBe('S&S Activewear');
        expect(vendorLabel('ssa')).toBe('S&S Activewear');
        expect(vendorLabel(' CARH ')).toBe('Carhartt (direct)');
    });

    test('echoes an unknown one-off code rather than dropping it', () => {
        expect(vendorLabel('WEIRDCO')).toBe('WEIRDCO');
    });

    test('is empty for no vendor', () => {
        expect(vendorLabel('')).toBe('');
        expect(vendorLabel(null)).toBe('');
        expect(vendorLabel(undefined)).toBe('');
    });
});

describe('vendor list drift — builder vs staff Product Manager', () => {
    // The two lists are duplicated on purpose (the dashboard does not load the builder
    // utils bundle). VendorCode is filtered with EXACT uppercase equality by
    // GET /api/non-sanmar-products?vendor=, so a code present in one UI and not the
    // other quietly splits vendor reporting.
    test('the dashboard copy matches NON_SANMAR_VENDORS exactly', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '../../dashboards/js/product-manager.js'), 'utf8');
        const block = src.match(/const NON_SANMAR_VENDORS = \[([\s\S]*?)\];/);
        expect(block).toBeTruthy();

        const dashboard = [...block[1].matchAll(/code:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)]
            .map(m => ({ code: m[1], label: m[2] }));

        expect(dashboard).toEqual(NON_SANMAR_VENDORS);
    });

    test('codes are unique, uppercase and within the Caspio column width', () => {
        const codes = NON_SANMAR_VENDORS.map(v => v.code);
        expect(new Set(codes).size).toBe(codes.length);
        codes.forEach(c => {
            expect(c).toBe(c.toUpperCase());
            expect(c.length).toBeLessThanOrEqual(40);   // VendorCode maxlength
        });
    });

    test("'__other' is reserved for the free-text escape and is not a real code", () => {
        expect(NON_SANMAR_VENDORS.some(v => v.code === '__other')).toBe(false);
    });
});
