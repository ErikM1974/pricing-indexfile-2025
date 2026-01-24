# CRM Dashboard Authentication

**Purpose:** Documents the role-based authentication system protecting Taneisha's, Nika's, and House account CRM dashboards.

**Related:** [CASPIO_STAFF_AUTH.md](./CASPIO_STAFF_AUTH.md) covers token-based auth for staff-dashboard.html (different system)

---

## Architecture Overview

The CRM dashboard system uses **three-layer security**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Three-Layer Security Model                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Caspio Authentication (user identity)                             │
│  Layer 2: Express Sessions + Roles (authorization)                          │
│  Layer 3: Server-to-Server Secret (API protection)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Browser │────▶│ Pricing Index    │────▶│ caspio-pricing-proxy│
│         │     │ (Express server) │     │                     │
│ Session │     │ Session + Role   │     │ X-CRM-API-Secret    │
│ Cookie  │     │ Validation       │     │ header validated    │
└─────────┘     └──────────────────┘     └─────────────────────┘
```

### Authentication Flow

```
1. User visits staff-login.html
         ↓
2. Caspio DataPage authenticates user (checks Staff Auth table)
         ↓
3. JavaScript calls POST /api/crm-session with {name, email}
         ↓
4. Server checks CRM_PERMISSIONS, stores session with roles
         ↓
5. User redirected to their dashboard
         ↓
6. API calls: Browser → Pricing Index (session check) → caspio-pricing-proxy (secret check)
```

**Key differences from staff-dashboard.html auth:**
- staff-dashboard.html: Token-based, Caspio handles everything
- CRM dashboards: Express sessions with role-based access control

---

## Server-Side Components

### 1. Session Configuration (server.js:154-164)

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax',
    maxAge: null // Session cookie - expires when browser closes
  }
}));
```

### 2. Role Permissions Object (server.js:170-174)

```javascript
const CRM_PERMISSIONS = {
  'Erik': ['taneisha', 'nika', 'house'],  // Full admin access
  'Taneisha': ['taneisha'],                // Own dashboard only
  'Nika': ['nika']                         // Own dashboard only
};
```

**To add a new user:** Add their first name (from Caspio Staff Auth) with their allowed roles.

### 3. Session Creation Endpoint (server.js:508-540)

```javascript
app.post('/api/crm-session', express.json(), (req, res) => {
  const { name, email } = req.body;

  // Extract first name and look up permissions
  const firstName = name.split(' ')[0];
  const permissions = CRM_PERMISSIONS[firstName];

  if (!permissions) {
    return res.status(403).json({ error: 'User not authorized for CRM access' });
  }

  // Store in session
  req.session.crmUser = {
    name: name,
    email: email || '',
    firstName: firstName,
    permissions: permissions
  };

  res.json({ success: true, permissions, firstName });
});
```

### 4. Role-Based Middleware (server.js:177-237)

```javascript
function requireCrmRole(allowedRoles) {
  return (req, res, next) => {
    const isApiRequest = req.originalUrl.startsWith('/api/');

    // Check session exists
    if (!req.session?.crmUser) {
      if (isApiRequest) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Session expired' });
      }
      return res.redirect('/dashboards/staff-login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }

    // Check role permission
    const userPerms = req.session.crmUser.permissions || [];
    const hasAccess = allowedRoles.some(role => userPerms.includes(role));

    if (!hasAccess) {
      if (isApiRequest) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.status(403).send(/* Access denied HTML */);
    }

    next();
  };
}
```

**Key behavior:**
- API requests (`/api/*`) → JSON error responses (401/403)
- Page requests → Redirect to login or render access denied HTML

### 5. CRM Proxy Factory (server.js:573-607)

