// routes/crm-auth.js — CRM dashboard authentication (Caspio-based session)
// Extracted VERBATIM from server.js lines 3233-3279 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { express } = ctx;

// =============================================================================
// CRM DASHBOARD AUTHENTICATION ROUTES (Caspio-based)
// =============================================================================

// Endpoint to establish CRM session after Caspio login
// Called from staff-login.html after user authenticates with Caspio
app.post('/api/crm-session', express.json(), (req, res) => {
  // SSO-ONLY (#2 flip, 2026-06-29): we NO LONGER mint a session from a client-
  // posted name — that was forgeable (a bare POST {"name":"Erik"} minted full
  // admin). Identity now comes ONLY from a verified Caspio SAML login
  // (/auth/saml/acs). Echo the existing verified session if present; else require SSO.
  if (req.session && req.session.crmUser) {
    const u = req.session.crmUser;
    return res.json({ success: true, permissions: u.permissions || [], firstName: u.firstName });
  }
  return res.status(401).json({ error: 'Sign in required', loginUrl: '/auth/saml/login' });
});

// GET current CRM session — used by Policies Hub admin gate and any
// frontend that needs to render role-conditional UI without a full login flow.
// Returns 200 with user info when authenticated, 200 with anonymous shape when not.
app.get('/api/crm-session/me', (req, res) => {
  if (!req.session?.crmUser) {
    return res.json({
      authenticated: false,
      permissions: [],
      firstName: '',
      email: ''
    });
  }
  const u = req.session.crmUser;
  res.json({
    authenticated: true,
    name: u.name,
    firstName: u.firstName,
    email: u.email || '',
    role: u.role || '',
    permissions: u.permissions || []
  });
});

// Logout endpoint - clears CRM session
app.get('/crm-logout', (req, res) => {
  req.session = null; // cookie-session: clear the staff cookie
  res.redirect('/dashboards/staff-login.html');
});

};
