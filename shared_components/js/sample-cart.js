/**
 * Sample Cart Management System
 * Handles free sample requests for the top sellers showcase
 * Maximum 3 samples per request, eligibility based on product price < $10
 */

class SampleCart {
    constructor() {
        this.maxSamples = 3;
        this.samples = JSON.parse(sessionStorage.getItem('sampleCart') || '[]');
        this.eligibilityCache = {};
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.initializeUI();
        this.bindEvents();
    }

    /**
     * Initialize the floating cart widget UI
     */
    initializeUI() {
        // Create floating widget if it doesn't exist
        if (!document.getElementById('sampleCartWidget')) {
            const widget = document.createElement('div');
            widget.id = 'sampleCartWidget';
            widget.className = 'sample-cart-widget';
            widget.innerHTML = `
                <div class="sample-cart-inner">
                    <div class="sample-cart-icon">
                        <i class="fas fa-box-open"></i>
                        <span class="sample-count-badge">${this.samples.length}</span>
                    </div>
                    <div class="sample-cart-text">
                        <span class="sample-cart-label">Samples</span>
                        <span class="sample-cart-status">${this.samples.length}/${this.maxSamples}</span>
                    </div>
                </div>
            `;
            document.body.appendChild(widget);
        }
        
        this.updateUI();
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Click handler for the widget
        const widget = document.getElementById('sampleCartWidget');
        if (widget) {
            widget.addEventListener('click', () => this.openSampleModal());
        }
    }

    /**
     * Check if a product is eligible for free samples
     * Products under $10 average price are eligible
     */
    async checkEligibility(styleNumber) {
        // Check cache first
        if (this.eligibilityCache[styleNumber] !== undefined) {
            return this.eligibilityCache[styleNumber];
        }

        try {
            const response = await fetch(`${this.apiBase}/api/size-pricing?styleNumber=${styleNumber}`);
            
            if (!response.ok) {
                console.error(`Failed to check eligibility for ${styleNumber}`);
                this.eligibilityCache[styleNumber] = false;
                return false;
            }

            const data = await response.json();
            
            if (!data || data.length === 0) {
                this.eligibilityCache[styleNumber] = false;
                return false;
            }

            // Calculate average price across all sizes
            const firstItem = data[0];
            const prices = firstItem.basePrices || {};
            const priceValues = Object.values(prices).filter(p => p > 0);
            
            if (priceValues.length === 0) {
                this.eligibilityCache[styleNumber] = false;
                return false;
            }

            const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
            const isEligible = avgPrice < 10;
            
            this.eligibilityCache[styleNumber] = isEligible;
            console.log(`Style ${styleNumber}: Avg price $${avgPrice.toFixed(2)}, Eligible: ${isEligible}`);
            
            return isEligible;
            
        } catch (error) {
            console.error('Error checking eligibility:', error);
            this.eligibilityCache[styleNumber] = false;
            return false;
        }
    }

    /**
     * Add a product to the sample cart
     */
    addSample(product) {
        // Check if cart is full
        if (this.samples.length >= this.maxSamples) {
            this.showNotification(`Maximum ${this.maxSamples} samples per request`, 'warning');
            return false;
        }

        // Check for duplicates
        if (this.samples.find(s => s.style === product.style)) {
            this.showNotification('This item is already in your sample cart', 'info');
            return false;
        }

        // Add to cart
        this.samples.push({
            style: product.style,
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl || '',
            selectedColor: product.selectedColor || '',
            addedAt: new Date().toISOString()
        });

        this.save();
        this.updateUI();
        this.showNotification(`${product.name} added to samples`, 'success');
        
        // Show widget if hidden
        this.showWidget();
        
        return true;
    }

    /**
     * Remove a sample from the cart
     */
    removeSample(styleNumber) {
        const index = this.samples.findIndex(s => s.style === styleNumber);
        if (index !== -1) {
            const removed = this.samples.splice(index, 1)[0];
            this.save();
            this.updateUI();
            this.showNotification(`${removed.name} removed from samples`, 'info');
            
            // Hide widget if empty
            if (this.samples.length === 0) {
                this.hideWidget();
            }
        }
    }

