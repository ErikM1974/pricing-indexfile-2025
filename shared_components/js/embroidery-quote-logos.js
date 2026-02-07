/**
 * Embroidery Logo Manager
 * Handles logo definition, editing, and calculations
 */

class LogoManager {
    constructor() {
        this.additionalLogos = [];
        this.nextId = 1;
        this.baseURL = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

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

        // Primary logo state
        this.primaryLogo = {
            position: '',
            stitchCount: 8000,
            needsDigitizing: false
        };

        // Note: Do NOT fetch configuration in constructor!
        // Call init() method after DOM is ready instead.
    }

    /**
     * Initialize the logo manager (call after DOM ready)
     * @returns {Promise<LogoManager>} Returns this for chaining
     */
    async init() {
        await this.fetchConfiguration();
        return this;
    }
    
    /**
     * Fetch configuration from API including logo positions
     */
    async fetchConfiguration() {
        try {
            // Fetch embroidery configuration
            const response = await fetch(`${this.baseURL}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
            const data = await response.json();
            
            if (data && data.allEmbroideryCostsR && data.allEmbroideryCostsR.length > 0) {
                // Use first shirt record for configuration
                const shirtConfig = data.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || data.allEmbroideryCostsR[0];
                
                // Parse logo positions from API (shirts only, no caps)
                if (shirtConfig.LogoPositions) {
                    this.positions = shirtConfig.LogoPositions.split(',').map(p => p.trim());
                }
                
                // Apply other configuration values
                this.digitizingFee = shirtConfig.DigitizingFee || 100;
                this.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                this.baseStitchCount = shirtConfig.BaseStitchCount || shirtConfig.StitchCount || 8000;
                this.minStitchCount = this.stitchIncrement; // Minimum is 1000
                this.stitchIncrement = shirtConfig.StitchIncrement || 1000;
                
                // Initialize UI after config loaded
                this.initializePrimaryLogo();
                this.initializeEvents();
            }
        } catch (error) {
            console.error('[LogoManager] Error fetching configuration:', error);
            // Show warning about configuration failure
            this.showConfigWarning(
                'Logo configuration could not be loaded from server. ' +
                'Setup fees and positions may be incorrect.'
            );

            // Initialize UI even on error
            this.initializePrimaryLogo();
            this.initializeEvents();
        }
    }

    /**
     * Initialize primary logo dropdown and event listeners
     */
    initializePrimaryLogo() {
        const positionSelect = document.getElementById('primary-position');
        if (!positionSelect) {
            console.error('❌ [LogoManager] #primary-position not found! DOM may not be ready.');
            return;
        }

        // Populate dropdown with positions from API
        positionSelect.innerHTML = '<option value="">Select position...</option>' +
            this.positions.map(pos => `<option value="${pos}">${pos}</option>`).join('');

        // Add event listeners for primary logo inputs
        positionSelect.addEventListener('change', (e) => {
            this.primaryLogo.position = e.target.value;
            this.updateContinueButton();
        });

        const stitchesInput = document.getElementById('primary-stitches');
        if (stitchesInput) {
            stitchesInput.addEventListener('change', (e) => {
                let value = Math.max(this.minStitchCount, parseInt(e.target.value) || this.baseStitchCount);
                value = Math.round(value / this.stitchIncrement) * this.stitchIncrement;
                this.primaryLogo.stitchCount = value;
                stitchesInput.value = value;
            });
        }

        const digitizingToggle = document.getElementById('primary-digitizing');
        if (digitizingToggle) {
            digitizingToggle.addEventListener('change', (e) => {
                this.primaryLogo.needsDigitizing = e.target.checked;
            });
        }
    }
    
    /**
     * Get available positions for additional logos (excludes primary and used positions)
     */
    getAvailablePositions(currentLogoId) {
        // Start with all positions
        let usedPositions = [this.primaryLogo.position]; // Primary position is always used

        // Add positions from OTHER additional logos
        const otherLogos = this.additionalLogos.filter(logo => logo.id !== currentLogoId);
        usedPositions.push(...otherLogos.map(logo => logo.position));

        // Get current logo's position so it stays in dropdown
        const currentLogo = this.additionalLogos.find(l => l.id === currentLogoId);
        const currentPosition = currentLogo ? currentLogo.position : null;

        return this.positions.filter(pos =>
            !usedPositions.includes(pos) || pos === currentPosition
        );
    }

    initializeEvents() {
        // Add additional logo button
        const addBtn = document.getElementById('add-additional-logo-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addAdditionalLogo());
        }
    }
    
    /**
     * Add an additional logo position
     */
    addAdditionalLogo() {
        // Get available positions (excludes primary and used additional positions)
        const availablePositions = this.getAvailablePositions(null);

        // If no positions available, alert user
        if (availablePositions.length === 0) {
            alert('All logo positions have been used. Please remove a logo to add a new one.');
            return;
        }

        const logo = {
            id: this.nextId++,
            position: availablePositions[0], // Use first available position
            stitchCount: 8000,
            needsDigitizing: false,
            shopWorksCode: null  // Will be set based on stitch count
        };

        this.additionalLogos.push(logo);
        this.renderAdditionalLogos();
    }
    
    /**
     * Edit an additional logo
     */
    editAdditionalLogo(logoId, field, value) {
        const logo = this.additionalLogos.find(l => l.id === logoId);
        if (logo) {
            if (field === 'stitchCount') {
                value = Math.max(this.minStitchCount, parseInt(value) || this.baseStitchCount);
                // Round to nearest increment
                value = Math.round(value / this.stitchIncrement) * this.stitchIncrement;
            }
            logo[field] = value;
            this.renderAdditionalLogos();
        }
    }

    /**
     * Delete an additional logo
     */
    deleteAdditionalLogo(logoId) {
        this.additionalLogos = this.additionalLogos.filter(l => l.id !== logoId);
        this.renderAdditionalLogos();
    }
    
    /**
     * Render additional logos in the container
     */
    renderAdditionalLogos() {
        const container = document.getElementById('additional-logos-list');
        if (!container) return;

        if (this.additionalLogos.length === 0) {
            container.innerHTML = `
                <div class="empty-additional-logos">
                    <i class="fas fa-info-circle"></i>
                    <p>No additional logos added yet. Click "Add Additional Position" to add more.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.additionalLogos.map(logo => this.renderAdditionalLogo(logo)).join('');

        // Bind events for each additional logo
        this.additionalLogos.forEach(logo => {
            // Position select
            const posSelect = container.querySelector(`#additional-position-${logo.id}`);
            if (posSelect) {
                posSelect.addEventListener('change', (e) => {
                    this.editAdditionalLogo(logo.id, 'position', e.target.value);
                });
            }

            // Stitch count input
            const stitchInput = container.querySelector(`#additional-stitches-${logo.id}`);
            if (stitchInput) {
                stitchInput.addEventListener('change', (e) => {
                    this.editAdditionalLogo(logo.id, 'stitchCount', e.target.value);
                });
            }

            // Digitizing toggle
            const digitizingCheck = container.querySelector(`#additional-digitizing-${logo.id}`);
            if (digitizingCheck) {
                digitizingCheck.addEventListener('change', (e) => {
                    this.editAdditionalLogo(logo.id, 'needsDigitizing', e.target.checked);
                });
            }

            // Delete button
            const deleteBtn = container.querySelector(`#delete-additional-${logo.id}`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (confirm('Remove this additional logo?')) {
                        this.deleteAdditionalLogo(logo.id);
                    }
                });
            }
        });
    }
    
