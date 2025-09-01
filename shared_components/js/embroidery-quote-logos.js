/**
 * Embroidery Logo Manager
 * Handles logo definition, editing, and calculations
 */

class LogoManager {
    constructor() {
        this.logos = [];
        this.nextId = 1;
        this.positions = [
            'Left Chest',
            'Right Chest',
            'Full Front',
            'Full Back',
            'Left Sleeve',
            'Right Sleeve',
            'Hat Front',
            'Hat Back',
            'Hat Side'
        ];
        
        this.initializeEvents();
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
                value = Math.max(1000, parseInt(value) || 8000);
                // Round to nearest 1000
                value = Math.round(value / 1000) * 1000;
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
        const extraStitches = Math.max(0, logo.stitchCount - 8000);
        const extraCost = extraStitches > 0 ? ` (+$${(extraStitches / 1000 * 1.25).toFixed(2)}/pc)` : '';
        
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
                                   min="1000"
                                   step="1000"
                                   placeholder="8000">
                            <small class="help-text">Min: 1,000 | Increment: 1,000${extraCost}</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" 
                                   id="logo-digitizing-${logo.id}"
                                   ${logo.needsDigitizing ? 'checked' : ''}>
                            <span>Needs digitizing ($100 setup fee)</span>
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
        return this.logos.filter(l => l.needsDigitizing).length * 100;
    }
    
    /**
     * Calculate additional stitch cost per piece
     */
    getAdditionalStitchCost() {
        let totalExtraStitches = 0;
        this.logos.forEach(logo => {
            const extra = Math.max(0, logo.stitchCount - 8000);
            totalExtraStitches += extra;
        });
        return (totalExtraStitches / 1000) * 1.25;
    }
    
    /**
     * Get logos summary for display
     */
    getLogosSummary() {
        return this.logos.map(logo => ({
            position: logo.position,
            stitchCount: logo.stitchCount,
            needsDigitizing: logo.needsDigitizing,
            extraStitchCost: Math.max(0, logo.stitchCount - 8000) / 1000 * 1.25
        }));
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