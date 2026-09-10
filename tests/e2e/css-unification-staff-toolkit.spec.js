const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const data = require('./fixtures/staff-toolkit-data');
const baseline = require('../fixtures/staff-toolkit-original-browser.json');
const source = require('../fixtures/staff-toolkit-original-content.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
test.describe.configure({ mode: 'parallel' });

async function open(page, tool, state = {}) {
    const events = { errors: [], writes: [], unknown: [], missing: [], provider: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    await page.clock.setFixedTime(new Date(data.fixed));
    await page.addInitScript(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (!['GET', 'HEAD'].includes(req.method()) || p.startsWith('/api/quote-sequence/') || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postData() });
            return route.fulfill(state.respondWrite ? await state.respondWrite(req) : { status: 503, json: { error: 'Synthetic write failure' } });
        }
        if (state.respond && p.startsWith('/api/')) { const response = await state.respond(u); if (response) return route.fulfill(response); }
        const response = data.response(u);
        if (response !== undefined) return route.fulfill({ json: response });
        if (u.origin === 'https://form.jotform.com' && p === '/jsform/261515595979071') {
            events.provider.push(req.url());
            return route.fulfill({ contentType: 'application/javascript', body: 'const f=document.createElement("iframe");f.title="Synthetic supply order form";f.width="100%";f.height="800";f.srcdoc="<html lang=\\"en\\"><title>Synthetic provider boundary</title><main><p>External provider form — synthetic boundary only</p></main></html>";document.currentScript.parentElement.appendChild(f);' });
        }
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && p === '/ajax/libs/font-awesome/6.4.0/css/all.min.css')) return route.continue();
        if (p.startsWith('/api/') || ['fetch', 'xhr'].includes(req.resourceType())) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['127.0.0.1', 'localhost'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            let body = fs.readFileSync(file);
            if (state.original && source.hashes[p.slice(1)]) {
                const html = source.pages.find(r => r.file === p.slice(1));
                let text = html ? html.html : body.toString('utf8').replace(/\r\n/g, '\n');
                if (!html) for (const change of source.changes.filter(c => c.file === p.slice(1)).reverse()) { expect(text.split(change.after).length - 1).toBe(change.count); text = text.split(change.after).join(change.before); }
                expect(require('node:crypto').createHash('sha256').update(text).digest('hex')).toBe(source.hashes[p.slice(1)]);
                body = Buffer.from(text);
            }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf' }[path.extname(file)] || 'application/octet-stream', body });
        }
        if (['image', 'font'].includes(req.resourceType())) return route.continue();
        events.unknown.push(req.url()); return route.abort();
    });
    await page.goto('/dashboards/' + tool + '.html');
    await page.evaluate(() => document.fonts.ready);
    return events;
}

