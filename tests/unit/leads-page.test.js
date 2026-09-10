/**
 * Leads CRM board — structural locks from the 2026-09-05 review.
 *   1. Rule 3: no inline style= in the page or templates, no .style.* toggles (thumb fallback and
 *      the edit-modal hint use `hidden` / a class).
 *   2. The board view has its own loading / failure / empty message with Retry — it used to go
 *      blank because the only message lived in the hidden list table.
 *   3. Stat tiles are filter buttons (aria-pressed) over status GROUPS; the status dropdown and the
 *      tiles clear each other.
 *   4. Indicators (🔥, overdue dot, source icon, rep initials) carry accessible names; every Font
 *      Awesome icon is aria-hidden; header actions keep their names when the phone hides the words.
 *   5. The drawer is a labelled modal dialog; document.title names the open lead; the edit modal's
 *      inputs have real label/for pairs.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/leads.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/leads.js');
const common = read('dashboards/js/leads-common.js');
const components = read('shared_components/css/components.css');

describe('leads — Rule 3', () => {
    test('no inline style / handlers; hidden rule declared', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\./);
        expect(common).not.toMatch(/\.style\./);
        expect(components).toMatch(/\[hidden\]\s*\{\s*display: none;/);
    });
    test('every icon is decorative', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(common).not.toMatch(/<i class="fa[^"]*"><\/i>/);
    });
});

describe('leads — board never blank', () => {
    test('board message region exists and is driven for loading, failure (Retry) and empty', () => {
        expect(html).toMatch(/<div class="ld-board-msg" id="leads-board-msg" role="status" hidden><\/div>/);
        expect(js).toMatch(/function setBoardMessage\(html\)/);
        expect(js).toMatch(/if \(state\.view === 'board'\) \{ document\.getElementById\('leads-board'\)\.innerHTML = ''; setBoardMessage\('<span class="dash-loading">Loading leads…<\/span>'\); \}/);
        expect(js).toMatch(/id="btn-board-retry"/);
        expect(js).toMatch(/if \(e\.target\.closest\('#btn-board-retry'\)\) loadLeads\(\);/);
        expect(js).toMatch(/setBoardMessage\(rows\.length \? '' : \(state\.leads\.length \? 'No leads match the current filters\.' : ''\)\);/);
    });
});

describe('leads — stat tiles filter', () => {
    test('tiles are pressed-state buttons over groups; dropdown and tiles clear each other', () => {
        expect((html.match(/class="dash-stat-card[^"]*ld-stat-btn" data-group="(new|pipeline|won|)" aria-pressed="(true|false)"/g) || []).length).toBe(4);
        expect(js).toMatch(/statusGroup: ''/);
        expect(js).toMatch(/function matchesGroup\(l\)/);
        expect(js).toMatch(/if \(state\.statusGroup === 'pipeline'\) return L\.PIPELINE_STATUSES\.indexOf\(l\.Status\) !== -1;/);
        expect(js).toMatch(/if \(state\.statusGroup === 'won'\) return L\.WON_STATUSES\.indexOf\(l\.Status\) !== -1;/);
        expect(js).toMatch(/if \(state\.statusGroup\) \{ state\.status = ''; document\.getElementById\('filter-status'\)\.value = ''; \}/);
        expect(js).toMatch(/if \(pair\[1\] === 'status' && this\.value\) \{ state\.statusGroup = ''; syncStatTiles\(\); \}/);
        expect(js).toMatch(/function matchesFilters\(l\) \{\s*if \(!matchesGroup\(l\)\) return false;/);
    });
});

describe('leads — accessible names', () => {
    test('indicators and columns are named; header actions keep names on phones', () => {
        expect(js).toMatch(/class="ld-fire" role="img" title="Hot lead: [^"]*" aria-label="Hot lead: /);
        expect(js).toMatch(/class="ld-dot" role="img" title="Follow-up overdue[^"]*" aria-label="Follow-up overdue, was due /);
        expect(js).toMatch(/class="ld-card-src" role="img" title="[^"]*" aria-label="/);
        expect(js).toMatch(/class="ld-rep-chip" role="img" title="[^"]*" aria-label="Assigned to /);
        expect(js).toMatch(/class="ld-col ld-col--' \+ c\.key \+ '" data-col="' \+ c\.key \+ '" role="region" aria-label="' \+ c\.label \+ ' \(' \+ items\.length \+ '\)"/);
        expect(js).toMatch(/class="ld-col-more btn" data-col="' \+ esc\(c\.key\) \+ '" aria-expanded="/);
        for (const label of ['New lead', 'Export CSV', 'Refresh leads', 'Rep scorecard', 'Spam and unqualified leads']) expect(html).toMatch(new RegExp(`aria-label="${label}"`));
        expect((html.match(/<span class="ld-btn-txt">/g) || []).length).toBe(5);
        expect(html).toMatch(/crm-pipeline\.css\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
    test('drawer is a labelled dialog and the title tracks the open lead', () => {
        expect(html).toMatch(/<aside class="ld-drawer" id="lead-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="drawer-title">/);
        expect(js).toMatch(/document\.title = \(lead\.Contact_Name \|\| lead\.Company \|\| lead\.Submission_ID\) \+ ' · Leads - Northwest Custom Apparel';/);
        expect(js).toMatch(/if \(wasOpen\) document\.title = 'Leads - Northwest Custom Apparel';/);
        expect(html).toMatch(/id="newlead-status" class="ld-muted" role="status"/);
    });
    test('edit-lead modal inputs are labelled', () => {
        expect(common).toMatch(/lab\.htmlFor = 'edit-lead-' \+ f\.key;/);
        expect(common).toMatch(/input\.id = 'edit-lead-' \+ f\.key;/);
        expect(common).toMatch(/hint\.className = 'ld-muted ld-hint-sm';/);
    });
});
