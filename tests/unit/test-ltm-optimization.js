/**
 * LTM Fee Optimization Analysis
 * 
 * Tests different fee structures and cutoff points to find
 * the optimal approach for real-world "messy" order quantities.
 */

const https = require('https');
const url = require('url');

class LTMOptimizer {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Machine configuration
        this.machine = {
            heads: 8,
            costPerHour: 45.00,
            minutesPerRun: 30  // For 8 pieces at 8000 stitches
        };
        
        // Common real-world order quantities
        this.realOrderQuantities = [10, 12, 15, 18, 20, 22, 23, 25, 30, 35, 40];
        
        // LTM structures to test
        this.ltmStructures = {
            'Current (< 24)': {
                cutoff: 24,
                fees: { default: 50 }
            },
            'Option B (< 16)': {
                cutoff: 16,
                fees: { default: 50 }
            },
            'Option C (< 32)': {
                cutoff: 32,
                fees: { default: 50 }
            },
            'Graduated': {
                cutoff: 32,
                fees: {
                    8: 60,   // 1-8 pieces
                    16: 50,  // 9-16 pieces
                    24: 30,  // 17-24 pieces
                    32: 15   // 25-31 pieces
                }
            },
            'Efficiency-Based': {
                cutoff: 32,
                fees: 'dynamic'  // Calculate based on inefficiency cost
            }
        };
        
