# Manual Pricing Calculator Implementation Guide

## Overview

This guide documents the implementation of manual pricing calculators for Northwest Custom Apparel. These calculators enable staff to price custom items not in the standard catalog while maintaining consistent pricing logic with the Sanmar-style calculators.

### Purpose
- Price custom/non-catalog items with manual blank cost entry
- Model interface and functionality after Sanmar pricing calculators
- Use API data for embellishment pricing while allowing manual garment costs
- Generate professional quotes with database tracking
- Provide programmatic testing capabilities for accuracy

### Calculator Types This Guide Covers
- Manual Cap Embroidery (✅ implemented)
- Manual Flat Embroidery (planned - model after Sanmar embroidery)
- Manual DTG (planned)
- Manual DTF (planned)
- Manual Screen Printing (planned)

## Lessons Learned from Cap Embroidery Implementation

### 1. UI/UX Design Principles

**Two-Column Layout with Sticky Pricing**
- Left column: Input form with all configuration options
- Right column: Sticky pricing card that follows scroll (top: 80px)
- Live updates as user changes any input
- Large, prominent final pricing display (3.5rem font)
- Clear price breakdown showing each component

**Visual Hierarchy**
```css
/* Price display hierarchy */
.final-price { font-size: 3.5rem; }  /* Main price */
.subtotal { font-size: 1.5rem; }     /* Component totals */
.line-items { font-size: 1rem; }     /* Individual items */
```

### 2. Pricing Architecture

**Hybrid API/Manual Approach**
- Fetch embroidery pricing from Caspio API on load
- Allow manual blank cost entry
- Apply consistent margin calculation (divide by 0.6 = 40% margin)
- Show margin-adjusted cost in breakdowns, not raw cost

### 3. Accurate Pricing Calculations

#### Front Logo Pricing (Primary Location)
```javascript
// Front logo includes blank cost with margin + embroidery
function calculateFrontLogoPrice(stitches, blankCost, tierData) {
    // Step 1: Apply margin to blank cost
    const marginDenom = 0.6;  // 40% margin (divide by 0.6)
    const markedUpBlank = blankCost / marginDenom;
    
    // Step 2: Get embroidery cost from API tier data
    const baseCost = tierData.baseCost;  // Base cost for 8,000 stitches
    const stitchDiff = stitches - 8000;
    const stitchAdjustment = (stitchDiff / 1000) * 1.00;  // $1.00 per 1,000
    const embroideryTotal = baseCost + stitchAdjustment;
    
    // Step 3: Combine costs
    const total = markedUpBlank + embroideryTotal;
    
    // Step 4: Round to nearest dollar
    return Math.round(total);
}
```

#### Additional Logo Pricing (Back, Left Side, Right Side)
```javascript
// CRITICAL: Additional logos do NOT include blank cost - embroidery only
// NO ROUNDING on individual logo costs - only round final total
function calculateAdditionalLogoPrice(stitches) {
    const basePrice = 5.00;      // Base for up to 5,000 stitches
    const baseStitches = 5000;
    const pricePerThousand = 1.00;
    
    // Calculate additional cost for stitches beyond 5,000
    const additionalStitches = Math.max(0, stitches - baseStitches);
    const additionalThousands = additionalStitches / 1000;
    
    // Return exact cost - NO ROUNDING HERE
    return basePrice + (additionalThousands * pricePerThousand);
}

// Examples (exact costs, no rounding):
// 5,000 stitches: $5.00
// 6,000 stitches: $5.00 + $1.00 = $6.00
// 7,000 stitches: $5.00 + $2.00 = $7.00
// 8,500 stitches: $5.00 + $3.50 = $8.50  ← Note: NOT rounded
// 10,000 stitches: $5.00 + $5.00 = $10.00
```

### 4. Critical Implementation Details

#### API Data Requirements
**IMPORTANT**: Request the Caspio XML file to understand API endpoints and data structure.
- Embroidery pricing tiers come from API
- Cap-specific pricing uses different base than flat embroidery
- API provides tier breakpoints and base costs

#### Pricing Display Rules
1. **Always show margin-adjusted blank cost** in breakdowns, not raw cost
2. **Label pricing tables clearly** - e.g., "Volume Pricing (Cap + Front Logo)"
3. **LTM fees** must be clearly explained with per-unit breakdown
4. **Component visibility** - only show logos that are enabled
5. **Rounding** - Apply only to final total, not individual components

#### Common Pitfalls to Avoid
1. **Don't round additional logo costs** - causes confusion in totals
2. **Don't include blank cost in additional logos** - embroidery only
3. **Don't show raw costs** - always show margin-adjusted prices
4. **Don't mislabel margin** - it's 40% margin (divide by 0.6), not 60%

### 5. Programmatic Testing Strategy

**Create Comprehensive Test Scenarios**
```javascript
// Test framework pattern that works
const testScenarios = [
    {
        name: "Basic order",
        inputs: { blankCost: 5, quantity: 24, frontStitches: 8000 },
        expected: { /* calculated values */ }
    },
    {
        name: "With additional logos",
        inputs: { 
            blankCost: 5, 
            quantity: 24, 
            frontStitches: 8000,
            logos: { back: 5000, left: 7000 }
        },
        expected: { /* calculated values */ }
    }
];

// Critical testing considerations:
// 1. Reset all inputs between scenarios
// 2. Only read visible values from DOM
// 3. Wait for UI updates with setTimeout
// 4. Expose config and data on window for tests
```

### 6. Standardized Header Implementation

**Universal Header for All Manual Calculators**
```html
<header class="header">
    <div class="header-container">
        <div class="header-left">
            <img src="[logo-url]" alt="Northwest Custom Apparel" class="logo">
            <nav class="breadcrumb">
                <a href="/staff-dashboard.html">Staff Dashboard</a>
                <span>/</span>
                <a href="/">Main Site</a>
                <span>/</span>
                <span>[Calculator Name]</span>
            </nav>
        </div>
        <div class="header-right">
            <button class="help-btn" onclick="window.print()">
                <i class="fas fa-print"></i> Print Quote
            </button>
        </div>
    </div>
</header>
```
## Building Manual Calculators for Other Embellishments

### Key Principle: Model After Sanmar Calculators

All manual calculators should be modeled after their Sanmar counterparts:
- **Manual Embroidery** → Model after: https://www.teamnwca.com/pricing/embroidery?StyleNumber=C112&COLOR=Flame%20Red%2FBlk
- **Manual DTG** → Model after Sanmar DTG calculator
- **Manual Screen Print** → Model after Sanmar screen print calculator
- **Manual DTF** → Model after Sanmar DTF calculator

### Implementation Process

