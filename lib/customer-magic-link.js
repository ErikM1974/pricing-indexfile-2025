'use strict';
/**
 * Customer portal magic-link auth (#6). Two stateless, HMAC-signed credentials:
 *   - LINK token  : short-lived (15 min), emailed to the customer. Signed with MAGIC_LINK_SECRET.
 *   - SESSION cookie: longer-lived (30 days), set after a verified click. Signed with SESSION_SECRET
 *     (same key family as the staff cookie), but a PHYSICALLY SEPARATE cookie (nwca_customer).
 *
 * Stateless by design (no token table): survives dyno restarts, nothing to clean up. The verify
 * ROUTE re-checks the live Customer_Portal_Access.Enabled flag, so revoking an invite kills any
 * outstanding link immediately — the signature proves integrity, the table proves authorization.
 */
const crypto = require('crypto');

const LINK_TTL_SEC = 15 * 60;
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

function linkSecret() { return process.env.MAGIC_LINK_SECRET || ''; }
function sessionSecret() { return process.env.SESSION_SECRET || ''; }

// Configured = both secrets present. Mirrors computeOrderStatusToken's "no secret → no tokens".
function isConfigured() { return Boolean(linkSecret()) && Boolean(sessionSecret()); }

function hmac(payloadStr, secret) {
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
}
function signPayload(obj, secret) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return p + '.' + hmac(p, secret);
}
// Throws on tamper/expiry. Timing-safe signature compare BEFORE decoding the payload.
function verifySigned(token, secret) {
  const [p, sig] = String(token || '').split('.');
  if (!p || !sig) throw new Error('malformed');
  const expected = hmac(p, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('bad signature');
  const obj = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  if (!obj.x || Math.floor(Date.now() / 1000) > Number(obj.x)) throw new Error('expired');
  return obj;
}

// ── Magic-link email token (short-lived) ────────────────────────────────────
function mintToken({ email, idCustomer }) {
  if (!linkSecret()) return null;
  return signPayload({
    e: String(email).toLowerCase().trim(),
    c: String(idCustomer),
    x: Math.floor(Date.now() / 1000) + LINK_TTL_SEC,
    n: crypto.randomBytes(8).toString('hex'),
    t: 'link',
  }, linkSecret());
}
// Throws if invalid/expired/tampered.
function verifyToken(token) {
  if (!linkSecret()) throw new Error('not configured');
  const obj = verifySigned(token, linkSecret());
  if (obj.t !== 'link' || !obj.e || !obj.c) throw new Error('incomplete');
  return { email: obj.e, idCustomer: String(obj.c) };
}

// ── Session cookie (longer-lived) ───────────────────────────────────────────
function mintSession({ email, idCustomer, companyName }) {
  if (!sessionSecret()) return null;
  return signPayload({
    e: String(email).toLowerCase().trim(),
    c: String(idCustomer),
    co: companyName || '',
    x: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    t: 'sess',
  }, sessionSecret());
}
// Returns the session object or null (never throws — a bad/absent cookie = logged out).
function verifySession(cookieVal) {
  if (!sessionSecret()) return null;
  try {
    const obj = verifySigned(cookieVal, sessionSecret());
    if (obj.t !== 'sess' || !obj.e || !obj.c) return null;
    return { email: obj.e, idCustomer: String(obj.c), companyName: obj.co || '' };
  } catch { return null; }
}

module.exports = {
  isConfigured, mintToken, verifyToken, mintSession, verifySession,
  LINK_TTL_MIN: LINK_TTL_SEC / 60,
};
