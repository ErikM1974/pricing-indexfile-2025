# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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
## Gating a proxy route breaks every caller that never sent the secret (2026-08-17)

**Problem.** Slack fired `Quote→ShopWorks sync unhealthy / sync-errors+sync-noop` every hour.
The cron was running fine; every row it touched failed — `errors == candidates`, `synced: 0`.
ShopWorks snapshots had been frozen on EVERY quote for a week: not just the cron, but
quote-management's "Sync all", quote-view's page-load auto-sync and manual refresh, and
`pages/js/invoice.js`, which all call the same endpoint.

**Root cause.** Proxy `191c906` (2026-08-10 09:35 PT, "Gate the ManageOrders PII reads") added
`app.use('/api/manageorders/order', requireCrmApiSecret)`. That prefix covers `/order/:id/snapshot`,
and the fetch in `sync-from-shopworks` (`server.js` ~12770) was **the one proxy call in the whole
file sending no `X-CRM-API-Secret`**. Every sync 401'd; the handler turns that into a 502.

**Solution.** Send the secret, guarded like every other proxy call in the file, and `console.warn`
the non-OK response. Shipped `v2026.08.17.4` (Heroku v1866). Verified in prod: OF-0061/OF-0062 now
return `synced:true, status:Imported` with real snapshots, health is `ok:true, reason:null`.

**Prevention.**
- 🔴 **A gate lands on a PREFIX; the blast radius is every caller of every route under it.** The
  commit gated six prefixes and its message reasoned carefully about `/customers` (2 callers,
  correctly deployed app-first). `/order` got one line and no caller audit — and it had a caller.
  Before gating a prefix, grep all three repos for the prefix, not for the route you had in mind.
- 🔑 **The odd one out is the bug.** `server.js` sends `X-CRM-API-Secret` on ~80 proxy calls and
  omitted it on exactly one. `grep -c` the header against the count of `SYNC_PROXY_BASE`/
  `CRM_API_BASE` fetches — a single unauthenticated straggler is findable in one command, and is
  a live outage waiting for someone to gate its route.
- 🔴 **A 502 return path that logs nothing hides the outage completely.** `grep bulk-sync` showed
  only the summary line; there were ZERO `[sync-from-shopworks]` entries, so the logs looked like
  the sync wasn't even reaching the handler. Erik's #1 rule applies to SERVER logs too, not just
  customer-facing banners: every early `return res.status(5xx)` needs a `console.warn` naming the
  quote and the upstream status.
- 🔑 **Fast failure is a fingerprint.** 3 candidates in 3.2s with a 1s throttle each = ~0ms of real
  work per row. A run whose elapsed time is exactly its own throttle never talked to upstream.
- 🔑 The watchdog earned its keep — it caught a silent no-op within the hour and named it precisely
  (`sync-errors+sync-noop`). What it could NOT do is say WHICH quote or WHY: `recordQuoteSyncRun()`
  drops `errorDetails`. Worth carrying the first error string into the health payload.
- ⚠️ **Deploy left the repo on `main` with `develop` 2 commits behind** (a prior run's Step 16
  never completed), and a concurrent session moved the branch mid-diagnosis. In this shared
  OneDrive checkout, re-read `git branch --show-current` immediately before staging — never trust
  the branch you saw one command ago.

---
## Four silent pricing fallbacks, and the one that was never read (2026-08-17)

**Problem.** Four places substituted a hardcoded price with nothing on screen:
`getServicePrice()` returned its fallback silently when the Service_Codes map had loaded but the
row was missing; `fetchRoundingRules()`'s catch set `CeilDollar`; the DTG engine synthesised a
`24-47` tier with `LTM_Fee: 0`; and `calculators/embroidery-pricing.html` hardcoded `LTM_FEE = 50`.

**Root cause.** Every one had a *warning mechanism already available* and simply wasn't wired to it
— `warnIfServiceCodeMissing` existed and was called at ~4 of ~20 sites; `showFallbackPricingWarning`
existed; the DTG tier even set `_fallback: true`, and **nothing in the repo has ever read that flag**.
The gap was never "we didn't know how to warn", it was that the warning lived at the CALL SITE, so
every new caller silently opted out.

