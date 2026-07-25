# Q3 2026 Embroidery Bonus — design, data, and the traps

Built 2026-07-25. Replaced the Q2 2026 Garment Tracker spiff, which paid $0.50–$8.00 per garment
off a fixed style list and totalled ~$128 (Nika) / ~$54 (Taneisha) for the quarter — it paid for
units of blank goods the reps didn't control and never changed behaviour.

## 🔴 The three data traps (these are the reusable part of this doc)

### 1. Embroidery = `id_OrderType` **21 + retired 1 "Caps"**
Cap embroidery was its own order type until it folded into Custom Embroidery at the
**2025 Q3 → Q4 boundary**:

| Quarter | 21 Custom Emb | 1 Caps |
|---|---|---|
| 2025 Q3 | $253,814 | **$44,341** |
| 2025 Q4 | $531,851 | $1,095 |
| 2026 Q1+ | — | **$0** |

**Any historical embroidery query MUST union 21 + 1.** 2026-forward figures need no adjustment
(caps are inside 21 already). Two things this breaks if you forget:
- Nika's Q3 2025 reads $199,421 on type 21 alone but **$236,841 combined** — a $37K understatement
  that would set a bonus baseline far too low.
- A cap-only pre-merge customer looks like it "never embroidered" and gets paid as a brand-new
  program. Measured: Nika's 2026 Q1 "new" count drops from **8 → 3** once caps history is included.

### 2. `id_OrderType = 16` "Wow Embroidery" is $0.00 — always exclude
78 orders in 2026 at **$0.00**; 314 in 2025 at $30. It's internal redo/no-charge work. Counting it
as embroidery inflates account counts with free work. Also excluded: 31 (InkSoft — has its own
bonus), 22 Contract Embroidery + 42 Contract Caps (wholesale contract decorating, not rep-hunted).

### 3. ORDER_ODBC embroidery history goes back to **2000**, not 2019
56 orders across 10 customers pre-date 2019 (oldest 2000-02-08). Any "first-ever order" lookback
must be **unbounded**, not windowed to 2019+. Real case: **Kingfisher Charters** embroidered in
2018, so its 2026 Q2 order is a *Reactivation* ($50), not a *New program* ($75). A 2019-bounded
probe called it new.

### 4. Attribution: `Sales_Reps_2026`, never the order row
Rebuilding history through **current** ownership moves Nika's 2024 Q3 **down $79,430** and
Taneisha's 2025 Q3 **up $63,105** (she inherited Taylar Hanson's book 2025-08-12). Live at
`GET /api/sales-reps-2026`, re-synced from ShopWorks every 15 min by the bandit agent.
230 embroidery orders ($141,646) belong to customers no longer in the table (closed/purged) — they
drop out of per-rep totals by design; company totals still include them.

## 🔑 The two books have opposite Q3 seasonality

Q3 ÷ avg(Q1,Q2), on current ownership:

| Year | Nika | Taneisha's book (was Taylar's) |
|---|---|---|
| 2022 | 1.820 | 0.958 |
| 2023 | 1.250 | 0.971 |
| 2024 | 1.449 | *0.568 — rep absence, 54 orders vs ~125* |
| 2025 | 0.987 | 0.955 |
| **clean avg** | **~1.38×** | **~0.96×** |

**Nika's book is seasonal** (construction, golf, fall corporate) — Q3 runs well above H1.
**Taneisha's is flat** (multi-location hospitality/property mgmt — Hops N Drops, AMC Properties) —
Q3 tracks H1 almost exactly. Do NOT apply one book's seasonality to the other; doing so set
Taneisha's first target ~12% too high in the first draft of this plan.

Company-wide, retail embroidery (21+1) is a stable **~22% of the year in Q3**, five years running
(22.3 / 22.5 / 21.3 / 22.4 / 21.5%). July alone is only **30%** of Q3 — August is usually the
biggest month — so a linear July run-rate understates the quarter by ~12%.

## 🔑 The 378-account dormant embroidery runway

