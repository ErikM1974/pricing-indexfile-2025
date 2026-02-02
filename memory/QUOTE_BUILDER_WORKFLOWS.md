# Quote Builder Workflows Reference

**Last Updated:** 2026-02-02
**Purpose:** Master reference for quote builder workflows (Text Import, PDF Generation, Shareable URLs)

This document explains the three key workflows shared across all quote builders, using the Embroidery Quote Builder as the reference implementation. DTG, DTF, and Screenprint builders can copy these patterns.

---

## Overview

All four quote builders share these core workflows:

| Workflow | Entry Point | Service Class | Key Methods |
|----------|-------------|---------------|-------------|
| **Text Import** | "Paste ShopWorks" button | `ShopWorksImportParser` | `parse()`, `consolidateProducts()` |
| **PDF Generation** | "Print Quote" button | `EmbroideryInvoiceGenerator` | `generateInvoiceHTML()` |
| **Shareable URLs** | "Save & Share" button | `EmbroideryQuoteService` | `saveQuote()`, `loadQuote()` |

### File Locations

```
/shared_components/js/
├── shopworks-import-parser.js       # Text import parser (all methods)
├── embroidery-quote-invoice.js      # PDF/invoice generator
├── embroidery-quote-service.js      # Database operations
├── quote-builder-utils.js           # Shared utilities
└── [method]-pricing-service.js      # Method-specific pricing
```

---

## 1. Text Import (ShopWorks Paste)

### Purpose

Allows users to paste order text from ShopWorks and automatically populate the quote builder with products, sizes, and services.

### Parser Class

**File:** `/shared_components/js/shopworks-import-parser.js`

```javascript
class ShopWorksImportParser {
    constructor() {
        // API endpoint for service codes (DECG, AL, etc.)
        this.API_BASE_URL = APP_CONFIG.API?.BASE_URL ||
            'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // Size mapping from ShopWorks to quote builder format
        this.SIZE_MAP = {
            'XS': 'XS', 'S': 'S', 'SM': 'S',
            'MD': 'M', 'M': 'M', 'LG': 'L', 'L': 'L',
            'XL': 'XL', 'XXL': '2XL', '2XL': '2XL',
            'XXXL': '3XL', '3XL': '3XL',
            // Tall sizes
            'LT': 'LT', 'XLT': 'XLT', '2XLT': '2XLT',
            // One-size
            'OSFA': 'OSFA', 'O/S': 'OSFA'
        };

        // Service code classification
        this.DIGITIZING_CODES = ['DD', 'DGT-001', 'DGT-002', 'DGT-003'];
        this.PATCH_SETUP_CODES = ['GRT-50'];
        this.GRAPHIC_DESIGN_CODES = ['GRT-75'];
    }
}
```

### Key Methods

#### 1. `parse(text)` - Main Entry Point

Parses raw ShopWorks order text into structured data.

```javascript
const parser = new ShopWorksImportParser();
await parser.loadServiceCodes();  // Load pricing from Caspio API
const result = parser.parse(orderText);

// Result structure:
{
    orderId: 'ORD-12345',
    customer: {
        customerId: 'CUST001',
        company: 'Acme Corp',
        contactName: 'John Doe',
        email: 'john@acme.com'
    },
    salesRep: {
        name: 'Erik Mickelson',
        email: 'erik@nwcustomapparel.com'
    },
    products: [
        {
            partNumber: 'PC61',
            description: 'Port & Company Essential T, White',
            color: 'White',
            sizes: { 'S': 2, 'M': 4, 'L': 3, 'XL': 1 },
            quantity: 10,
            needsLookup: true
        }
    ],
    services: {
        digitizing: true,
        digitizingCount: 1,
        additionalLogos: [
            { position: 'Left Sleeve', type: 'al', quantity: 10 }
        ],
        monograms: [],
        patchSetup: false,
        graphicDesign: { hours: 2, amount: 150 }
    },
    decgItems: [],     // Customer-supplied garments
    customProducts: [], // Non-SanMar products
    warnings: [],
    pricingSource: 'caspio'  // or 'fallback'
}
```

