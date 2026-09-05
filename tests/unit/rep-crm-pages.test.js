/**
 * Rep Account CRM pages (Nika + Taneisha, shared rep-crm.js/.css) — 2026-09-05 review locks.
 *   1. Rule 3: no inline style= in either page or in templates (the health gauge passes a CSS custom
 *      property only), no .style.display toggles; the page CSS declares [hidden].
 *   2. The Accounts header count is set on boot (it read "0 accounts" beside 474 cards).
 *   3. Calendar dates are parsed as LOCAL days — a follow-up due today no longer shows "Overdue".
 *   4. Tier cards are <button>s with aria-pressed; product toggles and At Risk carry aria-pressed;
 *      account cards are keyboard-openable; the detail modal is a labelled dialog that returns focus.
 *   5. Failures are retryable (banner Retry); the archive fallback is announced, never silent;
 *      alert() is gone.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const pages = [['nika', read('dashboards/nika-crm.html')], ['taneisha', read('dashboards/taneisha-crm.html')]].map(([n, h]) => [n, h.replace(/<!--[\s\S]*?-->/g, '')]);
const js = read('dashboards/js/rep-crm.js');
const css = read('dashboards/css/rep-crm.css');

describe.each(pages)('%s CRM page', (_name, html) => {
    test('Rule 3: no inline style / handlers; icons decorative; versioned assets', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).toMatch(/rep-crm\.css\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/rep-crm\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
    test('hidden panels, labelled filters, pressed-state controls', () => {
        expect(html).toMatch(/id="userWelcome" hidden/);
        expect(html).toMatch(/id="empty-state" role="status" hidden/);
        expect(html).toMatch(/id="sync-status" role="status" hidden/);
        expect(html).toMatch(/<div class="crm-layout crm-layout--single">/);
        for (const id of ['filter-search', 'filter-tier', 'filter-priority', 'filter-month', 'filter-trend']) expect(html).toMatch(new RegExp(`<label for="${id}">`));
        expect(html).toMatch(/<div class="product-toggles" role="group" aria-labelledby="products-label">/);
        expect((html.match(/type="button" class="product-toggle" data-product="[A-Za-z]+" aria-pressed="false"/g) || []).length).toBe(3);
        expect((html.match(/<button type="button" class="tier-card [a-z-]+" aria-pressed="false"/g) || []).length).toBe(5);
        expect(html).not.toMatch(/<div class="tier-card/);
        expect(html).toMatch(/id="header-at-risk" aria-pressed="false"/);
    });
    test('error banner has Retry; modal is a labelled dialog', () => {
        expect(html).toMatch(/id="error-retry" data-call="crmController.retryLoad" hidden/);
        expect(html).toMatch(/<div class="account-detail-modal" role="dialog" aria-modal="true" aria-labelledby="account-detail-company">/);
    });
});

describe('rep-crm.js', () => {
    test('no style toggles, no alert(), gauge uses a custom property', () => {
        expect(js).not.toMatch(/\.style\.(display|cssText)/);
        expect(js).not.toMatch(/\balert\(/);
        expect(js).not.toMatch(/style="(?!--fill)/);
        expect(js).toMatch(/style="--fill: \$\{healthScore\}%"/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
    });
    test('boot sets the accounts count and the banner Retry re-runs the load', () => {
        expect(js).toMatch(/async retryLoad\(\) \{[\s\S]*?this\.updateAccountsCount\(\);/);
        expect(js).toMatch(/await this\.retryLoad\(\);/);
        expect(js).toMatch(/this\.showError\('Unable to load accounts \(' \+ [^;]+, true\);/);
        expect(js).toMatch(/showError\(message, retryable\)[\s\S]*?this\.elements\.errorRetry\.hidden = !retryable;/);
    });
    test('archive fallback is announced, never silent', () => {
        expect(js).toMatch(/this\.archiveFailed = true;/);
        expect(js).toMatch(/Per-rep archive unavailable — Total YTD is the sum of the account cards/);
    });
    test('calendar dates parse as local days', () => {
        expect(js).toMatch(/static parseCalendarDate\(value\)/);
        expect(js).toMatch(/const followUpDate = RepCRMController\.parseCalendarDate\(account\.Next_Follow_Up\);/);
        expect(js).toMatch(/const date = RepCRMController\.parseCalendarDate\(dateStr\);/);
        // eslint-disable-next-line no-new-func
        const fn = new Function('return ' + js.match(/static parseCalendarDate\(value\) \{[\s\S]*?\n    \}/)[0].replace('static ', 'function '))();
        expect(fn('2026-09-05').getDate()).toBe(5);
        expect(fn('2026-09-05').getHours()).toBe(0);
        expect(fn('2026-09-05T00:00:00').getDate()).toBe(5);
        expect(fn('2026-09-05T00:00:00.000Z').getDate()).toBe(5);
        expect(fn('')).toBeNull();
        expect(fn('garbage')).toBeNull();
    });
    test('pressed state stays in sync; cards are keyboard-openable; modal returns focus', () => {
        expect(js).toMatch(/toggle\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/card\.setAttribute\('aria-pressed', 'false'\)/);
        expect(js).toMatch(/activeCard\.setAttribute\('aria-pressed', 'true'\)/);
        expect(js).toMatch(/headerAtRisk\?\.setAttribute\('aria-pressed'/);
        expect(js).toMatch(/role="button" tabindex="0" aria-label="Open \$\{this\.escapeHtml\(account\.CompanyName \|\| 'account'\)\}"/);
        expect(js).toMatch(/if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); open\(\); \}/);
        expect(js).toMatch(/this\._modalReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/if \(back && document\.body\.contains\(back\) && typeof back\.focus === 'function'\) back\.focus\(\);/);
    });
});

describe('rep-crm.css', () => {
    test('[hidden] rule, button-reset for tier cards, focus rings, single-column layout', () => {
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(css).toMatch(/\.tier-card \{ font: inherit; color: inherit; width: 100%; display: block; \}/);
        expect(css).toMatch(/\.tier-card\[aria-pressed="true"\]/);
        expect(css).toMatch(/\.account-card:focus-visible/);
        expect(css).toMatch(/\.crm-layout--single \{ grid-template-columns: 1fr; \}/);
        expect(css).toMatch(/\.health-gauge-fill \{ width: var\(--fill, 0%\); \}/);
    });
});
