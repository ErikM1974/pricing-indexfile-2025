const path = require('path');
const register = require('../../routes/customer-portal');
const { CHANNELS, DEFAULT_CHANNEL } = require('../../config/storefront-channels');

function input(channel = 'custom-tees') {
    return {
        tempOrderNumber: 'CTS-TEST-0042',
        customerData: {
            firstName: 'Ada',
            lastName: 'Sample',
            email: 'ada@example.test',
            company: 'Test Customer',
            deliveryMethod: 'pickup',
            city: 'Milton',
            state: 'WA',
            zip: '98354',
        },
        colorConfigs: {
            BrillOrng: {
                catalogColor: 'BrillOrng',
                displayColor: 'Brilliant Orange',
                sizeBreakdown: {
                    M: { quantity: 24, unitPrice: 15 },
                    '2XL': { quantity: 2, unitPrice: 19 },
                },
            },
        },
        orderTotals: {
            subtotal: 398,
            grandTotal: 438.6,
            salesTax: 40.6,
            taxRate: 0.102,
            taxAccount: '2200.102',
            taxAccountName: 'Milton',
            shipping: 0,
        },
        pricingData: { styleNumber: 'PC54', productName: 'Core Cotton Tee' },
        orderSettings: {
            channel,
            rush: false,
            styleNumber: 'PC54',
            styleName: 'Core Cotton Tee',
            printLocationCode: 'LC',
            frontLogo: { fileUrl: 'https://art.example.test/front.png' },
            backLogo: { fileUrl: 'https://art.example.test/back.png' },
            shipPromise: { label: 'September 18', date: '2026-09-18' },
        },
        paymentConfirmed: true,
        stripeSessionId: 'cs_test_full_session_identifier',
        paymentAmount: 43860,
    };
}
function harness(options = {}) {
    const noop = () => {},
        routes = [],
        calls = [];
    const app = Object.fromEntries(
        ['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].map((method) => [
            method,
            (route, ...handlers) => routes.push({ method, route, handlers }),
        ])
    );
    const retrieve = jest.fn(async () => {
        if (options.stripeError) throw Error('Stripe unavailable');
        return (
            options.payment || { payment_status: 'paid', metadata: { quoteID: 'CTS-TEST-0042' } }
        );
    });
    const fetch = jest.fn(async (url, request) => {
        calls.push({ url, request, payload: JSON.parse(request.body) });
        if (
            url !== 'https://proxy.test/api/manageorders/orders/create' ||
            request.method !== 'POST'
        )
            throw Error('Unexpected request');
        if (options.transportError) throw Error('Network unavailable');
        return {
            ok: !options.pushFailure,
            json: async () =>
                options.pushFailure
                    ? { success: false, error: 'Manual review required' }
                    : { success: true, orderNumber: 145000, shopWorksId: 145000 },
        };
    });
    register(app, {
        rateLimit: () => noop,
        requireCrmRole: () => noop,
        express: { json: () => noop },
        boxForward: () => noop,
        CASPIO_PROXY_BASE: 'https://proxy.test',
        CRM_API_SECRET: 'unit-test-secret',
        INTERNAL_CALL_KEY: 'internal-test-key',
        fetch,
        stripe: () => ({ checkout: { sessions: { retrieve } } }),
        channelConfig: (name) => CHANNELS[name] || CHANNELS[DEFAULT_CHANNEL],
        nowPacificNaiveIso: () => '2026-09-07T23:30:00',
        path,
        SERVER_DIR: path.resolve(__dirname, '../..'),
    });
    const matches = routes.filter(
        (r) => r.method === 'post' && r.route === '/api/submit-3day-order'
    );
    expect(matches).toHaveLength(1);
    return {
        calls,
        fetch,
        retrieve,
        async submit(body, internal) {
            const res = {
                statusCode: 200,
                status(n) {
                    this.statusCode = n;
                    return this;
                },
                json(value) {
                    this.body = value;
                    return this;
                },
            };
            await matches[0].handlers.at(-1)(
                {
                    body: structuredClone(body),
                    get: (name) => (name === 'x-nwca-internal' ? internal : undefined),
                },
                res
            );
            return res;
        },
    };
}
beforeEach(() => {
    for (const method of ['log', 'warn', 'error'])
        jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('missing input cannot call Stripe or ManageOrders', async () => {
    const h = harness();
    const res = await h.submit({});
    expect(res.statusCode).toBe(400);
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
});
test.each([
    { payment: { payment_status: 'unpaid' } },
    { payment: { payment_status: 'paid', metadata: { quoteID: 'DIFFERENT' } } },
    { stripeError: true },
])('unverified external payment is rejected without creating an order: %j', async (options) => {
    const h = harness(options);
    const res = await h.submit(input());
    expect(res.statusCode).toBe(403);
    expect(h.fetch).not.toHaveBeenCalled();
});
test('a wrong internal key still requires Stripe verification', async () => {
    const h = harness({ payment: { payment_status: 'unpaid' } });
    const res = await h.submit(input(), 'wrong');
    expect(res.statusCode).toBe(403);
    expect(h.retrieve).toHaveBeenCalledWith('cs_test_full_session_identifier');
    expect(h.fetch).not.toHaveBeenCalled();
});
test.each(['3-day-tees', 'custom-tees', 'custom-caps'])(
    'paid %s payload keeps catalog colors, payments, tax and channel routing',
    async (channel) => {
        const body = input(channel);
        if (channel === 'custom-caps') {
            body.orderSettings.styleNumber = 'C112';
            body.colorConfigs.BrillOrng.sizeBreakdown = { OSFA: { quantity: 12, unitPrice: 23.5 } };
        }
        const h = harness();
        const res = await h.submit(body);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(h.retrieve).toHaveBeenCalledTimes(1);
        const { payload: p, request } = h.calls[0];
        expect(request.headers['X-CRM-API-Secret']).toBe('unit-test-secret');
        expect(p.lineItems[0]).toMatchObject({
            partNumber: body.orderSettings.styleNumber,
            color: 'BrillOrng',
            size: channel === 'custom-caps' ? 'OSFA' : 'M',
            quantity: channel === 'custom-caps' ? 12 : 24,
        });
        expect(p.designs[0].designTypeId).toBe(CHANNELS[channel].push.designTypeId);
        expect(p.designs[0].locations).toHaveLength(1);
        expect(p.attachments).toHaveLength(1); // Stray uncharged back artwork is excluded.
        expect(p.shipping.method).toBe('Customer Pickup');
        expect(p.taxTotal).toBe(40.6);
        expect(p.payments[0]).toMatchObject({
            amount: 438.6,
            date: '2026-09-07',
            authCode: 'cs_test_full_session_identifier',
            accountNumber: 'cs_test_full_session_identifier',
        });
        expect(p.orderDate).toBe('2026-09-07');
        expect(p.rushOrder).toBe(CHANNELS[channel].push.rushOrderFlag(body.orderSettings));
    }
);
test('verified internal call skips Stripe and preserves back-only jumbo placement and eight-mockup cap', async () => {
    const body = input();
    body.orderSettings.printLocationCode = 'JB';
    body.orderSettings.frontLocation = null;
    body.orderSettings.backLocation = 'JB';
    body.orderSettings.mockups = Array.from({ length: 10 }, (_, i) => ({
        url: `https://art.example.test/mockup-${i}.png`,
    }));
    const h = harness();
    const res = await h.submit(body, 'internal-test-key');
    expect(res.body.success).toBe(true);
    expect(h.retrieve).not.toHaveBeenCalled();
    const p = h.calls[0].payload;
    expect(p.designs[0].locations).toHaveLength(1);
    expect(p.designs[0].locations[0]).toMatchObject({
        location: 'Full Back',
        imageUrl: 'https://art.example.test/back.png',
    });
    expect(p.designs[0].locations[0].notes).toContain('JUMBO BACK');
    expect(
        p.attachments.filter((a) => a.linkNote === 'Customer-approved designer mockup')
    ).toHaveLength(8);
});
test('upstream rejection remains HTTP 200 with manual-processing response', async () => {
    const h = harness({ pushFailure: true });
    const res = await h.submit(input(), 'internal-test-key');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
        success: false,
        orderNumber: 'CTS-TEST-0042',
        error: 'Manual review required',
    });
    expect(res.body.message).toContain('requires manual processing');
});
test('transport failure remains HTTP 500', async () => {
    const h = harness({ transportError: true });
    const res = await h.submit(input(), 'internal-test-key');
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
        success: false,
        error: 'Failed to submit order to ShopWorks',
    });
});
