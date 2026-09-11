/**
 * Cart Drawer Component
 * Replaces modal with modern slide-out drawer for sample selection
 * Used by: /catalog (top-sellers view) + product.html — reads window.sampleCart
 * from shared_components/js/sample-cart-service.js
 *
 * Features:
 * - Slide-out animation from right
 * - Visual color swatches (not dropdown)
 * - Size button grid (not dropdown)
 * - Cart contents display
 * - Add/Remove items
 * - Mobile responsive (full-screen on mobile)
 */

var CARTDRAW_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var cartdrawLog = CARTDRAW_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)
class CartDrawer {
    constructor() {
        this.isOpen = false;
        this.currentProduct = null;
        this.selectedColor = null;
        this.selectedSize = null;

        cartdrawLog('[CartDrawer] Initializing...');
        this.init();
    }

    init() {
        // Create drawer HTML
        this.createDrawerHTML();

        // Attach event listeners
        this.attachEventListeners();

        cartdrawLog('[CartDrawer] Initialized successfully');
    }

    createDrawerHTML() {
        // Check if drawer already exists
        if (document.getElementById('cart-drawer')) {
            cartdrawLog('[CartDrawer] Drawer already exists');
            return;
        }

        const drawerHTML = `
            <!-- Drawer Overlay -->
            <div id="drawer-overlay" class="drawer-overlay"></div>

            <!-- Cart Drawer -->
            <dialog id="cart-drawer" class="cart-drawer" aria-label="Your Sample Cart">
                <!-- Drawer Header -->
                <div class="drawer-header">
                    <h3 class="drawer-title">Your Sample Cart</h3>
                    <button type="button" class="drawer-close" id="drawer-close" aria-label="Close cart">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>

                <!-- Drawer Content -->
                <div class="drawer-content">
                    <!-- Product Selection Section (shown when adding product) -->
                    <div id="product-selection-section" class="product-selection-section" style="display: none;">
                        <div class="product-preview">
                            <img id="drawer-product-image" src="" alt="" class="product-preview-image">
                            <div class="product-preview-info">
                                <h4 id="drawer-product-name"></h4>
                                <p id="drawer-product-description"></p>
                                <div id="drawer-product-badge"></div>
                            </div>
                        </div>

                        <!-- Color Selection -->
                        <div class="selection-group">
                            <label class="selection-label">Select Color:</label>
                            <div id="drawer-color-swatches" class="color-swatches">
                                <!-- Color swatches populated dynamically -->
                            </div>
                        </div>

                        <!-- Size Selection -->
                        <div class="selection-group">
                            <label class="selection-label">Select Size:</label>
                            <div id="drawer-size-buttons" class="size-buttons">
                                <!-- Size buttons populated dynamically -->
                            </div>
                        </div>

                        <!-- Add to Cart Button -->
                        <button type="button" class="btn btn-primary btn-add-to-cart" id="drawer-add-to-cart" disabled>
                            Add to Cart
                        </button>
                    </div>

                    <!-- Cart Items Section (always shown) -->
                    <div id="cart-items-section" class="cart-items-section">
                        <h4 class="section-title">Items in Cart (<span id="cart-count">0</span>)</h4>
                        <div id="cart-items-list" class="cart-items-list">
                            <p class="empty-cart-message">Your cart is empty. Browse products to add samples.</p>
                        </div>
                    </div>
                </div>

                <!-- Drawer Footer -->
                <div class="drawer-footer">
                    <button type="button" class="btn btn-ghost btn-continue-shopping" id="continue-shopping">
                        Continue Shopping
                    </button>
                    <button type="button" class="btn btn-primary btn-checkout" id="proceed-to-checkout" disabled>
                        Checkout (<span id="checkout-count">0</span>)
                    </button>
                </div>
            </dialog>
        `;

        document.body.insertAdjacentHTML('beforeend', drawerHTML);
    }

