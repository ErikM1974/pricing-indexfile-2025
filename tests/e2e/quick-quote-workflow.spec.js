const { test, expect } = require('@playwright/test');
const { open, check } = require('./helpers/quick-quote-browser');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('node:path');
const { open: openBuilder, check: checkBuilder } = require('./helpers/quote-builders-browser');
test.use({ timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce' });

// Erik 2026-09-16 (Nika/Taneisha): last week's Line Sheet workflow — one-tap methods and
// placements, style numbers priced as typed, Qty | Per pc | Small-batch fee table, and an
// optional exact quantity whose all-in line equals the full Quote Builder total.

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
const pdfCopy = value => value.replace(/≤/g, 'up to ').replace(/×/g, 'x').replace(/[–—]/g, '-').replace(/·/g, ' | ').replace(/\s+/g, ' ');
const flat = value => value.replace(/\s+/g, ' ');
// Builders format money their own way; compare the amount.
const amount = async locator => Number(((await locator.textContent()).match(/\$[\d,]+\.\d{2}(?!.*\$)/) || ['NaN'])[0].replace(/[$,]/g, ''));
async function typeStyle(page, value, row = 0) {
    await page.locator('.qq-line-style').nth(row).fill(value);
}
async function methodChip(page, method) {
    await page.locator('[data-line-method="' + method + '"]').click();
    await expect(page.locator('[data-line-method="' + method + '"]')).toHaveAttribute('aria-pressed', 'true');
}

test('line sheet PDF carries the price-break table, the brand and the product photo', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await expect(page.locator('.qq-line-style')).toBeFocused();
    await page.keyboard.type('PC54');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const prices = await page.locator('.qq-sheet-ladder tbody tr').first().locator('td').allTextContents();
    await expect(page.locator('.qq-sheet-ladder tbody tr').nth(1)).toContainText('Small-batch fee');
    await inspectPdf(page);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    expect((await pending).suggestedFilename()).toBe('NWCA-line-sheet-PC54.pdf');
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    expect(prices.length).toBeGreaterThan(3);
    for (const price of prices) expect(text).toContain(price);
    for (const label of ['Qty', 'Per pc', 'Small-batch fee', '+$50.00', 'Small-batch fee is charged once per order.']) expect(text).toContain(label);
    expect(text).not.toContain('all-in');
    expect(text.match(/sales@nwcustomapparel.com/g)).toHaveLength(1);
    expect(review.images).toEqual(expect.arrayContaining([{ width: 80, height: 44 }, { width: 64, height: 76 }]));
    expect(review.unchanged).toBe(true); expect(review.pages).toBe(1); check(expect, e);
});

test('an exact quantity adds the all-in line and one-time setup to screen and PDF', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC54');
    await page.locator('#qqLineQty').fill('18'); await page.locator('#qqEmbDigitizing').check();
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const exact = await page.locator('.qq-sheet-exact').textContent();
    expect(exact).toMatch(/^18 pcs: \$[\d.]+\/pc all-in · \$[\d,.]+ total incl\. \$[\d.]+ one-time setup$/);
    await expect(page.locator('.qq-sheet-ladder thead th.is-current')).toHaveText('8–23');
    const prices = await page.locator('.qq-sheet-ladder tbody td').allTextContents();
    await inspectPdf(page);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    await (await pending).saveAs(path.join(__dirname, 'screenshots/css-unification/quick-quote-pdf-setup.pdf'));
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    for (const price of prices.filter(value => value.startsWith('$'))) expect(text).toContain(price);
    expect(flat(text)).toContain(pdfCopy(exact));
    expect(text).toMatch(/Plus \$[\d.]+ one-time setup/);
    expect(review.unchanged).toBe(true); expect(review.pages).toBe(1); check(expect, e);
});

test('a quick-price estimate flows long descriptions and notes across pages without losing totals', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24' });
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toBeHidden();
    const totals = await page.locator('.qq-sheet-exact').allTextContents();
    expect(totals).toHaveLength(4);
    await inspectPdf(page, true);
    const pending = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    await (await pending).saveAs(path.join(__dirname, 'screenshots/css-unification/quick-quote-pdf-long-content.pdf'));
    const review = await page.evaluate(() => window.__pdfReview), text = review.text.map(row => row.value).join('\n');
    for (const total of totals) expect(flat(text)).toContain(pdfCopy(total));
    expect(text.match(/all-in/g)).toHaveLength(totals.length);
    expect(text).toContain('End of customer notes.'); expect(text).toContain('Each option is a separate estimate');
    expect(review.pages).toBeGreaterThan(2); expect(review.unchanged).toBe(true);
    for (const row of review.text) {
        expect(row.y).toBeGreaterThanOrEqual(40);
        expect(row.y).toBeLessThanOrEqual(/^Page \d+ of/.test(row.value) ? 758 : 714);
    }
    check(expect, e);
});

