const assert = require('node:assert/strict');
const createStorefrontPayment = require('../../lib/payments/storefront-payment');
const createQuotePayment = require('../../lib/payments/quote-payment');
const createSamples = require('../../lib/payments/samples-fulfillment');

function harness(kind = 'storefront') {
    const state = {
        status: 'Draft',
        failMarker: false,
        throwMarker: false,
        failFinal: false,
        throwFinal: false,
        failPush: false,
        failLookup: false,
        missing: false,
        notes: '{}',
    };
    const calls = [],
        alerts = [],
        ledger = [],
        receipts = [];
    const session = {
        id: 'cs_test_payment',
        amount_total: 1200,
        payment_intent: 'pi_test_payment',
        customer_email: 'test@example.invalid',
    };
    const row = {
        QuoteID: 'TEST-PAYMENT',
        PK_ID: 42,
        CustomerDataJSON: '{}',
        ColorConfigsJSON: '{}',
        OrderTotalsJSON: '{}',
        OrderSettingsJSON: JSON.stringify({
            samples: [{ type: 'paid', style: 'PC54', quantity: 1 }],
        }),
    };
    const ctx = {
        CASPIO_PROXY_BASE: 'https://proxy.example.test',
        TDT_PROXY: 'https://proxy.example.test',
        CRM_API_SECRET: 'test-credential',
        INTERNAL_CALL_KEY: 'test-internal',
        PORT: 3999,
        withProxySecret: (headers = {}) => ({ ...headers, 'X-CRM-API-Secret': 'test-credential' }),
        fetchQuoteSessionRow: async () => {
            if (state.failLookup) throw new Error('Lookup unavailable');
            return state.missing ? null : { ...row, Status: state.status, Notes: state.notes };
        },
        fetch: async (url, options = {}) => {
            const body = options.body ? JSON.parse(options.body) : {};
            calls.push({ url, method: options.method, headers: options.headers, body });
            if (options.method === 'PUT') {
                const marker = body.Status === 'Payment Confirmed';
                const final = body.Status === 'Processed';
                if ((marker && state.throwMarker) || (final && state.throwFinal))
                    throw new Error('Write transport unavailable');
                const authenticated = options.headers?.['X-CRM-API-Secret'] === 'test-credential';
                const ok =
                    authenticated &&
                    !(marker && state.failMarker) &&
                    !(final && state.failFinal) &&
                    !(body.Notes && !body.Status && state.failNotes);
                if (ok) {
                    if (body.Status) state.status = body.Status;
                    if (body.Notes) state.notes = body.Notes;
                }
                return { ok, status: ok ? 200 : 503, json: async () => ({}) };
            }
            if (url.includes('/orders/create') || url.includes('/submit-3day-order'))
                return {
                    ok: !state.failPush,
                    status: state.failPush ? 502 : 200,
                    json: async () => ({ success: !state.failPush, orderNumber: 'TEST-WO' }),
                };
            throw new Error(`Unexpected upstream ${url}`);
        },
        computeOrderStatusToken: () => null,
        sendOrderConfirmationEmails: async () => ({ customerOk: false, salesOk: false }),
        recordOrderPayment: (entry) => ledger.push(entry),
        sendQuotePaymentEmails: (quote, payment) => receipts.push(payment),
        parseNotesJson: JSON.parse,
        alert3DT: (message) => alerts.push(message),
        alertQuotePay: (message) => alerts.push(message),
        sendEmailJSTemplate: async () => {},
        channelConfig: () => ({
            push: { serviceBanner: () => '' },
            emails: { confirmationSalesTemplate: 'test-template' },
        }),
        buildSamplesPushPayload: () => ({ test: true }),
        nowPacificNaiveIso: () => '2026-09-07T12:00:00',
    };
    ctx.handleSamplesOrderPaid = createSamples(ctx).handleSamplesOrderPaid;
    const storefront = createStorefrontPayment(ctx),
        quote = createQuotePayment(ctx);
    async function invoke() {
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
            send(data) {
                this.data = data;
                return this;
            },
        };
        // The raw webhook dispatcher awaits the selected stage inside its catch.
        // SDK contract tests separately verify the real signed HTTP dispatch.
        try {
            if (kind === 'storefront') await storefront(session, row.QuoteID, res);
            else
                await quote(
                    session,
                    row.QuoteID,
                    { kind: kind === 'samples' ? 'samples-order' : kind },
                    res
                );
        } catch (_) {
            res.status(500).send('Webhook processing failed');
        }
        await Promise.resolve();
        return res;
    }
    return {
        state,
        calls,
        alerts,
        ledger,
        receipts,
        session,
        invoke,
        pushes: () =>
            calls.filter(
                (c) => c.url.includes('/orders/create') || c.url.includes('/submit-3day-order')
            ),
    };
}

