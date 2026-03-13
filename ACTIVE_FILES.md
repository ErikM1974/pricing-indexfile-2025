# Active Files Registry
**Last Updated:** 2026-02-27
**Total Active Files:** ~320 (includes all calculators, quote builders, dashboards, CRM, design gallery, DST viewer, 3-Day Tees, and testing suite)
**Purpose:** Track all active files to prevent orphaned code accumulation

## ⚠️ Root Directory JavaScript Files (Legacy Location)

**Note:** These files are still in root directory for historical reasons. They should eventually move to `/shared_components/js/` but currently index.html and cart.html depend on these paths.

**⚠️ IMPORTANT:** DO NOT MOVE these files without updating all HTML references. Both index.html and cart.html have hardcoded paths to these root files.

| File | Purpose | Used By | Future Action |
|------|---------|---------|---------------|
| `app-modern.js` | Main application logic | index.html | Move to shared_components |
| `app-new.js` | New app version | Unknown | Verify if needed |
| `autocomplete-new.js` | Search autocomplete | index.html | Move to shared_components |
| `c112-bogo-promo.js` | BOGO promotion logic | Specific promo | Move to calculators |
| `cart.js` | Cart functionality | cart.html | Move to shared_components |
| `cart-ui.js` | Cart UI components | cart.html | Move to shared_components |
| `cart-price-recalculator.js` | Price recalculation | cart.html | Move to shared_components |
| `catalog-search.js` | Catalog search | index.html | Move to shared_components |
| `dp5-helper.js` | Helper functions | Unknown | Verify if needed |
| `order-form-pdf.js` | PDF generation | cart.html | Move to shared_components |
| `pricing-matrix-api.js` | Pricing API | cart.html | Move to shared_components |
| `product-search-service.js` | Product search | index.html, multiple | Move to shared_components |
| `utils.js` | Utility functions | Multiple pages | Move to shared_components |

## 🎯 Core Entry Points

### Main Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/index.html` | Main catalog page | app-modern.js, product-search-service.js, catalog-search.js, autocomplete-new.js | ✅ Active |
| `/cart.html` | Shopping cart | cart.js, cart-ui.js, cart-price-recalculator.js, order-form-pdf.js, pricing-matrix-api.js, utils.js | ✅ Active |
| `/product.html` | Product display | /product/app.js | ✅ Active |

### Secondary Pages (/pages/ directory)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/policies-hub.html` | Policy documentation hub | dashboard-styles.css | ✅ Active |
| `/pages/pricing-negotiation-policy.html` | Pricing strategy & negotiation guide | Bootstrap, Font Awesome | ✅ Active |
| `/pages/inventory-details.html` | Inventory details page | Various | ✅ Active |
| `/pages/resources.html` | Resources page | Various | ✅ Active |
| `/pages/sale.html` | Sale page | Various | ✅ Active |
| `/pages/webstore-info.html` | Webstore information | Various | ✅ Active |
| `/pages/top-sellers-showcase.html` | Top sellers showcase (API-driven "New Products" filter - see CLAUDE.md § "Managing New Products") | Various | ✅ Active |
| `/pages/top-sellers-product.html` | Top sellers product page | Various | ✅ Active |
| `/pages/quote-view.html` | **NEW** Public quote viewing page (shareable URL) | quote-view.js, quote-view.css | ✅ Active |
| `/pages/embroidery-contract-pricing.html` | **NEW** Shareable contract embroidery pricing page | embroidery-contract-pricing.js, embroidery-contract-pricing.css | ✅ Active |
| `/pages/data-entry-guide.html` | **NEW** ShopWorks data entry guide with API-driven service prices | data-entry-guide.js, data-entry-guide.css, app-config.js | ✅ Active |
| `/pages/data-entry-guide.js` | **NEW** API price fetching for data entry guide | /api/service-codes | ✅ Active |
| `/pages/data-entry-guide.css` | **NEW** Data entry guide styles (print-friendly) | — | ✅ Active |
| `/pages/design-gallery.html` | **NEW** Standalone design gallery — search 39K+ digitized designs | design-gallery.js, design-gallery.css, design-thumbnail-service.js, app-config.js | ✅ Active |
| `/pages/js/design-gallery.js` | **NEW** Design gallery controller — search, cards, share with customer, lightbox zoom | /api/digitized-designs/search-all, /by-customer | ✅ Active |
| `/pages/css/design-gallery.css` | **NEW** Design gallery page styles (responsive grid, cards, enlarged modal, lightbox) | — | ✅ Active |
| `/pages/design-view.html` | **NEW** Public customer-facing design preview page — shareable via /design/:designNumber | design-view.js, design-view.css, app-config.js | ✅ Active |
| `/pages/js/design-view.js` | **NEW** Customer design view — fetches design images, renders gallery + lightbox | /api/digitized-designs/lookup | ✅ Active |
| `/pages/css/design-view.css` | **NEW** Customer design view styles (branded, responsive, lightbox overlay) | — | ✅ Active |
| `/pages/art-request-detail.html` | **NEW** Staff-facing art request detail page — shareable via /art-request/:designId | art-request-detail.js, art-request-detail.css, app-config.js | ✅ Active |
| `/pages/js/art-request-detail.js` | **NEW** Art request detail — fetches art request + notes, renders info cards + timeline, Box file upload | /api/artrequests, /api/design-notes, /api/art-requests/:id/upload-mockup (box-upload.js) | ✅ Active |
| `/pages/css/art-request-detail.css` | **NEW** Art request detail styles (two-column, status badges, billing grid, notes timeline) | — | ✅ Active |
| `/pages/dst-viewer.html` | **NEW** DST embroidery stitch file viewer — drag-drop .DST, color/mono/trace modes | dst-viewer.js, dst-viewer.css, Font Awesome, DM Mono/Outfit fonts | ✅ Active |
| `/pages/js/dst-viewer.js` | **NEW** DST binary parser, canvas renderer (3 modes), trace animation, thread color sequence | Vanilla JS, no dependencies | ✅ Active |
| `/pages/css/dst-viewer.css` | **NEW** DST viewer dark theme styles (2-col grid, canvas, sidebar, trace controls, responsive) | CSS variables | ✅ Active |

