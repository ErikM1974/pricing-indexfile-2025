const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const compression = require('compression');
const stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

// Load environment variables
// Preboot disabled 2026-04-24 — deploys now go live in ~20s instead of sticky-session purgatory.
dotenv.config();

// =============================================================================
// ROUTE TABLE OF CONTENTS (~2,900 lines)
// =============================================================================
//
// INFRASTRUCTURE
//   L17   Security: Input sanitization (sanitizeFilterInput, isValidIdentifier)
//   L67   Security: CORS configuration
//   L146  Session management (express-session)
//   L166  Rate limiting (apiLimiter, strictLimiter)
//   L414  Body parsing (JSON, urlencoded)
//
// STRIPE & PAYMENTS
//   L272  POST /api/stripe/webhook
//   L1004 GET  /api/stripe-config
//   L1025 POST /api/create-payment-intent
//   L1095 POST /api/create-checkout-session
//   L1210 POST /api/verify-checkout-session
//
// 3-DAY TEES
//   L1271 POST /api/submit-3day-order
//
// ONLINE ORDER FORM
//   L1654 POST /api/order-form-drafts    — save draft to quote_sessions w/ OF- prefix
//   L1710 POST /api/submit-order-form    — push to ShopWorks (ExtSource: NWCA-OrderForm)
//   L1840 GET  /order-form/:draftId      — short share link → redirects to /pages/order-form.html?draftId=…
//
// CRM & AUTH
//   L508  POST /api/crm-session
//   L543  GET  /crm-logout
//   L553  GET  /dashboards/{taneisha,nika,house}-*.html (role-gated)
//
// STATIC FILE SERVING
//   L567  Static directories (calculators, dashboards, quote-builders, etc.)
//   L624  Directory-to-static mappings (20+ directories)
//
// STAFF DASHBOARD ROUTING (v3 sole survivor — 2026-05-28 cleanup)
//   L770  /staff-dashboard.html         → v3 canonical (serves staff-dashboard-v3/index.html)
//   L775  /staff-dashboard-v2.html      → 301 redirect → /staff-dashboard.html
//   L780  /staff-dashboard-legacy.html  → 301 redirect → /staff-dashboard.html
//   L786  /staff-dashboard-v3/          → v3 dedicated URL (kept for old bookmarks)
//
// LEGACY REDIRECTS
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
 *  - Tax-zip lookups for pickup orders (Milton WA = 10.1%)
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
// SECURITY: CORS Configuration
// =============================================================================
const ALLOWED_ORIGINS = [
  'https://nwcustom.caspio.com',
  'https://c2aby672.caspio.com',
  'https://www.teamnwca.com',
  'https://teamnwca.com',
  /\.herokuapp\.com$/,      // Heroku apps
  /localhost:\d+$/,         // Local development
  /127\.0\.0\.1:\d+$/       // Local IP
];

function isOriginAllowed(origin) {
  if (!origin) return true; // Allow same-origin requests
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return origin === allowed || origin.endsWith(allowed);
  });
}

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  // If origin not allowed, don't set the header (browser will block)

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Force HTTPS in production (Heroku)
app.use((req, res, next) => {
  // Skip for localhost development
  if (process.env.NODE_ENV === 'production') {
    // Allow Let's Encrypt ACME challenge to pass through (needed for SSL cert validation)
    if (req.path.startsWith('/.well-known/acme-challenge/')) {
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

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax', // Required for cross-site cookie handling
    maxAge: null // Session cookie - expires when browser closes
  }
}));

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

// Stricter limit for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: {
    error: 'Too many requests to this endpoint, please try again later'
  }
});

// Apply strict limiting to order submission endpoints
app.use('/api/submit-3day-order', strictLimiter);
app.use('/api/submit-order-form', strictLimiter);
app.use('/api/stripe/create-checkout-session', strictLimiter);

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

      console.log('[Webhook] Processing payment for QuoteID:', quoteID);

      // Check idempotency - has this webhook already been processed?
      const checkUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=QuoteID='${quoteID}'`;
      const checkResponse = await fetch(checkUrl);
      const quoteSessions = await checkResponse.json();

      if (quoteSessions && quoteSessions.length > 0) {
        const quoteSession = quoteSessions[0];

        // If already processed, skip
        if (quoteSession.Status === 'Payment Confirmed' || quoteSession.Status === 'Processed') {
          console.log('[Webhook] Already processed, skipping:', quoteID);
          return res.json({ received: true, status: 'duplicate' });
        }

        // Update status to Payment Confirmed
        const updateUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions/${quoteSession.PK_ID}`;
        await fetch(updateUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Status: 'Payment Confirmed',
            Notes: `${quoteSession.Notes}\nPayment Confirmed: ${new Date().toISOString()}\nStripe Payment Intent: ${session.payment_intent}\nAmount: $${(session.amount_total / 100).toFixed(2)}`
          })
        });

        console.log('[Webhook] ✓ Payment confirmed for:', quoteID);

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
            headers: { 'Content-Type': 'application/json' },
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

          if (shopWorksResponse.ok) {
            const result = await shopWorksResponse.json();

            // Update to Processed
            await fetch(updateUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                Status: 'Processed',
                Notes: `${quoteSession.Notes}\nShopWorks Order Created: ${result.orderNumber || 'N/A'}\nSubmitted: ${new Date().toISOString()}`
              })
            });

            console.log('[Webhook] ✓ ShopWorks order created:', quoteID);
          } else {
            throw new Error(`ShopWorks API returned ${shopWorksResponse.status}`);
          }

        } catch (shopWorksError) {
          console.error('[Webhook] ShopWorks submission failed:', shopWorksError);

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

// Generate 3-Day Tees Quote ID (following Christmas Bundles pattern)
function generate3DTQuoteID() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = Math.floor(Math.random() * 10000);
  const paddedSequence = String(sequence).padStart(4, '0');
  return `3DT${month}${day}-${paddedSequence}`;
}

