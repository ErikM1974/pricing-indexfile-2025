/**
 * A discount must survive the round-trip.
 *
 * The push side never emits a DISCOUNT *line*: `buildOrderPayload` sums discount items into the
 * order-level `TotalDiscounts` field (embroidery-push-transformer.js — "TAX, SHIP, DISCOUNT are
 * skipped, handled at order level"), converting the quote system's NEGATIVE LineTotal to a
 * positive. ShopWorks then prints that back as an ordinary line — `Part Number: DISCOUNT`,
 * `Unit Price: $-100.00` — which the parser dropped on the floor, because 'DISCOUNT' sat in
 * INVALID_PARTS next to TAX / TOTAL / GIFT CODE.
 *
 * So re-quoting a discounted order silently billed the customer the discount back. Direction is
 * OVER-charging, and it is invisible: nothing on screen says a discount was discarded.
 *
 * Sign convention, which is the whole risk here:
 *   ShopWorks paste     Unit Price: $-100.00   (negative)
 *   quote system item   LineTotal -100         (negative)
 *   builder input       #discount-amount 100   (POSITIVE — subtracted from the total)
 *   ManageOrders        TotalDiscounts 100     (positive)
 * Importing the raw negative as the builder's amount would leave the discount inert
 * (`if (discountAmount > 0)` hides the row); importing it unsigned into a fee row would ADD $100.
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

describe('classifyPartNumber knows a discount from junk', () => {
    let parser;
    beforeEach(() => { parser = new ShopWorksImportParser(); });

    test('DISCOUNT is a discount, not invalid', () => {
        expect(parser.classifyPartNumber('DISCOUNT')).toBe('discount');
        expect(parser.classifyPartNumber('Discount')).toBe('discount');
    });

    test('the other INVALID_PARTS stay invalid — this is a carve-out, not a demolition', () => {
        // GIFT CODE is a PAYMENT, not a price reduction, and TAX/TOTAL/TEST are summary noise.
        for (const pn of ['GIFT CODE', 'TEST', 'TAX', 'TOTAL']) {
            expect(parser.classifyPartNumber(pn)).toBe('invalid');
        }
    });
});

describe('a real discounted order keeps its discount', () => {
    let result;
    beforeAll(() => {
        // caps-oos.txt carries `Part Number: DISCOUNT` / `Volume Discount` / `Unit Price: $-100.00`
        // — a real captured order, not a hand-built case.
        result = new ShopWorksImportParser().parse(
            fs.readFileSync(path.join(FIXTURES_DIR, 'caps-oos.txt'), 'utf8'));
    });

    test('the discount is captured as a POSITIVE amount the builder can use', () => {
        expect(result.services.discount).toBeDefined();
        expect(result.services.discount.amount).toBe(100);
    });

    test('the reason survives, so the rep can see WHY it was discounted', () => {
        expect(result.services.discount.description).toMatch(/Volume Discount/i);
    });

    test('it does NOT become a product or a positive fee line', () => {
        const pns = (result.products || []).map((p) => String(p.partNumber).toUpperCase());
        expect(pns).not.toContain('DISCOUNT');
        // and nothing added $100 of charge anywhere
        expect(result.services.discount.amount).toBeGreaterThan(0);
    });
});

describe('sign handling', () => {
    const order = (qty, price) => [
        '**************', 'Order #: 99996', 'Salesperson: T', 'Email: t@nwcustomapparel.com',
        '**************', 'Customer #: 1', 'Company: T', '**************', 'Order Information',
        'Ordered by: T', 'Email: t@t.com', 'Date Order Placed: 01/01/2026', 'Terms: COD',
        '**************', 'Items Purchased', 'Item 1 of 2', '', 'Part Number: PC54',
        'Description: Tee', 'Item Quantity: 24', 'Unit Price:15.00', 'Adult:Quantity', 'M:24', '',
        'Item 2 of 2', '', 'Part Number: DISCOUNT', 'Description: Loyalty',
        `Item Quantity: ${qty}`, `Unit Price:${price}`, '',
    ].join('\n');
    const parse = (qty, price) => new ShopWorksImportParser().parse(order(qty, price));

    test('a negative unit price becomes a positive discount', () => {
        expect(parse(1, '$-100.00').services.discount.amount).toBe(100);
    });

    test('quantity multiplies — a per-piece discount is not billed once', () => {
        expect(parse(24, '-2.50').services.discount.amount).toBe(60);
    });

    test('a positive-signed discount line is still a REDUCTION', () => {
        // ShopWorks is inconsistent about the sign; a "DISCOUNT" line can never mean "add money".
        expect(parse(1, '75.00').services.discount.amount).toBe(75);
    });

    test('two discount lines add up', () => {
        const text = order(1, '-50.00').replace(
            'Item 2 of 2', 'Item 2 of 3'
        ) + ['', 'Item 3 of 3', '', 'Part Number: DISCOUNT', 'Description: Extra',
            'Item Quantity: 1', 'Unit Price:-25.00', ''].join('\n');
        expect(new ShopWorksImportParser().parse(text).services.discount.amount).toBe(75);
    });

    test('a zero discount is not a discount', () => {
        const r = parse(1, '0.00');
        expect(r.services.discount == null || r.services.discount.amount === 0).toBe(true);
    });
});
