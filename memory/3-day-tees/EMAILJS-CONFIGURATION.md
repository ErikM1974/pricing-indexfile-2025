# EmailJS Template Configuration - 3-Day Tees

**Last Updated:** 2025-01-12
**Purpose:** Document EmailJS template configuration for proper HTML rendering
**Status:** Production-ready after triple-brace fix

---

## Overview

The 3-Day Tees rush order system sends two emails via EmailJS:
1. **Customer Confirmation** - Sent to customer after order submission
2. **Sales Team Notification** - Sent to sales team with order details

Both templates require proper configuration to render HTML content (product tables, payment confirmations, alert boxes).

## Critical Configuration: HTML Variable Syntax

### The Problem

EmailJS uses two different variable syntaxes:
- **Double Braces `{{variable}}`** - HTML-escapes content (converts `<` to `&lt;`, etc.)
- **Triple Braces `{{{variable}}}`** - Renders raw HTML without escaping

**Issue Encountered:** HTML content was showing up as raw text in emails instead of rendered tables and styled boxes.

**Root Cause:** EmailJS templates were using `{{variable}}` for HTML content variables, which HTML-escaped the content and displayed raw tags.

### The Solution

**Rule:** Use triple braces `{{{variable}}}` for any variable containing HTML content.

## Template Configuration

### Customer Email Template (`template_sample_customer`)

**Service ID:** `service_1c4k67j`
**Template ID:** `template_sample_customer`

**HTML Variables (MUST use triple braces):**
```html
<!-- Line 47: Payment confirmation HTML (styled alert box) -->
{{{payment_confirmation}}}

<!-- Line 82: Products table HTML (styled table) -->
{{{products_table}}}
```

**Text Variables (use double braces):**
```html
{{customer_name}}
{{company_name}}
{{customer_email}}
{{order_number}}
{{order_date}}
{{total_items}}
{{subtotal}}
{{shipping}}
{{tax}}
{{total_amount}}
{{company_phone}}
```

### Sales Team Email Template (`template_sample_sales`)

**Service ID:** `service_1c4k67j`
**Template ID:** `template_sample_sales`

**HTML Variables (MUST use triple braces):**
```html
<!-- Line 29: Payment status alert (green/yellow box) -->
{{{payment_status}}}

<!-- Line 34: Error section (red alert box if errors) -->
{{{error_section}}}

<!-- Line 68: Products table HTML (styled table) -->
{{{products_table}}}

<!-- Line 85: Message section (customer message box) -->
{{{message_section}}}

<!-- Line 119: Order data section (technical details) -->
{{{order_data_section}}}
```

**Text Variables (use double braces):**
```html
{{order_number}}
{{customer_name}}
{{customer_email}}
{{customer_phone}}
{{company_name}}
{{order_date}}
{{total_items}}
{{subtotal}}
{{shipping}}
{{tax}}
{{total_amount}}
```

## JavaScript Implementation

The JavaScript code in `three-day-tees-order-service.js` correctly builds HTML strings:

```javascript
// Customer email - builds HTML for payment confirmation
const paymentConfirmation = paymentIdMatch
    ? `<div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
        <strong style="color: #065f46;">✓ Payment Confirmed</strong><br>
        <span style="color: #047857; font-size: 0.875rem;">Transaction ID: ${paymentIdMatch[1]}</span>
       </div>`
    : '';

// Sales team email - builds HTML for payment status
const paymentStatus = paymentIdMatch
    ? `<div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
        <strong style="color: #065f46;">✓ PAYMENT RECEIVED</strong><br>
        <span style="color: #047857; font-size: 0.875rem;">Stripe Payment ID: ${paymentIdMatch[1]}</span>
       </div>`
    : `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
        <strong style="color: #92400e;">⚠ PAYMENT PENDING</strong>
       </div>`;

// Products table HTML
const productsTable = orderData.lineItems.map((item, index) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 0.75rem;">${item.color}</td>
        <td style="padding: 0.75rem;">${item.size}</td>
        <td style="padding: 0.75rem;">${item.quantity}</td>
        <td style="padding: 0.75rem;">$${item.price.toFixed(2)}</td>
        <td style="padding: 0.75rem;">$${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
`).join('');
```

**No changes needed to JavaScript code** - the code correctly builds HTML strings.

## Verification Checklist

After updating EmailJS templates:

- [ ] Customer email: Payment confirmation shows as styled green box (not raw HTML)
- [ ] Customer email: Products table displays as formatted table (not HTML tags)
- [ ] Sales team email: Payment status shows as colored alert box
- [ ] Sales team email: Products table displays properly
- [ ] Sales team email: Error section (if present) shows as red alert box
- [ ] Sales team email: Order data section displays as formatted code block
- [ ] All text variables (names, dates, amounts) display correctly

## Troubleshooting

### Problem: HTML showing as raw text in email

**Check:**
1. Open EmailJS dashboard → Templates
2. Find the affected template (`template_sample_customer` or `template_sample_sales`)
3. Verify HTML variables use triple braces `{{{variable}}}`

**Quick Fix:**
- Change `{{payment_confirmation}}` to `{{{payment_confirmation}}}`
- Change `{{products_table}}` to `{{{products_table}}}`
- Change `{{payment_status}}` to `{{{payment_status}}}`
- Change `{{error_section}}` to `{{{error_section}}}`
- Change `{{message_section}}` to `{{{message_section}}}`
- Change `{{order_data_section}}` to `{{{order_data_section}}}`

### Problem: All content missing from email

**Cause:** Changed text variable to triple braces (e.g., `{{{customer_name}}}`)

**Fix:** Only use triple braces for HTML content variables. Text variables should use double braces.

## Summary

**Key Rule:**
- HTML content = `{{{variable}}}` (triple braces)
- Plain text = `{{variable}}` (double braces)

**Affected Templates:**
- `template_sample_customer` - 2 HTML variables
- `template_sample_sales` - 5 HTML variables

**Status:** ✅ Fixed and verified working in production

---

**Documentation Type:** EmailJS Configuration Guide
**Related Files:**
- `/shared_components/js/three-day-tees-order-service.js` (lines 287-401)
- EmailJS Dashboard Templates (service_1c4k67j)
