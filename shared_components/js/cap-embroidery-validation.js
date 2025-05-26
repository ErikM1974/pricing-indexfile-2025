// Cap Embroidery Validation Module
(function() {
    "use strict";
    
    console.log("[CAP-EMB-VALIDATION] Cap Embroidery Validation Module loaded");
    
    // Constants
    const MINIMUM_CAP_QUANTITY = 24;
    const LTM_FEE = 50.00;
    
    // Set global LTM values for other modules
    window.LTM_MINIMUM_QUANTITY = MINIMUM_CAP_QUANTITY;
    window.LTM_FEE_VALUE = LTM_FEE;
    
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
            
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 48px; color: #ffc107;">⚠️</span>
                </div>
                <h3 style="margin-bottom: 15px; color: #dc3545;">Invalid Product Type</h3>
                <p style="margin-bottom: 20px; color: #333;">
                    This pricing calculator is specifically for <strong>cap embroidery</strong> only.
                    <br><br>
                    The selected product "<strong>${productTitle}</strong>" does not appear to be a cap.
                    <br><br>
                    Please use the appropriate pricing page for other product types.
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
                    ">Go Back</button>
                    <button id="cap-warning-proceed" style="
                        padding: 10px 20px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Proceed Anyway</button>
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
            
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 48px; color: #dc3545;">🚫</span>
                </div>
                <h3 style="margin-bottom: 15px; color: #dc3545;">Stitch Count Mismatch</h3>
                <p style="margin-bottom: 20px; color: #333;">
                    Your cart contains caps with <strong>${existingStitchCount} stitches</strong>.
                    <br><br>
                    You are trying to add caps with <strong>${newStitchCount} stitches</strong>.
                    <br><br>
                    All caps in a single order must have the same stitch count for production.
                    <br><br>
                    Would you like to clear your current cart and add this item?
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
                    ">Cancel</button>
                    <button id="stitch-modal-clear" style="
                        padding: 10px 20px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Clear Cart & Add</button>
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
        
        if (totalQuantity < MINIMUM_CAP_QUANTITY && totalQuantity > 0) {
            ltmFeeNotice.style.display = 'flex';
            
            const ltmText = ltmFeeNotice.querySelector('.ltm-text');
            if (ltmText) {
                const capsNeeded = MINIMUM_CAP_QUANTITY - totalQuantity;
                const perCapFee = ltmFeeTotal / totalQuantity;
                
                ltmText.innerHTML = `
                    <div style="display:flex;align-items:center;margin-bottom:5px;">
                        <span style="font-size:1.3em;margin-right:8px;">⚠️</span>
                        <span style="font-size:1.1em;font-weight:bold;">Less Than Minimum Fee - Cap Orders</span>
                    </div>
                    <div style="margin-bottom:5px;">
                        <div>Minimum Order: <strong>${MINIMUM_CAP_QUANTITY} caps</strong></div>
                        <div>Current Order: <strong>${totalQuantity} caps</strong></div>
                        <div>LTM Fee: <span style="color:#dc3545;font-weight:bold;font-size:1.1em;">$${ltmFeeTotal.toFixed(2)}</span></div>
                        <div>Per Cap: <span style="color:#dc3545;font-weight:bold;">$${perCapFee.toFixed(2)}</span></div>
                    </div>
                    <div style="font-size:0.9em;font-style:italic;margin-top:5px;padding-top:5px;border-top:1px dashed #ffc107;">
                        Add <strong>${capsNeeded} more caps</strong> to eliminate this fee
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
        MINIMUM_CAP_QUANTITY,
        LTM_FEE
    };
    
})();