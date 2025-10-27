# ManageOrders Customer Autocomplete - Complete Implementation Guide

**Last Updated:** 2025-10-26
**Purpose:** Complete guide for implementing customer autocomplete in quote builders
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Status:** ✅ Production-ready (Part of 11-endpoint integration)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Files & Components](#files--components)
3. [Server-Side Implementation](#server-side-implementation)
4. [Browser-Side Implementation](#browser-side-implementation)
5. [Integration Steps](#integration-steps)
6. [Field Mapping](#field-mapping)
7. [Testing & Debugging](#testing--debugging)
8. [Rollout Plan](#rollout-plan)

---

## Overview

### What It Does

**Customer Autocomplete** enables sales reps to quickly find and auto-populate customer information from existing ShopWorks records instead of manually entering data.

**User Experience:**
1. Sales rep types "Arrow" in Company Name field
2. Dropdown appears with matching customers instantly
3. Rep clicks "Arrow Lumber and Hardware"
4. Five fields auto-populate: Company, Name, Email, Phone, Sales Rep

**Performance:**
- Initial load: ~2.3 seconds (fetches 389 customers from server)
- Subsequent searches: <200ms (client-side filtering from cache)
- Cache duration: 24 hours (sessionStorage)

### Benefits

**Time Savings:**
- Manual entry: ~60 seconds per quote
- With autocomplete: ~5 seconds per quote
- **Time saved: 92%** (55 seconds per quote)

**Data Quality:**
- Eliminates typos in company names
- Ensures correct contact information
- Links quotes to existing customer records
- Proper sales rep assignment

**User Satisfaction:**
- Faster quote generation
- Less frustration with data entry
- Confidence in data accuracy

---

## Files & Components

### Browser-Side Files

**Service File: `/shared_components/js/manageorders-customer-service.js`**
- Purpose: Fetch and cache customer data, provide search functionality
- Size: ~250 lines
- Dependencies: None (vanilla JavaScript)
- Status: ✅ Complete

**Integration File: `/quote-builders/screenprint-quote-builder.html`**
- Modified sections:
  - HTML: Company name input replaced with autocomplete-enabled version
  - CSS: Dropdown styling (~110 lines)
  - JavaScript: Initialization and event handling (~190 lines)
- Status: ✅ Complete

### Server-Side Files

**Endpoint: caspio-pricing-proxy `/routes/manageorders.js`**
- Route: `GET /api/manageorders/customers`
- Purpose: Fetch orders from ManageOrders, deduplicate customers, cache results
- Status: ✅ Deployed to Heroku

---

## Server-Side Implementation

### Complete Server Code

**File: `routes/manageorders.js` (in caspio-pricing-proxy repo)**

```javascript
/**
 * ManageOrders API Integration
 * Provides customer data from ShopWorks OnSite 7
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Configuration from environment variables
const MANAGEORDERS_API_URL = process.env.MANAGEORDERS_API_URL;
const MANAGEORDERS_USERNAME = process.env.MANAGEORDERS_USERNAME;
const MANAGEORDERS_PASSWORD = process.env.MANAGEORDERS_PASSWORD;

// In-memory caches
const tokenCache = {
    token: null,
    timestamp: null,
    expiresIn: 3600000 // 1 hour in milliseconds
};

const customerCache = {
    data: null,
    timestamp: null,
    expiresIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

/**
 * Authenticate with ManageOrders API and cache token
 */
async function getAuthToken() {
    const now = Date.now();

    // Return cached token if still valid
    if (tokenCache.token && tokenCache.timestamp &&
        (now - tokenCache.timestamp < tokenCache.expiresIn)) {
        console.log('[ManageOrders] Using cached token');
        return tokenCache.token;
    }

    // Authenticate with ManageOrders
    console.log('[ManageOrders] Authenticating with ManageOrders API...');

    try {
        const response = await fetch(`${MANAGEORDERS_API_URL}/api/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: MANAGEORDERS_USERNAME,
                password: MANAGEORDERS_PASSWORD
            })
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Cache the token
        tokenCache.token = data.id_token;
        tokenCache.timestamp = now;

        console.log('[ManageOrders] ✓ Authentication successful');
        return data.id_token;

    } catch (error) {
        console.error('[ManageOrders] ✗ Authentication error:', error.message);
        throw error;
    }
}

/**
 * Fetch customers from ManageOrders API
 * Extracts unique customers from orders in last 60 days
 */
async function fetchCustomers() {
    const now = Date.now();

    // Return cached data if still valid
    if (customerCache.data && customerCache.timestamp &&
        (now - customerCache.timestamp < customerCache.expiresIn)) {
        console.log('[ManageOrders] Returning cached customer data');
        return customerCache.data;
    }

    console.log('[ManageOrders] Fetching fresh customer data...');

    try {
        // Get authentication token
        const token = await getAuthToken();

        // Fetch orders from last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const fromDate = sixtyDaysAgo.toISOString().split('T')[0];

        const response = await fetch(
            `${MANAGEORDERS_API_URL}/api/orders?fromDate=${fromDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.status}`);
        }

        const orders = await response.json();
        console.log(`[ManageOrders] Fetched ${orders.length} orders`);

        // Deduplicate customers
        const customersMap = new Map();

        orders.forEach(order => {
            if (order.id_Customer && !customersMap.has(order.id_Customer)) {
                customersMap.set(order.id_Customer, {
                    id_Customer: order.id_Customer,
                    CustomerName: order.CustomerName,
                    ContactFirstName: order.ContactFirstName,
                    ContactLastName: order.ContactLastName,
                    ContactEmail: order.ContactEmail,
                    ContactPhone: order.ContactPhone,
                    CustomerServiceRep: order.CustomerServiceRep,
                    // Address fields (for future use)
                    CustomerStreet: order.CustomerStreet,
                    CustomerCity: order.CustomerCity,
                    CustomerState: order.CustomerState,
                    CustomerZIP: order.CustomerZIP
                });
            }
        });

        const customers = Array.from(customersMap.values())
            .sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));

        console.log(`[ManageOrders] ✓ Extracted ${customers.length} unique customers`);

        // Cache the results
        customerCache.data = customers;
        customerCache.timestamp = now;

        return customers;

    } catch (error) {
        console.error('[ManageOrders] ✗ Error fetching customers:', error.message);
        throw error;
    }
}

