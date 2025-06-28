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
DTG{MMDD}-{sequence}    // DTG Contract
RICH{MMDD}-{sequence}   // Richardson Caps
EMB{MMDD}-{sequence}    // Embroidery Contract
LT{MMDD}-{sequence}     // Laser Tumblers
PATCH{MMDD}-{sequence}  // Embroidered Emblems
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
    'erik@nwcustomapparel.com': 'Erik',
    'nika@nwcustomapparel.com': 'Nika',
    'taylar@nwcustomapparel.com': 'Taylar',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'ruth@nwcustomapparel.com': 'Ruth Nhong',
    'ruthie@nwcustomapparel.com': 'Ruthie',
    'bradley@nwcustomapparel.com': 'Bradley',
    'jim@nwcustomapparel.com': 'Jim',
    'art@nwcustomapparel.com': 'Steve (Artist)',
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
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

Remember: When in doubt, check this documentation first!