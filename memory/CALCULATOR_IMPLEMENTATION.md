# Calculator Implementation Guide for NWCA

## Calculator Architecture

Each pricing calculator follows a consistent pattern:

1. **HTML Page** - Self-contained calculator with embedded JavaScript class
2. **Quote Service** - Handles database integration and quote persistence  
3. **EmailJS Integration** - Sends professional quotes to customers
4. **Consistent UI/UX** - Follows established design patterns

**Gold Standard Implementation**: The Customer Supplied Embroidery Calculator (`/calculators/embroidery-customer.html`) serves as the reference implementation for all new calculators, featuring:
- Persistent success modal with quote ID display
- Professional print functionality
- Robust error handling
- Complete EmailJS integration
- Database save with fallback

### File Structure

```
/calculators/
├── [name]-calculator.html     # Main calculator page
├── [name]-quote-service.js    # Database integration
└── test-[name].html          # Optional test page

/staff-dashboard.html         # Central navigation hub
```

## Creating a New Calculator

### Step 1: Information Gathering

Before writing any code, gather the following information:

```markdown
CALCULATOR REQUIREMENTS:
1. Calculator Name: ________________________________
2. Quote Prefix (2-4 letters): ____________________  
3. Primary Contact Person: _________________________
4. Decoration Type: ________________________________
5. Pricing Structure:
   □ Tiered by quantity
   □ Flat rate  
   □ Custom calculation
6. Minimum Order Quantity: _________________________
7. Setup Fees: ____________________________________
8. LTM (Less Than Minimum) Fee: ___________________

EMAILJS REQUIREMENTS:
1. Template ID (not name): ________________________
2. Special email variables: _______________________

DATABASE REQUIREMENTS:
1. Save quotes to database? □ Yes □ No
2. Default Sales Rep: _____________________________
```

### Step 2: Create HTML Calculator Page

**IMPORTANT**: Use the complete template from @memory/CALCULATOR_TEMPLATES.md which includes:
- Full HTML structure with success modal
- JavaScript calculator class implementation
- Quote service template
- Print functionality
- All required styling

Root variables to use (NWCA Green Theme):
```css
:root {
    --primary-color: #4cb354; /* NWCA Green */
    --primary-dark: #409a47;
    --primary-light: #5bc85f;
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --hover-bg: #f3f4f6;
    --success-bg: #d1fae5;
    --success-text: #065f46;
    --warning-bg: #fef3c7;
    --warning-text: #92400e;
    --focus-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
}

### Step 3: Implement JavaScript Calculator Class

```javascript
class [Name]Calculator {
    constructor() {
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // Initialize quote service
        this.quoteService = new [Name]QuoteService();
        
        // Store current quote data
        this.currentQuote = null;
        
        // EmailJS configuration
        this.emailConfig = {
            publicKey: '4qSbDO-SQs19TbP80',
            serviceId: 'service_1c4k67j',
            templateId: 'template_[specific_id]' // Get from user
        };
        
        this.initializeElements();
        this.bindEvents();
    }
    
    calculate() {
        // Implement pricing logic
        // Store results in this.currentQuote
    }
    
    async handleQuoteSubmit(e) {
        e.preventDefault();
        
        // 1. Validate form
        // 2. Generate quote ID
        // 3. Save to database (if enabled)
        // 4. Send email
        // 5. Show success with quote ID
    }
}
```

## Complete Calculator Implementation Workflow

### Overview
This workflow ensures every new calculator is implemented correctly, avoiding all common pitfalls discovered during the laser tumbler implementation. Follow these phases in order - each phase has critical checkpoints.

### 🚨 CRITICAL: Pre-Flight Information Gathering

**STOP! Before writing ANY code, gather ALL of this information from the user:**

```markdown
CALCULATOR INFORMATION REQUIRED:
1. Calculator Name: ________________________________
2. Quote Prefix (2-4 letters): ____________________
3. Dashboard Section:
   □ Contract Pricing
   □ Customer Supplied Goods  
   □ Specialty Items
   □ Other Vendors
