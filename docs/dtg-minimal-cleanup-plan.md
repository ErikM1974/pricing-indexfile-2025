# DTG Minimal Cleanup Plan

## Current Status
The DTG pricing page works but needs the master bundle message from Caspio iframe to display pricing. The message is being sent but not received by the adapter.

## Safe Files to Remove
These files are definitely not used in production:

1. **Backup/Test Pages** (can remove):
   - `dtg-pricing-backup.html` - Old backup
   - `restore-dtg-original.js` - Restoration script
   
2. **Test Files** (move to test-files/):
   - All `test-dtg-*.html` files in root
   - `debug-dtg-updates.html`

## Files That MUST Stay
These are required for DTG to function:

1. **Main Page**:
   - `dtg-pricing.html` - The production page

2. **Core JS** (all needed):
   - `dtg-adapter.js` - Handles Caspio integration
   - `dtg-config.js` - Configuration
   - `dtg-integration.js` - Component orchestration  
   - `dtg-page-setup.js` - Page initialization
   - `pricing-matrix-capture-fix.js` - DTG-specific fixes

3. **Potentially Used**:
   - `dtg-pricing-refactored.html` - Keep for now, may be in use
   - `dtg-quote-system.js` - Keep for now, may be used by refactored page
   - `pricing-matrix-capture-dtg-fix.js` - Keep for now

## Next Steps
1. Only remove the definitely unused backup files
2. Move test files to test-files directory
3. Leave everything else until we can verify what's actually in use
4. Focus on fixing the Caspio message issue instead of cleanup