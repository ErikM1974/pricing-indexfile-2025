/**
 * Regenerate tests/a11y/baseline.json (roadmap 1.9).
 *
 * Run AFTER landing a11y fixes (1.8 work) to ratchet the baseline DOWN:
 *   npx jest tests/a11y --testPathIgnorePatterns=nothing  # confirm current state first
 *   node tests/a11y/update-baseline.js
 *
 * Never run it to absorb a regression — the whole point is that counts only
 * shrink. Runs jest's jsdom environment standalone via jsdom directly.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axeCore = require('axe-core');

const ROOT = path.join(__dirname, '../..');
const BUILDERS = [
    'embroidery-quote-builder.html',
    'screenprint-quote-builder.html',
    'dtf-quote-builder.html',
    'dtg-quote-builder.html',
];

(async () => {
    const baseline = {};
    for (const file of BUILDERS) {
        const html = fs.readFileSync(path.join(ROOT, 'quote-builders', file), 'utf8');
        const dom = new JSDOM(html, { pretendToBeVisual: true, runScripts: 'outside-only' });
        const { window } = dom;
        // axe needs to run inside the page's window
        window.eval(axeCore.source);
        const results = await window.axe.run(window.document.body, {
            rules: { 'color-contrast': { enabled: false } },
        });
        const counts = {};
        for (const v of results.violations) counts[v.id] = v.nodes.length;
        baseline[file] = counts;
        console.log(`${file}: ${results.violations.length} rules, ${Object.values(counts).reduce((a, b) => a + b, 0)} nodes`);
        window.close();
    }
    fs.writeFileSync(path.join(__dirname, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n');
    console.log('baseline.json written');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
