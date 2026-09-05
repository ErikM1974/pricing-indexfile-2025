/**
 * Two live defects found by the 2026-09-05 dashboard crawl, locked here.
 *
 *   1. Policies Hub / Policy Detail: the Caspio auth embed was a STATIC <script>, so it ran
 *      for every visitor — and for a SAML-signed-in staffer with no Caspio portal login it
 *      redirected the page to "Sign in to User Portal". The embed is now a placeholder that
 *      policies-admin-gate.js injects only after the SAML/session checks find nothing.
 *   2. Design Vault: the proxy's CORS preflight did not list If-None-Match, so the browser
 *      dropped the index GET as a CORS failure ("Failed to fetch") and the Vault served a
 *      31-day-old cached index. The proxy now allows the conditional headers and exposes
 *      ETag / Content-Length / Retry-After.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Policies pages: Caspio auth embed is on-demand', () => {
    test.each(['pages/policies-hub.html', 'pages/policy-detail.html'])('%s has the placeholder, not the static script', (rel) => {
        const html = read(rel);
        expect(html).not.toMatch(/<script[^>]*src="https:\/\/c3eku948\.caspio\.com\/dp\/[^"]*\/emb"/);
        expect(html).toMatch(/<div id="caspio-auth-embed" data-src="https:\/\/c3eku948\.caspio\.com\/dp\/[^"]+\/emb"><\/div>/);
        expect(html).toMatch(/policies-admin-gate\.js/);
    });
    test('the gate injects the embed only after /me and sessionStorage found no session', () => {
        const gate = read('shared_components/js/policies/policies-admin-gate.js');
        expect(gate).toMatch(/function injectCaspioEmbed\(\)/);
        expect(gate).toMatch(/host\.dataset\.loaded === '1'/);
        // step 3 guard → inject → wait, in that order
        expect(gate).toMatch(/if \(!me\?\.authenticated && document\.getElementById\('auth-firstname'\)\) \{\s*injectCaspioEmbed\(\);\s*log\('waiting for Caspio embed…'\);\s*const cu = await waitForCaspio\(\);/);
    });
});

describe('Design Vault: proxy CORS lets the conditional index request through', () => {
    const proxyPath = path.join(ROOT, '..', 'caspio-pricing-proxy', 'server.js');
    const proxy = fs.existsSync(proxyPath) ? fs.readFileSync(proxyPath, 'utf8') : null;
    const maybe = proxy ? test : test.skip;
    maybe('Access-Control-Allow-Headers lists If-None-Match; ETag and Content-Length are exposed', () => {
        const allow = proxy.match(/res\.setHeader\('Access-Control-Allow-Headers', '([^']+)'\)/)[1];
        for (const h of ['If-None-Match', 'If-Modified-Since', 'Range', 'x-crm-api-secret']) expect(allow).toContain(h);
        const expose = proxy.match(/res\.setHeader\('Access-Control-Expose-Headers', '([^']+)'\)/)[1];
        for (const h of ['ETag', 'Content-Length', 'Retry-After']) expect(expose).toContain(h);
    });
    test('the Vault store still sends If-None-Match and reads ETag (the fix is server-side, not a downgrade)', () => {
        const store = read('dashboards/js/design-gallery-store.js');
        expect(store).toMatch(/headers\['If-None-Match'\] = etag/);
        expect(store).toMatch(/res\.headers\.get\('ETag'\)/);
    });
});
