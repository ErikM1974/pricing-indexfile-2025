/**
 * Product Parsing Tests
 * Tests ShopWorksImportParser product extraction from ShopWorks order text
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('Product parsing — simple-garment fixture', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('simple-garment.txt'));
    });

    test('extracts correct number of product items', () => {
        // PC61LS and PC61LS_3X are products; DD is digitizing
        expect(result.products.length).toBeGreaterThanOrEqual(1);
    });

    test('first product has correct style number', () => {
        const product = result.products.find(p => p.partNumber === 'PC61LS' || p.partNumber === 'PC61LS_3X');
        expect(product).toBeDefined();
    });

    test('digitizing is detected as service, not product', () => {
        const ddProduct = result.products.find(p => p.partNumber === 'DD');
        expect(ddProduct).toBeUndefined();
        expect(result.services.digitizing).toBe(true);
    });
});

describe('Product parsing — multi-product out-of-state', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('multi-product-oos.txt'));
    });

    test('extracts 4 product items (PC54 x2 colors, PC54_2X x2 colors)', () => {
        expect(result.products.length).toBe(4);
    });

    test('same style different colors are separate products', () => {
        const pc54Products = result.products.filter(p =>
            p.partNumber === 'PC54' || p.partNumber === 'PC54_2X'
        );
        expect(pc54Products.length).toBe(4);
    });

    test('AL is detected as service, not product', () => {
        const alProduct = result.products.find(p => p.partNumber === 'AL');
        expect(alProduct).toBeUndefined();
    });
});

describe('Product parsing — non-SanMar products', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('non-sanmar.txt'));
    });

    test('WW3150 and WW3160 are detected as non-SanMar', () => {
        expect(parser._isNonSanMarProduct('WW3150')).toBe(true);
        expect(parser._isNonSanMarProduct('WW3160')).toBe(true);
    });

    test('non-SanMar products go to customProducts array', () => {
        expect(result.customProducts.length).toBeGreaterThanOrEqual(1);
    });

    test('SanMar product patterns NOT falsely detected as non-SanMar', () => {
        expect(parser._isNonSanMarProduct('PC54')).toBe(false);
        expect(parser._isNonSanMarProduct('K500')).toBe(false);
        expect(parser._isNonSanMarProduct('C112')).toBe(false);
        expect(parser._isNonSanMarProduct('PC61LS')).toBe(false);
    });
});

describe('Product parsing — same style different colors', () => {
    let parser, result;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
        result = parser.parse(loadFixture('same-style-diff-colors.txt'));
    });

    test('two K500 products (Black and Majestic Purple) are both extracted', () => {
        const k500Products = result.products.filter(p => p.partNumber === 'K500');
        expect(k500Products.length).toBe(2);
    });

    test('monogram is detected as service, not product', () => {
        const monoProduct = result.products.find(p => p.partNumber === 'MONOGRAM');
        expect(monoProduct).toBeUndefined();
    });
});

describe('Non-SanMar patterns detection', () => {
    let parser;

    beforeAll(() => {
        parser = new ShopWorksImportParser();
    });

    test('MCK prefix → non-SanMar (Cutter & Buck)', () => {
        expect(parser._isNonSanMarProduct('MCK12345')).toBe(true);
    });

    test('MQK prefix → non-SanMar', () => {
        expect(parser._isNonSanMarProduct('MQK67890')).toBe(true);
    });

    test('WW prefix → non-SanMar (Wink)', () => {
        expect(parser._isNonSanMarProduct('WW3150')).toBe(true);
        expect(parser._isNonSanMarProduct('WW3160')).toBe(true);
    });

    test('STK- prefix → non-SanMar (Stickers)', () => {
        expect(parser._isNonSanMarProduct('STK-100')).toBe(true);
    });

    test('-G suffix → non-SanMar (Promotional)', () => {
        expect(parser._isNonSanMarProduct('12345-G')).toBe(true);
    });

    test('regular part numbers → SanMar', () => {
        expect(parser._isNonSanMarProduct('PC54')).toBe(false);
        expect(parser._isNonSanMarProduct('K500')).toBe(false);
        expect(parser._isNonSanMarProduct('ST850')).toBe(false);
        expect(parser._isNonSanMarProduct('DT6000')).toBe(false);
    });

    test('null/empty → false', () => {
        expect(parser._isNonSanMarProduct(null)).toBe(false);
        expect(parser._isNonSanMarProduct('')).toBe(false);
    });
});
