/**
 * mockup-forwarder.test.js — the session-gated forwarder for mockup RECORD data.
 *
 * WHY THIS EXISTS
 * 2026-08-11: the proxy gated these reads secret-OR-browser-Origin. An Origin header
 * is caller-controlled, so `curl -H 'Origin: https://www.teamnwca.com'` reproduced a
 * staff browser exactly and returned Company_Name, Id_Customer, Work_Order_Number and
 * AE_Notes — 500 rows at a time from the list route. Origin is a CSRF signal, never an
 * authentication one.
 *
 * The browser cannot hold the shared secret, so the fix is the one the Box family
 * already proved: pages call THIS origin, the SAML cookie rides along, requireStaff
 * proves the session server-side, and only the app holds the secret used upstream.
 *
 * The half of this that actually rots is the CLIENT half. Both prior Box-gate
 * incidents were caused by a caller that nobody repointed — 92% of customer proofs
 * went blank the first time, and a second sweep was needed for the finished-photos
 * pages. So the last describe block greps the browser JS: any cross-origin GET back
 * to these endpoints fails the build, because it would keep working right up until
 * the proxy gate tightens and then die silently.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

/** The forwarder block only, so an assertion cannot pass on unrelated code. */
const BLOCK = (() => {
    const start = SERVER.indexOf('── Mockup data forwarder (session-gated)');
    const end = SERVER.indexOf('── DTG print-box calibration WRITES', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SERVER.slice(start, end);
})();

/** The block with comment lines stripped — prose about a symbol is not a use of it. */
const CODE = BLOCK.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const ROUTES = [
    '/api/mockups/broken-mockups',
    '/api/mockups',
    '/api/mockups/:id',
    '/api/mockup-notes/:id',
    '/api/mockup-versions/:id',
    '/api/mockup-notifications',
];

describe('mockup forwarder — every route is session-gated', () => {
    test.each(ROUTES)('%s is registered with requireStaff + mockupForward', (route) => {
        const line = CODE.split('\n').find((l) => l.includes(`'${route}'`));
        expect(line).toBeDefined();
        expect(line).toContain('requireStaff');
        expect(line).toContain('mockupForward(');
    });

    test('no route in the block is registered without requireStaff', () => {
        const registrations = [...CODE.matchAll(/app\.(get|post|put|delete)\('([^']+)'\s*,\s*([^)]*)/g)];
        expect(registrations.length).toBe(ROUTES.length);
        for (const [, , route, rest] of registrations) {
            expect(`${route}: ${/requireStaff/.test(rest)}`).toBe(`${route}: true`);
        }
    });

    test('GET only — writes must not route through a staff gate', () => {
        // The CUSTOMER approval view writes (PUT status, POST note) with no staff
        // session. Sending those through requireStaff turns approve/revise into a
        // dead button, which nobody would see as an error.
        expect(CODE).not.toMatch(/app\.(post|put|delete)\('\/api\/mockup/);
    });
});

describe('mockup forwarder — upstream call is safe', () => {
    test('refuses to forward when the secret is unset (503, never an open passthrough)', () => {
        expect(CODE).toContain('if (!CRM_API_SECRET)');
        expect(CODE).toContain('503');
    });

    test('attaches the shared secret', () => {
        expect(CODE).toContain("'X-CRM-API-Secret': CRM_API_SECRET");
    });

    test('query params are rebuilt from an allowlist, never passed through', () => {
        expect(CODE).toContain('MOCKUP_FORWARD_QUERY.has(k)');
        // A raw req.query passthrough would let a caller smuggle arbitrary params upstream.
        expect(CODE).not.toMatch(/new URLSearchParams\(req\.query/);
        expect(CODE).not.toMatch(/req\.originalUrl\.slice/);
    });

    test('the id is validated numerically rather than interpolated', () => {
        expect(SERVER).toContain('function mockupRecordId(req)');
        expect(SERVER).toMatch(/mockupRecordId[\s\S]{0,220}\/\^\\d\{1,12\}\$\//);
    });

    test('upstream failure surfaces as 502, never a silent empty 200', () => {
        expect(CODE).toContain('502');
        expect(CODE).toContain('AbortSignal.timeout');
    });

    test('responses are no-store — customer data must never sit in a shared cache', () => {
        expect(CODE).toContain("'Cache-Control', 'no-store'");
    });

    test('the literal broken-mockups route is registered BEFORE the :id pattern', () => {
        // Otherwise Express captures 'broken-mockups' as an id. mockupRecordId()'s
        // numeric check also catches it, but order is the first line of defence.
        expect(CODE.indexOf("'/api/mockups/broken-mockups'"))
            .toBeLessThan(CODE.indexOf("'/api/mockups/:id'"));
    });
});

describe('client callers — no cross-origin GET may survive', () => {
    // Unambiguous GET shapes. The bare `/api/mockups/' + id` form is deliberately not
    // listed: PUT and DELETE share it, and those legitimately still go to the proxy.
    const FORBIDDEN = [
        '/api/mockup-notes/',
        '/api/mockup-versions/',
        '/api/mockups?',
        '/api/mockups/broken-mockups',
        '/api/mockup-notifications',
    ];

    const CLIENT_DIRS = ['pages/js', 'dashboards/js', 'shared_components/js'];

    const clientFiles = CLIENT_DIRS.flatMap((dir) => {
        const abs = path.join(REPO, dir);
        if (!fs.existsSync(abs)) return [];
        return fs.readdirSync(abs)
            .filter((f) => f.endsWith('.js'))
            .map((f) => ({ rel: `${dir}/${f}`, src: fs.readFileSync(path.join(abs, f), 'utf8') }));
    });

    test('the client directories were actually found (guard against a vacuous pass)', () => {
        expect(clientFiles.length).toBeGreaterThan(50);
    });

    test.each(FORBIDDEN)('no file builds a cross-origin URL for %s', (endpoint) => {
        const offenders = [];
        for (const { rel, src } of clientFiles) {
            src.split('\n').forEach((line, i) => {
                if (/^\s*(\/\/|\*)/.test(line)) return;          // comments are allowed to mention it
                if (!line.includes(endpoint)) return;
                // Cross-origin = the endpoint prefixed by an origin-bearing expression.
                if (/(API_BASE|base\(\)|BASE_URL|https?:\/\/)[^\n]{0,40}$/.test(line.slice(0, line.indexOf(endpoint)))) {
                    offenders.push(`${rel}:${i + 1}`);
                }
            });
        }
        expect(offenders).toEqual([]);
    });
});
