/**
 * Staff pages — live-probe hygiene locks (2026-09-06, the teamnwca.com runtime pass).
 *   A signed-in walk of every dashboard-linked page found things the static locks could not see:
 *   handlers and icons rendered by scripts, <style> blocks injected at runtime, unversioned assets.
 *   This lock closes each class at the SOURCE:
 *     1. No inline handlers in the staff pages or the scripts that render into them (garment designer,
 *        AE dashboard, pride wall, DrainPro, submit forms) — data-call-delegator.js now also covers
 *        input, new-tab opens and image load/error outcomes.
 *     2. No `createElement('style')` in the shared scripts whose styles moved to real stylesheets, and
 *        every consumer page links those stylesheets.
 *     3. Icons decorative in every staff HTML/JS surface (any attribute order, dynamic forms too).
 *     4. Every local asset versioned on the staff pages; the employee-bundle pages carry no inline <style>.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const stripJs = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const BARE = /<i\b(?![^>]*aria-hidden)[^>]*\bclass="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"[^>]*><\/i>/;
const DYN = /<i\b(?![^>]*aria-hidden)[^>]*\bclass="fas (?:fa-)?\$\{[^}]+\}[^"]*"[^>]*><\/i>/;
const HANDLER = /\son(change|input|blur|keydown|keyup|keypress|error|click|submit|load)=/;
const STAFF_HTML = ['access-admin', 'ae-mission-control', 'api-usage', 'art-hub-ruth', 'art-hub-steve', 'bandit-integration', 'blog-editor', 'bradley-transfers', 'caspio-api-reference', 'commission-structure', 'company-numbers', 'contract-break-even', 'customer-portal-admin', 'design-gallery', 'design-queue', 'digitized-designs', 'drive-access', 'finished-photos-library', 'finished-photos', 'form-submissions', 'forms-library', 'gear-publisher', 'house-accounts', 'jim-mailing-list', 'lead-scorecard', 'leads', 'manageorders-api-reference', 'monogram-dashboard', 'names-numbers-dashboard', 'nika-crm', 'old-designs', 'past-due-orders', 'payroll', 'policy-migration', 'portal-directory', 'pricing-analysis', 'product-manager', 'production-shifts', 'purchasing-portal', 'quote-management', 'roland-printer-supplies', 'sanmar-api-reference', 'sanmar-ftp-integration', 'sanmar-payables', 'sanmar-shopworks-converter', 'seo-strategy', 'shopworks-odbc-reference', 'supacolor-orders', 'table-usage-audit', 'taneisha-crm', 'unqualified-leads', 'volume-quote', 'ae-dashboard', 'DrainPro-Bundle'].map((n) => `dashboards/${n}.html`).concat([
    'dashboards/reports/price-audit-report.html', 'admin/universal-records-admin.html', 'employee-bundles/streich-bros-bundle.html', 'employee-bundles/wcttr-bundle.html', 'staff-dashboard-v3/index.html',
    'pages/data-entry-guide.html', 'pages/dst-viewer.html', 'pages/garment-designer.html', 'pages/mockup-library.html', 'pages/policies-hub.html', 'pages/policy-detail.html', 'pages/box-labels.html', 'pages/jds-mockup-creator.html', 'tools/custom-tees-calibrate.html',
    'training/index.html', 'training/customer-service.html', 'training/quick-reference-tips.html', 'training/sales-coordinator-manual.html', 'training/sanmar-purchasing-guide.html', 'training/shipping-receiving-guide.html', 'training/training-games-hub.html',
    'calculators/dtg-contract/index.html', 'calculators/embroidered-emblem/index.html', 'calculators/embroidery-contract/index.html', 'calculators/embroidery-pricing-all/index.html', 'calculators/screenprint-customer/index.html',
    // second-hop / unlinked staff pages (2026-09-06 backlog batch): every remaining page under these directories
    ...['dashboards', 'admin', 'training', 'tools', 'employee-bundles'].flatMap((d) => (exists(d) ? fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`) : []))]).filter(exists); // the dashboard-linked set (2026-09-06 live census) + the unlinked backlog
const RENDERERS = ['shared_components/js/mockup-ae.js', 'shared_components/js/art-ae.js', 'shared_components/js/ae-dashboard.js', 'shared_components/js/garment-submit-form.js', 'shared_components/js/mockup-submit-form.js',
    'shared_components/js/sticker-banner-submit-form.js', 'shared_components/js/jds-submit-form.js', 'pages/js/garment-designer.js', 'dashboards/js/DrainPro-Bundle.js',
    'shared_components/js/staff-dashboard/controllers/pride-wall-controller.js', 'shared_components/js/policies/policy-detail.js', 'shared_components/js/policies/policies-hub.js',
    'shared_components/js/policies/policy-comments.js', 'shared_components/js/policies/policy-editor-tiptap.js', 'shared_components/js/policies/policy-ai-assist.js', 'shared_components/js/policies/policy-mermaid.js',
    'pages/js/dst-viewer.js', 'admin/js/universal-records-admin.js', 'dashboards/js/design-gallery-drawer.js', 'dashboards/js/design-gallery-grid.js', 'dashboards/js/design-gallery-rails.js', 'dashboards/js/design-gallery.js',
    // the forms-library shared scripts render the save button, date pickers and banners (live probe 2026-09-06: 5 bare icons on every form)
    'pages/forms/nwca-form-save.js', 'pages/forms/nwca-form-dates.js', 'pages/forms/nwca-form-shared.js'].filter(exists);
const MOVED_STYLES = {
    'shared_components/js/elapsed-time-utils.js': 'shared_components/css/elapsed-time-utils.css',
    'shared_components/js/company-contact-picker.js': 'shared_components/css/company-contact-picker.css',
    'shared_components/js/toast-notifications.js': 'shared_components/css/toast-notifications.css',
    'admin/js/universal-records-admin.js': 'admin/css/universal-records-admin-injected.css',
    'shared_components/js/embroidery-quote-pricing.js': 'shared_components/css/embroidery-quote-pricing.css',
    'shared_components/js/quote-session.js': 'shared_components/css/quote-session.css',
    'shared_components/js/universal-pricing-grid.js': 'shared_components/css/universal-pricing-grid.css',
};

describe('staff pages (static surface)', () => {
    test('page list resolves', () => { expect(STAFF_HTML.length).toBeGreaterThan(60); });
    test.each(STAFF_HTML)('%s', (rel) => {
        const html = strip(read(rel));
        expect(html).not.toMatch(HANDLER);
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/); // no inline script with content
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)(?!shared_components\/vendor\/)[^"?]+\.(css|js)"/);
    });
});

describe('scripts that render into staff pages', () => {
    test.each(RENDERERS)('%s', (rel) => {
        const js = stripJs(read(rel));
        expect(js).not.toMatch(HANDLER);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(DYN);
    });
    test('delegator covers input, open, image error/load', () => {
        const d = read('shared_components/js/data-call-delegator.js');
        expect(d).toMatch(/document\.addEventListener\('input', onInput\)/);
        expect(d).toMatch(/document\.addEventListener\('error', onImgError, true\)/);
        expect(d).toMatch(/document\.addEventListener\('load', onImgLoad, true\)/);
        expect(d).toMatch(/el\.dataset\.open/);
        for (const p of ['pages/garment-designer.html', 'dashboards/ae-dashboard.html', 'dashboards/DrainPro-Bundle.html']) {
            expect(read(p)).toMatch(/data-call-delegator\.js\?v=/);
        }
        expect(read('shared_components/js/ae-dashboard.js')).toMatch(/window\.aeArtCardImageError = function/);
    });
    test('submit-form labels are wired to their inputs', () => {
        for (const f of ['mockup-submit-form', 'garment-submit-form', 'sticker-banner-submit-form', 'jds-submit-form']) {
            const js = read(`shared_components/js/${f}.js`);
            expect(js).toMatch(/<label for="[a-z-]+" class="[a-z]+-(?:field-)?label">/);
        }
    });
});

describe('injected styles moved to stylesheets', () => {
    test.each(Object.keys(MOVED_STYLES))('%s', (js) => {
        expect(read(js)).not.toMatch(/createElement\('style'\)/);
        expect(exists(MOVED_STYLES[js])).toBe(true);
        expect(read(MOVED_STYLES[js]).length).toBeGreaterThan(50);
    });
    test('toast consumers link the stylesheet that owns their presentation', () => {
        for (const p of ['dashboards/design-gallery.html', 'pages/art-request-detail.html', 'pages/invoice.html', 'pages/quote-view.html']) {
            if (read(p).includes('data-ui="unified"')) {
                expect(read(p)).toContain('/shared_components/css/components.css?v=');
                expect(read('shared_components/css/components.css')).toContain('.nwca-toast-container');
                expect(read('shared_components/js/toast-notifications.js')).toContain("classList.add('nwca-toast-container')");
            } else {
                expect(read(p)).toContain('/shared_components/css/toast-notifications.css?v=');
            }
        }
    });
    test('data-entry-guide has an h1', () => {
        expect(read('pages/data-entry-guide.html')).toMatch(/<h1 class="page-title">/);
    });
});
