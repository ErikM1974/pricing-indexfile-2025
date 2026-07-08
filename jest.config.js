module.exports = {
    coverageDirectory: 'tests/coverage',
    collectCoverageFrom: [
        'shared_components/js/shopworks-import-parser.js',
        'shared_components/js/embroidery-quote-pricing.js',
        'shared_components/js/quote-builder-utils.js'
    ],
    // Two projects (roadmap 1.14): the historic node suite, plus a jsdom
    // project for DOM-dependent tests (extracted builder seams + axe a11y).
    // `jest tests/unit/...` style path filtering works across projects.
    projects: [
        {
            displayName: 'node',
            testEnvironment: 'node',
            testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
            // Stale agent worktrees under .claude/worktrees/ carry full repo copies —
            // without this ignore, jest runs every suite 2-4x and the copies fail
            // (their capture fixtures resolve against the wrong root).
            testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
            // Prevent constructor from calling API during tests
            setupFiles: ['./tests/setup.js'],
        },
        {
            displayName: 'dom',
            testEnvironment: 'jsdom',
            testMatch: ['**/tests/dom/**/*.test.js', '**/tests/a11y/**/*.test.js'],
            testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
            globalSetup: './tests/dom/global-setup.js',
            setupFiles: ['./tests/dom/setup.js'],
        },
    ],
};
