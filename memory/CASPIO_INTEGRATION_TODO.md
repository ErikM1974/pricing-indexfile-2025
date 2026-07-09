# Caspio Integration — Build To-Do & Session Resume

> **STATUS: PAUSED 2026-06-30 (Erik laptop off).** Durable resume point — the harness task list does NOT survive a restart, so THIS file is canonical. Reference → [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md). **Everything committed + pushed to GitHub (origin) + deployed where noted; nothing lost.**
>
> **DONE & LIVE:** ✅ #1 portal data-min · ✅ #2 staff SAML SSO (v1477) · ✅ SESSION_SECRET fail-closed guard · ✅ **#8 durable sessions = cookie-session** (FE `dd2fb1e5`) · 🟢 **#9 Phase 1 COMPLETE (non-Inksoft)** — 5 batches gated (proxy v851–v855 + FE): customer-profile/industry-lookalikes, daily-sales writes, pricing/service-code writes + files DELETE, admin-products/orders/thumbnails, shipstation. → [PROXY_SIDE_DOOR_AUDIT_2026-06.md](PROXY_SIDE_DOOR_AUDIT_2026-06.md) · ✅ #5 on-demand task triggers · ✅ #9 Phase-5 digitized-designs/lookup trim · ⚠️ #3 webhook premise UNSOUND (reframe→#4) · ✅✅ **CASPIO-DRIVEN RBAC** (FE `74741ad9`): roles via **`Staff_App_Roles`** table (`permissionsFromRole()` at login; admin/accountant/sales/art/shipping/production/staff) + page-access via **`Staff_Page_Access`** table (table-driven `/dashboards` gate, admin override, unlisted=any-staff). **Erik manages both tables in Caspio = NO deploy.** Detail → [STAFF_AUTH_DESIGN.md](STAFF_AUTH_DESIGN.md). NOTE: Caspio dir Role field is auth-locked + Groups not REST-readable → that's why it's TABLES not the directory. Adriyella+Taylar removed from Staff group (verify also gone from dir Users).
>
> **✅ Access-Admin UI MERGED + DEPLOYED + LIVE** (PRs #7 FE / #2 proxy both merged 2026-06-30; proxy `fafd88e`, FE `4b740179`). Erik-only **`/dashboards/access-admin.html`** (two panels: Staff Roles + Page Access) — edits `Staff_App_Roles` + `Staff_Page_Access` via admin-gated `/api/crm-proxy/admin-rbac/*` → proxy `/api/admin-rbac/{roles,pages}` CRUD. Linked from the staff dashboard **Administration** section. Verified: endpoints live (anon 401), page admin-gated (anon 302), assets load. Erik's E2E UI test pending (log in as admin → edit a role/page). **So the WHOLE RBAC system is now self-service + has a UI.**
>
> **THEN / NEXT:** #9 **Inksoft round** (creditcard/gift-certs/commissions — needs Python Inksoft edits + `CRM_API_SECRET` on `inksoft-transform`; gate financials to admin+accountant via the new roles) + **Phase 3 browser-staff Pattern-B** (company-contacts, AI chats, push-quote, art-hub — now cleaner with roles; restrict via `Staff_Page_Access` + crm-proxy). **#4** = sound first Caspio webhook (ArtRequests). Then #6/#7 customer login. Rollback = `heroku releases:rollback -a <app>`. ✅ **Branch hygiene RECONCILED 2026-06-30:** both repos now have `develop = main = deploy-branch = origin = heroku` (FE `82c305f5`; proxy `b2d55b8`). Proxy reconcile MERGED 4 previously-stranded UPS-tracking commits (live delivery dates / Quantum View / SanMar inbound ETAs) that were on main/develop but never deployed — now LIVE. (Proxy still uses `deploy/send-to-steve` as its deploy branch, but all three branches are aligned.)

## Already DONE this session (don't redo)
- Pulled + parsed the full Caspio REST v3 spec (70 ops / 7 groups). Wrote **CASPIO_REST_API_REFERENCE.md** + dated snapshot `caspio-swagger-snapshot-2026-06-29.json`; wired pointers into this repo's INDEX.md + CLAUDE.md, and the proxy's CLAUDE.md. Committed (`develop`: docs commits incl. `7524c727`).
- Wrote + RAN a read-only **entitlement probe** (`caspio-pricing-proxy/scripts/caspio-entitlement-probe.js`). Result: **all 7 groups AVAILABLE** on the plan. Live inventory: **24 outgoing webhooks (all Zapier)**, **6 import/export tasks**, **1 "Staff" directory (11 users)**, **14 bridge apps**. (Probe committed in proxy on branch `deploy/send-to-steve`.)
- Key verified fact: **Caspio Outgoing Webhooks fire on REST writes** (`EventSources` defaults to all incl `RESTAPIs`) — unlike Triggered Actions. This underpins #3/#4.

## The build list (current status — harness tasks #1–#9 mirror this)
| # | Item | Status |
|---|---|---|
| 1 | Customer-portal data-minimization (gated `/api/portal/*` allowlist projections) | ✅ **DONE & LIVE** (v1473+) → CASPIO_PORTAL_DESIGN.md |
| 2 | Staff-dashboard auth — Caspio SAML SSO (killed forgeable `/api/crm-session`) | ✅ **DONE & LIVE** (v1477) → STAFF_AUTH_DESIGN.md |
| 3 | Caspio webhook receiver — **REFRAMED** (premise unsound: can't replace ShopWorks poll) | ⚠️ blocked/reframe → see note below |
| 4 | ArtRequests.Status webhook notifications (data-coupled) | ⏳ pending — the SOUND first webhook (needs #3 receiver) |
| 5 | On-demand Caspio task triggers (`/api/caspio-tasks` list/status/run, gated) | ✅ **DONE & LIVE** (proxy `13dc8ae`) |
| 6 | Phase-2 authenticated customer portal (magic-link login) | ⏳ pending (builds on #1) |
| 7 | Gate customer-portal WRITE actions (approve/revise/rush/upload) | ⏳ pending |
| 8 | Durable sessions — **cookie-session** (NOT Redis; free, no add-on); fixes logout-on-deploy | ✅ **DONE & LIVE** (FE `dd2fb1e5`) |
| 9 | Gate the public proxy staff-data endpoints (side-door) — **AUDITED 2026-06-29: 98 HIGH/CRITICAL open endpoints, ~5 CRITICAL anonymous money/data holes** | 🔴 plan ready → [PROXY_SIDE_DOOR_AUDIT_2026-06.md](PROXY_SIDE_DOOR_AUDIT_2026-06.md) |
| 10 | **Read-only Caspio SCHEMA introspection endpoint** (OPEN/no-token — lets tooling + Claude enumerate all tables/views/apps/webhooks + any table's fields via the proxy's standing creds, so no per-session bearer handoff) | 🟡 **code-ready 2026-07-09; awaiting proxy-repo SYNC to place+mount+deploy** → §#10 below |

### #10 — Caspio SCHEMA introspection endpoint (no-token standing access) — NEW 2026-07-09
**Why:** Erik doesn't want to hand Claude a bearer token every session, but wants Claude to be able to "look at Swagger / all tables + assets." Claude can't safely hold the account's master OAuth credential; the secure equivalent is to **go through the proxy** (which already holds `CASPIO_CLIENT_ID/SECRET` server-side + auto-refreshes). Claude already reads Caspio *data* via existing public proxy routes; the only gap is a **general schema-introspection** route so Claude can enumerate ANY table's fields on demand. **Decision (Erik 2026-07-09): OPEN — no auth gate.** Kept SCHEMA-ONLY (structure/field names + types), never bulk row data, so open exposure stays low.

**Uses Caspio REST v4** `/v4/schemas/*` + `/v4/tables/*` (the proxy's existing OAuth token works on `/v4` — same account OAuth; verified by the 2026-07-09 authenticated crawl). Endpoints:
```
GET /api/caspio-schema/tables               → [{name, tableId, fieldCount, description}]  (163 today)
GET /api/caspio-schema/tables/:name/fields  → [{name, dataType, editable, unique, isFormula}]
GET /api/caspio-schema/views                → [name]
GET /api/caspio-schema/webhooks             → [{name, status, events:[{object,type,sources}]}]
GET /api/caspio-schema/apps                 → {bridge:[name], flex:[name]}
GET /api/caspio-schema/full                 → whole data-dictionary in ONE call (/v4/schemas/tables: fields+relationships per table)
```

**READY-TO-DROP FILE — `caspio-pricing-proxy/src/routes/caspio-schema.js`:**
```js
// Read-only Caspio SCHEMA introspection — enumerate tables/views/apps/webhooks + any
// table's fields WITHOUT a per-session bearer token, using the proxy's standing OAuth
// credential. OPEN by design (Erik 2026-07-09): schema structure only, never row data.
// Caspio REST v4 (/v4/schemas/*, /v4/tables/*). Mount BEFORE the catch-all in server.js:
//   app.use('/api/caspio-schema', require('./src/routes/caspio-schema'));  // adjust path to match repo
const express = require('express');
const router = express.Router();

// ⚠ INTEGRATION POINT 1 — confirm the export in src/utils/caspio.js. Assumed:
//   getCaspioAccessToken() -> Promise<string bearerToken>  (module-cached, 60s buffer).
const { getCaspioAccessToken } = require('../utils/caspio');

const V4 = 'https://c3eku948.caspio.com/integrations/rest/v4';

// ⚠ INTEGRATION POINT 2 — uses global fetch (Node 18+). If the proxy is on <18 or uses
// axios/node-fetch, swap this one function for the repo's http client.
async function v4Get(path) {
  const token = await getCaspioAccessToken();
  const r = await fetch(`${V4}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {                                   // surface errors — never silent-fallback (Erik rule #1)
    const body = await r.text().catch(() => '');
    const e = new Error(`Caspio v4 ${r.status} on ${path}: ${body.slice(0, 300)}`);
    e.status = r.status; throw e;
  }
  return r.json();
}

const cache = new Map(); const TTL = 15 * 60 * 1000;   // schema rarely changes; stays well under rate limit
async function cached(key, loader) {
  const h = cache.get(key);
  if (h && Date.now() - h.at < TTL) return h.val;
  const val = await loader(); cache.set(key, { at: Date.now(), val }); return val;
}
const wrap = (h) => async (req, res) => {
  try { res.json(await h(req)); }
  catch (e) { res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({ success: false, error: e.message }); }
};

router.get('/tables', wrap(async () => {
  const j = await cached('tables', () => v4Get('/tables?pageSize=1000'));
  return { success: true, count: j.pagination?.totalCount ?? (j.data || []).length,
    tables: (j.data || []).map(t => ({ name: t.name, tableId: t.tableId, fieldCount: t.fieldCount, description: t.description })) };
}));
router.get('/tables/:name/fields', wrap(async (req) => {
  const list = await cached('tables', () => v4Get('/tables?pageSize=1000'));
  const t = (list.data || []).find(x => String(x.name).toLowerCase() === String(req.params.name).toLowerCase());
  if (!t) { const e = new Error(`Table not found: ${req.params.name}`); e.status = 404; throw e; }
  const j = await cached(`f:${t.tableId}`, () => v4Get(`/tables/${t.tableId}/fields`));
  return { success: true, table: t.name, tableId: t.tableId,
    fields: (j.data || j || []).map(f => ({ name: f.name, dataType: f.dataType, editable: f.editable, unique: f.unique, isFormula: f.isFormula })) };
}));
router.get('/views', wrap(async () => {
  const j = await cached('views', () => v4Get('/views?pageSize=1000'));
  return { success: true, count: j.pagination?.totalCount ?? (j.data || []).length, views: (j.data || []).map(v => v.name) };
}));
router.get('/webhooks', wrap(async () => {
  const j = await cached('webhooks', () => v4Get('/schemas/outgoingWebhooks?pageSize=1000'));
  return { success: true, count: j.pagination?.totalCount ?? (j.data || []).length,
    webhooks: (j.data || []).map(w => ({ name: w.name, status: w.status,
      events: (w.events || []).map(e => ({ object: e.objectName, type: e.type, sources: e.eventSources })) })) };
}));
router.get('/apps', wrap(async () => {
  const [b, f] = await Promise.all([cached('bridge', () => v4Get('/bridgeApplications')), cached('flex', () => v4Get('/flexApplications'))]);
  return { success: true, bridge: (b.data || []).map(a => a.name), flex: (f.data || []).map(a => a.name) };
}));
router.get('/full', wrap(async () => {                 // one-call data dictionary
  const j = await cached('full', () => v4Get('/schemas/tables?pageSize=1000'));
  return { success: true, count: (j.data || []).length,
    tables: (j.data || []).map(t => ({ name: t.name, tableId: t.tableId,
      fields: (t.fields || []).map(f => ({ name: f.name, dataType: f.dataType, editable: f.editable })) })) };
}));

module.exports = router;
```

**Build steps when the proxy repo is reachable (currently DEHYDRATED on Erik's OneDrive — only the root folder exists, no `src/`/`server.js`):**
1. Sync the OneDrive `caspio-pricing-proxy` folder (right-click → "Always keep on this device") OR point Claude at the real working clone.
2. Drop the file above at `src/routes/caspio-schema.js`; verify INTEGRATION POINT 1 (token helper export name/return) + POINT 2 (global fetch vs axios/node-fetch) against `src/utils/caspio.js`.
3. Mount in `server.js` (`app.use('/api/caspio-schema', require('./src/routes/caspio-schema'))`) + add to the route-TOC comment block per the proxy's convention.
4. Register in the proxy's docs/`ACTIVE_FILES` + memory. Smoke-test: `curl <proxy>/api/caspio-schema/tables` → 163 tables; `.../tables/Quote_Sessions/fields` → columns.
5. Deploy the proxy (its own deploy flow). Then Claude can enumerate any table any session with **zero token handoff**.

**Note:** a general schema endpoint is mild DB-recon info (table/field names). It's schema-only (no row data) and Erik chose OPEN; if that ever feels too exposed, gate it behind the existing `X-CRM-API-Secret` (server-to-server) — but that reintroduces a secret to call it.

### #1 — Portal (DECIDED: ship data-minimization now; real gate = Phase-2 magic-link, #6)
Design → [CASPIO_PORTAL_DESIGN.md](CASPIO_PORTAL_DESIGN.md). Decision: token gate / strict link-breaking would need #2 staff-auth to sign rep links (else open-oracle), so we ship data-minimization now and defer real confidentiality to Phase-2 login. Bare `/portal/:id` links keep working.
- ✅ **STAGE A+B SHIPPED & live-verified (commit 51d6c498, 2026-06-29):** new APP `server.js` `GET /api/portal/:customerId` (resolver `resolvePortalCustomer` → core `getPortalData` → ALLOWLIST projection; only 8 safe fields; empty≠404; portalLimiter). `pages/js/customer-portal.js` repointed to the single same-origin endpoint; art deep-link normalized PK_ID→**ID_Design**; cards carry `cid` for Phase-2. Verified on running app: company name + mockup card render, no console/server errors, leak-scan PASS (no YTD/staff-email/charges/notes).
- ✅ **STAGE C1 SHIPPED & live-verified (commit 2609a907):** `/art-request/:designId?view=customer` → gated `GET /api/portal/:cid/art-request/:designId` (allowlist, authorize, 404 on mismatch); dropped notes+charges for customer. **BONUS leak caught by browser/network testing that the static map missed:** `loadVisionAnalysis()` (internal AI QA) ran unguarded → now `!isCustomerView`.
- ✅ **STAGE C2 SHIPPED & live-verified (commit 02fb9da1):** `/mockup/:id?view=customer` → bundled `GET /api/portal/:cid/mockup/:id` (record+sanitized-notes+versions) + `.../threads`; notes sanitized to status-keywords (timeline still works, no text leak); `Submitted_By`→first-name. **BONUS:** the Supacolor transfer badge leaked `transfer-orders` to customers on BOTH detail pages → now gated to staff/AE. Verified: customer view calls ONLY gated endpoints + box thumbnails; staff view unchanged; no regressions.
- **METHOD WIN:** static field-mapping (even adversarially verified) MISSED two leaks (vision analysis, transfer badge) because they fire via setTimeout / a shared module. **Live network capture during the customer view caught both.** For any future "what does this page leak" audit, watch the network, don't just read the code.
- ⏳ **REMAINING (separate tasks, NOT data-leak):** (1) customer WRITE actions (approve / request-revision / rush-toggle / file-upload) still hit unauthenticated public proxy routes reachable by URL — gate/authorize them (harness task #7). (2) The real confidentiality GATE (require a token / login, break bare links) = Phase 2 magic-link (#6); data-minimization is shipped, so the financial/staff/cross-company leak is already closed regardless.
`/portal/:customerId` ([server.js:2482](server.js:2482)) is gated only on `/^\d+$/` → any integer enumerates another customer's data (IDOR). Clone `computeOrderStatusToken` ([server.js:620](server.js:620), `crypto.createHmac('sha256',…)`) as `computePortalToken`; add `PORTAL_SECRET`; require+verify `?t=` (timingSafeEqual, generic 404, 503 if secret unset). **First step when resuming: trace which data endpoints `customer-portal.html`/its JS calls — must gate those too, not just the HTML route.** Decide a grace window for already-shared unsigned links.

### #2 — Staff auth (the real finding)
`/api/crm-session` ([server.js:2124](server.js:2124)) sets `req.session.crmUser` + permissions from a **client-POSTed `name`, with no server-side verification** of the Caspio login → a direct `POST /api/crm-session {"name":"Erik"}` mints a full-admin session; `requireCrmRole` gates are bypassable. Also `/staff-dashboard.html` ([server.js:2392](server.js:2392)) has no role gate; `SESSION_SECRET` has a `'dev-secret-change-in-production'` fallback ([server.js:454](server.js:454)). Fix = (a) server must independently verify the Caspio login (sign the Caspio→app identity handoff / validate session / SSO), then (b) retire the hardcoded `CRM_PERMISSIONS` map → derive from a `Role` authfield in the "Staff" directory, manage users via Directories REST. NOTE: Directories REST is user *management*, not authentication.

### #3 — Webhook receiver + Quote_Sessions — ⚠️ REFRAMED 2026-06-29 (premise unsound)
**FINDING (Explore agent, verified):** a Caspio outgoing webhook fires ONLY on Caspio writes. The hourly Quote↔ShopWorks poll exists to detect changes ShopWorks operators make in the **OnSite/ManageOrders UI** — *external* to Caspio — and ManageOrders has **no outbound webhook**. So a Caspio webhook on `Quote_Sessions` CANNOT replace the poll (it would only fire *after* the poll's own write). **Keep the poll.** Flow: Heroku Scheduler → `caspio-pricing-proxy/scripts/sync-quote-sessions-from-shopworks.js` → FE `POST /api/quote-sessions/bulk-sync-from-shopworks` (`server.js:8561`) → per-quote `sync-from-shopworks` reads ManageOrders `/v1/orders` etc. → `makeApiRequest('/quote_sessions/:pk','PUT')` (Caspio REST write).
**→ Reframe:** build the receiver (clone `box-webhooks.js` HMAC/rawBody/replay → `caspio-webhooks.js`, mount `/api/caspio-webhook/*`) and wire it to **#4 (ArtRequests.Status)** where the change genuinely originates in Caspio. **Remaining blockers:** (1) Caspio's webhook DELIVERY signature scheme is **undocumented** in our materials (Swagger documents only the mgmt API + the one-time `Secret`) — learn it empirically by registering a test webhook + inspecting delivery headers; (2) registering the webhook is a Caspio **config write** (capture `Secret` at POST-create, store in Heroku). Caspio webhook delivery is **at-least-once** → always keep a thinned poll/watchdog.

### #4 — ArtRequests.Status webhook
Depends on #3. Today notifications are app-coupled in `art.js`/`notify-art-completion.js`/`slack-*-notify.js` (misses changes via other paths). Webhook = data-coupled, total coverage. **Scope to Status only** (leave notes app-level — they're actor+text rich). Make webhook the SINGLE owner → remove/feature-flag the inline status-notify to avoid **double-fire**. Actor-identity gap: webhook may not know *who* changed it — include a modified-by field if one exists, else accept data-centric wording.

### #5 — On-demand task triggers — ✅ DONE & LIVE (proxy `13dc8ae`, 2026-06-29)
`caspio-pricing-proxy/src/routes/caspio-tasks.js` (mounted `/api/caspio-tasks`, whole-mount `requireCrmApiSecret`): `GET /` (list 6 tasks+status), `GET /:name` (status), `POST /:name/run` (fire-then-poll). Name allowlist (the 6); externalKey resolved LIVE (not hardcoded); visible errors. **GOTCHA (cost a redeploy):** the tasks mgmt API is **v3-only** — `require('../config')` (src/config = `/integrations/rest/v3`), NOT proxy-root `config.js` (`/rest/v2`, where most table routes live → 404 on `/dataImportExportTasks`). Verified live: list/status/gate/allowlist all pass; the `run` POST is code+gate-verified but NOT live-triggered (does a real import — Erik's to fire). **Follow-on (optional):** a staff-dashboard "Run now" button → needs a FE `createCrmProxy('caspio-tasks',…)` route (browser can't hold the proxy secret) + UI. The 6 tasks: `CustomerContactsMerge` (daily), `Designs2026` (daily), `Orders_ODBC` (daily), `PurchaseOrders` (daily), `Sales Reps 2026-Daily` (daily), `Thumbnail_Import` (Fri). **Pairs with — doesn't replace — the Node syncs.**

## Phase 2 vision — authenticated customer portal (Erik, 2026-06-29 PM)
Eventually customers LOG IN and see only their own company's data ("don't want them to see everything"). #1 is the foundation — the gated customer-safe data endpoint becomes the data layer; login replaces the URL token with a verified session (id_Customer). 3 phases: (1=#1) gated endpoint + signed URLs → (2) real login + per-customer session → (3) richer scope (order history, approvals, reorders, account pricing).
- **No customer portal-with-login and NO customer Directory exist today** (probe: only 'Staff' dir).
- **Recommended auth: magic-link / passwordless** (email → match company-contacts → emailed signed expiring single-use link → session). Reuses #1's HMAC discipline; avoids the staff client-trust gap (#2); no password-reset burden; scales via existing company-contacts (id_Customer+email) as registry, no Caspio account per customer. Alt: Caspio 'Customers' Directory + Caspio login (cleaner lifecycle, but a Caspio user per customer + client-token issue).
- Unifying principle across #1/#2/#3/this: **server verifies identity, never trusts the browser.** Tracked as harness task #6 (blocked by #1).

## Open flags / decisions for Erik
- **Branch:** the proxy's 2 doc/script commits (`e5d50ee`, `4fbdfcc`) are on `deploy/send-to-steve`, not `develop`. They'll arrive when that branch merges; or cherry-pick to `develop` if wanted sooner.
- Possible **#6+**: `q.groupBy` server-side sales aggregation (`daily-sales-by-rep.js`); automate staff user provisioning via Directories REST (follow-on to #2); audit whether all 24 Zapier webhooks are still live.
