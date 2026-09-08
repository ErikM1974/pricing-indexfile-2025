const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const guides = { 'art-approval-guide': 3, 'thank-you-card-guide': 5, 'lead-sheet-guide': 2, 'google-review-guide': 4 };
const imageFixture = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="white"/><rect x="24" y="24" width="752" height="48" fill="#166534"/><text x="40" y="130" font-size="30">Training image fixture</text></svg>';

async function fixture(page, name, imageMode = 'success', blockController = false) {
    const state = { writes: [], errors: [], imageMode, pendingImages: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        if (blockController && new URL(route.request().url()).pathname === '/shared_components/js/training-guide.js') return route.abort();
        if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
        state.writes.push(route.request().url());
        return route.fulfill({ status: 503, json: { error: 'Training fixture blocks business writes' } });
    });
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Training fixture blocks services' } }));
    await page.route('https://cdn.caspio.com/**', route => {
        if (state.imageMode === 'pending') { state.pendingImages.push(route); return; }
        if (state.imageMode === 'failure') return route.fulfill({ status: 503, body: 'Fixture image failure' });
        return route.fulfill({ contentType: 'image/svg+xml', body: imageFixture });
    });
    await page.route('http://localhost:3400/training/' + name + '.html*', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'training/' + name + '.html'), 'utf8') }));
    await page.route('**/staff-dashboard.html', route => route.fulfill({ contentType: 'text/html', body: '<title>Dashboard fixture</title><main>Dashboard</main>' }));
    await page.goto('/training/' + name + '.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    return state;
}

async function layout(page, name) {
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name + ' at ' + width).toBeLessThanOrEqual(width + 1);
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
        if (process.env.CSS_SHOT_TAG) {
            const out = path.join(__dirname, 'screenshots/css-unification');
            fs.mkdirSync(out, { recursive: true });
            await page.screenshot({ path: path.join(out, process.env.CSS_SHOT_TAG + '-' + name + '-' + width + '.png'), fullPage: true });
        }
    }
}

for (const [name, count] of Object.entries(guides)) {
    test('CSS service training: ' + name + ' keyboard sections, reading and navigation', async ({ page }) => {
        const state = await fixture(page, name);
        await expect(page.locator('body')).toHaveCSS('font-family', /Public Sans/);
        const buttons = page.locator('.training-toggle');
        await expect(buttons).toHaveCount(count);
        for (let i = 0; i < count; i++) {
            await buttons.nth(i).focus();
            await expect(buttons.nth(i)).toHaveAttribute('aria-expanded', 'false');
            await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
            await expect(buttons.nth(i)).toHaveAttribute('aria-expanded', 'true');
            await expect(page.locator('.accordion-content').nth(i)).toBeVisible();
        }
        await layout(page, name + '-expanded');
        for (const region of await page.locator('.training-table-scroll').all()) {
            await region.focus();
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
        }
        await buttons.last().focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.accordion-content').last()).toBeHidden();
        await expect(buttons.last()).toBeFocused();
        await page.locator('[data-training-back]').focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/staff-dashboard.html$/);
        expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    });

    test('CSS service training: ' + name + ' prints closed sections with complete content', async ({ page }) => {
        const state = await fixture(page, name);
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.nav-header')).toBeHidden();
        expect(await page.locator('.training-toggle').first().evaluate(el => getComputedStyle(el, '::after').display)).toBe('none');
        for (const panel of await page.locator('.accordion-content').all()) await expect(panel).toBeVisible();
        const out = path.join(__dirname, 'screenshots/css-unification');
        fs.mkdirSync(out, { recursive: true });
        await page.pdf({ path: path.join(out, 'training-service-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: 'screen' });
        for (const panel of await page.locator('.accordion-content').all()) await expect(panel).toBeHidden();
        expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    });
}

for (const name of ['google-review-guide', 'thank-you-card-guide']) {
    test('CSS service training: ' + name + ' shows pending images, failure and successful retry', async ({ page }) => {
        const state = await fixture(page, name, 'pending');
        for (const button of await page.locator('.training-toggle').all()) await button.click();
        const status = page.locator('.training-image-status').first();
        await expect(status).toContainText('Loading image:');
        state.imageMode = 'failure';
        for (const route of state.pendingImages.splice(0)) await route.fulfill({ status: 503, body: 'Fixture unavailable' });
        await expect(status).toContainText('Image unavailable:');
        await layout(page, name + '-image-error');
        state.imageMode = 'success';
        const retry = page.locator('.training-image-retry').first();
        await retry.focus();
        await page.keyboard.press('Enter');
        await expect(status).toBeEmpty();
        await expect(retry).toBeHidden();
        expect(await page.locator('main img').first().evaluate(img => img.naturalWidth)).toBe(800);
        expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    });
}

test('CSS service training: practice field help and edits work by keyboard and on phones', async ({ page }) => {
    const state = await fixture(page, 'lead-sheet-guide');
    await page.locator('.training-toggle').last().click();
    await page.setViewportSize({ width: 320, height: 900 });
    for (const field of await page.locator('input,textarea').all()) {
        await field.focus();
        expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(40);
        await expect(field).toHaveCSS('font-size', '16px');
        const help = await field.getAttribute('aria-describedby');
        await expect(page.locator('[id="' + help + '"]')).toBeVisible();
        await expect(field).toBeFocused();
    }
    await page.locator('#first_name').fill('Practice');
    await page.locator('#notes').fill('Local practice only');
    await page.locator('.training-toggle').last().click();
    await page.locator('.training-toggle').last().click();
    await expect(page.locator('#first_name')).toHaveValue('Practice');
    await expect(page.locator('#notes')).toHaveValue('Local practice only');
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});

test('CSS service training: reading stays available if its controller cannot load', async ({ page }) => {
    await fixture(page, 'art-approval-guide', 'success', true);
    await expect(page.locator('body')).not.toHaveClass(/training-ready/);
    for (const panel of await page.locator('.accordion-content').all()) await expect(panel).toBeVisible();
});
