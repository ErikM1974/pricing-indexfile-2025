# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## Five prices for one ShopWorks part — and a $50 fee hidden behind a misspelled column (2026-08-15)

**Problem.** Full-back embroidery had **five** price sources across **three** Caspio tables, so what
a customer paid depended on *which screen the rep used*, not on the job. At 25K stitches / 12 pcs:
the staff reference page said **$25.00/pc**, the quote builder charged **$31.25**, and the retail
rows nobody read said **$35.00**. The page was even titled "Full Back Embroidery — **DECG-FB**"
while rendering **CTR-FB contract/wholesale** numbers, and its own banner claimed "same rate
applies whether wholesale, NWCA-supplied, or customer-supplied" — false in code, three ways.
Full-back LTM was simultaneously **$50** (reference page), **$100** (contract calculator) and
**$0** (quote builder). **No test anywhere pinned any of it.**

**Root cause.** Each surface was built at a different time and read whichever endpoint it already
had open. Nobody ever asked "how many ItemTypes does one ShopWorks part need?" — the answer was
always one: OnSite has exactly one full-back part, `DECG-FB`, and `FEE_PN_ALIASES` already mapped
`FB → DECG-FB`. The *part* was unified years ago; only the *pricing* forked.

**Solution.** One ladder — `Embroidery_Costs` where `ItemType='DECG-FB'` — read once by a shared
`getFullBackLadder()` and served into all three endpoints' `.fullBack` blocks under their existing
key names. `CTR-FB` and `FB` rows retired. Erik's ruling: one rate for everyone, contract included.

**Prevention.**
- 🔑 **One ShopWorks part should mean one price ladder.** When a part number is universal but the
  price isn't, that asymmetry IS the bug. Use `KNOWN_FEE_PNS` / `FEE_PN_ALIASES` as the map of what
  ought to be unified.
- 🔴 **`LTM`, not `LTM_Fee`.** `Embroidery_Costs` has no `LTM_Fee` column. Reading it returned
  `undefined`, so the fee silently became `0` — and the $50 the DECG garment/cap paths *appeared*
  to charge came from a hardcoded default that happened to match. **Editing that fee in Caspio did
  nothing, on already-shipped pricing.** A fallback that matches the real value hides a dead read
  indefinitely; verify against the raw row, not against the rendered number.
- 🔴 **`PerThousandRate` is NULL on the DECG-FB rows — the rate is in `EmbroideryCost`.** The
  contract path *prefers* `PerThousandRate`, so a shared helper that inherited that preference
  would have priced every full back at **$0**. When consolidating readers, check the columns are
  actually populated on the rows you're consolidating *onto*.
- 🔴 **A cached object handed out by reference gets decorated by its callers.** Each endpoint added
  its own back-compat key (`perThousandRates` / `ratePerThousand`) to the shared ladder, which
  leaked into every other response through the cache. Return a copy from any cached-price getter.
- 🔑 **"Min charge $20" was a hardcoded `|| 20.00` in four files, presented to staff as policy.**
  No Caspio column ever fed it. It was also inert — the cheapest cell equalled it exactly. Deleted
  rather than wired up: under the new ladder the cheapest full back is $30, so it could never fire.
  **Before building a knob, check whether it can ever move.**
- ⚠️ **Dead renderers keep myths alive.** Three full-back matrix builders (127 lines) had lost their
  target divs and rendered nothing — but one carried the comment *"DECG Full Back uses same pricing
  (DECG-FB)"*, which is where the whole misconception came from. Delete dead code or it keeps
  teaching.
- 🔑 **A per-design negotiated price is an override, not drift** — keep it, but LABEL it, or the
  line just looks like the published table is wrong and the rep can't explain the number.

## A dashboard promised cost-plus pricing the builder could not read (2026-08-14)

**Problem.** The staff Product Manager has offered **"Automatic (cost ÷ margin + logo — same as
SanMar)"** since 2026-07-06 (`PricingMethod: 'Margin'`, `DefaultSellPrice: 0`). A product created
that way **could not be quoted at all**: `populateNonSanmarRow()` did
`row.dataset.sellPrice = product.DefaultSellPrice || 0` → the string `'0'` → a ⚠ $0.00 price cell
→ the save gate refused the quote. The rep saw a zero and no explanation. Reps were instead
hand-computing a decorated price for every S&S Activewear garment (~5% of orders), so the margin,
tier, embroidery cost, size upcharges and LTM were all bypassed and nobody could see whether the
number was right.

