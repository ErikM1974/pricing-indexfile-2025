// =============================================================================
// OBSERVABILITY: Sentry (roadmap 1.10) — MUST be the first require: v8
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
const stripe = require('stripe');
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
//   ALL /api/crm-proxy/form-submissions* — Forms Inbox reads/updates (any staff; ~L3230, 2026-07-11)
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
//   L770  /staff-dashboard.html         → v3 canonical (serves staff-dashboard-v3/index.html)
//   L775  /staff-dashboard-v2.html      → 301 redirect → /staff-dashboard.html
//   L780  /staff-dashboard-legacy.html  → 301 redirect → /staff-dashboard.html
//   L786  /staff-dashboard-v3/          → v3 dedicated URL (kept for old bookmarks)
//   /quote-builders/dtg-quote-builder-legacy.html → 301 → dtg-quote-builder.html (legacy deleted 2026-06-08)
//
// LEGACY REDIRECTS
//   /cart → 301 /pages/sample-cart.html (legacy Bootstrap cart retired 2026-06-11; cart.html + pages/order-confirmation.html deleted; 7 zombie sendFile routes to missing files removed same day)
//   L657  /calculators/embroidery-contract* → embroidery-pricing-all
//   L662  /staff-dashboard.html → /dashboards/
//   L666  /bundle-orders-dashboard.html → /dashboards/
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
//   L2254 GET  /api/christmas-products
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
// CART SYSTEM
//   L1616 GET  /cart
//   L1657 CRUD /api/cart-sessions
//   L1703 CRUD /api/cart-items
//   L1911 CRUD /api/cart-item-sizes
//
// CUSTOMER & ORDER APIS
//   L1959 CRUD /api/customers
//   L1998 CRUD /api/orders
//
// QUOTE SYSTEM
//   L2446 CRUD /api/quote_sessions
//   L2589 CRUD /api/quote_items
//   L2710 CRUD /api/quote_analytics
//
// PUBLIC QUOTE & DESIGN ROUTES
//   L2772 GET  /api/quote_items/quote/:quoteId
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
//   L1652 /pricing/stickers → sticker-manual-pricing.html
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
    'https://*.boxcloud.com',
    'https://via.placeholder.com',
    'https://images.squarespace-cdn.com',
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
const cspReportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: false, legacyHeaders: false });
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
  max: 200, // Limit each IP to 200 requests per windowMs
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
  max: 20, // 20 requests per hour
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
  console.error('[3DT ALERT] ' + text);
  const hook = process.env.SLACK_ORDER_ALERT_WEBHOOK_URL
    || process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL || '';
  if (!hook) return;
  fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '🚨 3-Day Tees: ' + text }),
  }).catch(() => {/* alerting must never throw */});
}

// ── Shared quote_sessions row fetch (webhook + order-status page) ───────────
// refresh=true bypasses the proxy's 5-min lookup cache — a stale [] would
// orphan a PAID order and a stale Status would break idempotency. Exact-match
// the QuoteID — never rows[0] (the 2026-06-01 wrong-quote lesson). Throws on
// a failed lookup (err.httpStatus carries the upstream code) so callers can
// distinguish "no record" (resolves null) from "lookup unavailable" (throws).
async function fetchQuoteSessionRow(quoteID) {
  const url = `${CASPIO_PROXY_BASE}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`;
  const resp = await fetch(url);
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
  const quoteUrl = `${PUBLIC_SITE_ORIGIN}/quote/${encodeURIComponent(quoteId)}`;
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

// Binds a payment link to the exact numbers the rep enabled. Recomputed from
// the CURRENT row before every Stripe session and again at the webhook — a rep
// edit after enablement can never be charged at stale amounts.
function computeQuoteTotalsHash(quoteID, subtotal, grandTotal, depositAmount) {
  return crypto.createHash('sha256')
    .update([quoteID, Number(subtotal).toFixed(2), Number(grandTotal).toFixed(2), Number(depositAmount).toFixed(2)].join('|'))
    .digest('hex').slice(0, 16);
}

// Money-path alert for quote payments (deposit paid / stale-hash / ledger
// failure). Same Slack hooks as alert3DT, labeled for quotes.
function alertQuotePay(text) {
  console.error('[QUOTE PAY] ' + text);
  const hook = process.env.SLACK_ORDER_ALERT_WEBHOOK_URL
    || process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL || '';
  if (!hook) return;
  fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '💰 Quote payments: ' + text }),
  }).catch(() => {/* alerting must never throw */});
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
  const tax = await resolveTdtTax({ deliveryMethod: 'pickup' }); // Milton DOR, same as 3DT pickup
  const taxRatePct = Math.round(tax.rate * 100000) / 1000;       // decimal (0.102) -> percent (10.2)
  const terms = QuoteDepositMath.computeDepositTerms({
    subtotal: parseFloat(row.TotalAmount), shipping: 0, taxRatePct, depositPct,
  });
  const totalsHash = computeQuoteTotalsHash(quoteId, terms.subtotal, terms.grandTotal, terms.depositAmount);
  notes.deposit = Object.assign({}, terms, {
    enabled: true,
    totalsHash,
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
  const quoteUrl = `${PUBLIC_SITE_ORIGIN}/quote/${encodeURIComponent(quoteId)}`;
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
      serviceBanner: chCfg.push.serviceBanner(false)
    });
    const pushResp = await fetch(`${CASPIO_PROXY_BASE}/api/manageorders/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const pushResult = await pushResp.json().catch(() => ({}));
    if (!pushResp.ok || pushResult.success === false) {
      throw new Error(`ManageOrders push failed (${pushResp.status}): ${pushResult.error || pushResult.message || 'unknown'}`);
    }
    const extOrderId = pushResult.extOrderId || pushResult.orderNumber || quoteID;
    await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    stampedOrderSettings: (priced, stockChecked) => ({
      channel: 'custom-caps',
      styleNumber: priced.style,
      styleName: priced.productName,
      rush: false,
      frontLogo: true,
      backLogo: priced.backLogo,
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
// (lib/product-seo.js, 10-min cache) — same pattern as /blog. The client JS
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
        return res.type('html').send(productSeo.injectHead(html, head));
      }
    } catch (e) {
      console.error('[product-seo] injection failed (serving static):', e.message);
    }
  }
  res.sendFile(productHtmlPath);
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

// =============================================================================
// CRM DASHBOARD AUTHENTICATION ROUTES (Caspio-based)
// =============================================================================

// Endpoint to establish CRM session after Caspio login
// Called from staff-login.html after user authenticates with Caspio
app.post('/api/crm-session', express.json(), (req, res) => {
  // SSO-ONLY (#2 flip, 2026-06-29): we NO LONGER mint a session from a client-
  // posted name — that was forgeable (a bare POST {"name":"Erik"} minted full
  // admin). Identity now comes ONLY from a verified Caspio SAML login
  // (/auth/saml/acs). Echo the existing verified session if present; else require SSO.
  if (req.session && req.session.crmUser) {
    const u = req.session.crmUser;
    return res.json({ success: true, permissions: u.permissions || [], firstName: u.firstName });
  }
  return res.status(401).json({ error: 'Sign in required', loginUrl: '/auth/saml/login' });
});

// GET current CRM session — used by Policies Hub admin gate and any
// frontend that needs to render role-conditional UI without a full login flow.
// Returns 200 with user info when authenticated, 200 with anonymous shape when not.
app.get('/api/crm-session/me', (req, res) => {
  if (!req.session?.crmUser) {
    return res.json({
      authenticated: false,
      permissions: [],
      firstName: '',
      email: ''
    });
  }
  const u = req.session.crmUser;
  res.json({
    authenticated: true,
    name: u.name,
    firstName: u.firstName,
    email: u.email || '',
    permissions: u.permissions || []
  });
});

// Logout endpoint - clears CRM session
app.get('/crm-logout', (req, res) => {
  req.session = null; // cookie-session: clear the staff cookie
  res.redirect('/dashboards/staff-login.html');
});

// =============================================================================
// Staff SAML SSO (#2) — server-VERIFIED login (Caspio "Staff" directory = IdP)
// =============================================================================
// ADDITIVE: these routes add a login the SERVER can verify. They do NOT yet
// change dashboard gating or remove the forgeable /api/crm-session — that flip
// happens only after a real login is confirmed end-to-end on production.
// Fails safe: returns 503 until the SAML_* env vars are configured.

// SP-initiated start — redirect the browser to Caspio to authenticate.
app.get('/auth/saml/login', async (req, res) => {
  if (!staffSaml.isConfigured()) return res.status(503).send('Staff SSO is not configured yet.');
  try {
    // Only a genuine same-origin path: starts with '/' but NOT '//' or '/\' (which
    // browsers treat as protocol-relative → an open-redirect to an external host).
    const next = (typeof req.query.next === 'string' && /^\/(?![/\\])/.test(req.query.next)) ? req.query.next : '/staff-dashboard.html';
    res.redirect(await staffSaml.getLoginUrl(next));
  } catch (e) {
    console.error('[SAML] login init failed:', e.message);
    res.status(500).send('Could not start sign-in. Please try again.');
  }
});

// Assertion Consumer Service — Caspio POSTs the SIGNED assertion here. We verify
// Caspio's signature + audience + timestamps, then establish the staff session.
app.post('/auth/saml/acs', express.urlencoded({ extended: false, limit: '1mb' }), async (req, res) => {
  if (!staffSaml.isConfigured()) return res.status(503).send('Staff SSO is not configured yet.');
  try {
    const identity = await staffSaml.verifyResponse(req.body.SAMLResponse);
    // Role-of-record now lives in Caspio (Staff_App_Roles table); fetch it server-side
    // and derive permissions. Fail-safe: a lookup error yields no elevated permissions
    // (deny, never grant wrong access) — the user can re-login once it recovers.
    const role = await fetchStaffRole(identity.email);
    const permissions = staffSaml.permissionsFromRole(role, identity.email);
    // cookie-session: the signed cookie IS the session — there is no server-side
    // session id to regenerate. Fixation doesn't apply: the cookie only ever holds
    // what we set here, AFTER verifying Caspio's signed assertion. Reset then set.
    req.session = null;
    req.session = {
      crmUser: {
        name: identity.name,
        email: identity.email,
        firstName: (identity.name || '').split(' ')[0],
        role: role || null,
        permissions,
        via: 'saml',
      },
    };
    // Same-origin only — reject protocol-relative '//host' / '/\host' open-redirects.
    const relay = (typeof req.body.RelayState === 'string' && /^\/(?![/\\])/.test(req.body.RelayState)) ? req.body.RelayState : '/staff-dashboard.html';
    res.redirect(relay); // cookie-session writes the Set-Cookie automatically
  } catch (e) {
    console.error('[SAML] ACS verify failed:', e.message);
    res.status(401).send('Sign-in could not be verified. Please try again or contact IT.');
  }
});

// Logout — clear our session (cookie-session: null the cookie).
app.get('/auth/saml/logout', (req, res) => {
  req.session = null;
  res.redirect('/dashboards/staff-login.html');
});

// Protected CRM dashboard routes (MUST be before static middleware)
// Each dashboard requires specific role permission via Caspio authentication
app.get('/dashboards/taneisha-crm.html', requireCrmRole(['taneisha']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'taneisha-crm.html'));
});
app.get('/dashboards/nika-crm.html', requireCrmRole(['nika']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'nika-crm.html'));
});
app.get('/dashboards/house-accounts.html', requireCrmRole(['house']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'house-accounts.html'));
});
// Access-Admin control panel — ADMIN ONLY (hard code gate, not just the table, since
// this page edits the RBAC tables themselves). Registered before the /dashboards mount.
app.get('/dashboards/access-admin.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'access-admin.html'));
});

// Caspio REST API v4 reference viewer — ERIK ONLY (hard email gate). Locked to Erik's
// email so it stays private even if someone else is later granted the 'admin' role; the
// Staff_Page_Access admin-override does NOT apply to this explicit route. Registered
// before the /dashboards mount so it intercepts ahead of gateStaffHtml + static.
app.get('/dashboards/caspio-api-reference.html', requireCrmEmail(['erik@nwcustomapparel.com']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'caspio-api-reference.html'));
});

// Caspio table-usage audit — ADMIN ONLY (hard role gate, like access-admin). A cleanup
// tool: 163 tables + which are used (code/view/rel/task/webhook) so Erik can archive
// stale ones. Registered before the /dashboards mount.
app.get('/dashboards/table-usage-audit.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'table-usage-audit.html'));
});

// ManageOrders / OnSite API field cheat sheet — ADMIN ONLY. Static reference of the
// push/pull fields (from the public Swagger + our tested reference). Before the mount.
app.get('/dashboards/manageorders-api-reference.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'manageorders-api-reference.html'));
});

// SanMar Web Services (SOAP) cheat sheet — ADMIN ONLY. Static reference from the
// Integration Guide v24.5 + memory/SANMAR_API_REFERENCE.md. Before the mount.
app.get('/dashboards/sanmar-api-reference.html', requireCrmRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'sanmar-api-reference.html'));
});

// ShopWorks OnSite ODBC reference — ERIK ONLY (hard email gate, like caspio-api-reference):
// the page displays the ODBC connection card (LAN server + read-only credentials), the
// FileMaker query rules, and the 2,630-field Data_ODBCMapping catalog. Before the mount.
app.get('/dashboards/shopworks-odbc-reference.html', requireCrmEmail(['erik@nwcustomapparel.com']), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'shopworks-odbc-reference.html'));
});

// Customer Portal admin console — manage who can log into the customer portal
// (Customer_Portal_Access invites). Open to the management team by ROLE (Erik=admin,
// Bradley=accountant, Ruth=art, Taneisha/Nika=sales). The two rep tags are included so
// Taneisha + Nika are covered regardless of their broader Staff_App_Roles role.
const PORTAL_ADMIN_ROLES = ['admin', 'accountant', 'art', 'sales', 'taneisha', 'nika'];
app.get('/dashboards/customer-portal-admin.html', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'customer-portal-admin.html'));
});

// =============================================================================
// CRM API PROXY ROUTES
// These routes protect the CRM API by validating session/role before forwarding
// to caspio-pricing-proxy with a server-side secret. The API never exposed to browser.
// =============================================================================

const CRM_API_BASE = CASPIO_PROXY_BASE;
const CRM_API_SECRET = process.env.CRM_API_SECRET;

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

// True if the logged-in user may view a /dashboards page per its table rule (if any).
// Unlisted page (no rule) → any logged-in staff. Listed → role-in-Allowed_Roles OR
// email-in-Allowed_Emails. Roles are matched against the user's derived permissions.
function userMayAccessPage(crmUser, rule) {
  const userPerms = (crmUser.permissions || []).map(p => String(p).toLowerCase());
  if (userPerms.includes('admin')) return true; // admin override — sees every page, can't lock self out
  if (!rule) return true;                        // unlisted page → any logged-in staff
  const roles = String(rule.Allowed_Roles || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const emails = String(rule.Allowed_Emails || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const userEmail = String(crmUser.email || '').toLowerCase();
  return roles.some(r => userPerms.includes(r)) || emails.includes(userEmail);
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
    if (!userMayAccessPage(req.session.crmUser, rules[page])) {
      const fn = String(req.session.crmUser.firstName || '').replace(/[<>&"']/g, '');
      return res.status(403).type('html').send(accessRestrictedPage(fn));
    }
  } catch (e) { console.error('[page-access] check error:', e.message); /* fail-open to any logged-in staff */ }
  return next();
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

// Taneisha accounts proxy - requires 'taneisha' role
app.all('/api/crm-proxy/taneisha-accounts*', ...createCrmProxy('taneisha-accounts', ['taneisha']));

// Nika accounts proxy - requires 'nika' role
app.all('/api/crm-proxy/nika-accounts*', ...createCrmProxy('nika-accounts', ['nika']));

// House accounts proxy - requires 'house' role
app.all('/api/crm-proxy/house-accounts*', ...createCrmProxy('house-accounts', ['house']));

// Sales Reps 2026 proxy - requires 'house' role (admin can view/edit all reps)
app.all('/api/crm-proxy/sales-reps-2026*', ...createCrmProxy('sales-reps-2026', ['house']));

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

// Customer Portal admin — CRUD on the Customer_Portal_Access invite registry. Powers the
// "Customer Portals" staff console. Role-gated (the management team) + the proxy's secret.
app.all('/api/crm-proxy/customer-portal-access*', ...createCrmProxy('customer-portal-access', PORTAL_ADMIN_ROLES));
// Customer lookup for the "add customer" search (resolve a contact → id_Customer + company).
// company-contacts/search is already public (the quote builders use it), but proxying it
// keeps the admin page same-origin + role-gated + carries the secret harmlessly.
app.all('/api/crm-proxy/company-contacts*', ...createCrmProxy('company-contacts', PORTAL_ADMIN_ROLES));
// Re-order request work-queue (Phase 4) — the console's "Requests" tab lists/updates/deletes
// Portal_Reorder_Requests via the proxy portal-reorder route (GET /requests, PUT/DELETE /requests/:pk).
app.all('/api/crm-proxy/portal-reorder*', ...createCrmProxy('portal-reorder', PORTAL_ADMIN_ROLES));
// Reward dollars (Phase 5) — the console reads a customer's ledger/balance here. WRITES go
// through the dedicated /api/portal-admin/rewards/entry (which stamps the staff email).
app.all('/api/crm-proxy/customer-rewards*', ...createCrmProxy('customer-rewards', PORTAL_ADMIN_ROLES));

// Form Submissions (Forms Inbox) — saved fillable-form twins. ANY logged-in staff
// (like unlisted dashboard pages), so we reuse the factory's forwarder but swap the
// role gate for requireStaff. Proxy side is secret-only (holds customer contact info).
const [, formSubmissionsForwarder] = createCrmProxy('form-submissions', []);
app.all('/api/crm-proxy/form-submissions*', requireStaff, formSubmissionsForwarder);

// Blog Editor (dashboards/blog-editor.html) — staff write posts through this
// forwarder (adds the CRM secret the proxy's gateWritesOnly demands; also lets
// the editor list/read Drafts, which the public blog-posts endpoint hides).
const [, blogPostsForwarder] = createCrmProxy('blog-posts', []);
app.all('/api/crm-proxy/blog-posts*', requireStaff, blogPostsForwarder);

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

console.log('✓ CRM API proxy routes loaded (session-protected)');

// robots.txt — staff/internal paths + credential-bearing share links disallowed (2026-06-11)
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

// Google Search Console ownership proof (2026-07-12) — NEVER remove: GSC
// re-checks periodically and the property un-verifies if this 404s.
app.get('/google9a8dd44e58634cb7.html', (req, res) => {
  res.type('text/html').send('google-site-verification: google9a8dd44e58634cb7.html');
});

// Favicon — SELF-HOSTED (2026-07-12; icon refreshed 2026-07-13 to the NWCA
// circle/tee mark): the old cdn.caspio.com favicon URL is robots-blocked (cdn
// robots.txt = Disallow: /), so Googlebot-Image could never fetch it and search
// results showed a generic globe. No root express.static exists, hence explicit
// routes. favicon.ico is a multi-size (16/32/48) PNG-in-ICO; apple-touch-icon
// (180) is auto-requested by iOS at the site root for "Add to Home Screen".
app.get(['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  const file = req.path === '/favicon.ico' ? 'favicon.ico'
             : req.path === '/favicon.png' ? 'favicon.png'
             : 'apple-touch-icon.png';
  res.sendFile(path.join(__dirname, file));
});

// =============================================================================
// BLOG — server-rendered for SEO (2026-07-12). Posts live in Caspio Blog_Posts
// (Erik publishes via /dashboards/blog-editor.html — no deploy); lib/blog.js
// fetches through the proxy with a 5-min cache and renders markdown → safe
// HTML (marked + xss allowlist; YouTube/Vimeo embeds built server-side).
// Routes: GET /blog · GET /blog/feed.xml · GET /sitemap-blog.xml ·
//         GET /blog/:slug · POST /api/blog-preview (staff — editor live preview)
// =============================================================================
const blog = require('./lib/blog');
const blogTemplates = require('./lib/blog-templates');

app.get('/blog', async (req, res) => {
  try {
    const posts = await blog.listPublished();
    const category = String(req.query.category || '').slice(0, 60);
    res.type('html').send(blogTemplates.renderIndex(posts, { category }));
  } catch (e) {
    console.error('[blog] index failed:', e.message);
    res.status(503).type('html').send('<h1>Blog temporarily unavailable</h1><p>Please try again in a minute.</p>');
  }
});

app.get('/blog/feed.xml', async (req, res) => {
  try {
    res.type('application/rss+xml').send(blogTemplates.renderFeed(await blog.listPublished()));
  } catch (e) { res.status(503).send('feed unavailable'); }
});

app.get('/sitemap-blog.xml', async (req, res) => {
  try {
    res.type('application/xml').send(blogTemplates.renderSitemap(await blog.listPublished()));
  } catch (e) { res.status(503).send('sitemap unavailable'); }
});

// Style → published-posts map for the product page's "From our blog" block
// (lib/blog.js productMap — live-derived from post bodies, so new posts wire
// themselves in with no deploy). Failure = 503; the PDP module silently skips
// the block (progressive enhancement, not customer data).
app.get('/api/blog-product-map', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=600');
    res.json(await blog.productMap());
  } catch (e) { res.status(503).json({ error: 'map unavailable' }); }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const post = await blog.getPublished(String(req.params.slug || ''));
    if (!post) {
      return res.status(404).type('html').send(
        '<h1>Post not found</h1><p><a href="/blog">Back to the blog</a></p>');
    }
    const all = await blog.listPublished();
    const related = all.filter((p) => p.slug !== post.slug &&
      (!post.category || p.category === post.category)).slice(0, 3);
    res.type('html').send(blogTemplates.renderPost(post, blog.renderMarkdown(post.bodyMarkdown), related));
  } catch (e) {
    console.error('[blog] post failed:', e.message);
    res.status(503).type('html').send('<h1>Blog temporarily unavailable</h1><p>Please try again in a minute.</p>');
  }
});

// Editor live preview — SAME renderer as the live pages so preview never lies.
// Staff-only (it renders arbitrary markdown; keep it off the public surface).
app.post('/api/blog-preview', requireStaff, express.json({ limit: '256kb' }), (req, res) => {
  res.json({ html: blog.renderMarkdown(String((req.body || {}).markdown || '')) });
});

// ── Tenant config (roadmap 0.3) ─────────────────────────────────────────────
// Runtime tenant hydration for config/tenant.js. Backed by config/tenants/
// <id>.json today; the Phase 2 admin console swaps the backing store without
// changing this contract. Strict id allowlist pattern — the param never
// touches the filesystem un-validated.
app.get('/api/tenants/:id/config', (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid tenant id' });
  }
  const tenantPath = path.join(__dirname, 'config', 'tenants', `${id}.json`);
  fs.readFile(tenantPath, 'utf8', (err, raw) => {
    if (err) return res.status(404).json({ error: 'Unknown tenant' });
    try {
      res.setHeader('Cache-Control', 'no-cache');
      res.json(JSON.parse(raw));
    } catch (parseErr) {
      console.error(`[tenants] config/tenants/${id}.json is not valid JSON:`, parseErr.message);
      res.status(500).json({ error: 'Tenant config unreadable' });
    }
  });
});

// ── Build pipeline (roadmap 0.1/0.2) ────────────────────────────────────────
// scripts/build.js emits content-hashed, minified copies of the quote-builder
// assets into /dist + dist/asset-manifest.json. Hashed filenames make these
// safe to cache forever (the name changes when the content does) — unlike the
// no-cache staticOptions everything else needs. HTML stays no-cache so new
// manifest refs are picked up on the next load.
app.use('/dist', express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Serve the three builder pages with script/link tags rewritten to the hashed
// /dist assets. No manifest (build not run) → fall through to the plain
// static mount below and serve the original source paths — the build is an
// overlay, never a requirement.
const { rewriteHtmlAssets, createManifestLoader, createHtmlLoader } = require('./lib/asset-manifest');
const loadAssetManifest = createManifestLoader(path.join(__dirname, 'dist', 'asset-manifest.json'));
const loadBuilderHtml = createHtmlLoader();
const REWRITTEN_BUILDER_PAGES = new Set([
  'embroidery-quote-builder.html',
  'screenprint-quote-builder.html',
  'dtf-quote-builder.html',
  'dtg-quote-builder.html'
]);
app.get('/quote-builders/:page', (req, res, next) => {
  if (!REWRITTEN_BUILDER_PAGES.has(req.params.page)) return next();
  const manifest = loadAssetManifest();
  if (!manifest) return next();
  try {
    const html = loadBuilderHtml(path.join(__dirname, 'quote-builders', req.params.page));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('html').send(rewriteHtmlAssets(html, manifest));
  } catch (err) {
    console.error('[asset-manifest] builder page rewrite failed, falling back to static:', err.message);
    next();
  }
});

// Serve specific directories as static
app.use('/calculators', express.static(path.join(__dirname, 'calculators'), staticOptions));
// #2 flip — gate staff dashboard PAGES behind a verified SAML session. The login
// page and non-HTML assets (css/js/img) stay public so there's no redirect loop.
// Role-specific dashboards (taneisha/nika/house/policies) keep their own
// requireCrmRole gates registered earlier; this catches the rest.
// Gate staff HTML pages behind a verified SAML session. SECURITY (2026-06-30): decode
// the path FIRST so URL-encoding tricks (e.g. %2e for '.') can't slip a .html request
// past the suffix test and reach the static mount un-gated. Non-HTML assets (css/js/img)
// and the staff-login page stay public so there's no redirect loop. The per-page rule
// itself is enforced table-driven in gateStaffPage (Staff_Page_Access; admin override).
function gateStaffHtml(req, res, next) {
  let p;
  try { p = decodeURIComponent(req.path).toLowerCase(); }
  catch (e) { p = String(req.path).toLowerCase(); }
  if (!p.endsWith('.html') || p === '/staff-login.html') return next();
  return gateStaffPage(req, res, next);
}
app.use('/dashboards', gateStaffHtml);
app.use('/dashboards', express.static(path.join(__dirname, 'dashboards'), staticOptions));
app.use('/quote-builders', express.static(path.join(__dirname, 'quote-builders'), staticOptions));
// SECURITY (2026-06-30): vendor-portals (SanMar invoices/credits) + tools (internal
// diagnostics) are staff-only — gate every .html the same way as /dashboards so the
// sibling static mounts can't be used to bypass the root-route gate.
app.use('/vendor-portals', gateStaffHtml);
app.use('/vendor-portals', express.static(path.join(__dirname, 'vendor-portals'), staticOptions));
app.use('/art-tools', express.static(path.join(__dirname, 'art-tools'), staticOptions));
app.use('/tools', gateStaffHtml);
app.use('/tools', express.static(path.join(__dirname, 'tools'), staticOptions));
// /admin is staff-only EXCEPT the customer-facing c112-bogo-promo landing page.
app.use('/admin', (req, res, next) => {
  let p;
  try { p = decodeURIComponent(req.path).toLowerCase(); }
  catch (e) { p = String(req.path).toLowerCase(); }
  if (p === '/c112-bogo-promo.html') return next(); // public customer-facing promo page
  return gateStaffHtml(req, res, next);
});
app.use('/admin', express.static(path.join(__dirname, 'admin'), staticOptions));
app.use('/email-templates', express.static(path.join(__dirname, 'email-templates'), staticOptions));
app.use('/mockups', express.static(path.join(__dirname, 'mockups'), staticOptions));
app.use('/tests', express.static(path.join(__dirname, 'tests'), staticOptions));
app.use('/styles', express.static(path.join(__dirname, 'styles'), staticOptions));
app.use('/scripts', express.static(path.join(__dirname, 'scripts'), staticOptions));
app.use('/images', express.static(path.join(__dirname, 'images'), staticOptions));
app.use('/forms', express.static(path.join(__dirname, 'forms'), staticOptions));
app.use('/guides', express.static(path.join(__dirname, 'guides'), staticOptions));
app.use('/hr', express.static(path.join(__dirname, 'hr'), staticOptions));
app.use('/product', express.static(path.join(__dirname, 'product'), staticOptions));
app.use('/training', express.static(path.join(__dirname, 'training'), staticOptions));
app.use('/shared_components', express.static(path.join(__dirname, 'shared_components'), staticOptions));

// ── 3-Day Tees → Custom T-Shirts cutover (Erik approved 2026-06-10) ─────────
// The multi-style storefront replaced 3DT; all old entry URLs 301 to
// /custom-tees. MUST be registered BEFORE the /pages static mount or the
// static file wins. The SUCCESS page is deliberately NOT redirected —
// in-flight Stripe sessions still return to /pages/3-day-tees-success.html.
app.get(['/pages/3-day-tees.html', '/3-day-tees.html', '/3-day-tees'], (req, res) => {
  res.redirect(301, '/custom-tees');
});

app.use('/pages', express.static(path.join(__dirname, 'pages'), staticOptions));

// Serve CSS and JS files from root directory
app.get('/*.css', (req, res) => {
  const fileName = req.params[0] + '.css';
  res.sendFile(path.join(__dirname, fileName));
});

app.get('/*.js', (req, res) => {
  const fileName = req.params[0] + '.js';
  res.sendFile(path.join(__dirname, fileName));
});

// Redirect old embroidery-contract URL to unified page
app.get('/calculators/embroidery-contract*', (req, res) => {
  res.redirect(301, '/calculators/embroidery-pricing-all/?tab=al-cemb');
});

// No-cache helper used by every staff-dashboard route below so the live
// dashboard always fetches fresh CSS/JS after a deploy.
function noCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ===== Staff Dashboard (v3 sole survivor, cleanup 2026-05-28) =====
// 2026-05-13: v3 became canonical, v2/v1 kept as safety nets.
// 2026-05-28: v2 + v1 files deleted (no rollback ever needed in soak).
//   The /staff-dashboard-v2.html and /staff-dashboard-legacy.html URLs
//   now 301-redirect to canonical so old bookmarks still land on V3.
//   Recovery: `git show v2026.05.27.5:staff-dashboard.html` (or :staff-dashboard-legacy.html).

// Canonical URL — serves v3 (gated: verified SAML staff session required)
app.get('/staff-dashboard.html', requireStaff, (req, res) => {
  noCacheHeaders(res);
  res.sendFile(path.join(__dirname, 'staff-dashboard-v3', 'index.html'));
});

// Old v2 URL → redirect to canonical (file deleted 2026-05-28)
app.get('/staff-dashboard-v2.html', (req, res) => {
  res.redirect(301, '/staff-dashboard.html');
});

// Old v1 URL → redirect to canonical (file deleted 2026-05-28)
app.get('/staff-dashboard-legacy.html', (req, res) => {
  res.redirect(301, '/staff-dashboard.html');
});

// Old DTG legacy builder → redirect to the flagship (legacy files deleted 2026-06-08:
// dtg-quote-builder-legacy.html + dtg-quote-builder.js + dtg-quote-service.js — superseded by the v14 flagship).
app.get('/quote-builders/dtg-quote-builder-legacy.html', (req, res) => {
  res.redirect(301, '/quote-builders/dtg-quote-builder.html');
});

// v3 dedicated URL — preserved so any direct /staff-dashboard-v3/ bookmarks
// still resolve to the same content as the canonical URL.
app.get('/staff-dashboard-v3/', requireStaff, (req, res) => {
  noCacheHeaders(res);
  res.sendFile(path.join(__dirname, 'staff-dashboard-v3', 'index.html'));
});
app.get('/staff-dashboard-v3', (req, res) => {
  res.redirect(301, '/staff-dashboard-v3/');
});
app.get('/staff-dashboard-v3/index.html', requireStaff, (req, res) => {
  noCacheHeaders(res);
  res.sendFile(path.join(__dirname, 'staff-dashboard-v3', 'index.html'));
});
// Static assets under /staff-dashboard-v3/ (config.js, announcements-bootstrap.js,
// caspio-isolation.js). Reuse staticOptions so these also send no-cache headers.
app.use('/staff-dashboard-v3', express.static(path.join(__dirname, 'staff-dashboard-v3'), staticOptions));

app.get('/bundle-orders-dashboard.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'bundle-orders-dashboard.html'));
});

// Employee Bundle Pages
app.get('/DrainPro-Bundle.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'DrainPro-Bundle.html'));
});

app.get('/streich-bros-bundle.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'employee-bundles', 'streich-bros-bundle.html'));
});

app.get('/wcttr-bundle.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'employee-bundles', 'wcttr-bundle.html'));
});

app.get('/art-invoices-dashboard.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-invoices-dashboard.html'));
});

app.get('/art-invoice-view.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-invoice-view.html'));
});

app.get('/art-invoice-unified-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-invoice-unified-dashboard.html'));
});

// Removed duplicate route - webstore-info.html is now served from /pages/ directory (see line 328)

app.get('/universal-records-admin.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'universal-records-admin.html'));
});

app.get('/art-hub-steve.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-steve.html'));
});

app.get('/art-hub-ruth.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-ruth.html'));
});

// Ruth mockup detail page (serves for /mockup/123, /mockup/456, etc.)
app.get('/mockup/:id', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'pages', 'mockup-detail.html'));
});

// Customer Portal — session-gated (#6 Phase 2). The page derives its data from the verified
// customer LOGIN session (no id in the URL), so the old /portal/:customerId guess-the-id
// enumeration is closed. Logged-out visitors are bounced to /customer/login.
app.get('/portal', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'pages', 'customer-portal.html'));
});
// Back-compat: old URL-token links now redirect to the gated portal (then login if needed).
app.get('/portal/:customerId', (req, res) => res.redirect('/portal'));

app.get('/announcements-create.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-create.html'));
});

app.get('/announcements-manage.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-manage.html'));
});

// Serve the embroidery quote builder
app.get('/embroidery-quote-builder.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'quote-builders', 'embroidery-quote-builder.html'));
});

// Serve the cap embroidery quote builder
app.get('/cap-embroidery-quote-builder.html', (req, res) => {
  console.log('Serving cap-embroidery-quote-builder.html page');
  res.sendFile(path.join(__dirname, 'quote-builders', 'cap-embroidery-quote-builder.html'));
});

// Serve the cap embroidery pricing calculator (alias for integrated version)
app.get('/calculators/cap-embroidery-pricing.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'cap-embroidery-pricing-integrated.html'));
});

// Serve the DTG quote builder
app.get('/dtg-quote-builder.html', (req, res) => {
  console.log('Serving dtg-quote-builder.html page');
  res.sendFile(path.join(__dirname, 'quote-builders', 'dtg-quote-builder.html'));
});

// Serve the screen print quote builder
app.get('/screenprint-quote-builder.html', (req, res) => {
  console.log('Serving screenprint-quote-builder.html page');
  res.sendFile(path.join(__dirname, 'quote-builders', 'screenprint-quote-builder.html'));
});

app.get('/ae-art-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-tools', 'ae-art-dashboard.html'));
});

app.get('/ae-submit-art.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-tools', 'ae-submit-art.html'));
});

app.get('/ae-dashboard.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'ae-dashboard.html'));
});

app.get('/digitizingform.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'digitizingform.html'));
});

app.get('/purchasingform.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'purchasingform.html'));
});

app.get('/monogramform.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'monogramform.html'));
});

// Removed duplicate route - policies-hub.html is now served from /pages/ directory (see line 314)

// Christmas Bundles Calculator page
app.get('/christmas-bundles.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'christmas-bundles.html'));
});

// Breast Cancer Awareness Bundle page (Archived - October 2025 promotion)
app.get('/breast-cancer-awareness-bundle.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'archive', 'seasonal-2025', 'breast-cancer-awareness-bundle.html'));
});

// Serve the policies directory as static files
app.use('/policies', express.static(path.join(__dirname, 'policies'), staticOptions));

// Sanmar Vendor Management Pages
// SanMar vendor-portal pages (wholesale invoices/credits/portal) — were PUBLIC; now
// gated by the shared table-driven gate (login + Staff_Page_Access). Manage who sees
// each in the Access-Admin UI. Unlisted → any logged-in staff (login now required).
app.get('/sanmar-invoices.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-invoices.html'));
});

app.get('/sanmar-credits.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-credits.html'));
});

app.get('/sanmar-vendor-portal.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-vendor-portal.html'));
});

// Routes for pages moved to /pages/ directory
app.get('/inventory-details.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'inventory-details.html'));
});

app.get('/policies-hub.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'policies-hub.html'));
});

app.get('/resources.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'resources.html'));
});

app.get('/sale.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'sale.html'));
});

// Legacy webstore info page → consolidated into the SEO hub /company-webstores
// (2026-07-14) so the two don't cannibalize. 301 keeps its link equity.
app.get('/webstore-info.html', (req, res) => {
  res.redirect(301, '/company-webstores');
});

// Top Sellers consolidation (2026-07-06): the standalone showcase + per-style
// sample pages retired into /catalog?topSellers=1 (IsTopSeller-driven view w/
// sample program) and product.html ("Order a sample" CTA). 301s keep old
// bookmarks, emails, and SEO alive. /pages/* forms fall through the static
// mount once the files are gone.
app.get(['/top-sellers-showcase.html', '/pages/top-sellers-showcase.html'], (req, res) => {
  res.redirect(301, '/catalog?topSellers=1');
});

app.get(['/top-sellers-product.html', '/pages/top-sellers-product.html'], (req, res) => {
  const style = (req.query.style || '').toString();
  res.redirect(301, style
    ? `/product.html?style=${encodeURIComponent(style)}`
    : '/catalog?topSellers=1');
});

app.get('/sample-cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'sample-cart.html'));
});

app.get('/dtg-compatible-products.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dtg-compatible-products.html'));
});

// Richardson 112 one-off page retired with the top-sellers consolidation
// (2026-07-06) — the modern PDP serves style 112 through the shared engine.
app.get(['/richardson-112-product.html', '/pages/richardson-112-product.html'], (req, res) => {
  res.redirect(301, '/product.html?style=112');
});

app.get('/pricing-negotiation-policy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'pricing-negotiation-policy.html'));
});

// /3-day-tees.html sendFile route removed 2026-06-10 — the cutover 301
// (registered before the /pages static mount) now owns all 3DT entry URLs.

// Custom T-Shirts — multi-style DTG storefront (2026-06-10). Clean URL +
// .html alias; the success page resolves via the static /pages mount.
app.get(['/custom-tees', '/custom-tees.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-tees.html'));
});

// Catalog — dedicated URL-driven product discovery page (customer redesign P2,
// 2026-06-11). Clean URL + .html alias; same pattern as /custom-tees.
app.get(['/catalog', '/catalog.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'catalog.html'));
});

// Custom Hats — embroidered caps storefront (custom-caps channel, 2026-06-11).
// Clean URL + .html alias; success page resolves via the static /pages mount.
app.get(['/custom-caps', '/custom-caps.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-caps.html'));
});

// Custom Carhartt — static SEO brand landing page (2026-07-12): curated
// top-sellers grid + FAQ + ItemList/FAQPage schema. Targets "custom carhartt
// embroidered" buying-intent queries; content is fully static on purpose.
app.get(['/custom-carhartt', '/custom-carhartt.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-carhartt.html'));
});

// Custom Richardson — static SEO brand landing page (2026-07-13): the 112
// trucker + full Richardson cap lineup, leather/laser patches (NWCA specialty).
// Same static pattern as /custom-carhartt (shares its landing CSS/JS).
app.get(['/custom-richardson', '/custom-richardson.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-richardson.html'));
});

// Custom Nike — static SEO brand landing page (2026-07-13): Dri-FIT polos,
// Club Fleece, and caps embroidered in-house (the swoosh premium/gift play).
app.get(['/custom-nike', '/custom-nike.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-nike.html'));
});

// Custom New Era — static SEO brand landing page (2026-07-13): structured
// caps, flat-bill snapbacks, and beanies embroidered/patched in-house.
app.get(['/custom-new-era', '/custom-new-era.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-new-era.html'));
});

// Custom Sport-Tek — static SEO brand landing page (2026-07-13): performance
// polos, Competitor tees, and Sport-Wick 1/4-zips for teams & spirit wear.
app.get(['/custom-sport-tek', '/custom-sport-tek.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-sport-tek.html'));
});

// Custom OGIO — static SEO brand landing page (2026-07-13): premium performance
// polos, signature bags/packs, and soft-shell jackets, decorated in-house.
app.get(['/custom-ogio', '/custom-ogio.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-ogio.html'));
});

// Custom District — static SEO brand landing page (2026-07-13): retail-soft
// Very Important Tees, tri-blends, and fleece for merch & events.
app.get(['/custom-district', '/custom-district.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-district.html'));
});

// Custom Port Authority — static SEO brand landing page (2026-07-13): the
// corporate-apparel workhorse — caps, performance polos, soft-shell jackets.
app.get(['/custom-port-authority', '/custom-port-authority.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-port-authority.html'));
});

// Custom Port & Company — static SEO brand landing page (2026-07-13): value
// tees & Core Fleece for big orders, fundraisers, and events.
app.get(['/custom-port-and-company', '/custom-port-and-company.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-port-and-company.html'));
});

// Custom CornerStone — static SEO brand landing page (2026-07-13): ANSI hi-vis
// safety apparel, snag-proof tactical polos, Class 3 outerwear.
app.get(['/custom-cornerstone', '/custom-cornerstone.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-cornerstone.html'));
});

// Custom The North Face — static SEO brand landing page (2026-07-13): premium
// DryVent jackets, Skyline fleece, insulated vests — the gift people keep.
app.get(['/custom-north-face', '/custom-north-face.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-north-face.html'));
});

// Custom Gildan — static SEO brand landing page (2026-07-13): value screen-print
// blanks — Ultra Cotton tees & Heavy Blend hoodies for big runs.
app.get(['/custom-gildan', '/custom-gildan.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-gildan.html'));
});

// Custom Eddie Bauer — static SEO brand landing page (2026-07-13): premium
// outerwear — soft shell, rain & quilted jackets, executive-gift tier.
app.get(['/custom-eddie-bauer', '/custom-eddie-bauer.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-eddie-bauer.html'));
});

// Custom TravisMathew — static SEO brand landing page (2026-07-13): premium golf
// polos, 1/4-zips, and signature caps for tournaments & outings.
app.get(['/custom-travismathew', '/custom-travismathew.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-travismathew.html'));
});

// Custom Bella+Canvas — static SEO brand landing page (2026-07-13): premium
// soft jersey tees, tri-blends, and sponge fleece for merch & fashion drops.
app.get(['/custom-bella-canvas', '/custom-bella-canvas.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-bella-canvas.html'));
});

// Use-case landing pages (2026-07-13) — intent/occasion pages that cut across
// brands. Clean URLs so they're indexable; the file itself keeps its name.
// Golf tournament apparel page was built 2026-07-12 but had no clean URL/sitemap.
app.get(['/golf-tournament-apparel', '/golf-tournaments'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'golf-tournaments-2026.html'));
});

// Custom Safety STRIPE Apparel — use-case landing page (2026-07-13): screen-
// printed hi-vis safety-stripes program (stripe-layout gallery + recommended
// hi-vis blanks + Steve custom stripes) in golf-page showcase style.
app.get(['/custom-safety-apparel', '/custom-safety-apparel.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'custom-safety-apparel.html'));
});

// Company & Team Webstores — SEO hub (2026-07-14): the B2B "company store / team
// store / employee uniform store" cluster; hub-and-spoke (8 store-type cards) in
// golf-page showcase style. Supersedes the legacy /webstore-info.html (301'd below).
app.get(['/company-webstores', '/company-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'company-webstores.html'));
});

// Webstore SPOKE pages (2026-07-14) — niche stores prioritized by real InkSoft
// order data (id_OrderType=31): construction is #1 by volume. Each shows the
// products that niche actually orders. Flat keyword URLs; hub = /company-webstores.
app.get(['/construction-webstores', '/construction-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'construction-webstores.html'));
});
// Restaurant & hospitality spoke.
app.get(['/restaurant-webstores', '/restaurant-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'restaurant-webstores.html'));
});
// Remaining B2B webstore spokes (2026-07-14) — property mgmt, industrial, retail, government.
app.get(['/property-management-webstores', '/property-management-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'property-management-webstores.html'));
});
app.get(['/industrial-webstores', '/industrial-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'industrial-webstores.html'));
});
app.get(['/retail-webstores', '/retail-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'retail-webstores.html'));
});
app.get(['/government-webstores', '/government-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'government-webstores.html'));
});
// Webstore spokes wave 2 (2026-07-14) — team, school spirit, fundraising, college, event.
app.get(['/team-webstores', '/team-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'team-webstores.html'));
});
app.get(['/school-spirit-webstores', '/school-spirit-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'school-spirit-webstores.html'));
});
app.get(['/fundraising-webstores', '/fundraising-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'fundraising-webstores.html'));
});
app.get(['/college-webstores', '/college-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'college-webstores.html'));
});
app.get(['/event-webstores', '/event-webstores.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'event-webstores.html'));
});

// Core-pages sitemap (2026-07-12) — the handful of hand-built landing/tool
// pages that aren't in the blog or product sitemaps. Listed in robots.txt.
app.get('/sitemap-pages.xml', (req, res) => {
  const pages = [
    '/', '/custom-carhartt', '/custom-richardson', '/custom-nike', '/custom-new-era', '/custom-sport-tek', '/custom-ogio', '/custom-district', '/custom-port-authority', '/custom-port-and-company', '/custom-cornerstone', '/custom-north-face', '/custom-gildan', '/custom-eddie-bauer', '/custom-travismathew', '/custom-bella-canvas', '/golf-tournament-apparel', '/custom-safety-apparel', '/company-webstores', '/construction-webstores', '/restaurant-webstores', '/property-management-webstores', '/industrial-webstores', '/retail-webstores', '/government-webstores', '/team-webstores', '/school-spirit-webstores', '/fundraising-webstores', '/college-webstores', '/event-webstores', '/custom-tees', '/custom-caps', '/blog',
    '/brands.html', '/catalog?topSellers=1',
    '/pages/request-a-quote.html', '/pages/webstore-inquiry.html',
  ];
  const urls = pages.map((p) =>
    `  <url><loc>https://www.teamnwca.com${p.replace(/&/g, '&amp;')}</loc><changefreq>weekly</changefreq></url>`);
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
});

