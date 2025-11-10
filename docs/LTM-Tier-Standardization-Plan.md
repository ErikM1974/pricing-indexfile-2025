# LTM Quantity Tier Standardization Plan

**Date:** 2025-10-09
**Goal:** Standardize Less-Than-Minimum (LTM) quantity tier display across DTG, DTF, and Screen Print pricing calculators to match the DTG calculator's clean, user-friendly design.

---

## 📋 Requirements Summary

### Confirmed Design Decisions:
1. ✅ **Screen Print Tiers:** Keep exact range labels (24-36, 37-72) but style like DTG
2. ✅ **DTF Tier Range:** Keep "10-23 pieces" and improve styling to match DTG
3. ✅ **Fee Display:** Show exact fee amount in button label (e.g., "+ $50 Small Batch Fee")
4. ✅ **Tier Behavior:** Copy DTG's behavior exactly - input box slides down BELOW button when clicked
5. ✅ **Default State:** Start with 24-47 tier selected (clean view, no input box visible initially)

---

## 🎯 Current State Analysis

### ✅ DTG Pricing Calculator (Our Model)
**File:** `/calculators/dtg-pricing.html`
**CSS:** `/shared_components/css/dtg-ltm-quantity-input.css`

**What Makes It Great:**
```html
<!-- Tier Button Structure -->
<button class="tier-button" id="tier-ltm" data-tier="1-23">
    Less than 24 pieces<br>
    <small style="font-size: 11px;">+ $50 Small Batch Fee</small>
</button>

<!-- Quantity Input Container (appears on click) -->
<div class="dtg-quantity-input-container" id="dtg-ltm-quantity-container" style="display: none;">
    <label class="dtg-quantity-input-label">
        <i class="fas fa-calculator"></i> Enter Exact Quantity (1-23 pieces):
    </label>
    <input type="number" id="dtg-ltm-quantity-input"
           class="dtg-quantity-input" min="1" max="23" value="12">
    <small class="dtg-quantity-hint">
        <i class="fas fa-info-circle"></i>
        Required for accurate $50 fee distribution:
        <strong id="dtg-ltm-fee-calc">$50 ÷ 12 = $4.17/shirt</strong>
    </small>
</div>
```

**Key Features:**
- ✅ Clean separation: Button is just a button, input is separate
- ✅ Slide-down animation with green gradient background
- ✅ Real-time fee calculation display ($50 ÷ quantity = $X.XX/shirt)
- ✅ Professional styling with icons and clear labels
- ✅ Mobile responsive
- ✅ Default state: 24-47 tier selected (clean, no input visible)

---

## 🔧 DTF Pricing Calculator (Needs Update)

### Current Implementation:
**File:** `/shared_components/js/dtf-pricing-calculator.js`
**Method:** `renderTierButtons()` (lines 382-419)

**Current Tier Structure:**
```javascript
const tiers = [
    { value: '10-23', label: '10-23 pieces' },    // LTM tier with $50 fee
    { value: '24-47', label: '24-47 pieces' },
    { value: '48-71', label: '48-71 pieces' },
    { value: '72+', label: '72+ pieces' }
];
```

**Current HTML Generated:**
```html
<button class="dtf-tier-button" data-tier="10-23">
    10-23 pieces
</button>

<div class="dtf-quantity-input-container">
    <label class="dtf-quantity-input-label">Enter Exact Quantity (10-23):</label>
    <input type="number" id="dtf-exact-quantity" min="10" max="23" value="12" />
    <small class="dtf-quantity-hint">
        <i class="fas fa-info-circle"></i> Required for accurate LTM fee calculation
    </small>
</div>
```

### ❌ Problems:
1. No fee amount shown in button label
2. Input container always rendered (just hidden/shown), not conditionally created
3. Missing real-time fee calculation display
4. Styling doesn't match DTG's green gradient theme
5. Label doesn't say "pieces" consistently

### ✅ Required Changes:

#### 1. Update Tier Button Labels (Line ~395):
```javascript
const tiers = [
    {
        value: '10-23',
        label: '10-23 pieces',
        isLTM: true,
        ltmFee: 50.00,
        ltmLabel: '+ $50 Small Batch Fee'
    },
    { value: '24-47', label: '24-47 pieces' },
    { value: '48-71', label: '48-71 pieces' },
    { value: '72+', label: '72+ pieces' }
];
```

