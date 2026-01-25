# CRM Dashboard Reconciliation

**Purpose:** Documents the dashboard sales reconciliation system, gap reports, and how to diagnose/fix authority conflicts between rep assignments and order data.

**Last Updated:** 2026-01-25

**Related:**
- [CRM_DASHBOARD_AUTH.md](./CRM_DASHBOARD_AUTH.md) - Authentication system
- [DAILY_SALES_ARCHIVE.md](./DAILY_SALES_ARCHIVE.md) - YTD sales tracking beyond 60-day limit
- [NIKA_DASHBOARD_BUILD_GUIDE.md](./NIKA_DASHBOARD_BUILD_GUIDE.md) - Dashboard implementation

---

## Dashboard Metrics Distinction (CRITICAL)

The most common confusion: **Team Performance and CRM YTD show DIFFERENT numbers by design.**

| Dashboard | What It Shows | Filter Logic |
|-----------|---------------|--------------|
| **Team Performance** | Orders **WRITTEN BY** rep | `CustomerServiceRep` field on the ORDER |
| **CRM YTD_Sales_2026** | Orders **FOR** rep's customers | Customer must be in rep's CRM account list |

**Why They Differ:**

The gap between these numbers represents "inbound" orders - orders written by OTHER reps for the customer's assigned accounts.

**Example:**
- Taneisha's CRM YTD: $98,039 (all orders for her customers)
- Team Performance: $85,050 (orders she personally wrote)
- Gap: $12,989 = orders written by other reps for Taneisha's customers

This is **expected behavior**, not a bug.

---

## Gap Report / Full Reconciliation

### Endpoint
`GET /api/house-accounts/full-reconciliation`

### Authentication
Requires `x-crm-api-secret` header.

### What It Shows
The Gap Report identifies **authority conflicts** - situations where:
1. A rep wrote an order for a customer NOT in their CRM (outbound)
2. Another rep wrote an order for a customer IN this rep's CRM (inbound)

### Response Structure
```json
{
  "success": true,
  "generatedAt": "2026-01-25T...",
  "totalConflicts": 2,
  "totalConflictAmount": 150.00,
  "reps": [
    {
      "rep": "Nika Lao",
      "conflictCount": 2,
      "totalAmount": 150.00,
      "conflicts": [
        {
          "ID_Customer": 9042,
          "companyName": "Les Schwab",
          "owner": "Nika Lao",
          "orderCount": 1,
          "totalSales": 125.00,
          "orders": [
            {
              "orderNumber": "140315",
              "amount": 125.00,
              "date": "2026-01-20",
              "writer": "House"
            }
          ],
          "fixInstruction": "Change order rep to 'Nika Lao' in ShopWorks"
        }
      ]
    }
  ]
}
```

### Source of Truth
The Gap Report uses `Sales_Reps_2026` Caspio table, which syncs from ShopWorks:

```
ShopWorks → FileMaker → Power Query → Excel → Caspio (Sales_Reps_2026)
```

---

## Fix Options for Authority Conflicts

| Option | Action | When to Use |
|--------|--------|-------------|
| **Fix Order** | Change order's `CustomerServiceRep` in ShopWorks | Order was entered by wrong person (typo, mistake) |
| **Reassign Customer** | Change customer's rep in ShopWorks | Customer legitimately belongs to different rep |

Both actions sync automatically:
- Order changes reflect immediately in ManageOrders API
- Customer assignment changes sync to Sales_Reps_2026 within ~1 hour

---

## House Accounts Dashboard

### Purpose
Tracks customers assigned to non-sales-reps:
- **Ruthie** - Walk-ins, one-off customers
- **House** - Generic catch-all
- **Erik** - Owner/admin orders
- **Jim** - Production orders
- **Web** - Website self-service orders

### Sales Endpoint
`GET /api/house-accounts/sales`

### Response Structure
```json
{
  "success": true,
  "year": 2026,
  "totalRevenue": 4763.50,
  "totalOrders": 17,
  "byAssignee": {
    "Ruthie": {"revenue": 3807, "orderCount": 13},
    "Erik": {"revenue": 36, "orderCount": 1},
    "Web": {"revenue": 588, "orderCount": 1},
    "Jim": {"revenue": 0, "orderCount": 0},
    "House": {"revenue": 332.50, "orderCount": 2},
    "Other": {"revenue": 0, "orderCount": 0}
  },
  "accountsTracked": 34,
  "ordersChecked": 1162
}
```

### Limitation
Uses ManageOrders data with **60-day rolling window**. For full YTD data beyond 60 days, the system uses Daily Sales Archive tables.

