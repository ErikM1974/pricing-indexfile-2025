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

