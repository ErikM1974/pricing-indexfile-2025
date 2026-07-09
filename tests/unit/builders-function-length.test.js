/**
 * Builders function-length ratchet — A-grade rubric #3 enforcement, builders-wide
 * (Batch 3.2 EMB → Batch 4 adds SCP/DTF/shared; supersedes emb-function-length.test.js).
 *
 * The mega-functions are dead (EMB confirmShopWorksImport ~1,000 → 13 fns;
 * DTF class → 5 prototype mixins; etc.). Whatever remains >150 lines is FROZEN
 * below per directory and may only SHRINK:
 *   - a new/regrown >150 function (or object/class method) fails;
 *   - a frozen entry growing past its recorded length fails;
 *   - a frozen entry dropping to ≤150 fails until its entry is DELETED.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../shared_components/js/builders');

// dir → 'file:function' → frozen max lines (measured 2026-07-09). Shrink-only.
const ALLOWLISTS = {
  emb: {
    'adapter.js:setupPage': 295, // was invisible to the old top-level-only measure
    'output.js:diagnoseQuote': 290,
    'output.js:buildEmbroideryPricingData': 273,
    'persistence.js:restoreEmbroideryDraft': 211,
    'persistence.js:loadQuoteForEditing': 294,
    'product-rows.js:onStyleChange': 186,
    'product-rows.js:updateRowForSizeCategory': 171,
    'quote-lifecycle.js:resetQuote': 239,
    'shopworks-import.js:renderImportPreview': 264, // one cohesive HTML template
    'spr-modal.js:renderSprEmbConfigSection': 414, // deferred-closure machine — needs jsdom coverage before splitting
  },
  scp: {
    'adapter.js:setupPage': 158,
    'adapter.js:initPricingAndRoute': 204,
    'persistence.js:resetQuote': 168,
    'pricing-sync.js:_recalculatePricingImpl': 349,
    'product-rows.js:updateRowForSizeCategory': 171,
    'save-output.js:buildScreenprintPricingData': 204,
    'save-output.js:saveAndGetLink': 235,
  },
  dtf: {
    'product-rows.js:createChildRow': 163,
    'methods-lifecycle.js:init': 202,
    'methods-lifecycle.js:saveAndGetLink': 399,
    'methods-lifecycle.js:resetQuote': 176,
    'methods-output.js:buildPricingDataForInvoice': 171,
    'methods-pricing.js:updatePricing': 331,
  },
  dtg: {
    // measured 2026-07-09 at the Batch 5 decomposition (monolith → 10 modules)
    'form-core.js:render': 384,
    'form-core.js:previewCustomer': 164, // measurement artifact: LAST fn in file — span absorbs the trailing DTGInlineForm tail (real body ~28 lines)
    'output.js:submitToShopWorks': 267,
    'persistence.js:loadSavedDtgQuoteForEdit': 241,
  },
  shared: {},
};

function measureDir(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    const starts = [];
    lines.forEach((l, i) => {
      const top = l.match(/^(?:export )?(?:async )?function (\w+)/);
      if (top) {
        starts.push({ name: top[1], line: i });
        return;
      }
      const meth = l.match(/^    (?:async )?([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{\s*$/);
      if (meth && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(meth[1])) {
        starts.push({ name: meth[1], line: i });
      }
    });
    starts.forEach((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
      out[`${f}:${s.name}`] = end - s.line;
    });
  }
  return out;
}

describe.each(Object.keys(ALLOWLISTS))('builders/%s function-length ratchet', (dirName) => {
  const measured = measureDir(path.join(ROOT, dirName));
  const allow = ALLOWLISTS[dirName];

  test('no function >150 lines outside the frozen allowlist', () => {
    const offenders = Object.entries(measured)
      .filter(([key, len]) => len > 150 && !(key in allow))
      .map(([key, len]) => `${key} (${len})`);
    expect(offenders).toEqual([]);
  });

  const entries = Object.entries(allow);
  (entries.length ? test.each(entries) : test.skip.each([['none', 0]]))(
    'frozen: %s stays ≤ %i lines',
    (key, frozen) => {
      const len = measured[key];
      if (len === undefined) {
        throw new Error(`${key} no longer exists — delete its allowlist entry`);
      }
      expect(len).toBeLessThanOrEqual(frozen);
      if (len <= 150) {
        throw new Error(`${key} is now ${len} lines (≤150) — delete its allowlist entry to lock the win`);
      }
    }
  );
});
