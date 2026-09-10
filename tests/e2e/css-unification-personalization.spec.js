const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const data = require('../fixtures/personalization-review-data.json');
const originalSource = require('../fixtures/personalization-original-content.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true }); test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' }); test.describe.configure({ mode: 'parallel' });

async function open(page, tool, state = {}) {
    const events = { errors: [], writes: [], unknown: [], missing: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(data.fixed));
    await page.addInitScript(() => { window.print = () => {}; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (!['GET', 'HEAD'].includes(req.method()) || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postData() });
            return route.fulfill(state.respondWrite ? await state.respondWrite(req) : state.writeResponse || { status: 503, json: { error: 'Synthetic write failure' } });
        }
        if (state.respond && p.startsWith('/api/')) { const response = await state.respond(u); if (response) return route.fulfill(response); }
        if (p === '/api/monograms') return route.fulfill(state.monograms || { json: { success: true, monograms: data.monograms } });
        if (p === '/api/monograms/88001') return route.fulfill({ json: { success: true, monogram: state.monogram || data.monograms[0] } });
        if (p === '/api/thread-colors') return route.fulfill({ json: { success: true, colors: data.colors } });
        if (p === '/api/rosters/97001') return route.fulfill({ json: { success: true, roster: state.roster || data.rosters[0] } });
        if (p === '/api/rosters') return route.fulfill(state.rosters || { json: { success: true, rosters: data.rosters } });
        // Axe reads these already-linked public stylesheets to inspect contrast rules.
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && ['/ajax/libs/font-awesome/6.4.0/css/all.min.css', '/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'].includes(p))) return route.continue();
        if (p.startsWith('/api/') || ['fetch', 'xhr'].includes(req.resourceType())) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['127.0.0.1', 'localhost'].includes(u.hostname)) {
            if (state.original) {
                const retired = originalSource.retiredStyles.find(r => '/' + r.file === p);
                if (retired) { expect(require('node:crypto').createHash('sha256').update(retired.css).digest('hex')).toBe(retired.sha256); return route.fulfill({ contentType: 'text/css', body: retired.css }); }
            }
            const file = path.resolve(root, '.' + p);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            let body = fs.readFileSync(file);
            if (state.original && ['pages/names-numbers.html', 'shared_components/js/names-numbers-controller.js', 'quote-builders/monogram-form.html', 'shared_components/js/monogram-form-controller.js', 'shared_components/js/monogram-form-service.js'].includes(p.slice(1))) {
                const sourceFile = p.slice(1), html = originalSource.pages.find(record => record.file === sourceFile);
                body = html ? html.html : body.toString().replace(/\r\n/g, '\n');
                if (!html) for (const change of originalSource.changes.filter(c => c.file === sourceFile).reverse()) { expect(body.split(change.after).length - 1).toBe(change.count); body = body.split(change.after).join(change.before); }
                expect(require('node:crypto').createHash('sha256').update(body.replace(/\r\n/g, '\n')).digest('hex')).toBe(originalSource.hashes[sourceFile]);
            }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream', body });
        }
        return route.continue();
    });
    const url = { 'monogram-form': 'quote-builders/monogram-form.html?load=88001', 'roster-form': 'pages/names-numbers.html?load=97001' }[tool] || 'dashboards/' + tool + '.html';
    await page.goto('http://127.0.0.1:3400/' + url); return events;
}
function clean(events, writes = 0) { expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]); expect(events.writes).toHaveLength(writes); }
async function axe(page) { const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(result.violations).toEqual([]); }

for (const tool of ['monogram-dashboard', 'names-numbers-dashboard']) test('CSS personalization: ' + tool + ' keeps complete rows, keyboard scrolling and four-width accessibility', async ({ page }) => {
    const events = await open(page, tool); const count = tool === 'monogram-dashboard' ? 3 : 4;
    await expect(page.locator('tbody tr')).toHaveCount(count);
    const original = await page.locator('tbody').textContent();
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.locator('tbody').textContent()).toBe(original); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'personalization-' + tool + '-' + width + '.png'), fullPage: true }); }
    const region = page.getByRole('region', { name: /table/ }); await region.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' }); await expect(page.locator('h1')).toBeVisible(); expect(await page.locator('tbody').textContent()).toBe(original);
    await page.pdf({ path: path.join(output, 'personalization-' + tool + '.pdf'), preferCSSPageSize: true, printBackground: true }); clean(events);
});

