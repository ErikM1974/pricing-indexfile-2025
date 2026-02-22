# NWCA Documentation Index

**Last Updated:** 2026-02-05 (embroidery pricing philosophy analysis, tab names clarified, decision flowchart added)
**Purpose:** Master navigation for all documentation files

## Directory Map

```
/memory/
├── INDEX.md                           # This file - Master navigation
├── CROSS_PROJECT_HUB.md              # **START HERE** - Entry point for all 3 projects
├── GLOSSARY.md                        # Shared terminology across all projects
├── LESSONS_LEARNED.md                 # Master lessons learned (all 3 projects)
├── CASPIO_API_CORE.md                # Core API documentation
├── ARCHITECTURE.md                   # System architecture patterns
├── PATTERNS.md                       # Code patterns and solutions
├── QUOTE_BUILDER_GUIDE.md            # Quote builder development guide
├── QUOTE_BUILDER_FEATURE_AUDIT.md    # Feature parity across all 4 builders
├── QUOTE_BUILDER_BEST_PRACTICES.md   # Copy-paste code patterns
├── QUOTE_BUILDER_WORKFLOWS.md        # **NEW** Text import, PDF, shareable URLs (2026-02-02)
├── QUOTE_BUILDER_API_INTEGRATION.md  # API endpoints for quote builders
├── QUOTE_BUILDER_LINE_ITEMS.md       # Parent/child row patterns
├── QUOTE_BUILDER_TEMPLATE.md         # HTML row structure templates
├── PRICING_CALCULATOR_GUIDE.md       # Pricing calculator guide
├── DTF_PRICING_SYSTEM.md             # DTF pricing formula
├── DTG_PRICING_CONSISTENCY.md        # DTG pricing consistency
├── BUNDLE_CALCULATOR_GUIDE.md        # Promotional bundle calculator
├── SHOPWORKS_EDP_INTEGRATION.md      # ShopWorks EDP integration
├── SANMAR_API_REFERENCE.md           # SanMar SOAP API — endpoints, size/color mapping, warehouses
├── SHOPWORKS_SIZE_MAPPING.md         # SanMar→ShopWorks data transformation
├── SHOPWORKS_EXTENDED_SKU_PATTERNS.md # Extended SKU patterns
├── PRODUCT_SKU_PATTERNS.md           # Product SKU patterns reference
├── DATABASE_PATTERNS.md              # Database schema patterns
├── MANAGEORDERS_INTEGRATION.md       # ManageOrders PULL API (11 endpoints)
├── MANAGEORDERS_PUSH_WEBSTORE.md     # ManageOrders PUSH API (4 endpoints)
├── MANAGEORDERS_COMPLETE_REFERENCE.md # **MASTER** - Complete API reference (all 3 projects)
├── MANAGEORDERS_API_GUIDE_OFFICIAL.md # Official PDF field lists — all PUSH objects (Order, Customer, Design, Line Item, etc.)
├── SANMAR_TO_SHOPWORKS_GUIDE.md      # Transform Sanmar→ShopWorks
├── STAFF_DIRECTORY.md                # Staff contact information
├── STAFF_DASHBOARD_DATA_GUIDE.md     # Staff dashboard data processing
├── PRODUCTION_SCHEDULE_GUIDE.md      # Production turnaround predictor
├── DAILY_SALES_ARCHIVE.md            # YTD sales tracking system
├── MONOGRAM_FORM_SYSTEM.md           # Monogram/personalization tracking
├── SECURITY_AUDIT_2026-01.md         # Security audit findings & fixes
├── API_AUDIT_2026-01.md              # API call audit report
├── 2026_PRICING_MARGINS.md           # 2026 pricing margins reference
├── REP_ACCOUNT_MANAGEMENT.md         # Rep account sync, reconcile, audit APIs
├── NIKA_DASHBOARD_BUILD_GUIDE.md     # Build guide for Nika's CRM dashboard
├── CUSTOMER_LOOKUP_SYSTEM.md         # Customer autocomplete for quote builders
├── SHOPWORKS_IMPORT_PLAN.md          # ShopWorks order text import for quote builders (IMPLEMENTED 2026-01-31)
├── SERVICE_CODES_TABLE.md            # **NEW** Caspio Service_Codes table design (2026-02-01)
├── CSV_ORDER_VALIDATION.md           # 2025 embroidery order validation (line item classification)
│                                      # Classification COMPLETE (2026-02-03): 20,380 items → 49 service codes,
│                                      # 76 non-SanMar products, 2,955 SanMar products, 166 unknowns
│
├── # Pricing References
├── PRICING_TIERS_MASTER_REFERENCE.md # **MASTER** All pricing tiers across all methods (2026-02-02)
├── EMBROIDERY_PRICING_RULES.md       # Complete embroidery pricing formulas reference
├── EMBROIDERY_PRICING_2026.md        # Feb 2026 embroidery tier restructure
├── EMBROIDERY_PRICING_PHILOSOPHY.md  # **NEW** Three-tier philosophy, loopholes, financial impact (2026-02-05)
├── EMBROIDERY_ITEM_TYPES.md          # Canonical ItemType reference for Embroidery_Costs
├── DECG_PRICING_2026.md              # Customer-supplied embroidery pricing (DECG)
│
├── # Quote Builder Implementation Files
├── QUOTE_BUILDER_ARCHITECTURE.md     # Quote builder system architecture
├── EMBROIDERY_QUOTE_BUILDER.md       # Embroidery quote builder implementation
├── LASER_PATCH_IMPLEMENTATION.md     # Laser leatherette patch feature (caps)
├── SCREENPRINT_QUOTE_BUILDER.md      # Screen print quote builder implementation
│
├── # Calculator Implementation Files
├── DTF_CALCULATOR_SPECIFICATION.md   # DTF calculator technical spec
├── MANUAL_CALCULATOR_CONCEPTS.md     # Manual calculator concepts
├── MANUAL_CALCULATOR_REFERENCE.md    # Manual calculator API reference
├── MANUAL_CALCULATOR_TEMPLATES.md    # Manual calculator HTML templates
│
├── # Integration & Features
├── UPS_SHIPPING_INTEGRATION_PLAN.md  # **NEW** UPS shipping rates for embroidery builder (PLANNED, 2026-02-10)
├── STRIPE_INTEGRATION_GUIDE.md       # Stripe payment integration
├── B2B_REWARDS_SYSTEM_PLAN.md        # B2B rewards system planning doc
├── FILE_UPLOAD_API_REQUIREMENTS.md   # File upload API specification
├── ARTREQUESTS_FILE_UPLOAD_GUIDE.md  # ArtRequests file upload guide
├── PROXY_BILLING_ADDRESS_IMPLEMENTATION.md # Billing address proxy feature
├── CASPIO_STAFF_AUTH.md              # Caspio staff authentication
├── CRM_DASHBOARD_AUTH.md             # CRM role-based auth (Express sessions)
├── CRM_DASHBOARD_RECONCILIATION.md   # Gap Report, authority conflicts, dashboard metrics
│
├── # Implementation Summaries
├── EXACT_MATCH_SEARCH_IMPLEMENTATION_SUMMARY.md # Exact match search feature
├── PC61_SHOPWORKS_SETUP_GUIDE.md     # PC61 product setup in ShopWorks
├── SAMPLE_CART_PRICING.md            # Sample cart pricing formulas
├── SAMPLE_ORDER_TESTING_GUIDE.md     # Sample order testing procedures
│
├── # Troubleshooting
├── DEBUGGING_COMMUNICATION.md        # Debugging communication guide
├── TROUBLESHOOTING_IMAGE_LOADING.md  # Image loading troubleshooting
│
├── /api/                             # API endpoint modules
│   ├── products-api.md              # Product search & inventory
│   ├── non-sanmar-products-api.md   # **NEW** Non-SanMar products CRUD (2026-02-03)
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
├── /quote-builders/                   # Quote Builder Implementation Guides
│   └── SHAREABLE_QUOTE_BLUEPRINT.md # **NEW** - Add shareable URLs to any builder
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
├── REP_TRAINING_PRICING_GAP_ANALYSIS.md  # **NEW** 2025 vs 2026 pricing gaps — Nika/Taylar training (2026-02-15)
├── SHOPWORKS_DATA_ENTRY_GUIDE.md         # **NEW** Data entry standards — STOP/START/CHECKLIST for reps (2026-02-15)
├── /training/                        # Staff Training Materials
│   └── EMBROIDERY_PRICING_SALES_TRAINING.md  # Sales rep training (Taneisha, Ruthie)
│
└── MANUAL_CALCULATOR_*.md            # Manual calculator guide (3 parts)
```

