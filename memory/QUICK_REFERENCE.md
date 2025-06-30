# Quick Reference for NWCA Calculators

## Essential URLs & Credentials
```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
Company Logo: https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1
Favicon: https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793
Company Year: 1977
```

## Quote ID Patterns
```
DTG{MMDD}-{sequence}     // DTG Contract
RICH{MMDD}-{sequence}    // Richardson Caps
EMB{MMDD}-{sequence}     // Embroidery Contract
EMBC{MMDD}-{sequence}    // Customer Supplied Embroidery
EMBC-AO{MMDD}-{sequence} // Customer Supplied Add-on Order
EMBC-PA{MMDD}-{sequence} // Customer Supplied Program Account
LT{MMDD}-{sequence}      // Laser Tumblers
PATCH{MMDD}-{sequence}   // Embroidered Emblems
SPC{MMDD}-{sequence}     // Customer Supplied Screen Print
```

## Required Email Variables (EVERY Calculator)
```javascript
{
    // System
    to_email, reply_to, from_name,
    
    // Quote
    quote_type,  // NOT {{PLACEHOLDER}}!
    quote_id, quote_date,
    
    // Customer
    customer_name, project_name,
    
    // Pricing
    grand_total,
    
    // Sales Rep
    sales_rep_name, sales_rep_email, sales_rep_phone,
    
    // Company
    company_year,
    
    // Optional with defaults
    special_note: note || '',
    notes: notes || 'No special notes for this order'
}
```

## Staff Email Directory

```javascript
const salesRepEmails = {
    'sales@nwcustomapparel.com': 'General Sales',
    'ruth@nwcustomapparel.com': 'Ruth Nhong',
    'taylar@nwcustomapparel.com': 'Taylar Hanson',
    'nika@nwcustomapparel.com': 'Nika Lao',
    'erik@nwcustomapparel.com': 'Erik Mickelson',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'bradley@nwcustomapparel.com': 'Bradley Wright',
    'jim@nwcustomapparel.com': 'Jim Mickelson',
    'art@nwcustomapparel.com': 'Steve Deland'
};
```

## Console Debug Commands
```javascript
// Check calculator initialization
console.log(window.[name]Calculator);

// Test quote ID generation
console.log(new [Name]QuoteService().generateQuoteID());

// View current quote data
console.log(window.[name]Calculator.currentQuote);

// Debug email data
console.log('Email data:', emailData);

// Check quote data
console.log(window.nwcaMasterBundleData);

// Check current quote after calculation
console.log(window.[name]Calculator.currentQuote);
```

## Git Workflow
```bash
git add -A
git commit -m "feat: Add [name] calculator with quote system"
git push origin [branch-name]
```

## Common Fixes
- **Corrupted variables**: Add missing variables with defaults
- **Database not saving**: Check endpoint and field names
- **Quote ID not showing**: Add display element in success message
- **Wrong template**: Use template ID, not name

## Implementation Checklist Summary

### Before Starting
- [ ] Gathered ALL required information
- [ ] Have EmailJS template ID (if existing)
- [ ] Understand pricing logic completely
- [ ] Know which dashboard section

### During Development
- [ ] Using standard file structure
- [ ] Following naming conventions
- [ ] Including all required scripts
- [ ] Implementing two-table database pattern
- [ ] Providing ALL email variables

### Before Going Live
- [ ] All console tests pass
- [ ] Email sends correctly
- [ ] Database saves properly
- [ ] Quote ID displays to user
- [ ] No placeholder text anywhere
- [ ] Documentation updated

## Final Reminders

1. **ALWAYS ASK FOR TEMPLATE ID** - Not the template name
2. **ALWAYS USE TWO-TABLE STRUCTURE** - quote_sessions + quote_items
3. **ALWAYS SHOW QUOTE ID** - Users need to see it
4. **ALWAYS PROVIDE ALL VARIABLES** - No undefined/null values
5. **ALWAYS TEST IN CONSOLE** - Before declaring complete

## Quick Email Routing Reference
```
To Email: {{to_email}}           // Customer's email
From Name: {{from_name}}         // "Northwest Custom Apparel"
From Email: Use Default          // Your EmailJS sender
Reply To: {{reply_to}}           // Sales rep's email
CC: {{reply_to}}                 // Sales rep gets a copy
BCC: erik@nwcustomapparel.com   // Erik always gets a copy
```

## Common Pitfalls to Avoid

1. **Script Tag in Template Literals**: Always escape closing tags with `<\/script>`
2. **Wrong Colors**: Use NWCA green (#4cb354), never teal (#0d9488)
3. **Missing Pricing Details**: Show breakdown by location/component when applicable
4. **EmailJS Template Variables**: Never use placeholders like {{PLACEHOLDER}}
5. **Database Structure**: Always use quote_sessions + quote_items (two tables)

## Calculator Implementation Status

| Calculator | File | Quote Prefix | EmailJS Template | Status |
|------------|------|--------------|------------------|--------|
| DTG Contract | dtg-contract.html | DTG | template_xxxx | ✅ Active |
| Richardson Caps | richardson-new.html | RICH | template_f5q2ym5 | ✅ Active |
| Embroidery Contract | embroidery-contract.html | EMB | template_xxxx | ✅ Active |
| Customer Embroidery | embroidery-customer.html | EMBC | template_cj8u7rl | ✅ Active |
| Laser Tumblers | laser-tumbler.html | LT | template_6bie1il | ✅ Active |
| Embroidered Emblems | embroidered-emblems.html | PATCH | template_94rbfol | ✅ Active |
| Customer Screen Print | screenprint-customer.html | SPC | template_igd6jtm | ✅ Active |

Remember: When in doubt, check this documentation first!