test('CSS personalization: monogram search, date and printed filters retain original row data', async ({ page }) => {
    const events = await open(page, 'monogram-dashboard'); await expect(page.locator('tbody tr[data-id]')).toHaveCount(3);
    await page.locator('#searchInput').fill('88002'); await expect(page.locator('tbody tr[data-id]')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('Synthetic Harbor Team');
    await page.locator('#searchInput').fill(''); await page.locator('#statusFilter').selectOption('Printed'); await expect(page.locator('tbody tr[data-id]')).toHaveCount(1);
    await page.locator('#statusFilter').selectOption(''); await page.locator('#dateFrom').fill('2026-09-08'); await expect(page.locator('tbody tr[data-id]')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('88001'); clean(events);
});

test('CSS personalization: roster KPI filters, search and clear retain counts', async ({ page }) => {
    const events = await open(page, 'names-numbers-dashboard'); await expect(page.locator('#kpiTotal')).toHaveText('4');
    await page.getByRole('button', { name: '1 In Production', exact: true }).click(); await expect(page.locator('tbody tr[data-href]')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('Synthetic Pine Club');
    await page.locator('#clearFilterBtn').click(); await expect(page.locator('tbody tr[data-href]')).toHaveCount(4);
    await page.locator('#filterSearch').fill('Maple'); await expect(page.locator('tbody tr[data-href]')).toHaveCount(1); await expect(page.locator('#nnResultCount')).toHaveText('1 of 4 rosters'); clean(events);
});

for (const tool of ['monogram-dashboard', 'names-numbers-dashboard']) test('CSS personalization: ' + tool + ' initial failure can retry without misleading empty data', async ({ page }) => {
    const state = tool === 'monogram-dashboard' ? { monograms: { status: 503, json: { error: 'Synthetic outage' } } } : { rosters: { status: 503, json: { error: 'Synthetic outage' } } };
    const events = await open(page, tool, state); await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible(); await expect(page.locator('tbody')).toContainText(/Unable to load|Failed to load/);
    delete state.monograms; delete state.rosters; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(tool === 'monogram-dashboard' ? 3 : 4); clean(events);
});

for (const tool of ['monogram-dashboard', 'names-numbers-dashboard']) test('CSS personalization: ' + tool + ' failed reload clears old rows and filters keep the error visible', async ({ page }) => {
    const state = {}, events = await open(page, tool, state), mono = tool === 'monogram-dashboard';
    await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(mono ? 3 : 4);
    state[mono ? 'monograms' : 'rosters'] = { status: 503, json: { error: 'Synthetic reload failure' } };
    await page.evaluate(isMono => isMono ? window.loadMonograms() : window.dashboard.loadAll(), mono);
    await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(0);
    await page.locator(mono ? '#searchInput' : '#filterSearch').fill('Cedar');
    await page.waitForTimeout(250); // Existing search handlers debounce for 150ms.
    if (mono) await page.locator('#statusFilter').selectOption(''); else await page.locator('#filterBtn').click();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page.locator('tbody')).toContainText(/Unable to load|Failed to load/);
    delete state.monograms; delete state.rosters; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(mono ? 1 : 4); clean(events);
});

for (const tool of ['monogram-dashboard', 'names-numbers-dashboard']) test('CSS personalization: ' + tool + ' missing list data is unavailable rather than zero records', async ({ page }) => {
    const mono = tool === 'monogram-dashboard', state = { [mono ? 'monograms' : 'rosters']: { json: { success: true } } };
    const events = await open(page, tool, state); await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page.locator('tbody')).not.toContainText(/No results|No rosters|No monogram orders/);
    if (!mono) await expect(page.locator('#kpiTotal')).toHaveText('—'); clean(events);
});

for (const tool of ['monogram-dashboard', 'names-numbers-dashboard']) test('CSS personalization: ' + tool + ' ignores an older success after the newest refresh fails', async ({ page }) => {
    const mono = tool === 'monogram-dashboard', state = {}, events = await open(page, tool, state);
    await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(mono ? 3 : 4);
    let release; const api = mono ? '/api/monograms' : '/api/rosters';
    state.respond = async u => u.pathname === api ? new Promise(resolve => { release = resolve; }) : null;
    await page.evaluate(isMono => { void (isMono ? window.loadMonograms() : window.dashboard.loadAll()); }, mono); await expect.poll(() => typeof release).toBe('function');
    state.respond = async u => u.pathname === api ? { status: 503, json: { error: 'Synthetic newest failure' } } : null;
    await page.evaluate(isMono => isMono ? window.loadMonograms() : window.dashboard.loadAll(), mono); await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    const arrived = page.waitForResponse(r => new URL(r.url()).pathname === api && r.status() === 200);
    release({ json: mono ? { success: true, monograms: data.monograms } : { success: true, rosters: data.rosters } }); await arrived;
    await expect(page.locator('tbody tr[data-id],tbody tr[data-href]')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible(); clean(events);
});


for (const custom of [false, true]) test('CSS personalization: monogram restores ' + (custom ? 'custom' : 'catalog') + ' style numbers and production details', async ({ page }) => {
    const items = data.items.map((item, index) => ({ ...item, rowLocation: index ? 'Right Chest' : 'Left Sleeve', isCustomStyle: custom }));
    const monogram = { ...data.monograms[0], Locations: 'Left Sleeve, Right Chest', ItemsJSON: JSON.stringify(items) };
    const events = await open(page, 'monogram-form', { monogram });
    await expect(page.locator('#companyName')).toHaveValue(monogram.CompanyName);
    await expect(page.locator('#namesTableBody tr')).toHaveCount(2);
    const saved = await page.evaluate(() => window.monogramController.collectFormData());
    expect(saved.items.map(({ lineNumber, ...item }) => item)).toEqual(items);
    expect(saved.orderNumber).toBe('88001');
    expect(saved.threadColor).toBe('White, Black');
    expect(saved.location).toBe('Left Sleeve, Right Chest');
    const refreshed = await page.evaluate(() => { window.monogramController.refreshAllRows(); return window.monogramController.collectFormData(); });
    expect(refreshed.items.filter(item => item.monogramName).map(({ lineNumber, ...item }) => item)).toEqual(items);
    const reloaded = await page.evaluate(async () => {
        const controller = window.monogramController;
        controller.orderLoaded = true; controller.products = [{ style: 'DIFFERENT-ORDER', color: 'Gold' }];
        await controller.loadExistingForm('88001');
        return { form: controller.collectFormData(), orderLoaded: controller.orderLoaded, products: controller.products };
    });
    expect(reloaded.form.items.map(({ lineNumber, ...item }) => item)).toEqual(items);
    expect(reloaded.orderLoaded).toBe(false); expect(reloaded.products).toEqual([]);
    await page.locator('#namesTableBody .style-input').first().fill('PC54-REVIEW');
    await page.keyboard.press('Tab');
    await page.locator('#namesTableBody .size-input').first().selectOption('L');
    const edited = await page.evaluate(() => window.monogramController.collectFormData());
    expect(edited.items[0]).toMatchObject({ ...items[0], styleNumber: 'PC54-REVIEW', size: 'L' });
    clean(events);
});

test('CSS personalization: roster form preserves every garment and jersey value across four widths', async ({ page }) => {
    const events = await open(page, 'roster-form');
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await expect(page.locator('#rosterTableBody tr')).toHaveCount(2);
    const rows = [['Example', 'Avery', '07', 'M', 'EXAMPLE', '2', 'L', 'Cedar', '1', 'Goalkeeper'], ['Sample', 'Jordan', '12', 'L', 'SAMPLE', '1', 'XL', 'Cedar', '1', 'Defender']];
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.locator('#rosterTableBody tr').evaluateAll(ns => ns.map(n => [...n.querySelectorAll('input')].map(i => i.value)))).toEqual(rows);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await axe(page); await page.screenshot({ path: path.join(output, 'personalization-roster-form-' + width + '.png'), fullPage: true });
    }
    const region = page.getByRole('region', { name: 'Roster table' }); await region.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    clean(events);
});

