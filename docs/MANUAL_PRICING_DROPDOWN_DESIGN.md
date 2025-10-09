# Manual Pricing Dropdown - Design Specification

**Created**: 2025-10-09
**Purpose**: Clean up Staff Dashboard Quick Access buttons by consolidating 7 Manual Pricing buttons into 1 dropdown
**Status**: Design Phase - Ready for Implementation

---

## 📸 Current Problem

The Manual Pricing row on the Staff Dashboard has **7 buttons**, making it the most cluttered section:

```
Current Layout:
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ MANUAL PRICING                                                                               │
│ [Manual DTG] [Manual DTF] [Manual Embroidery] [Manual Cap Embroidery]                      │
│ [Manual Screen Print] [Manual Stickers] [Manual Laser - Coming Soon]                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Issues**:
- Takes up ~1200px horizontal space (wraps on smaller screens)
- Visually overwhelming compared to other sections
- Difficult to scan quickly
- Not scalable (hard to add more calculator types)

---

## 🎯 Proposed Solution: Dropdown Menu

Replace 7 individual buttons with **1 dropdown button** that reveals all options:

```
Proposed Layout (Closed):
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ MANUAL PRICING                                                                               │
│ [📋 Manual Pricing Calculator ▼]                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
Proposed Layout (Open):
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ MANUAL PRICING                                                                               │
│ [📋 Manual Pricing Calculator ▲]                                                            │
│   ┌──────────────────────────────────────────┐                                              │
│   │ 👕 Manual DTG                            │                                              │
│   │ 🎨 Manual DTF                            │                                              │
│   │ 🧵 Manual Embroidery                     │                                              │
│   │ 🧢 Manual Cap Embroidery                 │                                              │
│   │ 🖨️  Manual Screen Print                  │                                              │
│   │ 📄 Manual Stickers      (Coming Soon)   │                                              │
│   │ ⚡ Manual Laser        (Coming Soon)   │                                              │
│   └──────────────────────────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Benefits**:
- ✅ Reduces from 7 buttons to 1 button (~75% space savings)
- ✅ All options still visible when dropdown opens
- ✅ Professional dashboard UX pattern
- ✅ Mobile-friendly
- ✅ Easy to add more calculator types later
- ✅ Icons improve visual scanning

---

## 🎨 Visual Design Specifications

### Dropdown Button (Trigger)

**Dimensions**:
- Width: `300px`
- Height: `40px`
- Border radius: `6px`
- Padding: `10px 16px`

**Typography**:
- Font family: `'Inter', sans-serif`
- Font size: `14px`
- Font weight: `500`
- Color: `#333333`

**Colors**:
- Background: `#ffffff` (white)
- Border: `1px solid #e5e7eb` (light gray)
- Hover background: `#f9fafb`
- Active background: `#f3f4f6`

**Icon**:
- Calculator icon: `<i class="fas fa-calculator"></i>` (left side, 16px)
- Chevron: `<i class="fas fa-chevron-down"></i>` (right side, 12px)
- Icon color: `#6b7280` (medium gray)

**States**:
```css
/* Default */
background: #ffffff;
border: 1px solid #e5e7eb;

/* Hover */
background: #f9fafb;
border-color: #d1d5db;

/* Active (dropdown open) */
background: #f3f4f6;
border-color: #981e32; /* NWCA burgundy accent */
box-shadow: 0 0 0 3px rgba(152, 30, 50, 0.1);
```

---

### Dropdown Menu

**Dimensions**:
- Width: `300px` (same as button)
- Max height: `400px` (scrollable if needed)
- Border radius: `8px`
- Margin top: `4px` (gap from button)

**Positioning**:
- Position: `absolute`
- Top: `calc(100% + 4px)`
- Left: `0`
- Z-index: `1000`