test('style numbers price as they are typed; methods and placements stay one tap on a laptop', async ({ page }) => {
    await page.setViewportSize({ width: 1265, height: 712 });
    const e = await open(page, { url: '/calculators/quick-quote/index.html', searchProducts: [{ styleNumber: 'PC55P', productName: 'Pocket Tee' }] });
    await expect(page.locator('#qqModeToggle')).toHaveText(/Line Sheet\s+Quick Price/);
    // Styles sit right under the method chips, so the style box, the embroidery logo and the
    // sheet actions fit a laptop screen before anything is typed.
    for (const selector of ['#qqLineMethodChips', '.qq-line-style', '[data-logo="primary"]', '#qqLineQty', '#qqLineDownload']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.y + bounds.height, selector).toBeLessThanOrEqual(712);
    }
    await methodChip(page, 'dtf');
    await typeStyle(page, 'PC55');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('#qqSearchPanel')).toBeHidden();
    expect(e.reads.filter(r => r.path === '/api/products/search')).toEqual([]);
    await expect(page.locator('.qq-line-name')).toHaveText('Essential Cotton Tee');
    await expect(page.locator('#qqLineQty')).toHaveValue('');
    await expect(page.locator('.qq-sheet-exact')).toHaveCount(0);
    await expect(page.locator('#qqCatalogLink')).toBeVisible();
    await expect(page.locator('#qqCatalogLink')).toHaveAttribute('target', '_blank');
    await expect(page.locator('.qq-sheet-sub')).toHaveText('Line Sheet · DTF transfer · Left chest · ≤5×5"');
    for (const selector of ['#qqLineMethodChips', '.qq-line-style', '.qq-line-color', '#qqLineQty', '.qq-sheet-ladder', '#qqLineDownload']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.y, selector).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height, selector).toBeLessThanOrEqual(712);
    }
    await page.screenshot({ path: path.join(__dirname, 'screenshots/css-unification/quick-quote-speed-laptop.png'), fullPage: true });
    await page.locator('.qq-place-chip[data-kind="front"][data-code="CF"]').click();
    await page.locator('.qq-place-chip[data-kind="back"][data-code="CB"]').click();
    await expect(page.locator('.qq-sheet-sub')).toHaveText('Line Sheet · DTF transfer · Center front · ≤9×12", Center back · ≤9×12"');
    await page.locator('#qqLineQty').fill('18');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('.qq-sheet-ladder thead th.is-current')).toHaveText('10–23');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedPrices = value; } } }));
    await page.locator('#qqCopy').click();
    const copied = await page.evaluate(() => window.__copiedPrices);
    expect(copied).toMatch(/ {2}10–23: \$[\d.]+\/pc \+ \$50\.00 small-batch fee \(once per order\)/);
    expect(copied).toContain(await page.locator('.qq-sheet-exact').textContent());
    for (const price of await page.locator('.qq-sheet-ladder tbody tr').first().locator('td').allTextContents()) expect(copied).toContain(price);
    await page.locator('#qqLineQty').fill('0');
    await expect(page.locator('#qqCopy')).toBeDisabled();
    await expect(page.locator('#qqSheet')).toBeHidden();
    await expect(page.locator('#qqDocumentStatus')).toContainText('whole quantity');
    check(expect, e);
});

