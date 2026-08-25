# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## First-ever caps order pushed to ShopWorks with NO artwork — the stamp had flattened the file ref to a boolean (2026-08-25)

**Problem.** First exercise of the /custom-caps paid leg (Stripe TEST-mode E2E, CAP0825-4781):
order reached OnSite with `designs: []` and `attachments: []` — production would get a proof-first
embroidery order with no logo attached. Quote-view and custom-caps-success were ALSO silently
artless for every future CAP order.

**Root cause.** The caps channel's `stampedOrderSettings` (server.js) wrote `frontLogo: true` /
`backLogo: <bool>` — server-authoritative *pricing flags* — into OrderSettingsJSON, clobbering the
client's `{fileUrl, fileName}` objects (Object.assign stamp wins over client base). Three consumers
(`submit-3day-order` push, quote-view.js:3481, custom-caps-success logoFig) all read `.fileUrl` and
optional-chain to nothing. Tees never hit it: its stamp doesn't touch artwork keys.

**Fix.** `sanitizeUploadedLogoRef(ref, allowedPrefix)` in config/storefront-channels.js (jest-locked);
caps stamp now carries the sanitized `{fileUrl, fileName}` through — only `{proxy}/api/files/` URLs
survive, and backLogo rides ONLY when the reprice charged it. Verified by rerun CAP0825-7724:
`Built designs: 1`, `Built attachments: 1`, Processed.

**Prevention.** A channel launched without ONE full test-mode E2E (create-session → signed webhook →
push) is unverified no matter how much code it shares — the tees channel being production-proven
proved nothing about the caps STAMP. `tests/3dt-fire-test-webhook.js` makes the full rehearsal a
two-command job; run it for every NEW storefront channel before launch, and read the push payload
log, not just the status flip.

---


## curl from git-bash mangled em dashes into U+FFFD inside a Caspio row (2026-08-25)

**Problem.** Creating the Forms_Library row for the embroidery-operator employment application
via `curl -d '{...}'` in git-bash returned HTTP 201 — but the stored `Form_Name`/`Description`
carried literal U+FFFD replacement characters where the em dashes were. The 201 looks like
success; the corruption only shows when you read the row BACK and inspect the bytes.

**Root cause.** git-bash on Windows handed curl the heredoc body in a non-UTF-8 encoding; the
proxy/Caspio replaced the invalid bytes with U+FFFD, which then round-trips as "valid" text.
Printing the GET response to the console ALSO renders "�" for unrelated console-encoding
reasons, so eyeballing output can't distinguish stored corruption from display noise.

**Solution.** Re-sent via `PUT /api/forms-library/:id` from Python with
`json.dumps(..., ensure_ascii=True)` (escapes non-ASCII to `\uXXXX`, so the wire body is pure
ASCII and immune to shell encoding), then verified the stored value with `ascii(field)` on a
fresh GET — shows `—`, proving real em dashes.

**Prevention.**
- 🔑 **Any Caspio/proxy write containing non-ASCII (em dash, ×, ’, é) goes through Python with
  `ensure_ascii=True` — never a curl body typed in git-bash.** JSON `\uXXXX` escapes are the
  portable path on Windows shells.
- 🔑 **Verify stored TEXT with `ascii()`/`repr()` on a re-read, not by eyeballing console
  output** — the console lies about encoding in both directions.

---

## A customer's real size request was captured, saved, and shown to nobody (2026-08-19)

**Problem.** WQ-2026-006 (web quote-cart) showed 18500B "S × 17". The customer's actual request
— A-M 8 / A-S 6 / XS 1 / L 2 — existed only in the notes box they typed at checkout, and no
surface displayed it. Erik caught it because "17 smalls" looked wrong.

**Root cause.** Two halves. (1) The quote-cart lets a customer add a line with one size + qty,
so they dumped the total on the default size and typed the real distribution into notes. (2)
quote-view's `renderNotes()` skipped ANY valid-JSON Notes as "structured config" — but the WQ
channel stores the customer's typed text INSIDE that JSON (`customerNotes`), so the one
free-text field a customer fills was invisible to reps by construction.

