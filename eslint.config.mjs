// ESLint flat config (roadmap 0.6). Two scopes, one ratchet — never loosen a rule to admit a file:
//   STRICT  — the NEW Phase-0+ code (builders, lib, build, tenant config, lint-css): the full ruleset below.
//   LEGACY  — every other browser script (widened 2026-09-07, CSS standardization Step 3): parsed, and
//             checked with js.configs.recommended MINUS the two rules that only a per-file `/* global */`
//             audit can satisfy for classic scripts sharing window globals (no-undef 1,088 findings in
//             146 files, no-unused-vars 843 in 206 — measured 2026-09-07). The rules that DID fire are
//             `warn`, capped by `--max-warnings` in package.json `lint` (99 at the time of writing):
//             fix some, lower the cap, never raise it. A file that moves into the strict scope gets the
//             strict rules automatically — that is how legacy code graduates.
import js from '@eslint/js';
import globals from 'globals';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

// The strict-scope files; the legacy block ignores exactly these so the two never merge.
const STRICT_FILES = [
    'shared_components/js/builders/**/*.js',
    'lib/**/*.js',
    'scripts/build.js',
    'scripts/lint-css.js',
    'config/tenant.js',
];

// Browser scripts written as ES modules (import/export) — everything else is a classic script.
const LEGACY_ESM = [
    'shared_components/js/staff-dashboard/**/*.js',
    'dashboards/js/company-numbers.js',
    'pages/js/inventory-details.js',
    'product/**/*.js',
];

