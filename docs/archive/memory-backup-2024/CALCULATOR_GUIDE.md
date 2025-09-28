# Calculator Implementation Guide

## Overview
Comprehensive guide for building NWCA pricing calculators with quote functionality, database integration, and email capabilities. Based on successful Customer Supplied Embroidery pattern.

## Quick Start Checklist

### Information Required Before Starting
```markdown
1. Calculator Name: _______________
2. Quote Prefix (2-4 letters): ____
3. Dashboard Section: _____________
4. Primary Contact: _______________
5. EmailJS Template ID: ___________
6. Pricing Structure: _____________
7. Minimum Order: _________________
8. Setup Fees: ____________________
```

## File Structure
```
/calculators/
├── [name]-calculator.html       # Main calculator
├── [name]-quote-service.js     # Database integration
/staff-dashboard.html            # Add link here
```

## Core Implementation Pattern

### 1. HTML Structure (Essential Elements Only)
```html
<!-- Required Scripts -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
<script src="[name]-quote-service.js"></script>

<!-- Root Variables (NWCA Green Theme) -->
<style>
:root {
    --primary-color: #4cb354;
    --primary-dark: #409a47;
    --primary-light: #5bc85f;
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
}
</style>

<!-- Standard Header -->
<header class="header">
    <nav class="breadcrumb">
        <a href="/staff-dashboard.html">Dashboard</a> / <span>[Calculator Name]</span>
    </nav>
</header>

<!-- Required Modals -->
<!-- Email Modal for customer info -->
<!-- Success Modal with Quote ID display -->
```

### 2. JavaScript Calculator Class
```javascript
class [Name]Calculator {
    constructor() {
        emailjs.init('4qSbDO-SQs19TbP80');
        this.quoteService = new [Name]QuoteService();
        this.currentQuote = null;
        
        this.emailConfig = {
            serviceId: 'service_1c4k67j',
            templateId: 'template_xxxxx' // Get from user
        };
        
        this.initializeElements();
        this.bindEvents();
    }
    
    async handleQuoteSubmit(e) {
        e.preventDefault();
        
        // 1. Generate quote ID
        const quoteId = this.quoteService.generateQuoteID();
        
        // 2. Save to database (optional)
        if (this.saveToDatabase.checked) {
            await this.quoteService.saveQuote(quoteData);
        }
        
        // 3. Send email with ALL required variables
        const emailData = this.buildEmailData(quoteData);
        await emailjs.send(
            this.emailConfig.serviceId,
            this.emailConfig.templateId,
            emailData
        );
        
        // 4. Show success modal with Quote ID
        this.showSuccessModal(quoteId);
    }
}
```

### 3. Quote Service Pattern
```javascript
class [Name]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'XX'; // Set your prefix
    }
    
    generateQuoteID() {
        const now = new Date();
        const dateKey = `${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
        const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }
    
    async saveQuote(quoteData) {
        const quoteID = this.generateQuoteID();
        
        // Create session
        const sessionData = {
            QuoteID: quoteID,
            SessionID: this.generateSessionID(),
            CustomerEmail: quoteData.customerEmail,
            CustomerName: quoteData.customerName,
            TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
            Status: 'Open',
            ExpiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString().replace(/\.\d{3}Z$/, ''),
            Notes: quoteData.notes || ''
        };
        
        await fetch(`${this.baseURL}/api/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        
        // Add line items...
        
        return { success: true, quoteID };
    }
}
```

## Required EmailJS Variables
Every template MUST include these variables to avoid corruption:
```javascript
const emailData = {
    // System (required)
    to_email, from_name: 'Northwest Custom Apparel', reply_to,
    
    // Quote (required)
    quote_type: 'Calculator Name', // NEVER use {{PLACEHOLDER}}
    quote_id, quote_date: new Date().toLocaleDateString(),
    
    // Customer (required)
    customer_name, customer_email,
    
    // Pricing (required)
    grand_total: `$${total.toFixed(2)}`,
    
    // Sales Rep (required)
    sales_rep_name, sales_rep_email, sales_rep_phone: '253-922-5793',
    
    // Company (required)
    company_year: '1977',
    
    // Optional (always provide defaults)
    company_name: company || '',
    customer_phone: phone || '',
    project_name: project || '',
    notes: notes || 'No special notes'
};
```

## Common Calculation Patterns

### Standard Margin (60% margin)
```javascript
const markedUpPrice = basePrice / 0.6;
```

### LTM (Less Than Minimum) Fee
```javascript
if (quantity < 24) {
    const ltmFee = 50.00;
    const ltmPerUnit = ltmFee / quantity;
    finalPrice = basePrice + ltmPerUnit;
}
```

### Tiered Pricing
```javascript
function getPrice(quantity) {
    if (quantity < 24) return tiers['1-23'];
    if (quantity < 48) return tiers['24-47'];
    if (quantity < 72) return tiers['48-71'];
    return tiers['72+'];
}
```

## Success Modal Pattern (Required)
```javascript
showSuccessModal(quoteId, quoteData) {
    document.getElementById('modalQuoteId').textContent = quoteId;
    document.getElementById('modalCustomerName').textContent = quoteData.customerName;
    document.getElementById('modalTotalAmount').textContent = `$${quoteData.totalCost.toFixed(2)}`;
    
    // Store for print functionality
    this.lastQuoteData = quoteData;
    this.lastQuoteData.quoteId = quoteId;
    
    document.getElementById('successModal').classList.add('active');
}
```

## Active Calculator Registry

| Calculator | File | Prefix | Status |
|------------|------|--------|--------|
| DTG Contract | dtg-contract.html | DTG | ✅ |
| Richardson Caps | richardson-2025.html | RICH | ✅ |
| Embroidery Contract | embroidery-contract.html | EMB | ✅ |
| Customer Embroidery | embroidery-customer.html | EMBC | ✅ |
| Laser Tumblers | laser-tumbler-polarcamel.html | LT | ✅ |
| Embroidered Emblems | embroidered-emblem-calculator.html | PATCH | ✅ |
| Screen Print Customer | screenprint-customer.html | SPC | ✅ |
| Safety Stripe Creator | safety-stripe-creator.html | SSC | ✅ |
| Webstores | webstores.html | WEB | ✅ |

## Critical Implementation Rules

1. **Quote ID Format**: Always PREFIX+MMDD-sequence
2. **EmailJS Variables**: Provide ALL variables with defaults
3. **Database**: Use two-table structure (quote_sessions + quote_items)
4. **Success Display**: Always show Quote ID prominently
5. **Date Format**: Remove milliseconds for Caspio
6. **Script Tags**: Escape closing tags in template literals `<\/script>`
7. **Colors**: Use NWCA green (#4cb354), never teal

## Testing Checklist
- [ ] Calculator loads without errors
- [ ] Calculations correct
- [ ] Quote ID generates properly
- [ ] Email sends with all variables
- [ ] Database saves both tables
- [ ] Success modal shows Quote ID
- [ ] Print functionality works

## Common Pitfalls & Solutions

| Problem | Solution |
|---------|----------|
| EmailJS "corrupted variables" | Provide ALL variables with defaults |
| Database not saving | Check endpoint: `/api/quote_sessions` |
| Quote ID not showing | Add display element in success modal |
| Wrong template | Use template ID, not name |
| Script parsing error | Escape closing tags: `<\/script>` |

## Staff Directory
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

## Service vs Product Calculators
Service calculators (like webstores) differ:
- Display setup fees separately from requirements
- Use accordions for extensive information
- Link to customer info pages
- Show annual minimums as requirements, not costs

For complete examples, reference existing calculator implementations in `/calculators/`.