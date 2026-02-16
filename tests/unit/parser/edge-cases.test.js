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

describe('Red Kap Regular size suffixes (_MR, _LR, _2XLR)', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('SIZE_MAP: MR → M', () => {
        expect(parser.SIZE_MAP['MR']).toBe('M');
    });

    test('SIZE_MAP: LR → L', () => {
        expect(parser.SIZE_MAP['LR']).toBe('L');
    });

    test('SIZE_MAP: 2XLR → 2XL', () => {
        expect(parser.SIZE_MAP['2XLR']).toBe('2XL');
    });

    test('SIZE_MAP: XLR → XL (regression)', () => {
        expect(parser.SIZE_MAP['XLR']).toBe('XL');
    });

    test('_2XLR suffix is not falsely matched by _LR', () => {
        const result = parser.extractSizeFromPartNumber('SP24_2XLR');
        expect(result.size).toBe('2XLR');
        expect(result.cleanedPartNumber).toBe('SP24');
    });

    test('cleanPartNumber strips _MR suffix', () => {
        expect(parser.cleanPartNumber('SP24_MR')).toBe('SP24');
    });

    test('cleanPartNumber strips _2XLR suffix', () => {
        expect(parser.cleanPartNumber('SP24_2XLR')).toBe('SP24');
    });
});

describe('Multiple tracking numbers', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('single tracking entry returns array of length 1', () => {
        const result = parser.parse([
            '**************',
            'Order #:999990',
            '**************',
            'Package Tracking',
            'Carrier:UPS',
            'Tracking #:1Z999AA10123456784',
        ].join('\n'));
        expect(Array.isArray(result.packageTracking)).toBe(true);
        expect(result.packageTracking).toHaveLength(1);
        expect(result.packageTracking[0].carrier).toBe('UPS');
        expect(result.packageTracking[0].trackingNumber).toBe('1Z999AA10123456784');
    });

    test('two tracking entries returns array of length 2', () => {
        const result = parser.parse([
            '**************',
            'Order #:999989',
            '**************',
            'Package Tracking',
            'Carrier:UPS',
            'Tracking #:1Z999AA10123456784',
            'Carrier:UPS',
            'Tracking #:1Z999AA10123456785',
        ].join('\n'));
        expect(Array.isArray(result.packageTracking)).toBe(true);
        expect(result.packageTracking).toHaveLength(2);
        expect(result.packageTracking[0].trackingNumber).toBe('1Z999AA10123456784');
        expect(result.packageTracking[1].trackingNumber).toBe('1Z999AA10123456785');
    });

    test('no tracking section leaves packageTracking undefined', () => {
        const result = parser.parse([
            '**************',
            'Order #:999988',
            '**************',
            'Order Summary',
            'Subtotal:$100.00',
            'Total:$100.00',
        ].join('\n'));
        expect(result.packageTracking).toBeUndefined();
    });
});

// ============================================================
// BATCH 9: Edge cases — numeric PNs, "Left Chest" as PN,
// missing Design/Shipping sections, 3 ALs, double-comma address
// ============================================================

const BATCH9_FILE = path.join(FIXTURES_DIR, 'shopworks_orders_batch9.txt');

function loadBatch9Orders() {
    const text = fs.readFileSync(BATCH9_FILE, 'utf8');
    return text.split(/^={10,}\s*ORDER\s+\d+\s*={10,}$/m)
        .map(c => c.replace(/^={10,}\s*$/gm, '').trim())
        .filter(c => c.length > 0 && /Order\s*#:/i.test(c));
}

let batch9Orders;
beforeAll(() => {
    batch9Orders = loadBatch9Orders();
});

describe('Batch 9 — batch split', () => {
    test('splits into 8 orders', () => {
        expect(batch9Orders).toHaveLength(8);
    });
});

describe('Batch 9 — Order 136187 (middle initial, DD, PC54R)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[0]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136187');
    });

    test('middle initial preserved in orderedBy', () => {
        expect(result.customer.contactName).toBe('Sheryl G. McIntire');
    });

    test('DD digitizing found', () => {
        expect(result.services.digitizing).toBe(true);
        expect(result.services.digitizingCount).toBe(1);
    });

    test('PC54R product qty=9', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('PC54R');
        expect(result.products[0].quantity).toBe(9);
    });

    test('design number captured', () => {
        expect(result.designNumbers[0]).toContain('39077');
    });
});

