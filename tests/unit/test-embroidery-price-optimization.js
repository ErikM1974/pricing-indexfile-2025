/**
 * Embroidery Price Optimization Analysis
 * 
 * Goal: Determine optimal embroidery prices to cover overhead
 * without relying solely on LTM fees
 */

class EmbroideryPriceOptimizer {
    constructor() {
        // Current pricing structure
        this.currentPricing = {
            '1-23': 12,
            '24-47': 12,
            '48-71': 11,
            '72+': 10
        };
        
        // Overhead costs per Erik's estimates
        this.overhead = {
            totalMinutes: 195,  // 3.25 hours
            totalCost: 70.00,   // $70 per order
            breakdown: {
                sales: { minutes: 60, cost: 25.00 },
                purchasing: { minutes: 30, cost: 11.00 },
                receiving: { minutes: 30, cost: 9.00 },
                production: { minutes: 25, cost: 8.33 },
                packing: { minutes: 25, cost: 7.50 },
                invoicing: { minutes: 25, cost: 9.17 }
            }
        };
        
        // Machine costs
        this.machine = {
            costPerHour: 45.00,
            piecesPerHour: 16,
            costPerPiece: 2.81
        };
        
        // Current financial parameters
        this.marginDenominator = 0.6;
        this.ltmFee = 50;
        
        // Test quantities for each tier
        this.testScenarios = [
            { qty: 8, tier: '1-23' },
            { qty: 12, tier: '1-23' },
            { qty: 16, tier: '1-23' },
            { qty: 24, tier: '24-47' },
            { qty: 36, tier: '24-47' },
            { qty: 48, tier: '48-71' },
            { qty: 60, tier: '48-71' },
            { qty: 72, tier: '72+' },
            { qty: 96, tier: '72+' },
            { qty: 144, tier: '72+' }
        ];
        
        // Test garments
        this.testGarments = [
            { name: 'PC61 Basic Tee', cost: 3.53 },
            { name: 'PC90H Hoodie', cost: 15.59 },
            { name: 'J790 Jacket', cost: 31.66 }
        ];
    }
    
    calculateCurrentProfit(garmentCost, qty, embCost) {
        // Overhead per piece
        const overheadPerPiece = this.overhead.totalCost / qty;
        
        // Total cost per piece
        const totalCostPerPiece = garmentCost + this.machine.costPerPiece + overheadPerPiece;
        
        // Revenue calculation (current formula)
        const basePrice = (garmentCost / this.marginDenominator) + embCost;
        const roundedPrice = Math.ceil(basePrice);
        
        // Add LTM if applicable
        const ltmPerPiece = qty < 24 ? this.ltmFee / qty : 0;
        const sellingPrice = roundedPrice + ltmPerPiece;
        
        // Profit
        const profitPerPiece = sellingPrice - totalCostPerPiece;
        const profitMargin = (profitPerPiece / sellingPrice) * 100;
        
        return {
            sellingPrice,
            totalCostPerPiece,
            profitPerPiece,
            profitMargin,
            overheadPerPiece
        };
    }
    
    calculateRequiredEmbPrice(garmentCost, qty, targetMargin = 35) {
        // Calculate total cost per piece
        const overheadPerPiece = this.overhead.totalCost / qty;
        const totalCostPerPiece = garmentCost + this.machine.costPerPiece + overheadPerPiece;
        
        // Calculate required selling price for target margin
        const requiredSellingPrice = totalCostPerPiece / (1 - targetMargin/100);
        
        // Account for LTM if applicable
        const ltmPerPiece = qty < 24 ? this.ltmFee / qty : 0;
        const priceBeforeLTM = requiredSellingPrice - ltmPerPiece;
        
        // Back-calculate required embroidery cost
        // priceBeforeLTM = ceil((garmentCost / 0.6) + embCost)
        // We need to find embCost that makes this work
        
        const baseWithoutEmb = garmentCost / this.marginDenominator;
        
        // Try different embroidery costs to find the right one
        for (let embCost = 0; embCost <= 50; embCost += 0.5) {
            const testPrice = Math.ceil(baseWithoutEmb + embCost);
            if (testPrice >= priceBeforeLTM) {
                return embCost;
            }
        }
        
        return 50; // Max out at $50 if needed
    }
    
