/**
 * Batch 11 Parser Tests — 8 real ShopWorks orders
 *
 * Edge cases covered:
 * - Simple cap order with _OSFA suffix, UPS tracking
 * - "Design Prep" SKU ($50 → GRT-75 alias), DECG×20 at $15, negative balance (-385.35)
 * - DD $100, free item (Richardson 112 cap at $0.00)
 * - Logo color dividers ("Grey Logo"/"White Logo"), AL with quoted text ("AM"), Nike non-SanMar
 * - Extremely long descriptions (J26112), "Transfer S. Vest" no-PN priced item, empty line item
 * - Company starting with number ("410 Dental"), duplicate styles different colors
 * - Multiple AL at different quantities (AL×2 + AL×4), instruction note as line item
 * - DGT-001 at $100, DECG×26 at $20 (tier 24-47)
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch11.txt');

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
// Order 1: #136408 — Brett Skaloud
// Simple cap order, _OSFA suffix, UPS tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 1 (#136408): Brett Skaloud — cap, OSFA, UPS tracking', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136408');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Brett Skaloud');
        expect(result.customer.contactName).toBe('Brett  Skaloud');
        expect(result.customer.email).toBe('brettskaloud@gmail.com');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('parses 1 product with OSFA suffix extraction', () => {
        expect(result.products).toHaveLength(1);
        const p = result.products[0];
        expect(p.partNumber).toBe('DT630');
        expect(p.color).toBe('Olive/Khaki');
        expect(p.quantity).toBe(20);
        expect(p.unitPrice).toBe(18);
        expect(p.sizes).toEqual({ OSFA: 20 });
    });

    test('extracts package tracking (UPS)', () => {
        expect(result.packageTracking).toBeDefined();
        expect(result.packageTracking).toHaveLength(1);
        expect(result.packageTracking[0].carrier).toBe('UPS');
        expect(result.packageTracking[0].trackingNumber).toBe('1Z9033130341179072');
    });

    test('extracts order summary with shipping and tax', () => {
        expect(result.orderSummary.subtotal).toBe(360);
        expect(result.orderSummary.salesTax).toBe(38.88);
        expect(result.orderSummary.shipping).toBe(24.96);
        expect(result.orderSummary.total).toBe(423.84);
        expect(result.orderSummary.paidToDate).toBe(423.84);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('extracts design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('39145');
    });

    test('no services', () => {
        expect(result.decgItems).toHaveLength(0);
        expect(result.services.additionalLogos || []).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 2: #136409 — Cintas
// "Design Prep" → GRT-75, DECG×20 at $15, negative balance
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 2 (#136409): Cintas — Design Prep, DECG, negative balance', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136409');
    });

    test('extracts Cintas customer', () => {
        expect(result.customer.company).toBe('Cintas');
        expect(result.customer.contactName).toBe('Noelle Brown');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('no regular products', () => {
        expect(result.products).toHaveLength(0);
    });

    test('parses DECG×20 with correct pricing', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.partNumber).toBe('DECG');
        expect(decg.quantity).toBe(20);
        expect(decg.unitPrice).toBe(15);
        expect(decg.calculatedUnitPrice).toBe(26);
        expect(decg.tier).toBe('8-23');
        expect(decg.isCap).toBe(false);
    });

    test('Design Prep classified as graphic design (GRT-75)', () => {
        expect(result.services.graphicDesign).toBeDefined();
        expect(result.services.graphicDesign.hours).toBe(1);
        expect(result.services.graphicDesign.amount).toBe(75);
    });

    test('negative balance parsed correctly', () => {
        expect(result.orderSummary.balance).toBe(-385.35);
        expect(result.orderSummary.paidToDate).toBe(770.7);
    });

    test('order summary totals', () => {
        expect(result.orderSummary.subtotal).toBe(350);
        expect(result.orderSummary.salesTax).toBe(35.35);
        expect(result.orderSummary.total).toBe(385.35);
    });

    test('extracts design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('39146');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 3: #136417 — Pacific Home Electric
// DD $100, free item (Richardson 112 at $0)
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 3 (#136417): Pacific Home Electric — DD, free cap', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136417');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Pacific Home Electric');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('parses 2 products including free cap', () => {
        expect(result.products).toHaveLength(2);

        const polo = result.products[0];
        expect(polo.partNumber).toBe('K500');
        expect(polo.color).toBe('Black');
        expect(polo.quantity).toBe(6);
        expect(polo.unitPrice).toBe(35);

        const cap = result.products[1];
        expect(cap.partNumber).toBe('112');
        expect(cap.color).toBe('Black');
        expect(cap.quantity).toBe(12);
        expect(cap.unitPrice).toBe(0);
        expect(cap.sizes).toEqual({ OSFA: 12 });
    });

    test('DD digitizing at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        expect(result.services.digitizingFees[0].code).toBe('DD');
        expect(result.services.digitizingFees[0].amount).toBe(100);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(310);
        expect(result.orderSummary.total).toBe(341.31);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 4: #136420 — Art Morrison Enterprises
// Logo dividers ("Grey Logo"/"White Logo"), AL with "AM" quotes, Nike non-SanMar, out-of-state
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 4 (#136420): Art Morrison — logo dividers, AL, non-SanMar', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136420');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('Art Morrison Enterprises');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('parses exactly 4 products — logo dividers excluded', () => {
        expect(result.products).toHaveLength(4);
        const partNumbers = result.products.map(p => p.partNumber);
        expect(partNumbers).toContain('TM1MW450');
        expect(partNumbers).toContain('TM1WX002');
        expect(partNumbers).toContain('883681');
    });

    test('product details correct', () => {
        const tm1 = result.products.find(p => p.partNumber === 'TM1MW450');
        expect(tm1.quantity).toBe(6);
        expect(tm1.unitPrice).toBe(90);

        const tm2 = result.products.find(p => p.partNumber === 'TM1WX002');
        expect(tm2.quantity).toBe(4);
        expect(tm2.unitPrice).toBe(78);

        // 883681 appears twice (base + _2X)
        const nike = result.products.filter(p => p.partNumber === '883681');
        expect(nike).toHaveLength(2);
        expect(nike[0].quantity).toBe(15);
        expect(nike[0].unitPrice).toBe(60);
        expect(nike[1].quantity).toBe(6);
        expect(nike[1].unitPrice).toBe(62);
    });

    test('883681 products marked as needsLookup', () => {
        const nike = result.products.filter(p => p.partNumber === '883681');
        nike.forEach(p => {
            expect(p.needsLookup).toBe(true);
        });
    });

    test('AL×31 at $5 with quoted "AM" description — no Back Logo warning', () => {
        expect(result.services.additionalLogos).toHaveLength(1);
        const al = result.services.additionalLogos[0];
        expect(al.quantity).toBe(31);
        expect(al.unitPrice).toBe(5);
        expect(al.description).toContain('"AM"');
        // $5 is below $10 threshold — no warning should fire
        const backWarning = result.warnings?.find(w => w.includes('may be Full Back'));
        expect(backWarning).toBeUndefined();
    });

    test('logo dividers ("Grey Logo"/"White Logo") in notes', () => {
        const hasGreyLogo = result.notes.some(n => n === 'Grey Logo');
        const hasWhiteLogo = result.notes.some(n => n === 'White Logo');
        expect(hasGreyLogo).toBe(true);
        expect(hasWhiteLogo).toBe(true);
    });

    test('3 design numbers', () => {
        expect(result.designNumbers).toHaveLength(3);
        expect(result.designNumbers[0]).toContain('2445.01');
        expect(result.designNumbers[1]).toContain('39163');
        expect(result.designNumbers[2]).toContain('2445.03');
    });

    test('out-of-state: zero tax', () => {
        expect(result.orderSummary.salesTax).toBe(0);
        expect(result.orderSummary.taxRate).toBeNull();
    });

    test('no custom products — dividers go to notes, not customProducts', () => {
        expect(result.customProducts).toHaveLength(0);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(2279);
        expect(result.orderSummary.total).toBe(2279);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 5: #136429 — CCNW Commercial Construction Northwest
// Long descriptions (J26112), "Transfer S. Vest" no-PN priced item, empty line item,
// AL×30, size suffix merging (_2X/_3X)
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 5 (#136429): CCNW — long desc, Transfer, empty item, AL', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136429');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('CCNW Commercial Construction Northwest');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('parses 2 regular products (SanMar)', () => {
        expect(result.products).toHaveLength(2);

        const j304 = result.products.find(p => p.partNumber === 'J304');
        expect(j304).toBeDefined();
        expect(j304.color).toBe('Black/Black');
        expect(j304.quantity).toBe(7);
        expect(j304.unitPrice).toBe(86);
        expect(j304.sizes).toEqual({ M: 2, L: 2, XL: 3 });

        const pc90h = result.products.find(p => p.partNumber === 'PC90H');
        expect(pc90h).toBeDefined();
        expect(pc90h.color).toBe('Charcoal');
        expect(pc90h.quantity).toBe(9);
        expect(pc90h.unitPrice).toBe(34.9);
        expect(pc90h.sizes).toEqual({ L: 5, XL: 4 });
    });

    test('parses 4 custom products — J26112 size variants + Transfer', () => {
        expect(result.customProducts).toHaveLength(4);

        // J26112 × 3 size variants
        const j26 = result.customProducts.filter(cp => cp.partNumber === 'J26112');
        expect(j26).toHaveLength(3);
        expect(j26[0].quantity).toBe(16);
        expect(j26[0].unitPrice).toBe(85.66);
        expect(j26[1].quantity).toBe(9);
        expect(j26[1].unitPrice).toBe(87.66);
        expect(j26[2].quantity).toBe(5);
        expect(j26[2].unitPrice).toBe(88.66);
        j26.forEach(cp => {
            expect(cp.needsManualPricing).toBe(true);
        });
    });

    test('J26112 has extremely long description (>100 chars)', () => {
        const j26 = result.customProducts.find(cp => cp.partNumber === 'J26112');
        expect(j26.description.length).toBeGreaterThan(100);
        expect(j26.description).toContain('Ansi 107');
        expect(j26.description).toContain('Reflective Tape');
    });

    test('"Transfer S. Vest" as custom product (no PN, priced)', () => {
        const transfer = result.customProducts.find(cp => cp.description === 'Transfer S. Vest');
        expect(transfer).toBeDefined();
        expect(transfer.partNumber).toBe('');
        expect(transfer.quantity).toBe(1);
        expect(transfer.unitPrice).toBe(12.5);
        expect(transfer.needsManualPricing).toBe(true);
        expect(transfer.reason).toBe('Priced item with no part number');
    });

    test('empty line item silently filtered (not in products or customProducts)', () => {
        const total = result.products.length + result.customProducts.length;
        expect(total).toBe(6);
    });

    test('AL×30 at $12.50 — kept as AL (below $40 reclassify threshold)', () => {
        expect(result.services.additionalLogos).toHaveLength(1);
        const al = result.services.additionalLogos[0];
        expect(al.quantity).toBe(30);
        expect(al.unitPrice).toBe(12.5);
        expect(al.type).toBe('al');
        expect(al.position).toBe('Back');
    });

    test('AL "Back Logo" at $12.50 triggers warning (≥$10 threshold)', () => {
        const backLogoWarning = result.warnings.find(w => w.includes('may be Full Back'));
        expect(backLogoWarning).toBeDefined();
        expect(backLogoWarning).toContain('DECG-FB');
        expect(backLogoWarning).toContain('$12.5');
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
        expect(result.designNumbers[0]).toContain('39156');
        expect(result.designNumbers[1]).toContain('39183');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(3906.4);
        expect(result.orderSummary.total).toBe(4300.95);
        expect(result.orderSummary.paidToDate).toBe(4300.95);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('no unmatched lines', () => {
        expect(result.unmatchedLines).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 6: #136441 — 410 Dental
// Company starts with number, duplicate CJ1614 + CT102788 styles, products-only
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 6 (#136441): 410 Dental — number company, duplicate styles', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136441');
    });

    test('company name starting with number parsed correctly', () => {
        expect(result.customer.company).toBe('410 Dental');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('parses all 8 products', () => {
        expect(result.products).toHaveLength(8);
    });

    test('CJ1614 appears twice — White and Royal', () => {
        const cj = result.products.filter(p => p.partNumber === 'CJ1614');
        expect(cj).toHaveLength(2);
        const colors = cj.map(p => p.color).sort();
        expect(colors).toEqual(['Royal', 'White']);
        cj.forEach(p => {
            expect(p.quantity).toBe(1);
            expect(p.unitPrice).toBe(66);
        });
    });

    test('CT102788 appears 4 times — Navy, Carbon Heather, Black×2', () => {
        const ct = result.products.filter(p => p.partNumber === 'CT102788');
        expect(ct).toHaveLength(4);
        const colors = ct.map(p => p.color).sort();
        expect(colors).toEqual(['Black', 'Black', 'Carbon Heather', 'Navy']);
        ct.forEach(p => {
            expect(p.quantity).toBe(1);
            expect(p.unitPrice).toBe(71);
        });
    });

    test('all products qty=1 (LTM territory)', () => {
        result.products.forEach(p => {
            expect(p.quantity).toBe(1);
        });
    });

    test('products-only order — no services', () => {
        expect(result.decgItems).toHaveLength(0);
        expect(result.services.additionalLogos || []).toHaveLength(0);
        expect(result.services.digitizingFees || []).toHaveLength(0);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
        expect(result.designNumbers[0]).toContain('34915');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(549);
        expect(result.orderSummary.salesTax).toBe(55.45);
        expect(result.orderSummary.total).toBe(604.45);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 7: #136443 — MaxCare of Washington Inc
// DECG×3, multiple AL at different quantities, instruction note, Nike non-SanMar
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 7 (#136443): MaxCare — DECG, multiple AL, instruction note', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136443');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('MaxCare of Washington Inc');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Taylar Hanson');
    });

    test('parses 6 products', () => {
        expect(result.products).toHaveLength(6);
        const partNumbers = result.products.map(p => p.partNumber);
        expect(partNumbers.filter(pn => pn === '779795')).toHaveLength(2);
        expect(partNumbers).toContain('779796');
        expect(partNumbers).toContain('NKDX6720');
        expect(partNumbers.filter(pn => pn === 'LST650')).toHaveLength(2);
    });

    test('product details', () => {
        const nike779795 = result.products.filter(p => p.partNumber === '779795');
        expect(nike779795).toHaveLength(2);
        nike779795.forEach(p => {
            expect(p.quantity).toBe(1);
            expect(p.unitPrice).toBe(96);
        });

        const nkdx = result.products.find(p => p.partNumber === 'NKDX6720');
        expect(nkdx.quantity).toBe(1);
        expect(nkdx.unitPrice).toBe(71);

        const lst = result.products.filter(p => p.partNumber === 'LST650');
        expect(lst).toHaveLength(2);
        lst.forEach(p => {
            expect(p.quantity).toBe(1);
            expect(p.unitPrice).toBe(35);
        });
    });

    test('Nike products (779795, 779796, NKDX6720) marked needsLookup', () => {
        const nikeProducts = result.products.filter(p =>
            ['779795', '779796', 'NKDX6720'].includes(p.partNumber)
        );
        expect(nikeProducts).toHaveLength(4);
        nikeProducts.forEach(p => {
            expect(p.needsLookup).toBe(true);
        });
    });

    test('DECG×3 with correct pricing (tier 1-7, with LTM)', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(3);
        expect(decg.unitPrice).toBe(20);
        expect(decg.calculatedUnitPrice).toBe(28);
        expect(decg.tier).toBe('1-7');
        expect(decg.ltmFee).toBe(50);
    });

    test('2 separate AL entries (qty 2 and qty 4)', () => {
        expect(result.services.additionalLogos).toHaveLength(2);

        const al1 = result.services.additionalLogos[0];
        expect(al1.quantity).toBe(2);
        expect(al1.unitPrice).toBe(8.5);

        const al2 = result.services.additionalLogos[1];
        expect(al2.quantity).toBe(4);
        expect(al2.unitPrice).toBe(8.5);
    });

    test('instruction note "Two polos get both sleeve logos" in notes', () => {
        const instructionNote = result.notes.find(n => n.includes('Two polos'));
        expect(instructionNote).toBeDefined();
        expect(instructionNote).toContain('sleeve logos');
    });

    test('3 design numbers (instruction note excluded)', () => {
        expect(result.designNumbers).toHaveLength(3);
        expect(result.designNumbers[0]).toContain('20376');
        expect(result.designNumbers[1]).toContain('37847');
        expect(result.designNumbers[2]).toContain('20377.02');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(540);
        expect(result.orderSummary.salesTax).toBe(54.54);
        expect(result.orderSummary.total).toBe(594.54);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 8: #136449 — lululemon
// DGT-001 at $100, DECG×26 at $20 (tier 24-47)
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Order 8 (#136449): lululemon — DGT-001, DECG×26', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136449');
    });

    test('extracts customer', () => {
        expect(result.customer.company).toBe('lululemon');
    });

    test('extracts sales rep', () => {
        expect(result.salesRep.name).toBe('Nika Lao');
    });

    test('no regular products — DECG-only order', () => {
        expect(result.products).toHaveLength(0);
    });

    test('DECG×26 with correct pricing (tier 24-47)', () => {
        expect(result.decgItems).toHaveLength(1);
        const decg = result.decgItems[0];
        expect(decg.quantity).toBe(26);
        expect(decg.unitPrice).toBe(20);
        expect(decg.calculatedUnitPrice).toBe(24);
        expect(decg.tier).toBe('24-47');
        expect(decg.ltmFee).toBe(0);
    });

    test('DGT-001 digitizing at $100', () => {
        expect(result.services.digitizingFees).toHaveLength(1);
        const dgt = result.services.digitizingFees[0];
        expect(dgt.code).toBe('DGT-001');
        expect(dgt.amount).toBe(100);
    });

    test('design number', () => {
        expect(result.designNumbers).toHaveLength(1);
        expect(result.designNumbers[0]).toContain('39162');
        expect(result.designNumbers[0]).toContain('Women in Tech');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(620);
        expect(result.orderSummary.salesTax).toBe(62.62);
        expect(result.orderSummary.total).toBe(682.62);
        expect(result.orderSummary.paidToDate).toBe(682.62);
        expect(result.orderSummary.balance).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-order assertions
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 11 — Cross-order checks', () => {
    let results;
    beforeAll(() => {
        results = orders.map(o => new ShopWorksImportParser().parse(o));
    });

    test('all 8 orders parse without throwing', () => {
        expect(results).toHaveLength(8);
        results.forEach(r => {
            expect(r.orderId).toBeDefined();
            expect(r.customer).toBeDefined();
        });
    });

    test('order IDs are unique', () => {
        const ids = results.map(r => r.orderId);
        expect(new Set(ids).size).toBe(8);
    });

    test('2 reps: Nika (5 orders) and Taylar (3 orders)', () => {
        const nika = results.filter(r => r.salesRep?.name === 'Nika Lao');
        const taylar = results.filter(r => r.salesRep?.name === 'Taylar Hanson');
        expect(nika).toHaveLength(5);
        expect(taylar).toHaveLength(3);
    });

    test('3 orders have DECG items', () => {
        const decgOrders = results.filter(r => r.decgItems?.length > 0);
        expect(decgOrders).toHaveLength(3);
    });

    test('total products across all orders', () => {
        // 1+0+2+4+2+8+6+0 = 23 regular products (custom products counted separately)
        const totalProducts = results.reduce((sum, r) => sum + (r.products?.length || 0), 0);
        expect(totalProducts).toBe(23);
    });

    test('no order has errors in parsing', () => {
        results.forEach(r => {
            expect(r.error).toBeUndefined();
        });
    });
});
