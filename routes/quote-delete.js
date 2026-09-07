// routes/quote-delete.js — Quote delete — role-based server-side enforcement + quote push previews
// Extracted VERBATIM from server.js lines 12804-13180 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CASPIO_PROXY_BASE, CRM_API_SECRET, fetch, makeApiRequest, originalQueryString, quotePlaneWriteLimiter, quoteScopedOrStaff, rateLimit, requireStaff, sanitizeFilterInput, withProxySecret } = ctx;

// QUOTE DELETE — ROLE-BASED SERVER-SIDE ENFORCEMENT (2026-06-15)
//
// The dashboard already hides the delete control for quotes a rep doesn't own,
// but per the CRM auth model ("role checks happen server-side; frontend
// permissions are for UX only" — CRM_DASHBOARD_AUTH.md) the real gate lives
// here. We trust the logged-in identity from the express session
// (req.session.crmUser, established by /api/crm-session post-Caspio-login) —
// the SAME mechanism that guards the CRM dashboards — never a client-supplied
// claim on the delete request itself.
//
//   • master (Erik)            → may delete ANY quote
//   • any other logged-in rep  → may delete ONLY quotes they own
//   • no session               → 401 (refresh + log in)
//   • someone else's quote     → 403
// ============================================================================
const QUOTE_STAFF_EMAIL_MAP = {
  'Adriyella': 'adriyella@nwcustomapparel.com',
  'Bradley Wright': 'bradley@nwcustomapparel.com',
  'Erik Mickelson': 'erik@nwcustomapparel.com',
  'Jim Mickelson': 'jim@nwcustomapparel.com',
  'Nika Lao': 'nika@nwcustomapparel.com',
  'Ruth Nhong': 'ruth@nwcustomapparel.com',
  'Steve Deland': 'art@nwcustomapparel.com',
  'Taneisha Clark': 'taneisha@nwcustomapparel.com',
};
const QUOTE_MASTER_DELETE_EMAILS = new Set(['erik@nwcustomapparel.com']);

function quoteStaffNameToEmail(name) {
  if (!name) return null;
  const hit = QUOTE_STAFF_EMAIL_MAP[String(name).trim()];
  return hit ? hit.toLowerCase() : null;
}

// Owner email for a quote_sessions row — mirrors the dashboard's getQuoteOwnerEmail:
//   SalesRepEmail → ShopWorks snapshot CustomerServiceRep → SalesRepName.
function quoteOwnerEmailFromRow(row) {
  if (!row) return null;
  if (row.SalesRepEmail && String(row.SalesRepEmail).trim()) {
    return String(row.SalesRepEmail).trim().toLowerCase();
  }
  if (row.ShopWorks_Snapshot) {
    try {
      const rep = JSON.parse(row.ShopWorks_Snapshot)?.order?.CustomerServiceRep;
      const email = quoteStaffNameToEmail(rep);
      if (email) return email;
    } catch (_) { /* malformed snapshot */ }
  }
  return quoteStaffNameToEmail(row.SalesRepName);
}