Accounts they own today, with embroidery history, quiet 12+ months (as of 2026-07-01):

| Rep | Accounts | Dormant | Lifetime embroidery in the pool |
|---|---|---|---|
| Nika | 463 | 104 (99 still to call) | $454,356 |
| Taneisha | 857 | 284 (282 still to call) | $1,235,089 |
| | | **378** | **~$1.64M** |

Taneisha owns **857 accounts to Nika's 463 but produces about half the embroidery** — broader and
shallower. **304 of hers (35%) are tagged `Win Back '26 TANEISHA`**, 170 of which have embroidery
history and are dormant. This is why the bonus pays a reactivation bounty and why the tracker
renders a **call list, not a scoreboard**.

## The plan as shipped

Scope: `id_OrderType=21`, `sts_Invoiced=1`, `date_OrderInvoiced` in 2026-07-01…2026-09-30.
History lookbacks use 21+1, unbounded. Ownership from `Sales_Reps_2026`.

**1. Activation bounties** (always earning, no gate) — account qualifies at **$1,000** of Q3 embroidery:
- **$75** New Embroidery Program (never embroidered, ever)
- **$50** Reactivated (has history, none in trailing 12 months)
- One bounty per account per quarter; New wins over Reactivated. Repeat business earns $0 by design.
- Modelled on 7 quarters of real history: **Nika ~$764/qtr, Taneisha ~$593/qtr** at status quo.

**2. Growth ladder** — highest rung reached pays:

| Rung | % of base | Pays | Nika ($235,000) | Taneisha ($100,000) |
|---|---|---|---|---|
| 1 | 85% | $150 | $199,750 | $85,000 |
| 2 | 100% | $400 | $235,000 | $100,000 |
| 3 | 115% | $700 | $270,250 | $115,000 |
| 4 | 130% | $1,200 | $305,500 | $130,000 |

Baseline provenance (current-ownership, combined 21+1):
- **Nika $235,000** — between her Q3'25 of $190,847 and her best-ever Q3 of $246,873. Q3 projection
  $222,578, so rung 1 is *below* projection (a deliberate $150 "hold your pace" rung — Erik may
  raise it to 95% / $223,250 in config).
- **Taneisha $100,000** — her book's Q3 has never exceeded $112,981 and its flat seasonality implies
  $108,265. Q3 projection $76,072. Revised down from an initial $112,000, which would have put
  rung 4 at $145,600 — 29% above anything the book had ever done in a Q3.

**3. $3M team kicker** — company Q3 invoiced subtotal, all order types, shared equally:
- ≥ **$700,000** → $250 each (2022 Q3 did $704,258)
- ≥ **$740,000** → $500 each (**$740,949** = the Q3 needed to keep $3M alive on a flat Q4;
  2024 Q3 did $767,678)

Payout envelope: typical ~$1,507 both reps · **strong ~$3,257** · exceptional ~$5,400.
If both reach rung 3 the company gains **~$86,600** of incremental Q3 embroidery for ~$1,400 of
ladder payout, which also lifts company Q3 from $628,527 projected to ~$715,000 — clearing the
first kicker. The components deliberately interlock.

$3M context: 2024 already did **$3,219,493**; 2026 projects to ~$2,887,578 on a flat Q4, so the
gap is ~$112,000 — close to what this bonus targets.

## ⏳ ERIK: create the `Rep_Bonus_Config` Caspio table (no deploy after that)

Until this table exists the endpoint returns built-in defaults **and shows a loud warning banner**
on both the dashboard card and the sync log — it never silently renders a wrong number. Creating it
makes every rate/baseline/rung Erik-editable with no deploy (the `Service_Codes` precedent).

Two rows, one per rep, `Program='EMB'`, `Quarter='Q3'`, `Year=2026`, `Is_Active=Yes`:

