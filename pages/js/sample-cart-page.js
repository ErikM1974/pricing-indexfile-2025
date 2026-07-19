/**
 * sample-cart-page.js — Sample Cart page controller (2026 reskin, 2026-07-06)
 *
 * Extracted VERBATIM from pages/sample-cart.html's inline script during the
 * nwca-2026 reskin (Rule 3: no inline code), minus debug chatter and the
 * legacy universal-cart-header chrome. All ids/classes and the full working
 * logic (cart load + upcharge migration, inventory check, render, free-flow
 * direct ShopWorks submit, EmailJS notify) are unchanged — paid carts are
 * delegated to pages/js/sample-checkout.js (Stripe) before the free flow.
 */
// Initialize EmailJS (free-flow notification email)
emailjs.init('4qSbDO-SQs19TbP80');


// ==============================================
// SIZE SORTING UTILITY
// ==============================================

/**
 * Sort sizes in natural order: Youth → Standard → Tall → Oversized
 * @param {Object} sizes - Object with size as key and quantity as value
 * @returns {Array} - Sorted array of size keys
 */
function sortSizesByOrder(sizes) {
    const order = [
        'YXS', 'YS', 'YM', 'YL', 'YXL',          // Youth
        'XS', 'S', 'M', 'L', 'XL',                // Standard
        'MT', 'LT', 'XLT',                        // Tall (medium/large/XL)
        '2XL', '2XLT',                            // 2X and 2X Tall
        '3XL', '3XLT',                            // 3X and 3X Tall
        '4XL', '5XL', '6XL',                      // Extra oversized
        'OSFA'                                    // One size
    ];

    return Object.keys(sizes)
        .filter(size => sizes[size] > 0)
        .sort((a, b) => {
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA === -1) return 1;         // Unknown sizes go to end
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
}

// Helper function to safely read cart from storage
function getCartSamples() {
    try {
        const stored = sessionStorage.getItem('sampleCart');

        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);

        // Handle both old (array) and new (nested) formats
        if (Array.isArray(parsed)) {
            return parsed; // Old format
        } else if (parsed && parsed.samples && Array.isArray(parsed.samples)) {
            return parsed.samples; // New format
        } else {
            console.warn('⚠️ [GET CART] Unrecognized cart format:', parsed);
            return [];
        }
    } catch (e) {
        console.error('❌ [GET CART] Error parsing cart:', e);
        return [];
    }
}

// Migrate old cart items to include upcharges (backward compatibility)
async function migrateCartUpcharges(cart) {
    if (!cart || cart.length === 0) return cart;


    let updated = false;
    const apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    for (let i = 0; i < cart.length; i++) {
        const item = cart[i];

        // Check if upcharges field is missing
        if (!item.upcharges || Object.keys(item.upcharges).length === 0) {

            try {
                const response = await fetch(`${apiBase}/api/pricing-bundle?method=BLANK&styleNumber=${item.style}`);

                if (response.ok) {
                    const data = await response.json();
                    const upcharges = data.sellingPriceDisplayAddOns || {};

                    // Add upcharges to item
                    cart[i].upcharges = upcharges;
                    updated = true;

                } else {
                    console.warn(`⚠️ [Migration] API failed for ${item.style}:`, response.status);
                    // Add empty upcharges object to prevent repeated attempts
                    cart[i].upcharges = {};
                }
            } catch (error) {
                console.error(`❌ [Migration] Error fetching upcharges for ${item.style}:`, error);
                // Add empty upcharges object to prevent repeated attempts
                cart[i].upcharges = {};
            }
        } else {
        }
    }


    // If we updated any items, save the migrated cart back to sessionStorage
    if (updated) {
        const cartData = {
            samples: cart,
            timestamp: new Date().toISOString()
        };
        sessionStorage.setItem('sampleCart', JSON.stringify(cartData));
    }

    return cart;
}

