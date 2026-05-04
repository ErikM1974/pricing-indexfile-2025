# Caspio Import — Phase 6c Customer Suggestions

Two CSV files that provision the Caspio tables behind the order form's "Suggested for {Company}" rail section. Once imported, the rail learns from each customer's past orders and surfaces their most-used services first.

## Files

| File | Required? | What it does |
|---|---|---|
| `Customer_Service_History.csv` | **Yes** | Aggregated tally of which `Service_Codes` each customer has used. Drives the suggestion ranking. |
| `Customer_Service_Overrides.csv` | Optional | Manual admin overrides — pin a code to top, hide a code, or preset default params. Skip for the MVP. |

---

## Import steps (Caspio admin)

### Step 1 — Import `Customer_Service_History.csv`

1. In Caspio Bridge: **Tables** → **New Table** → **Import from File**.
2. Pick `Customer_Service_History.csv`. First row is header — Caspio detects this.
3. **Verify field types** in the preview pane. They should match:

   | Field | Caspio Type |
   |---|---|
   | `Customer_Company` | Text(255) |
   | `Service_Code` | Text(50) |
   | `Used_Count` | Integer |
   | `Last_Used` | Date/Time |
   | `First_Used` | Date/Time |
   | `Last_Order_ID` | Text(50) |

   If Caspio guesses `Used_Count` as Text or Decimal, override to **Integer**.
   If it guesses `Last_Used`/`First_Used` as Text, override to **Date/Time**.

4. Confirm import. Caspio will auto-create a `PK_ID` Autonumber primary key — leave it.
5. **Add the unique index** (Datasheet view → Properties → Indexes):
   - Type: **Unique**
   - Fields: `Customer_Company`, `Service_Code` (composite)
   - Test by trying to insert a duplicate `(acme corp, EMB-METALLIC)` row — Caspio should reject it.
6. **Delete the 2 sample rows** once you've confirmed the schema looks right (Datasheet view → select rows → Delete). The table is now ready for production writes.

### Step 2 — Import `Customer_Service_Overrides.csv` (optional)

Same flow as Step 1. Field types:

| Field | Caspio Type |
|---|---|
| `Customer_Company` | Text(255) |
| `Service_Code` | Text(50) |
| `Override_Type` | Text(20) — convert to **List Field** with values `pin`, `hide`, `default_param` |
| `Override_Value` | Text(500) |
| `Set_By` | Text(100) |
| `Notes` | Text(500) |

Add the same composite unique index on `(Customer_Company, Service_Code)`. Delete sample rows.

---

## After import

The tables exist and accept inserts/queries, but they're empty. They'll fill organically as new orders come in (the backend write hook lands in a follow-up commit). Two paths to populate them faster:

- **Wait it out** — table starts empty, grows from new orders forward. Suggestions kick in for repeat customers after ~30 days. Simplest.
- **Backfill from history** — a one-time job that walks the last 6 months of `Order_Records` + their addOns and seeds `Customer_Service_History`. Optional; spec'd in the Phase 6c plan but not required.

---

## What's next (separate code-side commits, no Caspio admin needed)

1. Backend endpoint `GET /api/order-form/customer-suggestions?company={name}` in `caspio-pricing-proxy`
2. Server-side write hook in `server.js` `submit-order-form` to upsert (`Customer_Company`, `Service_Code`) on every successful order
3. Frontend wire-up: replace the stub in `pages/order-form/components/service-codes.js#getCustomerOverrides` with a real fetch; the rail's existing `customerOverrides` state already feeds the resolved data into `filterRailServices()`
4. Render a "Suggested for {Company}" `RailSection` above "Recently used" when the resolved suggestion list is non-empty

About 1 hour total once these tables are live.

---

## Field reference (data dictionary)

### `Customer_Service_History`

| Field | Notes |
|---|---|
| `Customer_Company` | The order's company name. **Trim whitespace + lowercase before insert/query** to avoid the trailing-whitespace gotcha that bit Caspio composite-key tables before. |
| `Service_Code` | Exact match to `Service_Codes.ServiceCode` (e.g. `EMB-METALLIC`, `AL-CAP`, `DTG-LC`). Virtual codes from Phase 5 are tracked too. |
| `Used_Count` | Increments by 1 each time the customer drops this code on a successfully submitted order. Default 0. |
| `Last_Used` | ISO 8601 datetime of the most recent use. Used as tiebreaker when multiple codes have equal `Used_Count`. |
| `First_Used` | Set on insert; never updated. Useful for "new customer" detection (= no row at all). |
| `Last_Order_ID` | OF-NNNN audit pointer to the most recent order — handy for debugging the count history. |

### `Customer_Service_Overrides`

| Field | Notes |
|---|---|
| `Override_Type` | `pin` = float to top; `hide` = never show; `default_param` = preset params on drop (e.g. metallic always at qty=1). |
| `Override_Value` | JSON string for `default_param` overrides. Ignored for `pin`/`hide`. Example: `{"colorCount": 3}` for SP-FRONT to default to 3 colors. |
| `Set_By` | Admin email who set the override — audit trail. |
| `Notes` | Free-form rationale, so the next admin understands why this exists. |
