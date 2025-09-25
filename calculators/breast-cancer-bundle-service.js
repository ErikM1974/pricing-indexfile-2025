// Breast Cancer Awareness Bundle Service
// Handles quote generation, database saving, and email notifications

class BreastCancerBundleService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsTemplateId = 'template_bca_bundle'; // Will need to be created
        this.emailjsSalesTemplateId = 'template_bca_sales'; // Sales team notification
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
        const timestamp = new Date().toISOString();

        // Prepare quote session data - match the working Christmas bundle format
        const sessionData = {
            SessionID: quoteId,
            QuoteID: quoteId,
            DecorationType: 'Breast Cancer Bundle',
            CustomerName: orderData.customerName || 'Walk-in Customer',
            CustomerEmail: orderData.email || '',
            CustomerPhone: orderData.phone || '',
            Quantity: orderData.bundleCount,
            ItemCount: orderData.totalShirts + orderData.totalCaps,
            TotalAmount: orderData.totalAmount,
            Status: 'Active',
            Notes: this.formatNotes(orderData),
            CreatedDate: timestamp,
            ModifiedDate: timestamp
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

            for (const item of items) {
                const itemResponse = await fetch(`${this.apiBase}/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(item)
                });

                if (!itemResponse.ok) {
                    console.error('Failed to save item:', item);
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
        const timestamp = new Date().toISOString();
        const pricePerItem = 45 / 2; // $45 bundle / 2 items = $22.50 per item

        // Add t-shirt items by size
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        sizes.forEach(size => {
            const quantity = orderData.sizeDistribution[size] || 0;
            if (quantity > 0) {
                items.push({
                    SessionID: quoteId,
                    ItemType: 'Product',
                    StyleNumber: 'PC54',
                    Description: `PC54 Candy Pink T-Shirt - Size ${size}`,
                    Quantity: quantity,
                    Size: size,
                    Color: 'Candy Pink',
                    UnitPrice: pricePerItem,
                    TotalPrice: quantity * pricePerItem,
                    CreatedDate: timestamp
                });
            }
        });

        // Add caps
        items.push({
            SessionID: quoteId,
            ItemType: 'Product',
            StyleNumber: 'C112',
            Description: 'C112 True Pink/White Cap - OSFA',
            Quantity: orderData.totalCaps,
            Size: 'OSFA',
            Color: 'True Pink/White',
            UnitPrice: pricePerItem,
            TotalPrice: orderData.totalCaps * pricePerItem,
            CreatedDate: timestamp
        });

        return items;
    }

    // Format notes for database
    formatNotes(orderData) {
        const notes = [];

        notes.push('BREAST CANCER AWARENESS BUNDLE ORDER');
        notes.push(`Bundles: ${orderData.bundleCount}`);
        notes.push(`Total Items: ${orderData.totalShirts} shirts + ${orderData.totalCaps} caps`);

        // Add delivery address
        if (orderData.address || orderData.city || orderData.state || orderData.zip) {
            notes.push('\nDELIVERY ADDRESS:');
            if (orderData.companyName) {
                notes.push(orderData.companyName);
            }
            notes.push(orderData.address || '');
            notes.push(`${orderData.city || ''}, ${orderData.state || ''} ${orderData.zip || ''}`);
        }

        if (orderData.eventDate) {
            notes.push(`\nEvent Date: ${orderData.eventDate}`);
        }

        if (orderData.notes) {
            notes.push(`\nSpecial Instructions: ${orderData.notes}`);
        }

        // Add size breakdown
        notes.push('\nSIZE BREAKDOWN:');
        const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        sizes.forEach(size => {
            const quantity = orderData.sizeDistribution[size] || 0;
            if (quantity > 0) {
                notes.push(`${size}: ${quantity}`);
            }
        });

        return notes.join('\n');
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
            delivery_address: `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
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
            delivery_address: `${orderData.address}, ${orderData.city}, ${orderData.state} ${orderData.zip}`,
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
        if (!orderData.address) errors.push('Address is required');
        if (!orderData.city) errors.push('City is required');
        if (!orderData.state) errors.push('State is required');
        if (!orderData.zip) errors.push('ZIP code is required');

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