// DELETE session — role-gated (see block above).
app.delete('/api/quote_sessions/:id', async (req, res) => {
  try {
    const pkId = Number(req.params.id);
    if (!Number.isInteger(pkId) || pkId <= 0) {
      return res.status(400).json({ error: 'Invalid quote id' });
    }

    // 1. Identity must come from the trusted session, not the request body.
    const caller = req.session && req.session.crmUser;
    if (!caller) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Your session expired — refresh the page and log in, then try again.' });
    }
    const callerEmail = String(caller.email || quoteStaffNameToEmail(caller.name) || '').toLowerCase();
    const isMaster = caller.firstName === 'Erik' || QUOTE_MASTER_DELETE_EMAILS.has(callerEmail);

    // 2. Non-master: fetch the row and verify ownership before deleting.
    if (!isMaster) {
      let row = null;
      try {
        // Single-record read by PK via the PATH param — a filtered list read
        // (`?q.where=PK_ID=N`) is NOT honored here (returns ALL rows → row[0] is
        // the wrong quote → owner mismatch → a rep can't delete their own). See
        // the "verify fresh writes by PK_ID, never a filtered list read" rule.
        const resp = await makeApiRequest(`/quote_sessions/${pkId}`);
        const list = Array.isArray(resp) ? resp
          : (resp && Array.isArray(resp.Result) ? resp.Result
          : (resp ? [resp] : []));
        row = list.find(r => r && String(r.PK_ID) === String(pkId)) || null;
      } catch (e) {
        return res.status(500).json({ error: 'Failed to verify quote ownership', details: e.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      const ownerEmail = quoteOwnerEmailFromRow(row);
      if (!ownerEmail || ownerEmail !== callerEmail) {
        console.warn(`[quote-delete] BLOCKED ${caller.name || callerEmail} (${callerEmail}) from deleting PK ${pkId} owned by ${ownerEmail || 'unknown'}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own quotes. Ask the owner — or Erik — to delete it.',
        });
      }
    }

    // 3. Authorized — perform the delete.
    try {
      await makeApiRequest(`/quote_sessions/${pkId}`, 'DELETE');
    } catch (err) {
      // The proxy 404s when the PK matches no row (2026-07-08 fix — it used to
      // answer 200 recordsAffected:0 for hits AND misses). Already-gone is the
      // desired end state (double-click, stale list row): report success with
      // a flag rather than a scary 500.
      if (String(err.message).includes('status 404')) {
        console.log(`[quote-delete] PK ${pkId} already gone (proxy 404) — treating as deleted`);
        return res.json({ success: true, alreadyGone: true });
      }
      throw err;
    }
    console.log(`[quote-delete] ${caller.name || callerEmail} deleted quote PK ${pkId}${isMaster ? ' (master)' : ' (owner)'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote session:', error);
    res.status(500).json({ error: 'Failed to delete quote session' });
  }
});

// Quote Items API — list (staff: any; anonymous: must scope to a QuoteID).
// Forwards the query string (this relay used to DROP it, returning ALL items).
app.get('/api/quote_items', quoteScopedOrStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_items${originalQueryString(req)}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items:', error);
    res.status(500).json({ error: 'Failed to fetch quote items' });
  }
});

app.get('/api/quote_items/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_items/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote item:', error);
    res.status(500).json({ error: 'Failed to fetch quote item' });
  }
});

app.get('/api/quote_items/session/:sessionId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_items?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote items by session ID' });
  }
});

app.post('/api/quote_items', quotePlaneWriteLimiter, async (req, res) => {
  try {
    console.log('[QUOTE ITEMS API] Creating quote item for QuoteID:', req.body.QuoteID);
    
    // Use makeApiRequest like other endpoints - it should handle the location header
    const data = await makeApiRequest('/quote_items', 'POST', req.body);
    console.log('[QUOTE ITEMS API] Raw response from proxy:', JSON.stringify(data));
    
    // Check if we have a valid response
    if (data) {
      // If PK_ID is "records", it means the proxy couldn't parse the location header
      if (data.PK_ID === 'records' && data.location) {
        console.log('[QUOTE ITEMS API] Got "records" as PK_ID, attempting to extract from location:', data.location);
        
        // Try to extract ID from location
        const match = data.location.match(/\/(\d+)$/);
        if (match) {
          data.PK_ID = match[1];
          console.log('[QUOTE ITEMS API] Extracted PK_ID:', data.PK_ID);
        }
      }
      
      // If we have a valid PK_ID now, return the data
      if (data.PK_ID && data.PK_ID !== 'records') {
        res.status(201).json(data);
        return;
      }
    }
    
    // Fallback: try to get by QuoteID and LineNumber
    console.log('[QUOTE ITEMS API] No valid PK_ID in response, trying fallback with QuoteID:', req.body.QuoteID);

    // Wait a moment for Caspio to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // SECURITY: Sanitize input even from body
    const safeQuoteID = sanitizeFilterInput(req.body.QuoteID);
    const items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteID}'`);
    console.log('[QUOTE ITEMS API] Fallback query result:', items ? items.length + ' items found' : 'null');
    
    if (items && Array.isArray(items)) {
      const newItem = items.find(item => item.LineNumber === req.body.LineNumber);
      if (newItem) {
        console.log('[QUOTE ITEMS API] Found item via fallback:', newItem);
        res.status(201).json(newItem);
        return;
      }
    }
    
    // Return what we sent with temporary ID
    console.log('[QUOTE ITEMS API] Could not find created item, returning temporary response');
    res.status(201).json({ 
      ...req.body, 
      PK_ID: 'TEMP_' + Date.now(), 
      success: true,
      _note: 'This is a temporary response - item may still be saved in Caspio' 
    });
    
  } catch (error) {
    console.error('[QUOTE ITEMS API] Error creating quote item:', error.message);
    console.error('[QUOTE ITEMS API] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create quote item',
      details: error.message 
    });
  }
});

