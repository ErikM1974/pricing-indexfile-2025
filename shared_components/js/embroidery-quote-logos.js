/**
 * Embroidery Logo Manager
 * Handles logo definition, editing, and calculations
 */

class LogoManager {
    constructor() {
        this.logos = [];
        this.nextId = 1;
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Default fallback positions (shirts only - no caps)
        this.positions = [
            'Left Chest',
            'Right Chest',
            'Full Front',
            'Full Back',
            'Left Sleeve',
            'Right Sleeve'
        ];
        
        // Configuration from API
        this.digitizingFee = 100;
        this.additionalStitchRate = 1.25;
        this.baseStitchCount = 8000;
        this.minStitchCount = 1000;
        this.stitchIncrement = 1000;
        
        // Fetch configuration from API
        this.fetchConfiguration();
        this.initializeEvents();
    }
    
    /**
     * Fetch configuration from API including logo positions
     */
    async fetchConfiguration() {
        try {
            console.log('[LogoManager] Fetching configuration from API...');
            
            // Fetch embroidery configuration
            const response = await fetch(`${this.baseURL}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
            const data = await response.json();
            
            if (data && data.allEmbroideryCostsR && data.allEmbroideryCostsR.length > 0) {
                // Use first shirt record for configuration
                const shirtConfig = data.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || data.allEmbroideryCostsR[0];
                
                // Parse logo positions from API (shirts only, no caps)
                if (shirtConfig.LogoPositions) {
                    this.positions = shirtConfig.LogoPositions.split(',').map(p => p.trim());
                    console.log('[LogoManager] Logo positions from API:', this.positions);
                }
                
                // Apply other configuration values
                this.digitizingFee = shirtConfig.DigitizingFee || 100;
                this.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                this.baseStitchCount = shirtConfig.BaseStitchCount || shirtConfig.StitchCount || 8000;
                this.minStitchCount = this.stitchIncrement; // Minimum is 1000
                this.stitchIncrement = shirtConfig.StitchIncrement || 1000;
                
                console.log('[LogoManager] Configuration loaded:');
                console.log('- Positions:', this.positions.length, 'options');
                console.log('- Digitizing Fee:', this.digitizingFee);
                console.log('- Min Stitch Count:', this.minStitchCount);
            }
        } catch (error) {
            console.error('[LogoManager] Error fetching configuration:', error);
            console.log('[LogoManager] Using fallback positions - CONFIGURATION MAY BE INCORRECT!');
            
            // Show warning about configuration failure
            this.showConfigWarning(
                'Logo configuration could not be loaded from server. ' +
                'Setup fees and positions may be incorrect.'
            );
        }
    }
    
    initializeEvents() {
        // Add logo button
        const addBtn = document.getElementById('add-logo-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addLogo());
        }
    }
    
    /**
     * Add a new logo
     */
    addLogo() {
        const logo = {
            id: this.nextId++,
            position: 'Left Chest',
            stitchCount: 8000,
            needsDigitizing: false
        };
        
        this.logos.push(logo);
        this.renderLogos();
        this.updateContinueButton();
    }
    
    /**
     * Edit an existing logo
     */
    editLogo(logoId, field, value) {
        const logo = this.logos.find(l => l.id === logoId);
        if (logo) {
            if (field === 'stitchCount') {
                value = Math.max(this.minStitchCount, parseInt(value) || this.baseStitchCount);
                // Round to nearest increment
                value = Math.round(value / this.stitchIncrement) * this.stitchIncrement;
            }
            logo[field] = value;
            this.renderLogos();
        }
    }
    
    /**
     * Delete a logo
     */
    deleteLogo(logoId) {
        this.logos = this.logos.filter(l => l.id !== logoId);
        this.renderLogos();
        this.updateContinueButton();
    }
    
    /**
     * Render all logos in the container
     */
    renderLogos() {
        const container = document.getElementById('logos-container');
        if (!container) return;
        
        if (this.logos.length === 0) {
            container.innerHTML = `
                <div class="empty-logos">
                    <i class="fas fa-info-circle"></i>
                    <p>No logos added yet. Click "Add Logo" to start.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.logos.map(logo => this.renderLogo(logo)).join('');
        
        // Bind events for each logo
        this.logos.forEach(logo => {
            // Position select
            const posSelect = container.querySelector(`#logo-position-${logo.id}`);
            if (posSelect) {
                posSelect.addEventListener('change', (e) => {
                    this.editLogo(logo.id, 'position', e.target.value);
                });
            }
            
            // Stitch count input
            const stitchInput = container.querySelector(`#logo-stitches-${logo.id}`);
            if (stitchInput) {
                stitchInput.addEventListener('change', (e) => {
                    this.editLogo(logo.id, 'stitchCount', e.target.value);
                });
            }
            
            // Digitizing checkbox
            const digitizingCheck = container.querySelector(`#logo-digitizing-${logo.id}`);
            if (digitizingCheck) {
                digitizingCheck.addEventListener('change', (e) => {
                    this.editLogo(logo.id, 'needsDigitizing', e.target.checked);
                });
            }
            
            // Delete button
            const deleteBtn = container.querySelector(`#delete-logo-${logo.id}`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (confirm('Remove this logo?')) {
                        this.deleteLogo(logo.id);
                    }
                });
            }
        });
    }
    