    /**
     * Clear all samples
     */
    clearCart() {
        this.samples = [];
        this.save();
        this.updateUI();
        this.hideWidget();
    }

    /**
     * Save cart to session storage
     */
    save() {
        sessionStorage.setItem('sampleCart', JSON.stringify(this.samples));
    }

    /**
     * Update UI elements
     */
    updateUI() {
        // Update widget badge
        const badge = document.querySelector('.sample-count-badge');
        if (badge) {
            badge.textContent = this.samples.length;
            badge.style.display = this.samples.length > 0 ? 'flex' : 'none';
        }

        // Update status text
        const status = document.querySelector('.sample-cart-status');
        if (status) {
            status.textContent = `${this.samples.length}/${this.maxSamples}`;
        }

        // Update widget visibility
        const widget = document.getElementById('sampleCartWidget');
        if (widget) {
            if (this.samples.length > 0) {
                widget.style.display = 'block';
                // Add animation class
                widget.classList.add('sample-cart-bounce');
                setTimeout(() => widget.classList.remove('sample-cart-bounce'), 600);
            }
        }

        // Update any sample buttons on the page
        this.updateSampleButtons();
    }

    /**
     * Update sample button states
     */
    updateSampleButtons() {
        document.querySelectorAll('.btn-sample').forEach(btn => {
            const style = btn.dataset.style;
            if (style && this.samples.find(s => s.style === style)) {
                btn.innerHTML = '<i class="fas fa-check"></i> In Sample Cart';
                btn.classList.add('in-cart');
                btn.disabled = false; // Keep enabled to allow removal
            }
        });
    }

    /**
     * Show the widget
     */
    showWidget() {
        const widget = document.getElementById('sampleCartWidget');
        if (widget && this.samples.length > 0) {
            widget.style.display = 'block';
            widget.classList.add('sample-cart-show');
        }
    }

    /**
     * Hide the widget
     */
    hideWidget() {
        const widget = document.getElementById('sampleCartWidget');
        if (widget) {
            widget.classList.remove('sample-cart-show');
            setTimeout(() => {
                if (this.samples.length === 0) {
                    widget.style.display = 'none';
                }
            }, 300);
        }
    }

    /**
     * Open the sample request modal
     */
    openSampleModal() {
        // Dispatch event for the main page to handle
        window.dispatchEvent(new CustomEvent('openSampleModal', {
            detail: { samples: this.samples }
        }));
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `sample-toast sample-toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('sample-toast-show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('sample-toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Get cart summary for display
     */
    getCartSummary() {
        return {
            items: this.samples,
            count: this.samples.length,
            remaining: this.maxSamples - this.samples.length,
            isFull: this.samples.length >= this.maxSamples
        };
    }

    /**
     * Check all products on page for eligibility
     */
    async checkAllProductEligibility() {
        const buttons = document.querySelectorAll('.btn-sample[data-style]');
        const checks = [];
        
        buttons.forEach(btn => {
            const style = btn.dataset.style;
            if (style && btn.dataset.eligible === 'pending') {
                checks.push(this.checkAndUpdateButton(btn, style));
            }
        });
        
        await Promise.all(checks);
    }

    /**
     * Check and update a single button
     */
    async checkAndUpdateButton(button, styleNumber) {
        const eligible = await this.checkEligibility(styleNumber);
        button.dataset.eligible = eligible ? 'true' : 'false';
        
        if (eligible) {
            button.style.display = 'inline-flex';
            button.disabled = false;
            
            // Check if already in cart
            if (this.samples.find(s => s.style === styleNumber)) {
                button.innerHTML = '<i class="fas fa-check"></i> In Sample Cart';
                button.classList.add('in-cart');
            } else {
                button.innerHTML = '<i class="fas fa-box-open"></i> Request Sample';
            }
        } else {
            button.style.display = 'none';
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sampleCart = new SampleCart();
    });
} else {
    window.sampleCart = new SampleCart();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleCart;
}