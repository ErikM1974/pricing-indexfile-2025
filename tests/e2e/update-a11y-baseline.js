/**
 * Regenerate tests/e2e/a11y-baseline.json (roadmap 1.9 — real-browser half).
 * Requires the app on :3400 (or E2E_BASE_URL). Run AFTER 1.8 fixes to ratchet
 * DOWN — never to absorb a regression.
 *   PORT=3400 node server.js   (separate shell)
 *   node tests/e2e/update-a11y-baseline.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3400';
const BUILDERS = [
    'embroidery-quote-builder.html',
    'screenprint-quote-builder.html',
    'dtf-quote-builder.html',
    'dtg-quote-builder.html',
];

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext(); // @axe-core/playwright requires a context-owned page
    const page = await context.newPage();
    const baseline = {};
    for (const file of BUILDERS) {
        await page.goto(`${BASE}/quote-builders/${file}`, { timeout: 60000 });
        await page.waitForLoadState('load');
        await page.waitForTimeout(3500);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const counts = {};
        for (const v of results.violations) {
            if (v.impact === 'serious' || v.impact === 'critical') counts[v.id] = v.nodes.length;
        }
        baseline[file] = counts;
        console.log(`${file}: ${Object.keys(counts).length} serious/critical rules, ${Object.values(counts).reduce((a, b) => a + b, 0)} nodes`);
    }
    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'a11y-baseline.json'), JSON.stringify(baseline, null, 2) + '\n');
    console.log('a11y-baseline.json written');
})().catch((err) => { console.error(err); process.exit(1); });
