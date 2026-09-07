#!/usr/bin/env node
/**
 * lint-css.js — stylelint over the standardized stylesheets (CSS standardization Step 3, 2026-09-07).
 *
 * CSS_LINT_SCOPE is the ratchet: a family's stylesheets are added when the family migrates to
 * shared_components/css/tokens.css (memory/CSS_STANDARDIZATION_PLAN_2026-09.md § 4) and are never
 * removed. The rules live in stylelint.config.mjs. Run `npm run lint:css`; tests/unit/css-lint.test.js
 * runs this same script under jest so `npm test` and the deploy gate fail on a CSS lint error.
 *
 * Exit 0 = every file in scope is clean; exit 1 = findings (printed) or a stylelint error.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Repo-relative globs. Widen only — never remove a file to make the lint pass. */
const CSS_LINT_SCOPE = [
    // Step 1 (2026-09-07): the two token files
    'shared_components/css/tokens.css',
    'shared_components/css/staff-dashboard/tokens.css',
    // Forms family (2026-09-07): the shared form framework + 17 per-form sheets
    'pages/forms/*.css',
    // Brand Standards page (2026-09-07): the first page built from templates/page-template.html
    'dashboards/css/brand-standards.css',
    // Training family (2026-09-07): the shared chrome + 26 page sheets (page themes in one :root block each)
    'training/css/*.css',
    'training/*.css',
];

async function run() {
    const { default: stylelint } = await import('stylelint');
    const result = await stylelint.lint({
        files: CSS_LINT_SCOPE,
        cwd: ROOT,
        configFile: path.join(ROOT, 'stylelint.config.mjs'),
        formatter: 'string',
    });
    return { errored: result.errored, report: result.report || '', files: result.results.map((r) => path.relative(ROOT, r.source).replace(/\\/g, '/')) };
}

module.exports = { CSS_LINT_SCOPE, run };

if (require.main === module) {
    run()
        .then((r) => {
            if (r.report.trim()) console.log(r.report);
            if (r.errored) process.exit(1);
            console.log(`stylelint: ${r.files.length} file(s) in scope, all clean`);
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}
