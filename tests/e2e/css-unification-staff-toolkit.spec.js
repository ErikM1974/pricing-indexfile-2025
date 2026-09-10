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

async function populateVolume(page) {
    await page.locator('.vq-line-style').fill('PC54'); await page.locator('.vq-line-style').press('Tab');
    await expect(page.locator('.vq-line-title')).toContainText('Synthetic Cotton Tee');
    await page.locator('.vq-line-qty').fill('500'); await expect(page.locator('.vq-line-stock')).toContainText('1,500 total');
    await page.locator('#vq-customer').fill('Synthetic Cedar Outfitters'); await page.locator('#vq-rep').fill('Review Staff');
}

test('CSS staff toolkit: volume quote preserves complete prices and accessible controls at four widths', async ({ page }) => {
    const events = await open(page, 'volume-quote'); await populateVolume(page);
    const original = require('../fixtures/staff-toolkit-volume-original-workflow.json');
    expect(await tables(page)).toEqual(original.tables);
    expect(await page.locator('#vq-memo').textContent()).toBe(original.memo);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await tables(page)).toEqual(original.tables); await axe(page);
        await page.screenshot({ path: path.join(output, 'staff-toolkit-volume-quote-' + width + '.png'), fullPage: true });
    }
    for (const name of ['Standard and one-time prices', 'Customer quote prices']) {
        const region = page.getByRole('region', { name }); await region.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    }
    const memo = page.getByRole('region', { name: 'Internal approval memo' }); await memo.focus(); await page.keyboard.press('ArrowDown');
    await expect.poll(() => memo.evaluate(n => n.scrollTop)).toBeGreaterThan(0);
    await page.locator('.vq-stats').screenshot({ path: path.join(output, 'staff-toolkit-volume-mobile-stats.png') });
    await page.locator('#vq-memo').screenshot({ path: path.join(output, 'staff-toolkit-volume-mobile-memo.png') });
    clean(events);
});

