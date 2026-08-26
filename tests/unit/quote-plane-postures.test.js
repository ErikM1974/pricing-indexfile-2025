/**
 * Quote data plane — posture drift-lock (2026-08-26 lockdown).
 *
 * The app's /api/quote_* routes are THE browser path to the proxy's quote
 * tables (the proxy side is secret-gated). This test pins each route's
 * posture so a refactor can't silently reopen the plane:
 *
 *   - Mutations of existing rows (PUT/DELETE) are staff-only — the
 *     "rewrite prices on a live quote link" exposure from the 2026-08-17
 *     review.
 *   - Creates (POST) stay anonymous for the public calculators/cart but
 *     behind quotePlaneWriteLimiter.
 *   - List reads require a staff session OR a quoteID/sessionID scope —
 *     an anonymous caller can never LIST the customer book.
 *   - The ShopWorks push relays are staff-only (they mint real orders and
 *     dump full customer PII in preview).
 *   - Every server→proxy quote call carries the CRM secret (withProxySecret).
 *
 * Source-parsing on purpose: the postures ARE the route registrations.
 */

const fs = require('fs');
const path = require('path');

const serverSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

function assertRegistration(pattern, description) {
    test(description, () => {
        expect({ registered: pattern.test(serverSrc), want: String(pattern) })
            .toEqual({ registered: true, want: String(pattern) });
    });
}

describe('quote_sessions postures', () => {
    assertRegistration(/app\.get\('\/api\/quote_sessions',\s*quoteScopedOrStaff/,
        'GET list requires staff or a quoteID/sessionID scope');
    assertRegistration(/app\.get\('\/api\/quote_sessions\/:id',\s*requireStaff/,
        'GET by PK is staff-only (sequential PKs enumerate the book)');
    assertRegistration(/app\.post\('\/api\/quote_sessions',\s*quotePlaneWriteLimiter/,
        'POST (create) is rate-limited, staff skip');
    assertRegistration(/app\.put\('\/api\/quote_sessions\/:id',\s*requireStaff/,
        'PUT is staff-only');
});

describe('quote_items postures', () => {
    assertRegistration(/app\.get\('\/api\/quote_items',\s*quoteScopedOrStaff/,
        'GET list requires staff or a QuoteID scope');
    assertRegistration(/app\.get\('\/api\/quote_items\/:id',\s*requireStaff/,
        'GET by PK is staff-only');
    assertRegistration(/app\.post\('\/api\/quote_items',\s*quotePlaneWriteLimiter/,
        'POST (create) is rate-limited, staff skip');
    assertRegistration(/app\.put\('\/api\/quote_items\/:id',\s*requireStaff/,
        'PUT is staff-only (the price-rewrite risk)');
    assertRegistration(/app\.delete\('\/api\/quote_items\/:id',\s*requireStaff/,
        'DELETE is staff-only');
});

describe('quote_analytics postures', () => {
    assertRegistration(/app\.get\('\/api\/quote_analytics',\s*requireStaff/,
        'GET list is staff-only (view telemetry names customers)');
    assertRegistration(/app\.post\('\/api\/quote_analytics',\s*quotePlaneWriteLimiter/,
        'POST (customer view beacon) is rate-limited anonymous');
    assertRegistration(/app\.put\('\/api\/quote_analytics\/:id',\s*requireStaff/,
        'PUT is staff-only');
    assertRegistration(/app\.delete\('\/api\/quote_analytics\/:id',\s*requireStaff/,
        'DELETE is staff-only');
});

describe('sequence + push relays', () => {
    assertRegistration(/app\.get\('\/api\/quote-sequence\/:prefix',\s*quoteSequenceLimiter/,
        'quote-sequence mint relay is rate-limited (staff skip)');
    assertRegistration(/app\.post\(`\/api\/\$\{method\}-push\/push-quote`,\s*requireStaff/,
        'push-quote relays are staff-only');
    assertRegistration(/app\.get\(`\/api\/\$\{method\}-push\/preview\/:quoteId`,\s*requireStaff/,
        'push preview relays are staff-only (full-PII dump)');
});

describe('server→proxy secret coverage', () => {
    test('makeApiRequest sends the CRM secret', () => {
        const fn = serverSrc.slice(serverSrc.indexOf('async function makeApiRequest'));
        expect(fn.slice(0, 600)).toContain('withProxySecret');
    });
    test('fetchQuoteSessionRow sends the CRM secret', () => {
        const fn = serverSrc.slice(serverSrc.indexOf('async function fetchQuoteSessionRow'));
        expect(fn.slice(0, 400)).toContain('withProxySecret');
    });
    test('no direct proxy quote fetch is missing the secret header', () => {
        // Every `${TDT_PROXY}/api/quote_...` / `${CASPIO_PROXY_BASE}/api/quote_...`
        // fetch must have withProxySecret within the following options object.
        // Scan each match's following 2000 chars; URL-only declarations
        // (const url = ..., QUOTE_ITEMS_URL) are consumed by a fetch further
        // down the same block that carries the header.
        const re = /\$\{(?:TDT_PROXY|CASPIO_PROXY_BASE)\}\/api\/quote[_-][^`]*`/g;
        const misses = [];
        let m;
        while ((m = re.exec(serverSrc)) !== null) {
            const window = serverSrc.slice(m.index, m.index + 2000);
            if (!window.includes('withProxySecret')) {
                const line = serverSrc.slice(0, m.index).split('\n').length;
                misses.push(`line ${line}: ${m[0].slice(0, 80)}`);
            }
        }
        expect(misses).toEqual([]);
    });
});

describe('browser services are same-origin', () => {
    // The migrated base-URL declarations. A revert to the proxy host here
    // re-breaks the lockdown the moment the proxy gate enforces.
    const expectations = [
        ['shared_components/js/embroidery-quote-service.js', /this\.baseURL = '';/],
        ['shared_components/js/screenprint-quote-service.js', /this\.baseURL = '';/],
        ['shared_components/js/screenprint-fast-quote-service.js', /this\.baseURL = '';/],
        ['shared_components/js/dtf-quote-service.js', /this\.baseURL = '\/api';/],
        ['shared_components/js/base-quote-service.js', /this\.baseURL = '';/],
        ['calculators/safety-stripe-creator-service.js', /this\.baseURL = '';/],
    ];
    test.each(expectations)('%s declares a same-origin base', (rel, re) => {
        const src = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
        expect({ file: rel, sameOrigin: re.test(src) }).toEqual({ file: rel, sameOrigin: true });
    });
});