### 3-Day Tees System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/3-day-tees.html` | 3-Day Tees ordering page (Stripe checkout) | 3-day-tees.js, 3-day-tees-redesign.css | ✅ Active |
| `/pages/3-day-tees-success.html` | Post-purchase success/confirmation page | — | ✅ Active |
| `/pages/js/3-day-tees.js` | 3-Day Tees order logic, Stripe integration, cart | ApiService.js, InventoryService.js | ✅ Active |
| `/pages/css/3-day-tees-redesign.css` | 3-Day Tees page styles | — | ✅ Active |
| `/pages/js/services/ApiService.js` | API service for 3-Day Tees (product, inventory, orders) | — | ✅ Active |
| `/pages/js/services/InventoryService.js` | Inventory service for 3-Day Tees real-time stock | — | ✅ Active |
| `/pages/js/utils/debounce.js` | Debounce utility for 3-Day Tees search | — | ✅ Active |

### Other Pages (Undocumented Until 2026-02-27)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/richardson-112-product.html` | Richardson 112 product display page | richardson-112-product.css | ✅ Active |
| `/pages/richardson-112-product.css` | Richardson 112 page styles | — | ✅ Active |
| `/pages/dtg-compatible-products.html` | DTG-compatible products listing | — | ✅ Active |
| `/pages/sample-cart.html` | Sample ordering cart page | — | ✅ Active |
| `/pages/order-confirmation.html` | Order confirmation page | — | ✅ Active |
| `/pages/top-sellers-product.css` | Top sellers product page styles | — | ✅ Active |
| `/pages/css/policies-hub.css` | Policies hub page styles | — | ✅ Active |
| `/pages/css/utilities.css` | Shared utility CSS for pages | — | ✅ Active |
| `/pages/policies/dtg-artwork-checklist.html` | DTG artwork preparation checklist | — | ✅ Active |

## 📊 Calculators & Quote Builders

### Unified Manual Pricing Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/manual-pricing.html` | Unified manual pricing — all 5 methods on one page | manual-pricing.js, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/manual-pricing.js` | Page logic — orchestrates DTG/DTF/EMB/CAP/SP pricing services | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/manual-pricing.css` | Page styles — extends manual-calculator-styles.css | manual-calculator-styles.css | ✅ Active |

### Service Price Cheat Sheet
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/service-price-cheat-sheet.html` | Printable service price reference — all embroidery service prices | service-price-cheat-sheet.js, .css, app-config.js | ✅ Active |
| `/calculators/service-price-cheat-sheet.js` | API-driven price fetching and rendering | /api/service-codes, /api/decg-pricing, /api/al-pricing | ✅ Active |
| `/calculators/service-price-cheat-sheet.css` | Page styles with print-friendly layout | — | ✅ Active |

### Compare Pricing by Style
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/compare-pricing.html` | Compare pricing by SanMar style — all methods on one page | compare-pricing.js, compare-pricing.css, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/compare-pricing.js` | Page logic — fetches SanMar product data then pricing | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/compare-pricing.css` | Page styles — product info banner, extends manual-pricing.css | manual-pricing.css, manual-calculator-styles.css | ✅ Active |

### DTG System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-pricing.html` | DTG pricing calculator | dtg-adapter.js, dtg-pricing-service.js | ✅ Active |
| `/calculators/dtg-manual-pricing.html` | Manual DTG pricing | dtg-config.js | ✅ Active |
| `/quote-builders/dtg-quote-builder.html` | DTG Quote Builder 2026 (Excel-style) | dtg-quote-pricing.js | ✅ Active |
| `/shared_components/js/dtg-quote-builder.js` | DTG quote builder controller | DTGQuotePricing class | ✅ Active |
| `/shared_components/js/dtg-quote-pricing.js` | DTG quote pricing engine | Caspio API | ✅ Active |
| `/shared_components/js/dtg-quote-products.js` | DTG quote product manager | SanMar API | ✅ Active |
| `/shared_components/js/dtg-quote-service.js` | DTG quote save/email service | Caspio API, EmailJS | ✅ Active |
| `/shared_components/js/dtg-quote-system.js` | DTG quote system orchestrator | — | ✅ Active |

### DTF System

#### DTF Pricing Calculator (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pricing/dtf/index.html` | DTF pricing page | dtf-pricing-calculator.js | ✅ Active |
| `/shared_components/js/dtf-pricing-calculator.js` | DTF calculator UI & pricing logic | dtf-pricing-service.js, DTFConfig | ✅ Active |
| `/shared_components/js/dtf-pricing-service.js` | API data fetcher & transformer | Caspio API | ✅ Active |
| `/shared_components/js/dtf-integration.js` | Coordinates calculator, adapter, events | dtf-pricing-calculator.js | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | Caspio data adapter | Caspio API | ✅ Active |
| `/shared_components/js/dtf-config.js` | Location mappings (no pricing values) | - | ✅ Active |
| `/shared_components/css/dtf-toggle-pricing.css` | Toggle interface styles | - | ✅ Active |

#### DTF Quote Builder (Staff)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/dtf-quote-builder.html` | DTF Quote Builder 2026 (Excel-style) | 4 JS files below | ✅ Active |
| `/shared_components/js/dtf-quote-builder.js` | Main DTF quote controller | DTFQuotePricing class | ✅ Active |
| `/shared_components/js/dtf-quote-pricing.js` | **CONSOLIDATED** Pricing + Config + Service | Caspio API | ✅ Active |
| `/shared_components/js/dtf-quote-products.js` | DTF quote product manager | ExactMatchSearch | ✅ Active |
| `/shared_components/js/dtf-quote-service.js` | DTF quote database service | EmailJS, Caspio API | ✅ Active |
| `/shared_components/css/dtf-quote-builder.css` | DTF quote builder styles (green theme) | - | ✅ Active |

**DTF Formula Alignment (2026-01-07):** Fixed dtf-pricing-calculator.js to use pre-transformed API data from service. Both calculator and quote builder now use identical pricing formula. See `/memory/DTF_PRICING_SYSTEM.md`.

### Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | **UNIFIED** Embroidery pricing page (Contract + DECG tabs) | embroidery-pricing-all.js | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.js` | Combined Contract/DECG pricing logic (linear $/1K model) | /api/contract-pricing, /api/decg-pricing | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.css` | Tabbed interface styles | - | ✅ Active |
| `/quote-builders/embroidery-quote-builder.html` | Embroidery/Cap Combo Quote Builder 2026 (Excel-style) | embroidery-quote-pricing.js | ✅ Active |
| `/shared_components/js/embroidery-quote-pricing.js` | Embroidery pricing engine (tiers, LTM, stitch surcharges, FB) | Caspio API | ✅ Active |
| `/shared_components/js/embroidery-quote-service.js` | Embroidery quote save/update/email service | Caspio API, EmailJS | ✅ Active |
| `/shared_components/js/embroidery-quote-invoice.js` | Embroidery invoice generation (ShopWorks format) | — | ✅ Active |
| `/shared_components/js/embroidery-quote-products.js` | Embroidery product row management | SanMar API | ✅ Active |
| `/shared_components/js/embroidery-quote-logos.js` | Logo card management (positions, stitch tiers, AL) | — | ✅ Active |
| `/shared_components/js/embroidery-quote-adapter.js` | Embroidery data adapter (Caspio → pricing engine) | Caspio API | ✅ Active |

### Screen Print System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screen-print-pricing.html` | Screen print calculator | screenprint-pricing-v2.js, screenprint-pricing-service.js | ✅ Active |
| `/quote-builders/screenprint-quote-builder.html` | Screen Print Quote Builder 2026 (Excel-style) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-pricing.js` | Screen print quote pricing engine | Caspio API | ✅ Active |
| `/shared_components/js/screenprint-quote-products.js` | Screen print quote product manager | SanMar API | ✅ Active |
| `/shared_components/js/screenprint-quote-service.js` | Screen print quote save/email service | Caspio API, EmailJS | ✅ Active |
| `/quote-builders/screenprint-fast-quote.html` | Fast quote form (60 sec) | screenprint-fast-quote-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-v2.js` | Main calculator logic | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-service.js` | Pricing data adapter | Caspio API | ✅ Active |
| `/shared_components/js/screenprint-fast-quote-service.js` | Fast quote service | EmailJS, Caspio API | ✅ Active |

### Monogram Form System (NEW 2026-01-08)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/monogram-form.html` | Monogram/personalization tracking form | monogram-form-service.js, monogram-form-controller.js | ✅ Active |
| `/shared_components/js/monogram-form-service.js` | API service (ManageOrders, Caspio) | ManageOrders API | ✅ Active |
| `/shared_components/js/monogram-form-controller.js` | UI controller and state management | monogram-form-service.js | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styling | quote-builder-common.css | ✅ Active |
| `/memory/MONOGRAM_FORM_SYSTEM.md` | Implementation documentation | - | 📚 Docs |

**Features:** Order lookup from ShopWorks, dynamic name entry (up to 50), print PDF for production, search by order/company.

### Cap Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/cap-embroidery-pricing-integrated.html` | SanMar cap pricing (23 Richardson styles) | cap-embroidery-pricing-service.js | ✅ Active |
| `/calculators/richardson-2025.html` | Richardson Factory Direct pricing (133 styles) | richardson-factory-direct.js | ✅ Active |
| `/calculators/richardson-factory-direct.js` | Richardson pricing lookup (2026 refactor - simplified) | API pricing-bundle | ✅ Active |
| `/calculators/richardson-2025-styles.css` | Richardson page styles | - | ✅ Active |

### Webstore System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/webstores.html` | Webstore quote + fundraiser calculator | webstores-calculator.js, webstores-fundraiser.js, webstores-styles.css | ✅ Active |
| `/calculators/webstores-calculator.js` | Webstore setup quote logic + email | webstores-quote-service.js, EmailJS | ✅ Active |
| `/calculators/webstores-fundraiser.js` | **NEW** Fundraiser/donation pricing calculator | — | ✅ Active |
| `/calculators/webstores-quote-service.js` | Webstore quote save service | base-quote-service.js | ✅ Active |
| `/calculators/webstores-styles.css` | Webstore + fundraiser styles | calculator-base.css | ✅ Active |

### Special Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/christmas-bundles.html` | Christmas bundle | product-search-service.js | ✅ Active |
| `/calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html` | BCA bundle (Oct 2025 promo - archived) | breast-cancer-bundle-service.js | 📦 Archived |
| `/calculators/safety-stripe-creator.html` | Safety stripes | safety-stripe-calculator.js | ✅ Active |
| `/calculators/art-invoice-creator.html` | Art invoices | art-invoice-service-v2.js | ✅ Active |

### DTG Contract Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-contract/index.html` | DTG contract pricing calculator | dtg-contract-calculator.js | ✅ Active |
| `/calculators/dtg-contract/dtg-contract-calculator.js` | DTG contract calculator logic | dtg-pricing-service.js | ✅ Active |
| `/calculators/dtg-contract/dtg-quote-service.js` | DTG contract quote save service | base-quote-service.js | ✅ Active |
| `/calculators/dtg-contract/dtg-contract-styles.css` | DTG contract page styles | — | ✅ Active |
| `/calculators/dtg-contract/dtg-contract-fix.css` | DTG contract style fixes | — | ✅ Active |

### Screen Print Customer Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screenprint-customer/index.html` | Screen print customer pricing calculator | screenprint-customer-calculator.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-calculator.js` | Customer-facing screen print calculator logic | screenprint-pricing-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-quote-service.js` | Screen print customer quote save service | base-quote-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-styles.css` | Screen print customer page styles | — | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-fix.css` | Screen print customer style fixes | — | ✅ Active |

### Embroidered Emblem Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidered-emblem/index.html` | Embroidered emblem/patch pricing calculator | emblem-calculator.js | ✅ Active |
| `/calculators/embroidered-emblem/emblem-calculator.js` | Emblem calculator logic | — | ✅ Active |
| `/calculators/embroidered-emblem/emblem-quote-service.js` | Emblem quote save service | base-quote-service.js | ✅ Active |
| `/calculators/embroidered-emblem/embroidered-emblem-styles.css` | Emblem page styles | — | ✅ Active |

### Laser Tumbler & Sticker Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/laser-tumbler-polarcamel.html` | Laser tumbler (Polar Camel) pricing calculator | laser-tumbler-calculator.js | ✅ Active |
| `/calculators/laser-tumbler-calculator.js` | Laser tumbler calculator logic | — | ✅ Active |
| `/calculators/laser-tumbler-styles.css` | Laser tumbler page styles | — | ✅ Active |
| `/calculators/laser-tumbler-quote-service.js` | Laser tumbler quote save service | base-quote-service.js | ✅ Active |
| `/calculators/sticker-manual-pricing.html` | Sticker pricing table page | — | ✅ Active |
| `/calculators/laser-manual-pricing.html` | Laser pricing calculator (manual) | manual-calculator-styles.css | ✅ Active |

