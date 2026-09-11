const {test, expect} = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const {open, snapshot, check} = require('./helpers/specialty-calculators-browser');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'screenshots/css-unification');
const capture = process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL === '1', phase = capture ? 'original' : 'current';
test.use({timezoneId: 'America/Los_Angeles', locale: 'en-US', reducedMotion: 'reduce'});
function fixture(name, record) {
    const file = 'tests/fixtures/specialty-calculators-' + name + '-original-browser.json', absolute = path.join(root, file);
    if (capture && !fs.existsSync(absolute)) {
        fs.writeFileSync(absolute, JSON.stringify(record, null, 2) + '\n');
        fs.appendFileSync(path.join(root, 'ACTIVE_FILES.md'), '\n- ' + file + ' — immutable synthetic specialty calculator browser evidence.\n');
    } else expect(record).toEqual(JSON.parse(fs.readFileSync(absolute, 'utf8')));
}
async function evidence(page, name, events) {
    const states = [];
    fs.mkdirSync(out, {recursive: true});
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width, height: 1000});
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((node) => node.decode().catch(() => {}))); });
        const state = await snapshot(page), axe = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        states.push({width, ...state, violations: axe.violations.map((item) => ({id: item.id, nodes: item.nodes.map((node) => node.target)}))});
        if (!capture) { expect(state.overflow).toBe(false); expect(axe.violations).toEqual([]); }
        await page.screenshot({path: path.join(out, 'specialty-calculators-' + name + '-' + phase + '-' + width + '.png'), fullPage: true});
    }
    check(expect, events);
    const record = {name, states, dialogs: events.dialogs, mocked: events.mocked};
    if (capture) fixture(name, record);
    else {
        const prior = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/specialty-calculators-' + name + '-original-browser.json'), 'utf8'));
        for (let i = 0; i < states.length; i++) {
            const expected = JSON.parse(JSON.stringify(prior.states[i])), actual = JSON.parse(JSON.stringify(states[i]));
            if (name.startsWith('decal-')) {
                const labels = text => text.replace('TOTAL FINISHED SQ FT RATE TIER MINIMUM', 'Total finished sq ft Rate Tier minimum').replace('SIZE SQ FT EACH', 'Size Sq ft each');
                if (expected.ids.decalRateGrid) expected.ids.decalRateGrid = labels(expected.ids.decalRateGrid);
                expected.tables = expected.tables.map(labels);
            } else {
                // The previous page exposed its closed drawer, idle toast and disabled actions.
                // Keep the original text contract, but explicitly repair those visibility defects.
                const open = ['emblem-assistant', 'emblem-quote', 'emblem-chat-failed', 'emblem-save-retry'].includes(name);
                expected.ids.emblemHeroArt = '';
                if (!open) {
                    for (const key of Object.keys(expected.ids)) if (key.startsWith('ai') && key !== 'aiOpenBtn') delete expected.ids[key];
                    expected.fields = [];
                } else {
                    expected.ids.aiChatTip = prior.states[0].ids.aiChatTip;
                    expected.ids.aiChatMessages = expected.ids.aiChatMessages.replace('LIVE EMBLEM QUOTE', 'Live emblem quote').replace('EMAIL DRAFT', 'Email draft');
                    if (['emblem-assistant', 'emblem-chat-failed'].includes(name)) for (const key of ['aiOutlookBtn', 'aiCopyEmailBtn', 'aiSaveQuoteBtn']) delete expected.ids[key];
                }
                await expect(page.locator('#shareToastText')).toHaveText(prior.states[i].ids.shareToastText);
                delete expected.ids.shareToastText; delete actual.ids.shareToastText;
                if (name === 'emblem-reference') {
                    expected.tables = prior.states[0].tables.map(text => text.replace('SIZE (AVG)', 'Size (avg)'));
                    expected.ids.emblemGridWrap = prior.states[0].ids.emblemGridWrap.replace('SIZE (AVG)', 'Size (avg)');
                }
            }
            for (const key of ['title', 'url', 'ids', 'fields', 'links', 'tables', 'headings']) expect(actual[key], name + ' width=' + states[i].width + ' ' + key).toEqual(expected[key]);
        }
        expect(record.dialogs).toEqual(prior.dialogs); expect(record.mocked).toEqual(prior.mocked);
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await page.emulateMedia({media: 'print'});
    await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await page.pdf({path: path.join(out, 'specialty-calculators-' + name + '-' + phase + '.pdf'), format: 'Letter', printBackground: true});
}
async function ready(page, kind, state = {}) {
    await page.setViewportSize({width: 1440, height: 1000});
    const events = await open(page, {...state, original: capture, url: kind === 'decal' ? '/calculators/custom-decal-pricing.html' : '/calculators/embroidered-emblem/index.html'});
    if (state.failed) await expect(page.locator('#pricingError')).toBeVisible();
    else await expect(page.locator(kind === 'decal' ? '#decalRateGrid tbody tr' : '#emblemGridWrap tbody tr')).toHaveCount(kind === 'decal' ? 3 : 16);
    if (kind === 'emblem') { await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden', 'false'); await page.keyboard.press('Escape'); }
    return events;
}
async function row(page, index, width, height, quantity) {
    const item = page.locator('.decal-row').nth(index);
    for (const [selector, value] of [['.decal-w', width], ['.decal-h', height], ['.decal-q', quantity]]) await item.locator(selector).fill(String(value));
}
for (const mode of ['empty', 'mixed', 'waived', 'oversize', 'invalid', 'failed']) test('CSS specialty decals: ' + mode, async ({page}) => {
    const events = await ready(page, 'decal', {failed: mode === 'failed'});
    if (['mixed', 'waived'].includes(mode)) { await row(page, 0, 12, 24, 10); await page.locator('#decalAddRow').click(); await row(page, 1, 12, 12, 14); }
    if (mode === 'waived') { await page.locator('#decalArtOnFile').check(); await page.locator('#decalTaxRate').fill('0'); }
    if (mode === 'oversize') await row(page, 0, 54, 54, 2);
    if (mode === 'invalid') { await row(page, 0, 0, 12, 10); await expect(page.locator('#decalCalcError')).toBeVisible(); }
    await evidence(page, 'decal-' + mode, events);
});
test('CSS specialty decals: tier boundaries and removing rows preserve amounts', async ({page}) => {
    const events = await ready(page, 'decal'), records = [];
    for (const quantity of [1, 5, 10, 11, 15, 50, 51, 67]) { await row(page, 0, 12, 12, quantity); records.push({quantity, output: await page.locator('#decalOutput').innerText()}); }
    await page.locator('#decalAddRow').click(); await row(page, 1, 12, 12, 3); await page.locator('.decal-row-remove').last().click();
    expect(await page.locator('#decalOutput').innerText()).toEqual(records.at(-1).output);
    await page.locator('.decal-row-remove').click(); await expect(page.locator('.decal-row')).toHaveCount(1);
    fixture('decal-tiers', {records}); check(expect, events);
});
for (const mode of ['normal', 'reference', 'failed', 'assistant', 'quote', 'chat-failed', 'save-retry']) test('CSS specialty emblems: ' + mode, async ({page}) => {
    const events = await ready(page, 'emblem', {failed: mode === 'failed', chat: true, chatFailed: mode === 'chat-failed', save: mode === 'save-retry', partialFailure: mode === 'save-retry'});
    if (mode === 'reference') await page.locator('details').evaluateAll((nodes) => nodes.forEach((node) => { node.open = true; }));
    if (['assistant', 'quote', 'chat-failed', 'save-retry'].includes(mode)) {
        await page.locator('#floatingQuoteBtn').click();
        if (mode !== 'assistant') {
            await page.locator('#aiChatTextarea').fill('Synthetic example: 100 three-inch sewn-on patches, new art.'); await page.locator('#aiChatSend').click();
            await expect(page.locator('#aiChatMessages')).toContainText(mode === 'chat-failed' ? "couldn't reach the AI" : 'Synthetic emblem quote ready.');
            await expect(page.locator('#aiChatSend')).toBeEnabled();
        }
        if (mode === 'save-retry') {
            await page.locator('#aiSaveQuoteBtn').click(); await expect(page.locator('#aiSaveQuoteBtn')).toBeEnabled();
            await expect(page.locator('#aiSaveQuoteBtn')).toContainText('Save');
            await page.locator('#aiSaveQuoteBtn').click(); await expect(page.locator('#aiSaveQuoteBtn')).toContainText('Copy share link');
            expect(events.mocked.filter((entry) => entry.path === '/api/quote_sessions')).toHaveLength(1);
            expect(events.mocked.filter((entry) => entry.path === '/api/quote_items')).toHaveLength(3);
            await page.locator('#aiCopyEmailBtn').click(); await page.locator('#aiSaveQuoteBtn').click();
            expect(await page.evaluate(() => window.__copied)).toEqual(['Subject: Example emblem quote\n\n100 sewn-on emblems and digitizing total $889.00 before tax.', 'http://localhost:3410/quote/PATCH-2026-901']);
        }
    }
    await evidence(page, 'emblem-' + mode, events);
});
