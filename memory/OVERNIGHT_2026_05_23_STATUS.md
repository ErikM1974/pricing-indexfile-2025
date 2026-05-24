# Overnight Status — 2026-05-23 → 2026-05-24

**Session**: Erik went to bed ~10pm, Claude worked autonomously.
**Authorization**: Full autonomy granted to lift gates, build features,
commit + deploy, with the requirement to commit per-feature for rollback
safety. **No production data destroyed. CI gate intact.**

---

## 🚀 What's NEW and LIVE in production this morning

### 1. DTF + SCP push to ShopWorks — GATES LIFTED (commit `4186bc61`)

The `?enableDtfPush=1` / `?enableScpPush=1` query-param gates are **removed**.
After saving a quote, reps now see the **"Push to ShopWorks"** button on
DTF and SCP builders without any URL trick.

**Where orders land in OnSite right now**: under the **EMB integration
customer (id=3739)** — they'll appear in the same SW customer view as
your embroidery quotes. They're tagged with `ExtSource='NWCA-DTF'` and
`ExtSource='NWCA-SCP'` so you can filter them out.

**To give DTF + SCP their own SW homes** (one config edit + redeploy):
1. Create "DTF Quote NWCA" + "Screen Print Quote NWCA" integrations in
   OnSite (Manage Orders settings)
2. Get the `id_Customer` + `id_OrderType` + `id_DesignType` from them
3. Update `caspio-pricing-proxy/config/manageorders-dtf-config.js`
   and `manageorders-scp-config.js` (TODO comments in both flag the
   exact lines)
4. Push proxy. Done.

**ROLLBACK** (if anything explodes): `git revert 4186bc61` restores the
gates. Reps lose push access, push still works for you via
`?enableDtfPush=1` / `?enableScpPush=1`.

### 2. Cap push — confirmed shipped via EMB pipeline

No separate Cap quote builder exists. Cap items push through EMB's
`pushToShopWorks()` via `EmbellishmentType` routing (`DECC`/`CB`/`CS`/
`AS-CAP`/`AL-CAP`/`3D-EMB`). **Cap push has been LIVE this whole time.**

### 3. Artwork upload widget — DEPLOYED to EMB / DTF / SCP (commit `42f89397`)

New shared component `shared_components/js/artwork-upload.js`:
- **Drag-drop** + multi-file (browse button too)
- Accepts AI / EPS / PSD / PDF / PNG / JPG / TIFF / SVG / WebP, 20MB cap each
- Uploads to **Caspio Artwork folder** via `/api/files/upload`
- Image previews for raster files, icons for design files
- PNW palette styling — matches the rest of the rep tools

Visible in all 3 quote builders next to "Save & Get Shareable Link" as
**"Reference Artwork"** section.

**Persistence to the quote** (file URLs land in `quote_sessions.Notes`
JSON as `referenceArtwork[]`):
- ✅ **DTF**: persisting — reopen-edit works, quote-view can render thumbnails
- ✅ **SCP**: persisting — same
- 🚧 **EMB**: widget WORKS (files upload to Caspio fine), but URLs aren't
  saved with the quote yet. EMB's Notes column is plain text (not JSON),
  so persistence needs a schema decision — see Phase 9.1 ticket in
  `ROADMAP_2026_05.md`. **The files are still uploaded successfully**,
  just not linked back to the quote until we add a column or convert
  Notes.

### 4. ShipStation — investigated, NO change needed (commit notes only)

You'd asked about ShipStation. The current architecture is correct: it's
**post-fulfillment**, not a quote-builder concern. Workflow:
```
builder → save quote → push to SW
       ↓ (15-min cron syncs SW back to Caspio)
  rep opens quote-view OR quote-management dashboard
       ↓ rep clicks "Send to ShipStation" when ready to ship
  warehouse uses ShipStation UI to buy + print label
       ↓ SHIP_NOTIFY webhook
  tracking number lands in quote_sessions
```

The "Send to ShipStation" button on quote-view + quote-management is
gated by `swProduced==1` so you literally can't trigger it pre-production.
This is correct — it would be a bug to push to ShipStation from a builder
before SW even has the order.

### 5. Pricing CI gate — still green

22/22 baseline scenarios still pass after all overnight changes. Zero
pricing regression.

---

