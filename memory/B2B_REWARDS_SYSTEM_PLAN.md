# B2B Rewards System Implementation Plan

**Last Updated:** 2025-11-04
**Purpose:** Comprehensive reference guide for implementing a customer loyalty rewards system for paid sample orders
**Status:** Planning & Design Phase

---

## 📋 Executive Summary

### What Is This System?

A B2B loyalty program that rewards your wholesale customers with points they can redeem for discounted paid samples. Think of it as a "thank you" system for your best customers - the more they buy from you throughout the year, the more points they accumulate, which they can then use to get free or discounted samples.

### Key Benefits

- **Customer Retention:** Reward loyal customers with tangible benefits
- **Sample Order Conversion:** Turn paid samples into opportunities to showcase new products
- **Data-Driven:** Pre-assign points based on actual 2025 purchase history
- **Professional B2B Experience:** Customers log in to see their balance (not anonymous)
- **Automated Tracking:** Points earned, redeemed, and balanced tracked automatically

### Quick Stats

- **Implementation Time:** 5 weeks (phased rollout)
- **Estimated Cost:** $25,000 - $30,000 in development time
- **Customer Access:** Login-based (secure, tracked)
- **Integration:** Works with existing sample cart and ShopWorks system
- **Data Source:** Import from existing 2025 customer sales data

---

## 🎯 System Overview (Non-Technical)

### How It Works for Customers

**Scenario: Mike's Roofing**

1. **Background:** Mike's Roofing purchased $10,000 worth of products from you in 2025
2. **Point Assignment:** You assign them points (e.g., 100 points if ratio is $100 sales = 1 point)
3. **Email Notification:** Mike receives email: "You have 100 reward points! Log in to redeem."
4. **Login:** Mike goes to your website, logs in with credentials you provided
5. **Browse Samples:** Mike goes to Top Sellers Showcase, clicks "Request Sample"
6. **See Balance:** At checkout, Mike sees: "You have 100 points ($100 value) available"
7. **Redeem Points:** Mike orders 5 samples ($50 total), applies 50 points
8. **Order Placed:** Order goes through with $50 discount, Mike has 50 points left
9. **Track History:** Mike can log in anytime to see point balance and transaction history

### How It Works for You (Admin)

1. **Import Customer Data:** Upload CSV with customer names, emails, and 2025 sales totals
2. **Auto-Calculate Points:** System assigns points based on your chosen ratio
3. **Send Invitations:** Email all customers with login credentials and point balance
4. **Monitor Usage:** Dashboard shows who's redeeming points, what they're ordering
5. **Adjust Balances:** Add/subtract points for special promotions or corrections
6. **Annual Reset:** At year-end, optionally reset balances and recalculate from new data

---

## 🗄️ Database Structure

### Table 1: rewards_customers

**Purpose:** Store customer information, login credentials, and current point balance

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `customer_id` | AutoNumber | Primary key | 1 |
| `company_name` | String(100) | Company name | "Mike's Roofing" |
| `contact_name` | String(100) | Contact person | "Mike Johnson" |
| `email` | String(100) | Login email (unique) | "mike@mikesroofing.com" |
| `password` | Password | Encrypted password | (encrypted) |
| `current_balance` | Number | Current point balance | 100 |
| `total_earned` | Number | Lifetime points earned | 150 |
| `total_redeemed` | Number | Lifetime points used | 50 |
| `sales_2025` | Currency | 2025 purchase total | $10,000.00 |
| `status` | String(20) | Active/Suspended | "Active" |
| `created_date` | DateTime | When account created | 2025-11-04 |
| `last_login` | DateTime | Last login timestamp | 2025-11-03 |

**Key Features:**
- Caspio's built-in **Password field** = automatically encrypted
- **Email is unique** = prevents duplicate accounts
- **current_balance** = what they can spend now
- **total_earned** and **total_redeemed** = historical tracking

### Table 2: rewards_transactions

**Purpose:** Log every point earning and redemption for audit trail

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `transaction_id` | AutoNumber | Primary key | 1 |
| `customer_id` | Number | Links to rewards_customers | 1 |
| `transaction_type` | String(20) | Earned/Redeemed/Adjusted | "Redeemed" |
| `points_amount` | Number | Points (+ or -) | -50 |
| `balance_after` | Number | Balance after transaction | 50 |
| `order_id` | String(50) | Related order ID | "SAMPLE-110425-1" |
| `description` | String(255) | Transaction details | "Redeemed for 5 samples" |
| `transaction_date` | DateTime | When it happened | 2025-11-04 10:30:00 |
| `admin_note` | Text | Internal notes | "Manual adjustment" |

