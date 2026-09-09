const { test, expect } = require('@playwright/test'),
    AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'),
    path = require('node:path'),
    output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
const fixture = require('../fixtures/campaign-storefront-original-content.json');
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
const config = {
    itemGroups: [
        { name: 'TravisMathew & Nike Polos', styles: ['TM1MU410', 'NKDC1963'] },
        { name: 'Golf Towels', styles: ['TW51'] },
    ],
    premiumItems: {
        TM1MU410: { name: 'TravisMathew Coto Performance Polo' },
        NKDC1963: { name: 'Nike Dri-FIT Micro Pique 2.0 Polo' },
        TW51: { name: 'Port Authority Grommeted Golf Towel' },
    },
};
const tiers = [
        ['1-7', 1, 50],
        ['8-23', 8, 0],
        ['24-47', 24, 0],
        ['48-71', 48, 0],
        ['72+', 72, 0],
    ],
    bundle = {
        uniqueSizes: ['S', 'M', 'L'],
        tierData: tiers.map(([TierLabel, MinQuantity, LTM_Fee]) => ({ TierLabel, MinQuantity, LTM_Fee })),
        pricing: Object.fromEntries(
            tiers.map(([label], i) => [label, { S: 47.13 - i, M: 47.13 - i, L: 47.13 - i }]),
        ),
    };
