# Staff Dashboard Auth (#2) — Security Design

> Verified design from an 11-agent read-only research workflow (2026-06-29). All 5 research areas returned "solid." DESIGN ONLY — no code. Cites real `file:line`. Companion to [CASPIO_INTEGRATION_TODO.md](CASPIO_INTEGRATION_TODO.md) #2, [CASPIO_STAFF_AUTH.md](CASPIO_STAFF_AUTH.md) (current flow), [CASPIO_REST_API_REFERENCE.md](CASPIO_REST_API_REFERENCE.md).

## 1. The trust gap (confirmed, exploitable NOW)
Two identity surfaces that never cross-check: a real-but-browser-only Caspio identity, and the Express session the server gates on. The client controls the bridge.
- `/staff-dashboard.html` → `res.sendFile` with **no gate** (`server.js:2392`). Page embeds a hidden Caspio DataPage (`staff-dashboard-v3/index.html:56-62`) that resolves `[@authfield:First_Name/Email/Role]` **in the browser** — the only real auth, and Express never sees it.
- Browser scrapes that name/email and POSTs it (`dashboards/staff-login.html:259-265`) → `POST /api/crm-session {name,email}` (`server.js:2124`), which does `firstName = name.split(' ')[0]`, looks up `CRM_PERMISSIONS[firstName]` (`server.js:469`), and mints `req.session.crmUser` (`:2144`) with **zero verification the caller logged into Caspio**.
- **`curl -X POST .../api/crm-session -d '{"name":"Erik"}'` → full-admin session.** Every `requireCrmRole` gate (`server.js:476`) is then satisfied. No Caspio account needed.

**Aggravating (all confirmed):**
- **Fail-open secret:** `secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production'` (`server.js:454`). If unset in prod, anyone who knows this published literal can **forge a signed session cookie offline** — bypassing the endpoint entirely. ⚠️ VERIFY IT'S SET ON HEROKU (see Open Questions).
- **MemoryStore** (no `store:` at `server.js:453`) — sessions die on dyno restart, don't span dynos.
- **Ungated HTML:** only **3 of 25** dashboards gated (`server.js:2191-2199`); the rest fall through the bare static mount (`server.js:2330`) — ae-dashboard, quote-management, art-invoices, etc. publicly fetchable.
- **Public proxy:** `caspio-pricing-proxy` is "no auth, all endpoints public" — same data reachable directly even if Express is fixed.

## 2. Trust-boundary verdict (the load-bearing answer)
**The Express server CANNOT verify a Caspio session — and can't be made to with Caspio's current surface.**
1. `www.teamnwca.com` is **Heroku-served Express** (`server.js:419-428` redirects on `req.hostname==='teamnwca.com'`; `trust proxy:1` reads Heroku headers — Caspio is not in the request path). The Caspio cookie is first-party to `c3eku948.caspio.com` (different registrable domain) → never sent to teamnwca.com.
2. Caspio REST v3 has **zero** authenticate/login/session/verify endpoints (41-path snapshot). Directories = user *management*; `passwordFields PUT` = write-only setter, not a verifier.

**Implication:** any "browser reads `[@authfield]` → POSTs identity" shape is unfixable in principle. The fix must introduce a **new server-verified identity** (external IdP the server cryptographically checks, or a server-issued signed assertion). Caspio Directory can be the **role-of-record store**, never a live-login verifier.

