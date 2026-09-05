/**
 * Customer Portals admin console — structural locks from the 2026-09-05 review.
 *   1. Rule 3: no inline style= (page or templates), no .style.display toggles; `hidden` + the page
 *      CSS's own [hidden] rule (the modal overlay is display:flex and would otherwise ignore it).
 *   2. Tabs are a real tablist (role/aria-selected/aria-controls, arrow keys); "My customers" and the
 *      Rewards sort are pressed-state buttons; the New badge is hidden when zero.
 *   3. Every icon-only action button has an aria-label naming the customer; icons are aria-hidden.
 *   4. Both modals open/close with `hidden`, restore focus, and close on Esc; the CRM lookup is a
 *      combobox with ArrowDown/Up/Enter over role=option results.
 *   5. Failed loads offer Retry; a delete toasts the OUTCOME, not a success before the request.
 *   6. Customer sign-ins stamp LastLogin (server calls the proxy's touch-login) — the console's
 *      "Have Signed In" / "Last Sign-In" had been 0 / Never for every customer since launch.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/customer-portal-admin.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/customer-portal-admin.js');
const css = read('dashboards/css/customer-portal-admin.css');
const server = read('server.js');

describe('customer portal admin — Rule 3 + hidden', () => {
    test('no inline style=, no style.display, no inline handlers', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(html).not.toMatch(/<script>[\s\S]*?\S[\s\S]*?<\/script>/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).not.toMatch(/onclick="/);
    });
    test('[hidden] rule is declared before the display:flex overlay and inline-flex buttons', () => {
        const idx = css.indexOf('[hidden] { display: none !important; }');
        expect(idx).toBeGreaterThan(-1);
        expect(css.indexOf('.cpa-modal-overlay {')).toBeGreaterThan(idx);
        expect(css.indexOf('.cpa-btn {')).toBeGreaterThan(idx);
    });
    test('panels, badge, modals and rep filters start hidden via the attribute', () => {
        expect(html).toMatch(/id="cpa-req-badge" hidden/);
        expect(html).toMatch(/id="cpa-mine-btn" hidden aria-pressed="false"/);
        expect(html).toMatch(/id="cpa-req-mine-btn" hidden aria-pressed="false"/);
        expect(html).toMatch(/id="cpa-view-requests" role="tabpanel" aria-labelledby="cpa-tab-requests" hidden/);
        expect(html).toMatch(/id="cpa-modal" hidden/);
        expect(html).toMatch(/id="cpa-rewards-modal" hidden/);
    });
});

describe('customer portal admin — tabs, filters, sort', () => {
    test('tablist semantics + arrow keys + title per tab', () => {
        expect(html).toMatch(/<div class="cpa-tabs" role="tablist"/);
        expect((html.match(/role="tab" id="cpa-tab-[a-z]+" aria-selected="(true|false)" aria-controls="cpa-view-[a-z]+"/g) || []).length).toBe(2);
        expect(html).toMatch(/id="cpa-view-access" role="tabpanel" aria-labelledby="cpa-tab-access"/);
        expect(js).toMatch(/b\.setAttribute\('aria-selected', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft'/);
        expect(js).toMatch(/document\.title = \(isReq \? 'Re-order Requests' : 'Portal Access'\)/);
    });
    test('pressed-state buttons and a hidden-when-zero badge', () => {
        expect(js).toMatch(/this\.setAttribute\('aria-pressed', myOnly \? 'true' : 'false'\)/);
        expect(js).toMatch(/this\.setAttribute\('aria-pressed', reqMyOnly \? 'true' : 'false'\)/);
        expect(js).toMatch(/aria-pressed="' \+ \(sortByRewards \? 'true' : 'false'\) \+ '"/);
        expect(js).toMatch(/b\.hidden = open <= 0;/);
    });
    test('empty-state copy explains the My customers filter', () => {
        expect(js).toMatch(/None of the invited customers are on your accounts\./);
    });
});

describe('customer portal admin — accessible names', () => {
    test('every icon-only row action names its customer', () => {
        for (const re of [
            /aria-label="Preview portal for ' \+ esc\(r\.company_name\) \+ '"/,
            /aria-label="Reward dollars for ' \+ esc\(r\.company_name\) \+ '"/,
            /aria-label="Email a login link to ' \+ esc\(r\.email\) \+ '"/,
            /aria-label="' \+ toggleLabel \+ ' access for ' \+ esc\(r\.email\) \+ '"/,
            /aria-label="Remove access for ' \+ esc\(r\.email\) \+ '"/,
            /aria-label="Delete request from ' \+ esc\(r\.Company_Name \|\| r\.Email\) \+ '"/,
            /aria-label="Status for ' \+ esc\(r\.Company_Name \|\| r\.Email\) \+ '"/,
        ]) expect(js).toMatch(re);
    });
    test('icons are decorative; toast is a status region; modal errors are alerts', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).toMatch(/id="cpa-toast" role="status" aria-live="polite"/);
        expect(html).toMatch(/id="cpa-modal-error" role="alert"/);
        expect(html).toMatch(/id="cpa-rw-error" role="alert"/);
        expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="cpa-rw-title"/);
    });
});

describe('customer portal admin — modals and lookup', () => {
    test('both modals toggle with hidden, restore focus, and close on Esc', () => {
        expect(js).toMatch(/lastFocus = document\.activeElement;\s*document\.getElementById\('cpa-modal'\)\.hidden = false;/);
        expect(js).toMatch(/rwLastFocus = document\.activeElement;\s*document\.getElementById\('cpa-rewards-modal'\)\.hidden = false;/);
        expect(js).toMatch(/if \(lastFocus && lastFocus\.focus\) lastFocus\.focus\(\);/);
        expect(js).toMatch(/if \(rwLastFocus && rwLastFocus\.focus\) rwLastFocus\.focus\(\);/);
        expect(js).toMatch(/if \(!document\.getElementById\('cpa-rewards-modal'\)\.hidden\) closeRewardsModal\(\);\s*else closeModal\(\);/);
    });
    test('the CRM lookup is a combobox with keyboard navigation', () => {
        expect(html).toMatch(/id="cpa-lookup"[^>]*role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="cpa-lookup-results"/);
        expect(html).toMatch(/<label class="cpa-field-label" for="cpa-lookup">/);
        expect(html).toMatch(/id="cpa-lookup-results" role="listbox"/);
        expect(html).not.toMatch(/<label class="cpa-field" id="cpa-lookup-field">/);
        expect(js).toMatch(/role="option" aria-selected="false" id="cpa-lookup-opt-' \+ i \+ '" tabindex="-1"/);
        expect(js).toMatch(/function setLookupActive\(idx\)/);
        expect(js).toMatch(/inp\.setAttribute\('aria-activedescendant', it\.id\)/);
        expect(js).toMatch(/if \(it\) \{ e\.preventDefault\(\); onLookupPick\(\{ target: it \}\); \}/);
    });
});

describe('customer portal admin — honest outcomes', () => {
    test('failed loads offer Retry wired through the delegated click handlers', () => {
        expect(js).toMatch(/id="cpa-retry-invites"/);
        expect(js).toMatch(/if \(e\.target\.closest\('#cpa-retry-invites'\)\) \{ loadInvites\(\); return; \}/);
        expect(js).toMatch(/id="cpa-retry-requests"/);
        expect(js).toMatch(/if \(e\.target\.closest\('#cpa-retry-requests'\)\) \{ loadRequests\(\); return; \}/);
    });
    test('delete toasts progress first and success only after the DELETE returns', () => {
        expect(js).toMatch(/toast\('Removing access for ' \+ demail \+ '…'\);\s*try \{\s*await api\(ACCESS_API \+ '\/' \+ encodeURIComponent\(dpk\), \{ method: 'DELETE' \}\);\s*toast\('Access removed for ' \+ demail\);/);
    });
    test('customer sign-in stamps LastLogin through the proxy (fire-and-forget)', () => {
        expect(server).toMatch(/fetch\(`\$\{CRM_API_BASE\}\/api\/customer-portal-access\/touch-login`, \{[\s\S]*?body: JSON\.stringify\(\{ email: claim\.email \}\),[\s\S]*?\}\)\.catch\(\(e\) => console\.warn\('\[customer-login\] touch-login failed:'/);
        // The call sits inside the customer verify route, after the cookie is set and before the redirect.
        const verify = server.slice(server.indexOf("app.get('/auth/customer/verify'"), server.indexOf("app.get('/auth/customer/logout'"));
        expect(verify).toMatch(/res\.cookie\('nwca_customer'[\s\S]*customer-portal-access\/touch-login[\s\S]*safeLoginNext\(req\.query\.next, '\/portal'\)/);
    });
    test('the sibling proxy exposes the touch-login route (skipped when the sibling repo is absent)', () => {
        const rel = path.join(ROOT, '..', 'caspio-pricing-proxy', 'src', 'routes', 'customer-portal-access.js');
        if (!fs.existsSync(rel)) return;
        const proxy = fs.readFileSync(rel, 'utf8');
        expect(proxy).toMatch(/router\.post\('\/touch-login', express\.json\(\), async \(req, res\) => \{[\s\S]*?\{ LastLogin: new Date\(\)\.toISOString\(\) \}/);
    });
});
