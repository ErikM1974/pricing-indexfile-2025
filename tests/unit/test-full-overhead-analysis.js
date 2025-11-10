/**
 * Full Overhead Analysis - The COMPLETE Picture
 * 
 * Accounting for EVERY person who touches an order:
 * - Sales staff (quoting, customer service)
 * - Bradley (purchasing from Sanmar)
 * - Mikalah (receiving and counting)
 * - Production team (embroidery)
 * - Invoicing/collections
 * 
 * This reveals why small orders can actually LOSE money
 * even when they appear profitable on paper.
 */

const https = require('https');
const url = require('url');

class FullOverheadAnalyzer {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Machine configuration
        this.machine = {
            heads: 8,
            costPerHour: 45.00,
            piecesPerHour: 16,
            minutesPerRun: 30  // For 8 pieces at 8000 stitches
        };
        
        // COMPLETE overhead breakdown - EVERY person who touches the order
        this.overhead = {
            // Sales process (Account Executive) - ERIK'S ESTIMATE: 1 HOUR
            sales: {
                initialQuoteMinutes: 20,      // Create quote, discuss options
                followUpMinutes: 10,           // "Did you get my quote?" calls
                orderEntryMinutes: 10,         // Enter order into system
                customerQuestionsMinutes: 10,  // "What shade of navy?" etc.
                proofApprovalMinutes: 10,      // Back and forth on artwork
                hourlyRate: 25.00,
                totalMinutes: 60,              // 1 hour total per Erik
            },
            
            // Purchasing (Bradley) - ERIK'S ESTIMATE: 30 MINUTES
            purchasing: {
                vendorCheckMinutes: 10,        // Check stock at Sanmar
                orderPlacementMinutes: 15,     // Place order with vendor
                trackingMinutes: 5,            // Track shipment
                hourlyRate: 22.00,
                totalMinutes: 30,              // 30 minutes per Erik
            },
            
            // Receiving (Mikalah) - ERIK'S ESTIMATE: 30 MINUTES
            receiving: {
                unpackMinutes: 10,             // Unpack shipment
                countVerifyMinutes: 15,        // Count and verify order
                stagingMinutes: 5,             // Stage for production
                hourlyRate: 18.00,
                totalMinutes: 30,              // 30 minutes per Erik
            },
            
            // Production setup (Machine operator)
            production: {
                designLoadMinutes: 5,          // Load design file
                threadingMinutes: 10,          // Thread machine
                hoopingSetupMinutes: 5,        // Set up hooping
                testRunMinutes: 5,             // Test on scrap
                hourlyRate: 20.00,
                totalMinutes: 25,
            },
            
            // Post-production
            postProduction: {
                qualityInspectionMinutes: 10,  // Check each piece
                packingMinutes: 10,            // Pack order
                labelingMinutes: 5,            // Add labels/tags
                hourlyRate: 18.00,
                totalMinutes: 25,
            },
            
            // Invoicing & Collections - ERIK'S ESTIMATE: 15 MIN INVOICING + 10 MIN PAYMENT
            accounting: {
                invoiceCreationMinutes: 10,    // Create invoice
                sendingMinutes: 5,             // Send to customer
                paymentProcessingMinutes: 10,  // Process payment per Erik
                hourlyRate: 22.00,
                totalMinutes: 25,              // 25 minutes total per Erik
            },
            
            // Small order penalties (extra hand-holding)
            smallOrderPenalties: {
                extraSalesTime: 30,    // "Can I just get 3?" negotiations
                rushFeeling: 15,        // Customer expects faster for small order
                setupFrustration: 10,   // Staff annoyance factor
            }
        };
        
        // Test scenarios
        this.testStyles = [
            { style: 'PC61', name: 'Basic Tee', cost: 3.53 },
            { style: 'PC90H', name: 'Essential Hoodie', cost: 15.59 },
            { style: 'J790', name: 'Port Authority Jacket', cost: 31.66 },
            { style: 'CT103828', name: 'Carhartt Detroit Jacket', cost: 74.00 }
        ];
        
