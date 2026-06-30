# Staff Dashboard "Is It Sealed?" Audit + Remediation (2026-06-30)

**Trigger:** Erik asked "is the staff dashboard sealed — only NWCA staff via login, no backdoors?"
**Method:** 58-agent adversarial Workflow audit (map → live anonymous curl probe → adversarial verify → synth), then live re-verification by hand.
**Verdict:** The **login itself is solid** (SAML signature-verified, session HMAC-signed + unforgeable, no forgeable/legacy login, no dev/`NODE_ENV`/host backdoor). But the audit found **anonymous backdoors AROUND the gate** + a wide-open proxy data layer. Was **NOT sealed**. The CRITICAL holes are now closed (below); a defined Phase-3 round remains.

## ✅ CLOSED + live-verified (2026-06-30)

### Front-end staff PAGES (FE `server.js`, deploy `4ddcd47d`)
- **`%2e` URL-encoding bypass** — the `/dashboards` gate only ran when `req.path` literally ended `.html`; `/dashboards/access-admin%2ehtml` skipped it and `express.static` decoded + served the page (HTTP 200). FIX: new `gateStaffHtml(req,res,next)` **decodes + lowercases the path BEFORE the `.html` test**; `gateStaffPage` also decodes the filename for the rule lookup. Verified closed for `%2e`/`%2E`/uppercase-path/`%252e`(404)/`%00`(404).
- **Ungated sibling static mounts** — `/admin`, `/vendor-portals`, `/tools` re-served the same staff `.html` with no gate. FIX: `gateStaffHtml` registered BEFORE each `express.static`. `/admin` **exempts `c112-bogo-promo.html`** (customer-facing promo). `/art-tools` left open (customer art-approval lives there); `/mockups`/`/email-templates` left (info-only).
- **Ungated root-alias routes** — 8 `app.get('/x.html', …)` `sendFile`'d staff dashboards with no middleware. FIX: added `gateStaffPage` to: `ae-dashboard`, `art-hub-steve`, `art-hub-ruth`, `art-invoices-dashboard`, `bundle-orders-dashboard`, `universal-records-admin`, `announcements-create`, `announcements-manage`.

### Proxy data (gift-certs + atmos — the Inksoft round, started)
- **`/api/gift-certificates` fully gated** (`requireCrmApiSecret`, proxy `f5e051e`) — closes anonymous dump of 495 **redeemable codes + balances + customer PII** AND the destructive anonymous `DELETE /clear`. Sole consumer = Python InkSoft Flask (server-side), now sends `X-CRM-API-Secret` (`inksoft-transform` deploy `ec6fe4f`). `CRM_API_SECRET` set on `inksoft-transform` (64-char, matches proxy).
- **`/api/creditcard-atmos` writes gated** (`gateWritesOnly`, proxy `a602c7d`) — closes anonymous WRITE to the BofA reconciliation table. Flask atmos formatter sends the secret. GET lookups under the router stay open (deferred reads).

**Solid (audit-confirmed, no fix needed):** SAML response-signature verified vs pinned `SAML_IDP_CERT`; cookie-session HMAC-signed w/ fail-closed `SESSION_SECRET` boot guard; legacy `POST /api/crm-session` neutered; no query/header login, no localhost/`.herokuapp` auth bypass.

## ⏳ REMAINING — Phase-3 "browser-staff / Inksoft" round (NOT yet closed)
Gating these naively breaks live staff tools, so each needs its caller handled first (Pattern A = add secret to a server-side caller; Pattern B = route a browser caller through Flask/FE same-origin proxy, then gate). See [PROXY_SIDE_DOOR_AUDIT_2026-06.md](PROXY_SIDE_DOOR_AUDIT_2026-06.md).

**Anonymous WRITES still open:**
- `POST /api/commissions/approve|save|mark-paid` — browser-direct (InkSoft Bonus Dashboard uses `api_base`=proxy URL). Pattern B (route through Flask).
- `POST/PUT/DELETE /api/designs` — InkSoft store→design map (drives the InkSoft→ShopWorks push). Writer unverified (likely a sync script/tool); FE quote-builders only READ `/api/designs/by-customer`.
- `POST /api/assignment-history` — forge CRM audit records. No FE/Flask code caller found (likely a server/MCP process) — verify writer before gating.
- `DELETE/PUT /api/quote_sessions` + `/api/quote_items` — anonymous quote tamper/delete (universal-records). Tangled with customer quote-SAVE (POST) — gate DELETE/PUT only, carefully.

**Anonymous financial READS still open** (page now gated, but the API isn't):
- `GET /api/caspio/daily-sales-by-rep` (per-rep YTD revenue), `/api/commissions/*` reports, `/api/online-store-commissions/*`, `/api/vendors` (460 AP payees) + `/api/purchase-orders`, `/api/rep-audit`, `/api/assignment-history` (read), `/api/production-schedules`.

**Bigger item:** the **Python InkSoft Flask app itself has NO login** — its Bonus Dashboard, gift-cert page, atmos formatter, payroll-journal pages are all publicly reachable (the page *and* their APIs). Needs app-level auth (separate project).

**Left deliberately (verify before gating):** `/ae-art-dashboard`, `/ae-submit-art` (audit: inert stubs), `/art-invoice-view.html` + `/art-invoice-unified-dashboard.html` (show a customer panel + EmailJS — confirm staff-only vs customer-share link first).

## Key gotcha (→ LESSONS_LEARNED)
**A path-prefix gate is NOT a file gate.** `app.use('/dashboards', gate)` + `express.static('dashboards')` is bypassed three ways: (1) URL-encode the extension (`%2e`→`.`, decoded by static but not by the raw-`req.path` suffix test); (2) the SAME files mounted under a sibling `express.static` dir; (3) a root-level `app.get … sendFile` alias to the same file. Gate by the RESOLVED, DECODED filename and gate every mount/alias that can serve the file — never trust the raw `req.path` suffix.