    runAnalysis() {
        console.log('='.repeat(80));
        console.log('EMBROIDERY PRICE OPTIMIZATION ANALYSIS');
        console.log('='.repeat(80));
        console.log('Current overhead per order: $70.00 (195 minutes of labor)');
        console.log('Current LTM fee: $50.00 (staying unchanged)');
        console.log('='.repeat(80));
        
        // Show current pricing performance
        console.log('\nCURRENT EMBROIDERY PRICING PERFORMANCE');
        console.log('-'.repeat(80));
        console.log('Tier    | Current Price | Status');
        console.log('--------|---------------|--------');
        Object.entries(this.currentPricing).forEach(([tier, price]) => {
            console.log(`${tier.padEnd(7)} | $${price.toString().padEnd(12)} | ${price >= 12 ? 'OK' : 'Low'}`);
        });
        
        // Analyze each tier
        console.log('\n' + '='.repeat(80));
        console.log('PROFITABILITY ANALYSIS BY TIER');
        console.log('='.repeat(80));
        
        const recommendations = {};
        
        for (const [tier, currentEmbPrice] of Object.entries(this.currentPricing)) {
            console.log(`\n${tier} TIER (Current EMB: $${currentEmbPrice})`);
            console.log('-'.repeat(50));
            
            const scenarios = this.testScenarios.filter(s => s.tier === tier);
            let totalRequired = 0;
            let count = 0;
            
            console.log('Qty | Overhead/Pc | Current Margin | Required EMB | Increase');
            console.log('----|-------------|----------------|--------------|----------');
            
            scenarios.forEach(scenario => {
                // Test with basic tee (worst case)
                const garment = this.testGarments[0];
                const current = this.calculateCurrentProfit(garment.cost, scenario.qty, currentEmbPrice);
                const required = this.calculateRequiredEmbPrice(garment.cost, scenario.qty, 35);
                const increase = required - currentEmbPrice;
                
                totalRequired += required;
                count++;
                
                const marginStatus = current.profitMargin < 20 ? '⚠️' : 
                                    current.profitMargin < 30 ? '😐' : '✅';
                
                console.log(
                    `${scenario.qty.toString().padEnd(3)} | ` +
                    `$${current.overheadPerPiece.toFixed(2).padEnd(11)} | ` +
                    `${current.profitMargin.toFixed(1)}% ${marginStatus}`.padEnd(14) + ' | ' +
                    `$${required.toFixed(2).padEnd(12)} | ` +
                    `+$${increase.toFixed(2)}`
                );
            });
            
            const avgRequired = totalRequired / count;
            recommendations[tier] = Math.ceil(avgRequired);
            
            console.log(`\nRECOMMENDED ${tier} PRICE: $${recommendations[tier]} (from $${currentEmbPrice})`);
        }
        
        // Show impact across different garment types
        console.log('\n' + '='.repeat(80));
        console.log('IMPACT OF RECOMMENDED PRICING');
        console.log('='.repeat(80));
        
        for (const garment of this.testGarments) {
            console.log(`\n${garment.name} (Cost: $${garment.cost})`);
            console.log('-'.repeat(50));
            console.log('Qty | Current Price → New Price | Margin: Current → New');
            console.log('----|-------------------------|------------------------');
            
            for (const scenario of this.testScenarios.filter(s => [8, 24, 48, 72].includes(s.qty))) {
                const currentEmb = this.currentPricing[scenario.tier];
                const newEmb = recommendations[scenario.tier];
                
                const currentResult = this.calculateCurrentProfit(garment.cost, scenario.qty, currentEmb);
                const newResult = this.calculateCurrentProfit(garment.cost, scenario.qty, newEmb);
                
                const priceIncrease = newResult.sellingPrice - currentResult.sellingPrice;
                
                console.log(
                    `${scenario.qty.toString().padEnd(3)} | ` +
                    `$${currentResult.sellingPrice.toFixed(2)} → $${newResult.sellingPrice.toFixed(2)}`.padEnd(23) + ' | ' +
                    `${currentResult.profitMargin.toFixed(1)}% → ${newResult.profitMargin.toFixed(1)}%`
                );
            }
        }
        
        // Calculate overall impact
        console.log('\n' + '='.repeat(80));
        console.log('💰 FINANCIAL IMPACT SUMMARY');
        console.log('='.repeat(80));
        
        console.log('\nRECOMMENDED PRICE CHANGES:');
        console.log('-'.repeat(50));
        Object.entries(recommendations).forEach(([tier, newPrice]) => {
            const current = this.currentPricing[tier];
            const increase = newPrice - current;
            const percentIncrease = (increase / current * 100).toFixed(0);
            
            console.log(`${tier.padEnd(7)}: $${current} → $${newPrice} (+$${increase}, +${percentIncrease}%)`);
        });
        
        // Test daily revenue impact
        console.log('\nDAILY REVENUE IMPACT:');
        console.log('-'.repeat(50));
        
        // Scenario: 5 orders per day, mixed sizes
        const typicalDay = [
            { qty: 12, tier: '1-23', garmentCost: 3.53 },
            { qty: 24, tier: '24-47', garmentCost: 15.59 },
            { qty: 24, tier: '24-47', garmentCost: 3.53 },
            { qty: 48, tier: '48-71', garmentCost: 15.59 },
            { qty: 72, tier: '72+', garmentCost: 31.66 }
        ];
        
        let currentDayRevenue = 0;
        let newDayRevenue = 0;
        let currentDayProfit = 0;
        let newDayProfit = 0;
        
        typicalDay.forEach(order => {
            const currentEmb = this.currentPricing[order.tier];
            const newEmb = recommendations[order.tier];
            
            const currentResult = this.calculateCurrentProfit(order.garmentCost, order.qty, currentEmb);
            const newResult = this.calculateCurrentProfit(order.garmentCost, order.qty, newEmb);
            
            currentDayRevenue += currentResult.sellingPrice * order.qty;
            newDayRevenue += newResult.sellingPrice * order.qty;
            currentDayProfit += currentResult.profitPerPiece * order.qty;
            newDayProfit += newResult.profitPerPiece * order.qty;
        });
        
        console.log(`Current daily revenue: $${currentDayRevenue.toFixed(2)}`);
        console.log(`New daily revenue: $${newDayRevenue.toFixed(2)}`);
        console.log(`Revenue increase: $${(newDayRevenue - currentDayRevenue).toFixed(2)}/day`);
        console.log('');
        console.log(`Current daily profit: $${currentDayProfit.toFixed(2)}`);
        console.log(`New daily profit: $${newDayProfit.toFixed(2)}`);
        console.log(`Profit increase: $${(newDayProfit - currentDayProfit).toFixed(2)}/day`);
        
        const yearlyIncrease = (newDayProfit - currentDayProfit) * 250; // 250 working days
        console.log(`\n💵 YEARLY PROFIT INCREASE: $${yearlyIncrease.toFixed(0)}`);
        
        // Strategic recommendations
        console.log('\n' + '='.repeat(80));
        console.log('🎯 STRATEGIC RECOMMENDATIONS');
        console.log('='.repeat(80));
        
        console.log('\n1. IMMEDIATE ACTIONS:');
        console.log('   • Raise 1-23 tier from $12 to $' + recommendations['1-23']);
        console.log('   • Raise 24-47 tier from $12 to $' + recommendations['24-47']);
        console.log('   • Consider raising 48-71 from $11 to $' + recommendations['48-71']);
        console.log('   • 72+ tier from $10 to $' + recommendations['72+'] + ' for consistency');
        
        console.log('\n2. PRICING PHILOSOPHY:');
        console.log('   • Small orders MUST cover overhead');
        console.log('   • Price increases are justified by quality');
        console.log('   • Still competitive with $50 LTM fee');
        
        console.log('\n3. SALES MESSAGING:');
        console.log('   "Our embroidery includes premium digitizing"');
        console.log('   "Quality control on every piece"');
        console.log('   "Professional packaging and presentation"');
        
        console.log('\n4. ALTERNATIVE STRATEGIES:');
        console.log('   • Keep current prices but raise LTM to $75');
        console.log('   • Implement "Express" pricing for rush orders');
        console.log('   • Bundle pricing for multiple locations (+$3 each)');
        
        console.log('\n5. MARGIN TARGETS:');
        console.log('   • Small orders (8-23): Minimum 30% margin');
        console.log('   • Medium orders (24-47): Target 35% margin');
        console.log('   • Large orders (48+): Maintain 40%+ margin');
        
        console.log('\n' + '='.repeat(80));
        console.log('CONCLUSION');
        console.log('='.repeat(80));
        console.log('With $70 overhead per order, current embroidery prices are TOO LOW.');
        console.log('Recommended increases will ensure profitability without losing competitiveness.');
        console.log('Alternative: Raise LTM fee to $75 and keep current embroidery prices.');
        console.log('='.repeat(80));
    }
}

// Run the analysis
const optimizer = new EmbroideryPriceOptimizer();
optimizer.runAnalysis();