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
        expect(QQ).toContain('state.product && state.product.isCap'); // print-placement field hidden for caps (renderPlacementVisibility, quick mode)
        expect(QQ).toMatch(/position:\s*'Cap Back'/);          // cap back = an additional logo → CB rate
    });

    test('per-piece is all-in minus one-time fees — same summarize() contract as the configurator', () => {
        // groupTotal − oneTimeFees, ÷ qty (LTM stays baked into per-piece; setup excluded)
        expect(QQ).toMatch(/groupTotal\s*-\s*oneTime/);
        expect(CFG).toMatch(/groupTotal\s*-\s*oneTime/);
    });

    test('cap embellishment (flat / 3D puff / laser patch) flows to the engine via the cap primary logo', () => {
        expect(QQ).toMatch(/CAP_EMB_OPTS\s*=/);
        expect(QQ).toContain("'3d-puff'");
        expect(QQ).toContain("'laser-patch'");
        expect(QQ).toMatch(/embellishmentType:\s*state\.capEmb/); // passed on the cap primary logo
    });

    test('next-tier nudge is enabled for the method cards (engine computes it)', () => {
        // priceMethod requests nudge:true; the matrix probe stays nudge:false
        expect(QQ).toMatch(/singleItemPreview\(buildItem\(def\)[\s\S]{0,120}nudge:\s*true/);
    });

    // 2026-09-16: 112FPR (Richardson, blank category) was refused cap embroidery by a local
    // regex + hard block, and DTG was never blocked because eligibility says 'no' as a string.
    test('cap/garment comes from the shared headwear classifier, loaded before the page', () => {
        const HTML = fs.readFileSync(path.join(ROOT, 'calculators', 'quick-quote', 'index.html'), 'utf8');
        expect(QQ).not.toMatch(/function isCapProduct/);
        expect(QQ).toContain('HeadwearClassifier.classify');
        expect(HTML.indexOf('/shared_components/js/headwear-classifier.js')).toBeGreaterThan(-1);
        expect(HTML.indexOf('/shared_components/js/headwear-classifier.js')).toBeLessThan(HTML.indexOf('/calculators/quick-quote/quick-quote.js'));
    });

    test('line-sheet rows route embroidery by product and read DTG eligibility as yes/warn/no', () => {
        expect(QQ).not.toContain("product.isCap !== (method === 'capemb')");
        expect(QQ).not.toContain('!eligibility[def.engineMethod]');
        expect(QQ).toMatch(/function methodAllowed\(elig, key\)[\s\S]{0,120}v === true \|\| v === 'yes' \|\| v === 'warn'/);
        expect(QQ).toMatch(/var token = row\._ptok, method = lineMethodFor\(row\), def = METHODS\[method\]/);
    });

    // Erik 2026-09-16: soft headwear (beanies, headbands, gaiters, face masks, skull and scrub caps)
    // is flat (garment) embroidery, as in the EMB builder (.claude/rules/quote-builders.md) — never
    // cap pricing, never the "Caps" category rule. The builders use the same shared classifier, so
    // Quick Quote takes its answer as returned: isCap picks cap pricing and nothing re-checks it.
    test('flat headwear is priced as garment embroidery in both modes', () => {
        expect(QQ).toContain('var cap = headwear.isCap;');
        expect(QQ).not.toContain('headwear.isCap || headwear.isFlat');
        // Embroidery rows use isCap as returned, even when the classifier is not confident (the row says so).
        expect(QQ).toMatch(/function lineMethodFor\(row\) \{\s+var m = state\.lineMethod, h = row\.product && row\.product\.headwear;\s+if \(\(m !== 'emb' && m !== 'capemb'\) \|\| !h\) return m;\s+return h\.isCap \? 'capemb' : 'emb';\s+\}/);
        expect(QQ).not.toContain('!h.confident');
        expect(QQ).not.toContain('Not confirmed as a cap');
        expect(QQ).toContain("if (embroidery && !headwear.confident) notices.push('Not confirmed from the catalog — check the product.');");
        expect(QQ).not.toMatch(/function lineMethodFor[\s\S]{0,200}isFlat/);
        expect(QQ).toContain('var headwear = classifyHeadwear(meta);');
        // A missing classifier is a visible lookup error, never the old keyword rules (Rule 4).
        expect(QQ).toMatch(/function classifyHeadwear\(meta\) \{\s+if \(!window\.HeadwearClassifier\) throw lookupError\('[^']+', false\);\s+return window\.HeadwearClassifier\.classify\(meta\);\s+\}/);
        // One rule: no second opinion from the builder's old keyword filter.
        expect(QQ).not.toContain('matchBuilderFlat');
        expect(QQ).not.toContain('ProductCategoryFilter');
        const HTML = fs.readFileSync(path.join(ROOT, 'calculators', 'quick-quote', 'index.html'), 'utf8');
        expect(HTML).not.toContain('/shared_components/js/product-category-filter.js');
        expect(HTML).toMatch(/<script src="\/shared_components\/js\/headwear-classifier\.js\?v=[\d.]+"><\/script>/); // /deploy moves the version
    });

    // Live rules (2026-09-16): "Caps" allows no garment method, but Personal Protection allows EMB,
    // SCP and DTF, and Accessories/Workwear allow EMB. Only flat headwear in "Caps" is embroidery
    // only; a gaiter or headband keeps its own category's methods (Erik: no new print blocks).
    test('only flat headwear in "Caps" is embroidery only; other flat items follow their category', () => {
        expect(QQ).toMatch(/function inCapsCategory\(product\) \{\s+return !!product && \[product\.category, product\.subcategory\]\.some\(function \(c\) \{ return \/\^\\s\*caps\\s\*\$\/i\.test\(c \|\| ''\); \}\);\s+\}/);
        expect(QQ).toContain('function flatEmbroideryOnly(product) { return isFlatHeadwear(product) && inCapsCategory(product); }');
        expect(QQ).toContain("if (flatEmbroideryOnly(product)) return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'flat-headwear' });");
        expect(QQ).not.toContain('if (isFlatHeadwear(product)) return Promise.resolve(');
        expect(QQ).toMatch(/if \(product\.isCap\) return Promise\.resolve\(null\);[^\n]*\n[^\n]*\n\s+if \(flatEmbroideryOnly\(product\)\)[^\n]*\n\s+return categoryEligibility\(product\);/);
        // Line sheet: print blocks and the skipped category check cover caps and "Caps" flat items only.
        expect(QQ).toContain('flat = isFlatHeadwear(product), flatOnly = flatEmbroideryOnly(product);');
        expect(QQ).toContain('if ((product.isCap || flatOnly) && headwear.confident && !embroidery) throw');
        expect(QQ).toContain('!(embroidery && (product.isCap || flatOnly))');
        expect(QQ).not.toContain('(product.isCap || flat)');
        // Quick Price: a one-size product keeps print placements when a print method is offered.
        expect(QQ).toMatch(/function renderPlacementVisibility\(\) \{[\s\S]{0,400}pf\.hidden = state\.mode === 'linesheet' \? !printing : oneSize\(state\.product\) && !printing;/);
    });

    test('flat headwear notes cover all soft headwear, not just beanies', () => {
        expect(QQ).toContain('Beanies, headbands and other soft headwear are priced as flat embroidery, the same as the Embroidery builder.');
        expect(QQ).toContain("' — soft headwear is flat embroidery, as in the Embroidery builder.'");
        expect(QQ).not.toMatch(/beanies are flat embroidery|Beanies and knit caps are priced/);
    });
});
