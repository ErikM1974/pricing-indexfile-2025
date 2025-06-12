/**
 * DTG Integration Module
 * Connects DTG adapter with universal components
 */

class DTGIntegration {
    constructor() {
        this.config = window.DTGConfig;
        this.components = {};
        this.state = {
            currentLocation: null,
            currentPricingData: null,
            isInitialized: false
        };
        
        // Wait for DOM before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        console.log('[DTGIntegration] Initializing DTG page components');
        
        try {
            // Initialize components
            this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize location selector
            this.initializeLocationSelector();
            
            // Mark as initialized
            this.state.isInitialized = true;
            
            // Trigger initial location load if default location is set
            if (this.config.quickQuote.defaultLocation) {
                setTimeout(() => {
                    this.handleLocationChange(this.config.quickQuote.defaultLocation);
                }, 500); // Small delay to ensure everything is loaded
            }
            
            console.log('[DTGIntegration] Initialization complete');
        } catch (error) {
            console.error('[DTGIntegration] Initialization failed:', error);
        }
    }
    
    initializeComponents() {
        // Initialize Universal Product Display
        this.components.productDisplay = new UniversalProductDisplay({
            containerId: 'product-display',
            pageType: 'dtg',
            showBackButton: true,
            showInfoBox: true,
            showSelectedColor: true,
            sticky: false,
            infoBoxContent: 'Full-color DTG printing on high-quality garments.'
        });
        
        // Initialize Quick Quote Calculator with DTG location support
        this.components.quickQuote = new UniversalQuickQuoteCalculator({
            ...this.config.quickQuote,
            pageType: 'dtg',
            unitLabel: this.config.unitLabel,
            ltmThreshold: this.config.pricing.ltmThreshold,
            ltmFee: this.config.pricing.ltmFee,
            showLocationSelector: true,
            locations: this.config.locations,
            defaultLocation: this.config.quickQuote.defaultLocation || 'LC',
            onQuantityChange: (quantity) => this.handleQuantityChange(quantity),
            onLocationChange: (location) => this.handleLocationChange(location),
            customPricingBreakdown: this.getDTGPricingBreakdown.bind(this)
        });
        
        // Initialize Universal Pricing Grid
        this.components.pricingGrid = new UniversalPricingGrid({
            ...this.config.pricingGrid,
            containerId: 'pricing-grid-container',
            onTierClick: (tier) => this.handleTierClick(tier)
        });
        
        // Store references globally for debugging
        window.dtgComponents = this.components;
    }
    
    setupEventListeners() {
        // Listen for pricing data from DTG adapter
        window.addEventListener('pricingDataLoaded', (event) => {
            console.log('[DTGIntegration] Pricing data received:', event.detail);
            this.handlePricingDataLoaded(event.detail);
        });
        
        // Listen for color changes
        window.addEventListener('colorChanged', (event) => {
            if (event.detail) {
                this.handleColorChange(event.detail);
            }
        });
        
        // Listen for quantity changes from Quick Quote
        window.addEventListener('quantityChanged', (event) => {
            if (event.detail && event.detail.totalQuantity) {
                this.components.pricingGrid.highlightActiveTier(event.detail.totalQuantity);
            }
        });
    }
    
    initializeLocationSelector() {
        // Location selector is now integrated into Quick Quote Calculator
        // This method is kept for backward compatibility but does nothing
        console.log('[DTGIntegration] Location selector is now part of Quick Quote Calculator');
    }
    
    getDTGPricingBreakdown(quantity, location) {
        // For DTG, we don't need a complex breakdown since prices are all-inclusive
        // This method is here for compatibility but returns null to use the default breakdown
        return null;
    }
    
    getBasePrice(quantity) {
        // Get base price from current pricing data or use default
        if (this.state.currentPricingData && this.state.currentPricingData.pricingData) {
            const sizeData = this.state.currentPricingData.pricingData['S-XL'];
            if (sizeData) {
                // Find the appropriate price for the quantity
                const quantities = Object.keys(sizeData)
                    .filter(key => key !== 'sizeName')
                    .map(q => parseInt(q))
                    .sort((a, b) => a - b);
                
                for (let i = quantities.length - 1; i >= 0; i--) {
                    if (quantity >= quantities[i]) {
                        return parseFloat(sizeData[quantities[i]]);
                    }
                }
            }
        }
        return 20.00; // Default base price
    }
    
