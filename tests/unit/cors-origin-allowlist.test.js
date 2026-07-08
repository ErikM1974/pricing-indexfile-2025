/**
 * lib/cors-allowlist.js — roadmap 1.2 lock.
 *
 * The old server.js check used `origin.endsWith(allowed)` and a broad
 * `/\.herokuapp\.com$/` regex while also sending Allow-Credentials — meaning
 * a look-alike domain or ANY Heroku app could make credentialed cross-origin
 * reads. These tests are the regression lock: exact-match only, dev origins
 * gated out of production, no origin → no CORS.
 */

const { buildAllowlist, isOriginAllowed, DEFAULT_ALLOWED_ORIGINS } = require('../../lib/cors-allowlist');

const PROD = { allowlist: DEFAULT_ALLOWED_ORIGINS, nodeEnv: 'production' };
const DEV = { allowlist: DEFAULT_ALLOWED_ORIGINS, nodeEnv: 'development' };

describe('isOriginAllowed — production', () => {
    test('accepts exact allowlisted origins', () => {
        expect(isOriginAllowed('https://teamnwca.com', PROD)).toBe(true);
        expect(isOriginAllowed('https://www.teamnwca.com', PROD)).toBe(true);
        expect(isOriginAllowed('https://nwcustom.caspio.com', PROD)).toBe(true);
        expect(isOriginAllowed('https://sanmar-inventory-app-4cd7b252508d.herokuapp.com', PROD)).toBe(true);
    });

    test('REJECTS look-alike domains (the endsWith bug)', () => {
        expect(isOriginAllowed('https://evil-teamnwca.com', PROD)).toBe(false);
        expect(isOriginAllowed('https://xteamnwca.com', PROD)).toBe(false);
        expect(isOriginAllowed('https://teamnwca.com.evil.com', PROD)).toBe(false);
        expect(isOriginAllowed('https://evilnwcustom.caspio.com', PROD)).toBe(false);
    });

    test('REJECTS arbitrary *.herokuapp.com origins (the wildcard-regex bug)', () => {
        expect(isOriginAllowed('https://attacker-app.herokuapp.com', PROD)).toBe(false);
        expect(isOriginAllowed('https://sanmar-inventory-app-clone.herokuapp.com', PROD)).toBe(false);
    });

    test('REJECTS localhost / 127.0.0.1 in production', () => {
        expect(isOriginAllowed('http://localhost:3000', PROD)).toBe(false);
        expect(isOriginAllowed('http://127.0.0.1:3010', PROD)).toBe(false);
    });

    test('rejects scheme/case mismatches — exact string equality only', () => {
        expect(isOriginAllowed('http://teamnwca.com', PROD)).toBe(false);
        expect(isOriginAllowed('https://TEAMNWCA.com', PROD)).toBe(false);
    });

    test('no Origin header → not allowed (no CORS headers emitted)', () => {
        expect(isOriginAllowed(undefined, PROD)).toBe(false);
        expect(isOriginAllowed('', PROD)).toBe(false);
    });
});

describe('isOriginAllowed — development', () => {
    test('allows localhost and 127.0.0.1 on any port', () => {
        expect(isOriginAllowed('http://localhost:3000', DEV)).toBe(true);
        expect(isOriginAllowed('http://localhost:3010', DEV)).toBe(true);
        expect(isOriginAllowed('http://127.0.0.1:8080', DEV)).toBe(true);
    });

    test('still rejects look-alikes and arbitrary hosts in dev', () => {
        expect(isOriginAllowed('https://evil-teamnwca.com', DEV)).toBe(false);
        expect(isOriginAllowed('https://localhost.evil.com', DEV)).toBe(false);
    });
});

describe('buildAllowlist', () => {
    test('defaults when CORS_ALLOWED_ORIGINS unset', () => {
        expect(buildAllowlist({})).toEqual(DEFAULT_ALLOWED_ORIGINS);
    });

    test('CORS_ALLOWED_ORIGINS REPLACES the defaults (exact origins, trimmed)', () => {
        const list = buildAllowlist({ CORS_ALLOWED_ORIGINS: 'https://a.com, https://b.com ,' });
        expect(list).toEqual(['https://a.com', 'https://b.com']);
        expect(isOriginAllowed('https://teamnwca.com', { allowlist: list, nodeEnv: 'production' })).toBe(false);
        expect(isOriginAllowed('https://a.com', { allowlist: list, nodeEnv: 'production' })).toBe(true);
        expect(isOriginAllowed('https://evil-a.com', { allowlist: list, nodeEnv: 'production' })).toBe(false);
    });
});