**Key Features:**
- **Immutable audit trail** = every change is logged
- **Balance_after** = snapshot of balance at transaction time
- **transaction_type** = categorize for reporting
- **order_id** = link to actual sample orders

---

## 🔐 Login Flow Architecture

### User Authentication Journey

```
Customer Email → Login Page → Caspio Authentication → Session Created
                                      ↓
                              Password Match?
                                      ↓
                        ┌─────────────┴─────────────┐
                        ↓                           ↓
                    Success                      Failure
                        ↓                           ↓
                 Dashboard Page            Error Message
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
   View Balance                    Browse Samples
        ↓                               ↓
   See Transactions            Redeem Points at Checkout
```

### Caspio Authentication Features

**Built-In Security:**
- **Encrypted Passwords:** Caspio uses bcrypt-level encryption (industry standard)
- **Session Management:** Automatic session cookies, configurable timeout
- **Cross-DataPage Auth:** Once logged in, stays logged in across all pages
- **Brute Force Protection:** Lock account after 5 failed login attempts

**Implementation Steps:**
1. Enable Authentication in Caspio app settings
2. Set `email` field as username field
3. Use built-in Password field type for `password`
4. Create login DataPage with authentication
5. Set session timeout (recommend 30 minutes)
6. Configure logout functionality

**No Custom Code Needed for:**
- Password hashing/encryption
- Session cookies
- Remember me functionality
- Password reset emails

---

## 🛒 Sample Cart Integration

### Current Sample Cart Flow

```
Browse Products → Select Samples → Add to Cart → Fill Info → Submit to ShopWorks
```

### New Flow with Rewards

```
Browse Products → Select Samples → Add to Cart → CHECK: Logged In?
                                                          ↓
                                      ┌───────────────────┴──────────────────┐
                                      ↓                                      ↓
                                  YES (Customer)                         NO (Guest)
                                      ↓                                      ↓
                          Show Point Balance UI                    Standard Checkout
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
            Apply Points Checkbox              Checkout Normally
                    ↓
        Calculate: Points × $1 = Discount
                    ↓
        Deduct from Total (min $0)
                    ↓
            Submit Order → Deduct Points → Log Transaction
```

### Code Integration Points

**File:** `pages/sample-cart.html`

**Add Point Balance Display:**
```javascript
// After cart loads
async function checkRewardsBalance() {
    // Check if user is logged in (Caspio session)
    const isLoggedIn = await checkCaspioSession();

    if (isLoggedIn) {
        // Fetch customer's point balance
        const balance = await fetch('/api/rewards/balance');
        const points = await balance.json();

        // Display balance UI
        document.getElementById('rewardsSection').innerHTML = `
            <div class="rewards-balance">
                <h4>Your Reward Points</h4>
                <p class="points-display">${points.current_balance} points available</p>
                <p class="points-value">($${points.current_balance} value)</p>
                <label>
                    <input type="checkbox" id="applyPoints" onchange="calculateWithPoints()">
                    Apply points to this order
                </label>
            </div>
        `;
    }
}
```

**Calculate Discount:**
```javascript
function calculateWithPoints() {
    const checkbox = document.getElementById('applyPoints');
    const orderTotal = calculateOrderTotal(); // Existing function
    const availablePoints = getCustomerPoints(); // From API

    if (checkbox.checked) {
        // Calculate maximum discount (don't go below $0)
        const maxDiscount = Math.min(availablePoints, orderTotal);
        const finalTotal = orderTotal - maxDiscount;

        // Update UI
        document.getElementById('discount').textContent = `$${maxDiscount.toFixed(2)}`;
        document.getElementById('finalTotal').textContent = `$${finalTotal.toFixed(2)}`;

        // Store for submission
        window.rewardsApplied = {
            points: maxDiscount,
            finalTotal: finalTotal
        };
    } else {
        // Reset to normal total
        document.getElementById('discount').textContent = '$0.00';
        document.getElementById('finalTotal').textContent = `$${orderTotal.toFixed(2)}`;
        window.rewardsApplied = null;
    }
}
```

**File:** `shared_components/js/sample-order-service.js`

