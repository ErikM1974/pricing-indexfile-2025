/**
 * Universal Quick Quote Calculator
 * A modular component for instant pricing across all pricing pages
 * Supports dynamic sizing, multiple logos, and various embellishment types
 */

class UniversalQuickQuoteCalculator {
    constructor(config = {}) {
        // Configuration
        this.config = {
            pageType: config.pageType || 'embroidery', // embroidery, dtg, dtf, screenprint, cap-embroidery
            unitLabel: config.unitLabel || 'items', // items, shirts, garments, caps
            defaultQuantity: config.defaultQuantity || 24,
            includedStitches: config.includedStitches || 8000,
            maxPrimaryStitches: config.maxPrimaryStitches || 25000,
            maxAdditionalStitches: config.maxAdditionalStitches || 20000,
            ltmThreshold: config.ltmThreshold || 24,
            ltmFee: config.ltmFee || 50,
            showAdditionalLogos: config.showAdditionalLogos !== false,
            showPrimaryStitchCount: config.showPrimaryStitchCount !== false,
            pricePerThousandStitches: config.pricePerThousandStitches || 1.00,
            ...config
        };

        // State
        this.state = {
            quantity: this.config.defaultQuantity,
            primaryStitches: this.config.includedStitches,
            additionalLogos: [],
            pricingData: null,
            basePrice: 0,
            unitPrice: 0,
            totalPrice: 0,
            sizeGroups: [],
            currentTier: null
        };

        // Initialize
        this.initialize();
    }

    initialize() {
        console.log('[QuickQuote] Initializing Universal Quick Quote Calculator', this.config);
        
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }

        // Listen for pricing data updates
        window.addEventListener('pricingDataLoaded', (event) => {
            console.log('[QuickQuote] Pricing data loaded', event.detail);
            this.updatePricingData(event.detail);
        });