4. Primary Contact Person: _________________________
5. Font Awesome Icon: _____________________________

PRICING INFORMATION:
1. Base Product: __________________________________
2. Service Type: __________________________________
3. Pricing Structure:
   □ Tiered by quantity
   □ Flat rate
   □ Custom calculation
4. Minimum Order: _________________________________
5. Setup Fees: ____________________________________
6. Additional Options: ____________________________

EMAILJS REQUIREMENTS:
1. Do you have an EmailJS template created? □ Yes □ No
2. If Yes, Template ID: __________________________
3. If No, I will provide HTML for you to create one

DATABASE REQUIREMENTS:
1. Should quotes be saved to database? □ Yes □ No
2. Default Sales Rep: _____________________________
```

**DO NOT PROCEED WITHOUT THIS INFORMATION!**

### Phase 1: Planning & Setup (10 minutes)

#### 1.1 Validate Information
- [ ] Confirm quote prefix is unique (check existing calculators)
- [ ] Verify dashboard section placement
- [ ] Ensure pricing logic is clear

#### 1.2 Create File Structure
```bash
/calculators/
  ├── [name]-calculator.html       # Main calculator page
  └── [name]-quote-service.js     # Database integration
```

#### 1.3 Document in CLAUDE.md
Add entry under "Active Calculators" section:
```markdown
### [Calculator Name] ([PREFIX])
- **File**: /calculators/[name]-calculator.html
- **Added**: [Date]
- **Contact**: [Person]
- **EmailJS Template**: [template_id]
- **Quote Format**: [PREFIX][MMDD]-[sequence]
```

### Phase 2: Calculator Development (30 minutes)

#### 2.1 HTML Structure
Use this standard structure - DO NOT DEVIATE without good reason:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>[Calculator Name] - Northwest Custom Apparel</title>
    <link rel="icon" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1" type="image/png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    
    <!-- CRITICAL: Include these in order -->
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
    <script src="[name]-quote-service.js"></script>
</head>
```

#### 2.2 Required UI Elements
Every calculator MUST have:
1. **Logo**: Use standard URL from header
2. **Breadcrumb**: Link back to dashboard
3. **Main form**: With proper validation
4. **Results display**: Clear pricing breakdown
5. **Email Quote button**: Opens modal
6. **Print button**: For PDF generation

#### 2.3 JavaScript Class Structure
```javascript
class [Name]Calculator {
    constructor() {
        // ALWAYS initialize these
        emailjs.init('4qSbDO-SQs19TbP80');
        this.quoteService = new [Name]QuoteService();
        this.currentQuote = null;
        
        this.initializeElements();
        this.bindEvents();
    }
}
```

### Phase 3: Integration (15 minutes)

#### 3.1 Add to Dashboard
In `staff-dashboard.html`, add calculator card:
```html
<a href="/calculators/[name]-calculator.html" class="calculator-card"
   title="[Description]. Contact: [Person]">
    <i class="fas fa-[icon] calculator-icon"></i>
    <span class="calculator-name">[Display Name]</span>
    <span class="new-badge">NEW 2025</span>
</a>
```

#### 3.2 Update Documentation
Add entry to Active Calculators Registry in this file.

### Phase 4: Testing (15 minutes)

#### Console Testing Commands
```javascript
// Test initialization
console.log(window.[name]Calculator);

// Test quote ID generation
console.log(window.[name]Calculator.quoteService.generateQuoteID());

// Test current quote data
console.log(window.[name]Calculator.currentQuote);

// Check email data before send
console.log('Email data:', emailData);
```

#### Functional Testing Checklist
- [ ] Calculator loads without errors
- [ ] Form validation works
- [ ] Calculations are correct
- [ ] Quote displays properly
- [ ] Email modal functions
- [ ] Quote ID shows in success message
- [ ] Email sends successfully
- [ ] Database save works (check console)
- [ ] Print functionality works

