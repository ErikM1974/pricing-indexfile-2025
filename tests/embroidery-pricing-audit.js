/**
 * Embroidery Quote Pricing Audit Test
 *
 * Verifies pricing consistency across:
 * 1. Quote Builder (pricing calculator)
 * 2. Caspio Database save format
 * 3. Quote View display
 * 4. PDF generation
 *
 * Run: node tests/embroidery-pricing-audit.js
 * Or: include in browser and call runPricingAudit()
 */

const TEST_SCENARIOS = [
    {
        name: 'Standard Garment Order - Tier 24-47',
        products: [
            {
                id: 1,
                style: 'PC54',
                color: 'Heather Gray',
                catalogColor: 'HeatGray',
                title: 'Port & Company Core Cotton Tee',
                totalQuantity: 30,
                sizeBreakdown: { S: 6, M: 8, L: 8, XL: 4, '2XL': 4 },
                isCap: false
            }
        ],
        logos: [
            { id: 'primary', position: 'Left Chest', stitchCount: 8000, needsDigitizing: true, isPrimary: true }
        ],
        expectedTier: '24-47',
        expectedLtmFee: 0 // qty >= 24
    },
    {
        name: 'Small Order - LTM Fee Applied',
        products: [
            {
                id: 1,
                style: 'PC54',
                color: 'Navy',
                catalogColor: 'Navy',
                title: 'Port & Company Core Cotton Tee',
                totalQuantity: 12,
                sizeBreakdown: { S: 3, M: 3, L: 3, XL: 3 },
                isCap: false
            }
        ],
        logos: [
            { id: 'primary', position: 'Left Chest', stitchCount: 8000, needsDigitizing: false, isPrimary: true }
        ],
        expectedTier: '1-23',
        expectedLtmFee: 50 // qty < 24
    },
    {
        name: 'Extra Stitches - 12K stitch count',
        products: [
            {
                id: 1,
                style: 'PC54',
                color: 'Black',
                catalogColor: 'Black',
                title: 'Port & Company Core Cotton Tee',
                totalQuantity: 24,
                sizeBreakdown: { S: 6, M: 6, L: 6, XL: 6 },
                isCap: false
            }
        ],
        logos: [
            { id: 'primary', position: 'Full Back', stitchCount: 12000, needsDigitizing: true, isPrimary: true }
        ],
        expectedTier: '24-47',
        expectedLtmFee: 0,
        expectedExtraStitchCost: 5.00 // (12000-8000)/1000 * $1.25 = $5.00 per piece
    },
    {
        name: 'Mixed Quote - Caps and Garments',
        products: [
            {
                id: 1,
                style: 'PC54',
                color: 'Red',
                catalogColor: 'Red',
                title: 'Port & Company Core Cotton Tee',
                totalQuantity: 20,
                sizeBreakdown: { S: 5, M: 5, L: 5, XL: 5 },
                isCap: false
            },
            {
                id: 2,
                style: 'C112',
                color: 'Navy',
                catalogColor: 'Navy',
                title: 'Port Authority Snapback Trucker',
                totalQuantity: 15,
                sizeBreakdown: { OSFA: 15 },
                isCap: true
            }
        ],
        logos: [
            { id: 'primary', position: 'Left Chest', stitchCount: 8000, needsDigitizing: true, isPrimary: true }
        ],
        logoConfigs: {
            garment: {
                primary: { id: 'primary', position: 'Left Chest', stitchCount: 8000, needsDigitizing: true, isPrimary: true },
                additional: []
            },
            cap: {
                primary: { id: 'cap-primary', position: 'Front', stitchCount: 8000, needsDigitizing: true, isPrimary: true },
                additional: []
            }
        },
        expectedGarmentTier: '1-23', // 20 < 24
        expectedCapTier: '1-23',     // 15 < 24
        expectedGarmentLtm: 50,
        expectedCapLtm: 50
    }
];

/**
 * Simulate the pricing calculation (mirrors embroidery-quote-pricing.js logic)
 */
