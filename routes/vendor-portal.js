// routes/vendor-portal.js — Vendor Portal — subcontractor magic-link login + screen-print job feed
// Extracted VERBATIM from server.js lines 5815-6350 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { BOX_THUMB_RE, CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, PORTAL_ADMIN_ROLES, PORTAL_FETCH_TIMEOUT_MS, PUBLIC_SITE_ORIGIN, SERVER_DIR, boxFileId, boxForward, channelConfig, computeOrderStatusToken, crypto, express, fetch, fetchQuoteSessionRow, path, portalProxyGet, rateLimit, requireCrmRole, safeLoginNext, sendEmailJSTemplate, vendorMagicLink } = ctx;

// =============================================================================
// Vendor Portal — subcontractor magic-link login + screen-print job feed
// =============================================================================
// First (and so far only) vendor: Ed Lacey at L&P Screen Printing. Replaces the
// email-everything-to-Ed process: Ed logs in passwordless (invite-only via the
// Vendor_Portal_Access Caspio table, Erik-editable) and sees every Screen Print
// transfer order (Transfer_Orders.Method='Screen Print') whose SP_Vendor matches
// his invite's Vendor_Name — job details, work-order lines, artwork/working-file
// downloads (Box shared links), and the activity timeline (he can post notes back).
// Mirrors the customer-portal stack 1:1: separate nwca_vendor cookie, live
// Enabled re-check (revoke in Caspio → dead within ~60s), session-scoped data
// endpoints with ALLOWLIST projections (staff emails / Supacolor internals never
// reach the vendor's browser).
const VENDOR_MAGIC_LINK_TEMPLATE = process.env.EMAILJS_TEMPLATE_VENDOR_LOGIN || CUSTOMER_MAGIC_LINK_TEMPLATE;

const vendorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many sign-in requests, please try again shortly' },
});
const vendorApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: { error: 'Too many requests, please try again shortly' },
});

