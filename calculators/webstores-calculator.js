/**
 * Webstores Calculator JavaScript
 * Handles webstore setup quote calculations and email functionality
 */

// Configuration
const CALCULATOR_CONFIG = {
    emailPublicKey: '4qSbDO-SQs19TbP80',
    emailServiceId: 'service_1c4k67j',
    emailTemplateId: 'webstore'
};

class WebstoreCalculator {
    constructor() {
        // Initialize EmailJS
        emailjs.init(CALCULATOR_CONFIG.emailPublicKey);
        
        // Initialize quote service
        this.quoteService = new WebstoreQuoteService();
        
        // Store current quote data
        this.currentQuote = null;
        this.lastQuoteID = null;
        this.selectedStoreType = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.elements = {
            // Store type cards
            storeTypeCards: document.querySelectorAll('.store-type-card'),
            
            // Input elements
            logoCount: document.getElementById('logoCount'),
            expectedVolume: document.getElementById('expectedVolume'),
            calculateBtn: document.getElementById('calculateBtn'),
            
            // Display elements
            priceDisplay: document.getElementById('priceDisplay'),
            priceBreakdown: document.getElementById('priceBreakdown'),
            logoFeeRow: document.getElementById('logoFeeRow'),
            logoFeeLabel: document.getElementById('logoFeeLabel'),
            logoFeeAmount: document.getElementById('logoFeeAmount'),
            totalAmount: document.getElementById('totalAmount'),
            surchargeNote: document.getElementById('surchargeNote'),
            surchargeText: document.getElementById('surchargeText'),
            
            // Email form
            emailQuoteBtn: document.getElementById('emailQuoteBtn'),
            emailModal: document.getElementById('emailModal'),
            quoteForm: document.getElementById('quoteForm'),
            customerName: document.getElementById('customerName'),
            customerEmail: document.getElementById('customerEmail'),
            companyName: document.getElementById('companyName'),
            customerPhone: document.getElementById('customerPhone'),
            projectDescription: document.getElementById('projectDescription'),
            salesRep: document.getElementById('salesRep'),
            notes: document.getElementById('notes'),
            sendEmailBtn: document.getElementById('sendEmailBtn'),
            
            // Accordion
            accordionItems: document.querySelectorAll('.accordion-item'),
            
            // Sample store
            sampleStoreImg: document.getElementById('sampleStoreImg'),
            sampleModal: document.getElementById('sampleModal')
        };
    }

