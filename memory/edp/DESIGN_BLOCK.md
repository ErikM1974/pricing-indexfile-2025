# ShopWorks EDP - Design Block Field Reference

**File Path:** `memory/edp/DESIGN_BLOCK.md`
**Purpose:** Complete Design Block field specifications for ShopWorks OnSite 7 EDP integration
**Parent Guide:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

**Status:** NOT IMPLEMENTED - HIGH VALUE FOR SCREEN PRINT WORKFLOW

**🎨 Purpose:** Track artwork specifications, color counts, and design details for production. Critical for screen print and embroidery workflows to ensure accurate design reproduction.

**OnSite Version:** OnSite 7 (upgraded from OnSite 6.1)

**Total Fields:** 11 fields organized into 3 SubBlocks

**Shared Across:** All quote builders (Screen Print, DTG, Embroidery, Cap)

---

## Design Block Structure (11 Total Fields)

The Design Block uses a 3-SubBlock architecture to organize design specifications.

**SubBlock Overview:**
1. **Design SubBlock** (4 fields) - Design identification and type
2. **Location SubBlock** (5 fields) - Placement, colors, stitches, flashes
3. **Color SubBlock** (2 fields - repeatable) - Individual color specifications

---

## SubBlock 1: Design (4 Fields)

**Purpose:** Design identification and classification

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose |
|---------------------|----------------------|------|---------|
| `ExtDesignID` | `ExtDesignID` | String | External design identifier |
| `id_Design` | `# Design` | Number | Internal ShopWorks design ID |
| `id_DesignType` | `# Design Type` | Number | Design type code (1=Screen Print, 2=Embroidery, etc.) |
| `DesignName` | `Design Title` | String | Design name/description |

**All 4 fields existed in OnSite 6.1** (field names changed but functionality same)

---

## SubBlock 2: Location (5 Fields)

**Purpose:** Design placement and production specifications

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose |
|---------------------|----------------------|------|---------|
| `Location` | `Location` | String | Print/embroidery location on garment |
| `ColorsTotal` | `N` | Number | Total number of colors in design |
| `FlashesTotal` | *(NEW in OnSite 7)* | Number | Total number of flashes (underbase/specialty) |
| `StitchesTotal` | `# Stitches` | Number | Total stitch count (embroidery) |
| `DesignCode` | `# Design Code` | String | Internal design code reference |

**1 NEW field in OnSite 7:** `FlashesTotal` - Critical for screen print flash/underbase tracking

---

## SubBlock 3: Color (2 Fields - Repeatable)

**Purpose:** Individual color specifications (repeat for each color)

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose |
|---------------------|----------------------|------|---------|
| `Color` | `Color` | String | Individual color name |
| `Map` | `Map` | String | Color mapping/matching reference |

**Both fields existed in OnSite 6.1** (repeat these fields for EACH color in the design)

---

## Complete Implementation Example

**Full Design Block with all 3 SubBlocks:**

```javascript
// Complete Design Block with all 3 SubBlocks
// NOTE: Can have MULTIPLE Design Blocks per order (one per location/design)

edp += '---- Start Design ----\n';

// ===== SubBlock 1: Design =====
edp += `ExtDesignID>> SP-DESIGN-${quoteData.QuoteID}-FRONT\n`;
edp += `id_Design>> \n`;  // Leave blank for new designs (ShopWorks assigns)
edp += `id_DesignType>> 1\n`;  // 1=Screen Print, 2=Embroidery
edp += `DesignName>> ${quoteData.CompanyName || 'Customer'} - Front Logo\n`;

// ===== SubBlock 2: Location =====
edp += `Location>> Front\n`;
edp += `ColorsTotal>> 4\n`;  // Total ink colors
edp += `FlashesTotal>> 1\n`;  // Underbase flash count
edp += `StitchesTotal>> 0\n`;  // 0 for screen print
edp += `DesignCode>> SP-${quoteData.QuoteID}\n`;

// ===== SubBlock 3: Color (repeat for each color) =====
edp += `Color>> White (Underbase)\n`;
edp += `Map>> Pantone White\n`;

edp += `Color>> PMS 185 Red\n`;
edp += `Map>> Pantone 185\n`;

edp += `Color>> PMS 286 Blue\n`;
edp += `Map>> Pantone 286\n`;

edp += `Color>> Black\n`;
edp += `Map>> Pantone Black\n`;

edp += '---- End Design ----\n\n';

// For multi-location orders, add additional Design Blocks:
edp += '---- Start Design ----\n';
edp += `ExtDesignID>> SP-DESIGN-${quoteData.QuoteID}-BACK\n`;
edp += `id_DesignType>> 1\n`;
edp += `DesignName>> ${quoteData.CompanyName || 'Customer'} - Back Design\n`;
edp += `Location>> Full Back\n`;
edp += `ColorsTotal>> 2\n`;
edp += `FlashesTotal>> 0\n`;  // No underbase needed
// ... (repeat Color SubBlock for back design colors)
edp += '---- End Design ----\n\n';
```

