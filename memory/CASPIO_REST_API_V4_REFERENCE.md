# Caspio REST API v4 — Platform Capability Reference

> **What this is:** the **v4 delta** on top of [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md) (v3). v4 is a **superset of v3, opt-in, and additive** — our existing v3 integrations (the whole `caspio-pricing-proxy`) keep working untouched. Adopt v4 per-integration on our own schedule. This file documents ONLY what v4 **adds or changes**; shared identity/auth/account facts stay canonical in the v3 doc.
>
> **Sibling to the v3 doc**, not a replacement. Same account (`c3eku948`, OpenAPI **3.0.4**). The v3 file stays authoritative for v3 + the shared OAuth token lifecycle.
>
> **Not the same as [CASPIO_API_CORE.md](CASPIO_API_CORE.md)** — that documents *our proxy's* public API (the Heroku `caspio-pricing-proxy/api` the front-end consumes). THIS documents the *Caspio platform* API the proxy itself calls.
>
> **Source of truth = the live spec, not this file.** Re-fetch any time (public, no auth to READ the contract):
> ```bash
> curl -s "https://c3eku948.caspio.com/integrations/rest/v4/swagger/documentation" -o caspio-swagger-v4.json
> ```
> Interactive UI: `https://c3eku948.caspio.com/integrations/rest/swagger/index.html`.
>
> **Captured 2026-07-09** from the live v4 Swagger. Scale: **63 paths · 107 operations · 12 sections · 106 schemas** · base `/integrations/rest`.

---

## 0) The headline

v4 adds five things v3 didn't have:
1. **Bulk operations with safety rails** — insert / conditional-update / conditional-delete up to **1000** records, `207 Multi-Status` on partial failure.
2. **Full T-SQL** in `select` / `where` / `orderBy` / `groupBy` — aggregates, subqueries, `CASE`, cross-table joins, straight through REST.
3. **Single-call schema discovery** — `/v4/schemas/*` returns every object + full field defs in one response.
4. **First-class file / webhook / app endpoints** (fileAssets, outgoingWebhooks CRUD, Flex/Bridge apps + DataPage deploy, import/export task run).
5. **Machine-readable "AI context"** — a manifest + per-lens specs so an agent can bootstrap and drive the API unaided.

---

## 1) What changed from v3 (the exact deltas)

| Area | v3 | v4 |
|---|---|---|
| **Base path** | `/integrations/rest/v3/...` | `/integrations/rest/v4/...` |
| **Query params** | `q.select`, `q.where`, `q.orderby`, `q.pageSize` (prefixed) | Plain camelCase: `select`, `where`, `orderBy`, `groupBy` — **NO `q.` prefix** |
| **List response** | `{ "Result": [...] }` | `{ "data": [...], "pagination": { totalCount, pageNumber, pageSize } }` |
| **Pagination** | `q.pageSize` + `q.pageNumber` (NEVER `q.limit`) | `pageNumber` + `pageSize` (5–1000, default 25 when paging). `limit` is legacy, ignored when paging; `offset` not honored |
| **Bulk writes** | one record per call | bulk insert / conditional update / conditional delete, ≤1000, `207` partial |
| **Query power** | basic filters | full **T-SQL** in `select/where/orderBy/groupBy` |
| **Schema discovery** | per-object calls | one call → every object + full field defs |
| **Auth** | OAuth `client_credentials` Bearer (shared with v4) | same token model + scoped least-privilege profiles (see §2) |
| **AI support** | — | `info.x-caspio-ai-context` primer, `GET /v4/aiManifest`, per-lens specs, actionable error `Hint`s |
| **App access** | Bridge deploy only | read Flex & Bridge apps, list/read/deploy DataPages |

**Auth is shared, not changed** → token endpoint, `client_credentials` grant, 24h access / 1yr refresh, module-cached client in `caspio-pricing-proxy/src/utils/caspio.js` — all identical to v3. See [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md) §1. v4 adds that each API profile has an **isolated permission boundary** (allowlisted tables/views) enforced application-side **before any SQL runs** — out-of-grant references are rejected as `IncorrectQueryParameter`.

---

## 2) Discovery & AI endpoints (self-describing, no auth to read)

- `GET /v4` — capability root: stability label, rate-limit shape, resource URLs, link to the manifest.
- `GET /v4/aiManifest` — AI domain primer + per-lens OpenAPI links, an `unsupportedByDesign` block, an evaluation rubric.
- `GET /v4/me` — this token's `wsProfileName`, `accountSubdomain`, `tokenExpiresAt`, `rateLimit`.
- `GET /v4/errors` / `GET /v4/errors/{code}` — every error code with machine-readable hint + remediation.
- The same primer is embedded in the spec under `info.x-caspio-ai-context` (~13 KB).

