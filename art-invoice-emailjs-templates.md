# Art Invoice EmailJS Templates

## Overview

The Art Invoice System uses EmailJS for sending invoice emails and reminders. You'll need to create the following templates in your EmailJS dashboard.

## Templates Required

### 1. art_invoice (Main Invoice Email)
This template is for sending the actual invoice to customers.

**Variables:**
- `{{invoice_id}}` - The invoice ID (e.g., ART-52503)
- `{{customer_name}}` - Customer's name
- `{{customer_company}}` - Customer's company
- `{{customer_email}}` - Customer's email
- `{{amount_art_billed}}` - Total invoice amount
- `{{service_code}}` - Service code (e.g., GRT-50)
- `{{service_description}}` - Description of service
- `{{due_date}}` - Invoice due date
- `{{sales_rep_name}}` - Sales representative name
- `{{sales_rep_email}}` - Sales rep email
- `{{artist_name}}` - Artist name (Steve Deland)

### 2. art_invoice_reminder (Payment Reminder)
This template is for sending payment reminders for unpaid invoices.

**Variables:**
- `{{invoice_id}}` - The invoice ID
- `{{customer_name}}` - Customer's name
- `{{company_name}}` - Customer's company
- `{{amount_due}}` - Amount still due
- `{{due_date}}` - Original due date
- `{{days_overdue}}` - Number of days overdue
- `{{sales_rep_name}}` - Sales representative name
- `{{sales_rep_email}}` - Sales rep email
- `{{sales_rep_phone}}` - Phone number (253-922-5793)

**Sample Template HTML:**
```html
<h3>Payment Reminder - Invoice {{invoice_id}}</h3>

<p>Dear {{customer_name}},</p>

<p>This is a friendly reminder that invoice {{invoice_id}} for ${{amount_due}} is {{days_overdue}} days past due.</p>

<p>Original due date: {{due_date}}</p>

<p>Please contact us if you have any questions or if payment has already been sent.</p>

<p>Thank you,<br>
{{sales_rep_name}}<br>
{{sales_rep_email}}<br>
{{sales_rep_phone}}</p>
```

### 3. art_approval_reminder (Artwork Approval Reminder)
This template is for reminding customers to approve artwork that has been waiting.

**Variables:**
- `{{id_design}}` - Design ID number
- `{{company_name}}` - Customer's company
- `{{customer_name}}` - Customer's name
- `{{days_waiting}}` - Number of working days waiting
- `{{request_date}}` - Original request date
- `{{artist_name}}` - Artist name (Steve Deland)
- `{{sales_rep_name}}` - Sales representative name
- `{{sales_rep_email}}` - Sales rep email
- `{{sales_rep_phone}}` - Phone number

**Sample Template HTML:**
```html
<h3>Artwork Approval Needed - Design #{{id_design}}</h3>

<p>Dear {{customer_name}},</p>

<p>Your artwork for {{company_name}} (Design #{{id_design}}) has been waiting for approval for {{days_waiting}} working days.</p>

<p>The artwork was completed on {{request_date}} and is ready for your review.</p>

<p>Please log in to review and approve your artwork so we can proceed with your order.</p>

<p>If you have any questions, please contact us.</p>

<p>Best regards,<br>
{{sales_rep_name}}<br>
{{sales_rep_email}}<br>
{{sales_rep_phone}}</p>
```

## Setting Up Templates

1. Log in to your EmailJS dashboard
2. Create a new email template
3. Use the template IDs exactly as shown above:
   - `art_invoice`
   - `art_invoice_reminder`
   - `art_approval_reminder`
4. Set up the email routing:
   - To Email: `{{to_email}}`
   - From Name: `{{from_name}}`
   - Reply To: `{{reply_to}}`
   - CC: `{{reply_to}}` (optional)
   - BCC: `erik@nwcustomapparel.com` (for tracking)

## Testing

After creating the templates, test them by:
1. Creating a test invoice and sending it
2. Using the Send Reminder button on a sent invoice
3. Using the Remind button on an old awaiting approval request

## Notes

- All phone numbers should use: 253-922-5793
- Company year is: 1977
- Default artist is: Steve Deland (art@nwcustomapparel.com)
- Make sure all variables in your template match exactly (case-sensitive)