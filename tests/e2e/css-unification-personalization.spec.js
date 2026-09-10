const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const data = require('../fixtures/personalization-review-data.json');
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
            return route.fulfill(state.writeResponse || { status: 503, json: { error: 'Synthetic write failure' } });
        }
        if (state.respond && p.startsWith('/api/')) { const response = await state.respond(u); if (response) return route.fulfill(response); }
        if (p === '/api/monograms') return route.fulfill(state.monograms || { json: { success: true, monograms: data.monograms } });
        if (p === '/api/rosters') return route.fulfill(state.rosters || { json: { success: true, rosters: data.rosters } });
        // Axe reads these already-linked public stylesheets to inspect contrast rules.
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && p === '/ajax/libs/font-awesome/6.4.0/css/all.min.css')) return route.continue();
        if (p.startsWith('/api/') || ['fetch', 'xhr'].includes(req.resourceType())) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['127.0.0.1', 'localhost'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    await page.goto('http://127.0.0.1:3400/dashboards/' + tool + '.html'); return events;
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
