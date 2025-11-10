/**
 * Cap Logo Manager
 * Handles logo definition and pricing for cap embroidery
 * Front logo required, additional positions optional
 */

class CapLogoManager {
    constructor() {
        this.logos = [];
        this.availablePositions = [];
        this.nextLogoId = 1;
        
        // Front logo is always present and required
        this.initializeFrontLogo();
        this.initializeEvents();
        this.loadAvailablePositions();
        
        console.log('[CapLogoManager] Initialized');
    }
    
    /**
     * Initialize the required front logo
     */
    initializeFrontLogo() {
        const frontLogo = {
            id: 'front',
            position: 'Cap Front',
            positionCode: 'CF',
            stitchCount: 8000,
            needsDigitizing: false,
            isRequired: true,
            baseStitchCount: 8000
        };
        
        this.logos.push(frontLogo);
        console.log('[CapLogoManager] Front logo initialized:', frontLogo);
    }
    
    /**
     * Load available positions from API
     */
    async loadAvailablePositions() {
        try {
            console.log('[CapLogoManager] Loading available positions...');
            
            // Get positions from CAP-AL endpoint (additional positions)
            const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=CAP-AL');
            
            if (!response.ok) {
                throw new Error(`API failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.locations && Array.isArray(data.locations)) {
                // Filter out front position (already required)
                this.availablePositions = data.locations.filter(loc => loc.code !== 'CF');
                console.log('[CapLogoManager] Additional positions loaded:', this.availablePositions);
            } else {
                throw new Error('Invalid positions data from API');
            }
            
        } catch (error) {
            console.error('[CapLogoManager] ❌ Failed to load positions:', error);
            
            // NO FALLBACKS - Show visible error
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner('CAP LOGO POSITIONS UNAVAILABLE - Cannot load additional positions');
            }
            
            // Use minimal fallback for development
            this.availablePositions = [
                { code: 'CB', name: 'Cap Back' },
                { code: 'CL', name: 'Left Side' },
                { code: 'CR', name: 'Right Side' }
            ];
        }
    }
    
    /**
     * Initialize event handlers
     */
    initializeEvents() {
        // Front logo events
        const frontStitches = document.getElementById('front-stitches');
        if (frontStitches) {
            frontStitches.addEventListener('input', (e) => this.updateFrontLogo(e.target.value));
        }

        const frontDigitizing = document.getElementById('front-digitizing');
        if (frontDigitizing) {
            frontDigitizing.addEventListener('change', (e) => this.updateFrontDigitizing(e.target.checked));
        }

        // Add additional logo button - INLINE PATTERN (no modal)
        const addBtn = document.getElementById('add-additional-logo-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addAdditionalLogo());
        }

        // Continue button
        const continueBtn = document.getElementById('continue-to-products');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.validateAndContinue());
        }
    }
    
    /**
     * Update front logo stitch count
     */
    updateFrontLogo(stitchCount) {
        const count = parseInt(stitchCount) || 8000;
        
        // Round to nearest 1000, minimum 1000
        const roundedCount = Math.max(1000, Math.round(count / 1000) * 1000);
        
        if (count !== roundedCount) {
            document.getElementById('front-stitches').value = roundedCount;
        }
        
        // Update front logo object
        const frontLogo = this.logos.find(logo => logo.id === 'front');
        if (frontLogo) {
            frontLogo.stitchCount = roundedCount;
            console.log('[CapLogoManager] Front logo updated:', roundedCount, 'stitches');
        }
        
        this.updatePricingPreview();
    }
    
    /**
     * Update front logo digitizing requirement
     */
    updateFrontDigitizing(needsDigitizing) {
        const frontLogo = this.logos.find(logo => logo.id === 'front');
        if (frontLogo) {
            frontLogo.needsDigitizing = needsDigitizing;
            console.log('[CapLogoManager] Front logo digitizing:', needsDigitizing);
        }
        
        this.updatePricingPreview();
    }
    
    /**
     * Add an additional logo position (INLINE PATTERN - no modal)
     */
    addAdditionalLogo() {
        // Check if we have positions available
        const usedPositions = this.logos.map(logo => logo.positionCode);
        const availablePositions = this.availablePositions.filter(pos => !usedPositions.includes(pos.code));

        if (availablePositions.length === 0) {
            alert('All available logo positions are already in use. Please remove a logo to add a new one.');
            return;
        }

        // Create new logo object with first available position
        const positionData = availablePositions[0];
        const additionalLogo = {
            id: `additional-${this.nextLogoId++}`,
            position: positionData.name,
            positionCode: positionData.code,
            stitchCount: 5000, // Default 5k for additional positions
            needsDigitizing: false,
            isRequired: false,
            baseStitchCount: 5000 // Additional logos have 5k base
        };

        this.logos.push(additionalLogo);
        console.log('[CapLogoManager] Additional logo added:', additionalLogo);

        // Re-render the additional logos list
        this.renderAdditionalLogos();
        this.updatePricingPreview();
    }

    /**
     * Edit an additional logo field (inline editing)
     */
    editAdditionalLogo(logoId, field, value) {
        const logo = this.logos.find(l => l.id === logoId);
        if (!logo || logo.isRequired) return;

        if (field === 'stitchCount') {
            // Round to nearest 1000, minimum 1000
            value = Math.max(1000, Math.round(parseInt(value) / 1000) * 1000);
        } else if (field === 'positionCode') {
            // Update both code and name
            const positionData = this.availablePositions.find(pos => pos.code === value);
            if (positionData) {
                logo.position = positionData.name;
                logo.positionCode = positionData.code;
                console.log('[CapLogoManager] Logo position updated:', logo);
                this.renderAdditionalLogos();
                this.updatePricingPreview();
                return;
            }
        }

        logo[field] = value;
        console.log('[CapLogoManager] Logo updated:', field, '=', value);
        this.renderAdditionalLogos();
        this.updatePricingPreview();
    }
    
    /**
     * Remove additional logo
     */
    removeAdditionalLogo(logoId) {
        const index = this.logos.findIndex(logo => logo.id === logoId);
        if (index > -1 && !this.logos[index].isRequired) {
            this.logos.splice(index, 1);
            console.log('[CapLogoManager] Additional logo removed:', logoId);
            
            this.renderAdditionalLogos();
            this.updatePricingPreview();
        }
    }
    
    /**
     * Get available positions for a specific logo (excludes used positions)
     */
    getAvailablePositionsFor(logoId) {
        // Get positions used by OTHER logos
        const usedPositions = this.logos
            .filter(l => l.id !== logoId && l.id !== 'front')
            .map(l => l.positionCode);

        // Return positions not used by other logos
        return this.availablePositions.filter(pos => !usedPositions.includes(pos.code));
    }

    /**
     * Render additional logos list (INLINE CARD PATTERN)
     */
    renderAdditionalLogos() {
        const container = document.getElementById('additional-logos-list');
        if (!container) return;

        const additionalLogos = this.logos.filter(logo => !logo.isRequired);

        if (additionalLogos.length === 0) {
            container.innerHTML = '<p class="empty-message">No additional logos added yet</p>';
            return;
        }

        // Render each logo as an inline editable card
        container.innerHTML = additionalLogos.map(logo => this.renderAdditionalLogoCard(logo)).join('');

        // Bind event listeners for each card
        additionalLogos.forEach(logo => {
            // Position select
            const posSelect = container.querySelector(`#additional-position-${logo.id}`);
            if (posSelect) {
                posSelect.addEventListener('change', (e) => {
                    this.editAdditionalLogo(logo.id, 'positionCode', e.target.value);
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
                        this.removeAdditionalLogo(logo.id);
                    }
                });
            }
        });
    }