// Customer quote cart — sessionStorage quote builder (quote-cart Phase 2,
// 2026-06-11). Clean URL + .html alias; same pattern as /custom-tees.
app.get(['/quote-cart', '/quote-cart.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'quote-cart.html'));
});

// ── Customer order-status page (token link, no login — 2026-06-10) ──────────
// Linked from the confirmation emails as {{order_status_url}}. Same clean-URL
// pattern as /custom-tees; the page uses absolute /pages/... asset paths.
app.get(['/order-status', '/order-status.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'order-status.html'));
});

// ════════════════════════════════════════════════════════════════════════════
// Customer Portal — magic-link login (#6). Passwordless, invite-only. Identity is
// the Customer_Portal_Access Caspio table (Erik enables contacts). A verified click
// sets the separate nwca_customer signed cookie (see loadCustomerSession above).
// ════════════════════════════════════════════════════════════════════════════
const CUSTOMER_MAGIC_LINK_TEMPLATE = 'template_utvx9iw'; // EmailJS "Magic Link" template

// Rate-limit link requests per IP — blunts email-bombing + email enumeration probing.
const customerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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
app.get('/api/mo/orders', requireStaff, moForwardTo(() => 'orders'));
app.get('/api/mo/orders/:no', requireStaff, moForwardTo(req => 'orders/' + encodeURIComponent(req.params.no)));
app.get('/api/mo/lineitems/:no', requireStaff, moForwardTo(req => 'lineitems/' + encodeURIComponent(req.params.no)));

