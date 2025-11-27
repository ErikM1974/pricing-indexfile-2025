const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const compression = require('compression');
const stripe = require('stripe');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
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

// Serve specific HTML files from their new directories
app.get('/staff-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboards', 'staff-dashboard.html'));
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
    const mode = process.env.STRIPE_MODE || 'development';
    const secretKey = mode === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY;

    if (!secretKey) {
      console.error('[Stripe Checkout] Secret key not configured for mode:', mode);
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    // Initialize Stripe with the appropriate secret key
    const stripeInstance = stripe(secretKey);

    const {
      orderDetails,      // { items: [...], totalQuantity, rushFee }
      customerInfo,      // { name, email, phone }
      totalAmount,       // Total in dollars (will convert to cents)
      successUrl,        // Redirect URL on success
      cancelUrl,         // Redirect URL on cancel
      orderId            // Order reference ID
    } = req.body;

    // Validate required fields
    if (!totalAmount || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Missing required fields: totalAmount, successUrl, and cancelUrl are required'
      });
    }

    console.log('[Stripe Checkout] Creating session:', {
      totalAmount,
      mode,
      orderId,
      customerEmail: customerInfo?.email
    });

    // Build line items for checkout
    const lineItems = [];

    // Add order items
    if (orderDetails?.items && orderDetails.items.length > 0) {
      orderDetails.items.forEach(item => {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name || '3-Day Tees Order Item',
              description: item.description || `${item.color || ''} - ${item.size || ''}`
            },
            unit_amount: Math.round((item.unitPrice || 0) * 100) // Convert to cents
          },
          quantity: item.quantity || 1
        });
      });
    } else {
      // Fallback: single line item for total
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: '3-Day Tees Custom Order',
            description: orderId ? `Order ${orderId}` : 'Custom printed t-shirts with rush delivery'
          },
          unit_amount: Math.round(totalAmount * 100) // Convert to cents
        },
        quantity: 1
      });
    }

    // NOTE: Rush fee is already included in per-shirt prices (not a separate line item)
    // The subtotal already contains the 25% rush fee built into each unit price

    // Create checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        order_id: orderId || 'unknown',
        source: '3-day-tees',
        total_quantity: orderDetails?.totalQuantity || 0
      }
    };

    // Add customer email if provided
    if (customerInfo?.email) {
      sessionConfig.customer_email = customerInfo.email;
    }

    // Add shipping address collection if needed
    // sessionConfig.shipping_address_collection = { allowed_countries: ['US'] };

    const session = await stripeInstance.checkout.sessions.create(sessionConfig);

    console.log('[Stripe Checkout] Session created:', session.id);

    res.json({
      sessionId: session.id,
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

    // Extract artwork URLs and build designs block
    const designs = [];
    const frontLogo = orderSettings?.frontLogo?.fileUrl || orderSettings?.uploadedFiles?.front;
    const backLogo = orderSettings?.backLogo?.fileUrl || orderSettings?.uploadedFiles?.back;
    const printLocation = orderSettings?.printLocationCode || 'LC';

    console.log('[3-Day Order] Artwork URLs:', { frontLogo, backLogo, printLocation });

    if (frontLogo || backLogo) {
      const design = {
        designName: `${tempOrderNumber} - Customer Logo`,
        designTypeId: 45,  // DTG
        artistId: 224,     // 3-Day Tees routing
        locations: []
      };

      // Add front/left chest location if we have a front logo and location isn't Full Back only
      if (frontLogo && printLocation !== 'FB') {
        design.locations.push({
          location: orderSettings?.printLocationName || 'Left Chest',
          imageUrl: frontLogo,
          notes: 'Customer uploaded artwork'
        });
      }

      // Add back location if we have a back logo or location includes back
      if (backLogo) {
        design.locations.push({
          location: 'Full Back',
          imageUrl: backLogo,
          notes: 'Customer uploaded artwork (back)'
        });
      }

      // Only add design if we have at least one location
      if (design.locations.length > 0) {
        designs.push(design);
      }
    }

    console.log('[3-Day Order] Built designs:', designs.length, 'design(s)');

    // Transform to ManageOrders API format
    const manageOrdersPayload = {
      orderNumber: tempOrderNumber,
      customer: {
        company: customerData.company || '',  // Maps to CompanyName in proxy
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        email: customerData.email || '',
        phone: customerData.phone || ''
      },
      lineItems: lineItems,
      designs: designs,  // Artwork URLs for production
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
      // Additional metadata - include customer special instructions
      notes: customerData.notes
        ? `3-Day Rush Order\nSpecial Instructions: ${customerData.notes}\nStripe Session: ${stripeSessionId || 'N/A'}`
        : `3-Day Rush Order - Stripe Session: ${stripeSessionId || 'N/A'}`,
      rushOrder: true,
      printLocation: orderSettings?.printLocationName || 'Left Chest',
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

// Serve pricing pages
app.get('/pricing/embroidery', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'embroidery-pricing.html'));
});