test('a product name shows suggestions and Enter picks one; a missed style number offers matches', async ({ page }) => {
    const state = { url: '/calculators/quick-quote/index.html', searchProducts: [{ styleNumber: 'PC54', productName: 'Cotton Tee' }] };
    const e = await open(page, state);
    await typeStyle(page, 'cotton tee');
    await expect(page.locator('.qq-line-row').first().locator('#qqSearchResults button')).toHaveText('PC54 · Cotton Tee');
    await expect(page.locator('#qqCopy')).toBeDisabled();
    await expect(page.locator('#qqDocumentStatus')).toContainText('choose a product from the list');
    await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('.qq-line-style')).toHaveValue('PC54');
    await expect(page.locator('#qqSearchPanel')).toBeHidden();
    state.productEmpty = true;
    await page.locator('#qqLineAdd').click();
    await page.keyboard.type('PC5X');
    await expect(page.locator('.qq-line-row').nth(1)).toContainText('No product found for PC5X.');
    await expect(page.locator('#qqSearchStatus')).toHaveText('Did you mean:');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(1);
    await expect(page.locator('#qqCopy')).toBeDisabled();
    state.productEmpty = false;
    await page.locator('#qqSearchResults button').first().click();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(2);
    await expect(page.locator('#qqCopy')).toBeEnabled();
    check(expect, e);
});

test('replacing and removing styles keeps decoration and never exports stale prices', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, 'dtf');
    await page.locator('.qq-place-chip[data-kind="back"][data-code="CB"]').click();
    await typeStyle(page, 'PC55'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await typeStyle(page, 'PC61');
    await expect(page.locator('#qqCopy')).toBeDisabled();
    await expect(page.locator('#qqSheet')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#qqSheet')).toContainText('PC61');
    await expect(page.locator('#qqSheet')).not.toContainText('PC55');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await page.locator('#qqLineAdd').click();
    await page.keyboard.type('PC54'); await page.keyboard.press('Enter');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(2);
    await expect(page.locator('.qq-place-chip[data-kind="back"][data-code="CB"]')).toHaveClass(/is-active/);
    await expect(page.locator('[data-recommend]').first()).toBeVisible();
    await page.locator('.qq-line-row').first().locator('.qq-line-rm').click();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(1);
    await page.locator('.qq-line-row').first().locator('.qq-line-rm').click();
    await expect(page.locator('.qq-line-row')).toHaveCount(1);
    await expect(page.locator('.qq-line-style')).toHaveValue('');
    await expect(page.locator('#qqSheet')).toBeHidden();
    await expect(page.locator('#qqLineDownload')).toBeDisabled();
    check(expect, e);
});

test('switching modes re-prices whatever was priced with older decoration settings', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC61');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const oneLogo = await page.locator('.qq-sheet-ladder tbody tr').first().locator('td').allTextContents();
    await page.locator('[data-mode="quick"]').click();
    await page.locator('#qqStyle').fill('PC61');
    await expect(page.locator('.qq-card[data-method="dtf"] .qq-card-pp')).toBeVisible();
    await expect(page.locator('.qq-skeleton')).toHaveCount(0);
    const leftChestOnly = await page.locator('.qq-card[data-method="dtf"] .qq-card-pp').textContent();
    await page.locator('#qqEmbAddBtn').click();
    await page.locator('[data-mode="linesheet"]').click();
    await expect(page.locator('.qq-sheet-sub')).toContainText('additional logo');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    const twoLogos = await page.locator('.qq-sheet-ladder tbody tr').first().locator('td').allTextContents();
    expect(twoLogos).not.toEqual(oneLogo);
    for (let i = 0; i < oneLogo.length; i++) expect(Number(twoLogos[i].slice(1))).toBeGreaterThan(Number(oneLogo[i].slice(1)));
    // Back in Quick Price after the sheet changed its method, the cards follow the new settings too.
    await methodChip(page, 'dtf');
    await page.locator('.qq-place-chip[data-kind="back"][data-code="FB"]').click();
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await page.locator('[data-mode="quick"]').click();
    await expect(page.locator('.qq-card[data-method="dtf"] .qq-cfg-chip')).toContainText(['Left chest · ≤5×5"', 'Full back · ≤12×16.5"']);
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await expect(page.locator('.qq-card[data-method="dtf"] .qq-card-pp')).not.toHaveText(leftChestOnly);
    check(expect, e);
});

test('Ctrl+P while prices update prints a notice, never the old prices', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC54');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await page.evaluate(() => {
        const qty = document.getElementById('qqLineQty'); qty.value = '30'; qty.dispatchEvent(new Event('input', { bubbles: true }));
        window.dispatchEvent(new Event('beforeprint'));
    });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#qqSheet')).toHaveText('Prices are still updating or a style needs attention. Print again once the sheet is ready.');
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('.qq-sheet-exact')).toContainText('30 pcs');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    check(expect, e);
});

