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
| 2 | **Fix staff-dashboard auth** — server-side verify the Caspio login, then Directory-driven roles | Security | M–L | — |
| 3 | **Caspio webhook receiver** + first webhook replacing the hourly Quote↔ShopWorks poll | Capability | M | — |
| 4 | **ArtRequests.Status webhook notifications** (data-coupled; replaces app-coupled status notify) | Capability | M | #3 |
| 5 | **On-demand Caspio task triggers** (`POST …/run`) | Capability | S | — |

### #1 — Portal HMAC (start here)
`/portal/:customerId` ([server.js:2482](server.js:2482)) is gated only on `/^\d+$/` → any integer enumerates another customer's data (IDOR). Clone `computeOrderStatusToken` ([server.js:620](server.js:620), `crypto.createHmac('sha256',…)`) as `computePortalToken`; add `PORTAL_SECRET`; require+verify `?t=` (timingSafeEqual, generic 404, 503 if secret unset). **First step when resuming: trace which data endpoints `customer-portal.html`/its JS calls — must gate those too, not just the HTML route.** Decide a grace window for already-shared unsigned links.

### #2 — Staff auth (the real finding)
`/api/crm-session` ([server.js:2124](server.js:2124)) sets `req.session.crmUser` + permissions from a **client-POSTed `name`, with no server-side verification** of the Caspio login → a direct `POST /api/crm-session {"name":"Erik"}` mints a full-admin session; `requireCrmRole` gates are bypassable. Also `/staff-dashboard.html` ([server.js:2392](server.js:2392)) has no role gate; `SESSION_SECRET` has a `'dev-secret-change-in-production'` fallback ([server.js:454](server.js:454)). Fix = (a) server must independently verify the Caspio login (sign the Caspio→app identity handoff / validate session / SSO), then (b) retire the hardcoded `CRM_PERMISSIONS` map → derive from a `Role` authfield in the "Staff" directory, manage users via Directories REST. NOTE: Directories REST is user *management*, not authentication.

### #3 — Webhook receiver + Quote_Sessions
Clone `caspio-pricing-proxy/src/routes/box-webhooks.js` (HMAC, rawBody, replay window) → new `caspio-webhooks.js`, mount `/api/caspio-webhook/*`. Register `table.recordUpdate` on `Quote_Sessions`, `ObjectFields=[Status,PushedToShopWorks]`. **Precondition: confirm the ShopWorks→Caspio sync writes the row THROUGH Caspio**; keep hourly cron as thinned backstop. Test `POST /v3/outgoingWebhooks` once to capture the `Secret`.

### #4 — ArtRequests.Status webhook
Depends on #3. Today notifications are app-coupled in `art.js`/`notify-art-completion.js`/`slack-*-notify.js` (misses changes via other paths). Webhook = data-coupled, total coverage. **Scope to Status only** (leave notes app-level — they're actor+text rich). Make webhook the SINGLE owner → remove/feature-flag the inline status-notify to avoid **double-fire**. Actor-identity gap: webhook may not know *who* changed it — include a modified-by field if one exists, else accept data-centric wording.

### #5 — On-demand task triggers
6 real tasks: `Designs2026`, `Orders_ODBC`, `Sales Reps 2026-Daily`, `CustomerContactsMerge`, `PurchaseOrders`, `Thumbnail_Import`. `POST /v3/dataImportExportTasks/{ek}/run` then poll Status (fire-then-poll = Heroku-safe). **Decide Caspio-task-vs-Node-script ownership** per flow (don't double-run with `sync-design-lookup.js` etc.).

## Open flags / decisions for Erik
- **Branch:** the proxy's 2 doc/script commits (`e5d50ee`, `4fbdfcc`) are on `deploy/send-to-steve`, not `develop`. They'll arrive when that branch merges; or cherry-pick to `develop` if wanted sooner.
- Possible **#6+**: `q.groupBy` server-side sales aggregation (`daily-sales-by-rep.js`); automate staff user provisioning via Directories REST (follow-on to #2); audit whether all 24 Zapier webhooks are still live.