## Quick Navigation

### API Integration
| Need | Start Here |
|------|-----------|
| Caspio Proxy API | [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) → [/api/](./api/) modules |
| **Service Codes (Caspio)** | **[SERVICE_CODES_TABLE.md](./SERVICE_CODES_TABLE.md)** - DD, AL, FB, DECG pricing table |
| **ManageOrders (Complete)** | **[MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md)** - Single source of truth |
| ManageOrders PULL (detail) | [MANAGEORDERS_INTEGRATION.md](./MANAGEORDERS_INTEGRATION.md) → [/manageorders/](./manageorders/) |
| ManageOrders PUSH (detail) | [MANAGEORDERS_PUSH_WEBSTORE.md](./MANAGEORDERS_PUSH_WEBSTORE.md) → [/manageorders-push/](./manageorders-push/) |
| **CRM/Order Entry System** | **[MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md](./MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md)** - Field glossary, capabilities |
| **SanMar API Reference** | **[SANMAR_API_REFERENCE.md](./SANMAR_API_REFERENCE.md)** - SOAP API endpoints, size/color mapping, warehouses |
| **ManageOrders Official Fields** | **[MANAGEORDERS_API_GUIDE_OFFICIAL.md](./MANAGEORDERS_API_GUIDE_OFFICIAL.md)** - All PUSH object field lists from official PDF |

