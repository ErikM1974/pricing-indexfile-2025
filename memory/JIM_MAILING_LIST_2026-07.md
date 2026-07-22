# Jim's Mailing List — build status & handoff (2026-07-22)

Owner "Jim" (83, non-technical) wanted a dead-simple prospect/mailing list he can add/edit/delete.
Standalone Caspio table + senior-friendly dashboard page, a one-time bulk import of ~2,905 Bigin CRM
prospects (non-customers), AI capture (paste/screenshot → Claude fills the form), a Jim-first two-view
redesign, and a controlled/engagement-gated Mailchimp sync for Erik.
**✅ Phase 1+2 + redesign + engagement all LIVE 2026-07-22 — proxy `55fe4ce`, app `v2026.07.22.7`.**

## The page
`/dashboards/jim-mailing-list.html` (+ `css/`, `js/` — bump `?v=` on shared edits; currently `2026.07.22.7`).
Sidebar link "✉️ Jim's Mailing List" after Leads (`staff-dashboard-v3/index.html`). Any logged-in staff
(no `Staff_Page_Access` row). Same-origin API base `/api/crm-proxy/jim-mailing-list`.

## Data
- **Caspio table `Prospect_Mailing_List`** — dedicated (NOT `Form_Submissions`/Leads CRM; a passive list
  must not fire AE routing / Slack / 7:45 digest). Fields: Company, Contact_Name, **First_Name, Last_Name**,
  Address, City, State, Zip, Phone, Email, Source, Website, Category, Notes, Bigin_Id, **Status,
  Last_Mailed_At, Mailchimp_Status, Mailchimp_Last_Sent, Mailchimp_Sent_Count**, Added_By, Created_At,
  Updated_At, Updated_By + auto PK_ID.
- **Unique key = PK_ID only** (autonumber). Company NOT unique (multi-location + would error on Jim);
  Bigin_Id NOT unique (blank on manual/AI adds → Caspio dup-blank reject). Dedup softly in-app, not via DB.
- **One row per company** (it's a mailing list). Import took the primary (email-preferred) contact.
- **First/Last** split is **derive-on-read** (`splitName` off Contact_Name) — no backfill; the add/edit
  form has real First/Last inputs going forward.
- **Bigin import (done):** 5,874 companies − customers (`id_Customer` linked / Tag=Customer) − leads
  (Tag `Jotform`/`Lead`) = **2,905 prospects**, Erik CSV-imported into Caspio 7/22. The **472 leads are a
  one-word add-back** (re-run generator without the lead exclusion) if he wants them.

## Redesign (Jim-first, Erik-confirmed)
- **Portrait welcome** — on login, `jml-welcome` shows Jim's photo (Caspio file URL
  `https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9463872`) + greeting so he knows he's
  on his page. ⚠ do NOT `loading="lazy"` that img — above-fold + browser-pane not compositing = it never
  fires (naturalWidth 0). Currently shows for all staff; Jim-only gating is an option not taken.
- **Two views** (toggle `jml-view-mine`/`jml-view-all`, persisted `localStorage nwca-jml-view`): **"Yours"**
  = rows where `Added_By === me.email`, sorted newest-first (Created_At desc) so Jim sees what he just typed,
  not 2,905 old imports. **"Browse all"** = full list with filter chips + sort. `me` from `/api/crm-session/me`.
- Segment filter chips + sort + capped render (RENDER_STEP=100, "show more").

## AI capture
- Proxy `POST …/extract` — Anthropic SDK (lazy client, **`claude-haiku-4-5-20251001`**, same pattern as
  `src/routes/vision.js`); `{text?, image? dataURI}` → `{fields}`. Writes NOTHING; the page pre-fills the
  form for Jim to review + Save. App forwarder = `express.json({limit:'12mb'})` (proxy global cap 10mb;
  client downscales screenshot to 1400px JPEG q0.85 first). Needs `ANTHROPIC_API_KEY` on proxy (already set).

