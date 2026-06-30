# Side-Door Remediation Plan — Waves 1–4 (teed up 2026-06-30)

Execution companion to [STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md](STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md) + [PROXY_SIDE_DOOR_AUDIT_2026-06.md](PROXY_SIDE_DOOR_AUDIT_2026-06.md). Caller-mapped across all 3 repos (7-agent workflow). **Golden rule: deploy the CALLER (secret header / SAML route) FIRST, then the proxy gate — never the reverse, or a live staff tool 401s.** Patterns: **A** = server-only caller → add `X-CRM-API-Secret`, gate. **B** = browser caller → add a same-origin secret-injecting route (Flask `_proxy_headers()` or FE `createCrmProxy`), repoint JS, then gate.

Repos: FE `sanmar-inventory-app` · PROXY `caspio-pricing-proxy` (deploy branch `deploy/send-to-steve`) · FLASK `Python Inksoft` → `inksoft-transform` (`git subtree push --prefix web heroku main`). `_proxy_headers()` helper already exists at `Python Inksoft/web/app.py:542`; `createCrmProxy()` at FE `server.js:2371` (live examples 2408-2431); `requireCrmApiSecret`+`gateWritesOnly` at proxy `server.js:7-13`.

---

## ▶ WAVE 1 — zero/low-breakage NOW (do this in the next session). ~0.5 day.
No live browser caller anywhere; worst case a wrong-order deploy 401s a CLI cron. Highest value-per-risk — closes the financial-read leaks + no-caller writes.

**Caller edits first (2 repos):**
1. PROXY cron: `caspio-pricing-proxy/scripts/sync-commissions.js:292-295` — add `headers:{'X-CRM-API-Secret':process.env.CRM_API_SECRET}` to the annual-report `axios.get`.
2. FLASK atmos: `Python Inksoft/web/app.py` — add `headers=_proxy_headers()` to the 3 bare `requests.get`: vendors (~:674), purchase-orders (~:687), supacolor-po-index (~:697). (`CRM_API_SECRET` already set on `inksoft-transform`.) **Deploy FLASK first, verify atmos formatter still loads vendors/POs.**

