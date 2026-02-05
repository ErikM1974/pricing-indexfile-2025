/**
 * Cleanup Service_Codes Table - Remove Duplicates
 *
 * Removes service codes that are duplicated in Embroidery_Costs table.
 *
 * Usage: node tests/scripts/cleanup-service-codes.js
 *
 * Created: 2026-02-04
 */

const API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Service codes to DELETE (duplicated in Embroidery_Costs)
const CODES_TO_DELETE = [
    'AL',              // Duplicated in Embroidery_Costs AL ItemType
    'CB',              // Deprecated - use AL-CAP
    'CS',              // Deprecated - use AL-CAP
    'FB',              // Duplicated in Embroidery_Costs FB ItemType
    'CEMB',            // Same as Shirt ItemType
    'CEMB-CAP',        // Same as Cap ItemType
    'DECG',            // Duplicated in DECG-Garmt
    'DECC',            // Duplicated in DECG-Cap
    'STITCH-RATE',     // Embedded in calculations
    'CAP-STITCH-RATE', // Embedded in calculations
    'PUFF-UPCHARGE',   // Same as 3D-Puff
    'PATCH-UPCHARGE',  // Same as Patch
    'AS-GARM',         // Same as STITCH-RATE
    'AS-CAP'           // Same as CAP-STITCH-RATE
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('='.repeat(60));
    console.log('SERVICE_CODES CLEANUP - Remove Duplicates');
    console.log('='.repeat(60));
    console.log('');

    // Fetch all service codes
    console.log('Fetching service codes from API...');
    const resp = await fetch(`${API}/api/service-codes`);
    const data = await resp.json();

    const records = data.records || data.data || [];
    if (records.length === 0) {
        console.log('Error: No records in response');
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    console.log(`Total records in table: ${records.length}`);
    console.log('');

    // Find records to delete
    const toDelete = records.filter(r => CODES_TO_DELETE.includes(r.ServiceCode));
    console.log(`Records to delete: ${toDelete.length}`);
    console.log('');

    // Group by service code for display
    const grouped = {};
    toDelete.forEach(r => {
        if (!grouped[r.ServiceCode]) grouped[r.ServiceCode] = [];
        grouped[r.ServiceCode].push(r);
    });

    console.log('By ServiceCode:');
    Object.entries(grouped).forEach(([code, recs]) => {
        console.log(`  ${code}: ${recs.length} records`);
    });
    console.log('');

    // Delete each record (hard delete)
    console.log('Deleting records...');
    console.log('');

    let deleted = 0;
    let failed = 0;

    for (const record of toDelete) {
        const label = `${record.ServiceCode}|${record.TierLabel || 'ALL'}`;
        try {
            const delResp = await fetch(`${API}/api/service-codes/${record.PK_ID}?hard=true`, {
                method: 'DELETE'
            });
            const delData = await delResp.json();

            if (delData.success) {
                console.log(`  ✅ Deleted: ${label} (PK_ID=${record.PK_ID})`);
                deleted++;
            } else {
                console.log(`  ❌ Failed: ${label} - ${delData.error || 'Unknown error'}`);
                failed++;
            }
        } catch (err) {
            console.log(`  ❌ Error: ${label} - ${err.message}`);
            failed++;
        }

        // Small delay to avoid rate limiting
        await sleep(200);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);
    console.log(`Remaining in table: ${records.length - deleted}`);
    console.log('');

    // List what was kept
    const kept = records.filter(r => !CODES_TO_DELETE.includes(r.ServiceCode));
    console.log('Records KEPT (unique to Service_Codes):');
    const keptCodes = [...new Set(kept.map(r => r.ServiceCode))];
    keptCodes.forEach(code => {
        const count = kept.filter(r => r.ServiceCode === code).length;
        console.log(`  ${code}: ${count} record(s)`);
    });

    console.log('');
    console.log('Done!');
}

main().catch(console.error);
