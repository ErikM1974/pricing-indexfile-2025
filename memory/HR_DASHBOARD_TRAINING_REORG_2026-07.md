# HR / Staff-Dashboard Reorg — SweetProcess Library → 2 Categories (started 2026-07-10)

**Goal (Erik):** collapse the staff-dashboard sidebar to TWO knowledge categories — **Company Policies & Procedures** and **Training** — and disposition every document from the old SweetProcess HR system (2017–2026 export) into hub / training / retire. Collaborative, multi-session review project.

## Source & deliverables (all in OneDrive HR folder — NOT this repo)

Folder: `C:\Users\erik\OneDrive - Northwest Custom Apparel\2026\Human Resources 2026\NWCA Policy and Procedure list from Sweetprocess 2017 to 2026`

- **`_Dashboard_Migration_Worksheet.html`** — interactive review UI (verdict chips, filters, per-row Approve/Change/Discuss + notes → localStorage, CSV export, links to each doc). THE working surface for review sessions.
- **`_Dashboard_Migration_Worksheet.xlsx`** — same data, Summary + All Files (436 rows, autofilter).
- Prior art (May 2026 session): `_NWCA_Triage_Report.xlsx` (469 files, KEEP/UPDATE/CONSOLIDATE/ARCHIVE/DELETE + SECURITY tab), `_IMPROVEMENT_SUMMARY.md`, `_HR_Policy_Dashboard.html`, `_Archived-Duplicates/` (50 files). Library was already cleaned/rewritten/consolidated then.

## Classification method (2026-07-10)

May triage verdicts + per-doc **content-overlap** vs the LIVE Policies Hub bodies (130 policies via `GET /api/policies-public/`) + fuzzy match vs `/training/` pages + ~70 hand corrections. Coverage tiers: ≥55% vocab overlap = COVERED, 35–55% = PARTIAL (merge-check), else gap.

**Result (436 active files):** PARTIAL-HUB 119 · COVERED-HUB 81 · RETIRE 64 · ARCHIVE 54 · HUB 47 (true policy gaps) · TRAINING 25 (true training gaps) · HR-CONFIDENTIAL 21 · RETIRE? 17 (dead-tool questions) · COVERED-TRAINING 8.

## Key facts discovered

- **Policies Hub already absorbed most of the corpus** (130 live policies incl. 22-chapter Employee Handbook, job descriptions, operator training). Don't re-migrate — the worksheet's COVERED/PARTIAL rows point at the exact hub `Policy_ID`.
- Hub API: public reads `caspio-pricing-proxy /api/policies-public/` (list at bare `/`, `/tree`, `/search?q=`); admin writes `server.js /api/crm-proxy/policies/*`.
- Dashboard nav lives in `staff-dashboard-v3/index.html` lines ~80–190: 6 sections (Company Policies → hub · Training 7 links · Office Assistant 5 links · Employee Bundles 4 customer pages · Inksoft Transform · Administration 8 admin-gated links).
- **HR-CONFIDENTIAL (21 docs)** incl. `logins-and-passwords`, comp breakdowns, named-employee reviews, interview questions — must NEVER go on the dashboard; SECURITY tab creds still need rotation.
- 17 RETIRE? docs hinge on dead-tool questions for Erik: Bigin, Salesforce/dataloader, Covideo, Mailbox Power, Wufoo, Stamps.com (ShipStation now), Jive phones, Mehar/Payoneer, Mailchimp nurture, 2023 PowerQuery scripts (superseded by pricing engine / Caspio CC app).

## Proposed 2-category design (pending Erik approval — do NOT implement before)

