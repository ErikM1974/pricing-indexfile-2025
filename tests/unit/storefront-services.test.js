const assert = require('node:assert/strict');
const createServices = require('../../lib/storefront');
const channelConfig = require('../../config/storefront-channels');
const plain = (value) => JSON.parse(JSON.stringify(value));
function harness() {
    const calls = [],
        failures = new Set();
    const bundle = {
        tiersR: [
            { MinQuantity: 1, LTM_Fee: 25 },
            { MinQuantity: 24, LTM_Fee: 0 },
        ],
        sizes: [
            { size: 'S', price: 3 },
            { size: 'M', price: 3 },
        ],
    };
    const prices = {
        '3DT-RUSH': 25,
        '3DT-SHIP': 30,
        '3DT-LTM': 50,
        'CTS-SHIP-FLAT': 10,
        'CTS-SHIP-FREE-OVER': 100,
        'CAPS-SHIP-FLAT': 10,
        'CAPS-SHIP-FREE-OVER': 100,
    };
    const fetch = async (url, options = {}) => {
        calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
        const u = new URL(url);
        if ([...failures].some((p) => url.includes(p)))
            return { ok: false, status: 503, json: async () => ({}) };
        let data;
        if (u.pathname === '/api/service-codes')
            data = {
                data: u.searchParams.has('code')
                    ? [{ IsActive: true, SellPrice: prices[u.searchParams.get('code')] }]
                    : [{ ServiceCode: 'CTS-SALE-PC54', IsActive: true, SellPrice: 2 }],
            };
        else if (u.pathname === '/api/pricing-bundle')
            data = {
                ...bundle,
                sizes: u.searchParams.get('method')?.startsWith('CAP')
                    ? [{ size: 'OSFA', price: 6 }]
                    : bundle.sizes,
            };
        else if (u.pathname === '/api/dtg/top-sellers/styles')
            data = [
                { style: 'PC54', product_title: 'Test tee' },
                { style: 'PC61', product_title: 'Another tee' },
            ];
        else if (u.pathname === '/api/caps/catalog')
            data = [{ style: '112', product_title: 'Test cap' }];
        else if (u.pathname === '/api/tax-rates/lookup')
            data = { success: true, rate: 0.102, account: 'TEST-TAX' };
        else if (u.pathname === '/api/shipping/box-density') data = { density: { 'T-Shirt': 50 } };
        else if (u.pathname === '/api/inventory') data = [{ PIECE_WEIGHT: 0.5 }];
        else if (u.pathname === '/api/shipping/estimate-ups-ground')
            data = { estimate: 19.75, zone: 2 };
        else if (u.pathname === '/api/manageorders/pc54-inventory')
            data = { colors: { Black: { sizes: { S: 7, M: 9 } } } };
        else if (u.pathname.startsWith('/api/sanmar/inventory/'))
            data = {
                inventory: [
                    { color: 'Black', size: 'S', totalQty: 4 },
                    { color: 'Black', size: 'S', totalQty: 6 },
                    { color: 'Black', size: 'M', totalQty: 20 },
                ],
            };
        else throw new Error(`Unexpected upstream request: ${url}`);
        return { ok: true, status: 200, json: async () => data };
    };
    // Pricing math has its own parity suites. These spies lock the authoritative
    // inputs that the server passes to those same browser pricing modules.
    const pricing = {
        quote: (input) => ({ shipping: input.delivery.method === 'ship' ? 10 : 0, input }),
        combinedQuantity: (cart) =>
            cart.reduce((sum, row) => sum + Object.values(row.qty).reduce((a, b) => a + b, 0), 0),
        locationForArtSize: (side, width) => (side === 'front' ? (width > 4 ? 'FF' : 'LC') : 'FB'),
    };
    const ctx = {
        fetch,
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        TDT_PRICING: pricing,
        CTS_PRICING: pricing,
        CAPS_PRICING: pricing,
        STOREFRONT_CHANNEL_CONFIG: channelConfig,
        CTS_SHIPDATE: {},
        TDT_SHIPDATE: {},
    };
    return {
        services: createServices(ctx),
        create: () => createServices(ctx),
        calls,
        failures,
        bundle,
    };
}
const customer = { deliveryMethod: 'ship', state: 'OR', zip: '97201' };
const colors = {
    black: {
        catalogColor: 'Black',
        displayColor: 'Jet Black',
        sizeBreakdown: { S: { quantity: 8 }, FORGED: { quantity: 1000 } },
    },
};
const count = (h, part) => h.calls.filter((c) => c.url.includes(part)).length;

