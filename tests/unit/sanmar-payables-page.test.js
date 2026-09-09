/**
 * SanMar Payables — 2026-09-05 review locks.
 *   Default date range + the import-stamp date used toISOString() (UTC → a day ahead every evening);
 *   the imported cross-reference failing was silent (every row then read NOT IMPORTED as if fresh work);
 *   load failures said "refresh to retry"; tabs had role=tab but no aria-selected/controls; 32 bare
 *   icons; stat tiles were static. The shared invoice viewer titled itself "WO #undefined" when opened
 *   by PO and had no focus handling.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;

const html = read('dashboards/sanmar-payables.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/sanmar-payables.js');
const viewer = read('shared_components/js/sanmar-invoice-viewer.js');
const css = read('shared_components/css/purchasing-workspaces.css');

describe('sanmar payables — structure', () => {
    test('tabs, panels, tiles, statuses, icons, versions', () => {
        expect(html).toMatch(/id="smp-tab-invoices" data-tab="invoices" role="tab" aria-selected="true" aria-controls="smp-panel-invoices"/);
        expect(html).toMatch(/id="smp-tab-marketing" data-tab="marketing" role="tab" aria-selected="false" tabindex="-1" aria-controls="smp-panel-marketing"/);
        expect(html).toMatch(/id="smp-panel-invoices" class="smp-panel" role="tabpanel" aria-labelledby="smp-tab-invoices"/);
        expect((html.match(/class="dash-stat-card[^"]*smp-stat-btn" data-filter="(open|needimport)" aria-pressed="false"/g) || []).length).toBe(2);
        expect(html).toMatch(/id="smp-sw-status" role="status"/);
        expect(html).toMatch(/id="smp-older-hint" role="status" hidden/);
        expect(html).toMatch(/role="progressbar" aria-label="Marketing fund used"/);
        expect(html).toMatch(/<label[^>]+for="smp-sw-file">/);
        expect(html).toMatch(/<input type="file" id="smp-sw-file"[^>]+class="purchasing-file"/);
        expect(html).not.toMatch(/for="smp-sw-file" role="button"/);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close btn btn-secondary" aria-label="Dismiss">/);
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/style="/);
        expect(html).toMatch(/sanmar-payables\.js\?v=2026\.09\./);
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\][^}]*display: none/);
        expect(css).not.toContain('!important');
        expect(css).toMatch(/\.smp-progress-fill \{[^}]*width: var\(--w, 0%\);/);
    });
    test('the shared viewer is loaded at ONE version by all three consumers', () => {
        const v = /sanmar-invoice-viewer\.js\?v=([0-9.]+)/.exec(html)[1];
        for (const f of ['dashboards/ae-mission-control.html', 'dashboards/purchasing-portal.html']) {
            expect(read(f)).toContain('sanmar-invoice-viewer.js?v=' + v);
        }
    });
});

describe('sanmar payables — behaviour', () => {
    test('local calendar dates; tab + tile sync; retries; visible imports failure', () => {
        expect(js).toMatch(/function localIso\(d\)/);
        expect(js).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
        expect(js).toMatch(/b\.setAttribute\('aria-selected', on \? 'true' : 'false'\);/);
        expect(js).toMatch(/function syncStatTiles\(\)/);
        expect(js).toMatch(/sel\.value = \(sel\.value === f\) \? 'needimport' : f;/);
        expect(js).toMatch(/id="smp-inv-retry"/);
        expect(js).toMatch(/id="smp-mkt-retry"/);
        expect(js).not.toMatch(/refresh to retry/);
        expect(js).toMatch(/Import log unavailable \(/);
        expect(js).not.toMatch(/\.catch\(function \(\) \{ state\.importsLoaded = true;/);
        expect(js).toMatch(/bar\.style\.setProperty\('--w'/);
        expect(js).not.toMatch(/style="width:/);
        expect(js).not.toMatch(/\.style\.width/);
        expect(js).toMatch(/aria-label="View SanMar invoice ' \+ esc\(i\.invoiceNumber \|\| ''\) \+ '"/);
        expect(js).toMatch(/returnFocus: btn/);
    });
    test('shared invoice viewer: labelled dialog, focus return, honest title', () => {
        expect(viewer).toMatch(/modal\.setAttribute\('aria-labelledby', 'smiv-title'\);/);
        expect(viewer).toMatch(/returnFocus = opts\.returnFocus \|\| document\.activeElement;/);
        expect(viewer).toMatch(/var subject = wo \? 'WO #' \+ esc\(wo\) : 'PO ' \+ pos\.map\(esc\)\.join\(', '\);/);
        expect(viewer).not.toMatch(/SanMar Invoice — WO #' \+ esc\(wo\);/);
        expect(viewer).not.toMatch(BARE);
        expect(viewer).toMatch(/if \(e\.key === 'Escape' && m && !m\.hidden\) close\(\);/);
    });
});
