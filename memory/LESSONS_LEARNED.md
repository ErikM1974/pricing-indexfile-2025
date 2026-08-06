# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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

## Steve's Box picker searched a number that has never existed (2026-08-05)

**Problem.** Steve loaded a mockup into Box, opened **Send Mockup**, and got the yellow "No Box
folder found for this design", an empty picker, and a Send button stuck disabled at "0 of 6
selected". The one "Previously Sent" card rendered as a grey **File** placeholder. Erik's read
was "this used to work" — half right, and the half that was right pointed at the wrong defect.

**Root cause — two independent bugs, only one a regression.**
1. The picker called `/api/box/folder-files?designNumber=` with Caspio's **`ID_Design`** (53069).
   Steve names his Box folders with the **ShopWorks** number **`Design_Num_SW`** ("40733 Ironside
   Marine"). The two series are unrelated: across 2,710 art requests they coincide **4 times**,
   all hand-typed in 2024. `ID_Design` runs 50092-53069, `Design_Num_SW` runs 111-1232434. So the
   search matched nothing, ever — wrong since `7193982d` / proxy `3b05395`, masked all along by
   the paste-URL fallback. The proxy's own comment (`box-upload.js:1432`) had documented the
   correct key the whole time.
2. The broken thumbnail WAS a regression, two days old. `b9e9d2a3` session-gated the Box surface;
   335 stored Caspio mockup URLs are absolute `https://caspio-pricing-proxy…/api/box/thumbnail/<id>`
   and now 401. `box-url.js` was written **in that same commit** to fix exactly this — and wired
   into only the two transfer pages. Every art/mockup surface kept rendering raw stored URLs.

**Solution.** Picker keys off `Design_Num_SW` (6/6 on recent jobs) with a named empty state, and
**no** company-name fallback — a company search resolves to the first folder merely *containing*
the name, i.e. another design's artwork (it is how design 53069's mockup got filed into
"40640 Ironside Marine"). `boxUrl()` adopted across all 10 art/mockup renderers + 6 pages. The
send path converts any `/api/box/thumbnail/<id>` into a real Box shared link before it reaches an
email. Proxy upload routes accept `designNumSw` so uploads and the picker agree on one folder.

**Prevention.**
- `tests/unit/box-url.test.js` drift-locks it: any page loading a script that calls `boxUrl()`
  must also load `box-url.js`, **and load it first**.
- `tests/jest/box-folder-files-design-number.test.js` (proxy) pins that a ShopWorks number
  resolves and a Caspio `ID_Design` returns an honest `200 + found:false`.
- 🔑 **A module that ships unwired is invisible to unit tests that only exercise the module.**
  `box-url.js` had 20 passing tests while doing nothing on 8 of the 10 pages that needed it.
- 🔑 **"It used to work" is a hypothesis — check git before redesigning.** Two minutes of
  `git log -S` separated a year-old latent bug from a 2-day-old regression.
- 🔑 **Two ID series that both read as "the design number" WILL be confused.** Name the variable
  for the system it belongs to (`swDesignNum`, not `designId`).
- 🔑 **`img.src` returns an ABSOLUTE url** — comparing it against the relative literal you just
  set is always false. Use `getAttribute('src')`. It silently killed a lightbox fallback in two files.

---

## A 403 <img> is invisible to every automated check — only eyes caught it (2026-08-05)

**Problem.** DST Studio shipped with a broken NWCA logo in the header: the alt text and a
broken-image icon, on every visit. The same dead URL was in the **customer-facing Approval
Sheet**, so a printed proof would have carried a broken logo to a customer. It survived a
full live-verification pass and only surfaced when Erik sent a screenshot.

**Root cause.** I built the studio's header by copying `mockup-generator.html`, inheriting its
`cdn.caspio.com/A0E1B000/...` logo and favicon. That host returns **403**. Those two pages were
the only places in the repo still using it — the house standard is `/favicon.png` (179 pages)
and the `A0E15000` logo (230 pages).

**Why every check passed.** A failed `<img>` does not fail the page: the HTML is 200, the DOM
is correct, `grep` of served markup matches, and a broken image logs nothing my
console-error probe surfaced. I verified *the page*, never *the page's sub-resources*.

**Solution.** Point both pages at the house-standard URLs. The logo PNG is RGBA, so the existing
`brightness(0) invert(1)` (white on dark header) and `brightness(0)` (black on printed sheet)
filters still work untouched.

**Prevention.**
- 🔑 **Assert `img.naturalWidth > 0`, not that the page loaded.** `complete` is true for a
  failed image too — `naturalWidth` is the only honest signal, and it works headless where
  screenshots don't.
- 🔑 **Copying a header inherits its bugs.** Before reusing markup from a neighbouring page,
  probe its absolute asset URLs; a `grep -c` for the repo's dominant favicon/logo URL tells you
  instantly whether the source page is the odd one out.