```javascript
function createCrmProxy(endpoint, allowedRoles) {
  return [
    requireCrmRole(allowedRoles),  // First: check session/role
    async (req, res) => {
      // Then: forward to caspio-pricing-proxy with secret header
      const targetUrl = `${CRM_API_BASE}/api/${endpoint}${targetPath}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-API-Secret': CRM_API_SECRET  // Server-side secret
        },
        body: req.body ? JSON.stringify(req.body) : undefined
      });
      res.status(response.status).json(await response.json());
    }
  ];
}
```

### 6. Protected Routes (server.js:553-616)

```javascript
// Dashboard pages
app.get('/dashboards/taneisha-crm.html', requireCrmRole(['taneisha']), ...);
app.get('/dashboards/nika-crm.html', requireCrmRole(['nika']), ...);
app.get('/dashboards/house-accounts.html', requireCrmRole(['house']), ...);

// API proxies
app.all('/api/crm-proxy/taneisha-accounts*', ...createCrmProxy('taneisha-accounts', ['taneisha']));
app.all('/api/crm-proxy/nika-accounts*', ...createCrmProxy('nika-accounts', ['nika']));
app.all('/api/crm-proxy/house-accounts*', ...createCrmProxy('house-accounts', ['house']));
```

---

## Frontend Components

### 1. staff-login.html - Session Creation

After Caspio authenticates the user, JavaScript establishes the Express session:

```javascript
async function establishCrmSession(userName, userEmail) {
  const response = await fetch('/api/crm-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: userName, email: userEmail })
  });

  const data = await response.json();
  if (data.success) {
    // Redirect to dashboard based on permissions
  }
}
```

### 2. rep-crm.js - RepAccountService

Used by taneisha-crm.html and nika-crm.html:

```javascript
class RepAccountService {
  handleAuthError(response) {
    if (response.status === 401) {
      // Session expired - redirect to login with return URL
      window.location.href = '/dashboards/staff-login.html?redirect=' +
        encodeURIComponent(window.location.pathname);
      return true;
    }
    return false;
  }

