# Pricing Tiers Master Reference

**Created:** 2026-02-02
**Purpose:** Complete reference for ALL pricing tier structures across embellishment methods. Use this document to understand tier boundaries, LTM thresholds, and implementation patterns.

---

## Quick Reference Table

| Method | Tier Count | Tiers | LTM Threshold | LTM Amount |
|--------|------------|-------|---------------|------------|
| **Embroidery (Standard)** | 5 | 1-7, 8-23, 24-47, 48-71, 72+ | qty ≤ 7 | $50 |
| **Cap Embroidery** | 5 | 1-7, 8-23, 24-47, 48-71, 72+ | qty ≤ 7 | $50 |
| **DTG** | 4 | 1-23, 24-47, 48-71, 72+ | qty < 24 | $50 |
| **DTF** | 4 | 10-23, 24-47, 48-71, 72+ | qty < 24 | $50 |
| **Screen Print** | 4 | 24-36, 37-72, 73-144, 145+ | 24-36: $75, 37-72: $50 | Dual LTM |
| **Contract Embroidery** | 5 | 1-15, 16-31, 32-63, 64-127, 128+ | qty < 16 | $50 |
| **Customer-Supplied** | 7 | 1-2, 3-5, 6-11, 12-23, 24-71, 72-143, 144+ | qty < 24 | $50 |
| **Laser Tumblers (JDS)** | 5 | 1-11, 12-23, 24-119, 120-239, 240+ | N/A | N/A |

---

## Standard Embroidery & Cap Embroidery (5-Tier)

### Tier Structure (Updated Feb 2026)

| Tier | Qty Range | LTM/Setup | Surcharge | Business Reason |
|------|-----------|-----------|-----------|-----------------|
| **1-7** | 1-7 | $50 | — | Small order setup costs |
| **8-23** | 8-23 | $0 | +$4/piece | Covers handling without LTM friction |
| 24-47 | 24-47 | $0 | — | Standard production tier |
| 48-71 | 48-71 | $0 | — | Volume discount tier |
| 72+ | 72+ | $0 | — | Best pricing tier |

### Key Implementation Details

**LTM Threshold:** `qty <= 7` (NOT `< 24`)

```javascript
// CORRECT (Feb 2026+)
const hasLTM = quantity <= 7;

// WRONG (pre-Feb 2026)
const hasLTM = quantity < 24;
```

