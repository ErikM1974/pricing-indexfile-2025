// routes/staff-api.js — Staff dashboard forwarders (ManageOrders reads, payments, quote sessions, SanMar invoices + FTP, finished photos, command search)
// Extracted VERBATIM from server.js lines 5048-5480 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, express, fetch, moForwardTo, requireCrmRole, requirePageAccess, requireStaff } = ctx;

app.get('/api/mo/orders', requireStaff, moForwardTo(() => 'orders'));
app.get('/api/mo/orders/:no', requireStaff, moForwardTo(req => 'orders/' + encodeURIComponent(req.params.no)));
app.get('/api/mo/lineitems/:no', requireStaff, moForwardTo(req => 'lineitems/' + encodeURIComponent(req.params.no)));

// 2026-08-10 — the rest of the ManageOrders read surface, so the proxy side can be
// gated. These were NEVER covered by the proxy's gate: it protects four sub-prefixes
// (/orders, /lineitems, /tracking, /auth) while the router itself mounts at /api, so
// everything else in that file answered the public internet. Verified live before this
// change: GET /api/manageorders/customers returned 200 with ~85 KB of customer names,
// ContactEmail and ContactPhone to an anonymous request, and /payments/:no returned a
// real order's payment records.
//
// /customers is the big one — deduplicateCustomers() emits ContactEmail + ContactPhone
// (proxy src/utils/manageorders.js:425-426) for every customer with an order in the
// last 60 days. Live callers are exactly two, both on pages that already load
// mo-fetch.js: pages/js/art-request-detail.js and pages/js/mockup-detail.js.
// (shared_components/js/manageorders-customer-service.js is loaded by no page, and
// staff-dashboard-service.js only declares it in an endpoints map nothing reads —
// both dead, both verified 2026-08-10, neither migrated.)
app.get('/api/mo/customers', requireStaff, moForwardTo(() => 'customers'));
app.get('/api/mo/payments', requireStaff, moForwardTo(() => 'payments'));
app.get('/api/mo/payments/:no', requireStaff, moForwardTo(req => 'payments/' + encodeURIComponent(req.params.no)));
app.get('/api/mo/getorderno/:id', requireStaff, moForwardTo(req => 'getorderno/' + encodeURIComponent(req.params.id)));
app.get('/api/mo/order/:id/snapshot', requireStaff, moForwardTo(req => 'order/' + encodeURIComponent(req.params.id) + '/snapshot'));