### Common Implementation Patterns

#### Single Item Calculator (e.g., DTG)
```javascript
// One line item with multiple options
const itemData = {
    StyleNumber: 'CUSTOMER-SUPPLIED',
    ProductName: 'Contract DTG Printing',
    PrintLocation: locations.join(', '),
    Quantity: totalQuantity,
    FinalUnitPrice: pricePerItem,
    LineTotal: totalCost
};
```

#### Multi-Item Calculator (e.g., Richardson)
```javascript
// Multiple line items in one quote
quoteData.items.forEach((item, index) => {
    const itemData = {
        LineNumber: index + 1,
        StyleNumber: item.style,
        ProductName: item.description,
        Quantity: item.quantity,
        FinalUnitPrice: item.price,
        LineTotal: item.total
    };
});
```

#### LTM Fee Handling
```javascript
if (quantity < 24) {
    const ltmFee = 50.00;
    const ltmPerUnit = ltmFee / quantity;
    finalPrice = basePrice + ltmPerUnit;
}
```

## Implementation Best Practices

### Quote ID Format
All quote IDs follow this standard format:
```
{PREFIX}{MMDD}-{sequence}
Examples: DTG0126-1, RICH0126-2, EMB0126-3, EMBC0126-4
```

### Standard Margin Calculation
```javascript
const markedUpPrice = basePrice / 0.6;  // 60% margin
```

### LTM (Less Than Minimum) Pattern
```javascript
if (quantity < 24) {
    ltmFee = 50.00;
    ltmPerUnit = ltmFee / quantity;
    finalPrice = basePrice + ltmPerUnit;
}
```

## Common Calculation Patterns

### Standard Margin Calculation (60% margin)
```javascript
const markedUpPrice = basePrice / 0.6;
```

### LTM (Less Than Minimum) Pattern
```javascript
if (quantity < 24) {
    const ltmFee = 50.00;
    const ltmPerUnit = ltmFee / quantity;
    finalPrice = basePrice + ltmPerUnit;
}
```

### Tiered Pricing Structure
```javascript
const pricingTiers = {
    embroidery: {
        '1-23': 10.50,
        '24-47': 9.50,
        '48-71': 8.75,
        '72+': 8.00
    }
};

function getPrice(quantity, type) {
    const tiers = pricingTiers[type];
    if (quantity < 24) return tiers['1-23'];
    if (quantity < 48) return tiers['24-47'];
    if (quantity < 72) return tiers['48-71'];
    return tiers['72+'];
}
```

### Quote Preview HTML Pattern
```javascript
function generateQuotePreview(items) {
    let html = `
        <table class="quote-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    items.forEach(item => {
        html += `
            <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>$${item.unitPrice.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}
```

### Color Selection Patterns

#### Tumbler Color Selection (by case)
```javascript
const colorsByCase = [
    { name: 'Black', model: '16OZBLK', hex: '#000000' },
    { name: 'White', model: '16OZWHT', hex: '#FFFFFF' },
    { name: 'Navy', model: '16OZNVY', hex: '#000080' }
];

// Store as JSON in SizeBreakdown field
const colorBreakdown = {
    'Black': { model: '16OZBLK', quantity: 24, hex: '#000000' },
    'White': { model: '16OZWHT', quantity: 48, hex: '#FFFFFF' }
};
```

### Sales Rep Configuration

**IMPORTANT**: Always reference @memory/STAFF_DIRECTORY.md for the authoritative list of staff emails and names.

```javascript
const salesReps = [
    { email: 'sales@nwcustomapparel.com', name: 'General Sales', default: true },
    { email: 'ruth@nwcustomapparel.com', name: 'Ruth Nhong' },
    { email: 'taylar@nwcustomapparel.com', name: 'Taylar Hanson' },
    { email: 'nika@nwcustomapparel.com', name: 'Nika Lao' },
    { email: 'erik@nwcustomapparel.com', name: 'Erik Mickelson' },
    { email: 'adriyella@nwcustomapparel.com', name: 'Adriyella' },
    { email: 'bradley@nwcustomapparel.com', name: 'Bradley Wright' },
    { email: 'jim@nwcustomapparel.com', name: 'Jim Mickelson' },
    { email: 'art@nwcustomapparel.com', name: 'Steve Deland' }
];
```