### Caspio-Embedded Forms
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/digitizingform.html` | Digitizing request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/monogramform.html` | Monogram request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/purchasingform.html` | Purchasing form (Caspio-embedded) | Caspio datapage | ✅ Active |

### Embroidery Pricing (Unified - Feb 2026)

**All embroidery pricing now consolidated in `/calculators/embroidery-pricing-all/`**

| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | Unified AL/CEMB + DECG pricing page | embroidery-pricing-all.js, .css | ✅ Active |
| `/calculators/embroidery-pricing.html` | Embroidery pricing calculator (garment + cap) | embroidery-pricing-service.js | ✅ Active |
| `/calculators/archive/embroidery-customer/*` | DECG standalone calculator | - | 📦 Archived |
| `/calculators/archive/embroidery-contract/*` | Contract embroidery calculator | - | 📦 Archived |
| `/calculators/archive/embroidery-pricing.html` | Old embroidery pricing page | - | 📦 Archived |

**AL/CEMB Pricing (Additional Logo / Contract Embroidery):**
- Garments: 5K base, $13→$5 (1-7 to 72+), +$1.00/1K
- Caps (AL-CAP/CB/CS): 5K base, $6.50→$4 (1-7 to 72+), +$1.00/1K
- Full Back (FB): $1.25/1K flat rate, 25K minimum
- LTM Fee: $50 for qty 1-7
- **API:** `/api/al-pricing`

**DECG Pricing (Customer-Supplied Embroidery):**
- Garments: $28-$20/pc (1-7 to 72+ tier) + $1.25/1K above 8K stitches
- Caps: $22.50-$16/pc (1-7 to 72+ tier) + $1.00/1K above 8K stitches
- Full Back: $1.40-$1.20/1K (8-23 to 72+ tier, **MIN 8 PIECES**, min 25K stitches)
- LTM Fee: $50 for 1-7 pieces (garments/caps only, not full back)
- Heavyweight Surcharge: +$10/piece (Carhartt jackets, bags, canvas, leather)
- **API:** `/api/decg-pricing`
- **Docs:** `/memory/DECG_PRICING_2026.md`, `/memory/EMBROIDERY_PRICING_RULES.md`

## 🔧 Services & Components

### Core JavaScript Services
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/config/app.config.js` | Central configuration - ALL hardcoded values | All pages | ✅ Active |
| `/shared_components/js/base-quote-service.js` | Base quote class | All quote builders | ✅ Active |
| `/shared_components/js/calculator-utilities.js` | Shared utilities | All calculators | ✅ Active |
| `/shared_components/js/utils.js` | General utilities | Multiple pages | ✅ Active |
| `/shared_components/js/app-config.js` | Legacy config (migrate to /config/) | DTF system | ⚠️ Deprecate |

### Adapters (Master Bundle Pattern)
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/dtg-adapter.js` | DTG pricing adapter | DTG, DTF systems | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | DTF pricing adapter | DTF system | ✅ Active |
| `/shared_components/js/embroidery-pricing-service.js` | Embroidery adapter | Embroidery system | ✅ Active |

### Quote System Components
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/quote-builder-base.js` | Base functionality | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-utils.js` | **NEW** Shared utilities: escapeHtml, formatPrice, showToast, etc. (2026-01-30 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/fetch-timeout.js` | Global fetch() wrapper adding 15s AbortController timeout to all requests | All embroidery pages | ✅ Active |
| `/shared_components/js/quote-formatter.js` | Format quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-persistence.js` | Save/load quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-session.js` | Session management | All quote builders | ✅ Active |
| `/shared_components/js/quote-validation.js` | Input validation | All quote builders | ✅ Active |
| `/shared_components/js/quote-ui-feedback.js` | User feedback | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-step2-modern.js` | **NEW** Modern Step 2 UI manager (2025 refactor) | Embroidery & Cap quote builders | ✅ Active |
| `/shared_components/js/sidebar-resize.js` | **NEW** Resizable sidebar with drag handle | Embroidery quote builder | ✅ Active |
| `/shared_components/js/color-picker-component.js` | **NEW** Shared color picker module (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/extended-sizes-config.js` | **NEW** Shared extended sizes config (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-core.js` | **NEW** Core quote builder functionality (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/pricing-sidebar-component.js` | **NEW** Unified pricing sidebar (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-share-modal.js` | **NEW** Shareable URL success modal (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/customer-lookup-service.js` | **NEW** Customer autocomplete search (2026-01-29) | All quote builders | ✅ Active |
| `/shared_components/js/product-thumbnail-modal.js` | **NEW** Product image thumbnail + click-to-enlarge modal (2026-01-29) | DTG, Screen Print, Embroidery builders | ✅ Active |
| `/shared_components/js/shopworks-import-parser.js` | **NEW** ShopWorks order text parser (2026-01-31) | Embroidery quote builder | ✅ Active |
| `/shared_components/js/INTEGRATION-EXAMPLE.js` | **NEW** Integration example/docs (2026 consolidation) | Reference only | 📚 Docs |

### Customer Lookup System (NEW 2026-01-29)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/customer-lookup-service.js` | Customer autocomplete from Caspio Company_Contacts_Merge_ODBC | caspio-proxy API | ✅ Active |
| `/shared_components/css/customer-lookup.css` | Autocomplete dropdown styling | - | ✅ Active |

**Backend (caspio-pricing-proxy):**

### ShopWorks Import System (NEW 2026-01-31)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/shopworks-import-parser.js` | Parse ShopWorks order text into structured data | - | ✅ Active |
| `/shared_components/css/shopworks-import.css` | Import modal and preview styling | - | ✅ Active |
| `/shared_components/css/old-designs.css` | Old designs archive page styling (amber theme) | - | ✅ Active |
| `/shared_components/js/old-designs.js` | Old designs image modal and Caspio enhancements | - | ✅ Active |

**Features:**
- "Paste from ShopWorks" button in quote builders
- Parses customer info, products, sizes, quantities
- Detects service items: digitizing (DD), additional logo (AL), DECG, monograms
- Auto-populates customer, sales rep, and product rows
- Preview before import with summary

**Backend (caspio-pricing-proxy):**
- `GET /api/company-contacts/search?q=<term>` - Search contacts by company, name, or email
- `GET /api/company-contacts/:id` - Get single contact
- `POST /api/company-contacts` - Create new contact
- `PUT /api/company-contacts/:id` - Update contact
- `POST /api/company-contacts/sync` - Sync contacts from ManageOrders (Heroku Scheduler)

**Features:**
- Autocomplete search with 3+ character minimum
- Active customers only (Customersts_Active = 1)
- Results sorted by most recent order
- Auto-fills name, email, company fields in quote builders
- Phone field removed from all quote builders (not in Caspio table)

### Public Quote View System (NEW 2026-01-12)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/quote-view.html` | Public customer-facing quote page | quote-view.js, quote-view.css, jsPDF | ✅ Active |
| `/pages/js/quote-view.js` | Quote data loading, PDF generation, acceptance flow | jsPDF, html2canvas | ✅ Active |
| `/pages/css/quote-view.css` | Professional quote styling (mobile-responsive) | Inter font | ✅ Active |
| `/pages/quote-audit.html` | Staff-only pricing audit page (SW vs 2026) | quote-audit.js, quote-audit.css, staff-auth-helper.js | ✅ Active |
| `/pages/js/quote-audit.js` | Audit data rendering, staff auth gate | staff-auth-helper.js | ✅ Active |
| `/pages/css/quote-audit.css` | Audit page styling (self-contained) | Inter font | ✅ Active |

**Server Routes (server.js):**
- `GET /quote/:quoteId` - Serves public quote page
- `GET /api/public/quote/:quoteId` - Returns quote data + tracks views
- `POST /api/public/quote/:quoteId/accept` - Accepts quote with name/email
- `GET /api/quote_items/quote/:quoteId` - Get items by quote ID

**Features:**
- Shareable URLs like `nwcustomapparel.com/quote/DTF0112-1`
- View tracking (FirstViewedAt, ViewCount)
- One-click PDF download via jsPDF
- Quote acceptance workflow
- Status badges (Open, Viewed, Accepted, Expired)

**Database Fields Required in `quote_sessions` (Caspio):**
- `FirstViewedAt` (DateTime) - When customer first opened
- `ViewCount` (Integer) - Number of times viewed
- `AcceptedAt` (DateTime) - When customer accepted
- `AcceptedByName` (Text) - Name of person accepting
- `AcceptedByEmail` (Text) - Email of person accepting

## 🎨 Stylesheets

### Core CSS Files
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/universal-header.css` | Header styles | All pages | ✅ Active |
| `/shared_components/css/universal-calculator-theme.css` | Calculator theme | All calculators | ✅ Active |
| `/shared_components/css/embroidery-quote-builder.css` | Embroidery styles | Quote builders | ✅ Active |
| `/shared_components/css/quote-builder-unified-step1.css` | Step 1 styles | Quote builders | ✅ Active |
| `/shared_components/css/dtg-quote-builder.css` | DTG specific | DTG quote builder | ✅ Active |
| `/shared_components/css/quote-builder-step2-modern.css` | **NEW** Modern Step 2 styles (2025 refactor) | Embroidery & Cap quote builders | ✅ Active |
| `/shared_components/css/quote-share-modal.css` | **NEW** Shareable URL modal styles (2026 consolidation) | All quote builders | ✅ Active |

### 🧮 Manual Calculator CSS Architecture

**Shared Foundation:** `/calculators/manual-calculator-styles.css` (655 lines)
- Provides: Headers, breadcrumbs, forms, buttons, alerts, pricing displays, responsive design, print styles
- Color Theme: NWCA Green (#4cb354)
- Used by: DTG, DTF, Embroidery, Laser manual calculators

**⚠️ IMPORTANT:** These calculators were built independently over time. Each works correctly but uses different CSS approaches. **Leave as-is unless broken.**

| Calculator | CSS Pattern | External Files | Inline CSS | Notes |
|------------|-------------|----------------|------------|-------|
| **DTG Manual** | ✅ Standard | 1 (shared) | ~100 lines | Product showcase, hero section |
| **DTF Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, DTF features |
| **Embroidery Manual** | ✅ Standard | 1 (shared) | ~200 lines | Product showcase, stitch displays |
| **Laser Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, laser features |
| **Screen Print Manual** | 🔶 Complex | **16 files** | ~200 lines | Copied from contract page, never refactored. Uses universal-pricing-* files + manual-calculator-styles.css. **Looks great, leave it alone.** |
| **Cap Embroidery Manual** | 🔶 Standalone | 1 (cap-fix) | ~550 lines | Built independently, doesn't use shared CSS. **Works fine as-is.** |
| **Sticker Pricing** | ✅ Clean Table | 0 | ~400 lines | **Simple pricing table page - NO calculator.** Replaced complex calculator with clean, easy-to-read tables for 4 standard sizes (2"×2", 3"×3", 4"×4", 5"×5"). Mobile-responsive, NWCA green theme. |

#### CSS Files Detail

**Screen Print Manual (16 files):**
```
manual-calculator-styles.css (shared)
universal-pricing-header.css
universal-pricing-layout.css
universal-calculator-theme.css
universal-pricing-components.css
shared-pricing-styles.css
modern-enhancements.css
universal-header.css
universal-image-gallery.css
universal-quick-quote.css
universal-pricing-grid.css
image-modal.css
force-green-theme.css
screenprint-pricing-tables.css
screenprint-safety-stripes.css
screenprint-toggle-styles.css
```

**Cap Embroidery Manual:**
```
cap-embroidery-fix.css
+ 550 lines of inline CSS
```

**Sticker Manual:**
```
686 lines of inline CSS (complete framework)
```

#### Guidance for NEW Manual Calculators

**Standard Pattern (Recommended):**
```html
<link href="manual-calculator-styles.css" rel="stylesheet">

<style>
    /* ONLY calculator-specific features */
    /* Product showcase, unique animations, method-specific UI */
    /* Keep under 200 lines */
