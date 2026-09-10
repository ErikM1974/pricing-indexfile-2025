const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const { open } = require('./helpers/staff-workspaces-browser');
const fixtures = require('../fixtures/staff-workspaces-ae-synthetic.json');
const output = path.join(__dirname, 'screenshots/css-unification');
test('CSS staff workspaces: Mission Control original invoice and inbound print surfaces', async ({ page }) => {
    const state = aeState(), events = await open(page, 'ae-mission-control', state), dialogs = [], papers = [];
    await expect(page.locator('.aemc-inv-btn').first()).toBeVisible();
    await page.locator('.aemc-inv-btn').first().click();
    await expect(page.locator('#smiv-body .smiv-inv').first()).toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        dialogs.push({ name: 'invoice', width, text: await page.locator('#smiv-modal').innerText() });
        await page.locator('#smiv-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-original-invoice-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#smiv-print').click();
    await expect(page.locator('#smiv-print-sheet')).toHaveCount(1);
    papers.push({ name: 'invoice', text: await page.locator('#smiv-print-sheet').textContent() });
    await page.pdf({ path: path.join(output, 'staff-workspaces-ae-original-invoice.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#smiv-close').click();
    await page.locator('#aemc-inbound-open').click();
    await expect(page.locator('.sit-modal')).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        dialogs.push({ name: 'inbound', width, text: await page.locator('.sit-modal').innerText() });
        await page.locator('.sit-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-original-inbound-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#sit-print').click();
    const profiles = await page.locator('#sit-printmenu [data-print]').evaluateAll(ns => ns.map(n => ({ type: n.dataset.print, rep: n.dataset.rep || '', text: n.textContent.trim() })));
    await page.locator('#sit-print').click();
    for (let i = 0; i < profiles.length; i++) {
        await page.locator('#sit-print').click();
        await page.locator('#sit-printmenu [data-print]').nth(i).click();
        await expect(page.locator('#sit-print-sheet')).toHaveCount(1);
        await expect(page.locator('body')).toHaveClass(/sit-printing/);
        papers.push({ ...profiles[i], text: await page.locator('#sit-print-sheet').textContent() });
        await page.pdf({ path: path.join(output, 'staff-workspaces-ae-original-report-' + i + '.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    }
    await page.locator('#sit-labels').click();
    await expect(page.locator('body')).toHaveClass(/sit-label-printing/);
    papers.push({ name: 'box-labels', text: await page.locator('#sit-label-sheet').textContent() });
    await page.pdf({ path: path.join(output, 'staff-workspaces-ae-original-box-labels.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#sit-close').click();
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-original-documents.json'), JSON.stringify({ dialogs, profiles, papers, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind], kind).toEqual([]);
});
test('CSS staff workspaces: Mission Control original kit and outreach forms use intercepted actions', async ({ page }) => {
    const state = aeState(), events = await open(page, 'ae-mission-control', state), dialogs = [];
    await expect(page.locator('#kpi-ytd')).not.toHaveText('—');
    await page.locator('#aemc-kit-btn').click();
    await expect(page.locator('.aemc-kit-cb').first()).toBeVisible();
    await page.locator('#aemc-kit-send').click();
    await expect(page.locator('#aemc-kit-status')).toHaveText('Pick at least one item.');
    await page.locator('.aemc-kit-cb').first().check();
    await page.locator('.aemc-kit-qty').first().fill('2');
    await page.locator('#aemc-kit-send').click();
    await expect(page.locator('#aemc-kit-status')).toContainText('Street, city, state, and ZIP are required.');
    const values = { recipient: 'Cedar Example', company: 'Synthetic Workshop', addr1: '123 Example Way', addr2: 'Suite 2', city: 'Sample City', state: 'WA', zip: '00000', phone: '2535550100', email: 'cedar@example.test', notes: 'Local browser fixture only.' };
    for (const [key, value] of Object.entries(values)) await page.locator('#aemc-kit-' + key).fill(value);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        dialogs.push({ name: 'kit', width, text: await page.locator('#aemc-kit-modal').innerText(), fields: await page.locator('#aemc-kit-modal input, #aemc-kit-modal textarea').evaluateAll(ns => ns.map(n => ({ id: n.id, value: n.value, checked: n.checked }))) });
        await page.locator('#aemc-kit-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-original-kit-' + width + '.png') });
    }
    await page.locator('#aemc-kit-send').click();
    await expect(page.locator('#aemc-kit-status')).toContainText('SYNTHETIC-KIT-001');
    await page.locator('#aemc-kit-close').click();
    await page.locator('#mc-tab-pipeline').click();
    await expect(page.locator('.aemc-email-btn').first()).toBeVisible();
    await page.locator('.aemc-email-btn').first().click();
    for (let i = 0; i < 4; i++) {
        await page.locator('#aemc-outreach-btns [data-tpl]').nth(i).click();
        await expect(page.locator('.aemc-outreach-subject')).toHaveText('Synthetic ' + ['intro', 'quote-followup', 'checking-in', 'won-thanks'][i] + ' preview');
        dialogs.push({ name: 'outreach-preview', template: i, text: await page.locator('#aemc-outreach-modal').innerText() });
    }
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#aemc-outreach-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-original-outreach-' + width + '.png') });
    }
    await page.locator('#aemc-outreach-send').click();
    await expect(page.locator('.aemc-outreach-sent')).toContainText('Sent');
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-original-actions.json'), JSON.stringify({ dialogs, writes: events.writes, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind], kind).toEqual([]);
    expect(events.writes).toHaveLength(6);
    expect(events.writes[0].path).toBe('/api/crm-proxy/marketing-shipments');
    expect(events.writes.slice(1).map(w => ({ path: w.path, preview: JSON.parse(w.body).preview }))).toEqual([true, true, true, true, false].map(preview => ({ path: '/api/crm-proxy/lead-outreach', preview })));
});
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
function aeState(scenario = 'admin', original = true) {
    const state = { original, reads: [] }, routes = fixtures.scenarios[scenario];
    state.respond = async (req, url) => {
        if (req.method() !== 'GET' || !['localhost', '127.0.0.1', 'caspio-pricing-proxy-ab30a049961a.herokuapp.com'].includes(url.hostname)) return null;
        if (!url.pathname.startsWith('/api/')) return null;
        if (url.pathname === '/api/thumbnails/by-designs') return { json: { thumbnails: {} } };
        if (url.pathname === '/api/sanmar-orders/daily-inbound') return { json: { days: [{ date: '2026-09-10', orders: 3, boxes: 5, pieces: 120, cost: 500 }] } };
        const parameters = new URLSearchParams();
        if (url.searchParams.has('hydrate')) parameters.set('hydrate', url.searchParams.get('hydrate'));
        if (url.searchParams.has('viewAs')) parameters.set('viewAs', url.searchParams.get('viewAs'));
        let key = url.pathname + (parameters.size ? '?' + parameters.toString() : '');
        if (url.pathname === '/api/art-notifications') key = '/api/art-notifications?since=0';
        if (url.pathname === '/api/staff/finished-photos/library') key = '/api/staff/finished-photos/library?limit=24';
        if (url.pathname.startsWith('/api/sanmar-invoices/by-po/')) key = '/api/sanmar-invoices/by-po/SYNTHETIC-PO';
        const id = routes[key]; if (!id) return null;
        state.reads.push(key); return fixtures.responses[id];
    };
    state.respondWrite = async (req, url) => {
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) return null;
        if (req.method() === 'POST' && url.pathname === '/api/crm-proxy/marketing-shipments') return { json: { shipmentId: 'SYNTHETIC-KIT-001' } };
        if (req.method() === 'POST' && url.pathname === '/api/crm-proxy/lead-outreach') {
            const body = req.postDataJSON();
            return { json: body.preview ? { subject: 'Synthetic ' + body.template + ' preview', bodyHtml: '<p>Sample message for a browser fixture. No email is sent.</p>' } : { sent: true, to: body.lead.email, label: body.template } };
        }
        if (req.method() === 'PUT' && /^\/api\/crm-proxy\/(?:taneisha|nika)-accounts\/[^/]+\/crm$/.test(url.pathname)) return { json: { success: true } };
        return null;
    };
    return state;
}
test('CSS staff workspaces: Mission Control original six-tab desktop and phone content', async ({ page }) => {
    const state = aeState(), events = await open(page, 'ae-mission-control', state), views = [];
    await expect(page.locator('#kpi-ytd')).not.toHaveText('—');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['today', 'money', 'calls', 'book', 'pipeline', 'wins']) {
            await page.locator('#mc-tab-' + tab).click();
            await expect(page.locator('#mc-tab-' + tab)).toHaveAttribute('aria-selected', 'true');
            await page.waitForLoadState('networkidle');
            await expect.poll(() => page.locator('body').innerText()).not.toMatch(/Loading(?:…| your)/);
            views.push({ width, tab, text: await page.locator('body').innerText(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
                links: await page.locator('a[href]:visible').evaluateAll(ns => ns.map(n => ({ label: n.textContent.trim(), href: n.getAttribute('href') }))) });
            await page.screenshot({ path: path.join(output, 'staff-workspaces-ae-original-' + tab + '-' + width + '.png'), fullPage: true });
        }
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-original-browser.json'), JSON.stringify({ views, reads: state.reads, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind], kind).toEqual([]);
});