#### 2. `classifyPartNumber(partNumber)` - Service Code Classification

Returns item type based on ShopWorks part number.

```javascript
parser.classifyPartNumber('DD');       // → 'digitizing'
parser.classifyPartNumber('GRT-50');   // → 'patch-setup'
parser.classifyPartNumber('GRT-75');   // → 'graphic-design'
parser.classifyPartNumber('FB');       // → 'fb' (Full Back)
parser.classifyPartNumber('AL');       // → 'al' (Additional Logo)
parser.classifyPartNumber('DECG');     // → 'decg' (Customer-supplied garment)
parser.classifyPartNumber('DECC');     // → 'decc' (Customer-supplied cap)
parser.classifyPartNumber('Monogram'); // → 'monogram'
parser.classifyPartNumber('PC61');     // → 'product'
```

**Service Codes Reference:**

| Code | Type | Description |
|------|------|-------------|
| `DD`, `DGT-XXX` | digitizing | Digitizing setup fee |
| `GRT-50` | patch-setup | Patch/emblem setup fee |
| `GRT-75` | graphic-design | Graphic design ($75/hr) |
| `AL` | al | Additional Logo location |
| `FB` | fb | Full Back embroidery |
| `CB` | cb | Cap Back embroidery |
| `CS` | cs | Cap Side embroidery |
| `DECG` | decg | Customer-supplied garment |
| `DECC` | decc | Customer-supplied cap |
| `Monogram`, `Name` | monogram | Names/monogramming |
| `LTM` | ltm | Less-Than-Minimum fee |
| `AS-GARM` | additional-stitches | Extra stitches (garment) |
| `AS-CAP` | additional-stitches | Extra stitches (cap) |

#### 3. `consolidateProducts(products)` - Size Consolidation

Merges products split by ShopWorks SKUs back into single rows.

```javascript
// Input: ShopWorks creates separate items for each extended size
// ST253, ST253_2X, ST253_3X → 3 separate items

const consolidated = parser.consolidateProducts(parsedProducts);

// Output: Single product with merged sizes
// ST253: { S: 5, M: 10, L: 8, XL: 3, '2XL': 2, '3XL': 1 }
```

**How it works:**
- Groups by `partNumber + color` (case-insensitive)
- Merges all size quantities into single `sizes` object
- Recalculates `quantity` from merged sizes

### Text Format Requirements

ShopWorks export format expected:

```
********************
Order #: ORD-12345
Salesperson: Erik Mickelson
Email: erik@nwcustomapparel.com
********************
Customer #: CUST001
Company: Acme Corporation
********************
Ordered by: John Doe
Email: john@acme.com
********************
Items Purchased

Item 1 of 5
Part Number: PC61
Description: Port & Company Essential T, White
Unit Price: 12.50
Item Quantity: 10
Adult:Quantity
S:2
M:4
L:3
XL:1

Item 2 of 5
Part Number: DD
Description: Digitizing Setup
Unit Price: 100.00
Item Quantity: 1
```

### Integration Example

```javascript
// In quote builder HTML:
async function parseAndPreviewShopWorks() {
    const orderText = document.getElementById('shopworks-paste-area').value;
    if (!orderText.trim()) {
        showToast('Please paste ShopWorks order text', 'warning');
        return;
    }

    const parser = new ShopWorksImportParser();
    await parser.loadServiceCodes();  // Get pricing from Caspio

    const parsed = parser.parse(orderText);

    // Consolidate products (merge ST253 + ST253_2X → single row)
    parsed.products = parser.consolidateProducts(parsed.products);

    // Show preview modal
    showImportPreview(parsed);
}

function confirmShopWorksImport(parsed) {
    // Populate customer info
    if (parsed.customer.email) {
        document.getElementById('customer-email').value = parsed.customer.email;
    }
    if (parsed.customer.company) {
        document.getElementById('customer-company').value = parsed.customer.company;
    }

    // Add products to quote
    for (const product of parsed.products) {
        addProductRow(product);
    }

    // Apply services
    if (parsed.services.digitizing) {
        document.getElementById('needs-digitizing-1').checked = true;
    }

    showToast(`Imported ${parsed.products.length} products`, 'success');
}
```

