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
// ROUTE TABLE OF CONTENTS (~2,900 lines)
// =============================================================================
//
// INFRASTRUCTURE
//   L17   Security: Input sanitization (sanitizeFilterInput, isValidIdentifier)
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
 * Validate that input matches expected pattern (alphanumeric + limited special chars)
 */
function isValidIdentifier(input) {
  if (!input) return false;
  // Allow alphanumeric, hyphens, underscores, dots, spaces
  return /^[a-zA-Z0-9\-_.\s]+$/.test(input);
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
// Role permissions configuration - Erik has full access, others restricted to their dashboards
const CRM_PERMISSIONS = {
  'Erik': ['taneisha', 'nika', 'house', 'policies-admin'],  // Full admin access + policies CMS
  'Taneisha': ['taneisha'],                // Own dashboard only
  'Nika': ['nika']                         // Own dashboard only
};

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

// Staff alert for money-path failures (paid order that didn't reach
// ShopWorks, payment with no Caspio record). Fire-and-forget Slack webhook;
// falls back to the quote-delete channel hook, and ALWAYS error-logs so
// Papertrail catches it even with no Slack configured.
function alert3DT(text) {
  staffAlert('[3DT ALERT] ', '🚨 3-Day Tees: ', '3-Day Tees', text);
}

// ── The one staff-alert pipe (2026-09-07) ──────────────────────────────────
// Every money-path alert goes: (1) console.error so Papertrail always has it,
// (2) Slack if a webhook is configured, (3) EMAIL to the shop through the
// EmailJS template `template_staff_alert` (Erik built it 2026-09-07; params
// to_email / subject / message / source). Neither Slack var was ever set on
// Heroku, so until now a failed payment reached nobody — the email is the path
// that actually lands. Fire-and-forget: alerting must never throw or await.
const STAFF_ALERT_TEMPLATE = 'template_staff_alert'; // ≤24 chars — EmailJS truncates longer IDs
const STAFF_ALERT_DEFAULT_TO = 'erik@nwcustomapparel.com';
function staffAlert(logPrefix, slackPrefix, source, text) {
  console.error(logPrefix + text);
  const hook = process.env.SLACK_ORDER_ALERT_WEBHOOK_URL
    || process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL || '';
  if (hook) {
    fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackPrefix + text }),
    }).catch(() => {/* alerting must never throw */});
  }
  staffAlertEmail(source, text).catch(() => {/* alerting must never throw */});
}
// Resolves false (never throws) when the EmailJS keys are absent (local dev) or the send fails.
async function staffAlertEmail(source, text) {
  if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) return false;
  try {
    await sendEmailJSTemplate(STAFF_ALERT_TEMPLATE, {
      to_email: process.env.ALERT_EMAIL_TO || STAFF_ALERT_DEFAULT_TO,
      subject: `🚨 ${source}: ${String(text).split('\n')[0].slice(0, 120)}`,
      message: String(text),
      source,
    });
    return true;
  } catch (e) {
    console.error('[staff-alert] email failed: ' + (e && e.message));
    return false;
  }
}

// ── Shared quote_sessions row fetch (webhook + order-status page) ───────────
// refresh=true bypasses the proxy's 5-min lookup cache — a stale [] would
// orphan a PAID order and a stale Status would break idempotency. Exact-match
// the QuoteID — never rows[0] (the 2026-06-01 wrong-quote lesson). Throws on
// a failed lookup (err.httpStatus carries the upstream code) so callers can
// distinguish "no record" (resolves null) from "lookup unavailable" (throws).
// Attach the CRM shared secret to a server→proxy request when configured.
// (References CRM_API_SECRET, declared later in this file — safe: function
// bodies run at request time, long after module load initializes the const.)
// Every dyno-side call to the proxy's quote data plane must carry this header
// BEFORE the proxy's quote-plane gate flips to enforce (2026-08 lockdown) —
// the header is ignored while the proxy routes are still open, so shipping it
// early is free, and a missing one is the exact bug that froze quote sync for
// a week in 2026-08 (see the /api/mo gate lesson at the sync route below).
function withProxySecret(headers = {}) {
  return CRM_API_SECRET ? { ...headers, 'X-CRM-API-Secret': CRM_API_SECRET } : headers;
}

async function fetchQuoteSessionRow(quoteID) {
  const url = `${CASPIO_PROXY_BASE}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`;
  const resp = await fetch(url, { headers: withProxySecret() });
  if (!resp.ok) {
    const err = new Error(`Quote lookup failed: HTTP ${resp.status}`);
    err.httpStatus = resp.status;
    throw err;
  }
  const rows = await resp.json();
  const list = Array.isArray(rows) ? rows : (rows && rows.data) || [];
  return list.find((s) => s.QuoteID === quoteID) || null;
}

// ── Customer order-status tokens (Feature B, 2026-06-10) ────────────────────
// URL = the credential: /order-status?id=<QuoteID>&t=<first 12 hex chars of
// HMAC-SHA256(quoteID, ORDER_STATUS_SECRET)>. No secret configured → tokens
// simply don't exist (the API answers 503; we NEVER validate against a
// hardcoded fallback secret).
function computeOrderStatusToken(quoteID) {
  const secret = process.env.ORDER_STATUS_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(String(quoteID)).digest('hex').slice(0, 12);
}

const PUBLIC_SITE_ORIGIN = 'https://www.teamnwca.com';
function buildOrderStatusUrl(quoteID, token) {
  return `${PUBLIC_SITE_ORIGIN}/order-status?id=${encodeURIComponent(quoteID)}&t=${encodeURIComponent(token)}`;
}

// ── Server-authoritative order-confirmation emails (Feature A, 2026-06-10) ──
// The Stripe webhook is the authoritative sender — a buyer who closes the tab
// before the success page polls no longer loses the confirmation. The browser
// (custom-tees-success.js sendEmailsOnce) stays as FALLBACK when the
// orderSettings.emailsSentAt stamp is absent. This is a faithful server-side
// port of that function's template params — keep the two in sync.
// Service id is hardcoded to match the browser sender: the EMAILJS_SERVICE_ID
// env var points at a DIFFERENT service in the same account — do not use it.
const ORDER_EMAILJS_SERVICE = 'service_1c4k67j';
const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function escapeHTMLSrv(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
const moneySrv = (v) => '$' + (Number(v) || 0).toFixed(2);

// Builds the shared template params for template_sample_customer +
// template_sample_sales from the Caspio row's JSON blobs. Returns
// { params, customerEmail } or null when the row has no customer email.
function buildOrderConfirmationParams(quoteSession, stripeSessionId, orderStatusUrl) {
  const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
  const customerData = parse(quoteSession.CustomerDataJSON);
  const colorConfigs = parse(quoteSession.ColorConfigsJSON);
  const orderTotals = parse(quoteSession.OrderTotalsJSON);
  const orderSettings = parse(quoteSession.OrderSettingsJSON);
  if (!customerData.email) return null;

  const esc = escapeHTMLSrv;
  const money = moneySrv;
  const quoteID = quoteSession.QuoteID;
  const sessionId = String(stripeSessionId || '');

  // Product name from the server-stamped order settings (multi-style);
  // legacy rows without one fall back to the channel's default (PC54 name).
  const productLabel = esc(orderSettings.styleName || channelConfig(orderSettings.channel).fallbackProductName)
    + (orderSettings.rush ? ' <strong>(3-Day Rush)</strong>' : '');
  let productsTable = '<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
  Object.values(colorConfigs || {}).forEach((config) => {
    Object.entries((config && config.sizeBreakdown) || {}).forEach(([size, sd]) => {
      if (sd && sd.quantity > 0) {
        productsTable += `<tr><td>${productLabel}</td><td>${esc(config.displayColor)}</td>` +
          `<td>${esc(size)}</td><td>${sd.quantity}</td><td>${money(sd.unitPrice)}</td></tr>`;
      }
    });
  });
  productsTable += '</tbody></table>';

  const paymentConfirmation =
    `<div class="alert-success"><strong>✓ Payment Confirmed</strong><br>` +
    `<span style="font-size:14px;">Amount: ${money(orderTotals.grandTotal)}</span><br>` +
    `<span style="font-size:12px;color:#6b7280;">Stripe Session: ${esc(sessionId.substring(0, 20))}…</span></div>`;

  const messageSection = customerData.notes
    ? `<div class="section"><h2>📝 Special Instructions</h2><p style="background:#f9fafb;padding:15px;border-radius:6px;border-left:4px solid #2d5f3f;">${esc(customerData.notes)}</p></div>`
    : '';

  // Ship promise + delivery section (server-stamped — never recomputed)
  const sp = orderSettings.shipPromise || {};
  const shipPromiseLabel = sp.rangeLabel || sp.label || '7–10 business days';
  const isPickup = customerData.deliveryMethod === 'pickup';
  const deliverySection = isPickup
    ? '<p><strong>Pickup</strong> — 2025 Freeman Rd E, Milton, WA 98354<br>' +
      '<span style="font-size:13px;color:#6b7280;">We’ll call you the moment your order is ready.</span></p>'
    : `<p><strong>Ship to (UPS Ground):</strong><br>` +
      `${esc(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim())}<br>` +
      `${esc(customerData.address1 || '')}<br>` +
      `${esc(customerData.city || '')}, ${esc(customerData.state || '')} ${esc(customerData.zip || '')}</p>`;

  // Money rows that make Subtotal → Total visibly foot. Empty string when the
  // row doesn't apply so the template row collapses. A SHIP order with $0
  // shipping is free-over-threshold → show FREE.
  const totRow = (label, txt) =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">` +
    `<span>${label}</span><span>${txt}</span></div>`;
  const shippingRow = isPickup ? ''
    : totRow('UPS Ground shipping', orderTotals.shipping > 0 ? money(orderTotals.shipping) : 'FREE');
  const taxRow = orderTotals.salesTax > 0 ? totRow('Sales tax', money(orderTotals.salesTax)) : '';
  const ltmRow = orderTotals.ltmFee > 0 ? totRow('Small-batch fee', money(orderTotals.ltmFee)) : '';

  const mailSubject = encodeURIComponent(`Order ${quoteID} — question or change`);
  const questionsCta =
    `<p style="font-size:13px;color:#374151;">Questions or changes? Call 253-922-5793 or email ` +
    `<a href="mailto:sales@nwcustomapparel.com?subject=${mailSubject}">sales@nwcustomapparel.com</a> — ` +
    `mention order ${esc(quoteID)}. Changes are free until we print.</p>`;

  // Customer-typed fields are escaped — these land in HTML email bodies.
  const params = {
    order_number: esc(quoteID),
    customer_name: esc(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()),
    customer_email: esc(customerData.email),
    customer_phone: esc(customerData.phone || ''),
    company_name: esc(customerData.company || ''),
    print_location: esc(orderSettings.printLocationName || 'Left Chest'),
    payment_confirmation: paymentConfirmation,
    products_table: productsTable,
    subtotal: money(orderTotals.subtotal),
    total: money(orderTotals.grandTotal),
    ship_promise: esc(shipPromiseLabel),
    delivery_section: deliverySection,
    shipping_row: shippingRow,
    tax_row: taxRow,
    ltm_row: ltmRow,
    rush_flag: orderSettings.rush ? '3-DAY RUSH' : '',
    // HTML banner block — yellow rush callout on rush orders, empty
    // (collapses) on standard ones. Templates render {{{rush_banner}}}
    // so ONE template serves both modes (EmailJS has no conditionals).
    rush_banner: orderSettings.rush
      ? '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:14px 0;">' +
        '<strong style="color:#92400e;">⚡ 3-Day Rush Service</strong>' +
        '<span style="font-size:13px;color:#92400e;"> — this order is on the rush production schedule.</span></div>'
      : '',
    questions_cta: questionsCta,
    message_section: messageSection,
    company_phone: '253-922-5793',
    reply_to: 'sales@nwcustomapparel.com',
  };
  // Status-page link (Feature B). Omitted when no token — the template's
  // {{order_status_url}} placeholder renders unresolved, which is acceptable.
  if (orderStatusUrl) params.order_status_url = orderStatusUrl;

  return { params, customerEmail: customerData.email };
}

// One EmailJS REST send with an 8s timeout. Throws on failure — callers
// catch; email errors must NEVER block the webhook or the ShopWorks push.
async function sendEmailJSTemplate(templateId, templateParams) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const resp = await fetch(EMAILJS_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: ORDER_EMAILJS_SERVICE,
        template_id: templateId,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: templateParams,
      }),
      signal: ctl.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`EmailJS HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

// Sends BOTH confirmation emails (customer + sales) in parallel. Fail-soft:
// missing env keys → one warn + skip (local dev; browser fallback sends);
// send errors → console.error, never throw. Returns { customerOk, salesOk }.
async function sendOrderConfirmationEmails(quoteSession, stripeSessionId, statusToken) {
  if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
    console.warn('[Webhook] EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY not set — skipping server-side confirmation emails (browser fallback will send).');
    return { customerOk: false, salesOk: false };
  }
  const orderStatusUrl = statusToken ? buildOrderStatusUrl(quoteSession.QuoteID, statusToken) : null;
  const built = buildOrderConfirmationParams(quoteSession, stripeSessionId, orderStatusUrl);
  if (!built) {
    console.warn('[Webhook] No customer email on', quoteSession.QuoteID, '— skipping confirmation emails.');
    return { customerOk: false, salesOk: false };
  }
  const { params, customerEmail } = built;
  // Template ids come from the channel registry (legacy/absent channel →
  // 3DT default — both live channels share the tee templates today).
  let osForTemplates = {};
  try { osForTemplates = JSON.parse(quoteSession.OrderSettingsJSON || '{}'); } catch (_) { /* legacy row */ }
  const emailCfg = channelConfig(osForTemplates.channel).emails;
  const [customerOk, salesOk] = await Promise.all([
    sendEmailJSTemplate(emailCfg.confirmationCustomerTemplate, Object.assign({
      to_email: customerEmail,
      to_name: params.customer_name,
    }, params)).then(
      () => { console.log('[Webhook] ✓ Customer confirmation email sent for', quoteSession.QuoteID); return true; },
      (e) => { console.error('[Webhook] Customer confirmation email failed for', quoteSession.QuoteID, ':', e.message); return false; }
    ),
    sendEmailJSTemplate(emailCfg.confirmationSalesTemplate, Object.assign({
      to_email: 'erik@nwcustomapparel.com',
      to_name: 'NWCA Sales',
    }, params)).then(
      () => { console.log('[Webhook] ✓ Sales confirmation email sent for', quoteSession.QuoteID); return true; },
      (e) => { console.error('[Webhook] Sales confirmation email failed for', quoteSession.QuoteID, ':', e.message); return false; }
    ),
  ]);
  return { customerOk, salesOk };
}

// Quote-acceptance emails (customer receipt + rep alert). Fully fail-soft — missing
// env keys or not-yet-created EmailJS templates → warn + skip, NEVER throws, so it is
// safe to ship before the templates exist. Templates (Erik creates on emailjs.com):
//   template_quote_accepted_customer — params: to_name, to_email, quote_id, quote_amount
//   quote_accepted_staff             — params: quote_id, customer_name, customer_email,
//                                                company_name, quote_amount, quote_url, to_email
//   NOTE: EmailJS caps Template IDs at 24 chars, so the staff ID is short —
//   "template_quote_accepted_staff" (29) gets silently truncated in their editor.
const QUOTE_ACCEPTED_CUSTOMER_TEMPLATE = 'template_quote_accepted_customer';
const QUOTE_ACCEPTED_STAFF_TEMPLATE = 'quote_accepted_staff';
async function sendQuoteAcceptedEmails(session, acceptName, acceptEmail) {
  if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
    console.warn('[QuoteAccept] EMAILJS keys not set — skipping acceptance emails.');
    return;
  }
  const quoteId = session.QuoteID;
  const amount = Number(session.TotalAmount || 0).toFixed(2);
  const companyName = session.CompanyName || '';
  const repEmail = (session.SalesRepEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.SalesRepEmail))
    ? session.SalesRepEmail : 'sales@nwcustomapparel.com';
  const quoteUrl = quoteShareUrl(quoteId, session);
  // Customer receipt → the person who just accepted.
  sendEmailJSTemplate(QUOTE_ACCEPTED_CUSTOMER_TEMPLATE, {
    to_email: acceptEmail, to_name: acceptName, quote_id: quoteId, quote_amount: amount,
  }).then(
    () => console.log('[QuoteAccept] ✓ customer receipt sent for', quoteId),
    (e) => console.error('[QuoteAccept] customer receipt failed for', quoteId, ':', e.message)
  );
  // Rep alert → the quote's sales rep (fallback to the sales inbox).
  sendEmailJSTemplate(QUOTE_ACCEPTED_STAFF_TEMPLATE, {
    to_email: repEmail, to_name: session.SalesRepName || 'NWCA Sales',
    quote_id: quoteId, customer_name: session.CustomerName || acceptName,
    customer_email: session.CustomerEmail || acceptEmail, company_name: companyName,
    quote_amount: amount, quote_url: quoteUrl,
  }).then(
    () => console.log('[QuoteAccept] ✓ rep alert sent for', quoteId),
    (e) => console.error('[QuoteAccept] rep alert failed for', quoteId, ':', e.message)
  );
}

// ══ Online quote-deposit payments (Storefront Checkout Phase 1, 2026-07-05) ══
// Rep-in-loop model: a rep ENABLES the deposit on an Accepted quote (confirming
// the shipping $ + tax-rate % that WQ web quotes intentionally save as 0 — see
// web-quote-service.js "rep calculates tax at confirmation"), the customer pays
// through Stripe HOSTED Checkout from the quote page, and the shared Stripe
// webhook records it via the metadata.kind branch. The deposit block + payments
// array live in the quote's Notes JSON (primary record); the Order_Payments
// Caspio ledger is a fail-soft mirror. Money math is in the dual-load module
// below (jest-locked); deposit % comes from Service_Codes DEPOSIT-PCT.
const QuoteDepositMath = require('./shared_components/js/quote-deposit-math.js');

// Deposit receipts — fail-soft like the acceptance emails above; safe to ship
// before the templates exist. Erik creates on emailjs.com (IDs ≤ 24 chars):
//   template_deposit_cust  — to_name, to_email, quote_id, amount_paid, balance_due, grand_total
//   template_deposit_staff — to_email, to_name, quote_id, customer_name, customer_email,
//                            company_name, amount_paid, balance_due, quote_url
const DEPOSIT_CUSTOMER_TEMPLATE = 'template_deposit_cust';
const DEPOSIT_STAFF_TEMPLATE = 'template_deposit_staff';

// Notes-JSON reader that never loses data: legacy plain-text Notes (3DT rows
// append free text) are preserved under _legacyText instead of being clobbered
// on the next JSON.stringify.
function parseNotesJson(notesStr) {
  if (!notesStr) return {};
  try {
    const v = JSON.parse(notesStr);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : { _legacyText: String(notesStr) };
  } catch (_) {
    return { _legacyText: String(notesStr) };
  }
}

// =============================================================================
// SHARE-LINK TOKENS (2026-07-24)
//
// Quote IDs are a short sequential counter (STK-2026-001, EMB-2026-314…) and
// GET /api/public/quote/:id + /api/quote-sessions/:id/full are both anonymous,
// so anyone could walk the range and read customers' quotes — company, contact,
// line items and prices.
//
// Fix, deliberately BACKWARD-COMPATIBLE (Erik's call 2026-07-24): every quote
// saved from now on carries an unguessable token in Notes.share_token, and its
// share link must carry `?k=`. A row WITHOUT a stored token is a pre-existing
// quote, and is still served without one — so no link already sitting in a
// customer's inbox breaks. As old quotes age out the exposure closes itself.
//
// Staff sessions bypass the check entirely, so reps opening a quote from the
// dashboard never need the token.
// =============================================================================
function mintShareToken() {
  return crypto.randomBytes(16).toString('base64url'); // 22 chars, url-safe
}

/**
 * The customer-facing URL for a quote, WITH its share token when it has one.
 *
 * 🔴 Use this everywhere a /quote/ link is handed to a customer — acceptance
 * emails, payment receipts, Stripe return URLs, rep "copy link". Building
 * `${PUBLIC_SITE_ORIGIN}/quote/${id}` by hand sends a tokenised quote a link
 * that 404s, and the customer has no way to tell it apart from a deleted quote.
 * Legacy rows have no token and come back exactly as before.
 */
function quoteShareUrl(quoteId, sessionOrNotes) {
  const base = `${PUBLIC_SITE_ORIGIN}/quote/${encodeURIComponent(quoteId)}`;
  try {
    const src = sessionOrNotes && sessionOrNotes.Notes !== undefined ? sessionOrNotes.Notes : sessionOrNotes;
    const notes = typeof src === 'string' ? JSON.parse(src) : (src || {});
    if (notes && notes.share_token) return `${base}?k=${encodeURIComponent(notes.share_token)}`;
  } catch (_) { /* unparseable → legacy, no token */ }
  return base;
}

/**
 * Returns true when the request may read this session.
 * Legacy rows (no stored token) stay readable — that is the compatibility
 * promise, not an oversight.
 */
function shareTokenOk(req, session) {
  if (req.session && req.session.crmUser) return true;   // staff
  let stored = null;
  try {
    const notes = typeof session.Notes === 'string' ? JSON.parse(session.Notes) : (session.Notes || {});
    stored = notes && notes.share_token ? String(notes.share_token) : null;
  } catch (_) { /* unparseable Notes → treat as legacy */ }
  if (!stored) return true;                              // legacy quote

  const supplied = String(req.query.k || '');
  if (supplied.length !== stored.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(stored));
}

// Binds a payment link to the exact numbers the rep enabled. Recomputed from
// the CURRENT row before every Stripe session and again at the webhook — a rep
// edit after enablement can never be charged at stale amounts.
//
// 🔐 v2 (2026-07-24) is an HMAC. v1 was a bare SHA-256 over
// quoteID|subtotal|grandTotal|depositAmount — every input of which is visible to
// (or guessable by) the payer, so anyone could compute a "valid" hash for
// amounts of their choosing. That is not an integrity check on a link that
// charges a card.
//
// Deposits enabled BEFORE the cutover carry no hashVersion and are still
// verified with v1, so no rep has to re-enable anything. New deposits are
// stamped hashVersion:2 and are verified with the HMAC ONLY — accepting either
// form for a new deposit would leave the v1 forgery open and make this pointless.
function totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount) {
  return [quoteID, Number(subtotal).toFixed(2), Number(grandTotal).toFixed(2), Number(depositAmount).toFixed(2)].join('|');
}

const QUOTE_TOTALS_HASH_VERSION = 2;

function quoteTotalsSecret() {
  return process.env.QUOTE_TOTALS_HMAC_SECRET || process.env.CRM_API_SECRET || '';
}

function computeQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount) {
  const secret = quoteTotalsSecret();
  if (!secret) {
    // Fail CLOSED. A missing secret must not silently degrade a money-path
    // integrity check back to a forgeable digest.
    throw new Error('QUOTE_TOTALS_HMAC_SECRET/CRM_API_SECRET not configured — refusing to sign quote totals');
  }
  return crypto.createHmac('sha256', secret)
    .update(totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount))
    .digest('hex').slice(0, 16);
}

// v1, retained ONLY to verify deposits enabled before the cutover.
function legacyQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount) {
  return crypto.createHash('sha256')
    .update(totalsHashPayload(quoteID, subtotal, grandTotal, depositAmount))
    .digest('hex').slice(0, 16);
}

/**
 * Verify a stored deposit's totals-hash against freshly-computed amounts.
 * Picks the algorithm from the deposit's own stamped version — never "try both".
 */
function totalsHashMatches(dep, quoteID, subtotal, grandTotal, depositAmount) {
  if (!dep || !dep.totalsHash) return false;
  const expected = Number(dep.hashVersion) === QUOTE_TOTALS_HASH_VERSION
    ? computeQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount)
    : legacyQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount);
  const a = Buffer.from(String(dep.totalsHash));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Money-path alert for quote payments (deposit paid / stale-hash / ledger
// failure). Same Slack hooks as alert3DT, labeled for quotes.
function alertQuotePay(text) {
  staffAlert('[QUOTE PAY] ', '💰 Quote payments: ', 'Quote payments', text);
}

// Append-only Order_Payments ledger mirror via the proxy. FAIL-SOFT: the quote
// row's Notes JSON is the primary record — a ledger outage must never black-hole
// a webhook — but every miss is alerted for manual backfill.
async function recordOrderPayment(entry) {
  try {
    const r = await fetch(`${TDT_PROXY}/api/order-payments/entry`, {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        process.env.CRM_API_SECRET ? { 'X-CRM-API-Secret': process.env.CRM_API_SECRET } : {}
      ),
      body: JSON.stringify(entry),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    alertQuotePay(`${entry.quoteID}: payment RECORDED on the quote but the Order_Payments ledger write failed (${e.message}) — backfill the ledger row manually.`);
  }
}

// Deposit % — Caspio Service_Codes DEPOSIT-PCT, fail-closed (never a hardcoded
// percent, Erik's rule). Throws with an Erik-actionable message; callers pick
// the surface (staff endpoint → 502, pickup auto-enable → fail-soft skip).
async function getDepositPct() {
  const r = await fetch(`${TDT_PROXY}/api/service-codes?code=DEPOSIT-PCT`);
  if (!r.ok) throw new Error(`HTTP ${r.status} from service-codes`);
  const j = await r.json();
  const codeRow = j && j.data && j.data[0];
  if (!codeRow || !codeRow.IsActive) throw new Error('DEPOSIT-PCT missing/inactive in Caspio Service_Codes');
  const pct = parseFloat(codeRow.SellPrice);
  if (!(pct > 0 && pct <= 100)) throw new Error(`DEPOSIT-PCT SellPrice '${codeRow.SellPrice}' out of range (0-100]`);
  return pct;
}

// Pickup skip-the-rep (BAW teardown adoption #2, 2026-07-06 —
// memory/BAW_CHECKOUT_TEARDOWN_2026-07.md): a pickup order has $0 shipping and
// the fixed Milton DOR tax rate, so nothing is left for a rep to confirm — the
// payment link auto-enables AT ACCEPTANCE and the customer can pay in the same
// sitting. Ship-to orders keep the rep gate (shipping must be quoted).
// Mutates `notes` with the same deposit block the staff enable-deposit endpoint
// writes (enabledBy 'auto-pickup'); THROWS on any lookup/math failure — the
// accept endpoint catches and falls back to plain acceptance (rep enables
// manually, exactly the pre-existing flow; acceptance itself is never blocked).
async function autoEnablePickupDeposit(quoteId, row, notes) {
  const depositPct = await getDepositPct();
  // Honour the quote's own taxability. A reseller-permit / tax-exempt customer
  // (Notes.taxable === false) was previously charged Milton WA sales tax anyway,
  // because this always resolved the pickup rate — a real over-charge on a
  // self-serve pay link with no rep in the loop (2026-07-24).
  const taxable = notes && notes.taxable === false ? false : true;
  const tax = taxable
    ? await resolveTdtTax({ deliveryMethod: 'pickup' })   // Milton DOR, same as 3DT pickup
    : { rate: 0 };
  const taxRatePct = Math.round(tax.rate * 100000) / 1000;       // decimal (0.102) -> percent (10.2)
  const terms = QuoteDepositMath.computeDepositTerms({
    subtotal: parseFloat(row.TotalAmount), shipping: 0, taxRatePct, depositPct,
  });
  const totalsHash = computeQuoteTotalsHash(quoteId, terms.subtotal, terms.grandTotal, terms.depositAmount);
  notes.deposit = Object.assign({}, terms, {
    enabled: true,
    totalsHash,
    hashVersion: QUOTE_TOTALS_HASH_VERSION,
    enabledAt: new Date().toISOString(),
    enabledBy: 'auto-pickup',
  });
  return notes.deposit;
}

// Deposit/balance receipts (customer + rep). Fully fail-soft, fire-and-forget.
function sendQuotePaymentEmails(row, payment) {
  if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
    console.warn('[QuoteDeposit] EMAILJS keys not set — skipping payment receipts.');
    return;
  }
  const quoteId = row.QuoteID;
  const dep = parseNotesJson(row.Notes).deposit || {};
  const paid = Number(payment.amount || 0).toFixed(2);
  const balance = payment.kind === 'balance' ? '0.00'
    : Number(dep.balanceAmount != null ? dep.balanceAmount : 0).toFixed(2);
  const grand = Number(dep.grandTotal != null ? dep.grandTotal : 0).toFixed(2);
  const custEmail = payment.payerEmail || row.CustomerEmail || '';
  const repEmail = (row.SalesRepEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.SalesRepEmail))
    ? row.SalesRepEmail : 'sales@nwcustomapparel.com';
  const quoteUrl = quoteShareUrl(quoteId, row);
  if (custEmail) {
    sendEmailJSTemplate(DEPOSIT_CUSTOMER_TEMPLATE, {
      to_email: custEmail, to_name: row.CustomerName || 'there',
      quote_id: quoteId, amount_paid: paid, balance_due: balance, grand_total: grand,
    }).then(
      () => console.log('[QuoteDeposit] ✓ customer receipt sent for', quoteId),
      (e) => console.error('[QuoteDeposit] customer receipt failed for', quoteId, ':', e.message)
    );
  }
  sendEmailJSTemplate(DEPOSIT_STAFF_TEMPLATE, {
    to_email: repEmail, to_name: row.SalesRepName || 'NWCA Sales',
    quote_id: quoteId, customer_name: row.CustomerName || '',
    customer_email: row.CustomerEmail || custEmail, company_name: row.CompanyName || '',
    // grand_total included because the live template (created 2026-07-05 via
    // dashboard clone) shares the receipt body with the customer template.
    amount_paid: paid, balance_due: balance, grand_total: grand, quote_url: quoteUrl,
  }).then(
    () => console.log('[QuoteDeposit] ✓ rep alert sent for', quoteId),
    (e) => console.error('[QuoteDeposit] rep alert failed for', quoteId, ':', e.message)
  );
}

// CRITICAL: Stripe webhook needs raw body for signature verification
// This route MUST be defined BEFORE bodyParser.json() middleware
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const endpointSecret = mode === 'production'
      ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
      : process.env.STRIPE_WEBHOOK_SECRET_TEST;

    if (!endpointSecret) {
      console.error('[Webhook] Secret not configured for mode:', mode);
      return res.status(500).send('Webhook secret not configured');
    }

    const sig = req.headers['stripe-signature'];
    const stripeInstance = stripe(
      mode === 'production'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_TEST_SECRET_KEY
    );

    // Verify webhook signature (prevents fake webhooks)
    let event;
    try {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('[Webhook] Event received:', event.type, event.id);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const quoteID = metadata.quoteID;

      if (!quoteID) {
        console.warn('[Webhook] No quoteID in metadata');
        return res.json({ received: true });
      }

      // ── Quote deposit/balance payments (Storefront Checkout Phase 1) ──────
      // Sessions carrying metadata.kind are PAYMENTS AGAINST AN EXISTING QUOTE.
      // They must never fall through to the express-order path below (which
      // would try to push a whole order to ShopWorks). Express sessions carry
      // no `kind`, so the legacy path is untouched by construction.
      if (metadata.kind) {
        // Paid SAMPLE orders (samples channel, 2026-07-06) — full-order
        // fulfillment (ManageOrders push), NOT a payment against an existing
        // quote, so it branches before the deposit/balance handling.
        if (metadata.kind === 'samples-order') {
          return handleSamplesOrderPaid(session, quoteID, res);
        }
        if (metadata.kind !== 'deposit' && metadata.kind !== 'balance') {
          alertQuotePay(`Stripe session ${session.id} has unknown metadata.kind '${metadata.kind}' for ${quoteID} — payment NOT auto-recorded; check the Stripe dashboard.`);
          return res.json({ received: true, status: 'unknown-kind' });
        }
        let row;
        try {
          row = await fetchQuoteSessionRow(quoteID);
        } catch (lookupErr) {
          // Failed lookup ≠ no record — 5xx so Stripe retries (same rule as 3DT).
          console.error('[Webhook] Quote-payment lookup failed:', lookupErr.message, '— asking Stripe to retry');
          return res.status(503).send('Quote lookup unavailable — retry');
        }
        if (!row) {
          alertQuotePay(`PAYMENT WITHOUT QUOTE ROW — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} as a ${metadata.kind} for ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`);
          return res.json({ received: true, status: 'no-record' });
        }
        const notes = parseNotesJson(row.Notes);
        const payments = Array.isArray(notes.payments) ? notes.payments : [];
        if (payments.some((p) => p && p.stripeSessionId === session.id)) {
          console.log('[Webhook] Quote payment already recorded, skipping:', quoteID);
          return res.json({ received: true, status: 'duplicate' });
        }
        // DOUBLE-PAYMENT guard (audit fix 2026-07-06): the per-session dedup
        // above only catches Stripe REDELIVERIES of the same session. A DIFFERENT
        // session of the same kind means the customer paid twice (e.g. two open
        // pay tabs, or a shared quote link paid by two people). We still record
        // it — the money is real and must appear in the ledger — but flag it
        // LOUDLY as a refund-needed duplicate instead of a normal success.
        const isDoublePayment = payments.some((p) => p && p.kind === metadata.kind);
        // The paid session was bound to a totals-hash at creation. A rep edit
        // between link-send and payment surfaces here — the money is already
        // taken, so record it and alert loudly instead of failing.
        if (notes.deposit && metadata.totalsHash && notes.deposit.totalsHash !== metadata.totalsHash) {
          alertQuotePay(`${quoteID}: ${metadata.kind} of $${(session.amount_total / 100).toFixed(2)} was paid against a STALE totals-hash (quote edited after the pay link went out). Verify amounts with the customer.`);
        }
        const payment = {
          kind: metadata.kind,
          amount: Math.round(session.amount_total) / 100,
          stripeSessionId: session.id,
          paymentIntent: session.payment_intent || '',
          payerEmail: (session.customer_details && session.customer_details.email) || session.customer_email || '',
          at: new Date().toISOString(),
        };
        payments.push(payment);
        notes.payments = payments;
        if (notes.deposit) {
          if (payment.kind === 'deposit') notes.deposit.paidAt = payment.at;
          if (payment.kind === 'balance') notes.deposit.balancePaidAt = payment.at;
        }
        const notesPut = await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
          method: 'PUT',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ Notes: JSON.stringify(notes) }),
        });
        if (!notesPut.ok) {
          // Money is in Stripe but our record write failed — 5xx so Stripe
          // redelivers (the sessionId dedup above makes the retry safe).
          alertQuotePay(`${quoteID}: ${payment.kind} paid (session ${session.id}) but the quote_sessions Notes write failed (HTTP ${notesPut.status}) — Stripe will retry.`);
          return res.status(503).send('Record write failed — retry');
        }
        // Ledger mirror + receipts + rep ping — all fail-soft (Notes is the record).
        recordOrderPayment({
          quoteID, type: payment.kind, amount: payment.amount,
          stripeSessionId: session.id, paymentIntent: payment.paymentIntent,
          payerEmail: payment.payerEmail, customerName: row.CustomerName || '',
          companyName: row.CompanyName || '',
        });
        try { sendQuotePaymentEmails(row, payment); } catch (e) { console.error('[QuoteDeposit] receipt dispatch error:', e.message); }
        if (isDoublePayment) {
          alertQuotePay(`🚨 DUPLICATE PAYMENT — REFUND NEEDED: ${quoteID} received a SECOND '${payment.kind}' of $${payment.amount.toFixed(2)} (session ${session.id}) on top of an earlier one. The customer was charged twice — issue a refund in Stripe.`);
        } else {
          const balDue = payment.kind === 'balance' ? 0
            : Number((notes.deposit && notes.deposit.balanceAmount) || 0);
          alertQuotePay(`✅ ${quoteID}: ${payment.kind} of $${payment.amount.toFixed(2)} PAID by ${payment.payerEmail || row.CustomerEmail || 'unknown'}${row.CompanyName ? ' (' + row.CompanyName + ')' : ''}. Balance due: $${balDue.toFixed(2)}.`);
        }
        console.log('[Webhook] ✓ Quote payment recorded:', quoteID, payment.kind, payment.amount, isDoublePayment ? '(DUPLICATE)' : '');
        return res.json({ received: true, status: isDoublePayment ? 'quote-payment-duplicate-recorded' : 'quote-payment-recorded' });
      }

      console.log('[Webhook] Processing payment for QuoteID:', quoteID);

      // Check idempotency - has this webhook already been processed?
      // fetchQuoteSessionRow: refresh=true bypasses the proxy's 5-min lookup
      // cache (a stale [] here would orphan a PAID order) and exact-matches
      // the QuoteID — never sessions[0] (the 2026-06-01 wrong-quote lesson).
      let matched;
      try {
        matched = await fetchQuoteSessionRow(quoteID);
      } catch (lookupErr) {
        // A FAILED lookup is not "no record" — return 5xx so Stripe RETRIES
        // the webhook (transient Caspio outages must self-heal, not orphan a
        // paid order behind a misleading no-record alert).
        console.error('[Webhook] Quote lookup failed:', lookupErr.message, '— asking Stripe to retry');
        return res.status(503).send('Quote lookup unavailable — retry');
      }

      if (!matched) {
        // Customer PAID but we have no order record — this must never be silent.
        alert3DT(`PAYMENT WITHOUT ORDER RECORD — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} for QuoteID ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`);
        return res.json({ received: true, status: 'no-record' });
      }

      {
        const quoteSession = matched;

        // Idempotency: 'Processed' and 'ShopWorks Failed' are terminal.
        // 'Payment Confirmed' is INTERMEDIATE — a crash between the status
        // PUT and the push would strand a paid order there forever; a Stripe
        // redelivery that finds it raises an alert instead of silently
        // skipping. (3DT rebuild review fix, 2026-06-09)
        if (quoteSession.Status === 'Processed'
            || String(quoteSession.Status).indexOf('ShopWorks Failed') !== -1) {
          console.log('[Webhook] Already processed, skipping:', quoteID);
          return res.json({ received: true, status: 'duplicate' });
        }
        if (quoteSession.Status === 'Payment Confirmed') {
          alert3DT(`Webhook redelivery found ${quoteID} stuck at 'Payment Confirmed' — the ShopWorks push may not have completed. Verify in ShopWorks before re-pushing (duplicate-order risk).`);
          return res.json({ received: true, status: 'stuck-payment-confirmed' });
        }

        // ── Server-authoritative confirmation emails (2026-06-10) ──────────
        // Sent HERE (not the success page) so a closed tab can't lose the
        // confirmation. Payment is already verified (signature + idempotency
        // checks above) and the params come from the Caspio blobs, so this
        // runs BEFORE the ShopWorks push — i.e. regardless of push outcome —
        // and BEFORE the status flips to 'Payment Confirmed', so the success
        // page's poller always sees the emailsSentAt dedup stamp together
        // with a confirmed status (no duplicate-send race). Fail-soft: email
        // errors never block the webhook or the push; when the stamp is
        // absent the success page falls back to browser sends.
        const statusToken = computeOrderStatusToken(quoteID); // null when ORDER_STATUS_SECRET unset
        let emailResult = { customerOk: false, salesOk: false };
        try {
          emailResult = await sendOrderConfirmationEmails(quoteSession, session.id, statusToken);
        } catch (emailErr) {
          console.error('[Webhook] Confirmation email step failed (non-fatal):', emailErr);
        }

        // Merge the dedup stamp + order-status token into OrderSettingsJSON,
        // preserving every existing key (the success page, push transformer
        // and status API all read this blob).
        let mergedSettingsJSON = null;
        try {
          const settings = JSON.parse(quoteSession.OrderSettingsJSON || '{}');
          if (statusToken) settings.statusToken = statusToken;
          if (emailResult.customerOk) settings.emailsSentAt = new Date().toISOString();
          if (statusToken || emailResult.customerOk) mergedSettingsJSON = JSON.stringify(settings);
        } catch (mergeErr) {
          console.error('[Webhook] Could not merge OrderSettingsJSON stamps (non-fatal):', mergeErr.message);
        }

        // Update status to Payment Confirmed (+ email/status-token stamps)
        const updateUrl = `${CASPIO_PROXY_BASE}/api/quote_sessions/${quoteSession.PK_ID}`;
        await fetch(updateUrl, {
          method: 'PUT',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(Object.assign({
            Status: 'Payment Confirmed',
            Notes: `${quoteSession.Notes}\nPayment Confirmed: ${new Date().toISOString()}\nStripe Payment Intent: ${session.payment_intent}\nAmount: $${(session.amount_total / 100).toFixed(2)}`
          }, mergedSettingsJSON ? { OrderSettingsJSON: mergedSettingsJSON } : {}))
        });

        console.log('[Webhook] ✓ Payment confirmed for:', quoteID);

        // Order_Payments ledger mirror (fail-soft, idempotent on session id) —
        // storefront orders (3DT/CTS/CAP) now feed the staff dashboard's Money
        // Collected widget like quote deposits and samples do (2026-07-06)
        recordOrderPayment({
          quoteID, type: 'order', amount: Math.round(session.amount_total) / 100,
          stripeSessionId: session.id, paymentIntent: session.payment_intent || '',
          payerEmail: (session.customer_details && session.customer_details.email) || session.customer_email || '',
          customerName: quoteSession.CustomerName || '', companyName: quoteSession.CompanyName || '',
        });

        // Now submit to ShopWorks
        try {
          // Retrieve order data from Caspio (instead of Stripe metadata)
          // This avoids Stripe's 500-character metadata limit
          const orderData = {
            customerData: JSON.parse(quoteSession.CustomerDataJSON || '{}'),
            colorConfigs: JSON.parse(quoteSession.ColorConfigsJSON || '{}'),
            orderTotals: JSON.parse(quoteSession.OrderTotalsJSON || '{}'),
            orderSettings: JSON.parse(quoteSession.OrderSettingsJSON || '{}')
          };

          console.log('[Webhook] Retrieved order data from Caspio');

          // Call existing ShopWorks submission endpoint
          // Use production domain instead of localhost for Heroku compatibility
          const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
          const shopWorksResponse = await fetch(`${baseUrl}/api/submit-3day-order`, {
            method: 'POST',
            // Internal key: bypasses strictLimiter AND marks the payment as
            // already signature-verified by this webhook.
            headers: { 'Content-Type': 'application/json', 'x-nwca-internal': INTERNAL_CALL_KEY },
            body: JSON.stringify({
              tempOrderNumber: quoteID,
              customerData: orderData.customerData,
              colorConfigs: orderData.colorConfigs,
              orderTotals: orderData.orderTotals,
              orderSettings: orderData.orderSettings,
              paymentConfirmed: true,
              stripeSessionId: session.id,
              paymentAmount: session.amount_total
            })
          });

          // /api/submit-3day-order returns HTTP 200 with {success:false} on a
          // ManageOrders rejection — checking only response.ok used to mark
          // paid-but-unpushed orders 'Processed' with no alert (fixed 2026-06-09).
          const result = shopWorksResponse.ok
            ? await shopWorksResponse.json().catch(() => ({}))
            : {};
          if (!shopWorksResponse.ok || result.success !== true) {
            throw new Error(result.error
              || `ShopWorks API returned HTTP ${shopWorksResponse.status}`);
          }

          // Update to Processed — and notice when the bookkeeping PUT itself
          // fails (otherwise a redelivery could double-push to ShopWorks).
          const processedPut = await fetch(updateUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Status: 'Processed',
              Notes: `${quoteSession.Notes}\nShopWorks Order Created: ${result.orderNumber || 'N/A'}\nSubmitted: ${new Date().toISOString()}`
            })
          });
          if (!processedPut.ok) {
            alert3DT(`${quoteID} pushed to ShopWorks OK but the Caspio status update to 'Processed' failed (HTTP ${processedPut.status}) — fix the row manually or a webhook redelivery may double-push.`);
          }

          console.log('[Webhook] ✓ ShopWorks order created:', quoteID);

        } catch (shopWorksError) {
          console.error('[Webhook] ShopWorks submission failed:', shopWorksError);
          alert3DT(`PAID ORDER NEEDS MANUAL PUSH — ${quoteID} ($${(session.amount_total / 100).toFixed(2)}, ${session.customer_email || 'no email'}) failed the ShopWorks push: ${shopWorksError.message}. Status set to 'Payment Confirmed - ShopWorks Failed'.`);

          // Update status to indicate failure
          await fetch(updateUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Status: 'Payment Confirmed - ShopWorks Failed',
              Notes: `${quoteSession.Notes}\nShopWorks Error: ${shopWorksError.message}\nRequires manual processing`
            })
          });
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

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
  setHeaders: (res, path) => {
    // Set no-cache for all files to ensure changes are immediately visible
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
};

// ============================================================================
// 3-Day Tees Helper Functions (following Christmas Bundles pattern)
// ============================================================================

// Quote ID builders ('3DT{MMDD}-{rand4}' / 'DTG{MMDD}-{rand4}' — the DTG
// prefix is deliberate, Erik 2026-06-10: storefront orders land in Quote
// Management alongside the internal builder's DTG quotes) now live in the
// channel registry: config/storefront-channels.js `buildQuoteId` (jest-locked
// format). The checkout route's uniqueness check still applies per candidate.

// Save 3-Day Tees order to quote_sessions (Christmas Bundles pattern)
// ══ Paid-sample fulfillment (webhook metadata.kind === 'samples-order') ═════
// Mirrors the express-order webhook path's guarantees for the samples channel:
// failed lookup → 5xx so Stripe retries; terminal statuses are idempotent;
// 'Payment Confirmed' is stamped BEFORE the push; a failed push flags the row
// for manual entry and alerts — the money is real either way. The payload
// builder is pure + jest-locked (shared_components/js/samples-order-payload.js).
async function handleSamplesOrderPaid(session, quoteID, res) {
  const chCfg = channelConfig('samples');
  const chLog = '[Samples Webhook]';
  let row;
  try {
    row = await fetchQuoteSessionRow(quoteID);
  } catch (lookupErr) {
    console.error(`${chLog} Quote lookup failed:`, lookupErr.message, '— asking Stripe to retry');
    return res.status(503).send('Quote lookup unavailable — retry');
  }
  if (!row) {
    alert3DT(`PAYMENT WITHOUT ORDER RECORD — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} for SAMPLES ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`);
    return res.json({ received: true, status: 'no-record' });
  }
  if (row.Status === 'Processed' || String(row.Status).indexOf('ShopWorks Failed') !== -1) {
    console.log(`${chLog} Already processed, skipping:`, quoteID);
    return res.json({ received: true, status: 'duplicate' });
  }
  if (row.Status === 'Payment Confirmed') {
    alert3DT(`Webhook redelivery found SAMPLES ${quoteID} stuck at 'Payment Confirmed' — the ShopWorks push may not have completed. Verify in ShopWorks before re-pushing (duplicate-order risk).`);
    return res.json({ received: true, status: 'stuck-payment-confirmed' });
  }

  // Idempotency marker BEFORE the push (a redelivery mid-push must not double-order)
  await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
    method: 'PUT',
    headers: withProxySecret({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      Status: 'Payment Confirmed',
      Notes: `${row.Notes}\nPayment Confirmed: ${new Date().toISOString()}\nStripe Payment Intent: ${session.payment_intent}\nAmount: $${(session.amount_total / 100).toFixed(2)}`
    })
  });
  console.log(`${chLog} ✓ Payment confirmed for:`, quoteID);

  // Order_Payments ledger mirror (fail-soft, idempotent on session id) — feeds
  // the staff dashboard's Money Collected widget (2026-07-06)
  recordOrderPayment({
    quoteID, type: 'samples-order', amount: Math.round(session.amount_total) / 100,
    stripeSessionId: session.id, paymentIntent: session.payment_intent || '',
    payerEmail: (session.customer_details && session.customer_details.email) || session.customer_email || '',
    customerName: row.CustomerName || '', companyName: row.CompanyName || '',
  });

  let customerData = {}, orderTotals = {}, orderSettings = {};
  try {
    customerData = JSON.parse(row.CustomerDataJSON || '{}');
    orderTotals = JSON.parse(row.OrderTotalsJSON || '{}');
    orderSettings = JSON.parse(row.OrderSettingsJSON || '{}');
  } catch (parseErr) {
    console.error(`${chLog} Blob parse failed for ${quoteID}:`, parseErr.message);
  }
  const samples = Array.isArray(orderSettings.samples) ? orderSettings.samples : [];

  try {
    if (!samples.length) throw new Error('No samples in OrderSettingsJSON — cannot build the push');
    const payload = buildSamplesPushPayload({
      quoteID,
      customerData,
      samples,
      totals: {
        paidSubtotal: orderTotals.subtotal,
        salesTax: orderTotals.salesTax,
        taxRate: orderTotals.taxRate,
        grandTotal: orderTotals.grandTotal,
        taxAccount: orderTotals.taxAccount,
        taxAccountName: orderTotals.taxAccountName
      },
      stripeSessionId: session.id,
      paymentAmount: session.amount_total,
      serviceBanner: chCfg.push.serviceBanner(false),
      // Pacific day for both ShopWorks dates — the UTC-day defaults stamp
      // evening orders (after ~5pm PT) with tomorrow's date. (2026-09-01)
      orderDate: nowPacificNaiveIso().split('T')[0],
      paymentDate: nowPacificNaiveIso().split('T')[0]
    });
    const pushResp = await fetch(`${CASPIO_PROXY_BASE}/api/manageorders/orders/create`, {
      method: 'POST',
      // Secret required since proxy v2026.08.05.9 gated this route.
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(payload)
    });
    const pushResult = await pushResp.json().catch(() => ({}));
    if (!pushResp.ok || pushResult.success === false) {
      throw new Error(`ManageOrders push failed (${pushResp.status}): ${pushResult.error || pushResult.message || 'unknown'}`);
    }
    const extOrderId = pushResult.extOrderId || pushResult.orderNumber || quoteID;
    await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
      method: 'PUT',
      headers: withProxySecret({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        Status: 'Processed',
        Notes: `${row.Notes}\nShopWorks Order: ${extOrderId}\nProcessed: ${new Date().toISOString()}`
      })
    });
    // Sales alert — the SAME proven Sample-Order-API template the free flow
    // sends (registry emails.confirmationSalesTemplate). Customer gets the
    // Stripe receipt + the success-page confirmation (free-flow parity).
    sendEmailJSTemplate(chCfg.emails.confirmationSalesTemplate, {
      to_email: 'erik@nwcustomapparel.com',
      to_name: 'Erik',
      subject: `PAID Sample Order ${extOrderId} - ${customerData.company || customerData.lastName || ''}`,
      order_number: extOrderId,
      company: customerData.company || customerData.lastName || '',
      message: `Paid sample order ($${(session.amount_total / 100).toFixed(2)} via Stripe, session ${session.id}) pushed to ShopWorks. View details in OnSite.`,
      order_date: new Date().toLocaleDateString()
    }).then(
      () => console.log(`${chLog} ✓ Sales alert email sent for`, quoteID),
      (e) => console.error(`${chLog} Sales alert email failed for`, quoteID, ':', e.message)
    );
    alert3DT(`✅ SAMPLES ${quoteID}: $${(session.amount_total / 100).toFixed(2)} PAID (${samples.filter((s) => s.type === 'paid').length} paid + ${samples.filter((s) => s.type !== 'paid').length} free) → ShopWorks ${extOrderId}.`);
    console.log(`${chLog} ✓ Pushed to ShopWorks:`, extOrderId);
    return res.json({ received: true, status: 'samples-order-processed' });
  } catch (pushErr) {
    console.error(`${chLog} ShopWorks push failed for ${quoteID}:`, pushErr.message);
    alert3DT(`PAID SAMPLE ORDER NEEDS MANUAL PUSH — ${quoteID} ($${(session.amount_total / 100).toFixed(2)}, ${session.customer_email || customerData.email || 'no email'}) failed the ShopWorks push: ${pushErr.message}. Status set to 'Payment Confirmed - ShopWorks Failed'.`);
    try {
      await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
        method: 'PUT',
        headers: withProxySecret({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ Status: 'Payment Confirmed - ShopWorks Failed' })
      });
    } catch (statusErr) {
      console.error(`${chLog} Could not flag ${quoteID} as ShopWorks Failed:`, statusErr.message);
    }
    // Payment is recorded and a human is alerted — ack the webhook (a retry
    // would find the terminal status and no-op).
    return res.json({ received: true, status: 'samples-order-push-failed' });
  }
}

async function save3DTQuoteSession(data) {
  const { quoteID, customerData, orderTotals, stripeSessionId, colorConfigs, orderSettings } = data;

  const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

  // Reader contract (2026-06-12, Erik): TotalAmount = PRE-TAX products subtotal,
  // TaxAmount + TaxRate stored separately — so /invoice (trusts TaxAmount) and
  // /quote (recomputes from TaxRate) both foot correctly + show the WA tax line.
  // (Was: TotalAmount = grandTotal tax-inclusive with no TaxAmount → /quote
  // double-taxed to $894.61, /invoice showed $0 tax.) The Stripe charge + the
  // webhook→ShopWorks push read OrderTotalsJSON, NOT these columns — unaffected.
  const subtotal = parseFloat((orderTotals.subtotal || 0).toFixed(2));
  const salesTax = parseFloat((orderTotals.salesTax || 0).toFixed(2));
  const taxRate = Number(orderTotals.taxRate) || 0;

  const sessionData = {
    QuoteID: quoteID,
    SessionID: stripeSessionId ? `stripe_${stripeSessionId}` : `3dt_${Date.now()}`,
    Status: 'Pending Payment',
    CustomerName: `${customerData.firstName} ${customerData.lastName}`,
    CompanyName: customerData.company || '',
    CustomerEmail: customerData.email,
    Phone: customerData.phone || '',
    TotalQuantity: orderTotals.totalQuantity || 0,
    SubtotalAmount: subtotal,
    LTMFeeTotal: parseFloat((orderTotals.ltmFee || 0).toFixed(2)),
    TotalAmount: subtotal,
    TaxAmount: salesTax,
    TaxRate: taxRate,
    ExpiresAt: formattedExpiresAt,
    Notes: channelConfig(orderSettings && orderSettings.channel).orderNoteLabel({
      rush: orderSettings && orderSettings.rush,
      styleNumber: orderSettings && orderSettings.styleNumber,
    }) + (stripeSessionId ? ` | Stripe Session: ${stripeSessionId}` : ''),

    // Store full order data as JSON (for webhook retrieval)
    // This eliminates Stripe metadata size constraints
    CustomerDataJSON: customerData ? JSON.stringify(customerData) : '{}',
    ColorConfigsJSON: colorConfigs ? JSON.stringify(colorConfigs) : '{}',
    OrderTotalsJSON: orderTotals ? JSON.stringify(orderTotals) : '{}',
    OrderSettingsJSON: orderSettings ? JSON.stringify(orderSettings) : '{}'
  };

  const apiUrl = `${CASPIO_PROXY_BASE}/api/quote_sessions`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: withProxySecret({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(sessionData)
  });

  if (!response.ok) {
    throw new Error(`Failed to save quote session: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('[3-Day Tees] Quote session created:', quoteID);

  // Write quote_items rows so /quote + /invoice render line items. Fire-and-
  // forget: a display-row failure must NEVER block the sale (the order data is
  // fully in the JSON blobs and the ShopWorks push reads those). Sync never
  // touches quote_items (verified 2026-06-12), so no duplicate risk.
  try {
    const lineItems = buildStorefrontQuoteItems(quoteID, colorConfigs, orderTotals, orderSettings);
    const itemsUrl = `${CASPIO_PROXY_BASE}/api/quote_items`;
    const results = await Promise.allSettled(lineItems.map((item) =>
      fetch(itemsUrl, {
        method: 'POST',
        headers: withProxySecret({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(item)
      }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
    ));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      console.error(`[Storefront] ${quoteID}: ${failed}/${lineItems.length} quote_items failed to write (order still valid — data is in JSON blobs).`);
    } else {
      console.log(`[Storefront] ${quoteID}: wrote ${lineItems.length} quote_items row(s).`);
    }
  } catch (itemsErr) {
    console.error(`[Storefront] ${quoteID}: quote_items synthesis failed (non-fatal):`, itemsErr.message);
  }

  return result;
}

// ── 3-Day Tees server-side authoritative pricing ────────────────────────────
// The browser quote is advisory; the money Stripe charges is recomputed HERE
// from the same Caspio sources (pricing-bundle + Service_Codes 3DT-*) via the
// same TDT_PRICING module the page runs. A client/server mismatch over 1¢
// rejects the checkout visibly — never charge a number we didn't derive.

const TDT_PROXY = CASPIO_PROXY_BASE;
// Stamped artwork refs must point at OUR files API — see sanitizeUploadedLogoRef.
const { sanitizeUploadedLogoRef } = STOREFRONT_CHANNEL_CONFIG;
const UPLOADED_ARTWORK_URL_PREFIX = `${CASPIO_PROXY_BASE}/api/files/`;
const TDT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
let _tdtCfgCache = null;
let _tdtCfgAt = 0;

async function getTdtPricingConfig() {
  if (_tdtCfgCache && Date.now() - _tdtCfgAt < 5 * 60 * 1000) return _tdtCfgCache;

  const grab = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
    return r.json();
  };
  const code = async (c) => {
    const j = await grab(`${TDT_PROXY}/api/service-codes?code=${c}`);
    const row = j && j.data && j.data[0];
    if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
      throw new Error(`Service code ${c} missing/inactive in Caspio`);
    }
    return parseFloat(row.SellPrice);
  };

  const [pricingData, rushPct, ltmFee, shipFee] = await Promise.all([
    grab(`${TDT_PROXY}/api/pricing-bundle?method=DTG&styleNumber=PC54`),
    code('3DT-RUSH'), code('3DT-LTM'), code('3DT-SHIP'),
  ]);
  const nonLtm = (pricingData.tiersR || [])
    .filter(t => !parseFloat(t.LTM_Fee || 0))
    .sort((a, b) => a.MinQuantity - b.MinQuantity);
  if (!nonLtm.length) throw new Error('DTG pricing tiers missing a non-LTM tier');

  _tdtCfgCache = {
    pricingData,
    config: { rushPct, ltmFee, shipFee, ltmThreshold: nonLtm[0].MinQuantity, sizes: TDT_SIZES },
  };
  _tdtCfgAt = Date.now();
  return _tdtCfgCache;
}

// ── 3-Day Tees shipping: real UPS Ground estimate, flat-rate fallback ───────
// Same estimator stack the EMB quote builder uses (negotiated-cost model,
// proxy /api/shipping/estimate-ups-ground; box density from Caspio via
// /api/shipping/box-density; PC54 piece weight from SanMar /api/inventory).
// Lives ONLY here — the page asks this server for the number it displays
// (POST /api/three-day-tees/shipping-estimate) and the reprice recomputes via
// the same function, so the estimate shown and the amount charged can't drift.
// Estimator failure falls back to the Caspio 3DT-SHIP flat rate (a defined
// price, labeled "flat rate" — never a guess).
let _tdtShipMetaCache = null;
let _tdtShipMetaAt = 0;

async function getTdtShipMeta() {
  if (_tdtShipMetaCache && Date.now() - _tdtShipMetaAt < 60 * 60 * 1000) return _tdtShipMetaCache;
  let pieceWeightLb = 0.44;   // PC54 catalog weight; refreshed from SanMar below
  let perBox = 58;            // T-Shirt density; refreshed from Caspio below
  try {
    const r = await fetch(`${TDT_PROXY}/api/shipping/box-density`);
    if (r.ok) {
      const j = await r.json();
      const v = parseInt(j && j.density && j.density['T-Shirt'], 10);
      if (v > 0) perBox = v;
    }
  } catch (e) { console.warn('[3DT ship] box-density fetch failed, using default 58:', e.message); }
  try {
    const r = await fetch(`${TDT_PROXY}/api/inventory?styleNumber=PC54`);
    if (r.ok) {
      const j = await r.json();
      const rows = Array.isArray(j) ? j : (j.data || j.result || []);
      const w = parseFloat((rows.find(x => parseFloat(x.PIECE_WEIGHT) > 0) || {}).PIECE_WEIGHT);
      if (w > 0) pieceWeightLb = w;
    }
  } catch (e) { console.warn('[3DT ship] piece-weight fetch failed, using default 0.44:', e.message); }
  _tdtShipMetaCache = { pieceWeightLb, perBox };
  _tdtShipMetaAt = Date.now();
  return _tdtShipMetaCache;
}

// ── Custom T-Shirts: per-style config + reprice (2026-06-10) ────────────────
// Multi-style DTG storefront. Pricing parity contract: a customer ordering N
// pieces of style X at /custom-tees pays EXACTLY what the internal DTG quote
// builder computes for the same inputs (tiers/costs/upcharges from the same
// per-style pricing-bundle; LTM = the builder's distributed floor math, which
// lives inside CTS_PRICING). Rush is OPT-IN (+3DT-RUSH %) and only on
// whitelisted rush-eligible styles. All fail-closed — never a guessed price.

// 3-Day Rush launch scope — single source is the channel registry (the page's
// window.CTS_RUSH_ELIGIBLE in custom-tees-app.js must be kept in sync; the
// deferred catalog-admin rush_eligible-column plan replaces both).
const CTS_RUSH_ELIGIBLE = new Set(STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-tees'].rushEligible);

// ── Storefront channel registry (2026-06-11) ────────────────────────────────
// ONE switchboard for everything that differs per storefront channel
// (orderSettings.channel). The pure/static half (QuoteID builders, ShopWorks
// push constants, banners, EmailJS templates) lives in
// config/storefront-channels.js and is jest-locked by
// tests/unit/storefront-channels.test.js; this const binds the SERVER-ONLY
// behaviors on top. Adding a channel ('custom-caps') = one entry in the
// config module + one matching entry here — see the field-by-field checklist
// in that file. Do NOT add per-channel ternaries back into the routes.
const CHANNELS = {
  'custom-tees': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-tees'], {
    rebuildQuote: (colorConfigs, orderSettings, customerData) =>
      rebuildCtsQuote(colorConfigs, orderSettings, customerData),
    // Per-style size whitelist from the SERVER-fetched bundle (load-bearing:
    // an unknown client size key must never inflate the tier while pricing $0).
    sizeWhitelist: (priced) => priced.sizes,
    stockGate: true,
    // Per-channel conflict math: tees compare per color+size (the feed's
    // size rows are real for garments).
    stockConflicts: (cleanConfigs, stock) => ctsStockConflicts(cleanConfigs, stock),
    // Standard orders promise the END of the 7-10 business-day window; the
    // opt-in rush toggle uses the 3-day cutoff promise.
    shipPromise: (priced) => (priced.rush
      ? { promise: CTS_SHIPDATE.promise(new Date()), mode: 'rush-3day' }
      : { promise: CTS_SHIPDATE.standardPromise(new Date()), mode: 'standard-7to10' }),
    // Server-validated style facts become the order of record (the client's
    // were advisory) — the push + success page read THESE.
    stampedOrderSettings: (priced, stockChecked) => ({
      channel: 'custom-tees',
      styleNumber: priced.style,
      styleName: priced.productName,
      rush: priced.rush,
      frontLocation: priced.frontLocation,
      backLocation: priced.backLocation,
      // false = the live stock gate couldn't run (inventory API hiccup,
      // fail-open) — the push note tells production to verify garments.
      stockChecked,
    }),
  }),
  '3-day-tees': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['3-day-tees'], {
    rebuildQuote: (colorConfigs, orderSettings, customerData) =>
      rebuildTdtQuote(colorConfigs, orderSettings, customerData),
    sizeWhitelist: () => TDT_SIZES,
    stockGate: false,
    stockConflicts: (cleanConfigs, stock) => ctsStockConflicts(cleanConfigs, stock),   // unreachable (no gate) — shape parity
    shipPromise: () => ({ promise: TDT_SHIPDATE.promise(new Date()), mode: 'rush-3day' }),
    stampedOrderSettings: () => ({}),
  }),
  // Custom Hats — OSFA cap embroidery storefront (server core 2026-06-11;
  // pages pending). Erik's locked decisions: 8-cap minimum (NO LTM — the 1-7
  // tier is unreachable), free logo setup (no digitizing line), proof-first
  // always, back logo = flat tiered CAP-AL add-on.
  'custom-caps': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['custom-caps'], {
    rebuildQuote: (colorConfigs, orderSettings, customerData) =>
      rebuildCapsQuote(colorConfigs, orderSettings, customerData),
    sizeWhitelist: (priced) => priced.sizes,   // ['OSFA'] — one-click qty, no size grid
    // SanMar live inventory gate (same getCtsStock SanMar path the tees use —
    // caps never hit the Milton PC54 branch because rush is always false).
    stockGate: true,
    // C402 lesson (2026-06-11): cap feeds carry stale sized partIds (XL/SM
    // rows at 0 qty next to the real OSFA rows) — conflicts must aggregate
    // live qty by CATALOG_COLOR, never by size.
    stockConflicts: (cleanConfigs, stock) => capsStockConflicts(cleanConfigs, stock),
    // Proof-first promise: the 7-10 business-day window WORDING is "after
    // proof approval" everywhere (banners/emails read the registry strings).
    // PROPOSED window: digitizing 1-3 days + embroidery production, stamped
    // as the end of a 7-10 biz-day window from checkout — assumes prompt
    // proof approval. ERIK-DECISION: confirm 7-10 (vs a wider 10-12) before
    // the page goes live; the binding date stamps at checkout, but the clock
    // honestly starts at proof approval.
    shipPromise: () => ({ promise: CTS_SHIPDATE.standardPromise(new Date()), mode: 'proof-first-standard' }),
    // Server-validated cap facts become the order of record. Stitch counts
    // are NEVER exposed (decision #2) — the 8K-included assumption lives in
    // the pricing module, not on the order. needsArtReview is forced ON
    // (proof-first, decision #11) regardless of what the client sent.
    stampedOrderSettings: (priced, stockChecked, clientSettings) => ({
      channel: 'custom-caps',
      styleNumber: priced.style,
      styleName: priced.productName,
      rush: false,
      // {fileUrl,fileName} refs, sanitized to OUR files API — the ShopWorks
      // push (designs + attachments), quote-view and the success page all
      // read .fileUrl. Stamping booleans here shipped CAP orders with NO
      // artwork attached (first caps E2E, 2026-08-25). backLogo rides ONLY
      // when the reprice actually charged it — an uncharged file must never
      // reach production.
      frontLogo: sanitizeUploadedLogoRef(clientSettings && clientSettings.frontLogo, UPLOADED_ARTWORK_URL_PREFIX),
      backLogo: priced.backLogo
        ? sanitizeUploadedLogoRef(clientSettings && clientSettings.backLogo, UPLOADED_ARTWORK_URL_PREFIX)
        : null,
      frontLocation: 'CF',                        // → 'Cap Front' via swLocationMap at push
      backLocation: priced.backLogo ? 'CB' : null, // → 'Cap Back'
      printLocationName: priced.backLogo ? 'Cap Front + Cap Back' : 'Cap Front',
      needsArtReview: true,                       // ALWAYS proof-first
      stockChecked,
    }),
  }),
  // Sample Program (2026-07-06) — registry entry exists so save3DTQuoteSession
  // Notes labels, shipped emails, and channelConfig lookups resolve correctly,
  // but sample carts are MULTI-STYLE and NEVER go through this shared
  // single-style route: the dedicated POST /api/samples/create-checkout-session
  // owns the reprice + Stripe session, and the webhook's
  // metadata.kind === 'samples-order' branch owns fulfillment.
  'samples': Object.assign({}, STOREFRONT_CHANNEL_CONFIG.CHANNELS['samples'], {
    rebuildQuote: () => {
      throw Object.assign(
        new Error('Sample orders check out via /api/samples/create-checkout-session'),
        { code: 'STYLE_NOT_ALLOWED' }   // → clean 400, never a 502
      );
    },
    sizeWhitelist: () => [],
    stockGate: false,
    stockConflicts: () => [],
    shipPromise: () => ({ promise: CTS_SHIPDATE.standardPromise(new Date()), mode: 'samples-2to3day' }),
    stampedOrderSettings: () => ({}),
  }),
};

// Absent/unknown channel → legacy 3DT (exactly the pre-registry `isCTS`
// else-branch; historical Caspio rows have no channel stamped and must keep
// working). Use channelConfigExact for whitelist-gated paths where an
// unregistered channel must stay EXCLUDED (e.g. the shipped email).
function channelConfig(channel) {
  return CHANNELS[String(channel || '')] || CHANNELS[STOREFRONT_CHANNEL_CONFIG.DEFAULT_CHANNEL];
}
function channelConfigExact(channel) {
  return CHANNELS[String(channel || '')] || null;
}

// Service codes are STYLE-INDEPENDENT, so they get their own shared 5-min
// promise-memo (2026-06-12): the per-style config previously re-fetched the
// same 5 codes for every style — the gallery's 20-style reference pricing
// burst-fired ~100 identical calls and the proxy 429'd. Staleness is
// UNCHANGED (each style's config already cached the codes 5 min); failures
// evict immediately so a transient error never sticks, and a missing/
// inactive row still throws (fail-closed, Erik's #1 rule).
const _ctsCodeCache = new Map();   // code → { at, promise }
function getCtsServiceCode(c) {
  const hit = _ctsCodeCache.get(c);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.promise;
  const promise = (async () => {
    const r = await fetch(`${TDT_PROXY}/api/service-codes?code=${c}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${TDT_PROXY}/api/service-codes`);
    const j = await r.json();
    const row = j && j.data && j.data[0];
    if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
      throw new Error(`Service code ${c} missing/inactive in Caspio`);
    }
    return parseFloat(row.SellPrice);
  })();
  _ctsCodeCache.set(c, { at: Date.now(), promise });
  promise.catch(() => _ctsCodeCache.delete(c));
  return promise;
}

// Per-style SALE (2026-06-12, Erik): Caspio code CTS-SALE-{STYLE} → $/shirt
// off, strike-through on the gallery card. OPTIONAL — unlike fees, a sale is
// safe to miss: absent/inactive row OR a fetch error → 0 (customer pays the
// REGULAR price, never less). Erik runs/stops sales in Caspio, zero deploys.
// ALL sales load in ONE ?category= call (5-min promise-memo) — a per-style
// ?code= lookup ×20 styles re-created the burst that 429'd the proxy earlier.
let _ctsSalesCache = { at: 0, promise: null };
function getCtsSalesMap() {
  if (_ctsSalesCache.promise && Date.now() - _ctsSalesCache.at < 5 * 60 * 1000) {
    return _ctsSalesCache.promise;
  }
  const promise = (async () => {
    const r = await fetch(`${TDT_PROXY}/api/service-codes?category=${encodeURIComponent('Custom Tees')}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} from service-codes?category`);
    const j = await r.json();
    const map = new Map();
    (j && j.data || []).forEach((row) => {
      const m = /^CTS-SALE-(.+)$/.exec(String(row.ServiceCode || ''));
      const off = parseFloat(row.SellPrice);
      if (m && row.IsActive && off > 0) map.set(m[1].toUpperCase(), off);
    });
    return map;
  })();
  _ctsSalesCache = { at: Date.now(), promise };
  promise.catch(() => { _ctsSalesCache = { at: 0, promise: null }; });
  return promise;
}
async function getCtsSaleOff(style) {
  try {
    const map = await getCtsSalesMap();
    return map.get(String(style || '').toUpperCase()) || 0;
  } catch (e) {
    console.warn(`[CTS] sale lookup failed for ${style} (selling at regular price):`, e.message);
    return 0;
  }
}

const _ctsCfgCache = new Map();   // styleNumber → { at, value }
async function getCtsPricingConfig(styleNumber) {
  const style = String(styleNumber || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(style)) throw new Error(`Invalid style number: ${styleNumber}`);
  const hit = _ctsCfgCache.get(style);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

  const grab = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
    return r.json();
  };
  const code = getCtsServiceCode;

  const [pricingData, rushPct, shipFee, shipFlat, shipFreeOver, saleOff] = await Promise.all([
    // method=DTG_Store — retail storefront's own tiers/margin/LTM (DecorationMethod=
    // 'DTG_Store' in Pricing_Tiers; reuses DTG print costs). Decoupled from wholesale
    // DTG. MUST match the client fetch (custom-tees-app.js) or the reprice would 409.
    grab(`${TDT_PROXY}/api/pricing-bundle?method=DTG_Store&styleNumber=${encodeURIComponent(style)}`),
    code('3DT-RUSH'), code('3DT-SHIP'),
    // Small-batch fee now lives on the DTG_Store tier rows (LTM_Fee $25 on the
    // 1-11/12-23 tiers); the legacy CTS-LTM service-code override was retired
    // 2026-06-22, so we no longer load it here.
    // UberPrints shipping model (Erik 2026-06-10): flat under the threshold,
    // FREE at/over it. Both Caspio-tunable, both fail-closed via code().
    code('CTS-SHIP-FLAT'), code('CTS-SHIP-FREE-OVER'),
    // Per-style sale — OPTIONAL (0 when absent; errors → 0, regular price).
    getCtsSaleOff(style),
  ]);
  if (!Array.isArray(pricingData.tiersR) || !pricingData.tiersR.length) {
    throw new Error(`No DTG pricing tiers for style ${style}`);
  }
  // Per-style size whitelist comes from the SERVER-fetched bundle (load-bearing:
  // an unknown client size key must never inflate the tier while pricing $0).
  const sizes = (pricingData.sizes || []).map(s => s.size).filter(Boolean);
  // LTM threshold (label use only — the FEE math lives on the tier rows inside
  // CTS_PRICING) = first non-LTM tier's MinQuantity, same as the TDT loader.
  const nonLtm = (pricingData.tiersR || [])
    .filter(t => !parseFloat(t.LTM_Fee || 0))
    .sort((a, b) => a.MinQuantity - b.MinQuantity);
  if (!nonLtm.length) throw new Error(`DTG pricing tiers for ${style} missing a non-LTM tier`);
  const value = {
    pricingData,
    config: { rushPct, shipFee, bakeLtm: true, shipFlat, shipFreeOver, saleOff, ltmThreshold: nonLtm[0].MinQuantity, sizes: sizes.length ? sizes : TDT_SIZES.slice() },
  };
  _ctsCfgCache.set(style, { at: Date.now(), value });
  return value;
}

// Curated-catalog whitelist: customers may only order the ~20 DTG-tested top
// sellers (same source the internal builder renders). Cached 1h; fail-closed.
let _ctsCatalogCache = null;
let _ctsCatalogAt = 0;
async function getCtsCatalog() {
  if (_ctsCatalogCache && Date.now() - _ctsCatalogAt < 60 * 60 * 1000) return _ctsCatalogCache;
  // /styles is the aggregate list endpoint (the same one the gallery renders).
  const r = await fetch(`${TDT_PROXY}/api/dtg/top-sellers/styles`);
  if (!r.ok) throw new Error(`top-sellers fetch failed: HTTP ${r.status}`);
  const j = await r.json();
  const styles = Array.isArray(j) ? j : (j.records || j.data || j.styles || []);
  if (!styles.length) throw new Error('top-sellers returned an empty catalog');
  const map = new Map();
  styles.forEach(s => { const k = String(s.style || s.styleNumber || '').toUpperCase(); if (k) map.set(k, s); });
  _ctsCatalogCache = map;
  _ctsCatalogAt = Date.now();
  return map;
}

// Per-style piece weight for the UPS estimate (PC54's getTdtShipMeta is the
// single-style original; this one keys the SanMar lookup by style, 1h cache).
const _ctsShipMetaCache = new Map();
async function getCtsShipMeta(styleNumber) {
  const style = String(styleNumber || 'PC54').toUpperCase();
  const hit = _ctsShipMetaCache.get(style);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.value;
  let pieceWeightLb = 0.44;   // tee-class default; refreshed from SanMar below
  let perBox = 58;
  try {
    const r = await fetch(`${TDT_PROXY}/api/shipping/box-density`);
    if (r.ok) {
      const j = await r.json();
      const v = parseInt(j && j.density && j.density['T-Shirt'], 10);
      if (v > 0) perBox = v;
    }
  } catch (e) { console.warn('[CTS ship] box-density fetch failed, using default 58:', e.message); }
  try {
    const r = await fetch(`${TDT_PROXY}/api/inventory?styleNumber=${encodeURIComponent(style)}`);
    if (r.ok) {
      const j = await r.json();
      const rows = Array.isArray(j) ? j : (j.data || j.result || []);
      const w = parseFloat((rows.find(x => parseFloat(x.PIECE_WEIGHT) > 0) || {}).PIECE_WEIGHT);
      if (w > 0) pieceWeightLb = w;
    }
  } catch (e) { console.warn(`[CTS ship] piece-weight fetch failed for ${style}, using default 0.44:`, e.message); }
  const value = { pieceWeightLb, perBox };
  _ctsShipMetaCache.set(style, { at: Date.now(), value });
  return value;
}

// → { amount, source } like resolveTdtShipping, but weight keyed to the style.
async function resolveCtsShipping(toZip, qty, styleNumber) {
  const zip = String(toZip || '').trim().slice(0, 5);
  const pieces = Math.max(1, parseInt(qty, 10) || 1);
  if (/^\d{5}$/.test(zip)) {
    try {
      const meta = await getCtsShipMeta(styleNumber);
      const boxes = Math.max(1, Math.ceil(pieces / meta.perBox));
      const totalLb = pieces * meta.pieceWeightLb;
      const boxWeightsLb = Array.from({ length: boxes }, () => Math.round((totalLb / boxes) * 100) / 100);
      const r = await fetch(`${TDT_PROXY}/api/shipping/estimate-ups-ground`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toZip: zip, weightLb: totalLb, boxes, boxWeightsLb, residential: true }),
      });
      const j = r.ok ? await r.json() : null;
      const est = j && parseFloat(j.estimate);
      if (Number.isFinite(est) && est > 0) {
        return {
          amount: Math.round(est * 100) / 100,
          source: 'ups-estimate',
          detail: { boxes, weightLb: totalLb, zone: j.zone, residential: true },
        };
      }
      console.warn('[CTS ship] estimator returned no usable estimate, falling back to flat');
    } catch (e) {
      console.warn('[CTS ship] UPS estimate failed, falling back to flat:', e.message);
    }
  }
  const { config } = await getCtsPricingConfig(styleNumber || 'PC54');
  return { amount: config.shipFee, source: 'flat' };
}

// Rebuild the full Custom-Tees quote server-side (authoritative, like
// rebuildTdtQuote but per-style + rush-aware). Returns the same shape plus
// style/product metadata the checkout route stamps onto the order.
async function rebuildCtsQuote(colorConfigs, orderSettings, customerData) {
  const styleRaw = orderSettings && orderSettings.styleNumber;
  const style = String(styleRaw || '').trim().toUpperCase();
  const catalog = await getCtsCatalog();
  if (!catalog.has(style)) {
    throw Object.assign(new Error(`Style ${styleRaw || '(none)'} is not in the Custom T-Shirts catalog`), { code: 'STYLE_NOT_ALLOWED' });
  }
  const product = catalog.get(style);

  const rushRequested = !!(orderSettings && orderSettings.rush);
  if (rushRequested && !CTS_RUSH_ELIGIBLE.has(style)) {
    throw Object.assign(new Error(`3-Day Rush is not available for style ${style}`), { code: 'RUSH_NOT_ELIGIBLE' });
  }

  const { pricingData, config } = await getCtsPricingConfig(style);
  const tax = await resolveTdtTax(customerData);

  // FREE-PLACEMENT model (Erik 2026-06-10): the price tier derives from the
  // ART'S PRINTED SIZE. The server re-derives it from the submitted placement
  // dimensions (clamped to the 16×20 envelope) via the SAME pure rule the
  // browser uses — the client's location codes are advisory; a doctored
  // payload cannot buy jumbo art at the Left Chest rate.
  const clampDim = (v, max) => Math.min(Math.max(parseFloat(v) || 0, 0), max);
  const sideDims = (p) => {
    if (!p || !(parseFloat(p.wIn) > 0)) return null;
    const wIn = clampDim(p.wIn, 16);
    const hIn = clampDim(p.hIn || p.wIn, 20);   // legacy payloads without hIn: assume square-ish
    return { wIn, hIn };
  };
  const fDims = sideDims(orderSettings?.placement?.front);
  const bDims = sideDims(orderSettings?.placement?.back);
  let frontLoc;
  let backLoc;
  if (fDims || bDims) {
    frontLoc = fDims ? CTS_PRICING.locationForArtSize('front', fDims.wIn, fDims.hIn) : null;
    backLoc = bDims ? CTS_PRICING.locationForArtSize('back', bDims.wIn, bDims.hIn) : null;
  } else {
    // Legacy fallback (pre-free-placement payloads): trust the explicit codes.
    const front = String(orderSettings?.frontLocation || orderSettings?.printLocationCode || 'LC').toUpperCase();
    frontLoc = ['LC', 'FF', 'JF'].includes(front.split('_')[0]) ? front.split('_')[0] : 'LC';
    backLoc = orderSettings?.backLocation ? String(orderSettings.backLocation).toUpperCase() : null;
    if (!backLoc && /_FB/.test(front)) backLoc = 'FB';
    if (!backLoc && /_JB/.test(front)) backLoc = 'JB';
    if (backLoc && !['FB', 'JB'].includes(backLoc)) backLoc = null;
  }

  const sizes = config.sizes;
  const cart = Object.values(colorConfigs || {}).map(c => {
    const qty = {};
    sizes.forEach(size => {
      const sd = (c.sizeBreakdown || {})[size];
      const q = parseInt(sd && sd.quantity, 10) || 0;
      if (q > 0) qty[size] = q;
    });
    return { catalogColor: c.catalogColor, colorName: c.displayColor || c.catalogColor, qty };
  });
  const method = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';

  // Shipping is the UberPrints threshold model since 2026-06-10: the pricing
  // module computes it from config.shipFlat/shipFreeOver vs the merchandise
  // subtotal — no per-ZIP UPS resolver in the CTS charge path anymore
  // (resolveCtsShipping stays for the legacy 3DT estimate endpoint).
  const quote = CTS_PRICING.quote({
    pricingData,
    config,
    cart,
    location: frontLoc,
    backLocation: backLoc,
    rush: rushRequested,
    delivery: { method, taxRate: tax.rate },
  });
  const shipResolved = method === 'pickup'
    ? { amount: 0, source: 'pickup' }
    : { amount: quote.shipping, source: quote.shipping > 0 ? 'flat-under-threshold' : 'free-over-threshold' };
  return {
    quote, tax, config, shipping: shipResolved,
    style, rush: rushRequested, frontLocation: frontLoc, backLocation: backLoc,
    sizes,
    productName: product.product_title || product.name || `${style} Tee`,
  };
}

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
const CTS_REF_ART = { wIn: 8, hIn: 8 };       // → 'FF' (full-front) via locationForArtSize
const CTS_REF_QTYS = [12, 24, 48, 72];        // card price @12 + the hover ladder
const _ctsStyleCopyCache = new Map();          // style → { at, value: { blurb, fabric } }
let _ctsGalleryExtrasCache = { at: 0, value: null };

async function getCtsStyleCopy(style) {
  const hit = _ctsStyleCopyCache.get(style);
  if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000) return hit.value;
  let value = { blurb: '', fabric: '' };
  try {
    const r = await fetch(`${TDT_PROXY}/api/product-details?styleNumber=${encodeURIComponent(style)}`);
    if (r.ok) {
      const rows = await r.json();
      const desc = (Array.isArray(rows) && rows[0] && rows[0].PRODUCT_DESCRIPTION) || '';
      value = {
        blurb: CTS_MERCH.extractBlurb(desc),
        fabric: CTS_MERCH.extractFabric(desc).label,
      };
    } else {
      console.warn(`[CTS gallery] product-details HTTP ${r.status} for ${style} — card ships without a blurb`);
    }
  } catch (e) {
    console.warn(`[CTS gallery] product-details failed for ${style} — card ships without a blurb:`, e.message);
  }
  _ctsStyleCopyCache.set(style, { at: Date.now(), value });
  return value;
}

// Per-piece reference prices for one style at the ladder quantities. Reuses
// the 5-min-cached getCtsPricingConfig (DTG_Store bundle + fail-closed Service_
// Codes; the baked small-batch fee at 12 comes from the DTG_Store tier) and the
// pure quote engine — identical inputs to checkout's reprice, minus tax/shipping.
async function priceCtsStyleRefs(style) {
  const { pricingData, config } = await getCtsPricingConfig(style);
  const loc = CTS_PRICING.locationForArtSize('front', CTS_REF_ART.wIn, CTS_REF_ART.hIn);
  const sizes = config.sizes || [];
  const sizeKey = sizes.includes('M') ? 'M' : sizes[0];
  if (!sizeKey) throw new Error(`No priced sizes for ${style}`);
  const onSale = parseFloat(config.saleOff) > 0;
  const runQuote = (qty, cfg) => CTS_PRICING.quote({
    pricingData, config: cfg,
    cart: [{ catalogColor: 'REF', colorName: 'Reference', qty: { [sizeKey]: qty } }],
    location: loc, backLocation: null, rush: false,
    delivery: { method: 'pickup', taxRate: 0 },
  });
  const prices = {};
  const wasPrices = {};
  CTS_REF_QTYS.forEach((qty) => {
    // perShirt is the ENGINE'S own per-piece figure — (merch + LTM) / qty,
    // baked-LTM aware — the same number the configurator shows customers.
    const ea = Number(runQuote(qty, config).perShirt);
    if (!(ea > 0)) throw new Error(`Reference quote for ${style} @ ${qty} produced no per-shirt price`);
    prices[String(qty)] = ea;
    if (onSale) {
      // Strike-through "was" = the SAME quote with the sale zeroed.
      wasPrices[String(qty)] = Number(runQuote(qty, { ...config, saleOff: 0 }).perShirt);
    }
  });
  return onSale
    ? { prices, wasPrices, salePerShirt: parseFloat(config.saleOff) }
    : { prices };
}

// GET /api/cts/gallery-extras — { qtys, refLocation, styles: { STYLE:
//   { blurb, fabric, prices: { '12': ea, ... } } | { ..., priceError } } }
app.get('/api/cts/gallery-extras', async (req, res) => {
  try {
    if (_ctsGalleryExtrasCache.value
      && Date.now() - _ctsGalleryExtrasCache.at < 5 * 60 * 1000) {  // ≤ the 5-min config cache — card prices must not outlive the configurator's
      return res.json(_ctsGalleryExtrasCache.value);
    }
    const catalog = await getCtsCatalog();
    const styles = [...catalog.keys()];
    const out = {};
    const CHUNK = 5;   // limit cold-cache proxy fan-out (bundle+codes per style)
    for (let i = 0; i < styles.length; i += CHUNK) {
      await Promise.all(styles.slice(i, i + CHUNK).map(async (style) => {
        const copy = await getCtsStyleCopy(style);
        try {
          out[style] = { ...copy, ...(await priceCtsStyleRefs(style)) };
        } catch (e) {
          console.error(`[CTS gallery] reference pricing failed for ${style}:`, e.message);
          out[style] = { ...copy, priceError: 'Pricing unavailable' };
        }
      }));
    }
    const value = { qtys: CTS_REF_QTYS, refLocation: 'FF', styles: out };
    _ctsGalleryExtrasCache = { at: Date.now(), value };
    res.json(value);
  } catch (e) {
    console.error('[CTS gallery] gallery-extras failed:', e.message);
    res.status(502).json({ error: 'Gallery pricing is unavailable right now.' });
  }
});

// ── Custom Tees live stock gate (2026-06-10) ────────────────────────────────
// Confirms every requested color+size quantity against live stock AFTER the
// authoritative reprice and BEFORE the Stripe session exists. Source is
// RUSH-AWARE (Erik 2026-06-10): Milton local stock only matters when the
// 3-day clock can't wait for replenishment — SanMar delivers to us next-day,
// so STANDARD 7-10-business-day orders gate on SanMar even for PC54.
//   PC54 + RUSH   → Milton warehouse (/api/manageorders/pc54-inventory — the
//                   same feed the page polls; ?refresh=true busts its cache)
//   everything else (incl. PC54 standard)
//                 → SanMar PromoStandards (/api/sanmar/inventory/:style;
//                   partColor IS the CATALOG_COLOR mainframe code, totalQty
//                   already summed across warehouses; proxy caches ~5 min)
// FAIL-OPEN by design (Erik): an inventory API hiccup logs a warning and
// stamps stockChecked:false on the order — it NEVER blocks a sale. Only a
// CONFIRMED shortage 409s, and confirmation always re-fetches fresh first so
// a stale 60s cache can't turn away an order that's actually in stock.

const CTS_STOCK_TTL_MS = 60 * 1000;
const _ctsStockCache = new Map();   // 'STYLE|source' → { at, value: { colors:Set, bySize:Map } }

async function fetchJsonTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// → { colors: Set<COLOR>, bySize: Map<'COLOR|SIZE', qty> } (keys uppercased).
// `rush` picks the source: Milton only gates PC54 RUSH orders; standard
// orders (PC54 included) gate on SanMar — we restock from them next-day.
async function getCtsStock(styleNumber, fresh, rush) {
  const style = String(styleNumber || '').toUpperCase();
  const useMilton = rush === true && style === 'PC54';
  const cacheKey = `${style}|${useMilton ? 'milton' : 'sanmar'}`;
  const hit = _ctsStockCache.get(cacheKey);
  if (!fresh && hit && Date.now() - hit.at < CTS_STOCK_TTL_MS) return hit.value;

  const colors = new Set();
  const bySize = new Map();
  if (useMilton) {
    const j = await fetchJsonTimeout(`${TDT_PROXY}/api/manageorders/pc54-inventory${fresh ? '?refresh=true' : ''}`, 5000);
    Object.entries((j && j.colors) || {}).forEach(([color, c]) => {
      colors.add(color.toUpperCase());
      Object.entries((c && c.sizes) || {}).forEach(([size, qty]) => {
        bySize.set(`${color}|${size}`.toUpperCase(), parseInt(qty, 10) || 0);
      });
    });
  } else {
    const j = await fetchJsonTimeout(`${TDT_PROXY}/api/sanmar/inventory/${encodeURIComponent(style)}`, 5000);
    ((j && j.inventory) || []).forEach((p) => {
      if (!p || !p.color || !p.size) return;
      const key = `${p.color}|${p.size}`.toUpperCase();
      colors.add(String(p.color).toUpperCase());
      bySize.set(key, (bySize.get(key) || 0) + (parseInt(p.totalQty, 10) || 0));
    });
  }
  if (!bySize.size) throw new Error(`stock feed returned no rows for ${style}`);
  const value = { colors, bySize };
  _ctsStockCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// Server-sanitized cleanConfigs vs a stock snapshot → [{catalogColor,
// displayColor, size, want, have}]. A color the feed doesn't name at all is
// skipped (fail-open — a naming mismatch must never read as "sold out").
function ctsStockConflicts(cleanConfigs, stock) {
  const conflicts = [];
  Object.values(cleanConfigs || {}).forEach((c) => {
    const colorKey = String(c.catalogColor).toUpperCase();
    if (!stock.colors.has(colorKey)) return;
    Object.entries(c.sizeBreakdown || {}).forEach(([size, sd]) => {
      const want = sd.quantity;
      const have = stock.bySize.get(`${colorKey}|${size.toUpperCase()}`) || 0;
      if (want > have) {
        conflicts.push({ catalogColor: c.catalogColor, displayColor: c.displayColor, size, want, have });
      }
    });
  });
  return conflicts;
}

// ── Custom Hats ('custom-caps') server core (2026-06-11) ────────────────────
// Server twin of pages/js/custom-caps-pricing.js: fetches the CAP + CAP-AL
// bundles and the CAPS-SHIP-* Service_Codes FRESH (fail-closed), reprices
// server-side, and the shared checkout route enforces the 1-cent tolerance
// against the client total. qty < 8 → the module's structured BELOW_MINIMUM
// error → 400 (never a 1-7-tier price, never an LTM fee).

const _capsCfgCache = new Map();   // styleNumber → { at, value }
async function getCapsPricingConfig(styleNumber) {
  const style = String(styleNumber || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(style)) throw new Error(`Invalid style number: ${styleNumber}`);
  const hit = _capsCfgCache.get(style);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

  const grab = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
    return r.json();
  };
  const code = async (c) => {
    const j = await grab(`${TDT_PROXY}/api/service-codes?code=${c}`);
    const row = j && j.data && j.data[0];
    if (!row || !row.IsActive || !(parseFloat(row.SellPrice) >= 0)) {
      throw new Error(`Service code ${c} missing/inactive in Caspio`);
    }
    return parseFloat(row.SellPrice);
  };

  // ALL fail-closed: a missing bundle or Caspio code 502s the checkout
  // visibly — never a guessed price (Erik's #1 rule). NOTE the FREE-OVER
  // trap: its SellPrice holds the THRESHOLD dollars (mirrors CTS).
  const [capBundle, capAlBundle, shipFlat, shipFreeOver] = await Promise.all([
    grab(`${TDT_PROXY}/api/pricing-bundle?method=CAP&styleNumber=${encodeURIComponent(style)}`),
    grab(`${TDT_PROXY}/api/pricing-bundle?method=CAP-AL`),
    code('CAPS-SHIP-FLAT'), code('CAPS-SHIP-FREE-OVER'),
  ]);
  if (!Array.isArray(capBundle.tiersR) || !capBundle.tiersR.length) {
    throw new Error(`No cap pricing tiers for style ${style}`);
  }
  // OSFA-only store (v1): a fitted cap (S/M-M/L-L/XL) reaching this point is
  // a catalog-seeding mistake — refuse it visibly rather than mis-price.
  const hasOsfa = (capBundle.sizes || []).some(
    (s) => String(s && s.size).trim().toUpperCase() === 'OSFA' && parseFloat(s.price) > 0
  );
  if (!hasOsfa) {
    throw Object.assign(
      new Error(`Style ${style} has no OSFA blank price (fitted caps are not sold on Custom Hats)`),
      { code: 'STYLE_NOT_ALLOWED' }
    );
  }
  const value = {
    capBundle,
    capAlBundle,
    config: { shipFlat, shipFreeOver, sizes: ['OSFA'] },
  };
  _capsCfgCache.set(style, { at: Date.now(), value });
  return value;
}

// Curated caps catalog — Caspio table CAPS_Catalog_2026 (one row per
// style+hero-color, displayOrder + is_active) is the system of record,
// served by the proxy route GET /api/caps/catalog. Until that proxy route
// ships (follow-up — clone of dtg-top-sellers.js), the registry-pinned
// CAPS_FALLBACK_LINEUP below mirrors the seeded rows so checkout works; the
// fallback logs LOUDLY and only whitelists styles/names (every PRICE still
// comes fail-closed from the APIs above). When the route goes live, Caspio
// takes over automatically — no deploy.
const CAPS_FALLBACK_LINEUP = [
  { style: '112', product_title: 'Richardson Trucker Cap 112' },
  { style: 'C402', product_title: 'Port Authority Snapback Trucker Cap. C402' },
  { style: '112PFP', product_title: 'Richardson Printed Five-Panel Trucker 112PFP' },
  { style: '256', product_title: 'Richardson Umpqua Gramps Cap 256' },
  { style: '258', product_title: 'Richardson 5-Panel Classic Rope Cap 258' },
  { style: '220', product_title: 'Richardson Relaxed Performance Lite 220' },
  { style: 'C914', product_title: 'Port Authority Six-Panel Unstructured Twill Cap. C914' },
  { style: 'STC26', product_title: 'Sport-Tek PosiCharge RacerMesh Cap. STC26' },
  { style: 'CT105298', product_title: 'Carhartt Canvas Mesh Back Cap CT105298' },
];
let _capsCatalogCache = null;
let _capsCatalogAt = 0;
async function getCapsCatalog() {
  if (_capsCatalogCache && Date.now() - _capsCatalogAt < 60 * 60 * 1000) return _capsCatalogCache;
  const map = new Map();
  try {
    const r = await fetch(`${TDT_PROXY}/api/caps/catalog`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const rows = Array.isArray(j) ? j : (j.records || j.data || j.styles || []);
    rows.forEach((row) => {
      if (!row || row.is_active === false) return;
      const k = String(row.style || row.styleNumber || '').toUpperCase();
      if (k && !map.has(k)) map.set(k, row);
    });
    if (!map.size) throw new Error('caps catalog returned no active styles');
  } catch (e) {
    console.warn(`[Custom Caps] catalog API unavailable (${e.message}) — using the registry-pinned 9-style lineup (styles/names only; all pricing stays API-fed)`);
    map.clear();
    CAPS_FALLBACK_LINEUP.forEach((row) => map.set(row.style.toUpperCase(), row));
  }
  _capsCatalogCache = map;
  _capsCatalogAt = Date.now();
  return map;
}

// Caps stock conflicts — C402 lesson (2026-06-11): SanMar cap inventory
// carries STALE SIZED partIds (e.g. style 112 returns 5 'XL' + 5 'SM' rows
// at 0 qty next to the real OSFA rows), so per-size comparison would read a
// fully-stocked color as sold out. Aggregate live qty by CATALOG_COLOR and
// compare against the color's total wanted quantity. A color the feed
// doesn't name at all is skipped (fail-open — naming mismatch must never
// read as "sold out"), same as ctsStockConflicts.
function capsStockConflicts(cleanConfigs, stock) {
  const byColor = new Map();
  stock.bySize.forEach((qty, key) => {
    const color = key.slice(0, key.lastIndexOf('|'));
    byColor.set(color, (byColor.get(color) || 0) + qty);
  });
  const conflicts = [];
  Object.values(cleanConfigs || {}).forEach((c) => {
    const colorKey = String(c.catalogColor).toUpperCase();
    if (!stock.colors.has(colorKey)) return;
    let want = 0;
    Object.values(c.sizeBreakdown || {}).forEach((sd) => { want += (sd && sd.quantity) || 0; });
    const have = byColor.get(colorKey) || 0;
    if (want > have) {
      conflicts.push({ catalogColor: c.catalogColor, displayColor: c.displayColor, size: 'OSFA', want, have });
    }
  });
  return conflicts;
}

// Rebuild the full Custom-Hats quote server-side (authoritative). Same shape
// contract as rebuildCtsQuote so the shared checkout route consumes it
// unchanged: { quote, tax, config, shipping, style, rush, sizes, productName }
// plus the caps facts (backLogo) stampedOrderSettings reads.
async function rebuildCapsQuote(colorConfigs, orderSettings, customerData) {
  const styleRaw = orderSettings && orderSettings.styleNumber;
  const style = String(styleRaw || '').trim().toUpperCase();
  const catalog = await getCapsCatalog();
  if (!catalog.has(style)) {
    throw Object.assign(new Error(`Style ${styleRaw || '(none)'} is not in the Custom Hats catalog`), { code: 'STYLE_NOT_ALLOWED' });
  }
  const product = catalog.get(style);

  // NO rush on caps v1 (registry rushEligible is []) — digitizing + proof
  // approval make a 3-day promise unsafe. A doctored rush flag 400s.
  if (orderSettings && orderSettings.rush) {
    throw Object.assign(new Error('Rush service is not available for Custom Hats'), { code: 'RUSH_NOT_ELIGIBLE' });
  }

  const { capBundle, capAlBundle, config } = await getCapsPricingConfig(style);
  const tax = await resolveTdtTax(customerData);

  // Back logo: a server-recognized FLAG (true, or an uploaded-file object) —
  // pricing keys on the server's reading, never on client prices.
  const bl = orderSettings && orderSettings.backLogo;
  const backLogo = bl === true || !!(bl && typeof bl === 'object' && (bl.fileUrl || bl.url));

  // OSFA-only cart: one quantity per color (sizeWhitelist is ['OSFA'], so an
  // unknown size key can neither inflate the tier nor ride along unpriced).
  const cart = Object.values(colorConfigs || {}).map((c) => {
    const sd = (c && c.sizeBreakdown) || {};
    const q = parseInt(sd.OSFA && sd.OSFA.quantity, 10) || 0;
    return { catalogColor: c && c.catalogColor, colorName: (c && (c.displayColor || c.catalogColor)) || '', quantity: q };
  }).filter((c) => c.catalogColor && c.quantity > 0);
  const method = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';

  // The module enforces the 8-cap minimum (BELOW_MINIMUM, mapped to 400 by
  // the checkout route) and the CeilDollar EMB-cap chain; shipping is the
  // CAPS-SHIP-* threshold model. NOTE: with the launch $100 threshold every
  // ≥8-cap order ships free — Erik tunes CAPS-SHIP-FREE-OVER in Caspio.
  const quote = CAPS_PRICING.quote({
    capBundle,
    capAlBundle,
    config,
    cart,
    backLogo,
    delivery: { method, taxRate: tax.rate },
  });
  const shipResolved = method === 'pickup'
    ? { amount: 0, source: 'pickup' }
    : { amount: quote.shipping, source: quote.shipping > 0 ? 'flat-under-threshold' : 'free-over-threshold' };
  return {
    quote, tax, config, shipping: shipResolved,
    style, rush: false, backLogo,
    sizes: config.sizes,
    productName: product.product_title || product.productName || `${style} Cap`,
  };
}

// → { amount, source: 'ups-estimate'|'flat', detail? }. Throws only if BOTH
// the estimator and the 3DT-SHIP flat fallback are unavailable.
async function resolveTdtShipping(toZip, qty) {
  const zip = String(toZip || '').trim().slice(0, 5);
  const pieces = Math.max(1, parseInt(qty, 10) || 1);
  if (/^\d{5}$/.test(zip)) {
    try {
      const meta = await getTdtShipMeta();
      const boxes = Math.max(1, Math.ceil(pieces / meta.perBox));
      const totalLb = pieces * meta.pieceWeightLb;
      const boxWeightsLb = Array.from({ length: boxes }, () => Math.round((totalLb / boxes) * 100) / 100);
      const r = await fetch(`${TDT_PROXY}/api/shipping/estimate-ups-ground`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Residential ON: 3-Day Tees customers overwhelmingly ship to homes.
        body: JSON.stringify({ toZip: zip, weightLb: totalLb, boxes, boxWeightsLb, residential: true }),
      });
      const j = r.ok ? await r.json() : null;
      const est = j && parseFloat(j.estimate);
      if (Number.isFinite(est) && est > 0) {
        return {
          amount: Math.round(est * 100) / 100,
          source: 'ups-estimate',
          detail: { boxes, weightLb: totalLb, zone: j.zone, residential: true },
        };
      }
      console.warn('[3DT ship] estimator returned no usable estimate, falling back to flat');
    } catch (e) {
      console.warn('[3DT ship] UPS estimate failed, falling back to flat:', e.message);
    }
  }
  const { config } = await getTdtPricingConfig();
  return { amount: config.shipFee, source: 'flat' };
}

// Destination tax, server-derived (client value is advisory): pickup → Milton,
// out-of-state → 0, in-WA → DOR destination lookup. Lookup failure THROWS —
// checkout fails visibly rather than charging a guessed rate.
async function resolveTdtTax(customerData) {
  const pickup = customerData.deliveryMethod === 'pickup';
  const state = String(customerData.state || '').trim().toUpperCase();
  if (!pickup && state && state !== 'WA' && state !== 'WASHINGTON') {
    return { rate: 0, account: '2202', accountName: 'Out of State Sales' };
  }
  const body = pickup
    ? { address: '', city: 'Milton', state: 'WA', zip: '98354' }
    : { address: customerData.address1 || '', city: customerData.city || '', state: 'WA', zip: customerData.zip || '' };
  const r = await fetch(`${TDT_PROXY}/api/tax-rates/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = r.ok ? await r.json() : null;
  if (!j || j.success === false || !Number.isFinite(parseFloat(j.rate))) {
    throw new Error('Sales-tax lookup failed for the shipping address');
  }
  return { rate: parseFloat(j.rate), account: j.account || null, accountName: j.accountName || null };
}

// Rebuild the full quote from the submitted cart using server-fetched config.
async function rebuildTdtQuote(colorConfigs, orderSettings, customerData) {
  const { pricingData, config } = await getTdtPricingConfig();
  const tax = await resolveTdtTax(customerData);
  const locCode = String(orderSettings?.printLocationCode || 'LC');
  // Size whitelist is LOAD-BEARING: combinedQuantity counts EVERY qty key but
  // only whitelisted sizes get priced — a crafted unknown size key would
  // inflate the tier (cheaper rate / dropped LTM) while paying for nothing.
  const cart = Object.values(colorConfigs || {}).map(c => {
    const qty = {};
    TDT_SIZES.forEach(size => {
      const sd = (c.sizeBreakdown || {})[size];
      const q = parseInt(sd && sd.quantity, 10) || 0;
      if (q > 0) qty[size] = q;
    });
    return { catalogColor: c.catalogColor, colorName: c.displayColor || c.catalogColor, qty };
  });
  const method = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';

  // Real UPS Ground estimate replaces the flat fee for shipped orders
  // (2026-06-09, Erik). Falls back to the 3DT-SHIP flat rate internally.
  let shipResolved = { amount: 0, source: 'pickup' };
  if (method === 'ship') {
    shipResolved = await resolveTdtShipping(customerData.zip, TDT_PRICING.combinedQuantity(cart));
  }

  const quote = TDT_PRICING.quote({
    pricingData,
    config: Object.assign({}, config, { shipFee: shipResolved.amount }),
    cart,
    location: locCode.indexOf('FF') === 0 ? 'FF' : 'LC',
    backEnabled: locCode.indexOf('_FB') !== -1,
    delivery: { method, taxRate: tax.rate },
  });
  return { quote, tax, config, shipping: shipResolved };
}

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
const CRM_API_SECRET = process.env.CRM_API_SECRET;

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
// =============================================================================
// CRM API PROXY ROUTES
// These routes protect the CRM API by validating session/role before forwarding
// to caspio-pricing-proxy with a server-side secret. The API never exposed to browser.
// =============================================================================


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

// Cached Staff_Page_Access rules (Page → Allowed_Roles/Allowed_Emails), refetched on a
// TTL. STALE-ON-ERROR: a transient proxy failure keeps the last-known rules so a
// restricted page stays restricted (never silently opened). Cold-start + immediate
// fetch failure → empty rules (every page falls back to any-logged-in-staff).
let _pageAccessCache = { at: 0, rules: {} };
const PAGE_ACCESS_TTL_MS = 60 * 1000;
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

// Page-access decision (who may open a gated staff page) lives in lib/page-access.js so it
// can be jest-locked — tests/unit/admin-page-access.test.js. Read the header there for the
// full rule; the short version is: exclusive email allowlist > admin override > "unlisted
// page = any logged-in staff, EXCEPT the Administration set, which defaults to admin-only".
const { ADMIN_DEFAULT_PAGES, userMayAccessPage } = require('./lib/page-access');

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

// Generic CRM proxy handler factory
function createCrmProxy(endpoint, allowedRoles) {
  return [
    requireCrmRole(allowedRoles),
    async (req, res) => {
      try {
        // Build the target URL (preserve path after the endpoint prefix)
        const targetPath = req.originalUrl.replace(`/api/crm-proxy/${endpoint}`, '');
        const targetUrl = `${CRM_API_BASE}/api/${endpoint}${targetPath}`;

        // Forward the request with the secret header
        const fetchOptions = {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-API-Secret': CRM_API_SECRET
          }
        };

        // Include body for POST/PUT requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);
        const data = await response.json();

        // Forward the response status and data
        res.status(response.status).json(data);
      } catch (error) {
        console.error(`[CRM Proxy] Error proxying to ${endpoint}:`, error.message);
        res.status(500).json({ error: 'Proxy error', message: error.message });
      }
    }
  ];
}

// Customer-directory access is staff-only. Preserve the query and keep the
// CRM secret on the server; public forms can still accept manually typed details.
async function staffContactProxy(req, res) {
  try {
    const upstream = await fetch(CRM_API_BASE + req.originalUrl, {
      method: req.method,
      headers: withProxySecret({ 'Content-Type': 'application/json' }),
      ...(['POST', 'PUT', 'PATCH'].includes(req.method) ? { body: JSON.stringify(req.body || {}) } : {})
    });
    if (upstream.status === 204) return res.sendStatus(204);
    res.status(upstream.status).json(await upstream.json());
  } catch (error) {
    console.error('[Contact Proxy]', error.message);
    res.status(502).json({ error: 'Unable to load customer contacts' });
  }
}
app.all(['/api/company-contacts', '/api/company-contacts/*', '/api/company-contacts-2026', '/api/company-contacts-2026/*'], requireStaff, staffContactProxy);

// Taneisha accounts proxy - requires 'taneisha' role
app.all('/api/crm-proxy/taneisha-accounts*', ...createCrmProxy('taneisha-accounts', ['taneisha']));

// Nika accounts proxy - requires 'nika' role
app.all('/api/crm-proxy/nika-accounts*', ...createCrmProxy('nika-accounts', ['nika']));

// House accounts proxy - requires 'house' role
app.all('/api/crm-proxy/house-accounts*', ...createCrmProxy('house-accounts', ['house']));

// Sales Reps 2026 proxy - requires 'house' role (admin can view/edit all reps)
app.all('/api/crm-proxy/sales-reps-2026*', ...createCrmProxy('sales-reps-2026', ['house']));

// Assignment history + ShopWorks To-Do — audit trail of rep assignments and the
// "still needs keying into ShopWorks" checklist (no write-back exists; Erik keys
// CustomerServiceRep by hand and the ODBC mirror confirms it). NOTE: the house
// page has POSTed here since the reconcile audit-trail shipped, but this
// forwarder never existed — every log call 404'd silently (caught 2026-07-19).
app.all('/api/crm-proxy/assignment-history*', ...createCrmProxy('assignment-history', ['house']));

// Payroll proxy — gated by the SAME Staff_Page_Access row as payroll.html, which is an
// exclusive email allowlist (Erik only, 2026-07-27). Deliberately NOT requireCrmRole:
// a role gate can't express "one person", and today's ['admin'] would silently widen the
// moment a second admin is added. One table row now controls the page and its data
// together — Erik changes who sees payroll without a deploy.
// The parse route carries a base64 PDF, so it needs a bigger body parser than the 5mb
// global — its authenticated parser is registered BEFORE the global parser above.
app.all('/api/crm-proxy/payroll*', requirePageAccess('payroll.html'), createCrmProxy('payroll', ['admin'])[1]);

// Policies Hub admin proxy - requires 'policies-admin' role (currently Erik only).
// Public reads do NOT go through here — frontend hits /api/policies-public on the
// caspio-pricing-proxy directly (unprotected, Published+Active only).
app.all('/api/crm-proxy/policies*', ...createCrmProxy('policies', ['policies-admin']));

// Policies Hub comments admin proxy - moderation actions (resolve / hide / edit)
// require 'policies-admin'. Public reads + posts hit
// /api/policy-comments-public on the proxy directly, no role gate.
app.all('/api/crm-proxy/policy-comments*', ...createCrmProxy('policy-comments', ['policies-admin']));

// RBAC admin CRUD — ADMIN ONLY. Powers the Access-Admin UI (edits Staff_App_Roles +
// Staff_Page_Access on the proxy). requireCrmRole(['admin']) + the proxy's secret gate.
app.all('/api/crm-proxy/admin-rbac*', ...createCrmProxy('admin-rbac', ['admin']));

// Caspio call meter + quota pacing — ADMIN ONLY. Powers /dashboards/api-usage.html.
// Upstream (/api/admin/metrics, /api/admin/usage) is requireCrmApiSecret-gated, so the
// browser MUST come through here — the secret never reaches the client.
//
// ⚠️ The path segment must MATCH upstream. createCrmProxy derives the target by
// string-replacing the endpoint name out of req.originalUrl, so a prettier alias
// like 'admin-metrics' would build /api/admin-metrics (404) and fail to strip the
// prefix, mangling the query string.
app.all('/api/crm-proxy/admin/metrics*', ...createCrmProxy('admin/metrics', ['admin']));
app.all('/api/crm-proxy/admin/usage*', ...createCrmProxy('admin/usage', ['admin']));

// Customer Portal admin — CRUD on the Customer_Portal_Access invite registry. Powers the
// "Customer Portals" staff console. Role-gated (the management team) + the proxy's secret.
app.all('/api/crm-proxy/customer-portal-access*', ...createCrmProxy('customer-portal-access', PORTAL_ADMIN_ROLES));
// Customer lookup for the "add customer" search (resolve a contact → id_Customer + company).
// company-contacts/search is secret-gated; staff builders use the relay above, while proxying it
// keeps the admin page same-origin + role-gated + carries the secret harmlessly.
app.all('/api/crm-proxy/company-contacts*', ...createCrmProxy('company-contacts', PORTAL_ADMIN_ROLES));
// Re-order request work-queue (Phase 4) — the console's "Requests" tab lists/updates/deletes
// Portal_Reorder_Requests via the proxy portal-reorder route (GET /requests, PUT/DELETE /requests/:pk).
app.all('/api/crm-proxy/portal-reorder*', ...createCrmProxy('portal-reorder', PORTAL_ADMIN_ROLES));
// Reward dollars (Phase 5) — the console reads a customer's ledger/balance here. WRITES go
// through the dedicated /api/portal-admin/rewards/entry (which stamps the staff email).
app.all('/api/crm-proxy/customer-rewards*', ...createCrmProxy('customer-rewards', PORTAL_ADMIN_ROLES));

// The verified session email is the ONLY source of truth for audit-attribution
// fields — the client body used to supply Updated_By/Created_By, so any staffer
// could attribute an edit / timeline note to a colleague. Overwrite it server-side.
function stampSessionIdentity(field) {
  return (req, res, next) => {
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
      if (email) req.body[field] = email;
    }
    next();
  };
}

// Hard-delete a lead — ADMIN ONLY, enforced HERE (identity from the session, never
// the request). Registered BEFORE the generic mount so it wins the route match; the
// deletedBy is appended server-side from the verified session. Mirrors the
// quote_sessions delete precedent. The proxy DELETE cascades the lead's timeline.
app.delete('/api/crm-proxy/form-submissions/:submissionId', requireCrmRole(['admin']), async (req, res) => {
  try {
    const caller = req.session && req.session.crmUser;
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    const email = String(caller.email || '').toLowerCase();
    const id = encodeURIComponent(req.params.submissionId);
    const url = `${CRM_API_BASE}/api/form-submissions/${id}?deletedBy=${encodeURIComponent(email)}`;
    const response = await fetch(url, { method: 'DELETE', headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) console.log(`[lead-delete] ${email} deleted ${req.params.submissionId}`);
    else console.warn(`[lead-delete] BLOCKED/failed ${req.params.submissionId} for ${email} → ${response.status}`);
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[lead-delete] error:', err.message);
    res.status(500).json({ error: 'Delete failed', message: err.message });
  }
});

// ── Sample-order push forwarder (PUBLIC by necessity) ────────────────────────
// The last anonymous route on the proxy: POST /api/manageorders/orders/create
// creates a real ShopWorks order, and pages/sample-cart.html posted to it
// DIRECTLY from the browser at a hardcoded proxy URL.
//
// 🔴 This one CANNOT take requireStaff. Unlike every Box caller, the sample cart
// is a CUSTOMER flow — there is no SAML session to prove. So this forwarder is
// deliberately public, and what it buys is:
//   · the proxy route stops being an open order-creation endpoint to the entire
//     internet — only this app can reach it, using the shared secret
//   · abuse controls live in one place we own (strictLimiter, 20/hr per IP,
//     the same bucket the other order-submission endpoints use)
//   · the payload is validated and bounded before it can reach ShopWorks
//
// ⚠️ BE CLEAR ABOUT WHAT THIS IS NOT: order creation is still unauthenticated.
// A determined caller can still POST here. The real fix is verifying a payment
// before pushing to ShopWorks — a product change, not plumbing.
function validateSampleOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be an object';
  if (typeof body.orderNumber !== 'string' || !body.orderNumber.trim() || body.orderNumber.length > 64) {
    return 'orderNumber must be a non-empty string under 64 chars';
  }
  if (!body.customer || typeof body.customer !== 'object') return 'customer object is required';
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) return 'lineItems must be a non-empty array';
  if (body.lineItems.length > 200) return 'lineItems exceeds 200';
  if (body.files !== undefined) {
    if (!Array.isArray(body.files)) return 'files must be an array';
    if (body.files.length > 5) return 'files exceeds 5';
    for (const f of body.files) {
      if (!f || typeof f !== 'object') return 'each file must be an object';
      // ~4 MB of base64. bodyParser caps the whole request at 5 MB anyway; this
      // rejects the pathological single-file case with a clear message.
      if (typeof f.fileData === 'string' && f.fileData.length > 5.6e6) return 'file too large';
    }
  }
  return null;
}

/**
 * Prove server-side that a FREE-path order really is free.
 *
 * 🔴 THE HOLE THIS CLOSES. The cart decides free-vs-paid in the BROWSER:
 *   if (SampleCheckout.hasPaid(samples)) { start Stripe checkout; return; }
 * and hasPaid() simply trusts `s.type === 'paid'` off the client object. Paid
 * carts are handled correctly — Stripe hosted checkout, then the
 * signature-verified webhook (`metadata.kind === 'samples-order'`) pushes the
 * order with a PAID payments block. But a doctored payload that labels paid
 * samples as free, or just posts `price: 0`, skips that branch entirely and
 * lands a real ShopWorks order for goods nobody paid for.
 *
 * So this repeats what the paid route already does — "client prices are
 * advisory" — using the SAME repricer (shared_components/js/sample-pricing.js)
 * and the SAME data path (/api/size-pricing, /api/pricing-bundle fallback).
 * No second pricing path: if the authoritative price is not zero, the order is
 * refused and the customer is sent through checkout.
 */
async function verifySampleOrderIsFree(lineItems) {
  const seen = new Set();
  for (const item of lineItems) {
    const style = String((item && item.partNumber) || '').trim().toUpperCase();
    const size = String((item && item.size) || '').trim();
    if (!style || !size) return { ok: false, status: 400, error: 'Each sample needs a style and a size.' };
    // One sample per style, same rule the paid route enforces.
    if (seen.has(style + '|' + size)) {
      return { ok: false, status: 400, error: `Duplicate sample in the cart: ${style} ${size}.` };
    }
    seen.add(style + '|' + size);

    const spr = await fetch(`${TDT_PROXY}/api/size-pricing?styleNumber=${encodeURIComponent(style)}`);
    const rows = spr.ok ? await spr.json() : null;
    let result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: null, size });
    if (!result.eligible && result.reason === 'no_margin') {
      const br = await fetch(`${TDT_PROXY}/api/pricing-bundle?method=BLANK&styleNumber=${encodeURIComponent(style)}`);
      const bundle = br.ok ? await br.json() : null;
      result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: bundle, size });
    }
    if (!result.eligible) {
      return {
        ok: false, status: 400,
        error: result.reason === 'bad_size'
          ? `${style} isn’t offered in size ${size} — remove it and try again.`
          : `${style} isn’t available as an online sample right now — remove it, or call 253-922-5793.`,
      };
    }
    // The whole point: this path is for FREE samples only.
    if (result.type !== 'free' || result.price > 0) {
      console.warn(`[sample-order] BLOCKED free-path push: ${style} ${size} prices at $${result.price}`);
      return {
        ok: false, status: 402,
        error: `${style} (${size}) is a paid sample — please check out so payment is collected. Nothing was ordered.`,
      };
    }
  }
  return { ok: true };
}

app.post('/api/manageorders/orders/create', strictLimiter, async (req, res) => {
  if (!CRM_API_SECRET) {
    console.error('[sample-order] CRM_API_SECRET is not set — refusing to forward');
    return res.status(503).json({ error: 'Order service is not configured' });
  }
  const invalid = validateSampleOrder(req.body);
  if (invalid) {
    console.warn('[sample-order] rejected: ' + invalid);
    return res.status(400).json({ error: invalid });
  }
  try {
    // Reprice BEFORE forwarding — a paid item must never reach ShopWorks
    // through this route.
    const freeCheck = await verifySampleOrderIsFree(req.body.lineItems);
    if (!freeCheck.ok) {
      return res.status(freeCheck.status).json({ error: freeCheck.error });
    }
  } catch (err) {
    // Erik's #1 rule: never let a pricing lookup fail OPEN into a free order.
    console.error('[sample-order] reprice check failed:', err.message);
    return res.status(502).json({ error: 'Could not verify sample pricing — nothing was ordered. Please try again.' });
  }
  try {
    const upstream = await fetch(`${CRM_API_BASE}/api/manageorders/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.set('Cache-Control', 'no-store');
    return res.send(text);
  } catch (err) {
    console.error('[sample-order] forward failed:', err.message);
    return res.status(502).json({ error: 'Order submission failed' });
  }
});

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

// Box file IDs are numeric; anything else is rejected rather than forwarded.
function boxFileId(req) {
  const id = String(req.params.fileId || '');
  if (!/^\d{1,25}$/.test(id)) throw new Error('Invalid Box file id');
  return id;
}

app.get('/api/box/thumbnail/:fileId', requireStaff, boxForward(req => 'thumbnail/' + boxFileId(req)));
app.get('/api/box/download/:fileId', requireStaff, boxForward(req => 'download/' + boxFileId(req)));
app.get('/api/box/art-folders', requireStaff, boxForward(() => 'art-folders'));
app.get('/api/box/mockup-folders', requireStaff, boxForward(() => 'mockup-folders'));
app.get('/api/box/folder-files', requireStaff, boxForward(() => 'folder-files'));
app.get('/api/box/search', requireStaff, boxForward(() => 'search'));
// shared-image takes a caller-supplied ?url=; the PROXY is what validates it is
// a box.com URL, so this only carries it across — it never fetches it itself.
app.get('/api/box/shared-image', requireStaff, boxForward(() => 'shared-image'));

// ── Box WRITE routes, same session gate (2026-08-05) ─────────────────────────
// Every page that calls these is already SAML-gated (verified: ae-dashboard,
// art-hub-steve, bradley-*, art-request-detail, mockup-detail, transfer-detail
// all 302 anonymously), so unlike the reads there was no public caller to work
// around — the forwarder is the whole fix.
//
// Body handling differs per route and that distinction is load-bearing:
//   'json'   — bodyParser.json (mounted globally above) has ALREADY consumed and
//              parsed the stream, so it must be re-serialised from req.body.
//              Piping req here would send an empty body.
//   'stream' — multipart. bodyParser.json ignores it precisely because the
//              content-type doesn't match, so req is still unread and can be
//              piped straight through. That also means the app never buffers a
//              20 MB upload; it just relays it.
//   'none'   — DELETE carries no body.
//
// `force=true` is the only query any write route uses (delete confirmation).
const BOX_FORWARD_WRITE_QUERY = new Set(['force']);

function boxForwardWrite(suffix, mode) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[box-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Box proxy is not configured' });
    }
    let target;
    try {
      target = `${CRM_API_BASE}/api/box/${typeof suffix === 'function' ? suffix(req) : suffix}`;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (BOX_FORWARD_WRITE_QUERY.has(k) && typeof v === 'string') qs.set(k, v);
    }
    if (qs.toString()) target += '?' + qs;

    const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
    let body;
    if (mode === 'json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body || {});
    } else if (mode === 'stream') {
      // Carry the multipart boundary and length across verbatim, or the
      // proxy's multer cannot parse the parts.
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
      if (req.headers['content-length']) headers['Content-Length'] = req.headers['content-length'];
      body = req;
    }

    try {
      const upstream = await fetch(target, { method: req.method, headers, body });
      res.status(upstream.status);
      // content-length omitted for the reason spelled out in boxForward above:
      // the piped body is inflated, upstream's length is not. Latent rather than
      // live here — write responses run 30-200 bytes so the proxy never gzips
      // them — except DELETE's 409 "file in use" body, which carries one entry
      // per referencing record and crosses 1 KB at ~13 references.
      for (const h of ['content-type', 'content-disposition']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.setHeader('Cache-Control', 'no-store');
      if (!upstream.body) return res.end();
      upstream.body.pipe(res);
      upstream.body.on('error', (err) => {
        console.error('[box-forward] upstream stream error:', err.message);
        res.destroy(err);
      });
    } catch (err) {
      console.error('[box-forward] ' + req.method + ' ' + target + ' failed:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Box request failed' });
    }
  };
}

app.post('/api/box/shared-link', requireStaff, boxForwardWrite('shared-link', 'json'));
app.post('/api/box/create-mockup-folder', requireStaff, boxForwardWrite('create-mockup-folder', 'json'));
app.post('/api/box/upload-to-folder', requireStaff, boxForwardWrite('upload-to-folder', 'stream'));
app.delete('/api/box/file/:fileId', requireStaff, boxForwardWrite(req => 'file/' + boxFileId(req), 'none'));

// ── Mockup data forwarder (session-gated) ────────────────────────────────────
// The same move as the Box forwarder above, for the mockup RECORD data.
//
// The proxy gates these reads secret-OR-browser-Origin, and an Origin header is
// caller-controlled: `curl -H 'Origin: https://www.teamnwca.com'` reproduces a
// staff browser exactly and returns Company_Name, Id_Customer, Work_Order_Number
// and AE_Notes — in bulk from the list route, which will happily return 500 rows.
// The browser cannot hold a secret, so the fix is the one that already worked for
// Box: the page calls THIS origin, the SAML cookie rides along, requireStaff
// proves the session server-side, and only the app holds the secret used upstream.
// Once every caller is repointed here the proxy reads go secret-only and the
// Origin bypass disappears.
//
// 🔴 GET reads only, deliberately. The CUSTOMER approval view (?view=customer)
// performs writes — PUT /api/mockups/:id/status and POST /api/mockup-notes — with
// no staff session to prove, so routing writes through requireStaff would break
// approve/revise. Those stay on the proxy until they get the capability-token
// treatment the portal read bundle already has.
//
// Params are rebuilt from an allowlist rather than passed through, so a caller
// cannot smuggle anything into the upstream query. This list is taken from the
// actual call sites, not guessed: art-hub-ruth and ae-dashboard send orderBy+limit,
// portal-directory dateFrom+pageSize, design-gallery designNumber+limit, and the
// broken-mockups scan sends refresh.
const MOCKUP_FORWARD_QUERY = new Set([
  'designNumber', 'idCustomer', 'dateFrom', 'dateTo', 'orderBy', 'limit', 'pageSize', 'refresh',
  'since', 'user', // mockup-notifications poll
]);

function mockupForward(buildPath) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[mockup-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Mockup proxy is not configured' });
    }
    let suffix;
    try {
      suffix = buildPath(req);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (MOCKUP_FORWARD_QUERY.has(k) && typeof v === 'string') qs.set(k, v);
    }
    const target = `${CRM_API_BASE}/api/${suffix}${qs.toString() ? '?' + qs : ''}`;
    try {
      const upstream = await fetch(target, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET },
        signal: AbortSignal.timeout(20000),
      });
      const body = await upstream.text();
      // Customer data behind a per-session gate must never sit in a shared cache.
      res.status(upstream.status)
        .type(upstream.headers.get('content-type') || 'application/json')
        .set('Cache-Control', 'no-store')
        .send(body);
    } catch (err) {
      console.error('[mockup-forward] ' + target + ' failed:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Mockup request failed' });
    }
  };
}

// Mockup ids are numeric; anything else is rejected rather than forwarded.
function mockupRecordId(req) {
  const id = String(req.params.id || '');
  if (!/^\d{1,12}$/.test(id)) throw new Error('Invalid mockup id');
  return id;
}

// 🔴 The literal segment MUST be registered before the :id pattern, or Express
// captures 'broken-mockups' as an id. mockupRecordId()'s numeric check makes that
// safe even if the order were wrong — but both guards exist because relying on
// registration order alone is how this breaks the day someone loosens the regex.
app.get('/api/mockups/broken-mockups', requireStaff, mockupForward(() => 'mockups/broken-mockups'));
app.get('/api/mockups', requireStaff, mockupForward(() => 'mockups'));
app.get('/api/mockups/:id', requireStaff, mockupForward(req => 'mockups/' + mockupRecordId(req)));
app.get('/api/mockup-notes/:id', requireStaff, mockupForward(req => 'mockup-notes/' + mockupRecordId(req)));
app.get('/api/mockup-versions/:id', requireStaff, mockupForward(req => 'mockup-versions/' + mockupRecordId(req)));
// The notification feed looks harmless and is not: each entry carries companyName
// and designNumber, and the handler only filters by ?user= when that param is
// present — so an anonymous poll with no user returns EVERY queued notification.
// In-memory and pruned, so it is usually empty, which is exactly why it went
// unnoticed.
app.get('/api/mockup-notifications', requireStaff, mockupForward(() => 'mockup-notifications'));

// ── DTG print-box calibration WRITES (admin only) ────────────────────────────
// The calibration tool (/tools/custom-tees-calibrate.html) used to POST and
// DELETE straight from the browser to the proxy, which required no credentials
// at all — so anyone who knew the URL could move or delete the print box for
// every style. That does not leak data; it silently misprints customer orders,
// which is worse to discover.
//
// 🔴 THE GET DELIBERATELY STAYS OPEN AND IS NOT FORWARDED. The PUBLIC customer
// designer at /custom-tees (verified 200 anonymously) reads
// GET /api/dtg-calibration?styleNumber=… via pages/js/custom-tees-app.js:433.
// Gating that would break the customer-facing tee designer. Only the writes are
// the hole, so only the writes move behind the session. Same lesson as the Box
// gating: check for a public caller BEFORE adding a secret.
//
// requirePageAccess (not requireStaff) so ONE Staff_Page_Access rule governs
// both the page and its writes — matching custom-tees-calibrate.html's entry in
// ADMIN_DEFAULT_PAGES, and letting Erik widen access from Caspio with no deploy.
//
// ⚠️ DEPLOY ORDER: this app change must be LIVE BEFORE the proxy starts
// requiring the secret on those two routes, or the tool breaks in between.
function dtgCalibrationForwardWrite(buildSuffix, mode) {
  return async (req, res) => {
    if (!CRM_API_SECRET) {
      console.error('[dtg-calibration-forward] CRM_API_SECRET is not set — refusing to forward');
      return res.status(503).json({ error: 'Calibration proxy is not configured' });
    }
    let target;
    try {
      target = `${CRM_API_BASE}/api/dtg-calibration${buildSuffix(req)}`;
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
    let body;
    if (mode === 'json') {
      // bodyParser.json has already consumed the stream, so it must be
      // re-serialised — piping req here would send an empty body.
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body || {});
    }
    try {
      const upstream = await fetch(target, { method: req.method, headers, body });
      const text = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(text);
    } catch (err) {
      console.error('[dtg-calibration-forward] ' + target + ' failed:', err.message);
      if (!res.headersSent) return res.status(502).json({ error: 'Calibration request failed' });
    }
  };
}

// Caspio PK_ID is numeric; anything else is rejected rather than forwarded, so a
// caller cannot smuggle path segments into the upstream URL.
function dtgCalibrationPkId(req) {
  const id = String(req.params.pkId || '');
  if (!/^\d{1,15}$/.test(id)) throw new Error('Invalid calibration record id');
  return '/' + id;
}

// No express.json() here: bodyParser.json is mounted globally (~L1837), so
// req.body is already parsed by the time this runs — which is exactly why the
// forwarder re-serialises it instead of piping req.
app.post('/api/dtg-calibration',
  requirePageAccess('custom-tees-calibrate.html'),
  dtgCalibrationForwardWrite(() => '', 'json'));

app.delete('/api/dtg-calibration/:pkId',
  requirePageAccess('custom-tees-calibrate.html'),
  dtgCalibrationForwardWrite(dtgCalibrationPkId, 'none'));

// ── Contract embroidery COST MODEL (staff only) ──────────────────────────────
// Feeds the margin overlay on /calculators/embroidery-contract/.
//
// 🔴 That calculator is served by the PUBLIC `/calculators` static mount — it is
// deliberately reachable without a login (Ruthie's desk AND ASI distributors).
// So the cost side can NEVER live in its JS: anything shipped to that page is
// readable by every distributor who has the link. It lives here instead, behind
// requireStaff, exactly like /pricing/decals is gated "because it exposes
// cost-side rate bands".
//
// requireStaff answers /api/* with 401 JSON, which doubles as the page's
// "am I staff?" probe — a 401 simply means the overlay never renders.
//
// Figures are the settled 2026-07-30 allocation model (memory/COST_ALLOCATION_MODEL.md).
// Env vars let Erik retune without a deploy; `asOf` is returned so a stale model
// is visible on screen instead of silently trusted.
app.get('/api/contract-embroidery/cost-model', requireStaff, (req, res) => {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  res.set('Cache-Control', 'no-store');   // never cached into a shared proxy
  res.json({
    // Fully-loaded production hour — art INCLUDED (the 2026-07-30 decision).
    productionHourRate: num(process.env.EMB_PRODUCTION_HOUR_RATE, 30.09),
    // Per-ORDER overhead pool. Flat $70 is the settled figure; the $100
    // driver-based variant is deliberately not the default.
    orderPool: num(process.env.EMB_ORDER_POOL, 70),
    asOf: process.env.EMB_COST_MODEL_AS_OF || '2026-07-30',
    source: 'memory/COST_ALLOCATION_MODEL.md',
  });
});

// Form Submissions (Forms Inbox) — saved fillable-form twins. ANY logged-in staff
// (like unlisted dashboard pages), so we reuse the factory's forwarder but swap the
// role gate for requireStaff. Proxy side is secret-only (holds customer contact info).
// DELETE is 405'd here so no future proxy delete surface is any-staff-reachable —
// hard delete goes through the admin-only route above. Updated_By is session-stamped.
const [, formSubmissionsForwarder] = createCrmProxy('form-submissions', []);
app.all('/api/crm-proxy/form-submissions*', requireStaff, (req, res, next) => {
  if (req.method === 'DELETE') return res.status(405).json({ error: 'Deleting a lead requires the admin delete route.' });
  next();
}, stampSessionIdentity('Updated_By'), formSubmissionsForwarder);

// Leads board (dashboards/leads.html) order history — ORDER_ODBC reads for a
// matched ShopWorks customer. Any logged-in staff; the upstream /api/order-odbc
// is CRM-secret-gated on the proxy (2026-07-18), so browsers must come through here.
const [, orderOdbcForwarder] = createCrmProxy('order-odbc', []);
app.all('/api/crm-proxy/order-odbc*', requireStaff, orderOdbcForwarder);

// Leads CRM activity timeline (notes / status history / attachments on a lead) —
// Lead_Activity reads+appends. Any logged-in staff; secret-only upstream.
const [, leadActivityForwarder] = createCrmProxy('lead-activity', []);
app.all('/api/crm-proxy/lead-activity*', requireStaff, stampSessionIdentity('createdBy'), leadActivityForwarder);

// Leads CRM one-click outreach emails (preview + send-as-the-AE, logged to the
// timeline). Any logged-in staff; secret-only upstream.
const [, leadOutreachForwarder] = createCrmProxy('lead-outreach', []);
app.all('/api/crm-proxy/lead-outreach*', requireStaff, leadOutreachForwarder);

// Leads CRM "Send a marketing kit" — AEs request catalog/sample/sticker kits for a
// lead; Mikalah (shipping) works the queue (dashboards/marketing-shipments.html).
// Any logged-in staff; the upstream router holds recipient PII (secret-only).
const [, marketingShipmentsForwarder] = createCrmProxy('marketing-shipments', []);
app.all('/api/crm-proxy/marketing-shipments*', requireStaff, (req, res, next) => {
  // Stamp the requester/updater from the verified session (attribution, not trust).
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
    if (email) {
      if (req.body.requestedBy !== undefined || req.method === 'POST') req.body.requestedBy = email;
      if (req.body.Updated_By !== undefined || req.method === 'PUT') req.body.Updated_By = email;
    }
  }
  next();
}, marketingShipmentsForwarder);

// Jim's Mailing List (dashboards/jim-mailing-list.html) — the owner's manual
// prospect list. Any logged-in staff (it's an internal list, not the sales
// pipeline); the upstream Prospect_Mailing_List router is secret-only (holds
// contact info). Added_By (on create) + Updated_By (on writes) are stamped from
// the verified session so the browser can't attribute an edit to someone else.
const [, jimMailingListForwarder] = createCrmProxy('jim-mailing-list', []);
// 12mb body limit: the /extract sub-route accepts a pasted screenshot (base64).
app.all('/api/crm-proxy/jim-mailing-list*', requireStaff, express.json({ limit: '12mb' }), (req, res, next) => {
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const email = (req.session && req.session.crmUser && req.session.crmUser.email) || '';
    if (email) {
      if (req.method === 'POST') req.body.Added_By = email;
      req.body.Updated_By = email;
    }
  }
  next();
}, jimMailingListForwarder);

// AE Mission Control aggregate feed — the ONE data call behind
// /dashboards/ae-mission-control.html. Identity comes from the verified SAML
// session, never the browser: we derive `email` server-side and only honor a
// ?viewAs= override for admins (Erik's view-as-rep switcher). Role-gated to
// the AEs + admin because the payload includes the rep's commission dollars.
function aeDashboardForwarder(upstreamPath) {
  return async (req, res) => {
    try {
      const caller = req.session.crmUser;
      const perms = caller.permissions || [];
      let email = String(caller.email || '').toLowerCase();
      const viewAs = String(req.query.viewAs || '').toLowerCase().trim();
      if (viewAs && perms.includes('admin')) email = viewAs; // admin-only override
      const params = new URLSearchParams({ email });
      if (req.query.refresh) params.set('refresh', String(req.query.refresh));
      const response = await fetch(`${CRM_API_BASE}${upstreamPath}?${params}`, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
      });
      const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
      res.status(response.status).json(data);
    } catch (error) {
      console.error(`[CRM Proxy] ae-dashboard ${upstreamPath} error:`, error.message);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  };
}
app.get('/api/crm-proxy/ae-dashboard/summary', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/summary'));
// Growth radar ("Money on the Table") — same identity rules as the summary.
app.get('/api/crm-proxy/ae-dashboard/growth', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/growth'));
// Purchasing tracker — JotForm "Purchasing" form (requests to Bradley) joined
// to the ShopWorks PurchaseOrders mirror (ordered/received) per work order.
app.get('/api/crm-proxy/ae-dashboard/purchasing', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/purchasing'));
// Data-quality radar ("Missing Info — Fix in ShopWorks") — restores the
// forwarder for the concurrent session's MC card after the 2026-07-19 server.js
// hotfix revert (its proxy endpoint /api/ae-dashboard/data-quality is live).
app.get('/api/crm-proxy/ae-dashboard/data-quality', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/data-quality'));
// Order Due Dates — unshipped ShopWorks orders that already missed their requested-ship
// date, or fall due within 7 days with the blanks not yet purchased/received (PurchaseOrders
// mirror join). Same identity rules as the summary.
// ⚠️ RE-REGISTERED 2026-07-26: shipped in df1b62d4, then lost in the aa33b66f "revert foreign
// vendor-portal server.js hunks" hotfix — the same revert that ate data-quality above. That
// one got restored; this one did not, so the MC card 404'd for both reps for a week. The UI
// harness could not catch it: tests/ui/test-ae-mission-control-stub.js replaces window.fetch
// wholesale and answers this URL itself, so route REGISTRATION must be probed live.
app.get('/api/crm-proxy/ae-dashboard/due-dates', requireCrmRole(['taneisha', 'nika', 'ruth', 'admin']), aeDashboardForwarder('/api/ae-dashboard/due-dates'));
// Company-wide past-due roll-up — every rep, grouped, ?days= window (2026-08-10). The
// per-rep route above injects the caller's own email; this one deliberately does not, so
// it is the whole shop and gets a wider gate. Not aeDashboardForwarder: that helper's
// whole job is to attach the session email, which is exactly what must NOT happen here.
// requireStaff, not a role list (Erik, 2026-08-10): anyone logged into the staff
// dashboard should see this. Bradley raises the purchase orders and 12 of the 22
// past-due orders are waiting on a PO nobody has cut yet; production and receiving
// have the same reason to look. Still SAML-gated — never public.
app.get('/api/crm-proxy/ae-dashboard/due-dates-all', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
    const refresh = (req.query.refresh === '1' || req.query.refresh === 'true') ? '&refresh=1' : '';
    const r = await fetch(`${CRM_API_BASE}/api/ae-dashboard/due-dates-all?days=${days}${refresh}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(60000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[due-dates-all]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});
// Q3 2026 Embroidery Bonus — activation bounties + growth ladder + $3M team kicker.
// Proxy side is secret-only (it exposes per-account customer names, revenue and payroll
// dollars), so browsers come through here. Role-gated to the two AEs + admin, same as the
// rest of the commission surfaces.
function embroideryBonusForwarder(upstreamPath, { injectIdentity = false, teamOnly = false } = {}) {
  return async (req, res) => {
    try {
      const caller = req.session.crmUser;
      const perms = caller.permissions || [];
      const params = new URLSearchParams();
      if (req.query.quarter) params.set('quarter', String(req.query.quarter));
      if (req.query.year) params.set('year', String(req.query.year));
      // Cache bypass for the page's Refresh button. Without this the bonus hero and the
      // target roadmap kept serving cache while every other card re-pulled — a Refresh
      // that half works is worse than one that doesn't (added 2026-07-26).
      if (req.query.refresh) params.set('refresh', String(req.query.refresh));
      // Call list only: 'top' hydrates phone/email for the first 15 rows, 'all' for the rest
      // when the rep presses "See more". Whitelisted rather than forwarded raw so the query
      // can't be used to force the expensive path.
      if (req.query.hydrate === 'all') params.set('hydrate', 'all');
      // scope=team is forced server-side, never read from the query — a caller on the
      // shared-dashboard route can't widen it into per-rep compensation.
      if (teamOnly) params.set('scope', 'team');
      if (injectIdentity) {
        // Identity from the verified SAML session, never the browser. Admins may
        // view as another rep (Erik's switcher); a rep can only ever see their own.
        let email = String(caller.email || '').toLowerCase();
        const viewAs = String(req.query.viewAs || '').toLowerCase().trim();
        if (viewAs && perms.includes('admin')) email = viewAs;
        if (perms.includes('admin') && !viewAs) {
          // Admin with no override: return every rep (omit email entirely).
        } else {
          params.set('email', email);
        }
      }
      const response = await fetch(`${CRM_API_BASE}${upstreamPath}?${params}`, {
        headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
      });
      const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
      res.status(response.status).json(data);
    } catch (error) {
      console.error(`[CRM Proxy] embroidery-bonus ${upstreamPath} error:`, error.message);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  };
}
// Per-rep figures. Identity injected from the session: a rep only ever receives their own
// numbers, and an admin with no ?viewAs= gets every rep (the Erik overview).
app.get('/api/crm-proxy/embroidery-bonus',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus', { injectIdentity: true }));
app.get('/api/crm-proxy/embroidery-bonus/config',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/config'));
// 🔒 TEAM-ONLY feed for the shared staff dashboard, which EVERY employee opens.
// Returns the company Q3 number and the kicker tiers — never a rep's earnings. Open to any
// logged-in staff precisely because it carries no compensation.
app.get('/api/crm-proxy/embroidery-bonus/team',
  requireStaff,
  embroideryBonusForwarder('/api/embroidery-bonus', { teamOnly: true }));
// Dormant call list — the 378 accounts with embroidery history gone quiet 12+ months.
// Identity injected so a rep sees only their own book.
app.get('/api/crm-proxy/embroidery-bonus/dormant',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/dormant', { injectIdentity: true }));
// Target roadmap — who to call to earn more: win-backs, never-embroidered accounts that
// already buy from us, and accounts a nudge away from a bounty. Identity-injected.
app.get('/api/crm-proxy/embroidery-bonus/targets',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/targets', { injectIdentity: true }));
// Call list — the same three plays merged into ONE ranked order of work, with a phone
// number attached and the rep's own call history folded in. Identity-injected: this
// carries customer phone numbers and contact names, so a rep sees only their own book.
app.get('/api/crm-proxy/embroidery-bonus/call-list',
  requireCrmRole(['taneisha', 'nika', 'admin']),
  embroideryBonusForwarder('/api/embroidery-bonus/call-list', { injectIdentity: true }));

// Purchasing Portal — company-wide view of the same feed (every request to
// Bradley + requester + status). ANY logged-in staff; no identity injection.
app.get('/api/crm-proxy/purchasing-portal', requireStaff, async (req, res) => {
  try {
    // ?refresh=1 is the portal's Refresh button — forwarded so the proxy rebuilds
    // instead of re-serving its 15-minute cache (2026-09-05).
    const refresh = (req.query.refresh === '1' || req.query.refresh === 'true') ? '?refresh=1' : '';
    const response = await fetch(`${CRM_API_BASE}/api/ae-dashboard/purchasing-all${refresh}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }
    });
    const data = await response.json().catch(() => ({ error: 'Bad upstream response' }));
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[CRM Proxy] purchasing-portal error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
});

// Leads CRM conversion tracking + rep scorecard (dashboards/lead-scorecard.html):
// GET /lead-scorecard (per-rep closes + order value) — any logged-in staff;
// secret-only upstream. The auto-Won run/scan stay admin-key server-side.
const [, leadScorecardForwarder] = createCrmProxy('lead-scorecard', []);
app.all('/api/crm-proxy/lead-scorecard*', requireStaff, leadScorecardForwarder);

// Leads CRM "Rescan with Claude" — classify newly-arrived leads (spam/
// unqualified/qualified) on demand. Any logged-in staff; secret-only upstream.
const [, leadClassifyForwarder] = createCrmProxy('lead-classify', []);
app.all('/api/crm-proxy/lead-classify*', requireStaff, leadClassifyForwarder);

// Blog Editor (dashboards/blog-editor.html) — staff write posts through this
// forwarder (adds the CRM secret the proxy's gateWritesOnly demands; also lets
// the editor list/read Drafts, which the public blog-posts endpoint hides).
// Gated by the SAME Staff_Page_Access row as blog-editor.html (2026-07-28): this
// endpoint PUBLISHES TO THE PUBLIC SITE, and it was requireStaff — so gating only
// the page would have left any logged-in staffer able to POST here directly. One
// rule now controls the page and its writes together, and they can't drift.
// (Public /blog reads don't touch this route; they use lib/blog.js.)
const [, blogPostsForwarder] = createCrmProxy('blog-posts', []);
app.all('/api/crm-proxy/blog-posts*', requirePageAccess('blog-editor.html'), blogPostsForwarder);

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
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, path, requirePageAccess, requireStaff, SERVER_DIR: __dirname }; require('./routes/gear-publisher')(app, ctx); }
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

// ============================================================================
// Online Order Form — submit to ShopWorks via caspio-pricing-proxy ManageOrders PUSH
// Mirrors the 3-Day Tees flow (server.js submit-3day-order) but:
//   - ExtSource = "NWCA-OrderForm" (so OnSite can filter these apart)
//   - No Stripe payment block (orders are paid offline via invoice)
//   - TaxTotal: 0 — lets OnSite calculate
//   - Accepts the order-form React state (info/rows/ship/orderNotes/files)
//   - Uses OF-MMDD-nn as ExtOrderID when submitted via a customer share link
// ============================================================================

// ============================================================================
// Notes builders — split a single order's metadata into ShopWorks's four
// note "types", each shown on a different screen to a different role:
//
//   Notes On Order      → CSR / front desk: customer info, source, tax account
//   Notes To Production → production team: method/stitch/location, garment qty breakdown
//   Notes To Shipping   → shipping/receiving: ship method, address, due date
//   Notes To Art        → art team: art notes + file links (only when present)
//
// Pattern adopted from Python Inksoft/web/transform.py:build_notes_array().
// ============================================================================

// NWCA's tax account lookup. Per Erik's rules (2026-05-20):
//   - Pickup at NWCA Milton, WA      -> 10.2% flat (Milton rate)
//   - Shipping out of WA state        → 0.0% (no nexus)
//   - Shipping IN WA state            → destination city rate (DOR lookup)
//
// These three rules ARE Washington's "destination-based sourcing" law, in
// effect since 2008. Authority:
//   - WAC 458-20-145  Sourcing — sale at seller's location vs. destination
//   - WAC 458-20-193  Interstate sales of tangible personal property
//                     (the basis for the "out-of-state ship = no WA tax" rule)
//   - WAC 458-20-110  Delivery charges
//                     ⚠ Shipping CHARGES are taxable too. The legally correct
//                     tax base is (subtotal + shipping) × rate. As of DTG Phase 2
//                     (2026-06-09) the DTG form BILLS shipping: it sends the fee
//                     in ship.fee → cur_Shipping (above) and breakdown.shipping,
//                     and buildOrderNote() uses taxableBase = subtotal + shipping.
//                     The DTG frontend already computes breakdown.taxEstimate on
//                     that base. (The React Order Form still sends no shipping →
//                     shipping defaults to 0, so its notes/total are unchanged.)
//   - DOR rate API:   webgis.dor.wa.gov/webapi/AddressRates.aspx
//                     (called from /api/tax-rates/lookup in this server)
//   - Live tool:      https://webgis.dor.wa.gov/taxratelookup/SalesTax.aspx
//
// The frontend looks up the in-state destination rate via /api/tax-rates/lookup
// and passes the computed taxTotal in the submit payload. The backend re-derives
// the GL account here so AR's books stay clean even if the frontend is wrong.
//
// Motor-vehicle / boat / aircraft sales are an EXCEPTION (taxed at seller's
// location even when delivered) — N/A for NWCA since we sell apparel.
function getTaxAccount(state, isCustomerPickup) {
  if (isCustomerPickup) return { code: '2200.102', label: 'Customer Pickup — Milton, WA 10.2%', rate: 0.102 };
  if (state && state.toUpperCase() !== 'WA') return { code: '2202', label: 'Out of State Sales — No Tax', rate: 0 };
  // In-WA shipping: rate is destination-specific (city of ship-to). The
  // frontend's DOR lookup returns the authoritative rate; we report the GL
  // account here and trust the rate it computed.
  return { code: '2200.102', label: 'WA Sales Tax — Destination City', rate: null };
}

// ============================================================================
// Sales tax accounts cache (Erik 2026-05-22)
// ----------------------------------------------------------------------------
// Caches the 33-row sales_tax_accounts_2026 Caspio table so the note builder
// can look up the rate-specific GL account (2200.101, 2200.102, …) without
// hitting the proxy on every submit. The frontend's /api/tax-rates/lookup
// returns this same data + the rate at once, but if it ever fails to populate
// ship.taxAccount, this server-side fallback prevents the order from landing
// in ShopWorks's generic "2200" parent account (which AR doesn't reconcile).
//
// TTL: 1 hour. The Caspio table changes ~never (WA DOR adjusts rates quarterly).
// ============================================================================
let _taxAccountsCache = null;
let _taxAccountsCacheAt = 0;
let _taxAccountsInFlight = null;
const TAX_ACCOUNTS_TTL_MS = 60 * 60 * 1000;

async function ensureTaxAccountsCache() {
  const fresh = _taxAccountsCache && (Date.now() - _taxAccountsCacheAt) < TAX_ACCOUNTS_TTL_MS;
  if (fresh) return _taxAccountsCache;
  if (_taxAccountsInFlight) return _taxAccountsInFlight;
  _taxAccountsInFlight = (async () => {
    try {
      const r = await fetch(`${SYNC_PROXY_BASE}/api/tax-rates`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      _taxAccountsCache = data.filter(a => a.Active === 'Yes' && Number.isFinite(Number(a.Tax_Rate)));
      _taxAccountsCacheAt = Date.now();
      console.log(`[tax-accounts] cache refreshed: ${_taxAccountsCache.length} active accounts`);
      return _taxAccountsCache;
    } catch (e) {
      console.warn('[tax-accounts] cache refresh failed (will serve stale or empty):', e.message);
      return _taxAccountsCache || [];
    } finally {
      _taxAccountsInFlight = null;
    }
  })();
  return _taxAccountsInFlight;
}

/**
 * Look up the rate-specific GL account from the cached sales_tax_accounts_2026
 * table. Matches `Tax_Rate` (decimal, e.g. 0.102 = 10.2%) with 0.0001 tolerance
 * to absorb float-rounding. Returns null when no match within ±0.5%.
 */
function findTaxAccountByRate(rateDecimal) {
  if (!Number.isFinite(rateDecimal) || rateDecimal <= 0) return null;
  const accounts = _taxAccountsCache || [];
  if (accounts.length === 0) return null;
  const exact = accounts.find(a => Math.abs(Number(a.Tax_Rate) - rateDecimal) < 0.0001);
  if (exact) {
    return { account: String(exact.Account_Number), accountName: exact.Account_Name };
  }
  // No exact match — find closest within 0.5% tolerance (handles DOR rates
  // that aren't on the standard 0.1% grid, e.g. 10.05%).
  let closest = null;
  for (const a of accounts) {
    const diff = Math.abs(Number(a.Tax_Rate) - rateDecimal);
    if (diff < 0.005 && (!closest || diff < closest.diff)) {
      closest = { a, diff };
    }
  }
  if (closest) {
    console.warn(`[tax-accounts] no exact match for rate=${rateDecimal} — closest ${closest.a.Tax_Rate} (acct ${closest.a.Account_Number})`);
    return { account: String(closest.a.Account_Number), accountName: closest.a.Account_Name };
  }
  return null;
}

// Notes On Order is the SINGLE most-glanced field in ShopWorks for the rep
// reviewing an order. Per Erik (2026-05-20): strip everything that's already
// in a structured ShopWorks field — Order ID is the External ID field,
// timestamp is Date Order Placed, company is the Customer header — and keep
// ONLY the tax-application instructions, which Erik applies manually after
// each order arrives (because the integration's hardcoded Tax_10.1 default (⚠️ Erik: bump ShopWorks integration to Tax_10.2/2200.102)
// would mis-label non-Milton-pickup orders).
//
// 4 possible blocks:
//   1. Pickup (always Milton, 10.2%)            -> APPLY: 2200.102
//   2. In-WA shipping (DOR destination lookup)  → APPLY: matched Caspio account
//   3. Out-of-state shipping                    → DO NOT APPLY
//   4. No tax info available (defensive)        → FLAG: needs rep review
function buildOrderNote({ info, breakdown, draftId, ship, orderNotes, extOrderId, printLocations }) {
  // M1 reverted 2026-05-22: Notes On Order is the primary tab CSR/AR/Production
  // all scan. Keep operational + financial in one place, one fact per line.
  // Tax block lives here (was briefly on Notes To Accounting under M1).
  const lines = [];

  // 0. Customer Warning (Erik 2026-05-23): if the customer record in
  // CompanyContactsMerge2026 has a Customer_Warning flag (e.g. "DO NOT
  // EXTEND CREDIT", "REQUIRES PREPAY"), surface it as the FIRST line so
  // AR sees it before doing anything else. The client passes it through
  // info.customerWarning (originally via the Order Form company picker).
  const cw = String(info?.customerWarning || '').trim();
  if (cw) {
    lines.push(`CUSTOMER WARNING: ${cw}`);
  }

  // 1. Print Locations — Erik's #1 thing he scans for in ShopWorks (2026-05-20).
  const locsClean = String(printLocations || '').trim();
  if (locsClean) {
    lines.push(`Print Locations: ${locsClean}`);
  }

  // 2. Tax block — subtotal / shipping / rate / amount / total / account, one per line.
  const subtotal = Number(breakdown?.subtotal) || 0;
  // [2026-06-09] DTG Phase 2 — billed shipping is TAXABLE in WA (WAC 458-20-110), so the
  // taxable base is (subtotal + shipping) and the total includes it even when tax doesn't
  // apply (wholesale/exempt/out-of-state). Defaults to 0 → unchanged for the React Order
  // Form (which doesn't send breakdown.shipping). breakdown.taxEstimate is ALREADY computed
  // on (subtotal+shipping) by the DTG frontend, so we only add the Shipping line + base/total.
  const shipping = Number(breakdown?.shipping) || 0;
  const taxAmount = Number(breakdown?.taxEstimate) || 0;
  const taxRate = Number(ship?.taxRate) || 0;
  const taxableBase = subtotal + shipping;
  const total = taxableBase + taxAmount;

  const isPickup = ship && (
    ship.method === 'Customer Pickup' ||
    ship.method === 'pickup' ||
    ship.method === 'willcall'
  );
  const shState = String(ship?.state || info?.state || '').toUpperCase();
  const isOutOfState = !isPickup && shState && shState !== 'WA';

  // Wholesale / reseller (WA reseller permit on file) → no tax, GL 2203. HIGHEST
  // priority — matches recomputeTaxRate's ordering (wholesale wins over exempt /
  // out-of-state / pickup), so a wholesale customer with an out-of-state ship-to
  // still books to 2203, not 2202. (2026-06-08 Phase 1 Chunk D — DTG/EMB/SCP/DTF)
  if (info?.isWholesale) {
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: DO NOT APPLY (wholesale / reseller)`);
    lines.push(`Tax Account: 2203 — Wholesale Sales (WA reseller permit)`);
    lines.push(`Reason: Customer marked Wholesale / reseller — sale for resale, no retail tax`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Tax-exempt customer (cert on file) → short-circuit
  if (info?.isTaxExempt) {
    const cert = info.taxExemptNumber || '(no cert # on file)';
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: EXEMPT — DO NOT APPLY`);
    lines.push(`Cert #: ${cert}`);
    lines.push(`Tax Account: 2204 — Tax Exempt`);
    lines.push(`Reason: Customer marked Tax Exempt in CompanyContactsMerge2026`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Out-of-state shipping → no tax (WAC 458-20-193)
  if (isOutOfState) {
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
    lines.push(`Tax: DO NOT APPLY (out of state)`);
    lines.push(`State: ${shState}`);
    lines.push(`Tax Account: 2202 — Out of State Sales`);
    lines.push(`Reason: WAC 458-20-193 (no nexus on out-of-state delivery)`);
    lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
    return lines;
  }

  // Pickup or in-WA shipping → apply tax. Resolve the rate-specific GL account.
  // Source priority:
  //   1. ship.taxAccount — frontend's /api/tax-rates/lookup result (authoritative)
  //   2. findTaxAccountByRate(taxRate) — server-side lookup from cached
  //      sales_tax_accounts_2026 table (fallback if frontend dropped it)
  //   3. Hardcoded '2200.102' for pickup (Milton, 10.2% as of 2026-07)
  // We DON'T fall through to generic '2200' parent — that would land orders in
  // an unreconciled GL account and confuse AR.
  let taxAccount = ship?.taxAccount;
  let taxAccountName = ship?.taxAccountName;
  if (!taxAccount && taxRate > 0) {
    const lookup = findTaxAccountByRate(taxRate);
    if (lookup) {
      taxAccount = lookup.account;
      taxAccountName = lookup.accountName;
    }
  }
  if (!taxAccount && isPickup) {
    taxAccount = '2200.102';   // Milton pickup — rose to 10.2% (DOR 2026-07-06)
    taxAccountName = '10.20%';
  }

  const ratePct = taxRate > 0 ? (taxRate * 100).toFixed(2) : null;

  if (ratePct && taxAccount) {
    const locationLabel = isPickup
      ? 'Milton pickup — flat'
      : `${ship?.city || 'WA destination'} — DOR lookup`;
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) {
      lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
      lines.push(`Taxable Base: $${taxableBase.toFixed(2)} (subtotal + shipping — WAC 458-20-110)`);
    }
    lines.push(`Tax Rate: ${ratePct}% (${locationLabel})`);
    lines.push(`Tax Amount: $${taxAmount.toFixed(2)}`);
    lines.push(`Total with Tax: $${total.toFixed(2)}`);
    lines.push(`Tax Account: ${taxAccount} — ${taxAccountName || ratePct + '%'}`);
    lines.push(`Apply Tax: Manually in ShopWorks`);
  } else {
    // No rate / no account resolved — flag for rep review.
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (shipping > 0) lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
    lines.push(`Tax: NEEDS REVIEW`);
    lines.push(`Rep: Confirm destination + apply correct WA rate before invoicing`);
  }

  // 3. Live Quote URL (Erik 2026-05-23) — gives the SW operator a one-click
  // jump back to the customer-facing quote-view (which has the live SW state
  // overlay, the original submission audit panel, all the design info). Saves
  // them looking up the OF# in our system every time they need full context.
  if (extOrderId) {
    lines.push(`Live Quote: https://teamnwca.com/quote/${extOrderId}`);
  }

  // Each line becomes one row in ShopWorks's Notes On Order tab.
  return lines;
}

// (buildAccountingNote removed 2026-05-22 — M1 reverted. Tax block now
// lives inline in buildOrderNote above, where CSR/AR/Production all look.)

// Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
// Production tab (Erik 2026-05-20).
function buildProductionNote({ rows, breakdown, methodNotesBlock }) {
  const lines = [];
  const block = String(methodNotesBlock || '').trim();
  if (block) {
    // The method block is itself a "·"-separated metadata string like
    //   "DTG · Left Chest + Full Back · Tier 1-23 (LTM) · 1 line · 17 combined pieces · Ship: Customer Pickup"
    // Split on " · " so production sees each fact as its own note row.
    for (const piece of block.split(' · ').map(s => s.trim()).filter(Boolean)) {
      lines.push(piece);
    }
  }
  // Garment breakdown: one row per (style, color) listing all sizes
  (rows || []).forEach(r => {
    if (!r || !r.style) return;
    const sizes = r.sizes || {};
    const pairs = Object.keys(sizes)
      .filter(k => Number(sizes[k]) > 0)
      .map(k => `${k}×${Number(sizes[k])}`);
    if (pairs.length === 0) return;
    const totalQty = pairs.reduce((s, p) => s + Number(p.split('×')[1] || 0), 0);
    const colorPart = r.colorName ? ` ${r.colorName}` : '';
    lines.push(`${r.style}${colorPart}: ${pairs.join(', ')} (${totalQty} pcs)`);
  });
  return lines;
}

// NOTE: buildShippingNote() was removed (2026-05-01). All shipping data is
// already populated in MO's structured fields:
//   - ShippingAddresses[]: ShipAddress01/02, ShipCity, ShipState, ShipZip,
//     ShipCompany, ShipMethod, ShipCountry
//   - Order-level: date_OrderRequestedToShip, date_OrderDropDead
// Duplicating in a note created exactly the redundancy Erik flagged.

// Notes To Purchasing — line-by-line list for the sourcing team to pull
// from SanMar. One line per (style, color, size) at the qty the rep
// priced. Prices are intentionally OMITTED here (Erik 2026-05-20) — the
// weighted-average per-row price shown vs. the authoritative per-size
// price in LinesOE confused purchasing. The LinesOE block carries the
// true per-size prices; this note is for what to BUY, not what to charge.
// Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
// Purchasing tab. ONE row per (style, color, size) so sourcing can scan/check
// off each line as they pull from SanMar (Erik 2026-05-20).
function buildPurchasingNote({ rows }) {
  const lines = [];
  (rows || []).forEach(r => {
    if (!r || !r.style) return;
    const sizes = r.sizes || {};
    Object.keys(sizes).forEach(sz => {
      const q = Number(sizes[sz]) || 0;
      if (!q) return;
      const colorPart = r.colorName ? ` - ${r.colorName}` : '';
      lines.push(`${r.style}${colorPart} - ${sz} × ${q}`);
    });
  });
  return lines;
}

function buildArtNote({ info, files }) {
  const parts = [];
  if (info.artNotes) parts.push(info.artNotes);
  if (Array.isArray(files) && files.length) {
    parts.push(files.map(f => {
      const placements = (f.placements || []).join(', ');
      const designNo = f.designNo ? ` (#${f.designNo})` : '';
      const colors = f.colors ? ` — Colors: ${f.colors}` : '';
      return `${f.name || 'file'}${designNo}: ${placements}${colors}`;
    }).join('\n'));
  }
  return parts.join('\n\n');
}

// Generate Order Form order ID — OF-NNNN (globally sequential, zero-padded to 4 digits).
// Reuses the proxy's race-safe counter endpoint that Embroidery uses (same as EMB-2026-N).
// Response shape: { prefix: "OF", year: 2026, sequence: 42 } → we return "OF-0042".
// Falls back to OF-<timestamp> if the counter endpoint is unreachable so a push never 500s.
// NOTE: The endpoint is year-scoped (resets Jan 1). At year-rollover the sequence restarts
// at 1 — if OF-0001 from the prior year is still in quote_sessions, the idempotency check
// on Status=Processed will catch any accidental re-use. Revisit this if we actually hit it.
async function generateOrderFormDraftId() {
  try {
    const r = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/OF`, { headers: withProxySecret() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const n = Number(j && j.sequence);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Bad sequence response: ' + JSON.stringify(j));
    return `OF-${String(n).padStart(4, '0')}`;
  } catch (err) {
    console.warn('[Order Form] quote-sequence endpoint failed, falling back to timestamp:', err.message);
    return `OF-${Date.now()}`;
  }
}

// (The /api/order-form-drafts save + customer-approve routes were removed 2026-07-11
//  along with the Order Form UI — see git history. /api/submit-order-form below is
//  RETAINED because the DTG quote builder pushes through it.)

// Sales-rep slug → full name. Clients of /api/submit-order-form (today the
// DTG builder; originally the retired Order Form) send a lowercase login
// slug ("taneisha") as the value because that's the legacy convention. ShopWorks's CustomerServiceRep field displays
// whatever string we send verbatim, so without translation the rep shows
// up as "taneisha" instead of "Taneisha Clark". Mapping is kept here
// (server-side) instead of changing the dropdown value because saved
// drafts in the Caspio quote_sessions table already use slugs — flipping
// the dropdown values would orphan those drafts.
//
// Note: 'ruth' slug → 'Ruthie Nhoung' to match ShopWorks's Employee record
// (ID 24). The form's dropdown LABEL also says "Ruthie Nhoung" but the
// internal slug stays 'ruth' for back-compat with saved drafts.
const SALES_REP_FULL_NAMES = {
  nika: 'Nika Lao',
  taneisha: 'Taneisha Clark',
  erik: 'Erik Mickelson',
  ruth: 'Ruthie Nhoung',
  jim: 'Jim Mickelson',
};

// Sales-rep slug → ShopWorks Employee ID for id_EmpCreatedBy on the
// order. Per Erik's screenshot of ShopWorks Employees (2026-05-02):
//   Jim Mickelson      = 1
//   Erik Mickelson     = 2
//   Ruthie Nhoung      = 24
//   Nika Lao           = 169
//   Taneisha Clark     = 281
// Unknown rep falls back to 2 (Erik) so orders never land on Employee 0.
const SALES_REP_EMP_IDS = {
  jim: 1,
  erik: 2,
  ruth: 24,
  nika: 169,
  taneisha: 281,
};

// POST /api/submit-order-form — Submit an order-form to ShopWorks.
// Accepts the frontend state verbatim + optional draftId for share-link flow.
app.post('/api/submit-order-form', async (req, res) => {
  try {
    const {
      info = {},
      rows = [],
      ship = {},
      orderNotes = '',
      files = [],
      draftId,                 // present when submitted from a shared customer link
      decoConfig = {},         // form-wide method config from the order form
      breakdown = null,        // computed pricing breakdown { byRow: { rowId: {unitPriceBySize, ...} }, subtotal, ... }
      methodNotesBlock = '',   // method-specific context (frontend-built)
      printLocations = '',     // human-readable print location label (e.g. "Left Chest + Full Back")
      designNumbers = [],      // array of design # strings to look up in ShopWorks
      addOns = [],             // Phase 2a fee/service add-ons → push as ShopWorks LinesOE entries
      submissionId            // optional client-generated UUID for idempotent retries (audit fix H5)
    } = req.body || {};

    // Normalize any date to YYYY-MM-DD before it flows into the ManageOrders
    // payload (orderDate / requestedShipDate). The order-form date pickers emit
    // YYYY-MM-DD already, but a malformed or MM/DD/YYYY value from any other
    // caller would otherwise pass through raw and the downstream MO date
    // formatter (which splits on '-') renders it "undefined/undefined/<date>"
    // in ShopWorks. Belt-and-suspenders so a bad date can never land in SW.
    const toISODate = (d) => {
      if (!d) return '';
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);              // already YYYY-MM-DD
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);                // MM/DD/YYYY → YYYY-MM-DD
      if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      return s; // unknown shape — pass through (better than swallowing)
    };

    // Idempotency check (audit fix H5): if the client retried with the same
    // submissionId within the TTL window, return the cached response instead
    // of allocating a new OF-NNNN + re-pushing. Protects against double-submit
    // on network hiccups despite the frontend's `submitting` guard.
    const idemId = submissionId || req.headers['x-submission-id'] || null;
    if (idemId) {
      const cached = getCachedSubmitResponse(idemId);
      if (cached) {
        console.log('[Order Form Submit] ↻ idempotent retry for submissionId', idemId, '→ returning cached response');
        return res.status(cached.statusCode || 200).json({ ...cached.body, idempotentReplay: true });
      }
    }

    if (!info.email && !info.company) {
      return res.status(400).json({ success: false, error: 'Missing contact info (email or company required)' });
    }

    // Empty-submit guard — at least one row must have a style (or manualMode) AND qty > 0.
    const hasUsableRow = (rows || []).some(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      const hasStyle = !!(r.style && String(r.style).trim());
      const hasManual = !!r.manualMode && Number(r.manualCost) > 0;
      return hasQty && (hasStyle || hasManual);
    });
    if (!hasUsableRow) {
      return res.status(400).json({ success: false, error: 'No line items with style and quantity' });
    }

    const isDryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

    // Every Order Form submission (staff-direct OR customer-via-share-link) uses the same
    // globally-sequential OF-NNNN format. For shared-link submits we reuse the draft's existing ID;
    // for direct submits we allocate a fresh one now (skipped in dry-run so sequence numbers aren't burned).
    let extOrderId = draftId || (isDryRun ? 'OF-DRYRUN' : null);
    let draftPkId = null;

    if (draftId) {
      // Share-link path: look up PK_ID + idempotency check on Draft→Processed.
      // Must use PK_ID path for PUT later (Caspio ?filter= PUT silently no-ops).
      try {
        const safeId = String(draftId).replace(/[^A-Z0-9\-]/gi, '');
        const existing = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeId}'`);
        if (Array.isArray(existing) && existing[0]) {
          draftPkId = existing[0].PK_ID || null;
          if (existing[0].Status === 'Processed') {
            return res.json({ success: true, mode: 'already-processed', extOrderId, message: 'Already pushed' });
          }
        }
      } catch (e) {
        console.warn('[Order Form Submit] Idempotency check skipped:', e.message);
      }
    } else if (!isDryRun) {
      // Direct-staff path: allocate a fresh OF-NNNN and create a Draft quote_sessions row upfront
      // (Status flips to Processed after the push result is known, in the PK_ID PUT block below).
      // Skipped in dry-run so we don't burn sequence numbers or pollute quote_sessions during debugging.
      extOrderId = await generateOrderFormDraftId();
      try {
        const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
        const sessionData = {
          QuoteID: extOrderId,
          SessionID: `orderform_${Date.now()}`,
          Status: 'Draft', // flipped to Processed in the Status PUT block after the push result is known
          CustomerName: [info.buyerFirst, info.buyerLast].filter(Boolean).join(' '),
          CompanyName: info.company || '',
          CustomerEmail: info.email || '',
          Phone: info.phone || '',
          // Pull dollar fields from breakdown (computed by frontend pricing modules).
          // NOTE: breakdown.grandTotal is pre-tax ONLY for the React Order Form
          // (pricing/shared.js sets grandTotal = subtotal). The DTG flagship sends a
          // tax+shipping-INCLUSIVE grandTotal here (dtg-inline-form submitToShopWorks),
          // so this OF-NNNN audit row's TotalAmount is NOT a reliable pre-tax figure for
          // DTG — the canonical customer record is the separate DTG-NNN quote_sessions row
          // (dtg-quote-page.js, TotalAmount pre-tax + a SHIP item + a real TaxAmount). This
          // OF row writes no TaxAmount, so /invoice's grand = TotalAmount + 0 still displays
          // the right (tax-incl) number. Tax is left to OnSite (manual-apply pattern).
          TotalQuantity:   Number(breakdown?.totalQty) || 0,
          SubtotalAmount:  Number(breakdown?.subtotal) || 0,
          // [2026-06-09] Caspio Quote_Sessions.LTMFeeTotal is INTEGER — a fractional value (DTG's
          // amortized LTM, e.g. 49.92) 400s this OF-NNNN tracking-session create (caught + logged,
          // so the SW push still succeeds, but the tracking row was silently dropped on DTG LTM
          // pushes). Round to the whole-dollar nominal fee — informational column, matches the
          // dtg-quote-page.js save fix. (No-op when ltmTotal is already integer, e.g. React OF.)
          LTMFeeTotal:     Math.round(Number(breakdown?.ltmTotal) || 0),
          TotalAmount:     Number(breakdown?.grandTotal || breakdown?.subtotal) || 0,
          ExpiresAt: formattedExpiresAt,
          Notes: JSON.stringify({ info, rows, ship, orderNotes, files, decoConfig, staffFilled: [], submitFlow: 'staff-direct' })
        };
        const createResp = await fetch(`${CASPIO_PROXY_BASE}/api/quote_sessions`, {
          method: 'POST',
          headers: withProxySecret({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(sessionData)
        });
        if (createResp.ok) {
          // NOTE: proxy's POST response has a bogus `PK_ID: "records"` (literal string from Location
          // header tail — it's the collection endpoint URL). Always query back to get the real PK.
          // Small delay helps Caspio be ready for the filter query on the just-inserted row.
          await new Promise(r => setTimeout(r, 500));
          try {
            const existing = await makeApiRequest(`/quote_sessions?filter=QuoteID='${extOrderId}'`);
            if (Array.isArray(existing) && existing[0] && typeof existing[0].PK_ID === 'number') {
              draftPkId = existing[0].PK_ID;
            }
          } catch (_) { /* non-fatal */ }
        } else {
          console.warn('[Order Form Submit] Could not pre-save direct submit record:', createResp.status);
        }
      } catch (e) {
        console.warn('[Order Form Submit] Direct-submit pre-save failed (non-fatal):', e.message);
      }
    }

    // --- Build lineItems (one row × qty-bearing size = one line item) ---
    // Iterate every size key on the row (standard XS-4XL plus any non-standard
    // entries: OSFA, YS-YXL, LT-4XLT, 5XL-7XL). We send the BASE part number
    // + plain size string; ShopWorks's Size Translation Table on ingest both
    // (a) maps the size to the correct Size01-06 column AND (b) appends the
    // configured per-size modifier (`_XS`, `_2X`, `_3XL`, …) to the PN.
    // Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
    const lineItems = [];
    const skippedLines = [];   // sizes with qty>0 the engine couldn't price — returned to caller
    // B1 ($0 line guard, Erik 2026-05-22): manual-mode rows with rep-typed
    // $0 used to push through to MO at price=0, landing in ShopWorks as a
    // $0 line + $0 subtotal (e.g. WO 141918 / OF-0050). Block at submit
    // time instead. Fee/service add-ons are built in a separate loop below
    // and can legitimately be $0 (e.g. included service) — those are
    // unaffected.
    const zeroPriceLines = [];
    rows.forEach(r => {
      if (!r || (!r.style && !r.desc && !r.sizes)) return;
      const partBase = (r.style || 'MISC').trim();
      const desc = r.desc || r.style || 'Custom Apparel';
      const color = r.colorName || r.color || '';        // display name — proxy stores as PartColor
      const catalogColor = r.catalogColor || r.color || ''; // CATALOG_COLOR for inventory mapping
      const fallbackPrice = Number(r.price || 0) || 0;
      // Per-row pricing breakdown carries auto-computed unit prices per size.
      // When the rep clicked the price cell to override (priceOverride=true),
      // we honor the manually-typed `r.price` instead. Otherwise prefer the
      // computed unit price for this specific size.
      const rowBreakdown = breakdown?.byRow?.[r.id];
      const isAutoPriced = !r.priceOverride && rowBreakdown && !rowBreakdown.error && breakdown?.supported;
      const sizes = r.sizes || {};
      Object.keys(sizes).forEach(sz => {
        const qty = parseInt(sizes[sz] || 0, 10);
        if (!qty) return;
        let price = fallbackPrice;
        let priceFromBreakdown = false;
        if (isAutoPriced) {
          const computedUnit = rowBreakdown?.unitPriceBySize?.[sz];
          if (Number.isFinite(Number(computedUnit)) && Number(computedUnit) > 0) {
            price = Number(computedUnit);
            priceFromBreakdown = true;
          }
        }
        // Skip auto-priced lines where the engine has no price for this size
        // (e.g. rep typed XS=2 for PC61, which doesn't carry XS). This stops
        // ShopWorks getting a $0 ghost line. The form's grayed cell + tooltip
        // already warned the rep; the rep can force the line by clicking the
        // price cell to switch to manual override. Manual-price rows pass
        // through at whatever the rep typed (even $0).
        if (isAutoPriced && !priceFromBreakdown) {
          skippedLines.push({
            style: partBase,
            color: color,
            size: sz,
            quantity: qty,
            reason: 'No price available for this size in the pricing engine',
          });
          console.warn('[Order Form Submit] Skipping unpriced line:', partBase, sz, 'qty=' + qty);
          return;
        }
        // B1: hard-block garment lines that ended up at $0 after price
        // resolution (manual override with empty/0 price, or unsupported
        // pricing method with no fallback). Pushing $0 produces invisible
        // garbage in ShopWorks — rep should fix the row, not paper over it.
        if (!(price > 0)) {
          zeroPriceLines.push({
            style: partBase,
            color: color,
            size: sz,
            quantity: qty,
          });
          return;
        }
        // Send the BASE part number + plain size. ShopWorks's Size Translation
        // Table appends the per-size modifier (`_XS`, `_2X`, `_3XL`, etc.) on
        // ingest. Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
        // The frontend breakdown row + inventory wrapper still use
        // orderFormSizeSuffix() — display + SanMar inventory needs the
        // suffixed PN. Only this MO push uses the base PN.
        lineItems.push({
          partNumber: partBase,
          description: desc,
          color: color,
          catalogColor: catalogColor,
          size: sz,
          quantity: qty,
          price: price,
          // WorkOrderNotes = print location(s) for this line (Erik 2026-05-20).
          // Surfaces in ShopWorks's line-level work-order printout so the
          // production-floor operator sees the print location next to the
          // garment SKU/size/qty without flipping to Notes To Production.
          // Frontend sends printLocations as the human-readable label
          // ("Left Chest", "Full Back", "Left Chest + Full Back"). Empty
          // string when not set — proxy strips empty workOrderNotes so no
          // blank field lands in ShopWorks.
          workOrderNotes: printLocations || '',
          // Internal — used below to link this line to the matching design's
          // ExtDesignID after the designs[] array is built. Removed before
          // the payload is sent to the proxy.
          _method: r.deco || decoConfig?.method || ''
        });
      });
    });

    // B1 reject: any garment line that collapsed to $0 above blocks the
    // whole submit. Rep sees the offending row(s) and fixes the price.
    if (zeroPriceLines.length > 0) {
      const summary = zeroPriceLines
        .map(z => `${z.style}${z.color ? ` (${z.color})` : ''} ${z.size} × ${z.quantity}`)
        .join('; ');
      const plural = zeroPriceLines.length === 1;
      console.warn('[Order Form Submit] Rejecting submit — $0 line(s):', summary);
      return res.status(400).json({
        success: false,
        error: '$0 line item',
        details: `${plural ? 'Line' : 'Lines'} ${summary} ${plural ? 'has' : 'have'} no price. Set a price on the row before submitting.`,
        zeroPriceLines,
      });
    }

    // --- Add-on fees (Phase 2a 2026-05-03) ---
    // Server-side companion to window.OrderFormServiceCodes (frontend client).
    // Resolves SellPrice from the in-memory Service_Codes cache and appends
    // a LinesOE entry per add-on. Phase 2a supports FIXED + FLAT only;
    // TIERED / CALCULATED / PASSTHROUGH / HOURLY methods are skipped with a
    // console warn so the rep sees them missing on the next submit (UI in
    // Phase 2b adds proper handling). Service codes that aren't in the
    // KNOWN_FEE_PNS proxy whitelist may still flow but ShopWorks may reject
    // them — server-side validation against KNOWN_FEE_PNS lives at the
    // proxy layer (caspio-pricing-proxy v608+).
    if (Array.isArray(addOns) && addOns.length > 0) {
      const serviceCodesUrl = `${CASPIO_PROXY_BASE}/api/service-codes`;
      let serviceCodes = [];
      try {
        const r = await fetch(serviceCodesUrl);
        if (r.ok) {
          const j = await r.json();
          serviceCodes = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        }
      } catch (err) {
        console.error('[Order Form Submit] Service_Codes fetch failed:', err.message);
      }
      const findCode = (code) => serviceCodes.find(s => s.ServiceCode === code) || null;
      const orderSubtotal = Number(breakdown?.subtotal) || 0;

      for (const a of addOns) {
        if (!a || !a.code) continue;
        const sc = findCode(a.code);
        if (!sc) {
          console.warn('[Order Form Submit] Skipping add-on — code not in Service_Codes:', a.code);
          continue;
        }
        const method = String(sc.PricingMethod || '').toUpperCase();
        const baseSell = Number(sc.SellPrice) || 0;
        const qty = Number(a.qty) || 0;
        if (qty <= 0) continue;

        let unitPrice = null;
        switch (method) {
          case 'FIXED':
          case 'FLAT':
            unitPrice = baseSell;
            break;
          case 'CALCULATED':
            // RUSH = subtotal × percent (default 25). Sent as a single
            // line with qty=1 and price=full surcharge amount.
            if (a.code === 'RUSH' && orderSubtotal > 0) {
              const pct = Number(a?.params?.percent ?? 25) / 100;
              unitPrice = orderSubtotal * pct;
            }
            break;
          case 'PASSTHROUGH':
            // Freight / Pallet / Discount / CDP — rep enters the dollar amount.
            const passAmount = Number(a?.params?.amount);
            if (Number.isFinite(passAmount)) unitPrice = passAmount;
            break;
          case 'HOURLY':
            // Art — rate × hours. SellPrice is the hourly rate.
            const hrs = Number(a?.params?.hours);
            if (Number.isFinite(hrs) && hrs > 0) unitPrice = baseSell * hrs;
            break;
          case 'TIERED':
            // Phase 2c will resolve via /api/al-pricing or stitch surcharge
            // bundles. Until then, allow the rep to override via params.unitPrice
            // (escape hatch) so this isn't a hard blocker.
            const overrideUnit = Number(a?.params?.unitPrice);
            if (Number.isFinite(overrideUnit) && overrideUnit > 0) unitPrice = overrideUnit;
            else console.warn('[Order Form Submit] Skipping TIERED add-on — Phase 2c will wire price lookup:', a.code);
            break;
          default:
            console.warn('[Order Form Submit] Unknown PricingMethod for', a.code, '→', method);
        }

        if (unitPrice == null) continue;  // unresolved — skip rather than push $0

        // Phase 7 — for additional-logo codes (AL, AL-CAP, DECG-FB, CTR-*),
        // build a DisplayAsDescription that includes the position + stitches.
        // Production sees "AL · Right Sleeve · 5,000 stitches" inline on the
        // work order's LinesOE row, so they know exactly where each logo goes
        // without cross-referencing the design's Locations[] array.
        const positionCodes = new Set(['AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap']);
        let displayDescription = '';
        if (positionCodes.has(a.code)) {
          const pos = a?.params?.position || (a.code === 'DECG-FB' ? 'Full Back' : '');
          const stitches = Number(a?.params?.stitchCount) || 0;
          const parts = [pos, stitches > 0 ? `${stitches.toLocaleString()} stitches` : ''].filter(Boolean);
          displayDescription = parts.join(' · ');
        }

        lineItems.push({
          partNumber: a.code,
          description: sc.DisplayName || a.code,
          displayDescription,  // empty string for non-position codes (proxy passes through verbatim)
          color: '',           // services don't carry color
          catalogColor: '',
          size: '',            // services don't carry size
          quantity: qty,
          price: Number(unitPrice.toFixed(4)),
        });
      }
    }

    // --- Designs: one per decoration method present in rows, artwork URLs attached ---
    // DesignType IDs per Erik's "design type translation.csv" (2026-05-02).
    // PRIOR VALUES WERE WRONG — only DTG was correct. All other methods
    // were sending design type 3 ("standard"), which doesn't exist in
    // ShopWorks's design taxonomy. Authoritative IDs from CSV:
    //   1 = Screenprint, 2 = Embroidery, 4 = Advertising Specialty (Stickers),
    //   5 = Emblem, 8 = Transfer (DTF), 45 = DTG
    const DESIGN_TYPE_ID = { embroidery: 2, screenprint: 1, dtg: 45, dtf: 8, sticker: 4, emblem: 5 };
    const DESIGN_LABEL   = { embroidery: 'Embroidery', screenprint: 'Screen Print', dtg: 'DTG', dtf: 'DTF Transfer', sticker: 'Stickers', emblem: 'Embroidered Emblems' };
    // OrderType IDs verified against the live ShopWorks Order Types list
    // (Erik's screenshots, 2026-05-02). The earlier CSV had every ID wrong
    // except none — all six methods were sending to the wrong production
    // queue. Caught after OF-0027 sent id_OrderType=5 and ShopWorks
    // displayed "Digital Printing" instead of the expected "Embroidery".
    //
    //   21 = Custom Embroidery       (account 4050 Custom Embroidered Sales)
    //   13 = Screen Print Subcontract (account 4200 Subcontract Screenprinted Sales)
    //   5  = Digital Printing         (account 4001 Digital Printing Sales)
    //   18 = Transfers                (account 4005 Transfer Sales)
    //   41 = Laser/Ad Specialties     (account 4400 Ad Specialty Sales)
    //   7  = Emblem                   (account 4002 Emblem Sales)
    //   6  = Online Store fallback    (account 4003) — only used when no method selected
    //
    // Per Erik (2026-05-02): order types CANNOT be mixed in ShopWorks, so
    // an order has exactly one decoration method. We use methodsUsed[0]
    // and let the form's UI guard against multi-method submissions.
    const ORDER_TYPE_ID = { embroidery: 21, screenprint: 13, dtg: 5, dtf: 18, sticker: 41, emblem: 7 };
    const ORDER_TYPE_DEFAULT = 6;  // Online Store — fallback when no method picked
    const methodsUsed = [...new Set(rows.map(r => r && r.deco).filter(Boolean))];

    // Audit fix M3 (2026-05-21): ShopWorks doesn't allow mixed-method orders
    // — each order routes to a single production queue (id_OrderType). If the
    // rep accidentally mixes DTG + EMB rows, the push would silently land on
    // whichever method wins the methodsUsed[0] race, and the other method's
    // lines arrive at the wrong production queue. Block at submit time with
    // a clear message; rep should split into separate orders.
    if (methodsUsed.length > 1) {
      console.warn('[Order Form Submit] Mixed-method blocked:', methodsUsed.join(', '), 'for', extOrderId);
      return res.status(400).json({
        success: false,
        error: 'Mixed-method orders not supported',
        details: `This order has rows with ${methodsUsed.length} different decoration methods (${methodsUsed.join(', ')}). ShopWorks orders can only have ONE decoration method. Please split this into separate orders — one per method.`,
        methodsUsed,
      });
    }

    // C2 (Erik 2026-05-22): the prior `designTypeId: DESIGN_TYPE_ID[method] || 3`
    // silently fell to design type 3 ("standard" — doesn't exist in ShopWorks's
    // design taxonomy) when method was missing or unrecognized. Result: orders
    // landed in SW with a bogus type and the quote-view rendered "Type: Unknown"
    // on the Designs panel (e.g. OF-0050). Reject at submit time so reps fix
    // the row's method before the order ships off to MO.
    const primaryMethod = methodsUsed[0] || decoConfig?.method || '';
    if (primaryMethod && !DESIGN_TYPE_ID[primaryMethod]) {
      console.warn('[Order Form Submit] Unmapped method blocked:', primaryMethod, 'for', extOrderId);
      return res.status(400).json({
        success: false,
        error: 'Unsupported decoration method',
        details: `Method "${primaryMethod}" isn't recognized. Pick one of: ${Object.keys(DESIGN_TYPE_ID).join(', ')}.`,
        method: primaryMethod,
      });
    }

    // Design # → id_Design resolution.
    //
    // CASPIO TABLE INSIGHT (Erik confirmed 2026-05-02): the
    // `Design_Lookup_2026` table's `Design_Number` column IS ShopWorks's
    // `id_Design` value — they're the same integer under different column
    // names (the table's `ID_Unique` column is empty). So the autocomplete's
    // pick of design 9449 means we pass `id_Design: 9449` to ShopWorks
    // directly, no second lookup needed.
    //
    // The rep can also type a free-form design# from memory; we accept any
    // integer between 1 and 999999. Non-numeric input falls through to
    // Designs:[] (Phase A behavior — no orphan creation).
    const linkedIdDesigns = (Array.isArray(designNumbers) ? designNumbers : [])
      .map(n => Number(String(n || '').trim()))
      .filter(n => Number.isInteger(n) && n > 0 && n < 1000000);

    // Designs[]: emit when EITHER (a) at least one design# resolved to a real
    // ShopWorks id_Design (existing-design path) OR (b) the rep uploaded at
    // least one artwork file (new-design path — ShopWorks creates a new
    // design record from the metadata + ImageURL). Otherwise return [] so
    // ShopWorks doesn't create an orphan design from DesignName alone.
    //
    // Erik's evolved preference (2026-05-02 → 2026-05-20):
    //   2026-05-02: "if there isn't a design we shouldn't create a new one,
    //                just leave it blank and the sales rep can select the
    //                design inside shopworks"
    //   2026-05-20: "if rep uploads new artwork, create the design with full
    //                metadata + image so the art team doesn't have to chase
    //                emailed attachments separately"
    //
    // The frontend gates the new-design path so it only fires when (a) at
    // least one file IS uploaded AND (b) the rep typed a Design Name AND
    // (c) NO existing Design # was picked (conflict prevention). See
    // memory/MO_NEW_DESIGN_FLOW.md (to be added).
    const hostedAnyFiles = (files || []).some(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))));
    const designs = (linkedIdDesigns.length === 0 && !hostedAnyFiles) ? [] : methodsUsed.map((method) => {
      const hostedFiles = files.filter(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))));
      // Primary location entries (from uploaded artwork files OR placeholder).
      const primaryLocations = (hostedFiles.length ? hostedFiles : [{ name: 'placeholder' }]).map((f, i) => ({
        location: (f.placements && f.placements[0]) || 'Left Chest',
        colors: f.colors || '',
        code: f.designNo || `${method.slice(0,3).toUpperCase()}-${i + 1}`,
        imageUrl: f.hostedUrl || f.preview || '',
        customField01: f.hostedUrl || f.preview || '',
        notes: f.colors ? `Colors: ${f.colors}` : ''
      }));

      // Phase 7 — append additional-logo locations from add-ons.
      // For each AL/AL-CAP/DECG-FB/CTR-* addon with a position param, push
      // a Locations[] entry so ShopWorks's production view shows all logo
      // positions on this design (not just the primary). Sequential codes
      // (EMB-2, EMB-3, …) follow the primary's EMB-1 numbering.
      const positionCodes = new Set(['AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap']);
      const addonLocations = [];
      let nextLocCode = primaryLocations.length + 1;
      const methodPrefix = method.slice(0, 3).toUpperCase();
      (Array.isArray(addOns) ? addOns : []).forEach(a => {
        if (!a || !positionCodes.has(a.code)) return;
        const pos = a?.params?.position || (a.code === 'DECG-FB' ? 'Full Back' : 'Additional');
        const stitches = Number(a?.params?.stitchCount) || 0;
        addonLocations.push({
          location: pos,
          colors: '',
          code: `${methodPrefix}-${nextLocCode++}`,
          imageUrl: '',
          customField01: '',
          notes: stitches > 0 ? `${stitches.toLocaleString()} stitches · ${a.code}` : a.code,
        });
      });

      const base = {
        name: `${info.company || 'Order'} — ${DESIGN_LABEL[method] || method}`,
        externalId: `${extOrderId}-${method.toUpperCase()}`,
        // ForProductColor (proxy maps `productColor` → `ForProductColor`):
        // Use CATALOG_COLOR codes (matches the LinesOE.Color rule from proxy v606)
        // and include rows whose deco isn't explicitly set — those default to
        // the form's primary method (embroidery) and were silently dropped from
        // this aggregation before, which left ShopWorks with a Design that only
        // referenced 3 of 11 colors on multi-row orders. See OF-0025.
        productColor: [...new Set(
          rows
            .filter(r => !r.deco || r.deco === method)
            .map(r => r.catalogColor || r.colorName || r.color)
            .filter(Boolean)
        )].join(', '),
        // C2 (2026-05-22): no `|| 3` fallback — methodsUsed has been validated
        // against DESIGN_TYPE_ID at the guard above, so this lookup always
        // resolves to a real ShopWorks design type ID.
        designTypeId: DESIGN_TYPE_ID[method],
        locations: [...primaryLocations, ...addonLocations],
      };
      // Attach known id_Design references per CLAUDE.md MANAGEORDERS pattern.
      // For methods that primarily use this lookup (embroidery), pass the array
      // so the proxy can link rather than create a new generic design.
      // ALSO: when exactly one design# resolves, set base.idDesign (singular)
      // so the proxy's transformDesigns() actually reads it. The proxy only
      // looks at `idDesign`/`id_Design` on the design object — `linkedDesigns`
      // is currently a no-op until multi-design# support lands. Without this
      // singular alias, even a successful design# lookup silently dropped to
      // id_Design:0 in the ShopWorks payload (orphan).
      // DTG added 2026-05-20 — the new DTG Quote Builder has a customer-aware
      // Design # picker that hands back the existing ShopWorks id_Design.
      // Without DTG in this whitelist, the picked design was silently dropped
      // and ShopWorks created an orphan placeholder design on every DTG push.
      if (linkedIdDesigns.length && (method === 'embroidery' || method === 'screenprint' || method === 'dtf' || method === 'dtg')) {
        base.linkedDesigns = linkedIdDesigns.map(id => ({ id_Design: id }));
        if (linkedIdDesigns.length === 1) base.idDesign = linkedIdDesigns[0];
      }
      // NEW-DESIGN PATH (Erik 2026-05-20): when no existing design# was picked
      // but rep uploaded artwork + typed a Design Name, override the auto-
      // generated "${company} — ${method}" name with the rep's chosen name.
      // This makes the new design searchable in ShopWorks's art library by
      // a meaningful identifier (e.g. "Star Sportswear front logo 2026")
      // rather than a generic auto-name.
      if (!linkedIdDesigns.length && info.newDesignName && String(info.newDesignName).trim()) {
        base.name = String(info.newDesignName).trim();
      }
      return base;
    });

    // --- Attachments: only hosted URLs (not base64 previews) ---
    const attachments = files
      .filter(f => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))))
      .map(f => ({
        mediaUrl: f.hostedUrl || f.preview,
        mediaName: f.name || 'artwork',
        linkNote: (f.placements || []).join(', ')
      }));

    // --- Notes (4-way split, all targeting separate ShopWorks tabs) ---
    // Each block lands on a different ShopWorks screen for a different role.
    // Verified against the live order #141671 notes UI (Erik's screenshots).
    //
    //   Notes On Order        → CSR/AR header: order audit, CRM Customer ID, tax account
    //   Notes To Production   → production team: stitch/location + garment breakdown
    //   Notes To Purchasing   → sourcing team: line-by-line PN + color + size + price
    //   Notes To Art          → art team (only when rep added art notes or files)
    //
    // ShopWorks's API only accepts these 9 note types: Notes On Order,
    // Notes To Art, Notes To Purchasing, Notes To Subcontract, Notes To
    // Production, Notes To Receiving, Notes To Shipping, Notes To Accounting,
    // Notes On Customer (new customers only). "Notes On Packing List" is NOT
    // a valid type — packing-slip output is a ShopWorks template concern,
    // not a note type. Pushing it caused the proxy's note validator to
    // reject the entire array.
    //
    // NOT sent (intentional — already in MO structured fields):
    //   - Shipping (ShippingAddresses[], date_OrderRequestedToShip, date_OrderDropDead)
    //   - Contact info (Contact*, CustomerPurchaseOrder, CustomerServiceRep)
    // Notes builders now return ARRAYS of strings — push each as a separate
    // notesBlocks entry so ShopWorks displays them as distinct rows in the
    // corresponding Notes tab. Erik (2026-05-20): "the notes need to come in
    // as separate line items in the notes section". One note row per fact
    // beats one row crammed with multi-line text.
    const notesBlocks = [];
    const pushArray = (type, arr) => {
      for (const note of (Array.isArray(arr) ? arr : [arr])) {
        if (note && String(note).trim()) {
          notesBlocks.push({ type, note: String(note).trim() });
        }
      }
    };

    // Pre-warm the sales_tax_accounts_2026 cache so buildOrderNote can do
    // server-side rate→account resolution if the frontend dropped ship.taxAccount.
    // Fire-and-forget — note builder handles cache-miss gracefully (falls back
    // to hardcodes for pickup/OOS, NEEDS REVIEW otherwise).
    await ensureTaxAccountsCache().catch(() => {});

    // Server-side authoritative resolution: if frontend didn't capture the
    // GL account (DOR API hiccup, frontend bug), look it up from Caspio by
    // rate so we never push generic '2200' parent account by mistake.
    if (!ship.taxAccount && Number(ship.taxRate) > 0) {
      const lookup = findTaxAccountByRate(Number(ship.taxRate));
      if (lookup) {
        ship.taxAccount = lookup.account;
        ship.taxAccountName = lookup.accountName;
        console.log(`[submit] tax account auto-resolved by rate ${ship.taxRate} → ${ship.taxAccount}`);
      }
    }

    // Notes On Order — primary tab CSR/AR/Production all read. Includes
    // print locations + full tax block (subtotal/rate/amount/total/account/apply).
    // M1 (2026-05-21) briefly split tax into Notes To Accounting; reverted
    // 2026-05-22 because most users scan Notes On Order first.
    pushArray('Notes On Order',     buildOrderNote({ info, breakdown, draftId, ship, orderNotes, extOrderId, printLocations }));
    pushArray('Notes To Production', buildProductionNote({ rows, breakdown, methodNotesBlock }));
    pushArray('Notes To Purchasing', buildPurchasingNote({ rows }));

    if (info.artNotes || (Array.isArray(files) && files.length)) {
      // Art note remains a single multi-line entry for now (file links + colors
      // belong together for the art team's review). Refactor to array if Erik
      // asks later.
      const artNote = buildArtNote({ info, files });
      if (artNote) notesBlocks.push({ type: 'Notes To Art', note: artNote });
    }

    // --- Link line items to their design via ExtDesignIDBlock --------
    // Without this, ShopWorks imports each line with the "Apply Designs"
    // toggle OFF — the rep then has to manually flip it on every line
    // before production can see the artwork. By setting ExtDesignIDBlock
    // = the design's ExtDesignID, the OnSite import auto-links the line
    // to the design and toggles Apply Designs ON. (Erik confirmed 2026-05-21
    // by inspecting WO 141899 line item PC90H_3XL.)
    //
    // designsByMethod maps "DTG"/"EMB"/etc. → "OF-0048-DTG" (the externalId
    // we sent in the Designs[] array). Lines whose row method has no design
    // (e.g., manual-only fee rows) leave extDesignIdBlock empty — same as
    // pre-fix behavior, no regression.
    const designsByMethod = new Map();
    (designs || []).forEach(d => {
      const m = (d?.externalId || '').match(/-([A-Z0-9]+)$/);
      if (m && m[1]) designsByMethod.set(m[1], d.externalId);
    });
    lineItems.forEach(line => {
      const lineMethod = (line._method || '').toUpperCase();
      if (lineMethod && designsByMethod.has(lineMethod)) {
        line.extDesignIdBlock = designsByMethod.get(lineMethod);
      }
      delete line._method;
    });

    // Build the order Description field — populates ShopWorks's
    // Order Information > Description (visible in order list views).
    // Format: "EMBROIDERY · Left Chest · 8,000 stitches" — gives ShopWorks
    // staff a method-at-a-glance summary without opening the order.
    const orderDescription = String(methodNotesBlock || '')
      .split('\n')[0]                    // first line of method block
      .trim()
      || (rows && rows.length ? `Order — ${rows.length} line${rows.length === 1 ? '' : 's'}` : '');

    // --- Canonical camelCase payload — same shape proxy's manageorders-push-client expects ---
    const manageOrdersPayload = {
      orderNumber: extOrderId,
      customerPurchaseOrder: info.po || extOrderId,
      // Order-level Description — ShopWorks shows this in the order header.
      description: orderDescription,
      customer: {
        company: info.company || '',
        // CRM Customer ID — proxy can use this as ExtCustomerID for repeat-
        // customer matching in ShopWorks (Forma Construction always lands
        // on the same customer record across multiple orders).
        companyId: info.companyId || '',
        firstName: info.buyerFirst || '',
        lastName: info.buyerLast || '',
        email: info.email || '',
        phone: info.phone || ''
      },
      lineItems,
      designs,
      attachments,
      // Shipping block. Two cases (Erik 2026-05-20, refined later same day):
      //
      // (1) Customer Pickup: send the block with NWCA Milton as the address,
      //     ShipAddress01 = "Customer Pickup" as a marker. Earlier we tried
      //     omitting the block entirely for pickup orders, but that left
      //     ShopWorks's order header with no Ship Method — production +
      //     AR reports lost track of these orders. The "Customer Pickup"
      //     marker in ShipAddress01 makes it unambiguous to anyone reading
      //     the order that this isn't a real ship-to. The city/state/zip
      //     are NWCA's actual location so the order has a valid address
      //     for filtering/reporting.
      //
      // (2) Shipping (UPS Ground / Priority Mail / Other): send the real
      //     ship-to address the rep typed in the ship-to block.
      shipping: (ship.method === 'pickup' || ship.method === 'willcall' || ship.method === 'Customer Pickup')
        ? {
          // Customer Pickup — ships to NWCA Milton location.
          // Uses NWCA_LOCATIONS.milton so the address lives in one place.
          // ShipAddress01 is overridden to "Customer Pickup" as a visible
          // marker on ShopWorks / packing slips.
          company: NWCA_LOCATIONS.milton.company,
          firstName: '',
          lastName: '',
          address1: 'Customer Pickup',
          address2: '',
          city: NWCA_LOCATIONS.milton.city,
          state: NWCA_LOCATIONS.milton.state,
          zip: NWCA_LOCATIONS.milton.zip,
          country: NWCA_LOCATIONS.milton.country,
          method: 'Customer Pickup'
        }
        : {
          company: info.company || '',
          firstName: info.buyerFirst || '',
          lastName: info.buyerLast || '',
          // NWCA shipping convention (from the OF ship-to block):
          //   line 1 = recipient name ("Wendy Mickelson")
          //   line 2 = street address ("14805 75th Street Ct East")
          // Bug history: address2 was previously hard-coded to '' so the
          // actual street never reached ShopWorks (WO 141899 landed with
          // only the recipient name in ShipAddress01). Erik 2026-05-21.
          address1: ship.address || info.address || '',
          address2: ship.address2 || info.address2 || '',
          city: ship.city || info.city || '',
          state: ship.state || info.state || '',
          zip: ship.zip || info.zip || '',
          country: 'USA',
          // ShipMethod: frontend now sends ShopWorks-canonical names directly
          // ('UPS Ground' / 'Priority Mail'). Translate legacy codes for
          // backward-compat; pass through anything else verbatim.
          method: (ship.method === 'ups' ? 'UPS Ground'
            : (ship.method === 'other' ? 'Other'
              : (ship.method || 'UPS Ground')))
        },
      billing: {
        company: info.company || '',
        address1: info.address || '',
        address2: '',
        city: info.city || '',
        state: info.state || '',
        zip: info.zip || '',
        country: 'USA'
      },
      notes: notesBlocks,
      // Rush flag (Erik 2026-05-23): was hardcoded false. info.isRush comes
      // from the explicit RUSH checkbox in the order form (audit fix L4
      // 2026-05-21). Used by SW to prioritize in the production queue.
      rushOrder: !!info.isRush,
      // Tax: ALWAYS send 0. (2026-05-20 — see memory/wa-sales-tax-rules.md)
      //
      // Background: the ShopWorks ManageOrders integration is configured with
      // hardcoded Tax Line Item = "Tax_10.1" and Tax Account = "2200.101".
      // Those defaults stamp ALL orders pulled by the integration regardless
      // of payload — there's no per-order override. Sending TaxTotal: $X
      // would auto-create a tax line with the right dollar amount but the
      // WRONG label and GL account for non-Milton destinations (e.g. a Seattle
      // 10.35% order would show as "City of Milton Sales Tax 10.1%" in
      // ShopWorks's books).
      //
      // Erik's chosen workflow: send TaxTotal: 0, no auto-tax-line gets
      // created, Erik manually applies the correct tax line in ShopWorks
      // using the structured Notes On Order block (see buildOrderNote above)
      // which carries the Caspio account number + rate + dollar amount the
      // rep saw at quote time. The customer-facing quote (in the form preview)
      // still shows the correct tax — only the ShopWorks push omits it.
      taxTotal: 0,
      // [2026-06-09] DTG Phase 2 — billed shipping. ship.fee carries the rep's charge
      // (0 for pickup — the frontend's effectiveShipFee() zeroes it). Was hardcoded 0
      // back when the DTG form never billed shipping (UPS cost treated as COGS). The
      // customer-facing tax/total still live in the quote-view + Notes On Order block;
      // OnSite sums line items + cur_Shipping for the order, tax applied manually.
      cur_Shipping: Number(ship?.fee) || 0,
      totals: {
        subtotal: 0, rushFee: 0, salesTax: 0, shipping: Number(ship?.fee) || 0, grandTotal: 0
      },
      payments: [],
      // Source/sales-rep fields — the proxy maps CustomerServiceRep → ShopWorks CSR.
      // SALES_REP_FULL_NAMES translates the form's dropdown slug
      // ("taneisha") to the canonical full name ("Taneisha Clark") that
      // ShopWorks displays. Falls back to whatever's in info.salesRep so
      // unknown values pass through (better than swallowing them).
      extSource: 'NWCA-OrderForm',
      salesRep: SALES_REP_FULL_NAMES[info.salesRep] || info.salesRep || '',
      // Payment terms — one of: "Prepaid" (default) | "Pay On Pickup"
      terms: info.terms || 'Prepaid',
      // Proxy expects camelCase names matching manageorders-push-client: orderDate, requestedShipDate, dropDeadDate
      // Dates (2026-05-20 — Erik split dueDate from dropDeadDate).
      //   orderDate          = today (rep can override via info.dateIn)
      //   requestedShipDate  = production due date — auto-calc from qty in
      //                         frontend (≤24 pcs → 5 BDs, >24 → 10 BDs) OR
      //                         rep-overridden value. Maps to ShopWorks's
      //                         "Req. Ship Date" field.
      //   dropDeadDate       = customer's hard deadline (event/photoshoot).
      //                         Optional — empty when customer has no event.
      //                         Maps to ShopWorks's "Drop Dead Date" field.
      //   Previously both fields shared info.dateDue, which incorrectly
      //   shoved "today" into ShopWorks's Drop Dead column on every order.
      orderDate: toISODate(info.dateIn) || new Date().toISOString().slice(0, 10),
      requestedShipDate: toISODate(info.dateDue || info.dateIn) || new Date().toISOString().slice(0, 10),
      dropDeadDate: toISODate(info.dropDeadDate),
      // Customer routing — when the rep picked a known company from
      // autocomplete, info.companyId carries the real ShopWorks id_Customer
      // (e.g. 1276 for Aaberg's Rentals). Falls back to 2791 (catch-all
      // "Online Order Form Customer") for brand-new typed names.
      idCustomer: Number(info.companyId) || 2791,
      // Employee Created By — maps the picked Sales Rep to their ShopWorks
      // Employee ID so the order header says "created by Taneisha" not
      // "created by Erik". Fallback 2 (Erik) for unknown reps.
      idEmpCreatedBy: SALES_REP_EMP_IDS[info.salesRep] || 2,
      // OrderType per the order's decoration method. Per Erik (2026-05-02)
      // ShopWorks doesn't allow mixed order types, so an order has one
      // method. We take methodsUsed[0]; if the form UI ever lets a
      // multi-method order through, the first method wins (better than
      // misrouting everything to a generic default).
      idOrderType: ORDER_TYPE_ID[methodsUsed[0]] || ORDER_TYPE_DEFAULT,
      // APISource MUST equal the single consolidated "Manage Orders" ShopWorks
      // integration's filter value ("ManageOrders") — that integration imports ONLY
      // orders whose APISource matches it exactly; a blank value is silently skipped.
      // Uniform with the quote-builder / 3-Day-Tees / Inksoft pushes (all "ManageOrders"
      // as of 2026-06-04). The proxy's transformOrder also forces this value, so this
      // is belt-and-suspenders. (Erik 2026-06-04: "ManageOrders" on everything we push.)
      apiSource: 'ManageOrders'
    };

    console.log('[Order Form Submit] Pushing', extOrderId, 'lines:', lineItems.length, 'designs:', designs.length);

    // Dry-run short-circuit: returns the payload without pushing. For debugging + smoke tests.
    if (req.query.dryRun === '1' || req.query.dryRun === 'true') {
      console.log('[Order Form Submit] dryRun=1 — not forwarding to ManageOrders');
      return res.json({ success: true, mode: 'dry-run', extOrderId, payload: manageOrdersPayload, skippedLines });
    }

    const MANAGEORDERS_API = `${CASPIO_PROXY_BASE}/api/manageorders/orders/create`;
    const response = await fetch(MANAGEORDERS_API, {
      method: 'POST',
      // Secret required since proxy v2026.08.05.9 gated this route.
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(manageOrdersPayload)
    });
    const result = await response.json().catch(() => ({}));

    const ok = response.ok && result.success !== false;
    const shopWorksId = result.orderNumber || result.shopWorksId || null;

    // Update Caspio quote_sessions status (audit trail — both share-link AND staff-direct flows).
    // MUST use PK_ID path — ?filter=QuoteID='…' is accepted with 200 but silently no-ops (proxy quirk).
    // NOTE: the public GET via filter is also cached ~5min, so a reload right after submit may still
    // show "Draft" briefly. The submit response itself is authoritative for the UI.
    if (draftPkId) {
      // Use makeApiRequest (known-good Caspio PUT pattern, same as /api/quote_sessions/:id route uses).
      // Only PUT Status — Caspio's Notes column has a ~500-char limit; the form state from the Draft
      // INSERT stays intact. shopWorksId is visible in server logs + ShopWorks UI.
      const newStatus = ok ? 'Processed' : 'Processed - ShopWorks Failed';
      try {
        // Single retry with 1.5s delay for transient post-INSERT write races.
        let success = false;
        try {
          await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
          success = true;
        } catch (firstErr) {
          await new Promise(r => setTimeout(r, 1500));
          await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
          success = true;
        }
        if (success) console.log('[Order Form Submit] ✓', extOrderId, 'marked', newStatus, shopWorksId ? ('→ SW#' + shopWorksId) : '');
      } catch (e) {
        console.warn('[Order Form Submit] Status PUT failed after retry:', e.message);
      }
    } else {
      console.warn('[Order Form Submit] No PK_ID for', extOrderId, '— status not updated in Caspio');
    }

    if (ok) {
      console.log('[Order Form Submit] ✓ Pushed', extOrderId, '→', shopWorksId);

      // Best-effort: save one quote_items row per (row, size) for line-level
      // audit history + analytics. Same schema as DTG/Embroidery/SP/DTF quote
      // builders. Failure here doesn't fail the order — push already succeeded.
      try {
        if (breakdown?.supported && breakdown.byRow) {
          const QUOTE_ITEMS_URL = `${CASPIO_PROXY_BASE}/api/quote_items`;
          const decoMethod = decoConfig?.method || rows.find(r => r?.deco)?.deco || '';
          const cfg = decoConfig || {};
          const primaryLocation = cfg.primaryLocation || cfg.locationCombo || cfg.size || '';
          let lineNumber = 1;
          for (const r of rows) {
            if (!r) continue;
            const rb = breakdown.byRow[r.id];
            if (!rb || rb.error) continue;
            const sizes = r.sizes || {};
            for (const sz of Object.keys(sizes)) {
              const qty = parseInt(sizes[sz] || 0, 10);
              if (!qty) continue;
              const finalUnit = Number(rb.unitPriceBySize?.[sz] ?? 0);
              const baseUnit  = Math.max(0, finalUnit - Number(rb.extras?.ltmPerPiece || 0));
              const item = {
                QuoteID: extOrderId,
                LineNumber: lineNumber++,
                StyleNumber: r.style || '',
                ProductName: r.desc || r.style || '',
                Color: r.colorName || r.color || '',
                ColorCode: r.catalogColor || '',
                EmbellishmentType: decoMethod,
                PrintLocation: primaryLocation,
                PrintLocationName: primaryLocation,
                Quantity: qty,
                HasLTM: rb.tier === '1-7' || rb.tier === '1-23' || rb.tier === '10-23',
                BaseUnitPrice: Number(baseUnit.toFixed(4)),
                LTMPerUnit:    Number((rb.extras?.ltmPerPiece || 0).toFixed(4)),
                FinalUnitPrice: Number(finalUnit.toFixed(2)),
                LineTotal:      Number((finalUnit * qty).toFixed(2)),
                SizeBreakdown:  JSON.stringify({ [sz]: qty }),
                PricingTier:    rb.tier || '',
                ImageURL:       r.imageUrl || '',
              };
              try {
                await fetch(QUOTE_ITEMS_URL, {
                  method: 'POST',
                  headers: withProxySecret({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify(item),
                });
              } catch (_) { /* per-line failure is non-fatal */ }
            }
          }
          console.log('[Order Form Submit] quote_items saved for', extOrderId, '(', lineNumber - 1, 'lines )');
        }
      } catch (e) {
        console.warn('[Order Form Submit] quote_items save failed (non-fatal):', e.message);
      }

      // Phase 6c (2026-05-03) — track customer service history. After every
      // successful ShopWorks push, upsert one row in Customer_Service_History
      // per addOn so the next time this customer's name shows up on an order,
      // their most-used services float to the top of the rail. Best-effort —
      // wrapped in try/catch so a tracking failure NEVER blocks submission.
      try {
        const company = (info?.company || '').trim();
        const uniqueCodes = Array.isArray(addOns)
          ? Array.from(new Set(addOns.filter(a => a?.code).map(a => String(a.code))))
          : [];
        if (company && uniqueCodes.length > 0) {
          const HIST_URL = `${CASPIO_PROXY_BASE}/api/order-form/customer-suggestions/history`;
          // Fire all upserts in parallel — Caspio handles concurrent writes
          // fine since the table's composite unique index serializes the
          // (Customer_Company, Service_Code) pair.
          await Promise.allSettled(uniqueCodes.map(code =>
            fetch(HIST_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ company, serviceCode: code, orderId: extOrderId }),
            }).catch(() => null)
          ));
          console.log('[Order Form Submit] Customer_Service_History tracked', uniqueCodes.length, 'codes for', company);
        }
      } catch (e) {
        console.warn('[Order Form Submit] Customer_Service_History upsert failed (non-fatal):', e.message);
      }

      const successBody = { success: true, extOrderId, shopWorksId, mode: 'live', skippedLines };
      cacheSubmitResponse(idemId, { statusCode: 200, body: successBody });
      return res.json(successBody);
    } else {
      console.error('[Order Form Submit] Push failed:', result);
      const failBody = { success: false, extOrderId, error: result.error || 'ShopWorks submission failed', detail: result };
      // Cache failures too — a client retry after a 502 should get the same
      // result back instead of starting a fresh push (idempotent error path).
      cacheSubmitResponse(idemId, { statusCode: 502, body: failBody });
      return res.status(502).json(failBody);
    }
  } catch (err) {
    console.error('[Order Form Submit] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Monitoring API endpoints (if enabled)
if (monitor) {
  app.get('/api/monitor/stats', (req, res) => {
    res.json(monitor.getStats());
  });

  app.get('/api/monitor/report', (req, res) => {
    const report = monitor.generateReport();
    res.json(report);
  });
}

// Error reporting endpoint (if monitoring enabled)
if (monitor) {
  app.post('/api/error-report', (req, res) => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      page: req.body.page || 'unknown',
      errors: req.body.errors || [],
      userAgent: req.headers['user-agent'],
      sessionId: req.body.sessionId
    };

    // Save error report to file
    const errorReports = [];
    try {
      if (fs.existsSync('error-reports.json')) {
        const existing = fs.readFileSync('error-reports.json', 'utf-8');
        errorReports.push(...JSON.parse(existing));
      }
    } catch (e) {
      console.error('Failed to load existing error reports:', e);
    }

    errorReports.push(errorReport);

    // Keep only last 1000 reports
    if (errorReports.length > 1000) {
      errorReports.splice(0, errorReports.length - 1000);
    }

    try {
      fs.writeFileSync('error-reports.json', JSON.stringify(errorReports, null, 2));
    } catch (e) {
      console.error('Failed to save error report:', e);
    }

    res.json({ received: true });
  });
}

// Legacy cart retired 2026-06-11 (orphaned Bootstrap flow, zero inbound links) — customers use the sample cart
app.get('/cart', (req, res) => {
  res.redirect(301, '/pages/sample-cart.html');
});

// Removed duplicate route - inventory-details.html is now served from /pages/ directory (see line 307)

// Comprehensive embroidery pricing page (unified AL/CEMB + DECG page)
app.get('/calculators/embroidery-pricing-all', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'embroidery-pricing-all', 'index.html'));
});

// Serve pricing pages - serve original embroidery calculators
app.get('/pricing/embroidery', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'calculators', 'embroidery-pricing.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/cap-embroidery', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'calculators', 'cap-embroidery-pricing-integrated.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/dtg', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'dtg-pricing.html'));
});

app.get('/pricing/screen-print', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'screen-print-pricing.html'));
});

app.get('/pricing/dtf', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'dtf-pricing.html'));
});

// /pricing/stickers MOVED (2026-07-24) then RETIRED (2026-07-29) — it is a 410
// signpost now, and its surviving oversize-decal calculator is /pricing/decals.
// Both are registered before the /calculators static mount so the gate actually
// runs. Search for "STAFF-GATED CALCULATOR PAGES".

// Cart Sessions API
app.get('/api/cart-sessions', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart sessions' });
  }
});

app.get('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart session' });
  }
});

app.post('/api/cart-sessions', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart session' });
  }
});

app.put('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart session' });
  }
});

app.delete('/api/cart-sessions/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-sessions/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart session' });
  }
});

// Cart Items API
app.get('/api/cart-items', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-items');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart items' });
  }
});

app.get('/api/cart-items/session/:sessionId', requireStaff, async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const sessionId = sanitizeFilterInput(req.params.sessionId);

    // Get cart items for the session
    const itemsData = await makeApiRequest(`/cart-items?filter=SessionID='${sessionId}'`);

    // If no items, return empty array
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      return res.json([]);
    }

    // For each item, get its sizes
    const itemsWithSizes = await Promise.all(itemsData.map(async (item) => {
      try {
        // CartItemID is from our own DB, but sanitize anyway for defense in depth
        const cartItemId = sanitizeFilterInput(item.CartItemID);
        const sizesData = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${cartItemId}`);
        
        // Reconstruct PRODUCT_TITLE from stored fields if it doesn't exist
        if (!item.PRODUCT_TITLE) {
          console.log(`[CART_ITEMS_GET] Reconstructing PRODUCT_TITLE for item ${item.CartItemID}`);
          
          // Option 1: Try to get from Description field
          if (item.Description) {
            item.PRODUCT_TITLE = item.Description;
            console.log(`[CART_ITEMS_GET] Using Description field: ${item.Description}`);
          }
          // Option 2: Try to get from Notes field
          else if (item.Notes) {
            item.PRODUCT_TITLE = item.Notes;
            console.log(`[CART_ITEMS_GET] Using Notes field: ${item.Notes}`);
          }
          // Option 3: Try to extract from EmbellishmentOptions
          else if (item.EmbellishmentOptions) {
            try {
              const embOptions = typeof item.EmbellishmentOptions === 'string'
                ? JSON.parse(item.EmbellishmentOptions)
                : item.EmbellishmentOptions;
              
              if (embOptions.productTitle) {
                item.PRODUCT_TITLE = embOptions.productTitle;
                console.log(`[CART_ITEMS_GET] Extracted from EmbellishmentOptions: ${embOptions.productTitle}`);
              }
            } catch (jsonError) {
              console.error(`[CART_ITEMS_GET] Error parsing EmbellishmentOptions for item ${item.CartItemID}:`, jsonError);
            }
          }
          
          // Fallback: Generate a title from StyleNumber and Color
          if (!item.PRODUCT_TITLE && item.StyleNumber && item.Color) {
            item.PRODUCT_TITLE = `${item.StyleNumber} - ${item.Color}`;
            console.log(`[CART_ITEMS_GET] Generated fallback title: ${item.PRODUCT_TITLE}`);
          }
        }
        
        return {
          ...item,
          sizes: sizesData || []
        };
      } catch (error) {
        console.error(`Error fetching sizes for item ${item.CartItemID}:`, error);
        return {
          ...item,
          sizes: [],
          sizesError: 'Failed to load sizes for this item'
        };
      }
    }));
    
    res.json(itemsWithSizes);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({
      error: 'Failed to fetch cart items for session',
      message: error.message
    });
  }
});

app.post('/api/cart-items', requireStaff, async (req, res) => {
  try {
    // Clone the request body to avoid modifying the original
    const modifiedBody = { ...req.body };
    
    // Check if PRODUCT_TITLE exists in the request
    if (modifiedBody.PRODUCT_TITLE) {
      console.log('[CART_ITEMS] PRODUCT_TITLE found in request:', modifiedBody.PRODUCT_TITLE);
      
      // Store PRODUCT_TITLE in a field that might exist in Caspio
      // Option 1: Try to use a Description field if it exists
      modifiedBody.Description = modifiedBody.PRODUCT_TITLE;
      
      // Option 2: Store in Notes field if it exists
      modifiedBody.Notes = modifiedBody.PRODUCT_TITLE;
      
      // Option 3: Append to EmbellishmentOptions JSON if it exists
      if (modifiedBody.EmbellishmentOptions) {
        try {
          let embOptions = modifiedBody.EmbellishmentOptions;
          
          // If EmbellishmentOptions is a string (JSON), parse it
          if (typeof embOptions === 'string') {
            embOptions = JSON.parse(embOptions);
          }
          
          // Add PRODUCT_TITLE to the options
          embOptions.productTitle = modifiedBody.PRODUCT_TITLE;
          
          // Stringify back to JSON
          modifiedBody.EmbellishmentOptions = JSON.stringify(embOptions);
          console.log('[CART_ITEMS] Added PRODUCT_TITLE to EmbellishmentOptions');
        } catch (jsonError) {
          console.error('[CART_ITEMS] Error adding PRODUCT_TITLE to EmbellishmentOptions:', jsonError);
        }
      }
    }
    
    // Log the modified body being sent to the API
    console.log('[CART_ITEMS] Sending modified request body to API:', JSON.stringify(modifiedBody));
    
    const data = await makeApiRequest('/cart-items', 'POST', modifiedBody);
    
    // Store the original PRODUCT_TITLE in the response for client-side use
    if (req.body.PRODUCT_TITLE) {
      data.PRODUCT_TITLE = req.body.PRODUCT_TITLE;
    }
    
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item' });
  }
});

app.put('/api/cart-items/:id', requireStaff, async (req, res) => {
  try {
    // Clone the request body to avoid modifying the original
    const modifiedBody = { ...req.body };
    
    // Check if PRODUCT_TITLE exists in the request
    if (modifiedBody.PRODUCT_TITLE) {
      console.log('[CART_ITEMS_UPDATE] PRODUCT_TITLE found in request:', modifiedBody.PRODUCT_TITLE);
      
      // Store PRODUCT_TITLE in a field that might exist in Caspio
      // Option 1: Try to use a Description field if it exists
      modifiedBody.Description = modifiedBody.PRODUCT_TITLE;
      
      // Option 2: Store in Notes field if it exists
      modifiedBody.Notes = modifiedBody.PRODUCT_TITLE;
      
      // Option 3: Append to EmbellishmentOptions JSON if it exists
      if (modifiedBody.EmbellishmentOptions) {
        try {
          let embOptions = modifiedBody.EmbellishmentOptions;
          
          // If EmbellishmentOptions is a string (JSON), parse it
          if (typeof embOptions === 'string') {
            embOptions = JSON.parse(embOptions);
          }
          
          // Add PRODUCT_TITLE to the options
          embOptions.productTitle = modifiedBody.PRODUCT_TITLE;
          
          // Stringify back to JSON
          modifiedBody.EmbellishmentOptions = JSON.stringify(embOptions);
          console.log('[CART_ITEMS_UPDATE] Added PRODUCT_TITLE to EmbellishmentOptions');
        } catch (jsonError) {
          console.error('[CART_ITEMS_UPDATE] Error adding PRODUCT_TITLE to EmbellishmentOptions:', jsonError);
        }
      }
    }
    
    // Log the modified body being sent to the API
    console.log('[CART_ITEMS_UPDATE] Sending modified request body to API:', JSON.stringify(modifiedBody));
    
    const data = await makeApiRequest(`/cart-items/${req.params.id}`, 'PUT', modifiedBody);
    
    // Store the original PRODUCT_TITLE in the response for client-side use
    if (req.body.PRODUCT_TITLE) {
      data.PRODUCT_TITLE = req.body.PRODUCT_TITLE;
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

app.delete('/api/cart-items/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-items/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

// Cart Item Sizes API
app.get('/api/cart-item-sizes', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.get('/api/cart-item-sizes/cart-item/:cartItemId', requireStaff, async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const cartItemId = sanitizeFilterInput(req.params.cartItemId);
    const data = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${cartItemId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.post('/api/cart-item-sizes', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item size' });
  }
});

app.put('/api/cart-item-sizes/:id', requireStaff, async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-item-sizes/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart item size' });
  }
});

app.delete('/api/cart-item-sizes/:id', requireStaff, async (req, res) => {
  try {
    await makeApiRequest(`/cart-item-sizes/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart item size' });
  }
});

// Customers API
app.get('/api/customers', async (req, res) => {
  try {
    const data = await makeApiRequest('/customers');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.get('/api/customers/email/:email', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const email = sanitizeFilterInput(req.params.email);
    const data = await makeApiRequest(`/customers?filter=Email='${email}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer by email' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const data = await makeApiRequest('/customers', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/customers/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Orders API
app.get('/api/orders', async (req, res) => {
  try {
    const data = await makeApiRequest('/orders');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/orders/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const data = await makeApiRequest('/orders', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/orders/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Style Search API
app.get('/api/stylesearch', async (req, res) => {
  try {
    const { term } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'term parameter is required' });
    }
    
    const data = await makeApiRequest(`/stylesearch?term=${encodeURIComponent(term)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search styles' });
  }
});

// Product Colors API
app.get('/api/product-colors', async (req, res) => {
  try {
    const { styleNumber } = req.query;
    
    if (!styleNumber) {
      return res.status(400).json({ error: 'styleNumber parameter is required' });
    }
    
    const data = await makeApiRequest(`/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product colors' });
  }
});

// Sizes by Style and Color API
app.get('/api/sizes-by-style-color', async (req, res) => {
  try {
    const { styleNumber, color } = req.query;
    
    if (!styleNumber || !color) {
      return res.status(400).json({ error: 'styleNumber and color parameters are required' });
    }
    
    const data = await makeApiRequest(`/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sizes' });
  }
});

// Base Item Costs API
app.get('/api/base-item-costs', async (req, res) => {
  try {
    const { styleNumber } = req.query;
    
    if (!styleNumber) {
      return res.status(400).json({ error: 'styleNumber parameter is required' });
    }
    
    const data = await makeApiRequest(`/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch base item costs' });
  }
});

// Inventory API
app.get('/api/inventory', async (req, res) => {
  try {
    const { styleNumber, color } = req.query;

    if (!styleNumber || !color) {
      return res.status(400).json({ error: 'styleNumber and color parameters are required' });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);

    const data = await makeApiRequest(`/inventory?filter=catalog_no='${safeStyle}' AND catalog_color='${safeColor}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Pricing Matrix API
app.get('/api/pricing-matrix', async (req, res) => {
  try {
    const { styleNumber, color, embType } = req.query;

    if (!styleNumber || !color || !embType) {
      return res.status(400).json({ error: 'styleNumber, color, and embType parameters are required' });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);
    const safeEmbType = sanitizeFilterInput(embType);

    const data = await makeApiRequest(`/pricing-matrix?filter=StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}'`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing matrix data' });
  }
});

app.post('/api/pricing-matrix', async (req, res) => {
  try {
    const data = await makeApiRequest('/pricing-matrix', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pricing matrix data' });
  }
});

app.put('/api/pricing-matrix/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/pricing-matrix/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing matrix data' });
  }
});

// Pricing Matrix Lookup API - NEW ENDPOINT
app.get('/api/pricing-matrix/lookup', async (req, res) => {
  try {
    const { styleNumber, color, embellishmentType, sessionID } = req.query;

    if (!styleNumber || !color || !embellishmentType) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'styleNumber, color, and embellishmentType are required query parameters'
      });
    }

    // SECURITY: Sanitize input
    const safeStyle = sanitizeFilterInput(styleNumber);
    const safeColor = sanitizeFilterInput(color);
    const safeEmbType = sanitizeFilterInput(embellishmentType);
    const safeSessionID = sessionID ? sanitizeFilterInput(sessionID) : null;

    // Build the filter based on required parameters
    let filter = encodeURIComponent(`StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}'`);

    // Add sessionID to filter if provided
    if (safeSessionID) {
      filter = encodeURIComponent(`StyleNumber='${safeStyle}' AND Color='${safeColor}' AND EmbellishmentType='${safeEmbType}' AND SessionID='${safeSessionID}'`);
    }
    
    // Query the pricing matrix table with the filter
    // Order by CaptureDate DESC to get the most recent entry if multiple exist
    const requestUrl = `${API_BASE_URL}/pricing-matrix?filter=${filter}&sort=CaptureDate%20DESC&limit=1`;
    console.log(`[Pricing Matrix Lookup] Requesting URL: ${requestUrl}`);
    console.log(`[Pricing Matrix Lookup] Using filter: ${decodeURIComponent(filter)}`); // Decode for readability
    const data = await makeApiRequest(`/pricing-matrix?filter=${filter}&sort=CaptureDate%20DESC&limit=1`);
    console.log('[Pricing Matrix Lookup] Raw API Response Data:', JSON.stringify(data, null, 2)); // Log raw data

    // Check if any records were found
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`[Pricing Matrix Lookup] No records found for ${styleNumber}, ${color}, ${embellishmentType}`);
        return res.status(404).json({
            error: 'Pricing matrix not found',
            message: `No pricing matrix found for styleNumber=${styleNumber}, color=${color}, embellishmentType=${embellishmentType}${sessionID ? `, sessionID=${sessionID}` : ''}`
        });
    }
    
    // Search through all returned records for an exact match
    let matchingRecord = null;
    for (const record of data) {
        if (record.StyleNumber === styleNumber &&
            record.Color === color &&
            record.EmbellishmentType === embellishmentType) {
            matchingRecord = record;
            console.log(`[Pricing Matrix Lookup] Found exact match: ID ${record.PK_ID} for (${styleNumber}, ${color}, ${embellishmentType})`);
            break;
        }
    }
    
    // If no exact match was found
    if (!matchingRecord) {
        console.log('[Pricing Matrix Lookup] No exact match found in returned records');
        console.warn(`[Pricing Matrix Lookup] API returned ${data.length} records, but none matched (${styleNumber}, ${color}, ${embellishmentType})`);
        
        // Log the first record for debugging
        if (data.length > 0) {
            console.warn(`[Pricing Matrix Lookup] First record was: (${data[0].StyleNumber}, ${data[0].Color}, ${data[0].EmbellishmentType}) with ID ${data[0].PK_ID}`);
        }
        
        return res.status(404).json({
            error: 'Pricing matrix not found',
            message: `No exact pricing matrix found for styleNumber=${styleNumber}, color=${color}, embellishmentType=${embellishmentType}${sessionID ? `, sessionID=${sessionID}` : ''}`
        });
    }

    // If we reach here, matchingRecord exists and matches the request
    res.json({
        pricingMatrixId: matchingRecord.PK_ID,
        message: 'Exact pricing matrix found'
    });
    
  } catch (error) {
    console.error('Error in pricing matrix lookup:', error);
    res.status(500).json({
      error: 'Failed to lookup pricing matrix',
      message: error.message
    });
  }
});

// Get specific pricing matrix by ID
app.get('/api/pricing-matrix/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/pricing-matrix/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing matrix by ID' });
  }
});

// ⛔ GET /api/christmas-products — DELETED 2026-08-17. Do not re-add.
//
// It made no API call: it returned a hardcoded 7-product list, and each product
// carried `sanmar_cost` (the raw blank vendor cost) NEXT TO `basePrice`. The route
// was anonymous, so our gross margin was published to anyone who asked
// (CTJ162: basePrice 141.00 / sanmar_cost 84.60 = 40% GP). Verified zero callers
// repo-wide before deleting — the Christmas storefront never used it; it carries
// its own inline product data.
//
// The 2025 figures live in git if the October rebuild wants them:
//   git show v2026.08.17.3:server.js
// Whatever replaces it must read from Caspio and MUST NOT project cost fields to
// a customer-reachable surface (see lib/page-access.js: pricing-analysis.html is
// admin-only for exactly this reason).

// Embroidery Pricing API
app.get('/api/embroidery-pricing', async (req, res) => {
  try {
    // Return tiered embroidery pricing
    const embroideryPricing = {
      '1-23': 15.00,
      '24-47': 13.00,
      '48-71': 12.00,
      '72+': 11.00
    };

    res.json(embroideryPricing);
  } catch (error) {
    console.error('Error fetching embroidery pricing:', error);
    res.status(500).json({ error: 'Failed to fetch embroidery pricing' });
  }
});

// Size Pricing API - NEW ENDPOINT FOR DTG/EMBROIDERY
app.get('/api/size-pricing', async (req, res) => {
  try {
    const { styleNumber } = req.query;
    
    if (!styleNumber) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'styleNumber is required'
      });
    }
    
    // Try to get size pricing data from inventory or create fallback
    console.log(`[SIZE-PRICING] Fetching size pricing for: ${styleNumber}`);
    
    // Generate fallback size pricing data for now
    const fallbackSizePricing = {
      styleNumber: styleNumber,
      sizes: [
        { size: 'S', available: true, upcharge: 0 },
        { size: 'M', available: true, upcharge: 0 },
        { size: 'L', available: true, upcharge: 0 },
        { size: 'XL', available: true, upcharge: 0 },
        { size: '2XL', available: true, upcharge: 2.00 },
        { size: '3XL', available: true, upcharge: 4.00 },
        { size: '4XL', available: true, upcharge: 6.00 },
        { size: '5XL', available: true, upcharge: 8.00 }
      ],
      addOns: [
        { name: 'Rush Service', price: 25.00, available: true },
        { name: 'Design Service', price: 50.00, available: true },
        { name: 'Color Matching', price: 15.00, available: true }
      ],
      commonData: {
        ltmThreshold: 24,
        ltmFee: 50.00,
        tiers: ['24-47', '48-71', '72+']
      }
    };
    
    res.json(fallbackSizePricing);
    
  } catch (error) {
    console.error('Error in size pricing endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch size pricing',
      message: error.message
    });
  }
});

// NEW: Image Proxy Endpoint
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send('Missing image URL parameter');
  }

  try {
    // Basic validation to prevent fetching non-http URLs (could be enhanced)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return res.status(400).send('Invalid image URL protocol');
    }

    console.log(`[Image Proxy] Fetching: ${imageUrl}`);
    const externalResponse = await fetch(imageUrl);

    if (!externalResponse.ok) {
      console.error(`[Image Proxy] Failed to fetch ${imageUrl}: Status ${externalResponse.status}`);
      // Forward the status code if it's an error code, otherwise use 500
      const statusCode = externalResponse.status >= 400 ? externalResponse.status : 500;
      return res.status(statusCode).send(`Failed to fetch image: ${externalResponse.statusText}`);
    }

    const contentType = externalResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
      console.log(`[Image Proxy] Proxying ${imageUrl} with Content-Type: ${contentType}`);
    } else {
      console.warn(`[Image Proxy] Content-Type header missing for ${imageUrl}. Sending without Content-Type.`);
    }

    // Pipe the image data directly to the client response
    externalResponse.body.pipe(res);

  } catch (error) {
    console.error(`[Image Proxy] Error fetching ${imageUrl}:`, error);
    res.status(500).send('Error fetching image');
  }
});
// Serve cart-integration.js for Caspio DataPages
app.get('/api/cart-integration.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin access
  res.sendFile(path.join(__dirname, 'cart-integration.js'));
});

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
// PUBLIC STICKER QUOTE — /custom-stickers "Get this in writing" (Phase 2, 2026-07-24)
//
// Turns a configured price into a real STK quote + share link, with no login.
//
// 🔴 THE PRICE IS RE-QUOTED SERVER-SIDE. The browser sends only size + quantity;
// every dollar written to Caspio comes from /api/sticker-pricing/quote here. A
// tampered client cannot dictate a total, and the saved quote can never disagree
// with the published sheet.
//
// 🔴 THE STK SEQUENCE IS MINTED HERE, after validation — never on page load and
// never from an unvalidated click, so bots and abandoned sessions don't burn
// quote numbers.
//
// The share link carries an unguessable token (see mintShareToken). This page
// never touches the CRM, so no customer PII beyond what the visitor typed is
// persisted — nothing like payment terms or account owner can leak through the
// public quote view.
// =============================================================================
/**
 * Only accept an artwork URL that OUR proxy minted (/api/files/<key>).
 *
 * The browser tells us where the upload landed, so without this a caller could
 * post any URL they liked and have it stored on a quote and mailed to a rep —
 * turning our own quote email into a redirect to anywhere. Returns '' for
 * anything that isn't ours, which is indistinguishable from "no artwork" and so
 * degrades exactly the way the rest of this flow does.
 */
function sanitizeArtworkUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    const base = new URL(CASPIO_PROXY_BASE);
    if (u.protocol !== 'https:') return '';
    if (u.host !== base.host) return '';
    const m = u.pathname.match(/^\/api\/files\/([A-Za-z0-9_-]+)$/);
    if (!m) return '';
    // REBUILD from the validated key rather than returning the input. Passing
    // the original through kept its query string and hash, so
    // /api/files/<key>?next=https://evil.com survived validation and would have
    // been written onto a quote and mailed to a customer. Nothing the caller
    // sent survives except the key itself.
    return `${base.origin}/api/files/${m[1]}`;
  } catch (_) {
    return '';
  }
}

app.post('/api/public/sticker-quote', strictLimiter, express.json({ limit: '32kb' }), async (req, res) => {
  const b = req.body || {};

  // Honeypot: report success and store nothing, same contract as the shared
  // public-form module. A bot must not learn it was detected.
  if (b.hp) return res.json({ ok: true, quoteId: null, url: null });

  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  // Phone is OPTIONAL (2026-07-24) — email is how the quote reaches them, so it
  // is the only contact detail actually required to fulfil the request.
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'A name and a valid email are required.' });
  }

  const width = Number(b.width);
  const height = Number(b.height);
  const qty = parseInt(b.qty, 10);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
      || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'A size and quantity are required.' });
  }

  try {
    // 1. Authoritative price.
    const pr = await fetch(`${CASPIO_PROXY_BASE}/api/sticker-pricing/quote`
      + `?width=${encodeURIComponent(width)}&height=${encodeURIComponent(height)}&qty=${encodeURIComponent(qty)}`);
    if (!pr.ok) throw new Error('pricing HTTP ' + pr.status);
    const priced = await pr.json();
    if (priced.offGrid) {
      return res.status(400).json({
        error: 'That size or quantity needs an individual quote — please call (253) 922-5793.',
        reason: priced.reason
      });
    }

    const setupAmount = Number((priced.setupFee && priced.setupFee.amount) != null
      ? priced.setupFee.amount : 50);
    const chargeSetup = b.setupAnswer !== 'reorder';       // reorder is the ONLY waiver
    const setupFee = chargeSetup ? setupAmount : 0;
    const subtotal = Number(priced.totalPrice);
    const total = subtotal + setupFee;

    // 2. Mint the quote number only now that everything above validated.
    const sr = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/STK`, { headers: withProxySecret() });
    if (!sr.ok) throw new Error('sequence HTTP ' + sr.status);
    const sj = await sr.json();
    const seq = Number(sj && sj.sequence);
    if (!Number.isFinite(seq) || seq <= 0) throw new Error('bad sequence: ' + JSON.stringify(sj));
    const quoteId = `STK-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

    const shareToken = mintShareToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().replace(/\.\d{3}Z$/, '');

    // 3. Session row. Pre-tax on purpose — WA tax is applied downstream at
    //    invoice, exactly as the staff sticker path does.
    await makeApiRequest('/quote_sessions', 'POST', {
      QuoteID: quoteId,
      SessionID: `stickers_web_${Date.now()}`,
      Status: 'Open',
      CustomerEmail: email,
      CustomerName: name,
      CompanyName: String(b.company || '').trim(),
      Phone: phone,
      TotalQuantity: priced.quantity,
      SubtotalAmount: subtotal,
      LTMFeeTotal: 0,
      TotalAmount: total,
      ExpiresAt: expiresAt,
      Notes: JSON.stringify({
        share_token: shareToken,
        setup_fee: setupFee,
        setup_answer: b.setupAnswer || 'unanswered',
        taxable: true,
        tax_note: 'WA sales tax applied at invoice.',
        source: 'custom-stickers configurator',
        configured_link: String(b.configuredLink || '').slice(0, 300),
        // Artwork is OPTIONAL — a quote with no file is a normal quote, and the
        // rep follows up by email. Only ever an /api/files/ URL our own proxy
        // minted; never a customer-supplied link.
        artwork_url: sanitizeArtworkUrl(b.artworkUrl),
        artwork_name: String(b.artworkName || '').slice(0, 200),
        customer_message: String(b.message || '').slice(0, 1000),
        applied_rules: priced.appliedRules || null
      })
    });

    // 4. Line items — the sticker line, plus the setup fee as a FEE row
    //    ('fee', not 'setup-fee': quote-view filters on exactly 'fee').
    const lines = [{
      QuoteID: quoteId,
      LineNumber: 1,
      StyleNumber: priced.partNumber,
      ProductName: `${priced.size.replace('x', '" × ')}" die-cut stickers`,
      EmbellishmentType: 'sticker',
      Quantity: priced.quantity,
      BaseUnitPrice: priced.unitPrice,
      FinalUnitPrice: priced.unitPrice,
      LineTotal: subtotal,
      PricingTier: priced.isBestValue ? 'BestValue' : 'Standard'
    }];
    if (setupFee > 0) {
      lines.push({
        QuoteID: quoteId,
        LineNumber: 2,
        StyleNumber: 'GRT-50',
        ProductName: 'Art Setup Fee (one-time)',
        EmbellishmentType: 'fee',
        Quantity: 1,
        BaseUnitPrice: setupFee,
        FinalUnitPrice: setupFee,
        LineTotal: setupFee,
        PricingTier: 'Standard'
      });
    }
    for (const line of lines) {
      await makeApiRequest('/quote_items', 'POST', line);
    }

    const url = `${PUBLIC_SITE_ORIGIN}/quote/${quoteId}?k=${shareToken}`;
    console.log(`[sticker-quote] created ${quoteId} — ${priced.partNumber} × ${priced.quantity}, $${total}`);
    res.json({ ok: true, quoteId, url, totalPrice: total, subtotal, setupFee });
  } catch (err) {
    console.error('[sticker-quote] save failed:', err.message);
    // Rule 4: never pretend this worked. The page keeps what the customer typed
    // and tells them to call.
    res.status(502).json({ error: 'We could not save your quote just now.' });
  }
});

// Public API - Get quote data with view tracking
app.get('/api/public/quote/:quoteId', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // Fetch quote session
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Share-link token (see shareTokenOk). 404 rather than 401 so a walk of the
    // ID range can't distinguish "exists but wrong token" from "doesn't exist".
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Fetch quote items
    let items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);

    // Workaround: caspio-proxy may not be filtering properly
    // Filter server-side to ensure only matching items are returned
    if (items && Array.isArray(items)) {
      items = items.filter(item => item.QuoteID === safeQuoteId);
    }

    // TODO: View tracking disabled - ViewCount/FirstViewedAt fields don't exist in Caspio yet
    // To enable: Add these fields to quote_sessions table in Caspio, then uncomment:
    // const now = new Date().toISOString();
    // const currentViewCount = parseInt(session.ViewCount) || 0;
    // const updateData = { ViewCount: currentViewCount + 1 };
    // if (!session.FirstViewedAt) { updateData.FirstViewedAt = now; }
    // makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', updateData)
    //   .catch(err => console.error('Error updating view tracking:', err));

    // Return combined data
    res.json({
      session: session,
      items: items || []
    });

  } catch (error) {
    console.error('Error fetching public quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ============================================================================
// QUOTE ↔ SHOPWORKS SYNC ENDPOINTS (Erik 2026-05-21)
// ============================================================================
//
// After an OF-NNNN order is pushed to ManageOrders and ShopWorks pulls it (~2-3 hours
// later), ShopWorks becomes the source of truth — operators may edit the email,
// ship address, line items, status flags, etc. The quote-view page mirrors
// ShopWorks's current state by syncing these edits back into quote_sessions.
//
//   POST /api/quote-sessions/:quoteId/sync-from-shopworks
//     Pulls fresh state from MO snapshot endpoint + writes to Caspio.
//     If ShopWorks has deleted the order, HARD DELETES the quote_sessions row.
//     Used by the page's auto-sync (on stale) + manual Refresh button + the
//     hourly cron job.
//
//   GET /api/quote-sessions/:quoteId/full
//     Returns the quote_sessions row WITH the parsed ShopWorks_Snapshot embedded.
//     This is the page's primary data source — UI prefers ShopWorks_Snapshot
//     when present, falls back to the original submission (Notes JSON) when
//     not (pre-import).
//
// Sync is ONE-WAY only: ShopWorks → quote_sessions. We never write back to
// ManageOrders after the initial /create push.
// ============================================================================

const SYNC_SLACK_DELETE_WEBHOOK = process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL || '';

/**
 * Notify Slack (best-effort, fire-and-forget) when a quote_sessions row is
 * hard-deleted because ShopWorks no longer has the order. Lets AR/sales
 * notice if a real customer order disappears (vs. a test-order cleanup).
 */
function notifyQuoteDeleted(quoteId, shopWorksOrderNumber, customerName) {
  if (!SYNC_SLACK_DELETE_WEBHOOK) return;
  const payload = {
    text: `🗑️ Quote ${quoteId} hard-deleted — ShopWorks no longer has Order #${shopWorksOrderNumber || '?'} (${customerName || 'no customer'})`
  };
  fetch(SYNC_SLACK_DELETE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {/* silent */});
}

// ============================================================================
// Quote_Change_Log helpers (Erik 2026-05-22 — Phase 1 of SW edit audit trail)
// ----------------------------------------------------------------------------
// When sync-from-shopworks detects a delta between the old and new snapshot,
// it writes one row per changed field to Quote_Change_Log (via proxy). Phase 2
// (banner on quote-view) and Phase 3 (dashboard activity feed) read from this
// table to surface "what changed in SW since last view".
// ============================================================================

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

// WATCHED_ORDER_FIELDS / normalizeForDiff / sizeColsOf / diffSnapshots were
// extracted to a unit-testable module (2026-06-26) — server.js boots on require
// (app.listen), so the diff logic couldn't be imported into a jest test inline.
// The size-aware diff is locked by tests/unit/quote-snapshot-diff.test.js.
const { diffSnapshots } = require('./lib/quote-snapshot-diff');

/**
 * Write change records to Quote_Change_Log via the proxy. Fire-and-forget —
 * a logging failure must not block the snapshot write.
 */
async function logQuoteChanges(quoteId, changes, detectedBy, salesRepEmail, shopWorksOrderNumber) {
  if (!Array.isArray(changes) || changes.length === 0) return;
  const ts = nowPacificNaiveIso();
  const rows = changes.map(c => ({
    QuoteID: quoteId,
    ShopWorksOrderNumber: shopWorksOrderNumber || null,
    SalesRepEmail: salesRepEmail || null,
    ChangedAt: ts,
    ChangeType: c.type || 'other',
    FieldName: String(c.field || '').slice(0, 250),
    OldValue: c.oldValue == null ? '' : String(c.oldValue).slice(0, 64000),
    NewValue: c.newValue == null ? '' : String(c.newValue).slice(0, 64000),
    Severity: c.severity || 'info',
    DetectedBy: detectedBy || 'cron',
    Notes: c.notes || '',
  }));
  try {
    await makeApiRequest('/quote_change_log', 'POST', rows);
    console.log(`[change-log] wrote ${rows.length} change record(s) for ${quoteId}`);
  } catch (e) {
    console.warn(`[change-log] write failed for ${quoteId} (non-fatal):`, e.message);
  }
}

/**
 * POST /api/quote-sessions/:quoteId/sync-from-shopworks
 *
 * Triggers a fresh pull from ManageOrders for the given quote.
 * - If ShopWorks returns the order → updates the 4 ShopWorks_* columns
 * - If ShopWorks returns "not found" and we previously had status=Imported → HARD DELETE
 * - If ShopWorks returns "not found" and status was Pending → just updates Last_Synced
 *
 * Returns: { success, synced, deleted, status, shopWorksOrderNumber, snapshot }
 */
// Derive the ManageOrders ExtOrderID the way the PUSH created it, so the sync
// looks up the correct order. EMB/SCP/DTF builder pushes use a method-prefixed,
// year-safe ID built by caspio-pricing-proxy/config/manageorders-emb-config.js
// `buildExtOrderID` (EMB-2026-177 / SCP-2026-MMDD-seq / DTF-2026-MMDD-seq). The
// Order Form / DTG / legacy flow uses NWCA-{QuoteID}. The old code hardcoded
// NWCA-{QuoteID} for EVERY quote, so builder orders were looked up under an ID
// that never existed and never synced back from ShopWorks. Mirror the proxy's
// buildExtOrderID + getQuoteYear for the three builder prefixes; fall back to
// NWCA-{QuoteID} for everything else. KEEP IN SYNC with the proxy. (2026-06-01)
function deriveExtOrderIdForSync(quoteId, session) {
  const q = String(quoteId || '').trim();
  const lead = (q.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
  const PREFIX_MAP = { EMB: 'EMB', EMBC: 'EMB', CEMB: 'EMB', SP: 'SCP', SPC: 'SCP', SSC: 'SCP', DTF: 'DTF' };
  const outPrefix = PREFIX_MAP[lead];
  if (!outPrefix) return `NWCA-${q}`; // Order Form / DTG / legacy — unchanged
  let tail = q.replace(/^[A-Za-z]+-?/, '') || '0';
  if (!/^20\d\d(\D|$)/.test(tail)) {
    const raw = (session && (session.DateOrderPlaced || session.CreatedAt_Quote || session.CreatedAt)) || '';
    const ym = String(raw).match(/(20\d\d)/);
    tail = `${ym ? ym[1] : new Date().getFullYear()}-${tail}`;
  }
  return `${outPrefix}-${tail}`;
}

app.post('/api/quote-sessions/:quoteId/sync-from-shopworks', async (req, res) => {
  const startedAt = Date.now();
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // 1. Look up the quote_sessions row by QuoteID (need PK_ID for PUT/DELETE).
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'&q.orderBy=PK_ID DESC`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    // [A2] (audit 2026-06-06): among duplicate-QuoteID rows prefer the PUSHED row, else the newest (client-
    // sorted, robust if the filter= route strips q.orderBy) — the sync's PUT must target the same row push
    // stamped, not an oldest/unpushed duplicate (→ split-brain → a second ShopWorks order).
    const session = sessions.find(s => s.PushedToShopWorks)
      || [...sessions].sort((a, b) => (Number(b.PK_ID) || 0) - (Number(a.PK_ID) || 0))[0];
    const pkId = session.PK_ID;
    const previousStatus = session.ShopWorks_Status || '';

    // 2. Determine how to find the ShopWorks order:
    //    (a) Body sends `shopWorksOrderNumber` (rep typed the WO# into the
    //        "Set ShopWorks Order #" input on /quote/:quoteId) — store it
    //        and use it directly to fetch /v1/orders/{N}, bypassing the
    //        broken /v1/getorderno mapping.
    //    (b) Else, if the row already has ShopWorks_Order_Number stored,
    //        use that.
    //    (c) Else fall through to the snapshot endpoint which tries
    //        /v1/getorderno (currently empty for our orders — known MO
    //        config gap; will work eventually).
    let manualOrderNumber = null;
    if (req.body && req.body.shopWorksOrderNumber) {
      const n = Number(req.body.shopWorksOrderNumber);
      if (Number.isInteger(n) && n > 0 && n < 10000000) {
        manualOrderNumber = n;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid shopWorksOrderNumber' });
      }
    } else if (Number.isFinite(Number(session.ShopWorks_Order_Number)) && Number(session.ShopWorks_Order_Number) > 0) {
      manualOrderNumber = Number(session.ShopWorks_Order_Number);
    }

    const extOrderId = deriveExtOrderIdForSync(safeQuoteId, session);

    // 3. Fetch snapshot via one of two paths:
    let snapshot;
    try {
      // Both paths go through the same proxy snapshot endpoint now (it
      // accepts a known id_Order via the ?orderNumber= query param to
      // bypass the /v1/getorderno mapping when we already have it).
      // The proxy snapshot endpoint also fetches /order-pull in parallel
      // to include Designs/Attachments/ShippingAddresses (pushed data).
      const snapshotUrl = manualOrderNumber
        ? `${SYNC_PROXY_BASE}/api/manageorders/order/${encodeURIComponent(extOrderId)}/snapshot?orderNumber=${manualOrderNumber}&refresh=true`
        : `${SYNC_PROXY_BASE}/api/manageorders/order/${encodeURIComponent(extOrderId)}/snapshot`;
      // The secret is REQUIRED here: proxy 191c906 (2026-08-10) put
      // /api/manageorders/order behind requireCrmApiSecret, and this was the one
      // proxy call in this file sending no credentials — so every sync 401'd →
      // 502 → errors==candidates, synced:0, hourly, for a week. The 502 return
      // below logs nothing, which is why `grep bulk-sync` showed only the
      // summary line. Log the failure so the next gate change is one grep away.
      const r = await fetch(snapshotUrl, {
        headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {},
      });
      if (!r.ok) {
        console.warn(`[sync-from-shopworks] ✗ ${safeQuoteId} — MO snapshot HTTP ${r.status} (${snapshotUrl.split('?')[0]})`);
        return res.status(502).json({ success: false, error: `MO snapshot fetch failed: HTTP ${r.status}` });
      }
      snapshot = await r.json();

      // If a manual WO# was given but /v1 still doesn't have it, persist
      // the WO# anyway so future cron + manual syncs can try again.
      if (manualOrderNumber && !snapshot.found && req.body?.shopWorksOrderNumber) {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
          ShopWorks_Order_Number: manualOrderNumber,
          ShopWorks_Status: 'Pending',
          ShopWorks_Last_Synced: nowPacificNaiveIso(),
        }).catch(() => {});
        return res.json({
          success: true, synced: true, deleted: false, status: 'Pending',
          shopWorksOrderNumber: manualOrderNumber,
          lastSynced: nowPacificNaiveIso(),
          reason: 'shopworks_order_not_in_mo_v1_yet',
          note: 'Order # saved. ManageOrders /v1 syncs from OnSite every 15 min between 7am-7pm Pacific. Refresh in a few minutes for live data.',
        });
      }
    } catch (e) {
      return res.status(502).json({ success: false, error: `MO snapshot fetch error: ${e.message}` });
    }

    // PACIFIC, not UTC (fixed 2026-08-17). ShopWorks_Last_Synced is READ back by
    // parseCaspioPacificMs (staleness + purge, below) and by CaspioDate.parse on the
    // dashboard — i.e. everything treats it as the naive Pacific wall-clock Caspio
    // stores everywhere else. Writing UTC made every fresh row parse ~7-8 h in the
    // FUTURE, so `now - lastSynced` went NEGATIVE and the 30-minute staleness test
    // could not fire: a just-synced quote was skipped for ~7.5 h instead of 30 min,
    // quietly turning the hourly re-sync into ~3x/day. That cadence is exactly what
    // detects ShopWorks-side deletions and fires the ShipStation cancel-cascade.
    // It also pushed the 30-day purge (and the dashboard's "Purges in N days") late.
    const nowIso = nowPacificNaiveIso();

    // 4. Branch: order found in ShopWorks vs. not.
    if (snapshot.found) {
      // 4a. UPDATE path — write the new ShopWorks-side state.

      // Phase 1 change-log diff (Erik 2026-05-22): compare new snapshot
      // against the previous one BEFORE overwrite. Each diff becomes one
      // row in Quote_Change_Log. Fire-and-forget — log write must not block
      // the snapshot update. Detected-by reflects how the sync was invoked:
      //   - body has shopWorksOrderNumber → manual entry by rep
      //   - else → page-load auto-sync OR hourly cron (we can't tell apart
      //     at this layer; cron caller can pass ?detectedBy=cron in future)
      let oldSnap = null;
      if (session.ShopWorks_Snapshot) {
        try { oldSnap = JSON.parse(session.ShopWorks_Snapshot); }
        catch (_) { /* malformed; treat as no prior snapshot */ }
      }
      const newSnap = {
        order: snapshot.order,
        lineItems: snapshot.lineItems,
        // Persist the /order-pull `pushed` block (Designs[] + Attachments +
        // ShippingAddresses). The quote-view Designs table reads
        // `snapshot.pushed.Designs[]` for each design's TYPE (id_DesignType,
        // e.g. 45→DTG) and per-location name (e.g. "Full Front"). Dropping it
        // here forced the page into its fallback branch, which renders
        // "Unknown" type + a hardcoded "Left Chest" location even when
        // ShopWorks clearly says Full Front / DTG (fixed 2026-06-15). The proxy
        // already trims `pushed` to those 3 arrays, so it stays small.
        pushed: snapshot.pushed || null,
        // Persist live MO /v1 tracking + payments too (Erik 2026-06-16). The proxy
        // snapshot endpoint fetches these on every pull, but they were dropped here —
        // so the quote-view outbound tracking block + Date Shipped (and the new
        // Shipped-tile "real shipment" gate) only ever saw empty arrays, even on a
        // genuinely shipped order. Persisting them lets cron-synced rows surface
        // outbound tracking/carrier/ship date, not just a live page re-fetch.
        // NOTE: unlike `pushed` (which the proxy trims to Designs/Attachments/
        // ShippingAddresses), tracking/payments come through UNTRIMMED — so cap them
        // defensively here to keep ShopWorks_Snapshot well under its Text(64000)
        // column limit regardless of how large an upstream multi-shipment payload is.
        tracking: Array.isArray(snapshot.tracking) ? snapshot.tracking.slice(0, 50) : (snapshot.tracking || null),
        payments: Array.isArray(snapshot.payments) ? snapshot.payments.slice(0, 50) : (snapshot.payments || null),
        fetchedAt: snapshot.fetchedAt,
      };
      const changes = diffSnapshots(oldSnap, newSnap);
      if (changes.length > 0) {
        const detectedBy = req.body?.shopWorksOrderNumber ? 'manual-refresh'
          : (req.query?.detectedBy || 'page-load-sync');
        logQuoteChanges(
          safeQuoteId,
          changes,
          detectedBy,
          session.SalesRepEmail || null,
          snapshot.id_Order || null,
        ).catch(() => {});
      }

      const update = {
        ShopWorks_Order_Number: snapshot.id_Order,
        ShopWorks_Status: 'Imported',
        ShopWorks_Last_Synced: nowIso,
        ShopWorks_Snapshot: JSON.stringify(newSnap),
      };
      try {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', update);
      } catch (e) {
        console.warn(`[sync-from-shopworks] Caspio PUT failed for ${safeQuoteId}:`, e.message);
        return res.status(500).json({ success: false, error: 'Caspio update failed', details: e.message });
      }

      const elapsed = Date.now() - startedAt;
      console.log(`[sync-from-shopworks] ✓ ${safeQuoteId} → SW#${snapshot.id_Order} (${elapsed}ms)`);
      return res.json({
        success: true,
        synced: true,
        deleted: false,
        status: 'Imported',
        shopWorksOrderNumber: snapshot.id_Order,
        lastSynced: nowIso,
        snapshot: {
          order: snapshot.order,
          lineItems: snapshot.lineItems,
          pushed: snapshot.pushed || null,   // see newSnap above — Designs/type/location for the quote-view
          tracking: snapshot.tracking || null,  // keep the manual-refresh response in lockstep with newSnap
          payments: snapshot.payments || null,
          fetchedAt: snapshot.fetchedAt,
        },
      });
    }

    // 4b. NOT FOUND in ShopWorks. Two sub-cases:
    //     - Previously Imported → ShopWorks operator deleted → SOFT DELETE
    //       (Status → 'Cancelled_in_ShopWorks', preserve row for 30-day audit
    //        retention; bulk-sync cron purges later)
    //     - Otherwise (Pending or never synced) → just bump Last_Synced
    if (previousStatus === 'Imported') {
      // SOFT DELETE. Order existed in SW and now doesn't — operator removed it.
      // Erik 2026-05-21: soft delete over hard delete chosen for audit trail.
      // The row stays visible (with a "Cancelled" banner) so AR/CSR can still
      // see the order if a customer calls back. After 30 days the row is
      // hard-purged by the bulk-sync cron.
      try {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
          Status: 'Cancelled_in_ShopWorks',
          ShopWorks_Status: 'Deleted',
          // ShopWorks_Last_Synced doubles as cancelled_at timestamp — it's
          // when we DETECTED the deletion (close enough to actual delete time
          // since the cron runs hourly).
          ShopWorks_Last_Synced: nowIso,
        });
        console.log(`[sync-from-shopworks] ⊘ SOFT DELETED ${safeQuoteId} (was SW#${session.ShopWorks_Order_Number || '?'}) — 30d retention`);
        notifyQuoteDeleted(safeQuoteId, session.ShopWorks_Order_Number, session.CustomerName);

        // Log to Quote_Change_Log (critical severity — order is GONE in SW)
        logQuoteChanges(safeQuoteId, [{
          field: 'Status',
          oldValue: 'Imported',
          newValue: 'Cancelled_in_ShopWorks',
          type: 'deleted',
          severity: 'critical',
          notes: 'Order removed from SW — soft-deleted with 30d audit retention',
        }], 'cron', session.SalesRepEmail || null, session.ShopWorks_Order_Number || null).catch(() => {});

        // SW → SS cascade (Erik 2026-05-22): when SW operator deletes the
        // order, also delete the matching ShipStation order so warehouse
        // doesn't pick/label a phantom shipment. SKIP if already shipped —
        // label is bought + paid, can't undo without explicit void action.
        // Fire-and-forget — cascade failure shouldn't block the SW-side
        // soft-delete (the quote_sessions row is already cancelled; a
        // stranded SS order is a smaller problem than a stuck cascade).
        if (session.ShipStation_Order_ID && session.ShipStation_Status !== 'shipped') {
          (async () => {
            try {
              const delUrl = `${SYNC_PROXY_BASE}/api/shipstation/orders/${encodeURIComponent(session.ShipStation_Order_ID)}?reason=${encodeURIComponent('SW order deleted (cascade)')}`;
              // #9: proxy shipstation writes are CRM-gated — send the server-side secret.
              const r = await fetch(delUrl, { method: 'DELETE', headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
              if (r.ok) {
                console.log(`[sync-from-shopworks] ⊘ SS-cascade: deleted ShipStation #${session.ShipStation_Order_ID} for ${safeQuoteId}`);
                // Also clear our local ShipStation columns so the dashboard
                // doesn't keep showing "In ShipStation #N" on a deleted order.
                await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
                  ShipStation_Status: 'cancelled',
                  ShipStation_Last_Synced: nowIso,
                }).catch(() => { /* non-fatal — row already in audit-retention state */ });
              } else {
                console.warn(`[sync-from-shopworks] SS-cascade DELETE failed: HTTP ${r.status}`);
              }
            } catch (e) {
              console.warn(`[sync-from-shopworks] SS-cascade error (non-fatal):`, e.message);
            }
          })();
        } else if (session.ShipStation_Order_ID && session.ShipStation_Status === 'shipped') {
          // Already shipped — can't undo. Just log so it shows up in oncall review.
          console.warn(`[sync-from-shopworks] ⚠ SW deleted ${safeQuoteId} but SS already shipped (#${session.ShipStation_Order_ID}, tracking=${session.TrackingNumber || '?'}). Manual customer contact needed.`);
        }

        return res.json({
          success: true,
          synced: true,
          deleted: true,        // semantically "cancelled" — front-end uses this to redirect
          softDeleted: true,    // distinguishes from hard-delete for callers that care
          status: 'Cancelled_in_ShopWorks',
          shopWorksOrderNumber: session.ShopWorks_Order_Number,
          lastSynced: nowIso,
        });
      } catch (e) {
        console.error(`[sync-from-shopworks] Soft-delete failed for ${safeQuoteId}:`, e.message);
        return res.status(500).json({ success: false, error: 'Soft-delete failed', details: e.message });
      }
    }

    // 4c. Still pending — just bump the timestamp so we don't re-poll constantly.
    try {
      await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
        ShopWorks_Status: previousStatus || 'Pending',
        ShopWorks_Last_Synced: nowIso,
      });
    } catch (e) {
      console.warn(`[sync-from-shopworks] pending-timestamp PUT failed for ${safeQuoteId}:`, e.message);
    }
    return res.json({
      success: true,
      synced: true,
      deleted: false,
      status: previousStatus || 'Pending',
      shopWorksOrderNumber: null,
      lastSynced: nowIso,
      reason: snapshot.reason || 'not_imported_yet',
    });

  } catch (error) {
    console.error('[sync-from-shopworks] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Sync failed', details: error.message });
  }
});

/**
 * GET /api/quote-sessions/:quoteId/full
 *
 * Returns the quote_sessions row with the ShopWorks_Snapshot parsed and
 * embedded. This is the primary data source for the quote-view page.
 *
 * Response shape (compact):
 *   {
 *     quoteId, status, ...flat columns,
 *     originalSubmission: { info, rows, ship, ... } | null,  // parsed Notes JSON
 *     shopWorks: {
 *       orderNumber, status, lastSynced,
 *       snapshot: { order, lineItems, fetchedAt }
 *     } | null
 *   }
 */
app.get('/api/quote-sessions/:quoteId/full', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Same share-link token gate as /api/public/quote/:id — this endpoint is
    // equally anonymous and returns MORE (the full Notes blob).
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Parse the original submission from Notes JSON (best-effort).
    let originalSubmission = null;
    if (session.Notes) {
      try { originalSubmission = JSON.parse(session.Notes); }
      catch { /* Notes may be plain text on legacy quotes — leave as null */ }
    }

    // Parse the ShopWorks snapshot if we have one.
    let shopWorks = null;
    if (session.ShopWorks_Snapshot) {
      try {
        const snapshot = JSON.parse(session.ShopWorks_Snapshot);
        // A1 backfill (Erik 2026-05-22): if the snapshot knows the WO# but
        // the indexed column is empty, persist it so the dashboard list view
        // (which only reads `ShopWorks_Order_Number`, not the snapshot JSON)
        // shows the # suffix on the "IN SHOPWORKS" badge. /v1/getorderno is
        // broken upstream → some quotes had the snapshot synced (via manual
        // WO# entry on /quote/:id) but the column was never written back. This
        // closes the gap opportunistically — next dashboard load catches up.
        const snapshotWo = Number(snapshot?.order?.id_Order) || 0;
        const columnWo   = Number(session.ShopWorks_Order_Number) || 0;
        if (snapshotWo > 0 && columnWo === 0) {
          makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', {
            ShopWorks_Order_Number: snapshotWo,
          }).catch(e => console.warn(`[quote/full] WO# backfill failed for ${safeQuoteId}:`, e.message));
        }
        shopWorks = {
          orderNumber: session.ShopWorks_Order_Number || snapshotWo || null,
          status: session.ShopWorks_Status,
          lastSynced: session.ShopWorks_Last_Synced,
          snapshot, // { order, lineItems, fetchedAt }
        };
      } catch (e) {
        console.warn(`[quote/full] ShopWorks_Snapshot parse failed for ${safeQuoteId}:`, e.message);
      }
    } else if (session.ShopWorks_Status || session.ShopWorks_Order_Number || session.ShopWorks_Last_Synced) {
      // No snapshot but other ShopWorks fields are populated (e.g. just
      // marked Pending without a successful sync yet).
      shopWorks = {
        orderNumber: session.ShopWorks_Order_Number || null,
        status: session.ShopWorks_Status || 'Pending',
        lastSynced: session.ShopWorks_Last_Synced || null,
        snapshot: null,
      };
    }

    // Also fetch quote_items so the UI can render the original line items
    // even when ShopWorks hasn't imported yet.
    let items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);
    if (Array.isArray(items)) {
      items = items.filter(it => it.QuoteID === safeQuoteId);
    } else {
      items = [];
    }

    // Billing contact — pull the customer's billing address from the
    // CompanyContactsMerge2026 table so the invoice / quote-view can display
    // a complete Bill-To block. The original submission only captures whatever
    // the rep typed at submit time (often partial: city/state only).
    //
    // Source priority for id_Customer:
    //   1. ShopWorks snapshot's order.id_Customer (most authoritative)
    //   2. originalSubmission.info.companyId (form-captured)
    let billingContact = null;
    const idCustomer =
      shopWorks?.snapshot?.order?.id_Customer ||
      originalSubmission?.info?.companyId ||
      null;
    if (idCustomer) {
      try {
        const PROXY_BASE = CASPIO_PROXY_BASE;
        const resp = await fetch(
          `${PROXY_BASE}/api/company-contacts/by-customer/${encodeURIComponent(idCustomer)}`,
          { method: 'GET', headers: withProxySecret() }
        );
        if (resp.ok) {
          const data = await resp.json();
          const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
          // Prefer contacts with a complete address; fall back to the most-recent.
          const complete = contacts.find(c => c.Has_Complete_Address && c.Address);
          const fallback = contacts.find(c => c.Address) || contacts[0];
          const chosen = complete || fallback;
          if (chosen) {
            billingContact = {
              companyName: chosen.Company_Name || chosen.CustomerCompanyName || null,
              address1:    chosen.Address || null,
              address2:    chosen.Address2 || null,
              city:        chosen.City || null,
              state:       chosen.State || null,
              zip:         chosen.Zip || null,
              phone:       chosen.Company_Phone || null,
              // Phone_Best — curated "best phone for this contact" maintained
              // in CompanyContactsMerge2026. Preferred when populated; reps
              // hand-pick the right number per contact in the Caspio admin.
              phoneBest:   chosen.Phone_Best || null,
              email:       chosen.Company_Email || null,
              contactName: chosen.ct_NameFull || [chosen.NameFirst, chosen.NameLast].filter(Boolean).join(' ') || null,
              // Audit fix H1 (2026-05-21): expose curated customer-record fields
              // so the form + invoice + quote-view can react.
              // - isTaxExempt: invoice shows "Tax Exempt (Cert #...)" instead of tax line
              // - customerWarning: form shows a yellow banner before submit
              // - paymentTerms: pre-populates the Payment Terms dropdown
              //                  (CustTerms is the historical pref; Payment_Terms
              //                   is the newer normalized value)
              // - accountTier: lets the form badge VIP customers
              isTaxExempt:     chosen.Is_Tax_Exempt === true || chosen.Is_Tax_Exempt === 1 || chosen.Is_Tax_Exempt === '1',
              taxExemptNumber: chosen.Tax_Exempt_Number || null,
              customerWarning: chosen.Customer_Warning || null,
              paymentTerms:    chosen.Preferred_Terms_FromOrders || chosen.Payment_Terms || chosen.CustTerms || null,
              accountTier:     chosen.Account_Tier || null,
              source:      'company-contacts-2026',
              idCustomer,
            };
          }
        }
      } catch (e) {
        // Best-effort fetch — don't fail the whole /full response if proxy is
        // momentarily unreachable. Front end will fall back to originalSubmission.
        console.warn(`[quote/full] billing-contact fetch failed for customer ${idCustomer}:`, e.message);
      }
    }

    // ShipStation state block — derived from the new Caspio columns added
    // for the ShipStation integration. Front-end uses this to decide:
    //   • show "Send to ShipStation" button (when shipStation === null)
    //   • show "✓ In ShipStation #N" badge (when status==='awaiting_shipment')
    //   • show "📦 Shipped — tracking #X" (when status==='shipped')
    //   • hide entirely (when ship.method === 'Customer Pickup')
    let shipStation = null;
    if (session.ShipStation_Order_ID || session.ShipStation_Status || session.TrackingNumber) {
      shipStation = {
        orderId:      session.ShipStation_Order_ID || null,
        status:       session.ShipStation_Status || null,
        lastSynced:   session.ShipStation_Last_Synced || null,
        trackingNumber: session.TrackingNumber || null,
        trackingCarrier: session.TrackingCarrier || null,
        trackingURL:    session.TrackingURL || null,
        shippedAt:    session.ShippedAt || null,
        labelCost:    session.LabelCost != null ? Number(session.LabelCost) : null,
      };
    }

    res.json({
      quoteId: session.QuoteID,
      status: session.Status,
      sessionRaw: session,                    // every flat column for power users
      originalSubmission,                     // parsed Notes JSON
      quoteItems: items,                      // pre-import line items
      shopWorks,                              // current ShopWorks-side state (when synced)
      billingContact,                         // Bill-To address from CompanyContactsMerge2026
      shipStation,                            // ShipStation state (when sent / shipped)
    });
  } catch (error) {
    console.error('[quote/full] error:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ── Inbound vendor-shipment helpers (mirror the proxy's, kept local) ──
function buildVendorTrackingUrl(carrier, trackingNumber) {
  if (!trackingNumber) return null;
  const c = String(carrier || '').toLowerCase();
  const t = encodeURIComponent(String(trackingNumber).trim());
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  if (c.includes('spee')) return `https://www.speedeedelivery.com/tools/track-shipment/?tracking=${t}`;
  return null;
}
function mapVendorState(statusRaw) {
  const s = String(statusRaw || '').trim().toLowerCase();
  if (s === 'shipped') return 'shipped';
  if (s === 'partially shipped') return 'partial';
  if (s === 'complete') return 'complete';
  if (s === 'confirmed' || s === 'received') return 'confirmed';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return 'unknown';
}

/**
 * POST /api/sanmar-orders/sync-shipments
 *
 * Manual same-origin trigger for the proxy's bounded SanMar shipment catch-up
 * (Erik 2026-06-16). The proxy endpoint is secret-gated (CRM_API_SECRET) so the
 * browser can't call it directly; this passes the secret server-side. It pulls the
 * live SanMar shipment feed for recent open orders that lack a tracking row and
 * PERSISTS any tracking into the synced table, so the dashboard Inbound dots flip
 * to "Shipped" (with tracking) and STAY that way across reloads. Bounded by the
 * proxy (≤15 POs) to stay under the 30s request limit.
 */
app.post('/api/sanmar-orders/sync-shipments', async (req, res) => {
  try {
    const secret = process.env.CRM_API_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: 'CRM_API_SECRET not configured' });
    const limit = Math.min(Math.max(parseInt(req.body && req.body.limit) || 15, 1), 15);
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-shipments?limit=${limit}`, {
      method: 'POST',
      headers: { 'x-api-secret': secret, 'Content-Type': 'application/json' },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ success: false, error: data.error || `proxy HTTP ${r.status}`, details: data.details });
    }
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-shipments proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sanmar-orders/sync-recent-completed
 *
 * Same-origin manual trigger for the proxy's recently-completed catch-up (Erik
 * 2026-06-26). The proxy endpoint is secret-gated; this passes the secret server-
 * side (the browser can't). It discovers recently-INVOICED SanMar POs and fully
 * ingests any the daily allOpen/lastUpdate passes missed — orders that raced
 * placed→shipped→Complete BETWEEN scheduled syncs and so never entered the synced
 * table at all (no PO, no tracking in the quote-view panel, the inbound dot, or the
 * daily list — e.g. PO 113470 / WO 142292). Bounded SMALL (≤6) because this whole
 * call must finish inside the 30s web-request limit: invoice discovery + per-PO
 * poSearch + shipment SOAP is heavier than /sync-shipments. Returns `remaining` so
 * the UI can prompt to run again for a larger backlog.
 */
app.post('/api/sanmar-orders/sync-recent-completed', async (req, res) => {
  try {
    const secret = process.env.CRM_API_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: 'CRM_API_SECRET not configured' });
    const days = Math.min(Math.max(parseInt(req.body && req.body.days) || 7, 1), 30);
    const limit = Math.min(Math.max(parseInt(req.body && req.body.limit) || 5, 1), 6);
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-recent-completed?days=${days}&limit=${limit}`, {
      method: 'POST',
      headers: { 'x-api-secret': secret, 'Content-Type': 'application/json' },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ success: false, error: data.error || `proxy HTTP ${r.status}`, details: data.details });
    }
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-recent-completed proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sanmar-orders/sync-recent-completed-status
 *
 * Same-origin pass-through for the proxy's background catch-up status, so the
 * "Refresh Inbound" button can poll until the async job finishes (the POST above
 * returns 202 immediately). Read-only; no secret needed on the proxy GET.
 */
app.get('/api/sanmar-orders/sync-recent-completed-status', async (req, res) => {
  try {
    const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/sync-recent-completed-status`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ success: false, error: `proxy HTTP ${r.status}` });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[sanmar sync-recent-completed-status proxy] error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/quote-sessions/:quoteId/vendor-shipment
 *
 * INBOUND blank-goods shipment status (vendor SanMar → NWCA) for the order's
 * work order. Composes two EXISTING proxy endpoints:
 *   1) /api/sanmar-orders/lookup?woId=  → SanMar PO(s) + synced status/shipments
 *   2) /api/sanmar-shipments/po/:po     → LIVE PromoStandards OSN tracking
 * Same-origin so the quote-view auto-loads it. Never claims "shipped" without
 * backing (Erik #1): on a live-OSN error it falls back to the synced shipment
 * rows and flags live:false + error.
 *
 * Query: ?woId=<work order #> (quote-view passes snapshot.order.id_Order);
 * falls back to the row's ShopWorks_Order_Number.
 */
app.get('/api/quote-sessions/:quoteId/vendor-shipment', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // Resolve the work order number.
    let woId = null;
    const qWo = Number(req.query.woId);
    if (Number.isInteger(qWo) && qWo > 0 && qWo < 100000000) {
      woId = qWo;
    } else {
      try {
        const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
        const session = Array.isArray(sessions) ? sessions[0] : null;
        const colWo = Number(session && session.ShopWorks_Order_Number);
        if (Number.isInteger(colWo) && colWo > 0) woId = colWo;
      } catch (_) { /* fall through to not-linked */ }
    }
    if (!woId) return res.json({ woId: null, linked: false, pos: [] });

    // 1) WO → SanMar PO(s) (Caspio-backed, synced status + shipments).
    let lookup;
    try {
      const r = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-orders/lookup?woId=${encodeURIComponent(woId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      lookup = await r.json();
    } catch (e) {
      return res.status(502).json({ woId, linked: false, pos: [], error: `SanMar lookup failed: ${e.message}` });
    }
    const orders = (lookup && Array.isArray(lookup.orders)) ? lookup.orders : [];
    if (orders.length === 0) return res.json({ woId, linked: false, pos: [] });

    // 2) Per PO, pull LIVE OSN tracking; fall back to synced shipments on error.
    const pos = [];
    for (const o of orders) {
      const po = o.SanMar_PO || null;
      const baseState = mapVendorState(o.SanMar_Status);
      let boxes = [];
      let live = false;
      let error = null;
      if (po) {
        const poDigits = (String(po).match(/^\d+/) || [''])[0] || po;
        try {
          const sr = await fetch(`${SYNC_PROXY_BASE}/api/sanmar-shipments/po/${encodeURIComponent(poDigits)}`);
          const sj = await sr.json().catch(() => ({}));
          if (sr.ok && sj && sj.success && sj.data && Array.isArray(sj.data.boxes)) {
            boxes = sj.data.boxes.map(b => ({
              boxNumber: b.boxNumber,
              trackingNumber: b.trackingNumber || null,
              carrier: b.carrier || '',
              trackingUrl: buildVendorTrackingUrl(b.carrier, b.trackingNumber),
              shipDate: b.shipmentDate ? String(b.shipmentDate).split('T')[0] : '',
              shippingMethod: b.shippingMethod || '',
              items: b.items || [],
            }));
            live = true;
          } else if (sj && sj.error) {
            error = sj.error;
          }
        } catch (e) {
          error = e.message;
        }
        // Fall back to the synced shipment rows when live OSN gave us nothing.
        if (!live && Array.isArray(o.shipments) && o.shipments.length) {
          boxes = o.shipments.filter(s => s.Tracking_Number).map((s, i) => ({
            boxNumber: i + 1,
            trackingNumber: s.Tracking_Number,
            carrier: s.Carrier || '',
            trackingUrl: buildVendorTrackingUrl(s.Carrier, s.Tracking_Number),
            shipDate: s.Ship_Date || '',
            shippingMethod: s.Ship_Method || '',
            items: [],
          }));
        }
      }
      const hasTracking = boxes.some(b => b.trackingNumber);
      const state = (hasTracking && (baseState === 'confirmed' || baseState === 'unknown')) ? 'shipped' : baseState;
      const shipped = ['shipped', 'partial', 'complete'].includes(state) || hasTracking;
      pos.push({
        po,
        salesOrder: o.SanMar_Sales_Order || '',
        status: o.SanMar_Status || '',
        state,
        shipped,
        estimatedDelivery: o.Estimated_Delivery || '',
        boxes,
        live,
        error,
      });
    }

    res.json({ woId, linked: true, pos });
  } catch (error) {
    console.error('[vendor-shipment] error:', error);
    res.status(500).json({ error: 'vendor-shipment failed', details: error.message });
  }
});

/**
 * POST /api/quote-sessions/bulk-sync-from-shopworks
 *
 * Sync ALL Processed quotes from the last 30 days. Used by the staff
 * dashboard "Sync all" button + the hourly cron job. Returns aggregate
 * stats: how many synced, imported, deleted, still pending.
 *
 * Body params (optional):
 *   - daysBack:    default 30, max 90
 *   - olderThanMin: default 30 (skip rows synced more recently than N min)
 *   - dryRun:      if true, returns the list of candidates without syncing
 */
/**
 * POST /api/quote-sessions/:quoteId/send-to-shipstation
 *
 * Push the quote's customer + line items to ShipStation. Idempotent — if the
 * order already exists (orderKey = quoteId), ShipStation updates instead of
 * duplicating.
 *
 * Response shapes:
 *   { success: true, shipstationOrderId: 12345, status: 'awaiting_shipment' }
 *   { success: true, alreadySent: true, shipstationOrderId: ... }
 *   { skipped: true, reason: 'pickup' }              // Customer Pickup orders
 *   { success: false, error: '...' }                 // 4xx/5xx pass-through
 */
app.post('/api/quote-sessions/:quoteId/send-to-shipstation', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);

    // 1. Fetch the quote
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    const session = sessions[0];
    const pkId = session.PK_ID;

    // 3. Parse the snapshot + original submission (same logic as /full).
    let originalSubmission = null;
    if (session.Notes) {
      try { originalSubmission = JSON.parse(session.Notes); } catch (_) { /* legacy plain-text */ }
    }
    let snapshot = null;
    if (session.ShopWorks_Snapshot) {
      try { snapshot = JSON.parse(session.ShopWorks_Snapshot); } catch (_) { /* ignore */ }
    }
    const order = snapshot?.order || null;
    const lineItems = snapshot?.lineItems || [];
    const pushedShip = (snapshot?.pushed?.ShippingAddresses || [])[0];
    const ship = pushedShip ? {
      method:    pushedShip.ShipMethod || '',
      address1:  pushedShip.ShipAddress01 || '',
      address2:  pushedShip.ShipAddress02 || '',
      city:      pushedShip.ShipCity || '',
      state:     pushedShip.ShipState || '',
      zip:       pushedShip.ShipZip || '',
      company:   pushedShip.ShipCompany || '',
      name:      pushedShip.ShipName || '',
    } : (originalSubmission?.ship || {});

    // 4. Skip ShipStation entirely for non-USPS orders. NWCA's workflow:
    //   - USPS (small packages, 2-3 shirts) → ShipStation
    //   - UPS (most orders) → WorldShip (desktop app, separate workflow)
    //   - Customer Pickup → no label needed
    //   - FedEx / Other → assume manual / WorldShip until configured
    //
    // BUT — the rep can override at send time by passing body.overrideShipMethod.
    // Example: customer picked "UPS Ground" but it's only 3 shirts — rep clicks
    // Send to ShipStation, modal opens, rep picks "Priority Mail", body has
    // overrideShipMethod="Priority Mail" → we use that instead and push.
    const origMethod = (ship.method || ship.methodLabel || '').toString();
    const overrideMethod = (req.body?.overrideShipMethod || '').toString().trim();
    const method = overrideMethod || origMethod;
    const methodLower = method.toLowerCase();
    const wasOverridden = !!overrideMethod && overrideMethod !== origMethod;

    if (methodLower.includes('pickup') || methodLower.includes('willcall')) {
      return res.json({ skipped: true, reason: 'pickup', message: 'Customer Pickup — no shipping label needed.' });
    }
    if (methodLower.startsWith('ups')) {
      return res.json({
        skipped: true,
        reason: 'ups-uses-worldship',
        message: 'UPS orders ship via WorldShip (desktop app), not ShipStation. To use ShipStation, override the method to a USPS service.',
        originalMethod: origMethod,
      });
    }
    if (methodLower.startsWith('fedex')) {
      return res.json({
        skipped: true,
        reason: 'fedex-not-configured',
        message: 'FedEx is not connected to ShipStation. Use the carrier\'s own shipping tool, or override to a USPS service.',
        originalMethod: origMethod,
      });
    }
    // Only continue for USPS / Priority Mail / unconfigured-but-supported methods

    // 4b. Already-sent check — idempotency at the Caspio layer. Runs AFTER
    // the routing skips so a stale ShipStation_Order_ID on a UPS order
    // (e.g., from before today's USPS-only routing) doesn't block the skip.
    if (session.ShipStation_Order_ID) {
      return res.json({
        success: true,
        alreadySent: true,
        shipstationOrderId: session.ShipStation_Order_ID,
        status: session.ShipStation_Status || 'awaiting_shipment',
        lastSynced: session.ShipStation_Last_Synced,
      });
    }

    // 5. Look up the carrier+service for our ship method.
    //
    // CRITICAL: ShipStation rejects createorder with HTTP 400 (empty body)
    // when carrierCode/serviceCode reference a carrier NOT configured in the
    // account. NWCA currently has only Stamps.com (USPS) connected; UPS and
    // FedEx require a separate "Add Carrier" step in ShipStation Settings.
    //
    // Strategy: only include carrierCode+serviceCode when the carrier is in
    // CONFIGURED_CARRIERS. Otherwise omit those fields entirely (order still
    // creates fine; warehouse picks at label-buy time) and use the freetext
    // `requestedShippingService` hint so the rep's preference still shows
    // in the ShipStation UI.
    const SHIP_METHOD_MAP = {
      'UPS Ground':       { carrier: 'ups',        service: 'ups_ground' },
      'UPS 2nd Day':      { carrier: 'ups',        service: 'ups_2nd_day_air' },
      'UPS Next Day':     { carrier: 'ups',        service: 'ups_next_day_air' },
      'Priority Mail':    { carrier: 'stamps_com', service: 'usps_priority_mail' },
      'USPS Priority':    { carrier: 'stamps_com', service: 'usps_priority_mail' },
      'USPS First Class': { carrier: 'stamps_com', service: 'usps_first_class_mail' },
      'USPS Ground':      { carrier: 'stamps_com', service: 'usps_ground_advantage' },
      'FedEx Ground':     { carrier: 'fedex',      service: 'fedex_ground' },
    };
    // TODO: replace with dynamic carrier list from ShipStation /carriers
    //       endpoint (cached 24h). For now, hardcoded to what NWCA has set up.
    const CONFIGURED_CARRIERS = new Set(['stamps_com']);
    const mapped = SHIP_METHOD_MAP[method] || { carrier: null, service: null };
    const useMapped = mapped.carrier && CONFIGURED_CARRIERS.has(mapped.carrier);

    // 6. Build the bill-to (CompanyContactsMerge2026 → originalSubmission fallback)
    //    Reuse the billingContact lookup pattern from /full — fetch one-shot here.
    let billingContact = null;
    const idCustomer = order?.id_Customer || originalSubmission?.info?.companyId || null;
    if (idCustomer) {
      try {
        const PROXY_BASE = CASPIO_PROXY_BASE;
        const resp = await fetch(`${PROXY_BASE}/api/company-contacts/by-customer/${encodeURIComponent(idCustomer)}`, { headers: withProxySecret() });
        if (resp.ok) {
          const data = await resp.json();
          const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
          const complete = contacts.find(c => c.Has_Complete_Address && c.Address);
          billingContact = complete || contacts.find(c => c.Address) || contacts[0] || null;
        }
      } catch (e) {
        console.warn(`[send-to-shipstation] billing-contact fetch failed:`, e.message);
      }
    }

    // 7. Build the items[] — collapse size-suffixed SKUs into grouped lines.
    //    For each base style+color, one ShipStation item with summarized
    //    size breakdown in options[]. After building, enrich each item
    //    with a product image URL so warehouse pickers see the actual
    //    garment+color combo in ShipStation's order view.
    const items = await buildShipStationItems(lineItems, originalSubmission);

    // 8. Compose the payload.
    //
    // orderNumber vs orderKey (Erik 2026-05-21):
    //   orderNumber = displayed in ShipStation UI as "Order #" → use WO#
    //                 when known so warehouse cross-references with ShopWorks
    //                 ("pull WO 141899") instead of our internal quote ID.
    //                 Falls back to quote ID until WO# is synced.
    //   orderKey = internal idempotency key → ALWAYS the quote ID so re-sends
    //              dedup correctly. Salted by retry-on-404 logic above when
    //              ShipStation ghosts a deleted-order key.
    const shopworksWoNum = session.ShopWorks_Order_Number || order?.id_Order;
    const displayOrderNumber = shopworksWoNum ? `WO ${shopworksWoNum}` : safeQuoteId;

    // Weight per item — REAL SanMar PIECE_WEIGHT when buildShipStationItems
    // attached it (via /api/inventory lookup), with a hardcoded prefix-based
    // fallback for SKUs SanMar doesn't recognize or where the lookup failed.
    // Sum × quantity = total order weight in oz for the ShipStation payload.
    const GARMENT_WEIGHTS_OZ_FALLBACK = {
      // Hoodies / sweatshirts
      'PC90': 24, 'PC78': 22, 'PC850': 22, 'F260': 26, 'F261': 26,
      '18000': 16, '8054': 30, 'ST253': 22, 'ST254': 22,
      // Long sleeves
      'PC54LS': 8, 'PC61LS': 8, 'PC55LS': 9, 'ST350LS': 9,
      // Standard adult tees
      'PC54': 5.5, 'PC61': 6, 'PC55': 6.5, '5000': 6, '3001': 5,
      'ST350': 5, 'ST450': 6, 'DT6000': 5,
      // Youth tees
      'PC54Y': 4, 'PC61Y': 4, 'PC55Y': 4, '5000B': 4,
      // Polos / Caps / Bags
      'K500': 8, 'K420': 9, 'K100': 8, 'K110': 8,
      'CP80': 3, 'C112': 4, 'STC10': 4, 'C932': 4,
      'BG': 8,
    };
    const estimateWeightOz = (it) => {
      const qty = Number(it.quantity) || 0;
      // Prefer real SanMar weight (PIECE_WEIGHT) attached during the
      // /api/inventory lookup in buildShipStationItems
      if (Number.isFinite(it._weightPerPieceOz) && it._weightPerPieceOz > 0) {
        return it._weightPerPieceOz * qty;
      }
      // Fallback — hardcoded prefix lookup. Longest-prefix wins so
      // "PC54LS" matches before "PC54". Default 6 oz per piece.
      const sku = String(it.sku || '');
      let oz = 6;
      let bestLen = 0;
      for (const prefix of Object.keys(GARMENT_WEIGHTS_OZ_FALLBACK)) {
        if (sku.startsWith(prefix) && prefix.length > bestLen) {
          oz = GARMENT_WEIGHTS_OZ_FALLBACK[prefix];
          bestLen = prefix.length;
        }
      }
      return oz * qty;
    };
    const totalWeightOz = items.reduce((s, it) => s + estimateWeightOz(it), 0);
    // Strip the internal _weightPerPieceOz tracker so it doesn't leak to
    // ShipStation's item payload (which would silently ignore unknown keys
    // but we keep it clean for log readability).
    items.forEach(it => { delete it._weightPerPieceOz; });

    const payload = {
      orderNumber: displayOrderNumber,    // "WO 141899" or fallback "OF-0048"
      orderKey:    safeQuoteId,           // idempotency — always quote ID
      orderDate:   (originalSubmission?.info?.dateIn || new Date().toISOString().split('T')[0]) + 'T00:00:00.000Z',
      orderStatus: 'awaiting_shipment',
      customerEmail:    order?.ContactEmail || originalSubmission?.info?.email || session.CustomerEmail || '',
      customerUsername: order?.CustomerName || session.CompanyName || originalSubmission?.info?.company || '',

      billTo: {
        name:       billingContact?.ct_NameFull || [billingContact?.NameFirst, billingContact?.NameLast].filter(Boolean).join(' ') || originalSubmission?.info?.name || session.CustomerName || '',
        company:    billingContact?.Company_Name || originalSubmission?.info?.company || session.CompanyName || '',
        street1:    billingContact?.Address || originalSubmission?.info?.address || '',
        street2:    billingContact?.Address2 || '',
        city:       billingContact?.City || originalSubmission?.info?.city || '',
        state:      billingContact?.State || originalSubmission?.info?.state || '',
        postalCode: billingContact?.Zip || originalSubmission?.info?.zip || '',
        country:    'US',
        phone:      billingContact?.Phone_Best || billingContact?.Company_Phone || session.Phone || '',
      },

      shipTo: (function buildShipTo() {
        // NWCA ship convention: ShipAddress01 = recipient name, ShipAddress02 = street.
        // ShipStation V1 REQUIRES shipTo.name AND shipTo.street1 — both must
        // be non-empty or POST /orders/createorder returns 400.
        const a1 = ship.address1 || '';
        const a2 = ship.address2 || '';
        // Heuristic: when only ONE field is set we don't know if it's a name or
        // a street. Use a digit-count rule — addresses usually start with a number.
        const a1HasDigits = /\d/.test(a1);
        const a2HasDigits = /\d/.test(a2);
        const recipient =
          ship.name ||
          (a1 && !a1HasDigits ? a1 : '') ||    // a1 looks like a name (no digits)
          (a2 && !a2HasDigits ? a2 : '') ||    // a2 looks like a name
          originalSubmission?.info?.name ||
          [originalSubmission?.info?.buyerFirst, originalSubmission?.info?.buyerLast].filter(Boolean).join(' ') ||
          ship.company ||
          session.CompanyName ||
          'Receiving';                          // last-resort non-empty
        const street =
          (a2 && a2HasDigits ? a2 : '') ||      // prefer the field that has digits
          (a1 && a1HasDigits ? a1 : '') ||
          originalSubmission?.info?.shipAddress ||
          a1 || a2 ||                            // fall through to whatever's set
          'Address on file';                     // last-resort non-empty
        const recipientCompany = ship.company || originalSubmission?.info?.company || session.CompanyName || '';
        return {
          name:       recipient,
          company:    recipientCompany,
          street1:    street,
          street2:    '',
          city:       ship.city || originalSubmission?.info?.shipCity || '',
          state:      ship.state || originalSubmission?.info?.shipState || '',
          postalCode: ship.zip || originalSubmission?.info?.shipZip || '',
          country:    'US',
          phone:      session.Phone || billingContact?.Phone_Best || '',
          residential: false,
        };
      })(),

      items,

      // TotalAmount is pre-tax (2026-06-12); add TaxAmount for the grand total
      // when no ShopWorks invoice exists yet. Old rows have TaxAmount 0/null →
      // (TotalAmount + 0) preserves their tax-inclusive value. Backward-compatible.
      amountPaid:    Number(order?.cur_TotalInvoice) || (Number(session.TotalAmount) + (Number(session.TaxAmount) || 0)) || 0,
      taxAmount:     Number(order?.cur_SalesTaxTotal) || 0,
      shippingAmount: 0,  // warehouse sets actual at label-purchase time

      customerNotes: originalSubmission?.info?.orderNotes || '',
      internalNotes: [
        session.ShopWorks_Order_Number ? `WO ${session.ShopWorks_Order_Number}` : '',
        `Sales rep: ${order?.CustomerServiceRep || session.SalesRepName || 'unknown'}`,
        `Quote: ${safeQuoteId}`,
        // Surface the override so warehouse picker sees the rep intentionally
        // re-routed (e.g., "customer originally chose UPS Ground but rep
        // selected Priority Mail for this small package").
        wasOverridden ? `Ship method overridden: ${origMethod} → ${method}` : '',
      ].filter(Boolean).join(' · '),

      // Carrier preset: only when the carrier is actually configured in
      // ShipStation. Otherwise just record the rep's preference as a hint
      // so warehouse staff see "UPS Ground" in the requested-service field
      // even though they'll pick at rate time.
      ...(useMapped ? { carrierCode: mapped.carrier, serviceCode: mapped.service } : {}),
      requestedShippingService: method || undefined,

      // Estimated total weight in ounces — saves the warehouse from
      // weighing before rate-shopping. Approximate per-garment weights;
      // warehouse can override in ShipStation UI at label-buy time.
      ...(totalWeightOz > 0 ? { weight: { value: Math.round(totalWeightOz), units: 'ounces' } } : {}),

      // Custom fields — surface in ShipStation's order detail under "Notes".
      // Warehouse picker uses these to know what they're packing/shipping.
      advancedOptions: {
        customField1: (function () {
          // Decoration method + locations (extract first line from methodNotesBlock).
          // For OF-0048 this looks like: "DTG · Left Chest + Full Back · Tier 24-47..."
          const methodNote = originalSubmission?.info?.methodNotesBlock
            || originalSubmission?.methodNotesBlock
            || '';
          const firstFew = String(methodNote).split(' · ').slice(0, 2).join(' · ');
          return firstFew || 'Custom Decoration';
        })(),
        customField2: (function () {
          // Design # — from ShopWorks order if synced, else from originalSubmission.designNumbers
          const designId = order?.id_Design ||
            (Array.isArray(originalSubmission?.designNumbers) && originalSubmission.designNumbers[0]) ||
            '';
          return designId ? `Design # ${designId}` : '';
        })(),
        customField3: originalSubmission?.info?.isRush ? '🚨 RUSH' : '',
      },
    };

    // 9. POST to proxy
    const PROXY_BASE = CASPIO_PROXY_BASE;
    let proxyResp = await fetch(`${PROXY_BASE}/api/shipstation/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
      body: JSON.stringify(payload),
    });
    let result = await proxyResp.json().catch(() => ({}));

    // Retry-on-404: ShipStation returns 404 if the orderKey was previously
    // associated with a deleted order (they reserve the key forever).
    // Salt the orderKey with a millisecond timestamp and retry once.
    if (proxyResp.status === 404 && !payload._retried) {
      console.warn(`[send-to-shipstation] 404 on orderKey '${payload.orderKey}' — likely deleted-order ghost. Retrying with salted orderKey.`);
      payload.orderKey = `${payload.orderKey}-r${Date.now()}`;
      payload._retried = true;
      proxyResp = await fetch(`${PROXY_BASE}/api/shipstation/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
        body: JSON.stringify(payload),
      });
      result = await proxyResp.json().catch(() => ({}));
    }

    if (!proxyResp.ok || !result.success) {
      console.error(`[send-to-shipstation] proxy returned ${proxyResp.status}:`, result);
      return res.status(proxyResp.status || 502).json({
        success: false,
        error: result.error || 'ShipStation push failed',
        details: result.details || null,
      });
    }

    // 10. Write back to Caspio
    const nowIso = new Date().toISOString();
    try {
      await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
        ShipStation_Order_ID:     result.shipstationOrderId,
        ShipStation_Status:       result.orderStatus || 'awaiting_shipment',
        ShipStation_Last_Synced:  nowIso,
      });
    } catch (e) {
      console.warn(`[send-to-shipstation] Caspio PUT failed (order is in ShipStation, but Caspio out of sync):`, e.message);
    }

    return res.json({
      success: true,
      shipstationOrderId: result.shipstationOrderId,
      status: result.orderStatus || 'awaiting_shipment',
      lastSynced: nowIso,
    });

  } catch (error) {
    console.error('[send-to-shipstation] unexpected error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Look up product metadata from SanMar bulk catalog — image URL + per-piece
 * weight in ounces. Used by the ShipStation push to enrich line items.
 *
 * SanMar's PIECE_WEIGHT field is in POUNDS per piece (e.g. 1.48 for PC90H
 * hoodie). We convert to ounces here so the consumer just multiplies by qty.
 *
 * Returns { imageUrl, weightOz } — either may be null if the lookup fails
 * or the field isn't populated. Caller falls back to defaults.
 *
 * Module-level cache (TTL 24h) keeps repeat lookups for the same style+color
 * fast and reduces proxy load. NWCA has ~200 active SKUs; cache stays small.
 */
const PRODUCT_META_CACHE = new Map();
const PRODUCT_META_TTL_MS = 24 * 60 * 60 * 1000;

async function lookupProductMeta(styleNumber, color) {
  if (!styleNumber) return { imageUrl: null, weightOz: null };
  const key = `${styleNumber}|${color || ''}`.toLowerCase();
  const cached = PRODUCT_META_CACHE.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return { imageUrl: cached.imageUrl, weightOz: cached.weightOz };
  }

  try {
    const PROXY = CASPIO_PROXY_BASE;
    const url = `${PROXY}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color || '')}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      PRODUCT_META_CACHE.set(key, { imageUrl: null, weightOz: null, expiresAt: Date.now() + 60_000 });
      return { imageUrl: null, weightOz: null };
    }
    const data = await resp.json();
    const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!first) {
      PRODUCT_META_CACHE.set(key, { imageUrl: null, weightOz: null, expiresAt: Date.now() + 60_000 });
      return { imageUrl: null, weightOz: null };
    }
    // Image: prefer color-specific model shot for visual confirmation
    const imageUrl = first.COLOR_PRODUCT_IMAGE || first.PRODUCT_IMAGE || first.THUMBNAIL_IMAGE || null;
    // Weight: PIECE_WEIGHT is SanMar's pounds-per-piece field. Convert to oz.
    // Sanity: bound between 0 and 200 oz (12.5 lbs — heaviest garment we'd ship)
    // to catch bad data without crashing.
    const lbs = Number(first.PIECE_WEIGHT);
    const weightOz = (Number.isFinite(lbs) && lbs > 0 && lbs < 12.5) ? lbs * 16 : null;

    PRODUCT_META_CACHE.set(key, { imageUrl, weightOz, expiresAt: Date.now() + PRODUCT_META_TTL_MS });
    return { imageUrl, weightOz };
  } catch (e) {
    console.warn(`[lookupProductMeta] failed for ${styleNumber}/${color}:`, e.message);
    return { imageUrl: null, weightOz: null };
  }
}

/**
 * Build the ShipStation items[] array from snapshot.lineItems[] (post-import)
 * or originalSubmission.rows[] (pre-import).
 *
 * Collapses size-suffixed SKUs back into one product per (PartNumber+Color),
 * with a "Sizes: S:1, M:1, L:1, XL:1, 2XL:2..." string in options[]. Also
 * enriches each item with imageUrl (color-specific garment shot) so the
 * warehouse picker visually verifies the right product.
 *
 * This is the server-side mirror of the client-side groupLineItemsByBaseSku
 * in pages/js/invoice.js — keeps the ShipStation order looking like 3 logical
 * products instead of 8 size-suffix line items.
 */
async function buildShipStationItems(lineItems, originalSubmission) {
  const out = [];
  const SUFFIX_RE = /_([0-9]+XL?|XS|XXS|YXS|YS|YM|YL|YXL)$/i;

  // Prefer ShopWorks lineItems if present (post-import). They're authoritative.
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const byBase = new Map();   // baseStyle|color → { name, qty, sizes:[], unitPrice, base }
    lineItems.forEach(li => {
      const style = String(li.PartNumber || '').trim();
      const m = style.match(SUFFIX_RE);
      const baseStyle = m ? style.slice(0, m.index) : style;
      const color = String(li.PartColor || '').trim();
      const key = baseStyle + '|' + color;

      const qty = Number(li.LineQuantity) || 0;
      const unitPrice = Number(li.LineUnitPrice) || 0;
      const sizeLabel = m
        ? m[1].toUpperCase().replace(/^([2-6]X)$/, '$1L')
        : (function () {
            // Base SKU — read Size01-06 columns
            const labels = ['S','M','L','XL','2XL','3XL'];
            const sizes = [];
            for (let i = 1; i <= 6; i++) {
              const q = Number(li['Size0' + i]);
              if (q > 0) sizes.push(`${labels[i-1]}:${q}`);
            }
            return sizes.join(', ') || 'OSFA';
          })();

      if (!byBase.has(key)) {
        byBase.set(key, {
          sku:      baseStyle,
          name:     li.PartDescription || baseStyle,
          color,
          qty:      0,
          unitPrice,        // first-seen price; weighted-average could be computed but blended is fine for SS
          sizeChunks: [],
        });
      }
      const bucket = byBase.get(key);
      bucket.qty += qty;
      bucket.sizeChunks.push(sizeLabel + (m ? `:${qty}` : ''));
    });
    for (const v of byBase.values()) {
      out.push({
        sku:       v.sku,
        name:      v.name,
        quantity:  v.qty,
        unitPrice: v.unitPrice,
        options: [
          v.color  ? { name: 'Color', value: v.color } : null,
          v.sizeChunks.length ? { name: 'Sizes', value: v.sizeChunks.join(', ') } : null,
        ].filter(Boolean),
        _colorForImage: v.color,    // internal — stripped after image lookup
      });
    }
  } else {
    // Fallback — originalSubmission rows (pre-import orders).
    const rows = originalSubmission?.rows || [];
    rows.forEach(r => {
      const sizes = r.sizes || {};
      const totalQty = Object.values(sizes).reduce((s, n) => s + (Number(n) || 0), 0) || Number(r.qty) || 0;
      if (!totalQty) return;
      const sizeChunks = Object.keys(sizes).filter(k => Number(sizes[k]) > 0).map(k => `${k.toUpperCase()}:${sizes[k]}`);
      const color = r.color || r.colorName || '';
      // For image lookup we want CATALOG_COLOR (e.g. "BrillOrng") when set,
      // since that's what the inventory endpoint expects. Fall back to
      // display color name if catalogColor isn't on the row.
      const catalogColor = r.catalogColor || color;
      out.push({
        sku:       r.style || r.styleNumber || 'MISC',
        name:      r.desc || r.description || (r.style || 'Custom item'),
        quantity:  totalQty,
        unitPrice: Number(r.unitPrice) || Number(r.price) || 0,
        options: [
          color ? { name: 'Color', value: color } : null,
          sizeChunks.length ? { name: 'Sizes', value: sizeChunks.join(', ') } : null,
        ].filter(Boolean),
        _colorForImage: catalogColor,
      });
    });
  }

  // Enrich every item with product metadata (image URL + per-piece weight)
  // from SanMar bulk catalog. Done in parallel. Warehouse pickers see the
  // actual garment in ShipStation's order view; payload includes accurate
  // weight from SanMar's authoritative PIECE_WEIGHT field. Best-effort —
  // missing fields don't block the push (the caller has a fallback weight
  // table for SKUs SanMar doesn't recognize).
  await Promise.all(out.map(async (item) => {
    const meta = await lookupProductMeta(item.sku, item._colorForImage);
    if (meta.imageUrl) item.imageUrl = meta.imageUrl;
    if (meta.weightOz) item._weightPerPieceOz = meta.weightOz;  // consumed by caller, stripped before send
    delete item._colorForImage;
  }));

  return out;
}

// ── "Your order shipped" email (Erik 2026-06-10) ───────────────────────────
// Fires from the shipstation-tracking endpoint below — the single chokepoint
// where tracking lands (SHIP_NOTIFY webhook AND the hourly backfill cron both
// write through it). Storefront orders only (orderSettings.channel
// 'custom-tees' / '3-day-tees'): rep-managed quotes keep their human touch.
// Dedup via orderSettings.shipEmailSentAt (backfill re-running can't double-
// send). Fail-soft like the confirmation emails — never breaks the tracking
// write.
function trackingLinkFor(carrier, trackingNumber, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  const c = String(carrier || '').toLowerCase();
  const n = encodeURIComponent(trackingNumber || '');
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.includes('usps') || c.includes('stamps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  return `https://www.google.com/search?q=${n}`;
}

async function sendOrderShippedEmail(quoteSession, payload) {
  try {
    if (!process.env.EMAILJS_PRIVATE_KEY || !process.env.EMAILJS_PUBLIC_KEY) return;
    if (!payload.trackingNumber) return;
    const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
    const os = parse(quoteSession.OrderSettingsJSON);
    // EXACT registry lookup (not the default-to-3DT resolver): rep-managed
    // quotes and unregistered channels must stay silently excluded, exactly
    // like the old hardcoded 'custom-tees'/'3-day-tees' whitelist. A new
    // storefront channel gets this email by registering with
    // emails.shippedEnabled: true — no hidden list to forget.
    const shipChCfg = channelConfigExact(os.channel);
    if (!shipChCfg || !shipChCfg.emails.shippedEnabled) return;
    if (os.shipEmailSentAt) return; // already notified
    const customerData = parse(quoteSession.CustomerDataJSON);
    const email = customerData.email || quoteSession.CustomerEmail;
    if (!email) return;

    const statusUrl = os.statusToken ? buildOrderStatusUrl(quoteSession.QuoteID, os.statusToken) : '';
    const carrier = payload.trackingCarrier || 'UPS';
    const name = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()
      || quoteSession.CustomerName || 'there';
    const sent = await sendEmailJSTemplate(shipChCfg.emails.shippedTemplate, {
      to_email: email,
      to_name: escapeHTMLSrv(name),
      order_number: escapeHTMLSrv(quoteSession.QuoteID),
      customer_name: escapeHTMLSrv(name),
      carrier: escapeHTMLSrv(carrier.toUpperCase()),
      tracking_number: escapeHTMLSrv(payload.trackingNumber),
      tracking_url: trackingLinkFor(carrier, payload.trackingNumber, payload.trackingUrl),
      order_status_url: statusUrl,
      style_name: escapeHTMLSrv(os.styleName || ''),
      company_phone: '253-922-5793',
      reply_to: 'sales@nwcustomapparel.com',
    });
    if (!sent) return; // logged inside the helper; backfill cron will NOT retry
                       // (no stamp) only if a later tracking write happens — fine.

    // Stamp the dedup marker, preserving every existing key.
    const merged = Object.assign({}, os, { shipEmailSentAt: new Date().toISOString() });
    await makeApiRequest(`/quote_sessions/${quoteSession.PK_ID}`, 'PUT', {
      OrderSettingsJSON: JSON.stringify(merged),
    });
    console.log(`[shipped-email] ✓ ${quoteSession.QuoteID} → ${email} (${payload.trackingNumber})`);
  } catch (e) {
    console.error('[shipped-email] failed (tracking write unaffected):', e.message);
  }
}

/**
 * POST /api/quote-sessions/:quoteId/shipstation-tracking
 *
 * Called BY the proxy webhook handler when ShipStation reports a label was
 * bought. Writes tracking fields to Caspio quote_sessions by QuoteID.
 *
 * Body: { quoteId, trackingNumber, trackingCarrier, trackingUrl, shippedAt,
 *         labelCost, shipstationOrderId, shipstationStatus }
 *
 * No auth required currently — proxy is the only caller. Future hardening:
 * add a shared secret or restrict by source IP.
 */
app.post('/api/quote-sessions/:quoteId/shipstation-tracking', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const payload = req.body || {};

    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      console.warn(`[shipstation-tracking] no quote found for ${safeQuoteId}`);
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    const pkId = sessions[0].PK_ID;

    const updates = {
      TrackingNumber:     payload.trackingNumber || null,
      TrackingCarrier:    payload.trackingCarrier || null,
      TrackingURL:        payload.trackingUrl || null,
      ShippedAt:          payload.shippedAt || new Date().toISOString(),
      LabelCost:          Number(payload.labelCost) || null,
      ShipStation_Status: payload.shipstationStatus || 'shipped',
      ShipStation_Last_Synced: new Date().toISOString(),
    };

    // Strip nulls so we don't blow away existing values with empty writes.
    for (const k of Object.keys(updates)) {
      if (updates[k] == null || updates[k] === '') delete updates[k];
    }

    await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', updates);
    console.log(`[shipstation-tracking] ✓ ${safeQuoteId} → tracking ${payload.trackingNumber} (${payload.trackingCarrier})`);

    // Fire-and-forget "your order shipped" email for storefront orders —
    // never blocks or fails the tracking write.
    sendOrderShippedEmail(sessions[0], payload);

    return res.json({ success: true, updated: Object.keys(updates) });
  } catch (error) {
    console.error('[shipstation-tracking] error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/quote-sessions/bulk-sync-from-shopworks', async (req, res) => {
  const startedAt = Date.now();
  try {
    const daysBack = Math.min(Math.max(Number(req.body?.daysBack) || 30, 1), 90);
    const olderThanMin = Math.max(Number(req.body?.olderThanMin) || 30, 5);
    const dryRun = req.body?.dryRun === true || req.query?.dryRun === '1';

    // Pull processed quote_sessions rows. Caspio's filter syntax doesn't
    // cleanly support date-range comparisons via this proxy path, so we
    // pull all Processed rows + filter by date client-side. There are
    // typically <500 Processed quotes total at any time.
    //
    // ⚠️ 2026-07-26: this used to send `?q.where=...&q.pageSize=1000`, and the
    // comment here claimed the proxy honoured q.where. IT NEVER DID — the proxy's
    // GET /api/quote_sessions only reads named params, so q.where was silently
    // dropped and every hourly run fell through to a full, uncached, UNORDERED
    // scan of Quote_Sessions (up to 20 pages, silently truncating at the cap).
    // Use the named `syncCandidates=true` filter, which encodes the exact
    // predicate below server-side and is cacheable.
    //
    // Cron pickup criteria (2026-05-23): we sync rows that are EITHER
    //   • Status='Processed' (DTG OF flow) OR
    //   • PushedToShopWorks IS NOT NULL (EMB/SCP/DTF push-handler flow)
    // The two builders use different dedup conventions — DTG OF flips Status
    // to 'Processed' after push; EMB/DTF/SCP push handlers in the proxy set
    // a PushedToShopWorks timestamp but leave Status='Open'. Without this
    // OR clause, EMB/SCP/DTF orders never get their ShopWorks snapshot
    // synced back, which means /invoice/EMB-XXXX shows pre-import data only
    // and Send-to-ShipStation has incomplete info.
    // Cancelled rows are excluded at the source (2026-07-18): a cancelled
    // EMB/SCP/DTF quote still matches `PushedToShopWorks IS NOT NULL`, and
    // re-syncing it every hour re-stamped ShopWorks_Last_Synced — which reset
    // its 30-day purge countdown daily (quote-management's "Purges in N days"
    // counts from Last_Synced). The purge pass below still handles them.
    let sessions;
    try {
      sessions = await makeApiRequest('/quote_sessions?syncCandidates=true');
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Caspio fetch failed', details: e.message });
    }
    if (!Array.isArray(sessions)) sessions = [];

    // Filter to last N days (by CreatedAt_Quote OR fall back to no-date)
    const sinceMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const inWindow = sessions.filter(s => {
      const created = s.CreatedAt_Quote || s.CreatedAt;
      if (!created) return true; // include rows without a created date
      const t = Date.parse(created);
      if (!Number.isFinite(t)) return true;
      return t >= sinceMs;
    });

    // Filter to ones that are stale (Last_Synced > olderThanMin OR never synced).
    // Use parseCaspioPacificMs because Caspio returns naive Pacific timestamps —
    // raw Date.parse on a UTC server (Heroku) shifts ~7-8 h and would incorrectly
    // mark fresh syncs as stale (or vice versa).
    const staleThresholdMs = olderThanMin * 60 * 1000;
    const now = Date.now();

    // Age-based backoff (2026-07-18 Caspio quota reduction): quotes <7 days
    // old sync on every hourly run — that cadence is what detects ShopWorks-
    // side deletions and fires the ShipStation cancel-cascade for ACTIVE
    // orders. Older quotes (7-30d) sync only on the 0/6/12/18 UTC runs
    // (4×/day). Keyed on CreatedAt_Quote, NOT ShopWorks_Last_Synced — every
    // sync branch re-stamps Last_Synced, so it can never age. The dashboard's
    // manual button passes { full: true } to bypass the backoff entirely.
    const fullSync = req.body?.full === true;
    const BACKOFF_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const isBackoffHour = new Date().getUTCHours() % 6 === 0;

    const candidates = inWindow.filter(s => {
      if (!fullSync && !isBackoffHour) {
        const created = s.CreatedAt_Quote || s.CreatedAt;
        const t = created ? Date.parse(created) : NaN;
        // Unknown age → treat as recent (sync hourly — the safe default).
        if (Number.isFinite(t) && (now - t) > BACKOFF_AGE_MS) return false;
      }
      if (!s.ShopWorks_Last_Synced) return true;
      const lastSynced = parseCaspioPacificMs(s.ShopWorks_Last_Synced);
      if (!Number.isFinite(lastSynced)) return true;
      return (now - lastSynced) > staleThresholdMs;
    });

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        totalProcessedInWindow: inWindow.length,
        totalProcessedAllTime: sessions.length,
        candidates: candidates.slice(0, 20).map(s => ({
          quoteId: s.QuoteID,
          customer: s.CustomerName,
          lastSynced: s.ShopWorks_Last_Synced,
          status: s.ShopWorks_Status,
        })),
      });
    }

    // Sync each candidate sequentially with a 1s throttle (MO rate limits).
    const stats = { synced: 0, imported: 0, deleted: 0, pending: 0, errors: 0, errorDetails: [] };
    for (const s of candidates) {
      try {
        const r = await fetch(`http://localhost:${process.env.PORT || 3000}/api/quote-sessions/${encodeURIComponent(s.QuoteID)}/sync-from-shopworks`, {
          method: 'POST',
          // x-forwarded-proto marks this as an already-secure internal call so
          // the force-HTTPS middleware never 302s it to https://localhost
          // (the loopback bypass also covers this; belt-and-suspenders). 2026-06-15
          headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' },
          body: JSON.stringify({}),
        });
        const data = await r.json().catch(() => ({}));
        if (data.success && data.synced) {
          stats.synced++;
          if (data.deleted) stats.deleted++;
          else if (data.status === 'Imported') stats.imported++;
          else stats.pending++;
        } else {
          stats.errors++;
          stats.errorDetails.push({ quoteId: s.QuoteID, error: data.error || 'unknown' });
        }
      } catch (e) {
        stats.errors++;
        stats.errorDetails.push({ quoteId: s.QuoteID, error: e.message });
      }
      // Throttle to avoid hammering MO API.
      await new Promise(r => setTimeout(r, 1000));
    }

    // --- 30-day purge pass for soft-deleted rows -------------------------
    // Hard-purges quote_sessions rows where Status='Cancelled_in_ShopWorks'
    // AND ShopWorks_Last_Synced > 30 days ago. Audit-trail retention is
    // 30 days from the deletion-detection timestamp. (Erik 2026-05-21)
    const PURGE_RETENTION_DAYS = SOFT_DELETE_RETENTION_DAYS;
    const purgeStats = { purged: 0, purgeErrors: 0 };
    // Purge pass runs once daily (the 6 UTC run) instead of hourly — deletes
    // become due on a 30-DAY clock, so hourly checks were pure Caspio burn.
    // Manual { full: true } runs still purge so the dashboard button behaves
    // exactly as before.
    const runPurgePass = fullSync || new Date().getUTCHours() === 6;
    if (!dryRun && runPurgePass) {
      try {
        // Named filter, not q.where — the proxy silently ignored q.where here too
        // (see the bulk-sync note above) and now rejects it outright.
        const cancelled = await makeApiRequest('/quote_sessions?cancelledInShopWorks=true');
        if (Array.isArray(cancelled) && cancelled.length > 0) {
          const purgeBeforeMs = Date.now() - PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
          const purgeList = cancelled.filter(s => {
            // parseCaspioPacificMs — Caspio returns naive Pacific timestamps;
            // raw Date.parse would resolve them as UTC on Heroku, purging
            // ~7-8 h late (or early near DST transitions).
            const ts = s.ShopWorks_Last_Synced ? parseCaspioPacificMs(s.ShopWorks_Last_Synced) : 0;
            return Number.isFinite(ts) && ts > 0 && ts < purgeBeforeMs;
          });
          for (const s of purgeList) {
            try {
              // Delete child quote_items first (best-effort).
              const items = await makeApiRequest(`/quote_items?filter=QuoteID='${s.QuoteID}'`);
              if (Array.isArray(items)) {
                for (const it of items) {
                  if (it.PK_ID) {
                    await makeApiRequest(`/quote_items/${it.PK_ID}`, 'DELETE').catch(() => {});
                  }
                }
              }
              await makeApiRequest(`/quote_sessions/${s.PK_ID}`, 'DELETE');
              console.log(`[bulk-sync] 🗑️ PURGED ${s.QuoteID} (cancelled ${PURGE_RETENTION_DAYS}+ days ago)`);
              purgeStats.purged++;
            } catch (e) {
              console.warn(`[bulk-sync] purge failed for ${s.QuoteID}:`, e.message);
              purgeStats.purgeErrors++;
            }
          }
        }
      } catch (e) {
        console.warn('[bulk-sync] purge pass skipped (fetch failed):', e.message);
      }
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[bulk-sync] ${stats.synced} synced (${stats.imported} imported, ${stats.deleted} soft-deleted, ${stats.pending} pending, ${stats.errors} errors, ${purgeStats.purged} purged) in ${elapsedSec}s`);
    // Watchdog (2026-06-15): record this run so the proxy's hourly
    // check-quote-sync-health.js cron can detect the sync silently failing —
    // e.g. the localhost-self-call ECONNREFUSED regression that returned
    // synced:0/errors:N every hour. See GET/POST /api/quote-sync-health below.
    recordQuoteSyncRun(stats, candidates.length);
    res.json({ success: true, ...stats, ...purgeStats, elapsedSec, candidateCount: candidates.length, totalProcessedInWindow: inWindow.length });
  } catch (error) {
    console.error('[bulk-sync] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Bulk sync failed', details: error.message });
  }
});

// ============================================================================
// QUOTE-SYNC FRESHNESS WATCHDOG (2026-06-15)
//
// Catches the failure class that hid the ManageOrders sync-back outage for
// weeks: the hourly cron FIRED but its work no-op'd (the localhost self-call
// was 302'd to https://localhost → ECONNREFUSED → synced:0/errors:N every run,
// exit 0, no alarm). Mirrors the proxy's supacolor-health watchdog: an
// in-process record of the last bulk-sync run + a health endpoint the proxy's
// `check-quote-sync-health.js` Heroku Scheduler cron polls; on unhealthy it
// fires a deduped Slack alert.
//
// In-process state (resets to coldStart on dyno cycle, like supacolor). The
// hourly bulk-sync repopulates it within the hour.
let lastQuoteSyncAtMs = 0;
let lastQuoteSyncResult = null;

function recordQuoteSyncRun(stats, candidateCount) {
  lastQuoteSyncAtMs = Date.now();
  lastQuoteSyncResult = {
    synced: Number(stats.synced) || 0,
    imported: Number(stats.imported) || 0,
    deleted: Number(stats.deleted) || 0,
    pending: Number(stats.pending) || 0,
    errors: Number(stats.errors) || 0,
    candidateCount: Number(candidateCount) || 0,
  };
}

// Cron runs hourly; >90 min since the last successful bulk-sync = ~1.5 missed
// runs = the trigger stopped. uptime guard catches "cron never scheduled at
// all" (coldStart that never clears) once the dyno has been up long enough
// that a sync SHOULD have happened.
const QUOTE_SYNC_STALE_AFTER_MIN = 90;
const QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN = 150;

function computeQuoteSyncHealth() {
  const now = Date.now();
  const coldStart = !lastQuoteSyncAtMs;
  const lastSyncAgoMin = coldStart ? null : Math.round((now - lastQuoteSyncAtMs) / 60000);
  const uptimeMin = Math.round(process.uptime() / 60);
  const r = lastQuoteSyncResult || {};

  const reasons = [];
  // Never synced since boot, yet the dyno has been up long enough that the
  // hourly cron should have run — the Scheduler job is missing/disabled.
  if (coldStart && uptimeMin >= QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN) reasons.push('no-sync-since-boot');
  // Cron ran before but has gone quiet.
  if (!coldStart && lastSyncAgoMin >= QUOTE_SYNC_STALE_AFTER_MIN) reasons.push('stale-cron');
  // Cron ran but threw on rows (the ECONNREFUSED regression signature).
  if (!coldStart && Number(r.errors) > 0) reasons.push('sync-errors');
  // Cron ran, had work to do, but synced nothing (also the regression signature).
  if (!coldStart && Number(r.candidateCount) > 0 && Number(r.synced) === 0) reasons.push('sync-noop');

  const reason = reasons.length ? reasons.join('+') : null;
  return {
    ok: !reason,
    reason,
    coldStart,
    uptimeMin,
    lastSyncAgo_min: lastSyncAgoMin,
    lastSyncResult: lastQuoteSyncResult,
    thresholds: { staleAfterMin: QUOTE_SYNC_STALE_AFTER_MIN, noBootSyncAfterMin: QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN },
  };
}

// Deduped, fire-and-forget Slack notify (same shape as the proxy's
// slack-supacolor-health-notify.js: 4-hour dedup per reason; unset webhook =
// silent no-op so the watchdog can ship before the Slack channel exists).
const SLACK_QUOTE_SYNC_HEALTH_WEBHOOK = process.env.SLACK_QUOTE_SYNC_HEALTH_WEBHOOK_URL || '';
const QUOTE_SYNC_HEALTH_DEDUP_TTL_MS = 4 * 60 * 60 * 1000;
const _quoteSyncHealthDedup = new Map();

async function notifyQuoteSyncHealth(health) {
  if (!SLACK_QUOTE_SYNC_HEALTH_WEBHOOK) return { sent: false, skipped: 'no-webhook' };
  const key = `quote-sync-health|${health.reason || 'unknown'}`;
  const now = Date.now();
  const expiresAt = _quoteSyncHealthDedup.get(key);
  if (expiresAt && expiresAt > now) return { sent: false, skipped: 'dedup' };
  _quoteSyncHealthDedup.set(key, now + QUOTE_SYNC_HEALTH_DEDUP_TTL_MS);

  const r = health.lastSyncResult || {};
  const lastRun = health.coldStart
    ? `never since boot (${health.uptimeMin}m uptime)`
    : `${health.lastSyncAgo_min}m ago — synced:${r.synced} imported:${r.imported} errors:${r.errors} candidates:${r.candidateCount}`;
  const text = [
    `🚨 *Quote→ShopWorks sync unhealthy*`,
    `*Reason:* ${health.reason}`,
    `*Last bulk-sync:* ${lastRun}`,
    `\n<https://www.teamnwca.com/dashboards/quote-management.html|Open Quote Management> · check \`heroku logs --app sanmar-inventory-app | grep bulk-sync\``,
  ].join('\n');

  try {
    const resp = await fetch(SLACK_QUOTE_SYNC_HEALTH_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return { sent: true };
  } catch (err) {
    _quoteSyncHealthDedup.delete(key); // let the next poll retry
    return { sent: false, error: err.message };
  }
}

/**
 * GET  /api/quote-sync-health        — read-only health snapshot
 * POST /api/quote-sync-health/alert  — same, plus fires a deduped Slack alert
 *                                      when unhealthy (the cron hits this one)
 *
 * Top-level path (not under /api/quote-sessions/) to avoid colliding with the
 * /api/quote-sessions/:quoteId/* routes.
 */
app.get('/api/quote-sync-health', (req, res) => {
  res.json({ success: true, ...computeQuoteSyncHealth() });
});

app.post('/api/quote-sync-health/alert', async (req, res) => {
  const health = computeQuoteSyncHealth();
  let notify = { sent: false, skipped: 'healthy' };
  if (!health.ok) {
    notify = await notifyQuoteSyncHealth(health).catch(err => ({ sent: false, error: err.message }));
  }
  res.json({ success: true, ...health, notify });
});

/**
 * POST /api/quote-sessions/bulk-sync-shipstation-tracking
 *
 * Fallback safety net — called hourly by the proxy's
 * sync-shipstation-tracking.js cron. The primary tracking-write path is the
 * SHIP_NOTIFY webhook (proxy → /api/quote-sessions/:id/shipstation-tracking).
 * This catches the case where the webhook failed to deliver.
 *
 * Algorithm:
 *   1. Pull quote_sessions WHERE ShipStation_Order_ID IS NOT NULL AND
 *      ShipStation_Status != 'shipped' (in SS, not yet labeled per our state)
 *   2. For each: GET proxy /api/shipstation/shipments?orderId={ssId}
 *   3. If a non-voided shipment exists with tracking# → write to Caspio via
 *      the same /shipstation-tracking endpoint the webhook uses
 *   4. Throttle 1s between requests (ShipStation rate-limits at ~40/min)
 *   5. Returns aggregate stats
 *
 * Body: { daysBack?, dryRun? }
 */
app.post('/api/quote-sessions/bulk-sync-shipstation-tracking', async (req, res) => {
  const startedAt = Date.now();
  try {
    const daysBack = Math.min(Math.max(Number(req.body?.daysBack) || 30, 1), 90);
    const dryRun = req.body?.dryRun === true || req.query?.dryRun === '1';

    // 1. Pull candidates from Caspio via the named `shipstationPending` filter
    // (ShipStation_Order_ID is a Number column, so the server-side predicate uses
    // > 0 to mean "set"). This previously sent q.where, which the proxy silently
    // ignored — see the note on bulk-sync-from-shopworks above.
    let sessions;
    try {
      sessions = await makeApiRequest('/quote_sessions?shipstationPending=true');
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Caspio fetch failed', details: e.message });
    }
    if (!Array.isArray(sessions)) sessions = [];

    // Filter to last N days (don't poll ancient orders forever).
    // Also defensive client-side check on ShipStation_Order_ID and status —
    // Caspio's WHERE with `> 0 AND ... <> 'shipped'` doesn't always exclude
    // null cleanly via the proxy path. Belt-and-suspenders here.
    const sinceMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const candidates = sessions.filter(s => {
      if (!(Number(s.ShipStation_Order_ID) > 0)) return false;
      if (s.ShipStation_Status === 'shipped') return false;
      const created = s.CreatedAt_Quote || s.CreatedAt;
      if (!created) return true;
      const t = Date.parse(created);
      return !Number.isFinite(t) || t >= sinceMs;
    });

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 20).map(s => ({
          quoteId: s.QuoteID,
          shipstationOrderId: s.ShipStation_Order_ID,
          customer: s.CustomerName,
          status: s.ShipStation_Status,
        })),
      });
    }

    // 2-3. For each candidate, ask proxy for shipments. If shipped, write.
    const SYNC_PROXY_BASE_LOCAL = CASPIO_PROXY_BASE;
    const stats = { checked: 0, newlyShipped: 0, stillPending: 0, voided: 0, errors: 0, errorDetails: [] };

    for (const s of candidates) {
      stats.checked++;
      try {
        const shipmentsUrl = `${SYNC_PROXY_BASE_LOCAL}/api/shipstation/shipments?orderId=${encodeURIComponent(s.ShipStation_Order_ID)}`;
        const r = await fetch(shipmentsUrl, { headers: withProxySecret() });
        if (!r.ok) throw new Error(`proxy returned ${r.status}`);
        const data = await r.json();
        const shipments = (data?.shipments || []).filter(ship => !ship.voided);
        const voidedAll = (data?.shipments || []).length > 0 && shipments.length === 0;
        if (voidedAll) {
          stats.voided++;
          continue;
        }
        const ship = shipments[0];
        if (!ship || !ship.trackingNumber) {
          stats.stillPending++;
          continue;
        }
        // Reuse the webhook's write path so the field-mapping logic is in one place.
        const writeUrl = `http://localhost:${process.env.PORT || 3000}/api/quote-sessions/${encodeURIComponent(s.QuoteID)}/shipstation-tracking`;
        const trackingUrl = (function () {
          // Mirror the proxy's buildTrackingUrl — keep them in sync if you add carriers.
          const map = {
            ups:        `https://www.ups.com/track?tracknum=${encodeURIComponent(ship.trackingNumber)}`,
            stamps_com: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(ship.trackingNumber)}`,
            usps:       `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(ship.trackingNumber)}`,
            fedex:      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(ship.trackingNumber)}`,
          };
          return map[String(ship.carrierCode || '').toLowerCase()] || '';
        })();
        const wr = await fetch(writeUrl, {
          method: 'POST',
          // See sync-from-shopworks self-call above — internal loopback call,
          // x-forwarded-proto keeps the force-HTTPS middleware from 302-ing it
          // to https://localhost (→ ECONNREFUSED). 2026-06-15
          headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' },
          body: JSON.stringify({
            trackingNumber:   ship.trackingNumber,
            trackingCarrier:  ship.carrierCode,
            trackingUrl,
            shippedAt:        ship.shipDate || new Date().toISOString(),
            labelCost:        ship.shipmentCost,
            shipstationOrderId: s.ShipStation_Order_ID,
            shipstationStatus: 'shipped',
          }),
        });
        if (!wr.ok) throw new Error(`tracking write returned ${wr.status}`);
        stats.newlyShipped++;
        console.log(`[bulk-sync-ss-tracking] ${s.QuoteID} SS#${s.ShipStation_Order_ID} → ${ship.trackingNumber} (${ship.carrierCode}) — webhook had missed`);
      } catch (e) {
        stats.errors++;
        stats.errorDetails.push({ quoteId: s.QuoteID, error: e.message });
      }
      // Throttle — ShipStation rate-limits at ~40 req/min for /shipments.
      await new Promise(r => setTimeout(r, 1000));
    }

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[bulk-sync-ss-tracking] checked=${stats.checked} newlyShipped=${stats.newlyShipped} still=${stats.stillPending} voided=${stats.voided} errors=${stats.errors} (${elapsedSec}s)`);
    res.json({ success: true, ...stats, elapsedSec, candidateCount: candidates.length });
  } catch (error) {
    console.error('[bulk-sync-ss-tracking] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Bulk SS tracking sync failed', details: error.message });
  }
});

/**
 * GET /api/quote-change-log/:quoteId
 * Returns up to N most-recent changes for a single quote (newest first).
 * Used by the "what changed" banner on /quote/:id (Phase 2).
 */
app.get('/api/quote-change-log/:quoteId', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const sinceHours = Number(req.query.sinceHours);
    const qs = new URLSearchParams({
      quoteID: safeQuoteId,
      limit: String(limit),
    });
    if (Number.isFinite(sinceHours) && sinceHours > 0) {
      qs.set('hoursAgo', String(sinceHours));
    }
    const data = await makeApiRequest(`/quote_change_log?${qs.toString()}`);
    // Proxy returns { success, count, records } — pass through
    res.json(data);
  } catch (error) {
    console.error(`[change-log/${req.params.quoteId}] error:`, error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch change log', details: error.message });
  }
});

/**
 * GET /api/quote-change-log/recent?hours=24&salesRepEmail=...
 * Activity feed across ALL quotes for the dashboard (Phase 3).
 * Filterable by hoursAgo, salesRepEmail, severity, unacknowledged.
 */
app.get('/api/quote-change-log-recent', async (req, res) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 720);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const qs = new URLSearchParams({
      hoursAgo: String(hours),
      limit: String(limit),
    });
    if (req.query.salesRepEmail) qs.set('salesRepEmail', String(req.query.salesRepEmail));
    if (req.query.severity)      qs.set('severity', String(req.query.severity));
    if (req.query.unacknowledged === 'true') qs.set('unacknowledged', 'true');
    const data = await makeApiRequest(`/quote_change_log?${qs.toString()}`);
    res.json(data);
  } catch (error) {
    console.error('[change-log-recent] error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch activity feed', details: error.message });
  }
});

/**
 * PUT /api/quote-change-log/:id/acknowledge
 * Mark a single change record as seen by a user. Used by the change banner's
 * "mark as seen" button (Phase 2) and dashboard activity feed (Phase 3).
 */
app.put('/api/quote-change-log/:id/acknowledge', async (req, res) => {
  try {
    const pkId = parseInt(req.params.id, 10);
    if (!Number.isInteger(pkId) || pkId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid PK_ID' });
    }
    const acknowledgedBy = String(req.body?.acknowledgedBy || '').slice(0, 250);
    if (!acknowledgedBy) {
      return res.status(400).json({ success: false, error: 'acknowledgedBy required in body' });
    }
    await makeApiRequest(`/quote_change_log/${pkId}`, 'PUT', {
      Acknowledged_By: acknowledgedBy,
      Acknowledged_At: nowPacificNaiveIso(),
    });
    res.json({ success: true });
  } catch (error) {
    console.error(`[change-log/${req.params.id}/acknowledge] error:`, error.message);
    res.status(500).json({ success: false, error: 'Failed to acknowledge', details: error.message });
  }
});

// Public API - Accept quote
// strictLimiter + JSON-only (Storefront Checkout Phase 0, 2026-07-05): a
// cross-site form POST can't send application/json without a CORS preflight,
// so this blocks drive-by acceptances from hostile pages; accepting is a
// once-per-quote action, so 20/hr/IP is generous.
app.post('/api/public/quote/:quoteId/accept', strictLimiter, async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'JSON body required' });
    }
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const { name, email, deliveryMethod } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Delivery method (pickup skip-the-rep, 2026-07-06). Optional for backward
    // compatibility with cached pages that don't send it yet.
    if (deliveryMethod != null && deliveryMethod !== 'pickup' && deliveryMethod !== 'ship') {
      return res.status(400).json({ error: "deliveryMethod must be 'pickup' or 'ship'" });
    }

    // Fetch quote session
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const session = sessions[0];

    // Share-link token — ACCEPTING is a state change (and on a pickup quote it
    // auto-enables a pay link), so it needs the same gate as reading, not less.
    // 404 to match the read endpoints: an ID walk learns nothing either way.
    if (!shareTokenOk(req, session)) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Check if quote is already accepted
    if (session.Status === 'Accepted') {
      return res.status(400).json({ error: 'Quote has already been accepted' });
    }

    // Check if quote is expired
    if (session.ExpiresAt) {
      const expiresAt = new Date(session.ExpiresAt);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Quote has expired' });
      }
    }

    // Update quote status
    // Note: AcceptedAt, AcceptedByName, AcceptedByEmail fields don't exist in Caspio
    // Store acceptance info in the existing Notes JSON field instead
    const now = new Date().toISOString();

    // Parse existing Notes JSON and add acceptance info. Use parseNotesJson
    // (not bare JSON.parse) so a plain-text Notes value — the EMB builder saves
    // customer production notes as raw text — is preserved under _legacyText
    // instead of being clobbered by the acceptance JSON. (audit fix 2026-07-06)
    let existingNotes = parseNotesJson(session.Notes);

    existingNotes.acceptedAt = now;
    existingNotes.acceptedByName = sanitizeFilterInput(name);
    existingNotes.acceptedByEmail = sanitizeFilterInput(email);
    if (deliveryMethod) existingNotes.acceptedDeliveryMethod = deliveryMethod;

    // Pickup skip-the-rep: $0 shipping + Milton DOR rate leave nothing for a
    // rep to confirm, so the payment link enables in the SAME write as the
    // acceptance — the customer can pay right now on this page. FAIL-SOFT:
    // any lookup error keeps plain acceptance (rep enables manually, as before).
    let autoDeposit = null;
    if (deliveryMethod === 'pickup'
        && !(Array.isArray(existingNotes.payments) && existingNotes.payments.some((p) => p && p.kind === 'deposit'))) {
      try {
        autoDeposit = await autoEnablePickupDeposit(safeQuoteId, session, existingNotes);
        console.log(`[QuoteAccept] ${safeQuoteId} pickup auto-enable: $${autoDeposit.depositAmount.toFixed(2)} of $${autoDeposit.grandTotal.toFixed(2)}`);
      } catch (autoErr) {
        console.warn(`[QuoteAccept] ${safeQuoteId} pickup auto-enable failed (non-fatal):`, autoErr.message);
        alertQuotePay(`${safeQuoteId}: customer accepted as PICKUP but the payment link could not auto-enable (${autoErr.message}) — enable it manually from the quote page.`);
      }
    }

    const updateData = {
      Status: 'Accepted',
      Notes: JSON.stringify(existingNotes)
    };
    // Dedicated Caspio columns (AcceptedAt/AcceptedByName/AcceptedByEmail) are written
    // ONLY when QUOTE_ACCEPT_FIELDS_LIVE=1 — Erik sets that env var AFTER creating the
    // fields in Caspio. Writing unknown fields would 400 the whole PUT, so this stays
    // off by default; Notes JSON always carries the data regardless.
    if (process.env.QUOTE_ACCEPT_FIELDS_LIVE === '1') {
      updateData.AcceptedAt = now;
      updateData.AcceptedByName = sanitizeFilterInput(name);
      updateData.AcceptedByEmail = sanitizeFilterInput(email);
    }

    await makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', updateData);

    console.log(`[QUOTE] Quote ${safeQuoteId} accepted by ${name} (${email})`);

    // Fire acceptance emails (customer receipt + rep alert) — fully fail-soft and
    // fire-and-forget so the customer's confirmation isn't delayed by EmailJS.
    try { sendQuoteAcceptedEmails(session, name, email); } catch (e) { console.error('[QuoteAccept] email dispatch error:', e.message); }

    res.json({
      success: true,
      message: 'Quote accepted successfully',
      quoteId: safeQuoteId,
      acceptedAt: now,
      acceptedBy: { name, email },
      deliveryMethod: deliveryMethod || null,
      // Present ONLY when pickup auto-enable succeeded — the page renders the
      // pay button immediately from this block (no reload, no cache lag).
      deposit: autoDeposit,
    });

  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// ── Online deposit payments (Storefront Checkout Phase 1, 2026-07-05) ────────
// Staff API — a rep ENABLES the deposit on an Accepted quote, supplying the
// rep-confirmed shipping $ + tax-rate % (WQ quotes save TaxAmount=0 by design;
// this is where "a rep confirms tax and shipping" becomes a recorded number).
// Deposit % comes from Service_Codes DEPOSIT-PCT — fail-closed, no hardcoded
// fallback (Erik's rule). The full terms + totals-hash land in Notes JSON.
app.post('/api/quotes/:quoteId/enable-deposit', requireStaff, async (req, res) => {
  try {
    const quoteId = String(req.params.quoteId || '').trim();
    const shipping = Number(req.body?.shipping);
    const taxRatePct = Number(req.body?.taxRatePct);
    if (!quoteId) return res.status(400).json({ error: 'quoteId required' });
    if (!Number.isFinite(shipping) || !Number.isFinite(taxRatePct)) {
      return res.status(400).json({ error: 'shipping and taxRatePct are required numbers' });
    }

    const row = await fetchQuoteSessionRow(quoteId);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    if (row.Status !== 'Accepted') {
      return res.status(409).json({ error: `Quote status is '${row.Status}' — the customer must accept the quote before a deposit is collected.` });
    }

    const notes = parseNotesJson(row.Notes);
    if (Array.isArray(notes.payments) && notes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'A deposit has already been paid on this quote.' });
    }

    // Deposit % — Caspio-driven, fail-closed (shared helper with pickup auto-enable).
    let depositPct;
    try {
      depositPct = await getDepositPct();
    } catch (e) {
      return res.status(502).json({ error: `Deposit % unavailable: ${e.message}. Add/activate Service_Codes row DEPOSIT-PCT (SellPrice = percent, e.g. 50) and retry.` });
    }

    let terms;
    try {
      terms = QuoteDepositMath.computeDepositTerms({
        subtotal: parseFloat(row.TotalAmount), shipping, taxRatePct, depositPct,
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const totalsHash = computeQuoteTotalsHash(quoteId, terms.subtotal, terms.grandTotal, terms.depositAmount);

    // RE-FETCH before writing (audit fix 2026-07-06): getDepositPct() above is a
    // network call, so a payment webhook could have written payments[] since we
    // read `notes`. Re-read fresh, re-check the paid guard, and merge onto the
    // latest Notes so we never clobber a recorded payment.
    const fresh = await fetchQuoteSessionRow(quoteId);
    const freshNotes = parseNotesJson((fresh && fresh.Notes) || row.Notes);
    if (Array.isArray(freshNotes.payments) && freshNotes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'A deposit has already been paid on this quote.' });
    }
    freshNotes.deposit = Object.assign({}, terms, {
      enabled: true,
      totalsHash,
      hashVersion: QUOTE_TOTALS_HASH_VERSION,
      enabledAt: new Date().toISOString(),
      enabledBy: (req.session.crmUser && (req.session.crmUser.email || req.session.crmUser.Email || req.session.crmUser.name)) || 'staff',
    });
    await makeApiRequest(`/quote_sessions/${(fresh && fresh.PK_ID) || row.PK_ID}`, 'PUT', { Notes: JSON.stringify(freshNotes) });

    console.log(`[QuoteDeposit] ${quoteId} deposit enabled: $${terms.depositAmount.toFixed(2)} of $${terms.grandTotal.toFixed(2)} (${depositPct}%)`);
    res.json({
      success: true,
      quoteId,
      deposit: freshNotes.deposit,
      payUrl: quoteShareUrl(quoteId, freshNotes),
    });
  } catch (error) {
    console.error('[QuoteDeposit] enable failed:', error);
    res.status(500).json({ error: 'Failed to enable deposit' });
  }
});

// Public API — start Stripe HOSTED Checkout for a rep-enabled deposit. The
// amount comes ONLY from the server-stored deposit block (never the request),
// and the block is re-verified against the row's CURRENT TotalAmount so a
// quote edited after enablement can't be charged at stale numbers. PCI stays
// SAQ-A: hosted Checkout only, no card data touches this server.
app.post('/api/public/quote/:quoteId/deposit-checkout', strictLimiter, async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'JSON body required' });
    }
    const quoteId = String(req.params.quoteId || '').trim();
    if (!quoteId) return res.status(400).json({ error: 'quoteId required' });

    const row = await fetchQuoteSessionRow(quoteId);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    // Token gate — this one MINTS A STRIPE CHECKOUT SESSION. Anything that can
    // start a payment against a quote must prove it holds that quote's link.
    if (!shareTokenOk(req, row)) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const notes = parseNotesJson(row.Notes);
    const dep = notes.deposit;
    if (!dep || !dep.enabled) {
      return res.status(409).json({ error: 'Deposit is not set up on this quote yet — your rep will activate it.' });
    }
    if (row.Status !== 'Accepted') {
      return res.status(409).json({ error: 'The quote must be accepted before paying the deposit.' });
    }
    if (Array.isArray(notes.payments) && notes.payments.some((p) => p && p.kind === 'deposit')) {
      return res.status(409).json({ error: 'Deposit already paid — thank you!' });
    }
    // Re-verify stored terms against the CURRENT row (rep edits invalidate).
    if (!totalsHashMatches(
      dep, quoteId, QuoteDepositMath.r2(parseFloat(row.TotalAmount)), dep.grandTotal, dep.depositAmount
    )) {
      return res.status(409).json({ error: 'This quote changed after the deposit was set up. Ask your rep to re-enable the deposit.' });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;
    if (!secretKey) {
      console.error('[QuoteDeposit] Stripe secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Payments are not configured — please call (253) 922-5793.' });
    }
    const stripeInstance = stripe(secretKey);
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // Double-charge guard (audit fix 2026-07-06): expire the previous checkout
    // session before minting a new one, so at most ONE payable link exists per
    // quote at a time. Without this, a customer who hits Back and clicks Pay
    // again — or a colleague on the same shared quote link — could complete two
    // live sessions and be charged twice. Fail-soft: an expire error (already
    // completed/expired) must not block a legitimate new checkout.
    if (dep.lastSessionId) {
      try { await stripeInstance.checkout.sessions.expire(dep.lastSessionId); }
      catch (e) { console.warn('[QuoteDeposit] prior session expire failed (non-fatal):', e.message); }
    }

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      // Cap the payable window to 30 min so a stale abandoned tab can't be paid
      // hours later against terms that may have changed (Stripe min 30 min).
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_email: row.CustomerEmail || undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            // DEPOSIT-PCT=100 (Erik 2026-07-05) → pay-in-full wording; any
            // lower pct flips back to deposit wording with no deploy.
            name: Number(dep.depositPct) >= 100
              ? `Payment in full — Quote ${quoteId}`
              : `${dep.depositPct}% deposit — Quote ${quoteId}`,
            description: Number(dep.depositPct) >= 100
              ? `Northwest Custom Apparel — order total $${Number(dep.grandTotal).toFixed(2)} incl. tax & shipping`
              : `Northwest Custom Apparel — order total $${Number(dep.grandTotal).toFixed(2)} incl. tax & shipping; balance due after proof approval`,
          },
          unit_amount: Math.round(dep.depositAmount * 100),
        },
        quantity: 1,
      }],
      // Token must ride on the return URLs too — a customer coming back from
      // Stripe to a tokenised quote would otherwise land on a 404 immediately
      // after paying, which is the worst possible moment for it.
      success_url: `${quoteShareUrl(quoteId, row).replace(PUBLIC_SITE_ORIGIN, siteOrigin)}${quoteShareUrl(quoteId, row).includes('?') ? '&' : '?'}deposit=success`,
      cancel_url: `${quoteShareUrl(quoteId, row).replace(PUBLIC_SITE_ORIGIN, siteOrigin)}${quoteShareUrl(quoteId, row).includes('?') ? '&' : '?'}deposit=canceled`,
      metadata: { quoteID: quoteId, kind: 'deposit', totalsHash: dep.totalsHash, source: 'quote-deposit' },
    });

    // Stamp the session id for staff visibility (fail-soft — the webhook keys
    // off metadata, not this stamp). RE-FETCH before writing (audit fix
    // 2026-07-06): the `row` snapshot was read BEFORE the ~1s Stripe call, so a
    // payment webhook that landed during that call already wrote payments[] to
    // the row. Writing the stale snapshot would erase it. Re-read fresh and
    // only touch deposit.lastSessionId, preserving payments[] and everything else.
    try {
      const fresh = await fetchQuoteSessionRow(quoteId);
      const stamped = parseNotesJson((fresh && fresh.Notes) || row.Notes);
      stamped.deposit = Object.assign({}, stamped.deposit, {
        lastSessionId: session.id, lastSessionAt: new Date().toISOString(),
      });
      await makeApiRequest(`/quote_sessions/${(fresh && fresh.PK_ID) || row.PK_ID}`, 'PUT', { Notes: JSON.stringify(stamped) });
    } catch (e) {
      console.warn('[QuoteDeposit] session-id stamp failed (non-fatal):', e.message);
    }

    console.log('[QuoteDeposit] checkout session created for', quoteId, session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('[QuoteDeposit] checkout failed:', error);
    res.status(500).json({ error: 'Failed to start the deposit checkout' });
  }
});

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