// Cap Embroidery Validation Module
(function() {
    "use strict";
    
    console.log("[CAP-EMB-VALIDATION] Cap Embroidery Validation Module loaded");
    
    // Ensure NWCA_APP_CONFIG is loaded
    if (!window.NWCA_APP_CONFIG || !window.NWCA_APP_CONFIG.FEES || !window.NWCA_APP_CONFIG.MESSAGES) {
        console.error("[CAP-EMB-VALIDATION] CRITICAL: NWCA_APP_CONFIG not found or incomplete. Load app-config.js before this script.");
        // Optionally, define fallback defaults here if essential for basic operation, though ideally config should always load.
        // For now, we'll assume it loads and proceed. If not, errors will occur.
    }

    // Set global LTM values for other modules from config
    // These globals are a bit of an anti-pattern but are part of the existing structure.
    // Consider refactoring away from these globals in a later phase.
    window.LTM_MINIMUM_QUANTITY = window.NWCA_APP_CONFIG.FEES.LTM_CAP_MINIMUM_QUANTITY;
    window.LTM_FEE_VALUE = window.NWCA_APP_CONFIG.FEES.LTM_CAP_FEE_AMOUNT;
    
    /**
     * Validates if a product title contains "Cap"
     * @param {string} productTitle - The product title to validate
     * @returns {boolean} - True if valid cap product
     */
    function isValidCapProduct(productTitle) {
        if (!productTitle || typeof productTitle !== 'string') {
            return false;
        }
        
        // Case-insensitive check for "cap" in the title
        const titleLower = productTitle.toLowerCase();
        return /\bcaps?\b/.test(titleLower); // Matches "cap" or "caps" as whole words
    }
    
    /**
     * Shows a modal warning for non-cap products
     * @param {string} productTitle - The product title
     * @returns {Promise<boolean>} - True if user wants to proceed anyway
     */
    function showNonCapWarning(productTitle) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            // Create modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 8px;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                text-align: center;
            `;
            
            const modalConfig = NWCA_APP_CONFIG.MESSAGES.NON_CAP_WARNING_MODAL;
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 48px; color: #ffc107;">⚠️</span>
                </div>
                <h3 style="margin-bottom: 15px; color: #dc3545;">${modalConfig.TITLE}</h3>
                <p style="margin-bottom: 20px; color: #333;">
                    ${modalConfig.BODY_LINE_1}
                    <br><br>
                    ${modalConfig.BODY_LINE_2.replace('%PRODUCT_TITLE%', productTitle)}
                    <br><br>
                    ${modalConfig.BODY_LINE_3}
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cap-warning-cancel" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">${modalConfig.CANCEL_BUTTON}</button>
                    <button id="cap-warning-proceed" style="
                        padding: 10px 20px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">${modalConfig.PROCEED_BUTTON}</button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Handle button clicks
            document.getElementById('cap-warning-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
            
            document.getElementById('cap-warning-proceed').addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });
        });
    }
    
    /**
     * Shows a modal for stitch count mismatch
     * @param {string} existingStitchCount - Stitch count in cart
     * @param {string} newStitchCount - Stitch count being added
     * @returns {Promise<string>} - 'clear' to clear cart, 'cancel' to cancel
     */
    function showStitchCountMismatchModal(existingStitchCount, newStitchCount) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            // Create modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 8px;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                text-align: center;
            `;
            
            const modalConfig = NWCA_APP_CONFIG.MESSAGES.STITCH_COUNT_MISMATCH_MODAL;
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 48px; color: #dc3545;">🚫</span>
                </div>
                <h3 style="margin-bottom: 15px; color: #dc3545;">${modalConfig.TITLE}</h3>
                <p style="margin-bottom: 20px; color: #333;">
                    ${modalConfig.BODY_LINE_1.replace('%EXISTING_STITCH_COUNT%', existingStitchCount)}
                    <br><br>
                    ${modalConfig.BODY_LINE_2.replace('%NEW_STITCH_COUNT%', newStitchCount)}
                    <br><br>
                    ${modalConfig.BODY_LINE_3}
                    <br><br>
                    ${modalConfig.BODY_LINE_4}
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="stitch-modal-cancel" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">${modalConfig.CANCEL_BUTTON}</button>
                    <button id="stitch-modal-clear" style="
                        padding: 10px 20px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">${modalConfig.PROCEED_BUTTON}</button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Handle button clicks
            document.getElementById('stitch-modal-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve('cancel');
            });
            
            document.getElementById('stitch-modal-clear').addEventListener('click', () => {
                overlay.remove();
                resolve('clear');
            });
        });
    }
    
    /**
     * Updates the LTM fee display with cap-specific information
     * @param {number} totalQuantity - Total quantity in cart
     * @param {number} ltmFeeTotal - Total LTM fee
     */
    function updateCapLTMDisplay(totalQuantity, ltmFeeTotal) {
        const ltmFeeNotice = document.querySelector('.ltm-fee-notice');
        if (!ltmFeeNotice) return;
        
        const ltmConfig = NWCA_APP_CONFIG.FEES;
        const ltmMessages = NWCA_APP_CONFIG.MESSAGES.LTM_FEE_NOTICE_CAP;

        if (totalQuantity < ltmConfig.LTM_CAP_MINIMUM_QUANTITY && totalQuantity > 0) {
            ltmFeeNotice.style.display = 'flex';
            
            const ltmText = ltmFeeNotice.querySelector('.ltm-text');
            if (ltmText) {
                const capsNeeded = ltmConfig.LTM_CAP_MINIMUM_QUANTITY - totalQuantity;
                const perCapFee = totalQuantity > 0 ? ltmFeeTotal / totalQuantity : 0; // Avoid division by zero
                
                ltmText.innerHTML = `
                    <div style="display:flex;align-items:center;margin-bottom:5px;">
                        <span style="font-size:1.3em;margin-right:8px;">⚠️</span>
                        <span style="font-size:1.1em;font-weight:bold;">${ltmMessages.TITLE}</span>
                    </div>
                    <div style="margin-bottom:5px;">
                        <div>${ltmMessages.MINIMUM_ORDER_LABEL} <strong>${ltmConfig.LTM_CAP_MINIMUM_QUANTITY} caps</strong></div>
                        <div>${ltmMessages.CURRENT_ORDER_LABEL} <strong>${totalQuantity} caps</strong></div>
                        <div>${ltmMessages.LTM_FEE_LABEL} <span style="color:#dc3545;font-weight:bold;font-size:1.1em;">$${ltmFeeTotal.toFixed(2)}</span></div>
                        <div>${ltmMessages.PER_CAP_LABEL} <span style="color:#dc3545;font-weight:bold;">$${perCapFee.toFixed(2)}</span></div>
                    </div>
                    <div style="font-size:0.9em;font-style:italic;margin-top:5px;padding-top:5px;border-top:1px dashed #ffc107;">
                        ${ltmMessages.ELIMINATE_FEE_PREFIX} <strong>${capsNeeded} ${ltmMessages.ELIMINATE_FEE_SUFFIX}</strong>
                    </div>
                `;
            }
            
            // Enhanced styling for cap orders
            ltmFeeNotice.style.backgroundColor = '#fff3cd';
            ltmFeeNotice.style.border = '2px solid #ffc107';
            ltmFeeNotice.style.padding = '15px';
            ltmFeeNotice.style.borderRadius = '8px';
            ltmFeeNotice.style.marginBottom = '15px';
            ltmFeeNotice.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        } else {
            ltmFeeNotice.style.display = 'none';
        }
    }
    
    // Expose functions globally
    window.CapEmbroideryValidation = {
        isValidCapProduct,
        showNonCapWarning,
        showStitchCountMismatchModal,
        updateCapLTMDisplay,
        // Expose configured values if other modules rely on CapEmbroideryValidation for these
        // Otherwise, they should ideally get them directly from NWCA_APP_CONFIG
        MINIMUM_CAP_QUANTITY: NWCA_APP_CONFIG.FEES.LTM_CAP_MINIMUM_QUANTITY,
        LTM_FEE: NWCA_APP_CONFIG.FEES.LTM_CAP_FEE_AMOUNT
    };
    
})();
; // Explicit semicolon at the end of the file