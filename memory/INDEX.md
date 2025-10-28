# 📚 NWCA Documentation Index

**Last Updated:** 2025-10-27
**Purpose:** Master navigation for all documentation files
**Performance Note:** All files optimized to stay under 40k character limit for optimal Claude performance

## 🏗️ Documentation Structure

This documentation has been reorganized into modular components for better performance and maintainability. Each file is now focused on a specific domain and stays within Claude's optimal performance threshold.

## 📁 Directory Map

```
/memory/
├── INDEX.md                           # This file - Master navigation
├── CASPIO_API_CORE.md                # Core API documentation (~20k chars)
├── CLAUDE_ARCHITECTURE.md            # System architecture patterns
├── CLAUDE_PATTERNS.md                # Code patterns and solutions
├── PRICING_MANUAL_CORE.md            # Manual pricing calculator core
├── SHOPWORKS_EDP_INTEGRATION.md      # ShopWorks EDP integration & pricing sync
├── QUOTE_BUILDER_GUIDE.md            # Complete quote builder development guide
├── PRICING_CALCULATOR_GUIDE.md       # Pricing calculator development guide
├── BUNDLE_CALCULATOR_GUIDE.md        # Promotional bundle calculator guide
├── STAFF_DIRECTORY.md                # Staff contact information
├── DATABASE_PATTERNS.md              # Database schema patterns
├── MANAGEORDERS_INTEGRATION.md       # ManageOrders PULL API (11 endpoints - read data)
├── MANAGEORDERS_PUSH_WEBSTORE.md    # ManageOrders PUSH API (4 endpoints - create orders)
├── MANAGEORDERS_PUSH_COMPLETE_FIELD_REFERENCE.md  # Complete Swagger field reference (158+ fields)
├── /api/                             # API endpoint modules
│   ├── products-api.md              # Product search & inventory
│   ├── cart-pricing-api.md          # Cart & pricing bundles
│   ├── orders-quotes-api.md         # Orders & quote management
│   └── utility-api.md               # Utilities & reference data
├── /manageorders/                    # ManageOrders API documentation
│   ├── OVERVIEW.md                  # Architecture & authentication
│   ├── CUSTOMER_AUTOCOMPLETE.md     # Customer autocomplete implementation
│   ├── API_REFERENCE.md             # Complete API spec (11 endpoints)
│   ├── SERVER_PROXY.md              # caspio-pricing-proxy implementation
│   └── INTEGRATION_EXAMPLES.md      # Working code examples (orders, inventory, payments)
└── /templates/                       # Calculator templates
    ├── manual-calculator-template.md     # Manual pricing template
    ├── contract-calculator-template.md   # Contract pricing template
    ├── specialty-calculator-template.md  # Specialty products template
    └── calculator-components.md          # Shared components

## Original files (for reference):
├── CASPIO_API_TEMPLATE.md           # Original (55.3k chars) - Now split
├── CLAUDE.md                        # Original (46.9k chars) - Now split
└── MANUAL_PRICING_CALCULATOR_GUIDE.md # Original (41.7k chars) - Now split
```

## 🎯 Quick Navigation Guide

### For API Integration

