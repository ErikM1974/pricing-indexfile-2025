# Daily Sales Archive - YTD Tracking System

**Last Updated:** 2026-01-25

**Related:**
- [CRM_DASHBOARD_RECONCILIATION.md](./CRM_DASHBOARD_RECONCILIATION.md) - Dashboard metrics and gap reports

---

## Overview

Three separate archive systems exist for different purposes:

| Archive | Table | Purpose | Triggered By |
|---------|-------|---------|--------------|
| **Company-wide** | `DailySalesArchive` | $3M sales goal banner | Dashboard load (days 55-60) |
| **By-rep breakdown** | `NW_Daily_Sales_By_Rep` | Team Performance YTD | Heroku Scheduler (daily) |
| **Garment tracker** | `GarmentTrackerArchive` | Quarterly garment bonuses | Heroku Scheduler (daily) |

---

## Company-Wide Archive (DailySalesArchive)

### Purpose

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

### Key Points

- **Archiving trigger:** Dashboard load (not scheduled)
- **What gets archived:** Days 55-60 ago (batch, not daily)
- **Source of truth:** ManageOrders for last 60 days, Caspio for older
- **Invoice updates:** Automatically reflected if within 60 days
- **Requirement:** Dashboard must be loaded at least every few days to capture expiring data

---

## By-Rep Archive (NW_Daily_Sales_By_Rep)

### Purpose

Track per-rep daily sales for Team Performance YTD metrics. Unlike the company-wide archive, this stores a breakdown by rep for each day.

### Caspio Table

**Table Name:** `NW_Daily_Sales_By_Rep`

| Field | Type | Description |
|-------|------|-------------|
| SalesDate | Date | Sales date (YYYY-MM-DD) |
| RepName | Text | Sales rep name (e.g., "Nika Lao") |
| Revenue | Currency | Total invoiced revenue for that rep on that day |
| OrderCount | Number | Number of orders |
| ArchivedAt | Timestamp | Auto-set when record created |

**Composite key:** (SalesDate, RepName)

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/caspio/daily-sales-by-rep?start=&end=` | Fetch date range with daily breakdown |
| GET | `/api/caspio/daily-sales-by-rep/ytd?year=2026` | Get YTD summary by rep |
| POST | `/api/caspio/daily-sales-by-rep` | Archive single day (manual) |
| POST | `/api/caspio/daily-sales-by-rep/archive-date` | Re-archive from ManageOrders |
| POST | `/api/caspio/daily-sales-by-rep/archive-range` | Backfill date range |
| POST | `/api/caspio/daily-sales-by-rep/import` | Manual import (for >60 day corrections) |

**Backend file:** `caspio-pricing-proxy/src/routes/daily-sales-by-rep.js`

### Archiving Script

**File:** `caspio-pricing-proxy/scripts/archive-daily-sales.js`

**Modes:**
```bash
# Default: Archive yesterday
npm run archive-daily-sales

# Re-archive specific date (rep assignment changed)
npm run archive-daily-sales -- --date 2026-01-20

# Backfill date range
npm run archive-daily-sales -- --backfill --start 2026-01-01 --end 2026-01-24
```

**Heroku Scheduler:** Run daily at 6 AM Pacific (14:00 UTC):
```
npm run archive-daily-sales
```

### Handling Rep Assignment Changes

| Scenario | Within 60 Days | Past 60 Days |
|----------|---------------|--------------|
| Rep changed on order | Re-archive: `--date YYYY-MM-DD` | Manual import via `/import` endpoint |
| Order voided/cancelled | Re-archive catches the change | Manual adjustment in Caspio |

**Example: Re-archive after rep change**
```bash
# If you changed rep on orders from Jan 15, re-archive that date:
npm run archive-daily-sales -- --date 2026-01-15
```

**Example: Manual import for old dates**
```bash
curl -X POST https://caspio-pricing-proxy.../api/caspio/daily-sales-by-rep/import \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"date": "2025-11-15", "rep": "Nika Lao", "revenue": 1500.00, "orderCount": 3}
    ]
  }'