  async fetchAccounts(filters = {}) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (this.handleAuthError(response)) return [];
    // ... process response
  }
}
```

### 3. house-accounts.js - HouseAccountsService

Same pattern as RepAccountService - all fetch calls include `credentials: 'same-origin'` and check for 401 responses.

---

## Backend: Server-to-Server Authentication

The Pricing Index server proxies CRM requests to caspio-pricing-proxy using a shared secret. **Browsers cannot access CRM endpoints directly.**

### X-CRM-API-Secret Header

When the proxy forwards requests, it adds:
```javascript
headers: {
  'X-CRM-API-Secret': process.env.CRM_API_SECRET
}
```

The backend (caspio-pricing-proxy) validates this header via `requireCrmApiSecret` middleware.

### Environment Variables Required

| App | Heroku App | Variable | Purpose |
|-----|------------|----------|---------|
| caspio-pricing-proxy | `caspio-pricing-proxy-ab30a049961a` | `CRM_API_SECRET` | Validates incoming requests |
| Pricing Index | `sanmar-inventory-app` | `CRM_API_SECRET` | Sends with proxy requests |

**Both apps must have the SAME secret value.**

```bash
# Set on both apps (use same value)
heroku config:set CRM_API_SECRET=your-secret-here -a caspio-pricing-proxy-ab30a049961a
heroku config:set CRM_API_SECRET=your-secret-here -a sanmar-inventory-app
```

### Why Browsers Can't Access Directly

Direct calls to `caspio-pricing-proxy.../api/taneisha-accounts` return 401 because:
1. Browsers don't have the `CRM_API_SECRET`
2. Only server-side code can include the secret header
3. Session validation happens before the proxy forwards requests

**See also:** `caspio-pricing-proxy/memory/CRM_SECURITY.md` for backend details

---

## How to Add New Protected API Endpoints

### Pattern 1: Add to Existing CRM Proxy

If adding a new endpoint to an existing rep's API (e.g., new Taneisha endpoint):

1. **Backend (caspio-pricing-proxy):** Add the endpoint under `/api/taneisha-accounts/*`
2. **Frontend:** Call it via `/api/crm-proxy/taneisha-accounts/your-endpoint`
3. No changes needed to this project's server.js

### Pattern 2: Add a New Protected CRM Proxy

If adding a completely new protected resource:

**Step 1: Backend (caspio-pricing-proxy)**
```javascript
// src/routes/new-resource.js - create the API
// server.js - register with middleware:
const newResourceRoutes = require('./src/routes/new-resource');
app.use('/api/new-resource', requireCrmApiSecret, newResourceRoutes);
```

**Step 2: Frontend (this project) server.js:**
```javascript
// Add new proxy route (before static middleware, around line 616)
app.all('/api/crm-proxy/new-resource*', ...createCrmProxy('new-resource', ['required-role']));
```

No new env vars needed - both `requireCrmApiSecret` (backend) and `createCrmProxy` (frontend) reuse existing `CRM_API_SECRET`.

**Frontend service class:**
```javascript
class NewResourceService {
  constructor() {
    this.baseURL = window.location.origin;
  }

  // REQUIRED: Handle session expiration
  handleAuthError(response) {
    if (response.status === 401) {
      window.location.href = '/dashboards/staff-login.html?redirect=' +
        encodeURIComponent(window.location.pathname);
      return true;
    }
    return false;
  }

  // REQUIRED: Include credentials in all fetch calls
  async fetchData() {
    const response = await fetch(`${this.baseURL}/api/crm-proxy/new-resource`, {
      credentials: 'same-origin'  // CRITICAL - sends session cookie
    });

    if (this.handleAuthError(response)) return null;
    // ... process response
  }

  async updateData(id, data) {
    const response = await fetch(`${this.baseURL}/api/crm-proxy/new-resource/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',  // CRITICAL
      body: JSON.stringify(data)
    });

    if (this.handleAuthError(response)) return null;
    // ... process response
  }
}
```

### Pattern 3: Public API (No Auth)

For endpoints that don't need authentication:

```javascript
// server.js - just add the route normally
app.get('/api/public-data', async (req, res) => {
  // No requireCrmRole middleware
  res.json({ data: 'public' });
});
```

---

## Key Rules for Frontend Fetch Calls

| Rule | Example |
|------|---------|
| Always include credentials | `credentials: 'same-origin'` |
| Always handle 401 | `if (this.handleAuthError(response)) return;` |
| Use proxy path | `/api/crm-proxy/[endpoint]` not direct API |
| Check response.ok | Before processing JSON |

**Incorrect:**
```javascript
const response = await fetch('/api/crm-proxy/accounts');  // Missing credentials
```

**Correct:**
```javascript
const response = await fetch('/api/crm-proxy/accounts', {
  credentials: 'same-origin'
});
if (this.handleAuthError(response)) return [];
if (!response.ok) throw new Error('Failed to fetch');
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Unable to load accounts" toast | Missing `CRM_API_SECRET` on frontend app | `heroku config:set CRM_API_SECRET=...` on sanmar-inventory-app |
| "Server configuration error" (500) | Missing `CRM_API_SECRET` on API app | Set env var on caspio-pricing-proxy |
| "Unauthorized" in browser console | Secret mismatch between apps | Ensure both apps have identical secret |
| Works locally but not production | Forgot to set Heroku env vars | Check `heroku config` on both apps |
| Session expired after deployment | MemoryStore cleared on dyno restart | Users must log in again (expected) |

### Debugging Commands

```bash
# Check if secret is set on API
heroku config:get CRM_API_SECRET -a caspio-pricing-proxy-ab30a049961a

# Check if secret is set on frontend
heroku config:get CRM_API_SECRET -a sanmar-inventory-app

# Test endpoint directly (should fail - no secret)
curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/taneisha-accounts

# Test with secret (should succeed)
curl -H "X-CRM-API-Secret: YOUR_SECRET" \
  https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/taneisha-accounts
```

---

## Known Limitations

### 1. Session Storage (MemoryStore)

Currently using Express's default MemoryStore:
- Sessions are lost on dyno restart (Heroku cycles every 24h)
- Not suitable for multiple server instances
- Users may need to re-login after deployment

**Future improvement:** Implement Redis session store:
```javascript
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... other options
}));
```

### 2. Session Lifetime

Sessions expire when browser closes (`maxAge: null`). No "remember me" functionality.

### 3. Role Changes

If a user's permissions change in `CRM_PERMISSIONS`, they must log out and back in to get the new roles.

---

## Available CRM API Endpoints (caspio-pricing-proxy)

These endpoints are available via the CRM proxy. Call them from frontend as `/api/crm-proxy/[endpoint]`.

### Taneisha Accounts (`/api/taneisha-accounts/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/taneisha-accounts` | GET | List all accounts (supports filters) |
| `/taneisha-accounts/:id` | GET | Single account by ID_Customer |
| `/taneisha-accounts` | POST | Create new account |
| `/taneisha-accounts/:id` | PUT | Update account |
| `/taneisha-accounts/:id` | DELETE | Delete account |
| `/taneisha-accounts/reconcile` | GET | Compare CRM vs ManageOrders (60-day orders) |
| `/taneisha-accounts/gap-report` | GET | **NEW** - Orders by Taneisha for customers NOT in CRM |

### Nika Accounts (`/api/nika-accounts/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nika-accounts` | GET | List all accounts (supports filters) |
| `/nika-accounts/:id` | GET | Single account by ID_Customer |
| `/nika-accounts` | POST | Create new account |
| `/nika-accounts/:id` | PUT | Update account |
| `/nika-accounts/:id` | DELETE | Delete account |
| `/nika-accounts/reconcile` | GET | Compare CRM vs ManageOrders (60-day orders) |
| `/nika-accounts/gap-report` | GET | **NEW** - Orders by Nika for customers NOT in CRM |

### Gap Report Response Format
```json
{
  "success": true,
  "rep": "Nika Lao",
  "gapAmount": 19092.05,
  "gapOrderCount": 32,
  "gapCustomerCount": 24,
  "customers": [
    {
      "ID_Customer": 11430,
      "companyName": "Pierce County Emergency Management",
      "orders": [
        { "orderNumber": 139436, "amount": 3364, "date": "2025-12-15" }
      ],
      "totalSales": 6728,
      "orderCount": 2
    }
  ]
}
```

### Assignment History (`/api/assignment-history/*`) - PUBLIC (no auth required)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/assignment-history` | GET | Query history by customerId |
| `/assignment-history` | POST | Log assignment change |
| `/assignment-history/recent` | GET | Recent activity |
| `/assignment-history/stats` | GET | Statistics by action type, source, rep |

---

## Related Files Summary

### This Project (Pricing Index)

| Component | File | Lines |
|-----------|------|-------|
| Session config | server.js | 154-164 |
| CRM_PERMISSIONS | server.js | 170-174 |
| requireCrmRole() | server.js | 177-237 |
| POST /api/crm-session | server.js | 508-540 |
| GET /crm-logout | server.js | 543-549 |
| Dashboard routes | server.js | 553-561 |
| createCrmProxy() | server.js | 573-607 |
| Proxy routes | server.js | 610-616 |
| Login page | dashboards/staff-login.html | - |
| Rep CRM service | dashboards/js/rep-crm.js | - |
| House service | dashboards/js/house-accounts.js | - |

### Backend (caspio-pricing-proxy)

| Component | File |
|-----------|------|
| requireCrmApiSecret middleware | src/middleware/index.js |
| Protected route registration | server.js:409-440 |
| Backend security docs | memory/CRM_SECURITY.md |
| Taneisha accounts API | memory/TANEISHA_ACCOUNTS_API.md |
| Nika accounts API | memory/NIKA_ACCOUNTS_API.md |
| House accounts API | memory/HOUSE_ACCOUNTS_API.md |

---

## Security Notes

1. **CRM_API_SECRET** is stored in environment variables, never exposed to browser
2. **httpOnly cookies** prevent JavaScript access to session cookie
3. **sameSite: 'lax'** provides CSRF protection
4. **secure: true** in production ensures HTTPS-only cookies
5. **Role checks happen server-side** - frontend permissions are for UX only

---

*Last updated: 2026-01-24*
