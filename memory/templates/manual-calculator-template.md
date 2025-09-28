# Manual Pricing Calculator Template

## Complete HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manual [METHOD] Pricing - Northwest Custom Apparel</title>

    <!-- Shared Styles -->
    <link href="manual-calculator-styles.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <!-- EmailJS -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Quote Service -->
    <script src="[method]-manual-service.js"></script>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-container">
            <div class="header-left">
                <img src="[logo-url]" alt="NWCA" class="logo">
                <nav class="breadcrumb">
                    <a href="/staff-dashboard.html">Dashboard</a>
                    <span>/</span>
                    <span>Manual [METHOD] Pricing</span>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="main-container">
        <!-- Page Title -->
        <h1 class="page-title">Manual [METHOD] Pricing Calculator</h1>
        <p class="page-subtitle">Enter base cost to calculate pricing with margins</p>

        <!-- Hero Pricing Display -->
        <div class="hero-section placeholder-mode" id="heroSection">
            <div class="hero-summary">
                <span id="heroQuantity">24</span> items ×
                <span id="heroLocation">Left Chest</span> print
            </div>
            <div class="hero-prices">
                <div class="hero-price-container">
                    <div class="hero-price-label">Per Item</div>
                    <div class="hero-price placeholder" id="heroUnitPrice">
                        Enter base cost
                    </div>
                    <div class="hero-price-sublabel" id="heroMargin"></div>
                </div>
                <div class="hero-price-container">
                    <div class="hero-price-label">Total</div>
                    <div class="hero-price placeholder" id="heroTotalPrice">
                        Enter base cost
                    </div>
                    <div class="hero-price-sublabel" id="heroLtmNote"></div>
                </div>
            </div>
        </div>

        <!-- Calculator Grid -->
        <div class="calculator-grid">
            <!-- Left Column: Inputs -->
            <div>
                <!-- Base Cost Card -->
                <div class="card" id="baseCostCard">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-dollar-sign"></i> Base Cost Input
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="form-group highlight-base-cost">
                            <div class="base-cost-arrow">
                                <i class="fas fa-arrow-down"></i>
                            </div>
                            <label for="basePrice" class="form-label">
                                Enter Base Garment Cost <span class="required">*</span>
                            </label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="number"
                                       id="basePrice"
                                       class="form-control base-cost-emphasis"
                                       placeholder="0.00"
                                       step="0.01"
                                       min="0"
                                       required>
                            </div>
                            <small class="form-text">
                                Enter the actual cost of the garment from vendor
                            </small>
                        </div>
                    </div>
                </div>

                <!-- Options Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-cogs"></i> Options
                        </h2>
                    </div>

                    <!-- Quantity -->
                    <div class="form-group">
                        <label for="quantity" class="form-label">Quantity</label>
                        <input type="number"
                               id="quantity"
                               class="form-control"
                               value="24"
                               min="12"
                               onchange="calculator.updateQuantity(this.value)">
                    </div>

                    <!-- Location Selection (if applicable) -->
                    <div class="form-group">
                        <label class="form-label">Print Location</label>
                        <div class="location-cards">
                            <div class="location-card active"
                                 data-location="LC"
                                 onclick="calculator.selectLocation('LC')">
                                <div class="location-icon">👔</div>
                                <div class="location-name">Left Chest</div>
                            </div>
                            <div class="location-card"
                                 data-location="FF"
                                 onclick="calculator.selectLocation('FF')">
                                <div class="location-icon">👕</div>
                                <div class="location-name">Full Front</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Results -->
            <div>
                <!-- Pricing Breakdown Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-calculator"></i> Pricing Breakdown
                        </h2>
                    </div>

                    <div id="pricingResults">
                        <!-- Placeholder when no base cost -->
                        <div class="pricing-placeholder">
                            <i class="fas fa-arrow-left"></i>
                            <h3>Enter Base Cost to Calculate</h3>
                            <p>Input the garment cost to see pricing</p>
                        </div>
                    </div>

                    <!-- Results template (hidden initially) -->
                    <div id="pricingBreakdown" style="display: none;">
                        <table class="breakdown-table">
                            <tbody>
                                <tr>
                                    <td>Base Cost:</td>
                                    <td class="text-right">
                                        $<span id="breakdownBase">0.00</span>
                                    </td>
                                </tr>
                                <tr class="highlight">
                                    <td>With Margin (<span id="marginPercent">0</span>%):</td>
                                    <td class="text-right">
                                        $<span id="breakdownMargin">0.00</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Decoration Cost:</td>
                                    <td class="text-right">
                                        $<span id="breakdownDecoration">0.00</span>
                                    </td>
                                </tr>
                                <tr id="ltmRow" style="display: none;">
                                    <td>LTM Fee:</td>
                                    <td class="text-right">
                                        $<span id="breakdownLTM">0.00</span>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>Unit Price:</strong></td>
                                    <td class="text-right">
                                        <strong>$<span id="breakdownUnit">0.00</span></strong>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>Total (<span id="breakdownQty">24</span>):</strong></td>
                                    <td class="text-right">
                                        <strong>$<span id="breakdownTotal">0.00</span></strong>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Action Buttons -->
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="calculator.generateQuote()">
                                <i class="fas fa-file-invoice"></i> Generate Quote
                            </button>
                            <button class="btn btn-secondary" onclick="calculator.reset()">
                                <i class="fas fa-redo"></i> Reset
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Quote Info (shown after generation) -->
                <div class="card" id="quoteCard" style="display: none;">
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <div>
                            <strong>Quote Generated!</strong><br>
                            Quote ID: <span id="quoteId"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <script>
        // Initialize calculator
        const calculator = new ManualPricingCalculator(MANUAL_CONFIG);
        calculator.init();
    </script>
