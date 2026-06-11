# NWCA Pricing System — Master Roadmap (post 2026-05-23)

**Author**: Claude (Anthropic) for Erik · **Last updated**: 2026-05-23 evening
**Status**: ⚡ Active — pick up at "What's next" section

This is the **current** master plan after today's big session.
Supersedes `QUOTE_BUILDER_UNIFICATION_PLAN.md` (kept for historical context).

---

## 🎯 The North Star

**Every quote builder pushes orders into ShopWorks like DTG does today.**

A rep finishes a quote → clicks one button → the order lives in ShopWorks
OnSite with the right Work Order #, customer linked, design linked, line
items pushed, notes routed correctly. No double-entry. No paper handoff.
No "I'll type it into SW after lunch."

| Builder | Pricing math | Visual identity | **ShopWorks push** | Quote-view ↔ SW sync |
|---|:---:|:---:|:---:|:---:|
| **DTG** | ✅ | ✅ | ✅ **GOLD STANDARD** | ✅ |
| **Order Form** | ✅ | ✅ | ✅ | ✅ |
| **EMB** | ✅ | ✅ | ✅ (`pushToShopWorks()` wired) | ✅ |
| **DTF** | ✅ | ✅ | ❌ **Phase 8 (NEXT BIG)** | n/a until pushed |
| **SCP** | ✅ | ✅ | ❌ **Phase 8** | n/a until pushed |
| **Cap** | ✅ | partial | ❌ **Phase 8** | n/a until pushed |

**That's the endgame.** Everything else in this roadmap (visual unification,
code health, inline-form refactor) is *supporting infrastructure* for this.

---

## ✅ Shipped today (2026-05-23) — already in production

### Phase 0 — Pricing baseline coverage (DONE)
- All 22 scenarios captured + signed off + locked in `tests/pricing-baselines/baselines.locked.json`
- 18/22 fully wired (DTG 5, EMB 3 simple, DTF 5, SCP 5)
- 4 EMB stubs (`EMB-03/04/05/06`) flagged `_needsUIVerification:true` — deferred to Phase 0b.1.5

### Phase 0b — CI regression gate (DONE)
- `scripts/capture-pricing-baselines.js` (Puppeteer headless)
- `tests/integration/pricing-baselines.test.js` (Jest diff vs locked)
- 3-try retry kills network flakiness (Phase 0b.2)
- `npm run test:pricing-baselines` — gate runs in ~17s
- Fails CI on any per-piece >$0.01 drift

### Phase 2 — Pacific Northwest visual unification (DONE — all 4 sub-phases)
- 2a: `shared_components/css/quote-builder-shell.css` — canonical PNW tokens + legacy aliases
- 2b: Applied to all 4 quote builders (DTG/EMB/DTF/SCP)
- 2c: Killed remaining hardcoded lime/blue across builder CSS
- 2d: Extended to 5 customer-facing calculators (`/calculators/*-pricing.html`)
- 2f: Applied to Quote Management dashboard
- Result: every customer + rep surface now PNW forest palette

### SCP pricing margin lift (DONE)
- Caspio `Pricing_Tiers` PK_ID 14/15/16 updated (0.50→0.48, 0.55→0.50, 0.60→0.50)
- Verified live with re-captured baselines
- **Estimated annual revenue lift: ~$7K-9K on 100 SCP orders/year** (scales linearly)

### OF-0050 / WO# display fix (DONE earlier today)
- Quote Management dashboard now shows "IN SHOPWORKS #141918" instead of just "IN SHOPWORKS"
- $0 line guard in submit + design type fallback chain in quote-view
- Verified live in production after this session's deploy

---

## 📋 What's next — prioritized

### Priority 1 — Quick wins (each ≤ 1 day, do these first)

#### Phase 0b.1.5 — Rewrite EMB runner via `calculateQuote()` (1-2 hr)
**Why**: removes `_needsUIVerification:true` flags on EMB-03/04/05/06. Current baselines are from `EmbroideryPricingService` (DECG/AL API paths); EMB builder UI uses `EmbroideryPricingCalculator.calculateQuote()` which has a different formula (e.g., Full Back: min 25K stitches × $1.25/K SURCHARGE, not DECG-style base+extra).

