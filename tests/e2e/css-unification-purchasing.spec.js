const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const { parse } = require('csv-parse/sync');
const fixture = require('../fixtures/purchasing-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], reads: [], unmocked: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push({ path: u.pathname, body: req.postDataJSON() });
            if (u.pathname === '/api/staff/sanmar-invoices/mark-imported') return route.fulfill({ status: state.markStatus || 200, json: { success: true, stamped: events.writes.at(-1).body.invoices.length, date: '2026-09-09' } });
            events.unmocked.push(u.pathname); return route.fulfill({ status: 503 });
        }
        let key;
        if (u.pathname === '/api/crm-proxy/purchasing-portal') key = 'portal';
        if (u.pathname === '/api/staff/sanmar-invoices/unpaid') key = 'unpaid';
        if (u.pathname === '/api/staff/sanmar-invoices/imports') key = 'imports';
        if (u.pathname === '/api/staff/shopworks-payables') key = 'shopworks';
        if (u.pathname === '/api/staff/sanmar-invoices/by-date') key = 'marketing';
        if (u.pathname.includes('/api/sanmar-invoices/by-po/')) key = 'invoice';
        if (key) {
            events.reads.push(u.pathname + u.search);
            const special = state.respond && state.respond(key, u, events);
            const status = special?.status || state[key + 'Status'] || 200;
            let json = special?.json ?? state[key] ?? fixture[key];
            if (key === 'invoice' && !special && state.invoice === undefined) json = fixture.invoice;
            if (key === 'marketing' && !special && state.marketing === undefined) json = { invoices: fixture.marketing.invoices.filter(i => i.invoiceDate >= u.searchParams.get('start') && i.invoiceDate <= u.searchParams.get('end')) };
            const delay = special?.delay || 0; if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            return route.fulfill({ status, json });
        }
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503, json: { error: 'Unmocked business request blocked' } }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            if (name === 'ae-mission-control' && path.extname(file) === '.js' && !/app-config|sanmar-invoice-viewer/.test(file)) return route.fulfill({ contentType: 'application/javascript', body: '' });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.fallback();
    });
    await page.goto('/dashboards/' + name + '.html'); await page.evaluate(() => document.fonts.ready); return events;
}
function clean(events, writes = 0) { expect(events.errors).toEqual([]); expect(events.unmocked).toEqual([]); expect(events.writes).toHaveLength(writes); }
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function upload(page) { await page.locator('#smp-sw-file').setInputFiles({ name: 'shopworks.csv', mimeType: 'text/csv', buffer: Buffer.from(fixture.shopworksCsv) }); await expect(page.locator('#smp-sw-status')).toContainText('ShopWorks paid status loaded'); }
async function paper(page, name, selector = 'h1,h2,h3,main p,main th,main td,.dash-stat-card,.pp-tile,.pp-updated,.smp-updated,.smiv-note,.smiv-inv-brand,.smiv-inv-no,.smiv-meta,.smiv-totals') {
    await page.setViewportSize({ width: 1440, height: 950 }); await page.emulateMedia({ media: 'print' });
    if (name === 'invoice-partial') { await expect(page.locator('#smiv-print-sheet th:visible')).toHaveCount(7); await expect(page.locator('#smiv-print-sheet td:visible')).toHaveCount(21); }
    const blocks = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    const values = await page.locator('main input,main select').evaluateAll(nodes => nodes.filter(n => n.checkVisibility() && n.value && !['checkbox', 'file'].includes(n.type)).map(n => n.tagName === 'SELECT' ? n.selectedOptions[0].textContent : n.type === 'date' ? n.value.slice(5, 7) + '/' + n.value.slice(8, 10) + '/' + n.value.slice(0, 4) : n.value));
    fs.writeFileSync(path.join(output, 'purchasing-' + name + '-print.json'), JSON.stringify({ blocks, values }));
    await page.pdf({ path: path.join(output, 'purchasing-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
}
for (const name of ['purchasing-portal', 'sanmar-payables']) test('CSS purchasing: ' + name + ' at four widths, keyboard and paper', async ({ page }) => {
    test.setTimeout(180000); const events = await open(page, name);
    if (name === 'sanmar-payables') { await expect(page.locator('#smp-stat-count')).toHaveText('7'); await upload(page); } else await expect(page.locator('#pp-stat-total')).toHaveText('5');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        expect(await page.locator('.dash-stat-value,.pp-stat-num').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).every(n => n.scrollWidth <= n.clientWidth + 1))).toBe(true);
        await page.screenshot({ path: path.join(output, 'purchasing-' + name + '-' + width + '.png') });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#purchasing-main')).toBeFocused();
    for (const region of await page.locator('.table-wrap:visible').all()) { await region.focus(); await expect(region).toBeFocused(); }
    await paper(page, name); clean(events);
});
test('CSS purchasing: request filters, finished work, escaped prose and refresh', async ({ page }) => {
    const state = {}, events = await open(page, 'purchasing-portal', state);
    await expect(page.locator('#pp-tbody tr')).toHaveCount(4); await expect(page.locator('#pp-tbody script')).toHaveCount(0);
    await page.locator('button.pp-tile[data-filter="sent"]').click(); await expect(page.locator('#pp-tbody tr')).toHaveCount(1); await expect(page.locator('#pp-tbody')).toContainText('Harbor Electric');
    await page.locator('button.pp-tile[data-filter="done"]').click(); await expect(page.locator('#pp-tbody')).toContainText('UnCruise'); await expect(page.locator('#pp-show-finished')).toBeChecked();
    await page.locator('button.pp-tile[data-filter=""]').click(); await page.locator('#pp-search').fill('142449'); await expect(page.locator('#pp-tbody tr')).toHaveCount(1);
    await expect(page.locator('.pp-req-link')).toHaveAttribute('href', 'https://www.jotform.com/submission/2');
    state.portal = { ...fixture.portal, truncated: 25, submissionCount: 30 }; await page.locator('#pp-refresh').click(); await expect(page.locator('#pp-trunc')).toContainText('25 older requests'); expect(events.reads).toContain('/api/crm-proxy/purchasing-portal?refresh=1'); clean(events);
});
for (const [label, status, portal] of [['session', 401, {}], ['malformed', 200, {}], ['partial row', 200, { ...fixture.portal, items: [{}] }]]) test('CSS purchasing: ' + label + ' failure clears old requests and recovers', async ({ page }) => {
    const state = {}, events = await open(page, 'purchasing-portal', state); await expect(page.locator('#pp-stat-total')).toHaveText('5');
    state.portalStatus = status; state.portal = portal; await page.locator('#pp-refresh').click(); await expect(page.locator('#pp-tbody')).toContainText('Not loaded'); await expect(page.locator('#pp-stat-total')).toHaveText('—'); await expect(page.locator('#pp-updated')).toContainText('Not loaded');
    state.portalStatus = 200; state.portal = fixture.portal; await page.locator('#pp-refresh').click(); await expect(page.locator('#pp-stat-total')).toHaveText('5'); clean(events);
});
for (const [label, status, unpaid] of [['session', 401, {}], ['malformed', 200, {}], ['invalid amount', 200, { invoices: [{ ...fixture.unpaid.invoices[0], totalAmount: null }] }]]) test('CSS purchasing: payables ' + label + ' stays unknown and recovers', async ({ page }) => {
    const state = { unpaidStatus: status, unpaid }, events = await open(page, 'sanmar-payables', state); await expect(page.locator('#smp-tbody')).toContainText('Not loaded'); await expect(page.locator('#smp-stat-net')).toHaveText('—'); await expect(page.locator('#smp-download')).toBeDisabled();
    state.unpaidStatus = 200; state.unpaid = fixture.unpaid; await page.locator('#smp-inv-retry').click(); await expect(page.locator('#smp-stat-net')).toHaveText('$2,456.77'); clean(events);
});
for (const status of [200, 503]) test('CSS purchasing: unavailable import log ' + status + ' cannot label or export unknown work', async ({ page }) => {
    const state = { importsStatus: status, imports: {} }, events = await open(page, 'sanmar-payables', state); await expect(page.locator('#smp-sw-status')).toContainText('Import log unavailable'); await expect(page.locator('#smp-stat-count')).toHaveText('7');
    await expect(page.locator('#smp-stat-notimported')).toHaveText('—'); await expect(page.locator('.smp-badge--todo')).toHaveCount(0); await expect(page.locator('#smp-download')).toBeDisabled(); await expect(page.locator('#smp-markimported')).toBeDisabled(); await axe(page);
    state.importsStatus = 200; state.imports = fixture.imports; await page.locator('#smp-sw-status button').click(); await expect(page.locator('#smp-sw-status')).toContainText('1 marked imported'); await expect(page.locator('#smp-download')).toBeEnabled(); clean(events);
});
test('CSS purchasing: CSV upload, paid/imported filters, original vendor export and mocked confirmation', async ({ page }) => {
    const events = await open(page, 'sanmar-payables'); await expect(page.locator('#smp-stat-count')).toHaveText('7'); await upload(page); await expect(page.locator('#smp-tbody tr')).toHaveCount(3);
    await page.locator('#smp-status-filter').selectOption('all'); await expect(page.locator('#smp-tbody tr')).toHaveCount(7); await expect(page.locator('.smp-badge--paid')).toHaveCount(1); await expect(page.locator('.smp-badge--imported')).toHaveCount(3);
    await page.locator('#smp-status-filter').selectOption('needimport'); const wait = page.waitForEvent('download'); await page.locator('#smp-download').click(); const downloaded = await wait;
    const rows = parse(fs.readFileSync(await downloaded.path(), 'utf8')); expect(rows).toHaveLength(4); expect(rows.slice(1).map(r => r[3])).toEqual(['1002', '1002', '1002']); expect(rows.slice(1).map(r => r[1])).toEqual(['CR-5670868', 'INV-162394919', 'INV-162391874']); expect(rows.slice(1).map(r => r[2])).toEqual(["'-$81.51 ", '$40.96 ', '$1,991.77 ']);
    page.once('dialog', d => d.dismiss()); await page.locator('#smp-markimported').click(); expect(events.writes).toHaveLength(0);
    page.once('dialog', d => d.accept()); await page.locator('#smp-markimported').click(); await expect(page.locator('#smp-tbody')).toContainText('No open payables match'); await expect(page.locator('#smp-markimported')).toBeDisabled(); expect(events.writes[0].body.invoices.map(i => i.amount)).toEqual([-81.51, 40.96, 1991.77]); clean(events, 1);
});
test('CSS purchasing: failed mark retains work and retry remains available', async ({ page }) => {
    const events = await open(page, 'sanmar-payables', { markStatus: 503 }); await expect(page.locator('#smp-markimported')).toBeEnabled(); page.once('dialog', d => d.accept()); await page.locator('#smp-markimported').click(); await expect(page.locator('.dash-error-banner')).toContainText('Could not mark imported'); await expect(page.locator('#smp-markimported')).toBeEnabled(); await expect(page.locator('#smp-tbody tr')).toHaveCount(6); clean(events, 1);
});
test('CSS purchasing: newest selected date range wins delayed responses', async ({ page }) => {
    let calls = 0; const state = { respond: key => key === 'unpaid' && ++calls === 1 ? { delay: 900, json: fixture.unpaid } : undefined }, events = await open(page, 'sanmar-payables', state);
    await expect.poll(() => calls).toBe(1); await page.locator('#smp-start').fill('2026-09-07'); await page.locator('#smp-start').dispatchEvent('change'); await expect(page.locator('#smp-stat-count')).toHaveText('3');
    await expect.poll(() => calls).toBeGreaterThan(1); await page.waitForTimeout(1000); await expect(page.locator('#smp-stat-count')).toHaveText('3'); await expect(page.locator('#smp-updated')).toContainText('9/7/2026'); clean(events);
});
test('CSS purchasing: marketing totals, keyboard tab, export and honest failed refresh', async ({ page }) => {
    const state = {}, events = await open(page, 'sanmar-payables', state); await page.locator('#smp-tab-invoices').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#smp-tab-marketing')).toBeFocused(); await expect(page.locator('#smp-mkt-spent')).toHaveText('$7,625'); await expect(page.locator('#smp-mkt-tbody tr')).toHaveCount(8);
    const wait = page.waitForEvent('download'); await page.locator('#smp-mkt-download').click(); const rows = parse(fs.readFileSync(await (await wait).path(), 'utf8')); expect(rows).toHaveLength(9); expect(rows.slice(1).every(r => r[3] === '2425')).toBe(true);
    await axe(page); await paper(page, 'marketing-fund'); await page.emulateMedia({ media: 'screen' }); state.marketing = {}; await page.locator('#smp-refresh').click(); await expect(page.locator('#smp-mkt-tbody')).toContainText('Not loaded'); await expect(page.locator('#smp-mkt-spent')).toHaveText('—'); await expect(page.locator('#smp-mkt-download')).toBeDisabled();
    delete state.marketing; await page.locator('#smp-mkt-retry').click(); await expect(page.locator('#smp-mkt-spent')).toHaveText('$7,625'); clean(events);
});
test('CSS purchasing: native invoice dialog contains keyboard focus and all amounts on narrow screens', async ({ page }) => {
    const events = await open(page, 'purchasing-portal'); const button = page.locator('.pp-invoice-btn').first(); await button.click(); await expect(page.locator('#smiv-modal')).toHaveJSProperty('open', true); await expect(page.locator('.smiv-grand')).toContainText('$424.70'); await expect(page.locator('.smiv-inv tbody tr')).toHaveCount(3);
    for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 950 }); await axe(page); expect(await page.locator('#smiv-modal').evaluate(n => n.getBoundingClientRect().right)).toBeLessThanOrEqual(width); await page.screenshot({ path: path.join(output, 'purchasing-invoice-' + width + '.png') }); }
    await page.locator('#smiv-print').focus(); await page.keyboard.press('Shift+Tab'); await expect(page.locator('#smiv-body .table-wrap')).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.locator('#smiv-print')).toBeFocused(); await page.keyboard.press('Escape'); await expect(button).toBeFocused(); await expect(page.locator('#smiv-modal')).toBeHidden(); clean(events);
});
test('CSS purchasing: partial invoice print retains failed PO and closes cleanly', async ({ page }) => {
    const events = await open(page, 'sanmar-payables', { respond: (key, u) => key === 'invoice' && u.pathname.endsWith('/MISSING') ? { status: 503, json: {} } : undefined });
    await page.evaluate(() => window.SanMarInvoiceViewer.open({ pos: ['882301', 'MISSING'], company: 'Example Customer' })); await expect(page.locator('#smiv-print')).toBeEnabled(); await expect(page.locator('.smiv-note.is-error')).toContainText('PO MISSING');
    await page.clock.install({ time: new Date(fixture.fixed) }); await page.clock.pauseAt(new Date(fixture.fixed)); await page.evaluate(() => { window.print = () => {}; }); await page.locator('#smiv-print').click();
    await expect(page.locator('#smiv-print-sheet .smiv-note.is-error')).toContainText('PO MISSING'); await paper(page, 'invoice-partial', '#smiv-print-sheet th,#smiv-print-sheet td,#smiv-print-sheet .smiv-note,#smiv-print-sheet .smiv-inv-brand,#smiv-print-sheet .smiv-inv-no,#smiv-print-sheet .smiv-meta,#smiv-print-sheet .smiv-totals');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await expect(page.locator('#smiv-print-sheet')).toHaveCount(0); clean(events);
});
for (const name of ['purchasing-portal', 'ae-mission-control']) test('CSS purchasing: ' + name + ' invoice ignores an older lookup and preserves viewer mode', async ({ page }) => {
    const events = await open(page, name, { respond: (key, u) => key === 'invoice' ? { delay: u.pathname.endsWith('/OLD') ? 900 : 0, json: { invoices: [{ ...fixture.invoice.invoices[0], invoiceNumber: u.pathname.endsWith('/OLD') ? 'OLD' : 'NEW' }] } } : undefined });
    await page.evaluate(() => { window.SanMarInvoiceViewer.open({ pos: ['OLD'] }); window.SanMarInvoiceViewer.open({ pos: ['NEW'] }); }); await expect(page.locator('.smiv-inv-no')).toContainText('NEW'); await page.waitForTimeout(1000); await expect(page.locator('.smiv-inv-no')).toContainText('NEW');
    expect(await page.locator('#smiv-modal').evaluate(n => n.tagName)).toBe('DIALOG'); await expect(page.locator('#smiv-modal')).toHaveJSProperty('open', true); await page.keyboard.press('Escape'); await expect(page.locator('#smiv-modal')).toBeHidden(); clean(events);
});
for (const [title, invoice] of [['empty', { invoices: [] }], ['malformed', {}], ['missing amount', { invoices: [{ invoiceNumber: 'BROKEN' }] }]]) test('CSS purchasing: invoice ' + title + ' stays explicit without printing a false balance', async ({ page }) => {
    const events = await open(page, 'purchasing-portal', { invoice }); await page.locator('.pp-invoice-btn').first().click(); await expect(page.locator('.smiv-note')).toContainText(title === 'empty' ? 'has not invoiced' : 'invoice lookup failed'); await expect(page.locator('.smiv-grand')).toHaveCount(0); await expect(page.locator('#smiv-print')).toBeDisabled(); await axe(page); clean(events);
});
test('CSS purchasing: optional ShopWorks sync failure remains visible and upload recovers', async ({ page }) => {
    const events = await open(page, 'sanmar-payables', { shopworksStatus: 503 }); await expect(page.locator('#purchasing-feed-status')).toContainText('sync unavailable'); await expect(page.locator('#smp-sw-status')).toContainText('1 marked imported'); await upload(page); await expect(page.locator('#purchasing-feed-status')).toContainText('ShopWorks export loaded'); await expect(page.locator('#purchasing-feed-status')).not.toContainText('unavailable'); clean(events);
});
test('CSS purchasing: invalid ShopWorks file is visible and a corrected upload succeeds', async ({ page }) => {
    const events = await open(page, 'sanmar-payables'); await page.locator('#smp-sw-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('wrong,headers\n1,2') }); await expect(page.locator('.dash-error-banner')).toContainText('no "InvoiceNumber" column'); await upload(page); await expect(page.locator('.dash-error-banner')).toBeHidden(); clean(events);
});