// Save 3-Day Tees order to quote_sessions (Christmas Bundles pattern)
async function save3DTQuoteSession(data) {
  const { quoteID, customerData, orderTotals, stripeSessionId, colorConfigs, orderSettings } = data;

  const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

  const sessionData = {
    QuoteID: quoteID,
    SessionID: stripeSessionId ? `stripe_${stripeSessionId}` : `3dt_${Date.now()}`,
    Status: 'Pending Payment',
    CustomerName: `${customerData.firstName} ${customerData.lastName}`,
    CompanyName: customerData.company || '',
    CustomerEmail: customerData.email,
    Phone: customerData.phone || '',
    TotalQuantity: orderTotals.totalQuantity || 0,
    SubtotalAmount: parseFloat((orderTotals.subtotal || 0).toFixed(2)),
    LTMFeeTotal: parseFloat((orderTotals.ltmFee || 0).toFixed(2)),
    TotalAmount: parseFloat((orderTotals.grandTotal || 0).toFixed(2)),
    ExpiresAt: formattedExpiresAt,
    Notes: `3-Day Tees Rush Order${stripeSessionId ? ` | Stripe Session: ${stripeSessionId}` : ''}`,

    // Store full order data as JSON (for webhook retrieval)
    // This eliminates Stripe metadata size constraints
    CustomerDataJSON: customerData ? JSON.stringify(customerData) : '{}',
    ColorConfigsJSON: colorConfigs ? JSON.stringify(colorConfigs) : '{}',
    OrderTotalsJSON: orderTotals ? JSON.stringify(orderTotals) : '{}',
    OrderSettingsJSON: orderSettings ? JSON.stringify(orderSettings) : '{}'
  };

  const apiUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions';
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
  return result;
}

// Serve product.html routes BEFORE static middleware to avoid conflicts
app.get('/product', (req, res) => {
  console.log('Serving product.html page');
  res.sendFile(path.join(__dirname, 'product.html'));
});

// Also serve product.html when accessed with .html extension
app.get('/product.html', (req, res) => {
  console.log('Serving product.html page (with .html extension)');
  res.sendFile(path.join(__dirname, 'product.html'));
});

// Removed duplicate routes - these pages are now served from /pages/ directory (see lines 342-347)

// =============================================================================
// CRM DASHBOARD AUTHENTICATION ROUTES (Caspio-based)
// =============================================================================

// Endpoint to establish CRM session after Caspio login
// Called from staff-login.html after user authenticates with Caspio
app.post('/api/crm-session', express.json(), (req, res) => {
  const { name, email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Extract first name and look up permissions
  const firstName = name.split(' ')[0];
  const permissions = CRM_PERMISSIONS[firstName];

  if (!permissions) {
    // User authenticated with Caspio but not authorized for CRM dashboards
    return res.status(403).json({
      error: 'User not authorized for CRM access',
      message: `${firstName} does not have permission to access CRM dashboards.`
    });
  }

  // Store CRM user info in session
  req.session.crmUser = {
    name: name,
    email: email || '',
    firstName: firstName,
    permissions: permissions
  };

  res.json({
    success: true,
    permissions: permissions,
    firstName: firstName
  });
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
  if (req.session) {
    // Clear only CRM-related session data (preserve Caspio session)
    delete req.session.crmUser;
  }
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

// =============================================================================
// CRM API PROXY ROUTES
// These routes protect the CRM API by validating session/role before forwarding
// to caspio-pricing-proxy with a server-side secret. The API never exposed to browser.
// =============================================================================

const CRM_API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const CRM_API_SECRET = process.env.CRM_API_SECRET;

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

// Serve specific directories as static
app.use('/calculators', express.static(path.join(__dirname, 'calculators'), staticOptions));
app.use('/dashboards', express.static(path.join(__dirname, 'dashboards'), staticOptions));
app.use('/quote-builders', express.static(path.join(__dirname, 'quote-builders'), staticOptions));
app.use('/vendor-portals', express.static(path.join(__dirname, 'vendor-portals'), staticOptions));
app.use('/art-tools', express.static(path.join(__dirname, 'art-tools'), staticOptions));
app.use('/tools', express.static(path.join(__dirname, 'tools'), staticOptions));
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

// Canonical URL — serves v3
app.get('/staff-dashboard.html', (req, res) => {
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

// v3 dedicated URL — preserved so any direct /staff-dashboard-v3/ bookmarks
// still resolve to the same content as the canonical URL.
app.get('/staff-dashboard-v3/', (req, res) => {
  noCacheHeaders(res);
  res.sendFile(path.join(__dirname, 'staff-dashboard-v3', 'index.html'));
});
app.get('/staff-dashboard-v3', (req, res) => {
  res.redirect(301, '/staff-dashboard-v3/');
});
app.get('/staff-dashboard-v3/index.html', (req, res) => {
  noCacheHeaders(res);
  res.sendFile(path.join(__dirname, 'staff-dashboard-v3', 'index.html'));
});
// Static assets under /staff-dashboard-v3/ (config.js, announcements-bootstrap.js,
// caspio-isolation.js). Reuse staticOptions so these also send no-cache headers.
app.use('/staff-dashboard-v3', express.static(path.join(__dirname, 'staff-dashboard-v3'), staticOptions));

app.get('/bundle-orders-dashboard.html', (req, res) => {
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

app.get('/art-invoices-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-invoices-dashboard.html'));
});

app.get('/art-invoice-view.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-invoice-view.html'));
});

app.get('/art-invoice-unified-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-invoice-unified-dashboard.html'));
});

