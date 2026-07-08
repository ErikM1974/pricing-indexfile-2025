/**
 * Locks the asset-manifest rewrite behavior the builder pages depend on
 * (roadmap 0.1). server.js serves the 3 builder HTMLs through
 * rewriteHtmlAssets(); a regression here silently un-hashes production
 * assets (slow, but working) or — worse — mangles a src into a 404.
 */

const {
    rewriteHtmlAssets,
    cssHasRelativeUrls,
    escapeRegExp,
    createManifestLoader,
} = require('../../../lib/asset-manifest');

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('rewriteHtmlAssets', () => {
    const manifest = {
        '/shared_components/js/quote-builder-utils.js':
            '/dist/shared_components/js/quote-builder-utils.abc123def0.js',
        '/config/app.config.js': '/dist/config/app.config.1234567890.js',
        '/shared_components/css/quote-builder-common.css':
            '/dist/shared_components/css/quote-builder-common.fedcba9876.css',
    };

    test('rewrites src with a legacy ?v= query', () => {
        const html = '<script src="/shared_components/js/quote-builder-utils.js?v=2026.07.07.10"></script>';
        expect(rewriteHtmlAssets(html, manifest)).toBe(
            '<script src="/dist/shared_components/js/quote-builder-utils.abc123def0.js"></script>'
        );
    });

    test('rewrites src without a query string', () => {
        const html = '<script src="/config/app.config.js"></script>';
        expect(rewriteHtmlAssets(html, manifest)).toBe(
            '<script src="/dist/config/app.config.1234567890.js"></script>'
        );
    });

    test('rewrites stylesheet href', () => {
        const html = '<link rel="stylesheet" href="/shared_components/css/quote-builder-common.css?v=20260601">';
        expect(rewriteHtmlAssets(html, manifest)).toBe(
            '<link rel="stylesheet" href="/dist/shared_components/css/quote-builder-common.fedcba9876.css">'
        );
    });

    test('leaves CDN and unlisted local files untouched', () => {
        const html = [
            '<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>',
            '<script src="/shared_components/js/not-in-manifest.js?v=1"></script>',
        ].join('\n');
        expect(rewriteHtmlAssets(html, manifest)).toBe(html);
    });

    test('does not partially match a longer path with a shared prefix', () => {
        // /config/app.config.js must not rewrite /config/app.config.js.bak-style
        // paths, nor match inside longer names.
        const html = '<script src="/config/app.config.jsx"></script>';
        expect(rewriteHtmlAssets(html, manifest)).toBe(html);
    });

    test('rewrites every occurrence, single or double quoted', () => {
        const html =
            "<script src='/config/app.config.js?v=1'></script>" +
            '<script src="/config/app.config.js?v=2"></script>';
        const out = rewriteHtmlAssets(html, manifest);
        expect(out).toBe(
            "<script src='/dist/config/app.config.1234567890.js'></script>" +
                '<script src="/dist/config/app.config.1234567890.js"></script>'
        );
    });

    test('null/missing manifest returns html unchanged', () => {
        const html = '<script src="/config/app.config.js"></script>';
        expect(rewriteHtmlAssets(html, null)).toBe(html);
        expect(rewriteHtmlAssets(html, undefined)).toBe(html);
    });
});

describe('cssHasRelativeUrls', () => {
    test.each([
        ['url(../images/logo.png)', true],
        ["url('fonts/fa-solid-900.woff2')", true],
        ['url("./bg.svg")', true],
        ['url(/images/logo.png)', false],
        ['url(https://cdn.caspio.com/x.png)', false],
        ['url(data:image/svg+xml;base64,abc)', false],
        ['url(#gradient)', false],
        ['color: red;', false],
    ])('%s → %s', (css, expected) => {
        expect(cssHasRelativeUrls(`.a { background: ${css} }`)).toBe(expected);
    });
});

describe('escapeRegExp', () => {
    test('escapes regex metacharacters so paths match literally', () => {
        const re = new RegExp('^' + escapeRegExp('/a+b(c).js') + '$');
        expect(re.test('/a+b(c).js')).toBe(true);
        expect(re.test('/aab(c)xjs')).toBe(false);
    });
});

describe('createManifestLoader', () => {
    test('returns null when the manifest is absent, and re-reads after a change', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-'));
        const manifestPath = path.join(dir, 'asset-manifest.json');
        const load = createManifestLoader(manifestPath);

        expect(load()).toBeNull();

        fs.writeFileSync(manifestPath, JSON.stringify({ '/a.js': '/dist/a.x.js' }));
        expect(load()).toEqual({ '/a.js': '/dist/a.x.js' });

        // Same mtime → cached object (no re-parse)
        const first = load();
        expect(load()).toBe(first);

        // Broken manifest → null (server falls back to source paths)
        fs.writeFileSync(manifestPath, '{not json');
        const later = new Date(Date.now() + 5000);
        fs.utimesSync(manifestPath, later, later);
        expect(load()).toBeNull();

        fs.rmSync(dir, { recursive: true, force: true });
    });
});