1. **Study the Sanmar Version**
   - Examine the UI layout and flow
   - Note the pricing breakdown structure
   - Understand the input options and ranges
   - Observe how quantities affect pricing

2. **Request Caspio XML Files**
   - Essential for understanding API endpoints
   - Shows data structure and field names
   - Reveals pricing tier logic

3. **Adapt to Manual Entry**
   - Replace product selection with blank cost input
   - Keep all other functionality identical
   - Use same API endpoints with styleNumber=MANUAL

### Manual Flat Embroidery Calculator

**Key Differences from Cap Embroidery:**
- Base stitch count may differ (check API)
- Pricing tiers may vary
- No "side" locations - typically chest, full front, full back
- Maximum stitch count: 20,000 (vs 12,000 for caps)

```javascript
// Flat embroidery specifics
const FLAT_BASE_STITCHES = 8000;  // Verify from API
const MAX_STITCHES = 20000;
const LOCATIONS = ['Left Chest', 'Right Chest', 'Full Front', 'Full Back'];

### Manual DTG Calculator

**Key Features from Sanmar DTG:**
- Print size selection (not square inches)
- Standard sizes: Pocket, Standard, Oversized
- Single location pricing
- White/light vs dark garment pricing

```javascript
// DTG manual specifics
const PRINT_SIZES = {
    'Pocket': { width: 4, height: 4 },
    'Standard': { width: 12, height: 14 },
    'Oversized': { width: 14, height: 16 }
};
// Pricing varies by garment color (light vs dark)
```

### Manual Screen Print Calculator

**Key Features from Sanmar Screen Print:**
- Color count per location (1-6 colors)
- Multiple print locations
- Setup fees per screen/color
- Location-specific pricing

```javascript
// Screen print manual specifics
const SETUP_FEE_PER_SCREEN = 30.00;
const MAX_COLORS = 6;
const LOCATIONS = ['Front', 'Back', 'Left Sleeve', 'Right Sleeve'];
// Each location calculated separately
```

### Manual DTF Calculator

**Key Features from Sanmar DTF:**
- Gang sheet sizes
- No color limitations
- Simple size-based pricing

```javascript
// DTF manual specifics
const DTF_SIZES = {
    'Small (up to 10")': { maxSize: 10, upcharge: 0 },
    'Medium (10-14")': { maxSize: 14, upcharge: 2 },
    'Large (14-22")': { maxSize: 22, upcharge: 5 }
};
```

## Complete Implementation Checklist

### 1. Pre-Development Setup
- [ ] Study the corresponding Sanmar calculator thoroughly
- [ ] Request Caspio XML file for API structure
- [ ] Document all input options and ranges
- [ ] Map out pricing breakdown components

### 2. Development Process
- [ ] Create HTML structure with 2-column layout
- [ ] Implement sticky pricing card (right column)
- [ ] Add standardized header with navigation
- [ ] Build input form matching Sanmar options
- [ ] Integrate API calls for pricing data
- [ ] Create real-time calculation functions
- [ ] Add comprehensive price breakdown display
- [ ] Implement quote system (optional)
- [ ] Add print functionality

### 3. Testing Requirements  
- [ ] Create programmatic test scenarios
- [ ] Test all quantity tiers
- [ ] Verify LTM fee calculations
- [ ] Check all decoration options
- [ ] Validate margin calculations
- [ ] Test edge cases (min/max values)
- [ ] Ensure responsive design works

### 4. Final Polish
- [ ] Large, prominent pricing display (3.5rem)
- [ ] Clear component breakdowns
- [ ] Proper labeling of all fees
- [ ] Mobile responsive design
- [ ] Print-friendly layout
- [ ] Consistent NWCA branding

## Summary

The key to successful manual calculator implementation is:
1. **Model after Sanmar** - Don't reinvent the wheel
2. **Use live API data** - Ensures pricing consistency  
3. **Clear pricing breakdowns** - No confusion about costs
4. **Programmatic testing** - Catch calculation errors early
5. **Standardized UI** - Consistent experience across calculators

By following this guide and learning from the cap embroidery implementation, all manual calculators can be built efficiently with minimal issues.
/calculators/
├── cap-embroidery-manual.html          # Main calculator
├── cap-embroidery-manual-service.js    # Quote service
├── embroidery-manual.html              # Flat embroidery (future)
├── dtg-manual.html                     # DTG manual (future)
├── dtf-manual.html                     # DTF manual (future)
└── screenprint-manual.html             # Screen print manual (future)
```

### Quote ID Prefixes

Each manual calculator needs a unique prefix:
- **CAPM**: Cap Embroidery Manual
- **EMBM**: Embroidery Manual (flat)
- **DTGM**: DTG Manual
- **DTFM**: DTF Manual
- **SPM**: Screen Print Manual

### Key Implementation Components

#### 1. Blank Cost Input Field
```html
<!-- Key feature: User enters their cost -->
<div class="form-group">
    <label for="blank-cost">Blank Cost Per Unit:</label>
    <input type="number" 
           id="blank-cost" 
           step="0.01" 
           min="0" 
           placeholder="Enter cost" 
           value="">
    <small>Enter the cost of your blank cap</small>
</div>
```

#### 2. Interactive Sliders with Real-time Pricing
```javascript
// Slider shows both stitch count and price impact
slider.addEventListener('input', function() {
    const value = parseInt(this.value);
    const adjustment = calculatePriceAdjustment(value);
    
    // Update tooltip with dual information
    tooltip.innerHTML = `
        <div>${value.toLocaleString()}</div>
        <div style="color: ${adjustment >= 0 ? '#f44336' : '#4caf50'}">
            ${adjustment >= 0 ? '+' : ''}$${Math.abs(adjustment).toFixed(2)}
        </div>
    `;
    
    // Immediate pricing update
    updatePricingDisplay();
});
```

#### 3. API Error Handling
```javascript
async function loadPricingData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        processPricingData(data);
        
    } catch (error) {
        // Show user-friendly error
        displayPricingError(
            'Unable to load pricing data. Please refresh or contact support.'
        );
    }
}
```

### Database Integration Pattern

All manual calculators save quotes using the standard two-table structure:

#### quote_sessions Table
```javascript
{
    QuoteID: "CAPM0730-1",
    CustomerEmail: "customer@email.com",
    TotalQuantity: 24,
    TotalAmount: 480.00,
    Status: "Open",
    Notes: "Rush order needed"
}
```

#### quote_items Table
```javascript
{
    QuoteID: "CAPM0730-1",
    LineNumber: 1,
    StyleNumber: "MANUAL-CAP",
    ProductName: "Manual Cap + Embroidery",
    Quantity: 24,
    FinalUnitPrice: 20.00,
    LineTotal: 480.00,
    SizeBreakdown: JSON.stringify({
        blankCost: 5.00,
        frontStitches: 8000,
        additionalLogos: {...}
    })
}
```

