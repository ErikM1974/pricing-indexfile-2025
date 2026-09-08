// routes/gear-publisher.js — 253GEAR publisher forwarders (page-gated Shopify proxies)
// Extracted VERBATIM from server.js lines 4550-4744 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, SERVER_DIR, express, fetch, path, requirePageAccess } = ctx;

// 253GEAR PUBLISHER FORWARDERS — same-origin, page-gated proxies to the
// caspio-pricing-proxy /api/shopify/* surface.
//
// WHY. Steve's tab (/dashboards/gear-publisher.html) creates DRAFT products on the
// public retail storefront 253gear.com. The Shopify credential lives on the proxy and
// a browser cannot hold a server secret, so the browser calls us same-origin with its
// SAML cookie, requirePageAccess proves the session AND the per-page rule, and we add
// CRM_API_SECRET server-to-server.
//
// GATE CHOICE. requirePageAccess('gear-publisher.html'), NOT bare requireStaff.
// `write_products` is catalogue-wide — it can reprice or unimage all 47 live products,
// not just create new ones — so this must not be open to every logged-in staffer by
// default. requirePageAccess fails CLOSED, and the same Caspio Staff_Page_Access row
// governs both the page and its data, which is the pattern CLAUDE.md prescribes.
// Erik seeds it with Allowed_Emails = himself + art@nwcustomapparel.com and no roles;
// an emails-only rule is an exclusive allowlist (admins included).
//
// The proxy path is MIRRORED exactly, so repointing a caller is just dropping the
// base URL. Query strings are rebuilt from an allowlist — never passed through.
//
// ⚠️ DEPLOY ORDER, and it is the reverse of the usual rule: ship the PROXY first.
// The "app forwarder first" convention exists for closing a gate on an
// already-public route; these routes are born gated with no legacy caller, so a
// forwarder deployed first would forward to a 404.
// =============================================================================
const GEAR_PAGE = 'gear-publisher.html';
const GEAR_UPSTREAM = `${CRM_API_BASE}/api/shopify`;

/** Build a forwarder for one method+path, with an explicit query allowlist. */
function gearForward(method, suffix, { allowQuery = [], timeoutMs = 20000, parseJson = false } = {}) {
  const handlers = [requirePageAccess(GEAR_PAGE)];
  if (parseJson) handlers.push(express.json({ limit: '512kb' }));

  handlers.push(async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });

    // Rebuild the query from an allowlist. Passing req.query through would let a
    // caller reach upstream parameters this surface never meant to expose.
    const params = new URLSearchParams();
    for (const key of allowQuery) {
      const v = req.query[key];
      if (v !== undefined && v !== null && String(v) !== '') params.set(key, String(v));
    }

    const path = typeof suffix === 'function' ? suffix(req) : suffix;
    if (path === null) return res.status(400).json({ error: 'bad_request' });

    const qs = params.toString();
    const url = `${GEAR_UPSTREAM}${path}${qs ? `?${qs}` : ''}`;

    try {
      const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
      // Identity is stamped server-side from the verified session, never the body,
      // so the browser cannot attribute a publish to someone else.
      const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
      if (email) headers['X-Staff-Email'] = email;
      const idem = req.get('Idempotency-Key');
      if (idem) headers['Idempotency-Key'] = idem;

      let body;
      if (parseJson && ['POST', 'PUT', 'PATCH'].includes(method)) {
        // bodyParser already consumed the stream, so it must be re-serialised —
        // piping req here would send an empty body.
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(req.body || {});
      }

      const upstream = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
      const text = await upstream.text();
      res.status(upstream.status)
        .type(upstream.headers.get('content-type') || 'application/json')
        .send(text);
    } catch (e) {
      console.error(`[gear-forward:${method} ${path}]`, e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  });

  return handlers;
}

const GEAR_ID_RE = /^\d{1,20}$/;
const GEAR_DESIGN_RE = /^\d{4,6}$/;

app.get('/api/gear/config', ...gearForward('GET', '/config', { allowQuery: ['refresh'] }));
app.get('/api/gear/products', ...gearForward('GET', '/products', { allowQuery: ['designNumber'] }));

app.get('/api/gear/jobs/:designNumber', ...gearForward('GET',
  (req) => (GEAR_DESIGN_RE.test(req.params.designNumber) ? `/jobs/${req.params.designNumber}` : null)));

app.post('/api/gear/products', ...gearForward('POST', '/products', { parseJson: true, timeoutMs: 30000 }));

