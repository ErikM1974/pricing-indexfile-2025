/**
 * Mint a staff session for the E2E harness (roadmap 1.13 harness support).
 *
 * WHY THIS EXISTS. `app.use('/quote-builders', gateStaffHtml)` (server.js, added
 * 2026-08-17 with "Security: gate /quote-builders") put every builder page behind
 * the SAML gate. CI has no SAML config, so the specs got 302 → /auth/saml/login →
 * 503 "Staff SSO is not configured yet", and all 10 money-path + axe tests died on
 * `waitForSelector('#product-search')`. The gate is CORRECT — the harness was the
 * thing out of date.
 *
 * 🔴 THE GATE ITSELF IS NEVER WEAKENED FOR TESTS. There is deliberately no
 * NODE_ENV==='test' bypass in server.js: a gate with a test-shaped hole in it is
 * one env-var mistake away from being no gate at all. Instead we do what a real
 * browser does after SAML — present the signed `nwca_staff` cookie — by signing it
 * with the same cookie-session/Keygrip primitives the server verifies with, under
 * a secret that only ever exists in this harness (see TEST_SESSION_SECRET).
 *
 * The session payload mirrors exactly what the SAML ACS handler writes
 * (server.js `/auth/saml/acs` → req.session.crmUser). Roles are deliberately
 * plain 'staff': quote-builder pages carry no Staff_Page_Access row, so
 * lib/page-access.js resolves them to "any logged-in staff" — testing with an
 * admin cookie would mask a future row that locks reps out.
 */

const Keygrip = require('keygrip');

// Pinned, non-secret, and NOT a credential anywhere real: the E2E webServer boots
// with this exact value (playwright.config.js), so the cookie we sign here is only
// ever valid against that throwaway :3400 process. Production refuses to boot on a
// default/unset SESSION_SECRET (server.js fail-closed check), so this string can
// never unlock a real environment.
const TEST_SESSION_SECRET = 'e2e-harness-secret-not-used-anywhere-real';

const COOKIE_NAME = 'nwca_staff';

/** The crmUser the SAML ACS handler would have written for a rep. */
function testStaffUser() {
    return {
        name: 'E2E Harness',
        email: 'e2e-harness@nwcustomapparel.com',
        firstName: 'E2E',
        role: 'staff',
        permissions: ['staff'],
        via: 'saml',
    };
}

/**
 * Build the `nwca_staff` + `nwca_staff.sig` pair exactly as cookie-session does:
 * value = base64(JSON), signature = Keygrip.sign("name=value").
 * @param {string} [secret]
 * @returns {Array<{name: string, value: string}>}
 */
function staffCookiePair(secret = TEST_SESSION_SECRET) {
    const session = { crmUser: testStaffUser() };
    const value = Buffer.from(JSON.stringify(session)).toString('base64');
    const sig = new Keygrip([secret]).sign(`${COOKIE_NAME}=${value}`);
    return [
        { name: COOKIE_NAME, value },
        { name: `${COOKIE_NAME}.sig`, value: sig },
    ];
}

/**
 * The same pair as a Playwright storageState object, scoped to the harness origin.
 * @param {string} baseURL
 */
function staffStorageState(baseURL) {
    const { hostname } = new URL(baseURL);
    return {
        cookies: staffCookiePair().map((c) => ({
            ...c,
            domain: hostname,
            path: '/',
            expires: -1, // session cookie, same as the real login
            httpOnly: true,
            secure: false, // NODE_ENV=test → cookie-session sets secure:false
            sameSite: 'Lax',
        })),
        origins: [],
    };
}

module.exports = { TEST_SESSION_SECRET, staffCookiePair, staffStorageState, testStaffUser };