**Shadow**:
```css
box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

**Border**:
```css
border: 1px solid #e5e7eb;
```

**Background**:
```css
background: #ffffff;
backdrop-filter: blur(8px); /* Subtle frosted glass effect */
```

---

### Dropdown Items

**Dimensions**:
- Height: `44px` (comfortable click target)
- Padding: `12px 16px`

**Typography**:
- Font family: `'Inter', sans-serif`
- Font size: `14px`
- Font weight: `500`
- Color: `#1f2937` (dark gray)

**Layout**:
```css
display: flex;
align-items: center;
gap: 12px; /* Space between icon and text */
```

**Icon**:
- Size: `18px`
- Color: `#6b7280`
- Margin right: `12px`

**States**:

**Normal**:
```css
background: transparent;
color: #1f2937;
cursor: pointer;
```

**Hover**:
```css
background: #f3f4f6; /* Light gray */
color: #111827; /* Darker text */
transform: scale(1.02); /* Subtle grow */
transition: all 0.15s ease-out;
```

**Active (clicked)**:
```css
background: #e5e7eb;
```

**Disabled (Coming Soon)**:
```css
opacity: 0.5;
cursor: not-allowed;
color: #9ca3af;
```

**Separator** (optional, between available and coming soon):
```css
border-top: 1px solid #e5e7eb;
margin: 4px 0;
```

---

## 🎬 Interaction & Behavior

### Opening the Dropdown

**Trigger**: User clicks dropdown button

**Animation** (200ms slide-down):
```css
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

**Visual Changes**:
1. Chevron rotates 180° (▼ → ▲)
2. Button gets active state styling
3. Dropdown menu slides down with fade-in
4. First item gets subtle highlight

---

### Hovering Over Items

**Trigger**: Mouse enters dropdown item

**Visual Changes**:
1. Background changes to `#f3f4f6`
2. Subtle scale effect (`transform: scale(1.02)`)
3. Cursor changes to `pointer`
4. Icon color intensifies slightly

**Timing**: Instant (no delay)

---

### Selecting an Item

**Trigger**: User clicks "Manual Embroidery"

**Flow**:
1. **Immediate**: Item flashes (active state, 100ms)
2. **150ms**: Dropdown fades out and slides up
3. **200ms**: Modal appears (existing modal system)
4. **250ms**: Cost input field is auto-focused

**What Opens**: The existing modal with:
- Title: "Manual Pricing - Embroidery"
- Cost input field (auto-focused)
- "Calculate Pricing" button

**Complete User Journey**:
```
Click dropdown → Hover "Embroidery" → Click
    ↓
Dropdown closes (150ms)
    ↓
Modal opens (200ms)
    ↓
Title: "Manual Pricing - Embroidery"
Cost: [cursor ready]
    ↓
User types: "8.50"
    ↓
Clicks "Calculate Pricing"
    ↓
Redirects to: /pricing/embroidery?manualCost=8.50
```

---

### Closing the Dropdown

**Method 1: Click Outside**
- User clicks anywhere on the page
- Dropdown fades out (150ms)
- Chevron rotates back (▲ → ▼)
- Button returns to normal state

**Method 2: Press Escape**
- Keyboard shortcut
- Same animation as click outside
- Focus returns to dropdown button

**Method 3: Click Button Again**
- Toggle behavior
- Same close animation

**Method 4: Select an Item**
- Automatic close after selection
- Faster animation (100ms)

---

### "Coming Soon" Items

**Trigger**: User clicks "Manual Stickers (Coming Soon)"

**Behavior**:
- Small toast notification appears:
  ```
  ┌─────────────────────────────────────────┐
  │ ℹ️  Manual Stickers Coming Soon         │
  │                                         │
  │ Contact 253-922-5793 for assistance    │
  └─────────────────────────────────────────┘
  ```
