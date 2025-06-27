# Laser Tumbler EmailJS Template Setup Guide

## 1. EmailJS Template HTML
The complete HTML template is saved in: `laser-tumbler-emailjs-template.html`

**Copy the entire contents of that file and paste into your EmailJS template editor.**

## 2. EmailJS Configuration Settings

### Template Settings:
- **To Email**: `{{to_email}}`
- **From Name**: `{{from_name}}`
- **From Email**: Use Default Email Address
- **Reply To**: `{{reply_to}}`
- **CC**: `{{reply_to}}`
- **BCC**: `erik@nwcustomapparel.com`

### Subject Line:
```
Laser Tumbler Quote #{{quote_id}} - Northwest Custom Apparel
```

## 3. Required Variables (ALL must be provided by the calculator)

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{{to_email}}` | customer@example.com | Customer's email |
| `{{reply_to}}` | ruth@nwcustomapparel.com | Sales rep's email |
| `{{from_name}}` | Northwest Custom Apparel | Always this value |
| `{{customer_name}}` | John Smith | Customer's name |
| `{{quote_id}}` | LT0127-1 | Unique quote ID |
| `{{quote_date}}` | 1/27/2025 | Current date |
| `{{quote_type}}` | Laser Tumbler | Always "Laser Tumbler" |
| `{{project_name}}` | Company Event Tumblers | Project description |
| `{{service_type}}` | Polar Camel 16 oz. Pint - Laser Engraved | Service description |
| `{{quantity}}` | 48 | Number of tumblers |
| `{{locations}}` | 1-Sided Laser Engraving \| Colors: Black (LTM752) - 24 units, Green (LTM765) - 24 units | Color breakdown |
| `{{price_per_piece}}` | $16.68 | Unit price formatted |
| `{{subtotal}}` | $800.64 | Subtotal formatted |
| `{{special_note}}` | Includes one-time setup fee ($75.00) | Note about fees |
| `{{grand_total}}` | $875.64 | Total formatted |
| `{{notes}}` | No special notes for this order | Customer notes |
| `{{sales_rep_name}}` | Ruth Nhong | Rep's name |
| `{{sales_rep_email}}` | ruth@nwcustomapparel.com | Rep's email |
| `{{sales_rep_phone}}` | 253-922-5793 | Always this number |
| `{{company_year}}` | 1977 | Always 1977 |

## 4. Database Integration Status ✅

The laser tumbler calculator now includes:
- Database save functionality via `LaserTumblerQuoteService`
- "Save quote to database" checkbox (checked by default)
- Quote ID generation format: `LT{MMDD}-{sequence}`
- Saves to Caspio tables: `laser_tumbler_quotes`

### Database Fields Saved:
- Quote_ID
- Quote_Date
- Customer details (name, email, phone, company)
- Product details (quantity, colors, pricing)
- Sales rep information
- Notes

## 5. Testing Checklist

Before going live:
- [ ] Create the EmailJS template with the HTML provided
- [ ] Set all configuration options as listed above
- [ ] Test with a real quote
- [ ] Verify logo appears correctly
- [ ] Check color breakdown displays properly
- [ ] Confirm database save works
- [ ] Verify sales rep gets CC'd
- [ ] Confirm Erik gets BCC'd

## 6. Common Issues & Solutions

### "Corrupted Variables" Error
**Cause**: Missing `quote_type` variable
**Solution**: Already fixed in the calculator code

### Database Save Fails
**Cause**: API endpoint or authentication issue
**Solution**: Check console for specific error, verify Caspio proxy is running

### Email Not Sending
**Cause**: Wrong template ID
**Solution**: Update template ID in code to match your new template

## 7. Implementation Complete!

The laser tumbler calculator now has:
1. ✅ Complete EmailJS integration with all required variables
2. ✅ Professional HTML email template
3. ✅ Database save functionality
4. ✅ Save to database checkbox
5. ✅ Proper error handling
6. ✅ All corruption issues prevented

**Next Steps:**
1. Create the EmailJS template using the provided HTML
2. Update the template ID in the code if different from `template_6bie1il`
3. Test the complete flow