### Email Integration Standards

#### Required EmailJS Variables
Every manual calculator must provide these variables:
```javascript
{
    // System
    to_email: customerEmail,
    reply_to: salesRepEmail,
    from_name: "Northwest Custom Apparel",
    
    // Quote
    quote_type: "Cap Embroidery (Manual)",
    quote_id: "CAPM0730-1",
    quote_date: "07/30/2025",
    
    // Pricing
    grand_total: "480.00",
    products_html: generateDetailedBreakdown(),
    
    // Always required (no placeholders!)
    notes: notes || "No special notes",
    company_year: "1977"
}
```

### Testing Checklist

Before deploying any manual calculator:

#### Functionality Tests
- [ ] Blank cost input updates pricing correctly
- [ ] All quantity tiers calculate properly
- [ ] LTM fee applies under minimum quantity
- [ ] Additional options work (logos, locations, etc.)
- [ ] Pricing grid shows all tier breakpoints

#### Integration Tests
- [ ] API loads successfully
- [ ] Fallback displays if API fails
- [ ] Quote saves to database
- [ ] Email sends with all variables
- [ ] Success modal shows quote ID

#### Edge Cases
- [ ] Zero blank cost handling
- [ ] Maximum quantity limits
- [ ] Special characters in notes
- [ ] Decimal quantities prevented

### Best Practices and Lessons Learned

1. **Always Show Quote ID**: Users need to see and save their quote ID immediately
2. **No Default Prices**: Don't assume blank costs - make users enter them
3. **Simple Formulas**: Additional logos use straightforward pricing ($5 base + $1/thousand)
4. **Real-time Updates**: Every input change should update pricing instantly
5. **Clear Breakdowns**: Show how the price is calculated, not just the final number

### Common Pitfalls to Avoid

1. **Complex API Calculations**: Keep additional items simple and predictable
2. **Hidden Fees**: Always show LTM and setup fees clearly
3. **Confusing UI**: Use the standard 3-step process users expect
4. **Missing Validation**: Ensure all inputs are validated before submission

### Future Enhancement Opportunities

1. **Save Configurations**: Allow saving common blank costs
2. **Bulk Quoting**: Quote multiple items at once
3. **History Tracking**: Show recent manual quotes
4. **Cost Comparison**: Compare manual vs catalog pricing

## Summary

This implementation guide provides a complete blueprint for creating manual pricing calculators. The key principles are:

1. **Consistency**: Match the UI/UX of catalog calculators
2. **Simplicity**: Use straightforward pricing formulas
3. **Transparency**: Show all pricing components clearly
4. **Reliability**: Handle errors gracefully with user-friendly messages
5. **Professionalism**: Generate quotes identical to catalog items

By following these patterns, future manual calculators can be implemented quickly and reliably while maintaining NWCA's professional standards.

### 2. HTML Structure

#### Header Section
```html
<div class="enhanced-pricing-header">
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
            <div class="header-hours">
                Monday - Friday: 8:00 AM - 5:00 PM PST
            </div>
        </div>
    </div>
    
    <div class="main-header">
        <div class="header-content">
            <div class="logo-section">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                     alt="Northwest Custom Apparel" class="company-logo">
            </div>
            <div class="header-info">
                <h1>Cap Embroidery Pricing Calculator</h1>
                <div class="pricing-summary">
                    <span class="quantity-display">Qty: <span id="header-quantity">24</span></span>
                    <span class="price-display">Per Unit: <span id="header-unit-price">$0.00</span></span>
                </div>
            </div>
        </div>
    </div>
</div>
```

#### Main Content Areas