### Extending for New Methods

To add ShopWorks import to a new quote builder:

1. Include the parser script:
   ```html
   <script src="/shared_components/js/shopworks-import-parser.js"></script>
   ```

2. Add the paste textarea and preview modal (copy from embroidery)

3. Implement `parseAndPreviewShopWorks()` and `confirmShopWorksImport()` functions

4. Method-specific handling:
   - **DTG/DTF**: Ignore digitizing services (map to setup fee instead)
   - **Screenprint**: Map `AL` to additional print locations

---

## 2. PDF Generation

### Purpose

Generates professional, print-ready quotes using the browser's native print functionality.

### Generator Class

**File:** `/shared_components/js/embroidery-quote-invoice.js`

```javascript
class EmbroideryInvoiceGenerator {
    constructor() {
        this.taxRate = 0.101; // 10.1% WA Sales Tax

        this.salesRepMap = {
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            // ... other reps
        };
    }
}
```

### Key Methods

#### 1. `generateInvoiceHTML(pricingData, customerData)` - Main Entry Point

Generates complete HTML document for printing.

```javascript
const generator = new EmbroideryInvoiceGenerator();
const html = generator.generateInvoiceHTML(pricingData, customerData);

// Opens print preview
const printWindow = window.open('', '_blank');
printWindow.document.write(html);
printWindow.document.close();
printWindow.print();
```

#### Data Structures Required

**pricingData object:**
```javascript
{
    quoteId: 'EMB-2026-001',
    tier: '24-47',
    totalQuantity: 36,
    subtotal: 540.00,
    grandTotal: 612.50,
    ltmFee: 0,
    setupFees: 100,

    // Method flags (for dynamic title)
    isDTG: false,
    isScreenprint: false,
    isDTF: false,

    // Logo/location configuration
    logos: [
        {
            position: 'Left Chest',
            stitchCount: 8000,
            needsDigitizing: true,
            isPrimary: true
        }
    ],

    // Products with line items
    products: [
        {
            product: {
                style: 'PC61',
                title: 'Port & Company Essential Tee',
                color: 'White',
                imageUrl: 'https://...'
            },
            lineItems: [
                {
                    description: 'S(2) M(4) L(3) XL(1)',
                    quantity: 10,
                    unitPrice: 15.00,
                    unitPriceWithLTM: 15.00,
                    total: 150.00,
                    basePrice: 12.50
                }
            ],
            subtotal: 150.00
        }
    ],

    // Additional services
    additionalServices: [
        {
            description: 'Additional Logo - Left Sleeve',
            quantity: 10,
            unitPrice: 8.50,
            total: 85.00
        }
    ],
    additionalServicesTotal: 85.00
}
```

**customerData object:**
```javascript
{
    name: 'John Doe',
    company: 'Acme Corp',
    email: 'john@acme.com',
    phone: '253-555-1234',
    salesRepEmail: 'erik@nwcustomapparel.com',
    notes: 'Rush order - need by Friday',
    artCharge: 50.00,
    graphicDesignHours: 2,
    graphicDesignCharge: 150.00,
    rushFee: 0,
    discount: 0,
    discountReason: ''
}
```

### Size Matrix Table

The PDF generates a size matrix table matching the on-screen layout:

```javascript
generateSizeMatrixTable(pricingData) {
    // Fixed columns: S, M, L, XL, 2XL, 3XL+ (Other)
    const sizeColumns = ['S', 'M', 'L', 'XL', '2XL', '3XL+'];

    // Extended sizes go into 3XL+ column:
    // XS, 3XL, 4XL, 5XL, 6XL, LT, XLT, 2XLT, OSFA, etc.
}
```

