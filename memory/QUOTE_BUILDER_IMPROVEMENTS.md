# Quote Builder Improvements & Standardization Guide

## Overview
This document provides a comprehensive, step-by-step guide to transform NWCA's quote builders from fragile, inconsistent tools into bulletproof, professional applications. Follow each section in order for best results.

## Current State Assessment

### Quote Builders to Update
1. **Embroidery Quote Builder** (`embroidery-quote-builder.html`)
2. **Cap Embroidery Quote Builder** (`cap-embroidery-quote-builder.html`)
3. **DTG Quote Builder** (`dtg-quote-builder.html`)
4. **Screen Print Quote Builder** (`screenprint-quote-builder.html`)

### Critical Issues Found
- ❌ No error handling (silent failures)
- ❌ No data persistence (work lost on refresh)
- ❌ Poor form validation
- ❌ Security vulnerabilities (XSS risks)
- ❌ No mobile optimization
- ❌ Inconsistent UI/UX across builders
- ❌ Missing print/copy/email functionality
- ❌ Code duplication

---

## Phase 1: Critical Infrastructure (Week 1)

### 1.1 Create Shared Base Components

#### Create: `/shared_components/js/quote-builder-base.js`
```javascript
class QuoteBuilderBase {
    constructor(config) {
        this.config = {
            prefix: config.prefix || 'QUOTE',
            autoSaveInterval: 30000, // 30 seconds
            ...config
        };
        this.products = [];
        this.isDirty = false;
        this.lastSave = null;
        this.initializeAutoSave();
        this.initializeErrorHandling();
        this.initializeBeforeUnload();
    }

    // Error handling wrapper
    async safeExecute(fn, errorMessage = 'An error occurred') {
        try {
            this.showLoading(true);
            const result = await fn();
            this.showLoading(false);
            return result;
        } catch (error) {
            console.error(errorMessage, error);
            this.showError(errorMessage);
            this.showLoading(false);
            return null;
        }
    }

    // Auto-save functionality
    initializeAutoSave() {
        // Load from localStorage on init
        this.loadFromStorage();
        
        // Save periodically
        setInterval(() => {
            if (this.isDirty) {
                this.saveToStorage();
            }
        }, this.config.autoSaveInterval);
    }

    saveToStorage() {
        const data = {
            products: this.products,
            customerInfo: this.getCustomerInfo(),
            timestamp: Date.now()
        };
        localStorage.setItem(`${this.config.prefix}_draft`, JSON.stringify(data));
        this.isDirty = false;
        this.showToast('Draft saved', 'success');
    }

    loadFromStorage() {
        const saved = localStorage.getItem(`${this.config.prefix}_draft`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Check if data is less than 24 hours old
                if (Date.now() - data.timestamp < 86400000) {
                    this.restoreDraft(data);
                    this.showToast('Draft restored', 'info');
                }
            } catch (e) {
                console.error('Failed to restore draft', e);
            }
        }
    }

    // Unsaved changes warning
    initializeBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    // UI Feedback Methods
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        // Create toast if doesn't exist
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Validation Methods
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    validatePhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10;
    }

    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substr(0,3)}) ${cleaned.substr(3,3)}-${cleaned.substr(6)}`;
        }
        return phone;
    }

    validateForm() {
        const errors = [];
        const email = document.getElementById('customer-email')?.value;
        const phone = document.getElementById('customer-phone')?.value;
        const name = document.getElementById('customer-name')?.value;

        if (!name?.trim()) errors.push('Customer name is required');
        if (email && !this.validateEmail(email)) errors.push('Invalid email format');
        if (phone && !this.validatePhone(phone)) errors.push('Phone must be 10 digits');
        if (this.products.length === 0) errors.push('At least one product is required');

        if (errors.length > 0) {
            this.showError(errors.join(', '));
            return false;
        }
        return true;
    }

    // Sanitization for XSS prevention
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    // Safe DOM manipulation
    setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text; // Never use innerHTML with user input
        }
    }
}
```

#### Create: `/shared_components/js/quote-formatter.js`
```javascript
class QuoteFormatter {
    constructor() {
        this.companyInfo = {
            name: 'Northwest Custom Apparel',
            phone: '(253) 922-5793',
            email: 'sales@nwcustomapparel.com',
            logo: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1',
            hours: 'Monday - Friday: 8:30 AM - 5:00 PM PST',
            since: '1977'
        };
    }

