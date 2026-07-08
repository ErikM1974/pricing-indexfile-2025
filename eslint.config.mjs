// ESLint flat config (roadmap 0.6) — scoped to NEW Phase-0+ code only.
// Legacy files are grandfathered; they come under lint as task 0.4 migrates
// them into shared_components/js/builders/**. Widening the scope is the
// ratchet — never loosen a rule to admit a file.
import js from '@eslint/js';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default [
    {
        // New-code scope
        files: [
            'shared_components/js/builders/**/*.js',
            'lib/**/*.js',
            'scripts/build.js',
            'config/tenant.js',
        ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                fetch: 'readonly',
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
            'no-unsanitized/method': 'error',
            'no-unsanitized/property': 'error',
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
        ],
        rules: {
            'no-unsanitized/property': 'off',
            'no-unsanitized/method': 'off',
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
        files: ['lib/**/*.js', 'scripts/build.js'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
];
