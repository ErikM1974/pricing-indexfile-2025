/**
 * Embroidery Customization Options
 * Handles primary logo stitch count and additional logos
 * Works with Universal Quick Quote Calculator
 */

class EmbroideryCustomizationOptions {
    constructor(quickQuoteCalculator) {
        this.calculator = quickQuoteCalculator;
        this.config = {
            minPrimaryStitches: 5000,
            maxPrimaryStitches: 25000,
            includedStitches: 8000,
            minAdditionalStitches: 5000,
            maxAdditionalStitches: 20000,
            defaultAdditionalStitches: 8000,
            stitchIncrement: 1000,
            pricePerThousand: 1.00
        };
        
        this.state = {
            primaryStitches: this.config.includedStitches,
            additionalLogosEnabled: false,
            additionalLogos: []
        };
        
        this.initialize();
    }
    
    initialize() {
        console.log('[EmbroideryCustomization] Initializing customization options');
        
        // Wait for DOM if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }
    
    render() {
        const container = document.getElementById('customization-options-container');
        if (!container) {
            console.error('[EmbroideryCustomization] Container not found! Add <div id="customization-options-container"></div> to your page.');
            return;
        }
        
        container.innerHTML = this.generateHTML();
        this.setupEventListeners();
    }
    
    generateHTML() {
        return `
            <div class="customization-section">
                <h2>Customization Options</h2>
                
                <!-- Primary Logo Stitch Count -->
                <div class="option-group">
                    <label>Front Logo Stitch Count</label>
                    <div class="stitch-counter">
                        <button class="stitch-counter-btn" id="primary-decrease">−</button>
                        <span class="stitch-counter-display" id="primary-stitches">${this.state.primaryStitches.toLocaleString()}</span>
                        <button class="stitch-counter-btn" id="primary-increase">+</button>
                        <span class="stitch-counter-range">(5K-25K)</span>
                    </div>
                    <div id="primary-stitch-note" style="margin-top: 5px; font-size: 14px; color: var(--gray-600);">
                        ${this.state.primaryStitches <= this.config.includedStitches ? 
                            'Included in base price' : 
                            `+$${((this.state.primaryStitches - this.config.includedStitches) / 1000).toFixed(2)} per item`
                        }
                    </div>
                </div>
                
                <!-- Additional Logos -->
                <div class="option-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="additional-logos-checkbox">
                        Add additional embroidered logo
                    </label>
                    
                    <div class="additional-logo-details" id="additional-logo-details">
                        <div id="additional-logos-list">
                            <!-- Logos will be dynamically added here -->
                        </div>
                        <button class="add-logo-btn" id="add-another-logo">
                            + Add Another Logo
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Primary logo stitch controls
        document.getElementById('primary-decrease').addEventListener('click', () => {
            this.updatePrimaryStitches(-this.config.stitchIncrement);
        });
        
        document.getElementById('primary-increase').addEventListener('click', () => {
            this.updatePrimaryStitches(this.config.stitchIncrement);
        });
        
        // Additional logos checkbox
        document.getElementById('additional-logos-checkbox').addEventListener('change', (e) => {
            this.toggleAdditionalLogos(e.target.checked);
        });
        
        // Add another logo button
        document.getElementById('add-another-logo').addEventListener('click', () => {
            this.addAdditionalLogo();
        });
    }
    
    updatePrimaryStitches(delta) {
        const newValue = this.state.primaryStitches + delta;
        
        if (newValue >= this.config.minPrimaryStitches && newValue <= this.config.maxPrimaryStitches) {
            this.state.primaryStitches = newValue;
            
            // Update display
            document.getElementById('primary-stitches').textContent = newValue.toLocaleString();
            
            // Update note
            const note = document.getElementById('primary-stitch-note');
            if (newValue <= this.config.includedStitches) {
                note.textContent = 'Included in base price';
            } else {
                const extraCost = ((newValue - this.config.includedStitches) / 1000) * this.config.pricePerThousand;
                note.textContent = `+$${extraCost.toFixed(2)} per item`;
            }
            
            // Update calculator
            this.calculator.setPrimaryStitches(newValue);
        }
    }
    
    toggleAdditionalLogos(enabled) {
        this.state.additionalLogosEnabled = enabled;
        const details = document.getElementById('additional-logo-details');
        
        if (enabled) {
            details.classList.add('active');
            // Add first logo if none exist
            if (this.state.additionalLogos.length === 0) {
                this.addAdditionalLogo();
            }
        } else {
            details.classList.remove('active');
            // Clear all logos
            this.state.additionalLogos.forEach(logo => {
                this.calculator.removeAdditionalLogo(logo.id);
            });
            this.state.additionalLogos = [];
            this.renderAdditionalLogos();
        }
    }
    
    addAdditionalLogo() {
        const logoId = this.calculator.addAdditionalLogo(this.config.defaultAdditionalStitches);
        
        this.state.additionalLogos.push({
            id: logoId,
            stitches: this.config.defaultAdditionalStitches
        });
        
        this.renderAdditionalLogos();
    }
    
    renderAdditionalLogos() {
        const container = document.getElementById('additional-logos-list');
        
        container.innerHTML = this.state.additionalLogos.map((logo, index) => `
            <div class="additional-logo-item" data-logo-id="${logo.id}">
                <div>
                    <strong>Additional Logo ${index + 1}:</strong>
                    <div style="font-size: 14px; color: var(--gray-600); margin-top: 5px;">
                        Additional Cost: $${(logo.stitches / 1000 * this.config.pricePerThousand).toFixed(2)} per item
                    </div>
                </div>
                <div class="additional-logo-controls">
                    <div class="stitch-counter">
                        <button class="stitch-counter-btn logo-decrease" data-logo-id="${logo.id}">−</button>
                        <span class="stitch-counter-display">${logo.stitches.toLocaleString()}</span>
                        <button class="stitch-counter-btn logo-increase" data-logo-id="${logo.id}">+</button>
                        <span class="stitch-counter-range">(5K-20K)</span>
                    </div>
                    <button class="remove-logo-btn" data-logo-id="${logo.id}">✕</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for logo controls
        container.querySelectorAll('.logo-decrease').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const logoId = parseInt(e.target.dataset.logoId);
                this.updateAdditionalLogoStitches(logoId, -this.config.stitchIncrement);
            });
        });
        
        container.querySelectorAll('.logo-increase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const logoId = parseInt(e.target.dataset.logoId);
                this.updateAdditionalLogoStitches(logoId, this.config.stitchIncrement);
            });
        });
        
        container.querySelectorAll('.remove-logo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const logoId = parseInt(e.target.dataset.logoId);
                this.removeAdditionalLogo(logoId);
            });
        });
    }
    
    updateAdditionalLogoStitches(logoId, delta) {
        const logo = this.state.additionalLogos.find(l => l.id === logoId);
        if (!logo) return;
        
        const newValue = logo.stitches + delta;
        
        if (newValue >= this.config.minAdditionalStitches && newValue <= this.config.maxAdditionalStitches) {
            logo.stitches = newValue;
            this.calculator.updateAdditionalLogo(logoId, newValue);
            this.renderAdditionalLogos();
        }
    }
    
    removeAdditionalLogo(logoId) {
        this.state.additionalLogos = this.state.additionalLogos.filter(l => l.id !== logoId);
        this.calculator.removeAdditionalLogo(logoId);
        this.renderAdditionalLogos();
        
        // If no logos left, uncheck the checkbox
        if (this.state.additionalLogos.length === 0) {
            document.getElementById('additional-logos-checkbox').checked = false;
            this.toggleAdditionalLogos(false);
        }
    }
}

// Export for use
window.EmbroideryCustomizationOptions = EmbroideryCustomizationOptions;