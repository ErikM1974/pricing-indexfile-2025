const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');

async function fixture(page, source) {
    // Block every service, including cross-origin proxy calls and automatic repair writes.
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Unmocked CSS fixture service' } }));
    await page.route(`http://localhost:3400/${source}*`, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, source), 'utf8') }));
}
async function shot(page, name) {
    if (!process.env.CSS_SHOT_TAG) return;
    const folder = path.join(__dirname, 'screenshots/css-unification');
    fs.mkdirSync(folder, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    const modal = await page.locator('[role="dialog"]:visible').count();
    await page.screenshot({ path: path.join(folder, `${process.env.CSS_SHOT_TAG}-${name}.png`), fullPage: modal === 0 && !name.startsWith('vault-') });
}
async function accessible(page) {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
}
async function layout(page, name) {
    for (const width of [1440,768,390,320]) {
        await page.setViewportSize({ width, height: 900 });
        const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
        expect(size.content, `${name} at ${width}px`).toBeLessThanOrEqual(size.viewport + 1);
        await shot(page, `${name}-${width}`);
    }
}
function indexFixture(count = 720) {
    return {
        version: 'css-workspaces', builtAt: Date.now(),
        srcBits: { DIGITIZED:1, SHOPWORKS:2, THUMB:4, ART:8, RUTH:16, PHOTO:32, DESIGNS2026:64 },
        dicts: { reps:['','Fixture Rep'], custTypes:['','Business'], tiers:['','Mid'] },
        rows: Array.from({ length: count }, (_, i) => [10001+i, `Fixture design ${i+1}`, 'Fixture Company', 501, 1, 1, 1, 9000, 2, 9, 'u:http://localhost:3400/favicon.png', 3, 2609]),
        dupClusters: [], counts: { groups: count },
    };
}
async function vault(page, count) {
    await fixture(page, 'dashboards/design-gallery.html');
    const index = indexFixture(count);
    await page.route('**/api/design-search/index*', route => route.fulfill({ json: index }));
    await page.route('**/api/design-search/meta*', route => route.fulfill({ json: { version: index.version, builtAt: index.builtAt } }));
    await page.route('**/api/design-search/recent*', route => route.fulfill({ json: { rows: [] } }));
    await page.route('**/api/digitized-designs/lookup*', route => route.fulfill({ json: { designs: {} } }));
    await page.route('**/api/artrequests?*', route => route.fulfill({ json: [] }));
    await page.route('**/api/mockups?*', route => route.fulfill({ json: { records: [] } }));
}

test('CSS workspaces: Vault search, windowed grid, card density and small screens', async ({ page }) => {
    await vault(page, 720);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboards/design-gallery.html?q=Fixture');
    await expect(page.locator('#dg-boot')).toBeHidden();
    await expect(page.locator('#dg-count')).toHaveText('720');
    await expect(page.locator('#dg-grid .dg-card').first()).toBeVisible();
    expect(await page.locator('#dg-grid .dg-card').count()).toBeLessThan(720);
    await expect(page.locator('#dg-grid .dg-card-body').first()).toHaveCSS('padding', '12px');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.locator('#dg-grid .dg-card').last().getAttribute('data-idx')).not.toBe('199');
    await page.locator('#dg-grid-viewport').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#dg-grid .dg-card[data-idx="719"]')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#dg-grid .dg-card[data-idx="0"]')).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Wall card size', exact: true }).click();
    await expect(page.locator('#dg-grid')).toHaveClass(/dg-grid--wall/);
    await page.getByRole('button', { name: 'Comfortable card size', exact: true }).click();
    await page.locator('#dg-omnibox').fill('No matching fixture anywhere');
    await expect(page.locator('#dg-count')).toHaveText('0');
    await expect(page.locator('#dg-grid .dg-card')).toHaveCount(0);
    await page.locator('#dg-omnibox').fill('Fixture design 1');
    await expect(page.locator('#dg-grid .dg-card').first()).toBeVisible();
    await layout(page, 'vault-results');
    await accessible(page);
});

