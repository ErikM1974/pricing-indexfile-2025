# 📘 NWCA Quote Builder Development Guide

**Last Updated:** 2025-01-27
**Purpose:** Complete implementation guide for creating new quote builders
**Time to Implement:** 2-3 hours following this guide

## 🏗️ Architecture Overview

All NWCA Quote Builders follow a sophisticated 3-phase architecture with 18+ shared components:

```
Quote Builder System Architecture
├── HTML Page (User Interface)
│   ├── Phase 1: Configuration/Setup
│   ├── Phase 2: Add Products/Items
│   └── Phase 3: Review & Save
├── Shared Infrastructure (11 core files)
│   ├── Base Classes (auto-save, error handling)
│   ├── Persistence Layer (localStorage, cross-tab sync)
│   └── Advanced Features (validation, UI feedback)
├── Service Layer ([Type]QuoteService.js)
│   ├── Business Logic
│   ├── Pricing Calculations
│   └── API Integration
└── External Services
    ├── Caspio API (via Heroku proxy)
    └── EmailJS (quote delivery)
```

### Data Flow
```
User Input → Validation → Service Layer → API Call → Database
     ↓           ↓            ↓            ↓           ↓
  UI Update  LocalStorage  Calculate   Heroku Proxy  Caspio
     ↓           ↓            ↓            ↓           ↓
  Feedback ← Auto-Save ← Price/Total ← Response ← Quote Saved
```

## ✅ Required Files Checklist

**CRITICAL:** Files must be loaded in EXACT order or system will break!

### HTML Head Section (Copy This Exactly)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[TYPE] Quote Builder | Northwest Custom Apparel</title>

    <!-- NWCA Favicon -->
    <link rel="icon" type="image/png" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1">

    <!-- Font Awesome (MUST be before other CSS) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">

    <!-- Font Awesome Fix (Required for icons to work) -->
    <style>
    .fas, .far, .fab, .fa {
        font-family: "Font Awesome 6 Free", "Font Awesome 5 Free", FontAwesome !important;
        font-weight: 900 !important;
    }
    </style>

    <!-- Bootstrap CSS (Foundation layer) -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- EmailJS SDK -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Universal Styles (Layer 2) -->
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">

    <!-- Base Quote Builder Styles (Layer 3) -->
    <link rel="stylesheet" href="/shared_components/css/embroidery-quote-builder.css">

    <!-- Unified Step Styles (Layer 4) -->
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1.css">
    <link rel="stylesheet" href="/shared_components/css/quote-builder-unified-step1-v2.css">

    <!-- [TYPE] Specific Styles (Layer 5 - Highest Priority) -->
    <link rel="stylesheet" href="/shared_components/css/[type]-quote-builder.css?v=20250911">

    <!-- Phase 1: Infrastructure -->
    <link rel="stylesheet" href="/shared_components/css/quote-builder-common.css?v=20250911">
    <link rel="stylesheet" href="/shared_components/css/quote-print.css?v=20250911">
    <script src="/shared_components/js/quote-builder-base.js?v=20250911"></script>
    <script src="/shared_components/js/quote-formatter.js?v=20250911"></script>

    <!-- Phase 2: Persistence -->
    <script src="/shared_components/js/quote-persistence.js?v=20250911"></script>
    <script src="/shared_components/js/quote-session.js?v=20250911"></script>

    <!-- Phase 3: Advanced Features -->
    <link rel="stylesheet" href="/shared_components/css/quote-builder-phase3.css?v=20250911">
    <script src="/shared_components/js/quote-validation.js?v=20250911"></script>
    <script src="/shared_components/js/quote-ui-feedback.js?v=20250911"></script>
</head>
```

## 🎯 Implementation Steps

### Phase 1: Configuration Setup

**Purpose:** Let user select options that affect pricing (location, type, etc.)

```html
<section id="location-phase" class="phase-section active">
    <div class="phase-header">
        <h2><span class="phase-number">1</span> Configuration Setup</h2>
        <p>Choose your options</p>
    </div>

    <div class="content-container">
        <!-- Your configuration options here -->
        <div class="location-selector">
            <label class="location-option">
                <input type="radio" name="config-option" value="OPTION1">
                <div class="location-card">
                    <i class="fas fa-icon"></i>
                    <span class="location-name">Option 1</span>
                </div>
            </label>
        </div>

        <button id="continue-to-products" class="btn btn-primary">
            Continue to Products
        </button>
    </div>
