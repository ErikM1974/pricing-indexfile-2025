/**
 * Real-browser axe pass (roadmap 1.9, Playwright half) — includes the rules
 * jsdom can't judge (color-contrast needs actual rendering).
 *
 * Same RATCHET pattern as tests/a11y (jsdom): serious/critical violations are
 * compared per-rule against tests/e2e/a11y-baseline.json — counts only drop,
 * new rules fail. Regenerate AFTER 1.8 fixes with:
 *   node tests/e2e/update-a11y-baseline.js   (server on :3400 required)
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const BUILDERS = [
    'embroidery-quote-builder.html',
    'screenprint-quote-builder.html',
    'dtf-quote-builder.html',
    'dtg-quote-builder.html',
];

const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'a11y-baseline.json'), 'utf8'));

/** serious+critical only — the CI-blocking severities (roadmap 1.9). */
function seriousCounts(results) {
    const counts = {};
    for (const v of results.violations) {
        if (v.impact === 'serious' || v.impact === 'critical') counts[v.id] = v.nodes.length;
    }
    return counts;
}

for (const file of BUILDERS) {
    test(`${file}: no NEW serious/critical axe violations (rendered, contrast ON)`, async ({ page }) => {
        await page.goto(`/quote-builders/${file}`);
        await page.waitForLoadState('load');
        await page.waitForTimeout(3500); // fonts/skins settle — contrast needs final paint

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();

        const counts = seriousCounts(results);
        const allowed = baseline[file] || {};
        const regressions = [];
        for (const [rule, count] of Object.entries(counts)) {
            if (count > (allowed[rule] || 0)) {
                regressions.push(`${rule}: ${count} nodes (baseline ${allowed[rule] || 0})`);
            }
        }
        expect(regressions, `NEW serious/critical a11y violations in ${file}:\n  ${regressions.join('\n  ')}`).toEqual([]);
    });
}
