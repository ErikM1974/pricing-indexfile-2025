// routes/public-quote.js — Public quote view API (no authentication)
// Extracted VERBATIM from server.js lines 13181-13252 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { SERVER_DIR, SOFT_DELETE_RETENTION_DAYS, gateStaffDetailPage, makeApiRequest, path, sanitizeFilterInput } = ctx;

// PUBLIC QUOTE VIEW API (No Authentication Required)
// =============================================================================

// GET quote items by quoteId
app.get('/api/quote_items/quote/:quoteId', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const data = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items by quote ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote items by quote ID' });
  }
});

// Public design view page - shareable customer-facing design images
app.get('/design/:designNumber', (req, res) => {
  const designNumber = req.params.designNumber;
  if (!designNumber || !/^\d+$/.test(designNumber)) {
    return res.status(400).send('Invalid design number');
  }
  res.sendFile(path.join(SERVER_DIR, 'pages', 'design-view.html'));
});

// Art request detail page - staff-facing shareable link
app.get('/art-request/:designId', gateStaffDetailPage, (req, res) => {
  const designId = req.params.designId;
  if (!designId || !/^\d+(\.\d+)?$/.test(designId)) {
    return res.status(400).send('Invalid design ID');
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'art-request-detail.html'));
});

// /api/config — exposes runtime configuration constants the frontend needs
// (currently just SOFT_DELETE_RETENTION_DAYS so the dashboard countdown +
// quote-view banner show the same number as the server-side cron purges).
// Add new keys here as the frontend needs them.
app.get('/api/config', (req, res) => {
  res.json({
    softDeleteRetentionDays: SOFT_DELETE_RETENTION_DAYS,
  });
});

// Public quote page route - serves the HTML
app.get('/quote/:quoteId', (req, res) => {
  // Validate quote ID format - accept multiple formats:
  // - PREFIX + MMDD + - + sequence (e.g., DTF0112-1)
  // - PREFIX + - + timestamp (e.g., DTF-1768263686415)
  const quoteId = req.params.quoteId;
  if (!quoteId || !/^[A-Z]{2,5}[-\d]+-?\d*$/.test(quoteId)) {
    return res.status(400).send('Invalid quote ID format');
  }
  res.sendFile(path.join(SERVER_DIR, 'pages', 'quote-view.html'));
});

// Single-page invoice route — same data, condensed PDF-style layout
// Auto-syncs from ShopWorks when the cached snapshot is older than 30 minutes
// (see pages/js/invoice.js). Useful for printing / emailing customers a clean
// one-pager. Shares the /api/quote-sessions/:quoteId/full endpoint with the
// quote-view page, so any ShopWorks edits flow through here too.
app.get('/invoice/:quoteId', (req, res) => {
  const quoteId = req.params.quoteId;
  if (!quoteId || !/^[A-Z]{2,5}[-\d]+-?\d*$/.test(quoteId)) {
    return res.status(400).send('Invalid quote ID format');
  }
  res.sendFile(path.join(SERVER_DIR, 'pages', 'invoice.html'));
});

// =============================================================================
};
