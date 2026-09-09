const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const fixture = require('../fixtures/asset-library-review-data.json');
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], reads: [], unmocked: [] };
    page.on('pageerror', e => events.errors.push(e.message)); await page.clock.setFixedTime(new Date(fixture.fixed));
    await page.addInitScript(() => {
        window.__cameraRequests = 0;
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__cameraRequests++; return Promise.reject(new Error('Camera denied in isolated review')); };
    });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push({ path: u.pathname, method: req.method(), body: req.postData(), bytes: req.postDataBuffer() });
            if (u.pathname === '/api/finished-photos' || /^\/api\/staff\/finished-photos\/\d+$/.test(u.pathname)) return route.fulfill({ status: state.writeStatus || 200, json: state.writeReply ?? { success: true, photo: { ...fixture.manage.photos[0], showToCustomer: false } } });
            events.unmocked.push(u.pathname); return route.fulfill({ status: 503 });
        }
        let key;
        if (u.pathname === '/api/staff/finished-photos/library') key = 'library';
        else if (u.pathname === '/api/staff/finished-photos/lookup') key = 'lookup';
        else if (u.pathname === '/api/company-contacts/search') key = 'contacts';
        else if (u.pathname.startsWith('/api/designs/by-customer/')) key = 'designs';
        else if (u.pathname === '/api/staff/finished-photos') key = 'manage';
        if (key) {
            events.reads.push(u.pathname + u.search); const special = state.respond && state.respond(key, u);
            if (special?.delay) await new Promise(resolve => setTimeout(resolve, special.delay));
            return route.fulfill({ status: special?.status || state[key + 'Status'] || 200, json: special?.json ?? state[key] ?? fixture[key] });
        }
        if (u.pathname.startsWith('/photo-review/')) {
            const response = state.imageRespond ? state.imageRespond(u) : {};
            if (response.delay) await new Promise(resolve => setTimeout(resolve, response.delay));
            return route.fulfill({ status: response.status || 200, contentType: 'image/svg+xml', body: response.status >= 400 ? 'Image unavailable' : '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>' });
        }
        if (u.pathname.startsWith('/api/')) { events.unmocked.push(u.pathname); return route.fulfill({ status: 503 }); }
        if (u.pathname.includes('/vendor/html5-qrcode.min.js')) return route.fulfill({ contentType: 'application/javascript', body: 'window.Html5QrcodeSupportedFormats={CODE_128:1,CODE_39:2,EAN_13:3,QR_CODE:4};window.Html5Qrcode=function(){this.start=function(){return Promise.reject(new Error("Camera denied in isolated review"));};this.stop=function(){window.__scannerStopped=true;return Promise.resolve();};this.clear=function(){};};' });
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + u.pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        }
        return route.fallback();
    });
    await page.goto('/dashboards/' + name + '.html'); await page.evaluate(() => document.fonts.ready); return events;
}
async function clean(page, events, writes = 0) { expect(events.errors).toEqual([]); expect(events.unmocked).toEqual([]); expect(events.writes).toHaveLength(writes); expect(await page.evaluate(() => window.__cameraRequests)).toBe(0); }
async function axe(page) { expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]); }
async function customer(page, design = true) {
    await page.locator('#fp-mode-order').click(); await page.locator('#fp-order-input').fill('142476'); await page.locator('#fp-order-find').click(); await expect(page.locator('.fp-mrow')).toHaveCount(2);
    if (design) await page.locator('.fp-design').first().click();
}
for (const name of ['finished-photos', 'finished-photos-library']) test('CSS photos: ' + name + ' at four widths, keyboard and print', async ({ page }) => {
    test.setTimeout(180000); const events = await open(page, name);
    if (name === 'finished-photos') await customer(page); else await expect(page.locator('.fpl-card')).toHaveCount(5);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page);
        await page.screenshot({ path: path.join(output, 'photos-' + name + '-' + width + '.png'), fullPage: true });
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#photo-main')).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 950 }); await page.emulateMedia({ media: 'print' });
    const blocks = await page.locator('h1,h2,h3,main p,.fpl-card-body,.fpl-account-meta,.fp-mrow-body,.fp-chosen-body,.dash-stat-card').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
    fs.writeFileSync(path.join(output, 'photos-' + name + '-print.json'), JSON.stringify({ blocks }));
    await page.pdf({ path: path.join(output, 'photos-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true }); await clean(page, events);
});
test('CSS photos: library filters, deep links, escaped content and empty results', async ({ page }) => {
    const events = await open(page, 'finished-photos-library'); await expect(page.locator('#fpl-stat-total')).toHaveText('5'); await expect(page.locator('#fpl-stat-live')).toHaveText('2'); await expect(page.locator('#fpl-body script')).toHaveCount(0);
    await page.locator('.fpl-chip[data-rep="Taneisha Clark"]').click(); await expect(page.locator('.fpl-card')).toHaveCount(2); await expect(page).toHaveURL(/#rep=Taneisha%20Clark$/);
    await page.locator('#fpl-visibility').selectOption('live'); await expect(page.locator('.fpl-card')).toHaveCount(1); await page.locator('#fpl-search').fill('not present'); await expect(page.locator('#fpl-body')).toContainText('No photos match');
    await page.reload(); await expect(page.locator('.fpl-card')).toHaveCount(2); await clean(page, events);
});
for (const [label, status, library] of [['session', 401, {}], ['malformed', 200, {}], ['partial photo', 200, { ...fixture.library, photos: [{}] }]]) test('CSS photos: library ' + label + ' stays unknown through filtering and recovers', async ({ page }) => {
    const state = {}, events = await open(page, 'finished-photos-library', state); await expect(page.locator('#fpl-stat-total')).toHaveText('5'); state.libraryStatus = status; state.library = library;
    await page.locator('#fpl-refresh').click(); await expect(page.locator('#fpl-body')).toContainText('could not load'); await expect(page.locator('#fpl-stat-total')).toHaveText('—'); await page.locator('#fpl-search').fill('crew'); await page.locator('#fpl-visibility').selectOption('hidden'); await expect(page.locator('#fpl-body')).toContainText('could not load'); await expect(page.locator('.fpl-card')).toHaveCount(0); await axe(page);
    state.libraryStatus = 200; state.library = fixture.library; await page.locator('#fpl-retry').click(); await expect(page.locator('#fpl-stat-total')).toHaveText('5'); await clean(page, events);
});
test('CSS photos: actual empty library has zero counts', async ({ page }) => {
    const events = await open(page, 'finished-photos-library', { library: { ...fixture.library, photos: [], reps: [], truncated: 0 } }); await expect(page.locator('#fpl-stat-total')).toHaveText('0'); await expect(page.locator('#fpl-body')).toContainText('No finished photos yet'); await clean(page, events);
});
test('CSS photos: most recent refresh owns library counts', async ({ page }) => {
    let n = 0; const events = await open(page, 'finished-photos-library', { respond: key => key === 'library' ? (++n === 1 ? { delay: 900, json: fixture.library } : { json: { ...fixture.library, photos: [], reps: [], truncated: 0 } }) : undefined });
    await expect.poll(() => n).toBe(1); await page.locator('#fpl-refresh').click(); await expect(page.locator('#fpl-stat-total')).toHaveText('0'); await page.waitForTimeout(1000); await expect(page.locator('#fpl-stat-total')).toHaveText('0'); await clean(page, events);
});
for (const name of ['finished-photos-library', 'finished-photos']) test('CSS photos: ' + name + ' rejected publication stays visible and can retry', async ({ page }) => {
    const state = { writeReply: {} }, events = await open(page, name, state);
    if (name === 'finished-photos') await customer(page, false);
    const button = page.locator(name === 'finished-photos' ? '.fp-toggle' : '.fpl-pub-btn').first(); await button.click();
    const status = page.locator(name === 'finished-photos' ? '#photo-manage-status' : '.dash-error-banner'); await expect(status).toBeVisible(); await expect(status).toContainText('NOT'); await expect(button).toBeEnabled(); expect(JSON.parse(events.writes[0].body)).toHaveProperty('show');
    state.writeReply = { success: true }; await button.click(); if (name === 'finished-photos') await expect(status).toContainText('portal'); else await expect(page.locator('#fpl-stat-live')).not.toHaveText('2'); await clean(page, events, 2);
});
for (const name of ['finished-photos-library', 'finished-photos']) test('CSS photos: ' + name + ' preview traps focus and restores the trigger', async ({ page }) => {
    const events = await open(page, name); if (name === 'finished-photos') await customer(page);
    const trigger = page.locator(name === 'finished-photos' ? '.fp-mrow-thumb' : '.fpl-card-imgbtn').first(), close = page.locator(name === 'finished-photos' ? '#fp-lightbox-close' : '#fpl-lightbox-close'); await trigger.click(); await expect(close).toBeFocused();
    await page.keyboard.press('Tab'); await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused(); await page.setViewportSize({ width: 320, height: 800 }); await axe(page);
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); expect(await page.locator('body').evaluate(n => n.style.overflow)).toBe(''); await clean(page, events);
});
test('CSS photos: keyboard tabs and denied scanner retain a usable order lookup', async ({ page }) => {
    const events = await open(page, 'finished-photos'); await page.locator('#fp-mode-scan').click(); await page.locator('#fp-scan-open').click(); await expect(page.locator('#fp-scan-status')).toContainText('Camera'); await expect(page.locator('#fp-scan-close')).toBeFocused(); await axe(page);
    await page.keyboard.press('Escape'); await expect(page.locator('#fp-scan-open')).toBeFocused(); await page.locator('#fp-mode-scan').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#fp-mode-order')).toBeFocused(); await expect(page.locator('#fp-mode-order')).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('#fp-mode-scan')).toHaveAttribute('tabindex', '-1'); await clean(page, events);
});
for (const key of ['designs', 'manage']) test('CSS photos: incomplete ' + key + ' read offers a working retry', async ({ page }) => {
    const state = { [key]: {} }, events = await open(page, 'finished-photos', state); await page.locator('#fp-mode-order').click(); await page.locator('#fp-order-input').fill('142476'); await page.locator('#fp-order-find').click(); const retry = page.locator(key === 'designs' ? '#fp-designs-retry' : '#fp-manage-retry'); await expect(retry).toBeVisible(); state[key] = fixture[key]; await retry.click(); await expect(page.locator(key === 'designs' ? '.fp-design' : '.fp-mrow')).toHaveCount(key === 'designs' ? fixture.designs.designs.length : 2); await clean(page, events);
});
test('CSS photos: customer search and lookup distinguish invalid replies from no matches', async ({ page }) => {
    const state = { contacts: {}, lookup: {} }, events = await open(page, 'finished-photos', state); await page.locator('#fp-mode-search').click(); await page.locator('#fp-cust-search').fill('Example'); await expect(page.locator('#fp-cust-results')).toContainText('Search failed');
    state.contacts = fixture.contacts; await page.locator('#fp-cust-search').fill('Example O'); await expect(page.locator('.fp-result[data-id]')).toHaveCount(1); await page.locator('#fp-mode-order').click(); await page.locator('#fp-order-input').fill('142476'); await page.locator('#fp-order-find').click(); await expect(page.locator('#fp-find-status')).toContainText('Lookup failed'); state.lookup = { success: true, match: null }; await page.locator('#fp-order-find').click(); await expect(page.locator('#fp-find-status')).toContainText('No order or design matches'); await clean(page, events);
});
test('CSS photos: synthetic image compression and upload preserve account, design and hidden status', async ({ page }) => {
    const state = { writeStatus: 503 }, events = await open(page, 'finished-photos', state); await customer(page);
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 3200; c.height = 1600; c.getContext('2d').fillRect(0, 0, c.width, c.height); return c.toDataURL('image/png').split(',')[1]; });
    await page.locator('#fp-file-album').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await expect(page.locator('#fp-upload-btn')).toBeEnabled(); await page.locator('#fp-caption').fill('Synthetic left chest'); await page.locator('#fp-upload-btn').click(); await expect(page.locator('#fp-status')).toContainText('Upload failed'); await expect(page.locator('#fp-upload-btn')).toBeEnabled();
    const body = events.writes[0].body; expect(body).toContain('name="idCustomer"\r\n\r\n4581'); expect(body).toContain('name="designNumber"\r\n\r\n40121'); expect(body).toContain('name="idOrder"\r\n\r\n142476'); expect(body).toContain('Synthetic left chest'); expect(body).toContain('image/jpeg'); expect(body).not.toContain('name="showToCustomer"');
    const size = await page.locator('#fp-preview').evaluate(img => ({ w: img.naturalWidth, h: img.naturalHeight })); expect(size).toEqual({ w: 2000, h: 1000 }); state.writeStatus = 200; await page.locator('#fp-upload-btn').click(); await expect(page.locator('#fp-status')).toContainText('hidden'); await clean(page, events, 2);
});
test('CSS photos: synthetic delete cancellation and server failure retain the photo', async ({ page }) => {
    const events = await open(page, 'finished-photos', { writeStatus: 503 }); await customer(page, false); page.once('dialog', d => d.dismiss()); await page.locator('.fp-del').first().click(); expect(events.writes).toHaveLength(0); page.once('dialog', d => d.accept()); await page.locator('.fp-del').first().click(); await expect(page.locator('#photo-manage-status')).toContainText('NOT deleted'); await expect(page.locator('.fp-mrow')).toHaveCount(2); await clean(page, events, 1);
});
test('CSS photos: an older full-size image cannot replace a newer preview', async ({ page }) => {
    const photos = fixture.library.photos.slice(0, 2).map((p, i) => ({ ...p, imageUrl: '/photo-review/' + i + '.svg' }));
    const events = await open(page, 'finished-photos-library', { library: { ...fixture.library, photos }, imageRespond: u => ({ delay: u.pathname.endsWith('/0.svg') && u.search ? 900 : 0 }) });
    await page.locator('.fpl-card-imgbtn').first().click(); await page.keyboard.press('Escape'); await page.locator('.fpl-card-imgbtn').nth(1).click(); await expect(page.locator('#fpl-lightbox-img')).toHaveAttribute('src', /1\.svg/); await page.waitForTimeout(1100); await expect(page.locator('#fpl-lightbox-img')).toHaveAttribute('src', /1\.svg/); await clean(page, events);
});
test('CSS photos: failed thumbnail and original show an explicit preview error', async ({ page }) => {
    const photos = [{ ...fixture.library.photos[0], imageUrl: '/photo-review/missing.svg' }];
    const events = await open(page, 'finished-photos-library', { library: { ...fixture.library, photos }, imageRespond: u => ({ status: 503, delay: u.search ? 0 : 250 }) });
    await page.locator('.fpl-card-imgbtn').first().click(); await expect(page.locator('#fpl-lightbox-status')).toContainText('could not be loaded'); await expect(page.locator('#fpl-lightbox-img')).toBeHidden(); await clean(page, events);
});
test('CSS photos: newest lookup remains selected after an older response arrives', async ({ page }) => {
    const events = await open(page, 'finished-photos', { respond: (key, u) => key === 'lookup' ? { delay: u.searchParams.get('code') === 'OLD' ? 900 : 0, json: { success: true, match: { ...fixture.lookup.match, companyName: u.searchParams.get('code') } } } : undefined });
    await page.locator('#fp-mode-order').click(); await page.locator('#fp-order-input').fill('OLD'); await page.locator('#fp-order-find').click(); await page.locator('#fp-order-input').fill('NEW'); await page.locator('#fp-order-find').click(); await expect(page.locator('#fp-cust-name')).toHaveText('NEW'); await page.waitForTimeout(1100); await expect(page.locator('#fp-cust-name')).toHaveText('NEW'); await clean(page, events);
});
test('CSS photos: old customer designs cannot replace the newly selected customer', async ({ page }) => {
    let calls = 0;
    const events = await open(page, 'finished-photos', { respond: (key, u) => {
        if (key === 'lookup') return { json: { success: true, match: { ...fixture.lookup.match, idCustomer: ++calls === 1 ? '4581' : '3120' } } };
        if (key === 'designs') return { delay: u.pathname.includes('/4581') ? 1000 : 0, json: { designs: [{ ...fixture.designs.designs[0], idDesign: u.pathname.includes('/4581') ? 'OLD' : 'NEW' }] } };
    } });
    await customer(page, false); await page.locator('#fp-cust-change').click(); await page.locator('#fp-order-find').click(); await expect(page.locator('.fp-design')).toHaveAttribute('data-num', 'NEW'); await page.waitForTimeout(1200); await expect(page.locator('.fp-design')).toHaveAttribute('data-num', 'NEW'); await clean(page, events);
});