test('CSS personalization: roster import and group dialogs trap focus and return it on Escape', async ({ page }) => {
    const events = await open(page, 'roster-form'); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    for (const [button, id] of [['#pasteNamesBtn', 'pasteModal'], ['#ocrBtn', 'ocrModal'], ['#addGroupBtn', 'addGroupModal']]) {
        await page.locator(button).click(); const dialog = page.locator('#' + id); await expect(dialog).toBeVisible();
        await axe(page);
        for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(n => n.contains(document.activeElement))).toBe(true); }
        await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page.locator(button)).toBeFocused();
    }
    clean(events);
});

for (const wide of [false, true]) test('CSS personalization: roster paper retains ' + (wide ? 'wide multi-page' : 'populated') + ' names, quantities and every custom column', async ({ page }) => {
    const state = {};
    if (wide) {
        const group = structuredClone(data.groups[0]);
        group.customColumns.push(...Array.from({ length: 8 }, (_, i) => ({ id: 'extra-' + i, label: 'Extra column ' + i })));
        const rows = Array.from({ length: 36 }, (_, i) => ({ ...structuredClone(data.rows[i % 2]), name: 'Person-' + (i + 1), number: String(i + 1).padStart(2, '0'), custom: { position: 'Role-' + (i + 1), ...Object.fromEntries(group.customColumns.slice(1).map((c, j) => [c.id, 'Value-' + (i + 1) + '-' + j])) } }));
        state.roster = { ...data.rosters[0], GroupsJSON: JSON.stringify([group]), RosterJSON: JSON.stringify(rows), TotalPersons: rows.length };
    }
    const events = await open(page, 'roster-form', state);
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await expect(page.locator('#rosterTableBody tr')).toHaveCount(wide ? 36 : 2);
    await page.locator('#printBtn').click();
    const paper = page.locator('.roster-paper');
    const expected = wide ? ['Person-36', 'Value-36-7', 'Role-36', 'Total: 36 people'] : ['Goalkeeper', 'Defender', 'EXAMPLE', 'Cedar', '07', 'PC54', 'PC78H', 'Total: 2 people'];
    for (const value of expected) await expect(paper).toContainText(value);
    await page.emulateMedia({ media: 'print' }); await expect(paper).toBeVisible(); await expect(page.locator('main')).not.toBeVisible();
    await page.pdf({ path: path.join(output, 'personalization-roster-paper-' + (wide ? 'wide' : 'populated') + '.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' }); await expect(paper).not.toBeVisible();
    await expect(page.locator('#rosterTableBody tr')).toHaveCount(wide ? 36 : 2);
    clean(events);
});

test('CSS personalization: roster search rejects a missing result list and retains retry', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state);
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    state.rosters = { json: { success: true } };
    await page.locator('#searchBtn').click(); await page.locator('#searchInput').fill('Cedar'); await page.locator('#searchGoBtn').click();
    await expect(page.locator('#searchResults')).toContainText('Search failed');
    await expect(page.locator('#searchResults')).not.toContainText('No rosters found');
    delete state.rosters; await page.getByRole('button', { name: 'Retry search', exact: true }).click();
    await expect(page.locator('.roster-search-result')).toHaveCount(4); clean(events);
});

test('CSS personalization: malformed roster data stays unavailable and cannot be saved over', async ({ page }) => {
    const state = { roster: { ...data.rosters[0], GroupsJSON: '{broken' } }, events = await open(page, 'roster-form', state);
    await expect(page.getByRole('alert')).toContainText('Unable to load roster');
    await page.evaluate(() => controller.save('Draft')); expect(events.writes).toHaveLength(0);
    state.roster = data.rosters[0]; await page.getByRole('button', { name: 'Retry load', exact: true }).click();
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity'); await expect(page.locator('#rosterTableBody tr')).toHaveCount(2);
    clean(events);
});

for (const reset of [false, true]) test('CSS personalization: a delayed roster cannot replace ' + (reset ? 'a new blank roster' : 'a newer selection'), async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    let release; state.respond = async u => {
        if (u.pathname === '/api/rosters/97002') { await new Promise(resolve => { release = resolve; }); return { json: { success: true, roster: data.rosters[1] } }; }
        if (u.pathname === '/api/rosters/97003') return { json: { success: true, roster: data.rosters[2] } };
    };
    await page.evaluate(() => { void controller.loadRoster(97002); });
    await expect.poll(() => Boolean(release)).toBe(true);
    if (reset) await page.locator('#newRosterBtn').click();
    else await page.evaluate(() => controller.loadRoster(97003));
    const expected = reset ? '' : data.rosters[2].RosterName;
    await expect(page.locator('#rosterName')).toHaveValue(expected);
    release(); await page.waitForTimeout(200);
    await expect(page.locator('#rosterName')).toHaveValue(expected); clean(events);
});

test('CSS personalization: a failed roster switch keeps the existing form inert until retry succeeds', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    state.respond = async u => u.pathname === '/api/rosters/97002' ? { status: 503, json: { error: 'Synthetic outage' } } : undefined;
    await page.evaluate(() => controller.loadRoster(97002));
    await expect(page.getByRole('alert')).toContainText('Unable to load roster');
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    expect(await page.locator('#rosterInfoCard').evaluate(n => n.inert)).toBe(true);
    await page.evaluate(() => controller.save('Submitted')); expect(events.writes).toHaveLength(0);
    await page.setViewportSize({ width: 320, height: 1000 }); await axe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    state.respond = async u => u.pathname === '/api/rosters/97002' ? { json: { success: true, roster: data.rosters[1] } } : undefined;
    await page.getByRole('button', { name: 'Retry load', exact: true }).click();
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Harbor Team');
    expect(await page.locator('#rosterInfoCard').evaluate(n => n.inert)).toBe(false); clean(events);
});

test('CSS personalization: older roster search results cannot replace the latest failure', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    const releases = [];
    state.respond = async u => {
        if (u.pathname !== '/api/rosters') return;
        const query = u.searchParams.get('companyName') || u.searchParams.get('rosterName');
        if (query === 'older') { await new Promise(resolve => releases.push(resolve)); return { json: { success: true, rosters: data.rosters } }; }
        return { json: { success: false, error: 'Synthetic latest failure' } };
    };
    await page.locator('#searchBtn').click(); await page.locator('#searchInput').fill('older'); await page.locator('#searchGoBtn').click();
    await expect.poll(() => releases.length).toBe(2);
    await page.locator('#searchInput').fill('latest'); await page.locator('#searchGoBtn').click();
    await expect(page.locator('#searchResults')).toContainText('Search failed');
    releases.forEach(resolve => resolve()); await page.waitForTimeout(200);
    await expect(page.locator('#searchResults')).toContainText('Search failed'); await expect(page.locator('.roster-search-result')).toHaveCount(0); clean(events);
});

