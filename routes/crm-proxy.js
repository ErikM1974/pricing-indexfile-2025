// routes/crm-proxy.js — CRM API proxy
// Extracted VERBATIM from server.js lines 3501-4340 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, PORTAL_ADMIN_ROLES, SAMPLE_PRICING, TDT_PROXY, boxFileId, boxForward, express, fetch, requireCrmRole, requirePageAccess, requireStaff, strictLimiter, withProxySecret } = ctx;

// =============================================================================
// CRM API PROXY ROUTES
// These routes protect the CRM API by validating session/role before forwarding
// to caspio-pricing-proxy with a server-side secret. The API never exposed to browser.
// =============================================================================









// Generic CRM proxy handler factory
function createCrmProxy(endpoint, allowedRoles) {
  return [
    requireCrmRole(allowedRoles),
    async (req, res) => {
      try {
        // Build the target URL (preserve path after the endpoint prefix)
        const targetPath = req.originalUrl.replace(`/api/crm-proxy/${endpoint}`, '');
        const targetUrl = `${CRM_API_BASE}/api/${endpoint}${targetPath}`;

        // Forward the request with the secret header
        const fetchOptions = {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-API-Secret': CRM_API_SECRET
          }
        };

        // Include body for POST/PUT requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);
        const data = await response.json();

        // Forward the response status and data
        res.status(response.status).json(data);
      } catch (error) {
        console.error(`[CRM Proxy] Error proxying to ${endpoint}:`, error.message);
        res.status(500).json({ error: 'Proxy error', message: error.message });
      }
    }
  ];
}

// Customer-directory access is staff-only. Preserve the query and keep the
// CRM secret on the server; public forms can still accept manually typed details.
async function staffContactProxy(req, res) {
  try {
    const upstream = await fetch(CRM_API_BASE + req.originalUrl, {
      method: req.method,
      headers: withProxySecret({ 'Content-Type': 'application/json' }),
      ...(['POST', 'PUT', 'PATCH'].includes(req.method) ? { body: JSON.stringify(req.body || {}) } : {})
    });
    if (upstream.status === 204) return res.sendStatus(204);
    res.status(upstream.status).json(await upstream.json());
  } catch (error) {
    console.error('[Contact Proxy]', error.message);
    res.status(502).json({ error: 'Unable to load customer contacts' });
  }
}
app.all(['/api/company-contacts', '/api/company-contacts/*', '/api/company-contacts-2026', '/api/company-contacts-2026/*'], requireStaff, staffContactProxy);

// Taneisha accounts proxy - requires 'taneisha' role
app.all('/api/crm-proxy/taneisha-accounts*', ...createCrmProxy('taneisha-accounts', ['taneisha']));

// Nika accounts proxy - requires 'nika' role
app.all('/api/crm-proxy/nika-accounts*', ...createCrmProxy('nika-accounts', ['nika']));

// House accounts proxy - requires 'house' role
app.all('/api/crm-proxy/house-accounts*', ...createCrmProxy('house-accounts', ['house']));

// Sales Reps 2026 proxy - requires 'house' role (admin can view/edit all reps)
app.all('/api/crm-proxy/sales-reps-2026*', ...createCrmProxy('sales-reps-2026', ['house']));

// Assignment history + ShopWorks To-Do — audit trail of rep assignments and the
// "still needs keying into ShopWorks" checklist (no write-back exists; Erik keys
// CustomerServiceRep by hand and the ODBC mirror confirms it). NOTE: the house
// page has POSTed here since the reconcile audit-trail shipped, but this
// forwarder never existed — every log call 404'd silently (caught 2026-07-19).
app.all('/api/crm-proxy/assignment-history*', ...createCrmProxy('assignment-history', ['house']));

// Payroll proxy — gated by the SAME Staff_Page_Access row as payroll.html, which is an
// exclusive email allowlist (Erik only, 2026-07-27). Deliberately NOT requireCrmRole:
// a role gate can't express "one person", and today's ['admin'] would silently widen the
// moment a second admin is added. One table row now controls the page and its data
// together — Erik changes who sees payroll without a deploy.
// The parse route carries a base64 PDF, so it needs a bigger body parser than the 5mb
// global — its authenticated parser is registered BEFORE the global parser above.
app.all('/api/crm-proxy/payroll*', requirePageAccess('payroll.html'), createCrmProxy('payroll', ['admin'])[1]);

// Policies Hub admin proxy - requires 'policies-admin' role (currently Erik only).
// Public reads do NOT go through here — frontend hits /api/policies-public on the
// caspio-pricing-proxy directly (unprotected, Published+Active only).
app.all('/api/crm-proxy/policies*', ...createCrmProxy('policies', ['policies-admin']));

// Policies Hub comments admin proxy - moderation actions (resolve / hide / edit)
// require 'policies-admin'. Public reads + posts hit
// /api/policy-comments-public on the proxy directly, no role gate.
app.all('/api/crm-proxy/policy-comments*', ...createCrmProxy('policy-comments', ['policies-admin']));

