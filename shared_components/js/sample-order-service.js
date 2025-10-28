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

        // Part number suffix mapping (ShopWorks format)
        // IMPORTANT: ShopWorks uses mixed conventions - Port & Co: _XXL, Jerzees: _2X
        // Copied from shopworks-guide-generator.js for consistency
        this.partNumberSuffixMap = {
            // Standard sizes: NO suffix (S, M, L, XL ONLY)
            'S': '',
            'M': '',
            'L': '',
            'XL': '',
            // Extra Small and XXL oversizes
            'XS': '_XS',
            'XXL': '_XXL',  // Port & Co uses _XXL
            // Oversizes: _2X format
            '2XL': '_2X',   // Some brands use _2X (same as XXL)
            '3XL': '_3X',
            '4XL': '_4X',
            '5XL': '_5X',
            '6XL': '_6X',
            '7XL': '_7X',
            '8XL': '_8X',
            '9XL': '_9X',
            '10XL': '_10X',
            // Tall sizes: Keep full suffix
            'LT': 'T_LT',
            'XLT': 'T_XLT',
            '2XLT': 'T_2XLT',
            '3XLT': 'T_3XLT',
            '4XLT': 'T_4XLT',
            '5XLT': 'T_5XLT',
            // Big sizes: B_ prefix
            '1XB': 'B_1XB',
            '2XB': 'B_2XB',
            '3XB': 'B_3XB',
            '4XB': 'B_4XB',
            '5XB': 'B_5XB',
            '6XB': 'B_6XB'
        };

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
     * Generate sample order number: SAMPLE-MMDD-sequence
     * Format: SAMPLE-1027-1 (first sample on Oct 27)
     *
     * @returns {string} Order number
     */
    generateOrderNumber() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        // Daily sequence from sessionStorage (resets each day)
        const dateKey = `${month}${day}`;
        const storageKey = `sample_order_seq_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        // Clean up old sequences (keep only today's)
        for (let key in sessionStorage) {
            if (key.startsWith('sample_order_seq_') && key !== storageKey) {
                sessionStorage.removeItem(key);
            }
        }

        const orderNumber = `SAMPLE-${month}${day}-${sequence}`;
        console.log('[SampleOrderService] Generated order number:', orderNumber);

        return orderNumber;
    }

    /**
     * Expand a sample cart item into multiple line items with proper part number suffixes
     * Mirrors the logic from shopworks-guide-generator.js for consistency
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

        console.log(`[SampleOrderService] Expanding ${basePartNumber} into line items:`, sample.sizes);

        // Each size becomes a separate line item
        Object.entries(sample.sizes || {}).forEach(([size, qty]) => {
            if (!qty || qty === 0) return;

            // Get suffix (empty string for standard sizes S/M/L/XL, _2X for oversizes)
            const suffix = this.partNumberSuffixMap[size] || `_${size}`;
            const partNumber = `${basePartNumber}${suffix}`;

            const lineItem = {
                partNumber: partNumber,           // "PC54" or "PC54_2X" or "PC54_3X"
                description: sample.name,
                color: sample.catalogColor,       // CRITICAL: Use CATALOG_COLOR for ShopWorks
                size: size,                       // "S", "M", "L", "XL", "2XL", etc.
                quantity: parseInt(qty),          // Actual quantity for this size
                price: sample.price || 0.01,      // Nominal price or actual paid price
                notes: (sample.type === 'paid' && sample.price > 0)
                    ? `PAID SAMPLE - Invoice customer $${sample.price.toFixed(2)}`
                    : 'FREE SAMPLE'
            };

            console.log(`  → ${partNumber} (${size}): ${qty} units`);
            lineItems.push(lineItem);
        });

        console.log(`[SampleOrderService] Created ${lineItems.length} line items from ${basePartNumber}`);
        return lineItems;
    }

    /**
     * Submit sample order (wrapper for submitOrder - for checkout-review.html compatibility)
     *
     * @param {Object} customerData - Customer and shipping information
     * @param {Array} samples - Array of sample items from cart
     * @returns {Promise<Object>} Result with success/failure and order number
     */
    async submitSampleOrder(customerData, samples) {
        return this.submitOrder(customerData, samples);
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
     * @returns {Promise<Object>} Result with success/failure and order number
     */
    async submitOrder(formData, samples) {
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
            const totalPaid = paidItems.reduce((sum, item) => sum + (item.price || 0), 0);

            console.log('[SampleOrderService] Order breakdown:', {
                freeItems: freeItems.length,
                paidItems: paidItems.length,
                totalPaid: totalPaid.toFixed(2)
            });

            // Build ManageOrders order object
            const order = {
                orderNumber: orderNumber,
                orderDate: new Date().toISOString().split('T')[0],
                isTest: false,  // Production mode (change to true for testing)

                // Order-level fields for ShopWorks invoice
                purchaseOrderNumber: `SAMPLE-${orderNumber}`,  // Shows in PO Number field
                salesRep: 'Erik Mickelson',                    // Shows in Salesperson field
                terms: totalPaid > 0
                    ? `MIXED ORDER - Invoice $${totalPaid.toFixed(2)}`
                    : 'FREE SAMPLE',                           // Shows in Terms field

                customer: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    company: formData.company || ''
                },

                shipping: {
                    company: formData.company || `${formData.firstName} ${formData.lastName}`,
                    address1: formData.address1,
                    address2: formData.address2 || '',
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    country: 'USA',
                    method: 'UPS Ground'  // Shows in Ship Method field
                },

                // Expand each sample into multiple line items (one per size with proper suffixes)
                lineItems: samples.flatMap(sample => this.expandSampleIntoLineItems(sample)),

                notes: [{
                    type: 'Notes On Order',
                    text: totalPaid > 0
                        ? `MIXED ORDER - ${paidItems.length} PAID ($${totalPaid.toFixed(2)}) + ${freeItems.length} FREE - ${formData.company || formData.lastName}`
                        : `FREE SAMPLE - Top Sellers Showcase - ${formData.company || formData.lastName}`
                }]
            };

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
     *
     * @param {string} orderNumber - ShopWorks order number
     * @param {Object} customerData - Customer information
     * @param {Array} samples - Sample items ordered
     */
    async sendEmailNotification(orderNumber, customerData, samples) {
        try {
            console.log('[SampleOrderService] Sending email notification to Erik');

            // Format samples list for email
            const samplesList = samples.map(s =>
                `${s.name}\n  Color: ${s.color}\n  Size: ${s.size}`
            ).join('\n\n');

            const emailData = {
                to_email: 'erik@nwcustomapparel.com',
                to_name: 'Erik',
                subject: `New Sample Order - ${customerData.company || customerData.lastName}`,
                order_number: orderNumber,
                customer_name: `${customerData.firstName} ${customerData.lastName}`,
                company: customerData.company || 'Individual',
                email: customerData.email,
                phone: customerData.phone,
                shipping_address: `${customerData.address1}${customerData.address2 ? ', ' + customerData.address2 : ''}, ${customerData.city}, ${customerData.state} ${customerData.zip}`,
                samples_list: samplesList,
                sample_count: samples.length,
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
