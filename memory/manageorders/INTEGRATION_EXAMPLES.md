# ManageOrders API - Integration Examples

**Last Updated:** 2025-01-27
**Purpose:** Working code examples for all ManageOrders API integrations
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Status:** Production-ready examples with tested code

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

## Real-Time Inventory Webstore

### Use Case

**Webstore:** Show real-time stock levels and prevent out-of-stock orders.

### Complete Implementation

```javascript
// webstore-inventory.js
class WebstoreInventory {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes (matches API cache)
    }

    async checkStock(partNumber, color) {
        const cacheKey = `${partNumber}:${color}`;

        // Check browser cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('[WebstoreInventory] Using browser cache');
                return cached.data;
            }
        }

        try {
            const response = await fetch(
                `${this.apiBase}/api/manageorders/inventorylevels?PartNumber=${partNumber}&Color=${encodeURIComponent(color)}`
            );
            const data = await response.json();

            if (!data.result || data.result.length === 0) {
                return {
                    available: false,
                    message: 'Product not found in inventory',
                    totalStock: 0
                };
            }

            const inventory = data.result[0];

            // Calculate total stock
            const totalStock =
                (inventory.Size01 || 0) +
                (inventory.Size02 || 0) +
                (inventory.Size03 || 0) +
                (inventory.Size04 || 0) +
                (inventory.Size05 || 0) +
                (inventory.Size06 || 0);

            const result = {
                available: totalStock > 0,
                totalStock: totalStock,
                sizeBreakdown: {
                    'XS': inventory.Size01 || 0,
                    'S': inventory.Size02 || 0,
                    'M': inventory.Size03 || 0,
                    'L': inventory.Size04 || 0,
                    'XL': inventory.Size05 || 0,
                    '2XL': inventory.Size06 || 0
                },
                vendorName: inventory.VendorName,
                description: inventory.Description,
                cacheAge: data.cacheAge
            };

            // Cache result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('[WebstoreInventory] Error:', error);
            return {
                available: false,
                message: 'Unable to check inventory. Please contact us.',
                totalStock: 0
            };
        }
    }

    displayStockStatus(containerId, stockData) {
        const container = document.getElementById(containerId);

        if (!stockData.available) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${stockData.message}
                    <br><small>Contact us for availability: 253-922-5793</small>
                </div>
            `;
            return;
        }

        let html = '<div class="stock-status">';

        // Stock level indicator
        const stockClass = stockData.totalStock > 100 ? 'text-success' :
                          stockData.totalStock > 20 ? 'text-warning' : 'text-danger';

        html += `<p class="${stockClass}">
            <i class="fas fa-check-circle"></i>
            <strong>${stockData.totalStock} items in stock</strong>
        </p>`;

        // Size availability
        html += '<div class="size-availability">';
        html += '<h6>Available Sizes:</h6>';
        html += '<div class="row">';

        Object.entries(stockData.sizeBreakdown).forEach(([size, qty]) => {
            const available = qty > 0;
            const btnClass = available ? 'btn-outline-primary' : 'btn-outline-secondary disabled';

            html += `<div class="col-3 mb-2">
                <button class="btn ${btnClass} btn-sm w-100"
                        data-size="${size}"
                        data-qty="${qty}"
                        ${!available ? 'disabled' : ''}>
                    ${size}
                    ${available ? `<br><small>(${qty})</small>` : '<br><small>Out</small>'}
                </button>
            </div>`;
        });

        html += '</div></div></div>';

        container.innerHTML = html;

        // Add click handlers for size selection
        container.querySelectorAll('.btn-outline-primary').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                const maxQty = parseInt(btn.dataset.qty);
                selectSize(size, maxQty);
            });
        });
    }

    async refreshStock(partNumber, color, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Checking stock...</div>';

        // Force fresh data
        const response = await fetch(
            `${this.apiBase}/api/manageorders/inventorylevels?PartNumber=${partNumber}&Color=${encodeURIComponent(color)}&refresh=true`
        );
        const data = await response.json();

        const stockData = await this.checkStock(partNumber, color);
        this.displayStockStatus(containerId, stockData);
    }
}

// Usage in webstore product page
document.addEventListener('DOMContentLoaded', async () => {
    const inventory = new WebstoreInventory();

    // When product/color is selected
    document.getElementById('colorSelect').addEventListener('change', async (e) => {
        const partNumber = document.getElementById('styleNumber').value;
        const color = e.target.value;

        if (!partNumber || !color) return;

        // Check stock
        const stockData = await inventory.checkStock(partNumber, color);

        // Display stock status
        inventory.displayStockStatus('stock-status-container', stockData);

        // Enable/disable "Add to Cart" based on availability
        const addToCartBtn = document.getElementById('addToCart');
        if (stockData.available) {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = 'Add to Cart';
        } else {
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = 'Out of Stock';
        }
    });

    // Manual refresh button
    document.getElementById('refreshStock')?.addEventListener('click', async () => {
        const partNumber = document.getElementById('styleNumber').value;
        const color = document.getElementById('colorSelect').value;

        await inventory.refreshStock(partNumber, color, 'stock-status-container');
    });
});

