# Daily Sales Archive - YTD Tracking System

## Purpose

Track Year-to-Date (YTD) sales for the $3M sales goal banner on the Staff Dashboard. Overcomes ManageOrders' 60-day data retention limit by archiving daily sales to Caspio.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      YTD Calculation                            │
├─────────────────────────────────────────────────────────────────┤
│  Days OLDER than 60 days  →  Caspio Archive (permanent)         │
│  Days WITHIN last 60 days →  ManageOrders LIVE (source of truth)│
└─────────────────────────────────────────────────────────────────┘
```

**Why hybrid approach?**
- Invoice updates within 60 days are automatically reflected (from ManageOrders)
- Historical data is preserved forever (in Caspio)
- No sync issues - recent data always fresh from source of truth

## Caspio Table

**Table Name:** `DailySalesArchive`

| Field | Type | Description |
|-------|------|-------------|
| Date | Date/Time (PK, Unique) | Sales date (YYYY-MM-DD) |
| Revenue | Currency | Total invoiced revenue |
| OrderCount | Number | Number of orders |
| CapturedAt | Timestamp | When record was created/updated |

## API Endpoints

**Base URL:** `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/caspio/daily-sales?start=&end=` | Fetch date range with summary |
| GET | `/api/caspio/daily-sales/ytd?year=2026` | Get YTD summary |
| POST | `/api/caspio/daily-sales` | Archive single day `{date, revenue, orderCount}` |
| POST | `/api/caspio/daily-sales/bulk` | Bulk archive `[{date, revenue, orderCount}, ...]` |

**Backend file:** `caspio-pricing-proxy/src/routes/daily-sales.js`

## Frontend Implementation

### Files

| File | Functions |
|------|-----------|
| `staff-dashboard-service.js` | `fetchYTDFromArchive()`, `fetchArchivedSales()`, `archiveDailySales()`, `ensureYesterdayArchived()` |
| `staff-dashboard-init.js` | `loadYTDForSalesGoal()`, `archiveSoonToExpireDays()` |

### How `loadYTDForSalesGoal()` Works

1. Calculate 60-day boundary date
2. Fetch archived data older than 60 days from Caspio
3. Fetch live data for last 60 days from ManageOrders
4. Add them together for YTD total
5. Trigger background archiving of days 55-60 ago
6. Update the sales goal banner

### Batch Archiving Strategy

**Key insight:** We archive days 55-60 ago, NOT daily at end of day.

```
Day 1:  Invoice created    → $500
Day 30: Invoice updated    → $650
Day 55: Dashboard loads    → Archives $650 ✓ (final value)
```

**Why wait until day 55-60?**
- Captures invoice updates made within 55 days
- Archives the FINAL accurate value, not a potentially stale value
- 5-day buffer ensures nothing slips through even if dashboard not loaded daily

## Timeline

| Period | Data Source |
|--------|-------------|
| Jan 1 - Feb 28, 2026 | 100% ManageOrders (nothing old enough to archive) |
| Mar 1+ | Caspio (Jan data) + ManageOrders (last 60 days) |

## Manual Corrections

If YTD doesn't match ShopWorks total:

1. Log into Caspio
2. Open `DailySalesArchive` table
3. Find the incorrect day
4. Update the `Revenue` value
5. Dashboard will use corrected value on next load

## Key Points

- **Archiving trigger:** Dashboard load (not scheduled)
- **What gets archived:** Days 55-60 ago (batch, not daily)
- **Source of truth:** ManageOrders for last 60 days, Caspio for older
- **Invoice updates:** Automatically reflected if within 60 days
- **Requirement:** Dashboard must be loaded at least every few days to capture expiring data
