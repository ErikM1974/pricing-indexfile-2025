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

## 📋 Quick Navigation

### Essential Checklists
- [Pre-Flight Checklist](#pre-flight-checklist) - Before ANY code changes
- [File Organization](#file-organization) - Where files go
- [Code Review Checklist](#code-review-checklist) - Before committing

### System Architecture
- **API Integration**: @memory/CASPIO_API_CORE.md (63 endpoints)
- **Architecture Patterns**: @memory/CLAUDE_ARCHITECTURE.md
- **Code Patterns**: @memory/CLAUDE_PATTERNS.md
- **All Documentation**: @memory/INDEX.md (master navigation)

### Development Guides
- **Quote Builders**: @memory/QUOTE_BUILDER_GUIDE.md
- **Pricing Calculators**: @memory/PRICING_CALCULATOR_GUIDE.md
- **Bundles**: @memory/BUNDLE_CALCULATOR_GUIDE.md
- **ShopWorks EDP**: @memory/SHOPWORKS_EDP_INTEGRATION.md
- **ManageOrders API**: @memory/MANAGEORDERS_INTEGRATION.md

## Pre-Flight Checklist

**Before creating ANY new file:**

```markdown
□ 1. Is this a test file? → MUST go in /tests/ (no exceptions)
□ 2. Check ACTIVE_FILES.md → Does similar functionality exist?
□ 3. Follow directory guide → Correct subdirectory placement
□ 4. Use kebab-case naming → No spaces, no CAPS
□ 5. External JS/CSS only → No inline code
□ 6. Update ACTIVE_FILES.md → Required immediately
```

**Before committing:**

```markdown
□ Remove all console.logs
□ Update ACTIVE_FILES.md
□ No hardcoded URLs (use config)
□ Descriptive commit message
□ Tested in browser
```

## File Organization

### Decision Tree for File Placement

```
Creating a new file? Start here:
├─ Test file? → `/tests/` (ui/api/unit subdirectories)
├─ Calculator? → `/calculators/`
├─ Quote builder? → `/quote-builders/`
├─ Dashboard? → `/dashboards/`
├─ General page? → `/pages/`
├─ JavaScript file?
│  ├─ Shared/reusable? → `/shared_components/js/`
│  └─ Page-specific? → Same folder as HTML
├─ CSS file?
│  ├─ Shared styles? → `/shared_components/css/`
│  └─ Page-specific? → Same folder as HTML
└─ Is it index.html, cart.html, or product.html? → Root (ONLY THESE!)
   └─ Everything else → MUST go in a subdirectory!
```

### Root Directory Whitelist (ONLY these allowed)
- **Main HTML pages**: index.html, cart.html, product.html
- **Essential configs**: package.json, server.js, .env.example
- **Critical docs**: README.md, CLAUDE.md, ACTIVE_FILES.md
- **Everything else**: MUST go in subdirectories

## 🚨 API Error Handling (Erik's #1 Rule)

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

## Project Overview

### Two-Repository Architecture

**This project (Pricing Index File 2025)** - Frontend
- Quote builders, calculators, pricing pages
- Uses API endpoints from backend
- Port 3000 (local), Heroku (production)

**Backend (caspio-pricing-proxy)** - API Server
- Location: `../caspio-pricing-proxy` (sibling directory)
- Port 3002 (local), Heroku (production)
- Base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

**When to switch repositories:**
- Stay here: Frontend UI, calculators, using existing APIs
- Switch to backend: New API endpoints, server logic, deployment

### Key System Components

1. **Adapters** (`/shared_components/js/*-adapter.js`) - Handle pricing data from Caspio
2. **Quote System** - Two tables: `quote_sessions` + `quote_items`, ID: `[PREFIX][MMDD]-seq`
3. **API Proxy** - `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
4. **Cart Management** - Session-based, single embellishment type per cart

### API Details

- **Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Key Endpoints**: `/api/quote_sessions`, `/api/quote_items`, `/api/pricing-bundle`
- **Quote Pattern**: `[PREFIX][MMDD]-seq` (e.g., DTG0130-1)
- **Full Documentation**: @memory/CASPIO_API_CORE.md

### ManageOrders API (ShopWorks Integration)

- **PULL API**: 11 endpoints for reading from ShopWorks OnSite 7
  - Real-time inventory (5-minute cache) - **CRITICAL** for webstores
  - Documentation: @memory/MANAGEORDERS_INTEGRATION.md
- **PUSH API**: 4 endpoints for creating orders in ShopWorks
  - Webstore checkout → automatic order creation
  - Documentation: @memory/MANAGEORDERS_PUSH_WEBSTORE.md

## Development Commands

```bash
npm start          # Start Express server (port 3000) - That's it!

# Optional: For safety tools testing (local only)
npm install puppeteer  # NOT needed for production/Heroku
```

**⚠️ No Webpack/Build System** - Simple static file serving, no build step.

## Common Tasks Quick Reference

### Managing "New Products" or "Top Sellers" Showcase

**Quick Commands:**
```bash
# Add products to New Products
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["NE215", "EB120"]}'

# Add products to Top Sellers
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-top-seller" \
  -H "Content-Type: application/json" \
  -d '{"styles": ["PC54", "PC61"]}'

# Check current products
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new"
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/top-sellers"
```

**Note:** Changes take 5 minutes for cache to expire. Force refresh: Ctrl+Shift+R

**Complete Documentation:** @memory/api/product-showcase-api.md

### Sanmar to ShopWorks Product Import

**API Endpoint (ShopWorks-ready format):**
```javascript
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=PC850&color=Cardinal'
);
const skus = await response.json(); // Size01-06 fields pre-mapped
```

**Critical:** Use CATALOG_COLOR (not COLOR_NAME) for API queries
- Example: "Athletic Heather" → "Athletic Hthr"

**Complete Guide:** @memory/SANMAR_TO_SHOPWORKS_GUIDE.md

### Sample Cart Inventory Integration

**⚠️ CRITICAL: Two Color Field System (#1 Cause of Errors)**

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| **COLOR_NAME** | Display to users | "Brilliant Orange" | UI, customer quotes |
| **CATALOG_COLOR** | API queries | "BrillOrng" | Inventory API, ShopWorks |

**Common Mistake:**
```javascript
// ❌ WRONG - Cart saves but inventory shows "Unable to Verify"
catalogColor: product.COLOR_NAME  // Should be CATALOG_COLOR

// ✅ CORRECT
catalogColor: product.CATALOG_COLOR
```

**Complete Guide:** @memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md

## Code Review Checklist

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

## Common Issues & Fixes

| Issue | Fix | Documentation |
|-------|-----|---------------|
| EmailJS "Corrupted variables" | Add missing variables with defaults (`\|\| ''`) | @memory/CLAUDE_PATTERNS.md |
| Database not saving | Check endpoint and field names match exactly | @memory/DATABASE_PATTERNS.md |
| Sample inventory "Unable to Verify" | **Use CATALOG_COLOR not COLOR_NAME** | @memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md |
| Images loading slowly | Check if Sanmar CDN is down | @memory/TROUBLESHOOTING_IMAGE_LOADING.md |
| DTG pricing discrepancy | Use `sizes[].price` not `maxCasePrice` | @memory/PRICING_MANUAL_CORE.md |
| Screen Print calculator sync | Check LTM fee calculation in both files | See synchronization section below |

## Calculator Synchronization (CRITICAL)

### Screen Print & DTG Calculators

Both have TWO independent calculators (Pricing Calculator + Quote Builder) that **MUST show identical prices**.

**What IS Shared (Auto-sync):**
- `shared_components/js/screenprint-pricing-service.js` (Screen Print)
- `shared_components/js/dtg-pricing-service.js` (DTG)
- `shared_components/js/dtg-quote-pricing.js` (DTG)

**What IS NOT Shared (Manual sync required):**
- LTM fee calculation logic
- LTM fee display text
- Size breakdown display

**Testing Required:**
- Test identical inputs in both calculators
- Verify per-piece prices match
- Verify LTM fees match
- Verify totals match

**Note:** Screen Print size upcharge differences are INTENTIONAL (Pricing Calculator ignores upcharges for simplicity, Quote Builder includes them for accuracy).

**Complete Documentation:**
- Screen Print: See "Screen Print Calculator Synchronization" in archived sections
- DTG: See "DTG Calculator Synchronization" in archived sections

## Quick Reference

```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793

Quote Prefixes: DTG, RICH, EMB, EMBC, LT, PATCH, SPC, SSC, WEB
```

### Sample Cart Pricing Formula
- **Formula**: `(baseCost ÷ 0.6) + sizeUpcharge`
- **Rounding**: Half-dollar ceiling (`Math.ceil(price * 2) / 2`)
- **API Endpoint**: `/api/pricing-bundle?method=BLANK&styleNumber={styleNumber}`
- **Documentation**: @memory/SAMPLE_CART_PRICING.md

### Essential Search Commands

```bash
# Find where a function is defined
grep -r "functionName" --include="*.js" --exclude-dir="node_modules"

# Find all uses of an API endpoint
grep -r "/api/endpoint" --include="*.js" --exclude-dir="node_modules"

# Check if similar functionality exists
find . -name "*feature-name*" -not -path "./node_modules/*"

# Find hardcoded values that should be config
grep -r "253-922-5793\|caspio\|herokuapp" --include="*.js"
```

## ⚡ Quick Links for Common Tasks

### Critical Error Prevention
- **[Fixing "Unable to Verify" Inventory](memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md#critical-concepts)** - COLOR_NAME vs CATALOG_COLOR (#1 cause of errors)
- **[Multi-SKU Inventory Pattern](memory/PRODUCT_SKU_PATTERNS.md)** - PC54/PC54_2X/PC54_3X queries
- **[SizesPricing Pattern](memory/edp/PRICING_SYNC_GUIDE.md)** - Preventing pricing discrepancies

### Pricing & Calculations
- **[DTG Pricing Formula](memory/PRICING_MANUAL_CORE.md#manual-pricing-formula)** - Complete 7-step calculation
- **[3-Day Tees Pricing](memory/3-day-tees/PRICING-FORMULA.md)** - DTG base + 25% rush fee
- **[Sample Cart Pricing](memory/SAMPLE_CART_PRICING.md)** - Blank products, tax calculation fix

### API Integration
- **[ManageOrders API (11 endpoints)](memory/manageorders/API_REFERENCE.md)** - PULL API for reading data
- **[ManageOrders PUSH API (165 fields)](memory/manageorders-push/FIELD_REFERENCE_CORE.md)** - Creating orders, webstore integration
- **[Customer Autocomplete](memory/manageorders/CUSTOMER_AUTOCOMPLETE.md)** - 92% time savings, ready to rollout
- **[Sanmar to ShopWorks](memory/SANMAR_TO_SHOPWORKS_GUIDE.md)** - Product transformation API

### Development Guides
- **[Quote Builder Architecture](memory/QUOTE_BUILDER_GUIDE.md)** - 3-phase pattern, 18+ shared components
- **[ShopWorks EDP Integration](memory/SHOPWORKS_EDP_INTEGRATION.md)** - Production-ready, critical PRODUCT_BLOCK
- **[Database Patterns](memory/DATABASE_PATTERNS.md)** - Two-table structure, QuoteID format

### Reference Data
- **[Staff Directory](memory/STAFF_DIRECTORY.md)** - Sales reps, company phone (253-922-5793)
- **[Debugging Communication](memory/DEBUGGING_COMMUNICATION.md)** - Effective debugging patterns for Erik

## 📚 Documentation Navigation

⚠️ **IMPORTANT**: All detailed documentation is in /memory/ directory for optimal performance.

**📍 Start Here**: **@memory/INDEX.md** - Master navigation for all documentation

### Core Documentation
- **@memory/CASPIO_API_CORE.md** - API documentation (63 endpoints)
- **@memory/CLAUDE_ARCHITECTURE.md** - System architecture patterns
- **@memory/CLAUDE_PATTERNS.md** - Reusable code patterns & debug utilities
- **@memory/PRICING_MANUAL_CORE.md** - Manual pricing calculator concepts

### Complete Implementation Guides
- **@memory/QUOTE_BUILDER_GUIDE.md** - Creating new quote builders
- **@memory/PRICING_CALCULATOR_GUIDE.md** - Creating pricing calculators
- **@memory/BUNDLE_CALCULATOR_GUIDE.md** - Creating promotional bundles
- **@memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md** - Real-time inventory
- **@memory/STAFF_DIRECTORY.md** - Staff emails for dropdowns
- **@memory/DATABASE_PATTERNS.md** - Database schema patterns

### ShopWorks Integration
- **@memory/SHOPWORKS_EDP_INTEGRATION.md** - Master navigation
- **@memory/edp/** - Block documentation (7 files)
  - PRODUCT_BLOCK.md - **CRITICAL** - Includes CATALOG_COLOR specification
  - PRICING_SYNC_GUIDE.md - SizesPricing pattern

### ManageOrders Integration
- **@memory/MANAGEORDERS_INTEGRATION.md** - PULL API (11 endpoints)
- **@memory/MANAGEORDERS_PUSH_WEBSTORE.md** - PUSH API (4 endpoints)
- **@memory/manageorders/** - Complete integration guides
- **@memory/manageorders-push/** - Field reference (165 fields)

### Active Calculators
- **DTG** - Direct-to-garment contract pricing
- **RICH** - Richardson caps
- **EMB** - Embroidery contract
- **EMBC** - Customer supplied embroidery
- **LT** - Laser tumblers
- **PATCH** - Embroidered emblems
- **SPC** - Screen print contract

## Debug Commands

```javascript
// Check pricing data loaded
console.log('Pricing:', window.pricingData);

// Test API connection
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => r.json()).then(d => console.log('API:', d));

// Clear all caches
localStorage.clear(); sessionStorage.clear(); location.reload(true);
```

## Additional Resources

### Documentation Files
- **ACTIVE_FILES.md** - Registry of all active files
- **README.md** - Project overview
- **MONITORING_SETUP.md** - File monitoring (optional dev tool)

### Documentation Locations
- **Root directory**: Active docs (CLAUDE.md, ACTIVE_FILES.md, README.md)
- **/docs/archive/**: Historical/completed documentation
- **/memory/**: Modularized documentation (all files < 40k chars)
  - **INDEX.md**: Master navigation
  - **/api/**: API endpoint modules
  - **/templates/**: Calculator templates
  - **/edp/**: ShopWorks EDP blocks
  - **/manageorders/**: ManageOrders guides

---

**Remember:** This document focuses on preventing disasters and quick navigation to detailed docs. When in doubt:
1. Check the Top 5 Never-Break Rules
2. Check @memory/INDEX.md for detailed documentation
3. Check ACTIVE_FILES.md for existing functionality
