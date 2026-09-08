// =============================================================================
// OBSERVABILITY: Sentry (roadmap 1.10) — MUST load before Express: v10
// auto-instruments express only if Sentry.init runs before express loads.
// dotenv first so a local .env SENTRY_DSN works; env-gated no-op otherwise.
// =============================================================================
require('dotenv').config();
const Sentry = require('@sentry/node');
const { scrubPII } = require('./lib/sentry-scrub');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.TENANT_ID || 'nwca',
    release: process.env.HEROKU_SLUG_COMMIT ? process.env.HEROKU_SLUG_COMMIT.slice(0, 7) : 'dev',
    tracesSampleRate: 0, // errors only — no performance events (volume/cost control)
    beforeSend: (event) => scrubPII(event), // never leak a customer email/phone (lib/sentry-scrub.js)
  });
  console.log('[Sentry] server error tracking ON (release ' + (process.env.HEROKU_SLUG_COMMIT || 'dev').slice(0, 7) + ')');
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const compression = require('compression');
const stripe = require('./lib/stripe-client');
const rateLimit = require('express-rate-limit');
const cookieSession = require('cookie-session');
const crypto = require('crypto');
const helmet = require('helmet');
// CORS exact-match allowlist (roadmap 1.2) — jest-locked in tests/unit/cors-origin-allowlist.test.js
const { buildAllowlist, isOriginAllowed } = require('./lib/cors-allowlist');

// 3-Day Tees shared modules — the SAME files the browser loads, so the
// server-side authoritative reprice + binding ship-date stamp can never
// disagree with what the customer saw (dual window/module.exports pattern).
const TDT_PRICING = require('./pages/js/3-day-tees-pricing.js');
const TDT_SHIPDATE = require('./pages/js/3-day-tees-shipdate.js');
// Custom T-Shirts (multi-style DTG storefront, 2026-06-10) — same dual-load
// pattern; pricing is INTERNAL-DTG-BUILDER parity (rush opt-in, tier LTM).
const CTS_PRICING = require('./pages/js/custom-tees-pricing.js');
const CTS_SHIPDATE = require('./pages/js/custom-tees-shipdate.js');
// Gallery merchandising helpers (2026-06-12): SanMar-description parsing +
// featured-color variety for the /custom-tees card upgrade. Pure, jest-
// locked, NO pricing math of its own (CTS_PRICING owns all money).
const CTS_MERCH = require('./pages/js/cts-gallery-merch.js');
// Custom Hats ('custom-caps', 2026-06-11) — same dual-load pattern; pricing
// is EMB-CAP-BUILDER parity (CeilDollar, 8-cap minimum, NO LTM/digitizing).
const CAPS_PRICING = require('./pages/js/custom-caps-pricing.js');
// Storefront channel registry — the PURE half (QuoteID prefixes, ShopWorks
// push constants, banners, EmailJS templates; jest-locked). Bound to the
// server-only behaviors in `const CHANNELS` in the storefront section below.
const STOREFRONT_CHANNEL_CONFIG = require('./config/storefront-channels.js');
// Synthesizes quote_items rows from a storefront order's colorConfigs so /quote
// + /invoice render line items (2026-06-12). Pure logic, jest-locked.
const { buildStorefrontQuoteItems } = require('./shared_components/js/storefront-quote-items.js');
// Sample Program (samples channel, 2026-07-06) — dual-load pricing (the SAME
// module the browser's sample buttons use, so screen price === Stripe charge)
// + the pure ManageOrders payload builder for paid sample orders.
const SAMPLE_PRICING = require('./shared_components/js/sample-pricing.js');
const { buildSamplesPushPayload } = require('./shared_components/js/samples-order-payload.js');
// Staff SAML SSO (#2) — this app is the SAML Service Provider against the Caspio
// "Staff" directory App Connection (IdP). Replaces the forgeable /api/crm-session.
const staffSaml = require('./lib/staff-saml.js');

// Environment variables loaded at the very top of this file (dotenv before
// Sentry before express — see the 1.10 block at line 1). This second call is
// a harmless no-op kept so nothing below can regress if the top block moves.
// Preboot disabled 2026-04-24 — deploys now go live in ~20s instead of sticky-session purgatory.
dotenv.config();

