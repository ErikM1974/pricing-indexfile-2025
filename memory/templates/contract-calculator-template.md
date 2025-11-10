# Contract/Corporate Calculator Template

## Overview
Contract calculators use fixed pricing from pre-negotiated contracts without base cost input.

## HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contract [METHOD] Pricing - Northwest Custom Apparel</title>

    <!-- Shared Styles -->
    <link href="manual-calculator-styles.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <!-- EmailJS -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Contract Service -->
    <script src="[method]-contract-service.js"></script>
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
                    <span>Contract [METHOD] Pricing</span>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <main class="main-container">
        <!-- Page Title -->
        <h1 class="page-title">Contract [METHOD] Pricing Calculator</h1>
        <p class="page-subtitle">Fixed contract pricing for [Client Name]</p>

        <!-- Contract Info Banner -->
        <div class="contract-banner">
            <div class="contract-info">
                <span class="contract-label">Contract:</span>
                <span class="contract-name">[Contract Name 2025]</span>
            </div>
            <div class="contract-status">
                <span class="status-badge active">Active</span>
                <span class="contract-dates">Valid through Dec 31, 2025</span>
            </div>
        </div>

        <!-- Hero Pricing Display -->
        <div class="hero-section">
            <div class="hero-summary">
                <span id="heroQuantity">48</span> items ×
                <span id="heroLocation">Left Chest</span> print
            </div>
            <div class="hero-prices">
                <div class="hero-price-container">
                    <div class="hero-price-label">Contract Price</div>
                    <div class="hero-price" id="heroUnitPrice">$12.50</div>
                </div>
                <div class="hero-price-container">
                    <div class="hero-price-label">Total</div>
                    <div class="hero-price" id="heroTotalPrice">$600.00</div>
                </div>
            </div>
        </div>

        <!-- Calculator Grid -->
        <div class="calculator-grid">
            <!-- Left Column: Options -->
            <div>
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
                               value="48"
                               min="24"
                               onchange="calculator.updateQuantity(this.value)">
                        <small class="form-text">Minimum order: 24 pieces</small>
                    </div>

                    <!-- Location Selection -->
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

                    <!-- Rush Order Option -->
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox"
                                   id="rushOrder"
                                   onchange="calculator.updateRushOrder(this.checked)">
                            Rush Order (+25% surcharge)
                        </label>
                    </div>
                </div>

                <!-- Contract Details Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-file-contract"></i> Contract Details
                        </h2>
                    </div>
                    <div class="contract-details">
                        <div class="detail-row">
                            <span>Setup Fee:</span>
                            <span>$50 (under 48 qty)</span>
                        </div>
                        <div class="detail-row">
                            <span>Rush Surcharge:</span>
                            <span>25% of base price</span>
                        </div>
                        <div class="detail-row">
                            <span>Annual Minimum:</span>
                            <span>$10,000</span>
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
                            <i class="fas fa-calculator"></i> Contract Pricing
                        </h2>
                    </div>

                    <div id="pricingBreakdown">
                        <table class="breakdown-table">
                            <tbody>
                                <tr>
                                    <td>Contract Rate:</td>
                                    <td class="text-right">
                                        $<span id="breakdownRate">12.50</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Quantity:</td>
                                    <td class="text-right">
                                        <span id="breakdownQty">48</span>
                                    </td>
                                </tr>
                                <tr class="subtotal-row">
                                    <td>Subtotal:</td>
                                    <td class="text-right">
                                        $<span id="breakdownSubtotal">600.00</span>
                                    </td>
                                </tr>
                                <tr id="setupRow" style="display: none;">
                                    <td>Setup Fee:</td>
                                    <td class="text-right">
                                        $<span id="breakdownSetup">50.00</span>
                                    </td>
                                </tr>
                                <tr id="rushRow" style="display: none;">
                                    <td>Rush Surcharge:</td>
                                    <td class="text-right">
                                        $<span id="breakdownRush">0.00</span>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td><strong>Total:</strong></td>
                                    <td class="text-right">
                                        <strong>$<span id="breakdownTotal">600.00</span></strong>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Price Matrix Reference -->
                        <div class="price-matrix">
                            <h4>Contract Price Matrix</h4>
                            <table class="matrix-table">
                                <thead>
                                    <tr>
                                        <th>Quantity</th>
                                        <th>Left Chest</th>
                                        <th>Full Front</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>24-47</td>
                                        <td>$12.50</td>
                                        <td>$15.00</td>
                                    </tr>
                                    <tr>
                                        <td>48-71</td>
                                        <td>$11.00</td>
                                        <td>$13.50</td>
                                    </tr>
                                    <tr>
                                        <td>72-143</td>
                                        <td>$10.00</td>
                                        <td>$12.50</td>
                                    </tr>
                                    <tr>
                                        <td>144+</td>
                                        <td>$9.00</td>
                                        <td>$11.50</td>
                                    </tr>
                                </tbody>
                            </table>
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
        const calculator = new ContractPricingCalculator(CONTRACT_CONFIG);
        calculator.init();
    </script>
