// Playwright config that serves the repo STATICALLY (scripts/qa-static-server.js on :8098, no auth, no live data) and
// reuses tests/e2e/builder-screenshots.spec.js unchanged. Use it to screenshot admin-gated pages (they redirect under
// the staff session) or files server.js does not serve (tests/ui fixtures):
//   SHOT_TAG=before SHOT_PAGES_FILE=<txt> npx playwright test --config scripts/css/playwright.static.config.js
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..'); // the repo root, wherever it is cloned
const { defineConfig } = require(path.join(REPO, 'node_modules/@playwright/test'));

module.exports = defineConfig({
    testDir: path.join(REPO, 'tests/e2e'),
    testMatch: /builder-screenshots\.spec\.js$/,
    timeout: 120000,
    workers: 1,
    reporter: [['list']],
    use: { baseURL: 'http://localhost:8098' },
    webServer: {
        command: 'node scripts/qa-static-server.js "' + REPO + '" 8098',
        cwd: REPO,
        port: 8098,
        reuseExistingServer: true,
        timeout: 30000,
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } }],
});