// =============================================================================
// ORDER-FORM SECTION: routes/order-form.js owns submission plus legacy cart/catalog/pricing relays.
// The 3-Day Tees submit handler already lives in routes/customer-portal.js.
// QUOTE SYNC: routes/quote-sync.js owns ShopWorks sync and ShipStation submission.
// Staff gates protect operational routes; shared-secret gates admit scheduled jobs/callbacks.
// Customer sync/vendor reads use the quote share link and cannot override the work order.
// QUOTE LIFECYCLE: routes/quote-lifecycle.js owns tracking, change log, acceptance and deposits.
// PUBLIC QUOTES: routes/public-quotes.js owns sticker quotes and token-gated quote retrieval.
// WATCHDOG: one lib/quote-sync-health.js instance is shared by sync and health routes.
// STOREFRONTS: lib/storefront composes tax, stock, channel and pricing services once.
// GALLERY: routes/storefront-gallery.js retains the public gallery aggregate and caches.
// ROUTE TABLE OF CONTENTS (order locked by tests/fixtures/server-route-table.json)
// =============================================================================
//
// INFRASTRUCTURE
//   L17   Security: Input sanitization (sanitizeFilterInput)
//   L67   Security: helmet headers + CSP report-only (roadmap 1.1)
//   L67   Security: CORS exact-match allowlist (lib/cors-allowlist.js, roadmap 1.2)
//   ~L520 Health/observability: GET /healthz, GET /readyz (pricing-proxy probe),
//         GET /api/version, POST /api/csp-report (roadmap 1.11/1.1)
//   L146  Session management (cookie-session — durable across deploys, #8)
//   L166  Rate limiting (apiLimiter, strictLimiter)
//   L414  Body parsing (JSON, urlencoded)
//
// STRIPE & PAYMENTS
//   L530  POST /api/stripe/webhook          — signature-verified; metadata.kind branch records quote deposit/balance payments; else pushes paid 3DT orders to ShopWorks
//   L1490 GET  /api/stripe-config
//   L1510 POST /api/create-payment-intent
//   L1585 POST /api/create-checkout-session — 3DT studio: server-side authoritative reprice + unique QuoteID + promise stamp
//   L1800 POST /api/verify-checkout-session
//   POST /api/quotes/:quoteId/enable-deposit        — STAFF: rep confirms shipping+tax, freezes deposit terms (Service_Codes DEPOSIT-PCT) into Notes JSON (Phase 1, 2026-07-05)
//   POST /api/public/quote/:quoteId/deposit-checkout — PUBLIC: Stripe hosted Checkout for a rep-enabled deposit (server-stored amount + totals-hash re-verify)
//
// 3-DAY TEES (studio rebuild 2026-06-09 — helpers ~L770: getTdtPricingConfig/resolveTdtTax/rebuildTdtQuote)
//   L1860 POST /api/submit-3day-order       — ManageOrders push: placement spec + mockups + dynamic tax labels (channel/rush-aware 2026-06-10)
//   3DT entry URLs (/pages/3-day-tees.html, /3-day-tees[.html]) → 301 /custom-tees (cutover 2026-06-10, registered BEFORE /pages static; success page NOT redirected)
//   GET /pages/{box-labels,jds-mockup-creator,dst-viewer,garment-designer,mockup-library}.html — staff-gated (2026-09-03), registered BEFORE the /pages static mount (~L5343)
//
// CATALOG (customer redesign P2, 2026-06-11)
//   GET /catalog[.html]                     — URL-driven product discovery page (pages/catalog.html)
//   Top-sellers consolidation (2026-07-06): /[pages/]top-sellers-showcase.html → 301 /catalog?topSellers=1;
//   /[pages/]top-sellers-product.html?style=X → 301 /product.html?style=X; /[pages/]richardson-112-product.html → 301 /product.html?style=112
//   (legacy showcase/product/richardson pages deleted; sample program now = catalog Top Sellers view + PDP CTA via shared sample-cart-service.js)
//
// STAFF DASHBOARD FORWARDERS (SAML-gated same-origin reads of secret-gated proxy data)
//   GET /api/mo/orders[...]              — ManageOrders reads (PII airtight path, 2026-07-05)
//   GET /api/staff/payments/recent       — Order_Payments ledger for the Money Collected widget (2026-07-06)
//   GET /api/staff/quote-sessions        — Orders Inbox quote_sessions read (any staff; 2026-08-27)
//   GET /api/staff/daily-sales-by-rep-ytd — Caspio archive per-rep YTD for team performance (any staff; 2026-08-27)
//   GET /api/staff/artrequests           — Art Aging widget ArtRequests read (any staff; 2026-08-27)
//   GET /api/staff/service-codes         — Service_Codes read (CO-ANNUAL-GOAL for the goal chip / Company Numbers; any staff; 2026-09-04)
//   GET /api/staff/employees             — staff roster from lib/staff-roster.js (any staff; 2026-08-27 — was hardcoded in anonymously-served JS)
//   GET /api/staff/finished-photos/library — company-wide finished-photo library w/ rep names (any staff; ~L4356, 2026-07-19)
//   GET /api/staff/command-search        — proxy fan-out search across customers/orders/quotes/designs (any staff; 2026-07-20). UNUSED by the dashboard since 2026-09-03 (its search is tools-only); kept for any other caller
//   ALL /api/crm-proxy/form-submissions* — Forms Inbox reads/updates (any staff; ~L3230, 2026-07-11)
//   ALL /api/crm-proxy/order-odbc*       — ORDER_ODBC order history for the Leads board (any staff; 2026-07-18)
//   ALL /api/crm-proxy/lead-activity*    — Leads CRM timeline reads/appends (any staff; 2026-07-18)
//   GET /api/crm-proxy/ae-dashboard/summary — AE Mission Control aggregate (taneisha/nika/admin;
//     rep email derived from session, admin-only ?viewAs=; ~L3390, 2026-07-19)
//   GET /api/crm-proxy/ae-dashboard/{growth,purchasing,data-quality,due-dates} — the four per-card
//     MC radars, same aeDashboardForwarder identity rules (~L3596-3612). ⚠️ All five must stay
//     listed here: due-dates was silently dropped by a revert and 404'd for a week unnoticed.
//   GET /dashboards/ae-mission-control.html — per-AE cockpit page (role-gated taneisha/nika; ~L3059)
//     + AE post-login landing redirect in the SAML ACS (default relay → mission control; ~L3033)
//   GET /api/mockups[?…], /api/mockups/:id, /api/mockups/broken-mockups,
//   GET /api/mockup-notes/:id, /api/mockup-versions/:id, /api/mockup-notifications
//                                        — mockup record data (mockupForward, ~L3917, 2026-08-11).
//     READS ONLY: the customer approval view writes these paths with no staff session, so
//     PUT/POST stay on the proxy. Replaced a proxy gate that accepted a browser Origin —
//     which is caller-supplied, so one curl flag returned Company_Name/Id_Customer/AE_Notes
//     500 rows at a time. Callers: mockup-detail, art-hub-ruth, ae-dashboard,
//     portal-directory, design-gallery drawer — all repointed same-origin.
//
// 253GEAR PUBLISHER (2026-08-08) — Steve's tab drafts products on the retail storefront.
//   ALL /api/gear/*                      — page-gated forwarders to proxy /api/shopify/* (~L4361)
//   GET /api/gear/store-metrics          — 253gear store metrics for the Design Queue (~L4491)
//     GET  /api/gear/config                       prices, ladder, styles, tag vocabulary
//     GET  /api/gear/products?designNumber=       duplicate check
//     POST /api/gear/products                     create a DRAFT → 202
//     GET  /api/gear/jobs/:designNumber           progress (derived from Shopify)
//     POST /api/gear/jobs/:designNumber/resume    resume a stalled run
//     POST /api/gear/classify                     hero image → city / tags / SEO suggestions
//     POST /api/gear/products/:productId/audit    re-run the pre-publish checks
//     POST /api/gear/products/:productId/publish  the publish click (409s unless audit clean)
//     POST /api/gear/config/refresh-collections   re-read live smart-collection rules
//     POST /api/gear/extract-shopworks            ShopWorks screenshot → design number/name
//       (own handler, not gearForward: targets /api/vision and needs a 12mb body)
//   ⚠️ Gated with requirePageAccess('gear-publisher.html'), NOT bare requireStaff:
//     write_products is catalogue-wide, so this must not be open to every staffer.
//   ⚠️ All nine must stay listed here — see the due-dates note above.
//
// SAMPLE PROGRAM ('samples' channel, 2026-07-06 — SAM{MMDD}-{rand4} QuoteIDs; handleSamplesOrderPaid ~L1400)
//   POST /api/samples/create-checkout-session — PAID blank samples: dedicated multi-style route (shared
//     sample-pricing.js reprice, DOR tax on ship address, free shipping, free items ride as $0 lines);
//     webhook metadata.kind==='samples-order' → ManageOrders push (payments block = PAID) + sales alert.
//     Free-only carts skip this entirely (direct push via sample-order-service.js, unchanged).
//
// CUSTOM HATS (custom-caps storefront, 2026-06-11 — registry entry + rebuildCapsQuote; CAP{MMDD}-{rand4} QuoteIDs)
//   GET /custom-caps[.html]                 — embroidered caps storefront (pages/custom-caps.html); success page via /pages static
//
// QUOTE CART (customer quote-cart Phase 2, 2026-06-11)
//   GET /quote-cart[.html]                  — Add-to-Quote cart page (pages/quote-cart.html; sessionStorage store, engine-priced)
//
// CUSTOM STICKERS (public storefront, 2026-07-24)
//   POST /api/public/sticker-quote           — Phase 2: config in → real STK quote + tokenised share link out.
//                                              Price is RE-QUOTED server-side (browser sends size+qty only);
//                                              the STK sequence is minted only after validation. Honeypot + strictLimiter.
//   GET /custom-stickers[.html] · /stickers  — zero-click sticker configurator (pages/custom-stickers.html)
//                                              One GET /api/sticker-pricing on boot; the ladder re-prices from
//                                              memory, so a size change costs ZERO further calls. Ends in a
//                                              quote-request lead (POST /api/form-submissions, formId
//                                              'quote-request'). Calls NO AI endpoint.
//   (the STAFF sticker tool with the AI drawer was /pricing/stickers — RETIRED 2026-07-29, now a 410 signpost.
//    Its oversize-decal calculator lives on at /pricing/decals — requireStaff, see "STAFF-GATED CALCULATOR PAGES")
//
// CUSTOM T-SHIRTS (multi-style DTG storefront, 2026-06-10 — helpers ~L900: getCtsPricingConfig/getCtsCatalog/resolveCtsShipping/rebuildCtsQuote + stock gate getCtsStock/ctsStockConflicts ~L1135)
//   GET  /custom-tees[.html]                — storefront page (gallery of 20 DTG top sellers + designer + Stripe)
//   POST /api/create-checkout-session       — SHARED with 3DT; orderSettings.channel='custom-tees' selects per-style reprice + DTG-prefix QuoteIDs
//   POST /api/three-day-tees/shipping-estimate — SHARED; accepts styleNumber for per-style UPS weight
//   GET  /api/cts/gallery-extras            — SanMar-card gallery data (2026-06-12): per-style blurb+fabric (parsed PRODUCT_DESCRIPTION) + per-piece ref prices @12/24/48/72 FF via the SAME CTS_PRICING.quote engine (fail-closed; 5-min cache)
//   (webhook above ALSO sends the customer+sales confirmation emails server-side via EmailJS REST
//    and stamps statusToken/emailsSentAt into OrderSettingsJSON — browser sends are fallback, 2026-06-10)
//   GET  /order-status[.html]               — customer order-status page (HMAC-token link from the confirmation email, no login)
//   GET  /api/order-status/:quoteId?t=      — token-gated customer-safe status JSON (timing-safe HMAC check; 404 on bad token)
//
// CUSTOM HATS ('custom-caps' channel — server core 2026-06-11, pages pending;
//   helpers next to the CTS ones: getCapsPricingConfig/getCapsCatalog/
//   capsStockConflicts/rebuildCapsQuote)
//   POST /api/create-checkout-session       — SHARED; orderSettings.channel='custom-caps' selects the caps
//                                             reprice (CAP+CAP-AL bundles + CAPS-SHIP-* fail-closed, qty≥8 → 400)
//   (NO /custom-caps page route yet — add the clean-URL sendFile WITH the page
//    wave; registering it now would be a zombie route, P0 lesson 2026-06-11)
//
// ONLINE ORDER FORM (UI retired 2026-07-11 — /pages/order-form deleted; drafts/approve/share-link routes removed)
//   L1710 POST /api/submit-order-form    — push to ShopWorks (ExtSource: NWCA-OrderForm). RETAINED:
//                                          the DTG builder's submitToShopWorks() pushes through this route.
//
// CRM & AUTH
//   L508  POST /api/crm-session
//   L543  GET  /crm-logout
//   L553  GET  /dashboards/{taneisha,nika,house}-*.html (role-gated)
//
// VENDOR PORTAL (subcontractor magic-link — L&P Screen Printing / Ed Lacey, 2026-07-19)
//   ~L4470 GET  /vendor/login · POST /auth/vendor/request-link · GET /auth/vendor/verify · GET /auth/vendor/logout
//          GET  /vendor                    — portal page (requireVendor; nwca_vendor cookie via lib/vendor-magic-link)
//          GET  /api/vendor/jobs[/:id]     — session-scoped Screen Print transfer orders (allowlist projection)
//          POST /api/vendor/jobs/:id/notes — vendor comment onto the job timeline
//          GET  /vendor/access/:token      — PERMANENT bookmarkable access link (no email round-trip; live Enabled re-check)
//          GET  /api/vendor-admin/access-link?email= — staff-only (portal-admin roles): mint a vendor's permanent link
//          Invite registry: proxy Vendor_Portal_Access (secret-gated /api/vendor-portal-access)
//
// CUSTOMER PORTAL (magic-link; nwca_customer cookie via lib/customer-magic-link) — pages/customer-portal.html
//   ~L5495 GET  /portal · /portal/invoice/:orderNo · /portal/product/:style — session-gated pages (requireCustomer)
//   ~L7230 GET  /api/portal — aggregate (company + mockups + art + logo library + finished photos, allowlist-projected)
//          GET  /api/portal/orders · /api/portal/invoice/:orderNo — ManageOrders orders/balances (ownership-checked)
//          GET  /api/portal/my-products · /recommendations · /product-colors/:style · /product/:style[/availability]
//          POST /api/portal/reorder-request · /reorder-batch — rep-queue requests (Portal_Reorder_Requests, no price)
//          GET  /api/portal/rewards · POST /api/portal/rewards/redeem-request
//   ~L8072 GET  /api/portal/me — sign-in identity (2026-09-01 redesign)
//          GET  /api/portal/quotes — quote sessions for the sign-in email (customer-safe status ladder)
//          GET  /api/portal/order/:orderNo/tracking — ManageOrders /tracking for ONE owned order (drawer, lazy)
//          POST /api/portal/request — general request (quote / new logo / logo change / account update) → rep queue
//   ~L8100 /api/portal-admin/* + /portal-admin/preview/:id/* — staff READ-ONLY mirrors of everything above
//          GET  /api/portal-admin/rewards/accrual/:id — EARNED reward $ from paid+invoiced garment lines (12-mo window,
//               SanMar piece-cost bands from Service_Codes REWARD/RWD-EARN) · POST …/accrual/:id/post — grant per order (Order_Ref)
//               · POST …/accrual/:id/reverse — staff reverses an over-grant after a re-invoice (capped at the unspent balance)
//
// PRODUCT SEO (2026-07-12): /product[.html]?style= = hybrid-SSR head injection
//   (per-product title/meta/canonical/OG/JSON-LD, fail-open) ~L2882;
//   GET /sitemap-products.xml — one URL per unique style (proxy /api/all-styles)
//
// BLOG (server-rendered for SEO; posts = Caspio Blog_Posts via proxy) (2026-07-12)
//   L~3300 GET  /blog · /blog/:slug — SSR pages (5-min cache, marked+xss)
//          GET  /blog/feed.xml · /sitemap-blog.xml
//          GET  /api/blog-product-map — style→posts map for PDP "From our blog" (2026-07-12)
//   GET /custom-carhartt[.html] — static SEO brand landing page (pages/custom-carhartt.html, 2026-07-12)
//   GET /sitemap-pages.xml — core landing/tool pages sitemap (2026-07-12)
//          POST /api/blog-preview (requireStaff — Blog Editor live preview)
//          ALL  /api/crm-proxy/blog-posts* — editor writes/drafts (any staff; ~L3236)
//
// STATIC FILE SERVING
//   /robots.txt — staff/internal dirs + credential share-links disallowed (2026-06-11)
//   GET /api/tenants/:id/config — runtime tenant config for config/tenant.js
//        (backed by config/tenants/<id>.json; strict id allowlist) (2026-07-07)
//   /dist/* — content-hashed build output (scripts/build.js), Cache-Control immutable (2026-07-07)
//   GET /quote-builders/:page — the 3 builder HTMLs served with script/link tags
//        rewritten to hashed /dist assets via dist/asset-manifest.json; falls
//        through to the plain static mount when no build exists (2026-07-07)
//   L567  Static directories (calculators, dashboards, quote-builders, etc.)
//   L624  Directory-to-static mappings (20+ directories)
//
// STAFF DASHBOARD ROUTING (v3 sole survivor — 2026-05-28 cleanup)
//   L770  /staff-dashboard.html         → v3 canonical (serves staff-dashboard-v3/index.html via
//                                          sendHashedHtml — assets content-hashed since 2026-09-04)
//   L775  /staff-dashboard-v2.html      → 301 redirect → /staff-dashboard.html
//   L780  /staff-dashboard-legacy.html  → 301 redirect → /staff-dashboard.html
//   L786  /staff-dashboard-v3/          → v3 dedicated URL (kept for old bookmarks)
//   /quote-builders/dtg-quote-builder-legacy.html → 301 → dtg-quote-builder.html (legacy deleted 2026-06-08)
//
// LEGACY REDIRECTS
//   /cart → 301 /pages/sample-cart.html (legacy Bootstrap cart retired 2026-06-11; cart.html + pages/order-confirmation.html deleted; 7 zombie sendFile routes to missing files removed same day)
//   L657  /calculators/embroidery-contract* → embroidery-pricing-all
//   L662  /staff-dashboard.html → /dashboards/
//   L783  /ae-dashboard.html → /dashboards/
//   L791  /digitizingform.html → /calculators/
//   L806  /christmas-bundles.html → /calculators/
//   L858  /{page}.html → /pages/ (inventory, policies, resources, etc.)
//
// PRODUCT & CATALOG APIs
//   L489  GET  /product (→ product/index.html)
//   L980  GET  / (→ index.html)
//   L992  GET  /api/status
//   L2035 GET  /api/stylesearch
//   L2051 GET  /api/product-colors
//   L2067 GET  /api/sizes-by-style-color
//   L2083 GET  /api/base-item-costs
//   L2099 GET  /api/inventory
//         GET  /api/christmas-products — DELETED 2026-08-17 (anonymous vendor-cost leak)
//   L2328 GET  /api/embroidery-pricing
//   L2346 GET  /api/size-pricing
//   L2397 GET  /api/image-proxy
//
// PRICING MATRIX CRUD
//   L2119 GET  /api/pricing-matrix
//   L2139 POST /api/pricing-matrix
//   L2148 PUT  /api/pricing-matrix/:id
//   L2158 GET  /api/pricing-matrix/lookup
//   L2244 GET  /api/pricing-matrix/:id
//
// CART SYSTEM — legacy CRUD is requireStaff-gated (retired public cart).
// CUSTOMER DIRECTORY — /api/company-contacts[-2026]/*: requireStaff, secret-forwarding relay
//   L1616 GET  /cart
//   L1657 CRUD /api/cart-sessions
//   L1703 CRUD /api/cart-items
//   L1911 CRUD /api/cart-item-sizes
//
// CUSTOMER & ORDER APIS
//   L1959 CRUD /api/customers
//   L1998 CRUD /api/orders
//
// QUOTE SYSTEM (postures HARDENED 2026-08-26 — quote-plane lockdown; the proxy
// side is secret-gated, these same-origin relays are the only browser path.
// Drift-locked by tests/unit/quote-plane-postures.test.js.)
//   CRUD /api/quote_sessions — GET list: staff or quoteID/sessionID-scoped ·
//        GET :id / PUT: requireStaff · POST: quotePlaneWriteLimiter ·
//        DELETE: owner/master session gate
//   CRUD /api/quote_items    — GET list: staff or QuoteID-scoped (query now
//        forwarded verbatim) · GET :id / PUT / DELETE: requireStaff ·
//        POST: quotePlaneWriteLimiter
//   CRUD /api/quote_analytics — reads/PUT/DELETE: requireStaff · POST (view
//        beacon): quotePlaneWriteLimiter
//   GET  /api/quote-sequence/:prefix — anonymous mint relay, quoteSequenceLimiter
//   POST /api/{embroidery,dtf,scp}-push/push-quote + GET …/preview/:quoteId —
//        requireStaff relays (builders + quote-view staff mode)
//
// PUBLIC QUOTE & DESIGN ROUTES
//   GET  /api/quote_items/quote/:quoteId (anonymous capability read)
//   L2789 GET  /design/:designNumber (→ design-view.html)
//   L2896 GET  /art-request/:designId (→ art-request-detail.html)
//   L2798 GET  /quote/:quoteId (→ quote-view.html)
//   L2810 GET  /api/public/quote/:quoteId
//   L2852 POST /api/public/quote/:quoteId/accept
//   L4272 GET  /invoice/:quoteId (→ invoice.html)  — clean PDF-style one-pager, auto-syncs from ShopWorks
//
// SHOPWORKS SYNC (2026-05-21) — quote-view mirrors live ShopWorks state
//   L4308 POST /api/quote-sessions/:quoteId/sync-from-shopworks   — pulls fresh state from MO + writes Caspio (soft-deletes on missing → 30d retention → bulk-sync cron purges)
//   L4445 GET  /api/quote-sessions/:quoteId/full                  — quote_sessions row + parsed ShopWorks_Snapshot for the UI
//   L4520 POST /api/quote-sessions/bulk-sync-from-shopworks       — staff dashboard + hourly cron entry point (sync all stale Processed quotes from last 30d)
//
// FRIENDLY URL ROUTES
//   L1623 /calculators/embroidery-pricing-all → index.html
//   L1628 /pricing/embroidery → embroidery-pricing-all
//   L1634 /pricing/cap-embroidery → cap-embroidery-pricing-integrated
//   L1640 /pricing/dtg → dtg-pricing.html
//   L1644 /pricing/screen-print → screen-print-pricing.html
//   L1648 /pricing/dtf → /pricing/dtf/index.html
//   /pricing/stickers → 410 signpost (retired 2026-07-29)
//   /pricing/decals   → custom-decal-pricing.html (requireStaff)
//   /pages/mockup-generator.html → 301 /pages/dst-viewer.html (retired 2026-08-05;
//     MUST stay above the /pages static mount — see the block at the redirect)
// =============================================================================

