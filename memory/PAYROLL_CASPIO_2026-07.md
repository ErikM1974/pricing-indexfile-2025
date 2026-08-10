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
- 🔴 **`Employees.First_Name` UNIQUE — ROOT CAUSE FOUND 2026-07-28, and the decision is DON'T FIX.**
  The Caspio Designer refuses too ("Cannot delete or change this field because of one or more
  dependencies") and names them. 🔑 **The crux is two Caspio AUTHENTICATIONS keyed on First_Name —
  `Employees_Firstname` and `Employees_Firstname_Art_TeamNWCA`.** Caspio requires an authentication's
  username field to be unique, so the flag is mandatory while they exist; the 8 views and 4 DataPages
  it also lists (incl. `/Password Recovery`, `/Vacation_Hours_Sick_2023`) are softer references.
  This is the legacy pre-SAML login — all 16 active employees still have a `Password` set.
  ⚠️ **Verify by BEHAVIOR, not metadata.** Unchecking the box in the Designer leaves REST reporting
  `Unique: true` AND a duplicate insert still rejected (*"duplicate or blank values are not allowed
  in field 'First_Name'"*). Only an actual insert attempt proves the state.
  **DECISION (Erik 2026-07-28): leave it.** Payoff is only "two staff may share a first name";
  risk is locking staff out of Caspio auth. **Workaround:** give a second same-named hire a
  distinguishing `First_Name` ("Steve M") and let `Employee_Full_Name` carry the display name.
  If ever revisited, `Email_Employee_Login` is the natural replacement auth field — already unique,
  no duplicates, 14/16 populated (Mikalah Hede + Taneisha Clark blank).
- ⏳ **Joseph Hallowell and Sothea Tann quit and were rehired** (Erik 2026-07-28) — both ~1 week of
  current service. `Date_Hired` still holds the ORIGINAL hire (2019-07-22 / 2022-09-22), so any
  tenure math off that field is wrong for them, and their 40 h accrued is carryover from the prior
  stint. Neither has a `Vacation_Eligible_Date`, so the dashboard can't explain their balances the
  way it does Clark's. OPEN: decide rehire-date handling + whether pre-quit balances carry over.
- 🔑 **Sorphorn Sorm's 112 h vacation accrual is what the packet says** — re-read at 3× zoom, and
  her neighbours are plainly 80:00, so it is not a misread. It is also baked into NW Regional's own
  printed 1072:00 total (80 would make it 1040). But it is anomalous: she is the ONLY person above
  80, at 15.3 years, while Erik (29.6 y) and Ruthie (28 y) are at 80 — accrual here does not track
  tenure. **A question for Liesl, not a Caspio edit** — correcting it locally would desync from the
  packet and trip the import reconciliation gate.
- 🔴 (superseded, kept for the REST symptom) `Employees.First_Name` UNIQUE cannot be cleared via REST — returns
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

## 7. ✅ Vacation carryover correction — BUILT 2026-08-03

**The slip was printing the accountant's tax-year figures, not the employee's year.** Payroll
books hours to the tax year of the **check** date. Vacation taken in the last pay period of a
calendar year is paid on a January check, so it lands in the *next* payroll year — and to pay
it, the prior year's balance is carried forward. Both accrued and used arrive inflated by the
same carryover and **cancel**:

```
Sorphorn Sorm 2026 imports 112 / 56 / 56   (32 h taken 12/22, 12/23, 12/29, 12/30 2025,
  112 = 80 (2026 grant) + 32 carried in     paid on the 01/09/2026 check)
   56 = 24 (real 2026 use) + 32 the same
   56 = 80 − 24 ✔                           slip must read 80 / 24 / 56
```

This is correct cash-basis accounting on Liesl's side — **a display problem on ours only**.
🔑 **`Vacation_Hours_Remaining` is the ONE imported figure that needs no adjustment**, because
the carryover cancels out of it.

- **New Caspio column `Vacation_Annual_Entitlement`** (NUMBER, `Employees`, created + seeded
  for all 16 actives 2026-08-03; read back verified). 🔴 **It MUST be its own column** — the
  Friday import overwrites all three `Vacation_Hours_*` columns, so parking the entitlement in
  one of them destroys it on the next import and silently reverts Sorphorn to 112.
  `Vacation_Eligible_Hours` is **not** a substitute (set only for non-vested staff — Clark alone).
  Erik hand-maintains it; the dashboard reads it live; nothing in code hardcodes a table.
  Seed/repair script: proxy `scripts/add-vacation-entitlement-field.js` (dry-run default,
  re-runnable, `--force` required to overwrite a hand-set value).
- **Transform** (`dashboards/js/vacation-carryover.js`, 47 jest tests):
  `carryover = max(0, available − entitlement)` · `slip_accrued = entitlement` ·
  `slip_used = used − carryover` · `slip_remaining = remaining` (untouched).
  🔴 **Never hardcode 32** — it changes with each December and clears at the year rollover.
- 🔑 **Date-effective entitlement without a second column**: `entitlementInForce()` returns 0
  when `asOf < Vacation_Eligible_Date`, else the stored value. That is exactly Taneisha Clark's
  0 → 40 on **2026-08-12**, using a column Caspio already carries, and it needs no edit on the
  day. It keys off `Leave_Balances_As_Of`, **not today**, so a reprint of an old packet is
  still right.
- 🔴 **Blank ≠ 0.** Caspio returns an empty NUMBER as `''` and `Number('') === 0`. A blank
  entitlement **blocks the slip** (never defaults to 80 — a guess prints a wrong number on
  paper); a real 0 is legitimate (Jim Mickelson, salaried). Verified live: Caspio round-trips
  the seeded 0 as JSON `0`, so his slip prints.
- 🔴 **Sick hours are NEVER transformed** — WA State paid sick leave legitimately carries over
  (statutory, up to 40 h), so sick accrued above any annual figure is expected. Jest-locked.
- **Gates before print**: a set entitlement, the identity `accrued − used == remaining` (±0.01),
  and `slip_used >= 0` are **blocking**; negative carryover, a borrowed/unknown as-of, and
  balances >14 days old are **warnings**. A blocked employee is named in a banner, named again
  in the status line, and written to the audit CSV as `slip_printed=no` — a missing slip is
  explained, never merely absent.
- 🔴 **THE IDENTITY ASSERTION §7.1 DOES NOT VALIDATE THE ENTITLEMENT — `slip_used >= 0` does.**
  Caught by an adversarial review, 2026-08-03. Whenever entitlement ≤ available the `max(0,…)`
  clamp is inert and the entitlement **cancels out**: `E − (U − (A − E)) = A − U`, which the
  import guarantees equals remaining (it writes `Vacation_Hours_Remaining = r2(accrued − used)`).
  So the check is a **tautology** in exactly the regime the feature exists for. Sorphorn with a
  mis-keyed entitlement of 8 produced `slip = {accrued 8, used −48, remaining 56}` — `printable:
  true`, `flags: []`, and "Hours used −48.00" printed on paper. The guard that works: a carryover
  is by construction hours both accrued AND used in the prior year, so **`carryover > used` is an
  impossible state**. 🔑 **My own comment — "holds algebraically for every case" — was the
  evidence the check was worthless, written as if it were reassurance.**
- ⚠️ **Residual, deliberately documented**: a mis-keyed entitlement at or above `remaining`
  yields a self-consistent slip and is undetectable (Sorphorn 70 instead of 80 → 70/14/56, no
  flag). Detection covers a typo of ≥24 h for her. Closing it needs a **second authority** (an
  entitlement history, or Liesl's own grant figure), not a cleverer assertion. Pinned by test.
- 🔴 **Each employee is scored on THEIR OWN `Leave_Balances_As_Of`, never the roster's newest.**
  The import PUTs `Employees` one row at a time inside a try/catch, and an active employee absent
  from the packet is never touched — so one person can sit months behind. Because the roster max
  is always ≥ the individual, borrowing it could only ever **suppress** the §7.4 warning, for
  exactly the person it exists to catch (measured: 178 days old, scored as 3). It also had the
  §9 gate evaluating one person's eligibility against another's date, and printed a balance date
  the numbers did not come from. Roster max is now a **fallback only**, and flagged when used.
- 🔒 **Pre-existing pay leak closed in the same pass**: `reconcile()` built `rowIssues` as
  `"NAME: gross X - deductions Y != net Z"`, and `toSafeReview()` attaches the whole verdict
  object, so a failed reconciliation put **per-employee gross, deductions and net into the
  browser** and rendered them — on the one page whose entire reason for existing is that
  compensation never reaches it. 🔑 **A field-by-field allowlist protects the fields; it does
  nothing about a formatted STRING built from the same data.** Now names the row only.
- **Audit trail** = a `payroll-slip-audit-YYYY-MM-DD.csv` the browser downloads on every print
  run (Erik's call over a new Caspio table: zero quota, no schema change, files with the
  packet). Carries raw + adjusted + entitlement + carryover + flags per employee, and the
  reason string `prior-year vacation paid on a current-year check date`.
- **Slip now prints accrued/used/remaining for BOTH vacation and sick** (was: vac used, vac
  remaining, sick remaining). Still 6 slips/sheet — measured in Chromium under print media at
  3.333 in, ~0.68 in of slack per slip.
- ⚠️ **Sorphorn read 80/24/56 in Caspio on 2026-08-03, not 112/56/56** — a hand-patch applied
  after the 7/24 import. The next Friday import overwrites it back to 112 and the transform
  starts doing real work then. 🔑 **Hand-correcting an imported column is the failure this
  feature replaces** — don't do it again.
- ✅ **Sothea Tann's 40 is a FULL annual grant, not a partial year** (Erik 2026-08-03). So a
  non-80 entitlement is a normal, permanent case — never "correct" it to 80, and never infer an
  entitlement from tenure. Her 40/40/0 import yields carryover 0 and a slip of 40/40/0.

## 8. Before this was built: no payroll API existed

The proxy still has **zero** endpoints touching `Employees` / `Payroll_Register` / any HR table.
Rates and leave are editable **directly in Caspio** (datasheet or the Human Resources 2025 bridge app),
so no API is needed for manual edits. An endpoint is only required once a payroll **page** exists —
at which point it must enforce **admin** server-side (role from `Staff_App_Roles`), not merely rely on
the `Staff_Page_Access` page gate. Per-period maintenance needs no API at all: add the new packet's
figures to `import-payroll-packet.js` and re-run — the reconciliation gate rejects anything that
doesn't match the printed totals.

## 9. Leave-only upload mode (2026-08-10)

The uploader takes **two document shapes**, declared by the caller as `mode` on `POST /parse`:

| mode | Document | Writes |
|---|---|---|
| `packet` | the full monthly packet (all 3 reports) | `Payroll_Register` rows **and** the `Employees` leave columns |
| `leave` | "Available Vacation And Sick Time" **on its own** | the `Employees` leave columns only — **no register row, no `Pay`** |

- 🔴 **The mode is never inferred.** An unknown value is a 400, not a fallback to `packet`. See the
  vacuous-gate entry in LESSONS_LEARNED — a leave page run through the packet reader extracted 0 for
  every money figure and *passed* a gate that had checked nothing.
- `reconcileLeave()` checks **all six** leave columns against the report's own `Total:` row. There is
  no money field in `LEAVE_SCHEMA` at all, so there is nothing to zero out and no free pass.
- 🔑 **`Hrs Avail.` is a printed column, not accrued − used.** The report floors an over-drawn balance
  at `00:00` instead of printing a negative. On the 2026-08-07 page that is **Taneisha Clark** (0
  accrued, 16 used, printed `00:00`) — and it is the whole reason the vacation totals read
  **1112 / 796 / 332** when 1112 − 796 = 316. Leave mode saves the printed figure into
  `Vacation_Hours_Remaining` / `Sick_Hours_Remaining`; a mismatch surfaces as a **non-blocking note**
  on the review screen rather than being silently resolved.
- ⚠️ **The `packet` path still derives remaining as accrued − used** — deliberately left alone, since
  changing it moves balances on the monthly import too. If both paths are used on the same period they
  will disagree for exactly the floored rows.
- Extraction checksum for the 2026-08-07 page: vacation **1112:00 / 796:00 / 332:00**, sick
  **937:10 / 460:00 / 477:10**, 21 employees. Locked in `tests/jest/payroll-leave-reconcile.test.js`
  (proxy) with every row, so a prompt or schema change that breaks the read fails a test.
- The page is behind SAML + the `payroll.html` `Staff_Page_Access` row, so the review screen cannot be
  eyeballed locally. `tests/ui/payroll-review-harness.html` (app repo) mounts the **real** markup and
  **real** `payroll.js` with only `fetch` stubbed — serve the repo root via the `static-qa` launch
  entry and open it.
- 🔑 Parse jobs are **in-memory with a 30-minute TTL**, and `jobId` is a plain JS variable: reloading
  the page loses the review and the Save button even though the server still holds the parsed payload.
  There is no way back to it — re-read the file.
