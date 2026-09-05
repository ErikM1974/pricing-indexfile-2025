/**
 * @jest-environment jsdom
 *
 * Purchasing Portal (dashboards/purchasing-portal.html) — locks from the 2026-09-05 review.
 *
 *   1. Rule 3, the ids the controller writes, the site favicon.
 *   2. Honesty: the feed's `truncated` count is shown; a failed load clears the stats
 *      and the table; the Refresh button passes ?refresh=1 through the forwarder.
 *   3. Workable: open work by default with a finished toggle; tiles filter; every
 *      row links to its JotForm submission; invoice buttons carry aria-labels;
 *      vendors are cleaned; a request→PO turnaround tile computed from rows.
 *   4. Phone: low-value columns hidden under 640px; 5-minute visible-tab refresh.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/purchasing-portal.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const js = read('dashboards/js/purchasing-portal.js');
const css = read('dashboards/css/purchasing-portal.css');
const serverSrc = read('server.js');

describe('Rule 3 + shell', () => {
    test('no inline code', () => {
        const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/<style[\s>]/i);
        expect(stripped).not.toMatch(/\sstyle="/);
        expect(stripped).not.toMatch(/\sonclick=/);
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
    test('the ids the controller writes exist', () => {
        for (const id of ['pp-stat-total', 'pp-stat-sent', 'pp-stat-ordered', 'pp-stat-received', 'pp-stat-done',
            'pp-stat-turnaround', 'pp-stat-turnaround-sub', 'pp-stat-ordered-sub', 'pp-updated', 'pp-trunc',
            'pp-show-finished', 'pp-finished-n', 'pp-shown', 'pp-search', 'pp-filter-rep', 'pp-filter-status', 'pp-tbody', 'pp-refresh']) {
            expect(doc.getElementById(id)).not.toBeNull();
        }
    });
    test('the site favicon', () => {
        expect(doc.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/favicon.png');
    });
});

describe('honesty', () => {
    test('the truncated count is rendered, never ignored', () => {
        expect(js).toMatch(/function renderTruncation/);
        expect(js).toMatch(/data\.truncated/);
        expect(doc.getElementById('pp-trunc').hasAttribute('hidden')).toBe(true);
    });
    test('a failed load clears the stats and the previous rows', () => {
        expect(js).toMatch(/state\.rows = \[\];\s*state\.data = null;\s*renderStats\(null\)/);
    });
    test('Refresh bypasses the cache end to end', () => {
        expect(js).toMatch(/load\(true\)/);
        expect(js).toMatch(/\?refresh=1/);
        expect(serverSrc).toMatch(/purchasing-all\$\{refresh\}/);
        const proxy = fs.readFileSync(path.join(ROOT, '..', 'caspio-pricing-proxy', 'src', 'routes', 'ae-dashboard.js'), 'utf8');
        expect(proxy).toMatch(/router\.get\('\/purchasing-all'[\s\S]{0,600}req\.query\.refresh === '1'/);
    });
});

describe('workable', () => {
    test('open work by default, with a finished toggle', () => {
        expect(doc.getElementById('pp-show-finished').hasAttribute('checked')).toBe(false);
        expect(js).toMatch(/FINISHED = \{ invoiced: true, shipped: true \}/);
        expect(js).toMatch(/if \(!showFinished && FINISHED\[r\.status\]\) return false;/);
    });
    test('the stat tiles are buttons that filter', () => {
        const tiles = [...doc.querySelectorAll('button.pp-tile[data-filter]')];
        expect(tiles.map((t) => t.getAttribute('data-filter'))).toEqual(['', 'sent', 'ordered', 'received', 'done']);
        expect(js).toMatch(/function applyTile/);
        expect(css).toContain('button.pp-tile.is-active');
    });
    test('rows link to their JotForm submission and invoice buttons are labelled', () => {
        expect(js).toMatch(/https:\/\/www\.jotform\.com\/submission\//);
        expect(js).toMatch(/class="pp-req-link"/);
        expect(js).toMatch(/aria-label="View the SanMar invoice for work order/);
    });
    test('vendors are trimmed and de-duplicated', () => {
        expect(js).toMatch(/function cleanVendors/);
        expect(js).toMatch(/replace\(\/\\s\+\/g, ' '\)\.trim\(\)/);
    });
    test('turnaround tile is computed from the rows, not typed', () => {
        expect(js).toMatch(/function renderTurnaround/);
        expect(js).toMatch(/ordered the same day/);
        expect(html).not.toMatch(/1\.2 h/);
    });
    test('status chips use the state tokens, not hex', () => {
        const chips = css.slice(css.indexOf('2026-09-05 review additions'));
        expect(chips).toMatch(/\.pp-chip--ordered\s*\{[^}]*var\(--state-info/);
        expect(chips).not.toMatch(/\.pp-chip--[a-z]+\s*\{[^}]*#[0-9a-f]{6}[^}]*color: #0a4fb5/i);
    });
});

describe('phone + freshness', () => {
    test('low-value columns hide under 640px', () => {
        expect(doc.querySelectorAll('th.pp-col-phone-hide').length).toBe(4);
        expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.pp-col-phone-hide \{ display: none; \}/);
    });
    test('5-minute refresh while visible, loaded-time stamp', () => {
        expect(js).toMatch(/REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/);
        expect(js).toMatch(/document\.visibilityState === 'visible'/);
        expect(js).toMatch(/'loaded ' \+ clockTime\(\)/);
    });
});
