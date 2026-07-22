# Jim's Mailing List — build status & handoff (2026-07-21)

Owner "Jim" (83, non-technical) wants a dead-simple prospect/mailing list he can add/edit/delete.
Standalone Caspio table + senior-friendly dashboard page, PLUS a one-time bulk import of ~2,905
Bigin CRM prospects (non-customers). **Not deployed yet — safe stopping point.**

## Decisions (Erik-confirmed this session)
- **New dedicated table `Prospect_Mailing_List`** — NOT `Form_Submissions`/Leads CRM (that fires AE
  routing / Slack / 7:45 digest; a passive list must not touch it).
- **Access:** any logged-in staff (no `Staff_Page_Access` row). Sidebar link after Leads.
- **Fields:** full mailing info + added **Website**, **Category** (Bigin Tag / segment, e.g. "Fire Dept
  Prospect"), **Bigin_Id** (read-only import provenance).
- **Bigin classification:** exclude customers (`id_Customer` linked, or Tag/Type = Customer) AND leads
  (Tag `Jotform`/`Lead`) → **2,905 prospects**. Erik said "only bring in non customers and import";
  I kept the stricter 2,905 (leads excluded too, per his original "not a customer or a lead"). The
  **472 leads are a one-word add-back** if he wants them.
- **Import method:** Caspio **CSV import (free)** — Erik runs the UI import of the generated file.

## DONE
**Proxy repo (`../caspio-pricing-proxy`):**
- `scripts/create-prospect-mailing-list-table.js` — created AND **ran `--apply`; the table EXISTS in
  Caspio** (17 fields + auto PK_ID). Script `process.exit()`s cleanly (api-tracker timer otherwise hangs it).
- `src/routes/jim-mailing-list.js` — full CRUD (list/get/post/put/delete). `putWithRecordsAffected` +
  `RecordsAffected`→404 on PUT/DELETE; numeric `PK_ID` addressing; `S`/`nowIso` from
  form-submission-helpers. `FIELDS`/`EDITABLE`/`CAPS` include Website/Category (Bigin_Id read-only).
- `server.js` ~L1254 — `app.use('/api/jim-mailing-list', requireCrmApiSecret, jimMailingListRoutes)`
  (after marketing-shipments; PII → whole-mount secret).

**App repo (Pricing Index File 2025):**
- `dashboards/jim-mailing-list.html` + `css/jim-mailing-list.css` + `js/jim-mailing-list.js`
  (`?v=2026.07.21.2`) — senior-friendly: 19px+ inputs, ≥52px buttons, one form reused for add+edit,
  client-side search, native confirm on delete, green "saved" toast, Website link + Category tag,
  errors via `DashPage.showError`. Calls same-origin `/api/crm-proxy/jim-mailing-list`.
- `server.js` ~L3408 — forwarder `app.all('/api/crm-proxy/jim-mailing-list*', requireStaff,
  express.json(), <stamp Added_By on POST + Updated_By on writes>, jimMailingListForwarder)`.
- `staff-dashboard-v3/index.html` — sidebar `<div class="nav-section" data-section="jim-mailing-list">`
  "✉️ Jim's Mailing List" after the Leads section.
- `ACTIVE_FILES.md` — 5 rows added (page/js/css + 2 test-harness files).
- `tests/ui/test-jim-mailing-list.html` + `test-jim-mailing-list-stub.js` — harness (real controller +
  CSS over in-memory fetch stub). **VERIFIED via static-qa (port 8099): load, add, edit, delete,
  search, count-wording, website link, category tag — all pass, zero console errors.**

**Import file (READY):**
- `C:\Users\erik\Downloads\Jim-Prospect-Import.csv` — **2,905 rows**, headers EXACTLY match the table
  (Company, Contact_Name, Address, City, State, Zip, Phone, Email, Source, Notes, Website, Category,
  Bigin_Id, Added_By, Created_At, Updated_At, Updated_By — NO PK_ID). Contact-joined from contacts CSV
  (1,677 contact / 1,461 email / 1,977 phone / 2,275 street / 1,319 website). Source='Bigin import',
  Category=Bigin Tag, Bigin_Id=Bigin Company Id, timestamps='2026-07-21T00:00:00', Added_By='bigin-import'.
- Generator: `<scratchpad>/build-jim-import.ps1` (PowerShell Import-Csv, robust). Source files:
  `C:\Users\erik\Downloads\Bigin Companies.csv` (5,874 companies) + `bigin contacs.csv` (9,628 contacts).

## REMAINING (do next session)
1. **Deploy — PROXY FIRST, then app** (forwarder depends on the proxy route):
   - Proxy: deploy `caspio-pricing-proxy` to Heroku; confirm boot log `✓ Jim mailing list routes loaded [CRM-gated]`.
   - App: run `/deploy` skill (bumps `?v=`, changelog, verify).
2. **Erik runs the Caspio CSV import** of `Jim-Prospect-Import.csv` INTO `Prospect_Mailing_List`
   (Caspio → table → Import → map by matching header names; leave PK_ID auto). Give him the quick steps.
3. **Verify live:** open `/dashboards/jim-mailing-list.html` as staff → 2,905 rows load, search works,
   add/edit/delete round-trips against real Caspio.
4. Optional: add the 472 leads back if Erik wants them (re-run generator without the lead exclusion).
5. Docs after deploy: MEMORY.md "shipped" one-liner; LESSONS_LEARNED only if a real gotcha surfaced.

## Gotchas learned
- Caspio IS reachable + writable from the local sandbox (proxy `.env` present). Any Caspio script MUST
  `process.exit()` or the api-tracker interval keeps the process alive (looks like a hang).
- `Customer Type` in the Bigin export is an INDUSTRY label (Construction/Fire-Police/…), NOT a
  customer flag. The real customer signal is `id_Customer` populated (or Tag "Customer").
- Bigin CSVs have embedded newlines in Description → `wc -l` overcounts; use a real CSV parser
  (PowerShell Import-Csv) — true counts: 5,874 companies / 9,628 contacts.
- Git: committed at handoff on `develop` (both repos), NOT pushed/deployed.
