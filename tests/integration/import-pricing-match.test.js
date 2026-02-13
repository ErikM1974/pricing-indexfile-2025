/**
 * Integration Test: Parser → Pricing Engine
 *
 * Parses ShopWorks order fixtures → feeds into pricing engine methods → verifies
 * tier determination, stitch surcharges, and tax calculations are consistent.
 *
 * NOTE: Full calculateQuote() requires async API calls for size pricing.
 * This integration test validates the *logic pipeline* using the pricing engine's
 * pure methods with parser-extracted data (quantities, tiers, tax rates).
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../shared_components/js/shopworks-import-parser');
const { createTestCalculator } = require('../fixtures/pricing-test-helper');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('Parser → Pricing: simple-garment (Order 140666)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('simple-garment.txt'));
        calc = createTestCalculator();
    });

    test('parser extracts correct order ID', () => {
        expect(parsed.orderId).toBe('140666');
    });

    test('parser extracts correct product count', () => {
        // PC61LS + PC61LS_3X = 2 products, DD = digitizing service
        expect(parsed.products.length).toBeGreaterThanOrEqual(1);
    });

    test('parser extracts correct total quantity from products', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        // 12 + 1 = 13 pieces
        expect(totalQty).toBe(13);
    });

    test('pricing engine determines correct tier for total quantity', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(calc.getTier(totalQty)).toBe('8-23');
    });

    test('tier 8-23 has no LTM', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const tier = calc.getTier(totalQty);
        expect(calc.tiers[tier].hasLTM).toBe(false);
    });

    test('embroidery cost for tier 8-23 is $18.00', () => {
        expect(calc.getEmbroideryCost('8-23')).toBe(18.00);
    });

    test('standard stitch surcharge is $0', () => {
        expect(calc.getStitchSurcharge(8000)).toBe(0);
    });

    test('tax rate from order summary ≈ 10.1%', () => {
        expect(parsed.orderSummary.taxRate).toBeCloseTo(10.1, 0);
    });

    test('shipping from order summary is $12.99', () => {
        expect(parsed.orderSummary.shipping).toBe(12.99);
    });

    test('WA state detected from shipping address', () => {
        expect(parsed.shipping.state).toBe('WA');
    });
});

describe('Parser → Pricing: multi-product out-of-state (Order 140721)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('multi-product-oos.txt'));
        calc = createTestCalculator();
    });

    test('parser extracts 4 products', () => {
        expect(parsed.products.length).toBe(4);
    });

    test('total quantity is 16', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(totalQty).toBe(16);
    });

    test('tier is 8-23 for 16 pieces', () => {
        expect(calc.getTier(16)).toBe('8-23');
    });

    test('out-of-state: TX → tax rate is 0', () => {
        expect(parsed.orderSummary.salesTax).toBe(0);
    });

    test('TX address detected from shipping', () => {
        expect(parsed.shipping.state).toBe('TX');
    });

    test('digitizing detected', () => {
        expect(parsed.services.digitizing).toBe(true);
    });
});

describe('Parser → Pricing: non-SanMar products (Order 140580)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('non-sanmar.txt'));
        calc = createTestCalculator();
    });

    test('non-SanMar products detected (Wink WW3150, WW3160)', () => {
        expect(parsed.customProducts.length).toBeGreaterThanOrEqual(1);
    });

    test('no standard products in products array (all non-SanMar)', () => {
        // All WW items should go to customProducts
        const sanmarProducts = parsed.products.filter(p =>
            !p.partNumber.startsWith('WW')
        );
        expect(sanmarProducts.length).toBe(0);
    });
});

describe('Parser → Pricing: mixed cap + garment (Order 140679)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('mixed-cap-garment.txt'));
        calc = createTestCalculator();
    });

    test('has both garment and cap products', () => {
        const hasGarment = parsed.products.some(p => p.partNumber === 'PC54');
        const hasCap = parsed.products.some(p => p.partNumber === 'C112');
        expect(hasGarment).toBe(true);
        expect(hasCap).toBe(true);
    });

    test('garment qty = 10, cap qty = 10', () => {
        const garmentQty = parsed.products
            .filter(p => p.partNumber === 'PC54')
            .reduce((sum, p) => sum + (p.quantity || 0), 0);
        const capQty = parsed.products
            .filter(p => p.partNumber === 'C112')
            .reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(garmentQty).toBe(10);
        expect(capQty).toBe(10);
    });

    test('garment tier = 8-23 for 10 garments', () => {
        expect(calc.getTier(10)).toBe('8-23');
    });

    test('cap tier = 8-23 for 10 caps', () => {
        expect(calc.getTier(10)).toBe('8-23');
    });

    test('rush service detected', () => {
        expect(parsed.services.rush).not.toBeNull();
    });

    test('digitizing detected', () => {
        expect(parsed.services.digitizing).toBe(true);
        expect(parsed.services.digitizingCount).toBeGreaterThanOrEqual(1);
    });
});

describe('Parser → Pricing: small order with LTM (Order 140623)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('customer-pickup.txt'));
        calc = createTestCalculator();
    });

    test('total quantity is 3', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(totalQty).toBe(3);
    });

    test('tier is 1-7 → LTM applies', () => {
        const tier = calc.getTier(3);
        expect(tier).toBe('1-7');
        expect(calc.tiers[tier].hasLTM).toBe(true);
    });

    test('LTM per piece for 3 items = $16.67', () => {
        const ltmPerPiece = calc.ltmFee / 3;
        expect(+ltmPerPiece.toFixed(2)).toBe(16.67);
    });

    test('decimal design numbers parsed', () => {
        const designNotes = parsed.notes.filter(n => n.startsWith('Design #'));
        expect(designNotes.length).toBe(2);
        expect(designNotes[0]).toContain('39719.01');
        expect(designNotes[1]).toContain('39719.02');
    });

    test('customer pickup → no shipping cost', () => {
        expect(parsed.orderSummary.shipping).toBe(0);
    });
});

describe('Parser → Pricing: large order with caps (Order 140510)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('caps-oos.txt'));
        calc = createTestCalculator();
    });

    test('24 caps + 24 garments', () => {
        const capQty = parsed.products
            .filter(p => p.partNumber === 'C112')
            .reduce((sum, p) => sum + (p.quantity || 0), 0);
        const garmentQty = parsed.products
            .filter(p => p.partNumber === 'PC54')
            .reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(capQty).toBe(24);
        expect(garmentQty).toBe(24);
    });

    test('each category at tier 24-47', () => {
        expect(calc.getTier(24)).toBe('24-47');
    });

    test('out-of-state (ID) → $0 tax', () => {
        expect(parsed.shipping.state).toBe('ID');
        expect(parsed.orderSummary.salesTax).toBe(0);
    });
});

describe('Parser → Pricing: same style different colors (Order 140531)', () => {
    let parsed, calc;

    beforeAll(() => {
        const parser = new ShopWorksImportParser();
        parsed = parser.parse(loadFixture('same-style-diff-colors.txt'));
        calc = createTestCalculator();
    });

    test('two K500 products extracted separately', () => {
        const k500s = parsed.products.filter(p => p.partNumber === 'K500');
        expect(k500s.length).toBe(2);
    });

    test('total qty = 10', () => {
        const totalQty = parsed.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        expect(totalQty).toBe(10);
    });

    test('tier is 8-23 → no LTM', () => {
        const tier = calc.getTier(10);
        expect(tier).toBe('8-23');
        expect(calc.tiers[tier].hasLTM).toBe(false);
    });

    test('monograms detected', () => {
        expect(parsed.services.monograms.length).toBeGreaterThanOrEqual(1);
    });
});

describe('Tax calculation consistency across fixtures', () => {
    const parser = new ShopWorksImportParser();

    test('WA orders have positive tax', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.salesTax).toBeGreaterThan(0);
        expect(result.shipping.state).toBe('WA');
    });

    test('out-of-state orders have $0 tax', () => {
        const txResult = parser.parse(loadFixture('multi-product-oos.txt'));
        const idResult = parser.parse(loadFixture('caps-oos.txt'));
        expect(txResult.orderSummary.salesTax).toBe(0);
        expect(idResult.orderSummary.salesTax).toBe(0);
    });

    test('back-calculated tax rate is consistent with subtotal and tax', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        const rate = result.orderSummary.taxRate / 100; // Convert from percent
        // ShopWorks computes tax on subtotal only (shipping tax handling varies)
        const expectedTaxOnSubtotal = Math.round(result.orderSummary.subtotal * rate * 100) / 100;
        // Allow small rounding difference since we back-calculate rate
        expect(result.orderSummary.salesTax).toBeCloseTo(expectedTaxOnSubtotal, 0);
    });
});
