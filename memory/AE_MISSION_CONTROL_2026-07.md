# AE Mission Control (2026-07-19)

Per-AE cockpit for Taneisha Clark & Nika Lao (admin view-as). One page, identity-driven — never per-rep page copies.

## Surface
- Page: `/dashboards/ae-mission-control.html` + `dashboards/css|js/ae-mission-control.*` (dash-page conventions; prefix `aemc-`).
- Zones: action queue (overdue / due-today / new-untouched leads via `lead-followup-digest.js` `buildDigestModel` reuse · stale quotes (open, quiet ≥5d) · art awaiting approval · kits pending in Mikalah's queue) → KPI strip (YTD/MTD from `NW_Daily_Sales_By_Rep`, open quotes count+$, online-store commission QTD, lead win rate 90d) → My Leads/Quotes/Art/Orders panels (top 6 + view-all) → quick-actions rail (4 builders, **Quick Quote `/calculators/quick-quote/`** — Erik request 7/19, kit-request modal, one-click outreach modal, My Accounts (taneisha-/nika-crm), scorecard, commission-structure) → SanMar inbound-today card **rep-scoped free** (`o.salesRep` is already on `/api/sanmar-orders/inbound-today` orders; full view = `openInboundTodayModal()`).
- Art toasts: 45s poll `GET {API}/api/art-notifications?since=` (same contract as ae-dashboard.js); badge = awaitingApproval count.
- UI harness: `tests/ui/test-ae-mission-control.html` + `-stub.js` (admin session, per-rep fixtures, XSS probe).

## Data path (ONE call)
- Proxy `src/routes/ae-dashboard.js` → `GET /api/ae-dashboard/summary?email=` (**secret-only**): `Promise.allSettled` over 7 Caspio reads → `{rep, kpis, actionQueue, counts, panels, orders30Total, errors?}`; failed source ⇒ `errors.<key>` + null panel (page renders visible per-panel error — never blank). 3-min TTL cache per rep + `?refresh=1` (30s throttle). ~7 reads/miss ⇒ single-digit K calls/month.
- FE `server.js` forwarder `GET /api/crm-proxy/ae-dashboard/summary` (`requireCrmRole(['taneisha','nika','admin'])`): **rep email derived from SAML session**; `?viewAs=` honored ONLY for admin (view-as pill). Commission $ never reaches non-AE staff.
- Page route hard-gated like taneisha-crm (`requireCrmRole(['taneisha','nika'])`; admin auto-passes via permissionsFromRole). **AEs land here post-SAML** when relay is the default `/staff-dashboard.html` (explicit `next=` untouched; admins keep staff dashboard).
- In-page actions reuse existing forwarders: kit POST `/api/crm-proxy/marketing-shipments` (Requested_By session-stamped; `submissionId:''` OK), outreach `/api/crm-proxy/lead-outreach` (4 template keys mirror `lead-outreach-templates.js`), stale-quote "Reopen" = builder `?duplicate=<QuoteID>` via prefix map (EMB/EMBC/CEMB/SPC/SSC/DTF/DTG).

## Rep identity (the landmine — see LESSONS 2026-07-19)
- `AE_REGISTRY` in `ae-dashboard.js` = THE server-side email→{fullName, firstName} map (sync w/ FE `leads-common.js EMAIL_TO_REP`). New AE = row here + `REP_PERMISSION_BY_EMAIL` (lib/staff-saml.js) + EMAIL_TO_REP.
- Shapes: Form_Submissions/ORDER_ODBC/NW_Daily_Sales = full name; Quote_Sessions = `SalesRepEmail/Name` (builders default `sales@` when rep unpicked → panel = *attributed* quotes only); ArtRequests = full OR first name (filter ORs both); `SALES_REP_MAP` "Taneisha Jones" was a push BUG → fixed to Clark 7/19.
- New proxy filters shipped with this: form-submissions `?salesRep=`, quote_sessions `?salesRepEmail=`/`?salesRepName=`.

## Phase 3 backlog (not built)
Next-best-action ranking · since-last-visit highlights (localStorage diff) · morning Slack/email deep link (evolve the 7:45 digest) · absorb taneisha-/nika-crm as "My Accounts" tab · move rep access from email-keyed perms to `sales` role + Sales_Reps_2026 registry.
