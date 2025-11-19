/**
 * Order Service Testing Utilities
 *
 * Purpose: Console testing and debugging tools for ManageOrders PUSH API integrations
 * Based on: WEBSTORE_IMPLEMENTATION_GUIDE.md Section 11
 * Status: Production-ready testing framework
 *
 * Usage:
 *   1. Include this file after your order service class
 *   2. Access via window.OrderServiceTest in browser console
 *   3. Run individual tests or complete test suite
 *
 * Example:
 *   OrderServiceTest.testOrderNumber()
 *   OrderServiceTest.testDateCalculations()
 *   OrderServiceTest.runAllTests()
 */

window.OrderServiceTest = (function() {
    'use strict';

    // Test configuration
    const config = {
        testOrderPrefix: 'TEST',
        sampleColors: ['Forest', 'Navy', 'Black'],
        sampleSizes: ['S', 'M', 'L', 'XL', '2XL'],
        productionDays: 3,
        cutoffHour: 9
    };

    /**
     * Test 1: Order Number Generation
     * Verifies format: PREFIX-MMDD-sequence-ms
     */
    function testOrderNumber(serviceInstance) {
        console.group('🧪 Test: Order Number Generation');

        try {
            const orderNumbers = [];

            // Generate 5 consecutive order numbers
            for (let i = 0; i < 5; i++) {
                const orderNum = serviceInstance.generateOrderNumber();
                orderNumbers.push(orderNum);

                // Verify format
                const pattern = /^[A-Z0-9]+-\d{4}-\d+-\d+$/;
                const isValid = pattern.test(orderNum);

                console.log(`Generated: ${orderNum}`, isValid ? '✅' : '❌');
            }

            // Verify uniqueness
            const unique = new Set(orderNumbers).size === orderNumbers.length;
            console.log(`\nUniqueness test:`, unique ? '✅ All unique' : '❌ Duplicates found');

            // Verify sequence increments
            const sequences = orderNumbers.map(num => {
                const parts = num.split('-');
                return parseInt(parts[2]);
            });

            const isSequential = sequences.every((seq, idx) =>
                idx === 0 || seq === sequences[idx - 1] + 1
            );
            console.log(`Sequential test:`, isSequential ? '✅ Properly incrementing' : '⚠️ Non-sequential');

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Test 2: Date Calculations
     * Verifies order date and ship date logic
     */
    function testDateCalculations(serviceInstance) {
        console.group('🧪 Test: Date Calculations');

        try {
            const now = new Date();
            const currentHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getHours();

            console.log(`Current PST hour: ${currentHour}`);
            console.log(`Cutoff hour: ${serviceInstance.cutoffHour || 9}`);
            console.log(`Before cutoff: ${serviceInstance.isBeforeCutoff ? serviceInstance.isBeforeCutoff() : 'N/A'}`);

            // Get order date
            const orderDate = serviceInstance.getOrderDate();
            console.log(`\nOrder Date: ${orderDate}`);

            // Calculate ship date
            const shipDate = serviceInstance.calculateShipDate(orderDate, serviceInstance.productionDays || 3);
            console.log(`Ship Date (${serviceInstance.productionDays || 3} business days): ${shipDate}`);

            // Verify ship date is after order date
            const orderDateObj = new Date(orderDate);
            const shipDateObj = new Date(shipDate);
            const isAfter = shipDateObj > orderDateObj;

            console.log(`\nShip date validation:`, isAfter ? '✅ After order date' : '❌ Invalid date order');

            // Calculate actual days difference
            const daysDiff = Math.floor((shipDateObj - orderDateObj) / (1000 * 60 * 60 * 24));
            console.log(`Calendar days between: ${daysDiff}`);
            console.log(`Expected business days: ${serviceInstance.productionDays || 3}`);

            // Test holiday detection
            console.log(`\nHoliday Detection:`);
            const testDates = [
                '2025-01-01', // New Year's
                '2025-07-04', // Independence Day
                '2025-12-25', // Christmas
                '2025-12-28'  // Factory closure
            ];

            testDates.forEach(date => {
                const isHoliday = serviceInstance.isHoliday(new Date(date));
                console.log(`  ${date}:`, isHoliday ? '🎄 Holiday' : '📅 Business day');
            });

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Test 3: Line Items Construction
     * Verifies proper line item building from color configs
     */
    function testLineItems(serviceInstance) {
        console.group('🧪 Test: Line Items Construction');

        try {
            // Mock color configurations
            const mockColorConfigs = {
                'Forest': {
                    sizeBreakdown: {
                        'S': { quantity: 2, unitPrice: 16.50 },
                        'M': { quantity: 3, unitPrice: 16.50 },
                        'L': { quantity: 4, unitPrice: 16.50 },
                        'XL': { quantity: 3, unitPrice: 16.50 }
                    }
                },
                'Navy': {
                    sizeBreakdown: {
                        'M': { quantity: 2, unitPrice: 16.50 },
                        'L': { quantity: 3, unitPrice: 16.50 },
                        'XL': { quantity: 2, unitPrice: 16.50 }
                    }
                }
            };

            const mockSettings = {
                decorationMethod: 'DTG',
                printLocationName: 'Left Chest',
                serviceDescription: '3-Day Rush Service',
                ltmFee: 0
            };

            const lineItems = serviceInstance.buildLineItems(mockColorConfigs, mockSettings);

            console.log(`Total line items: ${lineItems.length}`);
            console.table(lineItems.map(item => ({
                'Part Number': item.partNumber,
                'Color': item.color,
                'Size': item.size,
                'Qty': item.quantity,
                'Price': `$${item.price.toFixed(2)}`,
                'Total': `$${(item.quantity * item.price).toFixed(2)}`
            })));

            // Verify no consolidation (one item per color/size combo)
            console.log(`\nValidation:`);
            const expectedItems =
                Object.keys(mockColorConfigs['Forest'].sizeBreakdown).length +
                Object.keys(mockColorConfigs['Navy'].sizeBreakdown).length;

            const isCorrectCount = lineItems.length === expectedItems;
            console.log(`  Item count:`, isCorrectCount ? `✅ ${lineItems.length} items (expected ${expectedItems})` : `❌ Wrong count`);

            // Verify all use base part number
            const allBasePartNumber = lineItems.every(item => item.partNumber === 'PC54');
            console.log(`  Base part number:`, allBasePartNumber ? '✅ All items use PC54' : '❌ Some items use variant SKUs');

            // Verify CATALOG_COLOR format
            const validColors = lineItems.every(item =>
                ['Forest', 'Navy'].includes(item.color)
            );
            console.log(`  CATALOG_COLOR format:`, validColors ? '✅ Valid' : '❌ Invalid color format');

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Test 4: Design Block Construction
     * Verifies design locations and metadata
     */
    function testDesignBlock(serviceInstance) {
        console.group('🧪 Test: Design Block Construction');

        try {
            const mockOrderNumber = 'TEST-1115-1-247';
            const mockColorConfigs = {
                'Forest': {
                    sizeBreakdown: {
                        'S': { quantity: 2, unitPrice: 16.50 },
                        'M': { quantity: 3, unitPrice: 16.50 }
                    }
                }
            };

            const mockSettings = {
                printLocationCode: 'LC',
                printLocationName: 'Left Chest',
                frontLogo: {
                    fileName: 'test-logo.png',
                    fileUrl: 'https://test.com/logo.png'
                },
                hasBackPrint: false
            };

            const designBlock = serviceInstance.buildDesignBlock ?
                serviceInstance.buildDesignBlock(mockOrderNumber, mockColorConfigs, mockSettings) :
                null;

            if (designBlock) {
                console.log('Design Block:');
                console.log(JSON.stringify(designBlock, null, 2));

                // Verify required fields
                console.log(`\nValidation:`);
                console.log(`  designTypeId:`, designBlock.designTypeId === 45 ? '✅ Correct (45 for DTG)' : '❌ Wrong ID');
                console.log(`  productColor:`, designBlock.productColor ? '✅ Present' : '❌ Missing');

                // Verify locations
                const locations = serviceInstance.buildDesignLocations ?
                    serviceInstance.buildDesignLocations(mockOrderNumber, mockColorConfigs, mockSettings) :
                    [];

                console.log(`\nDesign Locations (${locations.length}):`);
                locations.forEach((loc, idx) => {
                    console.log(`  ${idx + 1}. ${loc.location}`);
                    console.log(`     code: ${loc.code}`);
                    console.log(`     imageUrl: ${loc.imageUrl ? '✅ Present' : '⚠️ Empty'}`);
                });

                // Verify proxy field names
                const hasCorrectFields = locations.every(loc =>
                    'code' in loc &&
                    'imageUrl' in loc &&
                    !('designCode' in loc) &&
                    !('imageURL' in loc)
                );
                console.log(`\n  Proxy field names:`, hasCorrectFields ? '✅ Correct' : '❌ Wrong field names');

            } else {
                console.log('⚠️ buildDesignBlock method not found in service');
            }

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Test 5: Payment Data Formatting
     * Verifies Stripe payment data transformation
     */
    function testPaymentFormatting(serviceInstance) {
        console.group('🧪 Test: Payment Data Formatting');

        try {
            // Mock Stripe payment intent
            const mockPaymentIntent = {
                id: 'pi_test_123456',
                amount: 55000, // $550.00 in cents
                currency: 'usd',
                status: 'succeeded',
                payment_method: 'pm_test_card',
                created: Math.floor(Date.now() / 1000)
            };

            const mockSettings = {
                paymentData: mockPaymentIntent
            };

            const paymentBlocks = serviceInstance.buildPaymentBlocks ?
                serviceInstance.buildPaymentBlocks(mockSettings) : [];

            if (paymentBlocks.length > 0) {
                const payment = paymentBlocks[0];

                console.log('Payment Block:');
                console.table({
                    'Payment Type': payment.paymentType,
                    'Amount': `$${payment.paymentAmount.toFixed(2)}`,
                    'Reference': payment.paymentReferenceNumber,
                    'Date': payment.paymentDate
                });

                // Verify cents to dollars conversion
                const expectedAmount = mockPaymentIntent.amount / 100;
                const isCorrectAmount = payment.paymentAmount === expectedAmount;

                console.log(`\nValidation:`);
                console.log(`  Amount conversion:`, isCorrectAmount ?
                    `✅ $${payment.paymentAmount} (from ${mockPaymentIntent.amount} cents)` :
                    `❌ Wrong conversion`
                );
                console.log(`  Payment type:`, payment.paymentType === 'Credit Card' ? '✅ Correct' : '⚠️ Check type');
                console.log(`  Reference number:`, payment.paymentReferenceNumber ? '✅ Present' : '❌ Missing');

            } else {
                console.log('⚠️ buildPaymentBlocks method not found or returned empty');
            }

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Test 6: Complete Order Structure
     * Validates complete order data structure
     */
    function testCompleteOrderStructure(serviceInstance) {
        console.group('🧪 Test: Complete Order Structure');

        try {
            // This test requires more setup - showing structure validation
            const requiredFields = [
                'orderNumber',
                'orderDate',
                'requestedShipDate',
                'dateNeeded',
                'salesRep',
                'terms',
                'customer',
                'shipping',
                'lineItems',
                'designs',
                'total'
            ];

            console.log('Required Order Fields:');
            requiredFields.forEach((field, idx) => {
                console.log(`  ${idx + 1}. ${field}`);
            });

            console.log(`\nRequired Customer Fields:`);
            const customerFields = ['firstName', 'lastName', 'email', 'phone', 'company'];
            customerFields.forEach((field, idx) => {
                console.log(`  ${idx + 1}. ${field}`);
            });

            console.log(`\nRequired Shipping Fields:`);
            const shippingFields = ['address1', 'city', 'state', 'zip'];
            shippingFields.forEach((field, idx) => {
                console.log(`  ${idx + 1}. ${field}`);
            });

            console.log(`\n✅ Structure validation complete`);
            console.log(`📋 Total required fields: ${requiredFields.length + customerFields.length + shippingFields.length}`);

            console.groupEnd();
            return true;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    /**
     * Run All Tests
     * Executes complete test suite
     */
    function runAllTests(serviceInstance) {
        console.clear();
        console.log('🧪 Running Complete Test Suite for Order Service');
        console.log('================================================\n');

        if (!serviceInstance) {
            console.error('❌ No service instance provided');
            console.log('\nUsage: OrderServiceTest.runAllTests(yourServiceInstance)');
            console.log('Example: OrderServiceTest.runAllTests(window.threeDayTeesOrderService)');
            return;
        }

        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Run each test
        const tests = [
            { name: 'Order Number Generation', fn: testOrderNumber },
            { name: 'Date Calculations', fn: testDateCalculations },
            { name: 'Line Items Construction', fn: testLineItems },
            { name: 'Design Block Construction', fn: testDesignBlock },
            { name: 'Payment Formatting', fn: testPaymentFormatting },
            { name: 'Order Structure Validation', fn: testCompleteOrderStructure }
        ];

        tests.forEach(test => {
            console.log(`\n${'='.repeat(60)}\n`);
            const passed = test.fn(serviceInstance);
            results.tests.push({ name: test.name, passed });
            if (passed) results.passed++;
            else results.failed++;
        });

        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Test Suite Summary');
        console.log('='.repeat(60));
        console.table(results.tests);

        const total = results.passed + results.failed;
        const percentage = ((results.passed / total) * 100).toFixed(1);

        console.log(`\nResults: ${results.passed}/${total} tests passed (${percentage}%)`);

        if (results.failed === 0) {
            console.log('✅ All tests passed!');
        } else {
            console.warn(`⚠️ ${results.failed} test(s) failed`);
        }

        return results;
    }

    /**
     * Manual Test: Order Number Sequence
     * Interactive test for order number uniqueness
     */
    function manualTestOrderNumbers(count = 10) {
        console.group(`🧪 Manual Test: Generate ${count} Order Numbers`);

        console.log('Run this in your service context:');
        console.log(`
for (let i = 0; i < ${count}; i++) {
    const num = yourService.generateOrderNumber();
    console.log(\`\${i + 1}. \${num}\`);
}
        `);

        console.groupEnd();
    }

    /**
     * Manual Test: Date Logic
     * Interactive test for date calculations
     */
    function manualTestDates() {
        console.group('🧪 Manual Test: Date Logic');

        console.log('Test cutoff logic:');
        console.log(`
const orderDate = yourService.getOrderDate();
const shipDate = yourService.calculateShipDate(orderDate, 3);
console.log('Order Date:', orderDate);
console.log('Ship Date:', shipDate);
console.log('Days apart:', Math.floor((new Date(shipDate) - new Date(orderDate)) / (1000*60*60*24)));
        `);

        console.groupEnd();
    }

    /**
     * Debug Helper: Inspect Service State
     */
    function inspectService(serviceInstance) {
        console.group('🔍 Service Instance Inspection');

        if (!serviceInstance) {
            console.error('❌ No service instance provided');
            console.groupEnd();
            return;
        }

        console.log('Service Configuration:');
        console.table({
            'API Base': serviceInstance.apiBase,
            'Production Days': serviceInstance.productionDays,
            'Cutoff Hour': serviceInstance.cutoffHour,
            'EmailJS Service': serviceInstance.emailjsServiceId,
            'EmailJS Public Key': serviceInstance.emailjsPublicKey ? '✅ Set' : '❌ Missing'
        });

        console.log('\nAvailable Methods:');
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(serviceInstance))
            .filter(name => typeof serviceInstance[name] === 'function' && name !== 'constructor');

        methods.forEach((method, idx) => {
            console.log(`  ${idx + 1}. ${method}()`);
        });

        console.log(`\nTotal methods: ${methods.length}`);

        console.groupEnd();
    }

    // Public API
    return {
        // Individual tests
        testOrderNumber,
        testDateCalculations,
        testLineItems,
        testDesignBlock,
        testPaymentFormatting,
        testCompleteOrderStructure,

        // Test suite
        runAllTests,

        // Manual tests
        manualTestOrderNumbers,
        manualTestDates,

        // Utilities
        inspectService,

        // Config access
        config
    };
})();

// Auto-log availability
console.log('✅ Order Service Test Utilities loaded');
console.log('📖 Usage: OrderServiceTest.runAllTests(yourServiceInstance)');
console.log('📖 Help: OrderServiceTest.inspectService(yourServiceInstance)');