// Order_Payments ledger READ for the staff dashboard's Money Collected widget
// (2026-07-06). The proxy mounts /api/order-payments behind the CRM secret
// (payer emails = PII), so the browser goes through this staff-session-gated
// same-origin forwarder — same airtight pattern as /api/mo/* above.
app.get('/api/staff/payments/recent', requireStaff, async (req, res) => {
  if (!CRM_API_SECRET) return res.status(503).json({ error: 'not_configured' });
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const r = await fetch(`${CRM_API_BASE}/api/order-payments/recent?limit=${limit}`, {
      headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(15000)
    });
    const body = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(body);
  } catch (e) {
    console.error('[payments-forward]', e.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

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

// Login page (email entry). Public.
app.get('/customer/login', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-login.html'));
});

// Request a magic link. ALWAYS returns { ok:true } (constant shape) → no account enumeration.
app.post('/auth/customer/request-link', customerLoginLimiter, express.json(), async (req, res) => {
  const ok = () => res.json({ ok: true });
  try {
    if (!customerMagicLink.isConfigured()) { console.warn('[customer-login] MAGIC_LINK_SECRET not configured'); return ok(); }
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok();
    const access = await fetchPortalAccess(email);
    if (!access || !access.enabled || !/^\d+$/.test(String(access.id_Customer))) {
      console.log(`[customer-login] no enabled access for ${email}`);
      return ok();
    }
    const token = customerMagicLink.mintToken({ email, idCustomer: access.id_Customer });
    const link = `${PUBLIC_SITE_ORIGIN}/auth/customer/verify?token=${encodeURIComponent(token)}`;
    await sendEmailJSTemplate(CUSTOMER_MAGIC_LINK_TEMPLATE, {
      to_email: email,
      company_name: access.company_name || 'there',
      magic_link: link,
      expiry_minutes: String(customerMagicLink.LINK_TTL_MIN),
    }).catch((e) => console.error('[customer-login] email send failed:', e.message));
    console.log(`[customer-login] link sent to ${email} (customer ${access.id_Customer})`);
    return ok();
  } catch (e) {
    console.error('[customer-login] request-link error:', e.message);
    return ok();
  }
});

// Verify a magic link → live re-check Enabled → set the customer session cookie → /portal.
app.get('/auth/customer/verify', async (req, res) => {
  const fail = () => res.redirect('/customer/login?error=expired');
  try {
    if (!customerMagicLink.isConfigured()) return res.status(503).send('Customer login is temporarily unavailable.');
    let claim;
    try { claim = customerMagicLink.verifyToken(req.query.token); } catch (_) { return fail(); }
    // Re-check the LIVE invite: revoking Enabled kills outstanding links immediately, and
    // re-binds the token's claimed customer id to the table's truth (anti-tamper).
    const access = await fetchPortalAccess(claim.email);
    if (!access || !access.enabled || String(access.id_Customer) !== String(claim.idCustomer)) return fail();
    const sessionToken = customerMagicLink.mintSession({
      email: claim.email, idCustomer: access.id_Customer, companyName: access.company_name || '',
    });
    res.cookie('nwca_customer', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    const next = (typeof req.query.next === 'string' && req.query.next.startsWith('/portal')) ? req.query.next : '/portal';
    return res.redirect(next);
  } catch (e) {
    console.error('[customer-login] verify error:', e.message);
    return fail();
  }
});

// Logout — clear the customer cookie.
app.get('/auth/customer/logout', (req, res) => {
  res.clearCookie('nwca_customer');
  return res.redirect('/customer/login');
});

// Dedicated limiter for the status API: customers re-check this page over
// several days. The shared strictLimiter instance pools its 20/hr bucket with
// the ORDER SUBMISSION endpoints — riding on it would let status refreshes
// rate-limit real checkouts from the same IP.
const orderStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: { error: 'Too many requests, please try again shortly' },
});

// GET /api/order-status/:quoteId?t=<12-hex token>
// Token = first 12 hex chars of HMAC-SHA256(quoteId, ORDER_STATUS_SECRET),
// compared timing-safe. Returns ONLY a customer-safe projection — never
// CustomerNumber, Notes, push payloads, internal fees/margins, or staff
// email addresses. Wrong/missing token and missing row are indistinguishable
// (generic 404 — no oracle).
app.get('/api/order-status/:quoteId', orderStatusLimiter, async (req, res) => {
  try {
    const quoteId = String(req.params.quoteId || '');
    if (!process.env.ORDER_STATUS_SECRET) {
      // No secret → links can't exist. NEVER validate against a hardcoded
      // fallback secret.
      return res.status(503).json({ error: 'status links unavailable' });
    }

    const expected = computeOrderStatusToken(quoteId);
    const supplied = Buffer.from(String(req.query.t || ''), 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    if (supplied.length !== wanted.length || !crypto.timingSafeEqual(supplied, wanted)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let row;
    try {
      row = await fetchQuoteSessionRow(quoteId);
    } catch (lookupErr) {
      console.error('[OrderStatus] Lookup failed:', lookupErr.message);
      return res.status(503).json({ error: 'Order status temporarily unavailable' });
    }
    if (!row) return res.status(404).json({ error: 'Order not found' });

    const parse = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
    const customerData = parse(row.CustomerDataJSON);
    const colorConfigs = parse(row.ColorConfigsJSON);
    const orderTotals = parse(row.OrderTotalsJSON);
    const orderSettings = parse(row.OrderSettingsJSON);

    const deliveryMethod = customerData.deliveryMethod === 'pickup' ? 'pickup' : 'ship';
    const trackingNumber = row.TrackingNumber || null;

    // Customer-safe status ladder:
    //   TrackingNumber                         → 'shipped'
    //   ShippedAt w/o tracking on a pickup row → 'pickup-ready-soon'
    //   'Processed' or PushedToShopWorks       → 'in-production'
    //   'Payment Confirmed*' (incl. SW Failed) → 'paid'  (production state is internal)
    //   anything else                          → 'pending-payment'
    const rawStatus = String(row.Status || '');
    let status = 'pending-payment';
    if (rawStatus.indexOf('Payment Confirmed') !== -1) status = 'paid';
    if (rawStatus.indexOf('Processed') !== -1 || row.PushedToShopWorks) status = 'in-production';
    if (trackingNumber) {
      status = 'shipped';
    } else if (row.ShippedAt) {
      status = deliveryMethod === 'pickup' ? 'pickup-ready-soon' : 'shipped';
    }

    const items = [];
    Object.values(colorConfigs || {}).forEach((config) => {
      Object.entries((config && config.sizeBreakdown) || {}).forEach(([size, sd]) => {
        if (sd && sd.quantity > 0) {
          items.push({
            color: (config && config.displayColor) || '',
            size,
            qty: sd.quantity,
            unitPrice: Number(sd.unitPrice) || 0,
          });
        }
      });
    });

    res.json({
      quoteID: row.QuoteID,
      status,
      deliveryMethod,
      shipPromise: orderSettings.shipPromise || null,
      rush: !!orderSettings.rush,
      styleName: orderSettings.styleName || channelConfig(orderSettings.channel).fallbackProductName,
      items,
      totals: {
        subtotal: Number(orderTotals.subtotal) || 0,
        // Customer-PAID small-batch fee (0 on baked-pricing orders, >0 on
        // legacy rows) — included so Subtotal → Total visibly foots; the
        // confirmation emails + success page already show this line.
        ltmFee: Number(orderTotals.ltmFee) || 0,
        shipping: Number(orderTotals.shipping) || 0,
        tax: Number(orderTotals.salesTax) || 0,
        grandTotal: Number(orderTotals.grandTotal) || 0,
      },
      trackingNumber,
      shippedAt: row.ShippedAt || null,
      mockups: Array.isArray(orderSettings.mockups) ? orderSettings.mockups : [],
      orderDate: row.DateOrderPlaced || row.CreatedAt_Quote || row.CreatedAt || null,
    });
  } catch (error) {
    console.error('[OrderStatus] Error:', error);
    res.status(500).json({ error: 'Order status unavailable' });
  }
});

// =============================================================================
// Customer Portal — gated, customer-safe data (#1, 2026-06-29)
// =============================================================================
// The portal pages used to read raw rows straight from the public proxy
// (leaking YTD sales, staff emails, art charges, internal notes, and — via a
// broken `searchById` — other companies' data). These app-server endpoints
// fetch server-to-server and return an ALLOWLIST projection: raw proxy rows
// never reach the browser. Phase 1 trusts the URL customerId (data-minimization
// is the win); Phase 2 (magic-link login, #6) swaps `resolvePortalCustomer` to
// derive the customer from a verified session — the projection core is unchanged.
const PORTAL_PROXY = TDT_PROXY; // same caspio-pricing-proxy base
const PORTAL_DATE_CUTOFF = '2026-01-01T00:00:00'; // pre-2026 lacked consistent images

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again shortly' },
});

// Identity seam (#6 Phase 2): the verified customer SESSION wins. Falls back to the URL
// :customerId ONLY for the detail endpoints reached from un-logged-in art-approval EMAIL
// links (those rows are authorized by an ownership check downstream). A logged-in customer
// can therefore never be scoped to another company's id. The aggregate endpoint is
// session-ONLY (it does not use this resolver) — that closes the old enumeration IDOR.
function resolvePortalCustomer(req, res, next) {
  const sid = req.customerSession && req.customerSession.portalCustomer && req.customerSession.portalCustomer.idCustomer;
  if (sid && /^\d+$/.test(String(sid))) { req.portalCustomerId = String(sid); return next(); }
  const customerId = String(req.params.customerId || '');
  if (/^\d+$/.test(customerId)) { req.portalCustomerId = customerId; return next(); }
  return res.status(404).json({ error: 'Not found' });
}

function portalOrderTypeText(v) {
  if (v && typeof v === 'object') { const k = Object.keys(v); return k.length ? String(v[k[0]]) : ''; }
  return v || '';
}
function portalOnOrAfterCutoff(dateStr) {
  if (!dateStr) return true;            // never drop undated rows
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  return d >= new Date(PORTAL_DATE_CUTOFF);
}
// ALLOWLIST projections — copy ONLY customer-safe fields; never spread the raw row.
function projectPortalMockup(m) {
  return {
    ID: m.ID,
    Design_Number: m.Design_Number || null,
    Design_Name: m.Design_Name || null,
    Print_Location: m.Print_Location || null,
    Mockup_Type: m.Mockup_Type || null,
    Status: m.Status || null,
    Submitted_Date: m.Submitted_Date || null,
    Box_Mockup_1: m.Box_Mockup_1 || null,
  };
}
function projectPortalArt(a) {
  return {
    ID_Design: a.ID_Design || null,
    Design_Num_SW: a.Design_Num_SW || null,
    GarmentStyle: a.GarmentStyle || null,
    GarmentColor: a.GarmentColor || null,
    Order_Type: portalOrderTypeText(a.Order_Type),
    Status: a.Status || null,
    Date_Created: a.Date_Created || null,
    // The actual DESIGN proof (garment + logo / the artwork) — customer-safe. Prefer these over
    // MAIN_IMAGE_URL_1, which is a plain SanMar garment catalog photo ("just the shirt").
    // Deliberately NOT exposed: Art_Minutes, Amount_Art_Billed, Artwork_Locations, file paths, internal notes.
    Final_Approved_Mockup: a.Final_Approved_Mockup || null,
    Box_File_Mockup: a.Box_File_Mockup || null,
    Box_File_Link: a.BoxFileLink || null,
    MAIN_IMAGE_URL_1: a.MAIN_IMAGE_URL_1 || null,
  };
}

// Bound customer-portal upstream fetches: a stalled MO/proxy ABORTS to a visible 503 instead of
// hanging the tab forever (generous 12s — under Heroku's 30s H12, still allows a slow-but-valid
// response). AbortSignal.timeout rejects the fetch → the handler's existing try/catch → 503.
const PORTAL_FETCH_TIMEOUT_MS = 12000;
async function portalProxyGet(pathAndQuery) {
  // Server-to-server: always send the CRM secret so the proxy's PII-read gate
  // (artrequests/mockups) admits us. These calls carry no browser Origin.
  const headers = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const r = await fetch(PORTAL_PROXY + pathAndQuery, { headers, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`proxy ${r.status}`);
  return r.json();
}

// Customer-safe aggregate: company name + mockups-with-images + art-with-images (2026+).
async function getPortalData(customerId) {
  const cid = encodeURIComponent(customerId);
  const cutoff = encodeURIComponent(PORTAL_DATE_CUTOFF);

  const mResp = await portalProxyGet(`/api/mockups?idCustomer=${cid}&dateFrom=${cutoff}`);
  const mRecs = (mResp && (mResp.records || (Array.isArray(mResp) ? mResp : []))) || [];

  let aResp = await portalProxyGet(`/api/artrequests?shopworksCustomerId=${cid}&dateCreatedFrom=${cutoff}`);
  let aRecs = Array.isArray(aResp) ? aResp : ((aResp && aResp.records) || []);

  const companyName = (aRecs[0] && aRecs[0].CompanyName) || (mRecs[0] && mRecs[0].Company_Name) || null;

  // Art rows sometimes lack Shopwork_customer_number — fall back to company name.
  if (aRecs.length === 0 && companyName) {
    const byName = await portalProxyGet(`/api/artrequests?companyName=${encodeURIComponent(companyName)}&dateCreatedFrom=${cutoff}`);
    aRecs = Array.isArray(byName) ? byName : ((byName && byName.records) || []);
  }

  const mockups = mRecs
    .filter((m) => (m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3) && portalOnOrAfterCutoff(m.Submitted_Date))
    .map(projectPortalMockup);
  const artRequests = aRecs
    .filter((a) => (a.Final_Approved_Mockup || a.Box_File_Mockup || a.BoxFileLink || a.MAIN_IMAGE_URL_1 || a.MAIN_IMAGE_URL_2 || a.MAIN_IMAGE_URL_3 || a.MAIN_IMAGE_URL_4) && portalOnOrAfterCutoff(a.Date_Created))
    .map(projectPortalArt);

  // Logo library: the customer's FULL historical design set (all decoration methods) with
  // thumbnails, via Designs2026.ID_Customer → Shopworks_Thumbnail_Report. NOT date-gated —
  // this is their whole logo history. Thumbnails serve transparently from Caspio OR Box
  // (archived). Best-effort: a failure here must never break the rest of the portal.
  let logoLibrary = [];
  try {
    const lResp = await portalProxyGet(`/api/designs/by-customer/${cid}?method=all&limit=200`);
    logoLibrary = ((lResp && lResp.designs) || [])
      .filter((d) => d.thumbnailUrl)
      .map((d) => ({
        idDesign: d.idDesign || null,
        designName: d.designName || null,
        designType: d.designType || null,
        thumbnailUrl: d.thumbnailUrl,
        dateCreated: d.dateCreated || null,
      }));
  } catch (e) { console.warn('[Portal] logo library fetch failed:', e.message); }

  return { company: { name: companyName }, mockups, artRequests, logoLibrary };
}

// GET /api/portal — customer-safe aggregate for the LOGGED-IN customer. SESSION-SCOPED:
// the id comes ONLY from the verified session (#6 Phase 2), never the URL — this closes the
// old /api/portal/:customerId enumeration IDOR. Empty ≠ not-found (200 with empty arrays).
// Resolve the real company name from the customer's ORDERS (CustomerName) — the reliable
// fallback when the art/mockup-derived name is empty (a customer with no art on file), which
// is why the staff preview showed the generic "Your Company".
async function resolvePortalCompany(cid) {
  try {
    const today = new Date(); const end = today.toISOString().slice(0, 10);
    const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3); const start = sd.toISOString().slice(0, 10);
    const r = await fetch(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`,
      { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    if (!r.ok) return '';
    const orders = (await r.json()).result || [];
    for (const o of orders) { if (o.CustomerName) return String(o.CustomerName).trim(); }
    return '';
  } catch (_) { return ''; }
}

app.get('/api/portal', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const data = await getPortalData(cid);
    let companyName = (data.company && data.company.name) || req.customerSession.portalCustomer.companyName || '';
    if (!companyName) companyName = await resolvePortalCompany(cid);
    res.json(Object.assign({ customerId: cid }, data, { company: { name: companyName } }));
  } catch (err) {
    console.error('[Portal] aggregate failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// ── Customer portal ORDERS + INVOICES (#6 Phase 3) ─────────────────────────
// One ManageOrders fetch by id_Customer feeds BOTH the Orders table and the
// Invoices/Balances table (each order row carries cur_TotalInvoice/Payments/Balance).
// Status is derived from the milestone dates — reliable + customer-friendly. Only the
// customer's own order/money fields are projected (no rep, no internal ids, no costs).
// Erik 2026-07-01: customers only need "In Process" (still being worked) vs "Invoiced" (done).
// Drop "Shipped"/"In Production" — the customer doesn't track those milestones here.
function portalOrderStatus(o) {
  return o.date_Invoiced ? 'Invoiced' : 'In Process';
}
function projectPortalOrder(o) {
  const total = Number(o.cur_TotalInvoice) || 0;
  // cur_Payments is often null in this feed; cur_Balance is the authoritative "owed" amount,
  // so derive paid = total - balance (reliable for paid / partial / unpaid alike). If the
  // balance is unknown, assume the full amount is owed rather than falsely showing "Paid".
  const balRaw = o.cur_Balance;
  const balanceKnown = balRaw !== null && balRaw !== undefined && balRaw !== '';
  const balance = balanceKnown ? (Number(balRaw) || 0) : total;
  const paid = Math.max(0, total - balance);
  const paidStatus = !total ? '—' : (balance <= 0 ? 'Paid' : (balance < total ? 'Partial' : 'Open'));
  // Due date = date_Invoiced + TermsDays — same rule as projectPortalInvoice (the on-screen/PDF
  // invoice), so the Invoices table "Due" column can never disagree with the invoice itself.
  let dueDate = null;
  if (o.date_Invoiced) {
    // Parse the DATE portion as UTC midnight so setDate()/output stay on the same
    // calendar day regardless of dyno timezone, then emit DATE-ONLY (YYYY-MM-DD) —
    // the frontend parses it at local midnight, so a bare date can't day-shift.
    const di = new Date(String(o.date_Invoiced).slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(di.getTime())) {
      di.setUTCDate(di.getUTCDate() + (Number(o.TermsDays) || 0));
      dueDate = di.toISOString().slice(0, 10);
    }
  }
  return {
    orderNumber: o.id_Order || null,
    orderDate: o.date_Ordered || null,
    invoiceDate: o.date_Invoiced || null,
    shipDate: o.date_Shippied || null,
    dueDate: dueDate,
    designName: o.DesignName || null,
    poNumber: o.CustomerPurchaseOrder || null,
    quantity: o.TotalProductQuantity || null,
    status: portalOrderStatus(o),
    total: total, paid: paid, balance: balance,
    paidStatus: paidStatus,
  };
}

// Rep contact for the portal header card. The NAME comes from the customer's own orders
// (CustomerServiceRep — already customer-visible on every invoice we render, so exposing it
// here leaks nothing new). The EMAIL resolves through REP_NAME_BY_EMAIL (declared with the
// portal-admin console below — evaluated at request time, so declaration order is fine).
// Unknown/departed rep name → email null; the frontend falls back to the main line.
function portalRepFromOrders(rawOrders) {
  for (const o of rawOrders || []) {
    const name = o && o.CustomerServiceRep ? String(o.CustomerServiceRep).trim() : '';
    if (!name) continue;
    // Resolve name → email. If TWO reps share a display name, we can't know which
    // one this is, so return email null (name only, main-line fallback) rather than
    // guess wrong and route the customer's email to the wrong rep.
    const matches = Object.keys(REP_NAME_BY_EMAIL)
      .filter((em) => String(REP_NAME_BY_EMAIL[em]).toLowerCase() === name.toLowerCase());
    return { name: name, email: matches.length === 1 ? matches[0] : null };
  }
  return null;
}

// GET /api/portal/orders — the LOGGED-IN customer's orders + invoice balances (session-scoped).
app.get('/api/portal/orders', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startD = new Date(today); startD.setFullYear(today.getFullYear() - 3); // MO retains ~2yr
    const start = startD.toISOString().slice(0, 10);
    const url = `${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}` +
                `&date_Ordered_start=${start}&date_Ordered_end=${end}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {}, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('orders fetch ' + r.status);
    const j = await r.json();
    const raw = j.result || [];
    const orders = raw
      .map(projectPortalOrder)
      .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || ''))); // newest first
    res.json({ orders: orders, rep: portalRepFromOrders(raw) });
  } catch (err) {
    console.error('[Portal] orders failed:', err.message);
    res.status(503).json({ error: 'Orders temporarily unavailable' });
  }
});

// ── Customer portal INVOICE detail (#6 Phase 3) — ShopWorks-style, on-screen + PDF ──
function projectPortalLineItem(li) {
  return {
    partNumber: li.PartNumber || '',
    color: li.PartColor || '',
    description: li.PartDescription || '',
    quantity: Number(li.LineQuantity) || 0,
    unitPrice: Number(li.LineUnitPrice) || 0,
    lineTotal: (Number(li.LineQuantity) || 0) * (Number(li.LineUnitPrice) || 0),
    // Size01-06 = S / M / L / XL / 2XL / 3XL (SHOPWORKS_SIZE_MAPPING)
    sizes: [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06],
  };
}
function projectPortalInvoice(o, items) {
  const total = Number(o.cur_TotalInvoice) || 0;
  const balRaw = o.cur_Balance;
  const balanceKnown = balRaw !== null && balRaw !== undefined && balRaw !== '';
  const balance = balanceKnown ? (Number(balRaw) || 0) : total;
  let dueDate = null;
  if (o.date_Invoiced) {
    // Parse the DATE portion as UTC midnight so setDate()/output stay on the same
    // calendar day regardless of dyno timezone, then emit DATE-ONLY (YYYY-MM-DD) —
    // the frontend parses it at local midnight, so a bare date can't day-shift.
    const di = new Date(String(o.date_Invoiced).slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(di.getTime())) {
      di.setUTCDate(di.getUTCDate() + (Number(o.TermsDays) || 0));
      dueDate = di.toISOString().slice(0, 10);
    }
  }
  return {
    invoiceNumber: o.id_Order,
    dateOrdered: o.date_Ordered || null,
    dateInvoiced: o.date_Invoiced || null,
    dueDate: dueDate,
    designId: o.id_Design || null,
    customerName: o.CustomerName || '',
    customerNumber: o.id_Customer || null,
    contactName: [o.ContactFirstName, o.ContactLastName].filter(Boolean).join(' '),
    contactPhone: o.ContactPhone || '',
    contactEmail: o.ContactEmail || '',
    poNumber: o.CustomerPurchaseOrder || '',
    terms: o.TermsName || '',
    salesperson: o.CustomerServiceRep || '',
    designName: o.DesignName || '',
    items: items,
    totalQuantity: Number(o.TotalProductQuantity) || 0,
    subtotal: Number(o.cur_SubTotal) || 0,
    salesTax: Number(o.cur_SalesTaxTotal) || 0,
    shipping: Number(o.cur_Shipping) || 0,
    total: total,
    paid: Math.max(0, total - balance),
    balance: balance,
  };
}

// GET /api/portal/invoice/:orderNo — full invoice (header + line items) for ONE of the
// customer's orders. OWNERSHIP-VERIFIED against the session id_Customer (generic 404 on
// mismatch — a customer can never pull another company's invoice by changing the number).
app.get('/api/portal/invoice/:orderNo', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const orderNo = String(req.params.orderNo || '');
    if (!/^\d+$/.test(orderNo)) return res.status(404).json({ error: 'Not found' });
    const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
    const oR = await fetch(`${CRM_API_BASE}/api/manageorders/orders/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!oR.ok) throw new Error('order ' + oR.status);
    const oJ = await oR.json();
    const o = Array.isArray(oJ.result) ? oJ.result[0] : (oJ.result || oJ);
    if (!o || String(o.id_Customer) !== cid) return res.status(404).json({ error: 'Not found' });
    const lR = await fetch(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    const lJ = lR.ok ? await lR.json() : { result: [] };
    const items = (lJ.result || [])
      .sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0))
      .map(projectPortalLineItem);
    res.json(projectPortalInvoice(o, items));
  } catch (err) {
    console.error('[Portal] invoice failed:', err.message);
    res.status(503).json({ error: 'Invoice temporarily unavailable' });
  }
});

// ── Customer portal PHASE 4 — personalized catalog + request-to-rep re-order ──
// Reuses the customer's own order history (orders → line items) → distinct products,
// enriched with the SanMar image. Session-scoped + customer-safe (no costs/internal
// fields). The re-order action is a REQUEST that routes to the rep — NO price/payment.

const _portalPdCache = new Map(); // styleNumber → { rows, t } (successful, non-empty only)
const _PORTAL_PD_TTL_MS = 30 * 60 * 1000; // 30 min — a catalog change self-heals without a dyno restart
async function portalStyleRows(style) {
  const hit = _portalPdCache.get(style);
  if (hit && (Date.now() - hit.t) < _PORTAL_PD_TTL_MS) return hit.rows;
  let rows;
  try {
    const r = await fetch(`${CRM_API_BASE}/api/product-details?styleNumber=${encodeURIComponent(style)}`,
      { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    rows = r.ok ? await r.json() : [];
  } catch (_) { rows = []; }
  if (!Array.isArray(rows)) rows = [];
  // Only cache a SUCCESSFUL, non-empty result — never poison the cache with a
  // transient failure/empty, which previously 404'd the product page for EVERY
  // customer until a dyno restart. On failure, fall back to any prior good rows.
  if (rows.length) { _portalPdCache.set(style, { rows, t: Date.now() }); return rows; }
  return (hit && hit.rows) || rows;
}
// Prefer the per-COLOR model shot (FRONT_MODEL, e.g. DT6000_black_model_front.jpg) over the
// generic style image (PRODUCT_IMAGE = one DT6000.jpg for every color) so cards/pickers show the
// actual color the customer bought; fall back to the generic + flat when a color has no model shot.
function portalRowImage(row) { return row ? (row.FRONT_MODEL || row.PRODUCT_IMAGE || row.FRONT_FLAT || '') : ''; }
// Every product-image ANGLE we have for a color, in display order, deduped + non-empty — feeds the
// product-page gallery. SanMar exposes Model Front/Back/Side + Flat Front/Back per color; we fetch
// all but SIDE_MODEL today (add it to the proxy /api/product-details SELECT to light up the 5th
// angle — this skips empties, so a color's Side appears automatically once present). Falls back to
// the generic style image so a color with no shots still shows something.
function portalRowImages(row) {
  if (!row) return [];
  const src = [
    { url: row.FRONT_MODEL, label: 'Front' },
    { url: row.BACK_MODEL, label: 'Back' },
    { url: row.SIDE_MODEL, label: 'Side' },
    { url: row.FRONT_FLAT, label: 'Flat front' },
    { url: row.BACK_FLAT, label: 'Flat back' },
  ];
  const seen = new Set(), out = [];
  for (const s of src) { const u = s.url && String(s.url).trim(); if (u && !seen.has(u)) { seen.add(u); out.push({ url: u, label: s.label }); } }
  if (!out.length && row.PRODUCT_IMAGE) out.push({ url: row.PRODUCT_IMAGE, label: '' });
  return out;
}
// Robust color match (exact → catalog code → contains, all punctuation/space-insensitive) so
// "Jet Black" resolves to the Jet-Black garment image, not the style's default color. null = no match.
function portalMatchColor(rows, color) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = norm(color);
  if (!want) return null;
  return rows.find(x => norm(x.COLOR_NAME) === want)
    || rows.find(x => norm(x.CATALOG_COLOR) === want)
    || rows.find(x => { const c = norm(x.COLOR_NAME); return c && (c.includes(want) || want.includes(c)); })
    || null;
}
// Deduped color list (name + garment image + swatch) for the re-order color picker.
function portalColorList(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const name = r.COLOR_NAME;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const imgs = portalRowImages(r);
    out.push({ name, image: (imgs[0] && imgs[0].url) || portalRowImage(r), images: imgs, swatch: r.COLOR_SQUARE_IMAGE || '', catalogColor: r.CATALOG_COLOR || '' });
  }
  return out;
}
async function portalProductDisplay(style, color) {
  const rows = await portalStyleRows(style);
  const match = portalMatchColor(rows, color);
  const row = match || rows[0];
  return { image: portalRowImage(row), title: row ? row.PRODUCT_TITLE : '', matched: !!match };
}
// {S:2, M:4, …} from a line item's Size01–06 (SHOPWORKS_SIZE_MAPPING), non-zero only.
function portalSizeMap(li) {
  const L = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
  const m = {};
  [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06].forEach((v, i) => { const n = Number(v) || 0; if (n > 0) m[L[i]] = n; });
  return m;
}
// ShopWorks PartNumber → base SanMar style + color; null for fee / non-garment lines.
function portalNormalizePart(li) {
  const pn = String(li.PartNumber || '').trim();
  const color = String(li.PartColor || '').trim();
  if (!pn || !color) return null;                          // fee lines carry no color
  if (/^(SETUP|LTM|FEE|TAX|SHIP|DISC|RUSH|ART|GRT|MOCK|DIGI)/i.test(pn)) return null;
  const style = pn.split('_')[0];                          // ST254_2X → ST254 (NWCA uses _ only for size suffixes)
  return style ? { style, color } : null;
}
function portalSumSizes(li) {
  return [li.Size01, li.Size02, li.Size03, li.Size04, li.Size05, li.Size06]
    .reduce((s, v) => s + (Number(v) || 0), 0);
}

// Build the personalized catalog for a customer id. Shared by the customer endpoint AND
// the staff-preview mirror (so staff previewing a portal see the same catalog).
async function buildMyProducts(cid) {
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3);
  const start = sd.toISOString().slice(0, 10);
  // Orders + line items — bounded + PARALLEL. WAS 25 SEQUENTIAL line-item fetches with NO timeout
  // and a silent `catch(_){}`: one slow/flaky ManageOrders moment dropped orders and silently shrank
  // the catalog to a partial set (sometimes a single product). Now every call is timeout-bounded,
  // fetched in parallel, and retried once on a transient miss; the orders fetch surfaces a 503
  // (visible error, Erik's rule) rather than hanging. Same fix as buildProductDetail (2026-07-02).
  const ordersJson = await portalFetchJson(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`, hdrs, 8000);
  if (!ordersJson) throw new Error('orders unavailable');
  const orders = (ordersJson.result || [])
    .sort((a, b) => String(b.date_Ordered || '').localeCompare(String(a.date_Ordered || '')))
    .slice(0, 25); // bound the line-item fetches; recent orders capture the product variety
  const fetchLine = (id) => { const u = `${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(id)}`; return portalFetchJson(u, hdrs, 6000).then(j => j || portalFetchJson(u, hdrs, 6000)); };
  const lineJsons = await Promise.all(orders.map(o => o.id_Order ? fetchLine(o.id_Order) : Promise.resolve(null)));
  const products = new Map(); // baseStyle|color → product
  orders.forEach((o, oi) => {
    if (!o.id_Order) return;
    const items = (lineJsons[oi] && lineJsons[oi].result) || [];
    for (const li of items) {
      const norm = portalNormalizePart(li);
      if (!norm) continue;
      const key = norm.style.toUpperCase() + '|' + norm.color.toLowerCase();
      const qty = Number(li.LineQuantity) || portalSumSizes(li);
      const ex = products.get(key);
      if (!ex) {
        products.set(key, {
          style: norm.style, color: norm.color,
          description: li.PartDescription || '',
          designNumber: o.id_Design || null, designName: o.DesignName || null,
          lastOrdered: o.date_Ordered || null, lastQty: qty, totalQty: qty, timesOrdered: 1,
          sizes: portalSizeMap(li), _sizesFrom: o.date_Ordered,
        });
      } else {
        ex.timesOrdered++; ex.totalQty = (ex.totalQty || 0) + qty; if (!ex.lastQty) ex.lastQty = qty;
        // accumulate the size breakdown across the product's line items in the SAME (latest) order
        if (o.date_Ordered && o.date_Ordered === ex._sizesFrom) {
          const m = portalSizeMap(li);
          Object.keys(m).forEach(k => { ex.sizes[k] = (ex.sizes[k] || 0) + m[k]; });
        }
      }
    }
  });
  const list = [...products.values()];
  await Promise.all(list.map(async (p) => {
    const pd = await portalProductDisplay(p.style, p.color);
    p.image = pd.image; p.title = pd.title || p.description; p.colorMatched = pd.matched;
    delete p._sizesFrom;
  }));
  // Collapse to ONE card per STYLE (catalog-style): the most-recent color is the primary image,
  // and EVERY color the customer ordered becomes a swatch. (Was one card per style+color, which
  // repeated the same garment many times for customers who buy a style in several colors.)
  const byStyle = new Map();
  for (const p of list) {
    const k = String(p.style).toUpperCase();
    if (!byStyle.has(k)) byStyle.set(k, []);
    byStyle.get(k).push(p);
  }
  const grouped = [];
  for (const items of byStyle.values()) {
    items.sort((a, b) => String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || '')));
    const primary = items[0];                            // most-recent color → the card's main image + default
    const rows = await portalStyleRows(primary.style);   // cached (portalProductDisplay already fetched it)
    const primaryMatch = portalMatchColor(rows, primary.color);
    // Resolve each ordered color (a ShopWorks CATALOG_COLOR, e.g. "Hthrd Charcoal") to its SanMar
    // COLOR_NAME + swatch — portalMatchColor matches on CATALOG_COLOR — and MERGE spellings that map
    // to the same COLOR_NAME (SanMar sometimes exposes two catalog codes per color) so the piece
    // total isn't split. Display = COLOR_NAME; keep catalogColor so the FE can match on either.
    const byColor = new Map();
    for (const it of items) {
      if (!it.color) continue;
      const m = portalMatchColor(rows, it.color);
      const display = (m && m.COLOR_NAME) || it.color;
      const key = display.toLowerCase();
      const ex = byColor.get(key);
      if (ex) { ex.totalQty += Number(it.totalQty) || 0; }
      else byColor.set(key, {
        name: display, catalogColor: it.color,
        swatch: (m && m.COLOR_SQUARE_IMAGE) || '', image: it.image || (m ? portalRowImage(m) : ''),
        totalQty: Number(it.totalQty) || 0,
      });
    }
    const colors = [...byColor.values()];
    colors.sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0)); // most-ordered color first (the picker's "top color")
    const topColor = colors[0];                          // the customer's #1 color for this style
    grouped.push(Object.assign({}, primary, {
      color: (topColor && topColor.name) || (primaryMatch && primaryMatch.COLOR_NAME) || primary.color,  // card + modal default = TOP color
      image: (topColor && topColor.image) || primary.image,  // card shows the top-selling color's model shot (not the most-recent)
      colors,                                            // ordered colors (COLOR_NAME + catalogColor + swatch + total qty)
      colorCount: colors.length,
      styleTotalQty: items.reduce((s, x) => s + (Number(x.totalQty) || 0), 0),  // pieces of this style over the ~3yr window
      timesOrdered: items.reduce((s, x) => s + (Number(x.timesOrdered) || 1), 0),
    }));
  }
  grouped.sort((a, b) => String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || '')));
  return { products: grouped };
}
// Short-TTL memo so /my-products and /recommendations (both fired on portal load) SHARE one
// order-history fetch per customer instead of doubling the ManageOrders round-trips.
const _myProductsCache = new Map(); // cid → { t, promise }
function buildMyProductsCached(cid) {
  const key = String(cid);
  const hit = _myProductsCache.get(key);
  if (hit && (Date.now() - hit.t) < 120000) return hit.promise;
  const promise = buildMyProducts(key).catch(err => { _myProductsCache.delete(key); throw err; });
  _myProductsCache.set(key, { t: Date.now(), promise });
  return promise;
}

// Fetch JSON with a HARD timeout — a slow/hung upstream (ManageOrders) resolves to null instead of
// blocking the page. Non-ok / network error / timeout all collapse to null (caller = "no data").
function portalFetchJson(url, headers, ms) {
  return Promise.race([
    fetch(url, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), ms || 8000)),
  ]);
}

// ORDER_ODBC.ORDER_TYPE (ShopWorks order category) → decoration METHOD (Erik-confirmed 2026-07-03):
// Embroidery variants + Caps → EMB; Screenprint → SCP; Digital Printing / Contract DTG → DTG;
// Transfers → DTF. Storefront (Inksoft/Shopify), Art, Blank Goods, Emblem, etc. → '' (customer picks).
function orderTypeToMethod(orderType) {
  const t = String(orderType || '').toLowerCase();
  if (/embroider|\bcaps?\b/.test(t)) return 'EMB';
  if (/screen ?print/.test(t)) return 'SCP';
  if (/digital printing|\bdtg\b/.test(t)) return 'DTG';
  if (/transfer|\bdtf\b/.test(t)) return 'DTF';
  return '';
}

