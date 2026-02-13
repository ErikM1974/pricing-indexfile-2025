/**
 * Batch 4 Parser Tests — 8 real ShopWorks orders
 *
 * Edge cases covered:
 * - DGT-002 digitizing revision fee with amount tracking
 * - AL (Additional Logo) with quantity > 1
 * - Empty part number description-only lines → notes
 * - Monograms interleaved with products (5 person names)
 * - _OSFA suffix products (BG805, STC31, CP90, CT89350303)
 * - Size-suffixed products merging (CT102199 + _2X + _3X)
 * - Multiple DECG items per order
 * - DECG-only order (no SanMar products)
 * - Beanie cap detection from description
 * - Multiple design numbers per order
 * - "S (Other)" / "XXXL (Other)" size cleaning
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks_orders_batch4.txt');

function loadBatchOrders() {
    const text = fs.readFileSync(BATCH_FILE, 'utf8');
    const chunks = text.split(/^={10,}\s*ORDER\s+\d+\s*={10,}$/m)
        .map(c => c.replace(/^={10,}\s*$/gm, '').trim())
        .filter(c => c.length > 0 && /Order\s*#:/i.test(c));
    return chunks;
}

let orders;
beforeAll(() => {
    orders = loadBatchOrders();
});

describe('Batch 4 — Order 1 (#135217): Simple 4-product garment order', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('135217');
    });

    test('extracts 4 products', () => {
        expect(result.products).toHaveLength(4);
    });

    test('all products have correct part numbers', () => {
        const pns = result.products.map(p => p.partNumber);
        expect(pns).toEqual(['CT105292', 'CT105291', 'W668', 'W672']);
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Veneer Chip Transport, Inc.');
    });

    test('extracts salesperson', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('extracts design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38400');
    });

    test('order summary totals correct', () => {
        expect(result.orderSummary.subtotal).toBe(226.00);
        expect(result.orderSummary.salesTax).toBe(22.83);
        expect(result.orderSummary.total).toBe(248.83);
    });

    test('no warnings or unmatched lines', () => {
        expect(result.warnings).toHaveLength(0);
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 2 (#135218): Size-suffixed _2X products, 2 colors same style', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses 3 products (OG101_2X x2 colors, PC61LS_2X)', () => {
        expect(result.products).toHaveLength(3);
    });

    test('OG101 base style extracted from _2X suffix', () => {
        const og = result.products.filter(p => p.partNumber === 'OG101');
        expect(og).toHaveLength(2);
    });

    test('OG101 sizes correctly extracted as 2XL', () => {
        for (const p of result.products.filter(p => p.partNumber === 'OG101')) {
            expect(p.sizes).toEqual({ '2XL': 2 });
        }
    });

    test('OG101 two different colors', () => {
        const colors = result.products
            .filter(p => p.partNumber === 'OG101')
            .map(p => p.color);
        expect(colors).toContain('Rogue Grey');
        expect(colors).toContain('Blacktop');
    });

    test('PC61LS extracted from PC61LS_2X', () => {
        const pc = result.products.find(p => p.partNumber === 'PC61LS');
        expect(pc).toBeDefined();
        expect(pc.sizes).toEqual({ '2XL': 2 });
    });

    test('3 design numbers extracted', () => {
        expect(result.designNumbers).toHaveLength(3);
    });

    test('no warnings or unmatched lines', () => {
        expect(result.warnings).toHaveLength(0);
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 3 (#135251): Monograms interleaved, _OSFA, beanie', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('extracts 11 product entries (before batch runner merge)', () => {
        expect(result.products).toHaveLength(11);
    });

    test('5 monograms with person names', () => {
        expect(result.services.monograms).toHaveLength(5);
        const names = result.services.monograms.map(m => m.description);
        expect(names).toContain('Embroider Names - Eddie');
        expect(names).toContain('Embroider Names - Vince Carlile-Kovács');
        expect(names).toContain('Embroider Names - Kiya');
        expect(names).toContain('Embroider Names - Haven');
        expect(names).toContain('Embroider Names - Nate Saffery');
    });

    test('monograms all at $12.50', () => {
        for (const m of result.services.monograms) {
            expect(m.unitPrice).toBe(12.50);
        }
    });

    test('BG805_OSFA → BG805 with OSFA size', () => {
        const bg = result.products.find(p => p.partNumber === 'BG805');
        expect(bg).toBeDefined();
        expect(bg.sizes).toEqual({ OSFA: 1 });
    });

    test('STC31_OSFA → STC31 with OSFA size (11 beanies)', () => {
        const stc = result.products.find(p => p.partNumber === 'STC31');
        expect(stc).toBeDefined();
        expect(stc.sizes).toEqual({ OSFA: 11 });
    });

    test('ST258_2X → ST258 with 2XL size', () => {
        const st2x = result.products.find(p => p.partNumber === 'ST258' && p.sizes['2XL']);
        expect(st2x).toBeDefined();
        expect(st2x.sizes).toEqual({ '2XL': 1 });
    });

    test('"S (Other)" cleaned to S size', () => {
        const j318 = result.products.find(p => p.partNumber === 'J318');
        expect(j318).toBeDefined();
        expect(j318.sizes).toHaveProperty('S');
    });

    test('order summary correct', () => {
        expect(result.orderSummary.subtotal).toBe(1246.50);
        expect(result.orderSummary.total).toBe(1372.40);
        expect(result.orderSummary.paidToDate).toBe(1372.40);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('no warnings or unmatched lines', () => {
        expect(result.warnings).toHaveLength(0);
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 4 (#135256): DGT-002 fee, AL, empty PN, size merging', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('DGT-002 detected as digitizing', () => {
        expect(result.services.digitizing).toBe(true);
        expect(result.services.digitizingCount).toBe(1);
    });

    test('DGT-002 code stored in digitizingCodes', () => {
        expect(result.services.digitizingCodes).toContain('DGT-002');
    });

    test('DGT-002 fee amount ($50) tracked in digitizingFees', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        expect(result.services.digitizingFees[0]).toEqual({
            code: 'DGT-002',
            amount: 50,
            description: 'Fee for revising existing digitized designs to meet new specifications'
        });
    });

    test('AL detected with quantity 2', () => {
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(2);
        expect(result.services.additionalLogos[0].unitPrice).toBe(12.50);
    });

    test('3 product entries (CT102199 base + _2X + _3X)', () => {
        expect(result.products).toHaveLength(3);
        const styles = result.products.map(p => p.partNumber);
        expect(styles.every(s => s === 'CT102199')).toBe(true);
    });

    test('empty PN "Taylor Logo ONLY - RC" stored in notes', () => {
        expect(result.notes).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Taylor Logo ONLY')
            ])
        );
    });

    test('2 design numbers extracted', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('38871');
        expect(result.designNumbers[1]).toContain('32167.07');
    });

    test('payment terms = Net 30', () => {
        expect(result.paymentTerms).toBe('Net 30');
    });

    test('no warnings or unmatched lines', () => {
        expect(result.warnings).toHaveLength(0);
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 5 (#135257): 40 caps (CP90_OSFA)', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('1 product: CP90 with OSFA size', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('CP90');
        expect(result.products[0].sizes).toEqual({ OSFA: 40 });
    });

    test('PO number is "beanies"', () => {
        expect(result.purchaseOrderNumber).toBe('beanies');
    });

    test('customer is PICK-QUICK', () => {
        expect(result.customer.company).toBe('PICK-QUICK Operating Company LLC');
    });

    test('no warnings or unmatched lines', () => {
        expect(result.warnings).toHaveLength(0);
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 6 (#135258): North Face + Carhartt backpack + DECG', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('3 products (NF0A7V4G, NF0A3LHL, CT89350303)', () => {
        expect(result.products).toHaveLength(3);
        const pns = result.products.map(p => p.partNumber);
        expect(pns).toContain('NF0A7V4G');
        expect(pns).toContain('NF0A3LHL');
        expect(pns).toContain('CT89350303');
    });

    test('CT89350303_OSFA → CT89350303 with OSFA size', () => {
        const ct = result.products.find(p => p.partNumber === 'CT89350303');
        expect(ct).toBeDefined();
        expect(ct.sizes).toEqual({ OSFA: 1 });
    });

    test('DECG x3 detected', () => {
        expect(result.decgItems).toHaveLength(1);
        expect(result.decgItems[0].quantity).toBe(3);
        expect(result.decgItems[0].unitPrice).toBe(15);
    });

    test('no warnings (DECG warning is at pricing level, not parser)', () => {
        // DECG API fallback warning comes from pricing, not parsing
        const parserWarnings = result.warnings.filter(w => !w.includes('DECG API'));
        expect(parserWarnings).toHaveLength(0);
    });

    test('no unmatched lines', () => {
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 7 (#135284): Multi DECG, AL, empty PN, 3 designs', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('6 product entries (CT104078, OE720, NF0A8ENN, NF0A8BUD, CT102199 x2)', () => {
        expect(result.products).toHaveLength(6);
    });

    test('NF0A8ENN_2X → NF0A8ENN with 2XL size', () => {
        const nf = result.products.find(p => p.partNumber === 'NF0A8ENN');
        expect(nf).toBeDefined();
        expect(nf.sizes).toEqual({ '2XL': 1 });
    });

    test('NF0A8BUD_2X → NF0A8BUD with 2XL size', () => {
        const nf = result.products.find(p => p.partNumber === 'NF0A8BUD');
        expect(nf).toBeDefined();
        expect(nf.sizes).toEqual({ '2XL': 1 });
    });

    test('2 DECG items (qty 1 each, $20 each)', () => {
        expect(result.decgItems).toHaveLength(2);
        for (const d of result.decgItems) {
            expect(d.quantity).toBe(1);
            expect(d.unitPrice).toBe(20);
        }
    });

    test('AL x1 detected', () => {
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(1);
    });

    test('empty PN "Taylor and Exterior Metal" in notes', () => {
        expect(result.notes).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Taylor and Exterior Metal')
            ])
        );
    });

    test('3 design numbers', () => {
        expect(result.designNumbers).toHaveLength(3);
    });

    test('no unmatched lines', () => {
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — Order 8 (#135303): DECG-only order', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('0 SanMar products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('2 DECG items (26 + 3 = 29 total)', () => {
        expect(result.decgItems).toHaveLength(2);
        expect(result.decgItems[0].quantity).toBe(26);
        expect(result.decgItems[1].quantity).toBe(3);
        const total = result.decgItems.reduce((s, d) => s + d.quantity, 0);
        expect(total).toBe(29);
    });

    test('DECG unit price is $20', () => {
        for (const d of result.decgItems) {
            expect(d.unitPrice).toBe(20);
        }
    });

    test('DECG descriptions include garment types', () => {
        const descs = result.decgItems.map(d => d.description);
        expect(descs.some(d => d.includes('Polo'))).toBe(true);
        expect(descs.some(d => d.includes('Jakcets'))).toBe(true); // typo in original
    });

    test('order summary matches — DECG-only total', () => {
        expect(result.orderSummary.subtotal).toBe(580.00);
        expect(result.orderSummary.salesTax).toBe(58.58);
        expect(result.orderSummary.total).toBe(638.58);
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38880.01');
    });

    test('no unmatched lines', () => {
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

describe('Batch 4 — digitizingFees tracking', () => {
    test('DGT-002 fee amount tracked on order with DGT item', () => {
        const parser = new ShopWorksImportParser();
        const result = parser.parse(orders[3]); // Order 4
        expect(result.services.digitizingFees).toBeDefined();
        expect(result.services.digitizingFees).toHaveLength(1);
        expect(result.services.digitizingFees[0].code).toBe('DGT-002');
        expect(result.services.digitizingFees[0].amount).toBe(50);
    });

    test('orders without DGT items have no digitizingFees array', () => {
        const parser = new ShopWorksImportParser();
        const result = parser.parse(orders[0]); // Order 1 — no digitizing
        expect(result.services.digitizingFees).toBeUndefined();
    });
});
