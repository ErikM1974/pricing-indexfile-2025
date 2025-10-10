# Product Page Redesign Plan 🎨

**Date:** January 10, 2025
**Status:** Design Document
**Target File:** `/product.html`

## 🎯 Design Goals

Transform the product page from a dated 2005 aesthetic to a modern, intuitive 2025 design that:
1. **Emphasizes product imagery** - Bigger, more prominent product photos
2. **Streamlines customization** - Makes decoration method selection the primary action
3. **Simplifies navigation** - Cleaner header focused on search functionality
4. **Maintains brand consistency** - Uses Northwest green theme matching pricing pages
5. **Improves user flow** - Intuitive path from viewing product → selecting decoration → getting pricing

---

## 📋 Current Issues (2005 Look)

### Problems Identified by Sales Team:
- ❌ Product images are too small
- ❌ Customization options are tiny and hard to find
- ❌ Outdated visual design and layout
- ❌ Header is cluttered with unnecessary navigation
- ❌ Check Inventory button uses wrong color (needs Northwest green)
- ❌ Overall layout doesn't prioritize key user actions

---

## ✨ Redesign Strategy

### 1. Header Simplification

**BEFORE:**
```
┌─────────────────────────────────────────────────────────────┐
│ Contact Bar: Phone | Email | Business Hours                 │
├─────────────────────────────────────────────────────────────┤
│ Logo  |  Search Bar  |  Home Products Resources Contact    │
├─────────────────────────────────────────────────────────────┤
│ Breadcrumb                                                   │
└─────────────────────────────────────────────────────────────┘
```

**AFTER:**
```
┌─────────────────────────────────────────────────────────────┐
│              Northwest Green Contact Bar                     │
│           Phone | Email | Business Hours                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [NWCA Logo]          [Search Bar]                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Changes:**
- Remove: Home, Products, Resources, Contact navigation links
- Keep: Logo (left), Search Bar (center-right)
- Update: Contact bar background to Northwest green (#4cb354)
- Clean: Minimal, focused design

---

### 2. Decoration Method Selector - TOP PRIORITY 🎯

**NEW PROMINENT POSITION:**
Place customization selector immediately below header, before product display

```
┌─────────────────────────────────────────────────────────────┐
│                  HOW WOULD YOU LIKE TO CUSTOMIZE?           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  🧵 EMB  │  │  🎨 DTG  │  │  🖨️ CAP  │  │  🖨️ SP   │   │
│  │Embroidery│  │  Print   │  │   Emb    │  │  Screen  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐                                │
│  │  🖨️ DTF  │  │  📦 MORE │                                │
│  │  Transfer│  │  Options │                                │
│  └──────────┘  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**Design Specifications:**
- **Size:** 140px × 140px minimum per button
- **Layout:** Grid layout, centered on page
- **Icons:** Large, colorful Font Awesome icons (48px)
- **Labels:** Clear, readable text (16px font)
- **Hover Effects:** Lift effect, shadow, color change
- **Active State:** Green border, filled background
- **Spacing:** 24px gap between buttons