---

## Use Cases for Design Block

### Screen Print Workflow

**Primary Use Cases:**
1. **Color Specification** - Track exact ink colors per location
2. **Flash Tracking** - Record underbase and specialty flashes for production
3. **Multi-Location Designs** - Separate Design Block for front, back, sleeves, etc.
4. **Art File Reference** - Link EDP to artwork files via `ExtDesignID`

**Example: 4-Color Front + 2-Color Back**
- Design Block 1: Front - 4 colors (3 + underbase), 1 flash
- Design Block 2: Back - 2 colors, 0 flashes

### Embroidery Workflow

**Primary Use Cases:**
1. **Stitch Count Tracking** - Record total stitches for pricing verification
2. **Thread Colors** - Document each thread color via Color SubBlock
3. **Logo Placement** - Location field specifies exact placement
4. **Digitization Reference** - Link to digitized design files

**Example: Left Chest Logo**
- Design Block: Left Chest - 8,500 stitches, 4 thread colors

### DTG Workflow

**Primary Use Cases:**
1. **Design Identification** - Reference artwork files
2. **Location Tracking** - Full front, full back, etc.
3. **Minimal Color Info** - DTG is full-color, so Color SubBlock often skipped

**Example: Full Front Photo**
- Design Block: Full Front - Design name references file, no color breakdown needed

---

## Method-Specific Implementation Patterns

### Screen Print Quote Builder Integration

```javascript
// Extract design info from existing screen print quote data
function generateDesignBlocks(quoteData) {
    const edpDesigns = [];

    // Iterate through each print location in the quote
    Object.entries(quoteData.SetupBreakdown || {}).forEach(([locationCode, setupDetails]) => {
        const locationName = getLocationName(locationCode);  // "Front", "Back", etc.

        // Calculate colors and flashes
        const totalColors = setupDetails.colors;
        const hasUnderbase = quoteData.isDarkGarment && setupDetails.needsUnderbase;
        const flashCount = hasUnderbase ? 1 : 0;
        const inkColors = totalColors - (hasUnderbase ? 1 : 0);

        // Build Design Block
        let designEDP = '---- Start Design ----\n';
        designEDP += `ExtDesignID>> SP-${quoteData.QuoteID}-${locationCode}\n`;
        designEDP += `id_DesignType>> 1\n`;  // Screen Print
        designEDP += `DesignName>> ${quoteData.CompanyName} - ${locationName}\n`;
        designEDP += `Location>> ${locationName}\n`;
        designEDP += `ColorsTotal>> ${totalColors}\n`;
        designEDP += `FlashesTotal>> ${flashCount}\n`;
        designEDP += `StitchesTotal>> 0\n`;
        designEDP += `DesignCode>> SP-${quoteData.QuoteID}\n`;

        // Add color details if available
        if (hasUnderbase) {
            designEDP += `Color>> White Underbase\n`;
            designEDP += `Map>> \n`;
        }

        designEDP += '---- End Design ----\n\n';
        edpDesigns.push(designEDP);
    });

    return edpDesigns.join('');
}
```

### Embroidery Quote Builder Integration