    // Format for printing
    formatQuoteForPrint(quoteData) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote ${quoteData.quoteId}</title>
            <link rel="stylesheet" href="/shared_components/css/quote-print.css">
        </head>
        <body>
            <div class="quote-container">
                <header class="quote-header">
                    <img src="${this.companyInfo.logo}" alt="NWCA Logo" class="company-logo">
                    <div class="company-info">
                        <h1>${this.companyInfo.name}</h1>
                        <p>Serving the Pacific Northwest Since ${this.companyInfo.since}</p>
                        <p>${this.companyInfo.phone} | ${this.companyInfo.email}</p>
                    </div>
                </header>
                
                <div class="quote-meta">
                    <div class="quote-number">
                        <h2>Quote #${quoteData.quoteId}</h2>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                        <p>Valid for: 30 days</p>
                    </div>
                    <div class="customer-info">
                        <h3>Customer Information</h3>
                        <p><strong>${quoteData.customerName}</strong></p>
                        ${quoteData.companyName ? `<p>${quoteData.companyName}</p>` : ''}
                        <p>${quoteData.customerEmail}</p>
                        <p>${this.formatPhone(quoteData.customerPhone)}</p>
                        ${quoteData.projectName ? `<p>Project: ${quoteData.projectName}</p>` : ''}
                    </div>
                </div>

