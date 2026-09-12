const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const original = require('../../fixtures/specialty-calculators-original-content.json');
const qtyTiers = [25, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000];
const emblem = {
    qtyTiers,
    grid: Object.fromEntries([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 12].map((size) => [
        size.toFixed(2), qtyTiers.map((_, i) => Math.round((3.75 + size * 1.4 - i * 0.28) * 100) / 100)
    ]))
};
const decal = {minMaterial: 90, safeRollWidthIn: 52, setupFee: {amount: 50, code: 'GRT-50'}, tiers: [
    {MaxSqFt: 10, RatePerSqFt: 18, floor: 0},
    {MaxSqFt: 50, RatePerSqFt: 12, floor: 180},
    {MaxSqFt: 999999, RatePerSqFt: 9, floor: 600}
]};
const quote = {
    lineItems: [{partNumber: 'EMB-3.00-100', description: 'Synthetic 3 inch sewn-on emblem', size: '3.00',
        shape: 'square', quantity: 100, basePrice: 7.39, pricePerPatch: 7.89, totalPrice: 789,
        ltm: {applies: true, perPatchAmount: 0.5, threshold: 200}, modifiers: {metallicThread: false, velcroBacking: false, extraColors: 0}}],
    digitizingFee: {include: true, amount: 100, partNumber: 'DIG-100'},
    appliedRules: {sizeTier: '3 inch size tier', quantityTier: '100 piece tier', rush: 'Standard production'}
};
const customer = {name: 'Example Customer', email: 'example@example.invalid', company: 'Example Company', phone: '555-0100', taxable: true};
const reply = 'Synthetic emblem quote ready.\nPRICE_QUOTE START\n' + JSON.stringify(quote) + '\nPRICE_QUOTE END\nCUSTOMER_FINAL START\n' + JSON.stringify(customer) + '\nCUSTOMER_FINAL END\nEMAIL DRAFT START\nTo: example@example.invalid\nSubject: Example emblem quote\n\n100 sewn-on emblems and digitizing total $889.00 before tax.\nEMAIL DRAFT END';

function source(file) {
    let text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter((item) => item.file === file).reverse()) {
        if (text.split(change.after).length - 1 !== change.count) throw Error('Original mapping drift: ' + file);
        text = text.split(change.after).join(change.before);
    }
    return text;
}

