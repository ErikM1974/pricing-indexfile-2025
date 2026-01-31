# ShopWorks Import Feature for Quote Builders

## Overview
Add a "Paste from ShopWorks" feature to all 4 quote builders that parses order text files and auto-populates line items, customer info, and service configurations.

**Status:** Planning Complete - Ready for Implementation
**Start With:** Embroidery Quote Builder (test first)
**Expand To:** DTG, DTF, Screenprint after embroidery works

---

## Complete Line Item Types (from 1,856 unique ShopWorks items)

### Category 1: SanMar Products (~1,400 items)
Standard product codes with optional size suffixes.
- **Examples**: `PC78H`, `CT104670`, `J317`, `K500`
- **Size suffixes**: `_2X`, `_3X`, `_4X`, `_XS`, `_LT` (tall), `_OSFA`, `_S/M`, `_L/XL`
- **Action**: Look up via product search API, auto-populate row

### Category 2: Digitizing/Setup Fees (169 items)
| Code | Description | Price | Action |
|------|-------------|-------|--------|
| `DD` | Digitizing Setup (legacy) | $100 | Check "Needs Digitizing" |
| `DGT-001` | Digitizing fee | $100 | Check "Needs Digitizing" |
| `DGT-002` | Revision fee | varies | Add as fee line |
| `DGT-003` | Text digitizing setup | varies | Add as fee line |
| `GRT-50` | Logo Mockup (patches) | $50 | Check "Needs Setup" for patches |
| `GRT-75` | Graphic design ($75/hr) | varies | Add as fee line |

### Category 3: Additional Logo - AL (209 items)
- **Code**: `AL`
- **Descriptions specify position**: "Left Sleeve", "Right Chest", "Back Yoke", etc.
- **Action**: Enable Additional Logo feature in quote builder

### Category 4: Customer-Supplied Garments - DECG (314 items)
- **Code**: `DECG`
- **Description**: "Di. Embroider Garms" with item details
- **Pricing Tiers** (from `/calculators/embroidery-customer/embroidery-customer-calculator.js`):
  | Qty | Price/item |
  |-----|------------|
  | 1-2 | $45.00 |
  | 3-5 | $40.00 |
  | 6-11 | $38.00 |
  | 12-23 | $32.00 |
  | 24-71 | $30.00 |
  | 72-143 | $25.00 |
  | 144+ | $15.00 |
- **Modifiers**: Caps -20%, Heavyweight +$10, LTM $50 if <24
- **Action**: Add as special "Customer Supplied" row with calculated pricing

### Category 5: Monogram/Names (280 items)
| Code | Description | Price | Action |
|------|-------------|-------|--------|
| `Monogram` | Dir. Embroider Names | $12.50/name | Add as fee line item |
| `Name` | Names on garments | $12.50/name | Add as fee line item |

### Category 6: Products That May or May Not Be in SanMar (~50 items)

**NOTE:** SanMar now carries many Richardson caps (112, 115, etc.) and other brands. Always try SanMar API lookup first!

| Code | Brand | Status | Action |
|------|-------|--------|--------|
| `112` | Richardson caps | **NOW IN SANMAR** | Try API first, fallback to custom row |
| `115` | Richardson Low Pro | **NOW IN SANMAR** | Try API first, fallback to custom row |
| `18500` | Gildan direct | May not be in SanMar | Try API first, fallback to custom row |
| `883681` | Nike/Flexfit | May not be in SanMar | Try API first, fallback to custom row |
| `7007` | Safety vests | Likely not in SanMar | Try API first, fallback to custom row |

**Import Logic:**
1. Try SanMar API lookup for ALL part numbers
2. If found → Add as normal product row with full pricing
3. If NOT found → Add as custom row with manual pricing option

**Custom Row Feature**: Sales rep can enter blank cost, formula calculates decorated price.

### Category 7: Special Charges
| Code | Description | Action |
|------|-------------|--------|
| `RUSH` | Rush Charge (typically 25%) | Add to Rush Fee field |
| `Art` | Art Charges | Add to Art Charge field |

### Category 8: Comment/Note Rows (399 items)
- Empty PartNumber with design references, position details
- **Action**: Display as notes/warnings, don't create product rows

---

## ShopWorks Text Format Reference

