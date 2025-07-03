# Sales Rep Credit System Implementation Plan

## Overview
This document outlines the implementation plan for a credit tracking system for sales representatives at Northwest Custom Apparel. The system will track and manage monthly art credit allocations for spec artwork, prospecting artwork, and complimentary artwork for valued customers.

## Business Requirements
- Each sales rep receives a monthly credit allocation (default: $150.00)
- Credits are used when creating spec art invoices
- Real-time balance tracking and display
- Automatic deduction when spec art is invoiced
- Ability to request additional credits when needed
- Historical tracking of credit usage

## System Architecture

### Data Layer: Caspio Table

**Table Name:** `Sales_Rep_Credits`

| Field Name | Data Type | Properties | Description |
|------------|-----------|------------|-------------|
| `PK_ID` | Autonumber | Primary Key, Required | Unique identifier for each record |
| `SalesRepEmail` | Text (255) | Required, Unique | Email address of the sales rep (e.g., "nika@nwcustomapparel.com") |
| `SalesRepName` | Text (255) | Required | Full name of the sales rep |
| `MonthlyCredit` | Currency | Required, Default: 150.00 | Monthly credit allocation amount |
| `CurrentBalance` | Currency | Required | Current available credit balance |
| `LastResetDate` | Date/Time | Required | Date when credits were last reset |
| `TotalUsedThisMonth` | Currency | Default: 0.00 | Total credits used in current month |
| `IsActive` | Yes/No | Default: Yes | Whether the sales rep is active |
| `CreatedDate` | Date/Time | Auto-timestamp | When the record was created |
| `LastModified` | Date/Time | Auto-timestamp | When the record was last updated |

### API Layer: New Endpoints

#### 1. Get Sales Rep Credits
**Endpoint:** `GET /api/sales-rep-credits/{email}`

**Purpose:** Retrieve current credit balance and details for a specific sales rep

**Request:**
```
GET https://caspio-pricing-proxy.herokuapp.com/api/sales-rep-credits/nika@nwcustomapparel.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "salesRepEmail": "nika@nwcustomapparel.com",
    "salesRepName": "Nika Lao",
    "monthlyCredit": 150.00,
    "currentBalance": 125.00,
    "totalUsedThisMonth": 25.00,
    "lastResetDate": "2025-07-01T00:00:00Z",
    "isActive": true
  }
}
```

#### 2. Deduct Sales Rep Credit
**Endpoint:** `POST /api/sales-rep-credits/deduct`

**Purpose:** Deduct credit amount when spec art invoice is created

**Request Body:**
```json
{
  "salesRepEmail": "nika@nwcustomapparel.com",
  "deductAmount": 25.00,
  "invoiceId": "ART-52503",
  "description": "Spec artwork for new customer mockup"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previousBalance": 125.00,
    "deductedAmount": 25.00,
    "newBalance": 100.00,
    "transactionId": "TXN-2025-07-03-001"
  }
}
```

#### 3. Reset Monthly Credits
**Endpoint:** `POST /api/sales-rep-credits/reset`

**Purpose:** Reset all sales rep credits at the beginning of each month (admin only)

**Request Body:**
```json
{
  "resetAll": true,
  "adminKey": "secure-admin-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "repsReset": 5,
    "resetDate": "2025-08-01T00:00:00Z"
  }
}
```

### Service Layer Updates

#### ArtInvoiceServiceV2 Class Extensions

```javascript
// New methods to add to ArtInvoiceServiceV2 class

/**
 * Get sales rep credit information
 * @param {string} email - Sales rep email
 * @returns {Promise<Object>} Credit information
 */
async getSalesRepCredits(email) {
    try {
        const response = await fetch(`${this.baseUrl}/sales-rep-credits/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: this.headers
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch credits: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching sales rep credits:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Deduct credit from sales rep balance
 * @param {Object} deductionData - Deduction details
 * @returns {Promise<Object>} Transaction result
 */