## Mailchimp (Phase 2 — Erik-only, collapsed `<details>` strip at page bottom)
`src/utils/mailchimp-client.js` (Basic auth, key's `-usX` = data center, NEVER logged). Audience by NAME
**"Jim's Prospects"** (`MAILCHIMP_AUDIENCE` env override) so no hardcoded List ID. Needs `MAILCHIMP_API_KEY`
on proxy (Erik added, us7). Buttons: Test-connection, **Check engagement**, Sync, **Sync engaged only**,
Refresh-activity, + scope selector.
- **Controlled sync (never all-at-once — Mailchimp bills per contact):** client sends the CURRENT scope's
  rows to `…/mailchimp/sync`; server requires an **email**, caps 2000/call, upserts as **`transactional`**
  (NOT marketing-subscribed → nobody is emailed until Erik subscribes them), tags by segment, ensures merge
  fields (FNAME/LNAME/COMPANY/ADDRESS/CITY/STATE/ZIP/PHONE).
- **Engagement-gated sync (Erik's ask: "only push the emails that have been opening our emails"):**
  "Check engagement" → `…/mailchimp/engagement` reads **every** Mailchimp audience's members and marks
  `opened = avg_open_rate > 0`. That read takes ~50s (past Heroku's 30s H12 cap) so it runs in the
  **BACKGROUND**: `getEngagementMap()` returns null + kicks off `buildEngagementMap()`, endpoint returns
  `{building:true}` instantly ("…click again in about a minute"), 2nd click reads the 10-min cache. Then
  **"Sync engaged only"** pushes just the openers. **LIVE-VERIFIED 7/22**: of 1,461 prospects with an email,
  575 are in Mailchimp, **326 have opened** → "Sync engaged only (326)".
- `…/mailchimp/record-sends` (manual button) stamps Mailchimp_Last_Sent/Sent_Count from recent campaigns'
  `/reports/{id}/sent-to`. Auto webhook-on-send is a future option.

## Deploy state (all live 7/22)
- Proxy `../caspio-pricing-proxy` `main` → Heroku, latest **`55fe4ce`** (`/api/jim-mailing-list` + `/extract`
  + `/mailchimp/*`, 401-gated whole-mount `requireCrmApiSecret`).
- App `develop`→`main`→Heroku, **`v2026.07.22.7`** (main `0dc69b07`). Forwarder ~server.js L3408
  `app.all('/api/crm-proxy/jim-mailing-list*', requireStaff, express.json({limit:'12mb'}), <stamp
  Added_By/Updated_By from session>, jimMailingListForwarder)`.
- Harness `tests/ui/test-jim-mailing-list.html` + `-stub.js` (real controller over in-memory fetch stub).

## Gotchas learned
- **Live-test the engagement build is BACKGROUND, not sync** — the browser JS tool (CDP) caps a single
  `javascript_exec` at ~45s, and Heroku H12 kills a request at 30s, but the map build is ~50s. First click
  MUST return `{building:true}` fast; verify the 2nd click (after ~1 min) reads cache. `heroku run` won't
  stream from the Claude sandbox (ETIMEDOUT rendezvous) — verify via deployed endpoints + `heroku logs`.
- **NEVER handle the Mailchimp/Anthropic API key in chat** — Erik adds it to Heroku config himself.
- **Shared git checkout races:** other Claude sessions push to develop/main + leave dirty server.js/
  package.json mid-deploy. Stage ONLY your explicit files (never `git add -u`); deploy `origin/main:main`;
  a concurrent hotfix `checkout` can erase uncommitted wiring hunks (the .20.2 forwarder was swept once).
- Date off-by-one: parse `YYYY-MM-DD` as LOCAL (not UTC `toISOString`) or "Mailed today" shows yesterday.
- Caspio script MUST `process.exit()` (api-tracker interval otherwise keeps it alive = looks hung).
- Caspio IS reachable/writable from the local sandbox (proxy `.env` present).
- Bigin `Customer Type` = INDUSTRY label, NOT a customer flag; real signal is `id_Customer` populated.
  Bigin CSVs have embedded newlines → use a real parser (PowerShell Import-Csv): 5,874 co / 9,628 contacts.

## Remaining / optional (offered, not built)
1. Add the 472 leads back if wanted.
2. Accidental-delete safety net for Jim (undo / soft-delete).
3. "Send hot prospect to Leads board" one-click bridge.
4. In-app duplicate guard on add.
5. Automatic Mailchimp send-recording via webhook (vs the manual Refresh-activity button).
6. Portrait Jim-only gating.
