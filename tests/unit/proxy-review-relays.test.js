const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');
const root = path.join(__dirname, '../..');
// Inline extracted route modules so this check also survives the ongoing server split.
const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8').replace(
    /^[^\r\n]*require\('\.\/routes\/([a-z0-9-]+)'\)\(app, ctx\);[^\r\n]*$/gm,
    (line, name) => fs.readFileSync(path.join(root, 'routes', name + '.js'), 'utf8'));
const upstream = jest.fn();
let server, base;
beforeAll(done => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { if (req.headers['x-test-staff']) req.session = { crmUser: { email: 'staff@example.invalid' } }; next(); });
    const functions = ['requireStaff', 'withProxySecret', 'staffContactProxy'].map(name => {
        const match = source.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n\\}'));
        expect(match).not.toBeNull(); return match[0];
    });
    const mount = source.split('\n').find(line => /^app\.all\(/.test(line) && line.includes('staffContactProxy'));
    expect(mount).toContain('requireStaff');
    vm.runInNewContext(functions.join('\n') + '\n' + mount, {
        app, fetch: upstream, CRM_API_BASE: 'https://proxy.example.invalid', CRM_API_SECRET: 'server-test-secret',
        console: { error() {} }
    });
    server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
beforeEach(() => { upstream.mockReset(); upstream.mockResolvedValue({ status: 200, json: async () => ({ contacts: [] }) }); });

test.each(['/api/company-contacts/search?q=Acme', '/api/company-contacts-2026/search?q=Acme'])('anonymous callers cannot use %s', async url => {
    const res = await fetch(base + url);
    expect(res.status).toBe(401); expect(upstream).not.toHaveBeenCalled();
});
test('an authenticated staff read preserves filters and adds the secret', async () => {
    const url = '/api/company-contacts-2026/search?q=Acme%20Co&includeInactive=true&limit=8';
    expect((await fetch(base + url, { headers: { 'x-test-staff': '1' } })).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith('https://proxy.example.invalid' + url, expect.objectContaining({
        method: 'GET', headers: expect.objectContaining({ 'X-CRM-API-Secret': 'server-test-secret' })
    }));
});
test('contact writes require staff and preserve the body', async () => {
    const body = JSON.stringify({ ContactNumbersEmail: 'review@example.invalid' });
    expect((await fetch(base + '/api/company-contacts/123', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    const res = await fetch(base + '/api/company-contacts/123', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-staff': '1' }, body });
    expect(res.status).toBe(200); expect(upstream.mock.calls[0][1].body).toBe(body);
});
test('upstream denial and transport failures remain visible', async () => {
    upstream.mockResolvedValueOnce({ status: 401, json: async () => ({ error: 'Unauthorized' }) });
    expect((await fetch(base + '/api/company-contacts/123', { headers: { 'x-test-staff': '1' } })).status).toBe(401);
    upstream.mockRejectedValueOnce(new Error('offline'));
    expect((await fetch(base + '/api/company-contacts/123', { headers: { 'x-test-staff': '1' } })).status).toBe(502);
});
test('every legacy cart relay requires a staff session', () => {
    const registrations = [...source.matchAll(/app\.(?:get|post|put|delete)\('\/api\/cart-(?:sessions|items|item-sizes)[^']*',([^\n]*)/g)];
    expect(registrations).toHaveLength(15);
    for (const match of registrations) expect(match[1]).toMatch(/^\s*requireStaff,/);
});
test('server contact and shipment reads include the secret', () => {
    expect(source).toMatch(/fetch\(shipmentsUrl,\s*\{ headers: withProxySecret\(\) \}\)/);
    const shippingSource = source + fs.readFileSync(path.join(root, 'lib/shipstation/billing.js'), 'utf8');
    const calls = [...shippingSource.matchAll(/fetch\(\s*`\$\{PROXY_BASE\}\/api\/company-contacts[^;]+;/g)];
    expect(calls).toHaveLength(2);
    calls.forEach(call => expect(call[0]).toContain('headers: withProxySecret()'));
});
test('dashboard contacts use this origin while catalog reads keep their configured host', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const window = { APP_CONFIG: { API: { BASE_URL: 'https://proxy.example.invalid' } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'shared_components/js/dash-page-helpers.js'), 'utf8'), {
        window, fetch: mockFetch, document: { readyState: 'loading', addEventListener() {} }
    });
    await window.DashPage.fetchJson('/api/company-contacts/by-email/test%40example.invalid');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/company-contacts/by-email/test%40example.invalid');
    await window.DashPage.fetchJson('/api/products');
    expect(mockFetch.mock.calls[1][0]).toBe('https://proxy.example.invalid/api/products');
});
test('contact browser callers never attach the proxy host to a contact URL', () => {
    const files = ['dashboards/js/finished-photos.js', 'dashboards/js/portal-directory.js', 'pages/js/mockup-detail.js',
        'pages/forms/nwca-form-contacts.js', 'shared_components/js/company-contact-picker.js', 'shared_components/js/customer-lookup-service.js',
        'shared_components/js/builders/dtg/catalog-search.js', 'shared_components/js/builders/emb/design-search.js'];
    for (const file of files) {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        expect(text).not.toMatch(/(?:\$\{[^}]+\}|\w+(?:\(\))?\s*\+\s*['"])\/api\/company-contacts/);
    }
});


test('payroll relay parses large uploads before the smaller global parser', async () => {
    const payroll = source.split('\n').find(line => line.startsWith("app.use('/api/crm-proxy/payroll/parse'"));
    const global = source.split('\n').find(line => line.startsWith('app.use(bodyParser.json('));
    expect(source.indexOf(payroll)).toBeLessThan(source.indexOf(global));
    expect(payroll).toContain("requirePageAccess('payroll.html')");
    const app = express();
    const gate = jest.fn(() => (req, res, next) => next());
    vm.runInNewContext(payroll + '\n' + global, { app, bodyParser: require('body-parser'), requirePageAccess: gate });
    expect(gate).toHaveBeenCalledWith('payroll.html');
    app.post('/api/crm-proxy/payroll/parse', (req, res) => res.status(202).json({ length: req.body.dataBase64.length }));
    const local = app.listen(0, '127.0.0.1');
    await new Promise(resolve => local.once('listening', resolve));
    try {
        const res = await fetch('http://127.0.0.1:' + local.address().port + '/api/crm-proxy/payroll/parse', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataBase64: 'A'.repeat(11 * 1024 * 1024) })
        });
        expect(res.status).toBe(202);
        expect((await res.json()).length).toBe(11 * 1024 * 1024);
    } finally { local.closeAllConnections(); await new Promise(resolve => local.close(resolve)); }
});