const app = express();
const PORT = process.env.PORT || 3000;
// Caspio pricing proxy — the ONE server-side home for this host (roadmap 0.3).
// Every route derives from this constant; override per-deploy via env.
const CASPIO_PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// =============================================================================
// SECURITY: Input Sanitization
// =============================================================================

/**
 * Sanitize input for use in Caspio filter queries
 * Prevents SQL injection by escaping quotes and removing dangerous characters
 */
function sanitizeFilterInput(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  // Remove or escape dangerous characters
  return str
    .replace(/'/g, "''")           // Escape single quotes (SQL standard)
    .replace(/;/g, '')             // Remove semicolons
    .replace(/--/g, '')            // Remove SQL comments
    .replace(/\/\*/g, '')          // Remove block comment start
    .replace(/\*\//g, '')          // Remove block comment end
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|UNION|SELECT)\b/gi, '') // Remove SQL keywords
    .trim()
    .slice(0, 500);                // Limit length
}

/**
 * Idempotency cache for /api/submit-order-form.
 *
 * Maps a client-supplied submissionId (UUID generated per submit attempt)
 * to the response we returned. If a client retries with the SAME submissionId
 * within the TTL window, we return the cached response instead of allocating
 * a new OF-NNNN and pushing again. Protects against:
 *  - Network hiccup mid-response (client retries)
 *  - Browser double-submit despite frontend's `submitting` guard
 *  - Heroku router 503 → client auto-retry
 *
 * Single-process Map — fine for one Heroku dyno. If we ever scale to
 * multiple web dynos, this needs to move to Redis or a Caspio dedup column.
 */
const SUBMIT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 min
const submitIdempotencyCache = new Map(); // submissionId → { response, expiresAt }

function getCachedSubmitResponse(submissionId) {
  if (!submissionId) return null;
  const cached = submitIdempotencyCache.get(submissionId);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    submitIdempotencyCache.delete(submissionId);
    return null;
  }
  return cached.response;
}
function cacheSubmitResponse(submissionId, response) {
  if (!submissionId) return;
  submitIdempotencyCache.set(submissionId, {
    response,
    expiresAt: Date.now() + SUBMIT_IDEMPOTENCY_TTL_MS,
  });
  // Best-effort eviction of expired entries (keep Map from growing forever).
  if (submitIdempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of submitIdempotencyCache) {
      if (now > v.expiresAt) submitIdempotencyCache.delete(k);
    }
  }
}

/**
 * Northwest Custom Apparel physical locations. Used for:
 *  - Customer Pickup shipping addresses (pickup orders ship to here)
 *  - Tax-zip lookups for pickup orders (Milton WA = 10.2% (DOR 2026-07-06))
 *  - Remit-to addresses on invoices
 * Centralizing here so a future move/relocation only updates one place.
 */
const NWCA_LOCATIONS = {
  milton: {
    company: 'Northwest Custom Apparel',
    address1: '2025 Freeman Road East',
    address2: '',
    city: 'Milton',
    state: 'WA',
    zip: '98354',
    country: 'USA',
  },
};

// Soft-delete retention — how many days a Cancelled_in_ShopWorks quote
// stays around before the bulk-sync cron hard-purges it. Audit fix L1
// centralizes this so the dashboard countdown + bulk-sync purge + UI
// banners all agree on a single number. Override via env if AR policy
// changes (e.g., extend to 60d for litigation hold).
const SOFT_DELETE_RETENTION_DAYS = Number(process.env.SOFT_DELETE_RETENTION_DAYS) || 30;

/**
 * Parse a Caspio timestamp as Pacific wall-clock time.
 *
 * Caspio's REST API returns timestamps WITHOUT a timezone marker. They're
 * naive Pacific (America/Los_Angeles) wall-clock strings. Default JS
 * `Date.parse()` on a UTC server (Heroku) interprets them as UTC, shifting
 * by 7–8 hours depending on DST. That breaks every date-math comparison
 * (purge retention, sync staleness, etc.).
 *
 * This is the SERVER-SIDE twin of shared_components/js/caspio-date-utils.js
 * (which exposes window.CaspioDate.parse for the browser).
 *
 * @returns {number} milliseconds since epoch, or NaN on bad input.
 */
function parseCaspioPacificMs(s) {
  if (!s) return NaN;
  if (s instanceof Date) return s.getTime();
  if (typeof s !== 'string') {
    const d = new Date(s);
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  const trimmed = s.trim();
  if (!trimmed) return NaN;
  // Already has explicit timezone (Z or ±HH:MM) — parse as-is.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : NaN;
  }
  // Naive Caspio = Pacific wall-clock. Resolve via Intl.DateTimeFormat,
  // which knows the DST rules for America/Los_Angeles at any instant.
  const probe = Date.parse(trimmed + 'Z');
  if (!Number.isFinite(probe)) return NaN;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(probe));
    const tz = parts.find(p => p.type === 'timeZoneName');
    const m = tz && tz.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return probe;
    const sign = m[1];
    const hh = m[2].length === 1 ? '0' + m[2] : m[2];
    const mm = (m[3] || '00');
    const resolved = Date.parse(trimmed + sign + hh + ':' + mm);
    return Number.isFinite(resolved) ? resolved : probe;
  } catch (_) {
    // Intl unsupported — better to return the probe than nothing.
    return probe;
  }
}

// Safety monitoring system (optional - for development only)
let monitor = null;
let autoRecovery = null;

if (process.env.ENABLE_MONITORING === 'true') {
  console.log('🔍 Monitoring system enabled');
  try {
    const FileAccessMonitor = require('./scripts/safety-tools/file-access-monitor');
    const autoRecoveryModule = require('./scripts/safety-tools/auto-recovery');

    monitor = new FileAccessMonitor();
    autoRecovery = autoRecoveryModule.autoRecovery;
  } catch (error) {
    console.warn('⚠️ Monitoring system files not found. Run with ENABLE_MONITORING=false or install monitoring tools.');
    console.warn('   See MONITORING_SETUP.md for details.');
  }
}

