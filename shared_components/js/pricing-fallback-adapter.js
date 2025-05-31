// Pricing Fallback Adapter
// Provides backup pricing when Caspio master bundle fails
// For Northwest Custom Apparel - May 2025

(function() {
    'use strict';

    console.log('[FALLBACK] Pricing fallback adapter loaded');

    // Fallback pricing data
    const fallbackPricing = {
        dtg: {
            'PC61': {
                sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
                locations: {
                    'LC': { name: 'Left Chest', sizes: {
                        'S': { '24-47': 15.99, '48-71': 14.99, '72+': 13.99 },
                        'M': { '24-47': 15.99, '48-71': 14.99, '72+': 13.99 },
                        'L': { '24-47': 15.99, '48-71': 14.99, '72+': 13.99 },
                        'XL': { '24-47': 15.99, '48-71': 14.99, '72+': 13.99 },
                        '2XL': { '24-47': 17.99, '48-71': 16.99, '72+': 15.99 },
                        '3XL': { '24-47': 19.99, '48-71': 18.99, '72+': 17.99 },
                        '4XL': { '24-47': 21.99, '48-71': 20.99, '72+': 19.99 }
                    }},
                    'FF': { name: 'Full Front', sizes: {
                        'S': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'M': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'L': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'XL': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        '2XL': { '24-47': 20.99, '48-71': 19.99, '72+': 18.99 },
                        '3XL': { '24-47': 22.99, '48-71': 21.99, '72+': 20.99 },
                        '4XL': { '24-47': 24.99, '48-71': 23.99, '72+': 22.99 }
                    }},
                    'FB': { name: 'Full Back', sizes: {
                        'S': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'M': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'L': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        'XL': { '24-47': 18.99, '48-71': 17.99, '72+': 16.99 },
                        '2XL': { '24-47': 20.99, '48-71': 19.99, '72+': 18.99 },
                        '3XL': { '24-47': 22.99, '48-71': 21.99, '72+': 20.99 },
                        '4XL': { '24-47': 24.99, '48-71': 23.99, '72+': 22.99 }
                    }}
                }
            }
        },
        embroidery: {
            'PC61': {
                sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
                locations: {
                    'LC': { name: 'Left Chest', sizes: {
                        'S': { '24-47': 8.99, '48-71': 7.99, '72+': 6.99 },
                        'M': { '24-47': 8.99, '48-71': 7.99, '72+': 6.99 },
                        'L': { '24-47': 8.99, '48-71': 7.99, '72+': 6.99 },
                        'XL': { '24-47': 8.99, '48-71': 7.99, '72+': 6.99 },
                        '2XL': { '24-47': 10.99, '48-71': 9.99, '72+': 8.99 },
                        '3XL': { '24-47': 12.99, '48-71': 11.99, '72+': 10.99 },
                        '4XL': { '24-47': 14.99, '48-71': 13.99, '72+': 12.99 }
                    }}
                }
            }
        }
    };

    // Fallback pricing manager
    window.PricingFallbackManager = {
        isActive: false,
        currentData: null,

        // Initialize fallback system
        init: function() {
            console.log('[FALLBACK] Initializing fallback pricing system');
            this.listenForFailures();
        },

        // Listen for Caspio failures
        listenForFailures: function() {
            // Listen for master bundle errors
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'caspioDtgMasterBundleReady') {
                    const data = event.data.data;
                    if (data && data.error && data.error.includes('CommonDataFail')) {
                        console.log('[FALLBACK] Caspio master bundle failed, activating fallback');
                        this.activateFallback();
                    }
                }
            });

            // Listen for adapter timeouts and matrix capture failures
            setTimeout(() => {
                if (!window.nwcaPricingData || !window.nwcaPricingData.prices) {
                    console.log('[FALLBACK] No pricing data detected after timeout, activating fallback');
                    this.activateFallback();
                }
            }, 5000); // 5 second timeout

            // Also listen for pricing matrix capture errors
            let captureFailureCount = 0;
            const originalConsoleError = console.error;
            console.error = function(...args) {
                const message = args.join(' ');
                if (message.includes('PRICING-MATRIX:CAPTURE-ERROR') || message.includes('Header cells not found')) {
                    captureFailureCount++;
                    if (captureFailureCount >= 3) {
                        console.log('[FALLBACK] Multiple matrix capture failures detected, activating fallback');
                        window.PricingFallbackManager.activateFallback();
                    }
                }
                originalConsoleError.apply(console, args);
            };
        },

        // Activate fallback pricing
        activateFallback: function() {
            if (this.isActive) return;
            
            console.log('[FALLBACK] Activating fallback pricing system');
            this.isActive = true;

            // Get current context
            const styleNumber = this.getCurrentStyleNumber();
            const embellishmentType = this.getCurrentEmbellishmentType();
            
            // Show request quote interface instead of pricing
            this.showRequestQuoteInterface();
        },

        // Get current style number
        getCurrentStyleNumber: function() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('StyleNumber') || 
                   document.getElementById('product-style-context')?.textContent ||
                   'PC61';
        },

        // Get current embellishment type
        getCurrentEmbellishmentType: function() {
            const pathname = window.location.pathname;
            if (pathname.includes('dtg')) return 'dtg';
            if (pathname.includes('embroidery')) return 'embroidery';
            if (pathname.includes('screen-print')) return 'screen-print';
            return 'dtg';
        },

        // Create fallback data structure
        createFallbackData: function(styleNumber, embellishmentType) {
            const productData = fallbackPricing[embellishmentType]?.[styleNumber];
            if (!productData) {
                console.warn('[FALLBACK] No fallback data for', styleNumber, embellishmentType);
                return;
            }

            // Create nwcaPricingData structure
            window.nwcaPricingData = {
                styleNumber: styleNumber,
                color: this.getCurrentColor(),
                embellishmentType: embellishmentType,
                uniqueSizes: productData.sizes,
                locations: Object.keys(productData.locations),
                prices: {},
                fallbackMode: true
            };

            // Get current location
            const currentLocation = this.getCurrentLocation();
            if (currentLocation && productData.locations[currentLocation]) {
                window.nwcaPricingData.prices = productData.locations[currentLocation].sizes;
                window.nwcaPricingData.currentLocation = currentLocation;
                window.nwcaPricingData.locationName = productData.locations[currentLocation].name;
            }

            this.currentData = window.nwcaPricingData;
            console.log('[FALLBACK] Created fallback data:', this.currentData);
        },

        // Get current color
        getCurrentColor: function() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('COLOR') || 
                   document.getElementById('pricing-color-name')?.textContent ||
                   'Unknown';
        },

        // Get current location
        getCurrentLocation: function() {
            const locationSelect = document.getElementById('parent-dtg-location-select') ||
                                  document.getElementById('parent-location-select');
            return locationSelect?.value || 'LC';
        },

        // Show request quote interface instead of incorrect pricing
        showRequestQuoteInterface: function() {
            const container = document.querySelector('.pricing-grid-container');
            if (!container) return;

            console.log('[FALLBACK] Showing request quote interface - no pricing displayed');

            // Hide loading states and table
            const loadingElement = document.getElementById('pricing-table-loading');
            if (loadingElement) loadingElement.style.display = 'none';

            const initialState = document.getElementById('pricing-initial-state');
            if (initialState) initialState.style.display = 'none';

            const table = document.getElementById('custom-pricing-grid');
            if (table) table.style.display = 'none';

            // Create request quote interface
            const quoteInterface = document.createElement('div');
            quoteInterface.id = 'quote-request-interface';
            quoteInterface.style.cssText = `
                text-align: center;
                padding: 40px 20px;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                border: 2px solid #2e5827;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                margin: 20px 0;
            `;

            quoteInterface.innerHTML = `
                <div style="background: white; display: inline-block; padding: 30px 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px;">
                    <div style="font-size: 3em; margin-bottom: 15px;">📞</div>
                    <h3 style="color: #2e5827; margin: 0 0 15px 0; font-size: 1.4em;">Request Custom Quote</h3>
                    <p style="color: #666; margin: 0 0 20px 0; line-height: 1.5;">
                        Pricing is temporarily unavailable. Our team will provide accurate, 
                        up-to-date pricing based on your specific requirements.
                    </p>
                    
                    <div style="margin: 20px 0;">
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                            <strong style="color: #2e5827;">✓ Why Request a Quote?</strong><br>
                            <small style="color: #666;">
                                • Get the most current pricing<br>
                                • Volume discounts available<br>
                                • Custom requirements handled<br>
                                • Fast 24-hour response
                            </small>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="PricingFallbackManager.openQuoteForm()" 
                                style="background: #2e5827; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1em;">
                            📝 Request Quote
                        </button>
                        <a href="mailto:sales@northwestcustomapparel.com?subject=Quote Request - ${this.getCurrentStyleNumber()}&body=Hello, I need a quote for:%0A%0AStyle: ${this.getCurrentStyleNumber()}%0AColor: ${this.getCurrentColor()}%0AQuantity: %0APrint Location: %0A%0APlease provide pricing. Thank you!" 
                           style="background: #6c757d; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
                            ✉️ Email Us
                        </a>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.9em; color: #666;">
                        <strong>Quick Contact:</strong><br>
                        📧 sales@northwestcustomapparel.com<br>
                        📞 (555) 123-4567
                    </div>
                </div>
            `;

            // Replace existing content
            container.innerHTML = '';
            container.appendChild(quoteInterface);

            // Disable cart functionality
            this.disableCartFunctionality();
        },

        // Disable cart functionality when pricing unavailable
        disableCartFunctionality: function() {
            // Disable the unified cart system
            const addToCartSection = document.getElementById('add-to-cart-section');
            if (addToCartSection) {
                addToCartSection.style.display = 'none';
            }

            // Disable quantity inputs
            const quantityInputs = document.querySelectorAll('.quantity-input, .size-qty-input, #cart-quantity-input');
            quantityInputs.forEach(input => {
                input.disabled = true;
                input.style.opacity = '0.5';
            });

            // Disable add to cart buttons
            const addButtons = document.querySelectorAll('#main-add-to-cart-btn, .add-to-cart-button, [onclick*="addToCart"]');
            addButtons.forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            });

            // Hide cart summary panel if it exists
            const cartPanel = document.getElementById('cart-summary-panel');
            if (cartPanel) {
                cartPanel.style.display = 'none';
            }

            console.log('[FALLBACK] Cart functionality disabled due to pricing unavailability');
        },

        // Open quote form (called from quote interface)
        openQuoteForm: function() {
            const styleNumber = this.getCurrentStyleNumber();
            const color = this.getCurrentColor();
            const location = this.getCurrentLocation();
            
            // Create quote form modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            `;

            modalContent.innerHTML = `
                <h3 style="margin-top: 0; color: #2e5827;">📝 Request Custom Quote</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Fill out the form below and we'll get back to you with accurate pricing within 24 hours.
                </p>
                
                <form id="quote-request-form" style="display: grid; gap: 15px;">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Your Name *</label>
                        <input type="text" name="customerName" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email Address *</label>
                        <input type="email" name="email" required 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Company/Organization</label>
                        <input type="text" name="company" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Phone Number</label>
                        <input type="tel" name="phone" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Style</label>
                            <input type="text" name="styleNumber" value="${styleNumber}" readonly
                                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Color</label>
                            <input type="text" name="color" value="${color}" readonly
                                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa;">
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Quantity Needed *</label>
                        <input type="number" name="quantity" min="1" required placeholder="Enter total pieces needed"
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Print Location</label>
                        <select name="printLocation" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="">-- Select Location --</option>
                            <option value="LC" ${location === 'LC' ? 'selected' : ''}>Left Chest</option>
                            <option value="FF" ${location === 'FF' ? 'selected' : ''}>Full Front</option>
                            <option value="FB" ${location === 'FB' ? 'selected' : ''}>Full Back</option>
                            <option value="JF" ${location === 'JF' ? 'selected' : ''}>Jumbo Front</option>
                            <option value="JB" ${location === 'JB' ? 'selected' : ''}>Jumbo Back</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Additional Details</label>
                        <textarea name="details" rows="3" placeholder="Tell us about your project, timeline, special requirements, etc."
                                  style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            Cancel
                        </button>
                        <button type="submit" 
                                style="background: #2e5827; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                            📧 Send Quote Request
                        </button>
                    </div>
                </form>
            `;

            modal.className = 'modal-overlay';
            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Handle form submission
            const form = document.getElementById('quote-request-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitQuoteRequest(form, modal);
            });
        },

        // Submit quote request
        submitQuoteRequest: function(form, modal) {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            // Create email body
            const emailBody = `
Hello,

I would like to request a quote for custom apparel:

Customer Information:
- Name: ${data.customerName}
- Email: ${data.email}
- Company: ${data.company || 'N/A'}
- Phone: ${data.phone || 'N/A'}

Product Details:
- Style: ${data.styleNumber}
- Color: ${data.color}
- Quantity: ${data.quantity} pieces
- Print Location: ${data.printLocation || 'Not specified'}

Additional Details:
${data.details || 'None provided'}

Please provide pricing and availability for this order.

Thank you!
            `.trim();

            // Create mailto link
            const subject = `Quote Request - ${data.styleNumber} (${data.quantity} pieces)`;
            const mailtoLink = `mailto:sales@northwestcustomapparel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
            
            // Open email client
            window.location.href = mailtoLink;
            
            // Close modal
            modal.remove();
            
            // Show confirmation
            this.showQuoteRequestConfirmation(data);
        },

        // Show quote request confirmation
        showQuoteRequestConfirmation: function(data) {
            const confirmation = document.createElement('div');
            confirmation.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                border-radius: 5px;
                padding: 20px;
                z-index: 10002;
                max-width: 350px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;

            confirmation.innerHTML = `
                <h4 style="margin: 0 0 10px 0;">✅ Quote Request Sent!</h4>
                <p style="margin: 0 0 10px 0;">
                    Your quote request for <strong>${data.quantity} pieces of ${data.styleNumber}</strong> 
                    has been prepared and your email client should open momentarily.
                </p>
                <p style="margin: 0; font-size: 0.9em; color: #0c5133;">
                    <strong>⏰ Response Time:</strong> Within 24 hours<br>
                    <strong>📧 Contact:</strong> sales@northwestcustomapparel.com
                </p>
            `;

            document.body.appendChild(confirmation);

            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (confirmation.parentElement) {
                    confirmation.remove();
                }
            }, 8000);
        },

        // Add fallback notice
        addFallbackNotice: function() {
            const container = document.querySelector('.pricing-grid-container');
            if (!container) return;

            const notice = document.createElement('div');
            notice.style.cssText = `
                background: #fff3cd;
                color: #856404;
                border: 1px solid #ffeeba;
                border-radius: 5px;
                padding: 10px 15px;
                margin-bottom: 15px;
                font-size: 0.9em;
            `;
            notice.innerHTML = `
                <strong>📋 Fallback Pricing Active</strong><br>
                Using backup pricing data. Some features may be limited.
            `;

            container.insertBefore(notice, container.firstChild);
        },

        // Update pricing for location change
        updateForLocation: function(location) {
            if (!this.isActive || !this.currentData) return;

            const styleNumber = this.currentData.styleNumber;
            const embellishmentType = this.currentData.embellishmentType;
            const productData = fallbackPricing[embellishmentType]?.[styleNumber];
            
            if (productData && productData.locations[location]) {
                this.currentData.prices = productData.locations[location].sizes;
                this.currentData.currentLocation = location;
                this.currentData.locationName = productData.locations[location].name;
                
                this.populatePricingTable();
                this.dispatchPricingDataReady();
                
                console.log('[FALLBACK] Updated pricing for location:', location);
            }
        },

        // Dispatch pricing data ready event
        dispatchPricingDataReady: function() {
            const event = new CustomEvent('pricingDataLoaded', {
                detail: {
                    fallbackMode: true,
                    data: this.currentData
                }
            });
            document.dispatchEvent(event);
            console.log('[FALLBACK] Dispatched pricingDataLoaded event');
        }
    };

    // Listen for location changes
    document.addEventListener('DOMContentLoaded', function() {
        PricingFallbackManager.init();

        // Listen for location selector changes
        const locationSelect = document.getElementById('parent-dtg-location-select') ||
                              document.getElementById('parent-location-select');
        if (locationSelect) {
            locationSelect.addEventListener('change', function() {
                PricingFallbackManager.updateForLocation(this.value);
            });
        }
    });

    // Initialize immediately if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PricingFallbackManager.init());
    } else {
        PricingFallbackManager.init();
    }

})();