### Pricing References
| Need | Start Here |
|------|-----------|
| **All Pricing Tiers** | **[PRICING_TIERS_MASTER_REFERENCE.md](./PRICING_TIERS_MASTER_REFERENCE.md)** - All methods, all tiers, LTM thresholds |
| Embroidery Pricing | [EMBROIDERY_PRICING_RULES.md](./EMBROIDERY_PRICING_RULES.md) - Formulas, FB, AL, caps |
| **Emb Pricing Philosophy** | **[EMBROIDERY_PRICING_PHILOSOPHY.md](./EMBROIDERY_PRICING_PHILOSOPHY.md)** - Three-tier philosophy, loopholes |
| **Embroidery Pricing Page** | `/calculators/embroidery-pricing-all/` - 3-tab page: Contract \| AL Retail \| DECG Retail (API-driven) |
| **Embroidery ItemTypes** | **[EMBROIDERY_ITEM_TYPES.md](./EMBROIDERY_ITEM_TYPES.md)** - Canonical ItemType reference, prevents duplicates |
| 2026 Tier Restructure | [EMBROIDERY_PRICING_2026.md](./EMBROIDERY_PRICING_2026.md) - 5-tier details |
| 2026 Pricing Margins | [2026_PRICING_MARGINS.md](./2026_PRICING_MARGINS.md) - Margin denominators |

### Development Guides
| Building | Start Here |
|----------|-----------|
| **Customer Lookup System** | **[CUSTOMER_LOOKUP_SYSTEM.md](./CUSTOMER_LOOKUP_SYSTEM.md)** - Autocomplete for quote builders |
| Quote Builder | [QUOTE_BUILDER_BEST_PRACTICES.md](./QUOTE_BUILDER_BEST_PRACTICES.md) |
| **Quote Builder Feature Audit** | **[QUOTE_BUILDER_FEATURE_AUDIT.md](./QUOTE_BUILDER_FEATURE_AUDIT.md)** - Feature parity across all 4 |
| Quote Builder Architecture | [QUOTE_BUILDER_ARCHITECTURE.md](./QUOTE_BUILDER_ARCHITECTURE.md) |
| **Quote Builder Workflows** | **[QUOTE_BUILDER_WORKFLOWS.md](./QUOTE_BUILDER_WORKFLOWS.md)** - Text import, PDF, shareable URLs |
| **Shareable Quote URLs** | **[quote-builders/SHAREABLE_QUOTE_BLUEPRINT.md](./quote-builders/SHAREABLE_QUOTE_BLUEPRINT.md)** - Add to any builder |
| Embroidery Quote Builder | [EMBROIDERY_QUOTE_BUILDER.md](./EMBROIDERY_QUOTE_BUILDER.md) |
| **Embroidery Pricing Rules** | **[EMBROIDERY_PRICING_RULES.md](./EMBROIDERY_PRICING_RULES.md)** - Complete pricing formulas, FB, AL, caps |
| **Laser Patch Feature** | **[LASER_PATCH_IMPLEMENTATION.md](./LASER_PATCH_IMPLEMENTATION.md)** - Caps, GRT-50 setup, bugs & fixes |
| Screenprint Quote Builder | [SCREENPRINT_QUOTE_BUILDER.md](./SCREENPRINT_QUOTE_BUILDER.md) |
| Pricing Calculator | [PRICING_CALCULATOR_GUIDE.md](./PRICING_CALCULATOR_GUIDE.md) → [/templates/](./templates/) |
| DTF Calculator Spec | [DTF_CALCULATOR_SPECIFICATION.md](./DTF_CALCULATOR_SPECIFICATION.md) |
| Manual Calculator | [MANUAL_CALCULATOR_CONCEPTS.md](./MANUAL_CALCULATOR_CONCEPTS.md) |
| 3-Day Tees | [3-day-tees/OVERVIEW.md](./3-day-tees/OVERVIEW.md) |
| 3-Day Tees Order Flow | [3-day-tees/ORDER_PUSH_FLOW.md](./3-day-tees/ORDER_PUSH_FLOW.md) - Stripe→ShopWorks |
| ShopWorks EDP | [SHOPWORKS_EDP_INTEGRATION.md](./SHOPWORKS_EDP_INTEGRATION.md) |
| PC61 Setup Guide | [PC61_SHOPWORKS_SETUP_GUIDE.md](./PC61_SHOPWORKS_SETUP_GUIDE.md) |
| ArtRequests File Upload | [ARTREQUESTS_FILE_UPLOAD_GUIDE.md](./ARTREQUESTS_FILE_UPLOAD_GUIDE.md) |

