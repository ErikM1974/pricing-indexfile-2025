# Screen Print Quote Builder - Final Pricing Display Code

**Date**: 2025-01-12
**Purpose**: Add per-size final pricing with LTM fee to quote summary
**User Request**: "How much is a size XL with the small batch fee?"

## Overview

This document contains the complete code changes needed to show final prices (including Small Batch Fee/LTM) for each size group in the screen print quote builder summary.

## Changes Needed

### 1. Add Final Price Calculation to Each Size Group

**Location**: `quote-builders/screenprint-quote-builder.html`, Lines 2789-2812

**Current Code** (Lines 2789-2812):
```javascript
const hasSafetyStripes = group.safetyStripes > 0;
const hasAdditional = group.additionalCost > 0;

return `
    <div class="size-pricing-detail">
        <div class="size-label" style="font-weight: 600; margin-bottom: 4px;">
            ${sizeBreakdownList} <span style="color: #666; font-weight: 400;">(${group.quantity} total)</span>
        </div>
        <div class="price-calculation">
            <span class="base-price">$${group.basePrice.toFixed(2)}</span>
            ${hasSafetyStripes ? `
                <span class="price-plus">+</span>
                <span class="safety-stripes">$${group.safetyStripes.toFixed(2)} safety stripes</span>
            ` : ''}
            ${hasAdditional ? `
                <span class="price-plus">+</span>
                <span class="additional-loc">$${group.additionalCost.toFixed(2)} add'l locations</span>
            ` : ''}
            <span class="price-equals">=</span>
            <span class="unit-total">$${group.totalUnitPrice.toFixed(2)}/pc</span>
            <span class="size-subtotal">→ $${group.subtotal.toFixed(2)}</span>
        </div>
    </div>
`;
```

**Replace With**:
```javascript
const hasSafetyStripes = group.safetyStripes > 0;
const hasAdditional = group.additionalCost > 0;

// Calculate final price with LTM for this size group
const finalUnitPriceWithLTM = group.totalUnitPrice + ltmImpactPerShirt;
const finalSubtotalWithLTM = finalUnitPriceWithLTM * group.quantity;

return `
    <div class="size-pricing-detail">
        <div class="size-label" style="font-weight: 600; margin-bottom: 4px;">
            ${sizeBreakdownList} <span style="color: #666; font-weight: 400;">(${group.quantity} total)</span>
        </div>
        <div class="price-calculation">
            <span class="base-price">$${group.basePrice.toFixed(2)}</span>
            ${hasSafetyStripes ? `
                <span class="price-plus">+</span>
                <span class="safety-stripes">$${group.safetyStripes.toFixed(2)} safety stripes</span>
            ` : ''}
            ${hasAdditional ? `
                <span class="price-plus">+</span>
                <span class="additional-loc">$${group.additionalCost.toFixed(2)} add'l locations</span>
            ` : ''}
            <span class="price-equals">=</span>
            <span class="unit-total">$${group.totalUnitPrice.toFixed(2)}/pc</span>
            <span class="size-subtotal">→ $${group.subtotal.toFixed(2)}</span>
        </div>
        ${ltmFee > 0 ? `
            <div class="final-price-with-ltm" style="margin-top: 8px; padding: 8px 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #2e7d32;">
                    <i class="fas fa-plus-circle"></i>
                    <span>Small Batch Fee: <strong>+$${ltmImpactPerShirt.toFixed(2)}/pc</strong></span>
                </div>
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #4caf50; font-weight: 600; font-size: 1rem; color: #1b5e20;">
                    <span>Final Price: $${finalUnitPriceWithLTM.toFixed(2)}/pc</span>
                    <span style="margin-left: 12px; color: #2e7d32;">→ $${finalSubtotalWithLTM.toFixed(2)} total</span>
                </div>
            </div>
        ` : ''}
    </div>
`;
```

**What This Does**:
- Adds 3 lines to calculate `finalUnitPriceWithLTM` and `finalSubtotalWithLTM`
- Adds green box showing "+$X.XX/pc" Small Batch Fee
- Shows final price per piece and total for that size group
- Only displays when `ltmFee > 0`

