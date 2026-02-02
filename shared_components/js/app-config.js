// app-config.js
// Centralized application configuration

// Create a global namespace object if it doesn't exist
window.NWCA_APP_CONFIG = window.NWCA_APP_CONFIG || {};

(function(CONFIG) {
    "use strict";

    CONFIG.FEES = {
        LTM_CAP_MINIMUM_QUANTITY: 8,     // 2026-02: LTM applies to qty <= 7 (threshold 8)
        LTM_CAP_FEE_AMOUNT: 50.00,
        LTM_GENERAL_THRESHOLD: 8,        // 2026-02: LTM applies to qty <= 7 (threshold 8)
        LTM_GENERAL_FEE_AMOUNT: 50.00    // General LTM fee amount
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
            BODY_LINE_1: "Your quote contains caps with <strong>%EXISTING_STITCH_COUNT% stitches</strong>.",
            BODY_LINE_2: "You are trying to add caps with <strong>%NEW_STITCH_COUNT% stitches</strong>.",
            BODY_LINE_3: "All caps in a single order must have the same stitch count for production.",
            BODY_LINE_4: "Would you like to start a new quote with this item?",
            CANCEL_BUTTON: "Cancel",
            PROCEED_BUTTON: "Start New Quote"
        },
        LTM_FEE_NOTICE_CAP: {
            TITLE: "Less Than Minimum Fee - Cap Orders",
            MINIMUM_ORDER_LABEL: "Minimum Order:",
            CURRENT_ORDER_LABEL: "Current Order:",
            LTM_FEE_LABEL: "LTM Fee:",
            PER_CAP_LABEL: "Per Cap:",
            ELIMINATE_FEE_PREFIX: "Add",
            ELIMINATE_FEE_SUFFIX: "more caps to eliminate this fee"
        },
        SELECT_QUANTITY_ALERT: "Please select at least one size and quantity.",
        CONTACT_PHONE_NUMBER: "253-922-5793",
        PRICING_UNAVAILABLE_HEADER: "Pricing Currently Unavailable",
        PRICING_UNAVAILABLE_BODY_1: "We apologize, but the pricing details for this item are currently unavailable.",
        PRICING_UNAVAILABLE_CALL_INSTRUCTION: "Please call <strong style=\"color: #0056b3; font-size: 18px;\">%PHONE_NUMBER%</strong> for an accurate quote.",
        PRICING_UNAVAILABLE_ASSISTANCE: "Our team is ready to assist you.",
        INVALID_PRODUCT_LINK_ERROR: "<strong>Error:</strong> Invalid product link parameters. Please go back to the product page, ensure a style and color are selected, wait a moment for links to update, and then try the pricing link again."
    };

    CONFIG.PRODUCT_DEFAULTS = {
        DEFAULT_EMBROIDERY_STITCH_COUNT: 8000
        // Example: DEFAULT_STITCH_COUNT: 5000
    };

    CONFIG.API_ENDPOINTS = {
        // Although most go through server.js, any direct client-side ones or specific paths could be here.
    };

    CONFIG.UI_SETTINGS = {
        // Example: MODAL_DEFAULT_WIDTH: "500px"
    };

    // Cart functionality disabled - using quote-only workflow
    CONFIG.FEATURES = {
        CART_ENABLED: false,
        QUOTE_MODE: true
    };

    // Add more configuration categories as needed

})(window.NWCA_APP_CONFIG);

// Ensure this script is loaded before any scripts that depend on NWCA_APP_CONFIG

    // Example usage in another file:
    // if (quantity < NWCA_APP_CONFIG.FEES.LTM_CAP_MINIMUM_QUANTITY) { ... }
    // alert(NWCA_APP_CONFIG.MESSAGES.PRICING_UNAVAILABLE_BODY_1);