const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const names = ['cap-training', 'quick-reference-tips', 'shipping-receiving-guide', 'sanmar-purchasing-guide'];
const output = path.join(__dirname, 'screenshots/css-unification');
const tips = require('../../training/quick-tips-data.json');
test.describe.configure({ mode: 'parallel' });
test.use({ hasTouch: true, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
fs.mkdirSync(output, { recursive: true });
async function open(page, name) {
    const state = { errors: [], writes: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) {
            state.writes.push(url.pathname);
            return route.fulfill({ status: 503, json: { error: 'No business writes in reference checks' } });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'No business services in reference checks' } });
        if (url.hostname === 'fast.wistia.net') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Training video fixture</title><main>Training video fixture</main></html>' });
        return route.fallback();
    });
    await page.goto('/training/' + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    if (name === 'quick-reference-tips') await expect(page.getByRole('status')).not.toHaveText('Loading tips…');
    return state;
}
const clean = state => { expect(state.errors).toEqual([]); expect(state.writes).toEqual([]); };
const axe = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
for (const name of names) {
    test('CSS reference: ' + name + ' works at four widths', async ({ page }) => {
        const state = await open(page, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await axe(page);
            await page.screenshot({ path: path.join(output, 'training-reference-' + name + '-' + width + '.png'), fullPage: true });
            if (width === 1440) await page.screenshot({ path: path.join(output, 'training-reference-' + name + '-desktop.png') });
        }
        await expect(page.locator('a[href="/staff-dashboard.html"]').first()).toBeVisible();
        if (name === 'cap-training') {
            await expect(page.locator('.cap-card')).toHaveCount(9);
            await expect(page.locator('.stat-value').first()).toHaveText('9,307');
            for (const image of await page.locator('.cap-image').all()) {
                const bounds = await image.boundingBox();
                expect(bounds.height).toBeLessThanOrEqual(231);
            }
        }
        clean(state);
    });
}
for (const [name, prefix] of [['shipping-receiving-guide', 'srGuide:checklist:'], ['sanmar-purchasing-guide', 'sanmarPurchasing:checklist:']]) {
    test('CSS reference: ' + name + ' keyboard/touch save, reload, reset and print', async ({ page }) => {
        const state = await open(page, name);
        const grids = page.locator('[data-checklist]');
        for (const grid of await grids.all()) {
            const checkbox = grid.locator('input').first();
            await checkbox.focus(); await page.keyboard.press('Space');
            await expect(checkbox).toBeChecked();
            const key = prefix + await grid.getAttribute('data-checklist');
            expect(await page.evaluate(key => localStorage.getItem(key), key)).toMatch(/^1,/);
        }
        await page.reload();
        for (const grid of await grids.all()) await expect(grid.locator('input').first()).toBeChecked();
        for (const reset of await page.locator('[data-reset]').all()) await reset.tap();
        for (const checkbox of await grids.locator('input').all()) await expect(checkbox).not.toBeChecked();
        await page.reload();
        await expect(grids.locator('input:checked')).toHaveCount(0);
        const nav = page.locator('.quicknav a').last();
        const anchor = await nav.getAttribute('href');
        await nav.focus(); await page.keyboard.press('Enter');
        await expect(page.locator(anchor)).toBeFocused();
        await expect(page).toHaveURL(new RegExp(anchor + '$'));
        await page.locator('[data-action="top"]').click();
        await expect(page.locator('h1')).toBeFocused();
        expect(await page.evaluate(() => scrollY)).toBe(0);
        await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls++; }; });
        await page.locator('[data-action="print"]').click();
        expect(await page.evaluate(() => window.printCalls)).toBe(1);
        clean(state);
    });
    test('CSS reference: ' + name + ' storage errors stay visible and can retry', async ({ page }) => {
        const state = await open(page, name);
        const grid = page.locator('[data-checklist]').first(), checkbox = grid.locator('input').first();
        await page.evaluate(() => {
            window.realChecklistSet = Storage.prototype.setItem;
            Storage.prototype.setItem = () => { throw new Error('Fixture full storage'); };
        });
        await checkbox.check();
        await expect(page.getByRole('status').first()).toContainText('could not be saved');
        await page.evaluate(() => { Storage.prototype.setItem = window.realChecklistSet; });
        await checkbox.uncheck();
        await expect(page.getByRole('status').first()).toContainText('Progress saved');
        const key = prefix + await grid.getAttribute('data-checklist');
        await checkbox.check();
        await page.evaluate(() => {
            window.realChecklistRemove = Storage.prototype.removeItem;
            Storage.prototype.removeItem = () => { throw new Error('Fixture denied reset'); };
        });
        await page.locator('[data-reset]').first().click();
        await expect(page.getByRole('status').first()).toContainText('could not be reset');
        expect(await page.evaluate(key => localStorage.getItem(key), key)).toMatch(/^1,/);
        await page.evaluate(() => { Storage.prototype.removeItem = window.realChecklistRemove; });
        await page.reload();
        await expect(checkbox).toBeChecked();
        await page.evaluate(key => localStorage.setItem(key, 'malformed progress fixture'), key);
        await page.reload();
        await expect(page.getByRole('status').first()).toContainText('could not be loaded');
        await checkbox.check();
        expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('malformed progress fixture');
        await page.locator('[data-reset]').first().click();
        expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('malformed progress fixture');
        await axe(page); clean(state);
    });
}
test('CSS reference: tips search preserves all lesson text and calendar dates', async ({ page }) => {
    const state = await open(page, 'quick-reference-tips');
    await expect(page.locator('.tip-card')).toHaveCount(tips.tips.length);
    await expect(page.locator('.tip-date').first()).toHaveText('Added: Aug 28, 2025');
    const sourceTexts = tips.tips.map(tip => new (require('jsdom').JSDOM)(tip.content).window.document.body.textContent.replace(/\s+/g, ' ').trim());
    const rendered = await page.locator('.tip-body').allTextContents();
    expect(rendered.map(text => text.replace(/\s+/g, ' ').trim())).toEqual(sourceTexts);
    await expect(page.locator('.tip-body [style]')).toHaveCount(0);
    const search = page.getByRole('textbox', { name: 'Search tips' });
    await search.fill('GRT-50'); await expect(page.locator('.tip-card')).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText('1 tip found.');
    await search.fill('No matching fixture'); await expect(page.locator('.tip-card')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('No tips found');
    await search.fill(''); await expect(page.locator('.tip-card')).toHaveCount(3);
    clean(state);
});
test('CSS reference: tips failed and malformed loads can retry, search cannot erase the error', async ({ page }) => {
    let mode = 'failed';
    await page.route('**/quick-tips-data.json', route => mode === 'failed' ? route.fulfill({ status: 503, json: { tips: tips.tips } }) : mode === 'invalid' ? route.fulfill({ json: { tips: [{}] } }) : route.fulfill({ json: tips }));
    const state = await open(page, 'quick-reference-tips');
    await expect(page.getByRole('status')).toContainText('Unable to load');
    await expect(page.locator('#totalTips')).toHaveText('—');
    await page.getByRole('textbox', { name: 'Search tips' }).fill('GRT');
    await expect(page.getByRole('status')).toContainText('Unable to load');
    mode = 'invalid'; await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('status')).toContainText('Unable to load');
    mode = 'valid'; await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.tip-card')).toHaveCount(1);
    await expect(page.locator('#totalTips')).toHaveText('3');
    await axe(page); clean(state);
});
test('CSS reference: new tips use seven calendar dates and exclude future dates', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-08T16:00:00Z'));
    const data = { tips: ['2026-09-08', '2026-09-02', '2026-09-01', '2026-09-09'].map(addedDate => ({ title: addedDate, addedDate, content: '<p>Calendar fixture</p>' })) };
    await page.route('**/quick-tips-data.json', route => route.fulfill({ json: data }));
    const state = await open(page, 'quick-reference-tips');
    await expect(page.locator('#newTips')).toHaveText('2');
    await expect(page.locator('.tip-card:has(.new-badge)')).toHaveCount(2);
    clean(state);
});
test('CSS reference: tip rich text cannot execute code or inject legacy styles', async ({ page }) => {
    const data = { tips: [{ title: '<img src=x onerror=alert(1)>', content: '<div class="tip-content" style="color:white"><script>window.badTip=1</script><p onclick="window.badTip=1">Safe fixture <a href="javascript:alert(1)">Unsafe link</a><img src=x onerror="window.badTip=1"></p></div>', addedDate: '2026-09-08', category: 'fixture' }] };
    await page.route('**/quick-tips-data.json', route => route.fulfill({ json: data }));
    const state = await open(page, 'quick-reference-tips');
    await expect(page.locator('.tip-title')).toContainText('<img');
    await expect(page.locator('.tip-body [style],.tip-body [onclick],.tip-body img,.tip-body script,.tip-body a[href]')).toHaveCount(0);
    expect(await page.evaluate(() => window.badTip)).toBeUndefined();
    clean(state);
});
for (const [name, maxPages] of [['cap-training', 7], ['quick-reference-tips', 3], ['shipping-receiving-guide', 11], ['sanmar-purchasing-guide', 10]]) {
    test('CSS reference: ' + name + ' produces its reviewed reference PDF', async ({ page }) => {
        const state = await open(page, name);
        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({ path: path.join(output, 'training-reference-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        const count = (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length;
        expect(count).toBeGreaterThan(0); expect(count).toBeLessThanOrEqual(maxPages);
        clean(state);
    });
}
