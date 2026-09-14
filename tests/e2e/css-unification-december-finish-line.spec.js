const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const Keygrip = require('keygrip');
const path = require('node:path');
const fs = require('node:fs');
const { TEST_SESSION_SECRET } = require('./staff-session');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
const catalog = { primary: 'planning/outputs/report.html', snapshotLabel: 'September 11, 2026', links: [
    { path: 'planning/outputs/owner.html', title: 'Erik’s weekly plan', description: 'Friday checks and progress backups' },
    { path: 'planning/outputs/sales.pdf', title: 'Sales book', description: 'Prepared customer plan · PDF' },
] };
const live = {
    retrievedAt: '2026-09-14T20:00:00Z', window: { start: '2026-07-17', end: '2026-09-14', today: '2026-09-14' },
    sales: { revenueCents: 1200000, orders: 30, lastArchivedSalesDate: '2026-09-11', lastLiveInvoiceDate: '2026-09-14', months: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, revenueCents: i < 9 ? 100000 : 0, orders: i < 9 ? 3 : 0 })), reps: [{ name: 'Synthetic rep', revenueCents: 1200000 }], comparison: { asOf: '2026-09-11', financialNetSalesCents: 1000000, operationalSalesCents: 1100000, differenceCents: 100000 } },
    goalCents: 2000000, workload: { orders: 5, subtotalCents: 300000, start: '2026-07-17', end: '2026-09-14' }, errors: [],
    coverageNote: 'Synthetic fixture: signed invoice subtotals, with recent dates replacing archive dates.', financialNote: 'Saved accounting data remains dated. Profit is not recalculated from invoices.',
};
async function role(context, permissions) {
    await context.clearCookies();
    if (!permissions) return;
    const value = Buffer.from(JSON.stringify({ crmUser: { firstName: 'Fixture', email: 'synthetic@example.invalid', permissions } })).toString('base64');
    const signature = new Keygrip([TEST_SESSION_SECRET]).sign('nwca_staff=' + value);
    await context.addCookies([{ name: 'nwca_staff', value }, { name: 'nwca_staff.sig', value: signature }].map(cookie => ({ ...cookie, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', secure: false })));
}
async function open(page, state = {}) {
    await role(page.context(), ['admin']);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Business calls are blocked in the synthetic UI review' } }));
    await page.route('**/admin/december-finish-line/catalog', route => route.fulfill(state.catalogFailure ? { status: 503, body: 'Unavailable' } : { json: catalog }));
    await page.route('**/admin/december-finish-line/live*', route => route.fulfill(state.liveFailure ? { status: 503, body: 'Unavailable' } : { json: state.partial ? { ...live, sales: null, errors: ['Sales could not be refreshed. No partial YTD total is shown.'] } : live }));
    await page.goto('/dashboards/december-finish-line.html');
    await expect(page.locator('#finish-live-status')).not.toContainText('Checking');
    await expect(page.locator('#finish-loading')).toBeHidden();
    return errors;
}

test('Finish Line server denies non-admin and anonymous access to every private surface', async ({ context }) => {
    const paths = ['/dashboards/december-finish-line.html', '/dashboards/december-finish-line%2ehtml', '/admin/december-finish-line/catalog', '/admin/december-finish-line/live', '/admin/december-finish-line/files/planning/outputs/report.html', '/admin/december-finish-line/files/model.js', '/admin/december-finish-line/files/book.pdf', '/admin/december-finish-line/files/data.json'];
    for (const permissions of [null, ['staff'], ['sales'], ['accountant']]) {
        await role(context, permissions);
        for (const url of paths) {
            const response = await context.request.get(url, { maxRedirects: 0 });
            expect(response.status()).toBe(permissions ? 403 : 302);
            expect(response.headers()['cache-control']).toContain('no-store');
        }
    }
    await role(context, ['admin']);
    for (const url of ['/private/december-finish-line.enc', '/lib/december-finish-line.js', '/December%20Finish%20Line%20Transfer/READ-ME-FIRST.txt']) {
        expect((await context.request.get(url, { maxRedirects: 0 })).status()).toBe(404);
    }
});

for (const width of [1440, 768, 390, 320]) test(`Finish Line layout, details, keyboard and print at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = await open(page);
    await expect(page.locator('#finish-sales')).toHaveText('$12,000.00');
    await expect(page.locator('#finish-goal')).toHaveText('$20,000.00');
    await expect(page.locator('#finish-remaining')).toHaveText('$8,000.00');
    await expect(page.locator('#finish-months tr')).toHaveCount(12);
    await page.getByText('Monthly sales breakdown', { exact: true }).click();
    await page.getByText('Sales by assigned rep', { exact: true }).click();
    await page.getByText('Sources, coverage and accounting comparison', { exact: true }).click();
    await expect(page.locator('#finish-comparison')).toContainText('needs reconciliation');
    await expect(page.locator('#finish-open')).toHaveAttribute('href', '/admin/december-finish-line/files/planning/outputs/report.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('#finish-refresh').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
    await page.screenshot({ path: path.join(output, `december-finish-line-${width}.png`), fullPage: true });
    if (width === 1440) await page.pdf({ path: path.join(output, 'december-finish-line.pdf'), format: 'Letter', printBackground: true });
    expect(errors).toEqual([]);
});

test('Finish Line errors preserve a useful recovery and never display stale figures as current', async ({ page }) => {
    const errors = await open(page, { catalogFailure: true, liveFailure: true });
    await expect(page.locator('#finish-error')).toBeVisible();
    await expect(page.locator('#finish-live-error')).toBeVisible();
    await expect(page.locator('#finish-content')).toBeHidden();
    await expect(page.locator('#finish-live-data')).toBeHidden();
    await page.unroute('**/admin/december-finish-line/catalog');
    await page.route('**/admin/december-finish-line/catalog', route => route.fulfill({ json: catalog }));
    await page.unroute('**/admin/december-finish-line/live*');
    await page.route('**/admin/december-finish-line/live*', route => route.fulfill({ json: live }));
    await page.locator('#finish-retry').click();
    await page.locator('#finish-refresh').click();
    await expect(page.locator('#finish-content')).toBeVisible();
    await expect(page.locator('#finish-live-data')).toBeVisible();
    expect(errors).toEqual([]);
});

test('Finish Line partial sales failure withholds YTD while retaining a verified goal', async ({ page }) => {
    await open(page, { partial: true });
    await expect(page.locator('#finish-live-error')).toContainText('No partial YTD');
    await expect(page.locator('#finish-sales')).toHaveText('Unavailable');
    await expect(page.locator('#finish-remaining')).toHaveText('Unavailable');
    await expect(page.locator('#finish-goal')).toHaveText('$20,000.00');
});

test('Finish Line expired session gives an explicit sign-in action', async ({ page }) => {
    await open(page, { catalogFailure: true });
    await page.unroute('**/admin/december-finish-line/catalog');
    await page.route('**/admin/december-finish-line/catalog', route => route.fulfill({ status: 401 }));
    await page.locator('#finish-retry').click();
    await expect(page.locator('#finish-login')).toBeVisible();
    await expect(page.locator('#finish-error-message')).toContainText('Sign in again');
});