/**
 * GET /api/manageorders/customers
 * Returns list of unique customers from recent orders
 */
router.get('/customers', async (req, res) => {
    try {
        const customers = await fetchCustomers();

        res.json({
            customers: customers,
            count: customers.length,
            cached: !!customerCache.timestamp,
            cacheAge: customerCache.timestamp
                ? Math.round((Date.now() - customerCache.timestamp) / 1000 / 60)
                : null
        });

    } catch (error) {
        console.error('[ManageOrders] API error:', error);
        res.status(500).json({
            error: 'Failed to fetch customers',
            message: error.message
        });
    }
});

/**
 * GET /api/manageorders/status
 * Health check endpoint
 */
router.get('/status', (req, res) => {
    res.json({
        service: 'ManageOrders API Proxy',
        status: 'operational',
        tokenCached: !!tokenCache.token,
        customersCached: !!customerCache.data,
        customersCount: customerCache.data ? customerCache.data.length : 0,
        cacheAge: customerCache.timestamp
            ? `${Math.round((Date.now() - customerCache.timestamp) / 1000 / 60)} minutes`
            : 'No cache'
    });
});

module.exports = router;
```

### Environment Variables

**Required on Heroku:**
```bash
MANAGEORDERS_API_URL=https://your-shopworks-server.com
MANAGEORDERS_USERNAME=your_api_username
MANAGEORDERS_PASSWORD=your_api_password
```

**Set via Heroku CLI:**
```bash
heroku config:set MANAGEORDERS_API_URL=https://your-shopworks-server.com
heroku config:set MANAGEORDERS_USERNAME=api_readonly
heroku config:set MANAGEORDERS_PASSWORD=secure_password_here
```

---

## Browser-Side Implementation

### Service Class

**File: `/shared_components/js/manageorders-customer-service.js`**

**Complete code (already exists - see file in project)**

Key methods:
- `initialize()` - Fetch customers from proxy server or load from cache
- `searchCustomers(query)` - Client-side search with smart sorting
- `getCustomerById(id)` - Retrieve specific customer
- `loadCache()` / `saveCache()` - sessionStorage management
- `isCacheValid()` - Check if cache has expired

---

## Integration Steps

### Step 1: Include Service Script

**In HTML `<head>` or before closing `</body>`:**
```html
<script src="/shared_components/js/manageorders-customer-service.js"></script>
```

### Step 2: Replace Company Name Input

**Before (standard input):**
```html
<div class="form-group">
    <label for="company-name">Company Name</label>
    <input type="text" id="company-name" class="form-control" placeholder="Company Name">
