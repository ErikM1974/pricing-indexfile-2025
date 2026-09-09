const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const names = ['customer-categorization-training', 'lead-email-templates', 'lead-source-training', 'training-games-hub', 'shopworks-notes', 'shopworks-sales-tax-training', 'team-match-game'];
const output = path.join(__dirname, 'screenshots/css-unification');
test.describe.configure({ mode: 'parallel' });
test.use({ hasTouch: true });
fs.mkdirSync(output, { recursive: true });

async function open(page, name) {
    const state = { errors: [], writes: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        const request = route.request();
        // Axe's injected script triggers report-only CSP; absorb this local diagnostic.
        if (new URL(request.url()).pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) {
            state.writes.push(request.url());
            return route.fulfill({ status: 503, json: { error: 'Training tests block all business writes' } });
        }
        if (new URL(request.url()).pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'No business services in training tests' } });
        return route.continue();
    });
    await page.goto('/training/' + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    return state;
}
function clean(state) { expect(state.errors).toEqual([]); expect(state.writes).toEqual([]); }
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function keyboardClick(page, locator) { await locator.focus(); await page.keyboard.press('Enter'); }

for (const name of names) {
    test('CSS training practice: ' + name + ' four widths and original navigation', async ({ page }) => {
        const state = await open(page, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await axe(page);
            await page.screenshot({ path: path.join(output, 'training-practice-' + name + '-' + width + '.png'), fullPage: true });
            if (width === 1440) await page.screenshot({ path: path.join(output, 'training-practice-' + name + '-desktop.png') });
        }
        const back = page.locator('.nav-header a').first();
        await expect(back).toBeVisible();
        await expect(back).toHaveAttribute('href', name === 'shopworks-notes' ? 'training-games-hub.html' : '/staff-dashboard.html');
        clean(state);
    });
}

test('CSS training practice: notes examples and visible empty/incorrect/correct feedback', async ({ page }) => {
    const state = await open(page, 'shopworks-notes');
    for (let n = 1; n <= 5; n++) {
        const answer = page.locator('#practice' + n), feedback = page.locator('#feedback' + n);
        const check = page.locator('[data-call="checkAnswer"]').nth(n - 1);
        await keyboardClick(page, check);
        await expect(feedback).toContainText('Please write');
        await answer.fill('hello'); await check.click(); await expect(feedback).toContainText('needs more detail');
        await keyboardClick(page, page.locator('[data-call="showExample"]').nth(n - 1));
        await check.click(); await expect(feedback).toContainText('Great job');
    }
    await axe(page); clean(state);
});

test('CSS training practice: templates combine filters/search and copy failure can retry', async ({ page }) => {
    const state = await open(page, 'lead-email-templates');
    await page.evaluate(() => {
        window.copiedText = '';
        window.copyFails = true;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
            if (window.copyFails) throw new Error('Fixture denied'); window.copiedText = text;
        } } });
    });
    await page.locator('[data-call="filterTemplates"]').nth(1).click();
    const category = await page.locator('.filter-btn.active').getAttribute('data-args');
    await page.locator('.search-bar input').fill('ZZZ not a template');
    await expect(page.locator('.template-card:visible')).toHaveCount(0);
    await expect(page.locator('#training-template-results')).toContainText('No matching');
    await page.locator('.search-bar input').fill('');
    for (const card of await page.locator('.template-card:visible').all()) await expect(card).toHaveAttribute('data-category', JSON.parse(category)[0]);
    const card = page.locator('.template-card:visible').first();
    const original = await card.locator('.template-content').textContent();
    await keyboardClick(page, card.locator('[data-call="copyTemplate"]'));
    await expect(page.locator('#successMessage')).toContainText('Could not copy');
    await page.evaluate(() => { window.copyFails = false; });
    await card.locator('[data-call="copyTemplate"]').click();
    await expect(page.locator('#successMessage')).toContainText('copied');
    expect(await page.evaluate(() => window.copiedText)).toBe(original);
    clean(state);
});