</body>
</html>
```

## Configuration Template

```javascript
const MANUAL_CONFIG = {
    // Method-specific settings
    method: 'DTG',
    methodName: 'Direct-to-Garment',

    // Quantity tiers with margin denominators
    tiers: [
        {
            label: '12-23',
            min: 12,
            max: 23,
            marginDenominator: 0.5,  // 100% markup
            ltmFee: 50.00
        },
        {
            label: '24-47',
            min: 24,
            max: 47,
            marginDenominator: 0.55, // ~82% markup
            ltmFee: 0
        },
        {
            label: '48-71',
            min: 48,
            max: 71,
            marginDenominator: 0.60, // ~67% markup
            ltmFee: 0
        },
        {
            label: '72+',
            min: 72,
            max: 9999,
            marginDenominator: 0.65, // ~54% markup
            ltmFee: 0
        }
    ],

    // Decoration costs by tier and location
    decorationCosts: {
        'LC': { // Left Chest
            '12-23': 6.00,
            '24-47': 5.50,
            '48-71': 5.00,
            '72+': 4.50
        },
        'FF': { // Full Front
            '12-23': 9.00,
            '24-47': 8.50,
            '48-71': 8.00,
            '72+': 7.50
        }
    },

    // Minimum thresholds
    ltmThreshold: 24,
    minimumOrder: 12
};
```

## Calculator Class Implementation

```javascript
class ManualPricingCalculator {
    constructor(config) {
        this.config = config;
        this.quoteService = new ManualQuoteService();

        this.state = {
            basePrice: 0,
            quantity: 24,
            selectedLocation: 'LC',
            currentPricing: null
        };

        this.init();
    }

    init() {
        // Set initial values
        document.getElementById('quantity').value = this.state.quantity;

        // Add input listeners
        this.attachEventListeners();

        // Focus on base price input
        document.getElementById('basePrice')?.focus();
    }

    calculatePricing() {
        const { basePrice, quantity, selectedLocation } = this.state;

        // Step 1: Get tier for quantity
        const tier = this.getTierForQuantity(quantity);
        if (!tier) return null;

        // Step 2: Apply margin to base cost
        const garmentWithMargin = basePrice / tier.marginDenominator;

        // Step 3: Add decoration cost
        const decorationCost = this.getDecorationCost(tier.label, selectedLocation);

        // Step 4: Calculate subtotal
        const subtotal = garmentWithMargin + decorationCost;

        // Step 5: Apply LTM fee if under minimum
        let ltmFeePerUnit = 0;
        if (quantity < this.config.ltmThreshold && tier.ltmFee > 0) {
            ltmFeePerUnit = tier.ltmFee / quantity;
        }

        // Step 6: Calculate final price
        const unitPrice = subtotal + ltmFeePerUnit;
        const totalPrice = unitPrice * quantity;

        return {
            basePrice: basePrice,
            garmentWithMargin: garmentWithMargin,
            marginPercent: ((garmentWithMargin - basePrice) / basePrice * 100),
            decorationCost: decorationCost,
            subtotal: subtotal,
            ltmFeePerUnit: ltmFeePerUnit,
            ltmFeeTotal: ltmFeePerUnit * quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            tier: tier.label,
            marginDenominator: tier.marginDenominator
        };
    }

    getTierForQuantity(quantity) {
        return this.config.tiers.find(tier =>
            quantity >= tier.min && quantity <= tier.max
        );
    }

    getDecorationCost(tierLabel, location) {
        return this.config.decorationCosts[location]?.[tierLabel] || 0;
    }

    // Additional methods for UI updates...
    // See full implementation in the complete guide
}
```

---

**Template Type**: Manual Calculator
**Use Case**: Sales staff manually entering base costs