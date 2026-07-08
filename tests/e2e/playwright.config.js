/**
 * Playwright E2E config (roadmap 1.13) — the money path in a REAL browser.
 *
 * webServer boots server.js on a dedicated port (3400 — never collides with
 * dev :3000 or the preview :3010). Pricing READS hit the live proxy (same
 * philosophy as the capture baselines); all WRITES (Caspio sessions/items,
 * quote-sequence, EmailJS) are route-mocked inside the specs — E2E runs
 * never create real quotes or send real email.
 *
 * webkit is a deliberate follow-up (roadmap names chromium+webkit; chromium
 * ships first to keep CI download small).
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: __dirname,
    timeout: 120000,
    retries: process.env.CI ? 1 : 0,
    workers: 1, // serial — shared live-proxy reads; parallel cold-start was flaky
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],
    use: {
        baseURL: 'http://localhost:3400',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'node server.js',
        cwd: require('path').join(__dirname, '../..'),
        port: 3400,
        env: { ...process.env, PORT: '3400', NODE_ENV: 'test', SENTRY_DSN: '' },
        reuseExistingServer: !process.env.CI,
        timeout: 90000,
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
