# Laser Leatherette Patch Implementation Guide

> **Created:** January 15, 2026
> **Status:** Complete and Production-Ready
> **Quote Builder:** Embroidery Quote Builder (handles embroidery, 3D puff, AND laser patches)

## Overview

Laser leatherette patches are a cap embellishment option that uses laser-engraved leatherette patches instead of embroidery. This feature was added to the existing Embroidery Quote Builder rather than creating a separate builder.

### Key Differences from Embroidery

| Aspect | Embroidery | Laser Patch |
|--------|------------|-------------|
| Per-cap upcharge | $0 (base) or $2.50 (3D puff) | $5.00 |
| Setup fee | $100 (DD-CAP digitizing) | $50 (GRT-50 design setup) |
| Stitch count | 8000 base + additional | N/A - no stitches |
| Locations | Multiple (CF, LC, RC, CB, Side) | Cap Front only |
| Additional logos | Supported | Not supported (front only) |
| Artwork services | Optional (mockup, design) | Included in setup fee |

---

## Database Requirements

### Caspio Table: `Quote_Sessions`

**Field Required:** `CapEmbellishmentType`
- **Type:** Text (255)
- **Values:** `'embroidery'`, `'3d-puff'`, `'laser-patch'`
- **Default:** `'embroidery'`

**If this field is missing:** You'll get a Caspio API error when saving quotes. Add the field manually in Caspio admin before deploying.

---

## Files Modified

### 1. Quote Builder UI
**File:** `quote-builders/embroidery-quote-builder.html`

#### Embellishment Dropdown (lines ~140-160)
```html
<select id="cap-embellishment-type" onchange="handleCapEmbellishmentChange()">
    <option value="embroidery">Flat Embroidery (Base)</option>
    <option value="3d-puff">3D Puff Embroidery (+$2.50/cap)</option>
    <option value="laser-patch">Laser Leatherette Patch (+$5/cap)</option>
</select>
```

#### Patch Options Section (lines ~175-194)
```html
<div id="cap-patch-options" style="display: none;">
    <div class="logo-form-row">
        <div class="logo-form-field">
            <label>Position</label>
            <select disabled style="opacity: 0.6; cursor: not-allowed;">
                <option value="CF" selected>Cap Front</option>
            </select>
        </div>
        <div class="digitizing-checkbox checked" onclick="toggleDigitizingCheckbox(this, 'cap-patch-setup')">
            <input type="checkbox" id="cap-patch-setup" checked>
            <div class="digitizing-checkbox-indicator">
                <i class="fas fa-check"></i>
            </div>
            <span class="digitizing-checkbox-label">Design Setup</span>
            <span class="digitizing-checkbox-price">$50</span>
        </div>
    </div>
</div>
```

#### Key JavaScript Functions

**`handleCapEmbellishmentChange()`** (lines ~829-877)
- Shows/hides patch options vs embroidery options
- Hides Artwork Services section for patches
- Hides Additional Logo section for patches
- Sets `capPrimaryLogo.needsSetup` from checkbox state

**`toggleDigitizingCheckbox()`** (lines ~787-799)
- Toggles checkbox state and CSS class
- **Critical:** Updates `capPrimaryLogo.needsSetup` for `cap-patch-setup` checkbox
- Calls `recalculatePricing()`

**`recalculatePricing()` - qty=0 handling** (lines ~4292-4316)
- Shows GRT-50 fee even when no quantities entered
- Checks for laser-patch + cap style + needsSetup

### 2. Pricing Calculator
**File:** `shared_components/js/embroidery-quote-pricing.js`

#### Patch Pricing Constants (lines ~54-57)
```javascript
this.patchUpchargePerCap = 5.00;  // Per-cap upcharge
this.patchSetupFee = 50.00;       // GRT-50 setup fee
```

#### Setup Fee Calculation (lines ~1348-1356)
```javascript
if (capEmbellishmentType === 'laser-patch') {
    const needsPatchSetup = logoConfigs?.cap?.primary?.needsSetup !== false;
    capPatchSetupFee = needsPatchSetup ? this.patchSetupFee : 0;
    capSetupFees = capPatchSetupFee;
} else {
    capSetupFees = capDigitizingCount * this.digitizingFee;
}
```

### 3. Quote Service (Save to Caspio)
**File:** `shared_components/js/embroidery-quote-service.js`

Must include `CapEmbellishmentType` in the session data sent to Caspio:
```javascript
CapEmbellishmentType: sessionData.capEmbellishmentType || 'embroidery'
```

### 4. Customer Quote View
**File:** `pages/js/quote-view.js`

#### Quote Type Display
```javascript
function getQuoteType() {
    if (session.CapEmbellishmentType === 'laser-patch') {
        return 'Laser Patch';
    }
    return 'Embroidery';
}
```