#### 2. Update Button HTML Generation (Line ~397):
```javascript
tiers.forEach(tier => {
    const isSelected = this.currentData.selectedTier === tier.value;

    html += `
        <button class="dtf-tier-button universal-tier-button ${isSelected ? 'selected' : ''}"
                data-tier="${tier.value}">
            ${tier.label}
            ${tier.isLTM ? `<br><small style="font-size: 11px; opacity: 0.9;">${tier.ltmLabel}</small>` : ''}
        </button>
    `;
});
```

#### 3. Update Input Container HTML (Line ~407):
```javascript
// Add conditional quantity input for 10-23 tier ONLY
const showInput = this.currentData.selectedTier === '10-23';
const currentQty = this.currentData.quantity >= 10 && this.currentData.quantity <= 23
    ? this.currentData.quantity
    : 12;

html += `
    <div class="dtf-quantity-input-container universal-quantity-input-container ${showInput ? 'show' : ''}"
         id="dtf-ltm-quantity-container"
         style="display: ${showInput ? 'flex' : 'none'};">
        <label class="dtf-quantity-input-label universal-quantity-input-label">
            <i class="fas fa-calculator"></i> Enter Exact Quantity (10-23 pieces):
        </label>
        <input type="number"
               id="dtf-exact-quantity"
               class="dtf-quantity-input universal-quantity-input"
               min="10"
               max="23"
               value="${currentQty}"
               placeholder="Enter 10-23">
        <small class="dtf-quantity-hint universal-quantity-hint">
            <i class="fas fa-info-circle"></i>
            Required for accurate $50 fee distribution:
            <strong id="dtf-ltm-fee-calc">$50 ÷ ${currentQty} = $${(50/currentQty).toFixed(2)}/piece</strong>
        </small>
    </div>
`;
```

#### 4. Add Fee Calculation Update Function (Add new method):
```javascript
updateDTFLTMFeeDisplay(quantity) {
    const feeCalc = document.getElementById('dtf-ltm-fee-calc');
    if (feeCalc && quantity >= 10 && quantity <= 23) {
        const ltmFee = 50.00;
        const feePerPiece = (ltmFee / quantity).toFixed(2);
        feeCalc.textContent = `$50 ÷ ${quantity} = $${feePerPiece}/piece`;
    }
}
```

#### 5. Update Event Listener for Input (Line ~640):
```javascript
this.container.addEventListener('input', (e) => {
    if (e.target.id === 'dtf-exact-quantity') {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 10 && value <= 23) {
            this.currentData.quantity = value;
            this.updateDTFLTMFeeDisplay(value);  // NEW: Update fee display
            this.updatePricingDisplay();
        }
    }
});
```

#### 6. Update Tier Selection Handler (Line ~447):
```javascript
handleTierSelection(tierValue) {
    this.currentData.selectedTier = tierValue;

    // Set quantity based on tier
    if (tierValue === '10-23') {
        // Keep current quantity if in range, otherwise set to 12
        if (this.currentData.quantity < 10 || this.currentData.quantity > 23) {
            this.currentData.quantity = 12;
        }
    } else if (tierValue === '24-47') {
        this.currentData.quantity = 24;
    } else if (tierValue === '48-71') {
        this.currentData.quantity = 48;
    } else if (tierValue === '72+') {
        this.currentData.quantity = 72;
    }

    // Re-render tier buttons (this will show/hide input container)
    this.renderTierButtons();
    this.updatePricingDisplay();
}
```

#### 7. Set Default Tier (Line ~22):
```javascript
this.currentData = {
    garmentCost: 0,
    quantity: 24,              // Changed from 10 to 24
    selectedTier: '24-47',     // Keep as default (matches requirement #5)
    selectedLocations: new Set(),
    autoCalculateLTM: true
};
```

---

## 🔧 Screen Print Pricing Calculator (Needs Update)

### Current Implementation:
**File:** `/shared_components/js/screenprint-pricing-v2.js`
**Method:** `createUI()` (lines 141-300)