**Step 1: Configure Your Order**
```html
<div class="pricing-step active" id="step-1">
    <div class="step-header">
        <div class="step-number">1</div>
        <h2>Configure Your Order</h2>
    </div>
    
    <div class="configuration-grid">
        <!-- Manual Blank Cost Input -->
        <div class="config-section">
            <h3>Blank Cost Information</h3>
            <div class="blank-cost-input">
                <label for="blank-cost">Blank Cost Per Unit:</label>
                <input type="number" id="blank-cost" step="0.01" min="0" 
                       placeholder="Enter cost..." value="5.00">
            </div>
        </div>
        
        <!-- Quantity Selection -->
        <div class="config-section">
            <h3>Order Quantity</h3>
            <input type="number" id="quantity-input" min="24" value="24" 
                   class="quantity-input">
        </div>
        
        <!-- Front Logo Configuration with Interactive Slider -->
        <div class="config-section">
            <h3>Front Logo Embroidery</h3>
            <div class="slider-container">
                <div class="slider-header">
                    <span>Stitch Count: <span class="stitch-display" id="front-stitch-display">8,000 stitches</span></span>
                    <span class="price-display neutral" id="front-price-display">Base Price</span>
                </div>
                <div class="slider-wrapper">
                    <input type="range" id="front-stitch-slider" class="slider" 
                           min="5000" max="12000" step="1000" value="8000">
                    <div class="slider-tooltip dual-line" id="front-tooltip">
                        <div>8,000</div>
                        <div style="color: #4caf50;">Base</div>
                    </div>
                </div>
                <div class="slider-labels">
                    <span>5,000</span>
                    <span>8,500</span>
                    <span>12,000</span>
                </div>
            </div>
        </div>
        
        <!-- Additional Logo Options -->
        <div class="config-section">
            <h3>Additional Logo Locations</h3>
            
            <!-- Back Logo with Interactive Slider -->
            <div class="logo-option">
                <div class="logo-checkbox">
                    <input type="checkbox" id="back-logo-enabled">
                    <label for="back-logo-enabled">Add Back Logo Embroidery</label>
                </div>
                <div class="slider-container" id="back-logo-control" style="display: none;">
                    <div class="slider-header">
                        <span>Stitch Count: <span class="stitch-display" id="back-stitch-display">5,000 stitches</span></span>
                        <span class="price-display positive" id="back-price-display">+$5.00</span>
                    </div>
                    <div class="slider-wrapper">
                        <input type="range" id="back-stitch-slider" class="slider" 
                               min="5000" max="12000" step="1000" value="5000">
                        <div class="slider-tooltip dual-line" id="back-tooltip">
                            <div>5,000</div>
                            <div style="color: #f44336;">+$5.00</div>
                        </div>
                    </div>
                    <div class="slider-labels">
                        <span>5,000</span>
                        <span>8,500</span>
                        <span>12,000</span>
                    </div>
                </div>
            </div>
            
            <!-- Left Side Logo with Interactive Slider -->
            <div class="logo-option">
                <div class="logo-checkbox">
                    <input type="checkbox" id="left-logo-enabled">
                    <label for="left-logo-enabled">Add Left Side Logo Embroidery</label>
                </div>
                <div class="slider-container" id="left-logo-control" style="display: none;">
                    <div class="slider-header">
                        <span>Stitch Count: <span class="stitch-display" id="left-stitch-display">5,000 stitches</span></span>
                        <span class="price-display positive" id="left-price-display">+$5.00</span>
                    </div>
                    <div class="slider-wrapper">
                        <input type="range" id="left-stitch-slider" class="slider" 
                               min="5000" max="12000" step="1000" value="5000">
                        <div class="slider-tooltip dual-line" id="left-tooltip">
                            <div>5,000</div>
                            <div style="color: #f44336;">+$5.00</div>
                        </div>
                    </div>
                    <div class="slider-labels">
                        <span>5,000</span>
                        <span>8,500</span>
                        <span>12,000</span>
                    </div>
                </div>
            </div>
            
            <!-- Right Side Logo with Interactive Slider -->
            <div class="logo-option">
                <div class="logo-checkbox">
                    <input type="checkbox" id="right-logo-enabled">
                    <label for="right-logo-enabled">Add Right Side Logo Embroidery</label>
                </div>
                <div class="slider-container" id="right-logo-control" style="display: none;">
                    <div class="slider-header">
                        <span>Stitch Count: <span class="stitch-display" id="right-stitch-display">5,000 stitches</span></span>
                        <span class="price-display positive" id="right-price-display">+$5.00</span>
                    </div>
                    <div class="slider-wrapper">
                        <input type="range" id="right-stitch-slider" class="slider" 
                               min="5000" max="12000" step="1000" value="5000">
                        <div class="slider-tooltip dual-line" id="right-tooltip">
                            <div>5,000</div>
                            <div style="color: #f44336;">+$5.00</div>
                        </div>
                    </div>
                    <div class="slider-labels">
                        <span>5,000</span>
                        <span>8,500</span>
                        <span>12,000</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Step 2: Your Instant Quote**
```html
<div class="pricing-step" id="step-2">
    <div class="step-header">
        <div class="step-number">2</div>
        <h2>Your Instant Quote</h2>
    </div>
    
    <div class="instant-quote-box">
        <div class="quote-row">
            <span class="quote-label">Base Unit Price (8,000 stitches):</span>
            <span class="quote-value" id="base-price">$0.00</span>
        </div>
        <div class="quote-row total-row">
            <span class="quote-label">= Total Price Per Piece:</span>
            <span class="quote-value total-price" id="total-per-piece">$0.00</span>
        </div>
        <div class="quote-summary">
            <div class="summary-item">
                <span class="summary-label">Quantity:</span>
                <span class="summary-value" id="quote-quantity">24</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Estimated Total:</span>
                <span class="summary-value" id="quote-total">$0.00</span>
            </div>
        </div>
        
        <!-- Email Quote Section -->
        <div class="quote-actions">
            <button class="btn-primary" id="email-quote-btn">
                <i class="fas fa-envelope"></i>
                Email This Quote
            </button>
        </div>
    </div>
</div>
```

**Step 3: Complete Price-Per-Unit Reference Grid**
```html
<div class="pricing-step" id="step-3">
    <div class="step-header">
        <div class="step-number">3</div>
        <h2>Complete Price-Per-Unit Reference Grid</h2>
    </div>
    
    <div class="pricing-table-container" id="pricing-grid-container">
        <table class="pricing-table" id="pricing-table">
            <thead>
                <tr>
                    <th>Quantity</th>
                    <th>S/M</th>
                    <th>M/L</th>
                    <th>L/XL</th>
                </tr>
            </thead>
            <tbody id="pricing-table-body">
                <!-- Dynamic content populated by JavaScript -->
            </tbody>
        </table>
        
        <div class="pricing-notes">
            <p><strong>Volume Pricing:</strong> Save more when you order in bulk. All prices include cap + 8,000 stitch embroidered front logo.</p>
        </div>
    </div>
</div>
```

### 3. Interactive Slider Implementation

Based on analysis of the existing cap embroidery pricing page (`cap-embroidery-pricing-v3.js`), the manual calculator must implement identical interactive slider functionality with dual-line tooltips showing stitch count and price adjustments.

#### CSS Requirements for Interactive Sliders

```css
/* Slider Container Styles */
.slider-container {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-weight: 500;
}

.stitch-display {
    color: var(--text-primary);
    font-weight: 600;
}

.price-display {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
}

.price-display.neutral {
    color: #4caf50;
    background: #e8f5e9;
}

.price-display.positive {
    color: #f44336;
    background: #ffebee;
}

.price-display.negative {
    color: #4caf50;
    background: #e8f5e9;
}

/* Slider Wrapper and Positioning */
.slider-wrapper {
    position: relative;
    margin: 1rem 0;
}

.slider {
    width: 100%;
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
}

.slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    background: var(--primary-color);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--primary-color);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Dual-Line Tooltip Styles */
.slider-tooltip {
    position: absolute;
    top: -50px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.2;
    text-align: center;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
    z-index: 10;
}

.slider-tooltip.dual-line {
    min-width: 60px;
}

.slider-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: rgba(0,0,0,0.8);
}

/* Slider Labels */
.slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
}
```

#### JavaScript Slider Implementation

Based on the existing cap embroidery pricing page, implement these core functions:

```javascript
// Initialize individual slider with tooltip functionality
function initializeSlider(slider, tooltip, display, priceDisplay, type, isBase8000) {
    slider.addEventListener('input', function() {
        const value = parseInt(this.value);
        const formattedValue = value.toLocaleString();
        
        // Update display
        display.textContent = formattedValue + ' stitches';
        
        // Calculate price adjustment
        let price, priceText, priceClass, tooltipColor;
        
        if (isBase8000) {
            // Front logo with 8,000 base
            const diff = value - BASE_STITCHES; // 8000
            price = (diff / 1000) * PRICE_PER_THOUSAND; // ±$1.00
            
            if (type === 'front') {
                currentFrontStitches = value;
                frontAdjustment = price;
            }
            
            if (diff > 0) {
                priceText = `+$${Math.abs(price).toFixed(2)}`;
                priceClass = 'positive';
                tooltipColor = '#f44336';
            } else if (diff < 0) {
                priceText = `-$${Math.abs(price).toFixed(2)}`;
                priceClass = 'negative';
                tooltipColor = '#4caf50';
            } else {
                priceText = 'Base Price';
                priceClass = 'neutral';
                tooltipColor = '#4caf50';
            }
        } else {
            // Additional logos (5,000 base)
            const additional = Math.max(0, value - LOGO_BASE_STITCHES); // 5000
            price = LOGO_BASE_PRICE + (additional / 1000) * PRICE_PER_THOUSAND;
            priceText = `+$${price.toFixed(2)}`;
            priceClass = 'positive';
            tooltipColor = '#f44336';
            
            // Store price based on type
            if (type === 'back') {
                currentBackStitches = value;
                backLogoPrice = price;
            } else if (type === 'left') {
                currentLeftStitches = value;
                leftLogoPrice = price;
            } else if (type === 'right') {
                currentRightStitches = value;
                rightLogoPrice = price;
            }
        }
        
        // Update price display
        priceDisplay.textContent = priceText;
        priceDisplay.className = 'price-display ' + priceClass;
        
        // Update dual-line tooltip
        tooltip.innerHTML = `
            <div>${formattedValue}</div>
            <div style="color: ${tooltipColor}">${priceText}</div>
        `;
        
        // Update tooltip position based on slider value
        const percent = (this.value - this.min) / (this.max - this.min);
        const offset = percent * (this.offsetWidth - 20);
        tooltip.style.left = offset + 10 + 'px';
        
        // Update pricing calculations
        updatePricingDisplay();
    });
    
    // Show tooltip on interaction
    slider.addEventListener('mouseenter', () => tooltip.style.opacity = '1');
    slider.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
    slider.addEventListener('mousedown', () => tooltip.style.opacity = '1');
    slider.addEventListener('mouseup', () => tooltip.style.opacity = '0');
}