**Fix.** Warn INSIDE `getServicePrice` — one place, every caller covered by construction, including
future ones. `_fallback` surfaced at the DTG consumer (the engine file is byte-locked to the proxy,
so the fix belongs at the reader). Rounding flip sets a sticky `_roundingFallbackUsed`, toasted and
returned. The calculator reads `LTM_Fee` off the tier row carrying a non-zero fee — matching on the
FEE not a `'1-7'` label, so a Caspio re-band keeps working.

**Prevention.**
- 🔴 **Put the warning where the substitution happens, not where it's consumed.** A per-call-site
  warning is a rule you have to remember; a warning inside the function is one you cannot forget.
- 🔴 **A flag nobody reads is not a warning.** `_fallback: true` looked like diligence for months.
  Grep for a READER before believing a flag protects anything.
- 🔑 **`null` can be load-bearing.** `roundingMethod = null` MEANS half-dollar; the "harmless
  default" in the catch was a whole-dollar flip worth $0.49/pc. Check what a default actually does
  before calling a fallback safe.
- 🔑 **Node 18 has native `fetch`, so `tests/setup.js`'s stub never installs.** Two new tests
  silently hit the LIVE proxy (449 ms) and asserted the wrong thing — `/api/pricing-rules` answered
  `HalfDollarCeil_Final`, so the catch never ran. Stub `global.fetch` per test; a slow unit test is
  the tell.
- 🔑 Mutation-tested: reverting `getServicePrice` to the silent version fails 3 of 7 new tests.

---

## The staff quote builders were on the open internet, and a review found it (2026-08-17)

**Problem.** `https://www.teamnwca.com/quote-builders/embroidery-quote-builder.html` returned the
fully working staff tool to anyone — customer search, pricing table, ShopWorks import/export.
Separately, `admin/universal-records-admin.html` and the PUBLIC homepage (`catalog-search.js`)
rendered untrusted data into `innerHTML` unescaped.

**Root cause.** `app.use('/quote-builders', express.static(...))` sat between `/dashboards` and
`/vendor-portals` — **both gated** — and was simply never given a gate. Nothing detects a *missing*
`app.use`; the neighbours looked right, so review kept passing over it. `staff-auth-helper.js` made
it *look* protected, but it is a sessionStorage rep-name autofill, not authentication. The XSS side
had the same shape: `eslint.config.mjs` already enables `no-unsanitized` with `escapeHTML`
registered as a sanitizer — it never fired because **ESLint cannot see inside an HTML file**, and
the admin page keeps 60 KB of inline script.

**Fix.** `app.use('/quote-builders', gateStaffHtml)` **above** the `/quote-builders/:page` route
(not next to the static mount — Express matches in registration order, so a gate by the mount is
bypassed by the earlier route). The four ROOT aliases (`/embroidery-quote-builder.html` etc.) are
separate routes and needed their own `gateStaffPage`. Escaped every API-derived interpolation in
both files and replaced all inline `onclick`/`onchange`/`onsubmit` carrying data with `data-*` +
delegated listeners.

**Prevention.**
- 🔴 **A missing gate is invisible; only an inventory finds it.** Nothing greps for "the `app.use`
  that isn't there." The durable fix is a jest manifest test asserting every route declares a
  posture (`public` / `staff` / `page:x.html`), so a NEW route fails CI until classified. Reviewing
  the gates that exist will never find the one that doesn't.
- 🔴 **Escaping does NOT protect an inline event handler.** The HTML parser decodes entities BEFORE
  the JS is parsed, so `onclick="f('&#39;')"` still breaks out. `catalog-search.js` had already
  half-learned this — it escaped quotes *for the onclick* and left the HTML context open. Two
  contexts, two different rules: use `data-*` + delegation and the second context disappears.
- 🔴 **Escape BEFORE transforming, not after.** `Notes.replace(/\n/g,'<br>')` must be
  `escapeHtml(Notes).replace(...)` — escaping afterwards would neutralise the `<br>` you just added,
  and escaping first is the only order that is both safe and correct.
- 🔑 **Assets are content-hashed — an unverified fix is an unshipped fix.** The first browser check
  showed the payload STILL firing: `dist/` was serving the pre-edit file. `npm run build` is part of
  verifying, not just deploying. The network log is the proof (a live `GET /x` from the injected
  `<img src=x>` before, gone after).
- 🔑 **Gating a page does not gate its data.** These builders write to the proxy DIRECTLY
  (`APP_CONFIG.API.BASE_URL` is the proxy host), and proxy `quoteWriteOnly` is a rate limiter, not
  auth. The page gate is step one of two.

---
