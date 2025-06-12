# Screen Print Transparent Pricing Update

## Overview
Updated the screen print pricing display to show the true per-shirt price prominently, with setup fees clearly separated and the "all-in" price as secondary information.

## Key Changes

### 1. Hero Price Display
The main price shown is now the base shirt + printing cost, without setup fees:

```
$13.50 per shirt
shirt + printing included

with setup: $17.25/shirt
Total order: $828.00
```

### 2. Visual Hierarchy
- **Largest (48px)**: Base price per shirt ($13.50)
- **Medium (18px)**: All-in price with setup ($17.25)
- **Small (16px)**: Total order amount ($828.00)

### 3. Setup Fee Transparency
Setup fees are shown separately with clear breakdown:
```
One-time Setup Investment: $180
├─ Front (4 colors × $30): $120
└─ Back (2 colors × $30): $60
```

### 4. Impact Calculator
Shows how setup cost per shirt decreases with quantity:
```
ℹ️ Setup cost impact decreases with quantity:
• 48 shirts: +$3.75 per shirt
• 96 shirts: +$1.88 per shirt
• 144 shirts: +$1.25 per shirt
```

### 5. Quantity Savings Tool
New interactive calculator shows savings at different quantities:
```
💡 See how quantity affects your price
┌─────────────────────────────────┐
│ 48 shirts: $17.25/shirt (current)│
│ 72 shirts: $14.75/shirt Save $2.50│
│ 96 shirts: $13.88/shirt Save $3.37│
│ 144 shirts: $11.75/shirt Save $5.50│
└─────────────────────────────────┘
```

## User Benefits

1. **No Confusion**: Clear separation between product cost and setup fees
2. **Transparent Math**: Customers can see exactly how pricing works
3. **Encourages Bulk Orders**: Visual savings at higher quantities
4. **Builds Trust**: Honest pricing without hidden fees

## Technical Implementation

### Updated Files:
- `screenprint-integration.js`: New UI structure with hero pricing
- `screenprint-calculator.js`: Updated display logic
- Enhanced CSS for visual hierarchy

### New UI Elements:
- `.sp-hero-price-box`: Main pricing display container
- `.sp-base-price-display`: Large price with currency symbol
- `.sp-all-in-price`: Secondary price with setup included
- `.sp-setup-details`: Breakdown of setup fees
- `.sp-savings-calculator`: Interactive quantity comparison

## Design Decisions

1. **Base Price First**: Shows the actual product value
2. **Setup as "Investment"**: Frames one-time cost positively
3. **Dynamic Examples**: Updates based on current configuration
4. **Mobile Responsive**: Stacks nicely on small screens

## Testing
Created test files to verify:
- Proper price calculations
- Visual hierarchy
- Responsive behavior
- Event handling
- Dynamic updates

## Result
The new display makes screen print pricing transparent and easy to understand, reducing customer confusion and encouraging larger orders through clear value demonstration.