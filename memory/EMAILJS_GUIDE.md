# EmailJS Integration Guide

## Configuration
```javascript
// Initialize
emailjs.init('4qSbDO-SQs19TbP80');

// Config
const emailConfig = {
    publicKey: '4qSbDO-SQs19TbP80',
    serviceId: 'service_1c4k67j',
    templateId: 'template_xxxxxx'  // Get specific ID from user
};
```

## Required Template Variables
**CRITICAL**: Every variable in your template MUST be provided to avoid corruption errors.

```javascript
const emailData = {
    // Email Routing (Required)
    to_email: customerEmail,
    reply_to: salesRepEmail,
    from_name: 'Northwest Custom Apparel',
    
    // Quote Identification (Required)
    quote_type: 'Calculator Name',  // NEVER use {{PLACEHOLDER}}
    quote_id: 'PREFIX0127-1',
    quote_date: new Date().toLocaleDateString(),
    
    // Customer Info (Required)
    customer_name: 'John Smith',
    customer_email: customerEmail,
    
    // Pricing (Required)
    grand_total: '$554.00',
    
    // Sales Rep (Required)
    sales_rep_name: 'Ruth Nhong',
    sales_rep_email: 'ruth@nwcustomapparel.com',
    sales_rep_phone: '253-922-5793',
    
    // Company (Required)
    company_year: '1977',
    
    // Optional (Always provide defaults)
    company_name: companyName || '',
    customer_phone: phone || '',
    project_name: projectName || '',
    notes: notes || 'No special notes for this order',
    
    // HTML Content (triple braces in template)
    products_html: this.generateQuoteHTML()
};
```

## Anti-Corruption Checklist

### Common Causes of "Corrupted Variables" Error
1. **Missing variables** - Provide ALL template variables
2. **Undefined/null values** - Use `|| ''` for optional fields
3. **Wrong template ID** - Use ID not name (e.g., "template_6bie1il")
4. **Placeholder text** - Never use {{PLACEHOLDER}} as value

### Prevention Pattern
```javascript
// Validate before sending
function validateEmailData(emailData) {
    const required = [
        'to_email', 'from_name', 'reply_to', 'quote_type',
        'quote_id', 'quote_date', 'customer_name', 'grand_total',
        'sales_rep_name', 'sales_rep_email', 'sales_rep_phone',
        'company_year'
    ];
    
    // Check required fields
    const missing = required.filter(key => !emailData[key]);
    if (missing.length > 0) {
        throw new Error(`Missing: ${missing.join(', ')}`);
    }
    
    // Ensure no undefined/null
    Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined || emailData[key] === null) {
            emailData[key] = '';
        }
    });
    
    return true;
}
```

## Email Routing Setup
```
To Email: {{to_email}}           // Customer
From Name: {{from_name}}         // "Northwest Custom Apparel"
Reply To: {{reply_to}}           // Sales rep
CC: {{reply_to}}                 // Sales rep copy
BCC: erik@nwcustomapparel.com   // Owner tracking
```

## HTML in Templates
- Use double braces `{{variable}}` for plain text
- Use triple braces `{{{variable}}}` for HTML content
- Remove all conditional syntax ({{#if}} not supported)

## Sending Emails
```javascript
async sendQuote() {
    try {
        // Build data with ALL variables
        const emailData = this.buildEmailData(quoteData);
        
        // Validate
        validateEmailData(emailData);
        
        // Send
        await emailjs.send(
            emailConfig.serviceId,
            emailConfig.templateId,
            emailData
        );
        
        // Show success with Quote ID
        this.showSuccessModal(quoteData.quoteId);
        
    } catch (error) {
        console.error('EmailJS Error:', error);
        if (error.text?.includes('corrupted')) {
            alert('Template error. Check all variables.');
        } else {
            alert('Failed to send quote. Try again.');
        }
    }
}
```

## Testing & Debugging
```javascript
// Debug helper
console.log('Email data:', emailData);
console.log('Missing vars:', Object.keys(emailData).filter(k => !emailData[k]));

// Test scenarios
1. All fields filled
2. Optional fields empty (should have defaults)
3. Special characters in names/notes
4. Different sales reps
```

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Template not found" | Using name not ID | Use template ID from dashboard |
| "Corrupted variables" | Missing/undefined vars | Provide ALL vars with defaults |
| "Service not found" | Wrong service ID | Use 'service_1c4k67j' |

## Template Best Practices
1. **Always ask for template ID** (not name)
2. **Provide every variable** referenced in template
3. **Use defaults for optional fields** (`|| ''`)
4. **Log data before sending** for debugging
5. **Test with edge cases** (empty fields, special chars)

For template examples, see existing calculators in `/calculators/`.