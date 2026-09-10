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
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && p === '/ajax/libs/font-awesome/6.4.0/css/all.min.css')) return route.continue();
        if (p.startsWith('/api/') || ['fetch', 'xhr'].includes(req.resourceType())) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['127.0.0.1', 'localhost'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            let body = fs.readFileSync(file);
            if (state.original && ['pages/names-numbers.html', 'shared_components/js/names-numbers-controller.js'].includes(p.slice(1))) {
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
