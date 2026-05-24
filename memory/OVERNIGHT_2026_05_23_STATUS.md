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
| 3 | (proxy) `ea4fc72` was already shipped earlier | SCP push backend | ✅ |
| 4 | (proxy) `442a0ab` was already shipped earlier | DTF push backend | ✅ |
| 5 | Plus the 12 earlier today commits (CI gate, PNW visual, SCP margin) | — | ✅ |

**Total deployed today: 14 commits across 2 repos.**

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
