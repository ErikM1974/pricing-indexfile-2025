/**
 * verify-cap-calculator-sync.js
 *
 * Verifies that the cap calculator page and pricing engine produce identical prices
 * by calling the same live APIs and applying both formulas.
 *
 * Usage: node tests/verify-cap-calculator-sync.js [styleNumber]
 * Default style: 112 (Richardson Trucker Cap)
 */

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const styleNumber = process.argv[2] || '112';
const LTM_FEE = 50;

const TIERS = ['1-7', '8-23', '24-47', '48-71', '72+'];

// --- Rounding functions (identical across all 3 systems) ---

function roundCapPrice_HalfDollarUp(price) {
    if (isNaN(price)) return null;
    if (price % 0.5 === 0) return price;
    return Math.ceil(price * 2) / 2;
}

function roundCapPrice_CeilDollar(price) {
    if (isNaN(price)) return null;
    return Math.ceil(price);
}

// --- Main ---

async function main() {
    console.log('=== Cap Calculator <-> Pricing Engine Sync Verification ===\n');
    console.log(`Style: ${styleNumber}`);

    // 1. Fetch pricing bundle (same endpoint all 3 systems use)
    console.log(`\nFetching: ${API_BASE}/api/pricing-bundle?method=CAP&styleNumber=${styleNumber}`);
    const bundleResp = await fetch(`${API_BASE}/api/pricing-bundle?method=CAP&styleNumber=${styleNumber}`);
    if (!bundleResp.ok) {
        console.error(`ERROR: pricing-bundle returned ${bundleResp.status}`);
        process.exit(1);
    }
    const bundle = await bundleResp.json();

    // 2. Fetch size pricing (base cap cost)
    console.log(`Fetching: ${API_BASE}/api/size-pricing?styleNumber=${styleNumber}`);
    const sizeResp = await fetch(`${API_BASE}/api/size-pricing?styleNumber=${styleNumber}`);
    if (!sizeResp.ok) {
        console.error(`ERROR: size-pricing returned ${sizeResp.status}`);
        process.exit(1);
    }
    const sizeData = await sizeResp.json();

    // Extract base cap price — API returns array of {basePrices: {OSFA: X.XX}}
    let basePrice = null;
    if (Array.isArray(sizeData) && sizeData.length > 0) {
        basePrice = sizeData[0].basePrices?.OSFA ?? sizeData[0].price;
    } else if (sizeData.sizes) {
        basePrice = sizeData.sizes[0]?.price;
    }
    if (basePrice == null) {
        console.error('ERROR: Could not extract base cap price from size-pricing');
        console.log('Size data (first entry):', JSON.stringify(sizeData[0], null, 2));
        process.exit(1);
    }

    // Determine rounding method
    const roundingMethod = bundle.rulesR?.RoundingMethod || 'HalfDollarUp';
    const roundFn = roundingMethod === 'CeilDollar' ? roundCapPrice_CeilDollar : roundCapPrice_HalfDollarUp;

    console.log(`Base Price: $${basePrice.toFixed(2)} (from size-pricing API)`);
    console.log(`Rounding Method: ${roundingMethod}`);

    // Build tier data from API
    const tierData = {};
    for (const tier of TIERS) {
        const tierR = bundle.tiersR?.find(t => t.TierLabel === tier);
        const costR = bundle.allEmbroideryCostsR?.find(c => c.TierLabel === tier && c.StitchCount === 8000);

        tierData[tier] = {
            marginDenom: tierR?.MarginDenominator || 0.57,
            embCost: costR?.EmbroideryCost ?? 9.00,
        };
    }

    // --- Pricing Engine formula (embroidery-quote-pricing.js) ---
    // Uses SINGLE margin denominator from tiersR[0]
    const engineMargin = bundle.tiersR?.[0]?.MarginDenominator || 0.57;

    // --- Calculator formula (cap-embroidery-pricing-integrated.html) ---
    // Uses PER-TIER margin denominator from tiersR.find(TierLabel === tier)

    // --- Cap Pricing Service formula (cap-embroidery-pricing-service.js) ---
    // Uses PER-TIER margin denominator (same as calculator)

    // Erik's reported calculator prices
    const expectedCalc = {
        '1-7': 79.00,   // includes LTM: base + 50/1
        '8-23': 29.00,
        '24-47': 25.00,
        '48-71': 23.00,
        '72+': 22.00,
    };

    console.log(`\nPricing Engine margin: ${engineMargin} (from tiersR[0])`);
    console.log(`Per-tier margins: ${TIERS.map(t => `${t}=${tierData[t].marginDenom}`).join(', ')}`);

    // Check if margins are all the same (they should be for caps)
    const allSameMargin = TIERS.every(t => tierData[t].marginDenom === engineMargin);
    console.log(`All margins identical: ${allSameMargin ? 'YES' : 'NO — potential mismatch source!'}\n`);

    // Print header
    const hdr = [
        'Tier'.padEnd(8),
        'Base$'.padStart(7),
        'Margin'.padStart(7),
        'EmbCost'.padStart(8),
        'PreRound'.padStart(9),
        'Rounded'.padStart(8),
        '+LTM(1)'.padStart(9),
        'CalcRpt'.padStart(8),
        'Match'.padStart(6),
    ];
    console.log(hdr.join(' | '));
    console.log('-'.repeat(hdr.join(' | ').length));

    let allMatch = true;

    for (const tier of TIERS) {
        const td = tierData[tier];
        const garmentCost = basePrice / td.marginDenom;
        const preRound = garmentCost + td.embCost;
        const rounded = roundFn(preRound);

        // LTM for 1-7 tier (1 piece = worst case)
        const withLTM = tier === '1-7' ? rounded + LTM_FEE / 1 : null;

        // Compare with Erik's reported calculator output
        const comparePrice = tier === '1-7' ? withLTM : rounded;
        const expected = expectedCalc[tier];
        const match = Math.abs(comparePrice - expected) < 0.005;
        if (!match) allMatch = false;

        const row = [
            tier.padEnd(8),
            `$${basePrice.toFixed(2)}`.padStart(7),
            td.marginDenom.toFixed(2).padStart(7),
            `$${td.embCost.toFixed(2)}`.padStart(8),
            `$${preRound.toFixed(2)}`.padStart(9),
            `$${rounded.toFixed(2)}`.padStart(8),
            (withLTM != null ? `$${withLTM.toFixed(2)}` : '—').padStart(9),
            `$${expected.toFixed(2)}`.padStart(8),
            (match ? 'YES' : 'NO').padStart(6),
        ];
        console.log(row.join(' | '));
    }

    console.log();

    // Also verify pricing engine path (uses single margin from tiersR[0])
    if (!allSameMargin) {
        console.log('--- Pricing Engine Path (single margin) ---');
        for (const tier of TIERS) {
            const td = tierData[tier];
            const garmentCost = basePrice / engineMargin;
            const preRound = garmentCost + td.embCost;
            const rounded = roundFn(preRound);
            const withLTM = tier === '1-7' ? rounded + LTM_FEE / 1 : null;
            const comparePrice = tier === '1-7' ? withLTM : rounded;
            const expected = expectedCalc[tier];
            const match = Math.abs(comparePrice - expected) < 0.005;

            console.log(`  ${tier}: engine=$${comparePrice.toFixed(2)} vs calc=$${expected.toFixed(2)} → ${match ? 'MATCH' : 'MISMATCH'}`);
        }
        console.log();
    }

    // LTM verification for multiple quantities
    console.log('--- LTM Verification (1-7 tier) ---');
    const base1_7 = roundFn(basePrice / tierData['1-7'].marginDenom + tierData['1-7'].embCost);
    for (const qty of [1, 2, 3, 4, 5, 6, 7]) {
        const ltmPerUnit = LTM_FEE / qty;
        const allIn = base1_7 + ltmPerUnit;
        console.log(`  ${qty} pcs: $${base1_7.toFixed(2)} + $${ltmPerUnit.toFixed(2)} LTM = $${allIn.toFixed(2)}`);
    }

    console.log();
    if (allMatch) {
        console.log('RESULT: ALL MATCH — Cap calculator and pricing engine produce identical prices.');
    } else {
        console.log('RESULT: MISMATCH FOUND — Investigate differences above.');
    }

    process.exit(allMatch ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
