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
     * Non-business days (US federal holidays + factory closure days)
     * Factory is closed December 26-31 annually
     * Update annually at year-end to add next year's holidays
     */
    static NON_BUSINESS_DAYS = [
        // 2025 US Federal Holidays
        '2025-01-01', // New Year's Day
        '2025-01-20', // Martin Luther King Jr. Day
        '2025-02-17', // Presidents' Day
        '2025-05-26', // Memorial Day
        '2025-06-19', // Juneteenth
        '2025-07-04', // Independence Day
        '2025-09-01', // Labor Day
        '2025-10-13', // Columbus Day
        '2025-11-11', // Veterans Day
        '2025-11-27', // Thanksgiving
        '2025-12-25', // Christmas

        // 2025 Factory Closure (Dec 26-31)
        '2025-12-26', '2025-12-27', '2025-12-28',
        '2025-12-29', '2025-12-30', '2025-12-31',

        // 2026 US Federal Holidays
        '2026-01-01', // New Year's Day
        '2026-01-19', // Martin Luther King Jr. Day
        '2026-02-16', // Presidents' Day
        '2026-05-25', // Memorial Day
        '2026-06-19', // Juneteenth
        '2026-07-03', // Independence Day (observed)
        '2026-09-07', // Labor Day
        '2026-10-12', // Columbus Day
        '2026-11-11', // Veterans Day
        '2026-11-26', // Thanksgiving
        '2026-12-25', // Christmas

        // 2026 Factory Closure (Dec 26-31)
        '2026-12-26', '2026-12-27', '2026-12-28',
        '2026-12-29', '2026-12-30', '2026-12-31',

        // 2027 US Federal Holidays
        '2027-01-01', // New Year's Day
        '2027-01-18', // Martin Luther King Jr. Day
        '2027-02-15', // Presidents' Day
        '2027-05-31', // Memorial Day
        '2027-06-18', // Juneteenth (observed)
        '2027-07-05', // Independence Day (observed)
        '2027-09-06', // Labor Day
        '2027-10-11', // Columbus Day
        '2027-11-11', // Veterans Day
        '2027-11-25', // Thanksgiving
        '2027-12-24', // Christmas (observed)

        // 2027 Factory Closure (Dec 26-31)
        '2027-12-26', '2027-12-27', '2027-12-28',
        '2027-12-29', '2027-12-30', '2027-12-31'
    ];

    /**
     * Check if current time is before 9 AM PST cutoff
     * @returns {boolean} True if before 9 AM PST
     */
    isBeforeCutoff() {
        const now = new Date();
        const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        return pstTime.getHours() < 9;
    }

    /**
     * Get order date based on 9 AM PST cutoff
     * Orders placed after 9 AM count as next business day
     * Production clock starts on next business day (skips weekends/holidays)
     * @returns {string} Order date in YYYY-MM-DD format
     */
    getOrderDate() {
        const now = new Date();
        if (!this.isBeforeCutoff()) {
            // After 9 AM - order counts as tomorrow
            now.setDate(now.getDate() + 1);
        }

        // Advance to next business day if on weekend or holiday
        // Production clock only starts Monday-Friday, non-holidays
        while (now.getDay() === 0 || now.getDay() === 6 || this.isHoliday(now)) {
            now.setDate(now.getDate() + 1);
        }

        return now.toISOString().split('T')[0];
    }

    /**
     * Check if a date is a non-business day (US federal holiday or factory closure)
     * @param {Date} date - Date to check
     * @returns {boolean} True if date is a non-business day
     */
    isHoliday(date) {
        const dateStr = date.toISOString().split('T')[0];
        return ThreeDayTeesOrderService.NON_BUSINESS_DAYS.includes(dateStr);
    }

    /**
     * Calculate ship date (3 business days from order date)
     * Skips weekends (Sat/Sun), US federal holidays, and factory closures (Dec 26-31)
     * @param {string} orderDate - Order date in YYYY-MM-DD format
     * @returns {string} Ship date in YYYY-MM-DD format
     */
    calculateShipDate(orderDate) {
        const date = new Date(orderDate);
        let businessDaysAdded = 0;

        while (businessDaysAdded < 3) {
            date.setDate(date.getDate() + 1);
            const dayOfWeek = date.getDay();

            // Skip weekends (0 = Sunday, 6 = Saturday)
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Skip holidays
            const isHolidayDate = this.isHoliday(date);

            // Only count if it's a business day
            if (!isWeekend && !isHolidayDate) {
                businessDaysAdded++;
            }
        }

        return date.toISOString().split('T')[0];
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
     * @param {Number} orderTotal - Frontend's calculated grand total (used for both Stripe and ShopWorks)
     * @param {Number} salesTax - Frontend's calculated sales tax
     * @param {Number} shippingCost - Frontend's calculated shipping cost
     * @returns {Promise<Object>} Result with success status and order number
     */
    async submitOrder(customerData, colorConfigs, orderSettings, orderTotal, salesTax, shippingCost) {
        try {
            console.log('[DEBUG E] submitOrder called with shippingCost:', shippingCost, 'Type:', typeof shippingCost);
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

                    // Use unitPrice (includes rush fee + upcharge) - matches frontend's final price
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

            // Add LTM (Less Than Minimum) fee if applicable (6-23 pieces)
            if (orderSettings.ltmFee && orderSettings.ltmFee > 0) {
                lineItems.push({
                    partNumber: 'LTM-75',
                    description: 'Less Than Minimum $75.00',
                    color: '',
                    size: '',
                    quantity: 1,
                    price: orderSettings.ltmFee,
                    notes: '',  // No notes per user requirement
                    // Metadata for ManageOrders transformation
                    productClass: 10,  // Fee item (id_ProductClass: 10), not product (id_ProductClass: 1)
                    useSizeColumn: true  // Put quantity in Size01 column instead of regular size breakdown
                });
            }

            console.log('[3DTOrderService] Generated line items:', lineItems);
            console.log('[3DTOrderService] Total quantity:', grandTotalQuantity);

            // Calculate subtotal from line items (for ShopWorks line item total)
            // Line items now use unitPrice which already includes rush fee + upcharges
            const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

            // Use frontend's grand total (single source of truth)
            // This is the SAME total that Stripe charged - no redundant calculations
            console.log('[3DTOrderService] Using frontend\'s calculated total:', {
                subtotal: subtotal.toFixed(2),
                grandTotal: orderTotal.toFixed(2),
                note: 'Grand total from frontend (includes rush fee, LTM, tax, shipping)'
            });

            // Calculate order date (respects 9 AM PST cutoff)
            const orderDate = this.getOrderDate();

            // Calculate ship date (3 business days, skip weekends/holidays)
            const shipDate = this.calculateShipDate(orderDate);

            console.log('[3DTOrderService] Order date:', orderDate);
            console.log('[3DTOrderService] Ship date:', shipDate);

            // Build ManageOrders order object
            const orderData = {
                orderNumber: orderNumber,
                orderDate: orderDate,
                requestedShipDate: shipDate,  // Ship date field for ShopWorks
                dateNeeded: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                salesRep: 'Erik Mickelson',
                terms: 'Prepaid', // Payment made via Stripe
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
                designs: [{
                    name: orderNumber, // Use order number as design name
                    externalId: `DESIGN-${orderNumber}`, // Format: DESIGN-3DT0115-1
                    designTypeId: 45, // DTG design type (proxy expects designTypeId not designType)
                    artist: 224, // Artist ID
                    productColor: Object.keys(orderSettings.colorConfigs).join(', '), // All t-shirt colors (proxy expects productColor not forProductColor)
                    locations: this.buildDesignLocations(orderNumber, orderSettings.colorConfigs, orderSettings)
                }],
                notes: [{
                    type: 'Notes On Order',
                    text: `3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval. ${customerData.notes || ''} Total: $${orderTotal.toFixed(2)} (includes sales tax 10.1%)`
                }],
                // Payments block - Stripe payment data
                payments: orderSettings.paymentData ? [{
                    date: orderSettings.paymentData.paymentDate, // YYYY-MM-DD format
                    accountNumber: orderSettings.paymentData.paymentId, // Full Stripe payment ID
                    amount: orderSettings.paymentData.amount, // Dollars (converted from cents)
                    authCode: orderSettings.paymentData.paymentId, // Same as account number
                    cardCompany: orderSettings.paymentData.card_brand || orderSettings.paymentData.payment_method_type || 'Stripe',
                    gateway: 'Stripe',
                    responseCode: orderSettings.paymentData.outcome?.network_status || '200',
                    responseReasonCode: orderSettings.paymentData.outcome?.seller_message || 'approved',
                    responseReasonText: orderSettings.paymentData.outcome?.reason || 'Payment successful',
                    status: orderSettings.paymentData.status, // e.g., "succeeded"
                    feeOther: 0,
                    feeProcessing: 0  // Processing fee absorbed by business, not tracked in ShopWorks
                }] : [],
                // Files: DO NOT include in ManageOrders API call
                // Files are already uploaded separately and stored with the order
                // Including base64 file data here causes JSON to exceed 1MB limit
                // Only include metadata for reference
                attachments: orderSettings.uploadedFiles ? orderSettings.uploadedFiles.map(file => ({
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                    fileType: file.fileType
                    // Exclude fileData to keep payload under 1MB limit
                })) : [],
                total: orderTotal,
                // Tax fields - ShopWorks auto-creates tax line item from these
                taxTotal: parseFloat(salesTax.toFixed(2)),
                taxPartNumber: 'Tax_10.1',
                taxPartDescription: 'City of Milton Sales Tax 10.1%',
                // Shipping - $30 UPS Ground
                cur_Shipping: shippingCost
            };
            console.log('[DEBUG F] orderData.cur_Shipping set to:', orderData.cur_Shipping, 'Type:', typeof orderData.cur_Shipping);

            let finalOrderNumber = orderNumber;
            let orderCreatedSuccessfully = false;

            // Attempt to submit order to ManageOrders API
            try {
                console.log('[3DTOrderService] Calling ManageOrders API...');
                console.log('[DEBUG G] Before API call - orderData.cur_Shipping:', orderData.cur_Shipping);
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
     * Build Designs.Locations array for front and optional back prints
     * @param {string} orderNumber - Order number (e.g., "3DT0115-1")
     * @param {Object} colorConfigs - Color configurations with size breakdowns
     * @param {Object} orderSettings - Order settings including files and location
     * @returns {Array} Locations array for Designs block
     */
    buildDesignLocations(orderNumber, colorConfigs, orderSettings) {
        const locations = [];

        // Get uploaded artwork files
        const frontArtwork = orderSettings.uploadedFiles[0] || null;
        const backArtwork = orderSettings.uploadedFiles[1] || null;

        const frontLocationCode = orderSettings.printLocationCode; // 'LC' or 'FF'
        const frontLocationName = orderSettings.printLocationName; // 'Left Chest' or 'Full Front'

        // Front location (always present)
        locations.push({
            location: `${frontLocationCode} ${frontLocationName}`, // e.g., "FF Full Front"
            code: orderNumber, // Proxy expects 'code' not 'designCode'
            imageUrl: frontArtwork ? frontArtwork.fileUrl : '', // URL from Caspio storage (proxy expects 'imageUrl' not 'imageURL')
            notes: this.buildLocationNotes(colorConfigs)
        });

        // Back location (if customer selected back print)
        if (orderSettings.hasBackPrint && backArtwork) {
            locations.push({
                location: 'FB Full Back',
                code: orderNumber, // Proxy expects 'code' not 'designCode'
                imageUrl: backArtwork.fileUrl, // URL from Caspio storage (proxy expects 'imageUrl' not 'imageURL')
                notes: this.buildLocationNotes(colorConfigs)
            });
        }

        return locations;
    }

    /**
     * Build location notes in format: "Forest Green: S(2), M(5), L(3); Navy: M(3), L(5)"
     * @param {Object} colorConfigs - Color configurations keyed by catalogColor
     * @returns {string} Formatted notes string
     */
    buildLocationNotes(colorConfigs) {
        const colorNotes = [];

        // Iterate through each color
        Object.entries(colorConfigs).forEach(([catalogColor, config]) => {
            const sizesList = [];

            // Build size list: S(2), M(5), L(3)
            Object.entries(config.sizeBreakdown).forEach(([size, sizeData]) => {
                if (sizeData.quantity > 0) {
                    sizesList.push(`${size}(${sizeData.quantity})`);
                }
            });

            // Add color note if it has sizes
            if (sizesList.length > 0) {
                colorNotes.push(`${catalogColor}: ${sizesList.join(', ')}`);
            }
        });

        // Join all colors with semicolon
        return colorNotes.join('; ');
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
