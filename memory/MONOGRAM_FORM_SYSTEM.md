# Monogram Form System Documentation

**Created:** 2026-01-08
**Purpose:** Database-backed monogram/personalization tracking system for embroidery orders
**Status:** Implementation in progress

---

## Overview

This system replaces the JotForm-based monogram form with a database-backed solution that:
1. Integrates with ShopWorks orders via ManageOrders API
2. Stores data in Caspio tables
3. Generates printable PDF forms for production
4. Allows lookup by order number or company name

---

## Caspio Table Schemas

### IMPORTANT: Create These Tables in Caspio Admin

You must manually create these two tables in Caspio before the system will work.

---

### Table 1: `Monogram_Sessions`

Create this table with the following fields:

| Field Name | Data Type | Size | Required | Default | Notes |
|------------|-----------|------|----------|---------|-------|
| PK_ID | AutoNumber | - | Auto | Auto | Primary key (Caspio generates) |
| MonogramID | Text | 20 | Yes | - | Unique ID: `MONO{MMDD}-{seq}` |
| SessionID | Text | 50 | Yes | - | Browser session ID |
| OrderNumber | Text | 20 | Yes | - | ShopWorks order number |
| ShopWorksOrderNo | Number | - | No | - | Internal order_no for API |
| ExtOrderID | Text | 20 | No | - | External quote ID |
| CompanyName | Text | 255 | Yes | - | Customer company name |
| SalesRepEmail | Text | 255 | No | - | Sales rep email address |
| FontStyle | Text | 100 | No | - | Monogram font style |
| ThreadColor | Text | 100 | No | - | Thread color for embroidery |
| NotesToProduction | Text | 64000 | No | - | Production notes (use Memo) |
| TotalNames | Number | - | Yes | 0 | Count of name entries |
| Status | Text | 20 | Yes | 'Active' | Active, Printed, Completed |
| CreatedAt | DateTime | - | Yes | Now() | Creation timestamp |
| CreatedBy | Text | 100 | No | - | User who created |
| LastModifiedAt | DateTime | - | No | - | Last update timestamp |
| PrintedAt | DateTime | - | No | - | When PDF was printed |
| SubmittedBy | Text | 100 | No | - | Who printed it |

**Caspio Setup Notes:**
- Set `MonogramID` as unique index
- Set `OrderNumber` as searchable
- Set `CompanyName` as searchable
- Use "Memo" type for `NotesToProduction` (unlimited text)

---

### Table 2: `Monogram_Items`

Create this table with the following fields:

| Field Name | Data Type | Size | Required | Default | Notes |
|------------|-----------|------|----------|---------|-------|
| PK_ID | AutoNumber | - | Auto | Auto | Primary key |
| MonogramID | Text | 20 | Yes | - | FK to Monogram_Sessions |
| LineNumber | Number | - | Yes | - | Row number (1-50) |
| StyleNumber | Text | 50 | Yes | - | Product style code |
| PartNumber | Text | 50 | No | - | ShopWorks PartNumber |
| Description | Text | 255 | No | - | Product description |
| ShirtColor | Text | 100 | No | - | Display color name |
| CatalogColor | Text | 50 | No | - | API color code |
| Size | Text | 20 | Yes | - | Size (XS, S, M, L, etc.) |
| MonogramName | Text | 100 | Yes | - | Name to embroider |
| Note | Text | 500 | No | - | Per-item notes |
| IsCustomSize | Yes/No | - | No | No | True if custom size |
| IsCustomStyle | Yes/No | - | No | No | True if manual entry |
| AddedAt | DateTime | - | Yes | Now() | Timestamp |

**Caspio Setup Notes:**
- Index on `MonogramID` for fast lookups
- `MonogramID` links to `Monogram_Sessions.MonogramID`

---

## API Endpoints

### Existing (ManageOrders - No Changes Needed)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/manageorders/orders/:order_no` | Get order header |
| `GET /api/manageorders/lineitems/:order_no` | Get line items (styles, colors, sizes) |

### New Endpoints (Add to caspio-pricing-proxy)

#### Monogram Sessions

```
GET    /api/monogram_sessions
       ?orderNumber=139465
       &companyName=Puyallup

GET    /api/monogram_sessions/:monogramId

POST   /api/monogram_sessions
       Body: { MonogramID, SessionID, OrderNumber, CompanyName, ... }

PUT    /api/monogram_sessions/:pk_id
       Body: { Status, NotesToProduction, ... }

DELETE /api/monogram_sessions/:pk_id
```

