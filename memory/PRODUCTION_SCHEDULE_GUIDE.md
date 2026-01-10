# Production Schedule Predictor Guide

## Overview

The Production Schedule Predictor shows estimated turnaround times for each service type on the Staff Dashboard. It uses historical order completion data analyzed from ShopWorks production schedules.

## Files

| File | Purpose |
|------|---------|
| `shared_components/js/production-schedule-stats.js` | Historical statistics data + holidays array |
| `shared_components/js/production-schedule-predictor.js` | Prediction functions + due date calculation |
| `shared_components/js/staff-dashboard-init.js` | Card rendering (line 1190) |
| `shared_components/css/staff-dashboard-widgets.css` | Card styling |

## Service Types

| Key | Display Name | Data Source | Samples |
|-----|--------------|-------------|---------|
| `dtg` | DTG | DTG Production Schedule.csv | 1,082 |
| `embroidery` | Embroidery | Embroidery Production Schedule.csv | 1,190 |
| `capEmbroidery` | Cap Emb | Cap Embroidery Production Schedule.csv | 1,454 |
| `screenprint` | Screen Print | Screenprint Production Schedule.csv | 805 |
| `transfers` | Transfers | DTF Production Schedule.csv | 100 |

**Total records:** 4,631 (as of Jan 2026)

## Statistics Structure

Each service has monthly breakdowns and overall stats:

```javascript
PRODUCTION_STATS = {
    dtg: {
        overall: { avg: 9.2, min: 3, max: 23, median: 8, samples: 1082 },
        byMonth: {
            1: { avg: 9.8, min: 4, max: 18, median: 9, samples: 85 },
            2: { avg: 8.7, min: 3, max: 17, median: 8, samples: 78 },
            // ... months 3-12
        }
    },
    // ... other services
}
```

## Turnaround Findings

| Service | Avg Days | Range | Notes |
|---------|----------|-------|-------|
| DTG | 9 | 3-23 | In-house, fastest |
| Transfers/DTF | 10 | 3-25 | In-house |
| Embroidery | 14 | 3-42 | Contract - varies |
| Cap Embroidery | 17 | 4-60 | Contract |
| Screen Print | 27 | 5-90 | Subcontracted - longest |

**Key insight:** Screen print is ~2x longer than estimated because it's fully subcontracted work.

## Due Date Calculation

The predictor calculates actual due dates adjusted for weekends and holidays:

```javascript
// Today + X days, then push forward if lands on non-business day
function calculateDueDate(days) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);

    while (isWeekendOrHoliday(dueDate)) {
        dueDate.setDate(dueDate.getDate() + 1);
    }
    return dueDate;
}
```

**Format:** "Monday, Jan 20" (long weekday + short date)

## Holidays Array

`PRODUCTION_HOLIDAYS` in stats file covers 2025-2031:

- US Federal Holidays (MLK Day, Memorial Day, July 4th, etc.)
- Thanksgiving + day after
- Christmas Day
- **Factory Closure:** Dec 26-31 each year (company shutdown)
- New Year's Day + Jan 2

**Update required:** Before October 2030 (add 2031 dates)

## Monthly Variation

The predictor uses month-specific data when available (samples > 10), otherwise falls back to overall averages. This accounts for:

- **Busy season** (Aug-Oct): Longer turnaround due to back-to-school rush
- **Slow season** (Jan-Feb): Faster turnaround
- **Holiday impact**: November caps run longer, December has closures

## How to Update Statistics

1. **Export from ShopWorks**: Get the production schedule CSV for the service
2. **Required columns**: `Date_Ordered`, `Date_Completed` (or `DATE_COMPLETE`)
3. **Run analysis**: Calculate days between order and completion for each record
4. **Compute stats**: avg, min, max, median, samples per month
5. **Update** `production-schedule-stats.js` with new data

### CSV Column Mapping

| Service | Order Date Column | Complete Date Column |
|---------|-------------------|---------------------|
| DTG | Date_Ordered | Date_Completed |
| Embroidery | Date_Ordered | Date_Completed |
| Cap Embroidery | Date_Ordered | Date_Completed |
| Screen Print | DateOrdered | DATE_COMPLETE |
| Transfers/DTF | Date_Ordered | Date_Completed |

## API Usage

```javascript
// Get prediction for a service
const dtgPrediction = ProductionPredictor.getTurnaroundEstimate('dtg');
// Returns: { days: 9, min: 3, max: 23, range: '3-23', confidence: 'high',
//            samples: 85, dueDate: Date, dueDateFormatted: 'Monday, Jan 20' }

// Get all predictions
const all = ProductionPredictor.getAllPredictions();
// Returns predictions for all services + season indicator + capacity status

// Direct due date calculation
const dueDate = ProductionPredictor.calculateDueDate(14);
const formatted = ProductionPredictor.formatDueDate(dueDate);
```

## Visual Display

Each card shows:
```
┌─────────────────┐
│      [icon]     │
│   Service Name  │
│                 │
│    X days       │
│  Monday, Jan 20 │  ← Due date (crimson)
│       ●         │  ← Capacity dot
└─────────────────┘
```

## Capacity Indicator

The colored dot shows seasonal capacity:
- **Green (wide-open)**: >80% availability
- **Yellow (moderate)**: 50-80% availability
- **Red (busy)**: <50% availability

Based on historical "Wide Open" percentage data by month.

## Related Files

- `/staff-dashboard.html` - Dashboard HTML
- `/shared_components/css/staff-dashboard-widgets.css` - Widget styling
- `/memory/STAFF_DASHBOARD_DATA_GUIDE.md` - Sales metrics documentation
