# 253Gear Publisher — artwork → Shopify draft from Steve's dashboard

**Status: IN PROGRESS, foundation built and verified, blocked on Erik creating the Shopify app.**
Started 2026-08-07. Nothing deployed. Nothing on `develop`.

Approved plan: `C:\Users\erik\.claude\plans\we-have-our-retail-zippy-truffle.md` — read it first,
it carries the full design, the rejected alternatives and the verification plan.

## What this is

A tab on Steve's dashboard that turns a finished design into a **draft** product on 253gear.com
(Shopify, `nw-custom-apparel.myshopify.com`) — options, priced variants, images bound to variants,
tags, collections, SEO, alt text — so he never opens the Shopify admin. He reviews the draft and
clicks Publish. Goal is discoverability: customers finding the design on Google.

Reference material (NOT deployed, Python, from a prior Cowork session):
`C:\Users\erik\Downloads\253gear-ops` — its `CLAUDE.md` conventions and gotchas are authoritative.

## Where the code is

**Branch `feature/253gear-publisher` in `caspio-pricing-proxy`.** Not merged, not deployed.
`git checkout feature/253gear-publisher` to resume.

| File | State |
|---|---|
| `src/utils/shopify-client.js` | DONE + tested. Auth, transport, throttle, redaction |
| `src/utils/shopify-product-builder.js` | DONE + tested. Pure; config is a parameter |
| `src/utils/shopify-audit.js` | DONE + tested. `audit.py` port + convention checks |
| `scripts/253gear-inspect.js` | DONE. Read-only Step 0. **Cannot run until creds exist** |
| `src/routes/vision.js` | EDITED — `designDescription` added to prompt + schema |
| `server.js` | EDITED — `extract-shopworks` secret-gated |

**100 new tests, all green. Full proxy suite 1267/1267, no regressions.**
Test files: `shopify-throttle-token`, `shopify-product-builder`, `shopify-variant-media-binding`,
`shopify-audit`, `vision-gate`.

## 🔴 BLOCKED ON ERIK

Create the custom app **"253Gear Publisher"** in the Shopify Dev Dashboard —
scopes `write_products`, `read_products`, `read_publications` — then:

```
heroku config:set -a caspio-pricing-proxy \
  SHOPIFY_SHOP_DOMAIN=nw-custom-apparel.myshopify.com \
  SHOPIFY_CLIENT_ID=… SHOPIFY_CLIENT_SECRET=… \
  SHOPIFY_API_VERSION=2025-01 SHOPIFY_STOREFRONT_ORIGIN=https://253gear.com
```

Then `node scripts/253gear-inspect.js`. Until that runs, three things are **assumptions**:
the `ProductSetInput` field names, what the automatic collections key on, and the live
variant→media binding pattern. Also still unanswered: the **crewneck retail price**, and
confirmation that **PC78 / PC78H** are the SanMar styles behind the hoodie and crewneck.

⏭️ Afterwards: delete the old **"Claude Store Ops"** app (holds `write_themes` + `write_content`).

## Remaining work, in order

1. Caspio tables `Shopify_Config_2026` (key/value, Erik-editable) + `Shopify_Publish_Jobs` (ledger)
2. `src/utils/shopify-ledger.js`, `src/utils/shopify-orchestrator.js`, `src/routes/shopify-products.js`
3. `POST /api/shopify/classify` + `src/routes/shopify-description-ai.js` (wire in `lib/web-search.js`)
4. `dashboards/gear-publisher.html` + 7 JS/CSS files (app repo) — `/dash-page new gear-publisher`
5. App forwarders in `server.js` ~L4361 + TOC ~L110, `requirePageAccess('gear-publisher.html')`
6. ACTIVE_FILES.md, `npm run routes-map`, `memory/API_CHANGELOG.md`
7. Deploy **PROXY FIRST** (born gated, no legacy caller), then the app

## Decisions that are settled — do not relitigate

