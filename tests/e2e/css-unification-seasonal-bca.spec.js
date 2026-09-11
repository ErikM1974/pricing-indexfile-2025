const {test, expect} = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const {root, openBca, contact} = require('./helpers/seasonal-bundles-browser');
const capture = process.env.CAPTURE_SEASONAL_ORIGINAL === '1', phase = capture ? 'original' : 'current';
const out = path.join(__dirname, 'screenshots/css-unification');
test.use({timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce'});
async function evidence(page, name, events) {
    const states = []; fs.mkdirSync(out, {recursive: true});
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width, height: 1000});
        await page.evaluate(async () => {await document.fonts.ready; await Promise.all([...document.images].map(n => n.decode().catch(() => {})));});
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
        if (!capture) {expect(snapshot.overflow).toBe(false); expect(axe.violations).toEqual([]);}
        await page.screenshot({path: path.join(out, 'specialty-calculators-bca-' + name + '-' + phase + '-' + width + '.png'), fullPage: true});
    }
    const record = {name, diagnosticService: name !== 'broken-link', states, events, emails: await page.evaluate(() => window.__emails)};
    const relative = 'tests/fixtures/seasonal-bca-' + name + '-original-browser.json', file = path.join(root, relative);
    if (capture) {
        if (fs.existsSync(file)) expect(record).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
        else {fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n'); fs.appendFileSync(path.join(root, 'ACTIVE_FILES.md'), '\n- ' + relative + ' — immutable synthetic awareness-bundle browser evidence; service-link diagnostic labeled explicitly.\n');}
    } else {
        const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(record.emails).toEqual(prior.emails);
        expect(record.events.writes).toEqual(prior.events.writes);
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
