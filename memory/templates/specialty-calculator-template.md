# Specialty Calculator Template

## Overview
Specialty calculators handle unique products with specific pricing structures and features.

## Example 1: Laser Tumbler Calculator

### HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laser Tumbler Pricing - Northwest Custom Apparel</title>

    <!-- Shared Styles -->
    <link href="manual-calculator-styles.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <!-- EmailJS -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Tumbler Service -->
    <script src="laser-tumbler-service.js"></script>
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
                    <span>Laser Tumbler Pricing</span>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="main-container">
        <!-- Page Title -->
        <h1 class="page-title">Laser Tumbler Pricing Calculator</h1>
        <p class="page-subtitle">Polar Camel Vacuum Insulated Tumblers</p>

        <!-- Product Features Banner -->
        <div class="features-banner">
            <div class="feature-item">
                <i class="fas fa-fire"></i>
                <span>Keeps Hot 8+ Hours</span>
            </div>
            <div class="feature-item">
                <i class="fas fa-snowflake"></i>
                <span>Keeps Cold 24+ Hours</span>
            </div>
            <div class="feature-item">
                <i class="fas fa-shield-alt"></i>
                <span>Double-Wall Vacuum</span>
            </div>
            <div class="feature-item">
                <i class="fas fa-award"></i>
                <span>Lifetime Warranty</span>
            </div>
        </div>

        <!-- Calculator Grid -->
        <div class="calculator-grid">
            <!-- Left Column: Product Selection -->
            <div>
                <!-- Product Selection Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-mug-hot"></i> Select Tumbler
                        </h2>
                    </div>
                    <div class="card-body">
                        <!-- Product Grid -->
                        <div class="product-grid">
                            <div class="product-card active" data-product="16oz-pint">
                                <img src="[tumbler-image]" alt="16 oz Pint">
                                <h4>16 oz. Pint</h4>
                                <p class="product-price">from $16.68</p>
                                <span class="product-badge">Most Popular</span>
                            </div>
                            <div class="product-card" data-product="20oz">
                                <img src="[tumbler-image]" alt="20 oz">
                                <h4>20 oz.</h4>
                                <p class="product-price">from $17.85</p>
                            </div>
                            <div class="product-card" data-product="30oz">
                                <img src="[tumbler-image]" alt="30 oz">
                                <h4>30 oz.</h4>
                                <p class="product-price">from $21.40</p>
                            </div>
                            <div class="product-card" data-product="wine">
                                <img src="[tumbler-image]" alt="Wine Tumbler">
                                <h4>Wine Tumbler</h4>
                                <p class="product-price">from $15.75</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Color Selection Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-palette"></i> Select Color
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="color-grid">
                            <div class="color-option active" data-color="black">
                                <div class="color-swatch" style="background: #000"></div>
                                <span>Black</span>
                            </div>
                            <div class="color-option" data-color="white">
                                <div class="color-swatch" style="background: #fff; border: 1px solid #ddd"></div>
                                <span>White</span>
                            </div>
                            <div class="color-option" data-color="navy">
                                <div class="color-swatch" style="background: #001f3f"></div>
                                <span>Navy</span>
                            </div>
                            <div class="color-option" data-color="red">
                                <div class="color-swatch" style="background: #dc3545"></div>
                                <span>Red</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Engraving Options Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-pen-fancy"></i> Engraving Options
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="secondLogo"
                                       onchange="calculator.updateSecondLogo(this.checked)">
                                Add Second Logo/Design (+$3.16 per tumbler)
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="individualNames"
                                       onchange="calculator.updateIndividualNames(this.checked)">
                                Individual Names/Personalization (+$2.00 per tumbler)
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Pricing -->
            <div>
                <!-- Quantity Selection Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-boxes"></i> Select Quantity
                        </h2>
                    </div>
                    <div class="card-body">
                        <!-- Case Quantity Options -->
                        <div class="quantity-options">
                            <div class="quantity-card active" data-quantity="24">
                                <h4>1 Case</h4>
                                <p class="quantity-count">24 tumblers</p>
                                <p class="unit-price">$16.68 each</p>
                            </div>
                            <div class="quantity-card" data-quantity="120">
                                <h4>5 Cases</h4>
                                <p class="quantity-count">120 tumblers</p>
                                <p class="unit-price">$16.10 each</p>
                                <span class="savings-badge">Save $69.60</span>
                            </div>
                            <div class="quantity-card" data-quantity="240">
                                <h4>10 Cases</h4>
                                <p class="quantity-count">240 tumblers</p>
                                <p class="unit-price">$15.53 each</p>
                                <span class="savings-badge">Save $276.00</span>
                            </div>
                            <div class="quantity-card custom" data-quantity="custom">
                                <h4>Custom</h4>
                                <input type="number" id="customQuantity"
                                       placeholder="Enter qty"
                                       min="24" step="24"
                                       onchange="calculator.updateCustomQuantity(this.value)">
                                <p class="quantity-note">Min 24 (1 case)</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pricing Breakdown Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-calculator"></i> Pricing Summary
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="pricing-summary">
                            <div class="summary-row">
                                <span>Product:</span>
                                <span id="summaryProduct">16 oz. Pint</span>
                            </div>
                            <div class="summary-row">
                                <span>Color:</span>
                                <span id="summaryColor">Black</span>
                            </div>
                            <div class="summary-row">
                                <span>Quantity:</span>
                                <span id="summaryQuantity">24 tumblers (1 case)</span>
                            </div>
                            <div class="summary-divider"></div>
                            <div class="summary-row">
                                <span>Base Price per Unit:</span>
                                <span>$<span id="summaryUnitPrice">16.68</span></span>
                            </div>
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>$<span id="summarySubtotal">400.32</span></span>
                            </div>
                            <div class="summary-row" id="secondLogoRow" style="display: none;">
                                <span>Second Logo:</span>
                                <span>$<span id="summarySecondLogo">0.00</span></span>
                            </div>
                            <div class="summary-row" id="namesRow" style="display: none;">
                                <span>Individual Names:</span>
                                <span>$<span id="summaryNames">0.00</span></span>
                            </div>
                            <div class="summary-row">
                                <span>Setup Fee:</span>
                                <span>$<span id="summarySetup">75.00</span></span>
                            </div>
                            <div class="summary-row total">
                                <span><strong>Total:</strong></span>
                                <span><strong>$<span id="summaryTotal">475.32</span></strong></span>
                            </div>
                            <div class="summary-row savings" id="savingsRow" style="display: none;">
                                <span>You Save:</span>
                                <span class="savings-amount">$<span id="summarySavings">0.00</span></span>
                            </div>
                        </div>

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
            </div>
        </div>
    </main>

    <script>
        // Initialize calculator
        const calculator = new LaserTumblerCalculator(TUMBLER_CONFIG);
        calculator.init();
    </script>
