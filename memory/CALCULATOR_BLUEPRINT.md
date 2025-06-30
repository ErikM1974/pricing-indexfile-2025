# Calculator Blueprint - The Complete Guide

## Overview

This blueprint is based on the successful Customer Supplied Embroidery Calculator and provides a complete template for building professional pricing calculators with quote functionality, database integration, email capabilities, and print features.

## Table of Contents

1. [File Structure](#file-structure)
2. [HTML Template](#html-template)
3. [JavaScript Calculator Class](#javascript-calculator-class)
4. [Quote Service Implementation](#quote-service-implementation)
5. [Success Modal Pattern](#success-modal-pattern)
6. [Print Functionality](#print-functionality)
7. [EmailJS Integration](#emailjs-integration)
8. [Testing Checklist](#testing-checklist)

## File Structure

```
/calculators/
├── [name]-calculator.html        # Main calculator page
├── [name]-quote-service.js       # Database integration
/staff-dashboard.html             # Add link to new calculator
/memory/
├── Update documentation files as needed
```

## HTML Template

### Complete HTML Structure

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

        /* Modal styles */
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
    </style>
</head>
<body>
    <!-- Header with breadcrumb -->
    <header class="header">
        <div class="header-container">
            <div class="header-left">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                     alt="Northwest Custom Apparel" class="logo">
                <nav class="breadcrumb">
                    <a href="/staff-dashboard.html">Dashboard</a>
                    <span>/</span>
                    <span>[Calculator Name]</span>
                </nav>
            </div>
            <div class="header-right">
                <button class="help-btn" onclick="window.print()">
                    <i class="fas fa-print"></i>
                    Print Quote
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main-container">
        <h1 class="calculator-title">
            <i class="fas fa-[icon]"></i>
            [Calculator Name]
        </h1>

        <div class="calculator-grid">
            <!-- Input Section -->
            <div class="card">
                <h2 class="card-title">Quote Details</h2>
                <!-- Add your input fields here -->
            </div>

            <!-- Results Section -->
            <div class="card">
                <div class="results-section">
                    <div class="results-header">
                        <h3 class="card-title">Your Quote</h3>
                        <div class="price-display prompt" id="priceDisplay">Enter Details</div>
                        <div class="price-label">Total Price</div>
                    </div>
                    
                    <button class="btn btn-primary" id="emailQuoteBtn" style="width: 100%; margin-top: 1.5rem; display: none;">
                        <i class="fas fa-envelope"></i>
                        Email This Quote
                    </button>
                </div>
            </div>
        </div>
    </main>

    <!-- Email Modal -->
    <div class="modal-overlay" id="emailModal">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">Send Quote</h3>
                <button class="modal-close" onclick="closeEmailModal()">×</button>
            </div>
            <form id="quoteForm">
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="customerName">Customer Name *</label>
                            <input type="text" class="form-control" id="customerName" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="companyName">Company Name</label>
                            <input type="text" class="form-control" id="companyName">
                        </div>
                        
                        <div class="form-group">
                            <label for="customerEmail">Customer Email *</label>
                            <input type="email" class="form-control" id="customerEmail" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="customerPhone">Phone Number</label>
                            <input type="tel" class="form-control" id="customerPhone">
                        </div>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="projectName">Project/Order Name</label>
                        <input type="text" class="form-control" id="projectName" placeholder="e.g., Annual Company Picnic">
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="salesRep">Sales Representative *</label>
                        <select class="form-control" id="salesRep" required>
                            <option value="sales@nwcustomapparel.com" selected>General Sales</option>
                            <option value="ruth@nwcustomapparel.com">Ruth Nhong</option>
                            <option value="taylar@nwcustomapparel.com">Taylar Hanson</option>
                            <option value="nika@nwcustomapparel.com">Nika Lao</option>
                            <option value="erik@nwcustomapparel.com">Erik Mickelson</option>
                            <option value="adriyella@nwcustomapparel.com">Adriyella</option>
                            <option value="bradley@nwcustomapparel.com">Bradley Wright</option>
                            <option value="jim@nwcustomapparel.com">Jim Mickelson</option>
                            <option value="art@nwcustomapparel.com">Steve Deland</option>
                        </select>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="notes">Notes</label>
                        <textarea class="form-control" id="notes" rows="3" placeholder="Special instructions or additional information..."></textarea>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeEmailModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="sendEmailBtn">
                        <i class="fas fa-paper-plane"></i>
                        Send Quote
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Success Modal -->
    <div class="modal-overlay" id="successModal">
        <div class="modal-container" style="max-width: 500px;">
            <div class="modal-header" style="background: #10b981;">
                <h3 class="modal-title">Quote Sent Successfully!</h3>
                <button class="modal-close" onclick="closeSuccessModal()">×</button>
            </div>
            <div class="modal-body" style="text-align: center; padding: 2.5rem;">
                <div style="margin-bottom: 2rem;">
                    <i class="fas fa-check-circle" style="font-size: 4rem; color: #10b981; margin-bottom: 1rem; display: block;"></i>
                    <p style="font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Your quote has been sent successfully!
                    </p>
                </div>
                
                <div style="background: var(--bg-color); padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem;">
                    <p style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.875rem;">Your Quote ID:</p>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 1rem;">
                        <h2 id="successQuoteID" style="margin: 0; font-size: 2rem; color: var(--primary-color); letter-spacing: 0.05em;">PREFIX-0000-0</h2>
                        <button class="btn btn-secondary" onclick="copyQuoteID()" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-copy"></i>
                            Copy
                        </button>
                    </div>
                </div>
                
                <div style="background: #e8f4fd; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem; font-size: 0.875rem; color: #1e40af;">
                    <i class="fas fa-info-circle"></i>
                    Please save this Quote ID for your records. You'll need it to reference this quote.
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" onclick="printQuote()">
                        <i class="fas fa-print"></i>
                        Print Quote
                    </button>
                    <button class="btn btn-secondary" onclick="closeSuccessModal()">
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration
        const CALCULATOR_CONFIG = {
            emailPublicKey: '4qSbDO-SQs19TbP80',
            emailServiceId: 'service_1c4k67j',
            emailTemplateId: 'template_[specific_id]' // Get from user
        };

        // Calculator class implementation goes here
    </script>
</body>
</html>
```

## JavaScript Calculator Class

### Complete Class Template

```javascript
class [Name]Calculator {
    constructor() {
        // Initialize EmailJS
        emailjs.init(CALCULATOR_CONFIG.emailPublicKey);
        
        // Initialize quote service
        this.quoteService = new [Name]QuoteService();
        
        // Store current quote data
        this.currentQuote = null;
        this.lastQuoteID = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.elements = {
            // Input elements
            quantity: document.getElementById('quantity'),
            // ... other inputs
            
            // Display elements
            priceDisplay: document.getElementById('priceDisplay'),
            totalDisplay: document.getElementById('totalDisplay'),
            
            // Email form
            emailQuoteBtn: document.getElementById('emailQuoteBtn'),
            emailModal: document.getElementById('emailModal'),
            quoteForm: document.getElementById('quoteForm'),
            customerName: document.getElementById('customerName'),
            customerEmail: document.getElementById('customerEmail'),
            companyName: document.getElementById('companyName'),
            customerPhone: document.getElementById('customerPhone'),
            projectName: document.getElementById('projectName'),
            salesRep: document.getElementById('salesRep'),
            notes: document.getElementById('notes'),
            sendEmailBtn: document.getElementById('sendEmailBtn')
        };
    }

    bindEvents() {
        // Bind your calculator-specific events
        this.elements.quantity.addEventListener('input', () => this.calculate());
        
        // Email form events
        this.elements.emailQuoteBtn.addEventListener('click', () => this.showEmailForm());
        this.elements.quoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendQuote();
        });
    }

    calculate() {
        // Your pricing calculation logic
        const quantity = parseInt(this.elements.quantity.value) || 0;
        
        if (quantity < 1) {
            this.resetDisplay();
            return;
        }

        // Calculate pricing
        const unitPrice = this.calculateUnitPrice(quantity);
        const totalCost = unitPrice * quantity;

        // Update display
        this.elements.priceDisplay.textContent = `$${totalCost.toFixed(2)}`;
        this.elements.priceDisplay.classList.remove('prompt');
        this.elements.emailQuoteBtn.style.display = 'block';

        // Store quote data
        this.currentQuote = {
            quantity: quantity,
            unitPrice: unitPrice,
            totalCost: totalCost
            // Add other quote data as needed
        };
    }

    calculateUnitPrice(quantity) {
        // Your pricing logic here
        return 10.00; // Example
    }

    resetDisplay() {
        this.elements.priceDisplay.textContent = 'Enter Details';
        this.elements.priceDisplay.classList.add('prompt');
        this.elements.emailQuoteBtn.style.display = 'none';
        this.currentQuote = null;
    }

    showEmailForm() {
        openEmailModal();
    }

    async sendQuote() {
        if (!this.currentQuote) {
            alert('Please calculate a quote first');
            return;
        }

        const submitBtn = this.elements.sendEmailBtn;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
        submitBtn.disabled = true;

        try {
            // Get form data
            const salesRepEmail = this.elements.salesRep.value;
            const salesRepOption = this.elements.salesRep.options[this.elements.salesRep.selectedIndex];
            const salesRepName = salesRepOption.text;
            
            // Prepare quote data
            const quoteData = {
                ...this.currentQuote,
                customerName: this.elements.customerName.value,
                customerEmail: this.elements.customerEmail.value,
                companyName: this.elements.companyName.value || 'Not Provided',
                customerPhone: this.elements.customerPhone.value || '',
                projectName: this.elements.projectName.value || '',
                salesRepName: salesRepName,
                salesRepEmail: salesRepEmail,
                notes: this.elements.notes.value || ''
            };

            // Save to database
            const result = await this.quoteService.saveQuote(quoteData);
            const quoteID = result.quoteID;

            // Prepare email data
            const emailData = {
                to_email: quoteData.customerEmail,
                from_name: 'Northwest Custom Apparel',
                reply_to: salesRepEmail,
                quote_type: '[Your Calculator Type]',
                quote_id: quoteID,
                quote_date: new Date().toLocaleDateString(),
                customer_name: quoteData.customerName,
                company_name: quoteData.companyName,
                customer_email: quoteData.customerEmail,
                customer_phone: quoteData.customerPhone || 'Not provided',
                project_name: quoteData.projectName || 'Not specified',
                notes: quoteData.notes || 'No special notes for this order',
                grand_total: `$${quoteData.totalCost.toFixed(2)}`,
                sales_rep_name: quoteData.salesRepName,
                sales_rep_email: quoteData.salesRepEmail,
                sales_rep_phone: '253-922-5793',
                company_year: '1977',
                products_html: this.generateQuoteHTML(quoteData)
            };

            // Send email
            await emailjs.send(
                CALCULATOR_CONFIG.emailServiceId,
                CALCULATOR_CONFIG.emailTemplateId,
                emailData
            );

            // Show success
            this.showSuccessModal(quoteID);
            this.hideEmailForm();

        } catch (error) {
            console.error('Error sending quote:', error);
            alert('Error sending quote. Please try again or contact support.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    generateQuoteHTML(quoteData) {
        return `
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Qty</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Unit Price</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e5e7eb;">[Your Product Description]</td>
                        <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${quoteData.quantity}</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$${quoteData.unitPrice.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$${quoteData.totalCost.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    showSuccessModal(quoteID) {
        this.lastQuoteID = quoteID;
        document.getElementById('successQuoteID').textContent = quoteID;
        document.getElementById('successModal').classList.add('active');
    }

    hideEmailForm() {
        closeEmailModal();
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.[name]Calculator = new [Name]Calculator();
});

// Modal functions
function openEmailModal() {
    document.getElementById('emailModal').classList.add('active');
    document.getElementById('customerName').focus();
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.getElementById('quoteForm').reset();
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

// Copy quote ID to clipboard
function copyQuoteID() {
    const quoteID = document.getElementById('successQuoteID').textContent;
    navigator.clipboard.writeText(quoteID).then(() => {
        const copyBtn = event.target.closest('button');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy. Please select and copy manually.');
    });
}

// Print quote functionality
function printQuote() {
    const calculator = window.[name]Calculator;
    if (!calculator || !calculator.currentQuote || !calculator.lastQuoteID) {
        alert('No quote data available to print.');
        return;
    }

    const printWindow = window.open('', '_blank');
    const quote = calculator.currentQuote;
    const quoteID = calculator.lastQuoteID;
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote ${quoteID} - Northwest Custom Apparel</title>
            <style>
                @page { margin: 0.5in; }
                body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333;
                    margin: 0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid #4cb354;
                }
                .logo {
                    max-width: 200px;
                    height: auto;
                    margin-bottom: 1rem;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1rem 0;
                }
                th, td {
                    padding: 0.75rem;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                th {
                    background: #f3f4f6;
                    font-weight: 600;
                }
                .total-row {
                    font-weight: bold;
                    background: #f8f9fa;
                }
                .footer {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 0.875rem;
                    color: #666;
                }
                @media print {
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                     alt="Northwest Custom Apparel" class="logo">
                <h1 style="margin: 0; color: #333;">[Calculator Name] Quote</h1>
            </div>
            
            <div class="quote-info">
                <h2>Quote ID: ${quoteID}</h2>
                <p>Date: ${new Date().toLocaleDateString()}</p>
                <p>Valid for 30 days</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Quantity</th>
                        <th style="text-align: right;">Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>[Your Product Description]</td>
                        <td style="text-align: center;">${quote.quantity}</td>
                        <td style="text-align: right;">$${quote.unitPrice.toFixed(2)}</td>
                        <td style="text-align: right;">$${quote.totalCost.toFixed(2)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">TOTAL:</td>
                        <td style="text-align: right;">$${quote.totalCost.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="footer">
                <p><strong>Northwest Custom Apparel</strong></p>
                <p>2025 Freeman Road East, Milton, WA 98354</p>
                <p>Phone: 253-922-5793 | Email: sales@nwcustomapparel.com</p>
                <p>www.nwcustomapparel.com</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.print();
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    };
}
```

## Quote Service Implementation

### Complete Quote Service Template

```javascript
class [Name]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }
    
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `[prefix]_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `[PREFIX]${dateKey}-${sequence}`;
    }
    
    generateSessionID() {
        return `[prefix]_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cleanupOldSequences(currentDateKey) {
        const prefix = '[prefix]_quote_sequence_';
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(prefix) && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    getPricingTier(quantity) {
        // Return appropriate pricing tier based on quantity
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }
    
    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();
            const sessionID = this.generateSessionID();
            
            console.log(`[[Name]QuoteService] Saving quote with ID:`, quoteID);

            // Step 1: Create quote session
            const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
            
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: quoteData.customerEmail || '',
                CustomerName: quoteData.customerName || 'Guest',
                CompanyName: quoteData.companyName || '',
                Phone: quoteData.customerPhone || '',
                TotalQuantity: parseInt(quoteData.quantity || 0),
                SubtotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                LTMFeeTotal: 0, // Adjust based on your needs
                TotalAmount: parseFloat(quoteData.totalCost.toFixed(2)),
                Status: 'Open',
                ExpiresAt: formattedExpiresAt,
                Notes: quoteData.notes || ''
            };

            console.log(`[[Name]QuoteService] Session data:`, sessionData);

            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            const responseText = await sessionResponse.text();
            console.log(`[[Name]QuoteService] Session response:`, sessionResponse.status, responseText);

            if (!sessionResponse.ok) {
                throw new Error(`Failed to create quote session`);
            }

            // Step 2: Create quote item
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: 1,
                StyleNumber: '[STYLE]',
                ProductName: '[Product Name]',
                Color: '',
                ColorCode: '',
                EmbellishmentType: '[type]',
                PrintLocation: '',
                PrintLocationName: '',
                Quantity: parseInt(quoteData.quantity || 0),
                HasLTM: 'No', // Adjust based on your logic
                BaseUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
                LTMPerUnit: 0,
                FinalUnitPrice: parseFloat(quoteData.unitPrice.toFixed(2)),
                LineTotal: parseFloat(quoteData.totalCost.toFixed(2)),
                SizeBreakdown: '{}',
                PricingTier: this.getPricingTier(quoteData.quantity || 0),
                ImageURL: '',
                AddedAt: addedAt
            };

            console.log(`[[Name]QuoteService] Item data:`, itemData);

            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const itemResponseText = await itemResponse.text();
            console.log(`[[Name]QuoteService] Item response:`, itemResponse.status, itemResponseText);

            if (!itemResponse.ok) {
                console.error('Item creation failed but continuing...');
            }

            return {
                success: true,
                quoteID: quoteID
            };

        } catch (error) {
            console.error(`[[Name]QuoteService] Error:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
```

## Success Modal Pattern

The success modal provides a professional way to display the Quote ID and allow users to copy it or print the quote.

### Key Features:
1. **Large, readable Quote ID display**
2. **Copy to clipboard functionality**
3. **Print quote button**
4. **Clear success messaging**
5. **No auto-dismiss - user controls when to close**

### Implementation Notes:
- Store `lastQuoteID` in the calculator instance
- Update the quote ID text before showing modal
- Provide visual feedback for copy action
- Include informational message about saving the ID

## Print Functionality

The print function creates a clean, professional PDF-ready document.

### Key Elements:
1. **Company branding** with logo
2. **Quote identification** (ID, date, validity)
3. **Clean pricing table**
4. **Professional footer** with contact info
5. **Print-optimized CSS**

### Customization:
- Update product descriptions
- Add calculator-specific details
- Include any special terms or notices
- Adjust table columns as needed

## EmailJS Integration

### Email Template Structure

Create your EmailJS template with this HTML structure:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{quote_type}} Quote</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #4cb354; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                                 alt="Northwest Custom Apparel" style="max-width: 200px; height: auto;">
                        </td>
                    </tr>

                    <!-- Quote Title -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #333333; font-size: 28px; font-weight: bold;">{{quote_type}} Quote</h1>
                            <p style="margin: 10px 0 0 0; color: #666666; font-size: 16px;">Quote ID: {{quote_id}}</p>
                        </td>
                    </tr>

                    <!-- Customer Information -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                                <tr>
                                    <td>
                                        <h2 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Customer Information</h2>
                                        <p style="margin: 5px 0; color: #666666;"><strong>Name:</strong> {{customer_name}}</p>
                                        <p style="margin: 5px 0; color: #666666;"><strong>Company:</strong> {{company_name}}</p>
                                        <p style="margin: 5px 0; color: #666666;"><strong>Email:</strong> {{to_email}}</p>
                                        <p style="margin: 5px 0; color: #666666;"><strong>Phone:</strong> {{customer_phone}}</p>
                                        <p style="margin: 5px 0; color: #666666;"><strong>Project:</strong> {{project_name}}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Quote Details -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <h2 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Quote Details</h2>
                            <div style="background-color: #ffffff; border: 2px solid #4cb354; border-radius: 6px; overflow: hidden;">
                                {{{products_html}}}
                            </div>
                        </td>
                    </tr>

                    <!-- Total -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #4cb354; color: white; padding: 20px; border-radius: 6px;">
                                <tr>
                                    <td align="center">
                                        <h2 style="margin: 0; font-size: 24px;">Grand Total: {{grand_total}}</h2>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Notes Section -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px;">
                                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">
                                    <strong>Notes & Special Instructions:</strong>
                                </h3>
                                <p style="margin: 0; color: #856404;">{{notes}}</p>
                            </div>
                        </td>
                    </tr>

                    <!-- Sales Rep Contact -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                                <tr>
                                    <td align="center">
                                        <h3 style="margin: 0 0 10px 0; color: #333333; font-size: 16px;">Questions? Contact Your Sales Representative</h3>
                                        <p style="margin: 5px 0; color: #666666;"><strong>{{sales_rep_name}}</strong></p>
                                        <p style="margin: 5px 0; color: #666666;">Email: <a href="mailto:{{sales_rep_email}}" style="color: #4cb354;">{{sales_rep_email}}</a></p>
                                        <p style="margin: 5px 0; color: #666666;">Phone: {{sales_rep_phone}}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #333333; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;">
                                <strong>Northwest Custom Apparel</strong><br>
                                Family Owned & Operated Since {{company_year}}
                            </p>
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;">
                                2025 Freeman Road East, Milton, WA 98354<br>
                                Phone: 253-922-5793 | Toll Free: 1-800-851-3671
                            </p>
                            <p style="margin: 0; color: #ffffff; font-size: 14px;">
                                <a href="https://www.nwcustomapparel.com" style="color: #4cb354; text-decoration: none;">www.nwcustomapparel.com</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

### EmailJS Configuration in Template:
- **To Email**: {{to_email}}
- **From Name**: {{from_name}}
- **Reply To**: {{reply_to}}
- **CC**: {{reply_to}}
- **BCC**: erik@nwcustomapparel.com

## Testing Checklist

Before deploying your calculator:

### Functionality Testing
- [ ] All calculations are accurate
- [ ] Form validation works correctly
- [ ] Quote saves to database
- [ ] Email sends successfully
- [ ] Success modal displays correctly
- [ ] Quote ID is shown and can be copied
- [ ] Print function generates clean PDF

### Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Mobile Responsiveness
- [ ] Calculator displays properly on mobile
- [ ] Modals are accessible
- [ ] Forms are usable

### Error Handling
- [ ] Database errors don't break email send
- [ ] Network errors show user-friendly messages
- [ ] Form validation prevents bad data

### Console Checks
- [ ] No JavaScript errors
- [ ] Quote service logs show success
- [ ] Email data is properly formatted

## Implementation Steps

1. **Create Files**
   - Create `[name]-calculator.html`
   - Create `[name]-quote-service.js`

2. **Customize Code**
   - Replace all `[name]`, `[Name]`, `[PREFIX]` placeholders
   - Add your specific pricing logic
   - Customize product descriptions

3. **EmailJS Setup**
   - Create new template in EmailJS
   - Get template ID
   - Update configuration

4. **Add to Dashboard**
   - Add link in `staff-dashboard.html`
   - Use appropriate icon and description

5. **Test Thoroughly**
   - Use testing checklist
   - Test with real data
   - Verify all features work

6. **Documentation**
   - Update CLAUDE.md with new calculator info
   - Document any special features or logic

## Common Customizations

### Adding Special Fields
```javascript
// In HTML
<div class="form-group">
    <label for="customField">Special Option</label>
    <select id="customField" class="form-control">
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
    </select>
</div>

// In JavaScript
this.elements.customField = document.getElementById('customField');

// In calculate()
const customValue = this.elements.customField.value;
```

### Multiple Line Items
```javascript
// Store array of items
this.currentQuote = {
    items: [
        { description: 'Item 1', quantity: 10, price: 100 },
        { description: 'Item 2', quantity: 5, price: 50 }
    ],
    totalCost: 150
};

// Generate HTML table with multiple rows
generateQuoteHTML(quoteData) {
    const rows = quoteData.items.map(item => `
        <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');
    
    return `<table>...${rows}...</table>`;
}
```

## Best Practices

1. **Always validate user input**
2. **Provide clear error messages**
3. **Log important actions for debugging**
4. **Test with edge cases (0 quantity, large numbers)**
5. **Keep the UI responsive during async operations**
6. **Escape script tags in template literals** - Use `<\/script>` to prevent parsing errors
7. **Maintain consistent color theming** - Use NWCA green (#4cb354) across all calculators
8. **Show detailed pricing breakdowns** - Break out costs by component for transparency
9. **Document any special business logic**
10. **Use consistent naming conventions**
11. **Follow the established patterns**

This blueprint provides everything needed to create a professional calculator with full quote functionality. Follow the patterns, customize for your specific needs, and test thoroughly before deployment.