    bindEvents() {
        // Store type selection
        this.elements.storeTypeCards.forEach(card => {
            card.addEventListener('click', () => this.selectStoreType(card));
        });

        // Calculate button
        this.elements.calculateBtn.addEventListener('click', () => this.calculate());

        // Input changes
        this.elements.logoCount.addEventListener('input', () => {
            if (this.selectedStoreType) this.calculate();
        });

        // Email form
        this.elements.emailQuoteBtn.addEventListener('click', () => this.showEmailForm());
        this.elements.quoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendQuote();
        });

        // Accordion
        this.elements.accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            header.addEventListener('click', () => this.toggleAccordion(item));
        });

        // Sample store image
        this.elements.sampleStoreImg.addEventListener('click', () => this.showSampleModal());
    }

    selectStoreType(card) {
        // Remove selected class from all cards
        this.elements.storeTypeCards.forEach(c => c.classList.remove('selected'));
        
        // Add selected class to clicked card
        card.classList.add('selected');
        
        // Store the selected type
        this.selectedStoreType = card.dataset.type;
    }

    calculate() {
        if (!this.selectedStoreType) {
            alert('Please select a store type first');
            return;
        }

        const logoCount = parseInt(this.elements.logoCount.value) || 0;
        const expectedVolume = parseInt(this.elements.expectedVolume.value) || 0;

        // Calculate costs
        const setupFee = 300;
        const logoFee = logoCount * 100;
        const totalCost = setupFee + logoFee;

        // Update display
        this.elements.priceBreakdown.style.display = 'block';
        
        // Logo fee row
        if (logoCount > 0) {
            this.elements.logoFeeRow.style.display = 'flex';
            this.elements.logoFeeLabel.textContent = `Logo Digitization (${logoCount} logo${logoCount > 1 ? 's' : ''})`;
            this.elements.logoFeeAmount.textContent = `$${logoFee.toFixed(2)}`;
        } else {
            this.elements.logoFeeRow.style.display = 'none';
        }

        // Total
        this.elements.totalAmount.textContent = `$${totalCost.toFixed(2)}`;
        this.elements.priceDisplay.textContent = `$${totalCost.toFixed(2)}`;
        this.elements.priceDisplay.classList.remove('prompt');

        // Surcharge note
        const surcharge = this.selectedStoreType === 'Open/Close' ? 2 : 10;
        this.elements.surchargeNote.style.display = 'block';
        this.elements.surchargeText.textContent = `Note: ${this.selectedStoreType} stores have a $${surcharge.toFixed(2)} per item surcharge for processing.`;

        // Show email button
        this.elements.emailQuoteBtn.style.display = 'block';

        // Store quote data
        this.currentQuote = {
            storeType: this.selectedStoreType,
            logoCount: logoCount,
            expectedVolume: expectedVolume,
            setupFee: setupFee,
            logoFee: logoFee,
            totalCost: totalCost,
            surcharge: surcharge,
            minimumGuarantee: 2000 // Store this for reference but don't add to cost
        };
    }

    toggleAccordion(item) {
        item.classList.toggle('active');
    }

    showSampleModal() {
        this.elements.sampleModal.classList.add('active');
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
                companyName: this.elements.companyName.value,
                customerPhone: this.elements.customerPhone.value || '',
                projectDescription: this.elements.projectDescription.value || '',
                salesRepName: salesRepName,
                salesRepEmail: salesRepEmail,
                notes: this.elements.notes.value || ''
            };

            // Save to database
            const result = await this.quoteService.saveQuote(quoteData);
            const quoteID = result.quoteID;

            // Generate benefits HTML based on store type
            const benefitsHtml = this.currentQuote.storeType === 'Open/Close' 
                ? `<ul>
                    <li>Perfect for seasonal ordering and special events</li>
                    <li>Consolidated ordering reduces shipping costs</li>
                    <li>Lower per-item surcharge ($2.00)</li>
                    <li>Net 10 billing available with approved credit</li>
                   </ul>`
                : `<ul>
                    <li>24/7 ordering availability</li>
                    <li>Perfect for companies with frequent new hires</li>
                    <li>No minimum order quantities</li>
                    <li>Individual shipping to employees available</li>
                   </ul>`;

            // Prepare email data
            const emailData = {
                to_email: quoteData.customerEmail,
                from_name: 'Northwest Custom Apparel',
                reply_to: salesRepEmail,
                quote_type: 'Webstore Setup',
                quote_id: quoteID,
                quote_date: new Date().toLocaleDateString(),
                customer_name: quoteData.customerName,
                company_name: quoteData.companyName,
                customer_email: quoteData.customerEmail,
                customer_phone: quoteData.customerPhone || 'Not provided',
                project_name: quoteData.projectDescription || 'Webstore Setup',
                notes: quoteData.notes || 'No special notes for this order',
                grand_total: `$${quoteData.totalCost.toFixed(2)}`,
                sales_rep_name: quoteData.salesRepName,
                sales_rep_email: quoteData.salesRepEmail,
                sales_rep_phone: '253-922-5793',
                company_year: '1977',
                // Webstore specific
                store_type: quoteData.storeType,
                annual_volume: quoteData.expectedVolume || 'Not specified',
                logo_count: quoteData.logoCount,
                setup_total: `$${quoteData.totalCost.toFixed(2)}`,
                surcharge_info: `$${quoteData.surcharge.toFixed(2)} per item surcharge`,
                store_benefits_html: benefitsHtml,
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
                        <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Price</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e5e7eb;">Web Store Setup Fee</td>
                        <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">1</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$300.00</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$300.00</td>
                    </tr>
                    ${quoteData.logoCount > 0 ? `
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e5e7eb;">Logo Digitization</td>
                        <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${quoteData.logoCount}</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$100.00</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$${quoteData.logoFee.toFixed(2)}</td>
                    </tr>` : ''}
                    <tr style="font-weight: bold; background-color: #f8f9fa;">
                        <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Total Setup Cost:</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">$${quoteData.totalCost.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="background-color: #fffbeb; border: 1px solid #fbbf24; padding: 12px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                    <strong>Store Type:</strong> ${quoteData.storeType}<br>
                    <strong>Per-Item Surcharge:</strong> $${quoteData.surcharge.toFixed(2)}<br>
                    <strong>Annual Sales Minimum:</strong> $2,000.00 required<br>
                    ${quoteData.expectedVolume ? `<strong>Expected Annual Volume:</strong> ${quoteData.expectedVolume} items` : ''}
                </p>
            </div>
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
    window.webstoreCalculator = new WebstoreCalculator();
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

function closeSampleModal() {
    document.getElementById('sampleModal').classList.remove('active');
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
    const calculator = window.webstoreCalculator;
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
                .info-box {
                    background: #fffbeb;
                    border: 1px solid #fbbf24;
                    padding: 1rem;
                    margin: 1rem 0;
                    border-radius: 6px;
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
                <h1 style="margin: 0; color: #333;">Webstore Setup Quote</h1>
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
                        <td>Web Store Setup Fee</td>
                        <td style="text-align: center;">1</td>
                        <td style="text-align: right;">$300.00</td>
                        <td style="text-align: right;">$300.00</td>
                    </tr>
                    ${quote.logoCount > 0 ? `
                    <tr>
                        <td>Logo Digitization (${quote.logoCount} logo${quote.logoCount > 1 ? 's' : ''})</td>
                        <td style="text-align: center;">${quote.logoCount}</td>
                        <td style="text-align: right;">$100.00</td>
                        <td style="text-align: right;">$${quote.logoFee.toFixed(2)}</td>
                    </tr>` : ''}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">TOTAL SETUP COST:</td>
                        <td style="text-align: right;">$${quote.totalCost.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="info-box">
                <h3 style="margin-top: 0;">Store Details</h3>
                <p><strong>Store Type:</strong> ${quote.storeType}</p>
                <p><strong>Per-Item Surcharge:</strong> $${quote.surcharge.toFixed(2)}</p>
                <p><strong>Annual Sales Minimum:</strong> $2,000.00 required</p>
                ${quote.expectedVolume ? `<p><strong>Expected Annual Volume:</strong> ${quote.expectedVolume} items</p>` : ''}
            </div>
            
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