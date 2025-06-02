// DTG Loading Restoration Script
// Run this in browser console to restore original loading if needed

function restoreDTGOriginalLoading() {
    console.log('Restoring DTG to original loading experience...');
    
    // If you want to revert, just copy dtg-pricing-backup.html back to dtg-pricing.html
    alert('To restore original DTG loading:\n\n1. The backup is saved as: dtg-pricing-backup.html\n2. Copy that file back to dtg-pricing.html\n3. Refresh the page\n\nOr ask Claude to restore it for you!');
}

// Auto-run info
console.log('DTG Enhanced Loading Test Mode');
console.log('- Backup saved as: dtg-pricing-backup.html'); 
console.log('- Run restoreDTGOriginalLoading() to get restore instructions');
console.log('- The enhanced version includes:');
console.log('  • Skeleton loading animation');
console.log('  • Progress bar with steps');
console.log('  • Enhanced spinner with pulse effect');
console.log('  • Simulated loading stages');

window.restoreDTGOriginalLoading = restoreDTGOriginalLoading;