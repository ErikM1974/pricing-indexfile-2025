// routes/quote-sync.js — Quote and ShopWorks synchronization
// Extracted from server.js on 2026-09-07. ShipStation submission now delegates to tested lib/shipstation stages;
// registration order and the other handler bodies remain unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CASPIO_PROXY_BASE, CRM_API_SECRET, SOFT_DELETE_RETENTION_DAYS, SYNC_PROXY_BASE, buildOrderStatusUrl, channelConfigExact, escapeHTMLSrv, fetch, makeApiRequest, nowPacificNaiveIso, parseCaspioPacificMs, recordQuoteSyncRun, isStaffOrSync, requireStaff, requireStaffOrSync, sanitizeFilterInput, sendEmailJSTemplate, shareTokenOk, withProxySecret } = ctx;

// ============================================================================
// QUOTE ↔ SHOPWORKS SYNC ENDPOINTS (Erik 2026-05-21)
// ============================================================================
//
// After an OF-NNNN order is pushed to ManageOrders and ShopWorks pulls it (~2-3 hours
// later), ShopWorks becomes the source of truth — operators may edit the email,
// ship address, line items, status flags, etc. The quote-view page mirrors
// ShopWorks's current state by syncing these edits back into quote_sessions.
//
//   POST /api/quote-sessions/:quoteId/sync-from-shopworks
//     Pulls fresh state from MO snapshot endpoint + writes to Caspio.
//     If ShopWorks has deleted the order, HARD DELETES the quote_sessions row.
//     Used by the page's auto-sync (on stale) + manual Refresh button + the
//     hourly cron job.
//
//   GET /api/quote-sessions/:quoteId/full
//     Returns the quote_sessions row WITH the parsed ShopWorks_Snapshot embedded.
//     This is the page's primary data source — UI prefers ShopWorks_Snapshot
//     when present, falls back to the original submission (Notes JSON) when
//     not (pre-import).
//
// Sync is ONE-WAY only: ShopWorks → quote_sessions. We never write back to
// ManageOrders after the initial /create push.
// ============================================================================

const SYNC_SLACK_DELETE_WEBHOOK = process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL || '';

/**
 * Notify Slack (best-effort, fire-and-forget) when a quote_sessions row is
 * hard-deleted because ShopWorks no longer has the order. Lets AR/sales
 * notice if a real customer order disappears (vs. a test-order cleanup).
 */
function notifyQuoteDeleted(quoteId, shopWorksOrderNumber, customerName) {
  if (!SYNC_SLACK_DELETE_WEBHOOK) return;
  const payload = {
    text: `🗑️ Quote ${quoteId} hard-deleted — ShopWorks no longer has Order #${shopWorksOrderNumber || '?'} (${customerName || 'no customer'})`
  };
  fetch(SYNC_SLACK_DELETE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {/* silent */});
}

// ============================================================================
// Quote_Change_Log helpers (Erik 2026-05-22 — Phase 1 of SW edit audit trail)
// ----------------------------------------------------------------------------
// When sync-from-shopworks detects a delta between the old and new snapshot,
// it writes one row per changed field to Quote_Change_Log (via proxy). Phase 2
// (banner on quote-view) and Phase 3 (dashboard activity feed) read from this
// table to surface "what changed in SW since last view".
// ============================================================================


// WATCHED_ORDER_FIELDS / normalizeForDiff / sizeColsOf / diffSnapshots were
// extracted to a unit-testable module (2026-06-26) — server.js boots on require
// (app.listen), so the diff logic couldn't be imported into a jest test inline.
// The size-aware diff is locked by tests/unit/quote-snapshot-diff.test.js.
const { diffSnapshots } = require('../lib/quote-snapshot-diff');

/**
 * Write change records to Quote_Change_Log via the proxy. Fire-and-forget —
 * a logging failure must not block the snapshot write.
 */
async function logQuoteChanges(quoteId, changes, detectedBy, salesRepEmail, shopWorksOrderNumber) {
  if (!Array.isArray(changes) || changes.length === 0) return;
  const ts = nowPacificNaiveIso();
  const rows = changes.map(c => ({
    QuoteID: quoteId,
    ShopWorksOrderNumber: shopWorksOrderNumber || null,
    SalesRepEmail: salesRepEmail || null,
    ChangedAt: ts,
    ChangeType: c.type || 'other',
    FieldName: String(c.field || '').slice(0, 250),
    OldValue: c.oldValue == null ? '' : String(c.oldValue).slice(0, 64000),
    NewValue: c.newValue == null ? '' : String(c.newValue).slice(0, 64000),
    Severity: c.severity || 'info',
    DetectedBy: detectedBy || 'cron',
    Notes: c.notes || '',
  }));
  try {
    await makeApiRequest('/quote_change_log', 'POST', rows);
    console.log(`[change-log] wrote ${rows.length} change record(s) for ${quoteId}`);
  } catch (e) {
    console.warn(`[change-log] write failed for ${quoteId} (non-fatal):`, e.message);
  }
}

/**
 * POST /api/quote-sessions/:quoteId/sync-from-shopworks
 *
 * Triggers a fresh pull from ManageOrders for the given quote.
 * - If ShopWorks returns the order → updates the 4 ShopWorks_* columns
 * - If ShopWorks returns "not found" and we previously had status=Imported → HARD DELETE
 * - If ShopWorks returns "not found" and status was Pending → just updates Last_Synced
 *
 * Returns: { success, synced, deleted, status, shopWorksOrderNumber, snapshot }
 */
