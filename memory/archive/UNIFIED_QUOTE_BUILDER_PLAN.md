# NWCA Quote Builder — Unified UX Master Plan

**Author**: Claude (Anthropic) for Erik · **Created**: 2026-05-24
**Status**: ⚡ Active strategic plan
**Supersedes**: section "Phase 10" of `ROADMAP_2026_05.md` (which becomes a tactical sub-plan under this strategy)

This is the **strategic plan** for bringing EMB/Cap/Patch, DTG, Screen Print,
and DTF quote builders to **identical user experience** with method-specific
extensions only where the underlying production process actually demands them.

---

## 🎯 Strategic Direction (from Erik 2026-05-24)

> "My goal is to have all 4 quote builders EMB/Cap/Patch, DTG, Screen Print,
> DTF to have all the same features, and if we add a feature to one we look
> at the other builders and see if we should add it there, so the user has
> the same feel and experience as all of them."

Plus the **one-way sync rule**:

> "We can only do a one-way sync ShopWorks to the quote builder. Once the
> ShopWorks order is uploaded we can't change it from our app."

These two directives shape every decision below.

---

## ✅ Strategy Validation — Is this the right call?

**Yes, unequivocally.** Here's the senior-engineer reasoning:

### Why unified UX is right (the strong arguments)

1. **Cognitive load on reps is real money**. Nika and Taneisha switch between
   3-4 builders all day. Every difference between them is a tax on speed
   and a source of errors. Eliminating differences = faster quotes,
   fewer mistakes, less training friction.

2. **Maintenance leverage**. One bug fix in `customer-context-banners.js`
   fixes 4 builders. One bug fix in DTG's custom implementation only fixed
   DTG. The shared-helper approach we've been building this week is already
   paying off — every fix benefits more surfaces.

3. **Product coherence**. NWCA's tooling should look like ONE product, not
   4 tools cobbled together over years. Visual unification (Phase 2 PNW
   palette) already proved this — reps notice + appreciate the consistency.

4. **Customer trust**. When customer-facing pages match rep tools match
   dashboards, customers feel they're dealing with a coordinated company.

### What "unified" does NOT mean (the critical caveat)

It does NOT mean "force every feature into every builder regardless of
whether it makes sense." Embroidery has stitch counts. Screen print has
color counts per location. DTF has transfer sizes. These are
**production-process-specific** and forcing them all into the same shape
would dilute each method's clarity.

The right framework is:

**🥇 Tier 1 — Mandatory parity** (must be IDENTICAL across all 4 builders):
- Customer info entry, customer search, customer context (warning/tax/tier)
- Style search + add product row
- Color picker + size inputs
- **Inventory badges per row** (SanMar stock)
- **Customer-aware design lookup**
- **Artwork upload** (with rich design-name + placements + SW linking)
- Save & Get Shareable Link
- Push to ShopWorks
- Print Quote PDF
- Email Quote
- Edit / reopen a saved quote
- Customer history pill (90-day order summary)
- Quote-view rendering with SW snapshot overlay

**🥈 Tier 2 — Method-specific extensions** (UNIQUE per method, never unified):
- EMB: stitch count, primary logo position, AL toggle, cap-mode UI
- SCP: color count picker, screen charges, dark-garment toggle, flash
- DTF: transfer location size picker, multi-location stacking
- DTG: print location (LC/FF/FB/JF/JB) + jumbo upgrades

**🥉 Tier 3 — DTG-only experiments** (proven on DTG before porting):
- AI Research Assistant chat panel (DTG only — needs method-specific tools)
- NWCA Top Sellers catalog browser (DTG only — Erik confirmed reps don't
  need it elsewhere because they know style numbers)

The **rule of thumb**: if a feature is "how do I get information about a
customer or design" or "how do I save/send/output the quote", it's Tier 1.
If a feature is "how is THIS production method configured", it's Tier 2.
If a feature is "how does this method's UX get experimented with", it's
Tier 3 and stays on DTG until proven.

---

## 📊 Current State Matrix (2026-05-24)

After this week's sprint, here's where each builder stands on every Tier 1 feature.

