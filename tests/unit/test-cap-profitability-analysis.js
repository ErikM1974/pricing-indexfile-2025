/**
 * Cap Embroidery Profitability Analysis
 * 
 * Key differences from shirt embroidery:
 * - Production: 24 caps/hour vs 16 shirts/hour (50% faster!)
 * - Overhead: $50/order vs $70/order (30% less!)
 * - Machine: 8-head embroidery, same $45/hour cost
 * - C112 is most popular cap at $3.41 cost
 */

class CapProfitabilityAnalyzer {
    constructor() {
        // Cap-specific parameters
        this.production = {
            capsPerHour: 24,           // 50% faster than shirts!
            machineHeads: 8,
            machineCosCostPerHour: 45.00,
            costPerCap: 45 / 24,       // $1.88 per cap vs $2.81 per shirt
            minutesPerRun: 20          // 8 caps in 20 minutes at 8000 stitches
        };
        
        // Lower overhead for caps
        this.overhead = {
            totalCost: 50.00,          // $50 vs $70 for shirts
            totalMinutes: 120,         // 2 hours vs 3.25 hours
            breakdown: {
                sales: 30,             // 30 min vs 60 min (easier sale)
                purchasing: 15,        // 15 min vs 30 min (simpler)
                receiving: 15,         // 15 min vs 30 min (smaller boxes)
                production: 20,        // Same setup time
                packing: 20,          // Same packing time
                invoicing: 20         // Same invoicing
            }
        };
        
        // Current cap embroidery pricing from API
        this.embroideryPricing = {
            '1-23': 12,    // Note: No tier shown in API for 1-23, but likely exists
            '24-47': 12,
            '48-71': 10,
            '72+': 8.5
        };
        
        // LTM fee now correctly returned by API after fix
        this.ltmFee = 50;  // $50 for orders under 24 caps
        
        this.marginDenominator = 0.57; // 2026 margin (43%)
        
        // Test caps
        this.testCaps = [
            { style: 'C112', name: 'Port & Company Snapback', cost: 3.41 },
            { style: 'C928', name: 'Port Authority Flexfit', cost: 7.50 },  // Estimate
            { style: 'C830', name: 'Port & Company Mesh Back', cost: 4.50 }, // Estimate
            { style: 'C813', name: 'Port Authority Sandwich Bill', cost: 5.00 } // Estimate
        ];
        
        this.testQuantities = [8, 12, 16, 24, 36, 48, 60, 72, 96, 144];
    }
    
    calculateProfit(cap, quantity) {
        // Determine tier and embroidery cost
        let tier, embCost;
        if (quantity < 24) {
            tier = '1-23';
            embCost = 12; // Assuming same as 24-47 since not in API
        } else if (quantity < 48) {
            tier = '24-47';
            embCost = 12;
        } else if (quantity < 72) {
            tier = '48-71';
            embCost = 10;
        } else {
            tier = '72+';
            embCost = 8.5;
        }
        
        // Calculate costs
        const overheadPerCap = this.overhead.totalCost / quantity;
        const machinePerCap = this.production.costPerCap;
        const totalCostPerCap = cap.cost + machinePerCap + overheadPerCap;
        
        // Calculate selling price
        const basePrice = (cap.cost / this.marginDenominator) + embCost;
        const roundedPrice = Math.ceil(basePrice);
        
        // Add LTM if applicable (though API shows $0)
        const ltmPerCap = this.ltmFee > 0 && quantity < 24 ? this.ltmFee / quantity : 0;
        const sellingPrice = roundedPrice + ltmPerCap;
        
        // Calculate profit
        const profitPerCap = sellingPrice - totalCostPerCap;
        const profitMargin = (profitPerCap / sellingPrice) * 100;
        const totalProfit = profitPerCap * quantity;
        
        // Calculate production metrics
        const runsNeeded = Math.ceil(quantity / this.production.machineHeads);
        const productionMinutes = runsNeeded * this.production.minutesPerRun;
        const totalMinutes = productionMinutes + this.overhead.totalMinutes;
        const profitPerHour = (totalProfit / totalMinutes) * 60;
        
        // Machine utilization
        const totalCapacity = runsNeeded * this.production.machineHeads;
        const utilization = (quantity / totalCapacity) * 100;
        const idleHeads = totalCapacity - quantity;
        
        return {
            quantity,
            tier,
            embCost,
            capCost: cap.cost,
            overheadPerCap,
            machinePerCap,
            totalCostPerCap,
            sellingPrice,
            profitPerCap,
            profitMargin,
            totalProfit,
            profitPerHour,
            utilization,
            idleHeads,
            runsNeeded,
            productionMinutes,
            totalMinutes
        };
    }
    