app.post('/api/gear/classify', ...gearForward('POST', '/classify', { parseJson: true, timeoutMs: 60000 }));

app.post('/api/gear/jobs/:designNumber/resume', ...gearForward('POST',
  (req) => (GEAR_DESIGN_RE.test(req.params.designNumber) ? `/jobs/${req.params.designNumber}/resume` : null),
  { parseJson: true, timeoutMs: 30000 }));

app.post('/api/gear/products/:productId/audit', ...gearForward('POST',
  (req) => (GEAR_ID_RE.test(req.params.productId) ? `/products/${req.params.productId}/audit` : null),
  { timeoutMs: 30000 }));

// Publish runs the storefront verification loop upstream, so it gets the long timeout.
app.post('/api/gear/products/:productId/publish', ...gearForward('POST',
  (req) => (GEAR_ID_RE.test(req.params.productId) ? `/products/${req.params.productId}/publish` : null),
  { parseJson: true, timeoutMs: 60000 }));

app.post('/api/gear/config/refresh-collections', ...gearForward('POST', '/config/refresh-collections', { timeoutMs: 30000 }));

// Store metrics for the Design Queue. Gated on DESIGN-QUEUE, not gear-publisher:
// the panel lives on design-queue.html, and gear-publisher is an emails-only allowlist
// (Erik + art@) so reusing its gate would blank the panel for anyone else who can
// legitimately read the queue. One Caspio row still governs the page and its data —
// just design-queue.html's row rather than the publisher's.
//
// Walks the whole catalogue upstream, hence the longer timeout; the proxy caches it
// for 5 minutes so an open tab is cheap.
app.get('/api/gear/store-metrics',
  requirePageAccess('design-queue.html'),
  async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
    const params = new URLSearchParams();
    if (String(req.query.refresh || '') === 'true') params.set('refresh', 'true');
    const qs = params.toString();
    try {
      const upstream = await fetch(`${GEAR_UPSTREAM}/store-metrics${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
        signal: AbortSignal.timeout(45000)
      });
      const text = await upstream.text();
      res.status(upstream.status)
        .type(upstream.headers.get('content-type') || 'application/json')
        .send(text);
    } catch (e) {
      console.error('[gear-forward:GET /store-metrics]', e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  });

// ShopWorks screenshot OCR. Separate from gearForward for two reasons: it targets
// /api/vision (not /api/shopify), and a pasted screenshot needs a far larger body
// than the 512kb the rest of this surface allows — same 12mb allowance the Jim
// mailing-list extractor uses. The upstream route was secret-gated as part of this
// work; it had no browser caller of its own.
app.post('/api/gear/extract-shopworks',
  requirePageAccess(GEAR_PAGE),
  express.json({ limit: '12mb' }),
  async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
    try {
      const upstream = await fetch(`${CRM_API_BASE}/api/vision/extract-shopworks`, {
        method: 'POST',
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: (req.body && req.body.image) || '' }),
        signal: AbortSignal.timeout(60000)
      });
      const text = await upstream.text();
      res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
    } catch (e) {
      console.error('[gear-forward:POST /extract-shopworks]', e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  });

console.log('✓ 253Gear publisher forwarders loaded (page-gated: gear-publisher.html)');

console.log('✓ CRM API proxy routes loaded (session-protected)');

// robots.txt — staff/internal paths + credential-bearing share links disallowed (2026-06-11)
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'robots.txt'));
});

// Google Search Console ownership proof (2026-07-12) — NEVER remove: GSC
// re-checks periodically and the property un-verifies if this 404s.
app.get('/google9a8dd44e58634cb7.html', (req, res) => {
  res.type('text/html').send('google-site-verification: google9a8dd44e58634cb7.html');
});

// Favicon — SELF-HOSTED (2026-07-12; icon refreshed 2026-07-13 to the NWCA
// circle/tee mark): the old cdn.caspio.com favicon URL is robots-blocked (cdn
// robots.txt = Disallow: /), so Googlebot-Image could never fetch it and search
// results showed a generic globe. No root express.static exists, hence explicit
// routes. favicon.ico is a multi-size (16/32/48) PNG-in-ICO; apple-touch-icon
// (180) is auto-requested by iOS at the site root for "Add to Home Screen".
app.get(['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  const file = req.path === '/favicon.ico' ? 'favicon.ico'
             : req.path === '/favicon.png' ? 'favicon.png'
             : 'apple-touch-icon.png';
  res.sendFile(path.join(SERVER_DIR, file));
});

};
