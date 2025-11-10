# Shared Calculator Components

## Overview
Reusable components and styles shared across all calculator types.

## Base Quote Service Pattern

```javascript
/**
 * Base Quote Service - Extended by all calculators
 * Handles quote generation, database persistence, and email sending
 */
class BaseQuoteService {
    constructor(config = {}) {
        // Configuration
        this.prefix = config.prefix || 'QUOTE';  // e.g., 'DTG', 'EMB', 'LT'
        this.storagePrefix = config.storagePrefix || 'quote';
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // EmailJS configuration
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.emailTemplateId = config.emailTemplateId || 'template_default';

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailjsPublicKey);
        }
    }

    /**
     * Generate unique quote ID with daily sequence
     * Format: PREFIX + MMDD + sequence (e.g., DTG0130-1)
     */
    generateQuoteID() {
        const now = new Date();
        const dateKey = String(now.getMonth() + 1).padStart(2, '0') +
                       String(now.getDate()).padStart(2, '0');

        // Get daily sequence from sessionStorage
        const storageKey = `${this.storagePrefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        // Clean up old sequences (keep only today's)
        this.cleanupOldSequences(dateKey);

        return `${this.prefix}${dateKey}-${sequence}`;
    }

    /**
     * Generate session ID for tracking
     */
    generateSessionID() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${this.storagePrefix}_sess_${timestamp}_${random}`;
    }

    /**
     * Clean up old sequence counters
     */
    cleanupOldSequences(currentDateKey) {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.startsWith(`${this.storagePrefix}_quote_sequence_`) &&
                !key.endsWith(currentDateKey)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }

    /**
     * Save quote to database
     */
    async saveToDatabase(quoteData) {
        try {
            // Format date without milliseconds for Caspio
            const formatDate = (date) => {
                return new Date(date).toISOString().replace(/\.\d{3}Z$/, '');
            };

            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...quoteData.session,
                    CreatedAt: formatDate(new Date()),
                    ExpiresAt: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                })
            });

            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                throw new Error(`Failed to save quote session: ${errorText}`);
            }

            // Save items
            if (quoteData.items && quoteData.items.length > 0) {
                for (const item of quoteData.items) {
                    await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...item,
                            AddedAt: formatDate(new Date())
                        })
                    });
                }
            }

            return true;

        } catch (error) {
            console.error('[BaseQuoteService] Database save failed:', error);
            throw error;
        }
    }

    /**
     * Send quote email via EmailJS
     */
    async sendEmail(emailData) {
        try {
            // Ensure all fields have defaults to prevent corruption
            const safeEmailData = {
                quote_id: emailData.quote_id || '',
                customer_name: emailData.customer_name || '',
                customer_email: emailData.customer_email || '',
                company_name: emailData.company_name || '',
                customer_phone: emailData.customer_phone || '',
                sales_rep: emailData.sales_rep || 'sales@nwcustomapparel.com',

                // Products/pricing
                products_table: emailData.products_table || '',
                subtotal: emailData.subtotal || '0.00',
                ltm_fee: emailData.ltm_fee || '0.00',
                total_amount: emailData.total_amount || '0.00',

                // Company defaults
                company_phone: '253-922-5793',
                company_email: 'sales@nwcustomapparel.com',
                quote_date: new Date().toLocaleDateString(),
                expiry_date: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString(),

                // Additional fields
                ...emailData
            };

            const result = await emailjs.send(
                this.emailjsServiceId,
                this.emailTemplateId,
                safeEmailData
            );

            console.log('[BaseQuoteService] Email sent successfully');
            return true;

        } catch (error) {
            console.error('[BaseQuoteService] Email send failed:', error);
            // Don't throw - quote is still saved
            return false;
        }
    }

    /**
     * Generate HTML table for email
     */
    generateProductsTableHTML(items) {
        let html = '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
        html += '<thead><tr style="background: #f5f5f5;">';
        html += '<th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th>';
        html += '</tr></thead><tbody>';

        items.forEach(item => {
            html += '<tr>';
            html += `<td>${item.productName || item.name}</td>`;
            html += `<td style="text-align: center;">${item.quantity}</td>`;
            html += `<td style="text-align: right;">$${(item.unitPrice || 0).toFixed(2)}</td>`;
            html += `<td style="text-align: right;">$${(item.totalPrice || 0).toFixed(2)}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }
}
```

## Shared Calculator Utilities

```javascript
/**
 * Calculator Utilities - Helper functions for all calculators
 */
