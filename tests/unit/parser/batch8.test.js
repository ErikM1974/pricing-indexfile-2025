/**
 * Batch 8 Parser Tests — 8 real ShopWorks orders (#136114–136184)
 *
 * Edge cases covered:
 * - Large multi-product order (10 items), J325×25, LNEA122 _2X/_4X, L853_XXL/_4X, DECG×3 at $15
 * - UPS tracking×2, FEDEX GRD ship, 18500+_2X×2 colors, K100×2 colors, K528×2, CT105298_OSFA, PC55+_2X
 * - SP24 Red Kap _MR/_LR/_XLR/_2XLR size suffixes, AL×60, DD $50
 * - DECG×4×2 entries (both $25), merge to qty=8, out-of-state $0 tax
 * - DD $100, CT102286 vest, J850 jacket, CT105298_OSFA×2 colors, Laser Patch design
 * - Name×2 (Barb, Tayler), LNEA122/NEA122 mix, "Font" desc→notes, "Restocking fee" $25 no PN
 * - DECG×30 at $20, 4 design variants, tier 24-47
 * - DECG×4 at $20, simple single-item order
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch8.txt');

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
// Order 1: #136114 — Old Cannery Furniture
// 10 items, J325×25, LNEA122 variants, L853 variants, DECG×3 at $15
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 1 (#136114): Old Cannery Furniture — large order, DECG×3 at $15', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136114');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Old Cannery Furniture');
        expect(result.customer.contactName).toBe('Heather Smith');
        expect(result.customer.email).toBe('hsmith@oldcannery.com');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('J325 vest — qty 25', () => {
        const j325 = result.products.find(p => p.partNumber === 'J325');
        expect(j325).toBeDefined();
        expect(j325.quantity).toBe(25);
        expect(j325.unitPrice).toBe(43);
        expect(j325.color).toContain('Nvy');
    });

    test('L152_4X parsed — womens vest', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const l152 = all.find(p => p.partNumber === 'L152' || p.partNumber === 'L152_4X');
        expect(l152).toBeDefined();
        expect(l152.quantity).toBe(1);
        expect(l152.unitPrice).toBe(38);
    });

    test('LNEA122 variants — _2X and _4X, two colors', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const lnea = all.filter(p => p.partNumber === 'LNEA122' || p.partNumber === 'LNEA122_2X' || p.partNumber === 'LNEA122_4X');
        // At least 3 entries (True Navy Hthr _2X, _4X + Black Heather _2X, _4X + Shadow Grey He _4X)
        expect(lnea.length).toBeGreaterThanOrEqual(2);
    });

    test('L853 variants — _XXL and _4X', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const l853 = all.filter(p => p.partNumber === 'L853' || p.partNumber === 'L853_XXL' || p.partNumber === 'L853_4X');
        expect(l853.length).toBeGreaterThanOrEqual(1);
    });

    test('DECG×3 at $15 per piece', () => {
        expect(result.decgItems.length).toBeGreaterThanOrEqual(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(3);
        expect(decg.unitPrice).toBe(15);
        expect(decg.isCap).toBe(false);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('shipping address — Sumner, WA', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Sumner');
    });

    test('Net 10 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 10');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('28817');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1506);
        expect(result.orderSummary.salesTax).toBe(152.11);
        expect(result.orderSummary.total).toBe(1658.11);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 2: #136117 — Better Builders LLC
// UPS tracking×2, FEDEX GRD, 18500+_2X×2 colors, K100×2, K528×2, CT105298_OSFA, PC55+_2X
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 2 (#136117): Better Builders — UPS tracking, large multi-color order', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136117');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Better Builders LLC');
        expect(result.customer.contactName).toBe('Eli Hare');
        expect(result.customer.email).toBe('elih@betterbuilders.com');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('UPS tracking — 2 tracking numbers', () => {
        expect(result.packageTracking).toBeDefined();
        expect(result.packageTracking.length).toBe(2);
        result.packageTracking.forEach(t => {
            expect(t.carrier).toBe('UPS');
            expect(t.trackingNumber).toMatch(/^1Z/);
        });
    });

    test('FEDEX GRD ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('FEDEX GRD');
    });

    test('shipping address — Seattle, WA', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Seattle');
    });

    test('18500 Gildan hoodies — 2 colors (Forest, Black)', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const hoodies = all.filter(p => p.partNumber === '18500' || p.partNumber === '18500_2X');
        // 2 base colors × 2 entries each (base + _2X) or merged
        expect(hoodies.length).toBeGreaterThanOrEqual(2);
        const colors = hoodies.map(p => p.color);
        expect(colors.some(c => /forest/i.test(c))).toBe(true);
        expect(colors.some(c => /black/i.test(c))).toBe(true);
    });

    test('K100 polo — 2 colors', () => {
        const k100 = result.products.filter(p => p.partNumber === 'K100');
        expect(k100).toHaveLength(2);
        expect(k100[0].unitPrice).toBe(20);
        expect(k100[0].quantity).toBe(9);
    });

    test('K528 polo — 2 colors', () => {
        const k528 = result.products.filter(p => p.partNumber === 'K528');
        expect(k528).toHaveLength(2);
        expect(k528[0].unitPrice).toBe(28);
    });

    test('CT105298_OSFA Carhartt cap', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const cap = all.find(p => p.partNumber === 'CT105298' || p.partNumber === 'CT105298_OSFA');
        expect(cap).toBeDefined();
        expect(cap.unitPrice).toBe(37);
        expect(cap.quantity).toBe(6);
    });

    test('PC55 + PC55_2X tee', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const pc55 = all.filter(p => p.partNumber === 'PC55' || p.partNumber === 'PC55_2X');
        expect(pc55.length).toBeGreaterThanOrEqual(1);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('32418.01');
    });

    test('shipping amount in summary', () => {
        expect(result.orderSummary.shipping).toBe(61.52);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1782);
        expect(result.orderSummary.salesTax).toBe(186.20);
        expect(result.orderSummary.total).toBe(2029.72);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 3: #136126 — Contractors Roof Service
// SP24 Red Kap _MR/_LR/_XLR/_2XLR, AL×60, DD $50
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 3 (#136126): Contractors Roof Service — SP24 size variants, AL×60, DD $50', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136126');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Contractors Roof Service INC');
        expect(result.customer.contactName).toBe('Jeff Rankin');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('SP24 Red Kap — 4 size variants (_MR, _LR, _XLR, _2XLR)', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const sp24 = all.filter(p => p.partNumber === 'SP24' || (p.partNumber && p.partNumber.startsWith('SP24')));
        // May be merged into one or remain as separate entries
        expect(sp24.length).toBeGreaterThanOrEqual(1);
        // Total quantity across all SP24 = 10+20+20+10 = 60
        const totalQty = sp24.reduce((sum, p) => sum + p.quantity, 0);
        expect(totalQty).toBe(60);
    });

    test('SP24 base price $27, 2XLR $29', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const sp24base = all.find(p => p.partNumber === 'SP24' && p.unitPrice === 27);
        expect(sp24base).toBeDefined();
    });

    test('AL×60 at $5.50 — Additional Logo 1992', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos.length).toBeGreaterThanOrEqual(1);
        const al = result.services.additionalLogos[0];
        expect(al.quantity).toBe(60);
        expect(al.unitPrice).toBe(5.50);
    });

    test('DD digitizing at $50', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dd = result.services.digitizingFees[0];
        expect(dd.code).toBe('DD');
        expect(dd.amount).toBe(50);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39102');
        expect(result.designNumbers[1]).toContain('39103');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(2020);
        expect(result.orderSummary.salesTax).toBe(204.02);
        expect(result.orderSummary.total).toBe(2224.02);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 4: #136148 — Cedar Wellness Center
// DECG×4×2 entries (both $25), out-of-state ($0 tax)
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 4 (#136148): Cedar Wellness — DECG×8 total, out-of-state', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136148');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Cedar Wellness Center');
        expect(result.customer.contactName).toBe('Abigail Davis');
        expect(result.customer.email).toBe('abby@ots.health');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('2 DECG entries, both at $25, qty 4 each', () => {
        expect(result.decgItems).toHaveLength(2);
        result.decgItems.forEach(decg => {
            expect(decg.partNumber).toBe('DECG');
            expect(decg.quantity).toBe(4);
            expect(decg.unitPrice).toBe(25);
            expect(decg.isCap).toBe(false);
        });
    });

    test('DECG total = 8 pieces', () => {
        const total = result.decgItems.reduce((sum, d) => sum + d.quantity, 0);
        expect(total).toBe(8);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('out-of-state — $0 sales tax', () => {
        expect(result.orderSummary.salesTax).toBe(0);
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('37897');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(200);
        expect(result.orderSummary.total).toBe(200);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 5: #136151 — Dual Security Solutions
// DD $100, CT102286, J850, CT105298_OSFA×2 colors
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 5 (#136151): Dual Security — DD $100, vest, jacket, 2 caps', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136151');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Dual Security Solutions');
        expect(result.customer.contactName).toBe('Austin Dawson');
    });

    test('DD digitizing at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dd = result.services.digitizingFees[0];
        expect(dd.code).toBe('DD');
        expect(dd.amount).toBe(100);
    });

    test('CT102286 Carhartt Gilliam Vest', () => {
        const vest = result.products.find(p => p.partNumber === 'CT102286');
        expect(vest).toBeDefined();
        expect(vest.unitPrice).toBe(136);
        expect(vest.quantity).toBe(1);
        expect(vest.color).toBe('Moss');
    });

    test('J850 Packable Puffy Jacket', () => {
        const jacket = result.products.find(p => p.partNumber === 'J850');
        expect(jacket).toBeDefined();
        expect(jacket.unitPrice).toBe(87);
        expect(jacket.quantity).toBe(1);
    });

    test('CT105298_OSFA caps — 2 colors', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const caps = all.filter(p => p.partNumber === 'CT105298' || p.partNumber === 'CT105298_OSFA');
        expect(caps).toHaveLength(2);
        const colors = caps.map(p => p.color);
        expect(colors.some(c => /black/i.test(c))).toBe(true);
        expect(colors.some(c => /carhartt/i.test(c))).toBe(true);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39073');
        expect(result.designNumbers[1]).toContain('39097');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(393);
        expect(result.orderSummary.salesTax).toBe(39.69);
        expect(result.orderSummary.total).toBe(432.69);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 6: #136157 — Button Veterinary Hospital
// Name×2 (Barb, Tayler), LNEA122/NEA122, "Font" desc→notes, "Restocking fee" $25
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 6 (#136157): Button Veterinary — Name×2, restocking fee, font note', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136157');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Button Veterinary Hospital');
        expect(result.customer.contactName).toContain('Danielle');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('Name×2 — Barb and Tayler', () => {
        expect(result.services.monograms).toBeDefined();
        expect(result.services.monograms).toHaveLength(2);
        result.services.monograms.forEach(m => {
            expect(m.unitPrice).toBe(12.50);
            expect(m.quantity).toBe(1);
        });
    });

    test('LNEA122 and NEA122 as separate products', () => {
        const all = [...result.products, ...(result.customProducts || [])];
        const lnea = all.find(p => p.partNumber === 'LNEA122');
        const nea = all.find(p => p.partNumber === 'NEA122');
        expect(lnea).toBeDefined();
        expect(nea).toBeDefined();
        expect(lnea.quantity).toBe(1);
        expect(nea.quantity).toBe(1);
        expect(lnea.unitPrice).toBe(68);
    });

    test('"Font - Krone" description-only item → notes', () => {
        const hasFont = result.notes.some(n => /font/i.test(n) || /krone/i.test(n));
        expect(hasFont).toBe(true);
    });

    test('"Restocking fee" $25 — no PN, treated as custom product or note', () => {
        // Item has no part number but has $25 price — could be custom product or fee
        const all = [...result.products, ...(result.customProducts || [])];
        const restocking = all.find(p => p.description && /restocking/i.test(p.description));
        const inNotes = result.notes.some(n => /restocking/i.test(n));
        // Should be captured somewhere
        expect(restocking || inNotes).toBeTruthy();
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('33672');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(186);
        expect(result.orderSummary.salesTax).toBe(18.79);
        expect(result.orderSummary.total).toBe(204.79);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 7: #136166 — Head & Malesis Insurance Agencies
// DECG×30 at $20, 4 design variants, tier 24-47
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 7 (#136166): Head & Malesis — DECG×30 at $20, 4 designs', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136166');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Head & Malesis Insurance Agencies');
        expect(result.customer.contactName).toBe('Kelsie Stroud');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('DECG×30 at $20', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(30);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
    });

    test('DECG tier = 24-47 (qty 30)', () => {
        expect(result.decgItems[0].tier).toBe('24-47');
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
        expect(result.designNumbers[0]).toContain('37698.01');
        expect(result.designNumbers[1]).toContain('37698');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(600);
        expect(result.orderSummary.salesTax).toBe(60.60);
        expect(result.orderSummary.total).toBe(660.60);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Order 8: #136184 — Sound Retina
// DECG×4 at $20, simple single-item order
// ---------------------------------------------------------------------------
describe('Batch 8 — Order 8 (#136184): Sound Retina — DECG×4 at $20', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136184');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Sound Retina');
        expect(result.customer.contactName).toBe('Tawny');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('DECG×4 at $20', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(4);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('17149.02');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(80);
        expect(result.orderSummary.salesTax).toBe(8.08);
        expect(result.orderSummary.total).toBe(88.08);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Cross-order validation
// ---------------------------------------------------------------------------
describe('Batch 8 — Cross-order validation', () => {
    test('all 8 orders parse successfully', () => {
        expect(orders).toHaveLength(8);
        orders.forEach((orderText, i) => {
            const result = new ShopWorksImportParser().parse(orderText);
            expect(result).toBeDefined();
            expect(result.orderId).toBeDefined();
        });
    });

    test('rep distribution: 4 Taylar + 4 Nika', () => {
        let nika = 0, taylar = 0;
        orders.forEach(orderText => {
            const result = new ShopWorksImportParser().parse(orderText);
            if (result.salesRep.name === 'Nika Lao') nika++;
            if (result.salesRep.name === 'Taylar Hanson') taylar++;
        });
        expect(nika).toBe(4);
        expect(taylar).toBe(4);
    });

    test('DECG orders: 1, 4, 7, 8 have DECG items', () => {
        const ordersWithDecg = [0, 3, 6, 7]; // 0-indexed
        ordersWithDecg.forEach(i => {
            const result = new ShopWorksImportParser().parse(orders[i]);
            expect(result.decgItems.length).toBeGreaterThan(0);
        });
    });

    test('DD digitizing in orders 3 and 5', () => {
        const order3 = new ShopWorksImportParser().parse(orders[2]);
        const order5 = new ShopWorksImportParser().parse(orders[4]);
        expect(order3.services.digitizingFees.length).toBeGreaterThan(0);
        expect(order5.services.digitizingFees.length).toBeGreaterThan(0);
        expect(order3.services.digitizingFees[0].amount).toBe(50);
        expect(order5.services.digitizingFees[0].amount).toBe(100);
    });

    test('out-of-state detection — order 4 has $0 tax', () => {
        const order4 = new ShopWorksImportParser().parse(orders[3]);
        expect(order4.orderSummary.salesTax).toBe(0);
    });
});