**Current Tier Structure:**
```javascript
<button class="sp-tier-button" id="sp-tier-24-36" data-tier="24-36">
    <div class="sp-tier-label">24-36 pieces</div>
    <div class="sp-tier-fee">$75 Small Batch Fee</div>
    <div class="sp-tier-hint">
        <i class="fas fa-calculator"></i>
        Click to set exact quantity
    </div>

    <!-- Embedded input (BAD - not like DTG) -->
    <div class="sp-tier-qty-input-wrapper" style="display: none;">
        <label class="sp-qty-label">Exact Qty:</label>
        <input type="number" min="24" max="36" value="24" id="sp-qty-tier-1">
    </div>
    <small class="sp-ltm-calc" style="display: none;">
        $75 fee = $<span id="sp-ltm-calc-1">3.13</span>/shirt
    </small>
</button>
```

### ❌ Problems:
1. Input embedded INSIDE button (not DTG pattern)
2. Fee display structure different from DTG
3. Two LTM tiers to handle (24-36 and 37-72)
4. Styling classes don't match universal pattern

### ✅ Required Changes:

#### 1. Update Tier Button HTML Structure (Lines ~225-274):
```javascript
<!-- Tier 1: 24-36 pieces with $75 fee -->
<button class="sp-tier-button universal-tier-button"
        id="sp-tier-24-36"
        data-tier="24-36">
    24-36 pieces<br>
    <small style="font-size: 11px; opacity: 0.9;">+ $75 Small Batch Fee</small>
</button>

<!-- Quantity Input Container for Tier 1 (separate from button) -->
<div class="sp-quantity-input-container universal-quantity-input-container"
     id="sp-ltm-quantity-container-1"
     style="display: none;">
    <label class="sp-quantity-input-label universal-quantity-input-label">
        <i class="fas fa-calculator"></i> Enter Exact Quantity (24-36 pieces):
    </label>
    <input type="number"
           id="sp-qty-tier-1"
           class="sp-quantity-input universal-quantity-input"
           min="24"
           max="36"
           value="24"
           placeholder="Enter 24-36">
    <small class="sp-quantity-hint universal-quantity-hint">
        <i class="fas fa-info-circle"></i>
        Required for accurate $75 fee distribution:
        <strong id="sp-ltm-calc-1">$75 ÷ 24 = $3.13/shirt</strong>
    </small>
</div>

<!-- Tier 2: 37-72 pieces with $50 fee -->
<button class="sp-tier-button universal-tier-button selected"
        id="sp-tier-37-72"
        data-tier="37-72">
    37-72 pieces<br>
    <small style="font-size: 11px; opacity: 0.9;">+ $50 Small Batch Fee</small>
</button>

<!-- Quantity Input Container for Tier 2 (separate from button) -->
<div class="sp-quantity-input-container universal-quantity-input-container"
     id="sp-ltm-quantity-container-2"
     style="display: none;">
    <label class="sp-quantity-input-label universal-quantity-input-label">
        <i class="fas fa-calculator"></i> Enter Exact Quantity (37-72 pieces):
    </label>
    <input type="number"
           id="sp-qty-tier-2"
           class="sp-quantity-input universal-quantity-input"
           min="37"
           max="72"
           value="37"
           placeholder="Enter 37-72">
    <small class="sp-quantity-hint universal-quantity-hint">
        <i class="fas fa-info-circle"></i>
        Required for accurate $50 fee distribution:
        <strong id="sp-ltm-calc-2">$50 ÷ 37 = $1.35/shirt</strong>
    </small>
</div>

<!-- Tier 3: 73-144 pieces (no fee) -->
<button class="sp-tier-button universal-tier-button"
        id="sp-tier-73-144"
        data-tier="73-144">
    73-144 pieces
</button>

<!-- Tier 4: 145-576 pieces (no fee) -->
<button class="sp-tier-button universal-tier-button"
        id="sp-tier-145-576"
        data-tier="145-576">
    145-576 pieces
</button>
```

