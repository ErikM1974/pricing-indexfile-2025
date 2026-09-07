// routes/staff-saml.js — Staff SAML SSO — server-verified login (Caspio Staff directory = IdP) + staff page gates
// Extracted VERBATIM from server.js lines 3280-3426 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { PORTAL_ADMIN_ROLES, SERVER_DIR, express, fetchStaffRole, path, requireCrmEmail, requireCrmRole, staffSaml } = ctx;

// =============================================================================
// Staff SAML SSO (#2) — server-VERIFIED login (Caspio "Staff" directory = IdP)
// =============================================================================
// ADDITIVE: these routes add a login the SERVER can verify. They do NOT yet
// change dashboard gating or remove the forgeable /api/crm-session — that flip
// happens only after a real login is confirmed end-to-end on production.
// Fails safe: returns 503 until the SAML_* env vars are configured.

// SP-initiated start — redirect the browser to Caspio to authenticate.
app.get('/auth/saml/login', async (req, res) => {
  if (!staffSaml.isConfigured()) return res.status(503).send('Staff SSO is not configured yet.');
  try {
    // Only a genuine same-origin path: starts with '/' but NOT '//' or '/\' (which
    // browsers treat as protocol-relative → an open-redirect to an external host).
    const next = (typeof req.query.next === 'string' && /^\/(?![/\\])/.test(req.query.next)) ? req.query.next : '/staff-dashboard.html';
    res.redirect(await staffSaml.getLoginUrl(next));
  } catch (e) {
    console.error('[SAML] login init failed:', e.message);
    res.status(500).send('Could not start sign-in. Please try again.');
  }
});

// Assertion Consumer Service — Caspio POSTs the SIGNED assertion here. We verify
// Caspio's signature + audience + timestamps, then establish the staff session.
app.post('/auth/saml/acs', express.urlencoded({ extended: false, limit: '1mb' }), async (req, res) => {
  if (!staffSaml.isConfigured()) return res.status(503).send('Staff SSO is not configured yet.');
  try {
    const identity = await staffSaml.verifyResponse(req.body.SAMLResponse);
    // Role-of-record now lives in Caspio (Staff_App_Roles table); fetch it server-side
    // and derive permissions. Fail-safe: a lookup error yields no elevated permissions
    // (deny, never grant wrong access) — the user can re-login once it recovers.
    const role = await fetchStaffRole(identity.email);
    const permissions = staffSaml.permissionsFromRole(role, identity.email);
    // cookie-session: the signed cookie IS the session — there is no server-side
    // session id to regenerate. Fixation doesn't apply: the cookie only ever holds
    // what we set here, AFTER verifying Caspio's signed assertion. Reset then set.
    req.session = null;
    req.session = {
      crmUser: {
        name: identity.name,
        email: identity.email,
        firstName: (identity.name || '').split(' ')[0],
        role: role || null,
        permissions,
        via: 'saml',
      },
    };
    // Same-origin only — reject protocol-relative '//host' / '/\host' open-redirects.
    let relay = (typeof req.body.RelayState === 'string' && /^\/(?![/\\])/.test(req.body.RelayState)) ? req.body.RelayState : '/staff-dashboard.html';
    // AE landing (2026-07-19): when an AE logs in WITHOUT a specific destination
    // (relay is still the generic default), land them on their Mission Control
    // instead of the staff dashboard. Explicit ?next= deep links are untouched,
    // and admins (who also hold the rep permissions) keep the staff dashboard.
    if (relay === '/staff-dashboard.html' && !permissions.includes('admin')
        && (permissions.includes('taneisha') || permissions.includes('nika'))) {
      relay = '/dashboards/ae-mission-control.html';
    }
    res.redirect(relay); // cookie-session writes the Set-Cookie automatically
  } catch (e) {
    console.error('[SAML] ACS verify failed:', e.message);
    res.status(401).send('Sign-in could not be verified. Please try again or contact IT.');
  }
});

// Logout — clear our session (cookie-session: null the cookie).
app.get('/auth/saml/logout', (req, res) => {
  req.session = null;
  res.redirect('/dashboards/staff-login.html');
});

