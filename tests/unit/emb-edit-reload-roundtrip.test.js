/**
 * Edit-reload regression guards — the three confirmed audit bugs (2026-06-06):
 *   P0  pickup-quote reload silently overwrites the saved tax rate (Erik's #1-rule violation)
 *   P1  legacy additional-logo quotes double-charge the AL on reload
 *   P1  OSFA-only caps/beanies drop their quantity on reload
 *
 * embroidery-quote-builder.js is a global-scope <script> (no module exports + top-level DOM init), so
 * it can't be required directly. Each fix is locked TWO ways: (1) a behavioral test of the exact
 * decision logic the fix added, on real fixtures; (2) a source-guard asserting that logic is still
 * present in the builder. If a future edit removes a guard OR changes the decision, these fail loudly.
 * (A full jsdom DOM round-trip is a worthwhile follow-up; these lock the regressions today.)
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(
  path.join(__dirname, '../../shared_components/js/embroidery-quote-builder.js'), 'utf8');

describe('P0 — pickup quote reload must NOT overwrite the saved tax rate', () => {
  // Fix: lookupTaxRate() early-returns while window._restoringQuote is set, so a pickup quote's async
  // Milton DOR lookup (fired by onShipMethodChange during restore) can't resolve later and clobber the
  // frozen rate restored from the saved TAX line.
  test('guard logic: a restore-time lookup does not write the rate; a normal one does', () => {
    const lookupWritesRate = (restoring) => {
      if (restoring) return false;   // mirrors `if (window._restoringQuote) return false;`
      return true;                   // normal path reaches the #tax-rate-input write
    };
    expect(lookupWritesRate(true)).toBe(false);   // reopening a pickup quote → saved rate stands
    expect(lookupWritesRate(false)).toBe(true);   // rep changes ZIP later → live lookup works
  });

  test('source: lookupTaxRate no-ops when _restoringQuote is set', () => {
    expect(SRC).toMatch(
      /async function lookupTaxRate\(\)\s*\{[\s\S]{0,500}?if\s*\(\s*window\._restoringQuote\s*\)\s*return\s+false/);
  });

  test('source: loadQuoteForEditing arms the flag and clears it in a finally', () => {
    expect(SRC).toMatch(/window\._restoringQuote\s*=\s*true/);
    expect(SRC).toMatch(/finally\s*\{[\s\S]{0,160}?window\._restoringQuote\s*=\s*false/);
  });
});

describe('P1 — legacy additional-logo quotes must not double-charge on reload', () => {
  // Fix: only enable the legacy globalAL path from session.AdditionalLogoLocation when there is NO AL
  // line item to restore. The current flow saves BOTH the field and an `embroidery-additional` row; if
  // globalAL is also enabled, the engine bills the AL twice (globalAL → additionalServicesTotal AND the
  // restored row). Exact predicate copied from the builder.
  const hasALRow = (items) => items.some(
    (i) => i.EmbellishmentType === 'embroidery-additional' ||
           ['AL', 'AL-CAP', 'DECG-FB'].includes((i.StyleNumber || '').toUpperCase()));
  const enablesGlobalAL = (session, items) => !!session.AdditionalLogoLocation && !hasALRow(items);

  test('current-flow quote (AL row present) does NOT re-enable globalAL → billed once', () => {
    const session = { AdditionalLogoLocation: 'Left Sleeve' };
    const items = [
      { EmbellishmentType: 'embroidery', StyleNumber: 'PC61' },
      { EmbellishmentType: 'embroidery-additional', StyleNumber: 'AL' },
    ];
    expect(enablesGlobalAL(session, items)).toBe(false);
  });

  test('AL-CAP / DECG-FB rows also suppress the legacy path', () => {
    const session = { AdditionalLogoLocation: 'Cap Back' };
    expect(enablesGlobalAL(session, [{ EmbellishmentType: 'fee', StyleNumber: 'AL-CAP' }])).toBe(false);
    expect(enablesGlobalAL(session, [{ EmbellishmentType: 'fee', StyleNumber: 'DECG-FB' }])).toBe(false);
  });

  test('truly-legacy quote (field set, no AL row) DOES enable globalAL → logo restored', () => {
    const session = { AdditionalLogoLocation: 'Left Sleeve' };
    const items = [{ EmbellishmentType: 'embroidery', StyleNumber: 'J790' }];
    expect(enablesGlobalAL(session, items)).toBe(true);
  });

  test('no field set → never enables (nothing to restore)', () => {
    expect(enablesGlobalAL({}, [{ EmbellishmentType: 'embroidery-additional', StyleNumber: 'AL' }])).toBe(false);
  });

  test('source: populateLogoConfig gates globalAL on !hasALRow', () => {
    expect(SRC).toMatch(/AdditionalLogoLocation\s*&&\s*!hasALRow/);
  });
});

describe('P1 — OSFA-only caps/beanies must keep their quantity on reload', () => {
  // Fix: an OSFA-only product's qty lives on the parent (dataset.osfaQty + .osfa-qty-input), not a child
  // row. OSFA is in SIZE06_EXTENDED_SIZES, so without the special-case it routes to createChildRow and
  // the trailing onSizeChange prunes it → silent cap-qty loss. Predicate copied from the builder.
  const routesToParentOSFA = (size, sizeCategory) =>
    size.toUpperCase() === 'OSFA' && sizeCategory === 'osfa-only';

  test('OSFA-only cap → parent OSFA path (qty preserved)', () => {
    expect(routesToParentOSFA('OSFA', 'osfa-only')).toBe(true);
    expect(routesToParentOSFA('osfa', 'osfa-only')).toBe(true); // case-insensitive
  });

  test('a real extended size still routes to a child row', () => {
    expect(routesToParentOSFA('3XL', 'standard')).toBe(false);
    expect(routesToParentOSFA('2XL', 'standard')).toBe(false);
  });

  test('OSFA on a multi-size product (not osfa-only) is left to the generic branch', () => {
    expect(routesToParentOSFA('OSFA', 'standard')).toBe(false);
  });

  test('source: addProductFromQuote special-cases OSFA-only before the generic extended branch', () => {
    const osfaIdx = SRC.search(/size\.toUpperCase\(\)\s*===\s*'OSFA'\s*&&\s*row\.dataset\.sizeCategory\s*===\s*'osfa-only'/);
    const twoXlIdx = SRC.search(/if\s*\(size === '2XL' \|\| size === 'XXL'\)/);
    expect(osfaIdx).toBeGreaterThan(-1);
    expect(twoXlIdx).toBeGreaterThan(-1);
    expect(osfaIdx).toBeLessThan(twoXlIdx); // OSFA check comes first
  });
});