---

### 2. Add Final Pricing Summary Table

**Location**: `quote-builders/screenprint-quote-builder.html`, After Line 2817 (inside the `</div>` closing the pricing breakdown)

**Insert This Code** (between lines 2817 and 2819):
```javascript

                            ${ltmFee > 0 ? `
                            <!-- Final Pricing Summary Table -->
                            <div class="final-pricing-summary" style="margin-top: 1.5rem; padding: 1rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; border-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #0c4a6e; font-weight: 700; font-size: 1.1rem;">
                                    <i class="fas fa-table" style="color: #0ea5e9;"></i>
                                    <span>Quick Reference: Final Prices with Small Batch Fee</span>
                                </div>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
                                        <thead>
                                            <tr style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white;">
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Size(s)</th>
                                                <th style="padding: 0.75rem; text-align: right; font-weight: 600;">Quantity</th>
                                                <th style="padding: 0.75rem; text-align: right; font-weight: 600;">Base Price</th>
                                                <th style="padding: 0.75rem; text-align: right; font-weight: 600;">+ Small Batch</th>
                                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; background: #0c4a6e;">Final Price/pc</th>
                                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; background: #0c4a6e;">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(() => {
                                                // Group sizes by their total unit price (same logic as size breakdown)
                                                const priceGroups = {};
                                                const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

                                                Object.entries(p.sizesPricing).forEach(([size, pricing]) => {
                                                    const totalUnitPrice = pricing.basePrice + pricing.safetyStripesPerPiece + p.additionalCost;
                                                    const priceKey = totalUnitPrice.toFixed(2);

                                                    if (!priceGroups[priceKey]) {
                                                        priceGroups[priceKey] = {
                                                            sizes: {},
                                                            quantity: 0,
                                                            totalUnitPrice: totalUnitPrice
                                                        };
                                                    }
                                                    priceGroups[priceKey].sizes[size] = pricing.quantity;
                                                    priceGroups[priceKey].quantity += pricing.quantity;
                                                });

                                                // Generate table rows
                                                return Object.values(priceGroups)
                                                    .sort((a, b) => a.totalUnitPrice - b.totalUnitPrice)
                                                    .map((group, index) => {
                                                        const sortedSizes = Object.entries(group.sizes)
                                                            .sort(([sizeA], [sizeB]) => sizeOrder.indexOf(sizeA) - sizeOrder.indexOf(sizeB));

                                                        const sizeBreakdownList = sortedSizes
                                                            .map(([size, qty]) => \`\${size}: \${qty}\`)
                                                            .join(', ');

                                                        const finalUnitPriceWithLTM = group.totalUnitPrice + ltmImpactPerShirt;
                                                        const finalSubtotalWithLTM = finalUnitPriceWithLTM * group.quantity;

                                                        const rowStyle = index % 2 === 0
                                                            ? 'background: #f8fafc;'
                                                            : 'background: white;';

                                                        return \`
                                                            <tr style="\${rowStyle}">
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; font-weight: 500;">\${sizeBreakdownList}</td>
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right;">\${group.quantity}</td>
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: 'Courier New', monospace;">$\${group.totalUnitPrice.toFixed(2)}</td>
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right; color: #f59e0b; font-weight: 600; font-family: 'Courier New', monospace;">+$\${ltmImpactPerShirt.toFixed(2)}</td>
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 1.05rem; color: #0c4a6e; background: #e0f2fe; font-family: 'Courier New', monospace;">$\${finalUnitPriceWithLTM.toFixed(2)}</td>
                                                                <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0c4a6e; background: #e0f2fe; font-family: 'Courier New', monospace;">$\${finalSubtotalWithLTM.toFixed(2)}</td>
                                                            </tr>
                                                        \`;
                                                    }).join('');
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fff; border: 1px solid #0ea5e9; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #0c4a6e;">
                                    <i class="fas fa-lightbulb" style="color: #f59e0b;"></i>
                                    <span><strong>Note:</strong> Final prices include the $${ltmFee.toFixed(2)} Small Batch Fee distributed across ${p.quantity} pieces ($${ltmImpactPerShirt.toFixed(2)} per piece).</span>
                                </div>
                            </div>
                            ` : ''}
```

**What This Does**:
- Creates a clean summary table showing all size groups
- Displays: Size(s), Quantity, Base Price, + Small Batch Fee, Final Price/pc, Total
- Blue theme with alternating row colors for readability
- Highlighted "Final Price/pc" column to answer user's question directly
- Only displays when `ltmFee > 0`

---

## Visual Result

### Before:
```
Size & Options Breakdown
XL: 15 pieces (15 total)
$28.50 + $0 safety stripes + $3.00 add'l locations = $31.50/pc → $472.50
```
User asks: "How much is a size XL with the small batch fee?" → Must do math

### After:
```
Size & Options Breakdown
XL: 15 pieces (15 total)
$28.50 + $0 safety stripes + $3.00 add'l locations = $31.50/pc → $472.50

┌─────────────────────────────────────────────────────┐
│ ➕ Small Batch Fee: +$1.11/pc                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Final Price: $32.61/pc → $489.15 total             │
└─────────────────────────────────────────────────────┘

Quick Reference: Final Prices with Small Batch Fee
┌──────────┬─────┬────────┬────────────┬──────────────┬─────────┐
│ Size(s)  │ Qty │  Base  │ + Batch    │ Final/pc     │  Total  │
├──────────┼─────┼────────┼────────────┼──────────────┼─────────┤
│ XL: 15   │ 15  │ $31.50 │ +$1.11     │ $32.61       │ $489.15 │
└──────────┴─────┴────────┴────────────┴──────────────┴─────────┘
```

Now the answer is crystal clear: **XL costs $32.61 per piece** (including Small Batch Fee)

---

## Implementation Steps

1. **First Edit**: Replace lines 2789-2812 with the expanded size group code
2. **Second Edit**: Insert the summary table code after line 2817
3. **Test**: View a quote with 30-45 pieces (triggers Small Batch Fee) and multiple sizes

---

## Testing Scenarios

### Test Case 1: 30 Pieces with Single Size
- Should show green box with final price on that size
- Should show summary table with one row

### Test Case 2: 45 Pieces with Multiple Sizes (User's Example)
- S: 5, M: 5, L: 10, XL: 15, 2XL: 5, 3XL: 3, 6XL: 2
- Should group by price point (standard vs upcharge sizes)
- Should show clear final pricing for XL: $32.61/pc
- Summary table should have 2-3 rows depending on price groups

### Test Case 3: 73+ Pieces (No LTM)
- Green boxes should NOT appear
- Summary table should NOT appear
- Breakdown remains clean and simple

---

## Key Variables Available

From the surrounding code context:

```javascript
// Already calculated (line 2678)
const ltmImpactPerShirt = ltmFee > 0 && totalQuantity > 0 ? ltmFee / totalQuantity : 0;

// Available in scope:
ltmFee              // Total LTM fee (e.g., $50.00 or $75.00)
totalQuantity       // Total pieces in order
p.quantity          // Pieces for this product/color
p.sizesPricing      // Object with size-by-size pricing details
p.additionalCost    // Cost per piece for additional locations

// Available in size group loop:
group.totalUnitPrice    // Base price per piece for this size group
group.quantity          // Total pieces in this size group
group.sizes             // Object mapping size to quantity (e.g., {XL: 15})
```

---

## Notes

- All template literals use backticks: \`\`
- All variables are accessed with `${}`
- Nested template literals need escaped backticks: \\\`
- The code is inside a `.map()` function returning HTML strings
- `ltmFee > 0` condition ensures features only show when Small Batch Fee applies

---

**Status**: Ready to implement
**Estimated Time**: 5 minutes
**Risk Level**: Low (only adds new display, doesn't change calculations)
