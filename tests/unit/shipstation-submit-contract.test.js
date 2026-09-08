const assert = require('node:assert/strict');
const register = require('../../routes/quote-sync');

function harness() {
    const row = {
        QuoteID: 'OF-TEST',
        PK_ID: 42,
        Status: 'Processed',
        CompanyName: 'Test Co',
        CustomerName: 'Test Buyer',
        CustomerEmail: 'buyer@example.test',
        Phone: '555-0100',
        TotalAmount: 72,
        TaxAmount: 7.2,
        ShopWorks_Order_Number: 123,
        Notes: JSON.stringify({
            info: {
                dateIn: '2026-09-07',
                companyId: 99,
                name: 'Test Buyer',
                company: 'Test Co',
                orderNotes: 'Test instructions',
                methodNotesBlock: 'DTG · Left Chest · Tier 24',
                isRush: true,
            },
            ship: {
                method: 'Priority Mail',
                address1: 'Test Receiver',
                address2: '123 Main St',
                city: 'Milton',
                state: 'WA',
                zip: '98354',
            },
            designNumbers: [12],
            rows: [{ style: 'PC54', color: 'Black', sizes: { m: 3 }, unitPrice: 24 }],
        }),
        ShopWorks_Snapshot: JSON.stringify({
            order: {
                id_Order: 123,
                id_Customer: 99,
                cur_TotalInvoice: 79.2,
                cur_SalesTaxTotal: 7.2,
            },
            lineItems: [
                {
                    PartNumber: 'PC54',
                    PartColor: 'Black',
                    PartDescription: 'Test Tee',
                    LineQuantity: 1,
                    LineUnitPrice: 24,
                    Size01: 1,
                },
                { PartNumber: 'PC54_2X', PartColor: 'Black', LineQuantity: 2, LineUnitPrice: 26 },
            ],
        }),
    };
    const state = {
        row,
        missing: false,
        lookupFail: false,
        writeFail: false,
        inventoryStatus: 200,
        inventoryEmpty: false,
        inventoryThrow: false,
        weight: 0.5,
        contactFail: false,
        pushes: [],
    };
    const calls = [],
        writes = [],
        registered = new Map();
    const staffGate = (req, res, next) =>
        req.session?.crmUser ? next() : res.status(401).json({ error: 'Unauthorized' });
    const ctx = {
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        CRM_API_SECRET: 'test-only',
        requireStaff: staffGate,
        sanitizeFilterInput: String,
        withProxySecret: (headers = {}) => ({ ...headers, 'X-CRM-API-Secret': 'test-only' }),
        makeApiRequest: async (url, method, body) => {
            if (method === 'PUT') {
                writes.push({ url, body });
                if (state.writeFail) throw Error('Bookkeeping unavailable');
                Object.assign(row, body);
                return { success: true };
            }
            if (state.lookupFail) throw Error('Lookup unavailable');
            return state.missing ? [] : [{ ...row }];
        },
        fetch: async (url, options = {}) => {
            const body = options.body ? JSON.parse(options.body) : undefined;
            calls.push({ url, options, body });
            if (url.includes('/company-contacts/')) {
                if (state.contactFail) throw Error('Contacts unavailable');
                return {
                    ok: true,
                    json: async () => ({
                        contacts: [
                            { ct_NameFull: 'No address' },
                            {
                                Has_Complete_Address: true,
                                ct_NameFull: 'Billing Person',
                                Company_Name: 'Billing Co',
                                Address: '456 Billing St',
                                City: 'Tacoma',
                                State: 'WA',
                                Zip: '98402',
                                Phone_Best: '555-0199',
                            },
                        ],
                    }),
                };
            }
            if (url.includes('/inventory?')) {
                if (state.inventoryThrow) throw Error('Inventory unavailable');
                return {
                    ok: state.inventoryStatus === 200,
                    status: state.inventoryStatus,
                    json: async () =>
                        state.inventoryEmpty
                            ? []
                            : [
                                  {
                                      PIECE_WEIGHT: state.weight,
                                      COLOR_PRODUCT_IMAGE: 'https://images.example.test/black.jpg',
                                  },
                              ],
                };
            }
            if (url.endsWith('/shipstation/create-order')) {
                const next = state.pushes.shift() || { status: 200, success: true };
                return {
                    ok: next.status >= 200 && next.status < 300,
                    status: next.status,
                    json: async () => ({
                        success: next.success,
                        shipstationOrderId: 987,
                        error: next.success ? undefined : 'Rejected',
                        details: next.details,
                    }),
                };
            }
            throw Error('Unexpected upstream ' + url);
        },
    };
    const app = Object.fromEntries(
        ['get', 'post', 'put', 'delete'].map((method) => [
            method,
            (url, ...chain) => registered.set(method + ' ' + url, chain),
        ])
    );
    register(app, ctx);
    async function invoke(body = {}) {
        const req = {
            params: { quoteId: 'OF-TEST' },
            query: {},
            body,
            session: { crmUser: { email: 'staff@example.test' } },
        };
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.data = data;
                return this;
            },
        };
        const chain = registered.get('post /api/quote-sessions/:quoteId/send-to-shipstation');
        assert.equal(chain[0], staffGate);
        await chain[1](req, res);
        return res;
    }
    const resetSent = () => {
        delete row.ShipStation_Order_ID;
        delete row.ShipStation_Status;
    };
    const setMethod = (method) => {
        const notes = JSON.parse(row.Notes);
        notes.ship.method = method;
        row.Notes = JSON.stringify(notes);
    };
    return {
        state,
        row,
        calls,
        writes,
        invoke,
        resetSent,
        setMethod,
        pushes: () => calls.filter((c) => c.url.endsWith('/shipstation/create-order')),
        inventoryCalls: () => calls.filter((c) => c.url.includes('/inventory?')),
    };
}