- **Steve uploads his finished Photoshop mockups.** Auto-generating them from the `/custom-tees`
  canvas engine was designed and then DROPPED. Measured live: `/api/dtg-calibration` returns 2 rows
  for PC54 and **zero for PC78/PC78H**, and on PC54 (the only style with ground truth) the generic
  fallback is off by **1.77×** — a crewneck would show an 11″ print covering ~83% of the garment
  instead of ~46%. Also solves the wrong problem: compositing is what Steve is good at.
  Consequence: **zero coupling to `/custom-tees`**; nothing under `pages/js/` is touched.
- **The photo grid IS the binding surface.** Rows = colours, columns = styles, cells labelled
  `Hoodie · Jet Black`. Binding is correct by construction — no filename parsing, no inference.
  Every Style×Colour cell must be filled before Publish.
- **One image per (Style, Color); Size never decides an image.** Mirrors the theme's photo-click
  handler, so a shopper's chosen size survives clicking a thumbnail. ~3.4 images/product across the
  live catalogue confirms this is what the store already does.
- **Design number + description are MANDATORY**, enforced server-side, not just in the form.
  Steve types them or pastes a ShopWorks screenshot.
- **Draft first, Steve clicks Publish.** Create-only in v1 — no route may modify an existing product.
- **No generic GraphQL passthrough, ever.** `write_products` is catalogue-wide: it could reprice or
  unimage all 47 live products. The surface is a fixed allowlist.
- **Access:** `Staff_Page_Access` row for `gear-publisher.html` with `Allowed_Emails` = Erik +
  `art@nwcustomapparel.com` and no roles (an emails-only rule is an exclusive allowlist).

## Gotchas found this session

- 🔴 **`/api/vision` has FOUR live browser callers** — `transfer-detail.js:1090`,
  `supacolor-orders.js:280` and `:303`, `supacolor-job-detail.js:137`. A blanket gate 401s four
  working staff tools. Only `extract-shopworks` (no browser caller) was gated. Closing the rest
  needs an app forwarder per caller — **separate job, not a rider on this one.**
- 🔴 **The theme leaks the design number into Google's product name.**
  `theme/product-template.CURRENT.liquid:28` sets `itemprop="name"` from `{{ product.title }}` (the
  full title, `#34293` included) while the H1 at L119 correctly uses `display_title`. Affects all 47
  live products. One-word fix, but needs `write_themes` which this app deliberately lacks — **Erik
  should do it once, separately.**
- **`/api/product-details` DOES return `BACK_FLAT`** — 542/542 PC78H rows, 280/280 PC78. An earlier
  claim that back photos don't exist came from querying `/api/product-colors`, which omits back
  fields by design (`products.js:1400-1405`).
- **Booting the proxy locally costs Caspio quota** — `server.js` calls `warmOnBoot()`, which rebuilds
  the design-search index. Probe middleware with a minimal express app instead.

## Reusable things already in the codebase (do not rebuild)

- **`POST /api/vision/extract-shopworks`** (`src/routes/vision.js:88`, Haiku 4.5) already OCRs a
  ShopWorks screenshot → `designNumber`, `designName`, `garments[{partNumber,color,description}]`.
- **`src/utils/mockup-vision.js`** already analyses artwork → `design_text` ("all text visible on the
  design"), `design_description`, `design_colors`; exports `analyzeMockupFromUrl()` (L364).
  `design_text` is the deterministic city classifier — most 253gear designs name the place in the art.
- **`lib/web-search.js`** exists (used by the quote AIs) — wire it into copy drafting so claims are
  CHECKED, not recalled. That is the Flying Boots Cafe failure.
- Async 202+poll precedent: `src/routes/sanmar-orders.js:2271-2291`. Heroku kills a request at 30s.
- Token-cache pattern: `src/utils/supacolor-api.js:22-72`, `src/utils/caspio.js:14-50`.
- Erik-editable Caspio config-table precedent: `src/routes/product-upgrades.js`.
- **Zero new npm dependencies needed** — axios, form-data, node-cache, @anthropic-ai/sdk, sharp.