**Root cause.** Two halves of one feature were built a month apart against no shared contract.
The dashboard wrote a *mode*; the builder only ever read a *price*. `PricingMethod` had also
drifted to **three spellings** in live data — `'FIXED'` (builder modal + proxy seed),
`'FixedPrice'` and `'Margin'` (dashboard) — with older rows blank, so there was no single value a
naïve reader could test for.

**Solution.** `resolveNonSanmarPricingMode()` in `quote-builder-utils.js` reads all three
spellings tolerantly (and infers from whichever of cost/sell is > 0 when blank); writers now emit
only the canonical two. The price itself comes from `buildSyntheticSizePricing()`
(`embroidery-quote-pricing.js`), which builds a **`/api/size-pricing`-shaped payload** from the
rep's blank cost — because that endpoint never returned prices, only SanMar's raw `CASE_PRICE`
plus the upcharge ladder. The formula is untouched; only its input differs.

**Prevention.**
- 🔑 **`/api/size-pricing` returns COST, not price.** The engine does
  `cost / marginDenominator + embCost → round → + upcharge`. Feed it a synthesized payload and a
  non-SanMar garment prices identically to a SanMar one — **one new input shape, no 4th pricing
  path** (Rule 9). `tests/unit/emb-nonsanmar-costplus.test.js` asserts *byte-identical* lineItems
  between the two; point reviewers there rather than re-arguing it.
- 🔴 **Do NOT seed `sizePricingCache` to do this.** It is keyed by bare style, **never cleared**,
  and shared with `getProductSizePrices()` — a seeded entry is a permanent page-lifetime shadow
  over a real SanMar style, and vendor styles demonstrably drift into SanMar
  (`non-sanmar-products.js` documents six that had to be deleted for exactly that). Passing the
  cost on the product object has no shared state, so there is nothing to invalidate.
- 🔑 **Anchor sizes are load-bearing, not clutter.** The garment path computes upcharges
  *relative* to its chosen base size; the cap path adds them *absolutely*. Injecting S/M/L/XL
  (garments) / OSFA (caps) pins the base to a zero-upcharge size so relative ≡ absolute and
  neither path needs a branch. They never emit a line (the loop iterates `sizeBreakdown`, not
  `basePrices`) — delete them and a 2XL/3XL-only order silently loses its upcharge.
- 🔴 **`quote_items.SizeBreakdown` is an ALLOWLIST, not a bag.** `buildProductLines()` filters a
  short list of known metadata keys and treats **every other key as a SIZE** — a stray `vendor`
  key would ship a LinesOE line with `Size:"SSA"`, `Qty:"SSA"` and a real Price. Per-item
  metadata goes in `LogoSpecs` (already JSON, 60 KB `LONG_FIELDS`). `heavyweight` was already
  being written and was NOT in that filter; it survived only because customer-supplied items route
  to `buildServiceLine()`. Added it to the list — one refactor and it would have been a live bug.
- 🔴 **`saveQuote()` and `updateQuote()` are byte-identical duplicates.** Patch one and every
  *revision* silently drops the new field, while reload masks it by re-reading Caspio. Both, always.
- 🔑 **A search-result cache can defeat a source guard.** `showSearchSuggestions()` wrote every
  autocomplete hit into `embState.productCache`, which `_lookupStyleProduct()` checks **before**
  the API — so a cached vendor row would have sailed past the `source: 'non-sanmar'` check. Fixing
  the API alone was not enough.
- ⚠️ **Making a style findable can break the path that handled it.** Once `/api/stylesearch`
  returned vendor styles, `_lookupStyleProduct()` started *succeeding*, sending the row down the
  SanMar branch (`/api/product-colors` → empty) and never reaching `populateNonSanmarRow()`. The
  proxy and builder changes must ship as ONE unit.
- 🔑 **A free-text code column plus an exact-match filter is a reporting trap.**
  `GET /api/non-sanmar-products?vendor=` compares uppercase-exact, so "S&S" / "SS" / "SSA" typed
  by three reps split the vendor forever. Curated `<select>` + an `Other…` escape; the two copies
  (builder + dashboard) are drift-locked by a test.

---

## Ruth's "Final notes" box saved her words and told nobody (2026-08-14)

