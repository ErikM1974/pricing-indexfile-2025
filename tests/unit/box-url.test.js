/**
 * box-url.test.js — boxUrl() rewrites persisted Box READ URLs onto this origin.
 *
 * The Box read routes are moving behind the app's session-gated forwarder, but
 * absolute proxy URLs are already stored in Caspio (transfer/mockup
 * Thumbnail_URL and File_URL). Those rows are not being rewritten, so every
 * consumer normalises at render time instead — which makes this function the
 * thing standing between the proxy gate and every art image 401ing.
 */

const PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const { boxUrl } = require('../../shared_components/js/box-url.js');

describe('boxUrl — persisted proxy READ urls come back to this origin', () => {
    test.each([
        ['thumbnail', `${PROXY}/api/box/thumbnail/2390339305815`, '/api/box/thumbnail/2390339305815'],
        ['download', `${PROXY}/api/box/download/2381411668688`, '/api/box/download/2381411668688'],
        ['art-folders', `${PROXY}/api/box/art-folders?limit=500`, '/api/box/art-folders?limit=500'],
        ['mockup-folders', `${PROXY}/api/box/mockup-folders?limit=500`, '/api/box/mockup-folders?limit=500'],
        ['folder-files', `${PROXY}/api/box/folder-files?folderId=400949924470`, '/api/box/folder-files?folderId=400949924470'],
        ['search', `${PROXY}/api/box/search?query=acme&type=folder`, '/api/box/search?query=acme&type=folder'],
    ])('%s', (_label, input, expected) => {
        expect(boxUrl(input)).toBe(expected);
    });

    test('query strings survive intact — size=large is what the lightbox relies on', () => {
        expect(boxUrl(`${PROXY}/api/box/thumbnail/123?size=large`))
            .toBe('/api/box/thumbnail/123?size=large');
    });

    test('an encoded shared-image url is not mangled', () => {
        const target = encodeURIComponent('https://nwca.box.com/shared/static/abc123.png');
        expect(boxUrl(`${PROXY}/api/box/shared-image?url=${target}`))
            .toBe(`/api/box/shared-image?url=${target}`);
    });
});

describe('boxUrl — leaves everything else alone', () => {
    test('WRITE routes are NOT rewritten (they still go straight to the proxy)', () => {
        for (const w of ['shared-link', 'create-mockup-folder', 'upload-to-folder', 'file/123']) {
            const u = `${PROXY}/api/box/${w}`;
            expect(boxUrl(u)).toBe(u);
        }
    });

    test('already-relative urls pass through unchanged (idempotent)', () => {
        const rel = '/api/box/thumbnail/123?size=large';
        expect(boxUrl(rel)).toBe(rel);
        expect(boxUrl(boxUrl(boxUrl(rel)))).toBe(rel);
    });

    test('applying it twice to an absolute url is stable', () => {
        const once = boxUrl(`${PROXY}/api/box/thumbnail/123`);
        expect(boxUrl(once)).toBe(once);
    });

    test('non-Box urls are untouched', () => {
        for (const u of [
            'https://nwca.box.com/shared/static/abc.png',
            'https://cdn.caspio.com/logo.png',
            'data:image/png;base64,QUJD',
            '/shared_components/img/placeholder.png',
        ]) {
            expect(boxUrl(u)).toBe(u);
        }
    });

    test('a look-alike path that is not a box read route is untouched', () => {
        const u = `${PROXY}/api/box-labels/thumbnail/1`;
        expect(boxUrl(u)).toBe(u);
    });

    test('null / undefined / non-strings do not throw', () => {
        for (const v of [null, undefined, '', 0, 42, {}, []]) {
            expect(() => boxUrl(v)).not.toThrow();
        }
        expect(boxUrl(null)).toBe(null);
        expect(boxUrl('')).toBe('');
    });

    test('garbage that only looks like a url is returned as-is', () => {
        const u = 'not a url /api/box/thumbnail/1';
        expect(typeof boxUrl(u)).toBe('string');
    });
});
