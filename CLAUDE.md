# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 TOP 5 NEVER-BREAK RULES (Read First!)

These rules prevent disasters. **Violating any of these caused 71+ orphaned files requiring massive cleanup.**

1. **🚫 NO Version Suffix Files** - Never create `-backup`, `-FINAL`, `-FIXED`, `-old` files. Use Git branches.
2. **📁 NO Test Files in Root** - ALL test files go in `/tests/` folder. No exceptions.
3. **💾 NO Inline Code** - Zero `<style>` or `<script>` tags with content in HTML files.
4. **⚠️ NO Silent API Failures** - ALWAYS show errors when API fails. Never use fallback data silently.
5. **📝 ALWAYS Update ACTIVE_FILES.md** - Every file create/delete/move must update documentation immediately.

```bash
# Quick violation check (run this NOW and fix any issues):
find . -name "*-backup*" -o -name "*-FINAL*" | head -5  # Must return nothing
find . -maxdepth 1 -name "*test*" | head -5              # Must return nothing
grep -l "style=" --include="*.html" -r . | head -5       # Should return nothing
```

## 📋 Table of Contents

- [Pre-Flight Checklist](#pre-flight-checklist) - Before ANY code changes
- [Critical Rules (Tier 1)](#tier-1-critical-rules) - Prevent disasters
- [Important Standards (Tier 2)](#tier-2-important-standards) - Maintain quality
- [Project Overview](#project-overview) - System architecture
- [Development Commands](#development-commands) - How to run the app
- [Common Issues & Fixes](#common-issues--fixes) - Quick solutions
- [Additional Resources](#additional-resources) - Helpful references

## Pre-Flight Checklist

### 🚀 Quick Check Before ANY Work:
```bash
# Run this 3-line check before starting:
find . -name "*-backup*" -o -name "*-FINAL*" | head -3  # Must be empty
find . -name "*test*" -not -path "./tests/*" -not -path "./node_modules/*" | head -3  # Must be empty
grep -r "console.log" --include="*.js" --exclude-dir="tests" --exclude-dir="node_modules" | head -3  # Should be empty
```

### 📁 Creating New Files:
1. **Default to subdirectory** (never root unless whitelisted)
2. **Check ACTIVE_FILES.md** for existing functionality
3. **Use kebab-case** naming (no spaces, no CAPS)
4. **No inline code** - always external JS/CSS files

### ✏️ Before Committing:
1. **Remove all console.logs**
2. **Update ACTIVE_FILES.md**
3. **No hardcoded URLs** (use config)
4. **Descriptive commit message**

## Tier 1: CRITICAL Rules (Prevent Disasters)

### 🗂️ File Organization
| Rule | ❌ NEVER | ✅ ALWAYS |
|------|----------|-----------|
| Test Files | In root directory | In `/tests/` folder |
| Versions | file-backup.js, file-FINAL.js | Use Git branches |
| Styles/Scripts | Inline in HTML | External files only |
| Documentation | Create orphaned files | Update ACTIVE_FILES.md |

### 📂 Root Directory Whitelist (ONLY these allowed):
- **Main HTML pages**: index.html, cart.html, product.html
- **Essential configs**: package.json, server.js, .env.example
- **Critical docs**: README.md, CLAUDE.md, ACTIVE_FILES.md
- **Everything else**: MUST go in subdirectories

### 🚫 API Error Handling (Erik's #1 Rule)
```javascript
// ❌ NEVER - Silent fallback
try {
  const data = await fetchAPI();
} catch (error) {
  const data = getCachedData(); // NO! Will cause wrong pricing
}

// ✅ ALWAYS - Visible failure
try {
  const data = await fetchAPI();
} catch (error) {
  showErrorBanner('Unable to load pricing. Please refresh.');
  console.error('API failed:', error);
  throw error; // Stop execution
}
```
**Remember:** Wrong pricing data is WORSE than showing an error!

## Tier 2: IMPORTANT Standards (Maintain Quality)

### 🧹 Code Cleanliness
- **No console.logs** in production code
- **No commented-out code** (use Git history)
- **No hardcoded URLs** (use config files)
- **Clear variable names** (no single letters except loops)
- **Descriptive commit messages** (not "fixes" or "WIP")

### 🔄 Git Best Practices
```bash
# Use branches for features
git checkout -b feature/new-calculator

# Clear commit messages
git commit -m "Add DTG pricing calculator with quote generation"  # Good
git commit -m "fixes"  # Bad

# Delete merged branches
git branch -d feature/new-calculator
```


## Project Overview

The NWCA Pricing System provides dynamic pricing calculators for apparel decoration (DTG, embroidery, screen printing, etc.) with quote generation and database persistence.

## Development Commands

```bash
npm start          # Start Express server (port 3000) - That's it!

# Optional: For safety tools testing (local only)
npm install puppeteer  # NOT needed for production/Heroku
```

### ⚠️ No Webpack/Build System
This app uses **simple static file serving** - no build step, no bundling, no webpack. We removed 18 webpack dependencies on 2025-01-27 because they added zero value. Keep it simple!

## 📁 WHERE DOES MY FILE GO? Complete Directory Guide

### Decision Tree for File Placement:
```
Creating a new file? Start here:
├─ Test file? → `/tests/`
│  ├─ UI test? → `/tests/ui/`
│  ├─ API test? → `/tests/api/`
│  └─ Unit test? → `/tests/unit/`
├─ Calculator? → `/calculators/`
├─ Quote builder? → `/quote-builders/`
├─ Dashboard? → `/dashboards/`
├─ Art/design tool? → `/art-tools/`
├─ Admin interface? → `/admin/`
├─ Vendor portal? → `/vendor-portals/`
├─ General page? → `/pages/`
├─ Policy document? → `/policies/`
├─ JavaScript file?
│  ├─ Shared/reusable? → `/shared_components/js/`
│  ├─ Calculator-specific? → `/calculators/`
│  └─ Page-specific? → Same folder as HTML
├─ CSS file?
│  ├─ Shared styles? → `/shared_components/css/`
│  └─ Page-specific? → Same folder as HTML
├─ Documentation? → `/docs/`
├─ Script/utility? → `/scripts/`
├─ Email template? → `/email-templates/`
└─ Is it index.html, cart.html, or product.html? → Root (ONLY THESE!)
   └─ Everything else → MUST go in a subdirectory!
```

### Directory Purpose Reference:
| Directory | Purpose | Example Files |
|-----------|---------|---------------|
| `/admin/` | Administrative tools | user-management.html, reports.html |
| `/art-tools/` | Art department tools | art-request-form.html, design-tracker.html |
| `/calculators/` | Pricing calculators | dtg-calculator.html, embroidery-pricing.html |
| `/dashboards/` | Staff dashboards | sales-dashboard.html, art-hub.html |
| `/pages/` | Secondary pages | about.html, policies-hub.html, resources.html |
| `/quote-builders/` | Quote generation | screen-print-quote.html, bundle-builder.html |
| `/tests/` | ALL test files | test-pricing.html, test-api.js |
| `/tools/` | Utility tools | inventory-checker.html, file-monitor.js |
| `/vendor-portals/` | Vendor pages | sanmar-portal.html, alphabroder.html |
| `/shared_components/` | Reusable code | adapters, common styles, utilities |

## ✅ File Creation Enforcement Checklist

**BEFORE creating ANY new file, complete this checklist:**

```markdown
□ 1. Is this a test file? → MUST go in /tests/ (no exceptions)
□ 2. Check the decision tree above → Follow the path to correct directory
□ 3. Does similar functionality exist? → Check ACTIVE_FILES.md first
□ 4. Is it going in root? → Only allowed if it's index.html, cart.html, or product.html
□ 5. Using proper naming? → kebab-case, no spaces, no CAPS, descriptive
□ 6. External JS/CSS? → No inline <script> or <style> tags with content
□ 7. Will you update ACTIVE_FILES.md? → Required immediately after creation
```

**Red flags that you're doing it wrong:**
- ❌ Creating `test-new-feature.html` in root → Should be `/tests/ui/test-new-feature.html`
- ❌ Creating `pricing-backup.js` → Use Git branches instead
- ❌ Creating `temp-fix.css` → Make proper fix or don't create file
- ❌ Adding inline styles → Create external CSS file
- ❌ Not updating ACTIVE_FILES.md → Creates orphaned files

## 🚨 Common Mistakes That Created 71+ Orphaned Files

### Mistake #1: Test Files in Root
**❌ WRONG:**
```bash
/test-dtg-pricing.html        # Test file in root
/test-api-integration.js      # Another test in root
/test-cap-summary.html        # Yet another in root
```
**✅ CORRECT:**
```bash
/tests/ui/test-dtg-pricing.html
/tests/api/test-api-integration.js
/tests/calculators/test-cap-summary.html
```

### Mistake #2: Version Suffixes Instead of Git
**❌ WRONG:**
```bash
cart-backup.js
cart-FINAL.js
cart-FIXED.js
cart-old.js
cart-temp.js
```
**✅ CORRECT:**
```bash
# Use Git branches for versions
git checkout -b fix/cart-calculation
# Make changes to cart.js
git commit -m "Fix cart calculation logic"
```

### Mistake #3: Scattered Secondary Pages
**❌ WRONG:**
```bash
/inventory-details.html    # Secondary page in root
/policies-hub.html         # Another secondary page in root
/resources.html            # More clutter in root
```
**✅ CORRECT:**
```bash
/pages/inventory-details.html
/pages/policies-hub.html
/pages/resources.html
```

### Mistake #4: Not Checking Before Creating
**❌ WRONG:**
```javascript
// Developer creates new pricing utility
// without checking existing code
function calculatePricing() { /* new code */ }
```
**✅ CORRECT:**
```javascript
// First check ACTIVE_FILES.md
// Found: /shared_components/js/pricing-utils.js already exists
// Use existing utility instead of creating duplicate
```

### Mistake #5: Forgetting to Update Documentation
**❌ WRONG:**
```bash
# Create new file
touch /calculators/new-calculator.html
# Start working immediately without documentation
```
**✅ CORRECT:**
```bash
# Create new file
touch /calculators/new-calculator.html
# IMMEDIATELY update ACTIVE_FILES.md
echo "- /calculators/new-calculator.html - New calculator for X" >> ACTIVE_FILES.md
```

## 🏗️ Code Patterns Library (Copy & Paste These!)

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

## System Architecture

### Key Components:
1. **Adapters** (`/shared_components/js/*-adapter.js`) - Handle pricing data from Caspio
2. **Quote System** - Two tables: `quote_sessions` + `quote_items`, ID pattern: `[PREFIX][MMDD]-seq`
3. **API Proxy** - `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
4. **Cart Management** - Session-based, single embellishment type per cart

### 🌐 API Details
- **Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Key Endpoints**: `/api/quote_sessions`, `/api/quote_items`
- **Quote Pattern**: `[PREFIX][MMDD]-seq` (e.g., DTG0130-1)
- **Full API Documentation**: @memory/CASPIO_API_TEMPLATE.md (55 endpoints, shared with API provider)

### 📍 Important Notes:
1. **New Pages**: Must add to route config and restart server with Erik
2. **API Failures**: Always visible - never silent (see API Error Handling above)

## 🎯 Performance Guidelines

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

## 🏁 Feature Implementation Workflow

**ALWAYS follow this order:**

1. **Research Phase**
   ```bash
   # Check if similar feature exists
   grep -r "feature-keyword" --include="*.js"
   # Read adjacent files
   ls -la calculators/ | grep similar-feature
   ```

2. **Planning Phase**
   - Update todo list with subtasks
   - Check ACTIVE_FILES.md for dependencies
   - Identify which patterns to reuse

3. **Implementation Phase**
   ```bash
   # Create feature branch
   git checkout -b feature/new-feature-name
   # Immediately add to ACTIVE_FILES.md
   echo "- /path/to/new-file.html - Description" >> ACTIVE_FILES.md
   ```

4. **Testing Phase**
   ```javascript
   // Test in browser console
   console.log('Component loaded:', window.ComponentName);
   // Verify API calls
   console.log('API response:', await fetchWithErrorHandling('/endpoint'));
   ```

5. **Documentation Phase**
   - Update relevant .md files
   - Add usage examples
   - Document any new patterns

6. **Commit Phase**
   ```bash
   git add .
   git commit -m "Add [feature]: [what it does and why]"
   ```

## 📊 Data Flow Documentation

### How Data Flows Through the System
```
User Interaction → Frontend → API Proxy → Caspio Database
        ↓              ↓           ↓              ↓
   Form Submit    Validation   Heroku Server   Data Storage
        ↓              ↓           ↓              ↓
   Event Handler   Format Data  Process       Return Data
        ↓              ↓           ↓              ↓
   Display ← Update UI ← Transform ← Response
```

### Master Bundle Flow (Pricing Data)
```
Caspio DataPage (iframe) → PostMessage → Adapter
         ↓                      ↓           ↓
   Calculate Prices      Send Bundle    Store Data
         ↓                      ↓           ↓
    All Permutations     JSON Package  Local Memory
         ↓                      ↓           ↓
   User Selection ← Extract Price ← Dispatch Event
```

## 🔄 State Management Rules

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

## ✅ Code Review Checklist

**Before marking ANY task complete:**

```markdown
□ No console.log statements remain
□ All API calls have error handling with user feedback
□ ACTIVE_FILES.md updated if files were added/moved
□ Follows existing patterns (check similar files)
□ Tested in browser (not just assuming it works)
□ No hardcoded values (use config)
□ Loading states shown for async operations
□ Form validation provides clear error messages
□ Success messages show relevant IDs/confirmations
□ Mobile responsive (test at 375px width)
□ No inline styles or scripts
□ Git commit message describes what and why
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

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| EmailJS "Corrupted variables" | Add missing variables with defaults (`\|\| ''`) |
| Database not saving | Check endpoint `/api/quote_sessions` and field names |
| Quote ID not showing | Add display element in success message |
| Script parsing error | Escape closing tags: `<\/script>` |
| CSS not updating | Add cache-busting parameter to stylesheet |

## 🚀 Quick Start Templates

### New Calculator Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEW Calculator - Northwest Custom Apparel</title>
    <link rel="stylesheet" href="/shared_components/css/universal-calculator-theme.css">
    <link rel="stylesheet" href="/shared_components/css/universal-header.css">
</head>
<body>
    <div id="header-placeholder"></div>

    <div class="container mt-4">
        <h1>NEW Pricing Calculator</h1>
        <div id="loading" class="text-center">
            <div class="spinner-border"></div>
        </div>
        <div id="calculator-content" style="display:none;">
            <!-- Your calculator HTML here -->
        </div>
    </div>

    <script src="https://cdn.emailjs.com/dist/email.min.js"></script>
    <script>emailjs.init('4qSbDO-SQs19TbP80');</script>
    <script src="/shared_components/js/universal-header.js"></script>
    <script src="/calculators/new-calculator-service.js"></script>
</body>
</html>
```

### New Service File Template
```javascript
// new-calculator-service.js
class NEWQuoteService {
    constructor() {
        this.quotePrefix = 'NEW';
        this.emailTemplate = 'template_xxxxx'; // Get from EmailJS
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
    }

    async initialize() {
        try {
            // Load any initial data
            await this.loadPricingData();
            document.getElementById('loading').style.display = 'none';
            document.getElementById('calculator-content').style.display = 'block';
        } catch (error) {
            this.showError('Failed to initialize calculator');
        }
    }

    async loadPricingData() {
        // Implement your data loading logic
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger';
        alert.textContent = message + ' Please call 253-922-5793 for assistance.';
        document.querySelector('.container').insertBefore(alert, document.querySelector('.container').firstChild);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const service = new NEWQuoteService();
    service.initialize();
});
```

### API Integration Template
```javascript
class APIService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
    }

    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }

    async request(method, endpoint, data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showUserError();
            throw error;
        }
    }

    showUserError() {
        // Show user-friendly error message
        alert('Service temporarily unavailable. Please call 253-922-5793.');
    }
}
```

## 🛠️ Environment & Config Management

### Central Configuration Pattern
Create `/config/app.config.js`:
```javascript
window.APP_CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3
    },

    // EmailJS Configuration
    EMAIL: {
        PUBLIC_KEY: '4qSbDO-SQs19TbP80',
        SERVICE_ID: 'service_1c4k67j',
        TEMPLATES: {
            DTG: 'template_dtg_quote',
            EMB: 'template_emb_quote',
            // Add all template IDs here
        }
    },

    // Company Information
    COMPANY: {
        NAME: 'Northwest Custom Apparel',
        PHONE: '253-922-5793',
        EMAIL: 'sales@nwcustomapparel.com',
        FOUNDED: 1977,
        LOGO_URL: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png'
    },

    // Quote Configuration
    QUOTES: {
        PREFIXES: {
            DTG: 'Direct-to-Garment',
            RICH: 'Richardson Caps',
            EMB: 'Embroidery Contract',
            EMBC: 'Customer Supplied Embroidery',
            LT: 'Laser Tumblers',
            PATCH: 'Embroidered Emblems'
        },
        ID_PATTERN: '[PREFIX][MMDD]-[sequence]'
    },

    // Feature Flags
    FEATURES: {
        ENABLE_DEBUG: false,
        SHOW_PRICING_DEBUG: false,
        CACHE_DURATION: 300000, // 5 minutes
        MAX_CART_ITEMS: 50
    },

    // Error Messages
    ERRORS: {
        API_DOWN: 'Service temporarily unavailable. Please call 253-922-5793.',
        INVALID_INPUT: 'Please check your input and try again.',
        SESSION_EXPIRED: 'Your session has expired. Please refresh the page.'
    }
};

// Usage in your code:
// const apiURL = window.APP_CONFIG.API.BASE_URL;
// const phone = window.APP_CONFIG.COMPANY.PHONE;
```

### Environment Detection
```javascript
// Add to app.config.js
window.APP_CONFIG.ENV = {
    isDevelopment: window.location.hostname === 'localhost',
    isStaging: window.location.hostname.includes('staging'),
    isProduction: window.location.hostname === 'nwcustomapparel.com',

    // Override settings based on environment
    getAPIUrl() {
        if (this.isDevelopment) return 'http://localhost:3000/api';
        return window.APP_CONFIG.API.BASE_URL;
    }
};
```

### 🔑 Quick Reference
```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793

Quote Prefixes: DTG, RICH, EMB, EMBC, LT, PATCH, SPC, SSC, WEB
```

### 📚 Key Memory References
- **@memory/QUOTE_BUILDER_GUIDE.md** - Complete guide for creating new quote builders
  - 3-phase architecture (Setup → Products → Review)
  - Required 18+ shared components with exact load order
  - Service class templates with business logic
  - EmailJS integration with required variables
  - Database patterns (quote_sessions + quote_items)
  - Testing checklist and common pitfalls
- **@memory/PRICING_CALCULATOR_GUIDE.md** - Complete guide for creating pricing calculators
  - Clear distinction between calculators vs quote builders
  - Two architecture patterns: Adapter (DTG/DTF) and Service (Screen Print/Embroidery)
  - Master bundle data structure and tier-based pricing logic
  - Complete HTML/JavaScript templates for both patterns
  - API integration with bundle endpoints and caching
  - Testing utilities and debugging tools
- **@memory/BUNDLE_CALCULATOR_GUIDE.md** - Complete guide for creating promotional bundles
  - Two bundle patterns: Simple Fixed (BCA) vs Complex Multi-Product (Christmas)
  - Multi-step wizard implementation with validation
  - Gift box visualization and animations
  - Size distribution management for apparel bundles
  - Bundle pricing strategies (fixed, tiered, dynamic)
  - Database persistence with quote generation
  - Testing utilities and common issues
- **@memory/MANUAL_PRICING_CALCULATOR_GUIDE.md** - Complete guide for all pricing calculator types
  - Three categories: Manual, Contract/Corporate, and Specialty calculators
  - Manual pricing formula with margin denominators and tier logic
  - Shared architecture with manual-calculator-styles.css
  - Base cost input patterns and validation
  - LTM fee calculations and minimum order enforcement
  - Complete templates for each calculator type
  - Testing utilities and quick reference matrix
- **@memory/STAFF_DIRECTORY.md** - Current staff emails and contact info for dropdowns
- **@memory/DATABASE_PATTERNS.md** - Database schema for quote_sessions and quote_items
- **@memory/FILE_UPLOAD_API_REQUIREMENTS.md** - File upload API specifications

### 🧮 Active Calculators & Quote Builders
- **DTG** - Direct-to-garment contract pricing
- **RICH** - Richardson caps
- **EMB** - Embroidery contract
- **EMBC** - Customer supplied embroidery
- **LT** - Laser tumblers
- **PATCH** - Embroidered emblems

**📘 Creating a New Quote Builder?** See @memory/QUOTE_BUILDER_GUIDE.md for complete implementation patterns including the 3-phase architecture, required files, and testing checklist.

### 🎨 Art Systems
- **Art Invoices** - `/art-invoices-dashboard.html`, service codes (GRT-25, GRT-50, etc.)
- **Art Hub** - Role-based dashboards for AEs and Artists

## Additional Resources

### 📚 Documentation
- **CLAUDE_CODING_STANDARDS.md** - Detailed coding standards
- **ACTIVE_FILES.md** - Registry of all active files
- **MONITORING_SETUP.md** - File monitoring system (optional dev tool)

### 🔧 Safety Tools (Optional)
```bash
# Enable monitoring (development only, disabled by default)
ENABLE_MONITORING=true npm start

# Quarantine files instead of deleting (90-day recovery)
node scripts/safety-tools/safe-delete.js quarantine [file] [reason]

# Dependency analysis
node scripts/safety-tools/dependency-mapper.js
```

### 📂 Documentation Locations
- **Root directory**: Active docs (CLAUDE.md, ACTIVE_FILES.md, README.md)
- **/docs/archive/**: Historical/completed documentation
- **/memory/**: API specifications only (not for general docs)

---

**Remember:** This document focuses on preventing the disasters that led to 71+ orphaned files. When in doubt, check the Top 5 Never-Break Rules at the beginning of this file.