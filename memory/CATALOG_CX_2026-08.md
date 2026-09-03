# Catalog CX overhaul — state at 2026-08-25 laptop-shutdown stopping point

**Goal (Erik):** best customer experience on the main catalog — customers must FIND products
easily and be moved to BUY. Done when finding + buying is easy.

## ✅ Done

### 1. Root cause of "customers can't find things": catalog search was 10–22s PER TERM
- `/api/products/search?q=` ran five `LIKE '%term%'` scans (incl. PRODUCT_DESCRIPTION) + a
  groupBy over the **181,104-row** `Sanmar_Bulk_251816_Feb2024` table per uncached term.
  Measured live: hoodie 21s · polo 16s · tshirt 18s · "safety green" 10s. Repeats cache (~0.4s),
  but autocomplete fires ONE UNCACHED TERM PER KEYSTROKE → customers effectively never saw
  results ("Searching…" forever, observed live).
- **Fix implemented + committed: proxy `ddbf2e6` on develop — NOT DEPLOYED.**
  `src/utils/style-search-index.js`: one grouped fetch of the ~4,513 distinct styles (30-min TTL,
  stale-while-revalidate), searched in memory (~2ms), handed to Caspio as `STYLE IN (top 300
  ranked)`. Same five fields, same phrase semantics. Rank: exact style > style prefix > style
  substr > title > brand > keywords/desc (cap cuts desc-tier noise first — a relevance
  improvement for broad terms). No match → `STYLE='__NO_MATCH__'` keeps pipeline/response shape.
  Jest lock: `tests/jest/style-search-index.test.js` (11 tests, green).
- **Verified locally** (proxy on :3002): builds 4,513 styles from 5,039 grouped rows; first-page
  parity with production on hoodie/polo/carhartt/beanie/PC54; never-seen terms 0.1–0.7s, broad
  keyword terms worst ~4s (vs 10–22s).
- 🔴 **Two traps hit + hardened** (now in code comments): (a) paging a Caspio groupBy WITHOUT
  `q.orderBy` silently skipped ~420 styles — `q.orderBy: STYLE` added; (b) `strict: true` on the
  fetch so a truncated build throws and keeps the stale index instead of silently hiding products.

### 2. Live customer walk of /catalog (findings list — mostly NOT yet fixed)
- 🔴 **Cold landing = alphabetical "A4" brand wall.** Default sort name_asc over 12,413 rows —
  first screen is entirely obscure A4 athleticwear. Needs top-sellers/curated-first landing.
- 🔴 **Price whiplash:** card + Quick View say "from $34.50 with logo" (CTA205) = the hidden
  **72+ tier**; PDP opens at $38.00 (24-pc default), $42 under 24. "from" needs qualification
  or the 24+ anchor.
- 🟡 "Showing 1–38 of **12,413 products**" — count is style×price-split groups; real distinct
  styles ≈ 3,400 active (4,513 incl. discontinued). Inflated + may confuse pagination.
- 🟡 Cold-cache landing spinner measured **28s** (proxy listing caches cold + Heroku dyno);
  warm ~0.6s. Index deploy + (optionally) listing warm-up will largely cure.
- 🟡 Known, still unfixed: Quick-View hardcodes `Math.ceil` (`catalog-search.js:1707`) vs
  API-driven `roundCapPrice` → $24.50 PDP vs $25.00 QV possible on caps (MEMORY.md Rule-9 item).
- ✅ Solid already: rich filter panel (category/brand/price/color/size with counts), shareable
  URLs (?category=Caps), live per-size stock on PDP, PDP price table + sticky CTA bar, mobile
  2-col grid no overflow, 44px tap targets.
- PDP has NO bridge to the pay-online express storefronts (/custom-tees, /custom-caps) for
  styles those channels sell — quote-only path shown even when buy-now exists.

### 3. Multi-lens audit workflow was MID-RUN at shutdown
- `catalog-cx-audit`, runId `wf_4fb7e80e-115` — 8 audit lenses (flow, pricing, layout, PDP,
  live data, CRO, IA, mobile/perf) → adversarial verify → synthesis (prioritized quick wins +
  layout proposal). Read-only, idempotent.