```javascript
// Extract design info from embroidery quote
function generateEmbroideryDesign(quoteData) {
    let edp = '---- Start Design ----\n';

    edp += `ExtDesignID>> EMB-${quoteData.QuoteID}\n`;
    edp += `id_DesignType>> 2\n`;  // Embroidery
    edp += `DesignName>> ${quoteData.DesignName || 'Embroidered Logo'}\n`;
    edp += `Location>> ${quoteData.Location || 'Left Chest'}\n`;
    edp += `ColorsTotal>> ${quoteData.ThreadColors || 0}\n`;
    edp += `FlashesTotal>> 0\n`;  // N/A for embroidery
    edp += `StitchesTotal>> ${quoteData.StitchCount || 0}\n`;
    edp += `DesignCode>> EMB-${quoteData.QuoteID}\n`;

    // Add thread colors if specified
    if (quoteData.ThreadColorList) {
        quoteData.ThreadColorList.forEach(threadColor => {
            edp += `Color>> ${threadColor.name}\n`;
            edp += `Map>> ${threadColor.code || ''}\n`;
        });
    }

    edp += '---- End Design ----\n\n';
    return edp;
}
```

---

## What Changes vs. What Stays the Same (Across Quote Builders)

**Same Design Block Structure for ALL Quote Builders:**
- ✅ Screen Print Quote Builder
- ✅ DTG Quote Builder
- ✅ Embroidery Quote Builder
- ✅ Cap Embroidery Quote Builder
- ✅ All future quote builders

**What's Identical:**
- All 11 field names and 3 SubBlock structure
- EDP Block delimiters (`---- Start Design ----` / `---- End Design ----`)
- Field format and data types
- Multiple Design Block pattern for multi-location orders

**What Varies by Quote Builder:**

| Field | Screen Print | Embroidery | DTG |
|-------|-------------|------------|-----|
| `id_DesignType` | 1 | 2 | (TBD) |
| `ColorsTotal` | Ink colors (3-6 typical) | Thread colors (1-15) | Often skipped |
| `FlashesTotal` | 0-2 (underbase/specialty) | 0 (N/A) | 0 (N/A) |
| `StitchesTotal` | 0 (N/A) | 5,000-15,000 typical | 0 (N/A) |
| `Color` SubBlock | Ink color names | Thread color names | Often skipped |

---

## Design Type IDs Reference

| ID | Design Type | Used By |
|----|-------------|---------|
| 1 | Screen Print | Screen Print Quote Builder |
| 2 | Embroidery | Embroidery & Cap Quote Builders |
| 3 | Vinyl/Heat Transfer | DTF Quote Builder |
| 4 | Direct-to-Garment | DTG Quote Builder |
| 5 | Sublimation | Future builders |

**Note:** Confirm these ID values with your ShopWorks configuration as they may vary by setup.

---

## Multi-Location Design Pattern

**Critical Pattern:** When an order has designs in multiple locations (Front + Back, Chest + Sleeve, etc.), create **separate Design Blocks** for each location:

```javascript
// Order with Front AND Back designs:

// Design Block #1 - Front
edp += '---- Start Design ----\n';
edp += `ExtDesignID>> SP-${quoteID}-FRONT\n`;
edp += `Location>> Front\n`;
edp += `ColorsTotal>> 4\n`;
// ... front design details
edp += '---- End Design ----\n\n';

// Design Block #2 - Back
edp += '---- Start Design ----\n';
edp += `ExtDesignID>> SP-${quoteID}-BACK\n`;
edp += `Location>> Full Back\n`;
edp += `ColorsTotal>> 2\n`;
// ... back design details
edp += '---- End Design ----\n\n';
```

**Why Multiple Blocks?**
- Each location may have different color counts
- Different flash requirements per location
- Separate artwork files per location
- Individual production tracking per design

---

## Color SubBlock Best Practices

**When to Use Color SubBlock:**
1. **Screen Print:** List each ink color (including underbase)
2. **Embroidery:** List each thread color with color codes
3. **DTG:** Usually skip (full-color process)

