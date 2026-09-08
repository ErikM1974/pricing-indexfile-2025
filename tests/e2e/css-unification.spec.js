const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');

// Render the owned HTML directly so admin-only reference pages can be tested with
// deterministic fixtures. Page access is covered separately; no production gate is changed.
async function documentFixture(page, file) {
    await page.route(`http://localhost:3400/${file}`, route => route.fulfill({
        contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, file), 'utf8'),
    }));
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Unmocked service in CSS fixture' } }));
}

async function shot(page, name) {
    if (!process.env.CSS_SHOT_TAG) return;
    const folder = path.join(__dirname, 'screenshots/css-unification');
    fs.mkdirSync(folder, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(folder, `${process.env.CSS_SHOT_TAG}-${name}.png`), fullPage: true });
}

const queueFixture = {
    candidates: [
        { subject: 'Fixture boathouse', city: 'Tacoma', vacancy: 17, nostalgia: 15, research: { query: 'fixture boathouse', summary: 'A fixture research note.' } },
        { subject: 'Fixture diner', city: 'Milton', vacancy: 15, nostalgia: 8 },
        { subject: 'Fixture skyline', city: 'Tacoma', vacancy: 4, nostalgia: 5, templatable: true },
    ],
    catalogue: [], briefs: [], generatedAt: '2026-09-08',
};
const metricsFixture = { success: true, catalogue: { available: false, error: 'Fixture catalogue unavailable' }, traffic: { available: false }, sales: { available: false }, leaks: { available: false } };

test('CSS pilot: queue filtering, expanded research and unavailable metrics retain their meaning', async ({ page }) => {
    await documentFixture(page, 'dashboards/design-queue.html');
    await page.route('**/dashboards/data/design-queue.json*', route => route.fulfill({ json: queueFixture }));
    await page.route('**/api/gear/store-metrics*', route => route.fulfill({ json: metricsFixture }));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dashboards/design-queue.html');
    await expect(page.locator('#queue-root .dq-row')).toHaveCount(3);
    await expect(page.locator('#metrics-root')).toContainText('Catalogue unreadable');
    await expect(page.locator('#metrics-root .dq-metric-value')).toHaveCount(0);
    await shot(page, 'queue-desktop');
    await page.locator('.dq-stat-btn[data-filter="draw"]').click();
    await expect(page.locator('#queue-root .dq-row')).toHaveCount(1);
    await expect(page.locator('#dq-filters button[aria-pressed="true"]')).toHaveText('Draw this');
    await page.locator('#queue-root summary').click();
    await expect(page.locator('#queue-root details')).toHaveAttribute('open', '');
    await page.locator('.dq-stat-btn[data-filter="draw"]').click();
    await expect(page.locator('#queue-root .dq-row')).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'queue-mobile');
});

test('CSS pilot: queue errors remain visible and retry restores data', async ({ page }) => {
    let fail = true;
    await documentFixture(page, 'dashboards/design-queue.html');
    await page.route('**/dashboards/data/design-queue.json*', route => route.fulfill(fail ? { status: 503, json: {} } : { json: queueFixture }));
    await page.route('**/api/gear/store-metrics*', route => route.fulfill({ status: 503, json: {} }));
    await page.goto('/dashboards/design-queue.html');
    await expect(page.locator('.dash-error-banner')).toBeVisible();
    await expect(page.locator('#queue-root')).toContainText('Could not load');
    await shot(page, 'queue-error');
    fail = false;
    await page.locator('#queue-root').getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#queue-root .dq-row')).toHaveCount(3);
    await expect(page.locator('.dash-error-banner')).toBeHidden();
});

