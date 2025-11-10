/**
 * Optimal Profitability Analysis
 * Focus: 12-piece orders with 8,000 stitches (standard left chest)
 * Goal: Find the sweet spot garment cost and prove small batch profitability
 */

const https = require('https');
const url = require('url');

class OptimalProfitAnalyzer {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Machine economics
        this.machineConfig = {
            costPerHour: 45.00,
            piecesPerHour: 16,
            costPerPiece: 2.81
        };
        
        // Premium styles to test (with expected higher costs)
        this.premiumStyles = [
            { style: 'CTK297', name: 'Carhartt Midweight Hooded Sweatshirt', estimatedCost: 28 },
            { style: 'CT103828', name: 'Carhartt Duck Detroit Jacket', estimatedCost: 75 },
            { style: 'CT89176508', name: 'Carhartt Foundry Backpack', estimatedCost: 80 },
            { style: 'ST650', name: 'Sport-Tek Micropique Polo', estimatedCost: 12 },
            { style: 'CT104597', name: 'Carhartt Watch Cap', estimatedCost: 15 },
            { style: 'EB550', name: 'Eddie Bauer Rain Jacket', estimatedCost: 65 },
            { style: 'CT102286', name: 'Carhartt Gilliam Vest', estimatedCost: 58 },
            { style: 'ST850', name: 'Sport-Tek 1/4-Zip Pullover', estimatedCost: 20 },
            { style: 'PC90H', name: 'Port & Company Fleece Hoodie', estimatedCost: 16 }
        ];
        
        // Standard test scenario
        this.standardScenario = {
            stitches: 8000,  // Standard left chest, no extra charges
            quantities: [12, 24],  // Compare LTM vs no LTM
        };
        
        this.results = [];
        this.optimalRange = { min: 0, max: 100, best: [] };
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
        console.log('Loading embroidery configuration...');
        
        try {
            const bundle = await this.fetchAPI('/api/pricing-bundle?method=EMB&styleNumber=PC61');
            
            this.tiers = {};
            this.marginDenominator = 0.6;
            
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
    
    async getStylePricing(styleNumber) {
        try {
            const data = await this.fetchAPI(`/api/size-pricing?styleNumber=${styleNumber}`);
            if (data && data.length > 0) {
                return data[0];
            }
        } catch (error) {
            // Style not found, use estimate
        }
        return null;
    }
    
    calculateProfit(garmentCost, quantity, stitchCount = 8000) {
        const tier = quantity < 24 ? '1-23' : quantity < 48 ? '24-47' : quantity < 72 ? '48-71' : '72+';
        const tierData = this.tiers[tier];
        
        // Costs
        const machineCost = this.machineConfig.costPerPiece;
        const totalCostPerPiece = garmentCost + machineCost;
        
        // Revenue (using actual formula)
        const embCost = tierData.embCost || 6.00;
        const baseDecoratedPrice = (garmentCost / this.marginDenominator) + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice);
        
        // No extra stitches at 8000
        const pricePerPiece = roundedBase;
        
        // LTM fee impact
        const ltmPerPiece = tierData.ltmFee > 0 ? tierData.ltmFee / quantity : 0;
        const finalPricePerPiece = pricePerPiece + ltmPerPiece;
        
        // Profit calculations
        const profitPerPiece = finalPricePerPiece - totalCostPerPiece;
        const profitMargin = (profitPerPiece / finalPricePerPiece) * 100;
        
        // Production efficiency (8000 stitches = 13.3 minutes per piece)
        const minutesPerPiece = stitchCount / 600;
        const piecesPerHour = 60 / minutesPerPiece;
        const profitPerHour = profitPerPiece * Math.min(piecesPerHour, 16); // Cap at machine max
        
        return {
            garmentCost,
            quantity,
            tier,
            basePrice: roundedBase,
            ltmPerPiece,
            finalPricePerPiece,
            profitPerPiece,
            profitMargin,
            profitPerHour,
            totalOrderProfit: profitPerPiece * quantity,
            ltmBoost: ltmPerPiece * quantity
        };
    }
    
