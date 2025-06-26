# Claude Assistant Guide for NWCA Pricing System

## Project Overview

This is the Northwest Custom Apparel (NWCA) pricing system, a complex web application that handles custom pricing for various decoration methods (embroidery, screen print, DTG, etc.) on apparel products.

## Key Concepts to Understand

### 1. Master Bundle Architecture
The system uses a "Master Bundle" pattern where:
- **Caspio DataPages** handle all calculations and return complete JSON data
- **Web pages** receive this data via postMessage and render the UI
- Each decoration type has its own API endpoint and pricing logic

### 2. Common Pitfalls

**The #1 Issue**: Component conflicts between UniversalPricingGrid and page-specific implementations
- Never load both on the same page
- Always check which system is being used before making changes

**The #2 Issue**: Missing HTML containers
- Always verify required containers exist before debugging "not found" errors
- Check the console for specific container IDs

### 3. File Organization

```
/shared_components/js/
├── universal-*.js          # Generic UI components
├── embroidery-*.js         # Embroidery-specific code
├── pricing-*.js            # Core pricing infrastructure
├── dp5-helper.js           # UI utilities and helpers
└── *-integration.js        # Master bundle integrations

/[page-name]-pricing.html   # Main page files
```

## Critical Information

### API Proxy URL
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
```

### Company Logo URL
```
https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1
```

### Namespace
All custom code should respect the `window.NWCA` namespace structure.

### Event Flow
1. Page loads → Caspio iframe loads
2. Caspio sends postMessage with master bundle
3. Integration script receives and transforms data
4. `pricingDataLoaded` event dispatched
5. UI components render the data

## Common Tasks

### Adding a New Decoration Type
1. Create Caspio DataPage using templates in PRICING_IMPLEMENTATION_GUIDE.md
2. Create integration script (e.g., `screenprint-master-bundle-integration.js`)
3. Create HTML page following embroidery-pricing.html pattern
4. Choose either UniversalPricingGrid OR custom implementation
5. Test with console.log(window.nwcaMasterBundleData)

### Debugging Pricing Issues
1. Check console for "container not found" errors
2. Verify master bundle data: `console.log(window.nwcaMasterBundleData)`
3. Check for component conflicts (multiple initializations)
4. Verify event flow in Network tab (postMessage)

### Modifying Pricing Logic
- **Simple changes**: Update the pricing-v3.js file
- **Complex changes**: May need to update Caspio DataPage calculations
- **Always test**: With different products, sizes, and quantities

## Code Patterns

### Checking for Master Bundle Data
```javascript
if (window.nwcaMasterBundleData) {
    // Data is available
    const pricing = window.nwcaMasterBundleData.pricing;
}
```

### Listening for Pricing Data
```javascript
document.addEventListener('pricingDataLoaded', function(event) {
    const data = event.detail;
    // Handle the data
});
```

### Container Pattern
```javascript
const container = document.getElementById('container-id');
if (!container) {
    console.error('[COMPONENT] Container not found');
    return;
}
```

## Testing Approach

1. **Unit Testing**: Use test HTML files (test-*.html) for isolated testing
2. **Console Testing**: Liberal use of console.log for debugging
3. **Data Validation**: Always check data structure matches expectations

## Style Guidelines

### Console Logging
Use prefixed logs for easy filtering:
```javascript
console.log('[COMPONENT-NAME] Message here');
```

### Error Handling
Always provide helpful error messages:
```javascript
if (!data) {
    console.error('[COMPONENT] No data provided. Expected structure: {...}');
    return;
}
```

### Comments
- Document WHY, not WHAT
- Include examples for complex data structures
- Mark TODO items clearly

## Integration Points

### With Caspio
- DataPages send data via postMessage
- Use specific event names: `caspio[TYPE]MasterBundleReady`

### With UI Components
- Transform data to match UI expectations
- Dispatch standardized events
- Store data in global variables for debugging

## Performance Considerations

1. **Caching**: API responses are cached in sessionStorage
2. **Event Debouncing**: Quantity changes are debounced
3. **Lazy Loading**: Components initialize only when needed

## Security Notes

- Never expose API keys in client-side code
- Use the proxy server for all API calls
- Validate all data from postMessage events

## Helpful Commands

### Git Workflow
```bash
git add -A
git commit -m "type: Description"
git push origin branch-name
```

### Common Commit Types
- `fix:` Bug fixes
- `feat:` New features
- `docs:` Documentation updates
- `refactor:` Code refactoring
- `test:` Test additions/updates

## Resources

- See `PRICING_IMPLEMENTATION_GUIDE.md` for detailed implementation steps
- Check test-*.html files for working examples
- Console logs are your friend - the system logs extensively

## Recently Discovered Issues (2025-01-20)

### Cap Pricing Implementation Issues (2025-01-20)
- **PROBLEM 1**: dp5-helper overwrites custom pricing tables when `pricingDataLoaded` event fires
  - **CAUSE**: dp5-helper listens to this event and rebuilds tables with `innerHTML = ''`
  - **SOLUTION**: Don't dispatch legacy `pricingDataLoaded` event from master bundle integrations
  - **ALTERNATIVE**: Set `window.directFixApplied = true` after creating table
  - **FILES AFFECTED**: `cap-master-bundle-integration.js` (removed event dispatch)
  
- **PROBLEM 2**: Table headers showing as white text on white background
  - **CAUSE**: CSS inheritance/specificity issues
  - **SOLUTION**: Force colors with `!important` in decoration-specific CSS
  - **EXAMPLE**: `.pricing-grid th { color: #586069 !important; }`
  
- **PROBLEM 3**: Console errors from shared scripts on specialized pages
  - **CAUSE**: Scripts looking for functions/elements that don't exist on pricing pages
  - **SOLUTION**: Add page-specific checks before initialization
  - **EXAMPLE**: 
    ```javascript
    if (window.location.pathname.includes('cap-embroidery')) {
        console.log('Skipping - page handles its own parameters');
        return;
    }
    ```

### Master Bundle Integration Best Practices
- **PATTERN**: Follow `cap-master-bundle-integration.js` as template
- **DATA FLOW**: Caspio iframe → postMessage → integration script → custom event → UI component
- **EVENT NAMING**: Use specific events like `capMasterBundleLoaded` not generic `pricingDataLoaded`
- **DEBUGGING**: Store data globally: `window.nwca[Type]MasterBundleData`
- **TABLE STRUCTURE**: 
  - Use single-row headers for CSS compatibility
  - Match embroidery table HTML structure exactly
  - Avoid IDs that dp5-helper searches for (`pricing-grid-container-table`)
- **CSS REQUIREMENTS**:
  - Always include `modern-pricing-table.css` first
  - Add decoration-specific CSS after (e.g., `screenprint-pricing-enhancements.css`)
  - Use green theme consistently (#3a7c52)

### Pricing Table Width Issues with Many Sizes
- **PROBLEM**: Tables with 9 size columns (S-6XL) get cramped and hard to read
- **SOLUTION**: Created `modern-pricing-table.css` with:
  - Responsive wrapper with horizontal scroll
  - Minimum column widths (80px) 
  - Card-based mobile layout
  - Sticky first column on tablet
- **REMOVED**: "POPULAR" and "BEST VALUE" badges (unnecessary clutter)
- **FILE**: `/shared_components/css/modern-pricing-table.css`

### Double Header and Layout Issues
- **PROBLEM**: Two headers (universal + enhanced), misaligned columns, excessive spacing
- **SOLUTION**: Created `embroidery-layout-fix.css` with:
  - Hide duplicate universal-header-container
  - Reduce body padding from 200px to 140px
  - CSS Grid for perfect column alignment
  - Professional card design for both columns
  - Optimized spacing throughout
- **IMPACT**: 30% header height reduction, perfect alignment, cleaner layout
- **FILE**: `/shared_components/css/embroidery-layout-fix.css`

### Caspio Authentication and Personalization (2025-01-26)
- **PROBLEM**: Displaying authenticated user's first name from Caspio DataPage
- **DISCOVERY**: Caspio outputs user data in `<dd class="cbResultSetData">Erik</dd>` elements
- **AUTHENTICATION DIFFERENCES**:
  - **Localhost**: Authentication cookies don't work due to cross-origin restrictions
  - **Production (Heroku)**: Works perfectly with proper domain and HTTPS
- **SOLUTION**: 
  ```javascript
  // Wait for Caspio to load with retry mechanism
  const caspioData = document.querySelector('.cbResultSetData');
  const firstName = caspioData?.textContent?.trim() || 'Team Member';
  ```
- **IMPLEMENTATION**: 
  - Added retry mechanism (checks every 500ms up to 10 times)
  - Personalized greetings: "Good morning/afternoon/evening, [Name]!"
  - Graceful fallback when not authenticated
- **FILES AFFECTED**: `staff-dashboard.html`
- **KEY LEARNING**: Always test authentication features on production, not just localhost

## Quote System Implementation Guide (2025-01-26)

### Overview
This guide documents how to implement quote functionality with EmailJS and Caspio database integration. This pattern is used across all calculator types (DTG, Embroidery, Screen Print, etc.).

### 1. EmailJS Template Setup

#### A. Create Template in EmailJS Dashboard
1. Log into EmailJS.com
2. Go to Email Templates → Create New Template
3. Set up template variables and HTML structure

#### B. Required Template Variables
```
{{to_email}}         - Customer's email address
{{from_name}}        - Sales rep name (sender)
{{reply_to}}         - Reply-to email address
{{cc_email}}         - CC recipients (optional)
{{customer_name}}    - Customer's full name
{{company_name}}     - Company name
{{customer_phone}}   - Phone number
{{quote_id}}         - Unique quote identifier
{{decoration_method}} - Type of decoration/service
{{products_html}}    - HTML table with pricing details
{{notes}}            - Additional notes/instructions
```

#### C. EmailJS Configuration Settings
- **To Email**: `{{to_email}}`
- **From Name**: `{{from_name}}`
- **From Email**: Use Default Email Address ✓
- **Reply To**: `{{reply_to}}`
- **CC**: `{{cc_email}}`
- **Subject**: `Contract DTG Quote {{quote_id}} - {{customer_name}}`

#### D. HTML Email Template Structure
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background-color: #2f661e; padding: 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .info-section { background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        /* Add more styles as needed */
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>NORTHWEST CUSTOM APPAREL</h1>
            <p>Quote - {{quote_id}}</p>
        </div>
        <div class="content">
            <!-- Customer info section -->
            <!-- Pricing table: {{{products_html}}} -->
            <!-- Contact information -->
        </div>
    </div>
</body>
</html>
```

### 2. Caspio Database Structure

#### A. Quote Sessions Table (quote_sessions)
Stores main quote information:
```
QuoteID         - STRING (Primary Key) - Format: DTG0126-1, EMB0126-2, etc.
SessionID       - STRING - Unique session identifier
CustomerEmail   - STRING - Customer's email
CustomerName    - STRING - Customer name
CompanyName     - STRING - Company name (optional)
Phone           - STRING - Phone number (optional)
TotalQuantity   - NUMBER - Total items quantity
SubtotalAmount  - NUMBER - Subtotal before fees
LTMFeeTotal     - NUMBER - Less Than Minimum fees
TotalAmount     - NUMBER - Grand total
Status          - STRING - Quote status (Open/Closed)
ExpiresAt       - DATETIME - Expiration date (30 days)
Notes           - TEXT - Additional notes
CreatedAt       - DATETIME - Creation timestamp
```

#### B. Quote Items Table (quote_items)
Stores individual line items:
```
QuoteID             - STRING (Foreign Key) - Links to quote_sessions
LineNumber          - NUMBER - Sequential line number
StyleNumber         - STRING - Product style or "CUSTOMER-SUPPLIED"
ProductName         - STRING - Product/service name
Color               - STRING - Color or garment type
ColorCode           - STRING - Color code (optional)
EmbellishmentType   - STRING - dtg/embroidery/screenprint
PrintLocation       - STRING - Location(s) for decoration
PrintLocationName   - STRING - Human-readable location
Quantity            - NUMBER - Item quantity
HasLTM              - STRING - "Yes"/"No"
BaseUnitPrice       - NUMBER - Price per item
LTMPerUnit          - NUMBER - LTM fee per unit
FinalUnitPrice      - NUMBER - Final price per item
LineTotal           - NUMBER - Total for line
SizeBreakdown       - STRING - JSON with size distribution
PricingTier         - STRING - "1-23", "24-47", etc.
ImageURL            - STRING - Product image (optional)
AddedAt             - DATETIME - Timestamp
```

### 3. API Configuration

#### A. Proxy Server Endpoint
```
Base URL: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
```

#### B. API Endpoints
```
POST /api/quote_sessions - Create new quote session
POST /api/quote_items    - Add items to quote
GET  /api/quote_sessions?quoteID={id} - Retrieve quote session
GET  /api/quote_items?quoteID={id}    - Retrieve quote items
```

### 4. Implementation Pattern

#### A. Quote Service Template
Create a service file for each calculator type:
```javascript
class [Type]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Use specific prefix for each type: DTG, EMB, SP, etc.
        const storageKey = `[type]_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        return `[PREFIX]${dateKey}-${sequence}`;
    }

    async saveQuote(quoteData) {
        // 1. Create session
        // 2. Add items
        // 3. Return result
    }
}
```

#### B. Integration with Calculator
```javascript
// In calculator class
constructor() {
    this.quoteService = new [Type]QuoteService();
    this.emailConfig = {
        publicKey: '4qSbDO-SQs19TbP80',
        serviceId: 'service_1c4k67j',
        templateId: 'template_[specific_id]'
    };
}

async handleQuoteSubmit(e) {
    // 1. Validate form
    // 2. Save to database (if checkbox checked)
    // 3. Send email
    // 4. Show success message
}
```

#### C. Modal Form Structure
```html
<div class="modal-backdrop" id="quoteModal">
    <div class="modal">
        <form id="quoteForm">
            <!-- Customer info fields -->
            <input type="text" id="customerName" required>
            <input type="email" id="customerEmail" required>
            
            <!-- Quote preview -->
            <div class="quote-preview" id="quotePreview"></div>
            
            <!-- Save option -->
            <label>
                <input type="checkbox" id="saveToDatabase" checked>
                Save quote to database
            </label>
            
            <!-- Submit buttons -->
            <button type="submit">Send Quote</button>
        </form>
    </div>
</div>
```

### 5. Quote ID Patterns

Different prefixes for different calculator types:
- **DTG**: `DTG{MMDD}-{sequence}` (e.g., DTG0126-1)
- **Embroidery**: `EMB{MMDD}-{sequence}`
- **Screen Print**: `SP{MMDD}-{sequence}`
- **Product Quotes**: `Q{MMDD}-{sequence}`

### 6. Error Handling

Always implement graceful error handling:
```javascript
try {
    const saveResult = await this.quoteService.saveQuote(data);
    if (!saveResult.success) {
        console.error('Save failed:', saveResult.error);
        // Continue with email send
    }
} catch (error) {
    console.error('Error:', error);
    // Show user-friendly message
}
```

### 7. Testing Checklist

- [ ] EmailJS template created and configured
- [ ] Template variables match code implementation
- [ ] Quote saves to both database tables
- [ ] Quote ID generates correctly
- [ ] Email sends with proper formatting
- [ ] Success/error messages display
- [ ] Form validation works
- [ ] Database checkbox functions
- [ ] Reply-to email set correctly
- [ ] CC recipients receive email

### 8. Common Issues and Solutions

1. **CORS Errors**: Ensure proxy server is running and accessible
2. **Missing Fields**: Check that all required Caspio fields are included
3. **Date Formatting**: Use ISO format for Caspio: `date.toISOString().replace(/\.\d{3}Z$/, '')`
4. **Quote ID Conflicts**: Each calculator type needs unique prefix and storage key
5. **Email Not Sending**: Verify EmailJS service limits and template ID

## Calculator Template System (2025-01-27)

### Overview
Created a reusable template system to streamline adding new pricing calculators. New calculators can now be implemented in 30-60 minutes instead of hours.

### Template Files Created

1. **`/templates/calculator-template.html`**
   - Base HTML structure with placeholders
   - Standard UI components and styling
   - EmailJS integration ready
   - Responsive design included

2. **`/templates/quote-service-template.js`**
   - Database integration boilerplate
   - Quote ID generation pattern
   - Standard save/retrieve methods
   - Configurable for single or multi-item quotes

3. **`/templates/calculator-config-template.json`**
   - Configuration structure for new calculators
   - All placeholder values documented
   - Pricing logic patterns

4. **`/templates/email-template.html`**
   - Professional email layout
   - Works for both single and multi-item quotes
   - All standard variables documented

5. **`/templates/NEW_CALCULATOR_CHECKLIST.md`**
   - Step-by-step implementation guide
   - Time estimates for each step
   - Common issues and solutions
   - Testing checklist

### How to Use the Template System

1. **Start with the checklist**: Open `/templates/NEW_CALCULATOR_CHECKLIST.md`
2. **Copy templates** to your working directory
3. **Replace placeholders** using the configuration file as a guide
4. **Implement calculator-specific logic**
5. **Test thoroughly** using the checklist
6. **Document** in this file

### Key Patterns

#### Quote ID Format
```
{{PREFIX}}{{MMDD}}-{{sequence}}
Examples: DTG0126-1, RICH0126-2, EMB0126-3
```

#### Standard Margin Calculation
```javascript
const markedUpPrice = basePrice / 0.6;
```

#### LTM (Less Than Minimum) Pattern
```javascript
if (quantity < 24) {
    ltmFee = 50.00;
    ltmPerUnit = ltmFee / quantity;
    finalPrice = basePrice + ltmPerUnit;
}
```

### Benefits of Template System
- **Consistency**: All calculators follow the same patterns
- **Speed**: 30-60 minute implementation time
- **Maintainability**: Updates to templates benefit all calculators
- **Fewer Bugs**: Proven patterns reduce errors
- **Easy Onboarding**: New developers can quickly add calculators

### Quick Implementation Example

For a new "Screen Print" calculator:
1. Copy templates to `/calculators/`
2. Configure:
   - Name: "Screen Print"
   - Prefix: "SP"
   - Type: "screenprint"
   - Icon: "fa-print"
3. Replace all placeholders
4. Add pricing logic for color counts
5. Create EmailJS template
6. Add to dashboard
7. Test and deploy

Total time: ~45 minutes

## Richardson Calculator Implementation (2025-01-27)

### Overview
Created a modernized Richardson cap pricing calculator with multi-style quote building, following the same patterns as the DTG calculator.

### Key Features
1. **Multi-Style Quote Builder**
   - Autocomplete style selection from 100+ Richardson cap styles
   - Dynamic add/remove line items
   - Real-time pricing calculations

2. **Pricing Logic**
   - 60% margin calculation (price / 0.6)
   - Embroidery tier pricing based on total quantity
   - LTM surcharge ($50 for orders under 24 pieces)

3. **Database Integration**
   - Quote ID format: `RICH{MMDD}-{sequence}`
   - Saves to quote_sessions and quote_items tables
   - Stores cap details in SizeBreakdown field

4. **EmailJS Integration**
   - Uses same template as DTG (template_ug8o3ug)
   - Ruthie Nhoung as default sender
   - Professional multi-item quote format

### Files Created
- `/calculators/richardson-2025.html` - Main calculator page
- `/calculators/richardson-quote-service.js` - Quote service for database
- `/calculators/test-richardson.html` - Test suite

### Implementation Notes
1. **Cap Data**: Maintained all 100+ Richardson styles with accurate pricing
2. **Embroidery Tiers**: 
   - 5,000 stitches: $9.75-$6.75
   - 8,000 stitches: $12.00-$8.50
   - 10,000 stitches: $13.50-$11.00
3. **Quote Structure**: Supports multiple line items in single quote
4. **Print Support**: Generates clean print-friendly quotes

### Usage
1. Navigate to `/calculators/richardson-2025.html`
2. Enter customer and project names
3. Select embroidery stitch count
4. Add cap styles using autocomplete
5. Enter quantities
6. Calculate quote
7. Send via email with optional database save

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

### 3. EmailJS Template Variable Best Practices

**Problem**: "One or more dynamic variables are corrupted" error in EmailJS.

**Common Causes & Solutions**:

1. **Conditional Logic Issues**:
   - **AVOID**: `{{#if personal_message}}...{{/if}}` - Can cause corruption with empty/undefined values
   - **USE**: Direct variable placement `{{personal_message}}` - Shows nothing if empty
   
2. **Undefined Variables**:
   ```javascript
   // Always ensure variables have a value (even empty string)
   const emailData = {
       personal_message: personalMessage || '',  // Never undefined
       optional_field: optionalValue || ''
   };
   ```

3. **Template ID vs Template Name**:
   - Template Name: What you call it (e.g., "Buyer Guide 2025")
   - Template ID: What EmailJS uses (e.g., "template_wna04vr")
   - Always use the Template ID in code, found at: https://dashboard.emailjs.com/admin/templates

4. **Variable Naming**:
   - Use consistent snake_case or camelCase
   - Avoid special characters in variable names
   - Match exactly between template and code

**Debugging Template Issues**:
```javascript
// Always log data before sending
console.log('Sending email with data:', emailData);

// Better error handling
try {
    await emailjs.send(serviceId, templateId, emailData);
} catch (error) {
    console.error('EmailJS Error:', error);
    console.error('Template ID:', templateId);
    console.error('Data sent:', emailData);
}
```

### 4. Grammar and Formatting Standards

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

### 5. Contact Information Standards

**Phone Number**: Always use **253-922-5793**
- Format: XXX-XXX-XXXX (with hyphens)
- Consistent across all templates and calculators
- Update any instances of old numbers

### 6. Sales Rep Integration

**Pattern for Contract Calculators**:
```javascript
// Sales rep dropdown with default
<select id="salesRep" required>
    <option value="">Select a sales rep...</option>
    <option value="ruthie@nwcustomapparel.com" selected>Ruthie</option>
    <option value="taylar@nwcustomapparel.com">Taylar</option>
    <option value="nika@nwcustomapparel.com">Nika</option>
    <option value="erik@nwcustomapparel.com">Erik</option>
    <option value="adriyella@nwcustomapparel.com">Adriyella</option>
    <option value="sales@nwcustomapparel.com">General Sales</option>
</select>

// Map emails to display names
const salesRepNames = {
    'ruthie@nwcustomapparel.com': 'Ruthie',
    'taylar@nwcustomapparel.com': 'Taylar',
    // etc.
};
```

### 7. Print Functionality

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

### 8. Theme Colors by Service Type

**Consistent Color Coding**:
- **DTG**: Green theme (#3a7c52)
- **Embroidery**: Slate blue (#4A5568)
- **Screen Print**: Orange theme (TBD)
- **Richardson**: Green theme (#3a7c52)

### 9. Error Prevention

**Common Issues to Avoid**:
1. **Missing HTML escaping**: Always escape user input in HTML
2. **Incorrect date formats**: Use `toISOString()` for Caspio
3. **Missing required fields**: Validate before submission
4. **Cross-origin issues**: Test auth features on production

### 10. Testing Checklist for Contract Calculators

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

## Final Tips

1. **Read the console logs** - They tell you exactly what's happening
2. **Check for existing patterns** - This codebase follows consistent patterns
3. **Test incrementally** - Make small changes and test
4. **Document your changes** - Future developers (and AIs) will thank you
5. **When in doubt, check window.nwcaMasterBundleData** - It's the source of truth

Remember: The most common issues are component conflicts and missing containers. Always check these first!