test('CSS pilot: inquiry keeps validation, date entry, payload, retry and success behavior', async ({ page }) => {
    await documentFixture(page, 'pages/webstore-inquiry.html');
    const posted = [];
    let fail = true;
    let release;
    await page.route('**/api/form-submissions', async route => {
        posted.push(route.request().postDataJSON());
        await new Promise(resolve => { release = resolve; });
        await route.fulfill(fail ? { status: 503, json: { error: 'Fixture outage' } } : { json: { submissionId: 'WSR-FIXTURE' } });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/pages/webstore-inquiry.html');
    await shot(page, 'inquiry-desktop');
    await page.locator('#submitStoreBtn').click();
    await expect(page.locator('#fldName')).toBeFocused();
    await expect(page.locator('.public-form-banner')).toContainText('Please enter your name');
    await page.locator('#fldName').fill('Fixture User');
    await page.locator('#fldCompany').fill('Fixture Organization');
    await page.locator('#fldEmail').fill('fixture@example.test');
    await page.locator('#fldPhone').fill('253-555-0100');
    await page.locator('#fldHeadcount').fill('45');
    await page.locator('#fldLaunch').fill('flexible');
    await page.locator('.date-pick-native').evaluate(el => { el.value = '2026-10-01'; el.dispatchEvent(new Event('change')); });
    await expect(page.locator('#fldLaunch')).toHaveValue('10/1/2026');
    await page.locator('#stWindow').check();
    await page.locator('#stAlwaysOn').check();
    await page.locator('#payCompany').check();
    await page.locator('#paySplit').check();
    await page.locator('#fldProducts').fill('Polos and caps');
    await page.locator('#fldNotes').fill('Fixture notes');
    await page.locator('#submitStoreBtn').click();
    await expect.poll(() => posted.length).toBe(1);
    await expect(page.locator('#submitStoreBtn')).toBeDisabled();
    await shot(page, 'inquiry-sending');
    release();
    await expect(page.locator('.public-form-banner')).toContainText("That didn't go through");
    await expect(page.locator('#fldProducts')).toHaveValue('Polos and caps');
    await expect(page.locator('#submitStoreBtn')).toBeEnabled();
    expect(posted[0]).toMatchObject({ formId: 'webstore-request', company: 'Fixture Organization', email: 'fixture@example.test', dueDateIso: '2026-10-01', hp: '', salesRep: '' });
    expect(posted[0].summary).toContain('company-paid');
    expect(posted[0].payload.checks).toEqual(['Order window', 'Always-open store', 'Company pays', 'Mix — company allowance']);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'inquiry-mobile-error');
    fail = false;
    await page.locator('#submitStoreBtn').click();
    await expect.poll(() => posted.length).toBe(2);
    release();
    await expect(page.locator('.public-success')).toBeVisible();
    await expect(page.locator('.public-success-ref')).toHaveText('WSR-FIXTURE');
    await expect(page.locator('.public-submit-row')).toBeHidden();
    for (const section of await page.locator('.form-section').all()) await expect(section).toBeHidden();
    await shot(page, 'inquiry-success');
});

test('CSS pilot: reference pages load their content', async ({ page }) => {
    for (const file of ['dashboards/brand-standards.html', 'pages/art-billing-reference.html']) {
        await documentFixture(page, file);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/' + file);
        await expect(page.locator('h1')).toBeVisible();
        if (file.includes('brand-standards')) await expect(page.locator('#colour-sections .swatch').first()).toBeVisible();
        await shot(page, file.includes('brand') ? 'reference-desktop' : 'billing-desktop');
        await page.setViewportSize({ width: 390, height: 844 });
        await shot(page, file.includes('brand') ? 'reference-mobile' : 'billing-mobile');
        if (file.includes('billing')) {
            await page.emulateMedia({ media: 'print' });
            await shot(page, 'billing-print');
            await page.emulateMedia({ media: 'screen' });
        }
    }
});

async function checkLayout(page) {
    const extent = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(extent.page).toBeLessThanOrEqual(extent.viewport + 1);
}

async function checkAccessibility(page, include) {
    const AxeBuilder = require('@axe-core/playwright').default;
    let builder = new AxeBuilder({ page });
    if (include) builder = builder.include(include);
    const results = await builder.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
}

test('CSS pilot: accessible layouts, department themes, density and keyboard confirmation', async ({ page }) => {
    await documentFixture(page, 'dashboards/brand-standards.html');
    await page.goto('/dashboards/brand-standards.html');
    await expect(page.locator('#colour-sections .swatch').first()).toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page);
    }
    for (const department of ['brand', 'steve', 'ruth', 'bradley', 'floor', 'ae']) {
        await page.locator('#demo-department').selectOption(department);
        await checkAccessibility(page, '#components');
        const before = await page.locator('#components').evaluate(el => ({
            space: getComputedStyle(el).getPropertyValue('--space-8').trim(),
            padding: getComputedStyle(el).paddingTop,
        }));
        await page.locator('#demo-density').selectOption('compact');
        const after = await page.locator('#components').evaluate(el => ({
            space: getComputedStyle(el).getPropertyValue('--space-8').trim(),
            padding: getComputedStyle(el).paddingTop,
        }));
        expect(before.space).toBe(after.space);
        expect(before.padding).not.toBe(after.padding);
        await page.locator('#demo-density').selectOption('comfortable');
    }
    await page.locator('#demo-open').click();
    await expect(page.locator('#demo-dialog')).toBeVisible();
    await checkAccessibility(page, '#demo-dialog');
    await page.keyboard.press('Escape');
    await expect(page.locator('#demo-dialog')).toBeHidden();
    await expect(page.locator('#demo-open')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.locator('#demo-confirm').click();
    await expect(page.locator('#demo-result')).toBeVisible();
    await expect(page.locator('#demo-open')).toBeFocused();
});

