/**
 * Playwright E2E config (roadmap 1.13) — the money path in a REAL browser.
 *
 * webServer boots server.js on a dedicated port (3400 — never collides with
 * dev :3000 or the preview :3010). Pricing READS hit the live proxy (same
 * philosophy as the capture baselines); all WRITES (Caspio sessions/items,
 * quote-sequence, EmailJS) are route-mocked inside the specs — E2E runs
 * never create real quotes or send real email.
 *
 * Specs run AUTHENTICATED as staff (storageState below) because the builder
 * pages sit behind the SAML page gate; staff-session.js has the full why.
 *
 * webkit is a deliberate follow-up (roadmap names chromium+webkit; chromium
 * ships first to keep CI download small).
 */

const { defineConfig } = require('@playwright/test');
const { TEST_SESSION_SECRET, staffStorageState } = require('./staff-session');

const BASE_URL = 'http://localhost:3400';

module.exports = defineConfig({
    testDir: __dirname,
    timeout: 120000,
    retries: process.env.CI ? 1 : 0,
    workers: 1, // serial — shared live-proxy reads; parallel cold-start was flaky
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],
    use: {
        baseURL: BASE_URL,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        // Every spec starts LOGGED IN as staff. /quote-builders is behind the SAML
        // page gate (server.js), and CI has no SAML — without this the builders
        // 302 to /auth/saml/login and every money/axe assert dies on a 503 shell.
        // See staff-session.js for why we sign a real cookie instead of poking a
        // test-only hole in the gate.
        storageState: staffStorageState(BASE_URL),
    },
    webServer: {
        command: 'node server.js',
        cwd: require('path').join(__dirname, '../..'),
        port: 3400,
        // SESSION_SECRET is pinned so the cookie staff-session.js signs verifies
        // against this server. Must stay in lockstep with TEST_SESSION_SECRET.
        env: { ...process.env, PORT: '3400', NODE_ENV: 'test', SENTRY_DSN: '', SESSION_SECRET: TEST_SESSION_SECRET },
        reuseExistingServer: !process.env.CI,
        timeout: 90000,
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
