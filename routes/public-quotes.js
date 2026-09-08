// routes/public-quotes.js — Public sticker quotes and quote retrieval
// Extracted VERBATIM from server.js lines 3887-4114 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CASPIO_PROXY_BASE, PUBLIC_SITE_ORIGIN, express, fetch, makeApiRequest, mintShareToken, sanitizeFilterInput, shareTokenOk, strictLimiter, withProxySecret } = ctx;

// PUBLIC STICKER QUOTE — /custom-stickers "Get this in writing" (Phase 2, 2026-07-24)
//
// Turns a configured price into a real STK quote + share link, with no login.
//
// 🔴 THE PRICE IS RE-QUOTED SERVER-SIDE. The browser sends only size + quantity;
// every dollar written to Caspio comes from /api/sticker-pricing/quote here. A
// tampered client cannot dictate a total, and the saved quote can never disagree
// with the published sheet.
//
// 🔴 THE STK SEQUENCE IS MINTED HERE, after validation — never on page load and
// never from an unvalidated click, so bots and abandoned sessions don't burn
// quote numbers.
//
// The share link carries an unguessable token (see mintShareToken). This page
// never touches the CRM, so no customer PII beyond what the visitor typed is
// persisted — nothing like payment terms or account owner can leak through the
// public quote view.
// =============================================================================
/**
 * Only accept an artwork URL that OUR proxy minted (/api/files/<key>).
 *
 * The browser tells us where the upload landed, so without this a caller could
 * post any URL they liked and have it stored on a quote and mailed to a rep —
 * turning our own quote email into a redirect to anywhere. Returns '' for
 * anything that isn't ours, which is indistinguishable from "no artwork" and so
 * degrades exactly the way the rest of this flow does.
 */
function sanitizeArtworkUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    const base = new URL(CASPIO_PROXY_BASE);
    if (u.protocol !== 'https:') return '';
    if (u.host !== base.host) return '';
    const m = u.pathname.match(/^\/api\/files\/([A-Za-z0-9_-]+)$/);
    if (!m) return '';
    // REBUILD from the validated key rather than returning the input. Passing
    // the original through kept its query string and hash, so
    // /api/files/<key>?next=https://evil.com survived validation and would have
    // been written onto a quote and mailed to a customer. Nothing the caller
    // sent survives except the key itself.
    return `${base.origin}/api/files/${m[1]}`;
  } catch (_) {
    return '';
  }
}

