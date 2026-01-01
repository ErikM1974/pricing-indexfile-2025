# Staff Dashboard Data Guide

## Overview

The Staff Dashboard displays real-time sales metrics from ShopWorks via the ManageOrders API.

## Data Source

```
ShopWorks → ManageOrders API → caspio-pricing-proxy → Staff Dashboard
```

- **API Endpoint**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders`
- **Service File**: `/shared_components/js/staff-dashboard-service.js`
- **Init File**: `/shared_components/js/staff-dashboard-init.js`

## Critical: Date Filtering

**Always use `date_Invoiced`** (not `date_Ordered`) for sales reporting.

| Parameter | Purpose |
|-----------|---------|
| `date_Invoiced_start` | Start of date range (YYYY-MM-DD) |
| `date_Invoiced_end` | End of date range (YYYY-MM-DD) |

**Why invoice date?**
- Represents when revenue is recognized
- More accurate for sales reporting
- Orders can be placed but not invoiced for weeks

**Comparison (30-day example):**
| Approach | Orders | Revenue |
|----------|--------|---------|
| `date_Ordered` | 197 | $76,283 |
| `date_Invoiced` | 420 | $327,978 |

## Critical: Revenue Field

**Always use `cur_SubTotal`** for revenue calculations.

```javascript
const subtotal = parseFloat(order.cur_SubTotal) || 0;
```

**Note**: Field name is case-sensitive (`cur_SubTotal` with capital T).

## Data Consistency

All dashboard metrics use the same approach:

| Metric | Date Filter | Revenue Field |
|--------|-------------|---------------|
| Revenue Total | `date_Invoiced` | `cur_SubTotal` |
| YoY Comparison | `date_Invoiced` | `cur_SubTotal` |
| Team Performance | `date_Invoiced` | `cur_SubTotal` |
| Order Type Breakdown | `date_Invoiced` | `cur_SubTotal` |

## Sales Rep Name Normalization

The service normalizes sales rep names to handle database variations:

```javascript
const REP_NAME_ALIASES = {
    'ruth nhoung': 'Ruthie Nhoung',
    'ruthie nhoung': 'Ruthie Nhoung',
    'ruth': 'Ruthie Nhoung',
    'house': 'House'
};
```

Low-volume reps are grouped under "Other":
- Jim Mickelson
- Dyonii Quitugua
- Erik Mickelson
- Adriyella Trujillo

## YoY Comparison Logic

1. Calculate current period dates (e.g., Dec 2, 2025 - Jan 1, 2026)
2. Subtract 1 year from each date individually (Dec 2, 2024 - Jan 1, 2025)
3. Fetch orders for both periods
4. Calculate growth percentage and dollar difference

**Important**: Handles year boundary crossing correctly (e.g., Dec 25 - Jan 1).

## Known Limitations

### ManageOrders Sync Gap

Some orders may not sync from ShopWorks to ManageOrders:

| Order | Customer | Amount | Issue |
|-------|----------|--------|-------|
| 139985 | Bradley Wright (Employee) | $16.50 | Not synced |
| 140146 | Sreynai Meang (Employee) | $99.95 | Not synced |

**Impact**: ~0.035% variance ($116 of $328K) - acceptable for dashboard.

**Root Cause**: Individual sync failures, not a filter. Other employee orders sync correctly.

### API Rate Limiting

The ManageOrders API has rate limits. The service is optimized to:
- Fetch orders ONCE per period (2 API calls instead of 5)
- Cache data for 5 minutes
- Use sessionStorage for quick page reloads

## Code Reference

### Fetch Orders (service line 184-198)
```javascript
async function fetchOrders(startDate, endDate, refresh = false) {
    const url = new URL(API_CONFIG.baseURL + API_CONFIG.endpoints.orders);
    url.searchParams.append('date_Invoiced_start', startDate);
    url.searchParams.append('date_Invoiced_end', endDate);
    // ...
}
```

### Process Team Performance (service line 505-583)
```javascript
function processTeamPerformance(currentOrders, lastYearOrders, dateRange, days) {
    currentOrders.forEach(order => {
        const rep = normalizeRepName(order.CustomerServiceRep);
        const subtotal = parseFloat(order.cur_SubTotal) || 0;
        // Aggregate by rep...
    });
    // Calculate YoY for each rep...
}
```

## Verification

To verify data matches ShopWorks:

1. Query ShopWorks with same date range on `date_Invoiced`
2. Sum `cur_SubTotal` field
3. Compare totals (expect ~0.03% variance due to sync gaps)

```bash
# API verification command
curl "https://caspio-pricing-proxy.../api/manageorders/orders?date_Invoiced_start=YYYY-MM-DD&date_Invoiced_end=YYYY-MM-DD"
```

## Related Files

- `/shared_components/js/staff-dashboard-service.js` - Data fetching & processing
- `/shared_components/js/staff-dashboard-init.js` - Rendering & UI
- `/shared_components/js/staff-dashboard-announcements.js` - Announcements system
- `/shared_components/css/staff-dashboard-layout.css` - Styling
- `/dashboards/staff-dashboard-v2.html` - Main dashboard HTML
