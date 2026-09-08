// routes/quote-lifecycle.js — Quote sync health, tracking, change log and customer deposits
// Extracted VERBATIM from server.js lines 5833-6402 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CASPIO_PROXY_BASE, PUBLIC_SITE_ORIGIN, QUOTE_TOTALS_HASH_VERSION, QuoteDepositMath, alertQuotePay, autoEnablePickupDeposit, computeQuoteSyncHealth, computeQuoteTotalsHash, fetch, fetchQuoteSessionRow, getDepositPct, makeApiRequest, notifyQuoteSyncHealth, nowPacificNaiveIso, parseNotesJson, quoteShareUrl, requireStaff, requireStaffOrSync, sanitizeFilterInput, sendQuoteAcceptedEmails, shareTokenOk, strictLimiter, stripe, totalsHashMatches, withProxySecret } = ctx;

// ============================================================================
// QUOTE-SYNC FRESHNESS WATCHDOG (2026-06-15)
//
// Catches the failure class that hid the ManageOrders sync-back outage for
// weeks: the hourly cron FIRED but its work no-op'd (the localhost self-call
// was 302'd to https://localhost → ECONNREFUSED → synced:0/errors:N every run,
// exit 0, no alarm). Mirrors the proxy's supacolor-health watchdog: an
// in-process record of the last bulk-sync run + a health endpoint the proxy's
// `check-quote-sync-health.js` Heroku Scheduler cron polls; on unhealthy it
// fires a deduped Slack alert.
//
// In-process state (resets to coldStart on dyno cycle, like supacolor). The
// hourly bulk-sync repopulates it within the hour.


/**
 * GET  /api/quote-sync-health        — read-only health snapshot
 * POST /api/quote-sync-health/alert  — same, plus fires a deduped Slack alert
 *                                      when unhealthy (the cron hits this one)
 *
 * Top-level path (not under /api/quote-sessions/) to avoid colliding with the
 * /api/quote-sessions/:quoteId/* routes.
 */
app.get('/api/quote-sync-health', (req, res) => {
  res.json({ success: true, ...computeQuoteSyncHealth() });
});

app.post('/api/quote-sync-health/alert', requireStaffOrSync, async (req, res) => {
  const health = computeQuoteSyncHealth();
  let notify = { sent: false, skipped: 'healthy' };
  if (!health.ok) {
    notify = await notifyQuoteSyncHealth(health).catch(err => ({ sent: false, error: err.message }));
  }
  res.json({ success: true, ...health, notify });
});

/**
 * POST /api/quote-sessions/bulk-sync-shipstation-tracking
 *
 * Fallback safety net — called hourly by the proxy's
 * sync-shipstation-tracking.js cron. The primary tracking-write path is the
 * SHIP_NOTIFY webhook (proxy → /api/quote-sessions/:id/shipstation-tracking).
 * This catches the case where the webhook failed to deliver.
 *
 * Algorithm:
 *   1. Pull quote_sessions WHERE ShipStation_Order_ID IS NOT NULL AND
 *      ShipStation_Status != 'shipped' (in SS, not yet labeled per our state)
 *   2. For each: GET proxy /api/shipstation/shipments?orderId={ssId}
 *   3. If a non-voided shipment exists with tracking# → write to Caspio via
 *      the same /shipstation-tracking endpoint the webhook uses
 *   4. Throttle 1s between requests (ShipStation rate-limits at ~40/min)
 *   5. Returns aggregate stats
 *
 * Body: { daysBack?, dryRun? }
 */