**Add Point Deduction After Successful Order:**
```javascript
async submitOrder(orderData) {
    try {
        // Submit order to ShopWorks (existing code)
        const result = await fetch('/api/manageorders/orders/create', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });

        if (result.ok) {
            // If points were applied, deduct them
            if (window.rewardsApplied) {
                await fetch('/api/rewards/redeem', {
                    method: 'POST',
                    body: JSON.stringify({
                        customer_id: getCurrentCustomerId(),
                        points: window.rewardsApplied.points,
                        order_id: result.orderNumber,
                        description: `Redeemed for ${orderData.samples.length} samples`
                    })
                });
            }

            return { success: true };
        }
    } catch (error) {
        console.error('Order submission failed:', error);
        return { success: false };
    }
}
```

---

## 📊 Data Import Process

### Step 1: Prepare CSV File

**Excel Template:**

| company_name | contact_name | email | sales_2025 |
|--------------|--------------|-------|------------|
| Mike's Roofing | Mike Johnson | mike@mikesroofing.com | 10000 |
| ABC Construction | Sarah Lee | sarah@abcconstruction.com | 25000 |
| Northwest Souvenirs | Tom Smith | tom@nwsouvenirs.com | 5000 |

**Export as CSV** → `customer_rewards_2025.csv`

### Step 2: Calculate Points

**Option A: In Excel Before Import**

Add column `initial_points`:
```
=ROUNDDOWN(sales_2025 / 100, 0)
```

**Option B: In Caspio After Import**

Create calculated field:
```
FLOOR([@field:sales_2025] / 100)
```

### Step 3: Caspio Import Wizard

1. **Navigate:** Caspio → Tables → rewards_customers → Import Data
2. **Upload CSV:** Select your file
3. **Map Fields:**
   - company_name → company_name
   - contact_name → contact_name
   - email → email
   - sales_2025 → sales_2025
   - initial_points → current_balance
4. **Generate Passwords:** Use Caspio's "Generate Random Password" feature
5. **Set Defaults:**
   - status = "Active"
   - total_earned = initial_points
   - total_redeemed = 0
   - created_date = Current timestamp
6. **Import:** Click "Import Records"

### Step 4: Export Credentials

