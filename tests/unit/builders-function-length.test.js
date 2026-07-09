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

// dir → 'file:function' → frozen max lines (REAL-END measure, recalibrated 2026-07-09). Shrink-only.
const ALLOWLISTS = {
  emb: {
    'adapter.js:setupPage': 293, // was invisible to the old top-level-only measure
    'output.js:diagnoseQuote': 279,
    'output.js:buildEmbroideryPricingData': 268,
    'persistence.js:restoreEmbroideryDraft': 209,
    'persistence.js:loadQuoteForEditing': 285,
    'product-rows.js:onStyleChange': 179,
    'product-rows.js:updateRowForSizeCategory': 165,
    'quote-lifecycle.js:resetQuote': 234,
    'shopworks-import.js:renderImportPreview': 260, // one cohesive HTML template
    'spr-modal.js:renderSprEmbConfigSection': 412, // deferred-closure machine — needs jsdom coverage before splitting
  },
  scp: {
    'adapter.js:setupPage': 156,
    'adapter.js:initPricingAndRoute': 165,
    'persistence.js:resetQuote': 167,
    'pricing-sync.js:_recalculatePricingImpl': 347,
    'product-rows.js:updateRowForSizeCategory': 166,
    'save-output.js:buildScreenprintPricingData': 203,
    'save-output.js:saveAndGetLink': 232,
  },
  dtf: {},
  dtg: {
    // measured 2026-07-09 at the Batch 5 decomposition (monolith → 10 modules)
    'form-core.js:render': 383, // one cohesive HTML template (rubric's justified case, like emb renderImportPreview)
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
        starts.push({ name: top[1], line: i, method: false });
        return;
      }
      const meth = l.match(/^    (?:async )?([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{\s*$/);
      if (meth && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(meth[1])) {
        starts.push({ name: meth[1], line: i, method: true });
      }
    });
    starts.forEach((s, i) => {
      // Real end: the function's OWN closing brace (col 0 top-level, col 4
      // method), capped by the next start. The old next-start-only measure
      // padded the LAST function in a file with whatever trailed it (the
      // dtg previewCustomer "164-line" artifact — real body ~28 lines).
      const closeRe = s.method ? /^    \}[,;]?\s*$/ : /^\}\s*$/;
      let end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
      for (let j = s.line + 1; j < end; j++) {
        if (closeRe.test(lines[j])) {
          end = j + 1;
          break;
        }
      }
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