</div>
```

**After (autocomplete-enabled):**
```html
<div class="form-group autocomplete-container">
    <label for="company-name">
        Company Name
        <span class="autocomplete-status" style="font-size: 12px; color: #6b7280; margin-left: 8px;">
            <i class="fas fa-sync fa-spin" style="display:none;" id="autocomplete-loading"></i>
            <span id="autocomplete-count" style="display:none;"></span>
        </span>
    </label>
    <div class="autocomplete-wrapper" style="position: relative;">
        <input type="text" id="company-name" class="form-control"
               placeholder="Start typing company name..."
               autocomplete="off">
        <div id="company-autocomplete-dropdown" class="autocomplete-dropdown"></div>
    </div>
</div>
```

### Step 3: Add CSS Styles

**Add to page `<style>` or external CSS:**
```css
/* ManageOrders Autocomplete Styles */
.autocomplete-container {
    position: relative;
}

.autocomplete-wrapper {
    position: relative;
}

.autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 350px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    display: none;
}

.autocomplete-dropdown.show {
    display: block;
}

.autocomplete-item {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
    transition: background-color 0.15s ease;
}

.autocomplete-item:hover {
    background: #f9fafb;
}

.autocomplete-item:last-child {
    border-bottom: none;
}

.autocomplete-item-company {
    font-weight: 600;
    color: #111827;
    font-size: 15px;
    margin-bottom: 4px;
}

.autocomplete-item-details {
    font-size: 13px;
    color: #6b7280;
    display: flex;
    gap: 8px;
}

.autocomplete-item-detail {
    display: flex;
    align-items: center;
    gap: 4px;
}

.autocomplete-no-results {
    padding: 16px;
    text-align: center;
    color: #6b7280;
    font-size: 14px;
}

.autocomplete-dropdown::-webkit-scrollbar {
    width: 8px;
}

.autocomplete-dropdown::-webkit-scrollbar-track {
    background: #f3f4f6;
}

.autocomplete-dropdown::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
}

.autocomplete-dropdown::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
```

### Step 4: Add JavaScript Initialization

**Add before closing `</body>` tag:**
```javascript
// MANAGEORDERS CUSTOMER AUTOCOMPLETE
let customerService;

document.addEventListener('DOMContentLoaded', async () => {
    const loadingIcon = document.getElementById('autocomplete-loading');
    const countSpan = document.getElementById('autocomplete-count');

    try {
        // Show loading
        if (loadingIcon) loadingIcon.style.display = 'inline-block';

        // Initialize service
        customerService = new ManageOrdersCustomerService();
        await customerService.initialize();

        // Show customer count
        if (countSpan) {
            countSpan.textContent = `(${customerService.customers.length} companies available)`;
            countSpan.style.display = 'inline';
        }

        // Set up autocomplete
        setupCompanyAutocomplete();

        console.log(`[ManageOrders] ✓ Initialized with ${customerService.customers.length} customers`);

    } catch (error) {
        console.error('[ManageOrders] ✗ Failed to initialize:', error);

        // Fallback to manual entry
        if (countSpan) {
            countSpan.textContent = '(manual entry)';
            countSpan.style.display = 'inline';
        }
    } finally {
        if (loadingIcon) loadingIcon.style.display = 'none';
    }
});

function setupCompanyAutocomplete() {
    const input = document.getElementById('company-name');
    const dropdown = document.getElementById('company-autocomplete-dropdown');

    if (!input || !dropdown || !customerService) {
        console.error('[ManageOrders] Missing required elements');
        return;
    }

    // Debounced search on input
    input.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();

        if (query.length < 2) {
            dropdown.classList.remove('show');
            return;
        }

        const results = customerService.searchCustomers(query);
        displayAutocompleteResults(results, dropdown);
    }, 200));

    // Close on ESC key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.remove('show');
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