</section>
```

### Phase 2: Add Products

**Purpose:** Let user add multiple products with quantities

```html
<section id="product-phase" class="phase-section">
    <div class="phase-header">
        <h2><span class="phase-number">2</span> Add Products</h2>
    </div>

    <!-- Product Search -->
    <div class="product-selector">
        <input type="text" id="style-search" placeholder="Search styles...">
        <select id="color-select">
            <option value="">Select Color</option>
        </select>
        <button id="load-product-btn">Load Product</button>
    </div>

    <!-- Size Inputs -->
    <div id="size-inputs" class="size-grid">
        <!-- Generated dynamically -->
    </div>

    <!-- Added Products List -->
    <div id="products-container" class="products-list">
        <!-- Products appear here -->
    </div>

    <button id="continue-to-review">Continue to Review</button>
</section>
```

### Phase 3: Review & Save

**Purpose:** Collect customer info, show summary, save quote

```html
<section id="review-phase" class="phase-section">
    <div class="phase-header">
        <h2><span class="phase-number">3</span> Review & Save Quote</h2>
    </div>

    <!-- Customer Information -->
    <div class="customer-info-section">
        <input type="text" id="customer-name" placeholder="Customer Name" required>
        <input type="email" id="customer-email" placeholder="Email" required>
        <input type="text" id="company-name" placeholder="Company">
        <input type="tel" id="customer-phone" placeholder="Phone">
        <select id="sales-rep" required>
            <option value="">Select Sales Rep</option>
            <!-- Load from STAFF_DIRECTORY.md -->
        </select>
    </div>

    <!-- Quote Summary -->
    <div class="quote-summary">
        <div id="quote-items-summary"></div>
        <div class="summary-total">
            Total: $<span id="summary-total">0.00</span>
        </div>
    </div>

    <button id="save-quote-btn" class="btn btn-success">
        Save & Send Quote
    </button>
</section>
```

## 💻 Service Class Template

Create `/shared_components/js/[type]-quote-service.js`:

```javascript
class [TYPE]QuoteService {
    constructor() {
        // Configuration
        this.quotePrefix = '[PREFIX]'; // e.g., 'VNL' for vinyl
        this.emailTemplateId = 'template_[xxxxx]'; // Get from EmailJS
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

        // State
        this.products = [];
        this.configuration = {};

        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
    }