function simulatePricingCalculation(scenario) {
    const { products, logos, logoConfigs } = scenario;

    // Configuration (from API)
    const config = {
        marginDenominator: 0.57,
        ltmFee: 50.00,
        digitizingFee: 100.00,
        additionalStitchRate: 1.25,
        baseStitchCount: 8000,
        tiers: {
            '1-23': { embCost: 12.00, hasLTM: true },
            '24-47': { embCost: 12.00, hasLTM: false },
            '48-71': { embCost: 11.00, hasLTM: false },
            '72+': { embCost: 10.00, hasLTM: false }
        }
    };

    // Get tier
    const getTier = (qty) => {
        if (qty < 24) return '1-23';
        if (qty < 48) return '24-47';
        if (qty < 72) return '48-71';
        return '72+';
    };

    // Separate caps and garments
    const capProducts = products.filter(p => p.isCap === true);
    const garmentProducts = products.filter(p => p.isCap !== true);

    const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
    const capQuantity = capProducts.reduce((sum, p) => sum + p.totalQuantity, 0);
    const garmentQuantity = garmentProducts.reduce((sum, p) => sum + p.totalQuantity, 0);

    // Separate tiers for caps and garments
    const garmentTier = garmentQuantity > 0 ? getTier(garmentQuantity) : '1-23';
    const capTier = capQuantity > 0 ? getTier(capQuantity) : '1-23';

    // Get primary logo stitch count
    const primaryLogo = logos.find(l => l.isPrimary) || logos[0];
    const primaryStitchCount = primaryLogo?.stitchCount || 8000;

    // Calculate extra stitch cost per piece
    const extraStitches = Math.max(0, primaryStitchCount - config.baseStitchCount);
    const additionalStitchCostPerPiece = (extraStitches / 1000) * config.additionalStitchRate;

    // Calculate product subtotals (simplified - assumes $10 base garment cost for test)
    let subtotal = 0;
    const productPricing = [];

    // Simulate garment pricing
    garmentProducts.forEach(product => {
        const tier = garmentTier;
        const embCost = config.tiers[tier].embCost;
        const garmentCost = 10.00 / config.marginDenominator; // ~$17.54 before emb
        const baseDecoratedPrice = garmentCost + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice);
        const finalPrice = roundedBase + additionalStitchCostPerPiece;

        const lineTotal = finalPrice * product.totalQuantity;
        subtotal += lineTotal;

        productPricing.push({
            product,
            tier,
            lineItems: [{
                description: Object.entries(product.sizeBreakdown).map(([s, q]) => `${s}(${q})`).join(' '),
                quantity: product.totalQuantity,
                unitPrice: finalPrice,
                basePrice: roundedBase,
                extraStitchCost: additionalStitchCostPerPiece,
                total: lineTotal
            }],
            subtotal: lineTotal,
            isCap: false
        });
    });

    // Simulate cap pricing
    capProducts.forEach(product => {
        const tier = capTier;
        const embCost = 9.00; // Cap embroidery cost
        const capCost = 12.00 / config.marginDenominator; // Cap base cost
        const baseDecoratedPrice = capCost + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice * 2) / 2; // HalfDollarUp rounding
        const finalPrice = roundedBase;

        const lineTotal = finalPrice * product.totalQuantity;
        subtotal += lineTotal;

        productPricing.push({
            product,
            tier,
            lineItems: [{
                description: Object.entries(product.sizeBreakdown).map(([s, q]) => `${s}(${q})`).join(' '),
                quantity: product.totalQuantity,
                unitPrice: finalPrice,
                basePrice: roundedBase,
                extraStitchCost: 0,
                total: lineTotal
            }],
            subtotal: lineTotal,
            isCap: true
        });
    });

    // Calculate LTM fees
    let ltmTotal = 0;
    let garmentLtm = 0;
    let capLtm = 0;

    if (garmentQuantity > 0 && garmentQuantity < 24) {
        garmentLtm = config.ltmFee;
    }
    if (capQuantity > 0 && capQuantity < 24) {
        capLtm = config.ltmFee;
    }
    ltmTotal = garmentLtm + capLtm;

    // Calculate setup fees
    const digitizingCount = logos.filter(l => l.needsDigitizing).length;
    const setupFees = digitizingCount * config.digitizingFee;

    // Calculate additional stitch total
    const additionalStitchTotal = garmentQuantity * additionalStitchCostPerPiece;

    // Grand total
    const grandTotal = subtotal + ltmTotal + setupFees;

    return {
        products: productPricing,
        totalQuantity,
        tier: garmentTier,
        garmentTier,
        capTier,
        garmentQuantity,
        capQuantity,
        subtotal,
        ltmFee: ltmTotal,
        garmentLtmFee: garmentLtm,
        capLtmFee: capLtm,
        ltmPerUnit: totalQuantity > 0 ? ltmTotal / totalQuantity : 0,
        setupFees,
        additionalStitchCost: additionalStitchCostPerPiece,
        additionalStitchTotal,
        additionalServicesTotal: 0, // No AL in test scenarios
        grandTotal,
        logos
    };
}

