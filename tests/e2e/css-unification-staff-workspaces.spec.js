const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const source = require('../fixtures/staff-workspaces-original-content.json');
const drainBaseline = require('../fixtures/staff-workspaces-drainpro-original-browser.json');
const shiftBaseline = require('../fixtures/staff-workspaces-shifts-original-browser.json');
const AxeBuilder = require('@axe-core/playwright').default;
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
const { open, providerPaths, reactPaths } = require('./helpers/staff-workspaces-browser');
const payrollData = require('../fixtures/staff-workspaces-payroll-synthetic.json');
test('CSS staff workspaces: payroll empty roster and periods show explicit guidance', async ({ page }) => {
    const events = await open(page, 'payroll', payrollState({ empty: true }));
    await expect(page.locator('#leave-body')).toContainText('No active employees found');
    await expect(page.locator('#leave-asof')).toHaveText('No packet imported yet');
    await page.locator('#print-slips').click();
    await expect(page.locator('#pr-status')).toContainText('Nothing to print');
    await page.getByRole('tab', { name: 'Pay Periods', exact: true }).click();
    await expect(page.locator('#period-select')).toContainText('No pay periods imported yet');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});
test('CSS staff workspaces: payroll cancelled poll cannot replace a newer document review', async ({ page }) => {
    let release, started;
    const arrived = new Promise(resolve => { started = resolve; });
    const state = payrollState({ respond: async (_req, u) => {
        if (u.pathname === payrollPrefix + '/parse/synthetic-1' && !release) {
            started(); return new Promise(resolve => { release = () => resolve({ json: { status: 'error', error: 'Abandoned synthetic poll' } }); });
        }
        return null;
    } }), events = await open(page, 'payroll', state);
    await page.getByRole('tab', { name: 'Upload Packet' }).click();
    await page.locator('#packet-file').setInputFiles({ name: 'synthetic-poll.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic only.\n%%EOF') });
    await page.locator('#packet-parse').click(); await arrived;
    await payrollRead(page, 'leave');
    release();
    await expect(page.locator('#pr-status')).toHaveText('Page read and verified. Review below, then save.');
    await expect(page.locator('#packet-commit')).toHaveText('Save leave balances');
    await expect(page.locator('#packet-commit')).toBeEnabled();
    await expect(page.locator('#review-verdict')).toContainText('no pay period is created');
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
    expect(events.writes.map(w => w.path)).toEqual([payrollPrefix + '/parse', payrollPrefix + '/parse']);
});
test('CSS staff workspaces: payroll load failures retry and empty data remain explicit', async ({ page }) => {
    const failures = new Set(['employees', 'periods', 'register']);
    const state = payrollState({ respond: async (_req, u) => {
        const endpoint = u.pathname.slice(payrollPrefix.length + 1);
        if (u.pathname.startsWith(payrollPrefix + '/') && failures.has(endpoint)) {
            failures.delete(endpoint); return { status: 503, json: { error: 'Synthetic ' + endpoint + ' unavailable' } };
        }
        return null;
    } });
    const events = await open(page, 'payroll', state);
    await expect(page.locator('#leave-retry')).toBeVisible();
    await page.locator('#leave-retry').click();
    await expect(page.locator('#leave-body tr')).toHaveCount(7);
    await page.getByRole('tab', { name: 'Pay Periods', exact: true }).click();
    await page.locator('#periods-retry').click();
    await expect(page.locator('#register-retry')).toBeVisible();
    await page.locator('#register-retry').click();
    await expect(page.locator('#period-body tr')).toHaveCount(3);
    await page.getByRole('tab', { name: 'Leave Balances', exact: true }).click();
    await page.locator('#leave-search').fill('no synthetic match');
    await page.locator('#print-slips').click();
    await expect(page.locator('#pr-status')).toContainText('Nothing to print');
    expect(await page.evaluate(() => window.__printCalls || 0)).toBe(0);
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});
test('CSS staff workspaces: payroll reconciliation blocks saving and save failures keep the review available', async ({ page }) => {
    const state = payrollState({ passed: false }), events = await open(page, 'payroll', state);
    await payrollRead(page, 'leave');
    await expect(page.locator('#packet-commit')).toBeDisabled();
    await expect(page.locator('#review-verdict')).toContainText('Nothing can be saved');
    await page.locator('#packet-discard').click();
    await expect(page.locator('#review')).toBeHidden();
    expect(events.writes.map(w => w.path)).toEqual([payrollPrefix + '/parse']);
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
});
test('CSS staff workspaces: payroll save errors can retry the same verified job without another read', async ({ page }) => {
    let fail = true;
    const state = payrollState({ respondWrite: async (_req, u) => {
        if (u.pathname === payrollPrefix + '/import' && fail) { fail = false; return { status: 503, json: { error: 'Synthetic save unavailable', detail: ['Synthetic retry detail'] } }; }
        return null;
    } }), events = await open(page, 'payroll', state);
    await payrollRead(page, 'packet');
    await page.locator('#packet-commit').click();
    await expect(page.locator('#pr-status')).toContainText('Synthetic retry detail');
    await expect(page.locator('#packet-commit')).toBeEnabled();
    await expect(page.locator('#review')).toBeVisible();
    await page.locator('#packet-commit').click();
    await expect(page.locator('#pr-status')).toContainText('Saved 2 of 2');
    expect(events.writes.filter(w => w.path.endsWith('/import')).map(w => JSON.parse(w.body))).toEqual([{ jobId: 'synthetic-1' }, { jobId: 'synthetic-1' }]);
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
});
test('CSS staff workspaces: changing payroll document while upload is pending discards the late response', async ({ page }) => {
    let release, started;
    const arrived = new Promise(resolve => { started = resolve; });
    const state = payrollState({ respondWrite: async (_req, u) => {
        if (u.pathname === payrollPrefix + '/parse' && !release) {
            started(); return new Promise(resolve => { release = () => resolve({ json: { jobId: 'synthetic-abandoned' } }); });
        }
        return null;
    } }), events = await open(page, 'payroll', state);
    await page.getByRole('tab', { name: 'Upload Packet' }).click();
    await page.locator('#packet-file').setInputFiles({ name: 'synthetic-delayed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic only.\n%%EOF') });
    await page.locator('#packet-parse').click(); await arrived;
    await page.locator('#packet-mode').selectOption('leave');
    release();
    await expect(page.locator('#pr-status')).toContainText('cancelled');
    await expect(page.locator('#packet-parse')).toBeEnabled();
    await expect(page.locator('#packet-progress')).toBeHidden();
    await page.waitForTimeout(3300);
    await expect(page.locator('#review')).toBeHidden();
    expect(state.polls).toBe(0);
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
});
test('CSS staff workspaces: payroll redesign preserves every synthetic calculation, paper value and import payload', async ({ page }) => {
    const current = await payrollWorkflow(page, false), original = require('../fixtures/staff-workspaces-payroll-original-browser.json');
    for (const key of ['leave', 'flags', 'periods', 'filtered', 'csv', 'slips', 'printStatus', 'reviews', 'writes']) expect(current[key], key).toEqual(original[key]);
    for (const view of current.views) {
        const before = original.views.find(v => v.width === view.width && v.tab === view.tab);
        expect(view.text.toLowerCase()).toBe(before.text.toLowerCase());
        expect(view.scrollWidth, view.tab + ' at ' + view.width).toBeLessThanOrEqual(view.width);
    }
});
test('CSS staff workspaces: payroll keyboard, responsive tables and accessibility across all views', async ({ page }) => {
    const events = await open(page, 'payroll', payrollState()), reports = [];
    await expect(page.locator('#leave-body tr')).toHaveCount(7);
    await page.locator('#tab-leave').focus();
    for (const [key, id] of [['ArrowRight', 'tab-periods'], ['End', 'tab-upload'], ['ArrowRight', 'tab-leave'], ['ArrowLeft', 'tab-upload'], ['Home', 'tab-leave']]) {
        await page.keyboard.press(key); await expect(page.locator('#' + id)).toBeFocused(); await expect(page.locator('#' + id)).toHaveAttribute('aria-selected', 'true');
    }
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['Leave Balances', 'Pay Periods', 'Upload Packet']) {
            await page.getByRole('tab', { name: tab, exact: true }).click();
            const audit = await new AxeBuilder({ page }).analyze();
            expect(audit.violations, tab + ' ' + width + ': ' + JSON.stringify(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            reports.push({ width, tab, violations: audit.violations.length });
        }
    }
    await page.getByRole('tab', { name: 'Leave Balances', exact: true }).click();
    const region = page.locator('#panel-leave .pr-tablewrap');
    await region.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    for (const mode of ['packet', 'leave']) {
        await payrollRead(page, mode);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        await page.locator('#packet-discard').click();
        await expect(page.locator('#review')).toBeHidden();
    }
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
    expect(events.writes.map(w => w.path)).toEqual([payrollPrefix + '/parse', payrollPrefix + '/parse']);
    fs.writeFileSync(path.join(output, 'staff-workspaces-payroll-accessibility.json'), JSON.stringify(reports, null, 2) + '\n');
});
const payrollPrefix = '/api/crm-proxy/payroll';
function payrollState(options = {}) {
    const state = { ...options, mode: 'packet', job: 0, polls: 0 };
    state.respond = async (req, u) => {
        if (req.method() !== 'GET' || !['localhost', '127.0.0.1'].includes(u.hostname)) return null;
        if (options.respond) { const response = await options.respond(req, u); if (response) return response; }
        if (u.pathname === payrollPrefix + '/employees') return { json: { employees: options.empty ? [] : payrollData.employees } };
        if (u.pathname === payrollPrefix + '/periods') return { json: { periods: options.empty ? [] : payrollData.periods } };
        if (u.pathname === payrollPrefix + '/register') return { json: { rows: u.searchParams.get('checkDate') === '2026-09-04' ? payrollData.register : payrollData.register.slice(0, 1) } };
        if (u.pathname === payrollPrefix + '/parse/synthetic-' + state.job) {
            state.polls++;
            return { json: { status: 'done', review: { mode: state.mode, checkDate: '2026-09-04', asOfDate: '2026-09-04', employees: payrollData.reviewEmployees,
                reconciliation: { passed: options.passed !== false, checks: [{ label: 'Synthetic hours total', printed: 162.25, derived: options.passed === false ? 160 : 162.25, unit: 'hours', ok: options.passed !== false }], rowIssues: options.passed === false ? ['Synthetic mismatch; no records saved.'] : [], notes: ['Synthetic review note.'] } } } };
        }
        return null;
    };
    state.respondWrite = async (req, u) => {
        if (req.method() !== 'POST' || !['localhost', '127.0.0.1'].includes(u.hostname)) return null;
        if (options.respondWrite) { const response = await options.respondWrite(req, u); if (response) return response; }
        if (u.pathname === payrollPrefix + '/parse') {
            state.mode = req.postDataJSON().mode; state.job++;
            return { json: { jobId: 'synthetic-' + state.job } };
        }
        if (u.pathname === payrollPrefix + '/import') return { json: { mode: state.mode, imported: 2, total: 2, effectiveDate: '2026-09-04', checkDate: '2026-09-04', failures: [] } };
        return null;
    };
    return state;
}
async function payrollTables(page, selector) {
    return page.locator(selector).evaluateAll(ns => ns.map(n => [...n.rows].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()))));
}
async function payrollRead(page, mode) {
    await page.getByRole('tab', { name: 'Upload Packet' }).click();
    await page.locator('#packet-mode').selectOption(mode);
    await page.locator('#packet-file').setInputFiles({ name: 'synthetic-payroll.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic browser fixture only.\n%%EOF\n') });
    await page.locator('#packet-parse').click();
    await expect(page.locator('#review')).toBeVisible({ timeout: 10000 });
}
async function payrollWorkflow(page, originalView) {
    const state = payrollState({ original: originalView }), events = await open(page, 'payroll', state);
    await expect(page.locator('#leave-body tr')).toHaveCount(payrollData.employees.length);
    const leave = await payrollTables(page, '#panel-leave table'), flags = await page.locator('#leave-flags').innerText();
    const views = [], reviews = [], periods = [], prefix = 'staff-workspaces-payroll-' + (originalView ? 'original-' : '');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const name of ['Leave Balances', 'Pay Periods', 'Upload Packet']) {
            await page.getByRole('tab', { name, exact: true }).click();
            const panel = page.locator('.pr-panel.is-active');
            views.push({ width, tab: name, text: await panel.innerText(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
            await page.screenshot({ path: path.join(output, prefix + name.split(' ')[0].toLowerCase() + '-' + width + '.png'), fullPage: true });
        }
    }
    await page.getByRole('tab', { name: 'Pay Periods', exact: true }).click();
    for (const period of payrollData.periods) {
        await page.locator('#period-select').selectOption(period.checkDate);
        await expect(page.locator('#period-body tr')).toHaveCount(period.checkDate === '2026-09-04' ? 3 : 1);
        periods.push({ date: period.checkDate, table: await payrollTables(page, '#panel-periods table') });
    }
    await page.getByRole('tab', { name: 'Leave Balances', exact: true }).click();
    await page.locator('#leave-search').fill('Sample office');
    await expect(page.locator('#leave-body tr')).toHaveCount(2);
    const filtered = await payrollTables(page, '#panel-leave table');
    await page.locator('#leave-search').fill('');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#print-slips').click();
    const download = await downloadEvent, csv = fs.readFileSync(await download.path(), 'utf8');
    const slips = await page.locator('.slip').evaluateAll(ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
    const printStatus = await page.locator('#pr-status').innerText();
    // The controller's Safari cleanup timer must not hide slips before the PDF capture.
    await page.evaluate(() => { document.body.classList.add('print-slips'); });
    await page.pdf({ path: path.join(output, prefix + 'slips.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('body')).not.toHaveClass(/print-slips/);
    for (const mode of ['packet', 'leave']) {
        await payrollRead(page, mode);
        await expect(page.locator('#packet-commit')).toBeEnabled();
        reviews.push({ mode, text: await page.locator('#review').innerText(), tables: await payrollTables(page, '#review table'), status: await page.locator('#pr-status').innerText() });
        await page.setViewportSize({ width: 320, height: 1000 });
        await page.screenshot({ path: path.join(output, prefix + 'review-' + mode + '-320.png'), fullPage: true });
        await page.locator('#packet-commit').click();
        await expect(page.locator('#pr-status')).toContainText(mode === 'leave' ? 'Saved leave balances for 2 of 2' : 'Saved 2 of 2');
        await expect(page.locator('#review')).toBeHidden();
    }
    expect(events.writes.map(w => ({ path: w.path, method: w.method }))).toEqual(['parse', 'import', 'parse', 'import'].map(p => ({ path: payrollPrefix + '/' + p, method: 'POST' })));
    expect(JSON.parse(events.writes[1].body)).toEqual({ jobId: 'synthetic-1' });
    expect(JSON.parse(events.writes[3].body)).toEqual({ jobId: 'synthetic-2' });
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind]).toEqual([]);
    const result = { base: source.base, leave, flags, views, periods, filtered, csv, slips, printStatus, reviews, writes: events.writes };
    fs.writeFileSync(path.join(output, prefix + 'browser.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
}
test('CSS staff workspaces: original payroll synthetic balances, register, slips, audit and verified import contracts', async ({ page }) => {
    await payrollWorkflow(page, true);
});



test('CSS staff workspaces: preserve the original DrainPro provider boundaries, tab content and four widths', async ({ page }) => {
    const events = await open(page, 'DrainPro-Bundle', { original: true }), views = [];
    await expect(page.locator('iframe')).toHaveCount(2);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['labels', 'employees']) {
            const button = page.locator('.tab-button').nth(tab === 'labels' ? 0 : 1);
            await button.focus(); await page.keyboard.press('Enter');
            await expect(page.locator('#' + tab + '-tab')).toHaveClass(/active/);
            views.push({ width, tab, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), title: await page.title(), text: await page.locator('#' + tab + '-tab').innerText(), links: await page.locator('a[href]').evaluateAll(ns => ns.map(n => n.getAttribute('href'))) });
            await page.screenshot({ path: path.join(output, 'staff-workspaces-drainpro-original-' + tab + '-' + width + '.png'), fullPage: true });
        }
    }
    expect(events.providers.sort()).toEqual([...providerPaths].sort());
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
    await page.pdf({ path: path.join(output, 'staff-workspaces-drainpro-original.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(output, 'staff-workspaces-drainpro-original-browser.json'), JSON.stringify({ base: source.base, views, events }, null, 2) + '\n');
});

async function shiftWorkflow(page, originalView) {
    const events = await open(page, 'production-shifts', { original: originalView });
    await expect(page.locator('h1')).toHaveText('Production Shifts');
    const departments = [], views = [], details = [];
    for (const dept of ['All', 'Embroidery', 'DTG', 'Ruthie/Mikalah']) {
        await page.getByRole('button', { name: new RegExp('^' + dept.replace('/', '\\/') + '\\s') }).click();
        departments.push({ dept, tables: await page.locator('table').evaluateAll(ns => ns.map(n => [...n.rows].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())))), timeline: await page.locator('.timeline-card').innerText() });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.pdf({ path: path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + dept.replace(/[^a-z]/gi, '-') + '.pdf'), preferCSSPageSize: true, printBackground: true });
    }
    await page.getByRole('button', { name: /^All\s/ }).click();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        views.push({ width, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), title: await page.title(), main: await page.locator('main').innerText() });
        await page.screenshot({ path: path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const names = await page.evaluate(() => window.NWCA_SCHEDULE.map(e => e.name));
    for (const name of names) {
        await page.getByRole('button', { name: name + ' — show shift details', exact: true }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        details.push({ name, text: await page.getByRole('dialog').innerText() });
        await page.keyboard.press('Escape');
    }
    const data = await page.evaluate(() => ({ schedule: window.NWCA_SCHEDULE, segments: window.NWCA_SCHEDULE.map(e => ({ id: e.id, segments: window.NWCA_HELPERS.segments(e) })) }));
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
    const result = { base: source.base, departments, views, details, data, events };
    fs.writeFileSync(path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + 'browser.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
}

test('CSS staff workspaces: original production schedule retains every department, employee detail and paper view', async ({ page }) => {
    await shiftWorkflow(page, true);
});

test('CSS staff workspaces: current production schedule preserves original records, department tables and segment math', async ({ page }) => {
    // CSS sentence case is deliberate; source/data guards still compare exact original values.
    const current = await shiftWorkflow(page, false), norm = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
    expect(current.data).toEqual(shiftBaseline.data);
    expect(current.departments.map(d => ({ ...d, timeline: norm(d.timeline) }))).toEqual(shiftBaseline.departments.map(d => ({ ...d, timeline: norm(d.timeline) })));
    expect(current.details.map(d => ({ ...d, text: norm(d.text) }))).toEqual(shiftBaseline.details.map(d => ({ ...d, text: norm(d.text) })));
    for (const view of current.views) {
        const original = shiftBaseline.views.find(v => v.width === view.width);
        expect(norm(view.main)).toBe(norm(original.main));
        expect(view.scrollWidth).toBeLessThanOrEqual(view.width);
    }
});

test('CSS staff workspaces: production schedule layout and accessibility audit', async ({ page }) => {
    const events = await open(page, 'production-shifts'), reports = [];
    await expect(page.locator('h1')).toHaveText('Production Shifts');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.locator('.topbar-right a').first()).toBeVisible();
        await expect(page.locator('.topbar-right a').last()).toBeVisible();
        const geometry = await page.evaluate(() => {
            const width = window.innerWidth;
            return { scrollWidth: document.documentElement.scrollWidth,
                overflow: [...document.querySelectorAll('body *')].filter(n => {
                    const r = n.getBoundingClientRect();
                    return r.width > 0 && r.right > width + 0.5 && !n.closest('.master-scroll, .timeline-scroll');
                }).map(n => ({ tag: n.tagName, class: n.className, right: n.getBoundingClientRect().right })),
                links: [...document.querySelectorAll('.topbar-right a')].map(n => ({ text: n.textContent, background: getComputedStyle(n).backgroundColor, color: getComputedStyle(n).color })) };
        });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        reports.push({ width, geometry, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) })) });
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-shifts-layout-audit.json'), JSON.stringify(reports, null, 2) + '\n');
    for (const report of reports) { expect(report.geometry.scrollWidth).toBeLessThanOrEqual(report.width); expect(report.violations).toEqual([]); }
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: production detail contains focus and its schedule regions scroll by keyboard', async ({ page }) => {
    const events = await open(page, 'production-shifts');
    for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const trigger = page.getByRole('button', { name: 'Kanha Chhorn — show shift details', exact: true }).first();
        await trigger.focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        const close = page.getByRole('button', { name: 'Close shift details' });
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab'); await expect(close).toBeFocused();
        await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused();
        await expect(page.locator('.ps-screen')).toHaveAttribute('inert', '');
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: path.join(output, 'staff-workspaces-shifts-detail-' + width + '.png'), fullPage: false });
        await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
        await expect(page.locator('.ps-screen')).not.toHaveAttribute('inert', '');
    }
    for (const name of ['Master production schedule', 'Production shift timeline']) {
        const region = page.getByRole('region', { name }); await region.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    }
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: expanded schedule reference remains readable at four widths', async ({ page }) => {
    const events = await open(page, 'production-shifts');
    const summary = page.locator('.rules-source summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.rules-source')).toHaveAttribute('open', '');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    }
    await page.locator('.rules-source').screenshot({ path: path.join(output, 'staff-workspaces-shifts-reference-320.png') });
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.rules-source')).not.toHaveAttribute('open', '');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