**Lenses** (token-sized spec slices — request one instead of the full 63-path spec):
| Lens | Scope |
|---|---|
| `dataManager` | runtime CRUD — records, directory users, import/export tasks, file library |
| `designer` | structural — defining/modifying views & directories on existing tables |
| `automation` | event-driven — webhooks + table/directory triggered-action rules |

---

## 3) Querying — the T-SQL power feature (biggest v4 win)

Params are plain camelCase (no `q.`):
- **`select`** — comma field names, `*`, or any valid T-SQL SELECT expr: aggregates (`COUNT`,`SUM`,…), scalar subqueries, `CASE`, arithmetic.
- **`where`** — T-SQL WHERE (no keyword): `EXISTS`, `IN` + subqueries, compound conditions across any permitted table.
- **`orderBy`** — e.g. `LastName ASC, FirstName DESC`.
- **`groupBy`** — fields/exprs; supports `HAVING`, e.g. `Status HAVING COUNT(*) > 5`.
- **`limit`** — 1–1000, default 100. Legacy; ignored when `pageNumber`/`pageSize` set.

**Rules that bite:**
- Always reference a field by its **Name**, never its Label.
- Strings need the Unicode prefix in `where`: `N'value'`. Escape single quotes by doubling: `N'O''Brien'`.
- `YES/NO` fields: use `1/0` in `where`, but send JSON `true/false` in write bodies.
- Cross-table subqueries permitted & encouraged; the permission boundary still applies. System catalogs blocked; DDL (`CREATE/ALTER/DROP`) never allowed.

**Why it matters for us:** rich SQL analytics straight through REST — no stored procs, middleware, or pre-built Caspio views. (e.g. `NW_Daily_Sales_By_Rep`-style aggregation could move server-side.)

---

## 4) Write operations & the bulk guardrails

**Single writes** (per table/view/directory `…/records`):
| Verb | Behavior |
|---|---|
| `POST …/records` | insert one; omit Editable-false fields; `201` + new `PK_ID` (or full record with `echo=true`) |
| `PATCH …/records/{pkId}` | partial update — only supplied fields; `null` clears a field |
| `PUT …/records/{pkId}` | update by PK_ID (symmetric with PATCH by design) |
| `DELETE …/records/{pkId}` | delete by PK_ID |

Every write accepts `echo=true` to return the affected record(s).

**Bulk** (the big new capability):
- `POST …/records/bulk` — JSON array, max **1000**. `201` all-ok or **`207 Multi-Status`** partial.
  - **⚠ Response shape — CONFIRM before coding (live-spec read 2026-07-09):** the spec description says bulk POST returns a **`Result[]`** array, each element with a per-item **`Status`** (`201`=created, `4xx/5xx`=failure): `{ "Result": [ { "Status": 201, "PK_ID": "101" }, … ] }`. This **differs from the illustrative `{ "PK_ID":[…], "data":[{status,…}] }`** in the original HTML reference. LIST endpoints still use the `data[]`+`pagination` envelope — bulk and list use **different** envelopes. Verify exact casing (`Result`/`Status`) against a real bulk call before writing a parser.
- `PATCH …/records/bulk` — `BulkUpdateRecordsRequest`: **`where`* required** + **`recordValues`* required**.
- `DELETE …/records/bulk` — `BulkDeleteRecordsRequest`: **`where`* required**.

**⚠ Tautology guard:** an always-true filter (`1=1`, `PK_ID>0`) would hit every row — irreversible for DELETE. When the server's tautology guard is active such unscoped filters are **rejected**. Always target with `PK_ID IN (1,2,3)` or `Status=N'Inactive'`, and **run a `SELECT` with the same `where` first** to confirm the row count.

---

## 5) Data model, files, webhooks, apps (what's newly first-class)

