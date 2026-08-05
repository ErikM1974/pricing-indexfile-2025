# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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

## Releasing from a SHARED checkout: excluding a file cuts both ways (2026-08-04)

**Problem.** Deploying the Embroidery Studio, the release also carried
`quote-builders/monogram-form.html` â€” a parallel session's WIP that another session's
`git add -A` had swept into `baafe9f3`. Shipping it would have put a **dead "Print Customer
Proof" button** in front of reps (its controller/CSS were still in review on develop). Two
further traps followed: `git checkout main` **aborted** because the shared tree was dirty with
three sessions' edits, and the develop sync-back **silently reverted** the WIP the release had
deliberately excluded.

**Root cause.** A shared working tree makes branch-level operations sweep in work whose owner
isn't in the room. And a merge that restores a file to main's version encodes "main's copy
wins" â€” merging that commit back into develop faithfully replays the deletion.

**Solution.** Cut the release at *my* verified sha in an isolated `git worktree`
(`git merge --no-ff --no-commit <sha>` â†’ `git checkout HEAD -- <foreign file>` â†’ commit with the
exclusion stated in the message), then on the sync-back re-take develop's copy
(`git checkout origin/develop -- <file>`) before pushing.

**Prevention.**
- ðŸ”‘ **Never `git checkout <branch>` in a shared checkout â€” release from a `git worktree`.** Also
  put that worktree at a SHORT path: `/Temp/nwca-rel` worked where the session scratchpad path
  blew Windows MAX_PATH on a deep blog filename ("Filename too long", `Could not reset index`).
- ðŸ”‘ **Every file-level exclusion needs a matching restore on the merge-back**, or the release
  silently deletes the work it was protecting. Verify with `grep` for a marker from the WIP
  *before* pushing the sync â€” not after.
- ðŸ”‘ **Deploy the dependency first and prove it with a live probe**: the box-labels page needed
  proxy `/api/sanmar-orders/label-data` â€” curl'd for HTTP 200 (and absence of `ContactEmail`)
  before the app slug went out.

---

## `el.hidden` doesn't hide a flex element â€” and asserting the property hides the bug too (2026-08-04)

**Problem.** On the contract calculator's DST card, `el.hidden = true` left three elements fully
visible: the drop zone stayed on screen *under* the loaded file card, and two empty note rows
rendered inside the card as stray dashed-bordered strips whenever no note applied.

**Root cause.** `[hidden] { display: none }` lives in the **UA stylesheet**, so ANY author
`display` declaration beats it regardless of specificity â€” and `.dst-drop` / `.dst-note` /
`.dst-suggest` are all `display: flex`. Elements with no author `display` (the card, the error,
the buttons) hid correctly, which is exactly why it looked like the pattern worked.

**Why the first verification pass missed it.** The browser check asserted `el.hidden` â€” the
**property** â€” which is just reading back the attribute that was set. It is true whether or not
the element is visible. Only `getComputedStyle(el).display` answers the actual question.

**Solution.** Attribute-qualified rules, which outrank the plain class rule:
`.dst-drop[hidden], .dst-note[hidden], .dst-suggest[hidden] { display: none; }`

**Prevention.**
- ðŸ”‘ **Any component that sets both a `display` and `[hidden]` needs an explicit
  `.thing[hidden]{display:none}`** â€” assume the UA rule loses.
- ðŸ”‘ **Verify visibility with `getComputedStyle().display` / `getBoundingClientRect()`, never
  the `.hidden` property or a class check.** Asserting the input you just set proves nothing;
  assert the rendered consequence.
- ðŸ”‘ An adversarial review pass caught this after a "passing" browser pass. When a verification
  result is a tautology, it will pass forever.

---

## A corrupt file that "parses" becomes a silent wrong price â€” DST has no magic bytes (2026-08-04)

**Problem.** Browser-verifying the contract calculator's new DST drop zone: 2,000 bytes of
arbitrary garbage named `.dst` didn't error â€” it "decoded" into ~500 nonsense stitches, silently
replaced the previously loaded file, and priced the order at the 8K contract minimum.

**Root cause.** Tajima DST has no file signature: ANY 3-byte record decodes into *some* stitch
delta. `dst-parser.js`'s only guardrails were "file too small" and "zero stitches decoded" â€”
tuned for the Embroidery Studio VIEWER, where garbage is self-evident as noise on the canvas.
On a PRICING surface the same parse produces a plausible number with no visual to contradict it.

**Solution.** Calculator-side validity gate (`embroidery-contract.js handleDstFile`): every real
DST declares its record count in the `ST:` header â€” refuse loudly when it's 0 or disagrees with
the decoded record total by >25%.

**Prevention.**
- ðŸ”‘ **A parser succeeding â‰  the input being valid. For signature-less formats, cross-check an
  internal redundancy** (declared vs decoded counts) before trusting the result with money.
- ðŸ”‘ **The same parse carries different risk per surface**: viewer â†’ garbage renders as visible
  noise; calculator â†’ silent wrong price (Erik's #1 rule). Reused code inherits the validation
  needs of its STRICTEST consumer.
- Verify error paths with actively hostile bytes, not just wrong extensions â€” 12 green jest
  tests and a clean happy path coexisted with this hole.

---

## Monogram thread-color dropdown dead in prod: API envelope change nobody re-tested (2026-08-04)

**Problem.** The monogram form's thread-color selector had been silently broken live:
`this.threadColors.filter is not a function` on every page load. Users could still type
names, so nobody reported it.

**Root cause.** `GET /api/thread-colors` originally returned a bare array; at some point the
proxy started returning an `{success, count, colors}` envelope. `fetchThreadColors()` kept
`return await response.json()` with the comment "Returns array directly" â€” HTTP 200, valid
JSON, wrong shape. The error surfaced only in the console + a toast reps ignored.

**Solution.** Service now unwraps both shapes and **throws** on anything else
(`monogram-form-service.js` `fetchThreadColors`). Found while browser-verifying the
Stitch-Proof feature, fixed in `ced3bc2f`.

**Prevention.**
- ðŸ”‘ **HTTP 200 + valid JSON â‰  valid response â€” assert the SHAPE at every fetch boundary**
  (same family as the pricing-bundle empty-arrays-on-rate-limit lesson, v1791).
- ðŸ”‘ **When a proxy route's response shape changes, grep ALL frontend consumers** â€” the app
  and proxy deploy independently, so shape drift breaks quietly.
- ðŸ”‘ A broken feature users can work around generates zero bug reports; only a
  browser-verification pass with the console open finds it.

---