test('construction has no network effects and preserves exact and legacy channel lookup', () => {
    const h = harness();
    assert.equal(h.calls.length, 0);
    assert.equal(h.services.channelConfig('unknown'), h.services.channelConfig('3-day-tees'));
    assert.equal(h.services.channelConfigExact('unknown'), null);
    for (const channel of ['3-day-tees', 'custom-tees', 'custom-caps', 'samples'])
        assert.ok(h.services.channelConfigExact(channel));
});

test('out-of-state tax does not call the tax service; pickup uses the configured home destination', async () => {
    const h = harness();
    assert.equal((await h.services.resolveTdtTax(customer)).rate, 0);
    assert.equal(h.calls.length, 0);
    assert.equal(
        (await h.services.resolveTdtTax({ ...customer, deliveryMethod: 'pickup' })).rate,
        0.102
    );
    assert.deepEqual(h.calls[0].body, { address: '', city: 'Milton', state: 'WA', zip: '98354' });
});

test('WA tax lookup failures remain visible', async () => {
    const h = harness();
    h.failures.add('/api/tax-rates/lookup');
    await assert.rejects(
        h.services.resolveTdtTax({ ...customer, state: 'WA' }),
        /Sales-tax lookup failed/
    );
});

test('inventory cache separates warehouse sources and combines repeated SanMar size rows', async () => {
    const h = harness();
    const sanmar = await h.services.getCtsStock('pc54', false, false);
    assert.equal(sanmar.bySize.get('BLACK|S'), 10);
    assert.equal(await h.services.getCtsStock('PC54', false, false), sanmar);
    const milton = await h.services.getCtsStock('PC54', false, true);
    assert.equal(milton.bySize.get('BLACK|S'), 7);
    assert.equal(h.calls.length, 2);
    await h.services.getCtsStock('PC54', true, true);
    assert.ok(h.calls[2].url.endsWith('?refresh=true'));
});

test('inventory expires after 60 seconds; another service instance has independent cache state', async () => {
    const h = harness(),
        originalNow = Date.now;
    let now = 1000000;
    Date.now = () => now;
    try {
        await h.services.getCtsStock('PC54');
        now += 59999;
        await h.services.getCtsStock('PC54');
        assert.equal(h.calls.length, 1);
        now += 1;
        await h.services.getCtsStock('PC54');
        assert.equal(h.calls.length, 2);
        await h.create().getCtsStock('PC54');
        assert.equal(h.calls.length, 3);
    } finally {
        Date.now = originalNow;
    }
});

test('failed inventory requests are retried instead of cached', async () => {
    const h = harness();
    h.failures.add('/api/sanmar/inventory/');
    await assert.rejects(h.services.getCtsStock('PC54'), /HTTP 503/);
    h.failures.clear();
    assert.equal((await h.services.getCtsStock('PC54')).bySize.get('BLACK|S'), 10);
    assert.equal(h.calls.length, 2);
});

test('tee configuration shares service-code promises across styles but retains each size list', async () => {
    const h = harness();
    const [first, second] = await Promise.all([
        h.services.getCtsPricingConfig('PC54'),
        h.services.getCtsPricingConfig('PC61'),
    ]);
    assert.equal(count(h, '/api/service-codes?code='), 4);
    assert.equal(count(h, '/api/service-codes?category='), 1);
    assert.equal(first.config.saleOff, 2);
    assert.equal(second.config.saleOff, 0);
    assert.deepEqual(plain(first.config.sizes), ['S', 'M']);
    assert.equal(await h.services.getCtsPricingConfig('pc54'), first);
});

test('mandatory service-code failure blocks pricing and evicts the failed promise for retry', async () => {
    const h = harness();
    h.failures.add('code=CTS-SHIP-FLAT');
    await assert.rejects(h.services.getCtsPricingConfig('PC54'), /HTTP 503/);
    h.failures.clear();
    await h.services.getCtsPricingConfig('PC54');
    assert.equal(count(h, 'code=CTS-SHIP-FLAT'), 2);
});