**Size Breakdown Parsing:**

```javascript
// Converts "S(6) M(6) L(6)" → { S: 6, M: 6, L: 6 }
parseSizeBreakdown(description) {
    const sizes = {};
    const regex = /(\w+)\((\d+)\)/g;
    let match;
    while ((match = regex.exec(description)) !== null) {
        sizes[match[1]] = parseInt(match[2]);
    }
    return sizes;
}
```

### Print-Safe CSS

Key CSS for proper print output:

```css
@page {
    size: letter portrait;
    margin: 0.3in;
}

@media print {
    body { margin: 0; }
    .invoice-container { padding: 0; }
    .products-table { page-break-inside: avoid; }
    .no-print { display: none; }
}
```

### Integration Example

```javascript
// In quote builder HTML:
function printQuote() {
    // Collect pricing data from UI state
    const pricingData = {
        quoteId: currentQuoteId,
        tier: currentTier,
        totalQuantity: getTotalQuantity(),
        grandTotal: parseFloat(document.getElementById('grand-total').textContent),
        // ... other fields
        products: getProductsFromTable()
    };

    // Collect customer data from form
    const customerData = {
        name: document.getElementById('customer-name').value,
        company: document.getElementById('customer-company').value,
        email: document.getElementById('customer-email').value,
        salesRepEmail: document.getElementById('sales-rep').value,
        notes: document.getElementById('quote-notes').value
    };

    // Generate and print
    const generator = new EmbroideryInvoiceGenerator();
    const html = generator.generateInvoiceHTML(pricingData, customerData);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
}
```

### Customizing for Different Methods

The generator auto-detects quote type via flags:

```javascript
getQuoteTypeInfo(pricingData) {
    if (pricingData.isDTG) {
        return { title: 'DTG QUOTE', prefix: 'DTG Quote' };
    } else if (pricingData.isScreenprint) {
        return { title: 'SCREEN PRINT QUOTE', prefix: 'Screen Print Quote' };
    } else if (pricingData.isDTF) {
        return { title: 'DTF QUOTE', prefix: 'DTF Quote' };
    } else {
        return { title: 'EMBROIDERY QUOTE', prefix: 'Embroidery Quote' };
    }
}
```

Method-specific specs sections:

```javascript
generateEmbroiderySpecs(pricingData) {
    if (pricingData.isDTG) return this.generateDTGSpecs(pricingData);
    if (pricingData.isScreenprint) return this.generateScreenprintSpecs(pricingData);
    if (pricingData.isDTF) return this.generateDTFSpecs(pricingData);
    return this.generateEmbroideryLogoSpecs(pricingData);
}
```

---

## 3. Shareable Quote URLs

### Purpose

Allows saving quotes to database and sharing via URL for customer review or later editing.

### Database Schema

**Two tables in Caspio:**

