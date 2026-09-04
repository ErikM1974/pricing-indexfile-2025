/**
 * @jest-environment jsdom
 *
 * Past Due Orders (dashboards/past-due-orders.html) — locks from the 2026-09-04 review.
 *
 *   1. Rule 3 (no inline code) and the shell's ids the controller drives.
 *   2. Honest states: a failed load empties the board and says so; print is guarded.
 *   3. The board is actionable: rep headings link to account pages, "no PO raised"
 *      links to the Purchase Request form, vendor and value are on screen.
 *   4. Freshness: a loaded-time stamp, a 5-minute visible-tab refresh, a summary line.
 *   5. Phone: the header controls wrap instead of scrolling the page sideways.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/past-due-orders.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const js = read('dashboards/js/past-due-orders.js');
const css = read('dashboards/css/past-due-orders.css');

describe('Rule 3 + shell ids', () => {
    test('no inline code', () => {
        const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/<style[\s>]/i);
        expect(stripped).not.toMatch(/\sstyle="/);
        expect(stripped).not.toMatch(/\sonclick=/);
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
    test('the ids the controller writes exist', () => {
        for (const id of ['stat-late', 'stat-risk', 'stat-nopo', 'stat-ontrack',
            'stat-late-val', 'stat-risk-val', 'stat-nopo-val', 'stat-ontrack-val',
            'pdo-asof', 'pdo-summary', 'content-root', 'pdo-days', 'pdo-refresh', 'pdo-print', 'pdo-print-who']) {
            expect(doc.getElementById(id)).not.toBeNull();
        }
    });
    test('the site favicon, not the old Caspio CDN icon', () => {
        expect(doc.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/favicon.png');
    });
    test('the no-PO tile says what it counts', () => {
        expect(doc.querySelector('#stat-nopo').parentElement.textContent).toMatch(/Past due, no PO raised/);
    });
});

describe('honest states', () => {
    test('a failed load empties the board, the stats and the print data', () => {
        expect(js).toMatch(/nothing is shown rather than something wrong/);
        expect(js).toMatch(/setStats\(null\)/);
        expect(js).toMatch(/lastData = null;/);
    });
    test('printing re-pulls stale data and refuses to print without data', () => {
        expect(js).toMatch(/PRINT_FRESH_MS/);
        expect(js).toMatch(/if \(!lastData\)/);
        expect(js).toMatch(/addEventListener\('beforeprint'/);
    });
    test('the same-origin forwarder, never the proxy base', () => {
        expect(js).toMatch(/\/api\/crm-proxy\/ae-dashboard\/due-dates-all/);
        expect(js).toMatch(/credentials: 'same-origin'/);
        expect(js).not.toMatch(/DashPage\.fetchJson\(/); // the comment may NAME it; the code must not call it
    });
});

describe('an actionable board', () => {
    test('rep headings link to the account pages', () => {
        expect(js).toMatch(/'Nika Lao':\s+'\/dashboards\/nika-crm\.html'/);
        expect(js).toMatch(/'Taneisha Clark':\s+'\/dashboards\/taneisha-crm\.html'/);
        expect(js).toMatch(/'House':\s+'\/dashboards\/house-accounts\.html'/);
        expect(js).toMatch(/class="pdo-rep-link"/);
        expect(css).toContain('.pdo-rep-link');
    });
    test('"no PO raised" links to the Purchase Request form', () => {
        expect(js).toMatch(/PURCHASE_REQUEST_URL = '\/calculators\/purchasingform\.html'/);
        expect(js).toMatch(/class="pdo-nopo-link"/);
        expect(fs.existsSync(path.join(ROOT, 'calculators/purchasingform.html'))).toBe(true);
    });
    test('vendor, value dash, per-rep totals and the honest column header', () => {
        expect(js).toMatch(/class="pdo-vendor"/);
        expect(js).toMatch(/function moneyCell/);
        expect(js).toMatch(/pdo-rep-total/);
        expect(js).toMatch(/Late · Due in/);
        expect(js).toMatch(/stat-late-val/);
    });
});

describe('freshness', () => {
    test('loaded-time stamp, summary line, visible-tab refresh', () => {
        expect(js).toMatch(/loaded ' \+ clockTime\(\)/);
        expect(js).toMatch(/on the board/);
        expect(js).toMatch(/REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/);
        expect(js).toMatch(/document\.visibilityState === 'visible'/);
    });
});

describe('phone', () => {
    test('the header controls wrap on narrow screens', () => {
        expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.dash-header-right[\s\S]*flex-wrap: wrap/);
    });
});