</body>
</html>
```

### JavaScript Implementation

```javascript
// Tumbler Configuration
const TUMBLER_CONFIG = {
    products: {
        '16oz-pint': {
            name: '16 oz. Pint',
            model: 'PC16PINT',
            pricing: [
                { quantity: 24, cases: 1, unitPrice: 16.68, description: '1 Case' },
                { quantity: 120, cases: 5, unitPrice: 16.10, description: '5 Cases' },
                { quantity: 240, cases: 10, unitPrice: 15.53, description: '10 Cases' }
            ]
        },
        '20oz': {
            name: '20 oz.',
            model: 'PC20',
            pricing: [
                { quantity: 24, cases: 1, unitPrice: 17.85 },
                { quantity: 120, cases: 5, unitPrice: 17.22 },
                { quantity: 240, cases: 10, unitPrice: 16.60 }
            ]
        },
        '30oz': {
            name: '30 oz.',
            model: 'PC30',
            pricing: [
                { quantity: 24, cases: 1, unitPrice: 21.40 },
                { quantity: 120, cases: 5, unitPrice: 20.66 },
                { quantity: 240, cases: 10, unitPrice: 19.92 }
            ]
        },
        'wine': {
            name: 'Wine Tumbler',
            model: 'PCWINE',
            pricing: [
                { quantity: 24, cases: 1, unitPrice: 15.75 },
                { quantity: 120, cases: 5, unitPrice: 15.20 },
                { quantity: 240, cases: 10, unitPrice: 14.66 }
            ]
        }
    },

    colors: ['Black', 'White', 'Navy', 'Red', 'Royal', 'Silver'],

    // Additional options
    setupFee: 75.00,
    secondLogoPrice: 3.16,
    individualNamesPrice: 2.00,
    minimumQuantity: 24,

    // Product features
    features: [
        { icon: '🔥', text: 'Keeps Hot 8+ Hours' },
        { icon: '❄️', text: 'Keeps Cold 24+ Hours' },
        { icon: '🛡️', text: 'Double-Wall Vacuum' },
        { icon: '🏆', text: 'Lifetime Warranty' }
    ]
};