app.post('/api/quote-sessions/bulk-sync-shipstation-tracking', requireStaffOrSync, async (req, res) => {
  const startedAt = Date.now();
  try {
    const daysBack = Math.min(Math.max(Number(req.body?.daysBack) || 30, 1), 90);
    const dryRun = req.body?.dryRun === true || req.query?.dryRun === '1';

    // 1. Pull candidates from Caspio via the named `shipstationPending` filter
    // (ShipStation_Order_ID is a Number column, so the server-side predicate uses
    // > 0 to mean "set"). This previously sent q.where, which the proxy silently
    // ignored — see the note on bulk-sync-from-shopworks above.
    let sessions;
    try {
      sessions = await makeApiRequest('/quote_sessions?shipstationPending=true');
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Caspio fetch failed', details: e.message });
    }
    if (!Array.isArray(sessions)) sessions = [];

    // Filter to last N days (don't poll ancient orders forever).
    // Also defensive client-side check on ShipStation_Order_ID and status —
    // Caspio's WHERE with `> 0 AND ... <> 'shipped'` doesn't always exclude
    // null cleanly via the proxy path. Belt-and-suspenders here.
    const sinceMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const candidates = sessions.filter(s => {
      if (!(Number(s.ShipStation_Order_ID) > 0)) return false;
      if (s.ShipStation_Status === 'shipped') return false;
      const created = s.CreatedAt_Quote || s.CreatedAt;
      if (!created) return true;
      const t = Date.parse(created);
      return !Number.isFinite(t) || t >= sinceMs;
    });

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 20).map(s => ({
          quoteId: s.QuoteID,
          shipstationOrderId: s.ShipStation_Order_ID,
          customer: s.CustomerName,
          status: s.ShipStation_Status,
        })),
      });
    }

    // 2-3. For each candidate, ask proxy for shipments. If shipped, write.
    const SYNC_PROXY_BASE_LOCAL = CASPIO_PROXY_BASE;
    const stats = { checked: 0, newlyShipped: 0, stillPending: 0, voided: 0, errors: 0, errorDetails: [] };

    for (const s of candidates) {
      stats.checked++;
      try {
        const shipmentsUrl = `${SYNC_PROXY_BASE_LOCAL}/api/shipstation/shipments?orderId=${encodeURIComponent(s.ShipStation_Order_ID)}`;
        const r = await fetch(shipmentsUrl, { headers: withProxySecret() });
        if (!r.ok) throw new Error(`proxy returned ${r.status}`);
        const data = await r.json();
        const shipments = (data?.shipments || []).filter(ship => !ship.voided);
        const voidedAll = (data?.shipments || []).length > 0 && shipments.length === 0;
        if (voidedAll) {
          stats.voided++;
          continue;
        }
        const ship = shipments[0];
        if (!ship || !ship.trackingNumber) {
          stats.stillPending++;
          continue;
        }
        // Reuse the webhook's write path so the field-mapping logic is in one place.
        const writeUrl = `http://localhost:${process.env.PORT || 3000}/api/quote-sessions/${encodeURIComponent(s.QuoteID)}/shipstation-tracking`;
        const trackingUrl = (function () {
          // Mirror the proxy's buildTrackingUrl — keep them in sync if you add carriers.
          const map = {
            ups:        `https://www.ups.com/track?tracknum=${encodeURIComponent(ship.trackingNumber)}`,
            stamps_com: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(ship.trackingNumber)}`,
            usps:       `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(ship.trackingNumber)}`,
            fedex:      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(ship.trackingNumber)}`,
          };
          return map[String(ship.carrierCode || '').toLowerCase()] || '';
        })();
        const wr = await fetch(writeUrl, {
          method: 'POST',
          // See sync-from-shopworks self-call above — internal loopback call,
          // x-forwarded-proto keeps the force-HTTPS middleware from 302-ing it
          // to https://localhost (→ ECONNREFUSED). 2026-06-15
          headers: withProxySecret({ 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' }),
          body: JSON.stringify({
            trackingNumber:   ship.trackingNumber,
            trackingCarrier:  ship.carrierCode,
            trackingUrl,
            shippedAt:        ship.shipDate || new Date().toISOString(),
            labelCost:        ship.shipmentCost,
            shipstationOrderId: s.ShipStation_Order_ID,
            shipstationStatus: 'shipped',
          }),
        });
        if (!wr.ok) throw new Error(`tracking write returned ${wr.status}`);
        stats.newlyShipped++;
        console.log(`[bulk-sync-ss-tracking] ${s.QuoteID} SS#${s.ShipStation_Order_ID} → ${ship.trackingNumber} (${ship.carrierCode}) — webhook had missed`);
      } catch (e) {
        stats.errors++;
        stats.errorDetails.push({ quoteId: s.QuoteID, error: e.message });
      }
      // Throttle — ShipStation rate-limits at ~40 req/min for /shipments.
      await new Promise(r => setTimeout(r, 1000));
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[bulk-sync-ss-tracking] checked=${stats.checked} newlyShipped=${stats.newlyShipped} still=${stats.stillPending} voided=${stats.voided} errors=${stats.errors} (${elapsedSec}s)`);
    res.json({ success: true, ...stats, elapsedSec, candidateCount: candidates.length });
  } catch (error) {
    console.error('[bulk-sync-ss-tracking] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Bulk SS tracking sync failed', details: error.message });
  }
});

/**
 * GET /api/quote-change-log/:quoteId
 * Returns up to N most-recent changes for a single quote (newest first).
 * Used by the "what changed" banner on /quote/:id (Phase 2).
 */
app.get('/api/quote-change-log/:quoteId', requireStaff, async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const sinceHours = Number(req.query.sinceHours);
    const qs = new URLSearchParams({
      quoteID: safeQuoteId,
      limit: String(limit),
    });
    if (Number.isFinite(sinceHours) && sinceHours > 0) {
      qs.set('hoursAgo', String(sinceHours));
    }
    const data = await makeApiRequest(`/quote_change_log?${qs.toString()}`);
    // Proxy returns { success, count, records } — pass through
    res.json(data);
  } catch (error) {
    console.error(`[change-log/${req.params.quoteId}] error:`, error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch change log', details: error.message });
  }
});

/**
 * GET /api/quote-change-log/recent?hours=24&salesRepEmail=...
 * Activity feed across ALL quotes for the dashboard (Phase 3).
 * Filterable by hoursAgo, salesRepEmail, severity, unacknowledged.
 */
app.get('/api/quote-change-log-recent', requireStaff, async (req, res) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 720);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const qs = new URLSearchParams({
      hoursAgo: String(hours),
      limit: String(limit),
    });
    if (req.query.salesRepEmail) qs.set('salesRepEmail', String(req.query.salesRepEmail));
    if (req.query.severity)      qs.set('severity', String(req.query.severity));
    if (req.query.unacknowledged === 'true') qs.set('unacknowledged', 'true');
    const data = await makeApiRequest(`/quote_change_log?${qs.toString()}`);
    res.json(data);
  } catch (error) {
    console.error('[change-log-recent] error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch activity feed', details: error.message });
  }
});

/**
 * PUT /api/quote-change-log/:id/acknowledge
 * Mark a single change record as seen by a user. Used by the change banner's
 * "mark as seen" button (Phase 2) and dashboard activity feed (Phase 3).
 */
app.put('/api/quote-change-log/:id/acknowledge', requireStaff, async (req, res) => {
  try {
    const pkId = parseInt(req.params.id, 10);
    if (!Number.isInteger(pkId) || pkId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid PK_ID' });
    }
    const acknowledgedBy = String(req.body?.acknowledgedBy || '').slice(0, 250);
    if (!acknowledgedBy) {
      return res.status(400).json({ success: false, error: 'acknowledgedBy required in body' });
    }
    await makeApiRequest(`/quote_change_log/${pkId}`, 'PUT', {
      Acknowledged_By: acknowledgedBy,
      Acknowledged_At: nowPacificNaiveIso(),
    });
    res.json({ success: true });
  } catch (error) {
    console.error(`[change-log/${req.params.id}/acknowledge] error:`, error.message);
    res.status(500).json({ success: false, error: 'Failed to acknowledge', details: error.message });
  }
});

// Public API - Accept quote
// strictLimiter + JSON-only (Storefront Checkout Phase 0, 2026-07-05): a
// cross-site form POST can't send application/json without a CORS preflight,
// so this blocks drive-by acceptances from hostile pages; accepting is a
// once-per-quote action, so 20/hr/IP is generous.
app.post('/api/public/quote/:quoteId/accept', strictLimiter, async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'JSON body required' });
    }
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const { name, email, deliveryMethod } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Delivery method (pickup skip-the-rep, 2026-07-06). Optional for backward
    // compatibility with cached pages that don't send it yet.
    if (deliveryMethod != null && deliveryMethod !== 'pickup' && deliveryMethod !== 'ship') {
      return res.status(400).json({ error: "deliveryMethod must be 'pickup' or 'ship'" });
    }

    // Fetch quote session
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Share-link token — ACCEPTING is a state change (and on a pickup quote it
    // auto-enables a pay link), so it needs the same gate as reading, not less.
    // 404 to match the read endpoints: an ID walk learns nothing either way.
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Check if quote is already accepted
    if (session.Status === 'Accepted') {
      return res.status(400).json({ error: 'Quote has already been accepted' });
    }

    // Check if quote is expired
    if (session.ExpiresAt) {
      const expiresAt = new Date(session.ExpiresAt);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Quote has expired' });
      }
    }

    // Update quote status
    // Note: AcceptedAt, AcceptedByName, AcceptedByEmail fields don't exist in Caspio
    // Store acceptance info in the existing Notes JSON field instead
    const now = new Date().toISOString();

    // Parse existing Notes JSON and add acceptance info. Use parseNotesJson
    // (not bare JSON.parse) so a plain-text Notes value — the EMB builder saves
    // customer production notes as raw text — is preserved under _legacyText
    // instead of being clobbered by the acceptance JSON. (audit fix 2026-07-06)
    let existingNotes = parseNotesJson(session.Notes);

    existingNotes.acceptedAt = now;
    existingNotes.acceptedByName = sanitizeFilterInput(name);
    existingNotes.acceptedByEmail = sanitizeFilterInput(email);
    if (deliveryMethod) existingNotes.acceptedDeliveryMethod = deliveryMethod;

    // Pickup skip-the-rep: $0 shipping + Milton DOR rate leave nothing for a
    // rep to confirm, so the payment link enables in the SAME write as the
    // acceptance — the customer can pay right now on this page. FAIL-SOFT:
    // any lookup error keeps plain acceptance (rep enables manually, as before).
    let autoDeposit = null;
    if (deliveryMethod === 'pickup'
        && !(Array.isArray(existingNotes.payments) && existingNotes.payments.some((p) => p && p.kind === 'deposit'))) {
      try {
        autoDeposit = await autoEnablePickupDeposit(safeQuoteId, session, existingNotes);
        console.log(`[QuoteAccept] ${safeQuoteId} pickup auto-enable: $${autoDeposit.depositAmount.toFixed(2)} of $${autoDeposit.grandTotal.toFixed(2)}`);
      } catch (autoErr) {
        console.warn(`[QuoteAccept] ${safeQuoteId} pickup auto-enable failed (non-fatal):`, autoErr.message);
        alertQuotePay(`${safeQuoteId}: customer accepted as PICKUP but the payment link could not auto-enable (${autoErr.message}) — enable it manually from the quote page.`);
      }
    }

    const updateData = {
      Status: 'Accepted',
      Notes: JSON.stringify(existingNotes)
    };
    // Dedicated Caspio columns (AcceptedAt/AcceptedByName/AcceptedByEmail) are written
    // ONLY when QUOTE_ACCEPT_FIELDS_LIVE=1 — Erik sets that env var AFTER creating the
    // fields in Caspio. Writing unknown fields would 400 the whole PUT, so this stays
    // off by default; Notes JSON always carries the data regardless.
    if (process.env.QUOTE_ACCEPT_FIELDS_LIVE === '1') {
      updateData.AcceptedAt = now;
      updateData.AcceptedByName = sanitizeFilterInput(name);
      updateData.AcceptedByEmail = sanitizeFilterInput(email);
    }

    await makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', updateData);

    console.log(`[QUOTE] Quote ${safeQuoteId} accepted by ${name} (${email})`);

    // Fire acceptance emails (customer receipt + rep alert) — fully fail-soft and
    // fire-and-forget so the customer's confirmation isn't delayed by EmailJS.
    try { sendQuoteAcceptedEmails(session, name, email); } catch (e) { console.error('[QuoteAccept] email dispatch error:', e.message); }

    res.json({
      success: true,
      message: 'Quote accepted successfully',
      quoteId: safeQuoteId,
      acceptedAt: now,
      acceptedBy: { name, email },
      deliveryMethod: deliveryMethod || null,
      // Present ONLY when pickup auto-enable succeeded — the page renders the
      // pay button immediately from this block (no reload, no cache lag).
      deposit: autoDeposit,
    });

  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// ── Online deposit payments (Storefront Checkout Phase 1, 2026-07-05) ────────
// Staff API — a rep ENABLES the deposit on an Accepted quote, supplying the
// rep-confirmed shipping $ + tax-rate % (WQ quotes save TaxAmount=0 by design;
// this is where "a rep confirms tax and shipping" becomes a recorded number).
// Deposit % comes from Service_Codes DEPOSIT-PCT — fail-closed, no hardcoded
// fallback (Erik's rule). The full terms + totals-hash land in Notes JSON.
app.post('/api/quotes/:quoteId/enable-deposit', requireStaff, async (req, res) => {
  try {
    const quoteId = String(req.params.quoteId || '').trim();
    const shipping = Number(req.body?.shipping);
    const taxRatePct = Number(req.body?.taxRatePct);
    if (!quoteId) return res.status(400).json({ error: 'quoteId required' });
    if (!Number.isFinite(shipping) || !Number.isFinite(taxRatePct)) {
      return res.status(400).json({ error: 'shipping and taxRatePct are required numbers' });
    }

    const row = await fetchQuoteSessionRow(quoteId);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    if (row.Status !== 'Accepted') {
      return res.status(409).json({ error: `Quote status is '${row.Status}' — the customer must accept the quote before a deposit is collected.` });
    }

    const notes = parseNotesJson(row.Notes);
    if (Array.isArray(notes.payments) && notes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'A deposit has already been paid on this quote.' });
    }

    // Deposit % — Caspio-driven, fail-closed (shared helper with pickup auto-enable).
    let depositPct;
    try {
      depositPct = await getDepositPct();
    } catch (e) {
      return res.status(502).json({ error: `Deposit % unavailable: ${e.message}. Add/activate Service_Codes row DEPOSIT-PCT (SellPrice = percent, e.g. 50) and retry.` });
    }

    let terms;
    try {
      terms = QuoteDepositMath.computeDepositTerms({
        subtotal: parseFloat(row.TotalAmount), shipping, taxRatePct, depositPct,
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const totalsHash = computeQuoteTotalsHash(quoteId, terms.subtotal, terms.grandTotal, terms.depositAmount);

    // RE-FETCH before writing (audit fix 2026-07-06): getDepositPct() above is a
    // network call, so a payment webhook could have written payments[] since we
    // read `notes`. Re-read fresh, re-check the paid guard, and merge onto the
    // latest Notes so we never clobber a recorded payment.
    const fresh = await fetchQuoteSessionRow(quoteId);
    const freshNotes = parseNotesJson((fresh && fresh.Notes) || row.Notes);
    if (Array.isArray(freshNotes.payments) && freshNotes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'A deposit has already been paid on this quote.' });
    }
    freshNotes.deposit = Object.assign({}, terms, {
      enabled: true,
      totalsHash,
      hashVersion: QUOTE_TOTALS_HASH_VERSION,
      enabledAt: new Date().toISOString(),
      enabledBy: (req.session.crmUser && (req.session.crmUser.email || req.session.crmUser.Email || req.session.crmUser.name)) || 'staff',
    });
    await makeApiRequest(`/quote_sessions/${(fresh && fresh.PK_ID) || row.PK_ID}`, 'PUT', { Notes: JSON.stringify(freshNotes) });

    console.log(`[QuoteDeposit] ${quoteId} deposit enabled: $${terms.depositAmount.toFixed(2)} of $${terms.grandTotal.toFixed(2)} (${depositPct}%)`);
    res.json({
      success: true,
      quoteId,
      deposit: freshNotes.deposit,
      payUrl: quoteShareUrl(quoteId, freshNotes),
    });
  } catch (error) {
    console.error('[QuoteDeposit] enable failed:', error);
    res.status(500).json({ error: 'Failed to enable deposit' });
  }
});

// Public API — start Stripe HOSTED Checkout for a rep-enabled deposit. The
// amount comes ONLY from the server-stored deposit block (never the request),
// and the block is re-verified against the row's CURRENT TotalAmount so a
// quote edited after enablement can't be charged at stale numbers. PCI stays
// SAQ-A: hosted Checkout only, no card data touches this server.
app.post('/api/public/quote/:quoteId/deposit-checkout', strictLimiter, async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'JSON body required' });
    }
    const quoteId = String(req.params.quoteId || '').trim();
    if (!quoteId) return res.status(400).json({ error: 'quoteId required' });

    const row = await fetchQuoteSessionRow(quoteId);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    // Token gate — this one MINTS A STRIPE CHECKOUT SESSION. Anything that can
    // start a payment against a quote must prove it holds that quote's link.
    if (!shareTokenOk(req, row)) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const notes = parseNotesJson(row.Notes);
    const dep = notes.deposit;
    if (!dep || !dep.enabled) {
      return res.status(409).json({ error: 'Deposit is not set up on this quote yet — your rep will activate it.' });
    }
    if (row.Status !== 'Accepted') {
      return res.status(409).json({ error: 'The quote must be accepted before paying the deposit.' });
    }
    if (Array.isArray(notes.payments) && notes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'Deposit already paid — thank you!' });
    }
    // Re-verify stored terms against the CURRENT row (rep edits invalidate).
    if (!totalsHashMatches(
      dep, quoteId, QuoteDepositMath.r2(parseFloat(row.TotalAmount)), dep.grandTotal, dep.depositAmount
    )) {
      return res.status(409).json({ error: 'This quote changed after the deposit was set up. Ask your rep to re-enable the deposit.' });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;
    if (!secretKey) {
      console.error('[QuoteDeposit] Stripe secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Payments are not configured — please call (253) 922-5793.' });
    }
    const stripeInstance = stripe(secretKey);
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // Double-charge guard (audit fix 2026-07-06): expire the previous checkout
    // session before minting a new one, so at most ONE payable link exists per
    // quote at a time. Without this, a customer who hits Back and clicks Pay
    // again — or a colleague on the same shared quote link — could complete two
    // live sessions and be charged twice. Fail-soft: an expire error (already
    // completed/expired) must not block a legitimate new checkout.
    if (dep.lastSessionId) {
      try { await stripeInstance.checkout.sessions.expire(dep.lastSessionId); }
      catch (e) { console.warn('[QuoteDeposit] prior session expire failed (non-fatal):', e.message); }
    }

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      // Cap the payable window to 30 min so a stale abandoned tab can't be paid
      // hours later against terms that may have changed (Stripe min 30 min).
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_email: row.CustomerEmail || undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            // DEPOSIT-PCT=100 (Erik 2026-07-05) → pay-in-full wording; any
            // lower pct flips back to deposit wording with no deploy.
            name: Number(dep.depositPct) >= 100
              ? `Payment in full — Quote ${quoteId}`
              : `${dep.depositPct}% deposit — Quote ${quoteId}`,
            description: Number(dep.depositPct) >= 100
              ? `Northwest Custom Apparel — order total $${Number(dep.grandTotal).toFixed(2)} incl. tax & shipping`
              : `Northwest Custom Apparel — order total $${Number(dep.grandTotal).toFixed(2)} incl. tax & shipping; balance due after proof approval`,
          },
          unit_amount: Math.round(dep.depositAmount * 100),
        },
        quantity: 1,
      }],
      // Token must ride on the return URLs too — a customer coming back from
      // Stripe to a tokenised quote would otherwise land on a 404 immediately
      // after paying, which is the worst possible moment for it.
      success_url: `${quoteShareUrl(quoteId, row).replace(PUBLIC_SITE_ORIGIN, siteOrigin)}${quoteShareUrl(quoteId, row).includes('?') ? '&' : '?'}deposit=success`,
      cancel_url: `${quoteShareUrl(quoteId, row).replace(PUBLIC_SITE_ORIGIN, siteOrigin)}${quoteShareUrl(quoteId, row).includes('?') ? '&' : '?'}deposit=canceled`,
      metadata: { quoteID: quoteId, kind: 'deposit', totalsHash: dep.totalsHash, source: 'quote-deposit' },
    });

    // Stamp the session id for staff visibility (fail-soft — the webhook keys
    // off metadata, not this stamp). RE-FETCH before writing (audit fix
    // 2026-07-06): the `row` snapshot was read BEFORE the ~1s Stripe call, so a
    // payment webhook that landed during that call already wrote payments[] to
    // the row. Writing the stale snapshot would erase it. Re-read fresh and
    // only touch deposit.lastSessionId, preserving payments[] and everything else.
    try {
      const fresh = await fetchQuoteSessionRow(quoteId);
      const stamped = parseNotesJson((fresh && fresh.Notes) || row.Notes);
      stamped.deposit = Object.assign({}, stamped.deposit, {
        lastSessionId: session.id, lastSessionAt: new Date().toISOString(),
      });
      await makeApiRequest(`/quote_sessions/${(fresh && fresh.PK_ID) || row.PK_ID}`, 'PUT', { Notes: JSON.stringify(stamped) });
    } catch (e) {
      console.warn('[QuoteDeposit] session-id stamp failed (non-fatal):', e.message);
    }

    console.log('[QuoteDeposit] checkout session created for', quoteId, session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('[QuoteDeposit] checkout failed:', error);
    res.status(500).json({ error: 'Failed to start the deposit checkout' });
  }
});

};