- **Data types (exact tokens):** editable — `TEXT255` `TEXT64K` `NUMBER` `INTEGER` `CURRENCY` `DATE/TIME` `YES/NO` `ATTACHMENT` `LIST-STRING`/`LIST-NUMBER`/`LIST-DATE/TIME` `PASSWORD`; auto (never send in bodies) — `PK_ID` `AUTONUMBER` `SEQUENCE` `RANDOM_ID` `GUID` `TIMESTAMP` `FORMULA`; legacy read-only — `FILE`.
- **Field model:** `FieldModelV4` for create/patch (`name`*, `dataType`*, label, displayOrder, unique, isFormula, format, prefix, length, `listField[]`, `stampOnInsert/Update`+`stampTimeZone`, attachment controls). Reads return richer `FieldItemV4` (+`editable`, `formula`, `relationship`).
- **Schema discovery:** `GET /v4/schemas/tables` (also `/views`, `/directories`, `/outgoingWebhooks`) → every accessible object **with** field defs, `relationships[]`, `triggeredActions[]`, and Bridge/Flex app refs in ONE call. Kills field-list hard-coding.
- **Relationships:** explicit `TableRelationshipItem` (relationshipType, joinType, parent/child table+field, referentialIntegrity, cascadeUpdate/Delete, displayValue).
- **Files — two surfaces:** (1) **File Library** `/v4/fileAssets` — list/search files & folders, upload (`POST` new → `409` if name exists / `PUT` overwrite), download/delete by **fileId (GUID)** or **path**. FILE-field flow: stored path → `GET /v4/fileAssets/files/path/fileInfo` (resolve fileId) → `GET …/files/{fileId}`. (2) **Attachment fields** — per-record binary on tables/views/directory users; single + bulk-by-condition.
- **Webhooks:** full CRUD for outgoing webhooks + events + `PATCH …/{webhookId}/regenerateSecret`. `WebhookEventV4PostRequest`: `type`*, `objectId`* (table/directory), `objectFields[]`, `eventSources[]`, `defaultPayloadIncludesSecret`, `defaultPayloadFields[]`, `customPayloadTemplate`, `enabled`. Triggered-action rules are read-only via schema discovery (`TriggeredActionItem`).
- **Apps & tasks:** Flex apps (list/read); Bridge apps (list/read + DataPages: read, get deployment code, deploy/undeploy one or all); Data Import/Export tasks (list/read + `POST …/{taskId}/run`, `ScheduledTaskInfoV4` status/recurrence/last-run).

> **Carry-over NWCA fact:** **Caspio Outgoing Webhooks FIRE on REST writes** (≠ Triggered Actions, which do NOT). v4 gives full webhook CRUD — reinforces the v3-doc roadmap item to convert polling crons → authenticated push. Same feedback-loop guard applies (scope `eventSources`/`objectFields`, idempotent dedupe).

---

## 6) Error envelope

```
{ "Code":"ERROR_CODE", "Message":"…", "Resource":"/path", "RequestId":"…",
  "DocumentationUrl":"…", "Hint": { "Note":"…", "Remediation":"…" } }
```
Every error links to `/v4/errors/{code}`. **Structural deletes** (deleting a table, folder, or Flex app) return **`405` by design** (schema protection) — not a missing feature.

---

## 7) Full endpoint catalog (107 ops · 12 sections)

- **Schemas (4):** `GET /v4/schemas/{directories|tables|views|outgoingWebhooks}` — object + field/event defs.
- **Table Design (8):** `GET/POST /v4/tables`, `GET /v4/tables/{t}`, `GET/POST …/fields`, `GET/PATCH/DELETE …/fields/{f}`.
- **Table Records (18):** `GET/POST …/records`; bulk `POST` (create-many) / `PATCH` (update-by-cond) / `DELETE` (delete-by-cond); `GET/PUT/PATCH/DELETE …/records/{pk}`; attachments — bulk `DELETE`/`GET`/`PATCH` fileInfo, bulk `POST` upload, `PATCH/DELETE` passwordFields, single `GET/PUT/DELETE …/{pk}/attachments/{f}`.
- **View Design (4):** `GET /v4/views`, `GET …/{v}`, `GET …/fields`, `GET …/fields/{f}`.
- **View Records (16):** mirrors Table Records — **views ARE writable in v4** (POST/PUT/PATCH/DELETE + bulk + attachments).
- **Directory Design (7):** `GET` list/get, `GET/POST` fields, `GET/PATCH/DELETE` field.
- **Directory Users (13):** `GET/POST` users, bulk create/update/delete, `PATCH/DELETE` by UserGUID, `POST …/{u}/activate`, attachment get/put/delete + bulk fileInfo get/rename.
- **File Assets (14):** files `GET` list, `PUT` upload/replace, `GET` search, `POST` bulk; `GET` fileInfo/`GET`/`DELETE` by id; `GET` fileInfo/`GET`/`DELETE` by path; folders `GET` list, `POST` create, `GET` search, `GET {folderId}`.
- **Outgoing Webhooks (11):** `GET/POST` webhooks, `GET/PATCH/DELETE {id}`, `PATCH …/regenerateSecret`, `GET/POST` events, `GET/PATCH/DELETE …/events/{eventId}`.
- **Data Import/Export Tasks (3):** `GET` list, `GET {taskId}`, `POST …/{taskId}/run`.
- **Flex Applications (2):** `GET` list, `GET {appId}`.
- **Bridge Applications (7):** `GET` list, `GET {appId}`, `GET` dataPages, `GET …/{appKey}`, `GET …/{appKey}/deployment`, `PUT …/{appKey}/deployment` (deploy/undeploy), `PUT …/bulk/deployment` (all).