for (const kind of ['storefront', 'samples']) {
    test(`${kind}: successful fulfillment authenticates every write and redelivery does not push again`, async () => {
        const h = harness(kind);
        assert.equal((await h.invoke()).statusCode, 200);
        assert.equal(h.state.status, 'Processed');
        assert.equal(h.pushes().length, 1);
        for (const call of h.calls.filter((c) => c.method === 'PUT'))
            assert.equal(call.headers['X-CRM-API-Secret'], 'test-credential');
        assert.equal(h.ledger.length, 1);
        assert.equal(h.ledger[0].amount, 12);
        assert.equal((await h.invoke()).data.status, 'duplicate');
        assert.equal(h.pushes().length, 1);
    });
    test(`${kind}: rejected payment marker stops fulfillment and succeeds on a later retry`, async () => {
        const h = harness(kind);
        h.state.failMarker = true;
        assert.equal((await h.invoke()).statusCode, 503);
        assert.equal(h.pushes().length, 0);
        assert.equal(h.ledger.length, 0);
        h.state.failMarker = false;
        assert.equal((await h.invoke()).statusCode, 200);
        assert.equal(h.pushes().length, 1);
        assert.equal(h.state.status, 'Processed');
    });
    test(`${kind}: marker transport failure produces a retryable error without a push`, async () => {
        const h = harness(kind);
        h.state.throwMarker = true;
        assert.equal((await h.invoke()).statusCode, 500);
        assert.equal(h.pushes().length, 0);
        assert.equal(h.ledger.length, 0);
    });
    for (const failure of ['failFinal', 'throwFinal'])
        test(`${kind}: ${failure} after a successful push is acknowledged and flagged without labeling the push failed`, async () => {
            const h = harness(kind);
            h.state[failure] = true;
            assert.equal((await h.invoke()).statusCode, 200);
            assert.equal(h.pushes().length, 1);
            assert.equal(h.state.status, 'Payment Confirmed');
            assert.ok(h.alerts.some((a) => a.includes('pushed to ShopWorks OK')));
            assert.ok(!h.alerts.some((a) => a.includes('NEEDS MANUAL PUSH')));
            assert.equal((await h.invoke()).data.status, 'stuck-payment-confirmed');
            assert.equal(h.pushes().length, 1);
        });
    test(`${kind}: actual push rejection flags the record through an authenticated write and acknowledges the paid event`, async () => {
        const h = harness(kind);
        h.state.failPush = true;
        assert.equal((await h.invoke()).statusCode, 200);
        assert.equal(h.state.status, 'Payment Confirmed - ShopWorks Failed');
        assert.ok(h.alerts.some((a) => a.includes('NEEDS MANUAL PUSH')));
        assert.equal((await h.invoke()).data.status, 'duplicate');
        assert.equal(h.pushes().length, 1);
    });
    test(`${kind}: lookup failure is retryable and a missing record raises an alert without writes`, async () => {
        const h = harness(kind);
        h.state.failLookup = true;
        assert.equal((await h.invoke()).statusCode, 503);
        assert.equal(h.calls.length, 0);
        h.state.failLookup = false;
        h.state.missing = true;
        assert.equal((await h.invoke()).data.status, 'no-record');
        assert.equal(h.calls.length, 0);
        assert.ok(h.alerts.length > 0);
    });
}

test('deposit payment records actual money once and never invokes order fulfillment', async () => {
    const h = harness('deposit');
    assert.equal((await h.invoke()).data.status, 'quote-payment-recorded');
    assert.equal(h.pushes().length, 0);
    assert.equal(h.ledger.length, 1);
    assert.equal(h.receipts.length, 1);
    assert.equal(JSON.parse(h.state.notes).payments[0].amount, 12);
    assert.equal((await h.invoke()).data.status, 'duplicate');
    assert.equal(h.ledger.length, 1);
});

test('a failed deposit record write requests retry before ledger or receipt work', async () => {
    const h = harness('deposit');
    h.state.failNotes = true;
    assert.equal((await h.invoke()).statusCode, 503);
    assert.equal(h.ledger.length, 0);
    assert.equal(h.receipts.length, 0);
    assert.equal(h.pushes().length, 0);
});

test('unknown payment kinds are acknowledged and flagged without writing or fulfilling an order', async () => {
    const h = harness('unknown-kind');
    assert.equal((await h.invoke()).data.status, 'unknown-kind');
    assert.equal(h.calls.length, 0);
    assert.ok(h.alerts.some((a) => a.includes('unknown metadata.kind')));
});