// Initialize all sliders
function initializeAllSliders() {
    // Front slider (8,000 base)
    const frontSlider = document.getElementById('front-stitch-slider');
    const frontTooltip = document.getElementById('front-tooltip');
    const frontDisplay = document.getElementById('front-stitch-display');
    const frontPriceDisplay = document.getElementById('front-price-display');
    
    if (frontSlider) {
        initializeSlider(frontSlider, frontTooltip, frontDisplay, frontPriceDisplay, 'front', true);
    }
    
    // Back slider (5,000 base)
    const backSlider = document.getElementById('back-stitch-slider');
    const backTooltip = document.getElementById('back-tooltip');
    const backDisplay = document.getElementById('back-stitch-display');
    const backPriceDisplay = document.getElementById('back-price-display');
    
    if (backSlider) {
        initializeSlider(backSlider, backTooltip, backDisplay, backPriceDisplay, 'back', false);
    }
    
    // Left slider (5,000 base)
    const leftSlider = document.getElementById('left-stitch-slider');
    const leftTooltip = document.getElementById('left-tooltip');
    const leftDisplay = document.getElementById('left-stitch-display');
    const leftPriceDisplay = document.getElementById('left-price-display');
    
    if (leftSlider) {
        initializeSlider(leftSlider, leftTooltip, leftDisplay, leftPriceDisplay, 'left', false);
    }
    
    // Right slider (5,000 base)
    const rightSlider = document.getElementById('right-stitch-slider');
    const rightTooltip = document.getElementById('right-tooltip');
    const rightDisplay = document.getElementById('right-stitch-display');
    const rightPriceDisplay = document.getElementById('right-price-display');
    
    if (rightSlider) {
        initializeSlider(rightSlider, rightTooltip, rightDisplay, rightPriceDisplay, 'right', false);
    }
}
```

#### Integration with Existing Pricing Logic

The interactive sliders must integrate seamlessly with the existing manual pricing calculations:

```javascript
// Update pricing display in real-time as sliders change
function updatePricingDisplay() {
    const totalPrice = calculateTotalPrice();
    const estimatedTotal = totalPrice * currentQuantity;
    
    // Update instant quote breakdown
    document.getElementById('blank-cost-display').textContent = `$${manualBlankCost.toFixed(2)}`;
    document.getElementById('front-cost-display').textContent = `$${calculateFrontLogoPrice().toFixed(2)}`;
    document.getElementById('total-per-piece').textContent = `$${totalPrice.toFixed(2)}`;
    document.getElementById('quote-quantity').textContent = currentQuantity;
    document.getElementById('quote-total').textContent = `$${estimatedTotal.toFixed(2)}`;
    
    // Update header pricing
    document.getElementById('header-quantity').textContent = currentQuantity;
    document.getElementById('header-unit-price').textContent = `$${totalPrice.toFixed(2)}`;
    
    // Show/hide additional logo cost rows
    document.getElementById('back-cost-row').style.display = backLogoEnabled ? 'block' : 'none';
    document.getElementById('left-cost-row').style.display = leftLogoEnabled ? 'block' : 'none';
    document.getElementById('right-cost-row').style.display = rightLogoEnabled ? 'block' : 'none';
    
    if (backLogoEnabled) {
        document.getElementById('back-cost-display').textContent = `$${backLogoPrice.toFixed(2)}`;
    }
    if (leftLogoEnabled) {
        document.getElementById('left-cost-display').textContent = `$${leftLogoPrice.toFixed(2)}`;
    }
    if (rightLogoEnabled) {
        document.getElementById('right-cost-display').textContent = `$${rightLogoPrice.toFixed(2)}`;
    }
    
    // Update pricing grid
    updatePricingGrid();
}

// Enhanced checkbox event handlers
function attachLogoCheckboxEvents() {
    document.getElementById('back-logo-enabled').addEventListener('change', function() {
        backLogoEnabled = this.checked;
        document.getElementById('back-logo-control').style.display = backLogoEnabled ? 'block' : 'none';
        updatePricingDisplay();
    });
    
    document.getElementById('left-logo-enabled').addEventListener('change', function() {
        leftLogoEnabled = this.checked;
        document.getElementById('left-logo-control').style.display = leftLogoEnabled ? 'block' : 'none';
        updatePricingDisplay();
    });
    
    document.getElementById('right-logo-enabled').addEventListener('change', function() {
        rightLogoEnabled = this.checked;
        document.getElementById('right-logo-control').style.display = rightLogoEnabled ? 'block' : 'none';
        updatePricingDisplay();
    });
}
```

#### Initialization Sequence

```javascript
document.addEventListener('DOMContentLoaded', function() {
    // 1. Initialize hybrid calculator with API data
    initializeHybridCalculator();
    
    // 2. Initialize interactive sliders
    initializeAllSliders();
    
    // 3. Attach logo checkbox events
    attachLogoCheckboxEvents();
    
    // 4. Initialize other form events
    initializeFormEvents();
    
    // 5. Initial pricing display update
    updatePricingDisplay();
});
```

#### Key Implementation Requirements

1. **Dual-Line Tooltips**: Each tooltip shows stitch count on top line and price adjustment on bottom line
2. **Color-Coded Price Displays**: 
   - Green for base price and discounts
   - Red for price increases
   - Neutral gray for base price
3. **Real-Time Updates**: All pricing calculations update immediately as sliders move
4. **Tooltip Positioning**: Tooltips follow slider thumb position using percentage calculations
5. **Interactive Behavior**: Tooltips show on hover, mousedown, and hide on mouseleave, mouseup
6. **Consistent Formatting**: Stitch counts formatted with commas (e.g., "8,000")
7. **Price Adjustments**: ±$1.00 per 1,000 stitches for all sliders
8. **Seamless Integration**: Slider changes immediately update all pricing displays and quote breakdown

### 4. JavaScript Implementation

#### Core State Management
```javascript
// State variables
let manualBlankCost = 5.00;        // User-entered blank cost
let currentFrontStitches = 8000;
let currentBackStitches = 5000;
let currentLeftStitches = 5000;
let currentRightStitches = 5000;
let backLogoEnabled = false;
let leftLogoEnabled = false;
let rightLogoEnabled = false;
let currentQuantity = 24;

