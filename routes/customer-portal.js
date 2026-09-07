// routes/customer-portal.js — Customer Portal — gated, customer-safe data (magic-link login, orders, invoices, proofs, rewards, reorder)
// Extracted VERBATIM from server.js lines 6351-9592 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { API_BASE_URL, BOX_THUMB_RE, CASPIO_PROXY_BASE, CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, INTERNAL_CALL_KEY, PORTAL_ADMIN_ROLES, PORTAL_FETCH_TIMEOUT_MS, PUBLIC_SITE_ORIGIN, SAMPLE_PRICING, SERVER_DIR, TDT_PROXY, boxFileId, boxForward, channelConfig, customerMagicLink, express, fetch, fetchPortalAccess, getCtsStock, nowPacificNaiveIso, path, portalProxyGet, rateLimit, requireCrmRole, requireCustomer, resolveCtsShipping, resolveTdtShipping, resolveTdtTax, save3DTQuoteSession, sendEmailJSTemplate, sendHashedHtml, stripe, withProxySecret } = ctx;

// =============================================================================
// Customer Portal — gated, customer-safe data (#1, 2026-06-29)
// =============================================================================
const PORTAL_DATE_CUTOFF = '2026-01-01T00:00:00'; // pre-2026 lacked consistent images

// Per-customer money/PII JSON must never be served from a browser or shared cache. Express's
// default weak ETag let Chrome answer a portal load from its own copy (304) and show a customer
// their PRE-grant $0 balance after the grant had posted (2026-09-01). no-store on every portal
// route: the customer ones AND the staff preview/admin mirrors.
app.use(['/api/portal', '/api/portal-admin'], (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // 2026-09-01: portal home = 7 reads/load + per-order drawer reads; 60 tripped inside ~8 page views
  message: { error: 'Too many requests, please try again shortly' },
});

// Proof images need their OWN budget. portalLimiter's 60/15min was sized for a
// handful of JSON calls, but ONE portal page view is one <img> per proof — a
// real customer (Binford Metals) loads 53, so sharing that budget 429s the
// customer out of their own portal halfway down the page. Measured, not guessed.
// Still bounded, and each response carries `private, max-age=300`, so a reload
// inside five minutes costs nothing.
const portalImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Too many requests, please try again shortly' },
});

// Identity seam (#6 Phase 2): the verified customer SESSION wins. Falls back to the URL
// :customerId ONLY for the detail endpoints reached from un-logged-in art-approval EMAIL
// links (those rows are authorized by an ownership check downstream). A logged-in customer
// can therefore never be scoped to another company's id. The aggregate endpoint is
// session-ONLY (it does not use this resolver) — that closes the old enumeration IDOR.
function resolvePortalCustomer(req, res, next) {
  const sid = req.customerSession && req.customerSession.portalCustomer && req.customerSession.portalCustomer.idCustomer;
  if (sid && /^\d+$/.test(String(sid))) { req.portalCustomerId = String(sid); return next(); }
  const customerId = String(req.params.customerId || '');
  if (/^\d+$/.test(customerId)) { req.portalCustomerId = customerId; return next(); }
  return res.status(404).json({ error: 'Not found' });
}

function portalOrderTypeText(v) {
  if (v && typeof v === 'object') { const k = Object.keys(v); return k.length ? String(v[k[0]]) : ''; }
  return v || '';
}
function portalOnOrAfterCutoff(dateStr) {
  if (!dateStr) return true;            // never drop undated rows
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  return d >= new Date(PORTAL_DATE_CUTOFF);
}
function portalProofUrl(storedUrl, cid) {
  if (!storedUrl || typeof storedUrl !== 'string') return storedUrl || null;
  const m = BOX_THUMB_RE.exec(storedUrl);
  if (!m) return storedUrl;
  const token = customerMagicLink.mintProofToken({ fileId: m[1], idCustomer: cid });
  // No SESSION_SECRET (dev) → leave the URL alone rather than emit a dead link.
  return token ? `/api/portal/proof-image/${token}` : storedUrl;
}

// ALLOWLIST projections — copy ONLY customer-safe fields; never spread the raw row.
function projectPortalMockup(m, cid) {
  return {
    ID: m.ID,
    Design_Number: m.Design_Number || null,
    Design_Name: m.Design_Name || null,
    Print_Location: m.Print_Location || null,
    Mockup_Type: m.Mockup_Type || null,
    Status: m.Status || null,
    Submitted_Date: m.Submitted_Date || null,
    // Slots 2 and 3 are load-bearing, not extras: the list filter below admits a
    // row on `Box_Mockup_1 || _2 || _3`, and pages/js/customer-portal.js:217 picks
    // the first of those three. Projecting only slot 1 meant a design whose proof
    // sits in slot 2 or 3 passed the filter, reached the browser with no image,
    // and rendered as a card with nothing in it. The detail projection already
    // exposes all six through portalProofUrl, so this is closing a gap between two
    // views of the same row, not widening what a customer may see.
    Box_Mockup_1: portalProofUrl(m.Box_Mockup_1, cid),
    Box_Mockup_2: portalProofUrl(m.Box_Mockup_2, cid),
    Box_Mockup_3: portalProofUrl(m.Box_Mockup_3, cid),
  };
}
function projectPortalArt(a, cid) {
  return {
    ID_Design: a.ID_Design || null,
    Design_Num_SW: a.Design_Num_SW || null,
    GarmentStyle: a.GarmentStyle || null,
    GarmentColor: a.GarmentColor || null,
    Order_Type: portalOrderTypeText(a.Order_Type),
    Status: a.Status || null,
    Date_Created: a.Date_Created || null,
    // The actual DESIGN proof (garment + logo / the artwork) — customer-safe. Prefer these over
    // MAIN_IMAGE_URL_1, which is a plain SanMar garment catalog photo ("just the shirt").
    // Deliberately NOT exposed: Art_Minutes, Amount_Art_Billed, Artwork_Locations, file paths, internal notes.
    Final_Approved_Mockup: portalProofUrl(a.Final_Approved_Mockup, cid),
    Box_File_Mockup: portalProofUrl(a.Box_File_Mockup, cid),
    Box_File_Link: portalProofUrl(a.BoxFileLink, cid),
    MAIN_IMAGE_URL_1: a.MAIN_IMAGE_URL_1 || null,
  };
}


// Customer-safe aggregate: company name + mockups-with-images + art-with-images (2026+).
async function getPortalData(customerId) {
  const cid = encodeURIComponent(customerId);
  const cutoff = encodeURIComponent(PORTAL_DATE_CUTOFF);

  const mResp = await portalProxyGet(`/api/mockups?idCustomer=${cid}&dateFrom=${cutoff}`);
  const mRecs = (mResp && (mResp.records || (Array.isArray(mResp) ? mResp : []))) || [];

  let aResp = await portalProxyGet(`/api/artrequests?shopworksCustomerId=${cid}&dateCreatedFrom=${cutoff}`);
  let aRecs = Array.isArray(aResp) ? aResp : ((aResp && aResp.records) || []);

  const companyName = (aRecs[0] && aRecs[0].CompanyName) || (mRecs[0] && mRecs[0].Company_Name) || null;

  // Art rows sometimes lack Shopwork_customer_number — fall back to company name.
  if (aRecs.length === 0 && companyName) {
    const byName = await portalProxyGet(`/api/artrequests?companyName=${encodeURIComponent(companyName)}&dateCreatedFrom=${cutoff}`);
    aRecs = Array.isArray(byName) ? byName : ((byName && byName.records) || []);
  }

  const mockups = mRecs
    .filter((m) => (m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3) && portalOnOrAfterCutoff(m.Submitted_Date))
    .map((m) => projectPortalMockup(m, customerId));
  const artRequests = aRecs
    .filter((a) => (a.Final_Approved_Mockup || a.Box_File_Mockup || a.BoxFileLink || a.MAIN_IMAGE_URL_1 || a.MAIN_IMAGE_URL_2 || a.MAIN_IMAGE_URL_3 || a.MAIN_IMAGE_URL_4) && portalOnOrAfterCutoff(a.Date_Created))
    .map((a) => projectPortalArt(a, customerId));

  // Logo library: the customer's FULL historical design set (all decoration methods) with
  // thumbnails, via Designs2026.ID_Customer → Shopworks_Thumbnail_Report. NOT date-gated —
  // this is their whole logo history. Thumbnails serve transparently from Caspio OR Box
  // (archived). Best-effort: a failure here must never break the rest of the portal.
  let logoLibrary = [];
  try {
    const lResp = await portalProxyGet(`/api/designs/by-customer/${cid}?method=all&limit=200`);
    logoLibrary = ((lResp && lResp.designs) || [])
      .filter((d) => d.thumbnailUrl)
      .map((d) => ({
        idDesign: d.idDesign || null,
        designName: d.designName || null,
        designType: d.designType || null,
        // 100% of these measured as gated Box thumbnails — the whole "My Logos"
        // showcase was blank for customers until this rewrite.
        thumbnailUrl: portalProofUrl(d.thumbnailUrl, customerId),
        dateCreated: d.dateCreated || null,
      }));
  } catch (e) { console.warn('[Portal] logo library fetch failed:', e.message); }

  // Finished photos: real photos of the decorated product the factory captured and a staffer
  // APPROVED for the customer (portal=1 → Show_To_Customer='Yes' only). Keyed on the ShopWorks
  // customer id; tagged with Design_Number so they group next to that design. Served from Box.
  // Best-effort — a failure here must never break the rest of the portal.
  let finishedPhotos = [];
  try {
    const fResp = await portalProxyGet(`/api/finished-photos?idCustomer=${cid}&portal=1`);
    finishedPhotos = ((fResp && fResp.photos) || [])
      .filter((p) => p.imageUrl)
      .map((p) => ({
        designNumber: p.designNumber || null,
        designName: p.designName || null,
        companyName: p.companyName || null,
        caption: p.caption || null,
        imageUrl: portalProofUrl(p.imageUrl, customerId),
        uploadedDate: p.uploadedDate || null,
      }));
  } catch (e) { console.warn('[Portal] finished photos fetch failed:', e.message); }

  return { company: { name: companyName }, mockups, artRequests, logoLibrary, finishedPhotos };
}

// GET /api/portal — customer-safe aggregate for the LOGGED-IN customer. SESSION-SCOPED:
// the id comes ONLY from the verified session (#6 Phase 2), never the URL — this closes the
// old /api/portal/:customerId enumeration IDOR. Empty ≠ not-found (200 with empty arrays).
// Resolve the real company name from the customer's ORDERS (CustomerName) — the reliable
// fallback when the art/mockup-derived name is empty (a customer with no art on file), which
// is why the staff preview showed the generic "Your Company".
async function resolvePortalCompany(cid) {
  try {
    const today = new Date(); const end = today.toISOString().slice(0, 10);
    const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3); const start = sd.toISOString().slice(0, 10);
    const r = await fetch(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`,
      { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    if (!r.ok) return '';
    const orders = (await r.json()).result || [];
    for (const o of orders) { if (o.CustomerName) return String(o.CustomerName).trim(); }
    return '';
  } catch (_) { return ''; }
}

app.get('/api/portal', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const data = await getPortalData(cid);
    let companyName = (data.company && data.company.name) || req.customerSession.portalCustomer.companyName || '';
    if (!companyName) companyName = await resolvePortalCompany(cid);
    res.json(Object.assign({ customerId: cid }, data, { company: { name: companyName } }));
  } catch (err) {
    console.error('[Portal] aggregate failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// ── Customer proof images (2026-08-05) ──────────────────────────────────────
// GET /api/portal/proof-image/:token — the customer-side counterpart to the
// staff /api/box/thumbnail/:fileId, which is requireStaff and therefore 401s for
// every customer since the Box surface was gated.
//
// 🔴 The customer never supplies a Box file id. The id lives INSIDE an
// HMAC-signed token that only portalProofUrl() mints, and only while projecting
// a row already authorized as belonging to that customer. So this cannot become
// "any customer may read any Box file by id" — the failure mode the staff
// forwarder still has and that must not be extended to customers.
//
// Deliberately NOT requireCustomer: /mockup/:id and /art-request/:designId are
// public email-link pages whose images must render for a customer who is not
// logged in, exactly as resolvePortalCustomer already allows for their DATA.
function requireProofToken(req, res, next) {
  const claim = customerMagicLink.verifyProofToken(String(req.params.token || ''));
  // Forged, wrong-type, or expired all answer 404 — never 401 and never a
  // distinct code, so the response cannot be used as an oracle.
  if (!claim) return res.status(404).json({ error: 'Not found' });
  // A token belongs to ONE customer. If this browser is signed in as somebody
  // else, refuse: a token pasted into another customer's session is not theirs.
  const sid = req.customerSession && req.customerSession.portalCustomer
    && req.customerSession.portalCustomer.idCustomer;
  if (sid && String(sid) !== claim.idCustomer) return res.status(404).json({ error: 'Not found' });
  req.params.fileId = claim.fileId;   // boxFileId() re-validates it is numeric
  return next();
}

// `size` is the ONLY param a customer needs (the portal lightbox sends
// size=large). Deliberately narrower than the staff forwarder's allowlist: the
// staff list also carries `full` and `url`, which the proxy's thumbnail route
// ignores today — but inheriting that list would silently widen what customers
// can ask for the moment the proxy starts honouring them.
// Cache-Control is forced rather than echoed: this response is a per-customer
// capability and must never sit in a shared cache.
app.get('/api/portal/proof-image/:token', portalImageLimiter, requireProofToken,
  boxForward((req) => 'thumbnail/' + boxFileId(req),
    { query: new Set(['size']), cacheControl: 'private, max-age=300' }));

// ── Customer portal ORDERS + INVOICES (#6 Phase 3) ─────────────────────────
// One ManageOrders fetch by id_Customer feeds BOTH the Orders table and the
// Invoices/Balances table (each order row carries cur_TotalInvoice/Payments/Balance).
// Status is derived from the milestone dates — reliable + customer-friendly. Only the
// customer's own order/money fields are projected (no rep, no internal ids, no costs).
// Erik 2026-07-01: customers only need "In Process" (still being worked) vs "Invoiced" (done).
// Drop "Shipped"/"In Production" — the customer doesn't track those milestones here.
function portalOrderStatus(o) {
  return o.date_Invoiced ? 'Invoiced' : 'In Process';
}
function projectPortalOrder(o) {
  const total = Number(o.cur_TotalInvoice) || 0;
  // cur_Payments is often null in this feed; cur_Balance is the authoritative "owed" amount,
  // so derive paid = total - balance (reliable for paid / partial / unpaid alike). If the
  // balance is unknown, assume the full amount is owed rather than falsely showing "Paid".
  const balRaw = o.cur_Balance;
  const balanceKnown = balRaw !== null && balRaw !== undefined && balRaw !== '';
  const balance = balanceKnown ? (Number(balRaw) || 0) : total;
  const paid = Math.max(0, total - balance);
  const paidStatus = !total ? '—' : (balance <= 0 ? 'Paid' : (balance < total ? 'Partial' : 'Open'));
  // Due date = date_Invoiced + TermsDays — same rule as projectPortalInvoice (the on-screen/PDF
  // invoice), so the Invoices table "Due" column can never disagree with the invoice itself.
  let dueDate = null;
  if (o.date_Invoiced) {
    // Parse the DATE portion as UTC midnight so setDate()/output stay on the same
    // calendar day regardless of dyno timezone, then emit DATE-ONLY (YYYY-MM-DD) —
    // the frontend parses it at local midnight, so a bare date can't day-shift.
    const di = new Date(String(o.date_Invoiced).slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(di.getTime())) {
      di.setUTCDate(di.getUTCDate() + (Number(o.TermsDays) || 0));
      dueDate = di.toISOString().slice(0, 10);
    }
  }
  return {
    orderNumber: o.id_Order || null,
    orderDate: o.date_Ordered || null,
    invoiceDate: o.date_Invoiced || null,
    shipDate: o.date_Shippied || null,
    dueDate: dueDate,
    designName: o.DesignName || null,
    poNumber: o.CustomerPurchaseOrder || null,
    quantity: o.TotalProductQuantity || null,
    status: portalOrderStatus(o),
    total: total, paid: paid, balance: balance,
    paidStatus: paidStatus,
  };
}

// Rep contact for the portal header card. The NAME comes from the customer's own orders
// (CustomerServiceRep — already customer-visible on every invoice we render, so exposing it
// here leaks nothing new). The EMAIL resolves through REP_NAME_BY_EMAIL (declared with the
// portal-admin console below — evaluated at request time, so declaration order is fine).
// Unknown/departed rep name → email null; the frontend falls back to the main line.
function portalRepFromOrders(rawOrders) {
  for (const o of rawOrders || []) {
    const name = o && o.CustomerServiceRep ? String(o.CustomerServiceRep).trim() : '';
    if (!name) continue;
    // Resolve name → email. If TWO reps share a display name, we can't know which
    // one this is, so return email null (name only, main-line fallback) rather than
    // guess wrong and route the customer's email to the wrong rep.
    const matches = Object.keys(REP_NAME_BY_EMAIL)
      .filter((em) => String(REP_NAME_BY_EMAIL[em]).toLowerCase() === name.toLowerCase());
    return { name: name, email: matches.length === 1 ? matches[0] : null };
  }
  return null;
}

// GET /api/portal/orders — the LOGGED-IN customer's orders + invoice balances (session-scoped).
app.get('/api/portal/orders', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startD = new Date(today); startD.setFullYear(today.getFullYear() - 3); // MO retains ~2yr
    const start = startD.toISOString().slice(0, 10);
    const url = `${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}` +
                `&date_Ordered_start=${start}&date_Ordered_end=${end}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {}, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('orders fetch ' + r.status);
    const j = await r.json();
    const raw = j.result || [];
    const orders = raw
      .map(projectPortalOrder)
      .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || ''))); // newest first
    res.json({ orders: orders, rep: portalRepFromOrders(raw) });
  } catch (err) {
    console.error('[Portal] orders failed:', err.message);
    res.status(503).json({ error: 'Orders temporarily unavailable' });
  }
});

// ── Customer portal INVOICE detail (#6 Phase 3) — ShopWorks-style, on-screen + PDF ──
function projectPortalLineItem(li) {
  return {
    partNumber: li.PartNumber || '',
    color: li.PartColor || '',
    description: li.PartDescription || '',
    quantity: Number(li.LineQuantity) || 0,
    unitPrice: Number(li.LineUnitPrice) || 0,
    lineTotal: (Number(li.LineQuantity) || 0) * (Number(li.LineUnitPrice) || 0),
    // Size01-06 = S / M / L / XL / 2XL / 3XL (SHOPWORKS_SIZE_MAPPING)
    sizes: [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06],
  };
}
function projectPortalInvoice(o, items) {
  const total = Number(o.cur_TotalInvoice) || 0;
  const balRaw = o.cur_Balance;
  const balanceKnown = balRaw !== null && balRaw !== undefined && balRaw !== '';
  const balance = balanceKnown ? (Number(balRaw) || 0) : total;
  let dueDate = null;
  if (o.date_Invoiced) {
    // Parse the DATE portion as UTC midnight so setDate()/output stay on the same
    // calendar day regardless of dyno timezone, then emit DATE-ONLY (YYYY-MM-DD) —
    // the frontend parses it at local midnight, so a bare date can't day-shift.
    const di = new Date(String(o.date_Invoiced).slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(di.getTime())) {
      di.setUTCDate(di.getUTCDate() + (Number(o.TermsDays) || 0));
      dueDate = di.toISOString().slice(0, 10);
    }
  }
  return {
    invoiceNumber: o.id_Order,
    dateOrdered: o.date_Ordered || null,
    dateInvoiced: o.date_Invoiced || null,
    dueDate: dueDate,
    designId: o.id_Design || null,
    customerName: o.CustomerName || '',
    customerNumber: o.id_Customer || null,
    contactName: [o.ContactFirstName, o.ContactLastName].filter(Boolean).join(' '),
    contactPhone: o.ContactPhone || '',
    contactEmail: o.ContactEmail || '',
    poNumber: o.CustomerPurchaseOrder || '',
    terms: o.TermsName || '',
    salesperson: o.CustomerServiceRep || '',
    designName: o.DesignName || '',
    items: items,
    totalQuantity: Number(o.TotalProductQuantity) || 0,
    subtotal: Number(o.cur_SubTotal) || 0,
    salesTax: Number(o.cur_SalesTaxTotal) || 0,
    shipping: Number(o.cur_Shipping) || 0,
    total: total,
    paid: Math.max(0, total - balance),
    balance: balance,
  };
}

