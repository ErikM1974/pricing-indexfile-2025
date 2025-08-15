# Quote Workflow Guide - Complete Lifecycle

## Overview

This guide covers the complete quote lifecycle from user input to database storage, email delivery, and quote management. Based on the successful Customer Supplied Embroidery Calculator implementation.

## Quote Lifecycle Stages

### 1. Quote Generation
```javascript
// Generate unique quote ID with date-based sequence
generateQuoteID() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateKey = `${month}${day}`;
    
    // Daily sequence reset pattern
    const storageKey = `${calculatorPrefix}_quote_sequence_${dateKey}`;
    let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
    sessionStorage.setItem(storageKey, sequence.toString());
    
    // Clean up old sequences
    this.cleanupOldSequences(dateKey);
    
    // Return formatted quote ID
    return `${prefix}${dateKey}-${sequence}`;
}
```

### 2. Quote ID Prefixes

| Calculator Type | Base Prefix | Add-on Prefix | Program Prefix |
|----------------|-------------|---------------|----------------|
| DTG | DTG | DTG-AO | DTG-PA |
| Richardson Caps | RCH | RCH-AO | RCH-PA |
| Embroidery | EMB | EMB-AO | EMB-PA |
| Customer Embroidery | EMBC | EMBC-AO | EMBC-PA |
| Laser Tumbler | LT | LT-AO | LT-PA |
| ShopWorks | SW | SW-AO | SW-PA |

### 3. Data Collection

```javascript
// Collect quote data from form
const quoteData = {
    // Customer Information
    customerName: this.customerName.value.trim(),
    customerEmail: this.customerEmail.value.trim(),
    customerPhone: this.customerPhone.value.trim(),
    companyName: this.companyName.value.trim(),
    
    // Order Details
    quantity: parseInt(this.quantity.value),
    projectName: this.projectName.value.trim(),
    notes: this.notes.value.trim(),
    
    // Pricing Information
    basePrice: calculatedPrice,
    discountPercent: discount,
    priceAfterDiscount: discountedPrice,
    ltmFeeTotal: ltmTotal,
    totalCost: finalTotal,
    
    // Order Type Flags
    isAddon: this.addonCheckbox.checked,
    isProgramAccount: this.programCheckbox.checked,
    
    // Sales Rep
    salesRepEmail: this.salesRep.value,
    salesRepName: this.getSalesRepName(this.salesRep.value)
};
```

### 4. Database Integration

#### Quote Sessions Table
```javascript
const sessionData = {
    QuoteID: quoteID,
    SessionID: generateSessionID(),
    CustomerEmail: quoteData.customerEmail,
    CustomerName: quoteData.customerName || 'Guest',
    CompanyName: quoteData.companyName || 'Not Provided',
    Phone: quoteData.customerPhone || '',
    TotalQuantity: parseInt(quoteData.quantity),
    SubtotalAmount: parseFloat(subtotal.toFixed(2)),
    LTMFeeTotal: parseFloat(ltmTotal.toFixed(2)),
    TotalAmount: parseFloat(total.toFixed(2)),
    Status: 'Open',
    ExpiresAt: formattedExpiresAt,
    Notes: quoteData.notes || ''  // Simple string, not JSON
};
```

#### Quote Items Table
```javascript
const itemData = {
    QuoteID: quoteID,
    LineNumber: 1,
    StyleNumber: 'PRODUCT-CODE',
    ProductName: buildProductName(quoteData),
    Color: colorInfo || 'As Specified',
    ColorCode: colorCode || '',
    EmbellishmentType: 'embroidery', // or 'dtg', 'laser', etc.
    PrintLocation: locationDescription,
    PrintLocationName: locationName,
    Quantity: parseInt(quantity),
    HasLTM: ltmTotal > 0 ? 'Yes' : 'No',
    BaseUnitPrice: parseFloat(basePrice.toFixed(2)),
    LTMPerUnit: parseFloat(ltmPerUnit.toFixed(2)),
    FinalUnitPrice: parseFloat(finalPrice.toFixed(2)),
    LineTotal: parseFloat(lineTotal.toFixed(2)),
    SizeBreakdown: '{}', // Empty object string for compatibility
    PricingTier: getPricingTier(quantity),
    ImageURL: imageUrl || '',
    AddedAt: new Date().toISOString().replace(/\.\\d{3}Z$/, '')
};
```

### 5. Email Workflow

```javascript
async handleQuoteSubmit(e) {
    e.preventDefault();
    
    try {
        // 1. Validate form
        if (!this.validateForm()) return;
        
        // 2. Show loading state
        this.showLoading();
        
        // 3. Generate quote ID
        const quoteId = this.quoteService.generateQuoteID();
        
        // 4. Build quote data
        const quoteData = this.buildQuoteData();
        quoteData.quoteId = quoteId;
        
        // 5. Save to database (optional)
        if (this.saveToDatabase.checked) {
            const saveResult = await this.quoteService.saveQuote(quoteData);
            if (!saveResult.success) {
                console.error('Database save failed:', saveResult.error);
                // Continue with email - don't block customer
            }
        }
        
        // 6. Build email data
        const emailData = this.buildEmailData(quoteData);
        
        // 7. Send email
        await emailjs.send(
            this.emailConfig.serviceId,
            this.emailConfig.templateId,
            emailData
        );
        
        // 8. Show success modal with quote ID
        this.showSuccessModal(quoteId, quoteData);
        
        // 9. Reset form
        this.resetForm();
        
    } catch (error) {
        console.error('Quote submission error:', error);
        this.showError('Failed to submit quote. Please try again.');
    } finally {
        this.hideLoading();
    }
}
```

