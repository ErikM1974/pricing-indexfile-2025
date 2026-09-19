const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('node:path');
const { open, fixture, check } = require('./helpers/quote-view-browser');

async function setup(page, options = {}) {
    const f = fixture('mixed');
    Object.assign(f.session, { TotalAmount: 244, SubtotalAmount: 244, TotalQuantity: 3, TaxRate: 0, TaxAmount: 0 });
    f.items = [62.17, 119.16, 62.67].map((total, i) => ({
        StyleNumber: ['PC098', 'EB545', 'DT1105'][i], ProductName: 'Example garment',
        Color: ['Nordic Green', 'Deep Black', 'Tanzanite'][i], Quantity: 1,
        BaseUnitPrice: total, FinalUnitPrice: total, LineTotal: total,
        SizeBreakdown: JSON.stringify({ [['S', 'M', 'L'][i]]: 1 }),
        EmbellishmentType: 'embroidery', PrintLocationName: 'Left Chest'
    }));
    f.full.quoteItems = f.items;
    f.full.shopWorks = { status: 'Pending', lastSynced: '2026-09-09T00:00:00', orderNumber: null };
    if (options.reserved) f.session.PushedToShopWorks = 'WQ-REVIEW:synthetic-attempt';
    const requests = [];
    await page.route('**/api/web-quote-push/*', async route => {
        const operation = new URL(route.request().url()).pathname.split('/').pop();
        requests.push({ operation, body: route.request().postDataJSON() });
        if (options.hold && operation === 'push-quote') await options.hold;
        if (operation === 'preview') return route.fulfill({ status: options.previewError ? 422 : 200, json: options.previewError ? { error: 'Catalog color is missing.' } : {
            quoteId: f.id, extOrderId: 'NWCA-' + f.id, customerNumber: '90210', customerName: 'Cedar Example Construction', subtotal: 244,
            artworkCount: 1, previewToken: 'synthetic-preview-token', items: [
                { style: 'PC098', color: 'Nordic Green', quantity: 1, sizes: { S: 1 }, total: 62.17, location: 'Left Chest' },
                { style: 'EB545', color: 'Deep Black', quantity: 1, sizes: { M: 1 }, total: 119.16, location: 'Left Chest' },
                { style: 'DT1105', color: 'Tanzanite', quantity: 1, sizes: { L: 1 }, total: 62.67, location: 'Left Chest' }
            ]
        } });
        return route.fulfill({ status: options.pushError ? 502 : 200, json: options.pushError
            ? { error: 'Submission needs verification.', code: 'SUBMISSION_UNCERTAIN' }
            : { success: true, timestamp: '2026-09-10T19:00:00Z', extOrderId: 'NWCA-' + f.id } });
    });
    const events = await open(page, { fixture: f, staff: options.staff !== false });
    await expect(page.locator('#quote-content')).toBeVisible();
    await page.waitForFunction(() => !!window.__quoteView?.fullData);
    return { requests, events };
}
async function preview(page) {
    await page.locator('#push-shopworks-btn').click();
    await expect(page.locator('#wq-customer-number')).toBeFocused();
    await page.locator('#wq-customer-number').fill('90210');
    await page.locator('#wq-preview-btn').click();
    await expect(page.locator('#wq-push-preview')).toBeVisible();
}
test('WQ review, exact subtotal, customer confirmation and one intercepted push', async ({ page }) => {
    const { requests, events } = await setup(page);
    await expect(page.locator('#sw-sync-strip')).toBeHidden();
    await preview(page);
    await expect(page.locator('#wq-push-preview')).toContainText('$244.00');
    await expect(page.locator('#wq-push-preview')).toContainText('ShopWorks #90210');
    await expect(page.locator('#wq-push-submit')).toBeDisabled();
    await page.locator('#wq-push-confirm').check();
    await page.locator('#wq-push-submit').click();
    await expect(page.locator('#wq-push-dialog')).not.toBeVisible();
    await expect(page.locator('#push-shopworks-btn')).toBeDisabled();
    await expect(page.locator('#sw-sync-pill-text')).toHaveText('Pending import');
    expect(requests.map(r => r.operation)).toEqual(['preview', 'push-quote']);
    expect(requests[1].body).toMatchObject({ customerNumber: '90210', previewToken: 'synthetic-preview-token' });
    check(expect, events);
});
for (const width of [1440, 768, 390, 320]) test(`WQ review keyboard and accessible layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const { requests, events } = await setup(page); await preview(page);
    const dialog = page.locator('#wq-push-dialog');
    expect(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#wq-push-dialog').analyze()).violations).toEqual([]);
    await page.locator('#wq-push-cancel').focus(); await page.keyboard.press('Tab');
    await expect(page.locator('#wq-customer-number')).toBeFocused();
    await page.screenshot({ path: path.join(__dirname, 'screenshots/css-unification', `web-quote-push-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await expect(page.locator('#push-shopworks-btn')).toBeFocused();
    expect(requests.map(r => r.operation)).toEqual(['preview']); check(expect, events);
});
test('editing customer invalidates the previous preview', async ({ page }) => {
    const { requests } = await setup(page); await preview(page);
    await page.locator('#wq-push-confirm').check(); await page.locator('#wq-customer-number').fill('111');
    await expect(page.locator('#wq-push-submit')).toBeDisabled(); await expect(page.locator('#wq-push-preview')).toBeHidden();
    expect(requests).toHaveLength(1);
});
test('preview validation is visible and cannot submit', async ({ page }) => {
    const { requests } = await setup(page, { previewError: true });
    await page.locator('#push-shopworks-btn').click(); await page.locator('#wq-preview-btn').click();
    await expect(page.locator('#wq-push-error')).toContainText('Catalog color is missing');
    await expect(page.locator('#wq-push-submit')).toBeDisabled(); expect(requests).toHaveLength(1);
});
test('uncertain result never shows pushed success or permits immediate retry', async ({ page }) => {
    const { requests } = await setup(page, { pushError: true }); await preview(page);
    await page.locator('#wq-push-confirm').check(); await page.locator('#wq-push-submit').click();
    await expect(page.locator('#wq-push-error')).toContainText('Submission needs verification');
    await expect(page.locator('#wq-push-submit')).toBeDisabled(); await expect(page.locator('#wq-preview-btn')).toBeDisabled();
    expect(requests).toHaveLength(2);
});
test('in-flight push disables duplicate clicks and Escape', async ({ page }) => {
    let release; const hold = new Promise(resolve => { release = resolve; });
    const { requests } = await setup(page, { hold }); await preview(page);
    await page.locator('#wq-push-confirm').check(); await page.locator('#wq-push-submit').click();
    await expect(page.locator('#wq-push-submit')).toBeDisabled(); await page.keyboard.press('Escape');
    await expect(page.locator('#wq-push-dialog')).toBeVisible(); expect(requests).toHaveLength(2);
    release(); await expect(page.locator('#wq-push-dialog')).not.toBeVisible();
});
test('persisted reservation is a verification state, not a claimed successful import', async ({ page }) => {
    await setup(page, { reserved: true });
    await expect(page.locator('#push-shopworks-btn')).toBeDisabled();
    await expect(page.locator('#push-shopworks-label')).toHaveText('Check ShopWorks submission');
    await expect(page.locator('#sw-sync-pill-text')).toHaveText('Submission needs verification');
});
test('customer share view never exposes the staff push button', async ({ page }) => {
    const { requests } = await setup(page, { staff: false });
    await expect(page.locator('#push-shopworks-btn')).toBeHidden(); expect(requests).toEqual([]);
});
