/**
 * Decoration Selector JavaScript
 * Handles the prominent decoration method selection on product pages
 * Version: 1.0
 * Created: January 10, 2025
 */

(function() {
    'use strict';

    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', initDecorationSelector);

    function initDecorationSelector() {
        console.log('[DecorationSelector] Initializing...');

        // Get all decoration method cards
        const methodCards = document.querySelectorAll('.decoration-method-card');

        if (methodCards.length === 0) {
            console.warn('[DecorationSelector] No decoration method cards found');
            return;
        }

        // Add click handlers to each card
        methodCards.forEach(card => {
            card.addEventListener('click', handleMethodSelection);
        });

        // Check for pre-selected method from URL or session
        checkPreselectedMethod();

        console.log(`[DecorationSelector] Initialized with ${methodCards.length} method cards`);
    }

    /**
     * Handle decoration method selection
     */
    function handleMethodSelection(event) {
        const card = event.currentTarget;
        const method = card.dataset.method;
        const url = card.dataset.url;

        console.log('[DecorationSelector] Method selected:', method);

        // Don't proceed if it's the "more options" card without a URL
        if (method === 'more' && !url) {
            showMoreOptionsModal();
            return;
        }

        // Remove active class from all cards
        document.querySelectorAll('.decoration-method-card').forEach(c => {
            c.classList.remove('active');
        });

        // Add active class to clicked card
        card.classList.add('active');

        // Store selected method in session storage
        sessionStorage.setItem('selectedDecorationMethod', method);

        // Visual feedback
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);

        // If URL is provided, navigate to pricing calculator
        if (url) {
            // Get current product style number and color from URL or page
            const styleNumber = getProductStyleNumber();
            const colorCode = getProductColorCode();

            if (styleNumber) {
                // Navigate to pricing calculator with style number and color (matching inline button behavior)
                let targetUrl = `${url}?StyleNumber=${encodeURIComponent(styleNumber)}`;

                // Add color parameter if available
                if (colorCode) {
                    targetUrl += `&COLOR=${encodeURIComponent(colorCode)}`;
                }

                console.log('[DecorationSelector] Navigating to:', targetUrl);

                // Smooth transition
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300);
            } else {
                // Navigate without style number
                console.log('[DecorationSelector] Navigating to:', url);
                setTimeout(() => {
                    window.location.href = url;
                }, 300);
            }
        } else {
            // Scroll to product display if no URL
            scrollToProductDisplay();
        }
    }

    /**
     * Get product style number from page
     */
    function getProductStyleNumber() {
        // Try URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const styleFromUrl = urlParams.get('styleNumber') || urlParams.get('style');

        if (styleFromUrl) {
            return styleFromUrl;
        }

        // Try to find it in the page content
        const breadcrumb = document.getElementById('breadcrumb-product');
        if (breadcrumb && breadcrumb.textContent) {
            return breadcrumb.textContent.trim();
        }

        // Try product info section
        const productInfo = document.querySelector('.product-style');
        if (productInfo && productInfo.textContent) {
            // Extract style number from text like "Style: PC61"
            const match = productInfo.textContent.match(/Style:\s*(\w+)/i);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Get product color code from page
     */
    function getProductColorCode() {
        // Try URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const colorFromUrl = urlParams.get('color') || urlParams.get('COLOR');

        if (colorFromUrl) {
            return colorFromUrl;
        }

        // Try to get from selected color swatch (this has the catalog color)
        const selectedSwatch = document.querySelector('.color-swatch.selected');
        if (selectedSwatch) {
            // Get the data-color attribute which contains CATALOG_COLOR
            const catalogColor = selectedSwatch.getAttribute('data-color');
            if (catalogColor) {
                return catalogColor;
            }
        }

        // Fallback: try to find it in the selected color name display
        const selectedColorDisplay = document.querySelector('.selected-color-display .selected-name');
        if (selectedColorDisplay && selectedColorDisplay.textContent) {
            return selectedColorDisplay.textContent.trim();
        }

        return null;
    }

    /**
     * Scroll to product display section
     */
    function scrollToProductDisplay() {
        const productDisplay = document.querySelector('.product-display-grid');
        if (productDisplay) {
            productDisplay.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    /**
     * Check for pre-selected method from session or URL
     */
    function checkPreselectedMethod() {
        // Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const methodFromUrl = urlParams.get('method');

        // Check session storage
        const methodFromSession = sessionStorage.getItem('selectedDecorationMethod');

        const preselectedMethod = methodFromUrl || methodFromSession;

        if (preselectedMethod) {
            const card = document.querySelector(`.decoration-method-card[data-method="${preselectedMethod}"]`);
            if (card) {
                card.classList.add('active');
                console.log('[DecorationSelector] Pre-selected method:', preselectedMethod);
            }
        }
    }

    /**
     * Show more options modal
     */
    function showMoreOptionsModal() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'decoration-more-modal';
        modal.innerHTML = `
            <div class="decoration-modal-overlay"></div>
            <div class="decoration-modal-content">
                <div class="decoration-modal-header">
                    <h3>All Decoration Methods</h3>
                    <button class="close-modal-btn" onclick="this.closest('.decoration-more-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="decoration-modal-body">
                    <div class="decoration-options-grid">
                        <a href="/calculators/embroidery-pricing.html" class="decoration-option">
                            <i class="fas fa-spool-thread"></i>
                            <span>Embroidery</span>
                        </a>
                        <a href="/calculators/dtg-pricing.html" class="decoration-option">
                            <i class="fas fa-print"></i>
                            <span>DTG Print</span>
                        </a>
                        <a href="/calculators/cap-embroidery-pricing.html" class="decoration-option">
                            <i class="fas fa-hat-cowboy"></i>
                            <span>Cap Embroidery</span>
                        </a>
                        <a href="/calculators/screenprint-pricing.html" class="decoration-option">
                            <i class="fas fa-shirt"></i>
                            <span>Screen Print</span>
                        </a>
                        <a href="/calculators/dtf-pricing.html" class="decoration-option">
                            <i class="fas fa-file-image"></i>
                            <span>DTF Transfer</span>
                        </a>
                        <a href="/calculators/heat-transfer-pricing.html" class="decoration-option">
                            <i class="fas fa-fire"></i>
                            <span>Heat Transfer</span>
                        </a>
                        <a href="/calculators/vinyl-pricing.html" class="decoration-option">
                            <i class="fas fa-cut"></i>
                            <span>Vinyl</span>
                        </a>
                        <a href="/calculators/sublimation-pricing.html" class="decoration-option">
                            <i class="fas fa-palette"></i>
                            <span>Sublimation</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add styles dynamically if not already present
        if (!document.getElementById('decoration-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'decoration-modal-styles';
            styles.textContent = `
                .decoration-more-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease;
                }

                .decoration-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                }

                .decoration-modal-content {
                    background: white;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                    z-index: 1;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
                }

                .decoration-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px;
                    border-bottom: 2px solid #e5e7eb;
                }

                .decoration-modal-header h3 {
                    margin: 0;
                    font-size: 24px;
                    color: #333;
                }

                .close-modal-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #666;
                    cursor: pointer;
                    padding: 8px;
                    line-height: 1;
                }

                .close-modal-btn:hover {
                    color: #333;
                }

                .decoration-modal-body {
                    padding: 24px;
                }

                .decoration-options-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 16px;
                }

                .decoration-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    text-decoration: none;
                    color: #333;
                    transition: all 0.2s ease;
                    min-height: 120px;
                }

                .decoration-option:hover {
                    background: white;
                    border-color: #4cb354;
                    transform: translateY(-4px);
                    box-shadow: 0 4px 12px rgba(76, 179, 84, 0.2);
                }

                .decoration-option i {
                    font-size: 36px;
                    color: #4cb354;
                    margin-bottom: 12px;
                }

                .decoration-option span {
                    font-size: 14px;
                    font-weight: 600;
                    text-align: center;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @media (max-width: 480px) {
                    .decoration-options-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .decoration-option {
                        padding: 16px 12px;
                        min-height: 100px;
                    }

                    .decoration-option i {
                        font-size: 28px;
                    }

                    .decoration-option span {
                        font-size: 12px;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        // Close on overlay click
        modal.querySelector('.decoration-modal-overlay').addEventListener('click', () => {
            modal.remove();
        });

        // Prevent modal content clicks from closing
        modal.querySelector('.decoration-modal-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Expose to global scope for debugging
    window.DecorationSelector = {
        getProductStyleNumber,
        showMoreOptionsModal
    };

})();
