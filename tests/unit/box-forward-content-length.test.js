/**
 * box-forward-content-length.test.js — the Box forwarder must never forward a
 * length it did not measure.
 *
 * WHY THIS EXISTS
 * 2026-08-05 the Box reads moved behind a same-origin forwarder (server.js
 * boxForward/boxForwardWrite). It copied `content-length` from the upstream
 * response and then piped the body. node-fetch asks for gzip and inflates
 * transparently, so that header described the COMPRESSED bytes while the pipe
 * sent the decompressed ones — the browser honoured the short framing and got a
 * truncated document. For seven days the Send-to-Supacolor picker answered
 * "Unterminated string in JSON at position 476" for any search matching 14-20
 * folders, and ~50% of real art folders broke the file picker the same way.
 *
 * The failure is a BAND, not a threshold, which is why nobody caught it:
 *   uncompressed >= 1024  → the proxy gzips, so the copied length is wrong; AND
 *   gzip < 1024           → our own compression() declines to re-compress and
 *                           leaves that wrong length on the wire.
 * Below the band the proxy sends plaintext (length honest); above it our
 * compression() strips the header and goes chunked (accidentally correct). So a
 * test with one small payload and one large payload passes against the bug.
 *
 * TWO TRAPS THIS FILE EXISTS TO AVOID
 * 1. A source-grep lock is not enough. The obvious assertion — that server.js
 *    does not contain `upstream.headers.get('content-length')` — is VACUOUS:
 *    that literal never existed, the code reads `.get(h)` in a loop. It would
 *    have gone green throughout the outage. So the header list is PARSED OUT of
 *    server.js and driven through a real HTTP round trip; the shipped array is
 *    the thing under test, and it cannot drift from what the app runs.
 * 2. The upstream must be a raw http.createServer that writes `Content-Encoding:
 *    gzip` AND `Content-Length: <gzip size>` by hand. An express+compression()
 *    upstream does NOT reproduce this — compression() removes Content-Length
 *    when it compresses. The gzip+length pairing the app really sees comes from
 *    Heroku's router re-framing the proxy's chunked response.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const zlib = require('zlib');
const express = require('express');
const compression = require('compression');
const fetch = require('node-fetch');

const REPO = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

/** The literal header array the named forwarder actually ships. */
function shippedHeaderList(fnName) {
    const start = SERVER.indexOf(`function ${fnName}(`);
    if (start === -1) throw new Error(`${fnName} not found in server.js`);
    const next = SERVER.indexOf('\nfunction ', start + 1);
    const body = SERVER.slice(start, next === -1 ? SERVER.length : next);
    const m = /for \(const h of \[([\s\S]*?)\]\)/.exec(body);
    if (!m) throw new Error(`no header-copy loop found in ${fnName}`);
    return m[1]
        .split(',')
        .map((s) => s.trim().replace(/\/\/.*$/, '').trim())
        .filter(Boolean)
        .map((s) => s.replace(/^['"]|['"]$/g, ''));
}

const READ_HEADERS = shippedHeaderList('boxForward');
const WRITE_HEADERS = shippedHeaderList('boxForwardWrite');

/** The list as it shipped during the outage — drives the negative control. */
const BUGGY_HEADERS = ['content-type', 'content-length', 'content-disposition',
    'cache-control', 'etag', 'last-modified'];

// ── HTTP harness ─────────────────────────────────────────────────────────────

/** Realistic /api/box/search body; entry shape from proxy box-upload.js:863-867. */
function searchPayload(n) {
    const companies = ['Asphalt Patch Products', 'Northwest Gourmet Foods', 'ETC Tacoma',
        'Patriot Fire Protection', 'NW Indian Fisheries', 'CondoCare RW Anderson'];
    const entries = Array.from({ length: n }, (_, i) => ({
        id: String(184567820000 + i),
        name: `${39700 + i} ${companies[i % companies.length]} - Screenprint`,
        type: 'folder',
    }));
    return JSON.stringify({ success: true, entries, count: n });
}

/** Raw upstream: gzip + a gzip-sized Content-Length, exactly what Heroku emits. */
function startUpstream(getPayload) {
    const server = http.createServer((req, res) => {
        const raw = Buffer.from(getPayload());
        if (raw.length >= 1024) {           // the proxy's compression() threshold
            const gz = zlib.gzipSync(raw);
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Encoding': 'gzip',
                'Content-Length': String(gz.length),
            });
            res.end(gz);
        } else {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': String(raw.length),
            });
            res.end(raw);
        }
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** The app hop: real express + real compression() + the header list under test. */
function startApp(headerList, upstreamPort) {
    const app = express();
    app.use(compression());                 // server.js:765
    app.get('/box', async (req, res) => {
        const upstream = await fetch(`http://127.0.0.1:${upstreamPort}/`);
        res.status(upstream.status);
        for (const h of headerList) {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        }
        upstream.body.pipe(res);
    });
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function dechunk(buf) {
    const out = [];
    let i = 0;
    while (i < buf.length) {
        const nl = buf.indexOf('\r\n', i);
        if (nl === -1) break;
        const size = parseInt(buf.slice(i, nl).toString('ascii'), 16);
        if (!Number.isFinite(size) || size === 0) break;
        out.push(buf.slice(nl + 2, nl + 2 + size));
        i = nl + 2 + size + 2;
    }
    return Buffer.concat(out);
}

/**
 * A browser-accurate client: it obeys Content-Length framing, and it RESOLVES on
 * a protocol error instead of rejecting — a desynchronised connection is one of
 * the failure modes under test, not a broken test.
 */
function rawGet(port) {
    return new Promise((resolve) => {
        const chunks = [];
        const socket = net.connect(port, '127.0.0.1', () => {
            socket.write('GET /box HTTP/1.1\r\nHost: t\r\nAccept-Encoding: gzip\r\nConnection: close\r\n\r\n');
        });
        socket.on('data', (d) => chunks.push(d));
        socket.on('error', () => resolve({ protocolError: true, text: '' }));
        socket.on('close', () => {
            const all = Buffer.concat(chunks);
            const sep = all.indexOf('\r\n\r\n');
            if (sep === -1) return resolve({ protocolError: true, text: '' });
            const head = all.slice(0, sep).toString('ascii');
            let body = all.slice(sep + 4);
            if (/transfer-encoding:\s*chunked/i.test(head)) body = dechunk(body);
            if (/content-encoding:\s*gzip/i.test(head)) {
                try { body = zlib.gunzipSync(body); } catch { return resolve({ protocolError: true, text: '' }); }
            }
            const cl = /^content-length:\s*(\d+)/im.exec(head);
            if (cl) body = body.slice(0, Number(cl[1]));   // what a browser accepts
            resolve({
                head,
                contentLength: cl ? Number(cl[1]) : null,
                encoding: /content-encoding:\s*(\S+)/i.exec(head)?.[1] || null,
                text: body.toString('utf8'),
            });
        });
    });
}

// Entry counts spanning the whole band: below it, across it, and out the top.
// 14-20 is where Steve's search lived; 15 hits gzips to 476 bytes, the exact
// offset his browser reported.
const HIT_COUNTS = [2, 8, 13, 14, 15, 16, 20, 30, 60, 200];

describe('the shipped header lists', () => {
    test('were actually parsed out of server.js (guard against a vacuous pass)', () => {
        expect(READ_HEADERS.length).toBeGreaterThan(1);
        expect(WRITE_HEADERS.length).toBeGreaterThan(1);
        expect(READ_HEADERS).toContain('content-type');
        expect(WRITE_HEADERS).toContain('content-type');
    });

    test('boxForward never forwards content-length', () => {
        expect(READ_HEADERS).not.toContain('content-length');
    });

    test('boxForwardWrite never forwards content-length', () => {
        expect(WRITE_HEADERS).not.toContain('content-length');
    });

    test('neither forwards content-encoding — node-fetch already inflated the body', () => {
        // Copying this without the body still being encoded is the mirror bug:
        // the browser would try to gunzip plaintext.
        expect(READ_HEADERS).not.toContain('content-encoding');
        expect(WRITE_HEADERS).not.toContain('content-encoding');
    });
});

describe('behaviour: the SHIPPED list delivers a parseable body across the gzip band', () => {
    let upstream; let app; let hits;

    beforeAll(async () => {
        upstream = await startUpstream(() => searchPayload(hits));
        app = await startApp(READ_HEADERS, upstream.address().port);
    });
    afterAll(() => { app?.close(); upstream?.close(); });

    test('precondition: the fake upstream really enters the failure band', async () => {
        const raw = searchPayload(15);
        const gz = zlib.gzipSync(Buffer.from(raw));
        // If either of these stops holding, every test below is vacuous.
        expect(raw.length).toBeGreaterThanOrEqual(1024);   // proxy gzips it
        expect(gz.length).toBeLessThan(1024);              // app won't re-gzip it
        expect(gz.length).toBeLessThan(raw.length);        // the length would lie
    });

    test.each(HIT_COUNTS)('%i folder hits → full body, JSON.parse succeeds', async (n) => {
        hits = n;
        const res = await rawGet(app.address().port);
        expect(res.protocolError).toBeFalsy();
        const parsed = JSON.parse(res.text);               // throws on truncation
        expect(parsed.entries).toHaveLength(n);
        expect(parsed.count).toBe(n);
        // Whatever framing was chosen, it must describe what was actually sent.
        if (res.contentLength !== null && !res.encoding) {
            expect(res.contentLength).toBe(Buffer.byteLength(res.text));
        }
    });
});

describe('negative control: the pre-fix list really did corrupt the body', () => {
    // Without this, a harness that quietly stopped gzipping would report green
    // forever and this whole file would prove nothing.
    let upstream; let app; let hits;

    beforeAll(async () => {
        upstream = await startUpstream(() => searchPayload(hits));
        app = await startApp(BUGGY_HEADERS, upstream.address().port);
    });
    afterAll(() => { app?.close(); upstream?.close(); });

    test.each([14, 15, 20, 30])('%i hits is unparseable with content-length copied', async (n) => {
        hits = n;
        const res = await rawGet(app.address().port);
        const broke = res.protocolError || (() => {
            try { JSON.parse(res.text); return false; } catch { return true; }
        })();
        expect(broke).toBe(true);
    });

    test('and the shipped list is genuinely different from the buggy one', () => {
        expect(READ_HEADERS).not.toEqual(BUGGY_HEADERS);
    });
});
