/**
 * Payroll + Forms Inbox + Forms Library — 2026-09-05 review locks.
 *   Payroll: local calendar day for the "accrues <date>" pill, the slip figures and the printed run date
 *   (were UTC → a day ahead after 5 PM); tabs are a real tablist; every load has Retry.
 *   Forms Inbox: `manual-lead` rows have a badge (read the raw id before); a "Leads" chip covers the three
 *   lead form ids; chips/tiles carry aria-pressed; tabs are a tablist; Date_Returned is the LOCAL day
 *   (was UTC written to Caspio); detail dialog focus in/return; Retry on load failure; icons decorative.
 *   Forms Library: Retry, named action links, decorative icons, versioned assets.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const BARE_DYN = /<i class="fas ' \+/;
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('payroll', () => {
    const html = read('dashboards/payroll.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/payroll.js');
    const css = read('dashboards/css/payroll.css');
    test('tablist, local dates, retries', () => {
        expect(html).toMatch(/<div class="pr-tabs" role="tablist" aria-label="Payroll views">/);
        for (const t of ['leave', 'periods', 'upload']) {
            expect(html).toMatch(new RegExp(`id="tab-${t}" data-panel="${t}" type="button" role="tab" aria-selected="(true|false)"[^>]*aria-controls="panel-${t}"`));
            expect(html).toMatch(new RegExp(`id="panel-${t}" class="pr-panel( is-active)?" role="tabpanel" aria-labelledby="tab-${t}"`));
        }
        expect(js).toMatch(/function todayLocal\(\)/);
        expect(noComments(js)).not.toMatch(/toISOString/);
        expect(js).toMatch(/today: todayLocal\(\)/);
        expect(js).toMatch(/t\.setAttribute\('aria-selected', on \? 'true' : 'false'\);/);
        for (const id of ['leave-retry', 'periods-retry', 'register-retry']) expect(js).toMatch(new RegExp(`id="${id}"`));
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).toMatch(/payroll\.js\?v=2026\.09\./);
    });
});

describe('forms inbox', () => {
    const html = read('dashboards/form-submissions.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/form-submissions.js');
    const css = read('shared_components/css/crm-records.css');
    test('badges, chips, tiles, tabs', () => {
        expect(js).toMatch(/'manual-lead': \{ label: 'Manual Lead'/);
        expect(html).toMatch(/data-form="quote-request,sample-request,manual-lead" aria-pressed="false">Leads<\/button>/);
        expect(js).toMatch(/state\.formFilter\.split\(','\)\.indexOf\(s\.Form_ID\) === -1/);
        expect(js).toMatch(/function setFormFilter\(value\)/);
        expect((html.match(/class="inbox-chip[^"]*" data-form="[^"]*" aria-pressed="(true|false)"/g) || []).length).toBe(10);
        expect(html).toMatch(/<div class="inbox-tabs no-print" role="tablist" aria-label="Inbox views">/);
        expect(html).toMatch(/id="tab-samples" data-view="samples" role="tab" aria-selected="false" tabindex="-1" aria-controls="viewSamples"/);
        expect(html).toMatch(/id="viewSamples" class="dash-card" role="tabpanel" aria-labelledby="tab-samples" hidden/);
        expect((html.match(/class="dash-stat-card[^"]*inbox-stat-btn" data-tile="(new|samples)"/g) || []).length).toBe(3);
        expect(js).toMatch(/if \(tile\.dataset\.tile === 'samples'\) \{ showView\('samples'\);/);
    });
    test('local Date_Returned, dialog focus, retry, hygiene', () => {
        expect(js).toMatch(/Date_Returned: newStatus === 'Returned' \? localToday\(\) : '',/);
        expect(noComments(js)).not.toMatch(/toISOString/);
        expect(js).toMatch(/detailReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/if \(e\.key === 'Escape' && !document\.getElementById\('detailOverlay'\)\.hidden\) closeDetail\(\);/);
        expect(js).toMatch(/class="btn inbox-retry">Retry<\/button>/);
        expect(js).not.toMatch(/Refresh to retry/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(BARE_DYN);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close btn" aria-label="Dismiss">/);
        expect(html).toMatch(/id="inboxRefresh"/);
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display: none;/);
        expect(css).toMatch(/\.sw-preview-body\s*\{\s*width: 100%;/);
        expect(html).toMatch(/form-submissions\.js\?v=2026\.09\./);
    });
});

describe('forms library', () => {
    const html = read('dashboards/forms-library.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/forms-library.js');
    test('retry, named links, decorative icons, versions', () => {
        expect(js).toMatch(/function boot\(\)/);
        expect(js).toMatch(/id="forms-retry"/);
        expect(js).toMatch(/aria-label="Fill out ' \+ escapeHtml\(form\.Form_Name\) \+ ' online"/);
        expect(js).toMatch(/aria-label="Download or print ' \+ escapeHtml\(form\.Form_Name\) \+ ' \(PDF, opens in a new tab\)"/);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(BARE_DYN);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        expect(html).toMatch(/forms-library\.js\?v=2026\.09\./);
        expect(html).toMatch(/forms-library\.css\?v=2026\.09\./);
    });
});