test('CSS workspaces: Vault drawer, image zoom, one-level Escape and history', async ({ page }) => {
    await vault(page, 8);
    await page.goto('/dashboards/design-gallery.html?q=Fixture');
    const card = page.locator('#dg-grid .dg-card').first();
    const dn = await card.getAttribute('data-dn');
    await card.click();
    await expect(page.locator('#dg-drawer')).toBeVisible();
    await expect(page).toHaveURL(new RegExp('#design=' + dn));
    await expect(page.locator('#dg-drawer [data-close]')).toBeFocused();
    await layout(page, 'vault-drawer');
    await accessible(page);
    await page.locator('#dg-drawer [data-hero-img]').click();
    await expect(page.locator('#dg-lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dg-lightbox')).toBeHidden();
    await expect(page.locator('#dg-drawer')).toBeVisible();
    await expect(page.locator('#dg-drawer')).toContainText('Fixture Company');
    await expect.poll(() => page.evaluate(() => document.getElementById('dg-drawer').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dg-drawer')).toBeHidden();
    await expect(page).not.toHaveURL(/#design=/);
    await expect(card).toBeFocused();
    await card.click();
    await page.locator('#dg-drawer [data-hero-img]').click();
    await page.goBack();
    await expect(page.locator('#dg-drawer')).toBeHidden();
    await expect(page.locator('#dg-lightbox')).toBeHidden();
});

test('CSS workspaces: Vault loading, failed boot and retry remain distinct from empty data', async ({ page }) => {
    await vault(page, 3);
    let release, fail = true;
    await page.route('**/api/design-search/index*', async route => {
        await new Promise(resolve => { release = resolve; });
        await route.fulfill(fail ? { status: 500, json: { error: 'Fixture index outage' } } : { json: indexFixture(3) });
    });
    await page.goto('/dashboards/design-gallery.html?q=Fixture');
    await expect(page.locator('#dg-boot')).toBeVisible();
    await expect(page.locator('#dg-boot-retry')).toBeHidden();
    await layout(page, 'vault-loading');
    release();
    await expect(page.locator('#dg-boot-retry')).toBeVisible();
    await shot(page, 'vault-error');
    fail = false;
    release = null;
    await page.locator('#dg-boot-retry').click();
    await expect.poll(() => Boolean(release)).toBe(true);
    release();
    await expect(page.locator('#dg-boot')).toBeHidden();
    await expect(page.locator('#dg-count')).toHaveText('3');
});

async function publisher(page) {
    await fixture(page, 'dashboards/gear-publisher.html');
    await page.route('**/api/gear/config', route => route.fulfill({ json: { config: { styles: [{ option: 'T-Shirt', sanmarStyle: 'PC54', price: 25 }], sizeOrder: ['S','M','L'] } } }));
    await page.route('**/api/gear/products?*', route => route.fulfill({ json: { found: false } }));
    await page.route('**/api/product-details?*', route => route.fulfill({ json: [{ CATALOG_COLOR: 'Black', COLOR_NAME: 'Black', COLOR_SQUARE_IMAGE: '/favicon.png' }] }));
}
test('CSS workspaces: Publisher identity, product selection, photo blockers and navigation', async ({ page }) => {
    await publisher(page);
    await page.goto('/dashboards/gear-publisher.html?draft=css-fixture');
    await expect(page.locator('#gp-step-identity')).toBeVisible();
    await expect(page.locator('#gp-next-btn')).toBeDisabled();
    await layout(page, 'publisher-identity');
    await accessible(page);
    await page.locator('#gp-designNumber').fill('10001');
    await page.locator('#gp-designName').fill('Fixture artwork');
    await page.locator('#gp-designDescription').fill('Fixture description');
    await page.locator('#gp-next-btn').click();
    await expect(page.locator('#gp-step-products')).toBeVisible();
    await page.locator('input[data-style="T-Shirt"]').check();
    await page.locator('input[data-color="Black"]').check();
    await page.locator('input[data-size="M"]').check();
    await expect(page.locator('#gp-counter')).toContainText('1 variants');
    await page.locator('#gp-next-btn').click();
    await expect(page.locator('#gp-step-photos')).toBeVisible();
    await expect(page.locator('#gp-blockers')).toContainText('1 photo still needed');
    await expect(page.locator('#gp-next-btn')).toBeDisabled();
    await layout(page, 'publisher-photo-missing');
    await accessible(page);
    await page.locator('#gp-back-btn').click();
    await expect(page.locator('input[data-size="M"]')).toBeChecked();
});

test('CSS workspaces: Publisher settings failure shows unknown pricing', async ({ page }) => {
    await publisher(page);
    await page.route('**/api/gear/config', route => route.fulfill({ status: 503, json: { error: 'Fixture settings unavailable' } }));
    await page.goto('/dashboards/gear-publisher.html?draft=css-failed');
    await expect(page.locator('.dash-error-banner')).toContainText('prices are unknown');
    await layout(page, 'publisher-settings-error');
    await accessible(page);
});

function publisherDraft(step = 'photos') {
    return {
        draftId: 'css-saved', designNumber: '10001', designName: 'Saved fixture', designDescription: 'Saved design description', identitySource: 'typed', city: 'Tacoma',
        styles: ['T-Shirt'], colors: [{ colorName: 'Black', catalogColor: 'Black', swatchImage: '/favicon.png' }], sizes: ['M','L'], seasonal: false, seasons: [],
        images: { 't-shirt|||black': { state: 'uploaded', externalKey: 'fixture-file', hostedUrl: '/favicon.png', previewUrl: 'blob:expired-fixture', width: 2400, height: 2400, altText: 'Saved artwork' } },
        heroKey: 't-shirt|||black', altText: 'Saved artwork', hook: 'Saved fixture hook', body: 'Saved description body.', facts: { raw: 'Saved background', landmark: 'Fixture landmark', years: '1990', whoRanIt: 'Fixture owner', sources: 'Fixture source' },
        seoTitle: '', seoDescription: '', tags: [], classification: null, step, productGid: '', productId: '', handle: '', publishedAt: '', idempotencyKey: '',
    };
}
async function seedPublisher(page, draft) {
    await page.addInitScript(d => {
        // Only seed the first visit, so reload exercises the app's saved model.
        if (!localStorage.getItem('gearPublisherDraft:' + d.draftId)) localStorage.setItem('gearPublisherDraft:' + d.draftId, JSON.stringify(d));
    }, draft);
}

test('CSS workspaces: Publisher restores drafts, text, selected colors and photo URLs', async ({ page }) => {
    await publisher(page);
    await seedPublisher(page, publisherDraft());
    await page.goto('/dashboards/gear-publisher.html?draft=css-saved');
    await expect(page.locator('#gp-alt')).toHaveValue('Saved artwork');
    await expect(page.locator('.gp-cell-thumb')).toHaveAttribute('src', '/favicon.png');
    await expect(page.locator('.gp-cell input[name="gp-hero"]')).toBeChecked();
    await page.locator('.gp-binding summary').click();
    await expect(page.locator('.gp-binding-table tbody tr')).toHaveCount(2);
    await layout(page, 'publisher-photo-bound');
    await accessible(page);
    await page.locator('#gp-next-btn').click();
    await expect(page.locator('#gp-hook')).toHaveValue('Saved fixture hook');
    await expect(page.locator('#gp-body')).toHaveValue('Saved description body.');
    await expect(page.locator('#gp-facts')).toHaveValue('Saved background');
    await expect(page.locator('#gp-fact-who')).toHaveValue('Fixture owner');
    await page.locator('#gp-hook').fill('Edited fixture hook');
    await page.locator('#gp-fact-sources').fill('Edited source');
    await page.reload();
    await expect(page.locator('#gp-hook')).toHaveValue('Edited fixture hook');
    await expect(page.locator('#gp-fact-sources')).toHaveValue('Edited source');
    await layout(page, 'publisher-story');
    await accessible(page);
    await page.locator('#gp-back-btn').click();
    await page.locator('#gp-back-btn').click();
    await expect(page.locator('input[data-color="Black"]')).toBeChecked();
    await page.locator('#gp-back-btn').click();
    await expect(page.locator('#gp-designName')).toHaveValue('Saved fixture');
});

test('CSS workspaces: Publisher image selection works by keyboard and failed upload remains actionable', async ({ page }) => {
    await publisher(page);
    const draft = publisherDraft();
    draft.images = {}; draft.heroKey = '';
    await seedPublisher(page, draft);
    let uploadRelease, writes = 0;
    await page.route('**/api/files/upload', async route => {
        writes++;
        await new Promise(resolve => { uploadRelease = resolve; });
        await route.fulfill({ status: 503, json: { error: 'Fixture image service unavailable' } });
    });
    await page.goto('/dashboards/gear-publisher.html?draft=css-saved');
    const choose = page.getByRole('button', { name: 'Choose photo' });
    await choose.focus();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise;
    await chooser.setFiles(path.join(ROOT, 'favicon.png'));
    await expect(page.locator('.gp-cell-error')).toContainText('2048px');
    expect(writes).toBe(0);
    const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 2048;
        return canvas.toDataURL('image/png').split(',')[1];
    });
    const retryChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Try again' }).click();
    await (await retryChooser).setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.locator('.gp-cell-progress')).toBeVisible();
    await expect.poll(() => Boolean(uploadRelease)).toBe(true);
    await shot(page, 'publisher-photo-uploading');
    uploadRelease();
    await expect(page.locator('.gp-cell-error')).toHaveText('Fixture image service unavailable');
    await expect(page.locator('#gp-next-btn')).toBeDisabled();
    await layout(page, 'publisher-photo-failed');
    await accessible(page);
});

