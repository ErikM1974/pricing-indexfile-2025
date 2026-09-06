/**
 * Steve's Queue (art-hub-steve) — 2026-09-05 review locks.
 *   Rule 3: no inline onerror in the gallery/steve renderers (data-onerror + one capture listener);
 *   the page's own inline style= are gone (only the approval-modal internals driven by the shared
 *   module remain, and they are counted). Status chips / view toggle / Select / Archive are pressed-
 *   state buttons; clicking the active chip returns to All. Cards have a keyboard path (title link,
 *   rep filter button). Notes panel, approval modal, image modal, broken-mockups modal and the shared
 *   art-time modal are labelled dialogs with focus in/return (+ Esc). Due dates parse as calendar
 *   dates. The shared module's art rate comes from Service_Codes GRT-75 with a VISIBLE fallback.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const noComments = (s) => s.replace(/\/\/[^\n]*/g, '');

const html = read('dashboards/art-hub-steve.html').replace(/<!--[\s\S]*?-->/g, '');
const gallery = read('shared_components/js/art-hub-steve-gallery.js');
const steve = read('shared_components/js/art-hub-steve.js');
const shared = read('shared_components/js/art-actions-shared.js');
const css = read('dashboards/css/art-hub-steve.css');

describe('steve queue — Rule 3 + structure', () => {
    test('no inline handlers; inline style only inside the shared-module-owned approval internals', () => {
        expect(noComments(gallery)).not.toMatch(/(?<!data-)onerror=/);
        expect(gallery).not.toMatch(/style="/);
        expect(gallery).not.toMatch(/\.style\./);
        expect(steve).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change)=/);
        // approval-overlay/modal + box-picker/cc/prev sections: display is toggled by art-actions-shared.js
        expect((html.match(/style="display:none;"/g) || []).length).toBeLessThanOrEqual(11);
        expect(html).not.toMatch(/style="(?!display:none;")/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(gallery).toMatch(/document\.addEventListener\('error', function \(e\)/);
        expect(gallery).toMatch(/data-onerror="thumb"/);
        expect(gallery).toMatch(/data-onerror="hide-parent"/);
    });
    test('one h1, tools nav, versions bumped everywhere the shared module is loaded', () => {
        expect((html.match(/<h1\b/g) || []).length).toBe(1);
        expect(html).toMatch(/<nav class="tab-buttons" aria-label="Steve's tools">/);
        expect(html).toMatch(/class="tab-button active" aria-current="page"/);
        const v = /art-actions-shared\.js\?v=(2026\.\d{2}\.\d{2}\.\d+)/.exec(html)[1];
        for (const f of ['dashboards/ae-dashboard.html', 'pages/art-request-detail.html', 'pages/mockup-detail.html']) {
            expect(read(f)).toContain('art-actions-shared.js?v=' + v);
        }
    });
});

describe('steve queue — controls + dialogs', () => {
    test('pressed-state chips/toggles; active chip toggles back to All; keyboard card paths', () => {
        expect(gallery).toMatch(/<button type="button" class="status-stat status-stat--' \+ p\.modifier/);
        expect(gallery).toMatch(/aria-pressed="' \+ \(isActive \? 'true' : 'false'\) \+ '"/);
        expect(gallery).toMatch(/applyStatus\(key === currentStatus && key !== 'all' \? 'all' : key\);/);
        expect(gallery).toMatch(/id="steve-gallery-select" class="sg-btn" aria-pressed="false"/);
        expect(gallery).toMatch(/archiveBtn\.setAttribute\('aria-pressed'/);
        expect(gallery).toMatch(/<a class="card-open" href="\/art-request\/' \+ encodeURIComponent\(designId\)/);
        expect(gallery).toMatch(/var openLink = e\.target\.closest\('a\.card-open'\);/);
        expect(gallery).toMatch(/<button type="button" class="card-rep-name" data-action="filter-rep"/);
        expect(gallery).toMatch(/loadMore\.hidden = hidden <= 0;/);
        expect(gallery).toMatch(/bar\.hidden = !selectMode;/);
        expect(html).toMatch(/data-view="grid" aria-pressed="true"/);
        expect(steve).toMatch(/btn\.setAttribute\('aria-pressed', on \? 'true' : 'false'\);/);
        expect(steve).toMatch(/gridView\.hidden = true;/);
        expect(steve).toMatch(/\.kanban-card\[hidden\]/);
        expect(steve).toMatch(/<button type="button" class="kanban-show-all"/);
    });
    test('dialogs are labelled with focus in/return and Esc', () => {
        expect(html).toMatch(/id="notes-panel" class="notes-panel" role="dialog" aria-modal="true" aria-labelledby="notes-panel-company"/);
        expect(html).toMatch(/id="notes-panel-close" aria-label="Close notes"/);
        expect(html).toMatch(/id="approval-modal" class="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title"/);
        expect(html).toMatch(/id="imageModal" class="modal" role="dialog" aria-modal="true" aria-label="Enlarged artwork"/);
        expect(html).toMatch(/<button type="button" class="close" id="imageModalClose" aria-label="Close">/);
        expect(html).toMatch(/<label for="approval-minutes">This session:<\/label>/);
        expect(steve).toMatch(/notesReturnFocus = document\.activeElement;/);
        expect(steve).toMatch(/loading\.hidden = false;/);
        expect(steve).toMatch(/imageModal\.classList\.contains\('show'\)\) imageModal\.classList\.remove\('show'\);/);
        expect(steve).toMatch(/class="broken-mockups-modal" role="dialog" aria-modal="true" aria-labelledby="bml-title"/);
        expect(steve).toMatch(/overlay\.__returnFocus = document\.activeElement;/);
        expect(shared).toMatch(/_approvalReturnFocus = document\.activeElement;/);
        expect(shared).toMatch(/modal\.setAttribute\('role', 'dialog'\);/);
        expect(shared).toMatch(/function atEsc\(e\)/);
        expect(shared).toMatch(/<label class="art-modal-label" for="at-minutes">/);
        expect(shared).not.toMatch(/<button id="at-(minus|plus|cancel|submit)"/);
    });
    test('calendar dates', () => {
        expect(gallery).toMatch(/function parseCalendarDate\(value\)/);
        expect(gallery).toMatch(/var due = parseCalendarDate\(dueDateStr\);/);
        expect(steve).toMatch(/var due = parseCalendarDate\(dueDateStr\);/);
    });
});

describe('shared art actions — art rate from Service_Codes (Erik\'s pricing rule)', () => {
    test('no hardcoded * 75 in cost math; live GRT-75 with a visible fallback', () => {
        expect(noComments(shared)).not.toMatch(/\* 75\)/);
        expect(shared).toMatch(/function artRate\(\)/);
        expect(shared).toMatch(/\/api\/service-codes\?code=GRT-75/);
        expect(shared).toMatch(/_artRateLive/);
        expect(shared).toMatch(/function artRateNote\(\)/);
    });
});
