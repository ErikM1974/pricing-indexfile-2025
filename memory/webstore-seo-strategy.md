# Webstore SEO — hub, spokes & the data-driven niche priority

**Hub page:** `/company-webstores` ([pages/company-webstores.html](../pages/company-webstores.html)) — targets the B2B
"company store / team store / employee uniform store" cluster; golf-showcase template + `pages/css/company-webstores.css`.
10 store-type cards. Legacy `/webstore-info.html` 301s here; `/pages/webstore-info.html` noindex+canonical. Platform = InkSoft
(never named on-site, per Erik).

## Where the InkSoft (webstore) order data lives — how to re-run the analysis

InkSoft/online-store orders in NWCA data = **`ManageOrders_Orders` where `id_OrderType=31` and `sts_Invoiced=1`**
(`Is_InkSoft` is a Caspio formula — can't filter formulas via API, so use `id_OrderType=31`; see
`caspio-pricing-proxy/src/routes/online-store-commissions.js`). Useful fields: `CustomerName`, `ParentCompany`,
`cur_SubTotal`, `date_Invoiced`, `id_Customer`, `CustomerServiceRep`. Aggregate by `ParentCompany||CustomerName`.

## The finding (2026-07-14, Jan–Jul 2026: 1,274 orders, 63 companies, $212.8K subtotal)

**NWCA's webstore business is B2B — construction, property management, hospitality, industrial, government — NOT the
schools/teams/fundraising InkSoft markets.** Top customers: Hops N Drops ($52K, restaurant), Absher Construction ($36K/423
orders!), Stella-Jones ($30K, industrial), Arrow Lumber ($18K, retail/building supply), Forma/Pro Vac/Emerald Fire/GNW
(construction & trades), AMC Properties + a huge tail of apartment communities (property management — a repeatable
store-per-community model), Puget Systems/Shift Innovations (tech cos), Pierce County/City of Tukwila/US Forest Service/
Puyallup Police (government), Mud Bay (pet retail), United Wound Healing (healthcare). **Almost ZERO schools/teams/nonprofits/
Greek** despite those being InkSoft's marketed niches.

## Data-driven spoke-page priority (build in this order)

1. **Construction & trades company stores** — #1 by volume + revenue (Absher, Forma, Pro Vac, Emerald Fire, GNW, Prospect).
2. **Property management / apartment-community stores** — dominant tail; the store-per-community model NWCA has cracked (AMC).
3. **Restaurant & hospitality stores** — Hops N Drops is the single biggest customer.
4. **Industrial / manufacturing company stores** — Stella-Jones, Rainier Pure Beef.
5. **Retail / building-supply / brand stores** — Arrow Lumber, Capital Lumber, Mud Bay.
6. **Government / municipal stores** — Pierce County, cities, police, Forest Service.
Tier 3 (InkSoft-popular but NOT current NWCA business — speculative expansion, lower priority): school spirit, team,
fundraising, college/Greek, nonprofit.

## What each niche actually orders (from `ManageOrders_LineItems` on the InkSoft orders — use for spoke product grids)