| Column | Type | Nika Lao | Taneisha Clark |
|---|---|---|---|
| `Program` | Text(10) | EMB | EMB |
| `Quarter` | Text(4) | Q3 | Q3 |
| `Year` | Integer | 2026 | 2026 |
| `Rep` | Text(60) | Nika Lao | Taneisha Clark |
| `Baseline_Revenue` | Number | 235000 | 100000 |
| `Rung1_Pct` / `Rung1_Pay` | Number | 85 / 150 | 85 / 150 |
| `Rung2_Pct` / `Rung2_Pay` | Number | 100 / 400 | 100 / 400 |
| `Rung3_Pct` / `Rung3_Pay` | Number | 115 / 700 | 115 / 700 |
| `Rung4_Pct` / `Rung4_Pay` | Number | 130 / 1200 | 130 / 1200 |
| `New_Account_Bounty` | Number | 75 | 75 |
| `Reactivated_Bounty` | Number | 50 | 50 |
| `Min_Account_Revenue` | Number | 1000 | 1000 |
| `Dormancy_Months` | Number | 12 | 12 |
| `Team_Kicker1_Target` / `_Pay` | Number | 700000 / 250 | 700000 / 250 |
| `Team_Kicker2_Target` / `_Pay` | Number | 740000 / 500 | 740000 / 500 |
| `Order_Type_Ids` | Text(50) | 21 | 21 |
| `History_Order_Type_Ids` | Text(50) | 21,1 | 21,1 |
| `Excluded_Customer_Ids` | Text(255) | 13500 | 13500 |
| `Date_Start` / `Date_End` | Text(10) | 2026-07-01 / 2026-09-30 | same |
| `Is_Active` | Yes/No | Yes | Yes |
| `Notes` | Text(255) | *(free)* | *(free)* |

Plus **`EmbroideryBonusArchive`** for the quarter-end freeze:
`ID_Row` (autonumber PK) · `Program` · `Quarter` · `Year` · `Rep` · `Category` (New/Reactivated) ·
`id_Customer` · `CompanyName` · `Revenue` (Number) · `BonusAmount` (Number) · `ArchivedAt` (Text).

⚠️ **Baselines are a point-in-time snapshot of ownership** — computed from the book as it stands
today and frozen in config at quarter start. If accounts move mid-quarter the baseline does not
chase them. That's intentional; don't "fix" it.

## 🔒 Where bonus dollars may appear (Erik, 2026-07-25)

**Compensation shows on a rep's OWN Mission Control page and nowhere else.** The staff
dashboard is opened by every employee, so it carries the *company* Q3 number and the shared
targets with **no payout amounts at all** — not even the kicker dollars.

The boundary is enforced in the backend, not in a render:

| Caller | Route | Returns |
|---|---|---|
| Shared staff dashboard (any staff) | `/api/crm-proxy/embroidery-bonus/team` | kicker + company revenue; `reps: {}` **always** — `scope=team` is forced server-side and cannot be widened by the query |
| Mission Control (the rep) | `/api/crm-proxy/embroidery-bonus` | that rep only — identity injected from the SAML session, so a rep can't request a colleague's |
| Mission Control (admin) | same, no `?viewAs=` | every rep (Erik's overview); `?viewAs=` scopes to one |

The rep-facing hero is `.aemc-bonus-hero`, above the KPI strip: earned-to-date, the nearest
concrete ask ("$66,596 more embroidery unlocks $150"), and three chips (new programs / won
back / % of goal). Hidden until loaded so it never flashes $0, and stays hidden on error —
a blank hero beats a wrong bonus number.

⚠️ The hero reads the **raw** `/api/embroidery-bonus` shape (`counts.*`, `bounties.*`), NOT the
flattened shape `commission-payouts.js` builds for the Flask report (`newAccounts`,
`newAccountBounty`). Mixing them renders `undefined` — it did, once.

## 🗺 The roadmap — three ranked "who to call" lists (`/api/embroidery-bonus/targets`)

The point of the bonus is a call list, not a scoreboard. Per rep, cheapest ask first:

| List | Definition | Nika | Taneisha |
|---|---|---|---|
| **C. Almost there** | already embroidering this quarter, under the $1,000 bar, **and would actually earn** | 4 accts · $2,454 gap → $250 | 5 accts · $2,404 gap → $325 |
| **A. Win back** | embroidered before, quiet 12+ months | 99 accts · $430,713 past | 282 accts · $1,232,062 past |
| **B. First program** | buys other decoration from us, **never** embroidered | 87 accts · $145,506 spend | 165 accts · $233,811 spend |

🔴 **List C MUST exclude repeat customers.** An account that ordered embroidery inside the
dormancy window earns **nothing** at the threshold. The naive version listed every
under-threshold account and overstated Nika's available bounties **5×** (26 accounts / $1,350
claimed vs 4 / $250 real) — it would have sent her chasing Hollander Hospitality for "$34 more
→ $50" that pays $0. Only New and Reactivated qualify.

