const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'),
    path = require('node:path');
const names = ['index', 'sales-tax-code-trainer', 'shopworks-customer-setup', 'shopworks-customer-setup-enhanced'];
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ hasTouch: true, reducedMotion: 'reduce' });
async function open(page, name, hub = { policies: [] }) {
    const state = { errors: [], writes: [] };
    page.on('pageerror', (error) => state.errors.push(error.message));
    await page.route('**/*', (route) => {
        const r = route.request(),
            u = new URL(r.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(r.method())) {
            state.writes.push(u.pathname);
            return route.fulfill({ status: 503, json: { error: 'Business writes blocked' } });
        }
        if (u.pathname.includes('/api/policies-public/'))
            return route.fulfill({
                status: typeof hub === 'number' ? hub : 200,
                json: typeof hub === 'number' ? { error: 'Offline fixture' } : hub,
            });
        if (u.pathname.startsWith('/api/'))
            return route.fulfill({ status: 503, json: { error: 'Business services blocked' } });
        return route.fallback();
    });
    await page.goto('/training/' + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    return state;
}
const clean = (s) => {
    expect(s.errors).toEqual([]);
    expect(s.writes).toEqual([]);
};
const axe = async (page) =>
    expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations,
    ).toEqual([]);
for (const name of names)
    test('CSS final training: ' + name + ' at four widths', async ({ page }) => {
        test.setTimeout(180000);
        const state = await open(page, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await axe(page);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: path.join(output, 'training-final-' + name + '-' + width + '.png') });
        }
        clean(state);
    });