// Laser Tumbler Calculator Class
class LaserTumblerCalculator {
    constructor(config) {
        this.config = config;
        this.quoteService = new TumblerQuoteService();

        this.state = {
            selectedProduct: '16oz-pint',
            selectedColor: 'black',
            quantity: 24,
            secondLogo: false,
            individualNames: false,
            currentPricing: null
        };
    }

    init() {
        this.attachEventListeners();
        this.calculateAndDisplay();
    }

    attachEventListeners() {
        // Product selection
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const product = e.currentTarget.dataset.product;
                this.selectProduct(product);
            });
        });

        // Color selection
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const color = e.currentTarget.dataset.color;
                this.selectColor(color);
            });
        });

        // Quantity selection
        document.querySelectorAll('.quantity-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const quantity = e.currentTarget.dataset.quantity;
                if (quantity !== 'custom') {
                    this.selectQuantity(parseInt(quantity));
                }
            });
        });
    }

    selectProduct(productKey) {
        // Update UI
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-product="${productKey}"]`)?.classList.add('active');

        // Update state
        this.state.selectedProduct = productKey;

        // Recalculate
        this.calculateAndDisplay();
    }

    selectColor(color) {
        // Update UI
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');

        // Update state
        this.state.selectedColor = color;

        // Update display
        document.getElementById('summaryColor').textContent =
            color.charAt(0).toUpperCase() + color.slice(1);
    }

    selectQuantity(quantity) {
        // Update UI
        document.querySelectorAll('.quantity-card').forEach(card => {
            card.classList.remove('active');
        });

        // Find matching quantity card
        const matchingCard = document.querySelector(`[data-quantity="${quantity}"]`);
        if (matchingCard) {
            matchingCard.classList.add('active');
        } else {
            // Custom quantity
            document.querySelector('[data-quantity="custom"]').classList.add('active');
            document.getElementById('customQuantity').value = quantity;
        }

        // Update state
        this.state.quantity = quantity;

        // Recalculate
        this.calculateAndDisplay();
    }

    updateCustomQuantity(value) {
        const quantity = parseInt(value) || this.config.minimumQuantity;

        // Round to nearest case (24)
        const cases = Math.ceil(quantity / 24);
        const adjustedQuantity = cases * 24;

        if (adjustedQuantity !== quantity) {
            document.getElementById('customQuantity').value = adjustedQuantity;
            this.showInfo(`Adjusted to ${cases} case(s) - ${adjustedQuantity} tumblers`);
        }

        this.state.quantity = adjustedQuantity;
        this.calculateAndDisplay();
    }

    updateSecondLogo(checked) {
        this.state.secondLogo = checked;
        this.calculateAndDisplay();
    }

    updateIndividualNames(checked) {
        this.state.individualNames = checked;
        this.calculateAndDisplay();
    }

    calculatePricing() {
        const product = this.config.products[this.state.selectedProduct];
        if (!product) return null;

        const { quantity, secondLogo, individualNames } = this.state;

        // Find pricing tier
        let unitPrice = product.pricing[0].unitPrice; // Default to 1 case price
        let tierInfo = product.pricing[0];

        for (const tier of product.pricing) {
            if (quantity >= tier.quantity) {
                unitPrice = tier.unitPrice;
                tierInfo = tier;
            }
        }

        // Calculate base pricing
        const subtotal = unitPrice * quantity;

        // Add options
        const secondLogoTotal = secondLogo ? (this.config.secondLogoPrice * quantity) : 0;
        const namesTotal = individualNames ? (this.config.individualNamesPrice * quantity) : 0;

        // Setup fee
        const setupFee = this.config.setupFee;

        // Calculate total
        const total = subtotal + secondLogoTotal + namesTotal + setupFee;

        // Calculate savings (compared to 1 case price)
        const baseUnitPrice = product.pricing[0].unitPrice;
        const savings = quantity > 24 ? ((baseUnitPrice - unitPrice) * quantity) : 0;

        return {
            product: product.name,
            quantity: quantity,
            cases: Math.ceil(quantity / 24),
            unitPrice: unitPrice,
            subtotal: subtotal,
            secondLogoTotal: secondLogoTotal,
            namesTotal: namesTotal,
            setupFee: setupFee,
            total: total,
            savings: savings
        };
    }

    calculateAndDisplay() {
        const pricing = this.calculatePricing();
        if (!pricing) return;

        this.state.currentPricing = pricing;

        // Update summary
        document.getElementById('summaryProduct').textContent = pricing.product;
        document.getElementById('summaryQuantity').textContent =
            `${pricing.quantity} tumblers (${pricing.cases} case${pricing.cases > 1 ? 's' : ''})`;
        document.getElementById('summaryUnitPrice').textContent = pricing.unitPrice.toFixed(2);
        document.getElementById('summarySubtotal').textContent = pricing.subtotal.toFixed(2);
        document.getElementById('summarySetup').textContent = pricing.setupFee.toFixed(2);
        document.getElementById('summaryTotal').textContent = pricing.total.toFixed(2);

        // Second logo row
        if (pricing.secondLogoTotal > 0) {
            document.getElementById('secondLogoRow').style.display = '';
            document.getElementById('summarySecondLogo').textContent =
                pricing.secondLogoTotal.toFixed(2);
        } else {
            document.getElementById('secondLogoRow').style.display = 'none';
        }

        // Names row
        if (pricing.namesTotal > 0) {
            document.getElementById('namesRow').style.display = '';
            document.getElementById('summaryNames').textContent =
                pricing.namesTotal.toFixed(2);
        } else {
            document.getElementById('namesRow').style.display = 'none';
        }

        // Savings row
        if (pricing.savings > 0) {
            document.getElementById('savingsRow').style.display = '';
            document.getElementById('summarySavings').textContent =
                pricing.savings.toFixed(2);
        } else {
            document.getElementById('savingsRow').style.display = 'none';
        }
    }

    async generateQuote() {
        // Implementation similar to other calculators
        console.log('Generating tumbler quote...', this.state.currentPricing);
    }

    reset() {
        this.state = {
            selectedProduct: '16oz-pint',
            selectedColor: 'black',
            quantity: 24,
            secondLogo: false,
            individualNames: false,
            currentPricing: null
        };

        // Reset UI
        this.selectProduct('16oz-pint');
        this.selectColor('black');
        this.selectQuantity(24);
        document.getElementById('secondLogo').checked = false;
        document.getElementById('individualNames').checked = false;

        this.calculateAndDisplay();
    }

    showInfo(message) {
        console.info(message);
    }
}
```