---

## Sales_Reps_2026 Table

### Purpose
**Source of truth** for customer-to-rep assignments from ShopWorks.

### Key Fields
| Field | Purpose |
|-------|---------|
| `ID_Customer` | Customer ID (primary key) |
| `CompanyName` | Customer company name |
| `CustomerServiceRep` | **THE KEY FIELD** - Assigned rep name |
| `Account_Tier` | e.g., "BRONZE '26-TANEISHA" |
| `Inksoft_Store` | Boolean - has webstore |
| `date_LastOrdered` | Last order date |

### Query Examples
```
# Get Nika's customers
CustomerServiceRep='Nika Lao'

# Get Taneisha's customers
CustomerServiceRep='Taneisha Clark'
```

### Used By
- `/api/house-accounts/full-reconciliation`
- `/api/house-accounts/reconcile`
- Gap Report modal in House Accounts dashboard

---

## CSV Data Gotcha

When analyzing ShopWorks CSV exports, be aware:

| CSV Field | What It Means |
|-----------|---------------|
| `Order_Cust::CustomerServiceRep` | Customer's **assigned** rep |
| `CustomerServiceRep` (on order) | Who **wrote** the order |

These are often different! A customer might be assigned to Nika, but Taneisha could write an order for them. This creates the "authority conflict" that the Gap Report identifies.

---

## API Authentication

### Header
```
x-crm-api-secret: [CRM_API_SECRET from environment]
```

### Protected Endpoints
- `/api/house-accounts/*`
- `/api/nika-accounts/*`
- `/api/taneisha-accounts/*`
- `/api/sales-reps-2026/*`

### Middleware
See `caspio-pricing-proxy/src/middleware/index.js`:
```javascript
const requireCrmApiSecret = (req, res, next) => {
  const providedSecret = req.headers['x-crm-api-secret'];
  const expectedSecret = process.env.CRM_API_SECRET;
  // ...
};
```

---

## Troubleshooting Checklist

### "Dashboard numbers don't match!"
1. **Check which metric you're comparing** - Team Performance (orders BY rep) vs CRM YTD (orders FOR customers)
2. **Run Gap Report** - Identifies authority conflicts
3. **Verify date ranges** - ManageOrders has 60-day limit; Archive tables needed for full YTD

### "Gap Report shows conflicts"
1. Look up the order number in ShopWorks
2. Decide: fix the order's rep OR reassign the customer
3. Make change in ShopWorks
4. Wait ~1 hour for sync (or refresh manually)
5. Re-run Gap Report to verify fix

### "All Synced!" but numbers still off
- "All Synced" means every customer with orders is in SOME CRM list
- Numbers can still differ due to authority conflicts (orders by wrong person)
- Use Gap Report to identify specific orders to fix

---

## Files Reference

| File | Purpose |
|------|---------|
| `caspio-pricing-proxy/src/routes/house-accounts.js` | Gap Report endpoint (lines 350-550) |
| `dashboards/js/house-accounts.js` | Gap Report UI rendering (lines 1180-1410) |
| `caspio-pricing-proxy/src/middleware/index.js` | CRM API secret auth |
| `shared_components/js/staff-dashboard-init.js` | Team Performance loading |
| `shared_components/js/staff-dashboard-service.js` | Order fetching service |

---

## Bug Fix: Chunk Boundary Overlap (2026-01-25)

### The Problem
Sync-sales endpoints fetch orders in 20-day chunks to avoid API timeouts. The chunk boundaries were overlapping, causing orders invoiced on boundary dates to be counted **twice**.

**Affected endpoints:**
- `POST /api/nika-accounts/sync-sales`
- `POST /api/taneisha-accounts/sync-sales`
- `GET /api/house-accounts/sales`
- `GET /api/house-accounts/reconcile`
- `GET /api/house-accounts/full-reconciliation`

**Symptoms:**
- CRM YTD showed ~10% higher than expected
- Some accounts had exactly DOUBLE the correct amount
- Orders invoiced on Jan 5, Dec 16 (chunk boundaries) were double-counted

### The Fix
Added deduplication by `id_Order` before aggregation:
```javascript
const seenOrderIds = new Set();
const uniqueOrders = allOrders.filter(order => {
    if (seenOrderIds.has(order.id_Order)) return false;
    seenOrderIds.add(order.id_Order);
    return true;
});
```

**Commit:** `9b4623e` - "Fix chunk boundary overlap causing duplicate orders in sync-sales"

### Verification
After running sync-sales:
- Before fix: $153,866.46 (wrong)
- After fix: $143,405.26 (correct, matches ManageOrders)