describe('Batch 9 — Order 136205 (numeric PN 1379757, Customer Pickup)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[1]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136205');
    });

    test('1379757 classified as product (not non-SanMar)', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('1379757');
        expect(result.products[0].quantity).toBe(30);
    });

    test('no customProducts for this order', () => {
        expect(result.customProducts).toHaveLength(0);
    });

    test('shipping method is Customer Pickup', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('design number captured', () => {
        expect(result.designNumbers[0]).toContain('14566.06');
    });
});

describe('Batch 9 — Order 136209 (4 designs, 3 ALs, 4 monograms, DECG)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[2]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136209');
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
        expect(result.designNumbers.some(d => d.includes('38797'))).toBe(true);
        expect(result.designNumbers.some(d => d.includes('38844'))).toBe(true);
    });

    test('3 AL entries', () => {
        expect(result.services.additionalLogos).toHaveLength(3);
        expect(result.services.additionalLogos[0].description).toMatch(/Ford/);
        expect(result.services.additionalLogos[1].description).toMatch(/Canada/);
        expect(result.services.additionalLogos[2].description).toMatch(/USA/);
    });

    test('4 monograms total qty=9', () => {
        expect(result.services.monograms).toHaveLength(4);
        const totalMonoQty = result.services.monograms.reduce((s, m) => s + m.quantity, 0);
        expect(totalMonoQty).toBe(9);
    });

    test('monogram annotation "25/14" preserved', () => {
        const saundra = result.services.monograms.find(m => m.description.includes('Saundra'));
        expect(saundra).toBeDefined();
        expect(saundra.description).toMatch(/25\/14/);
    });

    test('DECG qty=6', () => {
        expect(result.decgItems).toHaveLength(1);
        expect(result.decgItems[0].quantity).toBe(6);
    });

    test('CSW175 product qty=3', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('CSW175');
        expect(result.products[0].quantity).toBe(3);
    });
});

describe('Batch 9 — Order 136217 ("Added-on" separator, 799802 variants)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[3]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136217');
    });

    test('"Added-on" NOT in products', () => {
        const addedOn = result.products.find(p => p.description && p.description.includes('Added-on'));
        expect(addedOn).toBeUndefined();
    });

    test('799802 variants cleaned to base "799802"', () => {
        const bases = result.products.map(p => p.partNumber);
        expect(bases.every(pn => pn === '799802')).toBe(true);
    });

    test('total quantity across all items = 39', () => {
        const total = result.products.reduce((s, p) => s + p.quantity, 0);
        expect(total).toBe(39);
    });

    test('first item unitPrice=29.50 (not 59.00 from description)', () => {
        expect(result.products[0].unitPrice).toBe(29.50);
    });

    test('two colors present (Black, Anthracite)', () => {
        const colors = result.products.map(p => {
            const match = p.description.match(/,\s*([^,]+)$/);
            return match ? match[1].trim() : '';
        });
        expect(colors).toContain('Black');
        expect(colors).toContain('Anthracite');
    });
});

describe('Batch 9 — Order 136226 (DECG-only, double-comma address, Design #274.01)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[4]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136226');
    });

    test('DECG-only: 0 products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('DECG qty=2', () => {
        expect(result.decgItems).toHaveLength(1);
        expect(result.decgItems[0].quantity).toBe(2);
    });

    test('double-comma address still parses state=WA, zip starts with 98391', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toMatch(/^98391/);
    });

    test('Design #274.01 captured', () => {
        expect(result.designNumbers.some(d => d.includes('274.01'))).toBe(true);
    });

    test('two design numbers total', () => {
        expect(result.designNumbers).toHaveLength(2);
    });
});

describe('Batch 9 — Order 136230 (CP90 cap, salesTax=0)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[5]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136230');
    });

    test('CP90 product qty=95', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('CP90');
        expect(result.products[0].quantity).toBe(95);
    });

    test('salesTax=0 (out-of-state)', () => {
        expect(result.orderSummary.salesTax).toBe(0);
    });

    test('taxRate is null when salesTax=0', () => {
        expect(result.orderSummary.taxRate).toBeNull();
    });
});

