# ManageOrders PUSH API - Complete Webstore Implementation Guide

**Last Updated:** 2025-11-19
**Purpose:** Step-by-step guide for implementing order submission to ShopWorks OnSite using ManageOrders PUSH API
**Status:** Production-ready based on 3-Day Tees implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Pattern](#architecture-pattern)
3. [Order Service Class Structure](#order-service-class-structure)
4. [Order Data Construction](#order-data-construction)
5. [Line Items Building](#line-items-building)
6. [Design Block Integration](#design-block-integration)
7. [Payment Integration](#payment-integration)
8. [Business Logic Implementation](#business-logic-implementation)
9. [Error Handling & Fallback](#error-handling--fallback)
10. [Email Notifications](#email-notifications)
11. [Testing & Debugging](#testing--debugging)
12. [Complete Working Example](#complete-working-example)

---

## 🎯 Overview

This guide shows how to build a complete webstore order submission system that:
- Submits orders to ShopWorks OnSite via ManageOrders PUSH API
- Integrates Stripe payment processing
- Handles artwork file uploads
- Calculates business dates (order date, ship date)
- Sends email notifications
- Has fallback to quote database if API fails

**Based on:** Production implementation in `shared_components/js/three-day-tees-order-service.js`

**API Endpoint:** `POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create`

---

## 🏗️ Architecture Pattern

### Service Class Pattern

All webstore implementations should follow this pattern:

```
[YourProduct]OrderService.js
├── Constructor - API config, EmailJS init
├── Business Logic Methods
│   ├── generateOrderNumber()
│   ├── calculateOrderDate()
│   ├── calculateShipDate()
│   └── isHoliday()
├── Order Building Methods
│   ├── submitOrder() - MAIN METHOD
│   ├── buildLineItems()
│   ├── buildDesignLocations()
│   └── buildLocationNotes()
├── Fallback & Error Handling
│   ├── saveToQuoteDatabase()
│   └── sendAdminErrorEmail()
└── Email Notification Methods
    ├── sendCustomerEmail()
    └── sendSalesTeamEmail()
```

### Data Flow

```
User Completes Checkout
    ↓
Payment Processed (Stripe)
    ↓
submitOrder() Called
    ↓
Order Data Constructed
    ↓
API Submission Attempted
    ↓ (if successful)        ↓ (if failed)
ShopWorks Order Created    Quote Database Fallback
    ↓                           ↓
Email Notifications Sent  ←─────┘
    ↓
Order Confirmation Displayed
```

---

## 📦 Order Service Class Structure

### Constructor Setup

```javascript
class YourProductOrderService {
    constructor() {
        // API Configuration
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // EmailJS Configuration
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.customerTemplateId = 'template_xxxxx'; // Get from EmailJS
        this.salesTemplateId = 'template_yyyyy';    // Get from EmailJS

        // Business Configuration
        this.productionDays = 3; // Business days for production
        this.cutoffHour = 9;     // 9 AM PST cutoff

        // Initialize EmailJS
        emailjs.init(this.emailjsPublicKey);

        console.log('[YourProductOrderService] Initialized');
    }

    // Static holidays array (US federal holidays + factory closure)
    static NON_BUSINESS_DAYS = [
        // 2025
        { date: '2025-01-01', name: "New Year's Day" },
        { date: '2025-01-20', name: "Martin Luther King Jr. Day" },
        { date: '2025-02-17', name: "Presidents' Day" },
        { date: '2025-05-26', name: "Memorial Day" },
        { date: '2025-07-04', name: "Independence Day" },
        { date: '2025-09-01', name: "Labor Day" },
        { date: '2025-10-13', name: "Columbus Day" },
        { date: '2025-11-11', name: "Veterans Day" },
        { date: '2025-11-27', name: "Thanksgiving" },
        { date: '2025-12-25', name: "Christmas Day" },
        { date: '2025-12-26', name: "Factory Closed" },
        { date: '2025-12-27', name: "Factory Closed" },
        { date: '2025-12-28', name: "Factory Closed" },
        { date: '2025-12-29', name: "Factory Closed" },
        { date: '2025-12-30', name: "Factory Closed" },
        { date: '2025-12-31', name: "Factory Closed" },

        // 2026
        { date: '2026-01-01', name: "New Year's Day" },
        // ... add more years as needed
    ];
}
```

---

## 🔧 Order Data Construction

### Main submitOrder Method Structure

```javascript
async submitOrder(customerData, orderSettings, colorConfigs) {
    try {
        console.log('[OrderService] Starting order submission...');

        // 1. Generate unique order number
        const orderNumber = this.generateOrderNumber();

        // 2. Calculate order and ship dates
        const orderDate = this.getOrderDate();
        const shipDate = this.calculateShipDate(orderDate, this.productionDays);

        // 3. Build line items
        const lineItems = this.buildLineItems(colorConfigs, orderSettings);

        // 4. Calculate totals
        const grandTotalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const salesTax = parseFloat((subtotal * 0.101).toFixed(2)); // 10.1% tax
        const shippingCost = 30.00; // UPS Ground
        const orderTotal = subtotal + salesTax + shippingCost;

        // 5. Build complete order data
        const orderData = {
            orderNumber: orderNumber,
            orderDate: orderDate,
            requestedShipDate: shipDate,
            dateNeeded: new Date(Date.now() + this.productionDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            salesRep: 'Erik Mickelson',
            terms: 'Prepaid',

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
                name: orderNumber,
                externalId: `DESIGN-${orderNumber}`,
                designTypeId: 45, // DTG design type
                artist: 224,
                productColor: Object.keys(colorConfigs).join(', '),
                locations: this.buildDesignLocations(orderNumber, colorConfigs, orderSettings)
            }],

            notes: [{
                type: 'Notes On Order',
                text: `${orderSettings.serviceDescription}. ${customerData.notes || ''} Total: ${orderTotal.toFixed(2)} (includes sales tax 10.1%)`
            }],

            payments: orderSettings.paymentData ? [{
                date: orderSettings.paymentData.paymentDate,
                accountNumber: orderSettings.paymentData.paymentId,
                amount: orderSettings.paymentData.amount,
                authCode: orderSettings.paymentData.paymentId,
                cardCompany: orderSettings.paymentData.card_brand || 'Stripe',
                gateway: 'Stripe',
                responseCode: orderSettings.paymentData.outcome?.network_status || '200',
                responseReasonCode: orderSettings.paymentData.outcome?.seller_message || 'approved',
                responseReasonText: orderSettings.paymentData.outcome?.reason || 'Payment successful',
                status: orderSettings.paymentData.status,
                feeOther: 0,
                feeProcessing: 0
            }] : [],

            attachments: this.buildAttachments(orderSettings),

            total: orderTotal,
            taxTotal: salesTax,
            taxPartNumber: 'Tax_10.1',
            taxPartDescription: 'City of Milton Sales Tax 10.1%',
            cur_Shipping: shippingCost
        };

        // 6. Submit to API
        let finalOrderNumber = orderNumber;
        let orderCreatedSuccessfully = false;

        try {
            const response = await fetch(`${this.apiBase}/api/manageorders/orders/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[OrderService] ✓ Order created:', result);
                finalOrderNumber = result.orderNumber || orderNumber;
                orderCreatedSuccessfully = true;
            } else {
                const errorText = await response.text();
                console.error('[OrderService] API error:', response.status, errorText);
                throw new Error(`API returned ${response.status}: ${errorText}`);
            }
        } catch (apiError) {
            console.error('[OrderService] API failed:', apiError);

            // Fallback to quote database
            await this.saveToQuoteDatabase(orderNumber, orderData, lineItems, grandTotalQuantity);
            await this.sendAdminErrorEmail(orderNumber, orderData, apiError.message);
        }

        // 7. Send notifications (always, even if API failed)
        await this.sendCustomerEmail(orderData, finalOrderNumber, colorConfigs, orderSettings);
        await this.sendSalesTeamEmail(orderData, finalOrderNumber, colorConfigs, orderSettings);

        return {
            success: true,
            orderNumber: finalOrderNumber,
            shipDate: shipDate,
            orderCreatedInShopWorks: orderCreatedSuccessfully
        };

    } catch (error) {
        console.error('[OrderService] Fatal error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

---

## 📦 Line Items Building

### One Line Item Per Color/Size Combination

**CRITICAL:** ManageOrders expects separate line items for each color/size combination, not consolidated items.

```javascript
buildLineItems(colorConfigs, orderSettings) {
    const lineItems = [];
    let grandTotalQuantity = 0;

    // Iterate through each color configuration
    Object.entries(colorConfigs).forEach(([catalogColor, config]) => {
        // Iterate through size breakdown for this color
        Object.entries(config.sizeBreakdown).forEach(([size, sizeData]) => {
            const qty = sizeData.quantity;
            if (qty === 0) return; // Skip sizes with 0 quantity

            // Use unitPrice which includes all fees/upcharges
            const price = sizeData.unitPrice;
            grandTotalQuantity += qty;

            lineItems.push({
                partNumber: 'PC54',  // ⚠️ ALWAYS use BASE part number (never PC54_2X)
                description: `Port & Company Core Cotton Tee - ${orderSettings.serviceDescription}`,
                color: catalogColor,  // ⚠️ Use CATALOG_COLOR format (e.g., "Forest" not "Forest Green")
                size: size,
                quantity: qty,
                price: price,
                notes: `${orderSettings.decorationMethod} - ${orderSettings.printLocationName} - ${orderSettings.serviceDescription}`
            });
        });
    });

    // Add LTM fee if applicable (6-23 pieces)
    if (orderSettings.ltmFee && orderSettings.ltmFee > 0) {
        lineItems.push({
            partNumber: 'LTM-75',
            description: 'Less Than Minimum $75.00',
            color: '',
            size: '',
            quantity: 1,
            price: orderSettings.ltmFee,
            notes: '',
            // Metadata for ManageOrders transformation
            productClass: 10,      // Fee item (not product)
            useSizeColumn: true    // Put quantity in Size01 column
        });
    }

    return lineItems;
}
```

### Key Points for Line Items

1. **Part Numbers:** Always use BASE part number (e.g., "PC54"), never size-specific variants (e.g., "PC54_2X")
2. **Colors:** Use CATALOG_COLOR format from Sanmar API (e.g., "Forest" not "Forest Green")
3. **Size Routing:** ShopWorks automatically routes to correct SKU based on size field
4. **One Per Combination:** Each color/size combo gets its own line item
5. **LTM Fees:** Add as separate line item with special metadata flags

---

## 🎨 Design Block Integration

### Building Design Locations with Artwork

```javascript
buildDesignLocations(orderNumber, colorConfigs, orderSettings) {
    const locations = [];

    // Get uploaded artwork files
    const frontArtwork = orderSettings.frontLogo || null;
    const backArtwork = orderSettings.backLogo || null;

    const frontLocationCode = orderSettings.printLocationCode; // 'LC' or 'FF'
    const frontLocationName = orderSettings.printLocationName; // 'Left Chest' or 'Full Front'

    // Front location (always present)
    locations.push({
        location: `${frontLocationCode} ${frontLocationName}`,
        code: orderNumber,           // ⚠️ Proxy expects 'code' not 'designCode'
        imageUrl: frontArtwork ? frontArtwork.fileUrl : '',
        notes: this.buildLocationNotes(colorConfigs)
    });

    // Back location (if selected)
    if (orderSettings.hasBackPrint && backArtwork) {
        locations.push({
            location: 'FB Full Back',
            code: orderNumber,
            imageUrl: backArtwork.fileUrl,
            notes: this.buildLocationNotes(colorConfigs)
        });
    }

    return locations;
}

buildLocationNotes(colorConfigs) {
    // Build notes showing colors and sizes
    const colorNotes = Object.entries(colorConfigs).map(([catalogColor, config]) => {
        const sizes = Object.entries(config.sizeBreakdown)
            .filter(([_, sizeData]) => sizeData.quantity > 0)
            .map(([size, sizeData]) => `${size}(${sizeData.quantity})`)
            .join(' ');
        return `${catalogColor}: ${sizes}`;
    });

    return colorNotes.join(' | ');
}

buildAttachments(orderSettings) {
    const files = [];
    if (orderSettings.frontLogo) files.push(orderSettings.frontLogo);
    if (orderSettings.backLogo) files.push(orderSettings.backLogo);

    return files.map(file => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType
        // ⚠️ Exclude fileData to keep payload under 1MB limit
    }));
}
```

### Design Block Field Names

**CRITICAL:** Proxy API expects specific field names:

| Correct Field | Wrong Field | Notes |
|---------------|-------------|-------|
| `designTypeId` | `designType` | Must be numeric ID |
| `productColor` | `forProductColor` | Comma-separated colors |
| `code` | `designCode` | Design identifier |
| `imageUrl` | `imageURL` | Note lowercase 'rl' |

---

## 💳 Payment Integration

### Stripe Payment Block

```javascript
// In submitOrder method, build payments array:
payments: orderSettings.paymentData ? [{
    date: orderSettings.paymentData.paymentDate,           // YYYY-MM-DD format
    accountNumber: orderSettings.paymentData.paymentId,    // Full Stripe payment ID
    amount: orderSettings.paymentData.amount,              // Dollars (converted from cents)
    authCode: orderSettings.paymentData.paymentId,         // Same as account number
    cardCompany: orderSettings.paymentData.card_brand || orderSettings.paymentData.payment_method_type || 'Stripe',
    gateway: 'Stripe',
    responseCode: orderSettings.paymentData.outcome?.network_status || '200',
    responseReasonCode: orderSettings.paymentData.outcome?.seller_message || 'approved',
    responseReasonText: orderSettings.paymentData.outcome?.reason || 'Payment successful',
    status: orderSettings.paymentData.status,              // e.g., "succeeded"
    feeOther: 0,
    feeProcessing: 0                                       // Processing fee absorbed by business
}] : []
```

### Payment Data Structure Expected

```javascript
// orderSettings.paymentData should contain:
{
    paymentId: 'pi_xxxxxxxxxxxxx',          // From Stripe PaymentIntent
    paymentDate: '2025-11-19',              // YYYY-MM-DD format
    amount: 156.78,                          // Dollars (converted from cents)
    status: 'succeeded',                     // Stripe payment status
    card_brand: 'visa',                      // Optional: visa, mastercard, amex, etc.
    payment_method_type: 'card',            // Optional: card, apple_pay, etc.
    outcome: {                               // Optional Stripe outcome data
        network_status: 'approved_by_network',
        seller_message: 'Payment complete.',
        reason: 'Payment successful'
    }
}
```

---

## 📅 Business Logic Implementation

### Order Date Calculation (9 AM PST Cutoff)

```javascript
isBeforeCutoff() {
    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const hour = pstTime.getHours();
    return hour < this.cutoffHour; // 9 AM PST
}

getOrderDate() {
    const now = new Date();

    // If before cutoff, order date is today
    // If after cutoff, order date is next business day
    if (!this.isBeforeCutoff()) {
        now.setDate(now.getDate() + 1);
    }

    // Skip weekends and holidays
    while (now.getDay() === 0 || now.getDay() === 6 || this.isHoliday(now)) {
        now.setDate(now.getDate() + 1);
    }

    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
}
```

### Ship Date Calculation (Business Days)

```javascript
isHoliday(date) {
    const dateStr = date.toISOString().split('T')[0];
    return YourProductOrderService.NON_BUSINESS_DAYS.some(h => h.date === dateStr);
}

calculateShipDate(orderDate, businessDays) {
    let shipDate = new Date(orderDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
        shipDate.setDate(shipDate.getDate() + 1);

        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (shipDate.getDay() === 0 || shipDate.getDay() === 6) {
            continue;
        }

        // Skip holidays
        if (this.isHoliday(shipDate)) {
            continue;
        }

        daysAdded++;
    }

    return shipDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}
```

### Order Number Generation

```javascript
generateOrderNumber() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateKey = `${month}${day}`;

    // Daily sequence using localStorage
    const storageKey = `your_product_order_sequence_${dateKey}`;
    let sequence = parseInt(localStorage.getItem(storageKey) || '0') + 1;
    localStorage.setItem(storageKey, sequence.toString());

    // Clean up old sequences (keep only today's)
    this.cleanupOldSequences(dateKey);

    // Add milliseconds for uniqueness
    const ms = now.getMilliseconds();

    // Format: PREFIX-MMDD-sequence-ms
    return `YRP-${dateKey}-${sequence}-${ms}`;
}

cleanupOldSequences(currentDateKey) {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('your_product_order_sequence_') && !key.includes(currentDateKey)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
}
```

---

## 🛡️ Error Handling & Fallback

### Quote Database Fallback

```javascript
async saveToQuoteDatabase(orderNumber, orderData, lineItems, grandTotalQuantity) {
    try {
        console.log('[OrderService] Saving to quote database as fallback...');

        const sessionData = {
            QuoteID: orderNumber,
            SessionID: `session_${Date.now()}`,
            CustomerEmail: orderData.customer.email,
            CustomerName: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            CompanyName: orderData.customer.company || '',
            Phone: orderData.customer.phone || '',
            TotalQuantity: grandTotalQuantity,
            SubtotalAmount: parseFloat((orderData.total - orderData.taxTotal - orderData.cur_Shipping).toFixed(2)),
            LTMFeeTotal: lineItems.find(item => item.partNumber === 'LTM-75')?.price || 0,
            TotalAmount: parseFloat(orderData.total.toFixed(2)),
            Status: 'API Failed - Pending Review',
            ExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, ''),
            Notes: `ManageOrders API submission failed. Order data: ${JSON.stringify(orderData).substring(0, 500)}`
        };

        const sessionResponse = await fetch(`${this.apiBase}/api/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        if (!sessionResponse.ok) {
            throw new Error('Quote session save failed');
        }

        // Save line items
        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i];
            const itemData = {
                QuoteID: orderNumber,
                LineNumber: i + 1,
                StyleNumber: item.partNumber,
                ProductName: item.description,
                Color: item.color,
                EmbellishmentType: 'dtg',
                Quantity: item.quantity,
                FinalUnitPrice: item.price,
                LineTotal: item.quantity * item.price,
                AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
            };

            await fetch(`${this.apiBase}/api/quote_items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
        }

        console.log('[OrderService] ✓ Saved to quote database');
        return true;

    } catch (error) {
        console.error('[OrderService] Quote database save failed:', error);
        return false;
    }
}
```

### Admin Error Notification

```javascript
async sendAdminErrorEmail(orderNumber, orderData, errorMessage) {
    try {
        const emailData = {
            to_email: 'erik@nwcustomapparel.com',
            subject: `⚠️ ManageOrders API Failure - Order ${orderNumber}`,
            order_number: orderNumber,
            customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            customer_email: orderData.customer.email,
            error_message: errorMessage,
            order_total: orderData.total.toFixed(2),
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
        };

        await emailjs.send(
            this.emailjsServiceId,
            'template_admin_error', // Create this template in EmailJS
            emailData,
            this.emailjsPublicKey
        );

        console.log('[OrderService] ✓ Admin error notification sent');

    } catch (error) {
        console.error('[OrderService] Admin email failed:', error);
    }
}
```

---

## 📧 Email Notifications

### Customer Confirmation Email

```javascript
async sendCustomerEmail(orderData, finalOrderNumber, colorConfigs, orderSettings) {
    try {
        // Build order summary table
        const orderSummary = this.buildOrderSummaryHTML(colorConfigs, orderSettings);

        const emailData = {
            to_email: orderData.customer.email,
            to_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            order_number: finalOrderNumber,
            order_date: orderData.orderDate,
            ship_date: orderData.requestedShipDate,
            order_summary: orderSummary,
            subtotal: (orderData.total - orderData.taxTotal - orderData.cur_Shipping).toFixed(2),
            tax: orderData.taxTotal.toFixed(2),
            shipping: orderData.cur_Shipping.toFixed(2),
            total: orderData.total.toFixed(2),
            shipping_address: `${orderData.shipping.address1}, ${orderData.shipping.city}, ${orderData.shipping.state} ${orderData.shipping.zip}`,
            company_phone: '253-922-5793',
            company_email: 'sales@nwcustomapparel.com'
        };

        await emailjs.send(
            this.emailjsServiceId,
            this.customerTemplateId,
            emailData,
            this.emailjsPublicKey
        );

        console.log('[OrderService] ✓ Customer email sent');

    } catch (error) {
        console.error('[OrderService] Customer email failed:', error);
    }
}

buildOrderSummaryHTML(colorConfigs, orderSettings) {
    let html = '<table border="1" cellpadding="5" style="border-collapse: collapse;">';
    html += '<tr><th>Color</th><th>Sizes</th><th>Quantity</th><th>Price</th></tr>';

    Object.entries(colorConfigs).forEach(([catalogColor, config]) => {
        const sizes = Object.entries(config.sizeBreakdown)
            .filter(([_, sizeData]) => sizeData.quantity > 0)
            .map(([size, sizeData]) => `${size}(${sizeData.quantity})`)
            .join(', ');

        const colorTotal = Object.values(config.sizeBreakdown)
            .reduce((sum, sizeData) => sum + (sizeData.quantity * sizeData.unitPrice), 0);

        const colorQty = Object.values(config.sizeBreakdown)
            .reduce((sum, sizeData) => sum + sizeData.quantity, 0);

        html += `<tr>
            <td>${catalogColor}</td>
            <td>${sizes}</td>
            <td>${colorQty}</td>
            <td>$${colorTotal.toFixed(2)}</td>
        </tr>`;
    });

    html += '</table>';
    return html;
}
```

### Sales Team Notification Email

```javascript
async sendSalesTeamEmail(orderData, finalOrderNumber, colorConfigs, orderSettings) {
    try {
        const emailData = {
            to_email: 'sales@nwcustomapparel.com',
            bcc_email: 'erik@nwcustomapparel.com',
            subject: `New Order: ${finalOrderNumber} - ${orderData.customer.firstName} ${orderData.customer.lastName}`,
            order_number: finalOrderNumber,
            customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`,
            customer_email: orderData.customer.email,
            customer_phone: orderData.customer.phone,
            company: orderData.customer.company || 'N/A',
            order_summary: this.buildOrderSummaryHTML(colorConfigs, orderSettings),
            total: orderData.total.toFixed(2),
            payment_status: orderSettings.paymentData ? 'Paid via Stripe' : 'Pending',
            payment_id: orderSettings.paymentData?.paymentId || 'N/A',
            shipping_address: `${orderData.shipping.address1}, ${orderData.shipping.city}, ${orderData.shipping.state} ${orderData.shipping.zip}`,
            order_date: orderData.orderDate,
            ship_date: orderData.requestedShipDate,
            notes: orderData.notes[0]?.text || ''
        };

        await emailjs.send(
            this.emailjsServiceId,
            this.salesTemplateId,
            emailData,
            this.emailjsPublicKey
        );

        console.log('[OrderService] ✓ Sales team email sent');

    } catch (error) {
        console.error('[OrderService] Sales team email failed:', error);
    }
}
```

---

## 🧪 Testing & Debugging

### Console Testing Commands

```javascript
// Add to your HTML page for testing
window.ORDER_SERVICE_TEST = {
    // Test order number generation
    testOrderNumber: function() {
        const service = new YourProductOrderService();
        const orderNumber = service.generateOrderNumber();
        console.log('Generated order number:', orderNumber);
        return orderNumber;
    },

    // Test business date calculation
    testDates: function() {
        const service = new YourProductOrderService();
        const orderDate = service.getOrderDate();
        const shipDate = service.calculateShipDate(orderDate, 3);
        console.log('Order date:', orderDate);
        console.log('Ship date (3 business days):', shipDate);
        return { orderDate, shipDate };
    },

    // Test with sample data
    testSubmit: async function() {
        const service = new YourProductOrderService();

        const customerData = {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '555-555-5555',
            company: 'Test Company',
            address1: '123 Test St',
            city: 'Seattle',
            state: 'WA',
            zip: '98101'
        };

        const colorConfigs = {
            'Forest': {
                sizeBreakdown: {
                    'M': { quantity: 12, unitPrice: 17.50 },
                    'L': { quantity: 12, unitPrice: 17.50 }
                }
            }
        };

        const orderSettings = {
            serviceDescription: 'Test Order',
            decorationMethod: 'DTG',
            printLocationCode: 'FF',
            printLocationName: 'Full Front',
            hasBackPrint: false,
            frontLogo: {
                fileUrl: 'https://example.com/logo.png',
                fileName: 'logo.png',
                fileSize: 50000,
                fileType: 'image/png'
            },
            paymentData: null // Set to null for testing without payment
        };

        const result = await service.submitOrder(customerData, orderSettings, colorConfigs);
        console.log('Test result:', result);
        return result;
    }
};
```

### Debug Logging Pattern

Add comprehensive logging throughout your service:

```javascript
async submitOrder(customerData, orderSettings, colorConfigs) {
    console.log('[OrderService] ========== ORDER SUBMISSION START ==========');
    console.log('[OrderService] Customer:', customerData);
    console.log('[OrderService] Settings:', orderSettings);
    console.log('[OrderService] Colors:', colorConfigs);

    try {
        const orderNumber = this.generateOrderNumber();
        console.log('[OrderService] Generated order number:', orderNumber);

        const orderDate = this.getOrderDate();
        const shipDate = this.calculateShipDate(orderDate, this.productionDays);
        console.log('[OrderService] Order date:', orderDate);
        console.log('[OrderService] Ship date:', shipDate);

        const lineItems = this.buildLineItems(colorConfigs, orderSettings);
        console.log('[OrderService] Built line items:', lineItems.length, 'items');

        const orderData = { /* ... */ };
        console.log('[OrderService] Complete order data:', orderData);

        console.log('[OrderService] Calling ManageOrders API...');
        const response = await fetch(/* ... */);
        console.log('[OrderService] API response status:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('[OrderService] ✓ SUCCESS:', result);
            return { success: true, orderNumber: result.orderNumber };
        } else {
            const errorText = await response.text();
            console.error('[OrderService] ✗ API ERROR:', errorText);
            throw new Error(errorText);
        }

    } catch (error) {
        console.error('[OrderService] ✗ FATAL ERROR:', error);
        console.log('[OrderService] ========== ORDER SUBMISSION FAILED ==========');
        return { success: false, error: error.message };
    }
}
```

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **401 Unauthorized** | API returns authentication error | Check proxy server is running and credentials are valid |
| **400 Bad Request** | API rejects order data | Validate all required fields, check field name spelling |
| **Order not appearing in ShopWorks** | API succeeds but no order visible | Check hourly import schedule, verify order number format |
| **Wrong part number** | Inventory not decremented | Use BASE part number (PC54), never size variants (PC54_2X) |
| **Wrong color** | Color not found in catalog | Use CATALOG_COLOR format from Sanmar API |
| **Emails not sending** | No confirmation emails | Verify EmailJS credentials, check template IDs |
| **Ship date incorrect** | Wrong number of business days | Verify holiday array, check cutoff time logic |

---

## 📝 Complete Working Example

### Full Service Class Template

```javascript
/**
 * YourProductOrderService
 * Handles order submission to ShopWorks OnSite via ManageOrders PUSH API
 * Based on 3-Day Tees production implementation
 */
class YourProductOrderService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.customerTemplateId = 'template_xxxxx';
        this.salesTemplateId = 'template_yyyyy';
        this.productionDays = 3;
        this.cutoffHour = 9;

        emailjs.init(this.emailjsPublicKey);
        console.log('[YourProductOrderService] Initialized');
    }

    static NON_BUSINESS_DAYS = [
        // 2025 US Federal Holidays + Factory Closure
        { date: '2025-01-01', name: "New Year's Day" },
        { date: '2025-01-20', name: "Martin Luther King Jr. Day" },
        { date: '2025-02-17', name: "Presidents' Day" },
        { date: '2025-05-26', name: "Memorial Day" },
        { date: '2025-07-04', name: "Independence Day" },
        { date: '2025-09-01', name: "Labor Day" },
        { date: '2025-10-13', name: "Columbus Day" },
        { date: '2025-11-11', name: "Veterans Day" },
        { date: '2025-11-27', name: "Thanksgiving" },
        { date: '2025-12-25', name: "Christmas Day" },
        { date: '2025-12-26', name: "Factory Closed" },
        { date: '2025-12-27', name: "Factory Closed" },
        { date: '2025-12-28', name: "Factory Closed" },
        { date: '2025-12-29', name: "Factory Closed" },
        { date: '2025-12-30', name: "Factory Closed" },
        { date: '2025-12-31', name: "Factory Closed" }
    ];

    // [Include all methods from sections above]
    // - generateOrderNumber()
    // - isBeforeCutoff()
    // - getOrderDate()
    // - isHoliday()
    // - calculateShipDate()
    // - buildLineItems()
    // - buildDesignLocations()
    // - buildLocationNotes()
    // - buildAttachments()
    // - submitOrder()
    // - saveToQuoteDatabase()
    // - sendAdminErrorEmail()
    // - sendCustomerEmail()
    // - sendSalesTeamEmail()
    // - buildOrderSummaryHTML()
    // - cleanupOldSequences()
}

// Export for use in HTML
window.YourProductOrderService = YourProductOrderService;
```

### Usage in HTML Page

```html
<!-- Load EmailJS SDK -->
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

<!-- Load your service class -->
<script src="/shared_components/js/your-product-order-service.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Initialize service
    const orderService = new YourProductOrderService();

    // Handle order submission
    document.getElementById('submitOrder').addEventListener('click', async function() {
        // Gather customer data from form
        const customerData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            company: document.getElementById('company').value,
            address1: document.getElementById('address1').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value,
            notes: document.getElementById('notes').value
        };

        // Gather order settings (customize for your product)
        const orderSettings = {
            serviceDescription: 'Your Product Service',
            decorationMethod: 'DTG',
            printLocationCode: 'FF',
            printLocationName: 'Full Front',
            hasBackPrint: false,
            frontLogo: window.uploadedFrontLogo, // From your upload handler
            backLogo: window.uploadedBackLogo,   // From your upload handler
            paymentData: window.stripePaymentData, // From Stripe
            ltmFee: calculateLTMFee() // Your fee calculation
        };

        // Gather color configurations (from your size selector)
        const colorConfigs = window.selectedColorConfigs;

        // Submit order
        showLoading();
        const result = await orderService.submitOrder(
            customerData,
            orderSettings,
            colorConfigs
        );
        hideLoading();

        if (result.success) {
            showSuccessMessage(result.orderNumber, result.shipDate);
        } else {
            showErrorMessage(result.error);
        }
    });
});
</script>
```

---

## 📋 Implementation Checklist

### Before You Start

- [ ] Have access to ShopWorks OnSite system
- [ ] Have ManageOrders API credentials
- [ ] Have EmailJS account with templates created
- [ ] Have Stripe account for payment processing (optional)
- [ ] Have Caspio storage for artwork files

### Service Class Development

- [ ] Create service class file (`your-product-order-service.js`)
- [ ] Add constructor with API configuration
- [ ] Implement order number generation
- [ ] Implement business date calculations
- [ ] Add holiday array for your years of operation
- [ ] Build line items construction method
- [ ] Build design locations method (if applicable)
- [ ] Implement main `submitOrder()` method
- [ ] Add quote database fallback
- [ ] Add error notification emails
- [ ] Add customer confirmation emails
- [ ] Add sales team notification emails

### Testing

- [ ] Test order number generation (check uniqueness)
- [ ] Test business date calculations (try weekends/holidays)
- [ ] Test with test payment data (no real charge)
- [ ] Verify order appears in ShopWorks after hourly import
- [ ] Check all email notifications are received
- [ ] Test fallback when API is unavailable
- [ ] Verify admin error emails when API fails
- [ ] Test with various product/color/size combinations
- [ ] Test LTM fee application (if applicable)
- [ ] Test with and without artwork files

### Production Deployment

- [ ] Update EmailJS template IDs in service class
- [ ] Verify Stripe production keys (if using payments)
- [ ] Test with real order data (mark as test order)
- [ ] Verify hourly import picks up orders
- [ ] Monitor first few production orders closely
- [ ] Set up error monitoring/alerting
- [ ] Document order number format for staff
- [ ] Train staff on order lookup in ShopWorks

---

## 🔗 Related Documentation

- **[SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)** - Complete API schema navigation
- **[IMPLEMENTATION_EXAMPLES.md](IMPLEMENTATION_EXAMPLES.md)** - Working code examples
- **[Field Reference](FIELD_REFERENCE_CORE.md)** - All 165 API fields documented
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

---

## ✅ Final Notes

This implementation guide is based on the production 3-Day Tees order service which has been tested and verified to work with ShopWorks OnSite 7. The patterns shown here can be adapted for any webstore or online ordering system.

**Key Success Factors:**
1. Use BASE part numbers (never size variants)
2. Use CATALOG_COLOR format for colors
3. One line item per color/size combination
4. Include robust fallback mechanisms
5. Always send confirmation emails (even if API fails)
6. Log extensively for debugging
7. Test with sample data before going live

**Support:**
- ShopWorks OnSite documentation
- ManageOrders API support
- EmailJS documentation
- Stripe payment documentation

---

**Documentation Type:** Complete Implementation Guide
**Based On:** `three-day-tees-order-service.js` (production implementation)
**Last Updated:** 2025-11-19
**Version:** 1.0.0