// =============================================================================
// OBSERVABILITY: structured JSON request logs + correlation ids (roadmap 1.12)
// =============================================================================
// Every request gets a UUID (or honors an inbound X-Request-Id), logged as one
// JSON line and echoed back as X-Request-Id — given a failure time, one id
// greps the path across this app AND the proxy (which honors the same header).
// Static/asset traffic is not auto-logged (Heroku log-volume sanity); handlers
// can use req.log.info/error for structured route-level logging. Legacy
// console.log lines still interleave — they migrate opportunistically.
const pinoHttp = require('pino-http');
app.use(
  pinoHttp({
    genReqId: (req, res) => {
      const id = req.headers['x-request-id'] || crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customProps: () => ({ tenant: process.env.TENANT_ID || 'nwca', release: process.env.HEROKU_SLUG_COMMIT ? process.env.HEROKU_SLUG_COMMIT.slice(0, 7) : 'dev' }),
    autoLogging: {
      ignore: (req) =>
        req.url.startsWith('/dist/') ||
        req.url.startsWith('/shared_components/') ||
        /\.(css|js|png|jpg|svg|woff2?|ttf|ico|map)(\?|$)/.test(req.url),
    },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  })
);

// =============================================================================
// SECURITY: HTTP security headers (helmet — roadmap 1.1)
// =============================================================================
// Mounted at the very top of the middleware stack so every response (static
// files included) carries them. CSP runs REPORT-ONLY for now: violations
// POST to /api/csp-report (logged, never enforced) until the report stream
// is quiet, then the policy flips to enforcing. frameguard (X-Frame-Options)
// stays OFF until then too — frame-ancestors in the report-only CSP collects
// the data on who legitimately embeds us without breaking them today.
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  // Target policy: NO 'unsafe-inline' scripts (Top-9 Rule 3 bans inline JS).
  // Report-only violations tell us which legacy pages still cheat before we enforce.
  scriptSrc: [
    "'self'",
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://form.jotform.com',
    // Caspio DataPage embed loaders (staff dashboards / legacy pages)
    'https://c3eku948.caspio.com',
    'https://c2aby672.caspio.com',
    'https://nwcustom.caspio.com',
  ],
  // 'unsafe-inline' styles stay until the 368 inline style="" migrate (1.7/3.7)
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'https://cdn.caspio.com',
  ],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://cdn.caspio.com',
    // Caspio DataPage file storage (/dp/.../files/N) — homepage hero/product
    // images live there (first real catch from the report-only stream).
    'https://c3eku948.caspio.com',
    'https://c2aby672.caspio.com',
    'https://nwcustom.caspio.com',
    'https://cdnm.sanmar.com',
    'https://cdni.sanmar.com',
    'https://www.sanmar.com',
    'https://northwestcustomapparel.box.com',
    // Box "public/static" image links (calculator hero/how-to images) — caught by the
    // report-only stream 2026-09-06 on the screen-print calculator and PC54 product page.
    'https://northwestcustomapparel.app.box.com',
    'https://*.boxcloud.com',
    'https://via.placeholder.com',
    'https://images.squarespace-cdn.com',
    // Customer artwork/gallery thumbs served by the proxy's /api/files/{key}
    // (custom-tees gallery extras, quote-view art) — caught by the report-only
    // stream 2026-08-25; enforce day would blank them without this.
    CASPIO_PROXY_BASE,
  ],
  connectSrc: [
    "'self'",
    CASPIO_PROXY_BASE,
    'https://api.emailjs.com',
    // Sentry browser SDK error ingest (roadmap 1.10)
    'https://o4511700559527936.ingest.us.sentry.io',
    'https://c3eku948.caspio.com',
    'https://c2aby672.caspio.com',
    'https://nwcustom.caspio.com',
  ],
  frameSrc: [
    "'self'",
    // Embedded Caspio DataPages, Box previews, Jotform, YouTube how-tos,
    // Wistia (official ShopWorks training videos on /training pages)
    'https://c3eku948.caspio.com',
    'https://c2aby672.caspio.com',
    'https://nwcustom.caspio.com',
    'https://northwestcustomapparel.box.com',
    'https://app.box.com',
    'https://www.jotform.com',
    'https://form.jotform.com',
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com', // blog post video embeds (lib/blog.js builds these)
    'https://player.vimeo.com',         // blog post video embeds
    'https://fast.wistia.net',
  ],
  frameAncestors: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  reportUri: ['/api/csp-report'],
  // helmet's default set includes upgrade-insecure-requests, which browsers REJECT in a
  // Report-Only policy and log as a console error on every page load (2026-09-06). Drop it
  // until the policy is enforced; HSTS already forces https.
  upgradeInsecureRequests: null,
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: CSP_DIRECTIVES,
      reportOnly: true,
    },
    // Enforced X-Frame-Options would break legit embedders TODAY with zero
    // violation data; frame-ancestors (report-only, above) gathers it first.
    frameguard: false,
    // Our images/JS are consumed cross-origin (Caspio DataPages load
    // /api/cart-integration.js; teamnwca.com hotlinks assets) — 'same-origin'
    // (helmet's default) would silently break them.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: { maxAge: 15552000, includeSubDomains: false }, // 180 days
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// =============================================================================
// SECURITY: CORS Configuration (roadmap 1.2 — exact-match allowlist)
// =============================================================================
// Matching logic lives in lib/cors-allowlist.js (jest-locked). NO substring/
// endsWith matching, NO *.herokuapp.com wildcard, and Allow-Credentials is
// only ever paired with a specific echoed origin — never '*'. Add origins
// without a deploy via the CORS_ALLOWED_ORIGINS env var (comma-separated).
const ALLOWED_ORIGINS = buildAllowlist();

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Responses differ by Origin — caches must key on it (poisoning guard).
  // res.vary() APPENDS (compression() adds Accept-Encoding later; both survive).
  res.vary('Origin');

  if (isOriginAllowed(origin, { allowlist: ALLOWED_ORIGINS })) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  // If origin not allowed (or absent — same-origin/server-to-server needs no
  // CORS), don't set the headers; the browser blocks cross-origin reads.

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// =============================================================================
// HEALTH & OBSERVABILITY ROUTES (roadmap 1.11) — registered before the /api
// rate limiter so a violation storm or aggressive monitor can't starve them.
// =============================================================================
const SERVER_STARTED_AT = Date.now();
// Populated when Heroku dyno metadata is enabled (heroku labs:enable runtime-dyno-metadata)
const RELEASE_SHA_FULL = process.env.HEROKU_SLUG_COMMIT || null;
const RELEASE_SHA = RELEASE_SHA_FULL ? RELEASE_SHA_FULL.slice(0, 7) : null;
const RELEASE_VERSION = process.env.HEROKU_RELEASE_VERSION || null;

// Liveness: is the process up at all. Cheap, no dependencies.
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    release: RELEASE_VERSION,
    sha: RELEASE_SHA,
    uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
  });
});

// Readiness: can this app actually PRICE quotes right now. Probes the pricing
// proxy with a 2s timebox; 503 makes "pricing API down" externally monitorable
// (Erik's #1 rule: a dead pricing dependency must be loud, never silent).
app.get('/readyz', async (req, res) => {
  try {
    const probe = await fetch(`${CASPIO_PROXY_BASE}/api/service-codes`, { timeout: 2000 });
    if (!probe.ok) throw new Error(`pricing proxy responded ${probe.status}`);
    res.json({ status: 'ready', pricingApi: 'ok' });
  } catch (err) {
    console.error('[readyz] pricing API unreachable:', err.message);
    res.status(503).json({ status: 'not-ready', pricingApi: 'unreachable', error: err.message });
  }
});

// Exact release identification — the deploy skill's live-verify (step 14a)
// prefers this over scraping ?v= from HTML. Also carries the Sentry DSN for
// the browser SDK (observability.js) — DSNs are ingest-only public keys.
app.get('/api/version', (req, res) => {
  res.json({ sha: RELEASE_SHA, fullSha: RELEASE_SHA_FULL, release: RELEASE_VERSION, sentryDsn: process.env.SENTRY_DSN || null });
});

// CSP violation intake (roadmap 1.1 — report-only phase). Own tiny limiter so
// a noisy page can't eat the shared /api budget; logs a compact single line.
const cspReportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: false, legacyHeaders: false });
app.post(
  '/api/csp-report',
  cspReportLimiter,
  express.json({ type: () => true, limit: '50kb' }), // browsers send application/csp-report, not application/json
  (req, res) => {
    try {
      const r = (req.body && (req.body['csp-report'] || req.body)) || {};
      console.warn(
        '[CSP-Report]',
        JSON.stringify({
          doc: r['document-uri'] || r.documentURL || null,
          directive: r['violated-directive'] || r.effectiveDirective || null,
          blocked: r['blocked-uri'] || r.blockedURL || null,
        }).slice(0, 500)
      );
    } catch (_) {
      // never let a malformed report 500
    }
    res.sendStatus(204);
  }
);

// Force HTTPS in production (Heroku)
app.use((req, res, next) => {
  // Skip for localhost development
  if (process.env.NODE_ENV === 'production') {
    // Allow Let's Encrypt ACME challenge to pass through (needed for SSL cert validation)
    if (req.path.startsWith('/.well-known/acme-challenge/')) {
      return next();
    }

    // Internal loopback self-calls must NOT be redirected (2026-06-15). The
    // hourly reconciliation crons fetch `http://localhost:$PORT/...` from
    // inside the dyno; that request carries no `x-forwarded-proto` header, so
    // the redirect below would send it to `https://` + req.hostname — and
    // Express's req.hostname strips the port, yielding `https://localhost`
    // (→ :443), which has no listener → ECONNREFUSED. That silently broke the
    // ManageOrders sync-back AND ShipStation tracking crons (rows only ever
    // updated via browser page-load syncs over real HTTPS). Loopback traffic
    // cannot originate externally on Heroku, so it is safe to pass through.
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
      return next();
    }

    // The 'x-forwarded-proto' header is set by Heroku
    if (req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS
      return res.redirect('https://' + req.hostname + req.url);
    }

    // Redirect non-www to www
    if (req.hostname === 'teamnwca.com') {
      return res.redirect(301, 'https://www.teamnwca.com' + req.url);
    }
  }
  return next();
});

// Middleware
// Add monitoring BEFORE static file serving (if enabled)
if (monitor) {
  app.use(monitor.middleware());
}
if (autoRecovery) {
  app.use(autoRecovery.middleware());
}

// Compress all responses
app.use(compression());

// =============================================================================
// SESSION MANAGEMENT (for CRM dashboard authentication)
// =============================================================================
// Trust Heroku's load balancer for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Fail-closed: SESSION_SECRET signs the staff session cookie, which is the SOLE
// proof of a verified SAML login (#2). A known/default secret = forgeable admin
// cookie that bypasses SAML entirely. In production we refuse to boot rather than
// sign cookies with the public default. (Local dev keeps the convenience fallback.)
// Mirrors the fail-closed precedent of computeOrderStatusToken / staff-saml isConfigured.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' &&
    (!SESSION_SECRET || SESSION_SECRET === 'dev-secret-change-in-production')) {
  console.error('FATAL: SESSION_SECRET is unset or the dev default in production. ' +
    'Refusing to start — staff session cookies would be forgeable. Set a strong SESSION_SECRET.');
  process.exit(1);
}

// #8 durable sessions (2026-06-29): the staff session now lives IN a signed cookie
// (cookie-session) instead of the in-memory store, so it SURVIVES dyno restarts and
// deploys — no more "everyone logged out on every deploy." Payload is tiny + non-secret
// (email + role names) and SIGNED (tamper-proof; SESSION_SECRET is the key, guarded
// fail-closed above). Session cookie (no maxAge → expires on browser close), httpOnly,
// secure in prod. Only set after login, so anonymous users get no cookie.
app.use(cookieSession({
  name: 'nwca_staff',
  keys: [SESSION_SECRET || 'dev-secret-change-in-production'],
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  httpOnly: true,
  sameSite: 'lax',
}));

// ── Customer portal session (magic-link, #6) ───────────────────────────────
// A PHYSICALLY SEPARATE signed cookie (nwca_customer) from the staff session, so a
// staff principal and a customer principal can never be confused (privilege isolation).
// Manually HMAC-signed (SESSION_SECRET, via lib/customer-magic-link) so it doesn't collide
// with cookie-session's req.session. loadCustomerSession sets req.customerSession on every
// request; it's null for anyone without a valid customer cookie.
const customerMagicLink = require('./lib/customer-magic-link');
function parseCookieHeader(req) {
  const out = {}; const h = req.headers.cookie; if (!h) return out;
  h.split(';').forEach((part) => {
    const i = part.indexOf('='); if (i < 0) return;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
app.use(function loadCustomerSession(req, res, next) {
  req.customerSession = null;
  const raw = parseCookieHeader(req)['nwca_customer'];
  if (raw) {
    const sess = customerMagicLink.verifySession(raw);
    if (sess) req.customerSession = { portalCustomer: sess };
  }
  next();
});

// ── Vendor portal session (subcontractor magic-link — L&P Screen Printing) ──
// Third principal type, third PHYSICALLY SEPARATE cookie (nwca_vendor) with its own
// token type tags ('vsess' vs 'sess'), so staff/customer/vendor credentials can never
// be confused or replayed across portals. loadVendorSession sets req.vendorSession on
// every request; null for anyone without a valid vendor cookie.
const vendorMagicLink = require('./lib/vendor-magic-link');
app.use(function loadVendorSession(req, res, next) {
  req.vendorSession = null;
  const raw = parseCookieHeader(req)['nwca_vendor'];
  if (raw) {
    const sess = vendorMagicLink.verifySession(raw);
    if (sess) req.vendorSession = { portalVendor: sess };
  }
  next();
});

// =============================================================================
// CRM ROLE-BASED ACCESS CONTROL
// =============================================================================
// Role-based middleware factory - replaces old password-based requireCrmAuth
function requireCrmRole(allowedRoles) {
  return (req, res, next) => {
    // Check if this is an API request (return JSON) vs page request (redirect/HTML)
    const isApiRequest = req.originalUrl.startsWith('/api/');

    if (!req.session?.crmUser) {
      if (isApiRequest) {
        // Return JSON error for API requests - lets frontend handle redirect
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Session expired. Please log in again.'
        });
      }
      // Redirect HTML page requests to Caspio login via staff-login page
      return res.redirect('/dashboards/staff-login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }

    const userPerms = req.session.crmUser.permissions || [];
    const hasAccess = allowedRoles.some(role => userPerms.includes(role));

    if (!hasAccess) {
      if (isApiRequest) {
        // Return JSON error for API requests
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to access this resource.'
        });
      }
      // Return HTML for page requests
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Denied</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   display: flex; align-items: center; justify-content: center; min-height: 100vh;
                   background: #f5f5f5; margin: 0; }
            .container { text-align: center; background: white; padding: 3rem; border-radius: 12px;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 400px; }
            h1 { color: #dc2626; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            a { display: inline-block; padding: 0.75rem 1.5rem; background: #3a7c52; color: white;
                text-decoration: none; border-radius: 8px; font-weight: 500; }
            a:hover { background: #1a472a; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Access Denied</h1>
            <p>You don't have permission to view this dashboard, ${req.session.crmUser.firstName || 'User'}.</p>
            <a href="/staff-dashboard.html">Return to Staff Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    next();
  };
}

// Email-locked page gate — like requireCrmRole but keyed to specific email addresses
// instead of roles. Use for pages that must stay private to named individuals even if
// someone else later gains the 'admin' role: the Staff_Page_Access admin-override
// (userMayAccessPage) does NOT apply to an explicit route like this. Register it BEFORE
// the /dashboards static mount, exactly like the access-admin.html gate.
// accessRestrictedPage() is a hoisted function declaration (defined further below).
function requireCrmEmail(allowedEmails) {
  const allow = allowedEmails.map(e => String(e).toLowerCase());
  return (req, res, next) => {
    const isApiRequest = req.originalUrl.startsWith('/api/');
    if (!req.session?.crmUser) {
      if (isApiRequest) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Session expired. Please log in again.' });
      }
      return res.redirect('/dashboards/staff-login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    const email = String(req.session.crmUser.email || '').toLowerCase();
    if (!allow.includes(email)) {
      if (isApiRequest) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to access this resource.' });
      }
      return res.status(403).type('html').send(accessRestrictedPage(req.session.crmUser.firstName));
    }
    return next();
  };
}

// requireStaff (#2 flip 2026-06-29) — gate a page/route behind ANY verified
// staff session (established only by the SAML ACS). Unauthenticated visitors are
// BOUNCED to SSO login (never hard-locked-out); API calls get 401 + a loginUrl.
function requireStaff(req, res, next) {
  if (req.session && req.session.crmUser) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Sign in required', loginUrl: '/auth/saml/login' });
  }
  return res.redirect('/auth/saml/login?next=' + encodeURIComponent(req.originalUrl));
}

// =============================================================================
// SECURITY: Rate Limiting
// =============================================================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // Limit each IP to 200 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for static files
  skip: (req) => !req.path.startsWith('/api/')
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Process-internal call key: the Stripe webhook self-POSTs /api/submit-3day-order
// through BASE_URL — without this skip, every paid order consumes the shared
// 20/hr strictLimiter bucket (one dyno IP) and order bursts/webhook retries
// would rate-limit REAL paid orders into 'ShopWorks Failed'. The key never
// leaves this process. (3DT rebuild review fix, 2026-06-09)
const INTERNAL_CALL_KEY = require('crypto').randomBytes(24).toString('hex');

// Stricter limit for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20, // 20 requests per hour
  message: {
    error: 'Too many requests to this endpoint, please try again later'
  },
  skip: (req) => req.get('x-nwca-internal') === INTERNAL_CALL_KEY
});