    /**
     * Render a single additional logo card (inline editable)
     */
    renderAdditionalLogoCard(logo) {
        const extraStitches = Math.max(0, logo.stitchCount - logo.baseStitchCount);
        const extraCost = extraStitches > 0 ? ` (+$${(extraStitches / 1000 * 1.25).toFixed(2)}/pc)` : '';
        const availablePositions = this.getAvailablePositionsFor(logo.id);

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
                                ${availablePositions.map(pos => `
                                    <option value="${pos.code}" ${logo.positionCode === pos.code ? 'selected' : ''}>
                                        ${pos.name}
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
                                   min="1000"
                                   step="1000"
                                   placeholder="5000">
                            <small class="form-text">First 5,000 stitches included${extraCost}</small>
                        </div>

                        <div class="form-group">
                            <label class="toggle-label">
                                <span class="toggle-text">Needs Digitizing ($100)</span>
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
                    ${logo.stitchCount !== 5000 ? `<span class="part-number-tag">AL-${logo.stitchCount}</span>` : '<span class="part-number-tag">AL</span>'}
                </div>
            </div>
        `;
    }
    
    /**
     * Update pricing preview
     */
    updatePricingPreview() {
        // This will be implemented when pricing calculator is ready
        console.log('[CapLogoManager] Pricing preview update triggered');
        
        // Dispatch event for other components
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('capLogosChanged', {
                detail: { logos: this.logos }
            }));
        }
    }
    
    /**
     * Validate logos and continue to products phase
     */
    validateAndContinue() {
        // Check if front logo has valid stitch count
        const frontLogo = this.logos.find(logo => logo.id === 'front');
        if (!frontLogo || frontLogo.stitchCount < 1000) {
            alert('Front logo must have at least 1,000 stitches');
            return false;
        }
        
        console.log('[CapLogoManager] ✅ Logo validation passed');
        console.log('[CapLogoManager] Final logos:', this.logos);
        
        // Dispatch event to continue to products phase
        if (typeof window !== 'undefined' && window.capQuoteBuilder) {
            window.capQuoteBuilder.continueToProductsPhase();
        }
        
        return true;
    }
    
    /**
     * Get current logos data
     */
    getLogos() {
        return [...this.logos];
    }
    
    /**
     * Get total setup fees (digitizing)
     */
    getTotalSetupFees() {
        return this.logos.reduce((total, logo) => {
            return total + (logo.needsDigitizing ? 100 : 0);
        }, 0);
    }
    
    /**
     * Get logos summary for display
     */
    getLogosSummary() {
        return this.logos.map(logo => ({
            position: logo.position,
            stitches: logo.stitchCount,
            digitizing: logo.needsDigitizing,
            cost: logo.needsDigitizing ? 100 : 0
        }));
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CapLogoManager = CapLogoManager;
}