#### Monogram Items

```
GET    /api/monogram_items?monogramId=MONO0108-1

POST   /api/monogram_items
       Body: { MonogramID, LineNumber, StyleNumber, MonogramName, ... }

POST   /api/monogram_items/bulk
       Body: { monogramId, items: [...] }

PUT    /api/monogram_items/:pk_id
       Body: { MonogramName, Size, ... }

DELETE /api/monogram_items/:pk_id
```

---

## Frontend Files

| File | Purpose |
|------|---------|
| `/quote-builders/monogram-form.html` | Main application UI |
| `/shared_components/js/monogram-form-service.js` | API service layer |
| `/shared_components/js/monogram-form-controller.js` | UI logic/state |
| `/shared_components/css/monogram-form.css` | Styling |

---

## Size Mapping

ShopWorks returns sizes in numbered slots (Size01-Size06). Map them as follows:

```javascript
// CORRECT mapping (matches 3-day-tees.js and monogram-form-service.js)
const SIZE_SLOT_MAP = {
    Size01: 'S',
    Size02: 'M',
    Size03: 'L',
    Size04: 'XL',
    Size05: '2XL'
    // Size06 is catch-all for extended sizes (XS, 3XL+, LT, XLT, OSFA, etc.)
};

// Extended sizes (from Size06 catch-all or manual entry)
const EXTENDED_SIZES = ['XS', '3XL', '4XL', '5XL', '6XL', 'LT', 'XLT', '2XLT', '3XLT', '4XLT', 'OSFA'];
```

**Note:** Size06 is a catch-all - the actual size is determined by the PartNumber suffix (e.g., `PC54_3X` = 3XL).

---

## User Workflow

1. Open Monogram Form
2. Enter Order Number (e.g., "139465")
3. System fetches order from ManageOrders API
4. Form auto-populates company name, available styles/colors/sizes
5. User enters global settings (font, thread color, notes)
6. User fills in name rows (select style/color/size, type name)
7. Save to database (generates MonogramID)
8. Print PDF for production team

---

## Recent Features (January 2026)

### Bulk Name Import
Allows pasting a list of names (one per line) to quickly populate rows.

**UI Components:**
- Textarea for pasting names
- "Import Names" button - parses and shows count
- "Clear" button - removes all imported names
- Unassigned names panel - shows remaining names to assign

**Workflow:**
1. Paste names into textarea (one per line)
2. Click "Import Names" → System parses, shows "{n} names imported"
3. Unassigned panel appears showing all names
4. Per row: Select name from dropdown OR type manually
5. Selected names disappear from other row dropdowns
6. Panel shows "All names assigned!" when done

**Controller State:**
```javascript
this.importedNames = [];        // All parsed names
this.usedNameIndices = new Set(); // Track which are used
```

### Auto-Fill Thread Color & Location
When only ONE thread color or location is selected at form level, automatically fills all empty row dropdowns.

**Behavior:**
- Triggers when clicking "Done" on thread color or location multi-select
- Only fills rows where dropdown is empty (preserves manual selections)
- Also applies to newly added rows

**Methods:**
- `autoFillThreadColorIfSingle()` - Fills thread dropdowns if 1 color selected
- `autoFillLocationIfSingle()` - Fills location dropdowns if 1 location selected

### Size Quantity Limits
Tracks available quantity per size from order line items. Prevents over-assignment.

**How it works:**
- `sizeQuantities` map tracks remaining qty per Style-Color-Size combo
- When row is assigned, decrements the count
- Dropdown shows "(0 left)" and disables sizes with no remaining qty
- On row delete/change, restores the quantity

### PDF Sorting
Generated PDF sorts names table:
1. First by Style Number
2. Then by Size (S → M → L → XL → 2XL → 3XL...)

### Staff Dashboard Access
- **Button:** "Monogram 2026" in Forms section
- **Link:** `/quote-builders/monogram-form.html`

---

## Related Files

- `/memory/MANAGEORDERS_INTEGRATION.md` - ManageOrders API docs
- `/shared_components/js/base-quote-service.js` - Base service pattern
- `/calculators/monogramform.html` - Old JotForm wrapper (deprecated)