// Erik 2026-09-16: reps quote the version in feedback, and a one-time badge says something changed.
test('the version line names the release and What’s new clears the Updated badge', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    const version = (await page.locator('#qqRelease').getAttribute('data-release')).split('?v=')[1];
    await expect(page.locator('#qqReleaseLabel')).toHaveText(/^Version \d{4}\.\d{2}\.\d{2}\.\d+ · Updated [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    await expect(page.locator('#qqReleaseLabel')).toContainText('Version ' + version + ' ·');
    await expect(page.locator('#qqReleaseBadge')).toBeVisible();
    await expect(page.locator('#qqReleaseNotes')).toBeHidden();
    // What's new floats over the page: opening it never moves the form.
    const before = await page.locator('#qqModeToggle').boundingBox();
    await page.locator('#qqReleaseToggle').click();
    await expect(page.locator('#qqReleaseToggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('#qqModeToggle').boundingBox()).toEqual(before);
    await expect(page.locator('#qqReleaseNotes li').first()).toBeVisible();
    await expect(page.locator('#qqReleaseNotes h2').last()).toBeHidden();
    await page.locator('#qqReleaseNotes summary').click();
    await expect(page.locator('#qqReleaseNotes h2').last()).toHaveText('Version 2026.09.16.2 · Sep 16, 2026');
    await expect(page.locator('#qqReleaseNotes h2').last()).toBeVisible();
    await expect(page.locator('#qqReleaseBadge')).toBeHidden();
    const axe = await new AxeBuilder({ page }).include('#qqRelease').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations.map(v => v.id)).toEqual([]);
    // The floating list stays inside the window at every width (reopened so it is placed for it).
    for (const width of [1440, 990, 900, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await page.locator('#qqReleaseToggle').click();
        await page.locator('#qqReleaseToggle').click();
        await expect(page.locator('#qqReleaseNotes')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + 'px no sideways scroll').toBe(true);
        const notes = await page.locator('#qqReleaseNotes').boundingBox();
        expect(notes.x, width + 'px left edge').toBeGreaterThanOrEqual(0);
        expect(notes.x + notes.width, width + 'px right edge').toBeLessThanOrEqual(width);
    }
    // Tabbing out of the list closes it.
    await page.locator('#qqReleaseNotes summary').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#qqReleaseNotes')).toBeHidden();
    await page.locator('#qqReleaseToggle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#qqReleaseNotes')).toBeHidden();
    await expect(page.locator('#qqReleaseToggle')).toBeFocused();
    await page.locator('#qqReleaseToggle').click();
    await page.locator('.page-title').click();
    await expect(page.locator('#qqReleaseNotes')).toBeHidden();
    // The line shares the subtitle's row on a laptop, so the form keeps its place.
    await page.setViewportSize({ width: 1265, height: 712 });
    const [lede, release] = await Promise.all([page.locator('.lede').boundingBox(), page.locator('#qqRelease').boundingBox()]);
    expect(release.x).toBeGreaterThan(lede.x + lede.width);
    await page.reload();
    await expect(page.locator('#qqReleaseLabel')).toContainText('Version ' + version + ' ·');
    await expect(page.locator('#qqReleaseBadge')).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#qqRelease')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    check(expect, e);
});

// Erik 2026-09-16: soft headwear (beanies, headbands, gaiters, skull caps...) is flat embroidery
// everywhere, the same as the Embroidery builder — one shared classifier decides it.
test('soft headwear prices as flat embroidery on every sheet and in Quick Price', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'CP90');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(page.locator('.qq-line-stat')).toHaveCount(0);
    const ladder = page.locator('.qq-sheet-ladder tbody tr').first();
    await expect(ladder.locator('th')).toHaveText('Per pc');
    const flatPrices = await ladder.locator('td').allTextContents();
    await methodChip(page, 'capemb');
    await expect(page.locator('.qq-line-row').first()).toContainText('Priced as embroidery — soft headwear is flat embroidery, as in the Embroidery builder.');
    await expect(page.locator('.qq-sheet-item .qq-sheet-method')).toContainText('Embroidery · Front 8,000 stitches');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(ladder.locator('th')).toHaveText('Per pc');
    expect(await ladder.locator('td').allTextContents()).toEqual(flatPrices);
    await methodChip(page, 'dtg');
    await expect(page.locator('.qq-line-row').first()).toContainText('CP90 is headwear — choose Embroidery or Cap embroidery.');
    await page.locator('[data-mode="quick"]').click();
    await page.locator('#qqStyle').fill('CP90');
    const flatNote = 'Beanies, headbands and other soft headwear are priced as flat embroidery, the same as the Embroidery builder.';
    await expect(page.locator('.qq-elig-note')).toHaveText(flatNote);
    await expect(page.locator('.qq-card[data-method]')).toHaveCount(1);
    await expect(page.locator('.qq-card[data-method="emb"]')).toContainText('/pc');
    await expect(page.locator('.qq-card[data-method="emb"]')).not.toHaveClass(/is-error|is-unavailable/);
    await expect(page.locator('.qq-emb-pos').first()).toHaveText('Front');
    await expect(page.locator('#qqPlacementField')).toBeHidden();
    // A fleece headband in "Caps" is flat too (Erik 2026-09-16), the same as the beanie.
    await page.locator('#qqStyle').fill('C916');
    await expect(page.locator('#qqProductName')).toHaveText('Port Authority Two-Color Fleece Headband');
    await expect(page.locator('.qq-elig-note')).toHaveText(flatNote);
    await expect(page.locator('.qq-card[data-method]')).toHaveCount(1);
    await expect(page.locator('.qq-card[data-method="emb"]')).toContainText('/pc');
    await expect(page.locator('.qq-card[data-method="emb"]')).not.toHaveClass(/is-error|is-unavailable/);
    await expect(page.locator('.qq-card[data-method="capemb"]')).toHaveCount(0);
    await expect(page.locator('.qq-emb-pos').first()).toHaveText('Front');
    await expect(page.locator('#qqPlacementField')).toBeHidden();
    // On a line sheet the headband follows the beanie: cap embroidery re-routes to flat embroidery.
    await page.locator('[data-mode="linesheet"]').click();
    await typeStyle(page, 'C916');
    await methodChip(page, 'capemb');
    await expect(page.locator('.qq-line-row').first()).toContainText('Priced as embroidery — soft headwear is flat embroidery, as in the Embroidery builder.');
    await expect(page.locator('.qq-sheet-item .qq-sheet-method')).toContainText('Embroidery · Front 8,000 stitches');
    await expect(page.locator('.qq-sheet-ladder tbody tr').first().locator('th')).toHaveText('Per pc');
    check(expect, e);
});