        // Listen for pricing table updates
        this.observePricingTable();
    }

    render() {
        // Find container
        const container = document.getElementById('quick-quote-container');
        if (!container) {
            console.error('[QuickQuote] Container not found! Add <div id="quick-quote-container"></div> to your page.');
            return;
        }

        // Generate HTML
        container.innerHTML = this.generateHTML();

        // Cache elements
        this.cacheElements();

        // Setup event listeners
        this.setupEventListeners();

        // Initial update
        this.updatePricing();
    }

    generateHTML() {
        const isCapEmbroidery = this.config.pageType === 'cap-embroidery';
        
        return `
            <div class="quick-quote">
                <h2>Quick Quote Calculator</h2>
                <p class="quick-quote-subtitle">Enter quantity for instant pricing</p>
                
                <!-- Quantity Input -->
                <div class="quantity-input-group">
                    <button class="quantity-btn" id="decrease-btn">−</button>
                    <input type="number" class="quantity-input" id="quantity-input" value="${this.state.quantity}" min="1" max="10000">
                    <button class="quantity-btn" id="increase-btn">+</button>
                    <span class="quantity-label">${this.config.unitLabel}</span>
                </div>
                
                <!-- Pricing Display -->
                <div class="pricing-display">
                    <div class="unit-price" id="unit-price">$0.00</div>
                    <div class="unit-label" id="unit-label">per ${this.config.unitLabel.slice(0, -1)} (starting price)</div>
                    <div class="total-price" id="total-price">Total: $0.00</div>
                </div>
                
                <!-- Pricing Breakdown -->
                <div class="pricing-breakdown" id="pricing-breakdown">
                    <!-- Dynamically populated -->
                </div>
                
                <!-- Savings Tip -->
                <div class="savings-tip" id="savings-tip" style="display: none;">
                    <span class="savings-tip-icon">💡</span>
                    <span id="savings-tip-text"></span>
                </div>
                
                <!-- LTM Warning -->
                <div class="ltm-warning" id="ltm-warning" style="display: none;">
                    <span>⚠️</span>
                    <span id="ltm-warning-text">Orders under ${this.config.ltmThreshold} ${this.config.unitLabel} include a $${this.config.ltmFee} setup fee</span>
                </div>
                
                <!-- Quick Select -->
                <div class="quick-select">
                    <span class="quick-select-label">Quick select:</span>
                    <div class="quick-select-grid">
                        <button class="quick-select-btn" data-quantity="24">2 Dozen</button>
                        <button class="quick-select-btn" data-quantity="36">3 Dozen</button>
                        <button class="quick-select-btn" data-quantity="48">4 Dozen</button>
                        <button class="quick-select-btn" data-quantity="72">6 Dozen</button>
                        <button class="quick-select-btn" data-quantity="144">12 Dozen</button>
                        <button class="quick-select-btn" data-quantity="288">24 Dozen</button>
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elements = {
            quantityInput: document.getElementById('quantity-input'),
            decreaseBtn: document.getElementById('decrease-btn'),
            increaseBtn: document.getElementById('increase-btn'),
            unitPrice: document.getElementById('unit-price'),
            unitLabel: document.getElementById('unit-label'),
            totalPrice: document.getElementById('total-price'),
            breakdown: document.getElementById('pricing-breakdown'),
            savingsTip: document.getElementById('savings-tip'),
            savingsTipText: document.getElementById('savings-tip-text'),
            ltmWarning: document.getElementById('ltm-warning'),
            ltmWarningText: document.getElementById('ltm-warning-text'),
            quickSelectBtns: document.querySelectorAll('.quick-select-btn')
        };
    }

    setupEventListeners() {
        // Quantity controls
        this.elements.decreaseBtn.addEventListener('click', () => this.updateQuantity(-1));
        this.elements.increaseBtn.addEventListener('click', () => this.updateQuantity(1));
        this.elements.quantityInput.addEventListener('change', () => this.handleQuantityChange());

        // Quick select buttons
        this.elements.quickSelectBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.setQuantity(parseInt(e.target.dataset.quantity)));
        });
    }

    updateQuantity(delta) {
        const newQty = this.state.quantity + delta;
        if (newQty >= 1 && newQty <= 10000) {
            this.state.quantity = newQty;
            this.elements.quantityInput.value = newQty;
            this.updatePricing();
        }
    }

    handleQuantityChange() {
        const qty = parseInt(this.elements.quantityInput.value) || 1;
        
        if (qty < 1) {
            this.state.quantity = 1;
            this.elements.quantityInput.value = 1;
        } else if (qty > 10000) {
            this.state.quantity = 10000;
            this.elements.quantityInput.value = 10000;
        } else {
            this.state.quantity = qty;
        }
        
        this.updatePricing();
    }

    setQuantity(qty) {
        this.state.quantity = qty;
        this.elements.quantityInput.value = qty;
        this.updatePricing();
        
        // Update active button
        this.elements.quickSelectBtns.forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.quantity) === qty) {
                btn.classList.add('active');
            }
        });
    }

    updatePricingData(data) {
        console.log('[QuickQuote] updatePricingData called with:', data);
        
        if (!data || !data.prices || !data.tierData) {
            console.warn('[QuickQuote] Invalid pricing data received');
            return;
        }
        
        // Convert the pricing data format to match our expected structure
        const pricingTiers = [];
        
        // Extract unique sizes from headers, handling slash-separated sizes
        const uniqueSizes = [];
        data.headers.forEach(header => {
            if (header.includes('/')) {
                // Split S/M into S and M
                const sizes = header.split('/');
                sizes.forEach(size => {
                    if (size && !uniqueSizes.includes(size)) {
                        uniqueSizes.push(size);
                    }
                });
            } else if (!header.includes('-') && !uniqueSizes.includes(header)) {
                uniqueSizes.push(header);
            }
        });
        
        // Process each tier
        Object.keys(data.tierData).forEach(tierKey => {
            const tierInfo = data.tierData[tierKey];
            const tier = {
                range: tierKey,
                min: tierInfo.MinQuantity || 1,
                max: tierInfo.MaxQuantity || 99999,
                prices: {}
            };
            
            // Get prices for each size group
            data.headers.forEach(sizeGroup => {
                if (data.prices[sizeGroup] && data.prices[sizeGroup][tierKey] !== undefined) {
                    tier.prices[sizeGroup] = data.prices[sizeGroup][tierKey];
                }
            });
            
            pricingTiers.push(tier);
        });
        
        // Sort tiers by minimum quantity
        pricingTiers.sort((a, b) => a.min - b.min);
        
        this.state.pricingData = { 
            tiers: pricingTiers, 
            headers: data.headers,
            uniqueSizes: uniqueSizes
        };
        
        console.log('[QuickQuote] Processed pricing data:', this.state.pricingData);
        this.updatePricing();
    }

    observePricingTable() {
        // Look for either custom-pricing-grid or universal pricing grid table
        let pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) {
            pricingGrid = document.querySelector('[id$="-table"].pricing-grid');
        }
        if (!pricingGrid) return;

        const observer = new MutationObserver(() => {
            console.log('[QuickQuote] Pricing table updated, extracting data');
            this.extractPricingFromTable();
        });

        observer.observe(pricingGrid, { childList: true, subtree: true });
    }

    extractPricingFromTable() {
        // Look for either custom-pricing-grid or universal pricing grid table
        let table = document.getElementById('custom-pricing-grid');
        if (!table) {
            table = document.querySelector('[id$="-table"].pricing-grid');
        }
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Get headers (sizes)
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        
        // Get pricing data
        const pricingTiers = [];
        tbody.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const tier = {
                range: cells[0].textContent.trim(),
                prices: {}
            };

            // Parse quantity range
            const rangeMatch = tier.range.match(/(\d+)(?:-(\d+)|\+)?/);
            if (rangeMatch) {
                tier.min = parseInt(rangeMatch[1]);
                tier.max = rangeMatch[2] ? parseInt(rangeMatch[2]) : 99999;
            }

            // Get prices for each size
            for (let i = 1; i < cells.length && i < headers.length; i++) {
                const size = headers[i];
                const priceText = cells[i].textContent.trim();
                const price = parseFloat(priceText.replace('$', ''));
                if (!isNaN(price)) {
                    tier.prices[size] = price;
                }
            }

            pricingTiers.push(tier);
        });

        this.state.pricingData = { tiers: pricingTiers, headers: headers.slice(1) };
        this.updatePricing();
    }

    calculateDynamicPricing() {
        if (!this.state.pricingData || !this.state.pricingData.tiers) {
            return { basePrice: 0, sizeGroups: [] };
        }

        // Find the appropriate tier
        const tier = this.state.pricingData.tiers.find(t => 
            this.state.quantity >= t.min && this.state.quantity <= t.max
        );

        if (!tier) {
            // Use first tier for quantities below minimum
            const firstTier = this.state.pricingData.tiers[0];
            if (firstTier && this.state.quantity < firstTier.min) {
                this.state.currentTier = firstTier;
            } else {
                return { basePrice: 0, sizeGroups: [] };
            }
        } else {
            this.state.currentTier = tier;
        }

        // Extract all prices and find base price
        const allPrices = Object.values(this.state.currentTier.prices);
        const basePrice = Math.min(...allPrices);

        // Group sizes by price
        const priceGroups = {};
        Object.entries(this.state.currentTier.prices).forEach(([size, price]) => {
            const upcharge = price - basePrice;
            if (!priceGroups[upcharge]) {
                priceGroups[upcharge] = [];
            }
            priceGroups[upcharge].push(size);
        });

        // Convert to array and sort
        const sizeGroups = Object.entries(priceGroups)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([upcharge, sizes]) => ({
                sizes: sizes.join(', '),
                upcharge: Number(upcharge)
            }));

        return { basePrice, sizeGroups };
    }

    updatePricing() {
        // Calculate base pricing
        const { basePrice, sizeGroups } = this.calculateDynamicPricing();
        this.state.basePrice = basePrice;
        this.state.sizeGroups = sizeGroups;

        // Calculate additional costs
        let additionalCosts = 0;

        // Primary logo overage (if over included stitches)
        if (this.state.primaryStitches > this.config.includedStitches) {
            const extraThousands = (this.state.primaryStitches - this.config.includedStitches) / 1000;
            additionalCosts += extraThousands * this.config.pricePerThousandStitches;
        }

        // Additional logos
        const additionalLogoCost = this.state.additionalLogos.reduce((sum, logo) => {
            return sum + (logo.stitches / 1000 * this.config.pricePerThousandStitches);
        }, 0);
        additionalCosts += additionalLogoCost;

        // LTM fee if applicable
        let ltmFeePerUnit = 0;
        if (this.state.quantity < this.config.ltmThreshold) {
            ltmFeePerUnit = this.config.ltmFee / this.state.quantity;
        }

        // Calculate final prices
        this.state.unitPrice = this.state.basePrice + additionalCosts + ltmFeePerUnit;
        this.state.totalPrice = this.state.unitPrice * this.state.quantity;

        // Update display
        this.updatePricingDisplay();
        this.updateBreakdown();
        this.updateSavingsTip();
        this.updateLTMWarning();
    }

    updatePricingDisplay() {
        // Unit price
        this.elements.unitPrice.classList.add('updating');
        this.elements.unitPrice.textContent = `$${this.state.unitPrice.toFixed(2)}`;
        
        // Unit label
        const isOSFA = this.state.sizeGroups.length === 0 || 
                       (this.state.sizeGroups.length === 1 && this.state.sizeGroups[0].upcharge === 0);
        
        if (isOSFA) {
            this.elements.unitLabel.textContent = `per ${this.config.unitLabel.slice(0, -1)}`;
        } else {
            this.elements.unitLabel.textContent = `per ${this.config.unitLabel.slice(0, -1)} (starting price)`;
        }
        
        // Total price
        const hasUpcharges = this.state.sizeGroups.some(g => g.upcharge > 0);
        const maxUpcharge = hasUpcharges ? Math.max(...this.state.sizeGroups.map(g => g.upcharge)) : 0;
        const maxTotal = (this.state.unitPrice + maxUpcharge) * this.state.quantity;
        
        if (hasUpcharges) {
            this.elements.totalPrice.textContent = `Total: From $${this.state.totalPrice.toFixed(2)}`;
        } else {
            this.elements.totalPrice.textContent = `Total: $${this.state.totalPrice.toFixed(2)}`;
        }

        // Remove updating class
        setTimeout(() => {
            this.elements.unitPrice.classList.remove('updating');
        }, 300);
    }

    updateBreakdown() {
        let html = '';

        // Base price
        html += `
            <div class="breakdown-item">
                <span class="breakdown-label">Base ${this.config.unitLabel.slice(0, -1)} price:</span>
                <span class="breakdown-value">$${this.state.basePrice.toFixed(2)}</span>
            </div>
        `;

        // Size inclusions
        const baseSizes = this.state.sizeGroups.find(g => g.upcharge === 0);
        if (baseSizes) {
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-label">Includes sizes:</span>
                    <span class="breakdown-value">${baseSizes.sizes}</span>
                </div>
            `;
        }

        // Size upcharges
        const upcharges = this.state.sizeGroups.filter(g => g.upcharge > 0);
        if (upcharges.length > 0) {
            html += `
                <div class="breakdown-item" style="margin-top: 8px;">
                    <span class="breakdown-label">Size upcharges:</span>
                </div>
            `;
            
            upcharges.forEach(group => {
                html += `
                    <div class="breakdown-item" style="padding-left: 20px;">
                        <span class="breakdown-label">• ${group.sizes}:</span>
                        <span class="breakdown-value">add $${group.upcharge.toFixed(2)}</span>
                    </div>
                `;
            });
        }

        // Front logo
        if (this.config.showPrimaryStitchCount) {
            const primaryCost = this.state.primaryStitches > this.config.includedStitches ? 
                `+$${((this.state.primaryStitches - this.config.includedStitches) / 1000 * this.config.pricePerThousandStitches).toFixed(2)}` : 
                'included';
            
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-label">Front logo (${this.state.primaryStitches.toLocaleString()} stitches):</span>
                    <span class="breakdown-value">${primaryCost}</span>
                </div>
            `;
        } else {
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-label">Front logo (${this.config.includedStitches.toLocaleString()} stitches):</span>
                    <span class="breakdown-value">included</span>
                </div>
            `;
        }

        // Additional logos
        this.state.additionalLogos.forEach((logo, index) => {
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-label">Additional logo ${index + 1} (${logo.stitches.toLocaleString()} stitches):</span>
                    <span class="breakdown-value">+$${(logo.stitches / 1000 * this.config.pricePerThousandStitches).toFixed(2)}</span>
                </div>
            `;
        });

        // LTM fee
        if (this.state.quantity < this.config.ltmThreshold) {
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-label">Setup fee (< ${this.config.ltmThreshold} ${this.config.unitLabel}):</span>
                    <span class="breakdown-value">+$${(this.config.ltmFee / this.state.quantity).toFixed(2)}</span>
                </div>
            `;
        }

        // Total
        const hasUpcharges = this.state.sizeGroups.some(g => g.upcharge > 0);
        const priceRange = hasUpcharges ? 
            `$${this.state.unitPrice.toFixed(2)}-$${(this.state.unitPrice + Math.max(...this.state.sizeGroups.map(g => g.upcharge))).toFixed(2)}` :
            `$${this.state.unitPrice.toFixed(2)}`;
            
        html += `
            <div class="breakdown-item breakdown-total">
                <span class="breakdown-label">Your price:</span>
                <span class="breakdown-value">${priceRange} /${this.config.unitLabel.slice(0, -1)}</span>
            </div>
        `;

        this.elements.breakdown.innerHTML = html;
    }

    updateSavingsTip() {
        if (!this.state.pricingData || !this.state.pricingData.tiers) {
            this.elements.savingsTip.style.display = 'none';
            return;
        }

        // Find next tier
        const currentTierIndex = this.state.pricingData.tiers.findIndex(t => 
            this.state.quantity >= t.min && this.state.quantity <= t.max
        );

        if (currentTierIndex > 0) {
            const nextTier = this.state.pricingData.tiers[currentTierIndex - 1];
            const itemsNeeded = nextTier.min - this.state.quantity;

            if (itemsNeeded > 0 && itemsNeeded <= 20) {
                // Calculate potential savings
                const currentTotal = this.state.unitPrice * this.state.quantity;
                const nextTierBasePrice = Math.min(...Object.values(nextTier.prices));
                const nextTierUnitPrice = nextTierBasePrice + (this.state.unitPrice - this.state.basePrice);
                const nextTierTotal = nextTierUnitPrice * nextTier.min;
                const savings = (this.state.unitPrice * nextTier.min) - nextTierTotal;

                if (savings > 0) {
                    this.elements.savingsTipText.textContent = 
                        `Add ${itemsNeeded} more ${this.config.unitLabel} to save $${savings.toFixed(2)} total!`;
                    this.elements.savingsTip.style.display = 'flex';
                } else {
                    this.elements.savingsTip.style.display = 'none';
                }
            } else {
                this.elements.savingsTip.style.display = 'none';
            }
        } else {
            this.elements.savingsTip.style.display = 'none';
        }
    }

    updateLTMWarning() {
        if (this.state.quantity < this.config.ltmThreshold) {
            const perItem = (this.config.ltmFee / this.state.quantity).toFixed(2);
            this.elements.ltmWarningText.textContent = 
                `Orders under ${this.config.ltmThreshold} ${this.config.unitLabel} include a $${this.config.ltmFee} setup fee (+$${perItem}/${this.config.unitLabel.slice(0, -1)})`;
            this.elements.ltmWarning.style.display = 'flex';
        } else {
            this.elements.ltmWarning.style.display = 'none';
        }
    }

    // Public methods for customization options
    setPrimaryStitches(stitches) {
        this.state.primaryStitches = stitches;
        this.updatePricing();
    }

    addAdditionalLogo(stitches = 8000) {
        const logoId = Date.now();
        this.state.additionalLogos.push({
            id: logoId,
            stitches: stitches
        });
        this.updatePricing();
        return logoId;
    }

    updateAdditionalLogo(logoId, stitches) {
        const logo = this.state.additionalLogos.find(l => l.id === logoId);
        if (logo) {
            logo.stitches = stitches;
            this.updatePricing();
        }
    }

    removeAdditionalLogo(logoId) {
        this.state.additionalLogos = this.state.additionalLogos.filter(l => l.id !== logoId);
        this.updatePricing();
    }
}

// Export for use
window.UniversalQuickQuoteCalculator = UniversalQuickQuoteCalculator;