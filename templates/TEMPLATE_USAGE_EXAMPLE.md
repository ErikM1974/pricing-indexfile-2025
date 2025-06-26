# Template Usage Example: Screen Print Calculator

This example shows how to implement a new calculator using the template system.

## Step 1: Configuration

Create your configuration values:
```json
{
  "name": "Screen Print",
  "title": "Screen Print Pricing Calculator",
  "subtitle": "Calculate pricing based on colors and quantity",
  "urlPath": "screenprint-2025",
  "type": "ScreenPrint",
  "className": "ScreenPrintCalculator",
  "quotePrefix": "SP",
  "icon": "print",
  "emailTemplateId": "ScreenPrint_Template"
}
```

## Step 2: Copy and Rename Files

```bash
# Copy templates
cp templates/calculator-template.html calculators/screenprint-2025.html
cp templates/quote-service-template.js calculators/screenprint-quote-service.js
```

## Step 3: Replace Placeholders

In `screenprint-2025.html`, replace:
- `{{CALCULATOR_TITLE}}` → "Screen Print Pricing Calculator"
- `{{CALCULATOR_NAME}}` → "Screen Print"
- `{{CALCULATOR_TYPE}}` → "ScreenPrint"
- `{{CALCULATOR_CLASS_NAME}}` → "ScreenPrintCalculator"
- `{{QUOTE_PREFIX}}` → "SP"
- `{{EMAIL_TEMPLATE_ID}}` → "ScreenPrint_Template"
- etc.

## Step 4: Add Custom Fields

Replace the example form fields with screen print specific ones:

```html
<!-- Number of Colors -->
<div class="form-group">
    <label class="form-label" for="numColors">Number of Colors</label>
    <select id="numColors" class="form-select">
        <option value="1">1 Color</option>
        <option value="2">2 Colors</option>
        <option value="3">3 Colors</option>
        <option value="4">4+ Colors</option>
    </select>
</div>

<!-- Print Locations -->
<div class="form-group">
    <label class="form-label" for="locations">Print Locations</label>
    <select id="locations" class="form-select" multiple>
        <option value="front">Front</option>
        <option value="back">Back</option>
        <option value="sleeve">Sleeve</option>
    </select>
</div>

<!-- Quantity -->
<div class="form-group">
    <label class="form-label" for="quantity">Quantity</label>
    <input type="number" id="quantity" class="form-input" min="1" placeholder="Enter quantity">
</div>
```

## Step 5: Implement Pricing Logic

In the `handleCalculate` method:

```javascript
handleCalculate(e) {
    e.preventDefault();
    
    const numColors = parseInt(this.numColorsSelect.value);
    const quantity = parseInt(this.quantityInput.value);
    const locations = Array.from(this.locationsSelect.selectedOptions)
        .map(opt => opt.value);
    
    // Screen print pricing logic
    let basePrice = 0;
    if (numColors === 1) basePrice = 5.00;
    else if (numColors === 2) basePrice = 6.50;
    else if (numColors === 3) basePrice = 8.00;
    else basePrice = 10.00;
    
    // Additional location charges
    const locationCharge = (locations.length - 1) * 2.00;
    
    // Quantity discounts
    if (quantity >= 144) basePrice *= 0.8;
    else if (quantity >= 72) basePrice *= 0.9;
    
    const unitPrice = basePrice + locationCharge;
    const totalCost = unitPrice * quantity;
    
    // Apply LTM if needed
    let ltmFee = 0;
    if (quantity < 24) {
        ltmFee = 50.00;
        const ltmPerUnit = ltmFee / quantity;
        unitPrice += ltmPerUnit;
    }
    
    this.currentQuote = {
        customerName: this.customerNameInput.value,
        projectName: this.projectNameInput.value,
        numColors,
        locations,
        quantity,
        unitPrice,
        totalCost: unitPrice * quantity,
        ltmFee
    };
    
    this.displayResults();
}
```

## Step 6: Dashboard Entry

Add to `/staff-dashboard.html`:

```html
<a href="calculators/screenprint-2025.html" class="calculator-card">
    <i class="fas fa-print calculator-icon"></i>
    <span class="calculator-name">Screen Print</span>
    <span class="new-badge">NEW 2025</span>
</a>
```

## Step 7: Create EmailJS Template

In EmailJS, create template with variables:
- `to_email`
- `customer_name` 
- `project_name`
- `quote_id`
- `num_colors`
- `locations`
- `quantity`
- `unit_price`
- `grand_total`
- etc.

## Time Breakdown

- Configuration: 5 minutes
- File setup: 5 minutes
- Custom fields: 10 minutes
- Pricing logic: 15 minutes
- Testing: 10 minutes
- EmailJS: 10 minutes
- Documentation: 5 minutes

**Total: ~60 minutes**

## Result

You now have a fully functional Screen Print calculator with:
- Custom pricing logic
- Email quotes
- Database saving
- Professional UI
- Responsive design

All in about an hour!