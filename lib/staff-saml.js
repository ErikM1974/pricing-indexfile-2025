/**
 * Staff SAML SSO (#2) — our app is the SAML Service Provider; the Caspio "Staff"
 * directory App Connection is the Identity Provider. Staff sign in with their
 * existing Caspio login; Caspio POSTs a SIGNED assertion to our ACS endpoint;
 * we verify Caspio's signature (against the IdP cert) + audience + timestamps,
 * then trust the email it carries. This replaces the forgeable
 * "browser tells the server who it is" /api/crm-session path.
 *
 * Fails SAFE: if the SAML_* env vars aren't set, isConfigured() is false and the
 * /auth/saml/* routes return 503 — the app still boots and existing flows work.
 * Mirrors the fail-closed precedent of computeOrderStatusToken (server.js).
 *
 * Config (Heroku config vars on sanmar-inventory-app):
 *   SAML_IDP_SSO_URL   — Caspio Single sign-on URL (entryPoint)
 *   SAML_IDP_ISSUER    — Caspio Identity provider identifier (extra audience check)
 *   SAML_IDP_CERT      — Caspio's signing certificate (PEM) — verifies the assertion
 *   SAML_SP_PRIVATE_KEY— our SP private key (PEM) — signs our AuthnRequests
 *   SAML_SP_ENTITY_ID  — our SP entity id (default below; must match Caspio)
 *   SAML_SP_ACS_URL    — our ACS reply URL (default below; must match Caspio)
 * PEMs may use literal "\n" (Heroku-friendly); we normalize them.
 */
'use strict';

const { SAML } = require('@node-saml/node-saml');

const SP_ENTITY_ID = process.env.SAML_SP_ENTITY_ID || 'https://www.teamnwca.com/auth/saml/metadata';
const SP_ACS_URL = process.env.SAML_SP_ACS_URL || 'https://www.teamnwca.com/auth/saml/acs';

// Heroku config vars can't hold real newlines easily — accept literal "\n".
function pem(v) { return v ? String(v).replace(/\\n/g, '\n').trim() : ''; }

const IDP_SSO_URL = process.env.SAML_IDP_SSO_URL || '';
const IDP_ISSUER = process.env.SAML_IDP_ISSUER || '';
const IDP_CERT = pem(process.env.SAML_IDP_CERT);
const SP_PRIVATE_KEY = pem(process.env.SAML_SP_PRIVATE_KEY);

function isConfigured() {
  return Boolean(IDP_SSO_URL && IDP_CERT);
}

let _saml = null;
function getSaml() {
  if (!isConfigured()) return null;
  if (_saml) return _saml;
  _saml = new SAML({
    // --- where staff get sent to log in ---
    entryPoint: IDP_SSO_URL,
    // --- who WE are (must match the Caspio App Connection) ---
    issuer: SP_ENTITY_ID,
    callbackUrl: SP_ACS_URL,
    // --- the security-critical bits ---
    idpCert: IDP_CERT,            // verify Caspio's signature on the response
    audience: SP_ENTITY_ID,       // the assertion must be addressed to us
    // Caspio signs the RESPONSE wrapper (which envelopes + protects the assertion),
    // not the inner assertion — confirmed via the assertion structure 2026-06-29.
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: true, // require + verify the response-level signature
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    acceptedClockSkewMs: 5000,    // small tolerance for clock drift
    // sign our AuthnRequests when we have a key (defense-in-depth; optional to Caspio)
    privateKey: SP_PRIVATE_KEY || undefined,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    disableRequestedAuthnContext: true,
  });
  return _saml;
}

/** Build the redirect URL that starts a login at Caspio (SP-initiated). */
async function getLoginUrl(relayState) {
  const saml = getSaml();
  if (!saml) throw new Error('SAML not configured');
  return saml.getAuthorizeUrlAsync(relayState || '', undefined, {});
}

/**
 * Verify a SAML Response posted to the ACS endpoint. Returns the verified
 * identity { email, name, issuer } or throws. Extra defense: confirm the
 * asserting issuer matches our configured Caspio IdP issuer.
 */
async function verifyResponse(samlResponseB64) {
  const saml = getSaml();
  if (!saml) throw new Error('SAML not configured');
  const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponseB64 });
  if (!profile) throw new Error('No SAML profile');
  if (IDP_ISSUER && profile.issuer && profile.issuer !== IDP_ISSUER) {
    throw new Error('SAML issuer mismatch');
  }
  const email = String(
    profile.email || profile.nameID || (profile.attributes && (profile.attributes.email || profile.attributes.Email)) || ''
  ).toLowerCase().trim();
  if (!email) throw new Error('No email in SAML assertion');
  const a = profile.attributes || {};
  const name = STAFF_NAMES[email] || a.Full_Name || a.full_name ||
    [a.First_Name || a.first_name || '', a.Last_Name || a.last_name || ''].join(' ').trim() ||
    profile.nameID || email;
  return { email, name: String(name).trim(), issuer: profile.issuer, raw: profile };
}

// --- Display names (Caspio's assertion sends only the email as NameID). Kept as a
// small map here; could move to a Caspio Directory lookup later, but names rarely
// change. ROLES are now Caspio-managed via the Staff_App_Roles table (fetched at
// login) → see permissionsFromRole below; no more hardcoded permission map. ---
const STAFF_NAMES = {
  'adriyella@nwcustomapparel.com': 'Adriyella Trujillo',
  'art@nwcustomapparel.com': 'Steve Deland',
  'bradley@nwcustomapparel.com': 'Bradley Wright',
  'brian.beardsley@nwcustomapparel.com': 'Brian Beardsley',
  'erik@nwcustomapparel.com': 'Erik Mickelson',
  'jim@nwcustomapparel.com': 'Jim Mickelson',
  'mikalah@nwcustomapparel.com': 'Mikalah Hede',
  'nika@nwcustomapparel.com': 'Nika Lao',
  'ruth@nwcustomapparel.com': 'Ruth Nhoung',
  'taneisha@nwcustomapparel.com': 'Taneisha Clark',
  'taylar@nwcustomapparel.com': 'Taylar Hanson',
};
// Per-rep dashboard access is keyed by IDENTITY (email) — preserved from the old map
// so the existing requireCrmRole(['taneisha'|'nika']) gates keep working regardless of
// the rep's broader role.
const REP_PERMISSION_BY_EMAIL = {
  'taneisha@nwcustomapparel.com': 'taneisha',
  'nika@nwcustomapparel.com': 'nika',
};

// Derive the app permission set from the Caspio-managed Role (Staff_App_Roles table,
// fetched at login) + identity. Roles: admin | accountant | sales | art | shipping |
// production (or null = basic staff). Replaces the old hardcoded email→permissions map
// — change a role in the Caspio table and it takes effect on next login, no deploy.
function permissionsFromRole(role, email) {
  const r = String(role || '').toLowerCase().trim();
  const e = String(email || '').toLowerCase().trim();
  const perms = new Set();
  if (r) perms.add(r);                       // the role tag itself (admin/accountant/…)
  if (r === 'admin') {
    // Full access: every existing permission string + the financial tier.
    ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'].forEach(p => perms.add(p));
  }
  if (REP_PERMISSION_BY_EMAIL[e]) perms.add(REP_PERMISSION_BY_EMAIL[e]); // own dashboard
  return [...perms];
}

module.exports = {
  isConfigured,
  getLoginUrl,
  verifyResponse,
  permissionsFromRole,
  SP_ENTITY_ID,
  SP_ACS_URL,
};