for (const missing of ['react', 'data']) test('CSS staff workspaces: missing ' + missing + ' keeps a readable schedule recovery link', async ({ page }) => {
    const events = await open(page, 'production-shifts', { block: u => missing === 'react' ? u.hostname === 'unpkg.com' && u.pathname === reactPaths[0] : u.pathname === '/dashboards/production-shifts/data.js' });
    await page.setViewportSize({ width: 320, height: 1000 });
    await expect(page.locator('#schedule-load-state')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reload schedule' })).toHaveAttribute('href', '/dashboards/production-shifts.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(events.writes).toEqual([]); expect(events.unknown).toEqual([]);
});

for (const width of [1440, 768, 390, 320]) test('CSS staff workspaces: DrainPro ' + width + ' retains content, accessible tabs and contained providers', async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const events = await open(page, 'DrainPro-Bundle');
    await expect(page.locator('iframe')).toHaveCount(2);
    for (const tab of ['labels', 'employees']) {
        const button = page.locator('#' + tab + '-tab-button');
        await button.click();
        await expect(button).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#' + tab + '-tab')).toBeVisible();
        const original = drainBaseline.views.find(v => v.width === width && v.tab === tab);
        const norm = s => s.replace(/\s+/g, ' ').trim();
        expect(norm(await page.locator('#' + tab + '-tab').innerText())).toBe(norm(original.text));
        expect(await page.locator('a[href]:not(.skip-link)').evaluateAll(ns => ns.map(n => n.getAttribute('href')))).toEqual(original.links);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('.table-container').analyze();
        expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: path.join(output, 'staff-workspaces-drainpro-' + tab + '-' + width + '.png'), fullPage: true });
    }
    expect(events.providers.sort()).toEqual([...providerPaths].sort());
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: DrainPro keyboard and direct calls retain exactly one selected view', async ({ page }) => {
    const events = await open(page, 'DrainPro-Bundle');
    await page.getByRole('tab').first().focus();
    for (const [key, id] of [['ArrowRight', 'employees'], ['ArrowRight', 'labels'], ['End', 'employees'], ['Home', 'labels'], ['ArrowLeft', 'employees']]) {
        await page.keyboard.press(key);
        await expect(page.locator('#' + id + '-tab-button')).toBeFocused();
        await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
    }
    await page.evaluate(() => { window.switchTab('labels'); window.switchTab('missing'); });
    await expect(page.locator('#labels-tab-button')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#labels-tab')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('.tab-content[hidden]')).toHaveCount(0);
    await page.pdf({ path: path.join(output, 'staff-workspaces-drainpro.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});