        // Results storage
        this.results = {};
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
        try {
            const bundle = await this.fetchAPI('/api/pricing-bundle?method=EMB&styleNumber=PC61');
            
            this.tiers = {};
            this.marginDenominator = 0.57; // 2026 margin (43%)

            if (bundle.tiersR) {
                bundle.tiersR.forEach(tier => {
                    this.tiers[tier.TierLabel] = {
                        embCost: 0,
                        ltmFee: tier.LTM_Fee || 0
                    };
                });
                this.marginDenominator = bundle.tiersR[0].MarginDenominator || 0.57;
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
     * Calculate machine efficiency and cost for a quantity
     */
    calculateMachineMetrics(quantity) {
        const fullRuns = Math.floor(quantity / this.machine.heads);
        const partialPieces = quantity % this.machine.heads;
        const totalRuns = partialPieces > 0 ? fullRuns + 1 : fullRuns;
        
        const runTimeMinutes = totalRuns * this.machine.minutesPerRun;
        const machineCost = (runTimeMinutes / 60) * this.machine.costPerHour;
        const costPerPiece = machineCost / quantity;
        
        const totalCapacity = totalRuns * this.machine.heads;
        const efficiency = (quantity / totalCapacity) * 100;
        const idleHeads = totalCapacity - quantity;
        const inefficiencyCost = (idleHeads / quantity) * costPerPiece;
        
        return {
            fullRuns,
            partialPieces,
            totalRuns,
            runTimeMinutes,
            machineCost,
            costPerPiece,
            efficiency,
            idleHeads,
            inefficiencyCost,
            effectiveCostPerPiece: costPerPiece + inefficiencyCost
        };
    }
    
    /**
     * Get LTM fee for a structure and quantity
     */
    getLTMFee(structure, quantity) {
        if (quantity >= structure.cutoff) return 0;
        
        if (structure.fees === 'dynamic') {
            // Calculate based on inefficiency
            const metrics = this.calculateMachineMetrics(quantity);
            // Charge $2 per idle head to compensate
            return metrics.idleHeads * 2;
        }
        
        if (structure.fees.default !== undefined) {
            return structure.fees.default;
        }
        
        // Graduated fees
        for (const [threshold, fee] of Object.entries(structure.fees).sort((a, b) => b[0] - a[0])) {
            if (quantity <= parseInt(threshold)) {
                return fee;
            }
        }
        
        return 0;
    }
    
    /**
     * Calculate profitability for a quantity under a specific LTM structure
     */
    calculateScenario(quantity, ltmStructure, garmentCost = 3.50) {
        const machineMetrics = this.calculateMachineMetrics(quantity);
        
        // Determine tier (using cutoff as minimum for tier selection)
        let tierQuantity = quantity;
        if (quantity < ltmStructure.cutoff) {
            tierQuantity = ltmStructure.cutoff;  // Use cutoff tier pricing
        }
        
        const tier = tierQuantity < 24 ? '1-23' : tierQuantity < 48 ? '24-47' : tierQuantity < 72 ? '48-71' : '72+';
        const tierData = this.tiers[tier];
        
        // Costs
        const totalCostPerPiece = garmentCost + machineMetrics.effectiveCostPerPiece;
        
        // Revenue
        const embCost = tierData.embCost || 6.00;
        const baseDecoratedPrice = (garmentCost / this.marginDenominator) + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice);
        
        // LTM fee
        const ltmFeeTotal = this.getLTMFee(ltmStructure, quantity);
        const ltmPerPiece = ltmFeeTotal / quantity;
        const finalPricePerPiece = roundedBase + ltmPerPiece;
        
        // Profit
        const profitPerPiece = finalPricePerPiece - totalCostPerPiece;
        const profitMargin = (profitPerPiece / finalPricePerPiece) * 100;
        
        // Hourly metrics
        const ordersPerHour = 60 / machineMetrics.runTimeMinutes;
        const profitPerHour = profitPerPiece * quantity * ordersPerHour;
        
        return {
            quantity,
            tier,
            ...machineMetrics,
            ltmFeeTotal,
            ltmPerPiece,
            customerPrice: finalPricePerPiece,
            profitPerPiece,
            profitMargin,
            profitPerHour,
            totalOrderRevenue: finalPricePerPiece * quantity,
            totalOrderProfit: profitPerPiece * quantity
        };
    }
    
    async runAnalysis() {
        console.log('='.repeat(70));
        console.log('LTM FEE OPTIMIZATION ANALYSIS');
        console.log('='.repeat(70));
        console.log('Finding optimal fee structure for real-world order quantities');
        console.log('='.repeat(70));
        
        await this.loadConfiguration();
        
        // First, show machine efficiency for common quantities
        console.log('MACHINE EFFICIENCY ANALYSIS');
        console.log('-'.repeat(70));
        console.log('Qty | Runs | Efficiency | Idle Heads | Inefficiency Cost');
        console.log('----|------|------------|------------|------------------');
        
        for (const qty of this.realOrderQuantities) {
            const metrics = this.calculateMachineMetrics(qty);
            console.log(
                `${qty.toString().padEnd(3)} | ` +
                `${metrics.totalRuns}`.padEnd(4) + ' | ' +
                `${metrics.efficiency.toFixed(0)}%`.padEnd(10) + ' | ' +
                `${metrics.idleHeads}`.padEnd(10) + ' | ' +
                `$${metrics.inefficiencyCost.toFixed(2)}/piece`
            );
        }
        
        // Test each LTM structure
        console.log('\n' + '='.repeat(70));
        console.log('LTM STRUCTURE COMPARISON');
        console.log('='.repeat(70));
        
        for (const [name, structure] of Object.entries(this.ltmStructures)) {
            console.log(`\n${name}`);
            console.log('-'.repeat(50));
            
            this.results[name] = [];
            let totalProfit = 0;
            let totalRevenue = 0;
            
            console.log('Qty | LTM Fee | Price/Pc | Profit/Pc | Margin | $/Hour');
            console.log('----|---------|----------|-----------|--------|--------');
            
            for (const qty of this.realOrderQuantities) {
                const result = this.calculateScenario(qty, structure);
                this.results[name].push(result);
                
                totalProfit += result.totalOrderProfit;
                totalRevenue += result.totalOrderRevenue;
                
                console.log(
                    `${qty.toString().padEnd(3)} | ` +
                    `$${result.ltmFeeTotal.toString().padEnd(6)} | ` +
                    `$${result.customerPrice.toFixed(2)}`.padEnd(8) + ' | ' +
                    `$${result.profitPerPiece.toFixed(2)}`.padEnd(9) + ' | ' +
                    `${result.profitMargin.toFixed(0)}%`.padEnd(6) + ' | ' +
                    `$${result.profitPerHour.toFixed(0)}`
                );
            }
            
            const avgMargin = (totalProfit / totalRevenue) * 100;
            const avgProfitPerHour = this.results[name].reduce((sum, r) => sum + r.profitPerHour, 0) / this.results[name].length;
            
            console.log(`\nAVERAGE MARGIN: ${avgMargin.toFixed(1)}%`);
            console.log(`AVERAGE $/HOUR: $${avgProfitPerHour.toFixed(2)}`);
        }
        
        // Compare structures
        console.log('\n' + '='.repeat(70));
        console.log('STRUCTURE COMPARISON SUMMARY');
        console.log('='.repeat(70));
        
        const summaries = {};
        for (const [name, results] of Object.entries(this.results)) {
            const avgProfitPerHour = results.reduce((sum, r) => sum + r.profitPerHour, 0) / results.length;
            const avgMargin = results.reduce((sum, r) => sum + r.profitMargin, 0) / results.length;
            const avgCustomerPrice = results.reduce((sum, r) => sum + r.customerPrice, 0) / results.length;
            
            summaries[name] = {
                avgProfitPerHour,
                avgMargin,
                avgCustomerPrice
            };
        }
        
        // Rank by profit per hour
        const ranked = Object.entries(summaries).sort((a, b) => b[1].avgProfitPerHour - a[1].avgProfitPerHour);
        
        console.log('\nRANKED BY PROFITABILITY:');
        ranked.forEach(([name, summary], index) => {
            console.log(`${index + 1}. ${name}`);
            console.log(`   Avg $/Hour: $${summary.avgProfitPerHour.toFixed(2)}`);
            console.log(`   Avg Margin: ${summary.avgMargin.toFixed(1)}%`);
            console.log(`   Avg Price: $${summary.avgCustomerPrice.toFixed(2)}`);
        });
        
        // Specific insights
        console.log('\n' + '='.repeat(70));
        console.log('KEY INSIGHTS');
        console.log('='.repeat(70));
        
        // Test impact at specific quantities
        const testQty = 15;  // Common order size
        console.log(`\nCase Study: ${testQty}-piece order`);
        console.log('-'.repeat(50));
        
        for (const [name, structure] of Object.entries(this.ltmStructures)) {
            const result = this.calculateScenario(testQty, structure);
            console.log(`${name}:`);
            console.log(`  Customer pays: $${result.customerPrice.toFixed(2)}/piece`);
            console.log(`  Your profit: $${result.profitPerPiece.toFixed(2)}/piece`);
            console.log(`  Profit/hour: $${result.profitPerHour.toFixed(2)}`);
        }
        
        // Recommendations
        console.log('\n' + '='.repeat(70));
        console.log('💡 RECOMMENDATIONS');
        console.log('='.repeat(70));
        
        const winner = ranked[0];
        console.log(`\n✅ OPTIMAL STRUCTURE: ${winner[0]}`);
        
        if (winner[0].includes('Current')) {
            console.log('\nYour current system is already optimal!');
            console.log('The $50 fee under 24 pieces strikes the right balance.');
        } else if (winner[0].includes('Graduated')) {
            console.log('\nConsider graduated fees:');
            console.log('  • 1-8 pieces: $60 (covers extreme inefficiency)');
            console.log('  • 9-16 pieces: $50 (moderate inefficiency)');
            console.log('  • 17-24 pieces: $30 (mild inefficiency)');
            console.log('  • 25-31 pieces: $15 (minimal inefficiency)');
        } else if (winner[0].includes('Efficiency-Based')) {
            console.log('\nCharge based on actual inefficiency:');
            console.log('  • $2 per idle machine head');
            console.log('  • Transparent and fair');
            console.log('  • Automatically adjusts to order size');
        }
        
        console.log('\n📊 WHY THIS WORKS:');
        console.log('1. Compensates for machine inefficiency at odd quantities');
        console.log('2. Maintains healthy margins on small orders');
        console.log('3. Simple enough for customers to understand');
        console.log('4. Encourages efficient quantities without forcing them');
        
        console.log('\n🎯 IMPLEMENTATION TIPS:');
        console.log('1. Frame as "Setup & Handling" not "Small Batch Fee"');
        console.log('2. Show savings at 24+ pieces as incentive');
        console.log('3. Offer to combine orders to reduce fees');
        console.log('4. Highlight fast turnaround for small orders');
        
        console.log('\n' + '='.repeat(70));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(70));
    }
}

// Run the analysis
const optimizer = new LTMOptimizer();
optimizer.runAnalysis().catch(console.error);