// Order_Payments ledger READ for the staff dashboard's Money Collected widget
// (2026-07-06). The proxy mounts /api/order-payments behind the CRM secret
// (payer emails = PII), so the browser goes through this staff-session-gated
// same-origin forwarder — same airtight pattern as /api/mo/* above.
app.get('/api/staff/payments/recent', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const r = await fetch(`${CRM_API_BASE}/api/order-payments/recent?limit=${limit}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[payments-forward]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

// ── Staff-dashboard reads that used to hit the proxy base DIRECTLY (2026-08-27) ──
// The dashboard's quote-book, per-rep-YTD and art-request reads bypassed the
// same-origin forwarder pattern and called the public Heroku proxy, where those
// routes are rate-limited but NOT authed. These three requireStaff relays move
// the dashboard onto the airtight path (same shape as /api/mo/*), so the proxy
// side can later be tightened to secret-only WITHOUT breaking this page.
// ⚠️ That proxy lock is a separate staged migration (other public pages still
// read these routes directly) — deploy relays everywhere FIRST, proxy gate LAST.
function staffProxyForward(buildApiPath) {
  return async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
    try {
      const qi = req.originalUrl.indexOf('?');
      const qs = qi >= 0 ? req.originalUrl.slice(qi) : '';
      const url = `${CRM_API_BASE}/api/${buildApiPath(req)}${qs}`;
      const r = await fetch(url, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
    } catch (e) {
      console.error('[staff-forward]', req.originalUrl, e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  };
}
app.get('/api/staff/quote-sessions', requireStaff, staffProxyForward(() => 'quote_sessions'));
app.get('/api/staff/daily-sales-by-rep-ytd', requireStaff, staffProxyForward(() => 'caspio/daily-sales-by-rep/ytd'));
app.get('/api/staff/artrequests', requireStaff, staffProxyForward(() => 'artrequests'));
// Service_Codes reads for staff pages (2026-09-04): the company annual goal row
// CO-ANNUAL-GOAL feeds the dashboard goal chip + Company Numbers "% of goal".
// Read-only; the proxy route is public anyway — this keeps the browser same-origin.
app.get('/api/staff/service-codes', requireStaff, staffProxyForward(() => 'service-codes'));

// Staff roster for the dashboard's Team widget + staff directory (2026-08-27).
// The roster used to be hardcoded in shared_components/js/.../employees-service.js
// (plus a dead legacy copy), both served ANONYMOUSLY by the static mounts — names,
// birthdays, hire dates and termination dates readable by anyone. Same fix as
// drive-access: data in lib/ (never statically served), read through a gated
// route. requireStaff (not requirePageAccess) — this feeds the any-staff
// dashboard home. To update the roster, edit lib/staff-roster.js and deploy.
app.get('/api/staff/employees', requireStaff, (req, res) => {
  try {
    const roster = require('../lib/staff-roster');
    res.set('Cache-Control', 'no-store');
    res.json(roster);
  } catch (e) {
    console.error('[staff-roster] unreadable:', e.message);
    res.status(500).json({ error: 'roster_unavailable' });
  }
});

// SanMar Payables page (2026-07-20) — pulls SanMar invoices live from the SOAP
// Invoicing service for a date range. The proxy /api/sanmar-invoices/by-date is
// only rate-limited (not PII-gated), but this is finance data, so the browser
// goes through this staff-session-gated same-origin forwarder. Sending the CRM
// secret also skips the proxy's per-IP SanMar rate limit. Validates the dates and
// enforces SanMar's ≤3-month window before forwarding.
// ---------------------------------------------------------------------------
// Drive Access Center — the NCA-FS01 drive map (Admin → Access & Policy).
//
// WHY THIS IS A ROUTE AND NOT A STATIC FILE (2026-08-24)
// The obvious build puts the snapshot in /dashboards/js/drive-access.js. That would
// publish it: the /dashboards gate returns next() for anything not ending in .html,
// so its .js and .css are served to anyone, signed in or not (verified live — GET
// /dashboards/js/past-due-orders.js is a 200 with no session). The payload is UNC
// paths, share names and the npi_admin / nweadmin file-admin account names — exactly
// the reconnaissance an attacker wants, and Erik asked for admins only.
//
// So the data lives in lib/ (never statically served) and comes through here behind
// requirePageAccess('drive-access.html'): the same Caspio Staff_Page_Access row that
// governs the page governs its data, per the house page/API-twin rule. The page is
// also in ADMIN_DEFAULT_PAGES, so with no row at all it is admin-only, not any-staff.
//
// Read-only by design — nothing here writes a mapping, an ACL or an account. To
// update the snapshot, re-verify the GPO / AD groups / folder ACLs, edit the JSON,
// bump verifiedAt, and deploy.
// ---------------------------------------------------------------------------
app.get('/api/staff/drive-access', requirePageAccess('drive-access.html'), (req, res) => {
  try {
    const data = require('../lib/drive-access-data.json');
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    console.error('[drive-access] snapshot unreadable:', e.message);
    res.status(500).json({ error: 'snapshot_unavailable' });
  }
});

// SECURITY (2026-07-28): the SanMar Payables data routes below were requireStaff —
// any logged-in staffer could pull vendor invoice + payables dollars. They now share
// ONE gate with the page they feed (Staff_Page_Access → sanmar-payables.html, which
// defaults to admin), the same page/API-twin pattern payroll uses. To let Ruth or
// another accountant back in, add ONE row in Access Admin — no deploy, and the page
// and its data move together.
app.get('/api/staff/sanmar-invoices/by-date', requirePageAccess('sanmar-payables.html'), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const start = String(req.query.start || '').trim();
  const end = String(req.query.end || '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(start) || !iso.test(end)) return res.status(400).json({ error: 'start and end must be YYYY-MM-DD' });
  if (start > end) return res.status(400).json({ error: 'start must be on or before end' });
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  if (days > 100) return res.status(400).json({ error: 'range too large — SanMar allows at most a 3-month window' });
  try {
    const url = `${CRM_API_BASE}/api/sanmar-invoices/by-date?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const r = await fetch(url, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(30000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[sanmar-invoices-forward]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

// SanMar OPEN payables — GetUnpaidInvoices (what we still owe SanMar). Drives the
// SanMar Payables page's Invoices tab (the unpaid worklist). No params; the proxy
// caches it. Same staff gate + secret as the by-date forwarder.
app.get('/api/staff/sanmar-invoices/unpaid', requirePageAccess('sanmar-payables.html'), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/sanmar-invoices/unpaid`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(60000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[sanmar-unpaid-forward]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

// ─── SanMar FTP file downloads (ADMIN) ───────────────────────────────────────
// Drives /dashboards/sanmar-ftp-integration.html. Lists the data files SanMar
// publishes on their FTP (ftp.sanmar.com, user 6920) and streams the chosen one
// straight to the admin's browser — the web equivalent of the manual FileZilla
// step. The primary file, SanMarPI-Bulk-*.csv, is imported into the Caspio product
// master Sanmar_Bulk_251816_Feb2024 (the table every quote builder prices from).
// Requires SANMAR_FTP_PASSWORD as an app config var (never hardcoded). Only the
// allow-listed directories may be listed/downloaded — no arbitrary FTP paths.
const { Client: SanmarFtpClient } = require('basic-ftp');
const SANMAR_FTP_CFG = {
  host: process.env.SANMAR_FTP_HOST || 'ftp.sanmar.com',
  user: process.env.SANMAR_FTP_USER || '6920',
  password: process.env.SANMAR_FTP_PASSWORD || '',
  dirs: ['/SanMarPDD/SanMarPI/', '/SanMarPDD/']
};
const SANMAR_FTP_FILE_RE = /^[A-Za-z0-9._-]+\.(csv|txt|zip)$/i;
let _sanmarFtpListCache = { at: 0, data: null };

function sanmarFtpConnect() {
  const c = new SanmarFtpClient(60000); // 60s command timeout
  return c.access({
    host: SANMAR_FTP_CFG.host,
    user: SANMAR_FTP_CFG.user,
    password: SANMAR_FTP_CFG.password,
    secure: false
  }).then(() => c);
}

// List the allow-listed SanMar FTP folders (5-min cache; ?fresh=1 to bypass).
// Flags the newest SanMarPI-Bulk-*.csv as the pricing master.
app.get('/api/staff/sanmar-ftp/list', requireCrmRole(['admin']), async (req, res) => {
  if (!SANMAR_FTP_CFG.password) {
    return res.status(503).json({ error: 'not_configured',
      message: 'SanMar FTP password not set. Add SANMAR_FTP_PASSWORD to the app config vars.' });
  }
  if (!req.query.fresh && _sanmarFtpListCache.data && (Date.now() - _sanmarFtpListCache.at) < 5 * 60 * 1000) {
    return res.json(_sanmarFtpListCache.data);
  }
  let client;
  try {
    client = await sanmarFtpConnect();
    const files = [];
    for (const dir of SANMAR_FTP_CFG.dirs) {
      let entries;
      try { entries = await client.list(dir); }
      catch (e) { continue; } // a missing/denied dir shouldn't fail the whole list
      for (const f of entries) {
        if (f.isDirectory) continue;
        if (!SANMAR_FTP_FILE_RE.test(f.name)) continue;
        const mod = (f.modifiedAt instanceof Date) ? f.modifiedAt.toISOString() : (f.rawModifiedAt || null);
        files.push({ dir, name: f.name, size: f.size || 0, modifiedAt: mod });
      }
    }
    let masterKey = null, newest = -1;
    for (const f of files) {
      if (/^SanMarPI-Bulk-.*\.csv$/i.test(f.name)) {
        const t = f.modifiedAt ? (Date.parse(f.modifiedAt) || 0) : 0;
        if (t >= newest) { masterKey = f.dir + f.name; newest = t; }
      }
    }
    files.sort((a, b) => String(b.modifiedAt || '').localeCompare(String(a.modifiedAt || '')));
    const payload = { files, masterKey, checkedAt: new Date().toISOString() };
    _sanmarFtpListCache = { at: Date.now(), data: payload };
    res.json(payload);
  } catch (e) {
    console.error('[sanmar-ftp-list]', e.message);
    res.status(502).json({ error: 'ftp_error', message: e.message });
  } finally {
    if (client) client.close();
  }
});

// Stream one allow-listed SanMar FTP file to the browser as a download.
app.get('/api/staff/sanmar-ftp/download', requireCrmRole(['admin']), async (req, res) => {
  if (!SANMAR_FTP_CFG.password) {
    return res.status(503).json({ error: 'not_configured',
      message: 'SanMar FTP password not set. Add SANMAR_FTP_PASSWORD to the app config vars.' });
  }
  const dir = String(req.query.dir || '');
  const name = String(req.query.name || '');
  if (!SANMAR_FTP_CFG.dirs.includes(dir)) return res.status(400).json({ error: 'dir_not_allowed' });
  if (!SANMAR_FTP_FILE_RE.test(name)) return res.status(400).json({ error: 'bad_filename' });
  const remote = dir + name;
  let client;
  try {
    client = await sanmarFtpConnect();
    let size = 0;
    try { size = await client.size(remote); } catch (e) { /* size optional */ }
    res.setHeader('Content-Type', 'application/octet-stream'); // octet-stream → skip gzip, keep Content-Length
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    if (size > 0) res.setHeader('Content-Length', String(size));
    await client.downloadTo(res, remote);
    res.end();
  } catch (e) {
    console.error('[sanmar-ftp-download]', name, e.message);
    if (!res.headersSent) res.status(502).json({ error: 'ftp_error', message: e.message });
    else { try { res.end(); } catch (_) {} }
  } finally {
    if (client) client.close();
  }
});

// ShopWorks payables feed for the SanMar Payables page's automatic Imported?/Paid?
// cross-check (the bandit ODBC → Caspio ShopWorks_Payables sync). When this returns
// rows, the page skips the manual ShopWorks-CSV upload. Empty (sync not live yet) →
// the page falls back to upload. Staff-gated; adds the CRM secret upstream.
app.get('/api/staff/shopworks-payables', requirePageAccess('sanmar-payables.html'), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const sinceDays = Math.min(Math.max(parseInt(req.query.sinceDays, 10) || 365, 1), 3650);
  try {
    const r = await fetch(`${CRM_API_BASE}/api/shopworks-odbc/payables?sinceDays=${sinceDays}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(30000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[shopworks-payables-forward]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

// SanMar payable IMPORT LOG — self-managed "imported to ShopWorks" date-stamps
// (Caspio SanMar_Payable_Imports). The page reads the log to compute Imported? and
// filter the worklist; Erik stamps invoices when he imports them. No ShopWorks
// ODBC/upload dependency. Reads are staff-gated; writes add the CRM secret + the
// signed-in user's email so the stamp records who imported it.
app.get('/api/staff/sanmar-invoices/imports', requirePageAccess('sanmar-payables.html'), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const since = String(req.query.since || '').trim();
  const qs = /^\d{4}-\d{2}-\d{2}$/.test(since) ? `?since=${since}` : '';
  try {
    const r = await fetch(`${CRM_API_BASE}/api/sanmar-invoices/imports${qs}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(30000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[sanmar-imports-forward]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});

app.post('/api/staff/sanmar-invoices/mark-imported', requirePageAccess('sanmar-payables.html'), express.json(), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const body = Object.assign({}, req.body || {}, { importedBy: (req.session.crmUser && req.session.crmUser.email) || 'staff' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/sanmar-invoices/mark-imported`, {
      method: 'POST', headers: { 'x-api-secret': CRM_API_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    const txt = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(txt);
  } catch (e) { console.error('[sanmar-mark-imported-forward]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});

app.post('/api/staff/sanmar-invoices/unmark-imported', requirePageAccess('sanmar-payables.html'), express.json(), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/sanmar-invoices/unmark-imported`, {
      method: 'POST', headers: { 'x-api-secret': CRM_API_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(30000)
    });
    const txt = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(txt);
  } catch (e) { console.error('[sanmar-unmark-imported-forward]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});

// ── Finished-photo staff manage endpoints. The proxy gates GET(all)/PATCH/DELETE behind the CRM
//    secret, so forward them from here with the secret (requireStaff = SAML gate). The photo UPLOAD
//    (POST /api/finished-photos) goes to the proxy DIRECTLY from the browser (open + rate-limited),
//    same pattern as the mockup uploads — no multipart hop needed here. ──
app.get('/api/staff/finished-photos', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const id = String(req.query.idCustomer || '').replace(/\D/g, '');
  if (!id) return res.status(400).json({ error: 'idCustomer required' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/finished-photos?idCustomer=${id}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[finished-photos-forward:list]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});
// Company-wide photo library (photos joined with each account's rep) — feeds the Finished
// Photos Library page and Mission Control's "My Finished Photos" view. Query passthrough is
// whitelisted: rep / idCustomer / limit / refresh.
app.get('/api/staff/finished-photos/library', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const params = new URLSearchParams();
  const rep = String(req.query.rep || '').trim().slice(0, 80);
  if (rep) params.set('rep', rep);
  const id = String(req.query.idCustomer || '').replace(/\D/g, '');
  if (id) params.set('idCustomer', id);
  const limit = String(req.query.limit || '').replace(/\D/g, '');
  if (limit) params.set('limit', limit);
  if (String(req.query.refresh || '') === '1') params.set('refresh', '1');
  try {
    const qs = params.toString();
    const r = await fetch(`${CRM_API_BASE}/api/finished-photos/library${qs ? '?' + qs : ''}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(20000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[finished-photos-forward:library]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});
// Ctrl+K Everything Bar (2026-07-20 Phase 2) — forwards the dashboard command
// palette's query to the proxy's CRM-gated fan-out search (customers / orders /
// quotes / designs). Same airtight pattern as the other /api/staff forwarders.
app.get('/api/staff/command-search', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.status(400).json({ error: 'q must be 2-60 characters' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/command-search?q=${encodeURIComponent(q)}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[command-search-forward]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});
// Barcode / order-number lookup: a work-order scan ("142476" footer barcode or "40121Loc1"
// design-sheet barcode) resolves to the customer (+ design) so the crew skips the search.
app.get('/api/staff/finished-photos/lookup', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const code = String(req.query.code || '').trim().slice(0, 40);
  if (!code) return res.status(400).json({ error: 'code required' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/finished-photos/lookup?code=${encodeURIComponent(code)}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[finished-photos-forward:lookup]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});
app.patch('/api/staff/finished-photos/:pk', requireStaff, express.json(), async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const pk = String(req.params.pk || '').replace(/\D/g, '');
  if (!pk) return res.status(400).json({ error: 'bad id' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/finished-photos/${pk}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[finished-photos-forward:patch]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});
app.delete('/api/staff/finished-photos/:pk', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  const pk = String(req.params.pk || '').replace(/\D/g, '');
  if (!pk) return res.status(400).json({ error: 'bad id' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/finished-photos/${pk}`, {
      method: 'DELETE', headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) { console.error('[finished-photos-forward:delete]', e.message); res.status(502).json({ error: 'upstream_unavailable' }); }
});

};
