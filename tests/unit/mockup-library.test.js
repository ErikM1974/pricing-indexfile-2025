/**
 * Unit tests for the Saved Mockups library pure helpers.
 * mockup-library.js guards its browser globals, so it require()s cleanly here.
 */
const L = require('../../pages/js/mockup-library.js');

describe('mockup-library: parseMeta', () => {
  test('parses valid Rep_Mockup_Meta JSON', () => {
    expect(L.parseMeta({ Rep_Mockup_Meta: '{"garmentName":"Navy","placement":"Full Front"}' }))
      .toEqual({ garmentName: 'Navy', placement: 'Full Front' });
  });
  test('returns {} on malformed JSON (never throws)', () => {
    expect(L.parseMeta({ Rep_Mockup_Meta: '{not valid json' })).toEqual({});
  });
  test('returns {} when missing', () => {
    expect(L.parseMeta({})).toEqual({});
    expect(L.parseMeta({ Rep_Mockup_Meta: '' })).toEqual({});
  });
});

describe('mockup-library: escapeHtml', () => {
  test('escapes all five HTML-significant chars', () => {
    expect(L.escapeHtml('<a href="x" title=\'y\'>&</a>'))
      .toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
  test('null/undefined-safe', () => {
    expect(L.escapeHtml(null)).toBe('');
    expect(L.escapeHtml(undefined)).toBe('');
  });
});

describe('mockup-library: filterRows', () => {
  const rows = [
    { CompanyName: 'Acme Co', ID_Design: '53001' },
    { CompanyName: 'Best Corp', ID_Design: '12345' }
  ];
  test('empty query returns all rows as a copy', () => {
    const r = L.filterRows(rows, '');
    expect(r).toHaveLength(2);
    expect(r).not.toBe(rows);
  });
  test('matches company name case-insensitively', () => {
    expect(L.filterRows(rows, 'ACME')).toHaveLength(1);
    expect(L.filterRows(rows, 'corp')[0].CompanyName).toBe('Best Corp');
  });
  test('matches design number substring', () => {
    expect(L.filterRows(rows, '5300')[0].CompanyName).toBe('Acme Co');
  });
  test('no match → empty array', () => {
    expect(L.filterRows(rows, 'zzzz')).toHaveLength(0);
  });
  test('null-safe inputs', () => {
    expect(L.filterRows(null, 'x')).toEqual([]);
    expect(L.filterRows(rows, null)).toHaveLength(2);
  });
});
