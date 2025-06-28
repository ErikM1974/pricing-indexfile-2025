# Troubleshooting Guide for NWCA Calculators

## Common Pitfalls & Solutions

### EmailJS Corruption
**Problem**: "One or more dynamic variables are corrupted"
**Causes & Fixes**:
1. Missing `quote_type` variable → Always include it
2. Undefined variables → Use `|| ''` for optional fields
3. Wrong template ID → Use ID, not name
4. Placeholder text → Never use {{PLACEHOLDER}}

### Database Not Saving
**Problem**: Quotes not appearing in Caspio
**Causes & Fixes**:
1. Wrong endpoint → Use `/api/quote_sessions` not custom tables
2. Missing fields → Check all required fields are provided
3. Data type mismatch → Numbers must be parsed: `parseFloat()`
4. Date format → Use ISO format with fix: `.replace(/\.\d{3}Z$/, '')`

### Quote ID Not Showing
**Problem**: Users don't see their quote ID
**Fix**: Always display in success message:
```javascript
const quoteIdDisplay = document.getElementById('quoteIdDisplay');
if (quoteIdDisplay) {
    quoteIdDisplay.textContent = `Quote ID: ${quoteId}`;
}
```

### Wrong Table Structure
**Problem**: Trying to use single table instead of two
**Fix**: Always use quote_sessions + quote_items pattern

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
```

## Common Fixes

### EmailJS "Corrupted Variables" Error
```javascript
// Always provide ALL variables with defaults
const emailData = {
    notes: notes || '',                    // Never undefined
    company_name: company || 'Not Provided', // Never null
    quote_type: 'Calculator Name',         // Never placeholder
};
```

### Database Save Failing
- Check API endpoint: `/api/quote_sessions` and `/api/quote_items`
- Verify all required fields are present
- Use `parseFloat()` for numbers, remove milliseconds from dates
- Check console for detailed error messages

### Quote ID Not Showing
```html
<!-- In success message -->
<span id="quoteIdDisplay"></span>

<!-- In JavaScript -->
document.getElementById('quoteIdDisplay').textContent = `Quote ID: ${quoteId}`;
```

## Lessons Learned - Laser Tumbler Implementation

### What Went Wrong & How We Fixed It

#### 1. EmailJS Template Corruption
**Issue**: "One or more dynamic variables are corrupted" error
**Root Cause**: Missing `quote_type` variable in email data
**Solution**: Added `quote_type: 'Laser Tumbler'` to emailData object
**Lesson**: ALWAYS provide every variable referenced in the template

#### 2. Database Not Saving
**Issue**: Quotes weren't appearing in Caspio database
**Root Cause**: Using wrong table endpoint (`/tables/laser_tumbler_quotes` instead of `/api/quote_sessions`)
**Solution**: Rewrote quote service to use standard two-table pattern
**Lesson**: ALWAYS use the standard quote_sessions + quote_items structure

#### 3. Quote ID Not Visible
**Issue**: Users couldn't see their quote ID after saving
**Root Cause**: No display element for quote ID in success message
**Solution**: Added quote ID display in success message HTML
**Lesson**: ALWAYS show the quote ID prominently after saving

#### 4. Template ID Confusion
**Issue**: Spent time debugging wrong template reference
**Root Cause**: Used template name instead of template ID
**Solution**: Updated to use actual template ID from EmailJS
**Lesson**: ALWAYS ask for template ID upfront, not the name

### Key Takeaways for Future Implementations

1. **Start with Information Gathering**
   - Get ALL details before writing code
   - Especially EmailJS template ID
   - Understand exact pricing structure

2. **Follow Standard Patterns**
   - Two-table database structure is mandatory
   - Quote ID format must be consistent
   - Email variables must match exactly

3. **Test Incrementally**
   - Check console after each major step
   - Verify data structure before sending
   - Test with minimal data first

4. **User Experience Matters**
   - Always show quote ID
   - Provide clear success/error messages
   - Include "Save to Database" option

5. **Documentation is Critical**
   - Update CLAUDE.md immediately
   - Include all template IDs
   - Document any special features

## Testing Checklist

### Before Going Live
- [ ] Calculator loads without console errors
- [ ] Pricing calculations are accurate
- [ ] Quote displays correctly
- [ ] Email sends with all variables
- [ ] Database saves both tables
- [ ] Quote ID shows in success message
- [ ] Print functionality works

### Functional Testing
- [ ] Form validation prevents invalid input
- [ ] Calculations match expected values
- [ ] Results display with correct formatting
- [ ] Email modal opens and closes properly
- [ ] Sales rep dropdown shows all staff
- [ ] Quote preview shows correct data
- [ ] Email sends successfully
- [ ] Database save works (check console)
- [ ] Print function generates clean PDF

### EmailJS Testing
1. Send test email to yourself
2. Verify all variables render correctly
3. Check no placeholder text appears
4. Confirm CC and BCC recipients

### Database Verification
```javascript
// After saving, check console for:
"[Service] Quote saved successfully: [PREFIX]0127-1"
```

## Error Prevention

### Common Issues to Avoid
1. **Missing HTML escaping**: Always escape user input in HTML
2. **Incorrect date formats**: Use `toISOString()` for Caspio
3. **Missing required fields**: Validate before submission
4. **Cross-origin issues**: Test auth features on production

### Contact Information Standards
**Phone Number**: Always use **253-922-5793**
- Format: XXX-XXX-XXXX (with hyphens)
- Consistent across all templates and calculators
- Update any instances of old numbers

## Final Tips

1. **Read the console logs** - They tell you exactly what's happening
2. **Check for existing patterns** - This codebase follows consistent patterns
3. **Test incrementally** - Make small changes and test
4. **Document your changes** - Future developers (and AIs) will thank you
5. **When in doubt, check window.nwcaMasterBundleData** - It's the source of truth

Remember: The most common issues are component conflicts and missing containers. Always check these first!