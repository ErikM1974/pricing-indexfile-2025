/**
 * Shared axe harness for the builder a11y gates (roadmap 1.9).
 *
 * Loads a builder HTML into jsdom (scripts inert — jest's jsdom never
 * executes or fetches them) and runs axe-core against the static DOM.
 * color-contrast is disabled here: jsdom doesn't really render, so contrast
 * results are garbage in this environment — the REAL contrast check runs in
 * the Playwright axe pass (tests/e2e). Everything structural (button-name,
 * label, aria-*, region, heading-order, …) is meaningful statically.
 */

const fs = require('fs');
const path = require('path');
const { configureAxe } = require('jest-axe');

const ROOT = path.join(__dirname, '../..');

const BUILDERS = [
    'embroidery-quote-builder.html',
    'screenprint-quote-builder.html',
    'dtf-quote-builder.html',
    'dtg-quote-builder.html',
];

const axe = configureAxe({
    rules: {
        'color-contrast': { enabled: false }, // jsdom can't render — Playwright pass owns this
    },
});

function loadBuilderDom(file) {
    const html = fs.readFileSync(path.join(ROOT, 'quote-builders', file), 'utf8');
    document.open();
    document.write(html);
    document.close();
    return document.body;
}

/** Collapse an axe result into {ruleId: nodeCount} for baseline comparison. */
function violationCounts(results) {
    const counts = {};
    for (const v of results.violations) counts[v.id] = v.nodes.length;
    return counts;
}

module.exports = { BUILDERS, axe, loadBuilderDom, violationCounts, ROOT };
