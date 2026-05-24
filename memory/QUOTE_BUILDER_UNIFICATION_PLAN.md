# Quote Builder Unification — Master Plan

**Owner**: Erik · **Engineer**: Claude (Anthropic) · **Started**: 2026-05-23
**Goal**: Bring EMB / CAP / PATCH, Screen Print, DTF quote builders to the
DTG builder's quality bar (UX, code, pricing, visual identity, CRM
integration). Reps Nika & Taneisha should be able to use ANY builder with
the same confidence.

---

## Current state (measured 2026-05-23)

| Builder | HTML | builder.js | All service files | CSS | Two-col | AI chat | Inline-form widget | Card lines |
|---|---|---|---|---|---|---|---|---|
| **DTG** (gold standard) | 188L | 3,901L | **7,824L** | 7,593L | ✅ | ✅ | ✅ | ✅ |
| **EMB / CAP / PATCH** | 1,406L | 11,209L | **18,752L** | 2,695L | ✅ | ❌ | ❌ | ❌ table |
| **DTF** | 693L | 3,267L | **7,210L** | 3,665L | ✅ | ❌ | ❌ | ❌ table |
| **Screen Print** | 629L | 3,966L | **5,579L** | 3,218L | ❌ | ❌ | ❌ | ❌ table |

**Universal across all 4** (good — already shipped today):
- ✅ Zero inline scripts (CLAUDE.md rule #3 compliant)
- ✅ Use `APP_CONFIG.API.BASE_URL` (rule #6)
- ✅ Customer Warning banner + Tax Exempt chip + Account Tier badge + Phone_Best (just shipped v2026.05.23.5)
- ✅ Toast notifications + Share link generation
- ✅ Quote_Change_Log integration backend (Phase 1)

**Universal gaps** (this plan addresses):
- ❌ No tier-break optimization hints ("add 7 more pieces for $2.10/pc savings")
- ❌ No real-time inventory check per row (DTG just doesn't surface it currently, others have no integration)
- ❌ No card-per-line-item layout — all still use old `<table>` structure
- ❌ No AI Research Assistant (chat panel for pricing/customer lookup)
- ❌ Visual identity is hodgepodge — DTG uses NWCA green tokens, others use ad-hoc CSS

---

## Pacific Northwest Visual Identity (the DTG palette to standardize on)

From `art-hub.css` 2026 Design Tokens (the canonical NWCA system):

```
/* Primary palette */
--green-primary:   #2d5f3f   /* NWCA logo green — buttons, accents */
--green-dark:      #1f4128   /* deep cedar — headers, emphasis */
--green-light:     #e8f0eb   /* misty fog — backgrounds */
--surface-card:    #ffffff   /* card body */
--surface-page:    #f8faf9   /* page background — slight green tint */

/* Grayscale */
--gray-900: #0f172a  /* primary text */
--gray-600: #475569  /* secondary text */
--gray-300: #cbd5e1  /* borders */
--gray-50:  #f8fafc  /* subtle surface */

/* Semantic */
--state-warn:    #f59e0b   /* amber — warnings, cautions */
--state-warn-bg: #fef3c7
--state-error:   #dc2626   /* red — critical */
--state-error-bg:#fef2f2
--state-info:    #3b82f6   /* blue — info */
--state-info-bg: #eff6ff
--state-success: #16a34a   /* fresh moss — successes */
```

**Pacific Northwest signature**: deep cedar green + misty white + soft gray.
Avoid: bright neon greens, pure black, default Bootstrap blues.

---

## 5-Phase Rollout Plan

Each phase is **independently shippable**. We can pause/redirect after any phase.

### Phase 0 — Pricing Verification (CRITICAL · ~3 hours · zero code change)

**Why first**: Visual polish on top of wrong pricing is worse than ugly-but-correct. Confirm each builder's math before refactoring.

Build a Jest test suite that:
1. Takes the same 5 test scenarios per builder (small/medium/large qty, plus LTM edge, plus extended sizes)
2. Runs them through the live pricing engine for each builder
3. Asserts the result matches a known-correct baseline (Erik signs off on the baseline values once)

Scenarios per builder:
- **EMB**: garment-only (8K stitches LC), garment+cap (8K LC + 8K cap front), full back (15K stitches), LTM edge (7 pcs), extended sizes (2XL/3XL upcharge)
- **CAP**: cap-only (8K front), beanie (flat headwear pricing), patch
- **DTF**: 1 location, 2 locations, 3 locations (count surcharge), small + jumbo size combo
- **SCP**: 1-color 1-location, multi-color 1-location, multi-color 2-locations, dark garment (flash charge)

Output: `tests/unit/pricing/{emb,cap,dtf,scp}.test.js` — ~60 test cases total.

**Deliverable**: One single source of truth — a JSON file of expected prices that Erik approves. CI fails if any builder drifts from it.

---

### Phase 1 — Code Health Audit (1-2 days · zero functional change)

Per-builder static analysis report:

| Question | Tool / Method |
|---|---|
| Dead code paths? | unused function detector + grep for unreferenced exports |
| Duplicated logic across builders? | jscpd (copy-paste detector) |
| Hardcoded magic numbers / API URLs? | grep for `https://` strings |
| API endpoints that 404 or are deprecated? | runtime fetch trace + dependency map |
| Cyclic imports / load-order bugs? | madge dependency graph |
| Files referenced 0 times? | grep for filename across HTML |
| Variables shadowing / scope leaks? | eslint with strict rules |

**Deliverable**: One `CODE_HEALTH_REPORT.md` per builder with prioritized cleanup list. Plus a `SHARED_CANDIDATES.md` of patterns that should be extracted into shared helpers (we just did one with `customer-context-banners.js` — there's more like this).

---

### Phase 2 — Visual / CSS Unification (1 week · medium risk)

**Goal**: All 4 builders share the same look, feel, and design language.

#### 2a. Create `quote-builder-shell.css` (NEW canonical stylesheet)

Single file that defines:
- Page layout (header, two-column workspace, sticky form column, footer)
- Card primitives (`.qb-card`, `.qb-card-head`, `.qb-card-body`)
- Form primitives (`.qb-input`, `.qb-select`, `.qb-button`, `.qb-button--primary`)
- State surfaces (banners, chips, badges using the NWCA palette tokens)
- Typography (Inter font, 13/14/15/16/18/20px scale)
- Spacing (4/6/8/10/12/14/16/20/24px scale)
- Responsive breakpoints (1280px = two-col, below = stacked)

Drop legacy builder-specific CSS files in favor of this + small per-builder override files (~20-50 lines each, only for genuinely method-specific differences).

#### 2b. Apply shell to each builder

| Builder | Effort | Notes |
|---|---|---|
| EMB | High (1,406L HTML) | Most complex form fields; cap-vs-garment toggle, AL/AL-CAP picker, stitch surcharge UI |
| DTF | Medium (693L HTML) | Location-count picker, position config |
| SCP | Medium (629L HTML) | Color count picker, screen charge |

Strategy: **Don't rewrite the JS, just re-skin the HTML + CSS.** Behavior unchanged, look matches DTG.

**Risk**: Existing CSS may have specificity quirks that fight the new tokens. Mitigate by deploying one builder at a time + visual regression screenshots before/after.

---

### Phase 3 — Inline-Form Widget Pattern (2-3 weeks · biggest payoff · medium-high risk)

**Goal**: Each builder uses the same DTG-style state + render pattern.

#### Why this matters

DTG's `dtg-inline-form.js` has a clean architecture:
- Single `state` object (customer, rows, scheduling, shipping, etc.)
- `render()` rebuilds the DOM from state
- `markDirty() + scheduleStateSave()` handles autosave
- Event handlers update state, call render
- Comboboxes (style/color/company) follow the same pattern

The other 3 builders have **3,000-11,000 line monoliths** with mixed concerns (DOM, API, pricing, state) entangled. Adding a feature means hunting through 11K lines to find the right place.

#### Approach

Create `shared_components/js/quote-builder-inline-shell.js` — extract DTG's pattern (state mgmt + render lifecycle + autosave + customer combobox + style search + color picker) as a reusable widget.

Then refactor each builder to USE the shell + provide method-specific config:

```js
window.QBShell.create({
  mount:        '#embFormMount',
  method:       'EMB',
  pricingService: window.EmbroideryPricingService,
  fields: {
    // EMB-specific: stitch count, primary location, AL toggles, cap mode
    customRow: row => embRowExtraConfig(row),
    rowCols: ['stitches','location','aL','threadColor','flash'],
  },
  submit: async payload => await embSubmit(payload),
});
```

**Effort by builder**:
- EMB: ~10 days (huge form; need cap/garment/patch tabs)
- DTF: ~5 days (medium form; need per-location config)
- SCP: ~5 days (medium form; need color count + screen charge)

**Risk**: This is the biggest behavior-changing phase. Heavy testing required. Ship behind a feature flag (`?legacy=1` falls back to old form for any rep who hits a regression).

---

### Phase 4 — Feature Parity with DTG (2 weeks · medium risk)

Once shell is unified, add the missing DTG features to each builder:

| Feature | Builders needing it | Notes |
|---|---|---|
| **Tier-break optimizer** | EMB, DTF, SCP | "Add 7 more pieces, save $2.10/pc" hints — DTG already has |
| **Inventory check per row** | All 4 (DTG doesn't currently surface it well) | SanMar stock badges next to size cells |
| **NWCA-approved catalog browser** | EMB, DTF, SCP | DTG's left-column catalog. Could share `nwca-catalog.js` widget — backed by `/api/{method}/top-sellers` |
| **AI Research Assistant chat** | EMB, DTF, SCP | DTG's `✨ Ask` chat panel for pricing / customer lookup. Worth extracting as `shared_components/js/quote-builder-ai-chat.js` |
| **Customer history pill** | EMB, DTF, SCP | 90-day order summary per customer (DTG has it) |
| **Per-customer past designs** | EMB, DTF, SCP | DTG shows past designs for the picked customer — pull from `Design_Lookup_2026` |
| **New-artwork upload + Design # picker hybrid** | EMB, DTF, SCP | DTG has both — upload OR pick existing |
| **Print/PDF + Copy link + Email** action row | All 4 | Already on DTG quote-view; should be on every builder |
| **Save & share link toast** | All 4 (mostly there) | Verify consistent UX |
| **`?ENABLE_BOT_FORM_FILL` toggle** | DTG-style manual-first | DTG ships with `false` (rep-driven) |

---

### Phase 5 — Dashboard Polish + Documentation (1 week · low risk)

- Update `dashboards/staff-dashboard.html` Quote Builders section with consistent icons + descriptions
- Write a `QUOTE_BUILDERS_GUIDE.md` for reps — "When to use which" + screenshots
- Update `ACTIVE_FILES.md` (probably ~50 line cleanup as we extract shared helpers)
- Archive legacy files explicitly (`*-quote-builder-legacy.html` already exists for DTG; do same for OLD versions before each rebuild)

---

## What I'd skip (not worth the cost)

- ❌ **Rewriting EMB from scratch.** 18,752 LOC of service files = years of edge cases. Refactor incrementally, don't blank-slate.
- ❌ **Migrating to React/Vue/Svelte.** The vanilla JS pattern works; framework migration would be a 3-6 month detour with no user-visible benefit.
- ❌ **Server-side rendering.** Customer pickers + autocompletes work better client-side.
- ❌ **Breaking quote ID prefixes.** EMB / EMBC / DTG / DTF / SPC / SSC / PATCH all have downstream tooling (quote-view, dashboards, ShopWorks integration). Keep them as-is.

---

## Risk register (what could go wrong)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pricing regression — EMB cap surcharge breaks during refactor | Medium | HIGH | Phase 0 test suite catches it; CI fail blocks deploy |
| Reps confused by new UI mid-quote | Medium | Medium | Feature flag (`?legacy=1`) gives 1-week parallel run |
| Shared shell can't accommodate EMB's complexity | Medium | Medium | Start with simpler builders (DTF, SCP) to validate shell, EMB last |
| CSS specificity wars during re-skin | High | Low | Use `:where()` selectors + lower specificity; per-builder overrides explicit |
| Deploy takes a quote builder offline | Low | HIGH | Deploy off-hours; rep test before broadcast |
| Customer-context surfacing regression | Low | Medium | Already covered by today's `customer-context-banners.js` extract |

---

## Effort estimate (cumulative)

| Phase | Effort | Calendar time (with 1 deploy/day pace) | When shippable |
|---|---|---|---|
| 0. Pricing verification | 3 hr | 1 day | Same day |
| 1. Code health audit | 1-2 days | 2 days | End of week 1 |
| 2. Visual / CSS unification | 1 week | 1 week | End of week 2 |
| 3. Inline-form widget pattern | 2-3 weeks | 3 weeks | End of week 5 |
| 4. Feature parity | 2 weeks | 2 weeks | End of week 7 |
| 5. Dashboard + docs | 1 week | 1 week | End of week 8 |
| **TOTAL** | **~7-8 weeks** | **~8 weeks (2 months)** | Real production cutover |

This is a real software project — not a single-day sprint. **My honest recommendation**: ship Phase 0 + Phase 2 first (price tests + visual unification, ~10 days). That delivers visible value to Nika & Taneisha quickly. Phase 3 (the big refactor) is a multi-week commitment that should happen ONLY after Phase 0 gives us confidence the math is right.

---

## What I need from you before starting

1. **Approval of the phases** — should we go in this order, or do you want to reshuffle?
2. **Pricing baselines** (Phase 0 input) — for each of the 60-ish test scenarios, what's the "known correct" price? I can draft them from the live pricing engines and you sign off; or you can give me a spreadsheet of expected values.
3. **Feature flag preference** — `?legacy=1` query param OR a Caspio-based per-rep toggle?
4. **Calendar window** — 8 weeks of focused work, or trickled across longer with other work mixed in?
5. **Cap quote builder** — currently has NO customer search. Build one (matches the new shell) OR retire if it's not used?

---

## What I propose RIGHT NOW

Don't try to scope all 8 weeks at once. Just say "start Phase 0" and I'll:
1. Build the pricing test suite scaffolding (~1 hour)
2. Run each builder through 5 baseline scenarios + capture the live prices
3. Show you the numbers so you can approve them as the baseline
4. Lock those numbers into CI as the regression check

Then we have a safety net. Then we can refactor with confidence.

After Phase 0, we re-decide what's next based on what we learned.
