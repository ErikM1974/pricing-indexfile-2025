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

## EmailJS Template Best Practices (2025-01-27)

### 1. Always Ask for Template ID
**IMPORTANT**: Never assume template names. Always ask for the specific template ID.
- Template names are what users see (e.g., "Laser_Tumbler_Template")
- Template IDs are what EmailJS uses (e.g., "template_6bie1il")
- Find template IDs at: https://dashboard.emailjs.com/admin/templates

### 2. Staff Email Directory
Complete list of NWCA staff emails for sales rep dropdowns:
```javascript
const salesRepEmails = {
    'erik@nwcustomapparel.com': 'Erik',
    'nika@nwcustomapparel.com': 'Nika',
    'taylar@nwcustomapparel.com': 'Taylar',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'ruth@nwcustomapparel.com': 'Ruth Nhong',
    'bradley@nwcustomapparel.com': 'Bradley',
    'jim@nwcustomapparel.com': 'Jim',
    'art@nwcustomapparel.com': 'Steve (Artist)',
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
};
```

### 3. Email Routing Best Practices
Standard EmailJS configuration for quote systems:
```
To Email: {{to_email}}           // Customer's email
From Name: {{from_name}}         // "Northwest Custom Apparel"
From Email: Use Default          // Your EmailJS sender
Reply To: {{reply_to}}           // Sales rep's email
CC: {{reply_to}}                 // Sales rep gets a copy
BCC: erik@nwcustomapparel.com   // Erik always gets a copy
```

This ensures:
- Customer receives the quote
- Sales rep gets a copy (visible in CC)
- Erik tracks all quotes (hidden in BCC)
- Customer replies go to the sales rep

### 4. Notes Field Implementation
Always include a notes field in quote forms:
```javascript
// In email data
const emailData = {
    // ... other fields
    notes: this.notesTextarea.value || 'No special notes for this order',
    // ... other fields
};
```

In EmailJS template, always show notes section:
```html
<div class="notes-section">
    <h4>Notes:</h4>
    <p>{{notes}}</p>
</div>
```

### 5. Required Template Variables
Standard variables for all quote templates:
- `{{to_email}}` - Customer's email
- `{{from_name}}` - Always "Northwest Custom Apparel"
- `{{reply_to}}` - Sales rep's email
- `{{customer_name}}` - Customer name
- `{{project_name}}` - Project/order name
- `{{quote_id}}` - Unique identifier
- `{{quote_date}}` - Current date
- `{{notes}}` - Special instructions
- `{{sales_rep_name}}` - Rep's display name
- `{{sales_rep_email}}` - Rep's email
- `{{sales_rep_phone}}` - Always "253-922-5793"
- `{{company_year}}` - Always "1977"

### 6. Common EmailJS Errors and Solutions

#### "Template not found"
- **Cause**: Using template name instead of ID
- **Solution**: Use the template ID (e.g., "template_6bie1il")

#### "One or more dynamic variables are corrupted"
- **Cause**: Undefined variables or conditional logic issues
- **Solution**: Ensure all variables have values (use `|| ''`)

#### "Service not found"
- **Cause**: Wrong service ID
- **Solution**: Use 'service_1c4k67j' for NWCA

### 7. Testing Email Templates
Always test with:
1. All fields filled
2. Optional fields empty
3. Special characters in names/notes
4. Different sales reps selected
5. Verify CC and BCC recipients

## EmailJS Anti-Corruption Guide (2025-01-27)

### Overview
This guide prevents the dreaded "One or more dynamic variables are corrupted" error that can occur with EmailJS templates.

### 1. Never Use Placeholder Variables
**THE #1 CAUSE OF CORRUPTION**: Using placeholder text like `{{QUOTE_TYPE}}` in templates.

**❌ BAD - Causes Corruption**:
```html
<h1>{{QUOTE_TYPE}} Quote</h1>  <!-- NEVER DO THIS -->
```

**✅ GOOD - Works Correctly**:
```html
<h1>{{quote_type}} Quote</h1>  <!-- Actual variable -->
```

