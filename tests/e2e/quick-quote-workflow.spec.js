const { test, expect } = require('@playwright/test');
const { open, check } = require('./helpers/quick-quote-browser');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('node:path');
const { open: openBuilder, check: checkBuilder } = require('./helpers/quote-builders-browser');
test.use({ timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce' });

async function inspectPdf(page, longContent = false) {
    await page.evaluate(longContent => {
        const original = window.QuickQuoteDocument.pdf;
        window.QuickQuoteDocument.pdf = async (model, Library, getImage) => {
            if (longContent) {
                model.options.forEach(option => { option.description += ' Additional decoration details for this product.'.repeat(30); });
                model.notes = 'Please confirm the artwork and sizes before ordering. '.repeat(150) + 'End of customer notes.';
            }
            const before = JSON.stringify(model), text = [], images = [];
            function ObservedLibrary(options) {
                const file = new Library(options), write = file.text.bind(file), addImage = file.addImage.bind(file);
                file.text = (value, x, y, settings) => { text.push({ value: [value].flat().join('\n'), x, y, page: file.getNumberOfPages() }); return write(value, x, y, settings); };
                file.addImage = (...args) => { images.push({ width: args[4], height: args[5] }); return addImage(...args); };
                return file;
            }
            const file = await original(model, ObservedLibrary, getImage);
            window.__pdfReview = { text, images, pages: file.getNumberOfPages(), unchanged: JSON.stringify(model) === before };
            return file;
        };
    }, longContent);
}

test('customer PDF preserves sampled quantity prices and includes the brand and product images', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqProductSearch').fill('PC54'); await page.locator('#qqSearchResults button').first().click();
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const prices = await page.locator('.qq-sheet-ladder tbody tr').nth(1).locator('td').allTextContents();
    const quantities = await page.locator('.qq-sheet-ladder button').allTextContents();
    await inspectPdf(page);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click(); await pending;
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    for (const price of prices) expect(text).toContain(price);
    for (const quantity of quantities) expect(text).toContain(quantity + (Number(quantity) === 1 ? ' piece' : ' pieces'));
    expect(text).toContain('Priced at'); expect(text).not.toContain('Estimated total');
    expect(text.match(/sales@nwcustomapparel.com/g)).toHaveLength(1);
    expect(review.images).toEqual(expect.arrayContaining([{ width: 80, height: 44 }, { width: 114, height: 133 }]));
    expect(review.unchanged).toBe(true); expect(review.pages).toBe(1); check(expect, e);
});

test('customer PDF shows the selected quantity and one-time setup separately', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqProductSearch').fill('PC54'); await page.locator('#qqSearchResults button').first().click();
    await page.locator('#qqLineQty').fill('18'); await page.locator('#qqEmbDigitizing').check();
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const prices = await page.locator('.qq-sheet-ladder tbody td').allTextContents();
    const total = await page.locator('.qq-document-total dd').textContent();
    await inspectPdf(page);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    await (await pending).saveAs(path.join(__dirname, 'screenshots/css-unification/quick-quote-pdf-setup.pdf'));
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    for (const price of prices.filter(value => value.startsWith('$'))) expect(text).toContain(price);
    expect(text).toContain('18 pieces'); expect(text).toContain('One-time setup'); expect(text).toContain(total);
    expect(review.unchanged).toBe(true); expect(review.pages).toBe(1); check(expect, e);
});

test('customer PDF flows long descriptions and notes across pages without losing totals', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24' });
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const totals = await page.locator('.qq-document-total dd').allTextContents();
    await inspectPdf(page, true);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    await (await pending).saveAs(path.join(__dirname, 'screenshots/css-unification/quick-quote-pdf-long-content.pdf'));
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    for (const total of totals) expect(text).toContain(total);
    expect(text.match(/Estimated total/g)).toHaveLength(totals.length);
    expect(text).toContain('End of customer notes.'); expect(text).toContain('Each option is a separate estimate');
    expect(review.pages).toBeGreaterThan(2); expect(review.unchanged).toBe(true);
    for (const row of review.text) {
        expect(row.y).toBeGreaterThanOrEqual(40);
        expect(row.y).toBeLessThanOrEqual(/^Page \d+ of/.test(row.value) ? 758 : 714);
    }
    check(expect, e);
});