test('CSS pilot: queue loading, empty results and mobile accessibility', async ({ page }) => {
    await documentFixture(page, 'dashboards/design-queue.html');
    const waiting = [];
    await page.route('**/dashboards/data/design-queue.json*', route => {
        waiting.push(route);
    });
    await page.route('**/api/gear/store-metrics*', route => route.fulfill({ json: metricsFixture }));
    await page.goto('/dashboards/design-queue.html');
    await expect(page.locator('#queue-root')).toContainText('Loading');
    await expect.poll(() => waiting.length).toBe(2);
    for (const route of waiting) await route.fulfill({ json: { ...queueFixture, candidates: [] } });
    await expect(page.locator('#queue-root .dq-row')).toHaveCount(0);
    await expect(page.locator('#stat-checked')).toHaveText('0');
    await expect(page.locator('#queue-root')).not.toHaveClass('dash-loading');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page);
        await checkAccessibility(page);
    }
});

test('CSS pilot: public inquiry and billing stay accessible and usable at narrow widths', async ({ page }) => {
    for (const file of ['pages/webstore-inquiry.html', 'pages/art-billing-reference.html']) {
        await documentFixture(page, file);
        await page.goto('/' + file);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await checkLayout(page);
            await checkAccessibility(page);
        }
        if (file.includes('inquiry')) {
            await page.locator('#submitStoreBtn').click();
            await expect(page.getByRole('alert')).toContainText('Please enter');
            await checkAccessibility(page);
            const input = await page.locator('#fldLaunch').boundingBox();
            const button = await page.locator('.date-pick-btn').boundingBox();
            expect(button.y).toBeGreaterThanOrEqual(input.y - 1);
            expect(button.y + button.height).toBeLessThanOrEqual(input.y + input.height + 1);
            await expect(page.locator('#hpWebsite')).toBeHidden();
        } else {
            await page.setViewportSize({ width: 816, height: 1056 });
            await page.emulateMedia({ media: 'print' });
            await checkLayout(page);
            await expect(page.locator('.billing-code-price').first()).toHaveText('$50');
            for (const amount of await page.locator('.amount, .time-price, .fee-amount').all()) await expect(amount).toBeVisible();
            await page.emulateMedia({ media: 'screen' });
        }
    }
});

test('CSS pilot: shared public helper announces failure and focuses success on request-a-quote too', async ({ page }) => {
    await documentFixture(page, 'pages/request-a-quote.html');
    await page.route('**/api/form-submissions', route => route.fulfill({ json: { submissionId: 'REQ-FIXTURE' } }));
    await page.goto('/pages/request-a-quote.html');
    await page.locator('.public-submit').click();
    await expect(page.getByRole('alert')).toContainText('Please enter');
    // Exercise the shared helper with this form's real serializer and required contact fields.
    await page.locator('#fldName').fill('Fixture User');
    await page.locator('#fldCompany').fill('Fixture Organization');
    await page.locator('#fldEmail').fill('fixture@example.test');
    await page.locator('#fldPhone').fill('253-555-0100');
    await page.locator('#fldWhat').fill('Fixture crew apparel');
    await page.locator('.public-submit').click();
    await expect(page.locator('.public-success')).toBeVisible();
    await expect(page.locator('.public-success')).toBeFocused();
    await expect(page.locator('.public-success-ref')).toHaveText('REQ-FIXTURE');
});

test('CSS pilot: populated briefs keep image credits and metric tables remain keyboard reachable', async ({ page }) => {
    await documentFixture(page, 'dashboards/design-queue.html');
    const data = { ...queueFixture, briefs: [{
        rank: 1, subject: 'Fixture waterfront community boathouse', where: 'Milton, Washington', confidence: 'confirmed',
        why: 'A fixture with a long title checks the working brief at phone widths.',
        shirtText: { main: 'MILTON BOATHOUSE', secondary: 'Community waterfront', small: 'Washington' },
        images: [{ url: '/favicon.png', caption: 'Fixture illustration', credit: 'Fixture image credit — always visible' }],
        designDirection: 'Draw an original illustration.', textNotes: 'Preserve this written instruction.',
    }] };
    await page.route('**/dashboards/data/design-queue.json*', route => route.fulfill({ json: data }));
    await page.route('**/api/gear/store-metrics*', route => route.fulfill({ json: {
        ...metricsFixture,
        catalogue: { available: true, activeProducts: 47, medianWords: 250, thinCopy: { count: 0 }, draftProducts: 2 },
        traffic: { available: true, windowDays: 30, totals: { rows: [[321]] }, bySource: { columns: ['Source', 'Sessions'], rows: [['Fixture search traffic from Washington', 321]] } },
    } }));
    await page.goto('/dashboards/design-queue.html');
    await expect(page.locator('.dq-brief-card')).toHaveCount(1);
    await expect(page.locator('.dq-metrics-table')).toHaveCount(1);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page);
        await checkAccessibility(page);
        await expect(page.locator('.dq-fig-credit')).toHaveText('Fixture image credit — always visible');
        await expect(page.locator('.dq-fig-credit')).toBeVisible();
        const region = page.getByRole('region', { name: 'Store metrics; scroll for all columns' });
        await region.focus();
        await expect(region).toBeFocused();
        await expect(region).toContainText('321');
        await shot(page, 'queue-populated-' + width);
    }
});
