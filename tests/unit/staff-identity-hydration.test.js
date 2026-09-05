/**
 * @jest-environment jsdom
 *
 * Staff identity hydration (2026-09-05).
 *
 * The staff dashboard mirrors the SAML identity into sessionStorage (nwca_user_name /
 * nwca_user_email), but sessionStorage is per TAB. Every staff page that read those keys
 * was blind in a bookmarked, typed or rel=noopener tab: Quote Management said "Guest" and
 * disabled deletes, builders left the rep blank, detail pages posted notes as "Staff".
 *
 * Fix: StaffAuthHelper.ready() asks /api/crm-session/me once, writes the keys, and is
 * kicked off at script load; identity-at-init pages await it; autoSelectSalesRep retries
 * after hydration. This test runs the real helper against a stubbed fetch.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const helperSrc = read('shared_components/js/staff-auth-helper.js');

function loadHelper({ me, ok = true } = {}) {
    const store = new Map();
    const sessionStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    const calls = [];
    const fetch = (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ ok, json: () => Promise.resolve(me) }); };
    const dispatched = [];
    const sandbox = {
        console: { log() {}, warn() {} }, sessionStorage, fetch, window: {}, module: { exports: {} },
        document: { dispatchEvent: (e) => dispatched.push(e), getElementById: () => null },
        CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
        Promise,
    };
    sandbox.window = sandbox;
    vm.runInNewContext(helperSrc, sandbox);
    return { helper: sandbox.module.exports, store, calls, dispatched };
}

describe('StaffAuthHelper.ready()', () => {
    test('hydrates the legacy keys from /api/crm-session/me and resolves true', async () => {
        const { helper, store, calls, dispatched } = loadHelper({ me: { authenticated: true, name: 'Erik Mickelson', firstName: 'Erik', email: 'erik@nwcustomapparel.com', role: 'admin' } });
        expect(helper.isLoggedIn()).toBe(false);
        const ok = await helper.ready();
        expect(ok).toBe(true);
        expect(calls[0].url).toBe('/api/crm-session/me');
        expect(calls[0].opts.credentials).toBe('same-origin');
        expect(store.get('nwca_user_name')).toBe('Erik Mickelson');
        expect(store.get('nwca_user_email')).toBe('erik@nwcustomapparel.com');
        expect(store.get('nwca_user_role')).toBe('admin');
        expect(helper.isLoggedIn()).toBe(true);
        expect(dispatched.map((e) => e.type)).toContain('staff-auth:ready');
    });
    test('an anonymous session resolves false and writes nothing', async () => {
        const { helper, store } = loadHelper({ me: { authenticated: false, permissions: [], firstName: '', email: '' } });
        expect(await helper.ready()).toBe(false);
        expect(store.size).toBe(0);
    });
    test('a failed request never throws', async () => {
        const { helper } = loadHelper({ me: null, ok: false });
        await expect(helper.ready()).resolves.toBe(false);
    });
    test('the request is made once per page (memoised) and the script kicks it off at load', () => {
        const { calls } = loadHelper({ me: { authenticated: true, name: 'X', email: 'x@nwcustomapparel.com' } });
        expect(calls.length).toBe(1); // the load-time kick
        expect(helperSrc).toMatch(/StaffAuthHelper\.ready\(\);\s*\}[\s\S]{0,12}\/\/ Export/); // CRLF-tolerant
    });
    test('autoSelectSalesRep retries after hydration instead of giving up', () => {
        expect(helperSrc).toMatch(/autoSelectSalesRep\(selectId = 'sales-rep', _retried = false\)/);
        expect(helperSrc).toMatch(/if \(!_retried\) this\.ready\(\)\.then/);
    });
});

describe('pages that read identity at init await the hydration', () => {
    test.each([
        ['dashboards/js/rep-crm.js', /StaffAuthHelper\.ready\(\) : Promise\.resolve\(\)\)\s*\.then\(\(\) => this\.displayWelcomeMessage\(\)\)/],
        ['pages/js/quote-view.js', /await StaffAuthHelper\.ready\(\);\s*\n\s*this\.isStaff =/],
        ['pages/js/quote-audit.js', /await StaffAuthHelper\.ready\(\);\s*\n\s*if \(typeof StaffAuthHelper === 'undefined' \|\| !StaffAuthHelper\.isLoggedIn\(\)\)/],
        ['pages/js/invoice.js', /await StaffAuthHelper\.ready\(\);\s*\n\s*const isStaff =/],
        ['pages/js/transfer-detail.js', /StaffAuthHelper\.ready\(\) : Promise\.resolve\(\)\)\.then\(loadUser\)/],
    ])('%s', (file, re) => {
        expect(read(file)).toMatch(re);
    });
    test.each([
        'dashboards/nika-crm.html', 'dashboards/taneisha-crm.html', 'pages/invoice.html', 'pages/art-request-detail.html',
        'pages/mockup-detail.html', 'pages/transfer-detail.html', 'dashboards/art-hub-steve.html', 'pages/quote-view.html', 'pages/quote-audit.html',
    ])('%s loads the helper', (file) => {
        expect(read(file)).toMatch(/staff-auth-helper\.js/);
    });
});
