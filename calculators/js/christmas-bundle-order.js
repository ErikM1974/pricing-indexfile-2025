/* Christmas gift-box persistence: captured payloads, explicit stages and independent delivery. */
'use strict';
function createChristmasSession(quoteData, record) {
    const sessionData = {
        QuoteID: record.quoteID,
        SessionID: record.sessionID,
        Status: 'Sample Request',
        CustomerName: `${quoteData.firstName} ${quoteData.lastName}`,
        CompanyName: quoteData.company,
        CustomerEmail: quoteData.email,
        Phone: quoteData.phone,
        TotalQuantity: quoteData.totalQuantity || 1,
        SubtotalAmount: quoteData.totalPrice || 0,
        LTMFeeTotal: 0,
        TotalAmount: quoteData.totalPrice || 0,
        ExpiresAt: record.expiresAt,
        Notes: 'Christmas Gift Box Bundle Order',
    };
    return sessionData;
}
function createChristmasItem(quoteData, record) {
    const bundleConfig = {
        jacket: quoteData.jacketStyle
            ? `${quoteData.jacketStyle} - ${quoteData.jacketSize || 'N/A'} - ${quoteData.jacketColor || 'N/A'}`
            : '',
        hoodie: quoteData.hoodieStyle
            ? `${quoteData.hoodieStyle} - ${quoteData.hoodieSize || 'N/A'} - ${quoteData.hoodieColor || 'N/A'}`
            : '',
        beanie: quoteData.beanieStyle
            ? `${quoteData.beanieStyle} - ${quoteData.beanieColor || 'N/A'}`
            : '',
        gloves: quoteData.glovesStyle
            ? `${quoteData.glovesStyle} - ${quoteData.glovesSize || 'N/A'} - ${quoteData.glovesColor || 'N/A'}`
            : '',
    };
    const itemData = {
        QuoteID: record.quoteID,
        LineNumber: 1,
        StyleNumber: 'XMAS-BUNDLE',
        ProductName: 'Christmas Gift Box Bundle',
        Quantity: quoteData.totalQuantity || 1,
        FinalUnitPrice: quoteData.unitPrice || 0,
        LineTotal: quoteData.totalPrice || 0,

        // Customer Information (using correct field names)
        First: quoteData.firstName,
        Last: quoteData.lastName,
        Email: quoteData.email,
        Phone: quoteData.phone,
        Company: quoteData.company,

        // Delivery Information (using correct field names)
        DeliveryMethod: quoteData.deliveryMethod,
        Shipping_Address: quoteData.shippingAddress || '',
        Shipping_City: quoteData.shippingCity || '',
        Shipping_State: quoteData.shippingState || '',
        Shipping_Zip: quoteData.shippingZip || '',

        // Customization
        EmbroideryLocation: `Jacket: ${quoteData.jacketEmbLocation || 'N/A'}, Hoodie: ${quoteData.hoodieEmbLocation || 'N/A'}`,
        Thread_Colors: quoteData.threadColors || '',
        Image_Upload: quoteData.imageUpload || '', // ExternalKey from file upload

        // Bundle details and special instructions
        BundleConfiguration: JSON.stringify(bundleConfig),
        Notes:
            quoteData.specialInstructions ||
            quoteData.description ||
            'Christmas Gift Box Bundle',

        // Additional Fields
        RushOrder: quoteData.rushOrder ? true : false,
        DeliveryDate: quoteData.dueDate || '',
    };
    return itemData;
}
function createChristmasEmails(
    quoteData,
    quoteID,
    selectedItems,
    RETAIL_PRICES,
) {
    const formatItem = (item, _type) => {
        if (!item) return 'Not selected';
        // Extract the actual values from the selectedItems structure
        const productName = (item.name || item.style || 'Item').replace(
            /[^\w\s-]/g,
            '',
        );
        const color = (item.selectedColor || 'No color').replace(
            /[^\w\s-]/g,
            '',
        );
        const size = item.selectedSize || 'No size';
        // Return WITHOUT price since this is a free gift
        return `${productName}, Color: ${color}, Size: ${size}`;
    };
    const sanitizeText = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/[<>"'&]/g, '')
            .trim();
    };
    const total = quoteData.totalPrice,
        subtotal = total - (RETAIL_PRICES.shipping || 25);
    const colors = String(quoteData.threadColors || '')
        .split(',')
        .map((s) => s.trim());
    const threadColor1 = colors[0] || '',
        threadColor2 = colors[1] || '',
        threadColor3 = colors[2] || '';
    const jacketEmbLocation = String(
            quoteData.jacketEmbLocation || 'Standard',
        ).replace(/[^\w\s-]/g, ''),
        hoodieEmbLocation = String(
            quoteData.hoodieEmbLocation || 'Standard',
        ).replace(/[^\w\s-]/g, '');
    const embroideryLocation =
        'Jacket Location: ' +
        jacketEmbLocation +
        ' | Hoodie Location: ' +
        hoodieEmbLocation;
    const customText = quoteData.customText || '';
    const emailParams = {
        // Customer information - sanitized
        to_email:
            sanitizeText(quoteData.email) || 'noreply@nwcustomapparel.com',
        customer_name:
            sanitizeText(
                `${quoteData.firstName || ''} ${quoteData.lastName || ''}`,
            ).trim() || 'Customer',
        company_name: sanitizeText(quoteData.company) || 'Not Provided',

        // Quote details
        quote_number: quoteID || 'PENDING',
        quote_date: new Date().toLocaleDateString('en-US'),

        // Bundle items
        jacket_details: formatItem(selectedItems.jacket, 'Jacket'),
        hoodie_details: formatItem(selectedItems.hoodie, 'Hoodie'),
        beanie_details: formatItem(selectedItems.beanie, 'Beanie'),
        gloves_details: formatItem(selectedItems.gloves, 'Gloves'),

        // Customization details - plain text
        thread_color_1: threadColor1 || 'Not selected',
        thread_color_2: threadColor2 || 'Not selected',
        thread_color_3: threadColor3 || 'Not selected',
        embroidery_location: embroideryLocation,
        custom_text: sanitizeText(customText) || 'None',
        logo_upload: quoteData.imageUpload ? 'Logo uploaded' : 'No logo',

        // Contact information - sanitized
        phone: sanitizeText(quoteData.phone) || 'Not Provided',
        email: sanitizeText(quoteData.email) || 'Not Provided',

        // Delivery information - clean format
        delivery_type: quoteData.deliveryMethod || 'Pickup',
        delivery_date: quoteData.dueDate || 'To Be Determined',
        address_1: sanitizeText(quoteData.shippingAddress) || 'Not Provided',
        address_2: sanitizeText(quoteData.shippingAddress2) || '',
        city: sanitizeText(quoteData.shippingCity) || '',
        state: sanitizeText(quoteData.shippingState) || '',
        zip: sanitizeText(quoteData.shippingZip) || '',

        // Pricing - plain numbers for Outlook
        subtotal: String(subtotal.toFixed(2)),
        shipping: String((RETAIL_PRICES.shipping || 25).toFixed(2)),
        gift_box: String((RETAIL_PRICES.giftBox || 9).toFixed(2)),
        total: String(total.toFixed(2)),

        // Additional fields - sanitized
        special_instructions:
            sanitizeText(quoteData.specialInstructions) || 'None',
        quantity: String(quoteData.totalQuantity),

        // Default values to prevent corruption - always provide safe strings
        reply_to:
            sanitizeText(quoteData.email) || 'noreply@nwcustomapparel.com',
        from_name: 'Northwest Custom Apparel',
        company_phone: '253-922-5793',
        company_year: '1977',

        // Add safe defaults for any fields the template might use
        sales_rep: 'Sales Team',
        valid_days: '30',
    };
    const salesEmailParams = {
        to_email: 'nika@nwcustomapparel.com, taneisha@nwcustomapparel.com',
        quote_id: quoteID,
        order_date: new Date().toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }),
        customer_name: `${quoteData.firstName} ${quoteData.lastName}`,
        customer_email: quoteData.email,
        customer_phone: quoteData.phone,
        customer_company: quoteData.company || 'Not provided',
    };
    return [
        {
            service: 'service_1c4k67j',
            template: 'template_v80ysfp',
            data: emailParams,
        },
        {
            service: 'service_1c4k67j',
            template: 'template_sales_xmas',
            data: salesEmailParams,
        },
    ];
}
class ChristmasBundleQuoteService {
    constructor(options = {}) {
        this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
        this.email = options.email || (() => globalThis.emailjs);
        this.record = null;
        this.pending = null;
    }

