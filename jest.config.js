module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
    coverageDirectory: 'tests/coverage',
    collectCoverageFrom: [
        'shared_components/js/shopworks-import-parser.js',
        'shared_components/js/embroidery-quote-pricing.js',
        'shared_components/js/quote-builder-utils.js'
    ],
    // Prevent constructor from calling API during tests
    setupFiles: ['./tests/setup.js']
};
