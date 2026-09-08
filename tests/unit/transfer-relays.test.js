const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { Readable } = require('node:stream');
const express = require('express');
const register = require('../../routes/transfers');
const root = path.join(__dirname, '../..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const requireStaff = vm.runInNewContext('(' + serverSource.match(/function requireStaff\([^]*?\n\}/)[0] + ')');
const forward = jest.fn();
let server, base, configuredSecret = 'relay-test-secret';
const staff = { 'x-test-staff': '1', 'Content-Type': 'application/json' };
const moduleSource = fs.readFileSync(path.join(root, 'routes/transfers.js'), 'utf8');
const routes = [...moduleSource.matchAll(/app\.(get|post|put|delete)\('([^']+)'/g)].map(match => [match[1].toUpperCase(), match[2]]);

beforeAll(done => {
    const app = express();
    app.use((req, res, next) => { if (req.headers['x-test-staff']) req.session = { crmUser: { email: 'fixture@example.test' } }; next(); });
    const visionParser = serverSource.split('\n').find(line => line.startsWith("app.use(['/api/vision/extract-supacolor'"));
    const globalParser = serverSource.split('\n').find(line => line.startsWith('app.use(bodyParser.json('));
    expect(visionParser).toContain('requireStaff');
    expect(serverSource.indexOf(visionParser)).toBeLessThan(serverSource.indexOf(globalParser));
    vm.runInNewContext(visionParser + '\n' + globalParser, { app, requireStaff, bodyParser: require('body-parser') });
    // Re-register for each request so configuration scenarios exercise the real
    // module's missing-secret refusal without changing the production interface.
    app.use((req, res, next) => {
        const router = express.Router();
        register(router, { CRM_API_BASE: 'https://proxy.example.test', CRM_API_SECRET: configuredSecret, fetch: forward, requireStaff });
        router(req, res, next);
    });
    server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
beforeEach(() => {
    configuredSecret = 'relay-test-secret'; forward.mockReset();
    forward.mockResolvedValue({ status: 200, headers: new Headers({ 'content-type': 'application/json' }), text: async () => '{"success":true}' });
});

test.each(routes)('%s %s requires a staff session before forwarding', async (method, route) => {
    const url = route.replace(':id', '101').replace(':jobNumber', '900001');
    const response = await fetch(base + url, { method, headers: { Origin: 'https://teamnwca.com', 'X-CRM-API-Secret': 'browser-spoof' } });
    expect(response.status).toBe(401); expect(forward).not.toHaveBeenCalled();
});

test('staff transfer filters are allowlisted and credentials stay server-side', async () => {
    const response = await fetch(base + '/api/transfer-orders?supacolorOrderNumber=900001&includeLineCount=true&orderBy=Requested_At%20DESC&q.where=1%3D1&url=https://elsewhere.test', { headers: staff });
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain(configuredSecret);
    const [target, options] = forward.mock.calls[0];
    expect(target).toBe('https://proxy.example.test/api/transfer-orders?supacolorOrderNumber=900001&orderBy=Requested_At+DESC&includeLineCount=true');
    expect(options.headers).toEqual({ 'X-CRM-API-Secret': configuredSecret });
    expect(options.redirect).toBe('error');
});

test.each([
    ['PUT', '/api/transfer-orders/ST-260908-0001/status'],
    ['POST', '/api/transfer-order-notes'],
    ['POST', '/api/supacolor-jobs/101/history/replace'],
    ['DELETE', '/api/transfer-orders/ST-260908-0001?hard=true'],
])('%s %s forwards the method and body after authentication', async (method, endpoint) => {
    const body = JSON.stringify({ Status: 'Ordered', Author_Name: 'Fixture staff', Note_Text: 'Fixture note' });
    expect((await fetch(base + endpoint, { method, headers: staff, body })).status).toBe(200);
    expect(forward).toHaveBeenCalledWith('https://proxy.example.test' + endpoint, expect.objectContaining({ method, body,
        headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': configuredSecret } }));
});

test.each(['/api/transfer-orders/has%20spaces', '/api/supacolor-jobs/not-a-number', '/api/supacolor-jobs/by-number/a%2Fb'])('invalid route parameter %s is refused without fetching', async endpoint => {
    expect((await fetch(base + endpoint, { headers: staff })).status).toBe(400);
    expect(forward).not.toHaveBeenCalled();
});

test('upstream failures preserve their status and body; transport failure is visible', async () => {
    forward.mockResolvedValueOnce({ status: 429, headers: new Headers({ 'content-type': 'application/json' }), text: async () => '{"error":"Try later"}' });
    const response = await fetch(base + '/api/supacolor-jobs', { headers: staff });
    expect(response.status).toBe(429); expect(await response.json()).toEqual({ error: 'Try later' });
    forward.mockRejectedValueOnce(new Error('fixture connection failed'));
    expect((await fetch(base + '/api/supacolor-jobs', { headers: staff })).status).toBe(502);
});

test('missing relay configuration fails without contacting the proxy', async () => {
    configuredSecret = '';
    expect((await fetch(base + '/api/supacolor-jobs', { headers: staff })).status).toBe(503);
    expect(forward).not.toHaveBeenCalled();
});

test('a job-number parameter cannot become the scheduler-only full sync path', async () => {
    expect((await fetch(base + '/api/supacolor-jobs/sync/all', { method: 'POST', headers: staff, body: '{}' })).status).toBe(400);
    expect(forward).not.toHaveBeenCalled();
});

test('image downloads preserve bytes and attachment headers without compressed metadata', async () => {
    const bytes = Buffer.from([137, 80, 78, 71, 0, 255]);
    forward.mockResolvedValueOnce({ status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-disposition': 'attachment; filename="fixture.png"', 'content-length': '999', 'content-encoding': 'gzip' }), body: Readable.from([bytes]) });
    const response = await fetch(base + '/api/supacolor-jobs/proxy-image?url=https%3A%2F%2Fcdn.supacolor.com%2Ffixture.png&name=fixture', { headers: staff });
    expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="fixture.png"');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).not.toBe('999');
    expect(response.headers.get('cache-control')).toBe('no-store');
});

test('vision relay preserves the proxy upload limit and authenticates before parsing', async () => {
    const endpoint = base + '/api/vision/extract-supacolor-job-detail';
    expect((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status).toBe(401);
    expect(forward).not.toHaveBeenCalled();
    const body = JSON.stringify({ image: 'a'.repeat(6 * 1024 * 1024) });
    expect((await fetch(endpoint, { method: 'POST', headers: staff, body })).status).toBe(200);
    expect(forward.mock.calls[0][1].body).toBe(body);
    forward.mockClear();
    expect((await fetch(endpoint, { method: 'POST', headers: staff, body: JSON.stringify({ image: 'a'.repeat(11 * 1024 * 1024) }) })).status).toBe(413);
    expect((await fetch(endpoint, { method: 'POST', headers: staff, body: '{invalid' })).status).toBe(400);
    expect(forward).not.toHaveBeenCalled();
});

test('the shared transfer helper uses staff relays while keeping other configured services', async () => {
    const client = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, records: [], record: {} }) });
    const window = { APP_CONFIG: { API: { BASE_URL: 'https://proxy.example.test' }, EMAIL: { SERVICE_ID: 'fixture', PUBLIC_KEY: 'fixture' } }, location: { hostname: 'test.example', origin: 'https://app.example.test', search: '' } };
    const text = fs.readFileSync(path.join(root, 'shared_components/js/transfer-actions-shared.js'), 'utf8');
    vm.runInNewContext(text, { window, fetch: client, URLSearchParams, console, document: { addEventListener() {} }, localStorage: { getItem() { return null; } } });
    await window.TransferActions.getTransferForMockup('101');
    expect(client.mock.calls[0][0]).toBe('/api/transfer-orders?mockupId=101&pageSize=10');
    await window.TransferActions.getTransferById('ST-260908-0001');
    expect(client.mock.calls[1][0]).toBe('/api/transfer-orders/ST-260908-0001');
    expect(text).toContain('resolveBoxUrl(API_BASE + f.thumbnailUrl)');
});

test('all six browser controllers use same-origin workflow requests without embedded secrets', () => {
    for (const file of ['dashboards/js/bradley-transfers.js', 'dashboards/js/bradley-screenprint.js', 'dashboards/js/supacolor-orders.js', 'pages/js/transfer-detail.js', 'pages/js/supacolor-job-detail.js', 'shared_components/js/transfer-actions-shared.js']) {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        expect(text).not.toMatch(/API_BASE\s*\+\s*['"]\/api\/(?:transfer-order|supacolor-job|vision\/extract-supacolor)/);
        expect(text).not.toContain('X-CRM-API-Secret');
    }
});

describe('vendor notes keep their own session and ownership boundary', () => {
    const upstream = jest.fn();
    let vendorServer, vendorBase;
    let record;
    beforeAll(done => {
        const source = fs.readFileSync(path.join(root, 'routes/vendor-portal.js'), 'utf8');
        const app = express(); app.use(express.json());
        app.use((req, res, next) => {
            if (req.headers['x-test-vendor']) req.vendorSession = { portalVendor: { vendorName: 'Fixture Printing', contactName: 'Fixture Vendor', email: 'vendor@example.test' } };
            next();
        });
        const functions = [...source.matchAll(/(?:async )?function (requireVendor|vendorOwnsRow)\([^]*?\n\}/g)].map(match => match[0]);
        functions.push(serverSource.match(/async function portalProxyGet\([^]*?\n\}/)[0]);
        const idPattern = source.split('\n').find(line => line.startsWith('const VENDOR_JOB_ID_RE'));
        const route = source.match(/app\.post\('\/api\/vendor\/jobs\/:id\/notes'[^]*?\n\}\);/)[0];
        vm.runInNewContext(functions.join('\n') + '\n' + idPattern + '\n' + route, {
            app, express, console, AbortSignal, fetch: upstream, isVendorAccessEnabled: async () => true,
            vendorApiLimiter: (req, res, next) => next(), CRM_API_SECRET: 'vendor-relay-test-secret',
            CRM_API_BASE: 'https://proxy.example.test', PORTAL_PROXY: 'https://proxy.example.test', PORTAL_FETCH_TIMEOUT_MS: 12000
        });
        vendorServer = app.listen(0, '127.0.0.1', () => { vendorBase = `http://127.0.0.1:${vendorServer.address().port}`; done(); });
    });
    afterAll(() => new Promise(resolve => { if (!vendorServer) return resolve(); vendorServer.closeAllConnections(); vendorServer.close(resolve); }));
    beforeEach(() => {
        record = { ID_Transfer: 'ST-260908-0001', Method: 'Screen Print', SP_Vendor: 'Fixture Printing' };
        upstream.mockReset(); upstream.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ record }) }));
    });
    async function comment(vendor = true) {
        return fetch(vendorBase + '/api/vendor/jobs/ST-260908-0001/notes', { method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(vendor ? { 'x-test-vendor': '1' } : {}) }, body: '{"note":"Fixture vendor note"}' });
    }
    test('anonymous notes are rejected before any proxy call', async () => {
        expect((await comment(false)).status).toBe(401); expect(upstream).not.toHaveBeenCalled();
    });
    test('a vendor cannot write on another vendor job', async () => {
        record.SP_Vendor = 'Different Vendor';
        expect((await comment()).status).toBe(404); expect(upstream).toHaveBeenCalledTimes(1);
        expect(upstream.mock.calls[0][1].headers).toEqual({ 'X-CRM-API-Secret': 'vendor-relay-test-secret' });
    });
    test('owned-job notes preserve authentication on both the read and separate write prefix', async () => {
        const response = await comment(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
        expect(upstream).toHaveBeenCalledTimes(2);
        expect(upstream.mock.calls[0][0]).toBe('https://proxy.example.test/api/transfer-orders/ST-260908-0001');
        expect(upstream.mock.calls[1][0]).toBe('https://proxy.example.test/api/transfer-order-notes');
        for (const [, options] of upstream.mock.calls) expect(options.headers['X-CRM-API-Secret']).toBe('vendor-relay-test-secret');
        expect(JSON.parse(upstream.mock.calls[1][1].body)).toMatchObject({ Transfer_ID: record.ID_Transfer, Note_Text: 'Fixture vendor note', Author_Email: 'vendor@example.test' });
    });
});
