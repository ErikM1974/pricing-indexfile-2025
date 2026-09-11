// ESLint flat config: strict modules plus legacy classic browser scripts.
// Browser no-undef/no-unused-vars still require a separate per-file global audit
// (2026-09-07 baseline: 1,088 and 843 findings). All enabled rules are errors,
// and the command permits zero warnings. New modules use the strict scope.
import js from '@eslint/js';
import globals from 'globals';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

// The strict-scope files; the legacy block ignores exactly these so the two never merge.
const POLICY_UI_FILES = [
    'shared_components/js/policies/org-chart-2026.js',
    'shared_components/js/policies/policy-workspace.js',
    'shared_components/js/policies/policies-hub.js',
    'shared_components/js/policies/policy-detail.js',
    'shared_components/js/policies/policy-comments.js',
    'shared_components/js/policies/policy-questions-inbox.js',
    'shared_components/js/policies/policy-ai-search.js',
    'shared_components/js/policies/handbook-reader.js',
];
const STAFF_REFERENCE_FILES = [
    "shared_components/js/staff-reference.js",
    "pages/data-entry-guide.js",
    "dashboards/js/forms-library.js",
    "dashboards/js/seo-strategy.js",
    "dashboards/js/embroidery-bonus-plan.js"
];
const MAGIC_LINK_FILES = ['pages/js/customer-login.js', 'pages/js/vendor-login.js'];
const CATALOG_DISCOVERY_FILES = ['brands.js', 'pages/js/fall-catalog-2026.js'];
const CONTRACT_UI_FILES = ['shared_components/js/contract-calculator-ui.js'];
const STRICT_FILES = [
    'shared_components/js/specialty-calculator-ui.js',
    ...CONTRACT_UI_FILES,
    ...CATALOG_DISCOVERY_FILES,
    ...MAGIC_LINK_FILES,
    ...STAFF_REFERENCE_FILES,
    'shared_components/js/storefront-navigation.js', 'shared_components/js/catalog-storefront-navigation.js', 'shared_components/js/campaign-storefront.js',
      'shared_components/js/instant-storefront.js',
    'shared_components/js/webstore-guide.js',
    ...POLICY_UI_FILES,
    'dashboards/js/policy-migration.js',
    'pages/js/pricing-negotiation-policy.js',
    'dashboards/js/caspio-api-reference.js',
    'dashboards/js/manageorders-api-reference.js',
    'dashboards/js/sanmar-api-reference.js',
    'dashboards/js/shopworks-odbc-reference.js',
    'shared_components/js/builders/**/*.js',
    'shared_components/js/ui-dialog.js',
    'shared_components/js/training-guide.js',
    'shared_components/js/training-practice.js',
    'shared_components/js/training-reference.js',
    'shared_components/js/training-manual.js',
    'training/js/sales-coordinator-manual.js',
    'training/js/sales-coordinator-training-schedule.js',
    'training/js/quick-reference-tips.js',
    'training/training-center.js',
    'training/js/sales-tax-code-trainer.js',
    'training/js/shopworks-customer-setup.js',
    'training/js/shopworks-customer-setup-enhanced.js',
    'lib/**/*.js',
    'scripts/build.js',
    'scripts/lint-css.js',
    'scripts/css/runtime-inventory.js',
    'config/tenant.js',
    'server.js',
    'routes/**/*.js',
];

// Browser scripts written as ES modules (import/export) — everything else is a classic script.
const LEGACY_ESM = [
    'shared_components/js/staff-dashboard/**/*.js',
    'dashboards/js/company-numbers.js',
    'pages/js/inventory-details.js',
    'product/**/*.js',
];

export default [
    { files: ['calculators/safety-stripe-calculator.js', 'calculators/safety-stripe-creator-service.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser } }, rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
    { files: ['calculators/safety-stripe-calculator.js'], languageOptions: { globals: { SafetyStripeQuoteService: 'readonly' } } },
    { files: ['shared_components/js/laser-tumbler-simple.js'], languageOptions: { globals: { JDSApiService: 'readonly' } } },
    {
        // Existing tumbler controllers now have explicit browser globals and zero unused bindings.
        files: ['shared_components/js/jds-api-service.js', 'shared_components/js/laser-tumbler-simple.js', 'shared_components/js/laser-tumbler-mockup.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser, ManageOrdersInventoryService: 'readonly', showToast: 'readonly' } },
        rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', vars: 'local' }] },
    },
    {
        // Global ignores — what `eslint .` never reads: build output, deps, tests, Node-side scripts
        // (except the two in STRICT_FILES), docs/memory, vendored + archived code.
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
            'tools/seed-top-sellers.js',
            'scripts/**/*.js',
            '!scripts/build.js',
            '!scripts/lint-css.js',
            '!scripts/css/runtime-inventory.js',
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
            // Former warning debt is fixed; these rules now block regressions.
            'no-useless-escape': 'error',
            'no-case-declarations': 'error',
            'no-prototype-builtins': 'error',
            'no-redeclare': 'error',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unreachable': 'error',
            'no-control-regex': 'error',
            'no-irregular-whitespace': 'error',
            'no-unused-labels': 'error',
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
        files: ['shared_components/js/specialty-calculator-ui.js', ...CONTRACT_UI_FILES, ...CATALOG_DISCOVERY_FILES, ...MAGIC_LINK_FILES, ...STAFF_REFERENCE_FILES, 'shared_components/js/storefront-navigation.js', 'shared_components/js/catalog-storefront-navigation.js', 'shared_components/js/campaign-storefront.js', ...POLICY_UI_FILES, 'shared_components/js/webstore-guide.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
    },
    {
        files: STAFF_REFERENCE_FILES,
        languageOptions: { globals: { APP_CONFIG: 'readonly', DashPage: 'readonly' } },
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
        files: ['server.js', 'routes/**/*.js', 'lib/**/*.js', 'scripts/build.js', 'scripts/lint-css.js', 'scripts/css/runtime-inventory.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: { ...globals.node },
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
