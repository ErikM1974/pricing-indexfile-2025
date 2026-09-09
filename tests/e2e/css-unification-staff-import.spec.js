const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/staff-import-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
const columns = ['ID_Product', 'Description', 'Price_Unit_Piece', 'Price_Unit_Case', 'sts_LimitSize05'];
const records = [['29M_2XL', 'Example shirt, blue', '5.91', '4.91', ''], ['29M_3XL', 'Example shirt', '6.91', '5.91', '1']];
const sample = 'ID_Product,Description,Price_Unit_Piece,Price_Unit_Case,sts_LimitSize05\n29M_2XL,"Example shirt, blue",5.91,4.91,\n29M_3XL,Example shirt,6.91,5.91,1\n';
async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], downloads: [], lists: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    await page.route('**/*', route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(req.method())) { events.writes.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname === '/api/staff/sanmar-ftp/list') { events.lists.push(u.search); return route.fulfill({ status: state.status || 200, json: state.list === undefined ? fixture : state.list }); }
        if (u.pathname === '/api/staff/sanmar-ftp/download') { events.downloads.push(u.search); if (state.downloadOrigin === u.origin) return route.continue(); return route.fulfill({ contentType: 'text/csv', headers: { 'content-disposition': 'attachment; filename="Example.csv"' }, body: sample }); }
        if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Unmocked business read blocked' } });
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            if (state.missing && u.pathname.includes(state.missing)) return route.fulfill({ contentType: 'application/javascript', body: '' });
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.fallback();
    });
    await page.goto((state.downloadOrigin || '') + '/dashboards/' + name + '.html'); await page.evaluate(() => document.fonts.ready);
    if (name === 'sanmar-ftp-integration') await expect(page.locator('#sf-refresh')).toBeEnabled(); return events;
}
function clean(events) { expect(events.errors).toEqual([]); expect(events.writes).toEqual([]); }
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function convert(page, name = 'example.csv', buffer = Buffer.from(sample)) {
    await page.locator('#sw-file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await page.locator('#sw-convert').click(); await expect(page.locator('#sw-results')).toBeVisible(); await expect(page.locator('#sw-stat-out')).toHaveText('2');
}
for (const name of ['sanmar-ftp-integration', 'sanmar-shopworks-converter']) test('CSS import: ' + name + ' at four widths, keyboard and complete paper', async ({ page }) => {
    test.setTimeout(180000); const events = await open(page, name); if (name.includes('converter')) await convert(page);
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'import-' + name + '-' + width + '.png') }); }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#import-main')).toBeFocused();
    for (const region of await page.locator('.table-wrap').all()) { await region.focus(); await expect(region).toBeFocused(); await page.keyboard.press('End'); }
    if (name.includes('converter')) { await page.locator('#sw-file').focus(); await expect(page.locator('#sw-file')).toBeFocused(); }
    await page.setViewportSize({ width: 1440, height: 950 }); await page.emulateMedia({ media: 'print' });
    const blocks = await page.locator('h1,h2,h3,main p,main li,main th,main td,.sf-node,.sf-arrow,.sf-chip,.sw-file-name,.sw-stat').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    fs.writeFileSync(path.join(output, 'import-' + name + '-print.json'), JSON.stringify({ blocks })); await page.pdf({ path: path.join(output, 'import-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true }); clean(events);
});
test('CSS import: FTP master ordering, escaped labels and exact download parameters', async ({ page }) => {
    // Browser-managed attachment requests need a real local response, while all
    // business traffic remains mocked. This server serves only synthetic CSV.
    const downloads = [];
    const server = require('node:http').createServer((req, res) => {
        if (req.method !== 'GET' || !req.url.startsWith('/api/staff/sanmar-ftp/download?')) { res.writeHead(503); return res.end(); }
        downloads.push(new URL(req.url, 'http://127.0.0.1').search);
        res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="Example.csv"' }); res.end(sample);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
    const state = { downloadOrigin: 'http://127.0.0.1:' + server.address().port, list: { ...fixture, files: [...fixture.files].reverse() } }, events = await open(page, 'sanmar-ftp-integration', state);
    await expect(page.locator('tbody tr').first()).toContainText('Pricing master'); const wait = page.waitForEvent('download'); await page.locator('a[download]').first().click(); const download = await wait;
    expect(fs.readFileSync(await download.path(), 'utf8')).toBe(sample); expect(downloads).toHaveLength(1); expect(new URLSearchParams(downloads[0]).get('dir')).toBe(fixture.files[0].dir); expect(new URLSearchParams(downloads[0]).get('name')).toBe(fixture.files[0].name);
    state.list = { ...fixture, files: [{ ...fixture.files[1], name: '<b>Example & file.csv' }] }; await page.locator('#sf-refresh').click(); await expect(page.locator('.sf-file-name')).toHaveText('<b>Example & file.csv'); await expect(page.locator('.sf-file-name b')).toHaveCount(0); expect(events.lists).toContain('?fresh=1'); clean(events);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
for (const [title, status, list, text] of [
    ['expired session', 401, {}, 'Your session expired'], ['forbidden', 403, {}, 'Could not reach SanMar'], ['not configured', 503, { error: 'not_configured' }, 'Not set up yet'], ['unavailable', 503, {}, 'Could not reach SanMar'], ['malformed listing', 200, {}, 'incomplete file listing'], ['partial file row', 200, { files: [{}] }, 'incomplete file listing'],
]) test('CSS import: FTP ' + title + ' stays visible and recovers', async ({ page }) => {
    const state = { status, list }, events = await open(page, 'sanmar-ftp-integration', state); await expect(page.locator('main')).toContainText(text); await expect(page.locator('a[download]')).toHaveCount(0); await axe(page);
    state.status = 200; state.list = fixture; await page.locator('#sf-refresh').click(); await expect(page.locator('tbody tr')).toHaveCount(2); await expect(page.locator('#sf-config-note')).toBeHidden(); clean(events);
});
test('CSS import: empty successful FTP response is explicit', async ({ page }) => { const events = await open(page, 'sanmar-ftp-integration', { list: { ...fixture, files: [] } }); await expect(page.locator('#sf-files')).toContainText('No downloadable files'); clean(events); });
for (const format of ['csv', 'tsv', 'xlsx']) test('CSS import: ' + format + ' retains complete original part data in its download', async ({ page }) => {
    const events = await open(page, 'sanmar-shopworks-converter'); let buffer = Buffer.from(sample);
    if (format === 'tsv') buffer = Buffer.from([columns, ...records].map(row => row.join('\t')).join('\n'));
    if (format === 'xlsx') buffer = Buffer.from(await page.evaluate(({ columns, records }) => { const sheet = window.XLSX.utils.aoa_to_sheet([columns, ...records]), book = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(book, sheet, 'Parts'); return [...new Uint8Array(window.XLSX.write(book, { type: 'array', bookType: 'xlsx' }))]; }, { columns, records }));
    await convert(page, 'example.' + format, buffer); const wait = page.waitForEvent('download'); await page.locator('#sw-download').click(); const download = await wait;
    const rows = await page.evaluate(csv => window.Papa.parse(csv, { header: true, skipEmptyLines: true }).data, fs.readFileSync(await download.path(), 'utf8'));
    expect(rows).toHaveLength(2); expect(rows[0]).toMatchObject({ ID_Product: '29M_2X', Description: 'Size 2XL - Example shirt, blue', Price_Unit_Piece: '5.91', Price_Unit_Case: '4.91', sts_LimitSize05: '' }); expect(rows[1].ID_Product).toBe('29M_3XL');
    await page.locator('#sw-reset').click(); await expect(page.locator('#sw-results')).toBeHidden(); await expect(page.locator('#sw-convert')).toBeDisabled(); clean(events);
});
test('CSS import: malformed file stays visible and a corrected file succeeds', async ({ page }) => { const events = await open(page, 'sanmar-shopworks-converter'); await page.locator('#sw-file').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('foo,bar\none,two\n') }); await page.locator('#sw-convert').click(); await expect(page.locator('#sw-error')).toContainText('Unrecognized file'); await expect(page.locator('#sw-results')).toBeHidden(); await axe(page); await convert(page); await expect(page.locator('#sw-error')).toBeHidden(); clean(events); });
for (const [missing, filename] of [['sanmar-shopworks-parts.js', 'example.csv'], ['papaparse.min.js', 'example.csv'], ['xlsx.full.min.js', 'example.xlsx']]) test('CSS import: missing ' + missing + ' produces a visible error', async ({ page }) => { const events = await open(page, 'sanmar-shopworks-converter', { missing }); await page.locator('#sw-file').setInputFiles({ name: filename, mimeType: 'text/csv', buffer: Buffer.from(sample) }); await page.locator('#sw-convert').click(); await expect(page.locator('#sw-error')).toContainText('Converter tools did not load'); await expect(page.locator('#sw-results')).toBeHidden(); await expect(page.locator('#sw-file-name')).toContainText(filename); clean(events); });
