# Comprehensive Bundle Calculator Development Guide

**Last Updated:** 2025-01-27
**Purpose:** Complete guide for creating promotional product bundles with multi-step wizards and special pricing

## Table of Contents
1. [Overview: Bundle Calculators vs Regular Pricing](#overview)
2. [Bundle Architecture Patterns](#bundle-patterns)
3. [Multi-Step Wizard Implementation](#multi-step-wizard)
4. [Bundle Pricing Strategies](#pricing-strategies)
5. [HTML Template](#html-template)
6. [JavaScript Implementation](#javascript-implementation)
7. [Gift Box Visualization](#gift-box-visualization)
8. [Size Distribution Management](#size-distribution)
9. [Database & Quote Service](#database-service)
10. [Testing & Common Issues](#testing-issues)

## Overview: Bundle Calculators vs Regular Pricing {#overview}

### Bundle Calculators
- **Purpose:** Promotional packages combining multiple products at special pricing
- **Examples:** Christmas Gift Box, Breast Cancer Awareness Bundle, Back-to-School Bundle
- **Key Features:**
  - Fixed or tiered bundle pricing
  - Multiple products in one package
  - Multi-step wizard interface
  - Special promotional deadlines
  - Database persistence with quote generation
  - Email notifications to customer and sales team

### Regular Pricing Calculators
- **Purpose:** Individual product pricing with decoration options
- **Examples:** DTG, Screen Print, Embroidery calculators
- **Key Features:**
  - Per-piece pricing based on quantity tiers
  - Single product focus
  - Real-time price updates
  - No database persistence (session only)

## Bundle Architecture Patterns {#bundle-patterns}

### Pattern 1: Simple Fixed Bundle (BCA Style)
- **Use Case:** Fixed products at fixed price points
- **Example:** Breast Cancer Bundle - 8 bundles minimum at $45 each
- **Structure:**
  ```
  Step 1: Products → Show bundle contents (fixed)
  Step 2: Sizes → Distribute quantities across sizes
  Step 3: Contact → Customer information
  Step 4: Review → Confirm and submit
  ```
- **Benefits:** Simple, clear pricing, easy to understand

### Pattern 2: Complex Multi-Product Bundle (Christmas Style)
- **Use Case:** Customer selects from product options
- **Example:** Christmas Gift Box - Choose jacket, hoodie, beanie, gloves
- **Structure:**
  ```
  Step 1: Select Jacket → Choose from 3 options
  Step 2: Select Hoodie → Choose from 2 options
  Step 3: Select Beanie → Single option
  Step 4: Select Gloves → Single option
  Step 5: Customize → Add logo/embroidery
  Step 6: Delivery → Shipping or pickup
  Step 7: Review → Confirm and submit
  ```
- **Benefits:** Flexibility, personalization, higher perceived value

## Multi-Step Wizard Implementation {#multi-step-wizard}

### Step Indicator Component
```html
<!-- Step Progress Bar -->
<div class="flex items-center justify-center mb-12">
    <div class="flex items-center">
        <!-- Step 1 -->
        <div id="step-indicator-1" class="flex items-center text-pink-600 relative">
            <div class="rounded-full h-12 w-12 flex items-center justify-center bg-pink-600 text-white font-bold">1</div>
            <div class="absolute top-0 -ml-10 text-center mt-16 w-32 text-xs font-medium uppercase">Products</div>
        </div>

        <!-- Connector Line -->
        <div id="step-line-1" class="flex-auto border-t-2 transition duration-500 ease-in-out border-gray-300"></div>

        <!-- Step 2 -->
        <div id="step-indicator-2" class="flex items-center text-gray-500 relative">
            <div class="rounded-full h-12 w-12 flex items-center justify-center border-2 border-gray-300">2</div>
            <div class="absolute top-0 -ml-10 text-center mt-16 w-32 text-xs font-medium uppercase">Sizes</div>
        </div>
    </div>
</div>
```

### Step Navigation JavaScript
```javascript
class BundleWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.stepData = {};
        this.highestStepReached = 1;

        this.init();
    }

    init() {
        this.updateStepIndicators();
        this.updateNavigation();
        this.attachEventListeners();
    }

    nextStep() {
        if (!this.validateStep(this.currentStep)) {
            return false;
        }

        // Save current step data
        this.saveStepData(this.currentStep);

        // Move to next step
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.highestStepReached = Math.max(this.highestStepReached, this.currentStep);
            this.showStep(this.currentStep);
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });

        // Show current step
        const currentStepEl = document.getElementById(`step-${stepNumber}`);
        if (currentStepEl) {
            currentStepEl.classList.add('active');
            currentStepEl.style.display = 'block';
        }

        // Update UI
        this.updateStepIndicators();
        this.updateNavigation();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    validateStep(stepNumber) {
        // Step-specific validation logic
        switch(stepNumber) {
            case 1:
                return this.validateProducts();
            case 2:
                return this.validateSizes();
            case 3:
                return this.validateContact();
            default:
                return true;
        }
    }

    updateStepIndicators() {
        for (let i = 1; i <= this.totalSteps; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            const line = document.getElementById(`step-line-${i}`);

            if (i < this.currentStep) {
                // Completed step
                indicator.innerHTML = `
                    <div class="rounded-full h-12 w-12 flex items-center justify-center bg-green-500 text-white">
                        <i class="fas fa-check"></i>
                    </div>
                `;
                if (line) line.classList.add('border-green-500');
            } else if (i === this.currentStep) {
                // Current step
                indicator.className = 'flex items-center text-pink-600 relative';
            } else {
                // Future step
                indicator.className = 'flex items-center text-gray-500 relative';
            }
        }
    }
}
```

## Bundle Pricing Strategies {#pricing-strategies}

### Fixed Bundle Pricing
```javascript
// Breast Cancer Bundle - Fixed price per bundle
const BUNDLE_CONFIG = {
    pricePerBundle: 45,
    minimumBundles: 8,
    products: [
        { type: 'shirt', included: true },
        { type: 'cap', included: true }
    ],

    calculateTotal: function(quantity) {
        // Enforce minimum
        const bundles = Math.max(quantity, this.minimumBundles);
        return bundles * this.pricePerBundle;
    }
};
```

### Tiered Bundle Pricing
```javascript
// Christmas Bundle - Tiered pricing based on quantity
const BUNDLE_TIERS = [
    { min: 1, max: 11, price: 125 },
    { min: 12, max: 23, price: 115 },
    { min: 24, max: 47, price: 105 },
    { min: 48, max: null, price: 95 }
];

function getBundlePrice(quantity) {
    const tier = BUNDLE_TIERS.find(t =>
        quantity >= t.min && (t.max === null || quantity <= t.max)
    );
    return tier ? tier.price : BUNDLE_TIERS[0].price;
}
```

### Dynamic Bundle Pricing
```javascript
// Calculate bundle price based on selected products
function calculateDynamicBundle(selectedProducts) {
    let total = 0;
    let retailValue = 0;

    selectedProducts.forEach(product => {
        // Add wholesale cost
        total += product.wholesaleCost;

        // Track retail value for savings display
        retailValue += product.retailPrice;
    });

    // Apply bundle discount
    const bundleDiscount = 0.15; // 15% off
    const bundlePrice = total * (1 - bundleDiscount);

    // Add gift box cost
    const giftBoxCost = 5;

    return {
        bundlePrice: Math.ceil(bundlePrice + giftBoxCost),
        retailValue: retailValue,
        savings: retailValue - (bundlePrice + giftBoxCost)
    };
}
```

## HTML Template {#html-template}

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Holiday/Event] Bundle - Northwest Custom Apparel</title>

    <!-- Tailwind CSS for rapid styling -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <!-- EmailJS for notifications -->
    <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

    <!-- Bundle Service -->
    <script src="[bundle-name]-service.js"></script>

    <style>
        /* Bundle-specific animations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out;
        }

        /* Step content visibility */
        .step-content {
            display: none;
        }

        .step-content.active {
            display: block;
        }

        /* Promotional deadline banner */
        .deadline-banner {
            background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
            position: relative;
            overflow: hidden;
        }

        .deadline-banner::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }
    </style>
</head>
<body>
    <div class="bundle-app bg-gray-50 min-h-screen">

        <!-- Header -->
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="container mx-auto px-6 py-3">
                <img src="[logo-url]" alt="NWCA" class="h-10">
            </div>
        </header>

        <!-- Deadline Banner -->
        <div class="deadline-banner text-white p-4 text-center">
            <h3 class="text-xl font-bold">
                ⏰ ORDER BY [DATE] for [Event]!
            </h3>
            <p>Only <span id="daysLeft"></span> days remaining</p>
        </div>

        <!-- Main Content -->
        <main class="container mx-auto px-6 py-8">

            <!-- Title -->
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold text-[theme-color]">
                    [Bundle Name]
                </h1>
                <p class="mt-4 text-lg text-gray-600">
                    [Bundle Tagline]
                </p>
            </div>

            <!-- Step Progress -->
            <div class="mb-12">
                [Step indicator component here]
            </div>

            <!-- Step Content -->
            <div id="step-1" class="step-content active">
                <!-- Products/Bundle Overview -->
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h2 class="text-2xl font-bold mb-6">What's Included</h2>

                    <!-- Product Grid -->
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- Product cards -->
                    </div>

                    <!-- Quantity Selection -->
                    <div class="mt-8">
                        <label class="block text-lg font-medium mb-4">
                            Number of Bundles
                        </label>
                        <div class="flex items-center gap-4">
                            <button onclick="adjustQuantity(-1)" class="btn-adjust">-</button>
                            <input type="number" id="bundleQuantity" value="8" min="8" class="quantity-input">
                            <button onclick="adjustQuantity(1)" class="btn-adjust">+</button>
                        </div>
                        <p class="mt-2 text-sm text-gray-600">
                            Minimum order: 8 bundles
                        </p>
                    </div>

                    <!-- Price Display -->
                    <div class="mt-8 p-6 bg-gray-50 rounded-lg">
                        <div class="flex justify-between items-center">
                            <span class="text-lg">Total:</span>
                            <span class="text-3xl font-bold text-[theme-color]">
                                $<span id="totalPrice">360</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div id="step-2" class="step-content">
                <!-- Size Distribution -->
                [Size distribution component]
            </div>

            <div id="step-3" class="step-content">
                <!-- Customer Information -->
                [Contact form component]
            </div>

            <div id="step-4" class="step-content">
                <!-- Review & Submit -->
                [Review component]
            </div>

            <div id="step-success" class="step-content">
                <!-- Success Message -->
                <div class="text-center py-12">
                    <div class="text-6xl text-green-500 mb-4">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2 class="text-3xl font-bold mb-4">Order Submitted!</h2>
                    <p class="text-xl mb-2">Your quote ID is:</p>
                    <p class="text-2xl font-bold text-[theme-color]" id="displayQuoteId"></p>
                </div>
            </div>

        </main>

        <!-- Navigation -->
        <div class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div class="container mx-auto flex justify-between">
                <button id="prevBtn" onclick="wizard.prevStep()" class="btn-secondary">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <button id="nextBtn" onclick="wizard.nextStep()" class="btn-primary">
                    Continue <i class="fas fa-arrow-right"></i>
                </button>
                <button id="submitBtn" onclick="submitOrder()" class="btn-submit" style="display:none;">
                    Submit Order <i class="fas fa-check"></i>
                </button>
            </div>
        </div>

    </div>

    <script>
        // Initialize bundle wizard
        const wizard = new BundleWizard();

        // Calculate days until deadline
        function updateDeadline() {
            const deadline = new Date('[YYYY-MM-DD]');
            const today = new Date();
            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            document.getElementById('daysLeft').textContent = daysLeft;
        }

        // Initialize on load
        document.addEventListener('DOMContentLoaded', function() {
            updateDeadline();
            wizard.init();
        });
    </script>
</body>
</html>
```

## JavaScript Implementation {#javascript-implementation}

### Bundle Service Class
```javascript
class BundleService {
    constructor(config) {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsTemplateId = config.emailTemplateId;
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.quotePrefix = config.quotePrefix; // e.g., 'BCA', 'XMAS'
        this.bundleName = config.bundleName;
    }

    // Generate unique quote ID
    generateQuoteID() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sequence = Math.floor(Math.random() * 10000);
        return `${this.quotePrefix}${month}${day}-${String(sequence).padStart(4, '0')}`;
    }

    // Process complete order
    async processOrder(orderData) {
        try {
            const quoteId = this.generateQuoteID();

            // Save to database
            await this.saveToDatabase(quoteId, orderData);

            // Send notifications
            await this.sendCustomerEmail(quoteId, orderData);
            await this.sendSalesTeamEmail(quoteId, orderData);

            return {
                success: true,
                quoteId: quoteId,
                message: 'Order submitted successfully'
            };
        } catch (error) {
            console.error('Error processing order:', error);
            return {
                success: false,
                message: 'Failed to process order',
                error: error.message
            };
        }
    }

    // Save to database
    async saveToDatabase(quoteId, orderData) {
        // Prepare session data
        const sessionData = {
            SessionID: quoteId,
            QuoteID: quoteId,
            CustomerName: orderData.customerName,
            CustomerEmail: orderData.email,
            CompanyName: orderData.companyName,
            Phone: orderData.phone,
            TotalQuantity: orderData.bundleCount,
            SubtotalAmount: orderData.totalAmount,
            TotalAmount: orderData.totalAmount,
            Status: 'Bundle Order',
            ExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            Notes: this.formatNotes(orderData)
        };

        // Save session
        const response = await fetch(`${this.apiBase}/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            throw new Error('Failed to save quote session');
        }

        // Save line items
        const items = this.prepareLineItems(quoteId, orderData);
        for (const item of items) {
            await fetch(`${this.apiBase}/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        }
    }

    // Prepare line items
    prepareLineItems(quoteId, orderData) {
        const items = [];
        const bundleProducts = orderData.selectedProducts || this.getDefaultProducts();

        bundleProducts.forEach((product, index) => {
            items.push({
                SessionID: quoteId,
                LineNumber: index + 1,
                ProductDescription: product.name,
                StyleNumber: product.styleNumber,
                Color: product.color,
                Size: product.sizes ? JSON.stringify(product.sizes) : 'Mixed',
                Quantity: orderData.bundleCount,
                UnitPrice: product.price,
                TotalPrice: product.price * orderData.bundleCount,
                PrintMethod: 'Bundle',
                Notes: product.customization || ''
            });
        });

        return items;
    }

    // Send customer email
    async sendCustomerEmail(quoteId, orderData) {
        const emailData = {
            to_email: orderData.email,
            to_name: orderData.customerName,
            quote_id: quoteId,
            bundle_name: this.bundleName,
            quantity: orderData.bundleCount,
            total_price: orderData.totalAmount,
            // Add all other fields with defaults
            company_name: orderData.companyName || '',
            phone: orderData.phone || '',
            delivery_method: orderData.deliveryMethod || 'Ship',
            event_date: orderData.eventDate || '',
            notes: orderData.notes || ''
        };

        return await emailjs.send(
            this.emailjsServiceId,
            this.emailjsTemplateId,
            emailData,
            this.emailjsPublicKey
        );
    }
}
```

## Gift Box Visualization {#gift-box-visualization}

### 3D-Style Gift Box Component
```html
<!-- Gift Box Display -->
<div class="gift-box-container">
    <div class="gift-box">
        <!-- Box Base -->
        <div class="box-base"></div>

        <!-- Box Lid -->
        <div class="box-lid">
            <div class="ribbon-vertical"></div>
            <div class="ribbon-horizontal"></div>
            <div class="bow"></div>
        </div>

        <!-- Floating Product Icons -->
        <div class="product-icons">
            <div class="icon-float" data-product="jacket">
                <img src="jacket-icon.png" alt="Jacket">
            </div>
            <div class="icon-float" data-product="hoodie">
                <img src="hoodie-icon.png" alt="Hoodie">
            </div>
        </div>
    </div>

    <!-- Box Summary -->
    <div class="box-summary">
        <h3>Your Gift Box Contains:</h3>
        <ul id="boxContents">
            <!-- Dynamic content -->
        </ul>
    </div>
</div>

<style>
.gift-box-container {
    position: relative;
    width: 300px;
    height: 400px;
    margin: 0 auto;
}

.gift-box {
    position: relative;
    width: 100%;
    height: 70%;
    transform-style: preserve-3d;
    transform: rotateX(-15deg) rotateY(15deg);
    transition: transform 0.3s;
}

.gift-box:hover {
    transform: rotateX(-15deg) rotateY(25deg);
}

.box-base {
    position: absolute;
    width: 100%;
    height: 60%;
    bottom: 0;
    background: linear-gradient(135deg, #c41e3a, #dc3545);
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.box-lid {
    position: absolute;
    width: 110%;
    height: 15%;
    top: 35%;
    left: -5%;
    background: linear-gradient(135deg, #a01729, #c41e3a);
    border-radius: 10px;
    box-shadow: 0 -5px 20px rgba(0,0,0,0.1);
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}

.ribbon-vertical,
.ribbon-horizontal {
    position: absolute;
    background: gold;
}

.ribbon-vertical {
    width: 30px;
    height: 100%;
    left: 50%;
    transform: translateX(-50%);
}

.ribbon-horizontal {
    width: 100%;
    height: 30px;
    top: 50%;
    transform: translateY(-50%);
}

.bow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    background: gold;
    border-radius: 50%;
    box-shadow: 0 5px 15px rgba(255,215,0,0.5);
}

.product-icons {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.icon-float {
    position: absolute;
    animation: iconFloat 4s ease-in-out infinite;
}

.icon-float:nth-child(1) {
    top: -20px;
    left: 20%;
    animation-delay: 0s;
}

.icon-float:nth-child(2) {
    top: -20px;
    right: 20%;
    animation-delay: 1s;
}

@keyframes iconFloat {
    0%, 100% {
        transform: translateY(0) scale(1);
        opacity: 0.8;
    }
    50% {
        transform: translateY(-20px) scale(1.1);
        opacity: 1;
    }
}
</style>
```

### Dynamic Box Update
```javascript
function updateGiftBox(selectedProducts) {
    const boxContents = document.getElementById('boxContents');
    boxContents.innerHTML = '';

    let totalValue = 0;

    selectedProducts.forEach(product => {
        // Add to list
        const li = document.createElement('li');
        li.className = 'flex items-center gap-2 py-1';
        li.innerHTML = `
            <i class="fas fa-gift text-green-500"></i>
            <span>${product.name}</span>
            <span class="ml-auto text-gray-500">$${product.retailPrice}</span>
        `;
        boxContents.appendChild(li);

        // Update floating icon
        const icon = document.querySelector(`[data-product="${product.type}"]`);
        if (icon) {
            icon.classList.add('selected');
        }

        totalValue += product.retailPrice;
    });

    // Add total value
    const totalLi = document.createElement('li');
    totalLi.className = 'border-t pt-2 mt-2 font-bold';
    totalLi.innerHTML = `
        Total Retail Value: $${totalValue}
        <br>
        <span class="text-green-500">Your Price: $${calculateBundlePrice()}</span>
    `;
    boxContents.appendChild(totalLi);
}
```

## Size Distribution Management {#size-distribution}

### Size Distribution Component
```html
<div class="size-distribution">
    <h3 class="text-xl font-bold mb-4">Size Distribution</h3>

    <!-- Size Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="size-input-group">
            <label for="size-S" class="block text-sm font-medium mb-1">Small</label>
            <input type="number" id="size-S" min="0" value="0"
                   onchange="updateSizeTotal()"
                   class="size-input w-full px-3 py-2 border rounded">
        </div>

        <div class="size-input-group">
            <label for="size-M" class="block text-sm font-medium mb-1">Medium</label>
            <input type="number" id="size-M" min="0" value="0"
                   onchange="updateSizeTotal()"
                   class="size-input w-full px-3 py-2 border rounded">
        </div>

        <!-- More sizes... -->
    </div>

    <!-- Validation Display -->
    <div id="sizeValidation" class="mt-6 p-4 rounded-lg border-2">
        <div class="text-lg font-medium">
            Total: <span id="currentTotal">0</span> / <span id="requiredTotal">8</span>
        </div>
        <div id="validationMessage" class="mt-2 text-sm"></div>
    </div>

    <!-- Quick Fill Options -->
    <div class="mt-4 flex gap-2">
        <button onclick="autoDistribute('even')" class="btn-secondary text-sm">
            Distribute Evenly
        </button>
        <button onclick="autoDistribute('standard')" class="btn-secondary text-sm">
            Standard Distribution
        </button>
        <button onclick="clearSizes()" class="btn-secondary text-sm">
            Clear All
        </button>
    </div>
</div>

<script>
function updateSizeTotal() {
    const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    const required = parseInt(document.getElementById('bundleQuantity').value);
    let total = 0;

    sizes.forEach(size => {
        const input = document.getElementById(`size-${size}`);
        total += parseInt(input.value) || 0;
    });

    // Update display
    document.getElementById('currentTotal').textContent = total;

    // Validation
    const validation = document.getElementById('sizeValidation');
    const message = document.getElementById('validationMessage');

    if (total === required) {
        validation.className = 'mt-6 p-4 rounded-lg border-2 bg-green-50 border-green-500';
        message.innerHTML = '<i class="fas fa-check-circle text-green-500"></i> Perfect!';
    } else if (total > required) {
        validation.className = 'mt-6 p-4 rounded-lg border-2 bg-red-50 border-red-500';
        message.innerHTML = `<i class="fas fa-times-circle text-red-500"></i> Too many! Remove ${total - required}`;
    } else {
        validation.className = 'mt-6 p-4 rounded-lg border-2 bg-yellow-50 border-yellow-500';
        message.innerHTML = `<i class="fas fa-info-circle text-yellow-500"></i> Add ${required - total} more`;
    }
}

function autoDistribute(method) {
    const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    const total = parseInt(document.getElementById('bundleQuantity').value);

    if (method === 'even') {
        // Distribute evenly across all sizes
        const base = Math.floor(total / sizes.length);
        const remainder = total % sizes.length;

        sizes.forEach((size, index) => {
            const input = document.getElementById(`size-${size}`);
            input.value = base + (index < remainder ? 1 : 0);
        });
    } else if (method === 'standard') {
        // Standard bell curve distribution
        const distribution = {
            'S': 0.10,
            'M': 0.15,
            'L': 0.25,
            'XL': 0.25,
            '2XL': 0.15,
            '3XL': 0.07,
            '4XL': 0.03
        };

        let allocated = 0;
        sizes.forEach((size, index) => {
            const input = document.getElementById(`size-${size}`);
            const qty = index === sizes.length - 1
                ? total - allocated  // Last size gets remainder
                : Math.round(total * distribution[size]);
            input.value = qty;
            allocated += qty;
        });
    }

    updateSizeTotal();
}

function clearSizes() {
    const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    sizes.forEach(size => {
        document.getElementById(`size-${size}`).value = 0;
    });
    updateSizeTotal();
}
</script>
```

## Database & Quote Service {#database-service}

### Database Schema for Bundles
```javascript
// quote_sessions table
{
    SessionID: 'BCA1227-1234',      // Unique quote ID
    QuoteID: 'BCA1227-1234',         // Same as SessionID
    CustomerName: 'John Doe',
    CustomerEmail: 'john@example.com',
    CompanyName: 'Acme Corp',
    Phone: '253-555-1234',
    TotalQuantity: 8,                // Number of bundles
    SubtotalAmount: 360.00,
    LTMFeeTotal: 0.00,
    TotalAmount: 360.00,
    Status: 'Bundle Order',
    ExpiresAt: '2025-02-26',
    Notes: 'Breast Cancer Awareness Bundle - 8 bundles, Rush production',
    ShippingAddress: '123 Main St, Seattle, WA 98101',
    DeliveryMethod: 'Ship'
}

// quote_items table - Each bundle component as line item
{
    SessionID: 'BCA1227-1234',
    LineNumber: 1,
    ProductDescription: 'Pink Awareness T-Shirt',
    StyleNumber: 'PC61',
    Color: 'Pink',
    Size: JSON.stringify({S:1, M:2, L:3, XL:2}),  // Size distribution
    Quantity: 8,
    UnitPrice: 22.50,
    TotalPrice: 180.00,
    PrintMethod: 'Bundle',
    Notes: 'Part of BCA Bundle'
}
```

## Testing & Common Issues {#testing-issues}

### Testing Checklist
```javascript
// Bundle Calculator Test Suite
const BundleTests = {
    // Test minimum quantity enforcement
    testMinimumQuantity: function() {
        const input = document.getElementById('bundleQuantity');
        input.value = 5;
        updateBundleDisplay();

        console.assert(
            parseInt(input.value) === 8,
            'Minimum quantity should be enforced'
        );
    },

    // Test size distribution validation
    testSizeValidation: function() {
        document.getElementById('bundleQuantity').value = 10;
        document.getElementById('size-M').value = 5;
        document.getElementById('size-L').value = 5;
        updateSizeTotal();

        const validation = document.getElementById('sizeValidation');
        console.assert(
            validation.classList.contains('border-green-500'),
            'Valid distribution should show green'
        );
    },

    // Test price calculation
    testPriceCalculation: function() {
        const quantity = 10;
        const pricePerBundle = 45;
        const expected = quantity * pricePerBundle;

        document.getElementById('bundleQuantity').value = quantity;
        updateBundleDisplay();

        const displayed = parseFloat(document.getElementById('totalPrice').textContent);
        console.assert(
            displayed === expected,
            `Price should be ${expected}, got ${displayed}`
        );
    },

    // Run all tests
    runAll: function() {
        console.log('Running Bundle Calculator Tests...');
        this.testMinimumQuantity();
        this.testSizeValidation();
        this.testPriceCalculation();
        console.log('All tests completed!');
    }
};

// Debug utilities
window.BUNDLE_DEBUG = {
    // Check current state
    getState: function() {
        return {
            step: wizard.currentStep,
            quantity: document.getElementById('bundleQuantity').value,
            sizes: this.getSizeDistribution(),
            total: document.getElementById('totalPrice').textContent
        };
    },

    // Get size distribution
    getSizeDistribution: function() {
        const sizes = {};
        ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].forEach(size => {
            sizes[size] = parseInt(document.getElementById(`size-${size}`).value) || 0;
        });
        return sizes;
    },

    // Skip to step
    jumpToStep: function(step) {
        wizard.currentStep = step;
        wizard.showStep(step);
    },

    // Test submission
    testSubmit: function() {
        // Fill test data
        document.getElementById('customerName').value = 'Test User';
        document.getElementById('email').value = 'test@example.com';
        document.getElementById('phone').value = '253-555-1234';

        // Submit
        submitOrder();
    }
};
```

### Common Issues & Solutions

#### Issue 1: Size Distribution Not Adding Up
**Problem:** User can't proceed because sizes don't match bundle count
**Solution:**
```javascript
// Add auto-adjustment feature
function autoAdjustLastSize() {
    const required = parseInt(document.getElementById('bundleQuantity').value);
    const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    let total = 0;

    // Calculate current total excluding last size
    for (let i = 0; i < sizes.length - 1; i++) {
        total += parseInt(document.getElementById(`size-${sizes[i]}`).value) || 0;
    }

    // Set last size to make up the difference
    const lastSizeInput = document.getElementById(`size-${sizes[sizes.length - 1]}`);
    lastSizeInput.value = Math.max(0, required - total);

    updateSizeTotal();
}
```

#### Issue 2: Mobile Navigation Issues
**Problem:** Fixed navigation covers content on mobile
**Solution:**
```css
/* Add safe area for mobile devices */
.navigation {
    padding-bottom: env(safe-area-inset-bottom);
}

/* Adjust content padding based on viewport */
@media (max-width: 768px) {
    .step-content {
        padding-bottom: 140px; /* More space for mobile */
    }

    .navigation {
        flex-direction: column;
        gap: 10px;
    }
}
```

#### Issue 3: Quote ID Generation Conflicts
**Problem:** Duplicate quote IDs
**Solution:**
```javascript
// Improved quote ID generation with timestamp
generateQuoteID() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${this.quotePrefix}${month}${day}-${timestamp}${random}`;
}
```

#### Issue 4: Email Sending Failures
**Problem:** EmailJS fails but order is saved
**Solution:**
```javascript
async processOrder(orderData) {
    try {
        const quoteId = this.generateQuoteID();

        // Always save to database first
        await this.saveToDatabase(quoteId, orderData);

        // Try email but don't fail the order
        try {
            await this.sendCustomerEmail(quoteId, orderData);
        } catch (emailError) {
            console.error('Email failed:', emailError);
            // Show warning but continue
            this.showWarning('Email notification failed. Quote saved as ' + quoteId);
        }

        return { success: true, quoteId };

    } catch (error) {
        console.error('Order failed:', error);
        return { success: false, error: error.message };
    }
}
```

## Bundle Types & Examples

### Seasonal Bundles
- **Christmas Gift Box:** Multi-product selection, gift wrapping theme
- **Back-to-School Bundle:** Fixed items, bulk quantities
- **Summer Camp Bundle:** T-shirts, caps, water bottles

### Awareness Campaign Bundles
- **Breast Cancer Awareness:** Pink theme, fixed pricing
- **Veterans Day Bundle:** Patriotic theme, donation component
- **Earth Day Bundle:** Eco-friendly products

### Corporate Bundles
- **New Employee Welcome:** Branded essentials
- **Trade Show Bundle:** Promotional giveaways
- **Holiday Gift Sets:** Client appreciation

## Implementation Checklist

When creating a new bundle calculator:

- [ ] Define bundle type (fixed vs dynamic products)
- [ ] Create bundle configuration (pricing, minimums, products)
- [ ] Design multi-step wizard flow
- [ ] Create HTML structure with Tailwind classes
- [ ] Implement BundleWizard JavaScript class
- [ ] Add size distribution if apparel included
- [ ] Create BundleService for database/email
- [ ] Design promotional banner/deadline
- [ ] Add gift box visualization (if appropriate)
- [ ] Create EmailJS templates (customer & sales)
- [ ] Test all validation scenarios
- [ ] Test mobile responsiveness
- [ ] Add to ACTIVE_FILES.md
- [ ] Create staff training documentation

## Summary

Bundle calculators are powerful promotional tools that:
1. **Drive higher order values** through minimum quantities
2. **Create urgency** with deadline banners
3. **Simplify ordering** with curated product selections
4. **Increase perceived value** with bundle savings
5. **Generate qualified leads** with quote system

Use this guide to create compelling bundle experiences for any holiday, event, or promotional campaign.

---

*Last updated: 2025-01-27 by Claude & Erik*