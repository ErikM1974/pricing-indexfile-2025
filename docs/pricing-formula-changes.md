# DTF Pricing Formula Changes Summary

## What Changed

### 1. Margin Calculation (was Markup)
- **OLD**: Garment Cost × 1.4 (40% markup)
- **NEW**: Garment Cost ÷ 0.6 (40% margin)
- **Example**: $6 shirt → OLD: $8.40 | NEW: $10.00

### 2. Labor Cost Simplified
- **OLD**: $2 base, doubles per location ($2, $4, $8, $16...)
- **NEW**: $2 per location ($2, $4, $6, $8...)
- **Example**: 3 locations → OLD: $8 | NEW: $6

### 3. Freight Added to Formula
- **NEW**: Tiered freight per transfer based on quantity
  - 10-49 qty: $1.00 per transfer
  - 50-99 qty: $0.75 per transfer
  - 100-199 qty: $0.50 per transfer
  - 200+ qty: $0.35 per transfer
- **Example**: 50 qty, 2 locations → $0.75 × 2 = $1.50 freight

## Complete Formula

```
Price Per Shirt = (Garment ÷ 0.6) + Transfers + ($2 × Locations) + (Freight × Locations) + LTM
```

## Example Calculation

**Order**: 50 shirts, $5 garment, 2 locations (1 medium, 1 left chest)

1. **Garment**: $5.00 ÷ 0.6 = $8.33
2. **Transfers**: 
   - Medium @ 50 qty = $6.50
   - Left Chest @ 50 qty = $4.00
   - Total = $10.50
3. **Labor**: $2.00 × 2 = $4.00
4. **Freight**: $0.75 × 2 = $1.50
5. **LTM**: $0 (if not set)

**Total Per Shirt**: $8.33 + $10.50 + $4.00 + $1.50 = **$24.33**

## Benefits

1. **Better Margins**: 40% margin ensures profitability
2. **Predictable Labor**: Linear scaling is easier to understand
3. **Fair Freight**: Scales appropriately with order size
4. **Transparent Pricing**: Customers can see all components