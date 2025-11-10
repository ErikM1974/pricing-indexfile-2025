/**
 * Universal Cart Header Component
 * Single source of truth for cart indicator across all pages
 * Auto-syncs cart count in real-time across tabs/windows
 */

class UniversalCartHeader {
    constructor(options = {}) {
        this.options = {
            cartPageUrl: '/pages/sample-cart.html',
            isCartPage: options.isCartPage || false,
            showContactInfo: options.showContactInfo !== false, // default true
            ...options
        };

        this.cartCount = 0;
        this.init();
    }

    init() {
        // Update cart count immediately
        this.updateCartCount();

        // Listen for storage changes (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'sampleCart' || e.key === null) {
                this.updateCartCount();
            }
        });

        // Listen for custom cart update events (same page)
        window.addEventListener('cartUpdated', () => {
            this.updateCartCount();
        });

        // Initial render if DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    getCartSamples() {
        try {
            const stored = sessionStorage.getItem('sampleCart');
            if (!stored) return [];

            const parsed = JSON.parse(stored);

            // Handle both old (array) and new (nested) formats
            if (Array.isArray(parsed)) {
                return parsed;
            } else if (parsed && parsed.samples && Array.isArray(parsed.samples)) {
                return parsed.samples;
            }

            return [];
        } catch (e) {
            console.error('[UniversalCartHeader] Error parsing cart:', e);
            return [];
        }
    }

    updateCartCount() {
        const cart = this.getCartSamples();
        this.cartCount = cart.length;

        // Update badge if it exists
        const badge = document.querySelector('.cart-count-badge');
        if (badge) {
            badge.textContent = this.cartCount;
            badge.style.display = this.cartCount > 0 ? 'flex' : 'none';

            // Add pulse animation on count change
            badge.style.animation = 'none';
            setTimeout(() => {
                badge.style.animation = 'badgePulse 0.3s ease-out';
            }, 10);
        }

        // Update cart label
        const cartLabel = document.querySelector('.cart-label');
        if (cartLabel) {
            const itemText = this.cartCount === 1 ? 'item' : 'items';
            cartLabel.textContent = `${this.cartCount} ${itemText}`;
        }
    }

    handleCartClick(e) {
        if (this.options.isCartPage) {
            e.preventDefault();
            return false;
        }
        // Otherwise navigate to cart page
        window.location.href = this.options.cartPageUrl;
    }

    generateHeaderHTML() {
        const cartIndicatorClass = this.options.isCartPage ? 'cart-indicator on-cart-page' : 'cart-indicator';
        const cursorStyle = this.options.isCartPage ? 'cursor: default;' : 'cursor: pointer;';
        const clickHandler = this.options.isCartPage ? '' : 'onclick="window.universalCartHeader.handleCartClick(event)"';

        return `
            <header class="universal-header">
                <div class="header-container">
                    <a href="/pages/top-sellers-showcase.html" class="logo-link">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                             alt="Northwest Custom Apparel"
                             class="company-logo">
                    </a>
                    <div class="header-actions">
                        ${this.options.showContactInfo ? `
                        <div class="contact-info">
                            <a href="tel:253-922-5793">
                                <i class="fas fa-phone"></i>
                                253-922-5793
                            </a>
                            <a href="mailto:sales@nwcustomapparel.com">
                                <i class="fas fa-envelope"></i>
                                sales@nwcustomapparel.com
                            </a>
                        </div>
                        ` : ''}
                        <div class="${cartIndicatorClass}"
                             style="${cursorStyle}"
                             ${clickHandler}
                             aria-label="Shopping cart with ${this.cartCount} items">
                            <i class="fas fa-shopping-cart"></i>
                            <span class="cart-count-badge" style="display: ${this.cartCount > 0 ? 'flex' : 'none'};">${this.cartCount}</span>
                            <span class="cart-label">${this.cartCount} ${this.cartCount === 1 ? 'item' : 'items'}</span>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }

    generateStyles() {
        return `
        <style>
        .universal-header {
            background: white;
            border-bottom: 2px solid #4cb354;
            padding: 1.5rem 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .universal-header .header-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .universal-header .logo-link {
            text-decoration: none;
        }

        .universal-header .company-logo {
            height: 50px;
            transition: opacity 0.2s;
        }

        .universal-header .company-logo:hover {
            opacity: 0.8;
        }

        .universal-header .header-actions {
            display: flex;
            align-items: center;
            gap: 2rem;
        }

        .universal-header .contact-info {
            display: flex;
            gap: 1.5rem;
            align-items: center;
        }

        .universal-header .contact-info a {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #1f2937;
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.2s;
        }

        .universal-header .contact-info a:hover {
            color: #4cb354;
        }

        .universal-header .cart-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            background: #4cb354;
            color: white;
            border-radius: 8px;
            font-weight: 600;
            position: relative;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            transition: all 0.2s;
        }

        .universal-header .cart-indicator:not(.on-cart-page):hover {
            background: #409a47;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
        }

        .universal-header .cart-indicator.on-cart-page {
            opacity: 0.9;
        }

        .universal-header .cart-indicator i {
            font-size: 1.25rem;
        }

        .universal-header .cart-count-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #dc3545;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 700;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        @keyframes badgePulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }

        .universal-header .cart-label {
            font-size: 0.95rem;
        }

        @media (max-width: 768px) {
            .universal-header .header-container {
                flex-direction: column;
                gap: 1rem;
            }

            .universal-header .header-actions {
                width: 100%;
                flex-direction: column;
                gap: 1rem;
            }

            .universal-header .contact-info {
                width: 100%;
                justify-content: center;
                gap: 1rem;
                flex-wrap: wrap;
            }

            .universal-header .cart-indicator {
                width: 100%;
                justify-content: center;
            }
        }
        </style>
        `;
    }

    render() {
        // Check if header placeholder exists
        const placeholder = document.getElementById('universal-header-placeholder');
        if (placeholder) {
            placeholder.innerHTML = this.generateStyles() + this.generateHeaderHTML();
        } else {
            // Insert at beginning of body if no placeholder
            document.body.insertAdjacentHTML('afterbegin', this.generateStyles() + this.generateHeaderHTML());
        }

        // Update cart count after render
        this.updateCartCount();
    }
}

// Export for use in pages
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalCartHeader;
} else {
    window.UniversalCartHeader = UniversalCartHeader;
}
