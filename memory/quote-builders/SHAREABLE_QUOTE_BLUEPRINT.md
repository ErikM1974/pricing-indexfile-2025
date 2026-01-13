# Shareable Quote URL - Implementation Blueprint

A comprehensive guide for adding shareable customer quote URLs to any quote builder. Based on the DTF Quote Builder implementation (January 2026).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Checklist](#component-checklist)
3. [Database Schema](#database-schema)
4. [Quote ID Format](#quote-id-format)
5. [Code Templates](#code-templates)
6. [Implementation Steps](#implementation-steps)
7. [Gotchas & Warnings](#gotchas--warnings)
8. [Reference Files](#reference-files)
9. [Testing Checklist](#testing-checklist)

---

## Architecture Overview

### Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Quote Builder  │────▶│  Quote Service  │────▶│   Caspio API    │
│    (HTML/JS)    │     │      (.js)      │     │  (Database)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Success Modal  │────▶│   Public URL    │────▶│   Quote View    │
│ (Copyable Link) │     │ /quote/:quoteId │     │   (Customer)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Components

1. **Quote Builder** - User interface for creating quotes
2. **Quote Service** - JavaScript class handling API calls to save quotes
3. **Database Tables** - `quote_sessions` (header) + `quote_items` (line items)
4. **Server Routes** - Express routes serving public quote page and API
5. **Quote View Page** - Customer-facing read-only quote display

---

## Component Checklist

For each new quote builder implementation:

### Required Files

- [ ] **Quote Service Class** - `/shared_components/js/[type]-quote-service.js`
- [ ] **Save & Share UI Panel** - Added to builder HTML
- [ ] **Success Modal** - Added to builder HTML
- [ ] **CSS Styles** - Save panel and modal styling
- [ ] **saveAndGetLink() Method** - Added to builder JS class

### Already Shared (No Changes Needed)

- [x] **Server Routes** - `/server.js` already handles all prefixes via regex
- [x] **Quote View Page** - `/pages/quote-view.html` works for all embellishment types
- [x] **Quote View JS** - `/pages/js/quote-view.js` reads from database
- [x] **Quote View CSS** - `/pages/css/quote-view.css`
- [x] **Public API Routes** - `GET /api/public/quote/:quoteId`

---

## Database Schema

### quote_sessions (Header)

| Field | Type | Description |
|-------|------|-------------|
| QuoteID | String | Primary key (e.g., "DTF0113-1234") |
| SessionID | String | Browser session identifier |
| CustomerName | String | Required |
| CustomerEmail | String | Required |
| CompanyName | String | Optional |
| EmbellishmentType | String | "dtf", "dtg", "screenprint", "embroidery", "cap" |
| Locations | String | Print locations (e.g., "LC,FB") |
| LocationNames | String | Human-readable locations |
| TotalQuantity | Integer | Sum of all item quantities |
| Subtotal | Decimal | Before LTM fee |
| LTMFee | Decimal | Less-than-minimum fee (if applicable) |
| TaxRate | Decimal | e.g., 0.101 for 10.1% |
| TaxAmount | Decimal | Calculated tax |
| Total | Decimal | Grand total |
| PricingMetadata | JSON | Tier, margin, labor costs, etc. |
| Status | String | "draft", "sent", "accepted", "expired" |
| ExpiresAt | DateTime | 30 days from creation |
| CreatedAt | DateTime | Auto-set |

### quote_items (Line Items)

| Field | Type | Description |
|-------|------|-------------|
| QuoteID | String | Foreign key to quote_sessions |
| LineNumber | Integer | 1, 2, 3... |
| StyleNumber | String | e.g., "PC54" |
| ProductName | String | e.g., "Port & Company Core Cotton Tee - Forest Green" |
| Color | String | Display color name |
| ColorCode | String | CATALOG_COLOR for API/inventory |
| ImageURL | String | SanMar product image URL |
| EmbellishmentType | String | Same as session |
| PrintLocation | String | Location codes for this item |
| PrintLocationName | String | Human-readable locations |
| Quantity | Integer | Total pieces for this line |
| HasLTM | String | "Yes" or "No" |
| BaseUnitPrice | Decimal | Base cost before margin |
| LTMPerUnit | Decimal | LTM fee portion per unit |
| FinalUnitPrice | Decimal | **CRITICAL: Customer-facing price** |
| LineTotal | Decimal | Quantity × FinalUnitPrice |
| SizeBreakdown | JSON | {"S": 5, "M": 10, "L": 8, ...} |
| PricingTier | String | e.g., "Tier 3 (48-71)" |
| AddedAt | DateTime | Auto-set |

---

## Quote ID Format

### Pattern: `[PREFIX][MMDD]-[sequence]`

| Builder | Prefix | Example |
|---------|--------|---------|
| DTF (Transfers) | DTF | DTF0113-1234 |
| DTG (Direct to Garment) | DTG | DTG0113-5678 |
| Screen Print | SCP | SCP0113-9012 |
| Embroidery | EMB | EMB0113-3456 |
| Cap Embroidery | CAP | CAP0113-7890 |

### Generation Code

```javascript
generateQuoteID() {
    const now = new Date();
    const dateStr = String(now.getMonth() + 1).padStart(2, '0') +
                   String(now.getDate()).padStart(2, '0');
    const seq = Math.floor(Math.random() * 9000) + 1000;
    return `${this.quotePrefix}${dateStr}-${seq}`;
}
```

**Why this format?**
- Easy to read over phone (sales reps reference quotes verbally)
- Date-embedded helps with expiry tracking
- Prefix identifies embellishment type instantly
- Sequence prevents collisions on same day

---

## Code Templates

### 5.1 Quote Service Class

```javascript
/**
 * [Type] Quote Service
 * Handles saving and loading quotes to/from Caspio database
 */
class [Type]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.quotePrefix = '[PREFIX]';  // DTG, SCP, EMB, CAP
    }

    generateQuoteID() {
        const now = new Date();
        const dateStr = String(now.getMonth() + 1).padStart(2, '0') +
                       String(now.getDate()).padStart(2, '0');
        const seq = Math.floor(Math.random() * 9000) + 1000;
        return `${this.quotePrefix}${dateStr}-${seq}`;
    }

    generateSessionID() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    formatDateForCaspio(date) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    async saveQuote(quoteData) {
        try {
            const quoteID = quoteData.quoteId || this.generateQuoteID();
            const sessionID = this.generateSessionID();

            // Calculate expiry (30 days)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            // 1. Save session (header)
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerName: quoteData.customerName,
                CustomerEmail: quoteData.customerEmail,
                CompanyName: quoteData.companyName || '',
                EmbellishmentType: '[type]',
                // ... other fields
                Status: 'sent',
                ExpiresAt: this.formatDateForCaspio(expiresAt),
                CreatedAt: this.formatDateForCaspio(new Date())
            };

            await fetch(`${this.baseURL}/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });

            // 2. Save each line item
            let lineNumber = 1;
            for (const product of quoteData.products) {
                if (product.sizeGroups && Array.isArray(product.sizeGroups)) {
                    for (const sizeGroup of product.sizeGroups) {
                        // CRITICAL: Use sizeGroup color if available
                        const itemColor = sizeGroup.color || product.color;
                        const itemImageUrl = sizeGroup.imageUrl || product.imageUrl || '';

                        const itemData = {
                            QuoteID: quoteID,
                            LineNumber: lineNumber++,
                            StyleNumber: product.styleNumber,
                            ProductName: `${product.productName} - ${itemColor}`,
                            Color: itemColor,
                            ImageURL: itemImageUrl,
                            Quantity: parseInt(sizeGroup.quantity),
                            FinalUnitPrice: parseFloat(sizeGroup.unitPrice.toFixed(2)),
                            LineTotal: parseFloat(sizeGroup.total.toFixed(2)),
                            SizeBreakdown: JSON.stringify(sizeGroup.sizes),
                            // ... other fields
                        };

                        await fetch(`${this.baseURL}/quote_items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(itemData)
                        });
                    }
                }
            }

            return { success: true, quoteId: quoteID };
        } catch (error) {
            console.error('[QuoteService] Save error:', error);
            return { success: false, error: error.message };
        }
    }
}
```

### 5.2 Save & Share Panel HTML

```html
<!-- Save & Share Section -->
<div class="save-quote-panel">
    <div class="save-quote-title">
        <i class="fas fa-share-alt"></i> Save & Share
    </div>
    <div class="save-quote-form">
        <input type="text" id="customer-name" class="quote-input" placeholder="Customer Name *">
        <input type="email" id="customer-email" class="quote-input" placeholder="Email *">
        <input type="text" id="company-name" class="quote-input" placeholder="Company (optional)">
    </div>
    <button class="btn-save-quote" onclick="[builderInstance].saveAndGetLink()">
        <i class="fas fa-link"></i> Save & Get Shareable Link
    </button>
</div>

<!-- Save Success Modal -->
<div id="save-success-modal" class="save-modal-overlay" style="display: none;">
    <div class="save-modal-content">
        <div class="save-modal-header">
            <i class="fas fa-check-circle"></i>
            <h3>Quote Saved!</h3>
        </div>
        <div class="save-modal-body">
            <p>Quote ID: <strong id="saved-quote-id">---</strong></p>
            <p>Share this link with your customer:</p>
            <div class="url-copy-container">
                <input type="text" id="shareable-url" class="shareable-url-input" readonly>
                <button class="btn-copy-url" onclick="copyShareableUrl()">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
        </div>
        <div class="save-modal-footer">
            <button class="btn-view-quote" onclick="window.open(document.getElementById('shareable-url').value, '_blank')">
                <i class="fas fa-external-link-alt"></i> View Quote
            </button>
            <button class="btn-close-modal" onclick="closeSaveModal()">
                Close
            </button>
        </div>
    </div>
</div>

<script>
function showSaveModal(quoteId) {
    const url = `${window.location.origin}/quote/${quoteId}`;
    document.getElementById('saved-quote-id').textContent = quoteId;
    document.getElementById('shareable-url').value = url;
    document.getElementById('save-success-modal').style.display = 'flex';
}

function closeSaveModal() {
    document.getElementById('save-success-modal').style.display = 'none';
}

function copyShareableUrl() {
    const urlInput = document.getElementById('shareable-url');
    urlInput.select();
    document.execCommand('copy');

    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.style.background = '#28a745';
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
    }, 2000);
}

document.getElementById('save-success-modal').addEventListener('click', function(e) {
    if (e.target === this) closeSaveModal();
});
</script>
```

### 5.3 saveAndGetLink() Method Pattern

```javascript
async saveAndGetLink() {
    // 1. VALIDATE customer info
    const customerName = document.getElementById('customer-name')?.value?.trim() || '';
    const customerEmail = document.getElementById('customer-email')?.value?.trim() || '';

    if (!customerName) {
        alert('Please enter customer name');
        document.getElementById('customer-name')?.focus();
        return;
    }

    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        alert('Please enter a valid email address');
        document.getElementById('customer-email')?.focus();
        return;
    }

    // 2. VALIDATE products exist
    if (!this.products || this.products.length === 0) {
        alert('Please add at least one product to the quote');
        return;
    }

    // 3. COLLECT product data
    const products = this.products.map(p => {
        const parentRow = document.getElementById(`row-${p.id}`);
        const sizeGroups = [];

        // CRITICAL: Read color from row.dataset, not product object
        const color = parentRow?.dataset?.color || p.color || '';
        const catalogColor = parentRow?.dataset?.catalogColor || p.catalogColor || '';
        const imageUrl = parentRow?.dataset?.swatchUrl || p.imageUrl || '';

        // Standard sizes group
        // ... collect quantities, get unit price from DOM ...

        if (standardQty > 0) {
            sizeGroups.push({
                sizes: standardSizes,
                quantity: standardQty,
                unitPrice: unitPrice,
                total: standardQty * unitPrice,
                color: color,           // CRITICAL: Include color in sizeGroup
                catalogColor: catalogColor,
                imageUrl: imageUrl
            });
        }

        // Extended sizes - each as separate group
        extendedSizes.forEach(size => {
            if (qty > 0) {
                const childRow = document.getElementById(`row-${childRowId}`);

                // CRITICAL: Read color from CHILD row (may differ from parent)
                const childColor = childRow?.dataset?.color || color;
                const childImageUrl = childRow?.dataset?.swatchUrl || imageUrl;

                sizeGroups.push({
                    sizes: { [size]: qty },
                    quantity: qty,
                    unitPrice: childUnitPrice,
                    total: qty * childUnitPrice,
                    color: childColor,      // Use child's color
                    imageUrl: childImageUrl
                });
            }
        });

        return { styleNumber, productName, color, sizeGroups, /* ... */ };
    });

    // 4. SAVE via quote service
    const quoteData = { customerName, customerEmail, products, /* ... */ };
    const result = await this.quoteService.saveQuote(quoteData);

    // 5. SHOW success modal
    if (result.success) {
        showSaveModal(result.quoteId);
    } else {
        alert('Error saving quote: ' + result.error);
    }
}
```

### 5.4 CSS Styles

```css
/* Save & Share Panel */
.save-quote-panel {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #0f3460;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
}

.save-quote-title {
    color: #e94560;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.save-quote-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 15px;
}

.quote-input {
    flex: 1;
    min-width: 150px;
    padding: 10px 12px;
    border: 1px solid #0f3460;
    border-radius: 6px;
    background: #0f0f23;
    color: #fff;
}

.btn-save-quote {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #e94560 0%, #c73659 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-save-quote:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
}

/* Modal Styles */
.save-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.save-modal-content {
    background: #1a1a2e;
    border: 1px solid #0f3460;
    border-radius: 16px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
}

.save-modal-header {
    text-align: center;
    margin-bottom: 20px;
}

.save-modal-header i {
    font-size: 3rem;
    color: #28a745;
}

.save-modal-header h3 {
    color: #fff;
    margin-top: 10px;
}

.url-copy-container {
    display: flex;
    gap: 10px;
}

.shareable-url-input {
    flex: 1;
    padding: 12px;
    border: 1px solid #0f3460;
    border-radius: 6px;
    background: #0f0f23;
    color: #4fc3f7;
    font-family: monospace;
}

.btn-copy-url {
    padding: 12px 20px;
    background: #0f3460;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

.save-modal-footer {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.btn-view-quote, .btn-close-modal {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
}

.btn-view-quote {
    background: #0f3460;
    color: #fff;
}

.btn-close-modal {
    background: transparent;
    border: 1px solid #0f3460;
    color: #ccc;
}
```

---

## Implementation Steps

### Step 1: Create Quote Service (30 min)

1. Copy `/shared_components/js/dtf-quote-service.js`
2. Rename to `[type]-quote-service.js`
3. Change `quotePrefix` to appropriate value
4. Change `EmbellishmentType` field value
5. Adjust any builder-specific field mappings

### Step 2: Add saveAndGetLink() to Builder (1-2 hrs)

1. Add `this.quoteService = new [Type]QuoteService()` to constructor
2. Implement `saveAndGetLink()` method
3. **CRITICAL**: Read color from `row.dataset.color`, not `product.color`
4. **CRITICAL**: Each sizeGroup must have its own `color`, `catalogColor`, `imageUrl`
5. **CRITICAL**: Extended sizes read color from CHILD row dataset

### Step 3: Add Save Panel to HTML (30 min)

1. Copy Save & Share panel HTML from template
2. Update `onclick` to call correct builder instance
3. Copy modal HTML
4. Add modal script functions

### Step 4: Add CSS Styles (15 min)

1. Copy CSS from template to builder's CSS file
2. Adjust colors if needed to match builder theme

### Step 5: Test End-to-End (30 min)

1. Create quote with multiple products
2. Test with extended sizes
3. **Test with DIFFERENT colors for extended sizes**
4. Verify database storage
5. Open quote URL, verify display

---

## Gotchas & Warnings

### COLOR_NAME vs CATALOG_COLOR

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| COLOR_NAME | Display to users | "Brilliant Orange" | UI, quote view |
| CATALOG_COLOR | API queries | "BrillOrng" | Inventory API, ShopWorks |

**Always save BOTH to database!**

### Row Dataset vs Product Object

```javascript
// HTML stores color here:
row.dataset.color = colorName;
row.dataset.catalogColor = catalogColor;
row.dataset.swatchUrl = imageUrl;

// JS class stores here:
this.products[i].color = colorName;
this.products[i].catalogColor = catalogColor;
this.products[i].imageUrl = imageUrl;

// THESE ARE DIFFERENT DATA STORES!
// Always check which one has the current value.
```

### Size Name Mapping

| Display | Internal | Notes |
|---------|----------|-------|
| 2XL | XXL | Same size (double extra-large) |
| 3XL | XXXL | Triple extra-large |
| 4XL | 4XL | Same |
| 5XL | 5XL | Same |
| 6XL | 6XL | Same |

**Always try both when looking up child rows:**
```javascript
const internalSize = size === '2XL' ? 'XXL' : (size === '3XL' ? 'XXXL' : size);
const childRowId = childMap[size] || childMap[internalSize];
```

### Price Selector Fallback

Parent and child rows may use different HTML structures:
```javascript
// Parent rows might use ID
const priceEl = document.getElementById(`row-price-${rowId}`);

// Child rows might use class
const priceEl = childRow.querySelector('.cell-price');

// ALWAYS use fallback pattern:
const priceEl = row.querySelector('.row-price') || document.getElementById(`row-price-${rowId}`);
```

### Each SizeGroup Needs Its Own Color

```javascript
// WRONG - All items get parent color
const color = parentRow?.dataset?.color;
extendedSizes.forEach(size => {
    sizeGroups.push({ color: color });  // Same color for all!
});

// CORRECT - Each item gets its own color
extendedSizes.forEach(size => {
    const childRow = document.getElementById(`row-${childRowId}`);
    const childColor = childRow?.dataset?.color || color;  // Child's color
    sizeGroups.push({ color: childColor });
});
```

---

## Reference Files

### DTF Implementation (Copy From)

| Component | File | Key Lines |
|-----------|------|-----------|
| Quote Service | `/shared_components/js/dtf-quote-service.js` | Full file |
| Builder Class | `/shared_components/js/dtf-quote-builder.js` | 1598-1720 |
| HTML + Modal | `/quote-builders/dtf-quote-builder.html` | 241-310, 1187-1254 |
| CSS Styles | `/shared_components/css/dtf-quote-builder.css` | Last 100 lines |
| Quote View | `/pages/quote-view.html` | Full file |
| Quote View JS | `/pages/js/quote-view.js` | Full file |
| Server Routes | `/server.js` | 2535-2690 |

### Database

- Table: `quote_sessions` in Caspio
- Table: `quote_items` in Caspio
- API: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions`
- API: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items`

---

## Testing Checklist

### Basic Flow

- [ ] Customer info validation (name, email required)
- [ ] Product validation (at least one product required)
- [ ] Quote saves to database
- [ ] Success modal appears with correct URL
- [ ] Copy button works
- [ ] View Quote button opens in new tab

### Data Accuracy

- [ ] Quote ID format correct (PREFIX + MMDD + sequence)
- [ ] All products saved to quote_items
- [ ] FinalUnitPrice matches displayed price
- [ ] LineTotal = Quantity × FinalUnitPrice
- [ ] SizeBreakdown JSON is correct
- [ ] Color field populated (not empty)
- [ ] ImageURL populated

### Different Colors Test

1. Add product with color A
2. Add extended sizes (2XL-6XL)
3. Change 3XL to color B
4. Change 5XL to color C
5. Save quote
6. Verify database:
   - [ ] S-XL item: Color A
   - [ ] 2XL item: Color A
   - [ ] 3XL item: **Color B** (different!)
   - [ ] 4XL item: Color A
   - [ ] 5XL item: **Color C** (different!)
   - [ ] 6XL item: Color A
7. Open quote view:
   - [ ] Three product cards (grouped by color)
   - [ ] Each card shows correct product image

### Quote View Display

- [ ] Company logo displays
- [ ] Customer info correct
- [ ] Product images load
- [ ] Size breakdown displays
- [ ] Prices display correctly
- [ ] Subtotal, LTM fee (if any), tax, total correct
- [ ] Print/PDF works
- [ ] Mobile responsive

---

## Future Enhancements

- [ ] Email quote directly to customer
- [ ] Quote acceptance tracking (ViewCount, AcceptedAt)
- [ ] Quote expiry notifications
- [ ] Digital signature capability
- [ ] Quote versioning (revisions)
- [ ] PDF download from quote view

---

*Last updated: January 2026*
*Based on DTF Quote Builder implementation*