**Why?** EmailJS expects every `{{variable}}` to exist in your data object. Placeholder text that's meant to be replaced will cause corruption.

### 2. Always Provide ALL Variables
Every variable referenced in your template MUST exist in the data object:

```javascript
// ✅ CORRECT - All variables provided
const emailData = {
    // Required fields
    to_email: customerEmail,
    customer_name: customerName,
    quote_type: 'Laser Tumbler',  // NOT a placeholder!
    quote_id: 'LT0127-1',
    quote_date: new Date().toLocaleDateString(),
    grand_total: '$450.00',
    sales_rep_name: 'Ruth Nhong',
    sales_rep_email: 'ruth@nwcustomapparel.com',
    sales_rep_phone: '253-922-5793',
    company_year: '1977',
    
    // Optional fields - ALWAYS provide with defaults
    special_note: specialNote || '',
    notes: customerNotes || 'No special notes for this order',
    project_name: projectName || '',
    quote_summary: summary || ''
};

// ❌ WRONG - Missing/undefined variables
const emailData = {
    to_email: customerEmail,
    customer_name: customerName,
    // Missing quote_type will cause corruption!
    // undefined special_note will cause corruption!
};
```

### 3. Pre-Send Validation Checklist
Always validate before sending:

```javascript
// Required variables checklist
const requiredVars = [
    'to_email', 'reply_to', 'customer_name', 'quote_id', 
    'quote_date', 'quote_type', 'grand_total', 'sales_rep_name', 
    'sales_rep_email', 'sales_rep_phone', 'company_year'
];

// Optional variables that should have defaults
const optionalVars = {
    'special_note': '',
    'notes': 'No special notes for this order',
    'project_name': '',
    'quote_summary': '',
    'from_name': 'Northwest Custom Apparel'
};

// Validate required variables
const missingVars = [];
requiredVars.forEach(varName => {
    if (!emailData[varName]) {
        missingVars.push(varName);
    }
});

if (missingVars.length > 0) {
    console.error('Missing required variables:', missingVars);
    throw new Error(`Missing required email variables: ${missingVars.join(', ')}`);
}

// Apply defaults for optional variables
Object.keys(optionalVars).forEach(varName => {
    if (emailData[varName] === undefined || emailData[varName] === null) {
        emailData[varName] = optionalVars[varName];
    }
});

// Log for debugging
console.log('Email data validated:', emailData);
```

### 4. Common Corruption Triggers to Avoid

#### ❌ Undefined or Null Values
```javascript
// WRONG
emailData.notes = undefined;  // Causes corruption
emailData.special_note = null;  // Causes corruption

// CORRECT
emailData.notes = notesValue || '';
emailData.special_note = specialNote || '';
```

#### ❌ Conditional Logic in Templates
```html
<!-- AVOID in EmailJS templates -->
{{#if personal_message}}
    <p>{{personal_message}}</p>
{{/if}}

<!-- USE THIS INSTEAD -->
<p>{{personal_message}}</p>  <!-- Just shows nothing if empty -->
```

#### ❌ Case Sensitivity Mistakes
```javascript
// Template has: {{customer_name}}
emailData.Customer_Name = 'John';  // WRONG - case mismatch
emailData.customer_name = 'John';  // CORRECT
```

#### ❌ Special Characters in Variable Names
```javascript
// WRONG
emailData['customer-name'] = 'John';  // Hyphen not allowed
emailData['customer.name'] = 'John';  // Dot not allowed

// CORRECT
emailData.customer_name = 'John';  // Use underscores
```

### 5. Implementation Template
Use this template for all EmailJS implementations:

```javascript
async function sendQuoteEmail(quoteData) {
    try {
        // Build email data with ALL required fields
        const emailData = {
            // System fields
            to_email: quoteData.customerEmail,
            reply_to: quoteData.salesRepEmail,
            from_name: 'Northwest Custom Apparel',
            
            // Quote identification
            quote_type: 'Your Calculator Name Here',  // NEVER use {{PLACEHOLDER}}
            quote_id: quoteData.quoteId,
            quote_date: new Date().toLocaleDateString(),
            
            // Customer info
            customer_name: quoteData.customerName,
            project_name: quoteData.projectName || '',
            
            // Pricing
            grand_total: `$${quoteData.total.toFixed(2)}`,
            
            // Optional fields with defaults
            special_note: quoteData.specialNote || '',
            notes: quoteData.notes || 'No special notes for this order',
            quote_summary: quoteData.summary || '',
            
            // Sales rep info
            sales_rep_name: quoteData.salesRepName,
            sales_rep_email: quoteData.salesRepEmail,
            sales_rep_phone: '253-922-5793',
            
            // Company info
            company_year: '1977'
        };
        
        // Validate before sending
        console.log('Sending email with data:', emailData);
        
        // Send email
        const response = await emailjs.send(
            'service_1c4k67j',
            'template_xxxxxx',  // Your actual template ID
            emailData
        );
        
        console.log('Email sent successfully:', response);
        return { success: true };
        
    } catch (error) {
        console.error('EmailJS Error:', error);
        console.error('Failed email data:', emailData);
        return { 
            success: false, 
            error: error.message || 'Failed to send email' 
        };
    }
}
```

### 6. Debugging Corruption Errors

When you get "One or more dynamic variables are corrupted":

1. **Check the console** for the exact data being sent
2. **Compare** template variables with your data object
3. **Look for**:
   - Undefined/null values
   - Missing required variables
   - Case mismatches
   - Placeholder text like {{VARIABLE_NAME}}

```javascript
// Debug helper
function debugEmailData(emailData, templateVars) {
    console.group('EmailJS Debug');
    
    // Check for undefined/null
    Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined || emailData[key] === null) {
            console.error(`❌ ${key} is ${emailData[key]}`);
        }
    });
    
    // Check for missing template vars
    templateVars.forEach(varName => {
        if (!(varName in emailData)) {
            console.error(`❌ Missing template variable: ${varName}`);
        }
    });
    
    console.log('📧 Email data:', emailData);
    console.groupEnd();
}
```

### 7. Quick Reference - Variable Requirements

| Variable | Required | Default Value | Notes |
|----------|----------|---------------|-------|
| to_email | ✅ | - | Customer's email |
| reply_to | ✅ | - | Sales rep email |
| quote_type | ✅ | - | e.g., "Laser Tumbler" |
| quote_id | ✅ | - | e.g., "LT0127-1" |
| customer_name | ✅ | - | Customer's full name |
| grand_total | ✅ | - | Formatted total |
| sales_rep_name | ✅ | - | Rep's display name |
| sales_rep_email | ✅ | - | Rep's email |
| sales_rep_phone | ✅ | - | "253-922-5793" |
| company_year | ✅ | - | "1977" |
| from_name | ✅ | "Northwest Custom Apparel" | Sender name |
| quote_date | ✅ | - | Current date |
| special_note | ❌ | "" | Optional note |
| notes | ❌ | "No special notes..." | Customer notes |
| project_name | ❌ | "" | Project description |
| quote_summary | ❌ | "" | Brief summary |

### 8. Testing Procedure

Before going live, test these scenarios:

1. **Full data test** - All fields populated
2. **Minimal data test** - Only required fields
3. **Empty optional fields** - Ensure defaults work
4. **Special characters** - Test quotes, apostrophes in names
5. **Console validation** - Check all data before sending

Remember: The key to avoiding corruption is **consistency** - every variable in your template must exist in your data object with a valid value (never undefined or null).

## Complete Calculator Implementation Workflow (2025-01-27)

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

### Phase 3: Database Integration (20 minutes)

#### 3.1 Quote Service Implementation
**CRITICAL**: Always use the two-table structure!