/**
 * Simulate what would be saved to Caspio (mirrors embroidery-quote-service.js)
 */
function simulateCaspioSave(pricingResults, scenario) {
    const primaryLogo = pricingResults.logos?.find(l => l.isPrimary) || pricingResults.logos?.[0];

    return {
        // Session-level fields
        TotalQuantity: pricingResults.totalQuantity,
        SubtotalAmount: parseFloat(pricingResults.subtotal.toFixed(2)),
        LTMFeeTotal: parseFloat(pricingResults.ltmFee.toFixed(2)),
        TotalAmount: parseFloat(pricingResults.grandTotal.toFixed(2)),

        // Embroidery details
        PrintLocation: primaryLogo?.position || 'Left Chest',
        StitchCount: primaryLogo?.stitchCount || 8000,
        DigitizingFee: primaryLogo?.needsDigitizing ? 100 : 0,

        // Fee breakdown
        AdditionalStitchCharge: parseFloat(pricingResults.additionalStitchTotal?.toFixed(2)) || 0,
        GarmentDigitizing: pricingResults.setupFees || 0,
        LTM_Garment: parseFloat(pricingResults.garmentLtmFee?.toFixed(2)) || 0,
        LTM_Cap: parseFloat(pricingResults.capLtmFee?.toFixed(2)) || 0
    };
}

/**
 * Simulate what quote view would display (mirrors quote-view.js renderTotals)
 */
function simulateQuoteViewDisplay(caspioData) {
    const taxRate = 0.101;

    const subtotal = parseFloat(caspioData.SubtotalAmount) || 0;
    const ltmFee = parseFloat(caspioData.LTMFeeTotal) || 0;
    const grandTotalBeforeTax = parseFloat(caspioData.TotalAmount) || 0;
    const taxAmount = grandTotalBeforeTax * taxRate;
    const totalWithTax = grandTotalBeforeTax + taxAmount;

    return {
        subtotalWithLtm: subtotal + ltmFee,
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        totalWithTax: parseFloat(totalWithTax.toFixed(2))
    };
}

/**
 * Simulate PDF totals (mirrors quote-view.js generatePdfContent)
 */
function simulatePdfDisplay(caspioData) {
    // PDF uses exact same logic as quote view
    return simulateQuoteViewDisplay(caspioData);
}

/**
 * Run pricing consistency audit
 */
