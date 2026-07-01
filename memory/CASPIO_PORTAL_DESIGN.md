# Design: Gated Customer-Safe Portal Endpoint (#1) → Phase-2 Magic-Link Auth (#6)

> Verified design from a 13-agent read-only research workflow (2026-06-29). Every load-bearing claim cites `file:line`. APP = `Pricing Index File 2025` (Express `server.js` + `pages/`); PROXY = `caspio-pricing-proxy`. Companion to [CASPIO_INTEGRATION_TODO.md](CASPIO_INTEGRATION_TODO.md) (#1/#6) and [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md). Full build plan: `~/.claude/plans/delightful-stirring-nygaard.md`.

> **🟢 BUILD STATUS (2026-06-30) — magic-link login, invite-only, lean-first.**
> - ✅ **Phase 0 (live):** Caspio `Customer_Portal_Access` table (Email→id_Customer+Enabled, Erik-managed) + gated proxy `GET /api/customer-portal-access/by-email/:email` (`requireCrmApiSecret`) + `MAGIC_LINK_SECRET` on FE Heroku.
> - ✅ **Phase 1 (live, DORMANT — existing URL-token portal unchanged):** `lib/customer-magic-link.js` (HMAC link token 15min / session cookie 30d), separate **`nwca_customer`** signed cookie + `loadCustomerSession`/`requireCustomer`, `/customer/login` page, `/auth/customer/{request-link,verify,logout}`. request-link = rate-limited + no enumeration + EmailJS template **`template_utvx9iw`** ("Magic Link"). verify = **live `Enabled` re-check** (revoke kills outstanding links). E2E-verified: valid→302+cookie; disabled→302 error; tamper/expiry rejected. ⚠️ Erik to REMOVE the `Cc: erik@` from the EmailJS template before prod (every link would land in his inbox).
> - ✅ **Phase 2 (LIVE 2026-06-30 — the security win):** `/api/portal` is now SESSION-only (`requireCustomer`, id from `req.customerSession.portalCustomer.idCustomer`); the old enumerable `/api/portal/:customerId` aggregate is REMOVED (→404) — **enumeration IDOR closed**. `/portal` is `requireCustomer`-gated; `/portal/:customerId`→`/portal` redirect shim. `resolvePortalCustomer` = session-first, URL-fallback. `customer-portal.js` calls `/api/portal` (no id) + builds detail links from `data.customerId`; 401→login. **DELIBERATE DEVIATION from plan:** kept the URL-cid fallback + `&cid=` on the DETAIL endpoints/links so the un-logged-in **art-approval EMAIL flow keeps working** (those rows are ownership-checked, not enumerable). E2E-verified: `/portal`→login, old agg→404, session→scoped `customerId`+data. Fully gating the detail-page cid is a later step tied to art-approval (#7 write-gating).
> - ✅ **Phase 3 (LIVE 2026-06-30):** `GET /api/portal/orders` (requireCustomer, session `id_Customer`) fetches ManageOrders → ONE fetch feeds BOTH the Orders and Invoices/Balances tables (order rows carry `cur_TotalInvoice`/`cur_Balance`). **paid = total − cur_Balance** (cur_Payments is `null` in this feed; cur_Balance is authoritative). Status from milestone dates. Customer-safe projection (no rep/internal-id/cost). **Spend-summary intentionally OMITTED** (Erik's call — don't surface lifetime total). Live-verified w/ customer 1438 (6 real Takehara orders, genuinely unpaid = correct). UI: Orders + Invoices sections in customer-portal.html + table CSS. **Invoice detail**: `GET /api/portal/invoice/:orderNo` (requireCustomer, **ownership-checked** vs session id_Customer → 404 on mismatch) = header + line items (Size01-06 = S/M/L/XL/2XL/3XL) + totals; on-screen ShopWorks-style page `/portal/invoice/:orderNo` (`pages/customer-invoice.*`) with one-click **PDF download** (html2pdf CDN); portal order#s link to it. NOTE: order API has no bill-to ADDRESS or ship-method (live in SW customer master) — omitted. ⏳ REMAINING for a fully-locked portal: **#7 — gate the art-approval WRITE actions** (approve/revise/rush on the detail pages, still reachable from email links).

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

---

## ✅ Customer Portals ADMIN CONSOLE — SHIPPED 2026-06-30 (FE v2026.06.30.1 + proxy v867)

Staff console `/dashboards/customer-portal-admin.html`, role-gated `requireCrmRole(['admin','accountant','art','sales','taneisha','nika'])` (explicit route). Manages the `Customer_Portal_Access` invite registry.

- **Proxy `src/routes/customer-portal-access.js`:** `GET /` (list, enriched with `account_rep`+`account_tier` from `Sales_Reps_2026` joined by `ID_Customer IN (...)`, best-effort), `POST /` (create; Email unique → 409 dup), `PUT /:pk` (enable/disable/edit), `DELETE /:pk`. Mounted `requireCrmApiSecret`.
- **FE server.js:** crm-proxy mounts `customer-portal-access` + `company-contacts` (PORTAL_ADMIN_ROLES); `POST /api/portal-admin/send-link` (staff-fired magic link — reuses `customerMagicLink.mintToken` + EmailJS `template_utvx9iw`); `GET /api/portal-admin/me` → `repName` via `REP_NAME_BY_EMAIL` (**Ruth="Ruthie Nhoung"** to match Sales_Reps_2026); **preview** = staff-gated READ-ONLY mirror `/api/portal-admin/preview/:id[/orders|/invoice/:no]` reusing `getPortalData`+`projectPortalOrder`+`projectPortalInvoice`; preview PAGES `/portal-admin/preview/:id[...]` re-serve `customer-portal.html`/`customer-invoice.html` (their JS detects the `/portal-admin/preview/` path → fetch the staff endpoints). **Customer security seam UNTOUCHED** — preview needs a staff SAML session; a customer can never reach it.
- **Add-customer search** = `/company-contacts/search?q=` (returns `id_Customer`,`CustomerCompanyName`,`ct_NameFull`,`ContactNumbersEmail`); result shows the account owner so reps recognise their live account.

## ⏳ NEXT portal phases — catalog re-order + reward dollars (scoped 2026-06-30, NOT built)

Reuse map (35-tool Explore):
- **Personalized catalog / re-order — ~100% reusable:** `GET /api/product-details?styleNumber=&color=` + `GET /api/color-swatches` (proxy `products.js`, table `Sanmar_Bulk_251816_Feb2024`) for display; price via `window.QuoteCartEngine.singleItemPreview({method,styleNumber,colorName,sizes})` (`shared_components/js/quote-cart-engine.js:1100`). Customer's bought styles already on hand via invoice line items (`/api/portal/orders` + invoice). NO existing re-order flow; `Quote_Items` holds prior line config. Recommendations = start curated (top-sellers), not ML. Re-order flow decision: rep-quote (safe v1) vs self-serve price+checkout (later; price MUST run the engine).
- **Reward dollars = money/ledger (financial subsystem):** **Head start — gift certs are ALREADY a balance-ledger:** Caspio `Inksoft_Gift_Certificates` (`GiftCertificateNumber`, `CurrentBalance` formula, `History` txn log) + gated `/api/gift-certificates*` (proxy `gift-certificates.js`). NO points/customer-credit ledger yet (net-new: immutable `Customer_Reward_Ledger` entries → balance=sum; Erik-editable accrual-rules table). Redemption flows as order-level `totalDiscounts`/`DiscountPartNumber` in `manageorders-push-client.js:147` (OnSite nets it — no special line handling). Must be server-authoritative + gated + accounting sign-off.

---

## ✅ Phase 5 FOUNDATION — reward dollars (SHIPPED + verified 2026-06-30, FE v2026.06.30.5 + proxy v2026.06.30.3)

**Safe foundation only** (Erik chose): manual staff grants + balance display + redeem-as-request. **NO auto-accrual** (the earn rule — $/product/threshold — is Erik's business call + needs accounting sign-off; build on top of this later).

- **`Customer_Reward_Ledger` Caspio table** = APPEND-ONLY. A customer's balance = `SUM(Amount)`; we never store a mutable balance. Signed entries: `+`=grant, `−`=redeem. Fields: id_Customer, Company_Name, Amount, Type(grant|redeem|adjust), Reason, Order_Ref, Created, Created_By.
- **Proxy `src/routes/customer-rewards.js`** (requireCrmApiSecret): `GET /balance/:id` (balance + recent 20), `GET /ledger/:id` (all, with pk), `POST /entry` (staff write). **Guards:** redeem stored negative; a redeem can never drive the balance below 0 (checks live balance first). All writes STAFF-only.
- **FE (server.js):** customer `GET /api/portal/rewards` (read-only balance) + `POST /api/portal/rewards/redeem-request` (server-checks balance → creates a `Portal_Reorder_Requests` row Source=redeem, **does NOT deduct** — the rep applies it + records the deduction). Admin `POST /api/portal-admin/rewards/entry` (**stamps Created_By from the SAML session** — client can't spoof; that's why it's not a raw crm-proxy write) + `/api/crm-proxy/customer-rewards*` (ledger read) + preview mirror `/api/portal-admin/preview/:id/rewards`.
- **UI:** portal gold **reward card** (shows when balance>0) + redeem modal (`customer-portal.{html,js,css}`); admin per-customer **"Rewards" 💰 button** → modal (balance + ledger + grant/adjust form) in `customer-portal-admin`.
- **Verified in Erik's browser:** admin grant $50 → balance+ledger (Created_By=erik@) → customer preview shows "$50.00" reward card + Redeem. Ledger math + overdraw guard unit-verified (grant 25 → redeem 10 → 15; redeem 100 blocked).
- **NEXT (Phase 5 full):** auto-accrual rules table (Erik-defined) + accounting sign-off; then earn-on-order automation. Gift-cert ledger `Inksoft_Gift_Certificates` is the precedent.

## ✅ Portal-page REFINEMENTS (SHIPPED + browser-verified 2026-07-01, FE v2026.07.01.2)

Erik's 6-item punch-list on the portal page — all live (`server.js` portal section + `pages/customer-portal.{html,js,css}`):
1. **Rebrand** "Design Portal" → **"Your Account"** (h1 + `<title>` + tab). Alternatives offered (Customer Hub / My NWCA / Account Portal) — Erik didn't pick, so "Your Account" stands; trivially swappable in the h1/title/JS if he wants another.
2. **"Your Company" bug fixed** — `resolvePortalCompany(cid)` fallback: when a customer has no art/mockups the aggregate's name is null, so we resolve it from order-history `CustomerName`. Wired into BOTH `/api/portal` (~3246) and preview mirror (~3699). Verified 8891 → "Adam's DJ Service & NW Event Lighting".
3. **Re-order modal rebuilt** — shows the **color the customer actually ordered** (`portalMatchColor`, punctuation-insensitive `COLOR_NAME`/`CATALOG_COLOR` match — fixes the old "Jet Black showed white" bug) + garment image; **color dropdown** from new `GET /api/portal/product-colors/:style` (+ preview mirror) flags the ordered color "(your last order)" and swaps the image on change; **per-size qty grid** (S/M/L/XL/2XL/3XL) pre-filled from the last order's `Size01-06` (`portalSizeMap`), running total → `size_breakdown` ("S:2, M:4") + total qty POSTed to `/api/portal/reorder-request` (proxy already writes `Size_Breakdown`). NOTE: prefill only populates when the ShopWorks line item broke out sizes; qty-in-LineQuantity orders open with an empty (editable) grid — acceptable.
4. **Recommendations** — `productCardHtml` renders a **"Coming soon"** striped placeholder when a rec has no product image (`rec.comingSoon = !pd.image`); button label "Ask for a quote".
5. **Order status simplified** — `portalOrderStatus` returns only **"Invoiced"** (has `date_Invoiced`) or **"In Process"**; the Orders table **"Shipped" column was removed** (header + shipDate cell). Verified: all 5 Adam's orders show "Invoiced", 6-col table.
6. Section order left as-is (Products → Recs → Mockups → Art → Orders → Invoices) — orders stay near the bottom (reference, below the re-order CTAs).

Deploy note: shipped **portal-only** — the shared checkout had unrelated uncommitted work on `quote-cart-engine.js` (pricing engine!) + the screenprint-customer calculator; staged the 4 portal files by explicit path (NOT `git add -u`) so that work was left untouched. Zero console errors on the live preview.

## ✅ Portal-page COHESIVE REDESIGN (SHIPPED + browser-verified 2026-07-01, FE v2026.07.01.3)

Erik: "the entire order dashboard page looks like a hodgepodge." Full-file rewrite of `pages/css/customer-portal.css` + section reorder in the HTML + 3 tiny JS edits. Built via a 3-lens design panel → synthesis → adversarial review (Workflow tool; 2 confirmed WCAG contrast fixes applied, 0 regressions).
- **One design language**: single token scale (`--cp-border/-shadow-1/-shadow-2/-ink/-ink-soft/-ink-mute/-gap/-section-y` + gold `--cp-gold*`) replaces the ad-hoc mix of `#e0e0e0/#f0f0f0/#ddd` borders, three shadows, and five inks. **Collapsed the TWO divergent card grids** (`.cp-card` 280px/shadow/no-border vs `.cp-product-card` 180px/border/no-shadow) onto ONE card shell (both share surface+border+shadow+radius+hover-lift; only grid min-width differs).
- **Section order** now: banner → rewards → Your Products → Recommended → **Orders → Invoices** → **Mockups → Art & Designs**. Orders/Invoices are the hero (moved up); Mockups + Art sink to the bottom as an intentional **gold "Coming Soon" pair** (`.cp-soon-pill` in header ALWAYS + `.cp-soon-panel` rich dashed empty state with a green Call CTA) — but real cards STILL render for customers who have them (`renderMockups`/`renderArtRequests` card paths untouched; only the empty branch flips `block`→`flex`).
- **Tables redesigned** (`.cp-table`): branded uppercase header, zebra rows, tabular-lining numerics, bold last-money column, green order-# links w/ focus ring.
- **One status-badge system** (tinted fill + matching border + AA ink + redundant color DOT `::before`). **Fixed 2 live bugs**: `In Process` had NO css class (naked pill) → `.cp-status--in-process`; payment `'—'` (zero-total) made junk slug `cp-status--—` → `renderStatusBadge` now routes null AND `'—'` to `.cp-status--neutral` and slugs on `[^a-z0-9]+`.
- Staff-preview ribbon untouched. Zero console errors. Verified on 8891 (Invoiced=violet, Paid=green pills; both Coming-Soon panels; unified cards).
