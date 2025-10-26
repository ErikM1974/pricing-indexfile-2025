# ShopWorks EDP Integration - Core Guide

**Last Updated:** 2025-10-26
**Purpose:** Master navigation and overview for ShopWorks OnSite 7 EDP integration
**Status:** Production-ready for Screen Print Quote Builder

---

## 📋 Quick Navigation

### Block Documentation (Detailed Field Specifications)
- **[Order Block](edp/ORDER_BLOCK.md)** - 44 fields in 6 SubBlocks
- **[Customer Block](edp/CUSTOMER_BLOCK.md)** - 44 fields in 6 SubBlocks
- **[Contact Block](edp/CONTACT_BLOCK.md)** - 10 fields (simplest block)
- **[Design Block](edp/DESIGN_BLOCK.md)** - 11 fields in 3 SubBlocks (HIGH VALUE)
- **[Product Block](edp/PRODUCT_BLOCK.md)** - 41 fields in 5 SubBlocks (**CRITICAL** - includes CATALOG_COLOR)
- **[Payment Block](edp/PAYMENT_BLOCK.md)** - 8 fields (FUTURE: Stripe integration)

### Implementation Guides
- **[Pricing Synchronization Guide](edp/PRICING_SYNC_GUIDE.md)** - SizesPricing pattern, three-system sync

---

## 🎯 Overview

### What is ShopWorks EDP?

**EDP (Electronic Data Processing)** is ShopWorks' text-based format for importing quotes and orders into their OnSite 7 production management system.

**Current Implementation:** Screen Print Quote Builder → ShopWorks OnSite 7
**Future Implementation:** DTG, Embroidery, Cap quote builders

### Why EDP Integration Matters

**Problem Without EDP:**
1. Sales rep generates quote in browser calculator
2. **Manual re-entry** into ShopWorks (prone to errors)
3. Pricing discrepancies between quote and production
4. Lost time and potential errors

**Solution With EDP:**
1. Sales rep generates quote in browser calculator
2. **One-click EDP export** (text file)
3. Import directly into ShopWorks
4. Pricing, products, sizes all match exactly ✅