---

## 8) Proxy adoption — the v3→v4 migration chokepoint

**Current state:** `caspio-pricing-proxy` calls Caspio **v3** exclusively. The single migration point is **`caspio-pricing-proxy/src/utils/caspio.js`** — it holds `getCaspioAccessToken()` (module-cached, 60s buffer), `fetchAllCaspioPages()` (pagination), and the base URL `https://c3eku948.caspio.com/integrations/rest/v3`. (A separate legacy file-store base `https://c1abd578.caspio.com/rest/v3/files` appears in `FILE_UPLOAD_API_REQUIREMENTS.md` — different subdomain/base; reconcile if migrating file uploads.)

**High-value v4 wins for us (adopt where they pay off, per-endpoint):**
1. **Bulk conditional writes** instead of per-record loops (respect the tautology guard; SELECT-first).
2. **Single-call schema discovery** (`/v4/schemas/tables`) to stop hard-coding field lists.
3. **T-SQL `where`/`select`** for analytics without pre-built Caspio views.
4. **Outgoing-webhook CRUD** to replace polling crons (webhook-fires-on-REST).
5. `/v4/aiManifest` + lenses for AI-driven tooling.

**Migration checklist per endpoint if we adopt v4:** drop the `q.` prefix → read from `data[]` not `Result[]` → `pageNumber`+`pageSize` → `N'…'` string literals + `1/0` in `where` (but `true/false` in bodies) → confirm the token's profile grants the referenced objects. **Do NOT do a repo-wide bump** — v3 works; migrate an endpoint only when a specific v4 power justifies it, and re-verify the v3 gotchas still hold on v4.

**⚠ 2026-07-09 status:** a standalone copy of this doc could NOT be written into `caspio-pricing-proxy/memory/` because that OneDrive folder is not synced/hydrated on Erik's machine (only `.vscode` is present locally). Proxy-side awareness is currently carried by THIS file + the cross-project pointers ([CROSS_PROJECT_HUB.md](CROSS_PROJECT_HUB.md), which proxy chats read). When the proxy folder is synced, mirror this file to `caspio-pricing-proxy/memory/CASPIO_REST_API_V4_REFERENCE.md` and add the exact `caspio.js` file:line for the base-URL constant + token/pagination helpers.

---

## 9) Caspio 73.0 platform release (2026-07-02) — changes beyond the endpoint list

Source: <https://howto.caspio.com/release-notes/caspio-73-0/> + linked help pages. These ship WITH v4 but several also touch **v2/v3** and the Caspio UI. (`howto.caspio.com` is the canonical Caspio how-to site — a goldmine for building on Caspio.)

- **⚠️ Granular permissions now ENFORCED across the REST API — impacts v2 AND v3, not just v4** (`…/impacted-areas-73-0/`). Endpoints now return **403 Forbidden** when the calling profile lacks object-level permission (previously allowed / different code):
  - **Data Import/Export Tasks** — GET/POST → **403** if the profile's *"Enable access to all objects"* is OFF or it lacks read/execute on the task.
  - **Bridge Applications** — deploy/retrieve → **403** on insufficient perms.
  - **Tables** — password-field ops → **404** (was `-1`) when the field doesn't exist; attachment retrieval → **404** (was `400`) for a missing file.
  - **🔴 NWCA ACTION (potential live impact):** the proxy uses ONE `client_id/secret` across ~397 endpoints. Verify that API profile has *"Enable access to all objects"* ON (Integrations → API Profiles) so calls don't silently start **403**ing, and make `fetchAllCaspioPages`/callers surface a 403 as an auth-scope error (Erik's #1 rule — never swallow). Re-run `caspio-pricing-proxy/scripts/caspio-entitlement-probe.js` to confirm all groups still 200.
