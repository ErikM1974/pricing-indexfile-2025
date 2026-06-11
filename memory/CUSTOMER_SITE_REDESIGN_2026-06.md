# Customer Site Redesign 2026-06 — Master Plan

## ⏯️ PICKUP HERE (updated 2026-06-11 post-deploy)

**State**: ✅ **DEPLOYED LIVE `v2026.06.11.2`** — homepage redesign (incl. 4-print hero rotator), P0 dead-link/cart-retire fixes, P0b URL-price hole, search category-drift fix. Live-verified: homepage serves `?v=2026.06.11.2`, `/cart` 301→sample-cart, `/marketing.html` 404. Erik approved screenshots + all hats decisions (log below). develop == main == Heroku.

**Next work items, in order**:
1. P1 remainder: add interior-page primitives to nwca-2026.css (forms, pricing tables, alerts, toasts, interior page headers, cart components) + fix the 2 AA contrast edges the mobile-a11y audit flagged in nwca-2026.css + split a core layer so interior pages don't pull homepage band CSS.
2. P2 catalog phase (see Phase plan below).
3. P4 hats store can start in parallel with P2/P3 — lineup + pricing verified, chassis blueprint documented below; FIRST step is the channel-config registry extraction in server.js.

**Session facts a fresh context needs**:
- The ORIGINAL homepage background agent died silently (only output: nwca-2026.css). The orchestrator rebuilt index.html directly — do NOT wait for/expect any homepage agent.
- Task board (harness): #3 P1 in_progress; #1 P0 + #2 P0b completed; #4-#9 = P2-P7 pending.
- index.html JS contract is LOAD-BEARING: `.hero-section` + `.homepage-sections` wrappers, all the #nav*/#results*/#filters* IDs — catalog-search.js has unguarded querySelectors (details in 2026-06-11 status entries below).
- Erik's 4 hats decisions + 4 design decisions are all in the Decision log. Full audit evidence: CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md. Hat lineup table + C112→C402 gotcha below.
- Known deferred nits: "$23.5" un-padded price formatting on showcase buttons (P3 rebuild); sample-cart sessionStorage still client-trusted until P5 server reprice; top-sellers-product still hardcodes the proxy URL (page-consistent; dies in P3 consolidation anyway).

> Status doc for the full customer-facing redesign + Custom Hats embroidery store.
> Full audit evidence (8-agent discovery sweep, 2026-06-11): [CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md](CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md)

## Status

