/**
 * Staff-page consistency locks (2026-09-05 cross-page sweeps).
 *
 *   1. No staff page carries an inline <style> block or an inline <script> body (JSON-LD is
 *      data and is allowed). The 15 pages that did were extracted in v2026.09.05.8.
 *   2. Font Awesome is ONE build (6.4.0) across the staff pages — four versions had drifted.
 *   3. The Sales Coordinator manual keeps 44 real chapter links and shared external navigation.
 *   4. Every staff page links the site favicon (no Caspio-CDN icon, none missing).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function list(dir, filter = () => true) {
    return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html') && filter(f)).map((f) => `${dir}/${f}`);
}
const STAFF_PAGES = [
    ...list('dashboards', (f) => !/^(staff-login|staff-portal-final)\.html$/.test(f)),
    ...list('dashboards/reports'),
    ...list('training'),
    'pages/policies-hub.html', 'pages/policy-detail.html', 'pages/policy-questions.html',
    'pages/art-request-detail.html', 'pages/mockup-detail.html', 'pages/transfer-detail.html',
    'pages/quote-audit.html', 'pages/invoice.html', 'pages/quote-view.html', 'pages/garment-designer.html',
    'pages/box-labels.html', 'pages/mockup-library.html', 'pages/dst-viewer.html', 'pages/jds-mockup-creator.html',
    'calculators/purchasingform.html', 'calculators/embroidery-pricing-all/index.html', 'calculators/screenprint-customer/index.html',
];

describe('Rule 3 — no inline <style> / <script> bodies on staff pages', () => {
    test.each(STAFF_PAGES)('%s', (rel) => {
        const html = read(rel).replace(/<!--[\s\S]*?-->/g, '');
        expect(html).not.toMatch(/<style[\s>]/i);
        const bodies = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
            .filter((m) => m[2].trim() && !/application\/ld\+json/i.test(m[1]));
        expect(bodies.map((m) => m[2].trim().slice(0, 60))).toEqual([]);
    });
});

describe('one Font Awesome build', () => {
    test.each(STAFF_PAGES)('%s uses 6.4.0 (or none)', (rel) => {
        const versions = [...read(rel).matchAll(/font-awesome\/([0-9.]+[a-z0-9-]*)\//g)].map((m) => m[1]);
        for (const v of versions) expect(v).toBe('6.4.0');
    });
});

describe('Sales Coordinator manual', () => {
    test('chapter navigation is data-driven, not onclick=', () => {
        const html = read('training/sales-coordinator-manual.html').replace(/<!--[\s\S]*?-->/g, '');
        expect(html).not.toMatch(/\sonclick=/);
        const document = new (require('jsdom').JSDOM)(html).window.document;
        const links = [...document.querySelectorAll('.manual-contents [data-manual-link]')];
        expect(links).toHaveLength(44);
        for (const link of links) {
            const target = document.querySelector(link.getAttribute('href'));
            expect(target).not.toBeNull();
            expect(target.hasAttribute('data-manual-section')).toBe(true);
        }
        expect(document.querySelector('button[data-manual-top]')).not.toBeNull();
        expect(document.querySelector('script[src^="/shared_components/js/training-manual.js?"]')).not.toBeNull();
    });
});

describe('favicon', () => {
    // A site-hosted icon, never the old Caspio-CDN one. Two pages carry a deliberate icon of
    // their own (Design Vault /assets/favicon-32.png, Finished Photos' PWA icon) — allowed.
    test.each(STAFF_PAGES)('%s links a site-hosted favicon', (rel) => {
        const html = read(rel);
        const icon = html.match(/<link rel="icon"[^>]*href="([^"]+)"/);
        expect(icon && icon[1]).toMatch(/^\/[^"]+\.(png|ico|svg)$/);
        expect(icon[1]).not.toMatch(/caspio/);
    });
});