**How**:
1. Open `shared_components/js/embroidery-quote-pricing.js`, study `calculateQuote(products, logos, logoConfigs?, options)` signature (line 1321)
2. Each scenario needs payload construction:
   - `products = [{ style, isCap, totalQuantity, sizes, baseUnitPrice }]` (baseUnitPrice fetched separately from `/api/base-item-costs` or pricing-bundle)
   - `logos = [{ position, stitchCount, isPrimary }]`
3. Replace the 4 specialized EMB branches in `scripts/capture-pricing-baselines.js` with `calculator.calculateQuote(...)` calls
4. Re-capture, diff against current baselines, decide if old values were close enough or need an update
5. Remove `_needsUIVerification` flags from `baselines.locked.json`

**Verification**: drive the EMB UI live for one of each path (Full Back, AL, cap, beanie) and confirm script captures match what rep sees.

#### Phase 2g — DTF section labels final pass (15 min)
**Why**: BACK and SLEEVES labels in DTF builder are now PNW moss/cedar instead of blue/orange — good zone differentiation, but the moss might still feel "too blue-ish" in some lighting. Worth a final eyeball + possible swap to PNW pine/cedar/sage trio for more contrast.

#### Dashboards — apply PNW to remaining (1-2 hr)
**Why**: Phase 2f hit Quote Management. Many other rep dashboards still have legacy navy:
- `dashboards/ae-dashboard.html` (Art Hub Steve/Ruth queues + AE views)
- `dashboards/art-hub-ruth.html` / `dashboards/art-hub-steve.html`
- `dashboards/bradley-screenprint.html` / `dashboards/bradley-transfers.html`
- `dashboards/nika-crm.html` / `dashboards/taneisha-crm.html`
- `dashboards/house-accounts.html`
- `dashboards/supacolor-orders.html`
- `dashboards/digitized-designs.html`
- `dashboards/monogram-dashboard.html`
- `dashboards/bundle-orders-dashboard.html`

**Pattern**: identical to Phase 2f — find hardcoded steel-blue/navy in each dashboard's CSS, swap to `var(--pnw-forest, fallback)`, add `shell.css` link before the dashboard CSS. **Use Claude in Chrome to verify each one live** (since some are Caspio-auth gated).

#### Phase 0b.3 — Add inline `style=""` audit to capture script (1 hr)
**Why**: today's screenshots showed EMB has a purple "Paste from ShopWorks" button + an "Add Service" blue button — both from inline `style=""` attributes that bypass shell tokens. Add a check that flags excessive inline styles in HTML files (CLAUDE.md Rule #3 spirit).

---

### Priority 2 — Medium effort (1-2 days each)

#### Phase 1 — Code health audit per builder
**Why**: Phase 3 (inline-form refactor) is high-effort; an audit informs effort estimates and finds dead code / shared-helper candidates we can extract first.

**Per-builder report covering**:
- Dead function detector + grep for unreferenced exports
- jscpd (copy-paste detector) across the 4 builders
- Hardcoded magic numbers / API URLs (grep for `https://`)
- Variables shadowing / scope leaks (eslint strict)
- Cyclic imports / load-order bugs (madge)
- Files referenced 0 times