// Full product-detail for the portal PAGE: SanMar specs + ALL available colors + THIS customer's
// own order history for the style (per-color size MATRIX + per-order list). Customer-safe — NO
// cost/margin (PIECE_PRICE etc. are never copied out). null → unknown style (404).
async function buildProductDetail(cid, style) {
  const rows = await portalStyleRows(style);
  if (!rows.length) return null;
  const first = rows[0];
  const product = {
    style: first.STYLE || style,
    title: first.PRODUCT_TITLE || style,
    brand: first.BRAND_NAME || '',
    category: first.CATEGORY_NAME || '',
    subcategory: first.SUBCATEGORY_NAME || '',
    description: String(first.PRODUCT_DESCRIPTION || '').replace(/\s+/g, ' ').trim(),
    isCloseout: /discontinu|closeout|caution/i.test(String(first.PRODUCT_STATUS || '')),
    colors: portalColorList(rows),                                   // every available color
    companionStyles: String(first.COMPANION_STYLES || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean),
  };
  const styleU = String(style).toUpperCase();

  // The customer's ordered history for THIS style (same ~3yr / 25-order window as the catalog).
  const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const sd = new Date(today); sd.setFullYear(today.getFullYear() - 3);
  const start = sd.toISOString().slice(0, 10);
  let orders = [];
  const [ordersJson, orderOdbcJson] = await Promise.all([
    portalFetchJson(`${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}&date_Ordered_start=${start}&date_Ordered_end=${end}`, hdrs, 8000),
    portalFetchJson(`${CRM_API_BASE}/api/order-odbc?q.where=${encodeURIComponent('id_Customer=' + cid)}&q.limit=1000`, hdrs, 6000),
  ]);
  if (ordersJson && ordersJson.result) orders = ordersJson.result.sort((a, b) => String(b.date_Ordered || '').localeCompare(String(a.date_Ordered || ''))).slice(0, 25);
  // ORDER_ODBC (ShopWorks sync) → the decoration METHOD per past order, keyed by ID_Order (== ManageOrders id_Order).
  const methodByOrder = new Map();
  if (Array.isArray(orderOdbcJson)) orderOdbcJson.forEach(r => { const mm = orderTypeToMethod(r.ORDER_TYPE); if (r.ID_Order != null && mm) methodByOrder.set(String(r.ID_Order), mm); });

  // Fetch every order's line items IN PARALLEL, each bounded by a timeout — so a slow or hung
  // ManageOrders call can't stall the page (was 25 SEQUENTIAL fetches → seconds, or an indefinite hang).
  const lineJsons = await Promise.all(orders.map(o => o.id_Order
    ? portalFetchJson(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(o.id_Order)}`, hdrs, 6000)
    : Promise.resolve(null)));

  const byColor = new Map();   // COLOR_NAME(lower) -> aggregate (size matrix + totals)
  const history = [];          // per line: { orderNo, date, color, design, sizes, qty }
  orders.forEach((o, oi) => {
    if (!o.id_Order) return;
    const items = (lineJsons[oi] && lineJsons[oi].result) || [];
    for (const li of items) {
      const norm = portalNormalizePart(li);
      if (!norm || norm.style.toUpperCase() !== styleU) continue;
      const sizes = portalSizeMap(li);
      const qty = Number(li.LineQuantity) || portalSumSizes(li);
      if (qty <= 0) continue;
      const m = portalMatchColor(rows, norm.color);
      const display = (m && m.COLOR_NAME) || norm.color;   // CATALOG_COLOR -> COLOR_NAME (two-color-field rule)
      const ck = display.toLowerCase();
      history.push({ orderNo: o.id_Order, date: o.date_Ordered || '', color: display, design: o.id_Design || null, designName: o.DesignName || '', sizes, qty });
      const ex = byColor.get(ck);
      if (!ex) byColor.set(ck, { name: display, catalogColor: norm.color, swatch: (m && m.COLOR_SQUARE_IMAGE) || '', image: m ? portalRowImage(m) : '', sizes: Object.assign({}, sizes), totalQty: qty, orderCount: 1, lastOrdered: o.date_Ordered || '', firstOrdered: o.date_Ordered || '' });
      else {
        Object.keys(sizes).forEach(k => { ex.sizes[k] = (ex.sizes[k] || 0) + sizes[k]; });
        ex.totalQty += qty; ex.orderCount++;
        if ((o.date_Ordered || '') > ex.lastOrdered) ex.lastOrdered = o.date_Ordered || '';
        if (!ex.firstOrdered || ((o.date_Ordered || '') && (o.date_Ordered || '') < ex.firstOrdered)) ex.firstOrdered = o.date_Ordered || '';
      }
    }
  });
  const orderedColors = [...byColor.values()].sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0));
  const styleTotalQty = orderedColors.reduce((s, c) => s + (c.totalQty || 0), 0);
  const lastOrdered = orderedColors.reduce((d, c) => (c.lastOrdered > d ? c.lastOrdered : d), '');
  const firstOrdered = orderedColors.reduce((d, c) => (!d || (c.firstOrdered && c.firstOrdered < d) ? c.firstOrdered : d), '');
  const top = orderedColors[0] || product.colors[0] || null;
  const lastDesign = history.find(h => h.design) || {};
  // Default the re-order decoration method from the MOST RECENT past order of this style whose
  // ORDER_TYPE maps to a method (history is newest-first). '' → customer picks (storefront/ambiguous).
  let defaultMethod = '';
  for (const h of history) { const mm = methodByOrder.get(String(h.orderNo)); if (mm) { defaultMethod = mm; break; } }

  // The Erik-editable upgrade ladder for this category → the "upgrade to embroidery" module.
  // Margin fields are already stripped by the proxy; here we enrich with the premium garment
  // image + its colors + the pitch image. Best-effort — never blocks the page.
  let upgrades = [];
  if (product.category && CRM_API_SECRET) {
    try {
      const uR = await fetch(`${CRM_API_BASE}/api/product-upgrades?category=${encodeURIComponent(product.category)}&excludeStyle=${encodeURIComponent(product.style)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
      if (uR.ok) {
        const list = ((await uR.json()).upgrades || []).slice(0, 2);
        upgrades = await Promise.all(list.map(async (u) => {
          const urows = await portalStyleRows(u.style);
          const uf = urows[0] || {};
          return {
            style: u.style, title: u.title || uf.PRODUCT_TITLE || u.style, brand: uf.BRAND_NAME || '',
            tier: u.tier || '', stitch: Number(u.stitch) || 8000, location: u.location || 'Left Chest',
            blurb: u.blurb || '', pitchImage: u.image || '',
            image: portalRowImage(uf) || '', colors: portalColorList(urows).slice(0, 12),
          };
        }));
      }
    } catch (_) {}
  }

  return {
    product,
    ordered: { colors: orderedColors, styleTotalQty, lineCount: history.length, lastOrdered, firstOrdered },
    history: history.slice(0, 40),
    defaultColor: top ? top.name : '',
    defaultCatalogColor: top ? (top.catalogColor || '') : '',
    defaultImage: top ? (top.image || '') : '',
    designNumber: lastDesign.design || '',
    designName: lastDesign.designName || '',
    defaultMethod,
    upgrades,
  };
}

// Short-TTL memo so re-viewing the same product (or a quick reload) is instant instead of
// re-hitting ManageOrders. Keyed per (customer, style); errors are not cached.
const _productDetailCache = new Map();
function buildProductDetailCached(cid, style) {
  const key = String(cid) + '|' + String(style).toUpperCase();
  const hit = _productDetailCache.get(key);
  if (hit && (Date.now() - hit.t) < 120000) return hit.promise;
  const promise = buildProductDetail(cid, style).catch(err => { _productDetailCache.delete(key); throw err; });
  _productDetailCache.set(key, { t: Date.now(), promise });
  return promise;
}

// Per-size traffic light (in / low / out) from SanMar inventory for one style+color. Best-effort:
// any failure returns null so the page never blocks on the live SanMar call. NEVER raw numbers.
async function portalInventoryLights(style, color) {
  try {
    const url = `${CRM_API_BASE}/api/sanmar/inventory/${encodeURIComponent(style)}?color=${encodeURIComponent(color)}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {} });
    if (!r.ok) return null;
    const j = await r.json();
    const lights = {};
    (j.inventory || []).forEach((row) => {
      const q = Number(row.totalQty) || 0;
      lights[String(row.size)] = q <= 0 ? 'out' : (q < 48 ? 'low' : 'in');   // 48 ≈ a typical order run
    });
    return { color: j.color || color, lights };
  } catch (_) { return null; }
}

// PER-CUSTOMER recommendations from the Erik-curated candidate pool (Portal_Recommendations):
// drop anything the customer already buys, rank by absolute gross-margin $/pc, fill a fixed
// 4-premium / 2-popular mix, and show each in the customer's usual color when it exists. The pool
// carries the "Earn $X" Reward_Text (pill). Never throws the page empty. cid may be '' (staff w/o id).
const REC_PREMIUM_SLOTS = 4, REC_POPULAR_SLOTS = 2, REC_TOTAL = 6;
async function buildRecommendations(cid) {
  const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/recommendations`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error('recs ' + r.status);
  const pool = ((await r.json()).recommendations || []).filter(x => x.style);

  // What THIS customer already buys + the colors they order (best-effort; recs still work if it fails).
  const ownedStyles = new Set(); const colorByStyle = {}; const colorCount = {};
  if (cid) {
    try {
      const mine = (await buildMyProductsCached(cid)).products || [];
      for (const p of mine) {
        const bs = String(p.style || '').toUpperCase();
        if (bs) ownedStyles.add(bs);
        if (p.color) {
          colorCount[p.color] = (colorCount[p.color] || 0) + (Number(p.timesOrdered) || 1);
          if (bs && !colorByStyle[bs]) colorByStyle[bs] = p.color;
        }
      }
    } catch (_) { /* no history → recommend from the whole pool */ }
  }
  const houseColor = Object.keys(colorCount).sort((a, b) => colorCount[b] - colorCount[a])[0] || '';

  // Rank by absolute margin $/pc (Sell_Anchor × GP%); Erik's Priority is the tiebreak/override.
  const score = x => (Number(x.sellAnchor) || 0) * (x.gpPct > 1 ? x.gpPct / 100 : (Number(x.gpPct) || 0));
  const byRank = (a, b) => (a.priority - b.priority) || (score(b) - score(a));
  const avail = pool.filter(x => !ownedStyles.has(String(x.style).toUpperCase()));
  const premium = avail.filter(x => x.isPremium).sort(byRank);
  const popular = avail.filter(x => !x.isPremium).sort(byRank);

  // Fill 4 premium / 2 popular, backfilling from the other tier (premium first — that's the strategy).
  const picked = [];
  const fill = (arr, n) => { for (const x of arr) { if (picked.length >= REC_TOTAL || n <= 0) break; if (!picked.includes(x)) { picked.push(x); n--; } } };
  fill(premium, REC_PREMIUM_SLOTS);
  fill(popular, REC_POPULAR_SLOTS);
  fill([...premium, ...popular].filter(x => !picked.includes(x)), REC_TOTAL - picked.length);
  if (!picked.length) fill(pool.slice().sort(byRank), REC_TOTAL); // last-ditch: never empty

  // Enrich with the customer's usual color + image; keep the reward pill text from the pool.
  await Promise.all(picked.map(async (rec) => {
    const preferred = rec.color || colorByStyle[String(rec.style).toUpperCase()] || houseColor || '';
    const pd = await portalProductDisplay(rec.style, preferred);
    rec.color = pd.matched ? preferred : '';   // only claim a color if it matched a real garment image
    rec.image = pd.image; rec.title = rec.title || pd.title; rec.comingSoon = !pd.image;
  }));
  // Customer-safe projection — NEVER ship internal margin/cost fields (gpPct, sellAnchor, brand,
  // priority, isPremium) to the browser. Ranking above already used them; the card doesn't.
  return {
    recommendations: picked.map(r => ({
      style: r.style, color: r.color, title: r.title, blurb: r.blurb, category: r.category,
      image: r.image, comingSoon: r.comingSoon, rewardText: r.rewardText,
    })),
  };
}

// GET /api/portal/my-products — the logged-in customer's personalized re-order catalog.
app.get('/api/portal/my-products', portalLimiter, requireCustomer, async (req, res) => {
  try { res.json(await buildMyProductsCached(String(req.customerSession.portalCustomer.idCustomer))); }
  catch (err) { console.error('[Portal] my-products failed:', err.message); res.status(503).json({ error: 'Catalog temporarily unavailable' }); }
});
// GET /api/portal/recommendations — PER-CUSTOMER recs (pool ranked vs this customer's history).
app.get('/api/portal/recommendations', portalLimiter, requireCustomer, async (req, res) => {
  try { res.json(await buildRecommendations(String(req.customerSession.portalCustomer.idCustomer))); }
  catch (err) { console.error('[Portal] recommendations failed:', err.message); res.json({ recommendations: [] }); }
});
// GET /api/portal/product-colors/:style — available colors (name + garment image + swatch) for
// the re-order color picker. Public SanMar catalog data (no customer info), session-gated.
app.get('/api/portal/product-colors/:style', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const style = String(req.params.style || '').trim();
    if (!style) return res.status(400).json({ error: 'style required' });
    res.json({ colors: portalColorList(await portalStyleRows(style)) });
  } catch (err) { console.error('[Portal] product-colors failed:', err.message); res.json({ colors: [] }); }
});

// GET /api/portal/product/:style — full product-detail page data (specs + all colors + THIS
// customer's order history/size matrix). Session-scoped; customer-safe (no cost/margin).
app.get('/api/portal/product/:style', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const style = String(req.params.style || '').trim();
    if (!style) return res.status(400).json({ error: 'style required' });
    const detail = await buildProductDetailCached(String(req.customerSession.portalCustomer.idCustomer), style);
    if (!detail) return res.status(404).json({ error: 'Product not found' });
    res.json(detail);
  } catch (err) { console.error('[Portal] product detail failed:', err.message); res.status(503).json({ error: 'Product temporarily unavailable' }); }
});
// GET /api/portal/product/:style/availability?color= — per-size traffic light (async, best-effort).
app.get('/api/portal/product/:style/availability', portalLimiter, requireCustomer, async (req, res) => {
  const style = String(req.params.style || '').trim();
  const color = String(req.query.color || '').trim();
  if (!style || !color) return res.json({ lights: {} });
  res.json((await portalInventoryLights(style, color)) || { lights: {} });
});

// POST /api/portal/reorder-request — customer asks to re-order (or order a recommended item).
// Routes to the rep as a saved request + Slack ping. NO price/payment. The id_Customer,
// company, and email come from the verified SESSION — the client cannot spoof another company.
const reorderRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many requests — please wait a few minutes.' },
});
app.post('/api/portal/reorder-request', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const b = req.body || {};
    const style = String(b.style || '').trim();
    if (!style) return res.status(400).json({ error: 'Please choose a product.' });
    const payload = {
      id_Customer: cid,
      company_name: sess.companyName || '',
      email: sess.email || '',
      style: style.slice(0, 50),
      color: String(b.color || '').slice(0, 80),
      product_title: String(b.product_title || '').slice(0, 255),
      design_number: String(b.design_number || '').slice(0, 50),
      design_name: String(b.design_name || '').slice(0, 255),
      qty: String(b.qty || '').slice(0, 30),
      size_breakdown: String(b.size_breakdown || '').slice(0, 255),
      note: String(b.note || '').slice(0, 255),
      source: b.source === 'recommendation' ? 'recommendation' : 'reorder',
    };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, requestNum: j.request && j.request.Request_Num, rep: j.request && j.request.Rep });
  } catch (err) {
    console.error('[Portal] reorder-request failed:', err.message);
    res.status(502).json({ error: 'Could not send your request. Please try again or call (253) 922-5793.' });
  }
});

// POST /api/portal/reorder-batch — a multi-item "Re-order List" → one grouped rep ask (Batch_Num).
// id_Customer/company/email come from the verified SESSION (never the client). No price/payment.
app.post('/api/portal/reorder-batch', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const b = req.body || {};
    const validItems = (Array.isArray(b.items) ? b.items : [])
      .filter(it => it && String(it.style || '').trim());
    // Refuse an over-cap batch with a clear error instead of silently dropping items
    // past 30 (the client also caps at 30, but never rely on the client for this).
    if (validItems.length > 30) {
      return res.status(400).json({ error: 'Too many items — please send 30 or fewer per re-order request.' });
    }
    const items = validItems
      .map(it => ({
        style: String(it.style || '').slice(0, 50),
        color: String(it.color || '').slice(0, 80),
        product_title: String(it.product_title || '').slice(0, 255),
        design_number: String(it.design_number || '').slice(0, 50),
        design_name: String(it.design_name || '').slice(0, 255),
        qty: String(it.qty || '').slice(0, 30),
        size_breakdown: String(it.size_breakdown || '').slice(0, 255),
        method: String(it.method || '').slice(0, 30),
      }));
    if (!items.length) return res.status(400).json({ error: 'Your list is empty.' });
    const payload = { id_Customer: cid, company_name: sess.companyName || '', email: sess.email || '', items, note: String(b.note || '').slice(0, 255) };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, batchNum: j.batchNum, count: j.count, rep: j.rep });
  } catch (err) {
    console.error('[Portal] reorder-batch failed:', err.message);
    res.status(502).json({ error: 'Could not send your list. Please try again or call (253) 922-5793.' });
  }
});

// ── Customer portal PHASE 5 — reward dollars (READ balance + REDEEM as a request) ──
// The customer can only READ their balance and REQUEST a redemption — never change the
// ledger. All ledger writes are staff-initiated (admin console → /api/portal-admin/rewards/entry).

// GET /api/portal/rewards — the logged-in customer's reward-dollar balance + recent activity.
app.get('/api/portal/rewards', portalLimiter, requireCustomer, async (req, res) => {
  try {
    const cid = String(req.customerSession.portalCustomer.idCustomer);
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/balance/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('rewards ' + r.status);
    res.json(await r.json());
  } catch (err) {
    // Erik's #1 rule: never report a silent "$0" balance on failure — a customer
    // with reward $ would see their card vanish. Surface a 503 so the FE shows
    // "balance unavailable — refresh" instead of hiding the card.
    console.error('[Portal] rewards failed:', err.message);
    res.status(503).json({ error: 'rewards_unavailable' });
  }
});

// POST /api/portal/rewards/redeem-request — customer asks to apply reward $ to their next
// order. Does NOT change the balance — it lands in the rep queue (Source=redeem); the rep
// applies it to an order and records the deduction in the ledger via the admin console.
app.post('/api/portal/rewards/redeem-request', reorderRequestLimiter, requireCustomer, express.json(), async (req, res) => {
  try {
    const sess = req.customerSession.portalCustomer;
    const cid = String(sess.idCustomer);
    const amt = Number((req.body || {}).amount);
    if (!isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
    // Server-authoritative check against the live balance.
    const bR = await fetch(`${CRM_API_BASE}/api/customer-rewards/balance/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET } });
    const bal = bR.ok ? (Number((await bR.json()).balance) || 0) : 0;
    if (amt > bal + 0.001) return res.status(400).json({ error: `You have $${bal.toFixed(2)} available.` });
    const payload = {
      id_Customer: cid, company_name: sess.companyName || '', email: sess.email || '',
      style: 'REWARD', color: '', product_title: 'Redeem reward dollars', qty: '',
      note: `Customer requests to apply $${amt.toFixed(2)} of reward dollars to their next order.`,
      source: 'redeem',
    };
    const r = await fetch(`${CRM_API_BASE}/api/portal-reorder/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error((j && j.error) || ('proxy ' + r.status));
    res.json({ ok: true, requestNum: j.request && j.request.Request_Num, rep: j.request && j.request.Rep });
  } catch (err) {
    console.error('[Portal] redeem-request failed:', err.message);
    res.status(502).json({ error: 'Could not send your redemption request. Please try again.' });
  }
});

// Invoice page (session-gated). Reads the order # from the URL; the page fetches the
// secured /api/portal/invoice/:orderNo above (which re-checks ownership).
app.get('/portal/invoice/:orderNo', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-invoice.html'));
});
// Product detail page (session-gated). The page reads the style from the URL + fetches the
// secured /api/portal/product/:style above.
app.get('/portal/product/:style', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-product.html'));
});

// ════════════════════════════════════════════════════════════════════════════
// Customer Portal ADMIN (staff console) — send a login link + PREVIEW a customer's
// portal. All role-gated (PORTAL_ADMIN_ROLES). The preview endpoints are a READ-ONLY
// staff mirror: they reuse getPortalData + the order/invoice projections but take the
// id from the URL (not a customer session), so the customer security seam
// (requireCustomer / resolvePortalCustomer) is UNTOUCHED. A customer can never reach
// these — they require a verified STAFF (SAML) session with an allowed role.
// ════════════════════════════════════════════════════════════════════════════

// POST /api/portal-admin/send-link { email } — staff-initiated magic-link email. Unlike the
// public request-link route (which never reveals account state), this sits behind a staff
// role so it can tell the staffer whether the invite is enabled and the link went out.
app.post('/api/portal-admin/send-link', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  try {
    if (!customerMagicLink.isConfigured()) return res.status(503).json({ error: 'Magic-link login is not configured (MAGIC_LINK_SECRET missing).' });
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
    const access = await fetchPortalAccess(email);
    if (!access) return res.status(404).json({ error: 'That email is not invited yet. Add them first.' });
    if (!access.enabled) return res.status(409).json({ error: 'That invite is disabled. Enable it before sending a link.' });
    if (!/^\d+$/.test(String(access.id_Customer))) return res.status(409).json({ error: 'That invite has no valid customer id.' });
    const token = customerMagicLink.mintToken({ email, idCustomer: access.id_Customer });
    const link = `${PUBLIC_SITE_ORIGIN}/auth/customer/verify?token=${encodeURIComponent(token)}`;
    await sendEmailJSTemplate(CUSTOMER_MAGIC_LINK_TEMPLATE, {
      to_email: email,
      company_name: access.company_name || 'there',
      magic_link: link,
      expiry_minutes: String(customerMagicLink.LINK_TTL_MIN),
    });
    console.log(`[portal-admin] ${req.session.crmUser.email} sent a login link to ${email} (customer ${access.id_Customer})`);
    res.json({ success: true, email, sent: true });
  } catch (e) {
    console.error('[portal-admin] send-link failed:', e.message);
    res.status(502).json({ error: 'Could not send the login link. Please try again.' });
  }
});

// Map staff email → their EXACT CustomerServiceRep name in Sales_Reps_2026 (the join key
// for the console's "My customers" filter). These MUST match the Sales_Reps_2026 values
// verbatim — note Ruth is "Ruthie Nhoung" there, not "Ruth Nhoung".
const REP_NAME_BY_EMAIL = {
  'erik@nwcustomapparel.com': 'Erik Mickelson',
  'taneisha@nwcustomapparel.com': 'Taneisha Clark',
  'nika@nwcustomapparel.com': 'Nika Lao',
  'ruth@nwcustomapparel.com': 'Ruthie Nhoung',
  'jim@nwcustomapparel.com': 'Jim Mickelson',
};
// GET /api/portal-admin/me — who's logged in (for the Account Rep / "My customers" filter).
app.get('/api/portal-admin/me', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  const u = (req.session && req.session.crmUser) || {};
  const email = String(u.email || '').toLowerCase();
  const perms = (u.permissions || []).map(p => String(p).toLowerCase());
  res.json({
    email,
    firstName: u.firstName || '',
    repName: REP_NAME_BY_EMAIL[email] || null,
    seesAll: perms.includes('admin') || perms.includes('accountant'),
  });
});

// GET /api/portal-admin/preview/:id — the customer's portal aggregate (mockups + art +
// company), exactly as the customer sees it. Staff-only, READ-ONLY.
app.get('/api/portal-admin/preview/:id', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const data = await getPortalData(cid);
    let companyName = (data.company && data.company.name) || '';
    if (!companyName) companyName = await resolvePortalCompany(cid);
    res.json(Object.assign({ customerId: cid, staffPreview: true }, data, { company: { name: companyName } }));
  } catch (err) {
    console.error('[portal-admin] preview aggregate failed:', err.message);
    res.status(503).json({ error: 'Preview temporarily unavailable' });
  }
});

// GET /api/portal-admin/preview/:id/orders — the customer's orders + invoice balances.
app.get('/api/portal-admin/preview/:id/orders', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startD = new Date(today); startD.setFullYear(today.getFullYear() - 3);
    const start = startD.toISOString().slice(0, 10);
    const url = `${CRM_API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(cid)}` +
                `&date_Ordered_start=${start}&date_Ordered_end=${end}`;
    const r = await fetch(url, { headers: CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {}, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error('orders fetch ' + r.status);
    const j = await r.json();
    const raw = j.result || [];
    const orders = raw.map(projectPortalOrder)
      .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
    res.json({ orders, rep: portalRepFromOrders(raw) });
  } catch (err) {
    console.error('[portal-admin] preview orders failed:', err.message);
    res.status(503).json({ error: 'Orders preview temporarily unavailable' });
  }
});

// GET /api/portal-admin/preview/:id/my-products — the customer's catalog, for staff preview.
app.get('/api/portal-admin/preview/:id/my-products', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try { res.json(await buildMyProductsCached(cid)); }
  catch (err) { console.error('[portal-admin] preview my-products failed:', err.message); res.status(503).json({ error: 'Catalog preview unavailable' }); }
});
// GET /api/portal-admin/preview/:id/recommendations — PER-CUSTOMER recs, for staff preview.
// (Previously dropped :id and showed the generic list — now threads the previewed customer's id.)
app.get('/api/portal-admin/preview/:id/recommendations', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try { res.json(await buildRecommendations(cid)); }
  catch (err) { console.error('[portal-admin] preview recs failed:', err.message); res.json({ recommendations: [] }); }
});
// GET /api/portal-admin/preview/:id/product-colors/:style — color options, for staff preview.
app.get('/api/portal-admin/preview/:id/product-colors/:style', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  try { res.json({ colors: portalColorList(await portalStyleRows(String(req.params.style || ''))) }); }
  catch (err) { res.json({ colors: [] }); }
});
// GET /api/portal-admin/preview/:id/product/:style — full product detail, for staff preview.
app.get('/api/portal-admin/preview/:id/product/:style', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const detail = await buildProductDetailCached(cid, String(req.params.style || ''));
    if (!detail) return res.status(404).json({ error: 'Product not found' });
    res.json(detail);
  } catch (err) { console.error('[portal-admin] preview product failed:', err.message); res.status(503).json({ error: 'Product preview unavailable' }); }
});
app.get('/api/portal-admin/preview/:id/product/:style/availability', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const style = String(req.params.style || '').trim();
  const color = String(req.query.color || '').trim();
  if (!style || !color) return res.json({ lights: {} });
  res.json((await portalInventoryLights(style, color)) || { lights: {} });
});
// GET /api/portal-admin/preview/:id/rewards — reward-dollar balance, for staff preview.
app.get('/api/portal-admin/preview/:id/rewards', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  if (!/^\d+$/.test(cid)) return res.status(400).json({ error: 'numeric customer id required' });
  try {
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/balance/${encodeURIComponent(cid)}`, { headers: { 'X-CRM-API-Secret': CRM_API_SECRET }, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    res.json(r.ok ? await r.json() : { balance: 0, entries: [] });
  } catch (err) { res.json({ balance: 0, entries: [] }); }
});
// POST /api/portal-admin/rewards/entry — staff grant/adjust/redeem a reward entry. Stamps the
// STAFF email as Created_By (audit) — the client can't spoof it (that's why this isn't a raw crm-proxy write).
app.post('/api/portal-admin/rewards/entry', requireCrmRole(PORTAL_ADMIN_ROLES), express.json(), async (req, res) => {
  try {
    const body = Object.assign({}, req.body, { created_by: (req.session.crmUser && req.session.crmUser.email) || 'staff' });
    const r = await fetch(`${CRM_API_BASE}/api/customer-rewards/entry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET }, body: JSON.stringify(body) });
    res.status(r.status).json(await r.json());
  } catch (err) { console.error('[portal-admin] rewards entry failed:', err.message); res.status(502).json({ error: 'Could not save the reward entry.' }); }
});

