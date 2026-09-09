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
            badge.hidden = !(this.cartCount > 0);

            // Add pulse animation on count change
            badge.classList.remove('is-pulse');
            setTimeout(() => { badge.classList.add('is-pulse'); }, 10);
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

        return `
            <header class="universal-header">
                <div class="header-container">
                    <a href="/catalog?topSellers=1" class="logo-link">
                        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                             alt="Northwest Custom Apparel"
                             class="company-logo">
                    </a>
                    <div class="header-actions">
                        ${this.options.showContactInfo ? `
                        <div class="contact-info">
                            <a href="tel:253-922-5793">
                                <i class="fas fa-phone" aria-hidden="true"></i>
                                253-922-5793
                            </a>
                            <a href="mailto:sales@nwcustomapparel.com">
                                <i class="fas fa-envelope" aria-hidden="true"></i>
                                sales@nwcustomapparel.com
                            </a>
                        </div>
                        ` : ''}
                        <a class="${cartIndicatorClass}" href="${this.options.isCartPage ? '#' : this.options.cartPageUrl}"
                             aria-label="Shopping cart with ${this.cartCount} items">
                            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                            <span class="cart-count-badge"${this.cartCount > 0 ? '' : ' hidden'}>${this.cartCount}</span>
                            <span class="cart-label">${this.cartCount} ${this.cartCount === 1 ? 'item' : 'items'}</span>
                        </a>
                    </div>
                </div>
            </header>
        `;
    }

    generateStyles() {
        // Layout and shared controls come from the consuming page stylesheet — nothing injected.
        return '';
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

        // Cart indicator click (was an inline handler); a real link, so keyboard + middle-click work
        const ind = document.querySelector('.cart-indicator');
        if (ind) ind.addEventListener('click', (e) => this.handleCartClick(e));

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
