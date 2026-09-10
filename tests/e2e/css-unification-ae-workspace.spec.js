const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const { open } = require('./helpers/staff-workspaces-browser');
const fixtures = require('../fixtures/staff-workspaces-ae-synthetic.json');
const output = path.join(__dirname, 'screenshots/css-unification');
test('CSS staff workspaces: Mission Control current six-tab responsive layout', async ({ page }) => {
    const AxeBuilder = require('@axe-core/playwright').default;
    const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/staff-workspaces-ae-original-browser.json'), 'utf8'));
    const state = aeState('admin', false), events = await openAE(page, state), views = [];
    const norm = s => s.replace(/Skip to Mission Control/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['today', 'money', 'calls', 'book', 'pipeline', 'wins']) {
            await page.locator('#mc-tab-' + tab).click();
            await expect(page.locator('.dash-loading:visible')).toHaveCount(0);
            if (tab === 'book') await expect(page.locator('#mc-book-active')).not.toHaveText('—');
            await page.waitForLoadState('networkidle');
            const text = await page.locator('body').innerText(), source = original.views.find(v => v.width === width && v.tab === tab);
            views.push({ width, tab, text });
            await page.screenshot({ path: path.join(output, 'staff-workspaces-ae-current-' + tab + '-' + width + '.png'), fullPage: true });
            // The aria-hidden compact copy appears only when the large bonus band scrolls away.
            const compact = await page.locator('#mc-condensed-amount, #mc-condensed-next').allTextContents();
            const withoutCompact = text => compact.reduce((value, part) => value.replace(norm(part), ''), norm(text)).replace(/\s+/g, ' ');
            expect.soft(withoutCompact(text), width + '/' + tab + ' content').toBe(withoutCompact(source.text));
            expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), width + '/' + tab + ' page width').toBeLessThanOrEqual(width);
            const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
            views[views.length - 1].violations = result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
            expect.soft(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), width + '/' + tab).toEqual([]);
        }
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-current-browser.json'), JSON.stringify({ views, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind], kind).toEqual([]);
});
for (const original of [true, false]) {
const edition = original ? 'original' : 'current';
test('CSS staff workspaces: Mission Control ' + edition + ' expanded drawers and call sheet', async ({ page }) => {
    const state = aeState('admin', original), respond = state.respond, views = [];
    state.respond = async (req, url) => {
        const response = await respond(req, url);
        if (!response || !response.json) return response;
        const json = structuredClone(response.json);
        if (url.pathname.endsWith('/summary')) {
            const seed = json.actionQueue.artAwaitingApproval[0];
            json.actionQueue.artAwaitingApproval = Array.from({ length: 7 }, (_, i) => ({ ...seed, idDesign: 88000 + i, companyName: 'Synthetic artwork workshop ' + (i + 1) }));
        }
        if (url.pathname.endsWith('/due-dates')) {
            const seed = json.late[0];
            json.late = Array.from({ length: 6 }, (_, i) => ({ ...seed, idOrder: 88000 + i, company: 'Synthetic overdue workshop ' + (i + 1) }));
            json.counts.late = 6;
        }
        return { ...response, json };
    };
    const events = await openAE(page, state);
    for (const name of ['fires', 'artwork']) {
        await expect(page.locator('#mc-' + name + '-all')).toBeVisible();
        await page.locator('#mc-' + name + '-all').click();
        await expect(page.locator('#mc-drawer')).toBeVisible();
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: 1000 });
            if (!original) {
                const bounds = await page.locator('#mc-drawer').boundingBox();
                expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
                const result = await new (require('@axe-core/playwright').default)({ page }).withTags(['wcag2a','wcag2aa']).analyze();
                expect(result.violations.map(v => ({ id:v.id, nodes:v.nodes.map(n => n.target) }))).toEqual([]);
            }
            views.push({ name, width, text: await page.locator('#mc-drawer').innerText() });
            await page.screenshot({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-drawer-' + name + '-' + width + '.png'), fullPage: true });
        }
        await page.keyboard.press('Escape');
        await expect(page.locator('#mc-drawer')).toBeHidden();
        await expect(page.locator('#mc-' + name + '-all')).toBeFocused();
    }
    await page.locator('#mc-tab-calls').click();
    await expect(page.locator('#aemc-calls-list > li')).toHaveCount(15);
    await page.locator('#aemc-calls-more').click();
    await expect(page.locator('#aemc-calls-list > li')).toHaveCount(26);
    await expect(page.locator('#aemc-calls-more')).toBeHidden();
    const rows = await page.locator('#aemc-calls-list > li').allTextContents();
    await page.locator('.aemc-call-co').first().click();
    await expect(page.locator('[data-log]').first()).toContainText('Read-only while viewing as someone else.');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#aemc-calls-print').click();
    const popup = await popupPromise;
    await expect(popup.locator('tbody tr')).toHaveCount(26);
    const paper = await popup.locator('body').innerText();
    await popup.pdf({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-call-sheet.pdf'), format: 'Letter', printBackground: true });
    await popup.close();
    if (!original) {
        const baseline = require('../fixtures/staff-workspaces-ae-original-expanded.json');
        expect(rows).toEqual(baseline.rows); expect(paper).toBe(baseline.paper);
        expect(views.map(v => v.text.replace(/\s+/g, ' ').toLowerCase())).toEqual(baseline.views.map(v => v.text.replace(/\s+/g, ' ').toLowerCase()));
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-' + edition + '-expanded.json'), JSON.stringify({ views, rows, paper, reads: state.reads, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind], kind).toEqual([]);
});
}

for (const original of [true, false]) {
const edition = original ? 'original' : 'current';
for (const scenario of ['rep', 'secondRep', 'degraded']) {
    test('CSS staff workspaces: Mission Control ' + edition + ' ' + scenario + ' identity and panels', async ({ page }) => {
        test.setTimeout(45000);
        const state = aeState(scenario, original), events = await openAE(page, state), views = [];
        await expect(page.locator('#kpi-ytd')).not.toHaveText('—');
        await expect(page.locator('#aemc-viewas')).toBeHidden();
        for (const tab of ['today', 'money', 'calls', 'book', 'pipeline', 'wins']) {
            await page.locator('#mc-tab-' + tab).click();
            await expect(page.locator('.dash-loading:visible')).toHaveCount(0);
            if (tab === 'book') await expect(page.locator('#mc-book-active')).not.toHaveText('—');
            await page.waitForLoadState('networkidle');
            await expect.poll(() => page.locator('body').innerText()).not.toMatch(/Loading(?:…| your)/);
            views.push({ tab, text: await page.locator('body').innerText() });
        }
        if (scenario !== 'degraded') {
            await page.locator('#mc-tab-calls').click();
            // Capture the original payload independently of its sticky-header click obstruction.
            if (original) {
                await page.locator('.aemc-call-co').first().dispatchEvent('click');
                await page.locator('.aemc-call-btn[data-status="Reached"]').first().dispatchEvent('click');
            } else {
                await page.locator('.aemc-call-co').first().click();
                await page.locator('.aemc-call-btn[data-status="Reached"]').first().click();
            }
            await expect(page.locator('.aemc-call-saved').first()).toContainText('Logged');
            expect(events.writes).toHaveLength(1);
            const write = events.writes[0];
            expect(write.method).toBe('PUT');
            expect(write.path).toContain(scenario === 'rep' ? '/taneisha-accounts/' : '/nika-accounts/');
            expect(JSON.parse(write.body)).toEqual({ Last_Contact_Date: '2026-09-10', Contact_Status: 'Reached', Follow_Up_Type: 'Call' });
        }
        fs.writeFileSync(path.join(output, 'staff-workspaces-ae-' + edition + '-' + scenario + '.json'), JSON.stringify({ views, reads: state.reads, events }, null, 2) + '\n');
        for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind], kind).toEqual([]);
    });
}
}

