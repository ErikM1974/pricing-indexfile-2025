# Caspio REST API v3 — Platform Capability Reference

> **What this is:** a *map* of what the Caspio **platform REST API** (the Swagger surface) can do, what NWCA already uses, what's untapped, and the gotchas we've verified. This is the integration-design counterpart to the other backend references ([SANMAR_API_REFERENCE.md](SANMAR_API_REFERENCE.md), [MANAGEORDERS_COMPLETE_REFERENCE.md](MANAGEORDERS_COMPLETE_REFERENCE.md)).
>
> **Not the same as [CASPIO_API_CORE.md](CASPIO_API_CORE.md)** — that documents *our proxy's* API (the Heroku `caspio-pricing-proxy/api` endpoints the front-end consumes). THIS file documents the *Caspio platform* API that the proxy itself calls.
>
> **Newer API version:** [CASPIO_REST_API_V4_REFERENCE.md](CASPIO_REST_API_V4_REFERENCE.md) — the v4 delta (bulk ops, T-SQL queries, schema discovery, AI manifest) lives there. This file stays canonical for v3 + the shared OAuth/token lifecycle. v4 is opt-in/additive; the proxy still runs v3.
>
> **Source of truth = the live spec, not this file.** Re-fetch any time (public, no auth needed to READ the contract):
> ```bash
> curl -s "https://c3eku948.caspio.com/integrations/rest/v3/swagger/documentation" -o caspio-swagger.json
> ```
> Interactive UI: `https://c3eku948.caspio.com/integrations/rest/swagger/index.html`.
> Dated raw snapshot kept alongside this file: `caspio-swagger-snapshot-2026-06-29.json` (re-pull for current truth).
>
> **Created 2026-06-29** from a full spec audit (account `c3eku948`, OpenAPI 3.0.4, REST v3). Full prioritized improvement roadmap that came out of this audit is summarized in §6.

---

## 1) Identity & Auth

- **Base URL:** `https://c3eku948.caspio.com/integrations/rest`  → all data ops under `/v3/...`
- **Token endpoint (separate OAuth server, NOT under `/v3`):** `POST https://c3eku948.caspio.com/oauth/token`
  - Grant: `client_credentials` (`grant_type=client_credentials&client_id=…&client_secret=…`). HTTP Basic (Base64 `client_id:client_secret`) also accepted.
  - **Access token = 24h**, refresh token = 1 yr (60 days if unused), **1000-refresh-token cap** (oldest invalidated past the cap).
- Every `/v3` call needs `Authorization: Bearer <access_token>`.
- **Our implementation:** `caspio-pricing-proxy/src/utils/caspio.js` → `getCaspioAccessToken()` (module-cached, 60s expiry buffer; **400 "IncorrectQueryParameter" = stale token**, auto-retried once per page). ONE `CASPIO_CLIENT_ID/SECRET` pair currently covers all ~397 proxy endpoints → single-credential blast radius (least-privilege per-integration profiles are a worthwhile but UI/plan-gated follow-on).

---

## 2) The 7 capability groups (70 operations)

### Tables (20) — record CRUD + schema + passwords + attachments
- `GET/POST /v3/tables` · `GET /v3/tables/{t}`
- `GET/POST /v3/tables/{t}/fields` · `GET/PUT/DELETE /v3/tables/{t}/fields/{f}` — **schema-as-API**
- `GET/POST/PUT/DELETE /v3/tables/{t}/records` — the workhorse
- `GET /v3/tables/{t}/passwordFields` · `PUT/DELETE /v3/tables/{t}/passwordFields/{pf}` — **set/reset** a password field value server-side (PUT writes a hash; DELETE clears). ⚠️ This is a WRITE, NOT a credential-verify endpoint — Caspio REST has **no** "check these credentials" operation (confirmed by the 2026-06-29 portal-design research). Don't treat it as a login verifier.
- `GET/PUT/DELETE /v3/tables/{t}/attachments/{field}[/{recordPkId}|/fileInfo]` — files stored ON a record
- **Record query params:** `q.select` (projection — cuts payload), `q.where` (filter; **always sanitize**), `q.orderby`, `q.groupBy` (server-side aggregation), `q.pageSize` + `q.pageNumber` (**use `q.pageSize`, NOT `q.limit`, on v3** — `q.limit`+`q.pageNumber` overlaps pages). Pagination centralized in `fetchAllCaspioPages()`.

