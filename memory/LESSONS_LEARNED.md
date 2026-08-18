# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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

---

## A fillable PDF that opens BLANK, and a Caspio 502 that was really a length cap (2026-08-17)

**Problem.** Adding the Business Credit Application (No Personal Guaranty) to the Forms Library
turned up two traps. ① The source PDF's 34 AcroForm fields each had their own `/DA`, but the
AcroForm carried **no `/NeedAppearances`** — so a viewer that doesn't regenerate appearance
streams renders the stale EMPTY ones. The customer types, signs, emails it back, and the copy we
open looks blank. ② `POST /api/forms-library` returned an opaque **502 "Forms library create
failed"** — which reads like Caspio being down, or a bad secret.

**Root cause.** ① `/NeedAppearances` is the flag that tells a viewer "regenerate the field
appearance on edit"; without it the widget's pre-baked (empty) `/AP` is what gets drawn and saved.
Nothing warns you — it looks perfect in the viewer you happen to test in. ② The `Description`
column has a length cap. **284 chars → 502; 188 chars → 201.** The route wraps every Caspio error
as one generic 502, so a field-length rejection is indistinguishable from an outage or an auth
failure.

**Fix.** ① Set `/NeedAppearances = true` (plus a form-level `/DA` fallback) on the copy committed
to `/forms/` — `forms/business-credit-application-no-personal-guaranty.pdf`, shipped
`v2026.08.17.7`. ② Shortened the Description to 188 chars; row created, live under Payments
(Sort_Order 33).

**Prevention.**
- 🔴 **A fillable PDF is not verified until you check `/NeedAppearances`.** Any PDF landing in
  `/forms/` that customers or staff TYPE INTO gets the flag set before commit. This is the same
  shape as Erik's #1 rule: the failure is silent and looks like success — blank fields read as
  "they forgot to fill it in", not "our PDF ate their answers".
- 🔑 **Re-open the written copy and count the fields.** `PdfWriter` can silently drop the
  AcroForm; assert pages + field-name set + editability against the source, then curl the SERVED
  file and re-parse it (the byte count matching the file on disk is the cheap version).
- 🔴 **`Forms_Library.Description` is capped — keep it ≤ 200 chars**, in line with the longest
  existing row (203). Over-length surfaces as a generic 502, never as a validation message.
- 🔑 **Order matters: deploy the PDF BEFORE adding the registry row.** The row goes live within
  the route's 60 s cache, so a row added first puts a Download button pointing at a 404 in front of
  every staff member. (Escape hatch if you can't deploy yet: create it `Is_Active = No` — the GET
  filters to `Yes` — then PUT it to `Yes` after.)
- ⚠️ **`io.open(path,'w')` TRUNCATES before it writes** — a `UnicodeEncodeError` mid-write left
  ACTIVE_FILES.md at 0 bytes (recovered with `git checkout --`). Build the full string, write a
  temp file, verify its size, then `os.replace`. Also: this repo's markdown is **CRLF**, and
  LESSONS/MEMORY carry a **BOM** — an LF-only anchor match silently finds nothing.

**Follow-up the same day — Erik asked for the form to be staff-only, and the first gate leaked.**
`/forms` is a PUBLIC `express.static` mount, so gating one file meant a middleware above it.
The obvious version compared `req.path` to the filename with string equality and looked right.
It was measured serving the **complete PDF, 200 and anonymous**, to `/forms/<file>.pdf::$DATA` —
Win32 opens a file's default NTFS data stream under that name, so serve-static returned all
321,188 bytes while the gate saw a string it didn't recognise. Fix: canonicalise to a BARE
FILENAME (basename → cut at `:` → strip trailing dots/spaces), never compare the raw path.
Live `v2026.08.17.8`, verified anonymously in prod across 5 URL shapes.
- 🔴 **A path gate must collapse every spelling that resolves to the same file.** serve-static
  resolves the path its own way; anything the gate normalises differently is a bypass. Dot-segments
  (`/forms/x/../f.pdf`) are the shape that applies on Linux, where prod runs — `::$DATA` is Win32-only
  but defended anyway, because "it happens to hold on this OS" is not a security property.
- 🔑 **Test the gate from BOTH sides.** Over-gating is a real failure here: the handbook and the
  meal-period waiver are opened by signed-OUT employees, and bouncing them into staff SSO they can't
  complete would be the same size of bug. `forms-staff-only.test.js` walks every PDF on disk.