    /**
     * Generate unique quote ID
     */
    generateQuoteID() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sequence = Math.floor(Math.random() * 100);
        return `${this.quotePrefix}${month}${day}-${sequence}`;
    }

    /**
     * Calculate pricing based on quantity tiers
     */
    calculatePricing(quantity) {
        // Define your tiers
        const tiers = [
            { min: 1, max: 11, price: 15.00 },
            { min: 12, max: 23, price: 12.00 },
            { min: 24, max: 47, price: 10.00 },
            { min: 48, max: 71, price: 9.00 },
            { min: 72, max: Infinity, price: 8.00 }
        ];

        const tier = tiers.find(t => quantity >= t.min && quantity <= t.max);
        const subtotal = quantity * tier.price;

        // Check for LTM (Less Than Minimum) fee
        let ltmFee = 0;
        if (quantity < 12) {
            ltmFee = 50.00;
        }

        return {
            unitPrice: tier.price,
            subtotal: subtotal,
            ltmFee: ltmFee,
            total: subtotal + ltmFee
        };
    }

    /**
     * Save quote to database
     */
    async saveQuote(quoteData) {
        const quoteID = this.generateQuoteID();

        try {
            // Save quote session
            const sessionData = {
                quote_id: quoteID,
                customer_name: quoteData.customerName,
                customer_email: quoteData.customerEmail,
                company_name: quoteData.companyName || '',
                customer_phone: quoteData.customerPhone || '',
                sales_rep: quoteData.salesRep,
                total_amount: quoteData.total,
                quote_type: '[TYPE]',
                status: 'Active',
                created_date: new Date().toISOString()
            };

            const sessionResponse = await fetch(`${this.apiBase}/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to save quote session');
            }

            // Save quote items
            for (const product of this.products) {
                const itemData = {
                    quote_id: quoteID,
                    product_name: product.name,
                    style_number: product.style,
                    color: product.color,
                    quantity: product.quantity,
                    unit_price: product.unitPrice,
                    total_price: product.total
                };

                await fetch(`${this.apiBase}/quote_items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            }

            // Send email
            await this.sendQuoteEmail(quoteID, quoteData);

            return { success: true, quoteID };

        } catch (error) {
            console.error('Save quote error:', error);
            // Still try to send email even if database fails
            await this.sendQuoteEmail(quoteID, quoteData);
            return { success: true, quoteID, warning: 'Saved locally only' };
        }
    }

    /**
     * Send quote via EmailJS
     */
    async sendQuoteEmail(quoteID, quoteData) {
        const emailData = {
            // CRITICAL: All variables must have defaults to prevent corruption
            quote_id: quoteID || '',
            customer_name: quoteData.customerName || '',
            customer_email: quoteData.customerEmail || '',
            company_name: quoteData.companyName || '',
            customer_phone: quoteData.customerPhone || '',
            sales_rep: quoteData.salesRep || '',

            // Products table (HTML)
            products_table: this.generateProductsTableHTML(),

            // Totals
            subtotal: quoteData.subtotal || '0.00',
            ltm_fee: quoteData.ltmFee || '0.00',
            total_amount: quoteData.total || '0.00',

            // Company info (always the same)
            company_phone: '253-922-5793',
            company_email: 'sales@nwcustomapparel.com',
            quote_date: new Date().toLocaleDateString(),
            expiry_date: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()
        };

        try {
            await emailjs.send(
                'service_1c4k67j',
                this.emailTemplateId,
                emailData
            );
            return true;
        } catch (error) {
            console.error('Email error:', error);
            // Don't throw - quote is still saved
            return false;
        }
    }

    /**
     * Generate HTML table for email
     */
    generateProductsTableHTML() {
        let html = '<table border="1" cellpadding="5">';
        html += '<tr><th>Product</th><th>Color</th><th>Qty</th><th>Price</th></tr>';

        this.products.forEach(product => {
            html += `<tr>
                <td>${product.name}</td>
                <td>${product.color}</td>
                <td>${product.quantity}</td>
                <td>$${product.total.toFixed(2)}</td>
            </tr>`;
        });

        html += '</table>';
        return html;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.[type]QuoteService = new [TYPE]QuoteService();
});
```

## 📊 Database Schema

### quote_sessions Table
```sql
quote_id        VARCHAR(50) PRIMARY KEY  -- e.g., "VNL0127-42"
customer_name   VARCHAR(100) NOT NULL
customer_email  VARCHAR(100) NOT NULL
company_name    VARCHAR(100)
customer_phone  VARCHAR(20)
sales_rep       VARCHAR(100) NOT NULL
total_amount    DECIMAL(10,2)
quote_type      VARCHAR(20)             -- e.g., "VINYL"
status          VARCHAR(20)             -- "Active", "Converted", "Expired"
created_date    DATETIME
notes           TEXT
```

### quote_items Table
```sql
item_id         INT AUTO_INCREMENT PRIMARY KEY
quote_id        VARCHAR(50) FOREIGN KEY
product_name    VARCHAR(200)
style_number    VARCHAR(50)
color           VARCHAR(50)
size            VARCHAR(10)             -- Optional for sized products
quantity        INT
unit_price      DECIMAL(10,2)
total_price     DECIMAL(10,2)
location        VARCHAR(50)             -- Print location if applicable
```

## 📧 EmailJS Template Requirements

### Required Variables (Must Match Exactly!)

Your EmailJS template MUST have these variables:

```
{{quote_id}}           - Quote ID (e.g., VNL0127-42)
{{customer_name}}      - Customer's full name
{{customer_email}}     - Customer's email
{{company_name}}       - Customer's company
{{customer_phone}}     - Customer's phone
{{sales_rep}}          - Sales representative name

{{products_table}}     - HTML table of products
{{subtotal}}           - Subtotal before fees
{{ltm_fee}}           - Less than minimum fee
{{total_amount}}      - Final total

