// Christmas Bundle Quote Service
// Handles quote generation, saving, and email delivery for Christmas bundles

class ChristmasBundleQuoteService {
    constructor() {
        this.apiBase = '/api';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsTemplateId = 'template_christmas_bundle';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.quotePrefix = 'XMAS';
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

    // Calculate bundle pricing
    calculateBundlePricing(bundleData) {
        const {
            bundleType,
            quantity,
            jacket,
            hoodie,
            hasBeanie,
            hasGloves,
            products,
            embroideryRates,
            fees
        } = bundleData;

        let basePrice = 0;
        let embroideredItems = 0;
        let itemsPerBundle = 0;
        const items = [];

        // Calculate base price and count items
        if (jacket && jacket !== 'none' && products[jacket]) {
            const jacketPrice = products[jacket].basePrice;
            basePrice += jacketPrice;
            embroideredItems++;
            itemsPerBundle++;
            items.push({
                style: jacket,
                name: products[jacket].name,
                price: jacketPrice,
                embroidery: true
            });
        }

        if (hoodie && hoodie !== 'none' && products[hoodie]) {
            const hoodiePrice = products[hoodie].basePrice;
            basePrice += hoodiePrice;
            embroideredItems++;
            itemsPerBundle++;
            items.push({
                style: hoodie,
                name: products[hoodie].name,
                price: hoodiePrice,
                embroidery: true
            });
        }

        if (hasBeanie && products['CT104597']) {
            const beaniePrice = products['CT104597'].basePrice;
            basePrice += beaniePrice;
            embroideredItems++;
            itemsPerBundle++;
            items.push({
                style: 'CT104597',
                name: products['CT104597'].name,
                price: beaniePrice,
                embroidery: true
            });
        }

        if (hasGloves && products['CTGD0794']) {
            const glovesPrice = products['CTGD0794'].basePrice;
            basePrice += glovesPrice;
            itemsPerBundle++;
            items.push({
                style: 'CTGD0794',
                name: products['CTGD0794'].name,
                price: glovesPrice,
                embroidery: false
            });
        }

        // Calculate total pieces and determine pricing tier
        const totalPieces = itemsPerBundle * quantity;
        const hasVolumePrice = totalPieces >= 24;

        // Get embroidery rate based on quantity
        let embroideryRate = 15; // Default
        if (totalPieces >= 72) {
            embroideryRate = embroideryRates['72+'] || 11;
        } else if (totalPieces >= 48) {
            embroideryRate = embroideryRates['48-71'] || 12;
        } else if (totalPieces >= 24) {
            embroideryRate = embroideryRates['24-47'] || 13;
        } else {
            embroideryRate = embroideryRates['1-23'] || 15;
        }

        // Apply fees
        const smallBatchFee = hasVolumePrice ? 0 : (fees.smallBatch || 6.25);
        const giftBoxCost = fees.giftBox || 9.00;

        // Calculate bundle price
        const embroideryTotal = embroideryRate * embroideredItems;
        const feesTotal = (smallBatchFee * itemsPerBundle) + giftBoxCost;
        const bundlePrice = basePrice + embroideryTotal + feesTotal;
        const totalPrice = bundlePrice * quantity;

        // Calculate savings
        let savings = 0;
        if (hasVolumePrice) {
            const standardEmbroideryRate = embroideryRates['1-23'] || 15;
            const standardEmbroideryTotal = standardEmbroideryRate * embroideredItems;
            const embroideryDifference = (standardEmbroideryTotal - embroideryTotal) * quantity;
            const batchFeeSavings = (fees.smallBatch || 6.25) * itemsPerBundle * quantity;
            savings = embroideryDifference + batchFeeSavings;
        }

        return {
            items,
            itemsPerBundle,
            embroideredItems,
            basePrice,
            embroideryRate,
            embroideryTotal,
            smallBatchFee,
            giftBoxCost,
            feesTotal,
            bundlePrice,
            totalPrice,
            totalPieces,
            hasVolumePrice,
            savings
        };
    }

    // Save quote to database
    async saveQuote(quoteData) {
        const quoteId = this.generateQuoteID();
        const timestamp = new Date().toISOString();

        // Prepare quote session data
        const sessionData = {
            SessionID: quoteId,
            QuoteID: quoteId,
            DecorationType: 'Christmas Bundle',
            CustomerName: quoteData.customerName || 'Walk-in Customer',
            CustomerEmail: quoteData.customerEmail || '',
            CustomerPhone: quoteData.customerPhone || '',
            BundleType: quoteData.bundleType,
            Quantity: quoteData.quantity,
            ItemCount: quoteData.itemCount,
            TotalAmount: quoteData.totalAmount,
            Status: 'Active',
            Notes: quoteData.notes || '',
            CreatedDate: timestamp,
            ModifiedDate: timestamp
        };

        try {
            // Save to quote_sessions
            const sessionResponse = await fetch(`${this.apiBase}/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to save quote session');
            }

            // Save individual items if provided
            if (quoteData.items && quoteData.items.length > 0) {
                for (const item of quoteData.items) {
                    const itemData = {
                        SessionID: quoteId,
                        ItemType: item.type || 'Product',
                        StyleNumber: item.style,
                        Description: item.name,
                        Quantity: quoteData.quantity,
                        UnitPrice: item.price,
                        HasEmbroidery: item.embroidery || false,
                        TotalPrice: item.price * quoteData.quantity
                    };

                    await fetch(`${this.apiBase}/quote_items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(itemData)
                    });
                }
            }

