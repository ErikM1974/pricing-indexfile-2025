/**
 * box-url.test.js — boxUrl() rewrites persisted Box READ URLs onto this origin.
 *
 * The Box read routes are moving behind the app's session-gated forwarder, but
 * absolute proxy URLs are already stored in Caspio (transfer/mockup
 * Thumbnail_URL and File_URL). Those rows are not being rewritten, so every
 * consumer normalises at render time instead — which makes this function the
 * thing standing between the proxy gate and every art image 401ing.
 */

const fs = require('fs');
const path = require('path');

const PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const { boxUrl } = require('../../shared_components/js/box-url.js');
const REPO = path.join(__dirname, '..', '..');

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

/**
 * DRIFT LOCK — the guard that was missing on 2026-08-05.
 *
 * box-url.js shipped with the Box gating but its <script> tag was only added to
 * the two transfer pages. Every art and mockup surface kept rendering stored
 * absolute proxy URLs, which 401 behind the gate, so Steve's "Previously Sent"
 * thumbnails (and the AE / Ruth / gallery cards) all went grey. The function
 * itself was fine and fully unit-tested — nothing loaded it.
 *
 * So: any page that loads a script calling boxUrl() must also load box-url.js,
 * and must load it FIRST. A page that drifts out of sync fails here.
 */
describe('box-url.js is loaded by every page whose scripts call boxUrl()', () => {
    const JS_DIRS = ['shared_components/js', 'pages/js', 'dashboards/js'];
    const CALLS_BOX_URL = /\bboxUrl\s*\(/;

    const listFiles = (dir, ext) => {
        const abs = path.join(REPO, dir);
        if (!fs.existsSync(abs)) return [];
        return fs.readdirSync(abs).filter(f => f.endsWith(ext)).map(f => `${dir}/${f}`);
    };

    // Every JS file that actually calls boxUrl() (box-url.js itself excluded).
    const consumers = JS_DIRS
        .flatMap(d => listFiles(d, '.js'))
        .filter(rel => !rel.endsWith('box-url.js'))
        .filter(rel => CALLS_BOX_URL.test(fs.readFileSync(path.join(REPO, rel), 'utf8')));

    // Every HTML page in the repo, with its markup.
    const pages = ['.', 'pages', 'dashboards', 'admin']
        .flatMap(d => listFiles(d, '.html'))
        .map(rel => ({ rel, html: fs.readFileSync(path.join(REPO, rel), 'utf8') }));

    test('the scan actually found consumers (guards against a silently empty test)', () => {
        expect(consumers.length).toBeGreaterThan(0);
        expect(pages.length).toBeGreaterThan(0);
    });

    // Index of the actual <script src="…basename…"> tag, or -1. Matching on a
    // bare filename would also hit prose in HTML comments — several pages name
    // their own script in a comment near the top, which made an order check
    // read backwards.
    const scriptTagIndex = (html, base) => {
        const re = new RegExp('<script[^>]+src=["\'][^"\']*' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const m = re.exec(html);
        return m ? m.index : -1;
    };

    // One case per (page, consumer script) pair that actually exists.
    const pairs = [];
    for (const c of consumers) {
        const base = path.basename(c);
        for (const p of pages) {
            if (scriptTagIndex(p.html, base) !== -1) pairs.push([p.rel, base, p.html]);
        }
    }

    test('every consumer script is reachable from at least one page', () => {
        const orphans = consumers.filter(c => !pairs.some(([, base]) => base === path.basename(c)));
        expect(orphans).toEqual([]);
    });

    test.each(pairs.map(([page, script]) => [page, script]))(
        '%s loads box-url.js for %s',
        (page, script) => {
            const html = pairs.find(([p, s]) => p === page && s === script)[2];
            const boxUrlAt = scriptTagIndex(html, 'box-url.js');
            expect(boxUrlAt).not.toBe(-1);
            // Order matters — boxUrl must be defined before the consumer runs.
            expect(boxUrlAt).toBeLessThan(scriptTagIndex(html, script));
        }
    );
});
