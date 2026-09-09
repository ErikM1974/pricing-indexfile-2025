const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');
const data = require('../fixtures/instant-storefront-pricing.json');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
const families = [
    { name: 'banners', prefix: 'bn' },
    { name: 'stickers', prefix: 'stk' },
];
async function open(page, family, state = {}, query = '') {
    const events = { errors: [], writes: [], prices: [] };
    page.on('pageerror', (e) => events.errors.push(e.message));
    await page.route('**/*', async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push({ path: url.pathname, body: req.postData() });
            if (url.pathname === '/api/files/upload')
                return route.fulfill(
                    state.uploadFail
                        ? { status: 503, json: { error: 'Upload unavailable' } }
                        : {
                              json: {
                                  success: true,
                                  externalKey: 'review-art',
                                  originalName: 'review.pdf',
                                  size: 30,
                              },
                          },
                );
            if (['/api/form-submissions', '/api/public/sticker-quote'].includes(url.pathname)) {
                await new Promise((resolve) => setTimeout(resolve, 150));
                return route.fulfill(
                    state.saveFail
                        ? { status: 503, json: { error: 'Unavailable' } }
                        : { json: { success: true, quoteId: 'REVIEW-ONLY', url: '/quote/REVIEW-ONLY' } },
                );
            }
            return route.fulfill({ status: 503, json: { error: 'Actual business writes blocked' } });
        }
        if (url.pathname === '/api/public/banner-presets' || url.pathname === '/api/sticker-pricing') {
            if (state.pricing === 'failed')
                return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
            if (state.pricing === 'empty') return route.fulfill({ json: { presets: [], grid: [] } });
            const body = structuredClone(url.pathname.includes('banner') ? data.banners : data.stickers);
            if (state.pricing === 'degraded') {
                body.source = 'fallback';
                body.degraded = true;
            }
            return route.fulfill({ json: body });
        }
        if (url.pathname === '/api/banner-pricing/quote') {
            events.prices.push(Object.fromEntries(url.searchParams));
            return route.fulfill(
                state.repriceFail
                    ? { status: 503, json: { error: 'Unavailable' } }
                    : {
                          json: {
                              orderTotal: 317.43,
                              perBanner: { total: 105.81 },
                              dimensions: { widthIn: 60, heightIn: 84, sqft: 35 },
                              appliedRules: {},
                          },
                      },
            );
        }
        if (url.pathname === '/api/all-brands')
            return route.fulfill({ json: ['Nike', 'OGIO', 'Port Authority'] });
        if (url.pathname.startsWith('/api/'))
            return route.fulfill({ status: 503, json: { error: 'Unmocked API' } });
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            if (url.pathname === '/catalog')
                return route.fulfill({ contentType: 'text/html', body: '<main>Catalog destination</main>' });
            const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
            if (!file.startsWith(root + path.sep)) return route.fulfill({ status: 403 });
            if (fs.existsSync(file) && fs.statSync(file).isFile())
                return route.fulfill({
                    contentType:
                        {
                            '.html': 'text/html',
                            '.css': 'text/css',
                            '.js': 'application/javascript',
                            '.json': 'application/json',
                            '.svg': 'image/svg+xml',
                            '.woff2': 'font/woff2',
                        }[path.extname(file)] || 'application/octet-stream',
                    body: fs.readFileSync(file),
                });
            return route.fulfill({ status: 404, body: 'Missing local asset' });
        }
        return route.continue();
    });
    await page.goto('/pages/custom-' + family.name + '.html' + query);
    await page.evaluate(() => document.fonts.ready);
    await expect(
        page.locator('#' + family.prefix + (['failed', 'empty'].includes(state.pricing) ? 'Alert' : 'Total')),
    ).toBeVisible();
    if (!['failed', 'empty'].includes(state.pricing))
        await expect(page.locator('#' + family.prefix + 'Total')).toContainText('$');
    return events;
}
for (const family of families) {
    const p = family.prefix;
    test(`${family.name}: four widths keep pricing controls readable and accessible`, async ({ page }) => {
        const events = await open(page, family);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 950 });
            await expect(page.locator('#' + p + 'Cta')).toBeEnabled();
            if (family.name === 'stickers' && width <= 900)
                await expect(page.locator('#stkQtySelect')).toBeVisible();
            const sizes = await page
                .locator('.stk-card')
                .evaluate((el) => ({
                    width: el.getBoundingClientRect().width,
                    viewport: innerWidth,
                    overflow: document.documentElement.scrollWidth > innerWidth,
                }));
            expect(sizes.overflow).toBe(false);
            if (width <= 900) expect(sizes.width).toBeGreaterThan(width - 90);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({ path: path.join(output, `instant-${family.name}-${width}.png`) });
        }
        expect(events.errors).toEqual([]);
        expect(events.writes).toEqual([]);
    });
    test(`${family.name}: native menus, search and size help retain keyboard focus`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const events = await open(page, family);
        await page.locator('#mobileMenuBtn').click();
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.locator('#mobileMenuBtn')).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(page.locator('#mobileMenuBtn')).toBeFocused();
        await page.locator('#' + p + 'SizeHelp').click();
        await expect(page.locator('#' + p + 'SizeDialog')).toBeVisible();
        await page.keyboard.press('Tab');
        expect(
            await page.locator('#' + p + 'SizeDialog').evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.locator('#' + p + 'SizeHelp')).toBeFocused();
        await page.locator('#navSearchInput').fill('Nike & blue');
        await page.locator('#navSearchInput').press('Enter');
        await expect(page).toHaveURL(/\/catalog\?q=Nike%20%26%20blue$/);
        expect(events.errors).toEqual([]);
    });
    test(`${family.name}: failed and empty pricing disable ordering; backup prices carry a warning`, async ({
        page,
    }) => {
        for (const pricing of ['failed', 'empty', 'degraded']) {
            await page.unrouteAll({ behavior: 'wait' });
            await open(page, family, { pricing });
            if (pricing === 'degraded') await expect(page.locator('#' + p + 'Warn')).toBeVisible();
            else {
                await expect(page.locator('#' + p + 'Alert')).toBeVisible();
                await expect(page.locator('#configurator')).toBeHidden();
                await expect(page.locator('#' + p + 'Bar')).toBeHidden();
            }
        }
    });
    test(`${family.name}: quote failure keeps the draft and artwork; retry confirms success`, async ({
        page,
    }) => {
        const state = { saveFail: true, uploadFail: true };
        const events = await open(page, family, state);
        await page.locator('#' + p + 'Cta').click();
        await page.locator('#' + p + 'LeadSubmit').click();
        await expect(page.locator('#' + p + 'LeadError')).toBeVisible();
        await page.locator('#' + p + 'Name').fill('CSS Review');
        await page.locator('#' + p + 'Email').fill('css-review@example.test');
        await page.locator('#' + p + 'Message').fill('Retain this draft after a failed request.');
        const upload = {
            name: 'review.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n%Synthetic review file'),
        };
        await page.locator('#' + p + 'AwInput').setInputFiles(upload);
        await expect(page.locator('#' + p + 'AwStatus')).toContainText(/didn.t go through|unavailable/i);
        state.uploadFail = false;
        await page.locator('#' + p + 'AwInput').setInputFiles(upload);
        await expect(page.locator('#' + p + 'AwStatus')).toContainText('Attached:');
        await page.locator('#' + p + 'LeadSubmit').click();
        await expect(page.locator('#' + p + 'LeadError')).toContainText('kept everything');
        await expect(page.locator('#' + p + 'Name')).toHaveValue('CSS Review');
        await expect(page.locator('#' + p + 'Message')).toHaveValue(
            'Retain this draft after a failed request.',
        );
        await expect(page.locator('#' + p + 'AwStatus')).toContainText('review.pdf');
        state.saveFail = false;
        await page.locator('#' + p + 'LeadSubmit').click();
        await expect(page.locator('#' + p + 'Lead h3')).toContainText(
            family.name === 'stickers' ? 'REVIEW-ONLY' : 'Got it',
        );
        const writes = events.writes.filter((w) => w.path !== '/api/files/upload');
        expect(writes).toHaveLength(2);
        expect(writes[0].body).toBe(writes[1].body);
        expect(writes[1].body).toContain('review-art');
        expect(events.errors).toEqual([]);
    });
    test(`${family.name}: desktop browse menus and mobile resize keep navigation usable`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 950 });
        const events = await open(page, family);
        const products = page.locator('.nav-menu > .nav-item').filter({ has: page.locator('.nav-dropdown') }).first();
        await products.locator(':scope > a').click();
        await expect(products.locator('.nav-dropdown')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(products.locator('.nav-dropdown')).toBeHidden();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#mobileMenuBtn').click();
        await page.locator('#sidebar a').last().focus();
        await page.keyboard.press('Tab');
        expect(await page.locator('#sidebar').evaluate(el => el.contains(document.activeElement))).toBe(true);
        await page.setViewportSize({ width: 1440, height: 950 });
        await expect(page.locator('#sidebar')).toBeHidden();
        await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
        expect(events.errors).toEqual([]);
    });
    test(`${family.name}: complete paper expands and restores every FAQ`, async ({ page }) => {
        await open(page, family);
        await page
            .locator('details')
            .first()
            .evaluate((el) => {
                el.open = true;
            });
        const before = await page.locator('details').evaluateAll((nodes) => nodes.map((el) => el.open));
        await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
        await expect(page.locator('details:not([open])')).toHaveCount(0);
        await page.emulateMedia({ media: 'print' });
        const nodes = await page.locator('main').evaluate((el) => {
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
                out = [];
            while (walk.nextNode()) {
                const n = walk.currentNode,
                    p = n.parentElement;
                if (
                    p &&
                    !p.closest('script,style,svg') &&
                    p.getClientRects().length &&
                    getComputedStyle(p).visibility !== 'hidden'
                ) {
                    const t = n.textContent.replace(/\s+/g, ' ').trim();
                    if (t) out.push(t);
                }
            }
            return out;
        });
        fs.writeFileSync(path.join(output, `instant-${family.name}-paper-nodes.json`), JSON.stringify(nodes));
        await page.pdf({
            path: path.join(output, `instant-${family.name}.pdf`),
            format: 'Letter',
            printBackground: true,
            margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
        });
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => dispatchEvent(new Event('afterprint')));
        expect(await page.locator('details').evaluateAll((items) => items.map((el) => el.open))).toEqual(
            before,
        );
    });
}
test('banners: preset, quantity, finishing, custom size and failed reprice keep server totals', async ({
    page,
}) => {
    const state = {},
        events = await open(page, families[0], state);
    for (const preset of data.banners.presets) {
        await page.locator(`#bnLadder input[value="${preset.key}"]`).check();
        await expect(page.locator('#bnTotal')).toHaveText('$' + preset.price.toFixed(2));
    }
    await page.locator('#bnQty').fill('3');
    await page.locator('#bnQty').press('Tab');
    await expect(page.locator('#bnTotal')).toHaveText('$317.43');
    expect(events.prices.at(-1).qty).toBe('3');
    await page.locator('#bnDouble').check();
    await expect.poll(() => events.prices.at(-1).doubleSided).toBe('true');
    await page.locator('#bnPockets').check();
    await expect.poll(() => events.prices.at(-1).polePockets).toBe('both');
    await page.locator('#bnW').fill('5');
    await page.locator('#bnH').fill('7');
    await page.locator('#bnCustomGo').click();
    await expect.poll(() => events.prices.at(-1).height).toBe('84');
    expect(events.prices.at(-1).width).toBe('60');
    await expect(page.locator('#bnTotal')).toHaveText('$317.43');
    state.repriceFail = true;
    await page.locator('#bnPlus').click();
    await expect(page.locator('#bnAlert')).toBeVisible();
    await expect(page.locator('#bnTotal')).toHaveText('—');
    await expect(page.locator('#bnCta')).toBeDisabled();
    state.repriceFail = false;
    await page.locator('#bnMinus').click();
    await expect(page.locator('#bnTotal')).toHaveText('$317.43');
    expect(events.errors).toEqual([]);
});
test('stickers: size and mobile quantity match the published sheet; custom oversize has a clear next step', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const events = await open(page, families[1]);
    for (const size of [...new Set(data.stickers.grid.map((row) => row.Size))]) {
        await page.locator(`input[name="stkSize"][value="${size}"]`).check();
        for (const row of data.stickers.grid.filter((row) => row.Size === size)) {
            await page.locator('#stkQtySelect').selectOption(String(row.Quantity));
            await expect(page.locator('#stkTotal')).toHaveText('$' + row.TotalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
    }
    await page.locator('input[name="stkSize"][value="__custom__"]').check();
    await page.locator('#stkW').fill('8');
    await page.locator('#stkH').fill('9');
    await expect(page.locator('#stkOversize')).toBeVisible();
    await page.locator('#stkOversizeCta').click();
    await expect(page).toHaveURL(/request-a-quote\.html\?source=custom-stickers&product=/);
    expect(new URL(page.url()).searchParams.get('product')).toBe('Large-format decal 8" x 9"');
    expect(events.errors).toEqual([]);
});