- 🔑 **Anything that prints for a customer deserves its own asset check** — the broken sheet
  logo was the costlier half of this bug and the half no staff member would have reported.

---

## A per-frame `getImageData` capped the spin at whatever the readback allowed (2026-08-04)

**Problem.** The garment designer's 🔄 Spin preview looked choppy and "unreal" no matter how the
motion was tuned. Three defects were stacked, and each masked the next.

**Root cause.**
1. **Rendering.** 24 photos 15° apart were composited as a *permanent linear crossfade* — the
   shirt was a double exposure 100% of the time, and it stepped photo-to-photo while the printed
   logo (drawn from continuous `theta`) glided. The eye reads that desync as chop.
2. **Settle.** On release, momentum rounded to a virtual step but wrapped `PHOTO.pos` by
   `PHOTO.frames.length` (24) instead of `effectiveSpinSteps()` (96). Measured from four
   arbitrary positions it jumped **180°, 1.5°, 179.3°, 91.1°** and parked at blend fractions
   0.52/0.56/0.96 — i.e. the resting shirt was usually a half-and-half ghost.
3. **Throughput.** `rebuildMockup()` runs every tick, and it called `maybeWarnLowContrast()` →
   `artMeanLuminance()` → **`getImageData()`**: a GPU→CPU readback that stalls the pipeline,
   inside a 6.1 ms frame budget.

**Solution.** View morph (scale each neighbour photo horizontally about the shared registered
torso axis by the ratio of apparent turntable widths, *then* blend — silhouettes align, so the
fade stops reading as a ghost); fade compressed to the middle 40% of each gap so the shirt is a
single pure photo 60% of the time; settle glides onto the nearest **real photo angle**;
delta-time scaling on both momentum and auto-spin; and the contrast warning memoized on
`id§eraseN§knockOn§garment`. Measured after: **163.9 fps on a 163.9 Hz display**, median frame
6.1 ms in a 6.1 ms budget, 5 dropped frames per 400, revolution 6.58 s.

**Prevention.**
- 🔑 **`getImageData()` anywhere reachable from an animation tick is a frame-rate cap, not a
  slow function.** It forces a pipeline flush. Memoize on the inputs that actually change, or
  hoist it out of the loop entirely.
- 🔑 **Fixed per-frame increments are a refresh-rate bug**: `pos += k` ran twice as fast on a
  120 Hz screen. Advance by measured elapsed time and clamp `dt` for tab switches.
- 🔑 **Two position spaces (24 real frames vs 96 virtual steps) invite a wrap in the wrong one** —
  and the symptom (an occasional jump at the *end* of a coast) looks like a physics-tuning
  problem, not an indexing one. Assert the parked state, not just the motion.
- 🔑 **Blending frames is not interpolating geometry.** If a crossfade looks like ghosting,
  align the silhouettes before fading rather than tuning the fade curve.
- ⚠️ **rAF is paused in a hidden tab, so any in-page fps probe hangs there** (a CDP eval waiting
  on it times out at 45 s and reads as "renderer frozen"). Arm the probe on `visibilitychange`
  and read the stored result afterwards.

---

## The shared print block flattens every color you set inline (2026-08-04)

**Problem.** The monogram Customer Proof renders each name in its real thread color — the whole
point of the sheet. On screen it was perfect. **On paper every name printed black**, and the
tiny color swatch beside it still printed correct, so the sheet looked deliberate rather than
broken. Found by review, not by the browser pass that had already "verified" the feature.

**Root cause.** `quote-builder-common.css`'s `@media print` block contains
`* { color: black !important; }`. The controller set the thread color as a *normal* inline
declaration (`style="color:#003DA5"`), and an author `!important` beats any normal declaration —
including inline. Backgrounds were unaffected, which is why the swatch survived and the defect
read as intentional.

**Solution.** The inline color is now `!important` too (inline `!important` outranks stylesheet
`!important`). Proven in-page rather than assumed: the same cascade reproduced synthetically
yields `rgb(0,0,0)` without the flag and the true color with it.

**Prevention.**
- 🔑 **A print stylesheet is a second rendering nobody looks at.** Screen verification says
  nothing about it — check print explicitly, or the defect ships looking fine.
- 🔑 **`quote-builder-common.css` forces black text and is loaded by ALL 4 quote builders** — any
  feature whose *meaning* is carried by color (thread, status, warning) must use `!important`
  inline or a rule with its own `!important`, or it silently prints monochrome.
- 🔑 **A partial survivor disguises the failure**: the swatch (background) printed while the text
  (color) did not, which reads as a design choice instead of a bug. When one half of a visual
  pair works, suspect a property-scoped override rather than a broken feature.

---