test('copy fallback is selectable and absent from print', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqCopy')).toBeEnabled();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } }));
    await page.locator('#qqCopy').click();
    await expect(page.locator('#qqCopyText')).toBeVisible();
    await expect(page.locator('#qqCopyText')).toHaveValue(/PC54/);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#qqCopyFallback')).toBeHidden();
    await expect(page.locator('#qqCopyStatus')).toBeHidden();
    await expect(page.locator('#qqSheet')).toBeVisible();
    await expect(page.locator('.qq-inputs')).toBeHidden();
    check(expect, e);
});

test('caps: a Richardson cap with no category prices as a cap and embroidery follows each product', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, 'capemb');
    await typeStyle(page, '112FPR');
    await page.locator('#qqLineAdd').click(); await page.keyboard.type('C112');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(2);
    await expect(page.locator('.qq-line-stat.err')).toHaveCount(0);
    const rows = page.locator('.qq-sheet-ladder');
    await expect(rows.nth(0).locator('tbody tr').first().locator('th')).toHaveText('Per cap');
    expect(await rows.nth(0).locator('tbody tr').first().locator('td').allTextContents()).toEqual(await rows.nth(1).locator('tbody tr').first().locator('td').allTextContents());
    await page.locator('#qqLineAdd').click(); await page.keyboard.type('PC54');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(3);
    await expect(page.locator('.qq-line-row').nth(2)).toContainText('Priced as embroidery.');
    await expect(page.locator('.qq-sheet-item').nth(2).locator('.qq-sheet-method')).toContainText('Embroidery · Left chest 8,000 stitches');
    await methodChip(page, 'emb');
    await expect(page.locator('.qq-line-row').first()).toContainText('Priced as cap embroidery.');
    await expect(page.locator('.qq-sheet-item').first().locator('.qq-sheet-method')).toContainText('Cap embroidery');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await methodChip(page, 'dtf');
    await expect(page.locator('.qq-line-row').first()).toContainText('112FPR is a cap — choose Embroidery or Cap embroidery.');
    await expect(page.locator('#qqDocumentStatus')).toContainText('Before sending: 112FPR is a cap');
    await expect(page.locator('.qq-sheet-item')).toHaveCount(1);
    await expect(page.locator('#qqLineDownload')).toBeDisabled();
    check(expect, e);
});

