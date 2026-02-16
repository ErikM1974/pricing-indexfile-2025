/**
 * Batch 10 Parser Tests — 8 real ShopWorks orders
 *
 * Edge cases covered:
 * - 5 designs, 41 items, (white logo)/(black logo) desc prefixes, LIMITED EDITION
 * - CT89098101_OSFA waist pack, OR322218_XXL suffix
 * - Monogram with sponsor info "Whitney Gates ---Heavy Honda"
 * - Customer Pickup with no ZIP (state-only address parse)
 * - Richardson caps with decoration in desc ("- Left Panel", "- Patch")
 * - No-SKU laser engraving → customProducts
 * - Empty "Added On" line → notes/skipped
 * - Description-only section headers ("Park Ambassador", "Office T-shirt", "Office Hoodie")
 * - Name PNs with initials ("Jason M.", "Colby W.", "Matt O.")
 * - Triple spaces in Ordered by, no Shipping section
 * - Hyphenated name "Jon-Paul Mickle", DECG + AL only (no products)
 * - 4 DECG with 3rd-party brand details (North Face, Patagonia)
 * - Monogram qty=3 for single name, UPS shipping + tracking
 * - Note section with billing info, Req Ship Date 6+ months out
 * - C112_OSFA x200, AL qty=200
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const BATCH_FILE = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders', 'shopworks_orders_batch10.txt');

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
// Order 1: #136244 — Patriot Fire Protection
// 5 designs, 41 items, (white/black logo) prefixes, LIMITED EDITION, OSFA, _XXL
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 1 (#136244): Patriot Fire — 41 items, 5 designs', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[0]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136244');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Patriot Fire Protection');
    });

    test('extracts 5 design numbers', () => {
        expect(result.designNumbers).toHaveLength(5);
        expect(result.designNumbers[0]).toContain('29988');
    });

    test('extracts 41 products (all items are products)', () => {
        expect(result.products).toHaveLength(41);
    });

    test('(white logo) prefix preserved in description', () => {
        const whiteLogos = result.products.filter(p => p.description && p.description.includes('(white logo)'));
        expect(whiteLogos.length).toBeGreaterThanOrEqual(2);
    });

    test('(black logo) prefix preserved in description', () => {
        const blackLogos = result.products.filter(p => p.description && p.description.includes('(black logo)'));
        expect(blackLogos.length).toBeGreaterThanOrEqual(2);
    });

    test('LIMITED EDITION preserved in description', () => {
        const limited = result.products.filter(p => p.description && p.description.includes('LIMITED EDITION'));
        expect(limited).toHaveLength(1);
        expect(limited[0].partNumber).toBe('OR322218');
    });

    test('CT89098101_OSFA → base CT89098101, size OSFA', () => {
        const waistPack = result.products.find(p => p.partNumber === 'CT89098101');
        expect(waistPack).toBeDefined();
        expect(waistPack.sizes).toHaveProperty('OSFA');
    });

    test('OR322218_XXL → base OR322218, size 2XL', () => {
        const vest = result.products.find(p => p.partNumber === 'OR322218');
        expect(vest).toBeDefined();
        expect(vest.sizes).toHaveProperty('2XL');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping).toBeDefined();
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('shipping address parsed with state and ZIP', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98424');
        expect(result.shipping.city).toBe('Tacoma');
    });

    test('order summary totals', () => {
        expect(result.orderSummary.subtotal).toBe(1795.00);
        expect(result.orderSummary.salesTax).toBe(181.30);
        expect(result.orderSummary.total).toBe(1976.30);
    });

    test('paid to date and balance', () => {
        expect(result.orderSummary.paidToDate).toBe(1976.30);
        expect(result.orderSummary.balance).toBe(0);
    });

    test('no services (no DD, AL, DECG)', () => {
        expect(result.services.digitizing).toBe(false);
        expect(result.services.additionalLogos).toBeUndefined();
        expect(result.decgItems).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 2: #136257 — Little Wheels QMA
// Monogram with sponsor info, Customer Pickup with no ZIP (state-only)
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 2 (#136257): Little Wheels — state-only address, monogram sponsor', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[1]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136257');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Little Wheels QMA');
    });

    test('extracts 1 product (J317)', () => {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].partNumber).toBe('J317');
        expect(result.products[0].sizes).toHaveProperty('2XL');
    });

    test('AL with qty=2 at $120', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(2);
        expect(result.services.additionalLogos[0].unitPrice).toBe(120.00);
    });

    test('Monogram with sponsor info preserved in description', () => {
        expect(result.services.monograms).toHaveLength(1);
        expect(result.services.monograms[0].description).toContain('Whitney Gates');
        expect(result.services.monograms[0].description).toContain('---Heavy Honda');
    });

    test('Customer Pickup ship method', () => {
        expect(result.shipping.method).toBe('Customer Pickup');
    });

    test('state-only address: state=WA extracted (no ZIP)', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.city).toBe('Graham');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(352.98);
        expect(result.orderSummary.salesTax).toBe(35.65);
        expect(result.orderSummary.total).toBe(388.63);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 3: #136271 — Custom Trucks NW
// DD, Richardson caps with decoration desc, no-SKU laser, empty "Added On", same style x3
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 3 (#136271): Custom Trucks NW — Richardson, laser, Added On', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[2]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136271');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Custom Trucks NW');
    });

    test('DD digitizing found', () => {
        expect(result.services.digitizing).toBe(true);
        expect(result.services.digitizingCount).toBe(1);
    });

    test('3 design numbers', () => {
        expect(result.designNumbers).toHaveLength(3);
        expect(result.designNumbers[0]).toContain('39112');
    });

    test('extracts 13 products (excluding DD, Added On, laser)', () => {
        expect(result.products).toHaveLength(13);
    });

    test('Richardson 112 appears 3 times as separate products', () => {
        const r112 = result.products.filter(p => p.partNumber === '112');
        expect(r112).toHaveLength(3);
    });

    test('"- Left Panel" and "- Patch" in Richardson descriptions preserved', () => {
        const r112 = result.products.filter(p => p.partNumber === '112');
        const descs = r112.map(p => p.description);
        expect(descs.some(d => d.includes('Left Panel'))).toBe(true);
        expect(descs.some(d => d.includes('Patch'))).toBe(true);
    });

    test('K110 appears twice (item 4 and item 13)', () => {
        const k110 = result.products.filter(p => p.partNumber === 'K110' && !Object.keys(p.sizes).includes('2XL'));
        expect(k110.length).toBeGreaterThanOrEqual(2);
    });

    test('CTK121 appears 3 times (items 8, 9 as _2X, 16)', () => {
        const ctk = result.products.filter(p => p.partNumber === 'CTK121');
        expect(ctk).toHaveLength(3);
    });

    test('no-SKU laser engraving → customProducts', () => {
        expect(result.customProducts).toBeDefined();
        expect(result.customProducts.length).toBeGreaterThanOrEqual(1);
        const laser = result.customProducts.find(p => p.description && p.description.includes('Laser'));
        expect(laser).toBeDefined();
        expect(laser.unitPrice).toBe(12.50);
        expect(laser.quantity).toBe(2);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(6944.00);
        expect(result.orderSummary.salesTax).toBe(701.34);
        expect(result.orderSummary.total).toBe(7645.34);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 4: #136303 — City of Bonney Lake
// Desc-only headers, Name PNs, triple spaces, no Shipping, DECG
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 4 (#136303): City of Bonney Lake — desc headers, Name monograms', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[3]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136303');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toContain('Bonney Lake');
    });

    test('3 design numbers', () => {
        expect(result.designNumbers).toHaveLength(3);
    });

    test('description-only section headers go to notes', () => {
        const noteTexts = result.notes.map(n => typeof n === 'string' ? n : n.text || n.description || '');
        const hasAmbassador = noteTexts.some(n => n.includes('Park Ambassador'));
        const hasOfficeT = noteTexts.some(n => n.includes('Office T-shirt'));
        const hasHoodie = noteTexts.some(n => n.includes('Office Hoodie'));
        expect(hasAmbassador || hasOfficeT || hasHoodie).toBe(true);
    });

    test('15 products (K240, PC55, PC61LS, PC90H variants)', () => {
        expect(result.products).toHaveLength(15);
    });

    test('3 Name monograms with initials', () => {
        expect(result.services.monograms).toHaveLength(3);
        const descs = result.services.monograms.map(m => m.description);
        expect(descs).toContain('Jason M.');
        expect(descs).toContain('Colby W.');
        expect(descs).toContain('Matt O.');
    });

    test('DECG qty=3 at $25/ea', () => {
        const decgs = result.decgItems.filter(d => d.serviceType === 'decg');
        expect(decgs).toHaveLength(1);
        expect(decgs[0].quantity).toBe(3);
        expect(decgs[0].unitPrice).toBe(25.00);
    });

    test('AL qty=16 at $12.50', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(16);
        expect(result.services.additionalLogos[0].unitPrice).toBe(12.50);
    });

    test('no Shipping section → shipping is null', () => {
        expect(result.shipping).toBeNull();
    });

    test('triple spaces handled in contactName', () => {
        expect(result.customer.contactName).toBeDefined();
        expect(result.customer.contactName).toContain('Mikki');
        expect(result.customer.contactName).toContain('Withers');
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(1410.50);
        expect(result.orderSummary.salesTax).toBe(142.46);
        expect(result.orderSummary.total).toBe(1552.96);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 5: #136318 — UW Naval ROTC
// Hyphenated name, DECG + AL only (no products)
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 5 (#136318): UW Naval ROTC — hyphenated name, DECG-only', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[4]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136318');
    });

    test('hyphenated name preserved in contactName', () => {
        expect(result.customer.contactName).toContain('Jon-Paul');
        expect(result.customer.contactName).toContain('Mickle');
    });

    test('DECG qty=1 at $20', () => {
        const decgs = result.decgItems.filter(d => d.serviceType === 'decg');
        expect(decgs).toHaveLength(1);
        expect(decgs[0].quantity).toBe(1);
        expect(decgs[0].unitPrice).toBe(20.00);
    });

    test('AL qty=1 at $20', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(1);
        expect(result.services.additionalLogos[0].unitPrice).toBe(20.00);
    });

    test('no products (DECG + AL only)', () => {
        expect(result.products).toHaveLength(0);
    });

    test('2 design numbers', () => {
        expect(result.designNumbers).toHaveLength(2);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(40.00);
        expect(result.orderSummary.total).toBe(44.04);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 6: #136350 — Rainier Family Wealth
// DD, 4 DECG with 3rd-party brand details, total qty=13
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 6 (#136350): Rainier Family Wealth — 4 DECG, 3rd-party brands', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[5]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136350');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Rainier Family Wealth');
    });

    test('DD digitizing found', () => {
        expect(result.services.digitizing).toBe(true);
        expect(result.services.digitizingCount).toBe(1);
    });

    test('4 DECG items', () => {
        const decgs = result.decgItems.filter(d => d.serviceType === 'decg');
        expect(decgs).toHaveLength(4);
    });

    test('DECG total qty = 13 (1+1+1+10)', () => {
        const decgs = result.decgItems.filter(d => d.serviceType === 'decg');
        const totalQty = decgs.reduce((sum, d) => sum + d.quantity, 0);
        expect(totalQty).toBe(13);
    });

    test('DECG descriptions contain brand references', () => {
        const decgs = result.decgItems.filter(d => d.serviceType === 'decg');
        const allDescs = decgs.map(d => d.description).join(' ');
        expect(allDescs).toContain('NF Fleece');
        expect(allDescs).toContain('Patagonia');
    });

    test('3 design numbers', () => {
        expect(result.designNumbers).toHaveLength(3);
    });

    test('no products (DECG-only)', () => {
        expect(result.products).toHaveLength(0);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(555.00);
        expect(result.orderSummary.total).toBe(611.06);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 7: #136359 — Sherlock Investments
// Monogram qty=3, UPS shipping + tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 7 (#136359): Sherlock — monogram qty=3, UPS tracking', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[6]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136359');
    });

    test('Monogram qty=3 with description containing "Charlee"', () => {
        expect(result.services.monograms).toHaveLength(1);
        expect(result.services.monograms[0].quantity).toBe(3);
        expect(result.services.monograms[0].description).toContain('Charlee');
    });

    test('2 products (LPC099V and DT671)', () => {
        expect(result.products).toHaveLength(2);
        const pns = result.products.map(p => p.partNumber);
        expect(pns).toContain('LPC099V');
        expect(pns).toContain('DT671');
    });

    test('UPS ship method', () => {
        expect(result.shipping.method).toBe('UPS');
    });

    test('shipping address parsed', () => {
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98019');
        expect(result.shipping.city).toBe('Duvall');
    });

    test('package tracking parsed', () => {
        expect(result.packageTracking).toBeDefined();
        expect(result.packageTracking.length).toBeGreaterThanOrEqual(1);
        expect(result.packageTracking[0].carrier).toBe('UPS');
        expect(result.packageTracking[0].trackingNumber).toBe('1Z9033130341829388');
    });

    test('order summary with shipping', () => {
        expect(result.orderSummary.subtotal).toBe(121.50);
        expect(result.orderSummary.shipping).toBe(22.42);
        expect(result.orderSummary.total).toBe(158.46);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order 8: #136386 — Holt Services
// Note section, C112_OSFA x200, AL qty=200, Req Ship Date 6+ months
// ─────────────────────────────────────────────────────────────────────────────
describe('Batch 10 — Order 8 (#136386): Holt Services — Note, C112_OSFA, AL x200', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(orders[7]);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('136386');
    });

    test('extracts customer company', () => {
        expect(result.customer.company).toBe('Holt Services');
    });

    test('Note section → orderNotes contains billing info', () => {
        expect(result.orderNotes).toBeDefined();
        expect(result.orderNotes).toContain('Billing Questions');
    });

    test('C112_OSFA → base C112, size OSFA', () => {
        const caps = result.products.filter(p => p.partNumber === 'C112');
        expect(caps).toHaveLength(2);
        caps.forEach(cap => {
            expect(cap.sizes).toHaveProperty('OSFA');
        });
    });

    test('2 products (same style, 2 colors), qty 100 each', () => {
        expect(result.products).toHaveLength(2);
        result.products.forEach(p => {
            expect(p.quantity).toBe(100);
        });
    });

    test('AL qty=200 at $5/ea', () => {
        expect(result.services.additionalLogos).toBeDefined();
        expect(result.services.additionalLogos).toHaveLength(1);
        expect(result.services.additionalLogos[0].quantity).toBe(200);
        expect(result.services.additionalLogos[0].unitPrice).toBe(5.00);
    });

    test('4 design numbers', () => {
        expect(result.designNumbers).toHaveLength(4);
    });

    test('order summary', () => {
        expect(result.orderSummary.subtotal).toBe(4000.00);
        expect(result.orderSummary.salesTax).toBe(404.00);
        expect(result.orderSummary.total).toBe(4404.00);
    });

    test('Req Ship Date parsed (Nov 2025)', () => {
        expect(result.reqShipDate).toBeDefined();
        expect(result.reqShipDate).toContain('11/28/2025');
    });
});