function selectSize(size, maxQty) {
    // Update quantity selector
    const qtySelect = document.getElementById('quantitySelect');
    qtySelect.innerHTML = '';

    for (let i = 1; i <= Math.min(maxQty, 50); i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        qtySelect.appendChild(option);
    }

    // Store selected size
    document.getElementById('selectedSize').value = size;

    console.log(`Selected size ${size}, max quantity: ${maxQty}`);
}
```

**HTML in Webstore:**
```html
<div class="product-page">
    <h2 id="productName">Port & Company Core Cotton Tee</h2>

    <div class="form-group">
        <label>Color</label>
        <select id="colorSelect" class="form-control">
            <option value="">Choose color...</option>
            <option value="Jet Black">Jet Black</option>
            <option value="White">White</option>
            <option value="Navy">Navy</option>
        </select>
    </div>

    <div id="stock-status-container" class="mt-3"></div>

    <input type="hidden" id="styleNumber" value="PC54">
    <input type="hidden" id="selectedSize">

    <button id="addToCart" class="btn btn-success btn-lg" disabled>
        Select Color to Check Stock
    </button>

    <button id="refreshStock" class="btn btn-sm btn-outline-secondary ms-2">
        <i class="fas fa-sync"></i> Refresh Stock
    </button>
</div>

<script src="/js/webstore-inventory.js"></script>
```

---

## Payment Status Dashboard

### Use Case

**Accounting Dashboard:** Show recent payments and outstanding invoices.

### Implementation

```javascript
// payment-dashboard.js
class PaymentDashboard {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    async loadPayments(days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        try {
            const response = await fetch(
                `${this.apiBase}/api/manageorders/payments?date_start=${startDate}&date_end=${endDate}`
            );
            const data = await response.json();
            return data.result || [];

        } catch (error) {
            console.error('[PaymentDashboard] Error:', error);
            return [];
        }
    }

