// Breast Cancer Awareness Bundle Service
// Handles quote generation, database saving, and email notifications

class BreastCancerBundleService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.emailjsServiceId = 'service_1c4k67j';
        // TODO: Create these templates in EmailJS
        this.emailjsTemplateId = 'template_bca_bundle_NEEDS_CREATION'; // Will need to be created
        this.emailjsSalesTemplateId = 'template_bca_sales_NEEDS_CREATION'; // Sales team notification
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.quotePrefix = 'BCA';
    }

    // Generate unique quote ID
    generateQuoteID() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000);
        const sequence = String(random).padStart(3, '0');
        return `${this.quotePrefix}${month}${day}-${sequence}`;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    // Process the complete order
    async processOrder(orderData) {
        try {
            const quoteId = this.generateQuoteID();

            // Save to database
            const saveResult = await this.saveToDatabase(quoteId, orderData);

            // Send emails (but don't fail if email fails)
            try {
                await this.sendCustomerEmail(quoteId, orderData);
                await this.sendSalesTeamEmail(quoteId, orderData);
            } catch (emailError) {
                console.error('Email failed but order saved:', emailError);
            }

            return {
                success: true,
                quoteId: quoteId,
                message: 'Order submitted successfully'
            };

        } catch (error) {
            console.error('Error processing order:', error);
            return {
                success: false,
                message: 'Failed to process order',
                error: error.message
            };
        }
    }

    // Save to database
    async saveToDatabase(quoteId, orderData) {
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
            Status: 'Active',
            ExpiresAt: formattedExpiresAt,
            Notes: this.formatNotes(orderData)
        };

        try {
            console.log('Saving quote session:', sessionData);

            // Save to quote_sessions
            const sessionResponse = await fetch(`${this.apiBase}/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('API Error Response:', errorText);
                throw new Error(`Failed to save quote session: ${errorText}`);
            }

            // Save individual items
            const items = this.prepareLineItems(quoteId, orderData);
            console.log('Attempting to save items:', items);

            for (const item of items) {
                try {
                    console.log('Saving item:', item);
                    const itemResponse = await fetch(`${this.apiBase}/quote_items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(item)
                    });

                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Failed to save item:', item);
                        console.error('Item save error response:', errorText);
                        // Parse error if it's JSON
                        try {
                            const errorJson = JSON.parse(errorText);
                            console.error('Item save error details:', errorJson);
                        } catch (e) {
                            // Not JSON, already logged as text
                        }
                    } else {
                        console.log('Item saved successfully');
                    }
                } catch (itemError) {
                    console.error('Error saving item:', itemError);
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Database save error:', error);
            throw error;
        }
    }

    // Prepare line items for database
    prepareLineItems(quoteId, orderData) {
        const items = [];
        const pricePerBundle = 45;
        let lineNumber = 1;

        // Create a single bundle item instead of individual items
        // Build size breakdown for the bundle
        const sizeBreakdown = {};
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        sizes.forEach(size => {
            const quantity = orderData.sizeDistribution[size] || 0;
            if (quantity > 0) {
                sizeBreakdown[size] = quantity;
            }
        });

        // Add bundle as a single line item
        items.push({
            QuoteID: quoteId,
            LineNumber: lineNumber++,
            StyleNumber: 'BCA-BUNDLE',
            ProductName: 'Breast Cancer Awareness Bundle',
            Quantity: orderData.bundleCount,
            FinalUnitPrice: pricePerBundle,
            LineTotal: orderData.totalAmount,

            // Customer info (matching Christmas bundle pattern)
            First: orderData.customerName ? orderData.customerName.split(' ')[0] : '',
            Last: orderData.customerName ? orderData.customerName.split(' ').slice(1).join(' ') : '',
            Email: orderData.email || '',
            Phone: orderData.phone || '',
            Company: orderData.companyName || '',

            // Bundle details
            EmbellishmentType: 'bundle',
            PrintLocation: 'Bundle Package',
            Color: 'Candy Pink',
            ColorCode: 'PINK',
            SizeBreakdown: JSON.stringify(sizeBreakdown),
            Image_Upload: orderData.imageUpload || '',  // Logo reference - matches Christmas Bundle field name

            // Delivery info
            DeliveryMethod: orderData.deliveryMethod || 'Ship',

            // Notes about bundle contents
            Notes: `Bundle contains: ${orderData.bundleCount} PC54 Candy Pink T-Shirts, ${orderData.bundleCount} C112 True Pink/White Caps`
        });

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
        sizes.forEach(size => {
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

        // Create final notes string - keep it under 255 characters
        let notesString = noteParts.join(', ');

        // Truncate if too long (leaving room for potential database limits)
        if (notesString.length > 250) {
            notesString = notesString.substring(0, 247) + '...';
        }

        console.log('Notes string being sent:', notesString);
        console.log('Notes string length:', notesString.length);

        return notesString;
    }

    // Send customer email
    async sendCustomerEmail(quoteId, orderData) {
        const templateParams = {
            to_email: orderData.email,
            customer_name: orderData.customerName,
            quote_id: quoteId,
            bundle_count: orderData.bundleCount,
            total_shirts: orderData.totalShirts,
            total_caps: orderData.totalCaps,
            total_amount: this.formatCurrency(orderData.totalAmount),
            size_breakdown: this.formatSizeBreakdown(orderData.sizeDistribution),
            delivery_method: orderData.deliveryMethod || 'Ship',
            delivery_address: orderData.deliveryMethod === 'Pickup'
                ? 'Factory Pickup - 2025 Freeman Road East, Milton, WA 98354'
                : `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
            event_date: orderData.eventDate || 'Not specified',
            special_notes: orderData.notes || 'None',
            // EmailJS protection - provide all possible fields
            company_name: orderData.companyName || '',
            phone: orderData.phone || '',
            order_date: new Date().toLocaleDateString()
        };

        try {
            await emailjs.send(
                this.emailjsServiceId,
                this.emailjsTemplateId,
                templateParams
            );
            console.log('Customer email sent successfully');
        } catch (error) {
            console.error('Failed to send customer email:', error);
            throw error;
        }
    }

    // Send sales team notification
    async sendSalesTeamEmail(quoteId, orderData) {
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
            delivery_method: orderData.deliveryMethod || 'Ship',
            delivery_address: orderData.deliveryMethod === 'Pickup'
                ? 'Factory Pickup - 2025 Freeman Road East, Milton, WA 98354'
                : `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
            event_date: orderData.eventDate || 'Not specified',
            special_notes: orderData.notes || 'None',
            order_date: new Date().toLocaleDateString(),
            order_time: new Date().toLocaleTimeString()
        };

        try {
            // For now, we'll use the same template or create a separate one
            await emailjs.send(
                this.emailjsServiceId,
                this.emailjsSalesTemplateId,
                templateParams
            );
            console.log('Sales team notification sent');
        } catch (error) {
            console.error('Failed to send sales team email:', error);
            // Don't throw - sales email is not critical
        }
    }

    // Format size breakdown for email
    formatSizeBreakdown(sizeDistribution) {
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        const breakdown = [];

        sizes.forEach(size => {
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
        sizes.forEach(size => {
            totalShirts += orderData.sizeDistribution[size] || 0;
        });

        if (totalShirts !== orderData.bundleCount) {
            errors.push(`Total shirts must equal ${orderData.bundleCount} (currently ${totalShirts})`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Make available globally if needed
if (typeof window !== 'undefined') {
    window.BreastCancerBundleService = BreastCancerBundleService;
}