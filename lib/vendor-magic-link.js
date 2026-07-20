'use strict';
/**
 * Vendor portal magic-link auth (subcontractors — first user: Ed Lacey, L&P Screen
 * Printing). Mirrors lib/customer-magic-link.js: two stateless, HMAC-signed credentials:
 *   - LINK token   : short-lived (15 min), emailed to the vendor. Signed with MAGIC_LINK_SECRET.
 *   - SESSION cookie: longer-lived (30 days), set after a verified click. Signed with
 *     SESSION_SECRET, but a PHYSICALLY SEPARATE cookie (nwca_vendor) from both the staff
 *     and customer cookies, with DISTINCT type tags ('vlink'/'vsess') — a customer token
 *     can never be replayed as a vendor session even though the key family is shared.
 *
 * Stateless by design (no token table). The verify ROUTE re-checks the live
 * Vendor_Portal_Access.Enabled flag, so revoking an invite kills any outstanding link
 * immediately — the signature proves integrity, the table proves authorization.
 * The session claim carries the VENDOR NAME (e.g. 'L&P Printing'), which the data
 * endpoints match against Transfer_Orders.SP_Vendor to scope what the vendor may see.
 */
const crypto = require('crypto');

const LINK_TTL_SEC = 15 * 60;
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

function linkSecret() { return process.env.MAGIC_LINK_SECRET || ''; }
function sessionSecret() { return process.env.SESSION_SECRET || ''; }

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
function mintToken({ email, vendorName }) {
  if (!linkSecret()) return null;
  return signPayload({
    e: String(email).toLowerCase().trim(),
    v: String(vendorName),
    x: Math.floor(Date.now() / 1000) + LINK_TTL_SEC,
    n: crypto.randomBytes(8).toString('hex'),
    t: 'vlink',
  }, linkSecret());
}
// Throws if invalid/expired/tampered.
function verifyToken(token) {
  if (!linkSecret()) throw new Error('not configured');
  const obj = verifySigned(token, linkSecret());
  if (obj.t !== 'vlink' || !obj.e || !obj.v) throw new Error('incomplete');
  return { email: obj.e, vendorName: String(obj.v) };
}

// ── Session cookie (longer-lived) ───────────────────────────────────────────
function mintSession({ email, vendorName, contactName }) {
  if (!sessionSecret()) return null;
  return signPayload({
    e: String(email).toLowerCase().trim(),
    v: String(vendorName),
    cn: contactName || '',
    x: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    t: 'vsess',
  }, sessionSecret());
}
// Returns the session object or null (never throws — a bad/absent cookie = logged out).
function verifySession(cookieVal) {
  if (!sessionSecret()) return null;
  try {
    const obj = verifySigned(cookieVal, sessionSecret());
    if (obj.t !== 'vsess' || !obj.e || !obj.v) return null;
    return { email: obj.e, vendorName: String(obj.v), contactName: obj.cn || '' };
  } catch { return null; }
}

module.exports = {
  isConfigured, mintToken, verifyToken, mintSession, verifySession,
  LINK_TTL_MIN: LINK_TTL_SEC / 60,
};
