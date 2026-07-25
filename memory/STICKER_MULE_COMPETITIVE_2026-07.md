# Sticker Mule competitive analysis + public sticker page plan (2026-07-24)

Prompted by Erik: *"Our customers find Sticker Mule much easier to use than our website."*
Full build plan: `~/.claude/plans/i-need-you-to-fuzzy-mitten.md` (11-agent workflow, 3 critique passes).

## 🔑 The headline: our sheet is Sticker Mule × ~1.76

41 of 50 cells sit in a **1.72–1.77** band. Too consistent to be coincidence — our `Sticker_Pricing`
grid looks derived from theirs with a ~76% markup.

| Qty 1,000 | 2×2 | 3×3 | 4×4 | 5×5 | 6×6 |
|---|---|---|---|---|---|
| NWCA / SM / ratio | 408/232/1.76 | 656/372/1.76 | 962/546/1.76 | 1322/750/1.76 | 1740/983/1.77 |

- **Our six best cells (< 1.60×)** — all 2×2/3×3 at ≤500 pieces, all a **$26–$82** absolute gap:
  `3x3@100` (1.32) · `3x3@50` (1.36) · `2x2@100` (1.43) · `2x2@50` (1.45) · `2x2@200` (1.47) · `2x2@500` (1.54).
  These are the deep-link / ad targets and the page default.
- **Our worst: 6×6 @ 100–500 = 1.95–2.05×** — the only cells outside the sheet's own band, a side
  effect of the 2026-05-29 monotonicity repair (`STK-6X6-100` raised $286→$383, `sticker-pricing.js:65`).
- We can't win 1,000×4×4 (+$416) or 5,000×5×5 (+$2,031). Don't design for a volume shootout.

## 🎯 A constant multiplier preserves ratios — so our savings % ladder equals theirs

Terminal savings **88/81/81/76/72** vs SM's **90/85/81/76/71** — we tie at 4×4/5×5, beat them at 6×6.
**The 1.76× markup is structurally invisible inside a savings-% column** because it's a ratio within
our own sheet. Highest-leverage merchandising device available, costs zero rate change.
Suppress badges < 20% (kills 6×6@100's "Save 12%"). 3×3@200 reads 40% right after 37% — a real cliff
(per-unit falls only 5.6%; the marginal 100 pieces cost **$1.10 each**, more than the first hundred).

## Structural gaps (SM → us)

Min size 1×1 $51/50 → **our floor is 2×2**, a 1×1 rounds up to $87 · min qty **10 ($17) + 10-for-$9
samples** → our min is 50 · native rectangles → we round to the bounding square · **4-day free
shipping + free art setup** → 10–12 days *from artwork approval* + $50 GRT-50.
$50 setup turns our best cell (3×3@100, 1.32×) into our worst first impression (**1.85×**); it is
**51% of a 3×3@50 order**.

**Where we win: SM sells no banners at all** (every banner URL 404s) and no oversize decals.
Plus local Milton production/pickup, named rep, ORAJET 3651 / UL 969, apparel on the same invoice.

## SM's UX, in one line each (what to copy)

Zero clicks to a price — it renders on load · **two inputs only** (size radios + quantity ladder), no
material/finish/upload · whole 10-tier ladder visible with per-unit + savings %, **one call re-prices
all rows** · config in the query string (deep-linkable, pre-priced) · upload comes **after** the price
and is skippable · **the "Size help" modal that makes the quote explicitly provisional** is what
licenses a 2-input configurator on a variable product — ours is more credible (a named human confirms
on the proof, vs their automated re-price).

## 🔴 Live P0 found while researching (pre-existing, not caused by this)

`/api/contract-sticker-ai/chat` is mounted **public with no auth** (`proxy server.js:1129`; the
limiter's own comment says *"unauthenticated … true protection is auth — TODO"*). Its
`lookup_customer` `shape()` (`contract-sticker-ai.js:209-229`) returns company, customer number,
contact, email, phone, street address, rep, **payment terms**, last-ordered — 5 matches for any
2-char query. Upstream `/api/company-contacts/search` is mounted bare (`:1193`). And
`/pricing/stickers` + the `/calculators` static mount have **no `requireStaff`** — noindex is not
access control. Same shape flows through 5 sibling AI bots → spawned as its own task.

## Gotchas verified this session (carry forward)

- **26 of 50 rows: `PricePerSticker × Quantity ≠ TotalPrice`.** Worst `STK-4X4-10000` publishes $0.58
  → $5,800 vs a real **$5,846**. Always derive `TotalPrice/Quantity`; never render the stored field.
- **The 6″ boundary INVERTS**: at qty 100, `6×6 = $383` on the grid but `6.5×6.5 = $352` on the sq-ft
  decal ladder. Every square 6.01″–6.77″ prices below the 6×6 row. Never co-render the two ladders.
- **`sticker-pricing-page.css` is loaded by 5 files, 2 of them quote builders** (Rule 8) and its
  `:root` collides with `nwca-2026-core.css` on `--paper`/`--ink`. Same trap in
  `pages/forms/nwca-form-shared.css` (bare `body` rule repaints the whole page). Never load either
  on a Family-A page.
- **Three page shells exist**, not one: A `nwca-2026-core.css` (the only one with real site nav) ·
  B golf/SEO-landing · C self-contained storefront (custom-tees/caps/3-day-tees). New public pages → A.
- **`nav-item--p2` is hidden at EVERY viewport when the quote badge shows** (`nwca-2026-core.css:246`).
- **`quote-management.js:1238-1263` routes any unrecognised prefix to the embroidery builder** — `STK`
  has zero hits there, so Edit on a sticker quote opens the EMB builder today.
- **`STK` is missing from CLAUDE.md's quote-prefix list** though `sticker-pricing-page.js:29` mints it.
- A `robots.txt` `Disallow` would **break** a `noindex` (Google can't fetch the page to see it) — use
  an `X-Robots-Tag` response header instead.

## Erik's decisions so far

Fully public + SEO · Continue → upload art → quote to a rep (not Stripe) · $50 setup as a separate
line, waived on reorder — **refined to: ask rather than charge** (default unanswered, two of three
answers are $0, so the customer discovers a waiver; headline stays $124 not $174).

**Q1 ANSWERED 2026-07-24 — vector art does NOT waive the $50.** Charge GRT-50 on every new design
even when the customer sends print-ready vector; the only $0 case is a reorder of a design already
on file. The AI prompt had been publishing a waiver the shop doesn't honor — removed. Also removed:
every outdoor-lifespan claim (the prompt said both 5 and 3 years; Erik wants no lifespan quoted at
all, and no vinyl spec dump).

**🔒 The two-field gate on `/custom-stickers` STAYS — Erik's call 2026-07-25. Do not "reduce
friction" by removing it.** The price is already zero-field (ladder renders on load, Copy link
copies a `?size=&qty=` URL that IS the quote). Name + email are required only behind *Get this in
writing* (`pages/js/custom-stickers.js:468`), which mints a real STK and routes it to an AE.
**Rationale: the gate is the product, not friction** — our model is a named human confirming the
price before anything prints, and a cart with no name has nobody to send the proof to. SM can skip
it because they're genuinely self-serve; we aren't, by choice. If it's ever revisited, the cheap
version is a third takeaway button ("Text me this price", one field, contact blank for a rep) — but
only with real bounce evidence at that panel first.

**Still open** — shipping wording (§3) and priced JSON-LD (§6, default no). Both cosmetic.
