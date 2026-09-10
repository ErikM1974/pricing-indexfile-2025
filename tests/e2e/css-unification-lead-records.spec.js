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
            return route.fulfill((state.writeRespond && await state.writeRespond(events.writes.at(-1))) || state.writeResponse || { status: 503, json: { error: 'Synthetic write failure' } });
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

test('CSS records: late inbox list cannot overwrite a newer failed refresh', async ({ page }) => {
    let release, started = false, calls = 0;
    const endpoint = '/api/crm-proxy/form-submissions';
    const state = { respond: async u => { if (u.pathname !== endpoint) return; calls++; if (calls === 2) { started = true; await new Promise(resolve => { release = resolve; }); return { json: { submissions: fixture.forms } }; } if (calls === 3) return { status: 503, json: { error: 'Latest inbox read failed' } }; } };
    const events = await open(page, 'form-submissions', state); await ready(page, 'form-submissions'); await page.locator('#tab-samples').click();
    await page.locator('#inboxRefresh').click(); await expect.poll(() => started).toBe(true); await page.locator('#inboxRefresh').click(); await expect(page.locator('#samplesRoot')).toContainText('Records unavailable');
    const old = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.status() === 200); release(); await (await old).finished();
    await expect(page.locator('#statOut')).toHaveText('—'); await expect(page.locator('#samplesRoot')).toContainText('Records unavailable');
    await page.locator('#samplesRoot .inbox-retry').click(); await expect(page.locator('#samplesRoot')).toContainText('12.75'); clean(events);
});

test('CSS records: late detail response cannot replace a newly opened submission', async ({ page }) => {
    let release, started = false;
    const endpoint = '/api/crm-proxy/form-submissions/CSS-INBOX-1';
    const state = { respond: async u => { if (u.pathname === endpoint) { started = true; await new Promise(resolve => { release = resolve; }); return { json: { submission: fixture.forms[0], items: fixture.items } }; } } };
    const events = await open(page, 'form-submissions', state); await ready(page, 'form-submissions');
    await page.locator('#submissionsRoot [data-view-id="CSS-INBOX-1"]').click(); await expect.poll(() => started).toBe(true); await page.keyboard.press('Escape');
    await page.locator('#submissionsRoot [data-view-id="CSS-INBOX-2"]').click(); await expect(page.locator('#detailTitle')).toContainText('CSS-INBOX-2');
    const old = page.waitForResponse(r => new URL(r.url()).pathname === endpoint); release(); await (await old).finished();
    await expect(page.locator('#detailTitle')).toContainText('CSS-INBOX-2'); await expect(page.locator('#detailBody')).not.toContainText('Synthetic sample tee'); clean(events);
});

test('CSS records: late shipment failure cannot replace a different status queue', async ({ page }) => {
    let release;
    const state = { respond: async u => { if (u.pathname === '/api/crm-proxy/marketing-shipments' && u.searchParams.get('status') === 'Requested') { await new Promise(resolve => { release = resolve; }); return { status: 503, json: { error: 'Old queue failure' } }; } } };
    const events = await open(page, 'marketing-shipments', state); await expect.poll(() => typeof release).toBe('function');
    await page.locator('.ms-tab[data-status="Packed"]').click(); await expect(page.locator('#ms-count')).toHaveText('2 packed');
    const old = page.waitForResponse(r => r.status() === 503); release(); await (await old).finished();
    await expect(page.locator('#ms-count')).toHaveText('2 packed'); await expect(page.locator('.dash-error-banner')).toBeHidden(); clean(events);
});