test('configuration expires after five minutes and refreshes fees as well as the bundle', async () => {
    const h = harness(),
        originalNow = Date.now;
    let now = 1000000;
    Date.now = () => now;
    try {
        await h.services.getCtsPricingConfig('PC54');
        now += 299999;
        await h.services.getCtsPricingConfig('PC54');
        assert.equal(count(h, '/api/pricing-bundle'), 1);
        now += 1;
        await h.services.getCtsPricingConfig('PC54');
        assert.equal(count(h, '/api/pricing-bundle'), 2);
        assert.equal(count(h, 'code=3DT-RUSH'), 2);
    } finally {
        Date.now = originalNow;
    }
});

test('custom tees pass only authoritative sizes and re-derived artwork locations to pricing', async () => {
    const h = harness();
    const result = await h.services
        .channelConfig('custom-tees')
        .rebuildQuote(
            colors,
            {
                styleNumber: 'PC54',
                frontLocation: 'LC',
                placement: { front: { wIn: 12, hIn: 12 } },
            },
            customer
        );
    assert.deepEqual(plain(result.quote.input.cart[0].qty), { S: 8 });
    assert.equal(result.quote.input.location, 'FF');
    assert.equal(result.style, 'PC54');
    assert.equal(result.tax.rate, 0);
});

test('custom tees reject unlisted styles and ineligible rush before repricing', async () => {
    const h = harness();
    await assert.rejects(
        h.services
            .channelConfig('custom-tees')
            .rebuildQuote(colors, { styleNumber: 'FAKE' }, customer),
        (e) => e.code === 'STYLE_NOT_ALLOWED'
    );
    await assert.rejects(
        h.services
            .channelConfig('custom-tees')
            .rebuildQuote(colors, { styleNumber: 'PC61', rush: true }, customer),
        (e) => e.code === 'RUSH_NOT_ELIGIBLE'
    );
    assert.equal(count(h, '/api/pricing-bundle'), 0);
});

test('3-Day Tees retain their size whitelist, location and configured flat shipping fallback', async () => {
    const h = harness();
    h.failures.add('/api/shipping/estimate-ups-ground');
    const result = await h.services
        .channelConfig('3-day-tees')
        .rebuildQuote(colors, { printLocationCode: 'FF_FB' }, customer);
    assert.deepEqual(plain(result.quote.input.cart[0].qty), { S: 8 });
    assert.equal(result.quote.input.location, 'FF');
    assert.equal(result.quote.input.backEnabled, true);
    assert.equal(result.shipping.amount, 30);
    assert.equal(result.shipping.source, 'flat');
});

test('3-Day Tees shipping and reprice share the same five-minute pricing cache', async () => {
    const h = harness();
    await h.services.resolveTdtShipping('invalid', 8);
    await h.services
        .channelConfig('3-day-tees')
        .rebuildQuote(colors, {}, { ...customer, deliveryMethod: 'pickup' });
    assert.equal(count(h, '/api/pricing-bundle?method=DTG&'), 1);
});

test('cap repricing accepts only OSFA quantities and interprets the uploaded back-logo flag', async () => {
    const h = harness();
    const caps = {
        black: {
            catalogColor: 'Black',
            sizeBreakdown: { OSFA: { quantity: 8 }, FORGED: { quantity: 999 } },
        },
    };
    const result = await h.services
        .channelConfig('custom-caps')
        .rebuildQuote(
            caps,
            { styleNumber: '112', backLogo: { fileUrl: '/test-file.png' } },
            customer
        );
    assert.equal(result.quote.input.cart[0].quantity, 8);
    assert.equal(result.quote.input.backLogo, true);
    assert.deepEqual(plain(result.sizes), ['OSFA']);
});

test('caps reject rush before calling the pricing APIs', async () => {
    const h = harness();
    await assert.rejects(
        h.services
            .channelConfig('custom-caps')
            .rebuildQuote({}, { styleNumber: '112', rush: true }, customer),
        (e) => e.code === 'RUSH_NOT_ELIGIBLE'
    );
    assert.equal(count(h, '/api/pricing-bundle'), 0);
});
