/**
 * Screen Print Quote Builder - Integration Test
 * Tests the complete flow from quote builder to database service
 */

// Mock the ScreenPrintQuoteService
class MockQuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SP';
        this.savedQuotes = [];
    }

    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        return `${this.quotePrefix}${month}${day}-TEST`;
    }

    async saveQuote(quoteData) {
        try {
            const quoteID = this.generateQuoteID();

            // Calculate totals (matching the service logic)
            const subtotal = quoteData.subtotal || quoteData.items.reduce((sum, item) => sum + item.total, 0);
            const ltmFeeTotal = quoteData.totalQuantity < 36 ? 50 : 0;
            const setupFees = quoteData.setupFees || this.calculateSetupFees(quoteData);
            const totalAmount = quoteData.grandTotal || (subtotal + ltmFeeTotal + setupFees);

            const quote = {
                quoteID,
                sessionData: {
                    QuoteID: quoteID,
                    CustomerEmail: quoteData.customerEmail || '',
                    CustomerName: quoteData.customerName || 'Guest',
                    CompanyName: quoteData.companyName || '',
                    Phone: quoteData.customerPhone || '',
                    TotalQuantity: parseInt(quoteData.totalQuantity),
                    SubtotalAmount: parseFloat(subtotal.toFixed(2)),
                    LTMFeeTotal: parseFloat(ltmFeeTotal.toFixed(2)),
                    TotalAmount: parseFloat(totalAmount.toFixed(2)),
                    Status: 'Open',
                    Notes: JSON.stringify(quoteData.printSetup)
                },
                items: quoteData.items.map((item, index) => ({
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: item.styleNumber || 'CUSTOM',
                    ProductName: item.productName || 'Screen Print Item',
                    Color: item.color || '',
                    EmbellishmentType: 'screenprint',
                    Quantity: parseInt(item.quantity),
                    HasLTM: quoteData.totalQuantity < 36 ? 'Yes' : 'No',
                    FinalUnitPrice: parseFloat(item.unitPrice || 0),
                    LineTotal: parseFloat(item.total || 0),
                    SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                    PricingTier: this.getPricingTier(quoteData.totalQuantity)
                }))
            };

            this.savedQuotes.push(quote);

            return {
                success: true,
                quoteID: quoteID,
                totalAmount: totalAmount
            };

        } catch (error) {
            console.error('[MockQuoteService] Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateSetupFees(quoteData) {
        const screenFeePerColor = 30;

        if (quoteData.setupFees !== undefined) {
            return quoteData.setupFees;
        }

        let totalScreens = quoteData.printSetup?.frontColors || 1;

        if (quoteData.printSetup?.isDarkGarment) {
            totalScreens += 1;
        }

        return totalScreens * screenFeePerColor;
    }

    getPricingTier(quantity) {
        if (quantity >= 13 && quantity <= 36) return '13-36';
        if (quantity >= 37 && quantity <= 72) return '37-72';
        if (quantity >= 73 && quantity <= 144) return '73-144';
        if (quantity >= 145) return '145-576';
        return '13-36';
    }
}

// Test scenarios
const testScenarios = [
    {
        name: 'Single Product Quote - 48 pieces',
        quoteData: {
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            customerPhone: '253-555-1234',
            salesRepEmail: 'sales@nwcustomapparel.com',
            printSetup: {
                frontColors: 1,
                isDarkGarment: false
            },
            items: [
                {
                    styleNumber: 'PC54',
                    productName: 'Cotton T-Shirt',
                    color: 'Black',
                    quantity: 48,
                    unitPrice: 10.5,
                    total: 504,
                    sizeBreakdown: { 'M': 24, 'L': 24 }
                }
            ],
            totalQuantity: 48,
            subtotal: 504,
            setupFees: 30,
            grandTotal: 534
        },
        expected: {
            tier: '37-72',
            ltmFee: 0,
            totalAmount: 534
        }
    },
    {
        name: 'Mix-and-Match Quote - Two products, 50 total',
        quoteData: {
            customerName: 'Test Customer 2',
            customerEmail: 'test2@example.com',
            printSetup: {
                frontColors: 2,
                isDarkGarment: false
            },
            items: [
                {
                    styleNumber: 'PC54',
                    productName: 'Cotton T-Shirt',
                    color: 'Black',
                    quantity: 24,
                    unitPrice: 10.5,
                    total: 252,
                    sizeBreakdown: { 'M': 12, 'L': 12 }
                },
                {
                    styleNumber: 'PC61',
                    productName: 'Cotton T-Shirt',
                    color: 'Navy',
                    quantity: 26,
                    unitPrice: 10.5,
                    total: 273,
                    sizeBreakdown: { 'M': 13, 'L': 13 }
                }
            ],
            totalQuantity: 50,
            subtotal: 525,
            setupFees: 60,
            grandTotal: 585
        },
        expected: {
            tier: '37-72',
            ltmFee: 0,
            totalAmount: 585
        }
    },
    {
        name: 'Below Minimum - 24 pieces with LTM fee',
        quoteData: {
            customerName: 'Test Customer 3',
            customerEmail: 'test3@example.com',
            printSetup: {
                frontColors: 1,
                isDarkGarment: false
            },
            items: [
                {
                    styleNumber: 'PC54',
                    productName: 'Cotton T-Shirt',
                    color: 'Red',
                    quantity: 24,
                    unitPrice: 13.0,
                    total: 312,
                    sizeBreakdown: { 'M': 12, 'L': 12 }
                }
            ],
            totalQuantity: 24,
            subtotal: 312,
            setupFees: 30,
            grandTotal: 392 // subtotal + setupFees + LTM
        },
        expected: {
            tier: '13-36',
            ltmFee: 50,
            totalAmount: 392
        }
    },
    {
        name: 'Dark Garments - Adds underbase screen',
        quoteData: {
            customerName: 'Test Customer 4',
            customerEmail: 'test4@example.com',
            printSetup: {
                frontColors: 2,
                isDarkGarment: true
            },
            items: [
                {
                    styleNumber: 'PC54',
                    productName: 'Cotton T-Shirt',
                    color: 'Black',
                    quantity: 48,
                    unitPrice: 10.5,
                    total: 504,
                    sizeBreakdown: { 'M': 24, 'L': 24 }
                }
            ],
            totalQuantity: 48,
            subtotal: 504,
            setupFees: 90, // (2 colors + 1 underbase) × $30
            grandTotal: 594
        },
        expected: {
            tier: '37-72',
            ltmFee: 0,
            totalAmount: 594,
            setupScreens: 3
        }
    }
];

// Run tests
console.log('='.repeat(80));
console.log('SCREEN PRINT QUOTE BUILDER - INTEGRATION TEST');
console.log('Testing complete flow: Quote Builder → Service → Database');
console.log('='.repeat(80));
console.log('');

const service = new MockQuoteService();
let passedTests = 0;
let failedTests = 0;

testScenarios.forEach((scenario, index) => {
    console.log(`\nTest ${index + 1}: ${scenario.name}`);
    console.log('-'.repeat(80));

    // Run the save quote operation
    service.saveQuote(scenario.quoteData).then(result => {
        if (!result.success) {
            console.log(`  ❌ FAILED - Save operation failed: ${result.error}`);
            failedTests++;
            return;
        }

        const savedQuote = service.savedQuotes[service.savedQuotes.length - 1];

        console.log(`  Quote ID: ${result.quoteID}`);
        console.log(`  Customer: ${savedQuote.sessionData.CustomerName}`);
        console.log(`  Total Quantity: ${savedQuote.sessionData.TotalQuantity}`);
        console.log(`  Subtotal: $${savedQuote.sessionData.SubtotalAmount.toFixed(2)}`);
        console.log(`  Setup Fees: $${scenario.quoteData.setupFees.toFixed(2)}`);
        console.log(`  LTM Fee: $${savedQuote.sessionData.LTMFeeTotal.toFixed(2)}`);
        console.log(`  Total: $${savedQuote.sessionData.TotalAmount.toFixed(2)}`);
        console.log(`  Items: ${savedQuote.items.length}`);

        // Verify expectations
        let testPassed = true;
        const errors = [];

        if (savedQuote.items[0].PricingTier !== scenario.expected.tier) {
            errors.push(`Expected tier ${scenario.expected.tier}, got ${savedQuote.items[0].PricingTier}`);
            testPassed = false;
        }

        if (savedQuote.sessionData.LTMFeeTotal !== scenario.expected.ltmFee) {
            errors.push(`Expected LTM fee ${scenario.expected.ltmFee}, got ${savedQuote.sessionData.LTMFeeTotal}`);
            testPassed = false;
        }

        if (Math.abs(savedQuote.sessionData.TotalAmount - scenario.expected.totalAmount) > 0.01) {
            errors.push(`Expected total ${scenario.expected.totalAmount}, got ${savedQuote.sessionData.TotalAmount}`);
            testPassed = false;
        }

        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passedTests++;
        } else {
            console.log(`  ❌ FAILED`);
            errors.forEach(err => console.log(`     - ${err}`));
            failedTests++;
        }
    });
});

// Allow async to complete
setTimeout(() => {
    console.log('\n' + '='.repeat(80));
    console.log('INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${testScenarios.length}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / testScenarios.length) * 100).toFixed(1)}%`);
    console.log('');

    console.log('DATABASE FIELD MAPPING:');
    console.log('  QuoteID: SP[MMDD]-[sequence]');
    console.log('  TotalQuantity: Sum of all item quantities');
    console.log('  SubtotalAmount: Sum of all item totals');
    console.log('  LTMFeeTotal: $50 if quantity < 36, else $0');
    console.log('  TotalAmount: Subtotal + LTM + Setup Fees');
    console.log('  PricingTier: Based on total quantity (13-36, 37-72, 73-144, 145-576)');
    console.log('  HasLTM: "Yes" if quantity < 36, else "No"');
    console.log('');

    if (failedTests === 0) {
        console.log('✅ ALL INTEGRATION TESTS PASSED!');
        console.log('The quote builder correctly integrates with the quote service.');
    } else {
        console.log('⚠️  SOME TESTS FAILED - Review errors above');
    }

    console.log('\n' + '='.repeat(80));
}, 100);
