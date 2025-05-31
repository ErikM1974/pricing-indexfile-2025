/**
 * DTF Adapter for Pricing Pages
 * Handles DTF-specific pricing logic and integration
 */

(function() {
    'use strict';
    
    console.log('[DTF Adapter] Initializing...');
    
    // DTF-specific configuration
    const DTF_CONFIG = {
        embellishmentType: 'dtf',
        displayName: 'DTF Transfer',
        supportsMultiLocation: true,
        maxLocations: 2,
        requiresGarmentCost: true
    };
    
    // Initialize DTF adapter
    function initializeDTFAdapter() {
        console.log('[DTF Adapter] Setting up DTF-specific handlers');
        
        // Register with pricing system if available
        if (window.PricingSystem && window.PricingSystem.registerAdapter) {
            window.PricingSystem.registerAdapter('dtf', {
                config: DTF_CONFIG,
                calculatePrice: calculateDTFPrice,
                validateInput: validateDTFInput,
                formatDisplay: formatDTFDisplay
            });
        }
        
        // Set up event listeners for DTF-specific elements
        setupDTFEventListeners();
        
        // Initialize default values
        initializeDefaults();
    }
    
    // Set up DTF-specific event listeners
    function setupDTFEventListeners() {
        // Listen for garment cost updates
        document.addEventListener('garmentCostUpdated', function(event) {
            console.log('[DTF Adapter] Garment cost updated:', event.detail);
            if (window.garmentCost !== undefined) {
                window.garmentCost = event.detail.cost;
            }
        });
        
        // Listen for product selection changes
        document.addEventListener('productSelected', function(event) {
            console.log('[DTF Adapter] Product selected:', event.detail);
            updateGarmentCostDisplay(event.detail);
        });
    }
    
    // Initialize default values
    function initializeDefaults() {
        // Set default garment cost if not already set
        if (window.garmentCost === undefined || window.garmentCost === 0) {
            window.garmentCost = 5.50; // Default fallback
        }
        
        // Initialize transfer sizes if function exists
        if (typeof window.updateTransferSizes === 'function') {
            window.updateTransferSizes(1);
        }
    }
    
    // Update garment cost display
    function updateGarmentCostDisplay(productData) {
        const costDisplay = document.getElementById('garment-cost-display');
        const costSource = document.getElementById('cost-source');
        
        if (!costDisplay || !costSource) return;
        
        // Try to extract cost from product data
        let cost = null;
        if (productData) {
            cost = productData.price || productData.PRICE || productData.BASE_PRICE || productData.GARMENT_COST;
        }
        
        if (cost && !isNaN(parseFloat(cost))) {
            window.garmentCost = parseFloat(cost);
            costDisplay.textContent = `$${window.garmentCost.toFixed(2)}`;
            costSource.textContent = 'From product catalog';
        } else {
            // Use default
            window.garmentCost = 5.50;
            costDisplay.textContent = `$${window.garmentCost.toFixed(2)}`;
            costSource.textContent = 'Using default price (product price not available)';
        }
    }
    
    // Validate DTF input
    function validateDTFInput(inputData) {
        const errors = [];
        
        // Validate garment cost
        if (!inputData.garmentCost || inputData.garmentCost <= 0) {
            errors.push('Valid garment cost is required');
        }
        
        // Validate quantity
        if (!inputData.quantity || inputData.quantity < 1) {
            errors.push('Quantity must be at least 1');
        }
        
        // Validate transfer selections
        if (!inputData.transfers || inputData.transfers.length === 0) {
            errors.push('At least one transfer must be selected');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    // Calculate DTF price (wrapper for existing logic)
    function calculateDTFPrice(inputData) {
        // This would integrate with the existing calculateDTFPrice function
        // For now, just return a placeholder
        return {
            unitPrice: 0,
            totalPrice: 0,
            breakdown: {}
        };
    }
    
    // Format DTF display
    function formatDTFDisplay(priceData) {
        // Format price data for display
        return {
            unitPrice: `$${priceData.unitPrice.toFixed(2)}`,
            totalPrice: `$${priceData.totalPrice.toFixed(2)}`,
            breakdown: priceData.breakdown
        };
    }
    
    // Export adapter functions
    window.DTFAdapter = {
        initialize: initializeDTFAdapter,
        updateGarmentCost: updateGarmentCostDisplay,
        validate: validateDTFInput,
        calculate: calculateDTFPrice,
        format: formatDTFDisplay
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDTFAdapter);
    } else {
        initializeDTFAdapter();
    }
    
})();