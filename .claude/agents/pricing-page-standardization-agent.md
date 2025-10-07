# Pricing Page Standardization Agent

**Version:** 1.0
**Last Updated:** 2025-01-07
**Purpose:** Single source of truth for creating and standardizing all pricing calculator pages (DTG, DTF, Embroidery, Cap Embroidery, Screen Print, Laser Engraving, etc.)

---

## Table of Contents

1. [Overview](#overview)
2. [Standard Page Structure](#standard-page-structure)
3. [HTML Template](#html-template)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [JavaScript Implementation](#javascript-implementation)
6. [Toggle UI Pattern](#toggle-ui-pattern)
7. [CSS Requirements](#css-requirements)
8. [Breadcrumb Navigation](#breadcrumb-navigation)
9. [Search Bar Implementation](#search-bar-implementation)
10. [Validation Checklist](#validation-checklist)

---

## Overview

All pricing pages follow a standardized two-column layout:

**Left Column (Product Context):**
- Product hero section with image gallery
- Color swatches (clickable)
- Product information (title, brand, style, description)

**Right Column (Interactive Pricing):**
- Pricing calculator/configurator
- Toggle switches OR quantity inputs
- Live price display
- Add to cart/Get quote button

**Header:**
- Search bar with autocomplete
- Working breadcrumb navigation
- Contact info and business hours

---

## Standard Page Structure

### File Organization
```
/calculators/
  ├── [method]-pricing.html          # Main pricing page
  ├── /shared_components/
      ├── /css/
      │   ├── universal-pricing-header.css
      │   ├── universal-pricing-layout.css
      │   ├── universal-calculator-theme.css
      │   ├── universal-pricing-components.css
      │   └── [method]-specific.css
      ├── /js/
          ├── pricing-pages.js
          ├── pricing-matrix-api.js
          ├── universal-image-gallery.js
          └── [method]-pricing-service.js
```

### Page Layout Classes
```html
<body class="[method]-pricing-page">
    <header class="enhanced-pricing-header">
        <!-- Contact bar + Nav + Context bar -->
    </header>

    <div class="container">
        <div class="product-page-columns-container">
            <!-- Left column: .product-context-column -->
            <!-- Right column: .product-interactive-column -->
        </div>
    </div>
</body>
```

---

## HTML Template

### Complete Standard Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[METHOD] Pricing Calculator | Northwest Custom Apparel</title>

    <!-- SEO Meta Tags -->
    <meta name="description" content="Get instant [method] pricing on custom apparel. Professional calculator with automatic pricing, quantity discounts, and instant quotes.">
    <meta name="keywords" content="[method] pricing, custom apparel calculator, bulk pricing">

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1">

    <!-- CSS Load Order (CRITICAL - Must load in this exact order) -->

    <!-- 1. Universal Pricing CSS (Theme Foundation) -->
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-layout.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-components.css">

    <!-- 2. Shared CSS -->
    <link rel="stylesheet" href="/shared_components/css/shared-pricing-styles.css">
    <link rel="stylesheet" href="/shared_components/css/modern-enhancements.css">

    <!-- 3. Universal Components -->
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-product-display.css">
    <link rel="stylesheet" href="/shared_components/css/universal-image-gallery.css">
    <link rel="stylesheet" href="/shared_components/css/universal-pricing-grid.css">

    <!-- 4. Method-Specific CSS (Highest Priority) -->
    <link rel="stylesheet" href="/shared_components/css/[method]-specific.css?v=20250107">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <style>
        /* Page-specific body padding for fixed header */
        body.[method]-pricing-page {
            padding-top: 180px;
        }

        /* Enhanced header styles */
        .enhanced-pricing-header {
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }

        .header-contact-bar {
            background: #2d5f3f;
            color: white;
            padding: 10px 0;
            font-size: 14px;
        }

        .contact-bar-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .contact-info {
            display: flex;
            gap: 24px;
        }

        .contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Breadcrumb styling */
        .pricing-context-bar {
            background: #f8f9fa;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 0;
        }

        .context-bar-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #6b7280;
        }

        .breadcrumb a {
            color: #4cb354;
            text-decoration: none;
        }

        .breadcrumb a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body class="[method]-pricing-page">

    <!-- ========================================
         ENHANCED PRICING HEADER
         ======================================== -->
    <header class="enhanced-pricing-header">

        <!-- Contact Bar -->
        <div class="header-contact-bar">
            <div class="contact-bar-content">
                <div class="contact-info">
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span>(253) 922-5793</span>
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <span>sales@nwcustomapparel.com</span>
                    </div>
                </div>
                <div class="business-hours">
                    <i class="fas fa-clock"></i>
                    Monday - Friday: 8:30 AM - 5:00 PM PST
                </div>
            </div>
        </div>

        <!-- Main Navigation -->
        <div class="header-nav">
            <div class="nav-content">
                <div class="logo-section">
                    <a href="/" class="logo-link">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                             alt="Northwest Custom Apparel"
                             class="logo-image">
                    </a>
                </div>

                <!-- Search Bar -->
                <div class="header-search">
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text"
                               id="product-search"
                               class="search-input"
                               placeholder="Search products by style number or name..."
                               autocomplete="off">
                        <div id="search-results" class="search-results" style="display: none;">
                            <!-- Autocomplete results populated by JavaScript -->
                        </div>
                    </div>
                </div>

                <div class="header-actions">
                    <a href="/cart.html" class="cart-link">
                        <i class="fas fa-shopping-cart"></i>
                        <span class="cart-count" id="cart-count">0</span>
                    </a>
                </div>
            </div>
        </div>

        <!-- Pricing Context Bar (Breadcrumb + Live Pricing) -->
        <div class="pricing-context-bar">
            <div class="context-bar-content">
                <!-- Breadcrumb Navigation -->
                <nav class="breadcrumb" aria-label="Breadcrumb">
                    <a href="/">Home</a>
                    <span>/</span>
                    <a href="/product.html" id="products-breadcrumb">Products</a>
                    <span>/</span>
                    <span>[METHOD] Pricing</span>
                </nav>

                <!-- Live Pricing Display (Optional) -->
                <div class="header-live-pricing">
                    <div class="header-price-item">
                        <span class="header-price-label">Qty:</span>
                        <span id="header-quantity" class="header-price-value">24</span>
                    </div>
                    <div class="header-price-item">
                        <span class="header-price-label">Per Item:</span>
                        <span id="header-unit-price" class="header-price-value highlight">$0.00</span>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- ========================================
         MAIN CONTENT AREA
         ======================================== -->
    <div class="container">
        <div class="product-page-columns-container">

            <!-- LEFT COLUMN: Product Context -->
            <div class="product-context-column">

                <!-- Loading State -->
                <div id="loading-state" style="display: block;">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading product information...</p>
                    </div>
                </div>

                <!-- Product Hero Section -->
                <div id="product-hero" class="product-hero" style="display: none;">

                    <!-- Back Button -->
                    <button class="back-button" onclick="history.back()">
                        <i class="fas fa-arrow-left"></i> Back to Products
                    </button>

                    <!-- Image Gallery -->
                    <div class="product-images">
                        <div class="main-image-container">
                            <img id="main-product-image"
                                 src=""
                                 alt="Product Image"
                                 class="main-product-image">
                        </div>
                        <div id="thumbnail-gallery" class="thumbnail-gallery">
                            <!-- Thumbnails populated by JavaScript -->
                        </div>
                    </div>

                    <!-- Product Info -->
                    <div class="product-info">
                        <h1 id="product-title" class="product-title">Product Name</h1>
                        <div class="product-meta">
                            <span class="product-brand" id="product-brand">Brand</span>
                            <span class="product-style" id="product-style">Style #</span>
                        </div>
                        <p id="product-description" class="product-description">
                            Product description loading...
                        </p>

                        <!-- Color Swatches -->
                        <div class="color-selection">
                            <label class="color-label">Available Colors:</label>
                            <div id="color-swatches" class="color-swatches">
                                <!-- Color swatches populated by JavaScript -->
                            </div>
                        </div>

                        <!-- Info Box (Optional) -->
                        <div class="info-box">
                            <i class="fas fa-info-circle"></i>
                            <div>
                                <strong>[METHOD]-specific information</strong>
                                <p>Method-specific notes, requirements, or tips.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Pricing Calculator -->
            <div class="product-interactive-column">
                <div id="[method]-calculator-container" class="pricing-calculator-container">
                    <!-- Calculator UI inserted by JavaScript or included here -->

                    <!-- OPTION A: Toggle UI Pattern (like DTG) -->
                    <!-- See "Toggle UI Pattern" section below -->

                    <!-- OPTION B: Traditional Inputs -->
                    <!-- Quantity inputs, color counts, etc. -->

                </div>
            </div>

        </div>
    </div>

    <!-- ========================================
         JAVASCRIPT
         ======================================== -->

    <!-- Core Scripts -->
    <script src="/shared_components/js/pricing-pages.js"></script>
    <script src="/shared_components/js/pricing-matrix-api.js"></script>

    <!-- Universal Components -->
    <script src="/shared_components/js/universal-image-gallery.js"></script>

    <!-- Method-Specific Scripts -->
    <script src="/shared_components/js/[method]-pricing-service.js"></script>
    <script src="/shared_components/js/[method]-calculator.js"></script>

    <!-- Page Initialization -->
    <script>
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('[METHOD]Pricing: Page loaded');

            // Get URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = urlParams.get('styleNumber') || urlParams.get('style');

            if (!styleNumber) {
                showError('No product specified. Please select a product.');
                return;
            }

            // Update breadcrumb with product link
            updateBreadcrumb(styleNumber);

            try {
                // Show loading state
                showLoading();

                // Fetch product data and pricing data in parallel
                const [productData, pricingData] = await Promise.all([
                    fetchProductDetails(styleNumber),
                    fetchPricingData(styleNumber)
                ]);

                // Populate product display
                populateProductDisplay(productData);

                // Initialize calculator with pricing data
                initializeCalculator(pricingData);

                // Initialize search bar
                initializeSearchBar();

                // Show product
                showProduct();

            } catch (error) {
                console.error('[METHOD]Pricing: Error loading data', error);
                showError('Failed to load product information. Please try again.');
            }
        });

        // Update breadcrumb Products link
        function updateBreadcrumb(styleNumber) {
            const productsBreadcrumb = document.getElementById('products-breadcrumb');
            if (productsBreadcrumb && styleNumber) {
                productsBreadcrumb.href = `/product.html?style=${styleNumber}`;
            }
        }

        // Show/hide states
        function showLoading() {
            document.getElementById('loading-state').style.display = 'block';
            document.getElementById('product-hero').style.display = 'none';
        }

        function showProduct() {
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('product-hero').style.display = 'block';
        }

        function showError(message) {
            document.getElementById('loading-state').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                    <button onclick="history.back()" class="btn-secondary">Go Back</button>
                </div>
            `;
        }

        // Fetch product details
        async function fetchProductDetails(styleNumber) {
            const response = await fetch(`/api/product-details?styleNumber=${styleNumber}`);
            if (!response.ok) throw new Error('Failed to fetch product details');
            return await response.json();
        }

        // Fetch pricing data
        async function fetchPricingData(styleNumber) {
            const response = await fetch(`/api/pricing-bundle?method=[METHOD]&styleNumber=${styleNumber}`);
            if (!response.ok) throw new Error('Failed to fetch pricing data');
            return await response.json();
        }

        // Populate product display
        function populateProductDisplay(data) {
            document.getElementById('product-title').textContent = data.productName || 'Product';
            document.getElementById('product-brand').textContent = data.brand || '';
            document.getElementById('product-style').textContent = data.styleNumber || '';
            document.getElementById('product-description').textContent = data.description || '';

            // Set main image
            const mainImage = document.getElementById('main-product-image');
            mainImage.src = data.imageUrl || data.images?.[0] || '/images/placeholder.png';
            mainImage.alt = data.productName;

            // Populate color swatches
            populateColorSwatches(data.colors || []);

            // Populate image gallery
            populateImageGallery(data.images || []);
        }

        // Populate color swatches
        function populateColorSwatches(colors) {
            const container = document.getElementById('color-swatches');
            container.innerHTML = '';

            colors.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color.hex || '#ccc';
                swatch.title = color.name;
                swatch.addEventListener('click', () => {
                    // Update main image or filter by color
                    if (color.imageUrl) {
                        document.getElementById('main-product-image').src = color.imageUrl;
                    }
                });
                container.appendChild(swatch);
            });
        }

        // Populate image gallery thumbnails
        function populateImageGallery(images) {
            const gallery = document.getElementById('thumbnail-gallery');
            gallery.innerHTML = '';

            images.forEach((imageUrl, index) => {
                const thumb = document.createElement('img');
                thumb.src = imageUrl;
                thumb.className = 'thumbnail';
                if (index === 0) thumb.classList.add('active');
                thumb.addEventListener('click', () => {
                    document.getElementById('main-product-image').src = imageUrl;
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                gallery.appendChild(thumb);
            });
        }

        // Initialize search bar
        function initializeSearchBar() {
            const searchInput = document.getElementById('product-search');
            const searchResults = document.getElementById('search-results');
            let debounceTimer;

            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const query = e.target.value.trim();

                if (query.length < 2) {
                    searchResults.style.display = 'none';
                    return;
                }

                debounceTimer = setTimeout(async () => {
                    try {
                        const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);
                        const results = await response.json();
                        displaySearchResults(results);
                    } catch (error) {
                        console.error('Search error:', error);
                    }
                }, 300);
            });

            // Close results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.style.display = 'none';
                }
            });
        }

        // Display search results
        function displaySearchResults(results) {
            const container = document.getElementById('search-results');

            if (!results || results.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.innerHTML = results.slice(0, 8).map(item => `
                <a href="/product.html?style=${item.styleNumber}" class="search-result-item">
                    <img src="${item.imageUrl || '/images/placeholder.png'}" alt="${item.name}">
                    <div>
                        <div class="search-result-name">${item.name}</div>
                        <div class="search-result-style">${item.styleNumber}</div>
                    </div>
                </a>
            `).join('');

            container.style.display = 'block';
        }

        // Initialize calculator (method-specific)
        function initializeCalculator(pricingData) {
            // Method-specific calculator initialization
            // This varies by pricing type (DTG, Embroidery, etc.)
            console.log('[METHOD]Calculator: Initializing with pricing data', pricingData);
        }
    </script>

</body>
</html>
```

---

## API Endpoints Reference

### Base URL
```javascript
const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
```

### Product Data Endpoints

#### 1. Product Details
```javascript
GET /api/product-details?styleNumber=PC61

Response:
{
    "styleNumber": "PC61",
    "productName": "Essential T-Shirt",
    "brand": "Port & Company",
    "description": "100% cotton essential tee...",
    "imageUrl": "https://...",
    "images": ["url1", "url2", "url3"],
    "colors": [
        { "name": "Black", "code": "BLK", "hex": "#000000", "imageUrl": "..." },
        { "name": "White", "code": "WHT", "hex": "#FFFFFF", "imageUrl": "..." }
    ]
}

Usage:
const productData = await fetch('/api/product-details?styleNumber=PC61')
    .then(r => r.json());
```

#### 2. Color Swatches
```javascript
GET /api/color-swatches?styleNumber=PC61

Response:
{
    "styleNumber": "PC61",
    "colors": [
        {
            "colorName": "Black",
            "colorCode": "BLK",
            "hexCode": "#000000",
            "imageUrl": "https://...",
            "available": true
        }
    ]
}

Usage:
const swatches = await fetch('/api/color-swatches?styleNumber=PC61')
    .then(r => r.json());
```

#### 3. Product Colors (Alternative)
```javascript
GET /api/product-colors?styleNumber=PC61

Response:
[
    {
        "name": "Black",
        "hex": "#000000",
        "available": true
    }
]

Usage:
const colors = await fetch('/api/product-colors?styleNumber=PC61')
    .then(r => r.json());
```

#### 4. Style Search (Autocomplete)
```javascript
GET /api/stylesearch?term=PC

Response:
[
    {
        "styleNumber": "PC54",
        "name": "Core Cotton Tee",
        "brand": "Port & Company",
        "imageUrl": "https://...",
        "price": 5.50
    }
]

Usage:
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value;
    if (query.length < 2) return;

    const results = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`)
        .then(r => r.json());

    displaySearchResults(results);
}, 300));

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
```

### Pricing Data Endpoints

#### 5. Pricing Bundle (Method-Specific)
```javascript
GET /api/pricing-bundle?method=DTG&styleNumber=PC61

Response:
{
    "styleNumber": "PC61",
    "method": "dtg",
    "tiers": [
        {
            "TierLabel": "24-47",
            "MinQuantity": 24,
            "MaxQuantity": 47,
            "MarginDenominator": 0.6
        }
    ],
    "sizes": [
        { "size": "S", "price": 5.50, "sortOrder": 1 },
        { "size": "M", "price": 5.50, "sortOrder": 2 }
    ],
    "upcharges": {
        "2XL": 2.00,
        "3XL": 3.00,
        "4XL": 4.00
    },
    // Method-specific data
    "locations": [...],      // For DTG/DTF
    "stitchCounts": [...],   // For Embroidery
    "colorCounts": [...]     // For Screen Print
}

Usage:
const pricingData = await fetch('/api/pricing-bundle?method=DTG&styleNumber=PC61')
    .then(r => r.json());
```

#### 6. DTG Product Bundle (DTG-Specific)
```javascript
GET /api/dtg/product-bundle?styleNumber=PC61

Response:
{
    "product": { /* product details */ },
    "pricing": { /* pricing data */ },
    "locations": [ /* print locations */ ]
}

Usage (DTG only):
const bundle = await fetch('/api/dtg/product-bundle?styleNumber=PC61')
    .then(r => r.json());
```

#### 7. Size Pricing
```javascript
GET /api/size-pricing?styleNumber=PC61

Response:
{
    "sizes": [
        { "size": "S", "basePrice": 5.50, "upcharge": 0 },
        { "size": "2XL", "basePrice": 5.50, "upcharge": 2.00 }
    ]
}

Usage (Embroidery):
const sizePricing = await fetch('/api/size-pricing?styleNumber=PC61')
    .then(r => r.json());
```

---

## JavaScript Implementation

### Complete Implementation Pattern

```javascript
// State management
const state = {
    styleNumber: null,
    productData: null,
    pricingData: null,
    selectedColor: null,
    quantity: 24,
    // Method-specific state
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        state.styleNumber = urlParams.get('styleNumber') || urlParams.get('style');

        if (!state.styleNumber) {
            showError('No product specified');
            return;
        }

        // 2. Update breadcrumb
        updateBreadcrumb(state.styleNumber);

        // 3. Show loading
        showLoading();

        // 4. Fetch data in parallel (IMPORTANT: Use Promise.all for performance)
        const [productData, pricingData] = await Promise.all([
            fetch(`/api/product-details?styleNumber=${state.styleNumber}`).then(r => r.json()),
            fetch(`/api/pricing-bundle?method=[METHOD]&styleNumber=${state.styleNumber}`).then(r => r.json())
        ]);

        // 5. Store data
        state.productData = productData;
        state.pricingData = pricingData;

        // 6. Populate UI
        populateProductDisplay(productData);
        initializeCalculator(pricingData);

        // 7. Initialize features
        initializeSearchBar();
        initializeImageGallery();

        // 8. Show product
        showProduct();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load product data');
    }
});

