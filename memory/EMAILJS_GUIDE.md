# EmailJS Integration Guide for NWCA

## Overview

EmailJS enables sending professional quotes directly from the browser without backend infrastructure. All calculators use the same EmailJS account with calculator-specific templates.

**Key Learning from Customer Supplied Embroidery Calculator**: The implementation pattern developed for this calculator serves as the gold standard for all future calculators, featuring proper error handling, success modals, print functionality, and database integration.

## Configuration

```javascript
// Initialize EmailJS (in constructor)
emailjs.init('4qSbDO-SQs19TbP80');

// Configuration object
this.emailConfig = {
    publicKey: '4qSbDO-SQs19TbP80',
    serviceId: 'service_1c4k67j',
    templateId: 'template_xxxxxx'  // Get specific ID from user
};
```

## Required Template Variables

Every calculator must provide ALL of these variables to avoid corruption errors:

```javascript
const emailData = {
    // Email Routing (Required)
    to_email: customerEmail,              // Customer's email
    reply_to: salesRepEmail,              // Sales rep's email
    from_name: 'Northwest Custom Apparel', // Always this value
    
    // Quote Identification (Required)
    quote_type: 'Embroidered Emblems',    // Calculator name
    quote_id: 'EMB0127-1',               // Generated quote ID
    quote_date: new Date().toLocaleDateString(),
    
    // Customer Info (Required)
    customer_name: 'John Smith',
    project_name: projectName || '',      // Can be empty string
    
    // Pricing (Required)
    grand_total: '$554.00',              // Formatted total
    
    // Sales Rep (Required)
    sales_rep_name: 'Ruth Nhong',
    sales_rep_email: 'ruth@nwcustomapparel.com',
    sales_rep_phone: '253-922-5793',
    
    // Company (Required)
    company_year: '1977',
    
    // Optional Fields (Always provide with defaults)
    company_name: companyName || '',
    customer_phone: phone || '',
    notes: notes || 'No special notes for this order',
    special_note: '',                    // Additional note if needed
    
    // Quote Content (HTML for complex layouts)
    products_html: this.generateQuoteHTML(),
    quote_summary: summaryText || ''
};
```

## Sending Emails

```javascript
async handleQuoteSubmit(e) {
    e.preventDefault();
    
    try {
        // 1. Generate quote ID
        const quoteId = this.quoteService.generateQuoteID();
        
        // 2. Build email data (ALL variables required!)
        const emailData = {
            // ... all required fields
        };
        
        // 3. Save to database if enabled
        if (this.saveToDatabase.checked) {
            const saveResult = await this.quoteService.saveQuote(quoteData);
            if (!saveResult.success) {
                console.error('Database save failed:', saveResult.error);
                // Continue with email send
            }
        }
        
        // 4. Send email
        await emailjs.send(
            this.emailConfig.serviceId,
            this.emailConfig.templateId,
            emailData
        );
        
        // 5. Show success with quote ID
        this.showSuccess(`Quote sent successfully! Quote ID: ${quoteId}`);
        
    } catch (error) {
        console.error('EmailJS Error:', error);
        this.showError('Failed to send quote. Please try again.');
    }
}
```

## Common EmailJS Errors and Solutions

### "One or more dynamic variables are corrupted"
- **Cause**: Missing or undefined template variables
- **Solution**: Ensure ALL variables have values (use `|| ''` for optional fields)

### "Template not found"
- **Cause**: Using template name instead of template ID
- **Solution**: Always use template ID (e.g., "template_6bie1il")

### Undefined Variables
```javascript
// ❌ Wrong - causes corruption
emailData.notes = undefined;
emailData.company = null;

// ✅ Correct - always provide value
emailData.notes = notes || '';
emailData.company = company || 'Not Provided';
```

## HTML Content in Templates

For complex quote layouts, use HTML:

