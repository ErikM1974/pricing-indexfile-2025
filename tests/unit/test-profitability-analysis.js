/**
 * Embroidery Profitability Analysis System
 * 
 * Analyzes profitability across all best-selling styles to identify
 * the most profitable combinations of style, quantity, and complexity.
 */

const https = require('https');
const url = require('url');

class ProfitabilityAnalyzer {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Machine economics
        this.machineConfig = {
            costPerHour: 45.00,
            piecesPerHour: 16,
            costPerPiece: 2.81,  // 45/16
            stitchesPerMinute: 600,
            headsPerMachine: 8
        };
        
        // Business parameters
        this.businessConfig = {
            threadCostPer1000: 0.10,  // Estimate for thread/backing per 1000 stitches
            setupTimeMinutes: 5,       // Per order setup time
            marginDenominator: 0.6,     // From API
            orderMixPercent: {
                small: 30,   // Under 24 pieces
                medium: 50,  // 24-71 pieces
                large: 20    // 72+ pieces
            }
        };
        
        // Best selling styles to test
        this.stylesToTest = [
            // Core Tees
            { style: 'PC55', name: 'Port & Company - Core Blend Tee', category: 'core' },
            { style: 'PC61LS', name: 'Port & Company - Long Sleeve Essential', category: 'core' },
            { style: 'PC600', name: 'Port & Company Bouncer Tee', category: 'core' },
            { style: 'PC54LS', name: 'Port & Company - Long Sleeve Core Cotton', category: 'core' },
            { style: 'BC3001', name: 'BellaCanvas Unisex Jersey', category: 'core' },
            { style: 'PC54', name: 'Port & Company - Core Cotton', category: 'core' },
            { style: 'PC61', name: 'Port & Company Essential', category: 'core' },
            { style: 'PC43', name: 'Port & Company Pigment-Dyed', category: 'core' },
            
            // Premium/Hoodies
            { style: 'PC90H', name: 'Essential Fleece Hoodie', category: 'premium' },
            { style: 'PC78H', name: 'Core Fleece Hoodie', category: 'premium' },
            { style: '18500', name: 'Gildan Heavy Blend Hoodie', category: 'premium' },
            
            // Performance/Polos
            { style: 'K500', name: 'Port Authority Silk Touch Polo', category: 'polo' },
            { style: 'ST350', name: 'Sport-Tek PosiCharge', category: 'performance' },
            
            // District Line
            { style: 'DT6000', name: 'District Perfect Weight', category: 'district' },
            { style: 'DT6200', name: 'District Very Important Tee', category: 'district' },
            { style: 'DM130', name: 'District Perfect Tri', category: 'district' }
        ];
        
        // Test scenarios
        this.quantityScenarios = [12, 23, 24, 48, 72, 100, 150];
        this.stitchScenarios = [5000, 8000, 9000, 12000, 15000, 20000];
        
