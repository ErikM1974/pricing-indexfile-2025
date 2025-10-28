/**
 * Cart Drawer Component
 * Replaces modal with modern slide-out drawer for sample selection
 * Used by: top-sellers-showcase.html
 *
 * Features:
 * - Slide-out animation from right
 * - Visual color swatches (not dropdown)
 * - Size button grid (not dropdown)
 * - Cart contents display
 * - Add/Remove items
 * - Mobile responsive (full-screen on mobile)
 */

class CartDrawer {
    constructor() {
        this.isOpen = false;
        this.currentProduct = null;
        this.selectedColor = null;
        this.selectedSize = null;

        console.log('[CartDrawer] Initializing...');
        this.init();
    }

    init() {
        // Create drawer HTML
        this.createDrawerHTML();

        // Attach event listeners
        this.attachEventListeners();

        console.log('[CartDrawer] Initialized successfully');
    }

    createDrawerHTML() {
        // Check if drawer already exists
        if (document.getElementById('cart-drawer')) {
            console.log('[CartDrawer] Drawer already exists');
            return;
        }

        const drawerHTML = `
            <!-- Drawer Overlay -->
            <div id="drawer-overlay" class="drawer-overlay"></div>

            <!-- Cart Drawer -->
            <div id="cart-drawer" class="cart-drawer">
                <!-- Drawer Header -->
                <div class="drawer-header">
                    <h3 class="drawer-title">Your Sample Cart</h3>
                    <button type="button" class="drawer-close" id="drawer-close">
                        <i class="fas fa-times"></i>
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
                        <button type="button" class="btn-add-to-cart" id="drawer-add-to-cart" disabled>
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
                    <button type="button" class="btn-continue-shopping" id="continue-shopping">
                        Continue Shopping
                    </button>
                    <button type="button" class="btn-checkout" id="proceed-to-checkout" disabled>
                        Checkout (<span id="checkout-count">0</span>)
                    </button>
                </div>
            </div>
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

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open(product = null) {
        console.log('[CartDrawer] Opening drawer', product ? 'with product' : 'view cart only');

        this.isOpen = true;
        this.currentProduct = product;
        this.selectedColor = null;
        this.selectedSize = null;

        // Show drawer and overlay
        document.getElementById('cart-drawer').classList.add('open');
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
        console.log('[CartDrawer] Closing drawer');

        this.isOpen = false;
        this.currentProduct = null;
        this.selectedColor = null;
        this.selectedSize = null;

        document.getElementById('cart-drawer').classList.remove('open');
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
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
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
            swatch.innerHTML = '<i class="fas fa-check color-check"></i>';

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
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));

        // Add selection to clicked swatch
        swatchElement.classList.add('selected');

        this.selectedColor = {
            name: color.name,
            code: color.code,
            catalogColor: color.catalogColor || color.name,
            swatchUrl: color.swatchUrl
        };

        console.log('[CartDrawer] Color selected:', this.selectedColor);
        this.checkAddButtonState();
    }

    selectSize(size, buttonElement) {
        // Remove previous selection
        document.querySelectorAll('.size-button').forEach(b => b.classList.remove('selected'));

        // Add selection to clicked button
        buttonElement.classList.add('selected');

        this.selectedSize = size;

        console.log('[CartDrawer] Size selected:', this.selectedSize);
        this.checkAddButtonState();
    }

    checkAddButtonState() {
        // Enable add button only if both color and size are selected
        const addButton = document.getElementById('drawer-add-to-cart');
        addButton.disabled = !(this.selectedColor && this.selectedSize);
    }

    addToCart() {
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
            addedAt: new Date().toISOString()
        };

        // Add to cart using existing SampleCart from top-sellers-showcase.html
        if (window.sampleCart) {
            window.sampleCart.addSample(cartItem);
        } else {
            console.error('[CartDrawer] SampleCart not found');
            alert('Error adding to cart. Please refresh the page.');
            return;
        }

        // Show success message
        this.showSuccessMessage(`${cartItem.name} added to cart!`);

        // Update cart display
        this.updateCartDisplay();

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
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });

        cartItemsList.innerHTML = html;
    }

    removeItem(index) {
        console.log('[CartDrawer] Removing item at index:', index);

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

        console.log('[CartDrawer] Proceeding to checkout');
        window.location.href = '/pages/checkout-review.html';
    }

    showSuccessMessage(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'drawer-toast';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
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
    console.log('[CartDrawer] Available globally as window.cartDrawer');
});