test('CSS final training: Center keeps tracks during failure and supports retry, empty and escaped live modules', async ({
    page,
}) => {
    const state = await open(page, 'index', 503);
    const links = await page.locator('#tc-grid a').count();
    expect(links).toBeGreaterThan(30);
    await expect(page.locator('.dash-error-banner')).toBeVisible();
    await axe(page);
    await page.route('**/api/policies-public/**', (r) =>
        r.fulfill({
            json: {
                policies: [
                    {
                        Policy_ID: 'abc&x',
                        Title: '<img src=x onerror=alert(1)>',
                        Summary: '<b>Literal summary</b>',
                        Status: 'Published',
                    },
                    { Policy_ID: 2, Title: 'Not published', Status: 'Draft' },
                ],
            },
        }),
    );
    await page.getByRole('button', { name: 'Retry live modules' }).click();
    await expect(page.locator('#tc-hub-list a')).toHaveCount(1);
    await expect(page.locator('#tc-hub-list img')).toHaveCount(0);
    await expect(page.locator('#tc-hub-list a')).toHaveAttribute('href', '/pages/policy-detail.html?id=abc%26x');
    await expect(page.locator('#tc-hub-list')).toContainText('<b>Literal summary</b>');
    await expect(page.locator('.dash-error-banner')).toBeHidden();
    await page.route('**/api/policies-public/**', (r) => r.fulfill({ json: { policies: [] } }));
    await page.reload();
    await expect(page.locator('#tc-hub-list')).toContainText('No hub training modules published yet.');
    await page.route('**/api/policies-public/**', (r) => r.fulfill({ json: { wrong: [] } }));
    await page.reload();
    await expect(page.locator('.dash-error-banner')).toBeVisible();
    expect(await page.locator('#tc-grid a').count()).toBe(links);
    clean(state);
});
test('CSS final training: tax game keyboard selection, complete round and repeated restart count once', async ({
    page,
}) => {
    const state = await open(page, 'sales-tax-code-trainer');
    await page.getByRole('button', { name: 'Start Training', exact: true }).click();
    await expect(page.locator('#submitBtn')).toBeDisabled();
    await page.locator('.option-btn').first().focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.option-btn[aria-pressed="true"]')).toHaveCount(1);
    await page.locator('#submitBtn').click();
    await expect(page.locator('#feedbackSection')).toBeVisible();
    await axe(page);
    await page.locator('#nextBtn').click();
    for (let i = 1; i < 10; i++) await page.locator('#skipBtn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page);
    await expect(page.locator('#progressDisplay')).toHaveText('10/10');
    for (let round = 0; round < 3; round++) {
        await page.getByRole('button', { name: 'Try Again' }).click();
        await expect(page.locator('#questionNumber')).toHaveText('Question 1 of 10');
        await page.locator('#skipBtn').click();
        await expect(page.locator('#questionNumber')).toHaveText('Question 2 of 10');
        for (let i = 1; i < 10; i++) await page.locator('#skipBtn').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.locator('#incorrectCount')).toHaveText('10');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Start another round' }).click();
    await expect(page.locator('#questionNumber')).toHaveText('Question 1 of 10');
    clean(state);
});
test('CSS final training: basic setup explorer, simulator validation and detective are accessible', async ({
    page,
}) => {
    const state = await open(page, 'shopworks-customer-setup');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: /Field Explorer Learn/ }).focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-sim-call="checkExplorerAnswer"]').first().click();
    await expect(page.locator('#currentScore')).toHaveText('10');
    await expect(page.locator('#gameArea .option-btn:disabled')).toHaveCount(3);
    await page.getByRole('button', { name: 'Show Hint' }).click();
    await expect(page.locator('#hintBox')).toBeVisible();
    await axe(page);
    await page.getByRole('button', { name: /Setup Simulator Practice/ }).click();
    await page.getByRole('button', { name: 'Submit Setup' }).click();
    await expect(page.locator('#feedback')).toContainText('Some fields');
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(3);
    await axe(page);
    await page.getByRole('button', { name: /Field Detective Identify/ }).click();
    await page.getByRole('button', { name: 'Tax Code is wrong', exact: true }).click();
    await expect(page.locator('#currentScore')).toHaveText('15');
    await expect(page.locator('#feedback')).toContainText('California');
    await axe(page);
    clean(state);
});
test('CSS final training: basic speed game grades current question and cancels mode timers', async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => (Math.random = () => 0));
    const state = await open(page, 'shopworks-customer-setup');
    await page.getByRole('button', { name: /Speed Challenge Test/ }).click();
    await page.getByRole('button', { name: '2200', exact: true }).click();
    await expect(page.locator('#currentScore')).toHaveText('5');
    await page.clock.fastForward(1100);
    await expect(page.locator('#gameArea .question')).toContainText('Portland');
    await page.getByRole('button', { name: '2202', exact: true }).click();
    await expect(page.locator('#currentScore')).toHaveText('10');
    await page.getByRole('button', { name: /Field Explorer Learn/ }).click();
    await page.clock.fastForward(65000);
    await expect(page.locator('#gameArea h2')).toContainText('Field Explorer');
    await page.getByRole('button', { name: /Speed Challenge Test/ }).click();
    await page.clock.fastForward(61000);
    await expect(page.locator('#gameArea h2')).toContainText('Complete');
    await page.getByRole('button', { name: 'Try Again', exact: true }).click();
    await expect(page.locator('#currentScore')).toHaveText('0');
    clean(state);
});
test('CSS final training: enhanced keyboard field help, tax dialog and every simulation mode', async ({ page }) => {
    await page.addInitScript(() => (Math.random = () => 0));
    const state = await open(page, 'shopworks-customer-setup-enhanced');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: 'Field Explorer', exact: true }).click();
    await page.locator('#companyName').focus();
    await expect(page.locator('#fieldDescription')).toContainText('Legal business name');
    await axe(page);
    await page.getByRole('button', { name: 'Choose tax code for account 1', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page);
    await page.getByRole('button', { name: '2203 — Wholesale Sales', exact: true }).click();
    await expect(page.locator('#taxCode1')).toHaveValue('2203');
    await expect(page.locator('#taxExemptToggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#shipTax1')).toHaveText('Shipping taxable: No');
    await page.locator('#taxCode1').fill('bad');
    await expect(page.locator('#taxExempt')).toHaveValue('');
    await expect(page.locator('#taxExempt')).toBeDisabled();
    await page.getByRole('button', { name: 'Setup Simulator', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Setup' }).click();
    await expect(page.locator('#setupFeedback')).toContainText('Score: 0%');
    await axe(page);
    await page.locator('#simSalesperson').selectOption('Nika Lao');
    await page.locator('#simSource').selectOption('Web');
    await page.locator('#simCustomerType').selectOption('Corporate');
    await page.locator('#simTaxCode').selectOption('2200');
    await page.getByRole('button', { name: 'Submit Setup' }).click();
    await expect(page.locator('#setupFeedback')).toContainText('Score: 100%');
    await axe(page);
    await page.getByRole('button', { name: 'Field Detective', exact: true }).click();
    await page.locator('#taxCode1').fill('2200');
    await page.getByRole('button', { name: 'Check for Errors' }).click();
    await expect(page.locator('#detectiveFeedback')).toContainText('Score: 100%');
    await axe(page);
    clean(state);
});
test('CSS final training: enhanced speed scoring and mode switch cancel delayed work', async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => (Math.random = () => 0));
    const state = await open(page, 'shopworks-customer-setup-enhanced');
    await page.getByRole('button', { name: 'Speed Challenge', exact: true }).click();
    await page.locator('#speedTaxCode').fill('2202');
    await page.locator('#speedTaxCode').press('Enter');
    await page.locator('#speedTaxCode').press('Enter');
    await expect(page.locator('#scoreValue')).toHaveText('10');
    await page.getByRole('button', { name: 'Field Explorer', exact: true }).click();
    await page.clock.fastForward(65000);
    await expect(page.locator('#modeContent h4')).toHaveText('Field Explorer');
    await expect(page.locator('#scoreDisplay')).toBeHidden();
    await page.getByRole('button', { name: 'Speed Challenge', exact: true }).click();
    await page.clock.fastForward(61000);
    await expect(page.locator('#modeContent h4')).toContainText('Complete');
    await page.getByRole('button', { name: 'Play Again' }).click();
    await expect(page.locator('#scoreValue')).toHaveText('0');
    await axe(page);
    clean(state);
});
for (const name of ['shopworks-customer-setup', 'shopworks-customer-setup-enhanced'])
    for (const mode of ['unavailable', 'malformed'])
        test('CSS final training: ' + name + ' handles ' + mode + ' saved progress', async ({ page }) => {
            const key = name.endsWith('enhanced') ? 'shopworksTrainingProgress' : 'shopworksBestScore';
            await page.addInitScript(
                ({ mode, key }) => {
                    if (mode === 'unavailable') {
                        Object.defineProperty(Storage.prototype, 'getItem', {
                            value() {
                                throw new Error('Storage denied');
                            },
                        });
                    } else window.localStorage.setItem(key, '{broken');
                },
                { mode, key },
            );
            const state = await open(page, name);
            await expect(page.locator('#storage-status')).toContainText('will not be saved');
            await page
                .getByRole('button', {
                    name: name.endsWith('enhanced') ? 'Field Explorer' : /Field Explorer Learn/,
                    exact: name.endsWith('enhanced'),
                })
                .click();
            await expect(page.locator(name.endsWith('enhanced') ? '#modeContent h4' : '#gameArea h2')).toContainText(
                'Field Explorer',
            );
            if (mode === 'malformed')
                expect(await page.evaluate((key) => window.localStorage.getItem(key), key)).toBe('{broken');
            clean(state);
        });
