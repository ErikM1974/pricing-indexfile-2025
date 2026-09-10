const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const fixture = require('../fixtures/lead-records-review-data.json');
const original = require('../fixtures/lead-records-original-content.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
const hash = s => crypto.createHash('sha256').update(s).digest('hex'), norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
fs.mkdirSync(output, { recursive: true }); test.use({ reducedMotion: 'reduce' }); test.describe.configure({ mode: 'parallel' });

async function open(page, tool, state = {}) {
    const { lead, forms, items, activities, shipments } = fixture;
    const events = { errors: [], writes: [], unmocked: [], missingAssets: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(() => { window.print = () => {}; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (p === '/api/csp-report') return route.fulfill({ status: 204 });
        // Every API is mocked, including preview POSTs and mutating GET requests.
        if (!['GET', 'HEAD'].includes(req.method()) || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postDataJSON() });
            return route.fulfill(state.writeResponse || { status: 503, json: { error: 'Synthetic write failure' } });
        }
        if (state.respond && p.startsWith('/api/')) { const response = await state.respond(u); if (response) return route.fulfill(response); }
        if (state.responses && Object.hasOwn(state.responses, p)) return route.fulfill(state.responses[p]);
        if (p === '/api/crm-session/me') return route.fulfill({ json: { authenticated: true, name: 'Review Staff', email: 'review@example.test', permissions: ['admin'], role: 'admin' } });
        if (p === '/api/crm-proxy/form-submissions') return route.fulfill({ json: { submissions: forms } });
        if (p === '/api/crm-proxy/form-submissions/items/open') return route.fulfill({ json: { items } });
        if (p.startsWith('/api/crm-proxy/form-submissions/')) {
            const id = decodeURIComponent(p.split('/').pop()), submission = id === lead.Submission_ID ? lead : forms.find(f => f.Submission_ID === id);
            return route.fulfill({ json: { submission, items: submission?.Form_ID === 'sample-checkout' ? items : [] } });
        }
        if (p === '/api/crm-proxy/lead-activity') return route.fulfill({ json: { activities } });
        if (p.startsWith('/api/company-contacts/by-email/')) return route.fulfill({ json: { contact: null, contacts: [] } });
        if (p === '/api/quote_sessions') return route.fulfill({ json: [] });
        if (p === '/api/crm-proxy/marketing-shipments') return route.fulfill({ json: { shipments: shipments.filter(s => s.Status === u.searchParams.get('status')) } });
        if (p.startsWith('/api/')) { events.unmocked.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic endpoint' } }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const f = path.resolve(root, '.' + p);
            if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { events.missingAssets.push(p); return route.fulfill({ status: 404 }); }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        return route.continue();
    });
    await page.goto('/dashboards/' + tool + '.html' + (tool === 'lead' ? '#CSS-DETAIL-1' : '')); await page.evaluate(() => document.fonts.ready); return events;
}
const clean = (e, writes = 0) => { expect(e.errors).toEqual([]); expect(e.unmocked).toEqual([]); expect(e.missingAssets).toEqual([]); expect(e.writes).toHaveLength(writes); };
const axe = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
async function ready(page, tool) {
    if (tool === 'lead') await expect(page.locator('#lw-timeline')).toContainText('Synthetic review note');
    else if (tool === 'form-submissions') await expect(page.locator('#submissionsRoot tbody tr')).toHaveCount(6);
    else await expect(page.locator('#ms-count')).toHaveText('2 requested');
}
async function tableHashes(page) { return (await page.locator('table').evaluateAll(nodes => nodes.map(n => ({ head: [...n.querySelectorAll('thead th')].map(c => c.textContent.trim()), rows: [...n.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim())), foot: [...n.querySelectorAll('tfoot tr')].map(r => [...r.cells].map(c => c.textContent.trim())) })))).map(t => hash(JSON.stringify(t))); }