// GET /api/portal/invoice/:orderNo — full invoice (header + line items) for ONE of the
// customer's orders. OWNERSHIP-VERIFIED against the session id_Customer (generic 404 on
// mismatch — a customer can never pull another company's invoice by changing the number).
app.get('/api/portal/invoice/:orderNo', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const orderNo = String(req.params.orderNo || '');
    if (!/^\d+$/.test(orderNo)) return res.status(404).json({ error: 'Not found' });
    const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
    const oR = await fetch(`${CRM_API_BASE}/api/manageorders/orders/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!oR.ok) throw new Error('order ' + oR.status);
    const oJ = await oR.json();
    const o = Array.isArray(oJ.result) ? oJ.result[0] : (oJ.result || oJ);
    if (!o || String(o.id_Customer) !== cid) return res.status(404).json({ error: 'Not found' });
    const lR = await fetch(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    const lJ = lR.ok ? await lR.json() : { result: [] };
    const items = (lJ.result || [])
      .sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0))
      .map(projectPortalLineItem);
    res.json(projectPortalInvoice(o, items));
  } catch (err) {
    console.error('[Portal] invoice failed:', err.message);
    res.status(503).json({ error: 'Invoice temporarily unavailable' });
  }
});

// ── Customer portal PHASE 4 — personalized catalog + request-to-rep re-order ──
// Reuses the customer's own order history (orders → line items) → distinct products,
// enriched with the SanMar image. Session-scoped + customer-safe (no costs/internal
// fields). The re-order action is a REQUEST that routes to the rep — NO price/payment.

const _portalPdCache = new Map(); // styleNumber → { rows, t } (successful, non-empty only)
const _PORTAL_PD_TTL_MS = 30 * 60 * 1000; // 30 min — a catalog change self-heals without a dyno restart
async function portalStyleRows(style) {
  const hit = _portalPdCache.get(style);
  if (hit && (Date.now() - hit.t) < _PORTAL_PD_TTL_MS) return hit.rows;
  let rows;
  try {
    const r = await fetch(`${CRM_API_BASE}/api/product-details?styleNumber=${encodeURIComponent(style)}`,
      { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    rows = r.ok ? await r.json() : [];
  } catch (_) { rows = []; }
  if (!Array.isArray(rows)) rows = [];
  // Only cache a SUCCESSFUL, non-empty result — never poison the cache with a
  // transient failure/empty, which previously 404'd the product page for EVERY
  // customer until a dyno restart. On failure, fall back to any prior good rows.
  if (rows.length) { _portalPdCache.set(style, { rows, t: Date.now() }); return rows; }
  return (hit && hit.rows) || rows;
}
// Prefer the per-COLOR model shot (FRONT_MODEL, e.g. DT6000_black_model_front.jpg) over the
// generic style image (PRODUCT_IMAGE = one DT6000.jpg for every color) so cards/pickers show the
// actual color the customer bought; fall back to the generic + flat when a color has no model shot.
function portalRowImage(row) { return row ? (row.FRONT_MODEL || row.PRODUCT_IMAGE || row.FRONT_FLAT || '') : ''; }
// Every product-image ANGLE we have for a color, in display order, deduped + non-empty — feeds the
// product-page gallery. SanMar exposes Model Front/Back/Side + Flat Front/Back per color; we fetch
// all but SIDE_MODEL today (add it to the proxy /api/product-details SELECT to light up the 5th
// angle — this skips empties, so a color's Side appears automatically once present). Falls back to
// the generic style image so a color with no shots still shows something.
function portalRowImages(row) {
  if (!row) return [];
  const src = [
    { url: row.FRONT_MODEL, label: 'Front' },
    { url: row.BACK_MODEL, label: 'Back' },
    { url: row.SIDE_MODEL, label: 'Side' },
    { url: row.FRONT_FLAT, label: 'Flat front' },
    { url: row.BACK_FLAT, label: 'Flat back' },
  ];
  const seen = new Set(), out = [];
  for (const s of src) { const u = s.url && String(s.url).trim(); if (u && !seen.has(u)) { seen.add(u); out.push({ url: u, label: s.label }); } }
  if (!out.length && row.PRODUCT_IMAGE) out.push({ url: row.PRODUCT_IMAGE, label: '' });
  return out;
}
// Robust color match (exact → catalog code → contains, all punctuation/space-insensitive) so
// "Jet Black" resolves to the Jet-Black garment image, not the style's default color. null = no match.
function portalMatchColor(rows, color) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = norm(color);
  if (!want) return null;
  return rows.find(x => norm(x.COLOR_NAME) === want)
    || rows.find(x => norm(x.CATALOG_COLOR) === want)
    || rows.find(x => { const c = norm(x.COLOR_NAME); return c && (c.includes(want) || want.includes(c)); })
    || null;
}
// Deduped color list (name + garment image + swatch) for the re-order color picker.
function portalColorList(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const name = r.COLOR_NAME;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const imgs = portalRowImages(r);
    out.push({ name, image: (imgs[0] && imgs[0].url) || portalRowImage(r), images: imgs, swatch: r.COLOR_SQUARE_IMAGE || '', catalogColor: r.CATALOG_COLOR || '' });
  }
  return out;
}
async function portalProductDisplay(style, color) {
  const rows = await portalStyleRows(style);
  const match = portalMatchColor(rows, color);
  const row = match || rows[0];
  return { image: portalRowImage(row), title: row ? row.PRODUCT_TITLE : '', matched: !!match };
}
// {S:2, M:4, …} from a line item's Size01–06 (SHOPWORKS_SIZE_MAPPING), non-zero only.
function portalSizeMap(li) {
  const L = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
  const m = {};
  [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06].forEach((v, i) => { const n = Number(v) || 0; if (n > 0) m[L[i]] = n; });
  return m;
}
// ShopWorks PartNumber → base SanMar style + color; null for fee / non-garment lines.
function portalNormalizePart(li) {
  const pn = String(li.PartNumber || '').trim();
  const color = String(li.PartColor || '').trim();
  if (!pn || !color) return null;                          // fee lines carry no color
  if (/^(SETUP|LTM|FEE|TAX|SHIP|DISC|RUSH|ART|GRT|MOCK|DIGI)/i.test(pn)) return null;
  const style = pn.split('_')[0];                          // ST254_2X → ST254 (NWCA uses _ only for size suffixes)
  return style ? { style, color } : null;
}
function portalSumSizes(li) {
  return [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06]
    .reduce((s, v) => s + (Number(v) || 0), 0);
}

// Build the personalized catalog for a customer id. Shared by the customer endpoint AND
// the staff-preview mirror (so staff previewing a portal see the same catalog).
async function buildMyProducts(cid) {
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3);
  const start = sd.toISOString().slice(0, 10);
  // Orders + line items — bounded + PARALLEL. WAS 25 SEQUENTIAL line-item fetches with NO timeout
  // and a silent `catch(_){}`: one slow/flaky ManageOrders moment dropped orders and silently shrank
  // the catalog to a partial set (sometimes a single product). Now every call is timeout-bounded,
  // fetched in parallel, and retried once on a transient miss; the orders fetch surfaces a 503
  // (visible error, Erik's rule) rather than hanging. Same fix as buildProductDetail (2026-07-02).
  const ordersJson = await portalFetchJson(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`, hdrs, 8000);
  if (!ordersJson) throw new Error('orders unavailable');
  const orders = (ordersJson.result || [])
    .sort((a, b) => String(b.date_Ordered || '').localeCompare(String(a.date_Ordered || '')))
    .slice(0, 25); // bound the line-item fetches; recent orders capture the product variety
  const fetchLine = (id) => { const u = `${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(id)}`; return portalFetchJson(u, hdrs, 6000).then(j => j || portalFetchJson(u, hdrs, 6000)); };
  const lineJsons = await Promise.all(orders.map(o => o.id_Order ? fetchLine(o.id_Order) : Promise.resolve(null)));
  const products = new Map(); // baseStyle|color → product
  orders.forEach((o, oi) => {
    if (!o.id_Order) return;
    const items = (lineJsons[oi] && lineJsons[oi].result) || [];
    for (const li of items) {
      const norm = portalNormalizePart(li);
      if (!norm) continue;
      const key = norm.style.toUpperCase() + '|' + norm.color.toLowerCase();
      const qty = Number(li.LineQuantity) || portalSumSizes(li);
      const ex = products.get(key);
      if (!ex) {
        products.set(key, {
          style: norm.style, color: norm.color,
          description: li.PartDescription || '',
          designNumber: o.id_Design || null, designName: o.DesignName || null,
          lastOrdered: o.date_Ordered || null, lastQty: qty, totalQty: qty, timesOrdered: 1,
          sizes: portalSizeMap(li), _sizesFrom: o.date_Ordered,
        });
      } else {
        ex.timesOrdered++; ex.totalQty = (ex.totalQty || 0) + qty; if (!ex.lastQty) ex.lastQty = qty;
        // accumulate the size breakdown across the product's line items in the SAME (latest) order
        if (o.date_Ordered && o.date_Ordered === ex._sizesFrom) {
          const m = portalSizeMap(li);
          Object.keys(m).forEach(k => { ex.sizes[k] = (ex.sizes[k] || 0) + m[k]; });
        }
      }
    }
  });
  const list = [...products.values()];
  await Promise.all(list.map(async (p) => {
    const pd = await portalProductDisplay(p.style, p.color);
    p.image = pd.image; p.title = pd.title || p.description; p.colorMatched = pd.matched;
    delete p._sizesFrom;
  }));
  // Collapse to ONE card per STYLE (catalog-style): the most-recent color is the primary image,
  // and EVERY color the customer ordered becomes a swatch. (Was one card per style+color, which
  // repeated the same garment many times for customers who buy a style in several colors.)
  const byStyle = new Map();
  for (const p of list) {
    const k = String(p.style).toUpperCase();
    if (!byStyle.has(k)) byStyle.set(k, []);
    byStyle.get(k).push(p);
  }
  const grouped = [];
  for (const items of byStyle.values()) {
    items.sort((a, b) => String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || '')));
    const primary = items[0];                            // most-recent color → the card's main image + default
    const rows = await portalStyleRows(primary.style);   // cached (portalProductDisplay already fetched it)
    const primaryMatch = portalMatchColor(rows, primary.color);
    // Resolve each ordered color (a ShopWorks CATALOG_COLOR, e.g. "Hthrd Charcoal") to its SanMar
    // COLOR_NAME + swatch — portalMatchColor matches on CATALOG_COLOR — and MERGE spellings that map
    // to the same COLOR_NAME (SanMar sometimes exposes two catalog codes per color) so the piece
    // total isn't split. Display = COLOR_NAME; keep catalogColor so the FE can match on either.
    const byColor = new Map();
    for (const it of items) {
      if (!it.color) continue;
      const m = portalMatchColor(rows, it.color);
      const display = (m && m.COLOR_NAME) || it.color;
      const key = display.toLowerCase();
      const ex = byColor.get(key);
      if (ex) { ex.totalQty += Number(it.totalQty) || 0; }
      else byColor.set(key, {
        name: display, catalogColor: it.color,
        swatch: (m && m.COLOR_SQUARE_IMAGE) || '', image: it.image || (m ? portalRowImage(m) : ''),
        totalQty: Number(it.totalQty) || 0,
      });
    }
    const colors = [...byColor.values()];
    colors.sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0)); // most-ordered color first (the picker's "top color")
    const topColor = colors[0];                          // the customer's #1 color for this style
    grouped.push(Object.assign({}, primary, {
      color: (topColor && topColor.name) || (primaryMatch && primaryMatch.COLOR_NAME) || primary.color,  // card + modal default = TOP color
      image: (topColor && topColor.image) || primary.image,  // card shows the top-selling color's model shot (not the most-recent)
      colors,                                            // ordered colors (COLOR_NAME + catalogColor + swatch + total qty)
      colorCount: colors.length,
      styleTotalQty: items.reduce((s, x) => s + (Number(x.totalQty) || 0), 0),  // pieces of this style over the ~3yr window
      timesOrdered: items.reduce((s, x) => s + (Number(x.timesOrdered) || 1), 0),
    }));
  }
  grouped.sort((a, b) => String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || '')));
  return { products: grouped };
}
// Short-TTL memo so /my-products and /recommendations (both fired on portal load) SHARE one
// order-history fetch per customer instead of doubling the ManageOrders round-trips.
const _myProductsCache = new Map(); // cid → { t, promise }
function buildMyProductsCached(cid) {
  const key = String(cid);
  const hit = _myProductsCache.get(key);
  if (hit && (Date.now() - hit.t) < 120000) return hit.promise;
  const promise = buildMyProducts(key).catch(err => { _myProductsCache.delete(key); throw err; });
  _myProductsCache.set(key, { t: Date.now(), promise });
  return promise;
}

// Fetch JSON with a HARD timeout — a slow/hung upstream (ManageOrders) resolves to null instead of
// blocking the page. Non-ok / network error / timeout all collapse to null (caller = "no data").
function portalFetchJson(url, headers, ms) {
  return Promise.race([
    fetch(url, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), ms || 8000)),
  ]);
}

// ORDER_ODBC.ORDER_TYPE (ShopWorks order category) → decoration METHOD (Erik-confirmed 2026-07-03):
// Embroidery variants + Caps → EMB; Screenprint → SCP; Digital Printing / Contract DTG → DTG;
// Transfers → DTF. Storefront (Inksoft/Shopify), Art, Blank Goods, Emblem, etc. → '' (customer picks).
function orderTypeToMethod(orderType) {
  const t = String(orderType || '').toLowerCase();
  if (/embroider|\bcaps?\b/.test(t)) return 'EMB';
  if (/screen ?print/.test(t)) return 'SCP';
  if (/digital printing|\bdtg\b/.test(t)) return 'DTG';
  if (/transfer|\bdtf\b/.test(t)) return 'DTF';
  return '';
}