Real top styles per niche (units, Jan–Jul 2026) — link `/product.html?style=X` for the real SanMar styles:
- **Construction (663 orders):** Nike Dri-FIT polo NKDC1963 (supers/PMs), Carhartt Rain Defender hoodie CT100617 + Midweight CTK121, Volunteer VL100 tee, Richardson 112 patch cap, Port Authority W668 plaid flannel, Sport-Tek F281 hoodie + ST469 1/4-zip. Cross-link hi-vis → /custom-safety-apparel.
- **Industrial (Stella-Jones):** PC90H fleece hoodie, Callaway CGM211 polo, Carhartt CT100617, PC61 tee, Eddie Bauer EB544 + Carhartt CT102199 soft shells, TravisMathew TM1MW452 1/4-zip. (More premium — soft shells + Callaway/TM.)
- **Retail (Arrow Lumber, Mud Bay):** Jerzees 363M tee, Port & Co PC68H fleece, District DT8102 hoodie, Bella+Canvas BC3005 V-neck, Comfort Colors 1580 1/4-zip.
- **Government (Pierce County, police):** Next Level NL3600 tee, Nike NKBV6042/NKDC1963 polos, Carhartt CT100617/CTK121, PC90H fleece, CornerStone CS410 tactical polo (police).
- **Hospitality (Hops N Drops — huge volume):** Sport-Tek performance LST700/ST350/ST700 (servers), branded caps (CP96), PC61 tee, Port Authority K810/LK810 polos, kitchen skull caps (HT01).
- **Property mgmt (AMC + communities):** Bella+Canvas BC3001 tee, New Era NEA100 tee + NE200 cap (resident events/leasing), Port & Co PC78/PC78H crew+hoodie, CornerStone CS430 workwear pocket tee (maintenance crews), Nike NKDC1963 polo (office). Split: office staff (polos) vs maintenance (workwear).

## Webstore item pricing model (decided 2026-07-14) — for the product cards on spokes

**Formula = garment ÷ 0.53 (MarginDenominator) + $18 left-chest embroidery (8000-stitch) + a flat $6 handling fee**,
HalfDollarCeil on the decorated part. KEY: the **1-7 and 8-23 embroidery tiers are identical** (same 0.53 margin, same
$18 emb) — the ONLY difference is the 1-7 tier's **$50 LTM fee**; the webstore model replaces that $50 LTM with the $6
handling. Source: proxy `GET /api/pricing-bundle?method=EMB&styleNumber=X` (tiersR + sizes + allEmbroideryCostsR).
**Finding:** this formula is **~30–60% ABOVE** what the InkSoft stores currently charge (stores run ~garment÷0.65 ≈ 35%
margin, no handling). So the formula is a go-forward **price increase / margin recapture** — for existing repeat accounts
(Absher 423 orders) phase it in; for new stores start at the formula. Construction card prices show
`total ($emb + $6 handling)`. Erik chose $6 (not $10; not $50). Prices are hardcoded illustrative examples (Rule 9 caveat —
refresh if garment costs move; ideal long-term = wire the pricing API). Example totals @ $6: CT100617 $117.50, CTK121 $91.50,
NKDC1963 $69.50, 112 $37, W668 $60, ST469 $48.50.

## Spoke build (2026-07-14) — ALL 6 B2B SPOKES BUILT

Live: `/construction-webstores` (deployed v2026.07.14.5). On develop (awaiting deploy): `/restaurant-webstores`,
`/property-management-webstores`, `/industrial-webstores`, `/retail-webstores`, `/government-webstores`. Spokes 3–6
generated from a template (scratchpad `gen-spokes.js` + `/tmp/spoke_products.json` data pull). All EMBROIDERY-ONLY
pricing (emb + $6; Erik: no screen-print/run split on the pages). Each: hero + real-product grid + how + FAQ + CTA,
links to the /company-webstores hub. Hub→spoke linking DONE: all 11 hub store-type cards link to their spokes (verified 2026-07-16).

## Webstore FAQ policy (2026-07-16 — from Pro Paint Solutions / Buddy Walk inquiry; Erik decided)

- **Personalization = AE-ONLY, never on a webstore**: jerseys with individual names/numbers AND sponsor logos route to an
  account executive as a custom team order; webstores carry approved-logo gear only. Now stated on hub FAQ + team-spoke FAQ
  ("Can we get jerseys with our team name, player numbers, and a sponsor logo?"). Matches Erik's email to Nika 2026-07-15.
