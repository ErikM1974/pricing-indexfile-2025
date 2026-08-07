# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## Two note endpoints write the same table; only one of them tells anybody (2026-08-07)

**Problem.** The AE "Approve Design" button on `/art-request/:id?view=ae` fired a native
`confirm()` and collected no free text, so anything the AE wanted Steve to know had to go
through a separate `+ Add Note` afterwards. Adding an optional note box meant picking a
route for it.

**Root cause / the trap.** The page has TWO note endpoints that look interchangeable and
are not:
- `POST /api/art-requests/:designId/note` (proxy `src/routes/art.js:1436`) — writes
  `DesignNotes`, **no fan-out, and no length validation at all**.
- `POST /api/design-notes` (`art.js:760`) — writes the **same table with the same fields**,
  plus direction-aware Slack + email. `Posted_By_Role:'ae'` routes the primary email to
  Steve at `art@nwcustomapparel.com`; `notify:false` short-circuits the whole fan-out
  before any lookup.

So `/api/design-notes` is a strict **superset** — swapping to it is one row, not two. The
tempting wrong move is to keep the thin call and *add* a design-notes call for the Slack
ping; that duplicates the timeline row.

**Solution.** Swap the approve step to `/api/design-notes` with `notify: !!typedNote`, so a
blank note behaves byte-identically to before (Steve still gets `template_art_completed`
+ the dashboard push, and gains no third ping) and a typed note reaches him.

**Prevention.**
- 🔑 **Before adding a second call to get a side effect, check whether the endpoint you are
  already calling has a superset sibling.** Two routes writing one Caspio table is the norm
  in this repo, not the exception.
- 🔴 **The status write commits BEFORE the note write and is never rolled back.** A rejected
  note leaves the record `Approved` in Caspio while the UI shows "Error — retry", and a
  retry re-fires the status write, the note, the EmailJS to Steve and the dashboard push.
  Free text is the first input that can realistically trigger it — hence `maxlength="2000"`
  on the textarea *plus* a JS length guard (maxlength does not apply to a programmatic
  `.value` set).
- 🔑 **`approveDesign()` never called `refreshNotes()`.** Tolerable for an auto-generated
  status line, invisible-looking for a note the user just typed. If a write is user-authored,
  the surface that displays it must refresh in the same success block.
- 🔑 **`.onclick =` beats `cloneNode`/`replaceChild` for re-openable modals.** Property
  assignment is idempotent; the clone trick used by `openChangesModal()` also copies the
  reflected `disabled` attribute and `innerHTML`, so a modal closed mid-error reopens dead.
  `openCustomerReviseModal():4344` additionally leaks one overlay listener per open.
- ⚠️ **`showToast(...)` is called at 3 sites in `pages/js/art-request-detail.js` and is not
  defined on that page** (only `window.TransferActions.showToast` exists). Those three
  upload-failure messages throw instead of showing. Use `showArdToast()`. Not fixed here.

---

## Colour never changed the photo, and every existing check passed (2026-08-07)

**Problem.** On 253gear.com, choosing a colour did not change the product photo. A
shopper picking Charcoal was shown Athletic Heather and bought on that picture. Live on
**6 of the 7 multi-colour products**; on two of them the correct photo was already
uploaded and bound to nothing. Nobody reported it — Erik only asked how to *structure*
the product.

**Root cause.** Variants were bound to a photo by **Style alone**; Colour was never part
of the key. The audit asked only whether each variant had *an* image, which was true
throughout — so `variant_image_binding`, the headline check written after this defect
shipped twice before, passed cleanly on every affected product.

**Solution.** `scripts/253gear-align-media.js` + a declared `(Style|Colour) -> position`
map (`253gear-media-maps.json`). Two new audit checks in `src/utils/shopify-audit.js`:
`colour_image_distinct` (blocking — every pair resolves to its OWN photo) and
`orphan_media` (non-blocking — names uploaded-but-unbound photos and their position).

**Prevention.**
- 🔴 **"Every X has a Y" does not imply "every X has its OWN Y."** The reciprocal check is
  a different check. Whenever a binding is one-per-group, assert **distinctness**, not
  just presence — presence passes for the entire lifetime of the bug.