// Mutating an EXISTING line (the price-rewrite risk) — staff only.
app.put('/api/quote_items/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_items/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote item:', error);
    res.status(500).json({ error: 'Failed to update quote item' });
  }
});

app.delete('/api/quote_items/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/quote_items/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    // Proxy 404 = no row matched that PK (2026-07-08 fix) — pass it through
    // instead of masking it as a 500.
    if (String(error.message).includes('status 404')) {
      return res.status(404).json({ error: 'Quote item not found — nothing deleted' });
    }
    console.error('Error deleting quote item:', error);
    res.status(500).json({ error: 'Failed to delete quote item' });
  }
});

// Quote Analytics API — reads are staff-only (view telemetry names customers);
// the CREATE beacon stays anonymous (quote-view fires it for customers).
app.get('/api/quote_analytics', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_analytics${originalQueryString(req)}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics' });
  }
});

app.get('/api/quote_analytics/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_analytics/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics' });
  }
});

app.get('/api/quote_analytics/session/:sessionId', requireStaff, async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_analytics?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics by session ID' });
  }
});

app.post('/api/quote_analytics', quotePlaneWriteLimiter, async (req, res) => {
  try {
    const data = await makeApiRequest('/quote_analytics', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating quote analytics:', error);
    res.status(500).json({ error: 'Failed to create quote analytics' });
  }
});

app.put('/api/quote_analytics/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_analytics/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote analytics:', error);
    res.status(500).json({ error: 'Failed to update quote analytics' });
  }
});

app.delete('/api/quote_analytics/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/quote_analytics/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    // Proxy 404 = no row matched that PK (2026-07-08 fix) — pass it through
    // instead of masking it as a 500.
    if (String(error.message).includes('status 404')) {
      return res.status(404).json({ error: 'Quote analytics record not found — nothing deleted' });
    }
    console.error('Error deleting quote analytics:', error);
    res.status(500).json({ error: 'Failed to delete quote analytics' });
  }
});

// ── Quote-ID sequence mint relay (2026-08-26 lockdown) ──────────────────────
// GET-that-writes on the proxy (atomic counter increment). Minters: staff
// builders AND public calculators (dtg-contract / embroidery-contract), so it
// stays anonymous — but rate-limited (mirror of the proxy's own 60/15min
// budget, staff sessions skipped) and prefix-validated like the proxy.
const quoteSequenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!(req.session && req.session.crmUser),
  message: { error: 'Too many quote-number requests from this address — try again in a few minutes.' },
});
app.get('/api/quote-sequence/:prefix', quoteSequenceLimiter, async (req, res) => {
  const prefix = String(req.params.prefix || '').toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(prefix)) {
    return res.status(400).json({ error: 'Invalid prefix' });
  }
  try {
    const r = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/${prefix}`, {
      headers: withProxySecret(), signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.warn(`[quote-sequence relay] ${prefix} upstream failed:`, e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

// ── ShopWorks push relays (2026-08-26 lockdown) ─────────────────────────────
// Push-to-ShopWorks is a STAFF action fired from the builder pages and
// quote-view's staff mode; the proxy routes read full customer PII (the
// preview dump) and create real OnSite orders, so requireStaff + secret.
function quotePushForward(subPath) {
  return async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
    try {
      const opts = {
        method: req.method,
        headers: withProxySecret({ 'Content-Type': 'application/json' }),
        signal: AbortSignal.timeout(120000), // OnSite order creation is slow
      };
      // Re-serialize the parsed body — the global bodyParser already consumed
      // the request stream, so piping req would send an empty body.
      if (req.method === 'POST') opts.body = JSON.stringify(req.body || {});
      const r = await fetch(`${CASPIO_PROXY_BASE}/api/${subPath(req)}`, opts);
      const body = await r.text();
      res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
    } catch (e) {
      console.error('[quote-push relay]', req.originalUrl, e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  };
}
for (const method of ['embroidery', 'dtf', 'scp']) {
  app.post(`/api/${method}-push/push-quote`, requireStaff,
    quotePushForward(() => `${method}-push/push-quote`));
  app.get(`/api/${method}-push/preview/:quoteId`, requireStaff,
    quotePushForward((req) => `${method}-push/preview/${encodeURIComponent(req.params.quoteId)}`));
}

// =============================================================================
};