// Update cart summary bar and badge
function updateCartSummary(cart) {
    const itemCount = cart.length;
    let totalPieces = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        const upcharges = item.upcharges || {};
        const basePrice = parseFloat(item.price) || 0;

        Object.entries(item.sizes).forEach(([size, qty]) => {
            if (qty > 0) {
                totalPieces += qty;
                const upcharge = upcharges[size] || 0;
                // For free samples, price is always $0 regardless of size
                const sizePrice = (item.sampleType === 'free') ? 0 : (basePrice + upcharge);
                totalPrice += qty * sizePrice;
            }
        });
    });

    // Update header cart badge
    const badge = document.querySelector('.cart-count-badge');
    if (badge) {
        badge.textContent = itemCount;
        badge.style.display = itemCount > 0 ? 'flex' : 'none';
    }

    // Update summary bar
    document.getElementById('summaryItemCount').textContent = itemCount;
    document.getElementById('summaryTotalPieces').textContent = totalPieces;
    document.getElementById('summaryTotalPrice').textContent = `$${totalPrice.toFixed(2)}`;
}

// Load and display cart items
async function loadCart() {
    // === ENSURE CONTAINER IS VISIBLE (Fix for browser back button edge cases) ===
    const cartContainer = document.getElementById('cartContainer');
    if (cartContainer) {
        cartContainer.style.display = 'block';
    }

    let cart = getCartSamples();

    // Migrate old cart items to include upcharges (backward compatibility)
    cart = await migrateCartUpcharges(cart);

    // Update summary bar and badge
    updateCartSummary(cart);

    // Get cart container (declare once for entire function)
    const container = document.getElementById('cartItems');

    // ===== CHECK INVENTORY FOR ALL ITEMS =====
    if (cart.length > 0 && window.sampleInventoryService) {

        // Show loading indicator
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
                <p style="margin-top: 1rem; color: var(--text-secondary);">Checking inventory...</p>
            </div>
        `;

        try {
            // Check inventory for all cart items
            cart = await window.sampleInventoryService.checkCartInventory(cart);


            // Save updated cart with inventory status
            const cartData = {
                samples: cart,
                timestamp: new Date().toISOString()
            };
            sessionStorage.setItem('sampleCart', JSON.stringify(cartData));

        } catch (error) {
            console.error('[Sample Cart] Error checking inventory:', error);
            // Continue anyway - graceful degradation
        }
    }

    // === CRITICAL DEBUG POINT: Check cart after inventory ===

    // Validate cart is still an array
    if (!Array.isArray(cart)) {
        console.error('❌ CRITICAL: cart is not an array!', typeof cart, cart);
        cart = []; // Recover with empty array
    }

    // Display cart contents (container already declared at top of function)


    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h3>Your sample cart is empty</h3>
                <p>Start exploring our top-selling products and add samples to your cart!</p>

                <div class="features">
                    <div class="feature">
                        <i class="fas fa-shipping-fast"></i>
                        <div class="feature-text">
                            <h4>Free Samples</h4>
                            <p>Get physical samples to feel the quality</p>
                        </div>
                    </div>
                    <div class="feature">
                        <i class="fas fa-palette"></i>
                        <div class="feature-text">
                            <h4>All Colors</h4>
                            <p>See the actual colors before ordering</p>
                        </div>
                    </div>
                    <div class="feature">
                        <i class="fas fa-ruler"></i>
                        <div class="feature-text">
                            <h4>Check Sizes</h4>
                            <p>Try on different sizes for the perfect fit</p>
                        </div>
                    </div>
                </div>

                <a href="/catalog?topSellers=1" class="btn btn-primary" style="margin-top: 1rem; padding: 1rem 2.5rem; font-size: 1.1rem;">
                    <i class="fas fa-search"></i>
                    Browse Top Sellers
                </a>

                <p style="margin-top: 2rem; font-size: 0.9rem;">
                    Need help? Call us at <a href="tel:253-922-5793" style="color: var(--primary-color); font-weight: 600;">253-922-5793</a>
                </p>
            </div>
        `;
        // Hide contact form and summary bar
        document.getElementById('contactForm').style.display = 'none';
        document.getElementById('cartSummaryBar').style.display = 'none';
        return;
    } else {
        // Show contact form and summary bar if cart has items
        document.getElementById('contactForm').style.display = 'block';
        document.getElementById('cartSummaryBar').style.display = 'flex';
    }

    // === CRITICAL DEBUG POINT: Before rendering ===

    // Display cart items (wrapped in try-catch for error handling)
    try {
        container.innerHTML = cart.map((item, index) => {
            // === DEBUG: Log each item being rendered ===

            // Validate item.sizes before using it
            if (!item.sizes || typeof item.sizes !== 'object') {
                console.error(`🎨 [RENDER ITEM ${index}] ❌ Invalid sizes:`, item.sizes);
                item.sizes = {}; // Default to empty object
            }
        // Get upcharges for this product (from API when added to cart)
        const upcharges = item.upcharges || {};
        const basePrice = parseFloat(item.price) || 0;

        // Get inventory status
        const inventoryStatus = item.inventoryStatus || 'unknown';
        const sizeAvailability = item.sizeAvailability || {};

        // Sort sizes in natural order
        const sortedSizes = sortSizesByOrder(item.sizes);

        // Calculate total with size-specific pricing
        let itemTotal = 0;
        const sizesDisplay = sortedSizes
            .map(size => {
                const qty = item.sizes[size];
                const upcharge = upcharges[size] || 0;
                // For free samples, price is always $0 regardless of size
                const sizePrice = (item.sampleType === 'free') ? 0 : (basePrice + upcharge);
                itemTotal += qty * sizePrice;

                // Check if this size is available
                const sizeInfo = sizeAvailability[size] || {};
                const isAvailable = sizeInfo.available !== false;
                const unavailableClass = !isAvailable ? ' size-unavailable' : '';

                return `
                    <div class="size-badge${unavailableClass}" title="${!isAvailable ? 'Out of Stock' : ''}">
                        <span class="size-info">${size} (${qty})</span>
                        <span class="size-price">$${sizePrice.toFixed(2)}</span>
                    </div>
                `;
            })
            .join('');

        const totalQty = Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);

        // Generate inventory status badge
        let inventoryBadge = '';
        if (inventoryStatus === 'in_stock') {
            inventoryBadge = '<div class="inventory-status-badge in-stock"><i class="fas fa-check-circle"></i> In Stock</div>';
        } else if (inventoryStatus === 'low_stock') {
            inventoryBadge = '<div class="inventory-status-badge low-stock"><i class="fas fa-exclamation-triangle"></i> Low Stock</div>';
        } else if (inventoryStatus === 'out_of_stock') {
            inventoryBadge = '<div class="inventory-status-badge out-of-stock"><i class="fas fa-times-circle"></i> Out of Stock</div>';
        } else if (inventoryStatus === 'unknown') {
            inventoryBadge = '<div class="inventory-status-badge checking"><i class="fas fa-clock"></i> Stock confirmed at fulfillment</div>';
        }

        // Generate size-specific warnings
        let sizeWarnings = '';
        if (item.hasWarnings) {
            const unavailableSizes = Object.entries(sizeAvailability)
                .filter(([size, info]) => info.available === false && item.sizes[size] > 0)
                .map(([size]) => size);

            if (unavailableSizes.length > 0) {
                sizeWarnings = `
                    <div class="inventory-warning error">
                        <i class="fas fa-exclamation-circle"></i>
                        <div>
                            <strong>Some sizes are unavailable:</strong>
                            ${unavailableSizes.join(', ')}
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="cart-item" data-index="${index}">
                <img src="${item.imageUrl || ''}" alt="${item.name}" class="item-image">
                <div class="item-details">
                    <h3>${item.name}</h3>
                    <div class="item-style">Style: ${item.style}</div>
                    <div class="item-color">Color: ${item.color}</div>
                    ${inventoryBadge}
                    ${sizeWarnings}
                    <div class="item-sizes">Sizes: ${sizesDisplay}</div>
                    <div class="item-price" style="margin-top: 0.5rem; font-weight: 600; color: var(--primary-color);">
                        ${totalQty} ${totalQty === 1 ? 'item' : 'items'} = $${itemTotal.toFixed(2)}
                    </div>
                </div>
                <div class="item-remove" onclick="removeItem(${index})">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        `;
        }).join('');


    } catch (error) {
        console.error('❌ [RENDER ERROR] Failed to render cart items:', error);
        console.error('❌ [RENDER ERROR] Error message:', error.message);
        console.error('❌ [RENDER ERROR] Error stack:', error.stack);
        container.innerHTML = `
            <div class="alert alert-danger" style="margin: 2rem; padding: 1.5rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 8px;">
                <h4 style="color: #991b1b; margin-bottom: 0.5rem;"><i class="fas fa-exclamation-triangle"></i> Display Error</h4>
                <p style="color: #7f1d1d; margin: 0;">Failed to render cart items. Error: ${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
                    <i class="fas fa-sync"></i> Reload Page
                </button>
            </div>
        `;
    }
}

// Remove item from cart
function removeItem(index) {
    const cart = getCartSamples();
    cart.splice(index, 1);

    // Save with nested structure
    const cartData = {
        samples: cart,
        timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('sampleCart', JSON.stringify(cartData));
    loadCart();
}

// ==============================================
// BILLING/SHIPPING ADDRESS MANAGEMENT
// ==============================================

// Copy billing address to shipping address
function copyBillingToShipping() {
    const fields = ['address1', 'address2', 'city', 'state', 'zip'];
    fields.forEach(field => {
        const billingValue = document.getElementById(`billing-${field}`).value;
        document.getElementById(`shipping-${field}`).value = billingValue;
    });
}

// Toggle shipping section visibility
document.getElementById('same-as-billing').addEventListener('change', function() {
    const shippingSection = document.getElementById('shipping-section');

    if (this.checked) {
        // Hide shipping section and copy billing data
        shippingSection.style.display = 'none';
        copyBillingToShipping();
    } else {
        // Show shipping section
        shippingSection.style.display = 'block';
    }
});

// Auto-copy billing to shipping as user types (if checkbox is checked)
['address1', 'address2', 'city', 'state', 'zip'].forEach(field => {
    document.getElementById(`billing-${field}`).addEventListener('blur', function() {
        if (document.getElementById('same-as-billing').checked) {
            copyBillingToShipping();
        }
    });
});

// Helper function to convert file to base64
async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => {
            console.error('[Sample Cart] File read error:', error);
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

// Handle form submission
document.getElementById('sampleRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // ===== VALIDATE INVENTORY BEFORE CHECKOUT =====
    const cart = getCartSamples();

    if (window.sampleInventoryService) {
        const validation = window.sampleInventoryService.validateCheckout(cart);

        if (!validation.canProceed) {
            // Show validation alert
            const alertHtml = `
                <div class="checkout-validation-alert">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div class="alert-content">
                        <h3>Cannot Complete Order</h3>
                        <p>${validation.message}</p>
                        <ul class="out-of-stock-list">
                            ${validation.outOfStockItems.map(item => `
                                <li>
                                    <i class="fas fa-times-circle"></i>
                                    ${item.name} (${item.color})
                                </li>
                            `).join('')}
                        </ul>
                        <p style="margin-top: 1rem;">Please remove out-of-stock items from your cart and try again.</p>
                    </div>
                </div>
            `;

            // Insert alert before form
            const existingAlert = document.querySelector('.checkout-validation-alert');
            if (existingAlert) {
                existingAlert.remove();
            }

            const form = document.getElementById('sampleRequestForm');
            form.insertAdjacentHTML('beforebegin', alertHtml);

            // Scroll to alert
            document.querySelector('.checkout-validation-alert').scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            console.error('[Sample Cart] ❌ Checkout blocked: Out of stock items');
            return false; // Block submission
        }

        // Show warnings if any (but allow to proceed)
        if (validation.warnings.length > 0) {
            console.warn('[Sample Cart] ⚠️ Warnings:', validation.warnings);
        }
    }

    // Ensure shipping fields are populated before submission
    const sameAsBilling = document.getElementById('same-as-billing').checked;
    if (sameAsBilling) {
        copyBillingToShipping();
    }

    const formData = new FormData(e.target);
    // cart already declared at line 1610 - reuse it
    // Get customer data from form (no splitting needed - separate fields now)
    const firstName = formData.get('firstName').trim();
    const lastName = formData.get('lastName').trim();

    // Prepare customer data for ShopWorks (with separate billing & shipping)
    const customerData = {
        firstName: firstName,
        lastName: lastName,
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company') || '',
        salesRep: formData.get('salesRep') || 'House',

        // Billing address
        billing_address1: formData.get('billing_address1'),
        billing_address2: formData.get('billing_address2') || '',
        billing_city: formData.get('billing_city'),
        billing_state: formData.get('billing_state').toUpperCase(),
        billing_zip: formData.get('billing_zip'),

        // Shipping address
        shipping_address1: formData.get('shipping_address1'),
        shipping_address2: formData.get('shipping_address2') || '',
        shipping_city: formData.get('shipping_city'),
        shipping_state: formData.get('shipping_state').toUpperCase(),
        shipping_zip: formData.get('shipping_zip'),

        shippingMethod: formData.get('shippingMethod') || 'UPS Ground',
        notes: formData.get('notes') || ''
    };

    // Pass samples with sizes object intact (service will expand into line items)
    const samplesForService = cart.map(item => ({
        style: item.style,
        name: item.name,
        color: item.color,
        catalogColor: item.catalogColor,
        sizes: item.sizes,  // Keep as object {S: 1, M: 2, L: 1} or {OSFA: 1}
        price: item.price || 0,  // Use 0 not 0.01 for consistency
        type: item.sampleType || 'free',
        upcharges: item.upcharges || {}  // Size-specific upcharges from API
    }));

    // Paid samples → Stripe hosted checkout (samples channel,
    // 2026-07-06): the server reprices everything and the webhook
    // pushes ONE ShopWorks order (paid + free lines) after payment.
    // Free-only carts continue below on the direct request flow.
    if (window.SampleCheckout && window.SampleCheckout.hasPaid(samplesForService)) {
        window.SampleCheckout.start({ customerData: customerData, samples: samplesForService, form: e.target });
        return;
    }

    // Disable submit button
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        let shopWorksOrderNumber = null;

        // Handle logo file upload (if provided)
        let logoFile = null;
        const logoInput = document.getElementById('logoUpload');
        if (logoInput.files && logoInput.files[0]) {
            const file = logoInput.files[0];

            try {
                const base64Data = await convertFileToBase64(file);
                logoFile = {
                    fileName: file.name,
                    fileData: base64Data,
                    category: 'reference',  // CHANGED: Sample orders ship BLANK (no decoration)
                    description: 'Customer reference logo (samples ship BLANK)'
                };
            } catch (error) {
                console.error('[Sample Cart] ❌ Failed to convert logo file:', error);
                // Continue without logo - don't block order submission
            }
        }

        // Send to ShopWorks
        if (window.sampleOrderService) {
            const result = await window.sampleOrderService.submitSampleOrder(
                customerData,
                samplesForService,
                logoFile
            );

            if (!result.success) {
                throw new Error(`ShopWorks submission failed: ${result.error || result.message}`);
            }

            shopWorksOrderNumber = result.orderNumber;
        }

        // Send email notification (using simple template for now)
        const emailData = {
            to_name: 'Northwest Custom Apparel',
            from_name: `${firstName} ${lastName}`,
            from_email: customerData.email,
            from_phone: customerData.phone,
            from_company: customerData.company,
            message: customerData.notes,
            order_number: shopWorksOrderNumber || 'PENDING',
            samples: cart.map(item => {
                const sizes = Object.entries(item.sizes)
                    .filter(([s, q]) => q > 0)
                    .map(([s, q]) => `${s} (${q})`)
                    .join(', ');
                return `${item.name} (${item.style}) - ${item.color} - Sizes: ${sizes}`;
            }).join('\n')
        };

        // Try to send email (don't fail if this errors)
        try {
            await emailjs.send('service_1c4k67j', 'template_sample_request', emailData);
        } catch (emailError) {
            console.warn('[Sample Cart] ⚠️ Email failed but order was created:', emailError);
        }

        // Clear cart
        sessionStorage.removeItem('sampleCart');

        // If an AE started this order from a lead, log it to that lead's timeline
        // and clear the handoff stash (no-op for real customers).
        finishSampleLeadHandoff(shopWorksOrderNumber);

        // Show success message
        document.getElementById('cartContainer').style.display = 'none';
        document.getElementById('confirmationId').textContent = shopWorksOrderNumber || 'SR-' + Date.now().toString().slice(-6);
        document.getElementById('successMessage').classList.add('show');

    } catch (error) {
        console.error('[Sample Cart] ❌ Error submitting order:', error);
        alert('There was an error submitting your order. Please try again or call us at 253-922-5793.\n\nError: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Sample Request';
    }
});
// Load cart on page load — EXCEPT on a Stripe success return, where
// sample-checkout.js shows the confirmation panel and the cart is already
// cleared (loadCart's back-button fix would re-show an empty cart under it)
if (new URLSearchParams(window.location.search).get('success') !== '1') {
    loadCart();
}

// --- Leads CRM handoff: an AE clicked "Order samples" on a lead, which stashed
// the lead's contact info in localStorage (cross-tab: a noopener tab can't inherit
// sessionStorage). Prefill the contact form once, from that stash. Real customers
// never have the stash, so this is a no-op for them.
var SAMPLE_LEAD_KEY = 'nwca-sample-prefill';
var SAMPLE_LEAD_TTL_MS = 2 * 60 * 60 * 1000; // 2h — an abandoned stash self-expires

function readSampleLeadStash() {
    try {
        var raw = localStorage.getItem(SAMPLE_LEAD_KEY);
        if (!raw) return null;
        var s = JSON.parse(raw);
        if (!s || (typeof s.ts === 'number' && Date.now() - s.ts > SAMPLE_LEAD_TTL_MS)) {
            localStorage.removeItem(SAMPLE_LEAD_KEY);
            return null;
        }
        return s;
    } catch (e) { return null; }
}

function applySampleLeadPrefill() {
    var s = readSampleLeadStash();
    if (!s) return;
    // element.value only — lead fields are attacker-controlled (public forms).
    var set = function (id, val) { var el = document.getElementById(id); if (el && val) el.value = val; };
    set('fldFirstName', s.firstName);
    set('fldLastName', s.lastName);
    set('fldEmail', s.email);
    set('fldPhone', s.phone);
    set('fldCompany', s.company);
    var rep = document.getElementById('salesRep');
    if (rep && s.salesRep) {
        var ok = Array.prototype.some.call(rep.options, function (o) { return o.value === s.salesRep; });
        if (ok) rep.value = s.salesRep;
    }
}

// Fire-and-forget lead breadcrumb + clear the stash after an order is placed.
function finishSampleLeadHandoff(orderNumber) {
    var s = readSampleLeadStash();
    if (!s || !s.submissionId) return;
    try {
        fetch('/api/crm-proxy/lead-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submissionId: s.submissionId,
                activityType: 'system',
                activityText: 'Sample order ' + (orderNumber || '') + ' placed for this lead',
                createdBy: s.staffEmail || 'sample-cart',
            }),
        }).catch(function () { /* staff-only endpoint; a customer tab just 401s — ignore */ });
    } catch (e) { /* ignore */ }
    try { localStorage.removeItem(SAMPLE_LEAD_KEY); } catch (e) { /* ignore */ }
}
window.finishSampleLeadHandoff = finishSampleLeadHandoff; // sample-checkout.js calls it on the Stripe return

applySampleLeadPrefill();

// ── 2026 chrome: drawer + masthead search ─────────────────────────────
(function wireChrome() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    function setDrawer(open) {
if (!sidebar || !overlay) return;
sidebar.classList.toggle('show', open);
overlay.classList.toggle('show', open);
document.body.classList.toggle('drawer-open', open);
    }
    const openBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('drawerClose');
    if (openBtn) openBtn.addEventListener('click', () => setDrawer(true));
    if (closeBtn) closeBtn.addEventListener('click', () => setDrawer(false));
    if (overlay) overlay.addEventListener('click', () => setDrawer(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });

    const input = document.getElementById('navSearchInput');
    const btn = document.getElementById('navSearchBtn');
    function goSearch() {
const term = (input && input.value || '').trim();
if (term) window.location.href = '/catalog?q=' + encodeURIComponent(term);
    }
    if (btn) btn.addEventListener('click', goSearch);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') goSearch(); });
})();

// Rendered cart rows use inline onclick — keep the handler global
window.removeItem = removeItem;
