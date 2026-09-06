/**
 * AE Mission Control (hygiene) + Pricing Analysis (generated) + Price Audit Report — 2026-09-05 locks.
 *   Mission Control: bar widths / ladder marker positions via --w/--x custom properties (no .style.width,
 *   no inline width/left), a one-click "Reload to retry" control in every failed panel (was "Refresh to
 *   retry" text ×15), body scroll lock via a class, icons decorative, banner close typed.
 *   Pricing Analysis: the GENERATOR (scripts/build-pricing-analysis.py) emits decorative icons — the HTML is
 *   its output and must agree. Price Audit Report: icons decorative, CSS versioned.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;

describe('ae mission control hygiene', () => {
    const html = read('dashboards/ae-mission-control.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/ae-mission-control.js');
    const css = read('dashboards/css/ae-mission-control.css');
    test('custom properties, reload control, icons, banner', () => {
        expect(js).not.toMatch(/\.style\.(width|left|overflow)/);
        expect(js).not.toMatch(/style="(?!--)/);
        expect(js).toMatch(/el\('aemc-bh-fill'\)\.style\.setProperty\('--w'/);
        expect(js).not.toMatch(/Refresh to retry\.<\/div>/);
        expect(js).toMatch(/class="aemc-reload" data-reload="1">Reload to retry<\/button>/);
        expect(js).toMatch(/e\.target\.closest\('\[data-reload\]'\)/);
        expect(js).toMatch(/document\.body\.classList\.add\('is-modal-open'\);/);
        expect(css).toMatch(/\.aemc-bh-fill, \.mc-kicker-fill, \.mc-condensed-fill \{ width: var\(--w, 0%\); \}/);
        expect(css).toMatch(/\.aemc-bh-mark, \.mc-bh-pace-mark, \.aemc-bh-startcap span \{ left: var\(--x, 0%\); \}/);
        expect(js).not.toMatch(BARE);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        expect(html).toMatch(/ae-mission-control\.js\?v=2026\.09\.05\.(7\d|[89]\d)/);
    });
});

describe('pricing analysis (generated)', () => {
    test('generator and its output both carry decorative icons and the same versions', () => {
        const py = read('scripts/build-pricing-analysis.py');
        const html = read('dashboards/pricing-analysis.html');
        expect(py).not.toMatch(BARE);
        expect(html).not.toMatch(BARE);
        const cssVer = /CSS_VER = '([0-9.]+)'/.exec(py)[1];
        expect(html).toContain('pricing-analysis.css?v=' + cssVer);
    });
});

describe('price audit report', () => {
    test('icons decorative; css versioned', () => {
        const html = read('dashboards/reports/price-audit-report.html');
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/price-audit-report\.css\??v=d{4}.d{2}.d{2}.d+/);
    });
});
