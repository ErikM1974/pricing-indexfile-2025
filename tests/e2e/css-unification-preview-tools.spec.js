const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/preview-tools-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce' });
const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><path d="M50 230 L250 30 L450 230Z" fill="#111827"/></svg>';
const tumblerSvg = color => '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1800"><rect width="1800" height="1800" fill="white"/><path d="M520 180 L1280 180 L1150 1630 Q900 1730 650 1630Z" fill="' + color + '"/><ellipse cx="900" cy="180" rx="380" ry="90" fill="#c0c0c0"/></svg>';
async function open(page, state = {}) {
    const events = { errors: [], writes: [], unmocked: [] }; page.on('pageerror', e => events.errors.push(e.message));
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) { events.writes.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname === '/api/digitized-designs/lookup') return route.fulfill({ status: state.status || 200, json: state.data ?? fixture.design });
        if (u.pathname === '/api/jds-catalog') return route.fulfill({ status: state.status || 200, json: state.data ?? fixture.catalog });
        if (u.pathname.startsWith('/preview-review/') && u.pathname.includes('tumbler')) {
            if (state.delayBlack && u.pathname.includes('black')) await state.delayBlack;
            if (state.tumblerFailure) return route.fulfill({ status: 503 });
            return route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: tumblerSvg(u.pathname.includes('red') ? '#dc2626' : '#1f2937') });
        }
        if (u.pathname.startsWith('/preview-review/')) {
            if (state.imageFailure && u.pathname.includes('design.svg')) return route.fulfill({ status: 503, body: 'Image unavailable' });
            return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500"><rect width="600" height="500" fill="#2f6f43"/><text x="300" y="250" fill="white" text-anchor="middle" font-size="24">SYNTHETIC CREST</text></svg>' });
        }
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + (u.pathname === '/design/40121' ? '/pages/design-view.html' : u.pathname));
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    await page.goto(state.tool ? '/pages/' + state.tool + '.html' : '/design/40121'); await page.evaluate(() => document.fonts.ready); return events;
}
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
test('CSS preview tools: public gallery preserves private boundary at four widths', async ({ page }) => {
    const events = await open(page); await expect(page.locator('#dv-content')).toBeVisible(); await expect(page.locator('.dv-grid-item')).toHaveCount(2);
    await expect(page.locator('body')).not.toContainText('STAFF ONLY REVIEW MARKER'); await expect(page.locator('body')).not.toContainText('12500');
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'preview-gallery-' + width + '.png'), fullPage: true }); }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#preview-main')).toBeFocused();
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: gallery selection and preview have keyboard and focus return', async ({ page }) => {
    const events = await open(page); await page.locator('.dv-grid-item').last().click(); await expect(page.locator('#dv-hero-img')).toHaveAttribute('src', /stitched\.svg$/);
    const trigger = page.locator('#dv-hero-btn'); await trigger.focus(); await page.keyboard.press('Enter'); await expect(page.locator('#dv-lightbox')).toBeVisible(); await expect(page.locator('#dv-lightbox-close')).toBeFocused();
    expect(await page.locator('.dash-shell').evaluate(n => n.inert)).toBe(true); await axe(page); await page.keyboard.press('Escape'); await expect(page.locator('#dv-lightbox')).toBeHidden(); await expect(trigger).toBeFocused();
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
for (const [label, status, data] of [['failed', 503, {}], ['malformed', 200, {}]]) test('CSS preview tools: ' + label + ' gallery response is retryable', async ({ page }) => {
    const state = { status, data }, events = await open(page, state); await expect(page.locator('#dv-error-title')).toHaveText('Loading Error'); await expect(page.locator('#dv-content')).toBeHidden(); await axe(page);
    state.status = 200; state.data = fixture.design; await page.locator('#dv-retry').click(); await expect(page.locator('#dv-content')).toBeVisible(); await expect(page.locator('#dv-error')).toBeHidden(); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: missing design and real empty images stay distinct', async ({ page }) => {
    const state = { data: { success: true, designs: {} } }, events = await open(page, state); await expect(page.locator('#dv-error-title')).toHaveText('Design Not Found');
    state.data = { success: true, designs: { '40121': { company: 'Example Outfitters', variants: [] } } }; await page.locator('#dv-retry').click(); await expect(page.locator('#dv-no-images')).toBeVisible(); await expect(page.locator('#dv-hero')).toBeHidden(); await axe(page);
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: broken image stays visible as an error and another image recovers', async ({ page }) => {
    const events = await open(page, { imageFailure: true }); await expect(page.locator('#dv-image-status')).toBeVisible(); await expect(page.locator('#dv-hero-btn')).toBeDisabled();
    await page.locator('.dv-grid-item:visible').click(); await expect(page.locator('#dv-image-status')).toBeHidden(); await expect(page.locator('#dv-hero-img')).toBeVisible(); await expect(page.locator('#dv-hero-btn')).toBeEnabled(); await axe(page);
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});

