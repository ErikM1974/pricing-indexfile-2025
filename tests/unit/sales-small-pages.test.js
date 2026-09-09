/**
 * Portal Directory · Lead Scorecard · Unqualified & Spam Leads — 2026-09-05 review locks.
 *   Portal Directory: no inline onerror/style, `hidden` + [hidden] rule, failing feeds THROW (no silent
 *     half-directory), error panel has Retry, staff "Preview" opens the read-only mirror (not /portal/:id,
 *     which just bounces to /portal), copy fallback is a toast (no prompt()), icons decorative.
 *   Lead Scorecard: presets carry aria-pressed (cleared by a custom Apply), value bar uses a CSS custom
 *     property, failure offers Retry, icons decorative.
 *   Unqualified & Spam: real tablist (aria-selected/aria-controls/arrow keys), rescan result is a status
 *     line (was the red error banner), spam note toggles with `hidden`, failure offers Retry.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const NO_ICON = /<i class="fa[^"]*"><\/i>/;

describe('portal directory', () => {
    const html = strip(read('dashboards/portal-directory.html'));
    const js = read('dashboards/js/portal-directory.js');
    const css = read('shared_components/css/components.css');
    test('Rule 3 + hidden', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change)=/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).not.toMatch(/style="/);
        expect(html).toMatch(/class="pd-header-logo" data-onerror="hide"/);
        expect(js).toMatch(/document\.addEventListener\('error', function \(e\)[\s\S]*?\}, true\);/);
        expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none;/);
        expect(html).not.toMatch(NO_ICON);
        expect(js).not.toMatch(NO_ICON);
        expect(html).toMatch(/staff-admin-tools\.css\?v=2026\.\d{2}\.\d{2}\.\d+/);
    });
    test('feeds fail loudly and the error panel retries', () => {
        expect(js).not.toMatch(/console\.error\('Mockups fetch error:', err\);\s*return \[\];/);
        expect(js).not.toMatch(/console\.error\('Art requests fetch error:', err\);\s*return \[\];/);
        expect(html).toMatch(/id="pd-error" role="alert" hidden/);
        expect(html).toMatch(/id="pd-retry" data-call="_pdRetry"/);
        expect(js).toMatch(/window\._pdRetry = function \(\) \{[\s\S]*?loadDirectory\(\);/);
    });
    test('staff Preview → the read-only mirror; Copy Link stays customer-facing; no prompt()', () => {
        expect(js).toMatch(/var previewUrl = hasId \? \('\/portal-admin\/preview\/' \+ c\.customerId\) : '';/);
        expect(js).toMatch(/href="' \+ escapeAttr\(previewUrl\) \+ '" target="_blank" rel="noopener" title="Preview their portal/);
        expect(js).toMatch(/var url = SITE_ORIGIN \+ '\/portal\/' \+ customerId;/);
        expect(js).not.toMatch(/\bprompt\(/);
        expect(js).toMatch(/class="btn btn-primary pd-btn-open is-disabled" aria-disabled="true"/);
        expect(js).toMatch(/class="pd-dot ' \+ dotClass \+ '" role="img" title="[^"]*" aria-label="Last activity /);
    });
});

describe('lead scorecard', () => {
    const html = strip(read('dashboards/lead-scorecard.html'));
    const js = read('dashboards/js/lead-scorecard.js');
    const css = read('dashboards/css/lead-scorecard.css');
    test('presets are pressed-state; Apply clears them; bar uses --w; Retry on failure', () => {
        expect((html.match(/class="sc-preset" data-preset="[a-z0-9-]+" aria-pressed="false"/g) || []).length).toBe(4);
        expect(js).toMatch(/b\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/A custom range is none of the presets/);
        expect(js).toMatch(/style="--w:' \+ pct \+ '%" aria-hidden="true"/);
        expect(js).not.toMatch(/style="width:/);
        expect(css).toMatch(/\.sc-bar \{[\s\S]*?width: var\(--w, 0%\);/);
        expect(js).toMatch(/id="sc-retry"/);
        expect(js).toMatch(/if \(e\.target\.closest\('#sc-retry'\)\) load\(\);/);
        expect(html).not.toMatch(NO_ICON);
        expect(js).not.toMatch(NO_ICON);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close"/);
    });
});

describe('unqualified & spam leads', () => {
    const html = strip(read('dashboards/unqualified-leads.html'));
    const js = read('dashboards/js/unqualified-leads.js');
    const css = read('dashboards/css/unqualified-leads.css');
    test('real tablist with arrow keys; panel labelled by the active tab', () => {
        expect(html).toMatch(/<div class="uq-tabs" role="tablist" aria-label="Lead category">/);
        expect(html).toMatch(/id="uq-tab-spam" aria-selected="true" aria-controls="uq-panel"/);
        expect(html).toMatch(/id="uq-tab-unqualified" aria-selected="false" aria-controls="uq-panel" tabindex="-1"/);
        expect(html).toMatch(/<div class="dash-card" id="uq-panel" role="tabpanel" aria-labelledby="uq-tab-spam">/);
        expect(js).toMatch(/x\.setAttribute\('aria-selected', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft'/);
        expect(js).toMatch(/document\.getElementById\('spam-note'\)\.hidden = state\.cat !== 'spam';/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
    });
    test('rescan result is a status line, not the error banner; failure offers Retry', () => {
        expect(html).toMatch(/<div class="uq-status" id="uq-status" role="status" hidden><\/div>/);
        expect(js).toMatch(/var st = document\.getElementById\('uq-status'\);\s*st\.textContent = /);
        expect(js).not.toMatch(/DashPage\.showError\([\s\S]{0,400}'info'\)/);
        expect(js).toMatch(/id="uq-retry"/);
        expect(js).toMatch(/if \(e\.target\.closest\('#uq-retry'\)\) \{ state\.cache = \{\}; load\(state\.cat\); \}/);
        expect(html).not.toMatch(NO_ICON);
        expect(js).not.toMatch(NO_ICON);
    });
});
