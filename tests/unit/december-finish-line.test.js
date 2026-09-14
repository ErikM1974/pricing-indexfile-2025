const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { sealArchive, openArchive, createArchiveStore, safeFileKey } = require('../../lib/december-finish-line');
const register = require('../../routes/december-finish-line');
const key = 'a1'.repeat(32); // Synthetic harness key; never a production credential.
const payload = {
    version: 1, primary: 'planning/outputs/report.html', aliases: { 'financial/outputs/old.html': 'planning/outputs/report.html' },
    catalog: { primary: 'planning/outputs/report.html', snapshotLabel: 'Synthetic date', links: [] },
    files: {
        'planning/outputs/report.html': { type: 'text/html', body: Buffer.from('<h1>Private fixture</h1>').toString('base64') },
        'planning/outputs/data.json': { type: 'application/json', download: true, body: Buffer.from('{"synthetic":true}').toString('base64') },
        'planning/outputs/book.pdf': { type: 'application/pdf', body: Buffer.from('%PDF-synthetic').toString('base64') },
        'planning/outputs/model.js': { type: 'application/javascript', body: Buffer.from('const fixture = true;').toString('base64') },
        'planning/outputs/report.css': { type: 'text/css', body: Buffer.from('body { color: black; }').toString('base64') },
    },
};

test('encryption authenticates the entire private payload and never stores plaintext', () => {
    const sealed = sealArchive(payload, key);
    expect(sealed.includes(Buffer.from('Private fixture'))).toBe(false);
    expect(openArchive(sealed, key)).toEqual(payload);
    expect(() => openArchive(sealed, 'b2'.repeat(32))).toThrow();
    for (const index of [0, 12, sealed.length - 1]) {
        const modified = Buffer.from(sealed); modified[index] ^= 1;
        expect(() => openArchive(modified, key)).toThrow();
    }
    expect(() => sealArchive(payload, '')).toThrow(/key/);
});

test.each(['../.env', '/etc/passwd', 'a/../b', 'a\\b', 'a\0b', '__proto__/x', ''])('path validation and exact allowlist prevent arbitrary file access: %s', input => {
    if (input === '__proto__/x') expect(safeFileKey(input)).toBe(true); // safe syntax still needs an own-key match
    else expect(safeFileKey(input)).toBe(false);
});

describe('complete server access boundary', () => {
    let root, server, port, oldKey;
    beforeAll(async () => {
        oldKey = process.env.FINISH_LINE_ARCHIVE_KEY;
        process.env.FINISH_LINE_ARCHIVE_KEY = key;
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'nwca-finish-line-'));
        fs.mkdirSync(path.join(root, 'private'));
        fs.mkdirSync(path.join(root, 'dashboards'));
        fs.writeFileSync(path.join(root, 'private/december-finish-line.enc'), sealArchive(payload, key));
        fs.writeFileSync(path.join(root, 'dashboards/december-finish-line.html'), '<h1>Admin shell</h1>');
        const app = express();
        register(app, { SERVER_DIR: root, path, requireCrmRole: roles => (req, res, next) => {
            expect(roles).toEqual(['admin']);
            const role = req.get('x-fixture-role');
            if (!role) return res.status(401).send('Sign in');
            if (role !== 'admin') return res.status(403).send('Denied');
            return next();
        } });
        app.use('/dashboards', express.static(path.join(root, 'dashboards')));
        app.use((req, res) => res.status(404).send('Missing'));
        server = app.listen(0);
        await new Promise(resolve => server.once('listening', resolve));
        port = server.address().port;
    });
    afterAll(async () => {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(root, { recursive: true, force: true });
        if (oldKey === undefined) delete process.env.FINISH_LINE_ARCHIVE_KEY;
        else process.env.FINISH_LINE_ARCHIVE_KEY = oldKey;
    });
    function request(url, role, method = 'GET') {
        return new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port, path: url, method, headers: role ? { 'x-fixture-role': role } : {} }, res => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
            });
            req.on('error', reject); req.end();
        });
    }
    const protectedPaths = [
        '/dashboards/december-finish-line.html', '/dashboards/december-finish-line%2ehtml',
        '/dashboards/%64ecember-finish-line.html', '/dashboards/DECEMBER-FINISH-LINE.HTML',
        '/admin/december-finish-line/catalog', '/admin/december-finish-line/files/planning/outputs/report.html',
        ...['data.json', 'book.pdf', 'model.js', 'report.css'].map(name => '/admin/december-finish-line/files/planning/outputs/' + name),
    ];
    test.each(protectedPaths)('anonymous and non-admin staff cannot read %s', async url => {
        expect((await request(url)).status).toBe(401);
        for (const role of ['staff', 'sales', 'accountant']) expect((await request(url, role)).status).toBe(403);
        expect((await request(url, 'staff', 'HEAD')).status).toBe(403);
    });
    test.each(protectedPaths)('admin reads receive private no-store headers: %s', async url => {
        const result = await request(url, 'admin');
        expect(result.status).toBe(200);
        expect(result.headers['cache-control']).toContain('no-store');
        expect(result.headers['x-robots-tag']).toContain('noindex');
    });
    test('downloads, aliases and unknown/traversal paths use the exact catalog', async () => {
        const result = await request('/admin/december-finish-line/files/planning/outputs/data.json', 'admin');
        expect(result.headers['content-disposition']).toContain('attachment');
        expect((await request('/admin/december-finish-line/files/financial/outputs/old.html', 'admin')).headers.location).toBe('/admin/december-finish-line/files/planning/outputs/report.html');
        for (const url of ['/admin/december-finish-line/files/%2e%2e%2f.env', '/admin/december-finish-line/files/__proto__', '/admin/december-finish-line/missing', '/private/december-finish-line.enc', '/lib/december-finish-line.js']) {
            expect((await request(url, 'admin')).status).toBe(404);
        }
        const store = createArchiveStore({ archivePath: path.join(root, 'private/december-finish-line.enc'), key });
        expect(store.file('__proto__/x')).toBe(null);
    });
});

test.each([undefined, 'b2'.repeat(32)])('missing or wrong archive key fails closed without exposing details', async badKey => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nwca-finish-key-'));
    const previous = process.env.FINISH_LINE_ARCHIVE_KEY;
    let server;
    try {
        fs.mkdirSync(path.join(root, 'private'));
        fs.writeFileSync(path.join(root, 'private/december-finish-line.enc'), sealArchive(payload, key));
        if (badKey === undefined) delete process.env.FINISH_LINE_ARCHIVE_KEY;
        else process.env.FINISH_LINE_ARCHIVE_KEY = badKey;
        const app = express();
        register(app, { SERVER_DIR: root, path, requireCrmRole: () => (req, res, next) => next() });
        server = app.listen(0);
        await new Promise(resolve => server.once('listening', resolve));
        for (const endpoint of ['catalog', 'files/planning/outputs/report.html']) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/admin/december-finish-line/${endpoint}`);
            expect(response.status).toBe(503);
            expect(response.headers.get('cache-control')).toContain('no-store');
            const body = await response.text();
            expect(body).not.toContain('Private fixture');
            expect(body).not.toContain(key);
            expect(body).not.toContain(root);
        }
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        fs.rmSync(root, { recursive: true, force: true });
        if (previous === undefined) delete process.env.FINISH_LINE_ARCHIVE_KEY;
        else process.env.FINISH_LINE_ARCHIVE_KEY = previous;
    }
});