for (const record of original.pages) test('CSS records: ' + record.file + ' preserves original data at four widths and print', async ({ page }) => {
    const tool = path.basename(record.file, '.html'), events = await open(page, tool); await ready(page, tool);
    expect(await tableHashes(page)).toEqual(record.tableHashes);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.screenshot({ path: path.join(output, 'records-' + tool + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#main-content')).toBeFocused();
    const scroll = page.locator('.table-wrap:visible').first(); if (await scroll.count()) { await scroll.focus(); await page.keyboard.press('ArrowRight'); await expect(scroll).toBeFocused(); }
    expect(await tableHashes(page)).toEqual(record.tableHashes);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' }); await expect(page.locator('.dash-header h1')).toBeVisible();
    if (tool === 'lead') { await expect(page.locator('#lw-status')).toBeVisible(); await expect(page.locator('#lw-rep')).toBeVisible(); }
    await page.pdf({ path: path.join(output, 'records-' + tool + '.pdf'), preferCSSPageSize: true, printBackground: true }); clean(events);
});

for (const tool of ['lead', 'form-submissions', 'marketing-shipments']) test('CSS records: ' + tool + ' rejects malformed reload and retries without stale records', async ({ page }) => {
    const state = { responses: {} }, events = await open(page, tool, state); await ready(page, tool);
    const endpoint = tool === 'lead' ? '/api/crm-proxy/form-submissions/CSS-DETAIL-1' : tool === 'form-submissions' ? '/api/crm-proxy/form-submissions' : '/api/crm-proxy/marketing-shipments';
    state.responses[endpoint] = { json: {} };
    if (tool === 'lead') {
        await page.locator('#lw-refresh').click(); await expect(page.locator('#lw-load-retry')).toBeVisible(); await expect(page.locator('.lw-grid')).toBeHidden();
    } else if (tool === 'form-submissions') {
        await page.locator('#tab-samples').click(); await page.locator('#inboxRefresh').click(); await expect(page.locator('#samplesRoot')).toContainText('Records unavailable');
        await page.locator('#tab-submissions').click(); await page.locator('[data-form="artwork-request"]').click(); await page.locator('#searchBox').fill('Cedar');
        await expect(page.locator('#submissionsRoot')).toContainText('Records unavailable'); await expect(page.locator('#statOut')).toHaveText('—');
        await page.locator('[data-form=""]').click(); await page.locator('#searchBox').fill('');
    } else {
        await page.locator('#btn-refresh').click(); await expect(page.locator('#ms-count')).toHaveText('Unavailable'); await expect(page.locator('#ms-tbody')).not.toContainText('CSS-SHIP-1');
    }
    delete state.responses[endpoint];
    await page.locator(tool === 'lead' ? '#lw-load-retry' : tool === 'form-submissions' ? '#submissionsRoot .inbox-retry' : '#btn-refresh').click(); await ready(page, tool); clean(events);
});

test('CSS records: Inbox tabs and filters preserve counts and sample values', async ({ page }) => {
    const events = await open(page, 'form-submissions'); await ready(page, 'form-submissions');
    await page.locator('[data-form="artwork-request"]').click(); await expect(page.locator('#submissionsRoot tbody tr')).toHaveCount(1); await expect(page.locator('#submissionsRoot [data-view-id="CSS-INBOX-2"]')).toBeVisible();
    await page.locator('[data-form=""]').click(); await page.locator('#statusFilter').selectOption('New'); await expect(page.locator('#submissionsRoot tbody tr')).toHaveCount(3);
    await page.locator('#tab-submissions').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#tab-samples')).toBeFocused(); await expect(page.locator('#viewSamples')).toBeVisible();
    await expect(page.locator('#samplesRoot')).toContainText('12.75'); await expect(page.locator('#statOut')).toHaveText('1'); clean(events);
});

test('CSS records: Inbox native detail retains original content, traps focus, prints and restores focus', async ({ page }) => {
    const events = await open(page, 'form-submissions'); await ready(page, 'form-submissions');
    const button = page.locator('#submissionsRoot [data-view-id="CSS-INBOX-1"]'); await button.click();
    await expect(page.locator('#detailBody')).toContainText('Sample Items'); expect(norm(await page.locator('#detailOverlay').innerText())).toBe(norm(original.pages.find(p => p.file.endsWith('/form-submissions.html')).detail));
    await expect(page.locator('#detailOverlay')).toHaveJSProperty('open', true); await axe(page);
    for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#detailOverlay'))).toBe(true); }
    await page.setViewportSize({ width: 320, height: 900 }); await axe(page); await page.screenshot({ path: path.join(output, 'records-inbox-dialog-320.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' }); await expect(page.locator('#detailTitle')).toBeVisible(); await expect(page.locator('#detailStatus')).toBeVisible(); await expect(page.locator('.dash-shell')).toBeHidden();
    expect(await page.locator('#detailOverlay').evaluate(el => getComputedStyle(el, '::backdrop').display)).toBe('none');
    await page.pdf({ path: path.join(output, 'records-inbox-dialog.pdf'), preferCSSPageSize: true, printBackground: true }); await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape'); await expect(page.locator('#detailOverlay')).toBeHidden(); await expect(button).toBeFocused(); clean(events);
});

test('CSS records: sample return failure preserves the original charge and checkout', async ({ page }) => {
    const events = await open(page, 'form-submissions'); await ready(page, 'form-submissions');
    await page.locator('#submissionsRoot [data-view-id="CSS-INBOX-1"]').click(); await expect(page.locator('#detailBody')).toContainText('Sample Items');
    page.on('dialog', dialog => dialog.accept('Synthetic return review'));
    await page.getByRole('button', { name: /Mark returned/i }).click();
    await expect(page.locator('#detailBody')).toContainText('NOT updated'); await expect(page.locator('#detailBody')).toContainText('12.75');
    expect(events.writes[0]).toMatchObject({ method: 'PUT', path: '/api/crm-proxy/form-submissions/items/98001', body: { Item_Status: 'Returned', Condition: 'Synthetic return review', Checked_In_By: 'review@example.test' } }); clean(events, 1);
});

test('CSS records: shipment status tabs preserve original tracking and failed actions do not change status', async ({ page }) => {
    const events = await open(page, 'marketing-shipments'); await ready(page, 'marketing-shipments');
    await page.locator('.ms-pack').first().click(); await expect(page.locator('.dash-error-banner')).toContainText('Could not update'); await expect(page.locator('#ms-count')).toHaveText('2 requested');
    expect(events.writes[0].body).toEqual({ Status: 'Packed', Updated_By: 'review@example.test' });
    await page.locator('.ms-ship').first().click(); await page.getByLabel('Shipping carrier').selectOption('UPS'); await page.getByLabel('Tracking number').fill('REVIEW-ONLY'); await axe(page);
    await page.locator('.ms-ship-go').click(); await expect(page.locator('.dash-error-banner')).toContainText('Could not update'); expect(events.writes[1].body).toEqual({ Status: 'Shipped', Carrier: 'UPS', Tracking_Number: 'REVIEW-ONLY', Updated_By: 'review@example.test' });
    await page.locator('.ms-tab[data-status="Shipped"]').click(); await expect(page.locator('#ms-count')).toHaveText('2 shipped'); await expect(page.locator('.ms-track').first()).toHaveText('UPS REVIEW-TRACK-0');
    await page.locator('.ms-tab[data-status="Packed"]').click(); await expect(page.locator('#ms-count')).toHaveText('2 packed'); await expect(page.locator('.ms-pack')).toHaveCount(0); clean(events, 2);
});

test('CSS records: lead activity failure remains retryable', async ({ page }) => {
    const endpoint = '/api/crm-proxy/lead-activity', state = { responses: { [endpoint]: { json: {} } } }, events = await open(page, 'lead', state);
    await expect(page.locator('#lw-activity-retry')).toBeVisible(); await expect(page.locator('#lw-timeline')).toContainText('Activity unavailable');
    delete state.responses[endpoint]; await page.locator('#lw-activity-retry').click(); await ready(page, 'lead'); await expect(page.locator('.lw-value-big')).toHaveText('$1,200.00'); clean(events);
});

test('CSS records: late lead response cannot replace a newer failed reload', async ({ page }) => {
    let release, started = false, calls = 0;
    const state = { respond: async u => { if (u.pathname !== '/api/crm-proxy/form-submissions/CSS-DETAIL-1') return; calls++; if (calls === 2) { started = true; await new Promise(resolve => { release = resolve; }); return { json: { submission: fixture.lead, items: [] } }; } if (calls === 3) return { status: 503, json: { error: 'Latest read failed' } }; } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.locator('#lw-refresh').click(); await expect.poll(() => started).toBe(true);
    await page.locator('#lw-refresh').click(); await expect(page.locator('#lw-load-retry')).toBeVisible(); release();
    await expect(page.locator('.lw-grid')).toBeHidden(); await page.locator('#lw-load-retry').click(); await ready(page, 'lead'); clean(events);
});
