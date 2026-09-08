const vm = require('vm');
const express = require('express');
const espree = require('espree');
const Stripe = require('stripe');
const createStripeClient = require('../../lib/stripe-client');
const { serverSource } = require('../helpers/server-source');
const SECRET = 'whsec_unit_test_only';
const KEY = 'sk_test_unit_test_only';

function webhookApp() {
    const source = serverSource();
    const ast = espree.parse(source, { ecmaVersion: 'latest', range: true });
    const route = ast.body.find(n => n.type === 'ExpressionStatement'
        && n.expression.callee?.object?.name === 'app'
        && n.expression.callee?.property?.name === 'post'
        && n.expression.arguments[0]?.value === '/api/stripe/webhook');
    if (!route) throw new Error('Missing production webhook registration');
    const app = express();
    const lookup = jest.fn();
    const samples = jest.fn((session, quoteID, res) => res.json({ received: true, channel: 'samples', quoteID }));
    const unexpectedWrite = jest.fn(() => { throw new Error('Unexpected external write'); });
    vm.runInNewContext(source.slice(...route.range), {
        app, express, stripe: createStripeClient,
        process: { env: { STRIPE_MODE: 'development', STRIPE_TEST_SECRET_KEY: KEY, STRIPE_WEBHOOK_SECRET_TEST: SECRET } },
        console: { log() {}, warn() {}, error() {} },
        fetchQuoteSessionRow: lookup, handleSamplesOrderPaid: samples,
        parseNotesJson: JSON.parse, fetch: unexpectedWrite,
        alertQuotePay: unexpectedWrite, alert3DT: unexpectedWrite,
    });
    return { app, lookup, samples, unexpectedWrite };
}

async function deliver(metadata, setup = () => {}, tamper = false) {
    const harness = webhookApp();
    setup(harness);
    const payload = JSON.stringify({ id: 'evt_test_unit', type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_unit', amount_total: 100, metadata } } });
    const signature = createStripeClient(KEY).webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const server = harness.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stripe/webhook`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
            body: tamper ? payload + ' ' : payload,
        });
        return { ...harness, status: response.status, body: await response.text() };
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

test('checkout create/retrieve/expire keep the prior Stripe API contract and amount encoding', async () => {
    const sent = [];
    const client = createStripeClient(KEY, {
        httpClient: Stripe.createFetchHttpClient(async (url, init) => {
            sent.push({ url, method: init.method, headers: new Headers(init.headers), body: init.body });
            return new Response(JSON.stringify({ id: 'cs_test_unit', object: 'checkout.session' }), {
                headers: { 'content-type': 'application/json' },
            });
        }),
    });
    await client.checkout.sessions.create({ mode: 'payment', success_url: 'https://example.test/success',
        line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Test' }, unit_amount: 1234 }, quantity: 2 }],
        metadata: { quoteID: 'TEST-1', kind: 'deposit' } });
    await client.checkout.sessions.retrieve('cs_test_unit');
    await client.checkout.sessions.expire('cs_test_unit');
    expect(sent).toHaveLength(3);
    for (const request of sent) expect(request.headers.get('stripe-version')).toBe('2025-10-29.clover');
    expect(new URLSearchParams(sent[0].body).get('line_items[0][price_data][unit_amount]')).toBe('1234');
    expect(new URLSearchParams(sent[0].body).get('metadata[kind]')).toBe('deposit');
    expect(sent[1].method).toBe('GET');
    expect(sent[2].url).toMatch(/\/checkout\/sessions\/cs_test_unit\/expire$/);
    expect(sent[2].method).toBe('POST');
});

test('a changed raw webhook body fails authentication before lookup or dispatch', async () => {
    const result = await deliver({ quoteID: 'TEST-1', kind: 'samples-order' }, undefined, true);
    expect(result.status).toBe(400);
    expect(result.lookup).not.toHaveBeenCalled();
    expect(result.samples).not.toHaveBeenCalled();
    expect(result.unexpectedWrite).not.toHaveBeenCalled();
});

test('a valid signed samples event reaches the samples handler only', async () => {
    const result = await deliver({ quoteID: 'TEST-1', kind: 'samples-order' });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).channel).toBe('samples');
    expect(result.samples).toHaveBeenCalledTimes(1);
    expect(result.lookup).not.toHaveBeenCalled();
    expect(result.unexpectedWrite).not.toHaveBeenCalled();
});

test('a failed quote lookup requests a webhook retry without recording payment', async () => {
    const result = await deliver({ quoteID: 'TEST-1', kind: 'deposit' }, ({ lookup }) => {
        lookup.mockRejectedValue(new Error('Upstream unavailable'));
    });
    expect(result.status).toBe(503);
    expect(result.unexpectedWrite).not.toHaveBeenCalled();
});

test('a redelivered deposit is acknowledged without recording payment twice', async () => {
    const result = await deliver({ quoteID: 'TEST-1', kind: 'deposit' }, ({ lookup }) => {
        lookup.mockResolvedValue({ Notes: JSON.stringify({ payments: [{ stripeSessionId: 'cs_test_unit' }] }) });
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).status).toBe('duplicate');
    expect(result.unexpectedWrite).not.toHaveBeenCalled();
});