test('CSS personalization: native roster export and save payload match the immutable original', async ({ page, context }) => {
    const before = await context.newPage();
    const originalEvents = await open(before, 'roster-form', { original: true });
    const events = await open(page, 'roster-form');
    const results = [];
    for (const [name, target, captured] of [['original', before, originalEvents], ['current', page, events]]) {
        await expect(target.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
        await expect(target.locator('#rosterTableBody tr')).toHaveCount(2);
        const pending = target.waitForEvent('download'); await target.locator('#exportExcelBtn').click(); const download = await pending;
        const file = path.join(output, 'personalization-roster-' + name + '-export.csv');
        await download.saveAs(file); results.push({ name: download.suggestedFilename(), body: fs.readFileSync(file, 'utf8') });
        await target.locator('#saveDraftBtn').click(); await expect(target.locator('#toast')).toContainText('Save failed');
        clean(captured, 1);
    }
    expect(results[1]).toEqual(results[0]);
    for (const value of ['Goalkeeper', 'Defender', '"07"', 'PC54', 'PC78H']) expect(results[1].body).toContain(value);
    expect(events.writes).toEqual(originalEvents.writes);
    await before.close();
});

test('CSS personalization: roster OCR supports keyboard file selection, visible failure and reviewed import', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#ocrBtn').click();
    const choose = page.getByRole('button', { name: 'Choose image or PDF', exact: true });
    await expect(choose).toBeVisible(); await choose.focus();
    let pending = page.waitForEvent('filechooser', { timeout: 5000 }); await page.keyboard.press('Enter');
    let chooser = await pending; await chooser.setFiles({ name: 'synthetic-roster.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic; OCR is mocked') });
    await expect(page.locator('#ocrResults')).toContainText('Error:'); await expect(page.locator('#ocrImportBtn')).not.toBeVisible();
    state.writeResponse = { json: { success: true, parsed: true, teamName: 'Synthetic OCR Team', garments: [{ label: 'Shirt', hasBackPrint: true }, { label: 'Hoodie', hasBackPrint: false }], entries: [{ name: 'Casey', number: '09', sizes: { Shirt: 'M', Hoodie: 'XL' }, backPrint: 'CASEY' }] } };
    await choose.focus(); pending = page.waitForEvent('filechooser', { timeout: 5000 }); await page.keyboard.press('Enter'); chooser = await pending;
    await chooser.setFiles({ name: 'synthetic-roster.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic; OCR is mocked') });
    await expect(page.locator('#ocrResults')).toContainText('Casey'); await expect(page.locator('#ocrImportBtn')).toBeVisible();
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await axe(page); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: path.join(output, 'personalization-roster-ocr-' + width + '.png'), fullPage: true }); }
    await page.locator('#ocrImportBtn').click(); await expect(page.locator('#ocrModal')).not.toBeVisible(); await expect(page.locator('#rosterTableBody tr')).toHaveCount(3);
    await expect(page.locator('#rosterTableBody input[data-key="number"]').last()).toHaveValue('09');
    await expect(page.locator('#rosterTableBody input[data-garment-id="shirt"][data-field="size"]').last()).toHaveValue('M');
    clean(events, 2);
});

for (const cancel of [false, true]) test('CSS personalization: late OCR cannot replace ' + (cancel ? 'a reopened dialog' : 'the newest file'), async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    let release, count = 0;
    state.respondWrite = async () => {
        const first = ++count === 1;
        if (first) await new Promise(resolve => { release = resolve; });
        return { json: { success: true, parsed: true, garments: [{ label: 'Shirt' }], entries: [{ name: first ? 'Older OCR result' : 'Current OCR result', size: 'M' }] } };
    };
    await page.locator('#ocrBtn').click();
    await page.locator('#ocrFileInput').setInputFiles({ name: 'earlier.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') });
    await expect.poll(() => Boolean(release)).toBe(true);
    if (cancel) { await page.keyboard.press('Escape'); await page.locator('#ocrBtn').click(); }
    await page.locator('#ocrFileInput').setInputFiles({ name: 'latest.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') });
    await expect(page.locator('#ocrResults')).toContainText('Current OCR result');
    release(); await page.waitForTimeout(200);
    await expect(page.locator('#ocrResults')).toContainText('Current OCR result'); await expect(page.locator('#ocrResults')).not.toContainText('Older OCR result');
    clean(events, 2);
});

test('CSS personalization: roster settings and pasted names keep editable columns and leading zeros', async ({ page }) => {
    const events = await open(page, 'roster-form'); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#toggleConfigBtn').click(); await expect(page.locator('#groupConfigBody')).toBeVisible();
    await expect(page.locator('#toggleConfigBtn')).toHaveAttribute('aria-expanded', 'true');
    page.once('dialog', dialog => dialog.accept('Locker'));
    await page.locator('#addCustomColumnBtn').click(); await expect(page.locator('.cc-label').last()).toHaveValue('Locker');
    await page.locator('#rosterTableBody input[data-kind="custom"]').nth(1).fill('005');
    await page.locator('#pasteNamesBtn').click(); await page.locator('#pasteTextarea').fill('Riley, 00, S\nMorgan\t04\tXL'); await page.locator('#pasteImportBtn').click();
    await expect(page.locator('#rosterTableBody tr')).toHaveCount(4);
    await expect(page.locator('#rosterTableBody input[data-key="number"]').nth(2)).toHaveValue('00');
    await expect(page.locator('#rosterTableBody input[data-key="number"]').nth(3)).toHaveValue('04');
    const saved = await page.evaluate(() => controller.getRosterData());
    const groups = JSON.parse(saved.GroupsJSON), rows = JSON.parse(saved.RosterJSON);
    expect(rows[0].custom[groups[0].customColumns.at(-1).id]).toBe('005');
    expect(rows[2].garmentData.shirt.size).toBe('S'); expect(rows[3].garmentData.shirt.size).toBe('XL');
    clean(events);
});

