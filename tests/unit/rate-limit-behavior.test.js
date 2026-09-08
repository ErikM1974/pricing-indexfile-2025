const express = require('express');
const { rateLimit, MemoryStore } = require('express-rate-limit');
const { rateLimitOptions } = require('../helpers/server-source');


async function withLimiter(name, run) {
    const app = express();
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        if (req.get('x-test-staff') === 'yes') req.session = { crmUser: { email: 'staff@example.test' } };
        next();
    });
    const store = new MemoryStore();
    const options = rateLimitOptions(name);
    // Shorten only the quota for the high-volume quote limiter; retain its real skip callback.
    if (name === 'quoteSequenceLimiter') options.limit = 1;
    app.use('/api', rateLimit({ ...options, store }));
    app.get('/api/probe', (req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/probe`;
    const request = async (ip, staff = false) => {
        const response = await fetch(url, { headers: { 'X-Forwarded-For': ip, ...(staff ? { 'x-test-staff': 'yes' } : {}) } });
        await response.text();
        return response.status;
    };
    try { await run(request); }
    finally {
        store.shutdown();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

test('customer login quota rejects the sixth IPv4 request and isolates other clients', async () => {
    await withLimiter('customerLoginLimiter', async request => {
        for (let i = 0; i < 5; i++) expect(await request('198.51.100.1')).toBe(200);
        expect(await request('198.51.100.1')).toBe(429);
        expect(await request('198.51.100.2')).toBe(200);
    });
});

test('rotating IPv6 addresses within a /56 cannot bypass the login quota', async () => {
    await withLimiter('customerLoginLimiter', async request => {
        for (let i = 0; i < 5; i++) expect(await request(`2001:db8:1234:56${i}0::1`)).toBe(200);
        expect(await request('2001:db8:1234:56ff::2')).toBe(429);
        expect(await request('2001:db8:1234:5700::1')).toBe(200);
    });
});

test('quote sequence quota still exempts an authenticated staff session', async () => {
    await withLimiter('quoteSequenceLimiter', async request => {
        expect(await request('198.51.100.3')).toBe(200);
        expect(await request('198.51.100.3')).toBe(429);
        expect(await request('198.51.100.3', true)).toBe(200);
    });
});
