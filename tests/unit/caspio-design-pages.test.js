/**
 * Digitized Designs + Old Designs (Caspio-embed pages) — 2026-09-05 review locks.
 *   Digitized: AL pricing tables come from /api/al-pricing (Caspio Embroidery_Costs) with a VISIBLE
 *   fallback note (were hardcoded); no inline onerror; thumbnails are buttons (keyboard preview);
 *   AL + image modals are labelled dialogs with focus return; rows with a blank Design Number derive
 *   it from the DST filename and say so; details toggle carries aria-expanded; Caspio watchdog.
 *   Old Designs: no .style.display toggles (hidden attr); injected actions typed + named; icons
 *   decorative; thumbnails keyboard-openable; modal dialog + focus return; toast announces; watchdog.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('digitized designs', () => {
    const html = read('dashboards/digitized-designs.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/digitized-designs.js');
    const css = read('dashboards/css/digitized-designs.css');
    test('AL pricing from the API with visible fallback; no hardcoded tables in the render path', () => {
        expect(js).toMatch(/fetch\(API_BASE \+ '\/api\/al-pricing'\)/);
        expect(js).toMatch(/function alData\(\) \{ return alPricing \|\| AL_FALLBACK; \}/);
        expect(js).toMatch(/Showing reference prices — Caspio pricing unavailable/);
        expect(js).not.toMatch(/GARMENT_AL|CAP_AL/);
        expect(js).not.toMatch(/\+\$50 LTM/);
        expect(js).not.toMatch(/Full Back LTM Fee: \$100\.00/);
        expect(html).toMatch(/id="al-source-note" role="status"/);
    });
    test('Rule 3, dialogs, keyboard previews, derived design number', () => {
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\./);
        expect(js).toMatch(/data-onerror="hide"/);
        expect(js).toMatch(/<button type="button" class="img-btn" aria-label="Enlarge /);
        expect(js).toMatch(/rel="noopener" class="mockup-link"/);
        expect(html).toMatch(/id="image-modal" role="dialog" aria-modal="true" aria-label="Design preview, full size"/);
        expect(html).toMatch(/class="al-modal-content" role="dialog" aria-modal="true" aria-labelledby="al-modal-title"/);
        expect(html).toMatch(/class="al-modal-close" type="button" aria-label="Close pricing"/);
        expect(js).toMatch(/alReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/imageReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/aria-expanded="false" aria-controls="' \+ detailsId/);
        expect(js).toMatch(/designFromFile = true;/);
        expect(js).toMatch(/\(from DST file\)/);
        expect(js).toMatch(/The Caspio list did not load/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).toMatch(/digitized-designs\.css\?v=2026\./);
    });
});

describe('old designs', () => {
    const html = read('dashboards/old-designs.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('shared_components/js/old-designs.js');
    const css = read('shared_components/css/old-designs.css');
    test('hidden attr instead of style toggles; typed + named controls; decorative icons', () => {
        expect(js).not.toMatch(/\.style\./);
        expect(js).toMatch(/modalCounter\.hidden = !many;/);
        expect(js).toMatch(/img\.hidden = true;/);
        expect(js).toMatch(/<button type="button" class="card-action-btn card-copy-btn" title="Copy design number" aria-label="Copy design number">/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).not.toMatch(/<button class=/);
        expect(html).toMatch(/id="toast-container" role="status" aria-live="polite"/);
    });
    test('modal dialog with focus return; keyboard previews; watchdog; versions', () => {
        expect(html).toMatch(/id="image-modal" role="dialog" aria-modal="true" aria-label="Design preview, full size" tabindex="-1"/);
        expect(js).toMatch(/modalReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/img\.setAttribute\('role', 'button'\);/);
        expect(js).toMatch(/e\.target\.closest\('img\[role="button"\]'\)/);
        expect(js).toMatch(/The Caspio list did not load/);
        expect(js).toMatch(/toast\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\);/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(css).toMatch(/:focus-within \.card-actions \{ opacity: 1; \}/);
        expect(html).toMatch(/old-designs\.js\?v=2026\./);
    });
});