function displayAutocompleteResults(results, dropdown) {
    if (!results || results.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">No customers found</div>';
        dropdown.classList.add('show');
        return;
    }

    const html = results.map(customer => {
        const name = escapeHtml(customer.CustomerName || '');
        const contact = escapeHtml(`${customer.ContactFirstName || ''} ${customer.ContactLastName || ''}`.trim());
        const email = escapeHtml((customer.ContactEmail || '').replace(/\r/g, ''));

        return `
            <div class="autocomplete-item" onclick="selectCustomer(${customer.id_Customer})">
                <div class="autocomplete-item-company">${name}</div>
                <div class="autocomplete-item-details">
                    ${contact ? `<span class="autocomplete-item-detail"><i class="fas fa-user"></i>${contact}</span>` : ''}
                    ${email ? `<span class="autocomplete-item-detail"><i class="fas fa-envelope"></i>${email}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    dropdown.innerHTML = html;
    dropdown.classList.add('show');
}

function selectCustomer(customerId) {
    const customer = customerService.getCustomerById(customerId);

    if (!customer) {
        console.error('[ManageOrders] Customer not found:', customerId);
        return;
    }

    console.log('[ManageOrders] ✓ Auto-populated customer:', customer.CustomerName);

    populateCustomerFields(customer);

    // Close dropdown
    document.getElementById('company-autocomplete-dropdown').classList.remove('show');
}

function populateCustomerFields(customer) {
    // Company name
    const companyInput = document.getElementById('company-name');
    if (companyInput) companyInput.value = customer.CustomerName || '';

    // Customer name (first + last)
    const fullName = `${customer.ContactFirstName || ''} ${customer.ContactLastName || ''}`.trim();
    const nameInput = document.getElementById('customer-name');
    if (nameInput) nameInput.value = fullName;

    // Email (clean \r characters)
    if (customer.ContactEmail) {
        const cleanEmail = customer.ContactEmail.replace(/\r/g, '').trim();
        const emailInput = document.getElementById('customer-email');
        if (emailInput) emailInput.value = cleanEmail;
    }

    // Phone
    if (customer.ContactPhone) {
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput) phoneInput.value = customer.ContactPhone;
    }

    // Sales rep (map name to email)
    if (customer.CustomerServiceRep) {
        const repEmail = mapSalesRepToEmail(customer.CustomerServiceRep);
        if (repEmail) {
            const salesRepSelect = document.getElementById('sales-rep');
            if (salesRepSelect) salesRepSelect.value = repEmail;
        }
    }
}

function mapSalesRepToEmail(repName) {
    const mapping = {
        'Nika Lao': 'nika@nwcustomapparel.com',
        'Taneisha Clark': 'taneisha@nwcustomapparel.com',
        'Ruth Nhong': 'ruth@nwcustomapparel.com',
        'Erik Mickelson': 'erik@nwcustomapparel.com',
        'Adriyella': 'adriyella@nwcustomapparel.com',
        'Bradley Wright': 'bradley@nwcustomapparel.com',
        'Jim Mickelson': 'jim@nwcustomapparel.com',
        'Steve Deland': 'art@nwcustomapparel.com'
    };
    return mapping[repName] || null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

---

## Field Mapping

### ManageOrders → Quote Builder Mapping

| ManageOrders API Field | Quote Builder Field | Transformation | Example |
|----------------------|-------------------|---------------|---------|
| `CustomerName` | Company Name | Direct copy | "Arrow Lumber and Hardware" |
| `ContactFirstName` + `ContactLastName` | Customer Name | Concatenate with space | "John Smith" |
| `ContactEmail` | Email | Remove `\r` characters | "john@arrow.com" |
| `ContactPhone` | Phone | Direct copy | "253-555-1234" |
| `CustomerServiceRep` | Sales Rep | Map name to email | "Nika Lao" → "nika@nwcustomapparel.com" |

### Sales Rep Name → Email Mapping

```javascript
const SALES_REP_MAPPING = {
    'Nika Lao': 'nika@nwcustomapparel.com',
    'Taneisha Clark': 'taneisha@nwcustomapparel.com',
    'Ruth Nhong': 'ruth@nwcustomapparel.com',
    'Erik Mickelson': 'erik@nwcustomapparel.com',
    'Adriyella': 'adriyella@nwcustomapparel.com',
    'Bradley Wright': 'bradley@nwcustomapparel.com',
    'Jim Mickelson': 'jim@nwcustomapparel.com',
    'Steve Deland': 'art@nwcustomapparel.com'
};
```

**Note:** If sales rep name doesn't match, field is left unchanged (defaults to "General Sales").

---

## Testing & Debugging

### Browser Console Tests

**Test 1: Check Service Initialization**
```javascript
// Should show service object
console.log(customerService);

// Should show customer count
console.log('Customers loaded:', customerService.customers.length);
```

**Test 2: Test Search Function**
```javascript
// Search for "Arrow"
const results = customerService.searchCustomers('Arrow');
console.log('Search results:', results);

// Should show: Arrow Lumber and Hardware (and others with "Arrow")
```

**Test 3: Check Cache**
```javascript
// Check sessionStorage
const cache = sessionStorage.getItem('manageorders_customers_cache');
const data = JSON.parse(cache);

console.log('Cache age (minutes):', Math.round((Date.now() - data.timestamp) / 1000 / 60));
console.log('Cached customers:', data.count);
```

**Test 4: Test Customer Selection**
```javascript
// Get first customer
const customer = customerService.customers[0];

// Simulate selection
selectCustomer(customer.id_Customer);

// Check if fields populated
console.log('Company:', document.getElementById('company-name').value);
console.log('Name:', document.getElementById('customer-name').value);
```

### Manual Testing Checklist

- [ ] Page loads without errors
- [ ] Loading spinner appears briefly
- [ ] Customer count displays "(389 companies available)"
- [ ] Typing 2+ characters shows dropdown
- [ ] Results appear instantly (<200ms)
- [ ] Clicking result populates 5 fields
- [ ] Dropdown closes after selection
- [ ] ESC key closes dropdown
- [ ] Clicking outside closes dropdown
- [ ] Manual entry still works if autocomplete fails

### Expected Console Output

**Success:**
```
[ManageOrdersService] Service initialized
[ManageOrdersService] ✓ Loaded from cache: 389 customers
[ManageOrders] ✓ Initialized with 389 customers
[ManageOrders] ✓ Auto-populated customer: Arrow Lumber and Hardware
```

**First Load (No Cache):**
```
[ManageOrdersService] Service initialized
[ManageOrdersService] Cache expired, fetching from server...
[ManageOrdersService] ✓ Fetched from server: 389 customers
[ManageOrdersService] ✓ Saved to cache: 389 customers
[ManageOrders] ✓ Initialized with 389 customers
```

---

## Rollout Plan

### Quote Builders Ready for Integration

1. **DTG Quote Builder** (`/quote-builders/dtg-quote-builder.html`)
   - Status: Ready
   - Effort: ~30 minutes
   - Same field IDs as Screen Print

2. **Embroidery Quote Builder** (`/quote-builders/embroidery-quote-builder.html`)
   - Status: Ready
   - Effort: ~30 minutes
   - Same field IDs as Screen Print

3. **Cap Embroidery Quote Builder** (`/quote-builders/cap-embroidery-quote-builder.html`)
   - Status: Ready
   - Effort: ~30 minutes
   - Same field IDs as Screen Print

4. **Laser Tumbler Quote Builder** (`/quote-builders/laser-tumbler-quote-builder.html`)
   - Status: Ready
   - Effort: ~30 minutes
   - Same field IDs as Screen Print

### Implementation Order

**Phase 1:** Screen Print ✅ COMPLETE
**Phase 2:** DTG (most similar to Screen Print)
**Phase 3:** Embroidery + Cap
**Phase 4:** Laser Tumbler

**Total Estimated Time:** 2-3 hours for all quote builders

---

**Documentation Type:** Complete Implementation Guide
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [API Reference](API_REFERENCE.md) | [Server Proxy](SERVER_PROXY.md)