**Then proxy gates (`caspio-pricing-proxy/server.js`, one deploy):**
- `:769` online-store-commissions → `app.use('/api', requireCrmApiSecret, onlineStoreCommissionRoutes)` (no caller; quarterly-report reuses it in-process via `require()`, not HTTP).
- `:808` rep-audit → `requireCrmApiSecret` (no caller; ⚠️ see decision #4 — the nwca-accounts MCP `rep_audit` tool may call it).
- `:405` production-schedules → `requireCrmApiSecret` (live dashboard uses pre-baked static JS, not the API).
- `:949` assignment-history (whole router) → `requireCrmApiSecret` (reads have no caller; the FE POST at house-accounts.js:1976 already 404s — repaired in Wave 3).
- before `creditCardLookupRoutes` (~:552): `app.use(['/api/vendors','/api/purchase-orders','/api/supacolor-po-index'], requireCrmApiSecret)` (GET reads → must be `requireCrmApiSecret`, not `gateWritesOnly`). Leave the existing `/api/creditcard-atmos` gateWritesOnly (:551).
- `:774` commission-payouts mount → `gateWritesOnly` (gates `POST /save` which has no caller; leaves quarterly-report/approve/mark-paid reachable for Wave 2). Optional: also hard-gate `['/api/commissions/win-back','/api/commissions/history']` with `requireCrmApiSecret` (no callers).
- `PUT /api/quote_items/:id` → path-specific `requireCrmApiSecret` (no caller; builders use DELETE-then-POST) OR defer into the Wave-3 quote-admin router.

**Smoke test:** atmos formatter + InkSoft commissions read + staff dashboards still work; anon `curl /api/rep-audit` + `/api/online-store-commissions/config` → 401.

---

## WAVE 2 — InkSoft Flask-routing (Pattern B, contained to InkSoft). ~1–1.5 days.
Browser hits the public proxy directly OR Flask proxies but doesn't send the secret. **Deploy FLASK first (route + repoint), verify page, then gate proxy.**
- **designs writes** `POST/PUT/DELETE /api/designs`: sole writer = InkSoft Store-Design admin via Flask `app.py:1423/1452/1481` (currently no secret). Wrap each with `_proxy_headers(...)` (delete route sends none — add it). Then gate `designs.js` mount (proxy `server.js:703`) `requireCrmApiSecret` (or `gateWritesOnly` if unsure every Flask GET sends the secret). **Do NOT touch `designs-by-method.js` (`server.js:692-693`) — `GET /api/designs/by-customer/:id` is browser-direct from the PUBLIC quote-builders; must stay public.**
- **commissions** `quarterly-report` (GET, dual caller: `commissions.html:357` browser + cron `sync-commissions.js:136`), `approve` (`commissions.html:615,635`), `mark-paid` (`:640`): add Flask routes `GET/POST /commissions/api/...` that inject `_proxy_headers()`; repoint the template fetches; add secret to the cron axios. **Enforce REAL server-side admin authz in the Flask approve/mark-paid routes** (the `IS_ADMIN` template flag is client-side only — decision #7). Then flip commission-payouts mount to full `requireCrmApiSecret` (also closes win-back+history).

---

## WAVE 3 — FE-dashboard SAML routing (Pattern B on teamnwca.com). ~1.5–2 days.
Reuse `createCrmProxy()`. **Deploy FE first (route + repoint), verify dashboard, then gate proxy.**
- **daily-sales-by-rep** (3 browser callers: rep-crm.js:220, staff-dashboard-service.js:890/906, dashboard-endpoints.js:32): add `app.all('/api/crm-proxy/daily-sales-by-rep*', ...createCrmProxy('caspio/daily-sales-by-rep', ['staff']))`; repoint the 3; then proxy `:713` `gateSalesArchiveWrites` → `requireCrmApiSecret` (gate reads too).
- **assignment-history POST** (house-accounts.js:1976 already targets same-origin `/api/crm-proxy/assignment-history` but no route exists → 404s today): add `createCrmProxy('assignment-history', ['house'])` (decision #5). Proxy already gated in Wave 1 → POST now flows with the secret AND the audit log starts working. Purely additive (no in-flight breakage).
- **quote tamper (admin half only)** — `PUT/DELETE /api/quote_sessions/:id` + `DELETE /api/quote_items/:id` are used by BOTH public builders (revision-save) AND universal-records-admin. **Never blanket-gate the public quotes.js routes.** Instead: new gated proxy `src/routes/quote-admin.js` (`requireCrmApiSecret`) mounted `/api/quote-admin`; FE `createCrmProxy('quote-admin', ['admin'])`; repoint the 4 admin fetches (universal-records-admin.html:1149/1831/1876/1882); hard-gate the public `DELETE /quote_sessions/:id` (zero public callers); **add an admin page-load gate for `/admin/universal-records-admin.html`** (it's `/admin/` not `/dashboards/`, so Staff_Page_Access doesn't cover it — though Wave-A already gated the `/admin` static mount + root alias, confirm). Leave `POST /quote_sessions`, `POST /quote_items`, builder PUT/DELETE-own-PK PUBLIC; the per-quote ownership/SessionID-token check for guessed-PK single-row tamper is **deferred** (decision #6).

---

## WAVE 4 — InkSoft app login (the pages have NO inbound auth). ~0.5–1 day stopgap.
A ~20-line Flask `@app.before_request` gate (option b: shared-secret / HTTP-Basic against env `STAFF_GATE_PASSWORD`) protects every `render_template` page (commissions, atmos-formatter, payroll-journal, gift-certificates, dashboard, sanmar tools) in one shot. Allowlist: `/health` (Heroku check), `/static`, `/api/product-details` (public image), and `/` index transformer (decision #2). Later migrate to option c (reverse-proxy behind FE SAML, reuse Staff_Page_Access RBAC).

---

## Open decisions for Erik (recommendations in **bold**)
1. Wave-4 InkSoft login: ship the **Flask `before_request` shared-secret stopgap (b) now**, migrate to FE-SAML reverse-proxy (c) later.
2. Should the InkSoft `/` index transformer UI be staff-only or public? (determines the allowlist) — **lean staff-only.**
3. Wave-1: OK to gate the no-caller financial reads (rep-audit, online-store-commissions, production-schedules, vendors/POs) NOW and defer `daily-sales-by-rep` (has a live browser reader) to Wave 3? — **yes.**
4. The **nwca-accounts MCP server** (separate repo, not scanned) likely calls `GET /api/rep-audit` server-side via its `rep_audit` tool — after we gate it, that tool 401s unless its HTTP client adds `X-CRM-API-Secret`. Who owns it / add the secret there?
5. `createCrmProxy('assignment-history', [role])` — is **`house`** the right role for the CRM-reconcile audit write, or admin/staff? (admin override applies regardless.)
6. Wave-3 quote tamper: OK to close the **admin surface + hard-gate DELETE `/quote_sessions/:id` now** and defer the per-quote ownership-token check for builder PUT/DELETE? — **yes (removes the mass-edit/delete exposure now).**
7. Wave-2 commissions: confirm the new Flask approve/mark-paid routes must enforce **real server-side admin authz** (not the client `IS_ADMIN` flag) — and against what identity source on the InkSoft app.

**Total Waves 1–4 (stopgap): ~4–5 focused days, caller-first with smoke tests between each cross-repo deploy.**