- 🔑 **Probe the running server, don't reason about the router.** Whether Express normalises `..`
  before routing decided the whole design; one curl battery answered it in seconds, and it is what
  turned up `::$DATA`, which no amount of reading the code would have.
- 🔴 **"Nothing links to it" from a REPO grep is not evidence — half this site's content lives in
  Caspio.** I called `forms/policies/credit-card-authorization.pdf` orphaned on a repo grep and told Erik
  so. Grepping `Body_HTML` across all 142 live policies (`/api/policies-public/<id>`, ~142 calls) found the
  **Credit Card SOP** linking it, on a hub page that is anonymously reachable. ⚠️ `/api/policies-public/search`
  and the tree's `Body_Plain` BOTH strip markup — `q=href` returns 0 — so neither can see a URL in an
  attribute. Before changing who can reach a file, grep the CMS, and sanity-check the search index first.

---

## Two silent no-ops in the quote sync: '' IS NOT NULL, and a clock read in the wrong zone (2026-08-17)

**Problem.** Both were found while fixing the Aug 10-17 sync outage, and neither had ever
shown a symptom. ① The proxy's `syncCandidates=true` filter returned **9 of 9** non-cancelled
rows, so the hourly cron synced a `Status='Web Quote Request'` quote with no WO# forever. ②
`ShopWorks_Last_Synced` was **written UTC and read Pacific**, so a just-synced row parsed ~7-8 h
in the FUTURE, `now - lastSynced` went NEGATIVE, and the 30-minute staleness test could not fire
— the hourly re-sync was really running ~3x/day.

**Root cause.** ① Caspio stores an unset column as an **EMPTY STRING**, and `'' IS NOT NULL`, so
`(Status='Processed' OR PushedToShopWorks IS NOT NULL)` matched everything and the OR swallowed
the Status test. Only 1 of the 9 rows had a real `PushedToShopWorks`. ② `nowPacificNaiveIso()`
already existed in `server.js` and the sync handler simply didn't use it.

**Solution.** ① `PushedToShopWorks<>''` **plus** `ShopWorks_Order_Number>0`; proxy `v2026.08.17.1`
(Heroku v1088), verified live 9→8. ② `nowIso = nowPacificNaiveIso()`; app `v2026.08.17.5`
(Heroku v1867), verified live: stored `05:55:52` vs Pacific-now `05:56:05`, exactly 7 h behind UTC.

**Prevention.**
- 🔴 **In Caspio, `IS NOT NULL` does NOT mean "has a value".** Unset text columns come back as
  `''`. Any "was this ever stamped?" predicate needs `AND col<>''`, and a bare `IS NOT NULL`
  inside an `OR` silently promotes the whole clause to `TRUE`. Check the other named filters
  before trusting one.
- 🔴 **Tightening an over-matching filter can silently DROP real work.** Two DTG rows sat at
  `Status='Accepted'` with an empty `PushedToShopWorks` but a REAL WO# — they were being synced
  *only because of the bug*. The obvious one-line fix would have stopped their deletion detection
  and the ShipStation cancel-cascade with no error anywhere. **Before narrowing a predicate, dump
  what it currently matches and account for EVERY row you are about to exclude.**
- 🔑 **`toContain()` cannot see a MISSING conjunct.** The jest lock asserted
  `toContain('PushedToShopWorks IS NOT NULL')`, which passes with or without the `<>''` half. A
  substring assertion tests presence, never sufficiency — assert the part that carries the meaning.
- 🔴 **A timestamp has no type.** Nothing failed, nothing logged; the only tell was a cadence
  nobody was measuring. **When a column is written in one place and read in another, the writer
  and reader must name the same zone out loud** — and the fix belongs in the WRITER when every
  reader already agrees. The June "Purges in 31 days" patch fixed the *reader* on the dashboard;
  the reader had been right all along.
- 🔑 The regression test **parses both functions out of the shipped `server.js` and round-trips
  them**, with a negative control that re-creates the old writer and asserts the skew is still
  6.5-8.5 h. A source-grep for the call would pass whether or not the two agree.
- ⚠️ **The proxy caches `quote_sessions` reads** — a verification GET without `&refresh=true`
  returned the PRE-fix row and read as "not fixed". Always add `refresh=true` when checking a write.

---