```javascript
generateQuoteHTML() {
    return `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; text-align: left;">Item</th>
                    <th style="padding: 8px; text-align: center;">Qty</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${this.items.map(item => `
                    <tr>
                        <td style="padding: 8px;">${item.name}</td>
                        <td style="padding: 8px; text-align: center;">${item.qty}</td>
                        <td style="padding: 8px; text-align: right;">$${item.total}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
```

In EmailJS template, use triple braces for HTML:
```
{{{products_html}}}  <!-- Renders HTML -->
{{customer_name}}    <!-- Renders plain text -->
```

## Staff Email Directory

```javascript
const salesReps = {
    'ruth@nwcustomapparel.com': 'Ruth',
    'taylar@nwcustomapparel.com': 'Taylar',
    'nika@nwcustomapparel.com': 'Nika',
    'erik@nwcustomapparel.com': 'Erik',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'bradley@nwcustomapparel.com': 'Bradley',
    'jim@nwcustomapparel.com': 'Jim',
    'art@nwcustomapparel.com': 'Steve (Artist)',
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
};
```

## EmailJS Template Best Practices

### 1. Always Ask for Template ID
**IMPORTANT**: Never assume template names. Always ask for the specific template ID.
- Template names are what users see (e.g., "Laser_Tumbler_Template")
- Template IDs are what EmailJS uses (e.g., "template_6bie1il")
- Find template IDs at: https://dashboard.emailjs.com/admin/templates

### 2. Email Routing Best Practices
Standard EmailJS configuration for quote systems:
```
To Email: {{to_email}}           // Customer's email
From Name: {{from_name}}         // "Northwest Custom Apparel"
From Email: Use Default          // Your EmailJS sender
Reply To: {{reply_to}}           // Sales rep's email
CC: {{reply_to}}                 // Sales rep gets a copy
BCC: erik@nwcustomapparel.com   // Erik always gets a copy
```

This ensures:
- Customer receives the quote
- Sales rep gets a copy (visible in CC)
- Erik tracks all quotes (hidden in BCC)
- Customer replies go to the sales rep

### 3. Notes Field Implementation
Always include a notes field in quote forms:
```javascript
// In email data
const emailData = {
    // ... other fields
    notes: this.notesTextarea.value || 'No special notes for this order',
    // ... other fields
};
```

In EmailJS template, always show notes section:
```html
<div class="notes-section">
    <h4>Notes:</h4>
    <p>{{notes}}</p>
</div>
```

### 4. Required Template Variables
Standard variables for all quote templates:
- `{{to_email}}` - Customer's email
- `{{from_name}}` - Always "Northwest Custom Apparel"
- `{{reply_to}}` - Sales rep's email
- `{{customer_name}}` - Customer name
- `{{project_name}}` - Project/order name
- `{{quote_id}}` - Unique identifier
- `{{quote_date}}` - Current date
- `{{notes}}` - Special instructions
- `{{sales_rep_name}}` - Rep's display name
- `{{sales_rep_email}}` - Rep's email
- `{{sales_rep_phone}}` - Always "253-922-5793"
- `{{company_year}}` - Always "1977"

### 5. Common EmailJS Errors and Solutions

#### "Template not found"
- **Cause**: Using template name instead of ID
- **Solution**: Use the template ID (e.g., "template_6bie1il")

#### "One or more dynamic variables are corrupted"
- **Cause**: Undefined variables or conditional logic issues
- **Solution**: Ensure all variables have values (use `|| ''`)

#### "Service not found"
- **Cause**: Wrong service ID
- **Solution**: Use 'service_1c4k67j' for NWCA

### 6. Testing Email Templates
Always test with:
1. All fields filled
2. Optional fields empty
3. Special characters in names/notes
4. Different sales reps selected
5. Verify CC and BCC recipients

## EmailJS Anti-Corruption Guide

### Overview
This guide prevents the dreaded "One or more dynamic variables are corrupted" error that can occur with EmailJS templates.

### 1. Never Use Placeholder Variables
**THE #1 CAUSE OF CORRUPTION**: Using placeholder text like `{{QUOTE_TYPE}}` in templates.

**❌ BAD - Causes Corruption**:
```html
<h1>{{QUOTE_TYPE}} Quote</h1>  <!-- NEVER DO THIS -->
```

**✅ GOOD - Works Correctly**:
```html
<h1>{{quote_type}} Quote</h1>  <!-- Actual variable -->
```

**Why?** EmailJS expects every `{{variable}}` to exist in your data object. Placeholder text that's meant to be replaced will cause corruption.

### 2. Always Provide ALL Variables
Every variable referenced in your template MUST exist in the data object:

```javascript
// ✅ CORRECT - All variables provided
const emailData = {
    // Required fields
    to_email: customerEmail,
    customer_name: customerName,
    quote_type: 'Laser Tumbler',  // NOT a placeholder!
    quote_id: 'LT0127-1',
    quote_date: new Date().toLocaleDateString(),
    grand_total: '$450.00',
    sales_rep_name: 'Ruth Nhong',
    sales_rep_email: 'ruth@nwcustomapparel.com',
    sales_rep_phone: '253-922-5793',
    company_year: '1977',
    
    // Optional fields - ALWAYS provide with defaults
    special_note: specialNote || '',
    notes: customerNotes || 'No special notes for this order',
    project_name: projectName || '',
    quote_summary: summary || ''
};

// ❌ WRONG - Missing/undefined variables
const emailData = {
    to_email: customerEmail,
    customer_name: customerName,
    // Missing quote_type will cause corruption!
    // undefined special_note will cause corruption!
};
```

### 3. Pre-Send Validation Checklist
Always validate before sending:

```javascript
// Required variables checklist
const requiredVars = [
    'to_email', 'reply_to', 'customer_name', 'quote_id', 
    'quote_date', 'quote_type', 'grand_total', 'sales_rep_name', 
    'sales_rep_email', 'sales_rep_phone', 'company_year'
];

// Optional variables that should have defaults
const optionalVars = {
    'special_note': '',
    'notes': 'No special notes for this order',
    'project_name': '',
    'quote_summary': '',
    'from_name': 'Northwest Custom Apparel'
};

// Validate required variables
const missingVars = [];
requiredVars.forEach(varName => {
    if (!emailData[varName]) {
        missingVars.push(varName);
    }
});

if (missingVars.length > 0) {
    console.error('Missing required variables:', missingVars);
    throw new Error(`Missing required email variables: ${missingVars.join(', ')}`);
}

// Apply defaults for optional variables
Object.keys(optionalVars).forEach(varName => {
    if (emailData[varName] === undefined || emailData[varName] === null) {
        emailData[varName] = optionalVars[varName];
    }
});

// Log for debugging
console.log('Email data validated:', emailData);
```

### 4. Common Corruption Triggers to Avoid

#### ❌ Undefined or Null Values
```javascript
// WRONG
emailData.notes = undefined;  // Causes corruption
emailData.special_note = null;  // Causes corruption

// CORRECT
emailData.notes = notesValue || '';
emailData.special_note = specialNote || '';
```

#### ❌ Conditional Logic in Templates
```html
<!-- AVOID in EmailJS templates -->
{{#if personal_message}}
    <p>{{personal_message}}</p>
{{/if}}

<!-- USE THIS INSTEAD -->
<p>{{personal_message}}</p>  <!-- Just shows nothing if empty -->
```

#### ❌ Case Sensitivity Mistakes
```javascript
// Template has: {{customer_name}}
emailData.Customer_Name = 'John';  // WRONG - case mismatch
emailData.customer_name = 'John';  // CORRECT
```

#### ❌ Special Characters in Variable Names
```javascript
// WRONG
emailData['customer-name'] = 'John';  // Hyphen not allowed
emailData['customer.name'] = 'John';  // Dot not allowed

// CORRECT
emailData.customer_name = 'John';  // Use underscores
```

### 5. Implementation Template
Use this template for all EmailJS implementations:

```javascript
async function sendQuoteEmail(quoteData) {
    try {
        // Build email data with ALL required fields
        const emailData = {
            // System fields
            to_email: quoteData.customerEmail,
            reply_to: quoteData.salesRepEmail,
            from_name: 'Northwest Custom Apparel',
            
            // Quote identification
            quote_type: 'Your Calculator Name Here',  // NEVER use {{PLACEHOLDER}}
            quote_id: quoteData.quoteId,
            quote_date: new Date().toLocaleDateString(),
            
            // Customer info
            customer_name: quoteData.customerName,
            project_name: quoteData.projectName || '',
            
            // Pricing
            grand_total: `$${quoteData.total.toFixed(2)}`,
            
            // Optional fields with defaults
            special_note: quoteData.specialNote || '',
            notes: quoteData.notes || 'No special notes for this order',
            quote_summary: quoteData.summary || '',
            
            // Sales rep info
            sales_rep_name: quoteData.salesRepName,
            sales_rep_email: quoteData.salesRepEmail,
            sales_rep_phone: '253-922-5793',
            
            // Company info
            company_year: '1977'
        };
        
        // Validate before sending
        console.log('Sending email with data:', emailData);
        
        // Send email
        const response = await emailjs.send(
            'service_1c4k67j',
            'template_xxxxxx',  // Your actual template ID
            emailData
        );
        
        console.log('Email sent successfully:', response);
        return { success: true };
        
    } catch (error) {
        console.error('EmailJS Error:', error);
        console.error('Failed email data:', emailData);
        return { 
            success: false, 
            error: error.message || 'Failed to send email' 
        };
    }
}
```

### 6. Debugging Corruption Errors

When you get "One or more dynamic variables are corrupted":

1. **Check the console** for the exact data being sent
2. **Compare** template variables with your data object
3. **Look for**:
   - Undefined/null values
   - Missing required variables
   - Case mismatches
   - Placeholder text like {{VARIABLE_NAME}}

```javascript
// Debug helper
function debugEmailData(emailData, templateVars) {
    console.group('EmailJS Debug');
    
    // Check for undefined/null
    Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined || emailData[key] === null) {
            console.error(`❌ ${key} is ${emailData[key]}`);
        }
    });
    
    // Check for missing template vars
    templateVars.forEach(varName => {
        if (!(varName in emailData)) {
            console.error(`❌ Missing template variable: ${varName}`);
        }
    });
    
    console.log('📧 Email data:', emailData);
    console.groupEnd();
}
```

### 7. Quick Reference - Variable Requirements

| Variable | Required | Default Value | Notes |
|----------|----------|---------------|-------|
| to_email | ✅ | - | Customer's email |
| reply_to | ✅ | - | Sales rep email |
| quote_type | ✅ | - | e.g., "Laser Tumbler" |
| quote_id | ✅ | - | e.g., "LT0127-1" |
| customer_name | ✅ | - | Customer's full name |
| grand_total | ✅ | - | Formatted total |
| sales_rep_name | ✅ | - | Rep's display name |
| sales_rep_email | ✅ | - | Rep's email |
| sales_rep_phone | ✅ | - | "253-922-5793" |
| company_year | ✅ | - | "1977" |
| from_name | ✅ | "Northwest Custom Apparel" | Sender name |
| quote_date | ✅ | - | Current date |
| special_note | ❌ | "" | Optional note |
| notes | ❌ | "No special notes..." | Customer notes |
| project_name | ❌ | "" | Project description |
| quote_summary | ❌ | "" | Brief summary |

### 8. Testing Procedure

Before going live, test these scenarios:

1. **Full data test** - All fields populated
2. **Minimal data test** - Only required fields
3. **Empty optional fields** - Ensure defaults work
4. **Special characters** - Test quotes, apostrophes in names
5. **Console validation** - Check all data before sending

Remember: The key to avoiding corruption is **consistency** - every variable in your template must exist in your data object with a valid value (never undefined or null).

## EmailJS Template Variable Best Practices

### Problem: "One or more dynamic variables are corrupted" error in EmailJS.

**Common Causes & Solutions**:

1. **Conditional Logic Issues**:
   - **AVOID**: `{{#if personal_message}}...{{/if}}` - Can cause corruption with empty/undefined values
   - **USE**: Direct variable placement `{{personal_message}}` - Shows nothing if empty
   
2. **Undefined Variables**:
   ```javascript
   // Always ensure variables have a value (even empty string)
   const emailData = {
       personal_message: personalMessage || '',  // Never undefined
       optional_field: optionalValue || ''
   };
   ```

3. **Template ID vs Template Name**:
   - Template Name: What you call it (e.g., "Buyer Guide 2025")
   - Template ID: What EmailJS uses (e.g., "template_wna04vr")
   - Always use the Template ID in code, found at: https://dashboard.emailjs.com/admin/templates

4. **Variable Naming**:
   - Use consistent snake_case or camelCase
   - Avoid special characters in variable names
   - Match exactly between template and code

**Debugging Template Issues**:
```javascript
// Always log data before sending
console.log('Sending email with data:', emailData);

// Better error handling
try {
    await emailjs.send(serviceId, templateId, emailData);
} catch (error) {
    console.error('EmailJS Error:', error);
    console.error('Template ID:', templateId);
    console.error('Data sent:', emailData);
}
```
## Important EmailJS Notes

- **Remove all conditional syntax** ({{#if}} statements) - EmailJS doesn't support these
- **Always provide default values** for optional variables to prevent corruption
- **Use triple braces {{{variable}}}** for HTML content, double braces {{variable}} for plain text

## Success Modal Implementation

Based on the successful Customer Supplied Embroidery Calculator pattern:

```javascript
// Show success modal instead of temporary alert
showSuccessModal(quoteId, quoteData) {
    // Update modal content
    document.getElementById('modalQuoteId').textContent = quoteId;
    document.getElementById('modalCustomerName').textContent = quoteData.customerName;
    document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
    document.getElementById('modalTotalAmount').textContent = `$${quoteData.totalCost.toFixed(2)}`;
    
    // Store data for print functionality
    this.lastQuoteData = quoteData;
    this.lastQuoteData.quoteId = quoteId;
    
    // Show modal
    document.getElementById('successModal').classList.add('active');
}
```

### Success Modal HTML Structure
```html
<div class="modal-overlay" id="successModal">
    <div class="modal-content">
        <div class="modal-header">
            <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success-text);"></i>
            <h2 style="color: var(--success-text); margin-top: 1rem;">Quote Sent Successfully!</h2>
        </div>
        <div class="modal-body">
            <div style="text-align: center; margin-bottom: 2rem;">
                <p style="font-size: 1.125rem; color: var(--text-secondary); margin-bottom: 1rem;">
                    Your quote has been sent to:
                </p>
                <p style="font-weight: 600;" id="modalCustomerName"></p>
                <p style="color: var(--text-secondary);" id="modalCustomerEmail"></p>
            </div>
            
            <div style="background: var(--bg-color); padding: 1.5rem; border-radius: 6px; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span style="font-weight: 600;">Quote ID:</span>
                    <span style="font-family: monospace; font-size: 1.125rem;" id="modalQuoteId"></span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">Total Amount:</span>
                    <span style="font-size: 1.25rem; color: var(--primary-color); font-weight: 600;" id="modalTotalAmount"></span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button type="button" class="btn btn-secondary" onclick="copyQuoteId()">
                    <i class="fas fa-copy"></i>
                    Copy Quote ID
                </button>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="printQuote()">
                <i class="fas fa-print"></i>
                Print Quote
            </button>
            <button type="button" class="btn btn-primary" onclick="closeModal()">
                <i class="fas fa-check"></i>
                Done
            </button>
        </div>
    </div>
</div>
```

## Print Functionality Pattern

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
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                /* Professional print styles */
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

## Color Theme Consistency

### IMPORTANT: Always Use NWCA Green Colors
When designing email templates and calculators, maintain consistent branding with NWCA's green color scheme:

- **Primary Green**: `#4cb354` (Main NWCA green)
- **Dark Green**: `#409a47` (Hover states, emphasis)
- **Light Green**: `#5bc85f` (Highlights)
- **Success Background**: `#d1fae5` (Light green background)
- **Success Text**: `#065f46` (Dark green text)

**Never use teal colors** like `#0d9488` or `#14b8a6` - these don't match NWCA branding.

Example for email templates:
```html
<!-- Header background -->
<td style="background-color: #4cb354; padding: 30px;">

<!-- Accent borders -->
<div style="border: 2px solid #4cb354;">

<!-- Total amount emphasis -->
<span style="color: #4cb354; font-weight: bold;">
```

## Company Contact Information

- **Phone**: 253-922-5793 (Toll Free: 1-800-851-3671)
- **Email**: sales@nwcustomapparel.com
- **Website**: https://www.nwcustomapparel.com
- **Address**: 2025 Freeman Road East, Milton, WA 98354
- **Hours**: Monday - Friday, 9:00 AM - 5:00 PM
- **Established**: 1977 (Family Owned and Operated)


