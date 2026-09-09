const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/product-detail-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true }); test.use({ reducedMotion: 'reduce' });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="600"><rect width="500" height="600" fill="#f3f4f6"/><path d="M140 95 L60 180 L115 270 L150 245 L150 505 L350 505 L350 245 L385 270 L440 180 L360 95 L310 75 Q250 140 190 75Z" fill="#d86a19"/><text x="250" y="550" font-size="25" text-anchor="middle">SYNTHETIC PRODUCT</text></svg>';
async function open(page, state = {}) {
    const events = { errors: [], writes: [], unmocked: [], missingAssets: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(() => {
        sessionStorage.setItem('sampleCart', JSON.stringify({ samples: [{ style: 'PC54' }, { style: 'PC61' }] }));
        window.__copies = []; window.__clipboardFailure = false;
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { if (window.__clipboardFailure) throw new Error('Denied'); window.__copies.push(text); } } });
        window.print = () => { window.__printRequested = true; };
    });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) { events.writes.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname.endsWith('/product-details')) {
            const style = u.searchParams.get('styleNumber'); const failed = state.failedStyle === style;
            return route.fulfill({ status: failed ? 503 : (state.productStatus || 200), json: state.products ?? fixture.products.map(p => ({ ...p, STYLE: style })) });
        }
        if (u.pathname === '/api/sizes-by-style-color') {
            const color = u.searchParams.get('color'); if (state.delayNavy && color === 'Navy') await state.delayNavy;
            return route.fulfill({ status: state.stockStatus || 200, json: state.stock ?? { ...fixture.stock, color } });
        }
        if (u.pathname.startsWith('/api/sanmar/catalog-color-audit/')) return route.fulfill({ status: state.auditStatus || 200, json: state.audit ?? fixture.audit });
        if (u.pathname === '/api/stylesearch') {
            const term = u.searchParams.get('term'); if (state.delaySearch && term === 'PC') await state.delaySearch;
            return route.fulfill({ status: state.searchStatus || 200, json: state.search ?? [{ value: term === 'CT' ? 'CTK87' : 'PC61', label: term === 'CT' ? 'Cotton Work Tee' : 'Cotton Crew' }] });
        }
        if (u.pathname.startsWith('/product-detail-review/')) return route.fulfill(state.imageFailure && u.pathname.includes('tee-') ? { status: 503 } : { contentType: 'image/svg+xml', body: svg });
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (['/product.html', '/inventory-details.html', '/embroidery-pricing.html', '/screen-print-pricing.html', '/dtg-pricing.html', '/dtf-pricing.html', '/cap-embroidery-pricing-integrated.html'].includes(u.pathname)) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Product destination</title>' });
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missingAssets.push(u.pathname); return route.fulfill({ status: 404 }); }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    const tool = state.tool || 'dtg-compatible-products';
    await page.goto('/pages/' + tool + '.html' + (tool === 'inventory-details' ? '?style=PC54&color=BrillOrng' : '')); await page.evaluate(() => document.fonts.ready); return events;
}
const clean = events => expect(events).toEqual({ errors: [], writes: [], unmocked: [], missingAssets: [] });
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function widths(page, name) {
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'product-detail-' + name + '-' + width + '.png'), fullPage: true }); }
}
test('CSS product details: discovery preserves eleven styles, cart count and keyboard destination at four widths', async ({ page }) => {
    const events = await open(page); await expect(page.locator('.product-card')).toHaveCount(11);
    expect(await page.locator('.product-style').allTextContents()).toEqual(['PC54', 'PC450', 'PC61', 'PC78H', 'PC55', 'PC61LS', 'PC600', 'PC90H', 'BC3001', 'PC54LS', 'CTK87'].map(s => 'Style #' + s));
    await expect(page.locator('.cart-indicator')).toHaveAttribute('href', '/pages/sample-cart.html'); await expect(page.locator('.cart-count-badge')).toHaveText('2');
    await widths(page, 'discovery'); await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#product-detail-main')).toBeFocused();
    await page.locator('.product-card').first().focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/product\.html\?style=PC54$/); clean(events);
});
test('CSS product details: sample button opens the product without adding an order', async ({ page }) => {
    const events = await open(page); await page.locator('.btn-sample[data-style="CTK87"]').focus(); await page.keyboard.press('Space'); await expect(page).toHaveURL(/\/product\.html\?style=CTK87$/); clean(events);
});
for (const [label, state] of [['failed', { productStatus: 503 }], ['malformed', { products: {} }], ['partial', { failedStyle: 'PC54' }]]) test('CSS product details: ' + label + ' discovery results show a working retry', async ({ page }) => {
    const events = await open(page, state); await expect(page.locator('#dtg-retry')).toBeVisible(); await expect(page.locator('.product-card')).toHaveCount(label === 'partial' ? 10 : 0); await axe(page);
    state.productStatus = 200; state.products = fixture.products; state.failedStyle = null; await page.locator('#dtg-retry').click(); await expect(page.locator('.product-card')).toHaveCount(11); await expect(page.locator('#dtg-retry')).toHaveCount(0); clean(events);
});
test('CSS product details: a valid empty discovery result is distinct from failure', async ({ page }) => {
    const events = await open(page, { products: [] }); await expect(page.locator('.product-empty')).toContainText('No DTG-compatible products'); await expect(page.locator('#dtg-retry')).toHaveCount(0); clean(events);
});
test('CSS product details: unavailable product images preserve accessible destinations', async ({ page }) => {
    const events = await open(page, { imageFailure: true }); await expect(page.locator('.image-unavailable')).toHaveCount(11); await expect(page.locator('.product-card')).toHaveCount(11); await axe(page); clean(events);
});
test('CSS product details: inventory preserves warehouse quantities, totals and stock thresholds at four widths', async ({ page }) => {
    const events = await open(page, { tool: 'inventory-details' }); await expect(page.locator('.inventory-table')).toBeVisible();
    expect(await page.locator('.inventory-table tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.textContent)))).toEqual([['Seattle', '1', '23', '24', '100', '0', '6', '154'], ['Reno', '2', '0', '50', '200', '7', '0', '259']]);
    expect(await page.locator('.inventory-table tfoot td').allTextContents()).toEqual(['TOTAL', '3', '23', '74', '300', '7', '6', '413']);
    await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveClass(/stock-low/); await expect(page.locator('tbody tr').first().locator('td').nth(3)).toHaveClass(/stock-good/);
    await widths(page, 'inventory'); const scroll = page.getByRole('region', { name: 'Warehouse inventory by size' }); await scroll.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(() => scroll.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    await page.locator('.color-option[data-color="Navy"]').focus(); await page.keyboard.press('Enter'); await expect(page.locator('.inventory-color')).toHaveText('Color: Navy'); await expect(page.locator('#back-to-product')).toHaveAttribute('href', '/product.html?StyleNumber=PC54&COLOR=Navy'); clean(events);
});
test('CSS product details: catalog-size placeholders are never presented as out of stock', async ({ page }) => {
    const events = await open(page, { tool: 'inventory-details', stock: { ...fixture.stock, source: 'sanmar-bulk', warehouses: [], sizeTotals: [0, 0, 0, 0, 0, 0], grandTotal: 0 } }); await expect(page.locator('.inventory-unavailable')).toContainText('Stock quantities were not supplied'); await expect(page.locator('.inventory-unavailable')).toContainText('S, M, L, XL, 2XL, 3XL'); await expect(page.locator('.stock-out,.inventory-table')).toHaveCount(0); await axe(page); clean(events);
});
for (const [label, stockStatus, stock] of [['failed', 503, {}], ['malformed', 200, {}]]) test('CSS product details: ' + label + ' inventory clears old quantities and recovers', async ({ page }) => {
    const state = { tool: 'inventory-details', stockStatus, stock }, events = await open(page, state); await expect(page.locator('.inventory-error')).toBeVisible(); await expect(page.locator('.inventory-table')).toHaveCount(0); await axe(page);
    state.stockStatus = 200; state.stock = fixture.stock; await page.locator('.inventory-error button').click(); await expect(page.locator('.grand-total')).toHaveText('413'); clean(events);
});
test('CSS product details: missing product data has a working retry', async ({ page }) => {
    const state = { tool: 'inventory-details', productStatus: 503 }, events = await open(page, state); await expect(page.locator('.inventory-error')).toContainText('Failed to load product'); state.productStatus = 200; await page.locator('.inventory-error button').click(); await expect(page.locator('.grand-total')).toHaveText('413'); clean(events);
});
test('CSS product details: a late color response cannot replace the selected stock table', async ({ page }) => {
    let release; const state = { tool: 'inventory-details', delayNavy: new Promise(resolve => { release = resolve; }) }, events = await open(page, state);
    await expect(page.locator('.grand-total')).toHaveText('413'); await page.locator('[data-color="Navy"]').click(); await expect(page.locator('.inventory-table')).toHaveCount(0);
    await page.locator('[data-color="BrillOrng"]').click(); await expect(page.locator('.inventory-color')).toHaveText('Color: BrillOrng');
    const response = page.waitForResponse(r => r.url().includes('color=Navy')); release(); await response; await page.waitForTimeout(100); await expect(page.locator('.inventory-color')).toHaveText('Color: BrillOrng'); clean(events);
});
test('CSS product details: pricing disclosure preserves all five destinations', async ({ page }) => {
    const events = await open(page, { tool: 'inventory-details' }); await expect(page.locator('.grand-total')).toHaveText('413');
    expect(await page.locator('.dropdown-item').evaluateAll(nodes => nodes.map(n => n.dataset.pricing))).toEqual(['embroidery', 'screen-print', 'dtg', 'dtf', 'cap-embroidery']);
    await page.locator('.btn-pricing').click(); await expect(page.locator('#pricing-dropdown-menu')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#pricing-dropdown-menu')).toBeHidden();
    await page.locator('.btn-pricing').click(); await page.locator('[data-pricing="cap-embroidery"]').click(); await expect(page).toHaveURL(/\/cap-embroidery-pricing-integrated\.html\?StyleNumber=PC54&COLOR=BrillOrng$/); clean(events);
});
test('CSS product details: search keeps the latest query and keyboard navigation', async ({ page }) => {
    let release; const state = { tool: 'inventory-details', delaySearch: new Promise(resolve => { release = resolve; }) }, events = await open(page, state);
    await expect(page.locator('.grand-total')).toHaveText('413'); const request = page.waitForRequest(r => r.url().includes('term=PC')); await page.locator('#header-style-search').fill('PC'); await request;
    await page.locator('#header-style-search').fill('CT'); await expect(page.locator('.search-result-style')).toHaveText('CTK87');
    const response = page.waitForResponse(r => r.url().includes('term=PC')); release(); await response; await page.waitForTimeout(100); await expect(page.locator('.search-result-style')).toHaveText('CTK87'); await page.locator('.search-result-item').focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/inventory-details\.html\?style=CTK87$/); clean(events);
});
test('CSS product details: search failures remain visible and recover on a new query', async ({ page }) => {
    const state = { tool: 'inventory-details', searchStatus: 503 }, events = await open(page, state); await expect(page.locator('.grand-total')).toHaveText('413'); await page.locator('#header-style-search').fill('PC'); await expect(page.locator('.search-msg--error')).toBeVisible(); state.searchStatus = 200; await page.locator('#header-style-search').fill('CT'); await expect(page.locator('.search-result-style')).toHaveText('CTK87'); await page.locator('#header-style-search').press('Escape'); await expect(page.locator('#header-search-results')).toBeHidden(); clean(events);
});
test('CSS product details: audit counts, five tables and four copied outputs survive four widths', async ({ page }) => {
    const events = await open(page, { tool: 'sanmar-catalog-color-audit' }); await expect(page.locator('#summary')).toBeVisible(); expect(await page.locator('.summary .num').allTextContents()).toEqual(['1', '1', '1', '1', '1']); await widths(page, 'audit');
    for (const target of ['mismatch', 'drift', 'orphan', 'sanmaronly']) await page.locator('[data-target="' + target + '"]').click();
    expect(await page.evaluate(() => window.__copies)).toEqual(fixture.originalCopies); await expect(page.locator('.bucket:visible')).toHaveCount(5); clean(events);
});
for (const [label, auditStatus, audit] of [['failed', 503, {}], ['malformed', 200, {}]]) test('CSS product details: ' + label + ' audit hides prior results and can rerun', async ({ page }) => {
    const state = { tool: 'sanmar-catalog-color-audit' }, events = await open(page, state); await expect(page.locator('#summary')).toBeVisible();
    state.auditStatus = auditStatus; state.audit = audit; await page.locator('#run-btn').click(); await expect(page.locator('#run-status')).toHaveClass(/error/); await expect(page.locator('#summary')).toBeHidden(); await expect(page.locator('.bucket:visible')).toHaveCount(0); await axe(page);
    state.auditStatus = 200; state.audit = fixture.audit; await page.locator('#run-btn').click(); await expect(page.locator('#summary')).toBeVisible(); clean(events);
});
test('CSS product details: unavailable SanMar data is unknown while internal drift remains reviewable', async ({ page }) => {
    const events = await open(page, { tool: 'sanmar-catalog-color-audit', audit: { ...fixture.audit, sanmarApiError: 'Synthetic service outage', sanmarColors: 0 } });
    await expect(page.locator('#run-status')).toContainText('Only internal Caspio drift'); for (const id of ['sum-sync', 'sum-mismatch', 'sum-orphan', 'sum-sanmar-only']) await expect(page.locator('#' + id)).toHaveText('Unknown');
    await expect(page.locator('#bkt-drift')).toBeVisible(); await expect(page.locator('#bkt-orphan')).toBeHidden(); await page.locator('[data-target="drift"]').click(); expect(await page.evaluate(() => window.__copies)).toEqual([fixture.originalCopies[1]]); await axe(page); clean(events);
});
test('CSS product details: denied clipboard copy announces recovery without an unhandled error', async ({ page }) => {
    const events = await open(page, { tool: 'sanmar-catalog-color-audit' }); await expect(page.locator('#summary')).toBeVisible(); await page.evaluate(() => { window.__clipboardFailure = true; }); await page.locator('[data-target="mismatch"]').click(); await expect(page.locator('#run-status')).toContainText('Could not copy'); await page.evaluate(() => { window.__clipboardFailure = false; }); await page.locator('[data-target="mismatch"]').click(); expect(await page.evaluate(() => window.__copies)).toEqual([fixture.originalCopies[0]]); clean(events);
});
test('CSS product details: printable inventory keeps all warehouses and quantities', async ({ page }) => {
    const events = await open(page, { tool: 'inventory-details' }); await expect(page.locator('.grand-total')).toHaveText('413'); await page.locator('.print-inventory').click(); expect(await page.evaluate(() => window.__printRequested)).toBe(true); await page.emulateMedia({ media: 'print' }); await expect(page.locator('.inventory-table')).toBeVisible(); await expect(page.locator('.color-selector')).toBeHidden(); await page.pdf({ path: path.join(output, 'product-detail-inventory.pdf'), format: 'Letter', printBackground: true }); clean(events);
});