test('CSS training practice: template editor traps focus, restores focus, saves and reloads safely', async ({ page }) => {
    const state = await open(page, 'lead-email-templates');
    const edit = page.locator('[data-call="editTemplate"]').first();
    await keyboardClick(page, edit);
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(page.locator('#templateName')).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.locator('.modal-close')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(modal).toBeHidden(); await expect(edit).toBeFocused();
    await edit.click();
    await page.locator('#templateName').fill('Saved fixture');
    await page.locator('#templateSubject').fill('Fixture subject');
    await page.locator('#templateBody').fill('<img src=x onerror=alert(1)>');
    await keyboardClick(page, page.locator('.variable-chip').first());
    await expect(page.locator('#templateBody')).toHaveValue(/\[Name\]/);
    await axe(page);
    await page.getByRole('button', { name: 'Save Template', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.reload();
    await expect(page.getByText('Saved fixture', { exact: true })).toBeVisible();
    const saved = page.locator('.template-card').filter({ hasText: 'Saved fixture' });
    await expect(saved.locator('.template-content')).toContainText('<img');
    await expect(saved.locator('img')).toHaveCount(0);
    clean(state);
});

test('CSS training practice: storage failure preserves edits and malformed storage is not replaced', async ({ page }) => {
    const state = await open(page, 'lead-email-templates');
    await page.evaluate(() => localStorage.setItem('nwca_email_templates', 'malformed fixture'));
    await page.reload();
    await expect(page.locator('#successMessage')).toContainText('Could not load');
    await page.locator('[data-call="editTemplate"]').first().click();
    await page.locator('#templateName').fill('Unsaved fixture');
    await page.getByRole('button', { name: 'Save Template', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#templateForm [role="status"]')).toContainText('Could not save');
    await expect(page.locator('#templateName')).toHaveValue('Unsaved fixture');
    expect(await page.evaluate(() => localStorage.getItem('nwca_email_templates'))).toBe('malformed fixture');
    await page.evaluate(() => localStorage.removeItem('nwca_email_templates'));
    await page.getByRole('button', { name: 'Save Template', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    clean(state);
});

test('CSS training practice: team matching keyboard/touch, wrong answer, duplicate guard and modes', async ({ page }) => {
    const state = await open(page, 'team-match-game');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Job Positions', exact: true }).click();
    const erik = page.locator('#employeesList').getByRole('button', { name: 'Erik Mickelson', exact: true });
    await keyboardClick(page, erik);
    await keyboardClick(page, page.locator('.drop-zone').filter({ hasText: /^CEO$/ }));
    await expect(page.locator('#attempts')).toHaveText('1'); await expect(page.locator('#score')).toHaveText('0');
    await erik.tap();
    await page.locator('.drop-zone').filter({ hasText: /^Operations Manager$/ }).tap();
    await expect(page.locator('#score')).toHaveText('1'); await expect(erik).toBeDisabled();
    await page.locator('.employee-card:not(:disabled)').first().click();
    await axe(page);
    for (const mode of ['Birthdays', 'Mix Challenge', 'Years of Service']) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        await expect(page.locator('#score')).toHaveText('0'); await expect(page.locator('#attempts')).toHaveText('0');
        await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    clean(state);
});

test('CSS training practice: customer categorization tap/keyboard round and quiz score resets', async ({ page }) => {
    const state = await open(page, 'customer-categorization-training');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Practice Mode/ }).click();
    const customer = page.locator('.customer-card').first();
    const category = await customer.getAttribute('data-category');
    await customer.tap();
    await keyboardClick(page, page.locator('.category-drop-zone[data-category="' + category + '"]'));
    await expect(page.locator('#score')).toHaveText('5');
    await expect(page.locator('.customer-card')).toHaveCount(11);
    await page.getByRole('button', { name: /Quiz Challenge/ }).click();
    await expect(page.locator('#score')).toHaveText('0');
    for (let n = 0; n < 10; n++) {
        const buttons = page.locator('.option-btn');
        const correct = await buttons.evaluateAll(elements => elements.find(el => { const args = JSON.parse(el.dataset.args); return args[0] === args[1]; }).textContent.trim());
        await keyboardClick(page, page.getByRole('button', { name: correct, exact: true }));
        await expect(page.locator('#feedback')).toContainText('Correct');
        await page.getByRole('button', { name: /Next Question/ }).click();
    }
    await expect(page.locator('.results-screen')).toContainText('100%');
    await page.getByRole('button', { name: 'Try Again' }).click(); await expect(page.locator('#score')).toHaveText('0');
    await axe(page); clean(state);
});

test('CSS training practice: source scenarios/referrals/speed options remain usable', async ({ page }) => {
    await page.clock.install();
    const state = await open(page, 'lead-source-training');
    const modes = page.locator('.mode-btn');
    await modes.nth(1).click();
    await keyboardClick(page, page.locator('#scenarioMode .source-option').first());
    await expect(page.locator('#totalCount')).toHaveText('1'); await expect(page.locator('#feedbackArea')).not.toBeEmpty();
    await page.locator('#scenarioMode [data-call="nextScenario"]').click();
    await modes.nth(2).click();
    const before = await page.locator('#referralQuestions h3').textContent();
    await page.locator('[data-call="checkReferralAnswer"]').click();
    await expect(page.locator('#referralQuestions h3')).toHaveText(before);
    const answer = await page.evaluate(() => referralScenarios[currentReferralIndex].questions[currentReferralQuestion].answer);
    await keyboardClick(page, page.locator('#referralQuestions').getByRole('button', { name: answer, exact: true }));
    await page.locator('[data-call="checkReferralAnswer"]').click();
    await expect(page.locator('#referralQuestions')).not.toBeEmpty();
    await modes.nth(3).click();
    const correct = await page.locator('#speedDialogue').getAttribute('data-correct-source');
    await keyboardClick(page, page.locator('#speedOptions .source-option[data-source="' + correct + '"]'));
    await expect(page.locator('#speedScore')).toHaveText('10');
    await page.clock.runFor(61000);
    await expect(page.locator('#speedDialogue')).toContainText("Time's Up!");
    await expect(page.locator('#speedOptions')).toBeEmpty();
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page.locator('#speedScore')).toHaveText('0');
    await modes.first().click();
    const stopped = await page.locator('#timeLeft').textContent();
    await page.clock.fastForward(1100);
    await expect(page.locator('#timeLeft')).toHaveText(stopped);
    await axe(page); clean(state);
});

test('CSS training practice: tax answers cannot double-count and complete/restart correctly', async ({ page }) => {
    const state = await open(page, 'shopworks-sales-tax-training');
    for (let n = 0; n < 10; n++) {
        // Exercise the real answer key from the unchanged training fixture; no external tax service.
        const correct = await page.evaluate(() => taxScenarios[currentScenarioIndex].expectedTaxCode);
        const choice = page.locator('.tax-option[data-code="' + correct + '"]');
        await keyboardClick(page, choice);
        await page.locator('#submitBtn').click();
        await expect(page.locator('#scoreValue')).toHaveText(String(n + 1));
        await expect(choice).toBeDisabled();
        await expect(page.locator('#submitBtn')).toBeDisabled();
        if (n < 9) await page.getByRole('button', { name: 'Next Scenario', exact: true }).click();
    }
    await expect(page.locator('#completionSection')).toBeVisible();
    await expect(page.locator('#finalScore')).toHaveText('10');
    await page.getByRole('button', { name: 'Practice Again' }).click();
    await expect(page.locator('#scoreValue')).toHaveText('0');
    await axe(page); clean(state);
});

for (const name of ['training-games-hub', 'shopworks-notes', 'lead-email-templates']) {
    test('CSS training practice: ' + name + ' printable reference', async ({ page }) => {
        const state = await open(page, name);
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.nav-header')).toBeHidden();
        const pdf = await page.pdf({ path: path.join(output, 'training-practice-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length;
        expect(pages).toBeGreaterThan(0);
        expect(pages).toBeLessThanOrEqual({ 'training-games-hub': 1, 'shopworks-notes': 6, 'lead-email-templates': 12 }[name]);
        await page.emulateMedia({ media: 'screen' });
        clean(state);
    });
}

test('CSS training practice: team drag, completion dialog and next challenge', async ({ page }) => {
    // Keep both columns visible while performing an actual desktop drag.
    await page.setViewportSize({ width: 1440, height: 2400 });
    const state = await open(page, 'team-match-game');
    await page.getByRole('button', { name: 'Job Positions', exact: true }).click();
    const answers = await page.evaluate(() => employees.map(person => ({ name: person.firstName + ' ' + person.lastName, position: person.position })));
    for (const [index, person] of answers.entries()) {
        const name = page.locator('.employee-card').filter({ hasText: new RegExp('^' + person.name + '$') });
        const target = page.locator('.drop-zone:not(:disabled)').filter({ hasText: new RegExp('^' + person.position.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
        if (index === 0) await name.dragTo(target);
        else { await keyboardClick(page, name); await keyboardClick(page, target); }
        await expect(page.locator('#score')).toHaveText(String(index + 1));
    }
    const dialog = page.getByRole('dialog', { name: 'Team match results' });
    await expect(dialog).toBeVisible(); await expect(dialog.locator('#accuracy')).toHaveText('100');
    await axe(page);
    await dialog.getByRole('button', { name: 'Next Challenge' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Birthdays', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#score')).toHaveText('0');
    clean(state);
});

test('CSS training practice: wrong tax answer shows hint and retry starts fresh', async ({ page }) => {
    const state = await open(page, 'shopworks-sales-tax-training');
    const correct = await page.evaluate(() => taxScenarios[0].expectedTaxCode);
    const wrong = ['2200', '2202', '2203'].find(code => code !== correct);
    await page.locator('.tax-option[data-code="' + wrong + '"]').tap();
    await page.locator('#submitBtn').click();
    await expect(page.locator('#feedback')).toContainText('Incorrect');
    await expect(page.locator('#feedback')).toContainText(correct);
    await expect(page.locator('#hintSection')).toBeVisible();
    await expect(page.locator('#scoreValue')).toHaveText('0');
    await page.setViewportSize({ width: 320, height: 900 });
    await axe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: 'Next Scenario', exact: true }).click();
    await expect(page.locator('#hintSection')).toBeHidden();
    await expect(page.locator('#submitBtn')).toBeDisabled();
    clean(state);
});
