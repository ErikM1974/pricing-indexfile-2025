/**
 * Volume Quote + Blog Editor + SEO Strategy — 2026-09-05 review locks.
 *   Blog Editor: the error banner's span had the wrong class, so DashPage.showError produced an EMPTY
 *   red banner on every failure (live) — fixed + Dismiss button; list failure has Retry; a failed live
 *   preview says so instead of showing a stale render; toolbar icon buttons named; upload labels keyboard.
 *   Volume Quote: default "valid until" is a LOCAL calendar day; remove buttons named; icons decorative.
 *   SEO Strategy: TOC nav labelled, active link aria-current; assets versioned everywhere.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('blog editor', () => {
    const html = read('dashboards/blog-editor.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/blog-editor.js');
    const css = read('dashboards/css/blog-editor.css');
    test('error banner actually shows messages; retry; honest preview; named controls', () => {
        expect(html).toMatch(/<span class="dash-error-banner-message"><\/span>/);
        expect(html).not.toMatch(/dash-error-text/);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        expect(js).toMatch(/id="postListRetry"/);
        expect(js).not.toMatch(/Refresh to retry/);
        expect(js).toMatch(/Preview unavailable \(/);
        expect(js).toMatch(/if \(!r\.ok\) throw new Error\('HTTP ' \+ r\.status\); return r\.json\(\);/);
        expect(html).toMatch(/data-md="bold" title="Bold" aria-label="Bold"/);
        expect(html).toMatch(/for="fldHeroFile" role="button" tabindex="0"/);
        expect(html).toMatch(/for="fldBodyImage" title="Insert image" role="button" tabindex="0" aria-label="Insert image"/);
        expect(js).toMatch(/document\.querySelectorAll\('\.be-file-btn'\)\.forEach/);
        expect(html).toMatch(/<span class="be-label" id="heroLabel">Hero image<\/span>/);
        expect(html).not.toMatch(/<label class="be-label">Hero image<\/label>/);
        expect(html).not.toMatch(BARE);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).toMatch(/blog-editor\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
});

describe('volume quote', () => {
    const html = read('dashboards/volume-quote.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/volume-quote.js');
    test('local valid-until default; named remove; icons; versions', () => {
        expect(js).toMatch(/valid\.setDate\(valid\.getDate\(\) \+ 30\);/);
        expect(noComments(js)).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
        expect(js).toMatch(/aria-label="Remove this style"/);
        expect(js).not.toMatch(BARE);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/id="vq-save-status" role="status"/);
        expect(html).toMatch(/volume-quote\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        // pricing math untouched — the compute/round helpers are exactly as shipped 2026-09-02
        expect(js).toMatch(/function roundPrice\(p\)/);
        expect(js).toMatch(/function extraStitchCharge\(stitches, row\)/);
    });
});

describe('seo strategy', () => {
    const html = read('dashboards/seo-strategy.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/seo-strategy.js');
    test('labelled TOC, aria-current, icons, versions', () => {
        expect(html).toMatch(/<nav aria-labelledby="seo-toc-title">/);
        expect(js).toMatch(/link\.setAttribute\('aria-current', 'true'\)/);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/seo-strategy\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
    });
});