// Full product-detail for the portal PAGE: SanMar specs + ALL available colors + THIS customer's
// own order history for the style (per-color size MATRIX + per-order list). Customer-safe — NO
// cost/margin (PIECE_PRICE etc. are never copied out). null → unknown style (404).
async function buildProductDetail(cid, style) {
  const rows = await portalStyleRows(style);
  if (!rows.length) return null;
  const first = rows[0];
  const product = {
    style: first.STYLE || style,
    title: first.PRODUCT_TITLE || style,
    brand: first.BRAND_NAME || '',
    category: first.CATEGORY_NAME || '',
    subcategory: first.SUBCATEGORY_NAME || '',
    description: String(first.PRODUCT_DESCRIPTION || '').replace(/\s+/g, ' ').trim(),
    isCloseout: /discontinu|closeout|caution/i.test(String(first.PRODUCT_STATUS || '')),
    colors: portalColorList(rows),                                   // every available color
    companionStyles: String(first.COMPANION_STYLES || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean),
  };
  const styleU = String(style).toUpperCase();

  // The customer's ordered history for THIS style (same ~3yr / 25-order window as the catalog).
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3);
  const start = sd.toISOString().slice(0, 10);
  let orders = [];
  const [ordersJson, orderOdbcJson] = await Promise.all([
    portalFetchJson(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`, hdrs, 8000),
    portalFetchJson(`${CRM_API_BASE}/api/order-odbc?q.where=${encodeURIComponent('id_Customer=' + cid)}&q.limit=1000`, hdrs, 6000),
  ]);
  if (ordersJson && ordersJson.result) orders = ordersJson.result.sort((a, b) => String(b.date_Ordered || '').localeCompare(String(a.date_Ordered || ''))).slice(0, 25);
  // ORDER_ODBC (ShopWorks sync) → the decoration METHOD per past order, keyed by ID_Order (== ManageOrders id_Order).
  const methodByOrder = new Map();
  if (Array.isArray(orderOdbcJson)) orderOdbcJson.forEach(r => { const mm = orderTypeToMethod(r.ORDER_TYPE); if (r.ID_Order != null && mm) methodByOrder.set(String(r.ID_Order), mm); });

  // Fetch every order's line items IN PARALLEL, each bounded by a timeout — so a slow or hung
  // ManageOrders call can't stall the page (was 25 SEQUENTIAL fetches → seconds, or an indefinite hang).
  const lineJsons = await Promise.all(orders.map(o => o.id_Order
    ? portalFetchJson(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(o.id_Order)}`, hdrs, 6000)
    : Promise.resolve(null)));

  const byColor = new Map();   // COLOR_NAME(lower) -> aggregate (size matrix + totals)
  const history = [];          // per line: { orderNo, date, color, design, sizes, qty }
  orders.forEach((o, oi) => {
    if (!o.id_Order) return;
    const items = (lineJsons[oi] && lineJsons[oi].result) || [];
    for (const li of items) {
      const norm = portalNormalizePart(li);
      if (!norm || norm.style.toUpperCase() !== styleU) continue;
      const sizes = portalSizeMap(li);
      const qty = Number(li.LineQuantity) || portalSumSizes(li);
      if (qty <= 0) continue;
      const m = portalMatchColor(rows, norm.color);
      const display = (m && m.COLOR_NAME) || norm.color;   // CATALOG_COLOR -> COLOR_NAME (two-color-field rule)
      const ck = display.toLowerCase();
      history.push({ orderNo: o.id_Order, date: o.date_Ordered || '', color: display, design: o.id_Design || null, designName: o.DesignName || '', sizes, qty });
      const ex = byColor.get(ck);
      if (!ex) byColor.set(ck, { name: display, catalogColor: norm.color, swatch: (m && m.COLOR_SQUARE_IMAGE) || '', image: m ? portalRowImage(m) : '', sizes: Object.assign({}, sizes), totalQty: qty, orderCount: 1, lastOrdered: o.date_Ordered || '', firstOrdered: o.date_Ordered || '' });
      else {
        Object.keys(sizes).forEach(k => { ex.sizes[k] = (ex.sizes[k] || 0) + sizes[k]; });
        ex.totalQty += qty; ex.orderCount++;
        if ((o.date_Ordered || '') > ex.lastOrdered) ex.lastOrdered = o.date_Ordered || '';
        if (!ex.firstOrdered || ((o.date_Ordered || '') && (o.date_Ordered || '') < ex.firstOrdered)) ex.firstOrdered = o.date_Ordered || '';
      }
    }
  });
  const orderedColors = [...byColor.values()].sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0));
  const styleTotalQty = orderedColors.reduce((s, c) => s + (c.totalQty || 0), 0);
  const lastOrdered = orderedColors.reduce((d, c) => (c.lastOrdered > d ? c.lastOrdered : d), '');
  const firstOrdered = orderedColors.reduce((d, c) => (!d || (c.firstOrdered && c.firstOrdered < d) ? c.firstOrdered : d), '');
  const top = orderedColors[0] || product.colors[0] || null;
  const lastDesign = history.find(h => h.design) || {};
  // Default the re-order decoration method from the MOST RECENT past order of this style whose
  // ORDER_TYPE maps to a method (history is newest-first). '' → customer picks (storefront/ambiguous).
  let defaultMethod = '';
  for (const h of history) { const mm = methodByOrder.get(String(h.orderNo)); if (mm) { defaultMethod = mm; break; } }

  // The Erik-editable upgrade ladder for this category → the "upgrade to embroidery" module.
  // Margin fields are already stripped by the proxy; here we enrich with the premium garment
  // image + its colors + the pitch image. Best-effort — never blocks the page.
  let upgrades = [];
  if (product.category && CRM_API_SECRET) {
    try {
      const uR = await fetch(`${CRM_API_BASE}/api/product-upgrades?category=${encodeURIComponent(product.category)}&excludeStyle=${encodeURIComponent(product.style)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
      if (uR.ok) {
        const list = ((await uR.json()).upgrades || []).slice(0, 2);
        upgrades = await Promise.all(list.map(async (u) => {
          const urows = await portalStyleRows(u.style);
          const uf = urows[0] || {};
          return {
            style: u.style, title: u.title || uf.PRODUCT_TITLE || u.style, brand: uf.BRAND_NAME || '',
            tier: u.tier || '', stitch: Number(u.stitch) || 8000, location: u.location || 'Left Chest',
            blurb: u.blurb || '', pitchImage: u.image || '',
            image: portalRowImage(uf) || '', colors: portalColorList(urows).slice(0, 12),
          };
        }));
      }
    } catch (_) {}
  }

  return {
    product,
    ordered: { colors: orderedColors, styleTotalQty, lineCount: history.length, lastOrdered, firstOrdered },
    history: history.slice(0, 40),
    defaultColor: top ? top.name : '',
    defaultCatalogColor: top ? (top.catalogColor || '') : '',
    defaultImage: top ? (top.image || '') : '',
    designNumber: lastDesign.design || '',
    designName: lastDesign.designName || '',
    defaultMethod,
    upgrades,
  };
}

// Short-TTL memo so re-viewing the same product (or a quick reload) is instant instead of
// re-hitting ManageOrders. Keyed per (customer, style); errors are not cached.
const _productDetailCache = new Map();
function buildProductDetailCached(cid, style) {
  const key = String(cid) + '|' + String(style).toUpperCase();
  const hit = _productDetailCache.get(key);
  if (hit && (Date.now() - hit.t) < 120000) return hit.promise;
  const promise = buildProductDetail(cid, style).catch(err => { _productDetailCache.delete(key); throw err; });
  _productDetailCache.set(key, { t: Date.now(), promise });
  return promise;
}

// Per-size traffic light (in / low / out) from SanMar inventory for one style+color. Best-effort:
// any failure returns null so the page never blocks on the live SanMar call. NEVER raw numbers.
async function portalInventoryLights(style, color) {
  try {
    const url = `${CRM_API_BASE}/api/sanmar/inventory/${encodeURIComponent(style)}?color=${encodeURIComponent(color)}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    if (!r.ok) return null;
    const j = await r.json();
    const lights = {};
    (j.inventory || []).forEach((row) => {
      const q = Number(row.totalQty) || 0;
      lights[String(row.size)] = q <= 0 ? 'out' : (q < 48 ? 'low' : 'in');   // 48 ≈ a typical order run
    });
    return { color: j.color || color, lights };
  } catch (_) { return null; }
}

// PER-CUSTOMER recommendations from the Erik-curated candidate pool (Portal_Recommendations):
// drop anything the customer already buys, rank by absolute gross-margin $/pc, fill a fixed
// 4-premium / 2-popular mix, and show each in the customer's usual color when it exists. The pool
// carries the "Earn $X" Reward_Text (pill). Never throws the page empty. cid may be '' (staff w/o id).
const REC_PREMIUM_SLOTS = 4, REC_POPULAR_SLOTS = 2, REC_TOTAL = 6;
async function buildRecommendations(cid) {
  const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/recommendations`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error('recs ' + r.status);
  const pool = ((await r.json()).recommendations || []).filter(x => x.style);

  // What THIS customer already buys + the colors they order (best-effort; recs still work if it fails).
  const ownedStyles = new Set(); const colorByStyle = {}; const colorCount = {};
  if (cid) {
    try {
      const mine = (await buildMyProductsCached(cid)).products || [];
      for (const p of mine) {
        const bs = String(p.style || '').toUpperCase();
        if (bs) ownedStyles.add(bs);
        if (p.color) {
          colorCount[p.color] = (colorCount[p.color] || 0) + (Number(p.timesOrdered) || 1);
          if (bs && !colorByStyle[bs]) colorByStyle[bs] = p.color;
        }
      }
    } catch (_) { /* no history → recommend from the whole pool */ }
  }
  const houseColor = Object.keys(colorCount).sort((a, b) => colorCount[b] - colorCount[a])[0] || '';

  // Rank by absolute margin $/pc (Sell_Anchor × GP%); Erik's Priority is the tiebreak/override.
  const score = x => (Number(x.sellAnchor) || 0) * (x.gpPct > 1 ? x.gpPct / 100 : (Number(x.gpPct) || 0));
  const byRank = (a, b) => (a.priority - b.priority) || (score(b) - score(a));
  const avail = pool.filter(x => !ownedStyles.has(String(x.style).toUpperCase()));
  const premium = avail.filter(x => x.isPremium).sort(byRank);
  const popular = avail.filter(x => !x.isPremium).sort(byRank);

  // Fill 4 premium / 2 popular, backfilling from the other tier (premium first — that's the strategy).
  const picked = [];
  const fill = (arr, n) => { for (const x of arr) { if (picked.length >= REC_TOTAL || n <= 0) break; if (!picked.includes(x)) { picked.push(x); n--; } } };
  fill(premium, REC_PREMIUM_SLOTS);
  fill(popular, REC_POPULAR_SLOTS);
  fill([...premium, ...popular].filter(x => !picked.includes(x)), REC_TOTAL - picked.length);
  if (!picked.length) fill(pool.slice().sort(byRank), REC_TOTAL); // last-ditch: never empty

  // Enrich with the customer's usual color + image; keep the reward pill text from the pool.
  await Promise.all(picked.map(async (rec) => {
    const preferred = rec.color || colorByStyle[String(rec.style).toUpperCase()] || houseColor || '';
    const pd = await portalProductDisplay(rec.style, preferred);
    rec.color = pd.matched ? preferred : '';   // only claim a color if it matched a real garment image
    rec.image = pd.image; rec.title = rec.title || pd.title; rec.comingSoon = !pd.image;
  }));
  // Customer-safe projection — NEVER ship internal margin/cost fields (gpPct, sellAnchor, brand,
  // priority, isPremium) to the browser. Ranking above already used them; the card doesn't.
  return {
    recommendations: picked.map(r => ({
      style: r.style, color: r.color, title: r.title, blurb: r.blurb, category: r.category,
      image: r.image, comingSoon: r.comingSoon, rewardText: r.rewardText,
    })),
  };
}

// GET /api/portal/my-products — the logged-in customer's personalized re-order catalog.
app.get('/api/portal/my-products', portalLimiter, requireCustomer, async (req, res) => {
  try { res.json(await buildMyProductsCached(String(req.customerSession.portalCustomer.idCustomer))); }
  catch (err) { console.error('[Portal] my-products failed:', err.message); res.status(503).json({ error: 'Catalog temporarily unavailable' }); }
});
// GET /api/portal/recommendations — PER-CUSTOMER recs (pool ranked vs this customer's history).
app.get('/api/portal/recommendations', portalLimiter, requireCustomer, async (req, res) => {
  try { res.json(await buildRecommendations(String(req.customerSession.portalCustomer.idCustomer))); }
  catch (err) { console.error('[Portal] recommendations failed:', err.message); res.json({ recommendations: [] }); }
});
// GET /api/portal/product-colors/:style — available colors (name + garment image + swatch) for
// the re-order color picker. Public SanMar catalog data (no customer info), session-gated.
app.get('/api/portal/product-colors/:style', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const style = String(req.params.style || '').trim();
    if (!style) return res.status(400).json({ error: 'style required' });
    res.json({ colors: portalColorList(await portalStyleRows(style)) });
  } catch (err) { console.error('[Portal] product-colors failed:', err.message); res.json({ colors: [] }); }
});

// GET /api/portal/product/:style — full product-detail page data (specs + all colors + THIS
// customer's order history/size matrix). Session-scoped; customer-safe (no cost/margin).
app.get('/api/portal/product/:style', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const style = String(req.params.style || '').trim();
    if (!style) return res.status(400).json({ error: 'style required' });
    const detail = await buildProductDetailCached(String(req.customerSession.portalCustomer.idCustomer), style);
    if (!detail) return res.status(404).json({ error: 'Product not found' });
    res.json(detail);
  } catch (err) { console.error('[Portal] product detail failed:', err.message); res.status(503).json({ error: 'Product temporarily unavailable' }); }
});
// GET /api/portal/product/:style/availability?color= — per-size traffic light (async, best-effort).
app.get('/api/portal/product/:style/availability', portalLimiter, requireCustomer, async (req, res) => {
  const style = String(req.params.style || '').trim();
  const color = String(req.query.color || '').trim();
  if (!style || !color) return res.json({ lights: {} });
  res.json((await portalInventoryLights(style, color)) || { lights: {} });
});

// POST /api/portal/reorder-request — customer asks to re-order (or order a recommended item).
// Routes to the rep as a saved request + Slack ping. NO price/payment. The id_Customer,
// company, and email come from the verified SESSION — the client cannot spoof another company.
const reorderRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many requests — please wait a few minutes.' },
});
app.post('/api/portal/reorder-request', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const b = req.body || {};
    const style = String(b.style || '').trim();
    if (!style) return res.status(400).json({ error: 'Please choose a product.' });
    const payload = {
      id_Customer: cid,
      company_name: sess.companyName || '',
      email: sess.email || '',
      style: style.slice(0, 50),
      color: String(b.color || '').slice(0, 80),
      product_title: String(b.product_title || '').slice(0, 255),
      design_number: String(b.design_number || '').slice(0, 50),
      design_name: String(b.design_name || '').slice(0, 255),
      qty: String(b.qty || '').slice(0, 30),
      size_breakdown: String(b.size_breakdown || '').slice(0, 255),
      note: String(b.note || '').slice(0, 255),
      source: b.source === 'recommendation' ? 'recommendation' : 'reorder',
    };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, requestNum: j.request && j.request.Request_Num, rep: j.request && j.request.Rep });
  } catch (err) {
    console.error('[Portal] reorder-request failed:', err.message);
    res.status(502).json({ error: 'Could not send your request. Please try again or call (253) 922-5793.' });
  }
});

// POST /api/portal/reorder-batch — a multi-item "Re-order List" → one grouped rep ask (Batch_Num).
// id_Customer/company/email come from the verified SESSION (never the client). No price/payment.
app.post('/api/portal/reorder-batch', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const b = req.body || {};
    const validItems = (Array.isArray(b.items) ? b.items : [])
      .filter(it => it && String(it.style || '').trim());
    // Refuse an over-cap batch with a clear error instead of silently dropping items
    // past 30 (the client also caps at 30, but never rely on the client for this).
    if (validItems.length > 30) {
      return res.status(400).json({ error: 'Too many items — please send 30 or fewer per re-order request.' });
    }
    const items = validItems
      .map(it => ({
        style: String(it.style || '').slice(0, 50),
        color: String(it.color || '').slice(0, 80),
        product_title: String(it.product_title || '').slice(0, 255),
        design_number: String(it.design_number || '').slice(0, 50),
        design_name: String(it.design_name || '').slice(0, 255),
        qty: String(it.qty || '').slice(0, 30),
        size_breakdown: String(it.size_breakdown || '').slice(0, 255),
        method: String(it.method || '').slice(0, 30),
      }));
    if (!items.length) return res.status(400).json({ error: 'Your list is empty.' });
    const payload = { id_Customer: cid, company_name: sess.companyName || '', email: sess.email || '', items, note: String(b.note || '').slice(0, 255) };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, batchNum: j.batchNum, count: j.count, rep: j.rep });
  } catch (err) {
    console.error('[Portal] reorder-batch failed:', err.message);
    res.status(502).json({ error: 'Could not send your list. Please try again or call (253) 922-5793.' });
  }
});

// ── Customer portal PHASE 5 — reward dollars (READ balance + REDEEM as a request) ──
// The customer can only READ their balance and REQUEST a redemption — never change the
// ledger. All ledger writes are staff-initiated (admin console → /api/portal-admin/rewards/entry).

// Customer-safe projection of a reward-ledger feed: keep the math + story, drop the staff
// audit trail (entries[].by = the granting staffer's email — internal, never customer-facing).
function projectPortalRewards(raw, program) {
  const entries = Array.isArray(raw && raw.entries) ? raw.entries : [];
  const months = (program && program.months) || REWARD_WINDOW_MONTHS_DEFAULT;
  const since = new Date();
  if (program && program.earn) since.setTime(new Date(program.earn.from + 'T00:00:00Z').getTime()); else since.setMonth(since.getMonth() - months);
  // "Earned in the window" = POSTED grants (positive entries) dated inside it. Only posted
  // credit is ever shown to a customer — the accrual calculator's un-posted estimate is staff-only.
  const earnedInWindow = Math.round(entries
    .filter((e) => (Number(e.amount) || 0) > 0 && e.created && new Date(e.created) >= since)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0) * 100) / 100;
  const tiers = (program && program.tiers) || [];
  return {
    balance: Number(raw && raw.balance) || 0,
    entries: entries.slice(0, 20).map((e) => ({
      amount: Number(e.amount) || 0,
      type: e.type || '',
      reason: portalCustomerReason(e.reason),
      orderRef: e.orderRef || '',
      created: e.created || '',
    })),
    earnedInWindow,
    // Rates only — the SanMar cost thresholds that define "premium" stay internal.
    program: {
      configured: !!(program && program.configured),
      name: (program && program.name) || 'Reward dollars',
      months,
      earnFrom: program && program.earn ? program.earn.from : null,
      earnTo: program && program.earn ? program.earn.to : null,
      spendFrom: program && program.spend ? program.spend.from : null,
      spendBy: program && program.spend ? program.spend.to : null,
      fullRedeemOnly: true,   // Erik 2026-09-02: one redemption for the whole balance keeps accounting simple
      baseRatePct: tiers.length ? tiers[0].ratePct : 0,
      premiumRatePct: tiers.length ? tiers[tiers.length - 1].ratePct : 0,
    },
  };
}

// GET /api/portal/rewards — the logged-in customer's reward-dollar balance + recent activity.
// Ledger reasons are written for STAFF ("Earned on paid order #140568 (12-mo program · band 40+, 20-39.99)").
// The customer must never see the SanMar cost bands (portal rule: rates yes, cost thresholds never),
// so strip any parenthetical that names the program mechanics before it leaves this API.
function portalCustomerReason(reason) {
  return String(reason || '').replace(/\s*\((?:[^()]*\b(?:band|program|RWD-|already)\b[^()]*)\)/gi, '').replace(/\s{2,}/g, ' ').trim();
}
app.get('/api/portal/rewards', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const [r, program] = await Promise.all([
      fetch(`${CRM_API_BASE}/api/customer-rewards/ledger/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) }),
      loadRewardProgram().catch(() => null),   // program copy is decorative; the BALANCE is what must never be wrong
    ]);
    if (!r.ok) throw new Error('rewards ' + r.status);
    res.json(projectPortalRewards(await r.json(), program));
  } catch (err) {
    // Erik's #1 rule: never report a silent "$0" balance on failure — a customer
    // with reward $ would see their card vanish. Surface a 503 so the FE shows
    // "balance unavailable — refresh" instead of hiding the card.
    console.error('[Portal] rewards failed:', err.message);
    res.status(503).json({ error: 'rewards_unavailable' });
  }
});

// POST /api/portal/rewards/redeem-request — customer asks to apply reward $ to their next
// order. Does NOT change the balance — it lands in the rep queue (Source=redeem); the rep
// applies it to an order and records the deduction in the ledger via the admin console.
app.post('/api/portal/rewards/redeem-request', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const amt = Number((req.body || {}).amount);
    if (!isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
    // Server-authoritative check against the live balance.
    const bR = await fetch(`${CRM_API_BASE}/api/customer-rewards/balance/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    const bal = bR.ok ? (Number((await bR.json()).balance) || 0) : 0;
    if (amt > bal + 0.001) return res.status(400).json({ error: `You have $${bal.toFixed(2)} available.` });
    // Whole balance only (Erik 2026-09-02) — one credit line per customer per program.
    if (Math.abs(amt - bal) > 0.01) return res.status(400).json({ error: `Reward dollars are redeemed all at once — your full $${bal.toFixed(2)}.` });
    const prog = await loadRewardProgram().catch(() => null);
    if (prog && prog.spend) {
      const day = new Date().toISOString().slice(0, 10);
      if (day < prog.spend.from) return res.status(400).json({ error: `${prog.name} can be redeemed starting ${prog.spend.from}.` });
      if (day > prog.spend.to) return res.status(400).json({ error: `${prog.name} expired on ${prog.spend.to}.` });
    }
    const payload = {
      id_Customer: cid, company_name: sess.companyName || '', email: sess.email || '',
      style: 'REWARD', color: '', product_title: 'Redeem reward dollars', qty: '',
      note: `Customer requests to apply $${amt.toFixed(2)} of reward dollars to their next order.`,
      source: 'redeem',
    };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, requestNum: j.request && j.request.Request_Num, rep: j.request && j.request.Rep });
  } catch (err) {
    console.error('[Portal] redeem-request failed:', err.message);
    res.status(502).json({ error: 'Could not send your redemption request. Please try again.' });
  }
});

// ── Customer portal 2026-09-01 redesign: identity, quotes, per-order tracking, general requests ──

// GET /api/portal/me — who is signed in. Feeds the Account panel (sign-in email, company,
// customer #). Everything here is already in the customer's own cookie; nothing new leaks.
app.get('/api/portal/me', portalLimiter, requireCustomer, (req, res) => {
  const s = req.customerSession.portalCustomer;
  res.json({ customerId: String(s.idCustomer), email: s.email || '', companyName: s.companyName || '' });
});

// Quote sessions → customer-safe projection. Scoped to the SIGN-IN EMAIL (exact match on
// quote_sessions.CustomerEmail) — never the company name, so one contact never sees another's
// quote. Status is a customer-facing ladder derived from the row (internal Status strings,
// ShopWorks refs and ShipStation state never reach the browser):
//   TrackingNumber/ShippedAt → Shipped · ShopWorks order/DateOrderPlaced → Ordered ·
//   cancelled → Cancelled · ExpiresAt in the past / expired → Expired · else Open.
const PORTAL_QUOTE_ID_RE = /^[A-Z]{2,5}[-\d]+-?\d*$/;  // the shape GET /quote/:quoteId accepts
function projectPortalQuote(q) {
  const quoteId = String(q.QuoteID || '');
  const shipped = !!(q.TrackingNumber || q.ShippedAt);
  const ordered = !!(q.ShopWorks_Order_Number || q.OrderNumber || q.PushedToShopWorks || q.DateOrderPlaced);
  const st = String(q.Status || '').toLowerCase();
  const exp = q.ExpiresAt ? new Date(q.ExpiresAt) : null;
  let status = 'Open';
  if (shipped) status = 'Shipped';
  else if (ordered || /complete|converted|won/.test(st)) status = 'Ordered';
  else if (/cancel|void|declin/.test(st)) status = 'Cancelled';
  else if (/expired|abandon/.test(st) || (exp && !isNaN(exp.getTime()) && exp < new Date())) status = 'Expired';
  return {
    quoteId,
    created: q.CreatedAt_Quote || q.CreatedAt || null,
    expires: q.ExpiresAt || null,
    projectName: q.ProjectName || '',
    total: Number(q.TotalAmount) || 0,
    quantity: Number(q.TotalQuantity) || 0,
    status,
    rep: q.SalesRepName || '',
    tracking: shipped ? {
      number: q.TrackingNumber || '',
      carrier: q.TrackingCarrier || q.Carrier || '',
      url: /^https?:\/\//i.test(String(q.TrackingURL || '')) ? q.TrackingURL : '',
      shippedAt: q.ShippedAt || null,
    } : null,
    viewUrl: PORTAL_QUOTE_ID_RE.test(quoteId) ? ('/quote/' + quoteId) : null,
  };
}
async function buildPortalQuotes(email) {
  const key = String(email || '').toLowerCase().trim();
  if (!key) return [];
  const r = await fetch(`${CRM_API_BASE}/api/quote_sessions?customerEmail=${encodeURIComponent(key)}`,
    { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error('quotes ' + r.status);
  const j = await r.json();
  const rows = Array.isArray(j) ? j : ((j && (j.sessions || j.result || j.data || j.records)) || []);
  return rows
    .filter((q) => q && q.QuoteID && !/^OF/.test(String(q.QuoteID)))   // OF = retired Order Form, internal only
    .map(projectPortalQuote)
    .sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
}
// GET /api/portal/quotes — the signed-in contact's quotes. 503 on failure (never a false "no quotes").
app.get('/api/portal/quotes', portalLimiter, requireCustomer, async (req, res) => {
  try { res.json({ quotes: await buildPortalQuotes(req.customerSession.portalCustomer.email) }); }
  catch (err) { console.error('[Portal] quotes failed:', err.message); res.status(503).json({ error: 'Quotes temporarily unavailable' }); }
});

// Per-order shipment tracking (ManageOrders /tracking/:orderNo). Ownership is re-verified
// against the order header — the drawer's invoice call already did that, but this route must
// stand on its own. Rows are projected to carrier + number + date; the carrier link is built
// client-side from the carrier name (no upstream URL is trusted).
function projectPortalTracking(t) {
  return {
    trackingNumber: String(t.TrackingNumber || t.tracking_number || '').trim(),
    carrier: String(t.ShippingCarrier || t.Carrier || t.ship_carrier || t.ShipMethod || '').trim(),
    shipDate: t.date_Shipped || t.ShipDate || null,
    boxNumber: t.BoxNumber != null ? t.BoxNumber : null,
  };
}
async function portalOrderTracking(cid, orderNo) {
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const oR = await fetch(`${CRM_API_BASE}/api/manageorders/orders/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!oR.ok) throw new Error('order ' + oR.status);
  const oJ = await oR.json();
  const o = Array.isArray(oJ.result) ? oJ.result[0] : (oJ.result || oJ);
  if (!o || String(o.id_Customer) !== String(cid)) return null;   // not theirs → generic 404
  const tR = await fetch(`${CRM_API_BASE}/api/manageorders/tracking/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!tR.ok) throw new Error('tracking ' + tR.status);
  const rows = ((await tR.json()).result) || [];
  return rows.map(projectPortalTracking).filter((t) => t.trackingNumber);
}
app.get('/api/portal/order/:orderNo/tracking', portalLimiter, requireCustomer, async (req, res) => {
  const orderNo = String(req.params.orderNo || '');
  if (!/^\d+$/.test(orderNo)) return res.status(404).json({ error: 'Not found' });
  try {
    const rows = await portalOrderTracking(String(req.customerSession.portalCustomer.idCustomer), orderNo);
    if (!rows) return res.status(404).json({ error: 'Not found' });
    res.json({ tracking: rows });
  } catch (err) { console.error('[Portal] tracking failed:', err.message); res.status(503).json({ error: 'Tracking temporarily unavailable' }); }
});

// POST /api/portal/request — a general request that is NOT a product re-order: a fresh quote,
// a new logo to set up, a change to an existing logo, or an account-details update. Lands in
// the SAME rep queue (Portal_Reorder_Requests) so nothing new has to be watched; the Style
// column carries the request type and Product_Title starts with a readable label. Identity
// comes from the verified session. No price, no payment.
const PORTAL_REQUEST_TYPES = {
  'quote':       { style: 'QUOTE',   label: 'Quote request' },
  'logo':        { style: 'NEWLOGO', label: 'New logo / artwork' },
  'logo-change': { style: 'LOGOCHG', label: 'Logo change request' },
  'account':     { style: 'ACCOUNT', label: 'Account details update' },
};
app.post('/api/portal/request', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const b = req.body || {};
    const type = PORTAL_REQUEST_TYPES[String(b.type || '')];
    if (!type) return res.status(400).json({ error: 'Unknown request type.' });
    const description = String(b.description || '').trim();
    if (description.length < 3) return res.status(400).json({ error: 'Tell us a little about what you need.' });
    const payload = {
      id_Customer: String(sess.idCustomer),
      company_name: sess.companyName || '',
      email: sess.email || '',
      style: type.style,
      color: '',
      product_title: (type.label + ': ' + description).slice(0, 255),
      design_number: String(b.design_number || '').slice(0, 50),
      design_name: String(b.design_name || '').slice(0, 255),
      qty: String(b.qty || '').slice(0, 30),
      method: String(b.method || '').slice(0, 30),
      note: String(b.note || '').slice(0, 255),
      source: 'reorder',   // the proxy only knows reorder|recommendation; the Style column carries the type
    };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, requestNum: j.request && j.request.Request_Num, rep: j.request && j.request.Rep });
  } catch (err) {
    console.error('[Portal] request failed:', err.message);
    res.status(502).json({ error: 'Could not send your request. Please try again or call (253) 922-5793.' });
  }
});

// Invoice page (session-gated). Reads the order # from the URL; the page fetches the
// secured /api/portal/invoice/:orderNo above (which re-checks ownership).
app.get('/portal/invoice/:orderNo', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-invoice.html'));
});
// Product detail page (session-gated). The page reads the style from the URL + fetches the
// secured /api/portal/product/:style above.
app.get('/portal/product/:style', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-product.html'));
});

// ════════════════════════════════════════════════════════════════════════════
// Customer Portal ADMIN (staff console) — send a login link + PREVIEW a customer's
// portal. All role-gated (PORTAL_ADMIN_ROLES). The preview endpoints are a READ-ONLY
// staff mirror: they reuse getPortalData + the order/invoice projections but take the
// id from the URL (not a customer session), so the customer security seam
// (requireCustomer / resolvePortalCustomer) is UNTOUCHED. A customer can never reach
// these — they require a verified STAFF (SAML) session with an allowed role.
// ════════════════════════════════════════════════════════════════════════════

// POST /api/portal-admin/send-link { email } — staff-initiated magic-link email. Unlike the
// public request-link route (which never reveals account state), this sits behind a staff
// role so it can tell the staffer whether the invite is enabled and the link went out.
app.post('/api/portal-admin/send-link', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  try {
    if (!customerMagicLink.isConfigured()) return res.status(503).json({ error: 'Magic-link login is not configured (MAGIC_LINK_SECRET missing).' });
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
    const access = await fetchPortalAccess(email);
    if (!access) return res.status(404).json({ error: 'That email is not invited yet. Add them first.' });
    if (!access.enabled) return res.status(409).json({ error: 'That invite is disabled. Enable it before sending a link.' });
    if (!/^\d+$/.test(String(access.id_Customer))) return res.status(409).json({ error: 'That invite has no valid customer id.' });
    const token = customerMagicLink.mintToken({ email, idCustomer: access.id_Customer });
    const link = `${PUBLIC_SITE_ORIGIN}/auth/customer/verify?token=${encodeURIComponent(token)}`;
    await sendEmailJSTemplate(CUSTOMER_MAGIC_LINK_TEMPLATE, {
      to_email: email,
      company_name: access.company_name || 'there',
      magic_link: link,
      expiry_minutes: String(customerMagicLink.LINK_TTL_MIN),
    });
    console.log(`[portal-admin] ${req.session.crmUser.email} sent a login link to ${email} (customer ${access.id_Customer})`);
    res.json({ success: true, email, sent: true });
  } catch (e) {
    console.error('[portal-admin] send-link failed:', e.message);
    res.status(502).json({ error: 'Could not send the login link. Please try again.' });
  }
});

// Map staff email → their EXACT CustomerServiceRep name in Sales_Reps_2026 (the join key
// for the console's "My customers" filter). These MUST match the Sales_Reps_2026 values
// verbatim — note Ruth is "Ruthie Nhoung" there, not "Ruth Nhoung".
const REP_NAME_BY_EMAIL = {
  'erik@nwcustomapparel.com': 'Erik Mickelson',
  'taneisha@nwcustomapparel.com': 'Taneisha Clark',
  'nika@nwcustomapparel.com': 'Nika Lao',
  'ruth@nwcustomapparel.com': 'Ruthie Nhoung',
  'jim@nwcustomapparel.com': 'Jim Mickelson',
};
// GET /api/portal-admin/me — who's logged in (for the Account Rep / "My customers" filter).
app.get('/api/portal-admin/me', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  const u = (req.session && req.session.crmUser) || {};
  const email = String(u.email || '').toLowerCase();
  const perms = (u.permissions || []).map(p => String(p).toLowerCase());
  res.json({
    email,
    firstName: u.firstName || '',
    repName: REP_NAME_BY_EMAIL[email] || null,
    seesAll: perms.includes('admin') || perms.includes('accountant'),
  });
});

// GET /api/portal-admin/preview/:id — the customer's portal aggregate (mockups + art +
// company), exactly as the customer sees it. Staff-only, READ-ONLY.
app.get('/api/portal-admin/preview/:id', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const data = await getPortalData(cid);
    let companyName = (data.company && data.company.name) || '';
    if (!companyName) companyName = await resolvePortalCompany(cid);
    res.json(Object.assign({ customerId: cid, staffPreview: true }, data, { company: { name: companyName } }));
  } catch (err) {
    console.error('[portal-admin] preview aggregate failed:', err.message);
    res.status(503).json({ error: 'Preview temporarily unavailable' });
  }
});

// GET /api/portal-admin/preview/:id/orders — the customer's orders + invoice balances.
app.get('/api/portal-admin/preview/:id/orders', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startD = new Date(today); startD.setFullYear(today.getFullYear() - 3);
    const start = startD.toISOString().slice(0, 10);
    const url = `${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}` +
                `&date_Ordered_start=${start}&date_Ordered_end=${end}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {}, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('orders fetch ' + r.status);
    const j = await r.json();
    const raw = j.result || [];
    const orders = raw.map(projectPortalOrder)
      .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
    res.json({ orders, rep: portalRepFromOrders(raw) });
  } catch (err) {
    console.error('[portal-admin] preview orders failed:', err.message);
    res.status(503).json({ error: 'Orders preview temporarily unavailable' });
  }
});