test('CSS personalization: rejected roster save retains its current status and unsaved edits', async ({ page }) => {
    const state = { writeResponse: { json: { success: false, error: 'Synthetic save rejection' } } }, events = await open(page, 'roster-form', state);
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#rosterName').fill('Synthetic revised roster'); await page.locator('#saveSubmitBtn').click();
    await expect(page.locator('#toast')).toContainText('Save failed');
    await expect(page.locator('#statusBadge')).toHaveText('Draft');
    await expect(page.locator('#saveSubmitBtn')).toBeFocused();
    expect(await page.evaluate(() => controller.isDirty)).toBe(true); clean(events, 1);
});

test('CSS personalization: pending roster save cannot submit twice or update a newer roster', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    const releases = [];
    state.respondWrite = async () => { await new Promise(resolve => releases.push(resolve)); return { json: { success: true } }; };
    state.respond = async u => u.pathname === '/api/rosters/97003' ? { json: { success: true, roster: data.rosters[2] } } : undefined;
    await page.locator('#saveSubmitBtn').click(); await expect.poll(() => releases.length).toBe(1);
    await page.evaluate(() => { void controller.save('Submitted'); }); await page.waitForTimeout(100);
    const requestCount = events.writes.length;
    await page.evaluate(() => controller.loadRoster(97003)); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Pine Club');
    releases.forEach(resolve => resolve()); await page.waitForTimeout(200);
    expect(requestCount).toBe(1); await expect(page.locator('#statusBadge')).toHaveText('In Production'); await expect(page.locator('#breadcrumbCurrent')).toHaveText('Synthetic Pine Club'); clean(events, 1);
});

test('CSS personalization: failed save-and-return does not make the next ordinary save navigate away', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#saveAndReturnBtn').click(); await expect(page.locator('#toast')).toContainText('Save failed');
    state.writeResponse = { json: { success: true } }; await page.locator('#saveDraftBtn').click(); await expect(page.locator('#toast')).toContainText('Roster saved');
    await page.waitForTimeout(800); expect(new URL(page.url()).pathname).toBe('/pages/names-numbers.html'); clean(events, 2);
});

test('CSS personalization: incomplete Excel results keep the current roster and allow file retry', async ({ page }) => {
    const state = { writeResponse: { json: { success: true, totalGroups: 1, totalRows: 2 } } }, events = await open(page, 'roster-form', state);
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity'); page.on('dialog', dialog => dialog.accept());
    const file = { name: 'synthetic-roster.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic workbook; parser is mocked') };
    await page.locator('#excelFileInput').setInputFiles(file); await expect(page.locator('#toast')).toContainText('Error parsing Excel');
    await expect(page.locator('#rosterTableBody tr')).toHaveCount(2);
    state.writeResponse = { json: { success: true, totalGroups: 1, totalRows: 2, groups: data.groups, rows: data.rows } };
    await page.locator('#excelFileInput').setInputFiles(file); await expect(page.locator('#toast')).toContainText('Imported 1 groups, 2 rows');
    await expect(page.locator('#rosterTableBody input[data-key="number"]').first()).toHaveValue('07'); clean(events, 2);
});

