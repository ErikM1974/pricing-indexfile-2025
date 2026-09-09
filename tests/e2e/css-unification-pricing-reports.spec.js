const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const fixture = require('../fixtures/pricing-reports-review-data.json');
const original = require('../fixtures/pricing-reports-original-content.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
fs.mkdirSync(output, { recursive: true }); test.use({ reducedMotion: 'reduce' });
async function open(page, state = {}) {
    const events = { errors: [], writes: [], unmocked: [], missingAssets: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(() => { window.print = () => { window.__printRequested = true; }; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) { events.writes.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname === '/api/crm-session/me') {
            if (state.authDelay) await state.authDelay;
            return route.fulfill(state.anonymous ? { status: 401, json: { authenticated: false } } : { json: { authenticated: true, name: 'Review Staff', email: 'review@example.test', role: 'admin' } });
        }
        if (u.pathname.startsWith('/api/public/quote/')) {
            state.quoteReads = (state.quoteReads || 0) + 1;
            if (state.quoteDelay) await state.quoteDelay;
            return route.fulfill({ status: state.status || 200, json: state.quote === undefined ? fixture.quote : state.quote });
        }
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missingAssets.push(u.pathname); return route.fulfill({ status: 404 }); }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    await page.goto('/' + (state.file || 'pages/quote-audit.html') + (state.missingId ? '' : '?id=EMB-CSS-REVIEW'));
    await page.evaluate(() => document.fonts.ready); return events;
}
const clean = events => expect(events).toEqual({ errors: [], writes: [], unmocked: [], missingAssets: [] });
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function tableHashes(page) {
    return (await page.locator('table').evaluateAll(nodes => nodes.map(n => ({ head: [...n.querySelectorAll('thead th')].map(c => c.textContent.trim()), rows: [...n.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())), foot: [...n.querySelectorAll('tfoot tr')].map(r => [...r.cells].map(c => c.textContent.trim())) })))).map(t => hash(JSON.stringify(t)));
}
for (const record of original.pages) test('CSS pricing reports: ' + record.file + ' preserves every table at four widths', async ({ page }) => {
    const events = await open(page, { file: record.file }); if (record.file.includes('quote-audit')) await expect(page.locator('#audit-content')).toBeVisible();
    expect(await tableHashes(page)).toEqual(record.tableHashes);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        const cells = await page.locator('table tbody td').evaluateAll(nodes => nodes.filter(n => /^[-+$\d,.%]+$/.test(n.textContent.trim())).map(n => getComputedStyle(n).whiteSpace)); expect(cells.every(s => s === 'nowrap')).toBe(true);
        await page.screenshot({ path: path.join(output, 'pricing-reports-' + path.basename(record.file, '.html') + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#pricing-report-main')).toBeFocused();
    const scroll = page.locator('.table-scroll').first(); await scroll.focus(); await page.keyboard.press('ArrowRight'); await expect(scroll).toBeFocused();
    expect(await tableHashes(page)).toEqual(record.tableHashes); clean(events);
});
test('CSS pricing reports: numeric and text columns sort by keyboard without changing any rows', async ({ page }) => {
    const events = await open(page, { file: 'dashboards/reports/price-audit-report.html' });
    for (const table of await page.locator('table').all()) {
        const originalRows = await table.locator('tbody tr').allTextContents();
        const sortButtons = table.locator('thead th .report-sort'); const headers = table.locator('thead th');
        for (const index of [0, await headers.evaluateAll(nodes => nodes.findIndex(n => n.classList.contains('num')))].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)) {
            const button = sortButtons.nth(index); await button.focus(); await page.keyboard.press('Enter'); await expect(headers.nth(index)).toHaveAttribute('aria-sort', 'ascending');
            const values = await table.locator('tbody tr').evaluateAll((rows, col) => rows.map(r => r.cells[col]?.textContent.trim() || ''), index);
            const isNum = await headers.nth(index).evaluate(n => n.classList.contains('num'));
            const comparator = isNum ? (a, b) => (parseFloat(a.replace(/[^\d.-]/g, '')) || 0) - (parseFloat(b.replace(/[^\d.-]/g, '')) || 0) : (a, b) => a.localeCompare(b);
            expect(values).toEqual([...values].sort(comparator)); await page.keyboard.press('Space'); await expect(headers.nth(index)).toHaveAttribute('aria-sort', 'descending'); await expect(table.locator('[aria-sort]')).toHaveCount(1);
            expect((await table.locator('tbody tr').allTextContents()).sort()).toEqual([...originalRows].sort());
        }
    }
    clean(events);
});
test('CSS pricing reports: sticky navigation names the current section and all scroll regions', async ({ page }) => {
    const events = await open(page, { file: 'dashboards/pricing-analysis.html' }); await expect(page.locator('.pa-nav-link[aria-current="location"]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Five rules', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('link', { name: 'Five rules', exact: true })).toHaveAttribute('aria-current', 'location');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await expect(page.getByRole('link', { name: 'Limits', exact: true })).toHaveAttribute('aria-current', 'location');
    const labels = await page.locator('.pa-scroll').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))); expect(new Set(labels).size).toBe(33); clean(events);
});
test('CSS pricing reports: fresh staff session is hydrated before any audit read', async ({ page }) => {
    let release; const state = { authDelay: new Promise(resolve => { release = resolve; }) }, events = await open(page, state);
    await expect(page.locator('#loading-state')).toBeVisible(); expect(state.quoteReads || 0).toBe(0); release(); await expect(page.locator('#audit-content')).toBeVisible(); expect(state.quoteReads).toBe(1); clean(events);
});
test('CSS pricing reports: anonymous and missing-ID states do not load a quote', async ({ page }) => {
    const state = { anonymous: true }, events = await open(page, state); await expect(page.getByRole('heading', { name: 'Staff Login Required' })).toBeVisible(); expect(state.quoteReads || 0).toBe(0); await axe(page); clean(events);
});
test('CSS pricing reports: missing ID has a visible exit and no invalid retry', async ({ page }) => {
    const state = { missingId: true }, events = await open(page, state); await expect(page.locator('#error-title')).toHaveText('Missing Quote ID'); await expect(page.locator('#qa-retry-btn')).toBeHidden(); await expect(page.locator('#error-state a')).toHaveAttribute('href', '/dashboards/quote-management.html'); expect(state.quoteReads || 0).toBe(0); await axe(page); clean(events);
});
const changeAudit = update => { const quote = JSON.parse(JSON.stringify(fixture.quote)); const audit = JSON.parse(quote.session.PriceAuditJSON); update(audit); quote.session.PriceAuditJSON = JSON.stringify(audit); return quote; };
for (const [label, status, quote] of [
    ['failed', 503, {}], ['null response', 200, null], ['missing audit', 200, { session: {} }],
    ['broken audit JSON', 200, { session: { PriceAuditJSON: '{broken' } }],
    ['missing totals', 200, { session: { PriceAuditJSON: JSON.stringify({ flag: 'OK', products: [] }) } }],
    ['missing row values', 200, changeAudit(a => { delete a.products[0].ourUnit; })],
    ['invalid flags', 200, changeAudit(a => { a.flag = '<img src=x onerror=alert(1)>'; })],
]) test('CSS pricing reports: ' + label + ' remains visible and retry recovers the original comparison', async ({ page }) => {
    const state = { status, quote }, events = await open(page, state); await expect(page.locator('#error-state')).toBeVisible(); await expect(page.locator('#audit-content')).toBeHidden(); await axe(page);
    state.status = 200; state.quote = fixture.quote; await page.locator('#qa-retry-btn').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#audit-content')).toBeVisible(); await expect(page.locator('#error-state')).toBeHidden(); expect(await tableHashes(page)).toEqual(original.pages.find(p => p.file.includes('quote-audit')).tableHashes); clean(events);
});
test('CSS pricing reports: a valid empty per-product audit remains distinct from failure', async ({ page }) => {
    const events = await open(page, { quote: changeAudit(a => { a.products = []; }) }); await expect(page.locator('#audit-content')).toBeVisible(); await expect(page.locator('.empty-row')).toHaveText('No per-product audit data available'); await expect(page.locator('#summary-grid')).toContainText('$996.00'); await axe(page); clean(events);
});
test('CSS pricing reports: explicit zero audit totals override older session totals', async ({ page }) => {
    const events = await open(page, { quote: changeAudit(a => { a.swSubtotal = 0; a.ourSubtotal = 0; a.flag = 'OK'; a.products = []; }) }); await expect(page.locator('#audit-content')).toBeVisible(); expect(await page.locator('#summary-grid .summary-value').allTextContents()).toEqual(['$0.00', '$0.00', expect.stringContaining('+$0.00 (+0.0%)')]); clean(events);
});
test('CSS pricing reports: saved session totals still support audits without their own subtotals', async ({ page }) => {
    const events = await open(page, { quote: changeAudit(a => { delete a.swSubtotal; delete a.ourSubtotal; }) }); await expect(page.locator('#audit-content')).toBeVisible(); await expect(page.locator('#summary-grid')).toContainText('$996.00'); expect(await tableHashes(page)).toEqual(original.pages.find(p => p.file.includes('quote-audit')).tableHashes); clean(events);
});
test('CSS pricing reports: printing retains the complete comparison and notes', async ({ page }) => {
    const events = await open(page); await expect(page.locator('#audit-content')).toBeVisible(); await page.locator('#qa-print-btn').click(); expect(await page.evaluate(() => window.__printRequested)).toBe(true);
    await page.emulateMedia({ media: 'print' }); await expect(page.locator('.audit-actions')).toBeHidden(); await expect(page.locator('#audit-products-table')).toBeVisible(); await expect(page.locator('#import-notes-section')).toBeVisible(); expect(await tableHashes(page)).toEqual(original.pages.find(p => p.file.includes('quote-audit')).tableHashes); clean(events);
});