async function tumblerReady(page) {
    await page.locator('#jmc-swatch-grid .jmc-swatch').first().click();
    await page.locator('#jmc-file-input').setInputFiles({ name: 'synthetic-crest.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(logoSvg) });
    await expect(page.locator('#jmc-download-step')).toBeVisible();
    await expect(page.locator('#jmc-canvas')).toBeVisible();
    await expect(page.locator('#jmc-preview-loading')).toBeHidden();
}
test('CSS preview tools: tumbler controls, exclusion and artwork fit work at four widths', async ({ page }) => {
    const events = await open(page, { tool: 'jds-mockup-creator' }); await tumblerReady(page);
    await expect(page.locator('#jmc-swatch-grid .jmc-swatch')).toHaveCount(2); await expect(page.locator('[data-sku="LTM751"]')).toHaveCount(0);
    await expect(page.locator('#jmc-file-input')).toBeVisible(); await expect(page.locator('#jmc-size-pct')).toHaveText('92');
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'preview-tumbler-' + width + '.png'), fullPage: true }); }
    const canvas = page.locator('#jmc-canvas'); const original = await canvas.evaluate(n => n.toDataURL()); await canvas.focus(); await page.keyboard.press('ArrowRight'); expect(await canvas.evaluate(n => n.toDataURL())).not.toBe(original);
    await page.locator('#jmc-center-btn').click(); expect(await canvas.evaluate(n => n.toDataURL())).toBe(original);
    await page.locator('#jmc-mode-frame').click(); await expect(page.locator('#jmc-mode-frame')).toHaveAttribute('aria-pressed', 'true'); expect(await canvas.evaluate(n => n.toDataURL())).not.toBe(original);
    await page.locator('#jmc-mode-edit').click(); expect(await canvas.evaluate(n => n.toDataURL())).toBe(original);
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
for (const [label, status, data] of [['failed', 503, {}], ['malformed', 200, {}]]) test('CSS preview tools: ' + label + ' tumbler catalog has a working retry', async ({ page }) => {
    const state = { tool: 'jds-mockup-creator', status, data }, events = await open(page, state); await expect(page.locator('.jmc-catalog-error')).toBeVisible(); await axe(page);
    state.status = 200; state.data = fixture.catalog; await page.locator('.jmc-catalog-error button').click(); await expect(page.locator('#jmc-swatch-grid .jmc-swatch')).toHaveCount(2); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: tumbler image failure gates download and can recover', async ({ page }) => {
    const state = { tool: 'jds-mockup-creator', tumblerFailure: true }, events = await open(page, state); await page.locator('#jmc-swatch-grid .jmc-swatch').first().click();
    await expect(page.locator('#jmc-preview-error')).toContainText('Unable to load'); await expect(page.locator('#jmc-download-btn')).toBeDisabled(); await expect(page.locator('#jmc-canvas')).toBeHidden(); await axe(page);
    state.tumblerFailure = false; await page.locator('#jmc-preview-error button').click(); await expect(page.locator('#jmc-canvas')).toBeVisible(); await expect(page.locator('#jmc-preview-error')).toBeHidden(); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: late tumbler image cannot overwrite the selected color', async ({ page }) => {
    let release; const state = { tool: 'jds-mockup-creator', delayBlack: new Promise(resolve => { release = resolve; }) }; const events = await open(page, state);
    await page.locator('#jmc-swatch-grid [data-sku="LTM752"]').click(); await page.locator('#jmc-swatch-grid [data-sku="LTM753"]').click(); await expect(page.locator('#jmc-canvas')).toBeVisible();
    const red = await page.locator('#jmc-canvas').evaluate(n => n.toDataURL()); const response = page.waitForResponse(r => r.url().includes('tumbler-black')); release(); await response; await page.waitForTimeout(100);
    await expect(page.locator('#jmc-selected-sku')).toHaveText('LTM753'); expect(await page.locator('#jmc-canvas').evaluate(n => n.toDataURL())).toBe(red); await expect(page.locator('#jmc-swatch-grid [data-sku="LTM753"]')).toHaveAttribute('aria-pressed', 'true'); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: tumbler download and comparison preserve dimensions and filenames', async ({ page }) => {
    const events = await open(page, { tool: 'jds-mockup-creator' }); await tumblerReady(page);
    await page.locator('#jmc-frame-toggle').uncheck(); const single = page.waitForEvent('download'); await page.locator('#jmc-download-btn').click(); const png = await single, bytes = fs.readFileSync(await png.path()); expect(png.suggestedFilename()).toBe('LTM752-synthetic_crest.png'); expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1800, 1800]);
    await page.locator('#jmc-compare-grid [data-sku="LTM753"]').click(); const compare = page.waitForEvent('download'); await page.locator('#jmc-compare-btn').click(); const sheet = await compare, sheetBytes = fs.readFileSync(await sheet.path()); expect(sheet.suggestedFilename()).toBe('tumbler-comparison-synthetic_crest.png'); expect([sheetBytes.readUInt32BE(16), sheetBytes.readUInt32BE(20)]).toEqual([1708, 1178]);
    expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});

