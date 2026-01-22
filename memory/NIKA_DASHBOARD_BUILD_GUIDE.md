# Nika Dashboard Build Guide

This guide documents how to build Nika's CRM dashboard based on Taneisha's implementation.

## Overview

Nika's dashboard will share the same CSS and JS as Taneisha's, with only HTML and config differences:
- Different API endpoints (`/api/nika-accounts/` instead of `/api/taneisha-accounts/`)
- Different page title and header
- Different account tier values in filter dropdown

## Recommended Architecture: Shared CSS/JS

**Why share?** If you change the layout or fix a bug in one dashboard, it automatically applies to both.

### File Structure

```
dashboards/
├── css/
│   └── rep-crm.css              # SHARED - Both reps use this
├── js/
│   └── rep-crm.js               # SHARED - Config-driven
├── taneisha-crm.html            # Taneisha's HTML (loads shared CSS/JS)
├── taneisha-calendar.html       # Taneisha's calendar
├── nika-crm.html                # Nika's HTML (loads shared CSS/JS)
└── nika-calendar.html           # Nika's calendar
```

### Step 1: Rename CSS File

```bash
# Rename the CSS to be shared
mv dashboards/css/taneisha-crm.css dashboards/css/rep-crm.css
```

### Step 2: Rename JS File

```bash
# Rename the JS to be shared
mv dashboards/js/taneisha-crm.js dashboards/js/rep-crm.js
```

### Step 3: Update Taneisha's HTML

Change the CSS/JS references and add a config script:

```html
<!-- In taneisha-crm.html -->
<link href="/dashboards/css/rep-crm.css" rel="stylesheet">

<!-- Add config BEFORE the shared JS -->
<script>
    window.REP_CONFIG = {
        repName: 'Taneisha',
        apiEndpoint: '/api/taneisha-accounts',
        archiveEndpoint: '/api/taneisha/daily-sales-by-account',
        tiers: {
            gold: "GOLD '26-TANEISHA",
            silver: "SILVER '26-TANEISHA",
            bronze: "BRONZE '26-TANEISHA",
            winBack: "Win Back '26 TANEISHA"
        }
    };
</script>
<script src="/dashboards/js/rep-crm.js"></script>
```

### Step 4: Create Nika's HTML

Copy `taneisha-crm.html` to `nika-crm.html` and change:

```html
<!-- In nika-crm.html -->
<title>Nika's Account CRM - Northwest Custom Apparel</title>
<h1 class="header-title">Nika's Account CRM</h1>

<!-- Navigation links -->
<a href="/dashboards/nika-crm.html" class="active">CRM List</a>
<a href="/dashboards/nika-calendar.html">Calendar</a>

<!-- Filter dropdown tier values -->
<option value="GOLD '26-NIKA">Gold</option>
<option value="SILVER '26-NIKA">Silver</option>
<option value="BRONZE '26-NIKA">Bronze</option>
<option value="Win Back '26 NIKA">Win Back</option>

<!-- Config for Nika -->
<script>
    window.REP_CONFIG = {
        repName: 'Nika',
        apiEndpoint: '/api/nika-accounts',
        archiveEndpoint: '/api/nika/daily-sales-by-account',
        tiers: {
            gold: "GOLD '26-NIKA",
            silver: "SILVER '26-NIKA",
            bronze: "BRONZE '26-NIKA",
            winBack: "Win Back '26 NIKA"
        }
    };
</script>
<script src="/dashboards/js/rep-crm.js"></script>
```

### Step 5: Update Shared JS to Use Config

In `rep-crm.js`, change the service class to read from config:

```javascript
class RepCRMService {
    constructor() {
        // Use config or fallback to Taneisha (backwards compatible)
        const config = window.REP_CONFIG || {
            repName: 'Taneisha',
            apiEndpoint: '/api/taneisha-accounts',
            archiveEndpoint: '/api/taneisha/daily-sales-by-account'
        };

        this.repName = config.repName;
        this.apiEndpoint = config.apiEndpoint;
        this.archiveEndpoint = config.archiveEndpoint;

        this.baseURL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // ... rest of constructor
    }

    async fetchAccounts(filters = {}) {
        // Use this.apiEndpoint instead of hardcoded path
        const url = `${this.baseURL}${this.apiEndpoint}${params...}`;
        // ...
    }

    async syncSales() {
        const response = await fetch(`${this.baseURL}${this.apiEndpoint}/sync-sales`, {
            // ...
        });
    }

    async reconcileAccounts(autoAdd = false) {
        const url = autoAdd
            ? `${this.baseURL}${this.apiEndpoint}/reconcile?autoAdd=true`
            : `${this.baseURL}${this.apiEndpoint}/reconcile`;
        // ...
    }
}
```