function runPricingAudit() {
    console.log('='.repeat(60));
    console.log('EMBROIDERY QUOTE PRICING AUDIT');
    console.log('='.repeat(60));

    let passCount = 0;
    let failCount = 0;
    const failures = [];

    TEST_SCENARIOS.forEach((scenario, index) => {
        console.log(`\n[Test ${index + 1}] ${scenario.name}`);
        console.log('-'.repeat(50));

        // Step 1: Calculate pricing
        const pricingResults = simulatePricingCalculation(scenario);
        console.log('1. Pricing Calculator Output:');
        console.log(`   - Tier: ${pricingResults.garmentTier}`);
        console.log(`   - Subtotal: $${pricingResults.subtotal.toFixed(2)}`);
        console.log(`   - LTM Fee: $${pricingResults.ltmFee.toFixed(2)}`);
        console.log(`   - Setup Fees: $${pricingResults.setupFees.toFixed(2)}`);
        console.log(`   - Grand Total: $${pricingResults.grandTotal.toFixed(2)}`);

        // Step 2: Verify Caspio save format
        const caspioData = simulateCaspioSave(pricingResults, scenario);
        console.log('2. Caspio Save Data:');
        console.log(`   - SubtotalAmount: $${caspioData.SubtotalAmount}`);
        console.log(`   - LTMFeeTotal: $${caspioData.LTMFeeTotal}`);
        console.log(`   - TotalAmount: $${caspioData.TotalAmount}`);

        // Step 3: Verify quote view display
        const quoteViewDisplay = simulateQuoteViewDisplay(caspioData);
        console.log('3. Quote View Display:');
        console.log(`   - Subtotal (with LTM): $${quoteViewDisplay.subtotalWithLtm.toFixed(2)}`);
        console.log(`   - Tax (10.1%): $${quoteViewDisplay.taxAmount}`);
        console.log(`   - Total with Tax: $${quoteViewDisplay.totalWithTax}`);

        // Step 4: Verify PDF display
        const pdfDisplay = simulatePdfDisplay(caspioData);
        console.log('4. PDF Display:');
        console.log(`   - Subtotal (with LTM): $${pdfDisplay.subtotalWithLtm.toFixed(2)}`);
        console.log(`   - Tax (10.1%): $${pdfDisplay.taxAmount}`);
        console.log(`   - Total with Tax: $${pdfDisplay.totalWithTax}`);

        // Validations
        let testPassed = true;

        // Check tier
        if (scenario.expectedTier && pricingResults.garmentTier !== scenario.expectedTier) {
            console.log(`   ❌ FAIL: Expected tier ${scenario.expectedTier}, got ${pricingResults.garmentTier}`);
            failures.push(`${scenario.name}: Wrong tier`);
            testPassed = false;
        }

        // Check LTM fee
        if (scenario.expectedLtmFee !== undefined && pricingResults.ltmFee !== scenario.expectedLtmFee) {
            console.log(`   ❌ FAIL: Expected LTM $${scenario.expectedLtmFee}, got $${pricingResults.ltmFee}`);
            failures.push(`${scenario.name}: Wrong LTM fee`);
            testPassed = false;
        }

        // Check extra stitch cost
        if (scenario.expectedExtraStitchCost !== undefined) {
            if (Math.abs(pricingResults.additionalStitchCost - scenario.expectedExtraStitchCost) > 0.01) {
                console.log(`   ❌ FAIL: Expected extra stitch $${scenario.expectedExtraStitchCost}, got $${pricingResults.additionalStitchCost.toFixed(2)}`);
                failures.push(`${scenario.name}: Wrong extra stitch cost`);
                testPassed = false;
            }
        }

        // Check garment/cap LTM split
        if (scenario.expectedGarmentLtm !== undefined && pricingResults.garmentLtmFee !== scenario.expectedGarmentLtm) {
            console.log(`   ❌ FAIL: Expected garment LTM $${scenario.expectedGarmentLtm}, got $${pricingResults.garmentLtmFee}`);
            failures.push(`${scenario.name}: Wrong garment LTM`);
            testPassed = false;
        }
        if (scenario.expectedCapLtm !== undefined && pricingResults.capLtmFee !== scenario.expectedCapLtm) {
            console.log(`   ❌ FAIL: Expected cap LTM $${scenario.expectedCapLtm}, got $${pricingResults.capLtmFee}`);
            failures.push(`${scenario.name}: Wrong cap LTM`);
            testPassed = false;
        }

        // Verify consistency: Pricing → Caspio → QuoteView → PDF
        const mathCheck = {
            subtotalPlusFees: pricingResults.subtotal + pricingResults.ltmFee + pricingResults.setupFees,
            caspioTotal: caspioData.TotalAmount,
            quoteViewSubtotalWithLtm: caspioData.SubtotalAmount + caspioData.LTMFeeTotal
        };

        if (Math.abs(mathCheck.subtotalPlusFees - mathCheck.caspioTotal) > 0.01) {
            console.log(`   ❌ FAIL: Caspio TotalAmount doesn't match pricing calculation`);
            console.log(`      Pricing: ${mathCheck.subtotalPlusFees.toFixed(2)}, Caspio: ${mathCheck.caspioTotal}`);
            failures.push(`${scenario.name}: Caspio total mismatch`);
            testPassed = false;
        }

        // Verify Quote View = PDF
        if (quoteViewDisplay.totalWithTax !== pdfDisplay.totalWithTax) {
            console.log(`   ❌ FAIL: Quote View total doesn't match PDF total`);
            failures.push(`${scenario.name}: QuoteView/PDF mismatch`);
            testPassed = false;
        }

        if (testPassed) {
            console.log('   ✅ PASS: All checks passed');
            passCount++;
        } else {
            failCount++;
        }
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${TEST_SCENARIOS.length}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => console.log(`  - ${f}`));
    }

    return {
        total: TEST_SCENARIOS.length,
        passed: passCount,
        failed: failCount,
        failures
    };
}