const product = {
    styleNumber: 'TM1MU410',
    productName: 'TravisMathew Coto Performance Polo',
    brand: 'TravisMathew',
    description: 'Soft and breathable performance polo.  Four-way stretch  Easy wash and wear',
    colors: [
        { name: 'Black', productImageUrl: 'https://campaign.example.test/black.svg' },
        { name: 'Blue', productImageUrl: 'https://campaign.example.test/blue.svg' },
    ],
    sizes: ['S', 'M', 'L', '2XL'],
    upcharges: { '2XL': 2 },
    images: {
        model: {
            front: 'https://campaign.example.test/front.svg',
            back: 'https://campaign.example.test/back.svg',
        },
    },
};
const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="200"><rect width="260" height="200" fill="#f8fafc"/><path d="M85 25 45 55 65 90 85 78V185H155V78L175 90 195 55 155 25Q120 50 85 25Z" fill="#34495e"/></svg>';
async function open(page, file, state = {}, query = '') {
    const events = { errors: [], writes: [] };
    page.on('pageerror', (e) => events.errors.push(e.message));
    await page.addInitScript((s) => {
        window.__campaignPreview = { ...s, saves: [], emails: [] };
    }, state);
    await page.route('**/*', (route) => {
        const req = route.request(),
            u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (u.pathname === '/' + file)
            return route.fulfill({
                contentType: 'text/html',
                body: fs.readFileSync(path.join(__dirname, '../..', file)),
            });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push(u.pathname);
            return route.fulfill({ status: 503, body: 'Actual business writes blocked' });
        }
        if (u.pathname.endsWith('/embroidery-pricing-service.js'))
            return route.fulfill({
                contentType: 'application/javascript',
                body:
                    'window.EmbroideryPricingService=class {async fetchPricingData(){if(window.__campaignPreview.pricing===false)throw Error("Pricing unavailable");return ' +
                    JSON.stringify(bundle) +
                    ';}};',
            });
        if (u.pathname.endsWith('/base-quote-service.js'))
            return route.fulfill({
                contentType: 'application/javascript',
                body: 'window.BaseQuoteService=class {async saveQuote(data){const s=window.__campaignPreview;s.saves.push(data);await new Promise(r=>setTimeout(r,200));if(s.save==="throw")throw Error("Save unavailable");return {success:s.save!==false,quoteID:"TEST-GOLF-REVIEW",error:s.save===false?"Save unavailable":null};}};',
            });
        if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('email'))
            return route.fulfill({
                contentType: 'application/javascript',
                body: 'window.emailjs={init(){},async send(service,template,params){const s=window.__campaignPreview;s.emails.push({template,params});if(template==="template_golf_lead"&&s.lead===false||template==="template_golf_customer"&&s.customer===false)throw Error("Email unavailable");return {status:200};}};',
            });
        if (u.pathname === '/api/garment-tracker/config')
            return route.fulfill(
                state.config === 503
                    ? { status: 503, json: { error: 'Unavailable' } }
                    : { json: state.config === undefined ? { success: true, config } : state.config },
            );
        if (u.pathname === '/api/products/search')
            return route.fulfill(
                state.product === 503
                    ? { status: 503, json: { error: 'Unavailable' } }
                    : { json: { data: { products: state.product === 'empty' ? [] : [product] } } },
            );
        if (u.hostname === 'campaign.example.test' || u.hostname === 'cdnm.sanmar.com')
            return route.fulfill({ contentType: 'image/svg+xml', body: svg });
        if (u.pathname.startsWith('/api/'))
            return route.fulfill({ status: 503, json: { error: 'Unmocked API' } });
        return route.fallback();
    });
    await page.goto('/' + file + query);
    await page.evaluate(() => document.fonts.ready);
    return events;
}
function clean(e) {
    expect(e.errors).toEqual([]);
    expect(e.writes).toEqual([]);
}
async function fill(page) {
    await page.locator('#qf-company').fill('Preview Tournament');
    await page.locator('#qf-name').fill('Preview Customer');
    await page.locator('#qf-email').fill('preview@example.test');
    await page.locator('#qf-phone').fill('253-555-0100');
    await page.locator('#qf-date').fill('2027-07');
    await page.locator('#qf-players').selectOption('72');
    await page.locator('input[name="interests"][value="polos"]').check();
    await page.locator('#qf-notes').fill('Keep these request details.');
}
async function paper(page, name) {
    await page.locator('main img').evaluateAll(async (images) => {
        images.forEach((img) => {
            img.loading = 'eager';
        });
        await Promise.race([
            Promise.all(images.map((img) => img.decode().catch(() => {}))),
            new Promise((resolve) => setTimeout(resolve, 10000)),
        ]);
    });
    const before = await page.locator('details').evaluateAll((nodes) => nodes.map((n) => n.open));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const blocks = await page.locator('main,footer').evaluateAll((roots) => {
        const blocks = [];
        for (const root of roots) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const text = node.textContent.replace(/\s+/g, ' ').trim();
                if (!text || node.parentElement.closest('script,style,[aria-hidden="true"]')) continue;
                const range = document.createRange();
                range.selectNode(node);
                if ([...range.getClientRects()].some((r) => r.width && r.height)) blocks.push(text);
            }
        }
        return blocks;
    });
    fs.writeFileSync(
        path.join(output, 'campaign-storefront-' + name + '-print.json'),
        JSON.stringify({ blocks }),
    );
    await page.pdf({
        path: path.join(output, 'campaign-storefront-' + name + '.pdf'),
        format: 'Letter',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
    });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    expect(await page.locator('details').evaluateAll((nodes) => nodes.map((n) => n.open))).toEqual(before);
}
for (const p of fixture.pages)
    test('CSS campaigns: ' + path.basename(p.file) + ' four widths, contrast and paper', async ({ page }) => {
        test.setTimeout(180000);
        const e = await open(page, p.file, {}, p.file.includes('product') ? '?style=TM1MU410' : '');
        if (p.file.includes('tournaments'))
            await expect(page.locator('.product-card__price-value').first()).toHaveText('$43.13');
        if (p.file.includes('product')) await expect(page.locator('#info-price-value')).toHaveText('$43.13');
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            const overflow = await page.locator('body *').evaluateAll((nodes) =>
                nodes
                    .filter(
                        (n) => n.getClientRects().length && n.getBoundingClientRect().right > innerWidth + 1,
                    )
                    .map((n) => ({
                        tag: n.tagName,
                        classes: n.className,
                        right: n.getBoundingClientRect().right,
                    }))
                    .slice(0, 10),
            );
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
                JSON.stringify(overflow),
            ).toBeLessThanOrEqual(width);
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
                        .analyze()
                ).violations,
            ).toEqual([]);
            await page.screenshot({
                path: path.join(
                    output,
                    'campaign-storefront-' + path.basename(p.file, '.html') + '-' + width + '.png',
                ),
            });
            if (width === 1440 || width === 390)
                for (const selector of ['.heritage', '.sponsor-extras'])
                    if (await page.locator(selector).count())
                        await page
                            .locator(selector)
                            .screenshot({
                                path: path.join(
                                    output,
                                    'campaign-storefront-' +
                                        path.basename(p.file, '.html') +
                                        '-' +
                                        selector.slice(1) +
                                        '-' +
                                        width +
                                        '.png',
                                ),
                            });
        }
        await paper(page, path.basename(p.file, '.html'));
        clean(e);
    });