test('CSS preview tools: embroidery sample statistics and fitted stage survive four widths', async ({ page }) => {
    const events = await open(page, { tool: 'dst-viewer' }); await expect(page.locator('#btnExportDesign')).toBeDisabled(); await expect(page.locator('#fileInput')).toBeVisible(); await page.locator('#btnSample').click();
    for (const [id, value] of [['tileStitches', '2,302'], ['tileColors', '3'], ['tileSizeSub', '94.4 × 52.4 mm'], ['tileTime', '4m 59s'], ['tileTrims', '1'], ['tileJumps', '7']]) await expect(page.locator('#' + id)).toHaveText(value);
    for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); await expect.poll(() => page.locator('#stage').evaluate(n => n.width)).toBe(await page.locator('#stageWrap').evaluate(n => n.clientWidth)); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); await page.screenshot({ path: path.join(output, 'preview-studio-' + width + '.png'), fullPage: true }); }
    expect(parseInt(await page.locator('#statZoom').innerText(), 10)).toBeLessThan(100); await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#stageWrap')).toBeFocused(); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: embroidery thread picker supports keyboard search, choice and return', async ({ page }) => {
    const events = await open(page, { tool: 'dst-viewer' }); await page.locator('#btnSample').click(); await page.locator('[data-panel="threads"]').click(); const trigger = page.locator('.thread-swatch').first(); await trigger.click();
    await expect(page.locator('#pickerSearch')).toBeFocused(); expect(await page.locator('.studio-root').evaluate(n => n.inert)).toBe(true); await axe(page); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await page.locator('#pickerSearch').fill('white'); await expect(page.locator('.picker-cell').first()).toBeVisible(); const chosen = await page.locator('.picker-cell .picker-name').first().innerText(); await page.locator('.picker-cell').first().click(); await expect(page.locator('#pickerOverlay')).toBeHidden(); await expect(page.locator('.thread-name').first()).toHaveText(chosen); await expect(page.locator('.thread-swatch').first()).toBeFocused(); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: embroidery modes and production speed retain meaningful controls', async ({ page }) => {
    const events = await open(page, { tool: 'dst-viewer' }); await page.locator('#btnSample').click();
    for (const mode of ['flat', 'wire', 'trace', 'stitch']) { await page.locator('[data-mode="' + mode + '"]').click(); await expect(page.locator('[data-mode="' + mode + '"]')).toHaveAttribute('aria-pressed', 'true'); }
    await page.locator('#btnGrid').click(); await expect(page.locator('#btnGrid')).toHaveAttribute('aria-pressed', 'false'); await page.locator('#btnDensity').click(); await expect(page.locator('#btnDensity')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-panel="production"]').click(); await page.locator('#spmRange').fill('1000'); await page.locator('#spmRange').dispatchEvent('input'); await expect(page.locator('#spmLabel')).toHaveText('1000 spm'); await page.locator('[data-panel="design"]').click(); await expect(page.locator('#tileTime')).not.toHaveText('4m 59s'); await axe(page); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
test('CSS preview tools: embroidery exports stitch PNG and printable approval details', async ({ page }) => {
    await page.addInitScript(() => { window.print = () => { window.__printRequested = true; }; }); const events = await open(page, { tool: 'dst-viewer' }); await page.locator('#btnSample').click();
    const download = page.waitForEvent('download'); await page.locator('#btnExportDesign').click(); const png = await download, bytes = fs.readFileSync(await png.path()); expect(png.suggestedFilename()).toBe('nw-sample-badge-stitchout.png'); expect(bytes.readUInt32BE(16)).toBeGreaterThan(1000); expect(bytes.readUInt32BE(20)).toBeGreaterThan(500);
    await page.locator('#btnMockupMode').click(); await expect(page.locator('#btnMockupMode')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#btnPrintSheet').click(); await expect.poll(() => page.evaluate(() => window.__printRequested)).toBe(true); await expect(page.locator('#sheetStitches')).toHaveText('2,302'); await expect(page.locator('#sheetThreadRows tr')).toHaveCount(3); await page.emulateMedia({ media: 'print' }); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await expect(page.locator('#printSheet')).toBeVisible(); await expect(page.locator('.studio-root')).toBeHidden(); await page.pdf({ path: path.join(output, 'preview-studio-approval.pdf'), format: 'Letter', printBackground: true }); expect(events).toEqual({ errors: [], writes: [], unmocked: [] });
});