- **2026-06-11**: Discovery complete (8 agents, 7 audits + completeness critique). Homepage redesign agent in flight (preview-only — nothing ships without Erik's screenshot approval). New design system landed: `shared_components/css/nwca-2026.css` ("press-room editorial", promoted from custom-tees.css).
- **2026-06-11 (same session)**: **P0 hotfix wave DONE + preview-verified** — 7 zombie sendFile routes removed (incl. test-api/test-catalog-layout, also missing), `/cart` → 301 sample-cart, cart.html + order-confirmation.html deleted (dead JS flagged in ACTIVE_FILES.md, not deleted), webstore-info/inventory-details dead links repointed, validate-critical-paths.js cart block removed. **P0b DONE + tamper-tested** — sample price/sampleType now re-derived from BLANK pricing-bundle at add-to-cart (`resolveSamplePricing`), URL params inert; showcase margin now API-sourced (was stale 0.57 vs Caspio 0.53 — paid-sample prices rise slightly to match Caspio intent). index.html nav dead links (Marketing/Sale/Resources) ride with the homepage rewrite — verify at P1 review. NOT YET DEPLOYED — rides with the homepage release.
- **2026-06-11**: Hats v1 lineup curated + verified (9 styles, table below).
- **2026-06-11 (post-restart)**: **Search category-drift bug FIXED + preview-verified** — CATEGORY_KEYWORDS in product-search-service.js had stale 'Fleece'/'Headwear' (live: 'Sweatshirts/Fleece'/'Caps'); "hoodies"→0 became 266 products, "caps"→0 became 146. Added zero-result drift guard (inferred category dropped + warn on 0 hits). Was broken on PRODUCTION too. Homepage screenshots (desktop ×7 slices, mobile, caps-results) captured + presented to Erik — awaiting approval gate.
- **2026-06-11 (later)**: Original homepage agent DIED mid-task (wrote nwca-2026.css, never touched index.html — no transcript, no completion). **Orchestrator rebuilt index.html directly: DONE + preview-verified, awaiting Erik screenshot approval.** New index.html on nwca-2026.css + catalog-search.css (dropped main-redesign.css → brands.html is its last consumer; main.css/gallery-styles/modern-search-interface now dead-flagged). NEW `home-2026.js` (drawer close/Escape/scroll-lock, All-categories tile, hero un-hide patch for searchByBrand's inline-style hide that clearSearch never undid). **JS contract preserved** — all search machinery IDs/classes kept (app-modern/catalog-search/autocomplete-new/brands-flyout untouched); `.hero-section` + `.homepage-sections` wrappers REQUIRED (unguarded toggles in catalog-search.js); legacy #filtersSection/#clearFiltersBtn stubs kept hidden in drawer. Verified in preview: search (6 PC61 results), /?category=Caps deep link (277 products, breadcrumb, filter bar), drawer open/close/Escape/scroll-lock, mobile 375px (search VISIBLE — audit critical fixed; 10px cat-tile grid blowout fixed w/ min-width:0), zero console errors. Category tiles use /?category= URLs (shareable — head start on P2 URL state). Gotchas: preview_screenshot can wedge per-window (restart preview server to fix); preview_click coordinates unreliable in emulated viewport (use el.click() via eval to test handlers).

- **2026-06-11 (backend, for P2)**: **Proxy DEPLOYED LIVE same day (Erik-approved; 21/21 new tests; live-verified displayPrice + categories on prod). Deploy also reconciled 5 production commits that sat on heroku/main but were MISSING from origin/main — proxy repos now in sync (lesson: always `git fetch heroku` before proxy releases).** The branch `catalog-pricing` moves the catalog "from $X" card price server-side: `/api/products/search` products now carry additive `displayPrice` (number|null) + `displayPriceLabel` ("from $24") = HalfDollarCeil(cheapest-size MAX(CASE_PRICE) / Caspio BLANK MarginDenominator 0.53, 1h-cached) — replaces the frontend's stale `(PIECE_PRICE/0.57)+15` literal in product-search-service.js (processProducts currently OVERWRITES the field client-side, so deploying the API alone changes nothing visibly; P2 frontend must switch to the server fields + delete MARGIN/FIXED_ADDITION). Also NEW `GET /api/categories` → `{categories:[{name,count}]}` (live, 1h cache, 15 cats — "Caps" not "Headwear") for the nav/mega-menu taxonomy. Missing cost/margin ⇒ null price, never a fallback number.

## Decision log

| # | Decision | Choice | Who/when |
|---|---|---|---|
| 1 | Design direction | Modern NWCA green refresh — press-room editorial (paper ground, ink-green, safety-orange, Bricolage Grotesque + Public Sans) | Erik 2026-06-11 |
| 2 | Hat pricing model | **Simple: logo included** — one price per cap incl. front logo; back logo flat add-on; customers never see stitch counts | Erik 2026-06-11 |
| 3 | Go-live process | Preview screenshots first, then deploy on approval | Erik 2026-06-11 |
| 4 | Golf tournament pages | Restyle to match new system (campaign stays live) | Erik 2026-06-11 |
| 4a | Homepage | **APPROVED + deploy authorized** (screenshots reviewed post-restart) | Erik 2026-06-11 |
| 4b | Hero photo | **Rotate several real prints** — 4-image crossfade (Setina tee / Fife hoodie / Carhartt jacket / engraved pint), 4.5s, reduced-motion-safe, zero CLS (verified 470px stable) | Erik 2026-06-11 |
| 4c | Hats teaser card | **Keep visible** pre-launch (COMING SOON badge, no dead link) | Erik 2026-06-11 |
| 5 | cart.html + order-confirmation.html fate | **RETIRE** (orphaned Bootstrap legacy, zero inbound links; no hotfix, no migration). `/cart` route → 301 to the sample-cart successor | Orchestrator ruling on auditor contradiction |
| 6 | inventory-details.html fate | **FOLD into the new templated product page** (inventory summary/tab); not migrated standalone | Orchestrator ruling |
| 7 | Catalog IA | **REPLACE** the in-page homepage SPA with a dedicated `/catalog` page (URL-driven state); homepage becomes marketing + entry points | Orchestrator ruling |
| 8 | webstore-info alert() mobile-menu stub | No isolated hotfix — page is rebuilt/merged in the share-link wave; new shared chrome fixes mobile nav everywhere | Orchestrator ruling |
| 9 | Hats: minimum qty / LTM | **8-cap minimum** — skips the $50 LTM tier entirely; no baked storefront LTM code needed; entry ≈ $240 (8 × $30 R112) | Erik 2026-06-11 |
| 10 | Hats: digitizing/setup fee | **Free setup, always** — "free logo setup" marketing; absorb ~$75 internal DD cost; no CAPS-DIGITIZE checkout line | Erik 2026-06-11 |
| 11 | Hats: proof flow | **Digital proof first** — emailed sew-out preview approved before production; promise = "ships N days after proof approval"; needsArtReview always-on | Erik 2026-06-11 |
| 12 | Hats: v1 cap lineup | **Claude curates 6-10** SanMar-carried OSFA best-sellers, each API-verified (pricing, inventory, images); swappable via Caspio later | Erik 2026-06-11 |

## Phase plan (merged sequence — supersedes the three conflicting per-auditor orders)

- **P0 — Hotfix wave** (small, ships independently of redesign):
  - Remove/repoint dead nav links: `marketing.html` (deleted file, still in live nav + webstore-info footer), `contact.html` (inventory-details footer; no contact page exists anywhere).
  - Delete 5 zombie `sendFile` routes in server.js targeting missing files (`/marketing.html`, `/top-sellers-catalog.html`, `/index-new.html`, `/embroidery-pricing-standardized.html`, `/embroidery-pricing-professional.html`).
  - Retire legacy cart flow (cart.html, pages/order-confirmation.html) per decision #5.
  - Drop 'Sale'/'Resources' placeholder nav items (internal "Back to Sales Tool" copy leaks to customers) until real content exists.
  - **Price-integrity critical**: top-sellers-product.html reads sample price from a customer-editable URL param that flows into ShopWorks orders — close the hole.
  - Branded 404 page + Express catch-all (dead links currently land on raw "Cannot GET").
- **P1 — Homepage** (in flight) **+ nwca-2026 primitives**: add the missing primitives interior pages need (forms, data/pricing tables, alert banners, toasts, interior page headers, cart components); fix the 2 AA contrast edges flagged in nwca-2026.css; split a core layer so interior pages don't pull homepage band CSS.
- **P2 — Catalog**: dedicated `/catalog` page, URL-driven state (shareable/deep-linkable, working back button), server-side decorated pricing (extend `/api/products/search` to return decoratedPrice — kills the hardcoded frontend margin formula), API-driven categories for nav/mega-menu, full facet set (backend already supports brand/category/subcategory/color/size/price + facets; UI only exposed Brand), shared customer header/footer component on every page, autocomplete v2 with thumbnails, search-first mobile drawer (today the ENTIRE top nav incl. search is display:none ≤768px — mobile customers have no product discovery).
- **P3 — Product page consolidation**: ONE templated product page on nwca-2026 replaces five implementations (product.html ~9K lines, top-sellers-product 1.9K, richardson-112-product, inventory-details, golf-tournament-product pattern). Embed API-driven decoration pricing tabs (generalize golf-tournament-product.js — the only implementation that does it right) for EMB/CAP/DTG/SCP/DTF. Add sticky quote bar, qty/tier price slider, related products, live "ships by" promise. Golf product page stays as campaign landing, restyled (decision #4).
- **P4 — Custom Hats store** (see below).
- **P5 — Share-link tier reskin**: quote-view, invoice, customer-portal, embroidery-contract-pricing, golf pair, sample-cart rebuild (no system of record today + open legacy cart API — needs its own design pass).
- **P6 — Customer calculators token-skin**: 5 staff-shared pricing calculators; strategy is "unlink shared CSS per page, NEVER edit shared files in place" (blast radius: quote-builder-shell.css etc. serve the 3 staff quote builders + quote-management dashboard).
- **P7 — Cross-cutting** (fold into each phase as pages are touched): SEO baseline (sitemap.xml, robots.txt **with staff-path disallow — the entire staff app is publicly served + crawlable on the customer origin**, canonicals, OG tags on all 28 pages), analytics/conversion tracking (currently ZERO), legal pages (privacy/terms/returns — required for a card-taking site), favicon/manifest/brand assets (favicon currently hotlinked to Caspio CDN), email capture hooks, transactional-email brand pass.

## Custom Hats store — verified facts (live API, 2026-06-11)

**Pricing chain** (`calculateCapProductPrice`, embroidery-quote-pricing.js:632): blank OSFA price ÷ per-tier MarginDenominator + EmbroideryCost(tier, 8K stitches) → `Math.ceil` (CeilDollar) → + $50 LTM/qty if cap qty ≤ 7 → + AL-CAP(tier) for back logo. Caps tier separately from garments, ALWAYS.

| Endpoint | What it serves |
|---|---|
| `GET /api/pricing-bundle?method=CAP&styleNumber=…` | Cap tiers (1-7 margin 0.55 + $50 LTM; 8-23/24-47/48-71/72+ margin 0.53), 8K-stitch cost rows ($17/$17/$13/$11/$9.50), blank sizes/costs, CeilDollar, locations CF/CL/CR/CB |
| `GET /api/pricing-bundle?method=CAP-AL` | Back-logo add-on: $6.50/$5.50/$4.75/$4.50/$4.25 per cap by tier (5K base, +$1/1K) |
| `GET /api/service-codes` | AS-CAP stitch ladder: ≤10K INCLUDED $0 / 10-15K +$4 / 15-25K +$10 → natural "logo included" price protection. DD digitizing $100 sell/$75 cost (DDT text $50, DDE edit $50) |
| `GET /api/decorated-cap-prices?brand=Richardson` | Prebuilt server-side "as low as $X" card prices (verified matches formula to the dollar) |
| `/api/product-details`, `/api/sanmar/inventory/:style`, `/api/size-pricing` | Richardson 112 fully in SanMar pipeline: 112 colors w/ COLOR_NAME+CATALOG_COLOR, CDN images, live inventory, $6.75 OSFA blank |

**Richardson 112, front logo included** (blank $6.75): qty 1 → $30 + $50 LTM = $80 · qty 6 → $38.33/cap · qty 12 → $30 · qty 24 → $26 · qty 48 → $24 · qty 72+ → $23. Back logo adds $6.50→$4.25/cap by tier. Port Authority C112 (blank $3.61): $24/$24/$20/$18/$17.

**OSFA detection**: pricing-bundle `sizes[]` is the discriminator — 112/C112 return `[{size:'OSFA'}]`; fitted caps (NE1000) return S/M / M/L / L/XL → **excluded from v1**. OSFA maps to ShopWorks Size06. Beanies are flat headwear = GARMENT pricing, not cap (`isFlatHeadwear`) — exclude from v1. ~86 of 133 Richardson styles are factory-direct with HARDCODED blank costs (`richardson-factory-direct.js`) — **v1 must stick to SanMar-carried styles** (Erik's API-pricing rule). Richardson 112's CATEGORY_NAME is EMPTY in Sanmar_Bulk (isCapProduct falls back to `^\d{2,3}$` regex); inventory has stale sized partIds with 0 qty — aggregate stock by CATALOG_COLOR, not size.

**Build approach** (from tees blueprint): clone the custom-tees chassis (~70% reused untouched: Stripe checkout + webhook idempotency ladder, server-authoritative reprice w/ 1-cent tolerance, EmailJS confirmation/shipped emails, HMAC /order-status, admin artwork views, ShipStation tracking chokepoint). **FIRST extract a channel-config registry in server.js** — channel string `'custom-tees'` is hardcoded in ~6 scattered whitelists (shipped-email gate, service banner, rush default, stock banner, art-review wording, cart-key clears); a hats order would silently get no shipped email otherwise. Write `custom-hats-pricing.js` FRESH against the EMB cap contract (NOT adapted from custom-tees-pricing.js — DTG uses halfDollarCeil/<24 LTM; caps use CeilDollar/≤7 LTM; wrong-but-plausible prices guaranteed) + jest parity lock vs internal EMB builder. Create Caspio service codes BEFORE building (CAPS-LTM?, CAPS-DIGITIZE?, CAPS-SHIP-* — pending decisions #9/#10; note CTS-SHIP-FREE-OVER's SellPrice holds the THRESHOLD dollars, a semantic trap). Replace size grid with one-click OSFA qty; replace free-placement designer with fixed-location picker (front + optional back) — cap photos break the garment-geometry heuristics, and placement is advisory anyway. Key on server-stamped locations, never composite code strings (the `_FB` indexOf bug class). Tee-specific constants that WILL silently mis-push hats if missed: designTypeId 45→EMB type, artistId 224, SW_LOC dropdown map (caps use different OnSite values), 'LTM-75' part, 'Full Color DTG' design details, 'Port & Company Core Cotton Tee' fallback name in THREE places.

**Inherited soft spots to close while touching the code**: `/api/quote-sessions/:quoteId/shipstation-tracking` has NO auth; QuoteID prefix decision is irreversible once live orders exist; `refresh=true` on quote_sessions lookups is LOAD-BEARING (cache-poisoning found live 2026-06-09); SanMar inventory proxy route caches ~5 min with no bypass.

## Custom Hats v1 lineup (curated + live-API-verified 2026-06-11, per decision #12)

Customer price = front logo INCLUDED (8K stitches assumed, ≤10K free via AS-CAP); back logo add-on $5.50/$4.75/$4.50/$4.25 by tier. All cross-checkable picks matched `/api/decorated-cap-prices` to the dollar.

| Style | Brand / Name | Role | Blank | Qty 8 | Qty 24 | Qty 48 | Qty 72 | Colors | Live inv |
|---|---|---|---|---|---|---|---|---|---|
| 112 | Richardson Trucker | Flagship classic trucker | $6.75 | $30 | $26 | $24 | $23 | 112 | 1.09M |
| C402 | Port Authority Snapback Trucker | Budget trucker | $3.79 | $25 | $21 | $19 | $17 | 54 | 474K |
| 112PFP | Richardson Printed Five-Panel | Camo (Realtree/Mossy Oak/duck) | $8.25 | $33 | $29 | $27 | $26 | 27 | 285K |
| 256 | Richardson Umpqua Gramps | Premium heritage dad | $9.25 | $35 | $31 | $29 | $27 | 19 | 134K |
| 258 | Richardson Rope Cap | Trendy rope | $7.50 | $32 | $28 | $26 | $24 | 14 | 64K |
| 220 | Richardson Relaxed Perf Lite | Relaxed/women's-friendly | $8.00 | $33 | $29 | $27 | $25 | 15 | 30K ⚠ |
| C914 | Port Authority Unstructured Twill | Budget dad cap | $3.12 | $23 | $19 | $17 | $16 | 18 | 40K |
| STC26 | Sport-Tek RacerMesh | Performance/athletic | $4.23 | $25 | $21 | $19 | $18 | 10 | 96K |
| CT105298 | Carhartt Canvas Mesh Back | Premium workwear | $13.04 | $42 | $38 | $36 | $35 | 5 | 38K |

⚠ 220 has Black=1/Navy=223 — exclude those from hero colors; standby swap = Richardson **225** (all 13 colors stocked incl. Black).

**Critical operational findings:**
- **SanMar renumbered the C1xx trucker family → C4xx.** C112/C112LP/C112ECO/C115/C119 are DEAD at PromoStandards live inventory ("Product Id not found") while Sanmar_Bulk still has healthy-looking stale rows. Build on C402; **NEVER trust Sanmar_Bulk qty fields** — stock must come from `/api/sanmar/inventory/{style}` aggregated by CATALOG_COLOR (stale 0-qty partIds exist; some live colors lack bulk rows — render the intersection).
- `/api/products/search?category=Caps` is unreliable for cap discovery (20 rows, omits Richardson; brand=Richardson facet → 0; Richardson rows have EMPTY CATEGORY_NAME). Enumerate Richardson via `/api/decorated-cap-prices?brand=Richardson`.
- Richardson 115 is FITTED at SanMar (M/L), 255 isn't SanMar-carried; Flexfit/Outdoor Cap/Pacific Headwear have zero Sanmar_Bulk rows. Rejected list (33 styles + reasons) in the hat-lineup agent output.
- Every pick has per-color FRONT_MODEL photos + FRONT_FLAT/BACK_FLAT + swatches; none have side views.
- Cap tiers verified live: 8-23/24-47/48-71/72+ all MarginDenominator 0.53; Embroidery_Costs Cap@8000 = $17/$13/$11/$9.50; CeilDollar. The 1-7 tier (0.55 + $50 LTM) is moot with the 8-cap minimum.

## Price-integrity criticals (Erik's #1 rule violations found — fix in P0/P3)

1. **top-sellers-product.html**: customer-tamperable URL price param → ShopWorks orders (P0).
2. Hardcoded 0.57 margin + $15 embroidery math in frontend catalog/product code; catalog prices computed client-side from hardcoded formula (P2 server-side decoratedPrice kills it).
3. Hardcoded 10.1% tax, $10 shipping, $300/$100/$2,000 webstore fees, golf marketing prices in frontend files.
4. Silent fallbacks: richardson-112-product renders hardcoded product data on API failure; catalog service layer caches computed prices 5 min + silent fallback paths.
5. admin/c112-bogo-promo.html has hardcoded $17/$16 promo prices — do NOT copy patterns from legacy cap pages into the hats store.

## Mobile / a11y migration contract (every redesigned page)

Worst-mobile ranking: inventory-details, cart, webstore-info, top-sellers-showcase, top-sellers-product, richardson-112, dtg-compatible, screenprint-customer, product.html, embroidery-contract-pricing, golf pair, 3-day-tees (best). Standards: nwca-2026.css only base; zero inline style/script; one external CSS + JS per page; 44px targets; skip link; ARIA dialogs/tabs w/ focus trap + Escape; aria-live for async regions; escapeHtml all API data; visible fatal-error card (port custom-tees pattern); AA contrast (legacy #4cb354 on white = 2.96:1 FAILS — never reuse).

## Open follow-ups (from completeness critique)

- Staff app publicly served/crawlable on customer origin → robots.txt disallow now; auth gating is a separate future project.
- Server-side caching globally disabled; no performance measurements taken — measure during P2/P3 with preview tools.
- Transactional emails (EmailJS templates) are unaudited customer brand surfaces; hats store needs its own set. Erik still owes: delete stray "```html" line in EmailJS customer template (pre-existing).
- Sample-cart end-to-end flow (no system of record, open legacy cart API) — dedicated design pass in P5.