    /**
     * Render a single additional logo card
     */
    renderAdditionalLogo(logo) {
        const extraStitches = Math.max(0, logo.stitchCount - this.baseStitchCount);
        const extraCost = extraStitches > 0 ? ` (+$${(extraStitches / 1000 * this.additionalStitchRate).toFixed(2)}/pc)` : '';

        return `
            <div class="additional-logo-card" data-logo-id="${logo.id}">
                <div class="additional-logo-header">
                    <h4>Additional Logo</h4>
                    <button class="btn-delete" id="delete-additional-${logo.id}" title="Delete Logo">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>

                <div class="logo-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="additional-position-${logo.id}">Position</label>
                            <select id="additional-position-${logo.id}" class="form-select">
                                ${this.getAvailablePositions(logo.id).map(pos => `
                                    <option value="${pos}" ${logo.position === pos ? 'selected' : ''}>
                                        ${pos}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="additional-stitches-${logo.id}">Stitch Count</label>
                            <input type="number"
                                   id="additional-stitches-${logo.id}"
                                   class="form-control"
                                   value="${logo.stitchCount}"
                                   min="${this.minStitchCount}"
                                   step="${this.stitchIncrement}"
                                   placeholder="${this.baseStitchCount}">
                            <small class="form-text">Min: ${this.minStitchCount.toLocaleString()} | Increment: ${this.stitchIncrement.toLocaleString()}${extraCost}</small>
                        </div>

                        <div class="form-group">
                            <label class="toggle-label">
                                <span class="toggle-text">Needs Digitizing ($${this.digitizingFee})</span>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="additional-digitizing-${logo.id}" class="toggle-input" ${logo.needsDigitizing ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="logo-summary">
                    <span class="position-tag">${logo.position}</span>
                    <span class="stitch-tag">${logo.stitchCount.toLocaleString()} stitches</span>
                    ${logo.needsDigitizing ? '<span class="digitizing-tag">+Digitizing</span>' : ''}
                    ${logo.stitchCount !== 8000 ? `<span class="part-number-tag">AL-${logo.stitchCount}</span>` : '<span class="part-number-tag">AL</span>'}
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
            // Enable button only if primary logo position is selected
            continueBtn.disabled = !this.primaryLogo.position;
        }
    }
    
