/**
 * getServicePrice() fallbacks must be VISIBLE (2026-08-17 security/pricing review).
 *
 * THE BUG THIS LOCKS: getServicePrice(code, fallback) returned the hardcoded
 * fallback SILENTLY whenever /api/service-codes had loaded but this particular
 * row was missing — so a service code renamed or deleted in Caspio substituted a
 * literal into a CHARGED, SAVED and PUSHED total with nothing on screen. That is
 * Erik's #1 rule ("wrong pricing is worse than an error") failing in the one
 * function all four builders share. warnIfServiceCodeMissing() already existed
 * for exactly this and was wired at only ~4 of ~20 call sites.
 *
 * The warning now lives INSIDE getServicePrice, so every caller — including ones
 * written later — is covered by construction. These tests are what stop someone
 * "simplifying" it back to a bare `return fallback`.
 */

const path = require('path');

const BUNDLES = path.join(__dirname, '.bundles');

let getServicePrice;

/** Minimal stand-in for the real helper in quote-builder-utils.js. */
function installWarnHelper(calls) {
    window._svcCodeFallbackWarned = {};
    window.warnIfServiceCodeMissing = function (code, fallback) {
        const key = String(code).toUpperCase();
        if (window._svcCodeFallbackWarned[key]) return false;
        if (!window._serviceCodes) return false;      // fetch hasn't resolved yet
        if (window._serviceCodes[key]) return false;  // row exists — not this path
        window._svcCodeFallbackWarned[key] = true;
        calls.push({ code, fallback });
        return true;
    };
}

beforeEach(() => {
    jest.resetModules();
    delete window._serviceCodes;
    delete window._svcCodeFallbackWarned;
    delete window.warnIfServiceCodeMissing;
    document.body.innerHTML = '';
    const badge = document.getElementById('qb-fallback-badge');
    if (badge) badge.remove();
    ({ getServicePrice } = require(path.join(BUNDLES, 'shared-service-codes.cjs')));
});

describe('getServicePrice — live value', () => {
    test('returns the Caspio SellPrice, never the fallback, and warns about nothing', () => {
        const calls = [];
        installWarnHelper(calls);
        window._serviceCodes = { 'GRT-75': { ServiceCode: 'GRT-75', SellPrice: '82.50' } };

        expect(getServicePrice('GRT-75', 75)).toBe(82.5);
        expect(calls).toEqual([]);
        expect(document.getElementById('qb-fallback-badge')).toBeNull();
    });

    test('is case-insensitive on the code', () => {
        installWarnHelper([]);
        window._serviceCodes = { SPSU: { SellPrice: '30' } };
        expect(getServicePrice('spsu', 999)).toBe(30);
    });
});

describe('getServicePrice — MISSING row warns (the regression this locks)', () => {
    test('map loaded but code absent → returns fallback AND warns', () => {
        const calls = [];
        installWarnHelper(calls);
        window._serviceCodes = { SPSU: { SellPrice: '30' } }; // GRT-75 deleted in Caspio

        expect(getServicePrice('GRT-75', 75)).toBe(75);
        expect(calls).toEqual([{ code: 'GRT-75', fallback: 75 }]);
    });

    test('warns once per code, so a hot recalc path cannot spam', () => {
        const calls = [];
        installWarnHelper(calls);
        window._serviceCodes = {};

        for (let i = 0; i < 25; i++) getServicePrice('DT', 50);
        expect(calls).toHaveLength(1);
    });

    test('SILENT before the fetch resolves — an unloaded map is not a missing row', () => {
        const calls = [];
        installWarnHelper(calls);
        // window._serviceCodes deliberately unset

        expect(getServicePrice('GRT-75', 75)).toBe(75);
        expect(calls).toEqual([]);
    });
});

describe('getServicePrice — row present but price unusable', () => {
    // warnIfServiceCodeMissing returns false when the row EXISTS, so it can never
    // cover this path; getServicePrice raises the persistent badge directly.
    test('unparseable SellPrice → returns fallback AND shows the badge', () => {
        installWarnHelper([]);
        window._serviceCodes = { 'GRT-75': { SellPrice: 'call for pricing' } };

        expect(getServicePrice('GRT-75', 75)).toBe(75);
        const badge = document.getElementById('qb-fallback-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toMatch(/Estimated pricing in use/i);
        expect(badge.textContent).toContain('GRT-75');
    });

    test('zero is a REAL price, not a falsy miss', () => {
        const calls = [];
        installWarnHelper(calls);
        window._serviceCodes = { 'SP-STRIPE': { SellPrice: '0' } };

        expect(getServicePrice('SP-STRIPE', 2)).toBe(0);
        expect(calls).toEqual([]);
        expect(document.getElementById('qb-fallback-badge')).toBeNull();
    });
});