    /**
     * Render a single logo card
     */
    renderLogo(logo) {
        const extraStitches = Math.max(0, logo.stitchCount - this.baseStitchCount);
        const extraCost = extraStitches > 0 ? ` (+$${(extraStitches / 1000 * this.additionalStitchRate).toFixed(2)}/pc)` : '';
        
        return `
            <div class="logo-card" data-logo-id="${logo.id}">
                <div class="logo-header">
                    <h3>Logo ${logo.id}</h3>
                    <button class="btn-delete" id="delete-logo-${logo.id}" title="Delete Logo">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="logo-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="logo-position-${logo.id}">Position</label>
                            <select id="logo-position-${logo.id}" class="logo-position">
                                ${this.positions.map(pos => `
                                    <option value="${pos}" ${logo.position === pos ? 'selected' : ''}>
                                        ${pos}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="logo-stitches-${logo.id}">Stitch Count</label>
                            <input type="number" 
                                   id="logo-stitches-${logo.id}" 
                                   class="logo-stitches"
                                   value="${logo.stitchCount}"
                                   min="${this.minStitchCount}"
                                   step="${this.stitchIncrement}"
                                   placeholder="${this.baseStitchCount}">
                            <small class="help-text">Min: ${this.minStitchCount.toLocaleString()} | Increment: ${this.stitchIncrement.toLocaleString()}${extraCost}</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" 
                                   id="logo-digitizing-${logo.id}"
                                   ${logo.needsDigitizing ? 'checked' : ''}>
                            <span>Needs digitizing ($${this.digitizingFee} setup fee)</span>
                        </label>
                    </div>
                </div>
                
                <div class="logo-summary">
                    <span class="position-tag">${logo.position}</span>
                    <span class="stitch-tag">${logo.stitchCount.toLocaleString()} stitches</span>
                    ${logo.needsDigitizing ? '<span class="digitizing-tag">+Digitizing</span>' : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Update continue button state
     */
    updateContinueButton() {
        const continueBtn = document.getElementById('continue-to-products');
        if (continueBtn) {
            continueBtn.disabled = this.logos.length === 0;
        }
    }
    
    /**
     * Calculate total setup fees
     */
    getTotalSetupFees() {
        return this.logos.filter(l => l.needsDigitizing).length * this.digitizingFee;
    }
    
    /**
     * Calculate additional stitch cost per piece
     */
    getAdditionalStitchCost() {
        let totalExtraStitches = 0;
        this.logos.forEach(logo => {
            const extra = Math.max(0, logo.stitchCount - this.baseStitchCount);
            totalExtraStitches += extra;
        });
        return (totalExtraStitches / 1000) * this.additionalStitchRate;
    }
    
    /**
     * Get logos summary for display
     */
    getLogosSummary() {
        return this.logos.map(logo => ({
            position: logo.position,
            stitchCount: logo.stitchCount,
            needsDigitizing: logo.needsDigitizing,
            extraStitchCost: Math.max(0, logo.stitchCount - this.baseStitchCount) / 1000 * this.additionalStitchRate
        }));
    }
    
    /**
     * Show configuration warning
     */
    showConfigWarning(message) {
        // Check if pricing calculator already showed main warning
        if (document.getElementById('pricing-api-warning')) {
            // Main warning already shown, just log this one
            console.warn('[LogoManager]', message);
            return;
        }
        
        // Create warning element for logo section
        const logoSection = document.getElementById('logo-setup-section');
        if (logoSection) {
            const warning = document.createElement('div');
            warning.className = 'config-warning';
            warning.style.cssText = `
                background: #fef2f2;
                border: 2px solid #dc2626;
                color: #991b1b;
                padding: 12px;
                margin-bottom: 15px;
                border-radius: 6px;
                font-weight: bold;
            `;
            warning.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                ${message}
                <br><small>Contact IT support before proceeding.</small>
            `;
            
            // Insert at top of logo section
            logoSection.insertBefore(warning, logoSection.firstChild);
        }
    }
    
    /**
     * Export logos data for quote
     */
    exportLogos() {
        return {
            logos: this.logos,
            setupFees: this.getTotalSetupFees(),
            additionalStitchCostPerPiece: this.getAdditionalStitchCost()
        };
    }
}

// Make available globally
window.LogoManager = LogoManager;