## Example 2: Richardson Caps Calculator

### Configuration

```javascript
const RICHARDSON_CAPS_CONFIG = {
    // Multiple cap styles available
    styles: [
        {
            styleNumber: '112',
            name: 'Richardson 112 - Trucker',
            basePrice: 8.50,
            features: ['Mid-Profile', 'Pre-Curved', 'Snapback'],
            image: '[cap-112-image]'
        },
        {
            styleNumber: '115',
            name: 'Richardson 115 - Low Profile',
            basePrice: 7.75,
            features: ['Low-Profile', 'Pre-Curved', 'Snapback'],
            image: '[cap-115-image]'
        },
        {
            styleNumber: '168',
            name: 'Richardson 168 - Performance',
            basePrice: 9.25,
            features: ['Performance', 'Moisture Wicking', 'Stretch Fit'],
            image: '[cap-168-image]'
        }
    ],

    // Embroidery pricing
    embroideryPricing: {
        '5000': { label: 'Up to 5K stitches', price: 3.50 },
        '10000': { label: '5K-10K stitches', price: 4.50 },
        '15000': { label: '10K-15K stitches', price: 5.50 }
    },

    // 3D Puff option
    puffEmbroideryPricing: {
        '5000': { label: '3D Puff - Up to 5K', price: 5.00 },
        '10000': { label: '3D Puff - 5K-10K', price: 6.50 }
    },

    // Leatherette patch option
    patchPricing: {
        '2x2': { label: '2" x 2"', price: 4.00 },
        '2x3': { label: '2" x 3"', price: 4.50 },
        '3x3': { label: '3" x 3"', price: 5.00 }
    },

    // Quantity discounts
    quantityDiscounts: [
        { min: 24, max: 47, discount: 0 },
        { min: 48, max: 143, discount: 0.05 },
        { min: 144, max: 999, discount: 0.10 }
    ],

    // Setup and minimums
    setupFee: 75.00,
    minimumQuantity: 24,
    digitizingFee: 75.00 // One-time for new logos
};
```