```javascript
class [Name]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }
    
    generateQuoteID() {
        // MUST follow pattern: PREFIX + MMDD + sequence
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        const storageKey = `[prefix]_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        return `[PREFIX]${dateKey}-${sequence}`;
    }
}
```

#### 3.2 Required Database Fields
**quote_sessions table:**
- QuoteID (PRIMARY KEY)
- SessionID
- CustomerEmail
- CustomerName
- CompanyName
- Phone
- TotalQuantity
- SubtotalAmount
- LTMFeeTotal
- TotalAmount
- Status
- ExpiresAt
- Notes

**quote_items table:**
- QuoteID (FOREIGN KEY)
- LineNumber
- StyleNumber
- ProductName
- Color
- EmbellishmentType
- Quantity
- FinalUnitPrice
- LineTotal

### Phase 4: EmailJS Setup (15 minutes)

#### 4.1 If User Has Template
1. **GET THE TEMPLATE ID** - Not the name!
2. Update code with actual template ID
3. Verify all required variables are provided

#### 4.2 If Creating New Template
Provide this HTML structure:
```html
<!-- See /templates/email-template.html for base structure -->
<!-- CRITICAL: Include ALL required variables -->
```

#### 4.3 Required Email Variables
**Every calculator MUST provide these:**
```javascript
const emailData = {
    // REQUIRED - System
    to_email: customerEmail,
    reply_to: salesRepEmail,
    from_name: 'Northwest Custom Apparel',
    
    // REQUIRED - Quote Info
    quote_type: '[Calculator Name]',  // NOT A PLACEHOLDER!
    quote_id: quoteID,
    quote_date: new Date().toLocaleDateString(),
    
    // REQUIRED - Customer
    customer_name: customerName,
    project_name: projectName || '',
    
    // REQUIRED - Pricing
    grand_total: `$${total.toFixed(2)}`,
    
    // REQUIRED - Sales Rep
    sales_rep_name: repName,
    sales_rep_email: repEmail,
    sales_rep_phone: '253-922-5793',
    
    // REQUIRED - Company
    company_year: '1977',
    
    // OPTIONAL with defaults
    special_note: note || '',
    notes: customerNotes || 'No special notes for this order',
    quote_summary: summary || ''
};
```

### Phase 5: Dashboard Integration (5 minutes)

#### 5.1 Add Calculator Card
Find the correct section in staff-dashboard.html:
```html
<a href="/calculators/[name]-calculator.html" class="calculator-card"
   title="[Description]. Contact: [Person]">
    <i class="fas fa-[icon] calculator-icon"></i>
    <span class="calculator-name">[Display Name]</span>
    <span class="new-badge">NEW 2025</span>
</a>
```

#### 5.2 Update Navigation
Ensure breadcrumb links work correctly.

### Phase 6: Testing Protocol (15 minutes)

#### 6.1 Console Testing Commands
Open browser console and run these tests IN ORDER:

```javascript
// Test 1: Check initialization
console.log(window.[name]Calculator);

// Test 2: Check quote service
console.log(window.[name]Calculator.quoteService);

// Test 3: Generate test quote ID
console.log(window.[name]Calculator.quoteService.generateQuoteID());