{{company_phone}}      - Always "253-922-5793"
{{company_email}}      - Always "sales@nwcustomapparel.com"
{{quote_date}}        - Today's date
{{expiry_date}}       - 30 days from today
```

### EmailJS Template Example
```html
<h2>Quote #{{quote_id}}</h2>

<p>Dear {{customer_name}},</p>

<p>Thank you for your interest in {{company_name}}. Here is your quote:</p>

{{{products_table}}}

<p>
Subtotal: ${{subtotal}}<br>
{{#if ltm_fee}}LTM Fee: ${{ltm_fee}}<br>{{/if}}
<strong>Total: ${{total_amount}}</strong>
</p>

<p>Quote valid until: {{expiry_date}}</p>

<p>Questions? Contact {{sales_rep}} at {{company_phone}}</p>
```

## 🎯 Business Logic Patterns

### Tier Pricing Calculation
```javascript
// Standard tier structure (adjust for your product)
const PRICE_TIERS = [
    { min: 1, max: 11, price: 15.00, name: "Tier 1" },
    { min: 12, max: 23, price: 12.00, name: "Tier 2" },
    { min: 24, max: 47, price: 10.00, name: "Tier 3" },
    { min: 48, max: 71, price: 9.00, name: "Tier 4" },
    { min: 72, max: Infinity, price: 8.00, name: "Tier 5" }
];

function getCurrentTier(quantity) {
    return PRICE_TIERS.find(tier =>
        quantity >= tier.min && quantity <= tier.max
    );
}
```

### Less Than Minimum (LTM) Fee
```javascript
function calculateLTMFee(quantity, minimumQuantity = 12) {
    if (quantity < minimumQuantity) {
        return 50.00; // Standard LTM fee
    }
    return 0;
}

// Show warning to user
if (ltmFee > 0) {
    showWarning(`Add ${minimumQuantity - quantity} more items to eliminate the $50 LTM fee`);
}
```

### Auto-Save Implementation
```javascript
// Built into QuoteBuilderBase - just enable it
const persistence = new QuotePersistence({
    prefix: 'VNL',
    autoSave: true,
    autoSaveInterval: 30000 // 30 seconds
});

// Mark as dirty when user changes anything
document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', () => {
        persistence.isDirty = true;
    });
});
```

### Cross-Tab Synchronization
```javascript
// Listen for updates from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'VNL_draft') {
        const updated = JSON.parse(e.newValue);
        // Update UI with new data
        loadQuoteData(updated);
        showToast('Quote updated from another tab');
    }
});
```

## 🧪 Testing Checklist

### Console Commands for Verification
```javascript
// 1. Check if all components loaded
console.log('Base loaded:', typeof QuoteBuilderBase !== 'undefined');
console.log('Persistence loaded:', typeof QuotePersistence !== 'undefined');
console.log('Validation loaded:', typeof QuoteValidation !== 'undefined');

// 2. Test quote ID generation
const service = new VinylQuoteService();
console.log('Quote ID:', service.generateQuoteID());

// 3. Check localStorage for drafts
console.log('Saved draft:', localStorage.getItem('VNL_draft'));

// 4. Test pricing calculation
console.log('Price for 15 items:', service.calculatePricing(15));

// 5. Verify EmailJS initialization
console.log('EmailJS ready:', typeof emailjs !== 'undefined');
```

### Manual Testing Steps
1. **Phase 1 Testing**
   - [ ] Configuration options work
   - [ ] Continue button enables after selection
   - [ ] Selection displays in Phase 2

2. **Phase 2 Testing**
   - [ ] Product search works
   - [ ] Products add to list
   - [ ] Quantities update totals
   - [ ] Tier pricing displays correctly
   - [ ] LTM warning shows when < minimum

3. **Phase 3 Testing**
   - [ ] Customer info validates
   - [ ] Phone formats automatically
   - [ ] Summary shows all products
   - [ ] Save button works
   - [ ] Success modal shows quote ID

4. **Advanced Testing**
   - [ ] Auto-save every 30 seconds (check localStorage)
   - [ ] Restore draft on page reload
   - [ ] Cross-tab sync (open 2 tabs)
   - [ ] Error recovery (disconnect internet, try save)

## 🚀 Complete Example: Creating a Vinyl Quote Builder

### Step 1: Create HTML File
Create `/quote-builders/vinyl-quote-builder.html` using the template above.

### Step 2: Create Service File
Create `/shared_components/js/vinyl-quote-service.js`:
```javascript
class VinylQuoteService {
    constructor() {
        this.quotePrefix = 'VNL';
        this.emailTemplateId = 'template_vinyl_quote';
        // ... rest of template
    }
}
```

### Step 3: Create CSS File
Create `/shared_components/css/vinyl-quote-builder.css`:
```css
/* Vinyl-specific styling */
.vinyl-quote-builder {
    --primary-color: #FF6B35;
    --secondary-color: #004E89;
}

