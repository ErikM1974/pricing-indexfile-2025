# EmailJS Complete Guide - Master Reference

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Template Configuration](#template-configuration)
3. [Variable Management](#variable-management)
4. [Anti-Corruption Strategies](#anti-corruption-strategies)
5. [HTML Email Templates](#html-email-templates)
6. [Error Handling](#error-handling)
7. [Testing Procedures](#testing-procedures)
8. [Common Patterns](#common-patterns)

## Initial Setup

### Account Configuration
```javascript
// EmailJS Credentials (Public)
const EMAILJS_CONFIG = {
    publicKey: '4qSbDO-SQs19TbP80',
    serviceId: 'service_1c4k67j',
    // Template IDs are calculator-specific
};

// Initialize in constructor
emailjs.init(EMAILJS_CONFIG.publicKey);
```

### Dashboard Access
- URL: https://dashboard.emailjs.com
- Service: Northwest Custom Apparel
- Templates: Each calculator has dedicated template

## Template Configuration

### Email Routing Setup
```
To Email: {{to_email}}              // Customer's email
From Name: {{from_name}}            // "Northwest Custom Apparel"
From Email: [EmailJS Default]       // service@emailjs.com
Reply To: {{reply_to}}              // Sales rep email
CC: {{reply_to}}                    // Sales rep copy
BCC: erik@nwcustomapparel.com      // Owner tracking
```

### Standard Template Structure
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{quote_type}} Quote - {{quote_id}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
    <!-- Header with Logo -->
    <div style="text-align: center; padding: 20px; background: #f8f9fa;">
        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
             alt="Northwest Custom Apparel" style="max-width: 300px;">
    </div>
    
    <!-- Quote Header -->
    <div style="padding: 20px;">
        <h2 style="color: #4cb354;">{{quote_type}} Quote</h2>
        <p><strong>Quote ID:</strong> {{quote_id}}</p>
        <p><strong>Date:</strong> {{quote_date}}</p>
    </div>
    
    <!-- Customer Info -->
    <div style="background: #f8f9fa; padding: 15px; margin: 20px;">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> {{customer_name}}</p>
        <p><strong>Company:</strong> {{company_name}}</p>
        <p><strong>Email:</strong> {{to_email}}</p>
        <p><strong>Phone:</strong> {{customer_phone}}</p>
        <p><strong>Project:</strong> {{project_name}}</p>
    </div>
    
    <!-- Quote Details -->
    <div style="margin: 20px;">
        {{{products_html}}}
    </div>
    
    <!-- Total -->
    <div style="text-align: right; margin: 20px; font-size: 1.2em;">
        <strong>Total: ${{grand_total}}</strong>
    </div>
    
    <!-- Notes -->
    <div style="background: #fff3cd; padding: 15px; margin: 20px;">
        <h4>Notes:</h4>
        <p>{{notes}}</p>
    </div>
    
    <!-- Footer -->
    <div style="background: #4cb354; color: white; padding: 20px; text-align: center;">
        <p>Family Owned & Operated Since {{company_year}}</p>
        <p>{{sales_rep_name}} | {{sales_rep_email}} | {{sales_rep_phone}}</p>
    </div>
</body>
</html>
```

## Variable Management

### Required Variables Checklist
```javascript
const REQUIRED_EMAIL_VARS = {
    // System Variables
    to_email: 'customer@email.com',
    from_name: 'Northwest Custom Apparel',
    reply_to: 'salesrep@nwcustomapparel.com',
    
    // Quote Identification
    quote_type: 'Calculator Name Here',
    quote_id: 'PREFIX0127-1',
    quote_date: new Date().toLocaleDateString(),
    
    // Customer Information
    customer_name: 'Full Name',
    customer_email: 'customer@email.com',
    company_name: 'Company' || '',
    customer_phone: 'Phone' || '',
    project_name: 'Project' || '',
    
    // Pricing
    grand_total: '1,234.56',
    
    // Sales Rep
    sales_rep_name: 'Rep Name',
    sales_rep_email: 'rep@nwcustomapparel.com',
    sales_rep_phone: '253-922-5793',
    
    // Company
    company_year: '1977',
    
    // Content
    products_html: '<table>...</table>',
    notes: 'Special instructions' || 'No special notes for this order'
};
```

### Variable Validation Function
```javascript
function validateEmailData(emailData) {
    const required = [
        'to_email', 'from_name', 'reply_to', 'quote_type', 
        'quote_id', 'quote_date', 'customer_name', 'grand_total',
        'sales_rep_name', 'sales_rep_email', 'sales_rep_phone', 
        'company_year'
    ];
    
    const missing = required.filter(key => !emailData[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required email variables: ${missing.join(', ')}`);
    }
    
    // Ensure no undefined/null values
    Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined || emailData[key] === null) {
            emailData[key] = '';
        }
    });
    
    return true;
}
```

## Anti-Corruption Strategies

### 1. Never Use Placeholders
```javascript
// ❌ WRONG - Causes corruption
const emailData = {
    quote_type: '{{QUOTE_TYPE}}'  // THIS WILL FAIL
};

// ✅ CORRECT - Use actual values
const emailData = {
    quote_type: 'Embroidered Emblems'  // Real calculator name
};
```

### 2. Always Provide Defaults
```javascript
// Build email data with safe defaults
const emailData = {
    // Required fields - no defaults
    to_email: customerEmail,
    customer_name: customerName,
    quote_id: quoteId,
    
    // Optional fields - ALWAYS provide defaults
    company_name: companyName || '',
    customer_phone: phone || '',
    project_name: project || '',
    notes: notes || 'No special notes for this order',
    special_note: specialNote || '',
    
    // Never leave undefined
    optional_field: optionalValue ?? ''  // Nullish coalescing
};
```

### 3. Pre-Send Validation
```javascript
// Complete validation before sending
function prepareEmailData(rawData) {
    // Start with required fields
    const emailData = {
        to_email: rawData.customerEmail,
        from_name: 'Northwest Custom Apparel',
        reply_to: rawData.salesRepEmail,
        quote_type: this.calculatorName,
        quote_id: rawData.quoteId,
        quote_date: new Date().toLocaleDateString(),
        customer_name: rawData.customerName,
        grand_total: rawData.totalCost.toFixed(2),
        sales_rep_name: rawData.salesRepName,
        sales_rep_email: rawData.salesRepEmail,
        sales_rep_phone: '253-922-5793',
        company_year: '1977'
    };
    
    // Add optional fields with defaults
    const optionalFields = {
        company_name: rawData.companyName || '',
        customer_phone: rawData.phone || '',
        project_name: rawData.projectName || '',
        notes: rawData.notes || 'No special notes for this order',
        products_html: this.generateQuoteHTML(rawData) || ''
    };
    
    // Merge and validate
    Object.assign(emailData, optionalFields);
    validateEmailData(emailData);
    
    return emailData;
}
```

## HTML Email Templates

### Product Table Generator
```javascript
generateQuoteHTML(quoteData) {
    const styles = {
        table: 'width: 100%; border-collapse: collapse; margin: 20px 0;',
        th: 'background: #4cb354; color: white; padding: 12px; text-align: left;',
        td: 'padding: 10px; border-bottom: 1px solid #ddd;',
        total: 'font-weight: bold; background: #f8f9fa;'
    };
    
    return `
        <table style="${styles.table}">
            <thead>
                <tr>
                    <th style="${styles.th}">Item</th>
                    <th style="${styles.th}; text-align: center;">Quantity</th>
                    <th style="${styles.th}; text-align: right;">Unit Price</th>
                    <th style="${styles.th}; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${this.generateItemRows(quoteData)}
            </tbody>
            <tfoot>
                ${this.generateTotalRows(quoteData)}
            </tfoot>
        </table>
    `;
}
```

### Responsive Email Styles
```css
/* Mobile-friendly email styles */
@media only screen and (max-width: 600px) {
    table { width: 100% !important; }
    td, th { display: block !important; width: 100% !important; }
}
```

## Error Handling

### Common EmailJS Errors

#### 1. Template Not Found
```javascript
// Always use template ID, not name
const templateId = 'template_abc123';  // ✅ Correct
const templateId = 'My Template';      // ❌ Wrong
```

#### 2. Service Not Found
```javascript
// Correct service ID for NWCA
const serviceId = 'service_1c4k67j';
```

#### 3. Variable Corruption
```javascript
try {
    await emailjs.send(serviceId, templateId, emailData);
} catch (error) {
    if (error.text?.includes('corrupted')) {
        console.error('Template variables:', Object.keys(emailData));
        console.error('Check for undefined values');
    }
}
```

### Error Recovery Pattern
```javascript
async sendQuoteEmail(quoteData) {
    let retries = 3;
    
    while (retries > 0) {
        try {
            const emailData = this.prepareEmailData(quoteData);
            
            await emailjs.send(
                this.emailConfig.serviceId,
                this.emailConfig.templateId,
                emailData
            );
            
            return { success: true };
            
        } catch (error) {
            retries--;
            
            if (retries === 0) {
                console.error('EmailJS failed after 3 attempts:', error);
                return { 
                    success: false, 
                    error: error.text || error.message 
                };
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
```

## Testing Procedures

### 1. Variable Completeness Test
```javascript
// Test with minimal data
const minimalTest = {
    customerName: 'Test User',
    customerEmail: 'test@example.com',
    quantity: 1,
    totalCost: 100
};

// Test with full data
const fullTest = {
    ...minimalTest,
    companyName: 'Test Company',
    phone: '555-1234',
    projectName: 'Test Project',
    notes: 'Special characters: "quotes" & ampersand'
};
```

### 2. Template Testing Checklist
- [ ] All required variables present
- [ ] Optional variables have defaults
- [ ] HTML renders correctly
- [ ] Special characters handled
- [ ] Mobile responsive
- [ ] Print friendly
- [ ] Links clickable
- [ ] Images load

### 3. Integration Testing
```javascript
// Test database save failure
mockDatabaseFailure();
// Ensure email still sends

// Test email service failure
mockEmailFailure();
// Ensure proper error message

// Test network timeout
mockNetworkDelay(5000);
// Ensure timeout handling
```

## Common Patterns

### 1. Calculator Email Setup
```javascript
class CalculatorWithEmail {
    constructor() {
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // Store config
        this.emailConfig = {
            serviceId: 'service_1c4k67j',
            templateId: null  // Set in child class
        };
        
        // Calculator name for emails
        this.calculatorName = 'Your Calculator Name';
    }
    
    async sendQuote(formData) {
        const quoteData = this.buildQuoteData(formData);
        const emailData = this.buildEmailData(quoteData);
        
        try {
            await emailjs.send(
                this.emailConfig.serviceId,
                this.emailConfig.templateId,
                emailData
            );
            
            this.showSuccessModal(quoteData.quoteId);
            
        } catch (error) {
            this.handleEmailError(error);
        }
    }
}
```

### 2. Sales Rep Directory
```javascript
const SALES_REPS = {
    'ruth@nwcustomapparel.com': {
        name: 'Ruth Nhong',
        title: 'Sales Representative'
    },
    'taylar@nwcustomapparel.com': {
        name: 'Taylar',
        title: 'Sales Representative'
    },
    'nika@nwcustomapparel.com': {
        name: 'Nika',
        title: 'Sales Representative'
    },
    'erik@nwcustomapparel.com': {
        name: 'Erik',
        title: 'Owner'
    },
    'sales@nwcustomapparel.com': {
        name: 'Northwest Custom Apparel Sales Team',
        title: 'General Sales'
    }
};
```

### 3. Email Data Builder
```javascript
buildEmailData(quoteData) {
    const rep = SALES_REPS[quoteData.salesRepEmail] || SALES_REPS['sales@nwcustomapparel.com'];
    
    return {
        // System
        to_email: quoteData.customerEmail,
        from_name: 'Northwest Custom Apparel',
        reply_to: quoteData.salesRepEmail,
        
        // Quote
        quote_type: this.calculatorName,
        quote_id: quoteData.quoteId,
        quote_date: new Date().toLocaleDateString(),
        
        // Customer
        customer_name: quoteData.customerName,
        customer_email: quoteData.customerEmail,
        company_name: quoteData.companyName || '',
        customer_phone: quoteData.phone || '',
        project_name: quoteData.projectName || '',
        
        // Pricing
        grand_total: quoteData.totalCost.toFixed(2),
        
        // Content
        products_html: this.generateQuoteHTML(quoteData),
        notes: quoteData.notes || 'No special notes for this order',
        
        // Sales Rep
        sales_rep_name: rep.name,
        sales_rep_email: quoteData.salesRepEmail,
        sales_rep_phone: '253-922-5793',
        
        // Company
        company_year: '1977'
    };
}
```

## Best Practices Summary

1. **Always validate before sending** - Catch errors early
2. **Never use placeholder syntax** - Real values only
3. **Provide defaults for everything** - No undefined/null
4. **Use template IDs, not names** - Found in dashboard
5. **Log everything during development** - Remove in production
6. **Test edge cases thoroughly** - Special characters, empty fields
7. **Handle errors gracefully** - User-friendly messages
8. **Keep templates simple** - Avoid complex logic
9. **Use HTML for complex layouts** - Triple braces {{{html}}}
10. **Document template variables** - For future developers

This complete guide ensures reliable email delivery across all calculators.