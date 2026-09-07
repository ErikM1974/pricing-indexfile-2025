/**
 * css-lint.test.js — the stylelint gate (CSS standardization Step 3, 2026-09-07).
 *
 * Runs scripts/lint-css.js exactly as `npm run lint:css` does, so the deploy skill's Step 0.6
 * (test:unit) and CI fail on a CSS lint finding in any stylesheet inside CSS_LINT_SCOPE. The scope
 * list itself is locked to keep growing: the two token files can never drop out of it.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const { CSS_LINT_SCOPE } = require('../../scripts/lint-css.js');

describe('stylelint over the standardized stylesheets', () => {
    test('scope always includes the two token files (ratchet — widen only)', () => {
        expect(CSS_LINT_SCOPE).toEqual(expect.arrayContaining([
            'shared_components/css/tokens.css',
            'shared_components/css/staff-dashboard/tokens.css',
        ]));
    });

    test('every stylesheet in CSS_LINT_SCOPE passes stylelint.config.mjs', () => {
        let out;
        try {
            out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'lint-css.js')], {
                cwd: ROOT,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 120000,
            });
        } catch (e) {
            throw new Error('stylelint findings:\n' + (e.stdout || '') + (e.stderr || ''));
        }
        expect(out).toMatch(/all clean/);
    });
});
