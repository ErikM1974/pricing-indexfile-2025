const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const output = path.join(__dirname, 'screenshots/carhartt-bucks');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce' });

for (const [name, url] of [['public', '/carhartt-bucks'], ['staff', '/dashboards/carhartt-bucks.html']]) {
    test(`Carhartt Bucks ${name}: four widths, keyboard and readable offer`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.setFixedTime(new Date('2026-09-15T12:00:00-07:00'));
        await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'No campaign data calls expected' } }));
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await expect(page.locator('h1')).toBeVisible();
            expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
            await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
        }
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement.tagName)).toBe('A');
        expect(errors).toEqual([]);
    });
}
test('Carhartt Bucks: public visit, redemption and expired states', async ({ page }) => {
    for (const [time, title, phase] of [
        ['2026-09-30T23:59:59-07:00', 'Visit our showroom.', 'visit'],
        ['2026-10-01T00:00:00-07:00', 'Redeem your Carhartt Bucks.', 'redeem'],
        ['2026-10-16T00:00:00-07:00', 'offer has ended.', 'expired'],
    ]) {
        await page.clock.setFixedTime(new Date(time));
        await page.goto('/carhartt-bucks');
        await expect(page.locator('h1')).toContainText(title);
        await expect(page.locator(`[data-cb-phase="${phase}"]`)).toBeVisible();
    }
});
test('Carhartt Bucks: rep copies public link, invitation and account note', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.clock.setFixedTime(new Date('2026-09-15T12:00:00-07:00'));
    await page.goto('/dashboards/carhartt-bucks.html');
    for (const [kind, content] of [['link', 'https://www.teamnwca.com/carhartt-bucks'], ['invitation', 'Cannot be combined with other offers.'], ['note', 'Qualifying order number:']]) {
        await page.locator(`[data-cb-copy="${kind}"]`).click();
        await expect(page.locator('[data-cb-copy-status]')).toContainText('copied');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(content);
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
    await page.locator('[data-cb-copy="invitation"]').click();
    await expect(page.locator('[data-cb-copy-status]')).toContainText('copy it manually');
    await expect(page.locator('[data-cb-invitation]')).toBeFocused();
});
test('Carhartt Bucks: public downloads and staff gate', async ({ request, browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const gated = await anon.request.get('/dashboards/carhartt-bucks.html', { maxRedirects: 0 });
    expect(gated.status()).toBe(302);
    for (const url of ['/carhartt-bucks', '/pages/carhartt-bucks.html', '/forms/carhartt-bucks-certificate.pdf', '/forms/carhartt-bucks-visit-log.pdf', '/images/promotions/carhartt-bucks-2026.png']) {
        const response = await anon.request.get(url);
        expect(response.status()).toBe(200);
        if (url.endsWith('.pdf')) expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
    }
    expect((await request.get('/dashboards/carhartt-bucks.html')).status()).toBe(200);
    await anon.close();
});

test('Carhartt Bucks: homepage, brand guide, dashboard and Forms Library discovery', async ({ page }) => {
    test.setTimeout(180000);
    await page.clock.setFixedTime(new Date('2026-09-15T12:00:00-07:00'));
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Synthetic discovery preview; service unavailable' } }));
    for (const [name, url] of [['home', '/'], ['brand', '/custom-carhartt'], ['dashboard', '/staff-dashboard.html'], ['forms', '/dashboards/forms-library.html']]) {
        await page.goto(url);
        const banner = page.locator('.cb-banner').first();
        await expect(banner).toBeVisible();
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await banner.scrollIntoViewIfNeeded();
            const box = await banner.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
            expect((await new AxeBuilder({ page }).include('.cb-banner').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
            await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
        }
    }
});
