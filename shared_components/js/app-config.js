// app-config.js
// Centralized application configuration

// Create a global namespace object if it doesn't exist
window.NWCA_APP_CONFIG = window.NWCA_APP_CONFIG || {};

(function(CONFIG) {
    "use strict";

    CONFIG.FEES = {
        LTM_CAP_MINIMUM_QUANTITY: 24,
        LTM_CAP_FEE_AMOUNT: 50.00
    };

    CONFIG.MESSAGES = {
        NON_CAP_WARNING_MODAL: {
            TITLE: "Invalid Product Type",
            BODY_LINE_1: "This pricing calculator is specifically for <strong>cap embroidery</strong> only.",
            BODY_LINE_2: "The selected product \"<strong>%PRODUCT_TITLE%</strong>\" does not appear to be a cap.",
            BODY_LINE_3: "Please use the appropriate pricing page for other product types.",
            CANCEL_BUTTON: "Go Back",
            PROCEED_BUTTON: "Proceed Anyway"
        },
        STITCH_COUNT_MISMATCH_MODAL: {
            TITLE: "Stitch Count Mismatch",
            BODY_LINE_1: "Your cart contains caps with <strong>%EXISTING_STITCH_COUNT% stitches</strong>.",
            BODY_LINE_2: "You are trying to add caps with <strong>%NEW_STITCH_COUNT% stitches</strong>.",
            BODY_LINE_3: "All caps in a single order must have the same stitch count for production.",
            BODY_LINE_4: "Would you like to clear your current cart and add this item?",
            CANCEL_BUTTON: "Cancel",
            PROCEED_BUTTON: "Clear Cart & Add"
        },
        LTM_FEE_NOTICE_CAP: {
            TITLE: "Less Than Minimum Fee - Cap Orders",
            MINIMUM_ORDER_LABEL: "Minimum Order:",
            CURRENT_ORDER_LABEL: "Current Order:",
            LTM_FEE_LABEL: "LTM Fee:",
            PER_CAP_LABEL: "Per Cap:",
            ELIMINATE_FEE_PREFIX: "Add",
            ELIMINATE_FEE_SUFFIX: "more caps to eliminate this fee"
        }
    };

    CONFIG.PRODUCT_DEFAULTS = {
        // Example: DEFAULT_STITCH_COUNT: 5000
    };

    CONFIG.API_ENDPOINTS = {
        // Although most go through server.js, any direct client-side ones or specific paths could be here.
    };

    CONFIG.UI_SETTINGS = {
        // Example: MODAL_DEFAULT_WIDTH: "500px"
    };

    // Add more configuration categories as needed

})(window.NWCA_APP_CONFIG);

// Ensure this script is loaded before any scripts that depend on NWCA_APP_CONFIG
// Example usage in another file:
// if (quantity < NWCA_APP_CONFIG.FEES.LTM_THRESHOLD_QUANTITY) { ... }
// alert(NWCA_APP_CONFIG.MESSAGES.STITCH_COUNT_MISMATCH_BODY);