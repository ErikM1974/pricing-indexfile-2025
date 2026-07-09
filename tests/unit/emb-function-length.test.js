/**
 * EMB function-length ratchet — A-grade rubric #3 enforcement (Batch 3.2).
 *
 * Batch 3 killed the five mega-functions (confirmShopWorksImport ~1,000,
 * _saveAndGetLinkInner ~453, _recalculatePricingImpl ~354,
 * updatePricingDisplay ~353, importProductRow ~313 — plus
 * showServicePricingReview ~622 → 3 sections). What remains >150 lines is
 * FROZEN below and may only SHRINK:
 *   - a new/regrown >150 function fails (write smaller functions);
 *   - a frozen function growing past its recorded length fails;
 *   - a frozen function dropping to ≤150 fails until its entry is DELETED
 *     (keeps the list honest — it can never quietly become decoration).
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../shared_components/js/builders/emb');

// name → frozen max lines (measured 2026-07-09). Shrink-only.
const ALLOWLIST = {
  'output.js:diagnoseQuote': 290,
  'output.js:buildEmbroideryPricingData': 273,
  'persistence.js:restoreEmbroideryDraft': 211,
  'persistence.js:loadQuoteForEditing': 294,
  'product-rows.js:onStyleChange': 186,
  'product-rows.js:updateRowForSizeCategory': 171,
  'product-rows.js:createChildRow': 151,
  'quote-lifecycle.js:resetQuote': 239,
  'shopworks-import.js:renderImportPreview': 264, // one cohesive HTML template
  'spr-modal.js:renderSprEmbConfigSection': 414, // deferred-closure machine — needs jsdom coverage before splitting
};

function measure() {
  const out = {};
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const fns = [...src.matchAll(/(?:^|\n)(?:export )?(?:async )?function (\w+)/g)].map((m) => ({ name: m[1], idx: m.index }));
    fns.forEach((fn, i) => {
      const end = i + 1 < fns.length ? fns[i + 1].idx : src.length;
      const len = src.slice(fn.idx, end).split('\n').length;
      out[`${f}:${fn.name}`] = len;
    });
  }
  return out;
}

describe('EMB function-length ratchet (≤150 or frozen-shrinking allowlist)', () => {
  const measured = measure();

  test('no function >150 lines outside the frozen allowlist', () => {
    const offenders = Object.entries(measured)
      .filter(([key, len]) => len > 150 && !(key in ALLOWLIST))
      .map(([key, len]) => `${key} (${len})`);
    expect(offenders).toEqual([]);
  });

  test.each(Object.entries(ALLOWLIST))('frozen: %s stays ≤ %i lines', (key, frozen) => {
    const len = measured[key];
    if (len === undefined) {
      throw new Error(`${key} no longer exists — delete its allowlist entry`);
    }
    expect(len).toBeLessThanOrEqual(frozen);
    if (len <= 150) {
      throw new Error(`${key} is now ${len} lines (≤150) — delete its allowlist entry to lock the win`);
    }
  });
});