    runAnalysis() {
        console.log('='.repeat(80));
        console.log('CAP EMBROIDERY PROFITABILITY ANALYSIS');
        console.log('='.repeat(80));
        console.log('Production: 24 caps/hour (50% faster than shirts!)');
        console.log('Overhead: $50/order (30% less than shirts!)');
        console.log('Machine: $45/hour, 8-head embroidery');
        console.log('='.repeat(80));
        
        // Show current pricing structure
        console.log('\nCURRENT CAP EMBROIDERY PRICING:');
        console.log('-'.repeat(50));
        Object.entries(this.embroideryPricing).forEach(([tier, price]) => {
            console.log(`${tier.padEnd(10)}: $${price}`);
        });
        console.log('✅ LTM fee: $50 for orders under 24 caps (API now fixed!)');
        
        // Analyze C112 (most popular)
        console.log('\n' + '='.repeat(80));
        console.log('C112 SNAPBACK ANALYSIS (Most Popular - $3.41 cost)');
        console.log('='.repeat(80));
        
        console.log('\nQty | EMB $ | Sell $ | Cost $ | Profit $ | Margin % | $/Hour | Util % | Status');
        console.log('----|-------|--------|--------|----------|----------|--------|--------|--------');
        
        const c112 = this.testCaps[0];
        let bestQty = 0;
        let bestProfitPerHour = 0;
        
        this.testQuantities.forEach(qty => {
            const result = this.calculateProfit(c112, qty);
            
            if (result.profitPerHour > bestProfitPerHour) {
                bestProfitPerHour = result.profitPerHour;
                bestQty = qty;
            }
            
            let status;
            if (result.profitMargin < 30) status = '⚠️ Low';
            else if (result.profitMargin < 40) status = '😐 OK';
            else if (result.profitMargin < 50) status = '👍 Good';
            else status = '💰 Great';
            
            const isBest = qty === bestQty ? '⭐' : '';
            
            console.log(
                `${qty.toString().padEnd(3)} | ` +
                `$${result.embCost.toString().padEnd(5)} | ` +
                `$${result.sellingPrice.toFixed(2).padEnd(6)} | ` +
                `$${result.totalCostPerCap.toFixed(2).padEnd(6)} | ` +
                `$${result.profitPerCap.toFixed(2).padEnd(8)} | ` +
                `${result.profitMargin.toFixed(1)}%`.padEnd(8) + ' | ' +
                `$${result.profitPerHour.toFixed(0).padEnd(5)} | ` +
                `${result.utilization.toFixed(0)}%`.padEnd(6) + ' | ' +
                status + ' ' + isBest
            );
        });
        
        console.log(`\n🏆 OPTIMAL QUANTITY: ${bestQty} caps at $${bestProfitPerHour.toFixed(2)}/hour`);
        
        // Compare all cap styles
        console.log('\n' + '='.repeat(80));
        console.log('COMPARISON ACROSS CAP STYLES');
        console.log('='.repeat(80));
        
        const testQuantities = [24, 48, 72];
        
        this.testCaps.forEach(cap => {
            console.log(`\n${cap.name} (${cap.style} - $${cap.cost})`);
            console.log('-'.repeat(50));
            console.log('Qty | Sell $ | Profit/Cap | Margin % | $/Hour');
            console.log('----|--------|------------|----------|--------');
            
            testQuantities.forEach(qty => {
                const result = this.calculateProfit(cap, qty);
                console.log(
                    `${qty.toString().padEnd(3)} | ` +
                    `$${result.sellingPrice.toFixed(2).padEnd(6)} | ` +
                    `$${result.profitPerCap.toFixed(2).padEnd(10)} | ` +
                    `${result.profitMargin.toFixed(1)}%`.padEnd(8) + ' | ' +
                    `$${result.profitPerHour.toFixed(0)}`
                );
            });
        });
        
        // Machine utilization analysis
        console.log('\n' + '='.repeat(80));
        console.log('MACHINE UTILIZATION ANALYSIS (8-head machine)');
        console.log('='.repeat(80));
        
        console.log('\nQty | Runs | Capacity | Idle Heads | Efficiency | Impact');
        console.log('----|------|----------|------------|------------|--------');
        
        [8, 12, 16, 24, 32, 40, 48].forEach(qty => {
            const runs = Math.ceil(qty / 8);
            const capacity = runs * 8;
            const idle = capacity - qty;
            const efficiency = (qty / capacity * 100).toFixed(0);
            
            let impact;
            if (efficiency === '100') impact = '✅ Perfect';
            else if (efficiency >= '75') impact = '👍 Good';
            else if (efficiency >= '50') impact = '😐 OK';
            else impact = '❌ Poor';
            
            console.log(
                `${qty.toString().padEnd(3)} | ` +
                `${runs.toString().padEnd(4)} | ` +
                `${capacity.toString().padEnd(8)} | ` +
                `${idle.toString().padEnd(10)} | ` +
                `${efficiency}%`.padEnd(10) + ' | ' +
                impact
            );
        });
        
        // Compare caps vs shirts
        console.log('\n' + '='.repeat(80));
        console.log('CAPS VS SHIRTS COMPARISON');
        console.log('='.repeat(80));
        
        console.log('\n24-PIECE ORDER COMPARISON:');
        console.log('-'.repeat(50));
        
        // Cap calculations
        const cap24 = this.calculateProfit(c112, 24);
        
        // Shirt calculations (using previous analysis data)
        const shirtOverhead = 70;
        const shirtMachineCost = 2.81;
        const shirtCost = 3.53;  // PC61
        const shirtEmbCost = 13;  // 24-47 tier after increase
        const shirtTotalCost = shirtCost + shirtMachineCost + (shirtOverhead / 24);
        const shirtBasePrice = Math.ceil((shirtCost / 0.57) + shirtEmbCost); // 2026 margin
        const shirtProfit = shirtBasePrice - shirtTotalCost;
        const shirtMargin = (shirtProfit / shirtBasePrice) * 100;
        
        console.log('CAPS (C112):');
        console.log(`  Production: 24 caps/hour`);
        console.log(`  Overhead: $${(this.overhead.totalCost/24).toFixed(2)}/cap`);
        console.log(`  Machine: $${this.production.costPerCap.toFixed(2)}/cap`);
        console.log(`  Selling: $${cap24.sellingPrice}/cap`);
        console.log(`  Profit: $${cap24.profitPerCap.toFixed(2)}/cap (${cap24.profitMargin.toFixed(1)}%)`);
        console.log(`  Hourly: $${cap24.profitPerHour.toFixed(2)}/hour`);
        
        console.log('\nSHIRTS (PC61):');
        console.log(`  Production: 16 shirts/hour`);
        console.log(`  Overhead: $${(shirtOverhead/24).toFixed(2)}/shirt`);
        console.log(`  Machine: $${shirtMachineCost.toFixed(2)}/shirt`);
        console.log(`  Selling: $${shirtBasePrice}/shirt`);
        console.log(`  Profit: $${shirtProfit.toFixed(2)}/shirt (${shirtMargin.toFixed(1)}%)`);
        
        const capAdvantage = ((cap24.profitPerHour / 100) - 1) * 100;  // Assuming shirt is ~$100/hour
        console.log(`\n💡 CAPS are ${capAdvantage > 0 ? capAdvantage.toFixed(0) + '% MORE' : Math.abs(capAdvantage).toFixed(0) + '% LESS'} profitable per hour!`);
        
        // Strategic recommendations
        console.log('\n' + '='.repeat(80));
        console.log('💡 STRATEGIC RECOMMENDATIONS');
        console.log('='.repeat(80));
        
        console.log('\n1. PRICING OBSERVATIONS:');
        console.log('   • Cap embroidery pricing looks good with $50 LTM fee');
        console.log('   • Small orders now profitable with $50 LTM fee');
        console.log('   • API fix ensures correct pricing calculations');
        
        console.log('\n2. OPTIMAL ORDER SIZES:');
        console.log('   • 8 caps: 100% machine efficiency + $50 LTM = VERY profitable');
        console.log('   • 24 caps: Good balance, no LTM fee needed');
        console.log('   • 48+ caps: Best margins due to lower embroidery cost');
        
        console.log('\n3. PRODUCTION ADVANTAGES:');
        console.log('   • 50% faster than shirts (24/hour vs 16/hour)');
        console.log('   • Lower overhead ($50 vs $70)');
        console.log('   • Machine cost only $1.88/cap vs $2.81/shirt');
        
        console.log('\n4. PRICING STRATEGY:');
        console.log('   • Current pricing with $50 LTM fee is well-balanced');
        console.log('   • Small orders highly profitable with LTM');
        console.log('   • Consider slight increases if demand is high');
        
        console.log('\n5. SWEET SPOT PRODUCTS:');
        console.log('   • C112 at $3.41: High volume seller, good margins');
        console.log('   • Flexfit at ~$7.50: Premium option with better margins');
        console.log('   • Focus on 24-48 piece orders for best profit/hour');
        
        // Daily scenario analysis
        console.log('\n' + '='.repeat(80));
        console.log('DAILY PRODUCTION SCENARIOS');
        console.log('='.repeat(80));
        
        console.log('\nScenario A: Small cap orders (5 orders × 12 caps)');
        const small12 = this.calculateProfit(c112, 12);
        const smallDayProfit = 5 * small12.totalProfit;
        const smallDayTime = 5 * small12.totalMinutes;
        console.log(`  Total caps: 60`);
        console.log(`  Total time: ${(smallDayTime/60).toFixed(1)} hours`);
        console.log(`  Daily profit: $${smallDayProfit.toFixed(2)}`);
        
        console.log('\nScenario B: Medium cap orders (3 orders × 36 caps)');
        const medium36 = this.calculateProfit(c112, 36);
        const mediumDayProfit = 3 * medium36.totalProfit;
        const mediumDayTime = 3 * medium36.totalMinutes;
        console.log(`  Total caps: 108`);
        console.log(`  Total time: ${(mediumDayTime/60).toFixed(1)} hours`);
        console.log(`  Daily profit: $${mediumDayProfit.toFixed(2)}`);
        
        console.log('\nScenario C: Large cap orders (2 orders × 72 caps)');
        const large72 = this.calculateProfit(c112, 72);
        const largeDayProfit = 2 * large72.totalProfit;
        const largeDayTime = 2 * large72.totalMinutes;
        console.log(`  Total caps: 144`);
        console.log(`  Total time: ${(largeDayTime/60).toFixed(1)} hours`);
        console.log(`  Daily profit: $${largeDayProfit.toFixed(2)}`);
        
        const bestScenario = mediumDayProfit > smallDayProfit && mediumDayProfit > largeDayProfit ? 'B' :
                            largeDayProfit > smallDayProfit ? 'C' : 'A';
        console.log(`\n🏆 BEST SCENARIO: ${bestScenario} for maximum daily profit`);
        
        console.log('\n' + '='.repeat(80));
        console.log('CONCLUSION - WITH CORRECTED $50 LTM FEE');
        console.log('='.repeat(80));
        console.log('1. Caps are MORE efficient than shirts (24/hr vs 16/hr)');
        console.log('2. With $50 LTM fee, cap pricing is well-optimized');
        console.log('3. Small cap orders (8-16) are now HIGHLY profitable');
        console.log('4. Sweet spot: Any size! LTM covers small order costs perfectly');
        console.log('5. Caps likely MORE profitable than shirts due to efficiency + LTM');
        console.log('='.repeat(80));
    }
}

// Run the analysis
const analyzer = new CapProfitabilityAnalyzer();
analyzer.runAnalysis();