.vinyl-option-card {
    border: 2px solid var(--primary-color);
    transition: all 0.3s;
}

.vinyl-option-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}
```

### Step 4: Update server.js
Add route for new page:
```javascript
app.get('/vinyl-quote-builder.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'quote-builders', 'vinyl-quote-builder.html'));
});
```

### Step 5: Create EmailJS Template
1. Go to EmailJS dashboard
2. Create new template
3. Add all required variables
4. Get template ID
5. Update service file

### Step 6: Update Documentation
1. Add to ACTIVE_FILES.md
2. Add to navigation menus
3. Update quote prefix list

### Step 7: Test Everything
Run through the complete testing checklist above.

## 🚨 Common Pitfalls & Solutions

### Problem: Icons not showing
**Solution:** Font Awesome CSS must load BEFORE all other CSS

### Problem: Auto-save not working
**Solution:** Check if QuoteBuilderBase is initialized:
```javascript
window.addEventListener('load', () => {
    if (typeof QuoteBuilderBase === 'undefined') {
        alert('Critical files failed to load. Clear cache and refresh.');
    }
});
```

### Problem: EmailJS "corrupted variables"
**Solution:** EVERY variable must have a default:
```javascript
customer_name: data.customerName || '',  // Never undefined
```

### Problem: Phases not transitioning
**Solution:** Check phase navigation classes:
```javascript
document.querySelector('.phase-section.active').classList.remove('active');
document.getElementById('product-phase').classList.add('active');
```

### Problem: Database not saving
**Solution:** Check API endpoint and field names match exactly:
```javascript
// Field names must match database columns EXACTLY
quote_id: quoteID,      // Not quoteId or quote_ID
customer_name: name,    // Not customerName
```

## 🔴 CRITICAL: Quote Item Save Pattern

**LESSON LEARNED 2026-01-14:** Quote items ACCUMULATE if you don't delete existing items first! This caused 470+ phantom items and completely wrong pricing.

### The Problem
When a quote is re-saved with the same QuoteID, new items are ADDED to existing items instead of REPLACING them.

### The Solution: Delete Before Insert

Every quote service MUST delete existing items before inserting new ones:

```javascript
/**
 * Delete all existing items for a quote ID before saving new ones
 */
async deleteExistingItems(quoteID) {
    try {
        const response = await fetch(
            `${this.apiBase}/quote_items?QuoteID=${encodeURIComponent(quoteID)}`
        );
        if (!response.ok) return;

        const items = await response.json();
        if (!items?.length) return;

        console.log(`Deleting ${items.length} existing items for ${quoteID}`);

        // Delete in parallel batches for performance (10 at a time)
        const batchSize = 10;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.all(
                batch.filter(item => item.PK_ID)
                    .map(item => fetch(`${this.apiBase}/quote_items/${item.PK_ID}`, { method: 'DELETE' })
                        .catch(err => console.warn(`Failed to delete ${item.PK_ID}:`, err)))
            );
        }
    } catch (error) {
        console.warn('Error deleting existing items:', error);
    }
}

