/**
 * Sample Order Service
 * Handles submission of FREE sample orders to ShopWorks via ManageOrders PUSH API
 *
 * Configuration:
 * - Customer #2791 (all web orders)
 * - Order Type: 6 (web orders)
 * - Price: $0.01 per sample (nominal)
 * - Email notifications to: erik@nwcustomapparel.com
 */
class SampleOrderService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.emailServiceId = 'service_1c4k67j';
        this.emailPublicKey = '4qSbDO-SQs19TbP80';

        // Initialize EmailJS if available
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailPublicKey);
            console.log('[SampleOrderService] EmailJS initialized');
        } else {
            console.warn('[SampleOrderService] EmailJS not available');
        }

        console.log('[SampleOrderService] Service initialized');
    }

    /**
     * Generate sample order number: SAMPLE-MMDD-sequence-milliseconds
     * Format: SAMPLE-1027-1-347 (first sample on Oct 27, at 347ms)
     * Uses localStorage for cross-tab coordination and millisecond suffix for uniqueness
     *
     * @returns {string} Order number
     */
    generateOrderNumber() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        // Daily sequence from localStorage (shared across tabs, resets each day)
        const dateKey = `${month}${day}`;
        const storageKey = `sample_order_seq_${dateKey}`;
        let sequence = parseInt(localStorage.getItem(storageKey) || '0') + 1;
        localStorage.setItem(storageKey, sequence.toString());

        // Clean up old sequences (keep only today's)
        for (let key in localStorage) {
            if (key.startsWith('sample_order_seq_') && key !== storageKey) {
                localStorage.removeItem(key);
            }
        }

        // Add millisecond timestamp suffix for uniqueness (prevents simultaneous user collisions)
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        const orderNumber = `SAMPLE-${month}${day}-${sequence}-${ms}`;
        console.log('[SampleOrderService] Generated order number:', orderNumber);

        return orderNumber;
    }

    /**
     * Expand a sample cart item into multiple line items
     * ShopWorks Size Translation Table handles size suffix conversion internally
     *
     * @param {Object} sample - Sample cart item with sizes object
     * @param {string} sample.style - Base part number (e.g., "PC54")
     * @param {string} sample.name - Product name
     * @param {string} sample.catalogColor - ShopWorks catalog color
     * @param {Object} sample.sizes - Size breakdown (e.g., {S:1, M:2, L:1, '2XL':1})
     * @param {number} sample.price - Price per sample
     * @param {string} sample.type - 'paid' or 'free'
     * @returns {Array} Array of line items, one per size
     */
    expandSampleIntoLineItems(sample) {
        const lineItems = [];
        const basePartNumber = sample.style;

        // Defensive check: Validate sizes object
        if (!sample.sizes || typeof sample.sizes !== 'object' || Array.isArray(sample.sizes)) {
            console.warn('[SampleOrderService] Sample missing valid sizes object:', {
                style: sample.style,
                name: sample.name,
                sizes: sample.sizes
            });
            return [];
        }

        console.log(`[SampleOrderService] Expanding ${basePartNumber} into line items:`, sample.sizes);

        // Each size becomes a separate line item
        Object.entries(sample.sizes || {}).forEach(([size, qty]) => {
            if (!qty || qty === 0) return;

            const lineItem = {
                partNumber: basePartNumber,       // Just "PC54" - ShopWorks handles size suffixes
                description: sample.name,
                color: sample.catalogColor,       // CRITICAL: Use CATALOG_COLOR for ShopWorks
                size: size,                       // "S", "M", "L", "XL", "2XL", etc. in separate field
                quantity: parseInt(qty),          // Actual quantity for this size
                price: parseFloat(sample.price) || 0,  // Use actual price, no hardcoded fallback
                notes: (sample.type === 'paid' && sample.price > 0)
                    ? `PAID SAMPLE - Invoice customer $${sample.price.toFixed(2)}`
                    : 'FREE SAMPLE'
            };

            console.log(`  → ${basePartNumber} (${size}): ${qty} units`);
            lineItems.push(lineItem);
        });

        console.log(`[SampleOrderService] Created ${lineItems.length} line items from ${basePartNumber}`);
        return lineItems;
    }

    /**
     * Submit sample order (wrapper for submitOrder - for sample-cart.html compatibility)
     *
     * @param {Object} customerData - Customer and shipping information
     * @param {Array} samples - Array of sample items from cart
     * @returns {Promise<Object>} Result with success/failure and order number
     */
    async submitSampleOrder(customerData, samples, logoFile = null) {
        return this.submitOrder(customerData, samples, logoFile);
    }

    /**
     * Submit sample order to ShopWorks via ManageOrders PUSH API
     *
     * @param {Object} formData - Customer and shipping information
     * @param {string} formData.firstName - Customer first name
     * @param {string} formData.lastName - Customer last name
     * @param {string} formData.email - Customer email
     * @param {string} formData.phone - Customer phone
     * @param {string} formData.company - Company name (optional)
     * @param {string} formData.address1 - Street address
     * @param {string} formData.address2 - Apt/Suite (optional)
     * @param {string} formData.city - City
     * @param {string} formData.state - State (2-letter code)
     * @param {string} formData.zip - ZIP code (5 digits)
     *
     * @param {Array} samples - Array of sample items from cart
     * @param {string} samples[].style - Product style number (e.g., "PC54")
     * @param {string} samples[].name - Product name
     * @param {string} samples[].color - Display color name (for email)
     * @param {string} samples[].catalogColor - ShopWorks catalog color (CRITICAL!)
     * @param {string} samples[].size - Selected size or "OSFA"
     * @param {number} samples[].price - Sample price (0 for free, >0 for paid)
     * @param {string} samples[].type - 'free' or 'paid'
     *
     * @param {Object} logoFile - Optional logo/artwork file (base64 encoded)
     * @param {string} logoFile.fileName - Name of the file
     * @param {string} logoFile.fileData - Base64-encoded file data (data:image/png;base64,...)
     * @param {string} logoFile.category - File category (e.g., 'artwork')
     * @param {string} logoFile.description - File description
     *
     * @returns {Promise<Object>} Result with success/failure and order number
     */
    async submitOrder(formData, samples, logoFile = null) {
        try {
            const orderNumber = this.generateOrderNumber();

            console.log('[SampleOrderService] Submitting order:', orderNumber);
            console.log('[SampleOrderService] Customer:', formData.firstName, formData.lastName);
            console.log('[SampleOrderService] Samples:', samples.length);

            // Log sample details for debugging
            samples.forEach((sample, index) => {
                console.log(`[SampleOrderService] Sample ${index + 1}:`, {
                    style: sample.style,
                    name: sample.name,
                    color: sample.color,
                    catalogColor: sample.catalogColor,
                    size: sample.size,
                    price: sample.price,
                    type: sample.type
                });
            });

            // Calculate FREE vs PAID totals
            const freeItems = samples.filter(s => (s.type === 'free' || !s.type));
            const paidItems = samples.filter(s => s.type === 'paid');
            const subtotal = paidItems.reduce((sum, item) => {
                // Sum all size quantities for this sample
                const totalQty = Object.values(item.sizes || {}).reduce((qtySum, qty) => qtySum + (parseInt(qty) || 0), 0);
                // Multiply total quantity by price per piece
                return sum + (totalQty * (item.price || 0));
            }, 0);

            // Calculate Washington State Sales Tax (10.1%)
            const salesTaxRate = 0.101;
            const salesTax = subtotal * salesTaxRate;
            const total = subtotal + salesTax;

            console.log('[SampleOrderService] Order breakdown:', {
                freeItems: freeItems.length,
                paidItems: paidItems.length,
                subtotal: subtotal.toFixed(2),
                salesTax: salesTax.toFixed(2),
                total: total.toFixed(2)
            });

            // Expand each sample into multiple line items (one per size with proper suffixes)
            const lineItems = samples.flatMap(sample => this.expandSampleIntoLineItems(sample));

            // Add sales tax as a line item (required for ShopWorks "Split Tax Line" integration)
            // This ensures tax automatically displays in OnSite without manual customer re-selection
            if (salesTax > 0) {
                lineItems.push({
                    partNumber: 'Tax_10.1',                      // Must match ShopWorks "Tax Line Item" config
                    description: 'City of Milton Sales Tax 10.1%', // Must match ShopWorks config
                    color: '',
                    size: null,                                  // No size for tax line item
                    quantity: 1,
                    price: parseFloat(salesTax.toFixed(2)),     // Tax amount as unit price
                    notes: `Sales Tax (${(salesTaxRate * 100).toFixed(1)}%)`  // Helpful note showing tax rate
                });

                console.log('[SampleOrderService] ✅ Added tax line item:', {
                    partNumber: 'Tax_10.1',
                    description: 'City of Milton Sales Tax 10.1%',
                    price: salesTax.toFixed(2),
                    rate: `${(salesTaxRate * 100).toFixed(1)}%`
                });
            }

            // CRITICAL VALIDATION: Ensure we have at least one line item before sending to API
            if (lineItems.length === 0) {
                console.error('[SampleOrderService] No valid line items generated. Samples:', samples);
                throw new Error('No valid items in cart. Each sample must have at least one size with quantity > 0. Please check your cart and try again.');
            }

            console.log('[SampleOrderService] Generated line items:', {
                count: lineItems.length,
                items: lineItems.map(item => `${item.partNumber} ${item.size} x${item.quantity}`)
            });

            // Build ManageOrders order object
            const order = {
                orderNumber: orderNumber,
                orderDate: new Date().toISOString().split('T')[0],
                isTest: false,  // Production mode (change to true for testing)

                // Order-level fields for ShopWorks invoice
                purchaseOrderNumber: orderNumber,  // Already includes SAMPLE- prefix from generateOrderNumber()
                salesRep: formData.salesRep || 'House',  // Dynamic from dropdown, defaults to House
                terms: subtotal > 0 ? 'Prepaid' : 'FREE SAMPLE',  // Payment terms (not invoice amount)

                // Note: Sales tax is handled via line item (Tax_10.1) to prevent duplicate tax lines
                // ShopWorks "Split Tax Line" mode automatically posts tax to GL Account 2200.101
                // Tax amount displays correctly without requiring manual customer refresh

                customer: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    company: formData.company || ''
                },

                // Billing address (separate from shipping for proper invoicing)
                billing: {
                    company: formData.billing_company || formData.company || `${(formData.firstName || '').trim()} ${(formData.lastName || '').trim()}`.trim(),
                    address1: formData.billing_address1,
                    address2: formData.billing_address2 || '',
                    city: formData.billing_city,
                    state: formData.billing_state,
                    zip: formData.billing_zip,
                    country: 'USA'
                },

                // Shipping address (can be same as billing or different)
                shipping: {
                    company: formData.shipping_company || formData.company || `${(formData.firstName || '').trim()} ${(formData.lastName || '').trim()}`.trim(),
                    address1: formData.shipping_address1,
                    address2: formData.shipping_address2 || '',
                    city: formData.shipping_city,
                    state: formData.shipping_state,
                    zip: formData.shipping_zip,
                    country: formData.country || 'USA',
                    method: formData.shippingMethod || 'UPS Ground'  // Shows in Ship Method field
                },

                // Use pre-validated lineItems array
                lineItems: lineItems,

                // Build notes array - user notes FIRST, then order summary
                notes: [
                    // User notes FIRST (conditionally added with "Note From Customer:" prefix)
                    ...(formData.notes && formData.notes.trim().length > 0
                        ? [{
                            type: 'Notes On Order',
                            text: `Note From Customer:\n${formData.notes.trim()}`
                        }]
                        : []
                    ),
                    // Order summary SECOND (always added)
                    {
                        type: 'Notes On Order',
                        text: subtotal > 0
                            ? `MIXED ORDER - ${paidItems.length} PAID ($${subtotal.toFixed(2)} + $${salesTax.toFixed(2)} tax = $${total.toFixed(2)}) + ${freeItems.length} FREE - ${formData.company || formData.lastName}`
                            : `FREE SAMPLE - Top Sellers Showcase - ${formData.company || formData.lastName}`
                    }
                ]
            };

            // Add files array if logo was uploaded
            if (logoFile) {
                order.files = [logoFile];
                console.log('[SampleOrderService] Logo file included:', logoFile.fileName);
            }

            console.log('[SampleOrderService] Order payload:', order);

            // Log line items specifically to verify color data
            console.log('[SampleOrderService] Line items being sent:');
            order.lineItems.forEach((item, index) => {
                console.log(`  Item ${index + 1}: ${item.partNumber} - Color: "${item.color}" - Size: ${item.size}`);
            });

            // DEBUG: Enhanced payload display with formatted output
            console.group('🚀 [ManageOrders PUSH] Complete Payload');
            console.log('%c Order Number:', 'font-weight: bold; color: #2196F3', order.orderNumber);
            console.log('%c Customer:', 'font-weight: bold; color: #4CAF50', order.customer);
            console.log('%c Shipping:', 'font-weight: bold; color: #FF9800', order.shipping);
            console.log('%c Line Items:', 'font-weight: bold; color: #9C27B0', order.lineItems.length);
            console.table(order.lineItems.map((item, i) => ({
                Line: i + 1,
                Part: item.partNumber,
                Description: item.description,
                Color: item.color,
                Size: item.size,
                Qty: item.quantity,
                Price: `$${item.price.toFixed(2)}`,
                Type: item.notes
            })));
            console.log('%c Full JSON:', 'font-weight: bold; color: #00BCD4');
            console.log(JSON.stringify(order, null, 2));
            console.groupEnd();

            // Submit to ManageOrders PUSH API
            const response = await fetch(`${this.apiBase}/api/manageorders/orders/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(order)
            });

            console.log('[SampleOrderService] API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SampleOrderService] API error:', errorText);
                throw new Error(`Order submission failed (${response.status}): ${errorText}`);
            }

            const result = await response.json();

            console.log('[SampleOrderService] Order created successfully:', result);

            // DEBUG: Log API response
            console.group('📨 [ManageOrders API] Response');
            console.log('Status:', response.status, response.statusText);
            console.log('Headers:', Object.fromEntries(response.headers.entries()));
            console.log('Body:', JSON.stringify(result, null, 2));
            console.groupEnd();

            // Send email notification to Erik
            await this.sendEmailNotification(result.extOrderId || orderNumber, formData, samples);

            return {
                success: true,
                orderNumber: result.extOrderId || orderNumber,
                message: 'Sample order submitted successfully'
            };

        } catch (error) {
            console.error('[SampleOrderService] Error submitting order:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to submit order. Please try again or call 253-922-5793.'
            };
        }
    }

    /**
     * Send email notification to Erik about new sample order
     * Simplified: Just order number + "Check ShopWorks" (single source of truth)
     *
     * @param {string} orderNumber - ShopWorks order number
     * @param {Object} customerData - Customer information
     * @param {Array} samples - Sample items (not included in email - check ShopWorks)
     */
    async sendEmailNotification(orderNumber, customerData, samples) {
        try {
            console.log('[SampleOrderService] Sending email notification to Erik');

            // Simplified email: Order number + directive to check ShopWorks
            // ShopWorks is single source of truth for all order details
            const emailData = {
                to_email: 'erik@nwcustomapparel.com',
                to_name: 'Erik',
                subject: `Sample Order ${orderNumber} - ${customerData.company || customerData.lastName}`,
                order_number: orderNumber,
                company: customerData.company || customerData.lastName,
                message: 'A new sample order has been submitted. View complete order details, line items, and shipping information in ShopWorks OnSite.',
                order_date: new Date().toLocaleDateString()
            };

            // Using template_wjxuice (Sample-Order-API)
            await emailjs.send(
                this.emailServiceId,
                'template_wjxuice',
                emailData
            );

            console.log('[SampleOrderService] Email sent successfully');

        } catch (error) {
            console.error('[SampleOrderService] Email error:', error);
            // Don't fail the order if email fails - order is more important
        }
    }
}

// Initialize service on page load
if (typeof window !== 'undefined') {
    window.sampleOrderService = new SampleOrderService();
    console.log('[SampleOrderService] Service globally available as window.sampleOrderService');
}
