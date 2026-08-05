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

// ── Proof-image capability token (#6, added 2026-08-05) ─────────────────────
// The portal shows Box artwork whose stored URLs point at the proxy's
// /api/box/thumbnail/<fileId>. That route is requireStaff, so a CUSTOMER's <img>
// 401s and every proof renders broken.
//
// We cannot simply let a customer call it with a fileId — that would hand every
// customer read access to any Box file in the enterprise by id. Instead the
// server mints one of these tokens ONLY while projecting data it has already
// authorized as belonging to that customer, and the image route accepts nothing
// else. The customer never sees or supplies a Box file id, so there is no id to
// enumerate.
//
// Bound to a single fileId + customer and short-lived. Deliberately NOT
// session-gated on its own: /mockup/:id and /art-request/:designId are public
// email-link pages for customers who are not logged in, and their images have to
// render there too — the same seam resolvePortalCustomer already allows for the
// DATA. When a session IS present the route additionally requires it to match,
// so a token cannot be replayed into another logged-in customer's browser.
const PROOF_TTL_SEC = 12 * 60 * 60;

function mintProofToken({ fileId, idCustomer }) {
  if (!sessionSecret()) return null;
  if (!/^\d+$/.test(String(fileId))) return null;
  return signPayload({
    f: String(fileId),
    c: String(idCustomer),
    x: Math.floor(Date.now() / 1000) + PROOF_TTL_SEC,
    t: 'proof',
  }, sessionSecret());
}
// Returns { fileId, idCustomer } or null (never throws — a bad token is just a 404).
function verifyProofToken(token) {
  if (!sessionSecret()) return null;
  try {
    const obj = verifySigned(token, sessionSecret());
    if (obj.t !== 'proof' || !obj.f || !obj.c) return null;
    if (!/^\d+$/.test(String(obj.f))) return null;
    return { fileId: String(obj.f), idCustomer: String(obj.c) };
  } catch { return null; }
}

module.exports = {
  isConfigured, mintToken, verifyToken, mintSession, verifySession,
  mintProofToken, verifyProofToken,
  LINK_TTL_MIN: LINK_TTL_SEC / 60,
  PROOF_TTL_SEC,
};