```sql
-- Quote Sessions (header)
quote_sessions (
    PK_ID            INT AUTO,
    QuoteID          VARCHAR(20) UNIQUE,  -- 'EMB-2026-001'
    SessionID        VARCHAR(50),
    CustomerEmail    VARCHAR(100),
    CustomerName     VARCHAR(100),
    CompanyName      VARCHAR(100),
    SalesRepEmail    VARCHAR(100),
    TotalQuantity    INT,
    SubtotalAmount   DECIMAL(10,2),
    LTMFeeTotal      DECIMAL(10,2),
    TotalAmount      DECIMAL(10,2),
    Status           VARCHAR(20),        -- 'Open', 'Closed', 'Expired'
    CreatedAt_Quote  DATETIME,
    ExpiresAt        DATETIME,
    Notes            TEXT,
    -- Embroidery-specific fields
    PrintLocation    VARCHAR(50),
    StitchCount      INT,
    DigitizingFee    DECIMAL(10,2),
    -- Extended fee fields
    ArtCharge        DECIMAL(10,2),
    GraphicDesignHours DECIMAL(5,2),
    GraphicDesignCharge DECIMAL(10,2),
    RushFee          DECIMAL(10,2),
    Discount         DECIMAL(10,2),
    DiscountPercent  DECIMAL(5,2),
    DiscountReason   VARCHAR(100),
    -- Revision tracking
    RevisionNumber   INT DEFAULT 1,
    RevisedAt        DATETIME,
    RevisedBy        VARCHAR(100)
)

-- Quote Items (line items)
quote_items (
    PK_ID            INT AUTO,
    QuoteID          VARCHAR(20),        -- FK to quote_sessions
    LineNumber       INT,
    StyleNumber      VARCHAR(20),
    ProductName      VARCHAR(200),
    Color            VARCHAR(50),
    ColorCode        VARCHAR(20),
    EmbellishmentType VARCHAR(30),
    PrintLocation    VARCHAR(100),
    PrintLocationName VARCHAR(100),
    Quantity         INT,
    HasLTM           VARCHAR(3),         -- 'Yes' or 'No'
    BaseUnitPrice    DECIMAL(10,2),
    LTMPerUnit       DECIMAL(10,2),
    FinalUnitPrice   DECIMAL(10,2),
    LineTotal        DECIMAL(10,2),
    SizeBreakdown    TEXT,               -- JSON: {"S": 2, "M": 4, "L": 3}
    PricingTier      VARCHAR(20),
    ImageURL         VARCHAR(500),
    LogoSpecs        TEXT,               -- JSON: logo configuration
    AddedAt          DATETIME
)
```

### Service Class

**File:** `/shared_components/js/embroidery-quote-service.js`

```javascript
class EmbroideryQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'EMB';  // Change per method: 'DTG', 'DTF', 'SPC'
    }
}
```

### Quote ID Generation

Format: `[PREFIX]-[YEAR]-[SEQ]` (e.g., `EMB-2026-001`)

```javascript
async generateQuoteID() {
    try {
        // Use Caspio-backed sequence for persistence across sessions
        const response = await fetch(`${this.baseURL}/api/quote-sequence/${this.quotePrefix}`);
        const { prefix, year, sequence } = await response.json();
        return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
    } catch (error) {
        // Fallback to date-based ID if API fails
        const now = new Date();
        const dateKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
        let sequence = parseInt(sessionStorage.getItem(`${this.quotePrefix}_seq_${dateKey}`) || '0') + 1;
        sessionStorage.setItem(`${this.quotePrefix}_seq_${dateKey}`, sequence.toString());
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }
}
```

### Three Modes: Create → View → Edit

```javascript
// 1. CREATE MODE - No URL parameter, fresh quote
if (!urlParams.has('quoteId')) {
    initializeNewQuote();
}

// 2. VIEW MODE - ?quoteId=EMB-2026-001 (read-only)
if (urlParams.has('quoteId') && !urlParams.has('edit')) {
    loadQuoteForViewing(urlParams.get('quoteId'));
}

// 3. EDIT MODE - ?quoteId=EMB-2026-001&edit=true
if (urlParams.has('quoteId') && urlParams.has('edit')) {
    loadQuoteForEditing(urlParams.get('quoteId'));
}
```

### Save Flow

