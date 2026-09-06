/**
 * Design Vault + 253gear Publisher — 2026-09-05 review locks.
 *   Both were already strong (drawer focus trap, retries, textContent renderers). Fixes: every
 *   decorative icon aria-hidden (236 bare live on the Vault), tier pills / source chips / density
 *   buttons carry aria-pressed, icon-only buttons named, layout values (boot bar, virtual-scroll
 *   spacers, progress bar) via CSS custom properties instead of .style.width/height, the Publisher's
 *   status lines announce and its step rail carries aria-current.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const BARE_DYN = /<i class="fas ' \+/;

describe('design vault', () => {
    const html = read('dashboards/design-gallery.html').replace(/<!--[\s\S]*?-->/g, '');
    const files = ['design-gallery', 'design-gallery-grid', 'design-gallery-rails', 'design-gallery-drawer']
        .map((f) => read(`dashboards/js/${f}.js`));
    const css = read('dashboards/css/design-gallery.css');
    test('icons decorative everywhere; named icon buttons; pressed-state filters', () => {
        expect(html).not.toMatch(BARE);
        for (const f of files) { expect(f).not.toMatch(BARE); expect(f).not.toMatch(BARE_DYN); }
        expect(html).toMatch(/id="dg-customer-load"[^>]*aria-label="Open customer portfolio"/);
        expect(html).toMatch(/data-density="wall" title="Wall" aria-label="Wall card size" aria-pressed="false"/);
        expect(files[0]).toMatch(/data-tier="" aria-pressed="' \+ \(!st\.tier \? 'true' : 'false'\) \+ '"/);
        expect(files[0]).toMatch(/aria-pressed="' \+ \(srcOn \? 'true' : 'false'\) \+ '"/);
        expect(files[0]).toMatch(/btns\[i\]\.setAttribute\('aria-pressed', on \? 'true' : 'false'\);/);
    });
    test('no .style.width/height/visibility — custom properties + CSS', () => {
        for (const f of files) expect(f).not.toMatch(/\.style\.(width|height|visibility|overflowAnchor|display)/);
        expect(files[0]).toMatch(/els\.bootBar\.style\.setProperty\('--w'/);
        expect(files[1]).toMatch(/els\.topSpacer\.style\.setProperty\('--h'/);
        expect(files[1]).toMatch(/img\.classList\.add\('is-blank'\);/);
        expect(css).toMatch(/\.dg-boot-bar \{ width: var\(--w, 8%\); \}/);
        expect(css).toMatch(/\.dg-spacer \{ height: var\(--h, 0px\); \}/);
        expect(css).toMatch(/\.dg-grid-viewport \{ overflow-anchor: none; \}/);
        expect(html).toMatch(/role="progressbar" aria-label="Index download"/);
        expect(html).toMatch(/design-gallery\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
});

describe('253gear publisher', () => {
    const html = read('dashboards/gear-publisher.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/gear-publisher.js');
    const images = read('dashboards/js/gear-publisher-images.js');
    const css = read('dashboards/css/gear-publisher.css');
    test('status lines announce; step rail aria-current; progress via custom property', () => {
        for (const id of ['gp-ocr-status', 'gp-dup-status', 'gp-copy-status', 'gp-wordcount', 'gp-counter', 'gp-publish-reason']) {
            expect(html).toMatch(new RegExp(`id="${id}" role="status"`));
        }
        expect(html).toMatch(/id="gp-blockers" class="gp-blockers" role="status" aria-live="polite"/);
        expect(html).toMatch(/<li data-step="identity" aria-current="step">/);
        expect(js).toMatch(/tab\.setAttribute\('aria-current', 'step'\); else tab\.removeAttribute\('aria-current'\);/);
        expect(images).not.toMatch(/style="width:/);
        expect(images).toMatch(/role="progressbar" aria-valuemin="0" aria-valuemax="100"/);
        expect(css).toMatch(/\.gp-cell-progress-bar \{ height: 100%; width: var\(--w, 0%\);/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/gear-publisher\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).not.toMatch(/<button class=/);
    });
});
