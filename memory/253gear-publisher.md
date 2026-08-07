# 253Gear Publisher — artwork → Shopify draft from Steve's dashboard

**Status: CODE COMPLETE, nothing deployed, blocked on two things only Erik can do.**
Started 2026-08-07, finished building 2026-08-08. Nothing is on `develop` in either repo.

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

Branch **`feature/253gear-publisher` in BOTH repos** — proxy and app. Not merged, not deployed.
`git checkout feature/253gear-publisher` in each to resume.

**proxy** (`942dee6` → `93f05a1` → `4dc4a18`)

| File | Role |
|---|---|
| `src/utils/shopify-client.js` | Auth, transport, throttle, redaction |
| `src/utils/shopify-product-builder.js` | Pure; config is a parameter |
| `src/utils/shopify-audit.js` | `audit.py` port + convention checks |
| `src/utils/shopify-config.js` | Caspio key/value config, NO built-in defaults |
| `src/utils/shopify-orchestrator.js` | The create sequence, resumable |
| `src/utils/shopify-classify.js` | Deterministic city match → tags |
| `src/utils/shopify-vision.js` | Narrow, non-persisting mockup read |
| `src/routes/shopify-products.js` | 10 endpoints, fixed allowlist |
| `src/routes/shopify-description-ai.js` | SSE copy drafter + web search |
| `scripts/253gear-inspect.js` | Read-only Step 0 — **needs creds to run** |
| `scripts/253gear-seed-config.js` | Table spec + `--csv-out` seed |

**app** (`3e0e4b75` → `b13ad1cf`) — `dashboards/gear-publisher.html`, its css, 3 JS modules,
10 `/api/gear/*` forwarders in `server.js`, one tab link on `art-hub-steve.html`.

**Tests: proxy 107 suites / 1381 green. App deploy gate 112 suites / 2362 green.**

## 🔴 BLOCKED ON ERIK — two things

**1. Create the app "253Gear Publisher"** (Dev Dashboard, org 25292041): scopes
`write_products`, `read_products`, `read_publications`. Erik types the secret himself —
it must never land in a transcript:

```
heroku config:set -a caspio-pricing-proxy SHOPIFY_SHOP_DOMAIN=nw-custom-apparel.myshopify.com SHOPIFY_CLIENT_ID=… SHOPIFY_CLIENT_SECRET=… SHOPIFY_API_VERSION=2025-01 SHOPIFY_STOREFRONT_ORIGIN=https://253gear.com
```

**2. Create Caspio table `Shopify_Config_2026`** — run
`node scripts/253gear-seed-config.js --csv-out` and import the CSV (Caspio builds the
table from the header row). Widen `Config_Value` to Text(64000).

Then `node scripts/253gear-inspect.js`. Until it runs, three things are **assumptions**:
the `ProductSetInput` field names, what the automatic collections key on, and the live
variant→media binding pattern. Still unanswered: the **crewneck retail price** (its seed
row is deliberately `Active=No` so the code refuses that garment rather than inventing a
price), and whether **PC78 / PC78H** are the right SanMar styles.

## Then, in order

1. `POST /api/shopify/config/refresh-collections` — discovers the real tag vocabulary
2. `Staff_Page_Access` row: `gear-publisher.html` → `Allowed_Emails` = Erik + art@, NO roles
3. Deploy **PROXY FIRST** (born gated, no legacy caller), then the app
4. `npm run routes-map` + `memory/API_CHANGELOG.md` in the proxy
5. Delete the old **"Claude Store Ops"** app (holds `write_themes` + `write_content`)

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