#### 2. Update Tier Click Handlers (Lines ~404-427):
```javascript
const tierButtons = [
    { id: 'sp-tier-24-36', tier: '24-36', qty: 24, hasLTM: true, containerId: 'sp-ltm-quantity-container-1' },
    { id: 'sp-tier-37-72', tier: '37-72', qty: 37, hasLTM: true, containerId: 'sp-ltm-quantity-container-2' },
    { id: 'sp-tier-73-144', tier: '73-144', qty: 73, hasLTM: false },
    { id: 'sp-tier-145-576', tier: '145-576', qty: 145, hasLTM: false }
];

tierButtons.forEach(({id, tier, qty, hasLTM, containerId}) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
        // Select this tier
        this.selectQuantityTier(tier, qty);

        // Hide all LTM containers first
        document.getElementById('sp-ltm-quantity-container-1')?.style.setProperty('display', 'none');
        document.getElementById('sp-ltm-quantity-container-2')?.style.setProperty('display', 'none');

        // Show this tier's container if it has LTM
        if (hasLTM && containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'flex';
                container.classList.add('show');
            }
        }
    });
});
```

#### 3. Update Input Event Handlers (Lines ~433-469):
```javascript
// Tier 1 input (24-36)
const qtyInput1 = document.getElementById('sp-qty-tier-1');
if (qtyInput1) {
    qtyInput1.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 24;
        const clamped = Math.max(24, Math.min(36, value));
        if (value !== clamped) {
            e.target.value = clamped;
        }

        // Update fee calculation display
        const ltmFee = 75.00;
        const ltmPerShirt = (ltmFee / clamped).toFixed(2);
        const calcDisplay = document.getElementById('sp-ltm-calc-1');
        if (calcDisplay) {
            calcDisplay.textContent = `$${ltmFee.toFixed(2)} ÷ ${clamped} = $${ltmPerShirt}/shirt`;
        }

        // Update state and recalculate
        this.state.quantity = clamped;
        this.updateDisplay();
    });
}

// Tier 2 input (37-72)
const qtyInput2 = document.getElementById('sp-qty-tier-2');
if (qtyInput2) {
    qtyInput2.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) || 37;
        const clamped = Math.max(37, Math.min(72, value));
        if (value !== clamped) {
            e.target.value = clamped;
        }

        // Update fee calculation display
        const ltmFee = 50.00;
        const ltmPerShirt = (ltmFee / clamped).toFixed(2);
        const calcDisplay = document.getElementById('sp-ltm-calc-2');
        if (calcDisplay) {
            calcDisplay.textContent = `$${ltmFee.toFixed(2)} ÷ ${clamped} = $${ltmPerShirt}/shirt`;
        }

        // Update state and recalculate
        this.state.quantity = clamped;
        this.updateDisplay();
    });
}
```

#### 4. Update Default State (Lines ~56-69):
```javascript
this.state = {
    quantity: 37,              // Keep as 37 (default to tier 2)
    // ... rest of state
    expandedLTMTier: null      // No tier expanded by default
};
```

---

## 🎨 New Universal CSS File

**File:** `/shared_components/css/universal-ltm-quantity-input.css`

**Purpose:** Shared LTM styling that works for all three calculators (DTG, DTF, Screen Print)

