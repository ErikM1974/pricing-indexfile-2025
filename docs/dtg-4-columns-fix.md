# DTG Pricing Grid 4 Columns Fix

## Issue
The DTG pricing grid was only showing 2 columns when a product had limited sizes (e.g., only S, M, L, XL). The grid dynamically created headers based on available sizes instead of always showing the standard DTG size groups.

## Root Cause
In `/shared_components/js/dtg-adapter.js`, the `groupedHeaders` array was populated dynamically based on the sizes present in `masterBundle.uniqueSizes`. This meant:
- If a product only had S-XL sizes, only the 'S-XL' column would appear
- Missing size groups (2XL, 3XL, 4XL+) would not be displayed
- The grid layout was inconsistent across different products

## Solution
Modified the DTG adapter to always include all standard DTG size groups:

### 1. Fixed Header Creation (lines 175-192)
```javascript
// Before: Headers created dynamically based on available sizes
const groupedHeaders = [];
// ... code that only added groups if sizes existed

// After: Always include all standard groups
const standardDTGGroups = ['S-XL', '2XL', '3XL', '4XL+'];
const groupedHeaders = [...standardDTGGroups]; // Always include all standard groups
```

### 2. Updated Size Mapping (lines 186-188)
```javascript
// Added 4XL+ group mapping
'4XL': '4XL+',
'5XL': '4XL+',
'6XL': '4XL+'
```

### 3. Enhanced Price Grouping Logic (lines 212-222)
```javascript
// Added handling for 4XL+ group
} else if (group === '4XL+') {
    // For 4XL+ group, check 4XL, 5XL, 6XL
    ['4XL', '5XL', '6XL'].forEach(size => {
        if (locationPriceProfile[size] && locationPriceProfile[size][tierKey] !== undefined) {
            const price = parseFloat(locationPriceProfile[size][tierKey]);
            if (!isNaN(price) && price > maxPrice) {
                maxPrice = price;
                foundPrice = true;
            }
        }
    });
}
```

## Results
- DTG pricing grid now always displays 4 columns: S-XL, 2XL, 3XL, 4XL+
- Columns without data show $0.00 or can be styled to show "N/A"
- Consistent grid layout across all products regardless of available sizes
- Better user experience with predictable column structure

## Testing
Created test file `/test-dtg-4-columns.html` to verify:
1. Products with limited sizes (S-XL only) show all 4 columns
2. Proper price grouping for the 4XL+ category
3. Correct handling of missing size data

## Impact
- No breaking changes to existing functionality
- Improved visual consistency across all DTG products
- Better alignment with business requirements for DTG pricing display