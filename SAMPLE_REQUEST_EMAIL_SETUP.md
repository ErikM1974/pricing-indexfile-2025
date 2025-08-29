# Sample Request Email Confirmation Setup Guide

## Overview
This guide will help you set up the EmailJS template for automatic sample request confirmation emails.

## Step 1: Log into EmailJS
1. Go to https://www.emailjs.com/
2. Log in with your account credentials
3. Navigate to "Email Templates" section

## Step 2: Create New Template
1. Click "Create New Template"
2. Name it: **"Sample Request Confirmation"**
3. Template ID will be generated automatically (looks like `template_xxxxxxx`)

## Step 3: Configure Email Settings

### Basic Settings:
- **To Email:** `{{customer_email}}`
- **From Name:** `{{from_name}}`
- **Reply To:** `{{reply_to}}`
- **CC:** `sales@nwcustomapparel.com`
- **BCC:** `erik@nwcustomapparel.com`
- **Subject:** `Sample Request {{request_id}} - Northwest Custom Apparel`

## Step 4: Copy HTML Template
1. Open the file `sample-request-email-template.html` 
2. Copy ALL the HTML content
3. Paste it into the EmailJS template editor
4. Save the template

## Step 5: Update Code with Template ID
1. Open `top-sellers-showcase.html`
2. Find line ~365 (in the SampleRequestService constructor)
3. Replace `'template_sample_request'` with your actual template ID
4. Example: `templateId: 'template_abc123xyz'`

## Step 6: Test the System

### Test with Free Sample:
1. Add a free sample to cart
2. Submit request with pickup option
3. Check that email is received

### Test with Paid Sample:
1. Add a paid sample to cart
2. Submit request with shipping option
3. Verify cost breakdown in email

## Email Variables Reference

All these variables are automatically populated by the system:

### Customer Information:
- `{{customer_name}}` - Customer's full name
- `{{customer_email}}` - Customer's email address
- `{{customer_phone}}` - Phone number
- `{{company_name}}` - Company name

### Order Details:
- `{{request_id}}` - Unique request ID (e.g., SR0829-123abc)
- `{{request_date}}` - Date of request
- `{{sample_count}}` - Number of samples
- `{{delivery_method}}` - "Ship" or "Pickup"

### Sample Items:
- `{{{samples_html}}}` - HTML table of requested samples (use triple braces!)

### Shipping Information:
- `{{shipping_address}}` - Street address
- `{{shipping_city}}` - City
- `{{shipping_state}}` - State
- `{{shipping_zip}}` - ZIP code
- `{{shipping_info}}` - Complete formatted address

### Cost Breakdown:
- `{{samples_cost}}` - Cost of samples
- `{{shipping_cost}}` - Shipping cost ($10 or $0)
- `{{tax_amount}}` - Sales tax (10.1%)
- `{{total_amount}}` - Grand total

### Project Details:
- `{{project_type}}` - Type of project (e.g., "Screen Printing")
- `{{estimated_quantity}}` - Estimated order quantity
- `{{timeline}}` - Project timeline
- `{{notes}}` - Customer notes

### System Variables:
- `{{company_year}}` - "1977"
- `{{company_phone}}` - "253-922-5793"
- `{{next_steps}}` - Next steps message
- `{{delivery_timeline}}` - Delivery timeline message

## Troubleshooting

### Email Not Sending:
1. Check browser console for errors
2. Verify template ID is correct
3. Ensure EmailJS service is active
4. Check EmailJS dashboard for quota limits

### Variables Not Displaying:
1. Ensure all variable names match exactly
2. Use double braces `{{variable}}` for text
3. Use triple braces `{{{html_content}}}` for HTML
4. Check for typos in variable names

### Wrong Recipients:
1. Verify CC and BCC are set correctly in template
2. Check that customer email is valid
3. Ensure reply_to is set to sales@nwcustomapparel.com

## Testing Checklist

- [ ] Free sample with pickup - email received
- [ ] Free sample with shipping - email received with address
- [ ] Paid sample with pickup - email shows costs
- [ ] Paid sample with shipping - email shows all costs and address
- [ ] CC to sales team working
- [ ] BCC to Erik working
- [ ] Reply-to goes to sales team
- [ ] Sample items table displays correctly
- [ ] All project details shown
- [ ] Next steps message appropriate for order type

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify the EmailJS dashboard shows the email was sent
3. Check spam folders for test emails
4. Contact EmailJS support if service issues persist

## Important Notes

- Emails are sent AFTER the database save succeeds
- If email fails, the sample request is still saved (non-blocking)
- Customer always sees success message with Request ID
- All costs include 10.1% Milton sales tax
- Shipping is flat $10 when selected
- Template uses NWCA green (#4cb354) for branding

## Next Steps

After setup is complete:
1. Send a few test orders
2. Verify all recipients receive emails
3. Check email formatting on different clients (Gmail, Outlook, etc.)
4. Monitor for any customer feedback
5. Adjust template styling if needed

Remember to update the template ID in the code once you've created the EmailJS template!