After import, export table to CSV with:
- company_name
- email
- password (will be encrypted in export, but you'll have plain text in import log)

**CRITICAL:** Save plain text passwords from import log for customer onboarding emails.

### Step 5: Send Customer Emails

**Email Template:**

```
Subject: You've Been Rewarded! [100] Points Available

Hi [contact_name],

Thank you for your business in 2025! As a valued customer of Northwest Custom Apparel,
you've earned [points] reward points based on your purchases this year.

Your Login Credentials:
- Website: https://www.nwcustomapparel.com/rewards/login
- Email: [email]
- Password: [temporary_password]

You can use your points to get FREE paid samples from our Top Sellers showcase.

Each point = $1 discount
Your [points] points = $[points] in free samples!

Browse samples here: https://www.nwcustomapparel.com/pages/top-sellers-showcase.html

Questions? Contact us at sales@nwcustomapparel.com or 253-922-5793.

Thank you for your continued partnership!

Northwest Custom Apparel Team
```

**Merge Tool:** Use Caspio's built-in email merge or export to CSV and use MailChimp/SendGrid.

---

## 👨‍💼 Admin Management Interface

### Dashboard Overview

**Page:** `rewards-admin-dashboard.html`

**Key Metrics Display:**
- Total customers enrolled
- Total points issued
- Total points redeemed
- Active users this month
- Top redeemers (company name + points used)

**Features Needed:**

1. **Customer List View**
   - Search by company name or email
   - Sort by balance (high to low)
   - Filter by status (Active/Suspended)
   - Click row to view details

2. **Customer Detail Page**
   - Current balance (editable)
   - Transaction history (read-only)
   - Manual adjustment buttons:
     - Add points (with reason field)
     - Subtract points (with reason field)
     - Reset balance (confirmation required)
   - Suspend/Activate account toggle

3. **Transaction Log**
   - Filter by date range
   - Filter by transaction type
   - Export to CSV for accounting
   - Search by order ID

4. **Bulk Operations**
   - Import new customers (CSV upload)
   - Annual point reset (scheduled or manual)
   - Mass email customers about balance
   - Export all data for backup

### Admin API Endpoints

**Check Balance:**
```
GET /api/rewards/admin/balance/:customer_id
Response: {
    customer_id: 1,
    company_name: "Mike's Roofing",
    current_balance: 100,
    total_earned: 150,
    total_redeemed: 50,
    last_transaction: "2025-11-03"
}
```

**Adjust Balance:**
```
POST /api/rewards/admin/adjust
Body: {
    customer_id: 1,
    points_change: 50,  // Positive = add, negative = subtract
    reason: "Promotional bonus",
    admin_note: "Black Friday 2025 promotion"
}
Response: {
    success: true,
    new_balance: 150,
    transaction_id: 42
}
```

**Get Transactions:**
```
GET /api/rewards/admin/transactions/:customer_id?limit=50
Response: [
    {
        transaction_id: 42,
        transaction_type: "Adjusted",
        points_amount: 50,
        balance_after: 150,
        description: "Promotional bonus",
        transaction_date: "2025-11-04T10:30:00"
    },
    ...
]
```

---

## 📅 5-Week Implementation Timeline

### Week 1: Database & Authentication Setup

**Tasks:**
- Create `rewards_customers` table in Caspio
- Create `rewards_transactions` table in Caspio
- Enable Caspio authentication on app
- Create login DataPage
- Create customer dashboard DataPage
- Test authentication flow

**Deliverables:**
- Customers can log in
- Dashboard shows placeholder data
- Logout works correctly

**Estimated Hours:** 20 hours

---

### Week 2: Point Balance & History UI

**Tasks:**
- Build customer dashboard with balance display
- Create transaction history view
- Add point value calculator ($1 per point)
- Style UI to match existing NWCA site
- Test with dummy data

**Deliverables:**
- Dashboard shows current balance
- Transaction history displays correctly
- UI is mobile-responsive

**Estimated Hours:** 20 hours

---

### Week 3: Sample Cart Integration

**Tasks:**
- Modify `sample-cart.html` to check login status
- Add rewards balance UI to cart page
- Implement point redemption checkbox
- Add discount calculation logic
- Test checkout flow with points applied
- Integrate with ShopWorks order submission

**Deliverables:**
- Logged-in customers see point balance in cart
- Points can be applied to reduce total
- Order submits correctly with discount
- Points deducted after successful order

**Estimated Hours:** 25 hours

---

### Week 4: Admin Interface & Data Import

**Tasks:**
- Build admin dashboard with customer list
- Create customer detail page
- Add manual adjustment functionality
- Build transaction log viewer
- Create CSV import tool for bulk customer upload
- Test import with 2025 customer data

**Deliverables:**
- Admin can view all customers
- Admin can adjust balances
- Admin can import CSV of customers
- Credentials generated for new imports

**Estimated Hours:** 25 hours

---

### Week 5: Testing, Documentation & Launch

**Tasks:**
- End-to-end testing with real customer accounts
- Security audit (password strength, session timeout)
- Create customer onboarding email templates
- Write admin user guide
- Import actual customer data
- Send customer invitation emails
- Monitor first week of usage

**Deliverables:**
- System tested and verified
- Customers notified and onboarded
- Admin trained on management interface
- Documentation complete

**Estimated Hours:** 20 hours

---

**Total:** 110 hours over 5 weeks

---

## ❓ 7 Key Questions to Confirm

Before implementation begins, you need to decide:

### 1. Point Value Ratio

**Question:** How many dollars in sales = 1 reward point?

**Options:**
- **$1 = 1 point** (generous, easy math for customers)
- **$10 = 1 point** (moderate, still significant rewards)
- **$100 = 1 point** (conservative, for very high-volume customers)

**Example Impact (Customer with $10,000 sales):**
- $1 ratio → 10,000 points ($10,000 in samples - unrealistic)
- $10 ratio → 1,000 points ($1,000 in samples - very generous)
- **$100 ratio → 100 points ($100 in samples - reasonable)** ← RECOMMENDED

**Recommendation:** Start with $100 sales = 1 point ($1 redemption value)

---

### 2. Point Redemption Value

**Question:** How much is 1 point worth when redeemed?

**Options:**
- **1 point = $1** (simple, easy to communicate)
- 1 point = $0.50 (encourages bulk redemption)
- 1 point = $2 (higher perceived value)

**Recommendation:** 1 point = $1 (simplest for B2B customers to understand)

---

### 3. Point Expiration

**Question:** Do points expire?

**Options:**
- **No expiration** (customer-friendly, simpler)
- Annual expiration (encourages usage, resets each year)
- 12-month rolling (points expire 12 months after earned)

**Recommendation:** Annual expiration with warning email 30 days before

**Example:** Points earned in 2025 expire on December 31, 2026

---

### 4. Minimum Redemption

**Question:** Is there a minimum point amount to redeem?

**Options:**
- **No minimum** (most flexible, better UX)
- 10 points minimum (prevents $1 redemptions)
- 25 points minimum (encourages meaningful redemptions)

**Recommendation:** No minimum (let customers use 1 point if they want)

---

### 5. Earning on Sample Orders

**Question:** Do customers earn points when they buy paid samples?

**Options:**
- **No** (samples are discounted, not full purchases)
- Yes, at reduced rate (e.g., 50% of normal earn rate)
- Yes, same rate as regular orders

**Recommendation:** No points earned on sample orders (prevents circular loop)

---

### 6. Initial Point Assignment

**Question:** Assign points based on what time period?

**Options:**
- **2025 sales only** (clean start)
- 2024 + 2025 combined (rewards long-term customers)
- Last 12 months rolling (most recent activity)

**Recommendation:** 2025 sales only (easier to communicate and calculate)

---

### 7. Customer Access Level

**Question:** Can customers view/edit any settings?

**Options:**
- **View only** (balance + history, no changes)
- Request adjustments (submit form for admin review)
- Self-service (change password, update email)

**Recommendation:** View only + password change (minimize admin overhead)

---

## 💰 Cost & Effort Estimates

### Development Time Breakdown

| Phase | Hours | Hourly Rate | Subtotal |
|-------|-------|-------------|----------|
| Week 1: Database & Auth | 20 | $150 | $3,000 |
| Week 2: Customer UI | 20 | $150 | $3,000 |
| Week 3: Cart Integration | 25 | $150 | $3,750 |
| Week 4: Admin Interface | 25 | $150 | $3,750 |
| Week 5: Testing & Launch | 20 | $150 | $3,000 |
| **Total** | **110 hours** | | **$16,500** |

### Additional Costs

| Item | Cost | Notes |
|------|------|-------|
| Caspio Platform | $0 | (Existing subscription) |
| Email Sending (1000 emails) | $50 | SendGrid or similar |
| SSL Certificate | $0 | (Already have) |
| Project Management | $1,500 | 10 hours × $150 |
| Contingency (15%) | $2,700 | Buffer for unknowns |
| **Total Additional** | **$4,250** | |

### Grand Total

**$16,500 (development) + $4,250 (additional) = $20,750**

**Rounded estimate: $21,000 - $25,000** (depending on complexity and revisions)

---

## 🎯 Expected Results

### Customer Engagement Metrics (6 Months)

**Projected:**
- **60%** of customers will log in within first month
- **40%** will redeem points within first quarter
- **$15,000 - $25,000** in sample orders driven by point redemptions
- **25%** increase in sample order volume

**Measurement:**
- Login analytics (monthly active users)
- Redemption rate (points used / points issued)
- Sample order conversion (quote to production order)
- Customer feedback surveys

### Business Benefits

**Quantifiable:**
- Increase customer retention (track repeat orders)
- Gather data on which customers are most engaged
- Track sample-to-order conversion rates
- Reduce manual discount processing

**Qualitative:**
- Strengthen customer relationships
- Differentiate from competitors
- Professional B2B experience
- Data-driven marketing opportunities

### ROI Timeline

**Break-even scenario ($25,000 investment):**

Assuming:
- 200 customers enrolled
- 40% redeem in Year 1 (80 customers)
- Average redemption: $50 in samples
- 50% convert sample to production order averaging $500

**Calculation:**
- Sample orders driven: 80 × $50 = $4,000
- Production conversions: 40 × $500 = $20,000
- Total new revenue: $24,000

**Break-even: 12-15 months** (conservative estimate)

**Year 2+:** Pure profit driver as development costs are one-time

---

## 🔧 Technical API Specifications

### Customer-Facing Endpoints

**Check Balance**
```
GET /api/rewards/balance
Headers: Authorization: Bearer {session_token}

Response 200:
{
    "customer_id": 1,
    "current_balance": 100,
    "total_earned": 150,
    "total_redeemed": 50,
    "point_value": 1.00,
    "balance_in_dollars": 100.00
}

Response 401: Unauthorized (not logged in)
```

**Get Transaction History**
```
GET /api/rewards/transactions?limit=50&offset=0
Headers: Authorization: Bearer {session_token}

Response 200:
{
    "transactions": [
        {
            "transaction_id": 42,
            "transaction_type": "Redeemed",
            "points_amount": -50,
            "balance_after": 100,
            "order_id": "SAMPLE-110425-1",
            "description": "Redeemed for 5 samples",
            "transaction_date": "2025-11-04T10:30:00Z"
        },
        {
            "transaction_id": 41,
            "transaction_type": "Earned",
            "points_amount": 150,
            "balance_after": 150,
            "description": "Initial 2025 sales bonus",
            "transaction_date": "2025-11-01T00:00:00Z"
        }
    ],
    "total_count": 2,
    "limit": 50,
    "offset": 0
}
```

**Redeem Points**
```
POST /api/rewards/redeem
Headers: Authorization: Bearer {session_token}
Body:
{
    "points": 50,
    "order_id": "SAMPLE-110425-1",
    "description": "Redeemed for 5 samples"
}

Response 200:
{
    "success": true,
    "transaction_id": 43,
    "points_redeemed": 50,
    "new_balance": 50,
    "discount_applied": 50.00
}

Response 400: Insufficient balance
{
    "success": false,
    "error": "Insufficient points",
    "current_balance": 30,
    "requested": 50
}
```

### Admin Endpoints

**List All Customers**
```
GET /api/rewards/admin/customers?status=Active&sort=balance_desc&limit=100
Headers: Authorization: Bearer {admin_token}

Response 200:
{
    "customers": [
        {
            "customer_id": 1,
            "company_name": "Mike's Roofing",
            "email": "mike@mikesroofing.com",
            "current_balance": 100,
            "status": "Active",
            "last_login": "2025-11-03T14:22:00Z"
        },
        ...
    ],
    "total_count": 250,
    "limit": 100
}
```

**Manual Adjustment**
```
POST /api/rewards/admin/adjust
Headers: Authorization: Bearer {admin_token}
Body:
{
    "customer_id": 1,
    "points_change": 50,
    "reason": "Black Friday promotion",
    "admin_note": "Sent promotional email on 11/24"
}

Response 200:
{
    "success": true,
    "transaction_id": 44,
    "customer_id": 1,
    "old_balance": 100,
    "new_balance": 150,
    "points_changed": 50
}
```

**Bulk Import**
```
POST /api/rewards/admin/import
Headers: Authorization: Bearer {admin_token}
Content-Type: multipart/form-data
Body: CSV file

Response 200:
{
    "success": true,
    "imported": 150,
    "failed": 2,
    "errors": [
        {"row": 45, "error": "Duplicate email"},
        {"row": 78, "error": "Invalid sales amount"}
    ],
    "credentials": [
        {"email": "new@customer.com", "password": "TempPass123!"},
        ...
    ]
}
```

---

## 🔒 Security Considerations

### Password Security

**Caspio Handles:**
- Bcrypt-level encryption (industry standard)
- Salt generation per password
- No plain text storage
- Secure password comparison

**You Should Enforce:**
- Minimum 8 characters
- At least 1 number
- At least 1 special character
- Password change on first login (optional)

### Session Management

**Caspio Provides:**
- Secure session cookies (HttpOnly, Secure flags)
- Configurable timeout (recommend 30 minutes)
- Automatic logout on close (optional)
- Cross-site request forgery (CSRF) protection

**Best Practices:**
- Set timeout to 30 minutes for B2B (balance security vs convenience)
- Require re-login for sensitive actions (balance adjustments)
- Log all admin actions with user ID and timestamp

### API Security

**Authentication Required:**
- All customer endpoints require valid session token
- All admin endpoints require admin-level session token
- No anonymous access to point balances or transactions

**Rate Limiting:**
- Max 100 requests per minute per customer
- Max 1000 requests per minute for admin
- Block IP after 5 failed login attempts (10-minute cooldown)

### Data Privacy

**PII Protection:**
- Customer passwords: Encrypted at rest
- Email addresses: Indexed but not public
- Transaction history: Only accessible by customer and admin
- Sales data: Visible to customer (their own only)

**Compliance:**
- GDPR: Allow customers to request data deletion
- CCPA: Provide data export on request
- Audit trail: Log all data access and modifications

### Backup & Recovery

**Automated Backups:**
- Caspio auto-backups daily (included in platform)
- Export customer list weekly to CSV (stored securely)
- Transaction log archived monthly

**Disaster Recovery:**
- Point balances can be recalculated from transaction log
- Customer credentials can be reset via email
- Order IDs link to ShopWorks for reconciliation

---

## ✅ Testing Checklist

### Pre-Launch Testing

**Authentication:**
- [ ] Customer can create account (if allowing self-registration)
- [ ] Customer can log in with correct credentials
- [ ] Customer CANNOT log in with wrong password
- [ ] Account locks after 5 failed attempts
- [ ] Session expires after 30 minutes of inactivity
- [ ] Logout works and clears session
- [ ] Password reset email sends and works

**Customer Dashboard:**
- [ ] Balance displays correctly
- [ ] Transaction history shows all transactions
- [ ] Pagination works for long transaction lists
- [ ] Filtering by date range works
- [ ] Mobile responsive on phone and tablet

**Sample Cart Integration:**
- [ ] Logged-in customer sees point balance
- [ ] Guest customer does NOT see rewards section
- [ ] Point redemption checkbox appears
- [ ] Discount calculates correctly (points × $1)
- [ ] Cannot redeem more points than balance
- [ ] Cannot reduce total below $0
- [ ] Order submits successfully with points applied
- [ ] Points deducted from balance after order
- [ ] Transaction logged with correct order ID

**Admin Dashboard:**
- [ ] Admin can view all customers
- [ ] Search by company name works
- [ ] Sort by balance works
- [ ] Filter by status works
- [ ] Customer detail page loads
- [ ] Manual adjustment adds points correctly
- [ ] Manual adjustment subtracts points correctly
- [ ] Transaction log shows all changes
- [ ] CSV export works
- [ ] Bulk import works with valid CSV
- [ ] Bulk import rejects invalid data
- [ ] Generated passwords are secure

**Edge Cases:**
- [ ] Customer with 0 points cannot redeem
- [ ] Customer cannot redeem negative points
- [ ] Order submission failure does NOT deduct points
- [ ] Duplicate email addresses rejected on import
- [ ] Invalid sales amounts rejected on import
- [ ] Session timeout redirects to login page
- [ ] Admin cannot adjust balance to negative

### Post-Launch Monitoring

**Week 1:**
- Monitor login success rate
- Check for authentication errors
- Verify point deductions are accurate
- Track customer support tickets
- Review transaction logs for anomalies

**Month 1:**
- Measure active user percentage
- Track redemption rate
- Identify most engaged customers
- Gather customer feedback
- Analyze sample-to-order conversion

**Quarterly:**
- Review total points issued vs redeemed
- Audit admin adjustment activity
- Check for dormant accounts
- Plan annual point reset (if applicable)
- Evaluate ROI and adjust program rules

---

## 📞 Support & Training

### Customer Support FAQs

**Q: I forgot my password. How do I reset it?**
A: Click "Forgot Password" on login page, enter your email, and you'll receive reset link.

**Q: How long do my points last?**
A: [Based on your decision from Question #3] Points expire on December 31, 2026.

**Q: Can I transfer points to another company?**
A: No, points are non-transferable and tied to your company account.

**Q: What happens if I return an order I used points on?**
A: Points will be refunded to your balance within 5 business days.

**Q: How do I check my point balance?**
A: Log in to your rewards dashboard at [URL] to see current balance and history.

### Admin Training Topics

**Session 1: Customer Management (1 hour)**
- Viewing customer list
- Searching and filtering
- Viewing customer details
- Understanding transaction types

**Session 2: Balance Adjustments (1 hour)**
- When to manually adjust points
- Adding promotional bonuses
- Correcting errors
- Best practices for admin notes

**Session 3: Data Import & Export (1 hour)**
- Preparing CSV files
- Running bulk imports
- Exporting data for reporting
- Troubleshooting import errors

**Session 4: Reporting & Analytics (1 hour)**
- Key metrics to track
- Exporting transaction logs
- Identifying top redeemers
- Measuring program ROI

---

## 🚀 Launch Checklist

**30 Days Before Launch:**
- [ ] Finalize answers to 7 key questions
- [ ] Approve development timeline
- [ ] Allocate budget ($21k-$25k)
- [ ] Assign project manager

**14 Days Before Launch:**
- [ ] Complete development (Weeks 1-4)
- [ ] Conduct internal testing
- [ ] Prepare customer data CSV
- [ ] Write onboarding email template
- [ ] Create admin training schedule

**7 Days Before Launch:**
- [ ] Import customer data to Caspio
- [ ] Generate and save credentials
- [ ] Final security audit
- [ ] Load testing (simulate 100 concurrent logins)
- [ ] Mobile device testing (iOS/Android)

**Launch Day:**
- [ ] Send customer invitation emails (staggered batches)
- [ ] Monitor login traffic
- [ ] Have support team standing by
- [ ] Track early redemptions
- [ ] Respond to customer questions within 2 hours

**Week 1 Post-Launch:**
- [ ] Review analytics daily
- [ ] Address any bugs immediately
- [ ] Send reminder email to non-adopters
- [ ] Gather customer feedback
- [ ] Adjust messaging if needed

---

## 📄 Appendix: Sample Documents

### Sample Customer Invitation Email

```
Subject: 🎁 You've Earned Rewards! Log In to Claim Your Points

Hi [CONTACT_NAME],

Great news! As a valued customer of Northwest Custom Apparel, you've earned
**[POINTS] reward points** based on your 2025 purchases.

Your Points: [POINTS] = $[POINTS] value
Your 2025 Sales: $[SALES_2025]

LOG IN TO START REDEEMING:
Website: https://www.nwcustomapparel.com/rewards/login
Email: [EMAIL]
Temporary Password: [PASSWORD]

(Please change your password after first login)

WHAT YOU CAN DO:
✓ Browse our Top Sellers Showcase
✓ Request FREE paid samples using your points
✓ Track your point balance and history
✓ Discover new products to offer your customers

GETTING STARTED:
1. Click the login link above
2. Enter your email and temporary password
3. Browse samples at: https://www.nwcustomapparel.com/pages/top-sellers-showcase.html
4. Add samples to cart and apply your points at checkout

Points expire December 31, 2026 - don't miss out!

Questions? Reply to this email or call us at 253-922-5793.

Thank you for your partnership!

Northwest Custom Apparel Team
www.nwcustomapparel.com
253-922-5793
```

### Sample CSV Import Template

```csv
company_name,contact_name,email,sales_2025,initial_points,status
"Mike's Roofing","Mike Johnson","mike@mikesroofing.com",10000.00,100,Active
"ABC Construction","Sarah Lee","sarah@abcconstruction.com",25000.00,250,Active
"Northwest Souvenirs","Tom Smith","tom@nwsouvenirs.com",5000.00,50,Active
"City Sports Leagues","Jennifer Brown","jen@citysports.com",15000.00,150,Active
```

**Column Definitions:**
- `company_name`: Official company name (required)
- `contact_name`: Primary contact person (required)
- `email`: Login email, must be unique (required)
- `sales_2025`: Total 2025 purchases in dollars (required)
- `initial_points`: Calculated points (required)
- `status`: Active or Suspended (default: Active)

---

## 📚 Related Documentation

**Internal Documentation:**
- `memory/SAMPLE_CART_PRICING.md` - Current sample cart pricing logic
- `memory/CASPIO_API_CORE.md` - Caspio database patterns and API reference
- `memory/MANAGEORDERS_INTEGRATION.md` - ShopWorks integration details
- `pages/sample-cart.html` - Current sample cart implementation

**External Resources:**
- Caspio Authentication Guide: [https://howto.caspio.com/authentication/](https://howto.caspio.com/authentication/)
- Caspio Password Encryption: [https://howto.caspio.com/tables-and-views/data-types/password-field/](https://howto.caspio.com/tables-and-views/data-types/password-field/)
- B2B Loyalty Best Practices: [Search for current articles on B2B rewards programs]

---

**Document Version:** 1.0
**Created:** 2025-11-04
**Last Updated:** 2025-11-04
**Author:** Claude (AI Assistant)
**Approved By:** [Pending Review]

---

## 🎯 Next Steps

1. **Review this document** with your team
2. **Answer the 7 key questions** (Page 18-20)
3. **Approve budget and timeline** ($21k-$25k, 5 weeks)
4. **Provide 2025 customer sales data** (CSV format)
5. **Schedule kickoff meeting** to begin Week 1

**Questions?** Contact Erik Mickelson or reply to the documentation request.