```javascript
async saveQuote(quoteData, customerData, pricingResults) {
    // 1. Generate quote ID
    const quoteID = await this.generateQuoteID();

    // 2. Prepare session data
    const sessionData = {
        QuoteID: quoteID,
        CustomerEmail: customerData.email,
        CustomerName: customerData.name,
        // ... all session fields
    };

    // 3. Save session
    await fetch(`${this.baseURL}/api/quote_sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
    });

    // 4. Delete existing items (if re-saving)
    await this.deleteExistingItems(quoteID);

    // 5. Save line items
    for (const productPricing of pricingResults.products) {
        for (const lineItem of productPricing.lineItems) {
            const itemData = {
                QuoteID: quoteID,
                LineNumber: lineNumber++,
                StyleNumber: productPricing.product.style,
                SizeBreakdown: JSON.stringify(this.parseDescriptionToSizeBreakdown(lineItem.description)),
                // ... other fields
            };

            await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
        }
    }

    return { success: true, quoteID: quoteID };
}
```

### Load Flow

```javascript
async loadQuote(quoteId) {
    // 1. Fetch session
    const sessionResponse = await fetch(
        `${this.baseURL}/api/quote_sessions?QuoteID=${encodeURIComponent(quoteId)}`
    );
    const sessions = await sessionResponse.json();
    const session = sessions[0];

    // 2. Fetch line items
    const itemsResponse = await fetch(
        `${this.baseURL}/api/quote_items?QuoteID=${encodeURIComponent(quoteId)}`
    );
    const items = await itemsResponse.json();

    return {
        success: true,
        session: session,
        items: items
    };
}
```

### Line Item Serialization

**SizeBreakdown field:**
```javascript
// Stored as JSON string
SizeBreakdown: '{"S": 2, "M": 4, "L": 3, "XL": 1}'

// Parse for display:
const sizes = JSON.parse(item.SizeBreakdown);
// → { S: 2, M: 4, L: 3, XL: 1 }

// Convert to description string:
const desc = Object.entries(sizes)
    .map(([size, qty]) => `${size}(${qty})`)
    .join(' ');
// → "S(2) M(4) L(3) XL(1)"
```

**LogoSpecs field (first item only):**
```javascript
// Compact JSON for logo configuration
LogoSpecs: JSON.stringify({
    logos: [
        { pos: 'Left Chest', stitch: 8000, digit: 1, primary: 1 },
        { pos: 'Left Sleeve', stitch: 5000, digit: 0, primary: 0 }
    ],
    tier: '24-47',
    setup: 100
})
```

### Integration Example

```javascript
// Save button handler
async function saveAndShareQuote() {
    const quoteService = new EmbroideryQuoteService();

    // Collect data from UI
    const pricingResults = calculatePricing();
    const customerData = getCustomerData();
    const quoteData = { capEmbellishmentType: getCurrentEmbellishmentType() };

    // Save to database
    const result = await quoteService.saveQuote(quoteData, customerData, pricingResults);

    if (result.success) {
        // Generate shareable URL
        const shareUrl = `${window.location.origin}${window.location.pathname}?quoteId=${result.quoteID}`;

        // Show success modal with URL
        document.getElementById('shareable-url').value = shareUrl;
        document.getElementById('save-success-modal').style.display = 'block';

        showToast(`Quote ${result.quoteID} saved!`, 'success');
    } else {
        showToast(`Save failed: ${result.error}`, 'error');
    }
}

