# Message to Caspio-Pricing-Proxy - Embroidery Cost Increase

**Date**: January 2, 2026
**From**: Claude (Pricing Index File 2025 frontend)
**Subject**: 2026 Embroidery Cost Increase - $1.00 Across the Board

---

## Summary

Please update the `Embroidery_Costs` table in Caspio to increase all `EmbroideryCost` values by **$1.00**.

This complements the margin update (0.6 → 0.57) to ensure all products see a price increase, including low-cost items where rounding previously absorbed the margin change.

---

## Updates Required

### Shirts (EmbroideryCostID 1-4)

| ID | ItemType | TierLabel | Current | New Value |
|----|----------|-----------|---------|-----------|
| 1 | Shirt | 1-23 | 15.0000 | **16.0000** |
| 2 | Shirt | 24-47 | 13.0000 | **14.0000** |
| 3 | Shirt | 48-71 | 12.0000 | **13.0000** |
| 4 | Shirt | 72+ | 11.0000 | **12.0000** |

### Caps (EmbroideryCostID 9-12)

| ID | ItemType | TierLabel | Current | New Value |
|----|----------|-----------|---------|-----------|
| 9 | Cap | 1-23 | 12.0000 | **13.0000** |
| 10 | Cap | 24-47 | 12.0000 | **13.0000** |
| 11 | Cap | 48-71 | 10.0000 | **11.0000** |
| 12 | Cap | 72+ | 8.5000 | **9.5000** |

### Alphabroder Shirts (EmbroideryCostID 17-20)

| ID | ItemType | TierLabel | Current | New Value |
|----|----------|-----------|---------|-----------|
| 17 | AL | 1-23 | 12.5000 | **13.5000** |
| 18 | AL | 24-47 | 11.5000 | **12.5000** |
| 19 | AL | 48-71 | 9.5000 | **10.5000** |
| 20 | AL | 72+ | 8.5000 | **9.5000** |

### Alphabroder Caps (EmbroideryCostID 21-24)

| ID | ItemType | TierLabel | Current | New Value |
|----|----------|-----------|---------|-----------|
| 21 | AL-CAP | 1-23 | 6.7500 | **7.7500** |
| 22 | AL-CAP | 24-47 | 5.7500 | **6.7500** |
| 23 | AL-CAP | 48-71 | 5.5000 | **6.5000** |
| 24 | AL-CAP | 72+ | 5.2500 | **6.2500** |

---

## Business Rationale

1. **Margin change alone** (40% → 43%) was absorbed by CeilDollar rounding on cheap items
2. **PC54 t-shirt** saw $0 increase from margin change due to rounding
3. **$1 embroidery increase** ensures ALL products see a price increase
4. **Combined effect**: Cheap items +$1, expensive items +$4 to +$9

---

## Expected Price Impact (Combined with 43% Margin)

| Product | Base Cost | 2025 Price (72+) | 2026 Price (72+) | Total Increase |
|---------|-----------|------------------|------------------|----------------|
| PC54 T-Shirt | $2.85 | $16 | $17 | +$1 |
| Richardson 112 Cap | $6.30 | $19 | $21 | +$2 |
| J790 Jacket | $31.66 | $64 | $68 | +$4 |
| CT104670 Shoreline | $96.88 | $173 | $182 | +$9 |

---

## Implementation

Update the `EmbroideryCost` column in the Caspio `Embroidery_Costs` table for all 16 records listed above.

**No code changes required** - the API will automatically return new values.

---

## Verification

After update, verify with:
```bash
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=EMB&styleNumber=PC54&refresh=true"
```

Look for `EmbroideryCost` values in `allEmbroideryCostsR` array:
- 72+ tier should show `11` → `12`
- 24-47 tier should show `13` → `14`

---

**TL;DR**: Add $1.00 to all 16 EmbroideryCost values in Caspio to ensure price increases on all products.
