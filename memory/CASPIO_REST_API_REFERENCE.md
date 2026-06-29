# Caspio REST API v3 — Platform Capability Reference

> **What this is:** a *map* of what the Caspio **platform REST API** (the Swagger surface) can do, what NWCA already uses, what's untapped, and the gotchas we've verified. This is the integration-design counterpart to the other backend references ([SANMAR_API_REFERENCE.md](SANMAR_API_REFERENCE.md), [MANAGEORDERS_COMPLETE_REFERENCE.md](MANAGEORDERS_COMPLETE_REFERENCE.md)).
>
> **Not the same as [CASPIO_API_CORE.md](CASPIO_API_CORE.md)** — that documents *our proxy's* API (the Heroku `caspio-pricing-proxy/api` endpoints the front-end consumes). THIS file documents the *Caspio platform* API that the proxy itself calls.
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
- `GET /v3/tables/{t}/passwordFields` · `PUT/DELETE /v3/tables/{t}/passwordFields/{pf}` — set/verify (`CheckPasswordFieldContext` + `q.where`) / reset a password field server-side
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
- **Plan-gating (verify before building):** Outgoing Webhooks, Directories, multicast `OutgoingUrls`/`CallThrottling`, Bridge deploy PUT, and attachment storage quota are account-tier dependent. Probe with a read/test call first (`GET /v3/outgoingWebhooks`, `GET /v3/directories`, `GET /v3/dataImportExportTasks`) — 403/404 = not entitled.
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
| **Outgoing Webhooks** | ❌ Untapped | zero `outgoingWebhooks` refs; note `box-webhooks.js` is *Box*, not Caspio. Polling crons stand in. |
| **Directories / Users** | ❌ Untapped | staff use a Caspio **App login** (`c3eku948.caspio.app/users/55u0q8…`) but the Directories REST API is unused; `CRM_PERMISSIONS` map is hardcoded in `server.js` |
| **Data Import/Export Tasks** | ❌ Untapped | our syncs are bespoke Node scripts, not Caspio import tasks — likely zero applicable targets |
| **Bridge Applications** | ⚠️ Scripts only | read-only `explore-bridge-apps.js` / `dump-all-datapages.js`; deploy PUT unused |

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

**Also worth it:** event-driven `ArtRequests.Status` notifications (start with status flips — not covered by note fan-out, so no double-fire); server-side `q.groupBy` aggregation for `NW_Daily_Sales_By_Rep` (`daily-sales-by-rep.js:68`, keep JS fallback).

**Deliberately skipped (don't pay off):** Box→Caspio attachment migration; `passwordFields` as a login store; Directory logins for the *customer* portal (no-login is the UX value — HMAC-sign instead); schema-via-REST migrations on the masters; `dataImportExportTasks/run` (no targets); Views & DataPage deploy-toggle (no concrete pain today).

---

**Cross-refs:** [CASPIO_API_CORE.md](CASPIO_API_CORE.md) (our proxy API) · [CASPIO_STAFF_AUTH.md](CASPIO_STAFF_AUTH.md) · [LESSONS_LEARNED.md](LESSONS_LEARNED.md) (Triggered-Actions-don't-fire-on-REST) · CLAUDE.md "Documentation Entry Points".