test('fast quote ranks exact styles, closes search, and shows all prices without a quantity', async ({ page }) => {
    await page.setViewportSize({ width: 1265, height: 712 });
    const e = await open(page, { url: '/calculators/quick-quote/index.html', searchProducts: [
        { styleNumber: 'PC55P', productName: 'Pocket Tee' }, { styleNumber: 'PC55LS', productName: 'Long Sleeve' },
        { styleNumber: 'PC55', productName: 'Core Blend Tee' },
    ] });
    await page.locator('#qqLineMethod').selectOption('dtf');
    await page.locator('#qqProductSearch').fill('PC55');
    await expect(page.locator('#qqSearchResults button').first()).toHaveText('PC55 · Core Blend Tee');
    await page.locator('#qqProductSearch').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('#qqSearchPanel')).toBeHidden();
    await expect(page.locator('#qqProductFinder')).toBeHidden();
    await expect(page.locator('#qqLineQty')).toHaveValue('');
    await expect(page.locator('.qq-document-total')).toHaveCount(0);
    await expect(page.locator('.qq-line-mv').first()).toBeHidden();
    await expect(page.locator('#qqCatalogLink')).toBeVisible();
    for (const selector of ['#qqLineMethod', '[data-placement="front"]', '[data-placement="back"]', '#qqLineQty', '.qq-sheet-ladder', '#qqLineDownload']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.y, selector).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height, selector).toBeLessThanOrEqual(712);
    }
    await page.screenshot({ path: path.join(__dirname, 'screenshots/css-unification/quick-quote-speed-laptop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Use 24 pieces for PC55', exact: true }).click();
    await expect(page.locator('#qqLineQty')).toHaveValue('24');
    await expect(page.locator('#qqLineQty')).toBeFocused();
    await expect(page.locator('.qq-document-total')).toBeVisible();
    await page.locator('#qqLineQty').fill('18');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Use 18 pieces for PC55', exact: true })).toBeVisible();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedPrices = value; } } }));
    await page.locator('#qqCopy').click();
    const copied = await page.evaluate(() => window.__copiedPrices);
    expect(copied).toContain('10–23 pieces — at 18:');
    expect(copied).toContain(await page.locator('.qq-document-total dd').textContent());
    for (const price of await page.locator('.qq-sheet-ladder tbody tr').filter({ hasText: 'Per piece' }).locator('td').allTextContents()) expect(copied).toContain(price);
    await page.locator('#qqLineQty').fill('0');
    await expect(page.locator('#qqCopy')).toBeDisabled();
    await expect(page.locator('#qqSheet')).toBeHidden();
    await expect(page.locator('#qqDocumentStatus')).toContainText('whole quantity');
    check(expect, e);
});

test('replacement and additional products share one search and preserve decoration', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqLineMethod').selectOption('dtf');
    await page.locator('[data-placement="back"]').selectOption('CB');
    await page.locator('#qqProductSearch').fill('PC55'); await page.locator('#qqProductSearch').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await page.locator('.qq-line-style').fill('PC61');
    await expect(page.locator('#qqCopy')).toBeDisabled();
    await page.locator('#qqSearchResults button').first().click();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(1);
    await expect(page.locator('#qqSheet')).toContainText('PC61');
    await page.locator('#qqLineAdd').click();
    await page.locator('.qq-line-style').last().fill('PC54'); await page.locator('.qq-line-style').last().press('Enter');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(2);
    await expect(page.locator('[data-placement="back"]')).toHaveValue('CB');
    await expect(page.locator('#qqSearchPanel')).toHaveCount(1);
    await expect(page.locator('#qqSearchPanel')).toBeHidden();
    await expect(page.locator('[data-recommend]').first()).toBeVisible();
    await page.locator('.qq-line-row').first().locator('.qq-line-rm').click();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(1);
    await page.locator('.qq-line-style').fill('PC55'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqSheet')).toContainText('PC55');
    check(expect, e);
});