// GET /api/portal-admin/preview/:id/my-products — the customer's catalog, for staff preview.
app.get('/api/portal-admin/preview/:id/my-products', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try { res.json(await buildMyProductsCached(cid)); }
  catch (err) { console.error('[portal-admin] preview my-products failed:', err.message); res.status(503).json({ error: 'Catalog preview unavailable' }); }
});
// GET /api/portal-admin/preview/:id/recommendations — PER-CUSTOMER recs, for staff preview.
// (Previously dropped :id and showed the generic list — now threads the previewed customer's id.)
app.get('/api/portal-admin/preview/:id/recommendations', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try { res.json(await buildRecommendations(cid)); }
  catch (err) { console.error('[portal-admin] preview recs failed:', err.message); res.json({ recommendations: [] }); }
});
// GET /api/portal-admin/preview/:id/product-colors/:style — color options, for staff preview.
app.get('/api/portal-admin/preview/:id/product-colors/:style', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  try { res.json({ colors: portalColorList(await portalStyleRows(String(req.params.style || ''))) }); }
  catch (err) { res.json({ colors: [] }); }
});
// GET /api/portal-admin/preview/:id/product/:style — full product detail, for staff preview.
app.get('/api/portal-admin/preview/:id/product/:style', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const detail = await buildProductDetailCached(cid, String(req.params.style || ''));
    if (!detail) return res.status(404).json({ error: 'Product not found' });
    res.json(detail);
  } catch (err) { console.error('[portal-admin] preview product failed:', err.message); res.status(503).json({ error: 'Product preview unavailable' }); }
});
app.get('/api/portal-admin/preview/:id/product/:style/availability', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const style = String(req.params.style || '').trim();
  const color = String(req.query.color || '').trim();
  if (!style || !color) return res.json({ lights: {} });
  res.json((await portalInventoryLights(style, color)) || { lights: {} });
});
// GET /api/portal-admin/preview/:id/rewards — reward-dollar balance, for staff preview.
app.get('/api/portal-admin/preview/:id/rewards', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const [r, program] = await Promise.all([
      fetch(`${CRM_API_BASE}/api/customer-rewards/ledger/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) }),
      loadRewardProgram().catch(() => null),
    ]);
    // Same customer-safe projection as /api/portal/rewards — the preview mirrors what the customer sees.
    res.json(r.ok ? projectPortalRewards(await r.json(), program) : { balance: 0, entries: [] });
  } catch (err) { res.json({ balance: 0, entries: [] }); }
});
// POST /api/portal-admin/rewards/entry — staff grant/adjust/redeem a reward entry. Stamps the
// STAFF email as Created_By (audit) — the client can't spoof it (that's why this isn't a raw crm-proxy write).
app.post('/api/portal-admin/rewards/entry', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  try {
    const body = Object.assign({}, req.body, { created_by: (req.session.crmUser && req.session.crmUser.email) || 'staff' });
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
    res.status(r.status).json(await r.json());
  } catch (err) { console.error('[portal-admin] rewards entry failed:', err.message); res.status(502).json({ error: 'Could not save the reward entry.' }); }
});

// ── Reward ACCRUAL (Erik 2026-09-01): "earn reward dollars on what you actually paid for" ──
// Earned $ = Σ over GARMENT lines of INVOICED + PAID orders whose invoice date falls inside the
// program window (default 12 months) of: line revenue × the rate for the garment's SanMar
// piece-cost band. Higher-cost garments carry more margin, so they earn a higher rate.
//
// Rates + bands are Erik-editable in Caspio → Service_Codes (no deploy):
//   ServiceType=REWARD · ServiceCode=RWD-EARN · PricingMethod=TIERED · IsActive=Yes · Visible=No
//   one row per band: TierLabel = SanMar PIECE_PRICE band ("0-39.99", "40+") · SellPrice = % back
//   optional: ServiceCode=RWD-WINDOW with UnitCost = months (default 12)
// No rows → "not configured" (visible in the console), never a default rate: this mints
// money-like credit, so a silent fallback is the one thing it must not do.
//
// Rules: decoration / fee / setup lines never earn (portalNormalizePart drops them). Cost = the
// LOWEST PIECE_PRICE across the ordered color's catalog rows (base-size cost = what the garment
// "is"; extended sizes cost more but don't change the band). "Paid" = ManageOrders sts_Paid=1,
// or a known cur_Balance of 0 on a non-zero invoice. Posting to the ledger stays STAFF-initiated
// (admin console → /accrual/:id/post), ONE grant per order keyed by Order_Ref = order number,
// so re-running can never double-grant; the customer only ever sees POSTED credit.
const REWARD_WINDOW_MONTHS_DEFAULT = 12;
let _rewardProgramCache = { t: 0, program: null };
function parseRewardBand(label) {
  const s = String(label || '').trim().replace(/\$/g, '');
  let m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*\+$/))) return { min: Number(m[1]), max: Infinity };
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/))) return { min: Number(m[1]), max: Number(m[2]) };
  if ((m = s.match(/^<\s*(\d+(?:\.\d+)?)$/))) return { min: 0, max: Number(m[1]) - 0.005 };
  return null;
}
async function loadRewardProgram() {
  if (_rewardProgramCache.program && (Date.now() - _rewardProgramCache.t) < 5 * 60 * 1000) return _rewardProgramCache.program;
  const r = await fetch(`${CRM_API_BASE}/api/service-codes?type=REWARD`, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {}, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error('service-codes ' + r.status);
  const rows = (((await r.json()) || {}).data || []).filter((x) => x.IsActive !== false);
  const tiers = rows
    .filter((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-EARN')
    .map((x) => Object.assign({ label: String(x.TierLabel || ''), ratePct: Number(x.SellPrice) || 0, name: x.DisplayName || '' }, parseRewardBand(x.TierLabel) || {}))
    .filter((t) => t.min != null && t.ratePct > 0)
    .sort((a, b) => a.min - b.min);
  // Earning window. Preferred: RWD-WINDOW TierLabel as a date range ("2026-01-01..2026-08-31" =
  // the 2026 Rewards program, Erik 2026-09-02). Fallback: UnitCost = rolling months (default 12).
  const win = rows.find((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-WINDOW');
  const earn = win ? parseRewardWindow(win.TierLabel) : null;
  const months = win && Number(win.UnitCost) > 0 ? Math.round(Number(win.UnitCost)) : REWARD_WINDOW_MONTHS_DEFAULT;
  // Spend window: RWD-SPEND TierLabel date range; its end date is the expiry the customer sees.
  const spendRow = rows.find((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-SPEND');
  const spend = spendRow ? parseRewardWindow(spendRow.TierLabel) : null;
  const name = earn ? (earn.to.slice(0, 4) + ' Rewards') : 'Reward dollars';
  // Web-store orders (Inksoft / Shopify company stores) are EXCLUDED by default: they are automatic
  // employee purchases, not rep-handled company orders, and one GOLD account had 622 of them in a
  // year (measured 2026-09-01) — the program is for the company's own reorders. An optional
  // Service_Codes row RWD-WEBSTORE with SellPrice=1 turns them on.
  const web = rows.find((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-WEBSTORE');
  const includeWebstore = !!(web && Number(web.SellPrice) > 0);
  // Promotional boosts: ServiceCode RWD-BOOST, TierLabel "2026-10-01..2026-12-31", SellPrice = multiplier
  // (2 = double rewards). Applies to orders INVOICED inside the window; overlapping windows take the max.
  const boosts = rows
    .filter((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-BOOST')
    .map((x) => Object.assign({ label: String(x.TierLabel || ''), multiplier: Number(x.SellPrice) || 0, name: x.DisplayName || '' }, parseRewardWindow(x.TierLabel) || {}))
    .filter((b) => b.from && b.to && b.multiplier > 0);
  // Which ShopWorks part number(s) mark a redemption line: Service_Codes row RWD-REDEEM, TierLabel =
  // comma-separated part codes (e.g. "GIFT CERT, RWD-REDEEM") — so the same part reps already use for
  // gift-certificate credits can be the reward line. Default: RWD-REDEEM / REWARD-REDEEM.
  const redeemRow = rows.find((x) => String(x.ServiceCode || '').toUpperCase() === 'RWD-REDEEM');
  const redeemParts = redeemRow ? String(redeemRow.TierLabel || '').split(',').map((p) => p.trim().toUpperCase()).filter(Boolean) : [];
  const program = { configured: tiers.length > 0, tiers, months, earn, spend, name, includeWebstore, boosts, redeemParts };
  _rewardProgramCache = { t: Date.now(), program };
  return program;
}
function parseRewardWindow(label) {
  const m = String(label || '').trim().match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to|-|–)\s*(\d{4}-\d{2}-\d{2})$/i);
  return m ? { from: m[1], to: m[2] } : null;
}
function rewardBoostFor(program, invoiceDate) {
  const day = String(invoiceDate || '').slice(0, 10);
  if (!day || !program || !program.boosts) return null;
  let best = null;
  program.boosts.forEach((b) => { if (day >= b.from && day <= b.to && (!best || b.multiplier > best.multiplier)) best = b; });
  return best;
}
function rewardTierForCost(program, cost) {
  if (cost == null || !program || !program.configured) return null;
  return program.tiers.find((t) => cost >= t.min && cost <= t.max) || null;
}
// A garment we cannot cost (non-SanMar vendor, customer-supplied, retired style — 12% of GOLD
// revenue measured 2026-09-01) still earns, at the LOWEST band's rate, so a customer is never
// penalised for what we bought from S&S. The line is annotated so staff can see why.
function rewardTierForUnknownCost(program) {
  if (!program || !program.configured || !program.tiers.length) return null;
  return program.tiers[0];
}
function rewardGarmentCost(rows, color) {
  if (!rows || !rows.length) return null;
  const m = portalMatchColor(rows, color);
  const pool = m ? rows.filter((x) => x.COLOR_NAME === m.COLOR_NAME) : rows;
  const costs = pool.map((x) => Number(x.PIECE_PRICE)).filter((n) => n > 0);
  return costs.length ? Math.min.apply(null, costs) : null;
}
function moOrderPaid(o) {
  const total = Number(o.cur_TotalInvoice) || 0;
  if (total <= 0) return false;
  const sp = String(o.sts_Paid == null ? '' : o.sts_Paid).trim().toLowerCase();
  if (sp === '1' || sp === 'true') return true;
  const balKnown = o.cur_Balance !== null && o.cur_Balance !== undefined && o.cur_Balance !== '';
  return balKnown && (Number(o.cur_Balance) || 0) <= 0.005;
}
const rewardRound = (n) => Math.round((Number(n) || 0) * 100) / 100;
const REWARD_WEBSTORE_TYPES = /inksoft|shopify|web ?store|storefront/i;   // ShopWorks ORDER_TYPE names
// A redemption is a ShopWorks line with this part number and a NEGATIVE unit price (qty 1, e.g. -50).
// Reps add it at order entry; the engine finds it on the paid order and reconciles it into the ledger.
const REWARD_REDEEM_PART = /^RWD-REDEEM\b|^REWARD-?REDEEM\b/i;
function isRewardRedeemLine(program, li) {
  const pn = String(li.PartNumber || '').trim();
  if (!pn) return false;
  if (program && program.redeemParts && program.redeemParts.length) return program.redeemParts.includes(pn.toUpperCase());
  return REWARD_REDEEM_PART.test(pn);
}
// Line items of an INVOICED + PAID order never change → memoise for a day. And the proxy's
// ManageOrders limiter is ONE 30-requests/minute bucket shared by every caller behind the same
// IP (the whole dyno), so fetching a 25-order customer in parallel trips it and the missing
// orders would silently read as "no reward" (measured 2026-09-01: 25 of 25 line-item calls
// 429'd). Fetch sequentially — a short burst, then ~2.2 s apart — and retry once after a pause.
const _moLineCache = new Map();   // id_Order → { t, result }
const MO_LINE_CACHE_MS = 24 * 60 * 60 * 1000;
const MO_PACE_MS = 2200;
// Heroku kills any request past 30 s (H12), so one calculation fetches at most MO_MAX_FETCHES
// uncached orders (~20 s), returns partial:true, and the console calls again — the cache carries
// the progress. A 25-order account completes in three rounds; the 600-order web stores are
// excluded above rather than crawled.
const MO_MAX_FETCHES = 9;
async function portalPacedLineItems(orderNos, hdrs) {
  const out = []; let calls = 0; let fetched = 0;
  for (const no of orderNos) {
    const hit = _moLineCache.get(String(no));
    if (hit && (Date.now() - hit.t) < MO_LINE_CACHE_MS) { out.push(hit.result); continue; }
    if (fetched >= MO_MAX_FETCHES) { out.push(null); continue; }   // left for the next round
    fetched++;
    if (calls >= 3) await new Promise((r) => setTimeout(r, MO_PACE_MS));
    const url = `${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(no)}`;
    let j = await portalFetchJson(url, hdrs, 8000); calls++;
    if (!j) { await new Promise((r) => setTimeout(r, 3500)); j = await portalFetchJson(url, hdrs, 8000); calls++; }
    if (j && Array.isArray(j.result)) _moLineCache.set(String(no), { t: Date.now(), result: j });
    out.push(j);
  }
  return out;
}
// Caspio archive ManageOrders_LineItems (kept by the proxy's daily sync-manageorders job) →
// Map(id_Order → MO-shaped { result: [line…], mirrored: true }) for the orders asked for. The
// archive has no customer column, so it is keyed by the order ids the engine already holds.
// Only orders with ≥1 archived line are returned; the rest fall through to the paced MO crawl.
// Any failure → empty map (plain MO path); never a throw.
const _mirrorCache = new Map();   // id_Order → { t, entry }
async function portalMirroredLineItems(orderNos) {
  const map = new Map(); const want = [];
  orderNos.map(String).forEach((id) => { const hit = _mirrorCache.get(id); if (hit && (Date.now() - hit.t) < 10 * 60 * 1000) map.set(id, hit.entry); else want.push(id); });
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  for (let i = 0; i < want.length; i += 100) {
    try {
      const j = await portalFetchJson(`${CRM_API_BASE}/api/order-lines?orders=${want.slice(i, i + 100).join(',')}`, hdrs, 8000);
      (j && Array.isArray(j.rows) ? j.rows : []).forEach((r) => {
        const id = String(r.id_Order || '');
        if (!id) return;
        if (!map.has(id)) map.set(id, { result: [], mirrored: true });
        map.get(id).result.push({
          PartNumber: r.PartNumber || '', PartColor: r.PartColor || '', PartDescription: r.PartDescription || '',
          LineQuantity: Number(r.LineQuantity) || 0, LineUnitPrice: Number(r.LineUnitPrice) || 0, SortOrder: Number(r.SortOrder) || 0,
          Size01: r.Size01, Size02: r.Size02, Size03: r.Size03, Size04: r.Size04, Size05: r.Size05, Size06: r.Size06,
          _pieceCost: r.SanMar_PieceCost === '' || r.SanMar_PieceCost == null ? null : Number(r.SanMar_PieceCost),
        });
      });
    } catch (_) { /* mirror unavailable → MO path */ }
  }
  map.forEach((entry, id) => { if (!_mirrorCache.has(id)) _mirrorCache.set(id, { t: Date.now(), entry }); });
  return map;
}
async function computeRewardAccrual(cid) {
  const program = await loadRewardProgram();
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  // Earning window: the program's date range when configured, else rolling months back from today.
  const windowStart = program.earn ? new Date(program.earn.from + 'T00:00:00Z') : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - program.months, today.getUTCDate()));
  const windowEnd = program.earn ? new Date(program.earn.to + 'T23:59:59Z') : today;
  const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3);   // MO list window (invoice date filters below)
  const ordersJson = await portalFetchJson(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${sd.toISOString().slice(0, 10)}&date_Ordered_end=${end}`, hdrs, 10000);
  if (!ordersJson) throw new Error('orders unavailable');
  const paidInWindow = (ordersJson.result || []).filter((o) => {
    if (!o.id_Order || !o.date_Invoiced || !moOrderPaid(o)) return false;
    const inv = new Date(String(o.date_Invoiced).slice(0, 10) + 'T00:00:00Z');
    return !isNaN(inv.getTime()) && inv >= windowStart && inv <= windowEnd;
  }).sort((a, b) => String(b.date_Invoiced).localeCompare(String(a.date_Invoiced)));
  // Order TYPE comes from the ShopWorks ODBC mirror (ORDER_ODBC) — ManageOrders only has a numeric
  // id_OrderType. Refusing to classify is safer than silently crawling (or rewarding) 600 web orders.
  let typeByOrder = new Map();
  if (!program.includeWebstore && paidInWindow.length) {
    const where = `id_Customer=${cid} AND date_OrderInvoiced>='${windowStart.toISOString().slice(0, 10)}'`;
    const odbc = await portalFetchJson(`${CRM_API_BASE}/api/order-odbc?q.where=${encodeURIComponent(where)}&q.limit=1000`, hdrs, 8000);
    if (!Array.isArray(odbc)) throw new Error('order types unavailable');
    odbc.forEach((r) => { if (r.ID_Order != null) typeByOrder.set(String(r.ID_Order), String(r.ORDER_TYPE || '')); });
  }
  const isWebstore = (o) => REWARD_WEBSTORE_TYPES.test(typeByOrder.get(String(o.id_Order)) || '');
  const excludedWeb = program.includeWebstore ? [] : paidInWindow.filter(isWebstore);
  const eligible = program.includeWebstore ? paidInWindow : paidInWindow.filter((o) => !isWebstore(o));
  // Mirror first so the paced MO crawl only touches orders the mirror lacks (see below).
  const mirroredEarly = await portalMirroredLineItems(eligible.map((o) => o.id_Order));
  // Staleness guard (Erik 2026-09-02): an order REOPENED and repriced after the sync's 60-day window
  // keeps its old lines in the archive forever. The live header is in hand, so refuse archived lines
  // whose total disagrees with ManageOrders' cur_SubTotal and fetch that order fresh instead.
  const subtotalByOrder = new Map(eligible.map((o) => [String(o.id_Order), Number(o.cur_SubTotal)]));
  let staleMirror = 0;
  mirroredEarly.forEach((j, id) => {
    const live = subtotalByOrder.get(id);
    const archived = rewardRound((j.result || []).reduce((s, li) => s + (Number(li.LineQuantity) || 0) * (Number(li.LineUnitPrice) || 0), 0));
    if (Number.isFinite(live) && live > 0 && Math.abs(live - archived) > 0.5) { staleMirror++; _mirrorCache.delete(id); _moLineCache.delete(id); return; }
    if (!_moLineCache.has(id)) _moLineCache.set(id, { t: Date.now(), result: j });
  });
  const [lineJsons, ledgerJson] = await Promise.all([
    portalPacedLineItems(eligible.map((o) => o.id_Order), hdrs),
    portalFetchJson(`${CRM_API_BASE}/api/customer-rewards/ledger/${encodeURIComponent(cid)}`, hdrs, 8000),
  ]);
  if (!ledgerJson) throw new Error('ledger unavailable');   // without it "pending" would double-grant
  // Per order: grants (+) and 'adjust' entries carrying the order ref (a reversal after a
  // re-invoice, −) NET together as "granted"; 'redeem' entries are what the customer spent on it.
  const grantedByOrder = new Map(); const redeemedByOrder = new Map();
  (ledgerJson.entries || []).forEach((e) => {
    const ref = String(e.orderRef || '').trim(); const amt = Number(e.amount) || 0;
    if (!ref || !amt) return;
    const type = String(e.type || '').toLowerCase();
    if (type === 'redeem' || (amt < 0 && type !== 'adjust')) redeemedByOrder.set(ref, rewardRound((redeemedByOrder.get(ref) || 0) + Math.abs(amt)));
    else grantedByOrder.set(ref, rewardRound((grantedByOrder.get(ref) || 0) + amt));
  });
  const ledgerBalance = rewardRound(Number(ledgerJson.balance) || 0);
  // (Mirror rows were seeded into the line cache above, so any order the mirror holds never hit MO.)
  // Catalog rows per unique style, in parallel (portalStyleRows memoises 30 min).
  const styles = new Set();
  eligible.forEach((o, i) => (((lineJsons[i] && lineJsons[i].result) || [])).forEach((li) => { const n = portalNormalizePart(li); if (n && !(li._pieceCost != null && li._pieceCost > 0)) styles.add(n.style.toUpperCase()); }));
  const rowsByStyle = new Map();
  await Promise.all([...styles].map(async (s) => rowsByStyle.set(s, await portalStyleRows(s))));
  const orders = eligible.map((o, i) => {
    const items = lineJsons[i] && lineJsons[i].result;
    const lines = [];
    const boost = rewardBoostFor(program, o.date_Invoiced);
    let redeemedOnOrder = 0;
    (items || []).forEach((li) => {
      if (isRewardRedeemLine(program, li)) {
        redeemedOnOrder = rewardRound(redeemedOnOrder + Math.abs((Number(li.LineQuantity) || 1) * (Number(li.LineUnitPrice) || 0)));
        return;
      }
      const norm = portalNormalizePart(li);
      if (!norm) return;
      const qty = Number(li.LineQuantity) || portalSumSizes(li);
      const unit = Number(li.LineUnitPrice) || 0;
      if (qty <= 0 || unit <= 0) return;
      const cost = (li._pieceCost != null && li._pieceCost > 0) ? li._pieceCost : rewardGarmentCost(rowsByStyle.get(norm.style.toUpperCase()), norm.color);
      const tier = cost == null ? rewardTierForUnknownCost(program) : rewardTierForCost(program, cost);
      const revenue = rewardRound(qty * unit);
      lines.push({
        partNumber: li.PartNumber || '', style: norm.style, color: norm.color, description: li.PartDescription || '',
        qty, unitPrice: unit, revenue, cost,
        tier: tier ? tier.label : null, ratePct: tier ? tier.ratePct : 0,
        reward: tier ? rewardRound(revenue * tier.ratePct / 100 * (boost ? boost.multiplier : 1)) : 0,
        note: cost == null ? 'cost unknown (not a SanMar catalog style) — base rate' : (tier ? '' : 'no band covers this cost'),
      });
    });
    const reward = rewardRound(lines.reduce((s, l) => s + l.reward, 0));
    const granted = grantedByOrder.get(String(o.id_Order)) || 0;
    const redeemPosted = redeemedByOrder.get(String(o.id_Order)) || 0;
    return {
      orderNumber: o.id_Order, invoiceDate: o.date_Invoiced, orderDate: o.date_Ordered, designName: o.DesignName || '',
      total: Number(o.cur_TotalInvoice) || 0,
      eligibleRevenue: rewardRound(lines.reduce((s, l) => s + l.revenue, 0)),
      reward, granted, pending: rewardRound(Math.max(0, reward - granted)),
      // Granted more than the order now earns (re-invoiced lower, credited, zeroed). Never
      // clawed back automatically (Erik 2026-09-02) — surfaced for a staff "Reverse" decision.
      overGranted: items ? rewardRound(Math.max(0, granted - reward)) : 0,
      boost: boost ? { label: boost.label, multiplier: boost.multiplier, name: boost.name } : null,
      // Redemption found on the order (RWD-REDEEM line) vs what the ledger already holds for it.
      redemption: redeemedOnOrder || redeemPosted ? { onOrder: redeemedOnOrder, posted: redeemPosted, pending: rewardRound(Math.max(0, redeemedOnOrder - redeemPosted)) } : null,
      linesUnavailable: !items, lines,
    };
  });
  const totals = orders.reduce((t, o) => ({
    eligibleRevenue: rewardRound(t.eligibleRevenue + o.eligibleRevenue), earned: rewardRound(t.earned + o.reward),
    granted: rewardRound(t.granted + o.granted), pending: rewardRound(t.pending + o.pending),
    overGranted: rewardRound(t.overGranted + o.overGranted),
    redeemedOnOrders: rewardRound(t.redeemedOnOrders + (o.redemption ? o.redemption.onOrder : 0)),
    redeemPending: rewardRound(t.redeemPending + (o.redemption ? o.redemption.pending : 0)),
  }), { eligibleRevenue: 0, earned: 0, granted: 0, pending: 0, overGranted: 0, redeemedOnOrders: 0, redeemPending: 0 });
  totals.ledgerBalance = ledgerBalance;
  const unavailable = orders.filter((o) => o.linesUnavailable).map((o) => o.orderNumber);
  return {
    program, window: { from: windowStart.toISOString().slice(0, 10), to: program.earn ? program.earn.to : end }, orders, totals,
    unavailable,
    partial: unavailable.length > 0,
    progress: { fetched: orders.length - unavailable.length, total: orders.length },
    excludedWebstore: { count: excludedWeb.length, revenue: rewardRound(excludedWeb.reduce((s, o) => s + (Number(o.cur_TotalInvoice) || 0), 0)) },
    source: { mirrored: eligible.filter((o, i) => lineJsons[i] && lineJsons[i].mirrored).length, manageOrders: eligible.filter((o, i) => lineJsons[i] && !lineJsons[i].mirrored).length, staleMirror },
    generatedAt: new Date().toISOString(),
  };
}
// GET /api/portal-admin/rewards/accrual/:id — the breakdown (staff only; nothing is written).
app.get('/api/portal-admin/rewards/accrual/:id', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try { res.json(await computeRewardAccrual(cid)); }
  catch (err) { console.error('[portal-admin] accrual failed:', err.message); res.status(503).json({ error: 'Could not calculate earned rewards right now (' + err.message + ').' }); }
});
// POST /api/portal-admin/rewards/accrual/:id/post { orders?: [orderNo], company_name? } — recomputes
// SERVER-SIDE (client amounts are never trusted) and posts one grant per order that still has a
// pending amount. Idempotent by Order_Ref; the staff email is stamped as Created_By.
app.post('/api/portal-admin/rewards/accrual/:id/post', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const acc = await computeRewardAccrual(cid);
    if (!acc.program.configured) return res.status(409).json({ error: 'Reward program is not configured (no RWD-EARN rows in Service_Codes).' });
    if (acc.partial) return res.status(409).json({ error: `Still fetching order details (${acc.progress.fetched} of ${acc.progress.total}) — calculate again, then post.` });
    const only = Array.isArray(req.body && req.body.orders) ? new Set(req.body.orders.map(String)) : null;
    const todo = acc.orders.filter((o) => o.pending > 0 && !o.linesUnavailable && (!only || only.has(String(o.orderNumber))));
    const staff = (req.session.crmUser && req.session.crmUser.email) || 'staff';
    const posted = []; const failed = [];
    for (const o of todo) {
      const bands = [...new Set(o.lines.filter((l) => l.reward > 0).map((l) => l.tier))].join(', ');
      const body = {
        id_Customer: cid, company_name: String((req.body && req.body.company_name) || '').slice(0, 255),
        amount: o.pending, type: 'grant',
        reason: (`Earned on paid order #${o.orderNumber} (${acc.program.months}-mo program · band ${bands})`).slice(0, 255),
        order_ref: String(o.orderNumber), created_by: staff,
      };
      try {
        const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
        posted.push({ orderNumber: o.orderNumber, amount: o.pending });
      } catch (e) { failed.push({ orderNumber: o.orderNumber, error: e.message }); }
    }
    // Redemptions found on orders (RWD-REDEEM lines) that the ledger does not hold yet.
    const redeemTodo = acc.orders.filter((o) => o.redemption && o.redemption.pending > 0 && !o.linesUnavailable && (!only || only.has(String(o.orderNumber))));
    const redeemed = [];
    for (const o of redeemTodo) {
      const body = {
        id_Customer: cid, company_name: String((req.body && req.body.company_name) || '').slice(0, 255),
        amount: o.redemption.pending, type: 'redeem',
        reason: (`Redeemed on order #${o.orderNumber} (RWD-REDEEM line on the ShopWorks order)`).slice(0, 255),
        order_ref: String(o.orderNumber), created_by: staff,
      };
      try {
        const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
        redeemed.push({ orderNumber: o.orderNumber, amount: o.redemption.pending });
      } catch (e) { failed.push({ orderNumber: o.orderNumber, error: 'redeem: ' + e.message }); }
    }
    const total = rewardRound(posted.reduce((s, p) => s + p.amount, 0));
    const redeemTotal = rewardRound(redeemed.reduce((s, p) => s + p.amount, 0));
    console.log(`[portal-admin] ${staff} posted ${posted.length} grant(s) $${total.toFixed(2)} + ${redeemed.length} redemption(s) $${redeemTotal.toFixed(2)} for customer ${cid}${failed.length ? ` (${failed.length} failed)` : ''}`);
    res.json({ ok: failed.length === 0, posted, redeemed, failed, total, redeemTotal });
  } catch (err) { console.error('[portal-admin] accrual post failed:', err.message); res.status(503).json({ error: 'Could not post reward grants right now.' }); }
});

