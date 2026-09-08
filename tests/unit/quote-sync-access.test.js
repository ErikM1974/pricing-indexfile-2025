const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const espree = require('espree');
const createAccess = require('../../lib/quote-sync-access');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const tree = espree.parse(source, { ecmaVersion: 'latest', range: true });
function productionFunction(name, globals = {}) {
    const node = tree.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
    if (!node) throw new Error(`Missing production helper ${name}`);
    return vm.runInNewContext(`(${source.slice(...node.range)})`, { Buffer, crypto, ...globals });
}
const requireStaff = productionFunction('requireStaff');
const shareTokenOk = productionFunction('shareTokenOk');
const SECRET = 'test-sync-credential';
const withProxySecret = productionFunction('withProxySecret', { CRM_API_SECRET: SECRET });
const staffRoutes = [
    ['post', '/api/sanmar-orders/sync-shipments'],
    ['post', '/api/sanmar-orders/sync-recent-completed'],
    ['get', '/api/sanmar-orders/sync-recent-completed-status'],
    ['post', '/api/quote-sessions/:quoteId/send-to-shipstation'],
    ['get', '/api/quote-change-log/:quoteId'],
    ['get', '/api/quote-change-log-recent'],
    ['put', '/api/quote-change-log/:id/acknowledge'],
];
const sharedRoutes = [
    ['post', '/api/quote-sessions/:quoteId/shipstation-tracking'],
    ['post', '/api/quote-sessions/bulk-sync-from-shopworks'],
    ['post', '/api/quote-sessions/bulk-sync-shipstation-tracking'],
    ['post', '/api/quote-sync-health/alert'],
];
function harness(secret = SECRET) {
    const access = createAccess({ sharedSecret: secret, requireStaff });
    const routes = new Map();
    const app = Object.fromEntries(
        ['get', 'post', 'put'].map((method) => [
            method,
            (url, ...chain) => routes.set(`${method} ${url}`, chain),
        ])
    );
    const api = jest.fn().mockResolvedValue([]);
    const upstream = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ found: false, orders: [] }) });
    const notify = jest.fn();
    const ctx = {
        ...access,
        requireStaff,
        shareTokenOk,
        withProxySecret,
        makeApiRequest: api,
        fetch: upstream,
        notifyQuoteSyncHealth: notify,
        sanitizeFilterInput: String,
        nowPacificNaiveIso: () => '2026-09-07T12:00:00',
        parseCaspioPacificMs: Date.parse,
        recordQuoteSyncRun: jest.fn(),
        computeQuoteSyncHealth: () => ({ ok: true }),
        strictLimiter: (req, res, next) => next(),
        CRM_API_SECRET: SECRET,
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        SYNC_PROXY_BASE: 'https://proxy.example.test',
        SOFT_DELETE_RETENTION_DAYS: 30,
    };
    require('../../routes/quote-sync')(app, ctx);
    require('../../routes/quote-lifecycle')(app, ctx);
    async function call(method, url, options = {}) {
        const req = {
            params: { quoteId: 'OF-TEST', id: '42' },
            query: {},
            body: {},
            originalUrl: url,
            get: (name) => options.headers?.[name.toLowerCase()],
            ...options,
        };
        const res = {
            statusCode: 200,
            body: undefined,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.body = body;
                return this;
            },
        };
        const chain = routes.get(`${method} ${url}`);
        if (!chain) throw new Error(`Missing route ${method} ${url}`);
        async function run(i) {
            if (chain[i]) return chain[i](req, res, () => run(i + 1));
        }
        await run(0);
        return res;
    }
    return { ...access, routes, api, upstream, notify, call };
}
const row = () => ({
    PK_ID: 42,
    QuoteID: 'OF-TEST',
    Notes: JSON.stringify({ share_token: 'customer-token' }),
    ShopWorks_Order_Number: 123,
});
const staff = { session: { crmUser: { email: 'staff@example.test' } } };
const signed = { headers: { 'x-crm-api-secret': SECRET } };

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
    jest.restoreAllMocks();
});

