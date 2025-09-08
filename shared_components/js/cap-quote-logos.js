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
        
        // Add additional logo button
        const addBtn = document.getElementById('add-additional-logo-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddLogoModal());
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
     * Show modal to add additional logo position
     */
    showAddLogoModal() {
        // Check if we have positions available
        const usedPositions = this.logos.map(logo => logo.positionCode);
        const availablePositions = this.availablePositions.filter(pos => !usedPositions.includes(pos.code));
        
        if (availablePositions.length === 0) {
            alert('All available logo positions are already in use.');
            return;
        }
        
        // Create modal HTML
        const modalHTML = `
            <div id="add-logo-modal" class="modal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add Additional Logo Position</h3>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="add-logo-position">Position</label>
                            <select id="add-logo-position" class="form-select">
                                ${availablePositions.map(pos => 
                                    `<option value="${pos.code}">${pos.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="add-logo-stitches">Stitch Count</label>
                            <input type="number" id="add-logo-stitches" class="form-control" 
                                   value="5000" min="1000" step="1000">
                            <small class="form-text">First 5,000 stitches included for additional positions</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="add-logo-digitizing">
                                <span class="checkmark"></span>
                                Needs Digitizing ($100)
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.modal').style.display='none'" class="btn-secondary">Cancel</button>
                        <button onclick="window.capQuoteBuilder.logoManager.addAdditionalLogo()" class="btn-primary">Add Logo</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('add-logo-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    /**
     * Add additional logo from modal
     */
    addAdditionalLogo() {
        const positionCode = document.getElementById('add-logo-position').value;
        const stitchCount = parseInt(document.getElementById('add-logo-stitches').value) || 5000;
        const needsDigitizing = document.getElementById('add-logo-digitizing').checked;
        
        // Find position details
        const positionData = this.availablePositions.find(pos => pos.code === positionCode);
        if (!positionData) {
            alert('Invalid position selected');
            return;
        }
        
        // Round stitch count to nearest 1000
        const roundedCount = Math.max(1000, Math.round(stitchCount / 1000) * 1000);
        
        // Create additional logo object
        const additionalLogo = {
            id: `additional-${this.nextLogoId++}`,
            position: positionData.name,
            positionCode: positionCode,
            stitchCount: roundedCount,
            needsDigitizing: needsDigitizing,
            isRequired: false,
            baseStitchCount: 5000 // Additional logos have 5k base
        };
        
        this.logos.push(additionalLogo);
        console.log('[CapLogoManager] Additional logo added:', additionalLogo);
        
        // Update UI
        this.renderAdditionalLogos();
        this.updatePricingPreview();
        
        // Close modal
        document.getElementById('add-logo-modal').style.display = 'none';
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
     * Render additional logos list
     */
    renderAdditionalLogos() {
        const container = document.getElementById('additional-logos-list');
        if (!container) return;
        
        const additionalLogos = this.logos.filter(logo => !logo.isRequired);
        
        if (additionalLogos.length === 0) {
            container.innerHTML = '<p class="empty-message">No additional logos added</p>';
            return;
        }
        
        container.innerHTML = additionalLogos.map(logo => `
            <div class="additional-logo-item" data-logo-id="${logo.id}">
                <div class="logo-info">
                    <h4>${logo.position}</h4>
                    <p>${logo.stitchCount.toLocaleString()} stitches ${logo.needsDigitizing ? '• Digitizing: $100' : ''}</p>
                </div>
                <div class="logo-actions">
                    <button class="btn-sm btn-secondary" onclick="window.capLogoManager.editAdditionalLogo('${logo.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm btn-danger" onclick="window.capLogoManager.removeAdditionalLogo('${logo.id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Edit additional logo
     */
    editAdditionalLogo(logoId) {
        const logo = this.logos.find(l => l.id === logoId);
        if (!logo) return;
        
        // Show edit modal (similar to add modal but with current values)
        const usedPositions = this.logos.filter(l => l.id !== logoId).map(l => l.positionCode);
        const availablePositions = this.availablePositions.filter(pos => !usedPositions.includes(pos.code));
        
        // Add current position to available list
        const currentPosition = this.availablePositions.find(pos => pos.code === logo.positionCode);
        if (currentPosition) {
            availablePositions.unshift(currentPosition);
        }
        
        const modalHTML = `
            <div id="edit-logo-modal" class="modal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Logo Position</h3>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="edit-logo-position">Position</label>
                            <select id="edit-logo-position" class="form-select">
                                ${availablePositions.map(pos => 
                                    `<option value="${pos.code}" ${pos.code === logo.positionCode ? 'selected' : ''}>${pos.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-logo-stitches">Stitch Count</label>
                            <input type="number" id="edit-logo-stitches" class="form-control" 
                                   value="${logo.stitchCount}" min="1000" step="1000">
                            <small class="form-text">First 5,000 stitches included for additional positions</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="edit-logo-digitizing" ${logo.needsDigitizing ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                Needs Digitizing ($100)
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="this.closest('.modal').style.display='none'" class="btn-secondary">Cancel</button>
                        <button onclick="window.capLogoManager.updateAdditionalLogo('${logoId}')" class="btn-primary">Update Logo</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('edit-logo-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    /**
     * Update additional logo from edit modal
     */
    updateAdditionalLogo(logoId) {
        const logo = this.logos.find(l => l.id === logoId);
        if (!logo) return;
        
        const positionCode = document.getElementById('edit-logo-position').value;
        const stitchCount = parseInt(document.getElementById('edit-logo-stitches').value) || 5000;
        const needsDigitizing = document.getElementById('edit-logo-digitizing').checked;
        
        // Find position details
        const positionData = this.availablePositions.find(pos => pos.code === positionCode);
        if (!positionData) {
            alert('Invalid position selected');
            return;
        }
        
        // Round stitch count
        const roundedCount = Math.max(1000, Math.round(stitchCount / 1000) * 1000);
        
        // Update logo
        logo.position = positionData.name;
        logo.positionCode = positionCode;
        logo.stitchCount = roundedCount;
        logo.needsDigitizing = needsDigitizing;
        
        console.log('[CapLogoManager] Additional logo updated:', logo);
        
        // Update UI
        this.renderAdditionalLogos();
        this.updatePricingPreview();
        
        // Close modal
        document.getElementById('edit-logo-modal').style.display = 'none';
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