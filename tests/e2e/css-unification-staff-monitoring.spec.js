const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/staff-monitoring-review-data.json');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
async function open(page, name, state = {}) {
    const events = { errors: [], writes: [] };
    page.on('pageerror', error => events.errors.push(error.message));
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) { events.writes.push(url.pathname); return route.fulfill({ status: 503 }); }
        let body;
        if (url.pathname === '/api/crm-proxy/admin/usage') body = state.usage === undefined ? fixture.usage : state.usage;
        if (url.pathname === '/api/crm-proxy/admin/metrics') body = state.metrics === undefined ? fixture.metrics : state.metrics;
        if (url.pathname === '/api/caspio-schema/usage') body = state.schema === undefined ? 503 : state.schema;
        if (body !== undefined) return route.fulfill(typeof body === 'number' ? { status: body, json: { error: 'Unavailable fixture' } } : { json: body });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Unmocked business read blocked' } });
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            const file = path.resolve(root, '.' + url.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.fallback();
    });
    await page.goto('/dashboards/' + name + '.html'); await page.evaluate(() => document.fonts.ready);
    if (name === 'api-usage') await expect(page.locator('#au-tables')).not.toHaveClass('dash-loading');
    if (name === 'table-usage-audit') await expect(page.locator('#tuaTable tbody tr')).toHaveCount(163);
    return events;
}
const clean = events => { expect(events.errors).toEqual([]); expect(events.writes).toEqual([]); };
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
for (const name of ['api-usage', 'table-usage-audit', 'bandit-integration']) test('CSS monitoring: ' + name + ' at four widths, keyboard and complete paper', async ({ page }) => {
    test.setTimeout(180000); const events = await open(page, name);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 950 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await axe(page); await page.screenshot({ path: path.join(output, 'monitoring-' + name + '-' + width + '.png') });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#monitor-main')).toBeFocused();
    for (const region of await page.locator('.table-wrap').all()) { await region.focus(); await expect(region).toBeFocused(); await page.keyboard.press('End'); }
    if (name === 'table-usage-audit') {
        await page.locator('#tuaSearch').fill('Art_CustomerInfo_2024');
        await page.locator('.tua-note').fill('Long review note, with "quoted text", must wrap completely in the printed current view.');
        await page.locator('.tua-decide').selectOption('keep'); await page.locator('.tua-rev').check();
    }
    await page.setViewportSize({ width: 1440, height: 950 }); await page.emulateMedia({ media: 'print' });
    const blocks = await page.locator('h1,h2,h3,h4,main p,main li,main pre,main th,main td,.au-scope,.au-stat-value,.au-meter-caption,.au-row-label,.au-row-count,.au-method,.au-trend-axis,.dash-stat-value,.dash-stat-label,.bi-node,.bi-arrow,.bi-chip,.tua-count').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => {
        const copy = n.cloneNode(true); copy.querySelectorAll('input,select,button').forEach(control => control.remove()); return copy.textContent.replace(/\s+/g, ' ').trim();
    }).filter(Boolean));
    const values = name === 'table-usage-audit' ? await page.locator('.tua-note,.tua-decide').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean)).then(values => [...values, 'Reviewed']) : [];
    fs.writeFileSync(path.join(output, 'monitoring-' + name + '-print.json'), JSON.stringify({ blocks, values }));
    await page.pdf({ path: path.join(output, 'monitoring-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' }); await expect(page.locator('.tua-print-value,.tua-print-reviewed')).toHaveCount(0); clean(events);
});
test('CSS monitoring: usage figures, warning bands and trend scope retain server values', async ({ page }) => {
    const state = {}, events = await open(page, 'api-usage', state);
    await expect(page.locator('#au-projected')).toHaveText('420,000'); await expect(page.locator('#au-period-to-date')).toHaveText('160,000');
    await expect(page.locator('#au-mode')).toContainText('rollup'); await expect(page.locator('.au-bar--untrusted')).toHaveCount(2);
    await expect(page.locator('.au-bar').first()).toHaveAttribute('aria-label', /pre-repair/);
    for (const [pct, cls] of [[94, 'warn'], [110, 'over']]) {
        state.usage = { success: true, data: { ...fixture.usage.data, percentOfLimit: pct, projected: pct * 5000, estimatedOverageUsd: pct > 100 ? 100 : 0 } };
        await page.locator('#au-refresh').click(); await expect(page.locator('#au-meter-fill')).toHaveClass('au-meter-fill au-meter-fill--' + cls); await axe(page);
    }
    state.usage = { success: true, data: { ...fixture.usage.data, mode: 'dyno', rollupByDay: undefined, rollupError: 'Unavailable rollup' } };
    await page.locator('#au-refresh').click(); await expect(page.locator('#au-mode')).toContainText('LOWER BOUND'); await expect(page.locator('#au-mode')).toContainText('Unavailable rollup');
    state.usage = { success: true, data: { ...fixture.usage.data, mode: 'insufficient', projected: null, percentOfLimit: null } };
    await page.locator('#au-refresh').click(); await expect(page.locator('#au-projected')).toHaveText('n/a'); await expect(page.locator('#au-mode')).toContainText('not enough history'); clean(events);
});
for (const [key, value] of [['usage', 403], ['usage', {}], ['usage', { success: true, data: { ...fixture.usage.data, projected: 'unknown' } }], ['metrics', 503], ['metrics', { success: true, data: { callsByTable: {}, callsByEndpoint: [], callsByMethod: {} } }]]) test('CSS monitoring: invalid ' + key + ' ' + JSON.stringify(value) + ' stays unknown and retries', async ({ page }) => {
    const state = { [key]: value }, events = await open(page, 'api-usage', state);
    await expect(page.locator('.dash-error-banner')).toBeVisible(); await expect(page.locator('#au-overage')).toHaveText('—'); await expect(page.locator('#au-mode')).toHaveText('Data source unavailable.'); await axe(page);
    state[key] = fixture[key]; await page.locator('#au-refresh').click(); await expect(page.locator('#au-projected')).toHaveText('420,000'); await expect(page.locator('.dash-error-banner')).toBeHidden(); clean(events);
});
test('CSS monitoring: zero usage is valid, extreme projection remains contained', async ({ page }) => {
    const state = { usage: { success: true, data: { ...fixture.usage.data, projected: 0, periodToDate: 0, percentOfLimit: 0 } }, metrics: { success: true, data: { callsByTable: [], callsByEndpoint: [], callsByMethod: {} } } };
    const events = await open(page, 'api-usage', state); await expect(page.locator('#au-projected')).toHaveText('0'); await expect(page.locator('#au-tables')).toContainText('No calls recorded');
    state.usage.data.projected = 123456789; state.usage.data.percentOfLimit = 24691; await page.setViewportSize({ width: 320, height: 950 }); await page.locator('#au-refresh').click();
    await expect(page.locator('#au-projected')).toHaveText('123,456,789'); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320); clean(events);
});
test('CSS monitoring: audit keyboard sort/filter and local review survive reload and export', async ({ page }) => {
    const events = await open(page, 'table-usage-audit');
    const sort = page.locator('th[data-sort="name"] button'); await sort.focus(); await page.keyboard.press('Enter'); await expect(page.locator('th[data-sort="name"]')).toHaveAttribute('aria-sort', 'ascending'); await expect(page.locator('th[data-sort="name"] button')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('th[data-sort="name"]')).toHaveAttribute('aria-sort', 'descending');
    await page.locator('[data-filter="cand"]').click(); await expect(page.locator('[data-filter="cand"]')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('#tuaTable tbody tr')).toHaveCount(32);
    await page.locator('#tuaSearch').fill('Art_CustomerInfo_2024'); await page.locator('.tua-note').fill('Reviewed, with "quotes"'); await page.locator('.tua-decide').selectOption('keep'); await page.locator('.tua-rev').check();
    await page.reload(); await page.locator('#tuaSearch').fill('Art_CustomerInfo_2024'); await expect(page.locator('.tua-note')).toHaveValue('Reviewed, with "quotes"'); await expect(page.locator('.tua-decide')).toHaveValue('keep'); await expect(page.locator('.tua-rev')).toBeChecked();
    const pending = page.waitForEvent('download'); await page.locator('#tuaExport').click(); const download = await pending;
    const rows = require('csv-parse/sync').parse(fs.readFileSync(await download.path()), { columns: true }); expect(rows).toHaveLength(163); expect(rows.find(row => row.table === 'Art_CustomerInfo_2024')).toMatchObject({ decision: 'keep', notes: 'Reviewed, with "quotes"', reviewed: 'true' });
    await page.locator('#tuaSearch').fill('no such table'); await expect(page.locator('#tuaTable')).toContainText('No tables match'); clean(events);
});
for (const failure of [503, {}, { success: true, count: 2, generatedAt: '2026-09-09T19:00:00Z', tables: [] }]) test('CSS monitoring: invalid live audit ' + JSON.stringify(failure) + ' preserves the snapshot', async ({ page }) => {
    const state = { schema: failure }, events = await open(page, 'table-usage-audit', state);
    await page.locator('#tuaLive').click(); await expect(page.locator('.dash-error-banner')).toBeVisible(); await expect(page.locator('#tuaTable tbody tr')).toHaveCount(163); await expect(page.locator('.tua-live-gone')).toHaveCount(0); await expect(page.locator('#tuaLive')).toBeEnabled(); clean(events);
    const tables = await page.locator('#tuaTable tbody tr').evaluateAll(nodes => nodes.map(row => ({ name: row.dataset.n, fieldCount: Number(row.cells[3].textContent), view: false, rel: false, webhook: false })));
    state.schema = { success: true, generatedAt: '2026-09-09T19:00:00Z', count: tables.length, tables };
    await page.locator('#tuaLive').click(); await expect(page.locator('#tuaLiveInfo')).toContainText('live: 163 tables'); await expect(page.locator('.dash-error-banner')).toBeHidden(); clean(events);
});
test('CSS monitoring: complete live audit preserves local notes and code evidence', async ({ page }) => {
    const state = {}, events = await open(page, 'table-usage-audit', state);
    const original = await page.locator('#tuaTable tbody tr').evaluateAll(nodes => nodes.map(row => ({ name: row.dataset.n, fieldCount: Number(row.cells[3].textContent), view: false, rel: false, webhook: false })));
    state.schema = { success: true, generatedAt: '2026-09-09T19:00:00Z', count: original.length + 1, tables: [...original, { name: 'Review_New_Table', fieldCount: 3, view: true, rel: false, webhook: false }] };
    await page.locator('#tuaSearch').fill('Quote_Items'); await page.locator('.tua-note').fill('Keep the code evidence'); await page.locator('#tuaLive').click();
    await expect(page.locator('#stTotal')).toHaveText('164'); await expect(page.locator('.tua-note')).toHaveValue('Keep the code evidence'); await expect(page.locator('.tua-sig.code').last()).toHaveText('code');
    await page.locator('#tuaSearch').fill('Review_New_Table'); await expect(page.locator('.tua-live-new')).toHaveText('NEW'); await expect(page.locator('.tua-sig.view').last()).toHaveText('view'); clean(events);
});
for (const phase of ['read', 'write']) test('CSS monitoring: unavailable local storage on ' + phase + ' is explicit and leaves export available', async ({ page }) => {
    await page.addInitScript(phase => { const method = phase === 'read' ? 'getItem' : 'setItem'; Storage.prototype[method] = () => { throw new Error('Blocked storage fixture'); }; }, phase);
    const events = await open(page, 'table-usage-audit'); await page.locator('#tuaSearch').fill('Art_CustomerInfo_2024'); await page.locator('.tua-note').fill('Unsaved review');
    await expect(page.locator('.dash-error-banner')).toContainText('export your review'); await expect(page.locator('.tua-note')).toHaveValue('Unsaved review'); await expect(page.locator('#tuaExport')).toBeEnabled(); clean(events);
});