    /**
     * Calculate total setup fees (primary + additional logos)
     */
    getTotalSetupFees() {
        let fees = 0;
        if (this.primaryLogo.needsDigitizing) fees += this.digitizingFee;
        fees += this.additionalLogos.filter(l => l.needsDigitizing).length * this.digitizingFee;
        return fees;
    }

    /**
     * Calculate additional stitch cost per piece (primary + additional logos)
     */
    getAdditionalStitchCost() {
        let totalExtraStitches = 0;

        // Primary logo extra stitches
        const primaryExtra = Math.max(0, this.primaryLogo.stitchCount - this.baseStitchCount);
        totalExtraStitches += primaryExtra;

        // Additional logos extra stitches
        this.additionalLogos.forEach(logo => {
            const extra = Math.max(0, logo.stitchCount - this.baseStitchCount);
            totalExtraStitches += extra;
        });

        return (totalExtraStitches / 1000) * this.additionalStitchRate;
    }

    /**
     * Get logos summary for display (primary + additional)
     */
    getLogosSummary() {
        const summary = [];

        // Add primary logo
        if (this.primaryLogo.position) {
            summary.push({
                position: this.primaryLogo.position,
                stitchCount: this.primaryLogo.stitchCount,
                needsDigitizing: this.primaryLogo.needsDigitizing,
                extraStitchCost: Math.max(0, this.primaryLogo.stitchCount - this.baseStitchCount) / 1000 * this.additionalStitchRate,
                isPrimary: true
            });
        }

        // Add additional logos
        this.additionalLogos.forEach(logo => {
            summary.push({
                position: logo.position,
                stitchCount: logo.stitchCount,
                needsDigitizing: logo.needsDigitizing,
                extraStitchCost: Math.max(0, logo.stitchCount - this.baseStitchCount) / 1000 * this.additionalStitchRate,
                isPrimary: false
            });
        });

        return summary;
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
     * Export logos data for quote (primary + additional)
     */
    exportLogos() {
        const allLogos = [];

        // Add primary logo first
        if (this.primaryLogo.position) {
            allLogos.push({
                id: 0, // Primary always has id 0
                position: this.primaryLogo.position,
                stitchCount: this.primaryLogo.stitchCount,
                needsDigitizing: this.primaryLogo.needsDigitizing,
                isPrimary: true,
                shopWorksCode: null // Primary doesn't have AL code
            });
        }

        // Add additional logos
        this.additionalLogos.forEach(logo => {
            allLogos.push({
                id: logo.id,
                position: logo.position,
                stitchCount: logo.stitchCount,
                needsDigitizing: logo.needsDigitizing,
                isPrimary: false,
                shopWorksCode: logo.stitchCount !== 8000 ? `AL-${logo.stitchCount}` : 'AL'
            });
        });

        return {
            logos: allLogos,
            setupFees: this.getTotalSetupFees(),
            additionalStitchCostPerPiece: this.getAdditionalStitchCost()
        };
    }
}

// Make available globally
window.LogoManager = LogoManager;