# ManageOrders API - Basic Integration Examples

**Last Updated:** 2025-11-14
**Purpose:** Simple, single-endpoint integration examples
**Part:** 1 of 2 - Basic Examples
**Status:** Production-ready examples with tested code

## 📚 Complete Examples Navigation
- **Part 1: Basic Examples** (this file) - Simple single-endpoint integrations
- **Part 2:** [Advanced Examples](ADVANCED_EXAMPLES.md) - Multi-endpoint workflows, complex patterns

**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Order Status Lookup](#order-status-lookup)
3. [Order History Widget](#order-history-widget)
4. [Real-Time Inventory Webstore](#real-time-inventory-webstore)
5. [Payment Status Dashboard](#payment-status-dashboard)
6. [Shipment Tracking Widget](#shipment-tracking-widget)
7. [Complete Order Details Page](#complete-order-details-page)

---

## Overview

### All Endpoints Available NOW

**11 Production-Ready Endpoints:**
- ✅ Customer autocomplete (implemented in Screen Print Quote Builder)
- ✅ Order queries by date range
- ✅ Order lookup by order number or quote ID
- ✅ Line items (product details)
- ✅ Payments and invoices
- ✅ Shipment tracking
- ✅ **Real-time inventory** (5-minute cache) ⭐

**No "Future" Features - Everything is Ready to Use**

---

## Order Status Lookup

### Use Case

**Customer Portal:** Allow customers to check order status by entering their quote ID.

### Complete Implementation

```html
<!-- order-status.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Order Status - NWCA</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-5">
        <h2>Check Your Order Status</h2>
        <p class="text-muted">Enter your quote ID (e.g., SP0127-1) to check order status</p>

        <div class="row">
            <div class="col-md-6">
                <div class="input-group mb-3">
                    <input type="text"
                           id="quoteIdInput"
                           class="form-control"
                           placeholder="SP0127-1"
                           onkeypress="if(event.key==='Enter') lookupOrder()">
                    <button class="btn btn-primary" onclick="lookupOrder()">
                        Check Status
                    </button>
                </div>
            </div>
        </div>

        <div id="loading" style="display:none;">
            <div class="spinner-border text-primary"></div>
            <span class="ms-2">Looking up your order...</span>
        </div>

        <div id="error" class="alert alert-danger" style="display:none;"></div>

        <div id="orderDetails" style="display:none;">
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h5 class="mb-0">Order Found!</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Quote ID:</strong> <span id="quoteId"></span></p>
                            <p><strong>Company:</strong> <span id="companyName"></span></p>
                            <p><strong>Contact:</strong> <span id="contactName"></span></p>
                            <p><strong>Order Date:</strong> <span id="orderDate"></span></p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Due Date:</strong> <span id="dueDate"></span></p>
                            <p><strong>Status:</strong> <span id="status" class="badge"></span></p>
                            <p><strong>Total:</strong> $<span id="total"></span></p>
                        </div>
                    </div>

                    <button class="btn btn-sm btn-outline-primary" onclick="viewLineItems()">
                        View Products
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="viewTracking()">
                        Track Shipment
                    </button>
                </div>
            </div>

            <div id="lineItems" class="mt-3" style="display:none;"></div>
            <div id="tracking" class="mt-3" style="display:none;"></div>
        </div>
    </div>

    <script>
    const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    let currentOrderNo = null;

    async function lookupOrder() {
        const quoteId = document.getElementById('quoteIdInput').value.trim();

        if (!quoteId) {
            showError('Please enter a quote ID');
            return;
        }

        // Hide previous results
        document.getElementById('orderDetails').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('loading').style.display = 'block';

        try {
            // Step 1: Get order number from quote ID
            const mappingResponse = await fetch(
                `${API_BASE}/api/manageorders/getorderno/${quoteId}`
            );
            const mappingData = await mappingResponse.json();

            if (!mappingData.result || mappingData.result.length === 0) {
                throw new Error('Quote ID not found in ShopWorks. It may not have been imported yet.');
            }

            currentOrderNo = mappingData.result[0].order_no;

            // Step 2: Get full order details
            const orderResponse = await fetch(
                `${API_BASE}/api/manageorders/orders/${currentOrderNo}`
            );
            const orderData = await orderResponse.json();

            if (!orderData.result || orderData.result.length === 0) {
                throw new Error('Order details not found');
            }

            displayOrderDetails(orderData.result[0]);

        } catch (error) {
            showError(error.message);
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    function displayOrderDetails(order) {
        // Populate fields
        document.getElementById('quoteId').textContent = order.ext_order_id;
        document.getElementById('companyName').textContent = order.CustomerName;
        document.getElementById('contactName').textContent = order.ContactName || 'N/A';
        document.getElementById('orderDate').textContent = new Date(order.date_Ordered).toLocaleDateString();
        document.getElementById('dueDate').textContent = new Date(order.date_Due).toLocaleDateString();
        document.getElementById('total').textContent = order.Total.toFixed(2);

        // Status badge with color
        const statusBadge = document.getElementById('status');
        statusBadge.textContent = order.Status;
        statusBadge.className = 'badge ' + getStatusClass(order.Status);

        // Show order details
        document.getElementById('orderDetails').style.display = 'block';
    }

    async function viewLineItems() {
        const container = document.getElementById('lineItems');
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div></div>';
        container.style.display = 'block';

        try {
            const response = await fetch(
                `${API_BASE}/api/manageorders/lineitems/${currentOrderNo}`
            );
            const data = await response.json();

            if (!data.result || data.result.length === 0) {
                container.innerHTML = '<p class="text-muted">No products found</p>';
                return;
            }

            // Build product table
            let html = '<h5>Products</h5><table class="table table-sm">';
            html += '<thead><tr><th>Product</th><th>Color</th><th>Qty</th><th>Price</th></tr></thead><tbody>';

            data.result.forEach(item => {
                html += `<tr>
                    <td>${item.Description}</td>
                    <td>${item.Color}</td>
                    <td>${item.Quantity}</td>
                    <td>$${item.ExtPrice.toFixed(2)}</td>
                </tr>`;
            });

            html += '</tbody></table>';
            container.innerHTML = html;

        } catch (error) {
            container.innerHTML = `<p class="text-danger">Failed to load products: ${error.message}</p>`;
        }
    }

    async function viewTracking() {
        const container = document.getElementById('tracking');
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div></div>';
        container.style.display = 'block';

        try {
            const response = await fetch(
                `${API_BASE}/api/manageorders/tracking/${currentOrderNo}`
            );
            const data = await response.json();

            if (!data.result || data.result.length === 0) {
                container.innerHTML = '<p class="text-muted">No tracking information available yet</p>';
                return;
            }

            const tracking = data.result[0];
            let html = '<h5>Shipment Tracking</h5>';
            html += '<div class="card">';
            html += '<div class="card-body">';
            html += `<p><strong>Carrier:</strong> ${tracking.Carrier}</p>`;
            html += `<p><strong>Tracking Number:</strong> <a href="#" target="_blank">${tracking.TrackingNumber}</a></p>`;
            html += `<p><strong>Ship Date:</strong> ${new Date(tracking.ShipDate).toLocaleDateString()}</p>`;
            html += `<p><strong>Status:</strong> <span class="badge bg-info">${tracking.Status}</span></p>`;
            html += '</div></div>';

            container.innerHTML = html;

        } catch (error) {
            container.innerHTML = `<p class="text-danger">Failed to load tracking: ${error.message}</p>`;
        }
    }

    function getStatusClass(status) {
        const statusMap = {
            'Open': 'bg-primary',
            'In Production': 'bg-warning',
            'Complete': 'bg-success',
            'Shipped': 'bg-info',
            'Canceled': 'bg-danger'
        };
        return statusMap[status] || 'bg-secondary';
    }

    function showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    </script>
</body>
</html>
```

**Testing:**
```bash
# Open in browser
http://localhost:3000/order-status.html

# Enter test quote ID
SP0127-1
```

---

## Order History Widget

### Use Case

**Quote Builder Enhancement:** Show customer's previous orders when they're selected.

### Implementation

```javascript
// order-history-widget.js
class OrderHistoryWidget {
    constructor(customerId) {
        this.customerId = customerId;
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    async loadOrderHistory() {
        try {
            // Get last 90 days of orders for this customer
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            const response = await fetch(
                `${this.apiBase}/api/manageorders/orders?date_Ordered_start=${startDate}&date_Ordered_end=${endDate}&id_Customer=${this.customerId}`
            );
            const data = await response.json();

            return data.result || [];

        } catch (error) {
            console.error('[OrderHistory] Failed to load:', error);
            return [];
        }
    }

    async display(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Loading order history...</div>';

        const orders = await this.loadOrderHistory();

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-muted">No recent orders found</p>';
            return;
        }

        // Calculate statistics
        const stats = this.calculateStats(orders);

        let html = '<div class="order-history-widget">';

        // Statistics summary
        html += '<div class="row mb-3">';
        html += `<div class="col-md-4"><div class="stat-card"><div class="stat-value">${stats.totalOrders}</div><div class="stat-label">Total Orders</div></div></div>`;
        html += `<div class="col-md-4"><div class="stat-card"><div class="stat-value">$${stats.averageOrderValue.toFixed(0)}</div><div class="stat-label">Avg Order</div></div></div>`;
        html += `<div class="col-md-4"><div class="stat-card"><div class="stat-value">${stats.daysAgo}</div><div class="stat-label">Days Since Last Order</div></div></div>`;
        html += '</div>';

        // Recent orders table
        html += '<h6 class="mb-2">Recent Orders (Last 90 Days)</h6>';
        html += '<div class="table-responsive">';
        html += '<table class="table table-sm table-hover">';
        html += '<thead><tr><th>Quote ID</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>';
        html += '<tbody>';

        orders.slice(0, 5).forEach(order => {
            html += `<tr onclick="showOrderDetails(${order.order_no})" style="cursor:pointer;">
                <td>${order.ext_order_id}</td>
                <td>${new Date(order.date_Ordered).toLocaleDateString()}</td>
                <td>$${order.Total.toFixed(2)}</td>
                <td><span class="badge ${this.getStatusClass(order.Status)}">${order.Status}</span></td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';

        container.innerHTML = html;
    }

    calculateStats(orders) {
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + o.Total, 0);
        const averageOrderValue = totalRevenue / totalOrders;

        // Find most recent order
        const mostRecent = orders.reduce((latest, o) => {
            const orderDate = new Date(o.date_Ordered);
            return orderDate > new Date(latest.date_Ordered) ? o : latest;
        });

        const daysAgo = Math.floor(
            (Date.now() - new Date(mostRecent.date_Ordered)) / (24 * 60 * 60 * 1000)
        );

        return {
            totalOrders,
            averageOrderValue,
            daysAgo
        };
    }

    getStatusClass(status) {
        const statusMap = {
            'Open': 'bg-primary',
            'In Production': 'bg-warning',
            'Complete': 'bg-success',
            'Shipped': 'bg-info',
            'Canceled': 'bg-danger'
        };
        return statusMap[status] || 'bg-secondary';
    }
}

// Usage in quote builder
async function onCustomerSelected(customerId, customerName) {
    // Update form fields
    document.getElementById('companyName').value = customerName;

    // Show order history
    const widget = new OrderHistoryWidget(customerId);
    await widget.display('order-history-container');
}
```

**HTML in Quote Builder:**
```html
<!-- Add this container where you want order history to appear -->
<div id="order-history-container" class="mt-3"></div>

<style>
.stat-card {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
}
.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #2d5f3f;
}
.stat-label {
    font-size: 12px;
    color: #6c757d;
    text-transform: uppercase;
}
</style>

<script src="/shared_components/js/order-history-widget.js"></script>
```

---

