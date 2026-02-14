/**
 * Edge Case Tests for ShopWorks Parser
 * Tests: INVALID_PARTS filtering, Gift Code handling, classifyPartNumber(), order details
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('classifyPartNumber() — service codes', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('DD → digitizing', () => {
        expect(parser.classifyPartNumber('DD')).toBe('digitizing');
    });

    test('DGT-001 → digitizing', () => {
        expect(parser.classifyPartNumber('DGT-001')).toBe('digitizing');
    });

    test('DGT-002 → digitizing (revision fee)', () => {
        expect(parser.classifyPartNumber('DGT-002')).toBe('digitizing');
    });

    test('DGT-003 → digitizing', () => {
        expect(parser.classifyPartNumber('DGT-003')).toBe('digitizing');
    });

    test('DGT-004 → digitizing', () => {
        expect(parser.classifyPartNumber('DGT-004')).toBe('digitizing');
    });

    test('AL → al (additional logo)', () => {
        expect(parser.classifyPartNumber('AL')).toBe('al');
    });

    test('FB → fb (full back)', () => {
        expect(parser.classifyPartNumber('FB')).toBe('fb');
    });

    test('CB → cb (cap back)', () => {
        expect(parser.classifyPartNumber('CB')).toBe('cb');
    });

    test('CS → cs (cap side)', () => {
        expect(parser.classifyPartNumber('CS')).toBe('cs');
    });

    test('DECG → decg (customer garment)', () => {
        expect(parser.classifyPartNumber('DECG')).toBe('decg');
    });

    test('DECC → decc (customer cap)', () => {
        expect(parser.classifyPartNumber('DECC')).toBe('decc');
    });

    test('SECC → sewing (cap sewing, NOT decc)', () => {
        expect(parser.classifyPartNumber('SECC')).toBe('sewing');
    });

    test('DDE → digitizing (edit digitizing)', () => {
        expect(parser.classifyPartNumber('DDE')).toBe('digitizing');
    });

    test('DDT → digitizing (text digitizing)', () => {
        expect(parser.classifyPartNumber('DDT')).toBe('digitizing');
    });

    test('DT → design-transfer', () => {
        expect(parser.classifyPartNumber('DT')).toBe('design-transfer');
    });

    test('CTR-GARMT → contract', () => {
        expect(parser.classifyPartNumber('CTR-GARMT')).toBe('contract');
    });

    test('CTR-CAP → contract', () => {
        expect(parser.classifyPartNumber('CTR-CAP')).toBe('contract');
    });

    test('CDP → digital-print', () => {
        expect(parser.classifyPartNumber('CDP')).toBe('digital-print');
    });

    test('CDP 5x5 → digital-print', () => {
        expect(parser.classifyPartNumber('CDP 5x5')).toBe('digital-print');
    });

    test('PALLET → digital-print', () => {
        expect(parser.classifyPartNumber('PALLET')).toBe('digital-print');
    });

    test('MONOGRAM → monogram', () => {
        expect(parser.classifyPartNumber('MONOGRAM')).toBe('monogram');
    });

    test('NAME → monogram', () => {
        expect(parser.classifyPartNumber('NAME')).toBe('monogram');
    });

    test('RUSH → rush', () => {
        expect(parser.classifyPartNumber('RUSH')).toBe('rush');
    });

    test('ART → art', () => {
        expect(parser.classifyPartNumber('ART')).toBe('art');
    });

    test('ART-CHARGE → art', () => {
        expect(parser.classifyPartNumber('ART-CHARGE')).toBe('art');
    });

    test('GRT-50 → patch-setup', () => {
        expect(parser.classifyPartNumber('GRT-50')).toBe('patch-setup');
    });

    test('GRT-75 → graphic-design', () => {
        expect(parser.classifyPartNumber('GRT-75')).toBe('graphic-design');
    });

    test('LTM → ltm', () => {
        expect(parser.classifyPartNumber('LTM')).toBe('ltm');
    });

    test('SEG → sewing', () => {
        expect(parser.classifyPartNumber('SEG')).toBe('sewing');
    });

    test('AS-GARM → additional-stitches', () => {
        expect(parser.classifyPartNumber('AS-GARM')).toBe('additional-stitches');
    });

    test('AS-CAP → additional-stitches', () => {
        expect(parser.classifyPartNumber('AS-CAP')).toBe('additional-stitches');
    });

    test('SHIPPING → shipping', () => {
        expect(parser.classifyPartNumber('SHIPPING')).toBe('shipping');
    });

    test('FREIGHT → shipping', () => {
        expect(parser.classifyPartNumber('FREIGHT')).toBe('shipping');
    });
});

describe('classifyPartNumber() — INVALID_PARTS', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('WEIGHT → weight (per-person service)', () => {
        expect(parser.classifyPartNumber('WEIGHT')).toBe('weight');
    });

    test('GIFT CODE → invalid', () => {
        expect(parser.classifyPartNumber('GIFT CODE')).toBe('invalid');
    });

    test('DISCOUNT → invalid', () => {
        expect(parser.classifyPartNumber('DISCOUNT')).toBe('invalid');
    });

    test('TAX → invalid', () => {
        expect(parser.classifyPartNumber('TAX')).toBe('invalid');
    });

    test('TOTAL → invalid', () => {
        expect(parser.classifyPartNumber('TOTAL')).toBe('invalid');
    });

    test('TEST → invalid', () => {
        expect(parser.classifyPartNumber('TEST')).toBe('invalid');
    });

    test('numeric-looking "49.99" → invalid', () => {
        expect(parser.classifyPartNumber('49.99')).toBe('invalid');
    });
});

describe('classifyPartNumber() — products', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('PC54 → product', () => {
        expect(parser.classifyPartNumber('PC54')).toBe('product');
    });

    test('K500 → product', () => {
        expect(parser.classifyPartNumber('K500')).toBe('product');
    });

    test('C112 → product', () => {
        expect(parser.classifyPartNumber('C112')).toBe('product');
    });

    test('PC61LS → product', () => {
        expect(parser.classifyPartNumber('PC61LS')).toBe('product');
    });

    test('PC54_2X → product', () => {
        expect(parser.classifyPartNumber('PC54_2X')).toBe('product');
    });

    test('null/empty → comment', () => {
        expect(parser.classifyPartNumber(null)).toBe('comment');
        expect(parser.classifyPartNumber('')).toBe('comment');
        expect(parser.classifyPartNumber('  ')).toBe('comment');
    });

    test('case insensitive: dd → digitizing', () => {
        expect(parser.classifyPartNumber('dd')).toBe('digitizing');
    });

    test('case insensitive: al → al', () => {
        expect(parser.classifyPartNumber('al')).toBe('al');
    });
});

describe('Gift Code handling', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('gift-code.txt'));
    });

    test('GIFT CODE goes to reviewItems, not products', () => {
        const giftInProducts = result.products.find(p => p.partNumber === 'GIFT CODE');
        expect(giftInProducts).toBeUndefined();
    });

    test('WEIGHT line is filtered out entirely', () => {
        const weightInProducts = result.products.find(p => p.partNumber === 'WEIGHT');
        expect(weightInProducts).toBeUndefined();
    });
});

describe('DISCOUNT handling', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('caps-oos.txt'));
    });

    test('DISCOUNT goes to reviewItems or is filtered, not products', () => {
        const discountInProducts = result.products.find(p => p.partNumber === 'DISCOUNT');
        expect(discountInProducts).toBeUndefined();
    });
});

describe('Order header parsing', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('extracts order ID', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderId).toBe('140666');
    });

    test('extracts salesperson', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.salesRep.name).toBe('Erik');
    });

    test('extracts customer company', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.customer.company).toBe('Absher Construction');
    });

    test('extracts customer contact name', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.customer.contactName).toBe('John Smith');
    });

    test('extracts customer email', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.customer.email).toBe('john@absher.com');
    });
});

describe('Order details parsing', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('simple-garment.txt'));
    });

    test('extracts PO number', () => {
        expect(result.purchaseOrderNumber).toBe('PO-2026-001');
    });

    test('extracts date order placed', () => {
        expect(result.dateOrderPlaced).toBe('02/01/2026');
    });

    test('extracts req ship date', () => {
        expect(result.reqShipDate).toBe('02/15/2026');
    });

    test('extracts drop dead date', () => {
        expect(result.dropDeadDate).toBe('02/20/2026');
    });

    test('extracts payment terms', () => {
        expect(result.paymentTerms).toBe('Net 30');
    });

    test('extracts phone number', () => {
        expect(result.customer.phone).toBe('253-555-1234');
    });
});

describe('Order summary parsing', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('extracts subtotal', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.subtotal).toBe(330.00);
    });

    test('extracts sales tax', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.salesTax).toBe(33.33);
    });

    test('extracts shipping', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.shipping).toBe(12.99);
    });

    test('extracts total', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.total).toBe(376.32);
    });

    test('out-of-state order has $0 sales tax', () => {
        const result = parser.parse(loadFixture('multi-product-oos.txt'));
        expect(result.orderSummary.salesTax).toBe(0);
    });

    test('back-calculates tax rate from subtotal and tax', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        // taxRate = (33.33 / 330.00) * 100 = ~10.1
        expect(result.orderSummary.taxRate).toBeCloseTo(10.1, 0);
    });
});

describe('Paid To Date / Balance parsing', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('extracts paidToDate', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.paidToDate).toBe(3.39);
    });

    test('extracts balance', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderSummary.balance).toBe(372.93);
    });

    test('defaults paidToDate to 0 when missing', () => {
        const result = parser.parse(loadFixture('caps-oos.txt'));
        expect(result.orderSummary.paidToDate).toBe(0);
    });

    test('defaults balance to 0 when missing', () => {
        const result = parser.parse(loadFixture('caps-oos.txt'));
        expect(result.orderSummary.balance).toBe(0);
    });
});

describe('Note section parsing', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('extracts orderNotes from Note section', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.orderNotes).toContain('Billing Questions');
    });

    test('defaults orderNotes to empty string when missing', () => {
        const result = parser.parse(loadFixture('caps-oos.txt'));
        expect(result.orderNotes).toBe('');
    });

    test('orderNotes not in unmatchedLines', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        const noteLeaks = result.unmatchedLines.filter(
            u => u.line.includes('Billing Questions') || u.line.includes('accounting@')
        );
        expect(noteLeaks).toHaveLength(0);
    });
});

describe('Service detection via fixtures', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('simple order detects digitizing', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.services.digitizing).toBe(true);
    });

    test('mixed order detects rush', () => {
        const result = parser.parse(loadFixture('mixed-cap-garment.txt'));
        expect(result.services.rush).not.toBeNull();
    });

    test('same-style order detects monograms', () => {
        const result = parser.parse(loadFixture('same-style-diff-colors.txt'));
        expect(result.services.monograms.length).toBeGreaterThanOrEqual(1);
    });
});

describe('Real ShopWorks export format', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('real-format-single.txt'));
    });

    test('handles Company: in order header without unmatched lines', () => {
        const companyLeaks = result.unmatchedLines.filter(
            u => u.section === 'OrderHeader' && u.line.includes('Company:')
        );
        expect(companyLeaks).toHaveLength(0);
    });

    test('handles Phone:/Fax: in header without unmatched lines', () => {
        const headerLeaks = result.unmatchedLines.filter(
            u => u.section === 'OrderHeader' && (u.line.includes('Phone:') || u.line.includes('Fax:'))
        );
        expect(headerLeaks).toHaveLength(0);
    });

    test('handles empty Paid To Date: without unmatched lines', () => {
        const paidLeaks = result.unmatchedLines.filter(
            u => u.section === 'OrderSummary' && u.line.includes('Paid To Date')
        );
        expect(paidLeaks).toHaveLength(0);
        expect(result.orderSummary.paidToDate).toBe(0);
    });

    test('handles empty Shipping: without unmatched lines', () => {
        // This fixture has shipping with a value — test empty via inline parse
        const parser2 = new ShopWorksImportParser();
        const r2 = parser2.parse([
            '**************',
            'Order #:999999',
            '**************',
            'Order Summary',
            'Subtotal:$100.00',
            'Shipping:',
            'Total:$100.00',
        ].join('\n'));
        const shippingLeaks = r2.unmatchedLines.filter(
            u => u.section === 'OrderSummary' && u.line.includes('Shipping')
        );
        expect(shippingLeaks).toHaveLength(0);
    });

    test('parses comma amounts correctly (e.g. 1,100.00)', () => {
        const parser2 = new ShopWorksImportParser();
        const r2 = parser2.parse([
            '**************',
            'Order #:999998',
            '**************',
            'Order Summary',
            'Subtotal:$1,100.00',
            'Total:$1,100.00',
        ].join('\n'));
        expect(r2.orderSummary.subtotal).toBe(1100.00);
    });

    test('zero unmatched lines on real-format fixture', () => {
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Order summary parsing — multi-comma amounts', () => {
    test('handles multi-comma amounts (e.g. 19,456.00)', () => {
        const parser = new ShopWorksImportParser();
        const result = parser.parse([
            '**************',
            'Order #:999997',
            '**************',
            'Order Summary',
            'Subtotal:$19,456.00',
            'Sales Tax:$1,000,000.50',
            'Total:$1,019,456.50',
        ].join('\n'));
        expect(result.orderSummary.subtotal).toBe(19456.00);
        expect(result.orderSummary.salesTax).toBe(1000000.50);
        expect(result.orderSummary.total).toBe(1019456.50);
    });
});
