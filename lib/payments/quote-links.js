// Payment quote-links: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { crypto } = ctx;

    // ── Customer order-status tokens (Feature B, 2026-06-10) ────────────────────
    // URL = the credential: /order-status?id=<QuoteID>&t=<first 12 hex chars of
    // HMAC-SHA256(quoteID, ORDER_STATUS_SECRET)>. No secret configured → tokens
    // simply don't exist (the API answers 503; we NEVER validate against a
    // hardcoded fallback secret).
    function computeOrderStatusToken(quoteID) {
        const secret = process.env.ORDER_STATUS_SECRET;
        if (!secret) return null;
        return crypto
            .createHmac('sha256', secret)
            .update(String(quoteID))
            .digest('hex')
            .slice(0, 12);
    }

    const PUBLIC_SITE_ORIGIN = 'https://www.teamnwca.com';

    function buildOrderStatusUrl(quoteID, token) {
        return `${PUBLIC_SITE_ORIGIN}/order-status?id=${encodeURIComponent(quoteID)}&t=${encodeURIComponent(token)}`;
    }

    // Notes-JSON reader that never loses data: legacy plain-text Notes (3DT rows
    // append free text) are preserved under _legacyText instead of being clobbered
    // on the next JSON.stringify.
    function parseNotesJson(notesStr) {
        if (!notesStr) return {};
        try {
            const v = JSON.parse(notesStr);
            return v && typeof v === 'object' && !Array.isArray(v)
                ? v
                : { _legacyText: String(notesStr) };
        } catch (_) {
            return { _legacyText: String(notesStr) };
        }
    }

    // =============================================================================
    // SHARE-LINK TOKENS (2026-07-24)
    //
    // Quote IDs are a short sequential counter (STK-2026-001, EMB-2026-314…) and
    // GET /api/public/quote/:id + /api/quote-sessions/:id/full are both anonymous,
    // so anyone could walk the range and read customers' quotes — company, contact,
    // line items and prices.
    //
    // Fix, deliberately BACKWARD-COMPATIBLE (Erik's call 2026-07-24): every quote
    // saved from now on carries an unguessable token in Notes.share_token, and its
    // share link must carry `?k=`. A row WITHOUT a stored token is a pre-existing
    // quote, and is still served without one — so no link already sitting in a
    // customer's inbox breaks. As old quotes age out the exposure closes itself.
    //
    // Staff sessions bypass the check entirely, so reps opening a quote from the
    // dashboard never need the token.
    // =============================================================================
    function mintShareToken() {
        return crypto.randomBytes(16).toString('base64url'); // 22 chars, url-safe
    }

    /**
     * The customer-facing URL for a quote, WITH its share token when it has one.
     *
     * 🔴 Use this everywhere a /quote/ link is handed to a customer — acceptance
     * emails, payment receipts, Stripe return URLs, rep "copy link". Building
     * `${PUBLIC_SITE_ORIGIN}/quote/${id}` by hand sends a tokenised quote a link
     * that 404s, and the customer has no way to tell it apart from a deleted quote.
     * Legacy rows have no token and come back exactly as before.
     */
    function quoteShareUrl(quoteId, sessionOrNotes) {
        const base = `${PUBLIC_SITE_ORIGIN}/quote/${encodeURIComponent(quoteId)}`;
        try {
            const src =
                sessionOrNotes && sessionOrNotes.Notes !== undefined
                    ? sessionOrNotes.Notes
                    : sessionOrNotes;
            const notes = typeof src === 'string' ? JSON.parse(src) : src || {};
            if (notes && notes.share_token)
                return `${base}?k=${encodeURIComponent(notes.share_token)}`;
        } catch (_) {
            /* unparseable → legacy, no token */
        }
        return base;
    }

    /**
     * Returns true when the request may read this session.
     * Legacy rows (no stored token) stay readable — that is the compatibility
     * promise, not an oversight.
     */
    function shareTokenOk(req, session) {
        if (req.session && req.session.crmUser) return true; // staff
        let stored = null;
        try {
            const notes =
                typeof session.Notes === 'string' ? JSON.parse(session.Notes) : session.Notes || {};
            stored = notes && notes.share_token ? String(notes.share_token) : null;
        } catch (_) {
            /* unparseable Notes → treat as legacy */
        }
        if (!stored) return true; // legacy quote

        const supplied = String(req.query.k || '');
        const actual = Buffer.from(supplied);
        const expected = Buffer.from(stored);
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }

    return {
        PUBLIC_SITE_ORIGIN,
        buildOrderStatusUrl,
        computeOrderStatusToken,
        mintShareToken,
        parseNotesJson,
        quoteShareUrl,
        shareTokenOk,
    };
};