- 🔴 **Media ORDER is load-bearing.** The theme gives an **unbound** photo the options of
  the *nearest preceding bound* photo (`product-template.CURRENT.liquid:393-402`), so a
  lifestyle shot after the wrong flat-lay silently switches the shopper's colour on click.
  Calico's maroon lifestyle shot sat behind the charcoal tee and did exactly that. My own
  first instinct — "move lifestyle photos to the end" — would have *created* this bug on
  Spanaway; the theme code said otherwise.
- 🔴 **Never infer a binding from a filename.** Two of Spanaway's photos are named `34082`
  for design `34084`; the lifestyle files are stock names with no colour at all. Both
  Calico lifestyle shots had to be **opened and looked at** to learn their colour.
- 🔑 **A dry run that previews the wrong state is worse than none.** The first version
  validated against the *pre*-reorder gallery and printed bindings that were plainly
  wrong. Simulate every mutation in memory so the preview describes the state that will
  actually exist.
- 🔑 **Pick the statistic before trusting the data.** Taking the **max** of SanMar's
  `PIECE_WEIGHT` per size picked single outlier rows (hoodie L: 74 of 75 colourways say
  558 g, one says 567 g) and would have re-weighed **284 variants across 37 products**.
  The **mode** matched the catalogue on PC54 7/7 and PC78H 6/7. Check the distribution
  before writing, not after.
- 🔑 **`productReorderMedia` returns `UserError`, which has no `code` field** (unlike
  `MediaUserError`). Selecting it fails the whole query at parse time.
- 🔴 **A BAD GATE DOES NOT FAIL LOUDLY — IT REPORTS SUCCESS.** Both new checks shipped green
  and an adversarial review found **11 defects, 6 real**, in code I had just written and
  self-reviewed as safe. My own confirming pass called it "safe to deploy". Specifics worth
  keeping:
  - **`MediaImage` GID ≠ `ProductImage` GID** — two namespaces for one picture, so
    `media.id === variant.image.id` is NEVER true. Only the **normalised URL** joins them.
    (This bit me twice in one day: first in a script, then again in the audit check.)
  - **A check is only as good as the query feeding it.** `checkOrphanMedia` was inert on the
    publish gate because that query never selected `media { image { url } }` — it reported
    "no media to check" on products full of photos. Now drift-locked by a test.
  - **When a check cannot answer, it must SAY so** — never return a clean pass on data it
    never received.
  - **`byPair[k] = x` in a loop is last-write-wins.** It silently hid pairs whose sizes
    disagreed. Collect a Set when "these must all agree" is the actual invariant.
  - 🔑 Strip the CDN `?v=` before comparing image URLs — it differs between reads of one file.
- 🔴 **Shopify options are PRODUCT-level, so a colour listed is offered for EVERY style.** Four
  products sold "tee in one colour, hoodie in the other" while advertising all four pairs; the
  theme does no availability filtering, so half of each was **"Unavailable" with a dead Add to
  Cart**. Two fixes: recolour to one colour (Colour survives single-value and renders as static
  text), or **fold the colour into the Style value** ("T-Shirt - Royal") and delete the Colour
  option. Delete it with **`NON_DESTRUCTIVE`**, which refuses rather than deleting variants.
- 🔑 **Folding colour into Style silently breaks every config lookup** — price, weight, SKU and
  filter tag all key on the option string, and each tool **SKIPS an unknown style rather than
  erroring**, so the product drops out of coverage with nothing reporting it. `baseStyleOption()`
  resolves it, exact match first. ⚠️ It treats ANY `" - suffix"` as a colour, so
  `T-Shirt - Premium` would price as a plain tee — `align-prices` now names every style it
  resolved that way, because it is the one path that rewrites what a customer pays.
- 🔑 **`productDeleteMedia` does NOT delete the file.** It detaches the image; the file stays in
  Shopify Files, still `READY`, at a **different CDN url** (the `/products/` path, no attachment
  UUID) while the url the product was serving 404s. Recovery is a `files(query:)` lookup, not a
  re-upload — that turned a reshoot into five minutes.
