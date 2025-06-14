# CSS Classes and IDs Tied to JavaScript Functionality

This document lists all CSS classes and IDs that are used by JavaScript and MUST NOT be changed or removed to maintain calculator functionality.

## Critical Element IDs (Do NOT modify)

### Calculator Containers
- `#dtf-calculator-container` - DTF pricing calculator mount point
- `#quick-quote-container` - Universal quick quote calculator mount point
- `#pricing-grid-container` - Pricing grid display container
- `#pricing-grid-container-initial-state` - Initial state message container

### DTF Calculator Specific
- `#transfer-locations-container` - Container for transfer location items
- `#order-summary-content` - Order summary display area
- `#dtf-quantity` - DTF quantity input field
- `#add-transfer-btn` - Add transfer location button
- `#staff-view-link` - Staff view toggle link
- `#dtfAccordion` - DTF accordion container

### DTG Page Specific
- `#dtg-location-select` - DTG location dropdown
- `#selected-location-display` - Selected location display container
- `#selected-location-text` - Location name text element
- `#selected-location-size` - Location size text element
- `#parent-dtg-location-select` - Parent location selector

### Quick Quote Elements
- `#quick-quote-title` - Quick quote section title
- `#quick-quote-subtitle` - Quick quote subtitle
- `#quantity-display` - Quantity display element
- `#quantity-input` - Main quantity input
- `#stitch-count-display` - Stitch count display
- `#additional-logos-container` - Additional logos container

### Product Display
- `#dtf-product-name` - Product name display
- `#dtf-product-image` - Product image element
- `#dtf-product-sku` - Product SKU display

## Critical CSS Classes (Used by JavaScript)

### Form Controls
- `.quantity-input` - All quantity input fields
- `.quantity-btn` - Quantity increase/decrease buttons
- `.quantity-input-group` - Quantity control group wrapper
- `.form-control` - General form inputs (Bootstrap standard)
- `.location-select` - Location dropdown selectors

### DTF Calculator Classes
- `.dtf-calculator-wrapper` - Main calculator wrapper
- `.dtf-calculator-main` - Main content area
- `.dtf-calculator-summary` - Summary sidebar
- `.transfer-location-item` - Individual transfer location item
- `.transfer-header` - Transfer item header
- `.btn-remove-transfer` - Remove transfer button
- `.add-transfer-btn` - Add transfer button
- `.transfer-inputs` - Transfer input container

### State Management Classes
- `.loading` - Loading state indicator
- `.updating` - Price update in progress
- `.active` - Active selection state
- `.expanded` - Expanded accordion/collapsible
- `.collapsed` - Collapsed state
- `.hidden` - Hidden element
- `.disabled` - Disabled state
- `.show-internal` - Staff view active (body class)
- `.internal-only` - Internal pricing elements

### Pricing Display Classes
- `.pricing-display` - Main pricing display container
- `.unit-price` - Per unit price element
- `.total-price` - Total price element
- `.pricing-breakdown` - Price breakdown section
- `.breakdown-item` - Individual breakdown line
- `.breakdown-label` - Breakdown item label
- `.breakdown-value` - Breakdown item value
- `.breakdown-total` - Total line in breakdown
- `.price-highlight` - Highlighted price
- `.summary-line-item` - Summary line item
- `.summary-subtotal` - Subtotal in summary
- `.summary-total` - Total in summary

### Quick Quote Classes
- `.quick-quote` - Main quick quote container
- `.quick-quote-subtitle` - Subtitle element
- `.quantity-label` - Quantity label element
- `.quick-select-grid` - Quick select buttons grid
- `.quick-select-btn` - Quick select button
- `.savings-tip` - Savings tip display
- `.ltm-warning` - LTM warning display

### Alert/Message Classes
- `.pricing-error-container` - Error message container
- `.pricing-placeholder` - Placeholder content
- `.alert` - Alert message (Bootstrap)
- `.alert-info` - Info alert
- `.alert-warning` - Warning alert

### DTG Specific Classes
- `.location-selector-group` - Location selector wrapper
- `.location-label` - Location label
- `.selected-location-display` - Selected location display
- `.location-icon` - Location icon
- `.location-text` - Location text
- `.location-size` - Location size text
- `.location-highlight` - Highlighted location
- `.print-size-guide` - Print size guide container
- `.size-guide-toggle` - Size guide toggle button
- `.size-guide-content` - Size guide content area

### Accordion/Collapsible Classes
- `.accordion` - Accordion container (Bootstrap)
- `.accordion-item` - Accordion item
- `.accordion-header` - Accordion header
- `.accordion-button` - Accordion toggle button
- `.accordion-collapse` - Collapsible content
- `.accordion-body` - Accordion content body

### Button Classes
- `.btn` - Base button class (Bootstrap)
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.btn-success` - Success button
- `.btn-danger` - Danger button

## Data Attributes Used by JavaScript

- `data-bs-toggle="collapse"` - Bootstrap collapse functionality
- `data-bs-target` - Bootstrap collapse target
- `data-transfer-id` - DTF transfer identification
- `data-location` - Location identifier
- `data-size` - Size identifier
- `data-quantity` - Quantity value
- `data-price` - Price value

## Event Listener Targets

These elements have event listeners attached and their structure must be preserved:

1. **Input Fields**: All `.quantity-input`, `#dtf-quantity`
2. **Buttons**: All `.quantity-btn`, `.btn-remove-transfer`, `#add-transfer-btn`
3. **Dropdowns**: All `.location-select`, `#dtg-location-select`
4. **Accordions**: All `.accordion-button`
5. **Links**: `#staff-view-link`

## CSS Modification Guidelines

### Safe to Modify:
- Colors, backgrounds, borders
- Spacing (padding, margin)
- Typography (font-size, font-weight)
- Shadows and effects
- Transitions and animations
- Pseudo-elements (::before, ::after)

### Unsafe to Modify:
- Element IDs
- Class names listed above
- Data attributes
- Element hierarchy that JS depends on
- Display properties that hide/show elements

### Best Practices:
1. Add new classes for styling rather than modifying existing ones
2. Use CSS custom properties for theming
3. Create modifier classes (e.g., `.btn--large` instead of changing `.btn`)
4. Document any new classes added
5. Test all functionality after CSS changes

## Testing Checklist

After making CSS changes, verify:
- [ ] Quantity controls work (increase/decrease)
- [ ] Price calculations update correctly
- [ ] Accordions expand/collapse
- [ ] Staff view toggle works
- [ ] Transfer locations can be added/removed (DTF)
- [ ] Location selection works (DTG)
- [ ] All pricing displays update
- [ ] Loading states display correctly
- [ ] Error messages appear when needed
- [ ] Responsive behavior is maintained