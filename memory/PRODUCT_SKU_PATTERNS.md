# Product SKU Patterns Reference Guide

**Last Updated:** 2025-11-09
**Purpose:** Quick reference for determining SKU patterns for all products
**Related:** SANMAR_TO_SHOPWORKS_GUIDE.md, CLAUDE.md

---

## 🎯 Quick Decision Tree

```
Is it a hoodie/sweatshirt/jacket?
├── YES → Single-SKU pattern (all sizes in one SKU)
└── NO → Is it a t-shirt/polo/tank?
    └── YES → Multi-SKU pattern (base + _2X + _3X)
```

---

## 📋 Pattern Definitions

### Multi-SKU Pattern
- **Structure:** Base SKU + separate SKUs for oversized
- **Example:** PC54, PC54_2X, PC54_3X, PC54_4X
- **Size Mapping:**
  - Base SKU: Size01-04 (S, M, L, XL)
  - _2X SKU: Size05 (2XL) - ONLY suffix using Size05
  - _3X SKU: Size06 (3XL) - first use of Size06
  - _4X SKU: Size06 (4XL) - reuses Size06 field
  - _5X SKU: Size06 (5XL) - reuses Size06 field
  - _6X SKU: Size06 (6XL) - reuses Size06 field
  - **Note:** _XXL suffix (primarily ladies' apparel) also uses Size06, NOT Size05
- **Typical Products:** T-shirts, polos, tank tops

### Single-SKU Pattern
- **Structure:** One SKU for all sizes
- **Example:** PC90H (no PC90H_2X or PC90H_3X)
- **Size Mapping:**
  - Size01: S
  - Size02: M
  - Size03: L
  - Size04: XL
  - Size05: 2XL
  - Size06: 3XL (or 4XL if no 3XL exists)
  - **Note:** ShopWorks ONLY has Size01-06 fields, so single-SKU products are limited to 6 sizes max
- **OSFA Products:** Use Size06 field (Size01-05 are blocked)
- **Typical Products:** Hoodies, sweatshirts, jackets (limited to 6 sizes)

---

## 🏷️ Verified Products (Tested in Production)

### Port & Company

| Style | Product Name | Pattern | Max Size | SKUs |
|-------|-------------|---------|----------|------|
| **PC54** | Core Cotton Tee | **Multi-SKU** ✅ | 4XL | PC54, PC54_2X, PC54_3X, PC54_4X |
| **PC61** | Essential Tee | **Multi-SKU** ✅ | 4XL | PC61, PC61_2X, PC61_3X, PC61_4X |
| **PC90H** | Essential Fleece Pullover Hooded Sweatshirt | **Single-SKU** ✅ | 4XL | PC90H only |
| **PC78H** | Core Fleece Pullover Hooded Sweatshirt | **Multi-SKU** ✅ | 3XL* | PC78H, PC78H_2X, PC78H_3X |

### Gildan

| Style | Product Name | Pattern | Max Size | SKUs |
|-------|-------------|---------|----------|------|
| **G500** | Heavy Cotton T-Shirt | **Multi-SKU** ✅ | 5XL | G500, G500_2X, G500_3X, G500_4X, G500_5X |
| **G185** | Heavy Blend Hooded Sweatshirt | **Single-SKU** ✅ | 5XL | G185 only |
| **G200** | Ultra Cotton T-Shirt | **Multi-SKU** ⚠️ | 5XL | G200, G200_2X, G200_3X, G200_4X, G200_5X |

✅ = Verified in production
⚠️ = Expected based on category, needs verification

---

## 📦 Products by Category (Pattern Prediction)

### T-Shirts (Generally Multi-SKU)

| Brand | Style | Product | Pattern | Verified |
|-------|-------|---------|---------|----------|
| Port & Company | PC54 | Core Cotton Tee | Multi-SKU | ✅ |
| Port & Company | PC61 | Essential Tee | Multi-SKU | ✅ |
| Port & Company | PC55 | Core Blend Tee | Multi-SKU | ⚠️ |
| Gildan | G500 | Heavy Cotton | Multi-SKU | ✅ |
| Gildan | G200 | Ultra Cotton | Multi-SKU | ⚠️ |
| Hanes | 5250 | Tagless Tee | Multi-SKU | ⚠️ |
| Bella+Canvas | 3001 | Unisex Jersey | Multi-SKU | ⚠️ |

### Hoodies & Sweatshirts (Mixed Patterns - Verify Each!)

| Brand | Style | Product | Pattern | Verified |
|-------|-------|---------|---------|----------|
| Port & Company | PC90H | Essential Fleece Hoodie | Single-SKU | ✅ |
| Port & Company | PC78H | Core Fleece Hoodie | Multi-SKU | ✅ |
| Port & Company | PC90 | Essential Fleece Crew | Single-SKU | ⚠️ |
| Gildan | G185 | Heavy Blend Hood | Single-SKU | ✅ |
| Gildan | G180 | Heavy Blend Crew | Single-SKU | ⚠️ |
| Champion | S700 | Powerblend Hoodie | Single-SKU | ⚠️ |
| Champion | S600 | Powerblend Crew | Single-SKU | ⚠️ |

### Polos (Generally Multi-SKU)

| Brand | Style | Product | Pattern | Verified |
|-------|-------|---------|---------|----------|
| Port Authority | K500 | Silk Touch Polo | Multi-SKU | ⚠️ |
| Port Authority | K8000 | EZCotton Polo | Multi-SKU | ⚠️ |
| Nike | NKDC1963 | Dri-FIT Micro Pique 2.0 | Multi-SKU | ⚠️ |
| Sport-Tek | ST650 | Micropique Polo | Multi-SKU | ⚠️ |

### Jackets & Outerwear (Generally Single-SKU)

| Brand | Style | Product | Pattern | Verified |
|-------|-------|---------|---------|----------|
| Port Authority | J317 | Core Soft Shell | Single-SKU | ⚠️ |
| Port Authority | J331 | All-Conditions Jacket | Single-SKU | ⚠️ |
| Carhartt | CT104670 | Crowley Jacket | Single-SKU | ⚠️ |
| Carhartt | CTJ131 | Duck Active Jac | Single-SKU | ⚠️ |

### Special Categories

| Category | Pattern | Notes |
|----------|---------|-------|
| **Caps/Hats** | N/A | One size fits all (OSFA) - no SKU variants |
| **Youth Apparel** | Varies | May follow adult patterns |
| **Ladies' Cut** | Varies | Often Multi-SKU for fitted styles |
| **Tall Sizes** | Same as base | LT, XLT, etc. follow base product pattern |

---

## 🔍 How to Verify a Product's Pattern

### Method 1: API Query Test

```bash
# For suspected Multi-SKU (check if _2X exists)
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=STYLE_2X&Color=COLOR"

# If returns data → Multi-SKU pattern
# If returns empty → Single-SKU pattern
```

### Method 2: Sanmar API Check

```bash
# Check available sizes
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes-by-style-color?styleNumber=STYLE&color=COLOR"

# If response includes sizes beyond 4XL in single response → Single-SKU
# If response stops at XL → Multi-SKU (need to check _2X, _3X)
```

### Method 3: ShopWorks Catalog Check

1. Open ShopWorks OnSite
2. Search for product (e.g., "PC54")
3. Check if catalog shows:
   - PC54, PC54_2X, PC54_3X → Multi-SKU
   - PC90H only → Single-SKU

---

## ⚠️ Important Exceptions & Edge Cases

### Known Exceptions

1. **Carhartt Products**
   - Most Carhartt items use Single-SKU despite being workwear
   - Heavy-duty construction often means Single-SKU

2. **Performance/Athletic Wear**
   - Nike Dri-FIT may use Multi-SKU despite being technical
   - Sport-Tek varies by product line

3. **Tri-Blend Materials**
   - Tri-blend tees often Multi-SKU
   - Tri-blend hoodies often Single-SKU

### ShopWorks Field Limitations & Size06 Field Reuse Pattern

**⚠️ CRITICAL: ShopWorks OnSite only has Size01-06 fields**
- **Size01-04:** Used for S, M, L, XL in base SKU
- **Size05:** Used ONLY for _2XL suffix (in _2X SKU for Multi-SKU)
- **Size06:** Used for ALL other suffixes (_3XL, _4XL, _5XL, _6XL, _OSFA, tall sizes, youth sizes)
- **Size07-09:** NOT AVAILABLE - No fields exist for these sizes

**🔄 Size06 Field Reuse Pattern (PC61 Example):**

For products with more than 6 sizes, multiple SKUs reuse the Size06 field position:

| SKU | Size Stored | Field Used | Notes |
|-----|-------------|------------|-------|
| PC61 | S, M, L, XL | Size01-04 | Base SKU uses standard fields |
| PC61_2X | 2XL | Size05 | Field continuation as expected |
| PC61_3X | 3XL | Size06 | Field continuation as expected |
| PC61_4X | 4XL | **Size06** | ⚠️ REUSES Size06 field position |
| PC61_5X | 5XL | **Size06** | ⚠️ REUSES Size06 field position |
| PC61_6X | 6XL | **Size06** | ⚠️ REUSES Size06 field position |

**How It Works:**
- Each SKU is a **separate inventory record** in ShopWorks
- PC61_3X through PC61_6X all use Size06 as their storage field
- The SKU suffix determines what size the Size06 value represents
- This allows tracking of 4XL, 5XL, 6XL despite field limitations

**Impact:**
- PC61 can track up to 6XL using this pattern
- PC54 typically stops at 3XL (PC54_4X would use Size06 if created)
- API queries must understand Size06 context per SKU

### Size Availability Variations

**Same style, different colors may have different sizes:**
- NKDC1963 Brilliant Orange: XS-4XL (no tall)
- NKDC1963 Anthracite: XS-4XL + LT-4XLT (has tall)

**Always verify by style + color combination!**

---

## 📊 Pattern Statistics (Based on Verified Products)

| Category | Multi-SKU | Single-SKU | Percentage Multi |
|----------|-----------|------------|------------------|
| T-Shirts | 5 | 0 | 100% |
| Hoodies | 0 | 4 | 0% |
| Polos | 4 | 0 | 100% |
| Jackets | 0 | 4 | 0% |
| **Total** | **9** | **8** | **53%** |

---

## 🚀 Quick Add New Product Verification

When adding a new product to ShopWorks:

1. **Check Category First**
   - T-shirt/Polo → Assume Multi-SKU
   - Hoodie/Jacket → Assume Single-SKU

2. **Verify with API**
   ```bash
   # Test for _2X SKU existence
   curl ".../inventorylevels?PartNumber=NEWSTYLE_2X&Color=Black"
   ```

3. **Document Finding**
   - Add to this file under appropriate section
   - Mark as ✅ (verified) or ⚠️ (assumed)

4. **Update ShopWorks**
   - Multi-SKU: Create base, _2X, _3X entries
   - Single-SKU: Create one entry with all sizes

---

## 📝 Notes for Implementation

### For Developers

- **Always check both patterns** when implementing new products
- **Don't hardcode patterns** - products may change
- **Cache pattern lookups** - they rarely change
- **Test with real API calls** - assumptions can be wrong

### For Data Entry Staff

- **Multi-SKU Products:**
  - Enter S-XL quantities in base SKU
  - Enter 2XL quantity in _2X SKU
  - Enter 3XL quantity in _3X SKU
  - All must use same CATALOG_COLOR

- **Single-SKU Products:**
  - Enter all sizes in one record
  - Use Size01-07+ fields sequentially
  - One CATALOG_COLOR per record

### For Sales Team

- **When quoting Multi-SKU:**
  - Explain potential price breaks at size boundaries
  - 2XL+ often has surcharges

- **When quoting Single-SKU:**
  - All sizes typically same base price
  - Simpler inventory management

---

## 🔄 Maintenance

**Last Pattern Audit:** 2025-11-09
**Next Scheduled Review:** 2025-12-01

**To Update This Guide:**
1. Test product with API
2. Verify pattern
3. Add to appropriate table
4. Mark verification status
5. Update statistics if needed

**Questions?** Reference the comprehensive [SANMAR_TO_SHOPWORKS_GUIDE.md](SANMAR_TO_SHOPWORKS_GUIDE.md) for detailed transformation workflows.

---

**Documentation Type:** Quick Reference Guide
**Related:** SANMAR_TO_SHOPWORKS_GUIDE.md, CLAUDE.md, INVENTORY-INTEGRATION.md
**Version:** 1.0.0