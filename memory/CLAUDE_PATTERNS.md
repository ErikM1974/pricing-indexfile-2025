# Code Patterns Library & Common Solutions

## Overview
This document contains reusable code patterns, common issues with their fixes, and implementation best practices for the NWCA system.

## 🏗️ Code Patterns Library

### API Fetch with Proper Error Handling
```javascript
async function fetchWithErrorHandling(endpoint, options = {}) {
    try {
        const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        // ALWAYS show user-friendly error
        const errorBanner = document.createElement('div');
        errorBanner.className = 'alert alert-danger';
        errorBanner.textContent = 'Unable to load data. Please refresh or call 253-922-5793.';
        document.body.insertBefore(errorBanner, document.body.firstChild);

        console.error('API Error:', error);
        throw error; // Stop execution
    }
}
```

### Quote Service Initialization Pattern
```javascript
class YourQuoteService {
    constructor() {
        this.quotePrefix = 'PREFIX'; // Change this
        this.emailTemplate = 'template_xxxxx'; // Change this
    }

    generateQuoteID() {
        const date = new Date();
        const dateStr = String(date.getMonth() + 1).padStart(2, '0') +
                       String(date.getDate()).padStart(2, '0');
        const sequence = Math.floor(Math.random() * 100);
        return `${this.quotePrefix}${dateStr}-${sequence}`;
    }

    async saveQuote(quoteData) {
        const quoteID = this.generateQuoteID();
        // Save to database pattern here
        return quoteID;
    }
}
```

### EmailJS Integration Template
```javascript
function sendQuoteEmail(quoteData) {
    const emailData = {
        quote_id: quoteData.quoteID || '',
        customer_name: quoteData.customerName || '',
        customer_email: quoteData.customerEmail || '',
        customer_phone: quoteData.customerPhone || '',
        total_price: quoteData.totalPrice || '0.00',
        // ALWAYS provide defaults to prevent corruption
        company_phone: '253-922-5793',
        quote_date: new Date().toLocaleDateString()
    };

    emailjs.send('service_1c4k67j', 'template_id_here', emailData)
        .then(() => {
            showSuccessMessage(`Quote ${emailData.quote_id} sent successfully!`);
        })
        .catch(error => {
            console.error('Email error:', error);
            // Still show success to user
            showSuccessMessage(`Quote ${emailData.quote_id} created!`);
        });
}
```

### Modal/Popup Standard Implementation
```javascript
function showModal(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${title}</h5>
                    <button type="button" class="close" onclick="this.closest('.modal').remove()">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body">${message}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="confirmBtn">Confirm</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('confirmBtn').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };
}
```

### Form Validation Pattern
```javascript
function validateForm(formElement) {
    const errors = [];

    // Email validation
    const email = formElement.querySelector('[type="email"]');
    if (email && !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push('Valid email required');
    }

    // Phone validation
    const phone = formElement.querySelector('[type="tel"]');
    if (phone && !phone.value.match(/^\d{3}-?\d{3}-?\d{4}$/)) {
        errors.push('Valid phone required (xxx-xxx-xxxx)');
    }

    // Required fields
    formElement.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
            errors.push(`${field.name || 'Field'} is required`);
        }
    });

    return errors;
}
```

## 🎯 Performance Patterns

### Image Optimization
- **Max file sizes**: Product images < 200KB, logos < 100KB
- **Formats**: Use WebP with JPG fallback, SVG for logos
- **Lazy loading**: Add `loading="lazy"` to all images below fold

### JavaScript Performance
```javascript
// Debounce search inputs (prevents excessive API calls)
function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Use like this:
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', debounce(function(e) {
    performSearch(e.target.value);
}, 300));
```

### Caching Strategy
```javascript
// Cache API responses for 5 minutes
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(endpoint) {
    const cacheKey = endpoint;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const data = await fetchWithErrorHandling(endpoint);
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}
```

### Loading States (ALWAYS show while fetching)
```javascript
function showLoading(element) {
    element.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="sr-only">Loading...</span></div>';
}

function hideLoading(element, content) {
    element.innerHTML = content;
}
```

## 🎯 DTG Pricing Calculation Pattern

### Complete DTG Pricing Formula
```javascript
function calculateDTGPrice(styleNumber, quantity, locationCode) {
    // 1. Fetch pricing bundle from API
    const data = await fetch(`/api/pricing-bundle?method=DTG&styleNumber=${styleNumber}`);

    // 2. Get tier for quantity
    const tier = data.tiersR.find(t =>
        quantity >= t.MinQuantity && quantity <= t.MaxQuantity
    );

    // 3. Get base cost (lowest price)
    const baseCost = Math.min(...data.sizes
        .map(s => s.price)  // CRITICAL: Use 'price' not 'maxCasePrice'
        .filter(p => p > 0)
    );

    // 4. Get print cost for location and tier
    const printCost = data.allDtgCostsR.find(c =>
        c.PrintLocationCode === locationCode &&
        c.TierLabel === tier.TierLabel
    ).PrintCost;

    // 5. Calculate final price
    const markedUp = baseCost / tier.MarginDenominator;  // From API, not hardcoded
    const total = markedUp + printCost;
    const finalPrice = Math.ceil(total * 2) / 2;  // Round UP to half dollar

    return finalPrice;
}
```