test('copy fallback is selectable and absent from print', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqProductSearch').fill('PC54'); await page.locator('#qqProductSearch').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } }));
    await page.locator('#qqCopy').click();
    await expect(page.locator('#qqCopyText')).toBeVisible();
    await expect(page.locator('#qqCopyText')).toHaveValue(/PC54/);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#qqCopyFallback')).toBeHidden();
    await expect(page.locator('#qqCopyStatus')).toBeHidden();
    await expect(page.locator('#qqSheet')).toBeVisible();
    check(expect, e);
});

test('a product name selects its suggestion with Enter', async ({ page }) => {
    await page.setViewportSize({ width: 1265, height: 712 });
    const e = await open(page, { url: '/calculators/quick-quote/index.html', searchProducts: [{ styleNumber: 'PC54', productName: 'Cotton Tee' }] });
    await page.locator('#qqProductSearch').fill('tee');
    await expect(page.locator('#qqSearchResults button')).toHaveText('PC54 · Cotton Tee');
    await page.locator('#qqProductSearch').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('.qq-line-style')).toHaveValue('PC54');
    await expect(page.locator('#qqSearchPanel')).toBeHidden();
    for (const selector of ['#qqLineQty', '[data-logo="primary"]', '#qqEmbDigitizing', '.qq-sheet-ladder']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.y + bounds.height, selector).toBeLessThanOrEqual(712);
    }
    check(expect, e);
});