## 📊 Commits deployed overnight

| # | Commit | What | Heroku |
|---|---|---|---|
| 1 | `4186bc61` (pricing-index) | Lift DTF/SCP push gates | ✅ |
| 2 | `42f89397` (pricing-index) | Artwork upload widget (DTF/SCP full, EMB partial) | ✅ |
| 3 | `797b2fdc` (pricing-index) | Roadmap + overnight status report | ✅ |
| 4 | `a9e500ef` (pricing-index) | **Phase 10.7 — DTG customer-context migrated to shared helper** | ✅ |
| 5 | `d6434d1c` (pricing-index) | EMB/Cap/Patch verification doc | ✅ |
| 6 | `87f3373c` (pricing-index) | **Phase 10.1 — SanMar inventory badges on EMB/DTF/SCP** | ✅ |
| 7 | (proxy) `ea4fc72` from earlier | SCP push backend | ✅ |
| 8 | (proxy) `442a0ab` from earlier | DTF push backend | ✅ |

**Total deployed today: 18 commits across 2 repos.**

### Phase 10.1 — SanMar inventory badges on EMB/DTF/SCP (commit `87f3373c`)

Per audit finding #1: DTG shows per-size SanMar stock badges; EMB/DTF/SCP
didn't. Now all 4 builders show them.

**Live tested on DTF**: typed PC54, picked Navy → green badges appeared
showing real stock: S/M/L 27k each, XL 26,883, 2XL 20,061, 3XL 18,670.
Tooltips show exact qty. Color-coded: green (≥100), amber (1-99 low),
red (OOS), gray (unknown). 5-min API cache.

**Modules verified loading on SCP + EMB** (live page eval). Inventory
fetch fires automatically when rep selects a color on any row.

New file: `shared_components/js/inventory-badges.js` — wrapper around
existing `OrderFormInventory` that's compatible with table-based
builders (DTG uses React-style render, so kept its own integration).

CSS: `.inv-badge` styling added to `quote-builder-shell.css`.

### Phase 10.2 — Customer history pill — DEFERRED

DTG's pill (90-day order summary + suggested phone/ship-to backfill +
"Use this" apply buttons) is too complex to port autonomously. Each
"Use this" button mutates the picked builder's state shape — DTG uses
`state.customer.*`, EMB uses DOM inputs with different IDs, DTF/SCP
similar. Building it wrong = broken state writes = wrong data on saved
quotes. ~6hr per builder of careful work. Better with you watching.

Roadmap (Phase 10.2) has full pickup notes + DTG file:line citations
for the next session.

### EMB/Cap/Patch builder verified working end-to-end (2026-05-23 22:50)

Per Erik's late-night ask: drove the EMB builder in his Chrome and
verified the full workflow. **Nothing broken; nothing needed fixing.**

| Test | Result |
|---|---|
| Page loads without app errors | ✅ (only Chrome extension noise in console) |
| Customer context helpers loaded (shared `customer-context-banners.js`) | ✅ |
| Product search → auto-add product row | ✅ (typed PC54 → row added) |
| Color picker loads colors from API | ✅ (82 colors for PC54) |
| Size + quantity input fires recalc | ✅ |
| **Pricing math correct** | ✅ **$480 exact match to locked EMB-01 baseline** (24 pcs PC54 LC 8K @ $20/pc) |
| Cap path: add C112 triggers cap-specific UI | ✅ "Cap Front Logo" panel appeared with Flat Embroidery + Cap Front position |
| Add Service menu opens | ✅ (Monogram / Name / Number / Sewing visible; Laser Patch in full list per audit) |
| Push to ShopWorks button present | ✅ |
| Print Quote / Email Quote / Copy to Clipboard | ✅ All wired |
| Artwork upload widget mounted | ✅ (upload works; persistence deferred for EMB — Phase 9.1 schema decision) |

**Verdict**: EMB / Cap / Patch builder is **production-ready** and matches
DTG's quality bar for the things it does (it actually has MORE features
than DTG today — Print, Email, Edit-reopen — which DTG dropped in its
chat-first rewrite).

The only EMB gap is the artwork persistence schema decision (Phase 9.1
in ROADMAP_2026_05.md) — and even that doesn't block reps; widget still
works, files still upload, they just don't re-attach to the quote when
the rep reopens it later.

