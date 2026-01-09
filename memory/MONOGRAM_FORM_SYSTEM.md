# Monogram Form System Documentation

**Created:** 2026-01-08
**Updated:** 2026-01-09
**Purpose:** Database-backed monogram/personalization tracking system for embroidery orders
**Status:** Complete - Live in production

---

## Overview

This system replaces the JotForm-based monogram form with a database-backed solution that:
1. Integrates with ShopWorks orders via ManageOrders API
2. Stores data in Caspio `Monograms` table (single table with JSON items)
3. Generates printable PDF forms for production
4. Provides dashboard for managing all monogram orders

---

## Architecture

### Single Table Design

Uses ONE table (`Monograms`) with items stored as JSON in `ItemsJSON` field.

**Benefits:**
- Simpler API (single CRUD endpoint)
- Atomic saves (all data in one record)
- Easy upsert by OrderNumber

---

## Caspio Table: `Monograms`

| Field Name | Caspio Type | Notes |
|------------|-------------|-------|
| ID_Monogram | AutoNumber | Primary key |
| OrderNumber | Number | ShopWorks order # (unique per monogram) |
| CompanyName | Text(255) | Customer company |
| SalesRepEmail | Text(255) | Sales rep email |
| FontStyle | Text(255) | Font style |
| ThreadColors | Text(255) | Comma-separated |
| Locations | Text(255) | Comma-separated |
| ImportedNames | Text(255) | Pasted names list |
| NotesToProduction | Text(255) | Production notes |
| ItemsJSON | Text(64000) | JSON array of line items |
| TotalItems | Number | Count of items |
| Status | Text(255) | Draft/Submitted/Printed/Completed |
| CreatedAt | Date/Time | Created timestamp |
| CreatedBy | Text(255) | User who created |
| ModifiedAt | Date/Time | Last modified |
| PrintedAt | Date/Time | When printed |

### ItemsJSON Structure

```json
[
  {
    "lineNumber": 1,
    "styleNumber": "PC54",
    "description": "Core Cotton Tee",
    "shirtColor": "Black",
    "size": "L",
    "rowThreadColor": "White",
    "rowLocation": "Left Chest",
    "monogramName": "John Smith",
    "isCustomStyle": false
  }
]
```

---

## API Endpoints

### Base URL
`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

### Monograms CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/monograms` | List all (with optional filters) |
| GET | `/api/monograms/:orderNumber` | Get by order number |
| POST | `/api/monograms` | Create new (or upsert if OrderNumber exists) |
| PUT | `/api/monograms/:id_monogram` | Update by ID |
| DELETE | `/api/monograms/:id_monogram` | Delete by ID |

**Query Filters (GET /api/monograms):**
- `?orderNumber=139465` - exact match
- `?companyName=Puyallup` - partial match
- `?status=Submitted` - exact match

**Response Format:**
```json
{
  "success": true,
  "monogram": { ... }       // single record
  "monograms": [ ... ]      // array for list
}
```

### ManageOrders (Order Data)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/manageorders/orders/:order_no` | Get order header |
| `GET /api/manageorders/lineitems/:order_no` | Get line items (styles, colors, sizes) |

---

## Frontend Files

| File | Purpose |
|------|---------|
| `/quote-builders/monogram-form.html` | Main entry form |
| `/dashboards/monogram-dashboard.html` | Management dashboard |
| `/shared_components/js/monogram-form-service.js` | API service layer |
| `/shared_components/js/monogram-form-controller.js` | Form UI logic |
| `/shared_components/js/monogram-dashboard.js` | Dashboard logic |
| `/shared_components/css/monogram-form.css` | Form styling |

---

## Dashboard Features

**URL:** `/dashboards/monogram-dashboard.html`

### KPI Cards
| Card | Description |
|------|-------------|
| Total Orders | Count of all monograms |
| Pending | Draft + Submitted status |
| Printed Today | PrintedAt = today |
| This Week | Created in last 7 days |

### Filters
- Search by order number or company name
- Filter by status (Draft/Submitted/Printed/Completed)
- Filter by date range (Created At)

### Actions
| Button | Action |
|--------|--------|
| Edit | Opens form with `?load=ORDER_NUMBER` |
| Print | Opens form in print mode |
| Mark Printed | Updates status to "Printed" |
| Delete | Removes record (with confirmation) |

---

## URL Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `?order=139465` | Pre-fill order number and auto-lookup | New monogram |
| `?load=139465` | Load existing monogram by order number | Edit mode |
| `?print=true` | Open in print mode (with load) | Print from dashboard |

---

## Size Mapping

ShopWorks returns sizes in numbered slots (Size01-Size06):

```javascript
const SIZE_SLOT_MAP = {
    Size01: 'S',
    Size02: 'M',
    Size03: 'L',
    Size04: 'XL',
    Size05: '2XL'
    // Size06 is catch-all for extended sizes
};

const EXTENDED_SIZES = ['XS', '3XL', '4XL', '5XL', '6XL', 'LT', 'XLT', '2XLT', '3XLT', '4XLT', 'OSFA'];
```

---

## User Workflow

### Creating New Monogram
1. Open Monogram Form
2. Enter Order Number (e.g., "139465")
3. System fetches order from ManageOrders API
4. Form auto-populates company name, styles/colors/sizes
5. Enter global settings (font, thread color, locations, notes)
6. Fill in name rows (select style/color/size, type name)
7. Click "Save as Draft" or "Submit"
8. Print PDF for production team

### Managing Orders (Dashboard)
1. Open Monogram Dashboard
2. View KPIs at top
3. Use filters to find specific orders
4. Click Edit to modify, Print to generate PDF, Mark Printed to update status

---

## Features (January 2026)

### Bulk Name Import
Paste list of names (one per line) to quickly populate rows.
- Import button parses and shows count
- Unassigned panel shows remaining names
- Names disappear from dropdown when assigned

### Auto-Fill Thread Color & Location
When only ONE option selected at form level, auto-fills all empty row dropdowns.

### Size Quantity Limits
Tracks available quantity per size. Disables sizes with 0 remaining.

### PDF Sorting
Sorts names table by Style Number, then by Size.

---

## Staff Dashboard Access

| Button | Link | Style |
|--------|------|-------|
| Monogram 2026 | `/quote-builders/monogram-form.html` | Default |
| Monogram Dashboard | `/dashboards/monogram-dashboard.html` | Purple gradient |

Located in Forms section of staff-dashboard.html.

---

## Related Files

- `/memory/MANAGEORDERS_INTEGRATION.md` - ManageOrders API docs
- `/calculators/monogramform.html` - Old JotForm wrapper (deprecated)
