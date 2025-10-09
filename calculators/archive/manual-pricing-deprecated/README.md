# Manual Pricing Calculator Files - DEPRECATED

**Date Archived**: October 9, 2025
**Status**: ⚠️ DEPRECATED - Do Not Use

---

## Why These Files Were Archived

These standalone manual pricing calculator pages have been **deprecated and replaced** with a more efficient system:

### Old System (Archived Here)
- ❌ Separate HTML page for each calculator type
- ❌ Duplicate code across 5+ files
- ❌ Manual maintenance required for each file
- ❌ Inconsistent UX across calculators
- ❌ Hard to add new calculator types

### New System (Active)
- ✅ **Single dropdown interface** on Staff Dashboard
- ✅ **Modal-based cost input** with validation
- ✅ **Redirects to main pricing pages** with `?manualCost` parameter
- ✅ **Centralized pricing logic** in main calculator pages
- ✅ **Easy to maintain** - one place to update

---

## Archived Files

| File | Original Purpose | Replacement |
|------|-----------------|-------------|
| `dtg-manual-pricing.html` | Manual DTG pricing | `/pricing/dtg?manualCost=X` |
| `dtf-manual-pricing.html` | Manual DTF pricing | `/pricing/dtf?manualCost=X` |
| `embroidery-manual-pricing.html` | Manual embroidery pricing | `/pricing/embroidery?manualCost=X` |
| `cap-embroidery-manual.html` | Manual cap embroidery pricing | `/pricing/cap-embroidery?manualCost=X` |
| `screenprint-manual-pricing.html` | Manual screen print pricing | `/pricing/screen-print?manualCost=X` |

---

## How to Use Manual Pricing Now

### For Staff Dashboard Users:

1. Go to **Staff Dashboard** → Quick Access section
2. Click **"📋 Manual Pricing Calculator"** dropdown button
3. Select calculator type (DTG, DTF, Embroidery, etc.)
4. Enter base garment cost in modal popup
5. Click "Calculate Pricing"
6. System redirects to main pricing page in manual mode

### For Direct URL Access:

You can still use manual pricing directly via URL:

```
DTG:        /pricing/dtg?manualCost=6.25
DTF:        /pricing/dtf?manualCost=8.00
Embroidery: /pricing/embroidery?manualCost=8.50
Cap:        /pricing/cap-embroidery?manualCost=4.75
Screen:     /pricing/screen-print?manualCost=8.50
```

**Example**:
`https://teamnwca.com/pricing/embroidery?manualCost=8.50`

---

## Technical Details

### Why the Change?

**Single Source of Truth**: All pricing calculators now:
- Use the same pricing service (`generateManualPricingData()` method)
- Have consistent UI/UX
- Share the same bug fixes and improvements
- Support both catalog products AND manual pricing

**Maintenance Benefits**:
- Update pricing logic once (not 5+ times)
- Add new features to all calculators at once
- Consistent validation and error handling
- Easier testing and debugging

### How Manual Mode Works:

```javascript
// URL Detection in Main Pricing Pages
const urlParams = new URLSearchParams(window.location.search);
const manualCost = urlParams.get('manualCost') || urlParams.get('cost');

if (manualCost && !isNaN(parseFloat(manualCost))) {
    // Load manual pricing mode
    loadManualPricing(parseFloat(manualCost));
} else {
    // Normal product loading
    loadProduct(styleNumber);
}
```

All main pricing pages (`dtg-pricing.html`, `embroidery-pricing.html`, etc.) check for the `manualCost` URL parameter and automatically switch to manual mode.

---

## Migration Timeline

| Date | Action |
|------|--------|
| **Oct 6, 2025** | Modal system added to staff dashboard |
| **Oct 9, 2025** | Dropdown UI implemented to replace buttons |
| **Oct 9, 2025** | Old manual calculator files moved to archive |
| **Future** | Files may be deleted after 90-day retention period |

---

## Recovery Instructions

If you need to reference the old code for any reason:

1. Files are preserved in this archive folder
2. Can be accessed via:
   ```
   /calculators/archive/manual-pricing-deprecated/
   ```
3. **Do not link to these files** - they are not maintained
4. Copy code if needed, but use new system for production

---

## Contact

Questions about manual pricing system:
- **Erik Mickelson** - Operations Manager
- **Phone**: 253-922-5793
- **Email**: erik@nwcustomapparel.com

For technical questions about the new system:
- See documentation: `/docs/MANUAL_PRICING_DROPDOWN_DESIGN.md`
- See staff guide: `/docs/MANUAL_PRICING_MODE_STAFF_GUIDE.md`

---

**⚠️ WARNING**: These archived files are for reference only. Do not use in production. Always use the new dropdown system on the Staff Dashboard.