// Apply strict limiting to order submission endpoints
app.use('/api/submit-3day-order', strictLimiter);
app.use('/api/submit-order-form', strictLimiter);
// Fixed 2026-06-09: this limiter was mounted on /api/stripe/create-checkout-session,
// a path that doesn't exist — the REAL checkout route ran unlimited.
app.use('/api/create-checkout-session', strictLimiter);
app.use('/api/samples/create-checkout-session', strictLimiter);






// ── Shared quote_sessions row fetch (webhook + order-status page) ───────────
// refresh=true bypasses the proxy's 5-min lookup cache — a stale [] would
// orphan a PAID order and a stale Status would break idempotency. Exact-match
// the QuoteID — never rows[0] (the 2026-06-01 wrong-quote lesson). Throws on
// a failed lookup (err.httpStatus carries the upstream code) so callers can
// distinguish "no record" (resolves null) from "lookup unavailable" (throws).
// Attach the CRM shared secret to a server→proxy request when configured.
// (References CRM_API_SECRET, declared before factory creation — safe: function
// bodies run at request time, long after module load initializes the const.)
// Every dyno-side call to the proxy's quote data plane must carry this header
// BEFORE the proxy's quote-plane gate flips to enforce (2026-08 lockdown) —
// the header is ignored while the proxy routes are still open, so shipping it
// early is free, and a missing one is the exact bug that froze quote sync for
// a week in 2026-08 (see the /api/mo gate lesson at the sync route below).

// Storefront services share one instance; the channel registry binds the same browser pricing modules.
const { TDT_PROXY, channelConfig, channelConfigExact, getCtsCatalog, getCtsPricingConfig, getCtsStock, resolveCtsShipping, resolveTdtShipping, resolveTdtTax } = require('./lib/storefront')({ CAPS_PRICING, CASPIO_PROXY_BASE, CTS_PRICING, CTS_SHIPDATE, STOREFRONT_CHANNEL_CONFIG, TDT_PRICING, TDT_SHIPDATE, fetch });


const CRM_API_SECRET = process.env.CRM_API_SECRET;
// Payment services share one instance; signature verification stays in the raw-body route.
const { handleQuotePayment, handleStorefrontOrderPaid, PUBLIC_SITE_ORIGIN, QUOTE_TOTALS_HASH_VERSION, QuoteDepositMath, alertQuotePay, autoEnablePickupDeposit, buildOrderStatusUrl, computeOrderStatusToken, computeQuoteTotalsHash, escapeHTMLSrv, fetchQuoteSessionRow, getDepositPct, mintShareToken, parseNotesJson, quoteShareUrl, save3DTQuoteSession, sendEmailJSTemplate, sendQuoteAcceptedEmails, shareTokenOk, totalsHashMatches } = require('./lib/payments')({ PORT, INTERNAL_CALL_KEY, CASPIO_PROXY_BASE, CRM_API_SECRET, TDT_PROXY, buildSamplesPushPayload, buildStorefrontQuoteItems, channelConfig, crypto, fetch, nowPacificNaiveIso, resolveTdtTax, withProxySecret });

function withProxySecret(headers = {}) {
  return CRM_API_SECRET ? { ...headers, 'X-CRM-API-Secret': CRM_API_SECRET } : headers;
}

































// CRITICAL: Stripe webhook needs raw body for signature verification
// This route MUST be defined BEFORE bodyParser.json() middleware
// Stripe raw-body payment webhook — extracted to routes/stripe-webhook.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { express, stripe, handleQuotePayment, handleStorefrontOrderPaid }; require('./routes/stripe-webhook')(app, ctx); }

