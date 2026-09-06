/**
 * Manual Mode Indicator
 * Displays visual banner when pricing pages are in manual cost override mode
 *
 * Usage: Include this script on any pricing page that supports manual cost override
 * It will automatically detect URL parameters and display appropriate indicators
 *
 * @author Claude & Erik
 * @date 2025-10-09
 * @version 1.0.0
 */

/* Logging gate (2026-09-06): manual-mode-indicator chatter only on localhost or ?debug=1; console.error/warn stay live. */
var MMI_LOG_ON = window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug');
var mmiLog = MMI_LOG_ON ? console.log.bind(console) : function () {};
(function() {
    'use strict';

    // Check for manual cost override
    function getManualCost() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCost = urlParams.get('manualCost') || urlParams.get('cost');
        if (urlCost && !isNaN(parseFloat(urlCost))) {
            return parseFloat(urlCost);
        }

        const storedCost = sessionStorage.getItem('manualCostOverride');
        if (storedCost && !isNaN(parseFloat(storedCost))) {
            return parseFloat(storedCost);
        }

        return null;
    }

    // Clear manual mode and return to dashboard
    function clearManualMode() {
        sessionStorage.removeItem('manualCostOverride');

        // Return to Staff Dashboard
        window.location.href = '/staff-dashboard.html';
    }

    // Create and display manual mode banner
    function showManualModeBanner(manualCost) {
        // Check if banner already exists
        if (document.getElementById('manual-mode-banner')) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'manual-mode-banner';
        banner.className = 'manual-mode-banner';
        banner.innerHTML = `
            <div class="manual-mode-content">
                <div class="manual-mode-icon">
                    <i class="fas fa-clipboard" aria-hidden="true"></i>
                </div>
                <div class="manual-mode-info">
                    <strong>📋 Manual Pricing Calculator</strong>
                    <span class="manual-mode-details">
                        Base cost: <strong>$${manualCost.toFixed(2)}</strong> • Custom product pricing
                    </span>
                </div>
                <button type="button" class="manual-mode-exit" title="Return to Staff Dashboard">
                    <i class="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
                </button>
            </div>
        `;

        // Insert at the top of the page (after header if it exists)
        const header = document.querySelector('header, .header, .enhanced-pricing-header');
        if (header) {
            header.insertAdjacentElement('afterend', banner);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        // Styles: /shared_components/css/manual-mode-indicator.css (linked by every calculator page) — nothing injected.

        // Add class to body for padding adjustment
        document.body.classList.add('manual-mode-active');

        mmiLog('[ManualModeIndicator] Banner displayed for manual cost:', manualCost);
    }

    // Add warning to product display area
    function addProductDisplayWarning() {
        // Look for product display containers
        const productContainers = [
            document.querySelector('.product-hero'),
            document.querySelector('.product-display'),
            document.querySelector('#product-display'),
            document.querySelector('.product-info')
        ].filter(el => el !== null);

        productContainers.forEach(container => {
            if (!container.querySelector('.manual-mode-product-warning')) {
                const warning = document.createElement('div');
                warning.className = 'manual-mode-product-warning alert alert-info';
                warning.innerHTML = `
                    <i class="fas fa-calculator" aria-hidden="true"></i>
                    <strong>Custom Pricing:</strong> Pricing calculated using your base cost of $${getManualCost().toFixed(2)}.
                    Product details may be limited for vendor-supplied items.
                `;
                container.insertBefore(warning, container.firstChild);
            }
        });
    }

    // Initialize on DOM ready
    function init() {
        const manualCost = getManualCost();
        if (manualCost !== null) {
            mmiLog('[ManualModeIndicator] Manual cost detected:', manualCost);

            // Show banner immediately
            showManualModeBanner(manualCost);

            // Add product warning after a short delay (let page load)
            setTimeout(() => {
                addProductDisplayWarning();
            }, 1000);

            // Make clear function globally available
            window.clearManualMode = clearManualMode;
            // Exit button (was an inline handler)
            document.addEventListener('click', function (e) {
                if (e.target.closest && e.target.closest('.manual-mode-exit')) clearManualMode();
            });

            // Dispatch event for other scripts
            window.dispatchEvent(new CustomEvent('manualModeActive', {
                detail: { manualCost: manualCost }
            }));
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    mmiLog('[ManualModeIndicator] Script loaded and monitoring for manual cost override');
})();
