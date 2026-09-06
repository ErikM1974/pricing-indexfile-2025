/**
 * House Accounts — structural locks from the 2026-09-05 review.
 *   1. Stat tiles are <button data-assignee aria-pressed>; the filter is keyed by data-assignee, never by
 *      the label text (the total tile's label is "YTD Sales" — matching "Total" emptied the grid).
 *   2. Rule 3: no inline style= / onchange= in the page or templates, no .style.display / .style.cssText;
 *      the page CSS declares [hidden]; the reconcile Assign dropdown is a data-change target.
 *   3. All four static modals + the dynamic assign modal are labelled dialogs that move focus in and back;
 *      Esc closes every one; expandable rows/headers are keyboard-operable with aria-expanded.
 *   4. Failed loads offer Retry; dates parse as local calendar days; the audit trail records the signed-in
 *      staffer (fallback "Erik" kept); every icon is aria-hidden; icon-only refresh buttons are named.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/house-accounts.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('dashboards/js/house-accounts.js');
const css = read('dashboards/css/house-accounts.css');

describe('house accounts — Rule 3', () => {
    test('no inline style / handlers in the page or templates', () => {
        expect(html).not.toMatch(/style="/);
        expect(html).not.toMatch(/\son(click|change|keydown|submit|load|error)=/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/onchange=/);
        expect(js).not.toMatch(/\.style\.(display|cssText)/);
        expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
    });
    test('every icon is decorative; asset versions bumped', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(js).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect(html).toMatch(/house-accounts\.css\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/house-accounts\.js\?v=\d{4}\.\d{2}\.\d{2}\.\d+/);
    });
});

describe('house accounts — stat tiles filter correctly', () => {
    test('tiles are buttons keyed by data-assignee', () => {
        expect(html).toMatch(/<button type="button" class="stat-card total" data-assignee="" aria-pressed="false"/);
        for (const who of ['Ruthie', 'Erik', 'Web', 'Jim', 'House', 'Other']) expect(html).toMatch(new RegExp(`<button type="button" class="stat-card" data-assignee="${who}" aria-pressed="false"`));
        expect(html).not.toMatch(/<div class="stat-card/);
        expect(js).toMatch(/const assignee = card\.dataset\.assignee \|\| '';/);
        expect(js).not.toMatch(/label === 'Total'/);
        expect(js).toMatch(/function|_syncStatTiles\(assignee\) \{/);
        expect(js).toMatch(/c\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(css).toMatch(/\.stat-card \{ font: inherit; color: inherit; width: 100%; display: block; text-align: center; \}/);
    });
});

describe('house accounts — modals and expanders', () => {
    test('static modals are labelled dialogs; open/close go through the focus helpers', () => {
        expect(html).toMatch(/class="gap-report-modal" role="dialog" aria-modal="true" aria-labelledby="sw-todo-title"/);
        expect(html).toMatch(/class="reconcile-modal" role="dialog" aria-modal="true" aria-labelledby="reconcile-title"/);
        expect(html).toMatch(/class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"/);
        expect(html).toMatch(/class="gap-report-modal" role="dialog" aria-modal="true" aria-labelledby="gap-report-title"/);
        expect(js).toMatch(/_openOverlay\(overlay, focusEl\) \{/);
        expect(js).toMatch(/_closeOverlay\(overlay\) \{/);
        for (const open of ['this.elements.confirmModal, this.elements.confirmSubmit', 'this.elements.reconcileModalOverlay, this.elements.reconcileModalClose', 'this.elements.swTodoOverlay, this.elements.swTodoClose', 'this.elements.gapReportModalOverlay, this.elements.gapReportModalClose']) {
            expect(js).toContain(`this._openOverlay(${open})`);
        }
        expect(js).toMatch(/closeShopWorksTodoModal\(\) \{\s*this\._closeOverlay\(this\.elements\.swTodoOverlay\);/);
        expect(js).toMatch(/if \(e\.key === 'Escape'\) \{[\s\S]*?this\.closeShopWorksTodoModal\(\);\s*this\.closeAssignModal\(\);/);
    });
    test('dynamic assign modal is a labelled dialog with focus in/out and pressed rep buttons', () => {
        expect(js).toMatch(/class="modal-content modal-content--narrow" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title"/);
        expect(js).toMatch(/class="close-btn" aria-label="Close" data-call="houseController\.closeAssignModal"/);
        expect(js).toMatch(/this\._assignReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/btn\.setAttribute\('aria-pressed', on \? 'true' : 'false'\)/);
        expect(css).toMatch(/\.modal-content--narrow \{ max-width: 480px; \}/);
    });
    test('expandable rows and headers are keyboard-operable with aria-expanded', () => {
        expect(js).toMatch(/class="customer-row"[^>]*tabindex="0" aria-expanded="false" aria-label="Show orders for /);
        expect(js).toMatch(/class="gap-conflict-row"[^>]*tabindex="0" aria-expanded="false"/);
        expect(js).toMatch(/class="gap-rep-header"[^>]*role="button" tabindex="0" aria-expanded="true"/);
        expect(js).toMatch(/e\.target\.matches\('tr\[data-call\], \.gap-rep-header\[data-call\]'\)/);
        expect((js.match(/setAttribute\('aria-expanded', isHidden \? 'true' : 'false'\)/g) || []).length).toBe(3);
        expect(js).toMatch(/<tr class="order-details-row" hidden>/);
        expect(js).toMatch(/<tr class="gap-orders-row" hidden>/);
        expect(html).toMatch(/<th class="expand-col"><span class="sr-only">Expand<\/span><\/th>/);
    });
    test('the reconcile Assign dropdown is a data-change target', () => {
        expect(js).toMatch(/class="assign-dropdown" aria-label="Assign [^"]*" data-change="houseController\.quickAssignFromSelect" data-change-args='\["\$this"\]' data-stop="1"/);
        expect(js).toMatch(/quickAssignFromSelect\(select\) \{[\s\S]*?this\.quickAssign\(id, select\.value\);/);
    });
});

describe('house accounts — recovery, dates, identity, names', () => {
    test('banner Retry re-runs the load with the real error', () => {
        expect(html).toMatch(/id="error-retry" data-call="houseController\.retryLoad" hidden/);
        expect(js).toMatch(/async retryLoad\(\) \{/);
        expect(js).toMatch(/this\.showError\('Unable to load House accounts \(' \+ [^;]+, true\);/);
        expect(js).toMatch(/showError\(message, retryable\)[\s\S]*?this\.elements\.errorRetry\.hidden = !retryable;/);
    });
    test('calendar dates parse as local days', () => {
        expect(js).toMatch(/static parseCalendarDate\(value\)/);
        expect(js).toMatch(/const date = HouseAccountsController\.parseCalendarDate\(dateStr\);/);
        expect(js).toMatch(/const x = HouseAccountsController\.parseCalendarDate\(d\);/);
        // eslint-disable-next-line no-new-func
        const fn = new Function('return ' + js.match(/static parseCalendarDate\(value\) \{[\s\S]*?\n    \}/)[0].replace('static ', 'function '))();
        expect(fn('2026-01-22').getDate()).toBe(22);
        expect(fn('2026-01-22T00:00:00.000Z').getMonth()).toBe(0);
        expect(fn('')).toBeNull();
    });
    test('audit trail records the signed-in staffer (fallback kept)', () => {
        expect(js).toMatch(/fetch\('\/api\/crm-session\/me', \{ credentials: 'same-origin' \}\)/);
        expect((js.match(/changedBy: this\.staffName \|\| 'Erik'/g) || []).length).toBe(2);
        expect(js).not.toMatch(/changedBy: 'Erik'/);
    });
    test('icon-only refresh buttons are named; status regions declared', () => {
        expect(html).toMatch(/id="reconcile-refresh-btn"[^>]*aria-label="Refresh unassigned customers"/);
        expect(html).toMatch(/id="gap-report-refresh-btn"[^>]*aria-label="Refresh gap report"/);
        expect(html).toMatch(/id="sync-status" role="status"/);
        expect(html).toMatch(/id="empty-state" role="status" hidden/);
        expect(html).toMatch(/id="celebration-toast" role="status" aria-live="polite"/);
    });
});
