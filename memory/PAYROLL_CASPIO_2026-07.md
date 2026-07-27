# Payroll in Caspio — audit + proposed design (2026-07-27)

Source: `NORTHWEST EMBROIDERY INC. (40).pdf` — Pay 15, check date **7/24/2026**, period 7/6–7/19/2026,
prepared by NW Regional Accounting Services. 7 scanned pages = **3 separate reports**.

> 🔒 **Most sensitive data in the account.** Nothing here may reach an unauthenticated route.

## 1. What the payroll packet contains

| Report | Pages | Grain | Key columns |
|---|---|---|---|
| **Payroll Register Report** | 1–5 | employee × check date | Type Pay (Regular/Overtime/Sick/`Vacation\PTO`/Commissions) + Rate + Hours + Wages; 6 deduction types; Total Wages, Total Deductions, Net |
| **Payroll Check(s) Register** | 6 | employee × check date | Date, Emp. ID, Name, Check #, Amount (= Net) |
| **Available Vacation And Sick Time** | 7 | employee × as-of date | Hrs/1 Day, then Accum / Used / Avail for **Vacation** and **Sick** |

- 16 checks, **Net Payroll $30,962.34**, Total Payroll Cost $42,458.61, gross wages $38,933.71.
- Employer side (page 5, NOT per-employee): Social Security, Medicare, Federal Unemployment,
  State (WA) Unemployment, Workforce Training Fund Tax (WA), Employer's Industrial Insurance.
- Vacation/sick report covers **21** employees (5 more than got checks) — includes zero-hour staff.
- 🔑 Leave hours are **HH:MM** (`107:24` = 107.40 h) and **can be negative** (`-33:52`, `-14:00`, `-08:00`).
  Any field storing these must be decimal NUMBER and must **allow negatives**.
- 🔑 Extraction checksum: a correct read reconciles to Vacation totals **1072:00 / 772:00 / 316:00**
  and Net Payroll **$30,962.34**. Verify before importing — the PDF is a **scan** (zero text layer;
  `pymupdf` returns empty, `pdftoppm` absent → render to JPEG and read visually).

## 2. What already exists in Caspio (probed live 2026-07-27, 181 tables / 19 views)

| Object | ID | Grain | Verdict |
|---|---|---|---|
| `Employees` | `o6u3qw` | one row per employee (29 rows) | roster master — has `Pay` (CURRENCY), `Vacation_Hours_Available/Used/Remaining`(formula), `Sick_Accum_Hours_Available`. **No pay history, no payroll ID.** |
| `Payroll_Bradley_2023` | `c2g3ms` | employee × pay period | ⭐ the right *shape*, but ONE employee, 2023, Excel-derived. Fields REG/OT/VACATION/PTO/Sick/Holiday/Commission/Deduct/Total. Dedupe via `Excel_Sheet_ID` TEXT255 UNIQUE + `Payroll_Record_ID` formula — **reuse that idempotent-key pattern**. |
| `Time_Off_Request` | `y0g4lj` | request | workflow only; does not reconcile to payroll's Used hours |
| `Employee_Reviews` | `v2m7sz` | review | unrelated |
| `Commission_Payouts` | `n1w7kc` | rep × quarter | has `Paycheck_Date`, `Payroll_Number` — **this is where the Commissions dollars on the register come from**; link, don't duplicate |
| Views | — | — | `All_Employees`, `Employees`, `Bradley_Payroll`, `Time_Off_REquest`, `VacationHours` |

- 🔴 **`Employees` is attached to 10 bridge apps** (Eriks Credit Card, Inksoft Deposits, Shopworks API 2025,
  Production, Steve Art, Human Resources 2025, Sanmar Pricing 2026, Monograms, Xmas Box Labels,
  Nika and Taneisha 2026). Anything added to `Employees` is reachable from all ten ⇒ **put pay history in a
  SEPARATE table**, not on `Employees`.
- ✅ The proxy has **zero** endpoints touching `Employees` / `Time_Off_Request` / `Payroll_Bradley_2023` /
  `VacationHours` / `Employee_Reviews` — HR data is Caspio-only today. Keep it that way unless gated.

## 3. 🔴 The finding: the existing HR columns are stale — do not trust them

Compared live `Employees` against the 7/24/2026 packet:

- **Vacation/sick drifts on 20 of 20** matched employees. Examples (Caspio → actual):
  Beardsley used 80 → **24**; Sorm accrued 0 → **112**; Nika Lao accrued 112/used 112 → **80/40**;
  Hede all zeros → **80/40/40**; Wright remaining 16 → **8**.