test('CSS workspaces: Publisher audit gates mocked publication and reload preserves the receipt', async ({ page }) => {
    await publisher(page);
    await seedPublisher(page, publisherDraft('review'));
    const payloads = [], keys = [];
    let blocked = true, publishes = 0;
    await page.route('**/api/gear/products', route => {
        payloads.push(route.request().postDataJSON()); keys.push(route.request().headers()['idempotency-key']);
        return route.fulfill({ json: { jobId: '10001' } });
    });
    await page.route('**/api/gear/jobs/10001', route => route.fulfill({ json: { job: {
        status: 'awaiting_review', stepsDone: ['Product created', 'Images bound'], errors: [],
        audit: { pass: !blocked, checks: [{ name: 'Variant images', detail: blocked ? 'One image still missing' : 'Every variant has an image', pass: !blocked, blocking: true }] },
        shopify: { productGid: 'gid://shopify/Product/90001', legacyId: 90001, handle: 'fixture-design', publishedAt: '', variantsBound: { bound: blocked ? 1 : 2, total: 2 }, adminUrl: 'https://example.test/draft' },
    } } }));
    await page.route('**/api/gear/products/90001/publish', route => {
        publishes++;
        if (publishes === 1) return route.fulfill({ status: 409, json: { error: 'Fixture audit changed', audit: { pass: false, checks: [{ name: 'Images', detail: 'Image changed after review', pass: false, blocking: true }] } } });
        return route.fulfill({ json: { publishedAt: '2026-09-08T19:00:00Z', storefrontUrl: 'https://example.test/products/fixture-design', verified: { verified: true, httpStatus: 200 } } });
    });
    await page.goto('/dashboards/gear-publisher.html?draft=css-saved');
    await expect(page.locator('#gp-next-btn')).toBeHidden();
    await page.locator('#gp-create-btn').click();
    await expect(page.locator('#gp-job-body')).toContainText('One image still missing');
    await expect(page.locator('#gp-job-body')).toContainText('Ready for review');
    await expect(page.locator('#gp-publish-btn')).toBeDisabled();
    await layout(page, 'publisher-review-blocked');
    await accessible(page);
    blocked = false;
    await page.reload();
    // Resume is a GET of the known job, never a duplicate build or publish.
    await expect(page.locator('#gp-publish-btn')).toBeEnabled();
    expect(payloads).toHaveLength(1);
    expect(keys).toEqual(['gear-css-saved']);
    expect(payloads[0]).toMatchObject({ designNumber: '10001', sizes: ['M','L'], images: [{ externalKey: 'fixture-file', styleOption: 'T-Shirt', catalogColor: 'Black', primary: true }] });
    await page.locator('#gp-publish-btn').click();
    await expect(page.locator('#gp-publish-btn')).toBeDisabled();
    await expect(page.locator('#gp-job-body')).toContainText('Image changed after review');
    await expect(page.locator('.dash-error-banner')).toContainText('Publish blocked');
    await page.reload();
    await expect(page.locator('#gp-publish-btn')).toBeEnabled();
    await page.locator('#gp-publish-btn').click();
    await expect(page.locator('#gp-step-live')).toBeVisible();
    await expect(page.locator('#gp-live')).toContainText('Live on 253gear.com');
    await expect(page.locator('#gp-next-btn')).toBeHidden();
    await page.reload();
    await expect(page.locator('#gp-live')).toContainText('This draft was published');
    await expect(page.locator('#gp-live')).toContainText('has not been checked again');
    expect(publishes).toBe(2);
    await layout(page, 'publisher-live-receipt');
    await accessible(page);
});


test('CSS workspaces: Publisher screenshot extraction fills visible editable fields', async ({ page }) => {
    await publisher(page);
    await page.route('**/api/gear/extract-shopworks', route => route.fulfill({ json: { designNumber: '10002', designName: 'Recognized fixture', designDescription: 'Recognized description' } }));
    await page.goto('/dashboards/gear-publisher.html?draft=css-ocr');
    await page.locator('#gp-screenshot').setInputFiles(path.join(ROOT, 'favicon.png'));
    await expect(page.locator('#gp-designNumber')).toHaveValue('10002');
    await expect(page.locator('#gp-designName')).toHaveValue('Recognized fixture');
    await expect(page.locator('#gp-designDescription')).toHaveValue('Recognized description');
    await expect(page.locator('#gp-next-btn')).toBeEnabled();
    await page.locator('#gp-designName').fill('Human-corrected fixture');
    await page.reload();
    await expect(page.locator('#gp-designName')).toHaveValue('Human-corrected fixture');
});