### Three-System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Quote Builder                            │
│  (Browser-based calculator - what customer sees)            │
│                                                             │
│  Calculates pricing → Displays Order Summary               │
│  ↓                                                          │
│  Generates SizesPricing object (source of truth)           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                 ↓
┌───────────────────┐           ┌────────────────────┐
│ ShopWorks Guide   │           │    EDP Import      │
│ (PDF for manual   │           │ (Electronic data   │
│  entry)           │           │  import)           │
│                   │           │                    │
│ Uses SizesPricing │           │ Uses SizesPricing  │
│ for line items    │           │ for unit prices    │
└───────────────────┘           └────────────────────┘
```

**Key Insight:** All three systems pull from the SAME pricing data structure (`SizesPricing`), ensuring synchronization.

---

## 🏗️ EDP Block Architecture

### OnSite 7 Structure

ShopWorks OnSite 7 organizes EDP data into **6 blocks**:

| Block | Fields | SubBlocks | Status | Priority |
|-------|--------|-----------|--------|----------|
| **Order** | 44 | 6 | ✅ Partially implemented | High |
| **Customer** | 44 | 6 | ✅ Partially implemented | High |
| **Contact** | 10 | None | 📝 Documented | Medium |
| **Design** | 11 | 3 | 📝 Documented | High Value |
| **Product** | 41 | 5 | ✅ **FULLY IMPLEMENTED** | **CRITICAL** |
| **Payment** | 8 | None | 📝 Documented | Future |

**Total:** 158 fields available across all blocks

**Currently Using:** ~32 fields (20% of available fields)

**Implementation Status:**
- ✅ Screen Print Quote Builder: Product Block (complete), Order Block (partial), Customer Block (partial)
- ⏳ DTG Quote Builder: Ready to implement (same field structure)
- ⏳ Embroidery Quote Builder: Ready to implement (same field structure)
- ⏳ Cap Quote Builder: Ready to implement (same field structure)

### SubBlock Architecture

OnSite 7 uses **SubBlocks** to organize related fields within each block:

**Example: Product Block SubBlocks**
1. **Product SubBlock** (6 fields) - Core product info and pricing
2. **Size Distribution SubBlock** (6 fields) - Quantity by size
3. **Sales Tax Override SubBlock** (8 fields) - Tax calculations
4. **Secondary Units SubBlock** (10 fields) - Alternate measurements
5. **Behavior SubBlock** (11 fields) - Product sourcing flags

**Why SubBlocks Matter:** They provide logical grouping and ensure fields are processed in the correct order during import.

---

## 🚨 Critical Concepts

### 1. CATALOG_COLOR (Most Critical Field)

**Location:** [Product Block](edp/PRODUCT_BLOCK.md#catalog-color)

**The Problem:**
```javascript
// ❌ WRONG - Using display color
PartColor>> Forest Green         // Display name from vendor
```

**What happens:**
- ✅ Quote imports successfully (no error)
- ❌ ShopWorks shows "Product not found in catalog"
- ❌ Pricing doesn't sync from ShopWorks pricing tables
- ❌ Inventory doesn't decrement properly

**The Solution:**
```javascript
// ✅ CORRECT - Using exact ShopWorks catalog name
PartColor>> Forest                // Exact match to ShopWorks catalog
```

**Implementation:** See complete [CATALOG_COLOR documentation](edp/PRODUCT_BLOCK.md#catalog-color)

---

### 2. SizesPricing Pattern (Pricing Synchronization)

**Location:** [Pricing Synchronization Guide](edp/PRICING_SYNC_GUIDE.md)

**The Challenge:** Ensure pricing matches EXACTLY across three systems:
1. Quote Builder Order Summary
2. ShopWorks Guide PDF
3. EDP Import

**The Solution:** `SizesPricing` object as single source of truth:

```javascript
const sizesPricing = {
    'S': 35.39,    // Complete final price for Small
    'M': 35.39,    // Complete final price for Medium
    'L': 35.39,    // Complete final price for Large
    'XL': 35.39,   // Complete final price for XL
    '2XL': 37.39,  // Complete final price for 2XL ($2 upcharge)
    '3XL': 38.39   // Complete final price for 3XL ($3 upcharge)
};
```

**Each price includes:**
- Base garment cost with margin
- Primary decoration cost
- Additional locations cost
- Safety stripes (if applicable)
- LTM fee impact (if quantity < 24)

**Why It Matters:** Prevents discrepancies between Order Summary ($35.39) and ShopWorks import ($35.83).

**Implementation:** See complete [SizesPricing guide](edp/PRICING_SYNC_GUIDE.md)

---

### 3. OnSite 6.1 → OnSite 7 Migration

**Key Changes:**
- Field names changed (e.g., `# Design` → `id_Design`)
- New fields added (e.g., `FlashesTotal`, `Department`)
- Some fields deprecated (e.g., `Secondary_Phone`)

**All block documentation includes field mapping tables** showing:
- OnSite 7 field name (current)
- OnSite 6.1 field name (legacy)
- Migration notes

**Example from Design Block:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `FlashesTotal` | *(NEW in OnSite 7)* | Track underbase flashes |
| `ColorsTotal` | `N` | Renamed but same function |

---

## 🔧 Implementation Patterns

### Complete EDP Structure

```
---- Start Order ----
[Order Block fields]
---- End Order ----

---- Start Customer ----
[Customer Block fields]
---- End Customer ----

---- Start Contact ----
[Contact Block fields]
---- End Contact ----

---- Start Design ----
[Design Block fields]
---- End Design ----

---- Start Product ----
[Product Block fields]
---- End Product ----

---- Start Payment ----
[Payment Block fields]
---- End Payment ----
```

### Minimal Working Implementation

