// routes/quote-plane.js — Quote data plane relays (quote_sessions / quote_items / quote_analytics postures + sequence mint)
// Extracted VERBATIM from server.js lines 11850-11997 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { makeApiRequest, originalQueryString, quotePlaneWriteLimiter, quoteScopedOrStaff, requireStaff, sanitizeFilterInput } = ctx;

// =============================================================================
// QUOTE DATA PLANE RELAYS (hardened 2026-08-26 — quote-plane lockdown step 2)
//
// These same-origin routes are THE browser path to the proxy's Quote_Sessions /
// Quote_Items / Quote_Analytics tables. They used to be anonymous passthroughs
// (an ungated twin of the proxy's own routes); every browser caller has been
// migrated onto them and the proxy side is being gated secret-only. Postures:
//
//   • Staff pages (builders, quote-management, bundle-orders, lead workspace,
//     universal-records) → requireStaff on every unscoped read and EVERY
//     mutation of existing rows (PUT/DELETE — the price-rewrite risk).
//   • Public pages (quote-cart, calculators, checkout-success, quote-view)
//     → CREATE (POST) stays anonymous behind quotePlaneWriteLimiter, and reads
//     must be SCOPED to a quoteID/sessionID the caller already knows
//     (capability-URL model) — an anonymous caller can never LIST the book.
//
// List reads forward the ORIGINAL query string verbatim: callers use both
// `QuoteID=` and `quoteID=` spellings plus staff filters (customerEmail,
// createdAfter, q.orderBy…) and the proxy validates/sanitizes all of them
// server-side (named params only; raw q.where is 400-rejected upstream).
// =============================================================================




// Quote Sessions API - GET sessions (staff: any filter/none; anonymous: scoped)
app.get('/api/quote_sessions', quoteScopedOrStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions${originalQueryString(req)}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote sessions:', error);
    res.status(500).json({ error: 'Failed to fetch quote sessions', details: error.message });
  }
});

// GET single session by PK — staff only (sequential PKs enumerate the book)
app.get('/api/quote_sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session:', error);
    res.status(500).json({ error: 'Failed to fetch quote session' });
  }
});

app.get('/api/quote_sessions/session/:sessionId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_sessions?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote session by session ID' });
  }
});

app.get('/api/quote_sessions/quote/:quoteId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const data = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session by quote ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote session by quote ID' });
  }
});

// CREATE new session — anonymous allowed (public calculators/cart), rate-limited
app.post('/api/quote_sessions', quotePlaneWriteLimiter, async (req, res) => {
  try {
    console.log('[QUOTE API] Creating quote session with QuoteID:', req.body.QuoteID);
    
    // Use makeApiRequest like other endpoints - it should handle the location header
    const data = await makeApiRequest('/quote_sessions', 'POST', req.body);
    console.log('[QUOTE API] Raw response from proxy:', JSON.stringify(data));
    
    // Check if we have a valid response
    if (data) {
      // If PK_ID is "records", it means the proxy couldn't parse the location header
      if (data.PK_ID === 'records' && data.location) {
        console.log('[QUOTE API] Got "records" as PK_ID, attempting to extract from location:', data.location);
        
        // Try to extract ID from location
        const match = data.location.match(/\/(\d+)$/);
        if (match) {
          data.PK_ID = match[1];
          console.log('[QUOTE API] Extracted PK_ID:', data.PK_ID);
        }
      }
      
      // If we have a valid PK_ID now, return the data
      if (data.PK_ID && data.PK_ID !== 'records') {
        res.status(201).json(data);
        return;
      }
    }
    
    // Fallback: try to get by QuoteID
    console.log('[QUOTE API] No valid PK_ID in response, trying fallback with QuoteID:', req.body.QuoteID);

    // Wait a moment for Caspio to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // SECURITY: Sanitize input even from body
    const safeQuoteID = sanitizeFilterInput(req.body.QuoteID);
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteID}'`);
    console.log('[QUOTE API] Fallback query result:', sessions ? sessions.length + ' sessions found' : 'null');
    
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      console.log('[QUOTE API] Found session via fallback:', sessions[0]);
      res.status(201).json(sessions[0]);
    } else {
      // Return what we sent with temporary ID
      console.log('[QUOTE API] Could not find created session, returning temporary response');
      res.status(201).json({ 
        ...req.body, 
        PK_ID: 'TEMP_' + Date.now(), 
        success: true,
        _note: 'This is a temporary response - quote may still be saved in Caspio' 
      });
    }
  } catch (error) {
    console.error('[QUOTE API] Error creating quote session:', error.message);
    console.error('[QUOTE API] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create quote session',
      details: error.message 
    });
  }
});

// UPDATE session — staff only (every live browser mutator is a staff page;
// the public accept/deposit flows do their PUTs through their own server-side
// routes with server-side authority, never through this relay)
app.put('/api/quote_sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote session:', error);
    res.status(500).json({ error: 'Failed to update quote session' });
  }
});

};
