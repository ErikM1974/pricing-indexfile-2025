// routes/policies-assist.js — policies-assist
// Extracted VERBATIM from server.js lines 1526-1568 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, express, fetch, requireCrmRole } = ctx;

app.post(
  '/api/policies/ai-assist',
  requireCrmRole(['policies-admin']),
  express.json({ limit: '1mb' }),
  async (req, res) => {
    const target = `${CRM_API_BASE}/api/policies-ai-assist`;
    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-CRM-API-Secret': CRM_API_SECRET
        },
        body: JSON.stringify(req.body || {})
      });

      // Forward upstream status + the SSE headers
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!upstream.body) {
        res.end();
        return;
      }
      // Pipe the SSE chunks straight through — no buffering, no re-parsing
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
    } catch (e) {
      console.error('[ai-assist proxy] error:', e.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream AI service unavailable', detail: e.message });
      } else {
        res.end();
      }
    }
  }
);
};
