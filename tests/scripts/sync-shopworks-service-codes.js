/**
 * Sync ShopWorks Service Codes to Caspio Service_Codes Table
 *
 * Master cross-reference of ALL ShopWorks service part numbers
 * with correct 2026 sell prices. Idempotent: safe to run anytime.
 *
 * Usage:
 *   node tests/scripts/sync-shopworks-service-codes.js          # dry-run (default)
 *   node tests/scripts/sync-shopworks-service-codes.js --live    # actually write to Caspio
 *
 * What it does:
 *   1. Defines all ShopWorks service codes with UnitCost + SellPrice
 *   2. Fetches existing Service_Codes from Caspio
 *   3. Inserts missing codes, updates codes with wrong SellPrice
 *   4. Reports: inserted / updated / unchanged / failed
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// MASTER SHOPWORKS SERVICE CODES
// ============================================
const SHOPWORKS_SERVICE_CODES = [
    // ── Sewing ──
    {
        ServiceCode: 'SEG',
        ServiceType: 'SEWING',
        DisplayName: 'Sew Emblems to Garments',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 3.00,
        SellPrice: 10.00,
        PerUnit: 'each',
        Notes: 'Sewing service - garments. SW cost $3, 2026 sell $10.'
    },
    {
        ServiceCode: 'SECC',
        ServiceType: 'SEWING',
        DisplayName: 'Sew Emblems to Caps',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 3.00,
        SellPrice: 10.00,
        PerUnit: 'each',
        Notes: 'Sewing service - caps. SW cost $3, 2026 sell $10.'
    },
    // ── Digitizing ──
    {
        ServiceCode: 'DD',
        ServiceType: 'DIGITIZING',
        DisplayName: 'Digitizing Setup',
        Category: 'Setup',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 75.00,
        SellPrice: 100.00,
        PerUnit: 'each',
        Notes: 'Full digitizing setup. SW cost $75, 2026 sell $100.'
    },
    {
        ServiceCode: 'DDE',
        ServiceType: 'DIGITIZING',
        DisplayName: 'Edit Digitizing',
        Category: 'Setup',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 25.00,
        SellPrice: 50.00,
        PerUnit: 'each',
        Notes: 'Digitizing edit/revision. SW cost $25, 2026 sell $50.'
    },
    {
        ServiceCode: 'DDT',
        ServiceType: 'DIGITIZING',
        DisplayName: 'Text Digitizing Setup',
        Category: 'Setup',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 25.00,
        SellPrice: 50.00,
        PerUnit: 'each',
        Notes: 'Text-only digitizing setup. SW cost $25, 2026 sell $50.'
    },
    // ── Design Transfer ──
    {
        ServiceCode: 'DT',
        ServiceType: 'FEE',
        DisplayName: 'Transfer/Sample',
        Category: 'Setup',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 15.00,
        SellPrice: 50.00,
        PerUnit: 'each',
        Notes: 'Transfer customer design, run sample. SW cost $15, 2026 sell $50.'
    },
    // ── Rush ──
    {
        ServiceCode: 'RUSH',
        ServiceType: 'FEE',
        DisplayName: 'Rush Charge',
        Category: 'Fee',
        PricingMethod: 'CALCULATED',
        TierLabel: '',
        UnitCost: 25.00,
        SellPrice: 0,
        PerUnit: 'order',
        Notes: '25% of order subtotal. SellPrice=0 because it is calculated dynamically.'
    },
    // ── Art / Design ──
    {
        ServiceCode: 'Art',
        ServiceType: 'FEE',
        DisplayName: 'Art Charges',
        Category: 'Fee',
        PricingMethod: 'HOURLY',
        TierLabel: '',
        UnitCost: 35.00,
        SellPrice: 75.00,
        PerUnit: 'hour',
        Notes: 'Art charges billed hourly. Same as GRT-75. SW cost $35/hr, 2026 sell $75/hr.'
    },
    // ── Monogram/Names ──
    {
        ServiceCode: 'Monogram',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Names on Garments',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 7.00,
        SellPrice: 12.50,
        PerUnit: 'each',
        Notes: 'Monogram/name embroidery. SW cost $7, 2026 sell $12.50.'
    },
    {
        ServiceCode: 'NAME',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Names on Garments',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 7.00,
        SellPrice: 12.50,
        PerUnit: 'each',
        Notes: 'Individual name embroidery (same price as Monogram). SW cost $7, 2026 sell $12.50.'
    },
    // ── Name & Number Combo ──
    {
        ServiceCode: 'Name/Number',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Name & Number Combo',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 7.50,
        SellPrice: 15.00,
        PerUnit: 'each',
        Notes: 'Name + number combo embroidery. SW cost $7.50, 2026 sell $15.'
    },
    // ── Heavyweight Surcharge ──
    {
        ServiceCode: 'HW-SURCHG',
        ServiceType: 'FEE',
        DisplayName: 'Heavyweight Garment Surcharge',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 5.00,
        SellPrice: 10.00,
        PerUnit: 'each',
        Notes: 'Heavyweight garment surcharge. SW cost $5, 2026 sell $10.'
    },
    // ── Additional Logos (tiered — no SellPrice, driven by Embroidery_Costs) ──
    {
        ServiceCode: 'AL',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Additional Logo Garment',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 3.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Tiered pricing — see Embroidery_Costs table. SW cost $3.'
    },
    {
        ServiceCode: 'AL-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Additional Logo Cap',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 3.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Tiered pricing — see Embroidery_Costs table. SW cost $3.'
    },
    // ── Customer-Supplied (tiered — driven by Embroidery_Costs / DECG pricing) ──
    {
        ServiceCode: 'DECG',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Customer Supplied Garments',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 10.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Tiered pricing — API-driven. SW cost $10.'
    },
    {
        ServiceCode: 'DECC',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Customer Supplied Caps',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 10.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Tiered pricing — API-driven. SW cost $10.'
    },
    {
        ServiceCode: 'DECG-FB',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Full Back Embroidery',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 25.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Full back on customer-supplied. Tiered/calculated. SW cost $25.'
    },
    // ── Additional Stitches ──
    {
        ServiceCode: 'AS-Garm',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Extra Stitches Garment',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 1.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: '$4/$10 tiers — API-driven from Embroidery_Costs. SW cost $1.'
    },
    {
        ServiceCode: 'AS-CAP',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Extra Stitches Cap',
        Category: 'Embroidery',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 0.25,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: '$4/$10 tiers — API-driven from Embroidery_Costs. SW cost $0.25.'
    },
    // ── LTM ──
    {
        ServiceCode: 'LTM',
        ServiceType: 'FEE',
        DisplayName: 'Less Than Minimum',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 50.00,
        SellPrice: 50.00,
        PerUnit: 'order',
        Notes: 'Baked into per-piece prices (not a separate fee row).'
    },
    // ── Cap Embellishments ──
    {
        ServiceCode: '3D-EMB',
        ServiceType: 'EMBROIDERY',
        DisplayName: '3D Puff Embroidery',
        Category: 'Embroidery',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 4.00,
        SellPrice: 5.00,
        PerUnit: 'each',
        Notes: '3D puff cap embroidery upcharge. SW cost $4, 2026 sell $5.'
    },
    {
        ServiceCode: 'Laser Patch',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Laser Faux Leather',
        Category: 'Embroidery',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 4.00,
        SellPrice: 5.00,
        PerUnit: 'each',
        Notes: 'Laser leatherette patch upcharge. SW cost $4, 2026 sell $5.'
    },
    // ── Shipping ──
    {
        ServiceCode: 'Freight',
        ServiceType: 'SHIPPING',
        DisplayName: 'Freight Charges',
        Category: 'Shipping',
        PricingMethod: 'PASSTHROUGH',
        TierLabel: '',
        UnitCost: 0,
        SellPrice: 0,
        PerUnit: 'order',
        Notes: 'Pass-through freight. Actual cost billed to customer.'
    },
    // ── Discount ──
    {
        ServiceCode: 'Discount',
        ServiceType: 'FEE',
        DisplayName: 'Customer Discount',
        Category: 'Fee',
        PricingMethod: 'CALCULATED',
        TierLabel: '',
        UnitCost: 0,
        SellPrice: 0,
        PerUnit: 'order',
        Notes: 'Customer discount. In INVALID_PARTS — skipped by parser.'
    },
    // ── Contract Embroidery ──
    {
        ServiceCode: 'CTR-Garmt',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Garments',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 4.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Contract embroidery garments. Tiered — API-driven. SW cost $4.'
    },
    {
        ServiceCode: 'CTR-Cap',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Contract Caps',
        Category: 'Contract',
        PricingMethod: 'TIERED',
        TierLabel: '',
        UnitCost: 4.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Contract embroidery caps. Tiered — API-driven. SW cost $4.'
    },
    // ── Digital Print (non-embroidery, track only) ──
    {
        ServiceCode: 'CDP',
        ServiceType: 'DIGITAL_PRINT',
        DisplayName: 'Digital Print (supplied)',
        Category: 'Service',
        PricingMethod: 'PASSTHROUGH',
        TierLabel: '',
        UnitCost: 2.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Customer-supplied digital print. Track only.'
    },
    {
        ServiceCode: 'CDP 5x5',
        ServiceType: 'DIGITAL_PRINT',
        DisplayName: 'Digital Print ≤5"',
        Category: 'Service',
        PricingMethod: 'PASSTHROUGH',
        TierLabel: '',
        UnitCost: 2.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Digital print up to 5 inches. Track only.'
    },
    {
        ServiceCode: 'CDP 5x5-10',
        ServiceType: 'DIGITAL_PRINT',
        DisplayName: 'Digital Print 5"-10"',
        Category: 'Service',
        PricingMethod: 'PASSTHROUGH',
        TierLabel: '',
        UnitCost: 2.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Digital print 5 to 10 inches. Track only.'
    },
    {
        ServiceCode: 'Pallet',
        ServiceType: 'FEE',
        DisplayName: 'Pallet Change',
        Category: 'Fee',
        PricingMethod: 'PASSTHROUGH',
        TierLabel: '',
        UnitCost: 10.00,
        SellPrice: 0,
        PerUnit: 'each',
        Notes: 'Pallet change fee. Track only.'
    },
    // ── Screen Print ──
    {
        ServiceCode: 'SPRESET',
        ServiceType: 'FEE',
        DisplayName: 'Screen Reset Charge',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 15.00,
        SellPrice: 30.00,
        PerUnit: 'each',
        Notes: 'Screen print reset charge. SW cost $15, 2026 sell $30.'
    },
    {
        ServiceCode: 'SPSU',
        ServiceType: 'FEE',
        DisplayName: 'Screen Print Set Up',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 15.00,
        SellPrice: 30.00,
        PerUnit: 'each',
        Notes: 'Screen print set up charge. SW cost $15, 2026 sell $30.'
    }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchExistingServiceCodes() {
    const response = await fetch(`${API_BASE_URL}/api/service-codes?refresh=true`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error('Failed to fetch service codes');
    return result.data;
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

async function putServiceCode(pkId, record) {
    const response = await fetch(`${API_BASE_URL}/api/service-codes/${pkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
    const data = await response.json();
    return { status: response.status, data };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    const isLive = process.argv.includes('--live');

    console.log('='.repeat(60));
    console.log('SYNC SHOPWORKS SERVICE CODES TO CASPIO');
    console.log(`Mode: ${isLive ? 'LIVE (writing to Caspio)' : 'DRY-RUN (read-only)'}`);
    console.log(`API: ${API_BASE_URL}`);
    console.log(`Codes: ${SHOPWORKS_SERVICE_CODES.length}`);
    console.log('='.repeat(60));
    console.log('');

    const results = { inserted: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };

    // Fetch existing codes
    console.log('Fetching existing service codes...');
    let existingCodes;
    try {
        existingCodes = await fetchExistingServiceCodes();
        console.log(`  Found ${existingCodes.length} existing service codes`);
    } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        process.exit(1);
    }

    console.log('');
    console.log('Processing service codes:');
    console.log('');

    for (const code of SHOPWORKS_SERVICE_CODES) {
        const key = `${code.ServiceCode}${code.TierLabel ? '|' + code.TierLabel : ''}`;

        // Find existing record matching ServiceCode + TierLabel
        const existing = existingCodes.find(e =>
            e.ServiceCode === code.ServiceCode &&
            (e.TierLabel || '') === (code.TierLabel || '')
        );

        if (!existing) {
            // INSERT — new code
            if (isLive) {
                try {
                    const { status, data } = await postServiceCode(code);
                    if (status === 201) {
                        results.inserted++;
                        console.log(`  + ${key} — INSERTED (${code.DisplayName})`);
                    } else {
                        results.failed++;
                        results.errors.push({ key, error: data.error || JSON.stringify(data) });
                        console.log(`  x ${key} — FAILED: ${data.error || data.details}`);
                    }
                    await sleep(300);
                } catch (err) {
                    results.failed++;
                    results.errors.push({ key, error: err.message });
                    console.log(`  x ${key} — ERROR: ${err.message}`);
                }
            } else {
                results.inserted++;
                console.log(`  + ${key} — WOULD INSERT (${code.DisplayName}) cost=$${code.UnitCost} sell=$${code.SellPrice}`);
            }
        } else if (existing.SellPrice !== code.SellPrice || existing.UnitCost !== code.UnitCost) {
            // UPDATE — price mismatch
            if (isLive) {
                try {
                    const { status, data } = await putServiceCode(existing.PK_ID, code);
                    if (status === 200) {
                        results.updated++;
                        console.log(`  ~ ${key} — UPDATED (sell: $${existing.SellPrice} → $${code.SellPrice}, cost: $${existing.UnitCost} → $${code.UnitCost})`);
                    } else {
                        results.failed++;
                        results.errors.push({ key, error: data.error || JSON.stringify(data) });
                        console.log(`  x ${key} — UPDATE FAILED: ${data.error || data.details}`);
                    }
                    await sleep(300);
                } catch (err) {
                    results.failed++;
                    results.errors.push({ key, error: err.message });
                    console.log(`  x ${key} — ERROR: ${err.message}`);
                }
            } else {
                results.updated++;
                console.log(`  ~ ${key} — WOULD UPDATE (sell: $${existing.SellPrice} → $${code.SellPrice}, cost: $${existing.UnitCost} → $${code.UnitCost})`);
            }
        } else {
            // UNCHANGED
            results.unchanged++;
            console.log(`  = ${key} — unchanged`);
        }
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log(`  Inserted:  ${results.inserted}`);
    console.log(`  Updated:   ${results.updated}`);
    console.log(`  Unchanged: ${results.unchanged}`);
    console.log(`  Failed:    ${results.failed}`);
    console.log('='.repeat(60));

    if (results.errors.length > 0) {
        console.log('');
        console.log('ERRORS:');
        for (const e of results.errors) {
            console.log(`  ${e.key}: ${e.error}`);
        }
    }

    if (!isLive && (results.inserted > 0 || results.updated > 0)) {
        console.log('');
        console.log('Run with --live to apply changes:');
        console.log('  node tests/scripts/sync-shopworks-service-codes.js --live');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
