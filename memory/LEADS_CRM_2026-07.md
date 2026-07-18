# Leads CRM — capture + Salesforce-lite pipeline (built & shipped 2026-07-18)

One system, two layers, all live in production. Frontend releases 1689–1694 (v2026.07.18.2→.10); proxy v2026.07.18.2→.5 (`d3f66dd`→`8682e39`).

## Layer 1 — Unified capture (JotForm + in-app → `Form_Submissions`)

- **Single table**: everything is a `Form_Submissions` row. Lead formIds: `jotform-lead` (JFL) + `quote-request` (QRQ) + `webstore-request` (WSR) + `team-roster` (RST). NO separate Leads table — deliberate.
- **JotForm ingest** (6 forms: Leads NWCA #1 `21764724640151`, NW Embroidery Info Request `220514824751149`, Leads Decosource, Apparel Leads #1, Webstore Contact, Franchise Inquiry): webhooks registered on all 6 → proxy `POST /api/jotform/webhook?secret=` (`JOTFORM_WEBHOOK_SECRET`; the JotForm **API key** lives in `JOTFORM_API_KEY` — they got swapped once, fixed v953).
  - **Webhook is REST-first**: rawRequest LACKS upload URLs — handler fetches `GET /submission/{id}` via the API and normalizes `answers` (rawRequest = fallback only). `src/utils/jotform.js` + `src/routes/jotform.js`.
  - Dedupe = `External_ID` (JotForm submissionID); `External_Source` = `jotform:{formID}`; live IDs `JFL{MMDD}-{rand4}`, backfill `JFL{MMDD-of-original}-{4-from-subID}`.
  - Daily reconcile backstop: Heroku Scheduler `npm run jotform-reconcile` (7:30 UTC) → `POST /api/jotform/sync`.
  - **Backfill DONE**: ~1,766 rows via CSV import (`scripts/backfill-jotform-csv.js` → Caspio UI import; $0 Integrations quota); >60d rows = Archived; offline AE assignment applied.
- **Routing rule (Erik)**: exact-email match in `CompanyContactsMerge2026` → that customer's AE + `Matched_ID_Customer` auto-linked; else **Taneisha Clark**. Lookup failure defaults rep — never drops a lead.
- **Notifications on arrival**: Slack `#form-leads` card (rep + source shown) + EmailJS `template_new_lead` to the assigned rep (`send-lead-email.js`; Reply-To = the prospect; Erik Cc'd).
- **Attachments**: `GET /api/jotform/file?u=` staff passthrough streams JotForm uploads with the API key (`requireCrmSecretOrBrowserOrigin` + strict upload-host allow-list; MIME inferred from extension — JotForm serves octet-stream); `?download=1` forces save-as on BOTH it and `/api/files/:key` (keeps real filename). QRQ logo uploads live as text in payload fields — the UI extracts file links from field values (allow-listed hosts only).
- Forms Inbox excludes `jotform-lead` rows (they'd flood it) — `withoutJotformLeads()` in `dashboards/js/form-submissions.js`.

## Layer 2 — CRM v2 (kanban · workspace · timeline · digest · quote handoff)

- **`Lead_Activity` table** (DesignNotes-modeled): PK_ID auto, Submission_ID FK, Activity_Type (note|status|attachment|quote|system), Activity_Text **TEXT** (not STRING — 255 would truncate), Attachment_URL (allow-listed), Created_By, Created_At (server-stamped), Parent_PK dormant. Immutable v1. `GET/POST /api/lead-activity` (CRM-secret per-route) ← browser via `/api/crm-proxy/lead-activity*` (requireStaff).
- **`Form_Submissions.Lead_Value`**: estimated $; linking a quote **snapshots its TotalAmount in** (kanban $ totals cost zero extra reads); workspace drift-syncs on open.
- **Board** (`/dashboards/leads.html`): kanban default desktop / list <768px (persisted `nwca-leads-view`); 5 columns via `STAGE_OF` (RST "Entered in ShopWorks" = **Won**); `DRAG_STATUS` maps drops per form (blocked combos explain via banner); `window.moveCard(id، col)` = harness entry; Won/Lost columns show 45 days + "+N older — see List"; Mine chip (session email → `EMAIL_TO_REP`); column headers count + $.
- **Workspace** (`/dashboards/lead.html#<Submission_ID>` — **#hash, NEVER ?id= — quoted-printable mangles `=` in emailed links**): timeline + composer (Ctrl+Enter) + drop/paste/click uploads (`ArtworkUpload.uploadOne` → `/api/files/upload` → attachment activity) + panels: contact, follow-up (`Due_Date` + chips, overdue flag), value, ShopWorks match + **customer intelligence** (`GET /api/customer-history/:id` — orders/revenue/top items, 6h cache, fails-soft), linked quote (live `GET /api/quote_sessions?quoteID=` + `/quote/<id>` deep link), click-gated order history (`/api/crm-proxy/order-odbc`), submitted details, original artwork.
- **Follow-up digest**: proxy cron weekdays **7:45 AM PT** (staggered vs 8:00 approval digest) — `src/utils/lead-followup-digest.js`; buckets: overdue (`Due_Date<today`) / due today / new-&-untouched (New, no date, >48h, ≤60d); ONE Caspio read; per-AE via `resolveAEEmailLoose` (full display names!); admin `GET /api/lead-digest/scan` + `POST /api/lead-digest/send` (x-admin-key=ADMIN_KEY_DIGEST). `rep-email-map.js` += Jim/Bradley/Steve→art@/'General'→sales@.
- **Quote handoff**: workspace "Start a quote" buttons → sessionStorage `nwca-method-switch` {customer incl. customerNumber} + `{builder}?from=methodswitch` — rides existing `takeMethodSwitchPrefill`, **zero builder edits**; suggestions = `quote_sessions?customerEmail=` → one-click Link.
- **Shared core**: `dashboards/js/leads-common.js` (`window.LeadsCommon`) — vocabulary, formatting, payload/attachment parsing, crm-proxy helpers, `logActivity`. Activity breadcrumbs are client-posted (status/rep/link/upload/quote); Due_Date/Lead_Value edits deliberately NOT logged.

## Gotchas learned building it (recur-prone)

- **Proxy utils must lazy-require `utils/caspio`** — its api-tracker timer keeps jest's event loop alive (suite "hangs"). Same rule as form-submission-helpers.
- **npm run eats `--flag` args on Windows** — invoke scripts as `node scripts/x.js --flag` directly.
- **`=` in emailed links gets QP-mangled** — all lead deep links are `#hash`.
- **Date-only strings (`YYYY-MM-DD`) parse as UTC midnight** → display a day early Pacific; pin to `T12:00:00` (leads-common `fmtWhen`).
- Harness stubs: ArtworkUpload uses **XMLHttpRequest** — fetch stub alone can't intercept; `test-leads-stub.js` patches XHR for `/api/files/upload`.
- In a **column** flexbox, `flex-basis` becomes HEIGHT (mobile search-box balloon; fixed with `flex:none` in the media query).
- GET `/api/form-submissions` supports `formIds=`/`statusNot=`/`limit=` (≤2000); PUT whitelist incl. Sales_Rep/Matched_ID_Customer/Linked_Quote_ID/Lead_Value.

## Open / optional

- ⏳ **ERIK: EmailJS `template_lead_followup_digest`** + `heroku config:set EMAILJS_TEMPLATE_LEAD_FOLLOWUP_DIGEST=<id>` — cron activates itself once set (params: to_email/to_name/ae_name/digest_date/counts/overdue_html/due_html/new_html/board_link, triple-stache the *_html).
- Optional: purge old spam rows from the 12-yr backfill · extend auto-assign/email to QRQ/WSR arrivals · 'House' rep name → sales@ mapping (one backfill row logs unassigned).
