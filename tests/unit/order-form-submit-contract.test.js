const path = require('path');
const register = require('../../routes/order-form');

function input() {
    return {
        info: {
            company: 'Test Customer',
            buyerFirst: 'Ada',
            buyerLast: 'Sample',
            email: 'ada@example.test',
            salesRep: 'taneisha',
            companyId: '1276',
            dateIn: '09/07/2026',
            dateDue: '09/14/2026',
            dropDeadDate: '09/18/2026',
            po: 'TEST-PO',
        },
        rows: [
            {
                id: 'line1',
                style: 'PC54',
                desc: 'Core Cotton Tee',
                colorName: 'Brilliant Orange',
                catalogColor: 'BrillOrng',
                deco: 'dtg',
                sizes: { M: 2, '2XL': 1 },
                price: 99,
            },
        ],
        breakdown: {
            supported: true,
            totalQty: 3,
            subtotal: 68,
            grandTotal: 74.936,
            ltmTotal: 49.92,
            byRow: {
                line1: {
                    unitPriceBySize: { M: 20, '2XL': 28 },
                    tier: '1-23',
                    extras: { ltmPerPiece: 0 },
                },
            },
        },
        ship: { method: 'pickup', taxRate: 0.102, fee: 0 },
        decoConfig: { method: 'dtg', primaryLocation: 'Left Chest' },
        printLocations: 'Left Chest',
        methodNotesBlock: 'DTG · Left Chest · 3 pieces',
        designNumbers: ['9449'],
    };
}

function harness(options = {}) {
    const routes = [],
        calls = [],
        unexpected = [],
        cache = new Map();
    const app = Object.fromEntries(
        ['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].map((method) => [
            method,
            (route, ...handlers) => routes.push({ method, route, handlers }),
        ])
    );
    const response = (body, ok = true) => ({ ok, status: ok ? 200 : 502, json: async () => body });
    const fetch = jest.fn(async (url, request = {}) => {
        const method = request.method || 'GET';
        const body = request.body ? JSON.parse(request.body) : undefined;
        calls.push({ kind: 'fetch', url, method, body, headers: request.headers });
        if (method === 'GET' && url.endsWith('/api/tax-rates'))
            return response({
                data: [
                    {
                        Active: 'Yes',
                        Tax_Rate: 0.102,
                        Account_Number: '2200.102',
                        Account_Name: '10.20%',
                    },
                ],
            });
        if (method === 'GET' && url.endsWith('/api/service-codes'))
            return response({ data: options.codes || [] });
        if (method === 'GET' && url.endsWith('/api/quote-sequence/OF'))
            return response({ sequence: 42 });
        if (method === 'POST' && url.endsWith('/api/quote_sessions'))
            return response({ PK_ID: 'records' });
        if (method === 'POST' && url.endsWith('/api/manageorders/orders/create'))
            return response(
                options.pushFailure
                    ? { success: false, error: 'Upstream rejected' }
                    : { success: true, orderNumber: 145000 },
                !options.pushFailure
            );
        if (method === 'POST' && url.endsWith('/api/quote_items')) {
            if (options.auditFailure) throw new Error('Audit store unavailable');
            return response({ success: true });
        }
        if (method === 'POST' && url.endsWith('/api/order-form/customer-suggestions/history'))
            return response({ success: true });
        unexpected.push({ url, method });
        throw new Error('Unexpected fetch: ' + method + ' ' + url);
    });
    const makeApiRequest = jest.fn(async (url, method = 'GET', body) => {
        calls.push({ kind: 'api', url, method, body });
        if (method === 'GET' && url.startsWith('/quote_sessions?filter='))
            return [{ PK_ID: 123, Status: options.processed ? 'Processed' : 'Draft' }];
        if (method === 'PUT' && url === '/quote_sessions/123') return { success: true };
        unexpected.push({ url, method });
        throw new Error('Unexpected API call: ' + method + ' ' + url);
    });
    register(app, {
        API_BASE_URL: 'https://proxy.test/api',
        CASPIO_PROXY_BASE: 'https://proxy.test',
        SYNC_PROXY_BASE: 'https://proxy.test',
        CRM_API_SECRET: 'unit-test-secret',
        NWCA_LOCATIONS: {
            milton: {
                company: 'Northwest Custom Apparel',
                city: 'Milton',
                state: 'WA',
                zip: '98354',
                country: 'USA',
            },
        },
        fetch,
        makeApiRequest,
        withProxySecret: (headers) => ({ ...headers, 'X-CRM-API-Secret': 'unit-test-secret' }),
        cacheSubmitResponse: (key, value) => {
            if (key) cache.set(key, value);
        },
        getCachedSubmitResponse: (key) => cache.get(key),
        requireStaff: () => {},
        monitor: null,
        fs: {},
        path,
        SERVER_DIR: path.resolve(__dirname, '../..'),
    });
    const matches = routes.filter(
        (r) => r.method === 'post' && r.route === '/api/submit-order-form'
    );
    expect(matches).toHaveLength(1);
    return {
        calls,
        fetch,
        makeApiRequest,
        async submit(body, query = { dryRun: '1' }, headers = {}) {
            const res = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(value) {
                    this.body = value;
                    return this;
                },
            };
            const work = matches[0].handlers.at(-1)(
                { body: structuredClone(body), query, headers },
                res
            );
            await jest.runAllTimersAsync();
            await work;
            expect(unexpected).toEqual([]); // Unexpected failures must not disappear into best-effort catches.
            return res;
        },
    };
}

beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-07T19:00:00Z') });
    for (const method of ['log', 'warn', 'error'])
        jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('DTG dry-run preserves size prices, catalog colors, linked design, rep routing and tax instructions with no writes', async () => {
    const h = harness();
    const res = await h.submit(input());
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
        success: true,
        mode: 'dry-run',
        extOrderId: 'OF-DRYRUN',
        skippedLines: [],
    });
    const p = res.body.payload;
    expect(p.lineItems).toEqual([
        {
            partNumber: 'PC54',
            description: 'Core Cotton Tee',
            color: 'Brilliant Orange',
            catalogColor: 'BrillOrng',
            size: 'M',
            quantity: 2,
            price: 20,
            workOrderNotes: 'Left Chest',
            extDesignIdBlock: 'OF-DRYRUN-DTG',
        },
        {
            partNumber: 'PC54',
            description: 'Core Cotton Tee',
            color: 'Brilliant Orange',
            catalogColor: 'BrillOrng',
            size: '2XL',
            quantity: 1,
            price: 28,
            workOrderNotes: 'Left Chest',
            extDesignIdBlock: 'OF-DRYRUN-DTG',
        },
    ]);
    expect(p).toMatchObject({
        taxTotal: 0,
        payments: [],
        salesRep: 'Taneisha Clark',
        idEmpCreatedBy: 281,
        idCustomer: 1276,
        idOrderType: 5,
        orderDate: '2026-09-07',
        requestedShipDate: '2026-09-14',
        dropDeadDate: '2026-09-18',
        apiSource: 'ManageOrders',
        extSource: 'NWCA-OrderForm',
    });
    expect(p.designs).toHaveLength(1);
    expect(p.designs[0]).toMatchObject({
        idDesign: 9449,
        designTypeId: 45,
        productColor: 'BrillOrng',
        externalId: 'OF-DRYRUN-DTG',
    });
    expect(p.shipping).toMatchObject({
        address1: 'Customer Pickup',
        city: 'Milton',
        method: 'Customer Pickup',
    });
    expect(p.notes).toContainEqual({
        type: 'Notes On Order',
        note: 'Tax Account: 2200.102 — 10.20%',
    });
    expect(h.calls.every((c) => c.method === 'GET')).toBe(true);
});

test('shipping keeps both address lines, billed freight and unknown rep fallback', async () => {
    const body = input();
    body.ship = {
        method: 'ups',
        address: 'Receiving Department',
        address2: '123 Test Street',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        fee: 12.5,
    };
    body.info.salesRep = 'new-rep';
    const {
        body: { payload: p },
    } = await harness().submit(body);
    expect(p.shipping).toMatchObject({
        address1: 'Receiving Department',
        address2: '123 Test Street',
        method: 'UPS Ground',
    });
    expect(p).toMatchObject({
        cur_Shipping: 12.5,
        totals: { shipping: 12.5 },
        salesRep: 'new-rep',
        idEmpCreatedBy: 2,
    });
});

test('manual price override is honored for every size', async () => {
    const body = input();
    body.rows[0].priceOverride = true;
    body.rows[0].price = 24.125;
    const res = await harness().submit(body);
    expect(res.body.payload.lineItems.map((l) => l.price)).toEqual([24.125, 24.125]);
});

test('missing automatic size price is reported and never replaced with the row average', async () => {
    const body = input();
    delete body.breakdown.byRow.line1.unitPriceBySize['2XL'];
    const res = await harness().submit(body);
    expect(res.body.payload.lineItems.map((l) => l.size)).toEqual(['M']);
    expect(res.body.skippedLines).toEqual([
        {
            style: 'PC54',
            color: 'Brilliant Orange',
            size: '2XL',
            quantity: 1,
            reason: 'No price available for this size in the pricing engine',
        },
    ]);
});