// RBAC admin CRUD — ADMIN ONLY. Powers the Access-Admin UI (edits Staff_App_Roles +
// Staff_Page_Access on the proxy). requireCrmRole(['admin']) + the proxy's secret gate.
app.all('/api/crm-proxy/admin-rbac*', ...createCrmProxy('admin-rbac', ['admin']));

// Caspio call meter + quota pacing — ADMIN ONLY. Powers /dashboards/api-usage.html.
// Upstream (/api/admin/metrics, /api/admin/usage) is requireCrmApiSecret-gated, so the
// browser MUST come through here — the secret never reaches the client.
//
// ⚠️ The path segment must MATCH upstream. createCrmProxy derives the target by
// string-replacing the endpoint name out of req.originalUrl, so a prettier alias
// like 'admin-metrics' would build /api/admin-metrics (404) and fail to strip the
// prefix, mangling the query string.
app.all('/api/crm-proxy/admin/metrics*', ...createCrmProxy('admin/metrics', ['admin']));
app.all('/api/crm-proxy/admin/usage*', ...createCrmProxy('admin/usage', ['admin']));

// Customer Portal admin — CRUD on the Customer_Portal_Access invite registry. Powers the
// "Customer Portals" staff console. Role-gated (the management team) + the proxy's secret.
app.all('/api/crm-proxy/customer-portal-access*', ...createCrmProxy('customer-portal-access', PORTAL_ADMIN_ROLES));
// Customer lookup for the "add customer" search (resolve a contact → id_Customer + company).
// company-contacts/search is secret-gated; staff builders use the relay above, while proxying it
// keeps the admin page same-origin + role-gated + carries the secret harmlessly.
app.all('/api/crm-proxy/company-contacts*', ...createCrmProxy('company-contacts', PORTAL_ADMIN_ROLES));
// Re-order request work-queue (Phase 4) — the console's "Requests" tab lists/updates/deletes
// Portal_Reorder_Requests via the proxy portal-reorder route (GET /requests, PUT/DELETE /requests/:pk).
app.all('/api/crm-proxy/portal-reorder*', ...createCrmProxy('portal-reorder', PORTAL_ADMIN_ROLES));
// Reward dollars (Phase 5) — the console reads a customer's ledger/balance here. WRITES go
// through the dedicated /api/portal-admin/rewards/entry (which stamps the staff email).
app.all('/api/crm-proxy/customer-rewards*', ...createCrmProxy('customer-rewards', PORTAL_ADMIN_ROLES));

// The verified session email is the ONLY source of truth for audit-attribution
// fields — the client body used to supply Updated_By/Created_By, so any staffer
// could attribute an edit / timeline note to a colleague. Overwrite it server-side.
function stampSessionIdentity(field) {
  return (req, res, next) => {
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
      if (email) req.body[field] = email;
    }
    next();
  };
}

// Hard-delete a lead — ADMIN ONLY, enforced HERE (identity from the session, never
// the request). Registered BEFORE the generic mount so it wins the route match; the
// deletedBy is appended server-side from the verified session. Mirrors the
// quote_sessions delete precedent. The proxy DELETE cascades the lead's timeline.
app.delete('/api/crm-proxy/form-submissions/:submissionId', requireCrmRole(['admin']), async (req, res) => {
  try {
    const caller = req.session && req.session.crmUser;
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    const email = String(caller.email || '').toLowerCase();
    const id = encodeURIComponent(req.params.submissionId);
    const url = `${CRM_API_BASE}/api/form-submissions/${id}?deletedBy=${encodeURIComponent(email)}`;
    const response = await fetch(url, { method: 'DELETE', headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) console.log(`[lead-delete] ${email} deleted ${req.params.submissionId}`);
    else console.warn(`[lead-delete] BLOCKED/failed ${req.params.submissionId} for ${email} → ${response.status}`);
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[lead-delete] error:', err.message);
    res.status(500).json({ error: 'Delete failed', message: err.message });
  }
});

// ── Sample-order push forwarder (PUBLIC by necessity) ────────────────────────
// The last anonymous route on the proxy: POST /api/manageorders/orders/create
// creates a real ShopWorks order, and pages/sample-cart.html posted to it
// DIRECTLY from the browser at a hardcoded proxy URL.
//
// 🔴 This one CANNOT take requireStaff. Unlike every Box caller, the sample cart
// is a CUSTOMER flow — there is no SAML session to prove. So this forwarder is
// deliberately public, and what it buys is:
//   · the proxy route stops being an open order-creation endpoint to the entire
//     internet — only this app can reach it, using the shared secret
//   · abuse controls live in one place we own (strictLimiter, 20/hr per IP,
//     the same bucket the other order-submission endpoints use)
//   · the payload is validated and bounded before it can reach ShopWorks
//
// ⚠️ BE CLEAR ABOUT WHAT THIS IS NOT: order creation is still unauthenticated.
// A determined caller can still POST here. The real fix is verifying a payment
// before pushing to ShopWorks — a product change, not plumbing.
function validateSampleOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be an object';
  if (typeof body.orderNumber !== 'string' || !body.orderNumber.trim() || body.orderNumber.length > 64) {
    return 'orderNumber must be a non-empty string under 64 chars';
  }
  if (!body.customer || typeof body.customer !== 'object') return 'customer object is required';
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) return 'lineItems must be a non-empty array';
  if (body.lineItems.length > 200) return 'lineItems exceeds 200';
  if (body.files !== undefined) {
    if (!Array.isArray(body.files)) return 'files must be an array';
    if (body.files.length > 5) return 'files exceeds 5';
    for (const f of body.files) {
      if (!f || typeof f !== 'object') return 'each file must be an object';
      // ~4 MB of base64. bodyParser caps the whole request at 5 MB anyway; this
      // rejects the pathological single-file case with a clear message.
      if (typeof f.fileData === 'string' && f.fileData.length > 5.6e6) return 'file too large';
    }
  }
  return null;
}