### Combo Location Calculations
Combo locations sum the print costs of individual locations:
- `LC_FB` = LC cost + FB cost
- `FF_FB` = FF cost + FB cost
- `JF_JB` = JF cost + JB cost
- `LC_JB` = LC cost + JB cost

### Field Name Mapping Issues (Fixed 2025-01-29)
- **Problem**: Service was using `sizes[].maxCasePrice`
- **Solution**: Changed to `sizes[].price`
- **Impact**: ~$1 discrepancy in displayed prices
- **Files Fixed**: `/shared_components/js/dtg-pricing-service.js` lines 201 and 224

### Verification Examples
```javascript
// PC54 at qty 48, Left Chest
// Base: $2.85, Margin: 0.6, Print: $6.00
// $2.85/0.6 + $6.00 = $10.75 → $11.00 ✓

// PC61 at qty 73, Left Chest
// Base: $3.53, Margin: 0.6, Print: $5.00
// $3.53/0.6 + $5.00 = $10.88 → $11.00 ✓
```

### Size Upcharge Display Pattern (Added 2025-09-30)

**Problem**: How to show size upcharges without overwhelming the clean toggle UI

**Solution**: Contextual tooltip with progressive disclosure

**HTML Structure**:
```html
<div class="live-price-amount-wrapper">
    <span class="live-price-amount">$15.00</span>
    <i class="fas fa-info-circle upcharge-info-icon"></i>
</div>

<div id="upcharge-tooltip" class="upcharge-tooltip" style="display: none;">
    <div class="upcharge-tooltip-content">
        <div class="upcharge-tooltip-header">Size Pricing</div>
        <div id="upcharge-tooltip-body">
            <!-- Populated by JavaScript -->
        </div>
    </div>
</div>
```

**CSS Requirements**:
```css
.live-price-display {
    position: relative;  /* Required for absolute-positioned tooltip */
}

.live-price-amount-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.upcharge-tooltip {
    position: absolute;
    bottom: calc(100% + 15px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
}
```

**JavaScript Pattern**:
```javascript
function updateUpchargeTooltipContent() {
    // 1. Get available sizes from API (key pattern!)
    const availableSizes = pricingData?.pricing?.sizes?.map(s => s.size) || [];

    // 2. Get all upcharges from API
    const allUpcharges = pricingData?.pricing?.upcharges || {};

    // 3. Filter to only show sizes that exist for this product
    const upcharges = {};
    Object.entries(allUpcharges).forEach(([size, amount]) => {
        if (availableSizes.includes(size) && amount > 0) {
            upcharges[size] = amount;
        }
    });

    // 4. Build display with base sizes separately
    const baseSizes = availableSizes.filter(size => !upcharges[size]);
    let html = '';

    // Show base sizes (no upcharge)
    if (baseSizes.length > 0) {
        html += `<div class="upcharge-item">`;
        html += `<span class="upcharge-item-size">${baseSizes.join(', ')}</span>`;
        html += `<span class="upcharge-item-price">Base Price</span>`;
        html += `</div>`;
    }

    // Show upcharged sizes
    Object.keys(upcharges).sort().forEach(size => {
        html += `<div class="upcharge-item">`;
        html += `<span class="upcharge-item-size">${size}</span>`;
        html += `<span class="upcharge-item-price">+$${upcharges[size].toFixed(2)}</span>`;
        html += `</div>`;
    });

    tooltipBody.innerHTML = html;
}
```

**Event Listeners**:
```javascript
// Desktop: Show on hover
infoIcon.addEventListener('mouseenter', () => {
    if (window.innerWidth > 768) {
        updateUpchargeTooltipContent();
        tooltip.style.display = 'block';
    }
});

// Mobile: Show on tap
infoIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    updateUpchargeTooltipContent();
    tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
});

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (!tooltip.contains(e.target) && e.target !== infoIcon) {
        tooltip.style.display = 'none';
    }
});
```

**Reference Implementation**:
- Filtering logic: `/shared_components/js/universal-pricing-grid.js:103-115`
- Complete tooltip: `/calculators/dtg-pricing.html:2169-2239`

**Key Principles**:
1. **Filter by available sizes** - Don't show upcharges for sizes the product doesn't have
2. **Separate base vs upcharge** - Clear distinction between standard and upcharged sizes
3. **Progressive disclosure** - Show only when user needs it
4. **Mobile-friendly** - Tap to show, tap outside to hide

## 🔄 State Management Patterns

### Where to Store State

| State Type | Storage Location | When to Use | Example |
|------------|-----------------|-------------|---------|
| Session Data | sessionStorage | Current session only | Cart items, temp selections |
| User Preferences | localStorage | Persist across sessions | Theme, saved quotes |
| Temporary UI | Memory (JS vars) | Page lifetime only | Form inputs, modals |
| Server State | Database via API | Permanent storage | Quotes, orders |