test('ShipStation payload uses grouped sizes, authoritative weight, billing contact and distinct display/idempotency identifiers', async () => {
    const h = harness();
    const res = await h.invoke();
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.shipstationOrderId, 987);
    assert.equal(h.pushes().length, 1);
    const { body, options } = h.pushes()[0];
    assert.equal(options.headers['X-CRM-API-Secret'], 'test-only');
    assert.equal(body.orderNumber, 'WO 123');
    assert.equal(body.orderKey, 'OF-TEST');
    assert.equal(body.orderDate, '2026-09-07T00:00:00.000Z');
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].sku, 'PC54');
    assert.equal(body.items[0].quantity, 3);
    assert.equal(body.items[0].unitPrice, 24);
    assert.equal(body.items[0].options.find((o) => o.name === 'Sizes').value, 'S:1, 2XL:2');
    assert.equal(body.items[0].imageUrl, 'https://images.example.test/black.jpg');
    assert.equal(body.items[0]._weightPerPieceOz, undefined);
    assert.equal(body.items[0]._colorForImage, undefined);
    assert.deepEqual(body.weight, { value: 24, units: 'ounces' });
    assert.equal(body.billTo.name, 'Billing Person');
    assert.equal(body.shipTo.name, 'Test Receiver');
    assert.equal(body.shipTo.street1, '123 Main St');
    assert.equal(body.carrierCode, 'stamps_com');
    assert.equal(body.serviceCode, 'usps_priority_mail');
    assert.equal(body.amountPaid, 79.2);
    assert.equal(body.advancedOptions.customField2, 'Design # 12');
    assert.equal(
        h.calls.find((c) => c.url.includes('/company-contacts/')).options.headers[
            'X-CRM-API-Secret'
        ],
        'test-only'
    );
    assert.equal(h.writes[0].url, '/quote_sessions/42');
    assert.equal(h.writes[0].body.ShipStation_Order_ID, 987);
    assert.equal((await h.invoke()).data.alreadySent, true);
    assert.equal(h.pushes().length, 1);
});
test.each([
    ['Customer Pickup', 'pickup'],
    ['WillCall', 'pickup'],
    ['UPS Ground', 'ups-uses-worldship'],
    ['FedEx Ground', 'fedex-not-configured'],
])('shipping method %s skips before stale already-sent state', async (method, reason) => {
    const h = harness();
    h.setMethod(method);
    h.row.ShipStation_Order_ID = 987;
    assert.equal((await h.invoke()).data.reason, reason);
    assert.equal(h.calls.length, 0);
    assert.equal(h.writes.length, 0);
});
test('staff override routes a UPS order to USPS and records the original selection', async () => {
    const h = harness();
    h.setMethod('UPS Ground');
    await h.invoke({ overrideShipMethod: 'Priority Mail' });
    const body = h.pushes()[0].body;
    assert.equal(body.carrierCode, 'stamps_com');
    assert.ok(body.internalNotes.includes('UPS Ground → Priority Mail'));
});
test('unknown shipping preferences remain hints without an unconfigured carrier preset', async () => {
    const h = harness();
    h.setMethod('Warehouse choice');
    await h.invoke();
    const body = h.pushes()[0].body;
    assert.equal(body.requestedShippingService, 'Warehouse choice');
    assert.equal(body.carrierCode, undefined);
    assert.equal(body.serviceCode, undefined);
});
test('pushed ShopWorks shipping data takes precedence over the original form', async () => {
    const h = harness();
    h.setMethod('UPS Ground');
    const snap = JSON.parse(h.row.ShopWorks_Snapshot);
    snap.pushed = {
        ShippingAddresses: [
            {
                ShipMethod: 'Priority Mail',
                ShipAddress01: 'Other Recipient',
                ShipAddress02: '987 Other Rd',
                ShipCity: 'Seattle',
                ShipState: 'WA',
                ShipZip: '98101',
            },
        ],
    };
    h.row.ShopWorks_Snapshot = JSON.stringify(snap);
    await h.invoke();
    const body = h.pushes()[0].body;
    assert.equal(body.shipTo.name, 'Other Recipient');
    assert.equal(body.shipTo.street1, '987 Other Rd');
});
test('pre-import quotes use original rows and fall back to the quote display number', async () => {
    const h = harness();
    delete h.row.ShopWorks_Order_Number;
    delete h.row.ShopWorks_Snapshot;
    await h.invoke();
    const body = h.pushes()[0].body;
    assert.equal(body.orderNumber, 'OF-TEST');
    assert.equal(body.items[0].quantity, 3);
    assert.equal(body.items[0].options.find((o) => o.name === 'Sizes').value, 'M:3');
    assert.equal(body.amountPaid, 79.2);
});
test.each([null, 0, 12.5, 'bad'])(
    'invalid per-piece weight %s uses the existing garment estimate',
    async (weight) => {
        const h = harness();
        h.state.weight = weight;
        await h.invoke();
        assert.equal(h.pushes()[0].body.weight.value, 17);
    }
);
test('missing records and lookup failures do not reach ShipStation', async () => {
    const h = harness();
    h.state.missing = true;
    assert.equal((await h.invoke()).statusCode, 404);
    h.state.missing = false;
    h.state.lookupFail = true;
    assert.equal((await h.invoke()).statusCode, 500);
    assert.equal(h.calls.length, 0);
});
test('a deleted-order key retries once with a distinct key and then records success', async () => {
    const h = harness();
    h.state.pushes = [
        { status: 404, success: false },
        { status: 200, success: true },
    ];
    assert.equal((await h.invoke()).data.success, true);
    assert.equal(h.pushes().length, 2);
    assert.equal(h.pushes()[0].body.orderKey, 'OF-TEST');
    assert.match(h.pushes()[1].body.orderKey, /^OF-TEST-r\d+$/);
    assert.equal(h.pushes()[1].body._retried, true);
    assert.equal(h.writes.length, 1);
});
test.each([404, 502, 200])(
    'push rejection HTTP %s stays visible and never writes successful bookkeeping',
    async (status) => {
        const h = harness();
        h.state.pushes = [
            { status, success: false },
            { status, success: false },
        ];
        const res = await h.invoke();
        assert.equal(res.statusCode, status);
        assert.equal(res.data.success, false);
        assert.equal(h.pushes().length, status === 404 ? 2 : 1);
        assert.equal(h.writes.length, 0);
    }
);
test('a bookkeeping outage after successful delivery is acknowledged without another push', async () => {
    const h = harness();
    h.state.writeFail = true;
    const res = await h.invoke();
    assert.equal(res.data.success, true);
    assert.equal(h.pushes().length, 1);
    assert.equal(h.writes.length, 1);
});
test('contact lookup failure falls back to the original billing identity', async () => {
    const h = harness();
    h.state.contactFail = true;
    await h.invoke();
    assert.equal(h.pushes()[0].body.billTo.name, 'Test Buyer');
});
test('product metadata shares a 24-hour cache; failed lookups retry after one minute', async () => {
    const real = Date.now;
    let now = 2000000000000;
    Date.now = () => now;
    try {
        const h = harness();
        await h.invoke();
        h.resetSent();
        await h.invoke();
        assert.equal(h.inventoryCalls().length, 1);
        now += 24 * 60 * 60 * 1000 + 1;
        h.resetSent();
        h.state.inventoryStatus = 503;
        await h.invoke();
        assert.equal(h.inventoryCalls().length, 2);
        h.resetSent();
        await h.invoke();
        assert.equal(h.inventoryCalls().length, 2);
        now += 60001;
        h.resetSent();
        h.state.inventoryStatus = 200;
        await h.invoke();
        assert.equal(h.inventoryCalls().length, 3);
    } finally {
        Date.now = real;
    }
});
test('metadata transport failures are not cached and do not stop shipping', async () => {
    const h = harness();
    h.state.inventoryThrow = true;
    assert.equal((await h.invoke()).data.success, true);
    h.resetSent();
    h.state.inventoryThrow = false;
    assert.equal((await h.invoke()).data.success, true);
    assert.equal(h.inventoryCalls().length, 2);
});