    generateQuoteID() {
        const date = new Date();
        return (
            'XMAS' +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0') +
            '-' +
            String(Math.floor(Math.random() * 10000)).padStart(4, '0')
        );
    }

    async write(path, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await this.fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!response.ok)
                throw new Error(
                    'Save was not accepted (HTTP ' + response.status + ').',
                );
        } finally {
            clearTimeout(timer);
        }
    }

    async upload(file) {
        const form = new FormData();
        const dot = file.name.lastIndexOf('.');
        const name =
            (dot < 0 ? file.name : file.name.slice(0, dot)) +
            '_' +
            Date.now() +
            (dot < 0 ? '' : file.name.slice(dot));
        form.append('file', new File([file], name, { type: file.type }));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const base = globalThis.APP_CONFIG?.API?.BASE_URL;
            if (!base) throw new Error('Upload service is unavailable.');
            const response = await this.fetch(base + '/api/files/upload', {
                method: 'POST',
                body: form,
                signal: controller.signal,
            });
            if (!response.ok)
                throw new Error(
                    'Logo upload failed (HTTP ' + response.status + ').',
                );
            const data = await response.json();
            const key = data.ExternalKey || data.externalKey || data.id;
            if (!key)
                throw new Error('The upload did not return a logo reference.');
            return key;
        } finally {
            clearTimeout(timer);
        }
    }

    submit(quoteData, items, pricing, logoFile, progress = () => {}) {
        if (this.pending) return this.pending;
        const snapshot = JSON.parse(JSON.stringify(quoteData));
        const itemSnapshot = JSON.parse(JSON.stringify(items));
        const signature = JSON.stringify({
            snapshot,
            itemSnapshot,
            logo: logoFile
                ? [logoFile.name, logoFile.size, logoFile.lastModified]
                : null,
        });
        if (
            !this.record ||
            this.record.signature !== signature ||
            this.record.complete
        ) {
            const now = Date.now();
            this.record = {
                signature,
                quoteID: this.generateQuoteID(),
                sessionID:
                    'xmas_sess_' +
                    now +
                    '_' +
                    Math.random().toString(36).substr(2, 9),
                expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .replace(/\.\d{3}Z$/, ''),
                quoteData: snapshot,
                items: itemSnapshot,
                pricing: { ...pricing },
                logoFile,
                uploaded: !logoFile,
                sessionSaved: false,
                itemSaved: false,
                emailSent: [false, false],
                complete: false,
            };
        }
        const record = this.record;
        this.pending = this.perform(record, progress).finally(() => {
            this.pending = null;
        });
        return this.pending;
    }

    async perform(record, progress) {
        if (!record.uploaded) {
            progress('logo', 'Uploading your logo…');
            record.quoteData.imageUpload = await this.upload(record.logoFile);
            record.uploaded = true;
        }
        const data = record.quoteData;
        if (!record.sessionSaved) {
            progress('quote', 'Saving your gift-box request…');
            await this.write(
                '/api/quote_sessions',
                createChristmasSession(data, record),
            );
            record.sessionSaved = true;
        }
        if (!record.itemSaved) {
            progress('quote', 'Saving your selections and delivery details…');
            const item = createChristmasItem(data, record);
            item.Shipping_Address = [
                data.shippingAddress,
                data.shippingAddress2,
            ]
                .filter(Boolean)
                .join('\n');
            await this.write('/api/quote_items', item);
            record.itemSaved = true;
        }
        await this.deliver(record, progress);
        return this.status(record);
    }

    async deliver(record, progress) {
        progress('email', 'Sending confirmation emails…');
        if (!record.emails)
            record.emails = createChristmasEmails(
                record.quoteData,
                record.quoteID,
                record.items,
                record.pricing,
            );
        record.emailErrors = [];
        for (const [index, message] of record.emails.entries()) {
            if (record.emailSent[index]) continue;
            try {
                const email = this.email();
                if (!email || typeof email.send !== 'function')
                    throw new Error('Email service is unavailable.');
                await email.send(
                    message.service,
                    message.template,
                    message.data,
                );
                record.emailSent[index] = true;
            } catch (error) {
                record.emailErrors.push({ index, message: error.message });
            }
        }
        record.complete = record.emailSent.every(Boolean);
    }

    retryEmails(progress = () => {}) {
        if (this.pending) return this.pending;
        if (!this.record?.itemSaved)
            return Promise.reject(
                new Error('Save the order before sending email.'),
            );
        const record = this.record;
        this.pending = this.deliver(record, progress)
            .then(() => this.status(record))
            .finally(() => {
                this.pending = null;
            });
        return this.pending;
    }

    status(record) {
        return {
            quoteID: record.quoteID,
            saved: record.sessionSaved && record.itemSaved,
            customerEmailSent: record.emailSent[0],
            salesEmailSent: record.emailSent[1],
            complete: record.complete,
        };
    }
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ChristmasBundleQuoteService,
        createChristmasSession,
        createChristmasItem,
        createChristmasEmails,
    };
}