// Derive the ManageOrders ExtOrderID the way the PUSH created it, so the sync
// looks up the correct order. EMB/SCP/DTF builder pushes use a method-prefixed,
// year-safe ID built by caspio-pricing-proxy/config/manageorders-emb-config.js
// `buildExtOrderID` (EMB-2026-177 / SCP-2026-MMDD-seq / DTF-2026-MMDD-seq). The
// Order Form / DTG / legacy flow uses NWCA-{QuoteID}. The old code hardcoded
// NWCA-{QuoteID} for EVERY quote, so builder orders were looked up under an ID
// that never existed and never synced back from ShopWorks. Mirror the proxy's
// buildExtOrderID + getQuoteYear for the three builder prefixes; fall back to
// NWCA-{QuoteID} for everything else. KEEP IN SYNC with the proxy. (2026-06-01)
function deriveExtOrderIdForSync(quoteId, session) {
  const q = String(quoteId || '').trim();
  const lead = (q.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
  const PREFIX_MAP = { EMB: 'EMB', EMBC: 'EMB', CEMB: 'EMB', SP: 'SCP', SPC: 'SCP', SSC: 'SCP', DTF: 'DTF' };
  const outPrefix = PREFIX_MAP[lead];
  if (!outPrefix) return `NWCA-${q}`; // Order Form / DTG / legacy — unchanged
  let tail = q.replace(/^[A-Za-z]+-?/, '') || '0';
  if (!/^20\d\d(\D|$)/.test(tail)) {
    const raw = (session && (session.DateOrderPlaced || session.CreatedAt_Quote || session.CreatedAt)) || '';
    const ym = String(raw).match(/(20\d\d)/);
    tail = `${ym ? ym[1] : new Date().getFullYear()}-${tail}`;
  }
  return `${outPrefix}-${tail}`;
}

app.post('/api/quote-sessions/:quoteId/sync-from-shopworks', async (req, res) => {
  const startedAt = Date.now();
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // 1. Look up the quote_sessions row by QuoteID (need PK_ID for PUT/DELETE).
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'&q.orderBy=PK_ID DESC`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    // [A2] (audit 2026-06-06): among duplicate-QuoteID rows prefer the PUSHED row, else the newest (client-
    // sorted, robust if the filter= route strips q.orderBy) — the sync's PUT must target the same row push
    // stamped, not an oldest/unpushed duplicate (→ split-brain → a second ShopWorks order).
    const session = sessions.find(s => s.PushedToShopWorks)
      || [...sessions].sort((a, b) => (Number(b.PK_ID) || 0) - (Number(a.PK_ID) || 0))[0];
    // Customer links may refresh only their selected quote. Staff and scheduled jobs
    // may use the existing manual work-order repair path.
    const trusted = isStaffOrSync(req);
    if (!trusted && !shareTokenOk(req, session)) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    if (!trusted && req.body?.shopWorksOrderNumber) {
      return res.status(403).json({ success: false, error: 'Staff access required to change the work order' });
    }
    const pkId = session.PK_ID;
    const previousStatus = session.ShopWorks_Status || '';

    // 2. Determine how to find the ShopWorks order:
    //    (a) Body sends `shopWorksOrderNumber` (rep typed the WO# into the
    //        "Set ShopWorks Order #" input on /quote/:quoteId) — store it
    //        and use it directly to fetch /v1/orders/{N}, bypassing the
    //        broken /v1/getorderno mapping.
    //    (b) Else, if the row already has ShopWorks_Order_Number stored,
    //        use that.
    //    (c) Else fall through to the snapshot endpoint which tries
    //        /v1/getorderno (currently empty for our orders — known MO
    //        config gap; will work eventually).
    let manualOrderNumber = null;
    if (req.body && req.body.shopWorksOrderNumber) {
      const n = Number(req.body.shopWorksOrderNumber);
      if (Number.isInteger(n) && n > 0 && n < 10000000) {
        manualOrderNumber = n;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid shopWorksOrderNumber' });
      }
    } else if (Number.isFinite(Number(session.ShopWorks_Order_Number)) && Number(session.ShopWorks_Order_Number) > 0) {
      manualOrderNumber = Number(session.ShopWorks_Order_Number);
    }

    const extOrderId = deriveExtOrderIdForSync(safeQuoteId, session);

    // 3. Fetch snapshot via one of two paths:
    let snapshot;
    try {
      // Both paths go through the same proxy snapshot endpoint now (it
      // accepts a known id_Order via the ?orderNumber= query param to
      // bypass the /v1/getorderno mapping when we already have it).
      // The proxy snapshot endpoint also fetches /order-pull in parallel
      // to include Designs/Attachments/ShippingAddresses (pushed data).
      const snapshotUrl = manualOrderNumber
        ? `${SYNC_PROXY_BASE}/api/manageorders/order/${encodeURIComponent(extOrderId)}/snapshot?orderNumber=${manualOrderNumber}&refresh=true`
        : `${SYNC_PROXY_BASE}/api/manageorders/order/${encodeURIComponent(extOrderId)}/snapshot`;
      // The secret is REQUIRED here: proxy 191c906 (2026-08-10) put
      // /api/manageorders/order behind requireCrmApiSecret, and this was the one
      // proxy call in this file sending no credentials — so every sync 401'd →
      // 502 → errors==candidates, synced:0, hourly, for a week. The 502 return
      // below logs nothing, which is why `grep bulk-sync` showed only the
      // summary line. Log the failure so the next gate change is one grep away.
      const r = await fetch(snapshotUrl, {
        headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {},
      });
      if (!r.ok) {
        console.warn(`[sync-from-shopworks] ✗ ${safeQuoteId} — MO snapshot HTTP ${r.status} (${snapshotUrl.split('?')[0]})`);
        return res.status(502).json({ success: false, error: `MO snapshot fetch failed: HTTP ${r.status}` });
      }
      snapshot = await r.json();

      // If a manual WO# was given but /v1 still doesn't have it, persist
      // the WO# anyway so future cron + manual syncs can try again.
      if (manualOrderNumber && !snapshot.found && req.body?.shopWorksOrderNumber) {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
          ShopWorks_Order_Number: manualOrderNumber,
          ShopWorks_Status: 'Pending',
          ShopWorks_Last_Synced: nowPacificNaiveIso(),
        }).catch(() => {});
        return res.json({
          success: true, synced: true, deleted: false, status: 'Pending',
          shopWorksOrderNumber: manualOrderNumber,
          lastSynced: nowPacificNaiveIso(),
          reason: 'shopworks_order_not_in_mo_v1_yet',
          note: 'Order # saved. ManageOrders /v1 syncs from OnSite every 15 min between 7am-7pm Pacific. Refresh in a few minutes for live data.',
        });
      }
    } catch (e) {
      return res.status(502).json({ success: false, error: `MO snapshot fetch error: ${e.message}` });
    }

    // PACIFIC, not UTC (fixed 2026-08-17). ShopWorks_Last_Synced is READ back by
    // parseCaspioPacificMs (staleness + purge, below) and by CaspioDate.parse on the
    // dashboard — i.e. everything treats it as the naive Pacific wall-clock Caspio
    // stores everywhere else. Writing UTC made every fresh row parse ~7-8 h in the
    // FUTURE, so `now - lastSynced` went NEGATIVE and the 30-minute staleness test
    // could not fire: a just-synced quote was skipped for ~7.5 h instead of 30 min,
    // quietly turning the hourly re-sync into ~3x/day. That cadence is exactly what
    // detects ShopWorks-side deletions and fires the ShipStation cancel-cascade.
    // It also pushed the 30-day purge (and the dashboard's "Purges in N days") late.
    const nowIso = nowPacificNaiveIso();

    // 4. Branch: order found in ShopWorks vs. not.
    if (snapshot.found) {
      // 4a. UPDATE path — write the new ShopWorks-side state.

      // Phase 1 change-log diff (Erik 2026-05-22): compare new snapshot
      // against the previous one BEFORE overwrite. Each diff becomes one
      // row in Quote_Change_Log. Fire-and-forget — log write must not block
      // the snapshot update. Detected-by reflects how the sync was invoked:
      //   - body has shopWorksOrderNumber → manual entry by rep
      //   - else → page-load auto-sync OR hourly cron (we can't tell apart
      //     at this layer; cron caller can pass ?detectedBy=cron in future)
      let oldSnap = null;
      if (session.ShopWorks_Snapshot) {
        try { oldSnap = JSON.parse(session.ShopWorks_Snapshot); }
        catch (_) { /* malformed; treat as no prior snapshot */ }
      }
      const newSnap = {
        order: snapshot.order,
        lineItems: snapshot.lineItems,
        // Persist the /order-pull `pushed` block (Designs[] + Attachments +
        // ShippingAddresses). The quote-view Designs table reads
        // `snapshot.pushed.Designs[]` for each design's TYPE (id_DesignType,
        // e.g. 45→DTG) and per-location name (e.g. "Full Front"). Dropping it
        // here forced the page into its fallback branch, which renders
        // "Unknown" type + a hardcoded "Left Chest" location even when
        // ShopWorks clearly says Full Front / DTG (fixed 2026-06-15). The proxy
        // already trims `pushed` to those 3 arrays, so it stays small.
        pushed: snapshot.pushed || null,
        // Persist live MO /v1 tracking + payments too (Erik 2026-06-16). The proxy
        // snapshot endpoint fetches these on every pull, but they were dropped here —
        // so the quote-view outbound tracking block + Date Shipped (and the new
        // Shipped-tile "real shipment" gate) only ever saw empty arrays, even on a
        // genuinely shipped order. Persisting them lets cron-synced rows surface
        // outbound tracking/carrier/ship date, not just a live page re-fetch.
        // NOTE: unlike `pushed` (which the proxy trims to Designs/Attachments/
        // ShippingAddresses), tracking/payments come through UNTRIMMED — so cap them
        // defensively here to keep ShopWorks_Snapshot well under its Text(64000)
        // column limit regardless of how large an upstream multi-shipment payload is.
        tracking: Array.isArray(snapshot.tracking) ? snapshot.tracking.slice(0, 50) : (snapshot.tracking || null),
        payments: Array.isArray(snapshot.payments) ? snapshot.payments.slice(0, 50) : (snapshot.payments || null),
        fetchedAt: snapshot.fetchedAt,
      };
      const changes = diffSnapshots(oldSnap, newSnap);
      if (changes.length > 0) {
        const detectedBy = req.body?.shopWorksOrderNumber ? 'manual-refresh'
          : (req.query?.detectedBy || 'page-load-sync');
        logQuoteChanges(
          safeQuoteId,
          changes,
          detectedBy,
          session.SalesRepEmail || null,
          snapshot.id_Order || null,
        ).catch(() => {});
      }

      const update = {
        ShopWorks_Order_Number: snapshot.id_Order,
        ShopWorks_Status: 'Imported',
        ShopWorks_Last_Synced: nowIso,
        ShopWorks_Snapshot: JSON.stringify(newSnap),
      };
      try {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', update);
      } catch (e) {
        console.warn(`[sync-from-shopworks] Caspio PUT failed for ${safeQuoteId}:`, e.message);
        return res.status(500).json({ success: false, error: 'Caspio update failed', details: e.message });
      }

      const elapsed = Date.now() - startedAt;
      console.log(`[sync-from-shopworks] ✓ ${safeQuoteId} → SW#${snapshot.id_Order} (${elapsed}ms)`);
      return res.json({
        success: true,
        synced: true,
        deleted: false,
        status: 'Imported',
        shopWorksOrderNumber: snapshot.id_Order,
        lastSynced: nowIso,
        snapshot: {
          order: snapshot.order,
          lineItems: snapshot.lineItems,
          pushed: snapshot.pushed || null,   // see newSnap above — Designs/type/location for the quote-view
          tracking: snapshot.tracking || null,  // keep the manual-refresh response in lockstep with newSnap
          payments: snapshot.payments || null,
          fetchedAt: snapshot.fetchedAt,
        },
      });
    }

    // 4b. NOT FOUND in ShopWorks. Two sub-cases:
    //     - Previously Imported → ShopWorks operator deleted → SOFT DELETE
    //       (Status → 'Cancelled_in_ShopWorks', preserve row for 30-day audit
    //        retention; bulk-sync cron purges later)
    //     - Otherwise (Pending or never synced) → just bump Last_Synced
    if (previousStatus === 'Imported') {
      // SOFT DELETE. Order existed in SW and now doesn't — operator removed it.
      // Erik 2026-05-21: soft delete over hard delete chosen for audit trail.
      // The row stays visible (with a "Cancelled" banner) so AR/CSR can still
      // see the order if a customer calls back. After 30 days the row is
      // hard-purged by the bulk-sync cron.
      try {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
          Status: 'Cancelled_in_ShopWorks',
          ShopWorks_Status: 'Deleted',
          // ShopWorks_Last_Synced doubles as cancelled_at timestamp — it's
          // when we DETECTED the deletion (close enough to actual delete time
          // since the cron runs hourly).
          ShopWorks_Last_Synced: nowIso,
        });
        console.log(`[sync-from-shopworks] ⊘ SOFT DELETED ${safeQuoteId} (was SW#${session.ShopWorks_Order_Number || '?'}) — 30d retention`);
        notifyQuoteDeleted(safeQuoteId, session.ShopWorks_Order_Number, session.CustomerName);

        // Log to Quote_Change_Log (critical severity — order is GONE in SW)
        logQuoteChanges(safeQuoteId, [{
          field: 'Status',
          oldValue: 'Imported',
          newValue: 'Cancelled_in_ShopWorks',
          type: 'deleted',
          severity: 'critical',
          notes: 'Order removed from SW — soft-deleted with 30d audit retention',
        }], 'cron', session.SalesRepEmail || null, session.ShopWorks_Order_Number || null).catch(() => {});

        // SW → SS cascade (Erik 2026-05-22): when SW operator deletes the
        // order, also delete the matching ShipStation order so warehouse
        // doesn't pick/label a phantom shipment. SKIP if already shipped —
        // label is bought + paid, can't undo without explicit void action.
        // Fire-and-forget — cascade failure shouldn't block the SW-side
        // soft-delete (the quote_sessions row is already cancelled; a
        // stranded SS order is a smaller problem than a stuck cascade).
        if (session.ShipStation_Order_ID && session.ShipStation_Status !== 'shipped') {
          (async () => {
            try {
              const delUrl = `${SYNC_PROXY_BASE}/api/shipstation/orders/${encodeURIComponent(session.ShipStation_Order_ID)}?reason=${encodeURIComponent('SW order deleted (cascade)')}`;
              // #9: proxy shipstation writes are CRM-gated — send the server-side secret.
              const r = await fetch(delUrl, { method: 'DELETE', headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
              if (r.ok) {
                console.log(`[sync-from-shopworks] ⊘ SS-cascade: deleted ShipStation #${session.ShipStation_Order_ID} for ${safeQuoteId}`);
                // Also clear our local ShipStation columns so the dashboard
                // doesn't keep showing "In ShipStation #N" on a deleted order.
                await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
                  ShipStation_Status: 'cancelled',
                  ShipStation_Last_Synced: nowIso,
                }).catch(() => { /* non-fatal — row already in audit-retention state */ });
              } else {
                console.warn(`[sync-from-shopworks] SS-cascade DELETE failed: HTTP ${r.status}`);
              }
            } catch (e) {
              console.warn(`[sync-from-shopworks] SS-cascade error (non-fatal):`, e.message);
            }
          })();
        } else if (session.ShipStation_Order_ID && session.ShipStation_Status === 'shipped') {
          // Already shipped — can't undo. Just log so it shows up in oncall review.
          console.warn(`[sync-from-shopworks] ⚠ SW deleted ${safeQuoteId} but SS already shipped (#${session.ShipStation_Order_ID}, tracking=${session.TrackingNumber || '?'}). Manual customer contact needed.`);
        }

        return res.json({
          success: true,
          synced: true,
          deleted: true,        // semantically "cancelled" — front-end uses this to redirect
          softDeleted: true,    // distinguishes from hard-delete for callers that care
          status: 'Cancelled_in_ShopWorks',
          shopWorksOrderNumber: session.ShopWorks_Order_Number,
          lastSynced: nowIso,
        });
      } catch (e) {
        console.error(`[sync-from-shopworks] Soft-delete failed for ${safeQuoteId}:`, e.message);
        return res.status(500).json({ success: false, error: 'Soft-delete failed', details: e.message });
      }
    }

    // 4c. Still pending — just bump the timestamp so we don't re-poll constantly.
    try {
      await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
        ShopWorks_Status: previousStatus || 'Pending',
        ShopWorks_Last_Synced: nowIso,
      });
    } catch (e) {
      console.warn(`[sync-from-shopworks] pending-timestamp PUT failed for ${safeQuoteId}:`, e.message);
    }
    return res.json({
      success: true,
      synced: true,
      deleted: false,
      status: previousStatus || 'Pending',
      shopWorksOrderNumber: null,
      lastSynced: nowIso,
      reason: snapshot.reason || 'not_imported_yet',
    });

  } catch (error) {
    console.error('[sync-from-shopworks] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Sync failed', details: error.message });
  }
});