app.post('/api/public/sticker-quote', strictLimiter, express.json({ limit: '32kb' }), async (req, res) => {
  const b = req.body || {};

  // Honeypot: report success and store nothing, same contract as the shared
  // public-form module. A bot must not learn it was detected.
  if (b.hp) return res.json({ ok: true, quoteId: null, url: null });

  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  // Phone is OPTIONAL (2026-07-24) — email is how the quote reaches them, so it
  // is the only contact detail actually required to fulfil the request.
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'A name and a valid email are required.' });
  }

  const width = Number(b.width);
  const height = Number(b.height);
  const qty = parseInt(b.qty, 10);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
      || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'A size and quantity are required.' });
  }

  try {
    // 1. Authoritative price.
    const pr = await fetch(`${CASPIO_PROXY_BASE}/api/sticker-pricing/quote`
      + `?width=${encodeURIComponent(width)}&height=${encodeURIComponent(height)}&qty=${encodeURIComponent(qty)}`);
    if (!pr.ok) throw new Error('pricing HTTP ' + pr.status);
    const priced = await pr.json();
    if (priced.offGrid) {
      return res.status(400).json({
        error: 'That size or quantity needs an individual quote — please call (253) 922-5793.',
        reason: priced.reason
      });
    }

    const setupAmount = Number((priced.setupFee && priced.setupFee.amount) != null
      ? priced.setupFee.amount : 50);
    const chargeSetup = b.setupAnswer !== 'reorder';       // reorder is the ONLY waiver
    const setupFee = chargeSetup ? setupAmount : 0;
    const subtotal = Number(priced.totalPrice);
    const total = subtotal + setupFee;

    // 2. Mint the quote number only now that everything above validated.
    const sr = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/STK`, { headers: withProxySecret() });
    if (!sr.ok) throw new Error('sequence HTTP ' + sr.status);
    const sj = await sr.json();
    const seq = Number(sj && sj.sequence);
    if (!Number.isFinite(seq) || seq <= 0) throw new Error('bad sequence: ' + JSON.stringify(sj));
    const quoteId = `STK-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

    const shareToken = mintShareToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().replace(/\.\d{3}Z$/, '');

    // 3. Session row. Pre-tax on purpose — WA tax is applied downstream at
    //    invoice, exactly as the staff sticker path does.
    await makeApiRequest('/quote_sessions', 'POST', {
      QuoteID: quoteId,
      SessionID: `stickers_web_${Date.now()}`,
      Status: 'Open',
      CustomerEmail: email,
      CustomerName: name,
      CompanyName: String(b.company || '').trim(),
      Phone: phone,
      TotalQuantity: priced.quantity,
      SubtotalAmount: subtotal,
      LTMFeeTotal: 0,
      TotalAmount: total,
      ExpiresAt: expiresAt,
      Notes: JSON.stringify({
        share_token: shareToken,
        setup_fee: setupFee,
        setup_answer: b.setupAnswer || 'unanswered',
        taxable: true,
        tax_note: 'WA sales tax applied at invoice.',
        source: 'custom-stickers configurator',
        configured_link: String(b.configuredLink || '').slice(0, 300),
        // Artwork is OPTIONAL — a quote with no file is a normal quote, and the
        // rep follows up by email. Only ever an /api/files/ URL our own proxy
        // minted; never a customer-supplied link.
        artwork_url: sanitizeArtworkUrl(b.artworkUrl),
        artwork_name: String(b.artworkName || '').slice(0, 200),
        customer_message: String(b.message || '').slice(0, 1000),
        applied_rules: priced.appliedRules || null
      })
    });

    // 4. Line items — the sticker line, plus the setup fee as a FEE row
    //    ('fee', not 'setup-fee': quote-view filters on exactly 'fee').
    const lines = [{
      QuoteID: quoteId,
      LineNumber: 1,
      StyleNumber: priced.partNumber,
      ProductName: `${priced.size.replace('x', '" × ')}" die-cut stickers`,
      EmbellishmentType: 'sticker',
      Quantity: priced.quantity,
      BaseUnitPrice: priced.unitPrice,
      FinalUnitPrice: priced.unitPrice,
      LineTotal: subtotal,
      PricingTier: priced.isBestValue ? 'BestValue' : 'Standard'
    }];
    if (setupFee > 0) {
      lines.push({
        QuoteID: quoteId,
        LineNumber: 2,
        StyleNumber: 'GRT-50',
        ProductName: 'Art Setup Fee (one-time)',
        EmbellishmentType: 'fee',
        Quantity: 1,
        BaseUnitPrice: setupFee,
        FinalUnitPrice: setupFee,
        LineTotal: setupFee,
        PricingTier: 'Standard'
      });
    }
    for (const line of lines) {
      await makeApiRequest('/quote_items', 'POST', line);
    }

    const url = `${PUBLIC_SITE_ORIGIN}/quote/${quoteId}?k=${shareToken}`;
    console.log(`[sticker-quote] created ${quoteId} — ${priced.partNumber} × ${priced.quantity}, $${total}`);
    res.json({ ok: true, quoteId, url, totalPrice: total, subtotal, setupFee });
  } catch (err) {
    console.error('[sticker-quote] save failed:', err.message);
    // Rule 4: never pretend this worked. The page keeps what the customer typed
    // and tells them to call.
    res.status(502).json({ error: 'We could not save your quote just now.' });
  }
});

// Public API - Get quote data with view tracking
app.get('/api/public/quote/:quoteId', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // Fetch quote session
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Share-link token (see shareTokenOk). 404 rather than 401 so a walk of the
    // ID range can't distinguish "exists but wrong token" from "doesn't exist".
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Fetch quote items
    let items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);

    // Workaround: caspio-proxy may not be filtering properly
    // Filter server-side to ensure only matching items are returned
    if (items && Array.isArray(items)) {
      items = items.filter(item => item.QuoteID === safeQuoteId);
    }

    // TODO: View tracking disabled - ViewCount/FirstViewedAt fields don't exist in Caspio yet
    // To enable: Add these fields to quote_sessions table in Caspio, then uncomment:
    // const now = new Date().toISOString();
    // const currentViewCount = parseInt(session.ViewCount) || 0;
    // const updateData = { ViewCount: currentViewCount + 1 };
    // if (!session.FirstViewedAt) { updateData.FirstViewedAt = now; }
    // makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', updateData)
    //   .catch(err => console.error('Error updating view tracking:', err));

    // Return combined data
    res.json({
      session: session,
      items: items || []
    });

  } catch (error) {
    console.error('Error fetching public quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

};