1. **📋 Company Policies & Procedures** → policies-hub (unchanged link; gains ~47 HUB-gap docs + merged PARTIAL detail over review sessions; Erik's Bonus Policy moves here from Office Assistant).
2. **📖 Training** → new Training Center index page under `/training/` with role tracks: Universal onboarding · CSR · Sales/AE · Office Assistant (absorbs 4 of the 5 Office Assistant guides) · Production/EMB · DTG · Shipping-Receiving · Accounting · Games/Quizzes · Reference.
3. Employee Bundles + Inksoft Transform → Quick Access tiles (tools, not documents). Administration → keep as admin-gated tools section OR fold API refs under Training>Technical Reference — Erik decides.

## Workflow per review session (suggested batch order)

RETIRE? → HR-CONFIDENTIAL → HUB → TRAINING → PARTIAL-HUB (by dept) → COVERED spot-checks → RETIRE/ARCHIVE confirm. Erik marks decisions in the worksheet; then: new hub policies via admin API (⚠️ CLAUDE.md two-way **Employee Handbook sync check** before publishing each), training imports as `/training/` pages, retire/archive moves files into `_Archived-Duplicates`-style folders.

## TRUST MODE (2026-07-10) — Erik delegated curation

Erik: *"pick the ones that count … then the rest of the left over junk you can look at … I trust you Fable to do this."* Operating model now: **CORE 42** (HR 9 · Money 6 · Ops 15 · Training 12 — Fable updates each to 2026 standards and publishes; Erik spot-checks) · **ERIK 18** (dead-tool/credential facts only he knows) · **AUTO 376** (Fable processes; optional glance). Tier chips baked into the worksheet.

**Hub write path (working, verified):** proxy `PUT https://caspio-pricing-proxy…/api/policies/:policyId` with header `X-CRM-API-Secret` (value = `CRM_API_SECRET` in this repo's `.env`) + `If-Match: <Updated_At>`; send `Body_HTML` (Body_Plain auto-derived) + `Updated_By`. List endpoint omits Body_HTML — GET the detail endpoint first.

**LIVE hub fixes shipped 2026-07-10 (~19:35):**
1. `sales-tax-shopworks` — Milton 10.1%→**10.2%** (6.5+3.7), added **Tax_10.2 / 2200.102** (old 10.1/2200.101 marked retired), summary updated.
2. `eft-and-vendor-payments` — full **Kitsap Bank → Bank of America** rewrite (bill pay + check deposits; Payoneer section unchanged; Kitsap-specific "Deposit Connect" steps removed, Accounting owns current deposit method).
3. `credit-card-sop` — Translink funds settle → **Bank of America** general account.

**Business facts learned:** NWCA banks at **Bank of America** (July 2026; previously Kitsap Bank) — check `our-credit-references` doc + any vendor-credit references before reuse. **Translink IS current** (card-transaction view). Hub stale-scan (130 policies): pending-Erik markers = Jive ×2 (`phone-procedures`, `emergency-vendor-contacts`) · Stamps.com ×4 (`shipping-receiving-handbook`, `office-assistant-role`, `shipping-procedures`, `inksoft-and-shopify-workflows`) · Bigin in `hb-17-tech-data-security` · Qdigitizing ×7. 'sweetprocess' hits are cosmetic provenance text — **0 sweetprocess-hosted links in hub bodies** (nothing breaks at subscription end; only corpus-file attachments need rescue). `ltm-fee-policy` "10.1" = false positive ($10.17 example price).

## Status

- [x] 2026-07-10 — classification + worksheet delivered; nav design proposed; questions list sent to Erik.
- [x] 2026-07-10 — **Batch 1 reviewed** (Erik's first 15 marks: Accounting + Art + 2 CSR): 9 DISCUSS resolved via hub-body verification (5→COVERED-HUB archive, 2 merge-into-hub, CSR-90-day→TRAINING, sales-tax→fix-hub-first); his 4 RETIRE + 2 ARCHIVE safety-verified (hub artwork-intake names its consolidated sources verbatim; eft-and-vendor-payments contains full RDC procedure). Decisions read from Chrome Profile 2 leveldb (no CSV export needed) and now BAKED into worksheet data. **⚠️ LIVE HUB BUG found: `sales-tax-shopworks` still says Milton 10.1% — must update to 10.2%/Tax_10.2/2200.102 (Erik to paste corrected text or approve me doing it).** Gotcha: `credit-card-sop-2025` doc contains the FULL corporate card number in plaintext — redact before archiving.
- [ ] Erik reviews worksheet batches; answers dead-tool + nav questions.
- [ ] Implement nav (2 categories) + Training Center page after approval.
- [ ] Promote HUB-gap docs to hub (handbook sync check each) · import TRAINING docs · execute retire/archive.
