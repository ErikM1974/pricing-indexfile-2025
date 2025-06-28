# IMPORTANT: CSS Updates Applied

## Updated Files
I've updated your pricing pages with the new green theme (#3a7c52) matching your mockup:

1. **DTF Pricing**: `dtf-pricing-v2.html` - NOW UPDATED with green header
2. **Screen Print Pricing**: `screen-print-pricing-v2.html` - NOW UPDATED with green colors
3. **New Versions Created**: 
   - `dtf-pricing-v3.html`
   - `screen-print-pricing-v3.html`
   - `embroidery-pricing-v2.html`
   - `cap-embroidery-pricing-v2.html`

## How to View the Updates

### Option 1: Local File Viewing
If viewing files directly from your computer (file:// protocol):
- The CSS paths have been updated to use relative paths
- Critical styles have been inlined to ensure the green header appears
- Open `css-diagnostic.html` to test if CSS is loading properly

### Option 2: Web Server
If viewing through a web server:
- All paths should work correctly
- External CSS files will load and apply full styling

## What's Changed

### Visual Updates
- **Header**: Green gradient background (#3a7c52 to #2d5f3f)
- **Buttons**: All primary buttons now use #3a7c52
- **Accents**: All green colors updated from old #2e5827 to new #3a7c52
- **Layout**: Professional header with contact info and navigation

### Technical Updates
- Added `universal-theme` class to body
- Included new universal CSS files
- Maintained all calculator functionality
- Added inline critical CSS as fallback

## Testing Your Pages

1. Open `dtf-pricing-v2.html` - Should show green header, not blue
2. Open `screen-print-pricing-v2.html` - Should show updated green colors
3. Test calculator functionality - Everything should work as before

## Troubleshooting

If you still see the old blue header:
1. Clear your browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Check that you're viewing the correct file
3. Open `css-diagnostic.html` to verify CSS loading
4. Try viewing in an incognito/private window

## Files Created

### CSS Files
- `shared_components/css/universal-pricing-header.css`
- `shared_components/css/universal-pricing-layout.css`
- `shared_components/css/universal-calculator-theme.css`
- `shared_components/css/universal-pricing-components.css`

### Backup Files
All original files backed up with `-backup` suffix

## Next Steps
1. Test all calculator functions
2. Verify mobile responsiveness
3. Apply same updates to remaining pages if satisfied