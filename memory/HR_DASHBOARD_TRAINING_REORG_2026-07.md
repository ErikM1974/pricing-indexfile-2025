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

## Status

- [x] 2026-07-10 — classification + worksheet delivered; nav design proposed; questions list sent to Erik.
- [ ] Erik reviews worksheet batches; answers dead-tool + nav questions.
- [ ] Implement nav (2 categories) + Training Center page after approval.
- [ ] Promote HUB-gap docs to hub (handbook sync check each) · import TRAINING docs · execute retire/archive.
