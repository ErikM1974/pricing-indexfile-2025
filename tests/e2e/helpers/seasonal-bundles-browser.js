const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const bcaPath = 'calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html';
const servicePath = 'calculators/archive/seasonal-2025/breast-cancer-bundle-service.js';
async function openBca(page, state = {}) {
    const events = {errors: [], missing: [], unknown: [], writes: [], dialogs: []};
    await page.clock.setFixedTime(new Date('2026-09-11T18:30:00.000Z'));
    await page.context().addInitScript(({failEmail, failCustomer, failSales, missingEmail}) => {
        window.__emails = []; window.__prints = [];
        window.__failCustomer = failEmail || failCustomer; window.__failSales = failEmail || failSales;
        window.print = () => window.__prints.push(document.title);
        Math.random = () => 0.1;
        window.emailjs = {init() {}, send: async (service, template, data) => {
            window.__emails.push({service, template, data});
            if (window.__failCustomer && template === 'template_2rlgjio' || window.__failSales && template === 'template_af6h6kh') throw new Error('Synthetic email failure');
            return {status: 200};
        }};
        if (missingEmail) delete window.emailjs;
    }, {failEmail: Boolean(state.failEmail), failCustomer: Boolean(state.failCustomer), failSales: Boolean(state.failSales), missingEmail: Boolean(state.missingEmail)});
    page.on('pageerror', e => events.errors.push(e.message));
    page.on('dialog', async d => {events.dialogs.push(d.message()); await d.dismiss();});
    await page.context().route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), pathname = url.pathname;
        if (/\/api\/quote_(sessions|items)$/.test(pathname) && req.method() === 'POST') {
            events.writes.push({path: pathname, body: req.postDataJSON()});
            if (state.hold) await state.hold;
            const failed = state.failSession && pathname.endsWith('sessions') || state.failItem && pathname.endsWith('items');
            return route.fulfill({status: failed ? 503 : 201, json: failed ? {error: 'Synthetic failure'} : {success: true}});
        }
        if (pathname === '/api/files/upload' && req.method() === 'POST') {
            events.writes.push({path: pathname, file: 'synthetic-logo'});
            return route.fulfill({status: state.failUpload ? 503 : 201, json: {externalKey: 'SYNTHETIC-LOGO'}});
        }
        if (!['GET', 'HEAD'].includes(req.method()) || pathname.startsWith('/api/')) {
            events.unknown.push(req.method() + ' ' + pathname); return route.fulfill({status: 503});
        }
        if (url.hostname === 'cdn.jsdelivr.net' && pathname.endsWith('/email.min.js')) return route.fulfill({contentType: 'application/javascript', body: '/* Email provider mocked before the page loads. */'});
        if (url.hostname === 'cdn.tailwindcss.com' || ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(url.hostname)) return route.continue();
        if (['localhost', '127.0.0.1'].includes(url.hostname)) {
            if (state.missingService && pathname.endsWith('/breast-cancer-bundle-service.js')) return route.fulfill({contentType: 'application/javascript', body: '/* Unavailable order service. */'});
            // Current checks exercise Express's real mounts, including archive tombstones.
            // Only immutable original captures use the filesystem/diagnostic override.
            if (process.env.CAPTURE_SEASONAL_ORIGINAL !== '1') return route.continue();
            let file = pathname === '/breast-cancer-awareness-bundle.html' ? bcaPath : decodeURIComponent(pathname.slice(1));
            if (state.diagnosticService && pathname === '/calculators/breast-cancer-bundle-service.js') file = servicePath;
            const absolute = path.resolve(root, file);
            if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
                events.missing.push(pathname); return route.fulfill({status: 404});
            }
            return route.fulfill({contentType: {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png'}[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(absolute)});
        }
        if (['image', 'font', 'stylesheet'].includes(req.resourceType())) return route.continue();
        events.unknown.push(req.url()); return route.fulfill({status: 503});
    });
    await page.goto('/breast-cancer-awareness-bundle.html');
    await page.evaluate(() => document.fonts.ready);
    return events;
}
async function contact(page, pickup = false) {
    await page.locator('#nextBtn').click();
    await page.locator('#size-M').fill('3');
    await page.locator('#size-L').fill('5');
    await page.locator('#size-L').dispatchEvent('input');
    await page.locator('#nextBtn').click();
    for (const [id, value] of Object.entries({customerName: 'Example Customer', companyName: 'Example Company', email: 'example@example.invalid', phone: '2535550100', shippingAddress: '123 Example Street', shippingCity: 'Example City', shippingState: 'WA', shippingZip: '98000', eventDate: '2026-10-10', notes: 'Synthetic review only. No real order.'})) await page.locator('#' + id).fill(value);
    if (pickup) await page.locator('input[name="deliveryMethod"][value="Pickup"]').check();
    await page.locator('input[name="designChoice"][value="Flag"]').check({force: true});
}
module.exports = {root, bcaPath, servicePath, openBca, contact};
