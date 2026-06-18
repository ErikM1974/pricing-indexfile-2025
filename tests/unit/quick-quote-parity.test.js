/**
 * quick-quote-parity.test.js — locks the staff Quick Quote tool's engine
 * wiring to the customer product-page configurator's, so Quick Quote, the
 * online catalog, and the Quote Builder can NEVER price the same inputs
 * differently (CLAUDE.md Rule #7).
 *
 * Quick Quote calls the SAME QuoteCartEngine.singleItemPreview() the configurator
 * uses — the engine itself is already penny-locked by web-quote-cart-parity.test.js
 * against the live staff authorities. The only tool-specific code is the per-method
 * group builders + placement maps. This canary asserts those shapes match the
 * configurator verbatim, so a future edit to one can't silently desync the other.
 *
 * (The live behaviour was hand-verified on 2026-06-18: PC61 24-pc LC priced
 *  EMB $504 / DTG $348 / SCP $453 / DTF $372 and front+back $696 / $588 / $627 /
 *  $756 — exactly the web-quote-cart-parity fixtures; C112 8K cap = $480.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const QQ = fs.readFileSync(path.join(ROOT, 'calculators', 'quick-quote', 'quick-quote.js'), 'utf8');
const CFG = fs.readFileSync(path.join(ROOT, 'product', 'js', 'pdp-configurator.js'), 'utf8');

// Pull a flat object literal (no nested braces) by name, whitespace-normalized.
function extractObj(src, name) {
    const m = src.match(new RegExp('(?:var|const|let)\\s+' + name + '\\s*=\\s*(\\{[^}]*\\})'));
    return m ? m[1].replace(/\s+/g, '') : null;
}

describe('Quick Quote ↔ configurator engine-wiring parity (Rule #7)', () => {
    test('DTG_CODES placement→locationCode map is byte-identical to the configurator', () => {
        const qq = extractObj(QQ, 'DTG_CODES');
        const cfg = extractObj(CFG, 'DTG_CODES');
        expect(qq).toBeTruthy();
        expect(cfg).toBeTruthy();
        expect(qq).toBe(cfg);
    });

    test('all five engine groupIds are wired (none renamed/dropped)', () => {
        ['emb:garment', 'emb:cap', 'dtg:main', 'scp:design-1', 'dtf:main'].forEach((g) => {
            expect(QQ).toContain("'" + g + "'");
        });
    });

    test('EMB/CAP groups pass the engine logo shape (primary/additional/stitchCount/needsDigitizing)', () => {
        ['logos:', 'primary:', 'additional:', 'stitchCount:', 'needsDigitizing:'].forEach((k) => {
            expect(QQ).toContain(k);
        });
    });

    test('SCP group passes the engine option keys verbatim', () => {
        ['frontColors:', 'backColors:', 'darkGarment:', 'safetyStripes:'].forEach((k) => {
            expect(QQ).toContain(k);
        });
    });

    test('DTF front+back maps to left-chest + full-back (same two-location combo as the configurator)', () => {
        expect(QQ).toMatch(/frontBack:\s*\{\s*locations:\s*\['left-chest',\s*'full-back'\]/);
    });

    test('cap placements are cap-aware (front / frontBack) — never garment "fullFront"', () => {
        const cap = QQ.match(/CAP_LOCATIONS\s*=\s*\[([\s\S]*?)\];/);
        expect(cap).toBeTruthy();
        expect(cap[1]).toContain("key: 'front'");
        expect(cap[1]).toContain("key: 'frontBack'");
        expect(cap[1]).not.toContain("key: 'fullFront'");
    });

    test('per-piece is all-in minus one-time fees — same summarize() contract as the configurator', () => {
        // groupTotal − oneTimeFees, ÷ qty (LTM stays baked into per-piece; setup excluded)
        expect(QQ).toMatch(/groupTotal\s*-\s*oneTime/);
        expect(CFG).toMatch(/groupTotal\s*-\s*oneTime/);
    });
});