test('CSS campaigns: native photo viewer keeps caption and returns focus after navigation', async ({
    page,
}) => {
    const e = await open(page, 'pages/golf-tournaments-2026.html');
    const first = page.locator('.team__card-image').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[data-lightbox]')).toBeVisible();
    await page.locator('.lightbox__close').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.lightbox__next')).toBeFocused();
    const original = await page.locator('.lightbox__caption').innerText();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.lightbox__caption')).not.toHaveText(original);
    await page.keyboard.press('Escape');
    await expect(first).toBeFocused();
    clean(e);
});
test('CSS campaigns: fragments, filters and volume table disclosure retain product data', async ({
    page,
}) => {
    const e = await open(page, 'pages/golf-tournaments-2026.html');
    await page.locator('.sticky-nav a[href="#showcase"]').click();
    await expect(page.locator('#showcase')).toBeFocused();
    await expect(page.locator('.product-card')).toHaveCount(3);
    await page.locator('.filter-chip[data-filter="towels"]').click();
    await expect(page.locator('.category:visible .product-card')).toHaveCount(1);
    const card = page.locator('.category:visible .product-card');
    await card.locator('.product-card__expand').click();
    await expect(card.locator('[data-pricing-table]')).toBeVisible();
    await expect(card.locator('[data-pricing-table]')).toContainText('$43.13');
    clean(e);
});
test('CSS campaigns: product gallery and colors work by keyboard and retain quote prefill', async ({
    page,
}) => {
    const e = await open(page, 'pages/golf-tournament-product.html', {}, '?style=TM1MU410');
    await page.locator('.gallery__thumb').nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#gallery-main-img')).toHaveAttribute('src', /back\.svg$/);
    await page.locator('.color-swatch').nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#color-selected-text')).toHaveText('Blue');
    await expect(page.locator('#gallery-main-img')).toHaveAttribute('src', /blue\.svg$/);
    await expect(page.locator('.product-info__ctas a').first()).toHaveAttribute(
        'href',
        /prefill=TM1MU410#quote-form$/,
    );
    clean(e);
});
test('CSS campaigns: invalid inquiry stays visible without saving or email', async ({ page }) => {
    const e = await open(page, 'pages/golf-tournaments-2026.html');
    await page.locator('#qf-submit').click();
    await expect(page.locator('#campaign-send-status')).toContainText('enter your tournament');
    await expect(page.locator('#campaign-send-status')).toBeFocused();
    expect(
        await page.evaluate(
            () => window.__campaignPreview.saves.length + window.__campaignPreview.emails.length,
        ),
    ).toBe(0);
    clean(e);
});
for (const mode of [
    { save: false, lead: false },
    { save: 'throw', lead: false },
])
    test(
        'CSS campaigns: total delivery failure ' +
            mode.save +
            ' preserves form and sends no customer confirmation',
        async ({ page }) => {
            const e = await open(page, 'pages/golf-tournaments-2026.html', mode);
            await fill(page);
            await page.locator('#qf-submit').click();
            await expect(page.locator('#campaign-send-status')).toContainText('Your details are still here');
            await expect(page.locator('#form-success')).toBeHidden();
            await expect(page.locator('#qf-email')).toHaveValue('preview@example.test');
            await expect(page.locator('#qf-notes')).toHaveValue('Keep these request details.');
            expect(await page.evaluate(() => window.__campaignPreview.emails.map((e) => e.template))).toEqual(
                ['template_golf_lead'],
            );
            await page.evaluate(() => {
                window.__campaignPreview.lead = true;
            });
            await page.locator('#qf-submit').click();
            await expect(page.locator('#form-success')).toBeVisible();
            await expect(page.locator('#form-success')).toBeFocused();
            clean(e);
        },
    );