// Live API data (loaded on initialization)
let pricingApiData = null;          // Full API response
let tierData = [];                  // Live tier structure from API
let embroideryBaseCosts = {};       // Live 8,000 stitch costs by tier
let roundingMethod = 'CeilDollar';  // Live rounding rules
let printLocations = [];            // Live print location data

// Manual size structure for caps (display only)
const manualSizes = ['S/M', 'M/L', 'L/XL'];
```

#### API Data Loading and Initialization
```javascript
// Load live embroidery pricing data from API
async function loadEmbroideryPricingData() {
    try {
        const response = await fetch(
            'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=CAP&styleNumber=MANUAL'
        );
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        pricingApiData = await response.json();
        
        // Extract live data
        tierData = pricingApiData.tiersR;
        roundingMethod = pricingApiData.rulesR.RoundingMethod;
        printLocations = pricingApiData.locations;
        
        // Build embroidery base costs lookup (8,000 stitches only)
        embroideryBaseCosts = {};
        pricingApiData.allEmbroideryCostsR
            .filter(cost => cost.StitchCount === 8000)
            .forEach(cost => {
                embroideryBaseCosts[cost.TierLabel] = cost.EmbroideryCost;
            });
            
        console.log('Live pricing data loaded:', {
            tiers: tierData.map(t => t.TierLabel),
            baseCosts: embroideryBaseCosts,
            rounding: roundingMethod
        });
        
        return true;
        
    } catch (error) {
        console.error('Failed to load pricing data:', error);
        // Show user-friendly error
        displayPricingError(error.message);
        return false;
    }
}

// Initialize calculator with live data
async function initializeHybridCalculator() {
    const success = await loadEmbroideryPricingData();
    if (success) {
        // Initialize UI with live data
        updatePricingDisplay();
        console.log('Hybrid calculator initialized with live API data');
    }
}
```

#### Pricing Calculation Functions (Using Live API Data)
```javascript
function calculateFrontLogoPrice(stitches, blankCost, tierLabel) {
    // Get live base embroidery cost for 8,000 stitches
    const baseEmbCost = embroideryBaseCosts[tierLabel];
    if (!baseEmbCost) {
        console.error(`No base cost found for tier: ${tierLabel}`);
        return 0;
    }
    
    // Calculate stitch adjustment from 8,000 base
    const stitchDiff = stitches - BASE_STITCHES; // 8000
    const stitchAdjustment = (stitchDiff / 1000) * PRICE_PER_THOUSAND; // ±$1.00
    
    // Final embroidery cost
    const finalEmbCost = baseEmbCost + stitchAdjustment;
    
    // Get live margin denominator from tier data
    const tierInfo = tierData.find(t => t.TierLabel === tierLabel);
    const marginDenom = tierInfo ? tierInfo.MarginDenominator : 0.6;
    
    // Total cost calculation
    const totalCost = (blankCost + finalEmbCost) / marginDenom;
    
    // Apply live rounding method
    return applyRounding(totalCost, roundingMethod);
}

function calculateAdditionalLogoPrice(stitches, tierLabel) {
    // Additional logos: base 5,000 stitches with live tier pricing
    const baseEmbCost = embroideryBaseCosts[tierLabel];
    if (!baseEmbCost) return 0;
    
    // Scale down from 8,000 stitch base to 5,000 stitch equivalent
    const scaledBaseCost = (baseEmbCost * 5000) / 8000;
    
    // Calculate stitch adjustment from 5,000 base
    const stitchDiff = stitches - LOGO_BASE_STITCHES; // 5000
    const stitchAdjustment = (stitchDiff / 1000) * PRICE_PER_THOUSAND;
    
    const finalCost = scaledBaseCost + stitchAdjustment;
    
    // Apply live rounding
    return applyRounding(finalCost, roundingMethod);
}

function calculateTotalPrice() {
    const tierLabel = getQuantityTier(currentQuantity);
    
    // Front logo price
    let totalPrice = calculateFrontLogoPrice(currentFrontStitches, manualBlankCost, tierLabel);
    
    // Add additional logos
    if (backLogoEnabled) {
        totalPrice += calculateAdditionalLogoPrice(currentBackStitches, tierLabel);
    }
    if (leftLogoEnabled) {
        totalPrice += calculateAdditionalLogoPrice(currentLeftStitches, tierLabel);
    }
    if (rightLogoEnabled) {
        totalPrice += calculateAdditionalLogoPrice(currentRightStitches, tierLabel);
    }
    
    // LTM fee if applicable (no tier discount on LTM)
    if (currentQuantity < MIN_QUANTITY) {
        const ltmPerUnit = LTM_FEE / currentQuantity;
        totalPrice += ltmPerUnit;
    }
    
    return totalPrice;
}

function getQuantityTier(quantity) {
    // Use live tier data from API
    for (const tier of tierData) {
        if (quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity) {
            return tier.TierLabel;
        }
    }
    return '72+'; // Default fallback
}

function applyRounding(price, method) {
    if (method === 'CeilDollar') {
        return Math.ceil(price);
    }
    // Default to HalfDollarUp
    return Math.ceil(price * 2) / 2;
}
```

#### UI Update Functions
```javascript
function updatePricingDisplay() {
    const totalPrice = calculateTotalPrice();
    const estimatedTotal = totalPrice * currentQuantity;
    
    // Update instant quote
    document.getElementById('total-per-piece').textContent = `$${totalPrice.toFixed(2)}`;
    document.getElementById('quote-quantity').textContent = currentQuantity;
    document.getElementById('quote-total').textContent = `$${estimatedTotal.toFixed(2)}`;
    
    // Update header pricing
    document.getElementById('header-quantity').textContent = currentQuantity;
    document.getElementById('header-unit-price').textContent = `$${totalPrice.toFixed(2)}`;
    
    // Update pricing grid
    updatePricingGrid();
}

