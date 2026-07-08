/**
 * Roadmap 1.3 lock — the quote builders load NO executable code or styles
 * from third-party CDNs.
 *
 * Bootstrap/Font Awesome/EmailJS are vendored under shared_components/vendor/
 * (pinned: bootstrap 5.1.3, FA 6.6.0, @emailjs/browser 3.12.1) so a CDN
 * compromise can't run attacker JS in pages handling customer PII and
 * pricing — and a floating tag like @3 can't silently change behavior.
 *
 * Allowed external refs: cdn.caspio.com images/favicons (content, not code)
 * and Google Fonts stylesheets (tracked for a later phase; script-src is the
 * attack surface this locks).
 */

const fs = require('fs');
const path = require('path');

const BUILDERS = [
    'embroidery-quote-builder.html',
    'screenprint-quote-builder.html',
    'dtf-quote-builder.html',
    'dtg-quote-builder.html',
];

const CODE_CDN_HOSTS = /https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)\//;

describe.each(BUILDERS)('%s', (file) => {
    const html = fs.readFileSync(path.join(__dirname, '../../quote-builders', file), 'utf8');

    test('no script/style loaded from a code CDN', () => {
        const externalRefs = [...html.matchAll(/(?:src|href)="(https:\/\/[^"]+)"/g)].map((m) => m[1]);
        const cdnRefs = externalRefs.filter((u) => CODE_CDN_HOSTS.test(u));
        expect(cdnRefs).toEqual([]);
    });

    test('no floating-major package tag anywhere (e.g. @3/)', () => {
        expect(html).not.toMatch(/@\d+\/dist\//);
    });

    test('vendored EmailJS + Font Awesome are referenced instead', () => {
        expect(html).toContain('/shared_components/vendor/emailjs/email.min.js');
        expect(html).toContain('/shared_components/vendor/fontawesome/css/all.min.css');
    });
});

test('vendored assets exist on disk (a missing file would 404 in prod)', () => {
    const VENDORED = [
        'vendor/bootstrap/css/bootstrap.min.css',
        'vendor/bootstrap/js/bootstrap.bundle.min.js',
        'vendor/fontawesome/css/all.min.css',
        'vendor/fontawesome/webfonts/fa-solid-900.woff2',
        'vendor/fontawesome/webfonts/fa-regular-400.woff2',
        'vendor/fontawesome/webfonts/fa-brands-400.woff2',
        'vendor/emailjs/email.min.js',
        'vendor/dompurify/purify.min.js',
    ];
    for (const rel of VENDORED) {
        const p = path.join(__dirname, '../../shared_components', rel);
        expect(fs.existsSync(p)).toBe(true);
        expect(fs.statSync(p).size).toBeGreaterThan(1000);
    }
});

test('no DYNAMIC code-CDN loads from JS the builder pages ship (script.src injection)', () => {
    // embroidery-chat lazy-loaded DOMPurify from cdnjs — invisible to the HTML
    // scan above, caught by a runtime network sweep (1.3). Lock the JS too.
    const BUILDER_JS = ['embroidery-chat.js', 'sample-cart-service.js', 'quote-builder-utils.js'];
    for (const f of BUILDER_JS) {
        const src = fs.readFileSync(path.join(__dirname, '../../shared_components/js', f), 'utf8');
        expect(CODE_CDN_HOSTS.test(src)).toBe(false);
    }
});
