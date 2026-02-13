/**
 * Shipping Info Parsing Tests
 * Tests ShopWorksImportParser._parseShippingInfo()
 *
 * Address format: "Company, Street, City, ST ZIP-XXXX, Country"
 * Example: "RPD, 23916 70TH AVENUE CT E, GRAHAM, WA 98338-9356, US"
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('_parseShippingInfo() — via fixtures', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('WA address: Federal Way, WA 98003', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.city).toBe('Federal Way');
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98003');
        expect(result.shipping.method).toBe('UPS Ground');
    });

    test('TX address (out-of-state): Austin, TX 78759', () => {
        const result = parser.parse(loadFixture('multi-product-oos.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.city).toBe('Austin');
        expect(result.shipping.state).toBe('TX');
        expect(result.shipping.zip).toBe('78759');
    });

    test('WA address: Vancouver, WA 98662', () => {
        const result = parser.parse(loadFixture('non-sanmar.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.city).toBe('Vancouver');
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98662');
    });

    test('ID address (out-of-state): Boise, ID 83702', () => {
        const result = parser.parse(loadFixture('caps-oos.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.city).toBe('Boise');
        expect(result.shipping.state).toBe('ID');
        expect(result.shipping.zip).toBe('83702');
    });

    test('Customer Pickup → method set but no address components', () => {
        const result = parser.parse(loadFixture('customer-pickup.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.method).toBe('Customer Pick Up');
        // Customer Pick Up has raw address but no city/state
        // since "Customer Pick Up" doesn't match the state+zip pattern
        expect(result.shipping.state).toBeNull();
        expect(result.shipping.zip).toBeNull();
    });

    test('WA address: Tacoma, WA 98402', () => {
        const result = parser.parse(loadFixture('same-style-diff-colors.txt'));
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.city).toBe('Tacoma');
        expect(result.shipping.state).toBe('WA');
        expect(result.shipping.zip).toBe('98402');
    });
});

describe('_parseShippingInfo() — direct method', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('standard multi-segment address', () => {
        const result = { shipping: null };
        const text = `Ship Method: UPS Ground
Ship Address: Cedar Square Home, 123 Main St Ste B, Boise, ID 83702-1234, US`;
        parser._parseShippingInfo(text, result);

        expect(result.shipping.method).toBe('UPS Ground');
        expect(result.shipping.city).toBe('Boise');
        expect(result.shipping.state).toBe('ID');
        expect(result.shipping.zip).toBe('83702');
    });

    test('address without country code', () => {
        const result = { shipping: null };
        const text = `Ship Method: FedEx
Ship Address: ACME Corp, 456 Oak Ave, Portland, OR 97201`;
        parser._parseShippingInfo(text, result);

        expect(result.shipping.state).toBe('OR');
        expect(result.shipping.zip).toBe('97201');
        expect(result.shipping.city).toBe('Portland');
    });

    test('missing ship address line → no crash', () => {
        const result = { shipping: null };
        parser._parseShippingInfo('Ship Method: UPS Ground', result);
        expect(result.shipping).not.toBeNull();
        expect(result.shipping.method).toBe('UPS Ground');
        expect(result.shipping.state).toBeNull();
    });

    test('no shipping section → result.shipping stays null', () => {
        const result = { shipping: null };
        parser._parseShippingInfo('No shipping info here', result);
        expect(result.shipping).toBeNull();
    });
});
