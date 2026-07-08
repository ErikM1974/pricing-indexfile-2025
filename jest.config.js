module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
    // Stale agent worktrees under .claude/worktrees/ carry full repo copies —
    // without this ignore, jest runs every suite 2-4x and the copies fail
    // (their capture fixtures resolve against the wrong root).
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
    coverageDirectory: 'tests/coverage',
    collectCoverageFrom: [
        'shared_components/js/shopworks-import-parser.js',
        'shared_components/js/embroidery-quote-pricing.js',
        'shared_components/js/quote-builder-utils.js'
    ],
    // Prevent constructor from calling API during tests
    setupFiles: ['./tests/setup.js']
};
