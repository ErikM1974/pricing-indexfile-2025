/**
 * Batch 13 Parser Tests — 8 real ShopWorks orders (#136530–136571)
 *
 * Edge cases covered:
 * - 3 caps all _OSFA (200+25+100 qty), "Sales@" email, Customer Pickup + UPS tracking coexist
 * - DD $100, B8210 Burnside, NE205_OSFA ×3 colors, DECG×10 $20
 * - GRT-50 at $150 (not $50), "Transfer"/"EMB" separators→notes, NKDC1963 size variants (_2X/_2XLT)
 * - Person name separators ("Tonal Logo")→notes, TM1MU410 ×3, Net 10
 * - Same customer different orders (Cosco Fire), "Embroidery" separator, "Antt:" typo address, Note section
 * - "Sew-on" description with empty PN → sewing service (description-based detection)
 * - Lowercase "Wa" state → uppercased, phone with extension
 * - DGT-002 with full description, CS410 tactical, 1517 ONYX vests, PO "0000299511" leading zeros
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch13.txt');

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
// Order 1: #136530 — New Dimension Lawn & Landscape
// 3 caps all _OSFA, 200 qty, "Sales@" email, Customer Pickup + UPS tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 1 (#136530): New Dimension Lawn — 3 caps, OSFA, Customer Pickup + UPS', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136530');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('New Dimension Lawn & Landscape, Inc.');
        expect(result.customer.contactName).toBe('Jon Kessler');
    });

    test('"Sales@" contact email stored verbatim', () => {
        expect(result.customer.email).toBe('Sales@ndll.net');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('3 products — all caps with OSFA', () => {
        expect(result.products.length).toBeGreaterThanOrEqual(3);
        const partNumbers = result.products.map(p => p.partNumber);
        expect(partNumbers).toContain('STC43');
        expect(partNumbers).toContain('C115');
        expect(partNumbers).toContain('CP90');
    });

    test('STC43 — 200 qty at $17', () => {
        const p = result.products.find(p => p.partNumber === 'STC43');
        expect(p).toBeDefined();
        expect(p.quantity).toBe(200);
        expect(p.unitPrice).toBe(17);
        expect(p.sizes).toEqual({ OSFA: 200 });
    });

    test('C115 — 25 qty at $14', () => {
        const p = result.products.find(p => p.partNumber === 'C115');
        expect(p).toBeDefined();
        expect(p.quantity).toBe(25);
        expect(p.unitPrice).toBe(14);
    });

    test('CP90 — 100 qty at $11', () => {
        const p = result.products.find(p => p.partNumber === 'CP90');
        expect(p).toBeDefined();
        expect(p.quantity).toBe(100);
        expect(p.unitPrice).toBe(11);
    });

    test('Customer Pickup ship method + UPS tracking coexist', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
        expect(result.packageTracking).toBeDefined();
        expect(result.packageTracking).toHaveLength(1);
        expect(result.packageTracking[0].carrier).toBe('UPS');
        expect(result.packageTracking[0].trackingNumber).toBe('1Z9033130340812361');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(4850);
        expect(result.orderSummary.salesTax).toBe(489.85);
        expect(result.orderSummary.total).toBe(5339.85);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 2: #136546 — Ikonika
// DD $100, B8210 Burnside, NE205_OSFA ×3 colors, DECG×10 $20
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 2 (#136546): Ikonika — DD, Burnside, NE205 ×3, DECG', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136546');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Ikonika');
        expect(result.customer.contactName).toBe('Jon Edwards');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('DD digitizing at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        expect(result.services.digitizingFees[0].code).toBe('DD');
        expect(result.services.digitizingFees[0].amount).toBe(100);
    });

    test('B8210 Burnside flannel — classified as product', () => {
        const b = result.products.find(p => p.partNumber === 'B8210');
        expect(b).toBeDefined();
        expect(b.quantity).toBe(5);
        expect(b.unitPrice).toBe(45.90);
        expect(b.color).toBe('Charcoal/Black');
    });

    test('NE205 ×3 colors (all OSFA)', () => {
        const ne = result.products.filter(p => p.partNumber === 'NE205');
        expect(ne).toHaveLength(3);
        const colors = ne.map(p => p.color).sort();
        expect(colors).toContain('Black/Black');
        expect(colors).toContain('Black/White');
        expect(colors).toContain('Grey/Grey');
        ne.forEach(p => {
            expect(p.unitPrice).toBe(23);
            expect(p.sizes).toEqual({ OSFA: p.quantity });
        });
    });

    test('DECG×10 at $20', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(10);
        expect(decg.unitPrice).toBe(20);
        expect(decg.isCap).toBe(false);
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
        expect(result.designNumbers[0]).toContain('39196');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1449.50);
        expect(result.orderSummary.salesTax).toBe(146.40);
        expect(result.orderSummary.total).toBe(1595.90);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 3: #136554 — Cardinal Baths
// GRT-50 at $150, "Transfer"/"EMB" separators, NKDC1963 size variants
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 3 (#136554): Cardinal Baths — GRT-50 $150, separators, Nike sizes', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136554');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Cardinal Baths');
        expect(result.customer.contactName).toContain('Patrick Popowski');
    });

    test('GRT-50 classified as patch-setup', () => {
        expect(result.services.patchSetup).toBe(true);
    });

    test('"Transfer" separator goes to notes', () => {
        const hasTransfer = result.notes.some(n => /transfer/i.test(n));
        expect(hasTransfer).toBe(true);
    });

    test('"EMB" separator goes to notes', () => {
        const hasEmb = result.notes.some(n => /^emb$/i.test(n));
        expect(hasEmb).toBe(true);
    });

    test('PC54 + PC54_2X products', () => {
        const pc54 = result.products.filter(p => p.partNumber === 'PC54' || p.partNumber === 'PC54_2X');
        expect(pc54.length).toBeGreaterThanOrEqual(1);
        const base = result.products.find(p => p.partNumber === 'PC54');
        expect(base).toBeDefined();
        expect(base.unitPrice).toBe(22);
    });

    test('NKDC1963 base + _2X + _2XLT size variants', () => {
        const allNK = result.products.filter(p =>
            p.partNumber === 'NKDC1963' || p.partNumber === 'NKDC1963_2X' || p.partNumber === 'NKDC1963_2XLT'
        );
        // Base at $50, _2X at $53, _2XLT at $51
        expect(allNK.length).toBeGreaterThanOrEqual(1);
        const prices = allNK.map(p => p.unitPrice);
        expect(prices).toContain(50);
    });

    test('NKDC1991 ladies polo', () => {
        const nk = result.products.find(p => p.partNumber === 'NKDC1991');
        expect(nk).toBeDefined();
        expect(nk.unitPrice).toBe(50);
        expect(nk.quantity).toBe(2);
    });

    test('PC78H hoodie', () => {
        const pc78 = result.products.find(p => p.partNumber === 'PC78H');
        expect(pc78).toBeDefined();
        expect(pc78.unitPrice).toBe(34.20);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(528.20);
        expect(result.orderSummary.salesTax).toBe(53.35);
        expect(result.orderSummary.total).toBe(581.55);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 4: #136556 — Cosco Fire Protection (order 1 of 2)
// Person name separators, many TravisMathew, Net 10, UPS
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 4 (#136556): Cosco Fire #1 — Tonal Logo separators, TravisMathew', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136556');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Cosco Fire Protection');
        expect(result.customer.contactName).toContain('Katie Jackson');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('"Michael Bunce - Tonal Logo" separator goes to notes', () => {
        const hasNote = result.notes.some(n => /Michael Bunce.*Tonal Logo/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('"Chad Matthew - Tonal Logo" separator goes to notes', () => {
        const hasNote = result.notes.some(n => /Chad Matthew.*Tonal Logo/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('12 actual product items (excludes 2 separators)', () => {
        expect(result.products).toHaveLength(12);
    });

    test('TM1MU410 appears 4 times (3 BerylGrnHt + 1 FederalBlu) — not merged across separators', () => {
        const tm = result.products.filter(p => p.partNumber === 'TM1MU410');
        expect(tm).toHaveLength(4);
        const beryl = tm.filter(p => p.color === 'BerylGrnHt');
        expect(beryl).toHaveLength(3);
        const federal = tm.filter(p => p.color === 'FederalBlu');
        expect(federal).toHaveLength(1);
    });

    test('TM1MY402 appears 3 times (2 OpalBluHtr + 1 QuiShaGyHt) — not merged across separators', () => {
        const tm = result.products.filter(p => p.partNumber === 'TM1MY402');
        expect(tm).toHaveLength(3);
    });

    test('Net 10 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 10');
    });

    test('UPS shipping + tracking', () => {
        expect(result.shipping.method).toBe('UPS');
        expect(result.packageTracking).toHaveLength(1);
        expect(result.packageTracking[0].carrier).toBe('UPS');
    });

    test('shipping address parsed — Tukwila, WA', () => {
        expect(result.shipping.city).toBe('Tukwila');
        expect(result.shipping.state).toBe('WA');
    });

    test('order summary with shipping', () => {
        expect(result.orderSummary.subtotal).toBe(1120);
        expect(result.orderSummary.salesTax).toBe(114.93);
        expect(result.orderSummary.shipping).toBe(17.95);
        expect(result.orderSummary.total).toBe(1252.88);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 5: #136557 — Cosco Fire Protection (order 2 of 2)
// Same customer, "Transfer"/"Embroidery" separators, CS203+CT105291, Antt: typo, Note
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 5 (#136557): Cosco Fire #2 — separators, Carhartt, Note section', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136557');
    });

    test('same customer as order 4', () => {
        expect(result.customer.company).toBe('Cosco Fire Protection');
        expect(result.customer.contactName).toContain('Katie Jackson');
    });

    test('"Transfer" separator goes to notes', () => {
        const hasTransfer = result.notes.some(n => /transfer/i.test(n));
        expect(hasTransfer).toBe(true);
    });

    test('"Embroidery" separator goes to notes', () => {
        const hasEmb = result.notes.some(n => /embroidery/i.test(n));
        expect(hasEmb).toBe(true);
    });

    test('CS203 + CS203_2X Cornerstone safety tee', () => {
        const cs = result.products.filter(p => p.partNumber === 'CS203' || p.partNumber === 'CS203_2X');
        expect(cs.length).toBeGreaterThanOrEqual(1);
        const base = result.products.find(p => p.partNumber === 'CS203');
        expect(base).toBeDefined();
        expect(base.unitPrice).toBe(42.30);
        expect(base.quantity).toBe(4);
    });

    test('CT105291 × 3 color entries', () => {
        const ct = result.products.filter(p => p.partNumber === 'CT105291' || p.partNumber === 'CT105291_2X');
        // base DarkKhaki $73, _2X DarkKhaki $75, base BurntOlive $73, _2X Steel $75
        expect(ct.length).toBeGreaterThanOrEqual(3);
    });

    test('PO# 25SC1216', () => {
        expect(result.purchaseOrderNumber).toBe('25SC1216');
    });

    test('"Antt:" typo in ship address — still parses state/zip', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('UPS');
        expect(result.shipping.rawAddress).toContain('Antt:');
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('99354');
    });

    test('UPS tracking', () => {
        expect(result.packageTracking).toHaveLength(1);
        expect(result.packageTracking[0].trackingNumber).toBe('1Z9033130342287542');
    });

    test('Note section parsed — billing contact', () => {
        expect(result.orderNotes).toBeDefined();
        expect(result.orderNotes).toContain('accounting@nwcustomapparel.com');
    });

    test('Net 10 terms', () => {
        expect(result.paymentTerms).toBe('Net 10');
    });

    test('order summary with shipping', () => {
        expect(result.orderSummary.subtotal).toBe(790.40);
        expect(result.orderSummary.salesTax).toBe(82.55);
        expect(result.orderSummary.shipping).toBe(26.95);
        expect(result.orderSummary.total).toBe(899.90);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 6: #136562 — Fire Buffs
// "Sew-on" empty PN → sewing service, "Card# 5619" terms
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 6 (#136562): Fire Buffs — Sew-on empty PN, Card# terms', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136562');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Fire Buffs');
        expect(result.customer.contactName).toContain('Dave');
        expect(result.customer.contactName).toContain('Lambing');
    });

    test('"Card# 5619" payment terms stored verbatim', () => {
        expect(result.paymentTerms).toBe('Card# 5619');
    });

    test('"Sew-on" with empty PN classified as sewing service', () => {
        expect(result.services.sewing).toBeDefined();
        expect(result.services.sewing).toHaveLength(1);
        const sew = result.services.sewing[0];
        expect(sew.partNumber).toBe('SEG');
        expect(sew.quantity).toBe(2);
        expect(sew.description).toBe('Sew-on');
    });

    test('sewing uses API price (SEWING_PRICE), not ShopWorks $12.50', () => {
        const sew = result.services.sewing[0];
        // Default SEWING_PRICE is $10.00 (API-driven)
        expect(sew.unitPrice).toBe(10);
        expect(sew.total).toBe(20);
    });

    test('NOT in customProducts (reclassified to sewing)', () => {
        expect(result.customProducts || []).toHaveLength(0);
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('no DECG items', () => {
        expect(result.decgItems).toHaveLength(0);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(25);
        expect(result.orderSummary.salesTax).toBe(2.53);
        expect(result.orderSummary.total).toBe(27.53);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 7: #136566 — Vadis
// K510 simple, lowercase "Wa" state, phone with extension
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 7 (#136566): Vadis — K510, lowercase Wa state', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136566');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Vadis');
        expect(result.customer.contactName).toBe('Jed Rains');
    });

    test('extracts sales rep — Taylar', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('K510 polo — simple product', () => {
        expect(result.products).toHaveLength(1);
        const p = result.products[0];
        expect(p.partNumber).toBe('K510');
        expect(p.color).toBe('Black');
        expect(p.unitPrice).toBe(29);
        expect(p.quantity).toBe(3);
        expect(p.sizes).toEqual({ M: 3 });
    });

    test('lowercase "Wa" state uppercased to "WA"', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98390');
        expect(result.shipping.city).toBe('Sumner');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(87);
        expect(result.orderSummary.salesTax).toBe(8.79);
        expect(result.orderSummary.total).toBe(95.79);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 8: #136571 — Port of Seattle
// DGT-002, CS410 tactical, GRT-50 $50, 1517 ONYX, PO leading zeros, Net 30
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Order 8 (#136571): Port of Seattle — DGT-002, ONYX, GRT-50, PO zeros', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136571');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toContain('Port Of Seattle');
        expect(result.customer.contactName).toContain('Seth');
    });

    test('extracts sales rep — Nika', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('DGT-002 at $50 with full description', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dgt = result.services.digitizingFees[0];
        expect(dgt.code).toBe('DGT-002');
        expect(dgt.amount).toBe(50);
        expect(dgt.description).toContain('revising');
    });

    test('GRT-50 classified as patch-setup', () => {
        expect(result.services.patchSetup).toBe(true);
    });

    test('CS410 + CS410_2X Cornerstone tactical polo', () => {
        const cs = result.products.filter(p => p.partNumber === 'CS410' || p.partNumber === 'CS410_2X');
        expect(cs.length).toBeGreaterThanOrEqual(1);
        const base = result.products.find(p => p.partNumber === 'CS410');
        expect(base).toBeDefined();
        expect(base.unitPrice).toBe(33);
        expect(base.quantity).toBe(52);
    });

    test('1517 + 1517_2X ONYX vests — classified as products', () => {
        const onyx = result.products.filter(p => p.partNumber === '1517' || p.partNumber === '1517_2X');
        expect(onyx.length).toBeGreaterThanOrEqual(1);
        const base = result.products.find(p => p.partNumber === '1517');
        expect(base).toBeDefined();
        expect(base.unitPrice).toBe(50.75);
        expect(base.quantity).toBe(16);
    });

    test('"Left Chest and Back Logo" separator goes to notes', () => {
        const hasNote = result.notes.some(n => /Left Chest.*Back Logo/i.test(n));
        expect(hasNote).toBe(true);
    });

    test('PO# "0000299511" preserved with leading zeros', () => {
        expect(result.purchaseOrderNumber).toBe('0000299511');
    });

    test('Net 30 payment terms', () => {
        expect(result.paymentTerms).toBe('Net 30');
    });

    test('ALL-CAPS ship-to address parsed correctly', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98111');
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('39197');
        expect(result.designNumbers[1]).toContain('39298');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(3251);
        expect(result.orderSummary.salesTax).toBe(328.35);
        expect(result.orderSummary.total).toBe(3579.35);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-order tests
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 13 — Cross-order validation', () => {
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

    test('same customer (Cosco Fire) in orders 4 and 5', () => {
        const order4 = new ShopWorksImportParser().parse(orders[3]);
        const order5 = new ShopWorksImportParser().parse(orders[4]);
        expect(order4.customer.company).toBe('Cosco Fire Protection');
        expect(order5.customer.company).toBe('Cosco Fire Protection');
        expect(order4.orderId).not.toBe(order5.orderId);
    });

    test('GRT-50 in orders 3 and 8 — both set patchSetup=true', () => {
        const order3 = new ShopWorksImportParser().parse(orders[2]);
        const order8 = new ShopWorksImportParser().parse(orders[7]);
        expect(order3.services.patchSetup).toBe(true);
        expect(order8.services.patchSetup).toBe(true);
    });

    test('description-based sewing detection works for empty PN', () => {
        const parser = new ShopWorksImportParser();
        // Simulate an empty-PN item with "Sew-on" description
        const result = parser.parse(orders[5]); // Fire Buffs
        expect(result.services.sewing).toHaveLength(1);
        expect(result.services.sewing[0].partNumber).toBe('SEG');
        // And customProducts should NOT have the sew-on item
        const sewInCustom = (result.customProducts || []).find(p =>
            /sew/i.test(p.description)
        );
        expect(sewInCustom).toBeUndefined();
    });
});
