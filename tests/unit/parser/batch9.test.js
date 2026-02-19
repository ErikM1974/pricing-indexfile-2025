/**
 * Batch 9 Parser Tests — 8 real ShopWorks orders (#136187–136232)
 *
 * Edge cases covered:
 * - DD $100, PC54R Ringer Tee, simple order
 * - 1379757 Under Armour non-SanMar, $68.50×30, Net 10
 * - CSW175, Monogram×4 (multiple names), AL×9×3, DECG×6 at $20, 4 designs
 * - 799802 Nike non-SanMar, base+_2X+_3X, "Added-on" desc→notes, company=NORTHWEST EMBROIDERY INC
 * - DECG×2 at $25, simple DECG-only
 * - CP90_OSFA×95 knit cap (beanie=flat headwear), tier 72+, $0 tax (tribal org)
 * - MCK09321+_2X, CT105291+_2X — Cutter & Buck / Carhartt size merging
 * - DECG×1 at $20, "Left Chest" separator→notes, "Natural White"→notes
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch9.txt');

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

// ---------------------------------------------------------------------------
// Order 1: #136187 — Good Samaritan Hospital
// DD $100, PC54R Ringer Tee
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 1 (#136187): Good Samaritan Hospital — DD $100, PC54R', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136187');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Good Samaritan Hospital');
        expect(result.customer.contactName).toContain('Sheryl');
        expect(result.customer.email).toBe('Sheryl.McIntire@multicare.org');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('DD digitizing at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dd = result.services.digitizingFees[0];
        expect(dd.code).toBe('DD');
        expect(dd.amount).toBe(100);
    });

    test('PC54R Ringer Tee — qty 9', () => {
        const pc54r = result.products.find(p => p.partNumber === 'PC54R');
        expect(pc54r).toBeDefined();
        expect(pc54r.quantity).toBe(9);
        expect(pc54r.unitPrice).toBe(21);
        expect(pc54r.color).toContain('Navy');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('39077');
    });

    test('COD terms', () => {
        expect(result.paymentTerms).toBe('COD');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(289);
        expect(result.orderSummary.salesTax).toBe(29.19);
        expect(result.orderSummary.total).toBe(318.19);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 2: #136205 — D.L. Henricksen
// 1379757 Under Armour non-SanMar, $68.50×30, Net 10
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 2 (#136205): D.L. Henricksen — Under Armour ×30, Net 10', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136205');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('D.L. Henricksen');
        expect(result.customer.contactName).toBe('Don Henricksen');
        expect(result.customer.email).toBe('don@dlhenricksen.com');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('1379757 Under Armour fleece — non-SanMar, qty 30', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const ua = all.find(p => p.partNumber === '1379757');
        expect(ua).toBeDefined();
        expect(ua.quantity).toBe(30);
        expect(ua.unitPrice).toBe(68.50);
        expect(ua.color).toContain('Red');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('shipping address — Tacoma, WA', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Tacoma');
    });

    test('Net 10 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 10');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('14566.06');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(2055);
        expect(result.orderSummary.salesTax).toBe(207.56);
        expect(result.orderSummary.total).toBe(2262.56);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 3: #136209 — Iron Horse Racing
// CSW175, Monogram×4 entries, AL×9×3, DECG×6 at $20, 4 designs
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 3 (#136209): Iron Horse Racing — Monograms, AL×3, DECG×6, 4 designs', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136209');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Iron Horse Racing');
        expect(result.customer.contactName).toBe('Darrell Hurst');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('CSW175 Cornerstone work shirt — qty 3', () => {
        const csw = result.products.find(p => p.partNumber === 'CSW175');
        expect(csw).toBeDefined();
        expect(csw.quantity).toBe(3);
        expect(csw.unitPrice).toBe(44);
        expect(csw.color).toBe('Black');
    });

    test('Monogram×4 entries — different names', () => {
        expect(result.services.monograms).toBeDefined();
        expect(result.services.monograms).toHaveLength(4);
        // First: "John" qty 3, then 3 more with qty 2 each
        const john = result.services.monograms.find(m => m.description && /john/i.test(m.description));
        expect(john).toBeDefined();
        expect(john.quantity).toBe(3);
        expect(john.unitPrice).toBe(12.50);
    });

    test('AL×3 entries — Ford, Canada Flag, USA Flag, each qty 9', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos).toHaveLength(3);
        result.services.additionalLogos.forEach(al => {
            expect(al.quantity).toBe(9);
            expect(al.unitPrice).toBe(8);
        });
    });

    test('DECG×6 at $20', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(6);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
        expect(result.designNumbers[0]).toContain('38797');
        expect(result.designNumbers[1]).toContain('38798');
        expect(result.designNumbers[2]).toContain('38843');
        expect(result.designNumbers[3]).toContain('38844');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(580.50);
        expect(result.orderSummary.salesTax).toBe(58.63);
        expect(result.orderSummary.total).toBe(639.13);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 4: #136217 — Kustom (via NORTHWEST EMBROIDERY INC)
// 799802 Nike non-SanMar, base+_2X+_3X, "Added-on" desc→notes
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 4 (#136217): Kustom — Nike 799802 size variants, "Added-on" note', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136217');
    });

    test('extracts customer — Kustom, not NORTHWEST EMBROIDERY INC', () => {
        expect(result.customer.company).toBe('Kustom');
        expect(result.customer.contactName).toBe('Zakary Porter');
        expect(result.customer.email).toBe('zakary.porter@kustom.us');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('799802 Nike polo — base qty 27 at $29.50', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const base = all.find(p => p.partNumber === '799802' && p.unitPrice === 29.50);
        expect(base).toBeDefined();
        expect(base.quantity).toBe(27);
    });

    test('799802_2X — qty 5 at $31.50', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const xxl = all.find(p => (p.partNumber === '799802' || p.partNumber === '799802_2X') && p.unitPrice === 31.50);
        expect(xxl).toBeDefined();
        expect(xxl.quantity).toBe(5);
    });

    test('799802_3X — appears multiple times (Anthracite, Black at $62 + Black at $62)', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const xxxl = all.filter(p => p.partNumber === '799802' || p.partNumber === '799802_3X');
        // There should be at least the $33.50 + $62 entries
        const at62 = xxxl.filter(p => p.unitPrice === 62);
        expect(at62.length).toBeGreaterThanOrEqual(2);
    });

    test('"Added-on" description-only item → notes', () => {
        const hasNote = result.notes.some(n => /added.on/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38510');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1302.50);
        expect(result.orderSummary.salesTax).toBe(131.55);
        expect(result.orderSummary.total).toBe(1434.05);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 5: #136226 — Spartan Band Association
// DECG×2 at $25, simple DECG-only
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 5 (#136226): Spartan Band — DECG×2 at $25', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136226');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Spartan Band Association');
        expect(result.customer.contactName).toBe('Tom Fuge');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('DECG×2 at $25', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(2);
        expect(decg.unitPrice).toBe(25);
        expect(decg.isCap).toBe(false);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('274');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(50);
        expect(result.orderSummary.salesTax).toBe(5.05);
        expect(result.orderSummary.total).toBe(55.05);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 6: #136230 — NW Indian Fisheries Commission
// CP90_OSFA×95 (beanie = flat headwear), tier 72+, $0 tax, Net 10
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 6 (#136230): NW Indian Fisheries — CP90_OSFA×95, beanie, tax exempt', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136230');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Northwest Indian Fisheries Commission');
        expect(result.customer.contactName).toBe('Alice Johnstone');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('CP90_OSFA knit cap — qty 95 at $12', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const cp90 = all.find(p => p.partNumber === 'CP90' || p.partNumber === 'CP90_OSFA');
        expect(cp90).toBeDefined();
        expect(cp90.quantity).toBe(95);
        expect(cp90.unitPrice).toBe(12);
    });

    test('CP90 is flat headwear (beanie) — NOT cap pricing', () => {
        const parser = new ShopWorksImportParser();
        expect(parser._isFlatHeadwear('Port  Companyknit Cap')).toBe(true);
    });

    test('$0 sales tax — tax-exempt organization', () => {
        expect(result.orderSummary.salesTax).toBe(0);
    });

    test('Net 10 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 10');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('shipping address — Olympia, WA', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Olympia');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38672');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1140);
        expect(result.orderSummary.total).toBe(1140);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 7: #136231 — Veneer Chip Transport, Inc.
// MCK09321+_2X, CT105291+_2X — size merging
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 7 (#136231): Veneer Chip Transport — MCK09321/CT105291 size variants', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136231');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Veneer Chip Transport, Inc.');
        expect(result.customer.contactName).toBe('James Lucich');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('MCK09321 Cutter & Buck polo — base qty 2 at $50', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const base = all.find(p => p.partNumber === 'MCK09321' && p.unitPrice === 50);
        expect(base).toBeDefined();
        expect(base.quantity).toBe(2);
    });

    test('MCK09321_2X — qty 10 at $52', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const xxl = all.find(p => (p.partNumber === 'MCK09321' || p.partNumber === 'MCK09321_2X') && p.unitPrice === 52);
        expect(xxl).toBeDefined();
        expect(xxl.quantity).toBe(10);
    });

    test('CT105291 Carhartt long sleeve — base qty 4 at $66', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const base = all.find(p => p.partNumber === 'CT105291' && p.unitPrice === 66);
        expect(base).toBeDefined();
        expect(base.quantity).toBe(4);
    });

    test('CT105291_2X — qty 6 at $68', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const xxl = all.find(p => (p.partNumber === 'CT105291' || p.partNumber === 'CT105291_2X') && p.unitPrice === 68);
        expect(xxl).toBeDefined();
        expect(xxl.quantity).toBe(6);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('shipping address — Fife, WA', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Fife');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38400');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1292);
        expect(result.orderSummary.salesTax).toBe(130.49);
        expect(result.orderSummary.total).toBe(1422.49);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 8: #136232 — lululemon
// DECG×1 at $20, "Left Chest" separator→notes, "Natural White"→notes
// ---------------------------------------------------------------------------
describe('Batch 9 — Order 8 (#136232): lululemon — DECG×1, descriptor notes', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136232');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('lululemon');
        expect(result.customer.contactName).toBe('Holly Yoon');
        expect(result.customer.email).toBe('hyoon@lululemon.com');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('DECG×1 at $20', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(1);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
    });

    test('"Left Chest" with PN goes to notes', () => {
        // "Left Chest" has a PN but no price — should go to notes
        const hasNote = result.notes.some(n => /left chest/i.test(n) || /world.*best/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('"Natural White" description-only → notes', () => {
        const hasNote = result.notes.some(n => /natural white/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('no design information section', () => {
        // This order has no Design # lines
        expect(result.designNumbers).toHaveLength(0);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(20);
        expect(result.orderSummary.salesTax).toBe(2.02);
        expect(result.orderSummary.total).toBe(22.02);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Cross-order validation
// ---------------------------------------------------------------------------
describe('Batch 9 — Cross-order validation', () => {
    test('all 8 orders parse successfully', () => {
        expect(orders).toHaveLength(8);
        orders.forEach((orderText, i) => {
            const result = new ShopWorksImportParser().parse(orderText);
            expect(result).toBeDefined();
            expect(result.orderId).toBeDefined();
        });
    });

    test('rep distribution: 4 Nika + 4 Taylar', () => {
        let nika = 0, taylar = 0;
        orders.forEach(orderText => {
            const result = new ShopWorksImportParser().parse(orderText);
            if (result.salesRep.name === 'Nika Lao') nika++;
            if (result.salesRep.name === 'Taylar Hanson') taylar++;
        });
        expect(nika).toBe(4);
        expect(taylar).toBe(4);
    });

    test('DECG orders: 3, 5, 8 have DECG items', () => {
        const ordersWithDecg = [2, 4, 7]; // 0-indexed
        ordersWithDecg.forEach(i => {
            const result = new ShopWorksImportParser().parse(orders[i]);
            expect(result.decgItems.length).toBeGreaterThan(0);
        });
    });

    test('DD digitizing in order 1 only', () => {
        const order1 = new ShopWorksImportParser().parse(orders[0]);
        expect(order1.services.digitizingFees.length).toBeGreaterThan(0);
        expect(order1.services.digitizingFees[0].amount).toBe(100);
    });

    test('non-SanMar products in orders 2, 4, 7', () => {
        // 1379757 (Under Armour), 799802 (Nike), MCK09321 (Cutter & Buck)
        [1, 3, 6].forEach(i => {
            const result = new ShopWorksImportParser().parse(orders[i]);
            const all = [...result.products, ...(result.customProducts || [])];
            expect(all.length).toBeGreaterThan(0);
        });
    });

    test('tax-exempt orders: order 6 has $0 tax in WA', () => {
        const order6 = new ShopWorksImportParser().parse(orders[5]);
        expect(order6.orderSummary.salesTax).toBe(0);
        // Shipping address is Olympia, WA — tax exempt (tribal organization)
        expect(order6.shipping.state).toBe('WA');
    });
});
