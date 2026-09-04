/**
 * @jest-environment jsdom
 *
 * Staff dashboard Workspaces (2026-09-03) — structural locks on
 * staff-dashboard-v3/index.html and dashboards/company-numbers.html.
 *
 * What this protects:
 *   1. Nothing went missing in the restructure — every href that was on the
 *      dashboard on 2026-09-03 (the pre-Workspaces page) is still on it.
 *   2. Every tab has a panel and every panel has a tab.
 *   3. Every tool link points at a file that exists (or a server route that
 *      does), so a typo in the markup fails here rather than as a 404 for
 *      a rep.
 *   4. A tool is listed at most once per tab.
 *   5. Gating attributes only name permissions the server actually grants.
 *   6. The eight report widgets live on Company Numbers and NOT on the
 *      dashboard (nobody used them there — Erik, 2026-09-03).
 *   7. The role → default-tab table is what was agreed.
 *   8. Rule 3: no inline <style>/<script> bodies on either page.
 *
 * The Administration/Admin-panel ↔ ADMIN_DEFAULT_PAGES drift lock lives in
 * admin-page-access.test.js; not repeated here.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const dashboardHtml = readRepo('staff-dashboard-v3/index.html');
const numbersHtml = readRepo('dashboards/company-numbers.html');
const serverSrc = readRepo('server.js');
const controllerSrc = readRepo('shared_components/js/staff-dashboard/controllers/workspace-controller.js');

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const dash = parse(dashboardHtml);
const numbers = parse(numbersHtml);

// Every internal href the dashboard carried on 2026-09-03, before Workspaces
// (extracted from the pre-restructure index.html; excludes css/img/auth/self links).
const PRE_WORKSPACES_HREFS = [
    '/DrainPro-Bundle.html', '/art-tools/ae-art-dashboard.html',
    '/calculators/custom-decal-pricing.html', '/calculators/dtg-contract/', '/calculators/embroidered-emblem/',
    '/calculators/embroidery-contract/', '/calculators/embroidery-pricing-all/?tab=al-retail',
    '/calculators/embroidery-pricing-all/?tab=decg-retail', '/calculators/embroidery-pricing-all/?tab=fullback',
    '/calculators/embroidery-pricing-all/?tab=stitch-charges', '/calculators/laser-tumbler-polarcamel.html',
    '/calculators/manual-pricing.html', '/calculators/purchasingform.html', '/calculators/quick-quote/',
    '/calculators/quick-quote/?mode=quick', '/calculators/richardson-2025.html', '/calculators/screenprint-customer/',
    '/calculators/service-price-cheat-sheet.html', '/calculators/webstores.html', '/catalog?topSellers=1',
    '/christmas-bundles.html', '/custom-banners', '/custom-stickers', '/custom-tees',
    '/dashboards/access-admin.html', '/dashboards/ae-mission-control.html', '/dashboards/api-usage.html',
    '/dashboards/art-hub-ruth.html', '/dashboards/art-hub-steve.html', '/dashboards/bandit-integration.html',
    '/dashboards/blog-editor.html', '/dashboards/bradley-transfers.html', '/dashboards/caspio-api-reference.html',
    '/dashboards/commission-structure.html', '/dashboards/contract-break-even.html', '/dashboards/customer-portal-admin.html',
    '/dashboards/design-gallery.html', '/dashboards/digitized-designs.html', '/dashboards/drive-access.html',
    '/dashboards/finished-photos-library.html', '/dashboards/finished-photos.html', '/dashboards/form-submissions.html',
    '/dashboards/forms-library.html', '/dashboards/house-accounts.html', '/dashboards/jim-mailing-list.html',
    '/dashboards/leads.html', '/dashboards/manageorders-api-reference.html', '/dashboards/monogram-dashboard.html',
    '/dashboards/names-numbers-dashboard.html', '/dashboards/nika-crm.html', '/dashboards/old-designs.html',
    '/dashboards/past-due-orders.html', '/dashboards/payroll.html', '/dashboards/policy-migration.html',
    '/dashboards/portal-directory.html', '/dashboards/pricing-analysis.html', '/dashboards/product-manager.html',
    '/dashboards/production-shifts.html', '/dashboards/purchasing-portal.html', '/dashboards/quote-management.html',
    '/dashboards/quote-management.html?open=inbound-today', '/dashboards/reports/price-audit-report.html',
    '/dashboards/roland-printer-supplies.html', '/dashboards/sanmar-api-reference.html',
    '/dashboards/sanmar-ftp-integration.html', '/dashboards/sanmar-payables.html',
    '/dashboards/sanmar-shopworks-converter.html', '/dashboards/seo-strategy.html',
    '/dashboards/shopworks-odbc-reference.html', '/dashboards/supacolor-orders.html',
    '/dashboards/table-usage-audit.html', '/dashboards/taneisha-crm.html', '/dashboards/volume-quote.html',
    '/pages/box-labels.html', '/pages/data-entry-guide.html', '/pages/dst-viewer.html', '/pages/garment-designer.html',
    '/pages/jds-mockup-creator.html', '/pages/policies-hub.html',
    '/pages/policy-detail.html?id=customer-notification-sop', '/pages/policy-detail.html?id=ltm-order-decision-algorithm',
    '/pages/policy-detail.html?id=org-chart-2026', '/pages/policy-detail.html?id=sales-office-procedures',
    '/quote-builders/dtf-quote-builder.html', '/quote-builders/dtg-quote-builder.html',
    '/quote-builders/embroidery-quote-builder.html', '/quote-builders/screenprint-quote-builder.html',
    '/sanmar-vendor-portal.html', '/streich-bros-bundle.html', '/tools/custom-tees-calibrate.html',
    '/training/customer-service.html', '/training/index.html', '/training/quick-reference-tips.html',
    '/training/sales-coordinator-manual.html', '/training/sanmar-purchasing-guide.html',
    '/training/shipping-receiving-guide.html', '/training/training-games-hub.html',
    '/universal-records-admin.html', '/wcttr-bundle.html',
];

// Deliberate replacements: the old href → what the page now links instead.
const REPLACED = {
    // The /art-tools stub was a client-side redirect that flashed "Redirecting…";
    // the button now goes straight to the page it bounced to.
    '/art-tools/ae-art-dashboard.html': '/ae-dashboard.html',
};

// Root-level hrefs that are server routes rather than files on disk.
const ROOT_ROUTES = new Set([
    '/custom-tees', '/custom-stickers', '/custom-banners', '/catalog', '/ae-dashboard.html',
    '/sanmar-vendor-portal.html', '/universal-records-admin.html', '/DrainPro-Bundle.html',
    '/streich-bros-bundle.html', '/wcttr-bundle.html', '/christmas-bundles.html',
]);

const KNOWN_PERMISSIONS = new Set(['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika', 'ruth',
    'sales', 'art', 'production', 'shipping', 'staff']);

const allHrefs = (doc) => [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
const tabs = [...dash.querySelectorAll('.ws-tabs .ws-tab[data-ws]')];
const panels = [...dash.querySelectorAll('.ws-panel[data-ws]')];

describe('tabs and panels', () => {
    test('seven tabs, each with a panel, each panel with a tab', () => {
        const tabIds = tabs.map((t) => t.dataset.ws);
        const panelIds = panels.map((p) => p.dataset.ws);
        expect(tabIds).toEqual(['sales', 'production', 'art', 'office', 'company', 'everything', 'admin']);
        expect([...panelIds].sort()).toEqual([...tabIds].sort());
    });

    test('every tab points at its panel via aria-controls', () => {
        for (const tab of tabs) {
            const panel = dash.getElementById(tab.getAttribute('aria-controls'));
            expect(panel && panel.dataset.ws).toBe(tab.dataset.ws);
        }
    });

    test('the Admin tab and panel both ship hidden behind the admin permission', () => {
        const tab = dash.querySelector('.ws-tab[data-ws="admin"]');
        const panel = dash.querySelector('.ws-panel[data-ws="admin"]');
        for (const el of [tab, panel]) {
            expect(el.getAttribute('data-requires-role')).toBe('admin');
            expect(el.hasAttribute('hidden')).toBe(true);
        }
        // The drift-lock in admin-page-access.test.js slices from here…
        expect(panel.getAttribute('data-section')).toBe('admin');
        // …to here. The sentinel must follow the panel, and the panel's closing tag
        // must sit between the two (so the slice is exactly the Admin panel).
        const start = dashboardHtml.indexOf('data-section="admin"');
        const end = dashboardHtml.indexOf('<!-- END ADMIN');
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        expect(dashboardHtml.slice(start, end)).toMatch(/<\/section>\s*$/);
    });

    test('the Everything panel is generated, not hand-maintained', () => {
        const every = dash.querySelector('.ws-panel[data-ws="everything"]');
        expect(every.querySelectorAll('a.ws-link').length).toBe(0);
        expect(every.querySelector('#wsEveryTools')).not.toBeNull();
        expect(every.querySelector('#wsEveryFilter')).not.toBeNull();
    });
});

describe('nothing went missing', () => {
    const present = new Set(allHrefs(dash));

    test.each(PRE_WORKSPACES_HREFS)('%s is still reachable from the dashboard', (href) => {
        const want = REPLACED[href] || href;
        expect(present.has(want)).toBe(true);
    });

    test('the deliberate replacements are not silently reintroduced', () => {
        for (const old of Object.keys(REPLACED)) expect(present.has(old)).toBe(false);
    });
});

describe('every tool link resolves', () => {
    const links = [...dash.querySelectorAll('a.ws-link[href]')];

    test('the page carries a meaningful number of tools', () => {
        expect(links.length).toBeGreaterThan(120);
    });

    test.each(links.map((a) => [a.getAttribute('href')]))('%s exists on disk or as a route', (href) => {
        if (/^https?:\/\//i.test(href)) return;                 // external (InkSoft Transform)
        const clean = href.split('#')[0].split('?')[0];
        if (ROOT_ROUTES.has(clean)) {
            expect(serverSrc).toContain(`'${clean}`);
            return;
        }
        const rel = clean.endsWith('/') ? clean + 'index.html' : clean;
        expect(fs.existsSync(path.join(ROOT, rel.replace(/^\//, '')))).toBe(true);
    });

    test('every tool has a visible name', () => {
        for (const a of links) {
            const nm = a.querySelector('.ws-nm') || a.querySelector('.ws-tile__tx b');
            expect(nm && nm.textContent.trim().length).toBeTruthy();
        }
    });

    test('a tool is listed at most once per tab', () => {
        for (const panel of panels) {
            const hrefs = [...panel.querySelectorAll('a.ws-link[href]')].map((a) => a.getAttribute('href'));
            const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
            expect({ tab: panel.dataset.ws, dupes }).toEqual({ tab: panel.dataset.ws, dupes: [] });
        }
    });
});

describe('gating attributes', () => {
    test('every data-requires-role names only permissions the server grants', () => {
        for (const el of dash.querySelectorAll('[data-requires-role]')) {
            const roles = el.getAttribute('data-requires-role').split(',').map((s) => s.trim());
            expect(roles.length).toBeGreaterThan(0);
            for (const r of roles) expect(KNOWN_PERMISSIONS.has(r)).toBe(true);
            // Gated nodes ship hidden so nothing flashes before nav-access resolves.
            expect(el.hasAttribute('hidden')).toBe(true);
        }
    });

    test('the per-rep account pages are gated to their rep', () => {
        expect(dash.querySelector('a[href="/dashboards/taneisha-crm.html"]').getAttribute('data-requires-role')).toBe('taneisha');
        expect(dash.querySelector('a[href="/dashboards/nika-crm.html"]').getAttribute('data-requires-role')).toBe('nika');
        for (const a of dash.querySelectorAll('a[href="/dashboards/house-accounts.html"]')) {
            expect(a.getAttribute('data-requires-role')).toBe('house');
        }
    });
});

describe('the report widgets moved to Company Numbers', () => {
    const WIDGET_IDS = ['inboxPaidList', 'payToday', 'samplePipelineList', 'ytdRevenue',
        'salesTeamList', 'artAgingBody', 'production-predictor-grid', 'embroideryBonusContent'];

    test.each(WIDGET_IDS)('#%s is on Company Numbers and not on the dashboard', (id) => {
        expect(numbers.getElementById(id)).not.toBeNull();
        expect(dash.getElementById(id)).toBeNull();
    });

    test('the goal chip opens Company Numbers and the Admin tab lists it', () => {
        expect(dash.querySelector('a.goal-chip').getAttribute('href')).toBe('/dashboards/company-numbers.html');
        expect(dash.querySelector('.ws-panel[data-ws="admin"] a[href="/dashboards/company-numbers.html"]')).not.toBeNull();
    });

    test('the Company Numbers entry uses absolute imports (it is served content-hashed from /dist)', () => {
        const entry = readRepo('dashboards/js/company-numbers.js');
        const imports = [...entry.matchAll(/from\s+'([^']+)'|import\s+'([^']+)'/g)].map((m) => m[1] || m[2]);
        expect(imports.length).toBeGreaterThan(3);
        for (const spec of imports) expect(spec.startsWith('/shared_components/')).toBe(true);
    });

    test('the goal chip still has what sales-goal-controller drives', () => {
        for (const id of ['goalPercent', 'goalProgress', 'goalCurrent', 'goalOf']) {
            expect(dash.getElementById(id)).not.toBeNull();
        }
        expect(dash.getElementById('nav-pd-badge')).not.toBeNull();
        expect(dash.querySelector('[data-section="past-due-orders"]')).not.toBeNull();
    });
});

describe('role → default tab (workspace-controller.js)', () => {
    test('the agreed table is in the controller', () => {
        const m = /const ROLE_DEFAULT = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(controllerSrc);
        expect(m).not.toBeNull();
        const table = Object.fromEntries([...m[1].matchAll(/(\w+):\s*'(\w+)'/g)].map((x) => [x[1], x[2]]));
        expect(table).toEqual({
            admin: 'sales', sales: 'sales', art: 'art', production: 'production', shipping: 'production', accountant: 'office',
            staff: 'office', // 2026-09-04: a plain staffer (Jim) lands on Office, not the catch-all
        });
        expect(controllerSrc).toMatch(/const FALLBACK_WS = 'everything';/);
    });
});

describe('2026-09-04 review — the things that must not regress', () => {
    test('Past Due Orders is the header chip plus exactly ONE row (it was five entries)', () => {
        const rows = dash.querySelectorAll('a.ws-link[href="/dashboards/past-due-orders.html"]');
        expect(rows.length).toBe(1);
        expect(rows[0].closest('.ws-panel').dataset.ws).toBe('production');
        expect(dash.querySelector('.ws-pd[href="/dashboards/past-due-orders.html"]')).not.toBeNull();
    });

    test('no card leaves a hole: a 2-of-3 span never sits alone on its row', () => {
        for (const panel of panels) {
            const cards = [...panel.querySelectorAll(':scope > .ws-grid > .ws-card')];
            let col = 0;
            for (const c of cards) {
                const span = c.classList.contains('ws-card--full') ? 3 : c.classList.contains('ws-card--wide') ? 2 : 1;
                if (col + span > 3) col = 0;        // wraps to the next row
                col += span;
                if (col === 3) col = 0;
            }
            // whatever is left on the last row must not be a lone 2-span
            const last = cards[cards.length - 1];
            const loneWide = !!(last && last.classList.contains('ws-card--wide') && col === 2);
            expect({ tab: panel.dataset.ws, loneWide }).toEqual({ tab: panel.dataset.ws, loneWide: false });
        }
    });

    test('customer bundle rows use one family (f-store) — colour means person/department', () => {
        for (const href of ['/DrainPro-Bundle.html', '/streich-bros-bundle.html', '/wcttr-bundle.html', '/christmas-bundles.html']) {
            expect(dash.querySelector(`a.ws-link[href="${href}"]`).classList.contains('f-store')).toBe(true);
        }
        expect(dashboardHtml).not.toMatch(/f-client-|f-mint/);
    });

    test('search keywords ride on workspace rows (the palette harvests only a.ws-link)', () => {
        const withKw = [...dash.querySelectorAll('[data-keywords]')];
        expect(withKw.length).toBeGreaterThan(30);
        for (const el of withKw) expect(el.classList.contains('ws-link')).toBe(true);
    });

    test('stylesheets load in cascade order: tokens first, the unlayered overrides after the layered files, workspaces last', () => {
        const hrefs = [...dash.querySelectorAll('link[rel="stylesheet"][href^="/shared_components/css/staff-dashboard/"]')]
            .map((l) => l.getAttribute('href').split('/').pop().split('?')[0]);
        expect(hrefs[0]).toBe('tokens.css');
        expect(hrefs[hrefs.length - 1]).toBe('workspaces.css');
        const idx = (n) => hrefs.indexOf(n);
        for (const layered of ['tokens.css', 'base.css', 'components.css', 'utilities.css']) {
            expect(idx(layered)).toBeGreaterThan(-1);
            expect(idx(layered)).toBeLessThan(idx('dashboard-v3-theme.css'));
        }
        expect(idx('dashboard-v3-theme.css')).toBeLessThan(idx('dashboard-v3-patch-2.css'));
    });

    test('the Tweaks FAB and the sidebar controller are gone', () => {
        const app = readRepo('shared_components/js/staff-dashboard/core/dashboard-app.js');
        expect(app).not.toMatch(/tweaks-fab/);
        expect(fs.existsSync(path.join(ROOT, 'shared_components/js/staff-dashboard/widgets/tweaks-fab.js'))).toBe(false);
        expect(fs.existsSync(path.join(ROOT, 'shared_components/js/staff-dashboard/controllers/sidebar-controller.js'))).toBe(false);
    });
});

describe('Rule 3 — no inline code', () => {
    test.each([['staff-dashboard-v3/index.html', dashboardHtml], ['dashboards/company-numbers.html', numbersHtml]])(
        '%s has no <style> or inline <script> body', (_name, raw) => {
            // Comments may TALK about <style> (index.html explains why it has none).
            const html = raw.replace(/<!--[\s\S]*?-->/g, '');
            expect(html).not.toMatch(/<style[\s>]/i);
            const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
                .filter((m) => m[1].trim().length > 0);
            expect(inlineScripts).toEqual([]);
            expect(html).not.toMatch(/\sstyle="/);
        });
});