export default [
    {
        // Global ignores — what `eslint .` never reads: build output, deps, tests, Node-side scripts
        // (except the two in STRICT_FILES), docs/memory, vendored + archived code, the in-browser-Babel .jsx,
        // and server.js (Node, 5,600 lines, its own review process).
        ignores: [
            'dist/**',
            'node_modules/**',
            'tests/**',
            '.claude/**',
            'memory/**',
            'docs/**',
            'richardson-caps/**',
            'templates/**',
            '**/vendor/**',
            '**/archive/**',
            '**/archive-working-files/**',
            '**/*.jsx',
            'server.js',
            // routes/<domain>.js = sections of server.js moved verbatim (server split, 2026-09-07): same code, same review
            // process, until the split is done and the whole server enters a Node strict scope together.
            'routes/**/*.js',
            'tools/seed-top-sellers.js',
            'scripts/**/*.js',
            '!scripts/build.js',
            '!scripts/lint-css.js',
        ],
    },
    {
        // LEGACY browser scope (2026-09-07) — see the header.
        files: ['**/*.js'],
        ignores: [...STRICT_FILES, 'shared_components/js/quote-builder-utils.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-undef': 'off',
            'no-unused-vars': 'off',
            // What fired on 2026-09-07 (count): warnings under the --max-warnings cap until fixed.
            'no-useless-escape': 'warn', // 43
            'no-case-declarations': 'warn', // 19
            'no-prototype-builtins': 'warn', // 12
            'no-redeclare': 'warn', // 9
            'no-empty': ['warn', { allowEmptyCatch: true }], // 8
            'no-unreachable': 'warn', // 3
            'no-control-regex': 'warn', // 2
            'no-irregular-whitespace': 'warn', // 1
            'no-unused-labels': 'warn', // 1
        },
    },
    {
        files: LEGACY_ESM,
        languageOptions: { sourceType: 'module' },
    },
    {
        // STRICT — new-code scope
        files: STRICT_FILES,
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                fetch: 'readonly',
                // Standard in both Node 18+ and every browser we target — same
                // category as fetch/setTimeout above. lib/product-seo.js times its
                // proxy calls out with it (no-undef flagged it from v2026.08.10.9,
                // red in CI ever since). Adding a real platform global is widening
                // the config, not loosening a rule.
                AbortController: 'readonly',
                console: 'readonly',
                URLSearchParams: 'readonly',
                CustomEvent: 'readonly',
                sessionStorage: 'readonly',
                localStorage: 'readonly',
                module: 'writable',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
            },
        },
        plugins: { 'no-unsanitized': noUnsanitized },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            eqeqeq: ['error', 'smart'],
            'no-implicit-globals': 'error',
            'no-var': 'off', // dual browser/Node files still use var deliberately
            // Stranger-pattern discipline: window.* re-exports are allowed ONLY
            // in each builder's index.js (the designated transition surface).
            'no-restricted-syntax': [
                'error',
                {
                    selector: "AssignmentExpression > MemberExpression.left[object.name='window']",
                    message:
                        'New window.* globals are banned in extracted modules — export from the module and re-export via builders/*/index.js during the strangler transition (roadmap 0.4).',
                },
            ],
            // escapeHtml/_dtfEsc/_scpEsc are recognized sanitizers (roadmap 1.4):
            // a template whose every interpolation is wrapped passes; raw ones fail.
            'no-unsanitized/method': ['error', { escape: { methods: ['escapeHtml', 'escapeHTML', '_dtfEsc', '_scpEsc'], taggedTemplates: [] } }],
            'no-unsanitized/property': ['error', { escape: { methods: ['escapeHtml', 'escapeHTML', '_dtfEsc', '_scpEsc'], taggedTemplates: [] } }],
        },
    },
    {
        // The designated window re-export surface + the config seed file.
        files: ['shared_components/js/builders/*/index.js', 'config/tenant.js'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    },
    {
        // MOVED legacy render code (0.4 extractions) — innerHTML sinks predate
        // the modules and interpolations are escapeHtml-wrapped or numeric
        // (hand-audited per extraction; nuances logged in the plan doc for the
        // roadmap-1.4 sink audit, which removes this override). Only files
        // moved verbatim from the monolith may be added here.
        files: [
            'shared_components/js/builders/emb/design-search.js',
            'shared_components/js/builders/emb/spr-modal.js',
            'shared_components/js/builders/emb/shopworks-import.js',
            'shared_components/js/builders/emb/persistence.js',
            'shared_components/js/builders/emb/output.js',
            'shared_components/js/builders/emb/save-push.js',
            'shared_components/js/builders/emb/pricing-sync.js',
            'shared_components/js/builders/emb/quote-lifecycle.js',
            'shared_components/js/builders/emb/logo-config.js',
            'shared_components/js/builders/emb/product-rows.js',
            'shared_components/js/builders/emb/adapter.js',
            'shared_components/js/builders/scp/print-config.js',
            'shared_components/js/builders/scp/persistence.js',
            'shared_components/js/builders/scp/product-rows.js',
            'shared_components/js/builders/scp/pricing-sync.js',
            'shared_components/js/builders/scp/quote-lifecycle.js',
            'shared_components/js/builders/scp/save-output.js',
            'shared_components/js/builders/scp/push.js',
            'shared_components/js/builders/scp/adapter.js',
            'shared_components/js/builders/dtf/quote-builder-class.js',
            'shared_components/js/builders/dtf/output.js',
            'shared_components/js/builders/dtf/push.js',
            'shared_components/js/builders/dtf/adapter.js',
        ],
        rules: {
            // no-unsanitized/* now ENFORCED here too (roadmap 1.4 stage 2) — every
            // sink below is escapeHtml-wrapped, numeric-only, or carries a per-line
            // audited disable. New raw innerHTML in moved files fails CI like
            // everywhere else.
            // pricing-sync carries ~20 pre-existing window-flag writes (tax/ship/
            // caches — inventoried in emb-decomposition-plan.md); they migrate
            // with their reader clusters. Applies ONLY to moved-legacy files.
            'no-restricted-syntax': 'off',
            // SCP S1a: state (productCache/childRowMap/editingQuoteId/hasChanges)
            // still lives in the monolith shell until S2 — modules WRITE those
            // lexical globals without reading them, which default no-unused-vars
            // flags. vars:'local' skips /* global */ names, keeps module-local checks.
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', vars: 'local' }],
        },
    },
    {
        // Node-side build/server helpers — CommonJS, not ESM.
        files: ['lib/**/*.js', 'scripts/build.js', 'scripts/lint-css.js'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    {
        // quote-builder-utils.js (classic script shared by all 4 builders):
        // SINK rules only for now (roadmap 1.4) — the full ruleset lands when
        // it modularizes. Widening, never loosening (the ratchet).
        files: ['shared_components/js/quote-builder-utils.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
        },
        plugins: { 'no-unsanitized': noUnsanitized },
        rules: {
            'no-unsanitized/method': ['error', { escape: { methods: ['escapeHtml', 'escapeHTML', '_dtfEsc', '_scpEsc'], taggedTemplates: [] } }],
            'no-unsanitized/property': ['error', { escape: { methods: ['escapeHtml', 'escapeHTML', '_dtfEsc', '_scpEsc'], taggedTemplates: [] } }],
        },
    },
];