test('CSS records: lead kit validates fields and keeps the exact request after a mocked failure', async ({ page }) => {
    const state = { responses: { '/api/crm-proxy/marketing-shipments/items': { json: { items: [{ Item_Code: 'KIT', Label: 'Synthetic apparel kit' }] } } } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.locator('#lw-kit').click(); await expect(page.locator('.lw-kit-cb')).toBeVisible();
    await page.locator('#lw-kit-send').click(); await expect(page.locator('#lw-kit-status')).toHaveText('Pick at least one item.'); expect(events.writes).toHaveLength(0);
    await page.locator('.lw-kit-cb').check(); await page.getByLabel('Quantity of Synthetic apparel kit').fill('2');
    await page.locator('#lw-kit-send').click(); await expect(page.locator('#lw-kit-status')).toContainText('required'); expect(events.writes).toHaveLength(0);
    await page.locator('#lw-kit-addr1').fill('123 Example Lane'); await page.locator('#lw-kit-city').fill('Sample City'); await page.locator('#lw-kit-state').fill('WA'); await page.locator('#lw-kit-zip').fill('98001');
    await page.setViewportSize({ width: 320, height: 900 }); await axe(page); await page.screenshot({ path: path.join(output, 'records-kit-320.png'), fullPage: true });
    await page.locator('#lw-kit-send').click(); await expect(page.locator('#lw-kit-status')).toContainText('Synthetic write failure');
    expect(events.writes[0]).toMatchObject({ method: 'POST', path: '/api/crm-proxy/marketing-shipments', body: { submissionId: 'CSS-DETAIL-1', requestedBy: 'review@example.test', salesRep: 'Taneisha Clark', recipientName: fixture.lead.Contact_Name, company: fixture.lead.Company, address1: '123 Example Lane', city: 'Sample City', state: 'WA', zip: '98001', items: [{ code: 'KIT', label: 'Synthetic apparel kit', qty: 2 }] } });
    await page.keyboard.press('Escape'); await expect(page.locator('#lw-kit')).toBeFocused(); clean(events, 1);
});

test('CSS records: closing a kit while its catalog loads ignores the late response', async ({ page }) => {
    let release;
    const endpoint = '/api/crm-proxy/marketing-shipments/items', state = { respond: async u => { if (u.pathname === endpoint) { await new Promise(resolve => { release = resolve; }); return { json: { items: [{ Item_Code: 'KIT', Label: 'Synthetic kit' }] } }; } } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.locator('#lw-kit').click(); await expect.poll(() => typeof release).toBe('function');
    await page.keyboard.press('Escape'); const old = page.waitForResponse(r => new URL(r.url()).pathname === endpoint); release(); await (await old).finished();
    await expect(page.locator('#lw-kit-overlay')).toHaveCount(0); await expect(page.locator('#lw-kit')).toBeFocused(); clean(events);
});

test('CSS records: outreach preview and failed send keep content and payload without sending email', async ({ page }) => {
    const state = { writeRespond: write => write.body.preview ? { json: { subject: 'Synthetic introduction', bodyHtml: '<p>Hello Example Buyer 1. Synthetic preview only.</p>' } } : null };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.getByRole('button', { name: 'Introduction', exact: true }).click();
    await expect(page.locator('.lw-outreach-subject')).toHaveText('Synthetic introduction'); await expect(page.locator('.lw-outreach-body')).toContainText('Synthetic preview only');
    await page.setViewportSize({ width: 320, height: 900 }); await axe(page); await page.locator('#lw-outreach-send').click();
    await expect(page.locator('.dash-error-banner')).toContainText('Synthetic write failure'); await expect(page.locator('#lw-outreach-note')).toContainText('Synthetic write failure'); await expect(page.locator('#lw-outreach-send')).toBeEnabled();
    expect(events.writes[0].body).toMatchObject({ preview: true, submissionId: 'CSS-DETAIL-1', lead: { email: fixture.lead.Email, company: fixture.lead.Company, contactName: fixture.lead.Contact_Name } });
    expect(events.writes[1].body).toEqual({ ...events.writes[0].body, preview: false }); await page.locator('#lw-outreach-cancel').click(); await expect(page.locator('.lw-outreach-card')).toHaveCount(0); clean(events, 2);
});

test('CSS records: sample and quote handoffs preserve customer data in browser storage', async ({ page }) => {
    await page.addInitScript(() => { window.reviewOpened = []; window.open = (...args) => { window.reviewOpened.push(args); return null; }; });
    const events = await open(page, 'lead', { writeResponse: { json: {} } }); await ready(page, 'lead'); await page.locator('#lw-samples').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nwca-sample-prefill')))).toMatchObject({ submissionId: 'CSS-DETAIL-1', firstName: 'Example', lastName: 'Buyer 1', email: fixture.lead.Email, company: fixture.lead.Company, staffEmail: 'review@example.test' });
    expect(await page.evaluate(() => window.reviewOpened[0])).toEqual(['/catalog?topSellers=1&from=leadsample', '_blank', 'noopener']);
    for (const [label, file] of [['Embroidery', 'embroidery'], ['Screen Print', 'screenprint'], ['DTG', 'dtg'], ['DTF', 'dtf']]) {
        await page.locator('.lw-method-grid').getByRole('button', { name: label, exact: true }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nwca-method-switch')))).toMatchObject({ from: 'lead', products: [], customer: { name: fixture.lead.Contact_Name, email: fixture.lead.Email, company: fixture.lead.Company, phone: fixture.lead.Phone } });
        expect(await page.evaluate(() => window.reviewOpened.at(-1))).toEqual(['/quote-builders/' + file + '-quote-builder.html?from=methodswitch', '_blank', 'noopener']);
    }
    clean(events, 5);
});

test('CSS records: original shared art form loads with lead prefill and remains usable at four widths', async ({ page }) => {
    const state = { responses: { '/api/service-codes': { json: [{ ServiceCode: 'GRT-50', DisplayName: 'Synthetic art fee', SellPrice: 50, IsActive: true }] } } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.locator('#lw-art-send').click();
    await expect(page.locator('.dash-shell')).toHaveJSProperty('inert', true);
    await expect(page.locator('#gsf-company')).toHaveValue(fixture.lead.Company); await expect(page.locator('#gsf-contact-email')).toHaveValue(fixture.lead.Email); await expect(page.locator('#gsf-contact-name')).toHaveValue(fixture.lead.Contact_Name);
    await expect(page.locator('#gsf-due-date')).toHaveValue('2026-09-20'); await expect(page.locator('#gsf-notes')).toHaveValue(/CSS-DETAIL-1/); await expect(page.locator('#gsf-prelim option[value="50"]')).toHaveCount(1);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); await axe(page); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: path.join(output, 'records-art-form-' + width + '.png') });
    }
    await page.locator('#lw-art-modal-close').focus(); await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#lw-art-modal'))).toBe(true);
    await page.keyboard.press('Escape'); await expect(page.locator('#lw-art-modal')).toBeHidden(); await expect(page.locator('.dash-shell')).toHaveJSProperty('inert', false); await expect(page.locator('#lw-art-send')).toBeFocused(); clean(events);
});

