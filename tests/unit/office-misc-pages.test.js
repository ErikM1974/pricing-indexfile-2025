/**
 * Jim's Mailing List + Commission Structure — 2026-09-05 review locks.
 *   Jim: the page's flex wrappers beat the UA [hidden] rule — the empty screenshot placeholder and its
 *   Remove button showed on every load (live). Guard added; view buttons + chips carry aria-pressed; load
 *   failure shows the reason + Try again; screenshot label keyboard-operable; icons decorative.
 *   Commission Structure: 22 inline style= moved to CSS classes; accordion headers are <button
 *   aria-expanded aria-controls> (were click-only divs); 28 icons decorative; assets versioned.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;

describe("jim's mailing list", () => {
    const html = read('dashboards/jim-mailing-list.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/jim-mailing-list.js');
    const css = read('dashboards/css/jim-mailing-list.css');
    test('hidden guard, pressed states, retry, keyboard label, hygiene', () => {
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).toMatch(/id="jml-view-mine" data-view="mine" aria-pressed="false"/);
        expect(js).toMatch(/el\('jml-view-all'\)\.setAttribute\('aria-pressed', isAll \? 'true' : 'false'\);/);
        expect(js).toMatch(/data-cat="' \+ esc\(c\.cat\) \+ '" aria-pressed="' \+ \(active \? 'true' : 'false'\) \+ '"/);
        expect(js).toMatch(/data-act="retry">Try again<\/button>/);
        expect(js).toMatch(/if \(act === 'retry'\) \{ load\(\); return; \}/);
        expect(js).not.toMatch(/\.style\./);
        expect(html).toMatch(/<label class="jml-ai-imgbtn" for="jml-ai-file" role="button" tabindex="0">/);
        expect(html).toMatch(/id="jml-ai-file" accept="image\/\*" class="jml-visually-hidden" aria-label="Choose a screenshot"/);
        expect(js).toMatch(/e\.preventDefault\(\); el\('jml-ai-file'\)\.click\(\);/);
        expect(html).not.toMatch(BARE);
        expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
        expect(html).toMatch(/jim-mailing-list\.js\?v=2026\.09\./);
    });
});

describe('commission structure', () => {
    const html = read('dashboards/commission-structure.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/commission-structure.js');
    const css = read('dashboards/css/commission-structure.css');
    test('no inline style; accordion buttons with aria-expanded; icons decorative; versions', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(BARE);
        expect((html.match(/<button type="button" class="accordion-header" data-call="toggleAccordion" data-args='\["\$this"\]' aria-expanded="(true|false)" aria-controls="cs-acc-\d"/g) || []).length).toBe(3);
        expect((html.match(/<div class="accordion-content" id="cs-acc-\d">/g) || []).length).toBe(3);
        expect(html).not.toMatch(/<div class="accordion-header"/);
        expect(js).toMatch(/header\.setAttribute\('aria-expanded', 'true'\);/);
        expect(css).toMatch(/\.cs-lead \{ margin: 0 0 18px;/);
        expect(css).toMatch(/\.detail-table \.num \{ text-align: right; \}/);
        expect(css).toMatch(/button\.accordion-header \{ width: 100%;/);
        expect(html).toMatch(/commission-structure\.css\?v=2026\.09\./);
        expect(html).toMatch(/<td class="num">/);
        expect(html).toMatch(/class="scenario-icon scenario-icon--danger" aria-hidden="true"/);
    });
});
