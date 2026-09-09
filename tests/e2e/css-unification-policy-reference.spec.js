const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const Keygrip = require('keygrip');
const { TEST_SESSION_SECRET } = require('./staff-session');
const routes = ['/dashboards/policy-migration.html', '/pages/pricing-negotiation-policy.html', '/pages/resources.html', '/pages/sale.html'];
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
const sample = { stats: { hub_live: 3 }, confidential_count: 0, erik_questions: ['Question fixture'], wave_log: [{ when: '2026-07-10', what: 'Published fixture', pid: 'policy-a' }], rows: [
    { t: 'Accounting reference', d: 'Finance', n: 'PUBLISHED fixture', v: 'HUB', tier: 'CORE', g: 'Money', pid: 'policy-a' },
    { t: 'Shipping reference', d: 'Shipping', n: 'Needs confirmation', v: 'HUB', tier: 'ERIK', g: '', pid: 'policy-b' },
    { t: 'Archived reference', d: 'General', n: 'Historic record', v: 'ARCHIVE', tier: 'AUTO', g: '', pid: '' },
] };
async function open(page, route, data) {
    if (route.includes('migration')) {
        const value = Buffer.from(JSON.stringify({ crmUser: { name: 'Migration Harness', email: 'e2e-harness@nwcustomapparel.com', role: 'admin', permissions: ['admin'], via: 'saml' } })).toString('base64');
        const signature = new Keygrip([TEST_SESSION_SECRET]).sign('nwca_staff=' + value);
        await page.context().addCookies([{ name: 'nwca_staff', value }, { name: 'nwca_staff.sig', value: signature }].map(cookie => ({ ...cookie, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' })));
    }
    const state = { errors: [], writes: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', handle => {
        const req = handle.request(), url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return handle.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(req.method())) { state.writes.push(url.pathname); return handle.fulfill({ status: 503, body: 'Business writes blocked' }); }
        if (data !== undefined && url.pathname === '/dashboards/policy-migration-data.json') return handle.fulfill({ status: typeof data === 'number' ? data : 200, json: typeof data === 'number' ? { error: 'Offline fixture' } : data });
        if (url.pathname.startsWith('/api/')) return handle.fulfill({ status: 503, json: { error: 'Business calls blocked' } });
        return handle.fallback();
    });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    if (route.includes('migration')) await expect(page.locator('#content-root')).toHaveAttribute('aria-busy', 'false');
    return state;
}
const clean = state => { expect(state.errors).toEqual([]); expect(state.writes).toEqual([]); };
const axe = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
for (const route of routes) test('CSS policy reference: ' + route + ' at four widths', async ({ page }) => {
    test.setTimeout(180000);
    const state = await open(page, route);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await axe(page);
        await page.screenshot({ path: path.join(output, 'policy-reference-' + path.basename(route, '.html') + '-' + width + '.png') });
    }
    clean(state);
});
test('CSS policy reference: tracker retains anonymous and ordinary staff restrictions', async ({ browser, baseURL, request }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try { expect([302, 303, 401, 403]).toContain((await context.request.get(routes[0], { maxRedirects: 0 })).status()); }
    finally { await context.close(); }
    expect((await request.get(routes[0], { maxRedirects: 0 })).status()).toBe(403);
});
test('CSS policy reference: tracker filters work by keyboard, empty is explicit and the table scrolls', async ({ page }) => {
    const state = await open(page, routes[0], sample);
    await page.locator('button[data-tier="CORE"]').focus(); await page.keyboard.press('Space');
    await expect(page.locator('button[data-tier="CORE"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Accounting reference');
    await page.getByRole('searchbox').fill('No matching document');
    await expect(page.getByRole('status').filter({ hasText: 'No documents match' })).toBeVisible();
    await page.getByRole('searchbox').fill('');
    await page.locator('button[data-tier="CORE"]').click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.setViewportSize({ width: 320, height: 900 });
    const table = page.getByRole('region', { name: 'Document tracker; scroll horizontally' });
    await table.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    clean(state);
});
for (const [name, data] of [['offline', 503], ['malformed', { rows: null }]]) test('CSS policy reference: tracker ' + name + ' retries while preserving search', async ({ page }) => {
    const state = await open(page, routes[0], data);
    await expect(page.locator('.dash-error-banner')).toContainText('Unable to load');
    await page.getByRole('searchbox').fill('Shipping');
    await page.route('**/policy-migration-data.json*', r => r.fulfill({ json: sample }));
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('.dash-error-banner')).toBeHidden();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('searchbox')).toHaveValue('Shipping');
    clean(state);
});
test('CSS policy reference: tracker safely renders external text and a valid empty snapshot', async ({ page }) => {
    const value = '<img src=x onerror=alert(1)>', data = JSON.parse(JSON.stringify(sample));
    data.rows[0].t = value; data.erik_questions = [value];
    const state = await open(page, routes[0], data);
    await expect(page.locator('tbody')).toContainText(value);
    await expect(page.locator('main img')).toHaveCount(0);
    await page.route('**/policy-migration-data.json*', r => r.fulfill({ json: { ...sample, rows: [] } }));
    await page.reload();
    await expect(page.locator('#content-root')).toContainText('No documents are available');
    clean(state);
});
test('CSS policy reference: mobile guide contents, native history and back to top keep focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await open(page, routes[1]);
    const contents = page.locator('.policy-contents');
    await expect(contents).not.toHaveAttribute('open');
    await contents.locator('summary').focus(); await page.keyboard.press('Enter');
    await expect(contents).toHaveAttribute('open');
    const links = contents.locator('a[href^="#"]');
    const targets = await links.evaluateAll(anchors => anchors.map(a => a.getAttribute('href')));
    for (const target of targets) {
        await contents.locator('a[href="' + target + '"]').click();
        await expect(page).toHaveURL(new RegExp(target + '$'));
        await expect(page.locator(target)).toBeFocused();
    }
    await page.goBack(); await expect(page).toHaveURL(new RegExp(targets.at(-2) + '$'));
    await page.getByRole('button', { name: 'Back to top' }).click();
    await expect(page.locator('#guide-top')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Back to top' })).toBeHidden();
    clean(state);
});
for (const route of routes) test('CSS policy reference: ' + route + ' prints complete content and restores controls', async ({ page }) => {
    const state = await open(page, route);
    if (route.includes('migration')) await page.getByRole('searchbox').fill('Shipping');
    if (route.includes('negotiation')) await page.locator('.policy-contents').evaluate(el => el.open = false);
    await page.evaluate(() => window.addEventListener('beforeprint', () => window.__printedMigrationRows = document.querySelectorAll('.pm-table tbody tr').length));
    const pdf = await page.pdf({ path: path.join(output, 'policy-reference-' + path.basename(route, '.html') + '.pdf'), format: 'Letter', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }, printBackground: true });
    const count = (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length;
    expect(count).toBeGreaterThan(0); expect(count).toBeLessThan(150);
    if (route.includes('migration')) {
        const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../../dashboards/policy-migration-data.json'), 'utf8'));
        expect(await page.evaluate(() => window.__printedMigrationRows)).toBe(original.rows.length);
        await expect(page.getByRole('searchbox')).toHaveValue('Shipping');
    }
    if (route.includes('negotiation')) await expect(page.locator('.policy-contents')).not.toHaveAttribute('open');
    if (route.includes('resources') || route.includes('/sale')) expect(count).toBe(1);
    clean(state);
});
