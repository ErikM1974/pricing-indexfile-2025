# Customer Lookup & Sync System

**Created:** 2026-01-29
**Purpose:** Customer autocomplete for quote builders with daily sync from ManageOrders

---

## Overview

The Customer Lookup System provides autocomplete functionality for all 4 quote builders (DTF, DTG, Screen Print, Embroidery). It searches the `Company_Contacts_Merge_ODBC` Caspio table and auto-fills customer information fields.

### Key Components

1. **Frontend Service** - `CustomerLookupService` class (`shared_components/js/customer-lookup-service.js`)
2. **Backend API** - Express routes in caspio-pricing-proxy (`src/routes/company-contacts.js`)
3. **Caspio Table** - `Company_Contacts_Merge_ODBC` (contacts synced from ManageOrders)
4. **Scheduler** - Heroku Scheduler runs `npm run sync-contacts` daily at 2:00 AM UTC

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Quote Builders (Frontend)                     │
│  DTF │ DTG │ Screen Print │ Embroidery                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ CustomerLookupService
                            │ (3+ chars triggers search)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     caspio-pricing-proxy (Backend)                   │
│  GET /api/company-contacts/search?q=<term>                          │
│  Returns: top 10 matches, sorted by last order date                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Caspio: Company_Contacts_Merge_ODBC                     │
│  ~12,000+ contacts from ManageOrders                                │
│  Synced daily via Heroku Scheduler                                  │
└─────────────────────────────────────────────────────────────────────┘
                            ▲
                            │ POST /api/company-contacts/sync
                            │ (Heroku Scheduler: 2:00 AM UTC)
                            │
┌─────────────────────────────────────────────────────────────────────┐
│                   ShopWorks ManageOrders API                         │
│  Orders invoiced in last 24 hours                                   │
│  Contact info extracted and upserted to Caspio                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backend API (caspio-pricing-proxy)

### Files

| File | Purpose |
|------|---------|
| `src/routes/company-contacts.js` | Search, CRUD, and sync endpoints |
| `scripts/sync-contacts.js` | Heroku Scheduler job (called by `npm run sync-contacts`) |
| `server.js` | Registers route: `app.use('/api/company-contacts', companyContactsRoutes)` |

### Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/company-contacts/search?q=<term>` | Autocomplete search | None |
| `GET` | `/api/company-contacts/:id` | Get single contact by ID | None |
| `GET` | `/api/company-contacts/by-customer/:id` | Get by ShopWorks customer ID | None |
| `GET` | `/api/company-contacts/by-email/:email` | Get by email address | None |
| `POST` | `/api/company-contacts` | Create new contact | None |
| `PUT` | `/api/company-contacts/:id` | Update existing contact | None |
| `POST` | `/api/company-contacts/sync` | Trigger manual sync from ManageOrders | API Key |

### Search Behavior

- **Minimum characters:** 3 (requests with fewer characters return empty array)
- **Fields searched:** `CustomerCompanyName`, `ct_NameFull`, `ContactNumbersEmail`
- **Filter:** `Customersts_Active = 1` (active customers only)
- **Sort:** `Customerdate_LastOrdered DESC` (most recent orders first)
- **Limit:** 10 results

### Example Search Request

```javascript
// Frontend
const response = await fetch(
  'https://caspio-pricing-proxy.herokuapp.com/api/company-contacts/search?q=acme'
);
const contacts = await response.json();
```

### Example Search Response

```json
[
  {
    "ID_Contact": 12345,
    "id_Customer": 5678,
    "CustomerCompanyName": "Acme Corporation",
    "ct_NameFull": "John Smith",
    "NameFirst": "John",
    "NameLast": "Smith",
    "ContactNumbersEmail": "john@acme.com",
    "CustomerCustomerServiceRep": "Taneisha",
    "Customersts_Active": 1,
    "Customerdate_LastOrdered": "2026-01-15",
    "Address": "123 Main St",
    "City": "Tacoma",
    "State": "WA",
    "Zip": "98402"
  }
]
```