describe('Batch 9 — Order 136231 (MCK09321 non-SanMar + CT105291 SanMar)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[6]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136231');
    });

    test('MCK09321 in customProducts', () => {
        expect(result.customProducts.some(p => p.partNumber === 'MCK09321')).toBe(true);
    });

    test('total MCK09321 qty=12', () => {
        const mckQty = result.customProducts
            .filter(p => p.partNumber === 'MCK09321')
            .reduce((s, p) => s + p.quantity, 0);
        expect(mckQty).toBe(12);
    });

    test('CT105291 in products', () => {
        expect(result.products.some(p => p.partNumber === 'CT105291')).toBe(true);
    });

    test('CT105291 total qty=10', () => {
        const ctQty = result.products
            .filter(p => p.partNumber === 'CT105291')
            .reduce((s, p) => s + p.quantity, 0);
        expect(ctQty).toBe(10);
    });
});

describe('Batch 9 — Order 136232 ("Left Chest" guard, lululemon, no Design/Shipping)', () => {
    let result;

    beforeAll(() => {
        result = new ShopWorksImportParser().parse(batch9Orders[7]);
    });

    test('order number', () => {
        expect(result.orderId).toBe('136232');
    });

    test('"Left Chest" NOT in products (zero-price/qty guard)', () => {
        const leftChest = result.products.find(p => p.partNumber === 'Left Chest');
        expect(leftChest).toBeUndefined();
    });

    test('"World\'s Best J.D" in notes', () => {
        expect(result.notes.some(n => n.includes("World's Best J.D"))).toBe(true);
    });

    test('"Natural White" in notes', () => {
        expect(result.notes.some(n => n.includes('Natural White'))).toBe(true);
    });

    test('no Design section → empty designNumbers', () => {
        expect(result.designNumbers).toHaveLength(0);
    });

    test('no Shipping section → shipping is null/undefined', () => {
        expect(result.shipping).toBeFalsy();
    });

    test('DECG qty=1', () => {
        expect(result.decgItems).toHaveLength(1);
        expect(result.decgItems[0].quantity).toBe(1);
    });

    test('company is "lululemon" (lowercase preserved)', () => {
        expect(result.customer.company).toBe('lululemon');
    });
});

describe('Batch 9 — classifyPartNumber for new edge cases', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('"Left Chest" → product (classified as product, guard is in _classifyAndAddItem)', () => {
        expect(parser.classifyPartNumber('Left Chest')).toBe('product');
    });

    test('"1379757" → product', () => {
        expect(parser.classifyPartNumber('1379757')).toBe('product');
    });

    test('"799802" → product', () => {
        expect(parser.classifyPartNumber('799802')).toBe('product');
    });

    test('"MCK09321" → product', () => {
        expect(parser.classifyPartNumber('MCK09321')).toBe('product');
    });

    test('"CP90_OSFA" → product', () => {
        expect(parser.classifyPartNumber('CP90_OSFA')).toBe('product');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// AL "Back Logo" → DECG-FB reclassification
// ─────────────────────────────────────────────────────────────────────────────
describe('AL "Back Logo" reclassification via fixture', () => {
    let result;
    beforeAll(() => {
        const fixturePath = path.join(FIXTURES_DIR, 'al-back-logo-reclassify.txt');
        const text = fs.readFileSync(fixturePath, 'utf8');
        result = new ShopWorksImportParser().parse(text);
    });

    test('$45 AL "Back Logo" reclassified to FB (≥$40 threshold)', () => {
        const fb = result.services.additionalLogos.find(a => a.type === 'fb');
        expect(fb).toBeDefined();
        expect(fb.position).toBe('Full Back');
        expect(fb.quantity).toBe(10);
        expect(fb.reclassifiedFromAL).toBe(true);
    });

    test('$12.50 AL "Back Logo" kept as AL (below $40 threshold)', () => {
        const al = result.services.additionalLogos.find(a => a.type === 'al');
        expect(al).toBeDefined();
        expect(al.position).toBe('Back');
        expect(al.quantity).toBe(5);
        expect(al.unitPrice).toBe(12.5);
    });

    test('reclassification warning emitted for $45 item', () => {
        const w = result.warnings.find(w => w.includes('reclassified as Full Back'));
        expect(w).toBeDefined();
        expect(w).toContain('$45');
    });

    test('review warning emitted for $12.50 item', () => {
        const w = result.warnings.find(w => w.includes('may be Full Back'));
        expect(w).toBeDefined();
        expect(w).toContain('$12.5');
    });

    test('2 total AL/FB items in additionalLogos', () => {
        expect(result.services.additionalLogos).toHaveLength(2);
    });
});