for (const method of ['emb', 'capemb', 'dtg', 'scp', 'dtf']) test('customer estimate includes actual totals and fees: ' + method, async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqLineMethod').selectOption(method);
    await page.locator('#qqLineQty').fill(method === 'scp' ? '24' : method === 'dtf' ? '10' : '5');
    if (method === 'emb' || method === 'capemb') await page.locator('#qqEmbDigitizing').check();
    await page.locator('#qqLineAdd').click();
    await page.locator('.qq-line-style').fill(method === 'capemb' ? 'C112' : 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toContainText('Estimated total');
    await expect(page.locator('#qqSheet')).toContainText('Valid through Oct 12, 2026');
    await expect(page.locator('#qqSheet')).not.toContainText('Small-order charge');
    if (method === 'emb' || method === 'capemb') await expect(page.locator('.qq-document-charges')).toContainText(/digitiz/i);
    if (method === 'scp') await expect(page.locator('.qq-document-charges')).toContainText(/screen|setup/i);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: path.join(__dirname, 'screenshots/css-unification/quick-quote-workflow-' + method + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('#qqLinePrint').click();
    await expect.poll(() => page.evaluate(() => window.__printCalls)).toBe(1);
    await page.pdf({ path: path.join(__dirname, 'screenshots/css-unification/quick-quote-workflow-' + method + '.pdf'), format: 'Letter', printBackground: true });
    check(expect, e);
});

for (const [method, quantity] of [['emb', 3], ['emb', 7], ['capemb', 3], ['capemb', 7], ['dtg', 23], ['dtf', 23], ['scp', 24], ['scp', 37]]) test('small-order price survives the full builder and PDF: ' + method + ' ' + quantity, async ({ page, context }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqLineMethod').selectOption(method);
    await page.locator('#qqLineQty').fill(String(quantity));
    await page.locator('#qqLineAdd').click(); await page.locator('.qq-line-style').fill(method === 'capemb' ? 'C112' : 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    const expectedText = await page.locator('.qq-document-total dd').textContent(), expectedTotal = Number(expectedText.replace(/[$,]/g, ''));
    const href = await page.locator('#qqDocumentOptions a').getAttribute('href');
    const target = await context.newPage(), b = await openBuilder(target, { url: (['dtf', 'scp'].includes(method) ? 'https://quote-builder.example.invalid' : '') + href });
    await expect.poll(() => target.evaluate(() => new URLSearchParams(location.search).has('from')), { timeout: 30000 }).toBe(false);
    if (method === 'dtg') {
        await expect(target.locator('.dps-totals-row').filter({ has: target.getByText('Subtotal', { exact: true }) })).toContainText(expectedText);
    } else {
        await expect(target.locator('#pre-tax-subtotal')).toHaveText(expectedText);
        await expect(target.locator('.ltm-control-panel')).toContainText("Included in the customer's per-piece price");
        await expect(target.locator('input[value="separate"]')).toHaveCount(0);
        await target.evaluate(() => {
            const original = window.EmbroideryInvoiceGenerator.prototype.generateInvoiceHTML;
            window.EmbroideryInvoiceGenerator.prototype.generateInvoiceHTML = function (pricing, customer) { window.__inclusiveInvoice = JSON.parse(JSON.stringify(pricing)); return original.call(this, pricing, customer); };
            window.EmbroideryInvoiceGenerator.prototype.printWhenReady = async function () {};
            window.open = () => ({ document: { write(html) { window.__inclusiveInvoiceHTML = html; }, close() {} }, focus() {}, print() {} });
            document.querySelector('[data-call="printQuote"]').click();
        });
        await expect.poll(() => target.evaluate(() => !!window.__inclusiveInvoice), { timeout: 15000 }).toBe(true);
        const invoice = await target.evaluate(() => window.__inclusiveInvoice);
        const products = invoice.products.reduce((sum, product) => sum + product.lineItems.reduce((s, row) => s + row.total, 0), 0);
        expect(products + Number(invoice.setupFees || 0)).toBeCloseTo(expectedTotal, 2);
        expect(invoice.ltmDistributed).toBe(true);
    }
    check(expect, e); checkBuilder(expect, b);
});

test('reps choose and recommend customer options; a multi-option PDF keeps them separate', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24' });
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(4);
    await page.locator('[data-recommend="dtg"]').click();
    await expect(page.locator('.qq-sheet-item').filter({ hasText: 'Full-color direct print' })).toContainText('Our recommendation');
    await page.locator('[data-option="scp"]').uncheck(); await expect(page.locator('.qq-sheet-item')).toHaveCount(3);
    await page.locator('.qq-customer-details summary').click();
    await page.locator('#qqCustomerName').fill('Customer name '.repeat(7));
    await page.locator('#qqCompanyName').fill('Example Company '.repeat(7));
    await page.locator('#qqRepName').fill('Taneisha');
    await page.locator('#qqCustomerNotes').fill('Please confirm your preferred decoration and sizes with Taneisha. '.repeat(5));
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    await (await pending).saveAs(path.join(__dirname, 'screenshots/css-unification/quick-quote-workflow-multipage.pdf'));
    await expect(page.locator('#qqExportError')).toBeHidden();
    check(expect, e);
});

test('editing a priced product immediately prevents stale output', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqLineAdd').click(); await page.locator('.qq-line-style').fill('PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await page.locator('.qq-line-style').fill('PC61');
    await expect(page.locator('#qqLinePrint')).toBeDisabled();
    await expect(page.locator('#qqSheet')).toBeHidden();
    await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toContainText('PC61');
    await page.locator('#qqLineQty').fill('');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('.qq-document-total')).toHaveCount(0);
    check(expect, e);
});

test('PDF embeds a supplier photo without cross-origin canvas permission', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24' });
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const photo = 'https://supplier.example.test/product.jpg';
    await page.route(photo, route => route.fulfill({ status: 403 }));
    await page.evaluate(photo => {
        const original = window.QuickQuoteDocument.pdf;
        window.QuickQuoteDocument.pdf = (model, library, imageData) => {
            model.options.forEach(option => { option.image = photo; });
            return original(model, library, imageData);
        };
    }, photo);
    const relay = page.waitForRequest(request => new URL(request.url()).pathname === '/api/image-proxy');
    const download = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    expect(new URL((await relay).url()).searchParams.get('url')).toBe(photo);
    expect((await download).suggestedFilename()).toMatch(/^NWCA-estimate-.*\.pdf$/);
    await expect(page.locator('#qqExportError')).toBeHidden(); check(expect, e);
});