**Deliverable**: one `CODE_HEALTH_REPORT_<builder>.md` per builder. Plus a `SHARED_CANDIDATES.md` listing patterns ready to extract into helpers (we already did `customer-context-banners.js` — there's more like that).

**Tooling**: use the `Explore` agent for the grep work; jscpd / madge / eslint as Node CLIs.

#### Phase 6 — Apply SCP margin learning to DTG/EMB/DTF (NEW — emerged from today)
**STATUS UPDATE 2026-06-11**: DTG + DTF portions SHIPPED — Erik changed Caspio `Pricing_Tiers` MarginDenominator on 2026-05-24: 0.57 → 0.53 (tiers 24-47/48-71/72+) and 0.57 → 0.55 (DTG 1-23 / DTF 10-23). Discovered via the Phase-0 pricing-baselines gate going red (5 scenarios); traced, Erik signed off, baselines re-locked 2026-06-11 (see LESSONS_LEARNED 2026-06-11 Pricing entry). **EMB remains 0.57 flat — still open.**
**Why**: today's SCP margin tighten (PK_ID 14→0.48, 15→0.50, 16→0.50) lifted projected revenue ~$7-9K/yr. DTG/EMB/DTF all use FLAT 0.57 margin across tiers. They're "leaving money on the table" the same way SCP was.

**Proposed changes** (would need Erik's sign-off per-method):
| Method | Current | Proposed |
|---|---|---|
| DTG | 0.57 flat | 0.55 / 0.57 / 0.60 / 0.62 (progressive — small premium, big-volume discount) OR tighten to 0.50 / 0.53 / 0.55 / 0.55 (more SCP-style) |
| EMB | 0.57 flat | 0.50 / 0.53 / 0.55 / 0.55 / 0.55 (premium on tier 1-7 captives, tighten tier 72+) |
| DTF | 0.57 flat | 0.55 / 0.55 / 0.55 / 0.55 (modest sweep, mostly tier-72+ tighten) |

**Risk**: customer perception. Need to coordinate with sales side. Don't ship blindly — present revenue math per method.

**Workflow**: same as today's SCP — `caspio_update_record` on `Pricing_Tiers` table, then re-capture baselines + verify CI passes, then re-lock.

#### Phase 7 — EMB LTM gap fix + minimum-order-value reframe (NEW)
**Why**: today's pricing audit found:
- EMB has a $7.14/pc cliff at qty 7→8 (saving with one extra piece). Worth a "nudge" prompt at 5/6/7.
- "LTM Fee" language is engineer-speak. "Minimum order value $X" is friendlier.

**Concrete tickets**:
1. Add graduated LTM to EMB: qty 1-7 $50 (current) · 8-15 $25 (new) · 16-23 $10 (new) · 24+ $0
2. Mirror to DTG (qty 1-23 currently flat $50 → graduated)
3. Frontend: "+1 piece saves $50" hint at qty 5/6/7
4. Frontend: relabel "LTM Fee" → "Minimum Order Value: $X" in quote PDF, customer email, dashboard chips

---

### Priority 3 — Big bet (multi-week)

#### ⭐ Phase 8 — ShopWorks push for DTF / SCP / Cap (the North Star)
**Why**: This is the actual goal. Reps finish a quote → one button →
order lives in ShopWorks. EMB + DTG + Order Form already do this. The
remaining 3 builders are the gap.

**What "done" looks like per builder** (mirror what DTG + EMB do today):
1. **Backend endpoint** `POST /api/submit-{method}-order` in `server.js`
   - Accepts the quote payload (customer, products, services, totals)
   - Translates to ManageOrders LineItems + LineDecors + Notes
   - Posts to `https://manageordersapi.com/onsite` with the right `ExtSource`
   - Returns the SW `id_Order` (WO#)
   - Writes `ShopWorks_Order_Number` back to `quote_sessions` row
   - Idempotency cache + `PushedToShopWorks` flag prevents duplicate pushes
2. **Frontend push button** in the builder (mirrors EMB's `pushToShopWorks()`)
   - Validates required fields (customer, design, line items > 0, no $0 lines)
   - Spinner + success/error toast
   - Disabled state after successful push (or `force=true` override)
3. **Quote-view integration** — once pushed, the quote-view page shows the
   SW snapshot overlay (already built for DTG/EMB — works for any builder
   that pushes)
4. **Design linking** — known design # → `{id_Design: N}` in payload;
   unknown → `Designs: []` (per memory rule)
5. **Fee routing** — known fee PNs → `LinesOE`; unknown → `Notes On Order`;
   `TAX`/`SHIP`/`DISCOUNT` → order-level (per memory rule)
6. **Method-specific specifics**:
   - **DTF**: location + transfer size mapping; PressingLaborCost as
     separate line; freight cost rolled into per-piece
   - **SCP**: color count drives screen charges; 2 LTM tiers ($75/$50);
     ink color list as Notes
   - **Cap**: cap-style PN mapping; cap-specific embroidery service codes
     (CB/CS/3D-EMB/AS-CAP/AL-CAP); flat-headwear distinction
     (`ProductCategoryFilter.isFlatHeadwear()` for beanies)

**Reference patterns to copy**:
- DTG submit flow — `shared_components/js/dtg-inline-form.js` + server.js
- Order Form submit — `server.js:2448` (`/api/submit-order-form`)
- EMB push — `shared_components/js/embroidery-quote-builder.js:6719`
  (`pushToShopWorks()`)
- 3-Day Tees submit — `server.js:1625` (`/api/submit-3day-order`)
  (most complete reference — payload mapping is the cleanest)

**Critical sync points** (from `MEMORY.md` — DO NOT REGRESS):
- `Color` field MUST be `CATALOG_COLOR`, NOT `COLOR_NAME` (proxy v606 fix)
- Size translation: push BASE PN + plain size; OnSite appends modifiers
- Tax: `TaxTotal: 0` (NWCA always sets to zero in MO push)
- 2XL → `_2X` suffix, `Size05` (NOT `_2XL`, NOT `Size06`)
- Notes — only 4 valid types: `Notes On Order` / `To Production` /
  `To Purchasing` / `To Art`. One bad type aborts push.
- New quote ID prefix per method (or reuse existing — DTF=SPC, SCP=SSC,
  Cap=EMBC per `MEMORY.md` quote prefix list)

**Effort estimate**:
- DTF: ~5 days (medium complexity — location config but well-shaped data)
- SCP: ~5 days (color count + screen charges + 2-LTM tier math)
- Cap: ~3 days (smaller scope; mostly EMB pattern with cap PN mapping)

**Total: ~2-3 weeks calendar with the safety net of CI gate catching
pricing drift + `?legacy=1` flag for rep rollback.**

**Dependency**: Phase 3 (inline-form refactor) is NOT a prerequisite —
push can ship on top of current builder forms. But the refactor would
make the submit code much cleaner per builder. Order is flexible:
- **Path A (push first)**: ship Phase 8 on current builders → reps get
  the value immediately → refactor in Phase 3 with confidence
- **Path B (refactor first)**: ship Phase 3 inline-form refactor → then
  push in Phase 8 uses the clean shell. Slower to value but cleaner code.

**My recommendation: Path A.** Ship the business value (push to SW)
first, refactor for code quality after. Reps will thank you faster.

#### Phase 3 — Inline-form widget refactor (DTG pattern → EMB/DTF/SCP)
**Why**: Biggest payoff. Currently EMB has an 11,209-line builder.js, DTF 3,267, SCP 3,966. DTG's clean state→render pattern in `dtg-inline-form.js` is the gold standard.

**Approach** (from original plan, still valid):
1. Extract DTG's pattern as `shared_components/js/quote-builder-inline-shell.js`
2. Refactor each builder to USE the shell + provide method-specific config

**Effort by builder**:
- SCP first (smallest at 3,966 LOC of services) — 5 days
- DTF next (3,267 LOC of services) — 5 days  
- EMB last (the monster, 11,209 LOC) — 10 days

**Total**: 3-4 weeks calendar with daily deploys.

**Critical**: SHIP BEHIND `?legacy=1` FEATURE FLAG so any rep regression can fall back. Don't blank-slate — incrementally refactor with the CI gate as safety net.

#### Phase 4 — Feature parity with DTG
Once shell is unified, add missing DTG features to EMB/DTF/SCP:
- Tier-break optimizer ("Add 7 more pieces, save $2.10/pc")
- Inventory check per row (SanMar stock badges)
- NWCA-approved catalog browser (left-column)
- AI Research Assistant chat panel
- Customer history pill (90-day order summary per customer)
- Per-customer past designs

**Effort**: 2 weeks (mostly extracting DTG implementations into shared helpers).

#### Phase 5 — Dashboard polish + documentation
- Quote Builders section on staff dashboard: consistent icons + descriptions
- `QUOTE_BUILDERS_GUIDE.md` for reps — "when to use which" + screenshots
- ACTIVE_FILES.md cleanup (~50 lines as shared helpers extract)
- Archive legacy files explicitly

**Effort**: 1 week.

---

## 🗺 Recommended sequencing — North Star first

```
Week 1 (next session candidates — quick wins):
  Day 1: Phase 0b.1.5 EMB runner (1-2hr) + Dashboard polish remaining (2hr)
  Day 2: Phase 6 pricing margin lift proposals (research + Erik decision)
  Day 3-5: Phase 1 code health audit (parallelizable)

⭐ Weeks 2-4: PHASE 8 — ShopWorks push for DTF / SCP / Cap (the real goal)
  Week 2: DTF push (mirror EMB pattern — backend + frontend + quote-view)
  Week 3: SCP push (color count + screen charge + 2-LTM tier math)
  Week 4: Cap push (PN mapping + cap-specific service codes)

Week 5-7: Phase 3 inline-form refactor (cleanup AFTER push ships)
  SCP first → DTF → EMB. Each behind ?legacy=1 for safe rollback.

Week 8:
  Phase 4 feature parity rollout (tier hints, AI chat, catalog, inventory)
  Phase 5 dashboard polish + docs

Throughout: Phase 7 pricing UX changes (LTM reframe, nudge prompts)
whenever Erik approves them
```

**Honest take**:
- Phase 8 IS the actual business goal. Should be Priority 1A after the
  quick wins.
- The original 8-week unification plan didn't fully scope Phase 8
  (it focused on visual + structural unification). Now that the
  visual+CI infrastructure is in place, Phase 8 is the next-most-valuable
  thing on the board.
- We did Phase 0+2 in 1 day. At that pace, Phase 8 (3 builders) is
  realistically 2-3 weeks of focused work.

---

## 🚨 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 3 EMB refactor breaks pricing | Medium | HIGH | CI gate catches drift; feature flag for rollback |
| Pricing margin changes (Phase 6) hurt win rate | Medium | Medium | Coordinate with Erik per-method; monitor close rate 30d after each change |
| Reps confused mid-quote by new UI | Low (we have feature flag plan) | Medium | `?legacy=1` query param parallel-run for 1 week per builder |
| Customer-facing PNW palette change shocks customers | Low (already deployed today, no complaints expected) | Low | Already shipped — monitor support tickets for 48hr |
| Quote builders ↔ ShopWorks sync drifts | Low | HIGH | OF-0050 fixes deployed; quote-view overlay shows SW truth |
| CI gate becomes flaky | Low (3-try retry shipped) | Low | Phase 0b.2 already mitigates; can extend to 5 tries if needed |

---

## 📁 Key files map (for next session pickup)

```
memory/
  ROADMAP_2026_05.md                    ← YOU ARE HERE (this file)
  QUOTE_BUILDER_UNIFICATION_PLAN.md     ← Historical 8-week plan (reference)
  LESSONS_LEARNED.md                    ← Recurring bugs / patterns

scripts/
  capture-pricing-baselines.js          ← Puppeteer capture for CI gate

tests/
  pricing-baselines/
    SCENARIOS.md                        ← 22 test cases (humans read)
    baselines.captured.json             ← Fresh script output (gitignored)
    baselines.locked.json               ← Erik-approved (CI compares to this)
    README.md                           ← Workflow + how to re-lock
  integration/
    pricing-baselines.test.js           ← Jest gate

shared_components/css/
  quote-builder-shell.css               ← PNW tokens (single source of truth)
  quote-builder-common.css              ← Legacy utilities (use var() refs)
  *-quote-builder-extracted.css         ← Per-builder overrides
  force-green-theme.css                 ← Customer calc green forcer (now PNW-aware)
  universal-pricing-header.css          ← Used by all 5 customer calcs

quote-builders/                         ← Rep tools (4 HTMLs, all PNW)
calculators/*-pricing.html              ← Customer tools (5 HTMLs, all PNW)
dashboards/quote-management.html        ← Rep dashboard (PNW header)

server.js                               ← Express backend, ~5000+ lines
shared_components/js/
  customer-context-banners.js           ← Shared helper (Phase 1.5 prototype)
  *-quote-builder.js                    ← Per-builder controllers
  *-pricing-service.js                  ← Per-builder pricing APIs
  embroidery-quote-pricing.js           ← EmbroideryPricingCalculator (calculateQuote)
```

---

## 🔧 Common commands (next session)

```bash
# Start dev server
npm start                                          # http://localhost:3000

# Pricing regression gate (local — requires npm start in another terminal)
npm run capture:pricing                            # write fresh captured.json
npm run capture:pricing:headed                     # show browser (debug)
npm run test:pricing-baselines                     # full CI gate (~17s)

# Re-lock baselines (after intentional pricing change)
cp tests/pricing-baselines/baselines.captured.json tests/pricing-baselines/baselines.locked.json

# Deploy (current pattern: develop → main → heroku/main)
git push origin develop
git checkout main && git merge --ff-only develop
git push origin main && git push heroku main
git checkout develop

# Update CHANGELOG (single-line Phase N entry per release)
# Then: git add CHANGELOG.md && git commit -m "Changelog v2026.05.23.N"
```

---

## 🧠 Pickup prompts for next session

If continuing fresh, start a new conversation with one of these:

**Quick win (Priority 1)**:
> "Phase 0b.1.5 — rewrite EMB runner in scripts/capture-pricing-baselines.js to use
> EmbroideryPricingCalculator.calculateQuote() so the 4 EMB stubs become real
> baselines. See ROADMAP_2026_05.md for context."

**Code audit (Priority 2)**:
> "Phase 1 code health audit. Run jscpd + madge + eslint strict across the 4
> quote builders. Write CODE_HEALTH_REPORT_<builder>.md per builder + a
> SHARED_CANDIDATES.md. See ROADMAP_2026_05.md."

**Pricing improvements (Priority 2)**:
> "Phase 6 — apply SCP margin learning to DTG/EMB/DTF. Present revenue math
> per-method proposal, get my approval, then update Caspio Pricing_Tiers.
> See ROADMAP_2026_05.md for current proposed values."

**⭐ THE BIG ONE — ShopWorks push (Priority 3)**:
> "Phase 8 — wire DTF push to ShopWorks. Mirror EMB's pushToShopWorks()
> pattern (shared_components/js/embroidery-quote-builder.js:6719) +
> backend route like POST /api/submit-order-form. Use ManageOrders push
> URL https://manageordersapi.com/onsite with ExtSource: 'NWCA-DTF'.
> Idempotency cache + PushedToShopWorks flag. CI gate is safety net.
> See ROADMAP_2026_05.md for full spec + critical sync points."

**Big refactor (Priority 3)**:
> "Phase 3 inline-form refactor — start with SCP. Extract DTG's state→render
> pattern from dtg-inline-form.js into a shared quote-builder-inline-shell.js,
> then refactor SCP to use it. Ship behind ?legacy=1 flag. CI gate is safety
> net. See ROADMAP_2026_05.md."

---

**Last words**: We're in a great spot. Visual + CI infrastructure done.
Pricing model proven malleable (SCP lift). 22 baselines locked. **The
North Star is Phase 8 — every quote builder pushing to ShopWorks like
DTG does today.** EMB is already there. DTF / SCP / Cap are the gap.
~2-3 weeks of focused work to close it. Future Claude has everything
needed to pick up and keep shipping.

---

# 📋 Phase 9+ — Overnight 2026-05-23 work (autonomous session)

Erik granted full autonomy + went to bed. Following deltas SHIPPED + DEPLOYED:

### ✅ Phase 8 finalization (DEPLOYED)
- **DTF + SCP push gates LIFTED** (commit `4186bc61`) — push buttons now
  visible to all reps after Save & Get Shareable Link. Orders land in EMB
  customer 3739 until Erik creates dedicated DTF/SCP integrations.
- **Cap push** confirmed shipped via EMB pipeline (no separate work needed
  — EMB's pushToShopWorks already routes cap items via EmbellishmentType)

### ✅ Phase 9: Artwork upload (DEPLOYED, partial persistence)
- New shared `shared_components/js/artwork-upload.js` — drag-drop + multi-
  file widget. Posts to `/api/files/upload` (Caspio Artwork folder).
- Wired into DTF / SCP / EMB quote builders (commit `42f89397`).
- **DTF + SCP**: full persistence — file refs saved to
  `quote_sessions.Notes` JSON as `referenceArtwork[]`.
- **EMB**: 🚧 widget mounts and UPLOAD works (files land in Caspio), but
  URL refs are NOT persisted to the quote because EMB's Notes column is
  plain text (not JSON like DTF/SCP). **Phase 9.1 schema decision needed**:
  (a) add `ReferenceArtwork` JSON column to Quote_Sessions
  (b) convert EMB Notes to JSON (back-compat risk for existing quotes)
  (c) repurpose existing JSON column (no good candidate)

### ✅ ShipStation investigation (DOCUMENTED, no change needed)
- ShipStation is **post-fulfillment** in current architecture (post-SW
  import). Quote builders correctly do NOT push to ShipStation.
- Workflow: builder → SW push → SW sync (15-min cron) → rep clicks "Send
  to ShipStation" on quote-view OR quote-management when ready to ship.
- Button gated by `swProduced==1`. ALREADY WORKS as designed.

---

# 📋 Phase 10 — DTG feature parity audit findings (still PENDING)

Comprehensive 15-feature audit complete. Key deltas requiring Erik input or
multi-hour focused work — NOT shipped autonomously overnight.

### EMB/DTF/SCP are MISSING (DTG has these)
| # | Feature | Effort | Pickup notes |
|---|---|---|---|
| 1 | **Inventory check per row** | ~3hr/builder × 3 | Port from DTG's `OrderFormInventory` integration (`dtg-inline-form.js:256-259, 387-389`). Include `pages/order-form/inventory/inventory-check.js` + call `kickInventoryFetch()` per added product row. SanMar stock badges. |
| 2 | **Customer history pill (90-day)** | ~3hr/builder × 3 | Port from `dtg-inline-form.js:746-756` + fetch at `:2672`. Should extract to `quote-builder-utils.js` so DTG migrates too. |
| 3 | **AI chat panel** (Research Assistant) | ~2 weeks/builder | DTG uses `/api/dtg-quote-ai/chat` endpoint with method-specific tools. New endpoint per method (`/api/emb-quote-ai/chat`, etc.) + system prompt tuning per method. Multi-week effort, NOT autonomous candidate. |

### DTG is MISSING (EMB/DTF/SCP have these)
| # | Feature | Effort | Pickup notes |
|---|---|---|---|
| 4 | **Print Quote button + PDF** | ~3hr | DTG's new chat-first UI dropped Print Quote. Add `invoiceGenerator.generateInvoiceHTML()` call to DTG (legacy version exists at `dtg-quote-builder.js:3369` not wired into new UI). |
| 5 | **Email Quote button** | ~1hr | DTG missing. Wire shared `emailQuote()` from `quote-builder-utils.js`. |
| 6 | **Edit / revision (reopen existing quote)** | ~4hr | DTG missing. Add `checkForEditMode()` from `quote-builder-utils.js:791` + `loadQuoteForEditing()` pattern. State hydration is non-trivial. |

### Split-brain (consolidate)
| # | Issue | Effort | Pickup notes |
|---|---|---|---|
| 7 | **Customer context surfacing — DTG uses own implementation** | ~1hr | DTG has `renderCustomerContextBadges()` at `dtg-inline-form.js:3226` reading `Customer_Warning`/`Is_Tax_Exempt`/`Account_Tier`. EMB/DTF/SCP use shared `customer-context-banners.js`. Migrate DTG to shared helper for sync hygiene. |

### Quick wins (still NOT shipped)
| # | Feature | Effort | Pickup notes |
|---|---|---|---|
| 8 | **DTF Email Quote** confirm + wire | 1hr | Audit found NO `emailQuote` calls in DTF builder. Probably missing. Wire shared `emailQuote()` from `quote-builder-utils.js`. |
| 9 | **Phase 9.1 EMB persistence** | 1hr after schema decision | Decide schema (add column? convert Notes?), then wire EMB save to write `referenceArtwork[]`. |

### Items NOT changing
- **ShipStation integration in builders** — correctly post-fulfillment, no change needed.
- **DTG catalog browser** — method-specific (curated DTG-friendly garments). Should NOT be ported to other methods.

---

## 🧠 Updated pickup prompts (PRIORITIZED)

**Quick win (most valuable for ~1 day of work)**:
> "Phase 10.7 — migrate DTG customer-context-badges to the shared
> customer-context-banners.js helper. DTG's own implementation at
> shared_components/js/dtg-inline-form.js:3226 (renderCustomerContextBadges)
> reads the same Caspio fields. Goal: single code path for all 4 builders.
> ~1hr."

**Next phase, medium effort (~1 week)**:
> "Phase 10.1 — port DTG's inventory check pattern to EMB/DTF/SCP.
> See OrderFormInventory integration at dtg-inline-form.js:256-259, 387-389
> + pages/order-form/inventory/inventory-check.js. Per-row SanMar stock
> badges. ~3hr/builder × 3 builders."

**Then**:
> "Phase 10.2 — port DTG's customer history pill (90-day) to EMB/DTF/SCP.
> See dtg-inline-form.js:746-756 + fetch at :2672. Extract to
> quote-builder-utils.js so DTG migrates to shared code too."

**DTG gap fixes**:
> "Phase 10.4-6 — DTG is missing Print Quote, Email Quote, and Edit-reopen
> that EMB/DTF/SCP have. Add via quote-builder-utils.js wiring +
> EmbroideryInvoiceGenerator call for Print. See ROADMAP Phase 10 table."

**Strategic (multi-week)**:
> "Phase 10.3 — AI chat panel for EMB/DTF/SCP. DTG-only today, uses
> /api/dtg-quote-ai/chat endpoint with method-specific tools. New endpoint
> per method + system prompt tuning. ~2 weeks per builder. Erik input
> needed on method-specific tool design."
