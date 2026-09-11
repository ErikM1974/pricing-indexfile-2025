const {test, expect} = require('@playwright/test');
const {open, check} = require('./helpers/specialty-calculators-browser');
test.use({timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce'});
async function emblem(page) {
    const events = await open(page, {url: '/calculators/embroidered-emblem/index.html'});
    await expect(page.locator('#emblemGridWrap tbody tr')).toHaveCount(16);
    await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    return events;
}
test('CSS specialty controls: decal dimensions stay usable at every width', async ({page}) => {
    const events = await open(page, {url: '/calculators/custom-decal-pricing.html'});
    await expect(page.locator('#decalRateGrid tbody tr')).toHaveCount(3);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width, height: 1000});
        for (const selector of ['.decal-w', '.decal-h', '.decal-q', '.decal-row-remove', '#decalAddRow', '#decalTaxRate']) {
            const bounds = await page.locator(selector).boundingBox();
            expect(bounds.width, selector).toBeGreaterThanOrEqual(44);
            expect(bounds.height, selector).toBeGreaterThanOrEqual(44);
        }
        const hint = page.locator('.page-hero-hint');
        await expect(hint).toHaveCSS('display', 'block');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    const scroll = page.getByRole('region', {name: 'Decal rates by total area'});
    await scroll.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    check(expect, events);
});
test('CSS specialty controls: emblem phones retain all 160 original prices and keyboard scrolling', async ({page}) => {
    const events = await emblem(page);
    await page.setViewportSize({width: 320, height: 1000});
    await page.locator('#pricingAccordion summary').click();
    const cells = page.locator('.emblem-pricing-table .qty-cell');
    await expect(cells).toHaveCount(160);
    expect(await cells.evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'table-cell'))).toBe(true);
    const scroll = page.getByRole('region', {name: 'Emblem prices by size and quantity'});
    await scroll.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    check(expect, events);
});
test('CSS specialty controls: idle actions stay hidden and the assistant traps and restores focus', async ({page}) => {
    const events = await emblem(page);
    await expect(page.locator('#shareToast')).toBeHidden();
    expect(await page.locator('#aiChatPanel').evaluate(node => node.inert)).toBe(true);
    await page.locator('#floatingQuoteBtn').click();
    await expect(page.locator('#aiChatTextarea')).toBeFocused();
    await expect(page.locator('#aiChatActions')).toBeHidden();
    await expect(page.locator('#shareToast')).toBeHidden();
    await page.locator('#aiChatSend').focus(); await page.keyboard.press('Tab');
    await expect(page.locator('#aiChatResetBtn')).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.locator('#aiChatSend')).toBeFocused();
    // Both delayed open callbacks have fired; neither may steal the chosen focus.
    await page.waitForTimeout(400); await expect(page.locator('#aiChatSend')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.locator('#floatingQuoteBtn')).toBeFocused();
    expect(await page.locator('#aiChatPanel').evaluate(node => node.inert)).toBe(true);
    check(expect, events); expect(events.mocked).toEqual([]);
});
test('CSS specialty controls: paper opens every reference and restores each prior disclosure', async ({page}) => {
    const events = await emblem(page);
    await page.locator('#pricingAccordion summary').click();
    const initial = await page.locator('details').evaluateAll(nodes => nodes.map(node => node.open));
    expect(initial).toEqual([true, false]);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    expect(await page.locator('details').evaluateAll(nodes => nodes.every(node => node.open))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await page.locator('details').evaluateAll(nodes => nodes.map(node => node.open))).toEqual(initial);
    check(expect, events); expect(events.mocked).toEqual([]);
});
