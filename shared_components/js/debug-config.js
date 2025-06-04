// Debug Configuration
// Controls verbose logging to prevent memory issues
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';
    
    // Set to true only when debugging is needed
    // Production should always be false to prevent memory issues
    window.DEBUG_MODE = false;
    
    // Memory-safe console wrapper
    if (!window.DEBUG_MODE) {
        // Store original console methods
        const originalConsole = {
            log: console.log,
            info: console.info,
            debug: console.debug
        };
        
        // Override console methods to prevent excessive logging
        console.log = function(...args) {
            // Only log errors and critical warnings
            if (args[0] && typeof args[0] === 'string' && 
                (args[0].includes('Error') || args[0].includes('Warning'))) {
                originalConsole.log.apply(console, args);
            }
        };
        
        console.info = function() {
            // Suppress info logs in production
        };
        
        console.debug = function() {
            // Suppress debug logs in production
        };
    }
    
})();