**Solution.** `renderNotes()` now renders a "Customer notes (typed at checkout)" block
(pre-wrap, text-only) when JSON Notes carries a non-empty `customerNotes`; structured config
without customer text stays hidden. Verified against the live row. The quote itself still says
S × 17 — sizes on a quote are the REP'S call after clarifying (here "A-" prefixed sizes look
ADULT while 18500B is the YOUTH hoodie — repricing territory, never an auto-rewrite).

**Prevention.**
- 🔑 **"Skip it, it's structured JSON" needs a look INSIDE the JSON first** — channels tuck
  human-typed text into structured blobs, and a skip on the container silently drops the one
  field a human wrote.
- 🔑 When a quote's numbers look odd, read the session row's `Notes`/`customerNotes` before
  trusting the line items — the cart shape (one size per line) invites totals-on-one-size.

---

## SAM quotes rendered "No items in this quote" — the samples channel opted out of the fix built for exactly this (2026-08-19)

**Problem.** First real paid-sample order (SAM0819-8320, Peak Industrial, $100.73 via Stripe)
showed an empty "Quote Details" on `/quote/:id` even though payment, ShopWorks push (WO 142865)
and snapshot sync all worked.

**Root cause.** `/quote` + `/invoice` render line items from the `quote_items` table.
`storefront-quote-items.js` exists precisely because storefront carts once lived only in
quote_sessions JSON blobs and those pages showed "No items" — but the samples launch (2026-07-06)
deliberately skipped it (`colorConfigs: {}`, comment: "no junk quote_items rows"), because sample
carts aren't colorConfigs-shaped. The ShopWorks snapshot couldn't save the page either:
`_overlayQuoteFromShopWorks` only repaints rows that already exist — zero quote-side rows means
the synced SW lines render nowhere.

**Fix.** Samples branch in `buildStorefrontQuoteItems` (one row per `orderSettings.samples`
entry, `EmbellishmentType: 'blank'`, free samples as $0 `FREE sample —` rows; jest-locked in
`tests/unit/storefront-quote-items.test.js`). Backfilled SAM0819-8320's two rows via the proxy
using the same builder — live page verified rendering both, matching the SW snapshot 1:1.

**Prevention.**
- 🔑 **"This channel doesn't need X" must name every READER of X, not just the writer's needs.**
  The push reads OrderSettingsJSON, but /quote + /invoice read quote_items — the opt-out comment
  only considered the push.
- 🔑 The SW snapshot overlay is an OVERLAY, not a renderer — it can correct rows but never create
  them. Any quote with zero quote_items rows stays visually empty no matter how good the sync is.
- 🔑 Backfill through the SAME builder the code path now uses (require the module in a one-off
  script), so the repaired row and future rows are identical by construction.

---

## Heroku git push needs a `global`-scoped token — `write` fails as "repository not found" (2026-08-19)

**Problem.** Replacing the rolling ~14-day CLI session token with a long-lived authorization so
deploys survive a vacation. Minted it least-privilege (`-s write`) and pointed the
`git.heroku.com` credential helper at it. Every git operation then died with
`remote: ! Couldn't find that user.` → `fatal: repository '…/sanmar-inventory-app.git/' not
found` — which reads like a deleted app or a wrong remote URL, not an auth problem.

**Root cause.** Heroku's git endpoint accepts **only `global`-scope tokens**. A `write`-scoped
token authenticates perfectly against the *API* (`heroku authorizations`, `releases`, `ps` all
work), so every check short of an actual git operation says the token is fine. The git rejection
is reported as a missing repository and never mentions scope.