// Show/hide helpers
function showLoading() {
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('product-hero').style.display = 'none';
}

function showProduct() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('product-hero').style.display = 'block';
}

function showError(message) {
    document.getElementById('loading-state').innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
            <button onclick="history.back()">Go Back</button>
        </div>
    `;
}
```

---

## Toggle UI Pattern

### When to Use Toggle UI
- Multiple options where only 1-2 can be selected (e.g., print locations)
- Visual toggle switches provide better UX than checkboxes
- Need to enforce selection limits (e.g., max 1 front + 1 back location)

### Toggle UI HTML Structure

```html
<div class="toggle-pricing-container">
    <!-- Left Panel: Toggle Options -->
    <div class="toggle-section">
        <div class="toggle-section-title">
            <i class="fas fa-layer-group"></i>
            Print Locations
        </div>
        <div class="toggle-section-subtitle">
            Select a maximum of two locations.
        </div>

        <div class="location-grid">
            <!-- Each toggle item -->
            <div class="toggle-item" id="toggle-LC" data-location="LC">
                <div class="toggle-item-label">
                    <span>Left Chest</span>
                    <span class="toggle-item-size">4"×4"</span>
                </div>
                <div class="toggle-switch">
                    <div class="toggle-switch-slider"></div>
                </div>
            </div>

            <div class="toggle-item" id="toggle-FF" data-location="FF">
                <div class="toggle-item-label">
                    <span>Full Front</span>
                    <span class="toggle-item-size">12"×16"</span>
                </div>
                <div class="toggle-switch">
                    <div class="toggle-switch-slider"></div>
                </div>
            </div>

            <!-- Repeat for all locations -->
        </div>
    </div>

    <!-- Right Panel: Quantity Tiers -->
    <div class="toggle-section">
        <div class="toggle-section-title">
            <i class="fas fa-chart-bar"></i>
            Quantity Tiers
        </div>

        <button class="tier-button" id="tier-ltm" data-tier="1-23">
            Less than 24 pieces<br>
            <small style="font-size: 11px; opacity: 0.9;">+ $50 Small Batch Fee</small>
        </button>

        <button class="tier-button selected" id="tier-24-47" data-tier="24-47">
            24-47 pieces
        </button>

        <button class="tier-button" id="tier-48-71" data-tier="48-71">
            48-71 pieces
        </button>

        <button class="tier-button" id="tier-72" data-tier="72+">
            72+ pieces
        </button>
    </div>
</div>

<!-- Live Price Display -->
<div class="live-price-display">
    <div class="live-price-label">Price per item</div>
    <div class="live-price-amount" id="live-price-amount">$0.00</div>
    <div class="live-price-detail" id="live-price-detail">Select a location to see pricing</div>
    <div class="live-price-fee" id="live-price-fee"></div>
</div>
```

### Toggle UI CSS

```css
/* Toggle pricing container - side by side panels */
.toggle-pricing-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
}

.toggle-section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 24px;
}

.toggle-section-title {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.toggle-section-subtitle {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 16px;
}

/* 2x3 Grid for location cards */
.location-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

/* Toggle Item (entire card is clickable) */
.toggle-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
}

.toggle-item:hover {
    border-color: #4cb354;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(76, 179, 84, 0.1);
}

.toggle-item.active {
    background: #e8f5e9;
    border-color: #4cb354;
    border-width: 3px;
}

.toggle-item-label {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.toggle-item-size {
    font-size: 12px;
    font-weight: 400;
    color: #6b7280;
}

/* iOS-style toggle switch */
.toggle-switch {
    position: relative;
    width: 56px;
    height: 32px;
    background: #d1d5db;
    border-radius: 16px;
    transition: background 0.3s;
}

.toggle-switch.on {
    background: #4cb354;
}

.toggle-switch-slider {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle-switch.on .toggle-switch-slider {
    transform: translateX(24px);
}

/* Tier Buttons */
.tier-button {
    width: 100%;
    padding: 20px;
    margin-bottom: 12px;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
}

.tier-button:hover {
    border-color: #4cb354;
    background: #f0f9ff;
}

.tier-button.selected {
    background: white;
    border-color: #4cb354;
    border-width: 3px;
    color: #4cb354;
}

.tier-button:last-child {
    margin-bottom: 0;
}

/* Live Price Display */
.live-price-display {
    background: linear-gradient(135deg, #4cb354 0%, #3a9142 100%);
    color: white;
    padding: 32px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 8px 24px rgba(76, 179, 84, 0.3);
}

.live-price-label {
    font-size: 16px;
    opacity: 0.95;
    margin-bottom: 8px;
}

.live-price-amount {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 8px;
}

.live-price-detail {
    font-size: 14px;
    opacity: 0.9;
}

.live-price-fee {
    margin-top: 12px;
    font-size: 14px;
    opacity: 0.9;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .toggle-pricing-container {
        grid-template-columns: 1fr;
    }

    .location-grid {
        grid-template-columns: 1fr;
    }
}
```

### Toggle UI JavaScript

```javascript
// Toggle state
const toggleState = {
    selectedLocations: [], // Array of location codes
    selectedTier: '24-47', // Default tier
};

// Initialize toggle UI
function initializeToggleUI() {
    console.log('Initializing toggle interface...');

    // Set up location toggle event listeners - ENTIRE CARD CLICKABLE
    const locationToggles = document.querySelectorAll('.toggle-item');
    locationToggles.forEach(toggle => {
        const locationCode = toggle.dataset.location;

        // Make entire card clickable
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLocation(locationCode);
        });
    });

    // Set up tier button event listeners
    const tierButtons = document.querySelectorAll('.tier-button');
    tierButtons.forEach(button => {
        const tierLabel = button.dataset.tier;
        button.addEventListener('click', () => {
            selectTier(tierLabel);
        });
    });

    // Initialize with default tier selected
    updateLivePriceDisplay();

    console.log('Toggle interface initialized');
}

// Toggle a location on/off with validation
function toggleLocation(locationCode) {
    const index = toggleState.selectedLocations.indexOf(locationCode);
    const isCurrentlyOn = index !== -1;

    // Define location constraints (example: max 1 front + 1 back)
    const frontLocations = ['LC', 'FF', 'JF'];
    const backLocations = ['FB', 'JB'];
    const isFront = frontLocations.includes(locationCode);
    const isBack = backLocations.includes(locationCode);

    if (isCurrentlyOn) {
        // Turn OFF: Remove from selected locations
        toggleState.selectedLocations.splice(index, 1);
        updateToggleUI(locationCode, false);
        console.log(`Toggled OFF: ${locationCode}`);
    } else {
        // Turn ON: Check constraints
        const currentFrontCount = toggleState.selectedLocations.filter(loc => frontLocations.includes(loc)).length;
        const currentBackCount = toggleState.selectedLocations.filter(loc => backLocations.includes(loc)).length;

        // Validation: Max 1 front + Max 1 back = Max 2 total
        if (isFront && currentFrontCount >= 1) {
            // Already have a front location - turn off the old one first
            const oldFrontLocation = toggleState.selectedLocations.find(loc => frontLocations.includes(loc));
            toggleState.selectedLocations = toggleState.selectedLocations.filter(loc => loc !== oldFrontLocation);
            updateToggleUI(oldFrontLocation, false);
            console.log(`Replacing front location ${oldFrontLocation} with ${locationCode}`);
        }

        if (isBack && currentBackCount >= 1) {
            // Already have a back location - turn off the old one first
            const oldBackLocation = toggleState.selectedLocations.find(loc => backLocations.includes(loc));
            toggleState.selectedLocations = toggleState.selectedLocations.filter(loc => loc !== oldBackLocation);
            updateToggleUI(oldBackLocation, false);
            console.log(`Replacing back location ${oldBackLocation} with ${locationCode}`);
        }

        // Add the new location
        toggleState.selectedLocations.push(locationCode);
        updateToggleUI(locationCode, true);
        console.log(`Toggled ON: ${locationCode}`);
    }

    // Update live price display
    updateLivePriceDisplay();
}

// Update toggle UI visual state
function updateToggleUI(locationCode, isOn) {
    const toggleElement = document.getElementById(`toggle-${locationCode}`);
    if (!toggleElement) return;

    const toggleSwitch = toggleElement.querySelector('.toggle-switch');
    if (isOn) {
        toggleElement.classList.add('active');  // Add to card
        toggleSwitch.classList.add('on');
    } else {
        toggleElement.classList.remove('active');  // Remove from card
        toggleSwitch.classList.remove('on');
    }
}

// Select a tier
function selectTier(tierLabel) {
    console.log(`Selected tier: ${tierLabel}`);

    // Update state
    toggleState.selectedTier = tierLabel;

    // Update button UI
    document.querySelectorAll('.tier-button').forEach(button => {
        if (button.dataset.tier === tierLabel) {
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
        }
    });

    // Update live price display
    updateLivePriceDisplay();
}

// Calculate and update live price display
function updateLivePriceDisplay() {
    const priceAmountElement = document.getElementById('live-price-amount');
    const priceDetailElement = document.getElementById('live-price-detail');
    const priceFeeElement = document.getElementById('live-price-fee');

    if (!priceAmountElement || !priceDetailElement) {
        console.error('Live price display elements not found');
        return;
    }

    // Check if any locations are selected
    if (toggleState.selectedLocations.length === 0) {
        priceAmountElement.textContent = '$0.00';
        priceDetailElement.textContent = 'Select a location to see pricing';
        if (priceFeeElement) priceFeeElement.textContent = '';
        return;
    }

    // Calculate price based on selected locations and tier
    // (Method-specific pricing logic here)
    const price = calculatePrice(toggleState.selectedLocations, toggleState.selectedTier);

    priceAmountElement.textContent = `$${price.toFixed(2)}`;
    priceDetailElement.textContent = `${toggleState.selectedLocations.length} location(s) selected`;

    // Show LTM fee if applicable
    if (toggleState.selectedTier === '1-23') {
        if (priceFeeElement) priceFeeElement.textContent = '+ $50 Small Batch Fee';
    } else {
        if (priceFeeElement) priceFeeElement.textContent = '';
    }
}

// Calculate price (method-specific implementation)
function calculatePrice(locations, tier) {
    // This is method-specific
    // Example for DTG:
    // - Get base garment cost
    // - Add print costs for each location
    // - Apply margin based on tier
    // - Round to half dollar

    return 12.50; // Placeholder
}
```

---

## CSS Requirements

### Load Order (CRITICAL)

CSS files MUST be loaded in this exact order:

```html
<!-- 1. Universal Pricing CSS (Theme Foundation) -->
<link rel="stylesheet" href="/shared_components/css/universal-pricing-header.css">
<link rel="stylesheet" href="/shared_components/css/universal-pricing-layout.css">
<link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">
<link rel="stylesheet" href="/shared_components/css/universal-pricing-components.css">

<!-- 2. Shared CSS -->
<link rel="stylesheet" href="/shared_components/css/shared-pricing-styles.css">
<link rel="stylesheet" href="/shared_components/css/modern-enhancements.css">

<!-- 3. Universal Components -->
<link rel="stylesheet" href="/shared_components/css/universal-header.css">
<link rel="stylesheet" href="/shared_components/css/universal-product-display.css">
<link rel="stylesheet" href="/shared_components/css/universal-image-gallery.css">
<link rel="stylesheet" href="/shared_components/css/universal-pricing-grid.css">

<!-- 4. Method-Specific CSS (Highest Priority) -->
<link rel="stylesheet" href="/shared_components/css/[method]-specific.css?v=20250107">
```

### Theme Variables

```css
:root {
    --primary-color: #4cb354;
    --primary-dark: #3a9142;
    --primary-light: #e8f5e9;

    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --text-light: #9ca3af;

    --border-color: #e5e7eb;
    --background-light: #f8f9fa;

    --success-color: #10b981;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
}
```

### Two-Column Layout

```css
.product-page-columns-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    max-width: 1400px;
    margin: 0 auto;
    padding: 32px 20px;
}

.product-context-column {
    position: sticky;
    top: 200px; /* Account for fixed header */
    align-self: start;
}

.product-interactive-column {
    /* Scrollable calculator */
}

@media (max-width: 1024px) {
    .product-page-columns-container {
        grid-template-columns: 1fr;
    }

    .product-context-column {
        position: static;
    }
}
```

---

## Breadcrumb Navigation

### HTML Structure

```html
<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span>/</span>
    <a href="/product.html" id="products-breadcrumb">Products</a>
    <span>/</span>
    <span>[METHOD] Pricing</span>
</nav>
```

### JavaScript Update

```javascript
// Update breadcrumb Products link with current style
function updateBreadcrumb(styleNumber) {
    const productsBreadcrumb = document.getElementById('products-breadcrumb');
    if (productsBreadcrumb && styleNumber) {
        // Update href to go back to this product's detail page
        productsBreadcrumb.href = `/product.html?style=${styleNumber}`;
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const styleNumber = urlParams.get('styleNumber') || urlParams.get('style');
    updateBreadcrumb(styleNumber);
});
```

### CSS Styling

```css
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #6b7280;
}

.breadcrumb a {
    color: #4cb354;
    text-decoration: none;
    transition: text-decoration 0.2s;
}

.breadcrumb a:hover {
    text-decoration: underline;
}

.breadcrumb span:not([class]) {
    color: #d1d5db;
}
```

---

## Search Bar Implementation

### HTML Structure

```html
<div class="header-search">
    <div class="search-container">
        <i class="fas fa-search search-icon"></i>
        <input type="text"
               id="product-search"
               class="search-input"
               placeholder="Search products by style number or name..."
               autocomplete="off">
        <div id="search-results" class="search-results" style="display: none;">
            <!-- Results populated by JavaScript -->
        </div>
    </div>
</div>
```

### JavaScript Implementation

```javascript
function initializeSearchBar() {
    const searchInput = document.getElementById('product-search');
    const searchResults = document.getElementById('search-results');
    let debounceTimer;

    // Input handler with debounce
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        // Hide results if query too short
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        // Debounce API calls (300ms delay)
        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed');

                const results = await response.json();
                displaySearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                searchResults.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
                searchResults.style.display = 'block';
            }
        }, 300);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Clear search on Escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
        }
    });
}

function displaySearchResults(results) {
    const container = document.getElementById('search-results');

    if (!results || results.length === 0) {
        container.innerHTML = '<div class="search-no-results">No products found</div>';
        container.style.display = 'block';
        return;
    }

    // Display up to 8 results
    container.innerHTML = results.slice(0, 8).map(item => `
        <a href="/product.html?style=${item.styleNumber}" class="search-result-item">
            <img src="${item.imageUrl || '/images/placeholder.png'}"
                 alt="${item.name}"
                 class="search-result-image">
            <div class="search-result-info">
                <div class="search-result-name">${item.name}</div>
                <div class="search-result-style">${item.styleNumber}</div>
                ${item.price ? `<div class="search-result-price">Starting at $${item.price.toFixed(2)}</div>` : ''}
            </div>
        </a>
    `).join('');

    container.style.display = 'block';
}
```

### CSS Styling

```css
.header-search {
    flex: 1;
    max-width: 600px;
    margin: 0 32px;
}

.search-container {
    position: relative;
}

.search-input {
    width: 100%;
    padding: 12px 16px 12px 44px;
    border: 2px solid #e5e7eb;
    border-radius: 24px;
    font-size: 15px;
    transition: all 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: #4cb354;
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.1);
}

.search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    pointer-events: none;
}

.search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    max-height: 400px;
    overflow-y: auto;
    z-index: 1001;
}

.search-result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s;
}

.search-result-item:last-child {
    border-bottom: none;
}

.search-result-item:hover {
    background: #f8f9fa;
}

.search-result-image {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
}

.search-result-info {
    flex: 1;
}

.search-result-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 2px;
}

.search-result-style {
    font-size: 13px;
    color: #6b7280;
}

.search-result-price {
    font-size: 13px;
    color: #4cb354;
    font-weight: 600;
    margin-top: 2px;
}

.search-no-results,
.search-error {
    padding: 16px;
    text-align: center;
    color: #6b7280;
}
```

---

## Validation Checklist

Use this checklist when standardizing an existing page or creating a new pricing page:

### Structure Validation
- [ ] Page uses standard two-column layout (`.product-page-columns-container`)
- [ ] Left column has `.product-context-column` class
- [ ] Right column has `.product-interactive-column` class
- [ ] Product hero section uses `.product-hero` class (NOT `.product-hero-section`)
- [ ] Loading state exists with `id="loading-state"`

### Header Validation
- [ ] Enhanced pricing header with three sections (contact bar, nav, context bar)
- [ ] Contact bar shows phone and email
- [ ] Logo links to homepage
- [ ] Search bar exists with `id="product-search"`
- [ ] Breadcrumb navigation exists and updates with styleNumber
- [ ] Products breadcrumb has `id="products-breadcrumb"`

### Product Display Validation
- [ ] Main product image with `id="main-product-image"`
- [ ] Thumbnail gallery with `id="thumbnail-gallery"`
- [ ] Product title with `id="product-title"`
- [ ] Product brand with `id="product-brand"`
- [ ] Product style with `id="product-style"`
- [ ] Product description with `id="product-description"`
- [ ] Color swatches container with `id="color-swatches"`
- [ ] Back button that goes to previous page

### API Integration Validation
- [ ] Uses `/api/product-details?styleNumber=` for product data
- [ ] Uses `/api/pricing-bundle?method=[METHOD]&styleNumber=` for pricing
- [ ] Uses `/api/stylesearch?term=` for search autocomplete
- [ ] Fetches product and pricing data in parallel with `Promise.all()`
- [ ] Handles loading, success, and error states

### JavaScript Validation
- [ ] DOMContentLoaded event listener exists
- [ ] Extracts styleNumber from URL parameters
- [ ] Updates breadcrumb with styleNumber
- [ ] `showLoading()` function exists and works
- [ ] `showProduct()` function exists and works
- [ ] `showError()` function exists and works
- [ ] Search bar has debounced input handler (300ms)
- [ ] Search results close when clicking outside

### CSS Validation
- [ ] CSS files loaded in correct order (universal → shared → components → method-specific)
- [ ] Body has method-specific class (e.g., `.dtg-pricing-page`)
- [ ] Body has appropriate padding-top for fixed header (180px)
- [ ] Primary color is `#4cb354` (green theme)
- [ ] Responsive design works on mobile (single column layout)

### Toggle UI Validation (If Applicable)
- [ ] Toggle items have `data-location` attribute
- [ ] Toggle switches have `.toggle-switch` and `.toggle-switch-slider` classes
- [ ] Tier buttons have `data-tier` attribute
- [ ] `initializeToggleUI()` function exists
- [ ] `toggleLocation()` function handles selection logic
- [ ] `updateToggleUI()` updates visual state
- [ ] `selectTier()` updates tier selection
- [ ] `updateLivePriceDisplay()` calculates and displays price
- [ ] Entire toggle card is clickable (not just switch)

### Performance Validation
- [ ] Images lazy load or load progressively
- [ ] API calls use `Promise.all()` for parallel fetching
- [ ] Search uses debouncing (300ms)
- [ ] No console errors on page load
- [ ] Page loads in under 3 seconds

### Accessibility Validation
- [ ] All images have alt text
- [ ] Breadcrumb has `aria-label="Breadcrumb"`
- [ ] Form inputs have labels
- [ ] Interactive elements are keyboard accessible
- [ ] Color contrast meets WCAG AA standards

### Browser Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Mobile responsive (tested at 375px, 768px, 1024px)

---

## Quick Reference

### Key File Paths
```
/calculators/[method]-pricing.html
/shared_components/css/universal-pricing-header.css
/shared_components/css/universal-pricing-layout.css
/shared_components/css/universal-calculator-theme.css
/shared_components/js/universal-image-gallery.js
/shared_components/js/[method]-pricing-service.js
```

### Key API Endpoints
```
/api/product-details?styleNumber=PC61
/api/pricing-bundle?method=DTG&styleNumber=PC61
/api/stylesearch?term=PC
/api/color-swatches?styleNumber=PC61
```

### Key CSS Classes
```
.product-page-columns-container   (main container)
.product-context-column           (left: product display)
.product-interactive-column       (right: calculator)
.product-hero                     (product display section)
.enhanced-pricing-header          (fixed header)
.toggle-item                      (toggle card)
.toggle-switch                    (toggle switch)
.tier-button                      (tier selection button)
```

### Key JavaScript Functions
```javascript
showLoading()          // Show loading spinner
showProduct()          // Show product display
showError(message)     // Show error message
updateBreadcrumb(styleNumber)  // Update breadcrumb links
initializeSearchBar()  // Set up search autocomplete
initializeToggleUI()   // Set up toggle switches (if applicable)
toggleLocation(code)   // Toggle location on/off
selectTier(tier)       // Select quantity tier
updateLivePriceDisplay() // Update live price
```

---

## Usage Example

### Standardizing DTF Page

1. **Read current DTF page** to understand existing structure
2. **Replace header** with standard enhanced-pricing-header
3. **Add product hero section** using template above
4. **Update CSS load order** to match standard
5. **Add search bar** with autocomplete
6. **Update breadcrumb** to use standard pattern
7. **Add toggle UI** (if needed) for print locations
8. **Update JavaScript** to use standard initialization pattern
9. **Test all functionality** using validation checklist
10. **Verify mobile responsiveness**

### Creating New Laser Engraving Page

1. **Copy HTML template** from this document
2. **Replace `[METHOD]`** with `laser` throughout
3. **Create `/shared_components/css/laser-specific.css`**
4. **Create `/shared_components/js/laser-pricing-service.js`**
5. **Define laser-specific pricing logic** (pricing per engraving area, material type, etc.)
6. **Add method-specific UI** (e.g., material selector, size inputs)
7. **Configure API endpoint**: `/api/pricing-bundle?method=LASER&styleNumber=...`
8. **Test with validation checklist**
9. **Add to navigation menus**
10. **Update documentation**

---

## Troubleshooting

### Product Hero Not Showing
- Check if `showProduct()` is being called
- Verify `product-hero` has `display: none` initially
- Ensure API calls are completing successfully
- Check browser console for JavaScript errors

### Search Bar Not Working
- Verify `/api/stylesearch` endpoint is accessible
- Check debounce timer is set correctly (300ms)
- Ensure search results container exists with correct ID
- Check for JavaScript errors in console

### Breadcrumb Not Updating
- Verify `products-breadcrumb` ID exists
- Check `updateBreadcrumb()` is called on DOMContentLoaded
- Ensure styleNumber is extracted from URL correctly

### Toggle Switches Not Responding
- Check `data-location` attribute exists on toggle items
- Verify `initializeToggleUI()` is called
- Ensure entire card has click listener (not just switch)
- Check `toggleState.selectedLocations` array

### CSS Not Loading
- Verify CSS files exist at specified paths
- Check load order matches standard
- Clear browser cache
- Check for 404 errors in Network tab

---

**END OF AGENT DOCUMENTATION**

This agent serves as the single source of truth for all pricing page development. Reference this document when:
- Standardizing existing pricing pages (DTF, etc.)
- Creating new pricing pages (Laser Engraving, etc.)
- Debugging layout or functionality issues
- Training new developers on pricing page structure

**Version History:**
- v1.0 (2025-01-07): Initial comprehensive documentation including toggle UI patterns