test('a garment with no category warns instead of blocking print methods', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, 'dtf');
    await typeStyle(page, 'BC3001');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(page.locator('.qq-line-row').first()).toContainText('This category isn’t in our decoration rules — confirm DTF transfer works for it.');
    await page.locator('[data-mode="quick"]').click();
    await page.locator('#qqStyle').fill('BC3001');
    await expect(page.locator('.qq-elig-note')).toContainText('only embroidery is shown');
    await expect(page.locator('.qq-card[data-method]')).toHaveCount(1);
    check(expect, e);
});

for (const method of ['emb', 'capemb', 'dtg', 'scp', 'dtf']) test('customer sheet shows the fee row, setup and exact totals: ' + method, async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, method);
    await page.locator('#qqLineQty').fill(method === 'scp' ? '24' : method === 'dtf' ? '10' : '5');
    if (method === 'emb' || method === 'capemb') await page.locator('#qqEmbDigitizing').check();
    await typeStyle(page, method === 'capemb' ? 'C112' : 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toContainText('Small-batch fee');
    await expect(page.locator('#qqSheet')).toContainText('Valid through Oct 12, 2026');
    await expect(page.locator('.qq-sheet-exact')).toHaveText(/^\d+ (pcs|caps): \$[\d.]+\/(pc|cap) all-in · \$[\d,.]+ total/);
    if (method === 'emb' || method === 'capemb') await expect(page.locator('#qqSheet')).toContainText(/digitiz/i);
    if (method === 'scp') await expect(page.locator('#qqSheet')).toContainText(/screen|setup/i);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.locator('#qqSheet')).toHaveAttribute('aria-busy', 'false');
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

