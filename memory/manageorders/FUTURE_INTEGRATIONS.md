# ManageOrders API - Future Integration Opportunities

**Last Updated:** 2025-01-27
**Purpose:** Roadmap and implementation guidance for future ManageOrders integrations
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Status:** Planning phase

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Order History Lookup](#order-history-lookup)
3. [Invoice Search & Status](#invoice-search--status)
4. [Real-Time Inventory Sync](#real-time-inventory-sync)
5. [Payment Tracking Integration](#payment-tracking-integration)
6. [Shipment Tracking](#shipment-tracking)
7. [Priority Matrix](#priority-matrix)

---

## Overview

### Current vs. Potential Usage

**Currently Implemented:**
- Customer Autocomplete (1 endpoint: `GET /api/orders`)
- 389 customers from last 60 days
- 24-hour browser caching
- Production-ready in Screen Print Quote Builder

**Available Endpoints (Not Yet Used):**
- 9 additional endpoints across 5 categories
- Order CRUD operations (create, update, delete)
- Line items (product details)
- Shipments (tracking information)
- Payments (invoice status)
- Inventory (stock levels)

**Potential Impact:**
- **Time Savings:** 2-3 hours per day for sales team
- **Data Accuracy:** Eliminate manual data entry errors
- **Customer Experience:** Faster quotes, accurate delivery dates
- **Inventory Management:** Real-time stock visibility
- **Order Tracking:** Automated status updates

---

## Order History Lookup

### Use Case

**Problem:**
Sales rep needs to know:
- What products customer ordered previously
- Typical order size and frequency
- Past pricing for reference
- Previous sales rep relationship

**Current Process:**
1. Sales rep opens ShopWorks
2. Searches for customer
3. Reviews order history manually
4. Returns to web quote builder

**Time Required:** 3-5 minutes per quote

### Proposed Solution

**Feature:** "View Order History" button in quote builder

**User Experience:**
1. Sales rep starts typing customer name
2. Autocomplete suggests "Arrow Lumber and Hardware"
3. Rep clicks customer → 5 fields populate
4. Rep clicks "View Order History" button
5. Modal appears with last 10 orders instantly
6. Rep can click order to see full details

**Time Required:** 10-20 seconds

### Implementation

**UI Component:**
```html
<!-- Add button next to company name field -->
<div class="customer-actions">
    <button id="view-history-btn" class="btn btn-sm btn-outline-primary"
            style="display:none;" onclick="showOrderHistory()">
        <i class="fas fa-history"></i> View Order History
    </button>
</div>

<!-- Modal for order history -->
<div id="order-history-modal" class="modal">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Order History - <span id="modal-customer-name"></span></h5>
                <button type="button" class="close" onclick="closeOrderHistory()">×</button>
            </div>
            <div class="modal-body">
                <div id="order-history-content">
                    <!-- Populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>
</div>
```

**JavaScript:**
```javascript
async function showOrderHistory() {
    const customer = getSelectedCustomer();
    if (!customer) return;

    // Show loading state
    showModal('order-history-modal');
    document.getElementById('order-history-content').innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        // Fetch order history from proxy
        const response = await fetch(`https://caspio-pricing-proxy.herokuapp.com/api/manageorders/orders?id_Customer=${customer.id_Customer}`);
        const orders = await response.json();

        // Display orders
        displayOrderHistory(orders);

    } catch (error) {
        console.error('[OrderHistory] Error:', error);
        document.getElementById('order-history-content').innerHTML = '<div class="alert alert-danger">Failed to load order history</div>';
    }
}

function displayOrderHistory(orders) {
    if (orders.length === 0) {
        document.getElementById('order-history-content').innerHTML = '<p class="text-muted">No previous orders found.</p>';
        return;
    }

    const html = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${orders.slice(0, 10).map(order => `
                    <tr>
                        <td>${order.ExtOrderID || order.id_Order}</td>
                        <td>${new Date(order.OrderDate).toLocaleDateString()}</td>
                        <td><span class="badge badge-${getStatusColor(order.Status)}">${order.Status}</span></td>
                        <td>$${order.Total.toFixed(2)}</td>
                        <td><button class="btn btn-sm btn-link" onclick="viewOrderDetails(${order.id_Order})">Details</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('order-history-content').innerHTML = html;
}
```

**Server-Side (caspio-pricing-proxy):**
```javascript
// Add new endpoint
router.get('/orders', async (req, res) => {
    try {
        const { id_Customer } = req.query;

        if (!id_Customer) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'id_Customer is required'
            });
        }

        const token = await getAuthToken();

        // Fetch orders for specific customer
        const response = await fetch(
            `${MANAGEORDERS_API_URL}/api/orders?id_Customer=${id_Customer}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const orders = await response.json();

        // Sort by date, newest first
        orders.sort((a, b) => new Date(b.OrderDate) - new Date(a.OrderDate));

        res.json(orders);

    } catch (error) {
        console.error('[ManageOrders] Error fetching orders:', error);
        res.status(500).json({
            error: 'Failed to fetch orders',
            message: error.message
        });
    }
});
```

**Effort Estimate:** 4-6 hours
**Priority:** High (immediate value to sales team)

---

## Invoice Search & Status

### Use Case

**Problem:**
Customer calls asking:
- "Has my invoice been paid?"
- "What's my current account balance?"
- "When is payment due?"

**Current Process:**
1. Sales rep searches ShopWorks
2. Opens customer account
3. Reviews payment history
4. Calls customer back with answer

**Time Required:** 5-10 minutes per inquiry

### Proposed Solution

**Feature:** "Payment Status" section in quote review

**User Experience:**
1. Sales rep creates quote for existing customer
2. Review screen shows:
   - Current balance: $1,250.00
   - Unpaid invoices: 2
   - Oldest invoice due: 2025-02-01 (5 days overdue)
3. Rep can address payment before submitting new quote

**Time Required:** Instant (automatic display)

### Implementation

**UI Component:**
```html
<!-- Add to review phase -->
<div class="payment-status-card" id="payment-status" style="display:none;">
    <div class="card">
        <div class="card-header bg-warning text-dark">
            <i class="fas fa-exclamation-triangle"></i> Payment Status
        </div>
        <div class="card-body">
            <p><strong>Current Balance:</strong> $<span id="balance-amount">0.00</span></p>
            <p><strong>Unpaid Invoices:</strong> <span id="unpaid-count">0</span></p>
            <p><strong>Oldest Due Date:</strong> <span id="oldest-due">N/A</span></p>
            <button class="btn btn-sm btn-primary" onclick="viewPaymentDetails()">View Details</button>
        </div>
    </div>
</div>
```

**JavaScript:**
```javascript
async function checkPaymentStatus(customerId) {
    try {
        const response = await fetch(`https://caspio-pricing-proxy.herokuapp.com/api/manageorders/payments?id_Customer=${customerId}&Status=Pending`);
        const payments = await response.json();

        if (payments.length === 0) {
            // No outstanding payments - hide card
            document.getElementById('payment-status').style.display = 'none';
            return;
        }

        // Calculate totals
        const totalBalance = payments.reduce((sum, p) => sum + p.Balance, 0);
        const unpaidCount = payments.length;
        const oldestDue = new Date(Math.min(...payments.map(p => new Date(p.DueDate))));

        // Display status
        document.getElementById('balance-amount').textContent = totalBalance.toFixed(2);
        document.getElementById('unpaid-count').textContent = unpaidCount;
        document.getElementById('oldest-due').textContent = oldestDue.toLocaleDateString();
        document.getElementById('payment-status').style.display = 'block';

    } catch (error) {
        console.error('[PaymentStatus] Error:', error);
    }
}
```

**Server-Side:**
```javascript
router.get('/payments', async (req, res) => {
    try {
        const { id_Customer, Status } = req.query;

        const token = await getAuthToken();

        let url = `${MANAGEORDERS_API_URL}/api/payments`;
        const params = new URLSearchParams();
        if (id_Customer) params.append('id_Customer', id_Customer);
        if (Status) params.append('Status', Status);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const payments = await response.json();
        res.json(payments);

    } catch (error) {
        console.error('[ManageOrders] Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});
```

**Effort Estimate:** 3-4 hours
**Priority:** Medium (helpful but not critical)

---

## Real-Time Inventory Sync

### Use Case

**Problem:**
Customer wants 200 black shirts:
- Sales rep checks inventory manually in ShopWorks
- Inventory might change between check and quote
- Customer may be disappointed if product out of stock

**Current Process:**
1. Customer requests product in specific color/size
2. Sales rep switches to ShopWorks
3. Checks inventory levels
4. Returns to quote builder

**Time Required:** 2-3 minutes per product check

### Proposed Solution

**Feature:** Real-time stock badges on product cards

**User Experience:**
1. Sales rep selects product (e.g., Gildan 5000)
2. Color selector shows: "Black (500 available)"
3. User enters quantity: 200
4. System shows: "✓ In Stock" with green checkmark
5. If user enters 600: "⚠️ Only 500 available. 100 more on order (arrives Feb 5)"

**Time Required:** Instant (automatic display)

### Implementation

**UI Component:**
```html
<!-- Add to product card -->
<div class="product-card">
    <h5>Gildan 5000 - Black</h5>
    <div class="stock-badge" id="stock-badge-G5000-BLK">
        <i class="fas fa-sync fa-spin"></i> Checking stock...
    </div>
</div>
```

**JavaScript:**
```javascript
async function checkInventory(styleNumber, color, quantity) {
    try {
        const response = await fetch(`https://caspio-pricing-proxy.herokuapp.com/api/manageorders/inventory?styleNumber=${styleNumber}&color=${color}`);
        const inventory = await response.json();

        if (inventory.length === 0) {
            return { available: 0, onOrder: 0, eta: null };
        }

        // Sum across all sizes
        const totalAvailable = inventory.reduce((sum, item) => sum + item.QuantityAvailable, 0);
        const totalOnOrder = inventory.reduce((sum, item) => sum + item.QuantityOnOrder, 0);

        return {
            available: totalAvailable,
            onOrder: totalOnOrder,
            sufficient: quantity <= totalAvailable
        };

    } catch (error) {
        console.error('[Inventory] Error:', error);
        return null;
    }
}

function displayStockStatus(styleNumber, color, inventory) {
    const badge = document.getElementById(`stock-badge-${styleNumber}-${color}`);

    if (!inventory) {
        badge.innerHTML = '<i class="fas fa-question-circle text-muted"></i> Unable to check stock';
        return;
    }

    if (inventory.sufficient) {
        badge.innerHTML = `<i class="fas fa-check-circle text-success"></i> In Stock (${inventory.available} available)`;
        badge.className = 'stock-badge badge-success';
    } else if (inventory.onOrder > 0) {
        badge.innerHTML = `<i class="fas fa-exclamation-triangle text-warning"></i> ${inventory.available} available, ${inventory.onOrder} on order`;
        badge.className = 'stock-badge badge-warning';
    } else {
        badge.innerHTML = `<i class="fas fa-times-circle text-danger"></i> Out of Stock`;
        badge.className = 'stock-badge badge-danger';
    }
}
```

**Server-Side:**
```javascript
router.get('/inventory', async (req, res) => {
    try {
        const { styleNumber, color } = req.query;

        const token = await getAuthToken();

        let url = `${MANAGEORDERS_API_URL}/api/inventoryLevels`;
        const params = new URLSearchParams();
        if (styleNumber) params.append('styleNumber', styleNumber);
        if (color) params.append('color', color);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const inventory = await response.json();
        res.json(inventory);

    } catch (error) {
        console.error('[ManageOrders] Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});
```

**Effort Estimate:** 6-8 hours (requires product catalog integration)
**Priority:** Medium (valuable but complex)

---

## Payment Tracking Integration

### Use Case

**Problem:**
- Customer pays online via Stripe
- Payment not immediately reflected in ShopWorks
- Manual reconciliation required

**Current Process:**
1. Customer completes Stripe payment
2. Accountant exports Stripe transactions
3. Manually matches to ShopWorks invoices
4. Updates payment status in ShopWorks

**Time Required:** 1-2 hours per week

### Proposed Solution

**Feature:** Automatic payment status sync

**Workflow:**
1. Customer receives quote via email
2. Customer clicks "Pay Online" link
3. Stripe payment processed
4. Webhook calls caspio-pricing-proxy
5. Proxy updates ManageOrders payment status
6. Customer receives payment confirmation
7. ShopWorks automatically updated

**Time Required:** Instant (automatic)

### Implementation

**Stripe Webhook Handler:**
```javascript
// caspio-pricing-proxy
router.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
        const payment = event.data.object;

        // Extract order ID from metadata
        const orderId = payment.metadata.orderId;

        // Update ManageOrders payment status
        await updatePaymentStatus(orderId, {
            AmountPaid: payment.amount / 100, // Convert from cents
            PaymentDate: new Date().toISOString(),
            PaymentMethod: 'Credit Card',
            PaymentReference: payment.id,
            Status: 'Paid'
        });
    }

    res.json({received: true});
});

async function updatePaymentStatus(orderId, paymentData) {
    try {
        const token = await getAuthToken();

        // Get existing payment record
        const response = await fetch(
            `${MANAGEORDERS_API_URL}/api/payments?id_Order=${orderId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        const payments = await response.json();

        if (payments.length === 0) {
            // Create new payment record
            await fetch(`${MANAGEORDERS_API_URL}/api/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_Order: orderId,
                    ...paymentData
                })
            });
        } else {
            // Update existing payment
            const paymentId = payments[0].id_Payment;

            await fetch(`${MANAGEORDERS_API_URL}/api/payments/${paymentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
            });
        }

        console.log(`[Payment] ✓ Updated payment for order ${orderId}`);

    } catch (error) {
        console.error('[Payment] Error updating status:', error);
        throw error;
    }
}
```

**Effort Estimate:** 8-12 hours (requires Stripe integration)
**Priority:** Low (future enhancement)

---

## Shipment Tracking

### Use Case

**Problem:**
Customer asks: "Where is my order?"

**Current Process:**
1. Customer calls or emails
2. Sales rep checks ShopWorks for tracking number
3. Sales rep looks up tracking on carrier website
4. Sales rep calls/emails customer with update

**Time Required:** 5-10 minutes per inquiry

### Proposed Solution

**Feature:** Automated tracking link in order confirmation email

**Workflow:**
1. Order ships from production
2. Tracking number entered in ShopWorks
3. Customer receives automatic email:
   - "Your order has shipped!"
   - Tracking number: 1Z999AA10123456784
   - Track your package: [Link]
4. Customer clicks link → sees real-time tracking

**Time Required:** Instant (automatic)

### Implementation

**Monitor Shipments:**
```javascript
// Scheduled job (runs every 15 minutes)
async function checkNewShipments() {
    try {
        const token = await getAuthToken();

        // Get shipments from last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const fromDate = oneHourAgo.toISOString().split('T')[0];

        const response = await fetch(
            `${MANAGEORDERS_API_URL}/api/shipments?fromDate=${fromDate}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        const shipments = await response.json();

        // Send notification for each new shipment
        for (const shipment of shipments) {
            await sendShipmentNotification(shipment);
        }

    } catch (error) {
        console.error('[Shipments] Error checking shipments:', error);
    }
}

async function sendShipmentNotification(shipment) {
    // Get order details
    const order = await getOrderById(shipment.id_Order);

    // Send email via EmailJS
    await emailjs.send('service_1c4k67j', 'template_shipment_notification', {
        to_email: order.ContactEmail,
        to_name: order.ContactFirstName,
        order_id: order.ExtOrderID,
        tracking_number: shipment.TrackingNumber,
        carrier: shipment.Carrier,
        tracking_url: getTrackingURL(shipment.Carrier, shipment.TrackingNumber),
        estimated_delivery: new Date(shipment.EstimatedDelivery).toLocaleDateString()
    });

    console.log(`[Shipments] ✓ Sent notification for order ${order.ExtOrderID}`);
}

function getTrackingURL(carrier, trackingNumber) {
    const urls = {
        'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
        'FedEx': `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`,
        'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
    };

    return urls[carrier] || '#';
}
```

**Effort Estimate:** 6-8 hours (requires EmailJS template)
**Priority:** Medium (good customer experience improvement)

---

## Priority Matrix

### Implementation Roadmap

**Phase 1: Quick Wins (Weeks 1-2)**
- [x] Customer Autocomplete ✅ COMPLETE
- [ ] Order History Lookup (4-6 hours)
- [ ] Invoice Search & Status (3-4 hours)

**Total Effort:** 7-10 hours
**Impact:** High (immediate value to sales team)

**Phase 2: Customer Experience (Weeks 3-4)**
- [ ] Shipment Tracking (6-8 hours)
- [ ] Real-Time Inventory Sync (6-8 hours)

**Total Effort:** 12-16 hours
**Impact:** Medium (improves customer satisfaction)

**Phase 3: Automation (Month 2)**
- [ ] Payment Tracking Integration (8-12 hours)
- [ ] Automated status updates
- [ ] Advanced reporting

**Total Effort:** 15-20 hours
**Impact:** High (reduces manual work significantly)

### Priority Matrix

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| Customer Autocomplete | Low | High | P0 | ✅ Complete |
| Order History Lookup | Low | High | P1 | 📝 Planned |
| Invoice Search | Low | Medium | P1 | 📝 Planned |
| Shipment Tracking | Medium | Medium | P2 | 📝 Planned |
| Inventory Sync | Medium | Medium | P2 | 📝 Planned |
| Payment Integration | High | High | P3 | 📝 Future |

**P0:** Critical (already implemented)
**P1:** High Priority (next 2 weeks)
**P2:** Medium Priority (next month)
**P3:** Future Enhancement (3+ months)

---

## Success Metrics

### Quantitative Goals

**Phase 1 (Customer Autocomplete):**
- ✅ Reduce data entry time by 60 seconds per quote
- ✅ Eliminate typos in company names
- ✅ 100% accuracy in sales rep assignment

**Phase 2 (Order History + Invoices):**
- Reduce customer inquiry response time by 80%
- Eliminate need to switch between systems
- 5-minute time savings per inquiry × 20 inquiries/day = **100 minutes/day saved**

**Phase 3 (Inventory + Shipments):**
- Reduce out-of-stock surprises by 90%
- Eliminate manual tracking lookups
- Improve customer satisfaction score by 20%

**Phase 4 (Payment Integration):**
- Eliminate 2 hours/week of manual reconciliation
- Reduce payment processing time from 24 hours to instant
- **100+ hours/year saved**

### Qualitative Goals

- Improved customer experience (faster responses, accurate information)
- Reduced sales rep frustration (fewer system switches)
- Better data consistency across systems
- Increased confidence in quote accuracy

---

**Documentation Type:** Future Integration Roadmap
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [API Reference](API_REFERENCE.md) | [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md)