---

## Frontend Service

### Files

| File | Purpose |
|------|---------|
| `shared_components/js/customer-lookup-service.js` | CustomerLookupService class |
| `shared_components/css/customer-lookup.css` | Dropdown styling |

### Integration in Quote Builders

Each quote builder HTML file includes:

```html
<!-- CSS -->
<link rel="stylesheet" href="../shared_components/css/customer-lookup.css">

<!-- JavaScript -->
<script src="../shared_components/js/customer-lookup-service.js"></script>
```

Each quote builder JS initializes the service:

```javascript
// Initialize customer lookup autocomplete
const customerLookup = new CustomerLookupService({
    inputId: 'customer-lookup',      // The autocomplete input field
    nameFieldId: 'customer-name',    // Auto-fill target for name
    emailFieldId: 'customer-email',  // Auto-fill target for email
    companyFieldId: 'company-name',  // Auto-fill target for company
    apiBaseUrl: APP_CONFIG.API.BASE_URL
});
```

### CustomerLookupService Class

```javascript
class CustomerLookupService {
    constructor(options) {
        this.inputId = options.inputId;
        this.nameFieldId = options.nameFieldId;
        this.emailFieldId = options.emailFieldId;
        this.companyFieldId = options.companyFieldId;
        this.apiBaseUrl = options.apiBaseUrl;
        this.minChars = 3;
        this.debounceMs = 300;

        this.init();
    }

    async search(query) {
        // Fetches from /api/company-contacts/search?q=<query>
        // Returns array of matching contacts
    }

    selectContact(contact) {
        // Populates name, email, company fields
        // Closes dropdown
    }

    // ... other methods
}
```

### CSS Classes

```css
.customer-lookup-container { /* Wrapper for input + dropdown */ }
.customer-lookup-dropdown { /* Autocomplete results container */ }
.customer-lookup-item { /* Individual result row */ }
.customer-lookup-item:hover { /* Hover state */ }
.customer-lookup-item.selected { /* Keyboard navigation highlight */ }
.customer-lookup-company { /* Company name in result */ }
.customer-lookup-contact { /* Contact name in result */ }
.customer-lookup-email { /* Email in result */ }
```

---

## Caspio Table: Company_Contacts_Merge_ODBC

### Key Fields

| Field | Type | Purpose |
|-------|------|---------|
| `ID_Contact` | Integer | Primary key (auto-generated) |
| `id_Customer` | Integer | ShopWorks customer ID (for linking) |
| `CustomerCompanyName` | Text | Company/organization name |
| `ct_NameFull` | Text | Full contact name |
| `NameFirst` | Text | First name |
| `NameLast` | Text | Last name |
| `ContactNumbersEmail` | Text | Email address |
| `CustomerCustomerServiceRep` | Text | Assigned sales rep name |
| `Customersts_Active` | Integer | 1 = active, 0 = inactive |
| `Customerdate_LastOrdered` | DateTime | Last order date (for sorting) |
| `Address` | Text | Street address |
| `City` | Text | City |
| `State` | Text | State abbreviation |
| `Zip` | Text | ZIP code |

### Notes

- **Phone field:** The table does NOT have a phone field, which is why phone was removed from quote builder forms
- **ODBC source:** Data originally comes from ShopWorks via ODBC connection, then synced via API
- **Deduplication:** Sync process uses `id_Customer` to avoid duplicates

---

## Heroku Scheduler Configuration

### Job Details

- **Command:** `npm run sync-contacts`
- **Schedule:** Daily at 2:00 AM UTC (6:00 PM PST previous day)
- **Script:** `scripts/sync-contacts.js`

### What the Sync Does

1. Queries ManageOrders for orders invoiced in the last 24 hours
2. Extracts unique customer contacts from those orders
3. For each contact:
   - Checks if `id_Customer` exists in Caspio
   - If exists: Updates with latest info
   - If new: Creates new record
