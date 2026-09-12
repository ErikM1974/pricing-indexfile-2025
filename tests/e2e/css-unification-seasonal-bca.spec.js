const {test, expect} = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const {root, openBca, contact} = require('./helpers/seasonal-bundles-browser');
const capture = process.env.CAPTURE_SEASONAL_ORIGINAL === '1', phase = capture ? 'original' : 'current';
const out = path.join(__dirname, 'screenshots/css-unification');

test.describe('CSS seasonal awareness current interaction and request safety', () => {
    test.skip(capture, 'Current behavior fixes do not overwrite original evidence.');
    test('the public page loads its assets while retired archive paths stay closed', async ({request}) => {
        const page = await request.get('/breast-cancer-awareness-bundle.html');
        expect(page.status()).toBe(200);
        const html = await page.text();
        for (const [asset, mime] of [
            ['/calculators/breast-cancer-awareness-bundle.css', 'text/css'],
            ['/calculators/breast-cancer-awareness-bundle.js', 'javascript'],
            ['/calculators/breast-cancer-bundle-service.js', 'javascript']
        ]) {
            expect(html).toContain(asset);
            const response = await request.get(asset);
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toContain(mime);
            expect(await response.body()).toEqual(fs.readFileSync(path.join(root, asset.slice(1))));
        }
        for (const file of ['breast-cancer-awareness-bundle.html', 'breast-cancer-bundle-service.js']) {
            expect((await request.get('/calculators/archive/seasonal-2025/' + file)).status()).toBe(410);
        }
    });
    test('keyboard product preview opens, closes, and returns focus', async ({page}) => {
        const events = await openBca(page);
        const trigger = page.locator('button[data-call="openProductModal"]').first();
        await trigger.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('#productModal')).toBeVisible();
        await expect(page.locator('#modalTitle')).not.toBeEmpty();
        expect(await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa']).analyze().then(r => r.violations)).toEqual([]);
        await page.keyboard.press('Escape'); await expect(page.locator('#productModal')).not.toBeVisible(); await expect(trigger).toBeFocused();
        expect(events.errors).toEqual([]);
    });
    test('incomplete sizes and invalid contacts remain visible and recover on edit', async ({page}) => {
        await openBca(page); await page.locator('#nextBtn').click(); await page.locator('#nextBtn').click();
        await expect(page.locator('#bundleError')).toBeVisible(); await expect(page.locator('#step-2')).toBeVisible();
        await page.locator('#size-M').fill('3'); await page.locator('#size-L').fill('5'); await page.locator('#nextBtn').click();
        await page.locator('#nextBtn').click();
        await expect(page.locator('#customerName')).toHaveAttribute('aria-invalid', 'true');
        await page.locator('#customerName').fill('Example Customer'); await expect(page.locator('#customerName')).not.toHaveAttribute('aria-invalid', 'true');
    });
    test('a missing order script gives an actionable error', async ({page}) => {
        const events = await openBca(page, {missingService: true});
        await expect(page.locator('#bundleError')).toContainText('Ordering is unavailable');
        expect(events.errors).toEqual([]); expect(events.writes).toEqual([]);
    });
    test('a missing email provider reports a saved order with unfinished email', async ({page}) => {
        const events = await openBca(page, {missingEmail: true}); await contact(page);
        await page.locator('#nextBtn').click(); await page.locator('#submitBtn').click();
        await expect(page.locator('#confirmationStatus')).toContainText('Email delivery is incomplete');
        expect(events.writes).toHaveLength(9); expect(events.errors).toEqual([]);
    });
    for (const flag of ['failCustomer', 'failSales']) test(flag + ' retries only the missing email', async ({page}) => {
        const events = await openBca(page, {[flag]: true}); await contact(page); await page.locator('#nextBtn').click(); await page.locator('#submitBtn').click();
        await expect(page.locator('#retryBundleEmail')).toBeVisible(); expect(events.writes).toHaveLength(9);
        await page.evaluate(() => {window.__failCustomer = false; window.__failSales = false;});
        await page.locator('#retryBundleEmail').click(); await expect(page.locator('#confirmationStatus')).toContainText('email has been sent');
        await expect(page.locator('#retryBundleEmail')).toBeHidden();
        expect(events.writes).toHaveLength(9);
        const emails = await page.evaluate(() => window.__emails);
        expect(emails).toHaveLength(3); expect(emails[2].template).toBe(flag === 'failCustomer' ? 'template_2rlgjio' : 'template_af6h6kh');
    });
    for (const flag of ['failSession', 'failItem']) test(flag + ' retry finishes the same reference', async ({page}) => {
        const state = {[flag]: true}, events = await openBca(page, state);
        await contact(page); await page.locator('#nextBtn').click(); await page.locator('#submitBtn').click();
        await expect(page.locator('#bundleError')).toBeVisible();
        expect(await page.evaluate(() => window.__emails)).toEqual([]);
        state[flag] = false; await page.locator('#submitBtn').click(); await expect(page.locator('#step-success')).toBeVisible();
        const sessions = events.writes.filter(r => r.path.endsWith('sessions'));
        expect(sessions).toHaveLength(flag === 'failSession' ? 2 : 1);
        expect(new Set(sessions.map(r => r.body.QuoteID)).size).toBe(1);
        expect(await page.evaluate(() => window.__emails.length)).toBe(2);
    });
    test('pending requests freeze fields and capture one order', async ({page}) => {
        let release; const state = {hold: new Promise(resolve => {release = resolve;})};
        const events = await openBca(page, state); await contact(page); await page.locator('#nextBtn').click();
        await page.locator('#submitBtn').click(); await expect(page.locator('#loadingSpinner')).toBeVisible();
        await expect(page.locator('#prevBtn')).toBeDisabled(); await expect(page.locator('#customerName')).toBeDisabled();
        await page.evaluate(() => {document.getElementById('customerName').value = 'Edited after submit'; submitOrder();});
        expect(events.writes).toHaveLength(1); release();
        await expect(page.locator('#step-success')).toBeVisible(); expect(events.writes).toHaveLength(9);
        expect((await page.evaluate(() => window.__emails))[0].data.customer_name).toBe('Example Customer');
    });
    test('logo image, PDF replacement, removal and review use literal file names', async ({page}) => {
        const events = await openBca(page); await contact(page);
        const file = page.locator('#logoFile');
        await file.setInputFiles({name: 'synthetic.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="green"/></svg>')});
        await expect(page.locator('#previewImage')).toBeVisible();
        await file.setInputFiles({name: 'synthetic <b>logo</b>.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic logo')});
        await expect(page.locator('#previewImage')).toBeHidden(); await expect(page.locator('#logoFileName')).toHaveText('synthetic <b>logo</b>.pdf');
        await page.locator('#nextBtn').click(); expect(await page.locator('#reviewCustomerInfo b').count()).toBe(0);
        await expect(page.locator('#reviewCustomerInfo')).toContainText('synthetic <b>logo</b>.pdf');
        await page.locator('#prevBtn').click(); await page.locator('[data-call="removeLogo"]').click();
        await expect(page.locator('#logoPreview')).toBeHidden(); await expect(file).toBeFocused(); expect(events.writes).toEqual([]);
    });
    test('a failed logo upload stops order writes and can retry', async ({page}) => {
        const state = {failUpload: true}, events = await openBca(page, state); await contact(page);
        await page.locator('#logoFile').setInputFiles({name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic logo')});
        await page.locator('#nextBtn').click(); await page.locator('#submitBtn').click();
        await expect(page.locator('#bundleError')).toContainText('Logo upload failed');
        expect(events.writes).toEqual([{path: '/api/files/upload', file: 'synthetic-logo'}]);
        state.failUpload = false; await page.locator('#submitBtn').click(); await expect(page.locator('#step-success')).toBeVisible();
        expect(events.writes).toHaveLength(11); expect(events.writes.filter(r => r.path.endsWith('sessions'))).toHaveLength(1);
    });
});

