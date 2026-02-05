/**
 * Cleanup Embroidery_Costs Table in Caspio
 *
 * This script removes duplicate/legacy records and adds missing DECG-FB 1-7 tier.
 *
 * CLEANUP ACTIONS:
 * 1. DELETE duplicate AL-CAP rows (IDs 21-24) - incomplete, wrong LTM
 * 2. DELETE duplicate AL rows at 5000 stitches (IDs 52-56) - should be 8000
 * 3. DELETE legacy CB rows (IDs 62-66) - replaced by AL-CAP
 * 4. DELETE legacy CS rows (IDs 67-71) - replaced by AL-CAP
 * 5. ADD missing DECG-FB 1-7 tier record
 *
 * Usage:
 *   DRY RUN (preview):  node tests/scripts/cleanup-embroidery-costs.js --dry-run
 *   EXECUTE:            node tests/scripts/cleanup-embroidery-costs.js
 *
 * Created: 2026-02-04
 * Documentation: /memory/EMBROIDERY_ITEM_TYPES.md
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Parse command line args
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================
// RECORDS TO DELETE (by PK_ID)
// ============================================

const RECORDS_TO_DELETE = [
    // AL-CAP duplicates (incomplete, wrong LTM=0 on 1-7 tier)
    { id: 21, itemType: 'AL-CAP', tierLabel: '1-7', reason: 'Duplicate - incomplete, LTM=0 incorrect' },
    { id: 22, itemType: 'AL-CAP', tierLabel: '24-47', reason: 'Duplicate - incomplete set' },
    { id: 23, itemType: 'AL-CAP', tierLabel: '48-71', reason: 'Duplicate - incomplete set' },
    { id: 24, itemType: 'AL-CAP', tierLabel: '72+', reason: 'Duplicate - incomplete set' },

    // AL duplicates at 5000 stitches (should be 8000)
    { id: 52, itemType: 'AL', tierLabel: '1-7', reason: 'Duplicate at wrong stitch count (5000 instead of 8000)' },
    { id: 53, itemType: 'AL', tierLabel: '8-23', reason: 'Duplicate at wrong stitch count (5000 instead of 8000)' },
    { id: 54, itemType: 'AL', tierLabel: '24-47', reason: 'Duplicate at wrong stitch count (5000 instead of 8000)' },
    { id: 55, itemType: 'AL', tierLabel: '48-71', reason: 'Duplicate at wrong stitch count (5000 instead of 8000)' },
    { id: 56, itemType: 'AL', tierLabel: '72+', reason: 'Duplicate at wrong stitch count (5000 instead of 8000)' },

    // CB (Cap Back) - legacy, replaced by AL-CAP
    { id: 62, itemType: 'CB', tierLabel: '1-7', reason: 'Legacy - replaced by AL-CAP' },
    { id: 63, itemType: 'CB', tierLabel: '8-23', reason: 'Legacy - replaced by AL-CAP' },
    { id: 64, itemType: 'CB', tierLabel: '24-47', reason: 'Legacy - replaced by AL-CAP' },
    { id: 65, itemType: 'CB', tierLabel: '48-71', reason: 'Legacy - replaced by AL-CAP' },
    { id: 66, itemType: 'CB', tierLabel: '72+', reason: 'Legacy - replaced by AL-CAP' },

    // CS (Cap Side) - legacy, replaced by AL-CAP
    { id: 67, itemType: 'CS', tierLabel: '1-7', reason: 'Legacy - replaced by AL-CAP' },
    { id: 68, itemType: 'CS', tierLabel: '8-23', reason: 'Legacy - replaced by AL-CAP' },
    { id: 69, itemType: 'CS', tierLabel: '24-47', reason: 'Legacy - replaced by AL-CAP' },
    { id: 70, itemType: 'CS', tierLabel: '48-71', reason: 'Legacy - replaced by AL-CAP' },
    { id: 71, itemType: 'CS', tierLabel: '72+', reason: 'Legacy - replaced by AL-CAP' },
];

// ============================================
// RECORD TO ADD
// ============================================

const RECORD_TO_ADD = {
    ItemType: 'DECG-FB',
    TierLabel: '1-7',
    StitchCount: 25000,
    BaseStitchCount: 25000,
    EmbroideryCost: 1.50,  // Per 1K stitches
    AdditionalStitchRate: 1.5,
    StitchIncrement: 1000,
    DigitizingFee: 0,  // DECG = customer supplied, no digitizing
    LTM: 50,
    LogoPositions: 'Full Back'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyRecordExists(id) {
    try {
        // Try to fetch all embroidery costs and check if this ID exists
        const response = await fetch(`${API_BASE_URL}/api/embroidery-costs?itemType=ALL`);
        if (!response.ok) {
            // Endpoint may not support this query, try fetching the bundle
            const bundleResponse = await fetch(`${API_BASE_URL}/api/pricing-bundle?method=EMB`);
            if (bundleResponse.ok) {
                const data = await bundleResponse.json();
                const allRecords = data.allEmbroideryCostsR || [];
                return allRecords.some(r => r.PK_ID === id || r.EmbroideryCostID === id);
            }
        }
        // Just assume it exists for now, the delete will fail gracefully if not
        return true;
    } catch (error) {
        console.log(`  Warning: Could not verify record ${id}: ${error.message}`);
        return true; // Proceed anyway
    }
}

async function deleteRecord(id) {
    const response = await fetch(`${API_BASE_URL}/api/embroidery-costs/${id}`, {
        method: 'DELETE'
    });

    const data = await response.json().catch(() => ({}));

    return {
        success: response.ok || data.recordsAffected > 0,
        status: response.status,
        data
    };
}

async function checkExistingRecord(itemType, tierLabel) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/embroidery-costs?itemType=${encodeURIComponent(itemType)}&tierLabel=${encodeURIComponent(tierLabel)}`
        );
        if (response.ok) {
            const data = await response.json();
            return data && data.length > 0;
        }
    } catch (error) {
        // Ignore - we'll try to insert anyway
    }
    return false;
}

async function addRecord(record) {
    const response = await fetch(`${API_BASE_URL}/api/embroidery-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const data = await response.json().catch(() => ({}));

    return {
        success: response.ok || response.status === 201 || data.success,
        status: response.status,
        data
    };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('='.repeat(70));
    console.log('EMBROIDERY_COSTS TABLE CLEANUP');
    console.log(`API: ${API_BASE_URL}`);
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '🚀 EXECUTE'}`);
    console.log('='.repeat(70));
    console.log('');

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes will be made');
        console.log('   Run without --dry-run to execute changes');
        console.log('');
    }

    const results = {
        deleted: 0,
        deleteFailed: 0,
        added: 0,
        addFailed: 0,
        skipped: 0,
        errors: []
    };

    // ========== PHASE 1: DELETE DUPLICATE/LEGACY RECORDS ==========
    console.log('─'.repeat(70));
    console.log('PHASE 1: Deleting duplicate/legacy records');
    console.log('─'.repeat(70));
    console.log('');

    console.log(`Records to delete: ${RECORDS_TO_DELETE.length}`);
    console.log('');

    // Group by reason for cleaner output
    const groupedByReason = {};
    for (const record of RECORDS_TO_DELETE) {
        const key = record.reason;
        if (!groupedByReason[key]) {
            groupedByReason[key] = [];
        }
        groupedByReason[key].push(record);
    }

    for (const [reason, records] of Object.entries(groupedByReason)) {
        console.log(`📋 ${reason}:`);
        for (const record of records) {
            const label = `ID ${record.id}: ${record.itemType}|${record.tierLabel}`;

            if (DRY_RUN) {
                console.log(`   [DRY] Would delete: ${label}`);
                results.deleted++;
            } else {
                try {
                    const result = await deleteRecord(record.id);
                    if (result.success) {
                        console.log(`   ✅ Deleted: ${label}`);
                        results.deleted++;
                    } else {
                        console.log(`   ❌ Failed: ${label} - ${result.data?.error || `HTTP ${result.status}`}`);
                        results.deleteFailed++;
                        results.errors.push({ action: 'delete', id: record.id, error: result.data?.error || `HTTP ${result.status}` });
                    }
                } catch (error) {
                    console.log(`   ❌ Error: ${label} - ${error.message}`);
                    results.deleteFailed++;
                    results.errors.push({ action: 'delete', id: record.id, error: error.message });
                }

                // Rate limiting
                await sleep(500);
            }
        }
        console.log('');
    }

    // ========== PHASE 2: ADD MISSING DECG-FB 1-7 RECORD ==========
    console.log('─'.repeat(70));
    console.log('PHASE 2: Adding missing DECG-FB 1-7 tier');
    console.log('─'.repeat(70));
    console.log('');

    const addLabel = `${RECORD_TO_ADD.ItemType}|${RECORD_TO_ADD.TierLabel}`;
    console.log(`Record to add: ${addLabel}`);
    console.log(`  - StitchCount: ${RECORD_TO_ADD.StitchCount}`);
    console.log(`  - EmbroideryCost: $${RECORD_TO_ADD.EmbroideryCost}/1K`);
    console.log(`  - LTM: $${RECORD_TO_ADD.LTM}`);
    console.log('');

    if (DRY_RUN) {
        console.log(`[DRY] Would add: ${addLabel}`);
        results.added++;
    } else {
        // Check if already exists
        const exists = await checkExistingRecord(RECORD_TO_ADD.ItemType, RECORD_TO_ADD.TierLabel);
        if (exists) {
            console.log(`⏭️  Skipped: ${addLabel} - already exists`);
            results.skipped++;
        } else {
            try {
                const result = await addRecord(RECORD_TO_ADD);
                if (result.success) {
                    console.log(`✅ Added: ${addLabel}`);
                    results.added++;
                } else {
                    console.log(`❌ Failed to add: ${addLabel} - ${result.data?.error || `HTTP ${result.status}`}`);
                    results.addFailed++;
                    results.errors.push({ action: 'add', record: addLabel, error: result.data?.error || `HTTP ${result.status}` });
                }
            } catch (error) {
                console.log(`❌ Error adding: ${addLabel} - ${error.message}`);
                results.addFailed++;
                results.errors.push({ action: 'add', record: addLabel, error: error.message });
            }
        }
    }

    // ========== SUMMARY ==========
    console.log('');
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    if (DRY_RUN) {
        console.log('');
        console.log('🔍 DRY RUN RESULTS (no changes made):');
        console.log(`   Would delete: ${results.deleted} records`);
        console.log(`   Would add: ${results.added} records`);
        console.log('');
        console.log('To execute these changes, run:');
        console.log('   node tests/scripts/cleanup-embroidery-costs.js');
    } else {
        console.log('');
        console.log('📊 EXECUTION RESULTS:');
        console.log(`   Deleted: ${results.deleted} records`);
        console.log(`   Delete failed: ${results.deleteFailed} records`);
        console.log(`   Added: ${results.added} records`);
        console.log(`   Add failed: ${results.addFailed} records`);
        console.log(`   Skipped (already exists): ${results.skipped} records`);

        if (results.errors.length > 0) {
            console.log('');
            console.log('⚠️  ERRORS:');
            for (const err of results.errors) {
                if (err.action === 'delete') {
                    console.log(`   - Delete ID ${err.id}: ${err.error}`);
                } else {
                    console.log(`   - Add ${err.record}: ${err.error}`);
                }
            }
        }
    }

    console.log('');
    console.log('─'.repeat(70));
    console.log('CLEANUP DETAILS:');
    console.log('─'.repeat(70));
    console.log('');
    console.log('Records deleted:');
    console.log('  • AL-CAP IDs 21-24: Duplicate set with incomplete tiers, wrong LTM');
    console.log('  • AL IDs 52-56: Duplicate at 5000 stitches (correct is 8000)');
    console.log('  • CB IDs 62-66: Legacy Cap Back (replaced by AL-CAP)');
    console.log('  • CS IDs 67-71: Legacy Cap Side (replaced by AL-CAP)');
    console.log('');
    console.log('Record added:');
    console.log('  • DECG-FB 1-7 tier: Missing tier for customer-supplied full back');
    console.log('');
    console.log('Documentation: /memory/EMBROIDERY_ITEM_TYPES.md');
    console.log('');
    console.log('Done!');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