**Problem.** Porting the Approve-note box from the art-request page to the mockup page
(`pages/js/mockup-detail.js`, Ruth's digitizing surface, route `/mockup/:id`) surfaced a
live bug beside it: `openMarkCompleteModal()` collects a "Final notes (optional)" textarea
and posts it with **`notify: false`**, so anything Ruth typed on completion was stored in
Caspio and reached no one. The AE got only the fixed one-liner from `sendStatusNotifications`.

**Root cause.** `notify: false` was a correct default for *audit* notes (status rows the
timeline scanner needs) and was copy-pasted onto a note that carries **user-authored text**.
Those are different things wearing the same shape.

**Solution.** `notify: !!notesText` + explicit `Posted_By_Role`. Blank note = today's exact
behaviour; typed note = the other party actually gets it.

**Prevention.**
- 🔑 **`notify: false` is right for a note the system wrote and wrong for a note a human
  wrote.** Audit the distinction wherever both share a POST body — there are 10 `notify:`
  sites in `mockup-detail.js` alone, and the free-text ones are the minority.
- 🔑 **Routing direction: `Posted_By_Role: 'ae'` → Ruth (`mockup-routes.js:1489`); `'artist'`
  → the rep of record.** Omitting it falls through to an author-NAME heuristic
  (`['ruth','digitiz',…]`, :1477) — right today, fragile forever. Set it explicitly.
  Same contract as `/api/design-notes` on the art-request side; only the field names differ
  (`Mockup_ID`/`Author`/snake_case `Note_Type` vs `ID_Design`/`Note_By`).
- 🔑 **To add opt-in notify to a function shared by N callers, add a trailing parameter that
  defaults to the old behaviour** — `handleStatusUpdate(status, notes, btnEl, notifyNote)`
  has 4 callers; only Approve passes the 4th, so the other three are provably unchanged.
- ⚠️ **This page's approve had NO `confirm()` to replace**, unlike the art-request one — so
  the modal ADDS a click rather than swapping one. Worth saying out loud before shipping a
  "same as the other page" change; the two are not the same UX delta.
- ⚠️ `openReviseModal()` re-`addEventListener`s its cancel/submit on every open and never
  removes them; `statusUpdateInProgress` masks the duplicate status write but **the
  file-upload branch is unguarded, so a re-opened revise modal uploads twice.** Not fixed.
  New modals here use `.onclick =`, which is idempotent.

---

## `table-layout: fixed` reads widths from the FIRST ROW, not from your `<th>` classes (2026-08-13)

**Problem.** The new per-rep Past Due print sheets came out with all 8 columns an identical
90 px despite explicit per-column width classes on the `<th>`. Customer names wrapped to two
lines, which nearly doubled sheet height (Nika: 9.7 in of a 10 in page for 23 rows).

**Root cause.** Under `table-layout: fixed` the browser derives every column width from the
**first row of the table** and ignores later rows. The first row here was the repeating rep
banner — `<tr><th colspan="8">` — which expresses no per-column width, so the engine fell back
to equal division. The width classes on the third row were never consulted.

**Solution.** Move the widths onto a `<colgroup>` / `<col>` set. `<colgroup>` outranks all rows
under fixed layout, so it works regardless of what the first row looks like.

**Prevention.**
- 🔑 **`table-layout: fixed` + any `colspan` in the first row ⇒ you MUST use `<colgroup>`.** This
  is the normal shape for a print table, because the repeating `<thead>` banner that carries the
  rep/customer name onto spilled pages is itself a full-width `colspan` row.
- 🔑 **A repeating identity row belongs in `<thead>`, not in an `<h*>` above the table.** Only
  `thead { display: table-header-group }` reprints on the next physical page. The old printout
  put the rep name in an `<h3>`, which is exactly why page 3 of Erik's 8/13 PDF was an orphan
  list belonging to nobody.
- 🔑 **Verify print layout by MEASURING, not by eyeballing.** `getBoundingClientRect()` per cell
  plus `Range.getClientRects().length` for line count found this in one pass; the rendered page
  looked plausible. Careful: an inline-block (the days-late badge) reports 2 rects without
  wrapping, so line-count alone false-positives.
- 🔴 **Harness trap:** the sheet's typography is scoped to `#pdo-print-sheet`. Cloning its
  *innerHTML* into a differently-id'd preview div silently drops every rule and renders at
  browser-default 16 px — the first measurements were 2× too tall and entirely fictional. Move
  the real node, or reuse the real id.

### The print-isolation rule also hides disclosures that used to print

Shipping this, a pre-deploy review caught what the isolation rule
`body.pdo-printing > *:not(#pdo-print-sheet) { display: none }` costs. The OLD printout
carried "30-day window · 475 orders scanned" because `#pdo-asof` sits in `<main>`, not in the
hidden `.dash-header-right`. Hiding the whole shell removed it — so a 30-day sheet read as a
rep's *complete* past-due list while silently omitting the oldest orders, the ones most needing
action. Fixed by stamping the window + print time on every rep sheet.

- 🔑 **When you replace a whole-page print with an isolated sheet, diff what the old print
  DISCLOSED, not just how it looked.** Scope/as-of/provenance lines are the easiest to lose and
  the most expensive to lose, because the artifact leaves the building and states a count.
- 🔑 **A handout needs a freshness gate, not just a data gate.** `!lastData` is not enough:
  the page is opened at 7:40 and printed at 8:05, and a 25-minute-old list still prints
  *today's* date, so nothing on paper reveals its age. Re-pull past a bound (120 s here) and
  ABORT the print if the re-pull fails — same call `sanmar-inbound-today.js:syncBeforeOutput`
  makes. Riding the upstream cache keeps it ~free on Caspio quota.
- 🔑 **Scoping every print rule to a class the button sets regresses Ctrl+P**, which then falls
  back to the raw board. Handle `beforeprint` so a keyboard print builds the same sheet, and
  keep a `body:not(.printing)` fallback for when there is no data to build from.

---

## Never forward a Content-Length you did not measure (2026-08-12)

**Problem.** Steve's "Send to Supacolor" picker answered searches with `Unterminated string in
JSON at position 476` — the browser was told the response was shorter than it was and stopped
mid-string. `/api/box/folder-files` broke the same way for folders of 5–27 files: **8 of 16 real
art folders sampled**. Live 7 days (2026-08-05→12); fixed app `v2026.08.12.1` + proxy same day.

**Root cause.** `boxForward` copied `content-length` from upstream then piped the body, but
**node-fetch asks for gzip and inflates transparently** — so the header described the COMPRESSED
bytes while the pipe sent decompressed ones. `content-encoding` was correctly NOT copied, which is
what made the length a *lie* rather than a detectable mismatch.

**Why it looked intermittent — a BAND, not a threshold.** Corruption needs uncompressed ≥ 1024 (so
the proxy gzips) AND gzip < 1024 (so our own `compression()` declines to re-compress and leaves
the bogus header). Below the band the proxy sends plaintext; above it `compression()` strips the
header and goes chunked — accidentally correct. **Small is safe by being small, huge by being
huge, and every picker lives in the broken middle.** Search caps at `limit=20`, so it could never
reach the size that recovers: 14+ hits always failed, ≤13 always worked.

**Solution.** Stop copying `content-length` in `boxForward`, `boxForwardWrite` and the proxy's `jotform.js`; let Node frame the response.

**Prevention.**
- 🔑 **Do NOT gate the copy on `content-encoding` being absent.** That works for
  node-fetch/undici, but **axios DELETES that header after inflating while keeping the stale
  length** (measured: 47 on a 3008-byte stream), so the conditional form is unwritable in the
  proxy. Portable rule: **only ever set a length you computed from the bytes you are about to
  write.** Sweep: 5 `.pipe(res)` sites across both repos, these two the only offenders.
- 🔑 **The obvious source-grep lock is VACUOUS.**
  `not.toContain("upstream.headers.get('content-length')")` would have been GREEN all week — that
  literal never existed; the code reads `.get(h)` in a loop. Both tests instead PARSE the real
  array/handler out of source and drive it through a live HTTP round trip.
- 🔑 **An express+`compression()` upstream CANNOT reproduce this** — it removes Content-Length
  when it gzips, so the harness passes against the bug. Use a raw `http.createServer` writing
  `Content-Encoding: gzip` AND a gzip-sized `Content-Length` by hand.
- 🔑 **Test the BAND** — one small + one large payload both pass while broken. Assert the
  predicate and guard that the sizes straddle it.
- ⚠️ Worse than truncation: with keep-alive the surplus bytes are parsed as the next response and
  the connection desynchronises (`HPE_INVALID_CONSTANT`).
- ⚠️ `application/octet-stream` is compressible in the app's mime-db 1.54.0 but not the proxy's
  1.52.0 — a routine proxy `npm install` would have started **silently corrupting small `.DST`
  downloads** (a bad stitch file, not a visible error). Closed permanently by the same change.
- ⚠️ `git blame` misleads: the loop arrived in `76b6aa85`, a commit about content-hashed caching.
- Locked by `box-forward-content-length.test.js` + `jotform-file-content-length.test.js`, both
  verified to go red when the bug is reintroduced.

---
