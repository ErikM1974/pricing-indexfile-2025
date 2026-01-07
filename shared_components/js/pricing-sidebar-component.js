/**
 * Pricing Sidebar Component - Unified Module for Quote Builders
 *
 * Used by: DTG, Screen Print, DTF, and Embroidery Quote Builders
 *
 * This module provides a unified pricing sidebar that can be configured
 * per-builder while maintaining consistent behavior and styling.
 *
 * Features:
 * - Total quantity display with optional breakdown (garments/caps)
 * - Pricing tier display with optional breakdown
 * - Cost breakdown (transfers, labor, freight for DTF)
 * - Subtotal with optional breakdown
 * - LTM fee handling with distribute/hide toggle
 * - Setup fees (screens for SP, digitizing for EMB)
 * - Grand total
 * - Copy to clipboard action
 *
 * @version 1.0.0
 * @created 2026-01-07
 */

class PricingSidebarComponent {
    constructor(config = {}) {
        this.config = {
            // Builder identification
            builderType: config.builderType || 'generic',  // 'dtg', 'screenprint', 'dtf', 'embroidery'
            builderName: config.builderName || 'Quote Builder',

            // Feature flags
            showLocations: config.showLocations ?? false,           // DTF only
            showPrintConfig: config.showPrintConfig ?? false,       // Screenprint only
            showCostBreakdown: config.showCostBreakdown ?? false,   // DTF (transfer, labor, freight)
            showMixedQuote: config.showMixedQuote ?? false,         // Embroidery (garments + caps)
            showSetupFee: config.showSetupFee ?? false,             // Screenprint, Embroidery
            showStitchCount: config.showStitchCount ?? false,       // Embroidery only

            // LTM configuration
            ltmThreshold: config.ltmThreshold || 24,
            ltmFee: config.ltmFee || 50,
            ltmFromAPI: config.ltmFromAPI ?? true,

            // Callbacks
            onCopyQuote: config.onCopyQuote || null,
            onLTMToggle: config.onLTMToggle || null,

            // Container
            containerId: config.containerId || 'pricing-sidebar'
        };

        // State
        this.ltmDistributed = false;
        this.currentPricing = null;

        console.log(`[PricingSidebar] Initialized for ${this.config.builderName}`);
    }

