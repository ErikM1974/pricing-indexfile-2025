/**
 * @jest-environment jsdom
 *
 * Quote Management (dashboards/quote-management.html) — locks from the 2026-09-05 review.
 *
 *   1. Identity comes from the SAML session (/api/crm-session/me), never only the
 *      legacy Caspio sessionStorage — that left everyone "Guest" with deletes disabled.
 *   2. Rule 3: no onclick= / style= attributes in the page or the row templates;
 *      one data-action delegator; no browser alert/confirm/prompt.
 *   3. The window is asked of the server (createdAfter); a fruitless search widens once.
 *   4. Stat tiles filter; Pipeline Value excludes lost/expired/cancelled; real ARIA tabs;
 *      loaded-time stamp + 5-minute visible-tab refresh; phone columns hidden.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/quote-management.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const js = read('dashboards/js/quote-management.js');
const css = read('dashboards/css/quote-management.css');
const code = js.replace(/\/\/[^\n]*/g, ''); // strip line comments (they may NAME the old patterns)

describe('identity', () => {
    test('reads /api/crm-session/me first and treats admin as master', () => {
        expect(js).toMatch(/async function initIdentity/);
        expect(js).toMatch(/fetch\('\/api\/crm-session\/me'/);
        expect(js).toMatch(/currentUserRole === 'admin'/);
        expect(js).not.toMatch(/textContent = name \|\| 'Guest'/);
        expect(js).not.toMatch(/function establishCrmSession/);
    });
});

describe('Rule 3 — no inline code', () => {
    test('the page has no onclick= or style= attributes and no inline script', () => {
        const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/\sonclick=/);
        expect(stripped).not.toMatch(/\sstyle="/);
        expect(stripped).not.toMatch(/<style[\s>]/i);
        const bodies = [...stripped.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
        expect(bodies).toEqual([]);
    });
    test('the row templates carry no onclick= or style= either; one delegator handles data-action', () => {
        expect(code).not.toMatch(/onclick="/);
        expect(code).not.toMatch(/style="/);
        expect(code).not.toMatch(/\.style\.(display|cssText)/);
        expect(js).toMatch(/function onDelegatedClick/);
        for (const a of ['view', 'edit', 'copy-link', 'duplicate', 'resend', 'audit', 'shipstation', 'delete', 'tab', 'sync-sw', 'refresh-inbound', 'bulk-delete', 'prev-page', 'next-page']) {
            expect(js).toContain(`case '${a}':`);
        }
    });
    test('no browser alert / confirm / prompt, no debug console.log', () => {
        expect(code).not.toMatch(/\balert\(/);
        expect(code).not.toMatch(/\bconfirm\(/);
        expect(code).not.toMatch(/\bprompt\(/);
        expect(code).not.toMatch(/console\.log\(/);
        expect(doc.getElementById('qm-modal')).not.toBeNull();
        expect(js).toMatch(/function openModal/);
    });
});

describe('server window + search', () => {
    test('the load asks the server for the window and never the whole table by default', () => {
        expect(js).toMatch(/\?createdAfter=\$\{ymdDaysAgo/);
        expect(js).toMatch(/function ymdDaysAgo/);
        expect(js).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
    });
    test('a fruitless search widens to All Time once and says so', () => {
        expect(js).toMatch(/searchWidened = true;\s*loadQuotes\(\{ all: true \}\)/);
        expect(doc.getElementById('qm-notice')).not.toBeNull();
    });
});

describe('tiles, pipeline, tabs, freshness, phone', () => {
    test('stat tiles are buttons that filter', () => {
        const tiles = [...doc.querySelectorAll('button.stat-card[data-tile]')].map((b) => b.dataset.tile);
        expect(tiles).toEqual(['active', 'accepted', 'expiring', 'cancelled', 'failed']);
        expect(js).toMatch(/const TILE_MATCH = \{/);
        expect(css).toContain('button.stat-card.is-active');
    });
    test('Pipeline Value excludes lost, expired and cancelled', () => {
        expect(doc.querySelector('.stat-card.total .stat-label').textContent).toBe('Pipeline Value');
        expect(js).toMatch(/if \(!isCompletedQuote\(quote\)\) totalValue \+= getEffectiveAmount\(quote\);/);
        expect(js).not.toMatch(/\}\);\s*\n\s*totalValue \+= getEffectiveAmount\(quote\);\s*\n\s*\}\);/);
    });
    test('tabs are real ARIA tabs with arrow keys', () => {
        const tabs = [...doc.querySelectorAll('.qm-tab')];
        expect(tabs.every((t) => t.getAttribute('role') === 'tab')).toBe(true);
        expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true').length).toBe(1);
        expect(js).toMatch(/function initTabs/);
        expect(js).toMatch(/ArrowRight/);
    });
    test('loaded stamp + 5-minute visible-tab refresh', () => {
        expect(doc.getElementById('qm-updated')).not.toBeNull();
        expect(js).toMatch(/REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/);
        expect(js).toMatch(/document\.visibilityState === 'visible'/);
        expect(js).toMatch(/function stampLoaded/);
    });
    test('phone: header wraps, low-value columns hide, actions stay on one line', () => {
        expect(css).toMatch(/\.qm-col-phone-hide \{ display: none; \}/);
        expect(css).toMatch(/td\.actions-cell \{ white-space: nowrap; \}/);
        expect(doc.querySelectorAll('th.qm-col-phone-hide').length).toBe(5); // salesperson, items, progress, inbound, created
        expect(doc.querySelector('.quotes-table-scroll')).not.toBeNull();
    });
    test('housekeeping: shared Font Awesome build, site favicon', () => {
        expect(html).toMatch(/font-awesome\/6\.4\.0\//);
        expect(doc.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/favicon.png');
    });
});