### State Synchronization Pattern
```javascript
// Sync cart between tabs/windows
window.addEventListener('storage', function(e) {
    if (e.key === 'cart') {
        updateCartUI(JSON.parse(e.newValue));
    }
});

// Update storage and broadcast
function updateCart(items) {
    localStorage.setItem('cart', JSON.stringify(items));
    window.dispatchEvent(new Event('cartUpdated'));
}
```

## 🐛 Common Issues & Fixes

### Issue: EmailJS "Corrupted variables"
**Fix**: Add missing variables with defaults
```javascript
// Always provide defaults
customer_name: data.customerName || '',
customer_email: data.customerEmail || '',
```

### Issue: Database not saving
**Fix**: Check endpoint and field names match exactly
```javascript
// Field names must match database columns EXACTLY
quote_id: quoteID,      // Not quoteId or quote_ID
customer_name: name,    // Not customerName
```

### Issue: Quote ID not showing
**Fix**: Add display element in success message
```javascript
document.getElementById('quoteIdDisplay').textContent = quoteID;
```

### Issue: Script parsing error
**Fix**: Escape closing tags
```javascript
// In dynamically generated HTML:
scriptContent.replace(/<\/script>/g, '<\\/script>');
```

### Issue: CSS not updating
**Fix**: Add cache-busting parameter
```html
<link rel="stylesheet" href="styles.css?v=20250928">
```

## 🧪 Browser Testing Checklist

### Quick Console Commands for Testing
```javascript
// Check if pricing loaded
console.log('Pricing data:', window.pricingData);

// Test adapter status
console.log('DTG Adapter:', window.DTGAdapter?.masterBundle ? 'Loaded' : 'Not loaded');

// Verify quote service
const testQuote = new DTGQuoteService();
console.log('Quote ID test:', testQuote.generateQuoteID());

// Check all loaded adapters
Object.keys(window).filter(key => key.includes('Adapter')).forEach(adapter => {
    console.log(`${adapter}:`, window[adapter] ? 'Loaded' : 'Not loaded');
});

// Test API connection
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => r.json())
    .then(d => console.log('API Status:', d))
    .catch(e => console.error('API Error:', e));

// Clear all caches (nuclear option)
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

## 🐛 Debug First Aid Kit

### Common Issues with Instant Fixes

```javascript
// 1. Pricing not showing
// Fix: Force reload pricing data
window.location.reload(true);

// 2. Cart items stuck
// Fix: Clear and rebuild
localStorage.removeItem('cart');
sessionStorage.clear();
window.location.href = '/cart.html';

// 3. API errors
// Fix: Check proxy status
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => console.log('API is', r.ok ? 'UP' : 'DOWN'));

// 4. EmailJS not working
// Fix: Reinitialize
emailjs.init('4qSbDO-SQs19TbP80');

// 5. Quote ID conflicts
// Fix: Add timestamp to make unique
const uniqueID = `${quoteID}-${Date.now()}`;
```

### Debug Mode Toggle
```javascript
// Add to any page for verbose logging
window.DEBUG = true;

function debugLog(...args) {
    if (window.DEBUG) console.log('[DEBUG]', ...args);
}
```

## 🎨 UI/UX Standards

### Loading States
```javascript
// ALWAYS show loading state during async operations
async function loadData() {
    const container = document.getElementById('data-container');

    // Show loading
    container.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';

    try {
        const data = await fetchWithErrorHandling('/api/endpoint');
        // Update UI with data
        container.innerHTML = renderData(data);
    } catch (error) {
        // Show error state
        container.innerHTML = '<div class="alert alert-danger">Failed to load data</div>';
    }
}
```

### Form Validation Timing
```javascript
// Validate on blur, not while typing
input.addEventListener('blur', function() {
    validateField(this);
});

// Show errors clearly
function showFieldError(field, message) {
    field.classList.add('is-invalid');
    const errorDiv = field.nextElementSibling;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}
```

### Button States
```javascript
// Disable during processing
async function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    const originalText = btn.textContent;

    // Disable and show processing
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

    try {
        await processForm();
    } finally {
        // Always restore button
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
```

## 🔍 Search & Discovery Helpers

**Run these BEFORE starting any task:**

```bash
# Find where a function is defined
grep -r "functionName" --include="*.js" --exclude-dir="node_modules"

# Find all uses of an API endpoint
grep -r "/api/endpoint" --include="*.js" --exclude-dir="node_modules"

# Check if similar functionality exists
find . -name "*feature-name*" -not -path "./node_modules/*"

# Find all TODO comments
grep -r "TODO" --include="*.js" --include="*.html"

# List all event listeners in a file
grep -E "addEventListener|on[A-Z]" filename.js

# Find hardcoded values that should be config
grep -r "253-922-5793\|caspio\|herokuapp" --include="*.js"
```

---

**Documentation Type**: Code Patterns & Solutions Reference
**Parent Document**: [CLAUDE.md](/CLAUDE.md)
**Related**: [Architecture](CLAUDE_ARCHITECTURE.md) | [Workflows](CLAUDE_WORKFLOW.md)