// GET /api/portal-admin/preview/:id/invoice/:orderNo — one invoice, ownership-checked
// against the PREVIEWED customer id (staff can't pull an order that isn't this customer's).
app.get('/api/portal-admin/preview/:id/invoice/:orderNo', requireCrmRole(PORTAL_ADMIN_ROLES), async (req, res) => {
  const cid = String(req.params.id || '');
  const orderNo = String(req.params.orderNo || '');
  if (!/^\d+$/.test(cid) || !/^\d+$/.test(orderNo)) return res.status(400).json({ error: 'numeric ids required' });
  try {
    const hdrs = CRM_API_SECRET ? { 'X-CRM-API-Secret': CRM_API_SECRET } : {};
    const oR = await fetch(`${CRM_API_BASE}/api/manageorders/orders/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    if (!oR.ok) throw new Error('order ' + oR.status);
    const oJ = await oR.json();
    const o = Array.isArray(oJ.result) ? oJ.result[0] : (oJ.result || oJ);
    if (!o || String(o.id_Customer) !== cid) return res.status(404).json({ error: 'Not found' });
    const lR = await fetch(`${CRM_API_BASE}/api/manageorders/lineitems/${encodeURIComponent(orderNo)}`, { headers: hdrs, signal: AbortSignal.timeout(PORTAL_FETCH_TIMEOUT_MS) });
    const lJ = lR.ok ? await lR.json() : { result: [] };
    const items = (lJ.result || []).sort((a, b) => (Number(a.SortOrder) || 0) - (Number(b.SortOrder) || 0)).map(projectPortalLineItem);
    res.json(projectPortalInvoice(o, items));
  } catch (err) {
    console.error('[portal-admin] preview invoice failed:', err.message);
    res.status(503).json({ error: 'Invoice preview temporarily unavailable' });
  }
});

// Preview PAGES (staff-gated) — reuse the customer portal HTML, which detects the
// /portal-admin/preview/ path and fetches the staff endpoints above (read-only).
app.get('/portal-admin/preview/:id', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-portal.html'));
});
app.get('/portal-admin/preview/:id/invoice/:orderNo', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-invoice.html'));
});
app.get('/portal-admin/preview/:id/product/:style', requireCrmRole(PORTAL_ADMIN_ROLES), (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pages', 'customer-product.html'));
});

// ALLOWLIST projection for the art-request DETAIL customer view. Mirrors exactly
// the fields the ?view=customer render path displays (mapped + adversarially
// verified 2026-06-29). Excludes NOTES, Sales_Rep, staff/contact emails, phone,
// SW refs, art charges (Art_Minutes/Amount_Art_Billed/Prelim_Charges), internal
// statuses, Rep_Mockup, working files (File_Upload/CDN_Link), and the per-slot
// Mockup_N_Note fields (artist commentary, never shown to a customer).
function projectPortalArtDetail(a) {
  return {
    PK_ID: a.PK_ID, ID_Design: a.ID_Design || null, // ids needed for the existing customer approve/revise writes
    Status: a.Status || null, Revision_Count: a.Revision_Count || null, Artwork_Status: a.Artwork_Status || null,
    Is_Rush: a.Is_Rush || null, Is_On_Hold: a.Is_On_Hold || null, On_Hold_Note: a.On_Hold_Note || null,
    Request_Type: a.Request_Type || null, CompanyName: a.CompanyName || null,
    Order_Type: portalOrderTypeText(a.Order_Type), Order_Type_Source: a.Order_Type_Source || null,
    Item_Type: a.Item_Type || null, Item_Specs_Notes: a.Item_Specs_Notes || null,
    JDS_SKU: a.JDS_SKU || null, JDS_Design_Name: a.JDS_Design_Name || null, JDS_Color: a.JDS_Color || null,
    JDS_Placement: a.JDS_Placement || null, JDS_Quantity: a.JDS_Quantity || null,
    Due_Date: a.Due_Date || null, Date_Created: a.Date_Created || null, Garment_Placement: a.Garment_Placement || null,
    GarmentStyle: a.GarmentStyle || null, GarmentColor: a.GarmentColor || null,
    Garm_Style_2: a.Garm_Style_2 || null, Garm_Style_3: a.Garm_Style_3 || null, Garm_Style_4: a.Garm_Style_4 || null,
    Garm_Color_2: a.Garm_Color_2 || null, Garm_Color_3: a.Garm_Color_3 || null, Garm_Color_4: a.Garm_Color_4 || null,
    Swatch_1: a.Swatch_1 || null, Swatch_2: a.Swatch_2 || null, Swatch_3: a.Swatch_3 || null, Swatch_4: a.Swatch_4 || null,
    MAIN_IMAGE_URL_1: a.MAIN_IMAGE_URL_1 || null, MAIN_IMAGE_URL_2: a.MAIN_IMAGE_URL_2 || null,
    MAIN_IMAGE_URL_3: a.MAIN_IMAGE_URL_3 || null, MAIN_IMAGE_URL_4: a.MAIN_IMAGE_URL_4 || null,
    Artwork_Locations: a.Artwork_Locations || null, Color_Mode: a.Color_Mode || null, PMS_Colors: a.PMS_Colors || null,
    Thread_Colors: a.Thread_Colors || null, Underbase_Required: a.Underbase_Required || null, Exact_Text: a.Exact_Text || null,
    Uploaded_File_Type: a.Uploaded_File_Type || null,
    Prev_Order_Num: a.Prev_Order_Num || null, Prev_Design_Num: a.Prev_Design_Num || null,
    Repeat_Keep_Same: a.Repeat_Keep_Same || null, Repeat_Change: a.Repeat_Change || null,
    Final_Approved_Mockup: a.Final_Approved_Mockup || null,
    Box_File_Mockup: a.Box_File_Mockup || null, BoxFileLink: a.BoxFileLink || null, Company_Mockup: a.Company_Mockup || null,
    Mockup_4: a.Mockup_4 || null, Mockup_5: a.Mockup_5 || null, Mockup_6: a.Mockup_6 || null,
  };
}

// GET /api/portal/:customerId/art-request/:designId — customer-safe single art
// request (detail page customer view). Authorizes the row belongs to :customerId
// before returning; generic 404 on miss/mismatch (no enumeration oracle).
// Returns a 1-element array to match the client's existing [row]=artRequests shape.
app.get('/api/portal/:customerId/art-request/:designId', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const designId = String(req.params.designId || '');
    if (!/^\d+(\.\d+)?$/.test(designId)) return res.status(404).json({ error: 'Not found' });
    const resp = await portalProxyGet(`/api/artrequests?id_design=${encodeURIComponent(designId)}&limit=1`);
    const rows = Array.isArray(resp) ? resp : ((resp && resp.records) || []);
    const row = rows[0];
    const cid = req.portalCustomerId;
    const owns = row && (String(row.id_customer) === cid || String(row.Shopwork_customer_number) === cid);
    if (!owns) return res.status(404).json({ error: 'Not found' }); // missing OR not-this-customer → identical
    res.json([projectPortalArtDetail(row)]);
  } catch (err) {
    console.error('[Portal] art-request detail failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// ── Mockup detail customer view (#1 Stage C) ────────────────────────────────
// Derive ONLY a first name from a rep's email — the customer sees "Your Rep:
// Nika", never the raw staff email.
function portalRepDisplayName(v) {
  if (!v) return '';
  const s = String(v);
  const local = s.indexOf('@') >= 0 ? s.split('@')[0] : s;
  const first = local.split(/[._\s]/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}
// The customer notes list is hidden; notes only feed the status timeline, which
// keyword-matches Note_Text/Note_Type/Created_Date. Return ONLY the status
// keywords found (no real note content) so the timeline still dates its steps.
const PORTAL_TIMELINE_KEYWORDS = ['mockup sent', 'awaiting approval', 'revision requested', 'revision', 'working', 'in progress', 'approved', 'completed'];
function sanitizePortalNote(n) {
  const t = String(n.Note_Text || '').toLowerCase();
  return {
    Note_Type: n.Note_Type || null,
    Created_Date: n.Created_Date || null,
    Note_Text: PORTAL_TIMELINE_KEYWORDS.filter((k) => t.indexOf(k) >= 0).join(' '),
  };
}
function projectPortalVersion(v) { return { Slot_Key: v.Slot_Key, Version_Number: v.Version_Number }; }
function projectPortalThread(t) { return { Mockup_Slot: t.Mockup_Slot, Thread_Sequence_JSON: t.Thread_Sequence_JSON }; }
// ALLOWLIST projection for the mockup DETAIL customer view (mapped + verified).
// Excludes AE_Notes, Artist_Notes, Sales_Rep, Work_Order_Number, Id_Customer,
// Customer_Email, Box_Folder_ID, Deleted_*, Garment_*, Thread_Colors, Due/Completion
// dates; Submitted_By is reduced to a first-name only.
function projectPortalMockupDetail(m) {
  return {
    ID: m.ID, PK_ID: m.PK_ID,
    Status: m.Status || null, Revision_Count: m.Revision_Count || null,
    Is_On_Hold: m.Is_On_Hold || null, On_Hold_Note: m.On_Hold_Note || null,
    Design_Number: m.Design_Number || null, Company_Name: m.Company_Name || null, Design_Name: m.Design_Name || null,
    Mockup_Type: m.Mockup_Type || null, Print_Location: m.Print_Location || null,
    Logo_Width: m.Logo_Width || null, Logo_Height: m.Logo_Height || null, Stitch_Count: m.Stitch_Count || null,
    Design_Size: m.Design_Size || null, Size_Specs: m.Size_Specs || null,
    Submitted_Date: m.Submitted_Date || null, Submitted_By: portalRepDisplayName(m.Submitted_By),
    Customer_Name: m.Customer_Name || null, Customer_Approval_Sent_Date: m.Customer_Approval_Sent_Date || null,
    Box_Mockup_1: m.Box_Mockup_1 || null, Box_Mockup_2: m.Box_Mockup_2 || null, Box_Mockup_3: m.Box_Mockup_3 || null,
    Box_Mockup_4: m.Box_Mockup_4 || null, Box_Mockup_5: m.Box_Mockup_5 || null, Box_Mockup_6: m.Box_Mockup_6 || null,
  };
}
// Fetch + authorize a mockup belongs to :customerId; returns the raw row or null.
async function authorizePortalMockup(id, cid) {
  const resp = await portalProxyGet(`/api/mockups/${encodeURIComponent(id)}`);
  const rec = resp && resp.record;
  if (!rec || String(rec.Id_Customer) !== String(cid)) return null;
  return rec;
}

// GET /api/portal/:customerId/mockup/:id — bundled customer-safe mockup detail
// (record + sanitized timeline notes + version badges). Mirrors the shapes the
// client distributes ({success,record}, {notes}, {versions}).
app.get('/api/portal/:customerId/mockup/:id', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
    const rec = await authorizePortalMockup(id, req.portalCustomerId);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const [notesResp, versionsResp] = await Promise.all([
      portalProxyGet(`/api/mockup-notes/${encodeURIComponent(id)}`).catch(() => ({ notes: [] })),
      portalProxyGet(`/api/mockup-versions/${encodeURIComponent(id)}`).catch(() => ({ versions: [] })),
    ]);
    res.json({
      success: true,
      record: projectPortalMockupDetail(rec),
      notes: ((notesResp && notesResp.notes) || []).map(sanitizePortalNote),
      versions: ((versionsResp && versionsResp.versions) || []).map(projectPortalVersion),
    });
  } catch (err) {
    console.error('[Portal] mockup detail failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// GET /api/portal/:customerId/mockup/:id/threads — gated thread sequences
// (EMB_Design_Files) for the customer mockup view: Mockup_Slot + JSON only.
app.get('/api/portal/:customerId/mockup/:id/threads', portalLimiter, resolvePortalCustomer, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Not found' });
    const rec = await authorizePortalMockup(id, req.portalCustomerId);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const resp = await portalProxyGet(`/api/emb-designs/by-mockup/${encodeURIComponent(id)}`).catch(() => ({ records: [] }));
    res.json({ records: ((resp && resp.records) || []).map(projectPortalThread) });
  } catch (err) {
    console.error('[Portal] mockup threads failed:', err.message);
    res.status(503).json({ error: 'Portal temporarily unavailable' });
  }
});

// Brands browse page
app.get('/brands.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'brands.html'));
});

// Phase 1 Infrastructure Test Pages
app.get('/test-phase1-infrastructure.html', (req, res) => {
  console.log('Serving test-phase1-infrastructure.html page');
  res.sendFile(path.join(__dirname, 'tests', 'test-phase1-infrastructure.html'));
});

app.get('/test-phase1-verification.html', (req, res) => {
  console.log('Serving test-phase1-verification.html page');
  res.sendFile(path.join(__dirname, 'tests', 'test-phase1-verification.html'));
});

app.get('/test-screenprint-sizes.html', (req, res) => {
  console.log('Serving test-screenprint-sizes.html page');
  res.sendFile(path.join(__dirname, 'tests', 'test-screenprint-sizes.html'));
});

// Also serve the new JS files explicitly if needed
app.get('/app-new.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app-new.js'));
});

app.get('/autocomplete-new.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'autocomplete-new.js'));
});

app.get('/catalog-search.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'catalog-search.css'));
});

// API configuration
const API_BASE_URL = process.env.API_BASE_URL || `${CASPIO_PROXY_BASE}/api`;

// Helper function to make requests to the API
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
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

// ROUTE DEFINITIONS - Order matters!
// 1. First define the root route
app.get('/', (req, res) => {
  console.log('Serving index.html for root route');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Also serve index.html when accessed with .html extension
app.get('/index.html', (req, res) => {
  console.log('Serving index.html for /index.html route');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    apiBaseUrl: API_BASE_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Stripe Payment Integration - 3-Day Tees
// GET /api/stripe-config - Return Stripe publishable key
app.get('/api/stripe-config', (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const publishableKey = mode === 'production'
      ? process.env.STRIPE_LIVE_PUBLIC_KEY
      : process.env.STRIPE_TEST_PUBLIC_KEY;

    if (!publishableKey) {
      console.error('[Stripe] Publishable key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }

    console.log('[Stripe] Returning publishable key for mode:', mode);
    res.json({ publishableKey });
  } catch (error) {
    console.error('[Stripe] Error in stripe-config endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve Stripe configuration' });
  }
});

// POST /api/create-payment-intent - Create Stripe payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    // DEBUG: Log key info (without exposing full key)
    console.log('[Stripe Debug] Mode:', mode);
    console.log('[Stripe Debug] Key exists:', !!secretKey);
    console.log('[Stripe Debug] Key prefix:', secretKey?.substring(0, 12) + '...');
    console.log('[Stripe Debug] Key length:', secretKey?.length);
    console.log('[Stripe Debug] ENV STRIPE_MODE:', process.env.STRIPE_MODE);
    console.log('[Stripe Debug] ENV TEST_KEY exists:', !!process.env.STRIPE_TEST_SECRET_KEY);
    console.log('[Stripe Debug] ENV LIVE_KEY exists:', !!process.env.STRIPE_LIVE_SECRET_KEY);

    if (!secretKey) {
      console.error('[Stripe] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    // Initialize Stripe with the appropriate secret key
    const stripeInstance = stripe(secretKey);

    const { amount, currency, orderId, idempotencyKey } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'Missing required fields: amount and currency' });
    }

    console.log('[Stripe] Creating payment intent:', { amount, currency, mode, orderId });

    // Create payment intent with idempotency key to prevent duplicate charges
    const createOptions = {
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: orderId || 'unknown',
        source: '3-day-tees'
      }
    };

    // Create payment intent (with optional idempotency key to prevent duplicate charges)
    let paymentIntent;
    if (idempotencyKey) {
      console.log('[Stripe] Using idempotency key:', idempotencyKey.substring(0, 20) + '...');
      paymentIntent = await stripeInstance.paymentIntents.create(createOptions, {
        idempotencyKey: idempotencyKey
      });
    } else {
      paymentIntent = await stripeInstance.paymentIntents.create(createOptions);
    }

    console.log('[Stripe] Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('[Stripe] Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
});

// POST /api/three-day-tees/shipping-estimate — the number the studio page
// DISPLAYS for shipping. Same resolver the reprice charges with, so what the
// customer sees is what Stripe bills. {toZip, qty} → {amount, source}.
app.post('/api/three-day-tees/shipping-estimate', async (req, res) => {
  try {
    const { toZip, qty, styleNumber } = req.body || {};
    // styleNumber present → Custom-Tees caller (per-style piece weight);
    // absent → legacy 3DT page (PC54). Same resolver family either way.
    const resolved = styleNumber
      ? await resolveCtsShipping(toZip, qty, styleNumber)
      : await resolveTdtShipping(toZip, qty);
    res.json(resolved);
  } catch (e) {
    console.error('[3DT ship] estimate endpoint failed:', e);
    res.status(502).json({ error: 'Shipping estimate unavailable' });
  }
});

// POST /api/create-checkout-session - Create Stripe Checkout Session (hosted page)
// Rewritten 2026-06-09 (3-Day Tees studio rebuild): the server RECOMPUTES the
// whole price from Caspio (pricing-bundle + Service_Codes + DOR tax) and
// builds the Stripe line_items itself — the client total is only validated
// against it. Also: unique QuoteID (was random-collision-prone) and the
// binding ship-promise date stamped here, not in the browser.
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const {
      customer_email,
      customerData,
      colorConfigs,
      orderTotals,        // client quote — advisory, validated below
      orderSettings
    } = req.body;

    if (!customerData || !colorConfigs || !orderTotals) {
      return res.status(400).json({
        error: 'Missing required fields: customerData, colorConfigs, orderTotals'
      });
    }

    // Redirect URLs are pinned server-side (client-supplied URLs would be an
    // open redirect off a payment flow).
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // Channel registry dispatch: 'custom-tees' = the multi-style DTG
    // storefront (per-style bundle, online LTM, opt-in rush); absent/unknown
    // = legacy 3DT (the registry default — old rows must keep working).
    const chCfg = channelConfig(orderSettings && orderSettings.channel);
    const chLog = chCfg.logPrefix;

    // Artwork-rights attestation is REQUIRED for storefront orders (legal
    // record; the client checkbox is advisory — this is the enforcement).
    // The ack object is stored verbatim in OrderSettingsJSON. (2026-06-10)
    if (chCfg.requireRightsAck && !(orderSettings && orderSettings.rightsAck && orderSettings.rightsAck.checked)) {
      return res.status(400).json({
        error: 'Please confirm you own or have permission to print your artwork before checking out — nothing was charged.'
      });
    }

    // ── Authoritative server-side reprice ──────────────────────────────
    let priced;
    try {
      priced = await chCfg.rebuildQuote(colorConfigs, orderSettings, customerData);
    } catch (e) {
      console.error(`${chLog} Server reprice failed:`, e);
      // BELOW_MINIMUM: caps' structured 8-cap-minimum error (the module never
      // prices the 1-7 tier) — a customer-fixable input problem, like the
      // other two codes, so it 400s instead of 502ing.
      if (e.code === 'STYLE_NOT_ALLOWED' || e.code === 'RUSH_NOT_ELIGIBLE' || e.code === 'BELOW_MINIMUM') {
        return res.status(400).json({ error: e.message + ' — nothing was charged.' });
      }
      return res.status(502).json({
        error: 'Live pricing is unavailable right now — nothing was charged. Please try again or call 253-922-5793.'
      });
    }
    const { quote, tax } = priced;

    if (!quote.combinedQty || !quote.lines.length) {
      return res.status(400).json({ error: 'Order has no items' });
    }
    const clientTotal = parseFloat(orderTotals.grandTotal);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - quote.total) > 0.01) {
      console.error(`[3-Day Tees Checkout] PRICE MISMATCH client=$${clientTotal} server=$${quote.total}`);
      return res.status(409).json({
        error: `Pricing changed while you were designing (your screen: $${clientTotal?.toFixed ? clientTotal.toFixed(2) : clientTotal} · current: $${quote.total.toFixed(2)}). Refresh the page to reload live pricing — nothing was charged.`
      });
    }

    // Sanitize colorConfigs server-side before they become the order of
    // record: whitelisted sizes only, SERVER unit prices (the client's were
    // advisory — the ShopWorks push reads this JSON, and a doctored payload
    // must not ship uncharged shirts or mislabeled line prices).
    const cleanConfigs = {};
    const sizeWhitelist = chCfg.sizeWhitelist(priced);
    Object.values(colorConfigs).forEach(c => {
      if (!c || !c.catalogColor) return;
      const sizeBreakdown = {};
      let totalQuantity = 0;
      sizeWhitelist.forEach(size => {
        const q = parseInt((c.sizeBreakdown || {})[size] && c.sizeBreakdown[size].quantity, 10) || 0;
        if (q > 0) {
          sizeBreakdown[size] = { quantity: q, unitPrice: quote.unitBySize[size].finalPrice };
          totalQuantity += q;
        }
      });
      if (totalQuantity > 0) {
        cleanConfigs[c.catalogColor] = {
          catalogColor: c.catalogColor,
          displayColor: c.displayColor || c.catalogColor,
          totalQuantity,
          sizeBreakdown
        };
      }
    });

    // ── Live stock gate (CTS only, 2026-06-10) ─────────────────────────
    // Validate every color+size qty against live stock (helpers ~L1135)
    // BEFORE Stripe. Source is rush-aware: PC54 RUSH gates on Milton local
    // stock; standard orders gate on SanMar (next-day replenishment).
    // FAIL-OPEN: a feed error/timeout logs + stamps stockChecked:false
    // (push note flags it) — it never blocks the sale. A would-be shortage
    // is re-confirmed on a FRESH fetch before 409ing.
    let stockChecked = false;
    if (chCfg.stockGate) {
      try {
        // Conflict math is channel-bound: tees compare per color+size; caps
        // aggregate by CATALOG_COLOR (stale sized partIds in cap feeds).
        let stock = await getCtsStock(priced.style, false, priced.rush);
        let conflicts = chCfg.stockConflicts(cleanConfigs, stock);
        if (conflicts.length) {
          stock = await getCtsStock(priced.style, true, priced.rush);
          conflicts = chCfg.stockConflicts(cleanConfigs, stock);
        }
        if (conflicts.length) {
          const what = conflicts.map(c => `${c.displayColor} ${c.size} (you want ${c.want}, ${c.have} left)`).join(', ');
          console.warn(`${chLog} STOCK_CONFLICT ${priced.style}: ${what}`);
          return res.status(409).json({
            error: `Some sizes just sold out: ${what}. Adjust those quantities and try again — nothing was charged.`,
            code: 'STOCK_CONFLICT',
            conflicts
          });
        }
        stockChecked = true;
      } catch (e) {
        console.warn(`${chLog} Stock check unavailable for ${priced.style} — continuing unchecked (fail-open):`, e.message);
      }
    }

    // Server-stamped numbers become the order of record.
    const serverTotals = {
      totalQuantity: quote.combinedQty,
      subtotal: quote.shirtsSubtotal,
      rushFee: 0,                              // rush lives inside unit prices
      ltmFee: quote.ltmFee,
      shipping: quote.shipping,
      shippingSource: priced.shipping.source,  // 'ups-estimate' | 'flat' | 'pickup'
      salesTax: quote.tax,
      taxRate: quote.taxRate,
      taxableBase: quote.taxableBase,
      taxAccount: tax.account,
      taxAccountName: tax.accountName,
      grandTotal: quote.total
    };

    // Binding ship-promise date — stamped at payment time, echoed to the
    // success page and the ShopWorks order note. Custom-Tees standard orders
    // promise the END of the 7-10 business-day window; the rush toggle (or
    // legacy 3DT) uses the 3-day cutoff promise.
    const shipPlan = chCfg.shipPromise(priced);
    const promise = shipPlan.promise;
    const settingsStamped = Object.assign({}, orderSettings || {}, {
      shipPromise: {
        iso: promise.shipDateIso,
        label: promise.shipDateLong,
        mode: shipPlan.mode,
        rangeLabel: promise.rangeLabel || null,    // standard mode only
        stampedAt: new Date().toISOString()
      }
      // Channel-stamped style facts (custom-tees: server-validated channel/
      // style/rush/locations/stockChecked become the order of record — the
      // push + success page read THESE; legacy 3DT stamps nothing).
    }, chCfg.stampedOrderSettings(priced, stockChecked));

    // ── Unique QuoteID (random suffix used to collide same-day) ───────
    let quoteID = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = chCfg.buildQuoteId();
      try {
        // refresh=true is LOAD-BEARING: without it this pre-create lookup
        // caches [] under this QuoteID for 5 min on the proxy, and the
        // webhook's post-payment lookup reads that poisoned [] → "payment
        // without record". (Found in live verification 2026-06-09.)
        const check = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(candidate)}&refresh=true`);
        const rows = check.ok ? await check.json() : [];
        const list = Array.isArray(rows) ? rows : (rows?.data || []);
        if (!list.some(s => s.QuoteID === candidate)) { quoteID = candidate; break; }
        console.warn('[3-Day Tees Checkout] QuoteID collision, regenerating:', candidate);
      } catch (e) {
        // Uniqueness check unavailable — accept the candidate rather than block checkout
        quoteID = candidate;
        break;
      }
    }
    if (!quoteID) {
      return res.status(500).json({ error: 'Could not allocate an order number — please try again.' });
    }

    console.log('[3-Day Tees Checkout] Creating session for QuoteID:', quoteID,
      `($${quote.total.toFixed(2)}, ${quote.combinedQty} pcs, tax ${quote.taxRate ?? 0})`);

    // Save to Caspio BEFORE Stripe redirect (fail-closed: no save, no charge)
    try {
      await save3DTQuoteSession({
        quoteID,
        customerData,
        orderTotals: serverTotals,
        colorConfigs: cleanConfigs,
        orderSettings: settingsStamped,
        stripeSessionId: null
      });
      console.log('[3-Day Tees Checkout] ✓ Order saved to Caspio:', quoteID);
    } catch (error) {
      console.error('[3-Day Tees Checkout] Failed to save to Caspio:', error);
      return res.status(500).json({ error: 'Failed to save order data — nothing was charged. Please try again.' });
    }

    // ── Stripe line items built from the SERVER quote ──────────────────
    const cents = (v) => Math.round(v * 100);
    const lineName = (l) => chCfg.stripeLineName(priced, l);
    const line_items = quote.lines.map(l => ({
      price_data: {
        currency: 'usd',
        product_data: { name: lineName(l) },
        unit_amount: cents(l.unitPrice)
      },
      quantity: l.quantity
    }));
    if (quote.ltmFee > 0) {
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Small-batch fee (under ${priced.config.ltmThreshold} pieces)` }, unit_amount: cents(quote.ltmFee) },
        quantity: 1
      });
    }
    if (quote.shipping > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: priced.shipping.source === 'flat-under-threshold'
              ? `UPS Ground shipping (orders $${quote.shipFreeOver || 100}+ ship FREE)`
              : priced.shipping.source === 'ups-estimate'
                ? 'UPS Ground shipping (estimated for your ZIP)'
                : 'UPS Ground shipping (flat rate)'
          },
          unit_amount: cents(quote.shipping)
        },
        quantity: 1
      });
    }
    if (quote.tax > 0) {
      const pctLabel = String(Math.round(quote.taxRate * 10000) / 100);
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Sales tax (${pctLabel}%)` }, unit_amount: cents(quote.tax) },
        quantity: 1
      });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    if (!secretKey) {
      console.error('[Stripe Checkout] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    const stripeInstance = stripe(secretKey);

    // Create checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: line_items || [],
      mode: 'payment',
      customer_email: customer_email,
      success_url: `${siteOrigin}${chCfg.stripeSuccessPath(quoteID)}`,
      cancel_url: `${siteOrigin}${chCfg.stripeCancelPath()}`,
      metadata: {
        quoteID: quoteID,
        source: chCfg.stripeSource
        // NOTE: Full order data now stored in Caspio (not Stripe metadata)
        // Webhook will query Caspio using quoteID to retrieve order data
        // This eliminates Stripe's 500-character metadata limit
      }
    };

    const session = await stripeInstance.checkout.sessions.create(sessionConfig);

    console.log('[Stripe Checkout] Session created:', session.id);

    // Update Caspio with the Stripe session ID. The proxy's PUT only routes
    // by PK_ID (/quote_sessions/:id) — the legacy `PUT ?filter=QuoteID=` hit
    // no route and 404'd silently for months (SessionID never updated).
    // Bonus: this refresh=true read re-warms the lookup cache with the REAL
    // row, un-poisoning the pre-create [] entry for the webhook/success page.
    try {
      const lookup = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`);
      const rows = lookup.ok ? await lookup.json() : [];
      const row = (Array.isArray(rows) ? rows : (rows?.data || [])).find(s => s.QuoteID === quoteID);
      if (row && row.PK_ID) {
        await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            SessionID: `stripe_${session.id}`,
            Notes: `${chCfg.orderNoteLabel({ rush: priced.rush, styleNumber: priced.style })} | Stripe Session: ${session.id} | Status: Checkout Created`
          })
        });
        console.log('[3-Day Tees Checkout] ✓ Updated Caspio with Stripe session ID');
      } else {
        console.warn('[3-Day Tees Checkout] Could not resolve PK_ID to stamp the Stripe session ID (non-fatal)');
      }
    } catch (error) {
      console.error('[3-Day Tees Checkout] Failed to update Caspio with session ID:', error);
      // Don't fail the request - order is already in Caspio
    }

    res.json({
      sessionId: session.id,
      quoteID: quoteID,
      url: session.url
    });

  } catch (error) {
    console.error('[Stripe Checkout] Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

// ══ POST /api/samples/create-checkout-session — Sample Program (2026-07-06) ══
// Paid BLANK samples go through Stripe hosted checkout. Free-only carts never
// come here (they keep the direct ManageOrders push the free program has
// always used — sample-order-service.js). This route is DEDICATED because
// sample carts are multi-STYLE (one unit per style) and don't fit the shared
// single-style storefront route above. Money rules:
//   • Server reprices EVERY sample via shared_components/js/sample-pricing.js
//     — the SAME dual-load module the browser buttons use (client prices are
//     advisory; a doctored payload can't buy a jacket for tee money).
//   • Free items ride along as $0 Stripe lines so ONE ShopWorks order carries
//     the whole cart (webhook 'samples-order' branch pushes it PAID).
//   • Shipping is always FREE (Erik decision); WA tax = DOR destination
//     lookup on the shipping address (lookup failure = visible 502, never a
//     guessed rate).
app.post('/api/samples/create-checkout-session', async (req, res) => {
  const chCfg = channelConfig('samples');
  const chLog = chCfg.logPrefix;
  try {
    const { customerData, samples, clientSubtotal } = req.body || {};
    if (!customerData || !customerData.email || !Array.isArray(samples) || !samples.length) {
      return res.status(400).json({ error: 'Missing required fields: customerData, samples' });
    }
    if (samples.length > 12) {
      return res.status(400).json({ error: 'Sample carts are limited to 12 items — call 253-922-5793 for a larger request.' });
    }
    const siteOrigin = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // ── Authoritative server-side reprice (one sample per style) ─────────
    const seen = new Set();
    const priced = [];
    for (const s of samples) {
      const style = String((s && s.style) || '').trim().toUpperCase();
      const size = String((s && s.size) || '').trim();
      if (!style || !size) {
        return res.status(400).json({ error: 'Each sample needs a style and a size — nothing was charged.' });
      }
      if (seen.has(style)) {
        return res.status(400).json({ error: `Duplicate style in the cart: ${style} (one sample per style) — nothing was charged.` });
      }
      seen.add(style);

      const spr = await fetch(`${TDT_PROXY}/api/size-pricing?styleNumber=${encodeURIComponent(style)}`);
      const rows = spr.ok ? await spr.json() : null;
      let result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: null, size });
      if (!result.eligible && result.reason === 'no_margin') {
        const br = await fetch(`${TDT_PROXY}/api/pricing-bundle?method=BLANK&styleNumber=${encodeURIComponent(style)}`);
        const bundle = br.ok ? await br.json() : null;
        result = SAMPLE_PRICING.priceSample({ sizePricingRows: rows, blankBundle: bundle, size });
      }
      if (!result.eligible) {
        console.warn(`${chLog} ${style} not sample-eligible (${result.reason})`);
        return res.status(400).json({
          error: result.reason === 'bad_size'
            ? `${style} isn’t offered in size ${size} — remove it and try again. Nothing was charged.`
            : `${style} isn’t available as an online sample right now — remove it and try again, or call 253-922-5793. Nothing was charged.`
        });
      }
      priced.push({
        style,
        size,
        name: String(s.name || style).slice(0, 120),
        color: String(s.color || '').slice(0, 60),
        catalogColor: String(s.catalogColor || s.color || '').slice(0, 60),
        type: result.type,
        price: result.price
      });
    }

    const paidSubtotal = Math.round(priced.reduce((sum, p) => sum + (p.type === 'paid' ? p.price : 0), 0) * 100) / 100;
    if (paidSubtotal <= 0) {
      // Belt and braces — the page routes all-free carts to the request form.
      return res.status(400).json({ error: 'Every sample in this cart is FREE — submit the request form instead (no payment needed).', code: 'FREE_ONLY' });
    }

    // WA destination tax on the SHIPPING address (samples always ship — the
    // form has no pickup mode). Shipping is free, so taxable = paid subtotal.
    let tax;
    try {
      tax = await resolveTdtTax({
        deliveryMethod: 'ship',
        state: customerData.shipping_state,
        city: customerData.shipping_city,
        zip: customerData.shipping_zip,
        address1: customerData.shipping_address1
      });
    } catch (e) {
      console.error(`${chLog} Tax lookup failed:`, e.message);
      return res.status(502).json({ error: 'Sales-tax lookup is unavailable right now — nothing was charged. Please try again or call 253-922-5793.' });
    }
    const salesTax = Math.round(paidSubtotal * tax.rate * 100) / 100;
    const grandTotal = Math.round((paidSubtotal + salesTax) * 100) / 100;

    // Client comparison is PRE-TAX (the page never knows the DOR rate — tax
    // renders as its own line on the Stripe page). Same 1¢ tolerance as the
    // shared route's grand-total gate.
    const client = parseFloat(clientSubtotal);
    if (!Number.isFinite(client) || Math.abs(client - paidSubtotal) > 0.01) {
      console.error(`${chLog} PRICE MISMATCH client=$${client} server=$${paidSubtotal} (pre-tax)`);
      return res.status(409).json({
        error: `Pricing changed while you were browsing (your screen: $${Number.isFinite(client) ? client.toFixed(2) : client} · current: $${paidSubtotal.toFixed(2)} before tax). Refresh the page to reload live pricing — nothing was charged.`
      });
    }

    // ── Unique SAM QuoteID (same collision-retry loop as the shared route;
    // refresh=true is LOAD-BEARING — see the shared route's comment) ──────
    let quoteID = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = chCfg.buildQuoteId();
      try {
        const check = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(candidate)}&refresh=true`);
        const rowsQ = check.ok ? await check.json() : [];
        const list = Array.isArray(rowsQ) ? rowsQ : (rowsQ?.data || []);
        if (!list.some((r) => r.QuoteID === candidate)) { quoteID = candidate; break; }
        console.warn(`${chLog} QuoteID collision, regenerating:`, candidate);
      } catch (e) {
        quoteID = candidate;
        break;
      }
    }
    if (!quoteID) {
      return res.status(500).json({ error: 'Could not allocate an order number — please try again.' });
    }

    const serverTotals = {
      totalQuantity: priced.length,
      subtotal: paidSubtotal,
      ltmFee: 0,
      shipping: 0,
      shippingSource: 'free-samples',
      salesTax,
      taxRate: tax.rate,
      taxableBase: paidSubtotal,
      taxAccount: tax.account,
      taxAccountName: tax.accountName,
      grandTotal
    };
    const settingsStamped = {
      channel: 'samples',
      samples: priced,   // SERVER-priced — the webhook push reads THESE
      creditNote: 'Sample cost credited toward first decorated order',
      stampedAt: new Date().toISOString()
    };

    console.log(`${chLog} Creating session for`, quoteID,
      `($${grandTotal.toFixed(2)}: ${priced.length} samples, ${priced.filter((p) => p.type === 'paid').length} paid, tax ${tax.rate})`);

    // Save to Caspio BEFORE Stripe (fail-closed: no save, no charge).
    // colorConfigs {} is deliberate: buildStorefrontQuoteItems returns [] for
    // it, so no junk quote_items rows — the samples live in OrderSettingsJSON.
    try {
      await save3DTQuoteSession({
        quoteID,
        customerData,
        orderTotals: serverTotals,
        colorConfigs: {},
        orderSettings: settingsStamped,
        stripeSessionId: null
      });
      console.log(`${chLog} ✓ Order saved to Caspio:`, quoteID);
    } catch (error) {
      console.error(`${chLog} Failed to save to Caspio:`, error);
      return res.status(500).json({ error: 'Failed to save order data — nothing was charged. Please try again.' });
    }

    // ── Stripe line items from the SERVER reprice ─────────────────────────
    const cents = (v) => Math.round(v * 100);
    const line_items = priced.map((p) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: p.type === 'paid'
            ? `Sample — ${p.name} — ${p.color}, ${p.size}`
            : `FREE sample — ${p.name} — ${p.color}, ${p.size}`
        },
        unit_amount: cents(p.type === 'paid' ? p.price : 0)
      },
      quantity: 1
    }));
    if (salesTax > 0) {
      const pctLabel = String(Math.round(tax.rate * 10000) / 100);
      line_items.push({
        price_data: { currency: 'usd', product_data: { name: `Sales tax (${pctLabel}%)` }, unit_amount: cents(salesTax) },
        quantity: 1
      });
    }

    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;
    if (!secretKey) {
      console.error(`${chLog} Secret key not configured for mode:`, mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }
    const stripeInstance = stripe(secretKey);

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: customerData.email,
      // Single payable session per order + auto-expiry (double-charge
      // hardening, same as the quote-deposit flow's 2026-07-06 audit fix)
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${siteOrigin}${chCfg.stripeSuccessPath(quoteID)}`,
      cancel_url: `${siteOrigin}${chCfg.stripeCancelPath()}`,
      metadata: {
        quoteID,
        source: chCfg.stripeSource,
        kind: 'samples-order'   // webhook fulfillment branch selector
      }
    });
    console.log(`${chLog} Session created:`, session.id);

    // Stamp the Stripe session id onto the Caspio row (PK_ID-routed PUT; the
    // refresh=true read also un-poisons the pre-create [] lookup cache).
    try {
      const lookup = await fetch(`${TDT_PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`);
      const rowsL = lookup.ok ? await lookup.json() : [];
      const row = (Array.isArray(rowsL) ? rowsL : (rowsL?.data || [])).find((r) => r.QuoteID === quoteID);
      if (row && row.PK_ID) {
        await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            SessionID: `stripe_${session.id}`,
            Notes: `${chCfg.orderNoteLabel()} | Stripe Session: ${session.id} | Status: Checkout Created`
          })
        });
      }
    } catch (error) {
      console.error(`${chLog} Failed to stamp Stripe session id (non-fatal):`, error);
    }

    res.json({ sessionId: session.id, quoteID, url: session.url });
  } catch (error) {
    console.error(`${chLog} Error creating session:`, error);
    res.status(500).json({ error: 'Failed to create checkout session — nothing was charged.', message: error.message });
  }
});

// POST /api/verify-checkout-session - Verify Stripe Checkout session after redirect
app.post('/api/verify-checkout-session', async (req, res) => {
  try {
    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    if (!secretKey) {
      console.error('[Stripe Verify] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    const stripeInstance = stripe(secretKey);
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    console.log('[Stripe Verify] Verifying session:', sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items']
    });

    console.log('[Stripe Verify] Session status:', session.payment_status);

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      console.warn('[Stripe Verify] Payment not complete:', session.payment_status);
      return res.status(400).json({
        error: 'Payment not completed',
        status: session.payment_status,
        sessionId: sessionId
      });
    }

    // Return success with payment details
    res.json({
      success: true,
      paymentStatus: session.payment_status,
      sessionId: sessionId,
      paymentIntentId: session.payment_intent?.id || session.payment_intent,
      amountTotal: session.amount_total / 100, // Convert from cents to dollars
      currency: session.currency,
      customerEmail: session.customer_email,
      metadata: session.metadata,
      lineItems: session.line_items?.data || []
    });

  } catch (error) {
    console.error('[Stripe Verify] Error verifying session:', error);
    res.status(500).json({
      error: 'Failed to verify checkout session',
      message: error.message
    });
  }
});

// POST /api/submit-3day-order - Submit 3-Day Tees order to ShopWorks via ManageOrders PUSH API
app.post('/api/submit-3day-order', async (req, res) => {
  try {
    const {
      tempOrderNumber,
      customerData,
      colorConfigs,
      orderTotals,
      pricingData,
      orderSettings,
      paymentConfirmed,
      stripeSessionId,
      paymentAmount
    } = req.body;

    console.log('[3-Day Order] Received order submission:', {
      orderNumber: tempOrderNumber,
      paymentConfirmed,
      stripeSessionId
    });

    // Validate required fields
    if (!tempOrderNumber || !customerData || !colorConfigs) {
      return res.status(400).json({
        error: 'Missing required order data'
      });
    }

    // paymentConfirmed from an EXTERNAL caller must be proven against Stripe —
    // this endpoint is public (success-page fallback) and would otherwise let
    // anyone inject "paid" orders into ShopWorks. The webhook self-call skips
    // the round-trip (it already verified the Stripe signature) via the
    // process-internal header. (3DT rebuild review fix, 2026-06-09)
    if (paymentConfirmed && req.get('x-nwca-internal') !== INTERNAL_CALL_KEY) {
      try {
        const mode = process.env.STRIPE_MODE || 'development';
        const secretKey = mode === 'production'
          ? process.env.STRIPE_LIVE_SECRET_KEY
          : process.env.STRIPE_TEST_SECRET_KEY;
        const stripeInstance = stripe(secretKey);
        const s = await stripeInstance.checkout.sessions.retrieve(String(stripeSessionId || ''));
        if (!s || s.payment_status !== 'paid' || (s.metadata && s.metadata.quoteID && s.metadata.quoteID !== tempOrderNumber)) {
          return res.status(403).json({ success: false, error: 'Payment could not be verified with Stripe' });
        }
      } catch (e) {
        console.error('[3-Day Order] Stripe payment verification failed:', e.message);
        return res.status(403).json({ success: false, error: 'Payment could not be verified with Stripe' });
      }
    }

    // Channel registry: push constants + banners come from the entry for
    // orderSettings.channel (absent/unknown → legacy 3DT defaults).
    const pushCfg = channelConfig(orderSettings && orderSettings.channel);
    const pushC = pushCfg.push;

    // Build line items from colorConfigs
    // Structure: { catalogColor: { displayColor, sizeBreakdown: { size: { quantity, unitPrice } } } }
    // Style: Custom-Tees orders carry the SERVER-VALIDATED style in
    // orderSettings (stamped at checkout from the curated-catalog whitelist);
    // legacy 3DT orders fall through to PC54.
    const lineItems = [];
    const styleNumber = orderSettings?.styleNumber || pricingData?.styleNumber || pushC.fallbackStyleNumber;
    const productName = orderSettings?.styleName || pricingData?.productName || pushCfg.fallbackProductName;

    for (const [catalogColor, config] of Object.entries(colorConfigs)) {
      if (config.sizeBreakdown) {
        for (const [size, sizeData] of Object.entries(config.sizeBreakdown)) {
          if (sizeData && sizeData.quantity > 0) {
            lineItems.push({
              partNumber: styleNumber,
              description: productName,
              // CATALOG_COLOR keys ShopWorks/inventory — COLOR_NAME is display
              // only ("Dark Heather Grey" would not match SKU color
              // "Dk Hthr Grey"). Rule #2 in CLAUDE.md; review fix 2026-06-09.
              color: config.catalogColor || catalogColor,
              size: size,
              quantity: parseInt(sizeData.quantity),
              price: sizeData.unitPrice || 0
            });
          }
        }
      }
    }

    console.log('[3-Day Order] Built lineItems:', lineItems.length, 'items');

    // Add Less Than Minimum fee as a line item (if applicable).
    // partNumber stays 'LTM-75' (a stable ShopWorks SKU, via the channel
    // registry); the description reflects the ACTUAL fee from Caspio
    // Service_Codes 3DT-LTM.
    if (orderTotals?.ltmFee && orderTotals.ltmFee > 0) {
      lineItems.push({
        partNumber: pushC.ltmPartNumber,
        description: `Less Than Minimum $${Number(orderTotals.ltmFee).toFixed(2)}`,
        color: '',
        size: '',
        quantity: 1,
        price: orderTotals.ltmFee
      });
      console.log('[3-Day Order] Added LTM fee line item: $' + orderTotals.ltmFee);
    }

    // Extract unique product colors from the order for "For Product Colors" field
    const uniqueColors = [...new Set(
      Object.values(colorConfigs)
        .map(config => config.displayColor)
        .filter(Boolean)
    )];
    const productColorsString = uniqueColors.join(', ');

    console.log('[3-Day Order] Product colors for design:', productColorsString);

    // Extract artwork URLs and build designs block
    const designs = [];
    const frontLogo = orderSettings?.frontLogo?.fileUrl || orderSettings?.uploadedFiles?.front;
    const backLogo = orderSettings?.backLogo?.fileUrl || orderSettings?.uploadedFiles?.back;
    const printLocation = orderSettings?.printLocationCode || 'LC';

    // Side flags: CTS free-placement orders carry SERVER-VALIDATED
    // frontLocation ('LC'|'FF'|'JF'|null) + backLocation ('FB'|'JB'|null)
    // stamped at checkout; legacy 3DT only has printLocationCode. The old
    // `indexOf('_FB')` gating silently DROPPED back art for the new JB/back-
    // only codes — a paid Jumbo-Back print production never saw. (audit
    // CRITICAL fix 2026-06-10)
    const stampedFront = orderSettings?.frontLocation || null;
    const stampedBack = orderSettings?.backLocation || null;
    const frontCode = stampedFront || printLocation.split('_')[0];
    const hasFrontPrint = stampedFront ? true : !/^(FB|JB)$/.test(printLocation);
    const hasBackPrint = stampedBack ? true : /(^|_)(FB|JB)$/.test(printLocation);

    // Map location codes to exact ShopWorks dropdown values (channel
    // registry — caps will use different OnSite dropdown values).
    // ShopWorks accepts: 'Full Back', 'Full Front', 'Left Chest', 'Right Chest'
    // — jumbos map to the nearest dropdown value; the exact 16×20 dims ride in
    // the location notes + placement spec. (audit HIGH fix 2026-06-10)
    const SW_LOC = pushC.swLocationMap;
    const frontLocationName = SW_LOC[frontCode] || pushC.defaultFrontLocationName;
    const backLocationName = SW_LOC[stampedBack] || pushC.defaultBackLocationName;

    console.log('[3-Day Order] Artwork URLs:', { frontLogo, backLogo, printLocation, frontCode, stampedBack, frontLocationName, hasFrontPrint, hasBackPrint });

    if (frontLogo || backLogo) {
      const design = {
        name: `${tempOrderNumber} - Customer Logo`,  // "name" field expected by proxy transformDesigns
        externalId: `${pushC.designExternalIdPrefix}${tempOrderNumber}`,  // External ID for tracking
        productColor: productColorsString,  // T-shirt colors from order → "For Product Colors" field
        designTypeId: pushC.designTypeId,  // 45 = DTG (channel registry)
        artistId: pushC.artistId,          // 224 = 3-Day Tees routing
        locations: []
      };

      // Front location only when the order actually HAS a front print
      if (frontLogo && hasFrontPrint) {
        design.locations.push({
          location: frontLocationName,  // Exact ShopWorks dropdown value
          colors: pushC.designLocationColors,  // DTG = Full Color
          code: `${tempOrderNumber}-FRONT`,
          imageUrl: frontLogo,
          customField01: frontLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          notes: 'Customer uploaded artwork' + (frontCode === 'JF' ? ' — JUMBO FRONT 16×20″ (see placement spec)' : ''),
          details: pushC.designDetails()
        });
      }

      // Back location ONLY when the charged order includes a back print —
      // a stray backLogo on a front-only-priced order must not print free.
      if (backLogo && hasBackPrint) {
        design.locations.push({
          location: backLocationName,
          colors: pushC.designLocationColors,  // DTG = Full Color
          code: `${tempOrderNumber}-BACK`,
          imageUrl: backLogo,
          customField01: backLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          notes: 'Customer uploaded artwork (back) - See Attachments tab for image' + (stampedBack === 'JB' ? ' — JUMBO BACK 16×20″ (see placement spec)' : ''),
          details: pushC.designDetails()
        });
      }

      // Only add design if we have at least one location
      if (design.locations.length > 0) {
        designs.push(design);
      }
    }

    console.log('[3-Day Order] Built designs:', designs.length, 'design(s)');

    // Build attachments array for artwork files (OnSite may download from Attachments)
    const attachments = [];
    if (frontLogo) {
      attachments.push({
        mediaUrl: frontLogo,
        mediaName: `${tempOrderNumber} - Front Artwork`,
        linkNote: 'Customer uploaded artwork (front)'
      });
    }
    if (backLogo && hasBackPrint) {
      attachments.push({
        mediaUrl: backLogo,
        mediaName: `${tempOrderNumber} - Back Artwork`,
        linkNote: 'Customer uploaded artwork (back)'
      });
    }

    // Designer mockups (customer-approved composites) ride along so production
    // sees EXACTLY what the customer approved. Capped to keep payloads sane.
    (orderSettings?.mockups || []).slice(0, 8).forEach((m) => {
      if (m && m.url) {
        attachments.push({
          mediaUrl: m.url,
          mediaName: `${tempOrderNumber} - Approved mockup ${m.color || ''} ${m.view || ''}`.trim(),
          linkNote: 'Customer-approved designer mockup'
        });
      }
    });

    console.log('[3-Day Order] Built attachments:', attachments.length, 'attachment(s)');

    // Human-readable placement spec for the press operator (mirrors the
    // designer's inch-based, top-center-anchored placement contract).
    function placementLine(label, p) {
      if (!p) return null;
      const horiz = !p.xIn ? 'centered'
        : (p.xIn > 0 ? `${Math.abs(p.xIn).toFixed(2)}in right of center` : `${Math.abs(p.xIn).toFixed(2)}in left of center`);
      const dims = p.hIn ? `${p.wIn}w x ${p.hIn}h in` : `${p.wIn}in wide`;
      const dpi = p.effectiveDpi ? `, ${p.effectiveDpi} DPI${p.lowDpiAck ? ' (CUSTOMER ACCEPTED LOW-RES)' : ''}` : '';
      const proof = p.previewable === false ? ' — FILE NOT PREVIEWABLE, MATCH PLACEMENT + SEND PROOF' : '';
      const warns = Array.isArray(p.warnings) && p.warnings.length
        ? ` WARNINGS: ${p.warnings.join(', ')}.` : '';
      return `${label}: art ${dims}, ${horiz}, ${Number(p.yIn).toFixed(2)}in below print-area top${dpi}. Print from ${p.fileName || 'uploaded file'}.${proof}${warns}`;
    }
    const placement = orderSettings?.placement || {};
    const placementLines = [
      hasFrontPrint ? placementLine(`FRONT - ${frontLocationName}${frontCode === 'JF' ? ' (JUMBO 16×20)' : ''}`, placement.front) : null,
      hasBackPrint ? placementLine(`BACK - ${backLocationName}${stampedBack === 'JB' ? ' (JUMBO 16×20)' : ''}`, placement.back) : null,
    ].filter(Boolean);
    const placementBlock = placementLines.length
      ? `\nPRINT PLACEMENT (customer's designer preview, top-center anchor — ADVISORY: place at the STANDARD print location for the garment; use the spec below only when it clearly deviates on purpose):\n${placementLines.join('\n')}\n`
      : '';
    const artReviewBanner = orderSettings?.needsArtReview
      ? `\n*** ART NEEDS HUMAN PROOF BEFORE PRINTING — see placement spec; ${pushC.artReviewClock(!!orderSettings?.rush)} starts at proof approval ***\n`
      : '';
    // Legal record on the production order: the customer attested artwork
    // rights at checkout (storefront orders only). (2026-06-10)
    const rightsLine = orderSettings?.rightsAck && orderSettings.rightsAck.checked
      ? `\nCUSTOMER ATTESTED ARTWORK RIGHTS at checkout${orderSettings.rightsAck.ts ? ` (${orderSettings.rightsAck.ts})` : ''}.\n`
      : '';
    // Stock gate fail-open marker (2026-06-10): the checkout-time inventory
    // check couldn't run (feed error/timeout), so garments were NOT verified.
    // Only channels with a stock gate (registry stockBanner) emit this.
    const stockLine = pushC.stockBanner && orderSettings?.stockChecked === false
      ? '\n*** STOCK NOT VERIFIED AT CHECKOUT (inventory feed was down) — confirm garment availability before production ***\n'
      : '';
    const shipPromiseLine = orderSettings?.shipPromise?.label
      ? `\nPROMISED SHIP DATE: ${orderSettings.shipPromise.label} (stamped at checkout)\n`
      : '';

    // Tax labeling — rate comes from the order (DOR destination lookup),
    // never assume Milton 10.2 (legacy bug mislabeled out-of-town orders).
    const taxRateNum = Number(orderTotals?.taxRate);
    const taxPct = Number.isFinite(taxRateNum) && taxRateNum > 0
      ? String(Math.round(taxRateNum * 10000) / 100) : null;
    const taxPartNumber = pushC.taxPartNumber(taxPct);
    const taxPartDescription = taxPct
      ? `${orderTotals?.taxAccountName || 'WA Sales Tax'} ${taxPct}%${orderTotals?.taxAccount ? ` (acct ${orderTotals.taxAccount})` : ''}`
      : 'No sales tax (out of state)';

    // Transform to ManageOrders API format
    const manageOrdersPayload = {
      orderNumber: tempOrderNumber,
      customerPurchaseOrder: tempOrderNumber,  // Set PO Number to Order ID
      customer: {
        company: customerData.company || '',  // Maps to CompanyName in proxy
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        email: customerData.email || '',
        phone: customerData.phone || ''
      },
      lineItems: lineItems,
      designs: designs,  // Artwork URLs for production
      attachments: attachments,  // File attachments for OnSite download
      shipping: {
        company: customerData.company || '',
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        address1: customerData.address1 || customerData.address || '',
        address2: customerData.address2 || '',
        city: customerData.city || '',
        state: customerData.state || '',
        zip: customerData.zip || customerData.zipCode || '',
        country: 'USA',
        method: customerData.deliveryMethod === 'pickup' ? 'Customer Pickup' : 'UPS Ground'
      },
      // Billing block - proxy reads from orderData.billing (not Customer)
      billing: {
        company: customerData.billingCompany || customerData.company || '',
        address1: customerData.billingAddress1 || customerData.address1 || '',
        address2: '',
        city: customerData.billingCity || customerData.city || '',
        state: customerData.billingState || customerData.state || '',
        zip: customerData.billingZip || customerData.zip || '',
        country: 'USA'
      },
      // Additional notes - send as array for proxy to process.
      // Service banner is channel/rush-aware (2026-06-10, registry): legacy
      // 3DT is always rush; Custom-Tees standard orders are 7-10 business
      // days — a hardcoded RUSH banner here would make production rush them.
      notes: [{
        type: 'Notes On Order',
        note: `${pushC.serviceBanner(!!orderSettings?.rush)}
${customerData.deliveryMethod === 'pickup' ? '\n*** CUSTOMER PICKUP - Milton, WA ***\n' : ''}${artReviewBanner}${stockLine}${rightsLine}${shipPromiseLine}${placementBlock}
Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
Delivery: ${customerData.deliveryMethod === 'pickup' ? 'Customer Pickup - NW Custom Apparel, Milton, WA 98354' : 'Ship to: ' + (customerData.address1 || '') + ', ' + (customerData.city || '') + ', ' + (customerData.state || '') + ' ' + (customerData.zip || '')}
Bill To: ${customerData.billingAddress1 || customerData.address1 || ''}, ${customerData.billingCity || customerData.city || ''}, ${customerData.billingState || customerData.state || ''} ${customerData.billingZip || customerData.zip || ''}
Special Instructions: ${customerData.notes || 'None'}

Payment Information:
Stripe Session: ${stripeSessionId || 'N/A'}
Payment Amount: $${paymentAmount ? (paymentAmount / 100).toFixed(2) : orderTotals?.grandTotal || 0}
Payment Status: ${paymentConfirmed ? 'succeeded' : 'pending'}

Total: $${orderTotals?.grandTotal || 0}${taxPct ? ` (includes ${taxPct}% sales tax${customerData.deliveryMethod === 'pickup' ? ', Milton pickup' : ''})` : ' (no sales tax - out of state)'}
TAX: ${taxPct ? `APPLY ${taxPartDescription}` : 'DO NOT APPLY - out-of-state shipment'}`
      }],
      // OnSite ORDER type → production queue + GL account. Channel-set: caps
      // send 21 (Custom Embroidery / acct 4050). When a channel omits it (the
      // DTG tee channels), the field is ABSENT and the proxy's push-client
      // defaults to 6 (Online Store / acct 4003) — byte-identical to the
      // pre-2026-06-12 storefront payload, so this is a caps-only change. The
      // proxy reads root-level `idOrderType` (same as the Order Form push).
      ...(pushC.idOrderType ? { idOrderType: pushC.idOrderType } : {}),
      // Channel-aware (registry): Custom-Tees standard orders are NOT rush
      // (legacy 3DT always is)
      rushOrder: pushC.rushOrderFlag(orderSettings),
      printLocation: orderSettings?.printLocationName || 'Left Chest',
      // Tax fields - proxy expects at root level (not nested in totals).
      // 3DT pushes REAL tax (unlike Order Form's TaxTotal=0) — rate + account
      // come from the order's DOR destination lookup, not a Milton constant.
      taxTotal: orderTotals?.salesTax || 0,
      taxPartNumber: taxPartNumber,
      taxPartDescription: taxPartDescription,
      // Shipping - proxy expects at root level
      cur_Shipping: orderTotals?.shipping || 0,
      totals: {
        subtotal: orderTotals?.subtotal || 0,
        rushFee: orderTotals?.rushFee || 0,
        salesTax: orderTotals?.salesTax || 0,
        shipping: orderTotals?.shipping || 0,
        grandTotal: orderTotals?.grandTotal || 0
      },
      // Payment information from Stripe
      payments: paymentConfirmed ? [{
        date: new Date().toISOString().split('T')[0],  // YYYY-MM-DD format
        amount: parseFloat((paymentAmount ? paymentAmount / 100 : orderTotals?.grandTotal || 0).toFixed(2)),  // Round to 2 decimals
        status: 'success',
        gateway: 'Stripe',
        authCode: stripeSessionId || '',
        accountNumber: String(stripeSessionId || ''),  // Ensure string type for full session ID
        cardCompany: 'Stripe Checkout',
        responseCode: 'approved',
        responseReasonCode: 'checkout_complete',
        responseReasonText: 'Payment completed via Stripe Checkout'
      }] : []
    };

    console.log('[3-Day Order] Submitting to ManageOrders:', JSON.stringify(manageOrdersPayload, null, 2));

    // Forward to ManageOrders PUSH API on caspio-pricing-proxy
    const MANAGEORDERS_API = `${CASPIO_PROXY_BASE}/api/manageorders/orders/create`;

    const response = await fetch(MANAGEORDERS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(manageOrdersPayload)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('[3-Day Order] ✓ Order created in ShopWorks:', result.orderNumber);
      res.json({
        success: true,
        orderNumber: result.orderNumber || tempOrderNumber,
        shopWorksId: result.shopWorksId,
        message: 'Order submitted to ShopWorks successfully'
      });
    } else {
      console.error('[3-Day Order] ShopWorks API error:', result);
      // Return partial success - payment was taken, order needs manual processing
      res.json({
        success: false,
        orderNumber: tempOrderNumber,
        error: result.error || 'ShopWorks submission failed',
        message: 'Payment successful but order requires manual processing. Reference: ' + tempOrderNumber
      });
    }

  } catch (error) {
    console.error('[3-Day Order] Error submitting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit order to ShopWorks',
      message: error.message
    });
  }
});

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
    const r = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/OF`);
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
          headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
                  headers: { 'Content-Type': 'application/json' },
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

app.get('/pricing/stickers', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'sticker-manual-pricing.html'));
});

// Cart Sessions API
app.get('/api/cart-sessions', async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart sessions' });
  }
});

app.get('/api/cart-sessions/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart session' });
  }
});

app.post('/api/cart-sessions', async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-sessions', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart session' });
  }
});

app.put('/api/cart-sessions/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-sessions/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart session' });
  }
});

app.delete('/api/cart-sessions/:id', async (req, res) => {
  try {
    await makeApiRequest(`/cart-sessions/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart session' });
  }
});