// Removed duplicate route - webstore-info.html is now served from /pages/ directory (see line 328)

app.get('/universal-records-admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'universal-records-admin.html'));
});

app.get('/art-hub-steve.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-steve.html'));
});

app.get('/art-hub-ruth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-ruth.html'));
});

// Ruth mockup detail page (serves for /mockup/123, /mockup/456, etc.)
app.get('/mockup/:id', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'pages', 'mockup-detail.html'));
});

// Customer Portal — /portal/:customerId
app.get('/portal/:customerId', (req, res) => {
  const customerId = req.params.customerId;
  if (!customerId || !/^\d+$/.test(customerId)) {
    return res.status(400).send('Invalid customer ID');
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'pages', 'customer-portal.html'));
});

app.get('/announcements-create.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-create.html'));
});

app.get('/announcements-manage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-manage.html'));
});

// Serve the standardized embroidery pricing page
app.get('/embroidery-pricing-standardized.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'embroidery-pricing-standardized.html'));
});

// Serve the professional embroidery pricing page
app.get('/embroidery-pricing-professional.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'embroidery-pricing-professional.html'));
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

app.get('/ae-dashboard.html', (req, res) => {
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

// Marketing page
app.get('/marketing.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'marketing.html'));
});

// Top Sellers Catalog page
app.get('/top-sellers-catalog.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'top-sellers-catalog.html'));
});

// Serve the policies directory as static files
app.use('/policies', express.static(path.join(__dirname, 'policies'), staticOptions));

// Sanmar Vendor Management Pages
app.get('/sanmar-invoices.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-invoices.html'));
});

app.get('/sanmar-credits.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-credits.html'));
});

app.get('/sanmar-vendor-portal.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'vendor-portals', 'sanmar-vendor-portal.html'));
});

// Test files for new search implementation
app.get('/index-new.html', (req, res) => {
  console.log('Serving index-new.html for testing new search');
  res.sendFile(path.join(__dirname, 'index-new.html'));
});

app.get('/test-api.html', (req, res) => {
  console.log('Serving test-api.html for API testing');
  res.sendFile(path.join(__dirname, 'tests', 'test-api.html'));
});

app.get('/test-catalog-layout.html', (req, res) => {
  console.log('Serving test-catalog-layout.html for layout testing');
  res.sendFile(path.join(__dirname, 'tests', 'test-catalog-layout.html'));
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

app.get('/webstore-info.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'webstore-info.html'));
});

app.get('/top-sellers-showcase.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'top-sellers-showcase.html'));
});

app.get('/top-sellers-product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'top-sellers-product.html'));
});

app.get('/sample-cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'sample-cart.html'));
});

app.get('/dtg-compatible-products.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dtg-compatible-products.html'));
});

app.get('/richardson-112-product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'richardson-112-product.html'));
});

app.get('/pricing-negotiation-policy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'pricing-negotiation-policy.html'));
});

app.get('/3-day-tees.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', '3-day-tees.html'));
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
const API_BASE_URL = process.env.API_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

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

