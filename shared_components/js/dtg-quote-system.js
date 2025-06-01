// DTG Quote System - Replaces shopping cart with simple quote builder
// For Northwest Custom Apparel - May 2025

(function() {
    'use strict';

    // Configuration - Updated to match your exact API base URL
    const config = {
        apiBaseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        ltmThreshold: 24,
        ltmFee: 50.00,
        sessionKey: 'nwca_quote_session',
        quoteKey: 'nwca_current_quote',
        brandColor: '#2e5827' // NWCA Green
    };

    // Quote Manager
    window.DTGQuoteManager = {
        currentQuote: {
            id: null,
            sessionId: null,
            items: [],
            totalQuantity: 0,
            subtotal: 0,
            ltmTotal: 0,
            grandTotal: 0
        },

        // Initialize quote system
        init: function() {
            console.log('[QUOTE] Initializing DTG Quote System');
            this.loadSession();
            this.setupUI();
            this.bindEvents();
        },

        // Load or create session
        loadSession: function() {
            let sessionId = localStorage.getItem(config.sessionKey);
            if (!sessionId) {
                sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem(config.sessionKey, sessionId);
            }
            this.currentQuote.sessionId = sessionId;
            
            // Load existing quote if available
            const savedQuote = localStorage.getItem(config.quoteKey);
            if (savedQuote) {
                try {
                    const quoteData = JSON.parse(savedQuote);
                    Object.assign(this.currentQuote, quoteData);
                    this.updateQuoteSummary();
                } catch (e) {
                    console.error('[QUOTE] Error loading saved quote:', e);
                }
            }
        },

        // Setup UI elements
        setupUI: function() {
            // Replace "Add to Cart" section with quote builder
            const cartSection = document.getElementById('add-to-cart-section');
            if (cartSection) {
                cartSection.innerHTML = this.getQuoteBuilderHTML();
            }

            // Add quote summary panel
            this.addQuoteSummaryPanel();
        },

        // Get quote builder HTML
        getQuoteBuilderHTML: function() {
            return `
                <h3 class="section-title" style="color: ${config.brandColor};">Build Your Quote</h3>
                
                <!-- Step 1: Quantity First -->
                <div class="quote-step" id="step-quantity">
                    <h4>Step 1: How many pieces do you need?</h4>
                    <div class="quantity-input-group">
                        <input type="number" id="total-quantity" min="1" placeholder="Enter total quantity" 
                               style="font-size: 1.2em; padding: 10px; width: 200px; border: 2px solid ${config.brandColor};">
                        <button id="calculate-pricing" class="btn-primary" 
                                style="background-color: ${config.brandColor}; margin-left: 10px;">
                            Calculate Pricing
                        </button>
                    </div>
                    
                    <!-- Pricing Preview -->
                    <div id="pricing-preview" style="display: none; margin-top: 20px;">
                        <!-- Populated by JavaScript -->
                    </div>
                </div>
                
                <!-- Step 2: Size Distribution -->
                <div class="quote-step" id="step-sizes" style="display: none;">
                    <h4>Step 2: Distribute across sizes</h4>
                    <div id="size-distribution-grid">
                        <!-- Populated by JavaScript -->
                    </div>
                    <div class="size-validation-message" style="color: red; display: none;">
                        Sizes must add up to total quantity
                    </div>
                </div>
                
                <!-- Step 3: Add to Quote -->
                <div class="quote-step" id="step-add" style="display: none;">
                    <button id="add-to-quote-btn" class="btn-primary btn-large" 
                            style="background-color: ${config.brandColor}; width: 100%; padding: 15px; font-size: 1.1em;">
                        Add to Quote
                    </button>
                </div>
            `;
        },

        // Add quote summary panel
        addQuoteSummaryPanel: function() {
            const panel = document.createElement('div');
            panel.id = 'quote-summary-panel';
            panel.className = 'quote-summary-panel';
            panel.style.cssText = `
                position: fixed;
                right: 0;
                top: 0;
                width: 380px;
                height: 100vh;
                background: white;
                border-left: 3px solid ${config.brandColor};
                padding: 20px;
                box-shadow: -4px 0 12px rgba(0,0,0,0.15);
                z-index: 1000;
                overflow-y: auto;
                transition: transform 0.3s ease;
                transform: translateX(100%);
            `;
            
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="color: ${config.brandColor}; margin: 0;">Your Quote</h3>
                    <button onclick="DTGQuoteManager.toggleQuotePanel()" 
                            style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 8px 12px; cursor: pointer; font-size: 0.9em; font-weight: bold;"
                            id="quote-toggle-btn">✕ Close</button>
                </div>
                <div id="quote-panel-content">
                <div id="quote-items-list">
                    <p style="color: #666;">No items yet</p>
                </div>
                <div class="quote-totals" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <div class="total-row" style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Subtotal:</span>
                        <span id="quote-subtotal">$0.00</span>
                    </div>
                    <div class="total-row ltm-row" style="display: none; color: #dc3545;">
                        <span>LTM Fees:</span>
                        <span id="quote-ltm">$0.00</span>
                    </div>
                    <div class="total-row" style="font-weight: bold; font-size: 1.2em; margin-top: 10px;">
                        <span>Total:</span>
                        <span id="quote-total">$0.00</span>
                    </div>
                </div>
                <div class="quote-actions" style="margin-top: 20px;">
                    <button onclick="DTGQuoteManager.saveQuote()" class="btn-secondary" style="width: 100%; margin-bottom: 10px;">💾 Save Quote</button>
                    <button onclick="DTGQuoteManager.loadQuotePrompt()" class="btn-secondary" style="width: 100%; margin-bottom: 10px;">📂 Load Quote</button>
                    <button onclick="DTGQuoteManager.exportPDF()" class="btn-secondary" style="width: 100%; margin-bottom: 10px;">📄 Download PDF</button>
                    <button onclick="DTGQuoteManager.emailQuote()" class="btn-secondary" style="width: 100%; margin-bottom: 10px;">✉️ Email Quote</button>
                    <button onclick="DTGQuoteManager.clearQuote()" class="btn-link" style="width: 100%; color: #dc3545;">🗑️ Clear Quote</button>
                </div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // Add floating toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'quote-panel-toggle';
            toggleBtn.innerHTML = '💰 Quote (<span id="quote-item-count-btn">0</span>)';
            toggleBtn.style.cssText = `
                position: fixed;
                right: 20px;
                bottom: 20px;
                background: ${config.brandColor};
                color: white;
                border: none;
                border-radius: 25px;
                padding: 12px 20px;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 999;
                transition: all 0.3s ease;
                font-size: 0.9em;
            `;
            toggleBtn.onclick = () => this.toggleQuotePanel();
            document.body.appendChild(toggleBtn);
        },

        // Bind events
        bindEvents: function() {
            // Quantity calculation
            const calcBtn = document.getElementById('calculate-pricing');
            if (calcBtn) {
                calcBtn.addEventListener('click', () => this.calculatePricing());
            }

            // Add to quote
            const addBtn = document.getElementById('add-to-quote-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.addItemToQuote());
            }

            // Quantity input enter key
            const qtyInput = document.getElementById('total-quantity');
            if (qtyInput) {
                qtyInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.calculatePricing();
                });
            }
        },

        // Calculate pricing based on quantity
        calculatePricing: function() {
            const quantity = parseInt(document.getElementById('total-quantity').value);
            if (!quantity || quantity < 1) {
                alert('Please enter a valid quantity');
                return;
            }

            // Determine pricing tier
            const tier = this.getPricingTier(quantity);
            const hasLTM = quantity < config.ltmThreshold;
            
            // Get base price from current pricing data
            const basePrice = this.getBasePriceForTier(tier);
            const ltmPerUnit = hasLTM ? (config.ltmFee / quantity) : 0;
            const finalPrice = basePrice + ltmPerUnit;

            // Show pricing preview
            const preview = document.getElementById('pricing-preview');
            preview.style.display = 'block';
            
            if (hasLTM) {
                preview.innerHTML = `
                    <div class="ltm-explanation" style="background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px;">
                        <h4 style="color: #856404; margin-top: 0;">Less Than Minimum (LTM) Fee Applies</h4>
                        <p>For orders under ${config.ltmThreshold} pieces, a $${config.ltmFee} setup fee is distributed across all items.</p>
                        
                        <div class="price-breakdown" style="margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>Base price per piece (${config.ltmThreshold}-piece pricing):</span>
                                <strong>$${basePrice.toFixed(2)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #dc3545;">
                                <span>LTM fee per piece ($${config.ltmFee} ÷ ${quantity}):</span>
                                <strong>$${ltmPerUnit.toFixed(2)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 1.2em; padding-top: 10px; border-top: 1px solid #ddd;">
                                <span>Your price per piece:</span>
                                <strong style="color: ${config.brandColor};">$${finalPrice.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                preview.innerHTML = `
                    <div class="pricing-info" style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px;">
                        <h4 style="color: #155724; margin-top: 0;">Your Pricing Tier: ${tier}</h4>
                        <div style="font-size: 1.2em;">
                            Price per piece: <strong style="color: ${config.brandColor};">$${basePrice.toFixed(2)}</strong>
                        </div>
                    </div>
                `;
            }

            // Show size distribution step
            this.showSizeDistribution(quantity);
        },

        // Get pricing tier based on quantity
        getPricingTier: function(quantity) {
            if (quantity >= 72) return '72+';
            if (quantity >= 48) return '48-71';
            return '24-47';
        },

        // Get base price for tier (from current pricing data)
        getBasePriceForTier: function(tier) {
            // Try DTG adapter data first (window.nwcaPricingData)
            if (window.nwcaPricingData && window.nwcaPricingData.prices) {
                const prices = window.nwcaPricingData.prices;
                const firstSize = Object.keys(prices)[0];
                if (firstSize && prices[firstSize] && prices[firstSize][tier]) {
                    return parseFloat(prices[firstSize][tier]);
                }
            }
            
            // Try legacy currentCaspioPricing format
            if (window.currentCaspioPricing && window.currentCaspioPricing.prices) {
                const prices = window.currentCaspioPricing.prices;
                const firstSize = Object.keys(prices)[0];
                if (firstSize && prices[firstSize] && prices[firstSize][tier]) {
                    return parseFloat(prices[firstSize][tier]);
                }
            }
            
            // Fallback prices
            const fallbackPrices = {
                '24-47': 15.99,
                '48-71': 14.99,
                '72+': 13.99
            };
            return fallbackPrices[tier] || 15.99;
        },

        // Show size distribution inputs
        showSizeDistribution: function(totalQuantity) {
            const sizesStep = document.getElementById('step-sizes');
            const grid = document.getElementById('size-distribution-grid');
            
            // Get available sizes from DTG adapter or fallback
            const sizes = window.nwcaPricingData?.uniqueSizes || window.currentCaspioPricing?.uniqueSizes || ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
            
            grid.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    ${sizes.map(size => `
                        <div style="text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <label style="font-weight: bold; display: block; margin-bottom: 5px;">${size}</label>
                            <input type="number" class="size-qty-input" data-size="${size}" 
                                   min="0" value="0" style="width: 60px; padding: 5px;">
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-top: 10px;">
                    <span>Total: <strong id="size-total">0</strong> / ${totalQuantity}</span>
                </div>
            `;
            
            sizesStep.style.display = 'block';
            
            // Add validation listeners
            const inputs = grid.querySelectorAll('.size-qty-input');
            inputs.forEach(input => {
                input.addEventListener('input', () => this.validateSizeDistribution(totalQuantity));
            });
            
            // Show add button
            document.getElementById('step-add').style.display = 'block';
        },

        // Validate size distribution
        validateSizeDistribution: function(totalQuantity) {
            const inputs = document.querySelectorAll('.size-qty-input');
            let sum = 0;
            inputs.forEach(input => {
                sum += parseInt(input.value) || 0;
            });
            
            document.getElementById('size-total').textContent = sum;
            const validationMsg = document.querySelector('.size-validation-message');
            const addBtn = document.getElementById('add-to-quote-btn');
            
            if (sum === totalQuantity) {
                validationMsg.style.display = 'none';
                addBtn.disabled = false;
                addBtn.style.opacity = '1';
            } else {
                validationMsg.style.display = 'block';
                addBtn.disabled = true;
                addBtn.style.opacity = '0.5';
            }
            
            return sum === totalQuantity;
        },

        // Add item to quote
        addItemToQuote: function() {
            const totalQuantity = parseInt(document.getElementById('total-quantity').value);
            if (!this.validateSizeDistribution(totalQuantity)) {
                alert('Please ensure sizes add up to total quantity');
                return;
            }

            // Gather product data
            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = urlParams.get('StyleNumber') || window.nwcaPricingData?.styleNumber || window.currentCaspioPricing?.styleNumber;
            const color = urlParams.get('COLOR') || window.nwcaPricingData?.color || window.currentCaspioPricing?.color;
            const location = document.getElementById('parent-dtg-location-select')?.value || 'FF';
            
            // Get size breakdown
            const sizeBreakdown = {};
            document.querySelectorAll('.size-qty-input').forEach(input => {
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    sizeBreakdown[input.dataset.size] = qty;
                }
            });

            // Calculate pricing
            const tier = this.getPricingTier(totalQuantity);
            const basePrice = this.getBasePriceForTier(tier);
            const hasLTM = totalQuantity < config.ltmThreshold;
            const ltmPerUnit = hasLTM ? (config.ltmFee / totalQuantity) : 0;
            const finalPrice = basePrice + ltmPerUnit;
            const lineTotal = finalPrice * totalQuantity;

            // Create quote item
            const item = {
                id: 'item_' + Date.now(),
                lineNumber: this.currentQuote.items.length + 1,
                styleNumber: styleNumber,
                productName: document.getElementById('product-title-context')?.textContent || 'Product',
                color: color,
                embellishmentType: 'dtg',
                printLocation: location,
                printLocationName: this.getLocationName(location),
                quantity: totalQuantity,
                hasLTM: hasLTM,
                baseUnitPrice: basePrice,
                ltmPerUnit: ltmPerUnit,
                finalUnitPrice: finalPrice,
                lineTotal: lineTotal,
                sizeBreakdown: sizeBreakdown,
                pricingTier: tier,
                imageUrl: document.getElementById('product-image-main')?.src || ''
            };

            // Add to quote
            this.currentQuote.items.push(item);
            this.updateQuoteTotals();
            this.saveQuoteToStorage();
            this.updateQuoteSummary();
            
            // Log analytics
            this.logAnalytics('item_added', {
                styleNumber: styleNumber,
                quantity: totalQuantity,
                hasLTM: hasLTM,
                priceShown: finalPrice
            });

            // Show success message
            this.showSuccessMessage();
            
            // Reset form
            this.resetQuoteBuilder();
        },

        // Get location name
        getLocationName: function(code) {
            const locations = {
                'FF': 'Full Front',
                'FB': 'Full Back',
                'LC': 'Left Chest',
                'JF': 'Jumbo Front',
                'JB': 'Jumbo Back'
            };
            return locations[code] || code;
        },

        // Update quote totals
        updateQuoteTotals: function() {
            let subtotal = 0;
            let ltmTotal = 0;
            let totalQuantity = 0;

            this.currentQuote.items.forEach(item => {
                // Subtotal is base prices only
                subtotal += item.baseUnitPrice * item.quantity;
                // LTM is already included in finalUnitPrice, so we track it separately for display
                ltmTotal += item.ltmPerUnit * item.quantity;
                totalQuantity += item.quantity;
            });

            this.currentQuote.subtotal = subtotal;
            this.currentQuote.ltmTotal = ltmTotal;
            // Grand total is the actual amount (finalUnitPrice * quantity for each item)
            this.currentQuote.grandTotal = this.currentQuote.items.reduce((sum, item) => sum + item.lineTotal, 0);
            this.currentQuote.totalQuantity = totalQuantity;
        },

        // Update quote summary display
        updateQuoteSummary: function() {
            const itemsList = document.getElementById('quote-items-list');
            const subtotalEl = document.getElementById('quote-subtotal');
            const ltmEl = document.getElementById('quote-ltm');
            const totalEl = document.getElementById('quote-total');
            const ltmRow = document.querySelector('.ltm-row');

            if (this.currentQuote.items.length === 0) {
                itemsList.innerHTML = '<p style="color: #666;">No items yet</p>';
            } else {
                itemsList.innerHTML = this.currentQuote.items.map(item => `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${item.styleNumber} - ${item.color}</strong>
                            <button onclick="DTGQuoteManager.removeItem('${item.id}')" 
                                    style="color: #dc3545; border: none; background: none; cursor: pointer;">×</button>
                        </div>
                        <div style="font-size: 0.9em; color: #666;">
                            ${item.printLocationName} | Qty: ${item.quantity} | $${item.finalUnitPrice.toFixed(2)}/ea
                        </div>
                        <div style="text-align: right; font-weight: bold;">
                            $${item.lineTotal.toFixed(2)}
                        </div>
                    </div>
                `).join('');
            }

            subtotalEl.textContent = '$' + this.currentQuote.subtotal.toFixed(2);
            ltmEl.textContent = '$' + this.currentQuote.ltmTotal.toFixed(2);
            totalEl.textContent = '$' + this.currentQuote.grandTotal.toFixed(2);

            if (this.currentQuote.ltmTotal > 0) {
                ltmRow.style.display = 'flex';
            } else {
                ltmRow.style.display = 'none';
            }
            
            // Update floating button count
            const btnCount = document.getElementById('quote-item-count-btn');
            if (btnCount) {
                btnCount.textContent = this.currentQuote.items.length;
            }
        },

        // Remove item from quote
        removeItem: function(itemId) {
            this.currentQuote.items = this.currentQuote.items.filter(item => item.id !== itemId);
            this.updateQuoteTotals();
            this.saveQuoteToStorage();
            this.updateQuoteSummary();
        },

        // Save quote to storage
        saveQuoteToStorage: function() {
            localStorage.setItem(config.quoteKey, JSON.stringify(this.currentQuote));
        },

        // Save quote to database
        saveQuote: async function() {
            try {
                // Create quote ID if not exists
                if (!this.currentQuote.id) {
                    this.currentQuote.id = 'Q_' + new Date().toISOString().replace(/[-:T]/g, '').substr(0, 15);
                }

                // Prepare quote session data (using your API structure)
                const quoteSessionData = {
                    QuoteID: this.currentQuote.id,
                    SessionID: this.currentQuote.sessionId,
                    CustomerEmail: '', // Can be populated later
                    CustomerName: '',
                    CompanyName: '',
                    Status: 'Active',
                    Notes: `DTG Quote - ${this.currentQuote.items.length} items, Total: $${this.currentQuote.grandTotal.toFixed(2)}`
                };

                // Save to your quote_sessions API
                console.log('[QUOTE] Saving quote session to API:', quoteSessionData);
                console.log('[QUOTE] API URL:', `${config.apiBaseUrl}/quote_sessions`);
                
                const response = await fetch(`${config.apiBaseUrl}/quote_sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(quoteSessionData)
                });

                console.log('[QUOTE] API Response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[QUOTE] API Error response:', errorText);
                    throw new Error(`Failed to save quote session: ${response.status} - ${errorText}`);
                }

                const savedQuoteSession = await response.json();
                console.log('[QUOTE] Quote session saved successfully:', savedQuoteSession);
                
                // Now save each quote item using your quote_items API
                for (const item of this.currentQuote.items) {
                    await this.saveQuoteItem(item);
                }
                
                // Show success
                alert('Quote saved successfully! Quote ID: ' + this.currentQuote.id);
                
                // Log analytics
                this.logAnalytics('quote_saved');
                
            } catch (error) {
                console.error('[QUOTE] Error saving quote:', error);
                alert('Error saving quote: ' + error.message);
            }
        },

        // Export quote as PDF
        exportPDF: function() {
            if (this.currentQuote.items.length === 0) {
                alert('No items in quote to export');
                return;
            }

            // Use existing order-form-pdf.js functionality
            if (window.generateQuotePDF) {
                window.generateQuotePDF(this.currentQuote);
            } else {
                console.error('[QUOTE] PDF generation not available');
                alert('PDF export coming soon!');
            }
            
            this.logAnalytics('quote_exported');
        },

        // Load quote prompt
        loadQuotePrompt: function() {
            const quoteId = prompt('Enter Quote ID (e.g., Q_20250531123456):');
            if (quoteId) {
                this.loadQuoteById(quoteId);
            }
        },

        // Load quote by ID
        loadQuoteById: async function(quoteId) {
            try {
                const loadingMsg = document.createElement('div');
                loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid #2e5827; border-radius: 8px; z-index: 10000;';
                loadingMsg.innerHTML = '<p>Loading quote...</p>';
                document.body.appendChild(loadingMsg);

                await this.loadQuote(quoteId);
                
                document.body.removeChild(loadingMsg);
                alert(`Quote ${quoteId} loaded successfully!`);
                this.logAnalytics('quote_loaded', { quoteId });
                
            } catch (error) {
                const loadingMsg = document.querySelector('[style*="Loading quote"]');
                if (loadingMsg) document.body.removeChild(loadingMsg);
                
                alert('Failed to load quote: ' + error.message);
                console.error('[QUOTE] Load error:', error);
            }
        },

        // Email quote
        emailQuote: function() {
            const email = prompt('Enter email address:');
            if (email) {
                console.log('[QUOTE] Emailing quote to:', email);
                alert('Quote email functionality coming soon!');
                this.logAnalytics('quote_emailed', { email });
            }
        },

        // Clear quote
        clearQuote: function() {
            if (confirm('Are you sure you want to clear the current quote?')) {
                this.currentQuote.items = [];
                this.currentQuote.id = null;
                this.updateQuoteTotals();
                this.saveQuoteToStorage();
                this.updateQuoteSummary();
                this.resetQuoteBuilder();
            }
        },

        // Reset quote builder form
        resetQuoteBuilder: function() {
            document.getElementById('total-quantity').value = '';
            document.getElementById('pricing-preview').style.display = 'none';
            document.getElementById('step-sizes').style.display = 'none';
            document.getElementById('step-add').style.display = 'none';
        },

        // Show success message
        showSuccessMessage: function() {
            const preview = document.getElementById('pricing-preview');
            preview.innerHTML = `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; text-align: center;">
                    <h4 style="color: #155724; margin: 0;">✓ Item added to quote successfully!</h4>
                </div>
            `;
            
            setTimeout(() => {
                preview.style.display = 'none';
            }, 3000);
        },

        // Save individual quote item (using your quote_items API)
        saveQuoteItem: async function(item) {
            try {
                console.log('[QUOTE] Saving quote item:', item.id);
                
                const itemData = {
                    QuoteID: this.currentQuote.id,
                    LineNumber: item.lineNumber,
                    StyleNumber: item.styleNumber,
                    ProductName: item.productName,
                    Color: item.color,
                    ColorCode: item.color.toUpperCase().replace(/\s+/g, '_'), // Generate color code
                    EmbellishmentType: item.embellishmentType,
                    PrintLocation: item.printLocation,
                    PrintLocationName: item.printLocationName,
                    Quantity: item.quantity,
                    HasLTM: item.hasLTM ? "Yes" : "No", // Convert boolean to string!
                    BaseUnitPrice: item.baseUnitPrice,
                    LTMPerUnit: item.ltmPerUnit,
                    FinalUnitPrice: item.finalUnitPrice, // Correct field name
                    LineTotal: item.lineTotal,
                    SizeBreakdown: JSON.stringify(item.sizeBreakdown),
                    PricingTier: item.pricingTier,
                    ImageURL: item.imageUrl || '',
                    AddedAt: new Date().toISOString() // Add timestamp
                };

                console.log('[QUOTE] Saving quote item:', itemData);
                
                const response = await fetch(`${config.apiBaseUrl}/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[QUOTE] API Error saving item:', errorText);
                    throw new Error(`Failed to save item: ${response.status} - ${errorText}`);
                }

                const savedItem = await response.json();
                console.log('[QUOTE] Item saved successfully:', savedItem);
                return savedItem;
                
            } catch (error) {
                console.error('[QUOTE] Error saving quote item:', error);
                throw error;
            }
        },

        // Load existing quote (using your quote_sessions and quote_items APIs)
        loadQuote: async function(quoteId) {
            try {
                console.log('[QUOTE] Loading quote:', quoteId);
                
                // Get quote session
                const sessionResponse = await fetch(`${config.apiBaseUrl}/quote_sessions?quoteID=${quoteId}`);
                
                if (!sessionResponse.ok) {
                    throw new Error(`Failed to load quote session: ${sessionResponse.status}`);
                }

                const sessionData = await sessionResponse.json();
                console.log('[QUOTE] Quote session loaded:', sessionData);
                
                if (!sessionData || sessionData.length === 0) {
                    throw new Error('Quote not found');
                }
                
                const quoteSession = sessionData[0]; // Get first matching session
                
                // Get quote items
                const itemsResponse = await fetch(`${config.apiBaseUrl}/quote_items?quoteID=${quoteId}`);
                
                if (!itemsResponse.ok) {
                    throw new Error(`Failed to load quote items: ${itemsResponse.status}`);
                }

                const itemsData = await itemsResponse.json();
                console.log('[QUOTE] Quote items loaded:', itemsData);
                
                // Update current quote with loaded data
                this.currentQuote.id = quoteSession.QuoteID;
                this.currentQuote.sessionId = quoteSession.SessionID;
                this.currentQuote.items = [];
                
                // Convert API items back to quote items
                if (itemsData && itemsData.length > 0) {
                    itemsData.forEach(apiItem => {
                        const sizeBreakdown = apiItem.SizeBreakdown ? JSON.parse(apiItem.SizeBreakdown) : {};
                        
                        const quoteItem = {
                            id: 'item_' + apiItem.PK_ID,
                            lineNumber: apiItem.LineNumber || this.currentQuote.items.length + 1,
                            styleNumber: apiItem.StyleNumber,
                            productName: apiItem.ProductName,
                            color: apiItem.Color,
                            embellishmentType: apiItem.EmbellishmentType,
                            printLocation: apiItem.PrintLocation,
                            printLocationName: apiItem.PrintLocationName,
                            quantity: apiItem.Quantity,
                            hasLTM: apiItem.HasLTM === "Yes", // Convert string back to boolean
                            baseUnitPrice: apiItem.BaseUnitPrice,
                            ltmPerUnit: apiItem.LTMPerUnit,
                            finalUnitPrice: apiItem.FinalUnitPrice, // Correct field name
                            lineTotal: apiItem.LineTotal, // Correct field name
                            sizeBreakdown: sizeBreakdown,
                            pricingTier: apiItem.PricingTier,
                            imageUrl: apiItem.ImageURL
                        };
                        
                        this.currentQuote.items.push(quoteItem);
                    });
                }
                
                this.updateQuoteTotals();
                this.updateQuoteSummary();
                
                return {
                    session: quoteSession,
                    items: itemsData
                };
                
            } catch (error) {
                console.error('[QUOTE] Error loading quote:', error);
                throw error;
            }
        },

        // Toggle quote panel visibility
        toggleQuotePanel: function() {
            const panel = document.getElementById('quote-summary-panel');
            const toggleBtn = document.getElementById('quote-panel-toggle');
            
            if (!panel || !toggleBtn) return;
            
            const isOpen = panel.style.transform === 'translateX(0px)';
            
            if (isOpen) {
                // Close panel
                panel.style.transform = 'translateX(100%)';
                toggleBtn.style.display = 'block';
            } else {
                // Open panel
                panel.style.transform = 'translateX(0px)';
                toggleBtn.style.display = 'none';
            }
        },

        // Log analytics (using your quote_analytics API)
        logAnalytics: async function(eventType, data = {}) {
            const analyticsData = {
                SessionID: this.currentQuote.sessionId,
                QuoteID: this.currentQuote.id,
                EventType: eventType,
                StyleNumber: data.styleNumber || '',
                Color: data.color || '',
                PrintLocation: data.printLocation || '',
                Quantity: data.quantity || 0,
                PriceShown: data.priceShown || 0,
                ...data
            };
            
            console.log('[ANALYTICS]', eventType, analyticsData);
            
            // Send to your quote_analytics API
            try {
                const response = await fetch(`${config.apiBaseUrl}/quote_analytics`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(analyticsData)
                });
                
                if (response.ok) {
                    console.log('[ANALYTICS] Event logged successfully');
                } else {
                    console.warn('[ANALYTICS] API response not OK:', response.status);
                }
            } catch (error) {
                console.warn('[ANALYTICS] Failed to log event:', error);
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DTGQuoteManager.init());
    } else {
        DTGQuoteManager.init();
    }

})();