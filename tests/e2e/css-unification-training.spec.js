const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const pages = ['lead-follow-up-guide', 'shopworks-embroidery-order-type', 'nwca-language-reference'];

async function fixture(page, name) {
    const state = { writes: [], errors: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
        state.writes.push(route.request().url());
        return route.fulfill({ status: 503, json: { error: 'No business writes in training fixtures' } });
    });
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Training fixture has no live services' } }));
    await page.route(`http://localhost:3400/training/${name}.html*`, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, `training/${name}.html`), 'utf8') }));
    await page.goto(`/training/${name}.html`);
    await page.evaluate(() => document.fonts.ready);
    return state;
}

async function layouts(page, name) {
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name} overflow at ${width}`).toBeLessThanOrEqual(width + 1);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(axe.violations, `${name} accessibility at ${width}`).toEqual([]);
        if (process.env.CSS_SHOT_TAG) {
            const out = path.join(__dirname, 'screenshots/css-unification');
            fs.mkdirSync(out, { recursive: true });
            await page.screenshot({ path: path.join(out, `${process.env.CSS_SHOT_TAG}-${name}-${width}.png`), fullPage: true });
        }
    }
}

for (const name of pages) {
    test(`CSS training: ${name} readable guide, navigation and phone tables`, async ({ page }) => {
        const state = await fixture(page, name);
        await expect(page.locator('body')).toHaveAttribute('data-ui', 'unified');
        await expect(page.locator('body')).toHaveCSS('font-family', /Public Sans/);
        await expect(page.locator('.back-btn')).toHaveAttribute('href', name === 'lead-follow-up-guide' ? '/staff-dashboard.html' : 'training-games-hub.html');
        await layouts(page, name);
        for (const region of await page.locator('.training-table-scroll').all()) {
            await region.focus();
            const before = await region.evaluate(el => el.scrollLeft);
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(before);
        }
        expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    });

    test(`CSS training: ${name} prints complete reading content`, async ({ page }) => {
        const state = await fixture(page, name);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.nav-header')).toBeHidden();
        await expect(page.locator('main')).toBeVisible();
        expect(await page.locator('main').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        if (name === 'lead-follow-up-guide') {
            for (const section of await page.locator('.accordion-content').all()) await expect(section).toBeVisible();
            for (const button of await page.locator('.copy-btn').all()) await expect(button).toBeHidden();
        }
        if (name === 'nwca-language-reference') {
            await expect(page.locator('.print-button')).toBeHidden();
            await expect(page.locator('.actions-grid')).toContainText('Communication');
            await expect(page.locator('.actions-grid')).toContainText('Received');
            await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
        }
        const out = path.join(__dirname, 'screenshots/css-unification');
        fs.mkdirSync(out, { recursive: true });
        const pdf = await page.pdf({ path: path.join(out, `training-${name}.pdf`), preferCSSPageSize: true, printBackground: true });
        if (name === 'nwca-language-reference') {
            // Chromium emits one Page dictionary per rendered sheet. The reviewed handout
            // is two complete landscape pages; a keep-together regression added blanks.
            const sheets = pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || [];
            expect(sheets).toHaveLength(2);
        }
        if (process.env.CSS_SHOT_TAG) await page.screenshot({ path: path.join(out, `${process.env.CSS_SHOT_TAG}-${name}-print.png`), fullPage: true });
        expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
    });
}

test('CSS training: guide accordion opens by keyboard, closes peers and stays readable', async ({ page }) => {
    const state = await fixture(page, 'lead-follow-up-guide');
    const headers = page.locator('.accordion-header');
    await headers.first().focus();
    await page.keyboard.press('Enter');
    await expect(headers.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.accordion-content').first()).toBeVisible();
    await layouts(page, 'lead-channel-expanded');
    await headers.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(headers.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.accordion-content').first()).toBeHidden();
    await expect(page.locator('.accordion-content').nth(1)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('.accordion-content').nth(1)).toBeHidden();
    await expect(headers.nth(1)).toBeFocused();
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});

test('CSS training: copy template handles pending, permission failure and retry', async ({ page }) => {
    await page.addInitScript(() => {
        window.__copyMode = 'pending';
        window.__copiedTemplates = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async text => {
                window.__copiedTemplates.push(text);
                if (window.__copyMode === 'pending') await new Promise((resolve, reject) => { window.__rejectCopy = () => reject(Error('Fixture clipboard unavailable')); });
                if (window.__copyMode === 'failure') throw Error('Fixture clipboard unavailable');
            }
        } });
    });
    const state = await fixture(page, 'lead-follow-up-guide');
    const button = page.locator('.copy-btn').first(), status = page.locator('.copy-status').first();
    await button.click();
    await expect(button).toBeDisabled();
    await expect(status).toHaveText('Copying template…');
    await page.evaluate(() => window.__rejectCopy());
    await expect(button).toBeEnabled();
    await expect(status).toContainText('Copy failed.');
    await layouts(page, 'lead-copy-failed');
    await page.evaluate(() => { window.__copyMode = 'success'; });
    await button.click();
    await expect(status).toHaveText('Template copied.');
    expect(await page.evaluate(() => window.__copiedTemplates[1])).toBe(await page.locator('#template-initial').textContent());
    await expect(button).toBeEnabled();
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});
