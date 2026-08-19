# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

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

## A release that reached GitHub but never reached Heroku, and nothing noticed for 9 hours (2026-08-18)

**Problem.** `develop`, `main`, `origin/develop` and `origin/main` were all clean and identical at
`a30c4c10` (v2026.08.18.4) — every signal a human checks said "shipped". Production was serving
`42039b7c` (v2026.08.18.1), nine hours stale. Customers were missing the whole PR #30 PDP change:
unpriceable placement chips still rendering, price table still collapsed, small-order fee still a
footnote instead of a charge.

**Root cause.** A `/deploy` run stopped partway. Steps 8–9 (release merge, CHANGELOG) and Step 11's
`git push origin main` all completed, so GitHub looked finished. **Step 10 (`git tag`) and Step 12
(`git push heroku main`) never ran** — `v2026.08.18.4` did not exist as a tag anywhere, local or
remote. There is no gate at the END of the skill that asserts the deploy actually landed, so a run
that dies after the GitHub push is indistinguishable from a successful one by every branch-level check.

**Solution.** Re-entered at the missing steps rather than re-running `/deploy`: created the absent
tag from `v2026.08.18.1..main`, pushed it, `git push heroku main` → Heroku v1874, verified. Running
the skill from the top would have minted an **empty** v2026.08.18.5 (0 commits `develop..main`) with
a garbage CHANGELOG entry.

**Prevention.**
- 🔴 **`origin/main` being current is NOT evidence production is current.** They are separate pushes
  to separate remotes and only one of them is the deploy. The authoritative check is one command:
  `git rev-list --left-right --count heroku/main...origin/main` after `git fetch --all` — any
  non-zero right-hand number means undeployed code sits on `main`. `heroku releases -n 1` names the
  deployed SHA directly and agrees.
- 🔴 **A missing tag is the cheapest tripwire for a half-finished deploy.** `git tag -l "v$(date
  +%Y.%m.%d).*"` disagreeing with the newest `Release v…` commit subject on `main` means a run died
  between Step 9 and Step 12. Worth a Step 0 pre-flight in the skill: refuse to start when the tip
  of `main` is a `Release v…`/`Changelog v…` commit whose tag doesn't exist.
- 🔑 **When a deploy is already partly done, resume it — do not restart it.** `/deploy` assumes
  `develop` has unreleased work. With `develop == main` it produces an empty release: an empty
  `--no-ff` merge, a CHANGELOG heading with no commits, and a version number burned for nothing.
  Check `git rev-list --count main..develop` before invoking the skill; if it's 0 the only thing
  missing is downstream of the merge.
- 🔑 **Verify a frontend deploy on asset BYTES, not on the version string.** Assets are
  content-hashed into `/dist/…<hash>.js`, so the `?v=` in the HTML source never appears in the
  served page and the skill's Step 14b `?v=` check silently finds nothing. What works: pick an
  identifier that exists only in the new code (here `pdp-cfg-fee-note`, `tier-fee-label`), curl the
  live hashed bundle, and grep. It went 0 → 1 across the deploy, and the bundle hash moved
  `a04fe3cc39` → `11582a8bd6`. ⚠️ Minification changes case and mangles locals — pick markers from
  string literals and CSS class names, never from variable names.
- ⚠️ This is the **second** deploy in two days to leave the repo mid-flight (see the archived
  2026-08-17 entry: Step 16 never completed, leaving the checkout on `main` with `develop` behind).
  The skill has no crash-recovery story; when one is interrupted, assume nothing after the failure
  point ran and verify each remaining step by hand.

---

## Dead placement chips: a chip row that never asked which methods were eligible (2026-08-18)

**Problem.** On `product.html?style=CT103828` (Carhartt Duck Detroit Jacket) the customer
configurator offered six placement chips, but three of them — Center front, Full front, Center
back — could never return a price. Tapping one produced only "not available for this placement".
Not a Carhartt edge case: it hit **every** product in the embroidery-only categories (Workwear,
Outerwear, Woven Shirts, Bags, Accessories).

**Root cause.** Two independent gates that never talked to each other. `getEligibility()` filters
which METHODS render (Q3) from the Caspio-backed `/api/decoration-methods` rules; but
`currentLocations()` returned the hardcoded `GARMENT_LOCATIONS` array wholesale, with no reference
to `state.methods` or any method's `supports` map. `METHODS.emb.supports` has `fullFront: false`
and omits `centerFront`/`centerBack` entirely (those are DTF-only keys) — so on an EMB-only
product half the chip row was decorative. The dead-end state was well-built and visible, which is
exactly why nobody noticed the chips should never have rendered at all.

**Fix.** `currentLocations()` (`product/js/pdp-configurator.js:654`) now intersects the location
list with the union of `supports` across the eligible methods, with a defensive fall-back to the
full list if the intersection is ever empty. `init()` re-seats `state.loc` onto a surviving chip.
Zero backend work — the data to compute this was already on the page. Same commit made the tier
matrix render open by default (`state.matrixOpen`, `product.html:287`).

**Follow-up (same day).** With the table now the first thing a customer reads, its two cheapest
columns were indistinguishable: EMB `1-7` and `8-23` are BOTH $177.50 (same Caspio
`EmbroideryCost` of $18.00), so the `$50` small-order fee was the entire difference — and it
rendered as a plain row whose other cells were bare em dashes. Fixed by styling the cell
CONTENTS (fee pill + explicit "No fee") rather than the row background, so it never fights
`.tier-table .is-active-tier` for the column the customer is actually in, plus a note derived
from the ladder itself that names the threshold and states the identical-price fact only when
it is literally true of that ladder.