- **HMAC-SHA256 signature on every outgoing webhook.** Each outgoing webhook now carries an HMAC-SHA256 signature so a receiver can verify it came from Caspio, unmodified. Secret = the webhook's autogenerated secret (from POST-create / `PATCH …/{id}/regenerateSecret`). **Compatibility mode** (receivers that can't compute an HMAC): include the signing secret in the payload at the event level — v4 `defaultPayloadIncludesSecret:true` / the `[@out-hook:secret]` payload param. **The exact signature header name is NOT in the public help docs** — capture it from the authenticated live v4 Swagger when we build `caspio-webhooks.js` (the planned receiver should verify this header, not only the payload secret).
- **Redesigned API Profile Management** (Integrations → API Profiles): granular default permissions **by object type** + per-object overrides (least-privilege); **generate a bearer token from the UI** and test calls in the built-in Swagger UI; **expanded IP access control (IPv6 + IP ranges)**. This is the UI path to finally split our single-credential blast radius into scoped profiles (the long-standing v3-doc follow-on).
- **⚠️ New IP addresses for Webhooks + Data Import/Export Tasks — update any allowlist.** Current published set (all `/32` IPv4; **US** shown — rest are AU/BR/CA/IE/UK; "may change without notice"): `3.94.26.149 · 3.221.12.171 · 3.223.237.156 · 3.232.188.127 · 18.235.29.217 · 34.200.156.163 · 35.173.3.24 · 44.198.154.72 · 44.219.25.193 · 44.221.229.56 · 54.88.136.246 · 54.224.65.145 · 100.58.20.55`. Full regional list / live truth: webhooks `…/webhooks/ip-addresses-for-webhooks/`, tasks `…/scheduled-import-and-export/ip-addresses-for-scheduled-tasks/`. (Today NWCA's 24 webhooks all target Zapier, so no NWCA-owned allowlist is affected yet — relevant when we stand up our own receiver.)
- **Flex** — Theme Editor (per-Segment themes, live preview, reusable) + Date/Time min/max minute offsets & fixed daily Min/Max Time windows. **Vault** — create app packages from a Flex app's menu.
- **Live inventory source:** the **authenticated** Swagger UI `https://c3eku948.caspio.com/integrations/rest/swagger/index.html` (Erik's login) exposes our live tables/views/apps + full v4 schemas. **✅ Crawled 2026-07-09** (profile `ProdDetailsAPI`, rate limit 2000/300s): **163 tables · 19 views · 1 dir (Staff) · 1 flex · 14 bridge apps · 24 webhooks (all Zapier, `eventSources:["Datasheet"]` — none fire on REST)**. Real object list + key table IDs/schemas → **[caspio-v4-live-inventory-2026-07-09.md](caspio-v4-live-inventory-2026-07-09.md)**. (The webhook **HMAC signature header** is still NOT in the config/spec — it only appears on an actual delivery.)

## 10) Live public-contract read (2026-07-09) — confirmed from the real `c3eku948` spec

The v4 **discovery endpoints are public** (no token to READ the contract): `GET /v4/swagger/documentation` (full OpenAPI) + `GET /v4/aiManifest` were fetched directly. Confirmations + facts NOT in the HTML reference:
- **v4 is OAuth-only.** `aiManifest.unsupportedByDesign`: *"static API keys intentionally not supported → 401."* We already use OAuth `client_credentials`, so we're fine. (The Swagger UI's "Bearer (apiKey)" field just holds the OAuth **access token**.)
- **Structural deletes are `405` BY DESIGN** — DELETE table, DELETE/rename folder (admin-UI-only DDL protection). Flex apps are **read-only** over REST (+ deploy toggle). `limit`+`offset` → offset **ignored** (use `pageNumber`/`pageSize`).
- **Rate limits:** `X-RateLimit-*` headers are *informational*; `429` is infra-tier and may be off in non-prod (don't assume it in tests).
- **`info.x-caspio-ai-context`** is a real ~450-line embedded primer (auth, lens selection, T-SQL, files, bulk safety, eval rubric) for AI/MCP consumers.
- **T-SQL is parsed + AST-allowlisted against the profile grant BEFORE execution** — the manifest explicitly says T-SQL in `where/select` is *not* injection (only cross-grant reads or verbatim DB errors are findings).
- **Still NOT in the spec:** the outgoing-webhook **HMAC signature header name** (webhooks appear only via schema discovery) and exact `X-RateLimit-*` names — capture these from a real authenticated call / live webhook when building the receiver. The **actual table/view/app inventory + field defs** need the token (public read gives the contract, not the data).

---

**Cross-refs:** [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md) (v3 sibling — shared auth stays canonical there) · [CASPIO_API_CORE.md](CASPIO_API_CORE.md) (our proxy's API) · [CROSS_PROJECT_HUB.md](CROSS_PROJECT_HUB.md) (proxy discovers v4 here) · [LESSONS_LEARNED.md](LESSONS_LEARNED.md) (Triggered-Actions-don't-fire-on-REST). **Staff-viewable copy:** `/dashboards/caspio-api-reference.html` (Erik-only, hard code-gated in `server.js`).