---

## Alternative: Copy Files (Simpler but Less Maintainable)

If you prefer separate files (easier to start, harder to maintain):

| Source File | New File |
|-------------|----------|
| `dashboards/taneisha-crm.html` | `dashboards/nika-crm.html` |
| `dashboards/taneisha-calendar.html` | `dashboards/nika-calendar.html` |
| `dashboards/js/taneisha-crm.js` | `dashboards/js/nika-crm.js` |
| `dashboards/js/taneisha-calendar.js` | `dashboards/js/nika-calendar.js` |
| `dashboards/css/taneisha-crm.css` | `dashboards/css/nika-crm.css` |

**Downside:** Changes to one dashboard require manual updates to the other.

## Changes Required

### 1. HTML Files (`nika-crm.html`, `nika-calendar.html`)

**Page Title & Header:**
```html
<!-- Change -->
<title>Taneisha's Account CRM - Northwest Custom Apparel</title>
<!-- To -->
<title>Nika's Account CRM - Northwest Custom Apparel</title>

<!-- Change -->
<h1 class="header-title">Taneisha's Account CRM</h1>
<!-- To -->
<h1 class="header-title">Nika's Account CRM</h1>
```

**CSS/JS Links:**
```html
<!-- Change -->
<link href="/dashboards/css/taneisha-crm.css" rel="stylesheet">
<script src="/dashboards/js/taneisha-crm.js"></script>
<!-- To -->
<link href="/dashboards/css/nika-crm.css" rel="stylesheet">
<script src="/dashboards/js/nika-crm.js"></script>
```

**Navigation Links:**
```html
<!-- Change -->
<a href="/dashboards/taneisha-crm.html" class="active">CRM List</a>
<a href="/dashboards/taneisha-calendar.html">Calendar</a>
<!-- To -->
<a href="/dashboards/nika-crm.html" class="active">CRM List</a>
<a href="/dashboards/nika-calendar.html">Calendar</a>
```

**Account Tier Filter Options:**
```html
<!-- Change Taneisha's tier values -->
<option value="GOLD '26-TANEISHA">Gold</option>
<option value="SILVER '26-TANEISHA">Silver</option>
<option value="BRONZE '26-TANEISHA">Bronze</option>
<option value="Win Back '26 TANEISHA">Win Back</option>
<!-- To Nika's tier values (verify exact values in Caspio) -->
<option value="GOLD '26-NIKA">Gold</option>
<option value="SILVER '26-NIKA">Silver</option>
<option value="BRONZE '26-NIKA">Bronze</option>
<option value="Win Back '26 NIKA">Win Back</option>
```

### 2. JavaScript File (`nika-crm.js`)

**Class Names:**
```javascript
// Change
class TaneishaCRMService { ... }
class TaneishaCRMController { ... }
// To
class NikaCRMService { ... }
class NikaCRMController { ... }
```

**API Endpoints:**
```javascript
// Change all occurrences of:
`${this.baseURL}/api/taneisha-accounts`
`${this.baseURL}/api/taneisha-accounts/${id}`
`${this.baseURL}/api/taneisha-accounts/${id}/crm`
`${this.baseURL}/api/taneisha-accounts/sync-sales`
`${this.baseURL}/api/taneisha-accounts/reconcile`
`${this.baseURL}/api/taneisha/daily-sales-by-account`

// To:
`${this.baseURL}/api/nika-accounts`
`${this.baseURL}/api/nika-accounts/${id}`
`${this.baseURL}/api/nika-accounts/${id}/crm`
`${this.baseURL}/api/nika-accounts/sync-sales`
`${this.baseURL}/api/nika-accounts/reconcile`
`${this.baseURL}/api/nika/daily-sales-by-account`
```

**Console Log Prefixes:**
```javascript
// Change
console.log('[TaneishaCRM] ...')
// To
console.log('[NikaCRM] ...')
```

**Controller Initialization:**
```javascript
// Change
window.crmController = new TaneishaCRMController();
// To
window.crmController = new NikaCRMController();
```

### 3. CSS File (`nika-crm.css`)