</body>
</html>
```

## JavaScript Implementation

```javascript
// Contract Configuration
const CONTRACT_CONFIG = {
    contractName: 'Corporate DTG Contract 2025',
    clientName: 'Acme Corporation',
    contractExpiry: '2025-12-31',

    // Fixed pricing by tier - no margin calculation
    pricing: {
        'LC': { // Left Chest
            '24-47': 12.50,
            '48-71': 11.00,
            '72-143': 10.00,
            '144+': 9.00
        },
        'FF': { // Full Front
            '24-47': 15.00,
            '48-71': 13.50,
            '72-143': 12.50,
            '144+': 11.50
        },
        'FB': { // Full Back
            '24-47': 15.00,
            '48-71': 13.50,
            '72-143': 12.50,
            '144+': 11.50
        }
    },

    // Contract-specific fees
    setupFee: 50.00,           // Applied when quantity < 48
    rushCharge: 1.25,           // Multiplier for rush orders
    annualMinimum: 10000,       // Annual commitment
    minimumOrder: 24,

    // No base cost input - prices are fixed
    requiresBaseCost: false
};

// Contract Calculator Class
class ContractPricingCalculator {
    constructor(config) {
        this.config = config;
        this.quoteService = new ContractQuoteService();

        this.state = {
            quantity: 48,
            selectedLocation: 'LC',
            rushOrder: false,
            currentPricing: null
        };
    }

    init() {
        // Set initial values
        document.getElementById('quantity').value = this.state.quantity;

        // Display contract info
        this.displayContractInfo();

        // Calculate initial pricing
        this.calculateAndDisplay();

        // Attach event listeners
        this.attachEventListeners();
    }

