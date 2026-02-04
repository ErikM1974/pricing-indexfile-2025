/**
 * Add CEMB Service Codes to Caspio Service_Codes Table
 *
 * CEMB (Contract Embroidery) uses the SAME pricing as AL (Additional Logo).
 * Both are "embroidery only" - no garment markup.
 *
 * NAMING CONVENTION:
 * - AL = Additional Logo (used on NWCA-sold products - bundled orders)
 * - CEMB = Contract Embroidery (wholesale/ASI work - Ruthie's orders)
 *
 * Usage: node tests/scripts/add-cemb-service-codes.js
 *
 * Safe to run multiple times - duplicates are skipped.
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// CEMB SERVICE CODES TO ADD
// ============================================
const SERVICE_CODES = [
    {
        ServiceCode: 'CEMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Garment)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '1-7',
        UnitCost: 6.50,  // 50% of sell
        SellPrice: 13.00,
        PerUnit: 'each',
        Notes: 'Contract embroidery - garment. Uses AL pricing from Embroidery_Costs table. 5K base + $1.00/1K.'
    },
    {
        ServiceCode: 'CEMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Garment)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '8-23',
        UnitCost: 4.50,
        SellPrice: 9.00,
        PerUnit: 'each',
        Notes: 'Contract embroidery - garment. Uses AL pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Garment)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '24-47',
        UnitCost: 3.25,
        SellPrice: 6.50,
        PerUnit: 'each',
        Notes: 'Contract embroidery - garment. Uses AL pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Garment)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '48-71',
        UnitCost: 2.88,
        SellPrice: 5.75,
        PerUnit: 'each',
        Notes: 'Contract embroidery - garment. Uses AL pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Garment)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '72+',
        UnitCost: 2.50,
        SellPrice: 5.00,
        PerUnit: 'each',
        Notes: 'Contract embroidery - garment. Uses AL pricing from Embroidery_Costs table.'
    },
    // CEMB-CAP records
    {
        ServiceCode: 'CEMB-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Cap)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '1-7',
        UnitCost: 3.25,
        SellPrice: 6.50,
        PerUnit: 'each',
        Notes: 'Contract embroidery - cap. Uses AL-CAP pricing from Embroidery_Costs table. 5K base + $1.00/1K.'
    },
    {
        ServiceCode: 'CEMB-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Cap)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '8-23',
        UnitCost: 2.75,
        SellPrice: 5.50,
        PerUnit: 'each',
        Notes: 'Contract embroidery - cap. Uses AL-CAP pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Cap)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '24-47',
        UnitCost: 2.38,
        SellPrice: 4.75,
        PerUnit: 'each',
        Notes: 'Contract embroidery - cap. Uses AL-CAP pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Cap)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '48-71',
        UnitCost: 2.13,
        SellPrice: 4.25,
        PerUnit: 'each',
        Notes: 'Contract embroidery - cap. Uses AL-CAP pricing from Embroidery_Costs table.'
    },
    {
        ServiceCode: 'CEMB-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Embroidery (Cap)',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '72+',
        UnitCost: 2.00,
        SellPrice: 4.00,
        PerUnit: 'each',
        Notes: 'Contract embroidery - cap. Uses AL-CAP pricing from Embroidery_Costs table.'
    }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function postServiceCode(record) {
    const response = await fetch(`${API_BASE_URL}/api/service-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const data = await response.json();
    return { status: response.status, data };
}

async function fetchExistingServiceCodes() {
    const response = await fetch(`${API_BASE_URL}/api/service-codes?refresh=true`);
    const result = await response.json();
    if (!result.success) throw new Error('Failed to fetch service codes');

    // Build set of existing codes (ServiceCode + TierLabel)
    const existing = new Set();
    for (const sc of result.data) {
        existing.add(`${sc.ServiceCode}|${sc.TierLabel || ''}`);
    }
    return existing;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('='.repeat(60));
    console.log('ADDING CEMB SERVICE CODES TO CASPIO');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(60));
    console.log('');

    const results = {
        inserted: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };

    // Fetch existing service codes
    console.log('Fetching existing service codes...');
    let existingCodes;
    try {
        existingCodes = await fetchExistingServiceCodes();
        console.log(`  Found ${existingCodes.size} existing service codes`);
    } catch (err) {
        console.log(`  ERROR fetching service codes: ${err.message}`);
        existingCodes = new Set();
    }

    console.log('');
    console.log(`Processing ${SERVICE_CODES.length} CEMB service codes...`);
    console.log('');

    for (const code of SERVICE_CODES) {
        const key = `${code.ServiceCode}|${code.TierLabel || ''}`;

        // Skip if already exists
        if (existingCodes.has(key)) {
            results.skipped++;
            console.log(`  o ${key} - already exists`);
            continue;
        }

        try {
            const { status, data } = await postServiceCode(code);

            if (status === 201) {
                results.inserted++;
                existingCodes.add(key);
                console.log(`  + ${key} - INSERTED (${code.DisplayName})`);
            } else if (status === 409 || (data.error && data.error.includes('duplicate'))) {
                results.skipped++;
                console.log(`  o ${key} - already exists`);
            } else {
                results.failed++;
                results.errors.push({ code: key, error: data.error || data.details });
                console.log(`  x ${key} - FAILED: ${data.error || data.details}`);
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ code: key, error: err.message });
            console.log(`  x ${key} - ERROR: ${err.message}`);
        }

        // Delay to avoid rate limiting (1.5s between requests)
        await sleep(1500);
    }

    // ========== SUMMARY ==========
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Inserted: ${results.inserted}`);
    console.log(`Skipped (already exist): ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
        console.log('');
        console.log('ERRORS:');
        for (const err of results.errors) {
            console.log(`  - ${err.code}: ${err.error}`);
        }
    }

    console.log('');
    console.log('CEMB SERVICE CODE SUMMARY:');
    console.log('  CEMB (Garment):     $13.00 → $5.00 (5K base)');
    console.log('  CEMB-CAP (Cap):     $6.50 → $4.00 (5K base)');
    console.log('  Both use AL pricing from Embroidery_Costs table');
    console.log('');
    console.log('Done!');
}

main().catch(console.error);