- **`Employees.Pay` is stale on every comparable employee**, almost all understated:
  Wright 31.25 → **42.09**; Nhoung 25.00 → **34.00**; Chhorn 16.50 → **23.00**;
  Beardsley 20.50 → **25.75**; Deland 31.73 → **34.90**; Tann 14.49 → **17.50**;
  Erik 51.92 → **25.00** (overstated). Blank for Hede, Clark, Khieve, Trujillo.
- **No join key.** The packet's Emp. ID (`6366`, `6087`, `1000`…) exists nowhere in Caspio, so matching is
  by name — and it already fails: packet **`MICKELSON JAMES`** vs Caspio **`Jim Mickelson`**.
- **Roster mismatch:** `UT Thi Tran` is Status=true in Caspio but absent from the 7/24 leave report.

**Prevention:** `Employees.Pay` and the vacation columns are hand-maintained and unreconciled — treat the
payroll packet as source of truth and make those columns *derived*, never authored.

## 4. ✅ LIVE 2026-07-27 — applied and verified

Erik's call: **fix `Employees` to work off the payroll report** rather than build a parallel
structure. That collapsed the original 3-table proposal to **1 new table + additive fields**:

- `Employees` = **current truth** (rate, leave balances), refreshed from each packet.
- `Payroll_Register` = employee × **pay date** history. Kept because the *values* aren't what
  broke — the *mechanism* is; a one-time hand-correction just re-drifts. Employer-side totals
  table **dropped** (doesn't serve the goal); separate leave-balance table **dropped** (the leave
  report shares the payroll run's as-of date, so balances ride on the register row).
- Grain covers all 21 packet employees, not just the 16 with checks — `Paid_This_Period` flags which.

Decisions: salaried staff use **`Pay_Type` + `Salary_Per_Period`** (verbatim off the register)
with `Annual_Salary_Est` = ×26; `Pay` stays the hourly rate. Backfill = **7/24/2026 only** for now.

**Scripts** (proxy repo, dry-run by default, commit `b4c5566`):
`scripts/create-payroll-register-table.js` (schema) → `scripts/import-payroll-packet.js` (data).

🔑 The importer has **two abort gates**: (1) the extraction must reproduce the packet's own printed
totals — gross 38,933.71 / net 30,962.34 / 22 subtotals / every row `gross − deductions = net`;
(2) all 21 employees must resolve to exactly **one** `Employees` row. Both pass as of 2026-07-27.

### Gotchas found while wiring it
- `Payroll_Employee_ID` is **not** declared Unique — 8 of 29 rows have no payroll ID and Caspio's
  multi-NULL behaviour under a unique index is unverified. The importer asserts uniqueness instead.
- `Sick_Hours_Remaining` / `Annual_Salary_Est` are **plain fields, not formulas** — REST formula
  creation is undocumented; the importer is the single writer so a computed value can't drift.
- 🔴 **Name defects in `Employees` — `Employee_Full_Name` is hand-typed and drifts from `First_Name`/
  `Last_Name`.** (A `Full_Name_Formula` field already exists and computes it correctly — prefer that.)
  Resolved with Erik 2026-07-27: **Sreyani** Meang is canonical (roster + Full_Name + packet agree;
  `First_Name` held a transposition → corrected). Nhoung keeps **"Ruthie"** (preferred) even though
  payroll and the roster carry her legal name **Ruth** — expected mismatch, don't "fix" it.
- 🔑 **Erik's roster = 16 names and matches the 16 checks exactly**, but the leave report lists **21**.
  All 5 extras confirmed ex-employees and **deactivated 7/27** (Khiev — a DISTINCT record from Sothea
  Tann, PK 27 — plus Hanson, Massey, Pon, Trujillo). 🔴 **Deactivated, never deleted**: their
  `Payroll_Register` rows record what NW Regional actually reported, and deleting would orphan that
  history. `Status` is what marks someone non-current.
- ⏳ **`UT Thi Tran` is the one unexplained active record** — hired 2020-12-01, Embroidery Operator,
  Pay $16, **no payroll ID**, on neither Erik's roster nor NW Regional's leave report. Active headcount
  is 17 vs a 16-name roster purely because of her. OPEN — Erik to confirm.
- 🔑 Name corrections are keyed by **payroll ID → resolved `ID_Record_Employee`, never by name**, and
  resolution falls back through known prior spellings so pre- and post-rename runs resolve identically.
- 🔴 **`Vacation_Hours_Remaining` silently stopped being a Caspio formula (2026-07-27)** while the
  table was open in Table Design. It is now a plain editable NUMBER, so it **no longer recomputes** —
  the next packet would have left it stale while every other balance updated. Both importers now
  write it; the API route **probes field editability first** so converting it back to a formula
  degrades safely instead of 400-ing the whole record update. 🔑 **A Caspio formula field can become
  a plain field without warning — never assume a derived column still derives.** (`Full_Address` and
  `Full_Name_Formula` are still formulas, which is how the probe was confirmed accurate.)
- 🔴 `Employees.First_Name` **UNIQUE cannot be cleared via REST** — returns
  `ReferentialIntegrity: "Object cannot be changed or deleted because it is referenced by one or more
  objects."` So the constraint is **load-bearing for a Caspio relationship**, not just a stray checkbox
  — do NOT blindly uncheck it in the UI; find the referencing object first. A second employee sharing
  a first name still fails to insert until that's untangled. **OPEN.**
- ✅ **RESOLVED — Clark's −16 vacation is CORRECT; NW Regional's printed 0 is the wrong display.**
  Vacation accrues at the **1-year anniversary (first 40 h)**; she was hired 2025-08-12 and is eligible
  **2026-08-16**, so she legitimately runs negative until then. 🔴 **Never "fix" a negative balance** —
  new field `Vacation_Eligible_Date` records why. (Only Clark's is set; backfill others as
  `Date_Hired + 1 yr` if that rule is universal.)

### 🔴 Post-import drift caught by auditing a CSV export (2026-07-27) — audit, don't assume
A Caspio CSV export of `Employees` compared against the packet found **6 defects the import's own
verification missed**, because that check only printed *derived* columns:
- **4 ex-employees had `Sick_Accum_Hours_Available` = 0 while `Sick_Hours_Remaining` held the
  correct figure** — internally contradictory, since remaining was computed as accrued − used at
  write time. 🔑 **Verify the SOURCE columns, not just the derived ones** — a derived value can be
  right while its input is silently zero.
- **2 salaried staff kept a stale HOURLY `Pay`** (Jim 51.92, Nika 23.00). The importer only writes
  `Pay` when the packet prints a rate, so salaried staff keep whatever was there. Both were
  provably wrong (51.92×40 ≠ 4,000; 23×80 ≠ 2,876.54) and are now cleared — `Pay_Type` +
  `Salary_Per_Period` + `Annual_Salary_Est` carry the truth. 🔑 **A field the importer skips is a
  field that silently keeps a stale value.**
Fixed by `scripts/payroll-fix-employee-drift.js` (reads back after writing). Re-audit: **21/21
match the packet.** Deliberate exception — 3 *inactive* ex-employees keep their last known `Pay`
(the packet prints no rate for them because they got no check, not because they had none).

### Verified after apply (2026-07-27)
`Employees` 38 → **46 fields**; `Payroll_Register` created (41 fields) and holds **21 rows** that
round-trip to the packet exactly (net $30,962.34, gross $38,933.71). **21/21 employees join via
`Payroll_Employee_ID`** — the join key that didn't exist before. Vacation agrees 20/21 (Clark only),
sick **21/21**. Active headcount 22 → **21** (Khiev deactivated). Every stale rate corrected —
e.g. Wright 31.25 → 42.09, Nhoung 25 → 34, Chhorn 16.50 → 23, Hede blank → 22.50.

## 5. Original 3-table proposal (superseded by §4 — kept for rationale)

Three grains ⇒ three tables. Names/fields deliberately mirror the report so import stays mechanical.

1. **`Payroll_Register`** — employee × check date (the core ask).
   `Register_Key` TEXT255 **UNIQUE** (`{empId}-{YYYYMMDD}`, idempotent re-import),
   `Payroll_Employee_ID` INT, `ID_Record_Employee` (FK), `Employee_Full_Name`,
   `Check_Date`, `Period_Start`, `Period_End`, `Check_Number`, `Pay_Rate` CURRENCY,
   `Hours_Regular/Overtime/Sick/Vacation_PTO/Holiday`, `Wages_*` + `Wages_Commissions`,
   `Gross_Wages`, `Ded_Federal_WH/Social_Security/Medicare/State_Other/WA_FamMed_Leave/WA_Cares_Fund`,
   `Total_Deductions`, `Net_Pay`, `Source_File`, `Imported_At`.
2. **`Payroll_Periods`** — one row per check date; employer-side totals that are **not** per-employee
   (`Emp_Social_Security`, `Emp_Medicare`, `Emp_Federal_Unemployment`, `Emp_State_Unemployment`,
   `Emp_Workforce_Training`, `Emp_Industrial_Insurance`, `Total_Employer_Expenses`,
   `Net_Payroll`, `Total_Payroll_Cost`, `Total_Federal_Deposit`, `Total_State_Deposit`, `Check_Count`).
3. **`Employee_Leave_Balances`** — employee × as-of date snapshot, so drift becomes visible instead of
   silently overwritten: `Balance_Key` UNIQUE, `As_Of_Date`, `Hours_Per_Day`,
   `Vacation_Accrued/Used/Available`, `Sick_Accrued/Used/Available` (decimal, **negatives allowed**).

Plus one additive change to `Employees`: **`Payroll_Employee_ID` INTEGER UNIQUE** — the missing join key.
Nothing else on `Employees` changes (10 bridge apps depend on it).

**Load path:** Caspio **CSV import** ($0 API calls, per the bulk-backfill lesson), gated on the extraction
reconciling to the packet totals. Ask NW Regional Accounting for a CSV/Excel export to skip OCR risk.

**Access control:** ✅ `Staff_Page_Access` row `payroll.html → admin` seeded 7/27 — **admin only, NOT
accountant** (Erik 7/27; payroll is the most sensitive data in the account).
→ [STAFF_AUTH_DESIGN.md](STAFF_AUTH_DESIGN.md)

## 6. ✅ Payroll dashboard + API — BUILT 2026-07-27 (not yet deployed)

`/dashboards/payroll.html` (+ `css/payroll.css`, `js/payroll.js`) — **admin only**, three tabs:
Leave Balances · Pay Periods · Upload Packet. App commit `374ad1c3`, proxy `56d029c`.

🔴 **The page NEVER shows a pay rate or salary** (Erik 2026-07-27). Enforced upstream, not in the
UI: `src/routes/payroll.js` selects through **`SAFE_EMPLOYEE_FIELDS` / `SAFE_REGISTER_FIELDS`
allowlists**, so adding a column to either table cannot leak compensation. Verified live — a real
call returned zero pay fields.

**Auth = ERIK ONLY (2026-07-27), via a new exclusive-allowlist primitive.** 🔑 A
`Staff_Page_Access` row can normally never restrict below "any admin" — `userMayAccessPage`
short-circuits on `admin` *before* reading the rule. So `userMayAccessPage` now treats **a rule
with `Allowed_Emails` and NO `Allowed_Roles` as an exclusive allowlist the admin override does
not bypass**. `payroll.html` = `roles[] emails[erik@nwcustomapparel.com]`. Still table-driven —
Erik changes who sees payroll with no deploy. ⚠ You CAN lock yourself out of such a page.
Regression-tested against every existing rule shape; only `sanmar-vendor-portal.html` matches the
new shape and its result is unchanged.
🔑 The API is gated by **`requirePageAccess('payroll.html')` — the same table row as the page**,
not `requireCrmRole`: a role gate can't express "one person", and `['admin']` would silently widen
the moment a second admin exists. It **fails CLOSED** (the page gate fails open). Proxy side stays
`requireCrmApiSecret`. Nav link lives under **Administration** in `staff-dashboard-v3/index.html`.

### Upload flow — read → reconcile → save (3 steps for a reason)
🔴 **The parse CANNOT be synchronous**: Heroku requires a first byte within 30 s and vision
extraction of a scanned packet takes longer. `POST /parse` starts a background job and returns a
`jobId`; the browser polls `GET /parse/:jobId`. 🔑 **`POST /import` takes only the job id** — the
parsed figures never round-trip through the browser, so they can't be edited between review and
commit, and the server re-reconciles before writing. The Save button stays disabled unless the
extraction reproduces the packet's own printed totals.
- Model `claude-opus-5`, PDF as a base64 `document` block + `output_config.format` structured
  output. 🔑 SDK 0.80.0's **non-beta** `messages` path already supports both and forwards the body
  verbatim — no beta namespace needed (checked in `node_modules`, not assumed).
- Body limits are raised **per-route** (`/api/crm-proxy/payroll/parse` 40 mb on the app,
  `/api/payroll/parse` 40 mb on the proxy) — never app-wide. Cap: ~23 MB PDF (Anthropic's 32 MB
  request limit after base64 inflation).
- `ANTHROPIC_API_KEY` is set on the proxy's Heroku config but **absent from the local `.env`**, so
  the parse path could not be exercised locally — reads, gating and UI were verified end-to-end
  against real Caspio data; the upload is unproven until it runs in production.

## 7. Before this was built: no payroll API existed

The proxy still has **zero** endpoints touching `Employees` / `Payroll_Register` / any HR table.
Rates and leave are editable **directly in Caspio** (datasheet or the Human Resources 2025 bridge app),
so no API is needed for manual edits. An endpoint is only required once a payroll **page** exists —
at which point it must enforce **admin** server-side (role from `Staff_App_Roles`), not merely rely on
the `Staff_Page_Access` page gate. Per-period maintenance needs no API at all: add the new packet's
figures to `import-payroll-packet.js` and re-run — the reconciliation gate rejects anything that
doesn't match the printed totals.