    attachEventListeners() {
        // Close buttons
        document.getElementById('drawer-close').addEventListener('click', () => this.close());
        document.getElementById('continue-shopping').addEventListener('click', () => this.close());
        document.getElementById('drawer-overlay').addEventListener('click', () => this.close());

        // Add to cart button
        document.getElementById('drawer-add-to-cart').addEventListener('click', () => this.addToCart());

        // Checkout button
        document.getElementById('proceed-to-checkout').addEventListener('click', () => this.goToCheckout());

        const drawer = document.getElementById('cart-drawer');
        drawer.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
        drawer.addEventListener('click', event => {
            if (event.target !== drawer) return;
            const box = drawer.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.close();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open(product = null) {
        // Drawer markup uses Font Awesome icons — lazy-load it on pages without it
        if (window.sampleCartEnsureIcons) window.sampleCartEnsureIcons();

        this.isOpen = true;
        this.currentProduct = product;
        this.selectedColor = null;
        this.selectedSize = null;

        // Show drawer and overlay
        const drawer = document.getElementById('cart-drawer');
        this.opener = document.activeElement;
        if (!drawer.open) drawer.showModal();
        drawer.classList.add('open');
        document.getElementById('drawer-close').focus();
        document.getElementById('drawer-overlay').classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        if (product) {
            // Show product selection section
            this.showProductSelection(product);
        } else {
            // Hide product selection, show cart only
            this.hideProductSelection();
        }

        // Always update cart display
        this.updateCartDisplay();
    }

    close() {
        cartdrawLog('[CartDrawer] Closing drawer');

        this.isOpen = false;
        this.currentProduct = null;
        this.selectedColor = null;
        this.selectedSize = null;

        const drawer = document.getElementById('cart-drawer');
        drawer.classList.remove('open');
        if (drawer.open) drawer.close();
        if (this.opener?.isConnected) this.opener.focus();
        document.getElementById('drawer-overlay').classList.remove('open');
        document.body.style.overflow = ''; // Restore scrolling
    }

    showProductSelection(product) {
        const section = document.getElementById('product-selection-section');
        section.style.display = 'block';

        // Update product preview
        document.getElementById('drawer-product-image').src = product.imageUrl || 'https://via.placeholder.com/100';
        document.getElementById('drawer-product-name').textContent = product.name;
        document.getElementById('drawer-product-description').textContent = product.description || '';

        // Show badge (FREE or PAID)
        const badgeHTML = product.type === 'paid'
            ? `<span class="badge badge-paid">PAID - $${product.price.toFixed(2)}</span>`
            : `<span class="badge badge-free">FREE SAMPLE</span>`;
        document.getElementById('drawer-product-badge').innerHTML = badgeHTML;

        // Populate colors
        this.populateColors(product.colors || []);

        // Populate sizes
        this.populateSizes(product.sizes || []);

        // Disable add button initially
        document.getElementById('drawer-add-to-cart').disabled = true;
    }

    hideProductSelection() {
        document.getElementById('product-selection-section').style.display = 'none';
    }

    populateColors(colors) {
        const container = document.getElementById('drawer-color-swatches');
        container.innerHTML = '';

        colors.forEach(color => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'color-swatch';
            swatch.setAttribute('aria-label', color.name);
            swatch.setAttribute('aria-pressed', 'false');
            swatch.setAttribute('data-color', color.name);
            swatch.setAttribute('data-color-code', color.code);
            swatch.setAttribute('data-catalog-color', color.catalogColor || color.name);

            // Use actual swatch image from Sanmar if available
            if (color.swatchUrl) {
                swatch.style.backgroundImage = `url('${color.swatchUrl}')`;
                swatch.style.backgroundSize = 'cover';
                swatch.style.backgroundPosition = 'center';
            } else {
                // Fallback to gray if no image
                swatch.style.backgroundColor = '#cccccc';
            }

            swatch.title = color.name;

            // Add checkmark for selection
            swatch.innerHTML = '<i class="fas fa-check color-check" aria-hidden="true"></i>';

            swatch.addEventListener('click', () => this.selectColor(color, swatch));
            container.appendChild(swatch);
        });
    }

    populateSizes(sizes) {
        const container = document.getElementById('drawer-size-buttons');
        container.innerHTML = '';

        sizes.forEach(size => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'size-button';
            button.textContent = size;
            button.setAttribute('data-size', size);

            button.addEventListener('click', () => this.selectSize(size, button));
            container.appendChild(button);
        });
    }

    selectColor(color, swatchElement) {
        // Remove previous selection
        document.querySelectorAll('#drawer-color-swatches .color-swatch').forEach(s => {
            s.classList.remove('selected');
            s.setAttribute('aria-pressed', 'false');
        });

        // Add selection to clicked swatch
        swatchElement.classList.add('selected');
        swatchElement.setAttribute('aria-pressed', 'true');

        this.selectedColor = {
            name: color.name,
            code: color.code,
            catalogColor: color.catalogColor || color.name,
            swatchUrl: color.swatchUrl
        };

        cartdrawLog('[CartDrawer] Color selected:', this.selectedColor);
        this.checkAddButtonState();
    }

    selectSize(size, buttonElement) {
        // Remove previous selection
        document.querySelectorAll('.size-button').forEach(b => b.classList.remove('selected'));

        // Add selection to clicked button
        buttonElement.classList.add('selected');

        this.selectedSize = size;

        cartdrawLog('[CartDrawer] Size selected:', this.selectedSize);
        this.checkAddButtonState();
    }

    checkAddButtonState() {
        // Enable add button only if both color and size are selected
        const addButton = document.getElementById('drawer-add-to-cart');
        addButton.disabled = !(this.selectedColor && this.selectedSize);
    }

    async addToCart() {
        if (!this.currentProduct || !this.selectedColor || !this.selectedSize) {
            console.error('[CartDrawer] Cannot add to cart - missing product, color, or size');
            return;
        }

        // Build cart item
        const cartItem = {
            style: this.currentProduct.style,
            name: this.currentProduct.name,
            description: this.currentProduct.description || '',
            imageUrl: this.currentProduct.imageUrl || '',
            color: this.selectedColor.name,
            colorCode: this.selectedColor.code,
            catalogColor: this.selectedColor.catalogColor,
            size: this.selectedSize,
            price: this.currentProduct.price || 0,
            type: this.currentProduct.type || 'free',
            upcharges: this.currentProduct.upcharges || {},
            addedAt: new Date().toISOString()
        };

        if (!window.sampleCart) {
            console.error('[CartDrawer] SampleCart not found');
            alert('Error adding to cart. Please refresh the page.');
            return;
        }

        // addSample is async (live inventory gate) and returns false when
        // blocked — it shows its own toast either way, so don't double-toast
        // and don't collapse the picker on a failed add.
        const added = await window.sampleCart.addSample(cartItem);
        this.updateCartDisplay();
        if (!added) return;

        // Hide product selection section
        this.hideProductSelection();

        // Reset selections
        this.selectedColor = null;
        this.selectedSize = null;
    }

    updateCartDisplay() {
        const cartItemsList = document.getElementById('cart-items-list');
        const cartCount = document.getElementById('cart-count');
        const checkoutCount = document.getElementById('checkout-count');
        const checkoutButton = document.getElementById('proceed-to-checkout');

        // Get samples from SampleCart
        const samples = window.sampleCart ? window.sampleCart.samples : [];

        cartCount.textContent = samples.length;
        checkoutCount.textContent = samples.length;
        checkoutButton.disabled = samples.length === 0;

        if (samples.length === 0) {
            cartItemsList.innerHTML = '<p class="empty-cart-message">Your cart is empty. Browse products to add samples.</p>';
            return;
        }

        // Build cart items HTML
        let html = '';
        samples.forEach((sample, index) => {
            const badge = sample.type === 'paid'
                ? `<span class="badge badge-paid">$${sample.price.toFixed(2)}</span>`
                : `<span class="badge badge-free">FREE</span>`;

            html += `
                <div class="cart-item" data-index="${index}">
                    <img src="${sample.imageUrl || 'https://via.placeholder.com/60'}"
                         alt="${sample.name}"
                         class="cart-item-image">
                    <div class="cart-item-details">
                        <div class="cart-item-name">${sample.name}</div>
                        <div class="cart-item-variant">${sample.color} - ${sample.size}</div>
                        ${badge}
                    </div>
                    <button type="button"
                            class="cart-item-remove"
                            onclick="cartDrawer.removeItem(${index})"
                            title="Remove">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </div>
            `;
        });

        cartItemsList.innerHTML = html;
    }

    removeItem(index) {
        cartdrawLog('[CartDrawer] Removing item at index:', index);

        if (window.sampleCart) {
            window.sampleCart.removeSample(index);
            this.updateCartDisplay();
            this.showSuccessMessage('Item removed from cart');
        }
    }

    goToCheckout() {
        if (!window.sampleCart || window.sampleCart.samples.length === 0) {
            alert('Your cart is empty');
            return;
        }

        cartdrawLog('[CartDrawer] Proceeding to checkout');
        window.location.href = '/pages/sample-cart.html';
    }

    showSuccessMessage(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'drawer-toast';
        toast.innerHTML = `
            <i class="fas fa-check-circle" aria-hidden="true"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide and remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize drawer on page load
document.addEventListener('DOMContentLoaded', () => {
    window.cartDrawer = new CartDrawer();
    cartdrawLog('[CartDrawer] Available globally as window.cartDrawer');
});