/**
 * GET /api/quote-sessions/:quoteId/full
 *
 * Returns the quote_sessions row with the ShopWorks_Snapshot parsed and
 * embedded. This is the primary data source for the quote-view page.
 *
 * Response shape (compact):
 *   {
 *     quoteId, status, ...flat columns,
 *     originalSubmission: { info, rows, ship, ... } | null,  // parsed Notes JSON
 *     shopWorks: {
 *       orderNumber, status, lastSynced,
 *       snapshot: { order, lineItems, fetchedAt }
 *     } | null
 *   }
 */
app.get('/api/quote-sessions/:quoteId/full', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Same share-link token gate as /api/public/quote/:id — this endpoint is
    // equally anonymous and returns MORE (the full Notes blob).
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Parse the original submission from Notes JSON (best-effort).
    let originalSubmission = null;
    if (session.Notes) {
      try { originalSubmission = JSON.parse(session.Notes); }
      catch { /* Notes may be plain text on legacy quotes — leave as null */ }
    }

    // Parse the ShopWorks snapshot if we have one.
    let shopWorks = null;
    if (session.ShopWorks_Snapshot) {
      try {
        const snapshot = JSON.parse(session.ShopWorks_Snapshot);
        // A1 backfill (Erik 2026-05-22): if the snapshot knows the WO# but
        // the indexed column is empty, persist it so the dashboard list view
        // (which only reads `ShopWorks_Order_Number`, not the snapshot JSON)
        // shows the # suffix on the "IN SHOPWORKS" badge. /v1/getorderno is
        // broken upstream → some quotes had the snapshot synced (via manual
        // WO# entry on /quote/:id) but the column was never written back. This
        // closes the gap opportunistically — next dashboard load catches up.
        const snapshotWo = Number(snapshot?.order?.id_Order) || 0;
        const columnWo   = Number(session.ShopWorks_Order_Number) || 0;
        if (snapshotWo > 0 && columnWo === 0) {
          makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', {
            ShopWorks_Order_Number: snapshotWo,
          }).catch(e => console.warn(`[quote/full] WO# backfill failed for ${safeQuoteId}:`, e.message));
        }
        shopWorks = {
          orderNumber: session.ShopWorks_Order_Number || snapshotWo || null,
          status: session.ShopWorks_Status,
          lastSynced: session.ShopWorks_Last_Synced,
          snapshot, // { order, lineItems, fetchedAt }
        };
      } catch (e) {
        console.warn(`[quote/full] ShopWorks_Snapshot parse failed for ${safeQuoteId}:`, e.message);
      }
    } else if (session.ShopWorks_Status || session.ShopWorks_Order_Number || session.ShopWorks_Last_Synced) {
      // No snapshot but other ShopWorks fields are populated (e.g. just
      // marked Pending without a successful sync yet).
      shopWorks = {
        orderNumber: session.ShopWorks_Order_Number || null,
        status: session.ShopWorks_Status || 'Pending',
        lastSynced: session.ShopWorks_Last_Synced || null,
        snapshot: null,
      };
    }

    // Also fetch quote_items so the UI can render the original line items
    // even when ShopWorks hasn't imported yet.
    let items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);
    if (Array.isArray(items)) {
      items = items.filter(it => it.QuoteID === safeQuoteId);
    } else {
      items = [];
    }

    // Billing contact — pull the customer's billing address from the
    // CompanyContactsMerge2026 table so the invoice / quote-view can display
    // a complete Bill-To block. The original submission only captures whatever
    // the rep typed at submit time (often partial: city/state only).
    //
    // Source priority for id_Customer:
    //   1. ShopWorks snapshot's order.id_Customer (most authoritative)
    //   2. originalSubmission.info.companyId (form-captured)
    let billingContact = null;
    const idCustomer =
      shopWorks?.snapshot?.order?.id_Customer ||
      originalSubmission?.info?.companyId ||
      null;
    if (idCustomer) {
      try {
        const PROXY_BASE = CASPIO_PROXY_BASE;
        const resp = await fetch(
          `${PROXY_BASE}/api/company-contacts/by-customer/${encodeURIComponent(idCustomer)}`,
          { method: 'GET', headers: withProxySecret() }
        );
        if (resp.ok) {
          const data = await resp.json();
          const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
          // Prefer contacts with a complete address; fall back to the most-recent.
          const complete = contacts.find(c => c.Has_Complete_Address && c.Address);
          const fallback = contacts.find(c => c.Address) || contacts[0];
          const chosen = complete || fallback;
          if (chosen) {
            billingContact = {
              companyName: chosen.Company_Name || chosen.CustomerCompanyName || null,
              address1:    chosen.Address || null,
              address2:    chosen.Address2 || null,
              city:        chosen.City || null,
              state:       chosen.State || null,
              zip:         chosen.Zip || null,
              phone:       chosen.Company_Phone || null,
              // Phone_Best — curated "best phone for this contact" maintained
              // in CompanyContactsMerge2026. Preferred when populated; reps
              // hand-pick the right number per contact in the Caspio admin.
              phoneBest:   chosen.Phone_Best || null,
              email:       chosen.Company_Email || null,
              contactName: chosen.ct_NameFull || [chosen.NameFirst, chosen.NameLast].filter(Boolean).join(' ') || null,
              // Audit fix H1 (2026-05-21): expose curated customer-record fields
              // so the form + invoice + quote-view can react.
              // - isTaxExempt: invoice shows "Tax Exempt (Cert #...)" instead of tax line
              // - customerWarning: form shows a yellow banner before submit
              // - paymentTerms: pre-populates the Payment Terms dropdown
              //                  (CustTerms is the historical pref; Payment_Terms
              //                   is the newer normalized value)
              // - accountTier: lets the form badge VIP customers
              isTaxExempt:     chosen.Is_Tax_Exempt === true || chosen.Is_Tax_Exempt === 1 || chosen.Is_Tax_Exempt === '1',
              taxExemptNumber: chosen.Tax_Exempt_Number || null,
              customerWarning: chosen.Customer_Warning || null,
              paymentTerms:    chosen.Preferred_Terms_FromOrders || chosen.Payment_Terms || chosen.CustTerms || null,
              accountTier:     chosen.Account_Tier || null,
              source:      'company-contacts-2026',
              idCustomer,
            };
          }
        }
      } catch (e) {
        // Best-effort fetch — don't fail the whole /full response if proxy is
        // momentarily unreachable. Front end will fall back to originalSubmission.
        console.warn(`[quote/full] billing-contact fetch failed for customer ${idCustomer}:`, e.message);
      }
    }

    // ShipStation state block — derived from the new Caspio columns added
    // for the ShipStation integration. Front-end uses this to decide:
    //   • show "Send to ShipStation" button (when shipStation === null)
    //   • show "✓ In ShipStation #N" badge (when status==='awaiting_shipment')
    //   • show "📦 Shipped — tracking #X" (when status==='shipped')
    //   • hide entirely (when ship.method === 'Customer Pickup')
    let shipStation = null;
    if (session.ShipStation_Order_ID || session.ShipStation_Status || session.TrackingNumber) {
      shipStation = {
        orderId:      session.ShipStation_Order_ID || null,
        status:       session.ShipStation_Status || null,
        lastSynced:   session.ShipStation_Last_Synced || null,
        trackingNumber: session.TrackingNumber || null,
        trackingCarrier: session.TrackingCarrier || null,
        trackingURL:    session.TrackingURL || null,
        shippedAt:    session.ShippedAt || null,
        labelCost:    session.LabelCost != null ? Number(session.LabelCost) : null,
      };
    }

    res.json({
      quoteId: session.QuoteID,
      status: session.Status,
      sessionRaw: session,                    // every flat column for power users
      originalSubmission,                     // parsed Notes JSON
      quoteItems: items,                      // pre-import line items
      shopWorks,                              // current ShopWorks-side state (when synced)
      billingContact,                         // Bill-To address from CompanyContactsMerge2026
      shipStation,                            // ShipStation state (when sent / shipped)
    });
  } catch (error) {
    console.error('[quote/full] error:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ── Inbound vendor-shipment helpers (mirror the proxy's, kept local) ──
function buildVendorTrackingUrl(carrier, trackingNumber) {
  if (!trackingNumber) return null;
  const c = String(carrier || '').toLowerCase();
  const t = encodeURIComponent(String(trackingNumber).trim());
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  if (c.includes('spee')) return `https://www.speedeedelivery.com/tools/track-shipment/?tracking=${t}`;
  return null;
}
function mapVendorState(statusRaw) {
  const s = String(statusRaw || '').trim().toLowerCase();
  if (s === 'shipped') return 'shipped';
  if (s === 'partially shipped') return 'partial';
  if (s === 'complete') return 'complete';
  if (s === 'confirmed' || s === 'received') return 'confirmed';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'unknown';
}

/**
 * POST /api/sanmar-orders/sync-shipments
 *
 * Manual same-origin trigger for the proxy's bounded SanMar shipment catch-up
 * (Erik 2026-06-16). The proxy endpoint is secret-gated (CRM_API_SECRET) so the
 * browser can't call it directly; this passes the secret server-side. It pulls the
 * live SanMar shipment feed for recent open orders that lack a tracking row and
 * PERSISTS any tracking into the synced table, so the dashboard Inbound dots flip
 * to "Shipped" (with tracking) and STAY that way across reloads. Bounded by the
 * proxy (≤15 POs) to stay under the 30s request limit.
 */
app.post('/api/sanmar-orders/sync-shipments', requireStaff, async (req, res) => {
  try {
    const secret = process.env.CRM_API_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: 'CRM_API_SECRET not configured' });
    const limit = Math.min(Math.max(parseInt(req.body && req.body.limit) || 15, 1), 15);
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-shipments?limit=${limit}`, {
      method: 'POST',
      headers: { 'x-api-secret': secret, 'Content-Type': 'application/json' },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ success: false, error: data.error || `proxy HTTP ${r.status}`, details: data.details });
    }
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-shipments proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sanmar-orders/sync-recent-completed
 *
 * Same-origin manual trigger for the proxy's recently-completed catch-up (Erik
 * 2026-06-26). The proxy endpoint is secret-gated; this passes the secret server-
 * side (the browser can't). It discovers recently-INVOICED SanMar POs and fully
 * ingests any the daily allOpen/lastUpdate passes missed — orders that raced
 * placed→shipped→Complete BETWEEN scheduled syncs and so never entered the synced
 * table at all (no PO, no tracking in the quote-view panel, the inbound dot, or the
 * daily list — e.g. PO 113470 / WO 142292). Bounded SMALL (≤6) because this whole
 * call must finish inside the 30s web-request limit: invoice discovery + per-PO
 * poSearch + shipment SOAP is heavier than /sync-shipments. Returns `remaining` so
 * the UI can prompt to run again for a larger backlog.
 */
app.post('/api/sanmar-orders/sync-recent-completed', requireStaff, async (req, res) => {
  try {
    const secret = process.env.CRM_API_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: 'CRM_API_SECRET not configured' });
    const days = Math.min(Math.max(parseInt(req.body && req.body.days) || 7, 1), 30);
    const limit = Math.min(Math.max(parseInt(req.body && req.body.limit) || 5, 1), 6);
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-recent-completed?days=${days}&limit=${limit}`, {
      method: 'POST',
      headers: { 'x-api-secret': secret, 'Content-Type': 'application/json' },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ success: false, error: data.error || `proxy HTTP ${r.status}`, details: data.details });
    }
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-recent-completed proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sanmar-orders/sync-recent-completed-status
 *
 * Same-origin pass-through for the proxy's background catch-up status, so the
 * "Refresh Inbound" button can poll until the async job finishes (the POST above
 * returns 202 immediately). Read-only; no secret needed on the proxy GET.
 */