for (const original of [true, false]) {
const edition = original ? 'original' : 'current';
test('CSS staff workspaces: Mission Control ' + edition + ' invoice and inbound print surfaces', async ({ page }) => {
    const state = aeState('admin', original);
    state.paperData = true;
    const events = await openAE(page, state), dialogs = [], papers = [];
    await expect(page.locator('.aemc-inv-btn').first()).toBeVisible();
    await page.locator('.aemc-inv-btn').first().click();
    await expect(page.locator('#smiv-body .smiv-inv').first()).toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        dialogs.push({ name: 'invoice', width, text: await page.locator('#smiv-modal').innerText() });
        await page.locator('#smiv-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-invoice-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#smiv-print').click();
    await expect(page.locator('#smiv-print-sheet')).toHaveCount(1);
    papers.push({ name: 'invoice', text: await page.locator('#smiv-print-sheet').textContent() });
    if (!original) {
        await page.emulateMedia({ media:'print' });
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        await page.emulateMedia({ media:null });
    }
    await page.pdf({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-invoice.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    // Let the legacy 1.5s fallback expire before beginning a different print job.
    if (original) await page.waitForTimeout(1600);
    await page.locator('#smiv-close').click();
    await page.locator('#aemc-inbound-open').click();
    await expect(page.locator('.sit-modal')).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        if (!original) {
            const bounds = await page.locator('.sit-modal-content').boundingBox();
            expect.soft(bounds.x).toBeGreaterThanOrEqual(0); expect.soft(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect.soft(await page.locator('.sit-modal-content').evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
            const result = await new (require('@axe-core/playwright').default)({ page }).withTags(['wcag2a','wcag2aa']).analyze();
            expect.soft(result.violations.map(v => ({ id:v.id, nodes:v.nodes.map(n => ({target:n.target,why:n.failureSummary})) })), 'inbound ' + width).toEqual([]);
            await page.locator('#sit-close').focus(); await page.keyboard.press('Tab');
            expect.soft(await page.locator('.sit-modal').evaluate(n => n.contains(document.activeElement))).toBe(true);
        }
        await page.locator('.sit-modal-content').evaluate(n => { n.scrollTop = 0; });
        dialogs.push({ name: 'inbound', width, text: await page.locator('.sit-modal').innerText() });
        await page.locator('.sit-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-inbound-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#sit-print').click();
    const profiles = await page.locator('#sit-printmenu [data-print]').evaluateAll(ns => ns.map(n => ({ type: n.dataset.print, rep: n.dataset.rep || '', text: n.textContent.trim() })));
    await page.locator('#sit-print').click();
    for (let i = 0; i < profiles.length; i++) {
        await page.locator('#sit-print').click();
        await page.locator('#sit-printmenu [data-print]').nth(i).click();
        await expect(page.locator('#sit-print-sheet')).toHaveCount(1);
        // The original controller waits up to six seconds for print images.
        await expect(page.locator('body')).toHaveClass(/sit-printing/, { timeout: 10000 });
        papers.push({ ...profiles[i], text: await page.locator('#sit-print-sheet').textContent() });
        await page.pdf({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-report-' + i + '.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        // Legacy cleanup queries the sheet by ID, so an old timer can remove a new job.
        if (original) await page.waitForTimeout(1600);
    }
    await page.locator('#sit-labels').click();
    await expect(page.locator('body')).toHaveClass(/sit-label-printing/);
    papers.push({ name: 'box-labels', text: await page.locator('#sit-label-sheet').textContent() });
    await page.pdf({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-box-labels.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    if (!original) {
        await page.locator('#sit-print').click(); await page.keyboard.press('Escape');
        await expect(page.locator('#sit-printmenu')).toBeHidden(); await expect(page.locator('.sit-modal')).toBeVisible();
        await page.keyboard.press('Escape'); await expect(page.locator('.sit-modal')).toBeHidden();
        await expect(page.locator('#aemc-inbound-open')).toBeFocused();
    } else await page.locator('#sit-close').click();
    if (!original) {
        const baseline = require('../fixtures/staff-workspaces-ae-original-documents.json');
        expect(paperText(papers)).toEqual(paperText(baseline.papers));
        expect(state.paperInputs).toEqual(baseline.paperInputs);
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-' + edition + '-documents.json'), JSON.stringify({ dialogs, profiles, papers, paperInputs: state.paperInputs, events }, null, 2) + '\n');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind], kind).toEqual([]);
});
}

for (const original of [true, false]) {
const edition = original ? 'original' : 'current';
test('CSS staff workspaces: Mission Control ' + edition + ' kit and outreach forms use intercepted actions', async ({ page }) => {
    const state = aeState('admin', original), events = await openAE(page, state), dialogs = [];
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
        if (!original) {
            const bounds = await page.locator('#aemc-kit-modal').boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            const result = await new (require('@axe-core/playwright').default)({ page }).include('#aemc-kit-modal').withTags(['wcag2a', 'wcag2aa']).analyze();
            expect(result.violations.map(v => v.id)).toEqual([]);
        }
        await page.locator('#aemc-kit-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-kit-' + width + '.png') });
    }
    await page.locator('#aemc-kit-send').click();
    await expect(page.locator('#aemc-kit-status')).toContainText('SYNTHETIC-KIT-001');
    await page.locator('#aemc-kit-close').click();
    if (!original) await expect(page.locator('#aemc-kit-btn')).toBeFocused();
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
        await page.locator('#aemc-outreach-modal').screenshot({ path: path.join(output, 'staff-workspaces-ae-' + edition + '-outreach-' + width + '.png') });
    }
    await page.locator('#aemc-outreach-send').click();
    await expect(page.locator('.aemc-outreach-sent')).toContainText('Sent');
    fs.writeFileSync(path.join(output, 'staff-workspaces-ae-' + edition + '-actions.json'), JSON.stringify({ dialogs, writes: events.writes, events }, null, 2) + '\n');
    if (!original) {
        const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/staff-workspaces-ae-original-actions.json'), 'utf8'));
        expect(events.writes).toEqual(baseline.writes);
        expect(dialogs.map(d => d.fields).filter(Boolean)).toEqual(baseline.dialogs.map(d => d.fields).filter(Boolean));
    }
    for (const kind of ['errors', 'unknown', 'missing']) expect(events[kind], kind).toEqual([]);
    expect(events.writes).toHaveLength(6);
    expect(events.writes[0].path).toBe('/api/crm-proxy/marketing-shipments');
    expect(events.writes.slice(1).map(w => ({ path: w.path, preview: JSON.parse(w.body).preview }))).toEqual([true, true, true, true, false].map(preview => ({ path: '/api/crm-proxy/lead-outreach', preview })));
});
}
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
test('CSS staff workspaces: Mission Control current pending dialogs and obsolete previews', async ({ page }) => {
    const state = aeState('admin', false), respondWrite = state.respondWrite;
    let releaseKit, releasePreview, releaseSend;
    state.respondWrite = async (req, url) => {
        if (url.pathname.endsWith('/marketing-shipments')) return new Promise(resolve => { releaseKit = resolve; });
        if (url.pathname.endsWith('/lead-outreach')) {
            const body = req.postDataJSON();
            if (body.preview && body.template === 'intro') return new Promise(resolve => { releasePreview = resolve; });
            if (!body.preview) return new Promise(resolve => { releaseSend = resolve; });
        }
        return respondWrite(req, url);
    };
    const events = await openAE(page, state);
    await page.locator('#aemc-kit-btn').click();
    await page.locator('.aemc-kit-cb').first().check();
    for (const [key, value] of Object.entries({ recipient:'Cedar Example', addr1:'123 Example Way', city:'Sample City', state:'WA', zip:'00000' })) await page.locator('#aemc-kit-' + key).fill(value);
    await page.locator('#aemc-kit-send').click(); await expect.poll(() => Boolean(releaseKit)).toBe(true);
    await expect(page.locator('#aemc-kit-send')).toBeDisabled(); await expect(page.locator('#aemc-kit-close')).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.locator('#aemc-kit-modal')).toBeVisible();
    releaseKit({ status:503, json:{ error:'Synthetic shipping interruption' } });
    await expect(page.locator('#aemc-kit-status')).toContainText('Check the shipping queue before trying again.');
    await expect(page.locator('#aemc-kit-send')).toBeEnabled(); await page.locator('#aemc-kit-close').click();
    await expect(page.locator('#aemc-kit-btn')).toBeFocused();
    await page.locator('#mc-tab-pipeline').click(); await page.locator('.aemc-email-btn').first().click();
    await page.locator('[data-tpl="0"]').click(); await expect.poll(() => Boolean(releasePreview)).toBe(true);
    await page.locator('[data-tpl="1"]').click(); await expect(page.locator('.aemc-outreach-subject')).toHaveText('Synthetic quote-followup preview');
    releasePreview({ json:{ subject:'OBSOLETE preview', bodyHtml:'<p>Old preview only.</p>' } });
    await page.waitForLoadState('networkidle'); await expect(page.locator('.aemc-outreach-subject')).toHaveText('Synthetic quote-followup preview');
    await page.locator('#aemc-outreach-send').click(); await expect.poll(() => Boolean(releaseSend)).toBe(true);
    await expect(page.locator('#aemc-outreach-send')).toBeDisabled(); await expect(page.locator('[data-tpl="0"]')).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.locator('#aemc-outreach-modal')).toBeVisible();
    releaseSend({ status:503, json:{ error:'Synthetic email interruption' } });
    await expect(page.locator('#aemc-outreach-note')).toContainText('Check the lead’s timeline before trying again.');
    await expect(page.locator('#aemc-outreach-send')).toBeEnabled(); await expect(page.locator('[data-tpl="0"]')).toBeEnabled();
    const result = await new (require('@axe-core/playwright').default)({ page }).withTags(['wcag2a','wcag2aa']).analyze();
    expect(result.violations.map(v => v.id)).toEqual([]);
    await page.keyboard.press('Escape'); await expect(page.locator('#aemc-outreach-modal')).toBeHidden();
    expect(events.writes.map(w => w.path)).toEqual(['/api/crm-proxy/marketing-shipments', ...Array(3).fill('/api/crm-proxy/lead-outreach')]);
    expect(JSON.parse(events.writes[3].body)).toMatchObject({ preview:false, template:'quote-followup' });
    for (const kind of ['errors','unknown','missing']) expect(events[kind], kind).toEqual([]);
});

test('CSS staff workspaces: Mission Control current delayed identity and rapid tab navigation', async ({ page }) => {
    const state = aeState('admin', false), respond = state.respond;
    let releaseSummary;
    state.respond = async (req, url) => {
        const response = await respond(req, url);
        if (url.pathname.endsWith('/summary')) await new Promise(resolve => { releaseSummary = resolve; });
        return response;
    };
    const events = await openAE(page, state);
    await expect.poll(() => Boolean(releaseSummary)).toBe(true);
    expect(state.reads.some(p => p === '/api/sanmar-orders/inbound-today')).toBe(false);
    releaseSummary(); await expect(page.locator('#aemc-inbound-sub')).toHaveText('1 yours · 2 all');
    await expect(page.locator('#aemc-inbound')).toContainText('882211');
    await expect(page.locator('#aemc-inbound')).not.toContainText('882244');
    await page.evaluate(() => { document.getElementById('mc-tab-book').click(); document.getElementById('mc-tab-today').click(); });
    await page.locator('#mc-tab-book').click(); await expect(page.locator('#mc-book-active')).not.toHaveText('—');
    await expect(page.locator('.dash-loading:visible')).toHaveCount(0);
    for (const kind of ['errors','unknown','missing','writes']) expect(events[kind], kind).toEqual([]);
});

async function openAE(page, state) {
    // The legacy page races its first inbound filter against the summary identity.
    // Order those synthetic responses for a stable content baseline; current code must order itself.
    if (state.original) state.readyForInbound = () => expect(page.locator('#kpi-ytd')).not.toHaveText('—');
    return open(page, 'ae-mission-control', state);
}
function aeState(scenario = 'admin', original = true) {
    const state = { original, reads: [] }, routes = fixtures.scenarios[scenario];
    state.respond = async (req, url) => {
        if (req.method() !== 'GET' || !['localhost', '127.0.0.1', 'caspio-pricing-proxy-ab30a049961a.herokuapp.com'].includes(url.hostname)) return null;
        if (!url.pathname.startsWith('/api/')) return null;
        if (url.pathname === '/api/sanmar-orders/inbound-today' && state.readyForInbound) await state.readyForInbound();
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
        state.reads.push(key);
        const response = fixtures.responses[id];
        if (state.paperData && url.pathname === '/api/sanmar-orders/inbound-today') {
            const json = structuredClone(response.json);
            json.orders = json.orders.map((order, i) => {
                const perBox = i === 0 ? [4, 8, 12, 8] : i === 1 ? [6, 8, 10, 12] : [6, 6, 6, 6];
                // Explicit synthetic paper costs, not production pricing or calculator inputs.
                const cost = [384, 900, 96][i];
                const items = perBox.map((qty, n) => ({ style: i ? 'PC61' : 'PC54', title: 'Synthetic cotton tee', color: i ? 'Navy' : 'Black', size: ['S', 'M', 'L', 'XL'][n], qty }));
                return { ...order, cost, piecesOrdered: order.piecesShipped, method: i ? 'DTG' : 'Embroidery', designNumber: String(99001 + i), designName: 'Synthetic stitch sample', dueDate: '2026-09-16', dateOrdered: '2026-09-08', contactName: 'Cedar Example', customerPO: 'SYNTHETIC-' + i, terms: 'Net 30', boxDetailAvailable: true,
                    lines: items.map(item => ({ ...item, qtyOrdered: item.qty * order.boxes, qtyShipped: item.qty * order.boxes, status: 'Shipped', lineCost: cost * item.qty / perBox.reduce((a, b) => a + b, 0) })),
                    boxDetail: Array.from({ length: order.boxes }, (_, n) => ({ boxNumber: n + 1, pieces: perBox.reduce((a, b) => a + b, 0), items, trackingNumber: 'SYNTHETIC-' + i + '-' + (n + 1), carrier: 'UPS' })) };
            });
            json.totals = { pos: 2, workOrders: 2, boxes: 8, piecesShipped: 276, cost: 1284, received: 1 };
            state.paperInputs = json.orders;
            return { ...response, json };
        }
        return response;
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
    const state = aeState(), events = await openAE(page, state), views = [];
    await expect(page.locator('#kpi-ytd')).not.toHaveText('—');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['today', 'money', 'calls', 'book', 'pipeline', 'wins']) {
            await page.locator('#mc-tab-' + tab).click();
            await expect(page.locator('#mc-tab-' + tab)).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('.dash-loading:visible')).toHaveCount(0);
            if (tab === 'book') await expect(page.locator('#mc-book-active')).not.toHaveText('—');
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

function paperText(papers) { return papers.map(p => p.text.replace(/\s+/g, ' ').trim().toLowerCase()); }