function clean(events) { expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]); expect(events.writes).toEqual([]); }
async function tables(page) { return page.locator('table').evaluateAll(ts => ts.map(t => ({ id: t.id, rows: [...t.rows].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())) }))); }
async function axe(page, provider = false) { let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']); if (provider) builder = builder.exclude('.rps-form-wrap'); expect((await builder.analyze()).violations).toEqual([]); }

for (const tool of ['contract-break-even', 'roland-printer-supplies']) test('CSS staff toolkit: ' + tool + ' supports four widths and keyboard navigation', async ({ page }) => {
    const events = await open(page, tool);
    if (tool === 'contract-break-even') await expect(page.locator('.cbe-table')).toHaveCount(3);
    else await expect(page.locator('.rps-form-wrap iframe')).toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await axe(page, tool === 'roland-printer-supplies');
        await page.screenshot({ path: path.join(output, 'staff-toolkit-' + tool + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
    expect(await page.evaluate(() => location.hash)).toBe('#staff-tool-main');
    if (tool === 'contract-break-even') {
        const region = page.getByRole('region', { name: 'Contract price comparison' }).first(); await region.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    } else {
        await expect(page.getByRole('link', { name: /Download Printable Form/ })).toHaveAttribute('href', '/forms/NWCA_LG540_Order_Form_1page.pdf');
        expect(events.provider).toEqual(['https://form.jotform.com/jsform/261515595979071']);
    }
    clean(events);
});

test('CSS staff toolkit: all contract cost and profit cells match the original across both production cases', async ({ page }) => {
    const events = await open(page, 'contract-break-even');
    await expect(page.locator('.cbe-table')).toHaveCount(3);
    const original = baseline.find(r => r.tool === 'contract-break-even');
    for (const prodCase of ['typical', 'worst']) for (const view of ['cost', 'profit']) {
        await page.locator('[data-case="' + prodCase + '"]').click(); await page.locator('[data-view="' + view + '"]').click();
        expect(await tables(page)).toEqual(original.states.find(s => s.name === prodCase + '-' + view).tables);
        await expect(page.locator('[data-case="' + prodCase + '"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-view="' + view + '"]')).toHaveAttribute('aria-pressed', 'true');
        await axe(page);
    }
    await page.locator('#cbe-print').click(); expect(await page.evaluate(() => window.__printCalls)).toBe(1);
    await page.pdf({ path: path.join(output, 'staff-toolkit-contract-profit.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.locator('[data-case="typical"]').click(); await page.locator('[data-view="cost"]').click();
    await page.pdf({ path: path.join(output, 'staff-toolkit-contract-cost.pdf'), printBackground: true, preferCSSPageSize: true });
    clean(events);
});

test('CSS staff toolkit: original native contract controls reproduce the preserved baseline', async ({ page }) => {
    const events = await open(page, 'contract-break-even', { original: true });
    await expect(page.locator('.cbe-table')).toHaveCount(3);
    expect(await tables(page)).toEqual(baseline.find(r => r.tool === 'contract-break-even').states.find(s => s.name === 'populated').tables);
    clean(events);
});

for (const problem of ['http', 'malformed', 'missing-tier']) test('CSS staff toolkit: contract ' + problem + ' failure cannot print a misleading comparison and retries', async ({ page }) => {
    let failed = true;
    const events = await open(page, 'contract-break-even', { respond: async u => {
        if (u.pathname !== '/api/contract-pricing' || !failed) return;
        if (problem === 'http') return { status: 503, json: { error: 'Synthetic service unavailable' } };
        if (problem === 'malformed') return { json: {} };
        const card = JSON.parse(JSON.stringify(data.contract)); delete card.garments.perThousandRates['24-47'];
        return { json: card };
    } });
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page.locator('#cbe-tables table')).toHaveCount(0);
    await expect(page.locator('#cbe-print')).toBeDisabled();
    await expect(page.locator('[data-case="worst"]')).toBeDisabled();
    await expect(page.locator('.dash-error-banner')).toContainText('Nothing is shown rather than a wrong cost');
    expect(await page.evaluate(() => window.__printCalls || 0)).toBe(0);
    await page.setViewportSize({ width: 320, height: 900 }); await axe(page);
    failed = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('#cbe-tables table')).toHaveCount(3);
    await expect(page.locator('#cbe-print')).toBeEnabled();
    await expect(page.locator('.dash-error-banner')).toBeHidden();
    expect(await tables(page)).toEqual(baseline.find(r => r.tool === 'contract-break-even').states.find(s => s.name === 'populated').tables);
    clean(events);
});

test('CSS staff toolkit: pending contract data holds controls until a complete response arrives', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const events = await open(page, 'contract-break-even', { respond: async u => {
        if (u.pathname === '/api/contract-pricing') { await gate; return { json: data.contract }; }
    } });
    try {
        await expect(page.locator('#cbe-assumptions')).toHaveAttribute('aria-busy', 'true');
        await expect(page.locator('#cbe-print')).toBeDisabled();
        await expect(page.locator('[data-view="profit"]')).toBeDisabled();
        await expect(page.locator('#cbe-tables table')).toHaveCount(0);
    } finally { release(); }
    await expect(page.locator('#cbe-tables table')).toHaveCount(3);
    await expect(page.locator('#cbe-assumptions')).toHaveAttribute('aria-busy', 'false');
    clean(events);
});

test('CSS staff toolkit: original volume quote captures both paper modes and exact synthetic save payloads', async ({ page }) => {
    const events = await open(page, 'volume-quote', { original: true, respondWrite: async req => {
        if (new URL(req.url()).pathname === '/api/quote-sequence/VQ') return { json: { prefix: 'VQ', year: 2026, sequence: 901 } };
        return { json: { success: true } };
    } });
    await page.locator('.vq-line-style').fill('PC54'); await page.locator('.vq-line-style').press('Tab');
    await expect(page.locator('.vq-line-title')).toContainText('Synthetic Cotton Tee');
    await page.locator('.vq-line-qty').fill('500');
    await expect(page.locator('.vq-line-stock')).toContainText('1,500 total');
    await page.locator('#vq-customer').fill('Synthetic Cedar Outfitters'); await page.locator('#vq-rep').fill('Review Staff');
    const before = { tables: await tables(page), memo: await page.locator('#vq-memo').textContent() };
    await page.locator('#vq-print').click(); await page.pdf({ path: path.join(output, 'staff-toolkit-volume-original-memo.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#vq-print-customer').click(); await page.pdf({ path: path.join(output, 'staff-toolkit-volume-original-customer.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#vq-save').click(); await expect(page.locator('#vq-save-status')).toContainText('Saved as VQ-2026-901');
    expect(events.writes.map(w => [w.method, w.path])).toEqual([['GET', '/api/quote-sequence/VQ'], ['POST', '/api/quote_sessions'], ['POST', '/api/quote_items']]);
    fs.writeFileSync(path.join(output, 'staff-toolkit-volume-original-workflow.json'), JSON.stringify({ ...before, writes: events.writes }, null, 2) + '\n');
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});