// Parse JSON and URL-encoded bodies
// Body parser limit bumped to 5mb to accommodate TipTap policy bodies (Policies Hub).
// Default 100kb silently 413s on policies with embedded image references.
// Authenticate payroll before accepting its larger JSON body. Must precede the global parser.
app.use('/api/crm-proxy/payroll/parse', requirePageAccess('payroll.html'), bodyParser.json({ limit: '40mb' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Serve static files from specific directories
const staticOptions = {
  maxAge: '0', // Don't cache static assets
  setHeaders: (res) => {
    // Set no-cache for all files to ensure changes are immediately visible
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
};



// ── 3-Day Tees server-side authoritative pricing ────────────────────────────
// The browser quote is advisory; the money Stripe charges is recomputed HERE
// from the same Caspio sources (pricing-bundle + Service_Codes 3DT-*) via the
// same TDT_PRICING module the page runs. A client/server mismatch over 1¢
// rejects the checkout visibly — never charge a number we didn't derive.






























// ── Custom-Tees gallery extras: card blurbs + reference prices (2026-06-12) ─
// ONE fetch powers the SanMar-style gallery cards (Erik's card upgrade): per
// style → a blurb + fabric chip parsed from SanMar's PRODUCT_DESCRIPTION
// (already in Caspio Sanmar_Bulk — API-driven copy, zero authored text in
// code; a future Caspio Card_Blurb column overrides when non-empty) and
// per-piece reference prices at the nudge quantities, computed by the SAME
// pure CTS_PRICING.quote() + locationForArtSize rule the configurator AND the
// checkout 409-gate run (Rule 7 parity by construction). Tax + shipping are
// excluded (pickup/taxRate 0 — subtotal only); the gallery footnote says so.
// Fail-closed per Erik's #1 rule: a style whose price can't compute returns
// priceError and its card renders "Pricing unavailable" — NEVER a stale or
// guessed number. Copy failures are cosmetic: blurb omitted, console.warn.
// Storefront gallery pricing and merchandising — extracted to routes/storefront-gallery.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CTS_MERCH, CTS_PRICING, TDT_PROXY, fetch, getCtsCatalog, getCtsPricingConfig }; require('./routes/storefront-gallery')(app, ctx); }

















// Serve product.html routes BEFORE static middleware to avoid conflicts.
// SEO hybrid-SSR (2026-07-12): when ?style= is present, the static file goes
// out with a per-product <title>/meta/canonical/OG + Product JSON-LD injected
// (lib/product-seo.js, 60-min cache over the proxy's /api/product-heads catalog
// map — see that file for why) — same pattern as /blog. The client JS
// runs unchanged. ANY failure serves the untouched static file (fail-open).
const productSeo = require('./lib/product-seo');
const productHtmlPath = path.join(__dirname, 'product.html');

async function serveProductPage(req, res) {
  const style = String(req.query.style || req.query.StyleNumber || '').trim();
  if (style) {
    try {
      const head = await productSeo.headForStyle(style);
      if (head) {
        const html = await fs.promises.readFile(productHtmlPath, 'utf8');
        res.set('Cache-Control', 'public, max-age=300');
        // SEO head first, THEN the asset rewrite — the injected <head> must be
        // in the string the rewriter sees, and its 5-min cache header is kept
        // (sendHashedHtml leaves headers alone when given pre-rendered HTML).
        return sendHashedHtml(res, productHtmlPath, productSeo.injectHead(html, head));
      }
    } catch (e) {
      console.error('[product-seo] injection failed (serving static):', e.message);
    }
  }
  sendHashedHtml(res, productHtmlPath);
}

app.get('/product', serveProductPage);
app.get('/product.html', serveProductPage);

// Product sitemap — one URL per unique style (proxy /api/all-styles, cached).
// Referenced from robots.txt; submitted in Google Search Console.
app.get('/sitemap-products.xml', async (req, res) => {
  try {
    const styles = await productSeo.listStyles();
    res.type('application/xml').send(productSeo.renderProductSitemap(styles));
  } catch (e) {
    console.error('[product-seo] sitemap failed:', e.message);
    res.status(503).send('sitemap unavailable');
  }
});

// Removed duplicate routes - these pages are now served from /pages/ directory (see lines 342-347)

// CRM_API_BASE — hoisted here from lines 3425-3425 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const CRM_API_BASE = CASPIO_PROXY_BASE;

// CRM_API_SECRET — hoisted here from lines 3428-3428 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.

const { isStaffOrSync, requireStaffOrSync } = require('./lib/quote-sync-access')({ sharedSecret: CRM_API_SECRET, requireStaff });

// PORTAL_ADMIN_ROLES — hoisted here from lines 3416-3420 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Customer Portal admin console — manage who can log into the customer portal
// (Customer_Portal_Access invites). Open to the management team by ROLE (Erik=admin,
// Bradley=accountant, Ruth=art, Taneisha/Nika=sales). The two rep tags are included so
// Taneisha + Nika are covered regardless of their broader Staff_App_Roles role.
const PORTAL_ADMIN_ROLES = ['admin', 'accountant', 'art', 'sales', 'taneisha', 'nika'];

// CRM dashboard authentication (Caspio-based session) — extracted to routes/crm-auth.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { express }; require('./routes/crm-auth')(app, ctx); }
// Staff SAML SSO — server-verified login (Caspio Staff directory = IdP) + staff page gates — extracted to routes/staff-saml.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { PORTAL_ADMIN_ROLES, SERVER_DIR: __dirname, express, fetchStaffRole, path, requireCrmEmail, requireCrmRole, staffSaml }; require('./routes/staff-saml')(app, ctx); }
// fetchStaffRole — hoisted here from lines 3247-3262 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Fetch a staff member's app-RBAC role from Caspio (Staff_App_Roles via the proxy),
// server-side with the CRM secret. Returns the role string or null. Fail-safe: on any
// error returns null (→ no elevated permissions), never throws into the login flow.
async function fetchStaffRole(email) {
  try {
    const r = await fetch(`${CRM_API_BASE}/api/staff-app-role?email=${encodeURIComponent(email)}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
    });
    if (!r.ok) { console.error('[staff-role] lookup HTTP', r.status, 'for', email); return null; }
    const data = await r.json();
    return data && data.role ? data.role : null;
  } catch (e) {
    console.error('[staff-role] lookup failed:', e.message);
    return null;
  }
}

// _pageAccessCache — hoisted here from lines 3266-3270 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Cached Staff_Page_Access rules (Page → Allowed_Roles/Allowed_Emails), refetched on a
// TTL. STALE-ON-ERROR: a transient proxy failure keeps the last-known rules so a
// restricted page stays restricted (never silently opened). Cold-start + immediate
// fetch failure → empty rules (every page falls back to any-logged-in-staff).
let _pageAccessCache = { at: 0, rules: {} };

// PAGE_ACCESS_TTL_MS — hoisted here from lines 3273-3273 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const PAGE_ACCESS_TTL_MS = 60 * 1000;

// getPageAccessRules — hoisted here from lines 3276-3289 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
async function getPageAccessRules() {
  const now = Date.now();
  if (now - _pageAccessCache.at < PAGE_ACCESS_TTL_MS) return _pageAccessCache.rules;
  try {
    const r = await fetch(`${CRM_API_BASE}/api/staff-page-access`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    if (r.ok) {
      const data = await r.json();
      const rules = {};
      (data.rules || []).forEach(row => { if (row.Page) rules[String(row.Page).toLowerCase()] = row; });
      _pageAccessCache = { at: now, rules };
    } else { console.error('[page-access] fetch HTTP', r.status); _pageAccessCache.at = now; }
  } catch (e) { console.error('[page-access] fetch failed:', e.message); _pageAccessCache.at = now; }
  return _pageAccessCache.rules;
}

// ADMIN_DEFAULT_PAGES — hoisted here from lines 3293-3297 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Page-access decision (who may open a gated staff page) lives in lib/page-access.js so it
// can be jest-locked — tests/unit/admin-page-access.test.js. Read the header there for the
// full rule; the short version is: exclusive email allowlist > admin override > "unlisted
// page = any logged-in staff, EXCEPT the Administration set, which defaults to admin-only".
const { ADMIN_DEFAULT_PAGES, userMayAccessPage } = require('./lib/page-access');

// requirePageAccess — hoisted here from lines 3301-3322 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// API-side twin of gateStaffPage: gate a data route by the SAME Staff_Page_Access row as
// the page it feeds, so one table row controls both and they can never drift apart.
// Unlike gateStaffPage this fails CLOSED — for payroll, "the access check is down" must
// never resolve to "let them in".
function requirePageAccess(page) {
  const key = String(page).toLowerCase();
  return async (req, res, next) => {
    if (!req.session || !req.session.crmUser) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Session expired. Please log in again.' });
    }
    try {
      const rules = await getPageAccessRules();
      if (!userMayAccessPage(req.session.crmUser, rules[key], key)) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this data.' });
      }
    } catch (e) {
      console.error('[page-access] API gate error for ' + key + ':', e.message);
      return res.status(503).json({ error: 'Access check unavailable' });
    }
    return next();
  };
}

// accessRestrictedPage — hoisted here from lines 3326-3343 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Branded 403 page shown when a logged-in staffer opens a page they're not allowed on.
// Self-contained (only the logo is external) so it renders even if assets are down.
function accessRestrictedPage(firstName) {
  const greeting = firstName ? `Sorry, ${firstName} — this` : 'This';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Restricted — Northwest Custom Apparel</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:linear-gradient(135deg,#f5f7f5 0%,#e3f0e7 100%);padding:20px">
<div style="background:#fff;border-radius:16px;box-shadow:0 12px 44px rgba(26,71,42,.13);max-width:440px;width:100%;padding:2.75rem 2.5rem 2.5rem;text-align:center;position:relative;overflow:hidden">
<div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#1a472a 0%,#3a7c52 50%,#1a472a 100%)"></div>
<img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png" alt="Northwest Custom Apparel" style="max-width:190px;height:auto;margin:.25rem 0 1.5rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.08))">
<div style="width:66px;height:66px;margin:0 auto 1.25rem;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center">
<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1a472a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
</div>
<h1 style="color:#1a472a;font-size:1.5rem;margin:0 0 .65rem;font-weight:700">Access Restricted</h1>
<p style="color:#444;font-size:1.02rem;line-height:1.55;margin:0 0 .45rem">${greeting} page is restricted, and your account doesn’t have access to it.</p>
<p style="color:#8a8a8a;font-size:.9rem;line-height:1.5;margin:0 0 1.9rem">If you need access, please ask <strong style="color:#3a7c52">Erik</strong>.</p>
<a href="/staff-dashboard.html" style="display:inline-block;background:#3a7c52;color:#fff;text-decoration:none;font-weight:600;font-size:.98rem;padding:.72rem 1.7rem;border-radius:9px;box-shadow:0 4px 14px rgba(58,124,82,.28)">← Back to Dashboard</a>
</div></body></html>`;
}

// gateStaffPage — hoisted here from lines 3347-3380 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Reusable page gate: require a verified staff session + enforce the Staff_Page_Access
// rule for this page (matched by filename). Used by the /dashboards middleware AND by
// explicit root routes (e.g. the SanMar vendor-portal pages) so EVERY gated page is
// managed the same table-driven way (admin override; page with no rule → any staff).
async function gateStaffPage(req, res, next) {
  if (!req.session || !req.session.crmUser) {
    return res.redirect('/auth/saml/login?next=' + encodeURIComponent(req.originalUrl));
  }
  try {
    const rules = await getPageAccessRules();
    // Decode so an encoded filename (e.g. access-admin%2ehtml) resolves to the real rule.
    let page;
    try { page = decodeURIComponent(req.path.split('/').pop() || '').toLowerCase(); }
    catch (e) { page = (req.path.split('/').pop() || '').toLowerCase(); } // the *.html filename
    if (!userMayAccessPage(req.session.crmUser, rules[page], page)) {
      const fn = String(req.session.crmUser.firstName || '').replace(/[<>&"']/g, '');
      return res.status(403).type('html').send(accessRestrictedPage(fn));
    }
  } catch (e) {
    // Ordinary pages fail OPEN (a broken access check must not take the whole staff
    // portal down). Admin-menu pages fail CLOSED — for those, "the check is down" must
    // never resolve to "let them in" (same stance as requirePageAccess).
    console.error('[page-access] check error:', e.message);
    let page = '';
    try { page = decodeURIComponent(req.path.split('/').pop() || '').toLowerCase(); }
    catch (e2) { page = (req.path.split('/').pop() || '').toLowerCase(); }
    const perms = ((req.session.crmUser && req.session.crmUser.permissions) || []).map(p => String(p).toLowerCase());
    if (ADMIN_DEFAULT_PAGES.has(page) && !perms.includes('admin')) {
      const fn = String(req.session.crmUser.firstName || '').replace(/[<>&"']/g, '');
      return res.status(403).type('html').send(accessRestrictedPage(fn));
    }
  }
  return next();
}

// gateStaffDetailPage — hoisted here from lines 3384-3404 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Gate for the id-addressed detail pages (/mockup/:id, /art-request/:designId).
// These render a shell whose images and Box files ALL ride the staff session
// (requireStaff on /api/box/*), while the record itself loads anonymously — so
// ungated, a signed-out staffer got a page that looked fine with every image
// broken and no way to recover. The staff session cookie has no maxAge (it dies
// with the browser), so this is reached routinely, not just after a long idle.
// Bounce to SSO and come straight back instead.
//
// Deliberately NOT gateStaffPage: that derives a Staff_Page_Access key from the
// last path segment, which for these routes is the record id (e.g. "173") and
// would only ever match by accident. Presence of a staff session is the whole
// rule here.
//
// 🔴 Customer-view links (?view=customer&cid=<token>) are external recipients
// approving a mockup. They carry their own capability token and must never be
// bounced to staff SSO — the token, not this gate, is their authorization.
function gateStaffDetailPage(req, res, next) {
  if (req.query.view === 'customer') return next();
  if (req.session && req.session.crmUser) return next();
  return res.redirect('/auth/saml/login?next=' + encodeURIComponent(req.originalUrl));
}

// BOX_FORWARD_QUERY — hoisted here from lines 3700-3723 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// ── Box asset forwarder (session-gated) ──────────────────────────────────────
// The proxy's Box routes are ANONYMOUS in production: /api/box/download/:fileId
// serves any file the Box service account can see, /api/box/thumbnail/:fileId
// the same as an image, and /api/box/art-folders enumerates 9,147 customer
// folders. They cannot simply be given the shared secret, because ~8 staff
// pages use box/thumbnail as <img> URLs straight from the browser and a browser
// cannot hold a secret.
//
// This is the fix. The browser calls THIS origin, so the SAML session cookie
// rides along automatically — including on plain <img> requests, which is the
// property that makes this work at all. requireStaff proves the session
// server-side, and only the app holds the secret it uses to call the proxy.
// Once every caller is repointed here, the proxy routes get gated and the
// anonymous surface disappears.
//
// 🔴 Deliberately ENUMERATED routes and a numeric fileId check — no wildcard,
// no path passthrough. This forwarder must never become the thing it replaced.
// Every param the callers actually send. `full=1` is what the art/mockup
// lightboxes use for the full-resolution image, and `size=large` the hi-res
// thumbnail — dropping either silently degrades the image rather than failing,
// so this list is checked against the call sites, not guessed.
const BOX_FORWARD_QUERY = new Set([
  'size', 'folderId', 'designNumber', 'limit', 'offset', 'query', 'type', 'url', 'full',
]);

// boxForward — hoisted here from lines 3727-3797 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// opts.query        — narrower param allowlist than the staff default (a customer
//                     route should forward only what it actually needs).
// opts.cacheControl  — force this Cache-Control instead of echoing upstream's.
//                     Needed where the response is a PER-CALLER capability and
//                     must never inherit a public/shared cache header.
function boxForward(buildPath, opts) {
  const allowQuery = (opts && opts.query) || BOX_FORWARD_QUERY;
  const forcedCacheControl = opts && opts.cacheControl;
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[box-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Box proxy is not configured' });
    }
    let suffix;
    try {
      suffix = buildPath(req);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    // Only known params travel onward, so a caller cannot smuggle anything into
    // the upstream URL.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (allowQuery.has(k) && typeof v === 'string') qs.set(k, v);
    }
    const target = `${CRM_API_BASE}/api/box/${suffix}${qs.toString() ? '?' + qs : ''}`;
    try {
      const upstream = await fetch(target, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
      });
      res.status(upstream.status);
      // Carry the headers that make an <img>/download behave; drop the rest.
      //
      // content-length is deliberately ABSENT. node-fetch asks for gzip and
      // inflates the body transparently, so upstream's length describes the
      // COMPRESSED bytes while the pipe below sends the decompressed ones.
      // Copying it framed every response short: a Box search matching 14-20
      // folders died in the browser on "Unterminated string in JSON at position
      // 476", and ~50% of art folders broke the file picker the same way.
      // (Live 2026-08-05 → 2026-08-12.) Our own compression() masked it above
      // ~1 KB gzipped by stripping the header again, which is why it looked
      // intermittent and size-dependent rather than simply broken.
      //
      // Do NOT restore it — and do not "improve" this by copying it only when
      // upstream sent no content-encoding: axios (the proxy's jotform forwarder)
      // DELETES content-encoding after inflating while keeping the stale length,
      // so that test is not portable across clients. Never forward a length you
      // did not measure; let Node frame the response.
      for (const h of ['content-type', 'content-disposition',
                       'cache-control', 'etag', 'last-modified']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      // Box assets are per-staff-session now; never let a shared cache hold one.
      // A forced value WINS over upstream's — the loop above may already have
      // copied a public header across, and for a capability response that would
      // let a shared cache serve one customer's artwork to the next caller.
      if (forcedCacheControl) res.setHeader('Cache-Control', forcedCacheControl);
      else if (!upstream.headers.get('cache-control')) res.setHeader('Cache-Control', 'private, max-age=300');
      if (!upstream.body) return res.end();
      upstream.body.pipe(res);          // node-fetch v2 body is a Node stream
      upstream.body.on('error', (err) => {
        console.error('[box-forward] upstream stream error:', err.message);
        res.destroy(err);
      });
    } catch (err) {
      console.error('[box-forward] ' + target + ' failed:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Box request failed' });
    }
  };
}

// boxFileId — hoisted here from lines 3801-3806 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Box file IDs are numeric; anything else is rejected rather than forwarded.
function boxFileId(req) {
  const id = String(req.params.fileId || '');
  if (!/^\d{1,25}$/.test(id)) throw new Error('Invalid Box file id');
  return id;
}

// CRM API proxy — extracted to routes/crm-proxy.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, PORTAL_ADMIN_ROLES, SAMPLE_PRICING, TDT_PROXY, boxFileId, boxForward, express, fetch, requireCrmRole, requirePageAccess, requireStaff, strictLimiter, withProxySecret }; require('./routes/crm-proxy')(app, ctx); }
// =============================================================================
// POLICIES HUB AI ASSIST — streaming proxy to caspio-pricing-proxy.
// The actual Claude API call lives on the proxy (where ANTHROPIC_API_KEY is
// configured). This handler role-gates via Express session, then pipes the
// SSE response body straight through to the browser. Same client-facing
// contract as before: POST /api/policies/ai-assist returns text/event-stream.
// =============================================================================
app.post(
  '/api/policies/ai-assist',
  requireCrmRole(['policies-admin']),
  express.json({ limit: '1mb' }),
  async (req, res) => {
    const target = `${CRM_API_BASE}/api/policies-ai-assist`;
    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-CRM-API-Secret': CRM_API_SECRET
        },
        body: JSON.stringify(req.body || {})
      });

      // Forward upstream status + the SSE headers
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!upstream.body) {
        res.end();
        return;
      }
      // Pipe the SSE chunks straight through — no buffering, no re-parsing
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
    } catch (e) {
      console.error('[ai-assist proxy] error:', e.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream AI service unavailable', detail: e.message });
      } else {
        res.end();
      }
    }
  }
);
console.log('✓ Policies AI Assist proxy loaded (forwards to caspio-pricing-proxy/api/policies-ai-assist)');

// STICKER / BANNER AI ASSIST — REMOVED 2026-07-29.
//
// This was `POST /api/sticker-ai/chat`, a session-gated streaming forwarder to
// the proxy's /api/contract-sticker-ai/chat. It existed only to serve the AI
// quote drawer on /calculators/sticker-manual-pricing.html; that page was
// retired the same day (its URLs now 410), leaving the endpoint with zero
// callers while still able to reach a lookup_customer tool that returns
// customer name, email, phone, address, sales rep and payment terms. A
// PII-capable endpoint nobody calls is attack surface, not a spare part.
//
// The proxy's /api/contract-sticker-ai/chat still exists and is still gated by
// CRM_API_SECRET, so removing this hop closes the browser-reachable path
// without touching the proxy. Restore from git history if the AI drawer ever
// comes back — and if it doesn't, drop the proxy route too.

// =============================================================================
// AI chat forwarders (session-gated streaming proxies) — extracted to routes/ai-chat.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, requireStaff }; require('./routes/ai-chat')(app, ctx); }
// 253GEAR publisher forwarders (page-gated Shopify proxies) — extracted to routes/gear-publisher.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, path, requirePageAccess, SERVER_DIR: __dirname }; require('./routes/gear-publisher')(app, ctx); }
// sendHashedHtml — hoisted here from lines 4857-4897 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
/**
 * Serve an HTML page with its asset tags rewritten to hashed /dist URLs.
 *
 * Call this INSTEAD of res.sendFile() from a page's own route. Doing the
 * rewrite inside the handler (rather than in a middleware keyed on the URL) is
 * deliberate: most storefront pages answer to pretty aliases as well as the
 * .html path — /catalog, /stickers, /banners, /product — and a path allowlist
 * would silently miss every alias. It also composes with handlers that
 * transform the HTML themselves (product.html injects SEO head tags), which a
 * middleware in front would have bypassed.
 *
 * The HTML itself stays no-store so a new manifest is picked up immediately;
 * only the hashed assets it points at are cached forever.
 *
 * Fail-open at every step — no manifest, unreadable file, anything thrown —
 * serves the original static file. The build is an overlay, never a
 * requirement (a broken build must not take the storefront down).
 *
 * @param {import('express').Response} res
 * @param {string} absPath absolute path to the .html file
 * @param {string} [preRenderedHtml] already-transformed HTML to rewrite instead
 *   of reading from disk (used by the product SEO path)
 */
function sendHashedHtml(res, absPath, preRenderedHtml) {
  const manifest = loadAssetManifest();
  if (!manifest) {
    return preRenderedHtml ? res.type('html').send(preRenderedHtml) : res.sendFile(absPath);
  }
  try {
    const html = preRenderedHtml !== undefined ? preRenderedHtml : loadBuilderHtml(absPath);
    if (preRenderedHtml === undefined) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    return res.type('html').send(rewriteHtmlAssets(html, manifest));
  } catch (err) {
    console.error('[asset-manifest] rewrite failed, serving static:', err.message);
    return preRenderedHtml ? res.type('html').send(preRenderedHtml) : res.sendFile(absPath);
  }
}

// noCacheHeaders — hoisted here from lines 5357-5363 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// No-cache helper used by every staff-dashboard route below so the live
// dashboard always fetches fresh CSS/JS after a deploy.
function noCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// rewriteHtmlAssets — hoisted here from lines 4708-4712 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Serve the three builder pages with script/link tags rewritten to the hashed
// /dist assets. No manifest (build not run) → fall through to the plain
// static mount below and serve the original source paths — the build is an
// overlay, never a requirement.
const { rewriteHtmlAssets, createManifestLoader, createHtmlLoader } = require('./lib/asset-manifest');

// HASHED_PAGES — hoisted here from lines 4715-4715 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const { HASHED_PAGES, HASHED_PAGES_UNDER_PAGES_MOUNT, HASHED_STAFF_UNDER_MOUNT, HASHED_CALCULATOR_PATHS } = require('./lib/hashed-pages');

// loadAssetManifest — hoisted here from lines 4718-4718 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const loadAssetManifest = createManifestLoader(path.join(__dirname, 'dist', 'asset-manifest.json'));

// loadBuilderHtml — hoisted here from lines 4721-4721 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const loadBuilderHtml = createHtmlLoader();

// Blog — server-rendered for SEO, sitemaps, robots, static mounts — extracted to routes/blog.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { HASHED_CALCULATOR_PATHS, HASHED_PAGES, HASHED_PAGES_UNDER_PAGES_MOUNT, HASHED_STAFF_UNDER_MOUNT, express, fs, gateStaffPage, loadAssetManifest, path, requireStaff, sendHashedHtml, staticOptions, SERVER_DIR: __dirname }; require('./routes/blog')(app, ctx); }
// Site pages — staff dashboard, page gates, clean-URL storefront routes and redirects, sitemap — extracted to routes/pages.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { SERVER_DIR: __dirname, express, gateStaffDetailPage, gateStaffPage, noCacheHeaders, path, requireCustomer, requireStaff, sendHashedHtml, staticOptions }; require('./routes/pages')(app, ctx); }
// ════════════════════════════════════════════════════════════════════════════
// Customer Portal — magic-link login (#6). Passwordless, invite-only. Identity is
// the Customer_Portal_Access Caspio table (Erik enables contacts). A verified click
// sets the separate nwca_customer signed cookie (see loadCustomerSession above).
// ════════════════════════════════════════════════════════════════════════════
const CUSTOMER_MAGIC_LINK_TEMPLATE = 'template_utvx9iw'; // EmailJS "Magic Link" template

// Rate-limit link requests per IP — blunts email-bombing + email enumeration probing.
const customerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many sign-in requests. Please wait a few minutes and try again.' },
});

// Live "still enabled?" re-check, 60s-cached. The session cookie is a stateless
// 30-day HMAC, so without this a revoked/disabled customer's cookie would keep
// working until expiry. Returns true when we CAN'T determine (lookup error) so a
// proxy blip never locks out every customer; a definitive disabled/not-found
// (HTTP ok) revokes within ~60s.
const _portalEnabledCache = new Map(); // email → { enabled, t }
const PORTAL_ENABLED_TTL_MS = 60 * 1000;
async function isPortalAccessEnabled(email) {
  const key = String(email || '').toLowerCase().trim();
  if (!key) return true;
  const hit = _portalEnabledCache.get(key);
  if (hit && (Date.now() - hit.t) < PORTAL_ENABLED_TTL_MS) return hit.enabled;
  if (!CRM_API_SECRET) return true; // dev / unconfigured → can't check, fail open
  try {
    const r = await fetch(`${CRM_API_BASE}/api/customer-portal-access/by-email/${encodeURIComponent(key)}`,
      { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return true; // lookup failed → fail open, don't cache (re-check next time)
    const j = await r.json();
    const enabled = !!(j && j.found && j.access && j.access.enabled);
    _portalEnabledCache.set(key, { enabled, t: Date.now() });
    return enabled;
  } catch (e) {
    console.error('[portal] enabled re-check failed:', e.message);
    return true; // network/error → fail open, don't cache
  }
}

// Gate: require a verified customer session. API → 401 + loginUrl; page → redirect to login.
async function requireCustomer(req, res, next) {
  const pc = req.customerSession && req.customerSession.portalCustomer;
  if (!pc || !/^\d+$/.test(String(pc.idCustomer))) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Sign in required', loginUrl: '/customer/login' });
    }
    return res.redirect('/customer/login?next=' + encodeURIComponent(req.originalUrl));
  }
  // Live revocation check — kills a disabled customer's cookie within ~60s.
  try {
    if (pc.email && !(await isPortalAccessEnabled(pc.email))) {
      res.clearCookie('nwca_customer');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Access revoked', loginUrl: '/customer/login' });
      }
      return res.redirect('/customer/login');
    }
  } catch (e) { console.error('[portal] requireCustomer recheck error:', e.message); /* fail open */ }
  return next();
}

