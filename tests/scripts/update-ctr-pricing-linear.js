/**
 * Update CTR (Contract Embroidery) Pricing with Linear $/1K Model
 *
 * This script updates CTR-Garmt and CTR-Cap records in the Embroidery_Costs table
 * to use a linear $/1K pricing model instead of individual stitch count prices.
 *
 * NEW PRICING STRUCTURE (Feb 2026):
 *
 * CONTRACT GARMENTS (Customer-Supplied):
 * - Floor: $0.80/1K at 72+
 * - Tiers: $1.10, $1.00, $0.90, $0.85, $0.80 per 1K stitches
 * - LTM: $50 for qty 1-7
 *
 * CONTRACT CAPS (Customer-Supplied):
 * - Floor: $0.70/1K at 72+
 * - Tiers: $1.00, $0.90, $0.80, $0.75, $0.70 per 1K stitches
 * - LTM: $50 for qty 1-7
 *
 * Formula: price = (stitchCount / 1000) * perThousandRate
 *
 * Usage: node tests/scripts/update-ctr-pricing-linear.js
 *
 * Safe to run multiple times - existing records are updated.
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// NEW LINEAR $/1K RATES BY TIER
// ============================================

const GARMENT_RATES_PER_THOUSAND = {
    '1-7': 1.10,
    '8-23': 1.00,
    '24-47': 0.90,
    '48-71': 0.85,
    '72+': 0.80
};

const CAP_RATES_PER_THOUSAND = {
    '1-7': 1.00,
    '8-23': 0.90,
    '24-47': 0.80,
    '48-71': 0.75,
    '72+': 0.70
};

const FULL_BACK_RATES_PER_THOUSAND = {
    '1-7': 1.20,
    '8-23': 1.00,
    '24-47': 0.90,
    '48-71': 0.85,
    '72+': 0.80
};

// Stitch counts to create records for (extended to 25K per Feb 2026 plan)
const STITCH_COUNTS = [
    5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 15000,
    16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000
];
const FB_STITCH_COUNT = 25000;

const TIERS = ['1-7', '8-23', '24-47', '48-71', '72+'];

// LTM Fee
const LTM_FEE = 50.00;

// ============================================
// GENERATE CTR RECORDS
// ============================================

function generateCtrRecords() {
    const records = [];

    // CTR-Garmt records (garments)
    for (const stitchCount of STITCH_COUNTS) {
        for (const tier of TIERS) {
            const rate = GARMENT_RATES_PER_THOUSAND[tier];
            const price = (stitchCount / 1000) * rate;

            records.push({
                ItemType: 'CTR-Garmt',
                TierLabel: tier,
                StitchCount: stitchCount,
                StitchCountRange: `${stitchCount / 1000}K`,
                EmbroideryCost: parseFloat(price.toFixed(2)),
                PerThousandRate: rate,
                BaseStitchCount: 5000,
                AdditionalStitchRate: rate,
                StitchIncrement: 1000,
                DigitizingFee: 100,
                LTM: tier === '1-7' ? LTM_FEE : 0,
                LogoPositions: 'Left Chest,Right Chest,Full Front,Left Sleeve,Right Sleeve'
            });
        }
    }

    // CTR-Cap records (caps)
    for (const stitchCount of STITCH_COUNTS) {
        for (const tier of TIERS) {
            const rate = CAP_RATES_PER_THOUSAND[tier];
            const price = (stitchCount / 1000) * rate;

            records.push({
                ItemType: 'CTR-Cap',
                TierLabel: tier,
                StitchCount: stitchCount,
                StitchCountRange: `${stitchCount / 1000}K`,
                EmbroideryCost: parseFloat(price.toFixed(2)),
                PerThousandRate: rate,
                BaseStitchCount: 5000,
                AdditionalStitchRate: rate,
                StitchIncrement: 1000,
                DigitizingFee: 100,
                LTM: tier === '1-7' ? LTM_FEE : 0,
                LogoPositions: 'Cap Front,Cap Back,Cap Side'
            });
        }
    }

    // CTR-FB records (full back)
    for (const tier of TIERS) {
        const rate = FULL_BACK_RATES_PER_THOUSAND[tier];
        const price = (FB_STITCH_COUNT / 1000) * rate;

        records.push({
            ItemType: 'CTR-FB',
            TierLabel: tier,
            StitchCount: FB_STITCH_COUNT,
            StitchCountRange: `${FB_STITCH_COUNT / 1000}K`,
            EmbroideryCost: parseFloat(price.toFixed(2)),
            PerThousandRate: rate,
            BaseStitchCount: FB_STITCH_COUNT,
            AdditionalStitchRate: rate,
            StitchIncrement: 1000,
            DigitizingFee: 100,
            LTM: tier === '1-7' ? LTM_FEE : 0,
            LogoPositions: 'Full Back'
        });
    }

    return records;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function upsertRecord(record) {
    // Try to find existing record by ItemType + TierLabel + StitchCountRange
    // API expects StitchCountRange format like "5K" not numeric StitchCount
    const searchResponse = await fetch(
        `${API_BASE_URL}/api/embroidery-costs?itemType=${encodeURIComponent(record.ItemType)}&stitchCount=${encodeURIComponent(record.StitchCountRange)}`
    );

    if (searchResponse.ok) {
        const existing = await searchResponse.json();
        // Find matching tier
        const matchingRecord = existing.find(r => r.TierLabel === record.TierLabel);

        if (matchingRecord) {
            // Update existing record
            const existingId = matchingRecord.PK_ID || matchingRecord.EmbroideryCostID;
            const updateResponse = await fetch(`${API_BASE_URL}/api/embroidery-costs/${existingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            const updateData = await updateResponse.json().catch(() => ({}));
            const success = updateResponse.ok || updateData.success;
            return { action: 'updated', status: success ? 200 : 500, data: updateData, id: existingId };
        }
    }

    // Insert new record
    const insertResponse = await fetch(`${API_BASE_URL}/api/embroidery-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const insertData = await insertResponse.json().catch(() => ({}));
    const success = insertResponse.ok || insertData.success || insertData.status === 201;
    return { action: 'inserted', status: success ? 201 : 500, data: insertData };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('='.repeat(70));
    console.log('UPDATING CTR (CONTRACT EMBROIDERY) PRICING WITH LINEAR $/1K MODEL');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(70));
    console.log('');

    // Print pricing tables
    console.log('NEW PRICING STRUCTURE:');
    console.log('');
    console.log('CONTRACT GARMENTS (Customer-Supplied):');
    console.log('  $/1K Rates by Tier:');
    for (const [tier, rate] of Object.entries(GARMENT_RATES_PER_THOUSAND)) {
        console.log(`    ${tier.padEnd(8)} $${rate.toFixed(2)}/1K`);
    }
    console.log('');
    console.log('CONTRACT CAPS (Customer-Supplied):');
    console.log('  $/1K Rates by Tier:');
    for (const [tier, rate] of Object.entries(CAP_RATES_PER_THOUSAND)) {
        console.log(`    ${tier.padEnd(8)} $${rate.toFixed(2)}/1K`);
    }
    console.log('');
    console.log('CONTRACT FULL BACK:');
    console.log('  $/1K Rates by Tier:');
    for (const [tier, rate] of Object.entries(FULL_BACK_RATES_PER_THOUSAND)) {
        console.log(`    ${tier.padEnd(8)} $${rate.toFixed(2)}/1K`);
    }
    console.log('');
    console.log('Formula: price = (stitchCount / 1000) * $/1K rate');
    console.log('LTM Fee: $50 for qty 1-7');
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    const records = generateCtrRecords();
    const results = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: []
    };

    console.log(`Processing ${records.length} CTR records...`);
    console.log('');

    // Group by ItemType for cleaner output
    let currentType = '';

    for (const record of records) {
        if (record.ItemType !== currentType) {
            currentType = record.ItemType;
            console.log(`\n--- ${currentType} ---`);
        }

        const key = `${record.ItemType}|${record.TierLabel}|${record.StitchCount}`;

        try {
            const result = await upsertRecord(record);

            if (result.status === 200 || result.status === 201 || result.status === 204) {
                if (result.action === 'inserted') {
                    results.inserted++;
                    console.log(`  + ${record.StitchCount / 1000}K|${record.TierLabel.padEnd(6)} = $${record.EmbroideryCost.toFixed(2)} (INSERTED)`);
                } else {
                    results.updated++;
                    console.log(`  ~ ${record.StitchCount / 1000}K|${record.TierLabel.padEnd(6)} = $${record.EmbroideryCost.toFixed(2)} (UPDATED)`);
                }
            } else {
                results.failed++;
                results.errors.push({ key, error: result.data?.error || `HTTP ${result.status}` });
                console.log(`  x ${record.StitchCount / 1000}K|${record.TierLabel.padEnd(6)} - FAILED: ${result.data?.error || `HTTP ${result.status}`}`);
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ key, error: err.message });
            console.log(`  x ${key} - ERROR: ${err.message}`);
        }

        // Delay to avoid rate limiting (500ms between requests)
        await sleep(500);
    }

    // ========== SUMMARY ==========
    console.log('');
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Inserted: ${results.inserted}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total: ${records.length}`);

    if (results.errors.length > 0) {
        console.log('');
        console.log('ERRORS:');
        for (const err of results.errors) {
            console.log(`  - ${err.key}: ${err.error}`);
        }
    }

    // Print example calculations
    console.log('');
    console.log('='.repeat(70));
    console.log('EXAMPLE CALCULATIONS:');
    console.log('='.repeat(70));
    console.log('');
    console.log('Garments @ 10K stitches, 24-47 tier:');
    console.log(`  10 x $0.90 = $9.00/piece`);
    console.log('');
    console.log('Caps @ 8K stitches, 72+ tier:');
    console.log(`  8 x $0.70 = $5.60/piece`);
    console.log('');
    console.log('Full Back @ 25K stitches, 8-23 tier:');
    console.log(`  25 x $1.00 = $25.00/piece`);
    console.log('');
    console.log('Done!');
}

main().catch(console.error);