- Dropdown **stays open** (doesn't close)
- Toast auto-dismisses after 3 seconds

**Alternative**: Simple browser alert (simpler implementation)

---

## 🎨 Icon Mapping

Using Font Awesome 6 icons for visual clarity:

| Calculator Type | Icon | Font Awesome Code | Color |
|----------------|------|-------------------|-------|
| Manual DTG | 👕 T-shirt | `<i class="fas fa-tshirt"></i>` | `#6b7280` |
| Manual DTF | 🎨 Palette | `<i class="fas fa-palette"></i>` | `#6b7280` |
| Manual Embroidery | 🧵 Scissors | `<i class="fas fa-scissors"></i>` | `#6b7280` |
| Manual Cap Embroidery | 🧢 Hat | `<i class="fas fa-hat-cowboy"></i>` | `#6b7280` |
| Manual Screen Print | 🖨️ Print | `<i class="fas fa-print"></i>` | `#6b7280` |
| Manual Stickers | 📄 Tag | `<i class="fas fa-tag"></i>` | `#9ca3af` (grayed) |
| Manual Laser | ⚡ Bolt | `<i class="fas fa-bolt"></i>` | `#9ca3af` (grayed) |

**Alternative Icons** (if preferred):
- Embroidery: `<i class="fas fa-thread"></i>` or `<i class="fas fa-sewing-machine"></i>`
- Screen Print: `<i class="fas fa-spray-can"></i>`
- Laser: `<i class="fas fa-laser"></i>` (if available in Font Awesome)

---

## 📱 Mobile Responsiveness

### Breakpoint: `max-width: 768px`

**Changes for Mobile**:

**Dropdown Button**:
- Width: `100%` (full width of parent)
- Font size: `15px` (slightly larger for readability)

**Dropdown Menu**:
- Width: `100%` (matches button)
- Item height: `48px` (larger touch target)
- Item padding: `14px 16px`
- Font size: `15px`

**Visual Example (Mobile)**:
```
┌────────────────────────────────┐
│ MANUAL PRICING                 │
│ ┌────────────────────────────┐ │
│ │ 📋 Manual Pricing      ▼ │ │ ← Full width
│ └────────────────────────────┘ │
│   ┌──────────────────────────┐ │
│   │ 👕 Manual DTG            │ │ ← 48px height
│   │ 🎨 Manual DTF            │ │
│   │ 🧵 Manual Embroidery     │ │
│   │ 🧢 Manual Cap Embroidery │ │
│   │ 🖨️  Manual Screen Print  │ │
│   └──────────────────────────┘ │
└────────────────────────────────┘
```

---

## ⌨️ Keyboard Navigation

### Accessibility Features

**Tab**: Focus dropdown button
```css
.dropdown-btn:focus {
    outline: 2px solid #981e32;
    outline-offset: 2px;
}
```

**Enter or Space**: Open dropdown

**Arrow Down**: Highlight next item

**Arrow Up**: Highlight previous item

**Home**: Jump to first item

**End**: Jump to last item

**Escape**: Close dropdown

**Type-ahead**: Type first letter to jump
- Type "d" → highlights "Manual DTG"
- Type "e" → highlights "Manual Embroidery"

**Enter on highlighted item**: Select and open modal

---

## 💻 Technical Implementation

### HTML Structure

```html
<div class="quick-access-row">
    <div class="row-label">MANUAL PRICING</div>
    <div class="button-group">
        <!-- New Dropdown Wrapper -->
        <div class="manual-pricing-dropdown-wrapper">
            <!-- Trigger Button -->
            <button
                class="quick-btn manual-pricing-trigger"
                onclick="toggleManualPricingDropdown()"
                aria-haspopup="true"
                aria-expanded="false"
                id="manualPricingButton"
            >
                <i class="fas fa-calculator"></i>
                <span>Manual Pricing Calculator</span>
                <i class="fas fa-chevron-down chevron-icon"></i>
            </button>

            <!-- Dropdown Menu -->
            <div
                class="manual-pricing-dropdown-menu"
                id="manualPricingDropdownMenu"
                role="menu"
                style="display: none;"
            >
                <!-- Available Calculators -->
                <a href="javascript:void(0)"
                   onclick="selectManualCalculator('dtg')"
                   class="dropdown-item"
                   role="menuitem">
                    <i class="fas fa-tshirt"></i>
                    <span>Manual DTG</span>
                </a>

                <a href="javascript:void(0)"
                   onclick="selectManualCalculator('dtf')"
                   class="dropdown-item"
                   role="menuitem">
                    <i class="fas fa-palette"></i>
                    <span>Manual DTF</span>
                </a>

                <a href="javascript:void(0)"
                   onclick="selectManualCalculator('embroidery')"
                   class="dropdown-item"
                   role="menuitem">
                    <i class="fas fa-scissors"></i>
                    <span>Manual Embroidery</span>
                </a>

                <a href="javascript:void(0)"
                   onclick="selectManualCalculator('cap-embroidery')"
                   class="dropdown-item"
                   role="menuitem">
                    <i class="fas fa-hat-cowboy"></i>
                    <span>Manual Cap Embroidery</span>
                </a>

                <a href="javascript:void(0)"
                   onclick="selectManualCalculator('screen-print')"
                   class="dropdown-item"
                   role="menuitem">
                    <i class="fas fa-print"></i>
                    <span>Manual Screen Print</span>
                </a>

                <!-- Separator -->
                <div class="dropdown-divider"></div>

                <!-- Coming Soon (Disabled) -->
                <a href="javascript:void(0)"
                   onclick="showComingSoon('Stickers')"
                   class="dropdown-item disabled"
                   role="menuitem">
                    <i class="fas fa-tag"></i>
                    <span>Manual Stickers</span>
                    <span class="coming-soon-badge">Coming Soon</span>
                </a>

                <a href="javascript:void(0)"
                   onclick="showComingSoon('Laser')"
                   class="dropdown-item disabled"
                   role="menuitem">
                    <i class="fas fa-bolt"></i>
                    <span>Manual Laser</span>
                    <span class="coming-soon-badge">Coming Soon</span>
                </a>
            </div>
        </div>
    </div>
</div>
```

---

### CSS (Complete Stylesheet)

```css
/* ================================
   MANUAL PRICING DROPDOWN STYLES
   ================================ */

/* Dropdown Wrapper */
.manual-pricing-dropdown-wrapper {
    position: relative;
    display: inline-block;
}

/* Trigger Button */
.manual-pricing-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 300px;
    padding: 10px 16px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #333333;
    cursor: pointer;
    transition: all 0.2s ease;
}

.manual-pricing-trigger:hover {
    background: #f9fafb;
    border-color: #d1d5db;
}

.manual-pricing-trigger.active {
    background: #f3f4f6;
    border-color: #981e32;
    box-shadow: 0 0 0 3px rgba(152, 30, 50, 0.1);
}

.manual-pricing-trigger:focus {
    outline: 2px solid #981e32;
    outline-offset: 2px;
}

/* Calculator Icon (Left) */
.manual-pricing-trigger .fa-calculator {
    color: #6b7280;
    font-size: 16px;
}

/* Chevron Icon (Right) */
.chevron-icon {
    color: #6b7280;
    font-size: 12px;
    margin-left: auto;
    transition: transform 0.2s ease;
}

.manual-pricing-trigger.active .chevron-icon {
    transform: rotate(180deg);
}

/* Dropdown Menu Container */
.manual-pricing-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 300px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -1px rgba(0, 0, 0, 0.06),
        0 10px 15px -3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    z-index: 1000;
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
    transition: all 0.2s ease-out;
}

.manual-pricing-dropdown-menu.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

/* Dropdown Item */
.dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: #1f2937;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease-out;
}

.dropdown-item:hover {
    background: #f3f4f6;
    color: #111827;
    transform: scale(1.02);
}

.dropdown-item:active {
    background: #e5e7eb;
}

/* Item Icon */
.dropdown-item i {
    color: #6b7280;
    font-size: 18px;
    width: 20px;
    text-align: center;
}

/* Disabled Items (Coming Soon) */
.dropdown-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    position: relative;
}

.dropdown-item.disabled:hover {
    background: transparent;
    transform: none;
}

.dropdown-item.disabled i {
    color: #9ca3af;
}

/* Coming Soon Badge */
.coming-soon-badge {
    margin-left: auto;
    padding: 2px 8px;
    background: #fef3c7;
    color: #92400e;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Divider */
.dropdown-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .manual-pricing-trigger,
    .manual-pricing-dropdown-menu {
        width: 100%;
    }

    .dropdown-item {
        padding: 14px 16px;
        font-size: 15px;
        min-height: 48px;
    }

    .dropdown-item i {
        font-size: 20px;
    }
}
```

---

### JavaScript Functions

```javascript
/* ================================
   MANUAL PRICING DROPDOWN LOGIC
   ================================ */

let manualPricingDropdownOpen = false;

/**
 * Toggle dropdown open/closed
 */
function toggleManualPricingDropdown() {
    const button = document.getElementById('manualPricingButton');
    const menu = document.getElementById('manualPricingDropdownMenu');

    manualPricingDropdownOpen = !manualPricingDropdownOpen;

    if (manualPricingDropdownOpen) {
        // Open dropdown
        button.classList.add('active');
        button.setAttribute('aria-expanded', 'true');
        menu.classList.add('show');
        menu.style.display = 'block';
    } else {
        // Close dropdown
        button.classList.remove('active');
        button.setAttribute('aria-expanded', 'false');
        menu.classList.remove('show');

        // Wait for animation before hiding
        setTimeout(() => {
            if (!menu.classList.contains('show')) {
                menu.style.display = 'none';
            }
        }, 200);
    }
}

/**
 * Select a calculator type and open modal
 */
function selectManualCalculator(calculatorType) {
    console.log('Selected calculator:', calculatorType);

    // Close dropdown
    toggleManualPricingDropdown();

    // Small delay before opening modal (smoother UX)
    setTimeout(() => {
        // Call existing modal function
        openManualPricingModal(calculatorType);
    }, 150);
}

/**
 * Show coming soon alert
 */
function showComingSoon(calculatorName) {
    // Simple alert (can be replaced with toast notification)
    alert(`${calculatorName} manual pricing is coming soon!\n\nContact 253-922-5793 for assistance.`);
}

/**
 * Close dropdown when clicking outside
 */
document.addEventListener('click', function(event) {
    const wrapper = document.querySelector('.manual-pricing-dropdown-wrapper');

    if (wrapper && !wrapper.contains(event.target) && manualPricingDropdownOpen) {
        toggleManualPricingDropdown();
    }
});

/**
 * Close dropdown with Escape key
 */
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && manualPricingDropdownOpen) {
        toggleManualPricingDropdown();

        // Return focus to button
        document.getElementById('manualPricingButton').focus();
    }
});
```

---

## 🔌 Integration with Existing System

### Existing Modal System (Already Built)

The dropdown connects to the **existing modal system** that was already added to `staff-dashboard.html`:

**Modal Location**: Lines 9202-9244 in `staff-dashboard.html`

**Modal Functions**: Lines 9343-9476 in `staff-dashboard.html`

**How They Connect**:
1. User clicks dropdown item (e.g., "Manual Embroidery")
2. Calls `selectManualCalculator('embroidery')`
3. Which calls `openManualPricingModal('embroidery')` (existing function)
4. Existing modal opens with cost input
5. User enters cost and clicks "Calculate Pricing"
6. Redirects to `/pricing/embroidery?manualCost=8.50`

**No changes needed to**:
- ✅ Modal HTML
- ✅ Modal JavaScript
- ✅ Pricing pages (already support `?manualCost` parameter)
- ✅ Pricing services (already have `generateManualPricingData()` methods)

**Only changes needed**:
- 🔧 Replace 7 buttons with 1 dropdown button
- 🔧 Add dropdown menu HTML
- 🔧 Add dropdown CSS
- 🔧 Add dropdown JavaScript (toggle, select functions)

---

## 📊 Before & After Comparison

### Visual Comparison

**BEFORE** (Current State):
```
MANUAL PRICING
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐
│Manual DTG│ │Manual DTF│ │Manual Embr...│ │Manual Cap E...│ │Manual Scre...│ │Manual S...│ │Manual Las...│
└──────────┘ └──────────┘ └──────────────┘ └────────────────┘ └──────────────┘ └───────────┘ └──────────────┘

Width: ~1200px (wraps on tablet)
Height: 40-80px (depends on wrapping)
Visual Weight: Heavy
```

**AFTER** (Dropdown Implementation):
```
MANUAL PRICING
┌──────────────────────────────────────┐
│ 📋 Manual Pricing Calculator      ▼ │
└──────────────────────────────────────┘

Width: 300px (fixed)
Height: 40px (always single row)
Visual Weight: Light

When opened:
┌──────────────────────────────────────┐
│ 📋 Manual Pricing Calculator      ▲ │
└──────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ 👕 Manual DTG                      │
  │ 🎨 Manual DTF                      │
  │ 🧵 Manual Embroidery               │
  │ 🧢 Manual Cap Embroidery           │
  │ 🖨️  Manual Screen Print            │
  │ ─────────────────────────────────  │
  │ 📄 Manual Stickers   (Coming Soon)│
  │ ⚡ Manual Laser     (Coming Soon)│
  └────────────────────────────────────┘
```

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Horizontal Space | ~1200px | 300px | **75% reduction** |
| Number of Buttons | 7 | 1 | **86% reduction** |
| Visual Clutter | High | Low | **Significant** |
| Scalability | Poor | Excellent | Can add unlimited items |
| Mobile-Friendly | No (wraps) | Yes (full width) | **100% improvement** |
| Professional Look | Good | Excellent | **Modern UX pattern** |

---

## ✅ Implementation Checklist

### Phase 1: Core Implementation (Required)

- [ ] **HTML**: Replace 7 buttons with dropdown structure
- [ ] **CSS**: Add all dropdown styles (button, menu, items, animations)
- [ ] **JavaScript**: Add toggle, select, and close functions
- [ ] **Icons**: Add Font Awesome icons to each item
- [ ] **Integration**: Connect to existing `openManualPricingModal()` function
- [ ] **Testing**: Test all 7 calculator options

### Phase 2: Polish (Required)

- [ ] **Animations**: Smooth slide-down/fade-in (200ms)
- [ ] **Hover Effects**: Scale and background change
- [ ] **Click Outside**: Close dropdown when clicking page
- [ ] **Escape Key**: Close dropdown with Escape
- [ ] **Coming Soon**: Add alerts for Stickers and Laser
- [ ] **Mobile**: Test responsive behavior

### Phase 3: Accessibility (Recommended)

- [ ] **Keyboard Nav**: Arrow keys, Enter, Home, End
- [ ] **ARIA Labels**: Add proper `role` and `aria-*` attributes
- [ ] **Focus States**: Visible focus indicators
- [ ] **Screen Reader**: Test with NVDA/JAWS

### Phase 4: Enhancement (Optional - Later)

- [ ] **Recently Used**: Track and show last used calculator
- [ ] **Search/Filter**: Add search box for long lists
- [ ] **Quick Presets**: Add common cost presets in modal
- [ ] **Analytics**: Track which calculators are used most

---

## 🧪 Testing Scenarios

### Functional Testing

**Test 1: Open/Close Dropdown**
1. Click dropdown button
2. ✅ Menu appears with smooth animation
3. ✅ Chevron rotates to point up
4. Click button again
5. ✅ Menu closes smoothly
6. ✅ Chevron rotates back down

**Test 2: Select Calculator (DTG)**
1. Open dropdown
2. Hover over "Manual DTG"
3. ✅ Item highlights
4. Click "Manual DTG"
5. ✅ Dropdown closes
6. ✅ Modal opens with "DTG (Direct-to-Garment)" title
7. ✅ Cost input is focused

**Test 3: Full Flow (Embroidery)**
1. Open dropdown
2. Click "Manual Embroidery"
3. Enter cost: "8.50"
4. Click "Calculate Pricing"
5. ✅ Redirects to `/pricing/embroidery?manualCost=8.50`
6. ✅ Page loads in manual mode
7. ✅ Shows $8.50 base cost

**Test 4: Coming Soon**
1. Open dropdown
2. Click "Manual Stickers"
3. ✅ Alert appears: "Stickers manual pricing is coming soon!"
4. ✅ Dropdown stays open

**Test 5: Click Outside**
1. Open dropdown
2. Click on page background
3. ✅ Dropdown closes smoothly

**Test 6: Escape Key**
1. Open dropdown
2. Press Escape
3. ✅ Dropdown closes
4. ✅ Focus returns to button

### Visual Testing

**Test 7: Mobile (375px width)**
1. Resize to mobile width
2. ✅ Button becomes full width
3. ✅ Dropdown becomes full width
4. ✅ Items have 48px height (touch-friendly)

**Test 8: Tablet (768px width)**
1. Resize to tablet width
2. ✅ Dropdown still looks good
3. ✅ No layout issues

**Test 9: Large Screen (1920px width)**
1. View on large screen
2. ✅ Dropdown maintains fixed width
3. ✅ Positioned correctly

### Browser Testing

- [ ] **Chrome** (latest)
- [ ] **Firefox** (latest)
- [ ] **Safari** (latest)
- [ ] **Edge** (latest)
- [ ] **Mobile Safari** (iOS)
- [ ] **Chrome Mobile** (Android)

---

## 🎯 Success Criteria

The implementation will be considered successful when:

1. ✅ **Visual**: Dropdown looks clean and professional
2. ✅ **Functional**: All 7 calculator options work correctly
3. ✅ **Smooth**: Animations are smooth (200ms or less)
4. ✅ **Responsive**: Works on all screen sizes (320px - 1920px+)
5. ✅ **Accessible**: Keyboard navigation works
6. ✅ **Integrated**: Connects seamlessly to existing modal
7. ✅ **Tested**: All test scenarios pass
8. ✅ **User-Friendly**: Easier to use than 7 separate buttons

---

## 📝 Notes & Decisions

### Why Dropdown Over Other Options?

**Considered Alternatives**:
1. ❌ **Collapsible Section**: Still takes space when expanded
2. ❌ **Icon Grid**: Harder to add labels
3. ❌ **Mega Menu**: Overkill for 7 items
4. ✅ **Dropdown Menu**: Clean, scalable, professional

### Design Decisions:

- **Icons**: Using Font Awesome for consistency with rest of site
- **Width**: Fixed 300px to prevent awkward wrapping
- **Animation**: 200ms for responsiveness without feeling rushed
- **Separator**: Divider line between available and coming soon items
- **Colors**: Using existing NWCA color palette (#981e32 burgundy)
- **Height**: 44px items for comfortable clicking (48px on mobile)

---

## 🚀 Ready for Implementation

This design document provides:
- ✅ Complete visual specifications
- ✅ Detailed interaction behaviors
- ✅ Full HTML/CSS/JavaScript code
- ✅ Integration with existing system
- ✅ Testing checklist
- ✅ Success criteria

**Next Step**: Get approval on this design, then implement in `staff-dashboard.html`

---

**Questions or Changes Needed?**
- Prefer different icons?
- Want different animation speed?
- Need additional features?
- Different color scheme?

Document can be updated before implementation begins.