test('customer PDF downloads a real document and local draft restores fresh inputs', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqProductSearch').fill('PC54');
    await page.locator('#qqSearchResults button').first().click();
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await page.locator('.qq-customer-details summary').click();
    await page.locator('#qqCustomerName').fill('Example Customer');
    await page.locator('#qqRepName').fill('Nika');
    const pending = page.waitForEvent('download');
    await page.locator('#qqLineDownload').click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('NWCA-estimate-Example-Customer.pdf');
    const dest = path.join(__dirname, 'screenshots/css-unification/quick-quote-workflow-download.pdf');
    await download.saveAs(dest);
    expect(require('node:fs').readFileSync(dest).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(page.locator('#qqDraftStatus')).toContainText('draft saved');
    await page.reload(); await expect(page.locator('#qqRestoreDraft')).toBeVisible();
    await page.locator('#qqRestore').click(); await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toContainText('PC54');
    expect(await page.evaluate(() => localStorage.getItem('nwca-quick-quote-inputs'))).not.toContain('Example Customer');
    check(expect, e);
});

for (const method of ['emb', 'capemb', 'cap-puff', 'cap-patch', 'dtf', 'scp', 'scp-back']) test('full builder retains decoration from customer option: ' + method, async ({ page, context }) => {
    const actual = method === 'scp-back' ? 'scp' : method.startsWith('cap-') ? 'capemb' : method;
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await page.locator('#qqLineMethod').selectOption(actual);
    await page.locator('#qqLineQty').fill('24');
    if (['emb', 'capemb'].includes(actual)) {
        if (method === 'cap-puff' || method === 'cap-patch') await page.locator('[data-cap-emb="' + (method === 'cap-puff' ? '3d-puff' : 'laser-patch') + '"]').click();
        await page.locator('[data-logo="primary"]').fill('11000');
        await page.locator('#qqEmbDigitizing').check();
        await page.locator('#qqEmbAddBtn').click();
        if (actual === 'emb') await page.locator('#qqEmbAddBtn').click();
    } else {
        await page.locator('[data-placement="back"]').selectOption('FB');
        await page.locator('#qqMoreSettings summary').click();
        await page.locator('#qqSleeveL').check();
        if (actual === 'scp') {
            await page.locator('#qqInkFront').fill('3'); await page.locator('#qqInkBack').fill('2');
            await page.locator('#qqSleeveInkL').fill('4'); await page.locator('#qqScpDark').check();
            if (method === 'scp-back') await page.locator('[data-placement="front"]').selectOption('');
        }
    }
    await page.locator('#qqLineAdd').click(); await page.locator('.qq-line-style').fill(actual === 'capemb' ? 'C112' : 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    const href = await page.locator('#qqDocumentOptions a').getAttribute('href');
    const expectedTotal = await page.locator('.qq-document-total dd').textContent();
    expect(new URL(href, 'http://localhost').searchParams.get('decoration')).toBeTruthy();
    const target = await context.newPage(), b = await openBuilder(target, { url: href });
    await expect.poll(() => target.evaluate(() => new URLSearchParams(location.search).has('from')), { timeout: 30000 }).toBe(false);
    await expect(target.locator('#pre-tax-subtotal')).toHaveText(expectedTotal);
    if (actual === 'emb' || actual === 'capemb') {
        const state = await target.evaluate(cap => ({ primary: cap ? window.__embState.capPrimaryLogo : window.__embState.primaryLogo, extras: [...document.querySelectorAll('[data-al-priced="true"]')].map(n => ({ stitches: n.dataset.stitchCount, type: n.dataset.alItemType })) }), actual === 'capemb');
        expect(state.primary.stitchCount).toBe(method === 'cap-patch' ? 0 : 11000); expect(state.primary.needsDigitizing).toBe(method !== 'cap-patch');
        expect(state.extras).toHaveLength(actual === 'emb' ? 2 : 1);
    } else if (actual === 'dtf') {
        expect(await target.evaluate(() => window.dtfQuoteBuilder.selectedLocations)).toEqual(['left-chest', 'full-back', 'left-sleeve']);
    } else {
        expect(await target.evaluate(() => window.__scpState.printConfig)).toMatchObject({ frontLocation: method === 'scp-back' ? 'FB' : 'LC', backLocation: method === 'scp-back' ? '' : 'FB', frontColors: 3, leftSleeveColors: 4, isDarkGarment: true });
    }
    check(expect, e); checkBuilder(expect, b);
});