/**
 * Prove server-side that a FREE-path order really is free.
 *
 * 🔴 THE HOLE THIS CLOSES. The cart decides free-vs-paid in the BROWSER:
 *   if (SampleCheckout.hasPaid(samples)) { start Stripe checkout; return; }
 * and hasPaid() simply trusts `s.type === 'paid'` off the client object. Paid
 * carts are handled correctly — Stripe hosted checkout, then the
 * signature-verified webhook (`metadata.kind === 'samples-order'`) pushes the
 * order with a PAID payments block. But a doctored payload that labels paid
 * samples as free, or just posts `price: 0`, skips that branch entirely and
 * lands a real ShopWorks order for goods nobody paid for.
 *
 * So this repeats what the paid route already does — "client prices are
 * advisory" — using the SAME repricer (shared_components/js/sample-pricing.js)
 * and the SAME data path (/api/size-pricing, /api/pricing-bundle fallback).
 * No second pricing path: if the authoritative price is not zero, the order is
 * refused and the customer is sent through checkout.
 */
async function verifySampleOrderIsFree(lineItems) {
  const seen = new Set();
  for (const item of lineItems) {
    const style = String((item && item.partNumber) || '').trim().toUpperCase();
    const size = String((item && item.size) || '').trim();
    if (!style || !size) return { ok: false, status: 400, error: 'Each sample needs a style and a size.' };
    // One sample per style, same rule the paid route enforces.
    if (seen.has(style + '|' + size)) {
      return { ok: false, status: 400, error: `Duplicate sample in the cart: ${style} ${size}.` };
    }
    seen.add(style + '|' + size);

    const spr = await fetch(`${TDT_PROXY}/api/size-pricing?styleNumber=${encodeURIComponent(style)}`);
    const rows = spr.ok ? await spr.json() : null;
    let result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: null, size });
    if (!result.eligible && result.reason === 'no_margin') {
      const br = await fetch(`${TDT_PROXY}/api/pricing-bundle?method=BLANK&styleNumber=${encodeURIComponent(style)}`);
      const bundle = br.ok ? await br.json() : null;
      result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: bundle, size });
    }
    if (!result.eligible) {
      return {
        ok: false, status: 400,
        error: result.reason === 'bad_size'
          ? `${style} isn’t offered in size ${size} — remove it and try again.`
          : `${style} isn’t available as an online sample right now — remove it, or call 253-922-5793.`,
      };
    }
    // The whole point: this path is for FREE samples only.
    if (result.type !== 'free' || result.price > 0) {
      console.warn(`[sample-order] BLOCKED free-path push: ${style} ${size} prices at $${result.price}`);
      return {
        ok: false, status: 402,
        error: `${style} (${size}) is a paid sample — please check out so payment is collected. Nothing was ordered.`,
      };
    }
  }
  return { ok: true };
}