</style>
```

**What Goes Where:**
- **Shared CSS:** Headers, breadcrumbs, forms, buttons, pricing displays
- **Inline CSS:** Product showcases, unique features, method-specific animations

**DO NOT:** Try to "fix" existing calculators unless there's a bug. They work.

## 📚 Documentation & Guides

### Memory/Reference Documentation
| File | Purpose | Status |
|------|---------|--------|
| `/memory/QUOTE_BUILDER_GUIDE.md` | Complete guide for creating new quote builders | ✅ Active |
| `/memory/SCREENPRINT_QUOTE_BUILDER.md` | Screen Print Quote Builder 2026 documentation | ✅ Active |
| `/memory/EMBROIDERY_PRICING_RULES.md` | Complete embroidery pricing formulas (FB, AL, caps, tiers) | ✅ Active |
| `/memory/EMBROIDERY_PRICING_PHILOSOPHY.md` | **NEW** Three-tier philosophy, loopholes, financial impact (2026-02-05) | ✅ Active |
| `/memory/training/EMBROIDERY_PRICING_SALES_TRAINING.md` | **NEW** Sales rep training slides for Taneisha & Ruthie (2026-02-05) | ✅ Active |
| `/memory/EMBROIDERY_ITEM_TYPES.md` | Canonical ItemType reference for Embroidery_Costs table | ✅ Active |
| `/memory/DECG_PRICING_2026.md` | **NEW** Customer Supplied Embroidery (DECG) pricing reference | ✅ Active |
| `/memory/CASPIO_API_TEMPLATE.md` | API documentation (55 endpoints) | ✅ Active |
| `/memory/STAFF_DIRECTORY.md` | Staff contacts for dropdowns | ✅ Active |
| `/memory/DATABASE_PATTERNS.md` | Database schema reference | ✅ Active |
| `/memory/CRM_DASHBOARD_AUTH.md` | CRM dashboard role-based auth (sessions + API proxy) | ✅ Active |

## 📂 Dashboard & Admin

### Staff Dashboards
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/staff-dashboard.html` | Main staff dashboard (legacy) | Multiple inline | ⚠️ Legacy |
| `/dashboards/staff-dashboard-v2.html` | **NEW** Redesigned dashboard with 4-zone layout | staff-dashboard-*.js/css | ✅ Active |
| `/dashboards/ae-dashboard.html` | AE dashboard | Multiple | ✅ Active |
| `/dashboards/art-hub-dashboard.html` | Art hub | Multiple | ✅ Active |
| `/dashboards/art-invoices-dashboard.html` | Art invoices | art-invoice-* files | ✅ Active |
| `/dashboards/commission-structure.html` | Online store commission structure reference | commission-structure.css | ✅ Active |
| `/dashboards/css/commission-structure.css` | Commission dashboard styles | - | ✅ Active |
| `/dashboards/taneisha-crm.html` | Taneisha's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/nika-crm.html` | **NEW** Nika's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/css/rep-crm.css` | **SHARED** CRM dashboard styles (used by both reps) | - | ✅ Active |
| `/dashboards/js/rep-crm.js` | **SHARED** CRM service/controller (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/js/rep-calendar.js` | **SHARED** Calendar logic (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/house-accounts.html` | **NEW** House Account assignment dashboard | house-accounts.js, house-accounts.css | ✅ Active |
| `/dashboards/css/house-accounts.css` | **NEW** House Accounts dashboard styles | - | ✅ Active |
| `/dashboards/js/house-accounts.js` | **NEW** House Accounts service/controller | APP_CONFIG | ✅ Active |
| `/dashboards/monogram-dashboard.html` | Monogram orders dashboard | monogram-dashboard.css, monogram-dashboard.js | ✅ Active |
| `/dashboards/css/monogram-dashboard.css` | Monogram dashboard styles (NWCA green theme) | CSS variables | ✅ Active |
| `/dashboards/staff-login.html` | Staff authentication login page | — | ✅ Active |
| `/dashboards/staff-portal-simple.html` | Simplified staff portal | — | ✅ Active |
| `/dashboards/staff-portal-final.html` | Final staff portal layout | — | ✅ Active |
| `/dashboards/quote-management.html` | Quote management dashboard (search, edit, manage quotes) | quote-management.css | ✅ Active |
| `/dashboards/css/quote-management.css` | Quote management dashboard styles | — | ✅ Active |
| `/dashboards/digitized-designs.html` | Digitized designs management dashboard | — | ✅ Active |
| `/dashboards/old-designs.html` | Old designs archive search (Caspio embed) | old-designs.css, old-designs.js | ✅ Active |
| `/dashboards/art-invoice-view.html` | Art invoice detail view page | — | ✅ Active |
| `/dashboards/bundle-orders-dashboard.html` | Bundle orders management dashboard | bundle-orders.js | ✅ Active |
| `/dashboards/bundle-orders.js` | Bundle orders dashboard logic | — | ✅ Active |
| `/dashboards/art-hub-coordinator.html` | Art hub — coordinator view | — | ✅ Active |
| `/dashboards/art-hub-ruth.html` | Art hub — Ruth's personalized view | — | ✅ Active |
| `/dashboards/art-hub-steve.html` | Art hub — Steve's personalized view | art-hub.css, art-hub-steve.js | ✅ Active |
| `/shared_components/css/art-hub.css` | **NEW** Shared art hub dashboard styles (CSS custom props for theming) | — | ✅ Active |
| `/shared_components/js/art-actions-shared.js` | **NEW** Shared art action modals (Log Time, Mark Complete, Send Mockup) — used by art-hub-steve.js + art-request-detail.js | art-hub.css, caspio-proxy API, EmailJS | ✅ Active |
| `/shared_components/js/art-hub-steve.js` | Steve's gallery card processing + notes panel — delegates modals to art-actions-shared.js | art-hub.css, art-actions-shared.js, caspio-proxy API | ✅ Active |
| `/shared_components/css/ae-submit-form.css` | **NEW** AE submit art form styles (extracted from Caspio PageHeader) | ae-dashboard.html | ✅ Active |
| `/shared_components/js/ae-submit-form.js` | **NEW** AE submit form JS: swatches, model images, row numbers, submission notification | ae-dashboard.html | ✅ Active |
| `/shared_components/js/ae-dashboard.js` | **NEW** AE dashboard: tab switching, modals, dropdown, notification polling + toasts | ae-dashboard.html | ✅ Active |
| `/dashboards/css/taneisha-crm.css` | ⚠️ DEPRECATED - use rep-crm.css | - | ⚠️ Legacy |
| `/dashboards/js/taneisha-crm.js` | ⚠️ DEPRECATED - use rep-crm.js | - | ⚠️ Legacy |

### Staff Dashboard V2 Files (2025-12-31 Redesign)
| File | Purpose | Status |
|------|---------|--------|
| `/shared_components/css/staff-dashboard-layout.css` | 4-zone grid layout, responsive | ✅ Active |
| `/shared_components/css/staff-dashboard-widgets.css` | Metrics cards, team performance, skeletons | ✅ Active |
| `/shared_components/css/staff-dashboard-dark.css` | **NEW** Dark mode theme (matches House Accounts) | ✅ Active |
| `/shared_components/js/staff-dashboard-service.js` | ShopWorks ManageOrders API integration | ✅ Active |
| `/shared_components/js/staff-dashboard-announcements.js` | Priority announcements with dismiss | ✅ Active |
| `/shared_components/js/staff-dashboard-init.js` | Initialization, widget toggles, auto-refresh | ✅ Active |
| `/shared_components/js/production-schedule-stats.js` | Precomputed turnaround stats from 819 records | ✅ Active |
| `/shared_components/js/production-schedule-predictor.js` | Prediction engine for turnaround times | ✅ Active |

### Dashboard Reports
| File | Purpose | Status |
|------|---------|--------|
| `/dashboards/reports/price-audit-report.html` | **NEW** Price audit report — SW 2025 vs 2026 pricing comparison for rep training (2026-02-15) | ✅ Active |
| `/dashboards/reports/price-audit-report.css` | **NEW** Styles for price audit report page (2026-02-15) | ✅ Active |

### Employee Bundle Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/DrainPro-Bundle.html` | Drain-Pro employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/streich-bros-bundle.html` | Streich Bros employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/wcttr-bundle.html` | WCTTR (West Coast Truck and Trailer Repair) employee bundle labels | Caspio datapage | ✅ Active |

## 🗑️ Recently Removed (For Reference)

### CRM Role-Based Access Control (2026-01-23)
**Context:** Replaced shared password login with Caspio-based role permissions
- `/pages/crm-login.html` (255 lines) → Deleted (replaced by Caspio auth)
- CRM dashboards now use role-based access via Express session
- **Erik:** Full access (taneisha, nika, house)
- **Taneisha:** Own dashboard only
- **Nika:** Own dashboard only

### Richardson Simplification (2026-01-02)
**Context:** Richardson quote builder simplified to real-time pricing lookup (81% code reduction)
- `richardson-caps-calculator.js` (2,659 lines) → Replaced by `richardson-factory-direct.js` (450 lines)
- `richardson-quote-service.js` (262 lines) → Quote building removed
- `richardson-112-images.js` → 112 is SanMar product, not Factory Direct
- `richardson-color-selector-enhancement.js` → Color picker not needed
- `richardson-color-selector.css` → Color picker styles removed

### Memory System Cleanup (2026-01-08)
**Context:** Cleaned up /memory/ docs to reduce Claude Code context bloat
- `/memory/3-day-tees/DAY-5-MORNING-SUMMARY.md` (413 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-5-AFTERNOON-SUMMARY.md` (498 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-6-MORNING-SUMMARY.md` (357 lines) → Deleted (outdated dev log)
- `/memory/PRICING_MANUAL_CORE.md` (294 lines) → Deleted (duplicated MANUAL_CALCULATOR_CONCEPTS.md)
- `/memory/INDEX.md` (525 lines → 130 lines) → Trimmed by 75%
- **Total savings:** ~1,957 lines of duplicate/stale content

### Removed During Cleanup (2025-01-27)
- **71 JavaScript files** - Orphaned, unused, or duplicate
- **6 HTML backup files** - Replaced by Git version control
- **Archive folder** - 3.8MB moved to external backup
- **Test files in root** - Moved to `/tests/` folder

### Additional Cleanup (2025-01-27 - Second Pass)
- **8 data/test files from root** - CSV test results, log files
- **5 training folder files** - .bak file, test files, duplicates
- **11 orphaned JS files** - Unused adapters and utilities in shared_components/js/

### Root Directory Organization (2025-01-27 - Third Pass)
**Moved from root to organized folders:**
- **6 data export files** → `/docs/data-exports/` (CSV, JSON, XML exports)
- **2 template files** → `/docs/templates/` (EmailJS and instructions)
- **4 guide documents** → `/docs/guides/` (API, CSS, system docs)
- **4 log/generated files** → `/logs/` (server.log, dependency maps)
- **1 script file** → `/scripts/` (migrate-beta.sh)
- **Total:** 17 files moved from root, reducing clutter by ~25%

### Files Scheduled for Removal
| File | Reason | Remove By | Status |
|------|--------|-----------|--------|
| None currently | - | - | - |

## 📊 Statistics

### File Count by Type
- **HTML Files:** ~120
- **JavaScript Files:** ~130
- **CSS Files:** ~65
- **Active Calculators:** 20 (includes contract, customer-facing, forms)
- **Active Quote Builders:** 5 (DTG, DTF, Embroidery, Screen Print, Monogram)
- **Active Dashboards:** 20 (includes staff portals, CRM, art hub variants, bundle orders, quote management)

### Organization Health
- **Files in correct folders:** 100%
- **No inline code:** Target achieved
- **No duplicate files:** Target achieved
- **No test files in root:** Target achieved

## ⚠️ Files Requiring Attention

### Need Refactoring
| File | Issue | Priority |
|------|-------|----------|
| Various HTML files | Still have inline scripts (113 files) | Medium |
| Multiple JS files | Hardcoded API URLs (149 instances) | High |

## 📁 Additional Directories

### Support & Documentation
| Directory | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| `/admin/` | Administrative tools and utilities | ✅ Active | Backend administration |
| `/art-tools/` | Art department tools | ✅ Active | Design utilities |
| `/caspio-tables/` | Caspio database configurations | ✅ Active | Database schemas |
| `/email-templates/` | EmailJS templates | ✅ Active | Quote email templates |
| `/logs/` | Log and generated files | 🚫 Ignored | Not in version control |
| `/memory/` | Claude AI memory files | ✅ Active | API specs only |
| `/mockups/` | Design mockups | ✅ Active | UI/UX references |
| `/node_modules/` | NPM dependencies | 🔧 Generated | Do not modify |
| `/policies/` | Business policies | ✅ Active | Company procedures |
| `/product/` | Product pages | ✅ Active | Product display system |
| `/scripts/` | Utility scripts | ✅ Active | Contains safety-tools/ |
| `/src/` | Server source code | ✅ Active | Node.js backend |
| `/templates/` | HTML templates | ✅ Active | Reusable components |
| `/tests/` | **Automated Testing Suite** | ✅ Active | **Screen print calculator validation** |
| `/tools/` | Development tools | ✅ Active | Build and dev utilities |
| `/training/` | Training materials | ✅ Active | Staff training docs |
| `/vendor-portals/` | Vendor integrations | ✅ Active | External vendor access |

## 🧪 Automated Testing System

**Created:** 2025-10-03
**Purpose:** Comprehensive automated testing for all screen print calculators

### Test Suite Files
| File | Purpose | Status |
|------|---------|--------|
| `/tests/screenprint-calculator-test-suite.js` | Core testing framework | ✅ Active |
| `/tests/screenprint-test-cases.js` | 17 comprehensive test cases | ✅ Active |
| `/tests/screenprint-test-runner.html` | Visual test interface | ✅ Active |
| `/tests/README-TESTING.md` | Testing documentation | ✅ Active |

### Features
- ✅ Automated pricing validation across all calculators
- ✅ Safety stripes functionality testing
- ✅ Dark garment toggle verification
- ✅ Cross-calculator consistency checks
- ✅ Auto-fix suggestions for detected issues
- ✅ Visual test results with export options
- ✅ 17 test cases covering all scenarios

### Test Categories
1. **Basic Pricing** (3 tests) - Fundamental pricing calculations
2. **Safety Stripes** (4 tests) - $2.00 surcharge validation
3. **Dark Garment** (2 tests) - Underbase color addition
4. **LTM Fee** (2 tests) - Minimum order fee logic
5. **Additional Locations** (2 tests) - Multi-location pricing
6. **Color Count** (2 tests) - 1-6 color validation
7. **Complex Scenarios** (2 tests) - Combined features testing

### Embroidery CSV Validator (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/embroidery-csv-validator.html` | Drag-and-drop ShopWorks CSV validation tool (size suffix, qty math, fee checks) | ✅ Active |

**Usage:** Open in browser, drag CSV export → instant validation report with pass/warn/fail per row

### Order Validation Tests (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/validation/validate-2025-orders.js` | Validate 2025 embroidery orders against pricing system | ✅ Active |
| `/tests/validation/known-vendors.js` | Non-SanMar vendor identification patterns (Carhartt infant, Rabbit Skins added 2026-02-01) | ✅ Active |
| `/tests/validation/2025-orders-validation-report.json` | Generated validation report (not in git) | 📊 Output |
| `/tests/validation/2025-oddballs-recommendations.csv` | **NEW** CSV export of 110 oddball items with recommendations | 📊 Output |

**Run:** `node tests/validation/validate-2025-orders.js`

**Purpose:** Analyzes 6,222 embroidery line items from 2025 to determine:
- Which orders can be priced via the quote builder (service codes + SanMar products)
- Which need manual lookup (non-SanMar vendors)
- Which are oddballs (typos, free-text, comments)

| `/tests/validation/validate-csv-output-paths.js` | Full simulation: 3-CSV join, live API pricing, all 4 output path validation | ✅ Active |
| `/tests/validation/csv-output-paths-report.json` | Generated full simulation report (not in git) | 📊 Output |

**Run:** `node tests/validation/validate-csv-output-paths.js` (~3 min, 1134 API calls)

**Purpose:** Joins 3 CSV data sources (line items, ODBC orders, stitch counts), reconstructs 1,261 embroidery orders, calls live pricing API, validates all 4 output paths (UI, PDF, Save, Clipboard). Compares computed pricing vs ShopWorks actuals.

### Data Seeding Scripts (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/scripts/seed-classified-items.js` | Seed service codes & non-SanMar products to Caspio | ✅ Active |
| `/tests/scripts/cleanup-duplicate-products.js` | Remove duplicate non-SanMar products | ✅ Active |
| `/tests/scripts/cleanup-duplicate-service-codes.js` | Remove duplicate service codes | ✅ Active |
| `/tests/scripts/update-embroidery-costs.js` | **NEW** Update AL/CB/CS/FB records in Embroidery_Costs | ✅ Active |
| `/tests/scripts/add-cemb-service-codes.js` | **NEW** Add CEMB/CEMB-CAP service codes | ✅ Active |
| `/tests/scripts/cleanup-embroidery-costs.js` | **NEW** Delete duplicates, add missing DECG-FB 1-7 (2026-02-04) | ✅ Active |
| `/tests/scripts/update-ctr-pricing-linear.js` | **NEW** Update CTR pricing with linear $/1K model (2026-02-04) | ✅ Active |
| `/tests/scripts/sync-shopworks-service-codes.js` | **NEW** Sync all 28 ShopWorks service codes to Caspio (2026-02-14) | ✅ Active |
| `/tests/scripts/batch-price-audit-report.js` | **NEW** Batch service pricing audit — compares SW vs 2026 prices across all fixtures. `--html` generates dashboard report (2026-02-15) | ✅ Active |

**Run:** `node tests/scripts/seed-classified-items.js`

**Seeded Data (Feb 2026):**
- **8 service codes:** CDP, SPSU, Transfer, SPRESET, Shipping, Freight, Name/Number, emblem
- **26 non-SanMar products:** Richardson caps (6), Callaway polos (2), Cutter & Buck (3), Hi-Vis safety (4), Polar Camel drinkware (4), Specialty items (5), Other (2)

**Embroidery Pricing Consolidation (Feb 2026):**
- **`update-embroidery-costs.js`:** Adds AL (5 tiers), AL-CAP (5 tiers), CB (5 tiers), CS (5 tiers), FB (1 record) = 21 records
- **`add-cemb-service-codes.js`:** Adds CEMB (5 tiers), CEMB-CAP (5 tiers) = 10 service codes
- **`update-ctr-pricing-linear.js`:** Updates CTR-Garmt, CTR-Cap, CTR-FB with linear $/1K pricing (Feb 2026)

## 🔄 Update Protocol

### When to Update This File
1. **After creating** any new file
2. **After deleting** any file
3. **After moving** files to different folders
4. **Weekly** review for orphaned files

### How to Update
1. Add new files to appropriate section
2. Mark deprecated files with removal date
3. Update statistics section
4. Update last modified date at top

### Validation Commands
```bash
# Find files not listed in ACTIVE_FILES.md
find . -type f -name "*.js" -o -name "*.html" | grep -v node_modules | while read file; do
  grep -q "$file" ACTIVE_FILES.md || echo "Not documented: $file"
done

# Find files listed but not existing
grep -o '`[^`]*`' ACTIVE_FILES.md | tr -d '`' | while read file; do
  [ -f ".$file" ] || echo "File missing: $file"
done
```

---

**Maintenance Note:** This file is critical for preventing code chaos. Keep it updated!

*Generated after comprehensive cleanup that removed 71+ orphaned files*