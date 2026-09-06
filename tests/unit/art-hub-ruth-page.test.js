/**
 * Ruth's Queue (art-hub-ruth) — 2026-09-05 review locks.
 *   The page had NO h1; 158 inline onerror + 173 inline style= at runtime; status chips were
 *   display-only divs; the tab strip had no tablist semantics; kanban cards (click via the delegator's
 *   data-href) had no keyboard path; due dates were UTC-parsed so a mockup due TODAY read "OVERDUE" all day;
 *   quick actions were attributed to a hardcoded Ruth; the Billing Codes tab typed $50 / $75.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const noComments = (s) => s.replace(/\/\/[^\n]*/g, '');

const html = read('dashboards/art-hub-ruth.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('shared_components/js/mockup-ruth.js');
const css = read('dashboards/css/art-hub-ruth.css');

describe('ruth queue — structure + Rule 3', () => {
    test('one h1, tablist + panels, no inline style/handlers, hidden guard', () => {
        expect((html.match(/<h1\b/g) || []).length).toBe(1);
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|error|change)=/);
        expect(html).toMatch(/<div class="tab-group" role="tablist" aria-label="Mockup views">/);
        for (const t of ['queue', 'completed', 'on-hold', 'billing']) {
            expect(html).toMatch(new RegExp(`id="tab-${t}" role="tab" aria-selected="(true|false)"[^>]*aria-controls="${t}-tab"`));
            expect(html).toMatch(new RegExp(`id="${t}-tab" class="tab-pane( active)?" role="tabpanel" aria-labelledby="tab-${t}"`));
        }
        expect(html).toMatch(/<nav class="tab-group" aria-label="Other tools">/);
        expect(html).not.toMatch(/<button class=/); // every button declares type
        expect(noComments(js)).not.toMatch(/(?<!data-)onerror=/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\.(display|cssText|animationDelay)/);
        expect(js).toMatch(/card\.style\.setProperty\('--delay'/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
        expect(css).toMatch(/\.tab-group \{ display: contents; \}/);
    });
    test('dates are calendar dates; overdue is day-granular', () => {
        expect(js).toMatch(/function parseCalendarDate\(value\)/);
        expect(js).toMatch(/function daysFromToday\(dateStr\)/);
        expect(js).toMatch(/return n !== null && n < 0;/);
        expect(js).not.toMatch(/return due < new Date\(\);/);
    });
});

describe('ruth queue — controls + behaviour', () => {
    test('status chips filter the queue with pressed state; on-hold chip jumps tabs', () => {
        expect(js).toMatch(/<button type="button" class="status-stat status-stat--\$\{mod\}/);
        expect(js).toMatch(/aria-pressed="\$\{on \? 'true' : 'false'\}"/);
        expect(js).toMatch(/queueStatusFilter = \(queueStatusFilter === status\) \? '' : status;/);
        expect(js).toMatch(/if \(chip\.dataset\.tab\) \{ showTab\(chip\.dataset\.tab\); return; \}/);
        expect(js).toMatch(/if \(queueStatusFilter\) queueMockups = queueMockups\.filter/);
        expect(js).toMatch(/window\.ruthClearStatusFilter = /);
    });
    test('tabs sync aria-selected + roving tabindex + arrow keys; view toggle pressed', () => {
        expect(js).toMatch(/btn\.setAttribute\('aria-selected', on \? 'true' : 'false'\);/);
        expect(js).toMatch(/btn\.tabIndex = on \? 0 : -1;/);
        expect(js).toMatch(/e\.key !== 'ArrowRight' && e\.key !== 'ArrowLeft' && e\.key !== 'Home' && e\.key !== 'End'/);
        expect(js).toMatch(/btn\.setAttribute\('aria-pressed', on \? 'true' : 'false'\);/);
        expect(js).toMatch(/gridView\.hidden = true;/);
    });
    test('kanban cards open on keyboard (click = delegator data-href); hidden cards use the attribute', () => {
        expect(js).toMatch(/function openKanbanCard\(e\)/);
        expect(js).toMatch(/if \(e\.key === 'Enter' \|\| e\.key === ' '\) openKanbanCard\(e\);/);
        expect(js).toMatch(/role="link" tabindex="0" aria-label="Open ' \+ company \+ '"/);
        expect(js).toMatch(/\.kanban-card\[hidden\]/);
        expect(js).toMatch(/<button type="button" class="kanban-show-all"/);
    });
    test('honest failures + Retry; identity from the session; rep filter is a button', () => {
        expect(js).toMatch(/showError\('Unable to load mockups \(' \+ \(err\.message \|\| 'request failed'\) \+ '\)\.'\);/);
        expect(js).toMatch(/data-call="ruthRetryFetch"/);
        expect(js).not.toMatch(/data-call="location\.reload"/);
        expect(js).toMatch(/author: me\.email,\s*authorName: me\.name/);
        expect(js).toMatch(/fetch\('\/api\/crm-session\/me'/);
        expect(js).toMatch(/<button type="button" class="card-rep-name" data-action="filter-rep"/);
        expect(js).toMatch(/data-onerror="box-parent"/);
        expect(js).toMatch(/data-onerror="box-self"/);
    });
    test('broken-mockups modal is a dialog with focus return', () => {
        expect(js).toMatch(/class="broken-mockups-modal" role="dialog" aria-modal="true" aria-labelledby="bml-title"/);
        expect(js).toMatch(/overlay\.__returnFocus = document\.activeElement;/);
    });
    test('billing codes come from Service_Codes with a visible fallback note', () => {
        expect(js).toMatch(/function loadBillingRates\(\)/);
        expect(js).toMatch(/\/api\/service-codes\?code=/);
        expect(html).toMatch(/id="billing-rate-note" class="rq-rate-note" role="status" hidden/);
        expect(html).toMatch(/id="bill-grt50"/);
        expect(html).toMatch(/id="bill-grt75"/);
        expect(html).toMatch(/id="bill-inc-60"/);
        expect(js).toMatch(/Could not verify these prices against Caspio/);
    });
});