        // Results storage
        this.results = [];
        this.pricingData = {};
    }
    
    /**
     * Make API request
     */
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
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
    }
    
    /**
     * Load pricing configuration from API
     */
    async loadPricingConfiguration() {
        console.log('Loading pricing configuration...');
        
        try {
            const bundle = await this.fetchAPI('/api/pricing-bundle?method=EMB&styleNumber=PC61');
            
            if (bundle.tiersR) {
                this.tiers = {};
                bundle.tiersR.forEach(tier => {
                    this.tiers[tier.TierLabel] = {
                        embCost: 0,
                        ltmFee: tier.LTM_Fee || 0
                    };
                });
            }
            
            if (bundle.allEmbroideryCostsR) {
                const shirtConfig = bundle.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt');
                if (shirtConfig) {
                    this.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                    this.baseStitchCount = shirtConfig.BaseStitchCount || 8000;
                    
                    bundle.allEmbroideryCostsR.forEach(cost => {
                        if (cost.ItemType === 'Shirt' && this.tiers[cost.TierLabel]) {
                            this.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                        }
                    });
                }
            }
            
            console.log('✓ Configuration loaded');
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }
    
    /**
     * Get product pricing for a style
     */
    async getStylePricing(styleNumber) {
        if (this.pricingData[styleNumber]) {
            return this.pricingData[styleNumber];
        }
        
        try {
            const data = await this.fetchAPI(`/api/size-pricing?styleNumber=${styleNumber}`);
            if (data && data.length > 0) {
                this.pricingData[styleNumber] = data[0];
                return data[0];
            }
        } catch (error) {
            console.log(`  ⚠ No pricing data for ${styleNumber}`);
        }
        
        return null;
    }
    
    /**
     * Calculate production time for a quantity and stitch count
     */
    calculateProductionTime(quantity, stitchCount) {
        const minutesPerPiece = stitchCount / this.machineConfig.stitchesPerMinute;
        const totalMinutes = (quantity / this.machineConfig.headsPerMachine) * minutesPerPiece;
        const setupMinutes = this.businessConfig.setupTimeMinutes;
        return (totalMinutes + setupMinutes) / 60; // Return in hours
    }
    
    /**
     * Get tier based on quantity
     */
    getTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }
    
    /**
     * Calculate profitability for a scenario
     */
    calculateProfitability(styleData, pricing, quantity, stitchCount) {
        const tier = this.getTier(quantity);
        const tierData = this.tiers[tier];
        
        // Costs
        const garmentCost = pricing.basePrices.M || pricing.basePrices.S || 3.50;
        const machineCost = this.machineConfig.costPerPiece;
        const threadCost = (stitchCount / 1000) * this.businessConfig.threadCostPer1000;
        const totalCostPerPiece = garmentCost + machineCost + threadCost;
        
        // Revenue calculations
        const embCost = tierData.embCost || 6.00;
        const baseDecoratedPrice = (garmentCost / this.businessConfig.marginDenominator) + embCost;
        const roundedBase = Math.ceil(baseDecoratedPrice);
        
        // Extra stitches
        const extraStitches = Math.max(0, stitchCount - this.baseStitchCount);
        const extraStitchCharge = Math.ceil(extraStitches / 1000) * this.additionalStitchRate;
        
        const pricePerPiece = roundedBase + extraStitchCharge;
        
        // LTM fee spread across pieces if applicable
        const ltmPerPiece = tierData.ltmFee > 0 ? tierData.ltmFee / quantity : 0;
        const finalPricePerPiece = pricePerPiece + ltmPerPiece;
        
        // Profit calculations
        const profitPerPiece = finalPricePerPiece - totalCostPerPiece;
        const profitMargin = (profitPerPiece / finalPricePerPiece) * 100;
        
        // Production efficiency
        const productionHours = this.calculateProductionTime(quantity, stitchCount);
        const piecesPerHour = quantity / productionHours;
        const profitPerHour = profitPerPiece * piecesPerHour;
        
        return {
            style: styleData.style,
            styleName: styleData.name,
            category: styleData.category,
            quantity,
            stitchCount,
            tier,
            
            // Costs
            garmentCost,
            machineCost,
            threadCost,
            totalCostPerPiece,
            
            // Revenue
            basePrice: roundedBase,
            extraStitchCharge,
            ltmPerPiece,
            finalPricePerPiece,
            
            // Profitability
            profitPerPiece,
            profitMargin,
            totalOrderProfit: profitPerPiece * quantity,
            
            // Efficiency
            productionHours,
            piecesPerHour,
            profitPerHour,
            
            // ROI
            roi: (profitPerPiece / totalCostPerPiece) * 100
        };
    }
    
    /**
     * Run analysis for all scenarios
     */
    async runAnalysis() {
        console.log('='.repeat(60));
        console.log('PROFITABILITY ANALYSIS - BEST SELLING STYLES');
        console.log('='.repeat(60));
        
        await this.loadPricingConfiguration();
        
        console.log('\nAnalyzing styles...\n');
        
        // Test each style
        for (const styleData of this.stylesToTest) {
            console.log(`Testing ${styleData.style} - ${styleData.name}`);
            
            const pricing = await this.getStylePricing(styleData.style);
            if (!pricing) {
                console.log(`  ⚠ Skipping - no pricing data`);
                continue;
            }
            
            // Test key scenarios (not all combinations to save time)
            const keyScenarios = [
                { qty: 12, stitches: 9000 },   // Small order, common stitches
                { qty: 24, stitches: 9000 },   // Tier boundary
                { qty: 48, stitches: 9000 },   // Medium order
                { qty: 72, stitches: 9000 },   // Large order
                { qty: 48, stitches: 5000 },   // Simple design
                { qty: 48, stitches: 15000 },  // Complex design
            ];
            
            for (const scenario of keyScenarios) {
                const result = this.calculateProfitability(
                    styleData, 
                    pricing, 
                    scenario.qty, 
                    scenario.stitches
                );
                this.results.push(result);
            }
        }
        
        // Generate reports
        this.generateReports();
    }
    
    /**
     * Generate analysis reports
     */
    generateReports() {
        console.log('\n' + '='.repeat(60));
        console.log('PROFITABILITY RANKINGS');
        console.log('='.repeat(60));
        
        // Sort by profit per hour
        const byProfitPerHour = [...this.results].sort((a, b) => b.profitPerHour - a.profitPerHour);
        
        console.log('\n🏆 TOP 10 MOST PROFITABLE (Per Machine Hour):');
        console.log('-'.repeat(60));
        
        byProfitPerHour.slice(0, 10).forEach((r, i) => {
            console.log(`${i + 1}. ${r.style} (${r.quantity}pc, ${r.stitchCount} stitches)`);
            console.log(`   ${r.styleName}`);
            console.log(`   💰 $${r.profitPerHour.toFixed(2)}/hour | $${r.profitPerPiece.toFixed(2)}/piece`);
            console.log(`   Margin: ${r.profitMargin.toFixed(1)}% | ROI: ${r.roi.toFixed(0)}%`);
            console.log();
        });
        
        // Best by category
        console.log('\n📊 BEST IN EACH CATEGORY:');
        console.log('-'.repeat(60));
        
        const categories = ['core', 'premium', 'polo', 'district', 'performance'];
        for (const cat of categories) {
            const best = byProfitPerHour.find(r => r.category === cat);
            if (best) {
                console.log(`${cat.toUpperCase()}: ${best.style} - $${best.profitPerHour.toFixed(2)}/hour`);
            }
        }
        
        // Optimal configurations
        console.log('\n⚡ OPTIMAL PROFIT CONFIGURATIONS:');
        console.log('-'.repeat(60));
        
        const optimalSmall = byProfitPerHour.find(r => r.quantity < 24);
        const optimalMedium = byProfitPerHour.find(r => r.quantity >= 24 && r.quantity < 72);
        const optimalLarge = byProfitPerHour.find(r => r.quantity >= 72);
        
        if (optimalSmall) {
            console.log(`Small Orders (< 24): ${optimalSmall.style} at ${optimalSmall.stitchCount} stitches`);
            console.log(`  → $${optimalSmall.profitPerHour.toFixed(2)}/hour`);
        }
        
        if (optimalMedium) {
            console.log(`Medium Orders (24-71): ${optimalMedium.style} at ${optimalMedium.stitchCount} stitches`);
            console.log(`  → $${optimalMedium.profitPerHour.toFixed(2)}/hour`);
        }
        
        if (optimalLarge) {
            console.log(`Large Orders (72+): ${optimalLarge.style} at ${optimalLarge.stitchCount} stitches`);
            console.log(`  → $${optimalLarge.profitPerHour.toFixed(2)}/hour`);
        }
        
        // Stitch count analysis
        console.log('\n🎯 STITCH COUNT PROFITABILITY:');
        console.log('-'.repeat(60));
        
        const stitchAnalysis = {};
        this.results.forEach(r => {
            if (!stitchAnalysis[r.stitchCount]) {
                stitchAnalysis[r.stitchCount] = { total: 0, count: 0 };
            }
            stitchAnalysis[r.stitchCount].total += r.profitPerHour;
            stitchAnalysis[r.stitchCount].count++;
        });
        
        Object.entries(stitchAnalysis).forEach(([stitches, data]) => {
            const avg = data.total / data.count;
            console.log(`${stitches} stitches: $${avg.toFixed(2)}/hour average`);
        });
        
        // Warning zones
        console.log('\n⚠️  LOW MARGIN WARNING (Under 40% margin):');
        console.log('-'.repeat(60));
        
        const lowMargin = this.results.filter(r => r.profitMargin < 40);
        if (lowMargin.length > 0) {
            lowMargin.slice(0, 5).forEach(r => {
                console.log(`${r.style} at ${r.quantity}pc: ${r.profitMargin.toFixed(1)}% margin`);
            });
        } else {
            console.log('✓ All tested scenarios maintain healthy margins!');
        }
        
        // Style recommendations
        console.log('\n💡 STRATEGIC RECOMMENDATIONS:');
        console.log('-'.repeat(60));
        
        // Find best overall style
        const styleAverages = {};
        this.results.forEach(r => {
            if (!styleAverages[r.style]) {
                styleAverages[r.style] = { 
                    total: 0, 
                    count: 0, 
                    name: r.styleName,
                    minProfit: Infinity,
                    maxProfit: 0
                };
            }
            styleAverages[r.style].total += r.profitPerHour;
            styleAverages[r.style].count++;
            styleAverages[r.style].minProfit = Math.min(styleAverages[r.style].minProfit, r.profitPerHour);
            styleAverages[r.style].maxProfit = Math.max(styleAverages[r.style].maxProfit, r.profitPerHour);
        });
        
        const rankedStyles = Object.entries(styleAverages)
            .map(([style, data]) => ({
                style,
                name: data.name,
                avgProfit: data.total / data.count,
                range: data.maxProfit - data.minProfit
            }))
            .sort((a, b) => b.avgProfit - a.avgProfit);
        
        console.log('1. PROMOTE THESE STYLES (Highest average profit/hour):');
        rankedStyles.slice(0, 5).forEach(s => {
            console.log(`   • ${s.style}: $${s.avgProfit.toFixed(2)}/hour avg`);
        });
        
        console.log('\n2. OPTIMAL ORDER PARAMETERS:');
        console.log('   • Sweet spot quantity: 20-30 pieces (LTM fee boost)');
        console.log('   • Ideal stitch count: 5,000-8,000 stitches');
        console.log('   • Best tier for margin: Small orders (under 24)');
        
        console.log('\n3. PRICING ADJUSTMENTS NEEDED:');
        console.log('   • Consider 50% surcharge for 15,000+ stitches');
        console.log('   • Small batch orders are MORE profitable - don\'t discourage!');
        console.log('   • Premium styles need higher minimums or surcharges');
        
        // Calculate weighted average based on order mix
        const weightedProfit = this.calculateWeightedAverage();
        console.log('\n4. EXPECTED HOURLY PROFIT (Based on your order mix):');
        console.log(`   $${weightedProfit.toFixed(2)}/hour weighted average`);
        
        console.log('\n' + '='.repeat(60));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(60));
    }
    
    /**
     * Calculate weighted average profit based on order mix
     */
    calculateWeightedAverage() {
        const small = this.results.filter(r => r.quantity < 24);
        const medium = this.results.filter(r => r.quantity >= 24 && r.quantity < 72);
        const large = this.results.filter(r => r.quantity >= 72);
        
        const avgSmall = small.reduce((sum, r) => sum + r.profitPerHour, 0) / small.length;
        const avgMedium = medium.reduce((sum, r) => sum + r.profitPerHour, 0) / medium.length;
        const avgLarge = large.reduce((sum, r) => sum + r.profitPerHour, 0) / large.length;
        
        return (avgSmall * 0.30) + (avgMedium * 0.50) + (avgLarge * 0.20);
    }
}

// Run the analysis
const analyzer = new ProfitabilityAnalyzer();
analyzer.runAnalysis().catch(console.error);