// Flat headwear (CP90 beanie, C916 fleece headband in "Caps") hands off as flat embroidery, whichever
// embroidery chip the rep picked: the builder uses the same shared classifier.
for (const [method, quantity, style] of [['emb', 3], ['emb', 7], ['emb', 3, 'CP90'], ['capemb', 3, 'CP90'], ['emb', 7, 'CP90'], ['emb', 3, 'C916'], ['capemb', 3, 'C916'], ['capemb', 3], ['capemb', 7], ['dtg', 23], ['dtf', 23], ['scp', 24], ['scp', 37]]) test('small-order price survives the full builder: ' + method + ' ' + quantity + (style ? ' ' + style : ''), async ({ page, context }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, method);
    await page.locator('#qqLineQty').fill(String(quantity));
    await typeStyle(page, style || (method === 'capemb' ? 'C112' : 'PC54')); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    const expectedTotal = Number(await page.locator('.qq-sheet-exact').getAttribute('data-total'));
    await expect(page.locator('.qq-sheet-exact')).toContainText('$' + expectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' total');
    const href = await page.locator('#qqDocumentOptions a').getAttribute('href');
    const target = await context.newPage(), b = await openBuilder(target, { url: (['dtf', 'scp'].includes(method) ? 'https://quote-builder.example.invalid' : '') + href });
    await expect.poll(() => target.evaluate(() => new URLSearchParams(location.search).has('from')), { timeout: 30000 }).toBe(false);
    if (method === 'dtg') {
        await expect.poll(() => amount(target.locator('.dps-totals-row').filter({ has: target.getByText('Subtotal', { exact: true }) })), { timeout: 30000 }).toBeCloseTo(expectedTotal, 2);
    } else {
        await expect.poll(() => amount(target.locator('#pre-tax-subtotal')), { timeout: 30000 }).toBeCloseTo(expectedTotal, 2);
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

test('reps choose and recommend quick-price options; a multi-option PDF keeps them separate', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24' });
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await expect(page.locator('.qq-sheet-item')).toHaveCount(4);
    await page.locator('[data-recommend="dtg"]').click();
    await expect(page.locator('.qq-sheet-item').nth(1)).toContainText('Our recommendation');
    await expect(page.locator('.qq-sheet-item').nth(1)).toContainText('DTG print');
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

test('a photo that cannot load is left out of the PDF with a note, prices intact', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC54');
    await expect(page.locator('#qqLineDownload')).toBeEnabled();
    await page.route('**/__core-fixture/garment.svg', route => route.fulfill({ status: 404 }));
    await page.route('**/api/image-proxy**', route => route.fulfill({ status: 502 }));
    await page.evaluate(() => { const original = window.QuickQuoteDocument.pdf; window.QuickQuoteDocument.pdf = (model, library, imageData) => { model.options.forEach(option => { option.image = 'https://supplier.example.test/missing.jpg'; }); return original(model, library, imageData); }; });
    const download = page.waitForEvent('download'); await page.locator('#qqLineDownload').click();
    expect((await download).suggestedFilename()).toBe('NWCA-line-sheet-PC54.pdf');
    await expect(page.locator('#qqExportError')).toHaveText('1 image could not be loaded and was left out. Prices are complete.');
    check(expect, e);
});

test('the PDF downloads a real document and the local draft restores fresh inputs', async ({ page }) => {
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await typeStyle(page, 'PC54');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await page.locator('.qq-customer-details summary').click();
    await page.locator('#qqCustomerName').fill('Example Customer');
    await page.locator('#qqRepName').fill('Nika');
    const pending = page.waitForEvent('download');
    await page.locator('#qqLineDownload').click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('NWCA-line-sheet-Example-Customer.pdf');
    const dest = path.join(__dirname, 'screenshots/css-unification/quick-quote-workflow-download.pdf');
    await download.saveAs(dest);
    expect(require('node:fs').readFileSync(dest).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(page.locator('#qqDraftStatus')).toContainText('saved on this browser');
    await page.reload(); await expect(page.locator('#qqRestoreDraft')).toBeVisible();
    await page.locator('#qqRestore').click(); await expect(page.locator('#qqLinePrint')).toBeEnabled();
    await expect(page.locator('#qqSheet')).toContainText('PC54');
    await expect(page.locator('#qqRestoreDraft')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('nwca-quick-quote-inputs'))).not.toContain('Example Customer');
    await expect(page.locator('#qqSavedProducts')).toContainText('PC54');
    check(expect, e);
});

for (const method of ['emb', 'capemb', 'cap-puff', 'cap-patch', 'dtf', 'scp', 'scp-back']) test('full builder retains decoration from the line sheet: ' + method, async ({ page, context }) => {
    const actual = method === 'scp-back' ? 'scp' : method.startsWith('cap-') ? 'capemb' : method;
    const e = await open(page, { url: '/calculators/quick-quote/index.html' });
    await methodChip(page, actual);
    await page.locator('#qqLineQty').fill('24');
    if (['emb', 'capemb'].includes(actual)) {
        if (method === 'cap-puff' || method === 'cap-patch') await page.locator('[data-cap-emb="' + (method === 'cap-puff' ? '3d-puff' : 'laser-patch') + '"]').click();
        await page.locator('[data-logo="primary"]').fill('11000');
        await page.locator('#qqEmbDigitizing').check();
        await page.locator('#qqEmbAddBtn').click();
        if (actual === 'emb') await page.locator('#qqEmbAddBtn').click();
    } else {
        await page.locator('.qq-place-chip[data-kind="back"][data-code="FB"]').click();
        await page.locator('#qqSleeveL').check();
        if (actual === 'scp') {
            await page.locator('#qqInkFront').fill('3'); await page.locator('#qqInkBack').fill('2');
            await page.locator('#qqSleeveInkL').fill('4'); await page.locator('#qqScpDark').check();
            if (method === 'scp-back') await page.locator('.qq-place-chip[data-kind="front"][data-code=""]').click();
        }
    }
    await typeStyle(page, actual === 'capemb' ? 'C112' : 'PC54'); await page.locator('.qq-line-style').press('Enter');
    await expect(page.locator('#qqLinePrint')).toBeEnabled();
    const href = await page.locator('#qqDocumentOptions a').getAttribute('href');
    const expectedTotal = Number(await page.locator('.qq-sheet-exact').getAttribute('data-total'));
    expect(new URL(href, 'http://localhost').searchParams.get('decoration')).toBeTruthy();
    const target = await context.newPage(), b = await openBuilder(target, { url: href });
    await expect.poll(() => target.evaluate(() => new URLSearchParams(location.search).has('from')), { timeout: 30000 }).toBe(false);
    await expect.poll(() => amount(target.locator('#pre-tax-subtotal')), { timeout: 30000 }).toBeCloseTo(expectedTotal, 2);
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