```
**************************************************************************
Order #:134707
Salesperson:Nika Lao
Email:nika@nwcustomapparel.com
**************************************************************************
Your Company Information
Customer #:5281
Company:Absher Construction Company
**************************************************************************
Order Information
Ordered by:Kaleb McCullough
Email:kalebmichaelm@gmail.com
**************************************************************************
Items Purchased
Item 1 of 1
Part Number:CT100615
Description:Carhartt Rain Defender Paxton Heavyweight Hooded Sweatshirt, Black
Unit Price:84.00
Item Quantity:1
Adult:Quantity
LG:1
**************************************************************************
```

### Size Mapping

| ShopWorks | Quote Builder |
|-----------|---------------|
| `S` | `S` |
| `MD` or `M` | `M` |
| `LG` | `L` |
| `XL` | `XL` |
| `XXL` | `2XL` |
| `XXXL` | `3XL` |
| `XXXL (Other)` | `OSFA` (for caps) |
| `S (Other)` | Skip (service item placeholder) |

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `/shared_components/js/shopworks-import-parser.js` | Parser class with all line item type handling |
| `/shared_components/css/shopworks-import.css` | Modal and preview styling |

### Modified Files
| File | Changes |
|------|---------|
| `quote-builders/embroidery-quote-builder.html` | Add button, modal, import logic, DECG row support |
| `quote-builders/dtg-quote-builder.html` | Same (after embroidery tested) |
| `quote-builders/dtf-quote-builder.html` | Same |
| `quote-builders/screenprint-quote-builder.html` | Same |

---

## Parser Module Design

**File:** `/shared_components/js/shopworks-import-parser.js`

```javascript
class ShopWorksImportParser {
    // Parse full text file
    parse(text) → {
        customer,           // { company, contactName, email, customerId }
        salesRep,           // { name, email }
        orderId,            // ShopWorks order number
        products,           // SanMar products array
        customProducts,     // Non-SanMar products (need manual pricing)
        decgItems,          // Customer-supplied garments
        services: {
            digitizing,     // DD/DGT items → enable digitizing checkbox
            additionalLogo, // AL items → enable AL feature
            monograms,      // Name/Monogram items → $12.50 each
            rush,           // RUSH items → rush fee field
            artCharges,     // Art items → art charge field
            patchSetup      // GRT-50 items → patch setup checkbox
        },
        notes               // Comment rows (empty PartNumber)
    }

    // Classify part number by type
    classifyPartNumber(partNumber) → 'product' | 'digitizing' | 'decg' | 'al' | 'monogram' | 'rush' | 'art' | 'patch-setup' | 'comment' | 'non-sanmar'

    // Clean part number (strip _4X, _OSFA suffixes)
    cleanPartNumber(partNumber) → baseStyle

    // Calculate DECG pricing based on quantity
    calculateDECGPrice(quantity, isCap, isHeavyweight) → { unitPrice, ltmFee }

    // NOTE: SanMar now carries Richardson (112, 115, etc.)
    // Always try API lookup first - these patterns are just hints for fallback
    POTENTIALLY_NON_SANMAR: ['18500', '883681', '7007', '2000']
}

// Import Logic for Products:
// 1. Try SanMar API lookup for ALL part numbers (including Richardson)
// 2. If found → Add as normal product row
// 3. If NOT found → Add as custom row with manual pricing
```

### DECG Pricing Logic
```javascript
const DECG_TIERS = {
    "1-2": 45.00, "3-5": 40.00, "6-11": 38.00,
    "12-23": 32.00, "24-71": 30.00, "72-143": 25.00, "144+": 15.00
};
const CAP_DISCOUNT = 0.20;      // -20% for caps
const HEAVYWEIGHT_SURCHARGE = 10.00;
const LTM_THRESHOLD = 24;
const LTM_FEE = 50.00;
```

---

## Verification Steps

1. **Basic Import Test**
   - Use Order #134745 (mixed items with DD and AL)
   - Verify customer info, products, digitizing, AL enabled

2. **DECG Test**
   - Use Order #134733 or #134734 (has DECG items)
   - Verify DECG rows with calculated tier pricing

3. **Non-SanMar Test**
   - Use Order #134832 (has Richardson 112 caps)
   - Verify custom row with cost input

4. **Monogram Test**
   - Use Order #134787 (has Monogram items)
   - Verify $12.50/name fee added

---

## Sample Data Location

CSV with all line items: `C:\Users\erik\Downloads\embroidery orders raw data 2025.csv`
- 1,856 unique part numbers analyzed
- Covers all embroidery orders for 2025-2026

---

## Related Files

- DECG Pricing: `/calculators/embroidery-customer/embroidery-customer-calculator.js`
- Quote Builder Utils: `/shared_components/js/quote-builder-utils.js`
- Product Search: `/shared_components/js/exact-match-search.js`