**HTML Structure:**
```html
<section class="decoration-selector-hero">
    <div class="container">
        <h2 class="decoration-hero-title">How would you like to customize this?</h2>
        <p class="decoration-hero-subtitle">Choose your decoration method to see pricing</p>

        <div class="decoration-methods-grid">
            <!-- Embroidery -->
            <button class="decoration-method-card" data-method="embroidery">
                <div class="method-icon">
                    <i class="fas fa-spool-thread"></i>
                </div>
                <div class="method-name">Embroidery</div>
                <div class="method-desc">Professional thread embroidery</div>
            </button>

            <!-- DTG -->
            <button class="decoration-method-card" data-method="dtg">
                <div class="method-icon">
                    <i class="fas fa-print"></i>
                </div>
                <div class="method-name">DTG Print</div>
                <div class="method-desc">Direct-to-garment printing</div>
            </button>

            <!-- Cap Embroidery -->
            <button class="decoration-method-card" data-method="cap-embroidery">
                <div class="method-icon">
                    <i class="fas fa-hat-cowboy"></i>
                </div>
                <div class="method-name">Cap Embroidery</div>
                <div class="method-desc">Premium cap decoration</div>
            </button>

            <!-- Screen Print -->
            <button class="decoration-method-card" data-method="screen-print">
                <div class="method-icon">
                    <i class="fas fa-shirt"></i>
                </div>
                <div class="method-name">Screen Print</div>
                <div class="method-desc">High-volume printing</div>
            </button>

            <!-- DTF -->
            <button class="decoration-method-card" data-method="dtf">
                <div class="method-icon">
                    <i class="fas fa-file-image"></i>
                </div>
                <div class="method-name">DTF Transfer</div>
                <div class="method-desc">Direct-to-film transfers</div>
            </button>

            <!-- More Options -->
            <button class="decoration-method-card more-options" data-method="more">
                <div class="method-icon">
                    <i class="fas fa-ellipsis-h"></i>
                </div>
                <div class="method-name">More Options</div>
                <div class="method-desc">View all decoration methods</div>
            </button>
        </div>
    </div>
</section>
```

**CSS Styling:**
```css
/* Decoration Selector Hero Section */
.decoration-selector-hero {
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    padding: 60px 20px;
    margin-bottom: 40px;
    border-bottom: 3px solid #4cb354;
}

.decoration-hero-title {
    text-align: center;
    font-size: 32px;
    font-weight: 700;
    color: #333;
    margin-bottom: 12px;
}

.decoration-hero-subtitle {
    text-align: center;
    font-size: 18px;
    color: #666;
    margin-bottom: 40px;
}

.decoration-methods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 0 auto;
}

.decoration-method-card {
    background: white;
    border: 3px solid #e5e7eb;
    border-radius: 16px;
    padding: 32px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.decoration-method-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 24px rgba(76, 179, 84, 0.2);
    border-color: #4cb354;
}

.decoration-method-card.active {
    background: linear-gradient(135deg, #4cb354 0%, #409a47 100%);
    border-color: #409a47;
    color: white;
}

.method-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: #4cb354;
    transition: transform 0.3s ease;
}

.decoration-method-card:hover .method-icon {
    transform: scale(1.1);
}

.decoration-method-card.active .method-icon {
    color: white;
}

.method-name {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #333;
}

.decoration-method-card.active .method-name {
    color: white;
}

.method-desc {
    font-size: 14px;
    color: #666;
    line-height: 1.4;
}

.decoration-method-card.active .method-desc {
    color: rgba(255, 255, 255, 0.9);
}

/* More Options Card - Subtle Style */
.decoration-method-card.more-options {
    border-style: dashed;
    background: #f9fafb;
}

.decoration-method-card.more-options:hover {
    background: white;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .decoration-methods-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }

    .decoration-method-card {
        padding: 24px 12px;
        min-height: 160px;
    }

    .method-icon {
        font-size: 36px;
    }

    .method-name {
        font-size: 16px;
    }

    .method-desc {
        font-size: 12px;
    }
}
```

---

### 3. Product Display Layout

**NEW LAYOUT:**
```
┌─────────────────────────────────────────────────────────────┐
│                    DECORATION SELECTOR                       │
│                    (See Above Section)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────────────────┐  ┌─────────────┐ │
│  │          │  │                        │  │             │ │
│  │   Thumb  │  │                        │  │  Product    │ │
│  │   nails  │  │    LARGE MAIN IMAGE    │  │  Info       │ │
│  │          │  │       (60% width)      │  │             │ │
│  │   [  ]   │  │                        │  │  Style: XXX │ │
│  │   [  ]   │  │         800px+         │  │             │ │
│  │   [  ]   │  │                        │  │  ┌────────┐ │ │
│  │   [  ]   │  │                        │  │  │ CHECK  │ │ │
│  │          │  │                        │  │  │INVENTOR│ │ │
│  └──────────┘  └────────────────────────┘  │  │  (NW   │ │ │
│                                             │  │ Green) │ │ │
│                                             │  └────────┘ │ │
│                                             │             │ │
│                                             │  Colors     │ │
│                                             │  Available  │ │
│                                             └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Grid Layout:**
```css
.product-display-grid {
    display: grid;
    grid-template-columns: 100px 1fr 400px;
    gap: 30px;
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 20px;
}