- **Published order turnaround: ~2 weeks** ("embroidered in-house and shipped within about two weeks") — hub FAQ only, not
  spokes. Store *setup* remains "1–2 weeks" (a different number — don't conflate).
- **Standard pricing copy on ALL 11 spokes + hub (Erik 2026-07-16)**: "first-tier (1–7 piece) left-chest embroidery rate
  plus a flat $6 handling fee … one-time $300 setup fee to build and brand your store" — in every spoke's pricing FAQ
  (added one to construction, which lacked it) AND every ws-pricenote (pricenote says price "includes your left-chest
  embroidered logo"). Second ws-pricenote on all 11 spokes: **DTG offered but ONLY on tested/approved COTTON tees+hoodies**
  ("DTG ink is made for cotton") — poly/performance = embroidery-only; never let store copy imply DTG on polyester. **"No upfront cost" was WRONG and is scrubbed
  site-wide** — the $300 setup applies to fundraising stores too; never re-add that claim. Sweep tooling: scratchpad
  `pricing-copy-sweep.js` pattern (exact-string + expected-count, catches template drift).
- Hub FAQ now covers fundraising give-back (links /fundraising-webstores); fundraising spoke has a "what do you recommend
  for a company organizing shirts for a community event?" answer (limited-run store + AE companion order for personalized items).
- **Gotcha: visible FAQ and FAQPage JSON-LD must stay 1:1 on every webstore page** — hub schema had been missing the visible
  cost Q (fixed 2026-07-16). Validator: parse each ld+json block + compare mainEntity count vs `<details>` count.
- **Fundraising-spoke hero = real story (2026-07-16)**: "Heroes of Twisp" memorial benefit shirt (Caspio file 9457614,
  1920×1280; also og:image) — NWCA t-shirt fundraiser that raised **$6,800 for firefighters' families** (2015 Twisp fire;
  shirt honors the three fallen + injured survivor). Hero trust line captions it — keep caption if image ever changes;
  tone = memorial, keep dignified.
- **Team-spoke `#names-numbers` section (2026-07-16)**: showroom-cta photo+copy block after #products — Lincoln Lynx
  football hoodie (Caspio 9457695, front logo + back name/number in one shot). Message: "Yes — we print names and numbers"
  on shirt/hoodie BACKS, but ALWAYS as an AE team order (roster collected once), NEVER online customization; webstore sells
  the logo gear alongside. Reuses hub's showroom-cta classes from golf-tournament-showcase.css.
- **Fundraising-spoke `#causes` gallery (2026-07-16)**: 4 real breast-cancer-awareness cards between #products and #how —
  Ruthie+Kanha modeling (9457666, uses `--top` crop), CHP pink patch (9457672), Sock it to Cancer (9457678), 25%-to-Cancer-
  Research-Institute donation tee (9457681) + October "start in September" CTA. CSS: `.ws-card__photo--square/--top`
  modifiers in company-webstores.css. Scalable home for future cause shirts (Buddy Walk, memorials — add a card, not a section).

## Spoke build detail

Flat keyword URLs, hub-template (golf-showcase + company-webstores.css), ABSOLUTE asset paths, each with a real
"what this niche puts in their store" product grid + cross-links + CTA → /pages/webstore-inquiry.html. Don't name
specific customers publicly (say "Pacific NW construction crews"). URLs: `/construction-webstores`,
`/property-management-webstores`, `/restaurant-webstores`, `/industrial-webstores`, `/retail-brand-webstores`,
`/government-webstores`. Each added to sitemap-pages.xml + linked from the hub's type cards.

**InkSoft's own advice matched the data:** target specialized/underserved groups + mine your order history; they flag
nonprofits/schools as *their* most profitable, but NWCA's actual money is B2B company stores. Build spokes for the proven
winners first. Each spoke: hero + why-this-niche + recommended products + how-it-works + FAQ + CTA to /pages/webstore-inquiry.html,
links back to the hub, real customer angle where possible. Related: [[blog-content-differentiation]] (industry blog posts
already cover breweries/restaurants/etc. — cross-link spokes ↔ those posts).