// Test 4: Check current quote after calculation
console.log(window.[name]Calculator.currentQuote);
```

#### 6.2 Functional Testing Checklist
- [ ] Calculator loads without console errors
- [ ] Form validation prevents invalid input
- [ ] Calculations match expected values
- [ ] Results display with correct formatting
- [ ] Email modal opens and closes properly
- [ ] Sales rep dropdown shows all staff
- [ ] Quote preview shows correct data
- [ ] **Quote ID displays in success message**
- [ ] Email sends successfully
- [ ] Database save works (check console)
- [ ] Print function generates clean PDF

#### 6.3 EmailJS Testing
1. Send test email to yourself
2. Verify all variables render correctly
3. Check no placeholder text appears
4. Confirm CC and BCC recipients

#### 6.4 Database Verification
```javascript
// After saving, check console for:
"[Service] Quote saved successfully: [PREFIX]0127-1"
```

### Phase 7: Common Pitfalls & Solutions

#### 7.1 EmailJS Corruption
**Problem**: "One or more dynamic variables are corrupted"
**Causes & Fixes**:
1. Missing `quote_type` variable → Always include it
2. Undefined variables → Use `|| ''` for optional fields
3. Wrong template ID → Use ID, not name
4. Placeholder text → Never use {{PLACEHOLDER}}

#### 7.2 Database Not Saving
**Problem**: Quotes not appearing in Caspio
**Causes & Fixes**:
1. Wrong endpoint → Use `/api/quote_sessions` not custom tables
2. Missing fields → Check all required fields are provided
3. Data type mismatch → Numbers must be parsed: `parseFloat()`
4. Date format → Use ISO format with fix: `.replace(/\.\d{3}Z$/, '')`

#### 7.3 Quote ID Not Showing
**Problem**: Users don't see their quote ID
**Fix**: Always display in success message:
```javascript
const quoteIdDisplay = document.getElementById('quoteIdDisplay');
if (quoteIdDisplay) {
    quoteIdDisplay.textContent = `Quote ID: ${quoteId}`;
}
```

#### 7.4 Wrong Table Structure
**Problem**: Trying to use single table instead of two
**Fix**: Always use quote_sessions + quote_items pattern

### Implementation Checklist Summary

#### Before Starting
- [ ] Gathered ALL required information
- [ ] Have EmailJS template ID (if existing)
- [ ] Understand pricing logic completely
- [ ] Know which dashboard section

#### During Development
- [ ] Using standard file structure
- [ ] Following naming conventions
- [ ] Including all required scripts
- [ ] Implementing two-table database pattern
- [ ] Providing ALL email variables

#### Before Going Live
- [ ] All console tests pass
- [ ] Email sends correctly
- [ ] Database saves properly
- [ ] Quote ID displays to user
- [ ] No placeholder text anywhere
- [ ] Documentation updated

### Quick Command Reference

#### Git Workflow
```bash
git add -A
git commit -m "feat: Add [name] calculator with quote system"
git push origin [branch]
```

#### Common Console Commands
```javascript
// Check quote data
console.log(window.nwcaMasterBundleData);

// Check current quote
console.log(window.[name]Calculator.currentQuote);

// Test quote ID generation
console.log(new [Name]QuoteService().generateQuoteID());

