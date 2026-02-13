/**
 * Raw Sections & Unmatched Lines Tests
 * Tests ShopWorksImportParser.unmatchedLines capture and designNumbers extraction
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('unmatchedLines — standard fixtures produce empty array', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('simple-garment.txt has no unmatched lines', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.unmatchedLines).toEqual([]);
    });

    test('mixed-cap-garment.txt has no unmatched lines', () => {
        const result = parser.parse(loadFixture('mixed-cap-garment.txt'));
        expect(result.unmatchedLines).toEqual([]);
    });

    test('caps-oos.txt has no unmatched lines', () => {
        const result = parser.parse(loadFixture('caps-oos.txt'));
        expect(result.unmatchedLines).toEqual([]);
    });

    test('gift-code.txt has no unmatched lines', () => {
        const result = parser.parse(loadFixture('gift-code.txt'));
        expect(result.unmatchedLines).toEqual([]);
    });

    test('customer-pickup.txt has no unmatched lines', () => {
        const result = parser.parse(loadFixture('customer-pickup.txt'));
        expect(result.unmatchedLines).toEqual([]);
    });
});

describe('unmatchedLines — captures unknown fields', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('unknown-fields.txt captures unrecognized lines', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        expect(result.unmatchedLines.length).toBeGreaterThan(0);
    });

    test('unknown "Department:" line in order header captured', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        const headerUnmatched = result.unmatchedLines.filter(u => u.section === 'OrderHeader');
        expect(headerUnmatched.some(u => u.line.includes('Department'))).toBe(true);
    });

    test('unknown "Approval Status:" line in order info captured', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        const infoUnmatched = result.unmatchedLines.filter(u => u.section === 'OrderInfo');
        expect(infoUnmatched.some(u => u.line.includes('Approval Status'))).toBe(true);
    });

    test('unknown "Handling Fee:" line in order summary captured', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        const summaryUnmatched = result.unmatchedLines.filter(u => u.section === 'OrderSummary');
        expect(summaryUnmatched.some(u => u.line.includes('Handling Fee'))).toBe(true);
    });

    test('known fields still parsed correctly alongside unknown fields', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        expect(result.orderId).toBe('150999');
        expect(result.customer.contactName).toBe('Jane Doe');
        expect(result.customer.email).toBe('jane@testcompany.com');
        expect(result.orderSummary.subtotal).toBe(288);
        expect(result.orderSummary.salesTax).toBe(29.09);
        expect(result.orderSummary.total).toBe(322.09);
    });
});

describe('designNumbers — extracted correctly', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('designNumbers array exists in parse result', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(Array.isArray(result.designNumbers)).toBe(true);
    });

    test('single design number extracted', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        expect(result.designNumbers.length).toBe(1);
        expect(result.designNumbers[0]).toContain('Design #50001');
        expect(result.designNumbers[0]).toContain('Test Company Logo');
    });

    test('designNumbers are also in notes array for backward compat', () => {
        const result = parser.parse(loadFixture('unknown-fields.txt'));
        const designNote = result.notes.find(n => n.includes('50001'));
        expect(designNote).toBeDefined();
        expect(designNote).toBe(result.designNumbers[0]);
    });

    test('order with no design section has empty designNumbers', () => {
        // Create a minimal order with no design section
        const minimalOrder = `**************
Order #: 999999
Salesperson: Test
Email: test@test.com
**************
Customer #: 10001
Company: Minimal Corp
**************
Items Purchased
Item 1 of 1

Part Number: PC54
Description: Test Tee, White
Item Quantity: 1
Unit Price: $10.00
**************
Order Summary
Subtotal: $10.00
Total: $10.00`;
        const result = parser.parse(minimalOrder);
        expect(result.designNumbers).toEqual([]);
    });
});
