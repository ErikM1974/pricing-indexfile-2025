/**
 * Finished Photos (capture) + Finished Photos Library — 2026-09-05 review locks.
 *   Capture: no inline onerror (Rule 3); failed search / designs / manage loads say so instead of
 *   rendering "No matches" / "No registered designs" / "No photos yet"; publish + delete report their
 *   outcome; find modes are a real tablist with arrow keys and labelled panels; the camera/album labels
 *   are keyboard-operable; scanner + lightbox are labelled dialogs with focus return + Esc; the page
 *   allows pinch-zoom again; the back arrow no longer depends on a Font Awesome sheet it never loads.
 *   Library: no inline onerror; failed load has Retry; rep chips carry aria-pressed; publish/hide and
 *   view buttons are named per photo; lightbox is a labelled dialog with focus return.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const noComments = (s) => s.replace(/\/\/[^\n]*/g, '');

describe('finished photos (capture)', () => {
    const html = read('dashboards/finished-photos.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/finished-photos.js');
    test('Rule 3, zoom, icon dependency', () => {
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\./);
        expect(js).toMatch(/data-onerror="blank"/);
        expect(html).not.toMatch(/maximum-scale/);
        expect(html).not.toMatch(/<i class="fa/); // the page never loads Font Awesome
        expect(html).toMatch(/<span aria-hidden="true">&larr;<\/span> Dashboard/);
    });
    test('failures are honest and retryable', () => {
        expect(js).not.toMatch(/r\.ok \? r\.json\(\) : \{ contacts: \[\] \}/);
        expect(js).not.toMatch(/r\.ok \? r\.json\(\) : \{ designs: \[\] \}/);
        expect(js).not.toMatch(/r\.ok \? r\.json\(\) : \{ photos: \[\] \}/);
        expect(js).toMatch(/Search failed \(' \+ esc\(err\.message\) \+ '\)/);
        expect(js).toMatch(/id="fp-designs-retry"/);
        expect(js).toMatch(/id="fp-manage-retry"/);
        expect(js).toMatch(/setManageStatus\('err', '✗ Photo NOT ' \+ \(turnOn \? 'published' : 'hidden'\)/);
        expect(js).toMatch(/setManageStatus\('err', '✗ Photo NOT deleted: '/);
        expect(js).not.toMatch(/\.catch\(function \(\) \{ \}\);/);
    });
    test('tabs, keyboard labels, dialogs, focus', () => {
        for (const m of ['scan', 'order', 'search']) {
            expect(html).toMatch(new RegExp(`id="fp-mode-${m}"[^>]*aria-controls="fp-pane-${m}"`));
            expect(html).toMatch(new RegExp(`id="fp-pane-${m}" role="tabpanel" aria-labelledby="fp-mode-${m}"`));
        }
        expect(js).toMatch(/e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft'/);
        expect(html).toMatch(/id="fp-camera-btn" role="button" tabindex="0"/);
        expect(html).toMatch(/id="fp-album-btn" role="button" tabindex="0"/);
        expect(js).toMatch(/\['fp-camera-btn', 'fp-album-btn'\]\.forEach/);
        expect(html).toMatch(/class="fp-scan-sheet" role="dialog" aria-modal="true" aria-labelledby="fp-scan-title"/);
        expect(html).toMatch(/id="fp-lightbox" role="dialog" aria-modal="true" aria-label="Photo, full size" hidden/);
        expect(js).toMatch(/scanReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/lightboxReturnFocus = t;/);
        expect(js).toMatch(/if \(!el\('fp-lightbox'\)\.hidden\) closeLightbox\(\);\s*else if \(!el\('fp-scan-modal'\)\.hidden\) closeScanner\(\);/);
        expect(js).toMatch(/aria-pressed="' \+ \(on \? 'true' : 'false'\) \+ '"/);
        expect(js).toMatch(/function parseCalendarDate\(value\)/);
    });
});

describe('finished photos library', () => {
    const html = read('dashboards/finished-photos-library.html').replace(/<!--[\s\S]*?-->/g, '');
    const js = read('dashboards/js/finished-photos-library.js');
    test('Rule 3, retry, names, dialog, focus', () => {
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\./);
        expect(js).toMatch(/data-onerror="blank"/);
        expect(js).toMatch(/id="fpl-retry"/);
        expect(js).toMatch(/aria-pressed="' \+ \(active \? 'true' : 'false'\) \+ '"/);
        expect(js).toMatch(/aria-label="Hide ' \+ esc\(title\) \+ ' from the portal"/);
        expect(js).toMatch(/aria-label="Publish ' \+ esc\(title\) \+ ' to the portal"/);
        expect(js).toMatch(/aria-label="View full size: ' \+ esc\(capBits \|\| title\) \+ '"/);
        expect(html).toMatch(/id="fpl-lightbox" role="dialog" aria-modal="true" aria-labelledby="fpl-lightbox-cap" hidden/);
        expect(js).toMatch(/lightboxReturnFocus = document\.activeElement;/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).toMatch(/function parseCalendarDate\(value\)/);
    });
});