#### Caspio Pricing Proxy API
1. Start with **[CASPIO_API_CORE.md](./CASPIO_API_CORE.md)** - Core concepts, authentication, communication protocols
2. Review specific endpoint modules in **/api/** based on your needs:
   - **[products-api.md](./api/products-api.md)** - Product catalog and search
   - **[cart-pricing-api.md](./api/cart-pricing-api.md)** - Shopping cart and pricing bundles
   - **[orders-quotes-api.md](./api/orders-quotes-api.md)** - Order processing and quotes
   - **[utility-api.md](./api/utility-api.md)** - Helper endpoints and reference data

#### ManageOrders API (ShopWorks Integration)
1. Start with **[MANAGEORDERS_INTEGRATION.md](./MANAGEORDERS_INTEGRATION.md)** - Overview and navigation (11 endpoints)
2. Review specific integration guides in **/manageorders/** based on your needs:
   - **[OVERVIEW.md](./manageorders/OVERVIEW.md)** - System architecture and authentication
   - **[CUSTOMER_AUTOCOMPLETE.md](./manageorders/CUSTOMER_AUTOCOMPLETE.md)** - Customer autocomplete (live)
   - **[API_REFERENCE.md](./manageorders/API_REFERENCE.md)** - Complete API spec (11 endpoints)
   - **[SERVER_PROXY.md](./manageorders/SERVER_PROXY.md)** - Intelligent caching strategy
   - **[INTEGRATION_EXAMPLES.md](./manageorders/INTEGRATION_EXAMPLES.md)** - Working code examples

### For System Architecture
1. **[CLAUDE_ARCHITECTURE.md](./CLAUDE_ARCHITECTURE.md)** - Advanced architecture patterns
   - Adapter pattern implementation
   - Quote builder safety features
   - Dual API integration strategy
   - Configuration management system

2. **[CLAUDE_PATTERNS.md](./CLAUDE_PATTERNS.md)** - Reusable code patterns
   - API error handling
   - EmailJS integration
   - Debug utilities
   - Performance optimization

### For Calculator Development

#### Manual Pricing Calculators
1. **[PRICING_MANUAL_CORE.md](./PRICING_MANUAL_CORE.md)** - Core concepts and formulas
2. **[manual-calculator-template.md](./templates/manual-calculator-template.md)** - Complete HTML/JS template

#### Contract Pricing Calculators
1. **[PRICING_MANUAL_CORE.md](./PRICING_MANUAL_CORE.md)** - Overview of calculator categories
2. **[contract-calculator-template.md](./templates/contract-calculator-template.md)** - Fixed pricing template

#### Specialty Calculators
1. **[PRICING_MANUAL_CORE.md](./PRICING_MANUAL_CORE.md)** - Understanding specialty calculators
2. **[specialty-calculator-template.md](./templates/specialty-calculator-template.md)** - Product-specific templates

#### Shared Components
- **[calculator-components.md](./templates/calculator-components.md)** - BaseQuoteService, utilities, CSS

## 📋 Task-Based Navigation

### "I need to create a new pricing calculator"
1. Determine type: Manual, Contract, or Specialty
2. Read **[PRICING_MANUAL_CORE.md](./PRICING_MANUAL_CORE.md)**
3. Copy appropriate template from **/templates/**
4. Review **[calculator-components.md](./templates/calculator-components.md)** for shared utilities

### "I need to integrate with the API"
1. Read **[CASPIO_API_CORE.md](./CASPIO_API_CORE.md)** for basics
2. Find your endpoints in **/api/** directory
3. Use patterns from **[CLAUDE_PATTERNS.md](./CLAUDE_PATTERNS.md)**

### "I need to understand the system architecture"
1. Start with **[CLAUDE_ARCHITECTURE.md](./CLAUDE_ARCHITECTURE.md)**
2. Review adapter pattern if working with pricing
3. Check quote system patterns for database work

### "I need to fix an error or debug"
1. Check **[CLAUDE_PATTERNS.md](./CLAUDE_PATTERNS.md)** for common solutions
2. Review error handling patterns
3. Use debug utilities and console commands

### "I need to create ShopWorks EDP integration"
1. Read **[SHOPWORKS_EDP_INTEGRATION.md](./SHOPWORKS_EDP_INTEGRATION.md)** - Complete guide
2. Understand the SizesPricing pattern (source of truth)
3. Apply verification checklist to ensure pricing synchronization
4. Reference implementation examples for your quote builder type

### "I need to add customer autocomplete to a quote builder"
1. Read **[MANAGEORDERS_INTEGRATION.md](./MANAGEORDERS_INTEGRATION.md)** - Overview (11 endpoints available)
2. Review **[CUSTOMER_AUTOCOMPLETE.md](./manageorders/CUSTOMER_AUTOCOMPLETE.md)** - Step-by-step implementation guide
3. Copy integration code from Screen Print Quote Builder example
4. Test with console commands and manual testing checklist

### "I need to build apps with ManageOrders API"
1. Check **[API_REFERENCE.md](./manageorders/API_REFERENCE.md)** for all 11 endpoints
2. Review **[INTEGRATION_EXAMPLES.md](./manageorders/INTEGRATION_EXAMPLES.md)** for working code examples:
   - Webstore real-time inventory (5-minute cache) - CRITICAL
   - Customer portal (order history, tracking, payments)
   - Sales dashboard (order search and lookup)
   - Accounting dashboard (payment tracking)
3. Study **[SERVER_PROXY.md](./manageorders/SERVER_PROXY.md)** for intelligent caching strategy
4. Follow security best practices from **[OVERVIEW.md](./manageorders/OVERVIEW.md)**

### "I need to build a webstore that sends orders to ShopWorks OnSite"
1. Read **[MANAGEORDERS_PUSH_WEBSTORE.md](./MANAGEORDERS_PUSH_WEBSTORE.md)** - PUSH API reference guide
2. Review complete developer guide: `caspio-pricing-proxy/memory/ONLINE_STORE_DEVELOPER_GUIDE.md`
3. Understand PUSH vs PULL API differences:
   - **PULL API:** Read data (inventory, orders, tracking) - 11 endpoints
   - **PUSH API:** Create orders (webstore checkout) - 4 endpoints
4. Build complete webstore:
   - Phase 1: Product display with real-time inventory (PULL API)
   - Phase 2: Checkout with automatic order creation (PUSH API)
   - Phase 3: Order tracking for customers (PULL API)
5. Test with `isTest: true` flag before going live

### "I need to enhance my ManageOrders PUSH API integration"
1. Read **[MANAGEORDERS_PUSH_COMPLETE_FIELD_REFERENCE.md](./MANAGEORDERS_PUSH_COMPLETE_FIELD_REFERENCE.md)** - Complete Swagger specification
2. Review current implementation status (158+ fields documented):
   - Order-Level Fields: 23 total (12 currently used)
   - Line Item Fields: 18 per item (8 currently used)
   - Design Block: ~27 nested fields (future use)
   - Payment Block: 12 per payment (future use)
3. Choose enhancement phase:
   - **Phase 1:** Quick wins (custom fields, additional notes)
   - **Phase 2:** Major features (design tracking, extended shipping)
   - **Phase 3:** Advanced (payment integration, attachments)
4. Use implementation snippets from documentation
5. Test field population in ShopWorks after hourly import

## 🔑 Key Configuration Values

### API Configuration
- **Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Total Endpoints:** 56 active
- **No Authentication Required** (Public API)

### EmailJS Configuration
- **Service ID:** `service_1c4k67j`
- **Public Key:** `4qSbDO-SQs19TbP80`
- **Company Phone:** 253-922-5793

### Quote ID Prefixes
```
DTG    - Direct-to-Garment
DTF    - Direct-to-Film
EMB    - Embroidery Contract
EMBC   - Customer Supplied Embroidery
CAP    - Cap Embroidery
RICH   - Richardson Caps
SPC    - Screen Print Contract
LT     - Laser Tumblers
PATCH  - Embroidered Emblems
```

### Standard Pricing Tiers
```javascript
// Common quantity breaks
12-23   (Small orders, LTM fee applies)
24-47   (Standard minimum)
48-71   (Medium quantity)
72-143  (Large quantity)
144+    (Bulk orders)
```

### Margin Denominators
```javascript
0.50 = 100% markup
0.55 = ~82% markup
0.60 = ~67% markup
0.65 = ~54% markup
0.70 = ~43% markup
```

## 📊 File Size Optimization Results

| Original File | Original Size | New Structure | Largest New File |
|---------------|--------------|---------------|------------------|
| CASPIO_API_TEMPLATE.md | 55.3k chars | 5 files | ~20k chars |
| CLAUDE.md | 46.9k chars | 3 files | ~25k chars |
| MANUAL_PRICING_CALCULATOR_GUIDE.md | 41.7k chars | 4 files | ~12k chars |
| SHOPWORKS_EDP_INTEGRATION.md | 158k chars | 8 files | ~40k chars (PRODUCT_BLOCK.md) |
| MANAGEORDERS_INTEGRATION.md | N/A (new) | 6 files | ~25k chars (API_REFERENCE.md) |

**Result:** All files now under 40k character threshold for optimal Claude performance ✅

**Latest Optimization (2025-10-26):**
- Split massive 158KB ShopWorks EDP file into 8 modular files
- Core file reduced from 158KB → ~25KB (navigation hub)
- 7 specialized files in /edp/ directory (each < 40KB)
- **53% context reduction** when querying specific blocks

**Latest Addition (2025-01-27):**
- Created ManageOrders API documentation (6 files, ~65k total)
- Includes complete Swagger specification (10 endpoints, 89 fields)
- Modular structure: Overview, Autocomplete, API Reference, Server Proxy, Future Integrations
- Production-ready customer autocomplete documentation

**Latest Addition (2025-10-27):**
- Created complete ManageOrders PUSH API field reference
- Documents all 158+ available Swagger fields
- Field mapping guide (Your Field → Proxy Field → Swagger Field)
- Implementation snippets and troubleshooting guide
- Three-phase enhancement roadmap

## 🔗 Related Documentation

### Active Development Files (in root)
- **CLAUDE.md** - Main development instructions (references this structure)
- **ACTIVE_FILES.md** - Registry of all active files in the project

### Supporting Documentation
- **QUOTE_BUILDER_GUIDE.md** - Complete guide for multi-phase quote builders
- **PRICING_CALCULATOR_GUIDE.md** - Guide for product pricing calculators
- **BUNDLE_CALCULATOR_GUIDE.md** - Guide for promotional bundles
- **STAFF_DIRECTORY.md** - Staff contact information
- **DATABASE_PATTERNS.md** - Database schema and patterns
- **MANAGEORDERS_INTEGRATION.md** - ShopWorks ManageOrders API integration guide
- **MANAGEORDERS_PUSH_COMPLETE_FIELD_REFERENCE.md** - Complete Swagger field reference
- **FILE_UPLOAD_API_REQUIREMENTS.md** - File upload specifications

## 💡 Best Practices

1. **Always check file size** when adding content to documentation
2. **Split files** that approach 40k characters
3. **Use cross-references** instead of duplicating content
4. **Keep templates separate** from conceptual documentation
5. **Group related APIs** in the same module file

## 🚀 Quick Start Commands

```bash
# Check file sizes
find /memory -name "*.md" -exec wc -c {} \; | sort -n

# Search for specific API endpoint
grep -r "endpoint-name" /memory/api/

# Find calculator examples
ls /memory/templates/

# Check for broken links
grep -r "\[.*\](\./" /memory/
```

## 📝 Maintenance Notes

- **File Size Monitoring:** Check character counts monthly
- **Cross-Reference Updates:** Update links when files move
- **Version Tracking:** Update "Last Updated" dates when modifying
- **API Sync:** Keep API documentation synchronized with provider

---

**Navigation Tip:** Use Ctrl+F to quickly find topics in this index, then navigate to the appropriate file for detailed information.