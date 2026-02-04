/**
 * Cleanup Duplicate Service Codes from Caspio
 *
 * Removes duplicate entries from Service_Codes table,
 * keeping only the first (oldest) entry for each ServiceCode + TierLabel combo.
 *
 * Usage: node tests/scripts/cleanup-duplicate-service-codes.js
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('='.repeat(60));
    console.log('CLEANUP DUPLICATE SERVICE CODES');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(60));
    console.log('');

    // 1. Fetch all service codes
    console.log('Fetching all service codes...');
    const response = await fetch(`${API_BASE_URL}/api/service-codes?refresh=true&active=all`);
    const result = await response.json();

    if (!result.success) {
        console.log('ERROR: Failed to fetch service codes');
        console.log(result);
        return;
    }

    const codes = result.data;
    console.log(`Found ${codes.length} service codes`);
    console.log('');

    // 2. Group by ServiceCode + TierLabel and find duplicates
    const byKey = {};
    for (const sc of codes) {
        const key = `${sc.ServiceCode}|${sc.TierLabel || ''}`;
        if (!byKey[key]) {
            byKey[key] = [];
        }
        byKey[key].push(sc);
    }

    // 3. Identify duplicates (keep first, delete rest)
    const toDelete = [];
    for (const [key, entries] of Object.entries(byKey)) {
        if (entries.length > 1) {
            // Sort by PK_ID ascending (oldest first)
            entries.sort((a, b) => a.PK_ID - b.PK_ID);
            // Keep first, mark rest for deletion
            const keep = entries[0];
            const dupes = entries.slice(1);
            console.log(`${key}: keeping ID ${keep.PK_ID}, deleting ${dupes.length} duplicates`);
            toDelete.push(...dupes);
        }
    }

    console.log('');
    console.log(`Total duplicates to delete: ${toDelete.length}`);
    console.log('');

    if (toDelete.length === 0) {
        console.log('No duplicates found. Database is clean!');
        return;
    }

    // 4. Delete duplicates (hard delete)
    let deleted = 0;
    let failed = 0;

    for (const code of toDelete) {
        try {
            const delResponse = await fetch(
                `${API_BASE_URL}/api/service-codes/${code.PK_ID}?hard=true`,
                { method: 'DELETE' }
            );
            const delResult = await delResponse.json();

            if (delResult.success) {
                deleted++;
                console.log(`  ✓ Deleted ${code.ServiceCode}|${code.TierLabel || 'FLAT'} (ID: ${code.PK_ID})`);
            } else {
                failed++;
                console.log(`  ✗ Failed to delete ${code.ServiceCode} (ID: ${code.PK_ID}): ${delResult.error}`);
            }
        } catch (err) {
            failed++;
            console.log(`  ✗ Error deleting ${code.ServiceCode}: ${err.message}`);
        }

        // Delay to avoid rate limiting (1.5s between requests)
        await sleep(1500);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);
}

main().catch(console.error);
