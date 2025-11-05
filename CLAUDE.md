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
- [Backend API Development](#backend-api-development) - **NEW** - Two-repo workflow
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

## 🔗 Backend API Development

### Two-Repository Architecture

This project (Pricing Index File 2025) is the **frontend** - quote builders, calculators, pricing pages.

The **backend** (API server) is in a separate repository:
- **Location:** `../caspio-pricing-proxy` (sibling directory)
- **Purpose:** Express server providing API endpoints
- **Port:** 3002 (local development), Heroku (production)
- **Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

### When to Work in Each Repository

**Stay in Pricing Index File 2025 (this project) for:**
- Quote builders and calculators
- Pricing page UI
- Using existing API endpoints
- Frontend bug fixes
- Adding new pages (requires route in backend)

**Open caspio-pricing-proxy (separate VS Code window) for:**
- Creating new API endpoints
- Modifying backend server logic
- Backend documentation
- Route file organization
- Server deployment

### Cross-Repository Workflow

**Example: Adding a new quote builder page**

1. **Frontend (this project):**
   - Create quote builder HTML/JS
   - Use existing API endpoints for data

2. **Backend (caspio-pricing-proxy):**
   - Add route for new page in server.js:
     ```javascript
     app.get('/new-quote-builder.html', (req, res) => {
       res.sendFile(path.join(__dirname, 'quote-builders', 'new-quote-builder.html'));
     });
     ```
   - Restart server

3. **If new API endpoints needed:**
   - Work in backend repository
   - Add endpoints to `/routes/` folder
   - Deploy to Heroku
   - Update API documentation in both repos

### Backend Documentation Locations

**In Backend Repository (caspio-pricing-proxy/memory/):**
- `API_DOCUMENTATION.md` - Complete API reference (provider perspective)
- `DEVELOPER_GUIDE.md` - Backend development guide
- `MANAGEORDERS_INTEGRATION.md` - ManageOrders proxy implementation
- `ONLINE_STORE_DEVELOPER_GUIDE.md` - Webstore integration

**In This Repository (memory/):**
- `CASPIO_API_CORE.md` - API reference (consumer perspective)
- `manageorders/` - ManageOrders usage guides
- Backend docs = "how to build it"
- Frontend docs = "how to use it"

### Environment Variables

Backend uses environment variables for:
- Caspio credentials
- ManageOrders credentials
- EmailJS keys
- Port configuration

See `caspio-pricing-proxy/.env.example` for complete list.

**DO NOT** store credentials in frontend code.

### Quick Reference

```bash
# Open backend in new VS Code window
cd ../caspio-pricing-proxy
code .

# Test backend locally
npm start  # Runs on port 3002

# Check backend endpoints
curl http://localhost:3002/api/health
```

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

## 🏗️ Code Patterns Library

For reusable code templates including API fetch patterns, Quote service templates, EmailJS integration, Modal implementations, and Form validation, see **@memory/CLAUDE_PATTERNS.md**

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
- **Full API Documentation**: @memory/CASPIO_API_CORE.md (56 endpoints, modularized in @memory/api/)

### 📊 ManageOrders API (ShopWorks Integration)
- **PULL API (Read Data)**: 11 endpoints for reading from ShopWorks OnSite 7
  - Real-time inventory (5-minute cache) - **CRITICAL** for webstores
  - Customer data, orders, payments, tracking
  - Full documentation: @memory/MANAGEORDERS_INTEGRATION.md
- **PUSH API (Create Orders)**: 4 endpoints for writing orders to ShopWorks
  - Webstore checkout → automatic order creation in OnSite
  - POST /api/manageorders/orders/create
  - Full documentation: @memory/MANAGEORDERS_PUSH_WEBSTORE.md
  - Complete developer guide: caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md

### 📍 Important Notes:
1. **New Pages**: Must add to route config and restart server with Erik
   - Pages in `/pages/` directory need explicit routes in server.js
   - Add route like: `app.get('/page-name.html', (req, res) => { res.sendFile(path.join(__dirname, 'pages', 'page-name.html')); });`
   - Server restart required after adding route
2. **API Failures**: Always visible - never silent (see API Error Handling above)

## 🏗️ Advanced Architecture Patterns

For detailed architecture patterns including Adapter pattern, Quote Builder safety features, Dual API integration, Configuration management, and more, see **@memory/CLAUDE_ARCHITECTURE.md**

## 🎯 Performance Guidelines

For performance optimization patterns including image optimization, JavaScript performance, caching strategies, and loading states, see **@memory/CLAUDE_PATTERNS.md**

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

## 🆕 Managing "New Products" Showcase (API-Driven Feature)

### Overview
The "New Products" filter button on Top Sellers Showcase is **API-driven** - products automatically appear when marked with `IsNew` flag in database. This is the **only dynamic filter** (all other categories use static hardcoded arrays).

**Key Architectural Difference:**
- **Other Filters** (Bestsellers, T-Shirts, Polos, etc.): Static arrays in `top-sellers-showcase.html`
- **New Products Filter**: Dynamic API query to `/api/products/new`

### Quick Reference Commands

```bash
# Add single new product
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["NE215"]}'

# Add multiple new products
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["EB120", "EB121", "DT620", "NE410", "ST850"]}'

# Remove all new products (reset)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# Check current new products
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"

# Remove single product (option 1 - direct update)
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/NE215" \
  -H "Content-Type: application/json" \
  -d '{"IsNew": 0}'
```

### Complete Workflow

**Scenario 1: Add Products to "New Products" Section**

1. **Identify products** by style number (e.g., NE215, EB120, DT620)
2. **Mark as new** using bulk endpoint:
   ```bash
   curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
     -H "Content-Type: application/json" \
     -d '{"styles": ["NE215", "EB120", "DT620"]}'
   ```
3. **Wait 5 minutes** for API cache to expire (or force browser refresh)
4. **Verify** by visiting `http://localhost:3000/pages/top-sellers-showcase.html` and clicking "New Products" button

**Scenario 2: Replace All New Products**

1. **Clear existing** new products:
   ```bash
   curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
     -H "Content-Type: application/json" \
     -d '{"confirm": true}'
   ```
2. **Mark new set**:
   ```bash
   curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
     -H "Content-Type: application/json" \
     -d '{"styles": ["EB120", "EB121", "DT620", "NE410"]}'
   ```
3. **Wait 5 minutes** for cache
4. **Verify** on website

**Scenario 3: Remove Single Product**

```bash
# Option A: Direct update (fastest)
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/NE215" \
  -H "Content-Type: application/json" \
  -d '{"IsNew": 0}'

# Option B: Clear all and re-mark others
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-isnew" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["EB120", "EB121", "DT620"]}'
```

### How It Works

**Frontend Implementation** (`/pages/top-sellers-showcase.html`):

```javascript
// When "New Products" button clicked
if (type === 'newProducts') {
    // Fetch from API (NOT hardcoded array)
    const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new?limit=100');
    const result = await response.json();
    const products = result.products || [];

    // Group by style (eliminate color duplicates)
    const uniqueProducts = new Map();
    products.forEach(p => {
        if (!uniqueProducts.has(p.STYLE)) {
            uniqueProducts.set(p.STYLE, p);
        }
    });

    // Filter out DISCONTINUED products
    const activeProducts = Array.from(uniqueProducts.values()).filter(p =>
        !p.PRODUCT_TITLE?.includes('DISCONTINUED') &&
        !p.PRODUCT_DESCRIPTION?.includes('DISCONTINUED')
    );

    // Display product cards
    allProducts = activeProducts.map(product => ({
        style: product.STYLE,
        description: product.PRODUCT_TITLE?.split('.')[0]?.trim(),
        brand: product.MILL,
        imageUrl: product.COLOR_PRODUCT_IMAGE || product.PRODUCT_IMAGE || product.THUMBNAIL_IMAGE
    }));
}
```

**Backend API** (`/api/products/new`):
- Queries Caspio database for products where `IsNew=1`
- Returns all color variants (frontend deduplicates)
- 5-minute server-side cache
- No authentication required

### Available Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/products/new` | GET | Get new products | No |
| `/api/product-details` | GET | Get product info | No |
| `/api/products/{style}` | PUT | Update product | No |
| `/api/admin/products/mark-as-new` | POST | Mark as new (bulk) | No |
| `/api/admin/products/clear-isnew` | POST | Clear all IsNew flags | No |
| `/api/tables/{table}/fields` | POST | Create field (infrastructure) | No |
| `/api/tables/{table}/fields/{field}` | GET | Get field schema | No |

**Complete endpoint documentation:** See `memory/api/products-api.md` → "New Products Management" section

### Important Behaviors

1. **Cache Delay**: Changes take up to 5 minutes to appear (server cache TTL)
2. **Deduplication**: Frontend groups color variants by style number (one card per style)
3. **Auto-Filtering**: DISCONTINUED products excluded automatically
4. **Image Priority**: COLOR_PRODUCT_IMAGE → PRODUCT_IMAGE → THUMBNAIL_IMAGE → brand placeholder
5. **No Database Changes Needed**: Just toggle `IsNew` flag, no code changes required

### Troubleshooting

**Problem: Products not appearing after marking as new**
- ✅ Wait 5 minutes for cache (or force browser refresh: Ctrl+Shift+R)
- ✅ Verify product not DISCONTINUED: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/product-details?styleNumber=NE215"`
- ✅ Check API response: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"`
- ✅ Check browser console for JavaScript errors

**Problem: Wrong products showing**
- ✅ Use clear-isnew endpoint to reset all
- ✅ Re-mark only desired products
- ✅ Verify which products marked: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"`

**Problem: Images not loading**
- ✅ Check product has image URL in Caspio database
- ✅ Verify URL is accessible
- ✅ Fallback to brand placeholder if no image

### Testing Checklist

Before marking task complete:

- [ ] Products marked via API: `curl -X POST .../mark-as-new`
- [ ] Waited 5 minutes for cache (or tested with force refresh)
- [ ] Verified on website: `/pages/top-sellers-showcase.html`
- [ ] Clicked "New Products" button
- [ ] Confirmed correct products display
- [ ] Checked images loading properly
- [ ] Verified DISCONTINUED products filtered out
- [ ] No JavaScript errors in browser console

### Filter System Architecture & UI Patterns

**Filter Toggle Behavior:**
- Secondary filters (Brinton's Fresh Picks, DTG-Compatible) support toggle on/off by clicking again
- When toggling off, system returns to previous active filter or "All Products" if none
- DTG filter has separate handler to preserve education modal functionality

**Critical Selector Matching:**
⚠️ JavaScript querySelector must match actual HTML classes to prevent "Uncaught TypeError"
- Example issue: JavaScript searches for `.dtg-filter-btn` but HTML uses `.badge-filter`
- Always verify selector matches before adding event listeners
- Use browser DevTools to confirm element exists with expected class

**Badge Visibility Best Practice:**
- Use solid color backgrounds with contrasting text (e.g., white text on solid green)
- Avoid transparent backgrounds under 10% opacity (essentially invisible)
- Test badge visibility against both light and dark product card backgrounds
- See CLAUDE_PATTERNS.md for implementation details

### Future Enhancements

**Current State:** Basic IsNew flag with manual API management
**Potential Future Features:**
- Admin UI for marking products (no curl commands needed)
- Scheduled auto-expiration (e.g., remove after 30 days)
- Product launch calendar integration
- A/B testing for product showcases
- Analytics tracking for "New Products" clicks

## 🏆 Managing "Top Sellers" Showcase (API-Driven Feature)

### Overview
The "Top Sellers" showcase is **API-driven** - products automatically appear/disappear when the `IsTopSeller` flag is toggled in the database. This system was migrated from hardcoded arrays on 2025-11-03.

**Key Features:**
- Products marked with `IsTopSeller=1` automatically appear in showcase
- DISCONTINUED products automatically filtered out by frontend
- Color variants grouped by style number (one card per style)
- 5-minute API cache delay for database changes to appear
- Sample pricing badges automatically displayed (free vs paid based on $10 threshold)

### Quick Reference Commands

```bash
# Add single top seller
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["PC54"]}'

# Add multiple top sellers (current set: 4 Carhartt products)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT104670", "CT103828", "CTK121", "CT104597"]}'

# Remove all top sellers (reset)
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

# Check current top sellers
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"

# Remove single product (direct update)
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/PC54" \
  -H "Content-Type: application/json" \
  -d '{"IsTopSeller": 0}'
```

### Complete Workflow

**Scenario 1: Replace All Top Sellers**

1. **Clear existing** top sellers:
   ```bash
   curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
     -H "Content-Type: application/json" \
     -d '{"confirm": true}'
   ```
2. **Mark new set** (4 Carhartt products):
   ```bash
   curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
     -H "Content-Type: application/json" \
     -d '{"styles": ["CT104670", "CT103828", "CTK121", "CT104597"]}'
   ```
3. **Wait 5 minutes** for cache to expire (or force browser refresh)
4. **Verify** on website: `http://localhost:3000/pages/top-sellers-showcase.html`

**Scenario 2: Add Single Top Seller**

```bash
# Mark product as top seller
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["PC54"]}'

# Wait 5 minutes for cache to expire

# Verify API response
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"
```

**Scenario 3: Remove Single Top Seller**

```bash
# Option A: Use individual update endpoint
curl -X PUT "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/CT104670" \
  -H "Content-Type: application/json" \
  -d '{"IsTopSeller": 0}'

# Option B: Clear all and re-mark others
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/clear-istopseller" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'

curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["CT103828", "CTK121", "CT104597"]}'
```

### Migration History

**Before 2025-11-03**: Used hardcoded array of 9 Sanmar products
**After 2025-11-03**: Dynamic API-driven from IsTopSeller flag
**Initial Migration**: 9 Sanmar products marked as top sellers
**Current Set**: 4 Carhartt products (CT104670, CT103828, CTK121, CT104597)

### Available Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/products/top-sellers` | GET | Get top seller products | No |
| `/api/product-details` | GET | Get product info | No |
| `/api/products/{style}` | PUT | Update product | No |
| `/api/admin/products/mark-as-top-seller` | POST | Mark as top sellers | No |
| `/api/admin/products/clear-istopseller` | POST | Clear all flags | No |

**Complete endpoint documentation:** See `memory/api/products-api.md` → "Top Sellers Management" section

### Important Behaviors

1. **Cache Delay**: Changes take up to 5 minutes to appear (server cache TTL)
2. **Deduplication**: Frontend groups color variants by style number (one card per style)
3. **Auto-Filtering**: DISCONTINUED products excluded automatically
4. **Image Priority**: COLOR_PRODUCT_IMAGE → PRODUCT_IMAGE → THUMBNAIL_IMAGE → brand placeholder
5. **Sample Pricing Integration**: All products automatically check eligibility via `/api/size-pricing` endpoint
6. **Carousel Limit**: Reduced to 4 products (no horizontal scrolling)

### Troubleshooting

**Problem: Products not appearing after marking as top seller**
- ✅ Wait 5 minutes for server cache to expire
- ✅ Check product is not DISCONTINUED (filtered out automatically)
- ✅ Verify API response: `curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"`
- ✅ Check browser console for JavaScript errors
- ✅ Verify carousel is limited to 4 products

**Problem: Sample pricing badges not showing**
- ✅ Verify `window.sampleCart.checkEligibility()` function is available
- ✅ Check API endpoint `/api/size-pricing?styleNumber={style}` is working
- ✅ Verify product has pricing data in database
- ✅ Check browser console for JavaScript errors in pricing check

**Problem: Wrong products showing**
- ✅ Verify which products have IsTopSeller=1 via API
- ✅ Use clear-istopseller endpoint to reset all
- ✅ Re-mark only desired products
- ✅ Check for duplicate style numbers (frontend groups by style)

**Problem: Images not loading**
- ✅ Check product has COLOR_PRODUCT_IMAGE, PRODUCT_IMAGE, or THUMBNAIL_IMAGE field
- ✅ Verify image URLs are accessible
- ✅ Check imageOverrides in top-sellers-showcase.html for manual overrides
- ✅ Fallback to brand placeholder if no image available

### Testing Checklist

Before marking task complete:

- [ ] Products marked via API: `curl -X POST .../mark-as-top-seller`
- [ ] Waited 5 minutes for cache (or tested with force refresh)
- [ ] Verified on website: `/pages/top-sellers-showcase.html`
- [ ] Confirmed correct products display in carousel
- [ ] Checked images loading properly
- [ ] Verified DISCONTINUED products filtered out
- [ ] Sample pricing badges showing correctly (free vs paid)
- [ ] Carousel limited to 4 products (no horizontal scrolling)
- [ ] No JavaScript errors in browser console

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

## 🐛 Debug & Testing Quick Reference

### Essential Console Commands
```javascript
// Check pricing data loaded
console.log('Pricing:', window.pricingData);

// Test API connection
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => r.json()).then(d => console.log('API:', d));

// Clear all caches
localStorage.clear(); sessionStorage.clear(); location.reload(true);
```

### Common Quick Fixes
- **Pricing not showing**: `window.location.reload(true);`
- **Cart stuck**: `localStorage.removeItem('cart'); sessionStorage.clear();`
- **EmailJS error**: `emailjs.init('4qSbDO-SQs19TbP80');`

For detailed debugging patterns and testing utilities, see **@memory/CLAUDE_PATTERNS.md**

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
| **All images loading slowly or not at all** | **Check if Sanmar CDN is down** - See [@memory/TROUBLESHOOTING_IMAGE_LOADING.md](memory/TROUBLESHOOTING_IMAGE_LOADING.md). Test URL: `https://cdnm.sanmar.com/imglib/mresjpg/2022/f5/CT104616_navy_model_front.jpg` |

## 🚀 Quick Start Templates

For starter templates including calculator HTML, service files, and API integration patterns, see **@memory/templates/**

## 🔑 Quick Reference

```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793

Quote Prefixes: DTG, RICH, EMB, EMBC, LT, PATCH, SPC, SSC, WEB
```

### Sample Cart Pricing
- **Formula**: `(baseCost ÷ 0.6) + sizeUpcharge`
- **Rounding**: Half-dollar ceiling (`Math.ceil(price * 2) / 2`)
- **Margin**: 40% (÷0.6 means ~67% markup)
- **API Endpoint**: `/api/pricing-bundle?method=BLANK&styleNumber={styleNumber}`
- **Upcharges**: From `sellingPriceDisplayAddOns` field
- **Documentation**: @memory/SAMPLE_CART_PRICING.md

**Quick Example:**
```javascript
// Base cost $6.00, size Large
const price = Math.ceil(($6.00 / 0.6) * 2) / 2;  // $10.00
```

### Sample Cart Inventory Integration
- **Real-Time Inventory**: Sanmar vendor inventory via `/api/sizes-by-style-color`
- **Critical Fields**: Use `CATALOG_COLOR` (not `COLOR_NAME`) for API queries
- **Service**: `SampleInventoryService` class in `/shared_components/js/sample-inventory-service.js`
- **Caching**: 5-minute sessionStorage cache
- **Complete Guide**: @memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md

**Key Concepts:**
- COLOR_NAME ("Brilliant Orange") = Display to users
- CATALOG_COLOR ("BrillOrng") = API queries and inventory checks
- Size selector shows only color-specific available sizes
- Inventory badges: "In Stock", "Low Stock", "Out of Stock", "Unable to Verify"

For detailed configuration management patterns and environment detection, see **@memory/CLAUDE_ARCHITECTURE.md**

## 📚 Documentation Navigation

⚠️ **IMPORTANT**: Documentation has been reorganized for better performance. All files stay under 40k character limit.

**📍 Start Here**: **@memory/INDEX.md** - Master navigation for all documentation

### Core Documentation
- **@memory/CASPIO_API_CORE.md** - API documentation (56 endpoints in @memory/api/ modules)
- **@memory/CLAUDE_ARCHITECTURE.md** - System architecture patterns
- **@memory/CLAUDE_PATTERNS.md** - Reusable code patterns & debug utilities
- **@memory/PRICING_MANUAL_CORE.md** - Manual pricing calculator concepts

### Complete Implementation Guides
- **@memory/QUOTE_BUILDER_GUIDE.md** - Creating new quote builders (3-phase architecture)
- **@memory/PRICING_CALCULATOR_GUIDE.md** - Creating pricing calculators
- **@memory/BUNDLE_CALCULATOR_GUIDE.md** - Creating promotional bundles
- **@memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md** - Adding real-time inventory to product pages
- **@memory/STAFF_DIRECTORY.md** - Staff emails for dropdowns
- **@memory/DATABASE_PATTERNS.md** - Database schema patterns

### 🏭 ShopWorks EDP Integration
- **@memory/SHOPWORKS_EDP_INTEGRATION.md** - Master navigation (~25KB navigation hub)
- **@memory/edp/** - Block documentation (7 specialized files, each < 40KB)
  - PRODUCT_BLOCK.md - **CRITICAL** - Includes CATALOG_COLOR field specification
  - PRICING_SYNC_GUIDE.md - SizesPricing pattern for three-system synchronization
  - ORDER_BLOCK.md, CUSTOMER_BLOCK.md, CONTACT_BLOCK.md, DESIGN_BLOCK.md, PAYMENT_BLOCK.md

**Status:** ✅ Production-ready for Screen Print Quote Builder
**Key Concepts:** CATALOG_COLOR (must match ShopWorks catalog exactly), SizesPricing (pricing sync source of truth)

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

## 🎯 DTG Pricing Calculation & Troubleshooting

### DTG Pricing Formula
The DTG pricing system uses a multi-step calculation:

1. **Get base garment cost**: Lowest price from `sizes[].price` array
2. **Apply margin**: `markedUpGarment = baseCost / tier.MarginDenominator`
3. **Add print costs**: From `allDtgCostsR[]` matching location and tier
4. **Round up**: `finalPrice = Math.ceil((markedUpGarment + printCost) * 2) / 2`

### Critical API Fields
- **Base cost**: Use `sizes[].price` (NOT `maxCasePrice`)
- **Margin**: Use `tiersR[].MarginDenominator` from API (not hardcoded)
- **Print costs**: `allDtgCostsR[].PrintCost` by `TierLabel` and `PrintLocationCode`

### Verification Process
```bash
# Test calculation for PC54 Left Chest at 48 qty
curl -s "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTG&styleNumber=PC54"

# Expected: Base $2.85 / 0.6 + $6 print = $10.75 → $11.00
```

### Common Issues
- **Wrong field names**: Ensure using `price` not `maxCasePrice`
- **Missing rounding**: Always round UP to half dollar
- **Combo locations**: Sum individual location print costs

### Size Upcharge Display Pattern

**UX Approach**: Progressive disclosure with info icon tooltip (added 2025-09-30)

**Current UI**: Toggle switches for locations + quantity tiers (NOT old table interface). "Order Information" section removed for cleaner UX.

**Implementation**:
1. Display info icon next to live price (flexbox wrapper for positioning)
2. Tooltip shows on hover (desktop) or tap (mobile)
3. Filter upcharges by available sizes from API
4. Separate display: base sizes vs upcharged sizes

**Code Pattern**:
```javascript
// Get available sizes for filtering
const availableSizes = pricingData?.pricing?.sizes?.map(s => s.size) || [];

// Filter upcharges to only show existing sizes
const filteredUpcharges = {};
Object.entries(allUpcharges).forEach(([size, amount]) => {
    if (availableSizes.includes(size) && amount > 0) {
        filteredUpcharges[size] = amount;
    }
});
```

**Reference**:
- Filtering pattern: `/shared_components/js/universal-pricing-grid.js:103-115`
- Tooltip implementation: `/calculators/dtg-pricing.html:2169-2239`

## 🎯 Screen Print Calculator Synchronization

### Two Independent Calculators
The Screen Print pricing system has TWO calculators that must show identical prices:

1. **Pricing Calculator** (`/calculators/screen-print-pricing.html`)
   - Single product pricing
   - Location: Front page at `/pricing/screen-print`
   - Used by: Customers for quick quotes

2. **Quote Builder** (`/quote-builders/screenprint-quote-builder.html`)
   - Multi-product quotes with database persistence
   - Location: Quote builder system
   - Used by: Sales team for complex quotes

### ⚠️ CRITICAL: Synchronization Requirements

**These calculators MUST produce identical prices for the same inputs.**

#### What IS Shared (Automatically Syncs)
✅ **File**: `shared_components/js/screenprint-pricing-service.js`
- API data fetching
- Pricing formulas (flash charge, margins)
- Tier boundaries from API
- Base print cost calculations

**Changes here affect both calculators automatically.**

#### What IS NOT Shared (Manual Sync Required)
❌ **LTM Fee Calculation Logic**:
- Quote Builder: `quote-builders/screenprint-quote-builder.html` lines 3015-3044
- Pricing Calc: `shared_components/js/screenprint-pricing-v2.js` lines 1587-1595

❌ **LTM Fee Display Text**:
- Quote Builder: Line 2732 (Small Batch Fee notice per product)
- Pricing Calc: Lines 227, 246 (tier button labels)

❌ **Rounding Logic**:
- Quote Builder: Line 2794 (subtotal calculation with Math.round)
- Pricing Calc: Multiple calculation methods

**Changes to these must be applied to BOTH files manually.**

### Testing for Synchronization

Before committing pricing changes:

```bash
# Open both calculators in separate browser tabs
# Test with identical inputs:
# - Product: PC61 Forest Green
# - Quantity: 37 pieces
# - Setup: 3 colors + underbase + safety stripes (front + back)
#
# Expected Result: Both show $29.85/piece
```

**Verification Checklist**:
- [ ] Same quantity shows same per-piece price
- [ ] Same quantity shows same LTM fee ($50.00 for 37-72 pieces)
- [ ] LTM fee distributed correctly ($50 ÷ 37 = $1.35/piece)
- [ ] Setup fees match (4 colors × $30 × 2 locations = $240)
- [ ] Grand total matches when comparing single product in quote builder

### Why They're Not Fully Shared

**Historical Reason**: The quote builder was created before the pricing calculator and has embedded JavaScript, while the pricing calculator uses external JS files for better code organization.

**Future Improvement**: Consider extracting LTM calculation logic into the shared service file to eliminate duplication (see screenprint-pricing-service.js header for implementation suggestions).

### ⚠️ Size Upcharge Handling Differences (INTENTIONAL)

**IMPORTANT:** The two calculators handle size upcharges differently by design. This is NOT a bug.

#### Pricing Calculator Approach (Simplified)
- **Uses:** BASE size price (smallest size, typically S/M) for ALL pieces
- **Ignores:** 2XL/3XL/4XL upcharges completely
- **Purpose:** Quick ballpark estimates for customers
- **Assumption:** Standard sizing (most orders are S-XL)

#### Quote Builder Approach (Accurate)
- **Calculates:** Each size individually with proper upcharges
- **Includes:** All size-specific pricing (2XL +$2.00, 3XL +$3.00, etc.)
- **Purpose:** Accurate final quotes for sales team
- **Use Case:** Orders with known size breakdown

#### Expected Pricing Differences

When upcharge sizes (2XL+) are present:
- **Per-piece difference:** ~$0.10-0.15 when averaged across all pieces
- **Total difference:** ~$4.00 for 37 pieces with 2 pieces of 2XL
- **This is ACCEPTABLE and by design**

**Example Test Case:**
```
Product: PC61 Forest Green
Quantity: 37 pieces (35 standard + 2 pieces of 2XL)
Setup: 3 colors + underbase + safety stripes (front + back)

Pricing Calculator: $937.50 total ($18.85/piece) - uses base size for all
Quote Builder: $941.50 total ($18.96/piece) - includes 2XL upcharge

Difference: $4.00 (2 pieces × $2.00 upcharge)
```

#### DO NOT "Fix" This Difference

This is **intentional product design:**
- Pricing Calculator = Fast, simple tool for customer estimates
- Quote Builder = Precise, detailed tool for final quotes

The calculators serve different purposes and audiences. Trying to make them show identical prices when upcharge sizes are involved would compromise their respective use cases.

## ⚠️ CRITICAL: DTG Calculator Synchronization

### Two Independent Calculators That MUST Match

The DTG pricing system has TWO calculators that must produce identical prices:

1. **Pricing Calculator** (`/calculators/dtg-pricing.html`)
   - Single product pricing
   - Location: Front page at `/pricing/dtg`
   - Used by: Customers for quick quotes

2. **Quote Builder** (`/quote-builders/dtg-quote-builder.html`)
   - Multi-product quotes with database persistence
   - Location: Quote builder system
   - Used by: Sales team for complex quotes

### ⚠️ CRITICAL: These calculators MUST produce identical prices for the same inputs

#### What IS Shared (Automatically Syncs) ✅

**File**: `shared_components/js/dtg-pricing-service.js`
- API data fetching
- Base pricing formulas (margin denominators)
- Tier boundaries from API
- Base garment cost calculations
- Print cost calculations

**File**: `shared_components/js/dtg-quote-pricing.js`
- LTM fee calculation (Math.floor rounding)
- Aggregate quantity tier determination
- Size grouping logic

**Changes to these files affect BOTH calculators automatically.**

#### What IS NOT Shared (Manual Sync Required) ❌

❌ **LTM Fee Display Logic**:
- Quote Builder: `dtg-quote-builder.js` lines 949-959
- Pricing Calculator: `dtg-pricing-v4-cleaned.js` (check for LTM display)

❌ **Size Breakdown Display**:
- Quote Builder: `dtg-quote-builder.js` lines 897-934 (product card HTML generation)
- Pricing Calculator: HTML template in `dtg-pricing.html`

❌ **Green Button Styling** (Added 2025-10-13):
- Quote Builder: `dtg-quote-builder.js` line 928 (green pill button)
- Pricing Calculator: Must match this styling

**Changes to these must be applied to BOTH files manually.**

### Testing for Synchronization

Before committing DTG pricing changes:

```bash
# Open both calculators in separate browser tabs
# Test with identical inputs:
# - Product: PC61 Orange
# - Quantity: 17 pieces (tests LTM)
# - Location: Left Chest + Full Back
# - Sizes: S:1, M:1, L:2, XL:1, 2XL:1, 3XL:1
#
# Expected Result: Both show same per-piece prices
```

**Verification Checklist**:
- [ ] Same quantity shows same per-piece price for each size
- [ ] Same LTM fee calculation ($50 ÷ 17 = $2.94 via Math.floor)
- [ ] LTM breakdown text matches ($2.94 per shirt)
- [ ] Size upcharges applied identically
- [ ] Green button styling matches on both
- [ ] Grand total matches

### Why They're Not Fully Shared

**Historical Reason**: Quote Builder was created first with embedded logic, Pricing Calculator uses external JS files. Both now share core pricing services (`dtg-pricing-service.js` and `dtg-quote-pricing.js`).

**Future Improvement**: Consider extracting display logic into shared components to eliminate remaining duplication.

## 🐛 Debugging & Communication

For effective debugging communication and API troubleshooting:
→ **See [memory/DEBUGGING_COMMUNICATION.md](memory/DEBUGGING_COMMUNICATION.md)**

Key points:
- Always provide working examples with API endpoints
- Include actual data structures, not just descriptions
- Check data layer first (most "UI bugs" are data/API issues)
- Use Network tab to see actual API calls and responses

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
- **/memory/**: Modularized documentation (optimized for performance)
  - **INDEX.md**: Master navigation for all documentation
  - **Core docs**: API, architecture, patterns, pricing (~20k chars each)
  - **/api/**: API endpoint modules
  - **/templates/**: Calculator templates and components

---

**Remember:** This document focuses on preventing the disasters that led to 71+ orphaned files. When in doubt, check the Top 5 Never-Break Rules at the beginning of this file.