## 3. Recommended architecture
> ⚠️ **CORRECTION (Erik, 2026-06-29 PM): staff are NOT on Google.** DNS proves the company runs **Microsoft 365** (MX → `*.ess.barracudanetworks.com` Barracuda filter; SPF `include:spf.protection.outlook.com` → Outlook/Exchange Online mailboxes). So Google OAuth is OUT. The §2 trust-boundary verdict is unchanged (still need a server-verified IdP); only the *which* changes. **Revised options (decision pending):**
> - **A′. Microsoft 365 / Entra ID OAuth ("Sign in with Microsoft")** — the direct equivalent of the Google plan, using the platform they already have. Verify the Microsoft-signed ID token + restrict to THEIR Entra **tenant id (`tid`)** (not just any Microsoft account). Same S–M effort. Best if each staff member has/uses an individual M365 login. *Likely new PICK.*
> - **D′. Magic-link email** — staff click a one-time link sent to their `@nwcustomapparel.com` inbox (proves mailbox control = identity, regardless of host). No SSO platform dependency; **reuses the EmailJS sender + the customer-portal magic-link work (#6)** — one mechanism for both. Friendlier if staff don't each log into Microsoft directly. Slightly clunkier UX (inbox round-trip).
> - **★ Caspio App Connection (custom SAML 2.0) — CONFIRMED + NEW PICK (screenshots 2026-06-29 PM).**

### ★ PICK: Caspio App Connection (custom SAML 2.0) — reuse the existing Caspio staff login
**Confirmed from Erik's Caspio admin (Directory "Staff" `55u0q8`):**
- Staff = 11 users, all **Sign-in method "Caspio"** (native Caspio passwords), **Role field EMPTY** for all, 2FA available but OFF.
- **"Identity providers" tab is plan-gated** (external IdP → Caspio = "SAML in") — NOT needed.
- **"App connections" tab is LIVE on the plan** and "Create app connection" exposes a **fully custom SAML 2.0 SP** form: *Name*, *User identifier = Email* (dropdown), **Service-provider settings** = *Identifier (Entity ID)\**, *Reply URL (ACS URL)\**, *Logout URL*, **SAML signing certificate (x.509)** (file or paste). So Caspio = SAML **IdP**, our Heroku app = SAML **SP**.

**Why this is the pick:** reuses the EXACT login staff already have (Erik's instinct), server-verifiable (signed SAML assertion keyed on Email), **on-plan** (no upgrade), centralized in the Caspio directory they manage (can flip on 2FA there). Roles become data-driven once the (currently empty) `Role` field is populated.

**Flow:** staff hit "Staff Login" → redirected to Caspio login (the one they use) → Caspio POSTs a signed SAML assertion to our **ACS endpoint** → our server verifies Caspio's IdP signature + audience + timestamps → reads `Email` (the User identifier) → keys the session on it → derives permissions from Role.

**Build is collaborative (chicken-and-egg):** WE generate the SP side — pick an Entity ID, an ACS URL (e.g. `https://www.teamnwca.com/auth/saml/acs`), a Logout URL, and an SP x.509 cert — then ERIK pastes those into this Caspio "Create app connection" panel; Caspio then exposes its **IdP metadata (SSO URL + IdP signing cert)** which WE configure into the SP to verify assertions. Then test.

**Tradeoffs vs the alternatives (still valid fallbacks):** SAML SP is **Medium** effort (a SAML lib e.g. `@node-saml/node-saml` or `passport-saml`, an ACS endpoint, cert handling, replay/audience/clock checks) and is **staff-only** (customers still use magic-link #6). **Magic-link (D′)** is simpler and one-mechanism-for-staff+customers, at the cost of a clunkier email-click login and not reusing the Caspio directory. **Microsoft OAuth (A′)** needs each staff member to have an individual M365 login. Given Erik wants to reuse Caspio and App Connections is confirmed on-plan, **SAML is the pick for staff.**

Everything below (§4 crm-session fix, §5 roles/session, §6 gating) is otherwise identical — for SAML, the "verify Google/Microsoft token" step becomes "verify the Caspio SAML assertion at the ACS endpoint." (D′ magic-link / A′ Microsoft remain documented fallbacks.)

### (original, now superseded) Google Workspace OAuth
Staff are all on Google Workspace (`@nwcustomapparel.com`).

| Option | Server-verifies | Effort | Plan-gating | Verdict |
|---|---|---|---|---|
| **A. Google Workspace OAuth** | Google-signed JWT (`aud`,`iss`,`hd=nwcustomapparel.com`,`email_verified`) | **S–M** (1 dep `google-auth-library`, 1 endpoint, 1 button) | none (Google Cloud OAuth client + `GOOGLE_CLIENT_ID`) | **PICK** |
| B. SAML SSO (Caspio as IdP) | signed SAML assertion (Email+Role) | L | **"SAML out" = Caspio Business+; NWCA tier UNCONFIRMED** | heavier + unverified |
| C. Signed Caspio DataPage handoff | a signed blob *if* a DataPage can hide a secret | M | **assumption UNCONFIRMED** | risky; avoid |
| D. Staff email magic-link | mailbox control of @nwcustomapparel.com | M | EmailJS already wired (`server.js:640`) | fallback for non-Workspace staff |
| E. Validate Caspio session | — | — | **impossible (§2)** | ruled out |

**Pick A:** only option that cryptographically verifies the human at S–M effort, no Caspio plan dependency, one-click UX (staff already signed into Google). No existing OAuth in the codebase (the only server-verifiable primitive present is the HMAC at `server.js:620`). **Footgun:** consumer `@gmail` can spoof `hd` — server MUST `verifyIdToken()` AND check `hd==='nwcustomapparel.com'` + `email_verified`, never the email suffix alone.
**Switch to B only if** Caspio must stay the single identity source AND a Business+ plan is confirmed.

## 4. The crm-session fix
`POST /api/crm-session` accepts `{credential}` (Google ID token), not `{name}`:
- `verifyIdToken()` → fail → 401, mint nothing. Success → extract email/name/hd/email_verified.
- Reject unless `hd==='nwcustomapparel.com'` && `email_verified`.
- **Key on verified `email`** (not `name.split(' ')[0]` — the spoofable, collision-prone field).
- Derive `permissions` from role-of-record (§5).
- **`req.session.regenerate()` before writing** (prevents session fixation — not done today).
- Preserve session shape `{name,email,firstName,permissions}` so `requireCrmRole` (`:476`) + `/api/crm-session/me` (`:2161`) are unchanged.
- Swap the Caspio button (`dashboards/staff-login.html:224,249`) for a Google Identity Services button; delete the DOM-scrape POST (`:259-265`).

## 5. Role-of-record + session infra
**Retire `CRM_PERMISSIONS` (`server.js:469`)** (hardcoded, deploy-per-rep, only Erik/Taneisha/Nika → other 8 staff 403 today):
- Keep a small **`Role → permissions[]` template** in code.
- Move **person → role** to data keyed on verified email: ship a static `email→role` map first; preferred no-deploy = Caspio **Staff Directory** `Role` via `GET /v3/directories/{id}/users` (entitled, 11 users) or `Sales_Reps_2026`. **Open:** confirm the per-user `Role` actually returns over REST.

**Session infra:** remove the `SESSION_SECRET` fallback → fail closed (mirror `computeOrderStatusToken` `server.js:620`); add durable store (`connect-redis`/`connect-pg-simple` — **reuse #1/Phase-2's store**); tighten cookie `sameSite`/timeout.

**Gate open surfaces:** add `requireStaff` (verified session, any role) on `/staff-dashboard.html` (`:2392`), v3 aliases (`:2415-2428`), and `/dashboards/*.html` static fall-through (`:2330`) — register before the static mount. **Close the proxy side-door:** extend `requireCrmApiSecret` (`caspio-pricing-proxy/src/middleware/index.js:32`) to staff-data endpoints.

## 6. Phased build plan
- **Phase 0 — stop bleeding (APP):** remove `SESSION_SECRET` fallback (`:454`, **confirm set on Heroku first or prod won't boot**); add `strictLimiter` + `req.session.regenerate()` to `/api/crm-session`.
- **Phase 1 — Google identity (APP):** add `google-auth-library` + Google Cloud OAuth client + `GOOGLE_CLIENT_ID`; rewrite `/api/crm-session` (`:2124`) to verify the ID token (hd+email_verified, key on email, preserve shape); swap login UI (`staff-login.html:224-265`, move inline `<script>` external per house rule).
- **Phase 2 — roles (APP):** `Role→permissions` template + email→role lookup (static first); preserve exact permission strings.
- **Phase 3 — gate surfaces (APP):** `requireStaff` on the ungated dashboards.
- **Phase 4 — durable store (APP):** reuse #1's store.
- **Phase 5 — proxy side-door (PROXY):** extend `requireCrmApiSecret` to staff-data endpoints (APP already sends `X-CRM-API-Secret` at `server.js:2225`).

## 7. Open decisions for Erik
1. **IdP — Google (A) vs SAML (B).** Recommend **Google** (S–M, no Caspio plan dep, one-click). SAML only if Caspio must stay the identity source AND Business+ confirmed. *Decide: is "has a @nwcustomapparel.com Google account" the staff access policy?*
2. **Edge case:** contractors with non-Workspace Google accounts? Recommend Workspace-only to start; add magic-link (D) only if a real person is blocked.
3. **Role source:** static email→role now, or Caspio Directory `Role` lookup (no-deploy)? Recommend static first, Caspio once `Role` confirmed.
4. **Session store:** Redis vs Postgres add-on — match whatever #1 picks.
5. **Proxy hardening scope:** staff-data endpoints now; whole-proxy auth is a separate larger project.

## SP configuration — COMMITTED 2026-06-29 (Caspio App Connection)
Our app = SAML SP. These values go in Caspio Directory "Staff" (`55u0q8`) → App connections → Create app connection, and our code MUST match them:
- **Name:** `Staff Dashboard – teamnwca`
- **User identifier:** `Email`
- **Identifier (Entity ID):** `https://www.teamnwca.com/auth/saml/metadata`
- **Reply URL (ACS):** `https://www.teamnwca.com/auth/saml/acs` ← POST endpoint to build
- **Logout URL:** `https://www.teamnwca.com/auth/saml/logout`
- **SP signing cert:** self-signed RSA-2048, `CN=teamnwca.com Staff SAML SP`, valid 2026-06-29 → 2036-06-26. Public cert pasted into Caspio. **Private key** generated to session scratchpad `saml-sp-key.pem` — must be installed on Heroku `sanmar-inventory-app` as config var **`SAML_SP_PRIVATE_KEY`** at build/deploy (NEVER commit). If lost before then, regenerate the pair + re-upload the cert to Caspio.
- **After creating:** grant the Staff "Application access" to the connection; then capture Caspio's **IdP side** (login/SSO URL + IdP issuer/entity-id + Caspio's signing certificate) → required to verify assertions server-side.
- **Roles:** directory has ONE "Staff" group (everyone) → groups can't differentiate admin/rep. Populate the per-user **`Role`** field (currently empty) OR map email→role in app initially.

## Open questions (do NOT build on these)
- ⚠️ **Is `SESSION_SECRET` set on Heroku prod?** If unset, offline cookie forgery is live TODAY; AND fail-closed boot (Phase 0) would take prod down if not set first. Confirm before anything.
- Caspio "SAML out" tier — only if SAML chosen.
- Caspio Directory per-user `Role` over REST — confirm before wiring the no-deploy role lookup.
- Durable session store add-on on `sanmar-inventory-app` — coordinate with #1.