| Tier 1 Feature | DTG | EMB | DTF | SCP | Status |
|---|:---:|:---:|:---:|:---:|---|
| Customer info entry | ✅ | ✅ | ✅ | ✅ | Done |
| Customer search autocomplete | ✅ | ✅ | ✅ | ✅ | Done |
| Customer context (warning/tax/tier/terms) | ✅ shared | ✅ shared | ✅ shared | ✅ shared | Done (Phase 10.7) |
| Style search + add product row | ✅ | ✅ | ✅ | ✅ | Done |
| Color picker | ✅ | ✅ | ✅ | ✅ | Done |
| Size inputs | ✅ | ✅ | ✅ | ✅ | Done |
| **SanMar inventory badges per row** | ✅ own | ✅ shared | ✅ shared | ✅ shared | **Done (Phase 10.1)** |
| **Customer-aware design lookup** | ✅ own | ✅ modal+gallery (own) | ✅ combobox (shared) | ✅ combobox (shared) | **Done (Phase 11.1)** |
| **Artwork upload** | ✅ rich (own) | ✅ minimal (shared) | ✅ minimal (shared) | ✅ minimal (shared) | Partial — Phase 11.3 ports DTG's rich version |
| Save & Get Shareable Link | ✅ | ✅ | ✅ | ✅ | Done |
| Push to ShopWorks | ✅ | ✅ | ✅ | ✅ | Done (Phase 8) |
| **Print Quote PDF** | ❌ | ✅ | ✅ | ✅ | Gap on DTG (Phase 11.4) |
| **Email Quote** | "Copy email" via chat | ✅ | ✅ | ✅ | DTG diverges (Phase 11.5) |
| **Edit / reopen saved quote** | ❌ | ✅ | ✅ | ✅ | Gap on DTG (Phase 11.6) |
| **Customer history pill (90d)** | ✅ rich w/ apply-buttons | ❌ | ❌ | ❌ | Gap on 3 (Phase 11.7) |
| Quote-view rendering | ✅ | ✅ | ✅ | ✅ | Done |
| SW snapshot overlay | ✅ | ✅ | ✅ | ✅ | Done (OF-0050 fix) |
| Quote_Change_Log audit trail | ✅ | ✅ | ✅ | ✅ | Done |

**Where we stand**: 14 of 17 Tier 1 features at parity. 3 gaps left:
- DTG missing Print/Email/Edit (audit found this is because DTG's chat-first UI dropped them — needs adapter for new state shape)
- EMB/DTF/SCP missing customer history pill (DTG-only today)

Plus the **artwork upload upgrade** (Phase 11.3) — current shared widget is "minimal" not "rich".

---

## 🚀 Prioritized Next Phases (in ROI order)

### Phase 11.3 — Rich artwork upload across EMB/DTF/SCP ⭐ **HIGHEST ROI**

**What**: Port DTG's full artwork upload pattern. Adds to the existing
shared `artwork-upload.js`:
- Design name input (required when files uploaded — "e.g. Star Sportswear
  front logo 2026")
- Placement picker per file (Left Chest, Full Front, Full Back, etc.)
- Auto-creates SW design record on push — uploaded files flow into
  `Designs[]` payload with placement + metadata + image refs

**Why**: This is the "no double-entry in SW" win that started Phase 8.
Today rep uploads → file lands in Caspio → SW operator manually re-creates
the design + name + placement. With this, SW auto-creates the design from
the push payload. Saves operator 5-10 min per order.

**Effort**: 6-8 hr (3 hr to extend `artwork-upload.js` API, 1 hr per builder
to wire, 2-3 hr to extend push transformers + test).

**Risk**: Medium — touches push payload structure. CI gate catches pricing
regression but not push payload regression. Mitigate with the preview
endpoint (`/api/dtf-push/preview/:quoteId`) before going live.

---

### Phase 11.4 — DTG Print Quote button restoration

**What**: Add Print Quote button to DTG that calls
`EmbroideryInvoiceGenerator.generateInvoiceHTML()` (proven across the
other 3 builders).

**Why**: DTG's chat-first UI dropped this. Reps using DTG today have to
copy quote details to clipboard then paste into Word to PDF. Other 3
builders have it. Parity.

**Effort**: 3-4 hr. The complication is adapting DTG's `state.rows[]`
shape to the format `EmbroideryInvoiceGenerator` expects. DTF has an
adapter at `buildPricingDataForInvoice()` we can mirror.

**Risk**: Low. Read-only feature — generates HTML, opens print window.
Can't break a saved quote.

---

### Phase 11.5 — DTG Email Quote parity

**What**: DTG today has "Copy email" in the AI chat. Other 3 have a real
"Email Quote" button that sends a pre-formatted email via EmailJS.

**Why**: Cognitive load — rep on DTG vs rep on EMB does different things
to email a quote. Parity.

**Effort**: 1-2 hr. Lift `embEmailQuote()` from EMB, swap the EmailJS
template ID for DTG-specific one, wire to button.

**Risk**: Low. Email send is async + rep sees confirmation.

---

### Phase 11.6 — DTG Edit-reopen for revisions

**What**: All 3 other builders let rep open `/quote-builder?editQuoteId=X`
to load + revise an existing quote (creates a new revision, doesn't
overwrite). DTG missing this.

**Why**: Repeat customers ask for "tweak my last quote, change qty to 50".
Today DTG reps start from scratch. Other builders handle it.

**Effort**: 4-6 hr. DTG's `state.rows[]` hydration from a saved quote is
non-trivial because the state shape differs from how it gets saved.
Audit found `checkForEditMode()` pattern in `quote-builder-utils.js:791`
to mirror.

**Risk**: Medium. State hydration bugs would silently load wrong data
into the form. Mitigate with a unit test that round-trips
save→hydrate→state-equality-check.

---

### Phase 11.7 — Customer history pill for EMB/DTF/SCP

**What**: Port DTG's 90-day order summary pill. Phased rollout:
- **11.7a (read-only)**: Just shows "5 orders on file · last 14 days ago"
  + top items + last design used. No apply buttons. Low risk.
- **11.7b (interactive)**: Add "Use this" buttons that apply suggested
  phone/ship-to/design to the current quote. Each builder needs its own
  apply logic (different state shape). Higher risk.

**Why**: Trust signal for the rep — "I'm quoting the right thing because
the system shows me this customer's pattern". Build rapport with customer
("we know you usually want Net 10 + USPS Priority").

**Effort**: 11.7a = ~2 hr per builder, total 6 hr. 11.7b = +4 hr per
builder, total +12 hr.

**Risk**: 11.7a low (read-only). 11.7b medium (state mutation per builder).

---

### Phase 12 — Unified design lookup pattern across all 4 builders

**What**: Erik's screenshots show EMB has both a magnifying glass (exact
lookup) and a database icon (modal+gallery). DTF/SCP have my new
combobox. DTG has its own combobox.

**Goal**: ONE pattern across all 4. My recommendation:
- **Combobox in the Design # field as primary** (fastest for reps who know
  the number — type partial → instant matches)
