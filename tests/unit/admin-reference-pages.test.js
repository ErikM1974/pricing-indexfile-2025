/**
 * The 13 admin + reference dashboard pages — 2026-09-05 hygiene locks.
 *   Every page: decorative icons aria-hidden, banner close typed, page CSS carries the [hidden] guard,
 *   page assets versioned. Plus: api-usage meters/bars via custom properties (no .style.width / inline
 *   width/height), table-usage-audit placeholder via a class, SanMar→ShopWorks converter uses the hidden
 *   attribute (no display toggles), drive-access / policy-migration / ODBC reference offer Retry instead
 *   of "please refresh".
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const PAGES = ['api-usage', 'access-admin', 'drive-access', 'bandit-integration', 'contract-break-even', 'policy-migration',
    'table-usage-audit', 'sanmar-ftp-integration', 'sanmar-shopworks-converter', 'caspio-api-reference',
    'manageorders-api-reference', 'sanmar-api-reference', 'shopworks-odbc-reference'];

describe('admin + reference pages — shared hygiene', () => {
    test.each(PAGES)('%s', (name) => {
        const html = read(`dashboards/${name}.html`).replace(/<!--[\s\S]*?-->/g, '');
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/<button class="dash-error-banner-close"/);
        expect(html).not.toMatch(/(href|src)="\/dashboards\/(css|js)\/[^"?]+\.(css|js)"/); // every page asset versioned
        expect((html.match(/<h1\b/g) || []).length).toBe(1);
        if (exists(`dashboards/css/${name}.css`)) {
            expect(read(`dashboards/css/${name}.css`)).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        }
        if (exists(`dashboards/js/${name}.js`)) {
            expect(read(`dashboards/js/${name}.js`)).not.toMatch(BARE);
        }
    });
});

describe('admin + reference pages — specifics', () => {
    test('api-usage meters and bars via custom properties', () => {
        const js = read('dashboards/js/api-usage.js');
        const css = read('dashboards/css/api-usage.css');
        expect(js).not.toMatch(/\.style\.width/);
        expect(js).not.toMatch(/style="(?!--)/);
        expect(js).toMatch(/fill\.style\.setProperty\('--w'/);
        expect(css).toMatch(/\.au-meter-fill \{ width: var\(--w, 0%\); \}/);
        expect(css).toMatch(/\.au-bar \{ height: var\(--h, 2%\); \}/);
    });
    test('table-usage-audit placeholder class', () => {
        expect(read('dashboards/js/table-usage-audit.js')).not.toMatch(/style="/);
        expect(read('dashboards/css/table-usage-audit.css')).toMatch(/\.tua-none \{ color: var\(--gray-400\); \}/);
    });
    test('converter uses hidden, not display toggles', () => {
        const html = read('dashboards/sanmar-shopworks-converter.html').replace(/<!--[\s\S]*?-->/g, '');
        expect(html).not.toMatch(/style="/);
        expect(html).toMatch(/id="sw-error" class="sw-msg sw-msg--error" role="alert" hidden/);
        expect(read('dashboards/js/sanmar-shopworks-converter.js')).toMatch(/function show\(node, on\) \{ if \(node\) node\.hidden = !on; \}/);
    });
    test('retry instead of "please refresh"', () => {
        const da = read('dashboards/js/drive-access.js');
        expect(da).toMatch(/retry\.textContent = 'Try again';/);
        expect(da).not.toMatch(/please refresh/i);
        const pm = read('dashboards/js/policy-migration.js');
        expect(pm).toMatch(/id="pmig-retry"/);
        expect(pm).not.toMatch(/Please refresh/);
        const odbc = read('dashboards/js/shopworks-odbc-reference.js');
        expect(odbc).toMatch(/id="swo-retry"/);
        expect(odbc).not.toMatch(/Refresh to retry|Please refresh/);
    });
});
