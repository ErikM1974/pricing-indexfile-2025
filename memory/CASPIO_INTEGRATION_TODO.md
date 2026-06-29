# Caspio Integration — Build To-Do & Session Resume

> **STATUS: PAUSED 2026-06-29** (Erik turning laptop off, returning later same day). This is the durable resume point for the Caspio Swagger capability work — the harness task list (#1–#5) does **not** survive an app restart, so THIS file is the canonical list. Reference/detail → [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md).
>
> **WHERE WE LEFT OFF:** the 5-item build list below is agreed. **No code started yet.** Next action = begin executing **#1 (portal HMAC)**. Erik said "keep going" then paused.

## Already DONE this session (don't redo)
- Pulled + parsed the full Caspio REST v3 spec (70 ops / 7 groups). Wrote **CASPIO_REST_API_REFERENCE.md** + dated snapshot `caspio-swagger-snapshot-2026-06-29.json`; wired pointers into this repo's INDEX.md + CLAUDE.md, and the proxy's CLAUDE.md. Committed (`develop`: docs commits incl. `7524c727`).
- Wrote + RAN a read-only **entitlement probe** (`caspio-pricing-proxy/scripts/caspio-entitlement-probe.js`). Result: **all 7 groups AVAILABLE** on the plan. Live inventory: **24 outgoing webhooks (all Zapier)**, **6 import/export tasks**, **1 "Staff" directory (11 users)**, **14 bridge apps**. (Probe committed in proxy on branch `deploy/send-to-steve`.)
- Key verified fact: **Caspio Outgoing Webhooks fire on REST writes** (`EventSources` defaults to all incl `RESTAPIs`) — unlike Triggered Actions. This underpins #3/#4.

## The build list (priority order)
| # | Item | Type | Effort | Depends on |
|---|---|---|---|---|
| 1 | **Sign customer portal URLs with HMAC** + gate the portal data APIs | Security | S | — |
| 2 | **Fix staff-dashboard auth** — server can't verify Caspio (proven); use **Google Workspace OAuth** + data-driven roles. DESIGN DONE → [STAFF_AUTH_DESIGN.md](STAFF_AUTH_DESIGN.md). `/api/crm-session` mints full-admin from a client-posted name (live vuln); `SESSION_SECRET` confirmed SET on Heroku (no offline-forgery). Awaiting IdP decision. | Security | M | — |
| 3 | **Caspio webhook receiver** + first webhook replacing the hourly Quote↔ShopWorks poll | Capability | M | — |
| 4 | **ArtRequests.Status webhook notifications** (data-coupled; replaces app-coupled status notify) | Capability | M | #3 |
| 5 | **On-demand Caspio task triggers** (`POST …/run`) | Capability | S | — |

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

### #3 — Webhook receiver + Quote_Sessions
Clone `caspio-pricing-proxy/src/routes/box-webhooks.js` (HMAC, rawBody, replay window) → new `caspio-webhooks.js`, mount `/api/caspio-webhook/*`. Register `table.recordUpdate` on `Quote_Sessions`, `ObjectFields=[Status,PushedToShopWorks]`. **Precondition: confirm the ShopWorks→Caspio sync writes the row THROUGH Caspio**; keep hourly cron as thinned backstop. Test `POST /v3/outgoingWebhooks` once to capture the `Secret`.

### #4 — ArtRequests.Status webhook
Depends on #3. Today notifications are app-coupled in `art.js`/`notify-art-completion.js`/`slack-*-notify.js` (misses changes via other paths). Webhook = data-coupled, total coverage. **Scope to Status only** (leave notes app-level — they're actor+text rich). Make webhook the SINGLE owner → remove/feature-flag the inline status-notify to avoid **double-fire**. Actor-identity gap: webhook may not know *who* changed it — include a modified-by field if one exists, else accept data-centric wording.

### #5 — On-demand task triggers
6 real tasks: `Designs2026`, `Orders_ODBC`, `Sales Reps 2026-Daily`, `CustomerContactsMerge`, `PurchaseOrders`, `Thumbnail_Import`. `POST /v3/dataImportExportTasks/{ek}/run` then poll Status (fire-then-poll = Heroku-safe). **Decide Caspio-task-vs-Node-script ownership** per flow (don't double-run with `sync-design-lookup.js` etc.).

## Phase 2 vision — authenticated customer portal (Erik, 2026-06-29 PM)
Eventually customers LOG IN and see only their own company's data ("don't want them to see everything"). #1 is the foundation — the gated customer-safe data endpoint becomes the data layer; login replaces the URL token with a verified session (id_Customer). 3 phases: (1=#1) gated endpoint + signed URLs → (2) real login + per-customer session → (3) richer scope (order history, approvals, reorders, account pricing).
- **No customer portal-with-login and NO customer Directory exist today** (probe: only 'Staff' dir).
- **Recommended auth: magic-link / passwordless** (email → match company-contacts → emailed signed expiring single-use link → session). Reuses #1's HMAC discipline; avoids the staff client-trust gap (#2); no password-reset burden; scales via existing company-contacts (id_Customer+email) as registry, no Caspio account per customer. Alt: Caspio 'Customers' Directory + Caspio login (cleaner lifecycle, but a Caspio user per customer + client-token issue).
- Unifying principle across #1/#2/#3/this: **server verifies identity, never trusts the browser.** Tracked as harness task #6 (blocked by #1).

## Open flags / decisions for Erik
- **Branch:** the proxy's 2 doc/script commits (`e5d50ee`, `4fbdfcc`) are on `deploy/send-to-steve`, not `develop`. They'll arrive when that branch merges; or cherry-pick to `develop` if wanted sooner.
- Possible **#6+**: `q.groupBy` server-side sales aggregation (`daily-sales-by-rep.js`); automate staff user provisioning via Directories REST (follow-on to #2); audit whether all 24 Zapier webhooks are still live.