for (const switchRoster of [false, true]) test('CSS personalization: an older Excel import cannot replace ' + (switchRoster ? 'another roster' : 'a newer file'), async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    page.on('dialog', dialog => dialog.accept());
    let release, count = 0;
    state.respondWrite = async () => {
        const first = ++count === 1;
        if (first) await new Promise(resolve => { release = resolve; });
        return { json: { success: true, totalGroups: 1, totalRows: 2, groups: [{ ...data.groups[0], name: first ? 'Older import' : 'Latest import' }], rows: data.rows } };
    };
    state.respond = async u => u.pathname === '/api/rosters/97003' ? { json: { success: true, roster: data.rosters[2] } } : undefined;
    await page.locator('#excelFileInput').setInputFiles({ name: 'older.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
    await expect.poll(() => Boolean(release)).toBe(true);
    if (switchRoster) await page.evaluate(() => controller.loadRoster(97003));
    else await page.locator('#excelFileInput').setInputFiles({ name: 'latest.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
    const expected = switchRoster ? 'Varsity' : 'Latest import'; await expect(page.locator('.tab-btn').first()).toContainText(expected);
    release(); await page.waitForTimeout(200);
    await expect(page.locator('.tab-btn').first()).toContainText(expected); clean(events, switchRoster ? 1 : 2);
});

test('CSS personalization: adding a group preserves unsaved cells in the previous group', async ({ page }) => {
    const events = await open(page, 'roster-form'); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#rosterTableBody input[data-key="name"]').first().fill('Edited Example');
    await page.locator('#addGroupBtn').click(); await page.locator('#newGroupName').fill('Coaches'); await page.locator('#newGroupStyle').fill('ST350'); await page.locator('#newGroupColor').fill('White'); await page.locator('#addGroupConfirmBtn').click();
    await expect(page.locator('.tab-btn')).toHaveCount(2); await expect(page.locator('#rosterTableBody tr')).toHaveCount(5);
    await page.locator('.tab-btn').first().click(); await expect(page.locator('#rosterTableBody input[data-key="name"]').first()).toHaveValue('Edited Example');
    await expect(page.locator('#rosterTableBody input[data-key="number"]').first()).toHaveValue('07'); clean(events);
});

test('CSS personalization: required group and paste input errors stay inside their dialogs', async ({ page }) => {
    const events = await open(page, 'roster-form'); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    for (const [opener, field, submit, message] of [['#addGroupBtn', '#newGroupName', '#addGroupConfirmBtn', 'Please enter a group name'], ['#pasteNamesBtn', '#pasteTextarea', '#pasteImportBtn', 'Paste some names first']]) {
        await page.locator(opener).click(); await page.locator(submit).click(); await expect(page.locator(field)).toBeFocused();
        expect(await page.locator(field).evaluate(n => n.validationMessage)).toBe(message);
        await page.keyboard.press('Escape'); await expect(page.locator(opener)).toBeFocused();
    }
    clean(events);
});

test('CSS personalization: garment controls retain entered back lines across column changes', async ({ page }) => {
    const events = await open(page, 'roster-form'); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    await page.locator('#toggleConfigBtn').click(); await page.locator('#addGarmentBtn').click(); await expect(page.locator('.garment-row')).toHaveCount(3);
    await page.locator('.gf-label').last().fill('Jacket'); await page.locator('.gf-label').last().press('Tab');
    await page.locator('.gf-backLines').last().check();
    await page.locator('#rosterTableBody input[data-field="backLine1"]').first().fill('TEAM 2026');
    await page.locator('.gf-qty').last().check();
    await expect(page.locator('#rosterTableBody input[data-field="backLine1"]').first()).toHaveValue('TEAM 2026');
    await page.setViewportSize({ width: 320, height: 1000 }); await axe(page); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    page.once('dialog', dialog => dialog.accept()); await page.locator('.garment-delete-btn').last().click();
    await expect(page.locator('.garment-row')).toHaveCount(2); await expect(page.locator('#rosterTableBody input[data-key="number"]').first()).toHaveValue('07'); clean(events);
});

test('CSS personalization: a confirmed new roster keeps its ID for subsequent saves', async ({ page }) => {
    const state = { writeResponse: { json: { success: true, roster: { ID_Roster: 97009 } } } }, events = await open(page, 'roster-form', state);
    await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity'); await page.locator('#newRosterBtn').click();
    await page.locator('#rosterName').fill('Synthetic new roster'); await page.locator('#saveDraftBtn').click();
    await expect(page.locator('#toast')).toContainText('Roster created successfully'); expect(new URL(page.url()).searchParams.get('load')).toBe('97009');
    await page.locator('#saveSubmitBtn').click(); await expect(page.locator('#statusBadge')).toHaveText('Submitted');
    expect(events.writes.map(({ path, method }) => ({ path, method }))).toEqual([{ path: '/api/rosters', method: 'POST' }, { path: '/api/rosters/97009', method: 'PUT' }]); clean(events, 2);
});

test('CSS personalization: saving the current roster cancels an earlier pending Excel replacement', async ({ page }) => {
    const state = {}, events = await open(page, 'roster-form', state); await expect(page.locator('#rosterName')).toHaveValue('Synthetic Cedar Varsity');
    let release, dialogs = 0; page.on('dialog', dialog => { dialogs++; return dialog.accept(); });
    state.respondWrite = async req => {
        if (new URL(req.url()).pathname.endsWith('/parse-excel')) { await new Promise(resolve => { release = resolve; }); return { json: { success: true, groups: [{ ...data.groups[0], name: 'Earlier import' }], rows: data.rows, totalGroups: 1, totalRows: 2 } }; }
        return { json: { success: true } };
    };
    await page.locator('#excelFileInput').setInputFiles({ name: 'earlier.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
    await expect.poll(() => Boolean(release)).toBe(true); await page.locator('#saveDraftBtn').click(); await expect(page.locator('#toast')).toContainText('Roster saved');
    release(); await page.waitForTimeout(200); await expect(page.locator('.tab-btn').first()).toContainText('Varsity');
    expect(dialogs).toBe(0); expect(await page.evaluate(() => controller.isDirty)).toBe(false); clean(events, 2);
});
function validMonogram() { return { ...data.monograms[0], Locations: 'Left Sleeve, Right Chest', ItemsJSON: JSON.stringify(data.items.map((item,index)=>({...item,rowLocation:index?'Right Chest':'Left Sleeve'}))) }; }
test('CSS personalization: monogram form keeps production values and keyboard access at four widths', async ({page})=>{
    const events=await open(page,'monogram-form',{monogram:validMonogram()});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');
    const before=await page.evaluate(()=>window.monogramController.collectFormData());
    for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>window.monogramController.collectFormData())).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await axe(page);await page.screenshot({path:path.join(output,'personalization-monogram-form-'+width+'.png'),fullPage:true});}
    const region=page.getByRole('region',{name:'Monogram names table'});await region.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
    await page.locator('.skip-link').focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();clean(events);
});
test('CSS personalization: monogram print and customer proof preserve names, garments and authoritative thread colors',async({page})=>{
    const events=await open(page,'monogram-form',{monogram:validMonogram()});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');
    await page.locator('#printPdfBtn').click();await page.emulateMedia({media:'print'});await expect(page.locator('#printTemplate')).toBeVisible();await expect(page.locator('#proofTemplate')).toBeHidden();
    for(const value of ['PC54','L500','Avery','Jordan','White','Black','Left Sleeve','Right Chest'])await expect(page.locator('#printTemplate')).toContainText(value);
    const contrast = await page.locator('#printNamesTable th').first().evaluate(n=>{ const c=getComputedStyle(n),lum=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};const a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);}); expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.pdf({path:path.join(output,'personalization-monogram-production.pdf'),preferCSSPageSize:true,printBackground:true});
    await page.emulateMedia({media:'screen'});await page.locator('#printProofBtn').click();await page.emulateMedia({media:'print'});await expect(page.locator('#proofTemplate')).toBeVisible();await expect(page.locator('#printTemplate')).toBeHidden();
    await expect(page.locator('#proofTemplate')).toContainText('exactly as shown —');await expect(page.locator('.proof-name')).toHaveText(['Avery','Jordan']);
    expect(await page.locator('.proof-name').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).color))).toEqual(['rgb(255, 255, 255)','rgb(0, 0, 0)']);
    await page.pdf({path:path.join(output,'personalization-monogram-customer-proof.pdf'),preferCSSPageSize:true,printBackground:true});clean(events);
});
test('CSS personalization: monogram pickers keep keyboard focus and announce open state',async({page})=>{
 const events=await open(page,'monogram-form',{monogram:validMonogram()});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');
 for(const prefix of ['threadColor','location']){const button=page.locator('#'+prefix+'Btn');await button.click();await expect(button).toHaveAttribute('aria-expanded','true');await page.locator('#'+prefix+'DoneBtn').click();await expect(button).toBeFocused();await button.click();await page.keyboard.press('Escape');await expect(page.locator('#'+prefix+'Dropdown')).toBeHidden();await expect(button).toBeFocused();}
 clean(events);
});
test('CSS personalization: malformed monogram details retain the current names with a load retry',async({page})=>{
 const state={monogram:validMonogram()},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');const before=await page.evaluate(()=>window.monogramController.collectFormData());
 state.monogram={...validMonogram(),ItemsJSON:'{broken'};await page.evaluate(()=>window.monogramController.loadExistingForm('88001'));expect(await page.evaluate(()=>window.monogramController.collectFormData())).toEqual(before);await expect(page.getByRole('button',{name:'Retry load',exact:true})).toBeVisible();await expect(page.locator('#monogramForm')).toHaveAttribute('inert','');
 state.monogram=validMonogram();await page.getByRole('button',{name:'Retry load',exact:true}).click();await expect(page.locator('#monogramForm')).not.toHaveAttribute('inert','');clean(events);
});
test('CSS personalization: monogram search failures stay visible and can retry',async({page})=>{
 const state={monogram:validMonogram()},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#searchBtn').click();await page.locator('#searchCompanyName').fill('Cedar');state.monograms={status:503,json:{error:'Synthetic outage'}};await page.locator('#doSearchBtn').click();await expect(page.getByRole('button',{name:'Retry search',exact:true})).toBeVisible();await expect(page.locator('#searchResults')).not.toContainText('No forms found');delete state.monograms;await page.getByRole('button',{name:'Retry search',exact:true}).click();await expect(page.locator('.btn-load-result')).toHaveCount(3);clean(events);
});
test('CSS personalization: monogram save prevents duplicates and ignores a newer form',async({page})=>{
 const state={monogram:validMonogram()},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');let release;state.respondWrite=async()=>new Promise(resolve=>{release=resolve;});
 await page.evaluate(()=>{window.monogramController.saveDraft();window.monogramController.saveDraft();});await expect.poll(()=>events.writes.length).toBe(1);await expect(page.locator('#monogramForm')).toHaveAttribute('inert','');
 await page.evaluate(()=>{window.monogramController.isDirty=false;window.monogramController.clearForm();});release({json:{success:true,monogram:{ID_Monogram:99001}}});await expect(page.locator('#loadingOverlay')).toBeHidden();await expect(page.locator('#companyName')).toHaveValue('');expect(new URL(page.url()).searchParams.has('load')).toBe(false);expect(await page.evaluate(()=>window.monogramController.currentMonogramID)).toBeNull();clean(events,1);
});
test('CSS personalization: missing thread library shows an in-place retry',async({page})=>{
 const state={monogram:validMonogram(),respond:async u=>u.pathname==='/api/thread-colors'?{status:503,json:{error:'Synthetic colors unavailable'}}:null},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#threadColorBtn').click();await expect(page.getByRole('button',{name:'Retry thread colors',exact:true})).toBeVisible();await expect(page.locator('#threadColorList')).not.toContainText('No colors found');delete state.respond;await page.getByRole('button',{name:'Retry thread colors',exact:true}).click();await expect(page.locator('#threadColorList input')).toHaveCount(3);clean(events);
});
test('CSS personalization: monogram color and custom-location controls preserve row choices at phone widths',async({page})=>{
 const events=await open(page,'monogram-form',{monogram:validMonogram()});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.setViewportSize({width:320,height:1000});
 await page.locator('#threadColorBtn').click();await page.locator('#threadColorSearch').fill('Gold');await page.locator('label[for="tc_3"]').click();await expect(page.locator('#tc_3')).toBeChecked();await page.locator('#threadColorDoneBtn').click();await page.locator('#namesTableBody .row-thread-color').first().selectOption('Gold');await expect(page.locator('#namesTableBody .row-thread-color').nth(1)).toHaveValue('Black');
 await page.locator('#locationBtn').click();await page.locator('label[for="loc_Other"]').click();await page.locator('#locationOtherText').fill('Inside collar');await axe(page);await page.locator('#locationDoneBtn').click();
 await page.locator('#namesTableBody .row-location').first().selectOption('Other: Inside collar');const form=await page.evaluate(()=>window.monogramController.collectFormData());expect(form.items[0]).toMatchObject({styleNumber:'PC54',monogramName:'Avery',rowThreadColor:'Gold',rowLocation:'Other: Inside collar'});expect(form.items[1]).toMatchObject({rowThreadColor:'Black',rowLocation:'Right Chest'});clean(events);
});
test('CSS personalization: monogram bulk names and stitch-check fixes preserve spelling and prevent an unapproved print',async({page})=>{
 const events=await open(page,'monogram-form',{monogram:validMonogram()});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#pasteNamesInput').fill("Avery\nJordan\nO'Neil");await page.locator('#importNamesBtn').click();await expect(page.locator('#unassignedNamesList')).toContainText("O'Neil");
 await page.locator('#namesTableBody .name-input').first().fill(' Avery  Example ');await page.evaluate(()=>window.monogramController.runStitchCheck());await expect(page.locator('.btn-fix-finding').first()).toBeVisible();await page.locator('.btn-fix-finding').first().click();await expect(page.locator('#namesTableBody .name-input').first()).toHaveValue('Avery Example');
 await page.locator('#namesTableBody .row-thread-color').first().selectOption('');await page.evaluate(()=>{window.printCalls=0;window.print=()=>window.printCalls++;window.monogramController.runStitchCheck();});
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#printProofBtn').click();expect(await page.evaluate(()=>window.printCalls)).toBe(0);await axe(page);clean(events);
});
test('CSS personalization: a delayed monogram load cannot replace a cleared or newer form',async({page})=>{
 const state={monogram:validMonogram()},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');let release;state.respond=async u=>u.pathname==='/api/monograms/88002'?new Promise(resolve=>{release=resolve;}):null;
 await page.evaluate(()=>{window.monogramController.loadExistingForm('88002');});await expect.poll(()=>Boolean(release)).toBe(true);await page.evaluate(()=>{window.monogramController.isDirty=false;window.monogramController.clearForm();});release({json:{success:true,monogram:{...validMonogram(),OrderNumber:88002,CompanyName:'Older response'}}});await page.waitForTimeout(150);await expect(page.locator('#companyName')).toHaveValue('');await expect(page.locator('#loadingOverlay')).toBeHidden();clean(events);
});
for(const kind of ['missing-id','http-error'])test('CSS personalization: monogram save rejects '+kind+' without losing edits',async({page})=>{
 const state={monogram:validMonogram(),writeResponse:kind==='missing-id'?{json:{success:true}}:{status:503,json:{success:true,monogram:{ID_Monogram:99001}}}},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#namesTableBody .name-input').first().fill('Avery Review');await page.locator('#saveDraftBtn').click();await expect(page.locator('.toast-error')).toContainText(/Failed|save/);await expect(page.locator('#namesTableBody .name-input').first()).toHaveValue('Avery Review');expect(await page.evaluate(()=>window.monogramController.isDirty)).toBe(true);await expect(page.locator('#saveDraftBtn')).toBeFocused();clean(events,1);
});
test('CSS personalization: long monogram production and script proof keep all 48 names',async({page})=>{
 const items=Array.from({length:48},(_,i)=>({...data.items[i%2],monogramName:'Synthetic Name '+String(i+1).padStart(2,'0'),rowLocation:i%2?'Right Chest':'Left Sleeve'}));
 const events=await open(page,'monogram-form',{monogram:{...validMonogram(),FontStyle:'Script',TotalItems:48,ItemsJSON:JSON.stringify(items)}});await expect(page.locator('#namesTableBody tr')).toHaveCount(48);
 await page.locator('#printPdfBtn').click();await page.emulateMedia({media:'print'});await expect(page.locator('#printNamesTableBody tr:not(.thread-change-row)')).toHaveCount(48);await page.pdf({path:path.join(output,'personalization-monogram-production-long.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.emulateMedia({media:'screen'});await page.locator('#printProofBtn').click();await page.emulateMedia({media:'print'});await expect(page.locator('.proof-name')).toHaveText(items.map(i=>i.monogramName));expect(await page.locator('.proof-name').first().evaluate(n=>getComputedStyle(n).fontFamily)).toContain('Dancing Script');await page.pdf({path:path.join(output,'personalization-monogram-proof-long.pdf'),preferCSSPageSize:true,printBackground:true});clean(events);
});
test('CSS personalization: monogram native save payload matches the original after entering the same garment styles',async({page,context})=>{
 async function capture(target,original){const events=await open(target,'monogram-form',{monogram:validMonogram(),original});await expect(target.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await target.locator('#namesTableBody .style-input').first().fill('PC54');await target.locator('#namesTableBody .style-input').nth(1).fill('L500');await target.locator('#saveDraftBtn').click();await expect.poll(()=>events.writes.length).toBe(1);const payload=JSON.parse(events.writes[0].body);if(original){expect(events.errors).toEqual(Array(2).fill("Cannot read properties of null (reading 'style')"));clean({...events,errors:[]},1);}else clean(events,1);return payload;}
 const baseline=await context.newPage();const original=await capture(baseline,true);await baseline.close();const current=await capture(page,false);expect(current).toEqual(original);expect(JSON.parse(current.ItemsJSON).map(i=>i.monogramName)).toEqual(['Avery','Jordan']);
});
test('CSS personalization: monogram order lookup retains existing names and supports catalog and custom styles',async({page})=>{
 const state={monogram:validMonogram(),respond:async u=>u.pathname==='/api/mo/orders/88001'?{json:{result:[{id_Order:88001,CustomerName:'Synthetic lookup company',CustomerServiceRep:'Review'}]}}:u.pathname==='/api/mo/lineitems/88001'?{json:{result:[{PartNumber:'PC54',PartDescription:'Synthetic cotton tee',PartColor:'Navy',Size02:3,Size03:2}]}}:null};
 const events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#lookupOrderBtn').click();await expect(page.locator('#companyName')).toHaveValue('Synthetic lookup company');await expect(page.locator('#namesTableBody .name-input').first()).toHaveValue('Avery');await page.locator('#namesTableBody .style-input').first().selectOption('PC54|Navy');await page.locator('#namesTableBody .size-input').first().selectOption('M');await expect(page.locator('#namesTableBody .color-input').first()).toHaveValue('Navy');
 await page.locator('#addRowBtn').click();await page.locator('#namesTableBody .style-input').last().selectOption('__custom__');await page.locator('#namesTableBody .style-custom').last().fill('CUSTOM-REVIEW');await page.locator('#namesTableBody .name-input').last().fill('O’Neil');const form=await page.evaluate(()=>window.monogramController.collectFormData());expect(form.items.at(-1)).toMatchObject({styleNumber:'CUSTOM-REVIEW',isCustomStyle:true,monogramName:'O’Neil'});await page.setViewportSize({width:320,height:1000});await axe(page);clean(events);
});
test('CSS personalization: newer monogram search failure is not replaced by an older result',async({page})=>{
 const state={monogram:validMonogram()},events=await open(page,'monogram-form',state);await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#searchBtn').click();await page.locator('#searchCompanyName').fill('Older');let release;state.respond=async u=>u.pathname==='/api/monograms'?new Promise(resolve=>{release=resolve;}):null;await page.evaluate(()=>{window.monogramController.handleSearch();});await expect.poll(()=>Boolean(release)).toBe(true);
 delete state.respond;state.monograms={status:503,json:{error:'Newest failure'}};await page.locator('#searchCompanyName').fill('Newer');await page.evaluate(()=>window.monogramController.handleSearch());await expect(page.getByRole('button',{name:'Retry search',exact:true})).toBeVisible();release({json:{success:true,monograms:data.monograms}});await page.waitForTimeout(150);await expect(page.locator('.btn-load-result')).toHaveCount(0);await expect(page.getByRole('button',{name:'Retry search',exact:true})).toBeVisible();clean(events);
});
test('CSS personalization: successful monogram save keeps the current order and clears dirty state',async({page})=>{
 const events=await open(page,'monogram-form',{monogram:validMonogram(),writeResponse:{json:{success:true,monogram:{ID_Monogram:99001}}}});await expect(page.locator('#companyName')).toHaveValue('Synthetic Cedar Outfitters');await page.locator('#notesToProduction').fill('Synthetic approved production note');await page.locator('#saveDraftBtn').click();await expect(page.locator('.toast-success').last()).toHaveText(/Saved! Order #88001/);expect(await page.evaluate(()=>({dirty:window.monogramController.isDirty,id:window.monogramController.currentMonogramID}))).toEqual({dirty:false,id:99001});expect(new URL(page.url()).searchParams.get('load')).toBe('88001');clean(events,1);
});