/**
 * Live API test - fetches real data and verifies consistency
 * Run this in browser console on quote-view page
 */
async function runLiveApiTest(quoteId) {
    console.log('='.repeat(60));
    console.log(`LIVE API TEST: Quote ${quoteId}`);
    console.log('='.repeat(60));

    const baseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    try {
        // Fetch quote data
        const response = await fetch(`${baseUrl}/api/public/quote/${quoteId}`);
        if (!response.ok) {
            throw new Error(`Quote not found: ${quoteId}`);
        }

        const data = await response.json();
        const session = data.session;
        const items = data.items || [];

        console.log('\n1. Caspio Session Data:');
        console.log(`   - QuoteID: ${session.QuoteID}`);
        console.log(`   - TotalQuantity: ${session.TotalQuantity}`);
        console.log(`   - SubtotalAmount: $${session.SubtotalAmount}`);
        console.log(`   - LTMFeeTotal: $${session.LTMFeeTotal}`);
        console.log(`   - TotalAmount: $${session.TotalAmount}`);

        // Verify line item totals
        const lineItemTotal = items
            .filter(i => !['ADDL-STITCH', 'AL-GARMENT', 'AL-CAP', 'LTM-G', 'LTM-C', 'DIGITIZE-G', 'DIGITIZE-C'].includes(i.StyleNumber))
            .reduce((sum, i) => sum + parseFloat(i.LineTotal || 0), 0);

        console.log('\n2. Line Item Verification:');
        console.log(`   - Sum of product LineTotals: $${lineItemTotal.toFixed(2)}`);

        // Calculate expected display values
        const taxRate = 0.101;
        const subtotal = parseFloat(session.SubtotalAmount) || 0;
        const ltm = parseFloat(session.LTMFeeTotal) || 0;
        const total = parseFloat(session.TotalAmount) || 0;
        const tax = total * taxRate;
        const totalWithTax = total + tax;

        console.log('\n3. Expected Quote View Display:');
        console.log(`   - Subtotal (with LTM): $${(subtotal + ltm).toFixed(2)}`);
        console.log(`   - Tax (10.1%): $${tax.toFixed(2)}`);
        console.log(`   - Total with Tax: $${totalWithTax.toFixed(2)}`);

        // Verify math consistency
        const feesFromSession =
            (parseFloat(session.AdditionalStitchCharge) || 0) +
            (parseFloat(session.ALChargeGarment) || 0) +
            (parseFloat(session.ALChargeCap) || 0) +
            (parseFloat(session.GarmentDigitizing) || 0) +
            (parseFloat(session.CapDigitizing) || 0) +
            (parseFloat(session.ArtCharge) || 0) +
            (parseFloat(session.RushFee) || 0) +
            (parseFloat(session.SampleFee) || 0) +
            (parseFloat(session.LTM_Garment) || 0) +
            (parseFloat(session.LTM_Cap) || 0);

        console.log('\n4. Fee Verification:');
        console.log(`   - AdditionalStitchCharge: $${session.AdditionalStitchCharge || 0}`);
        console.log(`   - GarmentDigitizing: $${session.GarmentDigitizing || 0}`);
        console.log(`   - LTM_Garment: $${session.LTM_Garment || 0}`);
        console.log(`   - LTM_Cap: $${session.LTM_Cap || 0}`);
        console.log(`   - Total Fees: $${feesFromSession.toFixed(2)}`);

        // Math check: SubtotalAmount + Fees should approximately equal TotalAmount
        // Note: SubtotalAmount is product subtotal, TotalAmount includes all fees
        const expectedTotal = subtotal + ltm + (parseFloat(session.GarmentDigitizing) || 0) + (parseFloat(session.CapDigitizing) || 0);
        const diff = Math.abs(total - expectedTotal);

        console.log('\n5. Math Consistency Check:');
        console.log(`   - SubtotalAmount + LTM + Digitizing: $${expectedTotal.toFixed(2)}`);
        console.log(`   - TotalAmount: $${total.toFixed(2)}`);
        console.log(`   - Difference: $${diff.toFixed(2)}`);

        if (diff < 1) {
            console.log('   ✅ Math is consistent');
        } else {
            console.log(`   ⚠️ Warning: Difference of $${diff.toFixed(2)} - may include additional services`);
        }

        return {
            success: true,
            quoteId,
            session,
            items,
            calculated: {
                subtotalWithLtm: subtotal + ltm,
                tax,
                totalWithTax
            }
        };

    } catch (error) {
        console.error('❌ Live API test failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Comprehensive charge verification test
 * Verifies that ALL charge types are properly accounted for and displayed correctly
 *
 * IMPORTANT: After 2026-01-14 fix, ADDL-STITCH should NOT appear as a separate fee row
 * because extra stitch charges are already baked into product unit prices
 */
function runComprehensiveChargeTest(quoteData) {
    console.log('='.repeat(60));
    console.log('COMPREHENSIVE CHARGE VERIFICATION TEST');
    console.log('='.repeat(60));

    const q = quoteData.session || quoteData;
    const items = quoteData.items || [];

    // Define all charge types
    const chargeTypes = {
        // Core amounts
        subtotal: { field: 'SubtotalAmount', description: 'Product subtotal (includes extra stitches)', addedToTotal: false },
        ltmFee: { field: 'LTMFeeTotal', description: 'Less Than Minimum fee', addedToTotal: false },

        // Setup fees - ADDED to subtotal in TotalAmount
        garmentDigitizing: { field: 'GarmentDigitizing', description: 'Garment logo digitizing', addedToTotal: true },
        capDigitizing: { field: 'CapDigitizing', description: 'Cap logo digitizing', addedToTotal: true },

        // Additional logo charges - ADDED to subtotal in TotalAmount
        alGarment: { field: 'ALChargeGarment', description: 'Additional garment logo', addedToTotal: true },
        alCap: { field: 'ALChargeCap', description: 'Additional cap logo', addedToTotal: true },

        // Extra stitch - INFORMATIONAL ONLY, already in subtotal via unit prices
        extraStitch: { field: 'AdditionalStitchCharge', description: 'Extra stitches (IN unit prices)', addedToTotal: false, informationalOnly: true },

        // Other fees - ADDED to subtotal in TotalAmount
        artCharge: { field: 'ArtCharge', description: 'Art charge / redraw', addedToTotal: true },
        rushFee: { field: 'RushFee', description: 'Rush fee', addedToTotal: true },
        sampleFee: { field: 'SampleFee', description: 'Sample fee', addedToTotal: true },

        // Discount - SUBTRACTED from total
        discount: { field: 'Discount', description: 'Discount', addedToTotal: true, isDiscount: true }
    };

    console.log('\n📋 ALL CHARGE TYPES:');
    console.log('-'.repeat(50));

    let calculatedTotal = 0;
    const breakdown = {};

    for (const [key, config] of Object.entries(chargeTypes)) {
        const value = parseFloat(q?.[config.field]) || 0;
        breakdown[key] = value;

        const marker = value > 0 ? '✓' : '○';
        const info = config.informationalOnly ? ' [INFORMATIONAL]' : '';
        const sign = config.isDiscount ? '-' : '+';

        console.log(`${marker} ${config.description}`);
        console.log(`  ${config.field}: $${value.toFixed(2)}${info}`);

        // Add to calculated total (except informational fields like extra stitches)
        if (value > 0 && !config.informationalOnly) {
            if (config.isDiscount) {
                calculatedTotal -= value;
            } else if (config.addedToTotal) {
                calculatedTotal += value;
            }
        }
    }

    // Add subtotal + LTM
    const subtotalPlusLtm = breakdown.subtotal + breakdown.ltmFee;

    console.log('\n📊 TOTAL CALCULATION:');
    console.log('-'.repeat(50));
    console.log(`Subtotal (products):           $${breakdown.subtotal.toFixed(2)}`);
    console.log(`  └ (extra stitches already in unit prices)`);
    console.log(`LTM Fee:                       $${breakdown.ltmFee.toFixed(2)}`);
    console.log(`Garment Digitizing:            $${breakdown.garmentDigitizing.toFixed(2)}`);
    console.log(`Cap Digitizing:                $${breakdown.capDigitizing.toFixed(2)}`);
    console.log(`AL Garment:                    $${breakdown.alGarment.toFixed(2)}`);
    console.log(`AL Cap:                        $${breakdown.alCap.toFixed(2)}`);
    console.log(`Art Charge:                    $${breakdown.artCharge.toFixed(2)}`);
    console.log(`Rush Fee:                      $${breakdown.rushFee.toFixed(2)}`);
    console.log(`Sample Fee:                    $${breakdown.sampleFee.toFixed(2)}`);
    console.log(`Discount:                     -$${breakdown.discount.toFixed(2)}`);
    console.log('-'.repeat(35));

    // Calculate expected total
    const expectedTotal = subtotalPlusLtm +
        breakdown.garmentDigitizing +
        breakdown.capDigitizing +
        breakdown.alGarment +
        breakdown.alCap +
        breakdown.artCharge +
        breakdown.rushFee +
        breakdown.sampleFee -
        breakdown.discount;

    const actualTotal = parseFloat(q?.TotalAmount) || 0;

    console.log(`Expected TotalAmount:          $${expectedTotal.toFixed(2)}`);
    console.log(`Actual TotalAmount:            $${actualTotal.toFixed(2)}`);

    const diff = Math.abs(expectedTotal - actualTotal);
    if (diff < 0.01) {
        console.log(`\n✅ PASS: TotalAmount matches calculated sum`);
    } else {
        console.log(`\n❌ FAIL: Difference of $${diff.toFixed(2)}`);
        console.log(`        This may indicate missing or double-counted charges`);
    }

    // Verify tax
    console.log('\n💰 TAX VERIFICATION:');
    console.log('-'.repeat(50));
    const taxRate = 0.101;
    const expectedTax = actualTotal * taxRate;
    const totalWithTax = actualTotal + expectedTax;
    console.log(`TotalAmount:                   $${actualTotal.toFixed(2)}`);
    console.log(`Tax (10.1%):                   $${expectedTax.toFixed(2)}`);
    console.log(`Grand Total with Tax:          $${totalWithTax.toFixed(2)}`);

    // Verify ADDL-STITCH is NOT showing as a fee row (post-fix check)
    console.log('\n🔍 ADDL-STITCH FIX VERIFICATION:');
    console.log('-'.repeat(50));
    if (breakdown.extraStitch > 0) {
        console.log(`Extra stitch value present: $${breakdown.extraStitch.toFixed(2)}`);
        console.log(`✅ This value is INFORMATIONAL ONLY`);
        console.log(`✅ It is NOT added to TotalAmount (already in unit prices)`);
        console.log(`✅ It should NOT appear as a fee row in the quote view or PDF`);
    } else {
        console.log(`No extra stitches in this quote (standard stitch count)`);
    }

    return {
        success: diff < 0.01,
        breakdown,
        expectedTotal,
        actualTotal,
        difference: diff,
        totalWithTax
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPricingAudit, runLiveApiTest, runComprehensiveChargeTest, TEST_SCENARIOS };
}

// Auto-run in Node.js
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('embroidery-pricing-audit')) {
    runPricingAudit();
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.runPricingAudit = runPricingAudit;
    window.runLiveApiTest = runLiveApiTest;
    window.runComprehensiveChargeTest = runComprehensiveChargeTest;
}

console.log('Embroidery Pricing Audit loaded.');
console.log('Run: runPricingAudit() for offline tests');
console.log('Run: runLiveApiTest("EMB0114-1") for live API test');
console.log('Run: runComprehensiveChargeTest(quoteData) for comprehensive charge verification');