async function open(page, state = {}) {
    const events = {errors: [], unknown: [], writes: [], mocked: [], missing: [], dialogs: []};
    let failedLineOnce = false;
    await page.clock.setFixedTime(new Date('2026-09-11T18:30:00.000Z'));
    await page.context().addInitScript(() => {
        window.__prints = [];
        window.print = () => window.__prints.push(document.title);
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', {value: {writeText: async (text) => { window.__copied.push(text); }}});
    });
    page.on('pageerror', (error) => events.errors.push(error.message));
    page.on('dialog', async (dialog) => { events.dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.context().route('**/*', async (route) => {
        const req = route.request(), url = new URL(req.url()), filePath = url.pathname, method = req.method();
        if (state.route) { const mock = await state.route(route); if (mock) return route.fulfill(mock); }
        if (state.chat && filePath === '/api/quote-sequence/PATCH' && method === 'GET') {
            events.mocked.push({path: filePath, method});
            return route.fulfill({json: {prefix: 'PATCH', year: 2026, sequence: 901}});
        }
        if (state.chat && filePath === '/api/contract-emblem-ai/chat' && method === 'POST') {
            events.mocked.push({path: filePath, method, body: req.postDataJSON()});
            return route.fulfill(state.chatFailed ? {status: 503} : {
                contentType: 'text/event-stream', body: 'event: delta\ndata: ' + JSON.stringify({text: reply}) + '\n\nevent: done\ndata: {}\n\n'
            });
        }
        if (state.save && ['/api/quote_sessions', '/api/quote_items'].includes(filePath) && method === 'POST') {
            const body = req.postDataJSON();
            events.mocked.push({path: filePath, method, body});
            if (state.partialFailure && filePath === '/api/quote_items' && body.LineNumber === 2 && !failedLineOnce) {
                failedLineOnce = true;
                return route.fulfill({status: 503, body: 'Synthetic retryable line failure'});
            }
            return route.fulfill({json: {success: true}});
        }
        if (!['GET', 'HEAD'].includes(method) || /quote-sequence|logout/.test(filePath)) {
            events.writes.push({path: filePath, method});
            return route.fulfill({status: 503});
        }
        if (state.richardson && ['/api/decorated-cap-prices','/api/pricing-bundle','/api/service-codes'].includes(filePath)) {
            events.mocked.push({path: filePath + url.search, method});
            if (state.failed || state.failedRead === (url.searchParams.get('method') || filePath)) return route.fulfill({status: 503});
            if (state.incompleteRead === (url.searchParams.get('method') || filePath)) return route.fulfill({json: {}});
            const tierLabels = ['1-7','8-23','24-47','48-71','72+'];
            if (filePath === '/api/decorated-cap-prices') return route.fulfill({json: {prices: {'112': 24, '115': 24}}});
            if (filePath === '/api/service-codes') return route.fulfill({json: {data: [{ServiceCode: 'GRT-50', SellPrice: state.alternate ? 65 : 50}]}});
            const methodName = url.searchParams.get('method');
            if (methodName === 'CAP') return route.fulfill({json: {allEmbroideryCostsR: tierLabels.map((TierLabel,i) => ({StitchCount: 8000, TierLabel, EmbroideryCost: [17,17,13,11,9.5][i] + (state.alternate ? 1 : 0)})), tiersR: [{MarginDenominator: state.alternate ? 0.57 : 0.53}]}});
            if (methodName === 'PATCH') return route.fulfill({json: {allPatchCostsR: [{ItemType: 'Patch', EmbroideryCost: state.alternate ? 6.25 : 5}]}});
            if (methodName === 'CAP-PUFF') return route.fulfill({json: {allEmbroideryCostsR: [{ItemType: '3D-Puff', EmbroideryCost: state.alternate ? 7 : 5}]}});
            events.unknown.push(req.url()); return route.fulfill({status: 503});
        }
        if (filePath === '/api/custom-decal-pricing') return route.fulfill({status: state.failed ? 503 : 200, json: decal});
        if (filePath === '/api/emblem-pricing') return route.fulfill({status: state.failed ? 503 : 200, json: emblem});
        if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
        // Axe re-reads the existing Font Awesome stylesheet through fetch.
        if (url.hostname === 'cdnjs.cloudflare.com' && filePath === '/ajax/libs/font-awesome/6.4.0/css/all.min.css') return route.continue();
        if (filePath.startsWith('/api/') || ['fetch', 'xhr'].includes(req.resourceType())) {
            events.unknown.push(req.url());
            return route.fulfill({status: 503});
        }
        if (['localhost', '127.0.0.1'].includes(url.hostname)) {
            const file = decodeURIComponent(filePath.slice(1)), absolute = path.resolve(root, file);
            if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
                events.missing.push(filePath);
                return route.fulfill({status: 404});
            }
            return route.fulfill({contentType: {'.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2'}[path.extname(absolute)] || 'application/octet-stream',
            body: state.original && original.hashes[file] ? Buffer.from(source(file)) : fs.readFileSync(absolute)});
        }
        if (['image', 'font', 'stylesheet'].includes(req.resourceType())) return route.continue();
        events.unknown.push(req.url());
        return route.fulfill({status: 503});
    });
    await page.goto(state.url);
    await page.evaluate(() => document.fonts.ready);
    return events;
}

async function snapshot(page) {
    return page.evaluate(() => {
        const visible = (node) => !!node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
        const norm = (text) => text.replace(/\s+/g, ' ').trim(), ids = {};
        for (const node of document.querySelectorAll('[id]')) {
            if (visible(node) && !node.querySelector('[id]') && !['SCRIPT', 'STYLE'].includes(node.tagName)) ids[node.id] = norm(node.innerText || node.textContent);
        }
        return {title: document.title, url: location.pathname + location.search, ids,
            fields: [...document.querySelectorAll('input,select,textarea')].filter(visible).map((node) => ({id: node.id, type: node.type, value: node.value, checked: node.checked, disabled: node.disabled})),
            links: [...document.querySelectorAll('a[href]')].filter(visible).map((node) => ({href: node.getAttribute('href'), text: norm(node.textContent)})),
            tables: [...document.querySelectorAll('table')].filter(visible).map((node) => norm(node.innerText)),
            headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((node) => norm(node.textContent)),
            overflow: document.documentElement.scrollWidth > innerWidth + 1};
    });
}
function check(expect, events) {
    for (const key of ['errors', 'unknown', 'writes', 'missing']) expect(events[key], key).toEqual([]);
}
module.exports = {open, snapshot, source, check};
