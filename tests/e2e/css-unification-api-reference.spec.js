const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const Keygrip = require('keygrip');
const fs = require('node:fs'),
    path = require('node:path');
const { TEST_SESSION_SECRET } = require('./staff-session');
const names = [
    'caspio-api-reference',
    'manageorders-api-reference',
    'sanmar-api-reference',
    'shopworks-odbc-reference',
];
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });

async function authenticate(context, baseURL, email = 'erik@nwcustomapparel.com', role = 'admin') {
    const value = Buffer.from(
        JSON.stringify({ crmUser: { name: 'Reference Harness', email, role, permissions: [role], via: 'saml' } }),
    ).toString('base64');
    const sig = new Keygrip([TEST_SESSION_SECRET]).sign('nwca_staff=' + value);
    await context.clearCookies();
    await context.addCookies(
        [
            { name: 'nwca_staff', value },
            { name: 'nwca_staff.sig', value: sig },
        ].map((cookie) => ({ ...cookie, url: baseURL, httpOnly: true, sameSite: 'Lax' })),
    );
}
async function open(page, baseURL, name, schema) {
    await authenticate(page.context(), baseURL);
    const state = { errors: [], writes: [] };
    page.on('pageerror', (error) => state.errors.push(error.message));
    await page.route('**/*', (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(req.method())) {
            state.writes.push(url.pathname);
            return route.fulfill({ status: 503, body: 'Business writes blocked' });
        }
        if (schema !== undefined && url.pathname.endsWith('/shopworks-odbc-schema.json'))
            return route.fulfill({
                status: typeof schema === 'number' ? schema : 200,
                json: typeof schema === 'number' ? { error: 'Offline fixture' } : schema,
            });
        if (url.pathname.startsWith('/api/'))
            return route.fulfill({ status: 503, json: { error: 'Business services blocked' } });
        return route.fallback();
    });
    await page.goto('/dashboards/' + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    if (name === 'shopworks-odbc-reference')
        await expect(page.locator('#swoTables')).toHaveAttribute('aria-busy', 'false');
    return state;
}
const clean = (state) => {
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
};
const axe = async (page) =>
    expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations,
    ).toEqual([]);

for (const name of names)
    test('CSS API reference: ' + name + ' at four widths', async ({ page, baseURL }) => {
        test.setTimeout(180000);
        const state = await open(page, baseURL, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await axe(page);
            await page.screenshot({ path: path.join(output, 'api-reference-' + name + '-' + width + '.png') });
        }
        clean(state);
    });
for (const [name, query] of [
    ['caspio-api-reference', 'webhooks'],
    ['manageorders-api-reference', 'TaxTotal'],
    ['sanmar-api-reference', 'catalogColor'],
])
    test('CSS API reference: ' + name + ' searches and keeps descriptions on phones', async ({ page, baseURL }) => {
        const state = await open(page, baseURL, name);
        await page.setViewportSize({ width: 320, height: 900 });
        const search = page.getByRole('searchbox');
        await search.fill(query);
        await expect(page.locator('mark.ref-hit').first()).toBeVisible();
        await expect(page.locator('.ref-desc').first()).toBeVisible();
        await search.fill('<img src=x onerror=alert(1)> & [.*');
        await expect(page.locator('.ref-empty')).toContainText('No ');
        await expect(page.locator('main img')).toHaveCount(0);
        await search.fill('');
        await expect(page.locator('.ref-empty')).toHaveCount(0);
        const scroll = page.locator('.ref-scroll').first();
        if (await scroll.count()) {
            await scroll.focus();
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        }
        clean(state);
    });