            return {
                success: true,
                quoteId: quoteId,
                data: sessionData
            };
        } catch (error) {
            console.error('Error saving quote:', error);
            return {
                success: false,
                quoteId: quoteId,
                error: error.message
            };
        }
    }

    // Format quote for email
    formatQuoteForEmail(quoteData) {
        const {
            quoteId,
            customerName,
            bundleType,
            items,
            quantity,
            bundlePrice,
            totalPrice,
            embroideryRate,
            hasVolumePrice,
            savings
        } = quoteData;

        let itemsList = items.map(item => {
            const embroidery = item.embroidery ? ' (with embroidery)' : '';
            return `• ${item.style} - ${item.name}${embroidery}: ${this.formatCurrency(item.price)}`;
        }).join('\n');

        let savingsText = '';
        if (hasVolumePrice && savings > 0) {
            savingsText = `\n\n🎉 Volume Savings: ${this.formatCurrency(savings)}`;
        }

        return {
            to_name: customerName,
            quote_id: quoteId,
            bundle_type: bundleType,
            quantity: quantity,
            items_list: itemsList,
            bundle_price: this.formatCurrency(bundlePrice),
            total_price: this.formatCurrency(totalPrice),
            embroidery_rate: `$${embroideryRate}/item`,
            volume_status: hasVolumePrice ? 'Qualifies for volume pricing (24+ pieces)' : 'Standard pricing',
            savings_text: savingsText,
            company_phone: '253-922-5793',
            company_email: 'sales@nwcustomapparel.com'
        };
    }

    // Send quote via email
    async sendQuoteEmail(quoteData) {
        if (!quoteData.customerEmail) {
            return {
                success: false,
                error: 'No email address provided'
            };
        }

        try {
            // Initialize EmailJS if not already done
            if (typeof emailjs === 'undefined') {
                console.error('EmailJS not loaded');
                return {
                    success: false,
                    error: 'Email service not available'
                };
            }

            emailjs.init(this.emailjsPublicKey);

            const templateParams = this.formatQuoteForEmail(quoteData);
            templateParams.to_email = quoteData.customerEmail;

            const response = await emailjs.send(
                this.emailjsServiceId,
                this.emailjsTemplateId,
                templateParams
            );

            return {
                success: true,
                response: response
            };
        } catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.text || error.message
            };
        }
    }

    // Generate printable quote
    generatePrintableQuote(quoteData) {
        const {
            quoteId,
            customerName,
            bundleType,
            items,
            quantity,
            bundlePrice,
            totalPrice,
            embroideryRate,
            hasVolumePrice
        } = quoteData;

        const date = new Date().toLocaleDateString();

        const printContent = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
                    <h1 style="color: #1a472a;">Northwest Custom Apparel</h1>
                    <h2 style="color: #c41e3a;">Christmas Bundle Quote</h2>
                    <p>Quote ID: ${quoteId} | Date: ${date}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> ${customerName}</p>
                    <p><strong>Bundle Type:</strong> ${bundleType}</p>
                    <p><strong>Quantity:</strong> ${quantity} bundles</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3>Bundle Contents</h3>
                    <ul>
                        ${items.map(item => `
                            <li>${item.style} - ${item.name} ${item.embroidery ? '(with embroidery)' : ''}</li>
                        `).join('')}
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3>Pricing Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">Bundle Price:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${this.formatCurrency(bundlePrice)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">Quantity:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">× ${quantity}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">Embroidery Rate:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${embroideryRate}/item</td>
                        </tr>
                        <tr style="font-weight: bold; font-size: 1.2em;">
                            <td style="padding: 8px;">Total:</td>
                            <td style="padding: 8px; text-align: right;">${this.formatCurrency(totalPrice)}</td>
                        </tr>
                    </table>
                </div>

                ${hasVolumePrice ? '<p style="background: #d4edda; color: #155724; padding: 10px; border-radius: 4px;">✅ Qualifies for volume pricing (24+ pieces)</p>' : ''}

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
                    <p>Thank you for choosing Northwest Custom Apparel!</p>
                    <p>Phone: 253-922-5793 | Email: sales@nwcustomapparel.com</p>
                    <p>Quote valid for 30 days from date of issue</p>
                </div>
            </div>
        `;

        return printContent;
    }

    // Print quote
    printQuote(quoteData) {
        const printContent = this.generatePrintableQuote(quoteData);
        const printWindow = window.open('', '_blank', 'width=800,height=600');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Quote ${quoteData.quoteId}</title>
                <style>
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                <\/script>
            </body>
            </html>
        `);

        printWindow.document.close();
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChristmasBundleQuoteService;
}