    displayContractInfo() {
        // Update contract banner
        const contractName = document.querySelector('.contract-name');
        if (contractName) {
            contractName.textContent = this.config.contractName;
        }

        // Check contract expiry
        const expiryDate = new Date(this.config.contractExpiry);
        const today = new Date();
        const daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 30) {
            // Show warning if contract expires soon
            const statusBadge = document.querySelector('.status-badge');
            statusBadge.classList.add('expiring-soon');
            statusBadge.textContent = `Expires in ${daysRemaining} days`;
        }
    }

    calculatePricing() {
        const { quantity, selectedLocation, rushOrder } = this.state;

        // Get tier for quantity
        const tierKey = this.getTierKey(quantity);
        if (!tierKey) return null;

        // Get fixed price from contract
        let unitPrice = this.config.pricing[selectedLocation][tierKey];
        if (!unitPrice) {
            console.error('No price found for', selectedLocation, tierKey);
            return null;
        }

        // Calculate base pricing
        let subtotal = unitPrice * quantity;
        let setupFee = 0;
        let rushSurcharge = 0;

        // Apply setup fee if under minimum tier
        if (quantity < 48) {
            setupFee = this.config.setupFee;
        }

        // Apply rush surcharge if selected
        if (rushOrder) {
            rushSurcharge = subtotal * (this.config.rushCharge - 1);
            unitPrice = unitPrice * this.config.rushCharge;
        }

        // Calculate total
        const totalPrice = subtotal + setupFee + rushSurcharge;

        return {
            contractName: this.config.contractName,
            unitPrice: unitPrice,
            quantity: quantity,
            subtotal: subtotal,
            setupFee: setupFee,
            rushSurcharge: rushSurcharge,
            totalPrice: totalPrice,
            rushOrder: rushOrder,
            tierKey: tierKey,
            location: selectedLocation
        };
    }

    getTierKey(quantity) {
        if (quantity < this.config.minimumOrder) return null;
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        if (quantity <= 143) return '72-143';
        return '144+';
    }

    updateQuantity(value) {
        const quantity = parseInt(value) || this.config.minimumOrder;

        // Enforce minimum
        if (quantity < this.config.minimumOrder) {
            document.getElementById('quantity').value = this.config.minimumOrder;
            this.state.quantity = this.config.minimumOrder;
            this.showWarning(`Minimum order quantity is ${this.config.minimumOrder}`);
        } else {
            this.state.quantity = quantity;
        }

        // Update display
        document.getElementById('heroQuantity').textContent = this.state.quantity;
        this.calculateAndDisplay();
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
        this.calculateAndDisplay();
    }

    updateRushOrder(isRush) {
        this.state.rushOrder = isRush;
        this.calculateAndDisplay();
    }

    calculateAndDisplay() {
        const pricing = this.calculatePricing();
        if (!pricing) return;

        this.state.currentPricing = pricing;

        // Update hero section
        document.getElementById('heroUnitPrice').textContent =
            `$${pricing.unitPrice.toFixed(2)}`;
        document.getElementById('heroTotalPrice').textContent =
            `$${pricing.totalPrice.toFixed(2)}`;

        // Update breakdown
        this.updateBreakdown(pricing);
    }

    updateBreakdown(pricing) {
        // Update values
        document.getElementById('breakdownRate').textContent =
            pricing.unitPrice.toFixed(2);
        document.getElementById('breakdownQty').textContent =
            pricing.quantity;
        document.getElementById('breakdownSubtotal').textContent =
            pricing.subtotal.toFixed(2);

        // Setup fee row
        if (pricing.setupFee > 0) {
            document.getElementById('setupRow').style.display = '';
            document.getElementById('breakdownSetup').textContent =
                pricing.setupFee.toFixed(2);
        } else {
            document.getElementById('setupRow').style.display = 'none';
        }

        // Rush surcharge row
        if (pricing.rushSurcharge > 0) {
            document.getElementById('rushRow').style.display = '';
            document.getElementById('breakdownRush').textContent =
                pricing.rushSurcharge.toFixed(2);
        } else {
            document.getElementById('rushRow').style.display = 'none';
        }

        // Total
        document.getElementById('breakdownTotal').textContent =
            pricing.totalPrice.toFixed(2);

        // Highlight active tier in matrix
        this.highlightActiveTier(pricing.tierKey);
    }

    highlightActiveTier(tierKey) {
        // Remove all highlights
        document.querySelectorAll('.matrix-table tr').forEach(row => {
            row.classList.remove('active-tier');
        });

        // Add highlight to active tier
        const tierMap = {
            '24-47': 1,
            '48-71': 2,
            '72-143': 3,
            '144+': 4
        };

        const rowIndex = tierMap[tierKey];
        if (rowIndex) {
            const rows = document.querySelectorAll('.matrix-table tbody tr');
            if (rows[rowIndex - 1]) {
                rows[rowIndex - 1].classList.add('active-tier');
            }
        }
    }

    async generateQuote() {
        if (!this.state.currentPricing) {
            alert('Please calculate pricing first');
            return;
        }

        try {
            // Show loading
            this.showLoading();

            // Generate quote with contract details
            const result = await this.quoteService.generateQuote({
                contractName: this.config.contractName,
                clientName: this.config.clientName,
                pricing: this.state.currentPricing,
                quantity: this.state.quantity,
                location: this.state.selectedLocation,
                rushOrder: this.state.rushOrder
            });

            if (result.success) {
                this.showSuccess(`Contract quote generated: ${result.quoteId}`);
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
            quantity: 48,
            selectedLocation: 'LC',
            rushOrder: false,
            currentPricing: null
        };

        // Reset inputs
        document.getElementById('quantity').value = 48;
        document.getElementById('rushOrder').checked = false;

        // Reset display
        this.selectLocation('LC');
        this.calculateAndDisplay();
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

    showWarning(message) {
        // Implementation depends on UI framework
        console.warn(message);
    }

    showSuccess(message) {
        // Implementation depends on UI framework
        console.log(message);
    }

    showLoading() {
        // Implementation depends on UI framework
    }

    hideLoading() {
        // Implementation depends on UI framework
    }

    attachEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.generateQuote();
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.contractCalculator = new ContractPricingCalculator(CONTRACT_CONFIG);
});
```

## Contract Quote Service

```javascript
class ContractQuoteService extends BaseQuoteService {
    constructor() {
        super();
        this.quotePrefix = 'CON'; // Contract quote prefix
    }

