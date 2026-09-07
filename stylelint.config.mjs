// stylelint (CSS standardization Step 3, 2026-09-07) — keeps the token system honest.
//
// WHICH files are linted is a RATCHET owned by scripts/lint-css.js (CSS_LINT_SCOPE): a family's
// stylesheets enter when the family migrates to shared_components/css/tokens.css and never leave.
// This file only says WHAT is checked. `npm run lint:css` runs it; tests/unit/css-lint.test.js runs
// the same thing under jest, so `npm test` and the deploy gate cannot pass with a CSS lint error.
//
// The two rules that carry the project (memory/CSS_STANDARDIZATION_PLAN_2026-09.md § 4):
//   color-no-hex            raw hex colours live ONLY in the two token files — pages use var(--color-…)
//   declaration-no-important the generated quote-builder-inline.css is the one deliberate exception
//                           (127 hash classes that replace inline style="" attributes; it is ignored,
//                           not exempted, and retires with the quote-builders family)
export default {
    extends: ['stylelint-config-standard'],
    ignoreFiles: [
        'dist/**',
        'node_modules/**',
        '**/vendor/**',
        '**/archive/**',
        'shared_components/css/quote-builder-inline.css',
    ],
    rules: {
        'color-no-hex': [true, { message: 'Raw hex colours belong in shared_components/css/tokens.css — use var(--color-…)' }],
        'declaration-no-important': [true, { message: '!important is reserved for the generated quote-builder-inline.css' }],
        // font names are proper nouns (Inter, Menlo, BlinkMacSystemFont) — lower-casing them is noise, not consistency
        'value-keyword-case': ['lower', { ignoreProperties: ['font-family', 'font', '/^--font-/'] }],
        // kebab-case classes, BEM block__element--modifier allowed (the dashboard already uses ws-card--wide)
        'selector-class-pattern': [
            '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
            { message: 'Class names are kebab-case (BEM __element / --modifier allowed)' },
        ],
    },
    overrides: [
        {
            files: ['shared_components/css/tokens.css', 'shared_components/css/staff-dashboard/tokens.css'],
            rules: { 'color-no-hex': null },
        },
    ],
};