function updatePricingGrid() {
    const tableBody = document.getElementById('pricing-table-body');
    tableBody.innerHTML = '';
    
    if (!tierData || tierData.length === 0) {
        console.warn('No tier data available for pricing grid');
        return;
    }
    
    // Create rows for each live tier
    tierData.forEach(tier => {
        const row = document.createElement('tr');
        
        // Quantity column
        const qtyCell = document.createElement('td');
        qtyCell.textContent = tier.TierLabel;
        row.appendChild(qtyCell);
        
        // Size columns (uniform pricing for caps)
        manualSizes.forEach(size => {
            const cell = document.createElement('td');
            
            // Calculate price for this tier using live API data
            let basePrice = calculateFrontLogoPrice(currentFrontStitches, manualBlankCost, tier.TierLabel);
            
            // Add additional logos
            if (backLogoEnabled) {
                basePrice += calculateAdditionalLogoPrice(currentBackStitches, tier.TierLabel);
            }
            if (leftLogoEnabled) {
                basePrice += calculateAdditionalLogoPrice(currentLeftStitches, tier.TierLabel);
            }
            if (rightLogoEnabled) {
                basePrice += calculateAdditionalLogoPrice(currentRightStitches, tier.TierLabel);
            }
            
            cell.textContent = `$${basePrice.toFixed(2)}`;
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
}
```

#### Event Listeners
```javascript
function initializeEventListeners() {
    // Initialize hybrid calculator first
    initializeHybridCalculator();
    
    // Blank cost input
    document.getElementById('blank-cost').addEventListener('input', function() {
        manualBlankCost = parseFloat(this.value) || 0;
        updatePricingDisplay();
    });
    
    // Quantity input
    document.getElementById('quantity-input').addEventListener('input', function() {
        currentQuantity = parseInt(this.value) || MIN_QUANTITY;
        updatePricingDisplay();
    });
    
    // Front stitch slider
    document.getElementById('front-stitch-slider').addEventListener('input', function() {
        currentFrontStitches = parseInt(this.value);
        document.getElementById('front-stitch-display').textContent = 
            currentFrontStitches.toLocaleString();
        updatePricingDisplay();
    });
    
    // Additional logo checkboxes
    document.getElementById('back-logo-enabled').addEventListener('change', function() {
        backLogoEnabled = this.checked;
        document.getElementById('back-logo-control').style.display = 
            this.checked ? 'block' : 'none';
        updatePricingDisplay();
    });
    
    // Additional logo sliders
    document.getElementById('back-stitch-slider').addEventListener('input', function() {
        currentBackStitches = parseInt(this.value);
        document.getElementById('back-stitch-display').textContent = 
            currentBackStitches.toLocaleString();
        updatePricingDisplay();
    });
    
    // Repeat for left and right logos...
}
```

### 4. Email Quote Integration

#### Quote Data Structure
```javascript
function buildQuoteData() {
    const frontPrice = calculateFrontLogoPrice(currentFrontStitches, manualBlankCost);
    let additionalLogos = [];
    
    if (backLogoEnabled) {
        additionalLogos.push({
            location: 'Back',
            stitches: currentBackStitches,
            price: calculateAdditionalLogoPrice(currentBackStitches)
        });
    }
    
    if (leftLogoEnabled) {
        additionalLogos.push({
            location: 'Left Side',
            stitches: currentLeftStitches,
            price: calculateAdditionalLogoPrice(currentLeftStitches)
        });
    }
    
    if (rightLogoEnabled) {
        additionalLogos.push({
            location: 'Right Side',
            stitches: currentRightStitches,
            price: calculateAdditionalLogoPrice(currentRightStitches)
        });
    }
    
    const totalPrice = calculateTotalPrice();
    const tier = getQuantityTier(currentQuantity);
    
    return {
        // Product details
        productType: 'Manual Cap Entry',
        blankCost: manualBlankCost,
        quantity: currentQuantity,
        tier: tier,
        
        // Embroidery details
        frontStitches: currentFrontStitches,
        frontPrice: frontPrice,
        additionalLogos: additionalLogos,
        
        // Pricing
        unitPrice: totalPrice,
        totalCost: totalPrice * currentQuantity,
        hasLTM: currentQuantity < MIN_QUANTITY,
        ltmFee: currentQuantity < MIN_QUANTITY ? LTM_FEE : 0
    };
}
```

#### EmailJS Template Structure
```javascript
function buildEmailData(quoteData, customerInfo) {
    // Build products HTML table
    let productsHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #4A5568; color: white;">
                    <th style="padding: 12px; text-align: left;">Description</th>
                    <th style="padding: 12px; text-align: center;">Stitches</th>
                    <th style="padding: 12px; text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 12px;">Cap + Front Logo Embroidery</td>
                    <td style="padding: 12px; text-align: center;">${quoteData.frontStitches.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: right;">$${quoteData.frontPrice.toFixed(2)}</td>
                </tr>
    `;
    
    // Add additional logos
    quoteData.additionalLogos.forEach(logo => {
        productsHTML += `
                <tr>
                    <td style="padding: 12px;">${logo.location} Logo Embroidery</td>
                    <td style="padding: 12px; text-align: center;">${logo.stitches.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: right;">$${logo.price.toFixed(2)}</td>
                </tr>
        `;
    });
    
    // Add LTM fee if applicable
    if (quoteData.hasLTM) {
        productsHTML += `
                <tr>
                    <td style="padding: 12px;" colspan="2">Less Than Minimum Fee</td>
                    <td style="padding: 12px; text-align: right;">$${quoteData.ltmFee.toFixed(2)}</td>
                </tr>
        `;
    }
    
    productsHTML += `
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #4A5568;">
                    <td colspan="2" style="padding: 12px; text-align: right; font-weight: bold;">Total per piece:</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold;">$${quoteData.unitPrice.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    return {
        // EmailJS routing
        to_email: customerInfo.email,
        from_name: 'Northwest Custom Apparel',
        reply_to: customerInfo.salesRepEmail,
        
        // Quote details
        quote_type: 'Cap Embroidery (Manual)',
        quote_id: quoteData.quoteId,
        quote_date: new Date().toLocaleDateString(),
        
        // Customer info
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        company_name: customerInfo.company || '',
        project_name: customerInfo.project || '',
        
        // Pricing
        grand_total: quoteData.totalCost.toFixed(2),
        quantity: quoteData.quantity,
        unit_price: quoteData.unitPrice.toFixed(2),
        
        // Content
        products_html: productsHTML,
        notes: customerInfo.notes || 'No special notes for this order',
        
        // Sales rep
        sales_rep_name: customerInfo.salesRepName,
        sales_rep_email: customerInfo.salesRepEmail,
        sales_rep_phone: '253-922-5793',
        
        // Company
        company_year: '1977'
    };
}
```

### 5. Database Integration

#### Quote Service Structure
```javascript
class CapEmbroideryManualQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }
    
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        const storageKey = `CAPM_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        return `CAPM${dateKey}-${sequence}`;
    }
    
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            // Create quote session
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity),
                SubtotalAmount: parseFloat(quoteData.subtotal.toFixed(2)),
                LTMFeeTotal: quoteData.ltmFee || 0,
                TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                Status: 'Open',
                ExpiresAt: expiresAt,
                Notes: quoteData.notes || ''
            };
            
            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                throw new Error('Session creation failed');
            }
            
            // Create quote items
            await this.saveQuoteItems(quoteID, quoteData);
            
            return { success: true, quoteID: quoteID };
            
        } catch (error) {
            console.error('[CapManualQuoteService] Error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async saveQuoteItems(quoteID, quoteData) {
        const items = [];
        
        // Front logo item
        items.push({
            QuoteID: quoteID,
            LineNumber: 1,
            StyleNumber: 'MANUAL-CAP',
            ProductName: `Cap + Front Logo Embroidery (${quoteData.frontStitches.toLocaleString()} stitches)`,
            EmbellishmentType: 'embroidery',
            PrintLocation: 'Front',
            Quantity: parseInt(quoteData.quantity),
            HasLTM: quoteData.hasLTM ? 'Yes' : 'No',
            BaseUnitPrice: parseFloat(quoteData.frontPrice.toFixed(2)),
            LTMPerUnit: quoteData.hasLTM ? parseFloat((quoteData.ltmFee / quoteData.quantity).toFixed(2)) : 0,
            FinalUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
            LineTotal: parseFloat(quoteData.totalCost.toFixed(2)),
            SizeBreakdown: JSON.stringify({
                blankCost: quoteData.blankCost,
                frontStitches: quoteData.frontStitches,
                additionalLogos: quoteData.additionalLogos,
                apiDataUsed: {
                    tierLabel: quoteData.tier,
                    marginDenominator: tierData.find(t => t.TierLabel === quoteData.tier)?.MarginDenominator,
                    roundingMethod: roundingMethod,
                    baseCost8k: embroideryBaseCosts[quoteData.tier]
                }
            }),
            PricingTier: quoteData.tier,
            AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
        });
        
        // Save each item
        for (const item of items) {
            await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        }
    }
}
```

### 6. Error Handling for API Integration

```javascript
function displayPricingError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'pricing-error';
    errorDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Pricing Data Unavailable</h3>
            <p>${message}</p>
            <p>Please refresh the page or contact support at 253-922-5793</p>
            <button onclick="location.reload()" class="btn-secondary">
                <i class="fas fa-refresh"></i> Retry
            </button>
        </div>
    `;
    
    // Replace main content with error
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.innerHTML = '';
        mainContainer.appendChild(errorDiv);
    }
}

function validateApiData(apiData) {
    const required = ['tiersR', 'rulesR', 'allEmbroideryCostsR'];
    const missing = required.filter(key => !apiData[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required API data: ${missing.join(', ')}`);
    }
    
    // Validate 8,000 stitch costs exist
    const baseCosts = apiData.allEmbroideryCostsR.filter(c => c.StitchCount === 8000);
    if (baseCosts.length === 0) {
        throw new Error('No 8,000 stitch base costs found in API data');
    }
    
    return true;
}
```

### 7. Success Modal and Print Functionality

Follow the same success modal pattern as other calculators with:
- Quote ID display
- Copy to clipboard functionality  
- Print quote functionality
- Professional styling

### 8. Implementation Steps

1. **Create base HTML file** using the structure above
2. **Implement pricing calculation JavaScript** with manual input handling
3. **Create quote service** for database integration
4. **Set up EmailJS template** for cap embroidery manual quotes
5. **Add email modal and success modal** following established patterns
6. **Test all functionality** including pricing calculations, database saves, email sending
7. **Update staff dashboard** to include link to manual cap calculator

### 9. Key Differences from Sanmar Version

| Feature | Sanmar Version | Manual Version |
|---------|---------------|----------------|
| Blank Cost | API lookup from master bundle | Manual user input |
| Product Images | Sanmar product gallery | None (manual entry) |
| Color Swatches | Sanmar color options | None needed |
| Size Variations | API-driven size pricing | Uniform pricing across sizes |
| Data Source | Caspio iframe + postMessage | Live API call for embroidery pricing |
| Pricing Tiers | API-provided tier structure | Live API-provided tier structure |
| Embroidery Costs | API-provided via master bundle | Live API call (8,000 stitch base only) |

### 10. Testing Checklist

#### API Integration Tests
- [ ] API loads live pricing data successfully on page load
- [ ] Error handling displays user-friendly message if API fails
- [ ] Live tier data (24-47, 48-71, 72+) populates correctly
- [ ] Live embroidery base costs for 8,000 stitches load correctly
- [ ] RoundingMethod from API ('CeilDollar') applies correctly
- [ ] Print locations data loads for reference

#### Pricing Calculation Tests  
- [ ] Manual blank cost input updates pricing correctly
- [ ] All stitch sliders function and update pricing
- [ ] 8,000 stitch base + ±$1.00 per 1,000 calculation works
- [ ] Live margin denominators (0.6) apply correctly
- [ ] Additional logo checkboxes show/hide controls
- [ ] Quantity changes use live tier structure
- [ ] LTM fee applies correctly for orders under 24
- [ ] Pricing grid updates with all configuration changes
- [ ] CeilDollar rounding applies to all prices

#### Integration Tests
- [ ] Email quote modal functions properly
- [ ] Database save works with correct quote ID format (CAPM prefix)
- [ ] Live API data stored in SizeBreakdown field for reference
- [ ] Success modal displays quote ID
- [ ] Print functionality generates clean PDF

This implementation plan provides a complete roadmap for creating a hybrid manual cap embroidery calculator that functions identically to the Sanmar-based version while allowing manual blank cost input and using live embroidery pricing data from the API.

## Summary of Hybrid Approach Benefits

1. **Live Pricing Synchronization**: Always uses current embroidery costs and business rules
2. **Manual Flexibility**: Allows custom blank costs for any cap type
3. **Simplified Maintenance**: No hardcoded pricing that becomes outdated
4. **Consistent Logic**: Uses exact same calculation logic as Sanmar version
5. **Future-Proof**: Automatically adapts to pricing changes via API

The calculator will automatically stay synchronized with your pricing system while providing the flexibility of manual blank cost entry.