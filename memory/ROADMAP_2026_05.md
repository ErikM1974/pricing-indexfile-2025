# NWCA Pricing System — Master Roadmap (post 2026-05-23)

**Author**: Claude (Anthropic) for Erik · **Last updated**: 2026-05-23 evening
**Status**: ⚡ Active — pick up at "What's next" section

This is the **current** master plan after today's big session.
Supersedes `QUOTE_BUILDER_UNIFICATION_PLAN.md` (kept for historical context).

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

## 🗺 Recommended sequencing

```
Week 1 (next session candidates):
  Day 1: Phase 0b.1.5 EMB runner (1-2hr) + Dashboard polish remaining (2hr)
  Day 2: Phase 6 pricing model proposals (research + Erik decision)
  Day 3-5: Phase 1 code health audit

Week 2-5:
  Phase 3 inline-form refactor — SCP first as proof, then DTF, then EMB

Week 6-7:
  Phase 4 feature parity rollout

Week 8:
  Phase 5 dashboard polish + docs

Throughout: Phase 7 pricing UX changes whenever Erik approves them
```

**Honest take**: Phases 3-5 are the original 8-week plan. We did Phase 0+2 in 1 day, so we're ahead. Phase 3 is the only multi-week piece.

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

**Big refactor (Priority 3)**:
> "Phase 3 inline-form refactor — start with SCP. Extract DTG's state→render
> pattern from dtg-inline-form.js into a shared quote-builder-inline-shell.js,
> then refactor SCP to use it. Ship behind ?legacy=1 flag. CI gate is safety
> net. See ROADMAP_2026_05.md."

---

**Last words**: We're in a great spot. Visual + CI infrastructure done. Pricing model proven malleable (SCP lift). 22 baselines locked. Future Claude has everything needed to pick up and keep shipping.
