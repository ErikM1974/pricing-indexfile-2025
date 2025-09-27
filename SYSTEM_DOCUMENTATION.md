# NWCA Pricing System - Complete Documentation
Generated: 2025-01-27

## System Overview
The Northwest Custom Apparel (NWCA) Pricing System is a comprehensive web application for custom apparel pricing, quoting, and ordering. It supports multiple decoration methods and includes a full cart and checkout system.

## Core Systems & Working Flows

### 1. Main Entry Points

#### Product Catalog (index.html)
- **Route**: `/`
- **Purpose**: Main product search and browsing interface
- **Dependencies**:
  - `app-modern.js`
  - `product-search-service.js`
  - `catalog-search.js`
  - `autocomplete-new.js`

#### Shopping Cart (cart.html)
- **Route**: `/cart`
- **Purpose**: Shopping cart management and checkout
- **Dependencies**:
  - `cart.js`
  - `cart-ui.js`
  - `cart-price-recalculator.js`
  - `order-form-pdf.js`
  - `pricing-matrix-api.js`
  - `utils.js`

### 2. Pricing Calculators (Active)

#### DTG (Direct-to-Garment)
- **Calculator**: `/calculators/dtg-pricing.html`
- **Manual**: `/calculators/dtg-manual-pricing.html`
- **Quote Builder**: `/quote-builders/dtg-quote-builder.html`
- **Services**:
  - `dtg-adapter.js`
  - `dtg-pricing-service.js`
  - `dtg-quote-service.js`
  - `dtg-config.js`

#### DTF (Direct-to-Film)
- **Calculator**: `/calculators/dtf-pricing.html`
- **Manual**: `/calculators/dtf-manual-pricing.html`
- **Services**:
  - `dtf-adapter.js`
  - `dtf-pricing-service.js`
  - `dtf-config.js`
  - `dtf-integration.js`

#### Embroidery
- **Calculator**: `/calculators/embroidery-pricing.html`
- **Manual**: `/calculators/embroidery-manual-pricing.html`
- **Quote Builder**: `/quote-builders/embroidery-quote-builder.html`
- **Services**:
  - `embroidery-pricing-service.js`
  - `embroidery-quote-service.js`
  - `embroidery-quote-builder.js`
  - `embroidery-quote-pricing.js`

#### Cap Embroidery
- **Calculator**: `/calculators/cap-embroidery-pricing-integrated.html`
- **Manual**: `/calculators/cap-embroidery-manual-pricing.html`
- **Quote Builder**: `/quote-builders/cap-embroidery-quote-builder.html`
- **Services**:
  - `cap-embroidery-pricing-service.js`
  - `cap-quote-builder.js`
  - `cap-quote-service.js`
  - `cap-quote-pricing.js`

#### Screen Print
- **Calculator**: `/calculators/screen-print-pricing.html`
- **Quote Builder**: `/quote-builders/screenprint-quote-builder.html`
- **Services**:
  - `screenprint-pricing-service.js`
  - `screenprint-pricing-v2.js`
  - `screenprint-quote-service.js`
  - `screenprint-quote-pricing.js`

### 3. Special Calculators

#### Bundles
- **Christmas Bundle**: `/calculators/christmas-bundles.html`
  - Service: `christmas-bundle-service.js`
- **Breast Cancer Bundle**: `/calculators/breast-cancer-awareness-bundle.html`
  - Service: `breast-cancer-bundle-service.js`

#### Other Active Calculators
- **Laser Tumbler**: `/calculators/laser-tumbler-polarcamel.html`
  - Services: `laser-tumbler-calculator.js`, `laser-tumbler-quote-service.js`
- **Richardson Caps**: `/calculators/richardson-2025.html`
  - Services: `richardson-caps-calculator.js`, `richardson-quote-service.js`
- **Safety Stripe**: `/calculators/safety-stripe-creator.html`
  - Services: `safety-stripe-calculator.js`, `safety-stripe-creator-service.js`
- **Art Invoice**: `/calculators/art-invoice-creator.html`
  - Service: `art-invoice-service-v2.js`

### 4. Quote System Architecture