**8-23 Surcharge:** The +$4/piece is baked INTO the EmbroideryCost from the API, NOT added separately in code.

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/pricing-bundle?method=EMB` | Garment tiers, costs, rounding rules |
| `/api/pricing-bundle?method=CAP` | Cap tiers, costs |
| `/api/pricing-bundle?method=EMB-AL` | Garment additional logo tiers |
| `/api/pricing-bundle?method=CAP-AL` | Cap additional logo tiers |
| `/api/service-codes` | LTM fee, stitch rates, setup fees |
| `/api/contract-pricing` | Contract embroidery (CTR-Garmt, CTR-Cap, CTR-FB) |
| `/api/al-pricing` | AL retail pricing for embroidery pricing page |
| `/api/decg-pricing` | DECG retail pricing for embroidery pricing page |

### Implementation Files

| File | Purpose |
|------|---------|
| `shared_components/js/embroidery-quote-pricing.js` | Core pricing calculator |
| `shared_components/js/cap-quote-pricing.js` | Cap-specific pricing |
| `shared_components/js/embroidery-pricing-service.js` | Default tiers, API integration |
| `calculators/embroidery-pricing.html` | Pricing calculator UI |
| `calculators/embroidery-manual-service.js` | Manual calculator service |
| `calculators/embroidery-pricing-all/` | **3-tab unified pricing page** (Contract, AL Retail, DECG Retail) |
| `quote-builders/embroidery-quote-builder.html` | Quote builder UI |

### getTierLabel() Pattern

```javascript
getTierLabel(quantity) {
    if (quantity <= 7) return '1-7';
    if (quantity <= 23) return '8-23';
    if (quantity <= 47) return '24-47';
    if (quantity <= 71) return '48-71';
    return '72+';
}
```

---

## DTG (4-Tier)

### Tier Structure

| Tier | Qty Range | LTM | Notes |
|------|-----------|-----|-------|
| 1-23 | 1-23 | $50 | Small order tier |
| 24-47 | 24-47 | $0 | Standard tier |
| 48-71 | 48-71 | $0 | Volume tier |
| 72+ | 72+ | $0 | Best pricing |

### Key Implementation Details

**LTM Threshold:** `qty < 24`

```javascript
const hasLTM = quantity < 24;
const ltmPerUnit = hasLTM ? Math.floor((50 / quantity) * 100) / 100 : 0;
```

### API Endpoint

```
/api/pricing-bundle?method=DTG&styleNumber=PC61
```

### Implementation Files

| File | Purpose |
|------|---------|
| `shared_components/js/dtg-pricing-service.js` | Core pricing formulas |
| `shared_components/js/dtg-quote-pricing.js` | Quote-specific logic |
| `calculators/dtg-pricing.html` | Pricing calculator |
| `quote-builders/dtg-quote-builder.html` | Quote builder |

### getTierLabel() Pattern

```javascript
getTierForQuantity(quantity) {
    if (quantity < 24) return '1-23';
    if (quantity < 48) return '24-47';
    if (quantity < 72) return '48-71';
    return '72+';
}
```

---

## DTF (4-Tier, 10-Piece Minimum)

### Tier Structure

| Tier | Qty Range | LTM | Notes |
|------|-----------|-----|-------|
| 10-23 | 10-23 | $50 | Minimum 10-piece order |
| 24-47 | 24-47 | $0 | Standard tier |
| 48-71 | 48-71 | $0 | Volume tier |
| 72+ | 72+ | $0 | Best pricing |

### Key Implementation Details

**Minimum Order:** 10 pieces (unlike DTG which starts at 1)

**LTM Threshold:** `qty < 24`

### API Endpoint

```
/api/pricing-bundle?method=DTF&styleNumber=PC61
```

### Implementation Files

| File | Purpose |
|------|---------|
| `shared_components/js/dtf-pricing-service.js` | Core pricing service |
| `shared_components/js/dtf-pricing-calculator.js` | Calculator logic |
| `shared_components/js/dtf-quote-pricing.js` | Quote pricing |
| `calculators/dtf-pricing.html` | Pricing calculator |
| `quote-builders/dtf-quote-builder.html` | Quote builder |

---

## Screen Print (4-Tier, Dual LTM)

### Tier Structure

| Tier | Qty Range | LTM Fee | Notes |
|------|-----------|---------|-------|
| 24-36 | 24-36 | $75 | Minimum tier |
| 37-72 | 37-72 | $50 | Small run tier |
| 73-144 | 73-144 | $0 | Standard tier |
| 145+ | 145+ | $0 | Volume tier |

### Key Implementation Details

**Minimum Order:** 24 pieces

**Dual LTM System:** Unlike other methods with single $50 LTM:
- 24-36 pieces: $75 LTM fee
- 37-72 pieces: $50 LTM fee
- 73+ pieces: No LTM

**Setup Fee:** Separate from LTM - calculated as `screens × $30`

### API Endpoint

```
/api/pricing-bundle?method=ScreenPrint&styleNumber=PC54
```

### Implementation Files

| File | Purpose |
|------|---------|
| `shared_components/js/screenprint-pricing-service.js` | Core pricing (656 lines) |
| `shared_components/js/screenprint-quote-pricing.js` | Quote pricing |
| `calculators/screenprint-pricing.html` | Pricing calculator |
| `quote-builders/screenprint-quote-builder.html` | Quote builder |

### getTierLabel() Pattern

```javascript
getTierLabel(quantity) {
    if (quantity <= 36) return '24-36';
    if (quantity <= 72) return '37-72';
    if (quantity <= 144) return '73-144';
    return '145+';
}
```

---

## Contract Embroidery (5-Tier, Wholesale)

### Tier Structure

| Tier | Qty Range | LTM | Notes |
|------|-----------|-----|-------|
| 1-15 | 1-15 | $50 | Small wholesale order |
| 16-31 | 16-31 | $0 | Standard wholesale |
| 32-63 | 32-63 | $0 | Volume tier |
| 64-127 | 64-127 | $0 | Bulk tier |
| 128+ | 128+ | $0 | Best pricing |

### Key Implementation Details

**LTM Threshold:** `qty < 16`

**Use Case:** Wholesale/contract embroidery for other decorators

### API Endpoint

```
/api/pricing-bundle?method=EMB-CONTRACT
```

### Implementation Files

| File | Purpose |
|------|---------|
| `calculators/contract-embroidery-pricing.html` | Contract calculator |

---

## Customer-Supplied Embroidery (7-Tier)

### Tier Structure

| Tier | Qty Range | LTM | Notes |
|------|-----------|-----|-------|
| 1-2 | 1-2 | $50 | Ultra-small |
| 3-5 | 3-5 | $50 | Very small |
| 6-11 | 6-11 | $50 | Small |
| 12-23 | 12-23 | $50 | Medium-small |
| 24-71 | 24-71 | $0 | Standard |
| 72-143 | 72-143 | $0 | Volume |
| 144+ | 144+ | $0 | Bulk |

### Key Implementation Details

**LTM Threshold:** `qty < 24`

**Use Case:** Customer provides blank garments, we embroider

**More granular tiers:** Allows precise pricing for very small orders (1-2 pieces at premium)

### API Endpoint

```
/api/pricing-bundle?method=EMBC
```

---

## Laser Tumblers / JDS Industries (5-Tier)

### Tier Structure

| Tier | Qty Range | Notes |
|------|-----------|-------|
| 1-11 | 1-11 | Small order |
| 12-23 | 12-23 | Standard small |
| 24-119 | 24-119 | Standard |
| 120-239 | 120-239 | Volume |
| 240+ | 240+ | Bulk |

### Key Implementation Details

**Different Vendor:** JDS Industries (external API)

**No LTM Fee:** JDS pricing doesn't use LTM model

**Product-based:** Pricing varies by tumbler/drinkware type

### API Endpoint

```
/api/jds/products - JDS product catalog
/api/jds/pricing - JDS pricing data
```

### Implementation Files

| File | Purpose |
|------|---------|
| `calculators/laser-tumbler-pricing.html` | Laser tumbler calculator |
| `shared_components/js/jds-pricing-service.js` | JDS API integration |

---

## Implementation Patterns

### Universal getTierLabel() Template

```javascript
/**
 * Get tier label for a given quantity
 * @param {number} quantity - The order quantity
 * @returns {string} The tier label (e.g., '1-7', '24-47')
 */
