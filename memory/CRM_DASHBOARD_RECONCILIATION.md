# CRM Dashboard Reconciliation

**Purpose:** Documents the dashboard sales reconciliation system, gap reports, and how to diagnose/fix authority conflicts between rep assignments and order data.

**Last Updated:** 2026-01-28

**Related:**
- [CRM_DASHBOARD_AUTH.md](./CRM_DASHBOARD_AUTH.md) - Authentication system
- [DAILY_SALES_ARCHIVE.md](./DAILY_SALES_ARCHIVE.md) - YTD sales tracking beyond 60-day limit
- [NIKA_DASHBOARD_BUILD_GUIDE.md](./NIKA_DASHBOARD_BUILD_GUIDE.md) - Dashboard implementation

---

## Dashboard Metrics Alignment (Updated 2026-01-28)

**Team Performance and CRM YTD now show the SAME numbers** for Nika and Taneisha.

| Dashboard | What It Shows | Data Source |
|-----------|---------------|-------------|
| **Team Performance** | Revenue for rep's assigned customers | `fetchRepCRMTotals()` → CRM accounts |
| **CRM YTD_Sales_2026** | Revenue for rep's assigned customers | CRM account list with YTD_Sales_2026 |

**Change Made:**
`staff-dashboard-init.js` → `loadTeamPerformanceYTDHybrid()` now calls `fetchRepCRMTotals()` to override Nika and Taneisha's totals with CRM data. This ensures both dashboards show identical numbers.

**Workflow:**
1. Gap Analysis identifies mismatches (order writer ≠ CRM assignment)
2. User fixes the order in ShopWorks to match the CRM owner
3. User resyncs the CRM dashboard
4. Both Team Performance and CRM dashboards reflect the corrected data

**House/Other Reps:** Still use hybrid calculation (archive + ManageOrders) - unchanged.

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

---

## Troubleshooting: CRM YTD vs Team Performance Gap

### When to Use This Guide
Use when **Team Performance shows higher sales than CRM YTD** for a rep.

### Understanding the Gap

| Source | Metric | What It Counts |
|--------|--------|----------------|
| Team Performance | Orders written | `CustomerServiceRep` on ORDER = rep name |
| CRM YTD_Sales_2026 | Assigned accounts | Customer in rep's CRM account list |

**Gap = Orders written for customers NOT in rep's CRM**

### Step-by-Step Diagnosis

#### 1. Run Diagnostic Script
```bash
cd "c:/Users/erik/OneDrive - Northwest Custom Apparel/2025/Pricing Index File 2025"
node tests/diagnostics/analyze-gap.js
```

This script:
- Fetches all 2026 orders from ManageOrders
- Fetches CRM accounts for Nika and Taneisha
- Cross-references to find missing customers
- Shows exactly which customers/revenue are missing from CRM

#### 2. Check Output
```
CUSTOMER BREAKDOWN
--------------------------------------------------
Total customers with orders:          88
Customers IN CRM:                     87 ($150,219)
Customers NOT IN CRM:                 1 ($629)

MISSING CUSTOMERS (not in CRM - explains the gap)
--------------------------------------------------
   1. ID:12914    The Highlands at Silverdale    $629 (1 orders)
```

#### 3. Determine Cause

| Finding | Cause | Fix |
|---------|-------|-----|
| **Missing customers > 0** | Rep wrote orders for unassigned customers | Add customer to CRM OR reassign order |
| **CRM sync discrepancy** | `YTD_Sales_2026` field is stale | Run sync endpoint |
| **Both totals match** | No issue! | N/A |

### Fix: Trigger CRM Sync

```bash
# Nika
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/nika-accounts/sync-sales" \
  -H "X-CRM-API-Secret: $CRM_API_SECRET"

# Taneisha
curl -X POST "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/taneisha-accounts/sync-sales" \
  -H "X-CRM-API-Secret: $CRM_API_SECRET"
```

Response shows sync results:
```json
{
  "success": true,
  "message": "Hybrid sales sync completed",
  "accountsUpdated": 87,
  "errors": 0
}
```

### Fix: Customer Assignment Issues

If a customer is missing from the rep's CRM:

1. **Option A - Reassign customer to rep:**
   - Go to ShopWorks → Customer record
   - Change `CustomerServiceRep` field to the rep
   - Wait for sync to Sales_Reps_2026 table (~1 hour)
   - Run `/api/[rep]-accounts/sync-ownership`

2. **Option B - Change order's rep:**
   - Go to ShopWorks → Order record
   - Change `CustomerServiceRep` on the ORDER
   - Change reflects immediately in ManageOrders API

### Diagnostic Script Location

| File | Purpose |
|------|---------|
| `tests/diagnostics/analyze-gap.js` | Node.js script - full analysis |
| `tests/diagnostics/crm-gap-report.html` | Browser UI version (requires CRM login) |

### Common Scenarios

**Scenario 1: Sync is stale**
- Gap exists but no missing customers
- Fix: Run sync-sales endpoint
- Verify: Re-run diagnostic, gap should be $0

**Scenario 2: Rep wrote order for wrong customer**
- Order was entered with wrong CustomerServiceRep
- Fix: Change order's rep in ShopWorks
- Verify: ManageOrders total for rep decreases

**Scenario 3: Customer should be assigned to rep**
- Customer is missing from CRM account list
- Fix: Assign customer to rep in ShopWorks
- Verify: Customer appears in CRM after sync-ownership

---

## Automatic Sync Schedule (Heroku Scheduler)

CRM data syncs automatically daily at **6:00 AM Pacific (2:00 PM UTC)**.

| Job | npm Command | What It Syncs |
|-----|-------------|---------------|
| Archive Daily Sales | `npm run archive-daily-sales` | Yesterday's sales → NW_Daily_Sales_By_Rep |
| Archive Garment Tracker | `npm run archive-garment-tracker` | Garment data → GarmentTrackerArchive |
| Sync CRM Dashboards | `npm run sync-crm-dashboards` | Ownership + YTD sales for Nika, Taneisha, House |

**Scripts Location:** `caspio-pricing-proxy/scripts/`

**To check status:** Heroku Dashboard → caspio-pricing-proxy → Resources → Heroku Scheduler

**Note:** `sync-crm-dashboards` handles both ownership AND sales sync, so the `sync-all-sales` script is available but not scheduled separately.