## CSS for Specialty Calculators

```css
/* Specialty calculator styles */
.features-banner {
    display: flex;
    justify-content: space-around;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
}

.feature-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.feature-item i {
    font-size: 1.25rem;
}

.product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
}

.product-card {
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
}

.product-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.product-card.active {
    border-color: var(--primary-color);
    background: var(--primary-lighter);
}

.product-card img {
    width: 100%;
    height: auto;
    margin-bottom: 0.5rem;
}

.product-badge {
    position: absolute;
    top: -0.5rem;
    right: -0.5rem;
    background: #ff6b35;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 100px;
    font-size: 0.75rem;
    font-weight: 600;
}

.color-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.color-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
}

.color-option:hover {
    background: #f5f7fa;
}

.color-option.active {
    background: var(--primary-lighter);
}

.color-swatch {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.quantity-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.quantity-card {
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
}

.quantity-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.quantity-card.active {
    border-color: var(--primary-color);
    background: var(--primary-lighter);
}

.quantity-card h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
}

.quantity-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 0.25rem 0;
}

.unit-price {
    font-weight: 600;
    color: var(--primary-color);
    margin: 0;
}

.savings-badge {
    position: absolute;
    top: -0.5rem;
    right: -0.5rem;
    background: #4cb354;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 100px;
    font-size: 0.75rem;
    font-weight: 600;
}

.quantity-card.custom input {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.pricing-summary {
    padding: 1rem;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
}

.summary-divider {
    border-top: 2px solid var(--border-color);
    margin: 1rem 0;
}

.summary-row.total {
    padding-top: 1rem;
    border-top: 2px solid var(--primary-color);
    font-size: 1.125rem;
}

.summary-row.savings {
    color: #4cb354;
    font-weight: 600;
}

.savings-amount {
    color: #4cb354;
}

/* Specialty product features */
.decoration-options {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
}

.option-card {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
}

.option-card:hover {
    background: #f5f7fa;
}

.option-card.selected {
    background: var(--primary-lighter);
    border-color: var(--primary-color);
}

.option-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.option-price {
    color: var(--primary-color);
    font-size: 0.875rem;
}
```

---

**Template Type**: Specialty Calculator
**Use Cases**: Laser tumblers, Richardson caps, embroidered emblems, webstores
**Key Features**: Fixed product options, case quantities, special decorations