test('zero-price garment blocks submission after the existing draft lookup', async () => {
    const body = input();
    body.draftId = 'OF-0042';
    body.rows[0].priceOverride = true;
    body.rows[0].price = 0;
    const h = harness();
    const res = await h.submit(body, {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('$0 line item');
    expect(res.body.zeroPriceLines).toHaveLength(2);
    expect(h.calls).toEqual([
        {
            kind: 'api',
            method: 'GET',
            url: "/quote_sessions?filter=QuoteID='OF-0042'",
            body: undefined,
        },
    ]);
});

test('mixed decoration methods block the whole order', async () => {
    const body = input();
    body.rows.push({ ...body.rows[0], id: 'line2', deco: 'embroidery' });
    const res = await harness().submit(body);
    expect(res.statusCode).toBe(400);
    expect(res.body.methodsUsed).toEqual(['dtg', 'embroidery']);
});

test('base64 previews cannot create orphan artwork; hosted artwork can', async () => {
    const body = input();
    body.designNumbers = [];
    body.files = [{ name: 'Logo', preview: 'data:image/png;base64,AAAA' }];
    body.info.newDesignName = 'New logo';
    const h = harness();
    const first = await h.submit(body);
    expect(first.body.payload.designs).toEqual([]);
    expect(first.body.payload.attachments).toEqual([]);
    body.files[0].hostedUrl = 'https://art.example.test/logo.png';
    body.files[0].placements = ['Full Front'];
    const second = await h.submit(body);
    expect(second.body.payload.designs[0]).toMatchObject({
        name: 'New logo',
        locations: [{ location: 'Full Front', imageUrl: 'https://art.example.test/logo.png' }],
    });
    expect(second.body.payload.attachments).toEqual([
        {
            mediaUrl: 'https://art.example.test/logo.png',
            mediaName: 'Logo',
            linkNote: 'Full Front',
        },
    ]);
});

test.each([
    ['FLAT', 'FEE', 0, {}, 0],
    ['FIXED', 'FEE', 12.34567, {}, 12.3457],
    ['CALCULATED', 'RUSH', 0, { percent: 30 }, 20.4],
    ['PASSTHROUGH', 'SHIP', 0, { amount: -5.25 }, -5.25],
    ['HOURLY', 'ART', 80, { hours: 1.5 }, 120],
    ['TIERED', 'AL', 0, { unitPrice: 4.123456 }, 4.1235],
])(
    'service %s preserves configured or entered fee calculation',
    async (method, code, sell, params, expected) => {
        const body = input();
        body.addOns = [{ code, qty: 1, params }];
        const res = await harness({
            codes: [
                {
                    ServiceCode: code,
                    PricingMethod: method,
                    SellPrice: sell,
                    DisplayName: 'Test fee',
                },
            ],
        }).submit(body);
        expect(res.body.payload.lineItems.at(-1)).toMatchObject({
            partNumber: code,
            quantity: 1,
            price: expected,
        });
    }
);

test('processed draft returns without another order push', async () => {
    const body = input();
    body.draftId = 'OF-0042';
    const h = harness({ processed: true });
    const res = await h.submit(body, {});
    expect(res.body).toMatchObject({ mode: 'already-processed', success: true });
    expect(h.fetch).not.toHaveBeenCalled();
});

test.each([false, true])(
    'live submission and replay keep upstream failure=%s without duplicate push',
    async (pushFailure) => {
        const body = input();
        body.draftId = 'OF-0042';
        body.submissionId = 'submission-test';
        const h = harness({ pushFailure, auditFailure: true });
        const first = await h.submit(body, {});
        const second = await h.submit(body, {});
        expect(first.statusCode).toBe(pushFailure ? 502 : 200);
        expect(first.body.success).toBe(!pushFailure);
        expect(second.body).toEqual({ ...first.body, idempotentReplay: true });
        const pushes = h.calls.filter((c) => c.url.endsWith('/api/manageorders/orders/create'));
        expect(pushes).toHaveLength(1);
        expect(pushes[0].headers['X-CRM-API-Secret']).toBe('unit-test-secret');
        expect(h.makeApiRequest).toHaveBeenCalledWith('/quote_sessions/123', 'PUT', {
            Status: pushFailure ? 'Processed - ShopWorks Failed' : 'Processed',
        });
    }
);

test('direct submission rounds integer audit fields and reads numeric PK before status update', async () => {
    const h = harness();
    const res = await h.submit(input(), {});
    expect(res.body).toMatchObject({ success: true, extOrderId: 'OF-0042', shopWorksId: 145000 });
    const draft = h.calls.find((c) => c.url.endsWith('/api/quote_sessions') && c.method === 'POST');
    expect(draft.body.LTMFeeTotal).toBe(50);
    expect(h.makeApiRequest).toHaveBeenCalledWith('/quote_sessions/123', 'PUT', {
        Status: 'Processed',
    });
    expect(h.calls.findIndex((c) => c.url === '/quote_sessions/123')).toBeGreaterThan(
        h.calls.findIndex((c) => c.url.endsWith('/api/manageorders/orders/create'))
    );
});