test('CSS final training: successful basic setup counts once and its delayed next scenario is cancelled', async ({
    page,
}) => {
    await page.clock.install();
    const state = await open(page, 'shopworks-customer-setup');
    await page.getByRole('button', { name: /Setup Simulator Practice/ }).click();
    await page.locator('#taxCode').selectOption('2200');
    await page.locator('#customerType').selectOption('Construction');
    await page.locator('#salesperson').selectOption('Taylar');
    await page.getByRole('button', { name: 'Submit Setup' }).click();
    await expect(page.locator('#currentScore')).toHaveText('25');
    await expect(page.getByRole('button', { name: 'Submit Setup' })).toBeDisabled();
    expect(await page.evaluate(() => window.localStorage.getItem('shopworksBestScore'))).toBe('25');
    await page.getByRole('button', { name: /Field Detective Identify/ }).click();
    await page.clock.fastForward(5000);
    await expect(page.locator('#gameArea h2')).toContainText('Field Detective');
    clean(state);
});
for (const name of ['shopworks-customer-setup', 'shopworks-customer-setup-enhanced'])
    test('CSS final training: ' + name + ' keeps valid progress and shows write failure', async ({ page }) => {
        const enhanced = name.endsWith('enhanced'),
            key = enhanced ? 'shopworksTrainingProgress' : 'shopworksBestScore';
        await page.clock.install();
        await page.addInitScript(
            ({ enhanced, key }) => {
                window.localStorage.setItem(
                    key,
                    enhanced
                        ? JSON.stringify({
                              completedScenarios: [],
                              achievements: [],
                              highScores: { fieldExplorer: 0, setupSimulator: 0, fieldDetective: 0, speedChallenge: 5 },
                          })
                        : '5',
                );
                Object.defineProperty(Storage.prototype, 'setItem', {
                    value() {
                        throw new Error('Quota unavailable');
                    },
                });
                Math.random = () => 0;
            },
            { enhanced, key },
        );
        const state = await open(page, name);
        await expect(page.locator('#storage-status')).toBeHidden();
        if (enhanced) {
            await page.getByRole('button', { name: 'Speed Challenge', exact: true }).click();
            await page.locator('#speedTaxCode').fill('2202');
            await page.getByRole('button', { name: 'Submit', exact: true }).click();
            await page.clock.fastForward(61000);
            await expect(page.locator('#modeContent')).toContainText('10 points');
        } else {
            await expect(page.locator('#bestScore')).toHaveText('5');
            await page.getByRole('button', { name: /Field Explorer Learn/ }).click();
            await page.locator('[data-sim-call="checkExplorerAnswer"]').first().click();
            await expect(page.locator('#currentScore')).toHaveText('10');
        }
        await expect(page.locator('#storage-status')).toContainText('will not be saved');
        expect(await page.evaluate((key) => window.localStorage.getItem(key), key)).toBe(
            enhanced
                ? '\{"completedScenarios":[],"achievements":[],"highScores":\{"fieldExplorer":0,"setupSimulator":0,"fieldDetective":0,"speedChallenge":5}}'
                : '5',
        );
        clean(state);
    });
