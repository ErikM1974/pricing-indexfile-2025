/**
 * Machine Utilization Analysis
 * 
 * Accounts for 8-head embroidery machine efficiency to find
 * the TRUE optimal order quantities considering idle head costs.
 */

const https = require('https');
const url = require('url');

class MachineUtilizationAnalyzer {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Machine configuration
        this.machine = {
            heads: 8,
            costPerHour: 45.00,
            stitchesPerMinute: 600,
            setupMinutesPerOrder: 5,
            // Real-world: 16 garments/hour INCLUDING hooping/setup
            // So for 8000 stitches: 8000/600 = 13.3 min + hooping = ~15 min total per piece
            // 8 pieces = 30 minutes (2 runs per hour)
            minutesPerRun: 30  // For 8 pieces at 8000 stitches
        };
        
        // Test quantities (focusing on multiples and near-multiples of 8)
        this.testQuantities = [8, 12, 16, 20, 24, 32, 40, 48];
        
        // Standard scenario
        this.standardStitches = 8000;
        
        // Results storage
        this.results = [];
    }
    
    async fetchAPI(endpoint) {
        return new Promise((resolve, reject) => {
            const apiUrl = `${this.apiBase}${endpoint}`;
            const parsedUrl = url.parse(apiUrl);
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.path,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
    }
    
    async loadConfiguration() {
        console.log('Loading configuration...');
        
        try {
            const bundle = await this.fetchAPI('/api/pricing-bundle?method=EMB&styleNumber=PC61');
            
            this.tiers = {};
            this.marginDenominator = 0.6;
            this.additionalStitchRate = 1.25;
            this.baseStitchCount = 8000;
            
            if (bundle.tiersR) {
                bundle.tiersR.forEach(tier => {
                    this.tiers[tier.TierLabel] = {
                        embCost: 0,
                        ltmFee: tier.LTM_Fee || 0
                    };
                });
                this.marginDenominator = bundle.tiersR[0].MarginDenominator || 0.6;
            }
            
            if (bundle.allEmbroideryCostsR) {
                bundle.allEmbroideryCostsR.forEach(cost => {
                    if (cost.ItemType === 'Shirt' && this.tiers[cost.TierLabel]) {
                        this.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                    }
                });
            }
            
            console.log('✓ Configuration loaded\n');
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }
    
    /**
     * Calculate TRUE machine cost accounting for head utilization
     */
    calculateMachineCost(quantity) {
        const headsPerRun = this.machine.heads;
        const fullRuns = Math.floor(quantity / headsPerRun);
        const partialRunPieces = quantity % headsPerRun;
        
        // Total runs needed (including partial)
        const totalRuns = partialRunPieces > 0 ? fullRuns + 1 : fullRuns;
        
        // Time in minutes
        const runTimeMinutes = totalRuns * this.machine.minutesPerRun;
        const totalMinutes = runTimeMinutes + this.machine.setupMinutesPerOrder;
        
        // Machine cost
        const machineCost = (totalMinutes / 60) * this.machine.costPerHour;
        const costPerPiece = machineCost / quantity;
        
        // Calculate efficiency
        const totalHeadCapacity = totalRuns * headsPerRun;
        const utilizationPercent = (quantity / totalHeadCapacity) * 100;
        
        // Opportunity cost of idle heads
        const idleHeads = totalHeadCapacity - quantity;
        const opportunityCost = idleHeads > 0 ? (idleHeads * costPerPiece) : 0;
        
        return {
            fullRuns,
            partialRunPieces,
            totalRuns,
            runTimeMinutes,
            totalMinutes,
            machineCost,
            costPerPiece,
            utilizationPercent,
            idleHeads,
            opportunityCost,
            effectiveCostPerPiece: costPerPiece + (opportunityCost / quantity)
        };
    }
    
    /**
     * Calculate profitability for a specific quantity
     */
    calculateProfitability(quantity, garmentCost) {
        const tier = quantity < 24 ? '1-23' : quantity < 48 ? '24-47' : quantity < 72 ? '48-71' : '72+';
        const tierData = this.tiers[tier];
        
        // Machine costs with utilization
        const machineAnalysis = this.calculateMachineCost(quantity);
        
        // Total cost per piece (using EFFECTIVE cost that includes idle head penalty)
        const totalCostPerPiece = garmentCost + machineAnalysis.effectiveCostPerPiece;
        
        // Revenue calculation
        const embCost = tierData.embCost || 6.00;
        const baseDecoratedPrice = (garmentCost / this.marginDenominator) + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice);
        
        // LTM fee impact
        const ltmPerPiece = tierData.ltmFee > 0 ? tierData.ltmFee / quantity : 0;
        const finalPricePerPiece = roundedBase + ltmPerPiece;
        
        // Profit calculations
        const profitPerPiece = finalPricePerPiece - totalCostPerPiece;
        const profitMargin = (profitPerPiece / finalPricePerPiece) * 100;
        
        // Hourly profit (accounting for actual production time)
        const ordersPerHour = 60 / machineAnalysis.totalMinutes;
        const piecesPerHour = quantity * ordersPerHour;
        const profitPerHour = profitPerPiece * piecesPerHour;
        
        return {
            quantity,
            tier,
            ...machineAnalysis,
            garmentCost,
            totalCostPerPiece,
            sellingPrice: finalPricePerPiece,
            ltmBoost: ltmPerPiece,
            profitPerPiece,
            profitMargin,
            ordersPerHour,
            piecesPerHour,
            profitPerHour,
            totalOrderProfit: profitPerPiece * quantity
        };
    }
    
    /**
     * Analyze batching strategy (combining multiple small orders)
     */
    analyzeBatchingStrategy() {
        console.log('\n' + '='.repeat(70));
        console.log('BATCHING STRATEGY ANALYSIS');
        console.log('='.repeat(70));
        console.log('What if we batch multiple small orders together?\n');
        
        // Scenario 1: Two 8-piece orders batched
        console.log('Scenario 1: Batch two 8-piece orders (16 pieces total)');
        console.log('-'.repeat(50));
        
        const twoOrders8 = {
            totalPieces: 16,
            runs: 2,
            efficiency: '100%',
            ltmRevenue: 100, // Two $50 fees
            machineCost: 45, // 60 minutes
            advantage: 'Both customers get lower minimum, both pay LTM fee'
        };
        
        console.log(`  Total LTM fees collected: $${twoOrders8.ltmRevenue}`);
        console.log(`  Machine efficiency: ${twoOrders8.efficiency}`);
        console.log(`  ${twoOrders8.advantage}`);
        
        // Scenario 2: Three 8-piece orders batched
        console.log('\nScenario 2: Batch three 8-piece orders (24 pieces total)');
        console.log('-'.repeat(50));
        
        const threeOrders8 = {
            totalPieces: 24,
            runs: 3,
            efficiency: '100%',
            ltmRevenue: 150, // Three $50 fees
            machineCost: 67.50, // 90 minutes
            advantage: 'Triple LTM fees, perfect efficiency'
        };
        
        console.log(`  Total LTM fees collected: $${threeOrders8.ltmRevenue}`);
        console.log(`  Machine efficiency: ${threeOrders8.efficiency}`);
        console.log(`  ${threeOrders8.advantage}`);
        
        // Compare to single 24-piece order
        console.log('\nComparison: Single 24-piece order');
        console.log('-'.repeat(50));
        console.log('  Total LTM fees: $0 (no LTM at 24 pieces)');
        console.log('  Machine efficiency: 100%');
        console.log('  Customer needs larger commitment');
        
        console.log('\n💡 BATCHING INSIGHT:');
        console.log('Batching 8-piece orders is SUPERIOR because:');
        console.log('  1. Collect multiple LTM fees ($50 per customer)');
        console.log('  2. Maintain 100% machine efficiency');
        console.log('  3. Lower barrier to entry for customers');
        console.log('  4. Same production time as larger orders');
    }
    
    async runAnalysis() {
        console.log('='.repeat(70));
        console.log('8-HEAD MACHINE UTILIZATION ANALYSIS');
        console.log('='.repeat(70));
        console.log('Question: What order size REALLY maximizes profit?');
        console.log('Accounting for: Idle heads, opportunity costs, LTM fees');
        console.log('='.repeat(70));
        
        await this.loadConfiguration();
        
        // Test with representative garment costs
        const testGarments = [
            { cost: 3.50, name: 'Basic Tee (PC61)' },
            { cost: 15.00, name: 'Hoodie (PC90H)' },
            { cost: 30.00, name: 'Premium Item' }
        ];
        
        for (const garment of testGarments) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`ANALYSIS FOR: ${garment.name} (Cost: $${garment.cost})`);
            console.log('='.repeat(70));
            
            console.log('\nQty | Runs | Efficiency | Idle | $/Piece | Profit/Hr | LTM? | Winner?');
            console.log('----|------|------------|------|---------|-----------|------|--------');
            
            const results = [];
            let bestProfit = 0;
            let bestQty = 0;
            
            for (const qty of this.testQuantities) {
                const result = this.calculateProfitability(qty, garment.cost);
                results.push(result);
                
                if (result.profitPerHour > bestProfit) {
                    bestProfit = result.profitPerHour;
                    bestQty = qty;
                }
            }
            
            // Display results
            results.forEach(r => {
                const hasLTM = r.ltmBoost > 0 ? 'YES' : 'NO';
                const isBest = r.quantity === bestQty ? '⭐' : '';
                
                console.log(
                    `${r.quantity.toString().padEnd(3)} | ` +
                    `${r.totalRuns}/${r.fullRuns}.${r.partialRunPieces} | ` +
                    `${r.utilizationPercent.toFixed(0)}%`.padEnd(10) + ' | ' +
                    `${r.idleHeads}`.padEnd(4) + ' | ' +
                    `$${r.profitPerPiece.toFixed(2)}`.padEnd(7) + ' | ' +
                    `$${r.profitPerHour.toFixed(2)}`.padEnd(9) + ' | ' +
                    `${hasLTM}`.padEnd(4) + ' | ' +
                    isBest
                );
            });
            
            // Key insights for this garment
            console.log(`\n🏆 WINNER: ${bestQty} pieces at $${bestProfit.toFixed(2)}/hour`);
            
            // Find perfect efficiency quantities
            const perfectEfficiency = results.filter(r => r.utilizationPercent === 100);
            console.log('\nPERFECT EFFICIENCY (100% utilization):');
            perfectEfficiency.forEach(r => {
                console.log(`  ${r.quantity} pieces: $${r.profitPerHour.toFixed(2)}/hour`);
            });
            
            // Compare 8 vs 12 vs 16 specifically
            const r8 = results.find(r => r.quantity === 8);
            const r12 = results.find(r => r.quantity === 12);
            const r16 = results.find(r => r.quantity === 16);
            
            console.log('\nKEY COMPARISON:');
            console.log(`  8 pieces:  $${r8.profitPerHour.toFixed(2)}/hr (100% eff, MAX LTM/piece)`);
            console.log(`  12 pieces: $${r12.profitPerHour.toFixed(2)}/hr (75% eff, good LTM)`);
            console.log(`  16 pieces: $${r16.profitPerHour.toFixed(2)}/hr (100% eff, moderate LTM)`);
        }
        
        // Analyze batching strategy
        this.analyzeBatchingStrategy();
        
        // Final recommendations
        console.log('\n' + '='.repeat(70));
        console.log('🎯 STRATEGIC RECOMMENDATIONS');
        console.log('='.repeat(70));
        
        console.log('\n1. OPTIMAL ORDER SIZES (in priority):');
        console.log('   🥇 8 pieces  - Maximum LTM benefit + perfect efficiency');
        console.log('   🥈 16 pieces - Good LTM + perfect efficiency');
        console.log('   🥉 24 pieces - No LTM but perfect efficiency');
        console.log('   ❌ 12 pieces - AVOID! (25% idle capacity)');
        
        console.log('\n2. PRICING STRATEGY:');
        console.log('   • 8-piece minimum: Charge premium (LTM maximized)');
        console.log('   • 16 pieces: Standard pricing');
        console.log('   • 12 pieces: Add "inefficiency surcharge" or push to 16');
        
        console.log('\n3. BATCHING IS GOLD:');
        console.log('   • Always batch 8-piece orders when possible');
        console.log('   • Run 2×8 or 3×8 to maintain efficiency');
        console.log('   • Collect multiple LTM fees from different customers');
        
        console.log('\n4. SALES SCRIPT:');
        console.log('   "We offer 8-piece minimums for fastest turnaround"');
        console.log('   "Or save with 16 pieces at our standard rate"');
        console.log('   "We can batch your order with others for efficiency"');
        
        console.log('\n' + '='.repeat(70));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(70));
    }
}

// Run the analysis
const analyzer = new MachineUtilizationAnalyzer();
analyzer.runAnalysis().catch(console.error);