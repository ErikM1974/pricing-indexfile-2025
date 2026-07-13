# Blog Content Differentiation — teamnwca.com vs nwcustomapparel.net

**Purpose:** NWCA owns two sites tied into ONE business in Google's knowledge graph
(`sameAs` entity-stitching in index.html + the WordPress mirror). If both blogs chase the
same keywords they **cannibalize** each other — Google splits authority and may rank
neither well. So the two blogs run in **different lanes by search intent.** This is Erik's
SEO strategy (2026-07-13) and it's sound.

## The lane split

| | **nwcustomapparel.net** (WordPress "Corporate site") | **teamnwca.com** (this app — commerce) |
|---|---|---|
| Role | Authority / brand story / TOFU | Commerce / product picks / MOFU–BOFU |
| Intent | Informational ("how / what / why") | Commercial ("which product, what does it cost, buy") |
| Content | How-to, "what is X", glossary, embroidery craft, case studies, company history, marketing/ROI advice | **Product & STYLE content** tied to our catalog: style spotlights, brand roundups, style comparisons, use-case product picks, seasonal drops |
| Links to | Educational deep-dives | Product pages, brand landing pages (`/custom-carhartt` …), quote builders |

**One-line rule when writing a teamnwca.com blog:** answer *"which product/style should I buy
and why"* — NOT *"how does decoration work"* (that's .net's job). Keep it on **product styles,
not education.**

## What .net already covers (so we DON'T duplicate it)

Full export lives at `reference/nwcustomapparel-net-blogs/` (315 posts: 227 published, 69
drafts, 1 private, 18 trash; see its `INDEX.md`). Topic clusters (posts multi-count):

- **Business / marketing / ROI / sourcing — 99** (cost-per-impression, sourcing, employee stores, 4imprint-alternatives)
- **Embroidery craft — 92** (thread, digitizing, density, "how to embroider caps", monograms, patches)
- **Education / how-to / "what is" — 87** (what is screen printing, discharge, CAD-cut vinyl, fabric guides, glossary)
- **Caps / hats — 74** (cap guides, Richardson 112 cost calculator, trucker/sportswear cap guides)
- **Product styles — 71** (older/generic shirt-hoodie-polo posts, some brand: Nike co-branding, Under Armour)
- **Company / history / culture / HR — 66** (since-1977, factory story, rebrand, employee culture)
- **Screen print / DTG / DTF methods — 37**
- **High-viz / safety — 30** (mostly 2023-10-10 drafts: "benefits of high-viz", "how to order reflective in bulk")
- **Case study / customer story — 26** (Arrow Lumber, Lumen Field caps, Cornerstone Electric, Mtn Guides)

## Overlap watch-list (where the two sites could collide)

- **🚨 High-viz / safety** — teamnwca now has the commercial page `/custom-safety-apparel`
  (safety-stripe program, product picks). .net has ~30 educational hi-vis posts. **teamnwca owns
  the COMMERCIAL terms** ("custom safety stripe apparel", "hi-vis shirts with company logo",
  product picks, pricing). Leave the *educational* hi-vis angle ("benefits of reflective PPE",
  "why high-viz matters") to .net. Don't write a teamnwca blog that reprises .net's hi-vis explainers.
- **Caps** — teamnwca = style spotlights / color guides (Richardson, New Era, cap comparisons).
  .net already owns "how to embroider caps" + the Richardson 112 cost explainer. Stay on product/style.
- **Brand/style posts** — .net's product posts are old & generic; teamnwca can own *current, specific*
  style content by leaning on assets .net can't match: the 3,197-style live catalog, `Product_Copy`
  descriptions, and per-style GP/sales data.

## Rules for writing teamnwca.com blogs

1. **Product-style, commercial intent.** Formats that fit: style spotlight ("Carhartt CTK87 — sizing,
   colors, why crews pick it"), brand roundup ("7 best Port & Company tees for screen printing, by
   weight & price"), style vs style ("Richardson 112 vs 112FP vs 112PM"), use-case picks ("best
   hi-vis hoodies for winter crews"), seasonal drops, "decoration on a specific style."
2. **Never copy .net text.** The reference folder exists to CHECK what .net said and deliberately write
   something *different* (different angle, fresh copy). Verbatim reuse = literal duplicate content = both rankings tank.
3. **Link down-funnel:** every teamnwca blog links to the relevant product page / brand landing page /
   quote builder. That's the conversion + internal-link payoff .net can't replicate.
4. **Cross-link, don't compete:** for the "how does it work" background, link OUT to the .net explainer
   ("New to embroidery? See our full guide →") instead of rewriting it here.
5. **Before publishing a topic, scan `reference/nwcustomapparel-net-blogs/INDEX.md`** for an existing .net
   post on the same subject. If one exists → change the angle to product/commercial, or link to theirs.

## Product-style drafts already written (don't duplicate — extend the angle instead)

Created as **Drafts** in Caspio `Blog_Posts` via `caspio-pricing-proxy/scripts/seed-blog-posts.js`
(content JSON in `caspio-pricing-proxy/scripts/blog-posts/product-style-batch{1,2}.json`).
Batch 1 (2026-07-13): `richardson-112-custom-trucker-cap-guide`, `best-carhartt-styles-custom-company-workwear`,
`cornerstone-hi-vis-ansi-safety-styles-custom-workwear`, `best-custom-polos-company-uniforms-sport-tek-port-authority-nike`,
`best-custom-hoodies-winter-crews`. Batch 2 (2026-07-13): `new-era-custom-caps-pro-sports-style`,
`custom-ogio-bags-polos-corporate-gifts`, `best-affordable-custom-tees-gildan-district-port-and-company`,
`premium-branded-jackets-eddie-bauer-north-face-corporate-gifts`, `bella-canvas-3001-soft-retail-tee-merch-brands`,
`travismathew-premium-polos-quarter-zips-golf-client-facing-teams`.
All 15 brand landing pages are now covered. Next angles (not yet written): single-style deep-dives on the very
top-GP styles, seasonal/"2026 best sellers" roundups, decoration-on-a-style ("embroidery vs DTG on X"),
industry use-case product picks (breweries, schools, restaurants) — keep all COMMERCIAL, link to product/quote.

## Related
- Blog system (Caspio `Blog_Posts` → SSR `/blog` + editor + Monday autopilot): [[BLOG_SYSTEM_2026-07]]
- Product copy program (per-style descriptions feeding style content): Product_Copy seeding, proxy v906
- Entity-stitching `sameAs` (index.html + .net mirror) ties both domains to one business.