window.CalculatorUtilities = {
    /**
     * Format currency with proper decimal places
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    },

    /**
     * Round to nearest half dollar (ceiling)
     */
    roundToHalfDollar(amount) {
        return Math.ceil(amount * 2) / 2;
    },

    /**
     * Calculate markup percentage from margin denominator
     */
    calculateMarkupPercentage(marginDenominator) {
        return ((1 / marginDenominator) - 1) * 100;
    },

    /**
     * Get tier for quantity
     */
    getTierForQuantity(quantity, tiers) {
        return tiers.find(tier =>
            quantity >= tier.min && quantity <= tier.max
        );
    },

    /**
     * Debounce function for input handlers
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Show loading state
     */
    showLoading(element, message = 'Loading...') {
        if (element) {
            element.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">${message}</span>
                    </div>
                    <p class="mt-2">${message}</p>
                </div>
            `;
        }
    },

    /**
     * Show error message
     */
    showError(message, container) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;

        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
        } else {
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    },

    /**
     * Show success message
     */
    showSuccess(message, container) {
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success alert-dismissible fade show';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i> ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;

        if (container) {
            container.insertBefore(successDiv, container.firstChild);
        } else {
            document.body.insertBefore(successDiv, document.body.firstChild);
        }

        // Auto dismiss after 3 seconds
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    },

    /**
     * Validate email format
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Format phone number
     */
    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
        return phone;
    },

    /**
     * Parse query string parameters
     */
    getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');

        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });

        return params;
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Generate CSV from data
     */
    generateCSV(data, headers) {
        let csv = headers.join(',') + '\n';

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            });
            csv += values.join(',') + '\n';
        });

        return csv;
    },

    /**
     * Download data as file
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
};
```

## Shared CSS (manual-calculator-styles.css)

```css
/* ========================================
   NWCA Calculator Shared Styles
   ======================================== */

/* Root Variables - NWCA Green Theme */
:root {
    --primary-color: #4cb354;
    --primary-dark: #2d5f3f;
    --primary-light: #4cb861;
    --primary-lighter: #e8f5e9;
    --secondary-color: #667eea;
    --success-color: #4cb354;
    --warning-color: #ff9800;
    --danger-color: #dc3545;
    --info-color: #17a2b8;

    --bg-color: #f5f7fa;
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --text-muted: #9ca3af;

    --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);

    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
}

/* Base Styles */
* {
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: var(--text-primary);
    background: var(--bg-color);
    line-height: 1.6;
    margin: 0;
}

/* Header Component */
.header {
    background: white;
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 2rem;
}

.logo {
    height: 40px;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
}

.breadcrumb a {
    color: var(--primary-color);
    text-decoration: none;
}

.breadcrumb a:hover {
    text-decoration: underline;
}

/* Main Container */
.main-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
}

/* Page Title */
.page-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.page-subtitle {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
}

/* Card Component */
.card {
    background: var(--card-bg);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
    overflow: hidden;
}

.card-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: #fafbfc;
}

.card-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.card-title i {
    color: var(--primary-color);
}

.card-body {
    padding: 1.5rem;
}

/* Calculator Grid Layout */
.calculator-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
}

@media (max-width: 768px) {
    .calculator-grid {
        grid-template-columns: 1fr;
    }
}

/* Hero Section */
.hero-section {
    background: linear-gradient(135deg, var(--primary-lighter), #f8f9fa);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
    text-align: center;
}

.hero-section.placeholder-mode {
    background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
}

.hero-summary {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
}

.hero-prices {
    display: flex;
    justify-content: center;
    gap: 3rem;
}

.hero-price-container {
    text-align: center;
}

.hero-price-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
}

.hero-price {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary-color);
}

.hero-price.placeholder {
    color: var(--text-muted);
    font-size: 1.5rem;
    font-weight: 400;
}

.hero-price-sublabel {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
}

/* Form Components */
.form-group {
    margin-bottom: 1.5rem;
}

.form-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
}

.form-label .required {
    color: var(--danger-color);
}

.form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 1rem;
    transition: all 0.2s;
}

.form-control:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
}

.form-control:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
}

.input-group {
    display: flex;
    align-items: stretch;
}

.input-group-text {
    background: #f5f5f5;
    border: 1px solid var(--border-color);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    padding: 0.75rem 1rem;
}

.input-group .form-control {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.form-text {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* Base Cost Emphasis */
.highlight-base-cost {
    position: relative;
    padding-top: 2rem;
}

.base-cost-arrow {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    color: var(--primary-color);
    animation: bounce 2s infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-10px); }
}

.base-cost-emphasis {
    border-color: var(--primary-color) !important;
    border-width: 2px !important;
}

/* Location Cards */
.location-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
}

.location-card {
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
}

.location-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.location-card.active {
    border-color: var(--primary-color);
    background: var(--primary-lighter);
}

.location-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.location-name {
    font-weight: 500;
}

/* Breakdown Table */
.breakdown-table {
    width: 100%;
}

.breakdown-table td {
    padding: 0.75rem 0;
    border-bottom: 1px solid #f0f0f0;
}

.breakdown-table td:last-child {
    text-align: right;
    font-weight: 500;
}

.breakdown-table tr.highlight {
    background: var(--primary-lighter);
}

.breakdown-table tr.total-row {
    border-top: 2px solid var(--primary-color);
}

.breakdown-table tr.total-row td {
    padding-top: 1rem;
    font-size: 1.125rem;
}

/* Buttons */
.btn {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.btn:hover {
    transform: translateY(-2px);
}

.btn:active {
    transform: translateY(0);
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
    box-shadow: var(--shadow-md);
}

.btn-secondary {
    background: #6b7280;
    color: white;
}

.btn-secondary:hover {
    background: #4b5563;
    box-shadow: var(--shadow-md);
}

.button-group {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
}

/* Pricing Placeholder */
.pricing-placeholder {
    padding: 3rem;
    text-align: center;
    color: var(--text-secondary);
}

.pricing-placeholder i {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.pricing-placeholder h3 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

/* Success Message */
.success-message {
    background: var(--success-color);
    color: white;
    padding: 1rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 1rem;
}

.success-message i {
    font-size: 2rem;
}

/* Loading State */
.loading-state {
    text-align: center;
    padding: 3rem;
}

.spinner-border {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 0.25em solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spinner-border .75s linear infinite;
}

@keyframes spinner-border {
    to { transform: rotate(360deg); }
}

/* Alert Messages */
.alert {
    padding: 1rem;
    margin-bottom: 1rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
}

.alert-danger {
    color: #721c24;
    background-color: #f8d7da;
    border-color: #f5c6cb;
}

.alert-success {
    color: #155724;
    background-color: #d4edda;
    border-color: #c3e6cb;
}

.alert-dismissible {
    position: relative;
    padding-right: 3rem;
}

.alert-dismissible .close {
    position: absolute;
    top: 0;
    right: 0;
    padding: 1rem;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
    .hero-prices {
        flex-direction: column;
        gap: 1.5rem;
    }

    .hero-price {
        font-size: 2rem;
    }

    .button-group {
        flex-direction: column;
    }

    .btn {
        width: 100%;
        justify-content: center;
    }
}

/* Print Styles */
@media print {
    .header,
    .btn,
    .button-group {
        display: none;
    }

    .card {
        box-shadow: none;
        border: 1px solid #ddd;
    }

    .calculator-grid {
        grid-template-columns: 1fr;
    }
}

/* Utility Classes */
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.font-weight-bold { font-weight: 700; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 1rem; }
.mb-4 { margin-bottom: 1.5rem; }
.p-1 { padding: 0.25rem; }
.p-2 { padding: 0.5rem; }
.p-3 { padding: 1rem; }
.p-4 { padding: 1.5rem; }
```

---

**Component Type**: Shared Calculator Components
**Purpose**: Reusable code, utilities, and styles for all calculator types
**Usage**: Import/include these components in any calculator implementation