app.post('/api/manageorders/orders/create', strictLimiter, async (req, res) => {
  if (!CRM_API_SECRET) {
    console.error('[sample-order] CRM_API_SECRET is not set — refusing to forward');
    return res.status(503).json({ error: 'Order service is not configured' });
  }
  const invalid = validateSampleOrder(req.body);
  if (invalid) {
    console.warn('[sample-order] rejected: ' + invalid);
    return res.status(400).json({ error: invalid });
  }
  try {
    // Reprice BEFORE forwarding — a paid item must never reach ShopWorks
    // through this route.
    const freeCheck = await verifySampleOrderIsFree(req.body.lineItems);
    if (!freeCheck.ok) {
      return res.status(freeCheck.status).json({ error: freeCheck.error });
    }
  } catch (err) {
    // Erik's #1 rule: never let a pricing lookup fail OPEN into a free order.
    console.error('[sample-order] reprice check failed:', err.message);
    return res.status(502).json({ error: 'Could not verify sample pricing — nothing was ordered. Please try again.' });
  }
  try {
    const upstream = await fetch(`${CRM_API_BASE}/api/manageorders/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.set('Cache-Control', 'no-store');
    return res.send(text);
  } catch (err) {
    console.error('[sample-order] forward failed:', err.message);
    return res.status(502).json({ error: 'Order submission failed' });
  }
});




app.get('/api/box/thumbnail/:fileId', requireStaff, boxForward(req => 'thumbnail/' + boxFileId(req)));
app.get('/api/box/download/:fileId', requireStaff, boxForward(req => 'download/' + boxFileId(req)));
app.get('/api/box/art-folders', requireStaff, boxForward(() => 'art-folders'));
app.get('/api/box/mockup-folders', requireStaff, boxForward(() => 'mockup-folders'));
app.get('/api/box/folder-files', requireStaff, boxForward(() => 'folder-files'));
app.get('/api/box/search', requireStaff, boxForward(() => 'search'));
// shared-image takes a caller-supplied ?url=; the PROXY is what validates it is
// a box.com URL, so this only carries it across — it never fetches it itself.
app.get('/api/box/shared-image', requireStaff, boxForward(() => 'shared-image'));

// ── Box WRITE routes, same session gate (2026-08-05) ─────────────────────────
// Every page that calls these is already SAML-gated (verified: ae-dashboard,
// art-hub-steve, bradley-*, art-request-detail, mockup-detail, transfer-detail
// all 302 anonymously), so unlike the reads there was no public caller to work
// around — the forwarder is the whole fix.
//
// Body handling differs per route and that distinction is load-bearing:
//   'json'   — bodyParser.json (mounted globally above) has ALREADY consumed and
//              parsed the stream, so it must be re-serialised from req.body.
//              Piping req here would send an empty body.
//   'stream' — multipart. bodyParser.json ignores it precisely because the
//              content-type doesn't match, so req is still unread and can be
//              piped straight through. That also means the app never buffers a
//              20 MB upload; it just relays it.
//   'none'   — DELETE carries no body.
//
// `force=true` is the only query any write route uses (delete confirmation).
const BOX_FORWARD_WRITE_QUERY = new Set(['force']);

function boxForwardWrite(suffix, mode) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[box-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Box proxy is not configured' });
    }
    let target;
    try {
      target = `${CRM_API_BASE}/api/box/${typeof suffix === 'function' ? suffix(req) : suffix}`;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (BOX_FORWARD_WRITE_QUERY.has(k) && typeof v === 'string') qs.set(k, v);
    }
    if (qs.toString()) target += '?' + qs;

    const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
    let body;
    if (mode === 'json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body || {});
    } else if (mode === 'stream') {
      // Carry the multipart boundary and length across verbatim, or the
      // proxy's multer cannot parse the parts.
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
      if (req.headers['content-length']) headers['Content-Length'] = req.headers['content-length'];
      body = req;
    }

    try {
      const upstream = await fetch(target, { method: req.method, headers, body });
      res.status(upstream.status);
      // content-length omitted for the reason spelled out in boxForward above:
      // the piped body is inflated, upstream's length is not. Latent rather than
      // live here — write responses run 30-200 bytes so the proxy never gzips
      // them — except DELETE's 409 "file in use" body, which carries one entry
      // per referencing record and crosses 1 KB at ~13 references.
      for (const h of ['content-type', 'content-disposition']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.setHeader('Cache-Control', 'no-store');
      if (!upstream.body) return res.end();
      upstream.body.pipe(res);
      upstream.body.on('error', (err) => {
        console.error('[box-forward] upstream stream error:', err.message);
        res.destroy(err);
      });
    } catch (err) {
      console.error('[box-forward] ' + req.method + ' ' + target + ' failed:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Box request failed' });
    }
  };
}

app.post('/api/box/shared-link', requireStaff, boxForwardWrite('shared-link', 'json'));
app.post('/api/box/create-mockup-folder', requireStaff, boxForwardWrite('create-mockup-folder', 'json'));
app.post('/api/box/upload-to-folder', requireStaff, boxForwardWrite('upload-to-folder', 'stream'));
app.delete('/api/box/file/:fileId', requireStaff, boxForwardWrite(req => 'file/' + boxFileId(req), 'none'));

// ── Mockup data forwarder (session-gated) ────────────────────────────────────
// The same move as the Box forwarder above, for the mockup RECORD data.
//
// The proxy gates these reads secret-OR-browser-Origin, and an Origin header is
// caller-controlled: `curl -H 'Origin: https://www.teamnwca.com'` reproduces a
// staff browser exactly and returns Company_Name, Id_Customer, Work_Order_Number
// and AE_Notes — in bulk from the list route, which will happily return 500 rows.
// The browser cannot hold a secret, so the fix is the one that already worked for
// Box: the page calls THIS origin, the SAML cookie rides along, requireStaff
// proves the session server-side, and only the app holds the secret used upstream.
// Once every caller is repointed here the proxy reads go secret-only and the
// Origin bypass disappears.
//
// 🔴 GET reads only, deliberately. The CUSTOMER approval view (?view=customer)
// performs writes — PUT /api/mockups/:id/status and POST /api/mockup-notes — with
// no staff session to prove, so routing writes through requireStaff would break
// approve/revise. Those stay on the proxy until they get the capability-token
// treatment the portal read bundle already has.
//
// Params are rebuilt from an allowlist rather than passed through, so a caller
// cannot smuggle anything into the upstream query. This list is taken from the
// actual call sites, not guessed: art-hub-ruth and ae-dashboard send orderBy+limit,
// portal-directory dateFrom+pageSize, design-gallery designNumber+limit, and the
// broken-mockups scan sends refresh.
const MOCKUP_FORWARD_QUERY = new Set([
  'designNumber', 'idCustomer', 'dateFrom', 'dateTo', 'orderBy', 'limit', 'pageSize', 'refresh',
  'since', 'user', // mockup-notifications poll
]);

function mockupForward(buildPath) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[mockup-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Mockup proxy is not configured' });
    }
    let suffix;
    try {
      suffix = buildPath(req);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (MOCKUP_FORWARD_QUERY.has(k) && typeof v === 'string') qs.set(k, v);
    }
    const target = `${CRM_API_BASE}/api/${suffix}${qs.toString() ? '?' + qs : ''}`;
    try {
      const upstream = await fetch(target, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
        signal: AbortSignal.timeout(20000),
      });
      const body = await upstream.text();
      // Customer data behind a per-session gate must never sit in a shared cache.
      res.status(upstream.status)
        .type(upstream.headers.get('content-type') || 'application/json')
        .set('Cache-Control', 'no-store')
        .send(body);
    } catch (err) {
      console.error('[mockup-forward] ' + target + ' failed:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Mockup request failed' });
    }
  };
}

// Mockup ids are numeric; anything else is rejected rather than forwarded.
function mockupRecordId(req) {
  const id = String(req.params.id || '');
  if (!/^\d{1,12}$/.test(id)) throw new Error('Invalid mockup id');
  return id;
}

// 🔴 The literal segment MUST be registered before the :id pattern, or Express
// captures 'broken-mockups' as an id. mockupRecordId()'s numeric check makes that
// safe even if the order were wrong — but both guards exist because relying on
// registration order alone is how this breaks the day someone loosens the regex.
app.get('/api/mockups/broken-mockups', requireStaff, mockupForward(() => 'mockups/broken-mockups'));
app.get('/api/mockups', requireStaff, mockupForward(() => 'mockups'));
app.get('/api/mockups/:id', requireStaff, mockupForward(req => 'mockups/' + mockupRecordId(req)));
app.get('/api/mockup-notes/:id', requireStaff, mockupForward(req => 'mockup-notes/' + mockupRecordId(req)));
app.get('/api/mockup-versions/:id', requireStaff, mockupForward(req => 'mockup-versions/' + mockupRecordId(req)));
// The notification feed looks harmless and is not: each entry carries companyName
// and designNumber, and the handler only filters by ?user= when that param is
// present — so an anonymous poll with no user returns EVERY queued notification.
// In-memory and pruned, so it is usually empty, which is exactly why it went
// unnoticed.
app.get('/api/mockup-notifications', requireStaff, mockupForward(() => 'mockup-notifications'));

// ── DTG print-box calibration WRITES (admin only) ────────────────────────────
// The calibration tool (/tools/custom-tees-calibrate.html) used to POST and
// DELETE straight from the browser to the proxy, which required no credentials
// at all — so anyone who knew the URL could move or delete the print box for
// every style. That does not leak data; it silently misprints customer orders,
// which is worse to discover.
//
// 🔴 THE GET DELIBERATELY STAYS OPEN AND IS NOT FORWARDED. The PUBLIC customer
// designer at /custom-tees (verified 200 anonymously) reads
// GET /api/dtg-calibration?styleNumber=… via pages/js/custom-tees-app.js:433.
// Gating that would break the customer-facing tee designer. Only the writes are
// the hole, so only the writes move behind the session. Same lesson as the Box
// gating: check for a public caller BEFORE adding a secret.
//
// requirePageAccess (not requireStaff) so ONE Staff_Page_Access rule governs
// both the page and its writes — matching custom-tees-calibrate.html's entry in
// ADMIN_DEFAULT_PAGES, and letting Erik widen access from Caspio with no deploy.
//
// ⚠️ DEPLOY ORDER: this app change must be LIVE BEFORE the proxy starts
// requiring the secret on those two routes, or the tool breaks in between.
function dtgCalibrationForwardWrite(buildSuffix, mode) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[dtg-calibration-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Calibration proxy is not configured' });
    }
    let target;
    try {
      target = `${CRM_API_BASE}/api/dtg-calibration${buildSuffix(req)}`;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
    let body;
    if (mode === 'json') {
      // bodyParser.json has already consumed the stream, so it must be
      // re-serialised — piping req here would send an empty body.
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body || {});
    }
    try {
      const upstream = await fetch(target, { method: req.method, headers, body });
      const text = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(text);
    } catch (err) {
      console.error('[dtg-calibration-forward] ' + target + ' failed:', err.message);
      if (!res.headersSent) return res.status(502).json({ error: 'Calibration request failed' });
    }
  };
}

// Caspio PK_ID is numeric; anything else is rejected rather than forwarded, so a
// caller cannot smuggle path segments into the upstream URL.
function dtgCalibrationPkId(req) {
  const id = String(req.params.pkId || '');
  if (!/^\d{1,15}$/.test(id)) throw new Error('Invalid calibration record id');
  return '/' + id;
}

// No express.json() here: bodyParser.json is mounted globally (~L1837), so
// req.body is already parsed by the time this runs — which is exactly why the
// forwarder re-serialises it instead of piping req.
app.post('/api/dtg-calibration',
  requirePageAccess('custom-tees-calibrate.html'),
  dtgCalibrationForwardWrite(() => '', 'json'));

app.delete('/api/dtg-calibration/:pkId',
  requirePageAccess('custom-tees-calibrate.html'),
  dtgCalibrationForwardWrite(dtgCalibrationPkId, 'none'));

// ── Contract embroidery COST MODEL (staff only) ──────────────────────────────
// Feeds the margin overlay on /calculators/embroidery-contract/.
//
// 🔴 That calculator is served by the PUBLIC `/calculators` static mount — it is
// deliberately reachable without a login (Ruthie's desk AND ASI distributors).
// So the cost side can NEVER live in its JS: anything shipped to that page is
// readable by every distributor who has the link. It lives here instead, behind
// requireStaff, exactly like /pricing/decals is gated "because it exposes
// cost-side rate bands".
//
// requireStaff answers /api/* with 401 JSON, which doubles as the page's
// "am I staff?" probe — a 401 simply means the overlay never renders.
//
// Figures are the settled 2026-07-30 allocation model (memory/COST_ALLOCATION_MODEL.md).
// Env vars let Erik retune without a deploy; `asOf` is returned so a stale model
// is visible on screen instead of silently trusted.
app.get('/api/contract-embroidery/cost-model', requireStaff, (req, res) => {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  res.set('Cache-Control', 'no-store');   // never cached into a shared proxy
  res.json({
    // Fully-loaded production hour — art INCLUDED (the 2026-07-30 decision).
    productionHourRate: num(process.env.EMB_PRODUCTION_HOUR_RATE, 30.09),
    // Per-ORDER overhead pool. Flat $70 is the settled figure; the $100
    // driver-based variant is deliberately not the default.
    orderPool: num(process.env.EMB_ORDER_POOL, 70),
    asOf: process.env.EMB_COST_MODEL_AS_OF || '2026-07-30',
    source: 'memory/COST_ALLOCATION_MODEL.md',
  });
});

// Form Submissions (Forms Inbox) — saved fillable-form twins. ANY logged-in staff
// (like unlisted dashboard pages), so we reuse the factory's forwarder but swap the
// role gate for requireStaff. Proxy side is secret-only (holds customer contact info).
// DELETE is 405'd here so no future proxy delete surface is any-staff-reachable —
// hard delete goes through the admin-only route above. Updated_By is session-stamped.
const [, formSubmissionsForwarder] = createCrmProxy('form-submissions', []);
app.all('/api/crm-proxy/form-submissions*', requireStaff, (req, res, next) => {
  if (req.method === 'DELETE') return res.status(405).json({ error: 'Deleting a lead requires the admin delete route.' });
  next();
}, stampSessionIdentity('Updated_By'), formSubmissionsForwarder);

// Leads board (dashboards/leads.html) order history — ORDER_ODBC reads for a
// matched ShopWorks customer. Any logged-in staff; the upstream /api/order-odbc
// is CRM-secret-gated on the proxy (2026-07-18), so browsers must come through here.
const [, orderOdbcForwarder] = createCrmProxy('order-odbc', []);
app.all('/api/crm-proxy/order-odbc*', requireStaff, orderOdbcForwarder);

// Leads CRM activity timeline (notes / status history / attachments on a lead) —
// Lead_Activity reads+appends. Any logged-in staff; secret-only upstream.
const [, leadActivityForwarder] = createCrmProxy('lead-activity', []);
app.all('/api/crm-proxy/lead-activity*', requireStaff, stampSessionIdentity('createdBy'), leadActivityForwarder);

// Leads CRM one-click outreach emails (preview + send-as-the-AE, logged to the
// timeline). Any logged-in staff; secret-only upstream.
const [, leadOutreachForwarder] = createCrmProxy('lead-outreach', []);
app.all('/api/crm-proxy/lead-outreach*', requireStaff, leadOutreachForwarder);

// Leads CRM "Send a marketing kit" — AEs request catalog/sample/sticker kits for a
// lead; Mikalah (shipping) works the queue (dashboards/marketing-shipments.html).
// Any logged-in staff; the upstream router holds recipient PII (secret-only).
const [, marketingShipmentsForwarder] = createCrmProxy('marketing-shipments', []);
app.all('/api/crm-proxy/marketing-shipments*', requireStaff, (req, res, next) => {
  // Stamp the requester/updater from the verified session (attribution, not trust).
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
    if (email) {
      if (req.body.requestedBy !== undefined || req.method === 'POST') req.body.requestedBy = email;
      if (req.body.Updated_By !== undefined || req.method === 'PUT') req.body.Updated_By = email;
    }
  }
  next();
}, marketingShipmentsForwarder);

// Jim's Mailing List (dashboards/jim-mailing-list.html) — the owner's manual
// prospect list. Any logged-in staff (it's an internal list, not the sales
// pipeline); the upstream Prospect_Mailing_List router is secret-only (holds
// contact info). Added_By (on create) + Updated_By (on writes) are stamped from
// the verified session so the browser can't attribute an edit to someone else.
const [, jimMailingListForwarder] = createCrmProxy('jim-mailing-list', []);
// 12mb body limit: the /extract sub-route accepts a pasted screenshot (base64).
app.all('/api/crm-proxy/jim-mailing-list*', requireStaff, express.json({ limit: '12mb' }), (req, res, next) => {
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
    if (email) {
      if (req.method === 'POST') req.body.Added_By = email;
      req.body.Updated_By = email;
    }
  }
  next();
}, jimMailingListForwarder);

// AE Mission Control aggregate feed — the ONE data call behind
// /dashboards/ae-mission-control.html. Identity comes from the verified SAML
// session, never the browser: we derive `email` server-side and only honor a
// ?viewAs= override for admins (Erik's view-as-rep switcher). Role-gated to
// the AEs + admin because the payload includes the rep's commission dollars.
function aeDashboardForwarder(upstreamPath) {
  return async (req, res) => {
    try {
      const caller = req.session.crmUser;
      const perms = caller.permissions || [];
      let email = String(caller.email || '').toLowerCase();
      const viewAs = String(req.query.viewAs || '').toLowerCase().trim();
      if (viewAs && perms.includes('admin')) email = viewAs; // admin-only override
      const params = new URLSearchParams({ email });
      if (req.query.refresh) params.set('refresh', String(req.query.refresh));
      const response = await fetch(`${CRM_API_BASE}${upstreamPath}?${params}`, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
      });
      const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
      res.status(response.status).json(data);
    } catch (error) {
      console.error(`[CRM Proxy] ae-dashboard ${upstreamPath} error:`, error.message);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  };
}
app.get('/api/crm-proxy/ae-dashboard/summary', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/summary'));
// Growth radar ("Money on the Table") — same identity rules as the summary.
app.get('/api/crm-proxy/ae-dashboard/growth', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/growth'));
// Purchasing tracker — JotForm "Purchasing" form (requests to Bradley) joined
// to the ShopWorks PurchaseOrders mirror (ordered/received) per work order.
app.get('/api/crm-proxy/ae-dashboard/purchasing', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/purchasing'));
// Data-quality radar ("Missing Info — Fix in ShopWorks") — restores the
// forwarder for the concurrent session's MC card after the 2026-07-19 server.js
// hotfix revert (its proxy endpoint /api/ae-dashboard/data-quality is live).
app.get('/api/crm-proxy/ae-dashboard/data-quality', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/data-quality'));
// Order Due Dates — unshipped ShopWorks orders that already missed their requested-ship
// date, or fall due within 7 days with the blanks not yet purchased/received (PurchaseOrders
// mirror join). Same identity rules as the summary.
// ⚠️ RE-REGISTERED 2026-07-26: shipped in df1b62d4, then lost in the aa33b66f "revert foreign
// vendor-portal server.js hunks" hotfix — the same revert that ate data-quality above. That
// one got restored; this one did not, so the MC card 404'd for both reps for a week. The UI
// harness could not catch it: tests/ui/test-ae-mission-control-stub.js replaces window.fetch
// wholesale and answers this URL itself, so route REGISTRATION must be probed live.
app.get('/api/crm-proxy/ae-dashboard/due-dates', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/due-dates'));
// Company-wide past-due roll-up — every rep, grouped, ?days= window (2026-08-10). The
// per-rep route above injects the caller's own email; this one deliberately does not, so
// it is the whole shop and gets a wider gate. Not aeDashboardForwarder: that helper's
// whole job is to attach the session email, which is exactly what must NOT happen here.
// requireStaff, not a role list (Erik, 2026-08-10): anyone logged into the staff
// dashboard should see this. Bradley raises the purchase orders and 12 of the 22
// past-due orders are waiting on a PO nobody has cut yet; production and receiving
// have the same reason to look. Still SAML-gated — never public.
app.get('/api/crm-proxy/ae-dashboard/due-dates-all', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
    const refresh = (req.query.refresh === '1' || req.query.refresh === 'true') ? '&refresh=1' : '';
    const r = await fetch(`${CRM_API_BASE}/api/ae-dashboard/due-dates-all?days=${days}${refresh}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(60000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[due-dates-all]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});
// Q3 2026 Embroidery Bonus — activation bounties + growth ladder + $3M team kicker.
// Proxy side is secret-only (it exposes per-account customer names, revenue and payroll
// dollars), so browsers come through here. Role-gated to the two AEs + admin, same as the
// rest of the commission surfaces.
function embroideryBonusForwarder(upstreamPath, { injectIdentity = false, teamOnly = false } = {}) {
  return async (req, res) => {
    try {
      const caller = req.session.crmUser;
      const perms = caller.permissions || [];
      const params = new URLSearchParams();
      if (req.query.quarter) params.set('quarter', String(req.query.quarter));
      if (req.query.year) params.set('year', String(req.query.year));
      // Cache bypass for the page's Refresh button. Without this the bonus hero and the
      // target roadmap kept serving cache while every other card re-pulled — a Refresh
      // that half works is worse than one that doesn't (added 2026-07-26).
      if (req.query.refresh) params.set('refresh', String(req.query.refresh));
      // Call list only: 'top' hydrates phone/email for the first 15 rows, 'all' for the rest
      // when the rep presses "See more". Whitelisted rather than forwarded raw so the query
      // can't be used to force the expensive path.
      if (req.query.hydrate === 'all') params.set('hydrate', 'all');
      // scope=team is forced server-side, never read from the query — a caller on the
      // shared-dashboard route can't widen it into per-rep compensation.
      if (teamOnly) params.set('scope', 'team');
      if (injectIdentity) {
        // Identity from the verified SAML session, never the browser. Admins may
        // view as another rep (Erik's switcher); a rep can only ever see their own.
        let email = String(caller.email || '').toLowerCase();
        const viewAs = String(req.query.viewAs || '').toLowerCase().trim();
        if (viewAs && perms.includes('admin')) email = viewAs;
        if (perms.includes('admin') && !viewAs) {
          // Admin with no override: return every rep (omit email entirely).
        } else {
          params.set('email', email);
        }
      }
      const response = await fetch(`${CRM_API_BASE}${upstreamPath}?${params}`, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
      });
      const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
      res.status(response.status).json(data);
    } catch (error) {
      console.error(`[CRM Proxy] embroidery-bonus ${upstreamPath} error:`, error.message);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  };
}
// Per-rep figures. Identity injected from the session: a rep only ever receives their own
// numbers, and an admin with no ?viewAs= gets every rep (the Erik overview).
app.get('/api/crm-proxy/embroidery-bonus',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus', { injectIdentity: true }));
app.get('/api/crm-proxy/embroidery-bonus/config',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/config'));
// 🔒 TEAM-ONLY feed for the shared staff dashboard, which EVERY employee opens.
// Returns the company Q3 number and the kicker tiers — never a rep's earnings. Open to any
// logged-in staff precisely because it carries no compensation.
app.get('/api/crm-proxy/embroidery-bonus/team',
  requireStaff,
  embroideryBonusForwarder('/api/embroidery-bonus', { teamOnly: true }));
// Dormant call list — the 378 accounts with embroidery history gone quiet 12+ months.
// Identity injected so a rep sees only their own book.
app.get('/api/crm-proxy/embroidery-bonus/dormant',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/dormant', { injectIdentity: true }));
// Target roadmap — who to call to earn more: win-backs, never-embroidered accounts that
// already buy from us, and accounts a nudge away from a bounty. Identity-injected.
app.get('/api/crm-proxy/embroidery-bonus/targets',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/targets', { injectIdentity: true }));
// Call list — the same three plays merged into ONE ranked order of work, with a phone
// number attached and the rep's own call history folded in. Identity-injected: this
// carries customer phone numbers and contact names, so a rep sees only their own book.
app.get('/api/crm-proxy/embroidery-bonus/call-list',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/call-list', { injectIdentity: true }));

// Purchasing Portal — company-wide view of the same feed (every request to
// Bradley + requester + status). ANY logged-in staff; no identity injection.
app.get('/api/crm-proxy/purchasing-portal', requireStaff, async (req, res) => {
  try {
    // ?refresh=1 is the portal's Refresh button — forwarded so the proxy rebuilds
    // instead of re-serving its 15-minute cache (2026-09-05).
    const refresh = (req.query.refresh === '1' || req.query.refresh === 'true') ? '?refresh=1' : '';
    const response = await fetch(`${CRM_API_BASE}/api/ae-dashboard/purchasing-all${refresh}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
    });
    const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[CRM Proxy] purchasing-portal error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
});

// Leads CRM conversion tracking + rep scorecard (dashboards/lead-scorecard.html):
// GET /lead-scorecard (per-rep closes + order value) — any logged-in staff;
// secret-only upstream. The auto-Won run/scan stay admin-key server-side.
const [, leadScorecardForwarder] = createCrmProxy('lead-scorecard', []);
app.all('/api/crm-proxy/lead-scorecard*', requireStaff, leadScorecardForwarder);

// Leads CRM "Rescan with Claude" — classify newly-arrived leads (spam/
// unqualified/qualified) on demand. Any logged-in staff; secret-only upstream.
const [, leadClassifyForwarder] = createCrmProxy('lead-classify', []);
app.all('/api/crm-proxy/lead-classify*', requireStaff, leadClassifyForwarder);

// Blog Editor (dashboards/blog-editor.html) — staff write posts through this
// forwarder (adds the CRM secret the proxy's gateWritesOnly demands; also lets
// the editor list/read Drafts, which the public blog-posts endpoint hides).
// Gated by the SAME Staff_Page_Access row as blog-editor.html (2026-07-28): this
// endpoint PUBLISHES TO THE PUBLIC SITE, and it was requireStaff — so gating only
// the page would have left any logged-in staffer able to POST here directly. One
// rule now controls the page and its writes together, and they can't drift.
// (Public /blog reads don't touch this route; they use lib/blog.js.)
const [, blogPostsForwarder] = createCrmProxy('blog-posts', []);
app.all('/api/crm-proxy/blog-posts*', requirePageAccess('blog-editor.html'), blogPostsForwarder);

};