**Currently implemented in Screen Print Quote Builder:**

```javascript
// Order Block (12 fields)
---- Start Order ----
ExtOrderID>> SP0127-1
ExtSource>> SP Quote
id_OrderType>> 13
CustomerPurchaseOrder>> Screen Print - SP0127-1
// ... 8 more fields
---- End Order ----

// Customer Block (1 field)
---- Start Customer ----
id_Customer>> 123
---- End Customer ----

// Product Block (19 fields per product) - COMPLETE
---- Start Product ----
PartNumber>> PC54
PartColor>> Forest
cur_UnitPriceUserEntered>> 35.39
Size01_Req>> 3
Size02_Req>> 12
// ... 14 more fields
---- End Product ----
```

**Result:** Successfully imports into ShopWorks OnSite 7 ✅

---

## 📊 Field Count Summary

### Current Implementation vs Available

| Block | Implemented | Available | Percentage | Priority Next |
|-------|-------------|-----------|------------|---------------|
| Order | 12 | 44 | 27% | Shipping address (11 fields) |
| Customer | 1 | 44 | 2% | Customer details (6 fields) |
| Contact | 0 | 10 | 0% | Basic contact info (5 fields) |
| Design | 0 | 11 | 0% | **HIGH VALUE** - Design specs |
| **Product** | **19** | **41** | **46%** | **Size overrides (optional)** |
| Payment | 0 | 8 | 0% | **FUTURE** - Stripe integration |
| **Total** | **32** | **158** | **20%** | |

### Implementation Priority Guide

**Phase 1: Essential (Current)**
- ✅ Order Block: Basic order identification
- ✅ Customer Block: Customer ID linking
- ✅ Product Block: **Complete implementation** ✅

**Phase 2: High Value (Next)**
- Design Block: Track artwork specs (colors, flashes, stitches)
- Contact Block: Contact person information
- Order Block: Complete shipping address

**Phase 3: Enhancement (Later)**
- Customer Block: Full customer details
- Order Block: Sales tax overrides
- Product Block: Size-specific overrides

**Phase 4: Future (Planned)**
- Payment Block: Stripe payment integration
- Order Block: Advanced tax calculations

---

## 🎯 Quick Start Guide

### For New Quote Builder Implementation