### Views (13) — read + write through predefined joins/filters
- `GET /v3/views` · `GET /v3/views/{v}` · `GET /v3/views/{v}/fields[/{f}]`
- `GET/POST/PUT/DELETE /v3/views/{v}/records` · view attachments GET/PUT/DELETE
- Views must be defined in the Caspio UI; complex joins are read-mostly (can't always write through).

### Files (11) — Caspio-hosted file store + folders
- `GET/POST/PUT /v3/files` · `GET/DELETE /v3/files/{externalKey}` · `GET /v3/files/{externalKey}/fileInfo`
- `GET /v3/files/folders[/{externalKey}]` · `GET/DELETE /v3/files/path` · `GET /v3/files/path/fileInfo`

### Outgoing Webhooks (10) — **event push** ⭐
- `GET/POST /v3/outgoingWebhooks` · `GET/PUT/DELETE /v3/outgoingWebhooks/{id}`
- `GET/POST /v3/outgoingWebhooks/{id}/events` · `GET/PUT/DELETE /v3/outgoingWebhooks/{id}/events/{eventId}`
- **WebhookPostRequest** `{Name, Description, OutgoingUrls[] (HTTPS), CallThrottling}`. POST response includes **`Secret`** (HMAC — returned ONLY at creation, capture it then). PUT can `Enabled:true/false`. Multiple `OutgoingUrls` (multicast) + throttling may be plan-gated.
- **WebhookEventRequest** `{EventType, ObjectName(table), ObjectFields[], EventSources[], CustomPayloadFields[], CustomPayloadTemplate, Enabled}`.
  - `EventType` ∈ `table.recordInsert | table.recordUpdate | table.recordDelete`.
  - `ObjectFields` (recordUpdate only) — fire only when those columns change.
  - **`EventSources` ∈ `Datasheet, DataPages, RESTAPIs, TriggeredActions, Tasks`; defaults to ALL when omitted** → see §3 gotcha.
  - `GET …/events/{eventId}` returns 30-day `Messages/Calls/Errors` counters (wire into a health watchdog).

### Bridge Applications (7) — list + deploy DataPages
- `GET /v3/bridgeApplications[/{ek}]` · `GET …/{ek}/datapages[/{appKey}]` · `GET …/datapages/{appKey}/deployment`
- `PUT …/datapages[/{appKey}]/deployment` (`SetDeploymentStatusRequest`) — deploy/un-deploy a DataPage programmatically.

### Directories (6) — **end-user logins / authentication** managed via REST
- `GET /v3/directories` · `GET/POST/PUT/DELETE /v3/directories/{directoryId}/users` · `POST /v3/directories/{directoryId}/users/activate`
- A Directory = a Caspio authentication source (app logins). `ActivateUserRequest{UserGUID, SendEmail}` → `ActivateUserResponse.ActivationUrl` (optionally emails the user). `DirectoryItem{Id, Name, NumberOfUsers, …}`.

### Data Import/Export Tasks (3) — trigger scheduled tasks on demand
- `GET /v3/dataImportExportTasks` · `GET /v3/dataImportExportTasks/{externalKey}` · `POST /v3/dataImportExportTasks/{externalKey}/run`
- `ScheduledTaskInfo{Name, ExternalKey, Status, TaskTimeZone, Frequency, Note}`.

---

## 3) Gotchas verified in this audit (the expensive-to-rederive stuff)

- **⭐ Outgoing Webhooks FIRE on REST-originated writes — Triggered Actions do NOT.** Spec text: *"EventSources … valid values are: Datasheet, DataPages, RESTAPIs, TriggeredActions, Tasks. If not provided or empty, it defaults to all values."* This is the opposite of our long-standing "Caspio Triggered Actions DON'T fire on REST API updates" limitation (see LESSONS_LEARNED) — webhooks are the REST-era replacement and can finally push on changes the proxy itself makes. **Guard against feedback loops** (proxy write → webhook → proxy write) by scoping `EventSources`/`ObjectFields` + idempotent dedupe.
- **Webhook `Secret` is returned only in the POST-create response** — capture it into Heroku config immediately; it's not re-fetchable.
- **Entitlement — CONFIRMED AVAILABLE (2026-06-29 read-only probe, `caspio-pricing-proxy/scripts/caspio-entitlement-probe.js`):** ALL 7 groups return **200** on this account. Live counts: Tables 156 · Views 19 · File-folders 10 · **Outgoing Webhooks 24 · Directories 1 · Data Import/Export Tasks 6 · Bridge Apps 14**. So nothing in this doc is plan-gated *for us* — see §7 for the actual objects. (Only remaining tier-dependent unknowns: multicast `OutgoingUrls` and attachment storage quota. Re-run the probe if the Caspio plan changes.)
- **Webhook delivery is at-least-once and can miss silent upstream changes** — never remove a poll without leaving a reduced-frequency watchdog that alerts (Erik's #1 rule: stale/missed data is worse than an error).
- Existing known query gotchas still apply: `q.pageSize` not `q.limit` (v3); 400 = stale token (not 401); `q.select` of a non-existent field → 500.

---

## 4) What NWCA uses today vs. untapped (baseline 2026-06-29)

| Group | Status | Evidence / notes |
|---|---|---|
| **Tables — records CRUD** | ✅ Heavy prod use | `src/utils/caspio.js` (v3), `fetchAllCaspioPages`, `q.where/select/orderby/pageSize` across most route files |
| **Tables — schema (create/fields)** | ⚠️ Scripts only | setup/seed scripts; not a prod path (and shouldn't be for the 155K-row masters) |
| **Tables — passwordFields / attachments** | ❌ Untapped | files live in Box, not Caspio attachments |
| **Views** | ✅ Some prod use | read-side |
| **Files** | ✅ Prod use | uploads/downloads (`files-simple.js`, box-upload paths) |
| **Outgoing Webhooks** | ❌ Untapped *by the proxy* | **24 active webhooks exist — ALL are Zapier subscriptions** (`Zapier-ZapID_subscription:*` → `hooks.zapier.com`, throttle 10). So Caspio webhooks are proven/entitled, but the NWCA proxy receives none directly; polling crons + Zapier stand in. (`box-webhooks.js` is *Box*, not Caspio.) |
| **Directories / Users** | ⚠️ Exists, REST unused | 1 directory **"Staff" (11 users)**; staff log in via the Caspio **App login** (`…/users/55u0q8…`), but the Directories REST API is unused; `CRM_PERMISSIONS` hardcoded in `server.js` |
| **Data Import/Export Tasks** | ⚠️ Scheduled, never API-triggered | **6 daily/weekly imports exist** (`Designs2026`, `Orders_ODBC`, `Sales Reps 2026-Daily`, `CustomerContactsMerge`, `PurchaseOrders`, `Thumbnail_Import`). `POST …/run` can fire any on-demand — see §6/§7. |
| **Bridge Applications** | ⚠️ Scripts only | 14 apps; read-only `explore-bridge-apps.js` / `dump-all-datapages.js`; deploy PUT unused |

---

## 5) Proven receiver pattern (for webhooks)

Clone `caspio-pricing-proxy/src/routes/box-webhooks.js` (battle-tested HMAC receiver: rawBody capture so the signature is computed over the exact signed bytes, replay window, fast 2xx then async). New file: `caspio-pricing-proxy/src/routes/caspio-webhooks.js`, mount `/api/caspio-webhook/*`. Health via the existing `check-*-health.js` + `slack-*-notify.js` utilities. Set the per-webhook IP allowlist to Caspio egress as defense-in-depth.

---

## 6) Improvement roadmap (from the 2026-06-29 audit)

**Headline:** adopt Outgoing Webhooks to convert polling → authenticated push (rests on §3 webhook-fires-on-REST fact).

**Top 3, in order:**
1. **HMAC-sign the customer portal** (`Pricing Index/server.js:2482` `/portal/:customerId` is gated only on `/^\d+$/` → any integer enumerates a customer's portal). Reuse `computeOrderStatusToken` pattern (`server.js:620`) as `computePortalToken` + `PORTAL_SECRET`, and gate the data APIs the page calls, not just the HTML route. Pure code, no plan risk.
2. **Webhook receiver + first webhook on `Quote_Sessions`** (`recordUpdate`, `ObjectFields=[Status,PushedToShopWorks]`) → replaces the hourly Quote↔ShopWorks poll (`server.js:8236`, `sync-quote-sessions-from-shopworks.js`). First test-`POST /v3/outgoingWebhooks` for the `Secret` (entitlement check). Keep a thinned cron backstop. **Only fires if the ShopWorks→Caspio sync writes through Caspio — verify that path.**
3. **Move staff role-of-record into a Caspio Directory** (`GET /v3/directories` first; 403/404 = not entitled) → derive `/api/crm-session` perms (`server.js:2124`, `CRM_PERMISSIONS` `server.js:469`) from a `Role` authfield instead of a hardcoded map + deploy. Remove `SESSION_SECRET='dev-secret-change-in-production'` fallback (`server.js:454`) in the same change so it fails closed.

**Also worth it:**
- Event-driven `ArtRequests.Status` notifications (start with status flips — not covered by note fan-out, so no double-fire).
- Server-side `q.groupBy` aggregation for `NW_Daily_Sales_By_Rep` (`daily-sales-by-rep.js:68`, keep JS fallback).
- **On-demand `POST /v3/dataImportExportTasks/{ek}/run`** *(REVISED — the 2026-06-29 probe found 6 real tasks; the original "no targets" call was wrong)*: force a fresh `Designs2026` or `Orders_ODBC` / `Sales Reps 2026-Daily` import instead of waiting for the daily schedule (e.g. after a known ShopWorks/SanMar change), surfacing task `Status`. Pairs with — doesn't replace — the existing bespoke Node syncs.
- **Direct proxy webhook to continue the Zapier→backend migration:** the 24 Caspio webhooks all feed Zapier; a proxy-owned webhook (→ `caspio-webhooks.js`) lets specific flows skip the Zapier hop (lower latency, no per-task Zap, fits the documented move off Zaps to backend Slack). Also a cleanup signal: audit whether all 24 Zapier subscriptions are still live.

**Deliberately skipped (don't pay off):** Box→Caspio attachment migration; `passwordFields` as a login store; Directory logins for the *customer* portal (no-login is the UX value — HMAC-sign instead); schema-via-REST migrations on the masters; Views & DataPage deploy-toggle (no concrete pain today).

---

---

## 7) Live inventory (2026-06-29 read-only probe — re-run `caspio-pricing-proxy/scripts/caspio-entitlement-probe.js`)

- **Outgoing Webhooks (24):** every one is `Zapier-ZapID_subscription:<id>` → `hooks.zapier.com`, Status=Active, throttle=10. (Zapier registers a Caspio outgoing webhook per zap.) The proxy receives none directly. URLs redacted — re-probe for live values.
- **Data Import/Export Tasks (6), all Status=Ready, Pacific TZ:** `CustomerContactsMerge` (daily) · `Designs2026` (daily) · `Orders_ODBC` (daily) · `PurchaseOrders` (daily) · `Sales Reps 2026-Daily` (daily) · `Thumbnail_Import` (Friday). Trigger via `POST /v3/dataImportExportTasks/{externalKey}/run`.
- **Directories (1):** `Staff` — 11 users. Manage via `…/directories/{id}/users` (+ `/activate`).
- **Bridge Applications (14):** Eriks Credit Card · Human Resources 2025 · Inksoft Deposits · Monograms · Nika and Taneisha 2026 · Old Designs · Policies · Production · Safety Stripes · Sanmar Pricing 2026 · Shopworks API 2025 · Steve Art · Transfers_EMB_Stickers_JDS · Xmas Box Labels.
- Controls (already in prod use): Tables 156 · Views 19 · File-folders 10.

---

**Cross-refs:** [CASPIO_REST_API_V4_REFERENCE.md](CASPIO_REST_API_V4_REFERENCE.md) (v4 sibling — bulk/T-SQL/schema-discovery delta) · [CASPIO_API_CORE.md](CASPIO_API_CORE.md) (our proxy API) · [CASPIO_STAFF_AUTH.md](CASPIO_STAFF_AUTH.md) · [LESSONS_LEARNED.md](LESSONS_LEARNED.md) (Triggered-Actions-don't-fire-on-REST) · Zapier zaps (the 24 outgoing webhooks ARE the Zaps — see MEMORY "Zapier rules") · CLAUDE.md "Documentation Entry Points".