#### Quote Details Header
```javascript
function renderEmbroideryInfo() {
    if (session.CapEmbellishmentType === 'laser-patch') {
        return `Embellishment: Laser Leatherette Patch    Location: Cap Front`;
    }
    // ... embroidery logic with stitches
}
```

#### Fee Row Display
```javascript
function renderFeeRows() {
    if (session.CapEmbellishmentType === 'laser-patch') {
        // Show: GRT-50 / Laser Patch Setup
    } else {
        // Show: DD-CAP / Digitizing Setup Cap
    }
}
```

---

## Bugs Encountered & Fixes

### Bug 1: CapEmbellishmentType Not Saved to Caspio
**Symptom:** Customer quote view showed "Embroidery" instead of "Laser Patch"
**Root Cause:** Field didn't exist in Caspio table
**Fix:** Added `CapEmbellishmentType` field to `Quote_Sessions` table in Caspio admin

### Bug 2: Design Setup Toggle Not Updating Sidebar
**Symptom:** Clicking checkbox didn't show/hide $50 fee
**Root Cause:** Two issues:
1. `toggleDigitizingCheckbox()` didn't update `capPrimaryLogo.needsSetup`
2. When qty=0, pricing returned early with hardcoded `setupFees: 0`

**Fix 1:** Added to `toggleDigitizingCheckbox()`:
```javascript
if (checkboxId === 'cap-patch-setup') {
    capPrimaryLogo.needsSetup = checkbox.checked;
}
```

**Fix 2:** Modified qty=0 early return to calculate setup fee:
```javascript
if (productList.length === 0) {
    const capEmbType = getCapEmbellishmentType();
    const capHasStyle = document.querySelector('tr[data-style]:not(.child-row) .cap-badge') !== null;
    const showPatchSetup = capEmbType === 'laser-patch' && capHasStyle && capPrimaryLogo.needsSetup;
    const patchSetupFee = showPatchSetup ? 50 : 0;
    // ... pass patchSetupFee to updatePricingDisplay
}
```

### Bug 3: CSS Class Mismatch on Checkbox
**Symptom:** Toggle visual state didn't match actual state
**Root Cause:** HTML used `class="digitizing-checkbox active"` but CSS expected `.checked`
**Fix:** Changed HTML to `class="digitizing-checkbox checked"`

### Bug 4: Artwork Services Showing for Patches
**Symptom:** "Logo Mockup & Review" and "$75/hr Graphic Design" visible for patches
**Root Cause:** Section wasn't hidden when laser-patch selected
**Fix:** Added `id="artwork-services"` to section and hide/show in `handleCapEmbellishmentChange()`:
```javascript
const artworkServices = document.getElementById('artwork-services');
if (artworkServices) {
    artworkServices.style.display = embellishmentType === 'laser-patch' ? 'none' : 'block';
}
```

---

## Quote Prefix Decision

**Decision:** Keep `EMB` prefix for laser patch quotes.

**Rationale:**
- The "Type: Laser Patch" field already distinguishes quote types
- All embroidery builder quotes share one Caspio sequence
- Simpler to maintain than separate prefixes
- No additional code changes needed

---

## Testing Checklist

### Quote Builder Tests
- [ ] Add cap style (e.g., 112)
- [ ] Select "Laser Leatherette Patch" from dropdown
- [ ] Verify Artwork Services section hides
- [ ] Verify Additional Logo section hides
- [ ] Verify GRT-50 $50 fee appears in sidebar (even with qty=0)
- [ ] Toggle "Design Setup" off - fee should disappear
- [ ] Toggle "Design Setup" on - fee should reappear
- [ ] Enter qty and verify pricing calculates correctly
- [ ] Save quote successfully

### Customer Quote View Tests
- [ ] Type shows "Laser Patch"
- [ ] Quote details show "Embellishment: Laser Leatherette Patch"
- [ ] Quote details show "Location: Cap Front" (no stitches)
- [ ] Fee row shows "GRT-50 / Laser Patch Setup" at $50
- [ ] Math is correct (products + setup + LTM = subtotal)
- [ ] PDF generates correctly

---

## SKU Reference

| SKU | Description | Price | Used For |
|-----|-------------|-------|----------|
| GRT-50 | Laser Patch Setup | $50 | One-time design setup fee |
| DD-CAP | Digitizing Setup Cap | $100 | Embroidery digitizing (not for patches) |
| LTM-CAP | Less Than Minimum Caps | $50 | Applied when cap qty < 24 |

---

## Future Enhancements (Not Implemented)

1. **Multiple patch positions** - Currently front-only, could add back/side
2. **Patch size options** - Currently standard 2-4", could add size selection
3. **Separate PATCH prefix** - Could add if business needs change
4. **Garment patches** - Currently caps only, could extend to garments

---

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Project overview and rules
- [Quote System](/memory/QUOTE_SYSTEM.md) - Quote ID formats and sequences
- [Embroidery Pricing](/memory/EMBROIDERY_PRICING.md) - Pricing calculator details