- 🔑 **Only `productUpdate` and `publishablePublish` return a plain `UserError` with NO `code`
  field**; every other product mutation returns a typed error that has one. Selecting `code` on
  those two fails the whole query at parse time. **`productReorderMedia`'s canonical field is
  `mediaUserErrors`** — `userErrors` is a deprecated alias that can read empty while the real
  errors sit in the other, so select both.
- ⚠️ **A scripted edit to this repo can be silently reverted (OneDrive) — re-read before
  assuming it landed.** Two python-rewrite edits reported success and left the file unchanged;
  one produced a warning whose feeder set existed but whose print block was never inserted, so
  the warning could never fire. Verify the OUTPUT, not the edit's exit code.
- 🔑 **Backticks inside a JS template literal end the string** — a GraphQL `#` comment containing
  `` `userErrors` `` broke two files. No backticks in embedded GraphQL.
- 🔑 Verified on the **live storefront by clicking every thumbnail**, not in the admin —
  both prior binding incidents were invisible to the API. Set a distinctive size first:
  if a click moves Size, the image is bound to too few variants.

## Two Shopify shapes both use `name`, so every variant keyed to the same string (2026-08-07)

**Problem.** In the 253Gear Publisher build, `buildVariantMediaBindings()` produced a binding key
of the literal string `"season|||color"` for EVERY variant. Had it shipped, an entire product would
have bound to one image — or to none — which is exactly the defect that already hit 253gear.com
twice (644 variants after the tee/hoodie merge, then 7 Fall variants of #40749).

**Root cause.** Shopify uses the key `name` for two different things depending on direction:

    input  (ProductVariantSetInput):  { optionName: 'Style', name: 'T-Shirt' }   -> name is the VALUE
    output (variant.selectedOptions): { name: 'Style', value: 'T-Shirt' }        -> name is the OPTION

My helper did `found.name || found.value`, which is correct for the shape I SEND and silently
returns the option NAME for the shape Shopify RETURNS. Nothing throws; the keys just collapse.

**Solution.** Disambiguate on the presence of `optionName`, never on `name` — `optionValue()` in
`src/utils/shopify-product-builder.js` (caspio-pricing-proxy).

**Prevention.**
- 🔑 **Test against the shape the API RETURNS, not the shape you send.** The builder's own unit
  tests passed throughout — they exercised objects the builder had just constructed, which carried
  an internal `_key`. Only a fixture shaped like a real `productSet` response exposed it.
- 🔑 **A field name reused with two meanings is a silent-failure generator.** When an API round-trips
  through differently-shaped input and output types, write the collision down at the read site —
  a fallback chain like `a.x || a.y` will pick the wrong one and never complain.
- 🔑 **A key-building function deserves a test that two DIFFERENT inputs produce two different keys.**
  Asserting the happy path only would have passed here: every key was well-formed, just identical.

---

## A page size counted DESIGNS while the table stores design×LOCATION (2026-08-06)

**Problem.** After the artwork fix shipped, the SanMar inbound sheet still showed the 🎨 "no
logo" tile for 6 of 18 orders. Erik's read: "probably no thumbnail in ShopWorks yet." True for
2 of them; the other 4 had artwork the whole time.

**Root cause.** `proxy src/routes/thumbnails.js` `/thumbnails/by-designs` built its Caspio page
as `'q.limit': uncachedIds.length`. `Shopworks_Thumbnail_Report` is keyed
`Thumb_DesLocid_Design` — **one row per design PER LOCATION** — so 18 designs can match far more
than 18 rows. Caspio truncated the page, every design past the cut was reported `found:false`,
and that wrong answer was then cached for the 5-minute TTL. Rows arrive in serial order, so the
designs dropped were the NEWEST — exactly what an inbound sheet is made of, which is why it
looked like a bandit/ShopWorks sync lag. Fixed to `min(1000, ids × 25)`; live batch went 12 → 16
of 18 found, and the 2 remaining genuinely have no row.

**Prevention.**
- 🔑 **Size a page by the ROWS it can return, not the KEYS you asked for.** Any `q.limit` derived
  from an input count is wrong the moment the table is one-to-many.
- 🔴 **Truncation that reports `found:false` is indistinguishable from real absence** — and here
  it was cached, so it persisted. A short page should be detected and retried/raised, never
  reinterpreted as "no data".
- ⚠️ **My own probe was the broken instrument twice.** A 33-id sweep read `.thumbnails` off a
  400 body (`Maximum 20 design IDs`) and printed "all missing"; earlier runs disagreed with each
  other for the same reason. **Check the HTTP status before parsing.** The finding only became
  real when single-id queries returned artwork the batch had denied.
- 🔑 A mock that ignores `q.limit` cannot catch this — the regression test makes the fake Caspio
  honour the limit, so it fails against the old code (verified by reverting).
- 🔑 **Same route file, same disease: `/thumbnails/sync-status` reported `totalRecords: 20000`,
  which was `maxPages 20 × 1000` — the CAP, presented as a count** (true size 27,665). It also
  counted `recordsWithImages` off **`ExternalKey`, the retired Caspio Files key**, so it answered
  "0 of 20,000 have images" about a table where 26,990 do — artwork moved to Box and lives in
  `FileUrl`. **A metric outliving its schema reads as a catastrophe rather than a stale field.**
  Now counts `ExternalKey || FileUrl`, `strict: true` so truncation throws, and counts are opt-in
  behind `?counts=true` (a count means ~28 Caspio reads; `lastSync` is one).
- 🔑 **Caspio v2 does NOT return `TotalRecords`** on a `q.limit=1` read — the body is just
  `Result`, and `makeCaspioRequest` strips even that. There is no cheap COUNT; verify before
  designing around one. Use `discardResults: true` + `pageCallback` to count without holding
  27k rows in dyno memory.
- 🔑 **`lastSync` is the field that actually answers "is the sync stalled?"** — it showed the
  bandit thumbnail sync running 09:22 the same morning, which proved the two remaining blank
  designs had no artwork attached in ShopWorks rather than a sync lag.
- 🔑 **The inbound sheet has THREE artwork states, not two**: has art · has a design but no art
  (a real gap) · **no design at all** (blanks/undecorated, `method: "Other"`, empty
  `designNumber` — nothing is missing). Rendering the last two identically sent people hunting
  for artwork that never existed: on 2026-08-05, 3 of 4 "missing" tiles were blanks orders.
  Blanks now get their own glyph + solid tile; **the glyph must differ, not just the tooltip,
  because the printed sheet has none.**
- ⚠️ **Screen and print do NOT share the logo tile** — `logoTile()` vs `psLogo` in the print
  builders. Fixing one leaves the other; print used to render *nothing* for both no-image cases,
  so a missing proof, a blanks order and a failed image were indistinguishable on paper.
- 🔑 **These sheets go to a MONO LASER** (the `.sit-ps-rush` rule says so). On paper the signal
  must be shape/text, never colour — and a 42px emoji is a smudge. Print uses the words `NO ART`
  (dashed border, black) and `BLANKS` (solid, flat fill + `print-color-adjust: exact`, since
  browsers drop backgrounds when printing).
- 🔴 **`window.print()` SNAPSHOTS the DOM — an `<img>` still in flight is simply absent from the
  PDF.** No error, no gap, nothing to notice. The sheet builds fresh `<img>` tags and the screen
  tiles are `loading="lazy"`, so only orders the user had scrolled past were warm: everything
  below the fold silently lost its thumbnail. Measured on a real AE sheet — **7 POs with artwork,
  3 images in the PDF**; and cold-loading the full sheet, only **8 of 16** screen tiles were warm.
  Fix: `await img.decode()` on every sheet image before printing (`decode()` resolves when the
  bitmap can PAINT; `load` can fire a frame earlier — that frame is where this lived), capped at
  6s so a dead Box file degrades to the old behaviour instead of hanging the dialog. After: 14/14
  decoded, 0 missing, 4.5s wait. 🔑 **This masqueraded as the artwork bug being only half-fixed —
  two different causes producing the same "missing thumbnail".**
- ⚠️ **A fixture with a real Box url would 401 offline** and silently exercise the FALLBACK path
  while looking like it covered the image case — the print harness uses a `data:` URI instead.
  Note `/tests` is not served (removed in the 2026-08-05 source-exposure fix), so that harness
  only runs from disk; verify print by stubbing `window.print` on the real page and grabbing
  `#sit-print-sheet` before its 1.5s self-cleanup removes it.

---
