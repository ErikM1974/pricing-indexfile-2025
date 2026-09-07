// routes/customer-auth.js — Customer magic-link login (email entry, request link, verify, logout)
// Extracted VERBATIM from server.js lines 5505-5582 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, PUBLIC_SITE_ORIGIN, SERVER_DIR, customerLoginLimiter, customerMagicLink, express, fetch, fetchPortalAccess, path, safeLoginNext, sendEmailJSTemplate } = ctx;

// Login page (email entry). Public.
app.get('/customer/login', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-login.html'));
});

// Request a magic link. ALWAYS returns { ok:true } (constant shape) → no account enumeration.
app.post('/auth/customer/request-link', customerLoginLimiter, express.json(), async (req, res) => {
  const ok = () => res.json({ ok: true });
  try {
    if (!customerMagicLink.isConfigured()) { console.warn('[customer-login] MAGIC_LINK_SECRET not configured'); return ok(); }
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok();
    const access = await fetchPortalAccess(email);
    if (!access || !access.enabled || !/^\d+$/.test(String(access.id_Customer))) {
      console.log(`[customer-login] no enabled access for ${email}`);
      return ok();
    }
    const token = customerMagicLink.mintToken({ email, idCustomer: access.id_Customer });
    const nextPath = safeLoginNext(req.body && req.body.next, '/portal');
    const link = `${PUBLIC_SITE_ORIGIN}/auth/customer/verify?token=${encodeURIComponent(token)}` + (nextPath ? `&next=${encodeURIComponent(nextPath)}` : '');
    await sendEmailJSTemplate(CUSTOMER_MAGIC_LINK_TEMPLATE, {
      to_email: email,
      company_name: access.company_name || 'there',
      magic_link: link,
      expiry_minutes: String(customerMagicLink.LINK_TTL_MIN),
    }).catch((e) => console.error('[customer-login] email send failed:', e.message));
    console.log(`[customer-login] link sent to ${email} (customer ${access.id_Customer})`);
    return ok();
  } catch (e) {
    console.error('[customer-login] request-link error:', e.message);
    return ok();
  }
});

// Verify a magic link → live re-check Enabled → set the customer session cookie → /portal.
app.get('/auth/customer/verify', async (req, res) => {
  const fail = () => res.redirect('/customer/login?error=expired');
  try {
    if (!customerMagicLink.isConfigured()) return res.status(503).send('Customer login is temporarily unavailable.');
    let claim;
    try { claim = customerMagicLink.verifyToken(req.query.token); } catch (_) { return fail(); }
    // Re-check the LIVE invite: revoking Enabled kills outstanding links immediately, and
    // re-binds the token's claimed customer id to the table's truth (anti-tamper).
    const access = await fetchPortalAccess(claim.email);
    if (!access || !access.enabled || String(access.id_Customer) !== String(claim.idCustomer)) return fail();
    const sessionToken = customerMagicLink.mintSession({
      email: claim.email, idCustomer: access.id_Customer, companyName: access.company_name || '',
    });
    res.cookie('nwca_customer', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    // Best-effort LastLogin stamp — never blocks the login. Until 2026-09-05 nothing wrote this,
    // so the Customer Portals console showed "Have Signed In: 0 / Never" for every customer.
    if (CRM_API_SECRET) {
      fetch(`${CRM_API_BASE}/api/customer-portal-access/touch-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
        body: JSON.stringify({ email: claim.email }),
      }).catch((e) => console.warn('[customer-login] touch-login failed:', e.message));
    }
    const next = safeLoginNext(req.query.next, '/portal') || '/portal';
    return res.redirect(next);
  } catch (e) {
    console.error('[customer-login] verify error:', e.message);
    return fail();
  }
});

// Logout — clear the customer cookie.
app.get('/auth/customer/logout', (req, res) => {
  res.clearCookie('nwca_customer');
  return res.redirect('/customer/login');
});

};
