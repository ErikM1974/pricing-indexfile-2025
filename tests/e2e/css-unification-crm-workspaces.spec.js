const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const fixture = require('../fixtures/crm-workspaces-review-data.json');
const original = require('../fixtures/crm-workspaces-original-content.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
const hash = s => crypto.createHash('sha256').update(s).digest('hex'), norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
fs.mkdirSync(output, { recursive: true }); test.use({ reducedMotion: 'reduce' }); test.describe.configure({ mode: 'parallel' });
async function open(page, tool, state = {}) {
    const { accounts, house, leads, scoreLeads } = fixture;
    const events = { errors: [], writes: [], unmocked: [], missingAssets: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(() => { localStorage.setItem('nwca-leads-view', 'list'); window.print = () => {}; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (p === '/api/csp-report') return route.fulfill({ status: 204 });
        // GET reconcile?autoAdd=true is also a write. No test may reach a real business service.
        if (!['GET', 'HEAD'].includes(req.method()) || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postDataJSON() });
            return route.fulfill((state.writeResponses && state.writeResponses[p]) || state.writeResponse || { status: 503, json: { error: 'Synthetic write failure' } });
        }
        if (state.respond && p.startsWith('/api/')) { const response = await state.respond(u); if (response) return route.fulfill(response); }
        if (state.responses && Object.hasOwn(state.responses, p)) return route.fulfill(state.responses[p]);
        if (p === '/api/crm-session/me') return route.fulfill({ json: { authenticated: true, name: 'Review Staff', email: 'review@example.test', permissions: ['admin'], role: 'admin' } });
        if (p === '/api/crm-proxy/house-accounts') return route.fulfill({ json: { accounts: house } });
        if (p === '/api/crm-proxy/house-accounts/stats') return route.fulfill({ json: { total: house.length, byAssignee: Object.fromEntries(house.map(a => [a.Assigned_To, 1])) } });
        if (p === '/api/crm-proxy/house-accounts/sales') return route.fulfill({ json: { totalRevenue: 27000, totalOrders: 33, accountsTracked: 6, byAssignee: Object.fromEntries(house.map((a, i) => [a.Assigned_To, { revenue: 2000 + i * 1000, orders: 3 + i }])) } });
        if (/^\/api\/crm-proxy\/(nika|taneisha)-accounts$/.test(p)) return route.fulfill({ json: { accounts } });
        if (p === '/api/caspio/daily-sales-by-rep/ytd') return route.fulfill({ json: fixture.archive });
        if (p === '/api/commissions/quarterly-report') return route.fulfill({ json: fixture.quarter });
        if (p === '/api/crm-proxy/assignment-history/shopworks-todo') return route.fulfill({ json: fixture.todo });
        if (p === '/api/crm-proxy/house-accounts/reconcile') return route.fulfill({ json: { missingCustomers: [], totalChecked: 6 } });
        if (p === '/api/crm-proxy/house-accounts/full-reconciliation') return route.fulfill({ status: 503, json: { error: 'Synthetic report failure' } });
        if (p.startsWith('/api/company-contacts/by-email/')) return route.fulfill({ json: { contact: null } });
        if (p === '/api/crm-proxy/lead-activity') return route.fulfill({ json: { activities: [] } });
        if (p === '/api/crm-proxy/form-submissions') {
            const cat = u.searchParams.get('category'); return route.fulfill({ json: { submissions: cat === 'spam' ? leads.slice(4) : cat === 'unqualified' ? leads.slice(3, 4) : leads.filter(l => !u.searchParams.has('statusNot') || l.Status !== 'Archived') } });
        }
        if (p === '/api/crm-proxy/lead-scorecard') {
            const since = u.searchParams.get('since') || '', until = u.searchParams.get('until') || '', rows = scoreLeads.filter(l => (!since || l.conversionDate >= since) && (!until || l.conversionDate <= until));
            const reps = [...new Set(rows.map(l => l.rep))].map(rep => { const a = rows.filter(l => l.rep === rep); return { rep, leadsClosed: a.length, attributedSales: a.reduce((n, l) => n + l.attributed, 0), lifetimeSales: a.reduce((n, l) => n + l.lifetime, 0) }; }).sort((a, b) => b.attributedSales - a.attributedSales);
            return route.fulfill({ json: { success: true, since, until, totals: { repsWithCloses: reps.length, leadsClosed: rows.length, attributedSales: rows.reduce((n, l) => n + l.attributed, 0) }, reps, leads: rows } });
        }
        if (p.startsWith('/api/')) { events.unmocked.push(p); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic endpoint' } }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missingAssets.push(p); return route.fulfill({ status: 404 }); }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    await page.goto('/dashboards/' + tool + '.html'); await page.evaluate(() => document.fonts.ready); return events;
}
const clean = (events, writes = 0) => { expect(events.errors).toEqual([]); expect(events.unmocked).toEqual([]); expect(events.missingAssets).toEqual([]); expect(events.writes).toHaveLength(writes); };
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
const ready = tool => tool === 'house-accounts' || tool.endsWith('-crm') ? '.account-card' : tool === 'leads' ? '#leads-tbody tr[data-id]' : tool === 'lead-scorecard' ? '#rep-tbody .sc-rep-name' : '#uq-tbody .uq-when';
async function tableHashes(page) { return (await page.locator('table').evaluateAll(nodes => nodes.map(n => ({ head: [...n.querySelectorAll('thead th')].map(c => c.textContent.trim()), rows: [...n.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())), foot: [...n.querySelectorAll('tfoot tr')].map(r => [...r.cells].map(c => c.textContent.trim())) })))).map(t => hash(JSON.stringify(t))); }
for (const record of original.pages) test('CSS CRM: ' + record.file + ' preserves original values at four widths', async ({ page }) => {
    const tool = path.basename(record.file, '.html'), events = await open(page, tool); await expect(page.locator(ready(tool)).first()).toBeVisible();
    if (tool.endsWith('-crm')) await expect(page.locator('#winback-bonus')).not.toHaveText('…');
    expect(await tableHashes(page)).toEqual(record.tableHashes); expect((await page.locator('.account-card').allTextContents()).map(t => hash(norm(t)))).toEqual(record.cardHashes);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.screenshot({ path: path.join(output, 'crm-' + tool + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#crm-main')).toBeFocused();
    const scroll = page.locator('.table-wrap:visible').first(); if (await scroll.count()) { await scroll.focus(); await page.keyboard.press('ArrowRight'); await expect(scroll).toBeFocused(); }
    expect(await tableHashes(page)).toEqual(record.tableHashes);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.dash-header h1')).toBeVisible(); expect(await tableHashes(page)).toEqual(record.tableHashes);
    if (tool.endsWith('-crm')) { await expect(page.locator('#header-total')).toContainText('6'); await expect(page.locator('#header-at-risk')).toContainText('1'); await axe(page); }
    await page.pdf({ path: path.join(output, 'crm-' + tool + '.pdf'), preferCSSPageSize: true, printBackground: true }); clean(events);
});
for (const tool of ['nika-crm', 'taneisha-crm']) {
    test('CSS CRM: ' + tool + ' filters tiers, risk and search without changing totals', async ({ page }) => {
        const events = await open(page, tool); await expect(page.locator('.account-card')).toHaveCount(6);
        const total = tool === 'nika-crm' ? '$30,250' : '$31,400'; await expect(page.locator('#ytd-total')).toHaveText(total);
        await page.locator('.tier-card.gold').focus(); await page.keyboard.press('Enter'); await expect(page.locator('.account-card')).toHaveCount(2); await expect(page.locator('.tier-card.gold')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#clear-filters-btn').click(); await page.locator('#header-at-risk').click(); await expect(page.locator('.account-card')).toHaveCount(1); await expect(page.locator('.account-card')).toContainText('Summit');
        await page.locator('#clear-filters-btn').click(); await page.locator('#filter-search').fill('Cedar'); await expect(page.locator('.account-card')).toHaveCount(1); await expect(page.locator('#ytd-total')).toHaveText(total); clean(events);
    });
    test('CSS CRM: ' + tool + ' native account dialog preserves all details and keyboard focus', async ({ page }) => {
        const events = await open(page, tool); const opener = page.locator('.account-open').first(); await opener.focus(); await page.keyboard.press('Enter');
        const dialog = page.locator('#account-detail-modal-overlay'); await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute('open', '');
        expect(hash(norm(await dialog.innerText()))).toBe(original.pages.find(r => r.file.endsWith(tool + '.html')).detailHash);
        for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await axe(page); expect(await dialog.evaluate(n => n.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: path.join(output, 'crm-' + tool + '-dialog-' + width + '.png'), fullPage: true }); }
        const close = page.locator('#account-detail-modal-close'); await close.focus(); await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog[open]'))).toBe(true);
        await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused(); clean(events);
    });
}
test('CSS CRM: house totals filter accounts and clear restores all six', async ({ page }) => {
    const events = await open(page, 'house-accounts'); await expect(page.locator('.account-card')).toHaveCount(6); await page.locator('.stat-card[data-assignee="Erik"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#filter-assignee')).toHaveValue('Erik'); await expect(page.locator('.account-card')).toHaveCount(1); await expect(page.locator('.account-card')).toContainText('Harbor');
    await page.locator('#clear-filters-btn').click(); await expect(page.locator('.account-card')).toHaveCount(6); clean(events);
});
test('CSS CRM: reconciliation assignment failure stays inside the named dialog', async ({ page }) => {
    const state = { responses: { '/api/crm-proxy/house-accounts/reconcile': { json: { missingCustomers: [{ ID_Customer: 99100, companyName: fixture.house[0].CompanyName, rep: 'House', orderCount: 2, totalSales: 1200, lastOrderDate: '2026-09-01', orders: [{ orderNumber: '12345006', amount: 1200, date: '2026-09-01' }] }], totalChecked: 6 } } }, writeResponses: { '/api/crm-proxy/sales-reps-2026/batch': { json: { records: [{ ID_Customer: 99100, CustomerServiceRep: 'House', Account_Tier: 'Gold' }] } } } };
    const events = await open(page, 'house-accounts', state); await page.locator('#reconcile-btn').click();
    const dialog = page.locator('#reconcile-modal-overlay'); await expect(dialog.locator('.assign-dropdown')).toBeVisible(); await axe(page);
    const disclosure = dialog.locator('.order-disclosure'); await disclosure.focus(); await page.keyboard.press('Enter'); await expect(disclosure).toHaveAttribute('aria-expanded', 'true'); await expect(dialog.locator('.order-details-row')).toContainText('#12345006'); await axe(page);
    await dialog.locator('.assign-dropdown').selectOption('Taneisha Clark'); await expect(dialog.locator('.crm-modal-error')).toBeVisible(); await expect(dialog).toBeVisible();
    expect(events.writes[1]).toMatchObject({ path: '/api/crm-proxy/taneisha-accounts', method: 'POST', body: { ID_Customer: 99100, CompanyName: fixture.house[0].CompanyName, Account_Tier: "Win Back '26 TANEISHA" } });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page.locator('#reconcile-btn')).toBeFocused(); clean(events, 2);
});
test('CSS CRM: house to-do and failed reconciliation remain keyboard reachable', async ({ page }) => {
    const events = await open(page, 'house-accounts'); await page.locator('#sw-todo-btn').click(); const todo = page.locator('#sw-todo-modal-overlay'); await expect(todo).toContainText('Synthetic Cedar'); await axe(page);
    await page.keyboard.press('Escape'); await expect(page.locator('#sw-todo-btn')).toBeFocused(); await page.locator('#gap-report-btn').click();
    const gap = page.locator('#gap-report-modal-overlay'); await expect(gap).toBeVisible(); await expect(gap).toContainText(/failed|unable/i); await expect(page.locator('#gap-report-refresh-btn')).toBeEnabled(); await axe(page);
    await page.keyboard.press('Escape'); await expect(page.locator('#gap-report-btn')).toBeFocused(); clean(events);
});
for (const [tool, api, malformed] of [['house-accounts', '/api/crm-proxy/house-accounts/sales', {}], ['nika-crm', '/api/crm-proxy/nika-accounts', { accounts: null }], ['taneisha-crm', '/api/crm-proxy/taneisha-accounts', { accounts: [null] }]]) test('CSS CRM: ' + tool + ' rejects incomplete data and Retry restores cards', async ({ page }) => {
    const state = { responses: { [api]: { json: malformed } } }, events = await open(page, tool, state); await expect(page.locator('#error-banner')).toBeVisible(); await expect(page.locator('.account-card')).toHaveCount(0); await axe(page);
    delete state.responses[api]; await page.locator('#error-retry').focus(); await page.keyboard.press('Enter'); await expect(page.locator('.account-card')).toHaveCount(6); await expect(page.locator('#error-banner')).not.toBeVisible(); clean(events);
});
test('CSS CRM: lead list, board, archived filters and CSV retain the original contract', async ({ page }) => {
    const events = await open(page, 'leads'); await expect(page.locator('#leads-tbody tr[data-id]')).toHaveCount(5);
    const pending = page.waitForEvent('download'); await page.locator('#btn-export').click(); const download = await pending, record = original.pages.find(r => r.file.endsWith('/leads.html'));
    expect(download.suggestedFilename()).toBe(record.csvFilename); expect(hash(fs.readFileSync(await download.path(), 'utf8'))).toBe(record.csvHash);
    await page.locator('#view-board').click(); await expect(page.locator('#leads-board')).toBeVisible(); await expect(page.locator('.ld-card')).toHaveCount(5); await page.setViewportSize({ width: 320, height: 900 }); await axe(page);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' }); await expect(page.locator('.dash-header h1')).toBeVisible(); await expect(page.locator('.ld-card:visible')).toHaveCount(5);
    await page.pdf({ path: path.join(output, 'crm-leads-board.pdf'), preferCSSPageSize: true, printBackground: true }); await page.emulateMedia({ media: 'screen' });
    await page.locator('#view-list').click(); await page.locator('#filter-archived').check(); await expect(page.locator('#leads-tbody tr[data-id]')).toHaveCount(6); clean(events);
});
test('CSS CRM: lead drawer and new-lead dialog trap focus and return it', async ({ page }) => {
    const events = await open(page, 'leads'); const opener = page.locator('#leads-tbody tr[data-id]').first(); await opener.focus(); await page.keyboard.press('Enter');
    const drawer = page.locator('#lead-drawer'); await expect(drawer).toBeVisible(); await expect(drawer).toHaveAttribute('aria-hidden', 'false'); await expect(drawer).toContainText('Synthetic Cedar'); await axe(page);
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await page.locator('#btn-new-lead').click(); await expect(page.locator('#newlead-modal')).toBeVisible(); await axe(page);
    await page.keyboard.press('Escape'); await expect(page.locator('#btn-new-lead')).toBeFocused(); clean(events);
});
for (const [name, response] of [['failed', { status: 503, json: {} }], ['incomplete', { json: {} }]]) test('CSS CRM: ' + name + ' lead data offers Retry in board and list', async ({ page }) => {
    const api = '/api/crm-proxy/form-submissions', state = { responses: { [api]: response } }, events = await open(page, 'leads', state);
    await expect(page.locator('.dash-error-banner')).toBeVisible(); await expect(page.locator('#stat-total')).toHaveText('—'); await page.locator('#view-board').click(); await expect(page.locator('#btn-board-retry')).toBeVisible();
    delete state.responses[api]; await page.locator('#btn-board-retry').click(); await expect(page.locator('.ld-card')).toHaveCount(5); await expect(page.locator('#stat-total')).toHaveText('5'); clean(events);
});
test('CSS CRM: scorecard date and rep filters preserve order and lifetime values', async ({ page }) => {
    const events = await open(page, 'lead-scorecard'); await expect(page.locator('#stat-sales')).toHaveText('$7,200'); await page.locator('#sc-rep-filter').selectOption('Nika Lao'); await expect(page.locator('#leads-tbody tr')).toHaveCount(1); await expect(page.locator('#leads-tbody')).toContainText('$3,600');
    await page.locator('#sc-since').fill('2026-09-03'); await page.locator('#sc-until').fill('2026-09-03'); await page.locator('#sc-apply').click(); await expect(page.locator('#stat-sales')).toHaveText('$1,200'); await expect(page.locator('#sc-rep-filter')).toHaveValue(''); await expect(page.locator('#leads-tbody')).toContainText('Summit');
    await page.locator('#sc-since').fill('2026-10-01'); await page.locator('#sc-until').fill('2026-10-31'); await page.locator('#sc-apply').click(); await expect(page.locator('#stat-sales')).toHaveText('$0'); await expect(page.locator('#leads-tbody')).toContainText('No closed leads'); clean(events);
});
for (const response of [{ status: 503, json: {} }, { json: { success: true, reps: [], leads: [] } }, { json: null }]) test('CSS CRM: incomplete scorecard clears old totals and retry recovers ' + JSON.stringify(response), async ({ page }) => {
    const state = { responses: {} }, events = await open(page, 'lead-scorecard', state); await expect(page.locator('#stat-sales')).toHaveText('$7,200'); state.responses['/api/crm-proxy/lead-scorecard'] = response;
    await page.locator('#sc-refresh').click(); await expect(page.locator('#sc-retry')).toBeVisible(); await expect(page.locator('#stat-sales')).toHaveText('—'); await expect(page.locator('#leads-tbody')).not.toContainText('$'); await axe(page);
    delete state.responses['/api/crm-proxy/lead-scorecard']; await page.locator('#sc-retry').click(); await expect(page.locator('#stat-sales')).toHaveText('$7,200'); clean(events);
});
test('CSS CRM: categorized lead tabs, search and rescan failure stay actionable', async ({ page }) => {
    const events = await open(page, 'unqualified-leads'); await expect(page.locator('#uq-tbody tr')).toHaveCount(2); await page.locator('#uq-tab-spam').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#uq-tab-unqualified')).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('#uq-tbody')).toContainText('Orchard');
    await page.locator('#uq-search').fill('missing'); await expect(page.locator('#uq-tbody')).toContainText('Nothing here'); await page.locator('#uq-search').fill(''); await page.locator('#btn-rescan').click(); await expect(page.locator('.dash-error-banner')).toContainText('Rescan failed'); await expect(page.locator('#btn-rescan')).toBeEnabled(); await axe(page); clean(events, 1);
});
test('CSS CRM: malformed categorized leads remain unavailable until Retry', async ({ page }) => {
    const api = '/api/crm-proxy/form-submissions', state = { responses: { [api]: { json: {} } } }, events = await open(page, 'unqualified-leads', state); await expect(page.locator('#uq-retry')).toBeVisible(); await expect(page.locator('#list-count')).toHaveText('Unavailable'); await expect(page.locator('#badge-spam')).toHaveText('?');
    await page.locator('#uq-search').fill('Cedar'); await expect(page.locator('#uq-retry')).toBeVisible(); await expect(page.locator('#list-count')).toHaveText('Unavailable'); await page.locator('#uq-search').fill('');
    delete state.responses[api]; await page.locator('#uq-retry').click(); await expect(page.locator('#uq-tbody tr')).toHaveCount(2); clean(events);
});

async function settleResponse(page, release, url, response) {
    const received = page.waitForResponse(url, { timeout: 10000 }); release(response); await (await received).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const outcome of ['success', 'failure']) test('CSS CRM: latest scorecard survives an older ' + outcome, async ({ page }) => {
    let release, calls = 0;
    const state = { respond: u => { if (u.pathname === '/api/crm-proxy/lead-scorecard' && ++calls === 1) return new Promise(resolve => { release = resolve; }); } };
    const events = await open(page, 'lead-scorecard', state); await expect.poll(() => !!release).toBe(true);
    await page.locator('#sc-since').fill('2026-10-01'); await page.locator('#sc-until').fill('2026-10-31'); await page.locator('#sc-apply').click(); await expect(page.locator('#stat-sales')).toHaveText('$0');
    await settleResponse(page, release, '**/api/crm-proxy/lead-scorecard*', outcome === 'failure' ? { status: 503, json: {} } : { json: { success: true, totals: { repsWithCloses: 0, leadsClosed: 0, attributedSales: 9999 }, reps: [], leads: [] } });
    await expect(page.locator('#stat-sales')).toHaveText('$0'); await expect(page.locator('#sc-retry')).toHaveCount(0); clean(events);
});

test('CSS CRM: category refresh ignores stale lists and badge prefetch', async ({ page }) => {
    const releases = {}, calls = {};
    const state = { respond: u => {
        if (u.pathname !== '/api/crm-proxy/form-submissions') return;
        const cat = u.searchParams.get('category'); calls[cat] = (calls[cat] || 0) + 1;
        if (calls[cat] === 1) return new Promise(resolve => { releases[cat] = resolve; });
    } };
    const events = await open(page, 'unqualified-leads', state); await expect.poll(() => Object.keys(releases).length).toBe(2);
    await page.locator('#uq-search').fill('River'); await expect(page.locator('#list-count')).toHaveText('Loading…'); await page.locator('#uq-search').fill('');
    await page.locator('#btn-refresh').click(); await expect(page.locator('#uq-tbody .uq-when')).toHaveCount(2);
    await settleResponse(page, releases.spam, '**/api/crm-proxy/form-submissions?category=spam*', { json: { submissions: [] } });
    await expect(page.locator('#badge-spam')).toHaveText('2'); await expect(page.locator('#uq-tbody .uq-when')).toHaveCount(2);
    await page.locator('#uq-tab-unqualified').click(); await expect(page.locator('#uq-tbody')).toContainText('Orchard');
    await settleResponse(page, releases.unqualified, '**/api/crm-proxy/form-submissions?category=unqualified*', { status: 503, json: {} });
    await expect(page.locator('#badge-unqualified')).toHaveText('1'); await expect(page.locator('#uq-tbody')).toContainText('Orchard'); clean(events);
});

test('CSS CRM: failed account retry cannot regain stale archive or quarterly totals', async ({ page }) => {
    const releases = {}, state = { responses: {}, respond: u => {
        if (['/api/caspio/daily-sales-by-rep/ytd', '/api/commissions/quarterly-report'].includes(u.pathname)) return new Promise(resolve => { releases[u.pathname] = resolve; });
    } };
    const events = await open(page, 'nika-crm', state); await expect(page.locator('.account-card')).toHaveCount(6); await expect.poll(() => Object.keys(releases).length).toBe(2);
    state.responses['/api/crm-proxy/nika-accounts'] = { status: 503, json: {} };
    await page.evaluate(() => window.crmController.retryLoad()); await expect(page.locator('#error-banner')).toBeVisible();
    await settleResponse(page, releases['/api/caspio/daily-sales-by-rep/ytd'], '**/api/caspio/daily-sales-by-rep/ytd*', { json: fixture.archive });
    await settleResponse(page, releases['/api/commissions/quarterly-report'], '**/api/commissions/quarterly-report', { json: fixture.quarter });
    await expect(page.locator('#ytd-total')).toHaveText('—'); await expect(page.locator('#winback-bonus')).toHaveText('—'); await expect(page.locator('.account-card')).toHaveCount(0); clean(events);
});

test('CSS CRM: populated gap report discloses orders at narrow widths', async ({ page }) => {
    const conflict = { ID_Customer: 99100, companyName: fixture.house[0].CompanyName, conflictType: 'outbound', owner: 'House', orderCount: 1, totalAmount: 1200, repNames: ['Nika Lao'], orders: [{ orderNumber: '12345006', amount: 1200, date: '2026-09-01', writer: 'Nika Lao' }] };
    const events = await open(page, 'house-accounts', { responses: { '/api/crm-proxy/house-accounts/full-reconciliation': { json: { generatedAt: fixture.fixed, ordersPeriod: '60 days', reps: [{ rep: 'Nika Lao', conflictCount: 1, totalAmount: 1200, outboundCount: 1, outboundAmount: 1200, inboundCount: 0, inboundAmount: 0, conflicts: [conflict] }] } } } });
    await page.locator('#gap-report-btn').click(); const dialog = page.locator('#gap-report-modal-overlay'); await expect(dialog.locator('.gap-conflict-row')).toBeVisible();
    const button = dialog.locator('.order-disclosure'); await button.focus(); await page.keyboard.press('Space'); await expect(button).toHaveAttribute('aria-expanded', 'true'); await expect(dialog.locator('.gap-orders-row')).toContainText('#12345006');
    for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await axe(page); expect(await dialog.evaluate(n => n.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: path.join(output, 'crm-gap-report-' + width + '.png'), fullPage: true }); }
    await page.keyboard.press('Escape'); await expect(page.locator('#gap-report-btn')).toBeFocused(); clean(events);
});