4. Logs results to console

### Manual Sync Trigger

```bash
# Via API (requires X-CRM-API-Secret header)
curl -X POST https://caspio-pricing-proxy.herokuapp.com/api/company-contacts/sync \
  -H "X-CRM-API-Secret: your-secret-key"

# Via Heroku CLI
heroku run npm run sync-contacts -a caspio-pricing-proxy
```

---

## Quote Builder Changes

### Files Modified

| File | Changes |
|------|---------|
| `quote-builders/dtf-quote-builder.html` | Added lookup field, removed phone field |
| `quote-builders/dtg-quote-builder.html` | Added lookup field, removed phone field |
| `quote-builders/screenprint-quote-builder.html` | Added lookup field, removed phone field |
| `quote-builders/embroidery-quote-builder.html` | Added lookup field, removed phone field |
| `shared_components/js/base-quote-service.js` | Removed Phone field from Caspio save |
| `shared_components/js/dtf-quote-service.js` | Removed Phone field |
| `shared_components/js/dtg-quote-service.js` | Removed Phone field |
| `shared_components/js/screenprint-quote-service.js` | Removed Phone field |
| `shared_components/js/embroidery-quote-service.js` | Removed Phone field |

### HTML Structure Change

```html
<!-- BEFORE -->
<div class="form-group">
    <label for="customer-phone">Phone</label>
    <input type="tel" id="customer-phone" name="customerPhone">
</div>

<!-- AFTER -->
<div class="form-group customer-lookup-container">
    <label for="customer-lookup">Customer Lookup</label>
    <input type="text" id="customer-lookup"
           placeholder="Search by company, name, or email..."
           autocomplete="off">
    <div id="customer-lookup-dropdown" class="customer-lookup-dropdown"></div>
</div>
```

---

## Troubleshooting

### Issue: No results returned

1. **Check minimum characters** - Must type at least 3 characters
2. **Check if customer is active** - Only `Customersts_Active = 1` returned
3. **Check Caspio table** - Run query directly to verify data exists
4. **Check API logs** - Look at Heroku logs for errors

```bash
heroku logs --tail -a caspio-pricing-proxy | grep company-contacts
```

### Issue: Stale data

1. **Check sync schedule** - Sync runs daily at 2:00 AM UTC
2. **Trigger manual sync** - POST to `/api/company-contacts/sync`
3. **Check ManageOrders** - Verify orders are being invoiced

### Issue: Dropdown not appearing

1. **Check CSS loaded** - Verify `customer-lookup.css` is linked
2. **Check JS loaded** - Verify `customer-lookup-service.js` is loaded
3. **Check initialization** - Ensure `CustomerLookupService` is instantiated
4. **Check console** - Look for JavaScript errors

### Issue: Fields not auto-filling

1. **Check field IDs** - Ensure `nameFieldId`, `emailFieldId`, `companyFieldId` match HTML
2. **Check contact data** - Some contacts may have null values
3. **Check console** - Look for errors in `selectContact()` method

---

## Related Documentation

- [QUOTE_BUILDER_FEATURE_AUDIT.md](./QUOTE_BUILDER_FEATURE_AUDIT.md) - Feature matrix for all quote builders
- [QUOTE_BUILDER_GUIDE.md](./QUOTE_BUILDER_GUIDE.md) - How to build new quote builders
- [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) - Past bugs and solutions
- [manageorders/CUSTOMER_AUTOCOMPLETE.md](./manageorders/CUSTOMER_AUTOCOMPLETE.md) - Original ManageOrders autocomplete (different system)

---

## Future Enhancements

- [ ] Add phone field to Caspio table if needed
- [ ] Add "Create New Customer" option when no matches found
- [ ] Add keyboard navigation (arrow keys, enter to select)
- [ ] Consider caching recent searches
- [ ] Add sales rep filter option
