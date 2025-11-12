/**
 * Three Day Tees Order Service
 * Handles order submission to ManageOrders API with multi-color support
 *
 * Features:
 * - Multi-color ordering with combined quantity pricing
 * - ManageOrders PUSH API integration
 * - Customer confirmation emails
 * - Sales team notifications
 * - File upload handling
 * - Order number generation with daily sequence
 */

class ThreeDayTeesOrderService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.emailServiceId = 'service_1c4k67j';
        this.emailPublicKey = '4qSbDO-SQs19TbP80';

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailPublicKey);
        } else {
            console.error('[3DTOrderService] EmailJS not loaded');
        }
    }

    /**
     * Generate unique order number: 3DT-MMDD-sequence-milliseconds
     * Example: 3DT-1127-1-347
     */
    generateOrderNumber() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        // Daily sequence from localStorage (resets each day)
        const dateKey = `${month}${day}`;
        const storageKey = `3dt_order_seq_${dateKey}`;
        let sequence = parseInt(localStorage.getItem(storageKey) || '0') + 1;
        localStorage.setItem(storageKey, sequence.toString());

        // Clean up old sequences (keep only today's)
        for (let key in localStorage) {
            if (key.startsWith('3dt_order_seq_') && key !== storageKey) {
                localStorage.removeItem(key);
            }
        }

        // Add millisecond timestamp suffix for uniqueness
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        const orderNumber = `3DT-${month}${day}-${sequence}-${ms}`;

        console.log('[3DTOrderService] Generated order number:', orderNumber);
        return orderNumber;
    }

    /**
     * Submit order to ManageOrders API
     *
     * @param {Object} customerData - Customer contact and shipping information
     * @param {Object} colorConfigs - Object keyed by catalogColor with size breakdowns
     * @param {Object} orderSettings - Print location, files, notes, etc.
     * @returns {Promise<Object>} Result with success status and order number
     */
    async submitOrder(customerData, colorConfigs, orderSettings) {
        try {
            console.log('[3DTOrderService] Submitting order...');
            console.log('[3DTOrderService] Customer:', customerData);
            console.log('[3DTOrderService] Colors:', Object.keys(colorConfigs));
            console.log('[3DTOrderService] Settings:', orderSettings);

            // Generate order number
            const orderNumber = this.generateOrderNumber();

            // Build line items - ONE LINE ITEM PER COLOR/SIZE COMBINATION
            const lineItems = [];
            let grandTotalQuantity = 0;

            Object.entries(colorConfigs).forEach(([catalogColor, config]) => {
                Object.entries(config.sizeBreakdown).forEach(([size, sizeData]) => {
                    const qty = sizeData.quantity;
                    if (qty === 0) return; // Skip sizes with 0 quantity

                    const price = sizeData.unitPrice;
                    grandTotalQuantity += qty;

                    lineItems.push({
                        partNumber: 'PC54',  // Base part number (always PC54, never PC54_2X)
                        description: `Port & Company Core Cotton Tee - 3-Day Rush`,
                        color: catalogColor,  // CRITICAL: Use CATALOG_COLOR for ShopWorks
                        size: size,
                        quantity: qty,
                        price: price,
                        notes: `DTG - ${orderSettings.printLocationName} - 3-Day Rush Service (+25%)`
                    });
                });
            });

            console.log('[3DTOrderService] Generated line items:', lineItems);
            console.log('[3DTOrderService] Total quantity:', grandTotalQuantity);

            // Calculate totals
            const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const ltmFee = grandTotalQuantity < 12 ? 75 : 0;
            const salesTax = (subtotal + ltmFee) * 0.101;
            const shipping = 30;
            const grandTotal = subtotal + ltmFee + salesTax + shipping;

            console.log('[3DTOrderService] Pricing:', {
                subtotal: subtotal.toFixed(2),
                ltmFee: ltmFee.toFixed(2),
                salesTax: salesTax.toFixed(2),
                shipping: shipping.toFixed(2),
                grandTotal: grandTotal.toFixed(2)
            });

            // Build ManageOrders order object
            const orderData = {
                orderNumber: orderNumber,
                orderDate: new Date().toISOString().split('T')[0],
                dateNeeded: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                salesRep: 'erik@nwcustomapparel.com',
                terms: 'Net 30',
                customer: {
                    firstName: customerData.firstName,
                    lastName: customerData.lastName,
                    email: customerData.email,
                    phone: customerData.phone,
                    company: customerData.company || ''
                },
                shipping: {
                    company: customerData.company || `${customerData.firstName} ${customerData.lastName}`,
                    address1: customerData.address1,
                    city: customerData.city,
                    state: customerData.state,
                    zip: customerData.zip,
                    country: 'USA',
                    method: 'UPS Ground'
                },
                lineItems: lineItems,
                designs: orderSettings.uploadedFiles.map(file => ({
                    name: file.name,
                    externalKey: `3dt_${orderNumber}_${file.name}`,
                    instructions: `DTG print - ${orderSettings.printLocationName}`
                })),
                notes: [{
                    type: 'Notes On Order',
                    text: `3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval. ${customerData.notes || ''} Total: $${grandTotal.toFixed(2)} (includes sales tax 10.1%)${orderSettings.paymentId ? ` | PAYMENT CONFIRMED: Stripe ${orderSettings.paymentId}` : ''}`
                }],
                total: grandTotal
            };

            let finalOrderNumber = orderNumber;
            let orderCreatedSuccessfully = false;

            // Attempt to submit order to ManageOrders API
            try {
                console.log('[3DTOrderService] Calling ManageOrders API...');
                const response = await fetch(`${this.apiBase}/api/manageorders/orders/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('[3DTOrderService] ✓ Order created in ManageOrders:', result);
                    finalOrderNumber = result.orderNumber || orderNumber;
                    orderCreatedSuccessfully = true;
                } else {
                    const errorText = await response.text();
                    console.error('[3DTOrderService] ManageOrders API error:', response.status, errorText);
                    throw new Error(`API returned ${response.status}: ${errorText}`);
                }
            } catch (apiError) {
                console.error('[3DTOrderService] ManageOrders API failed:', apiError);

                // FALLBACK: Save to quote database
                try {
                    console.log('[3DTOrderService] Attempting quote database fallback...');
                    await this.saveToQuoteDatabase(orderNumber, orderData, lineItems, grandTotalQuantity);
                    console.log('[3DTOrderService] ✓ Saved to quote database as fallback');

                    // Send error notification to admin
                    await this.sendAdminErrorEmail(orderNumber, orderData, apiError.message);
                } catch (fallbackError) {
                    console.error('[3DTOrderService] Quote database fallback also failed:', fallbackError);
                }
            }

            // Always send confirmation emails (even if API failed)
            try {
                await this.sendCustomerEmail(orderData, finalOrderNumber, colorConfigs, orderSettings);
                await this.sendSalesTeamEmail(orderData, finalOrderNumber, colorConfigs, orderSettings);
                console.log('[3DTOrderService] ✓ Confirmation emails sent');
            } catch (emailError) {
                console.error('[3DTOrderService] Email send failed:', emailError);
            }

            return {
                success: true,
                orderNumber: finalOrderNumber,
                apiSuccess: orderCreatedSuccessfully,
                warning: !orderCreatedSuccessfully ? 'Order saved to database. Manual ShopWorks entry required.' : null
            };

        } catch (error) {
            console.error('[3DTOrderService] Critical error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save order to quote database as fallback
     */
    async saveToQuoteDatabase(orderNumber, orderData, lineItems, totalQuantity) {
        // Build notes with payment ID if present
        const paymentNote = orderData.notes[0]?.text?.match(/PAYMENT CONFIRMED: Stripe (pi_\w+)/)
            ? ` Payment ID: ${orderData.notes[0].text.match(/PAYMENT CONFIRMED: Stripe (pi_\w+)/)[1]}`
            : '';

        // Save quote session
        await fetch(`${this.apiBase}/api/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                SessionID: orderNumber,
                QuoteID: orderNumber,
                DecorationType: '3-Day Tees',
                CustomerName: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
                CustomerEmail: orderData.customer.email,
                CustomerPhone: orderData.customer.phone || '',
                CompanyName: orderData.customer.company || '',
                TotalQuantity: totalQuantity,
                TotalAmount: orderData.total,
                Status: 'Active',
                Notes: `ORDER FAILED - ManageOrders API error. See quote items for details.${paymentNote}`,
                CreatedDate: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                ModifiedDate: new Date().toISOString().replace(/\.\d{3}Z$/, '')
            })
        });

        // Save line items
        for (const item of lineItems) {
            await fetch(`${this.apiBase}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    SessionID: orderNumber,
                    ItemType: 'Product',
                    StyleNumber: item.partNumber,
                    Description: item.description,
                    Color: item.color,
                    Size: item.size,
                    Quantity: item.quantity,
                    UnitPrice: item.price,
                    TotalPrice: item.price * item.quantity,
                    Notes: item.notes
                })
            });
        }
    }

    /**
     * Send error notification to admin
     */
    async sendAdminErrorEmail(orderNumber, orderData, errorMessage) {
        await emailjs.send(this.emailServiceId, 'template_sample_sales', {
            to_email: 'erik@nwcustomapparel.com',
            subject: `3-Day Tees Order Failed - ${orderNumber}`,
            order_number: orderNumber,
            customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            customer_email: orderData.customer.email,
            error_details: errorMessage,
            action_required: 'Manual entry into ShopWorks required',
            order_data: JSON.stringify(orderData, null, 2)
        });
    }

    /**
     * Send customer confirmation email
     */
    async sendCustomerEmail(orderData, orderNumber, colorConfigs, orderSettings) {
        // Build products table for email
        const productsTable = orderData.lineItems.map((item, index) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.75rem;">${item.color}</td>
                <td style="padding: 0.75rem;">${item.size}</td>
                <td style="padding: 0.75rem;">${item.quantity}</td>
                <td style="padding: 0.75rem;">$${item.price.toFixed(2)}</td>
                <td style="padding: 0.75rem;">$${(item.quantity * item.price).toFixed(2)}</td>
            </tr>
        `).join('');

        const subtotal = orderData.lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        // Extract payment ID if present
        const paymentIdMatch = orderData.notes[0]?.text?.match(/PAYMENT CONFIRMED: Stripe (pi_\w+)/);
        const paymentConfirmation = paymentIdMatch
            ? `<div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
                <strong style="color: #065f46;">✓ Payment Confirmed</strong><br>
                <span style="color: #047857; font-size: 0.875rem;">Transaction ID: ${paymentIdMatch[1]}</span>
               </div>`
            : '';

        const emailData = {
            to_email: orderData.customer.email,
            to_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            order_number: orderNumber,
            customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            customer_email: orderData.customer.email,
            customer_phone: orderData.customer.phone,
            company_name: orderData.customer.company || '',
            print_location: orderSettings.printLocationName,
            payment_confirmation: paymentConfirmation,
            products_table: `<table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                <thead>
                    <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
                        <th style="padding: 0.75rem; text-align: left;">Color</th>
                        <th style="padding: 0.75rem; text-align: left;">Size</th>
                        <th style="padding: 0.75rem; text-align: left;">Qty</th>
                        <th style="padding: 0.75rem; text-align: left;">Price</th>
                        <th style="padding: 0.75rem; text-align: left;">Total</th>
                    </tr>
                </thead>
                <tbody>${productsTable}</tbody>
            </table>`,
            subtotal: `$${subtotal.toFixed(2)}`,
            total: `$${orderData.total.toFixed(2)}`,
            company_phone: '253-922-5793',
            reply_to: 'erik@nwcustomapparel.com',
            message: orderData.notes[0]?.text || 'No special instructions'
        };

        await emailjs.send(this.emailServiceId, 'template_sample_customer', emailData);
    }

    /**
     * Send sales team notification email
     */
    async sendSalesTeamEmail(orderData, orderNumber, colorConfigs, orderSettings) {
        // Build products table for email
        const productsTable = orderData.lineItems.map((item, index) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.75rem;">${item.color}</td>
                <td style="padding: 0.75rem;">${item.size}</td>
                <td style="padding: 0.75rem;">${item.quantity}</td>
                <td style="padding: 0.75rem;">$${item.price.toFixed(2)}</td>
                <td style="padding: 0.75rem;">$${(item.quantity * item.price).toFixed(2)}</td>
            </tr>
        `).join('');

        const subtotal = orderData.lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        // Extract payment ID if present
        const paymentIdMatch = orderData.notes[0]?.text?.match(/PAYMENT CONFIRMED: Stripe (pi_\w+)/);
        const paymentStatus = paymentIdMatch
            ? `<div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
                <strong style="color: #065f46;">✓ PAYMENT RECEIVED</strong><br>
                <span style="color: #047857; font-size: 0.875rem;">Stripe Payment ID: ${paymentIdMatch[1]}</span><br>
                <span style="color: #047857; font-size: 0.875rem;">Status: Confirmed and processed</span>
               </div>`
            : `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
                <strong style="color: #92400e;">⚠ PAYMENT PENDING</strong><br>
                <span style="color: #78350f; font-size: 0.875rem;">No payment confirmation received - follow up with customer</span>
               </div>`;

        const emailData = {
            to_email: 'erik@nwcustomapparel.com',
            bcc_email: 'erik@nwcustomapparel.com',
            order_number: orderNumber,
            customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            customer_email: orderData.customer.email,
            customer_phone: orderData.customer.phone,
            company_name: orderData.customer.company || '',
            print_location: orderSettings.printLocationName,
            payment_status: paymentStatus,
            products_table: `<table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                <thead>
                    <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
                        <th style="padding: 0.75rem; text-align: left;">Color</th>
                        <th style="padding: 0.75rem; text-align: left;">Size</th>
                        <th style="padding: 0.75rem; text-align: left;">Qty</th>
                        <th style="padding: 0.75rem; text-align: left;">Price</th>
                        <th style="padding: 0.75rem; text-align: left;">Total</th>
                    </tr>
                </thead>
                <tbody>${productsTable}</tbody>
            </table>`,
            subtotal: `$${subtotal.toFixed(2)}`,
            total: `$${orderData.total.toFixed(2)}`,
            company_phone: '253-922-5793',
            message: orderData.notes[0]?.text || 'No special instructions'
        };

        await emailjs.send(this.emailServiceId, 'template_sample_sales', emailData);
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            service: 'ThreeDayTeesOrderService',
            apiBase: this.apiBase,
            emailService: this.emailServiceId,
            emailJsLoaded: typeof emailjs !== 'undefined'
        };
    }
}

// Make service globally available
if (typeof window !== 'undefined') {
    window.ThreeDayTeesOrderService = ThreeDayTeesOrderService;
}
