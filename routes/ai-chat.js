// routes/ai-chat.js — AI chat forwarders (session-gated streaming proxies)
// Extracted VERBATIM from server.js lines 4549-4642 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, express, fetch, requireStaff } = ctx;

// AI CHAT FORWARDERS — session-gated streaming proxies to caspio-pricing-proxy.
//
// WHY (2026-07-29). The sticker route was hardened on 2026-07-24 after its
// lookup_customer tool — company, contact name, email, phone, street address,
// sales rep, payment terms, last-ordered date, five matches for any two-char
// query — turned out to be callable by anyone with curl. That fix was applied
// to exactly ONE route. Six siblings carrying the SAME tool were left mounted
// with only a per-IP rate limiter in front, which the proxy's own comment
// admitted: "These are unauthenticated ... (Coarse guard; true protection is
// auth — TODO.)" Verified live before this change: an anonymous POST with an
// empty body returned 401 on the sticker route and 400 "messages array is
// required" on the others — i.e. they answered strangers.
//
// Second harm, easy to miss: every one of those requests spends Anthropic
// tokens (Sonnet + up to 6 tool iterations), so an open endpoint is also an
// open tab on our bill.
//
// THE SHAPE OF THE FIX. A browser cannot hold a server secret, which is why no
// gate was ever added. So the call goes through the app instead: requireStaff
// proves a SAML session here, CRM_API_SECRET authenticates us to the proxy
// server-to-server, and the browser never holds a credential. Same client
// contract as before — POST returns text/event-stream with delta /
// tool_result / done / error events.
//
// The app path deliberately MIRRORS the proxy path, so repointing a caller is
// just dropping API_BASE_URL from the front of the URL.
//
// ⚠️ DEPLOY ORDER: ship THIS app first, THEN add requireCrmApiSecret to the
// proxy mounts. Reversed, all six chats 401 until the app catches up.
//
// NOTE the emblem and laser-tumbler calculators are customer-facing pages. Only
// the CHAT is staff-gated here; their pricing tables stay public. A customer on
// that page now gets a clean "staff only" notice instead of a tool that could
// enumerate other customers.
// =============================================================================
const AI_CHAT_ROUTES = [
  'contract-embroidery-ai',
  'contract-dtg-ai',
  'contract-emblem-ai',
  'contract-webstore-ai',
  'dtg-quote-ai',
  'emb-quote-ai',
  // 253gear product-copy drafter (2026-08-08). Same SSE contract as the quote chats,
  // so adding the slug here is the whole app-side integration.
  'shopify-description-ai',
];

for (const slug of AI_CHAT_ROUTES) {
  app.post(
    `/api/${slug}/chat`,
    requireStaff,                       // /api/* → 401 JSON, no SSO redirect
    express.json({ limit: '256kb' }),
    async (req, res) => {
      const target = `${CRM_API_BASE}/api/${slug}/chat`;
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

        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        if (!upstream.body) {
          res.end();
          return;
        }
        // Pipe SSE chunks straight through — no buffering, no re-parsing
        for await (const chunk of upstream.body) {
          res.write(chunk);
        }
        res.end();
      } catch (e) {
        console.error(`[${slug} forwarder] error:`, e.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Upstream AI service unavailable', detail: e.message });
        } else {
          res.end();
        }
      }
    }
  );
}
console.log(`✓ AI chat forwarders loaded (session-gated, ${AI_CHAT_ROUTES.length} routes)`);

// =============================================================================
};