app.get('/api/sanmar-orders/sync-recent-completed-status', requireStaff, async (req, res) => {
  try {
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-recent-completed-status`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ success: false, error: `proxy HTTP ${r.status}` });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-recent-completed-status proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/quote-sessions/:quoteId/vendor-shipment
 *
 * INBOUND blank-goods shipment status (vendor SanMar → NWCA) for the order's
 * work order. Composes two EXISTING proxy endpoints:
 *   1) /api/sanmar-orders/lookup?woId=  → SanMar PO(s) + synced status/shipments
 *   2) /api/sanmar-shipments/po/:po     → LIVE PromoStandards OSN tracking
 * Same-origin so the quote-view auto-loads it. Never claims "shipped" without
 * backing (Erik #1): on a live-OSN error it falls back to the synced shipment
 * rows and flags live:false + error.
 *
 * Query: ?woId=<work order #> (quote-view passes snapshot.order.id_Order);
 * falls back to the row's ShopWorks_Order_Number.
 */
app.get('/api/quote-sessions/:quoteId/vendor-shipment', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // Customer links must resolve the work order from their own quote; a query
    // parameter is an override available only to authenticated staff/jobs.
    const trusted = isStaffOrSync(req);
    let woId = null;
    const qWo = Number(req.query.woId);
    if (trusted && Number.isInteger(qWo) && qWo > 0 && qWo < 100000000) {
      woId = qWo;
    } else {
      const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'&q.orderBy=PK_ID DESC`);
      const rows = Array.isArray(sessions) ? sessions : [];
      const session = rows.find(s => s.PushedToShopWorks)
        || [...rows].sort((a, b) => (Number(b.PK_ID) || 0) - (Number(a.PK_ID) || 0))[0];
      if (!session || (!trusted && !shareTokenOk(req, session))) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      let snapshot = {};
      try { snapshot = typeof session.ShopWorks_Snapshot === 'string' ? JSON.parse(session.ShopWorks_Snapshot) : (session.ShopWorks_Snapshot || {}); }
      catch (_) { /* the stored order-number column remains authoritative */ }
      const colWo = Number(session.ShopWorks_Order_Number || snapshot.order?.id_Order);
      if (Number.isInteger(colWo) && colWo > 0) woId = colWo;
    }
    if (!woId) return res.json({ woId: null, linked: false, pos: [] });

    // 1) WO → SanMar PO(s) (Caspio-backed, synced status + shipments).
    let lookup;
    try {
      const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/lookup?woId=${encodeURIComponent(woId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      lookup = await r.json();
    } catch (e) {
      return res.status(502).json({ woId, linked: false, pos: [], error: `SanMar lookup failed: ${e.message}` });
    }
    const orders = (lookup && Array.isArray(lookup.orders)) ? lookup.orders : [];
    if (orders.length === 0) return res.json({ woId, linked: false, pos: [] });

    // 2) Per PO, pull LIVE OSN tracking; fall back to synced shipments on error.
    const pos = [];
    for (const o of orders) {
      const po = o.SanMar_PO || null;
      const baseState = mapVendorState(o.SanMar_Status);
      let boxes = [];
      let live = false;
      let error = null;
      if (po) {
        const poDigits = (String(po).match(/^\d+/) || [''])[0] || po;
        try {
          const sr = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-shipments/po/${encodeURIComponent(poDigits)}`);
          const sj = await sr.json().catch(() => ({}));
          if (sr.ok && sj && sj.success && sj.data && Array.isArray(sj.data.boxes)) {
            boxes = sj.data.boxes.map(b => ({
              boxNumber: b.boxNumber,
              trackingNumber: b.trackingNumber || null,
              carrier: b.carrier || '',
              trackingUrl: buildVendorTrackingUrl(b.carrier, b.trackingNumber),
              shipDate: b.shipmentDate ? String(b.shipmentDate).split('T')[0] : '',
              shippingMethod: b.shippingMethod || '',
              items: b.items || [],
            }));
            live = true;
          } else if (sj && sj.error) {
            error = sj.error;
          }
        } catch (e) {
          error = e.message;
        }
        // Fall back to the synced shipment rows when live OSN gave us nothing.
        if (!live && Array.isArray(o.shipments) && o.shipments.length) {
          boxes = o.shipments.filter(s => s.Tracking_Number).map((s, i) => ({
            boxNumber: i + 1,
            trackingNumber: s.Tracking_Number,
            carrier: s.Carrier || '',
            trackingUrl: buildVendorTrackingUrl(s.Carrier, s.Tracking_Number),
            shipDate: s.Ship_Date || '',
            shippingMethod: s.Ship_Method || '',
            items: [],
          }));
        }
      }
      const hasTracking = boxes.some(b => b.trackingNumber);
      const state = (hasTracking && (baseState === 'confirmed' || baseState === 'unknown')) ? 'shipped' : baseState;
      const shipped = ['shipped', 'partial', 'complete'].includes(state) || hasTracking;
      pos.push({
        po,
        salesOrder: o.SanMar_Sales_Order || '',
        status: o.SanMar_Status || '',
        state,
        shipped,
        estimatedDelivery: o.Estimated_Delivery || '',
        boxes,
        live,
        error,
      });
    }

    res.json({ woId, linked: true, pos });
  } catch (error) {
    console.error('[vendor-shipment] error:', error);
    res.status(500).json({ error: 'vendor-shipment failed', details: error.message });
  }
});

/**
 * POST /api/quote-sessions/bulk-sync-from-shopworks
 *
 * Sync ALL Processed quotes from the last 30 days. Used by the staff
 * dashboard "Sync all" button + the hourly cron job. Returns aggregate
 * stats: how many synced, imported, deleted, still pending.
 *
 * Body params (optional):
 *   - daysBack:    default 30, max 90
 *   - olderThanMin: default 30 (skip rows synced more recently than N min)
 *   - dryRun:      if true, returns the list of candidates without syncing
 */
/**
 * POST /api/quote-sessions/:quoteId/send-to-shipstation
 *
 * Push the quote's customer + line items to ShipStation. Idempotent — if the
 * order already exists (orderKey = quoteId), ShipStation updates instead of
 * duplicating.
 *
 * Response shapes:
 *   { success: true, shipstationOrderId: 12345, status: 'awaiting_shipment' }
 *   { success: true, alreadySent: true, shipstationOrderId: ... }
 *   { skipped: true, reason: 'pickup' }              // Customer Pickup orders
 *   { success: false, error: '...' }                 // 4xx/5xx pass-through
 */
const submitToShipStation = require('../lib/shipstation/submit')(ctx);
app.post('/api/quote-sessions/:quoteId/send-to-shipstation', requireStaff, async (req, res) => {
  return submitToShipStation(req, res);
});

// ── "Your order shipped" email (Erik 2026-06-10) ───────────────────────────
// Fires from the shipstation-tracking endpoint below — the single chokepoint
// where tracking lands (SHIP_NOTIFY webhook AND the hourly backfill cron both
// write through it). Storefront orders only (orderSettings.channel
// 'custom-tees' / '3-day-tees'): rep-managed quotes keep their human touch.
// Dedup via orderSettings.shipEmailSentAt (backfill re-running can't double-
// send). Fail-soft like the confirmation emails — never breaks the tracking
// write.
function trackingLinkFor(carrier, trackingNumber, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  const c = String(carrier || '').toLowerCase();
  const n = encodeURIComponent(trackingNumber || '');
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.includes('usps') || c.includes('stamps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  return `https://www.google.com/search?q=${n}`;
}

async function sendOrderShippedEmail(quoteSession, payload) {
  try {
    if (!process.env.EMAILJS_PRIVATE_KEY || !process.env.EMAILJS_PUBLIC_KEY) return;
    if (!payload.trackingNumber) return;
    const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
    const os = parse(quoteSession.OrderSettingsJSON);
    // EXACT registry lookup (not the default-to-3DT resolver): rep-managed
    // quotes and unregistered channels must stay silently excluded, exactly
    // like the old hardcoded 'custom-tees'/'3-day-tees' whitelist. A new
    // storefront channel gets this email by registering with
    // emails.shippedEnabled: true — no hidden list to forget.
    const shipChCfg = channelConfigExact(os.channel);
    if (!shipChCfg || !shipChCfg.emails.shippedEnabled) return;
    if (os.shipEmailSentAt) return; // already notified
    const customerData = parse(quoteSession.CustomerDataJSON);
    const email = customerData.email || quoteSession.CustomerEmail;
    if (!email) return;

    const statusUrl = os.statusToken ? buildOrderStatusUrl(quoteSession.QuoteID, os.statusToken) : '';
    const carrier = payload.trackingCarrier || 'UPS';
    const name = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()
      || quoteSession.CustomerName || 'there';
    const sent = await sendEmailJSTemplate(shipChCfg.emails.shippedTemplate, {
      to_email: email,
      to_name: escapeHTMLSrv(name),
      order_number: escapeHTMLSrv(quoteSession.QuoteID),
      customer_name: escapeHTMLSrv(name),
      carrier: escapeHTMLSrv(carrier.toUpperCase()),
      tracking_number: escapeHTMLSrv(payload.trackingNumber),
      tracking_url: trackingLinkFor(carrier, payload.trackingNumber, payload.trackingUrl),
      order_status_url: statusUrl,
      style_name: escapeHTMLSrv(os.styleName || ''),
      company_phone: '253-922-5793',
      reply_to: 'sales@nwcustomapparel.com',
    });
    if (!sent) return; // logged inside the helper; backfill cron will NOT retry
                       // (no stamp) only if a later tracking write happens — fine.

    // Stamp the dedup marker, preserving every existing key.
    const merged = Object.assign({}, os, { shipEmailSentAt: new Date().toISOString() });
    await makeApiRequest(`/quote_sessions/${quoteSession.PK_ID}`, 'PUT', {
      OrderSettingsJSON: JSON.stringify(merged),
    });
    console.log(`[shipped-email] ✓ ${quoteSession.QuoteID} → ${email} (${payload.trackingNumber})`);
  } catch (e) {
    console.error('[shipped-email] failed (tracking write unaffected):', e.message);
  }
}

/**
 * POST /api/quote-sessions/:quoteId/shipstation-tracking
 *
 * Called BY the proxy webhook handler when ShipStation reports a label was
 * bought. Writes tracking fields to Caspio quote_sessions by QuoteID.
 *
 * Body: { quoteId, trackingNumber, trackingCarrier, trackingUrl, shippedAt,
 *         labelCost, shipstationOrderId, shipstationStatus }
 *
 * Requires a staff session or the shared CRM secret sent by the proxy callback.
 */
app.post('/api/quote-sessions/:quoteId/shipstation-tracking', requireStaffOrSync, async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const payload = req.body || {};

    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      console.warn(`[shipstation-tracking] no quote found for ${safeQuoteId}`);
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    const pkId = sessions[0].PK_ID;

    const updates = {
      TrackingNumber:     payload.trackingNumber || null,
      TrackingCarrier:    payload.trackingCarrier || null,
      TrackingURL:        payload.trackingUrl || null,
      ShippedAt:          payload.shippedAt || new Date().toISOString(),
      LabelCost:          Number(payload.labelCost) || null,
      ShipStation_Status: payload.shipstationStatus || 'shipped',
      ShipStation_Last_Synced: new Date().toISOString(),
    };

    // Strip nulls so we don't blow away existing values with empty writes.
    for (const k of Object.keys(updates)) {
      if (updates[k] == null || updates[k] === '') delete updates[k];
    }

    await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', updates);
    console.log(`[shipstation-tracking] ✓ ${safeQuoteId} → tracking ${payload.trackingNumber} (${payload.trackingCarrier})`);

    // Fire-and-forget "your order shipped" email for storefront orders —
    // never blocks or fails the tracking write.
    sendOrderShippedEmail(sessions[0], payload);

    return res.json({ success: true, updated: Object.keys(updates) });
  } catch (error) {
    console.error('[shipstation-tracking] error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/quote-sessions/bulk-sync-from-shopworks', requireStaffOrSync, async (req, res) => {
  const startedAt = Date.now();
  try {
    const daysBack = Math.min(Math.max(Number(req.body?.daysBack) || 30, 1), 90);
    const olderThanMin = Math.max(Number(req.body?.olderThanMin) || 30, 5);
    const dryRun = req.body?.dryRun === true || req.query?.dryRun === '1';

    // Pull processed quote_sessions rows. Caspio's filter syntax doesn't
    // cleanly support date-range comparisons via this proxy path, so we
    // pull all Processed rows + filter by date client-side. There are
    // typically <500 Processed quotes total at any time.
    //
    // ⚠️ 2026-07-26: this used to send `?q.where=...&q.pageSize=1000`, and the
    // comment here claimed the proxy honoured q.where. IT NEVER DID — the proxy's
    // GET /api/quote_sessions only reads named params, so q.where was silently
    // dropped and every hourly run fell through to a full, uncached, UNORDERED
    // scan of Quote_Sessions (up to 20 pages, silently truncating at the cap).
    // Use the named `syncCandidates=true` filter, which encodes the exact
    // predicate below server-side and is cacheable.
    //
    // Cron pickup criteria (2026-05-23): we sync rows that are EITHER
    //   • Status='Processed' (DTG OF flow) OR
    //   • PushedToShopWorks IS NOT NULL (EMB/SCP/DTF push-handler flow)
    // The two builders use different dedup conventions — DTG OF flips Status
    // to 'Processed' after push; EMB/DTF/SCP push handlers in the proxy set
    // a PushedToShopWorks timestamp but leave Status='Open'. Without this
    // OR clause, EMB/SCP/DTF orders never get their ShopWorks snapshot
    // synced back, which means /invoice/EMB-XXXX shows pre-import data only
    // and Send-to-ShipStation has incomplete info.
    // Cancelled rows are excluded at the source (2026-07-18): a cancelled
    // EMB/SCP/DTF quote still matches `PushedToShopWorks IS NOT NULL`, and
    // re-syncing it every hour re-stamped ShopWorks_Last_Synced — which reset
    // its 30-day purge countdown daily (quote-management's "Purges in N days"
    // counts from Last_Synced). The purge pass below still handles them.
    let sessions;
    try {
      sessions = await makeApiRequest('/quote_sessions?syncCandidates=true');
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Caspio fetch failed', details: e.message });
    }
    if (!Array.isArray(sessions)) sessions = [];

    // Filter to last N days (by CreatedAt_Quote OR fall back to no-date)
    const sinceMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const inWindow = sessions.filter(s => {
      const created = s.CreatedAt_Quote || s.CreatedAt;
      if (!created) return true; // include rows without a created date
      const t = Date.parse(created);
      if (!Number.isFinite(t)) return true;
      return t >= sinceMs;
    });

    // Filter to ones that are stale (Last_Synced > olderThanMin OR never synced).
    // Use parseCaspioPacificMs because Caspio returns naive Pacific timestamps —
    // raw Date.parse on a UTC server (Heroku) shifts ~7-8 h and would incorrectly
    // mark fresh syncs as stale (or vice versa).
    const staleThresholdMs = olderThanMin * 60 * 1000;
    const now = Date.now();

    // Age-based backoff (2026-07-18 Caspio quota reduction): quotes <7 days
    // old sync on every hourly run — that cadence is what detects ShopWorks-
    // side deletions and fires the ShipStation cancel-cascade for ACTIVE
    // orders. Older quotes (7-30d) sync only on the 0/6/12/18 UTC runs
    // (4×/day). Keyed on CreatedAt_Quote, NOT ShopWorks_Last_Synced — every
    // sync branch re-stamps Last_Synced, so it can never age. The dashboard's
    // manual button passes { full: true } to bypass the backoff entirely.
    const fullSync = req.body?.full === true;
    const BACKOFF_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const isBackoffHour = new Date().getUTCHours() % 6 === 0;

    const candidates = inWindow.filter(s => {
      if (!fullSync && !isBackoffHour) {
        const created = s.CreatedAt_Quote || s.CreatedAt;
        const t = created ? Date.parse(created) : NaN;
        // Unknown age → treat as recent (sync hourly — the safe default).
        if (Number.isFinite(t) && (now - t) > BACKOFF_AGE_MS) return false;
      }
      if (!s.ShopWorks_Last_Synced) return true;
      const lastSynced = parseCaspioPacificMs(s.ShopWorks_Last_Synced);
      if (!Number.isFinite(lastSynced)) return true;
      return (now - lastSynced) > staleThresholdMs;
    });

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        totalProcessedInWindow: inWindow.length,
        totalProcessedAllTime: sessions.length,
        candidates: candidates.slice(0, 20).map(s => ({
          quoteId: s.QuoteID,
          customer: s.CustomerName,
          lastSynced: s.ShopWorks_Last_Synced,
          status: s.ShopWorks_Status,
        })),
      });
    }

    // Sync each candidate sequentially with a 1s throttle (MO rate limits).
    const stats = { synced: 0, imported: 0, deleted: 0, pending: 0, errors: 0, errorDetails: [] };
    for (const s of candidates) {
      try {
        const r = await fetch(`http://localhost:${process.env.PORT || 3000}/api/quote-sessions/${encodeURIComponent(s.QuoteID)}/sync-from-shopworks`, {
          method: 'POST',
          // x-forwarded-proto marks this as an already-secure internal call so
          // the force-HTTPS middleware never 302s it to https://localhost
          // (the loopback bypass also covers this; belt-and-suspenders). 2026-06-15
          headers: withProxySecret({ 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' }),
          body: JSON.stringify({}),
        });
        const data = await r.json().catch(() => ({}));
        if (data.success && data.synced) {
          stats.synced++;
          if (data.deleted) stats.deleted++;
          else if (data.status === 'Imported') stats.imported++;
          else stats.pending++;
        } else {
          stats.errors++;
          stats.errorDetails.push({ quoteId: s.QuoteID, error: data.error || 'unknown' });
        }
      } catch (e) {
        stats.errors++;
        stats.errorDetails.push({ quoteId: s.QuoteID, error: e.message });
      }
      // Throttle to avoid hammering MO API.
      await new Promise(r => setTimeout(r, 1000));
    }

    // --- 30-day purge pass for soft-deleted rows -------------------------
    // Hard-purges quote_sessions rows where Status='Cancelled_in_ShopWorks'
    // AND ShopWorks_Last_Synced > 30 days ago. Audit-trail retention is
    // 30 days from the deletion-detection timestamp. (Erik 2026-05-21)
    const PURGE_RETENTION_DAYS = SOFT_DELETE_RETENTION_DAYS;
    const purgeStats = { purged: 0, purgeErrors: 0 };
    // Purge pass runs once daily (the 6 UTC run) instead of hourly — deletes
    // become due on a 30-DAY clock, so hourly checks were pure Caspio burn.
    // Manual { full: true } runs still purge so the dashboard button behaves
    // exactly as before.
    const runPurgePass = fullSync || new Date().getUTCHours() === 6;
    if (!dryRun && runPurgePass) {
      try {
        // Named filter, not q.where — the proxy silently ignored q.where here too
        // (see the bulk-sync note above) and now rejects it outright.
        const cancelled = await makeApiRequest('/quote_sessions?cancelledInShopWorks=true');
        if (Array.isArray(cancelled) && cancelled.length > 0) {
          const purgeBeforeMs = Date.now() - PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
          const purgeList = cancelled.filter(s => {
            // parseCaspioPacificMs — Caspio returns naive Pacific timestamps;
            // raw Date.parse would resolve them as UTC on Heroku, purging
            // ~7-8 h late (or early near DST transitions).
            const ts = s.ShopWorks_Last_Synced ? parseCaspioPacificMs(s.ShopWorks_Last_Synced) : 0;
            return Number.isFinite(ts) && ts > 0 && ts < purgeBeforeMs;
          });
          for (const s of purgeList) {
            try {
              // Delete child quote_items first (best-effort).
              const items = await makeApiRequest(`/quote_items?filter=QuoteID='${s.QuoteID}'`);
              if (Array.isArray(items)) {
                for (const it of items) {
                  if (it.PK_ID) {
                    await makeApiRequest(`/quote_items/${it.PK_ID}`, 'DELETE').catch(() => {});
                  }
                }
              }
              await makeApiRequest(`/quote_sessions/${s.PK_ID}`, 'DELETE');
              console.log(`[bulk-sync] 🗑️ PURGED ${s.QuoteID} (cancelled ${PURGE_RETENTION_DAYS}+ days ago)`);
              purgeStats.purged++;
            } catch (e) {
              console.warn(`[bulk-sync] purge failed for ${s.QuoteID}:`, e.message);
              purgeStats.purgeErrors++;
            }
          }
        }
      } catch (e) {
        console.warn('[bulk-sync] purge pass skipped (fetch failed):', e.message);
      }
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[bulk-sync] ${stats.synced} synced (${stats.imported} imported, ${stats.deleted} soft-deleted, ${stats.pending} pending, ${stats.errors} errors, ${purgeStats.purged} purged) in ${elapsedSec}s`);
    // Watchdog (2026-06-15): record this run so the proxy's hourly
    // check-quote-sync-health.js cron can detect the sync silently failing —
    // e.g. the localhost-self-call ECONNREFUSED regression that returned
    // synced:0/errors:N every hour. See GET/POST /api/quote-sync-health below.
    recordQuoteSyncRun(stats, candidates.length);
    res.json({ success: true, ...stats, ...purgeStats, elapsedSec, candidateCount: candidates.length, totalProcessedInWindow: inWindow.length });
  } catch (error) {
    console.error('[bulk-sync] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Bulk sync failed', details: error.message });
  }
});

};