**Color Theme (Optional - for visual differentiation):**

Suggest changing from WSU Crimson (`#981e32`) to a purple/violet theme:

```css
/* Change */
:root {
    --wsu-crimson: #981e32;
    --wsu-crimson-dark: #7a1828;
    --wsu-crimson-light: #b52a42;
}

/* To (example purple theme) */
:root {
    --nika-purple: #7c3aed;
    --nika-purple-dark: #6d28d9;
    --nika-purple-light: #8b5cf6;
}
```

Then find/replace:
- `var(--wsu-crimson)` → `var(--nika-purple)`
- `var(--wsu-crimson-dark)` → `var(--nika-purple-dark)`
- `var(--wsu-crimson-light)` → `var(--nika-purple-light)`

## API Endpoints Summary

| Feature | Taneisha Endpoint | Nika Endpoint |
|---------|-------------------|---------------|
| List Accounts | `GET /api/taneisha-accounts` | `GET /api/nika-accounts` |
| Get Account | `GET /api/taneisha-accounts/:id` | `GET /api/nika-accounts/:id` |
| Update CRM | `PUT /api/taneisha-accounts/:id/crm` | `PUT /api/nika-accounts/:id/crm` |
| Sync Sales | `POST /api/taneisha-accounts/sync-sales` | `POST /api/nika-accounts/sync-sales` |
| Reconcile | `GET /api/taneisha-accounts/reconcile` | `GET /api/nika-accounts/reconcile` |
| Auto-Add | `GET /api/taneisha-accounts/reconcile?autoAdd=true` | `GET /api/nika-accounts/reconcile?autoAdd=true` |

## Features Included

Both dashboards have these features:

### Account Management
- Account list with filtering (tier, priority, month, trend, products)
- Search by company name
- Quick filter buttons (At Risk, Overdue, Call This Month)
- Account cards with contact info, YTD sales, health score

### CRM Modal
- Log contact date and status
- Add contact notes
- Schedule follow-up (date + type)
- Won Back Date tracking

### Gamification
- Call streak tracker
- Win-Back Bounty progress
- Smart suggestions for who to call

### Sales Tracking
- 2026 YTD Sales breakdown by tier
- 5% Win-Back bonus calculation
- Sync Sales button (pulls from ManageOrders)

### Reconcile Feature
- Find customers with orders not in account list
- Table showing: Company, Orders, Sales, Last Order Date
- "Add All Missing" button to auto-add

### Calendar View
- Monthly calendar with follow-ups
- Call This Month panel
- Click day to see scheduled accounts

## Backend Requirements

Make sure these backend routes exist in `caspio-pricing-proxy`:

```
src/routes/nika-accounts.js     # Main account CRUD + sync
src/routes/nika-daily-sales.js  # Archive endpoints (if using)
```

The backend should already have these based on the Taneisha implementation pattern.

## Caspio Table

Nika's accounts are stored in: `Nika_Accounts_2026`

Key fields (same as Taneisha):
- `PK_ID` - Primary key
- `id_Customer` - ShopWorks customer ID
- `CompanyName` - Company name
- `Account_Tier` - Gold/Silver/Bronze/Win Back
- `YTD_Sales_2026` - Year-to-date sales
- `Order_Count_2026` - Order count
- `Last_Order_Date` - Most recent order
- `Last_Sync_Date` - Last sync timestamp
- CRM fields: `Last_Contact_Date`, `Contact_Status`, `Contact_Notes`, `Next_Follow_Up`, `Follow_Up_Type`, `Won_Back_Date`

## Testing Checklist

After building Nika's dashboard:

- [ ] Page loads without errors
- [ ] Account list populates from API
- [ ] Filters work (tier, priority, month, etc.)
- [ ] Search by company name works
- [ ] Account cards show correct data
- [ ] Click account → CRM modal opens
- [ ] Save CRM data → updates in Caspio
- [ ] Sync Sales button → fetches from ManageOrders
- [ ] Reconcile button → shows modal
- [ ] Add All Missing → adds customers to Caspio
- [ ] Calendar view loads and shows follow-ups
- [ ] Gamification sidebar updates correctly

## Notes

- Both reps are fully synced for 2026 (Taneisha: 801 accounts, Nika: 412 accounts)
- The Rep Audit endpoint (`/api/rep-audit`) can check for cross-rep order issues
- Win-back bonus is 5% of YTD sales for accounts with `Won_Back_Date` set
