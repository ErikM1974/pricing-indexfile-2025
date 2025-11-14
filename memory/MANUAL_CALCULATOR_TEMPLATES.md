# Manual Calculator Implementation & Templates

**Last Updated:** 2025-11-14
**Purpose:** Complete HTML/JS templates and implementation patterns for manual calculators
**Part:** 2 of 3 - Implementation

## 📚 Complete Guide Navigation
- **Part 1:** [Concepts & Architecture](MANUAL_CALCULATOR_CONCEPTS.md) - Calculator types, pricing formulas
- **Part 2: Implementation & Templates** (this file) - HTML/JS code, quote service
- **Part 3:** [Testing & Reference](MANUAL_CALCULATOR_REFERENCE.md) - Testing, quick reference, checklist

---

## Table of Contents
1. [HTML Template](#html-template)
2. [JavaScript Implementation](#javascript-implementation)
3. [Quote Service Pattern](#quote-service)
4. [Shared CSS System](#shared-css)

---

## HTML Template {#html-template}

### Complete Manual Pricing Calculator Template
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

    <style>
        /* Method-specific styles if needed */
    </style>
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
                <span id="heroQuantity">24</span> items
            </div>
            <div class="hero-prices">
                <div class="hero-price-container">
                    <div class="hero-price-label">Per Item</div>
                    <div class="hero-price placeholder" id="heroUnitPrice">
                        Enter base cost
                    </div>
                </div>
                <div class="hero-price-container">
                    <div class="hero-price-label">Total</div>
                    <div class="hero-price placeholder" id="heroTotalPrice">
                        Enter base cost
                    </div>
                </div>
            </div>
        </div>

        <!-- Calculator Grid -->
        <div class="calculator-grid">
            <!-- Left Column: Inputs -->
            <div>
                <!-- Base Cost Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-dollar-sign"></i> Base Cost
                        </h2>
                    </div>
                    <div class="form-group">
                        <label for="basePrice" class="form-label">
                            Base Garment Cost <span class="required">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input type="number"
                                   id="basePrice"
                                   class="form-control"
                                   step="0.01"
                                   min="0"
                                   placeholder="0.00"
                                   onchange="calculator.updateBasePrice(this.value)">
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

## JavaScript Implementation {#javascript-implementation}

### Complete Manual Calculator Class
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

    attachEventListeners() {
        // Base price input with debounce
        let basePriceTimeout;
        document.getElementById('basePrice')?.addEventListener('input', (e) => {
            clearTimeout(basePriceTimeout);
            basePriceTimeout = setTimeout(() => {
                this.updateBasePrice(e.target.value);
            }, 500);
        });

        // Quantity change
        document.getElementById('quantity')?.addEventListener('change', (e) => {
            this.updateQuantity(e.target.value);
        });

        // Print functionality
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.printQuote();
            }
        });
    }

    updateBasePrice(value) {
        this.state.basePrice = parseFloat(value) || 0;

        if (this.state.basePrice > 0) {
            // Remove placeholder mode
            document.getElementById('heroSection')?.classList.remove('placeholder-mode');
            document.getElementById('baseCostCard')?.classList.remove('highlight-base-cost');

            // Calculate and display pricing
            this.calculateAndDisplay();
        } else {
            // Show placeholder
            this.showPlaceholder();
        }
    }

    updateQuantity(value) {
        const quantity = parseInt(value) || this.config.minimumOrder;

        // Enforce minimum
        if (quantity < this.config.minimumOrder) {
            document.getElementById('quantity').value = this.config.minimumOrder;
            this.state.quantity = this.config.minimumOrder;
        } else {
            this.state.quantity = quantity;
        }

        // Update display
        document.getElementById('heroQuantity').textContent = this.state.quantity;

        // Recalculate if we have base price
        if (this.state.basePrice > 0) {
            this.calculateAndDisplay();
        }
    }

    selectLocation(locationCode) {
        // Update UI
        document.querySelectorAll('.location-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-location="${locationCode}"]`)?.classList.add('active');

        // Update state
        this.state.selectedLocation = locationCode;

        // Update hero display
        const locationName = this.getLocationName(locationCode);
        document.getElementById('heroLocation').textContent = locationName;

        // Recalculate
        if (this.state.basePrice > 0) {
            this.calculateAndDisplay();
        }
    }

    calculateAndDisplay() {
        const pricing = this.calculatePricing();
        if (!pricing) return;

        this.state.currentPricing = pricing;

        // Update hero section
        this.updateHeroDisplay(pricing);

        // Update breakdown
        this.updateBreakdown(pricing);
    }

    updateHeroDisplay(pricing) {
        // Update unit price
        const unitPriceEl = document.getElementById('heroUnitPrice');
        unitPriceEl.innerHTML = `$${pricing.unitPrice.toFixed(2)}`;

        // Update total price
        const totalPriceEl = document.getElementById('heroTotalPrice');
        totalPriceEl.innerHTML = `$${pricing.totalPrice.toFixed(2)}`;

        // Show margin info
        document.getElementById('heroMargin').textContent =
            `${pricing.marginPercent.toFixed(0)}% margin`;

        // Show LTM note if applicable
        if (pricing.ltmFeeTotal > 0) {
            document.getElementById('heroLtmNote').textContent =
                `Includes $${pricing.ltmFeeTotal.toFixed(2)} LTM fee`;
        } else {
            document.getElementById('heroLtmNote').textContent = '';
        }
    }

    updateBreakdown(pricing) {
        // Hide placeholder
        document.querySelector('.pricing-placeholder').style.display = 'none';

        // Show breakdown
        document.getElementById('pricingBreakdown').style.display = 'block';

        // Update values
        document.getElementById('breakdownBase').textContent =
            pricing.basePrice.toFixed(2);
        document.getElementById('breakdownMargin').textContent =
            pricing.garmentWithMargin.toFixed(2);
        document.getElementById('marginPercent').textContent =
            pricing.marginPercent.toFixed(0);
        document.getElementById('breakdownDecoration').textContent =
            pricing.decorationCost.toFixed(2);

        // LTM fee row
        if (pricing.ltmFeePerUnit > 0) {
            document.getElementById('ltmRow').style.display = '';
            document.getElementById('breakdownLTM').textContent =
                pricing.ltmFeePerUnit.toFixed(2);
        } else {
            document.getElementById('ltmRow').style.display = 'none';
        }

        // Totals
        document.getElementById('breakdownUnit').textContent =
            pricing.unitPrice.toFixed(2);
        document.getElementById('breakdownQty').textContent =
            pricing.quantity || this.state.quantity;
        document.getElementById('breakdownTotal').textContent =
            pricing.totalPrice.toFixed(2);
    }

    showPlaceholder() {
        // Add placeholder mode
        document.getElementById('heroSection')?.classList.add('placeholder-mode');

        // Show placeholder in hero
        document.getElementById('heroUnitPrice').innerHTML =
            '<span class="placeholder">Enter base cost</span>';
        document.getElementById('heroTotalPrice').innerHTML =
            '<span class="placeholder">Enter base cost</span>';

        // Hide breakdown, show placeholder
        document.getElementById('pricingBreakdown').style.display = 'none';
        document.querySelector('.pricing-placeholder').style.display = 'block';
    }

    async generateQuote() {
        if (!this.state.currentPricing) {
            alert('Please enter base cost and calculate pricing first');
            return;
        }

        try {
            // Show loading
            this.showLoading();

            // Generate quote
            const result = await this.quoteService.generateQuote({
                method: this.config.method,
                pricing: this.state.currentPricing,
                quantity: this.state.quantity,
                location: this.state.selectedLocation,
                basePrice: this.state.basePrice
            });

            if (result.success) {
                // Show success
                document.getElementById('quoteCard').style.display = 'block';
                document.getElementById('quoteId').textContent = result.quoteId;

                // Optionally send email
                if (confirm('Send quote to customer?')) {
                    await this.quoteService.sendEmail(result.quoteId);
                }
            }

        } catch (error) {
            console.error('Quote generation failed:', error);
            alert('Failed to generate quote. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    reset() {
        // Reset state
        this.state = {
            basePrice: 0,
            quantity: 24,
            selectedLocation: 'LC',
            currentPricing: null
        };

        // Reset inputs
        document.getElementById('basePrice').value = '';
        document.getElementById('quantity').value = 24;

        // Reset display
        this.showPlaceholder();

        // Hide quote card
        document.getElementById('quoteCard').style.display = 'none';

        // Focus base price
        document.getElementById('basePrice').focus();
    }

    // Helper methods
    getLocationName(code) {
        const locations = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'RS': 'Right Sleeve',
            'LS': 'Left Sleeve'
        };
        return locations[code] || code;
    }

    showLoading() {
        // Implementation depends on UI framework
    }

    hideLoading() {
        // Implementation depends on UI framework
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.manualCalculator = new ManualPricingCalculator(MANUAL_CONFIG);
});
```

## Quote Service Pattern {#quote-service}

### Base Quote Service Class
```javascript
class BaseQuoteService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';

        // Initialize EmailJS
        emailjs.init(this.emailjsPublicKey);
    }

    generateQuoteID(prefix) {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000);
        return `${prefix}${month}${day}-${String(random).padStart(4, '0')}`;
    }

    async saveToDatabase(quoteData) {
        // Save session
        const sessionResponse = await fetch(`${this.apiBase}/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quoteData.session)
        });

        if (!sessionResponse.ok) {
            throw new Error('Failed to save quote session');
        }

        // Save items
        for (const item of quoteData.items) {
            await fetch(`${this.apiBase}/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        }

        return true;
    }

    async sendEmail(templateId, emailData) {
        return await emailjs.send(
            this.emailjsServiceId,
            templateId,
            emailData
        );
    }
}
```

## Shared CSS System {#shared-css}

The `manual-calculator-styles.css` file provides consistent styling:

```css
/* Root variables - NWCA Green Theme */
:root {
    --primary-color: #4cb354;
    --primary-dark: #2d5f3f;
    --primary-light: #4cb861;
    --primary-lighter: #e8f5e9;
    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
}

/* Card Component */
.card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
}

/* Calculator Grid */
.calculator-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
}

/* Hero Section */
.hero-section {
    background: linear-gradient(to right, var(--primary-lighter), #f8f9fa);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    text-align: center;
}

/* Form Controls */
.form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s;
}

.form-control:focus {
    border-color: var(--primary-color);
    outline: none;
    box-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
}

/* Buttons */
.btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.3);
}
```