### Training Materials
| Document | Audience |
|----------|----------|
| **Embroidery Pricing Training** | [training/EMBROIDERY_PRICING_SALES_TRAINING.md](./training/EMBROIDERY_PRICING_SALES_TRAINING.md) - Taneisha, Ruthie |
| **Pricing Gap Analysis** | [REP_TRAINING_PRICING_GAP_ANALYSIS.md](./REP_TRAINING_PRICING_GAP_ANALYSIS.md) - 2025 vs 2026 pricing gaps, rep-specific patterns (Nika, Taylar) |
| **ShopWorks Data Entry Guide** | [SHOPWORKS_DATA_ENTRY_GUIDE.md](./SHOPWORKS_DATA_ENTRY_GUIDE.md) - STOP/START/CHECKLIST for clean data entry (print for rep desks) |

### Rep CRM Dashboards
| Guide | Description |
|-------|-------------|
| **Nika Dashboard Build** | [NIKA_DASHBOARD_BUILD_GUIDE.md](./NIKA_DASHBOARD_BUILD_GUIDE.md) - Copy from Taneisha's CRM |
| Rep Account Management | [REP_ACCOUNT_MANAGEMENT.md](./REP_ACCOUNT_MANAGEMENT.md) - Backend API docs |

### Common Tasks
| Task | File |
|------|------|
| Add Sanmar product to ShopWorks | [SANMAR_TO_SHOPWORKS_GUIDE.md](./SANMAR_TO_SHOPWORKS_GUIDE.md) |
| Fix "Unable to Verify" inventory | [SAMPLE_INVENTORY_INTEGRATION_GUIDE.md](./SAMPLE_INVENTORY_INTEGRATION_GUIDE.md) |
| Customer autocomplete | [manageorders/CUSTOMER_AUTOCOMPLETE.md](./manageorders/CUSTOMER_AUTOCOMPLETE.md) |
| YTD Sales tracking | [DAILY_SALES_ARCHIVE.md](./DAILY_SALES_ARCHIVE.md) |
| Production turnaround estimates | [PRODUCTION_SCHEDULE_GUIDE.md](./PRODUCTION_SCHEDULE_GUIDE.md) |

### Security & Payments
| Need | Start Here |
|------|------------|
| Security audit & fixes | [SECURITY_AUDIT_2026-01.md](./SECURITY_AUDIT_2026-01.md) |
| API call audit | [API_AUDIT_2026-01.md](./API_AUDIT_2026-01.md) |
| Stripe payments | [STRIPE_INTEGRATION_GUIDE.md](./STRIPE_INTEGRATION_GUIDE.md) |
| Staff authentication | [CASPIO_STAFF_AUTH.md](./CASPIO_STAFF_AUTH.md) |
| CRM dashboard auth | [CRM_DASHBOARD_AUTH.md](./CRM_DASHBOARD_AUTH.md) |

### Troubleshooting
| Issue | Reference |
|-------|-----------|
| Image loading issues | [TROUBLESHOOTING_IMAGE_LOADING.md](./TROUBLESHOOTING_IMAGE_LOADING.md) |
| Debug communication | [DEBUGGING_COMMUNICATION.md](./DEBUGGING_COMMUNICATION.md) |
| Sample order testing | [SAMPLE_ORDER_TESTING_GUIDE.md](./SAMPLE_ORDER_TESTING_GUIDE.md) |

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
