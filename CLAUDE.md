# Claude Assistant Guide for NWCA Pricing System

## Project Overview

This is the Northwest Custom Apparel (NWCA) pricing system, a complex web application that handles custom pricing for various decoration methods (embroidery, screen print, DTG, etc.) on apparel products.

## Key Concepts to Understand

### 1. Master Bundle Architecture
The system uses a "Master Bundle" pattern where:
- **Caspio DataPages** handle all calculations and return complete JSON data
- **Web pages** receive this data via postMessage and render the UI
- Each decoration type has its own API endpoint and pricing logic

### 2. Common Pitfalls

**The #1 Issue**: Component conflicts between UniversalPricingGrid and page-specific implementations
- Never load both on the same page
- Always check which system is being used before making changes

**The #2 Issue**: Missing HTML containers
- Always verify required containers exist before debugging "not found" errors
- Check the console for specific container IDs

### 3. File Organization

```
/shared_components/js/
├── universal-*.js          # Generic UI components
├── embroidery-*.js         # Embroidery-specific code
├── pricing-*.js            # Core pricing infrastructure
├── dp5-helper.js           # UI utilities and helpers
└── *-integration.js        # Master bundle integrations

/[page-name]-pricing.html   # Main page files
```

## Critical Information

### API Proxy URL
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
```

### Namespace
All custom code should respect the `window.NWCA` namespace structure.

### Event Flow
1. Page loads → Caspio iframe loads
2. Caspio sends postMessage with master bundle
3. Integration script receives and transforms data
4. `pricingDataLoaded` event dispatched
5. UI components render the data

## Common Tasks

### Adding a New Decoration Type
1. Create Caspio DataPage using templates in PRICING_IMPLEMENTATION_GUIDE.md
2. Create integration script (e.g., `screenprint-master-bundle-integration.js`)
3. Create HTML page following embroidery-pricing.html pattern
4. Choose either UniversalPricingGrid OR custom implementation
5. Test with console.log(window.nwcaMasterBundleData)

### Debugging Pricing Issues
1. Check console for "container not found" errors
2. Verify master bundle data: `console.log(window.nwcaMasterBundleData)`
3. Check for component conflicts (multiple initializations)
4. Verify event flow in Network tab (postMessage)

### Modifying Pricing Logic
- **Simple changes**: Update the pricing-v3.js file
- **Complex changes**: May need to update Caspio DataPage calculations
- **Always test**: With different products, sizes, and quantities

## Code Patterns

### Checking for Master Bundle Data
```javascript
if (window.nwcaMasterBundleData) {
    // Data is available
    const pricing = window.nwcaMasterBundleData.pricing;
}
```

### Listening for Pricing Data
```javascript
document.addEventListener('pricingDataLoaded', function(event) {
    const data = event.detail;
    // Handle the data
});
```

### Container Pattern
```javascript
const container = document.getElementById('container-id');
if (!container) {
    console.error('[COMPONENT] Container not found');
    return;
}
```

## Testing Approach

1. **Unit Testing**: Use test HTML files (test-*.html) for isolated testing
2. **Console Testing**: Liberal use of console.log for debugging
3. **Data Validation**: Always check data structure matches expectations

## Style Guidelines

### Console Logging
Use prefixed logs for easy filtering:
```javascript
console.log('[COMPONENT-NAME] Message here');
```

### Error Handling
Always provide helpful error messages:
```javascript
if (!data) {
    console.error('[COMPONENT] No data provided. Expected structure: {...}');
    return;
}
```

### Comments
- Document WHY, not WHAT
- Include examples for complex data structures
- Mark TODO items clearly

## Integration Points

### With Caspio
- DataPages send data via postMessage
- Use specific event names: `caspio[TYPE]MasterBundleReady`

### With UI Components
- Transform data to match UI expectations
- Dispatch standardized events
- Store data in global variables for debugging

## Performance Considerations

1. **Caching**: API responses are cached in sessionStorage
2. **Event Debouncing**: Quantity changes are debounced
3. **Lazy Loading**: Components initialize only when needed

## Security Notes

- Never expose API keys in client-side code
- Use the proxy server for all API calls
- Validate all data from postMessage events

## Helpful Commands

### Git Workflow
```bash
git add -A
git commit -m "type: Description"
git push origin branch-name
```

### Common Commit Types
- `fix:` Bug fixes
- `feat:` New features
- `docs:` Documentation updates
- `refactor:` Code refactoring
- `test:` Test additions/updates

## Resources

- See `PRICING_IMPLEMENTATION_GUIDE.md` for detailed implementation steps
- Check test-*.html files for working examples
- Console logs are your friend - the system logs extensively

## Recently Discovered Issues (2025-01-20)

### Cap Pricing Implementation Issues (2025-01-20)
- **PROBLEM 1**: dp5-helper overwrites custom pricing tables when `pricingDataLoaded` event fires
  - **CAUSE**: dp5-helper listens to this event and rebuilds tables with `innerHTML = ''`
  - **SOLUTION**: Don't dispatch legacy `pricingDataLoaded` event from master bundle integrations
  - **ALTERNATIVE**: Set `window.directFixApplied = true` after creating table
  - **FILES AFFECTED**: `cap-master-bundle-integration.js` (removed event dispatch)
  
- **PROBLEM 2**: Table headers showing as white text on white background
  - **CAUSE**: CSS inheritance/specificity issues
  - **SOLUTION**: Force colors with `!important` in decoration-specific CSS
  - **EXAMPLE**: `.pricing-grid th { color: #586069 !important; }`
  
- **PROBLEM 3**: Console errors from shared scripts on specialized pages
  - **CAUSE**: Scripts looking for functions/elements that don't exist on pricing pages
  - **SOLUTION**: Add page-specific checks before initialization
  - **EXAMPLE**: 
    ```javascript
    if (window.location.pathname.includes('cap-embroidery')) {
        console.log('Skipping - page handles its own parameters');
        return;
    }
    ```

### Master Bundle Integration Best Practices
- **PATTERN**: Follow `cap-master-bundle-integration.js` as template
- **DATA FLOW**: Caspio iframe → postMessage → integration script → custom event → UI component
- **EVENT NAMING**: Use specific events like `capMasterBundleLoaded` not generic `pricingDataLoaded`
- **DEBUGGING**: Store data globally: `window.nwca[Type]MasterBundleData`
- **TABLE STRUCTURE**: 
  - Use single-row headers for CSS compatibility
  - Match embroidery table HTML structure exactly
  - Avoid IDs that dp5-helper searches for (`pricing-grid-container-table`)
- **CSS REQUIREMENTS**:
  - Always include `modern-pricing-table.css` first
  - Add decoration-specific CSS after (e.g., `screenprint-pricing-enhancements.css`)
  - Use green theme consistently (#3a7c52)

### Pricing Table Width Issues with Many Sizes
- **PROBLEM**: Tables with 9 size columns (S-6XL) get cramped and hard to read
- **SOLUTION**: Created `modern-pricing-table.css` with:
  - Responsive wrapper with horizontal scroll
  - Minimum column widths (80px) 
  - Card-based mobile layout
  - Sticky first column on tablet
- **REMOVED**: "POPULAR" and "BEST VALUE" badges (unnecessary clutter)
- **FILE**: `/shared_components/css/modern-pricing-table.css`

### Double Header and Layout Issues
- **PROBLEM**: Two headers (universal + enhanced), misaligned columns, excessive spacing
- **SOLUTION**: Created `embroidery-layout-fix.css` with:
  - Hide duplicate universal-header-container
  - Reduce body padding from 200px to 140px
  - CSS Grid for perfect column alignment
  - Professional card design for both columns
  - Optimized spacing throughout
- **IMPACT**: 30% header height reduction, perfect alignment, cleaner layout
- **FILE**: `/shared_components/css/embroidery-layout-fix.css`

### Caspio Authentication and Personalization (2025-01-26)
- **PROBLEM**: Displaying authenticated user's first name from Caspio DataPage
- **DISCOVERY**: Caspio outputs user data in `<dd class="cbResultSetData">Erik</dd>` elements
- **AUTHENTICATION DIFFERENCES**:
  - **Localhost**: Authentication cookies don't work due to cross-origin restrictions
  - **Production (Heroku)**: Works perfectly with proper domain and HTTPS
- **SOLUTION**: 
  ```javascript
  // Wait for Caspio to load with retry mechanism
  const caspioData = document.querySelector('.cbResultSetData');
  const firstName = caspioData?.textContent?.trim() || 'Team Member';
  ```
- **IMPLEMENTATION**: 
  - Added retry mechanism (checks every 500ms up to 10 times)
  - Personalized greetings: "Good morning/afternoon/evening, [Name]!"
  - Graceful fallback when not authenticated
- **FILES AFFECTED**: `staff-dashboard.html`
- **KEY LEARNING**: Always test authentication features on production, not just localhost

## Final Tips

1. **Read the console logs** - They tell you exactly what's happening
2. **Check for existing patterns** - This codebase follows consistent patterns
3. **Test incrementally** - Make small changes and test
4. **Document your changes** - Future developers (and AIs) will thank you
5. **When in doubt, check window.nwcaMasterBundleData** - It's the source of truth

Remember: The most common issues are component conflicts and missing containers. Always check these first!