test.each([...staffRoutes, ...sharedRoutes])(
    'anonymous %s %s is rejected before any work',
    async (method, url) => {
        const h = harness();
        expect((await h.call(method, url)).statusCode).toBe(401);
        expect(h.api).not.toHaveBeenCalled();
        expect(h.upstream).not.toHaveBeenCalled();
        expect(h.notify).not.toHaveBeenCalled();
    }
);

test.each(staffRoutes)('only staff may enter %s %s', (method, url) => {
    const h = harness();
    const gate = h.routes.get(`${method} ${url}`)[0];
    expect(gate).toBe(requireStaff);
    const next = jest.fn();
    gate({ ...staff }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
});

test.each(sharedRoutes)('staff and authenticated proxy may enter %s %s', (method, url) => {
    const h = harness();
    const gate = h.routes.get(`${method} ${url}`)[0];
    for (const option of [staff, signed]) {
        const next = jest.fn();
        gate({ ...option, get: (key) => option.headers?.[key.toLowerCase()] }, {}, next);
        expect(next).toHaveBeenCalledTimes(1);
    }
});

test.each([
    [SECRET, {}],
    [undefined, {}],
    ['', { 'x-crm-api-secret': '' }],
    [SECRET, { 'x-crm-api-secret': 'wrong-credential-1234' }],
    [SECRET, { 'x-crm-api-secret': 'é'.repeat(SECRET.length) }],
    [
        SECRET,
        { origin: 'https://sanmar-inventory-app.herokuapp.com', 'x-forwarded-proto': 'https' },
    ],
])('missing, incorrect and forged caller credentials fail closed (%#)', async (secret, headers) => {
    const h = harness(secret === undefined ? null : secret);
    const response = await h.call('post', '/api/quote-sessions/bulk-sync-from-shopworks', {
        headers,
        query: { 'X-CRM-API-Secret': SECRET },
        body: { crmUser: { email: 'fake@example.test' } },
    });
    expect(response.statusCode).toBe(401);
    expect(h.api).not.toHaveBeenCalled();
});

test.each(['', 'wrong-token', 'é'.repeat('customer-token'.length)])(
    'invalid share token cannot read or refresh quote: %s',
    async (k) => {
        const h = harness();
        h.api.mockResolvedValue([row()]);
        for (const [method, url] of [
            ['post', '/api/quote-sessions/:quoteId/sync-from-shopworks'],
            ['get', '/api/quote-sessions/:quoteId/vendor-shipment'],
            ['get', '/api/quote-sessions/:quoteId/full'],
        ])
            expect((await h.call(method, url, { query: { k, woId: '999' } })).statusCode).toBe(404);
        expect(h.upstream).not.toHaveBeenCalled();
        expect(h.api.mock.calls.every(([, method]) => !method)).toBe(true);
    }
);

test.each([
    ['customer link', { query: { k: 'customer-token' } }],
    ['staff', staff],
    ['proxy', signed],
])('%s can refresh its selected quote', async (_, caller) => {
    const h = harness();
    h.api.mockImplementation(async (url, method) => (method ? {} : [row()]));
    const response = await h.call(
        'post',
        '/api/quote-sessions/:quoteId/sync-from-shopworks',
        caller
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ success: true, synced: true, status: 'Pending' });
    expect(h.upstream).toHaveBeenCalledWith(
        expect.stringContaining('orderNumber=123'),
        expect.any(Object)
    );
    expect(h.api).toHaveBeenCalledWith(
        '/quote_sessions/42',
        'PUT',
        expect.objectContaining({ ShopWorks_Status: 'Pending' })
    );
});

test('legacy links remain readable and refreshable without a token', async () => {
    const h = harness();
    h.api.mockResolvedValue([{ ...row(), Notes: '{}' }]);
    expect(
        (await h.call('post', '/api/quote-sessions/:quoteId/sync-from-shopworks')).statusCode
    ).toBe(200);
    expect(h.upstream).toHaveBeenCalledTimes(1);
});