// POST /api/portal-admin/rewards/accrual/:id/reverse { orderNumber, company_name? } — an order that
// was re-invoiced LOWER after its grant (customer rejected the goods, order credited or zeroed)
// keeps its reward unless a staff member reverses it here: ONE 'adjust' entry of −min(over-grant,
// unspent balance), Order_Ref = the order, so the accrual nets it against the grant. Never
// automatic, never below zero — dollars already redeemed stay redeemed (Erik 2026-09-02).
app.post('/api/portal-admin/rewards/accrual/:id/reverse', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  const cid = String(req.params.id || '');
  const orderNo = String((req.body && req.body.orderNumber) || '').trim();
  if (!/^\d+$/.test(cid) || !/^\d+$/.test(orderNo)) return res.status(400).json({ error: 'numeric customer id and orderNumber required' });
  try {
    const acc = await computeRewardAccrual(cid);
    if (acc.partial) return res.status(409).json({ error: `Still fetching order details (${acc.progress.fetched} of ${acc.progress.total}) — calculate again, then reverse.` });
    const o = acc.orders.find((x) => String(x.orderNumber) === orderNo);
    if (!o) return res.status(404).json({ error: `Order #${orderNo} is not in this customer's eligible orders.` });
    if (!(o.overGranted > 0.005)) return res.status(409).json({ error: `Order #${orderNo} is not over-granted (granted ${o.granted.toFixed(2)}, earns ${o.reward.toFixed(2)}).` });
    const bal = rewardRound(Number(acc.totals.ledgerBalance) || 0);
    const amount = rewardRound(Math.min(o.overGranted, bal));
    if (amount <= 0.005) return res.status(409).json({ error: `Nothing left to reverse — the balance is ${bal.toFixed(2)} (already redeemed).` });
    const staff = (req.session.crmUser && req.session.crmUser.email) || 'staff';
    const body = {
      id_Customer: cid, company_name: String((req.body && req.body.company_name) || '').slice(0, 255),
      amount: -amount, type: 'adjust',
      reason: (`Order #${orderNo} re-invoiced — reward reduced from ${o.granted.toFixed(2)} to ${o.reward.toFixed(2)}` + (amount < o.overGranted ? ` (${(o.overGranted - amount).toFixed(2)} already redeemed, not recovered)` : '')).slice(0, 255),
      order_ref: orderNo, created_by: staff,
    };
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    console.log(`[portal-admin] ${staff} reversed $${amount.toFixed(2)} on order #${orderNo} for customer ${cid}`);
    res.json({ ok: true, orderNumber: orderNo, reversed: amount, overGranted: o.overGranted, balance: Number(j.balance) || 0 });
  } catch (err) { console.error('[portal-admin] accrual reverse failed:', err.message); res.status(503).json({ error: 'Could not reverse the grant right now.' }); }
});

// POST /api/portal-admin/rewards/expire/:id — after the spend window closes, zero what is left:
// one 'adjust' entry of −balance, reason "<program> expired <date>". Refuses before the date.
app.post('/api/portal-admin/rewards/expire/:id', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const prog = await loadRewardProgram();
    if (!prog.spend) return res.status(409).json({ error: 'No spend window (RWD-SPEND) is configured, so nothing expires.' });
    const day = new Date().toISOString().slice(0, 10);
    if (day <= prog.spend.to) return res.status(409).json({ error: `${prog.name} can still be redeemed until ${prog.spend.to}.` });
    const bR = await fetch(`${CRM_API_BASE}/api/customer-rewards/balance/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    const bal = bR.ok ? (Number((await bR.json()).balance) || 0) : 0;
    if (bal <= 0.005) return res.json({ ok: true, expired: 0, balance: bal });
    const staff = (req.session.crmUser && req.session.crmUser.email) || 'staff';
    const body = { id_Customer: cid, company_name: String((req.body && req.body.company_name) || '').slice(0, 255), amount: -bal, type: 'adjust', reason: `${prog.name} expired ${prog.spend.to} — unused balance removed`, order_ref: '', created_by: staff };
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    console.log(`[portal-admin] ${staff} expired $${bal.toFixed(2)} of ${prog.name} for customer ${cid}`);
    res.json({ ok: true, expired: bal, balance: Number(j.balance) || 0 });
  } catch (err) { console.error('[portal-admin] expire failed:', err.message); res.status(503).json({ error: 'Could not expire the balance right now.' }); }
});

// GET /api/portal-admin/preview/:id/invoice/:orderNo — one invoice, ownership-checked
// against the PREVIEWED customer id (staff can't pull an order that isn't this customer's).
app.get('/api/portal-admin/preview/:id/invoice/:orderNo', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  const orderNo = String(req.params.orderNo || '');
  if (!/^\d+$/.test(cid) || !/^\d+$/.test(orderNo)) return res.status(400).json({ error: 'numeric ids required' });
  try {
    const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
    const oR = await fetch(`${CRM_API_BASE}/api/manageorders/orders/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!oR.ok) throw new Error('order ' + oR.status);
    const oJ = await oR.json();
    const o = Array.isArray(oJ.result) ? oJ.result[0] : (oJ.result || oJ);
    if (!o || String(o.id_Customer) !== cid) return res.status(404).json({ error: 'Not found' });
    const lR = await fetch(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    const lJ = lR.ok ? await lR.json() : { result: [] };
    const items = (lJ.result || []).sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0)).map(projectPortalLineItem);
    res.json(projectPortalInvoice(o, items));
  } catch (err) {
    console.error('[portal-admin] preview invoice failed:', err.message);
    res.status(503).json({ error: 'Invoice preview temporarily unavailable' });
  }
});