```

### Team Performance Dashboard Integration

The Team Performance dashboard uses this archive for YTD totals:

1. Checks `lastArchivedDate` from archive
2. Fetches archived data up to that date
3. Fetches live ManageOrders data from `lastArchivedDate+1` to today
4. Combines for complete YTD

**Frontend file:** `shared_components/js/staff-dashboard-init.js` → `loadTeamPerformanceYTDHybrid()`

### Data Quality Notes

Watch for rep name variations in ShopWorks:
- "Ruthie Nhoung" vs "Ruth Nhoung" vs "ruth"
- "Nika Lao" is correct (not "nika" or "NIKA LAO")

These create separate entries in the archive. Fix in ShopWorks for consistency.

### Initial Backfill (2026-01-25)

Archive populated with January 2026 data:

| Rep | Revenue | Orders |
|-----|---------|--------|
| Nika Lao | $143,405.26 | 399 |
| Taneisha Clark | $85,050.43 | 233 |
| Others | $5,026.50 | 18 |
| **Total** | **$233,482.19** | **650** |

---

## Garment Tracker Archive (GarmentTrackerArchive)

### Purpose

Track quarterly garment sales (Richardson caps + premium items) by rep for bonus calculations and historical reporting. Unlike daily sales which aggregates by date, this stores order-level detail for individual garment items.

### What Qualifies

**Richardson Caps** ($0.50 bonus each):
- Styles: 110, 112, 111, 115, 172, 212, 220, 256, 312, 325, 326, 435, 511, 514, 514J, 840, 842, 870

**Premium Items** ($2-$5 bonus each):
| Part Number | Item | Bonus |
|-------------|------|-------|
| CT104670 | Carhartt Firm Duck Vest | $5 |
| EB550 | Eddie Bauer Down Jacket | $5 |
| CT103828 | Carhartt Thermal Hoodie | $3 |
| CT102286 | Carhartt Acrylic Beanie | $2 |
| NF0A52S7 | North Face High Loft Beanie | $2 |

### Caspio Table

**Table Name:** `GarmentTrackerArchive`

| Field | Type | Description |
|-------|------|-------------|
| PK_ID | Autonumber | Primary key |
| OrderNumber | Number | ShopWorks order number |
| DateInvoiced | Date/Time | Invoice date |
| Quarter | Text | Quarter string (e.g., "2026-Q1") |
| Year | Number | Year (e.g., 2026) |
| RepName | Text | Sales rep name |
| PartNumber | Text | Part/style number |
| StyleCategory | Text | "Premium", "Richardson", or "Other" |
| Quantity | Number | Item quantity |
| BonusAmount | Currency | Calculated bonus |
| ArchivedAt | Timestamp | Auto-set by Caspio |
| CompositeKey | Formula (Unique) | `OrderNumber + '_' + PartNumber` |

**Composite Key Formula:**
```
Convert(nvarchar(20), [@field:OrderNumber]) + '_' + [@field:PartNumber]
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/garment-tracker/archive?year=&quarter=&rep=` | Query archived data |
| GET | `/api/garment-tracker/archive/summary?year=` | Aggregated summary by rep/quarter |
| POST | `/api/garment-tracker/archive-from-live` | Copy from live GarmentTracker table |
| POST | `/api/garment-tracker/archive-range` | Archive from ManageOrders (within 60 days) |
| POST | `/api/garment-tracker/import` | Manual import for >60 day corrections |

**Backend file:** `caspio-pricing-proxy/src/routes/garment-tracker.js`

### Archiving Script

**File:** `caspio-pricing-proxy/scripts/archive-garment-tracker.js`

**Modes:**
```bash
# Archive yesterday's garment data
npm run archive-garment-tracker

# Archive date range from ManageOrders (within 60 days)
npm run archive-garment-tracker -- --start 2026-01-01 --end 2026-01-31

# Archive from current live GarmentTracker table
npm run archive-garment-tracker -- --from-live
```

**Heroku Scheduler:** Run daily at 6 AM Pacific (14:00 UTC):
```
npm run archive-garment-tracker
```

### Live Table vs Archive Table

| Table | Purpose | Retention |
|-------|---------|-----------|
| `GarmentTracker` | Current quarter dashboard display | Cleared quarterly |
| `GarmentTrackerArchive` | Historical records | Permanent |

The live `GarmentTracker` table is populated by `staff-dashboard-init.js:loadGarmentTracker()` and shows current quarter data. The archive preserves this data permanently.

### Data Flow

```
ManageOrders (60-day limit)
        ↓
   Dashboard loads
        ↓
GarmentTracker (live, current quarter)
        ↓
  Archive script (daily)
        ↓
GarmentTrackerArchive (permanent)
```

### Initial Backfill (2026-01-25)

Archive populated with January 2026 data:

| Rep | Items | Bonus | Orders | Premium | Richardson |
|-----|-------|-------|--------|---------|------------|
| Nika Lao | 41 | $126.50 | 5 | 24 | 17 |
| Taneisha Clark | 186 | $124.50 | 5 | 7 | 179 |
| **Total** | **227** | **$251.00** | **10** | **31** | **196** |

### Quarterly Reporting

To get quarterly summary by rep:
```bash
curl "https://caspio-pricing-proxy.../api/garment-tracker/archive/summary?year=2026"
```

Response includes per-rep totals: quantity, bonus amount, order count, premium vs Richardson breakdown.
