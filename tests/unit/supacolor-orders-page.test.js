/**
 * Supacolor API Orders — 2026-09-05 review locks.
 *   1. Rule 6: proxy base from APP_CONFIG (page loads config/app.config.js). Rule 3: no inline
 *      style= in the page or templates, no .style.display; page CSS declares [hidden].
 *   2. View chips are <button aria-pressed> (aria-pressed is the state, .selected the styling hook).
 *   3. First-load failure renders an error with Retry (was a dead "Failed to load." panel).
 *   4. Backfill modal is a labelled dialog: focus in (paste zone), focus back, Esc closes; the paste
 *      zone is keyboard-operable; icons decorative; pagination is a <nav>.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/supacolor-orders.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/supacolor-orders.js');
const css = read('dashboards/css/supacolor-orders.css');

describe('supacolor orders — config + Rule 3', () => {
    test('API base from APP_CONFIG; config loaded before the controller', () => {
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
        expect(html.indexOf('/config/app.config.js')).toBeLessThan(html.indexOf('/dashboards/js/supacolor-orders.js'));
        expect(js).toMatch(/var API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\)/);
        expect(js).not.toMatch(/var API_BASE = 'https/);
    });
    test('no inline style; hidden rule; icons decorative; versions bumped', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change|submit)=/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).not.toMatch(/style="/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).toMatch(/supacolor-orders\.js\?v=2026\.\d{2}\.\d{2}\.\d+/);
        expect(css).toMatch(/\.sc-title-mark \{/);
    });
});

describe('supacolor orders — chips, states, modal', () => {
    test('view chips are pressed-state buttons', () => {
        expect((html.match(/<button type="button" class="bt-stat-chip [^"]*bt-stat-chip--clickable[^"]*" [^>]*data-view="[a-z]+" aria-pressed="(true|false)"/g) || []).length).toBe(5);
        expect(html).toMatch(/data-view="active" aria-pressed="true"/);
        expect(html).not.toMatch(/<div class="bt-stat-chip/);
        expect(js).toMatch(/c\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(css).toMatch(/\.bt-stat-chip\[aria-pressed="true"\]/);
    });
    test('first-load failure has Retry; pagination toggles with hidden', () => {
        expect(js).toMatch(/function renderLoadError\(err\)/);
        expect(js).toMatch(/id="sc-load-retry"/);
        expect(js).toMatch(/\$\('sc-pagination'\)\.hidden = (true|false);/);
        expect(html).toMatch(/<nav id="sc-pagination" class="sc-pagination" aria-label="Pagination" hidden>/);
    });
    test('backfill modal is a labelled dialog with focus in/out, Esc, keyboard paste zone', () => {
        expect(html).toMatch(/id="sc-backfill-modal" class="bt-modal" hidden/);
        expect(html).toMatch(/class="bt-modal-content" role="dialog" aria-modal="true" aria-labelledby="sc-backfill-title"/);
        expect(html).toMatch(/id="sc-backfill-modal-close" aria-label="Close"/);
        expect(html).toMatch(/id="sc-paste-zone" tabindex="0" role="button" aria-label="/);
        expect(js).toMatch(/backfillReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/if \(e\.key === 'Escape'\) closeBackfillModal\(\);/);
        expect(js).toMatch(/if \(backfillModal\.hidden\) return;/);
        expect(js).toMatch(/\$\('sc-paste-zone'\)\.addEventListener\('keydown'/);
        expect(html).toMatch(/<label class="bt-filter-label" for="sc-filter-status">/);
        expect(html).toMatch(/<label class="bt-filter-label" for="sc-filter-search">/);
        expect(html).toMatch(/id="sc-toast-container" class="bt-toast-container" role="status" aria-live="polite"/);
    });
});