test.use({timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce'});
async function evidence(page, name, events) {
    const states = []; fs.mkdirSync(out, {recursive: true});
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width, height: 1000});
        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].filter(n => n.getAttribute('src')).map(async n => {
                try {await n.decode();} catch {const src = n.src; n.removeAttribute('src'); n.src = src; await n.decode().catch(() => {});}
            }));
        });
        const snapshot = await page.evaluate(() => {
            const visible = n => Boolean(n.getClientRects().length) && getComputedStyle(n).visibility !== 'hidden';
            const norm = s => s.replace(/\s+/g, ' ').trim();
            return {text: norm(document.querySelector('main').innerText), title: document.title,
                fields: [...document.querySelectorAll('input,select,textarea')].filter(visible).map(n => ({id: n.id, name: n.name, value: n.value, checked: n.checked})),
                images: [...document.images].filter(visible).map(n => ({src: n.getAttribute('src'), alt: n.alt})),
                overflow: document.documentElement.scrollWidth > innerWidth + 1};
        });
        const axe = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        states.push({width, ...snapshot, violations: axe.violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))});
        if (!capture) {
            expect(snapshot.overflow).toBe(false); expect(axe.violations).toEqual([]);
            expect(await page.evaluate(() => [...document.images].filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && n.getAttribute('src') && !n.naturalWidth).map(n => n.src))).toEqual([]);
        }
        await page.screenshot({path: path.join(out, 'specialty-calculators-bca-' + name + '-' + phase + '-' + width + '.png'), fullPage: true});
    }
    const record = {name, diagnosticService: name !== 'broken-link', states, events, emails: await page.evaluate(() => window.__emails)};
    const relative = 'tests/fixtures/seasonal-bca-' + name + '-original-browser.json', file = path.join(root, relative);
    if (capture) {
        if (fs.existsSync(file)) expect(record).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
        else {fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n'); fs.appendFileSync(path.join(root, 'ACTIVE_FILES.md'), '\n- ' + relative + ' — immutable synthetic awareness-bundle browser evidence; service-link diagnostic labeled explicitly.\n');}
    } else {
        const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (name === 'failed-item') {
            expect(record.emails).toEqual([]);
            expect(record.events.writes).toEqual(prior.events.writes.slice(0, 2));
            await expect(page.locator('#step-4')).toBeVisible();
            await expect(page.locator('#bundleError')).toContainText('incomplete');
        } else if (name === 'failed-email') {
            const successful = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/seasonal-bca-success-original-browser.json'), 'utf8'));
            expect(record.emails).toEqual(successful.emails);
            expect(record.events.writes).toEqual(prior.events.writes);
            await expect(page.locator('#confirmationStatus')).toContainText('Email delivery is incomplete');
            await expect(page.locator('#retryBundleEmail')).toBeVisible();
        } else {
            expect(record.emails).toEqual(prior.emails);
            expect(record.events.writes).toEqual(prior.events.writes);
        }
        if (name === 'failed-session') await expect(page.locator('#bundleError')).toContainText('could not be saved');
        if (name === 'success') await expect(page.locator('#confirmationStatus')).toContainText('email has been sent');
        fs.writeFileSync(path.join(out, 'seasonal-bca-' + name + '-current-browser.json'), JSON.stringify(record, null, 2) + '\n');
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await page.emulateMedia({media: 'print'});
    await page.pdf({path: path.join(out, 'specialty-calculators-bca-' + name + '-' + phase + '.pdf'), format: 'Letter', printBackground: true});
}
test('CSS seasonal awareness: original broken service link', async ({page}) => {
    test.skip(!capture, 'Original-link defect is preserved in the immutable baseline.');
    const events = await openBca(page);
    expect(events.missing).toContain('/calculators/breast-cancer-bundle-service.js');
    expect(events.errors).toContain('BreastCancerBundleService is not defined');
    await evidence(page, 'broken-link', events);
});
for (const mode of ['products', 'sizes', 'contact', 'review-ship', 'review-pickup', 'success', 'failed-session', 'failed-item', 'failed-email']) test('CSS seasonal awareness: ' + mode, async ({page}) => {
    const events = await openBca(page, {diagnosticService: capture, failSession: mode === 'failed-session', failItem: mode === 'failed-item', failEmail: mode === 'failed-email'});
    expect(events.errors).toEqual([]); expect(events.missing).toEqual([]); expect(events.unknown).toEqual([]);
    if (mode === 'sizes') await page.locator('#nextBtn').click();
    if (!['products', 'sizes'].includes(mode)) {
        await contact(page, mode === 'review-pickup');
        if (mode !== 'contact') await page.locator('#nextBtn').click();
    }
    if (['success', 'failed-session', 'failed-item', 'failed-email'].includes(mode)) {
        await page.locator('#submitBtn').click();
        await expect(page.locator('#loadingSpinner')).not.toBeVisible();
        if (capture) await expect(page.locator(mode === 'failed-session' ? '#step-4' : '#step-success')).toBeVisible();
    }
    await evidence(page, mode, events);
});
