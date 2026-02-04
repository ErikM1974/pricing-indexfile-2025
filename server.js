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
dotenv.config();

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
  'Erik': ['taneisha', 'nika', 'house'],  // Full admin access
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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Serve specific HTML files from their locations
app.get('/staff-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'staff-dashboard.html'));
});

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

app.get('/art-hub-detail.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-tools', 'art-hub-detail.html'));
});

app.get('/art-hub-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-dashboard.html'));
});

app.get('/art-hub-steve.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-steve.html'));
});

app.get('/art-hub-ruth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-ruth.html'));
});

app.get('/edit-ruth-mockup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'mockups', 'edit-ruth-mockup.html'));
});

app.get('/announcements-create.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-create.html'));
});

app.get('/announcements-manage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'announcements-manage.html'));
});

app.get('/design-name-generator.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tools', 'design-name-generator.html'));
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

app.get('/ae-art-report.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'art-tools', 'ae-art-report.html'));
});

app.get('/ae-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'ae-dashboard.html'));
});

app.get('/art-hub-coordinator.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'art-hub-coordinator.html'));
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
        method: 'UPS Ground'
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

Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
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

// Serve pricing pages - redirect old embroidery routes to new unified page
app.get('/pricing/embroidery', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'calculators', 'embroidery-pricing-all', 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/cap-embroidery', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'calculators', 'embroidery-pricing-all', 'index.html'), (err) => {
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Using existing Caspio API for quote functionality:');
  console.log('  Quote Sessions: /api/quote_sessions');
  console.log('  Quote Items: /api/quote_items');
  console.log('  Quote Analytics: /api/quote_analytics');
  console.log('  Public Quote View: /quote/:quoteId');
});