test('customer cannot substitute a different work order even with a valid quote token', async () => {
    const h = harness();
    h.api.mockResolvedValue([row()]);
    expect(
        (
            await h.call('post', '/api/quote-sessions/:quoteId/sync-from-shopworks', {
                query: { k: 'customer-token' },
                body: { shopWorksOrderNumber: 999 },
            })
        ).statusCode
    ).toBe(403);
    expect(h.upstream).not.toHaveBeenCalled();
    expect(h.api).toHaveBeenCalledTimes(1);
});

test('staff can repair a work order reference', async () => {
    const h = harness();
    h.api.mockResolvedValue([row()]);
    const response = await h.call('post', '/api/quote-sessions/:quoteId/sync-from-shopworks', {
        ...staff,
        body: { shopWorksOrderNumber: 999 },
    });
    expect(response.statusCode).toBe(200);
    expect(h.upstream).toHaveBeenCalledWith(
        expect.stringContaining('orderNumber=999'),
        expect.any(Object)
    );
});

test('vendor shipment query cannot escape the customer quote scope', async () => {
    const h = harness();
    h.api.mockResolvedValue([row()]);
    const response = await h.call('get', '/api/quote-sessions/:quoteId/vendor-shipment', {
        query: { k: 'customer-token', woId: '999' },
    });
    expect(response.statusCode).toBe(200);
    expect(h.upstream).toHaveBeenCalledWith(
        'https://proxy.example.test/api/sanmar-orders/lookup?woId=123'
    );
    expect(response.body).toMatchObject({ woId: 123, linked: false });
});

test('vendor lookup failure is surfaced instead of reporting that an order has no PO', async () => {
    const h = harness();
    h.api.mockRejectedValue(new Error('Caspio unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(
        (
            await h.call('get', '/api/quote-sessions/:quoteId/vendor-shipment', {
                query: { k: 'customer-token' },
            })
        ).statusCode
    ).toBe(500);
    expect(h.upstream).not.toHaveBeenCalled();
});

test.each(['bulk-sync-from-shopworks', 'bulk-sync-shipstation-tracking'])(
    'scheduled %s authenticates its internal write',
    async (route) => {
        const h = harness();
        h.api.mockImplementation(async (url) =>
            url.includes('cancelledInShopWorks') ? [] : [{ ...row(), ShipStation_Order_ID: 17 }]
        );
        h.upstream.mockImplementation(async (url) => ({
            ok: true,
            json: async () =>
                url.includes('/shipments?')
                    ? {
                          shipments: [
                              {
                                  trackingNumber: 'TEST-TRACKING',
                                  carrierCode: 'usps',
                                  voided: false,
                              },
                          ],
                      }
                    : { success: true, synced: true, status: 'Imported' },
        }));
        const result = await h.call('post', `/api/quote-sessions/${route}`, signed);
        expect(result.statusCode).toBe(200);
        expect(result.body.errors).toBe(0);
        const internal = h.upstream.mock.calls.filter(([url]) =>
            url.startsWith('http://localhost:')
        );
        expect(internal).toHaveLength(1);
        expect(internal[0][1].headers).toEqual({
            'Content-Type': 'application/json',
            'x-forwarded-proto': 'https',
            'X-CRM-API-Secret': SECRET,
        });
    }
);

test('customer browser forwards its share token on both quote-specific calls and hides staff repair', () => {
    const browser = fs.readFileSync(path.join(root, 'pages/js/quote-view.js'), 'utf8');
    expect(browser).toContain('/sync-from-shopworks${this.shareTokenParam()}');
    expect(browser).toContain(
        "/vendor-shipment?woId=${encodeURIComponent(woId)}${this.shareTokenParam('&')}"
    );
    expect(browser).toContain('this.isStaff && isProcessed && !hasWoNumber');
});