test('CSS API reference: Caspio contents keep fragment history and focus', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'caspio-api-reference');
    await page.locator('.ref-toc a[href="#catalog"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#catalog$/);
    await expect(page.locator('#catalog')).toBeFocused();
    await page.locator('.ref-toc a[href="#auth"]').click();
    await expect(page).toHaveURL(/#auth$/);
    await page.goBack();
    await expect(page).toHaveURL(/#catalog$/);
    clean(state);
});
test('CSS API reference: ODBC disclosures, field kinds, filters and safe external strings', async ({
    page,
    baseURL,
}) => {
    const fixture = {
        tables: {
            Orders: [
                ['ID_Order', 'number'],
                ['cn_Calculated', 'number'],
                ['sum_Total', 'number'],
                ['gt_Global', 'text'],
                ['<img src=x onerror=alert(1)>', 'text'],
            ],
        },
    };
    const state = await open(page, baseURL, 'shopworks-odbc-reference', fixture);
    const details = page.locator('details.swo-tbl');
    await expect(details).not.toHaveAttribute('open');
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open');
    await expect(details.locator('tbody tr')).toHaveCount(5);
    await expect(details.locator('tbody')).toContainText('<img src=x onerror=alert(1)>');
    await expect(details.locator('img')).toHaveCount(0);
    await page.getByLabel('stored fields only', { exact: false }).check();
    await expect(details.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('searchbox').fill('ID_Order');
    await expect(details.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('#swoCount')).toContainText('1 of 5');
    await axe(page);
    clean(state);
});
for (const [label, schema] of [
    ['offline', 503],
    ['malformed', { tables: { Orders: null } }],
])
    test(
        'CSS API reference: ODBC ' + label + ' has a working retry and preserves search',
        async ({ page, baseURL }) => {
            const state = await open(page, baseURL, 'shopworks-odbc-reference', schema);
            await expect(page.getByRole('alert')).toContainText('Unable to load');
            await page.getByRole('searchbox').fill('ShipMethod');
            await page.route('**/shopworks-odbc-schema.json*', (route) =>
                route.fulfill({
                    json: {
                        tables: {
                            Addr: [
                                ['ShipMethod', 'text'],
                                ['id_Order', 'number'],
                            ],
                        },
                    },
                }),
            );
            await page.getByRole('button', { name: 'Retry', exact: true }).click();
            await expect(page.locator('#swoCount')).toContainText('1 of 2');
            await expect(page.getByRole('searchbox')).toHaveValue('ShipMethod');
            await expect(page.getByRole('alert')).toHaveCount(0);
            clean(state);
        },
    );
test('CSS API reference: ODBC valid empty catalog is explicit', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'shopworks-odbc-reference', { tables: {} });
    await expect(page.locator('#swoTables')).toContainText('No tables are available');
    await expect(page.locator('#swoCount')).toContainText('0 fields');
    clean(state);
});
for (const name of names)
    test(
        'CSS API reference: ' + name + ' produces a readable PDF and restores screen state',
        async ({ page, baseURL }) => {
            test.setTimeout(180000);
            const state = await open(page, baseURL, name);
            const search = page.getByRole('searchbox');
            await search.fill(name === 'shopworks-odbc-reference' ? 'ShipMethod' : name === 'caspio-api-reference' ? 'webhooks' : name === 'manageorders-api-reference' ? 'TaxTotal' : 'catalogColor');
            const before = await search.inputValue();
            await expect(page.locator('code').first()).toHaveCSS('font-variant-ligatures', 'none');
            await page.evaluate(() => window.addEventListener('beforeprint', () => {
                window.__referencePrintRows = document.querySelectorAll('.swo-tbl tbody tr').length;
            }));
            const pdf = await page.pdf({
                path: path.join(output, 'api-reference-' + name + '.pdf'),
                format: 'Letter',
                margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
                printBackground: true,
            });
            const count = (pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length;
            expect(count).toBeGreaterThan(0);
            expect(count).toBeLessThan(180);
            await expect(search).toHaveValue(before);
            if (name === 'shopworks-odbc-reference') {
                const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../../dashboards/data/shopworks-odbc-schema.json'), 'utf8'));
                expect(await page.evaluate(() => window.__referencePrintRows)).toBe(Object.values(schema.tables).reduce((sum, fields) => sum + fields.length, 0));
            }
            if (name === 'shopworks-odbc-reference')
                await expect(page.locator('#swoCount')).toContainText('filter: "shipmethod"');
            clean(state);
        },
    );
test('CSS API reference: real page gates preserve anonymous, staff, admin and Erik restrictions', async ({
    browser,
    baseURL,
}) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
        for (const name of names)
            expect([302, 303, 401, 403]).toContain(
                (await context.request.get('/dashboards/' + name + '.html', { maxRedirects: 0 })).status(),
            );
        await authenticate(context, baseURL, 'reference-harness@nwcustomapparel.com', 'staff');
        for (const name of names)
            expect((await context.request.get('/dashboards/' + name + '.html', { maxRedirects: 0 })).status()).toBe(
                403,
            );
        await authenticate(context, baseURL, 'reference-harness@nwcustomapparel.com', 'admin');
        for (const name of names)
            expect((await context.request.get('/dashboards/' + name + '.html', { maxRedirects: 0 })).status()).toBe(
                name === 'caspio-api-reference' || name === 'shopworks-odbc-reference' ? 403 : 200,
            );
    } finally {
        await context.close();
    }
});
