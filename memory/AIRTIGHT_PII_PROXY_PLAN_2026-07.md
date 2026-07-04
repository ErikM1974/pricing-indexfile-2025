# Airtight PII proxy — rollout plan (2026-07-04)

**Status:** PLANNED, not built. The live mitigation (`requireCrmSecretOrBrowserOrigin`,
GET-only, deployed proxy v877) already blocks anonymous enumeration — verified in prod:
anon PII read → 401, allowlisted-Origin → 200, public endpoints → 200. This plan closes
the **residual**: a request that *spoofs* an allowlisted `Origin` still passes, because a
browser can't hold the server secret. The only way to remove that residual without
breaking staff tools is to route browser reads through an authenticated same-origin app
endpoint, then flip the proxy gate to **secret-only**.

## Why it wasn't done blind
Repointing the browser callers needs **browser verification of SAML-session XHRs** (can't
run headlessly), AND there is a **staff-vs-customer nuance** that a naive repoint gets wrong:

- `pages/js/art-request-detail.js` calls `/api/manageorders/*` in BOTH staff mode AND the
  customer-facing `?view=customer` proof view (reached by customers via magic link, **no
  staff session**). Routing every call through a `requireStaff` gate would **401 the
  customer proof page**. Same risk anywhere a customer-reachable page reads orders.

So each call site must be classified **staff** vs **customer** and routed to the matching
authenticated forwarder. That classification + testing is the actual work.

## The design
Add two same-origin authenticated forwarders in the main app (`server.js`), each gates on
its own session and forwards to the proxy **with the CRM secret**:

```js
// Staff-authed forwarder (req.session.crmUser via SAML — requireStaff already exists, :585)
app.get('/api/mo/orders',        requireStaff, moForward);   // ?id_Customer / date range
app.get('/api/mo/orders/:no',    requireStaff, moForward);
app.get('/api/mo/lineitems/:no', requireStaff, moForward);
// Customer-authed forwarder (req.customerSession via magic-link — requireCustomer exists)
//   scope to the LOGGED-IN customer's own id_Customer only (server-derived, never from the
//   client) so it can't become a new IDOR. Orders-by-order-number must verify ownership.
app.get('/api/portal/mo/*', requireCustomer, moForwardScopedToSession);

function moForward(req, res){ /* fetch(CRM_API_BASE + mapped path, {headers:{'X-CRM-API-Secret':CRM_API_SECRET}}) → pipe */ }
```

Then repoint the browser callers from `API_BASE + '/api/manageorders/...'` (proxy) to the
same-origin `/api/mo/...` (staff pages) or `/api/portal/mo/...` (customer views).

### Caller inventory to repoint (grep `manageorders/(orders|lineitems)`)
STAFF pages → `/api/mo/*`:
- `pages/js/art-request-detail.js` (staff-mode branches only — see nuance below)
- `pages/js/mockup-detail.js`, `shared_components/js/mockup-ruth.js`
- `shared_components/js/art-hub-steve.js`, `shared_components/js/art-hub-ae.js`
- `shared_components/js/monogram-form-service.js`, `work-order-picker.js`
- `shared_components/js/staff-dashboard/*` (shopworks-service, dashboard-fetch)

CUSTOMER-reachable → `/api/portal/mo/*` (session-scoped, ownership-checked):
- `pages/js/art-request-detail.js` `?view=customer` branch (order-history display)
- Any portal page reading orders (portal already uses server-side `/api/portal/orders` — good)

Same treatment for `/api/artrequests` GET and `/api/mockups` GET (more callers; the art
dashboards + the customer proof view both read them).

### Final step — flip the proxy gate to secret-only
After ALL browser callers are repointed and verified, change the proxy from
`requireCrmSecretOrBrowserOrigin` → `requireCrmApiSecret` on the PII reads. Now nothing but
a secret-bearing server-to-server caller can read them; the origin-spoof residual is gone.

## Rollout order (no breakage window — mirrors LESSONS "deploy caller secret BEFORE flipping gate")
1. Deploy main app with the new `/api/mo/*` + `/api/portal/mo/*` forwarders (additive, unused).
2. Repoint browser callers → deploy → **browser-verify every staff tool + the customer proof
   view** (art detail staff + `?view=customer`, mockup detail, art hubs, order lookups, monogram).
3. Only once all verified: flip the proxy PII gate to secret-only, deploy proxy, re-verify.

## Test hooks
- Unit: forwarder maps path + injects secret; customer forwarder rejects a mismatched
  `id_Customer` (IDOR guard).
- Manual: each repointed page loads its order/art data while logged in; a logged-OUT
  request to `/api/mo/orders` → 401; the customer proof view still shows order history.
