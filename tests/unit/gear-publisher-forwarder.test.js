// /api/gear/* — the same-origin forwarders behind Steve's 253gear publisher tab.
//
// Source-scanning, in the style of tests/unit/portal-proof-image.test.js: booting
// server.js would open real connections, and every property under test is structural.
//
// The stake is unusual for this repo. These routes create and reprice products on a
// PUBLIC storefront that takes money, using a Shopify token with catalogue-wide write
// access. So the gate choice, the query allowlist and the identity source are all
// asserted rather than trusted.

const fs = require('fs');
const path = require('path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

/** The forwarder block, so assertions cannot accidentally pass on unrelated code. */
const BLOCK = (() => {
    const start = SERVER.indexOf('253GEAR PUBLISHER FORWARDERS');
    const end = SERVER.indexOf("console.log('✓ 253Gear publisher forwarders loaded");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SERVER.slice(start, end);
})();

const GEAR_ROUTES = [...BLOCK.matchAll(/app\.(get|post)\('(\/api\/gear\/[^']*)'/g)]
    .map(([, method, route]) => ({ method: method.toUpperCase(), route }));

/** The block with comments stripped, so prose about a symbol never reads as a use of it. */
const CODE = BLOCK
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

describe('the routes exist and are page-gated', () => {
    test('all nine forwarders are declared', () => {
        expect(GEAR_ROUTES).toHaveLength(9);
        const routes = GEAR_ROUTES.map((r) => r.route);
        expect(routes).toEqual(expect.arrayContaining([
            '/api/gear/config',
            '/api/gear/products',
            '/api/gear/jobs/:designNumber',
            '/api/gear/classify',
            '/api/gear/jobs/:designNumber/resume',
            '/api/gear/products/:productId/audit',
            '/api/gear/products/:productId/publish',
            '/api/gear/config/refresh-collections'
        ]));
    });

    test('every one goes through gearForward, which applies the page gate', () => {
        for (const { route } of GEAR_ROUTES) {
            const line = BLOCK.split('\n').find((l) => l.includes(`'${route}'`));
            expect(`${route}: ${/gearForward\(/.test(line)}`).toBe(`${route}: true`);
        }
    });

    test('the gate is requirePageAccess on the page filename, not bare requireStaff', () => {
        // requireStaff admits ANY verified session — shipping, production, accountant.
        // requirePageAccess fails closed and is tunable from one Caspio row.
        expect(BLOCK).toMatch(/const GEAR_PAGE = 'gear-publisher\.html'/);
        expect(BLOCK).toMatch(/handlers = \[requirePageAccess\(GEAR_PAGE\)\]/);
        // Checked against CODE, not BLOCK: the comment above the gate names
        // requireStaff to explain why it is NOT used, and prose must not read as use.
        expect(CODE).not.toMatch(/requireStaff/);
    });

    test('the page is NOT in ADMIN_DEFAULT_PAGES — that would lock Steve out', () => {
        // Steve's role is `art`, not admin. Access is an emails-only Staff_Page_Access
        // row instead, which is an exclusive allowlist including admins.
        const pageAccess = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'page-access.js'), 'utf8');
        expect(pageAccess).not.toMatch(/gear-publisher\.html/);
    });
});

describe('the five forwarder invariants', () => {
    test('1 — a missing shared secret refuses instead of calling unauthenticated', () => {
        expect(BLOCK).toMatch(/if \(!CRM_API_SECRET\) return res\.status\(503\)\.json\(\{ error: 'not_configured' \}\)/);
    });

    test('2 — the query string is rebuilt from an allowlist, never passed through', () => {
        expect(BLOCK).toMatch(/new URLSearchParams\(\)/);
        expect(BLOCK).toMatch(/for \(const key of allowQuery\)/);
        expect(BLOCK).not.toMatch(/req\.query\)/);          // no spread/pass-through
        expect(BLOCK).not.toMatch(/new URLSearchParams\(req\.query/);
    });

    test('3 — every upstream call carries an AbortSignal timeout', () => {
        expect(BLOCK).toMatch(/signal: AbortSignal\.timeout\(timeoutMs\)/);
        // Nothing may sit on the default: the publish loop verifies the storefront.
        expect(BLOCK).toMatch(/timeoutMs = 20000/);
        expect(BLOCK).toMatch(/timeoutMs: 60000/);
    });

    test('4 — failure is a 502, never a 200 with a half-truth', () => {
        expect(BLOCK).toMatch(/res\.status\(502\)\.json\(\{ error: 'upstream_unavailable' \}\)/);
        expect(BLOCK).toMatch(/console\.error\(`\[gear-forward:/);
    });

    test('5 — the proxy paths are mirrored, so repointing is dropping a base URL', () => {
        expect(BLOCK).toMatch(/GEAR_UPSTREAM = `\$\{CRM_API_BASE\}\/api\/shopify`/);
    });
});

describe('identity and body handling', () => {
    test('the staff email comes from the verified session, never the request body', () => {
        expect(BLOCK).toMatch(/req\.session && req\.session\.crmUser && req\.session\.crmUser\.email/);
        expect(BLOCK).toMatch(/headers\['X-Staff-Email'\] = email/);
        expect(BLOCK).not.toMatch(/req\.body\.(staffEmail|createdBy|email)/);
    });

    test('the Idempotency-Key is forwarded — it is what stops a double-click duplicating', () => {
        expect(BLOCK).toMatch(/req\.get\('Idempotency-Key'\)/);
        expect(BLOCK).toMatch(/headers\['Idempotency-Key'\] = idem/);
    });

    test('a JSON body is RE-SERIALISED, not piped', () => {
        // bodyParser already consumed the stream; piping req would send an empty body.
        expect(BLOCK).toMatch(/body = JSON\.stringify\(req\.body \|\| \{\}\)/);
    });

    test('path parameters are validated before they reach the upstream URL', () => {
        expect(BLOCK).toMatch(/GEAR_ID_RE = \/\^\\d\{1,20\}\$\//);
        expect(BLOCK).toMatch(/GEAR_DESIGN_RE = \/\^\\d\{4,6\}\$\//);
        // Every parameterised route tests its param and can return null (→ 400).
        const parameterised = GEAR_ROUTES.filter((r) => r.route.includes(':'));
        expect(parameterised.length).toBeGreaterThanOrEqual(4);
        expect(BLOCK).toMatch(/if \(path === null\) return res\.status\(400\)/);
    });
});

describe('the copy drafter rides the existing AI forwarder', () => {
    test("'shopify-description-ai' is registered in AI_CHAT_ROUTES", () => {
        const arr = SERVER.slice(SERVER.indexOf('const AI_CHAT_ROUTES = ['),
            SERVER.indexOf('];', SERVER.indexOf('const AI_CHAT_ROUTES = [')));
        expect(arr).toMatch(/'shopify-description-ai'/);
    });
});

describe('the route table of contents stays honest', () => {
    test('every /api/gear route is listed in the TOC', () => {
        // A route silently dropped from this list 404'd for a week unnoticed; the
        // file says so itself.
        const toc = SERVER.slice(SERVER.indexOf('253GEAR PUBLISHER (2026-08-08)'),
            SERVER.indexOf('SAMPLE PROGRAM'));
        for (const { route } of GEAR_ROUTES) {
            const bare = route.replace('/api/gear', '');
            expect(`${route}: ${toc.includes(bare)}`).toBe(`${route}: true`);
        }
    });
});
