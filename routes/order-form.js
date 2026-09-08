// routes/order-form.js — Order-form submission and legacy cart, catalog and pricing relays
// DTG submission uses tested lib/order-form stages. Legacy relays retain their original
// registration order and middleware (tests/unit/server-route-table.test.js).
module.exports = function register(app, ctx) {
const { API_BASE_URL, SERVER_DIR, fetch, fs, makeApiRequest, monitor, path, requireStaff, sanitizeFilterInput } = ctx;

const submitOrderForm = require('../lib/order-form/submit')(ctx);
app.post('/api/submit-order-form', async (req, res) => {
  return submitOrderForm(req, res);
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
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'embroidery-pricing-all', 'index.html'));
});

// Serve pricing pages - serve original embroidery calculators
app.get('/pricing/embroidery', (req, res, next) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'embroidery-pricing.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/cap-embroidery', (req, res, next) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'cap-embroidery-pricing-integrated.html'), (err) => {
    if (err) next(err);
  });
});

app.get('/pricing/dtg', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'dtg-pricing.html'));
});

app.get('/pricing/screen-print', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'screen-print-pricing.html'));
});

app.get('/pricing/dtf', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'dtf-pricing.html'));
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
  res.sendFile(path.join(SERVER_DIR, 'cart-integration.js'));
});

};