    async display(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="text-center"><div class="spinner-border"></div> Loading payments...</div>';

        const payments = await this.loadPayments(30);

        if (payments.length === 0) {
            container.innerHTML = '<p class="text-muted">No recent payments found</p>';
            return;
        }

        // Calculate statistics
        const stats = {
            totalPaid: payments.filter(p => p.Status === 'Paid').reduce((sum, p) => sum + p.AmountPaid, 0),
            totalOutstanding: payments.filter(p => p.Balance > 0).reduce((sum, p) => sum + p.Balance, 0),
            overdueCount: payments.filter(p => p.Balance > 0 && new Date(p.DueDate) < new Date()).length
        };

        let html = '<div class="payment-dashboard">';

        // Statistics
        html += '<div class="row mb-4">';
        html += `<div class="col-md-4">
            <div class="stat-card bg-success text-white">
                <div class="stat-value">$${stats.totalPaid.toFixed(2)}</div>
                <div class="stat-label">Paid (30 days)</div>
            </div>
        </div>`;
        html += `<div class="col-md-4">
            <div class="stat-card bg-warning text-white">
                <div class="stat-value">$${stats.totalOutstanding.toFixed(2)}</div>
                <div class="stat-label">Outstanding</div>
            </div>
        </div>`;
        html += `<div class="col-md-4">
            <div class="stat-card bg-danger text-white">
                <div class="stat-value">${stats.overdueCount}</div>
                <div class="stat-label">Overdue Invoices</div>
            </div>
        </div>`;
        html += '</div>';

        // Payments table
        html += '<h5>Recent Payments</h5>';
        html += '<div class="table-responsive">';
        html += '<table class="table table-striped">';
        html += `<thead>
            <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
            </tr>
        </thead><tbody>`;

        payments.forEach(payment => {
            const statusClass = payment.Status === 'Paid' ? 'bg-success' :
                              payment.Balance > 0 && new Date(payment.DueDate) < new Date() ? 'bg-danger' : 'bg-warning';

            html += `<tr>
                <td>${payment.InvoiceNumber}</td>
                <td>${new Date(payment.InvoiceDate).toLocaleDateString()}</td>
                <td>$${payment.InvoiceAmount.toFixed(2)}</td>
                <td>$${payment.AmountPaid.toFixed(2)}</td>
                <td>$${payment.Balance.toFixed(2)}</td>
                <td><span class="badge ${statusClass}">${payment.Status}</span></td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';

        container.innerHTML = html;
    }
}

// Usage
document.addEventListener('DOMContentLoaded', async () => {
    const dashboard = new PaymentDashboard();
    await dashboard.display('payment-dashboard-container');

    // Auto-refresh every 5 minutes
    setInterval(() => {
        dashboard.display('payment-dashboard-container');
    }, 5 * 60 * 1000);
});
```

---

## Shipment Tracking Widget

### Use Case

**Customer Portal:** Allow customers to track their shipment.

### Implementation

```javascript
// tracking-widget.js
class TrackingWidget {
    constructor(orderNo) {
        this.orderNo = orderNo;
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    async loadTracking() {
        try {
            const response = await fetch(
                `${this.apiBase}/api/manageorders/tracking/${this.orderNo}`
            );
            const data = await response.json();
            return data.result && data.result.length > 0 ? data.result[0] : null;

        } catch (error) {
            console.error('[TrackingWidget] Error:', error);
            return null;
        }
    }

    async display(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Loading tracking...</div>';

        const tracking = await this.loadTracking();

        if (!tracking) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    Tracking information not available yet. Your order is being prepared for shipment.
                </div>
            `;
            return;
        }

        let html = '<div class="tracking-widget card">';
        html += '<div class="card-body">';

        html += `<h5 class="card-title">
            <i class="fas fa-shipping-fast"></i> Shipment Tracking
        </h5>`;

        html += `<div class="row">
            <div class="col-md-6">
                <p><strong>Carrier:</strong> ${tracking.Carrier}</p>
                <p><strong>Ship Date:</strong> ${new Date(tracking.ShipDate).toLocaleDateString()}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Tracking Number:</strong><br>
                    <a href="${this.getTrackingURL(tracking.Carrier, tracking.TrackingNumber)}"
                       target="_blank"
                       class="btn btn-sm btn-primary">
                        ${tracking.TrackingNumber} <i class="fas fa-external-link-alt"></i>
                    </a>
                </p>
            </div>
        </div>`;

        html += `<div class="tracking-status mt-3">
            <div class="alert alert-${this.getStatusAlertClass(tracking.Status)}">
                <strong>Status:</strong> ${tracking.Status}
            </div>
        </div>`;

        if (tracking.EstimatedDelivery) {
            html += `<p class="text-muted">
                <i class="fas fa-calendar"></i>
                Estimated Delivery: ${new Date(tracking.EstimatedDelivery).toLocaleDateString()}
            </p>`;
        }

        html += '</div></div>';

        container.innerHTML = html;
    }

    getTrackingURL(carrier, trackingNumber) {
        const urls = {
            'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
            'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
            'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
        };
        return urls[carrier] || '#';
    }

    getStatusAlertClass(status) {
        const classes = {
            'In Transit': 'info',
            'Out for Delivery': 'warning',
            'Delivered': 'success',
            'Exception': 'danger'
        };
        return classes[status] || 'secondary';
    }
}

// Usage in customer portal
async function showTracking(orderNo) {
    const widget = new TrackingWidget(orderNo);
    await widget.display('tracking-container');
}
```

---

## Complete Order Details Page

### Use Case

**Sales Rep Tool:** View complete order information in one page.

### Implementation

```javascript
// order-details-page.js
class OrderDetailsPage {
    constructor(orderNo) {
        this.orderNo = orderNo;
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    async loadAllData() {
        const [order, lineItems, payments, tracking] = await Promise.all([
            this.fetchOrder(),
            this.fetchLineItems(),
            this.fetchPayments(),
            this.fetchTracking()
        ]);

        return { order, lineItems, payments, tracking };
    }

    async fetchOrder() {
        const response = await fetch(`${this.apiBase}/api/manageorders/orders/${this.orderNo}`);
        const data = await response.json();
        return data.result && data.result.length > 0 ? data.result[0] : null;
    }

    async fetchLineItems() {
        const response = await fetch(`${this.apiBase}/api/manageorders/lineitems/${this.orderNo}`);
        const data = await response.json();
        return data.result || [];
    }

    async fetchPayments() {
        const response = await fetch(`${this.apiBase}/api/manageorders/payments/${this.orderNo}`);
        const data = await response.json();
        return data.result || [];
    }

    async fetchTracking() {
        const response = await fetch(`${this.apiBase}/api/manageorders/tracking/${this.orderNo}`);
        const data = await response.json();
        return data.result && data.result.length > 0 ? data.result[0] : null;
    }

    async display(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div><br>Loading order details...</div>';

        try {
            const data = await this.loadAllData();

            if (!data.order) {
                container.innerHTML = '<div class="alert alert-danger">Order not found</div>';
                return;
            }

            let html = this.renderOrderHeader(data.order);
            html += this.renderLineItems(data.lineItems);
            html += this.renderPayments(data.payments);
            html += this.renderTracking(data.tracking);

            container.innerHTML = html;

        } catch (error) {
            console.error('[OrderDetailsPage] Error:', error);
            container.innerHTML = `<div class="alert alert-danger">Failed to load order: ${error.message}</div>`;
        }
    }

    renderOrderHeader(order) {
        return `
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h4 class="mb-0">Order ${order.ext_order_id}</h4>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Customer Information</h6>
                            <p><strong>Company:</strong> ${order.CustomerName}</p>
                            <p><strong>Contact:</strong> ${order.ContactName || 'N/A'}</p>
                            <p><strong>Email:</strong> ${order.ContactEmail || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${order.ContactPhone || 'N/A'}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Order Information</h6>
                            <p><strong>Order Date:</strong> ${new Date(order.date_Ordered).toLocaleDateString()}</p>
                            <p><strong>Due Date:</strong> ${new Date(order.date_Due).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> <span class="badge ${this.getStatusClass(order.Status)}">${order.Status}</span></p>
                            <p><strong>Total:</strong> $${order.Total.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLineItems(items) {
        if (items.length === 0) {
            return '<div class="alert alert-info">No line items found</div>';
        }

        let html = '<div class="card mb-3">';
        html += '<div class="card-header"><h5 class="mb-0">Products</h5></div>';
        html += '<div class="card-body">';
        html += '<table class="table">';
        html += '<thead><tr><th>Product</th><th>Color</th><th>Sizes</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>';
        html += '<tbody>';

        items.forEach(item => {
            const sizes = this.formatSizes(item);
            html += `<tr>
                <td>${item.Description}</td>
                <td>${item.Color}</td>
                <td><small>${sizes}</small></td>
                <td>${item.Quantity}</td>
                <td>$${item.UnitPrice.toFixed(2)}</td>
                <td>$${item.ExtPrice.toFixed(2)}</td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    renderPayments(payments) {
        if (payments.length === 0) {
            return '<div class="alert alert-info">No payment information available</div>';
        }

        const payment = payments[0];

        return `
            <div class="card mb-3">
                <div class="card-header"><h5 class="mb-0">Payment Information</h5></div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Invoice Number:</strong> ${payment.InvoiceNumber}</p>
                            <p><strong>Invoice Date:</strong> ${new Date(payment.InvoiceDate).toLocaleDateString()}</p>
                            <p><strong>Invoice Amount:</strong> $${payment.InvoiceAmount.toFixed(2)}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Amount Paid:</strong> $${payment.AmountPaid.toFixed(2)}</p>
                            <p><strong>Balance:</strong> $${payment.Balance.toFixed(2)}</p>
                            <p><strong>Status:</strong> <span class="badge ${payment.Status === 'Paid' ? 'bg-success' : 'bg-warning'}">${payment.Status}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderTracking(tracking) {
        if (!tracking) {
            return '<div class="alert alert-info">Tracking information not available yet</div>';
        }

        return `
            <div class="card mb-3">
                <div class="card-header"><h5 class="mb-0">Shipment Tracking</h5></div>
                <div class="card-body">
                    <p><strong>Carrier:</strong> ${tracking.Carrier}</p>
                    <p><strong>Tracking Number:</strong>
                        <a href="#" target="_blank">${tracking.TrackingNumber}</a>
                    </p>
                    <p><strong>Ship Date:</strong> ${new Date(tracking.ShipDate).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span class="badge bg-info">${tracking.Status}</span></p>
                </div>
            </div>
        `;
    }

    formatSizes(item) {
        const sizes = [];
        if (item.Size01 > 0) sizes.push(`XS:${item.Size01}`);
        if (item.Size02 > 0) sizes.push(`S:${item.Size02}`);
        if (item.Size03 > 0) sizes.push(`M:${item.Size03}`);
        if (item.Size04 > 0) sizes.push(`L:${item.Size04}`);
        if (item.Size05 > 0) sizes.push(`XL:${item.Size05}`);
        if (item.Size06 > 0) sizes.push(`2XL:${item.Size06}`);
        return sizes.join(', ') || 'N/A';
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

// Usage
const urlParams = new URLSearchParams(window.location.search);
const orderNo = urlParams.get('order');

if (orderNo) {
    const page = new OrderDetailsPage(parseInt(orderNo));
    page.display('order-details-container');
}
```

---

**Documentation Type:** Working Integration Examples
**Parent Document:** [MANAGEORDERS_INTEGRATION.md](../MANAGEORDERS_INTEGRATION.md)
**Related:** [API Reference](API_REFERENCE.md) | [Customer Autocomplete](CUSTOMER_AUTOCOMPLETE.md) | [Overview](OVERVIEW.md)