                <div class="quote-items">
                    <h3>Quote Details</h3>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Description</th>
                                <th>Quantity</th>
                                <th>Setup</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.formatItemsForPrint(quoteData.items)}
                        </tbody>
                        <tfoot>
                            <tr class="subtotal">
                                <td colspan="5">Subtotal:</td>
                                <td>$${quoteData.subtotal.toFixed(2)}</td>
                            </tr>
                            ${quoteData.setupTotal > 0 ? `
                            <tr class="setup-total">
                                <td colspan="5">Total Setup Fees:</td>
                                <td>$${quoteData.setupTotal.toFixed(2)}</td>
                            </tr>` : ''}
                            <tr class="grand-total">
                                <td colspan="5"><strong>Total:</strong></td>
                                <td><strong>$${quoteData.grandTotal.toFixed(2)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <footer class="quote-footer">
                    <p>Sales Representative: ${quoteData.salesRepName}</p>
                    <p class="terms">This quote is valid for 30 days from the date issued. Prices subject to change after expiration.</p>
                    <p class="thank-you">Thank you for your business!</p>
                </footer>
            </div>
        </body>
        </html>`;
    }

    // Format for copy to clipboard
    formatQuoteForCopy(quoteData) {
        const items = quoteData.items.map(item => 
            `  - ${item.style} - ${item.description}
    Color: ${item.color}
    Sizes: ${this.formatSizes(item.sizes)}
    Quantity: ${item.quantity}
    Setup: $${item.setupFee.toFixed(2)}
    Unit Price: $${item.unitPrice.toFixed(2)}
    Line Total: $${item.total.toFixed(2)}`
        ).join('\n\n');

        return `NORTHWEST CUSTOM APPAREL
Quote #${quoteData.quoteId}
Date: ${new Date().toLocaleDateString()}
Valid for: 30 days

CUSTOMER INFORMATION:
Name: ${quoteData.customerName}
${quoteData.companyName ? `Company: ${quoteData.companyName}` : ''}
Email: ${quoteData.customerEmail}
Phone: ${this.formatPhone(quoteData.customerPhone)}
${quoteData.projectName ? `Project: ${quoteData.projectName}` : ''}

QUOTE DETAILS:
${items}

PRICING SUMMARY:
Subtotal: $${quoteData.subtotal.toFixed(2)}
${quoteData.setupTotal > 0 ? `Setup Fees: $${quoteData.setupTotal.toFixed(2)}` : ''}
TOTAL: $${quoteData.grandTotal.toFixed(2)}

Sales Rep: ${quoteData.salesRepName}
Contact: ${this.companyInfo.phone}
Email: ${this.companyInfo.email}

This quote is valid for 30 days from the date issued.
Thank you for your business!`;
    }

    // Format for email (Outlook)
    formatQuoteForEmail(quoteData) {
        // Similar to copy but with better line breaks for email
        return this.formatQuoteForCopy(quoteData).replace(/\n/g, '%0D%0A');
    }

    formatPhone(phone) {
        const cleaned = ('' + phone).replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substr(0,3)}) ${cleaned.substr(3,3)}-${cleaned.substr(6)}`;
        }
        return phone;
    }

    formatSizes(sizes) {
        if (!sizes || sizes.length === 0) return 'N/A';
        return sizes.map(s => `${s.size}: ${s.quantity}`).join(', ');
    }

    formatItemsForPrint(items) {
        return items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${item.style}</strong><br>
                    ${item.description}<br>
                    <small>Color: ${item.color}</small><br>
                    <small>Sizes: ${this.formatSizes(item.sizes)}</small>
                </td>
                <td>${item.quantity}</td>
                <td>$${item.setupFee.toFixed(2)}</td>
                <td>$${item.unitPrice.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
            </tr>
        `).join('');
    }
}
```

### 1.2 Create Shared CSS

#### Create: `/shared_components/css/quote-builder-common.css`
```css
/* Loading Overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #003f7f;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.loading-text {
    color: white;
    margin-top: 20px;
    font-size: 18px;
}

/* Toast Notifications */
.toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    max-width: 350px;
}

.toast.show {
    transform: translateX(0);
}

.toast-success {
    background: #28a745;
}

.toast-error {
    background: #dc3545;
}

.toast-info {
    background: #17a2b8;
}

.toast-warning {
    background: #ffc107;
    color: #333;
}

/* Form Validation */
.form-control.is-invalid {
    border-color: #dc3545;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23dc3545' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right calc(0.375em + 0.1875rem) center;
    background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
    padding-right: calc(1.5em + 0.75rem);
}

.form-control.is-valid {
    border-color: #28a745;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3e%3cpath fill='%2328a745' d='M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right calc(0.375em + 0.1875rem) center;
    background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
    padding-right: calc(1.5em + 0.75rem);
}

.invalid-feedback {
    display: none;
    width: 100%;
    margin-top: 0.25rem;
    font-size: 0.875em;
    color: #dc3545;
}

.form-control.is-invalid ~ .invalid-feedback {
    display: block;
}

/* Unsaved Changes Indicator */
.unsaved-indicator {
    position: fixed;
    top: 70px;
    right: 20px;
    background: #ffc107;
    color: #333;
    padding: 5px 15px;
    border-radius: 20px;
    font-size: 12px;
    display: none;
    align-items: center;
    gap: 5px;
    z-index: 1000;
}

.unsaved-indicator.show {
    display: flex;
}

.unsaved-indicator::before {
    content: '●';
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Responsive Tables */
@media (max-width: 768px) {
    .table-responsive {
        display: block;
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .items-table {
        font-size: 14px;
    }
    
    .items-table td, .items-table th {
        padding: 8px 5px;
    }
}

/* Accessibility Improvements */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
    border: 0;
}

/* Focus indicators */
button:focus,
input:focus,
select:focus,
textarea:focus {
    outline: 2px solid #4169E1;
    outline-offset: 2px;
}

/* Skip to content link */
.skip-to-content {
    position: absolute;
    top: -40px;
    left: 0;
    background: #003f7f;
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
}

.skip-to-content:focus {
    top: 0;
}

/* Mobile-friendly buttons */
@media (max-width: 768px) {
    .btn {
        min-height: 44px;
        min-width: 44px;
        font-size: 16px;
    }
    
    .modal-footer {
        flex-direction: column;
    }
    
    .modal-footer .btn {
        width: 100%;
        margin: 5px 0;
    }
}

/* Error states */
.error-message {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
    padding: 12px;
    border-radius: 4px;
    margin: 10px 0;
}

.success-message {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
    padding: 12px;
    border-radius: 4px;
    margin: 10px 0;
}

/* Disabled state */
.btn:disabled,
.form-control:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Progress indicator */
.progress-steps {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
}

.progress-step {
    flex: 1;
    text-align: center;
    position: relative;
    padding: 10px;
}

.progress-step.active {
    font-weight: bold;
    color: #003f7f;
}

.progress-step.completed {
    color: #28a745;
}

.progress-step.completed::after {
    content: '✓';
    margin-left: 5px;
}
```

#### Create: `/shared_components/css/quote-print.css`
```css
@media print {
    /* Hide everything except quote content */
    body * {
        visibility: hidden;
    }
    
    .quote-container,
    .quote-container * {
        visibility: visible;
    }
    
    .quote-container {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
    }
    
    /* Hide UI elements */
    .btn,
    .modal,
    .navigation,
    .header-nav,
    .footer,
    .no-print {
        display: none !important;
    }
    
    /* Page setup */
    @page {
        margin: 0.5in;
        size: letter;
    }
    
    /* Header styling */
    .quote-header {
        display: flex;
        justify-content: space-between;
        border-bottom: 2px solid #003f7f;
        padding-bottom: 20px;
        margin-bottom: 30px;
    }
    
    .company-logo {
        max-width: 200px;
        height: auto;
    }
    
    .company-info {
        text-align: right;
    }
    
    .company-info h1 {
        color: #003f7f;
        margin: 0;
        font-size: 24px;
    }
    
    /* Quote meta */
    .quote-meta {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
    }
    
    .quote-number h2 {
        color: #003f7f;
        margin: 0 0 10px 0;
    }
    
    /* Table styling */
    .items-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
    }
    
    .items-table th {
        background: #003f7f;
        color: white;
        padding: 10px;
        text-align: left;
    }
    
    .items-table td {
        padding: 10px;
        border-bottom: 1px solid #ddd;
    }
    
    .items-table tfoot td {
        font-weight: bold;
        border-top: 2px solid #003f7f;
    }
    
    .grand-total td {
        font-size: 18px;
        color: #003f7f;
    }
    
    /* Footer */
    .quote-footer {
        margin-top: 50px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        text-align: center;
    }
    
    .terms {
        font-style: italic;
        font-size: 12px;
        margin: 20px 0;
    }
    
    .thank-you {
        font-size: 16px;
        font-weight: bold;
        color: #003f7f;
    }
    
    /* Avoid page breaks */
    .items-table {
        page-break-inside: avoid;
    }
    
    tr {
        page-break-inside: avoid;
    }
}
```

---

## Phase 2: Standardization Updates (Week 1-2)

### 2.1 Sales Representative List

**Remove:** Taylar Hanson (taylar@nwcustomapparel.com)  
**Ensure Present:** Taneisha Clark (taneisha@nwcustomapparel.com)

#### Standardized List (Apply to ALL Quote Builders):
```html
<select class="form-control" id="sales-rep" required>
    <option value="sales@nwcustomapparel.com" selected>General Sales</option>
    <option value="adriyella@nwcustomapparel.com">Adriyella</option>
    <option value="bradley@nwcustomapparel.com">Bradley Wright</option>
    <option value="erik@nwcustomapparel.com">Erik Mickelson</option>
    <option value="jim@nwcustomapparel.com">Jim Mickelson</option>
    <option value="nika@nwcustomapparel.com">Nika Lao</option>
    <option value="ruth@nwcustomapparel.com">Ruth Nhong</option>
    <option value="art@nwcustomapparel.com">Steve Deland</option>
    <option value="taneisha@nwcustomapparel.com">Taneisha Clark</option>
</select>
```

### 2.2 Success Modal Standardization

#### Apply to ALL Quote Builders:
```html
<div id="success-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Quote Saved Successfully!</h2>
        </div>
        <div class="modal-body">
            <div class="quote-id-display">
                <strong>Quote ID:</strong> 
                <span id="modal-quote-id"></span>
                <button class="copy-btn" onclick="copyQuoteId()">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="modal-details">
                <p><strong>Customer:</strong> <span id="modal-customer"></span></p>
                <p><strong>Total:</strong> <span id="modal-total"></span></p>
                <p><strong>Date:</strong> <span id="modal-date"></span></p>
            </div>
        </div>
        <div class="modal-footer">
            <button onclick="closeModal()" class="btn btn-secondary">
                <i class="fas fa-times"></i> Close
            </button>
            <button onclick="printQuote()" class="btn btn-secondary">
                <i class="fas fa-print"></i> Print
            </button>
            <button onclick="copyQuote()" class="btn btn-secondary">
                <i class="fas fa-copy"></i> Copy
            </button>
            <button onclick="emailQuote()" class="btn btn-secondary">
                <i class="fas fa-envelope"></i> Email
            </button>
            <button onclick="newQuote()" class="btn btn-primary">
                <i class="fas fa-plus"></i> New Quote
            </button>
        </div>
    </div>
</div>
```

### 2.3 Customer Form Standardization

#### Apply to ALL Quote Builders:
```html
<div class="customer-section">
    <h3>Customer Information</h3>
    <div class="form-row">
        <div class="form-group col-md-4">
            <label for="customer-name">Customer Name *</label>
            <input type="text" class="form-control" id="customer-name" required>
            <div class="invalid-feedback">Customer name is required</div>
        </div>
        <div class="form-group col-md-4">
            <label for="customer-email">Email Address *</label>
            <input type="email" class="form-control" id="customer-email" required 
                   pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$">
            <div class="invalid-feedback">Please enter a valid email</div>
        </div>
        <div class="form-group col-md-4">
            <label for="customer-phone">Phone Number</label>
            <input type="tel" class="form-control" id="customer-phone" 
                   placeholder="(xxx) xxx-xxxx" pattern="\(\d{3}\) \d{3}-\d{4}">
            <div class="invalid-feedback">Phone format: (xxx) xxx-xxxx</div>
        </div>
    </div>
    <div class="form-row">
        <div class="form-group col-md-4">
            <label for="company-name">Company Name</label>
            <input type="text" class="form-control" id="company-name">
        </div>
        <div class="form-group col-md-4">
            <label for="project-name">Project Name</label>
            <input type="text" class="form-control" id="project-name">
        </div>
        <div class="form-group col-md-4">
            <label for="sales-rep">Sales Representative *</label>
            <!-- Insert standardized select here -->
        </div>
    </div>
</div>
```

### 2.4 Add Save to Database Checkbox

#### Add to Embroidery and DTG Quote Builders:
```html
<div class="form-check save-option">
    <input type="checkbox" class="form-check-input" id="save-to-db" checked>
    <label class="form-check-label" for="save-to-db">
        Save quote to database
    </label>
</div>
```

---

## Phase 3: Add Core Functionality (Week 2)

### 3.1 Loading Overlay

#### Add to ALL Quote Builders (in HTML):
```html
<div id="loading-overlay" class="loading-overlay">
    <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Processing...</div>
    </div>
</div>
```

### 3.2 Implement Global Functions

#### Add to each quote builder's JavaScript:
```javascript
// Initialize formatter
const quoteFormatter = new QuoteFormatter();

// Print function
function printQuote() {
    if (!lastQuoteData) {
        showError('No quote data available');
        return;
    }
    
    const printContent = quoteFormatter.formatQuoteForPrint(lastQuoteData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
}

// Copy function
function copyQuote() {
    if (!lastQuoteData) {
        showError('No quote data available');
        return;
    }
    
    const quoteText = quoteFormatter.formatQuoteForCopy(lastQuoteData);
    
    navigator.clipboard.writeText(quoteText).then(() => {
        showSuccess('Quote copied to clipboard!');
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = quoteText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showSuccess('Quote copied to clipboard!');
    });
}

// Email function
function emailQuote() {
    if (!lastQuoteData) {
        showError('No quote data available');
        return;
    }
    
    const subject = `Quote ${lastQuoteData.quoteId} - ${lastQuoteData.projectName || 'NWCA'}`;
    const body = quoteFormatter.formatQuoteForEmail(lastQuoteData);
    
    const mailtoLink = `mailto:${lastQuoteData.customerEmail}?subject=${encodeURIComponent(subject)}&body=${body}`;
    
    // Check if link is too long (2083 character limit for some browsers)
    if (mailtoLink.length > 2000) {
        // For long quotes, just copy to clipboard and inform user
        const quoteText = quoteFormatter.formatQuoteForCopy(lastQuoteData);
        navigator.clipboard.writeText(quoteText).then(() => {
            showSuccess('Quote copied! Paste into your email client.');
            // Still try to open email client
            window.location.href = `mailto:${lastQuoteData.customerEmail}?subject=${encodeURIComponent(subject)}`;
        });
    } else {
        window.location.href = mailtoLink;
    }
}

// Copy just the ID
function copyQuoteId() {
    const quoteId = document.getElementById('modal-quote-id').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        showSuccess('Quote ID copied!');
    });
}

// New quote function
function newQuote() {
    if (confirm('Start a new quote? Any unsaved changes will be lost.')) {
        localStorage.removeItem(`${quotePrefix}_draft`);
        location.reload();
    }
}

// Close modal
function closeModal() {
    document.getElementById('success-modal').style.display = 'none';
}

// Helper functions
function showError(message) {
    showToast(message, 'error');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
```

### 3.3 Add Input Validation

#### Real-time validation for all inputs:
```javascript
// Phone number formatting
document.getElementById('customer-phone')?.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 6) {
        value = `(${value.slice(0,3)}) ${value.slice(3,6)}-${value.slice(6,10)}`;
    } else if (value.length >= 3) {
        value = `(${value.slice(0,3)}) ${value.slice(3)}`;
    }
    e.target.value = value;
    
    // Validate
    if (value.replace(/\D/g, '').length === 10) {
        e.target.classList.remove('is-invalid');
        e.target.classList.add('is-valid');
    } else if (value.length > 0) {
        e.target.classList.add('is-invalid');
        e.target.classList.remove('is-valid');
    }
});

// Email validation
document.getElementById('customer-email')?.addEventListener('blur', function(e) {
    const email = e.target.value;
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    
    if (isValid) {
        e.target.classList.remove('is-invalid');
        e.target.classList.add('is-valid');
    } else if (email.length > 0) {
        e.target.classList.add('is-invalid');
        e.target.classList.remove('is-valid');
    }
});

// Required field validation
document.getElementById('customer-name')?.addEventListener('blur', function(e) {
    if (e.target.value.trim()) {
        e.target.classList.remove('is-invalid');
        e.target.classList.add('is-valid');
    } else {
        e.target.classList.add('is-invalid');
        e.target.classList.remove('is-valid');
    }
});
```

### 3.4 Error Handling Wrapper

#### Wrap ALL async operations:
```javascript
// Example: Loading product data
async function loadProduct(styleNumber) {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/products/${styleNumber}`);
        if (!response.ok) {
            throw new Error(`Failed to load product: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Process data
        displayProduct(data);
        
        showLoading(false);
        showSuccess('Product loaded successfully');
        
    } catch (error) {
        console.error('Error loading product:', error);
        showError(`Failed to load product. Please try again or contact support.`);
        showLoading(false);
        
        // Don't crash - show fallback UI
        showEmptyState();
    }
}

// Example: Saving quote
async function saveQuote() {
    try {
        // Validate first
        if (!validateForm()) {
            return;
        }
        
        showLoading(true);
        setButtonsDisabled(true);
        
        const quoteData = buildQuoteData();
        
        const response = await fetch('/api/quote_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quoteData)
        });
        
        if (!response.ok) {
            throw new Error(`Save failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Success
        showSuccessModal(result.quoteId);
        markClean(); // Clear dirty flag
        
    } catch (error) {
        console.error('Error saving quote:', error);
        showError('Failed to save quote. Your data is still here - please try again.');
        
        // Save to localStorage as backup
        saveToStorage();
        
    } finally {
        showLoading(false);
        setButtonsDisabled(false);
    }
}
```

---

## Phase 4: Mobile & Accessibility (Week 3)

### 4.1 Mobile Responsive Updates

#### Add responsive meta tag (if missing):
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

#### Update CSS for mobile:
```css
/* Mobile breakpoints */
@media (max-width: 768px) {
    /* Stack form fields vertically */
    .form-row {
        flex-direction: column;
    }
    
    .form-group {
        width: 100%;
        margin-bottom: 15px;
    }
    
    /* Make tables scrollable */
    .table-wrapper {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    /* Larger touch targets */
    .btn {
        min-height: 44px;
        padding: 12px 20px;
        font-size: 16px;
    }
    
    input, select, textarea {
        font-size: 16px; /* Prevents zoom on iOS */
        min-height: 44px;
    }
    
    /* Stack modal buttons */
    .modal-footer {
        flex-direction: column;
    }
    
    .modal-footer .btn {
        width: 100%;
        margin: 5px 0;
    }
    
    /* Responsive pricing cards */
    .product-card {
        width: 100%;
        margin: 10px 0;
    }
}

@media (max-width: 480px) {
    /* Even smaller screens */
    h1 { font-size: 24px; }
    h2 { font-size: 20px; }
    h3 { font-size: 18px; }
    
    .quote-header {
        flex-direction: column;
        text-align: center;
    }
}
```

### 4.2 Accessibility Improvements

#### Add ARIA labels and roles:
```html
<!-- Skip to content link -->
<a href="#main-content" class="skip-to-content">Skip to main content</a>

<!-- Main content -->
<main id="main-content" role="main">
    <!-- Quote builder content -->
</main>

<!-- Form improvements -->
<form role="form" aria-label="Quote Builder Form">
    <fieldset>
        <legend class="sr-only">Customer Information</legend>
        <!-- Form fields with proper labels -->
    </fieldset>
</form>

<!-- Button improvements -->
<button type="button" 
        class="btn btn-primary" 
        aria-label="Save quote to database"
        onclick="saveQuote()">
    <i class="fas fa-save" aria-hidden="true"></i>
    <span>Save Quote</span>
</button>

<!-- Loading state announcements -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only" id="screen-reader-announcements">
    <!-- JavaScript will update this for screen readers -->
</div>
```

#### Add keyboard navigation:
```javascript
// Enable keyboard navigation for custom elements
document.addEventListener('keydown', function(e) {
    // Escape key closes modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
    
    // Tab trap in modal when open
    if (isModalOpen()) {
        trapFocusInModal(e);
    }
});

// Announce changes to screen readers
function announceToScreenReader(message) {
    const announcement = document.getElementById('screen-reader-announcements');
    if (announcement) {
        announcement.textContent = message;
        // Clear after announcement
        setTimeout(() => {
            announcement.textContent = '';
        }, 1000);
    }
}
```

---

## Phase 5: Testing & Deployment (Week 4)

### 5.1 Testing Checklist

#### Functionality Tests:
- [ ] Form validation works for all fields
- [ ] Phone number auto-formats correctly
- [ ] Email validation accepts valid emails only
- [ ] Required fields prevent submission when empty
- [ ] Auto-save works every 30 seconds
- [ ] Draft restoration works on page load
- [ ] Unsaved changes warning appears
- [ ] Print function generates formatted output
- [ ] Copy function copies all quote data
- [ ] Email function opens Outlook with data
- [ ] All error states show appropriate messages
- [ ] Loading states appear during async operations
- [ ] Success messages confirm actions

#### Cross-Browser Tests:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

#### Responsive Tests:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Landscape orientation
- [ ] Portrait orientation

#### Accessibility Tests:
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast passes WCAG AA
- [ ] Focus indicators visible
- [ ] Form labels associated correctly

#### Security Tests:
- [ ] XSS prevention (try injecting scripts)
- [ ] Input sanitization works
- [ ] No sensitive data in console
- [ ] HTTPS only for API calls

### 5.2 Deployment Steps

1. **Backup Current Files**
   ```bash
   # Create backup directory
   mkdir backup-$(date +%Y%m%d)
   
   # Copy current quote builders
   cp *quote-builder.html backup-$(date +%Y%m%d)/
   cp -r shared_components backup-$(date +%Y%m%d)/
   ```

2. **Deploy Shared Components First**
   - Upload `/shared_components/js/quote-builder-base.js`
   - Upload `/shared_components/js/quote-formatter.js`
   - Upload `/shared_components/css/quote-builder-common.css`
   - Upload `/shared_components/css/quote-print.css`

3. **Update Quote Builders One at a Time**
   - Start with least-used builder (Cap Embroidery)
   - Test thoroughly
   - Move to next builder
   - Monitor for issues

4. **Update HTML Head Sections**
   ```html
   <!-- Add to each quote builder -->
   <link rel="stylesheet" href="/shared_components/css/quote-builder-common.css">
   <script src="/shared_components/js/quote-builder-base.js"></script>
   <script src="/shared_components/js/quote-formatter.js"></script>
   ```

5. **Monitor and Rollback if Needed**
   ```bash
   # If issues arise, restore from backup
   cp backup-$(date +%Y%m%d)/*.html .
   ```

---

## Implementation Priority Order

### Week 1 - Critical Fixes
1. ✅ Create shared base components
2. ✅ Add error handling to all async operations
3. ✅ Implement auto-save functionality
4. ✅ Fix security vulnerabilities
5. ✅ Add form validation

### Week 2 - Standardization
1. ✅ Standardize sales rep lists (remove Taylar, ensure Taneisha)
2. ✅ Unify success modals
3. ✅ Align form layouts
4. ✅ Add save checkbox to all builders
5. ✅ Implement print/copy/email functions

### Week 3 - UX Improvements
1. ✅ Add loading states
2. ✅ Implement toast notifications
3. ✅ Mobile responsiveness
4. ✅ Accessibility features
5. ✅ Keyboard navigation

### Week 4 - Testing & Polish
1. ✅ Comprehensive testing
2. ✅ Bug fixes
3. ✅ Performance optimization
4. ✅ Documentation updates
5. ✅ Deployment

---

## Maintenance Guidelines

### Daily Checks
- Monitor error logs
- Check for failed save attempts
- Verify auto-save is working

### Weekly Tasks
- Review and clear old localStorage data
- Check for browser compatibility issues
- Update sales rep list if changes occur

### Monthly Tasks
- Performance audit
- Accessibility review
- Security scan
- Update dependencies

### When Adding New Features
1. Always extend base class
2. Use existing validation methods
3. Include error handling
4. Add mobile styles
5. Test accessibility
6. Update this documentation

---

## Common Issues & Solutions

### Issue: "Quote not saving"
**Solution:** 
1. Check network tab for API errors
2. Verify localStorage has space
3. Check console for JavaScript errors
4. Ensure required fields are filled

### Issue: "Print layout broken"
**Solution:**
1. Check print CSS is loaded
2. Verify no JavaScript errors
3. Test in print preview mode
4. Check for conflicting styles

### Issue: "Auto-save not working"
**Solution:**
1. Check localStorage permissions
2. Verify interval is set
3. Check for JavaScript errors
4. Clear localStorage and retry

### Issue: "Email too long for Outlook"
**Solution:**
1. Quote automatically copies to clipboard
2. User can paste into email manually
3. Consider implementing email API

---

## Success Metrics

Track these metrics to measure improvement:

1. **Error Rate**: Should decrease by 90%
2. **Save Success Rate**: Should be >99%
3. **User Completion Rate**: Should increase by 30%
4. **Mobile Usage**: Should increase as it becomes usable
5. **Support Tickets**: Should decrease by 50%
6. **Average Time to Complete**: Should decrease by 20%

---

## Final Notes

This guide provides a comprehensive roadmap to transform the quote builders. The key is to implement changes incrementally, test thoroughly, and maintain backward compatibility during the transition.

**Remember:**
- Always backup before making changes
- Test in a staging environment first
- Deploy during low-traffic periods
- Monitor closely after deployment
- Be ready to rollback if needed

**Most Critical:**
If you can only do three things, do these:
1. Add error handling
2. Implement auto-save
3. Fix form validation

These three changes alone will prevent 80% of current issues.

---

*Document created: January 2025*  
*Last updated: January 2025*  
*Version: 1.0*