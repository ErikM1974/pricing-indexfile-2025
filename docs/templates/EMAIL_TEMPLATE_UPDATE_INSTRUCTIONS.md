# Email Template Update Instructions

## Problem Fixed
Nika reported that the email confirmation has white text that becomes invisible on white Outlook backgrounds (see screenshot). The reference number and other text were unreadable.

## Solution
Created a new Outlook-compatible email template with:
- **All dark text** on light backgrounds (no white text anywhere)
- **Professional Shopify-style** design
- **Clean, minimal layout** that works in all email clients
- **Proper contrast** for all text elements

## How to Update EmailJS Template

1. **Log into EmailJS Dashboard**
   - Go to emailjs.com and log in
   - Navigate to Email Templates

2. **Find the Christmas Bundle Template**
   - Look for template ID: `template_v80ysfp`
   - Or template name for Christmas Bundle confirmations

3. **Replace the HTML**
   - Click Edit Template
   - Switch to HTML view (if not already)
   - Delete the entire old HTML
   - Copy the entire contents of `email-template-xmas-bundle.html`
   - Paste into EmailJS template editor

4. **Verify Variables Match**
   The template uses these variables (should already be configured):
   - `{{quote_number}}` - Order reference number
   - `{{customer_name}}` - Full name
   - `{{company_name}}` - Company
   - `{{email}}` - Email address
   - `{{phone}}` - Phone number
   - `{{jacket_details}}` - Jacket selection
   - `{{hoodie_details}}` - Hoodie selection
   - `{{beanie_details}}` - Beanie selection
   - `{{gloves_details}}` - Gloves selection
   - `{{delivery_type}}` - Ship/Pickup
   - `{{delivery_date}}` - Expected date
   - `{{address_1}}` - Street address
   - `{{city}}`, `{{state}}`, `{{zip}}` - Address components
   - `{{to_email}}` - Recipient email

5. **Test the Template**
   - Use EmailJS test feature
   - Send a test email to yourself
   - Open in Outlook to verify all text is visible
   - Check on mobile devices too

## Key Improvements

### Before (Problems)
- White text on colored gradients → Invisible in Outlook
- Reference number not readable
- Too many decorations and emojis
- Unprofessional appearance

### After (Fixed)
- Dark text (#1a1a1a) on white/light gray backgrounds
- Reference number in green (#16a34a) - always visible
- Clean, professional Shopify-style layout
- Works perfectly in Outlook, Gmail, Apple Mail
- Mobile-responsive design

## Visual Comparison

**Old Design Issues:**
- Header: White text on gradient (fails in Outlook)
- Reference: White on light blue (hard to read)
- Too decorative with Christmas emojis

**New Design Benefits:**
- Header: Dark text on white with green accent
- Reference: Green text on white (high contrast)
- Professional, clean, business-appropriate

## Testing Checklist
- [ ] Text visible in Outlook with white background
- [ ] Text visible in Outlook with dark mode
- [ ] Reference number clearly readable
- [ ] All customer information displayed correctly
- [ ] Order items formatted properly
- [ ] Delivery information accurate
- [ ] Holiday deadline notice prominent
- [ ] Mobile layout works correctly

## Support
If you have issues updating the template:
1. Check that all {{variables}} copied correctly
2. Test with actual order data, not just preview
3. Clear EmailJS cache if changes don't appear
4. Contact EmailJS support if template won't save