test('CSS staff toolkit: volume quote keeps customer paper, internal memo and exact save request bodies', async ({ page }) => {
    const events = await open(page, 'volume-quote', { respondWrite: async req => new URL(req.url()).pathname === '/api/quote-sequence/VQ' ? { json: { prefix: 'VQ', year: 2026, sequence: 901 } } : { json: { success: true } } });
    await populateVolume(page);
    await page.locator('#vq-print').click();
    await page.pdf({ path: path.join(output, 'staff-toolkit-volume-memo.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#vq-print-customer').click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#vq-memo')).toBeHidden(); await expect(page.locator('#vq-cq-rows')).toBeVisible();
    await page.pdf({ path: path.join(output, 'staff-toolkit-volume-customer.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('#vq-save').click(); await expect(page.locator('#vq-save-status')).toContainText('Saved as VQ-2026-901');
    expect(events.writes).toEqual(require('../fixtures/staff-toolkit-volume-original-workflow.json').writes);
    await axe(page);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: native volume controls match the original across quantities, stitches and margin choices', async ({ page, context }) => {
    const old = await context.newPage();
    const currentEvents = await open(page, 'volume-quote'), originalEvents = await open(old, 'volume-quote', { original: true });
    await populateVolume(page); await populateVolume(old);
    for (const [qty, stitches, denominator] of [[144, 8000, 0.57], [500, 12000, 0.62], [1000, 6000, 0.65], [72, 7500, 0.50]]) {
        for (const target of [page, old]) {
            await target.locator('.vq-line-qty').fill(String(qty)); await target.locator('#vq-stitches').fill(String(stitches));
            await target.locator('#vq-denom').fill(String(denominator));
        }
        expect(await tables(page)).toEqual(await tables(old));
        expect(await page.locator('#vq-memo').textContent()).toBe(await old.locator('#vq-memo').textContent());
    }
    clean(currentEvents); clean(originalEvents); await old.close();
});

for (const latePart of ['pricing', 'inventory']) test('CSS staff toolkit: late volume ' + latePart + ' cannot replace the latest garment', async ({ page }) => {
    let release, started;
    const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const events = await open(page, 'volume-quote', { respond: async u => {
        const style = u.searchParams.get('styleNumber');
        if (latePart === 'pricing' && u.pathname === '/api/pricing-bundle' && style === 'PC54') { started(); await gate; return { json: data.bundle }; }
        if (latePart === 'inventory' && u.pathname === '/api/sanmar/inventory/PC54') { started(); await gate; return { json: { inventory: [{ color: 'Navy', totalQty: 999 }], grandTotal: 999 } }; }
        if (u.pathname === '/api/pricing-bundle' && style === 'PC78H') { const bundle = JSON.parse(JSON.stringify(data.bundle)); bundle.sizes.forEach(s => { s.price = 9.25; }); return { json: bundle }; }
        if (u.pathname === '/api/product-details' && style === 'PC78H') return { json: [{ PRODUCT_TITLE: 'Synthetic Hoodie', BRAND_NAME: 'Synthetic Vendor', PIECE_PRICE: 10.25 }] };
        if (u.pathname === '/api/sanmar/inventory/PC78H') return { json: { inventory: [{ color: 'Gray', totalQty: 88 }], grandTotal: 88 } };
    } });
    await page.locator('.vq-line-style').fill('PC54'); await page.locator('.vq-line-style').press('Tab'); await requested;
    await page.locator('.vq-line-style').fill('PC78H'); await page.locator('.vq-line-style').press('Tab');
    await expect(page.locator('.vq-line-title')).toContainText('Synthetic Hoodie'); await expect(page.locator('.vq-line-stock')).toContainText('88 total');
    const done = page.waitForResponse(r => latePart === 'pricing' ? r.url().includes('/api/pricing-bundle?method=EMB&styleNumber=PC54') : r.url().includes('/api/sanmar/inventory/PC54'));
    release(); await (await done).finished(); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.locator('.vq-line-title')).toContainText('Synthetic Hoodie'); await expect(page.locator('.vq-line-stock')).toContainText('88 total');
    clean(events);
});

for (const part of ['pricing', 'inventory']) test('CSS staff toolkit: volume ' + part + ' failure stays visible and retries in the affected row', async ({ page }) => {
    let failed = true;
    const events = await open(page, 'volume-quote', { respond: async u => {
        if (failed && u.pathname === (part === 'pricing' ? '/api/pricing-bundle' : '/api/sanmar/inventory/PC54')) return { json: {} };
    } });
    await page.locator('.vq-line-style').fill('PC54'); await page.locator('.vq-line-style').press('Tab'); await page.locator('.vq-line-qty').fill('500');
    const retry = page.getByRole('button', { name: part === 'pricing' ? 'Retry pricing' : 'Retry stock for PC54', exact: true });
    await expect(retry).toBeVisible();
    if (part === 'pricing') await expect(page.locator('#vq-result tbody tr')).toHaveCount(0);
    else { await expect(page.locator('.vq-line-stock')).toContainText('stock check failed'); await expect(page.locator('.vq-line-stock')).not.toContainText('0 total'); }
    await page.setViewportSize({ width: 320, height: 1000 }); await axe(page);
    failed = false; await retry.click();
    await expect(page.locator('.vq-line-title')).toContainText('Synthetic Cotton Tee'); await expect(page.locator('.vq-line-stock')).toContainText('1,500 total');
    await expect(page.locator('#vq-result tbody tr')).toHaveCount(1); clean(events);
});

for (const action of ['clear', 'remove']) test('CSS staff toolkit: volume inventory finishing after a row is ' + (action === 'clear' ? 'cleared' : 'removed') + ' causes no error or phantom prices', async ({ page }) => {
    let release, started;
    const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const events = await open(page, 'volume-quote', { respond: async u => { if (u.pathname === '/api/sanmar/inventory/PC54') { started(); await gate; return { json: { inventory: [], grandTotal: 0 } }; } } });
    await page.locator('.vq-line-style').fill('PC54'); await page.locator('.vq-line-style').press('Tab'); await requested;
    await page.locator('.vq-line-qty').fill('500');
    if (action === 'clear') { await page.locator('.vq-line-style').fill(''); await page.locator('.vq-line-style').press('Tab'); }
    else await page.getByRole('button', { name: 'Remove this style', exact: true }).click();
    const done = page.waitForResponse(r => r.url().includes('/api/sanmar/inventory/PC54')); release(); await (await done).finished();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.locator('#vq-result tbody tr')).toHaveCount(0); clean(events);
});

test('CSS staff toolkit: pending volume save holds quote controls and ignores duplicate activation', async ({ page }) => {
    let release, started;
    const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const events = await open(page, 'volume-quote', { respondWrite: async req => {
        if (new URL(req.url()).pathname === '/api/quote-sequence/VQ') { started(); await gate; return { json: { prefix: 'VQ', year: 2026, sequence: 901 } }; }
        return { json: { success: true } };
    } });
    await populateVolume(page); await page.locator('#vq-save').click(); await requested;
    try {
        for (const selector of ['#vq-customer', '#vq-rep', '#vq-location', '.vq-line-qty', '#vq-save', '#vq-add-line']) await expect(page.locator(selector)).toBeDisabled();
        await page.locator('#vq-save').dispatchEvent('click'); expect(events.writes).toHaveLength(1);
    } finally { release(); }
    await expect(page.locator('#vq-save-status')).toContainText('Saved as VQ-2026-901');
    await expect(page.locator('#vq-customer')).toBeEnabled(); await expect(page.locator('#vq-save')).toBeEnabled();
    expect(events.writes).toEqual(require('../fixtures/staff-toolkit-volume-original-workflow.json').writes);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

for (const failure of ['sequence', 'session', 'item']) test('CSS staff toolkit: volume ' + failure + ' save failure reports what can be confirmed', async ({ page }) => {
    const events = await open(page, 'volume-quote', { respondWrite: async req => {
        const p = new URL(req.url()).pathname;
        if (p === '/api/quote-sequence/VQ') return { json: failure === 'sequence' ? {} : { prefix: 'VQ', year: 2026, sequence: 901 } };
        if ((failure === 'session' && p === '/api/quote_sessions') || (failure === 'item' && p === '/api/quote_items')) return { status: 503, json: { error: 'Synthetic save failure' } };
        return { json: { success: true } };
    } });
    await populateVolume(page); await page.locator('#vq-save').click();
    if (failure === 'sequence') { await expect(page.locator('#vq-save-status')).toContainText('Quote number response incomplete'); expect(events.writes).toHaveLength(1); }
    else { await expect(page.locator('#vq-save-status')).toContainText('Check Quote Management before retrying'); await expect(page.locator('#vq-save-status')).not.toContainText('Not saved'); expect(events.writes).toHaveLength(failure === 'session' ? 2 : 3); }
    await expect(page.locator('#vq-save')).toBeEnabled(); await expect(page.locator('#vq-customer')).toBeEnabled();
    await page.setViewportSize({ width: 320, height: 1000 }); await axe(page);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: original product editor preserves fixed pricing and legacy vendor payloads', async ({ page }) => {
    const products = data.products.map(p => ({ ...p })); products[1].VendorCode = 'LEGACY-SUPPLIER';
    const events = await open(page, 'product-manager', { original: true, respond: async u => u.pathname === '/api/non-sanmar-products' ? { json: { data: products } } : undefined, respondWrite: async () => ({ json: { success: true } }) });
    await expect(page.locator('.pm-table tbody tr')).toHaveCount(3);
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click();
    await expect(page.locator('#fName')).toBeFocused(); await expect(page.locator('#fStyle')).toBeDisabled();
    await expect(page.locator('#fPricingMethod')).toHaveValue('FixedPrice'); await expect(page.locator('#fSell')).toHaveValue('14');
    await expect(page.locator('#fVendorSelect')).toHaveValue('__other'); await expect(page.locator('#fVendor')).toHaveValue('LEGACY-SUPPLIER');
    const fields = await page.locator('#pmForm input,#pmForm select,#pmForm textarea').evaluateAll(ns => ns.map(n => ({ id: n.id, value: n.value, checked: n.checked, disabled: n.disabled })));
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await page.locator('#pmFormCard').screenshot({ path: path.join(output, 'staff-toolkit-product-original-edit-' + width + '.png') }); }
    await page.locator('#pmSaveBtn').click(); await expect(page.locator('#pmFormCard')).toBeHidden();
    expect(events.writes.map(w => [w.method, w.path])).toEqual([['PUT', '/api/non-sanmar-products/99602']]);
    fs.writeFileSync(path.join(output, 'staff-toolkit-product-original-workflow.json'), JSON.stringify({ fields, writes: events.writes }, null, 2) + '\n');
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: product catalog keeps every original row and readable status at four widths', async ({ page }) => {
    const events = await open(page, 'product-manager'); await expect(page.locator('.pm-table tbody tr')).toHaveCount(3);
    const original = baseline.find(r => r.tool === 'product-manager').states[0].tables;
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await tables(page)).toEqual(original); await axe(page);
        await page.screenshot({ path: path.join(output, 'staff-toolkit-product-manager-' + width + '.png'), fullPage: true });
    }
    const region = page.getByRole('region', { name: 'Product catalog' }); await region.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.pdf({ path: path.join(output, 'staff-toolkit-product-catalog.pdf'), printBackground: true, preferCSSPageSize: true });
    clean(events);
});

test('CSS staff toolkit: product editor preserves original fixed pricing, vendor fields and save payload', async ({ page }) => {
    const products = data.products.map(p => ({ ...p })); products[1].VendorCode = 'LEGACY-SUPPLIER';
    const events = await open(page, 'product-manager', { respond: async u => u.pathname === '/api/non-sanmar-products' ? { json: { data: products } } : undefined, respondWrite: async () => ({ json: { success: true } }) });
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click(); await expect(page.locator('#fName')).toBeFocused();
    const original = require('../fixtures/staff-toolkit-product-original-workflow.json');
    expect(await page.locator('#pmForm input,#pmForm select,#pmForm textarea').evaluateAll(ns => ns.map(n => ({ id: n.id, value: n.value, checked: n.checked, disabled: n.disabled })))).toEqual(original.fields);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.locator('#pmFormCard').screenshot({ path: path.join(output, 'staff-toolkit-product-edit-' + width + '.png') });
    }
    await page.locator('#pmSaveBtn').click(); await expect(page.locator('#pmFormCard')).toBeHidden(); expect(events.writes).toEqual(original.writes);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: product list distinguishes pending, malformed, empty and filtered recovery states', async ({ page }) => {
    let release; const gate = new Promise(r => { release = r; }); let mode = 'pending';
    const events = await open(page, 'product-manager', { respond: async u => {
        if (u.pathname !== '/api/non-sanmar-products') return;
        if (mode === 'pending') { await gate; return { json: {} }; }
        return mode === 'empty' ? { json: { data: [] } } : { json: { data: data.products } };
    } });
    try {
        await expect(page.locator('#content-root')).toContainText('Loading products'); await expect(page.locator('#stat-total')).toHaveText('—');
        await page.locator('#pmFilter').fill('CAP'); await expect(page.locator('#content-root')).toContainText('Loading products');
    } finally { release(); }
    await expect(page.locator('#pmRetry')).toBeVisible(); await expect(page.locator('#content-root')).toContainText('response incomplete');
    await page.locator('#pmFilter').fill('TEE'); await expect(page.locator('#pmRetry')).toBeVisible(); await axe(page);
    mode = 'ready'; await page.locator('#pmRetry').click(); await expect(page.locator('.pm-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.pm-table')).toContainText('REVIEW-TEE'); await expect(page.locator('#stat-total')).toHaveText('3');
    await expect(page.locator('.dash-error-banner')).toBeHidden();
    mode = 'empty'; await page.reload(); await expect(page.locator('#content-root')).toContainText('No non-SanMar products yet');
    await expect(page.locator('#stat-total')).toHaveText('0'); clean(events);
});

test('CSS staff toolkit: product edit preserves a stored category outside the curated options', async ({ page }) => {
    const products = data.products.map(p => ({ ...p })); products[0].Category = 'Jackets';
    const events = await open(page, 'product-manager', { respond: async u => u.pathname === '/api/non-sanmar-products' ? { json: { data: products } } : undefined, respondWrite: async () => ({ json: { success: true } }) });
    await page.getByRole('button', { name: 'Edit REVIEW-TEE', exact: true }).click();
    await expect(page.locator('#fCategory')).toHaveValue('Jackets'); await page.locator('#pmSaveBtn').click();
    await expect(page.locator('#pmFormCard')).toBeHidden(); expect(JSON.parse(events.writes[0].body).Category).toBe('Jackets');
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click();
    await expect(page.locator('#fCategory')).toHaveValue('Caps'); await expect(page.locator('#fCategory [data-stored-category]')).toHaveCount(0);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: a saved product with a failed list refresh reports catalog recovery without another save', async ({ page }) => {
    let saved = false;
    const events = await open(page, 'product-manager', {
        respond: async u => u.pathname === '/api/non-sanmar-products' && saved ? { status: 503, json: { error: 'Synthetic catalog offline' } } : undefined,
        respondWrite: async () => { saved = true; return { json: { success: true } }; }
    });
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click(); await page.locator('#pmSaveBtn').click();
    await expect(page.locator('#pmFormCard')).toBeHidden(); await expect(page.locator('#pmRetry')).toBeVisible();
    await expect(page.locator('.dash-error-banner')).toContainText('Unable to load products'); await expect(page.locator('#stat-total')).toHaveText('—');
    await page.locator('#pmFilter').fill('CAP'); await expect(page.locator('#pmRetry')).toBeVisible();
    saved = false; await page.locator('#pmRetry').click(); await expect(page.locator('.pm-table tbody tr')).toHaveCount(1);
    expect(events.writes).toHaveLength(1); expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});

test('CSS staff toolkit: product upload holds its original editor and submits one captured product', async ({ page }) => {
    let release, started; const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const events = await open(page, 'product-manager', { respondWrite: async req => {
        if (new URL(req.url()).pathname === '/api/files/upload') { started(); await gate; return { json: { externalKey: 'synthetic-review-image.png' } }; }
        return { json: { success: true } };
    } });
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click();
    await page.locator('#fImageFile').setInputFiles({ name: 'synthetic-review-image.png', mimeType: 'image/png', buffer: Buffer.from('synthetic upload bytes') });
    await page.locator('#pmSaveBtn').click(); await requested;
    try {
        await expect(page.locator('#fName')).toBeDisabled(); await expect(page.locator('#pmFormClose')).toBeDisabled(); await expect(page.locator('#pmAddBtn')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Edit REVIEW-TEE', exact: true })).toBeDisabled();
        await page.locator('#pmForm').evaluate(form => { document.getElementById('fName').value = 'Late script change'; document.getElementById('fId').value = '99999'; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        expect(events.writes).toHaveLength(1);
    } finally { release(); }
    await expect(page.locator('#pmFormCard')).toBeHidden(); await expect(page.locator('#pmAddBtn')).toBeEnabled();
    expect(events.writes.map(w => [w.method, w.path])).toEqual([['POST', '/api/files/upload'], ['PUT', '/api/non-sanmar-products/99602']]);
    const payload = JSON.parse(events.writes[1].body); expect(payload.ProductName).toBe(data.products[1].ProductName); expect(payload.ImageURL).toMatch(/\/api\/files\/synthetic-review-image\.png$/);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: product upload and save failures retain editable values without a false success', async ({ page }) => {
    let uploadFails = true;
    const events = await open(page, 'product-manager', { respondWrite: async req => {
        if (new URL(req.url()).pathname === '/api/files/upload') return uploadFails ? { status: 503, json: { error: 'Synthetic image upload unavailable' } } : { json: { externalKey: 'synthetic-review-image.png' } };
        return { status: 503, json: { error: 'Synthetic product service unavailable' } };
    } });
    await page.getByRole('button', { name: 'Edit REVIEW-CAP', exact: true }).click();
    await page.locator('#fImageFile').setInputFiles({ name: 'synthetic-review-image.png', mimeType: 'image/png', buffer: Buffer.from('synthetic upload bytes') });
    await page.locator('#pmSaveBtn').click(); await expect(page.locator('.dash-error-banner')).toContainText('Synthetic image upload unavailable');
    await expect(page.locator('#pmFormCard')).toBeVisible(); await expect(page.locator('#fName')).toBeEnabled(); await expect(page.locator('#fStyle')).toBeDisabled();
    expect(events.writes).toHaveLength(1); uploadFails = false; await page.locator('#pmSaveBtn').click();
    await expect(page.locator('.dash-error-banner')).toContainText('Check the catalog before retrying'); await expect(page.locator('#fName')).toHaveValue(data.products[1].ProductName);
    await expect(page.locator('#pmSaveBtn')).toBeEnabled(); await expect(page.locator('#fStyle')).toBeDisabled(); expect(events.writes).toHaveLength(3);
    await axe(page); expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});

function blogReviewState(posts = data.posts.map(p => ({ ...p }))) {
    return {
        respond: async u => u.pathname === '/api/crm-proxy/blog-posts' ? { json: { posts } } :
            u.pathname.startsWith('/api/crm-proxy/blog-posts/') ? { json: { post: posts.find(p => u.pathname.endsWith('/' + p.slug)) } } : undefined,
        respondWrite: async req => {
            const p = new URL(req.url()).pathname, body = JSON.parse(req.postData() || '{}');
            if (p === '/api/blog-preview') return { json: { html: require('../../lib/blog').renderMarkdown(body.markdown) } };
            if (p.startsWith('/api/crm-proxy/blog-posts')) {
                let post = posts.find(pst => p.endsWith('/' + pst.slug));
                if (post) Object.assign(post, body); else { post = { ...body }; posts.push(post); }
                if (post.status === 'Published') post.publishedAt = data.fixed;
                return { json: { success: true } };
            }
            return { status: 503, json: { error: 'Unmapped synthetic blog write' } };
        }
    };
}
const blogWrites = events => events.writes.filter(w => w.path !== '/api/blog-preview');
async function blogFields(page) { return page.locator('#editorView input,#editorView textarea').evaluateAll(ns => ns.map(n => ({ id: n.id, value: n.value, disabled: n.disabled }))); }

test('CSS staff toolkit: original blog workflow preserves draft payloads and permanent published URLs', async ({ page }) => {
    const state = blogReviewState(), events = await open(page, 'blog-editor', { ...state, original: true });
    await page.locator('[data-slug="synthetic-team-guide-0"]').click(); await expect(page.locator('#previewPane')).toContainText('Synthetic team guide');
    const fields = await blogFields(page), preview = await page.locator('#previewPane').innerHTML();
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await page.screenshot({ path: path.join(output, 'staff-toolkit-blog-original-editor-' + width + '.png'), fullPage: true }); }
    await page.locator('#fldTitle').fill('Synthetic updated team guide'); await page.locator('#saveDraftBtn').click();
    await expect(page.locator('#saveState')).toHaveText('Draft'); await page.locator('#backToListBtn').click();
    await page.locator('[data-slug="synthetic-team-guide-1"]').click(); await expect(page.locator('#fldSlug')).toBeDisabled();
    const published = await blogFields(page);
    fs.writeFileSync(path.join(output, 'staff-toolkit-blog-original-workflow.json'), JSON.stringify({ fields, preview, published, writes: blogWrites(events) }, null, 2) + '\n');
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: blog list and editor preserve original fields, previews and saves at four widths', async ({ page }) => {
    const events = await open(page, 'blog-editor', blogReviewState()), original = require('../fixtures/staff-toolkit-blog-original-workflow.json');
    await expect(page.locator('.be-list-row')).toHaveCount(2);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.screenshot({ path: path.join(output, 'staff-toolkit-blog-list-' + width + '.png'), fullPage: true });
    }
    await page.locator('[data-slug="synthetic-team-guide-0"]').click(); await expect(page.locator('#fldTitle')).toBeFocused();
    await expect(page.locator('#previewPane')).toContainText('Synthetic team guide');
    expect(await blogFields(page)).toEqual(original.fields); expect(await page.locator('#previewPane').innerHTML()).toBe(original.preview);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.screenshot({ path: path.join(output, 'staff-toolkit-blog-editor-' + width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.pdf({ path: path.join(output, 'staff-toolkit-blog-editor.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.locator('#fldTitle').fill('Synthetic updated team guide'); await page.locator('#saveDraftBtn').click();
    await expect(page.locator('#saveState')).toHaveText('Draft'); expect(blogWrites(events)).toEqual(original.writes);
    await page.locator('#backToListBtn').click(); await page.locator('[data-slug="synthetic-team-guide-1"]').click();
    await expect(page.locator('#fldSlug')).toBeDisabled(); expect(await blogFields(page)).toEqual(original.published);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]); expect(events.missing).toEqual([]);
});

test('CSS staff toolkit: blog native image controls and formatting work with the keyboard', async ({ page }) => {
    const events = await open(page, 'blog-editor', blogReviewState());
    await page.locator('#newPostBtn').click(); await page.locator('#fldTitle').fill('Synthetic keyboard review');
    await expect(page.locator('#fldSlug')).toHaveValue('synthetic-keyboard-review');
    await page.getByRole('button', { name: 'Bold', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.locator('#fldBody')).toHaveValue('**bold text**');
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Upload image', exact: true }).focus(); await page.keyboard.press('Enter');
    expect((await chooser).isMultiple()).toBe(false);
    expect(blogWrites(events)).toEqual([]); expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});

test('CSS staff toolkit: blog preview ignores an older render after the text changes', async ({ page }) => {
    let release, started; const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const state = blogReviewState(), normal = state.respondWrite;
    state.respondWrite = async req => {
        if (new URL(req.url()).pathname === '/api/blog-preview' && JSON.parse(req.postData()).markdown === 'First pending paragraph') { started(); await gate; }
        return normal(req);
    };
    const events = await open(page, 'blog-editor', state); await page.locator('#newPostBtn').click();
    await page.locator('#fldBody').fill('First pending paragraph'); await requested;
    try {
        await page.locator('#fldBody').fill('Latest paragraph'); await expect(page.locator('#previewPane')).toContainText('Latest paragraph');
    } finally { release(); }
    await expect(page.locator('#previewPane')).toContainText('Latest paragraph'); await page.waitForTimeout(100);
    await expect(page.locator('#previewPane')).not.toContainText('First pending paragraph'); expect(blogWrites(events)).toEqual([]); expect(events.errors).toEqual([]);
});

test('CSS staff toolkit: a late blog read cannot replace a newly started post', async ({ page }) => {
    let release, started; const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const state = blogReviewState(), normal = state.respond;
    state.respond = async u => { if (u.pathname.endsWith('/synthetic-team-guide-0')) { started(); await gate; } return normal(u); };
    const events = await open(page, 'blog-editor', state);
    await page.locator('[data-slug="synthetic-team-guide-0"]').click(); await requested;
    try { await page.locator('#newPostBtn').click(); await page.locator('#fldTitle').fill('Newest unsaved draft'); } finally { release(); }
    await page.waitForTimeout(100); await expect(page.locator('#fldTitle')).toHaveValue('Newest unsaved draft');
    await expect(page.locator('#fldSlug')).toHaveValue('newest-unsaved-draft'); expect(blogWrites(events)).toEqual([]); expect(events.errors).toEqual([]);
});

test('CSS staff toolkit: blog save holds the editor and rejects duplicate publish requests', async ({ page }) => {
    let release, started; const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const state = blogReviewState(), normal = state.respondWrite;
    state.respondWrite = async req => { if (new URL(req.url()).pathname.startsWith('/api/crm-proxy/blog-posts')) { started(); await gate; } return normal(req); };
    const events = await open(page, 'blog-editor', state);
    await page.locator('[data-slug="synthetic-team-guide-0"]').click(); await page.locator('#publishBtn').click(); await requested;
    try {
        await expect(page.locator('#fldTitle')).toBeDisabled(); await expect(page.locator('#backToListBtn')).toBeDisabled(); await expect(page.locator('#saveDraftBtn')).toBeDisabled();
        await page.locator('#publishBtn').evaluate(btn => btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))); expect(blogWrites(events)).toHaveLength(1);
    } finally { release(); }
    await expect(page.locator('#saveState')).toHaveText('Published'); await expect(page.locator('#fldTitle')).toBeEnabled(); await expect(page.locator('#fldSlug')).toBeDisabled();
    expect(blogWrites(events)).toHaveLength(1); expect(JSON.parse(blogWrites(events)[0].body).status).toBe('Published'); expect(events.errors).toEqual([]);
});

test('CSS staff toolkit: blog list and editor reject incomplete replies with usable retry', async ({ page }) => {
    let malformedList = true, malformedPost = true;
    const state = blogReviewState(), normal = state.respond;
    state.respond = async u => {
        if (u.pathname === '/api/crm-proxy/blog-posts' && malformedList) return { json: {} };
        if (u.pathname.endsWith('/synthetic-team-guide-0') && malformedPost) return { json: { post: {} } };
        return normal(u);
    };
    const events = await open(page, 'blog-editor', state); await expect(page.locator('#postListRetry')).toBeVisible();
    malformedList = false; await page.locator('#postListRetry').click(); await expect(page.locator('.be-list-row')).toHaveCount(2);
    await page.locator('[data-slug="synthetic-team-guide-0"]').click(); await expect(page.locator('.dash-error-banner')).toContainText('Could not open');
    await expect(page.locator('#editorView')).toBeHidden(); malformedPost = false; await page.locator('[data-slug="synthetic-team-guide-0"]').click();
    await expect(page.locator('#fldTitle')).toHaveValue(data.posts[0].title); await expect(page.locator('.dash-error-banner')).toBeHidden();
    expect(blogWrites(events)).toEqual([]); expect(events.errors).toEqual([]);
});

test('CSS staff toolkit: saved blog content remains saved when the canonical reload fails', async ({ page }) => {
    let saved = false;
    const state = blogReviewState(), read = state.respond, write = state.respondWrite;
    state.respond = async u => saved && u.pathname.startsWith('/api/crm-proxy/blog-posts/') ? { status: 503, json: { error: 'Synthetic refresh unavailable' } } : read(u);
    state.respondWrite = async req => { const r = await write(req); if (new URL(req.url()).pathname.startsWith('/api/crm-proxy/blog-posts')) saved = true; return r; };
    const events = await open(page, 'blog-editor', state); await page.locator('[data-slug="synthetic-team-guide-0"]').click();
    await page.locator('#publishBtn').click(); await expect(page.locator('.dash-error-banner')).toContainText('Saved, but could not reload');
    await expect(page.locator('#fldTitle')).toHaveValue(data.posts[0].title); await expect(page.locator('#fldSlug')).toBeDisabled();
    await expect(page.locator('#saveState')).toContainText('Published'); expect(blogWrites(events)).toHaveLength(1); expect(events.errors).toEqual([]);
});

test('CSS staff toolkit: blog image upload holds the post and preserves its original upload contract', async ({ page }) => {
    let release, started; const gate = new Promise(r => { release = r; }), requested = new Promise(r => { started = r; });
    const state = blogReviewState(), normal = state.respondWrite;
    state.respondWrite = async req => {
        if (new URL(req.url()).pathname === '/api/image-uploads') { started(); await gate; return { json: { image: { url: '/favicon.png' } } }; }
        return normal(req);
    };
    const events = await open(page, 'blog-editor', state); await page.locator('[data-slug="synthetic-team-guide-0"]').click();
    await page.locator('#fldHeroFile').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic image') }); await requested;
    try { await expect(page.locator('#publishBtn')).toBeDisabled(); await expect(page.locator('#fldTitle')).toBeDisabled(); await expect(page.locator('#backToListBtn')).toBeDisabled(); } finally { release(); }
    await expect(page.locator('#fldHeroUrl')).toHaveValue('/favicon.png'); await expect(page.locator('#heroPreview')).toBeVisible(); await expect(page.locator('#publishBtn')).toBeEnabled();
    const writes = blogWrites(events); expect(writes).toHaveLength(1); expect(writes[0].body).toContain('name="description"'); expect(writes[0].body).toContain('Blog image — ' + data.posts[0].title);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});

test('CSS staff toolkit: blog failures keep the draft and recover preview, upload and save separately', async ({ page }) => {
    let mode = 'preview-fail'; const state = blogReviewState(), normal = state.respondWrite;
    state.respondWrite = async req => {
        const p = new URL(req.url()).pathname;
        if (p === '/api/blog-preview' && mode === 'preview-fail') return { json: {} };
        if (p === '/api/image-uploads') return { status: 503, json: { error: 'Synthetic upload unavailable' } };
        if (p.startsWith('/api/crm-proxy/blog-posts')) return { status: 503, json: { error: 'Synthetic save unavailable' } };
        return normal(req);
    };
    const events = await open(page, 'blog-editor', state); await page.locator('[data-slug="synthetic-team-guide-0"]').click();
    await expect(page.locator('#previewPane')).toContainText('Preview unavailable'); await expect(page.locator('#fldBody')).toHaveValue(data.posts[0].bodyMarkdown);
    mode = 'ready'; await page.locator('#fldBody').fill('Recovered synthetic preview'); await expect(page.locator('#previewPane')).toHaveText('Recovered synthetic preview');
    await page.locator('#fldHeroFile').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('synthetic image') });
    await expect(page.locator('.dash-error-banner')).toContainText('Image upload failed'); await expect(page.locator('#fldTitle')).toBeEnabled();
    await page.locator('#saveDraftBtn').click(); await expect(page.locator('.dash-error-banner')).toContainText('Could not confirm the save');
    await expect(page.locator('#fldBody')).toHaveValue('Recovered synthetic preview'); await expect(page.locator('#saveDraftBtn')).toBeEnabled();
    await axe(page); expect(blogWrites(events).map(w => w.path)).toEqual(['/api/image-uploads', '/api/crm-proxy/blog-posts/synthetic-team-guide-0']);
    expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});

test('CSS staff toolkit: long blog preview stays scrollable and prints every section', async ({ page }) => {
    const posts = data.posts.map(p => ({ ...p }));
    posts[0].bodyMarkdown = Array.from({ length: 24 }, (_, i) => '## Review section ' + (i + 1) + '\n\nSynthetic paragraph ' + (i + 1) + ': choose comfortable apparel, preserve the artwork, check the sizes and confirm every quantity before production.').join('\n\n') +
        '\n\n| Style | Quantity | Note |\n| --- | --- | --- |\n| REVIEW-TEE | 48 | Final review row |\n\n> Synthetic closing quotation.\n\n~~~text\nSyntheticCodeLine_End\n~~~\n\n[Review link](/pages/contact.html)';
    const events = await open(page, 'blog-editor', blogReviewState(posts)); await page.locator('[data-slug="synthetic-team-guide-0"]').click();
    await expect(page.locator('#previewPane h2')).toHaveCount(24); await page.setViewportSize({ width: 320, height: 800 });
    const pane = page.getByRole('region', { name: 'Post preview' }); await pane.focus(); await page.keyboard.press('End'); await expect.poll(() => pane.evaluate(n => n.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320); await axe(page);
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.pdf({ path: path.join(output, 'staff-toolkit-blog-long.pdf'), printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(output, 'staff-toolkit-blog-long-expected.json'), JSON.stringify({ post: posts[0], renderedText: await pane.innerText() }, null, 2) + '\n');
    await expect(page.locator('#fldBody')).toHaveValue(posts[0].bodyMarkdown); expect(blogWrites(events)).toEqual([]); expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});