// Staff preview of the 2026-09-01 additions. The customer routes read the sign-in email
// from the SESSION; a preview has no customer session, so the email comes from the invite
// registry (Customer_Portal_Access rows for that id — the same list the admin console shows).
let _portalAccessListCache = { t: 0, rows: [] };
async function portalAccessRowsForCustomer(cid) {
  if (Date.now() - _portalAccessListCache.t > 5 * 60 * 1000) {
    const r = await fetch(`${CRM_API_BASE}/api/customer-portal-access/`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (r.ok) _portalAccessListCache = { t: Date.now(), rows: ((await r.json()).rows || []) };
  }
  return _portalAccessListCache.rows.filter((x) => String(x.id_Customer) === String(cid));
}
app.get('/api/portal-admin/preview/:id/me', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const rows = await portalAccessRowsForCustomer(cid);
    const first = rows.find((x) => x.enabled) || rows[0] || null;
    res.json({ customerId: cid, staffPreview: true, email: first ? (first.email || '') : '', companyName: first ? (first.company_name || '') : '',
      emails: rows.map((x) => x.email).filter(Boolean) });
  } catch (err) { console.error('[portal-admin] preview me failed:', err.message); res.status(503).json({ error: 'Preview temporarily unavailable' }); }
});
app.get('/api/portal-admin/preview/:id/quotes', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const emails = (await portalAccessRowsForCustomer(cid)).map((x) => String(x.email || '').toLowerCase()).filter(Boolean);
    const lists = await Promise.all([...new Set(emails)].map((e) => buildPortalQuotes(e)));
    const seen = new Set(); const quotes = [];
    lists.flat().forEach((q) => { if (!seen.has(q.quoteId)) { seen.add(q.quoteId); quotes.push(q); } });
    quotes.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    res.json({ quotes });
  } catch (err) { console.error('[portal-admin] preview quotes failed:', err.message); res.status(503).json({ error: 'Quotes preview temporarily unavailable' }); }
});
app.get('/api/portal-admin/preview/:id/order/:orderNo/tracking', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || ''); const orderNo = String(req.params.orderNo || '');
  if (!/^\d+$/.test(cid) || !/^\d+$/.test(orderNo)) return res.status(400).json({ error: 'numeric ids required' });
  try {
    const rows = await portalOrderTracking(cid, orderNo);
    if (!rows) return res.status(404).json({ error: 'Not found' });
    res.json({ tracking: rows });
  } catch (err) { console.error('[portal-admin] preview tracking failed:', err.message); res.status(503).json({ error: 'Tracking preview temporarily unavailable' }); }
});

// Preview PAGES (staff-gated) — reuse the customer portal HTML, which detects the
// /portal-admin/preview/ path and fetches the staff endpoints above (read-only).
app.get('/portal-admin/preview/:id', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-portal.html'));
});
app.get('/portal-admin/preview/:id/invoice/:orderNo', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-invoice.html'));
});
app.get('/portal-admin/preview/:id/product/:style', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-product.html'));
});

// ALLOWLIST projection for the art-request DETAIL customer view. Mirrors exactly
// the fields the ?view=customer render path displays (mapped + adversarially
// verified 2026-06-29). Excludes NOTES, Sales_Rep, staff/contact emails, phone,
// SW refs, art charges (Art_Minutes/Amount_Art_Billed/Prelim_Charges), internal
// statuses, Rep_Mockup, working files (File_Upload/CDN_Link), and the per-slot
// Mockup_N_Note fields (artist commentary, never shown to a customer).
function projectPortalArtDetail(a, cid) {
  return {
    PK_ID: a.PK_ID, ID_Design: a.ID_Design || null, // ids needed for the existing customer approve/revise writes
    Status: a.Status || null, Revision_Count: a.Revision_Count || null, Artwork_Status: a.Artwork_Status || null,
    Is_Rush: a.Is_Rush || null, Is_On_Hold: a.Is_On_Hold || null, On_Hold_Note: a.On_Hold_Note || null,
    Request_Type: a.Request_Type || null, CompanyName: a.CompanyName || null,
    Order_Type: portalOrderTypeText(a.Order_Type), Order_Type_Source: a.Order_Type_Source || null,
    Item_Type: a.Item_Type || null, Item_Specs_Notes: a.Item_Specs_Notes || null,
    JDS_SKU: a.JDS_SKU || null, JDS_Design_Name: a.JDS_Design_Name || null, JDS_Color: a.JDS_Color || null,
    JDS_Placement: a.JDS_Placement || null, JDS_Quantity: a.JDS_Quantity || null,
    Due_Date: a.Due_Date || null, Date_Created: a.Date_Created || null, Garment_Placement: a.Garment_Placement || null,
    GarmentStyle: a.GarmentStyle || null, GarmentColor: a.GarmentColor || null,
    Garm_Style_2: a.Garm_Style_2 || null, Garm_Style_3: a.Garm_Style_3 || null, Garm_Style_4: a.Garm_Style_4 || null,
    Garm_Color_2: a.Garm_Color_2 || null, Garm_Color_3: a.Garm_Color_3 || null, Garm_Color_4: a.Garm_Color_4 || null,
    Swatch_1: a.Swatch_1 || null, Swatch_2: a.Swatch_2 || null, Swatch_3: a.Swatch_3 || null, Swatch_4: a.Swatch_4 || null,
    MAIN_IMAGE_URL_1: a.MAIN_IMAGE_URL_1 || null, MAIN_IMAGE_URL_2: a.MAIN_IMAGE_URL_2 || null,
    MAIN_IMAGE_URL_3: a.MAIN_IMAGE_URL_3 || null, MAIN_IMAGE_URL_4: a.MAIN_IMAGE_URL_4 || null,
    Artwork_Locations: a.Artwork_Locations || null, Color_Mode: a.Color_Mode || null, PMS_Colors: a.PMS_Colors || null,
    Thread_Colors: a.Thread_Colors || null, Underbase_Required: a.Underbase_Required || null, Exact_Text: a.Exact_Text || null,
    Uploaded_File_Type: a.Uploaded_File_Type || null,
    Prev_Order_Num: a.Prev_Order_Num || null, Prev_Design_Num: a.Prev_Design_Num || null,
    Repeat_Keep_Same: a.Repeat_Keep_Same || null, Repeat_Change: a.Repeat_Change || null,
    Final_Approved_Mockup: portalProofUrl(a.Final_Approved_Mockup, cid),
    Box_File_Mockup: portalProofUrl(a.Box_File_Mockup, cid), BoxFileLink: portalProofUrl(a.BoxFileLink, cid), Company_Mockup: portalProofUrl(a.Company_Mockup, cid),
    Mockup_4: portalProofUrl(a.Mockup_4, cid), Mockup_5: portalProofUrl(a.Mockup_5, cid), Mockup_6: portalProofUrl(a.Mockup_6, cid),
  };
}

// GET /api/portal/:customerId/art-request/:designId — customer-safe single art
// request (detail page customer view). Authorizes the row belongs to :customerId
// before returning; generic 404 on miss/mismatch (no enumeration oracle).
// Returns a 1-element array to match the client's existing [row]=artRequests shape.
app.get('/api/portal/:customerId/art-request/:designId', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const designId = String(req.params.designId || '');
    if (!/^\d+(\.\d+)?$/.test(designId)) return res.status(404).json({ error: 'Not found' });
    const resp = await portalProxyGet(`/api/artrequests?id_design=${encodeURIComponent(designId)}&limit=1`);
    const rows = Array.isArray(resp) ? resp : ((resp && resp.records) || []);
    const row = rows[0];
    const cid = req.portalCustomerId;
    const owns = row && (String(row.id_customer) === cid || String(row.Shopwork_customer_number) === cid);
    if (!owns) return res.status(404).json({ error: 'Not found' }); // missing OR not-this-customer → identical
    res.json([projectPortalArtDetail(row, cid)]);
  } catch (err) {
    console.error('[Portal] art-request detail failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// ── Mockup detail customer view (#1 Stage C) ────────────────────────────────
// Derive ONLY a first name from a rep's email — the customer sees "Your Rep:
// Nika", never the raw staff email.
function portalRepDisplayName(v) {
  if (!v) return '';
  const s = String(v);
  const local = s.indexOf('@') >= 0 ? s.split('@')[0] : s;
  const first = local.split(/[._\s]/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}
// The customer notes list is hidden; notes only feed the status timeline, which
// keyword-matches Note_Text/Note_Type/Created_Date. Return ONLY the status
// keywords found (no real note content) so the timeline still dates its steps.
const PORTAL_TIMELINE_KEYWORDS = ['mockup sent', 'awaiting approval', 'revision requested', 'revision', 'working', 'in progress', 'approved', 'completed'];
function sanitizePortalNote(n) {
  const t = String(n.Note_Text || '').toLowerCase();
  return {
    Note_Type: n.Note_Type || null,
    Created_Date: n.Created_Date || null,
    Note_Text: PORTAL_TIMELINE_KEYWORDS.filter((k) => t.indexOf(k) >= 0).join(' '),
  };
}
function projectPortalVersion(v) { return { Slot_Key: v.Slot_Key, Version_Number: v.Version_Number }; }
function projectPortalThread(t) { return { Mockup_Slot: t.Mockup_Slot, Thread_Sequence_JSON: t.Thread_Sequence_JSON }; }
// ALLOWLIST projection for the mockup DETAIL customer view (mapped + verified).
// Excludes AE_Notes, Artist_Notes, Sales_Rep, Work_Order_Number, Id_Customer,
// Customer_Email, Box_Folder_ID, Deleted_*, Garment_*, Thread_Colors, Due/Completion
// dates; Submitted_By is reduced to a first-name only.
function projectPortalMockupDetail(m, cid) {
  return {
    ID: m.ID, PK_ID: m.PK_ID,
    Status: m.Status || null, Revision_Count: m.Revision_Count || null,
    Is_On_Hold: m.Is_On_Hold || null, On_Hold_Note: m.On_Hold_Note || null,
    Design_Number: m.Design_Number || null, Company_Name: m.Company_Name || null, Design_Name: m.Design_Name || null,
    Mockup_Type: m.Mockup_Type || null, Print_Location: m.Print_Location || null,
    Logo_Width: m.Logo_Width || null, Logo_Height: m.Logo_Height || null, Stitch_Count: m.Stitch_Count || null,
    Design_Size: m.Design_Size || null, Size_Specs: m.Size_Specs || null,
    Submitted_Date: m.Submitted_Date || null, Submitted_By: portalRepDisplayName(m.Submitted_By),
    Customer_Name: m.Customer_Name || null, Customer_Approval_Sent_Date: m.Customer_Approval_Sent_Date || null,
    Box_Mockup_1: portalProofUrl(m.Box_Mockup_1, cid), Box_Mockup_2: portalProofUrl(m.Box_Mockup_2, cid), Box_Mockup_3: portalProofUrl(m.Box_Mockup_3, cid),
    Box_Mockup_4: portalProofUrl(m.Box_Mockup_4, cid), Box_Mockup_5: portalProofUrl(m.Box_Mockup_5, cid), Box_Mockup_6: portalProofUrl(m.Box_Mockup_6, cid),
  };
}
// Fetch + authorize a mockup belongs to :customerId; returns the raw row or null.
async function authorizePortalMockup(id, cid) {
  const resp = await portalProxyGet(`/api/mockups/${encodeURIComponent(id)}`);
  const rec = resp && resp.record;
  if (!rec || String(rec.Id_Customer) !== String(cid)) return null;
  return rec;
}

// GET /api/portal/:customerId/mockup/:id — bundled customer-safe mockup detail
// (record + sanitized timeline notes + version badges). Mirrors the shapes the
// client distributes ({success,record}, {notes}, {versions}).
app.get('/api/portal/:customerId/mockup/:id', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
    const rec = await authorizePortalMockup(id, req.portalCustomerId);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const [notesResp, versionsResp] = await Promise.all([
      portalProxyGet(`/api/mockup-notes/${encodeURIComponent(id)}`).catch(() => ({ notes: [] })),
      portalProxyGet(`/api/mockup-versions/${encodeURIComponent(id)}`).catch(() => ({ versions: [] })),
    ]);
    res.json({
      success: true,
      record: projectPortalMockupDetail(rec, req.portalCustomerId),
      notes: ((notesResp && notesResp.notes) || []).map(sanitizePortalNote),
      versions: ((versionsResp && versionsResp.versions) || []).map(projectPortalVersion),
    });
  } catch (err) {
    console.error('[Portal] mockup detail failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// GET /api/portal/:customerId/mockup/:id/threads — gated thread sequences
// (EMB_Design_Files) for the customer mockup view: Mockup_Slot + JSON only.
app.get('/api/portal/:customerId/mockup/:id/threads', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
    const rec = await authorizePortalMockup(id, req.portalCustomerId);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const resp = await portalProxyGet(`/api/emb-designs/by-mockup/${encodeURIComponent(id)}`).catch(() => ({ records: [] }));
    res.json({ records: ((resp && resp.records) || []).map(projectPortalThread) });
  } catch (err) {
    console.error('[Portal] mockup threads failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// Brands browse page
app.get('/brands.html', (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'brands.html'));
});

// Phase 1 Infrastructure Test Pages — REMOVED 2026-08-05.
// These three routes sendFile'd out of tests/. All three target files had
// already been deleted, so every one of them was serving an error in
// production before this change; they were also the last runtime readers of
// tests/, which is now neither mounted nor shipped in the slug. No tombstone
// needed — there is no static mount underneath that could pick these paths up.

// (2026-09-06: the explicit route for the retired root "app-new" script is gone with the file — no
// page ever requested it; index.html loads app-modern.js.)

app.get('/autocomplete-new.js', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'autocomplete-new.js'));
});

app.get('/catalog-search.css', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'catalog-search.css'));
});



// ROUTE DEFINITIONS - Order matters!
// 1. First define the root route
app.get('/', (req, res) => {
  console.log('Serving index.html for root route');
  sendHashedHtml(res, path.join(SERVER_DIR, 'index.html'));
});

// Also serve index.html when accessed with .html extension
app.get('/index.html', (req, res) => {
  console.log('Serving index.html for /index.html route');
  sendHashedHtml(res, path.join(SERVER_DIR, 'index.html'));
});

// 2. API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    apiBaseUrl: API_BASE_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Stripe Payment Integration - 3-Day Tees
// GET /api/stripe-config - Return Stripe publishable key
app.get('/api/stripe-config', (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const publishableKey = mode === 'production'
      ? process.env.STRIPE_LIVE_PUBLIC_KEY
      : process.env.STRIPE_TEST_PUBLIC_KEY;

    if (!publishableKey) {
      console.error('[Stripe] Publishable key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }

    console.log('[Stripe] Returning publishable key for mode:', mode);
    res.json({ publishableKey });
  } catch (error) {
    console.error('[Stripe] Error in stripe-config endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve Stripe configuration' });
  }
});

// POST /api/create-payment-intent - Create Stripe payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    // DEBUG: Log key info (without exposing full key)
    console.log('[Stripe Debug] Mode:', mode);
    console.log('[Stripe Debug] Key exists:', !!secretKey);
    console.log('[Stripe Debug] Key prefix:', secretKey?.substring(0, 12) + '...');
    console.log('[Stripe Debug] Key length:', secretKey?.length);
    console.log('[Stripe Debug] ENV STRIPE_MODE:', process.env.STRIPE_MODE);
    console.log('[Stripe Debug] ENV TEST_KEY exists:', !!process.env.STRIPE_TEST_SECRET_KEY);
    console.log('[Stripe Debug] ENV LIVE_KEY exists:', !!process.env.STRIPE_LIVE_SECRET_KEY);

    if (!secretKey) {
      console.error('[Stripe] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    // Initialize Stripe with the appropriate secret key
    const stripeInstance = stripe(secretKey);

    const { amount, currency, orderId, idempotencyKey } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'Missing required fields: amount and currency' });
    }

    console.log('[Stripe] Creating payment intent:', { amount, currency, mode, orderId });

    // Create payment intent with idempotency key to prevent duplicate charges
    const createOptions = {
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: orderId || 'unknown',
        source: '3-day-tees'
      }
    };

    // Create payment intent (with optional idempotency key to prevent duplicate charges)
    let paymentIntent;
    if (idempotencyKey) {
      console.log('[Stripe] Using idempotency key:', idempotencyKey.substring(0, 20) + '...');
      paymentIntent = await stripeInstance.paymentIntents.create(createOptions, {
        idempotencyKey: idempotencyKey
      });
    } else {
      paymentIntent = await stripeInstance.paymentIntents.create(createOptions);
    }

    console.log('[Stripe] Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('[Stripe] Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
});

// POST /api/three-day-tees/shipping-estimate — the number the studio page
// DISPLAYS for shipping. Same resolver the reprice charges with, so what the
// customer sees is what Stripe bills. {toZip, qty} → {amount, source}.
app.post('/api/three-day-tees/shipping-estimate', async (req, res) => {
  try {
    const { toZip, qty, styleNumber } = req.body || {};
    // styleNumber present → Custom-Tees caller (per-style piece weight);
    // absent → legacy 3DT page (PC54). Same resolver family either way.
    const resolved = styleNumber
      ? await resolveCtsShipping(toZip, qty, styleNumber)
      : await resolveTdtShipping(toZip, qty);
    res.json(resolved);
  } catch (e) {
    console.error('[3DT ship] estimate endpoint failed:', e);
    res.status(502).json({ error: 'Shipping estimate unavailable' });
  }
});

