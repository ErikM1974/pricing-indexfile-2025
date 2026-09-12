// Breast Cancer Awareness Bundle Service
// Handles quote generation, database saving, and email notifications

class BreastCancerBundleService {
    constructor() {
        this.apiBase = window.APP_CONFIG.API.BASE_URL + '/api';
        this.savedOrders = new Map();
        this.emailjsServiceId = window.APP_CONFIG.EMAIL.SERVICE_ID;
        this.emailjsTemplateId = 'template_2rlgjio'; // BCA Bundle Customer template
        this.emailjsSalesTemplateId = 'template_af6h6kh'; // BCA Bundle Sales Team template
        this.emailjsPublicKey = window.APP_CONFIG.EMAIL.PUBLIC_KEY;
        this.quotePrefix = 'BCA';
    }

    // Generate unique quote ID
    generateQuoteID() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000);
        const sequence = String(random).padStart(4, '0');
        return `${this.quotePrefix}${month}${day}-${sequence}`;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    }

    // Process the complete order
    async processOrder(orderData) {
        if (this.processing) return this.processing;
        const data = JSON.parse(JSON.stringify(orderData)),
            signature = JSON.stringify(data);
        const validation = this.validateOrder(data);
        if (!validation.valid) return { success: false, message: validation.errors.join(' ') };
        if (!this.attempt || this.attempt.signature !== signature || this.attempt.complete)
            this.attempt = {
                quoteId: this.generateQuoteID(),
                signature,
                customer: false,
                sales: false,
                complete: false,
            };
        const attempt = this.attempt;
        this.processing = (async () => {
            try {
                await this.saveToDatabase(attempt.quoteId, data);
                if (!attempt.customer)
                    try {
                        await this.sendCustomerEmail(attempt.quoteId, data);
                        attempt.customer = true;
                    } catch {
                        /* Returned as an explicit partial result below. */
                    }
                if (!attempt.sales)
                    try {
                        await this.sendSalesTeamEmail(attempt.quoteId, data);
                        attempt.sales = true;
                    } catch {
                        /* Returned as an explicit partial result below. */
                    }
                attempt.complete = attempt.customer && attempt.sales;
                return {
                    success: true,
                    quoteId: attempt.quoteId,
                    customerEmailSent: attempt.customer,
                    salesEmailSent: attempt.sales,
                };
            } catch (error) {
                return { success: false, quoteId: attempt.quoteId, message: error.message };
            }
        })();
        try {
            return await this.processing;
        } finally {
            this.processing = null;
        }
    }

    // Save to database
    async saveToDatabase(quoteId, orderData) {
        let saved = this.savedOrders.get(quoteId);
        const signature = JSON.stringify(orderData);
        if (saved && saved.signature !== signature)
            throw new Error('This order reference belongs to different details.');
        if (!saved) {
            saved = { signature, session: false, items: new Set() };
            this.savedOrders.set(quoteId, saved);
        }
        // Calculate expiration date (30 days from now)
        const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

        // Prepare quote session data - match the actual database schema
        const sessionData = {
            SessionID: quoteId,
            QuoteID: quoteId,
            CustomerName: orderData.customerName || 'Walk-in Customer',
            CustomerEmail: orderData.email || '',
            CompanyName: orderData.companyName || '',
            Phone: orderData.phone || '',
            TotalQuantity: orderData.bundleCount,
            SubtotalAmount: orderData.totalAmount,
            LTMFeeTotal: 0,
            TotalAmount: orderData.totalAmount,
            Status: 'Sample Request',
            ExpiresAt: formattedExpiresAt,
            Notes: this.formatNotes(orderData),
            // Add shipping address fields if they exist in the schema
            ShippingAddress:
                orderData.deliveryMethod === 'Ship'
                    ? `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`
                    : '',
            DeliveryMethod: orderData.deliveryMethod || 'Ship',
        };

        saved.sessionData ||= sessionData;
        if (!saved.session) {
            const response = await fetch(this.apiBase + '/quote_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saved.sessionData),
            });
            if (!response.ok) throw new Error('Your order could not be saved. Please try again.');
            saved.session = true;
        }
        for (const item of this.prepareLineItems(quoteId, orderData)) {
            if (saved.items.has(item.LineNumber)) continue;
            const response = await fetch(this.apiBase + '/quote_items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
            if (!response.ok)
                throw new Error(
                    'Order ' + quoteId + ' is incomplete. Retry to finish saving its items.'
                );
            saved.items.add(item.LineNumber);
        }
        return { success: true };
    }

    // Prepare line items for database
    prepareLineItems(quoteId, orderData) {
        const items = [];
        const pricePerBundle = 45;
        let lineNumber = 1;

        // Build size breakdown for reference
        const sizeBreakdown = {};
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        sizes.forEach((size) => {
            const quantity = orderData.sizeDistribution[size] || 0;
            if (quantity > 0) {
                sizeBreakdown[size] = quantity;
            }
        });

        // Create individual line items for each bundle to match expected "9 samples" pattern

        for (let i = 1; i <= orderData.bundleCount; i++) {
            // Determine which size this bundle belongs to
            let currentSize = 'N/A';
            let bundleCounter = 0;

            for (const size of sizes) {
                const sizeQty = orderData.sizeDistribution[size] || 0;
                bundleCounter += sizeQty;
                if (i <= bundleCounter) {
                    currentSize = size;
                    break;
                }
            }

            const itemData = {
                QuoteID: quoteId,
                LineNumber: lineNumber++,
                StyleNumber: 'BCA-BUNDLE',
                ProductName: `Breast Cancer Awareness Bundle - Size ${currentSize}`,
                Quantity: 1,
                FinalUnitPrice: pricePerBundle,
                LineTotal: pricePerBundle,

                // Customer info (matching Christmas bundle pattern)
                First: orderData.customerName ? orderData.customerName.split(' ')[0] : '',
                Last: orderData.customerName
                    ? orderData.customerName.split(' ').slice(1).join(' ')
                    : '',
                Email: orderData.email || '',
                Phone: orderData.phone || '',
                Company: orderData.companyName || '',

                // Bundle details
                EmbellishmentType: 'bundle',
                PrintLocation: 'Bundle Package',
                Color: 'Candy Pink',
                ColorCode: 'PINK',
                SizeBreakdown: i === 1 ? JSON.stringify(sizeBreakdown) : '', // Only store on first item
                Image_Upload: orderData.imageUpload || '', // Logo reference - matches Christmas Bundle field name

                // Design choice fields
                DesignChoice: orderData.designChoice || 'No Flag', // Store "Flag" or "No Flag"
                DesignImageURL: orderData.designImageURL || '', // Store the design image URL

                // Delivery info
                DeliveryMethod: orderData.deliveryMethod || 'Ship',
                Shipping_Address: orderData.address || '',
                Shipping_City: orderData.city || '',
                Shipping_State: orderData.state || '',
                Shipping_Zip: orderData.zip || '',

                // Notes about bundle contents, design choice, and special instructions (only on first item)
                Notes:
                    i === 1
                        ? orderData.notes
                            ? `Bundle contains: 1 PC54 Candy Pink T-Shirt (${orderData.designChoice || 'No Flag'} design), 1 C112 True Pink/White Cap. Total: ${orderData.bundleCount} bundles. Special Instructions: ${orderData.notes}`
                            : `Bundle contains: 1 PC54 Candy Pink T-Shirt (${orderData.designChoice || 'No Flag'} design), 1 C112 True Pink/White Cap. Total: ${orderData.bundleCount} bundles.`
                        : `Bundle ${i} of ${orderData.bundleCount}`,
            };

            items.push(itemData);
        }

        return items;
    }

    // Format notes for database - simplified single-line format
    formatNotes(orderData) {
        const noteParts = [];

        // Add bundle count
        noteParts.push(`BCA Bundle: ${orderData.bundleCount} bundles`);

        // Add delivery method
        if (orderData.deliveryMethod === 'Pickup') {
            noteParts.push('Factory Pickup');
        } else {
            noteParts.push('Ship to Address');
        }

        // Add size breakdown in compact format
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        const sizeInfo = [];
        sizes.forEach((size) => {
            const quantity = orderData.sizeDistribution[size] || 0;
            if (quantity > 0) {
                sizeInfo.push(`${size}:${quantity}`);
            }
        });
        if (sizeInfo.length > 0) {
            noteParts.push(`Sizes: ${sizeInfo.join(' ')}`);
        }

        // Add event date if provided
        if (orderData.eventDate) {
            noteParts.push(`Event: ${orderData.eventDate}`);
        }

        // Add special instructions if provided
        if (orderData.notes) {
            noteParts.push(`Instructions: ${orderData.notes}`);
        }

        // Create final notes string - keep it under 255 characters
        let notesString = noteParts.join(', ');

        // Truncate if too long (leaving room for potential database limits)
        if (notesString.length > 250) {
            notesString = notesString.substring(0, 247) + '...';
        }

        return notesString;
    }

    // Send customer email
    async sendCustomerEmail(quoteId, orderData) {
        // Format design choice for email
        const designName = orderData.designChoice === 'Flag' ? 'Patriotic Flag' : 'Classic Ribbon';
        const designDescription =
            orderData.designChoice === 'Flag'
                ? 'American flag with pink ribbon and your company logo'
                : 'Pink ribbon with your company logo';

        const templateParams = {
            to_email: orderData.email,
            customer_name: orderData.customerName,
            quote_id: quoteId,
            bundle_count: orderData.bundleCount,
            total_shirts: orderData.totalShirts,
            total_caps: orderData.totalCaps,
            total_amount: this.formatCurrency(orderData.totalAmount),
            size_breakdown: this.formatSizeBreakdown(orderData.sizeDistribution),
            design_choice: designName,
            design_description: designDescription,
            delivery_method: orderData.deliveryMethod || 'Ship',
            delivery_address:
                orderData.deliveryMethod === 'Pickup'
                    ? 'Factory Pickup - 2025 Freeman Road East, Milton, WA 98354'
                    : `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
            event_date: orderData.eventDate || 'Not specified',
            special_notes: orderData.notes || 'None',
            // EmailJS protection - provide all possible fields
            company_name: orderData.companyName || '',
            phone: orderData.phone || '',
            order_date: new Date().toLocaleDateString(),
        };

        try {
            await emailjs.send(this.emailjsServiceId, this.emailjsTemplateId, templateParams);
        } catch (error) {
            console.error('Failed to send customer email:', error);
            throw error;
        }
    }

    // Send sales team notification
    async sendSalesTeamEmail(quoteId, orderData) {
        // Format design choice for email
        const designName = orderData.designChoice === 'Flag' ? 'Patriotic Flag' : 'Classic Ribbon';
        const designDescription =
            orderData.designChoice === 'Flag'
                ? 'American flag with pink ribbon and company logo'
                : 'Pink ribbon with company logo';

        const templateParams = {
            to_email: 'sales@nwcustomapparel.com',
            quote_id: quoteId,
            customer_name: orderData.customerName,
            company_name: orderData.companyName || 'Not specified',
            customer_email: orderData.email,
            customer_phone: orderData.phone,
            bundle_count: orderData.bundleCount,
            total_amount: this.formatCurrency(orderData.totalAmount),
            size_breakdown: this.formatSizeBreakdown(orderData.sizeDistribution),
            design_choice: designName,
            design_description: designDescription,
            design_flag_status: orderData.designChoice || 'No Flag', // Send raw flag status for sales team
            delivery_method: orderData.deliveryMethod || 'Ship',
            delivery_address:
                orderData.deliveryMethod === 'Pickup'
                    ? 'Factory Pickup - 2025 Freeman Road East, Milton, WA 98354'
                    : `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
            event_date: orderData.eventDate || 'Not specified',
            special_notes: orderData.notes || 'None',
            order_date: new Date().toLocaleDateString(),
            order_time: new Date().toLocaleTimeString(),
        };

        try {
            // For now, we'll use the same template or create a separate one
            await emailjs.send(this.emailjsServiceId, this.emailjsSalesTemplateId, templateParams);
        } catch (error) {
            console.error('Failed to send sales team email:', error);
            throw error;
        }
    }

    // Format size breakdown for email
    formatSizeBreakdown(sizeDistribution) {
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        const breakdown = [];

        sizes.forEach((size) => {
            const quantity = sizeDistribution[size] || 0;
            if (quantity > 0) {
                breakdown.push(`${size}: ${quantity}`);
            }
        });

        return breakdown.join(', ');
    }

    // Validate order data
    validateOrder(orderData) {
        const errors = [];

        // Check required fields
        if (!orderData.customerName) errors.push('Customer name is required');
        if (!orderData.email) errors.push('Email is required');
        if (!orderData.phone) errors.push('Phone is required');

        // Only validate address fields if shipping
        if (orderData.deliveryMethod === 'Ship') {
            if (!orderData.address) errors.push('Address is required');
            if (!orderData.city) errors.push('City is required');
            if (!orderData.state) errors.push('State is required');
            if (!orderData.zip) errors.push('ZIP code is required');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (orderData.email && !emailRegex.test(orderData.email)) {
            errors.push('Invalid email format');
        }

        // Check minimum bundle quantity
        if (orderData.bundleCount < 8) {
            errors.push('Minimum order is 8 bundles');
        }

        // Check size distribution matches bundle count
        let totalShirts = 0;
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        sizes.forEach((size) => {
            totalShirts += orderData.sizeDistribution[size] || 0;
        });

        if (totalShirts !== orderData.bundleCount) {
            errors.push(
                `Total shirts must equal ${orderData.bundleCount} (currently ${totalShirts})`
            );
        }

        return {
            valid: errors.length === 0,
            errors: errors,
        };
    }
}

// Make available globally if needed
if (typeof window !== 'undefined') {
    window.BreastCancerBundleService = BreastCancerBundleService;
}
