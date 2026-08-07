# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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

## The boxUrl() migration missed every surface that never called boxUrl() (2026-08-06)

**Problem.** Erik: finished-photo thumbnails were blank on the Photo Library, the capture page's
design picker, its "on file" list, and the dashboard Pride Wall. Cards, captions, counts and
"18 photos / 18 live" were all correct — only the images were dead.

**Root cause.** The Aug-5 Box gating put the proxy's `/api/box/thumbnail/:fileId` behind
`requireCrmApiSecret`. `Finished_Photos.Image_URL` is written ABSOLUTE at upload time
(`proxy src/routes/finished-photos.js:125` → `${PROXY_BASE_URL}/api/box/thumbnail/<id>`), and
`designs-by-method.js` returns stored `FileUrl` thumbnails in the same absolute shape. Absolute =
cross-origin = no SAML cookie → **401 on every `<img>`** (verified live: anonymous GET returns
`401 {"error":"Unauthorized"}`). The fix everywhere else was `boxUrl()`, which re-points stored
urls at this origin so the cookie authorises them — these four renderers were never migrated.

**Solution.** `resolveBoxUrl()` at each render site (finished-photos-library.js,
finished-photos.js ×2 — design tiles AND the manage list, pride-wall-controller.js) plus the
`box-url.js` script tag on their three pages. The Pride Wall is an ES module, so it reads
`window.boxUrl`; a classic script always executes before any `type="module"`.

**Prevention.**
- 🔑 **A migration guarded by "everyone who calls X must also load X" cannot see the files that
  never call X.** `box-url.test.js` was green throughout — its consumer scan starts from
  `boxUrl(` call sites, so an unmigrated renderer is invisible by construction. The blast radius
  of a gating change is *every reader of the gated data*, not the subset already adapted to it.
- 🔑 **Scans define the blind spot.** That test listed JS non-recursively and skipped
  `staff-dashboard-v3/`, so the Pride Wall was doubly unreachable. Both widened; the JS walk is
  now recursive and the page walk follows `type="module"` **import graphs**, since a module
  consumer has no `<script src>` of its own to match on.
- 🔑 **Ask what the field actually holds before assuming which fixer applies.** The design tiles
  looked like a different bug (`/api/files/<key>`, which is open and returns 400 not 401); the
  live payload showed they were `/api/box/thumbnail/` urls after all. One `curl` of the real
  endpoint beat reading the writer code.
- ⚠️ **"Upload works" ≠ "images work."** The capture preview is a local `URL.createObjectURL`
  blob, so a phone upload looks completely healthy while every stored url is 401ing.
- 🔑 **The reported pages were a third of it.** A 43-agent sweep found the same defect on AE
  Mission Control, the Send Mockup picker (shipped the day before, `807184ee` — it *builds*
  `API_BASE + thumbnailUrl`, so it was cross-origin by construction), both Bradley boards, the
  quote-builder design combobox, the DTG catalog search, the EMB design search, and the SanMar
  inbound sheet (`/api/thumbnails` returns the same absolute shape — that is why the printed
  PDF had no artwork). **When a shared gate changes, enumerate every reader of the gated data
  and check them all — the ones a human happens to notice are a biased sample.**
- 🔑 **A path-blind drift lock creates the collision it is meant to prevent.** Matching consumers
  to pages by BASENAME made every page loading any `utils.js` fail once a helper landed in
  `builders/dtg/utils.js` — 20 false failures, the same shape as the 2026-06-09 `?v=` incident.
  Match on the resolved repo path, and follow `<script src>` → import graph (that covers both
  the `type="module"` dashboard and the esbuild-bundled quote builders).
- 🔑 **The VENDOR portal needed a third mechanism, not a third copy of the second.** Supacolor/L&P
  are neither staff nor customers, so `boxUrl()` (origin) and `portalProofUrl()` (customer token)
  both miss. `vendorProofUrl` + `lib/vendor-magic-link.mintProofToken` mints a capability bound to
  `{fileId, vendorName}` from rows `vendorOwnsRow()` already cleared. 🔴 **Type tag `'vproof'`, not
  `'proof'`** — both families sign with SESSION_SECRET, so without it one outside company's image
  URL verifies inside another identity. Jest-locked in BOTH directions.
- 🔑 **`.map(projectVendorJob)` hands map's INDEX to the second parameter** — every token would be
  minted for vendor "0"/"1"/… and 404 on redemption. Silent at author time, total at runtime;
  a regex test now forbids the bare reference.
- 🔑 **A wall of 404s looks exactly like a working deny-list.** Prove the negative AND the positive
  in the same run: the customer token 404ing at the vendor route only means something because the
  same token returned a 200 PNG at the customer route seconds earlier.