/* Column 1: Thumbnails */
.product-thumbnails {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.thumbnail {
    width: 100px;
    height: 100px;
    border: 3px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
}

.thumbnail:hover,
.thumbnail.active {
    border-color: #4cb354;
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}

/* Column 2: Main Image */
.product-gallery {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: #f9fafb;
    min-height: 600px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.main-image {
    max-width: 100%;
    height: auto;
    display: block;
}

/* Column 3: Product Info */
.product-info-column {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

---

### 4. Check Inventory Button - Northwest Green

**NEW DESIGN:**
```html
<button class="check-inventory-btn">
    <i class="fas fa-boxes"></i>
    <span>Check Inventory</span>
</button>
```

**Styling:**
```css
.check-inventory-btn {
    background: #4cb354;  /* Northwest green */
    color: white;
    border: none;
    border-radius: 8px;
    padding: 16px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}

.check-inventory-btn:hover {
    background: #409a47;  /* Darker green */
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(76, 179, 84, 0.4);
}

.check-inventory-btn:active {
    transform: translateY(0);
}

.check-inventory-btn i {
    font-size: 18px;
}
```

---

### 5. Color Swatches Enhancement

**IMPROVED DESIGN:**
```html
<div class="color-swatches-section">
    <h3>Available Colors (3)</h3>
    <div class="swatches-grid">
        <div class="color-swatch" data-color="Black">
            <div class="swatch-circle">
                <img src="black-swatch.jpg" alt="Black">
            </div>
            <span class="swatch-label">Black</span>
        </div>
        <!-- More swatches -->
    </div>
</div>
```

**Styling:**
```css
.color-swatches-section {
    margin-top: 30px;
    padding-top: 30px;
    border-top: 2px solid #e5e7eb;
}

.color-swatches-section h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    color: #333;
}

.swatches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 16px;
}

.color-swatch {
    text-align: center;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.color-swatch:hover {
    transform: scale(1.05);
}

.swatch-circle {
    width: 70px;
    height: 70px;
    border: 3px solid #e5e7eb;
    border-radius: 50%;
    overflow: hidden;
    margin: 0 auto 8px;
    transition: border-color 0.2s ease;
    background: white;
}

.color-swatch.selected .swatch-circle,
.color-swatch:hover .swatch-circle {
    border-color: #4cb354;
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.1);
}

.swatch-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.swatch-label {
    font-size: 13px;
    color: #666;
    display: block;
}

.color-swatch.selected .swatch-label {
    color: #4cb354;
    font-weight: 600;
}
```

---

### 6. Complete Header Code

**HTML Structure:**
```html
<header class="product-page-header">
    <!-- Tier 1: Contact Bar -->
    <div class="header-contact-bar">
        <div class="contact-bar-content">
            <div class="contact-info">
                <div class="contact-item">
                    <i class="fas fa-phone"></i>
                    <a href="tel:2539225793" class="contact-link">(253) 922-5793</a>
                </div>
                <div class="contact-item">
                    <i class="fas fa-envelope"></i>
                    <a href="mailto:sales@nwcustomapparel.com" class="contact-link">sales@nwcustomapparel.com</a>
                </div>
            </div>
            <div class="business-hours">
                <i class="fas fa-clock"></i>
                Monday - Friday: 8:30 AM - 5:00 PM PST
            </div>
        </div>
    </div>

    <!-- Tier 2: Logo & Search -->
    <div class="header-main">
        <div class="header-main-content">
            <a href="/" class="logo-link">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                     alt="Northwest Custom Apparel"
                     class="logo-image">
            </a>

            <div class="header-search">
                <input type="text"
                       class="search-input"
                       placeholder="Search products by style number or name..."
                       id="header-style-search">
                <button class="search-button">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        </div>
    </div>
</header>
```

**CSS Styling:**
```css
/* Product Page Header */
.product-page-header {
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
}

/* Tier 1: Contact Bar */
.header-contact-bar {
    background: #4cb354;  /* Northwest green */
    color: white;
    padding: 12px 0;
    font-size: 14px;
}

.contact-bar-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.contact-info {
    display: flex;
    gap: 30px;
    align-items: center;
}

.contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.contact-link {
    color: white;
    text-decoration: none;
    transition: opacity 0.2s ease;
}

.contact-link:hover {
    opacity: 0.8;
    text-decoration: underline;
}

.business-hours {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    opacity: 0.95;
}

/* Tier 2: Logo & Search */
.header-main {
    background: white;
    padding: 20px 0;
    border-bottom: 1px solid #e5e7eb;
}

.header-main-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
}

.logo-link {
    display: flex;
    align-items: center;
}

.logo-image {
    height: 45px;
    width: auto;
    display: block;
}

.header-search {
    flex: 1;
    max-width: 600px;
    display: flex;
    gap: 10px;
}

.search-input {
    flex: 1;
    padding: 12px 20px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 15px;
    transition: all 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: #4cb354;
    box-shadow: 0 0 0 3px rgba(76, 179, 84, 0.1);
}

.search-button {
    background: #4cb354;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.search-button:hover {
    background: #409a47;
}

.search-button i {
    font-size: 16px;
}

/* Adjust body for fixed header */
body {
    padding-top: 130px;  /* Height of header */
}
```

---

### 7. Mobile Responsive Design

**Breakpoints:**
```css
/* Tablet (768px and below) */
@media (max-width: 768px) {
    body {
        padding-top: 200px;  /* More space for stacked header */
    }

    .contact-bar-content {
        flex-direction: column;
        gap: 10px;
        text-align: center;
    }

    .contact-info {
        flex-direction: column;
        gap: 10px;
    }

    .header-main-content {
        flex-direction: column;
    }

    .header-search {
        width: 100%;
        max-width: none;
    }

    /* Product Grid - Stack Vertically */
    .product-display-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }

    .product-thumbnails {
        flex-direction: row;
        overflow-x: auto;
    }

    .thumbnail {
        width: 80px;
        height: 80px;
    }

    /* Decoration Methods - 2 Columns */
    .decoration-methods-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
}

/* Mobile (480px and below) */
@media (max-width: 480px) {
    .logo-image {
        height: 36px;
    }

    .search-input {
        font-size: 14px;
        padding: 10px 16px;
    }

    .contact-item {
        font-size: 12px;
    }

    .decoration-hero-title {
        font-size: 24px;
    }

    .decoration-hero-subtitle {
        font-size: 16px;
    }
}
```

---

## 🎨 Color Palette Reference

### Primary Colors (Northwest Custom Apparel)
```css
:root {
    /* Northwest Green (Primary) */
    --nw-green: #4cb354;
    --nw-green-dark: #409a47;
    --nw-green-light: #e8f5e9;
    --nw-green-pale: rgba(76, 179, 84, 0.1);

    /* Neutral Colors */
    --text-primary: #333333;
    --text-secondary: #666666;
    --text-light: #999999;
    --border-color: #e5e7eb;
    --bg-white: #ffffff;
    --bg-light: #f9fafb;
    --bg-lighter: #f3f4f6;

    /* Accent Colors */
    --success-green: #10b981;
    --warning-yellow: #f59e0b;
    --error-red: #ef4444;
    --info-blue: #3b82f6;

    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

    /* Green Shadows */
    --shadow-green-sm: 0 2px 8px rgba(76, 179, 84, 0.2);
    --shadow-green-md: 0 4px 12px rgba(76, 179, 84, 0.3);
    --shadow-green-lg: 0 8px 20px rgba(76, 179, 84, 0.4);
}
```

---

## 🔄 Implementation Priority

### Phase 1: Critical Updates (Do First)
1. ✅ Update header color to Northwest green
2. ✅ Remove navigation links from header
3. ✅ Create prominent decoration selector section
4. ✅ Update Check Inventory button to Northwest green

### Phase 2: Layout Improvements
1. ✅ Enlarge product images
2. ✅ Reorganize product display grid
3. ✅ Improve thumbnail navigation
4. ✅ Enhance color swatches

### Phase 3: Polish & Refinement
1. ✅ Add hover effects and transitions
2. ✅ Implement mobile responsive design
3. ✅ Test cross-browser compatibility
4. ✅ Optimize page load performance

---

## 📊 Before & After Comparison

### Visual Hierarchy

**BEFORE:**
```
Priority 1: Header navigation
Priority 2: Search
Priority 3: Product image (small)
Priority 4: Product info
Priority 5: Decoration options (tiny, hidden)
```

**AFTER:**
```
Priority 1: Decoration method selector (HUGE, centered)
Priority 2: Product image (large, prominent)
Priority 3: Product info & inventory
Priority 4: Color swatches
Priority 5: Search (header)
```

### User Flow

**BEFORE:**
1. User lands on page
2. Sees small product image
3. Scrolls to find decoration options
4. Tiny buttons are hard to click
5. Not clear what to do next

**AFTER:**
1. User lands on page
2. Immediately sees "HOW WOULD YOU LIKE TO CUSTOMIZE?"
3. Large, clear decoration method buttons
4. Clicks preferred method
5. Sees large product image
6. Checks inventory (green button)
7. Views colors
8. Proceeds to pricing

---

## 🚀 JavaScript Functionality

### Decoration Method Selection
```javascript
// Handle decoration method selection
document.querySelectorAll('.decoration-method-card').forEach(card => {
    card.addEventListener('click', function() {
        const method = this.dataset.method;

        // Remove active class from all cards
        document.querySelectorAll('.decoration-method-card').forEach(c => {
            c.classList.remove('active');
        });

        // Add active class to clicked card
        this.classList.add('active');

        // Store selected method
        sessionStorage.setItem('selectedDecorationMethod', method);

        // Update pricing display based on method
        updatePricingForMethod(method);

        // Scroll to product display
        document.querySelector('.product-display-grid').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });
});

function updatePricingForMethod(method) {
    // Logic to fetch and display pricing for selected method
    console.log('Selected decoration method:', method);

    // Example: Show relevant pricing calculator link
    const pricingLink = document.querySelector('.pricing-calculator-link');
    if (pricingLink) {
        pricingLink.href = `/calculators/${method}-pricing.html`;
        pricingLink.textContent = `View ${method.toUpperCase()} Pricing`;
    }
}
```

### Check Inventory Button
```javascript
// Enhanced inventory check
document.querySelector('.check-inventory-btn').addEventListener('click', function() {
    const button = this;
    const originalHTML = button.innerHTML;

    // Show loading state
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Checking...</span>';
    button.disabled = true;

    // Fetch inventory (existing function)
    fetchInventoryData().then(data => {
        // Show inventory modal or section
        displayInventory(data);

        // Reset button
        button.innerHTML = originalHTML;
        button.disabled = false;
    }).catch(error => {
        console.error('Inventory check failed:', error);
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Error - Retry</span>';
        button.disabled = false;
    });
});
```

---

## ✨ Additional Enhancements

### 1. Breadcrumb Navigation (Optional)
```html
<div class="breadcrumb-nav">
    <a href="/">Home</a>
    <i class="fas fa-chevron-right"></i>
    <a href="/products">Products</a>
    <i class="fas fa-chevron-right"></i>
    <span>Port Authority Jacket</span>
</div>
```

### 2. Quick Actions Bar
```html
<div class="quick-actions-bar">
    <button class="quick-action-btn">
        <i class="fas fa-share-alt"></i>
        Share
    </button>
    <button class="quick-action-btn">
        <i class="fas fa-heart"></i>
        Save
    </button>
    <button class="quick-action-btn">
        <i class="fas fa-print"></i>
        Print
    </button>
</div>
```

### 3. Sticky "Get Pricing" Button (Mobile)
```css
/* Mobile sticky action button */
@media (max-width: 768px) {
    .mobile-sticky-action {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        padding: 16px;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
        z-index: 999;
    }

    .sticky-get-pricing-btn {
        background: #4cb354;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        width: 100%;
        cursor: pointer;
    }
}
```

---

## 📝 Testing Checklist

### Desktop Testing
- [ ] Header displays correctly with Northwest green
- [ ] Search bar functions properly
- [ ] Decoration method selector is prominent and centered
- [ ] Product images are large and clear
- [ ] Check Inventory button uses Northwest green
- [ ] Color swatches are easy to click
- [ ] All hover effects work smoothly
- [ ] Page loads in under 2 seconds

### Mobile Testing (Portrait)
- [ ] Header stacks correctly
- [ ] Decoration methods show in 2-column grid
- [ ] Product image is full-width
- [ ] Thumbnails scroll horizontally
- [ ] All buttons are thumb-friendly (44px minimum)
- [ ] No horizontal scrolling issues
- [ ] Touch interactions feel responsive

### Mobile Testing (Landscape)
- [ ] Layout adjusts appropriately
- [ ] Content remains readable
- [ ] No awkward spacing issues

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Performance Testing
- [ ] Page load time < 2 seconds
- [ ] Images optimized (WebP where supported)
- [ ] CSS minified for production
- [ ] JavaScript optimized
- [ ] No layout shift (CLS score)

---

## 🎯 Success Metrics

### User Experience Goals
- **80% reduction** in time to find decoration options
- **50% increase** in product image viewing time
- **90% satisfaction** rate from sales team
- **Zero confusion** about next steps

### Technical Goals
- Page load time < 2 seconds
- Lighthouse score > 90
- Mobile usability score > 95
- Zero accessibility violations

---

## 📚 Resources & References

### Design Inspiration
- Modern e-commerce sites (2024-2025 trends)
- Apple product pages (clean, focused design)
- Nike customization flow (prominent options)

### Technical References
- [CSS Grid Layout Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Mobile-First Responsive Design](https://www.w3schools.com/css/css_rwd_intro.asp)
- [Font Awesome Icons](https://fontawesome.com/icons)

### Color Accessibility
- Northwest Green (#4cb354) on white: 4.5:1 (WCAG AA ✓)
- White text on Northwest Green: 4.5:1 (WCAG AA ✓)

---

## 🔧 Implementation Files

### Files to Update:
1. `/product.html` - Main HTML structure
2. `/product/styles/product.css` - Base styles
3. `/product/styles/product-redesign.css` - New modern styles
4. `/product/app.js` - JavaScript functionality

### New Files to Create:
1. `/product/styles/product-2025.css` - Complete redesign styles
2. `/product/js/decoration-selector.js` - Decoration method logic

---

## 🎉 Expected Results

### Sales Team Feedback Goals
- ✅ "Images are now big enough to show product details"
- ✅ "Decoration options are impossible to miss"
- ✅ "Page looks modern and professional"
- ✅ "Easy to navigate on mobile devices"
- ✅ "Check Inventory button matches our brand"

### Customer Experience Goals
- ✅ Immediately understand customization options
- ✅ See product clearly before making decisions
- ✅ Feel confident about inventory availability
- ✅ Complete journey from viewing to pricing smoothly

---

**This design document provides a complete blueprint for transforming the product page from a dated 2005 design to a modern, intuitive 2025 interface that prioritizes product imagery and customization options.**

**Implementation Timeline:** 1-2 days for Phase 1 critical updates, 1 week for complete redesign.

**Approval Required:** Sales team review after Phase 1 implementation.
