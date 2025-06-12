// Screen Print Configuration Module
// Centralized configuration for screen print pricing

window.ScreenPrintConfig = {
    // Pricing thresholds
    minimumQuantity: 24,
    standardMinimum: 48,
    ltmThreshold: 48,
    ltmFee: 50.00,
    
    // Setup fees
    setupFeePerColor: 30.00,
    flashChargeDarkGarments: 0, // Included in color count
    
    // Color options
    colorOptions: [
        { value: '1', label: '1 Color' },
        { value: '2', label: '2 Colors' },
        { value: '3', label: '3 Colors' },
        { value: '4', label: '4 Colors' },
        { value: '5', label: '5 Colors' },
        { value: '6', label: '6 Colors' }
    ],
    
    // Dark garment colors that typically need white underbase
    darkGarmentColors: [
        'Black', 'Navy', 'Navy Blue', 'Dark Grey', 'Charcoal', 'Forest Green', 
        'Dark Green', 'Maroon', 'Dark Red', 'Purple', 'Dark Purple', 'Brown',
        'Dark Brown', 'Dark Heather', 'Heather Navy', 'Heather Charcoal'
    ],
    
    // UI Configuration
    ui: {
        showDetailedBreakdown: false, // Default collapsed
        allowSetupSpread: true,
        showLTMWarning: true,
        animationDuration: 300
    },
    
    // Messages
    messages: {
        ltmWarning: 'Small order fee applies for orders under 48 pieces',
        minimumError: 'Minimum order quantity is 24 pieces',
        darkGarmentNote: 'Dark garments require white underbase (adds 1 color per location)',
        setupFeeNote: 'One-time setup fee per color',
        loadingText: 'Calculating your screen print pricing...'
    },
    
    // Helper functions
    isDarkGarment(colorName) {
        if (!colorName) return false;
        return this.darkGarmentColors.some(dark => 
            colorName.toLowerCase().includes(dark.toLowerCase())
        );
    },
    
    calculateSetupFee(frontColors, backColors = 0) {
        const totalColors = parseInt(frontColors) + parseInt(backColors);
        return totalColors * this.setupFeePerColor;
    },
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
};

// Freeze config to prevent accidental modifications
Object.freeze(ScreenPrintConfig);
Object.freeze(ScreenPrintConfig.colorOptions);
Object.freeze(ScreenPrintConfig.darkGarmentColors);
Object.freeze(ScreenPrintConfig.ui);
Object.freeze(ScreenPrintConfig.messages);