// POST /api/create-checkout-session - Create Stripe Checkout Session (hosted page)
// Rewritten 2026-06-09 (3-Day Tees studio rebuild): the server RECOMPUTES the
// whole price from Caspio (pricing-bundle + Service_Codes + DOR tax) and
// builds the Stripe line_items itself — the client total is only validated
// against it. Also: unique QuoteID (was random-collision-prone) and the
// binding ship-promise date stamped here, not in the browser.
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const {
      customer_email,
      customerData,
      colorConfigs,
      orderTotals,        // client quote — advisory, validated below
      orderSettings
    } = req.body;

    if (!customerData || !colorConfigs || !orderTotals) {
      return res.status(400).json({
        error: 'Missing required fields: customerData, colorConfigs, orderTotals'
      });
    }

    // Redirect URLs are pinned server-side (client-supplied URLs would be an
    // open redirect off a payment flow).
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // Channel registry dispatch: 'custom-tees' = the multi-style DTG
    // storefront (per-style bundle, online LTM, opt-in rush); absent/unknown
    // = legacy 3DT (the registry default — old rows must keep working).
    const chCfg = channelConfig(orderSettings && orderSettings.channel);
    const chLog = chCfg.logPrefix;

    // Artwork-rights attestation is REQUIRED for storefront orders (legal
    // record; the client checkbox is advisory — this is the enforcement).
    // The ack object is stored verbatim in OrderSettingsJSON. (2026-06-10)
    if (chCfg.requireRightsAck && !(orderSettings && orderSettings.rightsAck && orderSettings.rightsAck.checked)) {
      return res.status(400).json({
        error: 'Please confirm you own or have permission to print your artwork before checking out — nothing was charged.'
      });
    }

    // ── Authoritative server-side reprice ──────────────────────────────
    let priced;
    try {
      priced = await chCfg.rebuildQuote(colorConfigs, orderSettings, customerData);
    } catch (e) {
      console.error(`${chLog} Server reprice failed:`, e);
      // BELOW_MINIMUM: caps' structured 8-cap-minimum error (the module never
      // prices the 1-7 tier) — a customer-fixable input problem, like the
      // other two codes, so it 400s instead of 502ing.
      if (e.code === 'STYLE_NOT_ALLOWED' || e.code === 'RUSH_NOT_ELIGIBLE' || e.code === 'BELOW_MINIMUM') {
        return res.status(400).json({ error: e.message + ' — nothing was charged.' });
      }
      return res.status(502).json({
        error: 'Live pricing is unavailable right now — nothing was charged. Please try again or call 253-922-5793.'
      });
    }
    const { quote, tax } = priced;

    if (!quote.combinedQty || !quote.lines.length) {
      return res.status(400).json({ error: 'Order has no items' });
    }
    const clientTotal = parseFloat(orderTotals.grandTotal);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - quote.total) > 0.01) {
      console.error(`[3-Day Tees Checkout] PRICE MISMATCH client=$${clientTotal} server=$${quote.total}`);
      return res.status(409).json({
        error: `Pricing changed while you were designing (your screen: $${clientTotal?.toFixed ? clientTotal.toFixed(2) : clientTotal} · current: $${quote.total.toFixed(2)}). Refresh the page to reload live pricing — nothing was charged.`
      });
    }

    // Sanitize colorConfigs server-side before they become the order of
    // record: whitelisted sizes only, SERVER unit prices (the client's were
    // advisory — the ShopWorks push reads this JSON, and a doctored payload
    // must not ship uncharged shirts or mislabeled line prices).
    const cleanConfigs = {};
    const sizeWhitelist = chCfg.sizeWhitelist(priced);
    Object.values(colorConfigs).forEach(c => {
      if (!c || !c.catalogColor) return;
      const sizeBreakdown = {};
      let totalQuantity = 0;
      sizeWhitelist.forEach(size => {
        const q = parseInt((c.sizeBreakdown || {})[size] && c.sizeBreakdown[size].quantity, 10) || 0;
        if (q > 0) {
          sizeBreakdown[size] = { quantity: q, unitPrice: quote.unitBySize[size].finalPrice };
          totalQuantity += q;
        }
      });
      if (totalQuantity > 0) {
        cleanConfigs[c.catalogColor] = {
          catalogColor: c.catalogColor,
          displayColor: c.displayColor || c.catalogColor,
          totalQuantity,
          sizeBreakdown
        };
      }
    });

    // ── Live stock gate (CTS only, 2026-06-10) ─────────────────────────
    // Validate every color+size qty against live stock (helpers ~L1135)
    // BEFORE Stripe. Source is rush-aware: PC54 RUSH gates on Milton local
    // stock; standard orders gate on SanMar (next-day replenishment).
    // FAIL-OPEN: a feed error/timeout logs + stamps stockChecked:false
    // (push note flags it) — it never blocks the sale. A would-be shortage
    // is re-confirmed on a FRESH fetch before 409ing.
    let stockChecked = false;
    if (chCfg.stockGate) {
      try {
        // Conflict math is channel-bound: tees compare per color+size; caps
        // aggregate by CATALOG_COLOR (stale sized partIds in cap feeds).
        let stock = await getCtsStock(priced.style, false, priced.rush);
        let conflicts = chCfg.stockConflicts(cleanConfigs, stock);
        if (conflicts.length) {
          stock = await getCtsStock(priced.style, true, priced.rush);
          conflicts = chCfg.stockConflicts(cleanConfigs, stock);
        }
        if (conflicts.length) {
          const what = conflicts.map(c => `${c.displayColor} ${c.size} (you want ${c.want}, ${c.have} left)`).join(', ');
          console.warn(`${chLog} STOCK_CONFLICT ${priced.style}: ${what}`);
          return res.status(409).json({
            error: `Some sizes just sold out: ${what}. Adjust those quantities and try again — nothing was charged.`,
            code: 'STOCK_CONFLICT',
            conflicts
          });
        }
        stockChecked = true;
      } catch (e) {
        console.warn(`${chLog} Stock check unavailable for ${priced.style} — continuing unchecked (fail-open):`, e.message);
      }
    }

    // Server-stamped numbers become the order of record.
    const serverTotals = {
      totalQuantity: quote.combinedQty,
      subtotal: quote.shirtsSubtotal,
      rushFee: 0,                              // rush lives inside unit prices
      ltmFee: quote.ltmFee,
      shipping: quote.shipping,
      shippingSource: priced.shipping.source,  // 'ups-estimate' | 'flat' | 'pickup'
      salesTax: quote.tax,
      taxRate: quote.taxRate,
      taxableBase: quote.taxableBase,
      taxAccount: tax.account,
      taxAccountName: tax.accountName,
      grandTotal: quote.total
    };

    // Binding ship-promise date — stamped at payment time, echoed to the
    // success page and the ShopWorks order note. Custom-Tees standard orders
    // promise the END of the 7-10 business-day window; the rush toggle (or
    // legacy 3DT) uses the 3-day cutoff promise.
    const shipPlan = chCfg.shipPromise(priced);
    const promise = shipPlan.promise;
    const settingsStamped = Object.assign({}, orderSettings || {}, {
      shipPromise: {
        iso: promise.shipDateIso,
        label: promise.shipDateLong,
        mode: shipPlan.mode,
        rangeLabel: promise.rangeLabel || null,    // standard mode only
        stampedAt: new Date().toISOString()
      }
      // Channel-stamped style facts (custom-tees: server-validated channel/
      // style/rush/locations/stockChecked become the order of record — the
      // push + success page read THESE; legacy 3DT stamps nothing).
    }, chCfg.stampedOrderSettings(priced, stockChecked, orderSettings || {}));

    // ── Unique QuoteID (random suffix used to collide same-day) ───────
    let quoteID = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = chCfg.buildQuoteId();
      try {
        // refresh=true is LOAD-BEARING: without it this pre-create lookup
        // caches [] under this QuoteID for 5 min on the proxy, and the
        // webhook's post-payment lookup reads that poisoned [] → "payment
        // without record". (Found in live verification 2026-06-09.)
        const check = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(candidate)}&refresh=true`, { headers: withProxySecret() });
        const rows = check.ok ? await check.json() : [];
        const list = Array.isArray(rows) ? rows : (rows?.data || []);
        if (!list.some(s => s.QuoteID === candidate)) { quoteID = candidate; break; }
        console.warn('[3-Day Tees Checkout] QuoteID collision, regenerating:', candidate);
      } catch (e) {
        // Uniqueness check unavailable — accept the candidate rather than block checkout
        quoteID = candidate;
        break;
      }
    }
    if (!quoteID) {
      return res.status(500).json({ error: 'Could not allocate an order number — please try again.' });
    }

    console.log('[3-Day Tees Checkout] Creating session for QuoteID:', quoteID,
      `($${quote.total.toFixed(2)}, ${quote.combinedQty} pcs, tax ${quote.taxRate ?? 0})`);

    // Save to Caspio BEFORE Stripe redirect (fail-closed: no save, no charge)
    try {
      await save3DTQuoteSession({
        quoteID,
        customerData,
        orderTotals: serverTotals,
        colorConfigs: cleanConfigs,
        orderSettings: settingsStamped,
        stripeSessionId: null
      });
      console.log('[3-Day Tees Checkout] ✓ Order saved to Caspio:', quoteID);
    } catch (error) {
      console.error('[3-Day Tees Checkout] Failed to save to Caspio:', error);
      return res.status(500).json({ error: 'Failed to save order data — nothing was charged. Please try again.' });
    }

    // ── Stripe line items built from the SERVER quote ──────────────────
    const cents = (v) => Math.round(v * 100);
    const lineName = (l) => chCfg.stripeLineName(priced, l);
    const line_items = quote.lines.map(l => ({
      price_data: {
        currency: 'usd',
        product_data: { name: lineName(l) },
        unit_amount: cents(l.unitPrice)
      },
      quantity: l.quantity
    }));
    if (quote.ltmFee > 0) {
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Small-batch fee (under ${priced.config.ltmThreshold} pieces)` }, unit_amount: cents(quote.ltmFee) },
        quantity: 1
      });
    }
    if (quote.shipping > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: priced.shipping.source === 'flat-under-threshold'
              ? `UPS Ground shipping (orders $${quote.shipFreeOver || 100}+ ship FREE)`
              : priced.shipping.source === 'ups-estimate'
                ? 'UPS Ground shipping (estimated for your ZIP)'
                : 'UPS Ground shipping (flat rate)'
          },
          unit_amount: cents(quote.shipping)
        },
        quantity: 1
      });
    }
    if (quote.tax > 0) {
      const pctLabel = String(Math.round(quote.taxRate * 10000) / 100);
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Sales tax (${pctLabel}%)` }, unit_amount: cents(quote.tax) },
        quantity: 1
      });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    if (!secretKey) {
      console.error('[Stripe Checkout] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    const stripeInstance = stripe(secretKey);

    // Create checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: line_items || [],
      mode: 'payment',
      customer_email: customer_email,
      success_url: `${siteOrigin}${chCfg.stripeSuccessPath(quoteID)}`,
      cancel_url: `${siteOrigin}${chCfg.stripeCancelPath()}`,
      metadata: {
        quoteID: quoteID,
        source: chCfg.stripeSource
        // NOTE: Full order data now stored in Caspio (not Stripe metadata)
        // Webhook will query Caspio using quoteID to retrieve order data
        // This eliminates Stripe's 500-character metadata limit
      }
    };

    const session = await stripeInstance.checkout.sessions.create(sessionConfig);

    console.log('[Stripe Checkout] Session created:', session.id);

    // Update Caspio with the Stripe session ID. The proxy's PUT only routes
    // by PK_ID (/quote_sessions/:id) — the legacy `PUT ?filter=QuoteID=` hit
    // no route and 404'd silently for months (SessionID never updated).
    // Bonus: this refresh=true read re-warms the lookup cache with the REAL
    // row, un-poisoning the pre-create [] entry for the webhook/success page.
    try {
      const lookup = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`, { headers: withProxySecret() });
      const rows = lookup.ok ? await lookup.json() : [];
      const row = (Array.isArray(rows) ? rows : (rows?.data || [])).find(s => s.QuoteID === quoteID);
      if (row && row.PK_ID) {
        await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
          method: 'PUT',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            SessionID: `stripe_${session.id}`,
            Notes: `${chCfg.orderNoteLabel({ rush: priced.rush, styleNumber: priced.style })} | Stripe Session: ${session.id} | Status: Checkout Created`
          })
        });
        console.log('[3-Day Tees Checkout] ✓ Updated Caspio with Stripe session ID');
      } else {
        console.warn('[3-Day Tees Checkout] Could not resolve PK_ID to stamp the Stripe session ID (non-fatal)');
      }
    } catch (error) {
      console.error('[3-Day Tees Checkout] Failed to update Caspio with session ID:', error);
      // Don't fail the request - order is already in Caspio
    }

    res.json({
      sessionId: session.id,
      quoteID: quoteID,
      url: session.url
    });

  } catch (error) {
    console.error('[Stripe Checkout] Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

// ══ POST /api/samples/create-checkout-session — Sample Program (2026-07-06) ══
// Paid BLANK samples go through Stripe hosted checkout. Free-only carts never
// come here (they keep the direct ManageOrders push the free program has
// always used — sample-order-service.js). This route is DEDICATED because
// sample carts are multi-STYLE (one unit per style) and don't fit the shared
// single-style storefront route above. Money rules:
//   • Server reprices EVERY sample via shared_components/js/sample-pricing.js
//     — the SAME dual-load module the browser buttons use (client prices are
//     advisory; a doctored payload can't buy a jacket for tee money).
//   • Free items ride along as $0 Stripe lines so ONE ShopWorks order carries
//     the whole cart (webhook 'samples-order' branch pushes it PAID).
//   • Shipping is always FREE (Erik decision); WA tax = DOR destination
//     lookup on the shipping address (lookup failure = visible 502, never a
//     guessed rate).
app.post('/api/samples/create-checkout-session', async (req, res) => {
  const chCfg = channelConfig('samples');
  const chLog = chCfg.logPrefix;
  try {
    const { customerData, samples, clientSubtotal } = req.body || {};
    if (!customerData || !customerData.email || !Array.isArray(samples) || !samples.length) {
      return res.status(400).json({ error: 'Missing required fields: customerData, samples' });
    }
    if (samples.length > 12) {
      return res.status(400).json({ error: 'Sample carts are limited to 12 items — call 253-922-5793 for a larger request.' });
    }
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // ── Authoritative server-side reprice (one sample per style) ─────────
    const seen = new Set();
    const priced = [];
    for (const s of samples) {
      const style = String((s && s.style) || '').trim().toUpperCase();
      const size = String((s && s.size) || '').trim();
      if (!style || !size) {
        return res.status(400).json({ error: 'Each sample needs a style and a size — nothing was charged.' });
      }
      if (seen.has(style)) {
        return res.status(400).json({ error: `Duplicate style in the cart: ${style} (one sample per style) — nothing was charged.` });
      }
      seen.add(style);

      const spr = await fetch(`${TDT_PROXY}/api/size-pricing?styleNumber=${encodeURIComponent(style)}`);
      const rows = spr.ok ? await spr.json() : null;
      let result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: null, size });
      if (!result.eligible && result.reason === 'no_margin') {
        const br = await fetch(`${TDT_PROXY}/api/pricing-bundle?method=BLANK&styleNumber=${encodeURIComponent(style)}`);
        const bundle = br.ok ? await br.json() : null;
        result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: bundle, size });
      }
      if (!result.eligible) {
        console.warn(`${chLog} ${style} not sample-eligible (${result.reason})`);
        return res.status(400).json({
          error: result.reason === 'bad_size'
            ? `${style} isn’t offered in size ${size} — remove it and try again. Nothing was charged.`
            : `${style} isn’t available as an online sample right now — remove it and try again, or call 253-922-5793. Nothing was charged.`
        });
      }
      priced.push({
        style,
        size,
        name: String(s.name || style).slice(0, 120),
        color: String(s.color || '').slice(0, 60),
        catalogColor: String(s.catalogColor || s.color || '').slice(0, 60),
        type: result.type,
        price: result.price
      });
    }

    const paidSubtotal = Math.round(priced.reduce((sum, p) => sum + (p.type === 'paid' ? p.price : 0), 0) * 100) / 100;
    if (paidSubtotal <= 0) {
      // Belt and braces — the page routes all-free carts to the request form.
      return res.status(400).json({ error: 'Every sample in this cart is FREE — submit the request form instead (no payment needed).', code: 'FREE_ONLY' });
    }

    // WA destination tax on the SHIPPING address (samples always ship — the
    // form has no pickup mode). Shipping is free, so taxable = paid subtotal.
    let tax;
    try {
      tax = await resolveTdtTax({
        deliveryMethod: 'ship',
        state: customerData.shipping_state,
        city: customerData.shipping_city,
        zip: customerData.shipping_zip,
        address1: customerData.shipping_address1
      });
    } catch (e) {
      console.error(`${chLog} Tax lookup failed:`, e.message);
      return res.status(502).json({ error: 'Sales-tax lookup is unavailable right now — nothing was charged. Please try again or call 253-922-5793.' });
    }
    const salesTax = Math.round(paidSubtotal * tax.rate * 100) / 100;
    const grandTotal = Math.round((paidSubtotal + salesTax) * 100) / 100;

    // Client comparison is PRE-TAX (the page never knows the DOR rate — tax
    // renders as its own line on the Stripe page). Same 1¢ tolerance as the
    // shared route's grand-total gate.
    const client = parseFloat(clientSubtotal);
    if (!Number.isFinite(client) || Math.abs(client - paidSubtotal) > 0.01) {
      console.error(`${chLog} PRICE MISMATCH client=$${client} server=$${paidSubtotal} (pre-tax)`);
      return res.status(409).json({
        error: `Pricing changed while you were browsing (your screen: $${Number.isFinite(client) ? client.toFixed(2) : client} · current: $${paidSubtotal.toFixed(2)} before tax). Refresh the page to reload live pricing — nothing was charged.`
      });
    }

    // ── Unique SAM QuoteID (same collision-retry loop as the shared route;
    // refresh=true is LOAD-BEARING — see the shared route's comment) ──────
    let quoteID = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = chCfg.buildQuoteId();
      try {
        const check = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(candidate)}&refresh=true`, { headers: withProxySecret() });
        const rowsQ = check.ok ? await check.json() : [];
        const list = Array.isArray(rowsQ) ? rowsQ : (rowsQ?.data || []);
        if (!list.some((r) => r.QuoteID === candidate)) { quoteID = candidate; break; }
        console.warn(`${chLog} QuoteID collision, regenerating:`, candidate);
      } catch (e) {
        quoteID = candidate;
        break;
      }
    }
    if (!quoteID) {
      return res.status(500).json({ error: 'Could not allocate an order number — please try again.' });
    }

    const serverTotals = {
      totalQuantity: priced.length,
      subtotal: paidSubtotal,
      ltmFee: 0,
      shipping: 0,
      shippingSource: 'free-samples',
      salesTax,
      taxRate: tax.rate,
      taxableBase: paidSubtotal,
      taxAccount: tax.account,
      taxAccountName: tax.accountName,
      grandTotal
    };
    const settingsStamped = {
      channel: 'samples',
      samples: priced,   // SERVER-priced — the webhook push reads THESE
      creditNote: 'Sample cost credited toward first decorated order',
      stampedAt: new Date().toISOString()
    };

    console.log(`${chLog} Creating session for`, quoteID,
      `($${grandTotal.toFixed(2)}: ${priced.length} samples, ${priced.filter((p) => p.type === 'paid').length} paid, tax ${tax.rate})`);

    // Save to Caspio BEFORE Stripe (fail-closed: no save, no charge).
    // colorConfigs {} is deliberate (sample carts aren't color-config shaped);
    // quote_items rows come from orderSettings.samples via the samples branch
    // in buildStorefrontQuoteItems — without them /quote and /invoice render
    // "No items in this quote" (SAM0819-8320, 2026-08-19). The webhook push
    // still reads OrderSettingsJSON, not quote_items.
    try {
      await save3DTQuoteSession({
        quoteID,
        customerData,
        orderTotals: serverTotals,
        colorConfigs: {},
        orderSettings: settingsStamped,
        stripeSessionId: null
      });
      console.log(`${chLog} ✓ Order saved to Caspio:`, quoteID);
    } catch (error) {
      console.error(`${chLog} Failed to save to Caspio:`, error);
      return res.status(500).json({ error: 'Failed to save order data — nothing was charged. Please try again.' });
    }

    // ── Stripe line items from the SERVER reprice ─────────────────────────
    const cents = (v) => Math.round(v * 100);
    const line_items = priced.map((p) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: p.type === 'paid'
            ? `Sample — ${p.name} — ${p.color}, ${p.size}`
            : `FREE sample — ${p.name} — ${p.color}, ${p.size}`
        },
        unit_amount: cents(p.type === 'paid' ? p.price : 0)
      },
      quantity: 1
    }));
    if (salesTax > 0) {
      const pctLabel = String(Math.round(tax.rate * 10000) / 100);
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Sales tax (${pctLabel}%)` }, unit_amount: cents(salesTax) },
        quantity: 1
      });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;
    if (!secretKey) {
      console.error(`${chLog} Secret key not configured for mode:`, mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }
    const stripeInstance = stripe(secretKey);

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: customerData.email,
      // Single payable session per order + auto-expiry (double-charge
      // hardening, same as the quote-deposit flow's 2026-07-06 audit fix)
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${siteOrigin}${chCfg.stripeSuccessPath(quoteID)}`,
      cancel_url: `${siteOrigin}${chCfg.stripeCancelPath()}`,
      metadata: {
        quoteID,
        source: chCfg.stripeSource,
        kind: 'samples-order'   // webhook fulfillment branch selector
      }
    });
    console.log(`${chLog} Session created:`, session.id);

    // Stamp the Stripe session id onto the Caspio row (PK_ID-routed PUT; the
    // refresh=true read also un-poisons the pre-create [] lookup cache).
    try {
      const lookup = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`, { headers: withProxySecret() });
      const rowsL = lookup.ok ? await lookup.json() : [];
      const row = (Array.isArray(rowsL) ? rowsL : (rowsL?.data || [])).find((r) => r.QuoteID === quoteID);
      if (row && row.PK_ID) {
        await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
          method: 'PUT',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            SessionID: `stripe_${session.id}`,
            Notes: `${chCfg.orderNoteLabel()} | Stripe Session: ${session.id} | Status: Checkout Created`
          })
        });
      }
    } catch (error) {
      console.error(`${chLog} Failed to stamp Stripe session id (non-fatal):`, error);
    }

    res.json({ sessionId: session.id, quoteID, url: session.url });
  } catch (error) {
    console.error(`${chLog} Error creating session:`, error);
    res.status(500).json({ error: 'Failed to create checkout session — nothing was charged.', message: error.message });
  }
});

// POST /api/verify-checkout-session - Verify Stripe Checkout session after redirect
app.post('/api/verify-checkout-session', async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    if (!secretKey) {
      console.error('[Stripe Verify] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    const stripeInstance = stripe(secretKey);
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    console.log('[Stripe Verify] Verifying session:', sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items']
    });

    console.log('[Stripe Verify] Session status:', session.payment_status);

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      console.warn('[Stripe Verify] Payment not complete:', session.payment_status);
      return res.status(400).json({
        error: 'Payment not completed',
        status: session.payment_status,
        sessionId: sessionId
      });
    }

    // Return success with payment details
    res.json({
      success: true,
      paymentStatus: session.payment_status,
      sessionId: sessionId,
      paymentIntentId: session.payment_intent?.id || session.payment_intent,
      amountTotal: session.amount_total / 100, // Convert from cents to dollars
      currency: session.currency,
      customerEmail: session.customer_email,
      metadata: session.metadata,
      lineItems: session.line_items?.data || []
    });

  } catch (error) {
    console.error('[Stripe Verify] Error verifying session:', error);
    res.status(500).json({
      error: 'Failed to verify checkout session',
      message: error.message
    });
  }
});

