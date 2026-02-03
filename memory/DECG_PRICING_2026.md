# DECG Pricing 2026 (Customer Supplied Embroidery)

> Last Updated: 2026-02-02

## Overview

DECG (Decoration Embroidery Customer Garment) pricing applies when customers supply their own garments for embroidery. This is different from our standard embroidery pricing where we supply the garments.

## Calculator Location

`/calculators/embroidery-customer/` - Staff-facing pricing reference

## Pricing Structure

### Garments (DECG-Garmt)

| Tier | Base Price (8K) | Per 1K Above 8K | LTM Fee |
|------|-----------------|-----------------|---------|
| 1-7 | $28.00 | $1.25 | $50 |
| 8-23 | $26.00 | $1.25 | - |
| 24-47 | $24.00 | $1.25 | - |
| 48-71 | $22.00 | $1.25 | - |
| 72+ | $20.00 | $1.25 | - |

### Caps (DECG-Cap)

| Tier | Base Price (8K) | Per 1K Above 8K | LTM Fee |
|------|-----------------|-----------------|---------|
| 1-7 | $22.50 | $1.00 | $50 |
| 8-23 | $21.00 | $1.00 | - |
| 24-47 | $19.00 | $1.00 | - |
| 48-71 | $17.50 | $1.00 | - |
| 72+ | $16.00 | $1.00 | - |

### Full Back (DECG-FB)

**IMPORTANT:** Full back has a minimum of 8 pieces (no 1-7 tier) because it runs on 8-head machines.

| Tier | Rate Per 1K | Min Stitches | LTM Fee |
|------|-------------|--------------|---------|
| 8-23 | $1.40 | 25,000 | - |
| 24-47 | $1.30 | 25,000 | - |
| 48-71 | $1.25 | 25,000 | - |
| 72+ | $1.20 | 25,000 | - |

**Full Back Pricing Formula:** `(stitches / 1000) × rate`

Example: 30K stitches at 24-47 tier = 30 × $1.30 = $39.00/piece

### Full Back Price Matrix

| Stitches | 8-23 | 24-47 | 48-71 | 72+ |
|----------|------|-------|-------|-----|
| 25,000 | $35.00 | $32.50 | $31.25 | $30.00 |
| 30,000 | $42.00 | $39.00 | $37.50 | $36.00 |
| 35,000 | $49.00 | $45.50 | $43.75 | $42.00 |
| 40,000 | $56.00 | $52.00 | $50.00 | $48.00 |
| 45,000 | $63.00 | $58.50 | $56.25 | $54.00 |
| 50,000 | $70.00 | $65.00 | $62.50 | $60.00 |

## Surcharges

### Heavyweight Surcharge: +$10/piece

Applies to:
- Carhartt jackets
- Bags (totes, duffels, etc.)
- Canvas items
- Leather goods
- Difficult/thick materials

### LTM (Less Than Minimum) Fee: $50

- Applies to orders of 1-7 pieces
- Flat fee added to order total (not per piece)
- **Does NOT apply to Full Back** (min 8 pieces required)

## Caspio Database Records

Created in `Embroidery_Costs` table:

| ItemType | Records |
|----------|---------|
| DECG-Garmt | 5 (all tiers) |
| DECG-Cap | 5 (all tiers) |
| DECG-FB | 4 (8-23 through 72+, no 1-7) |

**Total: 14 records**

## Files

| File | Purpose |
|------|---------|
| `calculators/embroidery-customer/index.html` | Calculator UI |
| `calculators/embroidery-customer/embroidery-customer-calculator.js` | Pricing logic |
| `calculators/embroidery-customer/embroidery-customer-styles.css` | Styling |

## Quick Calculator Features

1. **Item Type Selection:** Garment, Cap, or Full Back
2. **Quantity Input:** With minimum validation (8 for full back)
3. **Stitch Count Input:** Defaults to 8K, min 25K for full back
4. **Heavyweight Checkbox:** Adds $10/piece
5. **Price Breakdown Display:**
   - Base price
   - Extra stitch charge (if applicable)
   - Heavyweight surcharge (if checked)
   - Unit price
   - LTM fee (if 1-7 pieces)
   - Total

## API Endpoint

```
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/decg-pricing
```

**Returns:** Pricing data with `source: "caspio"` confirming live data.

**Error Handling (Feb 2026):**
- API returns 404 if Caspio records missing (no silent fallbacks)
- Calculator shows error banner on API failure
- Wrong pricing is worse than showing an error

## Related Documentation

- `/memory/EMBROIDERY_PRICING_2026.md` - Standard embroidery pricing (we supply garments)
- `/memory/PRICING_TIERS_MASTER_REFERENCE.md` - All pricing tier structures