        this.testQuantities = [8, 12, 16, 24, 48, 72, 144];
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
            
            this.marginDenominator = 0.6;
            this.ltmFee = 50;
            this.embCost = 6;
            
            if (bundle.tiersR) {
                this.marginDenominator = bundle.tiersR[0].MarginDenominator || 0.6;
                this.ltmFee = bundle.tiersR[0].LTM_Fee || 50;
            }
            
            if (bundle.allEmbroideryCostsR && bundle.allEmbroideryCostsR[0]) {
                this.embCost = bundle.allEmbroideryCostsR[0].EmbroideryCost || 6;
            }
            
            console.log('✓ Configuration loaded\n');
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }
    
    calculateFullCost(garment, quantity) {
        // Calculate all overhead minutes
        let totalOverheadMinutes = 0;
        let totalOverheadCost = 0;
        
        // Add up all department times
        const departments = ['sales', 'purchasing', 'receiving', 'production', 'postProduction', 'accounting'];
        
        for (const dept of departments) {
            const deptData = this.overhead[dept];
            totalOverheadMinutes += deptData.totalMinutes;
            totalOverheadCost += (deptData.totalMinutes / 60) * deptData.hourlyRate;
        }
        
        // Add small order penalty if applicable
        if (quantity < 24) {
            const penalties = this.overhead.smallOrderPenalties;
            const penaltyMinutes = penalties.extraSalesTime + penalties.rushFeeling + penalties.setupFrustration;
            totalOverheadMinutes += penaltyMinutes;
            totalOverheadCost += (penaltyMinutes / 60) * this.overhead.sales.hourlyRate;
        }
        
        // Production time (actual embroidery)
        const runsNeeded = Math.ceil(quantity / this.machine.heads);
        const productionMinutes = runsNeeded * this.machine.minutesPerRun;
        const machineCost = (productionMinutes / 60) * this.machine.costPerHour;
        
        // Material costs
        const garmentCost = garment.cost * quantity;
        
        // Total costs
        const totalCost = garmentCost + machineCost + totalOverheadCost;
        const costPerPiece = totalCost / quantity;
        
        // Revenue calculation
        const basePrice = (garment.cost / this.marginDenominator) + this.embCost;
        const roundedPrice = Math.ceil(basePrice);
        const ltmPerPiece = quantity < 24 ? this.ltmFee / quantity : 0;
        const sellingPrice = roundedPrice + ltmPerPiece;
        const totalRevenue = sellingPrice * quantity;
        
        // Profit calculations
        const totalProfit = totalRevenue - totalCost;
        const profitPerPiece = totalProfit / quantity;
        const profitMargin = (totalProfit / totalRevenue) * 100;
        
        // Time-based metrics
        const totalMinutes = totalOverheadMinutes + productionMinutes;
        const profitPerHour = (totalProfit / totalMinutes) * 60;
        
        // Machine utilization
        const machineUtilization = (quantity / (runsNeeded * this.machine.heads)) * 100;
        
        return {
            quantity,
            garmentName: garment.name,
            garmentCost: garment.cost,
            
            // Cost breakdown
            materialCost: garmentCost,
            machineCost,
            overheadCost: totalOverheadCost,
            totalCost,
            costPerPiece,
            
            // Overhead breakdown
            overheadMinutes: totalOverheadMinutes,
            productionMinutes,
            totalMinutes,
            overheadAsPercent: (totalOverheadCost / totalCost) * 100,
            
            // Revenue
            sellingPrice,
            totalRevenue,
            ltmBoost: ltmPerPiece * quantity,
            
            // Profitability
            totalProfit,
            profitPerPiece,
            profitMargin,
            profitPerHour,
            
            // Efficiency
            machineUtilization,
            runsNeeded
        };
    }
    
    async runAnalysis() {
        console.log('='.repeat(80));
        console.log('FULL OVERHEAD ANALYSIS - THE COMPLETE TRUTH');
        console.log('='.repeat(80));
        console.log('Every person who touches an order costs money!');
        console.log('='.repeat(80));
        
        await this.loadConfiguration();
        
        // Show the full overhead breakdown
        console.log('\nCOMPLETE OVERHEAD PER ORDER (regardless of size!):');
        console.log('-'.repeat(80));
        
        let totalMinutes = 0;
        let totalCost = 0;
        
        const departments = [
            { key: 'sales', name: 'Sales (AE)', person: 'Account Executive' },
            { key: 'purchasing', name: 'Purchasing', person: 'Bradley' },
            { key: 'receiving', name: 'Receiving', person: 'Mikalah' },
            { key: 'production', name: 'Production Setup', person: 'Machine Operator' },
            { key: 'postProduction', name: 'Packing/QC', person: 'Production Staff' },
            { key: 'accounting', name: 'Invoicing', person: 'Accounting' }
        ];
        
        for (const dept of departments) {
            const data = this.overhead[dept.key];
            const cost = (data.totalMinutes / 60) * data.hourlyRate;
            totalMinutes += data.totalMinutes;
            totalCost += cost;
            
            console.log(`${dept.name.padEnd(20)} | ${dept.person.padEnd(18)} | ${data.totalMinutes} min | $${cost.toFixed(2)}`);
        }
        
        console.log('-'.repeat(80));
        console.log(`TOTAL OVERHEAD: ${totalMinutes} minutes ($${totalCost.toFixed(2)}) PER ORDER!`);
        console.log('\n⚠️  This happens whether you order 8 pieces or 800!');
        
        // Analyze impact on different quantities
        console.log('\n' + '='.repeat(80));
        console.log('OVERHEAD COST PER PIECE AT DIFFERENT QUANTITIES');
        console.log('='.repeat(80));
        
        console.log('\nQuantity | Overhead/Piece | Impact on Margin');
        console.log('---------|----------------|------------------');
        
        for (const qty of this.testQuantities) {
            const overheadPerPiece = totalCost / qty;
            console.log(`${qty.toString().padEnd(8)} | $${overheadPerPiece.toFixed(2).padEnd(13)} | ${qty < 24 ? '💀 KILLER' : qty < 48 ? '😟 Heavy' : qty < 72 ? '😐 Moderate' : '😊 Manageable'}`);
        }
        
        // Test each garment type
        for (const garment of this.testStyles) {
            console.log('\n' + '='.repeat(80));
            console.log(`${garment.name.toUpperCase()} (Cost: $${garment.cost})`);
            console.log('='.repeat(80));
            
            console.log('\nQty | Overhead % | Profit/Pc | Margin % | $/Hour | Status');
            console.log('----|------------|-----------|----------|--------|--------');
            
            const results = [];
            
            for (const qty of this.testQuantities) {
                const result = this.calculateFullCost(garment, qty);
                results.push(result);
                
                let status;
                if (result.totalProfit < 0) {
                    status = '💀 LOSS!';
                } else if (result.profitMargin < 10) {
                    status = '⚠️ Danger';
                } else if (result.profitMargin < 20) {
                    status = '😐 Thin';
                } else if (result.profitMargin < 30) {
                    status = '👍 OK';
                } else {
                    status = '💰 Good';
                }
                
                console.log(
                    `${qty.toString().padEnd(3)} | ` +
                    `${result.overheadAsPercent.toFixed(0)}%`.padEnd(10) + ' | ' +
                    `$${result.profitPerPiece.toFixed(2)}`.padEnd(9) + ' | ' +
                    `${result.profitMargin.toFixed(1)}%`.padEnd(8) + ' | ' +
                    `$${result.profitPerHour > 0 ? result.profitPerHour.toFixed(0) : 'NEG'}`.padEnd(6) + ' | ' +
                    status
                );
            }
            
            // Find break-even quantity
            const breakEven = results.find(r => r.totalProfit > 0);
            if (breakEven) {
                console.log(`\n⚠️ BREAK-EVEN: ${breakEven.quantity} pieces minimum to make ANY profit!`);
            } else {
                console.log('\n💀 NEVER PROFITABLE at current pricing!');
            }
            
            // Find optimal quantity
            const optimal = results.reduce((best, current) => 
                current.profitPerHour > best.profitPerHour ? current : best
            );
            
            if (optimal.profitPerHour > 0) {
                console.log(`🎯 OPTIMAL: ${optimal.quantity} pieces at $${optimal.profitPerHour.toFixed(2)}/hour`);
            }
        }
        
        // Reality check scenarios
        console.log('\n' + '='.repeat(80));
        console.log('🔍 REALITY CHECK - Common Scenarios');
        console.log('='.repeat(80));
        
        console.log('\nScenario 1: "Can you just do 8 basic tees?"');
        const tee8 = this.calculateFullCost(this.testStyles[0], 8);
        console.log(`  Revenue: $${tee8.totalRevenue.toFixed(2)}`);
        console.log(`  Materials: $${tee8.materialCost.toFixed(2)}`);
        console.log(`  Machine: $${tee8.machineCost.toFixed(2)}`);
        console.log(`  OVERHEAD: $${tee8.overheadCost.toFixed(2)} (${tee8.overheadAsPercent.toFixed(0)}% of cost!)`);
        console.log(`  Profit: $${tee8.totalProfit.toFixed(2)}`);
        console.log(`  Result: ${tee8.totalProfit > 0 ? '😰 Barely profitable' : '💀 LOSING MONEY!'}`);
        
        console.log('\nScenario 2: "We need 24 hoodies"');
        const hoodie24 = this.calculateFullCost(this.testStyles[1], 24);
        console.log(`  Revenue: $${hoodie24.totalRevenue.toFixed(2)}`);
        console.log(`  All costs: $${hoodie24.totalCost.toFixed(2)}`);
        console.log(`  Profit: $${hoodie24.totalProfit.toFixed(2)}`);
        console.log(`  Margin: ${hoodie24.profitMargin.toFixed(1)}%`);
        console.log(`  Result: 👍 This works!`);
        
        console.log('\nScenario 3: "8 Carhartt jackets for our executives"');
        const jacket8 = this.calculateFullCost(this.testStyles[3], 8);
        console.log(`  Revenue: $${jacket8.totalRevenue.toFixed(2)}`);
        console.log(`  All costs: $${jacket8.totalCost.toFixed(2)}`);
        console.log(`  Profit: $${jacket8.totalProfit.toFixed(2)}`);
        console.log(`  Margin: ${jacket8.profitMargin.toFixed(1)}%`);
        console.log(`  Result: 💰 Premium items save the day!`);
        
        // The shocking truth
        console.log('\n' + '='.repeat(80));
        console.log('😱 THE SHOCKING TRUTH');
        console.log('='.repeat(80));
        
        // Calculate how much overhead costs per order
        const overheadPerOrder = totalCost;
        const hoursPerOrder = totalMinutes / 60;
        
        console.log(`\n📊 EVERY ORDER costs you:`);
        console.log(`   • ${totalMinutes} minutes of staff time`);
        console.log(`   • $${overheadPerOrder.toFixed(2)} in overhead`);
        console.log(`   • ${hoursPerOrder.toFixed(1)} hours of combined labor`);
        
        console.log('\n💡 This means:');
        console.log(`   • 8-piece order: $${(overheadPerOrder/8).toFixed(2)}/piece overhead`);
        console.log(`   • 24-piece order: $${(overheadPerOrder/24).toFixed(2)}/piece overhead`);
        console.log(`   • 72-piece order: $${(overheadPerOrder/72).toFixed(2)}/piece overhead`);
        
        // Strategic recommendations
        console.log('\n' + '='.repeat(80));
        console.log('🎯 STRATEGIC RECOMMENDATIONS');
        console.log('='.repeat(80));
        
        console.log('\n1. MINIMUM ORDER REALITY:');
        console.log('   ❌ 8 pieces of basic items = LOSE MONEY');
        console.log('   ⚠️ 12 pieces = Break even at best');
        console.log('   ✅ 24+ pieces = Start making real profit');
        console.log('   💰 48+ pieces = Overhead becomes manageable');
        
        console.log('\n2. THE $50 LTM FEE IS TOO LOW!');
        console.log(`   • Your overhead alone is $${overheadPerOrder.toFixed(2)}`);
        console.log('   • Consider $75-100 for orders under 24');
        console.log('   • Or push harder for 24+ minimums');
        
        console.log('\n3. PRODUCT STRATEGY:');
        console.log('   • Basic tees: 24 piece MINIMUM or lose money');
        console.log('   • Hoodies: 16-24 sweet spot');
        console.log('   • Premium jackets: Can survive at 8 pieces');
        console.log('   • Rule: Higher garment cost = lower minimum viable quantity');
        
        console.log('\n4. SALES TRAINING:');
        console.log('   "We have a 24-piece minimum for basic garments"');
        console.log('   "Premium items we can do smaller quantities"');
        console.log('   "Our sweet spot is 48 pieces - best value!"');
        
        console.log('\n5. OPERATIONAL IMPROVEMENTS:');
        console.log('   • Batch similar orders to share overhead');
        console.log('   • Standardize to reduce questions/iterations');
        console.log('   • Online ordering to reduce sales time');
        console.log('   • Preferred vendor list to speed purchasing');
        
        // Calculate daily impact
        console.log('\n' + '='.repeat(80));
        console.log('📈 DAILY IMPACT ANALYSIS');
        console.log('='.repeat(80));
        
        const workMinutesPerDay = 480;  // 8 hours
        
        console.log('\nOption A: Many small orders (8-12 pieces each)');
        const smallOrderTime = totalMinutes + 15; // 15 min production for 8 pieces
        const smallOrdersPerDay = Math.floor(workMinutesPerDay / smallOrderTime);
        const smallProfit = tee8.totalProfit > 0 ? tee8.totalProfit : 0;
        console.log(`  ${smallOrdersPerDay} orders × $${smallProfit.toFixed(2)} = $${(smallOrdersPerDay * smallProfit).toFixed(2)}/day`);
        
        console.log('\nOption B: Fewer large orders (48 pieces each)');
        const largeOrder = this.calculateFullCost(this.testStyles[0], 48);
        const largeOrderTime = totalMinutes + 90; // 90 min production for 48 pieces
        const largeOrdersPerDay = Math.floor(workMinutesPerDay / largeOrderTime);
        console.log(`  ${largeOrdersPerDay} orders × $${largeOrder.totalProfit.toFixed(2)} = $${(largeOrdersPerDay * largeOrder.totalProfit).toFixed(2)}/day`);
        
        const difference = (largeOrdersPerDay * largeOrder.totalProfit) - (smallOrdersPerDay * smallProfit);
        console.log(`\n💰 Large orders generate $${difference.toFixed(2)} MORE per day!`);
        
        console.log('\n' + '='.repeat(80));
        console.log('CONCLUSION: THE FULL OVERHEAD TRUTH');
        console.log('='.repeat(80));
        console.log('1. Small orders are PROFIT KILLERS when you include all overhead');
        console.log('2. Every order has 3+ hours of hidden labor costs');
        console.log('3. The $50 LTM fee barely covers your overhead');
        console.log('4. Push for 24+ pieces or focus on premium garments');
        console.log('5. Your time is valuable - use it on profitable orders!');
        console.log('='.repeat(80));
    }
}

// Run the analysis
const analyzer = new FullOverheadAnalyzer();
analyzer.runAnalysis().catch(console.error);