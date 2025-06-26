# New Calculator Implementation Checklist

Use this checklist when adding a new pricing calculator to the NWCA system. Expected time: 30-60 minutes.

## Pre-Implementation Planning

- [ ] **Calculator Name**: _______________________ (e.g., "Richardson Caps")
- [ ] **Quote Prefix**: _______ (3-4 letters, e.g., "RICH", "DTG", "EMB")
- [ ] **Calculator Type**: _______________________ (e.g., "screenprint", "embroidery")
- [ ] **Dashboard Section**: 
  - [ ] Contract Pricing
  - [ ] Customer Supplied Goods
  - [ ] Specialty Items

## Step 1: Prepare Configuration (5 minutes)

- [ ] Copy `/templates/calculator-config-template.json` to your workspace
- [ ] Fill in all placeholder values
- [ ] Choose appropriate Font Awesome icon for dashboard
- [ ] Determine pricing logic type (tiered/flat/custom)

## Step 2: Create Quote Service (10 minutes)

- [ ] Copy `/templates/quote-service-template.js` 
- [ ] Save as `/calculators/{{name}}-quote-service.js`
- [ ] Replace all {{PLACEHOLDERS}} with your values:
  - [ ] CALCULATOR_TYPE
  - [ ] CALCULATOR_CLASS
  - [ ] QUOTE_PREFIX
  - [ ] STORAGE_KEY
  - [ ] SESSION_PREFIX
  - [ ] EMBELLISHMENT_TYPE
- [ ] Customize pricing tier logic if needed
- [ ] Update item data structure for your calculator

## Step 3: Create Calculator HTML (20 minutes)

- [ ] Copy `/templates/calculator-template.html`
- [ ] Save as `/calculators/{{name}}.html`
- [ ] Replace all {{PLACEHOLDERS}} with your values
- [ ] Add calculator-specific form fields
- [ ] Implement pricing calculation logic
- [ ] Customize results display
- [ ] Add any unique styling needed

## Step 4: Create EmailJS Template (10 minutes)

- [ ] Log into EmailJS dashboard
- [ ] Create new email template
- [ ] Template name: `{{Calculator}}_Template`
- [ ] Copy email HTML structure from existing template
- [ ] Required variables:
  - [ ] to_email
  - [ ] reply_to
  - [ ] customer_name
  - [ ] project_name
  - [ ] quote_id
  - [ ] quote_date
  - [ ] quote_summary
  - [ ] grand_total
  - [ ] sales_rep_name
  - [ ] sales_rep_email
  - [ ] sales_rep_phone
  - [ ] company_year
- [ ] Add calculator-specific variables as needed
- [ ] Save and note the template ID

## Step 5: Add to Dashboard (5 minutes)

- [ ] Open `/staff-dashboard.html`
- [ ] Find the appropriate section (Contract/Customer/Specialty)
- [ ] Add calculator card:
```html
<a href="calculators/{{url-path}}.html" class="calculator-card">
    <i class="fas fa-{{icon}}} calculator-icon"></i>
    <span class="calculator-name">{{Display Name}}</span>
    <span class="new-badge">NEW 2025</span>
</a>
```

## Step 6: Testing (10 minutes)

### Basic Functionality
- [ ] Calculator loads without errors
- [ ] Form validation works
- [ ] Calculations are correct
- [ ] Results display properly

### Quote Functionality
- [ ] Quote modal opens
- [ ] Sales rep dropdown works
- [ ] Preview shows correct information
- [ ] Email sends successfully
- [ ] Email contains correct data
- [ ] Quote saves to database (check console)

### Database Verification
- [ ] Check quote_sessions table for new entry
- [ ] Check quote_items table for new entry(ies)
- [ ] Verify quote ID format is correct

## Step 7: Documentation (5 minutes)

- [ ] Add entry to CLAUDE.md under "Calculator Implementations"
- [ ] Include:
  - [ ] Calculator name and purpose
  - [ ] Date implemented
  - [ ] Quote prefix used
  - [ ] Any special pricing logic
  - [ ] EmailJS template ID

## Common Issues & Solutions

### Issue: "Container not found" error
**Solution**: Check that all element IDs in JavaScript match HTML

### Issue: Email shows raw HTML
**Solution**: Use triple braces `{{{variable}}}` in EmailJS for HTML content

### Issue: Quote not saving
**Solution**: Check console for API errors, verify all required fields

### Issue: Pricing calculations wrong
**Solution**: Review margin formulas and tier breakpoints

### Issue: Modal not opening
**Solution**: Ensure onclick handler references correct variable name

## Quick Reference

### Standard API Endpoint
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
```

### Quote ID Format
```
{{PREFIX}}{{MMDD}}-{{sequence}}
Example: RICH0126-1, DTG0126-2
```

### Standard Margin Formula
```javascript
const markedUpPrice = basePrice / 0.6;
```

### LTM (Less Than Minimum) Pattern
```javascript
if (quantity < 24) {
    ltmFee = 50.00;
    ltmPerUnit = ltmFee / quantity;
}
```

## Notes Section

Use this space to document any calculator-specific details:

_________________________________________________

_________________________________________________

_________________________________________________

_________________________________________________

## Sign-off

- [ ] Calculator tested and working
- [ ] Documentation updated
- [ ] Ready for production use

**Implemented by**: _______________________ **Date**: _______________________