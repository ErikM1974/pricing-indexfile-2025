const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/design-library-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce' });
async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], unmocked: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(({ clipboardFails, fallbackSucceeds }) => {
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => {
            if (clipboardFails) return Promise.reject(new Error('Clipboard denied'));
            window.__copied.push(value); return Promise.resolve();
        } } });
        document.execCommand = command => { if (command !== 'copy') throw new Error('Unexpected command'); return !!fallbackSucceeds; };
    }, state);
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) { events.writes.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname === '/api/al-pricing') return route.fulfill({ status: state.pricingStatus || 200, json: state.pricing ?? fixture.pricing });
        if (u.hostname === 'c3eku948.caspio.com' && u.pathname.endsWith('/emb')) {
            const markup = state.missing ? '' : (name === 'old-designs' ? fixture.archiveFields : fixture.fields) + (state.initialSearch ? '' : name === 'old-designs' ? fixture.archiveRows : fixture.designRows);
            return route.fulfill({ contentType: 'application/javascript', body: 'document.write(' + JSON.stringify(markup) + ');' });
        }
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.continue();
    });
    await page.goto('/dashboards/' + name + '.html');
    await page.addStyleTag({ content: fixture.providerStyle });
    if (!state.missing) {
        await page.locator('form').evaluate(form => form.addEventListener('submit', e => e.preventDefault()));
        await expect(page.locator('.form-field-group')).toHaveCount(2);
        if (!state.initialSearch) await expect(page.locator(name === 'old-designs' ? '.card-actions' : '.card-content')).toHaveCount(name === 'old-designs' ? 2 : 3);
    }
    await page.evaluate(() => document.fonts.ready); return events;
}
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function clean(events) { expect(events).toEqual({ errors: [], writes: [], unmocked: [] }); }
for (const name of ['digitized-designs', 'old-designs']) test('CSS design libraries: ' + name + ' provider layout, four widths and print', async ({ page }) => {
    test.setTimeout(180000); const events = await open(page, name);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 950 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        for (const selector of ['#sample-search', '#sample-company']) {
            await expect(page.locator(selector)).toBeVisible(); expect((await page.locator(selector).boundingBox()).height).toBeGreaterThanOrEqual(44);
            await page.locator(selector).focus(); expect(await page.locator(selector).evaluate(n => getComputedStyle(n).outlineStyle)).not.toBe('none');
        }
        await expect(page.locator('.cbSearchButton:visible')).toHaveCount(1); await axe(page);
        await page.screenshot({ path: path.join(output, 'designs-' + name + '-' + width + '.png'), fullPage: true });
    }
    if (name === 'digitized-designs') {
        expect(await page.locator('.restructured dl').evaluateAll(nodes => nodes.every(n => !n.checkVisibility()))).toBe(true);
        await expect(page.locator('.card-header').last()).toContainText('40123'); await expect(page.locator('.card-header').last()).toContainText('from DST file');
        await expect(page.locator('.fb-tier-price')).toHaveText(['$22.50', '$20.25', '$18.75', '$16.50', '$15.25']);
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#design-main')).toBeFocused();
    await page.locator('#sample-search').fill('40121'); await page.locator('#sample-company').selectOption('example');
    await page.setViewportSize({ width: 1440, height: 950 }); await page.emulateMedia({ media: 'print' });
    const blocks = await page.locator('h1,.page-subtitle,.card-header,.as-surcharge-badge,.fb-pricing,.card-meta,.card-details.open,[data-cleaned] dt,[data-cleaned] dd,.result-count-badge').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
    blocks.push(...await page.locator('.cbFormLabelCell,input[type=text],select').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.tagName === 'SELECT' ? n.selectedOptions[0].textContent : n.tagName === 'INPUT' ? n.value : n.innerText).filter(Boolean)));
    fs.writeFileSync(path.join(output, 'designs-' + name + '-print.json'), JSON.stringify({ blocks }));
    await page.pdf({ path: path.join(output, 'designs-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true }); await clean(events);
});
test('CSS design libraries: details and live additional-logo prices retain all five tiers', async ({ page }) => {
    const events = await open(page, 'digitized-designs'); const details = page.locator('.card-details-toggle').first();
    await details.click(); await expect(details).toHaveAttribute('aria-expanded', 'true'); await expect(page.locator('.card-details.open')).toContainText('40121.dst');
    const trigger = page.locator('.al-pricing-btn').first(); await trigger.click(); await expect(page.locator('#al-modal')).toBeVisible();
    await expect(page.locator('#al-source-note')).toHaveText('Prices live from Caspio Embroidery_Costs.');
    await expect(page.locator('#al-garment-table .tier-price')).toHaveText(['$10.00 each', '$9.00 each', '$8.00 each', '$7.50 each', '$7.00 each']);
    await expect(page.locator('#al-garment-table .tier-total')).toHaveText(['$16.25 each', '$15.25 each', '$14.25 each', '$13.75 each', '$13.25 each']);
    await expect(page.locator('#al-cap-table .tier-total')).toHaveText(['$14.50 each', '$13.50 each', '$12.75 each', '$12.50 each', '$12.25 each']);
    await expect(page.locator('#al-stitch-info')).toContainText('12,500 stitches'); await expect(page.locator('#al-garment-table .ltm-tag')).toHaveText('+$50.00 LTM');
    for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 950 }); await axe(page); expect(await page.locator('.al-modal-content').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true); }
    await page.keyboard.press('Escape'); await expect(page.locator('#al-modal')).toBeHidden(); await expect(trigger).toBeFocused(); await clean(events);
});
for (const [name, pricingStatus, pricing] of [['unavailable', 503, {}], ['incomplete', 200, {}], ['missing tier', 200, { ...fixture.pricing, garments: { ...fixture.pricing.garments, basePrices: {} } }]]) test('CSS design libraries: ' + name + ' pricing is explicitly reference data', async ({ page }) => {
    const events = await open(page, 'digitized-designs', { pricingStatus, pricing }); await page.locator('.al-pricing-btn').first().click();
    await expect(page.locator('#al-source-note')).toContainText('Showing reference prices'); await expect(page.locator('#al-garment-table .tier-price')).toHaveCount(5); await axe(page); await clean(events);
});
for (const name of ['digitized-designs', 'old-designs']) test('CSS design libraries: ' + name + ' preview focus, dismissal and keyboard', async ({ page }) => {
    const events = await open(page, name); const trigger = page.locator(name === 'old-designs' ? '[data-cleaned] img' : '.img-btn').first();
    await trigger.focus(); await page.keyboard.press('Enter'); await expect(page.locator('#image-modal')).toBeVisible(); await expect(page.locator('#image-modal-close')).toBeFocused();
    expect(await page.locator('.dash-shell').evaluate(n => n.inert)).toBe(true); await axe(page);
    if (name === 'old-designs') { await expect(page.locator('.modal-counter')).toHaveText('1 / 2'); await page.keyboard.press('ArrowRight'); await expect(page.locator('.modal-counter')).toHaveText('2 / 2'); await page.keyboard.press('ArrowRight'); await expect(page.locator('.modal-counter')).toHaveText('1 / 2'); }
    await page.keyboard.press('Escape'); await expect(page.locator('#image-modal')).toBeHidden(); await expect(trigger).toBeFocused(); expect(await page.locator('.dash-shell').evaluate(n => n.inert)).toBe(false); await clean(events);
});
test('CSS design libraries: archive copy and image link preserve values', async ({ page }) => {
    const events = await open(page, 'old-designs'); await page.locator('.card-copy-btn').first().click(); await expect(page.locator('.toast').last()).toHaveText('Copied: 40121');
    await page.locator('.card-share-btn').first().click(); await expect(page.locator('.toast').last()).toHaveText('Image link copied for 40121!');
    const values = await page.evaluate(() => window.__copied); expect(values[0]).toBe('40121'); expect(values[1]).toMatch(/^data:image\/svg\+xml/); await clean(events);
});
for (const fallbackSucceeds of [true, false]) test('CSS design libraries: archive clipboard fallback ' + fallbackSucceeds, async ({ page }) => {
    const events = await open(page, 'old-designs', { clipboardFails: true, fallbackSucceeds }); await page.locator('.card-copy-btn').first().click();
    await expect(page.locator('.toast').last()).toHaveText(fallbackSucceeds ? 'Copied: 40121' : 'Could not copy design number'); await expect(page.locator('.sr-copy')).toHaveCount(0); await clean(events);
});
test('CSS design libraries: failed and empty archive searches stop loading and recover', async ({ page }) => {
    const events = await open(page, 'old-designs', { initialSearch: true }); await page.locator('.cbSearchButton:visible').click(); await expect(page.locator('.loading-spinner')).toBeVisible();
    await page.locator('.caspio-container').evaluate(n => n.insertAdjacentHTML('beforeend', '<div class="cbResultSetError">Search unavailable</div>'));
    await expect(page.locator('.loading-spinner')).toHaveCount(0); await expect(page.locator('.empty-state')).toHaveCount(0); await expect(page.locator('.cbResultSetError')).toContainText('Search unavailable');
    await page.locator('.cbResultSetError').evaluate(n => n.remove()); await page.locator('.cbSearchButton:visible').click();
    await page.locator('.caspio-container').evaluate(n => n.insertAdjacentHTML('beforeend', '<div class="cbResultSetNavigationMessages">No records found</div>'));
    await expect(page.locator('.loading-spinner')).toHaveCount(0); await expect(page.locator('.empty-state')).toContainText('No designs found');
    await page.locator('.cbResultSetNavigationMessages').evaluate(n => n.remove()); await page.locator('.caspio-container').evaluate((n, rows) => n.insertAdjacentHTML('beforeend', rows), fixture.archiveRows);
    await expect(page.locator('.card-actions')).toHaveCount(2); await expect(page.locator('.empty-state')).toHaveCount(0); await expect(page.locator('.result-count-badge')).toContainText('2 designs shown'); await clean(events);
});
test('CSS design libraries: provider form replacement keeps mobile field values and sticky summary', async ({ page }) => {
    const events = await open(page, 'old-designs'); await page.setViewportSize({ width: 390, height: 700 });
    await page.locator('#sample-search').fill('40121'); await page.locator('#sample-company').selectOption('example');
    expect(await page.locator('form').evaluate(n => Object.fromEntries(new FormData(n)))).toEqual({ Value1: '40121', Value2: 'example' });
    await page.locator('.cbSearchButton:visible').click();
    await page.locator('.card-actions').last().scrollIntoViewIfNeeded(); await expect(page.locator('#sticky-search-bar')).toBeVisible();
    await expect(page.locator('#sticky-search-bar')).toContainText('40121'); await expect(page.locator('#sticky-search-bar')).toContainText('Example Outfitters');
    await page.locator('form').evaluate((n, form) => { n.outerHTML = form; }, fixture.archiveFields);
    await page.evaluate(() => window.scrollTo(0, 0)); await expect(page.locator('#sticky-search-bar')).toBeHidden();
    await expect(page.locator('.form-field-group')).toHaveCount(2); await expect(page.locator('#sample-search')).toBeVisible();
    await page.locator('#sample-search').fill('40122'); expect(await page.locator('form').evaluate(n => new FormData(n).get('Value1'))).toBe('40122');
    await page.locator('#design-main').focus(); await page.keyboard.press('/'); await expect(page.locator('#sample-search')).toBeFocused(); await clean(events);
});
for (const name of ['digitized-designs', 'old-designs']) test('CSS design libraries: ' + name + ' missing embed has a visible retry', async ({ page }) => {
    const events = await open(page, name, { missing: true }); await expect(page.locator('.caspio-fail')).toContainText('The Caspio list did not load', { timeout: 20000 }); await expect(page.locator('.caspio-fail-retry')).toBeVisible(); await axe(page); await clean(events);
});
