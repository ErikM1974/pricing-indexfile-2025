/**
 * lib/page-access.js — Administration access lock (2026-07-28).
 *
 * The bug this pins down: gateStaffPage treats a page with no Staff_Page_Access
 * row as "any logged-in staff". Correct for ordinary staff pages, wrong for the
 * Administration menu — several admin tools (Blog Editor, SanMar Payables, API
 * Usage, Bandit Integration, Commission Structure…) had no row and no explicit
 * route gate, so every logged-in staffer could open them. ADMIN_DEFAULT_PAGES
 * inverts the default for that set.
 *
 * These tests also pin the two properties that make the fix safe to live with:
 * the Caspio table can still widen access with no deploy, and the page list
 * cannot silently drift from the menu it mirrors.
 */

const fs = require('fs');
const path = require('path');

const { ADMIN_DEFAULT_PAGES, isAdminDefaultPage, userMayAccessPage } = require('../../lib/page-access');

// Permission sets exactly as staff-saml.js permissionsFromRole() derives them.
const ADMIN      = { email: 'erik@nwcustomapparel.com', permissions: ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'] };
const ACCOUNTANT = { email: 'ruth@nwcustomapparel.com', permissions: ['accountant'] };
const SALES      = { email: 'nika@nwcustomapparel.com', permissions: ['sales', 'nika'] };
const BASIC      = { email: 'adriyella@nwcustomapparel.com', permissions: [] };
const EVERYONE   = [ADMIN, ACCOUNTANT, SALES, BASIC];

describe('unlisted Administration pages default to admin-only', () => {
    test.each([...ADMIN_DEFAULT_PAGES])('%s — admin in, everyone else out', (page) => {
        expect(userMayAccessPage(ADMIN, undefined, page)).toBe(true);
        expect(userMayAccessPage(ACCOUNTANT, undefined, page)).toBe(false);
        expect(userMayAccessPage(SALES, undefined, page)).toBe(false);
        expect(userMayAccessPage(BASIC, undefined, page)).toBe(false);
    });

    test('the page key is matched case-insensitively', () => {
        expect(userMayAccessPage(BASIC, undefined, 'Payroll.HTML')).toBe(false);
        expect(isAdminDefaultPage('BLOG-EDITOR.HTML')).toBe(true);
    });

    test('a missing/blank page key is not treated as an admin page', () => {
        expect(userMayAccessPage(BASIC, undefined, undefined)).toBe(true);
        expect(userMayAccessPage(BASIC, undefined, '')).toBe(true);
    });
});

describe('ordinary staff pages are unaffected', () => {
    test.each(['leads.html', 'forms-library.html', 'production-shifts.html', 'form-submissions.html'])(
        '%s — any logged-in staff', (page) => {
            for (const user of EVERYONE) expect(userMayAccessPage(user, undefined, page)).toBe(true);
        });
});

describe('the Caspio table still wins — widening needs no deploy', () => {
    test('a role row lets the accountant back into Payables', () => {
        const rule = { Allowed_Roles: 'accountant' };
        expect(userMayAccessPage(ACCOUNTANT, rule, 'sanmar-payables.html')).toBe(true);
        expect(userMayAccessPage(SALES, rule, 'sanmar-payables.html')).toBe(false);
        expect(userMayAccessPage(ADMIN, rule, 'sanmar-payables.html')).toBe(true);
    });

    test('a role+email row admits either match', () => {
        const rule = { Allowed_Roles: 'accountant', Allowed_Emails: 'nika@nwcustomapparel.com' };
        expect(userMayAccessPage(ACCOUNTANT, rule, 'commission-structure.html')).toBe(true);
        expect(userMayAccessPage(SALES, rule, 'commission-structure.html')).toBe(true);
        expect(userMayAccessPage(BASIC, rule, 'commission-structure.html')).toBe(false);
    });

    test('whitespace and casing in the row are tolerated', () => {
        const rule = { Allowed_Roles: ' Accountant , Shipping ' };
        expect(userMayAccessPage(ACCOUNTANT, rule, 'sanmar-payables.html')).toBe(true);
    });
});

describe('an exclusive email allowlist still outranks admin', () => {
    // This is what keeps payroll.html Erik-only even though others hold 'admin'.
    const erikOnly = { Allowed_Emails: 'erik@nwcustomapparel.com' };
    const otherAdmin = { email: 'jim@nwcustomapparel.com', permissions: ['admin'] };

    test('only the named person gets in', () => {
        expect(userMayAccessPage(ADMIN, erikOnly, 'payroll.html')).toBe(true);
        expect(userMayAccessPage(otherAdmin, erikOnly, 'payroll.html')).toBe(false);
        expect(userMayAccessPage(ACCOUNTANT, erikOnly, 'payroll.html')).toBe(false);
    });

    test('adding a role to the row turns it back into a normal (admin-overridable) rule', () => {
        const withRole = { Allowed_Emails: 'erik@nwcustomapparel.com', Allowed_Roles: 'accountant' };
        expect(userMayAccessPage(otherAdmin, withRole, 'payroll.html')).toBe(true);
    });
});

describe('no page in the admin set is reachable without a permission', () => {
    test('a session with no permissions at all is denied every admin page', () => {
        const noPerms = { email: 'x@nwcustomapparel.com' }; // permissions undefined
        for (const page of ADMIN_DEFAULT_PAGES) {
            expect(userMayAccessPage(noPerms, undefined, page)).toBe(false);
        }
    });
});

describe('drift lock — the list mirrors the Administration menu', () => {
    // The menu and the gate are edited in different files; this is what stops a new
    // admin page from landing in the sidebar with no access rule behind it.
    const html = fs.readFileSync(
        path.join(__dirname, '..', '..', 'staff-dashboard-v3', 'index.html'), 'utf8');

    const adminSection = html.slice(
        html.indexOf('data-section="admin"'),
        html.indexOf('</aside>'));

    const menuPages = [...adminSection.matchAll(/href="([^"]+\.html)"/g)]
        .map((m) => m[1].split('/').pop().toLowerCase());

    test('the Administration menu was found and is non-trivial', () => {
        expect(menuPages.length).toBeGreaterThan(10);
    });

    test('every page in the menu defaults to admin-only', () => {
        const unguarded = menuPages.filter((p) => !ADMIN_DEFAULT_PAGES.has(p));
        expect(unguarded).toEqual([]);
    });

    test('every page in the list is still reachable from the menu (no stale entries)', () => {
        const orphaned = [...ADMIN_DEFAULT_PAGES].filter((p) => !menuPages.includes(p));
        expect(orphaned).toEqual([]);
    });
});
