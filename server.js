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
// Composition root: environment, shared infrastructure and ordered route registration.
// Payment/storefront/order/ShipStation behavior lives in focused libraries.
// Current route inventory: node scripts/server/route-table.js (485 registrations locked, 24 modules).
// Infrastructure stays here per the handover; transfer relays use the existing staff session gate.

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
// SAMPLE PROGRAM: routes/customer-portal.js and lib/payments/samples-fulfillment.js.

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
// Supacolor screenshots retain the proxy's 10 MB limit; staff auth runs before parsing.
app.use(['/api/vision/extract-supacolor', '/api/vision/extract-supacolor-jobs-list', '/api/vision/extract-supacolor-job-detail'], requireStaff, bodyParser.json({ limit: '10mb' }));
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
// product-pages — extracted to routes/product-pages.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { SERVER_DIR: __dirname, fs, path, sendHashedHtml }; require('./routes/product-pages')(app, ctx); }

// Removed duplicate routes - these pages are now served from /pages/ directory (see lines 342-347)

const CRM_API_BASE = CASPIO_PROXY_BASE;

const { isStaffOrSync, requireStaffOrSync } = require('./lib/quote-sync-access')({ sharedSecret: CRM_API_SECRET, requireStaff });

// Customer Portal admin console — manage who can log into the customer portal
// (Customer_Portal_Access invites). Open to the management team by ROLE (Erik=admin,
// Bradley=accountant, Ruth=art, Taneisha/Nika=sales). The two rep tags are included so
// Taneisha + Nika are covered regardless of their broader Staff_App_Roles role.
const PORTAL_ADMIN_ROLES = ['admin', 'accountant', 'art', 'sales', 'taneisha', 'nika'];

// CRM dashboard authentication (Caspio-based session) — extracted to routes/crm-auth.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { express }; require('./routes/crm-auth')(app, ctx); }
// Staff SAML SSO — server-verified login (Caspio Staff directory = IdP) + staff page gates — extracted to routes/staff-saml.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { PORTAL_ADMIN_ROLES, SERVER_DIR: __dirname, express, fetchStaffRole, path, requireCrmEmail, requireCrmRole, staffSaml }; require('./routes/staff-saml')(app, ctx); }
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

// CRM API proxy — extracted to routes/crm-proxy.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, PORTAL_ADMIN_ROLES, SAMPLE_PRICING, TDT_PROXY, boxFileId, boxForward, express, fetch, requireCrmRole, requirePageAccess, requireStaff, strictLimiter, withProxySecret }; require('./routes/crm-proxy')(app, ctx); }

// Transfer purchasing and Supacolor staff relays; vendor/customer boundaries stay in their own modules.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, fetch, requireStaff }; require('./routes/transfers')(app, ctx); }
// =============================================================================
// POLICIES HUB AI ASSIST — streaming proxy to caspio-pricing-proxy.
// The actual Claude API call lives on the proxy (where ANTHROPIC_API_KEY is
// configured). This handler role-gates via Express session, then pipes the
// SSE response body straight through to the browser. Same client-facing
// contract as before: POST /api/policies/ai-assist returns text/event-stream.
// =============================================================================
// policies-assist — extracted to routes/policies-assist.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, requireCrmRole }; require('./routes/policies-assist')(app, ctx); }
console.log('✓ Policies AI Assist proxy loaded (forwards to caspio-pricing-proxy/api/policies-ai-assist)');

// =============================================================================
// AI chat forwarders (session-gated streaming proxies) — extracted to routes/ai-chat.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, requireStaff }; require('./routes/ai-chat')(app, ctx); }
// 253GEAR publisher forwarders (page-gated Shopify proxies) — extracted to routes/gear-publisher.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { CRM_API_BASE, CRM_API_SECRET, express, fetch, path, requirePageAccess, SERVER_DIR: __dirname }; require('./routes/gear-publisher')(app, ctx); }
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

// No-cache helper used by every staff-dashboard route below so the live
// dashboard always fetches fresh CSS/JS after a deploy.
function noCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// Serve the three builder pages with script/link tags rewritten to the hashed
// /dist assets. No manifest (build not run) → fall through to the plain
// static mount below and serve the original source paths — the build is an
// overlay, never a requirement.
const { rewriteHtmlAssets, createManifestLoader, createHtmlLoader } = require('./lib/asset-manifest');

const { HASHED_PAGES, HASHED_PAGES_UNDER_PAGES_MOUNT, HASHED_STAFF_UNDER_MOUNT, HASHED_CALCULATOR_PATHS } = require('./lib/hashed-pages');

const loadAssetManifest = createManifestLoader(path.join(__dirname, 'dist', 'asset-manifest.json'));

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

// API configuration
const API_BASE_URL = process.env.API_BASE_URL || `${CASPIO_PROXY_BASE}/api`;

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
const SYNC_PROXY_BASE = CASPIO_PROXY_BASE;

// Order-form submission and legacy cart, catalog and pricing relays — extracted to routes/order-form.js (server split, 2026-09-07); registered here so the order is unchanged.
{ const ctx = { API_BASE_URL, CASPIO_PROXY_BASE, CRM_API_SECRET, NWCA_LOCATIONS, SERVER_DIR: __dirname, SYNC_PROXY_BASE, cacheSubmitResponse, fetch, fs, getCachedSubmitResponse, makeApiRequest, monitor, path, requireStaff, sanitizeFilterInput, withProxySecret }; require('./routes/order-form')(app, ctx); }
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