// Load quote on page load
async function loadExistingQuote(quoteId) {
    const quoteService = new EmbroideryQuoteService();
    const result = await quoteService.loadQuote(quoteId);

    if (result.success) {
        // Populate customer info
        document.getElementById('customer-email').value = result.session.CustomerEmail;
        document.getElementById('customer-company').value = result.session.CompanyName;

        // Reconstruct product rows from items
        for (const item of result.items) {
            if (item.EmbellishmentType === 'embroidery') {
                addProductRowFromSavedItem(item);
            }
        }

        // Set quote ID in UI
        currentQuoteId = quoteId;
        document.getElementById('quote-id-display').textContent = quoteId;
    }
}
```

### Extending for New Methods

1. Create a new service class (copy `embroidery-quote-service.js`):
   ```javascript
   class DTGQuoteService extends EmbroideryQuoteService {
       constructor() {
           super();
           this.quotePrefix = 'DTG';
       }
   }
   ```

2. Update session data fields for method-specific data:
   ```javascript
   // DTG-specific
   PrintLocation: printConfig.front,
   BackPrintLocation: printConfig.back,

   // Screenprint-specific
   FrontColors: printConfig.frontColors,
   BackColors: printConfig.backColors,
   TotalScreens: printConfig.totalScreens
   ```

3. Implement method-specific line item reconstruction in `loadQuote()`.

---

## 4. Common Utilities

**File:** `/shared_components/js/quote-builder-utils.js`

Shared across ALL quote builders:

### Security
```javascript
escapeHtml(str)      // XSS protection for HTML output
```

### Display
```javascript
formatPrice(price)   // Format number for display
showToast(message, type, duration)  // Toast notifications
```

### Discount Handling
```javascript
updateDiscountType()           // Toggle percent vs fixed
handleDiscountPresetChange()   // Handle preset dropdown
getDiscountValues()            // Get current discount settings
initializeDiscountControls()   // Initialize on page load
```

### Panel Toggles
```javascript
toggleAdditionalCharges()      // Expand/collapse charges panel
toggleArtworkServices()        // Expand/collapse artwork panel
toggleArtCharge()              // Toggle art charge checkbox
updateArtworkCharges()         // Update artwork totals
```

### Keyboard Navigation
```javascript
handleCellKeydown(event, input)  // Arrow keys, Enter, Tab in tables
```

### URL Sharing
```javascript
copyShareableUrl()    // Copy URL to clipboard
closeSaveModal()      // Close save success modal
```

---

## Method-Specific Differences

### Embroidery
- **Logo configuration**: Primary + Additional logos, stitch counts
- **LTM threshold**: `qty <= 7` triggers LTM fee
- **Digitizing fees**: $100 per new logo
- **Service codes**: DD, AL, FB, CB, CS, AS-GARM, AS-CAP

### DTG (Direct-to-Garment)
- **Print locations**: Dropdown (LC, FF, JF, FB, JB, combinations)
- **LTM threshold**: `qty < 24`
- **Setup fee**: Fixed amount, not per-logo
- **No digitizing** (digital print)

### DTF (Direct-to-Film)
- **Print locations**: Radio grid (9 locations)
- **Gang sheet pricing**: Based on transfer size
- **LTM threshold**: `qty < 24`
- **No digitizing** (digital print)

### Screenprint
- **Print configuration**: Colors per location, dark garment flag
- **Screen fees**: $30 per screen (color × location)
- **LTM threshold**: `qty < 24`
- **Safety stripes**: +$2/piece/location surcharge

---

## Quick Reference

### Quote Prefixes by Method
| Method | Prefix | Example |
|--------|--------|---------|
| Embroidery | `EMB` | EMB-2026-001 |
| DTG | `DTG` | DTG-2026-001 |
| DTF | `DTF` | DTF-2026-001 |
| Screenprint | `SPC` | SPC-2026-001 |
| Cap Embroidery | `CAP` | CAP-2026-001 |

### API Endpoints
```
POST /api/quote_sessions     - Create session
GET  /api/quote_sessions     - Query sessions (filter by QuoteID)
PUT  /api/quote_sessions/:id - Update session
POST /api/quote_items        - Create line item
GET  /api/quote_items        - Query items (filter by QuoteID)
DELETE /api/quote_items/:id  - Delete item
GET  /api/quote-sequence/:prefix - Get next sequence number
```

### Files to Copy for New Builder
1. `/shared_components/js/quote-builder-utils.js` (include as-is)
2. `/shared_components/js/shopworks-import-parser.js` (include as-is)
3. `/shared_components/js/embroidery-quote-invoice.js` (customize for method)
4. `/shared_components/js/embroidery-quote-service.js` (customize for method)

---

*See also: [QUOTE_BUILDER_BEST_PRACTICES.md](./QUOTE_BUILDER_BEST_PRACTICES.md), [SHAREABLE_QUOTE_BLUEPRINT.md](./quote-builders/SHAREABLE_QUOTE_BLUEPRINT.md)*