### Date Formatting for Caspio
```javascript
// Caspio requires ISO format without milliseconds
const caspioDate = new Date().toISOString().replace(/\.\d{3}Z$/, '');
```

### Session Storage Patterns
```javascript
// Daily quote sequence
const dateKey = `${month}${day}`;
const storageKey = `${prefix}_quote_sequence_${dateKey}`;
let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
sessionStorage.setItem(storageKey, sequence.toString());

// Cleanup old sequences
Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(`${prefix}_quote_sequence_`) && !key.endsWith(dateKey)) {
        sessionStorage.removeItem(key);
    }
});
```

### Error Display Pattern
```javascript
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
    `;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}
```

### Success Modal with Quote ID (Preferred Pattern)
```javascript
// Show persistent modal instead of temporary message
showSuccessModal(quoteId, quoteData) {
    // Update modal content
    document.getElementById('modalQuoteId').textContent = quoteId;
    document.getElementById('modalCustomerName').textContent = quoteData.customerName;
    document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
    document.getElementById('modalTotalAmount').textContent = `$${quoteData.totalCost.toFixed(2)}`;
    
    // Store data for print functionality
    this.lastQuoteData = quoteData;
    this.lastQuoteData.quoteId = quoteId;
    
    // Show modal
    document.getElementById('successModal').classList.add('active');
}

// Supporting functions
function copyQuoteId() {
    const quoteId = document.getElementById('modalQuoteId').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        alert('Quote ID copied to clipboard!');
    });
}

function printQuote() {
    // See CALCULATOR_TEMPLATES.md for complete print implementation
}
```

## Contract Calculator Best Practices (2025-01-27)

### 1. LTM (Less Than Minimum) Fee Display Standards

**Problem**: Customers were confused about how LTM fees affected their per-item pricing.

**Solution**: Implement clear, transparent pricing breakdowns:

#### Quote Table Structure
```
Description                                  Qty    Unit Price    Total
Flat Embroidery - 6,000 stitches           12     $10.50        $126.00
Extra Thread Color (1 color beyond 4)        12     $1.00         $12.00
────────────────────────────────────────────────────────────────────────
Subtotal:                                                        $138.00
Less Than Minimum Fee:                                           $50.00
════════════════════════════════════════════════════════════════════════
TOTAL:                                                          $188.00
```

#### Price Per Item Breakdown (Blue Info Box)
```
Price Per Item Breakdown:
Base Embroidery:         $10.50
Extra Color Charge:    + $1.00
─────────────────────────────
Regular Price:          $11.50
LTM Impact:           + $4.17
═════════════════════════════
Your Price Per Item:    $15.67
```

**Key Points**:
- Show subtotal before LTM
- Display LTM as a line item, not just a note
- Calculate and show per-item impact
- Use visual separators for clarity
- Help customers understand both regular and adjusted pricing

### 2. EmailJS HTML Rendering Rules

**Problem**: HTML code appearing as plain text in emails.

**Solution**: Use proper brace notation in EmailJS templates:

- **Double braces** `{{variable}}` - For plain text values
- **Triple braces** `{{{variable}}}` - For HTML content

**Common HTML Variables**:
```javascript
// In EmailJS template:
{{{quote_items_html}}}      // HTML table rows
{{{color_charge_desc}}}     // Extra charges as table rows
{{{ltm_fee}}}              // LTM fee table row
{{{price_breakdown_html}}}  // Complete pricing breakdown
```

**Example Implementation**:
```javascript
// Build HTML content in calculator
let colorChargeRow = `
    <tr>
        <td>Extra Thread Colors...</td>
        <td class="text-center">${quantity}</td>
        <td class="text-right">$${price}</td>
    </tr>
`;