```css
/* ==================== UNIVERSAL LTM QUANTITY INPUT STYLING ==================== */
/*
 * Universal Less-Than-Minimum Quantity Input Styling
 * Date: 2025-10-09
 * Purpose: Consistent LTM tier display across DTG, DTF, and Screen Print calculators
 * Based on: DTG pricing calculator pattern
 */

/* Main Container - Hidden by default, shown when LTM tier selected */
.universal-quantity-input-container {
    display: none; /* Hidden by default */
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%);
    border: 3px solid #4cb354;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.15);
    animation: slideDown 0.3s ease-out;
}

/* Show state */
.universal-quantity-input-container.show {
    display: flex !important;
}

/* Slide-down animation */
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
        max-height: 0;
    }
    to {
        opacity: 1;
        transform: translateY(0);
        max-height: 200px;
    }
}

/* Label styling */
.universal-quantity-input-label {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
}

.universal-quantity-input-label i {
    color: #4cb354;
    font-size: 18px;
}

/* Number input field */
.universal-quantity-input {
    width: 100%;
    max-width: 200px;
    padding: 14px 16px;
    font-size: 20px;
    font-weight: 700;
    text-align: center;
    color: #1f2937;
    border: 2px solid #d1d5db;
    border-radius: 10px;
    background: white;
    transition: all 0.3s ease;
}

.universal-quantity-input:focus {
    outline: none;
    border-color: #4cb354;
    box-shadow: 0 0 0 4px rgba(76, 179, 84, 0.15);
}

.universal-quantity-input:hover {
    border-color: #9ca3af;
}

/* Invalid state */
.universal-quantity-input:invalid {
    border-color: #ef4444;
}

/* Hint text */
.universal-quantity-hint {
    font-size: 13px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.5;
}

.universal-quantity-hint i {
    color: #4cb354;
    font-size: 14px;
}

.universal-quantity-hint strong {
    color: #4cb354;
    font-weight: 700;
    padding: 2px 6px;
    background: rgba(76, 179, 84, 0.1);
    border-radius: 4px;
}

/* Tier Button Enhancements (works with existing button styles) */
.universal-tier-button small {
    display: block;
    font-size: 11px;
    opacity: 0.9;
    margin-top: 4px;
    font-weight: 600;
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
    .universal-quantity-input-container {
        padding: 16px;
        gap: 10px;
    }

    .universal-quantity-input-label {
        font-size: 14px;
    }

    .universal-quantity-input {
        max-width: 100%;
        font-size: 18px;
        padding: 12px 14px;
    }

    .universal-quantity-hint {
        font-size: 12px;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
}

/* Accessibility: Focus visible for keyboard navigation */
.universal-quantity-input:focus-visible {
    outline: 3px solid #4cb354;
    outline-offset: 2px;
}

/* Print styles - hide input when printing */
@media print {
    .universal-quantity-input-container {
        display: none !important;
    }
}

/* Compatibility with existing calculator-specific classes */
.dtf-quantity-input-container.universal-quantity-input-container,
.sp-quantity-input-container.universal-quantity-input-container,
.dtg-quantity-input-container.universal-quantity-input-container {
    /* Allow calculator-specific overrides if needed */
}
```

---

## 📝 Implementation Checklist

### Phase 1: Create Universal CSS ✅
- [ ] Create `/shared_components/css/universal-ltm-quantity-input.css`
- [ ] Add CSS link to `/calculators/dtg-pricing.html` (for consistency)
- [ ] Add CSS link to `/calculators/dtf-pricing.html`
- [ ] Add CSS link to `/calculators/screen-print-pricing.html`

### Phase 2: Update DTF Calculator ✅
- [ ] Update `renderTierButtons()` method in `/shared_components/js/dtf-pricing-calculator.js`
  - [ ] Add fee label to 10-23 tier button
  - [ ] Move input container outside button HTML
  - [ ] Add real-time fee calculation display
  - [ ] Add universal CSS classes
- [ ] Add `updateDTFLTMFeeDisplay()` method
- [ ] Update input event listener to call fee display update
- [ ] Update `handleTierSelection()` to show/hide input container
- [ ] Change default tier from '10-23' to '24-47'
- [ ] Test tier selection behavior
- [ ] Test fee calculation updates

### Phase 3: Update Screen Print Calculator ✅
- [ ] Update `createUI()` method in `/shared_components/js/screenprint-pricing-v2.js`
  - [ ] Restructure tier 24-36 button and separate input container
  - [ ] Restructure tier 37-72 button and separate input container
  - [ ] Add fee labels to both LTM tier buttons
  - [ ] Add universal CSS classes
- [ ] Update tier button click handlers
  - [ ] Add logic to show/hide appropriate container
  - [ ] Add container ID references
- [ ] Update input event listeners
  - [ ] Update fee calculation displays for both tiers
  - [ ] Ensure proper min/max validation
- [ ] Keep default tier as 37-72 (already correct)
- [ ] Test both LTM tiers expand/collapse correctly
- [ ] Test fee calculations for both $75 and $50 fees

### Phase 4: Visual Consistency Testing ✅
- [ ] **DTG Verification:**
  - [ ] Universal CSS doesn't break existing DTG styling
  - [ ] 1-23 input still works correctly
  - [ ] Fee calculation displays properly