async saveQuote(quoteData) {
    const quoteID = this.generateQuoteID();

    // Save session first
    await this.saveSession(quoteID, quoteData);

    // ⚠️ CRITICAL: Delete existing items BEFORE inserting new ones
    await this.deleteExistingItems(quoteID);

    // Now save new items
    for (const item of this.products) {
        await this.saveItem(quoteID, item);
    }
}
```

### TotalAmount Must Include ALL Fees

```javascript
TotalAmount: parseFloat((
    pricingResults.grandTotal +
    (customerData.artCharge || 0) +         // GRT-50
    (customerData.graphicDesignCharge || 0) + // GRT-75
    (customerData.rushFee || 0) +
    (customerData.sampleFee || 0) -
    (customerData.discount || 0)
).toFixed(2)),
```

### Fee Line Items Use ShopWorks SKUs

| Fee Type | Garment | Cap | Description |
|----------|---------|-----|-------------|
| Additional Stitches | AS-GARM | AS-CAP | Over 8K base |
| Additional Logo | AL-GARM | CB | Second+ logo |
| Digitizing | DD | DD-CAP | Setup fee |
| Less Than Minimum | LTM | LTM-CAP | Under 24 pcs |
| Logo Mockup | GRT-50 | GRT-50 | Art review $50 |
| Graphic Design | GRT-75 | GRT-75 | Design $75/hr |

**NEVER embed extra charges in unit price** - always show as separate line items!

## 📝 Quote ID Prefixes Registry

| Prefix | Type | Status |
|--------|------|--------|
| DTG | Direct-to-Garment | ✅ Active |
| EMB | Embroidery Contract | ✅ Active |
| EMBC | Customer Embroidery | ✅ Active |
| CAP | Cap Embroidery | ✅ Active |
| RICH | Richardson Caps | ✅ Active |
| SPC | Screen Print | ✅ Active |
| LT | Laser Tumblers | ✅ Active |
| VNL | Vinyl (Example) | 📝 Template |

## 📱 Mobile Responsiveness Requirements

**CRITICAL:** All quote builders MUST include these CSS breakpoints. This was discovered when 3 of 4 builders had ZERO mobile responsiveness (see LESSONS_LEARNED.md 2026-01-13).

### Required Breakpoints
```css
/* Tablet landscape - Stack sidebar below content */
@media (max-width: 1024px) {
    .power-main { flex-direction: column; height: auto; }
    .power-sidebar { width: 100%; position: static; border-left: none; }
}

/* Tablet portrait - Compact tables and inputs */
@media (max-width: 768px) {
    .product-table { display: block; overflow-x: auto; }
    .size-input { width: 40px; padding: 4px 2px; }
    .config-section { padding: 12px; }
}

/* Phone - Single column layout */
@media (max-width: 480px) {
    .sidebar-actions { flex-direction: column; gap: 8px; }
    .quote-header-content { flex-direction: column; }
    /* Minimum touch target: 44x44px */
}

/* Print optimization */
@media print {
    .power-sidebar { display: none; }
    .product-table { font-size: 10px; }
}
```

### Mobile Testing Required Before Release
Test at these viewport widths:
- **375px** (iPhone SE) - Smallest common phone
- **768px** (iPad portrait) - Tablet portrait
- **1024px** (iPad landscape) - Tablet landscape

Verify:
- [ ] Tables scroll horizontally (not overflow viewport)
- [ ] Touch targets ≥ 44x44px
- [ ] Sidebar stacks below content on narrow screens
- [ ] Print preview shows clean layout without sidebar

---

## 🎯 Final Checklist

Before going live with your new quote builder:

- [ ] All 18 shared files included in correct order
- [ ] Service class created with quote prefix
- [ ] EmailJS template created and tested
- [ ] Database endpoints verified
- [ ] Auto-save working (check localStorage)
- [ ] Tier pricing calculating correctly
- [ ] LTM fees applying when needed
- [ ] Phone number formatting working
- [ ] Email validation working
- [ ] Success modal shows quote ID
- [ ] Error handling shows user-friendly messages
- [ ] Added to ACTIVE_FILES.md
- [ ] Added to server.js routing
- [ ] **Mobile breakpoints included (1024px, 768px, 480px, print)**
- [ ] **Mobile tested (375px, 768px, 1024px widths)**
- [ ] Tested cross-browser (Chrome, Firefox, Safari)

---

**Remember:** The quote builder system is complex but follows consistent patterns. When in doubt, copy from an existing working quote builder (DTG or Embroidery) and modify for your specific needs.