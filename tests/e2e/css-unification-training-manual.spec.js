const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const names = ['customer-service', 'get-to-know-erik', 'sales-coordinator-manual', 'sales-coordinator-training-schedule'];
const output = path.join(__dirname, 'screenshots/css-unification');
test.describe.configure({ mode: 'parallel' });
test.use({ hasTouch: true, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
fs.mkdirSync(output, { recursive: true });
async function open(page, name, hash = '') {
    const state = { errors: [], writes: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) {
            state.writes.push(url.pathname);
            return route.fulfill({ status: 503, json: { error: 'Business writes blocked during training review' } });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Business services blocked during training review' } });
        if (url.hostname.endsWith('youtube.com') || url.hostname === 'fast.wistia.net') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Training video fixture</title><main>Training video fixture</main></html>' });
        return route.fallback();
    });
    await page.goto('/training/' + name + '.html' + hash);
    await page.evaluate(() => document.fonts.ready);
    return state;
}
const clean = state => { expect(state.errors).toEqual([]); expect(state.writes).toEqual([]); };
const axe = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
for (const name of names) {
    test('CSS manual: ' + name + ' works at four widths', async ({ page }) => {
        test.setTimeout(180000);
        const state = await open(page, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await axe(page);
            await page.screenshot({ path: path.join(output, 'training-manual-' + name + '-' + width + '.png') });
        }
        await expect(page.locator('a[href="/staff-dashboard.html"]').first()).toBeVisible();
        clean(state);
    });
    test('CSS manual: ' + name + ' prints all original content and restores state', async ({ page }) => {
        const state = await open(page, name);
        await page.locator('details:not(.manual-contents)').first().evaluateAll(elements => elements.forEach(el => { el.open = false; }));
        if (name === 'get-to-know-erik') await page.locator('[data-bio-toggle]').first().click();
        const snapshot = () => page.evaluate(() => ({ panels: [...document.querySelectorAll('[data-manual-section],[data-bio-panel]')].map(e => [e.id, e.hidden]), details: [...document.querySelectorAll('details:not(.manual-contents)')].map(e => e.open) }));
        const before = await snapshot();
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await expect(page.locator('[data-manual-section][hidden],[data-bio-panel][hidden]')).toHaveCount(0);
        expect(await page.locator('details:not(.manual-contents):not([open])').count()).toBe(0);
        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({ path: path.join(output, 'training-manual-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        const count = (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length;
        const limits = { 'customer-service': [40, 60], 'get-to-know-erik': [2, 3], 'sales-coordinator-manual': [44, 70], 'sales-coordinator-training-schedule': [20, 38] };
        expect(count).toBeGreaterThanOrEqual(limits[name][0]); expect(count).toBeLessThanOrEqual(limits[name][1]);
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        expect(await snapshot()).toEqual(before);
        clean(state);
    });
}
for (const [name, count, initial, next] of [['sales-coordinator-manual', 44, 'chapter19', 'chapter43'], ['sales-coordinator-training-schedule', 12, 'day4', 'notes-game']]) {
    test('CSS manual: ' + name + ' every section, deep links, back/forward and phone navigation', async ({ page }) => {
        test.setTimeout(180000);
        const state = await open(page, name, '#' + initial);
        await expect(page.locator('#' + initial)).toBeVisible();
        await expect(page.locator('.manual-contents [aria-current="location"]')).toHaveAttribute('href', '#' + initial);
        await page.locator('.manual-contents a[href="#' + next + '"]').click();
        await expect(page.locator('#' + next)).toBeFocused();
        await page.goBack(); await expect(page.locator('#' + initial)).toBeVisible();
        await page.goForward(); await expect(page.locator('#' + next)).toBeVisible();
        await expect(page.locator('[data-manual-section]')).toHaveCount(count);
        for (const link of await page.locator('.manual-contents [data-manual-link]').all()) {
            const hash = await link.getAttribute('href');
            await link.click();
            await expect(page.locator(hash)).toBeVisible();
            await expect(page.locator('[data-manual-section]:visible')).toHaveCount(1);
            await expect(link).toHaveAttribute('aria-current', 'location');
            await axe(page);
        }
        await page.setViewportSize({ width: 320, height: 844 });
        await page.reload();
        await expect(page.locator('.manual-contents')).not.toHaveAttribute('open', '');
        await page.locator('.manual-contents > summary').focus(); await page.keyboard.press('Enter');
        await page.locator('.manual-contents a[href="#' + initial + '"]').tap();
        await expect(page.locator('#' + initial)).toBeFocused();
        await expect(page.locator('.manual-contents')).not.toHaveAttribute('open', '');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
        await axe(page);
        await page.goto('/training/' + name + '.html#nonexistent');
        await expect(page.locator('[data-manual-section]:visible')).toHaveCount(1);
        clean(state);
    });
}
test('CSS manual: biography uses native keyboard controls and retains all nine sections', async ({ page }) => {
    const state = await open(page, 'get-to-know-erik');
    await expect(page.locator('[data-bio-toggle]')).toHaveCount(9);
    for (const button of await page.locator('[data-bio-toggle]').all()) {
        const id = await button.getAttribute('aria-controls');
        await button.focus(); await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-expanded', 'false'); await expect(page.locator('#' + id)).toBeHidden();
        await page.keyboard.press('Space');
        await expect(button).toHaveAttribute('aria-expanded', 'true'); await expect(page.locator('#' + id)).toBeVisible();
    }
    clean(state);
});
test('CSS manual: continuous guide anchors and tables remain accessible', async ({ page }) => {
    const state = await open(page, 'customer-service');
    expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(el => el.id); return ids.length === new Set(ids).size; })).toBe(true);
    for (const link of await page.locator('.manual-contents [data-manual-link]').all()) {
        const hash = await link.getAttribute('href');
        await link.click(); await expect(page.locator(hash)).toBeFocused();
        await expect(page).toHaveURL(new RegExp(hash + '$'));
    }
    await page.locator('#chapter2').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await expect(page.locator('.manual-contents [aria-current="location"]')).toHaveAttribute('href', '#chapter2');
    await page.setViewportSize({ width: 320, height: 844 });
    const table = page.locator('.training-table-scroll').first(); await table.focus(); await page.keyboard.press('ArrowRight');
    await expect(table).toBeFocused(); expect(await table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    clean(state);
});
test('CSS manual: all three practice scenarios retain original feedback and example answers', async ({ page }) => {
    const state = await open(page, 'sales-coordinator-training-schedule', '#notes-game');
    for (let i = 1; i <= 3; i++) {
        const field = page.locator('#practice' + i), feedback = page.locator('#feedback' + i), scenario = field.locator('..');
        await scenario.getByRole('button', { name: 'Check Answer' }).click(); await expect(feedback).toContainText('Please write a note first');
        await field.fill('unrelated'); await scenario.getByRole('button', { name: 'Check Answer' }).click(); await expect(feedback).toContainText('needs more detail');
        await scenario.getByRole('button', { name: 'Show Example' }).click(); await expect(field).not.toHaveValue('');
        await scenario.getByRole('button', { name: 'Check Answer' }).click(); await expect(feedback).toContainText('Great job');
    }
    await axe(page); clean(state);
});
test('CSS manual: roster handles missing birthdays and displays local calendar dates', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-02-14T20:00:00Z'));
    const state = await open(page, 'sales-coordinator-manual', '#chapter43');
    await expect(page.locator('#staffRosterBody tr')).toHaveCount(19);
    const row = page.locator('#staffRosterBody tr').filter({ hasText: 'Erik Mickelson' });
    await expect(row).toContainText('December 16, 1996');
    await expect(page.locator('#celebrationsWidget')).toContainText("Erik Mickelson's Birthday");
    await expect(page.locator('#celebrationsWidget')).toContainText('TODAY!');
    await expect(page.locator('#staffRosterBody tr').filter({ hasText: 'Taneisha' })).toContainText('August 12, 2025');
    clean(state);
});