for (const mode of [
    { save: true, lead: false },
    { save: false, lead: true },
    { save: true, lead: true, customer: false },
    { save: true, lead: true },
])
    test(
        'CSS campaigns: received request ' + JSON.stringify(mode) + ' shows a receipt only after acceptance',
        async ({ page }) => {
            const e = await open(page, 'pages/golf-tournaments-2026.html', mode);
            await fill(page);
            await page.locator('#qf-submit').click();
            await expect(page.locator('#qf-submit')).toBeDisabled();
            await expect(page.locator('#form-success')).toBeVisible();
            await expect(page.locator('#golf-quote-form')).toBeHidden();
            const state = await page.evaluate(() => window.__campaignPreview);
            expect(state.saves).toHaveLength(1);
            expect(state.saves[0].customerEmail).toBe('preview@example.test');
            expect(state.saves[0].items[0]).toMatchObject({
                quantity: 72,
                baseUnitPrice: 43.13,
                finalUnitPrice: 43.13,
                lineTotal: 3105.36,
            });
            expect(state.emails.map((e) => e.template)).toEqual([
                'template_golf_lead',
                'template_golf_customer',
            ]);
            if (mode.customer === false)
                await expect(page.locator('#campaign-send-status')).toContainText(
                    'confirmation email could not be sent',
                );
            clean(e);
        },
    );
for (const file of ['pages/golf-tournaments-2026.html', 'pages/golf-tournament-product.html'])
    test('CSS campaigns: ' + file + ' failed service is visible', async ({ page }) => {
        const e = await open(
            page,
            file,
            file.includes('product') ? { product: 503 } : { config: 503 },
            file.includes('product') ? '?style=TM1MU410' : '',
        );
        await expect(page.locator('main')).toContainText(
            file.includes('product') ? "We couldn't load this product" : "Apparel catalog couldn't load",
        );
        if (!file.includes('product'))
            await expect(page.locator('#example-package-card')).toContainText('pricing is unavailable');
        await paper(page, path.basename(file, '.html') + '-failed');
        clean(e);
    });

for (const badConfig of [
    { success: true, config: {} },
    { success: true, config: { itemGroups: [], premiumItems: {} } },
    { success: true, config: { itemGroups: [{ name: 'Polos', styles: ['MISSING'] }], premiumItems: {} } },
])
    test(
        'CSS campaigns: invalid catalog ' +
            JSON.stringify(badConfig) +
            ' stops all loading and retains inquiry',
        async ({ page }) => {
            const e = await open(page, 'pages/golf-tournaments-2026.html', { config: badConfig });
            await expect(page.locator('#product-categories')).toContainText("Apparel catalog couldn't load");
            await expect(page.locator('#example-package-card')).toContainText('pricing is unavailable');
            await fill(page);
            await expect(page.locator('#qf-email')).toHaveValue('preview@example.test');
            clean(e);
        },
    );

test('CSS campaigns: unavailable product is visible without a fabricated price', async ({ page }) => {
    const e = await open(page, 'pages/golf-tournament-product.html', { product: 'empty' }, '?style=TM1MU410');
    await expect(page.locator('.product-error')).toBeVisible();
    await expect(page.locator('#info-price-value')).not.toBeVisible();
    clean(e);
});
