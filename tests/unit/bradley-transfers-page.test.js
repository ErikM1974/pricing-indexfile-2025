/**
 * Bradley's Transfer Queue — 2026-09-05 review locks.
 *   1. Rule 6: the proxy base comes from APP_CONFIG (the page loads config/app.config.js), not a
 *      hardcoded Heroku host. Rule 3: no inline style= / onerror= in the page or templates.
 *   2. A failed first load renders an error state with Retry (the spinner used to stay up forever).
 *   3. Stat chips are <button aria-pressed> kept in sync with the Status dropdown / Rush box / Clear
 *      (the CSS `.active` style existed but nothing ever set it); clicking the active chip clears.
 *   4. Cards are keyboard-openable; the delete modal is a labelled dialog with focus in/out + Esc;
 *      the link modal's Esc listener is removed on every close (it leaked); icons decorative.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/bradley-transfers.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/bradley-transfers.js');
const css = read('dashboards/css/bradley-transfers.css');

describe('bradley transfers — config + Rule 3', () => {
    test('API base from APP_CONFIG; app.config.js loaded before the controller', () => {
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
        expect(html.indexOf('/config/app.config.js')).toBeLessThan(html.indexOf('/dashboards/js/bradley-transfers.js'));
        expect(js).toMatch(/var API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\)/);
        expect(js).not.toMatch(/var API_BASE = 'https/);
    });
    test('no inline style / onerror; hidden rule; icons decorative', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change|submit)=/);
        expect(js.replace(/\/\/[^\n]*/g, '')).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/\.style\.(display|opacity|transition|cssText)/);
        expect(js).not.toMatch(/style="/);
        expect(js).toMatch(/document\.addEventListener\('error', function \(e\)[\s\S]*?\}, true\);/);
        expect(js).toMatch(/data-onerror="thumb"/);
        expect(html).toContain('/shared_components/css/components.css?v=');
        expect(read('shared_components/css/components.css')).toMatch(/@layer utilities[\s\S]*?\[hidden\]\s*\{\s*display: none;/);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).toMatch(/bradley-transfers\.js\?v=2026\.\d{2}\.\d{2}\.\d+/);
    });
});

describe('bradley transfers — states', () => {
    test('first-load failure renders an error with Retry', () => {
        expect(js).toMatch(/function renderLoadError\(err\)/);
        expect(js).toMatch(/if \(!state\.loadedOnce\) renderLoadError\(err\);/);
        expect(js).toMatch(/id="bt-load-retry"/);
        expect(js).toMatch(/state\.loadedOnce = true;/);
        expect(css).toMatch(/\.bt-error \{/);
    });
    test('stat chips are pressed-state buttons kept in sync; active chip toggles off', () => {
        expect((html.match(/<button type="button" class="bt-stat-chip bt-stat-chip--[a-z]+" [^>]*aria-pressed="false"/g) || []).length).toBe(4);
        expect(html).not.toMatch(/<div class="bt-stat-chip/);
        expect(js).toMatch(/function syncChips\(\)/);
        expect(js).toMatch(/chip\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(js).toMatch(/state\.filters\.status = \(state\.filters\.status === status\) \? '' : status;/);
        expect((js.match(/syncChips\(\);/g) || []).length).toBeGreaterThanOrEqual(5);
        expect(js).toMatch(/requesterEmails: keepReq/);
        expect(css).toMatch(/\.bt-stat-chip\[aria-pressed="true"\]/);
    });
});

describe('bradley transfers — a11y', () => {
    test('labels, card keyboard path, dialog semantics, focus return, Esc', () => {
        expect(html).toMatch(/<label class="bt-filter-label" for="bt-filter-status">/);
        expect(html).toMatch(/<label class="bt-filter-label" for="bt-filter-search">/);
        expect(html).toMatch(/<label for="bt-delete-reason">/);
        expect(html).toMatch(/id="bt-delete-modal" class="bt-modal" hidden/);
        expect(html).toMatch(/class="bt-modal-content bt-modal-content--narrow" role="dialog" aria-modal="true" aria-labelledby="bt-delete-modal-title"/);
        expect(html).toMatch(/id="bt-delete-modal-close" aria-label="Close"/);
        expect(js).toMatch(/role="link" tabindex="0" aria-label="Open transfer /);
        expect(js).toMatch(/card\.addEventListener\('keydown'/);
        expect(html.indexOf('/shared_components/js/ui-dialog.js')).toBeGreaterThan(0);
        expect(html.indexOf('/shared_components/js/ui-dialog.js')).toBeLessThan(html.indexOf('/dashboards/js/'));
        expect(js).toContain("window.UiDialog.open('bt-delete-modal'");
        expect(js).toContain('window.UiDialog.close('); // Focus/escape/scroll behavior is exercised in css-unification-bradley.spec.js.
        expect(js).toMatch(/if \(e\.key === 'Escape'\) closeDeleteModal\(\);/);
        expect(js).toMatch(/document\.removeEventListener\('keydown', escHandler\);\s*\/\/ was only removed on Esc/);
        expect(html).toMatch(/id="bt-toast-container" class="bt-toast-container" role="status" aria-live="polite"/);
        expect(js).toMatch(/\(state\.me && state\.me\.email\) \|\| localStorage\.getItem\('transfer_user_email'\)/);
    });
});
