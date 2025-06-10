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
            <div class="customization-section content-section">
                <h2>✨ Customization Options</h2>
                
                <!-- Primary Logo Stitch Count - Cool Version -->
                <div class="option-card glassmorphism">
                    <div class="option-header">
                        <div class="option-title">
                            <span class="stitch-icon-animated">🪡</span>
                            <h3>Front Logo Stitch Count</h3>
                        </div>
                        <div class="price-badge" id="primary-price-badge">
                            ${this.state.primaryStitches <= this.config.includedStitches ? 
                                '<span class="included">✓ Included</span>' : 
                                `<span class="extra-cost">+$${((this.state.primaryStitches - this.config.includedStitches) / 1000).toFixed(2)}</span>`
                            }
                        </div>
                    </div>
                    
                    <div class="stitch-slider-container">
                        <input type="range" 
                               class="stitch-slider" 
                               id="primary-stitch-slider"
                               min="${this.config.minPrimaryStitches}" 
                               max="${this.config.maxPrimaryStitches}" 
                               step="${this.config.stitchIncrement}"
                               value="${this.state.primaryStitches}">
                        <div class="slider-track">
                            <div class="slider-fill" id="primary-slider-fill"></div>
                        </div>
                        <div class="stitch-value-bubble" id="primary-bubble">
                            <span class="bubble-value">${this.state.primaryStitches.toLocaleString()}</span>
                            <span class="bubble-unit">stitches</span>
                        </div>
                    </div>
                    
                    <div class="stitch-milestones">
                        <span class="milestone" data-value="5000">5K</span>
                        <span class="milestone" data-value="8000">8K<br><small>Standard</small></span>
                        <span class="milestone" data-value="10000">10K</span>
                        <span class="milestone" data-value="15000">15K</span>
                        <span class="milestone" data-value="20000">20K</span>
                        <span class="milestone" data-value="25000">25K</span>
                    </div>
                    
                    <div class="stitch-density-visual">
                        <div class="density-bars" id="density-bars">
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                        </div>
                        <span class="density-label" id="density-label">Medium Detail</span>
                    </div>
                </div>
                
                <!-- Additional Logos - Cool Version -->
                <div class="option-card glassmorphism">
                    <div class="option-header">
                        <div class="option-title">
                            <span class="logo-icon">🎨</span>
                            <h3>Additional Logo Locations</h3>
                        </div>
                    </div>
                    
                    <div class="logo-position-selector">
                        <label class="position-checkbox">
                            <input type="checkbox" id="additional-logos-checkbox">
                            <span class="checkbox-custom"></span>
                            <span class="checkbox-label">Add more embroidered logos</span>
                        </label>
                    </div>
                    
                    <div class="additional-logo-details" id="additional-logo-details">
                        <div id="additional-logos-list" class="logos-grid">
                            <!-- Logos will be dynamically added here -->
                        </div>
                        <button class="add-logo-btn-cool" id="add-another-logo">
                            <span class="btn-icon">✨</span>
                            <span class="btn-text">Add Another Logo</span>
                            <span class="btn-pulse"></span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Primary logo stitch slider
        const slider = document.getElementById('primary-stitch-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.updatePrimaryStitchesFromSlider(parseInt(e.target.value));
            });
            
            // Initialize slider position
            this.updateSliderVisuals();
        }
        
        // Additional logos checkbox
        document.getElementById('additional-logos-checkbox').addEventListener('change', (e) => {
            this.toggleAdditionalLogos(e.target.checked);
        });
        
        // Add another logo button
        document.getElementById('add-another-logo').addEventListener('click', () => {
            this.addAdditionalLogo();
        });
    }
    
    updatePrimaryStitchesFromSlider(newValue) {
        this.state.primaryStitches = newValue;
        
        // Update bubble value
        const bubble = document.getElementById('primary-bubble');
        if (bubble) {
            bubble.querySelector('.bubble-value').textContent = newValue.toLocaleString();
        }
        
        // Update price badge with animation
        const badge = document.getElementById('primary-price-badge');
        if (badge) {
            badge.classList.add('updating');
            if (newValue <= this.config.includedStitches) {
                badge.innerHTML = '<span class="included">✓ Included</span>';
            } else {
                const extraCost = ((newValue - this.config.includedStitches) / 1000) * this.config.pricePerThousand;
                badge.innerHTML = `<span class="extra-cost">+$${extraCost.toFixed(2)}</span>`;
            }
            setTimeout(() => badge.classList.remove('updating'), 300);
        }
        
        // Update slider visuals
        this.updateSliderVisuals();
        
        // Update density indicator
        this.updateDensityIndicator(newValue);
        
        // Update calculator
        this.calculator.setPrimaryStitches(newValue);
    }
    
    updateSliderVisuals() {
        const slider = document.getElementById('primary-stitch-slider');
        const fill = document.getElementById('primary-slider-fill');
        const bubble = document.getElementById('primary-bubble');
        
        if (slider && fill && bubble) {
            const percent = (slider.value - slider.min) / (slider.max - slider.min);
            fill.style.width = `${percent * 100}%`;
            bubble.style.left = `${percent * 100}%`;
        }
    }
    
    updateDensityIndicator(stitches) {
        const bars = document.querySelectorAll('#density-bars .bar');
        const label = document.getElementById('density-label');
        
        // Clear all active bars
        bars.forEach(bar => bar.classList.remove('active'));
        
        let activeCount = 1;
        let densityText = 'Light Detail';
        
        if (stitches >= 20000) {
            activeCount = 5;
            densityText = 'Ultra High Detail';
        } else if (stitches >= 15000) {
            activeCount = 4;
            densityText = 'High Detail';
        } else if (stitches >= 10000) {
            activeCount = 3;
            densityText = 'Medium Detail';
        } else if (stitches >= 7000) {
            activeCount = 2;
            densityText = 'Standard Detail';
        }
        
        // Activate bars with animation
        for (let i = 0; i < activeCount && i < bars.length; i++) {
            setTimeout(() => {
                bars[i].classList.add('active');
            }, i * 50);
        }
        
        if (label) {
            label.textContent = densityText;
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
            <div class="additional-logo-card" data-logo-id="${logo.id}">
                <div class="logo-card-header">
                    <h4>🎯 Logo ${index + 1}</h4>
                    <button class="remove-logo-btn" data-logo-id="${logo.id}">
                        <span>×</span>
                    </button>
                </div>
                
                <div class="logo-stitch-controls">
                    <div class="mini-slider-container">
                        <input type="range" 
                               class="mini-stitch-slider" 
                               data-logo-id="${logo.id}"
                               min="${this.config.minAdditionalStitches}" 
                               max="${this.config.maxAdditionalStitches}" 
                               step="${this.config.stitchIncrement}"
                               value="${logo.stitches}">
                        <div class="mini-slider-value">${logo.stitches.toLocaleString()} stitches</div>
                    </div>
                    
                    <div class="logo-price-display">
                        <span class="price-label">Cost:</span>
                        <span class="price-value">+$${(logo.stitches / 1000 * this.config.pricePerThousand).toFixed(2)}</span>
                        <span class="price-unit">per item</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for mini sliders
        container.querySelectorAll('.mini-stitch-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const logoId = parseInt(e.target.dataset.logoId);
                const newValue = parseInt(e.target.value);
                this.updateAdditionalLogoStitchesFromSlider(logoId, newValue);
            });
        });
        
        container.querySelectorAll('.remove-logo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const logoId = parseInt(e.currentTarget.dataset.logoId);
                // Add fade out animation
                const card = e.currentTarget.closest('.additional-logo-card');
                card.classList.add('removing');
                setTimeout(() => {
                    this.removeAdditionalLogo(logoId);
                }, 300);
            });
        });
    }
    
    updateAdditionalLogoStitchesFromSlider(logoId, newValue) {
        const logo = this.state.additionalLogos.find(l => l.id === logoId);
        if (!logo) return;
        
        logo.stitches = newValue;
        this.calculator.updateAdditionalLogo(logoId, newValue);
        
        // Update the display values
        const card = document.querySelector(`[data-logo-id="${logoId}"]`);
        if (card) {
            card.querySelector('.mini-slider-value').textContent = `${newValue.toLocaleString()} stitches`;
            const priceValue = card.querySelector('.price-value');
            if (priceValue) {
                priceValue.classList.add('updating');
                priceValue.textContent = `+$${(newValue / 1000 * this.config.pricePerThousand).toFixed(2)}`;
                setTimeout(() => priceValue.classList.remove('updating'), 300);
            }
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