// POST /api/create-checkout-session - Create Stripe Checkout Session (hosted page)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const {
      line_items,         // Stripe line items from frontend
      customer_email,      // Customer email
      totalAmount,        // Total in dollars
      metadata,           // { tempOrderNumber, customerName, totalQty, printLocation }
      successUrl,         // Redirect URL on success
      cancelUrl,          // Redirect URL on cancel
      customerData,       // Full customer data (NEW - for Caspio save)
      colorConfigs,       // Color configurations (NEW - for webhook metadata)
      orderTotals,        // Order totals (NEW - for webhook metadata)
      orderSettings       // Order settings (NEW - for webhook metadata)
    } = req.body;

    // Validate required fields
    if (!totalAmount || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Missing required fields: totalAmount, successUrl, and cancelUrl are required'
      });
    }

    // Generate QuoteID first (Christmas Bundles pattern)
    const quoteID = generate3DTQuoteID();

    console.log('[3-Day Tees Checkout] Creating session for QuoteID:', quoteID);

    // Save to Caspio BEFORE Stripe redirect (prevents data loss)
    if (customerData && orderTotals) {
      try {
        await save3DTQuoteSession({
          quoteID,
          customerData,
          orderTotals,
          colorConfigs,      // NEW: Store full config for webhook retrieval
          orderSettings,     // NEW: Store settings for webhook retrieval
          stripeSessionId: null // Will update when Stripe session created
        });
        console.log('[3-Day Tees Checkout] ✓ Order saved to Caspio:', quoteID);
      } catch (error) {
        console.error('[3-Day Tees Checkout] Failed to save to Caspio:', error);
        return res.status(500).json({ error: 'Failed to save order data' });
      }
    } else {
      console.warn('[3-Day Tees Checkout] Missing customerData or orderTotals - skipping Caspio save');
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
      success_url: successUrl.replace('{CHECKOUT_SESSION_ID}', '{CHECKOUT_SESSION_ID}') + `&quote_id=${quoteID}`,
      cancel_url: cancelUrl,
      metadata: {
        quoteID: quoteID,
        source: '3day-tees'
        // NOTE: Full order data now stored in Caspio (not Stripe metadata)
        // Webhook will query Caspio using quoteID to retrieve order data
        // This eliminates Stripe's 500-character metadata limit
      }
    };

    const session = await stripeInstance.checkout.sessions.create(sessionConfig);

    console.log('[Stripe Checkout] Session created:', session.id);

    // Update Caspio with Stripe session ID
    if (customerData && orderTotals) {
      try {
        const updateUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions?filter=QuoteID='${quoteID}'`;
        await fetch(updateUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            SessionID: `stripe_${session.id}`,
            Notes: `3-Day Tees Rush Order | Stripe Session: ${session.id} | Status: Checkout Created`
          })
        });
        console.log('[3-Day Tees Checkout] ✓ Updated Caspio with Stripe session ID');
      } catch (error) {
        console.error('[3-Day Tees Checkout] Failed to update Caspio with session ID:', error);
        // Don't fail the request - order is already in Caspio
      }
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

    // Build line items from colorConfigs
    // Structure: { catalogColor: { displayColor, sizeBreakdown: { size: { quantity, unitPrice } } } }
    const lineItems = [];
    const styleNumber = pricingData?.styleNumber || 'PC54';
    const productName = pricingData?.productName || 'Port & Company Core Cotton Tee';

    for (const [catalogColor, config] of Object.entries(colorConfigs)) {
      if (config.sizeBreakdown) {
        for (const [size, sizeData] of Object.entries(config.sizeBreakdown)) {
          if (sizeData && sizeData.quantity > 0) {
            lineItems.push({
              partNumber: styleNumber,
              description: productName,
              color: config.displayColor || catalogColor,
              size: size,
              quantity: parseInt(sizeData.quantity),
              price: sizeData.unitPrice || 0
            });
          }
        }
      }
    }

    console.log('[3-Day Order] Built lineItems:', lineItems.length, 'items');

    // Add Less Than Minimum fee as a line item (if applicable)
    if (orderTotals?.ltmFee && orderTotals.ltmFee > 0) {
      lineItems.push({
        partNumber: 'LTM-75',
        description: 'Less Than Minimum $75.00',
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

    // Map location codes to exact ShopWorks dropdown values
    // ShopWorks accepts: 'Full Back', 'Full Front', 'Left Chest', 'Right Chest'
    const shopWorksLocationMap = {
      'LC': 'Left Chest',
      'FF': 'Full Front',
      'LC_FB': 'Left Chest',   // Front part of combo
      'FF_FB': 'Full Front'    // Front part of combo
    };
    const frontLocationName = shopWorksLocationMap[printLocation] || 'Left Chest';

    console.log('[3-Day Order] Artwork URLs:', { frontLogo, backLogo, printLocation, frontLocationName });

    if (frontLogo || backLogo) {
      const design = {
        name: `${tempOrderNumber} - Customer Logo`,  // "name" field expected by proxy transformDesigns
        externalId: `3DT-${tempOrderNumber}`,  // External ID for tracking
        productColor: productColorsString,  // T-shirt colors from order → "For Product Colors" field
        designTypeId: 45,  // DTG
        artistId: 224,     // 3-Day Tees routing
        locations: []
      };

      // Add front/left chest location if we have a front logo and location isn't Full Back only
      if (frontLogo && printLocation !== 'FB') {
        design.locations.push({
          location: frontLocationName,  // Exact ShopWorks dropdown value
          colors: 'Full Color',  // DTG = Full Color
          code: `${tempOrderNumber}-FRONT`,
          imageUrl: frontLogo,
          customField01: frontLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          notes: 'Customer uploaded artwork',
          details: [{
            color: 'Full Color DTG',
            paramLabel: 'Print Type',
            paramValue: 'Direct to Garment'
          }]
        });
      }

      // Add back location if we have a back logo or location includes back
      if (backLogo) {
        design.locations.push({
          location: 'Full Back',
          colors: 'Full Color',  // DTG = Full Color
          code: `${tempOrderNumber}-BACK`,
          imageUrl: backLogo,
          customField01: backLogo,  // Copyable URL for staff (OnSite doesn't show ImageURL thumbnails)
          notes: 'Customer uploaded artwork (back) - See Attachments tab for image',
          details: [{
            color: 'Full Color DTG',
            paramLabel: 'Print Type',
            paramValue: 'Direct to Garment'
          }]
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
    if (backLogo) {
      attachments.push({
        mediaUrl: backLogo,
        mediaName: `${tempOrderNumber} - Back Artwork`,
        linkNote: 'Customer uploaded artwork (back)'
      });
    }

    console.log('[3-Day Order] Built attachments:', attachments.length, 'attachment(s)');

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
      // Additional notes - send as array for proxy to process
      notes: [{
        type: 'Notes On Order',
        note: `3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.
${customerData.deliveryMethod === 'pickup' ? '\n*** CUSTOMER PICKUP - Milton, WA ***\n' : ''}
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

Total: $${orderTotals?.grandTotal || 0} (includes sales tax 10.1%)`
      }],
      rushOrder: true,
      printLocation: orderSettings?.printLocationName || 'Left Chest',
      // Tax fields - proxy expects at root level (not nested in totals)
      taxTotal: orderTotals?.salesTax || 0,
      taxPartNumber: 'Tax_10.1',
      taxPartDescription: 'City of Milton Sales Tax 10.1%',
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
    const MANAGEORDERS_API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create';

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
//   - Pickup at NWCA Milton, WA      → 10.1% flat (Milton rate)
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
//                     tax base is (subtotal + shipping) × rate. We currently
//                     send cur_Shipping: 0 from the DTG form (UPS cost is COGS,
//                     not billed to the customer), so subtotal × rate is right
//                     for today. WHEN we add a billed-shipping line to the
//                     form, this formula MUST change.
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
  if (isCustomerPickup) return { code: '2200.101', label: 'Customer Pickup — Milton, WA 10.1%', rate: 0.101 };
  if (state && state.toUpperCase() !== 'WA') return { code: '2202', label: 'Out of State Sales — No Tax', rate: 0 };
  // In-WA shipping: rate is destination-specific (city of ship-to). The
  // frontend's DOR lookup returns the authoritative rate; we report the GL
  // account here and trust the rate it computed.
  return { code: '2200.101', label: 'WA Sales Tax — Destination City', rate: null };
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
// each order arrives (because the integration's hardcoded Tax_10.1 default
// would mis-label non-Milton-pickup orders).
//
// 4 possible blocks:
//   1. Pickup (always Milton, 10.1%)            → APPLY: 2200.101
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
  // AR sees it before doing anything else. Frontend pulls this via the
  // /api/order-form-drafts/companies/:id picker and passes through info.
  const cw = String(info?.customerWarning || '').trim();
  if (cw) {
    lines.push(`CUSTOMER WARNING: ${cw}`);
  }

  // 1. Print Locations — Erik's #1 thing he scans for in ShopWorks (2026-05-20).
  const locsClean = String(printLocations || '').trim();
  if (locsClean) {
    lines.push(`Print Locations: ${locsClean}`);
  }

  // 2. Tax block — subtotal / rate / amount / total / account, one per line.
  const subtotal = Number(breakdown?.subtotal) || 0;
  const taxAmount = Number(breakdown?.taxEstimate) || 0;
  const taxRate = Number(ship?.taxRate) || 0;
  const total = subtotal + taxAmount;

  const isPickup = ship && (
    ship.method === 'Customer Pickup' ||
    ship.method === 'pickup' ||
    ship.method === 'willcall'
  );
  const shState = String(ship?.state || info?.state || '').toUpperCase();
  const isOutOfState = !isPickup && shState && shState !== 'WA';

  // Tax-exempt customer (cert on file) → short-circuit
  if (info?.isTaxExempt) {
    const cert = info.taxExemptNumber || '(no cert # on file)';
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    lines.push(`Tax: EXEMPT — DO NOT APPLY`);
    lines.push(`Cert #: ${cert}`);
    lines.push(`Reason: Customer marked Tax Exempt in CompanyContactsMerge2026`);
    lines.push(`Total: $${subtotal.toFixed(2)} (no tax)`);
    return lines;
  }

  // Out-of-state shipping → no tax (WAC 458-20-193)
  if (isOutOfState) {
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    lines.push(`Tax: DO NOT APPLY (out of state)`);
    lines.push(`State: ${shState}`);
    lines.push(`Tax Account: 2202 — Out of State Sales`);
    lines.push(`Reason: WAC 458-20-193 (no nexus on out-of-state delivery)`);
    lines.push(`Total: $${subtotal.toFixed(2)} (no tax)`);
    return lines;
  }

  // Pickup or in-WA shipping → apply tax. Resolve the rate-specific GL account.
  // Source priority:
  //   1. ship.taxAccount — frontend's /api/tax-rates/lookup result (authoritative)
  //   2. findTaxAccountByRate(taxRate) — server-side lookup from cached
  //      sales_tax_accounts_2026 table (fallback if frontend dropped it)
  //   3. Hardcoded '2200.101' for pickup (Milton, always 10.10%)
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
    taxAccount = '2200.101';
    taxAccountName = '10.10%';
  }

  const ratePct = taxRate > 0 ? (taxRate * 100).toFixed(2) : null;

  if (ratePct && taxAccount) {
    const locationLabel = isPickup
      ? 'Milton pickup — flat'
      : `${ship?.city || 'WA destination'} — DOR lookup`;
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    lines.push(`Tax Rate: ${ratePct}% (${locationLabel})`);
    lines.push(`Tax Amount: $${taxAmount.toFixed(2)}`);
    lines.push(`Total with Tax: $${total.toFixed(2)}`);
    lines.push(`Tax Account: ${taxAccount} — ${taxAccountName || ratePct + '%'}`);
    lines.push(`Apply Tax: Manually in ShopWorks`);
  } else {
    // No rate / no account resolved — flag for rep review.
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
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
    const r = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote-sequence/OF');
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

// POST /api/order-form-drafts — Save a draft to Caspio quote_sessions so staff can share the link with a customer.
// Reuses the existing quote_sessions table with QuoteID prefix "OF-".
app.post('/api/order-form-drafts', async (req, res) => {
  try {
    const { info = {}, rows = [], ship = {}, orderNotes = '', files = [] } = req.body || {};

    const draftId = await generateOrderFormDraftId();
    const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

    // staffFilled = which fields the staff already filled — customer view should leave these alone.
    const staffFilled = Object.keys(info).filter(k => info[k] !== '' && info[k] != null);

    const sessionData = {
      QuoteID: draftId,
      SessionID: `orderform_${Date.now()}`,
      Status: 'Draft',
      CustomerName: [info.buyerFirst, info.buyerLast].filter(Boolean).join(' '),
      CompanyName: info.company || '',
      CustomerEmail: info.email || '',
      Phone: info.phone || '',
      TotalQuantity: 0,
      SubtotalAmount: 0,
      LTMFeeTotal: 0,
      TotalAmount: 0,
      ExpiresAt: formattedExpiresAt,
      Notes: JSON.stringify({ info, rows, ship, orderNotes, files, staffFilled })
    };

    const apiUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions';
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('[Order Form Draft] Caspio save failed:', txt);
      return res.status(502).json({ success: false, error: 'Failed to save draft', detail: txt });
    }

    console.log('[Order Form Draft] ✓ Saved:', draftId);
    res.json({ success: true, draftId });
  } catch (err) {
    console.error('[Order Form Draft] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/order-form-drafts/:draftId/approve
// Phase D.3 (2026-05-04) — Customer-facing Approve action. Looks up the
// quote_session by QuoteID (e.g. OF-0035), then PUTs Status='Approved'
// via Caspio. Returns rich data the frontend can use to fire an EmailJS
// notification to the sales rep + erik@ (D.3.1).
app.post('/api/order-form-drafts/:draftId/approve', async (req, res) => {
  try {
    const draftId = String(req.params.draftId || '').trim();
    if (!/^OF-\d+$/.test(draftId)) {
      return res.status(400).json({ success: false, error: 'Invalid draft ID format' });
    }
    const PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // 1. Look up the session by QuoteID to get its PK_ID + Notes payload
    const lookupUrl = `${PROXY}/api/quote_sessions?quoteID=${encodeURIComponent(draftId)}`;
    const lookupRes = await fetch(lookupUrl);
    if (!lookupRes.ok) {
      const txt = await lookupRes.text();
      console.error(`[Order Form Approve] Lookup failed for ${draftId}:`, txt);
      return res.status(502).json({ success: false, error: 'Lookup failed', detail: txt });
    }
    const sessions = await lookupRes.json();
    const session = Array.isArray(sessions) ? sessions[0] : sessions;
    if (!session || !session.PK_ID) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    // Pull info + rows out of the embedded JSON Notes blob so we can return
    // rep email + customer details + total to the client for EmailJS.
    let parsed = {};
    try { parsed = JSON.parse(session.Notes || '{}'); } catch (_) { parsed = {}; }
    const info = parsed.info || {};
    const repSlug = String(info.salesRep || '').toLowerCase();
    const repEmail = SALES_REP_EMAILS[repSlug] || 'erik@nwcustomapparel.com';
    const repName = SALES_REP_FULL_NAMES[repSlug] || info.salesRep || 'Sales Team';

    if (session.Status === 'Approved') {
      return res.json({
        success: true,
        draftId,
        status: 'Approved',
        alreadyApproved: true,
        rep_email: repEmail,
        rep_name: repName,
      });
    }

    // 2. PUT Status='Approved' via the proxy's quote_sessions update route
    const putUrl = `${PROXY}/api/quote_sessions/${session.PK_ID}`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status: 'Approved' })
    });
    if (!putRes.ok) {
      const txt = await putRes.text();
      console.error(`[Order Form Approve] Update failed for ${draftId}:`, txt);
      return res.status(502).json({ success: false, error: 'Update failed', detail: txt });
    }

    console.log(`[Order Form Approve] ✓ ${draftId} approved → notifying ${repEmail}`);
    res.json({
      success: true,
      draftId,
      status: 'Approved',
      approvedAt: new Date().toISOString(),
      // Fields the frontend feeds into EmailJS template_order_approved.
      // Frontend fires the email — server-side we just return the data.
      rep_email: repEmail,
      rep_name: repName,
      customer_name: [info.buyerFirst, info.buyerLast].filter(Boolean).join(' ') || session.CustomerName || '',
      customer_company: info.company || session.CompanyName || '',
      customer_email: info.email || session.CustomerEmail || '',
      customer_phone: info.phone || session.Phone || '',
    });
  } catch (err) {
    console.error('[Order Form Approve] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sales-rep slug → full name. The form's <select> in paper-form.jsx:1562
// stores a lowercase login slug ("taneisha") as the value because that's
// the legacy convention. ShopWorks's CustomerServiceRep field displays
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

// Sales-rep slug → email. Used by the /approve route (D.3.1) to
// identify the recipient when EmailJS notifies the rep that the
// customer has approved the order. erik@ catches anything that's not
// in the table so notifications never silently drop.
const SALES_REP_EMAILS = {
  nika: 'nika@nwcustomapparel.com',
  taneisha: 'taneisha@nwcustomapparel.com',
  erik: 'erik@nwcustomapparel.com',
  ruth: 'ruth@nwcustomapparel.com',
  jim: 'jim@nwcustomapparel.com',
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
          // breakdown.grandTotal is subtotal-before-tax; breakdown.subtotal is the
          // same thing the order form's Totals Panel shows. Tax is left to OnSite.
          TotalQuantity:   Number(breakdown?.totalQty) || 0,
          SubtotalAmount:  Number(breakdown?.subtotal) || 0,
          LTMFeeTotal:     Number(breakdown?.ltmTotal) || 0,
          TotalAmount:     Number(breakdown?.grandTotal || breakdown?.subtotal) || 0,
          ExpiresAt: formattedExpiresAt,
          Notes: JSON.stringify({ info, rows, ship, orderNotes, files, decoConfig, staffFilled: [], submitFlow: 'staff-direct' })
        };
        const createResp = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions', {
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
      const serviceCodesUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/service-codes';
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
      cur_Shipping: 0,
      totals: {
        subtotal: 0, rushFee: 0, salesTax: 0, shipping: 0, grandTotal: 0
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
      orderDate: info.dateIn || new Date().toISOString().slice(0, 10),
      requestedShipDate: info.dateDue || info.dateIn || new Date().toISOString().slice(0, 10),
      dropDeadDate: info.dropDeadDate || '',
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

    const MANAGEORDERS_API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create';
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
          const QUOTE_ITEMS_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items';
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
          const HIST_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/order-form/customer-suggestions/history';
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

// GET /order-form/:draftId — Short share link. Redirects to the page with ?draftId=...
// so the order-form HTML's relative asset paths (order-form/styles.css, etc.) resolve correctly.
// ID format: OF-NNNN (globally sequential, allocated via /api/quote-sequence/OF) or
// OF-<timestamp> when the counter falls back. Both match ^OF-\d+$.
app.get('/order-form/:draftId', (req, res) => {
  const draftId = req.params.draftId;
  if (!draftId || !/^OF-\d+$/.test(draftId)) {
    return res.status(400).send('Invalid order-form draft ID format');
  }
  res.redirect(302, `/pages/order-form.html?draftId=${encodeURIComponent(draftId)}`);
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

// Serve cart.html for the /cart route (shopping cart page)
app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'cart.html'));
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

// DELETE session
app.delete('/api/quote_sessions/:id', async (req, res) => {
  try {
    await makeApiRequest(`/quote_sessions/${req.params.id}`, 'DELETE');
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

const SYNC_PROXY_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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

// Order-header fields we watch for changes. Skip timestamps that churn freely
// (like date_LastModified). Field name → { changeType, severity }.
const WATCHED_ORDER_FIELDS = {
  cur_SubTotal:       { type: 'financial', severity: 'info' },
  cur_SalesTaxTotal:  { type: 'financial', severity: 'info' },
  cur_Shipping:       { type: 'financial', severity: 'info' },
  cur_TotalInvoice:   { type: 'financial', severity: 'warning' },
  cur_Payments:       { type: 'financial', severity: 'info' },
  cur_Balance:        { type: 'financial', severity: 'info' },
  sts_ArtDone:        { type: 'status',    severity: 'info' },
  sts_Purchased:      { type: 'status',    severity: 'info' },
  sts_Received:       { type: 'status',    severity: 'info' },
  sts_Produced:       { type: 'status',    severity: 'info' },
  sts_Shipped:        { type: 'status',    severity: 'info' },
  sts_Invoiced:       { type: 'status',    severity: 'info' },
  sts_Paid:           { type: 'status',    severity: 'info' },
  date_RequestedToShip:{type: 'shipping',  severity: 'warning' },
  date_DropDead:      { type: 'shipping',  severity: 'warning' },
  CustomerServiceRep: { type: 'customer',  severity: 'info' },
  id_DesignType:      { type: 'design',    severity: 'info' },
  id_Design:          { type: 'design',    severity: 'info' },
  DesignName:         { type: 'design',    severity: 'info' },
};

// Normalize a value for comparison — null/undefined/'' all become null.
// Numeric strings → numbers. Other values pass through.
function normalizeForDiff(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    // Try numeric coercion for things like "0", "67.50"
    const n = Number(trimmed);
    if (Number.isFinite(n) && String(n) === trimmed) return n;
    return trimmed;
  }
  return v;
}

/**
 * Diff two snapshots and return an array of change records.
 * @param {Object|null} oldSnap  Previous snapshot (from quote_sessions.ShopWorks_Snapshot)
 * @param {Object} newSnap       Fresh snapshot from MO
 * @returns {Array<{field, oldValue, newValue, type, severity}>}
 */
function diffSnapshots(oldSnap, newSnap) {
  const changes = [];
  if (!oldSnap || !newSnap) return changes;
  const oldOrder = oldSnap.order || {};
  const newOrder = newSnap.order || {};

  // 1. Order-header field diffs
  for (const [field, meta] of Object.entries(WATCHED_ORDER_FIELDS)) {
    const o = normalizeForDiff(oldOrder[field]);
    const n = normalizeForDiff(newOrder[field]);
    if (o !== n) {
      changes.push({
        field,
        oldValue: o,
        newValue: n,
        type: meta.type,
        severity: meta.severity,
      });
    }
  }

  // 2. Line item diffs — match by PartNumber+PartColor.
  // For each NEW line, find matching OLD line and compare LineUnitPrice/LineQuantity.
  // Unmatched OLD lines → "removed". Unmatched NEW lines → "added".
  const oldLines = Array.isArray(oldSnap.lineItems) ? oldSnap.lineItems : [];
  const newLines = Array.isArray(newSnap.lineItems) ? newSnap.lineItems : [];
  const keyOf = (li) => `${(li.PartNumber || '').trim()}|${(li.PartColor || '').trim()}`;
  const oldByKey = new Map(oldLines.map(li => [keyOf(li), li]));
  const newByKey = new Map(newLines.map(li => [keyOf(li), li]));

  for (const [key, nLine] of newByKey) {
    const oLine = oldByKey.get(key);
    if (!oLine) {
      // Added
      changes.push({
        field: `LineItem[${key}]`,
        oldValue: null,
        newValue: `${nLine.PartNumber} ${nLine.PartColor} qty=${nLine.LineQuantity} @ $${nLine.LineUnitPrice}`,
        type: 'line_item',
        severity: 'warning',
      });
    } else {
      // Compare unit price + quantity
      const oPrice = normalizeForDiff(oLine.LineUnitPrice);
      const nPrice = normalizeForDiff(nLine.LineUnitPrice);
      if (oPrice !== nPrice) {
        changes.push({
          field: `LineUnitPrice[${key}]`,
          oldValue: oPrice,
          newValue: nPrice,
          type: 'line_item',
          severity: 'warning',
        });
      }
      const oQty = normalizeForDiff(oLine.LineQuantity);
      const nQty = normalizeForDiff(nLine.LineQuantity);
      if (oQty !== nQty) {
        changes.push({
          field: `LineQuantity[${key}]`,
          oldValue: oQty,
          newValue: nQty,
          type: 'line_item',
          severity: 'warning',
        });
      }
    }
  }
  for (const [key, oLine] of oldByKey) {
    if (!newByKey.has(key)) {
      changes.push({
        field: `LineItem[${key}]`,
        oldValue: `${oLine.PartNumber} ${oLine.PartColor} qty=${oLine.LineQuantity} @ $${oLine.LineUnitPrice}`,
        newValue: null,
        type: 'line_item',
        severity: 'critical',
      });
    }
  }

  return changes;
}

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
              const r = await fetch(delUrl, { method: 'DELETE' });
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
        const PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL
          || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
        const PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL
          || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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

      amountPaid:    Number(order?.cur_TotalInvoice) || Number(session.TotalAmount) || 0,
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
    const PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL
      || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    let proxyResp = await fetch(`${PROXY_BASE}/api/shipstation/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    const PROXY = process.env.CASPIO_PROXY_BASE_URL
      || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
          headers: { 'Content-Type': 'application/json' },
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
    res.json({ success: true, ...stats, ...purgeStats, elapsedSec, candidateCount: candidates.length, totalProcessedInWindow: inWindow.length });
  } catch (error) {
    console.error('[bulk-sync] unexpected error:', error);
    res.status(500).json({ success: false, error: 'Bulk sync failed', details: error.message });
  }
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
    const SYNC_PROXY_BASE_LOCAL = process.env.CASPIO_PROXY_BASE_URL
      || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
          headers: { 'Content-Type': 'application/json' },
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
app.post('/api/public/quote/:quoteId/accept', async (req, res) => {
  try {
    const safeQuoteId = sanitizeFilterInput(req.params.quoteId);
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
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

    // Parse existing Notes JSON and add acceptance info
    let existingNotes = {};
    try {
      if (session.Notes) {
        existingNotes = JSON.parse(session.Notes);
      }
    } catch (e) {
      console.error('Error parsing existing notes:', e);
    }

    existingNotes.acceptedAt = now;
    existingNotes.acceptedByName = sanitizeFilterInput(name);
    existingNotes.acceptedByEmail = sanitizeFilterInput(email);

    const updateData = {
      Status: 'Accepted',
      Notes: JSON.stringify(existingNotes)
    };

    await makeApiRequest(`/quote_sessions/${session.PK_ID}`, 'PUT', updateData);

    console.log(`[QUOTE] Quote ${safeQuoteId} accepted by ${name} (${email})`);

    res.json({
      success: true,
      message: 'Quote accepted successfully',
      quoteId: safeQuoteId,
      acceptedAt: now,
      acceptedBy: { name, email }
    });

  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Using existing Caspio API for quote functionality:');
  console.log('  Quote Sessions: /api/quote_sessions');
  console.log('  Quote Items: /api/quote_items');
  console.log('  Quote Analytics: /api/quote_analytics');
  console.log('  Public Quote View: /quote/:quoteId');
});