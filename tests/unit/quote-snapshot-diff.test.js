/**
 * quote-snapshot-diff.test.js — locks the ShopWorks-snapshot diff that powers the
 * "edited in ShopWorks" banner on the quote-view / Quote Management screen.
 *
 * WHY THIS EXISTS (Erik 2026-06-26): a rep edited sizing in ShopWorks (removed an S,
 * added an M → M=2,L=1,XL=1) on WO #142292, but the change kept the line's TOTAL
 * quantity (4) and unit price ($31.75) identical. The old diff only compared
 * LineUnitPrice + LineQuantity, so a per-size redistribution slipped past entirely —
 * the banner never flagged it. `diffSnapshots` now also compares the positional
 * Size01..Size06 columns. This test pins that behavior so it can't regress.
 *
 * MO /lineitems Size0N mapping is positional & 1:1:
 *   Size01=S Size02=M Size03=L Size04=XL Size05=2XL Size06=catch-all(3XL+/OSFA/…)
 */

const { diffSnapshots, sizeColsOf } = require('../../lib/quote-snapshot-diff');

// Build a snapshot with one PC54Y White line at the given Size0N quantities.
const snap = (sizes, extra = {}) => ({
  order: { sts_Purchased: 0, ...extra.order },
  lineItems: [{
    PartNumber: 'PC54Y', PartColor: 'White',
    LineUnitPrice: 31.75,
    LineQuantity: sizes.reduce((a, b) => a + b, 0),
    Size01: sizes[0], Size02: sizes[1], Size03: sizes[2],
    Size04: sizes[3], Size05: sizes[4], Size06: sizes[5],
  }],
});

describe('diffSnapshots — per-size redistribution (the WO #142292 bug)', () => {
  test('detects S→M swap that leaves total qty + unit price unchanged', () => {
    const oldSnap = snap([1, 1, 1, 1, 0, 0]); // S=1 M=1 L=1 XL=1
    const newSnap = snap([0, 2, 1, 1, 0, 0]); // M=2 L=1 XL=1  (still qty 4, still $31.75)

    const changes = diffSnapshots(oldSnap, newSnap);
    const sizeChange = changes.find(c => c.field === 'LineSizes[PC54Y|White]');

    expect(sizeChange).toBeDefined();
    expect(sizeChange.type).toBe('line_item');
    expect(sizeChange.severity).toBe('warning');
    expect(sizeChange.oldValue).toBe('S:1 M:1 L:1 XL:1');
    expect(sizeChange.newValue).toBe('M:2 L:1 XL:1');

    // And it must NOT spuriously report a qty or unit-price change (both constant).
    expect(changes.find(c => c.field.startsWith('LineQuantity['))).toBeUndefined();
    expect(changes.find(c => c.field.startsWith('LineUnitPrice['))).toBeUndefined();
  });

  test('no size-change row when the per-size distribution is identical', () => {
    const changes = diffSnapshots(snap([1, 1, 1, 1, 0, 0]), snap([1, 1, 1, 1, 0, 0]));
    expect(changes.find(c => c.field.startsWith('LineSizes['))).toBeUndefined();
  });

  test('still reports a real total-qty change alongside the size shift', () => {
    const oldSnap = snap([1, 1, 1, 1, 0, 0]); // qty 4
    const newSnap = snap([0, 3, 1, 1, 0, 0]); // qty 5 — M up by 2, total changed
    const changes = diffSnapshots(oldSnap, newSnap);
    expect(changes.find(c => c.field === 'LineQuantity[PC54Y|White]')).toBeDefined();
    expect(changes.find(c => c.field === 'LineSizes[PC54Y|White]')).toBeDefined();
  });

  test('extended-size shift into the 3XL+ catch-all (Size06) is caught', () => {
    const oldSnap = snap([1, 1, 1, 1, 0, 0]);
    const newSnap = snap([1, 1, 1, 0, 0, 1]); // XL→3XL+ (Size04→Size06)
    const sizeChange = diffSnapshots(oldSnap, newSnap).find(c => c.field === 'LineSizes[PC54Y|White]');
    expect(sizeChange).toBeDefined();
    expect(sizeChange.newValue).toBe('S:1 M:1 L:1 3XL+:1');
  });
});

describe('sizeColsOf — positional helper', () => {
  test('formats only non-zero columns and a stable equality key', () => {
    const r = sizeColsOf({ Size01: 0, Size02: 2, Size03: 1, Size04: 1, Size05: 0, Size06: 0 });
    expect(r.key).toBe('0,2,1,1,0,0');
    expect(r.label).toBe('M:2 L:1 XL:1');
  });

  test('missing / null Size0N coerce to 0 (no NaN), empty line → (none)', () => {
    expect(sizeColsOf({}).key).toBe('0,0,0,0,0,0');
    expect(sizeColsOf({}).label).toBe('(none)');
    expect(sizeColsOf({ Size02: null, Size03: '2' }).key).toBe('0,0,2,0,0,0');
  });
});