**Solution.** Mint with the default (global) scope. Least privilege is not available here —
`write` is not a narrower version of what git needs, it simply does not work. Wired
2026-08-19: authorization `NWCA git deploy (1yr)`, stored at `~/.heroku-deploy-token` (ACL
owner-only), read directly by the `git.heroku.com` credential helper. ⏭️ **Renew before
2027-08-19.** Full setup + recreate commands: `.claude/skills/deploy/SKILL.md` § Heroku CLI v11
git auth.

**Prevention.**
- 🔑 **Verify any Heroku credential change with a no-op `git push heroku main`.** When main is
  already pushed it prints `Everything up-to-date` *after* completing the full auth handshake —
  a zero-effect test of the exact path `/deploy` Step 12 uses. Catching this cost one no-op push
  instead of a failed deploy at Step 12.
- 🔑 **`Couldn't find that user` / `repository not found` from `git.heroku.com` means token
  SCOPE**, not a bad remote. Confirm with `heroku authorizations --json` → `.scope`.
- 🔑 **The CLI session token rolls forward on every heroku command** — `updated_at` refreshes and
  the ~14-day window restarts, so routine deploys keep it alive indefinitely. The
  `token will expire` warning is a *back-from-vacation* trap (14 idle days), not a countdown.
  Read expiry from `.access_token.expires_in`; the top-level `expires_in` is always null and
  makes every token look permanent.
- ⚠️ A long-lived token belongs in the **git credential helper only**, not `HEROKU_API_KEY`.
  The env var overrides the CLI session globally, so `heroku login`/`logout` stop controlling
  auth — a second layer of exactly the confusion the v11 git-auth bug already cost 5 rounds on.

## A <script> tag pointing at a file deleted 11 months ago (2026-08-19)

**Problem.** `calculators/dtf-pricing.html` loaded `/product-url-handler.js`, deleted in
`a2a4027f` on 2025-09-27. Every visit to the DTF pricing page 404'd on it for ~11 months.

**Root cause.** The cleanup removed the file without grepping HTML for references, and nothing
fails loudly: a missing `<script src>` is a 404 in the network tab and an empty console.

**Solution.** Deleted the tag. The page never needed it — zero occurrences of
`style-search-input` or `loadProductDetails` (all the handler touches), and it parses
`StyleNumber`/`COLOR` itself in 8 places.

**Prevention.**
- 🔑 **`scripts/build.js` is the detector**: it prints `[build] missing on disk, tag left
  untouched: <path>`. That line is the only signal and it scrolls past in Heroku build output —
  grep the deploy's build log for `missing on disk`.
- ⚠️ **CLAUDE.md already requires grepping for a filename on delete** — this is the cost of
  skipping it: the reference outlived the file by 11 months.

---

## A version counter that hands out numbers already in use (2026-08-18)

**Problem.** `/deploy` Step 1 picked a version BELOW one already in use, twice in one day. On
v2026.08.18.4 it proposed `.2` while `product.html` already carried `?v=2026.08.18.3`; on
v2026.08.18.5 it proposed `.3` while tag `v2026.08.18.4` existed. Both were caught by hand
mid-deploy; neither would have failed a gate.

**Root cause.** `N=$(git tag -l "v${TODAY}.*" | wc -l) + 1` — a **count**, used to answer "what
is the next unused version". A count is only equal to max+1 when the day's numbers are dense AND
tags are the sole record of them. Neither holds: a hand-bumped `?v=` in HTML claims a version
with no tag behind it, and a skipped/abandoned tag number leaves a hole the count silently
reuses.

**Solution.** Step 1 now takes `max(highest tag today, highest ?v= in HTML today) + 1`
(`.claude/skills/deploy/SKILL.md` Step 1). Both incident states replayed against the new formula
return `.4` and `.5` — the values chosen by hand — where `count+1` returns `.2` and `.3`.

**Prevention.**
- 🔴 **Next-id = max-in-use + 1, never count.** They diverge the instant a number is skipped or
  claimed outside the list you're counting. This applies to any allocator, not just this one.
- 🔑 **A version lives in two places, so read both.** Tags are the record of releases; `?v=` in
  HTML is the record of what a browser was told to fetch. A hand-bump writes the second without
  the first, so a tags-only read is blind to it.