// ── Authenticated same-origin forwarder for ManageOrders READS (airtight PII path) ──
// Browser staff pages can call THESE (SAML-cookie authed, same-origin) instead of the
// proxy directly, so the proxy's PII gate can later be tightened from secret-or-origin
// to secret-only. Staff-session gated; forwards to the proxy WITH the CRM secret.
// GET reads only. Callers use moFetch() (shared_components/js/mo-fetch.js), which falls
// back to the direct proxy call if this route 401s (customer context) or errors — so the
// migration can't break any page. The gate flip is the LAST, browser-verified step.
function moForwardTo(buildSubPath) {
  return async (req, res) => {
    if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
    try {
      const qi = req.originalUrl.indexOf('?');
      const qs = qi >= 0 ? req.originalUrl.slice(qi) : '';
      const url = `${CRM_API_BASE}/api/manageorders/${buildSubPath(req)}${qs}`;
      const r = await fetch(url, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
    } catch (e) {
      console.error('[mo-forward]', req.originalUrl, e.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    }
  };
}
// Staff dashboard forwarders (ManageOrders reads, payments, quote sessions, SanMar invoices + FTP, finished photos, command search) — extracted to routes/staff-api.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, moForwardTo, requireCrmRole, requirePageAccess, requireStaff }; require('./routes/staff-api')(app, ctx); }
// Look up an email in the Customer_Portal_Access registry (server-side, secret-gated proxy).
async function fetchPortalAccess(email) {
  if (!CRM_API_SECRET) return null;
  try {
    const r = await fetch(`${CRM_API_BASE}/api/customer-portal-access/by-email/${encodeURIComponent(email)}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.found ? j.access : null;
  } catch (e) { console.error('[customer-login] access lookup error:', e.message); return null; }
}

// Deep-link carry-through for the magic-link logins: the gate sends the visitor to the login page
// with ?next=<path>, the page posts it back alongside the email, and the link we email carries it to
// /verify — which re-validates the prefix before redirecting. Anything not a plain same-site path
// under the portal prefix is dropped (no open redirect, no scheme, no protocol-relative //).
function safeLoginNext(raw, prefix) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s || s.length > 400 || !s.startsWith(prefix) || s.startsWith('//') || /[\s\\<>]/.test(s)) return '';
  if (!/^\/[A-Za-z0-9]/.test(s) || /:\/\//.test(s)) return '';
  return s;
}

// Customer magic-link login (email entry, request link, verify, logout) — extracted to routes/customer-auth.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, PUBLIC_SITE_ORIGIN, SERVER_DIR: __dirname, customerLoginLimiter, customerMagicLink, express, fetch, fetchPortalAccess, path, safeLoginNext, sendEmailJSTemplate }; require('./routes/customer-auth')(app, ctx); }
// BOX_THUMB_RE — hoisted here from lines 6324-6340 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// ── Customer-safe Box proof images (2026-08-05) ─────────────────────────────
// Stored artwork URLs point at the proxy's /api/box/thumbnail/<fileId>, which is
// requireStaff — so since the Box surface was gated a CUSTOMER's <img> 401s and
// every proof in the portal renders broken (measured: 92% of art proofs, 100% of
// the logo library). Swap each one for a capability URL bound to this customer,
// minted only here, where the row has already been authorized as theirs.
//
// Anything that is NOT a Box proxy thumbnail passes through untouched — box.com
// shared links and cdn.caspio.com are public and already work.
// Unanchored on purpose — stored values are absolute proxy URLs, relative paths,
// or the odd hand-pasted link, and all of them should mint. The id it extracts is
// whatever the STORED row contained, so the trust boundary is "who can write that
// row": staff, via the upload routes or the Send Mockup paste field. A staffer
// pasting a crafted URL could therefore attach a Box file to a customer record —
// but they already hold full Box access, so that is a choice they can make
// anyway, not an escalation. A CUSTOMER never reaches this function.
const BOX_THUMB_RE = /\/api\/box\/thumbnail\/(\d+)/;

// API_BASE_URL — hoisted here from lines 8355-8356 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// API configuration
const API_BASE_URL = process.env.API_BASE_URL || `${CASPIO_PROXY_BASE}/api`;

// PORTAL_FETCH_TIMEOUT_MS — hoisted here from lines 6397-6400 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Bound customer-portal upstream fetches: a stalled MO/proxy ABORTS to a visible 503 instead of
// hanging the tab forever (generous 12s — under Heroku's 30s H12, still allows a slow-but-valid
// response). AbortSignal.timeout rejects the fetch → the handler's existing try/catch → 503.
const PORTAL_FETCH_TIMEOUT_MS = 12000;

// portalProxyGet — hoisted here from lines 6403-6410 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
async function portalProxyGet(pathAndQuery) {
  // Server-to-server: always send the CRM secret so the proxy's PII-read gate
  // (artrequests/mockups) admits us. These calls carry no browser Origin.
  const headers = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const r = await fetch(PORTAL_PROXY + pathAndQuery, { headers, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`proxy ${r.status}`);
  return r.json();
}

// makeApiRequest — hoisted here from lines 8364-8399 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Helper function to make requests to the API
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    // CRM secret rides on every proxy call (quote-plane lockdown 2026-08) —
    // ungated proxy routes ignore it; gated ones require it.
    headers: withProxySecret({
      'Content-Type': 'application/json'
    })
  };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }
  
  try {
    console.log(`Making ${method} request to: ${url}`);
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}): ${errorText}`);
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    if (method === 'DELETE') {
      return { success: true };
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// PORTAL_PROXY — hoisted here from lines 6344-6351 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// The portal pages used to read raw rows straight from the public proxy
// (leaking YTD sales, staff emails, art charges, internal notes, and — via a
// broken `searchById` — other companies' data). These app-server endpoints
// fetch server-to-server and return an ALLOWLIST projection: raw proxy rows
// never reach the browser. Phase 1 trusts the URL customerId (data-minimization
// is the win); Phase 2 (magic-link login, #6) swaps `resolvePortalCustomer` to
// derive the customer from a verified session — the projection core is unchanged.
const PORTAL_PROXY = TDT_PROXY; // same caspio-pricing-proxy base

// Vendor Portal — subcontractor magic-link login + screen-print job feed — extracted to routes/vendor-portal.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { BOX_THUMB_RE, CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, PORTAL_ADMIN_ROLES, PORTAL_FETCH_TIMEOUT_MS, PUBLIC_SITE_ORIGIN, SERVER_DIR: __dirname, boxFileId, boxForward, channelConfig, computeOrderStatusToken, crypto, express, fetch, fetchQuoteSessionRow, path, portalProxyGet, rateLimit, requireCrmRole, safeLoginNext, sendEmailJSTemplate, vendorMagicLink }; require('./routes/vendor-portal')(app, ctx); }
// Customer Portal — gated, customer-safe data (magic-link login, orders, invoices, proofs, rewards, reorder) — extracted to routes/customer-portal.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { API_BASE_URL, BOX_THUMB_RE, CASPIO_PROXY_BASE, CRM_API_BASE, CRM_API_SECRET, CUSTOMER_MAGIC_LINK_TEMPLATE, INTERNAL_CALL_KEY, PORTAL_ADMIN_ROLES, PORTAL_FETCH_TIMEOUT_MS, PUBLIC_SITE_ORIGIN, SAMPLE_PRICING, SERVER_DIR: __dirname, TDT_PROXY, boxFileId, boxForward, channelConfig, customerMagicLink, express, fetch, fetchPortalAccess, getCtsStock, nowPacificNaiveIso, path, portalProxyGet, rateLimit, requireCrmRole, requireCustomer, resolveCtsShipping, resolveTdtShipping, resolveTdtTax, save3DTQuoteSession, sendEmailJSTemplate, sendHashedHtml, stripe, withProxySecret }; require('./routes/customer-portal')(app, ctx); }
// SYNC_PROXY_BASE — hoisted here from lines 12241-12241 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
const SYNC_PROXY_BASE = CASPIO_PROXY_BASE;

// Order-form submission and legacy cart, catalog and pricing relays — extracted to routes/order-form.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { API_BASE_URL, CASPIO_PROXY_BASE, CRM_API_SECRET, NWCA_LOCATIONS, SERVER_DIR: __dirname, SYNC_PROXY_BASE, cacheSubmitResponse, fetch, fs, getCachedSubmitResponse, makeApiRequest, monitor, path, requireStaff, sanitizeFilterInput, withProxySecret }; require('./routes/order-form')(app, ctx); }
// quotePlaneWriteLimiter — hoisted here from lines 11841-11851 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Anonymous quote WRITES (create-only) share the proxy's historical budget
// (120 writes / 15 min / IP). Staff sessions skip it — the whole office shares
// one egress IP, and a builder save legitimately fires a dozen POSTs.
const quotePlaneWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!(req.session && req.session.crmUser),
  message: { error: 'Too many quote saves from this address — try again in a few minutes.' },
});

// quoteScopedOrStaff — hoisted here from lines 11850-11860 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Anonymous callers must scope the read to a quote/session they already know.
function quoteScopedOrStaff(req, res, next) {
  if (req.session && req.session.crmUser) return next();
  const q = req.query || {};
  if (q.quoteID || q.QuoteID || q.sessionID || q.SessionID) return next();
  return res.status(401).json({
    error: 'Sign in required',
    message: 'Unscoped quote reads need a staff session; anonymous reads must pass a quoteID.',
    loginUrl: '/auth/saml/login',
  });
}

// originalQueryString — hoisted here from lines 11865-11871 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Forward the original query string byte-for-byte (both QuoteID spellings,
// refresh=true, staff filters, q.orderBy…) — reconstructing from req.query
// silently dropped params for years.
function originalQueryString(req) {
  const qi = req.originalUrl.indexOf('?');
  return qi >= 0 ? req.originalUrl.slice(qi) : '';
}

// Quote data plane relays (quote_sessions / quote_items / quote_analytics postures + sequence mint) — extracted to routes/quote-plane.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { makeApiRequest, originalQueryString, quotePlaneWriteLimiter, quoteScopedOrStaff, requireStaff, sanitizeFilterInput }; require('./routes/quote-plane')(app, ctx); }
// ============================================================================
// Quote delete — role-based server-side enforcement + quote push previews — extracted to routes/quote-delete.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CASPIO_PROXY_BASE, CRM_API_SECRET, fetch, makeApiRequest, originalQueryString, quotePlaneWriteLimiter, quoteScopedOrStaff, rateLimit, requireStaff, sanitizeFilterInput, withProxySecret }; require('./routes/quote-delete')(app, ctx); }
// Public quote view API (no authentication) — extracted to routes/public-quote.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { SOFT_DELETE_RETENTION_DAYS, gateStaffDetailPage, makeApiRequest, path, sanitizeFilterInput, SERVER_DIR: __dirname }; require('./routes/public-quote')(app, ctx); }
// Public banner presets (custom-banners boot payload) — extracted to routes/banner-presets.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CASPIO_PROXY_BASE, fetch }; require('./routes/banner-presets')(app, ctx); }
// Public sticker quotes and quote retrieval — extracted to routes/public-quotes.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CASPIO_PROXY_BASE, PUBLIC_SITE_ORIGIN, express, fetch, makeApiRequest, mintShareToken, sanitizeFilterInput, shareTokenOk, strictLimiter, withProxySecret }; require('./routes/public-quotes')(app, ctx); }
// nowPacificNaiveIso — hoisted here from lines 4168-4183 on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.
// Format "now" as a Pacific naive-wall-clock timestamp matching Caspio's
// expectation (no Z, no offset). Mirrors parseCaspioPacificMs's understanding.
function nowPacificNaiveIso() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find(p => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch (_) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '');
  }
}

// One shared watchdog for bulk-sync recording and health routes.
const { recordQuoteSyncRun, computeQuoteSyncHealth, notifyQuoteSyncHealth } = require('./lib/quote-sync-health')({ fetch });

// Quote and ShopWorks synchronization — extracted to routes/quote-sync.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CASPIO_PROXY_BASE, CRM_API_SECRET, SOFT_DELETE_RETENTION_DAYS, SYNC_PROXY_BASE, buildOrderStatusUrl, channelConfigExact, escapeHTMLSrv, fetch, makeApiRequest, nowPacificNaiveIso, parseCaspioPacificMs, recordQuoteSyncRun, isStaffOrSync, requireStaff, requireStaffOrSync, sanitizeFilterInput, sendEmailJSTemplate, shareTokenOk, withProxySecret }; require('./routes/quote-sync')(app, ctx); }
// Quote sync health, tracking, change log and customer deposits — extracted to routes/quote-lifecycle.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CASPIO_PROXY_BASE, PUBLIC_SITE_ORIGIN, QUOTE_TOTALS_HASH_VERSION, QuoteDepositMath, alertQuotePay, autoEnablePickupDeposit, computeQuoteSyncHealth, computeQuoteTotalsHash, fetch, fetchQuoteSessionRow, getDepositPct, makeApiRequest, notifyQuoteSyncHealth, nowPacificNaiveIso, parseNotesJson, quoteShareUrl, requireStaff, requireStaffOrSync, sanitizeFilterInput, sendQuoteAcceptedEmails, shareTokenOk, strictLimiter, stripe, totalsHashMatches, withProxySecret }; require('./routes/quote-lifecycle')(app, ctx); }
// Box Label Management block DELETED 2026-08-27 (~430 lines): the legacy half of
// the box-labels rebuild. Its /api/box-label-data route had ZERO callers (the
// rebuilt /pages/box-labels.html reads proxy /api/sanmar-orders/label-data) and
// its only upstream, the proxy's /api/box-labels/* routes, was deleted the same
// day (they served ContactEmail/Phone + balances anonymously).


// Start the server
// Sentry express error handler — AFTER all routes, so route throws/rejections
// are captured (then passed on; user-facing behavior unchanged). No-op without DSN.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Using existing Caspio API for quote functionality:');
  console.log('  Quote Sessions: /api/quote_sessions');
  console.log('  Quote Items: /api/quote_items');
  console.log('  Quote Analytics: /api/quote_analytics');
  console.log('  Public Quote View: /quote/:quoteId');
});