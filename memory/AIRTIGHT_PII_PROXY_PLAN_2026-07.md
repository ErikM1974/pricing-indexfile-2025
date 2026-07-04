# Airtight PII proxy — rollout plan (2026-07-04)

## ✅ ManageOrders reads are now SECRET-ONLY (2026-07-04, proxy v878)
The origin-spoof residual on order/lineitem PII is CLOSED. `app.use('/api/manageorders/{orders,lineitems}', guardReadsOnly(requireCrmApiSecret))` (proxy server.js:629-630). Verified live: spoofed-Origin read → 401 (was 200), bare anon → 401, public endpoints → 200, artrequests (still secret-or-origin) → 200. Decision basis: the authed `/api/mo` forwarder path is proven-by-analogy to the working `/staff-dashboard.html` (both `requireStaff` + the GLOBAL `cookieSession` at server.js:475, so `req.session.crmUser` is populated on every same-origin request incl. XHRs). Instant rollback if staff report missing order data: `heroku releases:rollback --app caspio-pricing-proxy`.

**Known accepted behavior change (was a LEAK, now correct):** a session-less viewer opening an art email link (`/art-request/:id?view=ae`, an UNGATED route) previously saw ShopWorks order/invoice data via the origin fallback — i.e. order PII leaked to anyone with the link. Post-flip the Invoice Audit panel there shows empty until they log in. The core art review/approve actions on that email link do NOT touch orders, so they're unaffected; only the secondary order panel requires auth now. (Adversarial workflow skeptic-A, 2026-07-04.)

**Still on secret-OR-origin (residual remains — DEFERRED as a supervised effort):** `/api/artrequests` GET, `/api/mockups` GET, `/api/ups-tracking`.
- The review FINDING itself ("art/mockup rows served **anonymously**") is CLOSED: anonymous reads → 401 (verified 2026-07-04). What remains is only the origin-spoof residual (a targeted attacker spoofing an allowlisted Origin), on INTERNAL art data (Art_Minutes, Amount_Art_Billed, AE/artist notes, Box_Folder_ID) — not customer financial PII.
- Full closure = the same repoint-then-flip as manageorders, but artrequests is called from **92+ browser sites across 14 files** (art-hub-steve/ae/ruth, mockup-detail/ae/ruth, art-request-detail, submit forms, ae-dashboard, portal-directory, art-invoice-service…) vs. 8 for manageorders. That is a large, high-breakage-risk repoint of the art team's daily tools that must NOT be done blind — it needs a browser-tested, supervised session (repoint a cluster → verify each art page loads → next cluster → adversarial customer-view check → flip). Deliberately NOT attempted headlessly.
- Interim option if desired: narrow the PII-route origin allowlist to exact teamnwca.com/www + the NWCA app origins (drop the broad `*.herokuapp.com`/`*.caspio.com` wildcards) — marginal, still spoofable, but shrinks the surface without the repoint.

## Progress (2026-07-04)
- ✅ **ManageOrders forwarders built + deployed-safe.** `/api/mo/{orders,orders/:no,lineitems/:no}`
  in `server.js` (`moForwardTo`, `requireStaff`, forwards with the CRM secret). Client helper
  `shared_components/js/mo-fetch.js` (`window.moFetch`) tries the forwarder first and FALLS BACK
  to the direct proxy on 401/non-2xx/network — so no page can break. Unit-tested
  (`tests/unit/mo-fetch.test.js`).
- ✅ **Repointed the manageorders `orders`/`lineitems` reads** in art-hub-steve, art-hub-ae,
  mockup-detail, mockup-ruth, art-request-detail (+ `mo-fetch.js` script on their 5 host pages).
  `customers` calls left on the proxy (not PII-gated). The `?view=customer` art-detail branch is
  safe via the fallback (forwarder 401s → proxy, which the customer's allowlisted-Origin browser
  reaches).
- ⏳ **REMAINING to make it airtight:** (1) repoint the same-pattern callers for `/api/artrequests`
  GET and `/api/mockups` GET (more sites; add customer-scoped forwarders where a customer view reads
  them); (2) build the customer-session forwarder `/api/portal/mo/*` if we want to remove the
  fallback for the art-detail customer branch; (3) **flip the proxy PII gate** from
  `requireCrmSecretOrBrowserOrigin` → `requireCrmApiSecret` — ONLY after browser-verifying every
  repointed staff tool + the customer proof view. That flip is the step that removes the
  origin-spoof residual. Until then the origin-or-secret gate stays as the live protection.

## Browser verification checklist (before the gate flip)
Log in as staff and confirm order/lineitem data still renders on: art-hub-steve, ae-dashboard
(art-hub-ae), mockup-detail, art-hub-ruth (mockup-ruth), art-request-detail (staff view). Then open
art-request-detail `?view=customer` via a real magic link and confirm order history still shows.
Logged-out `curl /api/mo/orders?id_Customer=1` must return 401.

---

**Original status (superseded above):** PLANNED, not built. The live mitigation (`requireCrmSecretOrBrowserOrigin`,
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