// Send to EmailJS
emailData = {
    color_charge_desc: colorChargeRow,  // Will use {{{color_charge_desc}}}
    customer_name: 'John Doe',          // Will use {{customer_name}}
};
```

### 3. Grammar and Formatting Standards

**Problem**: Incorrect pluralization and confusing descriptions.

**Solution**: Implement proper grammar handling:

```javascript
// Singular/plural handling
const colorText = extraColors === 1 ? 'color' : 'colors';
const description = `Extra Thread Color${extraColors > 1 ? 's' : ''} (${extraColors} ${colorText} beyond 4 included)`;

// Results in:
// "Extra Thread Color (1 color beyond 4 included)"
// "Extra Thread Colors (2 colors beyond 4 included)"
```

### 4. Theme Colors by Service Type

**Consistent Color Coding**:
- **DTG**: Green theme (#3a7c52)
- **Embroidery**: Slate blue (#4A5568)
- **Screen Print**: Orange theme (TBD)
- **Richardson**: Green theme (#3a7c52)

### 5. Print Functionality

**Standard Print Support**:
- Include print CSS media queries
- Hide navigation and non-essential elements
- Show pricing breakdown in print version
- Use `window.print()` for PDF generation

```javascript
// Print button
<button onclick="window.print()">
    <i class="fas fa-print"></i> Print Quote
</button>

// Print styles
@media print {
    .no-print { display: none !important; }
    /* Additional print-specific styles */
}
```

### 6. Testing Checklist for Contract Calculators

- [ ] LTM fee displays correctly with per-item breakdown
- [ ] Grammar is correct for singular/plural items
- [ ] EmailJS renders HTML properly (no raw code)
- [ ] Phone number is 253-922-5793
- [ ] Sales rep dropdown works with default selection
- [ ] Print functionality generates clean PDF
- [ ] Quote saves to database with correct prefix
- [ ] All calculations match expected values
- [ ] Error messages are user-friendly
- [ ] Mobile responsive design works

## Active Calculators Registry

### Pricing Calculators
- **DTG Contract** (DTG)
  - File: /calculators/dtg-contract.html
  - Contact: Taylar Hanson
  - Type: Contract pricing for blank apparel
  
- **Richardson Caps** (RICH)
  - File: /calculators/richardson-2025.html
  - Contact: General Sales
  - Type: Cap pricing from Richardson vendor
  
- **Embroidery Contract** (EMB)
  - File: /calculators/embroidery-contract.html
  - Contact: Ruthie
  - Type: Flat & cap embroidery pricing
  
- **Customer Supplied Embroidery** (EMBC)
  - File: /calculators/embroidery-customer.html
  - Contact: General Sales
  - Type: Embroidery for customer-supplied garments
  
- **Laser Tumblers** (LT)
  - File: /calculators/laser-tumbler-polarcamel.html
  - Contact: General Sales
  - Type: Polar Camel 16 oz laser engraved tumblers
  
- **Embroidered Emblems** (PATCH)
  - File: /calculators/embroidered-emblem-calculator.html
  - Contact: Jim Mickelson
  - Type: Custom embroidered emblem and patch pricing
  
- **Customer Screen Print** (SPC)
  - File: /calculators/screenprint-customer.html
  - Contact: General Sales
  - Type: Screen printing for customer-supplied items

### Design Tools (Non-Pricing)
- **Safety Stripe Creator** (SSC)
  - File: /calculators/safety-stripe-creator.html
  - Service: /calculators/safety-stripe-creator-service.js
  - Contact: General Sales
  - Type: Visual design tool for safety stripe layouts
  - Added: January 2025
  - Special Features:
    - No pricing calculations
    - Visual stripe selection (4 styles)
    - Front and back placement options
    - EmailJS integration for sending designs
    - Database tracking of sent designs
    - Orange safety theme (#ff6b35)