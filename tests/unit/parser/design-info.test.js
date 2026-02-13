/**
 * Design Info Parsing Tests
 * Tests ShopWorksImportParser._parseDesignInfo()
 *
 * Formats:
 * - "Design #:39719.01 - Stella Jones signature logo" → "Design #39719.01 — Stella Jones signature logo"
 * - "Design #:12345 - Simple Logo" → "Design #12345 — Simple Logo"
 * - "Design #:12345" → "Design #12345"
 * - "Design #:100.5 - Half design" → "Design #100.5 — Half design"
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

function loadFixture(filename) {
    return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

describe('_parseDesignInfo() — via full parse', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('simple design number with description', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        const designNote = result.notes.find(n => n.includes('39800'));
        expect(designNote).toBeDefined();
        expect(designNote).toContain('Design #39800');
        expect(designNote).toContain('Absher Construction Logo');
    });

    test('decimal design number with description', () => {
        const result = parser.parse(loadFixture('customer-pickup.txt'));
        const designNote1 = result.notes.find(n => n.includes('39719.01'));
        expect(designNote1).toBeDefined();
        expect(designNote1).toContain('Design #39719.01');
        expect(designNote1).toContain('Forma signature logo');
    });

    test('multiple designs in one order', () => {
        const result = parser.parse(loadFixture('customer-pickup.txt'));
        const designNotes = result.notes.filter(n => n.startsWith('Design #'));
        expect(designNotes.length).toBe(2);
        expect(designNotes[0]).toContain('39719.01');
        expect(designNotes[1]).toContain('39719.02');
    });

    test('two designs in mixed cap/garment order', () => {
        const result = parser.parse(loadFixture('mixed-cap-garment.txt'));
        const designNotes = result.notes.filter(n => n.startsWith('Design #'));
        expect(designNotes.length).toBe(2);
        expect(designNotes[0]).toContain('40200');
        expect(designNotes[1]).toContain('40201');
    });

    test('designNumbers array populated via full parse', () => {
        const result = parser.parse(loadFixture('simple-garment.txt'));
        expect(result.designNumbers).toBeDefined();
        expect(result.designNumbers.length).toBe(1);
        expect(result.designNumbers[0]).toContain('Design #39800');
        expect(result.designNumbers[0]).toContain('Absher Construction Logo');
    });

    test('designNumbers matches notes for multi-design order', () => {
        const result = parser.parse(loadFixture('customer-pickup.txt'));
        expect(result.designNumbers.length).toBe(2);
        expect(result.designNumbers[0]).toContain('39719.01');
        expect(result.designNumbers[1]).toContain('39719.02');
    });
});

describe('_parseDesignInfo() — direct method test', () => {
    let parser;

    beforeEach(() => {
        parser = new ShopWorksImportParser();
    });

    test('Design #:12345 - Simple Logo', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('Design #:12345 - Simple Logo', result);
        expect(result.notes[0]).toBe('Design #12345 — Simple Logo');
        expect(result.designNumbers[0]).toBe('Design #12345 — Simple Logo');
    });

    test('Design #:39719.01 - Stella Jones signature logo', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('Design #:39719.01 - Stella Jones signature logo', result);
        expect(result.notes[0]).toBe('Design #39719.01 — Stella Jones signature logo');
        expect(result.designNumbers[0]).toBe('Design #39719.01 — Stella Jones signature logo');
    });

    test('Design #:12345 (no description)', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('Design #:12345', result);
        expect(result.notes[0]).toBe('Design #12345');
        expect(result.designNumbers[0]).toBe('Design #12345');
    });

    test('Design #:100.5 - Half design', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('Design #:100.5 - Half design', result);
        expect(result.notes[0]).toBe('Design #100.5 — Half design');
    });

    test('No design info → no notes added', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('This is not a design line', result);
        expect(result.notes.length).toBe(0);
        expect(result.designNumbers.length).toBe(0);
    });

    test('Design with em-dash separator', () => {
        const result = { notes: [], designNumbers: [] };
        parser._parseDesignInfo('Design #:54321 — Company Logo', result);
        expect(result.notes[0]).toBe('Design #54321 — Company Logo');
        expect(result.designNumbers[0]).toBe('Design #54321 — Company Logo');
    });
});