- 🔑 **To see a customer-facing change, use the STAFF PORTAL PREVIEW:
  `/portal-admin/preview/<idCustomer>`** (linked from `dashboards/customer-portal-admin.html`) —
  read-only, renders exactly what the customer sees, no customer credentials needed. Erik had to
  point this out after I'd concluded it was unverifiable: I grepped
  `customer-portal-admin.html` for "preview|viewAs|impersonat" and the *route* lives elsewhere.
  **Grep the route table, not just the page you expect to host the button.**
- ⚠️ **A hand-minted portal session is NOT a substitute.** `requireCustomer` re-checks the live
  `Customer_Portal_Access` table, so a signed cookie for an unregistered email 401s and *clears
  itself*. Worse, the 401 body has no `mockups` key — so a naive parse prints "0 mockups" and
  reads as a real empty result. Check the HTTP status before interpreting a body.
- ⚠️ **Do not read `img.complete`/`naturalWidth` on a polling board.** Bradley's queue re-renders
  every 60s, replacing every `<img>`, so a snapshot mid-poll shows "0 decoded, 38 pending" on a
  page that is working perfectly. The network log (40/40 → 200) was the truthful instrument.
  Also: 401 vs 404 matters — one 404 here is a Box file that was genuinely deleted, not a break.

---

## Gating a shared image route broke every CUSTOMER, and only a real login showed it (2026-08-05)

**Problem.** The Aug 5 Box gating (`b9e9d2a3`) put `/api/box/thumbnail/:fileId` behind
`requireStaff`. Customer-portal artwork is STORED as absolute URLs pointing at exactly that route,
so every proof a customer saw started 401ing. Measured against live data: **92% of art proofs, 8 of
9 mockup proofs, and 100% of the logo library** (128/128) — the whole "My Logos" showcase was blank.
Nobody reported it, because customers do not file bug reports.

**Root cause.** The gate was designed and verified entirely from a STAFF session, where
same-origin + the SAML cookie makes it work. `/portal` is a different identity: `requireCustomer`
sets `req.customerSession.portalCustomer`, which has no `crmUser`, so `requireStaff` rejects it.
The obvious fix — `boxUrl()`, which repointed stored URLs at this origin and fixed all the staff
pages — does **nothing** here: same-origin still lands on `requireStaff`.

**Solution.** A capability, not a relaxation. `portalProofUrl()` rewrites each stored Box URL to
`/api/portal/proof-image/<token>` while projecting rows the server has ALREADY authorized as that
customer's; the token is HMAC-signed (`lib/customer-magic-link`) and binds one fileId to one
customer. The route takes the fileId ONLY from the verified token, so the customer never supplies a
Box id and there is nothing to enumerate — the "any id, any file" power the staff route still has
was deliberately not extended. Not `requireCustomer`-gated, because `/mockup/:id` and
`/art-request/:designId` are public email-link pages whose images must render for a logged-out
customer; when a session IS present it must match, so a token cannot be replayed into another
customer's browser.

**Prevention.**
- 🔑 **"Verify with a real session" is not a formality.** 18 unit tests passed and the whole thing
  was still broken end to end: `portalLimiter` allows 60 req/15 min, and one portal page view is
  **53 images**, so the customer 429'd out of their own portal partway down the page. Nothing short
  of loading a real customer's portal would have found that. Images now have their own budget.
- 🔑 **A gate is per-IDENTITY, not per-origin.** Before gating a shared route, enumerate every
  identity that reaches it — staff SAML, customer portal cookie, logged-out email link, server-side
  callers — and test each. Two of the four here were never considered.
- 🔑 **Two token types signed with the same key need a `t` discriminator**, or a stolen session
  cookie is an image capability and vice versa. Jest-locked both directions.
- 🔑 **A customer route must not inherit a staff forwarder's param allowlist.** Reusing
  `boxForward` also reused `BOX_FORWARD_QUERY` (`full`, `url`, `folderId`, …). The proxy's
  thumbnail route ignores those *today*, so nothing leaked — but the customer route would have
  silently widened the day upstream started honouring one. It now forwards `size` only, and forces
  `Cache-Control: private` rather than echoing upstream, since the response is a per-caller
  capability that must never land in a shared cache.
- 🔑 Distinguish "my code is broken" from "the data is": 2 of the 53 failures were Box files that
  no longer exist (`Item not found`) — a pre-existing dead reference, not the fix. Check the asset
  before blaming the change.
- Drift guard: `tests/unit/portal-proof-image.test.js` fails if any Box-carrying field in the four
  portal projections stops going through `portalProofUrl` — an unwrapped field is invisible, it
  just renders broken for a customer who will never tell you.

---