Win-back ranking is `avgOrderValue × loyalty × seasonalFit × recency`, not raw lifetime spend —
what an account is worth *now* beats what it was once worth. `q3SharePct` surfaces accounts
that historically order in exactly this quarter ("Q3 buyer" chip); they're due right now.

**Strategic finding:** Taneisha's entire **Hops N Drops chain has never embroidered** — Lacey,
Silverdale, Bonney Lake, Richland and more, each ordering monthly, all DTG/transfers only.
That's her single biggest opportunity: warm relationships, constant order flow, zero embroidery.
Nika's equivalent is the Stella Jones non-embroidery divisions.

## Where the code lives

| Layer | File |
|---|---|
| Computation | `../caspio-pricing-proxy/src/routes/embroidery-bonus.js` — `/config`, `/`, `/dormant`, `/archive`. Exports `helpers` for in-process reuse. Secret-gated. |
| Quarterly report | `commission-payouts.js` — `getEmbroideryBonus()` in the `Promise.all`, folded into `quarterlyTotal`; returns `null` on failure so one broken bonus can't sink the report |
| Payroll row | `scripts/sync-commissions.js` — writes `Commission_Type = 'Embroidery Bonus'`, quarter-only `Revenue_Base` |
| Erik's card | `staff-dashboard-v3/index.html` + `shared_components/js/staff-dashboard/controllers/embroidery-bonus-controller.js` |
| Rep call list | `dashboards/ae-mission-control.html` "Embroidery Win-Backs" + `loadEmbWinBacks()` in `dashboards/js/ae-mission-control.js` |
| Rep bonus report | `../Python Inksoft/web/templates/commissions.html` Section 2 |
| Forwarders | `server.js` `/api/crm-proxy/embroidery-bonus{,/config,/dormant}` — role-gated, identity injected server-side |
| UI harness | `tests/ui/test-embroidery-bonus.html` + `-stub.js` (real captured payload) |
| Backend verification | `../caspio-pricing-proxy/tests/manual/verify-embroidery-bonus.js` — run from the proxy repo root. Hits live Caspio (minutes), so it's deliberately NOT a jest test. **The 2026 Q1 block is the frozen caps-history regression: Nika's new-account count must be 3, not 8.** |

🔴 **`'Embroidery Bonus'` must stay in BOTH `COMPUTED_TYPES` sets** — `commissions.html` (Flask)
and `ae-mission-control.js`. Flask totals a fixed list of types; Mission Control sums the ledger
type-agnostically. Miss one and the two surfaces disagree by exactly this bonus — that's the
2026-07-21 Setup Bonus bug repeating.

## Retired in the same change
- Garment Tracker card, controller (`garment-tracker-controller.js`, deleted) and its Heroku
  Scheduler `sync-garment-tracker` job. **Backend config/routes/`GarmentTrackerArchive` kept** so
  Q2 2026 stays readable. `garment-tracker-config.js` is still pinned to `2026-Q2` — that's why the
  old card was displaying a closed quarter.
- `shared_components/js/staff-dashboard-service.js` — now loaded by nothing (flagged dead, not deleted).
- The two `2026_Bonus_Cheat_Sheet_*.pdf` links: the Bonus Plan button now points at
  `dashboards/commission-structure.html`, which is generated from the live rates and can't drift.
