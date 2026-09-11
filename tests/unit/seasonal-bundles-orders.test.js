const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const file = 'calculators/archive/seasonal-2025/breast-cancer-bundle-service.js';
const current = fs.readFileSync(path.join(root, 'calculators/breast-cancer-bundle-service.js'), 'utf8');
const original = fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const seed = {customerName: 'Example Customer', companyName: 'Example Company', email: 'example@example.invalid', phone: '2535550100', address: '123 Example Street', city: 'Example City', state: 'WA', zip: '98000', eventDate: '2026-10-10', notes: 'Synthetic only.', imageUpload: null, totalAmount: 360, bundleCount: 8, totalCaps: 8, totalShirts: 8, sizeDistribution: {M: 3, L: 5}, deliveryMethod: 'Ship', designChoice: 'No Flag'};
function harness(source = current, state = {}) {
    const writes = [], emails = [];
    class Clock extends Date {constructor(...args) {super(...(args.length ? args : ['2026-09-11T18:30:00.000Z']));} static now() {return new Date('2026-09-11T18:30:00.000Z').valueOf();}}
    const math = Object.create(Math); let sequence = 0; math.random = () => 0.1 + sequence++ / 10000;
    const context = {Date: Clock, Math: math, Intl, console: {log() {}, error() {}}, window: {APP_CONFIG: {API: {BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'}}},
        fetch: async (url, options) => {
            const body = JSON.parse(options.body); writes.push({url, body});
            if (state.hold) await state.hold;
            return {ok: !(state.failSession && url.endsWith('/quote_sessions') || state.failLine && state.failLine === body.LineNumber), json: async () => ({success: true})};
        },
        emailjs: {send: async (service, template, data) => {
            emails.push(clone({service, template, data}));
            if (state.failCustomer && template === 'template_2rlgjio' || state.failSales && template === 'template_af6h6kh') throw Error('Synthetic failure');
            return {status: 200};
        }}};
    vm.runInNewContext(source, context);
    return {service: new context.window.BreastCancerBundleService(), writes, emails};
}
describe('awareness bundle preserves actual original order payloads', () => {
    for (const quantity of [8, 9, 24, 50]) for (const deliveryMethod of ['Ship', 'Pickup']) for (const designChoice of ['No Flag', 'Flag']) {
        test(quantity + ' bundles / ' + deliveryMethod + ' / ' + designChoice, async () => {
            const data = {...clone(seed), bundleCount: quantity, totalCaps: quantity, totalShirts: quantity, totalAmount: quantity * 45, deliveryMethod, designChoice, imageUpload: quantity % 2 ? 'SYNTHETIC-LOGO' : null,
                sizeDistribution: {S: 1, M: 1, L: 1, XL: 1, '2XL': 1, '3XL': 1, '4XL': quantity - 6}};
            const old = harness(original), next = harness();
            const a = await old.service.processOrder(data), b = await next.service.processOrder(data);
            expect(a.success).toBe(true); expect(b.success).toBe(true); expect(b.quoteId).toBe(a.quoteId);
            expect(next.writes).toEqual(old.writes); expect(next.emails).toEqual(old.emails);
            expect(next.writes).toHaveLength(quantity + 1);
            expect(next.writes.slice(1).reduce((sum, r) => sum + r.body.LineTotal, 0)).toBe(quantity * 45);
        });
    }
});
test('an item failure stops emails and retry preserves only already confirmed items', async () => {
    const state = {failLine: 4}, h = harness(current, state), data = clone(seed);
    const result = await h.service.processOrder(data);
    expect(result.success).toBe(false); expect(h.emails).toEqual([]); expect(h.writes).toHaveLength(5);
    state.failLine = null;
    const retry = await h.service.processOrder(data);
    expect(retry.success).toBe(true); expect(retry.quoteId).toBe(result.quoteId);
    expect(h.writes.filter(r => r.url.endsWith('quote_sessions'))).toHaveLength(1);
    expect(h.writes.slice(5).map(r => r.body.LineNumber)).toEqual([4, 5, 6, 7, 8]);
    expect(h.emails).toHaveLength(2);
});
test.each(['failCustomer', 'failSales'])('%s retries only the missing email without another order', async failure => {
    const state = {[failure]: true}, h = harness(current, state), data = clone(seed);
    const result = await h.service.processOrder(data);
    expect(result.success).toBe(true); expect(result.customerEmailSent && result.salesEmailSent).toBe(false);
    expect(h.writes).toHaveLength(9); expect(h.emails).toHaveLength(2);
    state[failure] = false;
    const retry = await h.service.processOrder(data);
    expect(retry.quoteId).toBe(result.quoteId); expect(retry.customerEmailSent && retry.salesEmailSent).toBe(true);
    expect(h.writes).toHaveLength(9); expect(h.emails).toHaveLength(3);
    expect(h.emails[2].template).toBe(failure === 'failCustomer' ? 'template_2rlgjio' : 'template_af6h6kh');
});
test('a rejected session retries under the original reference', async () => {
    const state = {failSession: true}, h = harness(current, state), data = clone(seed);
    const a = await h.service.processOrder(data);
    expect(a.success).toBe(false); expect(h.writes).toHaveLength(1); expect(h.emails).toHaveLength(0);
    state.failSession = false;
    const b = await h.service.processOrder(data);
    expect(b.quoteId).toBe(a.quoteId); expect(b.success).toBe(true);
    expect(h.writes[0]).toEqual(h.writes[1]); expect(h.writes).toHaveLength(10);
});
test('duplicate pending calls share the captured order and do not duplicate writes', async () => {
    let release; const hold = new Promise(resolve => {release = resolve;});
    const h = harness(current, {hold}), data = clone(seed);
    const first = h.service.processOrder(data), second = h.service.processOrder(data);
    data.customerName = 'Edited after submission'; data.sizeDistribution.M = 80;
    expect(h.writes).toHaveLength(1);
    release(); const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]); expect(h.writes).toHaveLength(9); expect(h.emails).toHaveLength(2);
    expect(h.emails[0].data.customer_name).toBe('Example Customer');
});
test('a new completed order gets a fresh reference', async () => {
    const h = harness(), a = await h.service.processOrder(clone(seed)), b = await h.service.processOrder(clone(seed));
    expect(b.quoteId).not.toBe(a.quoteId); expect(h.writes).toHaveLength(18);
});