    /**
     * Render the sidebar HTML into the container
     */
    render() {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`[PricingSidebar] Container not found: ${this.config.containerId}`);
            return;
        }

        container.innerHTML = this.buildHTML();
        this.attachEventListeners();
    }

    /**
     * Build the sidebar HTML based on configuration
     * @returns {string} HTML string
     */
    buildHTML() {
        return `
            <div class="power-sidebar">
                ${this.config.showLocations ? this.buildLocationsPanel() : ''}
                ${this.config.showPrintConfig ? this.buildPrintConfigSection() : ''}

                <div class="pricing-panel">
                    <div class="pricing-title">
                        <i class="fas fa-calculator"></i>
                        <span>Quote Summary</span>
                    </div>

                    <!-- Quantity Section -->
                    <div class="pricing-row">
                        <span class="label">Total Pieces:</span>
                        <span class="value" id="sidebar-total-qty">0</span>
                    </div>
                    ${this.config.showMixedQuote ? this.buildQuantityBreakdown() : ''}

                    <!-- Tier Section -->
                    <div class="pricing-row">
                        <span class="label">Pricing Tier:</span>
                        <span class="tier-badge" id="sidebar-pricing-tier">-</span>
                    </div>
                    ${this.config.showMixedQuote ? this.buildTierBreakdown() : ''}

                    ${this.config.showCostBreakdown ? this.buildCostBreakdown() : ''}

                    <div class="pricing-divider"></div>

                    <!-- Subtotal Section -->
                    <div class="pricing-row">
                        <span class="label">Products Subtotal:</span>
                        <span class="value" id="sidebar-subtotal">$0.00</span>
                    </div>
                    ${this.config.showMixedQuote ? this.buildSubtotalBreakdown() : ''}

                    ${this.config.showSetupFee ? this.buildSetupFeeSection() : ''}

                    <!-- LTM Fee Section -->
                    <div class="pricing-row" id="sidebar-ltm-row" style="display: none;">
                        <span class="label">LTM Fee:</span>
                        <span class="ltm-value-group">
                            <button class="ltm-toggle-btn" id="sidebar-ltm-toggle" title="Toggle LTM display">
                                <i class="fas fa-eye-slash"></i>
                            </button>
                            <span class="value" id="sidebar-ltm-fee">$50.00</span>
                        </span>
                    </div>
                    ${this.config.showMixedQuote ? this.buildLTMBreakdown() : ''}

                    <!-- Grand Total -->
                    <div class="pricing-row total">
                        <span class="label">TOTAL:</span>
                        <span class="value" id="sidebar-grand-total">$0.00</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="action-panel">
                    <button class="btn-action btn-copy" id="sidebar-copy-btn">
                        <i class="fas fa-copy"></i> Copy Quote
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Build locations panel HTML (DTF only)
     */
    buildLocationsPanel() {
        return `
            <div class="sidebar-panel locations-panel" id="sidebar-locations-panel">
                <div class="panel-title">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Selected Locations</span>
                </div>
                <div class="locations-list" id="sidebar-locations-list">
                    <div class="no-locations">No locations selected</div>
                </div>
            </div>
        `;
    }

    /**
     * Build print config section HTML (Screenprint only)
     */
    buildPrintConfigSection() {
        return `
            <div class="config-summary" id="sidebar-print-config">
                <div class="config-row" id="sidebar-front-row">
                    <span class="label">Front:</span>
                    <span class="value" id="sidebar-front-config">-</span>
                </div>
                <div class="config-row" id="sidebar-back-row" style="display: none;">
                    <span class="label">Back:</span>
                    <span class="value" id="sidebar-back-config">-</span>
                </div>
                <div class="config-row" id="sidebar-screens-row">
                    <span class="label">Total Screens:</span>
                    <span class="value" id="sidebar-screens">0</span>
                </div>
                <div class="config-row" id="sidebar-dark-row" style="display: none;">
                    <span class="label">Dark Garment:</span>
                    <span class="value">+1 underbase</span>
                </div>
                <div class="config-row" id="sidebar-stripes-row" style="display: none;">
                    <span class="label">Safety Stripes:</span>
                    <span class="value" id="sidebar-stripes-cost">$0.00</span>
                </div>
            </div>
        `;
    }

    /**
     * Build quantity breakdown HTML (Embroidery mixed quotes)
     */
    buildQuantityBreakdown() {
        return `
            <div class="pricing-row sub-breakdown" id="sidebar-garment-qty-row" style="display: none;">
                <span class="label"><i class="fas fa-tshirt"></i> Garments:</span>
                <span class="value sub-value" id="sidebar-garment-qty">0</span>
            </div>
            <div class="pricing-row sub-breakdown" id="sidebar-cap-qty-row" style="display: none;">
                <span class="label"><i class="fas fa-hat-cowboy"></i> Caps:</span>
                <span class="value sub-value" id="sidebar-cap-qty">0</span>
            </div>
        `;
    }

    /**
     * Build tier breakdown HTML (Embroidery mixed quotes)
     */
    buildTierBreakdown() {
        return `
            <div class="pricing-row sub-breakdown" id="sidebar-garment-tier-row" style="display: none;">
                <span class="label"><i class="fas fa-tshirt"></i> Garment Tier:</span>
                <span class="tier-badge small" id="sidebar-garment-tier">-</span>
            </div>
            <div class="pricing-row sub-breakdown" id="sidebar-cap-tier-row" style="display: none;">
                <span class="label"><i class="fas fa-hat-cowboy"></i> Cap Tier:</span>
                <span class="tier-badge small" id="sidebar-cap-tier">-</span>
            </div>
        `;
    }

    /**
     * Build cost breakdown HTML (DTF)
     */
    buildCostBreakdown() {
        return `
            <div class="cost-breakdown" id="sidebar-cost-breakdown">
                <div class="pricing-row" id="sidebar-transfer-row">
                    <span class="label">Transfer Costs:</span>
                    <span class="value" id="sidebar-transfer-cost">$0.00</span>
                </div>
                <div class="pricing-row" id="sidebar-labor-row">
                    <span class="label">Labor (per pc):</span>
                    <span class="value" id="sidebar-labor-cost">$0.00</span>
                </div>
                <div class="pricing-row" id="sidebar-freight-row">
                    <span class="label">Freight (per pc):</span>
                    <span class="value" id="sidebar-freight-cost">$0.00</span>
                </div>
            </div>
        `;
    }

    /**
     * Build subtotal breakdown HTML (Embroidery mixed quotes)
     */
    buildSubtotalBreakdown() {
        return `
            <div class="pricing-row sub-breakdown" id="sidebar-garment-subtotal-row" style="display: none;">
                <span class="label"><i class="fas fa-tshirt"></i> Garments:</span>
                <span class="value sub-value" id="sidebar-garment-subtotal">$0.00</span>
            </div>
            <div class="pricing-row sub-breakdown" id="sidebar-cap-subtotal-row" style="display: none;">
                <span class="label"><i class="fas fa-hat-cowboy"></i> Caps:</span>
                <span class="value sub-value" id="sidebar-cap-subtotal">$0.00</span>
            </div>
        `;
    }

    /**
     * Build setup fee section HTML (Screenprint, Embroidery)
     */
    buildSetupFeeSection() {
        return `
            <div class="pricing-row" id="sidebar-setup-row" style="display: none;">
                <span class="label" id="sidebar-setup-label">Setup Fee:</span>
                <span class="value" id="sidebar-setup-fee">$0.00</span>
            </div>
        `;
    }

    /**
     * Build LTM breakdown HTML (Embroidery mixed quotes)
     */
    buildLTMBreakdown() {
        return `
            <div class="pricing-row sub-breakdown" id="sidebar-garment-ltm-row" style="display: none;">
                <span class="label"><i class="fas fa-tshirt"></i> Garment LTM:</span>
                <span class="value sub-value" id="sidebar-garment-ltm">$0.00</span>
            </div>
            <div class="pricing-row sub-breakdown" id="sidebar-cap-ltm-row" style="display: none;">
                <span class="label"><i class="fas fa-hat-cowboy"></i> Cap LTM:</span>
                <span class="value sub-value" id="sidebar-cap-ltm">$0.00</span>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // LTM toggle button
        const ltmToggle = document.getElementById('sidebar-ltm-toggle');
        if (ltmToggle) {
            ltmToggle.addEventListener('click', () => this.toggleLTMDisplay());
        }

        // Copy button
        const copyBtn = document.getElementById('sidebar-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.handleCopyQuote());
        }
    }

    /**
     * Update the sidebar with new pricing data
     * @param {Object} pricing - Pricing data object
     */
    update(pricing) {
        this.currentPricing = pricing;

        // Update total quantity
        this.updateElement('sidebar-total-qty', pricing.totalQuantity || 0);

        // Update tier
        this.updateElement('sidebar-pricing-tier', pricing.tier || '-');

        // Update subtotal
        this.updateElement('sidebar-subtotal', this.formatCurrency(pricing.subtotal || 0));

        // Update LTM
        this.updateLTMDisplay(pricing);

        // Update setup fee
        if (this.config.showSetupFee && pricing.setupFee > 0) {
            this.showElement('sidebar-setup-row');
            this.updateElement('sidebar-setup-fee', this.formatCurrency(pricing.setupFee));

            // Update label based on builder type
            const label = document.getElementById('sidebar-setup-label');
            if (label) {
                if (this.config.builderType === 'screenprint') {
                    label.textContent = `Setup (${pricing.screens || 0} screens):`;
                } else if (this.config.builderType === 'embroidery') {
                    label.textContent = 'Digitizing Fee:';
                } else {
                    label.textContent = 'Setup Fee:';
                }
            }
        } else {
            this.hideElement('sidebar-setup-row');
        }

        // Update grand total
        this.updateElement('sidebar-grand-total', this.formatCurrency(pricing.grandTotal || 0));

        // Update builder-specific sections
        if (this.config.showCostBreakdown) {
            this.updateCostBreakdown(pricing);
        }

        if (this.config.showMixedQuote) {
            this.updateMixedQuoteBreakdown(pricing);
        }

        if (this.config.showPrintConfig) {
            this.updatePrintConfig(pricing);
        }

        if (this.config.showLocations) {
            this.updateLocations(pricing.locations || []);
        }
    }

    /**
     * Update LTM display
     */
    updateLTMDisplay(pricing) {
        const ltmRow = document.getElementById('sidebar-ltm-row');
        const ltmFee = pricing.ltmFee || 0;

        if (ltmFee > 0) {
            this.showElement('sidebar-ltm-row');

            if (this.ltmDistributed) {
                // LTM distributed into unit prices - show as informational
                this.updateElement('sidebar-ltm-fee', `(+${this.formatCurrency(ltmFee / (pricing.totalQuantity || 1))}/ea)`);
            } else {
                // LTM shown separately
                this.updateElement('sidebar-ltm-fee', this.formatCurrency(ltmFee));
            }

            // Update toggle button icon
            const toggleBtn = document.getElementById('sidebar-ltm-toggle');
            if (toggleBtn) {
                toggleBtn.innerHTML = this.ltmDistributed
                    ? '<i class="fas fa-eye"></i>'
                    : '<i class="fas fa-eye-slash"></i>';
                toggleBtn.title = this.ltmDistributed
                    ? 'Show LTM separately'
                    : 'Distribute LTM into unit prices';
            }
        } else {
            this.hideElement('sidebar-ltm-row');
        }
    }

    /**
     * Toggle LTM display mode
     */
    toggleLTMDisplay() {
        this.ltmDistributed = !this.ltmDistributed;

        if (this.currentPricing) {
            this.updateLTMDisplay(this.currentPricing);
        }

        if (this.config.onLTMToggle) {
            this.config.onLTMToggle(this.ltmDistributed);
        }
    }

    /**
     * Update cost breakdown (DTF)
     */
    updateCostBreakdown(pricing) {
        if (pricing.transferCost !== undefined) {
            this.updateElement('sidebar-transfer-cost', this.formatCurrency(pricing.transferCost));
        }
        if (pricing.laborCost !== undefined) {
            this.updateElement('sidebar-labor-cost', this.formatCurrency(pricing.laborCost));
        }
        if (pricing.freightCost !== undefined) {
            this.updateElement('sidebar-freight-cost', this.formatCurrency(pricing.freightCost));
        }
    }

    /**
     * Update mixed quote breakdown (Embroidery)
     * Shows breakdown for garments and/or caps based on what's in the quote
     */
    updateMixedQuoteBreakdown(pricing) {
        const hasGarments = pricing.garmentQty > 0;
        const hasCaps = pricing.capQty > 0;

        // Show garment breakdown if garments exist
        if (hasGarments) {
            this.showElement('sidebar-garment-qty-row');
            this.updateElement('sidebar-garment-qty', pricing.garmentQty);
            this.showElement('sidebar-garment-tier-row');
            this.updateElement('sidebar-garment-tier', pricing.garmentTier || '-');
            this.showElement('sidebar-garment-subtotal-row');
            this.updateElement('sidebar-garment-subtotal', this.formatCurrency(pricing.garmentSubtotal || 0));
            if (pricing.garmentLTM > 0) {
                this.showElement('sidebar-garment-ltm-row');
                this.updateElement('sidebar-garment-ltm', this.formatCurrency(pricing.garmentLTM));
            } else {
                this.hideElement('sidebar-garment-ltm-row');
            }
        } else {
            this.hideElement('sidebar-garment-qty-row');
            this.hideElement('sidebar-garment-tier-row');
            this.hideElement('sidebar-garment-subtotal-row');
            this.hideElement('sidebar-garment-ltm-row');
        }

        // Show cap breakdown if caps exist
        if (hasCaps) {
            this.showElement('sidebar-cap-qty-row');
            this.updateElement('sidebar-cap-qty', pricing.capQty);
            this.showElement('sidebar-cap-tier-row');
            this.updateElement('sidebar-cap-tier', pricing.capTier || '-');
            this.showElement('sidebar-cap-subtotal-row');
            this.updateElement('sidebar-cap-subtotal', this.formatCurrency(pricing.capSubtotal || 0));
            if (pricing.capLTM > 0) {
                this.showElement('sidebar-cap-ltm-row');
                this.updateElement('sidebar-cap-ltm', this.formatCurrency(pricing.capLTM));
            } else {
                this.hideElement('sidebar-cap-ltm-row');
            }
        } else {
            this.hideElement('sidebar-cap-qty-row');
            this.hideElement('sidebar-cap-tier-row');
            this.hideElement('sidebar-cap-subtotal-row');
            this.hideElement('sidebar-cap-ltm-row');
        }
    }

    /**
     * Update print config (Screenprint)
     */
    updatePrintConfig(pricing) {
        if (pricing.frontConfig) {
            this.updateElement('sidebar-front-config', pricing.frontConfig);
        }

        if (pricing.backConfig) {
            this.showElement('sidebar-back-row');
            this.updateElement('sidebar-back-config', pricing.backConfig);
        } else {
            this.hideElement('sidebar-back-row');
        }

        if (pricing.screens !== undefined) {
            this.updateElement('sidebar-screens', pricing.screens);
        }

        if (pricing.isDarkGarment) {
            this.showElement('sidebar-dark-row');
        } else {
            this.hideElement('sidebar-dark-row');
        }

        if (pricing.safetyStripesCost > 0) {
            this.showElement('sidebar-stripes-row');
            this.updateElement('sidebar-stripes-cost', this.formatCurrency(pricing.safetyStripesCost));
        } else {
            this.hideElement('sidebar-stripes-row');
        }
    }

    /**
     * Update locations display (DTF)
     */
    updateLocations(locations) {
        const list = document.getElementById('sidebar-locations-list');
        if (!list) return;

        if (locations.length === 0) {
            list.innerHTML = '<div class="no-locations">No locations selected</div>';
        } else {
            list.innerHTML = locations.map(loc => `
                <div class="location-item">
                    <i class="fas fa-check-circle"></i>
                    <span>${loc.name || loc}</span>
                </div>
            `).join('');
        }
    }

    /**
     * Handle copy quote action
     */
    async handleCopyQuote() {
        if (this.config.onCopyQuote) {
            await this.config.onCopyQuote();
        } else {
            console.warn('[PricingSidebar] No onCopyQuote callback configured');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Format a number as currency
     */
    formatCurrency(value) {
        return `$${(value || 0).toFixed(2)}`;
    }

    /**
     * Update element text content
     */
    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /**
     * Show an element
     */
    showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    }

    /**
     * Hide an element
     */
    hideElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    /**
     * Get current LTM distributed state
     */
    isLTMDistributed() {
        return this.ltmDistributed;
    }

    /**
     * Set LTM distributed state
     */
    setLTMDistributed(distributed) {
        this.ltmDistributed = distributed;
        if (this.currentPricing) {
            this.updateLTMDisplay(this.currentPricing);
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PricingSidebarComponent;
}

// Make available globally
window.PricingSidebarComponent = PricingSidebarComponent;

console.log('[PricingSidebarComponent] Module loaded');
