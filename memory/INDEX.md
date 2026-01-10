# NWCA Documentation Index

**Last Updated:** 2026-01-10
**Purpose:** Master navigation for all documentation files

## Directory Map

```
/memory/
├── INDEX.md                           # This file - Master navigation
├── CASPIO_API_CORE.md                # Core API documentation
├── ARCHITECTURE.md                   # System architecture patterns
├── PATTERNS.md                       # Code patterns and solutions
├── QUOTE_BUILDER_GUIDE.md            # Quote builder development guide
├── QUOTE_BUILDER_BEST_PRACTICES.md   # Copy-paste code patterns
├── QUOTE_BUILDER_API_INTEGRATION.md  # API endpoints for quote builders
├── QUOTE_BUILDER_LINE_ITEMS.md       # Parent/child row patterns
├── QUOTE_BUILDER_TEMPLATE.md         # HTML row structure templates
├── PRICING_CALCULATOR_GUIDE.md       # Pricing calculator guide
├── DTF_PRICING_SYSTEM.md             # DTF pricing formula
├── DTG_PRICING_CONSISTENCY.md        # DTG pricing consistency
├── BUNDLE_CALCULATOR_GUIDE.md        # Promotional bundle calculator
├── SHOPWORKS_EDP_INTEGRATION.md      # ShopWorks EDP integration
├── SHOPWORKS_SIZE_MAPPING.md         # SanMar→ShopWorks data transformation
├── SHOPWORKS_EXTENDED_SKU_PATTERNS.md # Extended SKU patterns
├── PRODUCT_SKU_PATTERNS.md           # Product SKU patterns reference
├── DATABASE_PATTERNS.md              # Database schema patterns
├── MANAGEORDERS_INTEGRATION.md       # ManageOrders PULL API (11 endpoints)
├── MANAGEORDERS_PUSH_WEBSTORE.md     # ManageOrders PUSH API (4 endpoints)
├── SANMAR_TO_SHOPWORKS_GUIDE.md      # Transform Sanmar→ShopWorks
├── STAFF_DIRECTORY.md                # Staff contact information
├── STAFF_DASHBOARD_DATA_GUIDE.md     # Staff dashboard data processing
├── PRODUCTION_SCHEDULE_GUIDE.md      # Production turnaround predictor
├── DAILY_SALES_ARCHIVE.md            # YTD sales tracking system
├── MONOGRAM_FORM_SYSTEM.md           # Monogram/personalization tracking
│
├── /api/                             # API endpoint modules
│   ├── products-api.md              # Product search & inventory
│   ├── product-showcase-api.md      # New Products & Top Sellers
│   ├── cart-pricing-api.md          # Cart & pricing bundles
│   ├── orders-quotes-api.md         # Orders & quote management
│   ├── utility-api.md               # Utilities & reference data
│   └── jds-industries-api.md        # JDS Industries API
│
├── /manageorders/                    # ManageOrders PULL API docs
│   ├── OVERVIEW.md                  # Architecture & authentication
│   ├── CUSTOMER_AUTOCOMPLETE.md     # Customer autocomplete
│   ├── API_REFERENCE.md             # Complete API spec (11 endpoints)
│   ├── OFFICIAL_API_SCHEMA.md       # Official GET/POST schemas
│   ├── SERVER_PROXY.md              # Proxy implementation
│   ├── BASIC_EXAMPLES.md            # Simple integrations
│   └── ADVANCED_EXAMPLES.md         # Multi-endpoint workflows
│
├── /manageorders-push/               # ManageOrders PUSH API docs (165 fields)
│   ├── FIELD_REFERENCE_CORE.md      # Master navigation hub
│   ├── SWAGGER_*.md                 # Swagger schema files (6 files)
│   ├── ORDER_FIELDS.md              # Order-level fields (54)
│   ├── PRODUCT_FIELDS.md            # Line item fields (47)
│   ├── PAYMENT_SHIPPING_FIELDS.md   # Auxiliary blocks (34)
│   ├── FORM_DEVELOPMENT_GUIDE.md    # Custom form patterns
│   ├── IMPLEMENTATION_EXAMPLES.md   # Working code snippets
│   └── TROUBLESHOOTING.md           # Common issues & solutions
│
├── /3-day-tees/                      # 3-Day Tees Fast Turnaround
│   ├── README.md                    # Overview & quick start
│   ├── OVERVIEW.md                  # Architecture (25 components)
│   ├── PRICING-FORMULA.md           # 7-step pricing + 25% rush fee
│   ├── INVENTORY-INTEGRATION.md     # Multi-SKU architecture
│   ├── API-PATTERNS.md              # 4 API endpoints
│   ├── BUSINESS-LOGIC.md            # Business rules & terms
│   └── (other implementation files)
│
├── /edp/                             # ShopWorks EDP blocks
│   ├── PRICING_SYNC_GUIDE.md        # Pricing sync guide
│   ├── PRODUCT_BLOCK.md             # Product documentation
│   ├── ORDER_BLOCK.md               # Order documentation
│   └── (other block files)
│
├── /templates/                       # Calculator templates
│   ├── calculator-components.md     # Shared components
│   ├── manual-calculator-template.md
│   ├── contract-calculator-template.md
│   └── specialty-calculator-template.md
│
└── MANUAL_CALCULATOR_*.md            # Manual calculator guide (3 parts)
```