// Protected CRM dashboard routes (MUST be before static middleware)
// Each dashboard requires specific role permission via Caspio authentication
app.get('/dashboards/taneisha-crm.html', requireCrmRole(['taneisha']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'taneisha-crm.html'));
});
app.get('/dashboards/nika-crm.html', requireCrmRole(['nika']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'nika-crm.html'));
});
// AE Mission Control — the per-AE cockpit. Hard code gate (like the rep CRM pages)
// because the page surfaces the rep's commission dollars; admin passes automatically
// (admin permissions include 'taneisha' + 'nika' via permissionsFromRole).
app.get('/dashboards/ae-mission-control.html', requireCrmRole(['taneisha', 'nika', 'ruth']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'ae-mission-control.html'));
});
app.get('/dashboards/house-accounts.html', requireCrmRole(['house']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'house-accounts.html'));
});
// Access-Admin control panel — ADMIN ONLY (hard code gate, not just the table, since
// this page edits the RBAC tables themselves). Registered before the /dashboards mount.
app.get('/dashboards/access-admin.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'access-admin.html'));
});

// Caspio REST API v4 reference viewer — ERIK ONLY (hard email gate). Locked to Erik's
// email so it stays private even if someone else is later granted the 'admin' role; the
// Staff_Page_Access admin-override does NOT apply to this explicit route. Registered
// before the /dashboards mount so it intercepts ahead of gateStaffHtml + static.
app.get('/dashboards/caspio-api-reference.html', requireCrmEmail(['erik@nwcustomapparel.com']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'caspio-api-reference.html'));
});

// Caspio table-usage audit — ADMIN ONLY (hard role gate, like access-admin). A cleanup
// tool: 163 tables + which are used (code/view/rel/task/webhook) so Erik can archive
// stale ones. Registered before the /dashboards mount.
app.get('/dashboards/table-usage-audit.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'table-usage-audit.html'));
});

// ManageOrders / OnSite API field cheat sheet — ADMIN ONLY. Static reference of the
// push/pull fields (from the public Swagger + our tested reference). Before the mount.
app.get('/dashboards/manageorders-api-reference.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'manageorders-api-reference.html'));
});

// SanMar Web Services (SOAP) cheat sheet — ADMIN ONLY. Static reference from the
// Integration Guide v24.5 + memory/SANMAR_API_REFERENCE.md. Before the mount.
app.get('/dashboards/sanmar-api-reference.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'sanmar-api-reference.html'));
});

// SanMar FTP Downloads — ADMIN ONLY. Lists the data files SanMar publishes on their FTP
// (ftp.sanmar.com, user 6920) and streams the chosen one to the browser — the web version
// of the FileZilla step. The primary file, SanMarPI-Bulk-*.csv, is imported into the Caspio
// product master Sanmar_Bulk_251816_Feb2024 (the table every quote builder prices from).
// Backed by /api/staff/sanmar-ftp/{list,download}. Before the /dashboards static mount.
app.get('/dashboards/sanmar-ftp-integration.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'sanmar-ftp-integration.html'));
});

// SanMar → ShopWorks Parts converter — ADMIN ONLY. Client-side tool: upload a SanMar
// price list (ShopWorks integration list OR raw feed), it converts to a ShopWorks Parts
// import CSV (adds sizes to descriptions, _2XL→_2X, size flags). Before the /dashboards mount.
app.get('/dashboards/sanmar-shopworks-converter.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'sanmar-shopworks-converter.html'));
});

// ShopWorks OnSite ODBC reference — ERIK ONLY (hard email gate, like caspio-api-reference):
// the page displays the ODBC connection card (LAN server + read-only credentials), the
// FileMaker query rules, and the 2,630-field Data_ODBCMapping catalog. Before the mount.
app.get('/dashboards/shopworks-odbc-reference.html', requireCrmEmail(['erik@nwcustomapparel.com']), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'shopworks-odbc-reference.html'));
});

app.get('/dashboards/customer-portal-admin.html', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'customer-portal-admin.html'));
});

};
