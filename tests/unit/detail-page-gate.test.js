/**
 * detail-page-gate.test.js — /mockup/:id and /art-request/:designId require staff.
 *
 * WHY THIS EXISTS
 * 2026-08-11: Ruth reported "no images, screen is completely dark" on the mockup
 * detail page. She was simply signed out. The staff session is a cookie-session
 * cookie with NO maxAge, so it dies when the browser closes — but /mockup/:id was
 * registered with no gate at all, so the page rendered anyway: its record loads
 * anonymously from the proxy, while every Box asset rides requireStaff and 401ed.
 * The result was a page that looked healthy with every image broken and no way to
 * recover. The sibling route five lines above it, /art-hub-ruth.html, WAS gated —
 * which is why her hub worked and the detail page did not.
 *
 * These tests pin two things that must never drift apart:
 *   1. both id-addressed detail routes carry the gate, and
 *   2. the gate still exempts customer-view links — those are external recipients
 *      approving a mockup, carrying their own capability token. Gating them
 *      unconditionally would bounce customers into staff SSO, which they cannot
 *      complete. That exemption is the easiest half of this to delete by accident.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

/** Pull a top-level function's real source out of server.js by brace matching. */
function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`${name} not found in server.js`);
    let depth = 0;
    let i = source.indexOf('{', start);
    const bodyStart = i;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced braces reading ${name} (from ${bodyStart})`);
}

/** Instantiate the REAL gate source so behaviour is tested, not just its spelling. */
function loadGate() {
    const src = extractFunction(SERVER, 'gateStaffDetailPage');
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return gateStaffDetailPage;`)();
}

function fakeRes() {
    return { redirected: null, redirect(url) { this.redirected = url; } };
}

describe('gateStaffDetailPage — behaviour', () => {
    const gate = loadGate();

    test('a signed-in staffer passes through', () => {
        const res = fakeRes();
        let nexted = false;
        gate({ query: {}, session: { crmUser: { email: 'ruth@nwcustomapparel.com' } }, originalUrl: '/mockup/173' },
            res, () => { nexted = true; });
        expect(nexted).toBe(true);
        expect(res.redirected).toBeNull();
    });

    test('a signed-out staffer is redirected to SAML, returning to the same URL', () => {
        const res = fakeRes();
        let nexted = false;
        gate({ query: {}, session: {}, originalUrl: '/mockup/173?ae' }, res, () => { nexted = true; });
        expect(nexted).toBe(false);
        expect(res.redirected).toBe('/auth/saml/login?next=' + encodeURIComponent('/mockup/173?ae'));
    });

    test('no session object at all still redirects rather than throwing', () => {
        const res = fakeRes();
        gate({ query: {}, originalUrl: '/art-request/53082' }, res, () => {});
        expect(res.redirected).toBe('/auth/saml/login?next=' + encodeURIComponent('/art-request/53082'));
    });

    test('customer-view links are NEVER bounced to staff SSO', () => {
        const res = fakeRes();
        let nexted = false;
        gate({ query: { view: 'customer', cid: 'tok' }, session: {}, originalUrl: '/mockup/173?view=customer&cid=tok' },
            res, () => { nexted = true; });
        expect(nexted).toBe(true);
        expect(res.redirected).toBeNull();
    });

    test('view=ae is staff and IS gated (only "customer" is exempt)', () => {
        const res = fakeRes();
        gate({ query: { view: 'ae' }, session: {}, originalUrl: '/mockup/173?view=ae' }, res, () => {});
        expect(res.redirected).toContain('/auth/saml/login');
    });
});

describe('gateStaffDetailPage — registration', () => {
    test('/mockup/:id is gated', () => {
        expect(SERVER).toContain("app.get('/mockup/:id', gateStaffDetailPage,");
    });

    test('/art-request/:designId is gated', () => {
        expect(SERVER).toContain("app.get('/art-request/:designId', gateStaffDetailPage,");
    });

    test('neither route is registered without the gate', () => {
        expect(SERVER).not.toMatch(/app\.get\(\s*'\/mockup\/:id'\s*,\s*\(/);
        expect(SERVER).not.toMatch(/app\.get\(\s*'\/art-request\/:designId'\s*,\s*\(/);
    });
});
