# Design: Gated Customer-Safe Portal Endpoint (#1) → Phase-2 Magic-Link Auth (#6)

> Verified design from a 13-agent read-only research workflow (2026-06-29). Every load-bearing claim cites `file:line`. APP = `Pricing Index File 2025` (Express `server.js` + `pages/`); PROXY = `caspio-pricing-proxy`. Companion to [CASPIO_INTEGRATION_TODO.md](CASPIO_INTEGRATION_TODO.md) (#1/#6) and [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md). Full build plan: `~/.claude/plans/delightful-stirring-nygaard.md`.

> **🟢 BUILD STATUS (2026-06-30) — magic-link login, invite-only, lean-first.**
> - ✅ **Phase 0 (live):** Caspio `Customer_Portal_Access` table (Email→id_Customer+Enabled, Erik-managed) + gated proxy `GET /api/customer-portal-access/by-email/:email` (`requireCrmApiSecret`) + `MAGIC_LINK_SECRET` on FE Heroku.
> - ✅ **Phase 1 (live, DORMANT — existing URL-token portal unchanged):** `lib/customer-magic-link.js` (HMAC link token 15min / session cookie 30d), separate **`nwca_customer`** signed cookie + `loadCustomerSession`/`requireCustomer`, `/customer/login` page, `/auth/customer/{request-link,verify,logout}`. request-link = rate-limited + no enumeration + EmailJS template **`template_utvx9iw`** ("Magic Link"). verify = **live `Enabled` re-check** (revoke kills outstanding links). E2E-verified: valid→302+cookie; disabled→302 error; tamper/expiry rejected. ⚠️ Erik to REMOVE the `Cc: erik@` from the EmailJS template before prod (every link would land in his inbox).
> - ✅ **Phase 2 (LIVE 2026-06-30 — the security win):** `/api/portal` is now SESSION-only (`requireCustomer`, id from `req.customerSession.portalCustomer.idCustomer`); the old enumerable `/api/portal/:customerId` aggregate is REMOVED (→404) — **enumeration IDOR closed**. `/portal` is `requireCustomer`-gated; `/portal/:customerId`→`/portal` redirect shim. `resolvePortalCustomer` = session-first, URL-fallback. `customer-portal.js` calls `/api/portal` (no id) + builds detail links from `data.customerId`; 401→login. **DELIBERATE DEVIATION from plan:** kept the URL-cid fallback + `&cid=` on the DETAIL endpoints/links so the un-logged-in **art-approval EMAIL flow keeps working** (those rows are ownership-checked, not enumerable). E2E-verified: `/portal`→login, old agg→404, session→scoped `customerId`+data. Fully gating the detail-page cid is a later step tied to art-approval (#7 write-gating).
> - ⏳ **Phase 3:** `/api/portal/{sales,orders,invoices}` (customer-safe projections, secret-sending proxy fetch) + UI sections.

## 1. Customer data model & exposure
**Canonical key = ShopWorks customer number**, under 4 column names (why the join is in the browser today): `CompanyContactsMerge2026.id_Customer` (`PROXY company-contacts.js:512,174`) · `ArtRequests.Shopwork_customer_number` primary / `id_customer` alt (`PROXY art.js:99-101,94-97`) · `Digitizing_Mockups.Id_Customer` (`PROXY mockup-routes.js:273-280`). All the same integer; a single server-side join is feasible (friction = per-table casing/quoting).

**ACTIVE LEAK to close now:** `customer-portal.js:29` calls `/api/company-contacts/search?q=<id>&searchById=true`, but **`searchById` is silently ignored** — the proxy runs `Company_Name/ct_NameFull/Email LIKE '%<id>%'` (`company-contacts.js:149`). A numeric id can substring-match **unrelated companies**, returning their full sensitive projection over the wire. Replace with exact `by-customer/:id`.

**Deep-link key bug (fold in):** portal art cards link `/art-request/<PK_ID>` (`customer-portal.js:272`) but the detail page queries `?id_design=` → `ArtRequests.ID_Design` (`art-request-detail.js:228`). Passing PK_ID into an ID_Design filter only works if `PK_ID==ID_Design` — **unverified**. Normalize on `ID_Design` end-to-end.

**Sensitive fields leaked to the unauthenticated browser today** (proxy returns raw rows — `SELECT *` ArtRequests `art.js:148-151`, unprojected mockups `mockup-routes.js:328-332`, full contacts `company-contacts.js:519`):
- Contacts: `Email_Salesrep`, `Sales_Rep`, `Account_Owner`, `Customer_Warning`, `Is_Tax_Exempt`/`Tax_Exempt_Number`, `Account_Tier`, `Customer_Type`, **`YTD_Sales`**, customer `Email`/`Phone`.
- ArtRequests: `Sales_Rep`, `User_Email`, `NOTES`, `Prelim_Charges`, `Additional_Services`, `Amount_Art_Billed`, `Art_Minutes`, `CustomerServiceRep`, `Happy_Status`.
- Mockups: `AE_Notes`, `Submitted_By`, `Sales_Rep`, `Work_Order_Number`, `Deleted_By`.
- `/api/art-charges` (`art.js:1533`): `Cost`, `Minutes`, `Running_Total_Cost`, `Logged_By` — internal labor accounting, **never customer-facing**. Notes (`/api/design-notes`, `/api/mockup-notes`) expose internal `Note_By`/`Note_Type`.

**Rule:** projections are **allowlists** (copy only safe fields into a new object), never blocklists — mirror order-status (`server.js:2740`, leak-warning `:2672-2675`).

## 2. #1 endpoint design
**Host on APP `server.js`, NOT the proxy:** (a) HMAC machinery already there (`computeOrderStatusToken` `:620`); (b) same origin as `PUBLIC_SITE_ORIGIN` (`:626`) so Phase-2 can set a **first-party session cookie** (proxy is cross-origin, `:356`); (c) proxy stays a dumb relay. App fetches raw rows server-to-server, projects down — raw rows never reach the browser.

**New routes:** `GET /api/portal/:customerId` (aggregate `{company,mockups[],artRequests[]}`) · `GET /api/portal/mockup/:id` · `GET /api/portal/art-request/:designId`.

**Token:** `computePortalToken(id)=HMAC-SHA256(String(id), PORTAL_SECRET).slice(0,N)` — new env `PORTAL_SECRET` (do NOT reuse `ORDER_STATUS_SECRET`). Recommend **16–20 hex** (portal exposes whole art history vs low-value status's 12). `buildPortalUrl=${PUBLIC_SITE_ORIGIN}/portal/<id>?t=<token>`.

**503/404 (no-oracle, mirror `:2679-2699`):** 503 if no `PORTAL_SECRET` (no fallback); `timingSafeEqual` after length pre-check; bad token → generic 404. **Divergence:** aggregate route — a valid customer with zero items returns **`200 {mockups:[],artRequests:[]}`** (empty ≠ not-found, else token validity leaks); only a BAD TOKEN 404s. Upstream Caspio throw → 503 AFTER token passes.

**Rate limit:** dedicated `portalLimiter` (clone `orderStatusLimiter` `:2664-2668`, separate bucket from checkout's `strictLimiter`).

**Projection (allowlist per page):** company.name only; mockup cards = `ID,Design_Number,Design_Name,Print_Location,Mockup_Type,Status,Submitted_Date,Box_Mockup_1`; art cards = `ID_Design,Design_Num_SW,GarmentStyle,GarmentColor,Order_Type(text),Status,Date_Created,MAIN_IMAGE_URL_1`. Move image-presence + `>=2026-01-01` filters server-side. Detail routes add customer-authored notes only (exclude `Note_Type ∈ {status_change,ae_instruction,internal}`) and **zero** art-charges. Collapse Status to a customer-safe ladder (like `:2710-2724`).

**Forward-compat seam (the key win — URL token now → session later, ZERO core change):**
1. **Identity resolver middleware** → sets `req.portalCustomerId`. Phase 1: verify `?t=`. Phase 2: read verified session cookie. Interchangeable.
2. **Shared core** `getPortalData/getPortalMockup/getPortalArtRequest(customerId)` → proxy fan-out + allowlist projection. **Written once, never changes between phases.** Per-customer **authorization** lives here: every query scoped to `req.portalCustomerId`; detail routes assert row.customer == req.portalCustomerId (token for N can't widen to M).

**Repoint:** `customer-portal.js` → one `/api/portal/:id?t=` call (delete 4-step chain); `mockup-detail.js`/`art-request-detail.js` → gated detail endpoints in the `?view=customer` branch ONLY (staff path = #2, untouched).

## 3. Phase-2 auth = magic-link (NOT Caspio Directory) — verified
- **Caspio REST CANNOT authenticate an end-user.** Snapshot = 41 paths, **zero** login/session/verify endpoints; only security scheme is the machine `client_credentials` Bearer authenticating the PROXY. Directories REST = user MANAGEMENT only (create/activate/list). `passwordFields` PUT **writes** a hash; it does **not** verify (corrects CASPIO_REST_API_REFERENCE.md overstatement). Caspio end-user auth only via hosted DataPages (brittle `[@authfield]`) or SAML (custom-SP + plan-gating **unverified**).
- **Magic-link** reuses the existing registry (`CompanyContactsMerge2026.Email`; reverse lookup `GET /api/company-contacts/by-email/:email` exists `company-contacts.js:535`), keeps the server authoritative (closes the #2 client-trust gap), no per-customer Caspio account, no password-reset burden.
- **Email capability CONFIRMED (the "EmailJS frontend-only" assumption was WRONG):** APP already POSTs `api.emailjs.com/.../send` and emails customers the order-status link (`server.js:640,722,792`); PROXY has `@emailjs/nodejs` (`send-art-note-email.js`). Send the magic link from the **APP path** (service `service_1c4k67j` — distinct from PROXY's env service ID; choose deliberately).

**Magic-link flow:** email entry → request-link endpoint looks up `/api/company-contacts/by-email` → **always identical generic response** (no enumeration) → if matched, mint **random ≥128-bit** token (`crypto.randomBytes`, NOT the deterministic order-status derivation), store only its **hash** `{customerId,email,exp 10-15min,consumed:false}`, email `…/portal/login/<token>` (path segment dodges `=`-mangling) → click → verify endpoint timing-safe compares hash, checks not-expired/not-consumed, **atomically marks consumed**, creates session w/ customerId → resolver (§2) serves data from the SAME core.

**Session:** distinct key (`req.session.portalCustomer`), NOT `crmUser` (avoid `requireCrmRole` confusion). **MemoryStore today (`server.js:453-463`, no store option) loses sessions on every Heroku restart → a durable store (Redis) is a Phase-2 PREREQUISITE**; single-use token store also net-new (Caspio `Magic_Link_Tokens` table or Redis). **Avoid the `SESSION_SECRET||'dev-secret'` anti-pattern (`:454`).**

**Registry gap:** `CompanyContactsMerge2026` skips ManageOrders orders with no `ContactEmail` (`company-contacts.js:675-688`) → a customer with art but no contact-email row can't magic-link until a contact exists.

## 4. Build sequence for #1
1. APP `server.js`: `PORTAL_SECRET` + `computePortalToken()`/`buildPortalUrl()` by the order-status helpers (`:620-629`).
2. APP: `portalLimiter` (clone `:2664-2668`).
3. APP: identity-resolver middleware (token branch only) → `req.portalCustomerId`, structured for a Phase-2 session branch.
4. APP: `getPortalData/getPortalMockup/getPortalArtRequest` core (server-to-server proxy GETs + allowlist projections).
5. APP: register the 3 routes w/ `portalLimiter` + resolver; 503/404/empty rules.
6. APP `dashboards/js/portal-directory.js`: the **only** `/portal/` link generator (`:233` Open, `:284` Copy) — update BOTH to append `?t=` (else Copy leaks an unsigned/soon-broken link).
7. APP `pages/js/customer-portal.js`: repoint to the aggregate endpoint; delete the chain.
8. APP `pages/js/{mockup-detail,art-request-detail}.js`: repoint reads in the `isCustomerView` branch only.
9. Normalize the art deep-link key (`PK_ID` vs `ID_Design`) → `ID_Design`.

**Do NOT touch (= #2):** any write endpoint (`PUT/POST` art/mockup status/note/fields/charges), the staff `!isCustomerView` paths, `POST /api/crm-session`. Customer token must NEVER grant write. (The legit customer approve/request-revision writes `art-request-detail.js:4181,4271` are a separate narrow surface for later.)

**Grace window:** `/portal/` links shared out-of-band, no registry of who holds bare-id links. **Recommend STRICT** (bare links break immediately; reps re-copy) — the leak today (YTD/staff-email/cross-company) outweighs link churn. Soft deprecation only if many live links circulate.

## 5. Open decisions for Erik
| # | Decision | Recommendation |
|---|---|---|
| 1 | Phase-2 auth | **Magic-link** (Caspio REST can't authenticate — verified) |
| 2 | Email channel | **APP EmailJS** (already emails customers order-status links) |
| 3 | Portal token length | **16–20 hex** (vs order-status 12) |
| 4 | Grace window | **Strict** (real leak today; reps re-copy) |
| 5 | Detail-link token | **Carry customerId token + server-side authorize** the resource belongs to that customer |
| 6 | Phase-2 session store | **Add Redis/durable** (MemoryStore loses sessions on deploy) — prerequisite for #6, not #1 |
| 7 | Customer scale/email coverage | **Measure first** — `CompanyContactsMerge2026` row + Email-non-null counts before committing to magic-link volume |

**Unverified — do not build on:** `PK_ID==ID_Design` always; custom-SP SAML feasibility/plan-gating; exact full table column lists (derive the safe-field allowlist from live schemas before coding projections); whether `?t=` survives every EmailJS template (order-status `&t=` works — test the portal template; path-segment is the safe fallback).