// Cart Items API
app.get('/api/cart-items', async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-items');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart items' });
  }
});

app.get('/api/cart-items/session/:sessionId', async (req, res) => {
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

app.post('/api/cart-items', async (req, res) => {
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

app.put('/api/cart-items/:id', async (req, res) => {
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

app.delete('/api/cart-items/:id', async (req, res) => {
  try {
    await makeApiRequest(`/cart-items/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

// Cart Item Sizes API
app.get('/api/cart-item-sizes', async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.get('/api/cart-item-sizes/cart-item/:cartItemId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const cartItemId = sanitizeFilterInput(req.params.cartItemId);
    const data = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${cartItemId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cart item sizes' });
  }
});

app.post('/api/cart-item-sizes', async (req, res) => {
  try {
    const data = await makeApiRequest('/cart-item-sizes', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item size' });
  }
});

app.put('/api/cart-item-sizes/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-item-sizes/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart item size' });
  }
});

app.delete('/api/cart-item-sizes/:id', async (req, res) => {
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

// Christmas Bundle Products API
app.get('/api/christmas-products', async (req, res) => {
  try {
    // Define Christmas bundle products
    const bundleProducts = {
      products: {
        'CTJ162': {
          style: 'CTJ162',
          name: 'Carhartt Shoreline Jacket',
          category: 'jacket',
          basePrice: 141.00,
          vendor: 'SANMAR',
          sanmar_cost: 84.60
        },
        'CT100617': {
          style: 'CT100617',
          name: 'Carhartt Rain Defender Jacket',
          category: 'jacket',
          basePrice: 79.00,
          vendor: 'SANMAR',
          sanmar_cost: 47.40
        },
        'CT103828': {
          style: 'CT103828',
          name: 'Carhartt Duck Detroit Jacket',
          category: 'jacket',
          basePrice: 124.00,
          vendor: 'SANMAR',
          sanmar_cost: 74.40
        },
        'CTK121': {
          style: 'CTK121',
          name: 'Carhartt Midweight Hoodie',
          category: 'hoodie',
          basePrice: 44.00,
          vendor: 'SANMAR',
          sanmar_cost: 26.40
        },
        'F281': {
          style: 'F281',
          name: 'Sport-Tek Super Heavyweight Hoodie',
          category: 'hoodie',
          basePrice: 45.00,
          vendor: 'SANMAR',
          sanmar_cost: 27.00
        },
        'CT104597': {
          style: 'CT104597',
          name: 'Carhartt Watch Cap 2.0',
          category: 'accessory',
          basePrice: 22.00,
          vendor: 'SANMAR',
          sanmar_cost: 13.20
        },
        'CTGD0794': {
          style: 'CTGD0794',
          name: 'Carhartt Insulated Work Gloves',
          category: 'accessory',
          basePrice: 19.00,
          vendor: 'SANMAR',
          sanmar_cost: 11.40
        }
      },
      smallBatchFee: 6.25,
      giftBoxCost: 9.00
    };

    res.json(bundleProducts);
  } catch (error) {
    console.error('Error fetching Christmas products:', error);
    res.status(500).json({ error: 'Failed to fetch Christmas products' });
  }
});

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

// Quote API endpoints are now available on Caspio proxy

// Quote Sessions API - GET all sessions
app.get('/api/quote_sessions', async (req, res) => {
  try {
    let endpoint = '/quote_sessions';
    if (req.query.quoteID) {
      // SECURITY: Sanitize input
      const safeQuoteID = sanitizeFilterInput(req.query.quoteID);
      endpoint += `?filter=QuoteID='${safeQuoteID}'`;
    } else if (req.query.sessionID) {
      // SECURITY: Sanitize input
      const safeSessionID = sanitizeFilterInput(req.query.sessionID);
      endpoint += `?filter=SessionID='${safeSessionID}'`;
    }

    const data = await makeApiRequest(endpoint);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote sessions:', error);
    res.status(500).json({ error: 'Failed to fetch quote sessions', details: error.message });
  }
});

// GET single session by ID
app.get('/api/quote_sessions/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session:', error);
    res.status(500).json({ error: 'Failed to fetch quote session' });
  }
});

app.get('/api/quote_sessions/session/:sessionId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_sessions?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote session by session ID' });
  }
});

app.get('/api/quote_sessions/quote/:quoteId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const data = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session by quote ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote session by quote ID' });
  }
});

// CREATE new session
app.post('/api/quote_sessions', async (req, res) => {
  try {
    console.log('[QUOTE API] Creating quote session with QuoteID:', req.body.QuoteID);
    
    // Use makeApiRequest like other endpoints - it should handle the location header
    const data = await makeApiRequest('/quote_sessions', 'POST', req.body);
    console.log('[QUOTE API] Raw response from proxy:', JSON.stringify(data));
    
    // Check if we have a valid response
    if (data) {
      // If PK_ID is "records", it means the proxy couldn't parse the location header
      if (data.PK_ID === 'records' && data.location) {
        console.log('[QUOTE API] Got "records" as PK_ID, attempting to extract from location:', data.location);
        
        // Try to extract ID from location
        const match = data.location.match(/\/(\d+)$/);
        if (match) {
          data.PK_ID = match[1];
          console.log('[QUOTE API] Extracted PK_ID:', data.PK_ID);
        }
      }
      
      // If we have a valid PK_ID now, return the data
      if (data.PK_ID && data.PK_ID !== 'records') {
        res.status(201).json(data);
        return;
      }
    }
    
    // Fallback: try to get by QuoteID
    console.log('[QUOTE API] No valid PK_ID in response, trying fallback with QuoteID:', req.body.QuoteID);

    // Wait a moment for Caspio to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // SECURITY: Sanitize input even from body
    const safeQuoteID = sanitizeFilterInput(req.body.QuoteID);
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteID}'`);
    console.log('[QUOTE API] Fallback query result:', sessions ? sessions.length + ' sessions found' : 'null');
    
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      console.log('[QUOTE API] Found session via fallback:', sessions[0]);
      res.status(201).json(sessions[0]);
    } else {
      // Return what we sent with temporary ID
      console.log('[QUOTE API] Could not find created session, returning temporary response');
      res.status(201).json({ 
        ...req.body, 
        PK_ID: 'TEMP_' + Date.now(), 
        success: true,
        _note: 'This is a temporary response - quote may still be saved in Caspio' 
      });
    }
  } catch (error) {
    console.error('[QUOTE API] Error creating quote session:', error.message);
    console.error('[QUOTE API] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create quote session',
      details: error.message 
    });
  }
});

// UPDATE session
app.put('/api/quote_sessions/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote session:', error);
    res.status(500).json({ error: 'Failed to update quote session' });
  }
});

// ============================================================================
// QUOTE DELETE — ROLE-BASED SERVER-SIDE ENFORCEMENT (2026-06-15)
//
// The dashboard already hides the delete control for quotes a rep doesn't own,
// but per the CRM auth model ("role checks happen server-side; frontend
// permissions are for UX only" — CRM_DASHBOARD_AUTH.md) the real gate lives
// here. We trust the logged-in identity from the express session
// (req.session.crmUser, established by /api/crm-session post-Caspio-login) —
// the SAME mechanism that guards the CRM dashboards — never a client-supplied
// claim on the delete request itself.
//
//   • master (Erik)            → may delete ANY quote
//   • any other logged-in rep  → may delete ONLY quotes they own
//   • no session               → 401 (refresh + log in)
//   • someone else's quote     → 403
// ============================================================================
const QUOTE_STAFF_EMAIL_MAP = {
  'Adriyella': 'adriyella@nwcustomapparel.com',
  'Bradley Wright': 'bradley@nwcustomapparel.com',
  'Erik Mickelson': 'erik@nwcustomapparel.com',
  'Jim Mickelson': 'jim@nwcustomapparel.com',
  'Nika Lao': 'nika@nwcustomapparel.com',
  'Ruth Nhong': 'ruth@nwcustomapparel.com',
  'Steve Deland': 'art@nwcustomapparel.com',
  'Taneisha Clark': 'taneisha@nwcustomapparel.com',
};
const QUOTE_MASTER_DELETE_EMAILS = new Set(['erik@nwcustomapparel.com']);

function quoteStaffNameToEmail(name) {
  if (!name) return null;
  const hit = QUOTE_STAFF_EMAIL_MAP[String(name).trim()];
  return hit ? hit.toLowerCase() : null;
}

// Owner email for a quote_sessions row — mirrors the dashboard's getQuoteOwnerEmail:
//   SalesRepEmail → ShopWorks snapshot CustomerServiceRep → SalesRepName.
function quoteOwnerEmailFromRow(row) {
  if (!row) return null;
  if (row.SalesRepEmail && String(row.SalesRepEmail).trim()) {
    return String(row.SalesRepEmail).trim().toLowerCase();
  }
  if (row.ShopWorks_Snapshot) {
    try {
      const rep = JSON.parse(row.ShopWorks_Snapshot)?.order?.CustomerServiceRep;
      const email = quoteStaffNameToEmail(rep);
      if (email) return email;
    } catch (_) { /* malformed snapshot */ }
  }
  return quoteStaffNameToEmail(row.SalesRepName);
}

// DELETE session — role-gated (see block above).
app.delete('/api/quote_sessions/:id', async (req, res) => {
  try {
    const pkId = Number(req.params.id);
    if (!Number.isInteger(pkId) || pkId <= 0) {
      return res.status(400).json({ error: 'Invalid quote id' });
    }

    // 1. Identity must come from the trusted session, not the request body.
    const caller = req.session && req.session.crmUser;
    if (!caller) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Your session expired — refresh the page and log in, then try again.' });
    }
    const callerEmail = String(caller.email || quoteStaffNameToEmail(caller.name) || '').toLowerCase();
    const isMaster = caller.firstName === 'Erik' || QUOTE_MASTER_DELETE_EMAILS.has(callerEmail);

    // 2. Non-master: fetch the row and verify ownership before deleting.
    if (!isMaster) {
      let row = null;
      try {
        // Single-record read by PK via the PATH param — a filtered list read
        // (`?q.where=PK_ID=N`) is NOT honored here (returns ALL rows → row[0] is
        // the wrong quote → owner mismatch → a rep can't delete their own). See
        // the "verify fresh writes by PK_ID, never a filtered list read" rule.
        const resp = await makeApiRequest(`/quote_sessions/${pkId}`);
        const list = Array.isArray(resp) ? resp
          : (resp && Array.isArray(resp.Result) ? resp.Result
          : (resp ? [resp] : []));
        row = list.find(r => r && String(r.PK_ID) === String(pkId)) || null;
      } catch (e) {
        return res.status(500).json({ error: 'Failed to verify quote ownership', details: e.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Quote not found' });
      }
      const ownerEmail = quoteOwnerEmailFromRow(row);
      if (!ownerEmail || ownerEmail !== callerEmail) {
        console.warn(`[quote-delete] BLOCKED ${caller.name || callerEmail} (${callerEmail}) from deleting PK ${pkId} owned by ${ownerEmail || 'unknown'}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own quotes. Ask the owner — or Erik — to delete it.',
        });
      }
    }

    // 3. Authorized — perform the delete.
    try {
      await makeApiRequest(`/quote_sessions/${pkId}`, 'DELETE');
    } catch (err) {
      // The proxy 404s when the PK matches no row (2026-07-08 fix — it used to
      // answer 200 recordsAffected:0 for hits AND misses). Already-gone is the
      // desired end state (double-click, stale list row): report success with
      // a flag rather than a scary 500.
      if (String(err.message).includes('status 404')) {
        console.log(`[quote-delete] PK ${pkId} already gone (proxy 404) — treating as deleted`);
        return res.json({ success: true, alreadyGone: true });
      }
      throw err;
    }
    console.log(`[quote-delete] ${caller.name || callerEmail} deleted quote PK ${pkId}${isMaster ? ' (master)' : ' (owner)'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote session:', error);
    res.status(500).json({ error: 'Failed to delete quote session' });
  }
});

// Quote Items API
app.get('/api/quote_items', async (req, res) => {
  try {
    const data = await makeApiRequest('/quote_items');
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items:', error);
    res.status(500).json({ error: 'Failed to fetch quote items' });
  }
});

app.get('/api/quote_items/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_items/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote item:', error);
    res.status(500).json({ error: 'Failed to fetch quote item' });
  }
});

app.get('/api/quote_items/session/:sessionId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_items?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote items by session ID' });
  }
});

