/**
 * Builder a11y RATCHET (roadmap 1.9) — axe violations can only DROP.
 *
 * 1.8 (the actual accessibility fixes) hasn't landed yet, so these pages
 * have known violations. The gate is the BASELINE: tests/a11y/baseline.json
 * records today's per-rule node counts; this suite fails if any rule's count
 * GROWS or a NEW rule appears. As 1.8 work lands, regenerate the baseline
 * with `node tests/a11y/update-baseline.js` — counts ratchet downward until
 * the file is all zeros and this becomes a true zero-violations gate.
 */

const fs = require('fs');
const path = require('path');
const { BUILDERS, axe, loadBuilderDom, violationCounts } = require('./axe-common');

jest.setTimeout(120000); // axe over a full builder DOM in jsdom is slow

const baselinePath = path.join(__dirname, 'baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

describe.each(BUILDERS)('%s', (file) => {
    test('axe violations do not exceed the checked-in baseline', async () => {
        const body = loadBuilderDom(file);
        const results = await axe(body);
        const counts = violationCounts(results);
        const allowed = baseline[file] || {};

        const regressions = [];
        for (const [rule, count] of Object.entries(counts)) {
            const cap = allowed[rule] || 0;
            if (count > cap) {
                regressions.push(`${rule}: ${count} nodes (baseline ${cap})`);
            }
        }
        if (regressions.length) {
            throw new Error(
                `NEW a11y violations in ${file} (fix them or, if intentional, discuss before touching the baseline):\n  ` +
                regressions.join('\n  ')
            );
        }
    });
});
