/**
 * Update Embroidery_Costs Table in Caspio
 *
 * This script adds/updates AL, CB, CS, FB, AS-Garm, AS-Cap records in the
 * Embroidery_Costs table to consolidate all embroidery pricing in one place.
 *
 * PRICING STRUCTURE (Feb 2026):
 * - AL (Additional Logo Garment): 8K base, $10→$7, +$1.25/1K
 * - AL-CAP/CB/CS (Cap locations): 5K base, $6.50→$4.25, +$1.00/1K
 * - FB (Full Back): $1.25/1K flat, 25K minimum
 * - AS-Garm/AS-Cap (Stitch Surcharges): $0 (≤10K), $4 (≤15K), $10 (≤25K)
 *
 * Usage: node tests/scripts/update-embroidery-costs.js
 *
 * Safe to run multiple times - existing records are updated, new records are inserted.
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// EMBROIDERY_COSTS RECORDS TO ADD/UPDATE
// ============================================

// AL (Additional Logo - Garment) - 5 tier records
// Fields: ItemType, TierLabel, EmbroideryCost, BaseStitchCount, StitchCount, AdditionalStitchRate, StitchIncrement, DigitizingFee, LTM, LogoPositions
const AL_GARMENT_RECORDS = [
    { ItemType: 'AL', TierLabel: '1-7', EmbroideryCost: 10.00, BaseStitchCount: 8000, StitchCount: 8000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve' },
    { ItemType: 'AL', TierLabel: '8-23', EmbroideryCost: 9.00, BaseStitchCount: 8000, StitchCount: 8000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve' },
    { ItemType: 'AL', TierLabel: '24-47', EmbroideryCost: 8.00, BaseStitchCount: 8000, StitchCount: 8000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve' },
    { ItemType: 'AL', TierLabel: '48-71', EmbroideryCost: 7.50, BaseStitchCount: 8000, StitchCount: 8000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve' },
    { ItemType: 'AL', TierLabel: '72+', EmbroideryCost: 7.00, BaseStitchCount: 8000, StitchCount: 8000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Left Chest,Right Chest,Full Front,Full Back,Left Sleeve,Right Sleeve' }
];

// AL-CAP (Additional Logo - Cap) - 5 tier records
const AL_CAP_RECORDS = [
    { ItemType: 'AL-CAP', TierLabel: '1-7', EmbroideryCost: 6.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 50.00, LogoPositions: 'Cap Front,Cap Back,Cap Side' },
    { ItemType: 'AL-CAP', TierLabel: '8-23', EmbroideryCost: 5.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Front,Cap Back,Cap Side' },
    { ItemType: 'AL-CAP', TierLabel: '24-47', EmbroideryCost: 4.75, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Front,Cap Back,Cap Side' },
    { ItemType: 'AL-CAP', TierLabel: '48-71', EmbroideryCost: 4.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Front,Cap Back,Cap Side' },
    { ItemType: 'AL-CAP', TierLabel: '72+', EmbroideryCost: 4.25, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Front,Cap Back,Cap Side' }
];

// CB (Cap Back) - 5 tier records (same pricing as AL-CAP)
const CB_RECORDS = [
    { ItemType: 'CB', TierLabel: '1-7', EmbroideryCost: 6.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 50.00, LogoPositions: 'Cap Back' },
    { ItemType: 'CB', TierLabel: '8-23', EmbroideryCost: 5.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Back' },
    { ItemType: 'CB', TierLabel: '24-47', EmbroideryCost: 4.75, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Back' },
    { ItemType: 'CB', TierLabel: '48-71', EmbroideryCost: 4.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Back' },
    { ItemType: 'CB', TierLabel: '72+', EmbroideryCost: 4.25, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Back' }
];

// CS (Cap Side) - 5 tier records (same pricing as AL-CAP)
const CS_RECORDS = [
    { ItemType: 'CS', TierLabel: '1-7', EmbroideryCost: 6.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 50.00, LogoPositions: 'Cap Side' },
    { ItemType: 'CS', TierLabel: '8-23', EmbroideryCost: 5.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Side' },
    { ItemType: 'CS', TierLabel: '24-47', EmbroideryCost: 4.75, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Side' },
    { ItemType: 'CS', TierLabel: '48-71', EmbroideryCost: 4.50, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Side' },
    { ItemType: 'CS', TierLabel: '72+', EmbroideryCost: 4.25, BaseStitchCount: 5000, StitchCount: 5000, AdditionalStitchRate: 1.00, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Cap Side' }
];

// FB (Full Back) - 1 record (flat rate per 1K, no tiers)
const FB_RECORDS = [
    { ItemType: 'FB', TierLabel: 'ALL', EmbroideryCost: 1.25, BaseStitchCount: 25000, StitchCount: 25000, AdditionalStitchRate: 1.25, StitchIncrement: 1000, DigitizingFee: 100, LTM: 0, LogoPositions: 'Full Back' }
];

// AS-Garm (Stitch Surcharge - Garment) - 2 tier records
// Standard (≤10K) = $0 (no record needed, handled as default)
const AS_GARM_RECORDS = [
    { ItemType: 'AS-Garm', TierLabel: 'Mid', EmbroideryCost: 4.00, BaseStitchCount: 10000, StitchCount: 15000, AdditionalStitchRate: 0, StitchIncrement: 1000, DigitizingFee: 0, LTM: 0, LogoPositions: '' },
    { ItemType: 'AS-Garm', TierLabel: 'Large', EmbroideryCost: 10.00, BaseStitchCount: 10000, StitchCount: 25000, AdditionalStitchRate: 0, StitchIncrement: 1000, DigitizingFee: 0, LTM: 0, LogoPositions: '' }
];

// AS-Cap (Stitch Surcharge - Cap) - 2 tier records
// Standard (≤10K) = $0 (no record needed, handled as default)
const AS_CAP_RECORDS = [
    { ItemType: 'AS-Cap', TierLabel: 'Mid', EmbroideryCost: 4.00, BaseStitchCount: 10000, StitchCount: 15000, AdditionalStitchRate: 0, StitchIncrement: 1000, DigitizingFee: 0, LTM: 0, LogoPositions: '' },
    { ItemType: 'AS-Cap', TierLabel: 'Large', EmbroideryCost: 10.00, BaseStitchCount: 10000, StitchCount: 25000, AdditionalStitchRate: 0, StitchIncrement: 1000, DigitizingFee: 0, LTM: 0, LogoPositions: '' }
];

// Combine all records
const ALL_RECORDS = [
    ...AL_GARMENT_RECORDS,
    ...AL_CAP_RECORDS,
    ...CB_RECORDS,
    ...CS_RECORDS,
    ...FB_RECORDS,
    ...AS_GARM_RECORDS,
    ...AS_CAP_RECORDS
];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchExistingRecords() {
    // Fetch existing AL, AL-CAP, CB, CS, FB records
    const response = await fetch(`${API_BASE_URL}/api/embroidery-costs-all?itemTypes=AL,AL-CAP,CB,CS,FB,AS-Garm,AS-Cap`);
    if (!response.ok) {
        // If endpoint doesn't exist, try fetching all and filter
        const allResponse = await fetch(`${API_BASE_URL}/api/pricing-bundle?method=EMB-AL`);
        if (allResponse.ok) {
            const data = await allResponse.json();
            return data.allEmbroideryCostsR || [];
        }
        return [];
    }
    const data = await response.json();
    return data.records || data || [];
}

async function upsertRecord(record) {
    // Try to find existing record by ItemType + TierLabel
    const searchResponse = await fetch(
        `${API_BASE_URL}/api/embroidery-costs?itemType=${encodeURIComponent(record.ItemType)}&tierLabel=${encodeURIComponent(record.TierLabel)}`
    );

    if (searchResponse.ok) {
        const existing = await searchResponse.json();
        if (existing && existing.length > 0) {
            // Update existing record
            const existingId = existing[0].PK_ID || existing[0].EmbroideryCostID;
            const updateResponse = await fetch(`${API_BASE_URL}/api/embroidery-costs/${existingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            const updateData = await updateResponse.json().catch(() => ({}));
            // Check both HTTP status and response body status
            const success = updateResponse.ok || updateData.success;
            return { action: 'updated', status: success ? 200 : 500, data: updateData };
        }
    }

    // Insert new record
    const insertResponse = await fetch(`${API_BASE_URL}/api/embroidery-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const insertData = await insertResponse.json().catch(() => ({}));
    // Check both HTTP status and response body status
    const success = insertResponse.ok || insertData.success || insertData.status === 201;
    return { action: 'inserted', status: success ? 201 : 500, data: insertData };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('='.repeat(60));
    console.log('UPDATING EMBROIDERY_COSTS TABLE IN CASPIO');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(60));
    console.log('');

    const results = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: []
    };

    // Process each record
    console.log(`Processing ${ALL_RECORDS.length} embroidery cost records...`);
    console.log('');

    for (const record of ALL_RECORDS) {
        const key = `${record.ItemType}|${record.TierLabel}`;

        try {
            const result = await upsertRecord(record);

            if (result.status === 200 || result.status === 201 || result.status === 204) {
                if (result.action === 'inserted') {
                    results.inserted++;
                    console.log(`  + ${key} - INSERTED (${record.EmbroideryCost})`);
                } else {
                    results.updated++;
                    console.log(`  ~ ${key} - UPDATED (${record.EmbroideryCost})`);
                }
            } else {
                results.failed++;
                results.errors.push({ key, error: result.data?.error || `HTTP ${result.status}` });
                console.log(`  x ${key} - FAILED: ${result.data?.error || `HTTP ${result.status}`}`);
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ key, error: err.message });
            console.log(`  x ${key} - ERROR: ${err.message}`);
        }

        // Delay to avoid rate limiting (1s between requests)
        await sleep(1000);
    }

    // ========== SUMMARY ==========
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Inserted: ${results.inserted}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('');
        console.log('ERRORS:');
        for (const err of results.errors) {
            console.log(`  - ${err.key}: ${err.error}`);
        }
    }

    console.log('');
    console.log('PRICING SUMMARY:');
    console.log('  AL (Garments):    $10.00 → $7.00 (8K base, +$1.25/1K)');
    console.log('  AL-CAP/CB/CS:     $6.50 → $4.25 (5K base, +$1.00/1K)');
    console.log('  FB (Full Back):   $1.25/1K flat (25K minimum)');
    console.log('  AS-Garm/AS-Cap:   $0 (≤10K), $4 (≤15K), $10 (≤25K)');
    console.log('  LTM Fee:          $50 on primary logo 1-7 tier (not on AL)');
    console.log('');
    console.log('Done!');
}

main().catch(console.error);
