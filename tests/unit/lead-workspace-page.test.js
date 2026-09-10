/**
 * Lead workspace (dashboards/lead.html) — structural locks from the 2026-09-05 review.
 *   1. Rule 3: no inline style= in the page or templates, no .style.* toggles; the art modal uses
 *      `hidden` (canonical components declare the [hidden] rule this page inherits).
 *   2. Failed loads offer Retry (the lead itself and the activity timeline) and a header Refresh
 *      reloads the record — the page had no refresh path at all.
 *   3. The page h1 names the lead; document.title on the not-found path too.
 *   4. Every icon is aria-hidden; timeline icons are named by type; icon-only buttons and
 *      placeholder-only inputs have aria-labels; the kit modal traps Tab and focuses its first field;
 *      the art modal returns focus.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/lead.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/lead-workspace.js');
const css = read('shared_components/css/crm-records.css');

describe('lead workspace — Rule 3', () => {
    test('no inline style / handlers; art modal toggles with hidden', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\./);
        expect(html).toMatch(/id="lw-art-modal" class="lw-art-modal" hidden/);
        expect(js).toMatch(/function closeArtModal\(\)[\s\S]*?m\.hidden = true;/);
        expect(js).toMatch(/modal\.hidden = false;/);
        expect(html).toMatch(/\/shared_components\/css\/components\.css\?v=/);
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display: none;/);
        expect(css).toMatch(/\.lw-mt-8\s*\{\s*margin-top: var\(--space-2\);/);
    });
    test('every icon is decorative', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/'<i class="fas ' \+ (?:icon|t\.icon|b\.icon) \+ '"><\/i>/);
    });
});

describe('lead workspace — recovery paths', () => {
    test('header Refresh reloads the lead; hidden when there is no id', () => {
        expect(html).toMatch(/id="lw-refresh" class="ld-refresh-btn btn"[^>]*aria-label="Reload this lead"/);
        expect(js).toMatch(/refreshBtn\.addEventListener\('click', function \(\) \{ loadLead\(state\.id\); \}\)/);
        expect(js).toMatch(/if \(refreshBtn\) refreshBtn\.hidden = true;/);
    });
    test('lead load failure and activity failure both offer Retry', () => {
        expect(js).toMatch(/function renderFatal\(html, retryId\)/);
        expect(js).toMatch(/id="lw-load-retry"/);
        expect(js).toMatch(/rb\.addEventListener\('click', function \(\) \{ loadLead\(retryId\); \}\)/);
        expect(js).toMatch(/'<a href="\/dashboards\/leads\.html">Back to the Leads board<\/a>\.', id\);/);
        expect(js).toMatch(/id="lw-activity-retry"/);
        expect(js).toMatch(/loadActivities\(\); \}\);/);
    });
});

describe('lead workspace — names and focus', () => {
    test('the h1 names the lead; not-found sets the title', () => {
        expect(js).toMatch(/document\.getElementById\('lw-page-title'\)\.textContent = lead\.Contact_Name \|\| lead\.Company \|\| lead\.Submission_ID;/);
        expect(js).toMatch(/document\.title = 'Lead not found - NWCA';/);
        expect(html).toMatch(/id="lw-title" role="status"/);
        expect(js).toMatch(/titleEl\.removeAttribute\('role'\);/);
    });
    test('icon-only controls and placeholder-only inputs are labelled', () => {
        expect(js).toMatch(/id="lw-match-btn" class="ld-btn btn" aria-label="Search ShopWorks"/);
        expect(js).toMatch(/id="lw-match-input" class="ld-search field-input" placeholder="[^"]*" aria-label="Search ShopWorks customers"/);
        expect(js).toMatch(/id="lw-quote-id" class="lw-quote-input field-input" placeholder="[^"]*" aria-label="Quote ID to link"/);
        expect(js).toMatch(/id="lw-value" class="lw-value-input field-input" min="0" step="50" placeholder="Estimated \$" aria-label="Estimated value in dollars"/);
        expect(js).toMatch(/id="lw-due" class="lw-value-input field-input" aria-label="Follow-up date"/);
        expect(js).toMatch(/aria-label="Follow up in ' \+ c\[1\] \+ ' day'/);
        expect(js).toMatch(/class="lw-kit-qty field-input" min="1" value="1" aria-label="Quantity of ' \+ esc\(it\.Label\) \+ '"/);
        expect(js).toMatch(/class="lw-item-icon" role="img" aria-label="' \+ esc\(type\) \+ '"/);
        expect(html).toMatch(/id="lw-art-modal-close" title="Close" aria-label="Close"/);
    });
    test('kit modal traps Tab and focuses its first field; art modal returns focus', () => {
        expect(js).toMatch(/if \(e\.key === 'Tab'\) \{ \/\/ keep Tab inside the modal/);
        expect(js).toMatch(/var f = document\.getElementById\('lw-kit-recipient'\); if \(f\) f\.focus\(\);/);
        expect(js).toMatch(/artReturnFocus = btn;/);
        expect(js).toMatch(/if \(artReturnFocus && document\.body\.contains\(artReturnFocus\)\)/);
    });
});
