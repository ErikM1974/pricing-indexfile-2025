/**
 * Quote Management (hygiene) + SanMar Inbound Calendar modal + box-label template + Purchasing Portal
 * (hygiene) + Product Manager — 2026-09-05 review locks.
 *   Inbound modal: no inline style= (method colours / calendar heat via custom properties, alignment via a
 *   class), no inline onerror (capture listener), hidden attr instead of .style.display, role=dialog with
 *   focus return. Box labels: same treatment for the print template. Product Manager: load Retry, named
 *   per-row actions, form focus in/out. Every icon decorative; titled icon buttons named; assets versioned.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('quote management hygiene', () => {
    const html = read('dashboards/quote-management.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/quote-management.js');
    test('icons decorative; titled buttons named; versions bumped', () => {
        expect(html).not.toMatch(BARE);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas \$\{icon\}"><\/i>/);
        expect(html).not.toMatch(/<button(?![^>]*aria-label)[^>]*title="/);
        // versioned at or after the 2026-09-05 review (deploys keep bumping it — compare, never pin a prefix)
        const v = (html.match(/quote-management\.js\?v=(\d{4}\.\d{2}\.\d{2}\.\d+)/) || [])[1];
        expect(v).toBeDefined();
        const key = (s) => s.split('.').map(Number).reduce((acc, n, i) => acc + n * [1e9, 1e7, 1e5, 1][i], 0);
        expect(key(v)).toBeGreaterThanOrEqual(key('2026.09.05.70'));
    });
});

describe('sanmar inbound calendar modal', () => {
    const js = read('dashboards/js/sanmar-inbound-today.js');
    const css = read('dashboards/css/sanmar-inbound.css');
    test('no inline style/onerror; hidden attr; dialog + focus return', () => {
        // the only style= left carries a custom property (--c / --bg), never a CSS declaration
        expect(js).not.toMatch(/style="(?!--|\$\{style\})/);
        expect(js).toMatch(/style = `--bg:rgba\(46,111,64,/);
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).toMatch(/modalEl\.setAttribute\('role', 'dialog'\);/);
        expect(js).toMatch(/returnFocus = document\.activeElement;/);
        expect(js).toContain("if (e.key !== 'Escape' || !modalEl || modalEl.hidden || modalEl.tagName === 'DIALOG') return;");
        expect(js).toContain("modalEl.addEventListener('cancel'");
        expect(js).toContain('if (!modalEl.open) modalEl.showModal();');
        expect(js).toMatch(/data-onerror="sit-logo"/);
        expect(js).toMatch(/<th class="sit-r">/);
        expect(css).toMatch(/\.sit-modal\[hidden\] \{ display: none; \}/);
        expect(css).toMatch(/\.sit-chip \{ background: var\(--c, (?:#9ca3af|var\(--gray-400\))\); \}/);
        expect(css).toMatch(/\.sit-cal-has \{ background: var\(--bg\); \}/);
        expect(js).not.toMatch(BARE);
    });
});

describe('box label template', () => {
    const js = read('shared_components/js/box-label-template.js');
    const css = read('shared_components/css/box-label-print.css');
    test('method colour via --m; artwork fallback via capture listener', () => {
        expect(js).not.toMatch(/style="(?!--)/);
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).toMatch(/data-onerror="sl-logo"/);
        expect(js).toMatch(/window\.__slLogoErrWired = true;/);
        expect(css).toMatch(/\.sl-type \{ border-left-color: var\(--m, (?:#555|var\(--print-ink-soft\))\); \}/);
        expect(css).toMatch(/\.sl-fill--wide \{ flex: 1\.7; \}/);
    });
});

describe('purchasing portal hygiene', () => {
    const html = read('dashboards/purchasing-portal.html').replace(/<!--[\s\S]*?-->/g, '');
    test('banner typed; icons; viewer css version matches the js', () => {
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close btn btn-secondary" aria-label="Dismiss">/);
        expect(html).not.toMatch(BARE);
        const version = /vendor-invoice\.css\?v=([0-9.]+)/.exec(html)[1];
        expect(version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
        expect(html).toContain('sanmar-invoice-viewer.js?v=' + version);
        expect(html).toContain('purchasing-portal.js?v=' + version);
    });
});

describe('product manager', () => {
    const html = read('dashboards/product-manager.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/product-manager.js');
    const css = read('shared_components/css/staff-toolkit.css');
    test('retry, named actions, focus, hygiene', () => {
        expect(js).toMatch(/function boot\(\)/);
        expect(js).toMatch(/id="pmRetry"/);
        expect(js).not.toMatch(/Please refresh/);
        expect(js).toMatch(/aria-label="Edit \$\{escapeHtml\(p\.StyleNumber\)\}"/);
        expect(js).toMatch(/aria-label="View \$\{escapeHtml\(p\.StyleNumber\)\} in the catalog \(new tab\)"/);
        expect(js).toMatch(/const f = product \? \$\('fName'\) : \$\('fStyle'\); if \(f\) f\.focus\(\);/);
        expect(js).not.toMatch(BARE);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\] \{\s*display: none;\s*\}/);
        expect(html).toMatch(/product-manager\.js\?v=2026\.09\./);
    });
});
