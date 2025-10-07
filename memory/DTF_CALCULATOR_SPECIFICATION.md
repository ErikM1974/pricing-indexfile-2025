# DTF Pricing Calculator - Complete Implementation Specification

**Last Updated:** 2025-10-07
**Purpose:** Complete technical specification to rebuild the DTF pricing calculator from scratch if code is lost
**Screenshot Reference:** `/mnt/c/Users/erik/Downloads/wite space.png`

---

## 1. Overview & Purpose

The DTF (Direct-to-Film) Pricing Calculator is a web-based tool that calculates per-shirt pricing for DTF transfer decoration. It features:

- Toggle-based location selection (NOT dropdowns)
- Preset quantity tier buttons with conditional input
- Real-time pricing updates
- 100% API-driven (NO hardcoded pricing fallbacks)
- Automatic conflict resolution for location selection

**Critical Rule:** If any code is lost, this document is the single source of truth for rebuilding.

---

## 2. UI Layout Specification

### 2.1 Overall Layout

**Two-column grid layout:**
```
┌─────────────────────────────────────────────────────────┐
│                   Product Display Area                   │
│              (Image, Title, Colors, etc.)               │
└─────────────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────────────┐
│   Print Locations        │   Quantity Tiers             │
│   (Left Column)          │   (Right Column)             │
│                          │                              │
│   - Small Logos          │   ┌──────────────────┐      │
│     5 toggles            │   │  10-23 pieces    │      │
│   - Medium Designs       │   └──────────────────┘      │
│     2 toggles            │   ┌──────────────────┐      │
│   - Large Coverage       │   │  24-47 pieces    │ ← Selected
│     2 toggles            │   └──────────────────┘      │
│                          │   ┌──────────────────┐      │
│   Info box about sizes   │   │  48-71 pieces    │      │
│                          │   └──────────────────┘      │
│                          │   ┌──────────────────┐      │
│                          │   │  72+ pieces      │      │
│                          │   └──────────────────┘      │
└──────────────────────────┴──────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    YOUR PRICE                            │
│                    $26.00                                │
│              24 pieces + 0 location(s)                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Container Styling

**Container:** Use `container-fluid` with `max-width: 1400px` to eliminate whitespace
```html
<div class="container-fluid" style="max-width: 1400px; margin: 0 auto; padding: 0 20px;">
```

### 2.3 Toggle Switch Design

**iOS-Style Toggle Switches:**
- Off state: Gray background, slider on left
- On state: Green background (#3a7c52), slider on right
- Smooth animation on toggle
- Size: 52px × 28px with 22px slider

**Toggle Item Layout:**
```
┌────────────────────────────────────────┐
│  Location Name            ○───         │  ← OFF state
│  Size (e.g., 5" x 5")     ───○         │  ← ON state (green)
└────────────────────────────────────────┘
```

### 2.4 Size Category Headers

Three category sections with headers:

1. **"Small Logos & Accents"** - Up to 5" x 5"
2. **"Medium Designs"** - Up to 9" x 12"
3. **"Large Full Coverage"** - Up to 12" x 16.5"

Each header shows:
- Category name (bold, larger font)
- Size dimensions (smaller, lighter text)
- Green accent border on left

### 2.5 Info Box

Blue info box below toggles:
```
ℹ Transfer sizes are automatically determined by location
```

### 2.6 Quantity Tier Buttons

Vertical stack of buttons:
- Default state: White background, dark border
- Selected state: Green background (#3a7c52), white text
- Shows tier range (e.g., "24-47 pieces")
- Shows label below (e.g., "Standard tiers")

### 2.7 Price Display

Large green box at bottom:
- "YOUR PRICE" label (small, uppercase)
- "$26.00" (very large, bold)
- "24 pieces + 0 location(s)" (smaller subtitle)

---

## 3. Toggle Behavior Rules

### 3.1 Location Conflict Rules

**CRITICAL: Locations have mutual exclusivity rules**

**Front Locations (Mutually Exclusive):**
- Left Chest
- Right Chest
- Center Front
- Full Front

**Rule:** Only ONE front location can be active at a time.
- If "Left Chest" is ON and user clicks "Full Front" → "Left Chest" turns OFF, "Full Front" turns ON

**Back Locations (Mutually Exclusive):**
- Back of Neck
- Center Back
- Full Back

**Rule:** Only ONE back location can be active at a time.
- If "Back of Neck" is ON and user clicks "Full Back" → "Back of Neck" turns OFF, "Full Back" turns ON

**Sleeve Locations (Independent):**
- Left Sleeve
- Right Sleeve

**Rule:** Sleeves are independent. Both can be ON, both can be OFF, or just one.

### 3.2 Valid Selection Examples

✅ **Valid Selections:**
- Left Chest + Center Back + Left Sleeve + Right Sleeve (4 locations)
- Full Front + Full Back (2 locations)
- Right Chest + Right Sleeve (2 locations)
- Center Front + Back of Neck + Left Sleeve (3 locations)

❌ **Invalid Selections (Auto-Corrected):**
- Left Chest + Full Front → System keeps only the most recent click
- Back of Neck + Center Back → System keeps only the most recent click
- Full Front + Right Chest → System keeps only the most recent click

### 3.3 Implementation Logic

```javascript
// Pseudo-code for toggle click handling
function handleToggleClick(clickedLocation) {
    const locationMap = {
        'left-chest': 'front',
        'right-chest': 'front',
        'center-front': 'front',
        'full-front': 'front',
        'back-of-neck': 'back',
        'center-back': 'back',
        'full-back': 'back',
        'left-sleeve': 'sleeve-left',
        'right-sleeve': 'sleeve-right'
    };

    const clickedZone = locationMap[clickedLocation];

    // If this location is already active, turn it OFF
    if (isActive(clickedLocation)) {
        removeLocation(clickedLocation);
        return;
    }

    // For front/back zones, turn off other locations in same zone
    if (clickedZone === 'front' || clickedZone === 'back') {
        const sameZoneLocations = Object.keys(locationMap)
            .filter(loc => locationMap[loc] === clickedZone);
        sameZoneLocations.forEach(loc => removeLocation(loc));
    }

    // Turn ON the clicked location
    addLocation(clickedLocation);

    // Recalculate price immediately
    updatePricing();
}
```

---

## 4. Location to Size Mapping

### 4.1 Complete Location Table

| Location Name    | Location Code    | Size Category | Size Dimensions | API price_type |
|-----------------|------------------|---------------|-----------------|----------------|
| Left Chest      | left-chest       | Small         | 5" x 5"         | Small          |
| Right Chest     | right-chest      | Small         | 5" x 5"         | Small          |
| Left Sleeve     | left-sleeve      | Small         | 5" x 5"         | Small          |
| Right Sleeve    | right-sleeve     | Small         | 5" x 5"         | Small          |
| Back of Neck    | back-of-neck     | Small         | 5" x 5"         | Small          |
| Center Front    | center-front     | Medium        | 9" x 12"        | Medium         |
| Center Back     | center-back      | Medium        | 9" x 12"        | Medium         |
| Full Front      | full-front       | Large         | 12" x 16.5"     | Large          |
| Full Back       | full-back        | Large         | 12" x 16.5"     | Large          |

### 4.2 Location = Size Model

**CRITICAL CONCEPT:** Each location is permanently locked to ONE size.

This is called the "Location = Size" model. Unlike the old system where users could choose the size for each location, the new system automatically determines the size based on the location selected.

**Implementation in DTFConfig:**
```javascript
transferLocations: [
    // Small transfer locations (5" x 5")
    { value: 'left-chest', label: 'Left Chest', size: 'small', category: 'small' },
    { value: 'right-chest', label: 'Right Chest', size: 'small', category: 'small' },
    { value: 'left-sleeve', label: 'Left Sleeve', size: 'small', category: 'small' },
    { value: 'right-sleeve', label: 'Right Sleeve', size: 'small', category: 'small' },
    { value: 'back-of-neck', label: 'Back of Neck', size: 'small', category: 'small' },

    // Medium transfer locations (9" x 12")
    { value: 'center-front', label: 'Center Front', size: 'medium', category: 'medium' },
    { value: 'center-back', label: 'Center Back', size: 'medium', category: 'medium' },

    // Large transfer locations (12" x 16.5")
    { value: 'full-front', label: 'Full Front', size: 'large', category: 'large' },
    { value: 'full-back', label: 'Full Back', size: 'large', category: 'large' }
]
```

---

## 5. Quantity Tier Behavior

### 5.1 Default State on Page Load

**Default:** 24-47 tier is pre-selected when page loads
- Green button highlighting
- Price calculated for midpoint (35-36 pieces) or specific quantity if known

### 5.2 Tier Button Behavior

**Standard Tiers (24-47, 48-71, 72+):**
- Single click immediately calculates price
- No additional input needed
- Uses midpoint of range for initial calculation

**Special Tier (10-23 - LTM Fee Tier):**
- Click button → Shows conditional input field below
- Input field: "Enter exact quantity (10-23): [___]"
- Validation: Must be between 10-23
- Calculate button or auto-calculate on blur
- LTM fee ($50) divided by exact quantity for accurate pricing

### 5.3 Tier Selection Implementation

```javascript
// Pseudo-code
function handleTierSelection(tierLabel, minQty, maxQty, ltmFee) {
    // Remove previously selected tier styling
    deselectAllTiers();

    // Highlight selected tier
    highlightTier(tierLabel);

    // Check if this is the LTM tier
    if (ltmFee > 0) {
        // Show conditional input field
        showQuantityInput(minQty, maxQty);
        // Wait for user to enter exact quantity
        // Then calculate with: ltmFeePerShirt = ltmFee / exactQuantity
    } else {
        // Hide any conditional input
        hideQuantityInput();

        // Calculate immediately with midpoint
        const quantity = Math.floor((minQty + maxQty) / 2);
        calculatePricing(quantity, tierLabel);
    }
}
```

### 5.4 Immediate Recalculation

**Trigger Events:**
- Tier button clicked → Recalculate immediately
- Toggle location clicked → Recalculate immediately
- Quantity input changed (for 10-23 tier) → Recalculate on blur or button
- Product selection changed → Recalculate immediately

---

## 6. API Integration (NO FALLBACKS)

### 6.1 API Endpoint

**Primary Endpoint:**
```
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber={styleNumber}
```

**Example:**
```
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber=PC54
```

### 6.2 Complete API Response Structure

```json
{
    "tiersR": [
        {
            "PK_ID": 19,
            "TierID": 18,
            "DecorationMethod": "DTF",
            "TierLabel": "24-47",
            "MinQuantity": 24,
            "MaxQuantity": 47,
            "MarginDenominator": 0.6,
            "TargetMargin": 0,
            "LTM_Fee": 0
        },
        {
            "PK_ID": 22,
            "TierID": 21,
            "DecorationMethod": "DTF",
            "TierLabel": "10-23",
            "MinQuantity": 10,
            "MaxQuantity": 23,
            "MarginDenominator": 0.6,
            "TargetMargin": 0,
            "LTM_Fee": 50
        }
        // ... more tiers
    ],
    "rulesR": {
        "RoundingMethod": "HalfDollarCeil_Final"
    },
    "allDtfCostsR": [
        {
            "PK_ID": 1,
            "size": "Up to 5\" x 5\"",
            "price_type": "Small",
            "quantity_range": "10-23",
            "min_quantity": 10,
            "max_quantity": 23,
            "unit_price": 6,
            "PressingLaborCost": 2
        },
        {
            "PK_ID": 2,
            "size": "Up to 5\" x 5\"",
            "price_type": "Small",
            "quantity_range": "24-47",
            "min_quantity": 24,
            "max_quantity": 47,
            "unit_price": 5.25,
            "PressingLaborCost": 2
        }
        // ... more price rows for Medium and Large
    ],
    "freightR": [
        {
            "PK_ID": 1,
            "min_quantity": 10,
            "max_quantity": 49,
            "cost_per_transfer": 0.5
        },
        {
            "PK_ID": 2,
            "min_quantity": 50,
            "max_quantity": 99,
            "cost_per_transfer": 0.35
        }
        // ... more freight tiers
    ],
    "sizes": [],
    "sellingPriceDisplayAddOns": {}
}
```

### 6.3 Data Extraction

**From `tiersR` array:**
- Extract all quantity tiers (10-23, 24-47, 48-71, 72+)
- Get MarginDenominator (always 0.6 for DTF)
- Get LTM_Fee ($50 for 10-23 tier only)

**From `allDtfCostsR` array:**
- Lookup transfer pricing by: price_type (Small/Medium/Large) + quantity_range
- Extract unit_price for the transfer
- Extract PressingLaborCost ($2 per location for all)

**From `freightR` array:**
- Lookup freight cost by quantity
- Get cost_per_transfer for the quantity range

**From `rulesR` object:**
- Get RoundingMethod: "HalfDollarCeil_Final"

### 6.4 NO FALLBACK RULE

**CRITICAL:** If API fails, show error message. NO hardcoded pricing fallbacks.

```javascript
async function loadPricingData(styleNumber) {
    try {
        const response = await fetch(
            `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber=${styleNumber}`
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('DTF Pricing API Error:', error);

        // Show error message to user
        showErrorMessage(
            'Unable to load pricing data. Please call 253-922-5793 for assistance.'
        );

        // DO NOT use fallback data
        // DO NOT continue with calculations
        throw error;
    }
}
```

### 6.5 Garment Cost Source

**Garment base cost comes from PRODUCT API, not DTF pricing-bundle endpoint.**

The DTF pricing-bundle endpoint returns `"sizes": []` and `"sellingPriceDisplayAddOns": {}` because garment data comes from a separate product lookup.

**Assumed endpoint (verify in codebase):**
```
GET /api/products/{styleNumber}
```

This returns the base garment cost which is then used in the pricing formula.

---

## 7. Pricing Calculation Formula

### 7.1 Complete Formula

**Per-Shirt Price = ROUND_UP((Garment + Transfers + Labor + Freight + LTM), $0.50)**

### 7.2 Step-by-Step Calculation

```
Step 1: Garment with Margin
    garmentCost = (garmentBaseCost) / (marginDenominator)
    Where marginDenominator = 0.6 (from API tiersR)

Step 2: Transfer Costs (Sum of All Active Locations)
    For each active location:
        - Get location's size (Small/Medium/Large)
        - Lookup in allDtfCostsR where:
            price_type = location's size
            quantity is within min_quantity to max_quantity
        - Add unit_price to transferCosts
    transferCosts = sum of all unit_prices

Step 3: Labor Cost
    laborCost = $2.00 × (number of active locations)
    From allDtfCostsR[].PressingLaborCost

Step 4: Freight Cost
    - Count number of active locations
    - Lookup in freightR where quantity is within min_quantity to max_quantity
    - Get cost_per_transfer
    freightCost = cost_per_transfer × (number of active locations)

Step 5: Subtotal
    subtotal = garmentCost + transferCosts + laborCost + freightCost

Step 6: LTM Fee Per Shirt
    If quantity is in 10-23 tier:
        ltmFeePerShirt = $50 / exactQuantity
    Else:
        ltmFeePerShirt = $0

Step 7: Total Per Shirt (Before Rounding)
    totalBeforeRounding = subtotal + ltmFeePerShirt

Step 8: Round UP to Nearest $0.50 (HalfDollarCeil_Final)
    finalPrice = Math.ceil(totalBeforeRounding * 2) / 2
```

### 7.3 Rounding Rule Explanation

**"HalfDollarCeil_Final"** means:
- Multiply by 2
- Round UP to next integer (ceiling)
- Divide by 2

**Examples:**
- $39.67 × 2 = 79.34 → ceil(79.34) = 80 → 80 / 2 = **$40.00** ✓
- $40.01 × 2 = 80.02 → ceil(80.02) = 81 → 81 / 2 = **$40.50** ✓
- $40.49 × 2 = 80.98 → ceil(80.98) = 81 → 81 / 2 = **$40.50** ✓
- $40.50 × 2 = 81.00 → ceil(81.00) = 81 → 81 / 2 = **$40.50** ✓
- $40.51 × 2 = 81.02 → ceil(81.02) = 82 → 82 / 2 = **$41.00** ✓

**JavaScript Implementation:**
```javascript
function roundHalfDollarCeil(amount) {
    return Math.ceil(amount * 2) / 2;
}
```

---

## 8. Sample Calculations

### 8.1 Sample Calculation #1: Standard Tier (No LTM)

**Scenario:**
- Product: PC54
- Garment Base Cost: $5.50
- Quantity: 24 pieces (24-47 tier)
- Locations: Left Chest + Full Back + Right Sleeve (3 locations)

**Calculation:**

```
Step 1: Garment with Margin
    $5.50 / 0.6 = $9.17 (rounded for display)

Step 2: Transfer Costs
    Left Chest (Small, 24-47):     $5.25
    Full Back (Large, 24-47):     $12.50
    Right Sleeve (Small, 24-47):   $5.25
                                 -------
    Total:                        $23.00

Step 3: Labor
    $2.00 × 3 locations = $6.00

Step 4: Freight (24 qty falls in 10-49 range)
    $0.50 per transfer × 3 = $1.50

Step 5: Subtotal
    $9.17 + $23.00 + $6.00 + $1.50 = $39.67

Step 6: LTM Fee
    24-47 tier has LTM_Fee = 0
    $0.00

Step 7: Total Before Rounding
    $39.67 + $0.00 = $39.67

Step 8: Round to Nearest $0.50
    $39.67 × 2 = 79.34
    ceil(79.34) = 80
    80 / 2 = $40.00
```

**FINAL PRICE: $40.00 per shirt**

---

### 8.2 Sample Calculation #2: LTM Tier with Small Batch Fee

**Scenario:**
- Product: PC61
- Garment Base Cost: $6.50
- Quantity: 15 pieces (10-23 tier)
- Locations: Center Front + Center Back (2 locations)

**Calculation:**

```
Step 1: Garment with Margin
    $6.50 / 0.6 = $10.83 (rounded for display)

Step 2: Transfer Costs
    Center Front (Medium, 10-23):   $9.50
    Center Back (Medium, 10-23):    $9.50
                                  -------
    Total:                         $19.00

Step 3: Labor
    $2.00 × 2 locations = $4.00

Step 4: Freight (15 qty falls in 10-49 range)
    $0.50 per transfer × 2 = $1.00

Step 5: Subtotal
    $10.83 + $19.00 + $4.00 + $1.00 = $34.83

Step 6: LTM Fee
    10-23 tier has LTM_Fee = $50
    $50 / 15 = $3.33 per shirt

Step 7: Total Before Rounding
    $34.83 + $3.33 = $38.16

Step 8: Round to Nearest $0.50
    $38.16 × 2 = 76.32
    ceil(76.32) = 77
    77 / 2 = $38.50
```

**FINAL PRICE: $38.50 per shirt**

**NOTE:** If quantity was 10 instead of 15:
- LTM Fee = $50 / 10 = $5.00 per shirt
- Total would be $39.83 → rounds to $40.00

If quantity was 23:
- LTM Fee = $50 / 23 = $2.17 per shirt
- Total would be $37.00 → rounds to $37.00

This is why the conditional input field is critical for the 10-23 tier.

---

### 8.3 Sample Calculation #3: High Quantity with Multiple Locations

**Scenario:**
- Product: PC54
- Garment Base Cost: $5.50
- Quantity: 100 pieces (72+ tier)
- Locations: Full Front + Full Back + Left Sleeve + Right Sleeve (4 locations)

**Calculation:**

```
Step 1: Garment with Margin
    $5.50 / 0.6 = $9.17

Step 2: Transfer Costs
    Full Front (Large, 72+):      $8.00
    Full Back (Large, 72+):       $8.00
    Left Sleeve (Small, 72+):     $3.25
    Right Sleeve (Small, 72+):    $3.25
                                -------
    Total:                       $22.50

Step 3: Labor
    $2.00 × 4 locations = $8.00

Step 4: Freight (100 qty falls in 100-199 range)
    $0.25 per transfer × 4 = $1.00

Step 5: Subtotal
    $9.17 + $22.50 + $8.00 + $1.00 = $40.67

Step 6: LTM Fee
    72+ tier has LTM_Fee = 0
    $0.00

Step 7: Total Before Rounding
    $40.67 + $0.00 = $40.67

Step 8: Round to Nearest $0.50
    $40.67 × 2 = 81.34
    ceil(81.34) = 82
    82 / 2 = $41.00
```

**FINAL PRICE: $41.00 per shirt**

---

## 9. Implementation Checklist

### 9.1 Files to Create/Modify

**CSS Files:**
- ✅ `/shared_components/css/dtf-toggle-pricing.css` (NEW)
  - Toggle switch styling
  - Two-column grid layout
  - Tier button styling
  - Price display styling

**JavaScript Files:**
- ✅ `/shared_components/js/dtf-config.js` (MODIFY)
  - Update transferLocations with Location = Size model
  - Add helper functions for size lookup

- ✅ `/shared_components/js/dtf-pricing-calculator.js` (MAJOR REWRITE)
  - Remove dropdown-based rendering
  - Add toggle-based rendering
  - Implement conflict resolution logic
  - Add conditional quantity input for 10-23 tier
  - Implement pricing calculation with API data
  - Add immediate recalculation on all changes

**HTML Files:**
- ✅ `/calculators/dtf-pricing.html` (MODIFY)
  - Add CSS link for dtf-toggle-pricing.css
  - Verify container has max-width: 1400px

### 9.2 Implementation Order

**Phase 1: Setup**
1. Create `dtf-toggle-pricing.css` with all styling
2. Update `dtf-config.js` with Location = Size mapping
3. Add CSS link to `dtf-pricing.html`

**Phase 2: Calculator Core**
1. Rewrite `render()` method in dtf-pricing-calculator.js
   - Remove dropdown HTML
   - Add toggle switch HTML
   - Add tier button HTML
2. Add `renderLocationToggles()` method
3. Add `renderTierButtons()` method

**Phase 3: Logic**
1. Implement toggle click handlers with conflict resolution
2. Implement tier selection with conditional input
3. Connect to API and parse response
4. Implement pricing calculation formula
5. Add immediate recalculation triggers

**Phase 4: Testing**
1. Test all location conflict scenarios
2. Test all quantity tiers (especially 10-23 with various quantities)
3. Verify pricing calculations match sample calculations
4. Test API error handling
5. Test real-time updates

### 9.3 Testing Checklist

**Toggle Behavior Tests:**
- [ ] Click Left Chest → turns ON
- [ ] Click Left Chest again → turns OFF
- [ ] Click Left Chest, then Full Front → Left Chest turns OFF, Full Front turns ON
- [ ] Click Back of Neck, then Full Back → Back of Neck turns OFF, Full Back turns ON
- [ ] Click Left Sleeve and Right Sleeve → both stay ON (independent)
- [ ] Click Center Front with Right Sleeve ON → both stay ON (different zones)

**Quantity Tier Tests:**
- [ ] Page loads with 24-47 tier selected by default
- [ ] Click 48-71 tier → immediately shows new price
- [ ] Click 10-23 tier → shows quantity input field
- [ ] Enter 15 in quantity input → calculates with $3.33 LTM fee per shirt
- [ ] Enter 10 in quantity input → calculates with $5.00 LTM fee per shirt
- [ ] Enter 9 in quantity input → shows validation error
- [ ] Enter 24 in quantity input → shows validation error

**Pricing Calculation Tests:**
- [ ] PC54, 24 qty, Left Chest + Full Back + Right Sleeve = $40.00
- [ ] PC61, 15 qty, Center Front + Center Back = $38.50
- [ ] PC54, 100 qty, Full Front + Full Back + Left Sleeve + Right Sleeve = $41.00
- [ ] Zero locations selected → shows $0.00 or minimum garment price
- [ ] Price updates immediately on toggle click
- [ ] Price updates immediately on tier change

**API Integration Tests:**
- [ ] API loads successfully for PC54
- [ ] API loads successfully for PC61
- [ ] API failure shows error message (no fallback pricing)
- [ ] Verify transfer prices match API response
- [ ] Verify freight costs match API response
- [ ] Verify LTM fee matches API response

**UI/UX Tests:**
- [ ] Page has no excessive whitespace (container-fluid with 1400px max-width)
- [ ] Toggles have smooth animation
- [ ] Selected tier button is green
- [ ] Price display updates in real-time
- [ ] Info box about automatic sizing is visible
- [ ] Mobile responsive (test at 768px and below)

---

## 10. Key Architecture Decisions

### 10.1 Why Toggle Switches Instead of Dropdowns?

**User Experience Benefits:**
- Faster interaction (one click vs click + select)
- Visual representation of all available locations
- Immediate feedback on selection
- Better mobile experience
- Grouped by size for easy understanding

### 10.2 Why Location = Size Model?

**Business Logic:**
- Prevents confusion about which size to choose
- Matches physical reality (left chest is always small)
- Simplifies UI (no size dropdown needed)
- Reduces user errors
- Aligns with how artwork is prepared

### 10.3 Why Conditional Input Only for 10-23 Tier?

**Mathematical Necessity:**
- LTM fee of $50 divided by quantity creates significant price variance
- $50 / 10 = $5.00 per shirt
- $50 / 23 = $2.17 per shirt
- **$2.83 difference** requires exact quantity for accurate pricing

**For other tiers:**
- Pricing is consistent within the range
- Using midpoint provides reasonable estimate
- No fees that vary by exact quantity

### 10.4 Why NO Fallback Pricing?

**Data Integrity:**
- Wrong pricing is worse than no pricing
- Prevents quoting incorrect prices to customers
- Forces resolution of API issues immediately
- Maintains trust in the system

**Alternative:**
- Show error message with phone number
- Customer can call for accurate quote
- IT team alerted to API failure

---

## 11. Common Pitfalls & Solutions

### 11.1 Pitfall: Hardcoded Pricing Values

❌ **WRONG:**
```javascript
const smallTransferPrice = 5.25; // Never do this
```

✅ **CORRECT:**
```javascript
const smallTransferPrice = apiData.allDtfCostsR.find(
    item => item.price_type === 'Small' &&
           item.quantity_range === tierLabel
).unit_price;
```

### 11.2 Pitfall: Rounding at Wrong Step

❌ **WRONG:**
```javascript
const garmentCost = Math.round((baseCost / 0.6) * 100) / 100; // Don't round early
const transferCost = Math.round(transferPrice * 100) / 100;   // Don't round early
const total = garmentCost + transferCost; // Then round at end
```

✅ **CORRECT:**
```javascript
const garmentCost = baseCost / 0.6;                    // Keep full precision
const transferCost = transferPrice;                     // Keep full precision
const total = garmentCost + transferCost;              // Keep full precision
const finalPrice = Math.ceil(total * 2) / 2;          // Round ONLY at the very end
```

### 11.3 Pitfall: Not Implementing Conflict Resolution

❌ **WRONG:**
```javascript
// Allowing both Left Chest and Full Front to be active
if (clickedToggle) {
    toggles[clickedToggle] = !toggles[clickedToggle];
}
```

✅ **CORRECT:**
```javascript
// Auto-deactivate conflicting locations
if (isFrontLocation(clickedToggle)) {
    frontLocations.forEach(loc => {
        if (loc !== clickedToggle) {
            deactivate(loc);
        }
    });
}
activate(clickedToggle);
```

### 11.4 Pitfall: Forgetting to Show Conditional Input

❌ **WRONG:**
```javascript
// Treating 10-23 tier like other tiers
function selectTier(tierLabel) {
    selectedTier = tierLabel;
    calculatePrice();
}
```

✅ **CORRECT:**
```javascript
function selectTier(tierLabel, ltmFee) {
    selectedTier = tierLabel;

    if (ltmFee > 0) {
        showQuantityInput(10, 23);
        // Wait for user input before calculating
    } else {
        hideQuantityInput();
        calculatePrice();
    }
}
```

---

## 12. Maintenance & Updates

### 12.1 How to Update Transfer Pricing

**Transfer prices are controlled by the API. To update:**
1. Update prices in Caspio database
2. No code changes needed
3. Prices automatically update on next API call

### 12.2 How to Add a New Location

**To add a new location (e.g., "Left Pocket"):**

1. Add to `dtf-config.js`:
```javascript
{ value: 'left-pocket', label: 'Left Pocket', size: 'small', category: 'small' }
```

2. Add conflict rule if needed (is it a front location?)

3. Ensure API returns pricing for this location size

4. No other code changes needed - toggle will auto-render

### 12.3 How to Change Quantity Tiers

**Quantity tiers are controlled by the API. To change:**
1. Update tiersR in Caspio database
2. Update allDtfCostsR with pricing for new tiers
3. No code changes needed
4. Tier buttons automatically render from API data

---

## 13. Debugging & Troubleshooting

### 13.1 Price Not Updating

**Check:**
1. Are toggles actually changing state? (console.log the state)
2. Is calculatePrice() being called? (add console.log)
3. Is API data loaded? (console.log apiData)
4. Are you looking up the correct price_type and quantity_range?

### 13.2 Wrong Price Calculated

**Verify:**
1. Print all calculation steps to console
2. Compare to sample calculations in this document
3. Check rounding is done ONLY at final step
4. Verify API data matches expected structure

### 13.3 Toggles Not Working

**Check:**
1. Event listeners attached? (add console.log in click handler)
2. Conflict resolution running? (log which toggles are being deactivated)
3. CSS class names match JavaScript selectors?
4. Toggle state persisting in data structure?

### 13.4 API Not Loading

**Check:**
1. Network tab in dev tools - is request being made?
2. Response status code - is it 200?
3. Response body - does it match expected structure?
4. CORS issues? (should not be an issue with our proxy)
5. Style number valid? (try PC54 or PC61)

---

## 14. References

### 14.1 Related Files

- Screenshot: `/mnt/c/Users/erik/Downloads/wite space.png`
- Old config (for reference): `/shared_components/js/dtf-config.js` (before Location = Size)
- Old calculator (for reference): `/shared_components/js/dtf-pricing-calculator.js` (dropdown version)

### 14.2 API Documentation

- Full API docs: `/memory/CASPIO_API_CORE.md`
- Pricing bundle endpoint: Section on DTF pricing

### 14.3 Similar Implementations

- DTG Pricing Calculator (uses similar toggle approach)
- Screen Print Calculator (has toggle switches for colors/locations)

---

## 15. Version History

| Date       | Version | Changes                                      | Author        |
|------------|---------|----------------------------------------------|---------------|
| 2025-10-07 | 1.0     | Initial specification document created       | Claude Code   |

---

**END OF SPECIFICATION**

If you are reading this because code was lost, you now have everything you need to rebuild the DTF pricing calculator exactly as it was designed to work. Follow the implementation checklist in Section 9, and test against the sample calculations in Section 8.
