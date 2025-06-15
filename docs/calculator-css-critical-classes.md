# Critical CSS Classes for Calculator Functionality

## ⚠️ DO NOT MODIFY THESE CLASSES

These CSS classes and IDs are essential for calculator JavaScript functionality. Changing them will break the pricing calculators.

## Top Priority - Calculator Core Functions

### 1. Container IDs (Mount Points)
```css
#dtf-calculator-container     /* DTF calculator mount point */
#quick-quote-container        /* Quick quote calculator mount */
#pricing-grid-container       /* Pricing grid display */
#order-summary-content        /* Order summary updates */
#transfer-locations-container /* DTF transfer locations */
```

### 2. Input Controls (User Interaction)
```css
.quantity-input              /* All quantity inputs */
.quantity-btn                /* +/- quantity buttons */
.location-select             /* Location dropdowns */
.form-control                /* General form inputs */
#dtf-quantity                /* DTF quantity field */
#dtg-location-select         /* DTG location dropdown */
```

### 3. Price Display Elements
```css
.unit-price                  /* Per unit price display */
.total-price                 /* Total price display */
.pricing-display             /* Price container */
.pricing-breakdown           /* Breakdown section */
.price-highlight             /* Highlighted prices */
.summary-line-item           /* Summary lines */
```

### 4. Dynamic State Classes
```css
.loading                     /* Loading animation */
.updating                    /* Price update state */
.active                      /* Active selection */
.expanded                    /* Expanded sections */
.collapsed                   /* Collapsed sections */
.hidden                      /* Hidden elements */
.disabled                    /* Disabled inputs */
.show-internal               /* Staff view (body class) */
.internal-only               /* Internal pricing */
```

### 5. Action Buttons
```css
.add-transfer-btn            /* Add DTF transfer */
.btn-remove-transfer         /* Remove DTF transfer */
.quick-select-btn            /* Quick quantity select */
#add-transfer-btn            /* Main add button */
#staff-view-link             /* Staff view toggle */
```

## JavaScript Dependencies

### Event Listeners Attached To:
- All `.quantity-input` elements (change events)
- All `.quantity-btn` elements (click events)
- All `.location-select` elements (change events)
- `.btn-remove-transfer` (click to remove)
- `#add-transfer-btn` (click to add)
- `#staff-view-link` (click to toggle)

### Dynamic Class Toggling:
```javascript
// These classes are added/removed by JS
element.classList.add('loading');
element.classList.remove('loading');
element.classList.toggle('active');
element.classList.toggle('expanded');
document.body.classList.toggle('show-internal');
```

### Element Selection in JS:
```javascript
// These selectors are hard-coded in JavaScript
document.getElementById('dtf-calculator-container')
document.getElementById('quick-quote-container')
document.querySelector('.unit-price')
document.querySelector('.total-price')
document.querySelectorAll('.quantity-input')
document.querySelectorAll('.transfer-location-item')
```

## Safe CSS Modifications

### ✅ You CAN safely change:
- Colors and backgrounds
- Font styles and sizes
- Padding and margins
- Borders and shadows
- Transitions and animations
- Hover/focus states
- Media queries for responsive design

### ❌ You CANNOT change:
- Class names or IDs listed above
- Element hierarchy that JS depends on
- Display properties used for show/hide
- Data attributes
- Bootstrap classes used for functionality

## Example Safe Modifications

```css
/* SAFE - Adding visual styles */
.quantity-btn {
    background-color: #2e5827;  /* Safe to change */
    transition: all 0.3s;       /* Safe to add */
    box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Safe */
}

/* SAFE - Using parent selectors */
.dtf-page .quantity-btn {
    background-color: #custom-color;
}

/* UNSAFE - Don't rename classes */
.qty-btn { /* DON'T rename .quantity-btn to this */
    /* ... */
}

/* UNSAFE - Don't change functional display */
.loading {
    display: none !important; /* DON'T override JS display */
}
```

## Testing After CSS Changes

Always verify these functions still work:
1. Quantity can be changed (input and buttons)
2. Prices update automatically
3. DTF transfers can be added/removed
4. DTG location selection works
5. Staff view toggle functions
6. Loading states appear/disappear
7. Accordions expand/collapse
8. All calculations are correct

## Quick Reference - Most Critical Classes

If you remember nothing else, NEVER change these:
- `#dtf-calculator-container`
- `#quick-quote-container`
- `.quantity-input`
- `.quantity-btn`
- `.unit-price`
- `.total-price`
- `.loading`
- `.active`