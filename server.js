const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Serve index.html as the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve product.html for the /product route (product details page)
app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'product.html'));
});

// Serve cart.html for the /cart route (shopping cart page)
app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'cart.html'));
});

// Serve pricing pages
app.get('/pricing/embroidery', (req, res) => {
  res.sendFile(path.join(__dirname, 'embroidery-pricing.html'));
});

app.get('/pricing/cap-embroidery', (req, res) => {
  res.sendFile(path.join(__dirname, 'cap-embroidery-pricing.html'));
});

app.get('/pricing/dtg', (req, res) => {
  res.sendFile(path.join(__dirname, 'dtg-pricing.html'));
});

app.get('/pricing/screen-print', (req, res) => {
  res.sendFile(path.join(__dirname, 'screen-print-pricing.html'));
});

app.get('/pricing/dtf', (req, res) => {
  res.sendFile(path.join(__dirname, 'dtf-pricing.html'));
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
    const data = await makeApiRequest('/cart-items', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cart item' });
  }
});

app.put('/api/cart-items/:id', async (req, res) => {
  try {
    const data = await makeApiRequest(`/cart-items/${req.params.id}`, 'PUT', req.body);
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

// Serve cart-integration.js for Caspio DataPages
app.get('/api/cart-integration.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin access
  res.sendFile(path.join(__dirname, 'cart-integration.js'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});