test('CSS records: uncertain outreach timeout warns beside the action before another attempt', async ({ page }) => {
    const state = { writeRespond: write => write.body.preview ? { json: { subject: 'Synthetic introduction', bodyHtml: '<p>Synthetic preview.</p>' } } : { status: 503, json: { error: 'request timed out' } } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await page.getByRole('button', { name: 'Introduction', exact: true }).click(); await page.locator('#lw-outreach-send').click();
    await expect(page.locator('#lw-outreach-note')).toContainText('MAY have gone out'); await expect(page.locator('#lw-outreach-note')).toContainText('check the timeline before resending'); await expect(page.locator('#lw-outreach-note')).not.toContainText('NOT sent'); clean(events, 2);
});

test('CSS records: populated customer, linked quote and order history remain complete on screen and paper', async ({ page }) => {
    const lead = { ...fixture.lead, Matched_ID_Customer: '9001', Linked_Quote_ID: 'EMB-REVIEW-1', Art_Request_ID: '9901' };
    const orders = [{ date_OrderPlaced: '2026-09-01T18:00:00Z', ID_Order: 'REVIEW-100', cnCur_TotalInvoice: 1200, sts_Invoiced: 1 }, { date_OrderPlaced: '2026-08-15T18:00:00Z', ID_Order: 'REVIEW-101', cnCur_TotalInvoice: 875.5, sts_Shipped: 1 }];
    const state = { responses: {
        '/api/crm-proxy/form-submissions/CSS-DETAIL-1': { json: { submission: lead, items: [] } },
        '/api/company-contacts/by-customer/9001': { json: { contacts: [{ CustomerCompanyName: fixture.lead.Company, CustomerCustomerServiceRep: 'Taneisha Clark', Account_Tier: 'Gold', Customerdate_LastOrdered: '2026-09-01' }] } },
        '/api/customer-history/9001': { json: { hasHistory: true, orderCount: 2, totalRevenue: 2075.5, avgOrderSize: 1037.75, lastOrderDaysAgo: 8, topItems: [{ name: 'Embroidered polos' }] } },
        '/api/quote_sessions': { json: [{ QuoteID: 'EMB-REVIEW-1', TotalAmount: 1200, Status: 'Payment Confirmed', CustomerName: fixture.lead.Company }] },
        '/api/crm-proxy/order-odbc': { json: orders },
    } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await expect(page.locator('#lw-panel-intel')).toContainText('$2,075.50'); await expect(page.locator('.lw-quote-amount')).toHaveText('$1,200.00');
    await page.locator('#lw-load-orders').click(); await expect(page.locator('#orders-root tbody tr')).toHaveCount(2);
    const expected = [['Sep 1, 2026', 'REVIEW-100', '$1,200.00', 'Invoiced'], ['Aug 15, 2026', 'REVIEW-101', '$875.50', 'Shipped']];
    const rows = () => page.locator('#orders-root tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.textContent.trim())));
    expect(await rows()).toEqual(expected);
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await axe(page); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: path.join(output, 'records-lead-populated-' + width + '.png'), fullPage: true }); }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ media: 'print' }); expect(await rows()).toEqual(expected);
    expect(await page.locator('#orders-root td').evaluateAll(cells => cells.every(cell => { const range = document.createRange(); range.selectNodeContents(cell); return range.getClientRects().length <= 1; }))).toBe(true);
    await page.pdf({ path: path.join(output, 'records-lead-populated.pdf'), preferCSSPageSize: true, printBackground: true }); clean(events);
});

