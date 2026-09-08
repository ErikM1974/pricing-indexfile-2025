const crypto = require('crypto');
const links = require('../../lib/payments/quote-links')({ crypto });
const integrity = require('../../lib/payments/quote-integrity')({ crypto });
const createRecords = require('../../lib/payments/order-records');
const createDeposits = require('../../lib/payments/deposits');
const savedEnv = Object.fromEntries(
    ['ORDER_STATUS_SECRET', 'QUOTE_TOTALS_HMAC_SECRET', 'CRM_API_SECRET'].map((key) => [
        key,
        process.env[key],
    ])
);
afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test('customer tokens are unpredictable URL-safe credentials and links retain encoded quote identity', () => {
    const first = links.mintShareToken(),
        second = links.mintShareToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second).not.toBe(first);
    const url = new URL(
        links.quoteShareUrl('OF/TEST ?', { Notes: JSON.stringify({ share_token: 'token &+' }) })
    );
    expect(decodeURIComponent(url.pathname)).toBe('/quote/OF/TEST ?');
    expect(url.searchParams.get('k')).toBe('token &+');
});
test('stored share tokens reject missing, wrong and unequal UTF-8 credentials while preserving staff and legacy access', () => {
    const row = { Notes: JSON.stringify({ share_token: 'test-token' }) };
    for (const k of ['', 'wrong-token', 'é'.repeat(10)])
        expect(links.shareTokenOk({ query: { k } }, row)).toBe(false);
    expect(links.shareTokenOk({ query: { k: 'test-token' } }, row)).toBe(true);
    expect(links.shareTokenOk({ session: { crmUser: { email: 'staff@example.test' } } }, row)).toBe(
        true
    );
    expect(links.shareTokenOk({ query: {} }, { Notes: 'legacy note' })).toBe(true);
});
test.each(['Call before delivery', '[1,2]', 'false', 'null'])(
    'legacy notes survive a JSON round trip: %s',
    (notes) => {
        expect(JSON.parse(JSON.stringify(links.parseNotesJson(notes)))).toEqual({
            _legacyText: notes,
        });
    }
);
test('structured notes retain their fields and absent notes become an empty object', () => {
    expect(links.parseNotesJson('{"share_token":"test","payments":[]}')).toEqual({
        share_token: 'test',
        payments: [],
    });
    expect(links.parseNotesJson('')).toEqual({});
});
test('order status tokens require a configured secret and are bound to the quote', () => {
    delete process.env.ORDER_STATUS_SECRET;
    expect(links.computeOrderStatusToken('TEST')).toBeNull();
    process.env.ORDER_STATUS_SECRET = 'unit-status-secret';
    const token = links.computeOrderStatusToken('TEST');
    expect(token).toMatch(/^[a-f0-9]{12}$/);
    expect(links.computeOrderStatusToken('OTHER')).not.toBe(token);
    const url = new URL(links.buildOrderStatusUrl('TEST ?', token));
    expect(url.searchParams.get('id')).toBe('TEST ?');
    expect(url.searchParams.get('t')).toBe(token);
});
test('v2 payment integrity rejects changed quote/amounts and a public legacy digest', () => {
    process.env.QUOTE_TOTALS_HMAC_SECRET = 'unit-hmac-secret';
    const totalsHash = integrity.computeQuoteTotalsHash('TEST', 100, 110, 55),
        dep = { hashVersion: 2, totalsHash };
    expect(integrity.totalsHashMatches(dep, 'TEST', 100, 110, 55)).toBe(true);
    for (const args of [
        ['OTHER', 100, 110, 55],
        ['TEST', 101, 110, 55],
        ['TEST', 100, 111, 55],
        ['TEST', 100, 110, 56],
    ])
        expect(integrity.totalsHashMatches(dep, ...args)).toBe(false);
    const legacy = crypto
        .createHash('sha256')
        .update('TEST|100.00|110.00|55.00')
        .digest('hex')
        .slice(0, 16);
    expect(
        integrity.totalsHashMatches({ hashVersion: 2, totalsHash: legacy }, 'TEST', 100, 110, 55)
    ).toBe(false);
    expect(integrity.totalsHashMatches({ totalsHash: legacy }, 'TEST', 100, 110, 55)).toBe(true);
    expect(
        integrity.totalsHashMatches(
            { hashVersion: 2, totalsHash: 'é'.repeat(16) },
            'TEST',
            100,
            110,
            55
        )
    ).toBe(false);
});
test('signing fails closed without either secret and supports the configured CRM fallback', () => {
    delete process.env.QUOTE_TOTALS_HMAC_SECRET;
    delete process.env.CRM_API_SECRET;
    expect(() => integrity.computeQuoteTotalsHash('TEST', 100, 110, 55)).toThrow(
        'refusing to sign'
    );
    process.env.CRM_API_SECRET = 'unit-fallback-secret';
    expect(integrity.computeQuoteTotalsHash('TEST', 100, 110, 55)).toHaveLength(16);
});
test('quote lookup bypasses cache, sends authentication and selects the exact quote instead of the first result', async () => {
    const fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            data: [
                { QuoteID: 'OTHER', PK_ID: 1 },
                { QuoteID: 'TEST ?', PK_ID: 42 },
            ],
        }),
    });
    const { fetchQuoteSessionRow } = createRecords({
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        fetch,
        withProxySecret: () => ({ 'X-CRM-API-Secret': 'unit-only' }),
    });
    expect((await fetchQuoteSessionRow('TEST ?')).PK_ID).toBe(42);
    const [raw, options] = fetch.mock.calls[0],
        url = new URL(raw);
    expect(url.searchParams.get('quoteID')).toBe('TEST ?');
    expect(url.searchParams.get('refresh')).toBe('true');
    expect(options.headers['X-CRM-API-Secret']).toBe('unit-only');
    expect(await fetchQuoteSessionRow('MISSING')).toBeNull();
});
test('an unavailable quote lookup remains distinguishable from an absent record', async () => {
    const { fetchQuoteSessionRow } = createRecords({
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        fetch: async () => ({ ok: false, status: 503 }),
        withProxySecret: () => ({}),
    });
    await expect(fetchQuoteSessionRow('TEST')).rejects.toMatchObject({ httpStatus: 503 });
});
test.each([1, 50, 100])(
    'deposit percentage %s comes from the active configuration',
    async (pct) => {
        const { getDepositPct } = createDeposits({
            TDT_PROXY: 'https://proxy.example.test',
            fetch: async () => ({
                ok: true,
                json: async () => ({ data: [{ IsActive: true, SellPrice: pct }] }),
            }),
        });
        expect(await getDepositPct()).toBe(pct);
    }
);
test.each([
    null,
    { IsActive: false, SellPrice: 50 },
    { IsActive: true, SellPrice: 0 },
    { IsActive: true, SellPrice: 101 },
    { IsActive: true, SellPrice: 'invalid' },
])('missing or invalid deposit configuration never substitutes a percentage: %j', async (row) => {
    const { getDepositPct } = createDeposits({
        TDT_PROXY: 'https://proxy.example.test',
        fetch: async () => ({ ok: true, json: async () => ({ data: row ? [row] : [] }) }),
    });
    await expect(getDepositPct()).rejects.toThrow();
});
test('deposit configuration HTTP failure propagates to the caller', async () => {
    const { getDepositPct } = createDeposits({
        TDT_PROXY: 'https://proxy.example.test',
        fetch: async () => ({ ok: false, status: 503 }),
    });
    await expect(getDepositPct()).rejects.toThrow('HTTP 503');
});