getTierLabel(quantity) {
    // Define tiers in ascending order
    const tiers = [
        { max: 7, label: '1-7' },
        { max: 23, label: '8-23' },
        { max: 47, label: '24-47' },
        { max: 71, label: '48-71' },
        { max: Infinity, label: '72+' }
    ];

    for (const tier of tiers) {
        if (quantity <= tier.max) {
            return tier.label;
        }
    }
    return tiers[tiers.length - 1].label;
}
```

### LTM Calculation Pattern

```javascript
/**
 * Calculate LTM fee per unit
 * @param {number} quantity - Total order quantity
 * @param {number} threshold - LTM threshold (e.g., 7 for embroidery, 24 for DTG)
 * @param {number} ltmFee - Total LTM fee (usually $50)
 * @returns {number} LTM per unit, floored to avoid overcharging
 */
calculateLTMPerUnit(quantity, threshold, ltmFee = 50) {
    if (quantity <= threshold) {
        // Floor to cents to prevent over-charging
        return Math.floor((ltmFee / quantity) * 100) / 100;
    }
    return 0;
}
```

### API Response Handling Pattern

```javascript
/**
 * Find tier from API response
 * @param {Array} tiers - Array of tier objects from API
 * @param {number} quantity - Order quantity
 * @returns {Object|null} Matching tier object
 */
findTierForQuantity(tiers, quantity) {
    return tiers.find(tier =>
        quantity >= tier.MinQuantity &&
        quantity <= tier.MaxQuantity
    ) || tiers[tiers.length - 1]; // Fallback to highest tier
}
```

### Fallback Tier Definitions

When API is unavailable, use hardcoded fallbacks (for error display, NOT pricing):

```javascript
const EMBROIDERY_FALLBACK_TIERS = [
    { label: '1-7', min: 1, max: 7, ltm: 50 },
    { label: '8-23', min: 8, max: 23, ltm: 0 },
    { label: '24-47', min: 24, max: 47, ltm: 0 },
    { label: '48-71', min: 48, max: 71, ltm: 0 },
    { label: '72+', min: 72, max: Infinity, ltm: 0 }
];