1. **Read Core Concepts:**
   - [CATALOG_COLOR documentation](edp/PRODUCT_BLOCK.md#catalog-color)
   - [SizesPricing pattern](edp/PRICING_SYNC_GUIDE.md)

2. **Implement Product Block:**
   - See [Product Block complete guide](edp/PRODUCT_BLOCK.md)
   - This is the MOST CRITICAL block (pricing, products, sizes)

3. **Add Order & Customer Blocks:**
   - See [Order Block](edp/ORDER_BLOCK.md) for order identification
   - See [Customer Block](edp/CUSTOMER_BLOCK.md) for customer linking

4. **Test Import:**
   - Generate EDP text from quote
   - Import into ShopWorks OnSite 7
   - Verify pricing matches exactly

5. **Enhance Gradually:**
   - Add Design Block for artwork tracking
   - Add Contact Block for contact info
   - Add remaining Order Block fields as needed

### For Debugging Pricing Discrepancies

1. **Check Order Summary:**
   - Verify all cost components are included
   - Check LTM fee calculation

2. **Check SizesPricing Object:**
   ```javascript
   console.log(product.SizesPricing);
   // Should show: {S: 35.39, M: 35.39, L: 35.39, XL: 35.39, '2XL': 37.39}
   ```

3. **Check Console Logs:**
   - Look for: `[ShopWorksGuide] Using standard size price from S: $35.39` ✅
   - Avoid: `[ShopWorksGuide] Using final price` ❌

4. **Compare All Three Systems:**
   - Order Summary total
   - ShopWorks Guide subtotal (within $0.20)
   - EDP import verification

**Full debugging guide:** See [Pricing Sync Guide](edp/PRICING_SYNC_GUIDE.md#testing-debugging)

---

## 📚 Complete Block Documentation

### Block-Specific Guides

Each block has detailed documentation with:
- Complete field specifications
- SubBlock architecture
- OnSite 6.1 → OnSite 7 field mapping
- Implementation examples
- Use cases by quote builder type

**Click any block below for complete documentation:**

1. **[Order Block (ORDER_BLOCK.md)](edp/ORDER_BLOCK.md)**
   - 44 fields organized into 6 SubBlocks
   - Order identification, dates, shipping, notes
   - Shared across ALL quote builders
   - Status: Partially implemented (12 of 44 fields)

2. **[Customer Block (CUSTOMER_BLOCK.md)](edp/CUSTOMER_BLOCK.md)**
   - 44 fields organized into 6 SubBlocks
   - Company details, address, tax settings
   - Links to ShopWorks customer database
   - Status: Partially implemented (1 of 44 fields)

3. **[Contact Block (CONTACT_BLOCK.md)](edp/CONTACT_BLOCK.md)**
   - 10 fields (no SubBlocks)
   - Contact person information
   - NEW Department field in OnSite 7
   - Status: Documented, ready for implementation

4. **[Design Block (DESIGN_BLOCK.md)](edp/DESIGN_BLOCK.md)**
   - 11 fields organized into 3 SubBlocks
   - Artwork specifications (colors, flashes, stitches)
   - **HIGH VALUE** for production workflow
   - Status: Documented, ready for implementation

5. **[Product Block (PRODUCT_BLOCK.md)](edp/PRODUCT_BLOCK.md)** ⭐ **MOST CRITICAL**
   - 41 fields organized into 5 SubBlocks
   - Product details, pricing, sizes
   - **Includes critical CATALOG_COLOR documentation**
   - Status: ✅ FULLY IMPLEMENTED (19 essential fields)

6. **[Payment Block (PAYMENT_BLOCK.md)](edp/PAYMENT_BLOCK.md)**
   - 8 fields (no SubBlocks)
   - Payment tracking (FUTURE: Stripe integration)
   - Security best practices documented
   - Status: Documented for future implementation

### Implementation Guides

**[Pricing Synchronization Guide (PRICING_SYNC_GUIDE.md)](edp/PRICING_SYNC_GUIDE.md)**
- SizesPricing pattern (source of truth)
- Three-system synchronization
- Problems solved (additional locations, weighted average)
- Testing and debugging procedures
- Implementation for all quote builder types

---

## 🔍 Key Features by Quote Builder Type

### Shared Across ALL Builders

**Order Block:**
- ExtOrderID format: `[PREFIX][MMDD]-sequence`
- Order type IDs (13=Screen Print, 15=DTG, 17=Embroidery, 18=Cap)
- All address and date fields

**Customer Block:**
- Customer ID linking
- Company and address information
- Tax settings

**Contact Block:**
- Contact person details
- Department (NEW in OnSite 7)

**Product Block:**
- CATALOG_COLOR requirement
- Size distribution (6 standard sizes)
- Unit pricing

### Method-Specific Differences

**Screen Print:**
- Design Block: Color count, flash tracking
- Multiple print locations (Front, Back, Sleeves)
- Safety stripes cost component

**DTG (Direct-to-Garment):**
- Design Block: Location specifications
- Combo locations (LC_FB, FF_FB)
- No setup fees (per piece pricing)

**Embroidery:**
- Design Block: Stitch count tracking
- Thread color specifications
- Stitch-based pricing tiers

**Cap Embroidery:**
- Design Block: Logo placement
- One size or structured/unstructured variants
- 3D puff embroidery option

---

## 🛠️ Technical Implementation

### File Structure

```
/quote-builders/
  screenprint-quote-builder.html          # Quote builder with EDP generation
  dtg-quote-builder.html                  # Ready for EDP implementation
  embroidery-quote-builder.html           # Ready for EDP implementation
  cap-embroidery-quote-builder.html       # Ready for EDP implementation

/shared_components/js/
  shopworks-guide-generator.js            # Generates ShopWorks Guide PDF
  shopworks-edp-generator.js              # Generates EDP text
  screenprint-shopworks-guide-generator.js # Screen print specific guide
```

### Generator Architecture

**ShopWorks Guide Generator:**
- Parses products into line items
- Separates standard sizes vs oversized
- Uses SizesPricing for accurate pricing
- Generates PDF guide for manual entry

**EDP Generator:**
- Converts line items to EDP text format
- Applies block structure with delimiters
- Uses CATALOG_COLOR for product matching
- Outputs importable .txt file

### Key Methods

```javascript
// From shopworks-guide-generator.js
getStandardSizePrice(sizeBreakdown, product)  // Extract standard size price
getPriceForSize(size, product)                // Get size-specific price
calculateLineTotal(sizes, price, product)     // Sum individual (qty × price)

// From shopworks-edp-generator.js
generateOrderBlock(quoteData)                 // Create Order Block text
generateCustomerBlock(quoteData)              // Create Customer Block text
generateProductBlock(item, lineNumber)        // Create Product Block text
```

---

## 📝 Next Steps

### Immediate (High Priority)

1. **Implement Design Block** - HIGH VALUE for production workflow
   - Track color specifications
   - Flash/underbase requirements
   - Stitch counts for embroidery
   - See [Design Block guide](edp/DESIGN_BLOCK.md)

2. **Complete Contact Block** - Medium priority
   - Add contact person information
   - Department field (new in OnSite 7)
   - See [Contact Block guide](edp/CONTACT_BLOCK.md)

3. **Expand Order Block** - Complete shipping address
   - Add 11 shipping address fields
   - Enhance with date fields
   - See [Order Block guide](edp/ORDER_BLOCK.md)

### Future Enhancements

1. **Complete Customer Block** - Full customer details
   - Address information
   - Tax settings
   - Price tier assignments

2. **Payment Block** - Stripe integration
   - Online payment processing
   - Automatic payment tracking
   - PCI-compliant security

3. **Extend to Other Quote Builders**
   - DTG Quote Builder
   - Embroidery Quote Builder
   - Cap Embroidery Quote Builder

---

## 📞 Support & Resources

### Documentation Quick Links

- **Block Documentation:** [/memory/edp/](edp/)
- **Pricing Sync:** [PRICING_SYNC_GUIDE.md](edp/PRICING_SYNC_GUIDE.md)
- **Product Block (Critical):** [PRODUCT_BLOCK.md](edp/PRODUCT_BLOCK.md)

### ShopWorks Resources

- **OnSite 7 Documentation:** Contact ShopWorks support
- **Order Type IDs:** Configured in your ShopWorks system
- **CATALOG_COLOR Mapping:** From ShopWorks product database

### Internal Resources

- **Implementation Examples:** See Screen Print Quote Builder
- **Testing Procedures:** See Pricing Sync Guide
- **Git History:** Commits c96bff3, c0f9286, be2222b, 05b58ae, 7177fcf

---

## 🎉 Success Metrics

### Current Implementation (Screen Print)

✅ **Product Block:** 19 of 19 essential fields implemented
✅ **Pricing Sync:** Order Summary matches ShopWorks within $0.20
✅ **CATALOG_COLOR:** Successfully links to ShopWorks inventory
✅ **Import Success:** EDP imports without errors
✅ **Production Ready:** Screen Print quotes fully operational

### Next Milestones

- [ ] Design Block implementation (HIGH VALUE)
- [ ] Contact Block implementation
- [ ] Complete Order Block (shipping address)
- [ ] DTG Quote Builder EDP export
- [ ] Embroidery Quote Builder EDP export
- [ ] Cap Quote Builder EDP export

---

**Documentation Type:** Master navigation and overview
**Related Files:** All block documentation in [/memory/edp/](edp/) directory
**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Production-ready, continuously enhanced