- [ ] **DTF Verification:**
  - [ ] 10-23 tier shows "+ $50 Small Batch Fee" label
  - [ ] Input container slides down below button when clicked
  - [ ] Fee calculation shows "$50 ÷ X = $Y.YY/piece"
  - [ ] Default state shows 24-47 tier selected (clean)
  - [ ] Green theme matches DTG (#4cb354)
- [ ] **Screen Print Verification:**
  - [ ] 24-36 tier shows "+ $75 Small Batch Fee" label
  - [ ] 37-72 tier shows "+ $50 Small Batch Fee" label
  - [ ] Both input containers slide down correctly
  - [ ] Fee calculations show proper amounts
  - [ ] Default state shows 37-72 tier selected (clean)
  - [ ] Green theme matches DTG and DTF

### Phase 5: Functional Testing ✅
- [ ] **All Calculators:**
  - [ ] Clicking LTM tier highlights button and shows input
  - [ ] Clicking different tier hides previous input and shows new one (if applicable)
  - [ ] Input validation prevents values outside tier range
  - [ ] Fee per item calculates in real-time as user types
  - [ ] Prices update correctly based on quantity input
  - [ ] Slide-down animation is smooth (0.3s ease-out)
- [ ] **Mobile Testing:**
  - [ ] All three calculators responsive on mobile (375px width)
  - [ ] Input containers don't break layout on small screens
  - [ ] Touch interactions work properly
  - [ ] Typography scales appropriately

### Phase 6: Edge Cases ✅
- [ ] Entering invalid values (too low/too high) auto-corrects
- [ ] Decimal values round to integers
- [ ] Negative values prevented
- [ ] Empty input defaults to tier minimum
- [ ] Fee calculation handles all valid quantities (10-23, 24-36, 37-72)
- [ ] Division by zero impossible (min values enforced)

---

## 📊 Success Criteria

### Visual Consistency ✅
- [ ] All three calculators use identical green theme (#4cb354)
- [ ] Tier buttons have same height, padding, and typography
- [ ] Input containers have matching gradient backgrounds
- [ ] Icons (calculator, info-circle) positioned consistently
- [ ] Fee labels have same font size and opacity

### Functional Consistency ✅
- [ ] All calculators start with non-LTM tier selected by default
- [ ] LTM tier buttons clearly show "+ $XX Small Batch Fee"
- [ ] Input containers slide down smoothly when tier clicked
- [ ] Real-time fee calculation updates as user types
- [ ] Min/max validation prevents invalid quantities
- [ ] Switching tiers properly shows/hides input containers

### User Experience ✅
- [ ] Clean initial view (no input boxes visible)
- [ ] Clear call-to-action for small batch customers
- [ ] Instant feedback on fee impact per item
- [ ] Professional, polished animations
- [ ] Mobile-friendly on all devices
- [ ] Keyboard navigation works (accessibility)

---

## 🚀 Estimated Timeline

- **Phase 1:** Create Universal CSS - 30 minutes
- **Phase 2:** Update DTF Calculator - 45 minutes
- **Phase 3:** Update Screen Print Calculator - 60 minutes
- **Phase 4:** Visual Testing - 20 minutes
- **Phase 5:** Functional Testing - 20 minutes
- **Phase 6:** Edge Case Testing - 15 minutes

**Total Estimated Time:** ~3 hours

---

## 📁 Files to Modify

### New Files (1)
1. `/shared_components/css/universal-ltm-quantity-input.css` - New shared styling

### Modified Files (5)
1. `/shared_components/js/dtf-pricing-calculator.js` - Update renderTierButtons() and event handlers
2. `/shared_components/js/screenprint-pricing-v2.js` - Update createUI() and event handlers
3. `/calculators/dtg-pricing.html` - Add universal CSS link (for consistency)
4. `/calculators/dtf-pricing.html` - Add universal CSS link
5. `/calculators/screen-print-pricing.html` - Add universal CSS link

---

## 🎯 Final Result

After implementation, all three calculators will have:

1. ✅ **Consistent Visual Design**
   - Matching green theme (#4cb354)
   - Identical button and input styling
   - Same animations and transitions

2. ✅ **Clear Fee Communication**
   - Fee amounts shown directly in tier buttons
   - Real-time calculation of fee per item
   - Professional presentation

3. ✅ **Intuitive User Experience**
   - Clean default state (higher tier selected)
   - Input boxes appear on demand
   - Smooth, professional animations

4. ✅ **Professional Implementation**
   - DRY principle (shared CSS)
   - Consistent class names
   - Maintainable code structure

---

**Ready to implement?** All requirements are clearly defined and the plan is comprehensive. Let me know when to proceed!
