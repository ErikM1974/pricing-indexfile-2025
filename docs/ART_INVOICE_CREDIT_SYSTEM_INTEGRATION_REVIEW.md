# Art Invoice Credit System Integration Review

## Current State Analysis (Post-Phase 5)

### Completed Refactoring
- ✅ CSS successfully extracted to `css/art-invoice-dashboard.css` (1,197 lines)
- ✅ Professional Blue/Gray theme maintained
- ✅ All dashboard functionality preserved
- ✅ Unified dashboard (`art-invoice-unified-dashboard.html`) working properly

### Existing Credit System Infrastructure

#### 1. Database Fields Already Present
In `art-invoice-service-v2.js` (lines 483-486):
```javascript
// Spec Art Credit System - NEW FIELDS
IsSpecArtwork: invoiceData.isSpecArtwork || false,
CreditApplied: invoiceData.creditApplied || 0,
SpecArtPurpose: invoiceData.specArtPurpose || '',
```

#### 2. UI Elements Already Implemented
In `art-invoice-creator.js`:
- Line 719: `handleSpecArtworkToggle()` - Shows/hides spec art section
- Line 769: `updateCreditInfo()` - Currently shows placeholder text
- Lines 904-907: Spec art data included in invoice submission

#### 3. Current Placeholder Implementation
```javascript
// Line 771-776 in art-invoice-creator.js
creditInfo.textContent = `Sales rep: ${salesRepName} (Credit tracking coming soon)`;
```

## Integration Points for Credit System

### 1. API Service Layer Updates Needed

Add to `art-invoice-service-v2.js`:

```javascript
// After line 1124, add new credit system methods:

// Get sales rep credit information
async getSalesRepCredits(email) {
    try {
        const response = await fetch(`${this.baseURL}/api/sales-rep-credits/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch credits: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('[ArtInvoiceServiceV2] Error fetching sales rep credits:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

// Deduct credit from sales rep balance
async deductSalesRepCredit(deductionData) {
    try {
        const response = await fetch(`${this.baseURL}/api/sales-rep-credits/deduct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deductionData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to deduct credit: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('[ArtInvoiceServiceV2] Error deducting sales rep credit:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}
```

### 2. Update Credit Info Display

Replace the placeholder `updateCreditInfo()` function in `art-invoice-creator.js` (line 769):

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
            
            // Display credit information with visual indicators
            creditInfo.innerHTML = `
                <div class="credit-info-display">
                    <strong>${salesRepName}</strong><br>
                    Available Credit: <span class="credit-balance ${currentBalance < 50 ? 'low-balance' : ''}">${formatCurrency(currentBalance)}</span> 
                    of ${formatCurrency(monthlyCredit)} monthly
                    ${currentBalance < 50 ? '<br><small class="text-warning">⚠️ Low balance - request more credits if needed</small>' : ''}
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

### 3. Update Form Submission Handler

Modify the `handleSubmit()` function in `art-invoice-creator.js` (around line 797) to include credit validation:

```javascript
// Add this before the invoice creation (around line 920)
if (invoiceData.isSpecArtwork && invoiceData.creditApplied > 0) {
    // Check credit availability first
    const creditCheck = await invoiceService.getSalesRepCredits(salesRepEmail);
    
    if (!creditCheck.success || !creditCheck.data) {
        showAlert('Unable to verify credit balance. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
    }
    
    if (creditCheck.data.currentBalance < invoiceData.creditApplied) {
        showAlert(`Insufficient credits. Available: ${formatCurrency(creditCheck.data.currentBalance)}`, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
    }
}

// Add this after successful invoice creation (around line 965)
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

### 4. Add CSS Styles

Add to `css/art-invoice-dashboard.css`:

```css
/* Credit System Styles */
.credit-info-display {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.875rem;
    line-height: 1.5;
    border: 1px solid #e5e7eb;
}

.credit-balance {
    font-weight: bold;
    color: #28a745;
    font-size: 1rem;
}

.credit-balance.low-balance {
    color: #dc3545;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
}

.credit-info-error {
    padding: 0.75rem;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    color: #856404;
    font-size: 0.875rem;
}

.text-warning {
    color: #f39c12;
    font-weight: 500;
}
```

### 5. Dashboard Integration

Add credit balance display to `art-invoice-unified-dashboard.html`:

```javascript
// Add after line 1282 in getSalesRepName function
async function getSalesRepCreditBalance(email) {
    try {
        const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sales-rep-credits/${encodeURIComponent(email)}`);
        if (response.ok) {
            const result = await response.json();
            return result.data;
        }
    } catch (error) {
        console.error('Error fetching credit balance:', error);
    }
    return null;
}

// Add credit display in the dashboard table for sales reps
// This could be shown as a badge next to their name or in a separate column
```

## Implementation Timeline

### Phase 1: Backend Setup (Day 1-2)
- [x] Create Caspio table structure (as defined in SALES_REP_CREDIT_SYSTEM_PLAN.md)
- [ ] Implement API endpoints in the proxy server
- [ ] Test API functionality

### Phase 2: Frontend Integration (Day 3-4)
- [ ] Update art-invoice-service-v2.js with credit methods
- [ ] Replace placeholder updateCreditInfo() function
- [ ] Add credit validation to form submission
- [ ] Update CSS with credit system styles

### Phase 3: Dashboard Enhancement (Day 5)
- [ ] Add credit balance display to unified dashboard
- [ ] Create admin view for credit management
- [ ] Add monthly reset functionality

### Phase 4: Testing & Deployment (Day 6-7)
- [ ] Test end-to-end credit flow
- [ ] Test edge cases (insufficient credits, etc.)
- [ ] Deploy to production

## Benefits of Current Architecture

1. **Minimal Changes Required**: The existing code already has placeholders for the credit system
2. **Clean Separation**: Phase 5 CSS extraction makes it easy to add new styles
3. **API-Ready**: The service layer pattern makes adding new endpoints straightforward
4. **UI Framework**: Existing modal and alert systems can be reused for credit notifications

## Next Steps

1. **Immediate**: Create the Caspio table as specified
2. **Priority**: Implement the API endpoints in the proxy server
3. **Quick Win**: Update the updateCreditInfo() function to show real balances
4. **Testing**: Create test accounts with different credit balances

## Conclusion

The Phase 5 refactoring has created a clean, maintainable codebase that's perfectly positioned for the credit system integration. The existing placeholder code shows that this feature was anticipated, making the implementation straightforward and low-risk.

---

*Document created: July 3, 2025*  
*Review of Phase 5 completion and Credit System integration readiness*