- ⚠️ **Both failures are silent by construction.** A low version makes Step 2 rewrite a live
  `?v=` *backwards* — browsers holding the newer value never refetch, so reps run old pricing
  code against a new server — and it puts `git tag` out of order, so the next release's
  `git describe --tags` baseline is wrong and its CHANGELOG re-lists shipped commits. Nothing
  errors. Sparse tag numbers are normal; dense ones were never a goal.
- 🔑 **Step 2's cache-bust is a no-op on the ~125 pages in `lib/hashed-pages.js`** (all 4 quote
  builders, index, product, catalog, every `custom-*`, all dashboards, all calculators).
  `scripts/build.js` rewrites their refs to content-hashed `/dist/…<hash>.js` at build time, so
  the `?v=` never reaches a browser. Verified 2026-08-18: all 25 `/dist/` refs on the live PDP
  reproduce byte-identically from a local rebuild of `origin/main`. The `?v=` path still governs
  every page NOT on that list.

---

## A dependency bump that passes all five gates and takes the whole site down (2026-08-18)

**Problem.** Dependabot PR #27 (`marked` 12.0.2 → 18.0.9) sat open looking ordinary. Merging it
would have produced **H10 on every page** — all customer storefronts and pricing pages, not a
degraded blog — and every check in the repo says it is fine.

**Root cause.** `marked` went **ESM-only at v13**. `lib/blog.js:17` is CommonJS
(`const { marked } = require('marked')`), so v18 throws `ERR_REQUIRE_ESM` at require time. That
is not contained to the blog: `server.js:4747` does `require('./lib/blog')` at module load, so
the failure happens before the server listens and the process never starts.

**Solution.** Closed the PR and added an `ignore` for `marked` majors in `.github/dependabot.yml`
(`a4e84360`) naming the unblock condition, so it cannot be re-proposed until `lib/blog.js` moves
to ESM or a dynamic `import()`. Minor/patch of v12 still flow.

**Prevention.**
- 🔴 **Measured with `marked@18` actually installed: lint ✅ typecheck ✅ test:unit (125 suites /
  2613 tests) ✅ test:dom ✅ test:a11y ✅ — and the server does not boot.** No test loads
  `lib/blog.js`. A green suite is evidence about the code the suite imports and nothing else.
- 🔑 **The deploy skill's Step 3.6b boot probe is the only gate that caught it**, and only because
  it actually starts the server rather than parsing it. `node --check` passes too — syntax is
  fine, the failure is at require time. This is the second incident that gate has justified
  (first: the 2026-07-19 `Cannot find module` outage). **Never route around it.**
- 🔴 **A module required at server boot has no blast radius of its own** — it inherits the whole
  app's. Before upgrading anything under `lib/`, check whether `server.js` requires it at load:
  `grep -n "require('./lib/<name>')" server.js`. If yes, a bad bump is a total outage, not a
  broken feature.
- 🔑 **CJS→ESM is invisible to semver reasoning.** "It's only used in 3 places, all stable API"
  was true here and completely irrelevant — the break was in how the package is *loaded*, not
  what it exposes. For any major bump, `require()` the package once before reading changelogs.
- ⚠️ **A dependabot PR's red checks may be about nothing.** #24–27 were based on a commit **178
  behind develop**, from before CI was fixed on 2026-08-18, so their ESLint/tsc/E2E failures were
  inherited from the two-week-red CI. Check `baseRefOid`'s date before believing — or dismissing —
  a bot PR's status, in both directions: #27's checks were *falsely red*, and its unit tests were
  *truthfully green* on a build that could not start.
- 🔑 `sharp` was a direct dependency nothing imported (no `require`, no script, root-only in the
  lockfile) — shipping native libvips binaries on every install and Heroku build. Removing a dead
  dep beats upgrading it; check `grep -rl "require('<pkg>')"` before accepting any bump.

---