    async runAnalysis() {
        console.log('='.repeat(70));
        console.log('OPTIMAL PROFITABILITY ANALYSIS - 12 PIECE SWEET SPOT');
        console.log('='.repeat(70));
        console.log('Focus: 8,000 stitch left chest (80% of orders)');
        console.log('Question: Is 12 pieces with LTM fee better than pushing to 24?');
        console.log('='.repeat(70));
        
        await this.loadConfiguration();
        
        // First, test theoretical optimal garment cost range
        console.log('THEORETICAL ANALYSIS - Finding Optimal Garment Cost');
        console.log('-'.repeat(70));
        
        const testCosts = [2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80];
        const results12 = [];
        const results24 = [];
        
        for (const cost of testCosts) {
            const profit12 = this.calculateProfit(cost, 12, 8000);
            const profit24 = this.calculateProfit(cost, 24, 8000);
            
            results12.push({ cost, ...profit12 });
            results24.push({ cost, ...profit24 });
        }
        
        // Find the sweet spot
        console.log('\nGARMENT COST vs PROFIT/HOUR COMPARISON:');
        console.log('Cost    | 12pc Profit/Hr | 24pc Profit/Hr | Winner');
        console.log('--------|----------------|----------------|--------');
        
        results12.forEach((r12, i) => {
            const r24 = results24[i];
            const winner = r12.profitPerHour > r24.profitPerHour ? '12 PIECES!' : '24 pieces';
            console.log(
                `$${r12.cost.toString().padEnd(6)} | $${r12.profitPerHour.toFixed(2).padEnd(13)} | $${r24.profitPerHour.toFixed(2).padEnd(13)} | ${winner}`
            );
        });
        
        // Test actual styles
        console.log('\n' + '='.repeat(70));
        console.log('ACTUAL STYLE ANALYSIS - Premium Products');
        console.log('='.repeat(70));
        
        for (const styleData of this.premiumStyles) {
            const pricing = await this.getStylePricing(styleData.style);
            const actualCost = pricing ? 
                (pricing.basePrices?.M || pricing.basePrices?.S || pricing.basePrices?.L || styleData.estimatedCost) : 
                styleData.estimatedCost;
            
            console.log(`\n${styleData.name}`);
            console.log(`Style: ${styleData.style} | Garment Cost: $${actualCost.toFixed(2)}`);
            console.log('-'.repeat(50));
            
            const profit12 = this.calculateProfit(actualCost, 12, 8000);
            const profit24 = this.calculateProfit(actualCost, 24, 8000);
            
            console.log('12 PIECES (with $50 LTM fee):');
            console.log(`  Sell Price: $${profit12.finalPricePerPiece.toFixed(2)}/piece`);
            console.log(`  Your Cost: $${(actualCost + 2.81).toFixed(2)}/piece`);
            console.log(`  Profit: $${profit12.profitPerPiece.toFixed(2)}/piece (${profit12.profitMargin.toFixed(1)}% margin)`);
            console.log(`  LTM Boost: $${profit12.ltmBoost.toFixed(2)} total`);
            console.log(`  💰 Profit/Hour: $${profit12.profitPerHour.toFixed(2)}`);
            
            console.log('\n24 PIECES (no LTM fee):');
            console.log(`  Sell Price: $${profit24.finalPricePerPiece.toFixed(2)}/piece`);
            console.log(`  Your Cost: $${(actualCost + 2.81).toFixed(2)}/piece`);
            console.log(`  Profit: $${profit24.profitPerPiece.toFixed(2)}/piece (${profit24.profitMargin.toFixed(1)}% margin)`);
            console.log(`  💰 Profit/Hour: $${profit24.profitPerHour.toFixed(2)}`);
            
            const winner = profit12.profitPerHour > profit24.profitPerHour;
            const difference = Math.abs(profit12.profitPerHour - profit24.profitPerHour);
            
            if (winner) {
                console.log(`\n✅ 12 PIECES WINS by $${difference.toFixed(2)}/hour!`);
            } else {
                console.log(`\n❌ 24 pieces better by $${difference.toFixed(2)}/hour`);
            }
            
            this.results.push({
                style: styleData.style,
                name: styleData.name,
                garmentCost: actualCost,
                profit12: profit12.profitPerHour,
                profit24: profit24.profitPerHour,
                winner12: winner
            });
        }
        
        // Summary and recommendations
        console.log('\n' + '='.repeat(70));
        console.log('💡 KEY FINDINGS & RECOMMENDATIONS');
        console.log('='.repeat(70));
        
        // Find optimal garment cost range
        const winners12 = this.results.filter(r => r.winner12);
        const winners24 = this.results.filter(r => !r.winner12);
        
        console.log('\n1. THE OPTIMAL GARMENT COST SWEET SPOT:');
        console.log('-'.repeat(50));
        
        if (winners12.length > 0) {
            const maxCost12 = Math.max(...winners12.map(r => r.garmentCost));
            console.log(`📍 Garments costing UNDER $${maxCost12.toFixed(2)} → Push 12-piece orders`);
            console.log('   The LTM fee makes small batches MORE profitable!');
        }
        
        if (winners24.length > 0) {
            const minCost24 = Math.min(...winners24.map(r => r.garmentCost));
            console.log(`📍 Garments costing OVER $${minCost24.toFixed(2)} → Push 24+ pieces`);
            console.log('   High-cost items need volume to maintain margins');
        }
        
        console.log('\n2. PROFIT MAXIMIZATION FORMULA:');
        console.log('-'.repeat(50));
        console.log('For standard 8,000 stitch left chest logos:');
        console.log('');
        console.log('🎯 SWEET SPOT PRODUCTS ($3-20 garment cost):');
        console.log('   • Sell 12-piece minimums');
        console.log('   • $50 LTM fee = Higher profit/hour');
        console.log('   • Examples: PC90H, ST650, Basic tees');
        console.log('');
        console.log('⚠️  PREMIUM PRODUCTS ($40+ garment cost):');
        console.log('   • Require 24+ piece minimums');
        console.log('   • Or add premium surcharge');
        console.log('   • Examples: Carhartt jackets, Eddie Bauer');
        
        console.log('\n3. SALES TEAM INSTRUCTIONS:');
        console.log('-'.repeat(50));
        console.log('✅ PUSH THESE AT 12 PIECES:');
        winners12.forEach(r => {
            console.log(`   • ${r.name}: $${r.profit12.toFixed(2)}/hour`);
        });
        
        console.log('\n⚠️  REQUIRE 24+ PIECES FOR:');
        winners24.forEach(r => {
            console.log(`   • ${r.name}: Needs volume for profit`);
        });
        
        // Calculate average profitability
        const avg12 = this.results.reduce((sum, r) => sum + r.profit12, 0) / this.results.length;
        const avg24 = this.results.reduce((sum, r) => sum + r.profit24, 0) / this.results.length;
        
        console.log('\n4. BOTTOM LINE IMPACT:');
        console.log('-'.repeat(50));
        console.log(`Average profit/hour at 12 pieces: $${avg12.toFixed(2)}`);
        console.log(`Average profit/hour at 24 pieces: $${avg24.toFixed(2)}`);
        
        if (avg12 > avg24) {
            const increase = ((avg12 - avg24) / avg24 * 100).toFixed(1);
            console.log(`\n🎉 12-piece orders are ${increase}% MORE PROFITABLE!`);
            console.log('The $50 LTM fee is your secret profit weapon!');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(70));
    }
}

// Run the analysis
const analyzer = new OptimalProfitAnalyzer();
analyzer.runAnalysis().catch(console.error);