**Prevention.**
- 🔑 **An em dash reads as "no data", not "you don't pay this".** In any table where a row means
  a charge, spell the absence out.
- 🔴 **When two gates narrow the same UI, one must consume the other's output.** Eligibility drove
  the method chips but not the placement chips; nothing in the code linked them, so they drifted
  the moment a method with narrower `supports` became the only eligible one.
- 🔑 A well-built "not available" state can *mask* a bug. The empty/unavailable path being correct
  and visible is not evidence the option should have been offered.
- 🔑 `tests/dom/pdp-placement-chips.test.js` slices the fixture out of the REAL `product.html`, so
  the markup's default state is locked too — a revert in the HTML alone fails the suite. Both
  halves were mutation-tested (filter revert → 2 failures; matrix revert → 3).

---

## A security gate broke the E2E harness, and CI stayed red for two weeks (2026-08-18)

**Problem.** Every CI run on `main` from 2026-08-05 to 2026-08-18 — 60+ consecutive runs — failed,
and 10 releases shipped over the top of it. Three of four jobs were red: ESLint (1 error),
`tsc checkJs` (15 errors), and Playwright E2E (10 failures, including every money-path spec and
the DTF "zero locations must block save" guard).

**Root cause.** Three unrelated breaks, none of which could block a deploy:
- **E2E** — `fb2cb4a5` ("Security: gate /quote-builders") added `app.use('/quote-builders',
  gateStaffHtml)` at `server.js:4905`. CI has no SAML config, so every builder page answered
  `302 → /auth/saml/login → 503 "Staff SSO is not configured yet."` All 6 money specs died on
  `waitForSelector('#product-search')` and the 4 axe specs scanned a 503 shell. **The gate was
  right; the harness was what went stale.**
- **ESLint** — `AbortController` was missing from the hand-maintained `globals` allowlist in
  `eslint.config.mjs`, so `lib/product-seo.js` tripped `no-undef` from v2026.08.10.9.
- **tsc** — five undeclared `window.*` bridges (`boxUrl`, `vendorLabel`, …) plus four loose
  casts; all extraction debt that no gate was looking at.
- 🔴 **Why nobody noticed for two weeks:** the `/deploy` skill's test gate runs `npm run test:unit`
  ONLY. Lint, typecheck and E2E exist exclusively as CI jobs, and CI runs on `pull_request` +
  push to develop/main — so a red `main` never blocked the next release. Green deploys, red CI,
  no contradiction.

**Fix.** `tests/e2e/staff-session.js` mints a real signed `nwca_staff` cookie with the same
cookie-session/Keygrip primitives the server verifies with, under a secret pinned in
`playwright.config.js`; specs run authenticated via `use.storageState`. `AbortController` added to
the eslint globals; the five window bridges declared in `types/globals.d.ts`; the four casts
pinned. Lint, typecheck, unit (125 suites) and DOM (10 suites) all green.

**Prevention.**
- 🔴 **A gate added to a page prefix breaks every headless caller of that prefix.** Grep
  `tests/` for the path before shipping the gate — the E2E harness is a caller too.
- 🔴 **NEVER open a `NODE_ENV==='test'` hole in an auth gate to make tests pass.** Sign a real
  cookie the way a real browser would; a gate with a test-shaped hole is one env-var mistake
  away from being no gate at all.
- 🔑 **"Deploy is green" is not "CI is green."** The deploy gate was a strict subset of CI.
  Widened 2026-08-18: `/deploy` step 0.6 now runs lint + typecheck + unit + dom + a11y (~23s,
  measured), and step 0.7 reads CI's own verdict for the E2E job it can't reproduce.
- 🔑 **A blind ratchet doesn't hold the line, it just stops reporting.** With the axe specs
  scanning a 503 shell, a real contrast regression shipped and sat there: DTG's `.daf-sub` /
  `.daf-note` were slate-400 `#94a3b8` on `#f8fafc` = **2.45:1** against a 4.5:1 requirement
  (landed v2026.08.10.9, `shared_components/css/dtg-inline-form.css`). Fixed to slate-500
  `#64748b` (4.55 / 4.51 on the two card backgrounds) — **never "fix" a ratchet by raising its
  baseline**; the baseline only ever drops.
- 🔑 **A CSS block copied between builders drifts silently.** `dtg-inline-form.css` carries a
  copy of the `.order-recap` / `.ship-to-card` shell (DTG doesn't load `quote-builder-common.css`).
  The shared file darkened those four labels #94a3b8→#64748b on **2026-06-10** for WCAG AA; the
  DTG copy never got it and shipped 2.56:1 text for two months. Swept 2026-08-18 across all
  builder CSS (26 sites). ⚠️ Contrast is **background-specific**: slate-500 is 4.55 on #f8fafc
  but only 4.34 on #f1f5f9 and 3.86 on #e2e8f0 — two selectors needed slate-600 instead.
  Not swept, deliberately: borders, decorative backgrounds, `:disabled` controls (WCAG 1.4.3
  exempts inactive components) and `@media print` blocks.