app.post('/api/quote_items', async (req, res) => {
  try {
    console.log('[QUOTE ITEMS API] Creating quote item for QuoteID:', req.body.QuoteID);
    
    // Use makeApiRequest like other endpoints - it should handle the location header
    const data = await makeApiRequest('/quote_items', 'POST', req.body);
    console.log('[QUOTE ITEMS API] Raw response from proxy:', JSON.stringify(data));
    
    // Check if we have a valid response
    if (data) {
      // If PK_ID is "records", it means the proxy couldn't parse the location header
      if (data.PK_ID === 'records' && data.location) {
        console.log('[QUOTE ITEMS API] Got "records" as PK_ID, attempting to extract from location:', data.location);
        
        // Try to extract ID from location
        const match = data.location.match(/\/(\d+)$/);
        if (match) {
          data.PK_ID = match[1];
          console.log('[QUOTE ITEMS API] Extracted PK_ID:', data.PK_ID);
        }
      }
      
      // If we have a valid PK_ID now, return the data
      if (data.PK_ID && data.PK_ID !== 'records') {
        res.status(201).json(data);
        return;
      }
    }
    
    // Fallback: try to get by QuoteID and LineNumber
    console.log('[QUOTE ITEMS API] No valid PK_ID in response, trying fallback with QuoteID:', req.body.QuoteID);

    // Wait a moment for Caspio to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // SECURITY: Sanitize input even from body
    const safeQuoteID = sanitizeFilterInput(req.body.QuoteID);
    const items = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteID}'`);
    console.log('[QUOTE ITEMS API] Fallback query result:', items ? items.length + ' items found' : 'null');
    
    if (items && Array.isArray(items)) {
      const newItem = items.find(item => item.LineNumber === req.body.LineNumber);
      if (newItem) {
        console.log('[QUOTE ITEMS API] Found item via fallback:', newItem);
        res.status(201).json(newItem);
        return;
      }
    }
    
    // Return what we sent with temporary ID
    console.log('[QUOTE ITEMS API] Could not find created item, returning temporary response');
    res.status(201).json({ 
      ...req.body, 
      PK_ID: 'TEMP_' + Date.now(), 
      success: true,
      _note: 'This is a temporary response - item may still be saved in Caspio' 
    });
    
  } catch (error) {
    console.error('[QUOTE ITEMS API] Error creating quote item:', error.message);
    console.error('[QUOTE ITEMS API] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create quote item',
      details: error.message 
    });
  }
});

app.put('/api/quote_items/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_items/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote item:', error);
    res.status(500).json({ error: 'Failed to update quote item' });
  }
});

app.delete('/api/quote_items/:id', async (req, res) => {
  try {
    await makeApiRequest(`/quote_items/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    // Proxy 404 = no row matched that PK (2026-07-08 fix) — pass it through
    // instead of masking it as a 500.
    if (String(error.message).includes('status 404')) {
      return res.status(404).json({ error: 'Quote item not found — nothing deleted' });
    }
    console.error('Error deleting quote item:', error);
    res.status(500).json({ error: 'Failed to delete quote item' });
  }
});

// Quote Analytics API
app.get('/api/quote_analytics', async (req, res) => {
  try {
    const data = await makeApiRequest('/quote_analytics');
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics' });
  }
});

app.get('/api/quote_analytics/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_analytics/${req.params.id}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics' });
  }
});

app.get('/api/quote_analytics/session/:sessionId', async (req, res) => {
  try {
    // SECURITY: Sanitize input
    const safeSessionId = sanitizeFilterInput(req.params.sessionId);
    const data = await makeApiRequest(`/quote_analytics?filter=SessionID='${safeSessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote analytics by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote analytics by session ID' });
  }
});

app.post('/api/quote_analytics', async (req, res) => {
  try {
    const data = await makeApiRequest('/quote_analytics', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating quote analytics:', error);
    res.status(500).json({ error: 'Failed to create quote analytics' });
  }
});

app.put('/api/quote_analytics/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_analytics/${req.params.id}`, 'PUT', req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating quote analytics:', error);
    res.status(500).json({ error: 'Failed to update quote analytics' });
  }
});

app.delete('/api/quote_analytics/:id', async (req, res) => {
  try {
    await makeApiRequest(`/quote_analytics/${req.params.id}`, 'DELETE');
    res.json({ success: true });
  } catch (error) {
    // Proxy 404 = no row matched that PK (2026-07-08 fix) — pass it through
    // instead of masking it as a 500.
    if (String(error.message).includes('status 404')) {
      return res.status(404).json({ error: 'Quote analytics record not found — nothing deleted' });
    }
    console.error('Error deleting quote analytics:', error);
    res.status(500).json({ error: 'Failed to delete quote analytics' });
  }
});

// =============================================================================
// PUBLIC QUOTE VIEW API (No Authentication Required)
// =============================================================================

// GET quote items by quoteId
app.get('/api/quote_items/quote/:quoteId', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const data = await makeApiRequest(`/quote_items?filter=QuoteID='${safeQuoteId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote items by quote ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote items by quote ID' });
  }
});

// Public design view page - shareable customer-facing design images
app.get('/design/:designNumber', (req, res) => {
  const designNumber = req.params.designNumber;
  if (!designNumber || !/^\d+$/.test(designNumber)) {
    return res.status(400).send('Invalid design number');
  }
  res.sendFile(path.join(__dirname, 'pages', 'design-view.html'));
});

// Art request detail page - staff-facing shareable link
app.get('/art-request/:designId', (req, res) => {
  const designId = req.params.designId;
  if (!designId || !/^\d+(\.\d+)?$/.test(designId)) {
    return res.status(400).send('Invalid design ID');
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'pages', 'art-request-detail.html'));
});

// /api/config — exposes runtime configuration constants the frontend needs
// (currently just SOFT_DELETE_RETENTION_DAYS so the dashboard countdown +
// quote-view banner show the same number as the server-side cron purges).
// Add new keys here as the frontend needs them.
app.get('/api/config', (req, res) => {
  res.json({
    softDeleteRetentionDays: SOFT_DELETE_RETENTION_DAYS,
  });
});

// Public quote page route - serves the HTML
app.get('/quote/:quoteId', (req, res) => {
  // Validate quote ID format - accept multiple formats:
  // - PREFIX + MMDD + - + sequence (e.g., DTF0112-1)
  // - PREFIX + - + timestamp (e.g., DTF-1768263686415)
  const quoteId = req.params.quoteId;
  if (!quoteId || !/^[A-Z]{2,5}[-\d]+-?\d*$/.test(quoteId)) {
    return res.status(400).send('Invalid quote ID format');
  }
  res.sendFile(path.join(__dirname, 'pages', 'quote-view.html'));
});

// Single-page invoice route — same data, condensed PDF-style layout
// Auto-syncs from ShopWorks when the cached snapshot is older than 30 minutes
// (see pages/js/invoice.js). Useful for printing / emailing customers a clean
// one-pager. Shares the /api/quote-sessions/:quoteId/full endpoint with the
// quote-view page, so any ShopWorks edits flow through here too.
app.get('/invoice/:quoteId', (req, res) => {
  const quoteId = req.params.quoteId;
  if (!quoteId || !/^[A-Z]{2,5}[-\d]+-?\d*$/.test(quoteId)) {
    return res.status(400).send('Invalid quote ID format');
  }
  res.sendFile(path.join(__dirname, 'pages', 'invoice.html'));
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

const SYNC_PROXY_BASE = CASPIO_PROXY_BASE;
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
      const r = await fetch(snapshotUrl);
      if (!r.ok) {
        return res.status(502).json({ success: false, error: `MO snapshot fetch failed: HTTP ${r.status}` });
      }
      snapshot = await r.json();

      // If a manual WO# was given but /v1 still doesn't have it, persist
      // the WO# anyway so future cron + manual syncs can try again.
      if (manualOrderNumber && !snapshot.found && req.body?.shopWorksOrderNumber) {
        await makeApiRequest(`/quote_sessions/${pkId}`, 'PUT', {
          ShopWorks_Order_Number: manualOrderNumber,
          ShopWorks_Status: 'Pending',
          ShopWorks_Last_Synced: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        }).catch(() => {});
        return res.json({
          success: true, synced: true, deleted: false, status: 'Pending',
          shopWorksOrderNumber: manualOrderNumber,
          lastSynced: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
          reason: 'shopworks_order_not_in_mo_v1_yet',
          note: 'Order # saved. ManageOrders /v1 syncs from OnSite every 15 min between 7am-7pm Pacific. Refresh in a few minutes for live data.',
        });
      }
    } catch (e) {
      return res.status(502).json({ success: false, error: `MO snapshot fetch error: ${e.message}` });
    }

    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, '');

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
          { method: 'GET' }
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
        const resp = await fetch(`${PROXY_BASE}/api/company-contacts/by-customer/${encodeURIComponent(idCustomer)}`);
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
    // Caspio proxy GET /quote_sessions accepts q.where for filtering.
    // (The `filter=` param ONLY works for QuoteID lookups; for arbitrary
    // field filters use Caspio's native q.where syntax.)
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
    let sessions;
    try {
      sessions = await makeApiRequest(`/quote_sessions?q.where=${encodeURIComponent("Status='Processed' OR PushedToShopWorks IS NOT NULL")}&q.pageSize=1000`);
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
    const candidates = inWindow.filter(s => {
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
    if (!dryRun) {
      try {
        const cancelled = await makeApiRequest(`/quote_sessions?q.where=${encodeURIComponent("Status='Cancelled_in_ShopWorks'")}&q.pageSize=1000`);
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

    // 1. Pull candidates from Caspio. Filter syntax: ShipStation_Order_ID
    // is a Number column, so > 0 ensures it's set (NOT NULL would also work
    // but Caspio's WHERE accepts > 0).
    let sessions;
    try {
      sessions = await makeApiRequest(
        `/quote_sessions?q.where=${encodeURIComponent("ShipStation_Order_ID > 0 AND (ShipStation_Status IS NULL OR ShipStation_Status <> 'shipped')")}&q.pageSize=500`
      );
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
        const r = await fetch(shipmentsUrl);
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
      enabledAt: new Date().toISOString(),
      enabledBy: (req.session.crmUser && (req.session.crmUser.email || req.session.crmUser.Email || req.session.crmUser.name)) || 'staff',
    });
    await makeApiRequest(`/quote_sessions/${(fresh && fresh.PK_ID) || row.PK_ID}`, 'PUT', { Notes: JSON.stringify(freshNotes) });

    console.log(`[QuoteDeposit] ${quoteId} deposit enabled: $${terms.depositAmount.toFixed(2)} of $${terms.grandTotal.toFixed(2)} (${depositPct}%)`);
    res.json({
      success: true,
      quoteId,
      deposit: freshNotes.deposit,
      payUrl: `${PUBLIC_SITE_ORIGIN}/quote/${encodeURIComponent(quoteId)}`,
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
    const expectHash = computeQuoteTotalsHash(
      quoteId, QuoteDepositMath.r2(parseFloat(row.TotalAmount)), dep.grandTotal, dep.depositAmount
    );
    if (expectHash !== dep.totalsHash) {
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
      success_url: `${siteOrigin}/quote/${encodeURIComponent(quoteId)}?deposit=success`,
      cancel_url: `${siteOrigin}/quote/${encodeURIComponent(quoteId)}?deposit=canceled`,
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

// ==========================================
// Box Label Management - Shipment Receiving
// ==========================================

// Helper: Fetch from Caspio via proxy
async function caspioFetch(tablePath, options = {}) {
  const url = `${API_BASE_URL}/${tablePath}`;
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Caspio ${options.method || 'GET'} ${tablePath} failed: ${resp.status} - ${text}`);
  }
  return resp.json();
}

// Known fee/non-physical part number patterns (not box items)
const FEE_PATTERNS = [
  /^SETUP/i, /^DIGI/i, /^ART/i, /^RUSH/i, /^DISC/i, /^SHIP/i,
  /^TAX/i, /^MONO/i, /^HANDLING/i, /^CREDIT/i, /^ADJUST/i,
  /^SVC/i, /^FEE/i, /^MISC.*FEE/i, /^OVER.*RUN/i
];

// Size normalization: SanMar uses XXL, we use 2XL
const SIZE_NORMALIZE = { 'XXL': '2XL', 'XXXL': '3XL', 'XXXXL': '4XL', 'XXXXXL': '5XL' };
function normalizeSize(size) {
  return SIZE_NORMALIZE[size] || size;
}