test('CSS records: an old linked-quote response cannot reprice a newly reloaded lead', async ({ page }) => {
    let releaseOld, releaseNew, reads = 0;
    const state = { respond: async u => {
        if (u.pathname === '/api/crm-proxy/form-submissions/CSS-DETAIL-1') { reads++; return { json: { submission: { ...fixture.lead, Linked_Quote_ID: reads === 1 ? 'EMB-OLD' : 'EMB-NEW' }, items: [] } }; }
        if (u.pathname === '/api/quote_sessions') {
            const old = u.searchParams.get('quoteID') === 'EMB-OLD'; await new Promise(resolve => { if (old) releaseOld = resolve; else releaseNew = resolve; });
            return { json: [{ QuoteID: old ? 'EMB-OLD' : 'EMB-NEW', TotalAmount: old ? 9999 : 1200, Status: 'Quoted' }] };
        }
    } };
    const events = await open(page, 'lead', state); await expect.poll(() => typeof releaseOld).toBe('function'); await page.locator('#lw-refresh').click(); await expect.poll(() => typeof releaseNew).toBe('function');
    const old = page.waitForResponse(r => r.url().includes('quoteID=EMB-OLD')); releaseOld(); await (await old).finished();
    expect(events.writes).toHaveLength(0); await expect(page.locator('#lw-quote-live')).toHaveText('Loading quote…');
    releaseNew(); await expect(page.locator('.lw-quote-amount')).toHaveText('$1,200.00'); clean(events);
});

test('CSS records: the current linked quote still synchronizes its valid total through the mocked write', async ({ page }) => {
    const state = { responses: {
        '/api/crm-proxy/form-submissions/CSS-DETAIL-1': { json: { submission: { ...fixture.lead, Linked_Quote_ID: 'EMB-CURRENT' }, items: [] } },
        '/api/quote_sessions': { json: [{ QuoteID: 'EMB-CURRENT', TotalAmount: 1550, Status: 'Quoted' }] },
    }, writeResponse: { json: {} } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await expect(page.locator('.lw-value-big')).toHaveText('$1,550.00');
    await expect(page.locator('.lw-quote-amount')).toHaveText('$1,550.00'); expect(events.writes[0]).toMatchObject({ method: 'PUT', path: '/api/crm-proxy/form-submissions/CSS-DETAIL-1', body: { Lead_Value: '1550' } }); clean(events, 1);
});

test('CSS records: missing and malformed linked quotes remain distinct and never synchronize an amount', async ({ page }) => {
    const endpoint = '/api/quote_sessions', state = { responses: {
        '/api/crm-proxy/form-submissions/CSS-DETAIL-1': { json: { submission: { ...fixture.lead, Linked_Quote_ID: 'EMB-MISSING' }, items: [] } },
        [endpoint]: { json: [] },
    } };
    const events = await open(page, 'lead', state); await ready(page, 'lead'); await expect(page.locator('#lw-quote-live')).toContainText('not found'); await expect(page.locator('#lw-quote-unlink')).toBeVisible();
    state.responses[endpoint] = { json: {} }; await page.locator('#lw-refresh').click(); await expect(page.locator('#lw-quote-live')).toHaveText('Quote lookup unavailable.');
    await expect(page.locator('.lw-value-big')).toHaveText('$1,200.00'); clean(events);
});
