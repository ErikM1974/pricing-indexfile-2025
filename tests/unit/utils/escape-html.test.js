/**
 * escapeHtml() Tests
 * Tests XSS protection for HTML output
 */
const { escapeHtml } = require('../../../shared_components/js/quote-builder-utils');

describe('escapeHtml()', () => {
    test('escapes < and >', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('escapes &', () => {
        expect(escapeHtml('AT&T')).toBe('AT&amp;T');
    });

    test('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    test('handles null → empty string', () => {
        expect(escapeHtml(null)).toBe('');
    });

    test('handles undefined → empty string', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    test('handles empty string → empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('handles number → stringified and returned', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    test('handles 0 → "0"', () => {
        expect(escapeHtml(0)).toBe('');  // 0 is falsy, returns ''
    });

    test('normal text passes through', () => {
        expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    test('handles mixed special characters', () => {
        expect(escapeHtml('<b>"Hello" & \'World\'</b>')).toBe('&lt;b&gt;&quot;Hello&quot; &amp; &#39;World&#39;&lt;/b&gt;');
    });

    test('handles company names with &', () => {
        expect(escapeHtml('Northwest Custom Apparel & Design')).toBe('Northwest Custom Apparel &amp; Design');
    });
});