#### Base Components (Used by ALL quote builders)
- `quote-builder-base.js` - Base functionality
- `quote-formatter.js` - Format quotes for display/email
- `quote-persistence.js` - Save/load quotes
- `quote-session.js` - Session management
- `quote-validation.js` - Input validation
- `quote-ui-feedback.js` - User feedback

#### Quote ID Patterns
- DTG: `DTG[MMDD]-[sequence]`
- EMB: `EMB[MMDD]-[sequence]`
- RICH: `RICH[MMDD]-[sequence]`
- PATCH: `PATCH[MMDD]-[sequence]`
- LT: `LT[MMDD]-[sequence]`
- SPC: `SPC[MMDD]-[sequence]`

### 5. API Integration

#### Primary API
- **Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- **Hardcoded References**: 149 instances (needs centralization)

#### Key Endpoints Used
- `/api/products/search` - Product search
- `/api/quote_sessions` - Quote management
- `/api/quote_items` - Quote line items
- `/api/pricing-matrix` - Pricing calculations
- `/api/cart/sessions` - Cart management

### 6. EmailJS Integration

#### Configuration
- **Public Key**: `4qSbDO-SQs19TbP80`
- **Service ID**: `service_1c4k67j`
- **Active Templates**: Multiple per calculator

### 7. Dashboard System

#### Staff Dashboards
- `/dashboards/staff-dashboard.html`
- `/dashboards/ae-dashboard.html`
- `/dashboards/art-hub-dashboard.html`
- `/dashboards/art-invoices-dashboard.html`

#### Art Tools
- `/art-tools/ae-art-dashboard.html`
- `/art-tools/ae-submit-art.html`
- `/art-tools/art-approval.html`

### 8. Critical Shared Components

#### Actively Used Services
- `base-quote-service.js` - Base class for all quotes
- `calculator-utilities.js` - Common utilities
- `utils.js` - General utilities
- `app-config.js` - Application configuration

#### Universal Components
- `universal-header-component.js`
- `universal-image-gallery.js`
- `universal-product-display.js`

### 9. Active CSS Files

#### Shared Styles
- `/shared_components/css/universal-header.css`
- `/shared_components/css/universal-calculator-theme.css`
- `/shared_components/css/embroidery-quote-builder.css`
- `/shared_components/css/quote-builder-unified-step1.css`
- `/shared_components/css/dtg-quote-builder.css`
- Calculator-specific CSS files

### 10. User Flow Paths

#### Quote Generation Flow
1. User selects decoration type
2. Calculator loads → Adapter initializes
3. User configures options
4. Pricing service calculates
5. Quote service generates ID
6. EmailJS sends quote
7. Database saves via API

#### Cart Flow
1. Product added to cart
2. Cart session created/updated
3. Price recalculation
4. Order form generation (PDF)
5. Checkout process

## Files Safe to Remove

### Confirmed Orphaned (Not Referenced)
- Test files: `test-*.js`, `test-*.html`
- Debug files: `debug-*.js`, `diagnose-*.js`
- Verification files: `verify-*.js`
- Old versions: Files with v2/v3 when v4 exists
- Backup files: `*-backup.*`, `*-FINAL.*`, `*-FIXED.*`
- Unused root JS: `app.js`, `autocomplete.js` (replaced by modern versions)

### Archive Folder
- 3.8MB of historical code
- Move to external backup

## Testing Checklist

Before any major change, test:
1. ✓ DTG Quote Builder - Full flow
2. ✓ Embroidery Pricing Calculator
3. ✓ Cart functionality
4. ✓ Product search
5. ✓ EmailJS quote delivery
6. ✓ Database quote saving
7. ✓ PDF generation in cart

## Rollback Procedures

### If Issues Occur
```bash
# Option 1: Git rollback
git checkout backup-before-cleanup

# Option 2: Restore from backup
cp -r ../pricing-cleanup-backup-[date]/* .

# Option 3: Revert specific commit
git revert [commit-hash]
```

## Notes for Developers

### Adding New Calculators
1. Use template: `/templates/calculator-template.html`
2. Follow quote ID pattern
3. Extend `base-quote-service.js`
4. Add route in `server.js`
5. Update this documentation

### Code Standards
- HTML files: Use external JS/CSS
- API calls: Use centralized service
- Quote IDs: Follow established patterns
- Testing: Test all flows before deployment

---
End of Documentation