    handleLocationChange(locationCode) {
        console.log('[DTGIntegration] Location changed to:', locationCode);
        
        if (!locationCode) {
            // Don't reset to initial state - just keep current pricing
            return;
        }
        
        this.state.currentLocation = locationCode;
        const locationInfo = this.config.helpers.getLocationInfo(locationCode);
        
        // Update info box with location details
        if (this.components.productDisplay && locationInfo) {
            const infoText = `${locationInfo.displayName} printing${locationInfo.maxSize ? ` (up to ${locationInfo.maxSize})` : ''}`;
            this.components.productDisplay.updateInfoBox(infoText);
        }
        
        // Show loading state only if we have the pricing grid visible
        if (this.components.pricingGrid && this.state.currentPricingData) {
            this.components.pricingGrid.showLoading();
        }
        
        // Update pricing note
        const pricingNote = document.getElementById('pricing-grid-container-pricing-note');
        if (pricingNote && locationInfo) {
            pricingNote.textContent = `Prices shown are per item and include ${locationInfo.displayName} printing.`;
        }
        
        // Update Quick Quote if it exists
        if (this.components.quickQuote) {
            this.components.quickQuote.updatePricing();
        }
        
        // Trigger DTG adapter to load pricing for this location
        if (window.displayPricingForSelectedLocation) {
            window.displayPricingForSelectedLocation(locationCode);
        }
    }
    
    handlePricingDataLoaded(data) {
        console.log('[DTGIntegration] Processing pricing data');
        
        this.state.currentPricingData = data;
        
        // Update Quick Quote with new pricing
        if (this.components.quickQuote && data.pricingData) {
            this.components.quickQuote.updatePricingData(data);
        }
        
        // Update Pricing Grid
        if (this.components.pricingGrid) {
            // Transform DTG data format to universal format if needed
            const transformedData = this.transformPricingData(data);
            this.components.pricingGrid.updatePricingData(transformedData);
        }
        
        // Show pricing notes
        const notesElement = document.getElementById('pricing-grid-container-notes');
        if (notesElement) {
            notesElement.style.display = 'block';
        }
    }
    
    transformPricingData(dtgData) {
        // DTG adapter already provides data in a compatible format
        // Just ensure it has the expected structure
        return {
            ...dtgData,
            tiers: dtgData.tiers || this.extractTiersFromData(dtgData),
            sizeGroups: dtgData.sizeGroups || ['S-XL', '2XL', '3XL', '4XL+']
        };
    }
    
    extractTiersFromData(data) {
        // Extract unique quantity tiers from the pricing data
        const tiers = new Set();
        
        if (data.pricingData) {
            Object.values(data.pricingData).forEach(sizeData => {
                Object.keys(sizeData).forEach(qty => {
                    if (qty !== 'sizeName') {
                        tiers.add(parseInt(qty));
                    }
                });
            });
        }
        
        return Array.from(tiers).sort((a, b) => a - b);
    }
    
    handleColorChange(colorData) {
        console.log('[DTGIntegration] Color changed:', colorData);
        
        // Update pricing grid color indicator
        if (this.components.pricingGrid) {
            this.components.pricingGrid.updateSelectedColor(
                colorData.COLOR_NAME, 
                colorData
            );
        }
    }
    
    handleQuantityChange(quantity) {
        console.log('[DTGIntegration] Quantity changed:', quantity);
        
        // Highlight active tier in pricing grid
        if (this.components.pricingGrid) {
            this.components.pricingGrid.highlightActiveTier(quantity);
        }
        
        // Update any quantity-dependent displays
        this.updateQuantityDependentDisplays(quantity);
    }
    
    handleTierClick(tier) {
        console.log('[DTGIntegration] Tier clicked:', tier);
        
        // Update quick quote quantity to match tier
        if (this.components.quickQuote) {
            this.components.quickQuote.setQuantity(tier.min);
        }
    }
    
    updateQuantityDependentDisplays(quantity) {
        // Check for LTM
        const isLTM = this.config.helpers.isLTM(quantity);
        
        // Update any LTM warnings
        const ltmWarnings = document.querySelectorAll('.ltm-warning');
        ltmWarnings.forEach(warning => {
            warning.style.display = isLTM ? 'block' : 'none';
        });
    }
    
    showInitialState() {
        // Don't show initial state for DTG since we have a default location
        // Just keep the current state
        console.log('[DTGIntegration] showInitialState called but keeping current state');
    }
    
    // Public methods for external access
    getCurrentLocation() {
        return this.state.currentLocation;
    }
    
    getCurrentLocationInfo() {
        return this.config.helpers.getLocationInfo(this.state.currentLocation);
    }
    
    refreshPricing() {
        if (this.state.currentLocation) {
            this.handleLocationChange(this.state.currentLocation);
        }
    }
}

// Initialize when ready
const dtgIntegration = new DTGIntegration();

// Make available globally
window.DTGIntegration = dtgIntegration;