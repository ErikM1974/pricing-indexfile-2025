# Calculator Templates - Ready-to-Use Code

## Overview

This file contains complete, copy-paste ready templates for building new calculators. Based on the proven Customer Supplied Embroidery Calculator pattern.

**Note on Service Calculators**: Some calculators quote services rather than products (e.g., webstore setup). These may need to:
- Display setup fees rather than per-item pricing
- Show requirements (like annual minimums) separately from costs
- Include extensive information sections using accordions
- Link to customer-facing information pages

## Complete HTML Calculator Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>[Calculator Name] - Northwest Custom Apparel</title>
    <link rel="icon" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1" type="image/png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    
    <!-- EmailJS SDK -->
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
    
    <!-- Quote Service -->
    <script src="[name]-quote-service.js"></script>
    
    <style>
        /* Root variables - NWCA Green Theme */
        :root {
            --primary-color: #4cb354;
            --primary-dark: #409a47;
            --primary-light: #5bc85f;
            --bg-color: #f5f7fa;
            --card-bg: #ffffff;
            --border-color: #e5e7eb;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --hover-bg: #f3f4f6;
            --success-bg: #d1fae5;
            --success-text: #065f46;
            --warning-bg: #fef3c7;
            --warning-text: #92400e;
            --focus-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
        }

        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.6;
        }

        /* Header */
        .header {
            background: var(--card-bg);
            border-bottom: 1px solid var(--border-color);
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .header-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 2rem;
        }

        .logo {
            height: 40px;
            width: auto;
        }

        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .breadcrumb a {
            color: var(--primary-color);
            text-decoration: none;
            font-weight: 500;
        }

        /* Main Container */
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
        }

        /* Calculator Section */
        .calculator-section {
            background: var(--card-bg);
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: var(--text-primary);
        }

        /* Form Elements */
        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-label {
            display: block;
            font-weight: 500;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }

        .form-control {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 1rem;
            transition: all 0.2s;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: var(--focus-shadow);
        }

        /* Grid Layout */
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
        }

        /* Checkboxes */
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .checkbox-input {
            width: 1.25rem;
            height: 1.25rem;
            cursor: pointer;
        }

        /* Buttons */
        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-primary {
            background: var(--primary-color);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
        }

        .btn-secondary {
            background: var(--hover-bg);
            color: var(--text-primary);
        }

        /* Pricing Display */
        .pricing-display {
            background: var(--bg-color);
            padding: 1.5rem;
            border-radius: 6px;
            margin-top: 2rem;
        }

        .price-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
        }

        .price-label {
            color: var(--text-secondary);
        }

        .price-value {
            font-weight: 600;
            color: var(--text-primary);
        }

        .total-row {
            border-top: 2px solid var(--border-color);
            margin-top: 1rem;
            padding-top: 1rem;
        }

        .total-value {
            font-size: 1.5rem;
            color: var(--primary-color);
        }

        /* Success Modal */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            overflow-y: auto;
        }

        .modal-overlay.active {
            display: block;
        }

        .modal-content {
            background: white;
            max-width: 600px;
            margin: 50px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
            background: var(--success-bg);
            padding: 1.5rem;
            text-align: center;
        }

        .modal-body {
            padding: 2rem;
        }

        .modal-footer {
            padding: 1.5rem;
            background: var(--bg-color);
            display: flex;
            gap: 1rem;
            justify-content: center;
        }

        /* Print Styles */
        @media print {
            body {
                background: white;
            }
            
            .no-print {
                display: none !important;
            }
            
            .print-only {
                display: block !important;
            }
        }

        /* Loading State */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 0 1rem;
            }
            
            .calculator-section {
                padding: 1.5rem;
            }
            
            .form-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-container">
            <div class="header-left">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                     alt="Northwest Custom Apparel" class="logo">
            </div>
            <nav class="breadcrumb">
                <a href="/staff-dashboard.html">Staff Dashboard</a>
                <span>/</span>
                <span>[Calculator Name]</span>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container">
        <!-- Calculator Form -->
        <section class="calculator-section">
            <h1 class="section-title">[Calculator Name]</h1>
            
            <form id="calculatorForm">
                <!-- Product Selection -->
                <div class="form-group">
                    <label class="form-label">Product Type</label>
                    <select class="form-control" id="productType" required>
                        <option value="">Select Product</option>
                        <option value="option1">Option 1</option>
                        <option value="option2">Option 2</option>
                    </select>
                </div>

                <!-- Quantity -->
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-control" id="quantity" 
                           min="1" placeholder="Enter quantity" required>
                </div>

                <!-- Customer Information -->
                <h3 class="section-title" style="font-size: 1.25rem; margin-top: 2rem;">Customer Information</h3>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Customer Name</label>
                        <input type="text" class="form-control" id="customerName" 
                               placeholder="Full name" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" id="customerEmail" 
                               placeholder="email@example.com" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Phone (Optional)</label>
                        <input type="tel" class="form-control" id="customerPhone" 
                               placeholder="(555) 123-4567">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Company (Optional)</label>
                        <input type="text" class="form-control" id="companyName" 
                               placeholder="Company name">
                    </div>
                </div>

                <!-- Project Details -->
                <div class="form-group">
                    <label class="form-label">Project Name (Optional)</label>
                    <input type="text" class="form-control" id="projectName" 
                           placeholder="Project or order description">
                </div>

                <!-- Order Type Options -->
                <div class="form-grid" style="margin-top: 1.5rem;">
                    <div class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="programAccount">
                        <label for="programAccount">Program Account</label>
                    </div>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" class="checkbox-input" id="addonOrder">
                        <label for="addonOrder">Add-on Order</label>
                    </div>
                </div>

                <!-- Sales Rep -->
                <div class="form-group">
                    <label class="form-label">Sales Representative</label>
                    <select class="form-control" id="salesRep" required>
                        <option value="sales@nwcustomapparel.com">General Sales</option>
                        <option value="ruth@nwcustomapparel.com">Ruth Nhong</option>
                        <option value="taylar@nwcustomapparel.com">Taylar</option>
                        <option value="nika@nwcustomapparel.com">Nika</option>
                        <option value="erik@nwcustomapparel.com">Erik</option>
                    </select>
                </div>

                <!-- Notes -->
                <div class="form-group">
                    <label class="form-label">Notes (Optional)</label>
                    <textarea class="form-control" id="notes" rows="3" 
                              placeholder="Special instructions or notes"></textarea>
                </div>

                <!-- Save to Database Option -->
                <div class="checkbox-group">
                    <input type="checkbox" class="checkbox-input" id="saveToDatabase" checked>
                    <label for="saveToDatabase">Save quote to database</label>
                </div>

                <!-- Pricing Display -->
                <div class="pricing-display">
                    <div class="price-row">
                        <span class="price-label">Base Price:</span>
                        <span class="price-value" id="basePrice">$0.00</span>
                    </div>
                    <div class="price-row">
                        <span class="price-label">Quantity:</span>
                        <span class="price-value" id="quantityDisplay">0</span>
                    </div>
                    <div class="price-row">
                        <span class="price-label">Subtotal:</span>
                        <span class="price-value" id="subtotal">$0.00</span>
                    </div>
                    <div class="price-row total-row">
                        <span class="price-label" style="font-size: 1.25rem;">Total:</span>
                        <span class="price-value total-value" id="totalPrice">$0.00</span>
                    </div>
                </div>

                <!-- Submit Button -->
                <div style="text-align: center; margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary" id="submitBtn">
                        <i class="fas fa-paper-plane"></i>
                        <span>Send Quote</span>
                    </button>
                </div>
            </form>
        </section>
    </main>

    <!-- Success Modal -->
    <div class="modal-overlay" id="successModal">
        <div class="modal-content">
            <div class="modal-header">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success-text);"></i>
                <h2 style="color: var(--success-text); margin-top: 1rem;">Quote Sent Successfully!</h2>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <p style="font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Your quote has been sent to:
                    </p>
                    <p style="font-weight: 600;" id="modalCustomerName"></p>
                    <p style="color: var(--text-secondary);" id="modalCustomerEmail"></p>
                </div>
                
                <div style="background: var(--bg-color); padding: 1.5rem; border-radius: 6px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <span style="font-weight: 600;">Quote ID:</span>
                        <span style="font-family: monospace; font-size: 1.125rem;" id="modalQuoteId"></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600;">Total Amount:</span>
                        <span style="font-size: 1.25rem; color: var(--primary-color); font-weight: 600;" id="modalTotalAmount"></span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <button type="button" class="btn btn-secondary" onclick="copyQuoteId()">
                        <i class="fas fa-copy"></i>
                        Copy Quote ID
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="printQuote()">
                    <i class="fas fa-print"></i>
                    Print Quote
                </button>
                <button type="button" class="btn btn-primary" onclick="closeModal()">
                    <i class="fas fa-check"></i>
                    Done
                </button>
            </div>
        </div>
    </div>

    <script>
        // [Calculator Name] Implementation
        class [CalculatorClass] {
            constructor() {
                this.initializeElements();
                this.initializeEmailJS();
                this.attachEventListeners();
                this.quoteService = new [QuoteServiceClass]();
                this.lastQuoteData = null;
            }

            initializeElements() {
                // Form elements
                this.form = document.getElementById('calculatorForm');
                this.productType = document.getElementById('productType');
                this.quantity = document.getElementById('quantity');
                
                // Customer info
                this.customerName = document.getElementById('customerName');
                this.customerEmail = document.getElementById('customerEmail');
                this.customerPhone = document.getElementById('customerPhone');
                this.companyName = document.getElementById('companyName');
                this.projectName = document.getElementById('projectName');
                
                // Options
                this.programAccount = document.getElementById('programAccount');
                this.addonOrder = document.getElementById('addonOrder');
                this.salesRep = document.getElementById('salesRep');
                this.notes = document.getElementById('notes');
                this.saveToDatabase = document.getElementById('saveToDatabase');
                
                // Pricing display
                this.basePriceDisplay = document.getElementById('basePrice');
                this.quantityDisplay = document.getElementById('quantityDisplay');
                this.subtotalDisplay = document.getElementById('subtotal');
                this.totalDisplay = document.getElementById('totalPrice');
                
                // Submit button
                this.submitBtn = document.getElementById('submitBtn');
            }

            initializeEmailJS() {
                emailjs.init('4qSbDO-SQs19TbP80');
                this.emailConfig = {
                    serviceId: 'service_1c4k67j',
                    templateId: null // TODO: Get template ID from user
                };
            }

            attachEventListeners() {
                this.form.addEventListener('submit', (e) => this.handleSubmit(e));
                this.quantity.addEventListener('input', () => this.calculatePrice());
                this.productType.addEventListener('change', () => this.calculatePrice());
                this.programAccount.addEventListener('change', () => this.calculatePrice());
                this.addonOrder.addEventListener('change', () => this.calculatePrice());
            }

            calculatePrice() {
                const quantity = parseInt(this.quantity.value) || 0;
                
                // TODO: Implement your pricing logic here
                const basePrice = 10.00; // Example
                const subtotal = basePrice * quantity;
                const total = subtotal;
                
                // Update display
                this.basePriceDisplay.textContent = `$${basePrice.toFixed(2)}`;
                this.quantityDisplay.textContent = quantity;
                this.subtotalDisplay.textContent = `$${subtotal.toFixed(2)}`;
                this.totalDisplay.textContent = `$${total.toFixed(2)}`;
                
                return {
                    basePrice,
                    quantity,
                    subtotal,
                    total
                };
            }

            async handleSubmit(e) {
                e.preventDefault();
                
                if (!this.validateForm()) return;
                
                try {
                    this.showLoading();
                    
                    // Get pricing
                    const pricing = this.calculatePrice();
                    
                    // Build quote data
                    const quoteData = {
                        // Customer info
                        customerName: this.customerName.value.trim(),
                        customerEmail: this.customerEmail.value.trim(),
                        customerPhone: this.customerPhone.value.trim(),
                        companyName: this.companyName.value.trim(),
                        projectName: this.projectName.value.trim(),
                        
                        // Product details
                        productType: this.productType.value,
                        quantity: pricing.quantity,
                        
                        // Pricing
                        basePrice: pricing.basePrice,
                        subtotal: pricing.subtotal,
                        totalCost: pricing.total,
                        
                        // Options
                        isProgramAccount: this.programAccount.checked,
                        isAddon: this.addonOrder.checked,
                        notes: this.notes.value.trim(),
                        
                        // Sales rep
                        salesRepEmail: this.salesRep.value,
                        salesRepName: this.getSalesRepName(this.salesRep.value)
                    };
                    
                    // Generate quote ID
                    const quoteId = this.quoteService.generateQuoteID();
                    quoteData.quoteId = quoteId;
                    
                    // Save to database if enabled
                    if (this.saveToDatabase.checked) {
                        const saveResult = await this.quoteService.saveQuote(quoteData);
                        if (!saveResult.success) {
                            console.error('Database save failed:', saveResult.error);
                        }
                    }
                    
                    // Send email
                    const emailData = this.buildEmailData(quoteData);
                    await emailjs.send(
                        this.emailConfig.serviceId,
                        this.emailConfig.templateId,
                        emailData
                    );
                    
                    // Show success
                    this.showSuccessModal(quoteId, quoteData);
                    
                    // Reset form
                    this.form.reset();
                    this.calculatePrice();
                    
                } catch (error) {
                    console.error('Quote submission error:', error);
                    this.showError('Failed to send quote. Please try again.');
                } finally {
                    this.hideLoading();
                }
            }

            buildEmailData(quoteData) {
                return {
                    // Email routing
                    to_email: quoteData.customerEmail,
                    from_name: 'Northwest Custom Apparel',
                    reply_to: quoteData.salesRepEmail,
                    
                    // Quote identification
                    quote_type: '[Calculator Name]',
                    quote_id: quoteData.quoteId,
                    quote_date: new Date().toLocaleDateString(),
                    
                    // Customer info
                    customer_name: quoteData.customerName,
                    customer_email: quoteData.customerEmail,
                    company_name: quoteData.companyName || '',
                    customer_phone: quoteData.customerPhone || '',
                    project_name: quoteData.projectName || '',
                    
                    // Pricing
                    grand_total: quoteData.totalCost.toFixed(2),
                    
                    // Content
                    products_html: this.generateQuoteHTML(quoteData),
                    notes: quoteData.notes || 'No special notes for this order',
                    
                    // Sales rep
                    sales_rep_name: quoteData.salesRepName,
                    sales_rep_email: quoteData.salesRepEmail,
                    sales_rep_phone: '253-922-5793',
                    
                    // Company
                    company_year: '1977'
                };
            }

            generateQuoteHTML(quoteData) {
                // Basic single-item example
                return `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #4cb354; color: white;">
                                <th style="padding: 12px; text-align: left;">Item</th>
                                <th style="padding: 12px; text-align: center;">Quantity</th>
                                <th style="padding: 12px; text-align: right;">Price</th>
                                <th style="padding: 12px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 12px;">${quoteData.productType}</td>
                                <td style="padding: 12px; text-align: center;">${quoteData.quantity}</td>
                                <td style="padding: 12px; text-align: right;">$${quoteData.basePrice.toFixed(2)}</td>
                                <td style="padding: 12px; text-align: right;">$${quoteData.subtotal.toFixed(2)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #4cb354;">
                                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">Total:</td>
                                <td style="padding: 12px; text-align: right; font-weight: bold;">$${quoteData.totalCost.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }

            // Advanced example with detailed pricing breakdown (e.g., Screen Print)
            generateDetailedQuoteHTML(quoteData) {
                let html = `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #4cb354; color: white;">
                                <th style="padding: 12px; text-align: left;">Description</th>
                                <th style="padding: 12px; text-align: center;">Quantity</th>
                                <th style="padding: 12px; text-align: right;">Unit Price</th>
                                <th style="padding: 12px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>`;
                
                // Example: Screen print with multiple locations
                if (quoteData.frontColors > 0) {
                    html += `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                                    Screen Print - Front (${quoteData.frontColors} color${quoteData.frontColors > 1 ? 's' : ''})
                                </td>
                                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${quoteData.quantity}</td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.frontUnitPrice.toFixed(2)}</td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.frontTotal.toFixed(2)}</td>
                            </tr>`;
                }
                
                if (quoteData.backColors > 0) {
                    html += `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                                    Screen Print - Back (${quoteData.backColors} color${quoteData.backColors > 1 ? 's' : ''})
                                </td>
                                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${quoteData.quantity}</td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.backUnitPrice.toFixed(2)}</td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.backTotal.toFixed(2)}</td>
                            </tr>`;
                }
                
                // Setup fees by location
                if (quoteData.frontSetupFee > 0) {
                    html += `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">
                                    Setup Fee - Front (${quoteData.frontColors} screen${quoteData.frontColors > 1 ? 's' : ''} × $30)
                                </td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.frontSetupFee.toFixed(2)}</td>
                            </tr>`;
                }
                
                if (quoteData.backSetupFee > 0) {
                    html += `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">
                                    Setup Fee - Back (${quoteData.backColors} screen${quoteData.backColors > 1 ? 's' : ''} × $30)
                                </td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.backSetupFee.toFixed(2)}</td>
                            </tr>`;
                }
                
                // Less than minimum fee
                if (quoteData.ltmFee > 0) {
                    html += `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">Less Than Minimum Fee (under 72 pcs)</td>
                                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${quoteData.ltmFee.toFixed(2)}</td>
                            </tr>`;
                }
                
                html += `
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="padding: 12px; text-align: right;">Subtotal:</td>
                                <td style="padding: 12px; text-align: right;">$${quoteData.subtotal.toFixed(2)}</td>
                            </tr>
                            <tr style="border-top: 2px solid #4cb354;">
                                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">Total:</td>
                                <td style="padding: 12px; text-align: right; font-weight: bold;">$${quoteData.totalCost.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
                
                return html;
            }

            // Example: Building line items for database storage
            buildLineItemsForDatabase(quoteData) {
                const lineItems = [];
                let lineNumber = 1;
                
                // Add item for each print location
                if (quoteData.frontColors > 0) {
                    lineItems.push({
                        LineNumber: lineNumber++,
                        ProductName: `Screen Print - Front`,
                        PrintLocation: `Front - ${quoteData.frontColors} color${quoteData.frontColors > 1 ? 's' : ''}`,
                        Quantity: quoteData.quantity,
                        BaseUnitPrice: quoteData.frontUnitPrice,
                        LineTotal: quoteData.frontTotal
                    });
                }
                
                if (quoteData.backColors > 0) {
                    lineItems.push({
                        LineNumber: lineNumber++,
                        ProductName: `Screen Print - Back`,
                        PrintLocation: `Back - ${quoteData.backColors} color${quoteData.backColors > 1 ? 's' : ''}`,
                        Quantity: quoteData.quantity,
                        BaseUnitPrice: quoteData.backUnitPrice,
                        LineTotal: quoteData.backTotal
                    });
                }
                
                return lineItems;
            }

            validateForm() {
                const errors = [];
                
                if (!this.customerName.value.trim()) {
                    errors.push('Customer name is required');
                }
                
                if (!this.validateEmail(this.customerEmail.value)) {
                    errors.push('Valid email is required');
                }
                
                if (!this.quantity.value || this.quantity.value < 1) {
                    errors.push('Quantity must be at least 1');
                }
                
                if (!this.productType.value) {
                    errors.push('Please select a product type');
                }
                
                if (errors.length > 0) {
                    this.showError(errors.join('<br>'));
                    return false;
                }
                
                return true;
            }

            validateEmail(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            }

            getSalesRepName(email) {
                const reps = {
                    'ruth@nwcustomapparel.com': 'Ruth Nhong',
                    'taylar@nwcustomapparel.com': 'Taylar',
                    'nika@nwcustomapparel.com': 'Nika',
                    'erik@nwcustomapparel.com': 'Erik',
                    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
                };
                return reps[email] || 'Sales Team';
            }

            showSuccessModal(quoteId, quoteData) {
                document.getElementById('modalQuoteId').textContent = quoteId;
                document.getElementById('modalCustomerName').textContent = quoteData.customerName;
                document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
                document.getElementById('modalTotalAmount').textContent = `$${quoteData.totalCost.toFixed(2)}`;
                
                this.lastQuoteData = quoteData;
                
                document.getElementById('successModal').classList.add('active');
            }

            showLoading() {
                this.submitBtn.disabled = true;
                this.submitBtn.innerHTML = '<span class="loading"></span> Sending...';
            }

            hideLoading() {
                this.submitBtn.disabled = false;
                this.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Quote';
            }

            showError(message) {
                alert(message); // TODO: Replace with better error display
            }
        }

        // Modal Functions
        function closeModal() {
            document.getElementById('successModal').classList.remove('active');
        }

        function copyQuoteId() {
            const quoteId = document.getElementById('modalQuoteId').textContent;
            navigator.clipboard.writeText(quoteId).then(() => {
                alert('Quote ID copied to clipboard!');
            });
        }

        function printQuote() {
            const calculator = window.calculator;
            if (!calculator.lastQuoteData) return;
            
            const data = calculator.lastQuoteData;
            const printWindow = window.open('', '_blank');
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Quote ${data.quoteId}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .logo {
                            max-width: 300px;
                            margin-bottom: 20px;
                        }
                        .quote-info {
                            margin-bottom: 30px;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                        }
                        th, td {
                            padding: 10px;
                            text-align: left;
                            border-bottom: 1px solid #ddd;
                        }
                        th {
                            background-color: #f5f5f5;
                            font-weight: bold;
                        }
                        .total {
                            font-size: 1.2em;
                            font-weight: bold;
                            text-align: right;
                            margin-top: 20px;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                             alt="Northwest Custom Apparel" class="logo">
                        <h2>[Calculator Name] Quote</h2>
                    </div>
                    
                    <div class="quote-info">
                        <p><strong>Quote ID:</strong> ${data.quoteId}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div class="info-grid">
                        <div>
                            <h3>Customer Information</h3>
                            <p><strong>Name:</strong> ${data.customerName}</p>
                            <p><strong>Email:</strong> ${data.customerEmail}</p>
                            ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
                            ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
                        </div>
                        <div>
                            <h3>Order Details</h3>
                            <p><strong>Product:</strong> ${data.productType}</p>
                            <p><strong>Quantity:</strong> ${data.quantity}</p>
                            ${data.projectName ? `<p><strong>Project:</strong> ${data.projectName}</p>` : ''}
                        </div>
                    </div>
                    
                    ${calculator.generateQuoteHTML(data)}
                    
                    ${data.notes ? `
                        <div style="background: #f5f5f5; padding: 15px; margin-top: 30px;">
                            <h3>Notes</h3>
                            <p>${data.notes}</p>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 50px; text-align: center; color: #666;">
                        <p>Family Owned & Operated Since 1977</p>
                        <p>253-922-5793 | sales@nwcustomapparel.com</p>
                    </div>
                    
                    <script>
                        window.onload = () => {
                            window.print();
                            setTimeout(() => window.close(), 500);
                        };
                    <\/script>
                </body>
                </html>
            `);
        }

        // Initialize calculator
        window.calculator = new [CalculatorClass]();
    </script>
</body>
</html>
```

## Quote Service Template

```javascript
/**
 * [Calculator Name] Quote Service
 * Handles saving quotes to Caspio database
 */

class [QuoteServiceClass] {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'XX'; // TODO: Set your 2-letter prefix
    }

    /**
     * Generate unique quote ID
     */
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Get or initialize daily sequence
        const storageKey = `${this.quotePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        
        // Store the updated sequence
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        // Build quote ID with modifiers
        let prefix = this.quotePrefix;
        if (this.isProgramAccount) {
            prefix = `${this.quotePrefix}-PA`;
        } else if (this.isAddonOrder) {
            prefix = `${this.quotePrefix}-AO`;
        }
        
        return `${prefix}${dateKey}-${sequence}`;
    }
    
    /**
     * Clean up sequence numbers from previous days
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(`${this.quotePrefix}_quote_sequence_`) && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `${this.quotePrefix}_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pricing tier based on quantity
     */
    getPricingTier(quantity) {
        // TODO: Implement your pricing tiers
        if (quantity < 10) return '1-9';
        if (quantity < 50) return '10-49';
        if (quantity < 100) return '50-99';
        return '100+';
    }

    /**
     * Save quote to database
     */
    async saveQuote(quoteData) {
        try {
            // Set flags for quote ID generation
            this.isAddonOrder = quoteData.isAddon || false;
            this.isProgramAccount = quoteData.isProgramAccount || false;
            
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log(`[${this.constructor.name}] Saving quote with ID:`, quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\\.\\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail,
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || 'Not Provided',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat((quoteData.subtotal || 0).toFixed(2)),
                LTMFeeTotal: parseFloat((quoteData.ltmFeeTotal || 0).toFixed(2)),
                TotalAmount: parseFloat((quoteData.totalCost || 0).toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log(`[${this.constructor.name}] Session data:`, sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log(`[${this.constructor.name}] Session response:`, sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                let errorMessage = `Session creation failed: ${sessionResponse.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage += ` - ${responseText}`;
                }
                throw new Error(errorMessage);
            }

            // Step 2: Add item to quote
            const addedAt = new Date().toISOString().replace(/\\.\\d{3}Z$/, '');
            
            // Build product name
            let productName = quoteData.productType || 'Product';
            if (quoteData.isAddon) {
                productName += ' [ADD-ON]';
            }
            if (quoteData.isProgramAccount) {
                productName += ' [PROGRAM]';
            }

            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: 'STYLE-CODE', // TODO: Set your style code
                ProductName: productName,
                Color: 'As Specified',
                ColorCode: '',
                EmbellishmentType: 'type', // TODO: Set type (embroidery, dtg, laser, etc)
                PrintLocation: 'Location',
                PrintLocationName: 'Location Name',
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: quoteData.ltmFeeTotal > 0 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat((quoteData.basePrice || 0).toFixed(2)),
                LTMPerUnit: parseFloat((quoteData.ltmPerUnit || 0).toFixed(2)),
                FinalUnitPrice: parseFloat((quoteData.unitPrice || 0).toFixed(2)),
                LineTotal: parseFloat((quoteData.totalCost || 0).toFixed(2)),
                SizeBreakdown: '{}',
                PricingTier: this.getPricingTier(quoteData.quantity || 0),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log(`[${this.constructor.name}] Item data:`, itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log(`[${this.constructor.name}] Item response:`, itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error('Failed to save quote item:', itemResponseText);
                // Don't throw - session was created successfully
            }

            return {
                success: true,
                quoteID: quoteID,
                sessionData: sessionData
            };

        } catch (error) {
            console.error(`[${this.constructor.name}] Error saving quote:`, error);
            
            // Still return the quote ID if we have one
            // This ensures the customer gets their quote
            return {
                success: false,
                quoteID: this.generateQuoteID(),
                error: error.message
            };
        }
    }
}

// Make available globally
window.[QuoteServiceClass] = [QuoteServiceClass];
```

## EmailJS Template Variables

```javascript
// Standard EmailJS template variables for all calculators
const EMAIL_TEMPLATE_VARS = {
    // Required System Variables
    to_email: '{{to_email}}',
    from_name: '{{from_name}}',
    reply_to: '{{reply_to}}',
    
    // Required Quote Variables
    quote_type: '{{quote_type}}',
    quote_id: '{{quote_id}}',
    quote_date: '{{quote_date}}',
    
    // Required Customer Variables
    customer_name: '{{customer_name}}',
    customer_email: '{{customer_email}}',
    
    // Required Pricing Variables
    grand_total: '{{grand_total}}',
    
    // Required Sales Rep Variables
    sales_rep_name: '{{sales_rep_name}}',
    sales_rep_email: '{{sales_rep_email}}',
    sales_rep_phone: '{{sales_rep_phone}}',
    
    // Required Company Variables
    company_year: '{{company_year}}',
    
    // Optional Variables (always provide defaults)
    company_name: '{{company_name}}',
    customer_phone: '{{customer_phone}}',
    project_name: '{{project_name}}',
    notes: '{{notes}}',
    products_html: '{{{products_html}}}', // Triple braces for HTML
    special_note: '{{special_note}}'
};
```

## Quick Setup Checklist

1. **Copy HTML Template**
   - Replace all `[Calculator Name]` placeholders
   - Replace `[CalculatorClass]` with your class name
   - Replace `[QuoteServiceClass]` with your service class name

2. **Copy Quote Service Template**
   - Set your 2-letter quote prefix
   - Implement pricing tier logic
   - Set embellishment type

3. **Create EmailJS Template**
   - Copy variables from EMAIL_TEMPLATE_VARS
   - Set routing (To, CC, BCC)
   - Design HTML layout

4. **Get Template ID**
   - Visit https://dashboard.emailjs.com
   - Find your template
   - Copy the template ID (e.g., "template_abc123")

5. **Update Configuration**
   - Set templateId in JavaScript
   - Update product options
   - Implement pricing logic

6. **Add to Dashboard**
   - Add link in staff-dashboard.html
   - Use consistent naming

7. **Test Everything**
   - Form validation
   - Price calculations
   - Database saves
   - Email sends
   - Success modal
   - Print function

## Common Customizations

### Add Custom Fields
```javascript
// In HTML
<div class="form-group">
    <label class="form-label">Custom Field</label>
    <input type="text" class="form-control" id="customField">
</div>

// In JavaScript
this.customField = document.getElementById('customField');

// In quote data
customField: this.customField.value.trim(),

// In email data
custom_field: quoteData.customField || ''
```

### Add File Upload
```javascript
// In HTML
<div class="form-group">
    <label class="form-label">Upload Logo</label>
    <input type="file" class="form-control" id="logoFile" accept="image/*">
</div>

// Handle file
const file = this.logoFile.files[0];
if (file) {
    // Convert to base64 or upload to service
}
```

### Add Dynamic Options
```javascript
// Color selection example
const colors = [
    { name: 'Black', code: 'BLK', hex: '#000000' },
    { name: 'White', code: 'WHT', hex: '#FFFFFF' }
];

colors.forEach(color => {
    const option = document.createElement('option');
    option.value = color.code;
    option.textContent = color.name;
    this.colorSelect.appendChild(option);
});
```

This template system provides everything needed to quickly create new calculators with consistent functionality and styling.

## Important Notes & Common Pitfalls

### Script Tag Escaping in Template Literals
When including `<script>` tags inside JavaScript template literals (backticks), you MUST escape the closing tag:

```javascript
// ❌ WRONG - Will cause "Unexpected end of input" error
const html = `
    <script>
        window.print();
    </script>
`;

// ✅ CORRECT - Escape the closing tag
const html = `
    <script>
        window.print();
    <\/script>
`;
```

This is because the browser's HTML parser sees the `</script>` inside the string and thinks the script block has ended.

### Color Theme Consistency
Always use NWCA green colors (#4cb354) throughout:
- Primary: `#4cb354` (NWCA Green)
- Primary Dark: `#409a47`
- Primary Light: `#5bc85f`
- Never use teal colors like `#0d9488`

### Detailed Pricing Breakdowns
For calculators with multiple pricing components (like screen print with front/back), show detailed breakdowns:
- List each location/component separately
- Show individual setup fees
- Include subtotal before grand total
- Use the `generateDetailedQuoteHTML()` pattern shown above

### Database Line Items
When saving to database with multiple components:
- Create separate line items for each component
- Use descriptive ProductName and PrintLocation fields
- Maintain proper LineNumber sequence
- See `buildLineItemsForDatabase()` example above

## Accordion Information Sections

For calculators with extensive information (like webstores), use accordions:

### HTML Structure
```html
<div class="accordion">
    <div class="accordion-item">
        <div class="accordion-header" onclick="toggleAccordion(this.parentElement)">
            <h3>Section Title</h3>
            <i class="fas fa-chevron-down accordion-icon"></i>
        </div>
        <div class="accordion-content">
            <div class="accordion-body">
                <!-- Content here -->
            </div>
        </div>
    </div>
</div>
```

### CSS for Accordions
```css
.accordion-item {
    border-bottom: 1px solid var(--border-color);
}

.accordion-header {
    padding: 1.25rem 1.5rem;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.accordion-icon {
    transition: transform 0.3s;
}

.accordion-item.active .accordion-icon {
    transform: rotate(180deg);
}

.accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
}

.accordion-item.active .accordion-content {
    max-height: 1000px;
}
```

### JavaScript Toggle Function
```javascript
function toggleAccordion(item) {
    item.classList.toggle('active');
}
```

## Service Calculator Patterns

For service-based calculators (setup fees, not products):

### Displaying Requirements vs Costs
```html
<!-- Actual costs -->
<div class="price-breakdown">
    <div class="price-item">
        <span>Setup Fee</span>
        <span>$300.00</span>
    </div>
    <div class="price-item">
        <span><strong>Total Cost</strong></span>
        <span><strong>$300.00</strong></span>
    </div>
</div>

<!-- Requirements (not part of total) -->
<div style="margin-top: 1.5rem; padding: 1rem; background: var(--warning-bg); border-radius: 8px;">
    <p style="margin: 0; font-size: 0.875rem; color: var(--warning-text);">
        <i class="fas fa-info-circle"></i>
        <strong>Annual Requirement:</strong> $2,000 minimum in sales
    </p>
</div>
```

### Linking to Public Info Pages
Include in email templates:
```html
<div style="background-color: #f0f7f1; padding: 20px; text-align: center;">
    <p><strong>Learn More About Our Services</strong></p>
    <a href="https://yourdomain.com/service-info.html" style="color: #4cb354;">
        View Complete Information →
    </a>
</div>
```