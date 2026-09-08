/**
 * Bradley's Screen Print Queue — 2026-09-05 review locks (twin of bradley-transfers).
 *   The page had NO h1 (its title was an h2); API base was hardcoded; first-load failure left the
 *   spinner forever; stat chips were click-only divs; inline onerror/style throughout; the delete
 *   modal had no dialog semantics, focus handling or Esc.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/bradley-screenprint.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/bradley-screenprint.js');
const jsNoComments = js.replace(/\/\/[^\n]*/g, '');

describe('bradley screen print — structure + config', () => {
    test('exactly one h1; workflow calls use same-origin staff relays; config loaded first', () => {
        expect((html.match(/<h1\b/g) || []).length).toBe(1);
        expect(html).toMatch(/<h1 class="tab-title bt-title">/);
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
        expect(html.indexOf('/config/app.config.js')).toBeLessThan(html.indexOf('/dashboards/js/bradley-screenprint.js'));
        expect(js).not.toMatch(/\bAPI_BASE\b/);
        expect(js).toContain("'/api/transfer-orders");
    });
    test('Rule 3 + decorative icons', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change|submit)=/);
        expect(jsNoComments).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\.(display|opacity|transition|cssText)/);
        expect(js).not.toMatch(/style="/);
        expect(js).toMatch(/data-onerror="thumb"/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
    });
});

describe('bradley screen print — states + a11y', () => {
    test('first-load failure has Retry; chips are synced pressed-state buttons', () => {
        expect(js).toMatch(/function renderLoadError\(err\)/);
        expect(js).toMatch(/if \(!state\.loadedOnce\) renderLoadError\(err\);/);
        expect(js).toMatch(/id="bt-load-retry"/);
        expect((html.match(/<button type="button" class="bt-stat-chip bt-stat-chip--[a-z]+" [^>]*aria-pressed="false"/g) || []).length).toBe(4);
        expect(html).not.toMatch(/<div class="bt-stat-chip/);
        expect(js).toMatch(/function syncChips\(\)/);
        expect(js).toMatch(/state\.filters\.status = \(state\.filters\.status === status\) \? '' : status;/);
    });
    test('labels, keyboard cards, labelled delete dialog with focus return + Esc, session identity', () => {
        expect(html).toMatch(/<label class="bt-filter-label" for="bt-filter-status">/);
        expect(html).toMatch(/<label class="bt-filter-label" for="bt-filter-search">/);
        expect(html).toMatch(/<label for="bt-delete-reason">/);
        expect(html).toMatch(/id="bt-delete-modal" class="bt-modal" hidden/);
        expect(html).toMatch(/class="bt-modal-content bt-modal-content--narrow" role="dialog" aria-modal="true" aria-labelledby="bt-delete-modal-title"/);
        expect(html).toMatch(/id="bt-delete-modal-close" aria-label="Close"/);
        expect(js).toMatch(/role="link" tabindex="0" aria-label="Open order /);
        expect(js).toMatch(/card\.addEventListener\('keydown'/);
        expect(html.indexOf('/shared_components/js/ui-dialog.js')).toBeGreaterThan(0);
        expect(html.indexOf('/shared_components/js/ui-dialog.js')).toBeLessThan(html.indexOf('/dashboards/js/'));
        expect(js).toContain("window.UiDialog.open('bt-delete-modal'");
        expect(js).toContain('window.UiDialog.close('); // Focus/escape/scroll behavior is exercised in css-unification-bradley.spec.js.
        expect(js).toMatch(/if \(e\.key === 'Escape'\) closeDeleteModal\(\);/);
        expect(js).toMatch(/\(state\.me && state\.me\.email\) \|\| localStorage\.getItem\('transfer_user_email'\)/);
        expect(html).toMatch(/id="bt-toast-container" class="bt-toast-container" role="status" aria-live="polite"/);
    });
});