// Look up an email in the Vendor_Portal_Access registry (server-side, secret-gated proxy).
async function fetchVendorAccess(email) {
  if (!CRM_API_SECRET) return null;
  try {
    const r = await fetch(`${CRM_API_BASE}/api/vendor-portal-access/by-email/${encodeURIComponent(email)}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.found ? j.access : null;
  } catch (e) { console.error('[vendor-login] access lookup error:', e.message); return null; }
}

// Live revocation re-check (60s cache) — same rationale as isPortalAccessEnabled:
// the cookie is a 30-day HMAC; without this a disabled vendor's cookie would keep
// working until expiry. Fail-OPEN on transient proxy errors, fail-CLOSED on a
// definitive disabled/not-found answer.
const _vendorEnabledCache = new Map(); // email → { enabled, t }
async function isVendorAccessEnabled(email) {
  const key = String(email || '').toLowerCase();
  const hit = _vendorEnabledCache.get(key);
  if (hit && Date.now() - hit.t < 60 * 1000) return hit.enabled;
  try {
    const access = await fetchVendorAccess(key);
    const enabled = Boolean(access && access.enabled);
    _vendorEnabledCache.set(key, { enabled, t: Date.now() });
    return enabled;
  } catch (e) {
    console.error('[vendor-portal] enabled re-check failed:', e.message);
    return true; // fail open — a proxy blip never locks the vendor out
  }
}

// Gate: require a verified vendor session. API → 401 + loginUrl; page → redirect to login.
async function requireVendor(req, res, next) {
  const pv = req.vendorSession && req.vendorSession.portalVendor;
  if (!pv) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Sign in required', loginUrl: '/vendor/login' });
    }
    return res.redirect('/vendor/login?next=' + encodeURIComponent(req.originalUrl));
  }
  try {
    if (!(await isVendorAccessEnabled(pv.email))) {
      res.clearCookie('nwca_vendor');
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Access revoked', loginUrl: '/vendor/login' });
      }
      return res.redirect('/vendor/login');
    }
  } catch (e) { console.error('[vendor-portal] requireVendor recheck error:', e.message); /* fail open */ }
  return next();
}

// Login page (email entry). Public.
app.get('/vendor/login', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'vendor-login.html'));
});

// Request a magic link. ALWAYS returns { ok:true } (constant shape) → no account enumeration.
app.post('/auth/vendor/request-link', vendorLoginLimiter, express.json(), async (req, res) => {
  const ok = () => res.json({ ok: true });
  try {
    if (!vendorMagicLink.isConfigured()) { console.warn('[vendor-login] MAGIC_LINK_SECRET not configured'); return ok(); }
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok();
    const access = await fetchVendorAccess(email);
    if (!access || !access.enabled || !access.vendor_name) {
      console.log(`[vendor-login] no enabled access for ${email}`);
      return ok();
    }
    const token = vendorMagicLink.mintToken({ email, vendorName: access.vendor_name });
    const nextPath = safeLoginNext(req.body && req.body.next, '/vendor');
    const link = `${PUBLIC_SITE_ORIGIN}/auth/vendor/verify?token=${encodeURIComponent(token)}` + (nextPath ? `&next=${encodeURIComponent(nextPath)}` : '');
    await sendEmailJSTemplate(VENDOR_MAGIC_LINK_TEMPLATE, {
      to_email: email,
      company_name: access.vendor_name,
      magic_link: link,
      expiry_minutes: String(vendorMagicLink.LINK_TTL_MIN),
    }).catch((e) => console.error('[vendor-login] email send failed:', e.message));
    console.log(`[vendor-login] link sent to ${email} (${access.vendor_name})`);
    return ok();
  } catch (e) {
    console.error('[vendor-login] request-link error:', e.message);
    return ok();
  }
});

// Verify a magic link → live re-check Enabled → set the vendor session cookie → /vendor.
app.get('/auth/vendor/verify', async (req, res) => {
  const fail = () => res.redirect('/vendor/login?error=expired');
  try {
    if (!vendorMagicLink.isConfigured()) return res.status(503).send('Vendor login is temporarily unavailable.');
    let claim;
    try { claim = vendorMagicLink.verifyToken(req.query.token); } catch (_) { return fail(); }
    // Re-check the LIVE invite: revoking Enabled kills outstanding links immediately, and
    // re-binds the token's claimed vendor to the table's truth (anti-tamper).
    const access = await fetchVendorAccess(claim.email);
    if (!access || !access.enabled || String(access.vendor_name) !== String(claim.vendorName)) return fail();
    const sessionToken = vendorMagicLink.mintSession({
      email: claim.email, vendorName: access.vendor_name, contactName: access.contact_name || '',
    });
    res.cookie('nwca_vendor', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    // Best-effort LastLogin stamp — never blocks the login.
    if (CRM_API_SECRET) {
      fetch(`${CRM_API_BASE}/api/vendor-portal-access/touch-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
        body: JSON.stringify({ email: claim.email }),
      }).catch((e) => console.warn('[vendor-login] touch-login failed:', e.message));
    }
    const next = safeLoginNext(req.query.next, '/vendor') || '/vendor';
    return res.redirect(next);
  } catch (e) {
    console.error('[vendor-login] verify error:', e.message);
    return fail();
  }
});

// Logout — clear the vendor cookie.
app.get('/auth/vendor/logout', (req, res) => {
  res.clearCookie('nwca_vendor');
  return res.redirect('/vendor/login');
});