const DTG_FALLBACK_TIERS = [
    { label: '1-23', min: 1, max: 23, ltm: 50 },
    { label: '24-47', min: 24, max: 47, ltm: 0 },
    { label: '48-71', min: 48, max: 71, ltm: 0 },
    { label: '72+', min: 72, max: Infinity, ltm: 0 }
];

const SCREENPRINT_FALLBACK_TIERS = [
    { label: '24-36', min: 24, max: 36, ltm: 75 },
    { label: '37-72', min: 37, max: 72, ltm: 50 },
    { label: '73-144', min: 73, max: 144, ltm: 0 },
    { label: '145+', min: 145, max: Infinity, ltm: 0 }
];
```

---

## Common Mistakes to Avoid

### 1. Using Wrong LTM Threshold

```javascript
// WRONG for Embroidery (pre-Feb 2026 logic)
if (quantity < 24) { applyLTM(); }

// CORRECT for Embroidery (Feb 2026+)
if (quantity <= 7) { applyLTM(); }

// CORRECT for DTG/DTF (unchanged)
if (quantity < 24) { applyLTM(); }
```

### 2. Hardcoding Tier Costs

```javascript
// WRONG - Hardcoded
const embroideryCost = 12.00;

// CORRECT - From API
const tier = findTierForQuantity(pricingData.tiers, quantity);
const embroideryCost = tier.EmbroideryCost;
```

### 3. Mixing Tier Structures Between Methods

```javascript
// WRONG - Using DTG tiers for Embroidery
const tier = getDTGTier(quantity); // Returns '1-23'
const embroideryPrice = calculateEmbroideryPrice(tier); // FAILS

// CORRECT - Use method-specific tier function
const tier = getEmbroideryTier(quantity); // Returns '1-7' or '8-23'
const embroideryPrice = calculateEmbroideryPrice(tier);
```

---

## Verification Checklist

When changing tier logic, verify these files are updated:

### Embroidery (search for '1-23' or '< 24')
- [ ] `embroidery-quote-pricing.js`
- [ ] `cap-quote-pricing.js`
- [ ] `embroidery-pricing-service.js`
- [ ] `additional-logo-embroidery-simple.js`
- [ ] `additional-logo-cap-simple.js`
- [ ] `base-quote-service.js`
- [ ] `cap-quote-service.js`
- [ ] `quote-builder-core.js`
- [ ] `embroidery-quote-invoice.js`
- [ ] `embroidery-quote-products.js`
- [ ] `cap-quote-products.js`
- [ ] `product-pricing-ui.js`
- [ ] `embroidery-quote-builder.html`
- [ ] `embroidery-pricing.html`
- [ ] `embroidery-manual-service.js`
- [ ] `cap-embroidery-pricing-service.js`

### DTG/DTF/ScreenPrint
- [ ] Method-specific pricing service
- [ ] Method-specific quote pricing
- [ ] Calculator HTML
- [ ] Quote builder HTML

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-04 | Added `/api/contract-pricing`, `/api/al-pricing`, `/api/decg-pricing` endpoints |
| 2026-02-04 | Added embroidery-pricing-all/ 3-tab page to Implementation Files |
| 2026-02-02 | Initial document created. Consolidated all pricing tier documentation. |
| 2026-02-02 | Embroidery restructured from 4-tier to 5-tier (1-7, 8-23, 24-47, 48-71, 72+) |

---

## Related Documentation

- `/memory/EMBROIDERY_PRICING_RULES.md` - Detailed embroidery formulas
- `/memory/EMBROIDERY_PRICING_2026.md` - Feb 2026 restructure details
- `/memory/DTG_PRICING_CONSISTENCY.md` - DTG pricing formulas
- `/memory/DTF_PRICING_SYSTEM.md` - DTF pricing formulas
- `/memory/SCREENPRINT_QUOTE_BUILDER.md` - Screen print pricing
- `/memory/LESSONS_LEARNED.md` - Tier-related bugs and fixes
