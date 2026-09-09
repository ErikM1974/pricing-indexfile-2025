const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'),
    path = require('node:path');
const fixture = require('../fixtures/customer-intake-original-content.json');
const root = path.resolve(__dirname, '../..'),
    output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
const publicFile = 'pages/request-a-quote.html';
async function open(page, file, state = {}, query = '') {
    const events = { errors: [], writes: [] };
    page.on('pageerror', (e) => events.errors.push(e.message));
    await page.route('**/*', async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push({ path: url.pathname, body: req.postData() });
            if (url.pathname === '/api/image-uploads')
                return route.fulfill(
                    state.uploadFail
                        ? { status: 503, json: { error: 'Unavailable' } }
                        : { json: { image: { url: 'https://review.example.test/logo.png' } } },
                );
            if (url.pathname === '/api/form-submissions') {
                await new Promise((r) => setTimeout(r, 100));
                return route.fulfill(
                    state.saveFail
                        ? { status: 503, json: { error: 'Unavailable' } }
                        : { json: { submissionId: 'INTAKE-REVIEW-ONLY' } },
                );
            }
            return route.fulfill({
                status: 503,
                json: { error: 'Actual business writes blocked' },
            });
        }
        if (url.pathname === '/api/stylesearch')
            return route.fulfill(
                state.lookupFail
                    ? { status: 503, json: { error: 'Unavailable' } }
                    : {
                          json: state.lookupEmpty
                              ? []
                              : [{ value: 'PC54', label: 'Core Cotton Tee' }],
                      },
            );
        if (url.pathname.startsWith('/api/'))
            return route.fulfill({ status: 503, json: { error: 'Unmocked API blocked' } });
        if (url.hostname.includes('jotform.com')) {
            if (state.vendorFailed) return route.abort('failed');
            if (url.pathname.includes('/jsform/'))
                return route.fulfill({
                    contentType: 'application/javascript',
                    body: 'document.currentScript.insertAdjacentHTML("afterend", \'<iframe title="Hosted form preview" src="https://form.jotform.com/review-only"></iframe>\');',
                });
            return route.fulfill({
                contentType: 'text/html',
                body: '<!doctype html><html lang="en"><title>Hosted form preview</title><body><main><h1>Hosted form preview</h1><p>External form content is unchanged. Review fixture only.</p><label>Name <input></label><p><button type="button">Continue</button></p></main></body></html>',
            });
        }
        if (['localhost', '127.0.0.1', 'intake.local'].includes(url.hostname)) {
            const filePath = path.resolve(root, '.' + decodeURIComponent(url.pathname));
            if (
                !filePath.startsWith(root + path.sep) ||
                !fs.existsSync(filePath) ||
                !fs.statSync(filePath).isFile()
            )
                return route.fulfill({ status: 404 });
            return route.fulfill({
                contentType:
                    {
                        '.html': 'text/html',
                        '.css': 'text/css',
                        '.js': 'application/javascript',
                        '.json': 'application/json',
                        '.svg': 'image/svg+xml',
                        '.woff2': 'font/woff2',
                    }[path.extname(filePath)] || 'application/octet-stream',
                body: fs.readFileSync(filePath),
            });
        }
        return route.continue();
    });
    await page.goto('/' + file + query);
    await page.evaluate(() => document.fonts.ready);
    return events;
}
for (const entry of fixture.pages) {
    const name = path.basename(entry.file, '.html');
    test(`intake: ${name} four widths, keyboard entry and accessible layout`, async ({ page }) => {
        const events = await open(page, entry.file);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 950 });
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            if (entry.file === publicFile) {
                const box = await page.locator('#fldWhat').boundingBox();
                expect(box.width).toBeGreaterThan(width <= 390 ? width - 100 : 180);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
            }
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: path.join(output, 'intake-' + name + '-' + width + '.png'),
                fullPage: true,
            });
        }
        await page.keyboard.press('Control+Home');
        await page.locator('.skip-link').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        if (entry.embeds.length) {
            await page
                .frameLocator('.jotform-container iframe')
                .getByLabel('Name')
                .fill('Review only');
            await expect(page.locator('.intake-embed-help a')).toHaveAttribute(
                'href',
                fixture.hostedLinks[entry.file],
            );
        }
        expect(events.errors).toEqual([]);
        expect(events.writes).toEqual([]);
    });
    test(`intake: ${name} complete readable paper`, async ({ page }) => {
        await open(page, entry.file);
        if (entry.embeds.length)
            await expect(page.locator('.jotform-container iframe')).toBeVisible();
        await page.emulateMedia({ media: 'print' });
        const nodes = await page.locator('main').evaluate((main) => {
            const values = [],
                walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const n = walker.currentNode,
                    text = n.textContent.replace(/\s+/g, ' ').trim();
                if (!text || n.parentElement.closest('script,style')) continue;
                const r = document.createRange();
                r.selectNode(n);
                if (r.getBoundingClientRect().width && r.getBoundingClientRect().height)
                    values.push(text);
            }
            return values;
        });
        if (entry.embeds.length) {
            await expect(page.locator('.intake-print-link')).toBeVisible();
            await expect(page.locator('iframe')).toBeHidden();
        }
        await page.pdf({
            path: path.join(output, 'intake-' + name + '.pdf'),
            format: 'Letter',
            printBackground: true,
            margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
        });
        fs.writeFileSync(
            path.join(output, 'intake-' + name + '-paper-nodes.json'),
            JSON.stringify(nodes),
        );
        await page.emulateMedia({ media: 'screen' });
        await expect(
            page.locator(entry.embeds.length ? '.intake-print-link' : '.public-success'),
        ).toBeHidden();
    });
    if (entry.embeds.length)
        test(`intake: ${name} blocked vendor retains a keyboard-accessible alternative`, async ({
            page,
        }) => {
            const events = await open(page, entry.file, { vendorFailed: true });
            const link = page.locator('.intake-embed-help a');
            await expect(link).toBeVisible();
            await link.focus();
            await expect(link).toBeFocused();
            await expect(link).toHaveAttribute('href', fixture.hostedLinks[entry.file]);
            expect(events.writes).toEqual([]);
        });
}
async function fill(page) {
    for (const [id, value] of Object.entries({
        fldName: 'Review User',
        fldCompany: 'Review Team',
        fldEmail: 'review@example.test',
        fldPhone: '253-555-0100',
        fldWhat: 'Review crew apparel',
        fldQty: '48',
        fldNeedBy: '9/30/2026',
    }))
        await page.locator('#' + id).fill(value);
    await page.locator('#mEmbroidery').check();
    await page.locator('#rpEmail').check();
}
test('intake: public validation, failed save retains draft and retry sends identical payload', async ({
    page,
}) => {
    const state = { saveFail: true },
        events = await open(page, publicFile, state);
    await page.locator('.public-submit').click();
    await expect(page.locator('#fldName')).toBeFocused();
    await expect(page.getByRole('alert')).toContainText('your name');
    await fill(page);
    await page.locator('#fldEmail').fill('invalid');
    await page.locator('.public-submit').click();
    await expect(page.locator('#fldEmail')).toBeFocused();
    expect(events.writes).toEqual([]);
    await page.locator('#fldEmail').fill('review@example.test');
    await page.locator('.public-submit').click();
    await expect(page.getByRole('alert')).toContainText("That didn't go through");
    await expect(page.locator('#fldWhat')).toHaveValue('Review crew apparel');
    await expect(page.locator('.public-submit')).toBeEnabled();
    state.saveFail = false;
    await page.locator('.public-submit').click();
    await expect(page.locator('.public-success')).toBeFocused();
    await expect(page.locator('.public-success-ref')).toHaveText('INTAKE-REVIEW-ONLY');
    await expect(page.locator('.form-section')).toHaveCount(3);
    for (const section of await page.locator('.form-section').all())
        await expect(section).toBeHidden();
    const writes = events.writes.filter((w) => w.path === '/api/form-submissions');
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toBe(writes[0].body);
    expect(JSON.parse(writes[1].body)).toMatchObject({
        formId: 'quote-request',
        company: 'Review Team',
        contactName: 'Review User',
        dueDateIso: '2026-09-30',
        hp: '',
        payload: { checks: ['Embroidery', 'Reply by: Email'] },
    });
    expect(events.errors).toEqual([]);
});
test('intake: public artwork upload failure, retry and saved attachment', async ({ page }) => {
    const state = { uploadFail: true },
        events = await open(page, publicFile, state);
    await fill(page);
    const file = page.locator('#fldLogoFile');
    await file.focus();
    await expect(file).toBeFocused();
    const upload = {
        name: 'review.png',
        mimeType: 'image/png',
        buffer: Buffer.from('review image'),
    };
    await file.setInputFiles(upload);
    await expect(page.locator('#uploadStatus')).toContainText("Upload didn't work");
    state.uploadFail = false;
    await file.setInputFiles([]);
    await file.setInputFiles(upload);
    await expect(page.locator('#uploadStatus')).toContainText('Attached: review.png');
    await page.locator('.public-submit').click();
    await expect(page.locator('.public-success')).toBeVisible();
    const sent = JSON.parse(events.writes.find((w) => w.path === '/api/form-submissions').body);
    expect(sent.payload.fields).toContainEqual([
        'Logo file',
        'review.png — https://review.example.test/logo.png',
    ]);
});
test('intake: public prefill, calendar, keyboard style selection and lookup recovery', async ({
    page,
}) => {
    const state = {},
        events = await open(
            page,
            publicFile,
            state,
            '?style=pc61&product=Essential%20Tee&source=Catalog',
        );
    await expect(page.locator('#fldStyle')).toHaveValue('PC61');
    await expect(page.locator('#fldProduct')).toHaveValue('Essential Tee');
    await expect(page.locator('#fldWhat')).toContainText('');
    expect(await page.locator('#fldWhat').inputValue()).toContain('Please send decorated pricing.');
    await page.locator('#fldNeedBy').fill('flexible');
    await expect(page.locator('#fldNeedBy')).toHaveValue('flexible');
    await page.locator('.date-pick-native').evaluate((el) => {
        el.value = '2026-10-09';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#fldNeedBy')).toHaveValue('10/9/2026');
    await page.locator('#fldStyle').fill('pc5');
    await expect(page.getByRole('option')).toBeVisible();
    await page.locator('#fldStyle').press('ArrowDown');
    await page.locator('#fldStyle').press('Enter');
    await expect(page.locator('#fldStyle')).toHaveValue('PC54');
    await expect(page.locator('#fldProduct')).toHaveValue('Core Cotton Tee');
    state.lookupFail = true;
    await page.locator('#fldStyle').fill('unknown');
    await expect(page.locator('.styles-dropdown')).toContainText('lookup unavailable');
    await page.locator('#fldStyle').press('Escape');
    await expect(page.locator('.styles-dropdown')).toBeHidden();
    state.lookupFail = false;
    state.lookupEmpty = true;
    await page.locator('#fldStyle').fill('none');
    await expect(page.locator('.styles-dropdown')).toContainText('No SanMar match');
    expect(events.writes).toEqual([]);
});
