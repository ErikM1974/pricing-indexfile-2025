/**
 * Monogram Dashboard + Names & Numbers Dashboard — 2026-09-05 review locks.
 *   Monogram: 5 inline onkeyup/onchange= handlers gone (Rule 3); labels wired with for=; date filter
 *   compares LOCAL calendar days (was toISOString → UTC, so evening orders landed on the next day);
 *   HTTP status checked before .json(); load error shows the reason + Retry; icon-only actions named;
 *   type=button everywhere; contact bar no longer shows a foreign email; toasts announce.
 *   Names & Numbers: KPI tiles are status filters (aria-pressed, synced with the select); filter as
 *   you type; rows keyboard-openable; load error has Retry; edit/delete named per roster; no inline style.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('monogram dashboard', () => {
    const html = read('dashboards/monogram-dashboard.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('shared_components/js/monogram-dashboard.js');
    const css = read('shared_components/css/personalization-workspaces.css') + read('shared_components/css/components.css');
    test('Rule 3 + labels + names', () => {
        expect(html).not.toMatch(/\son(click|change|keyup|input)=/);
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).not.toMatch(/prior2\.com/);
        expect(html).not.toMatch(/<button class=/);
        for (const id of ['searchInput', 'salesRepFilter', 'statusFilter', 'dateFrom', 'dateTo']) {
            expect(html).toMatch(new RegExp(`<label for="${id}">`));
        }
        expect(html).toMatch(/id="resultCount" role="status"/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\./);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).toMatch(/aria-label="Delete order \$\{orderNum\}"/);
        expect(js).toMatch(/aria-label="Mark order \$\{orderNum\} as printed"/);
        expect(css).toMatch(/:where\(\[data-ui="unified"\]\) \[hidden\]\s*\{\s*display: none;/);
    });
    test('listeners, local-day date filter, honest failures', () => {
        expect(js).toMatch(/search\.addEventListener\('input'/);
        expect(js).toMatch(/\['salesRepFilter', 'statusFilter', 'dateFrom', 'dateTo'\]\.forEach/);
        expect(js).toMatch(/function localYmd\(value\)/);
        expect(js).not.toMatch(/toISOString\(\)\.split\('T'\)/);
        expect(js).toMatch(/const monogramDate = localYmd\(m\.CreatedAt\);/);
        expect((js.match(/if \(!response\.ok\) throw new Error\('HTTP ' \+ response\.status\);/g) || []).length).toBe(3);
        expect(js).toMatch(/Unable to load monograms \(\$\{escapeHTML\(error\.message \|\| 'request failed'\)\}\)/);
        expect(js).toMatch(/showToast\('Failed to delete monogram: ' \+/);
        expect(js).toMatch(/toast\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\);/);
    });
});

describe('names & numbers dashboard', () => {
    const html = read('dashboards/names-numbers-dashboard.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('shared_components/js/names-numbers-dashboard.js');
    const css = read('shared_components/css/personalization-workspaces.css') + read('shared_components/css/components.css');
    test('KPI tiles filter; labels; no inline style; icons decorative', () => {
        expect((html.match(/class="kpi-card kpi-btn" data-status="[^"]*" aria-pressed="(true|false)"/g) || []).length).toBe(5);
        expect(html).toMatch(/data-status="" aria-pressed="true"/);
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        for (const id of ['filterSearch', 'filterStatus', 'filterRep']) expect(html).toMatch(new RegExp(`<label for="${id}">`));
        expect(html).toMatch(/id="toast" role="status" aria-live="polite"/);
        expect(html).toMatch(/id="nnResultCount" role="status"/);
        expect(css).toMatch(/:where\(\[data-ui="unified"\]\) \[hidden\]\s*\{\s*display: none;/);
        expect(css).toMatch(/\.kpi-card\[aria-pressed="true"\]/);
    });
    test('behaviour: live filters, KPI sync, keyboard rows, Retry, names', () => {
        expect(js).toMatch(/syncKpis\(\) \{/);
        expect(js).toMatch(/sel\.value = \(sel\.value === status\) \? '' : status;/);
        expect(js).toMatch(/\['filterSearch', 'filterRep'\]\.forEach/);
        expect(js).toMatch(/role="link" tabindex="0" aria-label="Open roster \$\{name\}"/);
        expect(js).toMatch(/const row = e\.target\.closest\('tr\[data-href\]'\);/);
        expect(js).toMatch(/data-call="dashboard\.loadAll">Retry<\/button>/);
        expect(js).toMatch(/aria-label="Edit roster \$\{name\}"/);
        expect(js).toMatch(/aria-label="Delete roster \$\{name\}"/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).toMatch(/\$\{this\.esc\(String\(r\.OrderNumber \|\| '-'\)\)\}/);
    });
});