// Permanent access link (Erik: "we don't need a magic link", 2026-07-20).
// One bookmarkable URL per vendor: verify the long-lived signed token, re-check
// the LIVE Enabled flag (revoke in Caspio → link dead within ~60s), set the
// normal 30-day session cookie, land on /vendor. The emailed magic-link flow
// above still works but is no longer the primary path.
app.get('/vendor/access/:token', async (req, res) => {
  const fail = () => res.redirect('/vendor/login?error=expired');
  try {
    if (!vendorMagicLink.isConfigured()) return res.status(503).send('Vendor portal is temporarily unavailable.');
    let claim;
    try { claim = vendorMagicLink.verifyAccessToken(req.params.token); } catch (_) { return fail(); }
    const access = await fetchVendorAccess(claim.email);
    if (!access || !access.enabled || String(access.vendor_name) !== String(claim.vendorName)) return fail();
    const sessionToken = vendorMagicLink.mintSession({
      email: claim.email, vendorName: access.vendor_name, contactName: access.contact_name || '',
    });
    res.cookie('nwca_vendor', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    if (CRM_API_SECRET) {
      fetch(`${CRM_API_BASE}/api/vendor-portal-access/touch-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
        body: JSON.stringify({ email: claim.email }),
      }).catch((e) => console.warn('[vendor-access] touch-login failed:', e.message));
    }
    return res.redirect('/vendor');
  } catch (e) {
    console.error('[vendor-access] error:', e.message);
    return fail();
  }
});

// Staff-only: fetch a vendor's permanent access link (to text/email to the vendor).
// GET /api/vendor-admin/access-link?email=… → { link }. Portal-admin roles only —
// this URL IS the vendor's credential, so it never appears in any vendor-reachable
// or public response.
app.get('/api/vendor-admin/access-link', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  try {
    if (!vendorMagicLink.isConfigured()) return res.status(503).json({ error: 'not configured' });
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
    const access = await fetchVendorAccess(email);
    if (!access || !access.enabled) return res.status(404).json({ error: 'No enabled vendor access for that email' });
    const token = vendorMagicLink.mintAccessToken({ email, vendorName: access.vendor_name });
    res.json({
      vendor: access.vendor_name,
      contact: access.contact_name || null,
      link: `${PUBLIC_SITE_ORIGIN}/vendor/access/${token}`,
    });
  } catch (e) {
    console.error('[vendor-admin] access-link error:', e.message);
    res.status(503).json({ error: 'Unable to build the access link right now.' });
  }
});

// The portal page itself — gated by the vendor LOGIN session.
app.get('/vendor', requireVendor, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'vendor-portal.html'));
});

// ── Vendor-safe data endpoints (session-scoped, allowlist projections) ──────
// Raw Transfer_Orders rows never reach the vendor's browser: staff emails,
// Supacolor linkage, and internal ids are projected away. Scope = Method='Screen
// Print' AND SP_Vendor matches the session's vendor (rows predating SP_Vendor
// default to 'L&P Printing', matching the proxy's create-time default).
function vendorOwnsRow(row, vendorName) {
  if (!row || row.Method !== 'Screen Print') return false;
  const rowVendor = String(row.SP_Vendor || 'L&P Printing').trim().toLowerCase();
  return rowVendor === String(vendorName || '').trim().toLowerCase();
}
// Vendor-safe Box proof images (2026-08-06). Mirrors portalProofUrl one identity
// over — see lib/vendor-magic-link.mintProofToken for why boxUrl() cannot work
// here. Minted only from rows vendorOwnsRow() has already cleared, so the token
// can never name a file the caller was not already being shown.
//
// Anything that is not a Box proxy thumbnail passes through untouched: File_URL
// is a public box.com shared link and already renders, so it is deliberately left
// alone rather than needlessly wrapped.
// (BOX_THUMB_RE is declared with the customer portal below — one definition for
// both identities. It is only read at request time, long after module load.)
function vendorProofUrl(storedUrl, vendorName) {
  if (!storedUrl || typeof storedUrl !== 'string') return storedUrl || null;
  const m = BOX_THUMB_RE.exec(storedUrl);
  if (!m) return storedUrl;
  const token = vendorMagicLink.mintProofToken({ fileId: m[1], vendorName });
  // No SESSION_SECRET (dev) → leave the URL alone rather than emit a dead link.
  return token ? `/api/vendor/proof-image/${token}` : storedUrl;
}

function projectVendorJob(r, vendorName) {
  return {
    id: r.ID_Transfer,
    status: r.Status || null,
    isRush: r.Is_Rush === true || r.Is_Rush === 'true' || r.Is_Rush === 1,
    companyName: r.Company_Name || null,
    customerName: r.Customer_Name || null,
    designNumber: r.Design_Number || null,
    transferType: r.Transfer_Type || null,
    fabricTarget: r.Fabric_Target || null,
    colorCount: r.Color_Count != null ? r.Color_Count : null,
    primaryColor: r.Primary_Color || null,
    additionalColors: r.Additional_Colors || null,
    fileNotes: r.File_Notes || null,
    specialInstructions: r.Special_Instructions || null,
    neededBy: r.Needed_By_Date || null,
    requestedAt: r.Requested_At || null,
    estimatedShipDate: r.Estimated_Ship_Date || null,
    shopworksPO: r.ShopWorks_PO_Number || null,
    salesRepName: r.Sales_Rep_Name || null,
    lineCount: r.line_count != null ? r.line_count : null,
    fileCount: r.file_count != null ? r.file_count : null,
    mockupThumbnailUrl: vendorProofUrl(r.mockup_thumbnail_url, vendorName),
  };
}
function projectVendorLine(l) {
  return {
    quantity: l.Quantity != null ? l.Quantity : null,
    transferSize: l.Transfer_Size || null,
    pressCount: l.Press_Count != null ? l.Press_Count : null,
    widthIn: l.Transfer_Width_In != null ? l.Transfer_Width_In : null,
    heightIn: l.Transfer_Height_In != null ? l.Transfer_Height_In : null,
    notes: l.File_Notes || null,
  };
}
function projectVendorFile(f, vendorName) {
  return {
    fileType: f.File_Type || null,
    fileName: f.File_Name || null,
    // File_URL is the public box.com shared link — already viewable, left as-is.
    fileUrl: f.File_URL || null,
    thumbnailUrl: vendorProofUrl(f.Thumbnail_URL, vendorName),
    mime: f.File_MIME || null,
    widthPx: f.Width_Px != null ? f.Width_Px : null,
    heightPx: f.Height_Px != null ? f.Height_Px : null,
    widthIn: f.Width_In != null ? f.Width_In : null,
    heightIn: f.Height_In != null ? f.Height_In : null,
    notes: f.File_Notes || null,
  };
}
function projectVendorNote(n) {
  return {
    type: n.Note_Type || 'comment',
    text: n.Note_Text || '',
    authorName: n.Author_Name || 'NWCA',
    createdAt: n.Created_At || null,
  };
}
const VENDOR_JOB_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/; // ST-YYMMDD-#### and legacy shapes
const VENDOR_STATUS_SET = new Set(['Requested', 'Ordered', 'PO_Created', 'Shipped', 'Received', 'Cancelled', 'On_Hold']);

// GET /api/vendor/jobs?status=CSV — every Screen Print job for the logged-in vendor.
app.get('/api/vendor/jobs', vendorApiLimiter, requireVendor, async (req, res) => {
  try {
    const pv = req.vendorSession.portalVendor;
    let qs = '/api/transfer-orders?method=' + encodeURIComponent('Screen Print') + '&includeLineCount=true&pageSize=500';
    if (req.query.status) {
      const statuses = String(req.query.status).split(',').map((s) => s.trim()).filter((s) => VENDOR_STATUS_SET.has(s));
      if (statuses.length) qs += '&status=' + encodeURIComponent(statuses.join(','));
    }
    const data = await portalProxyGet(qs);
    const rows = (data && data.records) || [];
    // Explicit arrow, never a bare projectVendorJob reference — passing the
    // function directly hands map's second arg (the index) to vendorName, minting
    // tokens bound to "0", "1", … which then 404 on redemption.
    const jobs = rows.filter((r) => vendorOwnsRow(r, pv.vendorName))
      .map((r) => projectVendorJob(r, pv.vendorName));
    res.json({ vendor: { name: pv.vendorName, contactName: pv.contactName, email: pv.email }, jobs });
  } catch (e) {
    console.error('[vendor-portal] jobs list error:', e.message);
    res.status(503).json({ error: 'Unable to load jobs right now. Please refresh.' });
  }
});

// GET /api/vendor/jobs/:id — one job + lines + files + notes (ownership-checked).
app.get('/api/vendor/jobs/:id', vendorApiLimiter, requireVendor, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!VENDOR_JOB_ID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
    const pv = req.vendorSession.portalVendor;
    const data = await portalProxyGet('/api/transfer-orders/' + encodeURIComponent(id));
    const record = data && data.record;
    if (!record || !vendorOwnsRow(record, pv.vendorName)) return res.status(404).json({ error: 'Not found' });
    res.json({
      job: projectVendorJob(record, pv.vendorName),
      lines: ((data && data.lines) || []).map(projectVendorLine),
      files: ((data && data.files) || []).map((f) => projectVendorFile(f, pv.vendorName)),
      notes: ((data && data.notes) || []).map(projectVendorNote),
    });
  } catch (e) {
    console.error('[vendor-portal] job detail error:', e.message);
    res.status(503).json({ error: 'Unable to load this job right now. Please refresh.' });
  }
});

// ── Vendor proof images ─────────────────────────────────────────────────────
// Images get their OWN budget. vendorApiLimiter is 120/15min, sized for a handful
// of JSON calls — but one job-list view is one <img> per job (46 on Bradley's
// board today), so sharing that budget would 429 the vendor out of their own
// portal partway down the page. That is not hypothetical: it is exactly what
// happened to the CUSTOMER portal on 2026-08-05 (60/15min vs 53 images).
const vendorImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: { error: 'Too many requests, please try again shortly' },
});

function requireVendorProofToken(req, res, next) {
  const claim = vendorMagicLink.verifyProofToken(String(req.params.token || ''));
  // Forged, wrong-type, or expired all answer 404 — never 401 and never a
  // distinct code, so the response cannot be used as an oracle.
  if (!claim) return res.status(404).json({ error: 'Not found' });
  // A token belongs to ONE vendor. If this browser is signed in as a different
  // vendor, refuse — a token pasted into another vendor's session is not theirs.
  const sv = req.vendorSession && req.vendorSession.portalVendor
    && req.vendorSession.portalVendor.vendorName;
  if (sv && String(sv).trim().toLowerCase() !== claim.vendorName.trim().toLowerCase()) {
    return res.status(404).json({ error: 'Not found' });
  }
  req.params.fileId = claim.fileId;   // boxFileId() re-validates it is numeric
  return next();
}

// `size` only — deliberately narrower than the staff forwarder's allowlist, and
// Cache-Control is forced rather than echoed: this response is a per-vendor
// capability and must never sit in a shared cache.
app.get('/api/vendor/proof-image/:token', vendorImageLimiter, requireVendorProofToken,
  boxForward((req) => 'thumbnail/' + boxFileId(req),
    { query: new Set(['size']), cacheControl: 'private, max-age=300' }));

// POST /api/vendor/jobs/:id/notes { note } — vendor posts a comment onto the job's
// activity timeline (visible to Bradley/Steve on the staff transfer-detail page).
app.post('/api/vendor/jobs/:id/notes', vendorApiLimiter, requireVendor, express.json(), async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!VENDOR_JOB_ID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
    const note = String((req.body && req.body.note) || '').trim().slice(0, 2000);
    if (!note) return res.status(400).json({ error: 'Note text required' });
    const pv = req.vendorSession.portalVendor;
    // Ownership check BEFORE writing — a vendor can only comment on their own jobs.
    const data = await portalProxyGet('/api/transfer-orders/' + encodeURIComponent(id));
    const record = data && data.record;
    if (!record || !vendorOwnsRow(record, pv.vendorName)) return res.status(404).json({ error: 'Not found' });
    const authorName = `${pv.contactName || pv.email} (${pv.vendorName})`;
    const headers = { 'Content-Type': 'application/json' };
    if (CRM_API_SECRET) headers['X-CRM-API-Secret'] = CRM_API_SECRET;
    const r = await fetch(`${CRM_API_BASE}/api/transfer-order-notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        Transfer_ID: id,
        Note_Type: 'comment',
        Note_Text: note,
        Author_Email: pv.email,
        Author_Name: authorName,
      }),
      signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`proxy ${r.status}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[vendor-portal] add note error:', e.message);
    res.status(503).json({ error: 'Unable to post your note right now. Please try again.' });
  }
});

// Dedicated limiter for the status API: customers re-check this page over
// several days. The shared strictLimiter instance pools its 20/hr bucket with
// the ORDER SUBMISSION endpoints — riding on it would let status refreshes
// rate-limit real checkouts from the same IP.
const orderStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  message: { error: 'Too many requests, please try again shortly' },
});

// GET /api/order-status/:quoteId?t=<12-hex token>
// Token = first 12 hex chars of HMAC-SHA256(quoteId, ORDER_STATUS_SECRET),
// compared timing-safe. Returns ONLY a customer-safe projection — never
// CustomerNumber, Notes, push payloads, internal fees/margins, or staff
// email addresses. Wrong/missing token and missing row are indistinguishable
// (generic 404 — no oracle).
app.get('/api/order-status/:quoteId', orderStatusLimiter, async (req, res) => {
  try {
    const quoteId = String(req.params.quoteId || '');
    if (!process.env.ORDER_STATUS_SECRET) {
      // No secret → links can't exist. NEVER validate against a hardcoded
      // fallback secret.
      return res.status(503).json({ error: 'status links unavailable' });
    }

    const expected = computeOrderStatusToken(quoteId);
    const supplied = Buffer.from(String(req.query.t || ''), 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    if (supplied.length !== wanted.length || !crypto.timingSafeEqual(supplied, wanted)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let row;
    try {
      row = await fetchQuoteSessionRow(quoteId);
    } catch (lookupErr) {
      console.error('[OrderStatus] Lookup failed:', lookupErr.message);
      return res.status(503).json({ error: 'Order status temporarily unavailable' });
    }
    if (!row) return res.status(404).json({ error: 'Order not found' });

    const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
    const customerData = parse(row.CustomerDataJSON);
    const colorConfigs = parse(row.ColorConfigsJSON);
    const orderTotals = parse(row.OrderTotalsJSON);
    const orderSettings = parse(row.OrderSettingsJSON);

    const deliveryMethod = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';
    const trackingNumber = row.TrackingNumber || null;

    // Customer-safe status ladder:
    //   TrackingNumber                         → 'shipped'
    //   ShippedAt w/o tracking on a pickup row → 'pickup-ready-soon'
    //   'Processed' or PushedToShopWorks       → 'in-production'
    //   'Payment Confirmed*' (incl. SW Failed) → 'paid'  (production state is internal)
    //   anything else                          → 'pending-payment'
    const rawStatus = String(row.Status || '');
    let status = 'pending-payment';
    if (rawStatus.indexOf('Payment Confirmed') !== -1) status = 'paid';
    if (rawStatus.indexOf('Processed') !== -1 || row.PushedToShopWorks) status = 'in-production';
    if (trackingNumber) {
      status = 'shipped';
    } else if (row.ShippedAt) {
      status = deliveryMethod === 'pickup' ? 'pickup-ready-soon' : 'shipped';
    }

    const items = [];
    Object.values(colorConfigs || {}).forEach((config) => {
      Object.entries((config && config.sizeBreakdown) || {}).forEach(([size, sd]) => {
        if (sd && sd.quantity > 0) {
          items.push({
            color: (config && config.displayColor) || '',
            size,
            qty: sd.quantity,
            unitPrice: Number(sd.unitPrice) || 0,
          });
        }
      });
    });

    res.json({
      quoteID: row.QuoteID,
      status,
      deliveryMethod,
      shipPromise: orderSettings.shipPromise || null,
      rush: !!orderSettings.rush,
      styleName: orderSettings.styleName || channelConfig(orderSettings.channel).fallbackProductName,
      items,
      totals: {
        subtotal: Number(orderTotals.subtotal) || 0,
        // Customer-PAID small-batch fee (0 on baked-pricing orders, >0 on
        // legacy rows) — included so Subtotal → Total visibly foots; the
        // confirmation emails + success page already show this line.
        ltmFee: Number(orderTotals.ltmFee) || 0,
        shipping: Number(orderTotals.shipping) || 0,
        tax: Number(orderTotals.salesTax) || 0,
        grandTotal: Number(orderTotals.grandTotal) || 0,
      },
      trackingNumber,
      shippedAt: row.ShippedAt || null,
      mockups: Array.isArray(orderSettings.mockups) ? orderSettings.mockups : [],
      orderDate: row.DateOrderPlaced || row.CreatedAt_Quote || row.CreatedAt || null,
    });
  } catch (error) {
    console.error('[OrderStatus] Error:', error);
    res.status(500).json({ error: 'Order status unavailable' });
  }
});

};