// Check email data before send
console.log('Email data:', emailData);
```

### Final Reminders

1. **ALWAYS ASK FOR TEMPLATE ID** - Not the template name
2. **ALWAYS USE TWO-TABLE STRUCTURE** - quote_sessions + quote_items
3. **ALWAYS SHOW QUOTE ID** - Users need to see it
4. **ALWAYS PROVIDE ALL VARIABLES** - No undefined/null values
5. **ALWAYS TEST IN CONSOLE** - Before declaring complete

Following this workflow will prevent 99% of implementation issues!

## Active Calculators Registry

Track all implemented calculators here for reference:

### DTG Contract (DTG)
- **File**: /calculators/dtg-contract.html
- **Added**: 2025-01-26
- **Contact**: Taylar
- **EmailJS Template**: template_ug8o3ug
- **Quote Format**: DTG{MMDD}-{sequence}
- **Database**: quote_sessions + quote_items

### Richardson Caps (RICH)
- **File**: /calculators/richardson-2025.html
- **Added**: 2025-01-27
- **Updated**: 2025-01-27 - Added leatherette patch option
- **Contact**: Vendor pricing
- **EmailJS Template**: template_ug8o3ug (Richardson_Template)
- **Quote Format**: RICH{MMDD}-{sequence}
- **Database**: quote_sessions + quote_items
- **Special Features**: 
  - Dual embellishment type (Embroidery or Leatherette Patch)
  - Pricing reference table below calculator
  - Stitch count selector only shows for embroidery

### Contract Embroidery (EMB)
- **File**: /calculators/embroidery-contract.html
- **Added**: 2025-01-27
- **Contact**: Ruth Nhong
- **EmailJS Template**: template_wna04vr (Buyer's Guide)
- **Quote Format**: EMB{MMDD}-{sequence}
- **Database**: quote_sessions + quote_items

### Laser Tumbler Polar Camel (LT)
- **File**: /calculators/laser-tumbler-polarcamel.html
- **Added**: 2025-01-27
- **Contact**: Sales Team
- **EmailJS Template**: template_6bie1il
- **Quote Format**: LT{MMDD}-{sequence}
- **Database**: quote_sessions + quote_items
- **Special**: Color selection by case (24/case)

## Lessons Learned - Laser Tumbler Implementation

### What Went Wrong & How We Fixed It

#### 1. EmailJS Template Corruption
**Issue**: "One or more dynamic variables are corrupted" error
**Root Cause**: Missing `quote_type` variable in email data
**Solution**: Added `quote_type: 'Laser Tumbler'` to emailData object
**Lesson**: ALWAYS provide every variable referenced in the template

#### 2. Database Not Saving
**Issue**: Quotes weren't appearing in Caspio database
**Root Cause**: Using wrong table endpoint (`/tables/laser_tumbler_quotes` instead of `/api/quote_sessions`)
**Solution**: Rewrote quote service to use standard two-table pattern
**Lesson**: ALWAYS use the standard quote_sessions + quote_items structure

#### 3. Quote ID Not Visible
**Issue**: Users couldn't see their quote ID after saving
**Root Cause**: No display element for quote ID in success message
**Solution**: Added quote ID display in success message HTML
**Lesson**: ALWAYS show the quote ID prominently after saving

#### 4. Template ID Confusion
**Issue**: Spent time debugging wrong template reference
**Root Cause**: Used template name instead of template ID
**Solution**: Updated to use actual template ID from EmailJS
**Lesson**: ALWAYS ask for template ID upfront, not the name

### Key Takeaways for Future Implementations

1. **Start with Information Gathering**
   - Get ALL details before writing code
   - Especially EmailJS template ID
   - Understand exact pricing structure

2. **Follow Standard Patterns**
   - Two-table database structure is mandatory
   - Quote ID format must be consistent
   - Email variables must match exactly

3. **Test Incrementally**
   - Check console after each major step
   - Verify data structure before sending
   - Test with minimal data first

4. **User Experience Matters**
   - Always show quote ID
   - Provide clear success/error messages
   - Include "Save to Database" option

5. **Documentation is Critical**
   - Update CLAUDE.md immediately
   - Include all template IDs
   - Document any special features

## Quick Reference Card

### Essential URLs & IDs
```
Company Logo: https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793
Company Year: 1977
```

### Required Email Variables (EVERY Calculator)
```javascript
{
    // System
    to_email, reply_to, from_name,
    
    // Quote
    quote_type,  // NOT {{PLACEHOLDER}}!
    quote_id, quote_date,
    
    // Customer
    customer_name, project_name,
    
    // Pricing
    grand_total,
    
    // Sales Rep
    sales_rep_name, sales_rep_email, sales_rep_phone,
    
    // Company
    company_year,
    
    // Optional with defaults
    special_note: note || '',
    notes: notes || 'No special notes for this order'
}
```

### Database Save Pattern
```javascript
// Step 1: Create session
await fetch(`${apiUrl}/api/quote_sessions`, {
    method: 'POST',
    body: JSON.stringify(sessionData)
});

// Step 2: Create items
await fetch(`${apiUrl}/api/quote_items`, {
    method: 'POST',
    body: JSON.stringify(itemData)
});
```

### Quote ID Pattern
```
[PREFIX][MMDD]-[sequence]
Examples: DTG0127-1, LT0127-2, EMB0127-3
```

### Console Debug Commands
```javascript
// Check initialization
console.log(window.[name]Calculator);

// Check quote data
console.log(window.[name]Calculator.currentQuote);

// Test quote ID
console.log(new [Name]QuoteService().generateQuoteID());
```

### Common Fixes
- **Corrupted variables**: Add missing variables with defaults
- **Database not saving**: Check endpoint and field names
- **Quote ID not showing**: Add display element in success message
- **Wrong template**: Use template ID, not name

Remember: When in doubt, check this documentation first!