app.get('/pricing/cap-embroidery', (req, res) => {
  res.sendFile(path.join(__dirname, 'calculators', 'cap-embroidery-pricing-integrated.html'));
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
    // Get cart items for the session
    const itemsData = await makeApiRequest(`/cart-items?filter=SessionID='${req.params.sessionId}'`);
    
    // If no items, return empty array
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      return res.json([]);
    }
    
    // For each item, get its sizes
    const itemsWithSizes = await Promise.all(itemsData.map(async (item) => {
      try {
        const sizesData = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${item.CartItemID}`);
        
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
    const data = await makeApiRequest(`/cart-item-sizes?filter=CartItemID=${req.params.cartItemId}`);
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
    const data = await makeApiRequest(`/customers?filter=Email='${req.params.email}'`);
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
    
    const data = await makeApiRequest(`/inventory?filter=catalog_no='${styleNumber}' AND catalog_color='${color}'`);
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
    
    const data = await makeApiRequest(`/pricing-matrix?filter=StyleNumber='${styleNumber}' AND Color='${color}' AND EmbellishmentType='${embType}'`);
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
    
    // Build the filter based on required parameters
    let filter = encodeURIComponent(`StyleNumber='${styleNumber}' AND Color='${color}' AND EmbellishmentType='${embellishmentType}'`);
    
    // Add sessionID to filter if provided
    if (sessionID) {
      filter = encodeURIComponent(`StyleNumber='${styleNumber}' AND Color='${color}' AND EmbellishmentType='${embellishmentType}' AND SessionID='${sessionID}'`);
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
      endpoint += `?filter=QuoteID='${req.query.quoteID}'`;
    } else if (req.query.sessionID) {
      endpoint += `?filter=SessionID='${req.query.sessionID}'`;
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
    const data = await makeApiRequest(`/quote_sessions?filter=SessionID='${req.params.sessionId}'`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching quote session by session ID:', error);
    res.status(500).json({ error: 'Failed to fetch quote session by session ID' });
  }
});

app.get('/api/quote_sessions/quote/:quoteId', async (req, res) => {
  try {
    const data = await makeApiRequest(`/quote_sessions?filter=QuoteID='${req.params.quoteId}'`);
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
    
    const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${req.body.QuoteID}'`);
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
    const data = await makeApiRequest(`/quote_items?filter=SessionID='${req.params.sessionId}'`);
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
    
    const items = await makeApiRequest(`/quote_items?filter=QuoteID='${req.body.QuoteID}'`);
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
    const data = await makeApiRequest(`/quote_analytics?filter=SessionID='${req.params.sessionId}'`);
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Using existing Caspio API for quote functionality:');
  console.log('  Quote Sessions: /api/quote_sessions');
  console.log('  Quote Items: /api/quote_items');
  console.log('  Quote Analytics: /api/quote_analytics');
});