**How to Populate:**
```javascript
// Screen Print Example - Extract from setup breakdown
const colors = [
    { name: 'White Underbase', map: 'Pantone White' },
    { name: 'Red', map: 'PMS 185' },
    { name: 'Blue', map: 'PMS 286' },
    { name: 'Black', map: 'Pantone Black' }
];

colors.forEach(colorInfo => {
    edp += `Color>> ${colorInfo.name}\n`;
    edp += `Map>> ${colorInfo.map}\n`;
});

// Embroidery Example - From thread specifications
const threads = [
    { name: 'Navy Blue', map: 'Isacord 3554' },
    { name: 'White', map: 'Isacord 0015' },
    { name: 'Red', map: 'Isacord 1902' }
];

threads.forEach(thread => {
    edp += `Color>> ${thread.name}\n`;
    edp += `Map>> ${thread.map}\n`;
});
```

---

## Important Implementation Notes

1. **Design Block is OPTIONAL** - Not required for basic order import, but highly valuable for production workflow

2. **Multiple Designs per Order** - Add as many Design Blocks as needed (one per location/design)

3. **External Design ID Pattern** - Use consistent naming: `[METHOD]-[QUOTEID]-[LOCATION]`
   - Example: `SP-0127-1-FRONT`, `EMB-0127-2-LEFTCHEST`

4. **Leave `id_Design` Blank** - For new designs, ShopWorks will auto-assign the internal ID on import

5. **Flash Count Calculation** - For screen print:
   - Dark garments with underbase: Usually 1 flash
   - Safety stripes (reflective): May add 1+ flashes
   - Specialty inks: May require additional flashes

6. **Stitch Count Sources** - For embroidery:
   - From pricing tier selection (5K, 10K, etc.)
   - From digitizer's stitch count report
   - From design file metadata

7. **Color Mapping** - The `Map` field links to:
   - Pantone color matching system (screen print)
   - Thread manufacturer codes (embroidery)
   - Color swatch libraries (general reference)

---

## Benefits of Implementing Design Block

**For Production Team:**
- ✅ Exact color specifications (no guessing)
- ✅ Flash requirements clearly documented
- ✅ Stitch counts for time estimation
- ✅ Design file references for artwork retrieval

**For Art Department:**
- ✅ Track which designs are approved
- ✅ Link artwork files to orders
- ✅ Color matching specifications
- ✅ Design revision history

**For Quality Control:**
- ✅ Verify color accuracy against specs
- ✅ Confirm flash/underbase application
- ✅ Check stitch density
- ✅ Match finished product to design intent

**For Workflow Automation:**
- ✅ Auto-route orders based on design complexity
- ✅ Calculate production time from stitch counts
- ✅ Alert when design approval pending
- ✅ Track design reuse across orders

---

## Recommended Implementation Phases

**Phase 1: Essential Fields (Future)**
- `ExtDesignID` - Design identification
- `id_DesignType` - Method classification
- `DesignName` - Design description
- `Location` - Placement on garment

**Phase 2: Enhanced Features (Future)**
- `ColorsTotal` - Total colors in design
- `FlashesTotal` - Flash count for screen print
- `StitchesTotal` - Stitch count for embroidery

**Phase 3: Advanced Features (Future)**
- Color SubBlock - Individual color specifications
- Multiple Design Blocks per order
- Color mapping integration

---

## Additional Notes

**Current Status:** Design Block fields are documented but not implemented. Orders currently import without design specifications.

**Future Implementation Priority:** HIGH VALUE for screen print workflow improvement. Consider implementing after Contact and Customer blocks.

**Related Systems:**
- Art approval workflow
- Design file management
- Color matching systems
- Production scheduling

---

## Related Files

- **Overview & Navigation:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)
- **Order Block:** [ORDER_BLOCK.md](ORDER_BLOCK.md)
- **Customer Block:** [CUSTOMER_BLOCK.md](CUSTOMER_BLOCK.md)
- **Contact Block:** [CONTACT_BLOCK.md](CONTACT_BLOCK.md)
- **Product Block:** [PRODUCT_BLOCK.md](PRODUCT_BLOCK.md) - CRITICAL for CATALOG_COLOR
- **Payment Block:** [PAYMENT_BLOCK.md](PAYMENT_BLOCK.md)

---

**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Ready for future implementation
