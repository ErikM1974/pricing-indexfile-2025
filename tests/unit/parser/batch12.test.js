/**
 * Batch 12 Parser Tests — 8 real ShopWorks orders (#136462–136526)
 *
 * Edge cases covered:
 * - DGT-001 $100, OG138 OGIO, PC850+PC850_2X merging
 * - _4/5X combo size suffix (CSV102 safety vest), DTF desc-only→notes, J851_4X
 * - DECG×4 $25, tier 1-7, LTM triggered, email domain mismatch
 * - SRJ754 size merging (_2X/_3X/_4X), Monogram×10, Priority Mail, Net 30, AK out-of-state
 * - 3×DECG "Di. Embroider Cap" prefix fix — Front=cap, T-shirt=garment, Jacket=garment
 * - DECG vests, 110_L/XL R-FLEX, 112 split by design separator
 * - TM1WW001×3 colors, EB545 "Icon Logo", Sample separator, $0 items
 * - DD $150, DECG $175 (68K stitch full back jacket), isHeavyweight=true
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch12.txt');

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

// ─────────────────────────────────────────────────────────────────────────────
// Order 1: #136462 — Elevate Home Renovations
// DGT-001 $100, OG138 OGIO, PC850+PC850_2X
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 1 (#136462): Elevate Home Renovations — DGT-001, OGIO, size merging', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136462');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Elevate Home Renovations');
        expect(result.customer.contactName).toBe('Karisa Lyons');
        expect(result.customer.email).toBe('karisalyons@yahoo.com');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('parses 3 products (PC850H, OG138, PC850+PC850_2X merged)', () => {
        expect(result.products.length).toBeGreaterThanOrEqual(3);
        const partNumbers = result.products.map(p => p.partNumber);
        expect(partNumbers).toContain('PC850H');
        expect(partNumbers).toContain('OG138');
        expect(partNumbers).toContain('PC850');
    });

    test('PC850H details', () => {
        const p = result.products.find(p => p.partNumber === 'PC850H');
        expect(p.color).toContain('Navy');
        expect(p.quantity).toBe(2);
        expect(p.unitPrice).toBe(37);
    });

    test('OG138 OGIO polo', () => {
        const p = result.products.find(p => p.partNumber === 'OG138');
        expect(p.color).toBe('Blacktop');
        expect(p.quantity).toBe(2);
        expect(p.unitPrice).toBe(46);
    });

    test('PC850 + PC850_2X — base + extended size', () => {
        const base = result.products.filter(p => p.partNumber === 'PC850');
        // Both should exist — base at $33 and _2X at $35
        const allPC850 = result.products.filter(p => p.partNumber === 'PC850' || p.partNumber === 'PC850_2X');
        expect(allPC850.length).toBeGreaterThanOrEqual(1);
        const prices = allPC850.map(p => p.unitPrice);
        expect(prices).toContain(33);
    });

    test('DGT-001 digitizing fee at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dgt = result.services.digitizingFees[0];
        expect(dgt.code).toBe('DGT-001');
        expect(dgt.amount).toBe(100);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39207');
        expect(result.designNumbers[1]).toContain('39207.01');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(334);
        expect(result.orderSummary.salesTax).toBe(33.73);
        expect(result.orderSummary.total).toBe(367.73);
        expect(result.orderSummary.paidToDate).toBe(367.73);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('COD terms', () => {
        expect(result.paymentTerms).toBe('COD');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 2: #136479 — Blas Lawn Care
// _4/5X combo size suffix, DTF desc-only→notes, J851_4X
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 2 (#136479): Blas Lawn Care — _4/5X combo size, DTF note, J851_4X', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136479');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Blas Lawn Care');
        expect(result.customer.contactName).toBe('Blas Lopec');
        expect(result.customer.email).toBe('lblas0702@gmail.com');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('parses J851_4X with 4XL size extraction', () => {
        const j851 = result.products.filter(p => p.partNumber === 'J851');
        expect(j851.length).toBeGreaterThanOrEqual(1);
        // At least one J851 should have 4XL size
        const has4XL = j851.some(p => p.sizes && p.sizes['4XL']);
        expect(has4XL).toBe(true);
    });

    test('J851 appears twice — two colors', () => {
        const j851 = result.products.filter(p => p.partNumber === 'J851');
        expect(j851).toHaveLength(2);
        const colors = j851.map(p => p.color);
        expect(colors).toContain('Sterl Gry/Grph');
    });

    test('CSV102_L/XL parsed correctly', () => {
        const csv = result.products.filter(p => p.partNumber === 'CSV102');
        expect(csv.length).toBeGreaterThanOrEqual(1);
        // At least one should have L/XL size
        const hasLXL = csv.some(p => p.sizes && p.sizes['L/XL']);
        expect(hasLXL).toBe(true);
    });

    test('CSV102_4/5X — combo size suffix extracted', () => {
        // The _4/5X suffix should be extracted, giving partNumber='CSV102' and size='4XL/5XL'
        const csv = result.products.filter(p => p.partNumber === 'CSV102');
        expect(csv.length).toBeGreaterThanOrEqual(2);
        const has45X = csv.some(p => p.sizes && p.sizes['4XL/5XL']);
        expect(has45X).toBe(true);
    });

    test('DTF description-only item goes to notes', () => {
        // Item 3 has no PN, no price, description "DTF" — should be in notes
        const hasDtfNote = result.notes.some(n => /dtf/i.test(n));
        expect(hasDtfNote).toBe(true);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39111');
        expect(result.designNumbers[1]).toContain('39037');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(204.40);
        expect(result.orderSummary.salesTax).toBe(20.64);
        expect(result.orderSummary.total).toBe(225.04);
        expect(result.orderSummary.paidToDate).toBe(225.04);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('no DECG items', () => {
        expect(result.decgItems).toHaveLength(0);
    });

    test('no digitizing fees', () => {
        expect(result.services.digitizingFees || []).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 3: #136496 — Troutlodge
// DECG×4 at $25, tier 1-7, email domain mismatch
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 3 (#136496): Troutlodge — DECG×4, tier 1-7, email mismatch', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136496');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Troutlodge');
        expect(result.customer.contactName).toBe('Melissa Bresler');
    });

    test('email domain mismatch — hendrix-genetics.com, not troutlodge', () => {
        expect(result.customer.email).toBe('Melissa.Bresler@hendrix-genetics.com');
    });

    test('DECG×4 at $25 — tier 1-7', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(4);
        expect(decg.unitPrice).toBe(25);
        expect(decg.tier).toBe('1-7');
        expect(decg.isCap).toBe(false);
    });

    test('DECG description = "Di. Embroider Garms" → not a cap', () => {
        const decg = result.decgItems[0];
        expect(decg.isCap).toBe(false);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('38833');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(100);
        expect(result.orderSummary.salesTax).toBe(10.10);
        expect(result.orderSummary.total).toBe(110.10);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('COD terms', () => {
        expect(result.paymentTerms).toBe('COD');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 4: #136513 — City of Unalaska
// SRJ754 size merging, Monogram×10, Priority Mail, Net 30, AK out-of-state
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 4 (#136513): City of Unalaska — SRJ754 sizes, Monogram, Priority Mail, Net 30', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136513');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('City of Unalaska');
        expect(result.customer.contactName).toBe('Rubilyn Warden');
        expect(result.customer.email).toBe('rwarden@ci.unalaska.ak.us');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('SRJ754 base + _2X/_3X/_4X size variants', () => {
        const srj = result.products.filter(p => p.partNumber === 'SRJ754');
        // May be 1 merged product or multiple — at least base exists
        expect(srj.length).toBeGreaterThanOrEqual(1);
        // Total quantity across all SRJ754 entries = 6+1+2+1 = 10
        const totalQty = srj.reduce((sum, p) => sum + p.quantity, 0);
        // Base has 6 (S:1, LG:3, XL:2), _2X has 1, _3X has 2, _4X has 1
        expect(totalQty + result.products.filter(p => p.partNumber === 'SRJ754_2X' || p.partNumber === 'SRJ754_3X' || p.partNumber === 'SRJ754_4X').reduce((s, p) => s + p.quantity, 0)).toBe(10);
    });

    test('SRJ754 base has correct sizes', () => {
        const srj = result.products.find(p => p.partNumber === 'SRJ754');
        expect(srj).toBeDefined();
        expect(srj.quantity).toBe(6);
        expect(srj.unitPrice).toBe(80);
    });

    test('Monogram×10 at $12.50', () => {
        expect(result.services.monograms).toBeDefined();
        expect(result.services.monograms).toHaveLength(1);
        expect(result.services.monograms[0].quantity).toBe(10);
        expect(result.services.monograms[0].unitPrice).toBe(12.50);
    });

    test('Priority Mail ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Priority Mail');
    });

    test('shipping address parsed — Unalaska, AK', () => {
        expect(result.shipping.rawAddress).toBeDefined();
        expect(result.shipping.city).toBe('Unalaska');
        expect(result.shipping.state).toBe('AK');
        expect(result.shipping.zip).toBe('99685');
    });

    test('Net 30 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 30');
    });

    test('AK out-of-state — $0 sales tax', () => {
        expect(result.orderSummary.salesTax).toBe(0);
    });

    test('shipping amount in summary', () => {
        expect(result.orderSummary.shipping).toBe(132.17);
    });

    test('order summary totals', () => {
        expect(result.orderSummary.subtotal).toBe(937);
        expect(result.orderSummary.total).toBe(1069.17);
        expect(result.orderSummary.paidToDate).toBe(1069.17);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('PO# = "Names"', () => {
        expect(result.purchaseOrderNumber).toBe('Names');
    });

    test('1 design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('12007');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 5: #136515 — Gate Service and Technology
// 3×DECG "Di. Embroider Cap" prefix fix — Front=cap, T-shirt=garment, Jacket=garment
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 5 (#136515): Gate Service — DECG "Di. Embroider Cap" prefix detection', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136515');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Gate Service and Technology');
        expect(result.customer.contactName).toBe('Rachel Robertson');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('3 DECG items parsed', () => {
        expect(result.decgItems).toHaveLength(3);
    });

    test('"Di. Embroider Cap - Front - Small Logo" → isCap=true', () => {
        const front = result.decgItems.find(d => d.description.includes('Front'));
        expect(front).toBeDefined();
        expect(front.isCap).toBe(true);
        expect(front.quantity).toBe(1);
        expect(front.unitPrice).toBe(25);
    });

    test('"Di. Embroider Cap - T-shirt - Small Logo" → isCap=false (DECG prefix fix)', () => {
        const tshirt = result.decgItems.find(d => d.description.includes('T-shirt'));
        expect(tshirt).toBeDefined();
        expect(tshirt.isCap).toBe(false);
        expect(tshirt.quantity).toBe(2);
    });

    test('"Di. Embroider Cap - Jacket - Big Logo" → isCap=false (DECG prefix fix)', () => {
        const jacket = result.decgItems.find(d => d.description.includes('Jacket'));
        expect(jacket).toBeDefined();
        expect(jacket.isCap).toBe(false);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('37465.03');
        expect(result.designNumbers[1]).toContain('37465.01');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(100);
        expect(result.orderSummary.salesTax).toBe(10.10);
        expect(result.orderSummary.total).toBe(110.10);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 6: #136520 — Tacoma Longshoremen Credit Union
// DECG vests, 110_L/XL R-FLEX, 112 split by design separator
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 6 (#136520): Tacoma Longshoremen — DECG, 110_L/XL, 112 split', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136520');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Tacoma Longshoremen Credit Union');
        expect(result.customer.contactName).toBe('Bill Syrovatka');
    });

    test('DECG×4 at $20 — S.Orange Vests', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(4);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
        expect(decg.description).toContain('Vests');
    });

    test('110_L/XL R-FLEX — non-SanMar cap', () => {
        const rflex = result.customProducts?.find(p => p.partNumber === '110') ||
                      result.products?.find(p => p.partNumber === '110');
        expect(rflex).toBeDefined();
        expect(rflex.quantity).toBe(2);
        expect(rflex.unitPrice).toBe(30);
    });

    test('112 Richardson caps — two entries (split by design separator)', () => {
        const caps112 = result.products.filter(p => p.partNumber === '112') ||
                        result.customProducts?.filter(p => p.partNumber === '112') || [];
        const allCaps = [
            ...result.products.filter(p => p.partNumber === '112'),
            ...(result.customProducts || []).filter(p => p.partNumber === '112')
        ];
        expect(allCaps.length).toBeGreaterThanOrEqual(2);
        // Each entry has qty=4 at $28
        allCaps.forEach(cap => {
            expect(cap.quantity).toBe(4);
            expect(cap.unitPrice).toBe(28);
        });
    });

    test('design separator "ILWU 23 Text Logo" goes to notes', () => {
        const hasNote = result.notes.some(n => /ILWU.*Text\s*Logo/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39194');
        expect(result.designNumbers[1]).toContain('39226');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(364);
        expect(result.orderSummary.salesTax).toBe(36.76);
        expect(result.orderSummary.total).toBe(400.76);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 7: #136525 — Puget Systems
// TM1WW001×3 colors, EB545 "Icon Logo", Sample separator, $0 items
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 7 (#136525): Puget Systems — TM1WW001, EB545, sample separator, $0 items', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136525');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Puget Systems');
        expect(result.customer.contactName).toContain('Maria');
        expect(result.customer.email).toBe('mrosero@pugetsystems.com');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('TM1WW001 appears 3 times — 3 different colors', () => {
        const tm = result.products.filter(p => p.partNumber === 'TM1WW001');
        expect(tm).toHaveLength(3);
        const colors = tm.map(p => p.color);
        expect(colors).toContain('BlueNights');
        expect(colors).toContain('White');
        tm.forEach(p => {
            expect(p.unitPrice).toBe(86);
            expect(p.quantity).toBe(1);
        });
    });

    test('EB545 — Eddie Bauer jacket with "Icon Logo" description', () => {
        const eb = result.products.find(p => p.partNumber === 'EB545');
        expect(eb).toBeDefined();
        expect(eb.unitPrice).toBe(82);
        expect(eb.quantity).toBe(1);
        expect(eb.color).toBe('DeepBlack');
    });

    test('"Sample - No logo" separator goes to notes', () => {
        const hasSampleNote = result.notes.some(n => /sample/i.test(n));
        expect(hasSampleNote).toBe(true);
    });

    test('$0 sample items parsed as products', () => {
        // BB18000, OG1002, MM2000, 838964 all have qty=1 and $0 price
        const zeroItems = ['BB18000', 'OG1002', 'MM2000', '838964'];
        zeroItems.forEach(pn => {
            const found = result.products.find(p => p.partNumber === pn) ||
                          (result.customProducts || []).find(p => p.partNumber === pn);
            expect(found).toBeDefined();
            expect(found.quantity).toBe(1);
            // Unit price should be 0 or undefined (line item price = 0)
            expect(found.unitPrice == null || found.unitPrice === 0).toBe(true);
        });
    });

    test('total product count — 4 priced + 4 samples = 8', () => {
        const totalProducts = result.products.length + (result.customProducts || []).length;
        expect(totalProducts).toBeGreaterThanOrEqual(8);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('37687');
        expect(result.designNumbers[1]).toContain('37723.01');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(340);
        expect(result.orderSummary.salesTax).toBe(34.34);
        expect(result.orderSummary.total).toBe(374.34);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 8: #136526 — Tyler Ford / Roadmen Car Club
// DD $150, DECG $175 (68K stitch full back jacket), isHeavyweight
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Order 8 (#136526): Roadmen Car Club — DD $150, DECG $175', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136526');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Tyler Ford');
        expect(result.customer.contactName).toBe('Tyler Ford');
        expect(result.customer.email).toBe('ctford123@gmail.com');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('DD digitizing at $150 (premium/complex)', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dd = result.services.digitizingFees[0];
        expect(dd.code).toBe('DD');
        expect(dd.amount).toBe(150);
    });

    test('DECG×1 at $175 — full back jacket pricing', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(1);
        expect(decg.unitPrice).toBe(175);
        expect(decg.isCap).toBe(false);
    });

    test('DECG description = "Di. Embroider Garms" → not a cap', () => {
        expect(result.decgItems[0].isCap).toBe(false);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('1 design number — Roadmen Car Club', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('39186');
        expect(result.designNumbers[0]).toContain('Roadmen Car Club');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(325);
        expect(result.orderSummary.salesTax).toBe(32.83);
        expect(result.orderSummary.total).toBe(357.83);
        expect(result.orderSummary.paidToDate).toBe(357.83);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-order tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 12 — Cross-order validation', () => {
    test('all 8 orders parse successfully', () => {
        expect(orders).toHaveLength(8);
        orders.forEach((orderText, i) => {
            const result = new ShopWorksImportParser().parse(orderText);
            expect(result).toBeDefined();
            expect(result.orderId).toBeDefined();
        });
    });

    test('rep distribution: 6 Nika + 2 Taylar', () => {
        let nika = 0, taylar = 0;
        orders.forEach(orderText => {
            const result = new ShopWorksImportParser().parse(orderText);
            if (result.salesRep.name === 'Nika Lao') nika++;
            if (result.salesRep.name === 'Taylar Hanson') taylar++;
        });
        expect(nika).toBe(6);
        expect(taylar).toBe(2);
    });

    test('DECG items across batch — orders 3, 5, 6, 8 have DECG', () => {
        const ordersWithDecg = [2, 4, 5, 7]; // 0-indexed
        ordersWithDecg.forEach(i => {
            const result = new ShopWorksImportParser().parse(orders[i]);
            expect(result.decgItems.length).toBeGreaterThan(0);
        });
    });

    test('DD digitizing in orders 1 and 8', () => {
        const order1 = new ShopWorksImportParser().parse(orders[0]);
        const order8 = new ShopWorksImportParser().parse(orders[7]);
        expect(order1.services.digitizingFees.length).toBeGreaterThan(0);
        expect(order8.services.digitizingFees.length).toBeGreaterThan(0);
        // Order 1: DGT-001 at $100, Order 8: DD at $150
        expect(order1.services.digitizingFees[0].amount).toBe(100);
        expect(order8.services.digitizingFees[0].amount).toBe(150);
    });

    test('_isCapFromDescription handles all DECG prefixes correctly', () => {
        const parser = new ShopWorksImportParser();
        // Direct unit tests for the fixed method
        expect(parser._isCapFromDescription('Di. Embroider Cap - Front - Small Logo')).toBe(true);
        expect(parser._isCapFromDescription('Di. Embroider Cap - T-shirt - Small Logo')).toBe(false);
        expect(parser._isCapFromDescription('Di. Embroider Cap - Jacket - Big Logo')).toBe(false);
        expect(parser._isCapFromDescription('Di. Embroider Garms')).toBe(false);
        expect(parser._isCapFromDescription('Di. Embroider Garms  S.Orange Vests')).toBe(false);
        // Standard cap detection still works
        expect(parser._isCapFromDescription('Richardson Trucker Cap')).toBe(true);
        expect(parser._isCapFromDescription('Nike Dri-FIT Hat')).toBe(true);
        expect(parser._isCapFromDescription('Carhartt Beanie')).toBe(true);
    });
});
