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
        // compact one-line rules (`.x { a: 1; b: 2; }`) are this repo's house style; reflowing thousands of them is
        // churn, not consistency. The auto-fixable formatting rules of the standard config stay on.
        'declaration-block-single-line-max-declarations': null,
        // Satisfying this rule means REORDERING rules, which changes the cascade — the one thing a pixel-verified
        // migration must not do. Specificity order is reviewed per family in the screenshot diff instead.
        'no-descending-specificity': null,
        // ids are camelCase across the legacy pages AND their scripts (getElementById); renaming is an HTML+JS
        // change, not a CSS one. New pages use kebab-case ids by convention (templates/page-template.html).
        'selector-id-pattern': null,
        // keyframe names (fadeIn, slideDown…) are referenced from animation shorthands across the legacy sheets and
        // sometimes from JS (`el.style.animation`); renaming them is churn with a runtime risk, not consistency.
        'keyframes-name-pattern': null,
        // legacy sheets carry 5-decimal em values (0.71875em = 11.5px); rounding them is a sub-pixel change, not consistency
        'number-max-precision': 5,
        // `clip: rect(0 0 0 0)` is the canonical visually-hidden (.sr-only) pattern; clip-path is not a byte-identical swap
        'property-no-deprecated': [true, { ignoreProperties: ['clip'] }],
        // Class names: kebab-case with BEM __element / --modifier is the convention for NEW pages
        // (templates/page-template.html, components.css). The rule itself is off: legacy sheets carry
        // camelCase classes that are wired into JS (querySelector / classList) and into Caspio DataPage
        // markup (cbFormTable…) — renaming is an HTML+JS change, not a CSS one (same reasoning as ids).
        'selector-class-pattern': null,
    },
    overrides: [
        {
            files: ['shared_components/css/tokens.css', 'shared_components/css/staff-dashboard/tokens.css'],
            rules: { 'color-no-hex': null },
        },
    ],
};