// Helper: Resolve SanMar partIds to size/color via proxy, then consolidate items
async function resolveAndConsolidateBoxItems(sanmarBoxes) {
  // Step 1: Collect unique styles and all partIds
  const uniqueStyles = new Set();
  const allPartIds = [];
  for (const box of sanmarBoxes) {
    for (const item of box.items || []) {
      if (item.supplierProductId) uniqueStyles.add(item.supplierProductId);
      if (item.supplierPartId) allPartIds.push(item.supplierPartId);
    }
  }

  console.log(`[BoxLabels] Resolving ${allPartIds.length} partIds across ${uniqueStyles.size} styles`);

  // Step 2: Resolve partIds via Caspio UNIQUE_KEY lookup (fast, <1s)
  let partIdMap = {};
  try {
    const resolveResp = await Promise.race([
      fetch(`${API_BASE_URL}/box-labels/resolve-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partIds: allPartIds })
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Resolve timeout 10s')), 10000))
    ]);

    if (resolveResp.ok) {
      const data = await resolveResp.json();
      if (data.success && data.partMap) {
        partIdMap = data.partMap;
        console.log(`[BoxLabels] Resolved ${Object.keys(partIdMap).length} partIds`);
      }
    }
  } catch (e) {
    console.log(`[BoxLabels] Part resolution failed: ${e.message}`);
  }

  // Step 3: Consolidate items by style+color within each box
  const consolidatedBoxes = [];
  for (const box of sanmarBoxes) {
    const grouped = {};

    for (const item of (box.items || [])) {
      const partInfo = partIdMap[item.supplierPartId];
      const style = item.supplierProductId || 'Unknown';
      const color = partInfo?.color || '';
      const size = partInfo?.size ? normalizeSize(partInfo.size) : '';
      const key = `${style}|${color}`;

      if (!grouped[key]) {
        grouped[key] = {
          style,
          color,
          description: partInfo?.description || style,
          brand: partInfo?.brand || '',
          sizes: {},
          totalQty: 0
        };
      }

      if (size) {
        grouped[key].sizes[size] = (grouped[key].sizes[size] || 0) + item.quantity;
      }
      grouped[key].totalQty += item.quantity;
    }

    consolidatedBoxes.push({
      boxNumber: box.boxNumber,
      source: 'SanMar',
      trackingNumber: box.trackingNumber || '',
      carrier: box.carrier || '',
      shipmentDate: box.shipmentDate || '',
      items: Object.values(grouped)
    });
  }

  return consolidatedBoxes;
}

function isNonPhysicalItem(lineItem) {
  const pn = (lineItem.PartNumber || '').toUpperCase();
  if (FEE_PATTERNS.some(p => p.test(pn))) return true;
  // No size data = likely a fee/service
  const sizeTotal = (lineItem.Size01 || 0) + (lineItem.Size02 || 0) + (lineItem.Size03 || 0) +
    (lineItem.Size04 || 0) + (lineItem.Size05 || 0) + (lineItem.Size06 || 0);
  if (sizeTotal === 0 && (lineItem.LineQuantity || 0) <= 1) return true;
  return false;
}

// Helper: fetch with timeout using Promise.race (for Heroku 30s limit)
function fetchWithTimeout(url, timeoutMs = 10000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${url}`)), timeoutMs)
    )
  ]);
}

// GET /api/box-label-data/:identifier - Merge SanMar shipment + ManageOrders data
app.get('/api/box-label-data/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const type = req.query.type || 'po'; // 'po' = SanMar PO, 'wo' = ShopWorks Work Order

  try {
    let orderNumber = '';
    let sanmarPO = '';

    console.log(`[BoxLabels] Lookup: identifier=${identifier}, type=${type}`);

    // Hard timeout: send partial data after 25s instead of Heroku 503
    let responded = false;
    const hardTimeout = setTimeout(() => {
      if (!responded && !res.headersSent) {
        responded = true;
        console.log(`[BoxLabels] Hard timeout (25s) for ${identifier} — sending partial data`);
        res.json({
          success: true,
          partial: true,
          order: { customerPO: identifier },
          boxes: [],
          unboxedItems: [],
          excludedItems: [],
          summary: { totalBoxes: 0, totalBoxedQty: 0, totalWOQty: 0, totalUnboxedQty: 0, mismatch: false },
          message: 'Request took too long. Please try again — subsequent lookups are faster.'
        });
      }
    }, 25000);

    let allSanmarPOs = []; // Support multiple POs per work order

    if (type === 'wo') {
      orderNumber = identifier;
      // Resolve WO# → ALL SanMar POs from SanMar_Orders table
      try {
        const woLookupResp = await fetchWithTimeout(
          `${API_BASE_URL}/sanmar-orders/lookup?woId=${identifier}`, 5000
        );
        if (woLookupResp.ok) {
          const woData = await woLookupResp.json();
          const allMatches = woData?.orders || [];
          allSanmarPOs = allMatches.map(o => o.SanMar_PO).filter(Boolean);
          sanmarPO = allSanmarPOs[0] || '';
          if (allSanmarPOs.length > 1) {
            console.log(`[BoxLabels] WO# ${identifier} → ${allSanmarPOs.length} SanMar POs: ${allSanmarPOs.join(', ')}`);
          } else if (sanmarPO) {
            console.log(`[BoxLabels] WO# ${identifier} → SanMar PO ${sanmarPO}`);
          }
        }
      } catch (e) {
        console.log(`[BoxLabels] WO→PO lookup failed: ${e.message}`);
      }
    } else {
      sanmarPO = identifier;
      allSanmarPOs = [identifier];
    }

    // Step 1: Fetch SanMar shipments + Caspio order lookup IN PARALLEL
    const parallelFetches = [];

    // SanMar shipments — fetch for ALL POs (one work order can have multiple SanMar POs)
    for (const po of allSanmarPOs) {
      parallelFetches.push(
        fetchWithTimeout(`${API_BASE_URL}/sanmar-shipments/po/${po}`, 15000)
          .then(async r => r.ok ? { type: 'shipment', po, data: await r.json() } : { type: 'shipment', po, data: null })
          .catch(e => { console.log(`[BoxLabels] Shipment failed: ${e.message}`); return { type: 'shipment', data: null }; })
      );
    }

    // Caspio order lookup (by PO or by order ID)
    if (sanmarPO) {
      parallelFetches.push(
        fetchWithTimeout(`${API_BASE_URL}/box-labels/order-by-po/${encodeURIComponent(sanmarPO)}`, 8000)
          .then(async r => r.ok ? { type: 'order', data: await r.json() } : { type: 'order', data: null })
          .catch(e => { console.log(`[BoxLabels] Caspio order failed: ${e.message}`); return { type: 'order', data: null }; })
      );
    } else if (orderNumber) {
      parallelFetches.push(
        fetchWithTimeout(`${API_BASE_URL}/box-labels/order/${orderNumber}`, 8000)
          .then(async r => r.ok ? { type: 'order', data: await r.json() } : { type: 'order', data: null })
          .catch(e => { console.log(`[BoxLabels] Caspio order failed: ${e.message}`); return { type: 'order', data: null }; })
      );
    }

    const results = await Promise.all(parallelFetches);
    console.log(`[BoxLabels] Parallel fetches complete: ${results.map(r => r.type).join(', ')}`);

    // Parse results
    let sanmarBoxes = [];
    let caspioOrder = null;

    for (const result of results) {
      if (result.type === 'shipment' && result.data?.success && result.data?.data?.boxes) {
        // Merge boxes from multiple SanMar POs
        const newBoxes = result.data.data.boxes;
        // Renumber boxes to avoid duplicates when merging multiple POs
        const offset = sanmarBoxes.length;
        for (const box of newBoxes) {
          box.boxNumber = offset + box.boxNumber;
        }
        sanmarBoxes.push(...newBoxes);
        console.log(`[BoxLabels] Got ${newBoxes.length} boxes from SanMar PO ${result.po || '?'} (total: ${sanmarBoxes.length})`);
      }
      if (result.type === 'order' && result.data?.success && result.data?.order) {
        caspioOrder = result.data.order;
        orderNumber = caspioOrder.orderNumber || orderNumber;
        console.log(`[BoxLabels] Got order from Caspio: WO# ${orderNumber}, ${caspioOrder.company}`);
      }
    }

    // If we still have no data, return helpful message
    if (!orderNumber && sanmarBoxes.length === 0) {
      clearTimeout(hardTimeout);
      responded = true;
      return res.json({
        success: true,
        order: { customerPO: sanmarPO },
        boxes: [],
        unboxedItems: [],
        excludedItems: [],
        summary: { totalBoxes: 0, totalBoxedQty: 0, totalWOQty: 0, totalUnboxedQty: 0, mismatch: false },
        message: `PO ${identifier}: No matching work order or SanMar shipment found. Try a different PO# or use Work Order# instead.`
      });
    }

    // Build order info from Caspio data
    let order = {};
    if (caspioOrder) {
      order = {
        orderNumber: caspioOrder.orderNumber || orderNumber,
        orderType: caspioOrder.orderType || '',
        terms: caspioOrder.terms || '',
        company: caspioOrder.company || '',
        contact: caspioOrder.contact || '',
        contactEmail: caspioOrder.contactEmail || '',
        customerPO: caspioOrder.customerPO || sanmarPO || '',
        requestedShipDate: caspioOrder.requestedShipDate || '',
        paidStatus: caspioOrder.paidStatus || '',
        salesRep: caspioOrder.salesRep || '',
        designs: []
      };
      if (caspioOrder.designName || caspioOrder.designNumber) {
        order.designs.push({
          number: String(caspioOrder.designNumber || ''),
          name: caspioOrder.designName || ''
        });
      }
    }

    // Fetch line items from Caspio if we have an order number
    let allLineItems = [];
    if (orderNumber) {
      try {
        const liResp = await fetchWithTimeout(`${API_BASE_URL}/box-labels/lineitems/${orderNumber}`, 8000);
        if (liResp.ok) {
          const liData = await liResp.json();
          allLineItems = liData.lineItems || [];
          console.log(`[BoxLabels] Got ${allLineItems.length} line items from Caspio`);
        }
      } catch (e) {
        console.log(`[BoxLabels] Line items fetch failed: ${e.message}`);
      }
    }

    // Build a set of SanMar product IDs for matching
    const sanmarProductIds = new Set();
    for (const box of sanmarBoxes) {
      for (const item of box.items || []) {
        sanmarProductIds.add((item.supplierProductId || '').toUpperCase());
      }
    }

    // Resolve partIds to size/color and consolidate items by style+color
    const boxes = sanmarBoxes.length > 0
      ? await resolveAndConsolidateBoxItems(sanmarBoxes)
      : [];

    // Enrich box items with ManageOrders size data (for items like 632_M/L caps)
    // SanMar doesn't report sizes for OSFA/hat items, but ManageOrders has the size suffix
    if (boxes.length > 0 && allLineItems.length > 0) {
      // Build maps: style+color → size, and style-only → size (fallback)
      const moSizeByColor = new Map(); // "TM1MU426|quishaGrey" → "L/XL"
      const moSizeByStyle = new Map(); // "TM1MU426" → "L/XL" (first match, fallback)
      for (const li of allLineItems) {
        const pn = (li.PartNumber || '').toUpperCase();
        const suffixMatch = pn.match(/_(OSFA|S\/M|M\/L|L\/XL|ONE SIZE|S|M|L|XL|\d?[xX][lL]+)$/i);
        if (!suffixMatch) continue;
        const basePn = pn.slice(0, pn.length - suffixMatch[0].length);
        const sizeSuffix = suffixMatch[1];
        const color = (li.PartColor || '').toLowerCase();
        moSizeByColor.set(`${basePn}|${color}`, sizeSuffix);
        if (!moSizeByStyle.has(basePn)) moSizeByStyle.set(basePn, sizeSuffix);
      }

      // Enrich box items that have no sizes
      for (const box of boxes) {
        for (const item of (box.items || [])) {
          const hasSizes = Object.values(item.sizes || {}).some(v => v > 0);
          if (hasSizes) continue;
          const baseStyle = (item.style || '').toUpperCase();
          const color = (item.color || '').toLowerCase();
          // Try exact match (style+color), then fallback to style-only
          const moSize = moSizeByColor.get(`${baseStyle}|${color}`) || moSizeByStyle.get(baseStyle);
          if (moSize && item.totalQty > 0) {
            item.sizes[moSize] = item.totalQty;
          }
        }
      }
    }

    const unboxedItems = [];
    const excludedItems = [];

    // Then classify remaining ManageOrders line items
    for (const li of allLineItems) {
      const pn = li.PartNumber || '';
      // Normalize: strip size suffixes to match SanMar base style
      const basePn = pn.toUpperCase()
        .replace(/_(OSFA|S\/M|M\/L|L\/XL|ONE SIZE)$/i, '')
        .replace(/_\d?[xXsSmMlL]+$/i, '')
        .replace(/_\d+$/, '');

      if (isNonPhysicalItem(li)) {
        excludedItems.push({
          lineItemId: li.id_LineItem || li.PK_ID,
          partNumber: pn,
          description: li.PartDescription || li.Description || pn,
          unitPrice: li.LineUnitPrice || 0,
          reason: 'Non-physical (fee/service)'
        });
      } else if (!sanmarProductIds.has(basePn)) {
        // Not in SanMar shipment = other vendor
        unboxedItems.push({
          lineItemId: li.id_LineItem || li.PK_ID,
          style: pn,
          color: li.PartColor || '',
          description: li.PartDescription || li.Description || pn,
          vendor: 'Other',
          sizes: {
            S: li.Size01 || 0,
            M: li.Size02 || 0,
            L: li.Size03 || 0,
            XL: li.Size04 || 0,
            '2XL': li.Size05 || 0,
            '3XL': li.Size06 || 0
          },
          totalQty: li.LineQuantity || 0
        });
      }
    }

    const totalBoxes = boxes.length;
    const totalBoxedQty = boxes.reduce((sum, b) => sum + b.items.reduce((s, i) => s + i.totalQty, 0), 0);
    const totalWOQty = allLineItems.reduce((sum, li) => sum + (isNonPhysicalItem(li) ? 0 : (li.LineQuantity || 0)), 0);

    // Fill in order info from SanMar shipment data if ManageOrders is empty
    if (!order.orderNumber && boxes.length > 0) {
      order.customerPO = sanmarPO || identifier;
      order.company = `SanMar PO: ${sanmarPO || identifier}`;
      // Use shipment date from first box
      if (boxes[0]?.shipmentDate) {
        order.requestedShipDate = boxes[0].shipmentDate;
      }
      if (boxes[0]?.carrier) {
        order.orderType = boxes[0].carrier;
      }
    }

    clearTimeout(hardTimeout);
    if (!responded) {
      responded = true;
      res.json({
        success: true,
        order,
        sanmarPO: sanmarPO || identifier,
        boxes: boxes.map(b => ({ ...b, totalBoxes })),
        unboxedItems,
        excludedItems,
        summary: {
          totalBoxes,
          totalBoxedQty,
          totalWOQty: totalWOQty || totalBoxedQty,
          totalUnboxedQty: unboxedItems.reduce((s, i) => s + i.totalQty, 0),
          mismatch: totalWOQty > 0 && totalBoxedQty !== totalWOQty
        }
      });
    }
  } catch (error) {
    clearTimeout(hardTimeout);
    console.error('[BoxLabels] Error fetching box label data:', error);
    if (!responded) {
      responded = true;
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// POST /api/box-shipments - Import/save a shipment to Caspio
app.post('/api/box-shipments', async (req, res) => {
  try {
    const { order, boxes, unboxedItems, excludedItems } = req.body;

    // Create the Box_Shipments record
    const shipment = await caspioFetch('Box_Shipments', {
      method: 'POST',
      body: JSON.stringify({
        SanMar_PO: order.customerPO || '',
        ShopWorks_Order_No: String(order.orderNumber || ''),
        Company_Name: order.company || '',
        Contact_Name: order.contact || '',
        Customer_PO: order.customerPO || '',
        Order_Type: order.orderType || '',
        Req_Ship_Date: order.requestedShipDate || null,
        Drop_Dead_Date: order.dropDeadDate || null,
        Design_Number: order.designs?.[0]?.number ? parseInt(order.designs[0].number) : null,
        Design_Name: order.designs?.[0]?.name || '',
        Total_Boxes: boxes.length,
        Carrier: boxes[0]?.carrier || '',
        Status: 'Imported',
        Imported_Date: new Date().toISOString(),
        Modified_Date: new Date().toISOString(),
        Modified_By: req.body.modifiedBy || '',
        Total_WO_Qty: req.body.summary?.totalWOQty || 0,
        Total_Boxed_Qty: req.body.summary?.totalBoxedQty || 0
      })
    });

    const shipmentId = shipment.ID_Shipment || shipment.PK_ID || shipment.id;

    // Create Box_Contents rows for each item in each box
    const contentPromises = [];
    for (const box of boxes) {
      for (let i = 0; i < (box.items || []).length; i++) {
        const item = box.items[i];
        contentPromises.push(caspioFetch('Box_Contents', {
          method: 'POST',
          body: JSON.stringify({
            Shipment_ID: shipmentId,
            Box_Number: box.boxNumber,
            Tracking_Number: box.trackingNumber || '',
            Style_Number: item.style || '',
            Description: item.description || '',
            Color: item.color || '',
            Size_XS: item.sizes?.XS || 0,
            Size_S: item.sizes?.S || 0,
            Size_M: item.sizes?.M || 0,
            Size_L: item.sizes?.L || 0,
            Size_XL: item.sizes?.XL || 0,
            Size_2XL: item.sizes?.['2XL'] || 0,
            Size_3XL: item.sizes?.['3XL'] || 0,
            Size_4XL: item.sizes?.['4XL'] || 0,
            Size_5XL: item.sizes?.['5XL'] || 0,
            Size_Other: item.sizes?.Other || 0,
            Total_Qty: item.totalQty || 0,
            Is_Excluded: 'false',
            Is_Verified: 'false',
            Sort_Order: i + 1
          })
        }));
      }
    }

    // Save unboxed items (Box_Number = 0)
    for (const item of (unboxedItems || [])) {
      contentPromises.push(caspioFetch('Box_Contents', {
        method: 'POST',
        body: JSON.stringify({
          Shipment_ID: shipmentId,
          Box_Number: 0,
          Tracking_Number: '',
          Style_Number: item.style || '',
          Description: item.description || '',
          Color: item.color || '',
          Size_XS: item.sizes?.XS || 0,
          Size_S: item.sizes?.S || 0,
          Size_M: item.sizes?.M || 0,
          Size_L: item.sizes?.L || 0,
          Size_XL: item.sizes?.XL || 0,
          Size_2XL: item.sizes?.['2XL'] || 0,
          Size_3XL: item.sizes?.['3XL'] || 0,
          Size_4XL: item.sizes?.['4XL'] || 0,
          Size_5XL: item.sizes?.['5XL'] || 0,
          Size_Other: item.sizes?.Other || 0,
          Total_Qty: item.totalQty || 0,
          Is_Excluded: 'false',
          Is_Verified: 'false',
          Sort_Order: 1
        })
      }));
    }

    // Save excluded items (Is_Excluded = true)
    for (const item of (excludedItems || [])) {
      contentPromises.push(caspioFetch('Box_Contents', {
        method: 'POST',
        body: JSON.stringify({
          Shipment_ID: shipmentId,
          Box_Number: 0,
          Style_Number: item.partNumber || '',
          Description: item.description || '',
          Is_Excluded: 'true',
          Is_Verified: 'false',
          Total_Qty: 0,
          Sort_Order: 99
        })
      }));
    }

    await Promise.all(contentPromises);

    res.json({ success: true, shipmentId, message: `Shipment imported with ${boxes.length} boxes` });
  } catch (error) {
    console.error('[BoxLabels] Error saving shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/box-shipments/:shipmentId - Get saved shipment with all box contents
app.get('/api/box-shipments/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;

    // Fetch shipment header
    const shipments = await caspioFetch(`Box_Shipments?q.where=ID_Shipment=${shipmentId}`);
    const shipment = Array.isArray(shipments) ? shipments[0] : (shipments.Result?.[0] || shipments);
    if (!shipment) return res.status(404).json({ success: false, error: 'Shipment not found' });

    // Fetch all contents for this shipment
    const contents = await caspioFetch(`Box_Contents?q.where=Shipment_ID=${shipmentId}&q.orderBy=Box_Number,Sort_Order`);
    const allItems = Array.isArray(contents) ? contents : (contents.Result || []);

    // Group into boxes, unboxed, and excluded
    const boxMap = {};
    const unboxedItems = [];
    const excludedItems = [];

    for (const item of allItems) {
      if (item.Is_Excluded === 'true') {
        excludedItems.push(item);
      } else if (item.Box_Number === 0 || !item.Box_Number) {
        unboxedItems.push(item);
      } else {
        if (!boxMap[item.Box_Number]) {
          boxMap[item.Box_Number] = {
            boxNumber: item.Box_Number,
            trackingNumber: item.Tracking_Number || '',
            source: item.Tracking_Number ? 'SanMar' : 'Custom',
            items: [],
            isVerified: item.Is_Verified === 'true',
            verifiedBy: item.Verified_By || '',
            verifiedDate: item.Verified_Date || ''
          };
        }
        boxMap[item.Box_Number].items.push(item);
      }
    }

    const boxes = Object.values(boxMap).sort((a, b) => a.boxNumber - b.boxNumber);
    const totalBoxes = boxes.length;

    res.json({
      success: true,
      shipment,
      boxes: boxes.map(b => ({ ...b, totalBoxes })),
      unboxedItems,
      excludedItems,
      summary: {
        totalBoxes,
        totalBoxedQty: boxes.reduce((s, b) => s + b.items.reduce((s2, i) => s2 + (i.Total_Qty || 0), 0), 0),
        totalWOQty: shipment.Total_WO_Qty || 0,
        totalUnboxedQty: unboxedItems.reduce((s, i) => s + (i.Total_Qty || 0), 0)
      }
    });
  } catch (error) {
    console.error('[BoxLabels] Error fetching shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/box-shipments - List recent shipments
app.get('/api/box-shipments', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const shipments = await caspioFetch(`Box_Shipments?q.orderBy=Imported_Date%20DESC&q.pageSize=${limit}`);
    const list = Array.isArray(shipments) ? shipments : (shipments.Result || []);
    res.json({ success: true, shipments: list });
  } catch (error) {
    console.error('[BoxLabels] Error listing shipments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/box-contents/:contentId - Update a box content item (move between boxes, update qty)
app.put('/api/box-contents/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const updates = req.body;
    await caspioFetch(`Box_Contents/${contentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    res.json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('[BoxLabels] Error updating content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/box-contents - Add a new item to a box
app.post('/api/box-contents', async (req, res) => {
  try {
    const result = await caspioFetch('Box_Contents', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json({ success: true, item: result });
  } catch (error) {
    console.error('[BoxLabels] Error creating content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/box-contents/:contentId - Remove an item from a box
app.delete('/api/box-contents/:contentId', async (req, res) => {
  try {
    await caspioFetch(`Box_Contents/${contentId}`, { method: 'DELETE' });
    res.json({ success: true, message: 'Item removed' });
  } catch (error) {
    console.error('[BoxLabels] Error deleting content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/box-contents/move - Move item between boxes (partial size split supported)
app.post('/api/box-contents/move', async (req, res) => {
  try {
    const { contentId, fromBox, toBox, shipmentId, splitSizes } = req.body;

    if (!contentId || toBox === undefined) {
      return res.status(400).json({ success: false, error: 'contentId and toBox required' });
    }

    // If splitSizes provided, do a partial move (create new row in target box, reduce source)
    if (splitSizes) {
      // Fetch the source item
      const items = await caspioFetch(`Box_Contents?q.where=Box_ID=${contentId}`);
      const source = Array.isArray(items) ? items[0] : (items.Result?.[0] || items);
      if (!source) return res.status(404).json({ success: false, error: 'Source item not found' });

      // Create new item in target box with split quantities
      const newItem = {
        Shipment_ID: source.Shipment_ID,
        Box_Number: toBox,
        Tracking_Number: '',
        Style_Number: source.Style_Number,
        Description: source.Description,
        Color: source.Color,
        Size_XS: splitSizes.XS || 0,
        Size_S: splitSizes.S || 0,
        Size_M: splitSizes.M || 0,
        Size_L: splitSizes.L || 0,
        Size_XL: splitSizes.XL || 0,
        Size_2XL: splitSizes['2XL'] || 0,
        Size_3XL: splitSizes['3XL'] || 0,
        Size_4XL: splitSizes['4XL'] || 0,
        Size_5XL: splitSizes['5XL'] || 0,
        Size_Other: splitSizes.Other || 0,
        Total_Qty: Object.values(splitSizes).reduce((s, v) => s + (v || 0), 0),
        Is_Excluded: 'false',
        Is_Verified: 'false',
        Sort_Order: 1
      };
      await caspioFetch('Box_Contents', { method: 'POST', body: JSON.stringify(newItem) });

      // Reduce source item quantities
      const updatedSource = {
        Size_XS: (source.Size_XS || 0) - (splitSizes.XS || 0),
        Size_S: (source.Size_S || 0) - (splitSizes.S || 0),
        Size_M: (source.Size_M || 0) - (splitSizes.M || 0),
        Size_L: (source.Size_L || 0) - (splitSizes.L || 0),
        Size_XL: (source.Size_XL || 0) - (splitSizes.XL || 0),
        Size_2XL: (source.Size_2XL || 0) - (splitSizes['2XL'] || 0),
        Size_3XL: (source.Size_3XL || 0) - (splitSizes['3XL'] || 0),
        Size_4XL: (source.Size_4XL || 0) - (splitSizes['4XL'] || 0),
        Size_5XL: (source.Size_5XL || 0) - (splitSizes['5XL'] || 0),
        Size_Other: (source.Size_Other || 0) - (splitSizes.Other || 0)
      };
      updatedSource.Total_Qty = Object.values(updatedSource).reduce((s, v) => s + (v || 0), 0);

      // If source is now empty, delete it
      if (updatedSource.Total_Qty <= 0) {
        await caspioFetch(`Box_Contents/${contentId}`, { method: 'DELETE' });
      } else {
        await caspioFetch(`Box_Contents/${contentId}`, {
          method: 'PUT',
          body: JSON.stringify(updatedSource)
        });
      }

      res.json({ success: true, message: 'Items split and moved' });
    } else {
      // Full move - just update the Box_Number
      await caspioFetch(`Box_Contents/${contentId}`, {
        method: 'PUT',
        body: JSON.stringify({ Box_Number: toBox })
      });
      res.json({ success: true, message: 'Item moved to box ' + toBox });
    }
  } catch (error) {
    console.error('[BoxLabels] Error moving item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/box-shipments/:shipmentId/verify-box - Mark a box as verified
app.put('/api/box-shipments/:shipmentId/verify-box', async (req, res) => {
  try {
    const { boxNumber, verifiedBy } = req.body;
    const { shipmentId } = req.params;

    // Update all items in this box
    const contents = await caspioFetch(`Box_Contents?q.where=Shipment_ID=${shipmentId} AND Box_Number=${boxNumber}`);
    const items = Array.isArray(contents) ? contents : (contents.Result || []);

    const now = new Date().toISOString();
    await Promise.all(items.map(item =>
      caspioFetch(`Box_Contents/${item.Box_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          Is_Verified: 'true',
          Verified_By: verifiedBy || '',
          Verified_Date: now
        })
      })
    ));

    // Update shipment modified date
    await caspioFetch(`Box_Shipments/${shipmentId}`, {
      method: 'PUT',
      body: JSON.stringify({ Modified_Date: now, Modified_By: verifiedBy || '' })
    });

    res.json({ success: true, message: `Box ${boxNumber} verified` });
  } catch (error) {
    console.error('[BoxLabels] Error verifying box:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/box-shipments/:shipmentId/add-box - Add a new empty box
app.post('/api/box-shipments/:shipmentId/add-box', async (req, res) => {
  try {
    const { shipmentId } = req.params;

    // Get current shipment to find next box number
    const shipments = await caspioFetch(`Box_Shipments?q.where=ID_Shipment=${shipmentId}`);
    const shipment = Array.isArray(shipments) ? shipments[0] : (shipments.Result?.[0] || shipments);
    if (!shipment) return res.status(404).json({ success: false, error: 'Shipment not found' });

    const newBoxNumber = (shipment.Total_Boxes || 0) + 1;

    // Update total boxes count
    await caspioFetch(`Box_Shipments/${shipmentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        Total_Boxes: newBoxNumber,
        Modified_Date: new Date().toISOString(),
        Modified_By: req.body.modifiedBy || ''
      })
    });

    res.json({ success: true, boxNumber: newBoxNumber, totalBoxes: newBoxNumber });
  } catch (error) {
    console.error('[BoxLabels] Error adding box:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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