- Resume (same session): `Workflow({scriptPath:'<session>/workflows/scripts/catalog-cx-audit-wf_4fb7e80e-115.js', resumeFromRunId:'wf_4fb7e80e-115'})`.
  If the resume cache is gone, just re-run the script fresh — it audits, it doesn't mutate.

## ⏭️ Next steps on return (in order)
1. Resume/re-run the audit workflow → read synthesis.
2. **Proxy: add index warm-up at boot** (first search after a dyno restart currently pays the
   ~40s build; call `getStyleSearchIndex(fetchAllCaspioPages)` fire-and-forget after listen).
3. Deploy the proxy (Erik's go — no /deploy skill for proxy; it's git push heroku from that repo).
4. App-repo quick wins per synthesis: landing sort/curation, "from $" honesty, QV `Math.ceil`
   parity fix, count label. Then `/deploy` the app.
5. Bigger layout decisions → present proposal to Erik.

## ✅ 2026-08-26 continuation — quick wins IMPLEMENTED (both repos, committed + pushed, NOT deployed)

Audit workflow finished on resume: 19 agents, 10 confirmed critical/high, 0 refuted.
**App `b86320ef`** (all gates green, verified on built local server): server displayPriceLabel
everywhere the legacy engine priced (client formula DELETED — was +31% inflated + shirt-margin
caps) · cap QV rounding via API RoundingMethod + data-driven LTM notice · Richardson → PDP (no
more dead-end calculator) · QV links carry color · mega-menu/brands/breadcrumbs → /catalog (Back
button fixed) · style-token searches fall back to text results · no Discontinued suggestions ·
express deep links `?style=&color=` in BOTH storefront apps · Custom Hats in nav on
catalog/product/quote-cart · small card images + eager first row + runtime preconnect ·
visible boot-failure error · touch Quick View.
**Proxy `6353a32`+`a56902f`**: style-index warm-up at boot (verified: builds 4,513 styles, zero
requests, first search <2s) · decorated-cap-prices uses applyRounding (112: $23→$22.50, matches
PDP) · 'Newest' sort fixed (500'd every click — grouped orderBy needs MAX(Date_Updated) alias).

⏭️ NEXT: deploy PROXY first (git push heroku from proxy repo), then /deploy app; re-run Rule-9
parity checks after. ERIK DECISIONS pending: M-3 buy-online-bridge positioning (PDP two-lane),
M-4 default sort top-sellers-first (changes what the store leads with). Medium roadmap M-1..M-10
+ layout proposal ("one store, two checkouts") in the audit synthesis — full text:
session task file w3uc3z1aj.output; summarized in the CX plan artifact.

## 🚀 2026-08-25 (late) — BOTH DEPLOYS SHIPPED AND VERIFIED LIVE

- **Proxy `v2026.08.25.1`** (heroku release succeeded): boot warm-up ran on the production dyno
  (log: "built: 4513 styles from 5039 grouped rows" with ZERO requests); never-seen searches on
  LIVE: 0.42s / 0.42s / 0.74s (were 10-22s); decorated-cap 112 = $22.50 (was $23); Newest sort
  200 (was 500); money-path smoke green (pricing-bundle, service-codes, quote_sessions).
- **App `v2026.08.25.3`** (backend SHA bf8e007 verified via /api/version): all three rebuilt
  bundles byte-verified live — catalog-2026 (fetchpriority), catalog-search (navigateToCatalog,
  old LTM copy + /pricing/cap-embroidery route = 0), product-search-service ('See pricing'
  present, ensureMargin = 0). Server price labels rendering on live /catalog cards.
- Proxy jest 1,569/1,569 (one harness fix: products-search-route mocks now skip the index-build
  fetch + reset the index cache per test). App gates all green; CI green.
- Observed live, feeds M-1: /catalog?category=Caps&brand=Richardson page 1 shows only 5 cards
  (price-split pagination) — the "honest counts" backend fix is now the top medium item.

## 🌉 2026-08-25 (later) — BUY-ONLINE BRIDGE + FEATURED LANDING BUILT (committed, NOT deployed)

Erik decided: **Option A** — quote primary for crews, express as the small/fast lane; and
top-sellers-first landing approved. Built + locally verified end-to-end:
- App `cebfe7dc`: new `shared_components/js/express-eligibility.js` (eligibility from the
  storefronts' OWN whitelists; enhancement-only; jest ×5) · catalog card badges · QV lane ·
  PDP two-lane (color-carrying, follows swatch changes) · homepage shelf links (PC61/PC90H) ·
  /catalog browse default sort=featured.
- Proxy `e24718e`: sort=featured (IsTopSeller in groupBy — MAX() invalid on bit; POST-HYDRATION
  sort's default branch was re-alphabetizing and burying top sellers — taught it 'featured').
- Verified: PDP lane → /custom-tees?style=PC54&color=Jet+Black opens the studio ON PC54 JET
  BLACK; caps badge → CT105298 studio; featured page 1 = Bella+Canvas/Carhartt wall of best
  sellers. ⏭️ Deploy PROXY first, then /deploy app (prod proxy without featured falls back
  safely to old order — no breakage window). 🔑 products/search has TWO sort points: Caspio
  orderBy AND a post-hydration array sort — a new sort value must teach BOTH.

## 🚀 2026-08-25 (final) — BRIDGE + FEATURED LANDING DEPLOYED AND LIVE-VERIFIED

Proxy `v2026.08.25.2` (jest 1,571/1,571; featured sort live: page-1 = BC3001 + Carhartt
best-sellers) · App `v2026.08.25.4` (SHA 5b474ae via /api/version). LIVE checks: /catalog first
screen = featured order with sort=featured sent; buy-online badges rendering (BC3001→
/custom-tees, 258→/custom-caps); PDP PC54 lane visible with color-carrying deep link. Phase 2
of the CX overhaul is fully shipped. ⏭️ NEXT: M-1 honest counts (top item), trust band blocked
on Erik's Google rating + 2-3 named customer quotes, then M-5/M-6/M-7 per the roadmap.

## 📊 2026-08-25 (later still) — M-1 HONEST COUNTS BUILT (proxy `dbc8be4`, committed+pushed, NOT deployed)

One dedupe (one row per STYLE for EVERY request) fixed the family: totals/pagination/facets now
count styles (bare catalog 3,408 was "12,413"; T-Shirts 388 was "1,537"; Top Sellers 67 was 379;
category pages fill all 48 slots); product order = Phase-1 DB order (post-hydration re-sort
retired); price sorts decided in JS on real min/max splits, $0/NULL junk last (CTK87 has a
priceless Active row); Phase-2 variants carry the status filter (Discontinued-variant leakage);
/stylesearch status-filtered + deduped (LPC54 ×2). Full suite 1,576/1,576; verified on live data.
🔑 Accepted residue: blank-category rows (5280) make displayed from-price wobble vs in-category
sort key — sort scope = filter scope. ⏭️ BACKLOG: "Caps+Richardson" totals only 5 — most
Richardson caps live in Non_SanMar_Products and don't surface under the brand filter; data
question, not counts. ⏭️ Deploy proxy when Erik says go (app needs nothing).

## 🚀 2026-08-26 — M-1 HONEST COUNTS DEPLOYED (proxy `v2026.08.26.1`) + LIVE-VERIFIED

T-Shirts 48 full cards / total 388 / facet 388 · bare catalog total 3,408 (was "12,413") ·
Top Sellers 67 · price_desc monotone · stylesearch deduped, no Discontinued. Suite 1,576/1,576.
CX overhaul phases 1-3 all LIVE. ⏭️ REMAINING (roadmap): trust band (BLOCKED on Erik: Google
rating + 2-3 named quotes) · M-5 QV-to-quote CTA · M-6 one chrome · M-7 category tiles ·
M-8 mobile filters · Richardson/Non-SanMar brand-filter data question.

## ⭐ 2026-08-26 — TRUST BAND LIVE (rode along in app `v2026.08.26.1`)

Erik picked the reviews (4.9★/187 on Google), approved silent typo fixes + full names. Shipped:
homepage reviews band (4.9 badge → maps cid link, "185+" so it stays true; Dave Lambing —
Tacoma Fire Buff Battalion + Wyatt Smith) · PDP CTA card quote (Jed Rains, names Taneisha) ·
express checkouts beside Pay (Robyn Readwin tees / Jeremy Hanson caps). NOTE: shipped inside
ANOTHER session's v2026.08.26.1 release (staff-dashboard hardening) — the shared checkout was
on main mid-their-deploy when the trust commit landed; content was fully gated, let ride,
live-verified on all 4 surfaces (grep Dave/Jed/Robyn/Jeremy + badge + cid link = 1 each).
M-9 trust band = DONE. Remaining roadmap: M-5 QV CTA · M-6 one chrome · M-7 category tiles ·
M-8 mobile filters · Richardson Non-SanMar brand-filter data question.

## 🖱️ 2026-08-26 — M-5 QUICK-VIEW CTA BUILT (app `0663f2b9`, committed+pushed, NOT deployed)

Both QVs: primary CTA "Price it & add to quote" → `/product.html?style&color#pricingHeading`
(color follows swatch switches; quiet "View full details" secondary). PDP re-scrolls to the
anchor AFTER async render (native anchor scroll fires against skeleton layout; behavior:'instant'
— smooth never completes in non-compositing tabs). /catalog cards: 5 swatch dots + "+N".
Verified on built local server (48/48 cards, arrival rect.top=1). Remaining roadmap:
M-6 one chrome · M-7 category tiles · M-8 mobile filters · Richardson Non-SanMar data question.

## 🚀 2026-08-26 — M-5 DEPLOYED (app `v2026.08.26.2`, SHA 5876fdf) + LIVE-VERIFIED

QV CTA string, pcard-swatches/pcard-swatch-more class literals, catalog-search #pricingHeading ×3,
and the PDP "#pricingHeading" handler all byte-verified in the live minified bundles. ⚠️ Self-inflicted
verification scare: dist bundles ARE minified — grep for function names (buildSwatchRow) and comments
returned 0 and looked like a failed deploy; class/string literals are the only valid markers (the
DURABLE_GOTCHAS marker rule, walked into anyway). Also: another session's UNCOMMITTED server.js edit
is sitting in the shared working tree — left untouched, shipped nowhere.
Remaining roadmap: M-6 one chrome · M-7 category tiles · M-8 mobile filters · Richardson data question.

## 🛑 STOPPING POINT 2026-08-26 (~06:00) — laptop shutdown; PICK UP HERE

**Everything through M-5 is DEPLOYED and live-verified.** Nothing of mine is uncommitted or
unpushed in either repo. Scoreboard of what's LIVE: search <1s (boot-warmed index) · one price
voice · all roads → /catalog · buy-online bridge (Option A) · featured landing · M-1 honest
counts · trust band (4.9★ Google) · M-5 Quick-View "Price it & add to quote" CTA + swatch dots.

## ✅ M-6 one chrome — DEPLOYED LIVE `v2026.08.26.5` (Heroku v1889, 2026-08-26), live-verified

Live checks: backend SHA `061a37f3` via /api/version · `/pages/webstore-info.html` 301 on prod ·
brands + tumbler serve the new chrome (nav-bar-inner/sidebar/site-footer present, old
`top-navigation`/`enhanced-pricing-header`/`page-footer` = 0) · dist bundles byte-verified
(brands.js + tumbler js: `drawer-open` + `/catalog?q=` literals; catalog-search:
`location.replace` + `"/catalog?"`; brands.css: overflow override gone).

One chrome across ALL 6 customer pages (index/catalog/product/quote-cart/brands/laser-tumbler),
locked by `tests/unit/chrome-drift.test.js` (exact 10-link nav sequence + 12-link drawer core +
no retired destinations; 18/18). brands.html and the tumbler calc were REBUILT onto the 2026
chrome (brands was 89 lines of main-redesign-era markup; the tumbler was a chrome-less dead end
with a fixed 180px header — its old header/footer styles removed from `laser-tumbler-simple.css`,
drawer/search wired in each page's own JS, quote badge added). `/pages/webstore-info.html` 301s
to `/company-webstores` (server.js, ABOVE the /pages static mount — mount order beats later
routes) + 22 pages' links rewritten. Homepage inline-results engine retired: masthead search
NAVIGATES to `/catalog?q=`, legacy `/?q=`/`/?category=` URLs `location.replace` to /catalog,
last 3 `/?q=` senders fixed. All gates green (lint/typecheck/unit 2674/dom 88/a11y 4);
live-verified on local build: drawer scroll-lock, 46 brand tiles, tumbler calc intact
(6 pricing rows/4 swatches), 301, search nav.
🔑 brands.css carried `body { overflow: auto !important }` (a counter to main-redesign.css) that
would have silently beaten the drawer's `body.drawer-open { overflow: hidden }` — removed.
🔑 The chrome is STILL copy-pasted per page (build-time component = later refactor); the drift
test is what keeps the 6 copies identical — edit one page's chrome = edit all 6 + the canon.

## ✅ M-7 category tiles — DEPLOYED LIVE `v2026.08.26.6` (2026-08-26), byte-verified (homepage 3 new tile hrefs, #catTiles container, cat-tile-sm in live js+css bundles)

Homepage: 3 tiles added (08 Ladies · 09 Activewear · 10 Woven Shirts → 11 tiles incl. the
existing "All categories" tile). /catalog: `#catTiles` row above the grid, rendered by
`renderCatTiles()` in `catalog-2026.js` from the SAME `lastFacets.categories` the rail uses
(15 categories w/ live style counts, count-desc). Shown ONLY on the unfiltered un-searched
browse (`!state.q && !activeFilterCount()`); any filter/search/error collapses it. Tiles are
real `<a href>`s via `urlForPatch` (middle-click works) + delegated click → `navigate()` (SPA,
no reload). Mobile ≤700px: one 46px horizontally-scrollable row, no page overflow. Verified in
browser: 15 tiles → click Ladies → `?category=Ladies`, H1 Ladies, 48 cards, tiles hidden →
clear-all → tiles back; `?q=` hides them. All gates green.

## ✅ M-8 mobile filters — DEPLOYED LIVE `v2026.08.26.7` (2026-08-26), byte-verified (filtersApply markup, "Show 0 results" in live js, filters-apply-bar/fall26-cta-label/masthead-h in live css)

Three pieces, all ≤-breakpoint only (desktop byte-identical): (1) mobile filter drawer gets a
sticky bottom apply bar — `#filtersApply` mirrors the live result count ("Show 3,408 results",
updates as filters toggle behind the drawer, "Show 0 results" on empty, "Close" on error) and
closes the drawer; pinned flush via `position: sticky; bottom: 0` INSIDE the scrolling rail.
🔑 The rail's 24px bottom padding held the bar off the edge — sticky bottom pins at the
scrollport edge, padding stays visible below; fix = drawer-mode `padding-bottom: 0`.
(2) `.results-toolbar` sticky at 64px under the 63px masthead ≤960px (opaque --paper bg, z-50,
below masthead z-90/drawers z-240). (3) Fall promo ≤560px collapses to ONE 47px line (badge +
title + arrow; secondary copy + "Explore the collection" hidden — CTA text got a
`.fall26-cta-label` wrapper to be hideable). Browser-verified at 375px + desktop 1280px.

## ✅ Richardson question CLOSED (Erik's ruling, 2026-08-26)

"We just want the Richardson caps that SanMar offers, not the Richardson full line." The 5
SanMar styles under /catalog?brand=Richardson are the intended catalog — no Non_SanMar_Products
merge. Working as intended; roadmap COMPLETE (M-1..M-9 all shipped).

**ERIK'S STANDING ERRANDS:** void OnSite test orders PO `CAP0825-4781` + `CAP0825-7724`
("ZZZ TEST - DO NOT PRODUCE") · set `SLACK_ORDER_ALERT_WEBHOOK_URL` on Heroku · Rule 9 rewording.

**SHARED-CHECKOUT AWARENESS AT SHUTDOWN:** another session was actively editing (uncommitted:
app `server.js` + several `shared_components/js/*-quote-service/page.js` — looks like the
quote-data-plane relay work) and has an unpushed proxy commit `5a54396` (psst-audit). None of it
is mine; do NOT stage with `git add -u` until it's resolved — stage explicit paths only, and
check `git branch --show-current` + fresh Release commits before ANY commit (mid-deploy gotcha).

## Homepage "one door" redesign — SHIPPED then REVERTED same day (2026-08-26)

Shipped `v2026.08.26.10`, reverted `v2026.08.26.11`: Erik saw the single-band catalog door live and did not like it; the original two-band layout is back (live-verified). Keep for any future pass:
- Catalog **subcategory facets are EMPTY** — never link them. Cut chips = `?category=X&q=term`, each validated to return > 0 results before shipping.
- **Brand facet values are exact** (`Port & Co`, NOT `Port & Company`).
- The design canvas with all four explored directions stays at claude.ai/code/artifact/8c4d6c63-e823-4936-ba19-5e4dfb41dacf.