### 6. Success Modal Pattern

```javascript
showSuccessModal(quoteId, quoteData) {
    // Update modal content
    document.getElementById('modalQuoteId').textContent = quoteId;
    document.getElementById('modalCustomerName').textContent = quoteData.customerName;
    document.getElementById('modalTotalAmount').textContent = `$${quoteData.totalCost.toFixed(2)}`;
    
    // Store data for print/email functions
    this.lastQuoteData = quoteData;
    this.lastQuoteData.quoteId = quoteId;
    
    // Show modal
    document.getElementById('successModal').classList.add('active');
}
```

### 7. Print Functionality

```javascript
printQuote() {
    if (!this.lastQuoteData) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote ${this.lastQuoteData.quoteId}</title>
            <style>
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                /* Print-optimized styles */
            </style>
        </head>
        <body>
            ${this.generatePrintHTML(this.lastQuoteData)}
            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            </script>
        </body>
        </html>
    `);
}
```

## Error Handling Best Practices

### 1. Database Errors
```javascript
// Don't block email if database fails
if (!saveResult.success) {
    console.error('Database error:', saveResult.error);
    // Log error but continue with email
    // Customer experience is priority
}
```

### 2. Email Errors
```javascript
try {
    await emailjs.send(...);
} catch (error) {
    // Log full error for debugging
    console.error('EmailJS Error:', error);
    
    // Show user-friendly message
    if (error.text?.includes('corrupted')) {
        this.showError('Email template error. Please contact support.');
    } else {
        this.showError('Failed to send quote. Please try again.');
    }
}
```

### 3. Validation Errors
```javascript
validateForm() {
    const errors = [];
    
    if (!this.customerName.value.trim()) {
        errors.push('Customer name is required');
    }
    
    if (!this.validateEmail(this.customerEmail.value)) {
        errors.push('Valid email is required');
    }
    
    if (this.quantity.value < 1) {
        errors.push('Quantity must be at least 1');
    }
    
    if (errors.length > 0) {
        this.showError(errors.join('<br>'));
        return false;
    }
    
    return true;
}
```

## Testing Checklist

### Form Validation
- [ ] All required fields enforced
- [ ] Email validation working
- [ ] Quantity constraints applied
- [ ] Phone number formatting

### Quote Generation
- [ ] Quote ID unique and sequential
- [ ] Daily sequence reset working
- [ ] Prefix variations (AO/PA) correct
- [ ] Quote data complete

### Database Integration
- [ ] Session created successfully
- [ ] Item added with correct data
- [ ] Error handling doesn't block flow
- [ ] Data types match schema

### Email Delivery
- [ ] All variables populated
- [ ] HTML content rendering
- [ ] Sales rep routing correct
- [ ] CC/BCC working

### Success Flow
- [ ] Modal displays quote ID
- [ ] Copy button works
- [ ] Print generates clean PDF
- [ ] Form resets properly

### Error Scenarios
- [ ] Database offline handling
- [ ] Email service errors
- [ ] Network timeout handling
- [ ] User feedback clear

## Common Issues & Solutions

### Issue: Quote ID not unique
**Solution**: Use sessionStorage with date-based keys for daily reset

### Issue: Database field type mismatch
**Solution**: 
- Notes field: Use simple string, not JSON
- SizeBreakdown: Use '{}' empty object string
- Dates: Remove milliseconds from ISO format

### Issue: Email template corruption
**Solution**: Always provide ALL variables with defaults

### Issue: Success message disappears
**Solution**: Implement persistent modal instead of temporary alert

### Issue: Print layout broken
**Solution**: Use dedicated print styles and window

## Quote Status Management

### Status Values
- **Open**: Initial quote state
- **Converted**: Quote became an order
- **Expired**: Past 30-day validity
- **Cancelled**: Customer cancelled
- **Revised**: New version created

### Status Updates
```javascript
async updateQuoteStatus(quoteId, newStatus) {
    const response = await fetch(`${this.baseURL}/api/quote_sessions/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: newStatus })
    });
    
    if (!response.ok) {
        throw new Error(`Status update failed: ${response.status}`);
    }
    
    return response.json();
}
```

## Best Practices Summary

1. **Always prioritize user experience** - Don't let backend errors block quotes
2. **Generate quote IDs client-side** - Ensures customer always gets an ID
3. **Use defensive defaults** - Prevent null/undefined corruption
4. **Log extensively** - But show user-friendly messages
5. **Test edge cases** - Empty fields, special characters, network issues
6. **Implement fallbacks** - Database down shouldn't stop business
7. **Keep it simple** - Complex logic increases failure points

This workflow has been battle-tested across multiple calculators and provides a robust foundation for quote management.