- **"Browse all" link** that opens the modal+gallery (for reps wanting
  to see thumbnails before picking)
- Drop the standalone magnifying glass (combobox does its job better)

**Effort**: ~6 hr. Add combobox to EMB (it has the modal already — combobox
becomes the primary entry, modal becomes "Browse all" link). Migrate DTG
to use the shared combobox too (it has its own implementation today).

**Risk**: Low (additive on EMB). Medium on DTG (refactor of existing
inline implementation — need behavior parity test).

---

### Phase 13 — One-way SW → app sync improvements (Erik's directive)

**What**: With one-way sync confirmed, double down on making the
SW-as-source-of-truth experience EXCELLENT on the quote-view side.
Already-shipped baseline: snapshot overlay, change banner, $0 warning,
WO# display, Quote_Change_Log audit trail.

**Ship next**:
1. **Auto-refresh quote-view** — currently rep clicks Refresh. Add a
   30-second polling loop so the page updates if SW changed something
   while the rep is looking. Only polls when tab visible (battery-friendly).
2. **Diff visualizer** — when SW shows a different price than the original
   quote, render side-by-side: "Quote: $30.50/pc · SW: $31.00/pc · +$0.50".
   Today we just show the SW value, losing the comparison context.
3. **"Acknowledge changes" button** — after the rep reviews SW edits via
   the change banner, click to dismiss + log that they've seen it.
   Quote_Change_Log gets an `Acknowledged_At` + `Acknowledged_By`.
4. **Slack DM on SW change** — when a sales rep's pushed quote gets edited
   in SW (price, ship date, line item), Slack-DM them with the diff. They
   don't have to discover the change by re-opening the quote.

**Effort**: ~1 week total for all 4 sub-features.

**Risk**: Low (read-only display improvements + one notification flow).

---

### Phase 14 — New feature: Reorder previous quote

**What**: Customer comes back. Rep finds last quote in dashboard. Click
"Reorder" button → fresh new quote pre-loaded with all prior settings
(style, color, sizes, design, location, customer info). New quote ID,
new revision counter.

**Why**: Massive time saver for repeat customers. Today rep manually
re-builds the same quote.

**Effort**: ~2 days (same logic as Edit-reopen but creates new quote
instead of editing existing).

**Risk**: Low. Pre-populates a NEW quote, doesn't touch the original.

---

### Phase 15 — New feature: Customer Approval Link

**What**: Rep saves quote → gets a shareable URL → sends to customer →
customer opens link, sees friendly quote view → clicks **"Approve"** button
→ quote status flips to `Approved` → rep gets Slack notification +
quote-view shows the approval timestamp.