    async generateQuote(quoteData) {
        const quoteID = this.generateQuoteID(this.quotePrefix);

        try {
            // Prepare quote session
            const sessionData = {
                QuoteID: quoteID,
                SessionID: `contract_${Date.now()}`,
                ContractName: quoteData.contractName,
                ClientName: quoteData.clientName,
                TotalQuantity: quoteData.quantity,
                TotalAmount: quoteData.pricing.totalPrice,
                Status: 'Contract Quote',
                Notes: `Rush: ${quoteData.rushOrder ? 'Yes' : 'No'}`,
                ExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString().replace(/\.\d{3}Z$/, '')
            };

            // Save to database
            await this.saveToDatabase({
                session: sessionData,
                items: [{
                    QuoteID: quoteID,
                    ProductDescription: 'Contract Pricing',
                    PrintLocation: quoteData.location,
                    Quantity: quoteData.quantity,
                    UnitPrice: quoteData.pricing.unitPrice,
                    TotalPrice: quoteData.pricing.totalPrice
                }]
            });

            return { success: true, quoteId: quoteID };

        } catch (error) {
            console.error('Contract quote generation failed:', error);
            return { success: false, error: error.message };
        }
    }
}
```

## CSS Additions for Contract Calculators

```css
/* Contract-specific styles */
.contract-banner {
    background: linear-gradient(135deg, #2d5f3f, #4cb354);
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.contract-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.contract-label {
    opacity: 0.8;
    font-size: 0.875rem;
}

.contract-name {
    font-weight: 600;
    font-size: 1.125rem;
}

.status-badge {
    background: #4cb354;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
    font-size: 0.875rem;
    font-weight: 500;
}

.status-badge.expiring-soon {
    background: #ff9800;
}

.contract-dates {
    font-size: 0.875rem;
    opacity: 0.9;
    margin-left: 0.5rem;
}

.contract-details {
    padding: 1rem;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.detail-row:last-child {
    border-bottom: none;
}

.price-matrix {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.matrix-table {
    width: 100%;
    margin-top: 1rem;
}

.matrix-table th {
    background: #f5f7fa;
    padding: 0.5rem;
    text-align: left;
    font-weight: 600;
}

.matrix-table td {
    padding: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
}

.matrix-table tr.active-tier {
    background: #e8f5e9;
    font-weight: 600;
}

.checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
    margin-right: 0.5rem;
}
```

---

**Template Type**: Contract/Corporate Calculator
**Use Case**: Fixed pricing based on pre-negotiated contracts
**Key Feature**: No base cost input required