async deductSalesRepCredit(deductionData) {
    try {
        const response = await fetch(`${this.baseUrl}/sales-rep-credits/deduct`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(deductionData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to deduct credit: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error deducting sales rep credit:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}
```

### Frontend Implementation

#### 1. Update art-invoice-creator.js

**Modified updateCreditInfo() function:**
```javascript
async function updateCreditInfo() {
    const creditInfo = document.getElementById('creditInfo');
    const creditAmount = document.getElementById('creditAmount');
    const salesRepEmail = selectedRequest?.User_Email || ART_INVOICE_CONFIG.COMPANY.EMAIL;
    
    // Show loading state
    creditInfo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading credit balance...';
    
    try {
        // Fetch current credit balance
        const creditResult = await invoiceService.getSalesRepCredits(salesRepEmail);
        
        if (creditResult.success && creditResult.data) {
            const { salesRepName, currentBalance, monthlyCredit } = creditResult.data;
            
            // Display credit information
            creditInfo.innerHTML = `
                <div class="credit-info-display">
                    <strong>${salesRepName}</strong><br>
                    Available Credit: <span class="credit-balance ${currentBalance < 50 ? 'low-balance' : ''}">${formatCurrency(currentBalance)}</span> 
                    of ${formatCurrency(monthlyCredit)} monthly
                </div>
            `;
            
            // Update max credit amount based on balance
            creditAmount.max = currentBalance;
            
            // If current value exceeds balance, adjust it
            if (parseFloat(creditAmount.value) > currentBalance) {
                creditAmount.value = currentBalance.toFixed(2);
            }
            
        } else {
            // Sales rep not found or error
            creditInfo.innerHTML = `
                <div class="credit-info-error">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Unable to load credit balance. Contact administrator.
                </div>
            `;
        }
    } catch (error) {
        console.error('Error updating credit info:', error);
        creditInfo.innerHTML = `
            <div class="credit-info-error">
                <i class="fas fa-exclamation-triangle"></i> 
                Error loading credit balance
            </div>
        `;
    }
}
```

**Modified handleSubmit() function (relevant section):**
```javascript
// Inside handleSubmit function, after invoice data preparation
if (invoiceData.isSpecArtwork && invoiceData.creditApplied > 0) {
    // Check credit availability first
    const creditCheck = await invoiceService.getSalesRepCredits(salesRepEmail);
    
    if (!creditCheck.success || !creditCheck.data) {
        showAlert('Unable to verify credit balance. Please try again.', 'error');
        return;
    }
    
    if (creditCheck.data.currentBalance < invoiceData.creditApplied) {
        showAlert(`Insufficient credits. Available: ${formatCurrency(creditCheck.data.currentBalance)}`, 'error');
        return;
    }
}

// After successful invoice creation/update
if (result.success && invoiceData.isSpecArtwork && invoiceData.creditApplied > 0) {
    // Deduct the credit
    const deductionData = {
        salesRepEmail: salesRepEmail,
        deductAmount: invoiceData.creditApplied,
        invoiceId: result.invoiceID || editInvoiceData.invoice.InvoiceID,
        description: invoiceData.specArtPurpose || 'Spec artwork'
    };
    
    const deductResult = await invoiceService.deductSalesRepCredit(deductionData);
    
    if (deductResult.success) {
        showAlert(
            `Invoice ${result.invoiceID} created successfully! ` +
            `Credit balance updated: ${formatCurrency(deductResult.data.newBalance)}`,
            'success'
        );
    } else {
        showAlert(
            `Invoice created but credit deduction failed. Please contact administrator.`,
            'warning'
        );
    }
}
```

#### 2. Add CSS Styles

```css
/* Add to existing CSS file */
.credit-info-display {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.875rem;
    line-height: 1.5;
}

.credit-balance {
    font-weight: bold;
    color: #28a745;
}

.credit-balance.low-balance {
    color: #dc3545;
}

.credit-info-error {
    padding: 0.75rem;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    color: #856404;
    font-size: 0.875rem;
}
```

### Additional Features

#### 1. Credit Transaction History Table (Optional)

**Table Name:** `Sales_Rep_Credit_Transactions`

| Field Name | Data Type | Description |
|------------|-----------|-------------|
| `TransactionID` | Autonumber | Primary Key |
| `SalesRepEmail` | Text (255) | Foreign key to Sales_Rep_Credits |
| `TransactionType` | Text (50) | "DEBIT", "CREDIT", "RESET" |
| `Amount` | Currency | Transaction amount |
| `BalanceBefore` | Currency | Balance before transaction |
| `BalanceAfter` | Currency | Balance after transaction |
| `InvoiceID` | Text (50) | Related invoice ID (if applicable) |
| `Description` | Text (500) | Transaction description |
| `CreatedDate` | Date/Time | Transaction timestamp |
| `CreatedBy` | Text (255) | Who initiated the transaction |

#### 2. Admin Dashboard Features

- View all sales rep credit balances
- Manually adjust credits
- View transaction history
- Set custom monthly credit amounts per rep
- Generate usage reports

### Implementation Timeline

1. **Phase 1 - Database Setup (Day 1)**
   - Create Caspio tables
   - Set up initial sales rep records
   - Configure table permissions

2. **Phase 2 - API Development (Days 2-3)**
   - Implement new API endpoints
   - Test API functionality
   - Deploy to Heroku proxy

3. **Phase 3 - Frontend Integration (Days 4-5)**
   - Update ArtInvoiceServiceV2
   - Modify art-invoice-creator.js
   - Add UI feedback and error handling
   - Test end-to-end functionality

4. **Phase 4 - Admin Tools (Days 6-7)**
   - Create admin dashboard
   - Implement monthly reset functionality
   - Add reporting features

5. **Phase 5 - Testing & Deployment (Day 8)**
   - User acceptance testing
   - Bug fixes
   - Production deployment

### Security Considerations

1. **API Authentication**: Ensure all API calls are authenticated
2. **Input Validation**: Validate credit amounts before deduction
3. **Audit Trail**: Log all credit transactions
4. **Access Control**: Only authorized users can view/modify credits
5. **Data Integrity**: Prevent negative balances

### Future Enhancements

1. **Automatic Monthly Reset**: Scheduled job to reset credits
2. **Email Notifications**: Alert reps when credits are low
3. **Credit Request Workflow**: In-app credit request system
4. **Analytics Dashboard**: Usage trends and insights
5. **Mobile App Integration**: View credits on mobile devices

### Testing Checklist

- [ ] Sales rep can view their current credit balance
- [ ] Credit balance updates in real-time
- [ ] Credits are deducted correctly when spec art is created
- [ ] Insufficient credit prevents invoice creation
- [ ] Credit history is tracked accurately
- [ ] Admin can adjust credits manually
- [ ] Monthly reset works correctly
- [ ] Error handling for API failures
- [ ] UI displays appropriate feedback messages
- [ ] Performance under load

### Notes

- Default monthly credit: $150.00 per sales rep
- Credits do not roll over to the next month
- Negative balances are not allowed
- All amounts are in USD
- System tracks both current balance and total usage

---

*Document created: July 3, 2025*  
*Author: Northwest Custom Apparel Development Team*