Why this matters: today reps wait for customer to reply by email "yes
go ahead" → rep manually marks it approved. This automates the loop.

**Effort**: ~1 week. Add `Approved_At` + `Approved_By` columns to
`quote_sessions` (Erik does this in Caspio in 60 seconds). Build the
customer-facing approval view. Slack hook.

**Risk**: Medium — customer-facing feature. Need to handle edge cases
(quote expired, already pushed to SW, already approved by someone else).

---

### Phase 16 — New feature: Quote Activity Timeline

**What**: On quote-view, show a single timeline of every event in this
quote's life: Created → Saved → Edited (Rev 2) → Pushed to SW → SW
operator edited line 3 → ShipStation triggered → Shipped.

Why: Today reps piece this together from multiple places (Quote_Change_Log,
ShopWorks_Snapshot, ShipStation tracking). One unified view = faster
diagnosis when customer asks "where's my order?"

**Effort**: ~1 week.

**Risk**: Low — read-only aggregation of existing data.

---

## 🏗 Architectural Rules (enforce these on every PR)

To make the unification stick, codify these as commit-time guardrails:

### Rule 1 — Tier 1 features MUST use shared modules

When you build a Tier 1 feature, build it as a shared module in
`shared_components/js/` first, then wire each builder to USE it. Never
copy-paste implementations between builders.

✅ Good: `customer-context-banners.js` (1 file, 4 builders use it)
❌ Bad: each builder has its own `renderCustomerContextBadges()` function

### Rule 2 — Method-specific code stays in the builder's own file

EMB's stitch count logic, SCP's color count picker — DON'T extract these
to shared modules. They're inherently method-specific. Sharing them would
create confusion ("why does the SCP builder reference embroidery code?").

### Rule 3 — Every shared module has a stable public API

Document inputs + outputs in JSDoc. When upgrading the API, version it
(e.g., `ArtworkUpload.attach()` v1 vs v2). Builders pin to a version.

### Rule 4 — One-way sync is sacred

The app NEVER writes back to a ShopWorks order that's already been pushed.
SW is the source of truth post-push. The app READS the SW snapshot,
displays it, alerts on changes, but does not modify it.

Exception: the `PushedToShopWorks` timestamp + `ShopWorks_Order_Number`
column on `quote_sessions` — these are written by the push handler itself
to record what we did. They're metadata about our app, not edits to SW.

### Rule 5 — CI gate before deploy

`npm run test:pricing-baselines` must pass before any commit that touches
pricing services or builder logic. Already enforced.

### Rule 6 — Document the parity decision

Every new feature added to one builder must trigger a 1-sentence
documentation note: "Added to EMB. Also planned for DTF/SCP in Phase X.
DTG already has it because Y." Adds to `ROADMAP_2026_05.md` Phase 10+ tables.

---

## 🔧 Process / Operational Changes

### Add `BUILDER_PARITY.md` — the source of truth for "do all 4 have X?"

Single matrix doc, updated on every PR that touches a builder. Forces
the discipline: when you ship a feature, you can't pretend the parity
gap doesn't exist — it shows up as a red X in the matrix.

### Per-builder smoke test in CI

Extend `tests/pricing-baselines/` with a Puppeteer smoke test that:
1. Loads each builder page
2. Verifies critical buttons exist (Push, Print, Email, Save)
3. Verifies critical scripts loaded (ArtworkUpload, InventoryBadges,
   CustomerContextBanners, CustomerDesignCombobox)
4. Verifies customer context elements present
5. Verifies design # input + customer-number input exist

~2 min total. Catches "I forgot to wire X into EMB" within 1 commit.

### Shared component library page (engineer-facing, not rep-facing)

Build a single dev-only page at `/dev/component-library.html` showing
every shared component with sample data + usage examples. Engineers
visit it before building a new feature to see what's already available.
Reduces "I built X again because I didn't know it existed" waste.

### Naming convention for shared modules

All shared quote-builder modules should live at
`shared_components/js/qb-<feature>.js` (with `qb-` prefix for grep-ability).
Current ones (artwork-upload, customer-context-banners, inventory-badges,
customer-design-combobox) should eventually rename to this convention.
Low priority — cosmetic.

---

## 📅 Recommended Sequencing

Given Erik's stated goal (parity ASAP), the highest-ROI sequence:

**This week / next session**:
- ✅ DONE today: Phase 11.1 design lookup (DTF + SCP)
- 🎯 **Next: Phase 11.3 rich artwork upload** (port DTG's pattern to EMB/DTF/SCP — biggest single win)
- Then: Phase 11.4 DTG Print Quote (close the DTG gap)

**Week 2**:
- Phase 11.5 DTG Email Quote
- Phase 11.6 DTG Edit-reopen
- Phase 12 unified design lookup (add combobox to EMB + migrate DTG)

**Week 3**:
- Phase 11.7a customer history pill (read-only on EMB/DTF/SCP)
- Phase 13 one-way sync improvements (auto-refresh, diff viz, ack button)

**Week 4**:
- Phase 14 Reorder previous quote
- Phase 11.7b customer history pill apply-buttons

**Week 5+ (bigger features)**:
- Phase 15 Customer Approval Link
- Phase 16 Quote Activity Timeline

After Week 4, all 4 builders are at full parity on Tier 1 features. Weeks
5+ are new capabilities that didn't exist on any builder before.

---

## 🚦 What to NOT do

Things I considered and decided against, with reasoning:

1. **DON'T port AI chat to EMB/DTF/SCP**. Multi-week per builder, needs
   method-specific tools and prompts, easy to make confidently-wrong.
   Keep on DTG until prompts are mature. Re-evaluate Q3 2026.

2. **DON'T port DTG's catalog browser**. Erik confirmed reps know style
   numbers. Catalog browser is for novice / self-serve users. Method-
   agnostic. Keep DTG-only.

3. **DON'T rewrite EMB's design lookup modal**. It works. Add the combobox
   in front of it (combobox = quick, modal = browse). Two complementary
   tools.

4. **DON'T add 2-way SW sync** — Erik's directive is clear. SW is the
   source of truth post-push. Building bi-directional sync would be a
   major architectural undertaking that creates rep confusion ("did I
   change SW or did SW change?") and undermines the SW-is-truth model.

5. **DON'T unify CSS to the point of removing method differentiation**.
   The PNW palette + shared shell.css are right. But each builder's
   method-specific UI sections should keep their distinct visual hierarchy
   (EMB's "Primary Logo" + "Cap Front Logo" stacks, DTF's transfer-size
   matrix, SCP's color count grid). These signal "you're doing X method"
   to the rep.

---

## 🧠 Pickup prompts (for fresh sessions)

If starting a new conversation, paste one of these:

**Top priority**:
> "Phase 11.3 — port DTG's rich artwork upload (design name + placements
> + SW Designs[] auto-create) to EMB/DTF/SCP. Extend the existing
> shared_components/js/artwork-upload.js. See UNIFIED_QUOTE_BUILDER_PLAN.md
> Phase 11.3."

**DTG gap closure**:
> "Phase 11.4-11.6 — DTG missing Print Quote / Email Quote / Edit-reopen
> that EMB/DTF/SCP have. Restore by adapting state.rows shape to the
> EmbroideryInvoiceGenerator / emailQuote / checkForEditMode patterns.
> See UNIFIED_QUOTE_BUILDER_PLAN.md."

**One-way sync polish**:
> "Phase 13 — quote-view improvements: 30-sec auto-refresh polling,
> price-diff side-by-side visualizer, 'Acknowledge changes' button on
> the change banner, Slack DM to rep on SW edit. See UNIFIED_QUOTE_BUILDER_PLAN.md
> Phase 13."

**Big strategic feature**:
> "Phase 15 — Customer Approval Link. Rep saves quote → URL → customer
> opens → clicks Approve → status flips + Slack notify. Needs new
> Approved_At/Approved_By columns in quote_sessions. See
> UNIFIED_QUOTE_BUILDER_PLAN.md Phase 15."

---

## ✋ What needs Erik input before next moves

1. **EMB artwork persistence schema** (Phase 9.1): plain-text Notes column
   needs decision — add JSON column / convert Notes / repurpose ImportNotes?
   30 seconds in Caspio admin once decision made.

2. **DTF/SCP dedicated SW integrations**: today they reuse EMB integration
   customer (id=3739). Erik needs to create dedicated integrations in
   OnSite when convenient. Update `caspio-pricing-proxy/config/manageorders-
   {dtf,scp}-config.js` with the new IDs. 5-min ship.

3. **EmailJS template IDs** for DTG email quote (Phase 11.5) — does DTG
   want its own template or share EMB's?

4. **Approval link UX** (Phase 15) — what does the customer-facing approval
   page look like? Same as quote-view but simplified? New page entirely?
   Design call.

---

**Last words**: Erik's directive is the right strategy. The execution path
is clear. The infrastructure we shipped this week (shared shell, customer
context helper, artwork upload base, inventory badges, design combobox,
SW push for all builders, CI gate) is the foundation that makes unifying
cheap from here. Every new Tier 1 feature now costs 1 build + 4 wirings,
not 4 builds.