// POST /api/submit-3day-order - Submit 3-Day Tees order to ShopWorks via ManageOrders PUSH API
app.post('/api/submit-3day-order', async (req, res) => {
  try {
    const {
      tempOrderNumber,
      customerData,
      colorConfigs,
      orderTotals,
      pricingData,
      orderSettings,
      paymentConfirmed,
      stripeSessionId,
      paymentAmount
    } = req.body;

    console.log('[3-Day Order] Received order submission:', {
      orderNumber: tempOrderNumber,
      paymentConfirmed,
      stripeSessionId
    });

    // Validate required fields
    if (!tempOrderNumber || !customerData || !colorConfigs) {
      return res.status(400).json({
        error: 'Missing required order data'
      });
    }

    // paymentConfirmed from an EXTERNAL caller must be proven against Stripe —
    // this endpoint is public (success-page fallback) and would otherwise let
    // anyone inject "paid" orders into ShopWorks. The webhook self-call skips
    // the round-trip (it already verified the Stripe signature) via the
    // process-internal header. (3DT rebuild review fix, 2026-06-09)
    if (paymentConfirmed && req.get('x-nwca-internal') !== INTERNAL_CALL_KEY) {
      try {
        const mode = process.env.STRIPE_MODE || 'development';
        const secretKey = mode === 'production'
          ? process.env.STRIPE_LIVE_SECRET_KEY
          : process.env.STRIPE_TEST_SECRET_KEY;
        const stripeInstance = stripe(secretKey);
        const s = await stripeInstance.checkout.sessions.retrieve(String(stripeSessionId || ''));
        if (!s || s.payment_status !== 'paid' || (s.metadata && s.metadata.quoteID && s.metadata.quoteID !== tempOrderNumber)) {
          return res.status(403).json({ success: false, error: 'Payment could not be verified with Stripe' });
        }
      } catch (e) {
        console.error('[3-Day Order] Stripe payment verification failed:', e.message);
        return res.status(403).json({ success: false, error: 'Payment could not be verified with Stripe' });
      }
    }

    // Channel registry: push constants + banners come from the entry for
    // orderSettings.channel (absent/unknown → legacy 3DT defaults).
    const pushCfg = channelConfig(orderSettings && orderSettings.channel);
    const pushC = pushCfg.push;

    // Build line items from colorConfigs
    // Structure: { catalogColor: { displayColor, sizeBreakdown: { size: { quantity, unitPrice } } } }
    // Style: Custom-Tees orders carry the SERVER-VALIDATED style in
    // orderSettings (stamped at checkout from the curated-catalog whitelist);
    // legacy 3DT orders fall through to PC54.
    const lineItems = [];
    const styleNumber = orderSettings?.styleNumber || pricingData?.styleNumber || pushC.fallbackStyleNumber;
    const productName = orderSettings?.styleName || pricingData?.productName || pushCfg.fallbackProductName;

    for (const [catalogColor, config] of Object.entries(colorConfigs)) {
      if (config.sizeBreakdown) {
        for (const [size, sizeData] of Object.entries(config.sizeBreakdown)) {
          if (sizeData && sizeData.quantity > 0) {
            lineItems.push({
              partNumber: styleNumber,
              description: productName,
              // CATALOG_COLOR keys ShopWorks/inventory — COLOR_NAME is display
              // only ("Dark Heather Grey" would not match SKU color
              // "Dk Hthr Grey"). Rule #2 in CLAUDE.md; review fix 2026-06-09.
              color: config.catalogColor || catalogColor,
              size: size,
              quantity: parseInt(sizeData.quantity),
              price: sizeData.unitPrice || 0
            });
          }
        }
      }
    }

    console.log('[3-Day Order] Built lineItems:', lineItems.length, 'items');

    // Add Less Than Minimum fee as a line item (if applicable).
    // partNumber stays 'LTM-75' (a stable ShopWorks SKU, via the channel
    // registry); the description reflects the ACTUAL fee from Caspio
    // Service_Codes 3DT-LTM.
    if (orderTotals?.ltmFee && orderTotals.ltmFee > 0) {
      lineItems.push({
        partNumber: pushC.ltmPartNumber,
        description: `Less Than Minimum $${Number(orderTotals.ltmFee).toFixed(2)}`,
        color: '',
        size: '',
        quantity: 1,
        price: orderTotals.ltmFee
      });
      console.log('[3-Day Order] Added LTM fee line item: $' + orderTotals.ltmFee);
    }

    // Extract unique product colors from the order for "For Product Colors" field
    const uniqueColors = [...new Set(
      Object.values(colorConfigs)
        .map(config => config.displayColor)
        .filter(Boolean)
    )];
    const productColorsString = uniqueColors.join(', ');

    console.log('[3-Day Order] Product colors for design:', productColorsString);

    // Extract artwork URLs and build designs block
    const designs = [];
    const frontLogo = orderSettings?.frontLogo?.fileUrl || orderSettings?.uploadedFiles?.front;
    const backLogo = orderSettings?.backLogo?.fileUrl || orderSettings?.uploadedFiles?.back;
    const printLocation = orderSettings?.printLocationCode || 'LC';

    // Side flags: CTS free-placement orders carry SERVER-VALIDATED
    // frontLocation ('LC'|'FF'|'JF'|null) + backLocation ('FB'|'JB'|null)
    // stamped at checkout; legacy 3DT only has printLocationCode. The old
    // `indexOf('_FB')` gating silently DROPPED back art for the new JB/back-
    // only codes — a paid Jumbo-Back print production never saw. (audit
    // CRITICAL fix 2026-06-10)
    const stampedFront = orderSettings?.frontLocation || null;
    const stampedBack = orderSettings?.backLocation || null;
    const frontCode = stampedFront || printLocation.split('_')[0];
    const hasFrontPrint = stampedFront ? true : !/^(FB|JB)$/.test(printLocation);
    const hasBackPrint = stampedBack ? true : /(^|_)(FB|JB)$/.test(printLocation);

    // Map location codes to exact ShopWorks dropdown values (channel
    // registry — caps will use different OnSite dropdown values).
    // ShopWorks accepts: 'Full Back', 'Full Front', 'Left Chest', 'Right Chest'
    // — jumbos map to the nearest dropdown value; the exact 16×20 dims ride in
    // the location notes + placement spec. (audit HIGH fix 2026-06-10)
    const SW_LOC = pushC.swLocationMap;
    const frontLocationName = SW_LOC[frontCode] || pushC.defaultFrontLocationName;
    const backLocationName = SW_LOC[stampedBack] || pushC.defaultBackLocationName;

    console.log('[3-Day Order] Artwork URLs:', { frontLogo, backLogo, printLocation, frontCode, stampedBack, frontLocationName, hasFrontPrint, hasBackPrint });

    if (frontLogo || backLogo) {
      const design = {
        name: `${tempOrderNumber} - Customer Logo`,  // "name" field expected by proxy transformDesigns
        externalId: `${pushC.designExternalIdPrefix}${tempOrderNumber}`,  // External ID for tracking
        productColor: productColorsString,  // T-shirt colors from order → "For Product Colors" field
        designTypeId: pushC.designTypeId,  // 45 = DTG (channel registry)
        artistId: pushC.artistId,          // 224 = 3-Day Tees routing
        locations: []
      };

      // Front location only when the order actually HAS a front print
      if (frontLogo && hasFrontPrint) {
        design.locations.push({
          location: frontLocationName,  // Exact ShopWorks dropdown value
          colors: pushC.designLocationColors,  // DTG = Full Color
          code: `${tempOrderNumber}-FRONT`,
          imageUrl: frontLogo,
          customField01: frontLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          // No ″ (U+2033): ManageOrders stores cp1252, anything outside it becomes "?"
          notes: 'Customer uploaded artwork' + (frontCode === 'JF' ? ' — JUMBO FRONT 16×20 in (see placement spec)' : ''),
          details: pushC.designDetails()
        });
      }

      // Back location ONLY when the charged order includes a back print —
      // a stray backLogo on a front-only-priced order must not print free.
      if (backLogo && hasBackPrint) {
        design.locations.push({
          location: backLocationName,
          colors: pushC.designLocationColors,  // DTG = Full Color
          code: `${tempOrderNumber}-BACK`,
          imageUrl: backLogo,
          customField01: backLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          notes: 'Customer uploaded artwork (back) - See Attachments tab for image' + (stampedBack === 'JB' ? ' — JUMBO BACK 16×20 in (see placement spec)' : ''),
          details: pushC.designDetails()
        });
      }

      // Only add design if we have at least one location
      if (design.locations.length > 0) {
        designs.push(design);
      }
    }

    console.log('[3-Day Order] Built designs:', designs.length, 'design(s)');

    // Build attachments array for artwork files (OnSite may download from Attachments)
    const attachments = [];
    if (frontLogo) {
      attachments.push({
        mediaUrl: frontLogo,
        mediaName: `${tempOrderNumber} - Front Artwork`,
        linkNote: 'Customer uploaded artwork (front)'
      });
    }
    if (backLogo && hasBackPrint) {
      attachments.push({
        mediaUrl: backLogo,
        mediaName: `${tempOrderNumber} - Back Artwork`,
        linkNote: 'Customer uploaded artwork (back)'
      });
    }

    // Designer mockups (customer-approved composites) ride along so production
    // sees EXACTLY what the customer approved. Capped to keep payloads sane.
    (orderSettings?.mockups || []).slice(0, 8).forEach((m) => {
      if (m && m.url) {
        attachments.push({
          mediaUrl: m.url,
          mediaName: `${tempOrderNumber} - Approved mockup ${m.color || ''} ${m.view || ''}`.trim(),
          linkNote: 'Customer-approved designer mockup'
        });
      }
    });

    console.log('[3-Day Order] Built attachments:', attachments.length, 'attachment(s)');

    // Human-readable placement spec for the press operator (mirrors the
    // designer's inch-based, top-center-anchored placement contract).
    function placementLine(label, p) {
      if (!p) return null;
      const horiz = !p.xIn ? 'centered'
        : (p.xIn > 0 ? `${Math.abs(p.xIn).toFixed(2)}in right of center` : `${Math.abs(p.xIn).toFixed(2)}in left of center`);
      const dims = p.hIn ? `${p.wIn}w x ${p.hIn}h in` : `${p.wIn}in wide`;
      const dpi = p.effectiveDpi ? `, ${p.effectiveDpi} DPI${p.lowDpiAck ? ' (CUSTOMER ACCEPTED LOW-RES)' : ''}` : '';
      const proof = p.previewable === false ? ' — FILE NOT PREVIEWABLE, MATCH PLACEMENT + SEND PROOF' : '';
      const warns = Array.isArray(p.warnings) && p.warnings.length
        ? ` WARNINGS: ${p.warnings.join(', ')}.` : '';
      return `${label}: art ${dims}, ${horiz}, ${Number(p.yIn).toFixed(2)}in below print-area top${dpi}. Print from ${p.fileName || 'uploaded file'}.${proof}${warns}`;
    }
    const placement = orderSettings?.placement || {};
    const placementLines = [
      hasFrontPrint ? placementLine(`FRONT - ${frontLocationName}${frontCode === 'JF' ? ' (JUMBO 16×20)' : ''}`, placement.front) : null,
      hasBackPrint ? placementLine(`BACK - ${backLocationName}${stampedBack === 'JB' ? ' (JUMBO 16×20)' : ''}`, placement.back) : null,
    ].filter(Boolean);
    const placementBlock = placementLines.length
      ? `\nPRINT PLACEMENT (customer's designer preview, top-center anchor — ADVISORY: place at the STANDARD print location for the garment; use the spec below only when it clearly deviates on purpose):\n${placementLines.join('\n')}\n`
      : '';
    const artReviewBanner = orderSettings?.needsArtReview
      ? `\n*** ART NEEDS HUMAN PROOF BEFORE PRINTING — see placement spec; ${pushC.artReviewClock(!!orderSettings?.rush)} starts at proof approval ***\n`
      : '';
    // Legal record on the production order: the customer attested artwork
    // rights at checkout (storefront orders only). (2026-06-10)
    const rightsLine = orderSettings?.rightsAck && orderSettings.rightsAck.checked
      ? `\nCUSTOMER ATTESTED ARTWORK RIGHTS at checkout${orderSettings.rightsAck.ts ? ` (${orderSettings.rightsAck.ts})` : ''}.\n`
      : '';
    // Stock gate fail-open marker (2026-06-10): the checkout-time inventory
    // check couldn't run (feed error/timeout), so garments were NOT verified.
    // Only channels with a stock gate (registry stockBanner) emit this.
    const stockLine = pushC.stockBanner && orderSettings?.stockChecked === false
      ? '\n*** STOCK NOT VERIFIED AT CHECKOUT (inventory feed was down) — confirm garment availability before production ***\n'
      : '';
    const shipPromiseLine = orderSettings?.shipPromise?.label
      ? `\nPROMISED SHIP DATE: ${orderSettings.shipPromise.label} (stamped at checkout)\n`
      : '';

    // Tax labeling — rate comes from the order (DOR destination lookup),
    // never assume Milton 10.2 (legacy bug mislabeled out-of-town orders).
    const taxRateNum = Number(orderTotals?.taxRate);
    const taxPct = Number.isFinite(taxRateNum) && taxRateNum > 0
      ? String(Math.round(taxRateNum * 10000) / 100) : null;
    const taxPartNumber = pushC.taxPartNumber(taxPct);
    const taxPartDescription = taxPct
      ? `${orderTotals?.taxAccountName || 'WA Sales Tax'} ${taxPct}%${orderTotals?.taxAccount ? ` (acct ${orderTotals.taxAccount})` : ''}`
      : 'No sales tax (out of state)';

    // Transform to ManageOrders API format
    const manageOrdersPayload = {
      orderNumber: tempOrderNumber,
      customerPurchaseOrder: tempOrderNumber,  // Set PO Number to Order ID
      customer: {
        company: customerData.company || '',  // Maps to CompanyName in proxy
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        email: customerData.email || '',
        phone: customerData.phone || ''
      },
      lineItems: lineItems,
      designs: designs,  // Artwork URLs for production
      attachments: attachments,  // File attachments for OnSite download
      shipping: {
        company: customerData.company || '',
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        address1: customerData.address1 || customerData.address || '',
        address2: customerData.address2 || '',
        city: customerData.city || '',
        state: customerData.state || '',
        zip: customerData.zip || customerData.zipCode || '',
        country: 'USA',
        method: customerData.deliveryMethod === 'pickup' ? 'Customer Pickup' : 'UPS Ground'
      },
      // Billing block - proxy reads from orderData.billing (not Customer)
      billing: {
        company: customerData.billingCompany || customerData.company || '',
        address1: customerData.billingAddress1 || customerData.address1 || '',
        address2: '',
        city: customerData.billingCity || customerData.city || '',
        state: customerData.billingState || customerData.state || '',
        zip: customerData.billingZip || customerData.zip || '',
        country: 'USA'
      },
      // Additional notes - send as array for proxy to process.
      // Service banner is channel/rush-aware (2026-06-10, registry): legacy
      // 3DT is always rush; Custom-Tees standard orders are 7-10 business
      // days — a hardcoded RUSH banner here would make production rush them.
      notes: [{
        type: 'Notes On Order',
        note: `${pushC.serviceBanner(!!orderSettings?.rush)}
${customerData.deliveryMethod === 'pickup' ? '\n*** CUSTOMER PICKUP - Milton, WA ***\n' : ''}${artReviewBanner}${stockLine}${rightsLine}${shipPromiseLine}${placementBlock}
Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
Delivery: ${customerData.deliveryMethod === 'pickup' ? 'Customer Pickup - NW Custom Apparel, Milton, WA 98354' : 'Ship to: ' + (customerData.address1 || '') + ', ' + (customerData.city || '') + ', ' + (customerData.state || '') + ' ' + (customerData.zip || '')}
Bill To: ${customerData.billingAddress1 || customerData.address1 || ''}, ${customerData.billingCity || customerData.city || ''}, ${customerData.billingState || customerData.state || ''} ${customerData.billingZip || customerData.zip || ''}
Special Instructions: ${customerData.notes || 'None'}

Payment Information:
Stripe Session: ${stripeSessionId || 'N/A'}
Payment Amount: $${paymentAmount ? (paymentAmount / 100).toFixed(2) : orderTotals?.grandTotal || 0}
Payment Status: ${paymentConfirmed ? 'succeeded' : 'pending'}

Total: $${orderTotals?.grandTotal || 0}${taxPct ? ` (includes ${taxPct}% sales tax${customerData.deliveryMethod === 'pickup' ? ', Milton pickup' : ''})` : ' (no sales tax - out of state)'}
TAX: ${taxPct ? `APPLY ${taxPartDescription}` : 'DO NOT APPLY - out-of-state shipment'}`
      }],
      // OnSite ORDER type → production queue + GL account. Channel-set: caps
      // send 21 (Custom Embroidery / acct 4050). When a channel omits it (the
      // DTG tee channels), the field is ABSENT and the proxy's push-client
      // defaults to 6 (Online Store / acct 4003) — byte-identical to the
      // pre-2026-06-12 storefront payload, so this is a caps-only change. The
      // proxy reads root-level `idOrderType` (same as the Order Form push).
      ...(pushC.idOrderType ? { idOrderType: pushC.idOrderType } : {}),
      // Order date = the PACIFIC day. Left absent, the proxy defaults to the
      // UTC day, which stamps evening orders (after ~5pm PT) with TOMORROW's
      // date in ShopWorks — DTG0831-2727 paid Sun 8/30 7:38pm PT showed
      // date_OrderPlaced 08/31. (2026-09-01)
      orderDate: nowPacificNaiveIso().split('T')[0],
      // Binding promised ship date (stamped at checkout, shipPromise.iso) →
      // ShopWorks date_OrderRequestedToShip, so production sees a real date
      // field instead of only the PROMISED SHIP DATE note line. (2026-09-01)
      ...(orderSettings?.shipPromise?.iso ? { requestedShipDate: orderSettings.shipPromise.iso } : {}),
      // Channel-aware (registry): Custom-Tees standard orders are NOT rush
      // (legacy 3DT always is)
      rushOrder: pushC.rushOrderFlag(orderSettings),
      printLocation: orderSettings?.printLocationName || 'Left Chest',
      // Tax fields - proxy expects at root level (not nested in totals).
      // 3DT pushes REAL tax (unlike Order Form's TaxTotal=0) — rate + account
      // come from the order's DOR destination lookup, not a Milton constant.
      taxTotal: orderTotals?.salesTax || 0,
      taxPartNumber: taxPartNumber,
      taxPartDescription: taxPartDescription,
      // Shipping - proxy expects at root level
      cur_Shipping: orderTotals?.shipping || 0,
      totals: {
        subtotal: orderTotals?.subtotal || 0,
        rushFee: orderTotals?.rushFee || 0,
        salesTax: orderTotals?.salesTax || 0,
        shipping: orderTotals?.shipping || 0,
        grandTotal: orderTotals?.grandTotal || 0
      },
      // Payment information from Stripe
      payments: paymentConfirmed ? [{
        // PACIFIC day (YYYY-MM-DD) — UTC day dated evening payments +1 in
        // ShopWorks (same off-by-one as orderDate above). (2026-09-01)
        date: nowPacificNaiveIso().split('T')[0],
        amount: parseFloat((paymentAmount ? paymentAmount / 100 : orderTotals?.grandTotal || 0).toFixed(2)),  // Round to 2 decimals
        status: 'success',
        gateway: 'Stripe',
        authCode: stripeSessionId || '',
        accountNumber: String(stripeSessionId || ''),  // Ensure string type for full session ID
        cardCompany: 'Stripe Checkout',
        responseCode: 'approved',
        responseReasonCode: 'checkout_complete',
        responseReasonText: 'Payment completed via Stripe Checkout'
      }] : []
    };

    console.log('[3-Day Order] Submitting to ManageOrders:', JSON.stringify(manageOrdersPayload, null, 2));

    // Forward to ManageOrders PUSH API on caspio-pricing-proxy
    const MANAGEORDERS_API = `${CASPIO_PROXY_BASE}/api/manageorders/orders/create`;

    const response = await fetch(MANAGEORDERS_API, {
      method: 'POST',
      // Secret required since proxy v2026.08.05.9 gated this route.
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-API-Secret': CRM_API_SECRET
      },
      body: JSON.stringify(manageOrdersPayload)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('[3-Day Order] ✓ Order created in ShopWorks:', result.orderNumber || tempOrderNumber);
      res.json({
        success: true,
        orderNumber: result.orderNumber || tempOrderNumber,
        shopWorksId: result.shopWorksId,
        message: 'Order submitted to ShopWorks successfully'
      });
    } else {
      console.error('[3-Day Order] ShopWorks API error:', result);
      // Return partial success - payment was taken, order needs manual processing
      res.json({
        success: false,
        orderNumber: tempOrderNumber,
        error: result.error || 'ShopWorks submission failed',
        message: 'Payment successful but order requires manual processing. Reference: ' + tempOrderNumber
      });
    }

  } catch (error) {
    console.error('[3-Day Order] Error submitting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit order to ShopWorks',
      message: error.message
    });
  }
});

};