## Quick Navigation

### API Integration
| Need | Start Here |
|------|-----------|
| Caspio Proxy API | [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) → [/api/](./api/) modules |
| ManageOrders PULL | [MANAGEORDERS_INTEGRATION.md](./MANAGEORDERS_INTEGRATION.md) → [/manageorders/](./manageorders/) |
| ManageOrders PUSH | [MANAGEORDERS_PUSH_WEBSTORE.md](./MANAGEORDERS_PUSH_WEBSTORE.md) → [/manageorders-push/](./manageorders-push/) |

### Development Guides
| Building | Start Here |
|----------|-----------|
| Quote Builder | [QUOTE_BUILDER_BEST_PRACTICES.md](./QUOTE_BUILDER_BEST_PRACTICES.md) |
| Pricing Calculator | [PRICING_CALCULATOR_GUIDE.md](./PRICING_CALCULATOR_GUIDE.md) → [/templates/](./templates/) |
| 3-Day Tees | [3-day-tees/OVERVIEW.md](./3-day-tees/OVERVIEW.md) |
| ShopWorks EDP | [SHOPWORKS_EDP_INTEGRATION.md](./SHOPWORKS_EDP_INTEGRATION.md) |

### Common Tasks
| Task | File |
|------|------|
| Add Sanmar product to ShopWorks | [SANMAR_TO_SHOPWORKS_GUIDE.md](./SANMAR_TO_SHOPWORKS_GUIDE.md) |
| Fix "Unable to Verify" inventory | [SAMPLE_INVENTORY_INTEGRATION_GUIDE.md](./SAMPLE_INVENTORY_INTEGRATION_GUIDE.md) |
| Customer autocomplete | [manageorders/CUSTOMER_AUTOCOMPLETE.md](./manageorders/CUSTOMER_AUTOCOMPLETE.md) |
| YTD Sales tracking | [DAILY_SALES_ARCHIVE.md](./DAILY_SALES_ARCHIVE.md) |
| Production turnaround estimates | [PRODUCTION_SCHEDULE_GUIDE.md](./PRODUCTION_SCHEDULE_GUIDE.md) |

## Quick Reference

### Quote ID Prefixes
```
DTG   - Direct-to-Garment       EMB   - Embroidery Contract
DTF   - Direct-to-Film          EMBC  - Customer Supplied Embroidery
SPC   - Screen Print Contract   CAP   - Cap Embroidery
LT    - Laser Tumblers          RICH  - Richardson Caps
PATCH - Embroidered Emblems     WEB   - Webstore Orders
```

### API Base URL
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api
```

---
*For detailed instructions, see individual documentation files.*
