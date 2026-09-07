// scripts/server/eslint.noundef.mjs — the ONE rule a moved section must pass: every name it uses is declared in the
// module, comes in through ctx, or is a Node global. A name the extraction missed fails here at lint time instead of
// at boot (a middleware reference) or, worse, at request time (a name inside a handler body).
//   node scripts/server/check-undef.js        (wraps: eslint --no-config-lookup --config this "routes/**/*.js")
import globals from 'globals';

export default [
    {
        files: ['routes/**/*.js'],
        languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: { ...globals.node } },
        rules: { 'no-undef': 'error' },
    },
];