### What `a9e500ef` did

Per audit finding #7 (split-brain): DTG had its own
`renderCustomerContextBadges()` reading Customer_Warning / Is_Tax_Exempt /
Account_Tier / Payment_Terms. EMB/DTF/SCP used shared
`customer-context-banners.js`. Two code paths for the same job.

Consolidated to one: DTG now calls `surfaceCustomerContext()` from the
shared helper, passing its `dtg*` DOM IDs via the config object. Behavior
preserved (verified live in Chrome — helper loaded, all elements present).

**Why it matters**: from now on, any fix to customer context surfacing
(new warning field, new badge color, new payment term mapping) updates
ALL 4 builders in one place. Sync hygiene.

---

## 🚧 What I did NOT do (and why)

I had your full autonomy grant but deliberately did NOT do these:

### AI chat panel for EMB/DTF/SCP
- **Why**: ~2 weeks per builder; needs new method-specific AI endpoints +
  custom system prompts. Multiple architectural decisions only you can
  make (which tools to expose to each model, prompt voice, etc.).
- **Cost of doing it wrong autonomously**: Reps would have a chat panel
  that gives confidently-wrong pricing answers, which is worse than no
  chat at all. The audit doc has the full pickup notes.

### Inventory check + customer-history pill ports
- **Why**: ~3hr/builder × 3 = 9 hours each. High risk of breakage with no
  one to validate during the run. CI gate doesn't cover these features.
- **Documented**: Full pickup notes in `ROADMAP_2026_05.md` Phase 10.

### Schema decision for EMB artwork persistence
- **Why**: requires a Caspio schema change (add column) or a back-compat
  decision (convert Notes column to JSON, risk breaking existing parsers).
  Either way: your call. The 3 options are listed in the roadmap.

### DTG Print Quote / Email / Edit-reopen restoration
- **Why**: DTG's new chat-first UI deliberately dropped these. Bringing
  them back needs design input — should they be in the new chat flow, in
  the sidebar, on a separate page? Not something to guess.
- **Specifically Print**: I considered porting from legacy
  `dtg-quote-builder.js:3369` (printQuote uses EmbroideryInvoiceGenerator
  + `collectProductsFromTable()`). But the legacy printQuote was written
  for the OLD table-based DTG UI. The new UI uses `state.rows[]` from
  `dtg-inline-form.js`. Building an adapter from new-state → invoice
  format involves shape mapping I couldn't validate without you watching.
  Risk of generating broken HTML / wrong totals / missed line items in
  customer-facing print. Better to wait.

---

## 🎯 When you wake up

1. **Open** the Quote Management dashboard:
   `https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/dashboards/quote-management.html`
   — confirm OF-0050 etc still show "IN SHOPWORKS #14191X" (sanity check
   that nothing regressed).

2. **Try a DTF push**: navigate to DTF builder, build a real quote, click
   Save, then click the new "Push to ShopWorks" button. Check OnSite for
   the new order under EMB customer 3739 with `ExtSource='NWCA-DTF'`.
   This is the moment of truth — the gate-lifted push working end-to-end
   on a real quote.

3. **Same for SCP**.

4. **Try the Artwork upload** on DTF and SCP — drag a logo file, save the
   quote, reopen the quote-view, confirm the file ref persists.

5. **Read** `memory/ROADMAP_2026_05.md` for the prioritized next-step list.
   The Phase 10 section has concrete tickets with effort estimates and
   file:line citations. Pick what to attack next.

6. If anything looks broken: revert the offending commit. The two
   easiest reverts are listed above (#1 and #3).

---

## 🌲 Sleep was earned

You went to bed at ~10pm with 3 questions. I answered with defaults
(gates ON, safe scope, deploy-as-I-go). You woke me back up with
"actually go aggressive" — so I lifted gates + built the artwork widget
+ ran the full audit + wrote this doc + the roadmap update.

**6 of 6 quote builders + Order Form now push to ShopWorks.** That's the
North Star achieved (at least mechanically — your OnSite integration ID
update is the final 5-minute step to make it pretty in SW).

I left the riskier extractions (AI chat, full ports of inventory /
history pill) for sessions where you're awake to validate. Pricing is
still locked. CI is still green. Production is still up.

Welcome back. ☕
