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

    // Clear manual mode and reload
    function clearManualMode() {
        sessionStorage.removeItem('manualCostOverride');

        // Remove manualCost parameter from URL
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete('manualCost');
        urlParams.delete('cost');

        // Reload page without manual cost parameter
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.location.href = newUrl;
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
                    <i class="fas fa-tools"></i>
                </div>
                <div class="manual-mode-info">
                    <strong>⚠️ INTERNAL MANUAL PRICING MODE</strong>
                    <span class="manual-mode-details">
                        Base Cost: <strong>$${manualCost.toFixed(2)}</strong> |
                        No product images/swatches will display
                    </span>
                </div>
                <button class="manual-mode-exit" onclick="window.clearManualMode()" title="Exit manual mode">
                    <i class="fas fa-times"></i> Exit Manual Mode
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

        // Add styles if not already present
        if (!document.getElementById('manual-mode-styles')) {
            const styles = document.createElement('style');
            styles.id = 'manual-mode-styles';
            styles.textContent = `
                .manual-mode-banner {
                    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                    color: white;
                    padding: 16px 20px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    position: sticky;
                    top: 0;
                    z-index: 9999;
                    animation: slideDown 0.3s ease-out;
                }

                @keyframes slideDown {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .manual-mode-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .manual-mode-icon {
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                }

                .manual-mode-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .manual-mode-info strong:first-child {
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }

                .manual-mode-details {
                    font-size: 14px;
                    opacity: 0.95;
                }

                .manual-mode-details strong {
                    font-weight: 700;
                    font-size: 16px;
                }

                .manual-mode-exit {
                    background: rgba(255,255,255,0.2);
                    border: 2px solid white;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .manual-mode-exit:hover {
                    background: white;
                    color: #ff9800;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }

                .manual-mode-exit i {
                    margin-right: 6px;
                }

                /* Mobile responsive */
                @media (max-width: 768px) {
                    .manual-mode-content {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }

                    .manual-mode-info strong:first-child {
                        font-size: 16px;
                    }

                    .manual-mode-details {
                        font-size: 13px;
                    }

                    .manual-mode-exit {
                        width: 100%;
                        text-align: center;
                    }
                }

                /* Adjust body padding when banner is present */
                body.manual-mode-active {
                    padding-top: 80px !important;
                }
            `;
            document.head.appendChild(styles);
        }

        // Add class to body for padding adjustment
        document.body.classList.add('manual-mode-active');

        console.log('[ManualModeIndicator] Banner displayed for manual cost:', manualCost);
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
                    <i class="fas fa-info-circle"></i>
                    <strong>Manual Pricing Mode:</strong> Product images and color swatches are not available
                    for non-SanMar products. All pricing calculations are accurate based on your entered cost.
                `;
                container.insertBefore(warning, container.firstChild);
            }
        });
    }

    // Initialize on DOM ready
    function init() {
        const manualCost = getManualCost();
        if (manualCost !== null) {
            console.log('[ManualModeIndicator] Manual cost detected:', manualCost);

            // Show banner immediately
            showManualModeBanner(manualCost);

            // Add product warning after a short delay (let page load)
            setTimeout(() => {
                addProductDisplayWarning();
            }, 1000);

            // Make clear function globally available
            window.clearManualMode = clearManualMode;

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

    console.log('[ManualModeIndicator] Script loaded and monitoring for manual cost override');
})();
