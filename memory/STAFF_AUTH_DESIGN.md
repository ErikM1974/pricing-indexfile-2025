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
> - **Caspio SAML** — still possible (reuse existing Caspio logins) but plan-gated (Business+, unconfirmed).
> Everything below that says "Google" generalizes: for A′ swap Google's `verifyIdToken`/JWKS + `hd` check for Microsoft's token validation + `tid` check; for D′ replace the OAuth verify with mint/verify of a single-use emailed nonce. The crm-session fix, roles, session infra, and gating (§4–§6) are otherwise identical.

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

## Open questions (do NOT build on these)
- ⚠️ **Is `SESSION_SECRET` set on Heroku prod?** If unset, offline cookie forgery is live TODAY; AND fail-closed boot (Phase 0) would take prod down if not set first. Confirm before anything.
- Caspio "SAML out" tier — only if SAML chosen.
- Caspio Directory per-user `Role` over REST — confirm before wiring the no-deploy role lookup.
- Durable session store add-on on `sanmar-inventory-app` — coordinate with #1.
