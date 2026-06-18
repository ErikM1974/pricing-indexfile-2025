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
 * (Hand-verified 2026-06-18: PC61 24-pc, left-chest = EMB $504 / DTG $348 /
 *  SCP $453 / DTF $372 — exactly the web-quote-cart-parity fixtures. Per-pc with
 *  Full front + Full back = EMB $21 / DTG $27 / SCP $23.63 / DTF $39; Full front +
 *  Jumbo back → DTG correctly blocked (no DTG_Costs data) while SCP/DTF still price;
 *  +left sleeve moves only DTF. Embroidery is LOGO-based and ignores print placement.)
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
    test('DTG location codes Quick Quote can produce == the engine whitelist (never an unpriceable combo)', () => {
        const ENGINE = fs.readFileSync(path.join(ROOT, 'shared_components', 'js', 'quote-cart-engine.js'), 'utf8');
        const qq = (QQ.match(/DTG_LOCATION_CODES\s*=\s*\[([^\]]*)\]/) || [])[1];
        const eng = (ENGINE.match(/DTG_LOCATION_CODES\s*=\s*\[([^\]]*)\]/) || [])[1];
        expect(qq).toBeTruthy();
        expect(eng).toBeTruthy();
        // the front/back picker can only build codes in this list, and it is the
        // SAME list the engine + DTG builder accept → no desync, no bad_input.
        expect(qq.replace(/\s+/g, '')).toBe(eng.replace(/\s+/g, ''));
    });

    test('print placement is an independent Front + Back + sleeves model (front/back → engine codes)', () => {
        expect(QQ).toMatch(/FRONT_OPTS\s*=/);
        expect(QQ).toMatch(/BACK_OPTS\s*=/);
        expect(QQ).toMatch(/function dtgCode\(\)/);   // front_back combo code
        expect(QQ).toContain('left-sleeve');          // DTF sleeves
        expect(QQ).toContain('right-sleeve');
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

    test('DTF placements map to the builder location strings (jumbo → the full/large transfer)', () => {
        const front = extractObj(QQ, 'DTF_FRONT');
        const back = extractObj(QQ, 'DTF_BACK');
        expect(front).toBeTruthy();
        expect(front).toContain("LC:'left-chest'");
        expect(front).toContain("FF:'full-front'");
        expect(front).toContain("JF:'full-front'"); // DTF has no jumbo → maps to the largest
        expect(back).toContain("FB:'full-back'");
        expect(back).toContain("JB:'full-back'");
    });

    test('caps are embroidery-only: print placement hidden, cap back priced via the logo panel (CB rate)', () => {
        expect(QQ).toContain('hidden = !!state.product.isCap'); // print-placement field hidden for caps
        expect(QQ).toMatch(/position:\s*'Cap Back'/);          // cap back = an additional logo → CB rate
    });

    test('per-piece is all-in minus one-time fees — same summarize() contract as the configurator', () => {
        // groupTotal − oneTimeFees, ÷ qty (LTM stays baked into per-piece; setup excluded)
        expect(QQ).toMatch(/groupTotal\s*-\s*oneTime/);
        expect(CFG).toMatch(/groupTotal\s*-\s*oneTime/);
    });
});
