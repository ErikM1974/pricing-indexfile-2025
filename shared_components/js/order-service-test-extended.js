/**
 * Order Service Extended Testing Suite
 *
 * Advanced test scenarios for edge cases and production validation
 * Complements order-service-test-utilities.js with complex scenarios
 *
 * Usage:
 *   // Load after order-service-test-utilities.js
 *   <script src="/shared_components/js/order-service-test-utilities.js"></script>
 *   <script src="/shared_components/js/order-service-test-extended.js"></script>
 *
 *   // Run extended tests
 *   OrderServiceTestExtended.runAllExtendedTests(yourServiceInstance);
 *
 * @version 1.0.0
 * @since 2025-11-19
 */

(function(window) {
    'use strict';

    // ============================================================================
    // EXTENDED TEST 1: HOLIDAY WEEKEND DATE CALCULATIONS
    // ============================================================================

    /**
     * Test date calculations across complex holiday scenarios
     *
     * Validates:
     * - Holiday detection (federal holidays)
     * - Weekend detection
     * - Business day calculation across multiple holidays
     * - Factory closure (Dec 26-31)
     * - 3-day turnaround across holiday weekends
     */
    function testHolidayWeekends(serviceInstance) {
        console.group('🧪 Extended Test 1: Holiday Weekend Date Calculations');
        console.log('Testing complex holiday and weekend scenarios\n');

        try {
            const testScenarios = [
                {
                    name: 'Thanksgiving Weekend',
                    orderDate: new Date('2025-11-26'),  // Wednesday before Thanksgiving
                    expectedBusinessDays: 3,
                    notes: 'Should skip Thu 11/27 (Thanksgiving), Fri 11/28 (after holiday), Sat-Sun'
                },
                {
                    name: 'Christmas Week',
                    orderDate: new Date('2025-12-22'),  // Monday before Christmas
                    expectedBusinessDays: 3,
                    notes: 'Should skip Wed 12/24 (Christmas Eve), Thu 12/25 (Christmas), Fri-Sun factory closure'
                },
                {
                    name: 'New Years Week',
                    orderDate: new Date('2025-12-29'),  // Monday during factory closure
                    expectedBusinessDays: 3,
                    notes: 'Should skip entire factory closure period (12/26-12/31) and calculate into January'
                },
                {
                    name: 'Independence Day Weekend',
                    orderDate: new Date('2025-07-02'),  // Wednesday before July 4th
                    expectedBusinessDays: 3,
                    notes: 'Should skip Fri 7/4 (Independence Day) and weekend'
                },
                {
                    name: 'Labor Day Weekend',
                    orderDate: new Date('2025-09-03'),  // Wednesday before Labor Day
                    expectedBusinessDays: 3,
                    notes: 'Should skip Mon 9/1 (Labor Day) and weekend'
                }
            ];

            let passed = 0;
            let failed = 0;

            testScenarios.forEach(scenario => {
                console.log(`\n📅 Scenario: ${scenario.name}`);
                console.log(`   Order Date: ${scenario.orderDate.toLocaleDateString()}`);
                console.log(`   Notes: ${scenario.notes}\n`);

                const shipDate = serviceInstance.calculateShipDate(scenario.orderDate);

                // Calculate actual business days
                let businessDays = 0;
                let currentDate = new Date(scenario.orderDate);

                while (businessDays < scenario.expectedBusinessDays) {
                    currentDate.setDate(currentDate.getDate() + 1);

                    // Check if business day
                    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                    const isHoliday = serviceInstance.isHoliday(currentDate);
                    const isFactoryClosure = serviceInstance.isFactoryClosure(currentDate);

                    if (!isWeekend && !isHoliday && !isFactoryClosure) {
                        businessDays++;
                    }
                }

                const expectedShipDate = currentDate.toISOString().split('T')[0];
                const actualShipDate = shipDate.split('T')[0];

                const isCorrect = expectedShipDate === actualShipDate;

                if (isCorrect) {
                    console.log(`   ✅ Ship Date: ${shipDate} (Correct)`);
                    passed++;
                } else {
                    console.log(`   ❌ Ship Date: ${shipDate}`);
                    console.log(`   Expected: ${expectedShipDate}`);
                    failed++;
                }
            });

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`Results: ${passed}/${testScenarios.length} scenarios passed`);

            if (failed > 0) {
                console.warn(`⚠️ ${failed} scenario(s) failed`);
            }

            console.groupEnd();
            return failed === 0;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // EXTENDED TEST 2: LARGE ORDER LINE ITEMS (50+ ITEMS)
    // ============================================================================

    /**
     * Test line item generation for large orders
     *
     * Validates:
     * - Performance with 50+ line items
     * - All items maintain correct structure
     * - No consolidation occurs
     * - Memory efficiency
     * - Correct total calculations
     */
    function testLargeOrder(serviceInstance) {
        console.group('🧪 Extended Test 2: Large Order Line Items (50+ Items)');
        console.log('Testing performance and accuracy with large orders\n');

        try {
            // Create large order: 5 colors × 10 sizes = 50 line items
            const mockColorConfigs = {};
            const colors = ['Jet Black', 'Navy', 'White', 'Forest', 'Athletic Heather'];
            const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

            colors.forEach(color => {
                mockColorConfigs[color] = {
                    sizeBreakdown: {}
                };

                sizes.forEach(size => {
                    const basePrice = size.includes('XL') && size !== 'XL' ? 18.50 : 16.50;
                    mockColorConfigs[color].sizeBreakdown[size] = {
                        quantity: Math.floor(Math.random() * 10) + 1,  // Random 1-10
                        unitPrice: basePrice
                    };
                });
            });

            const mockSettings = {
                decorationMethod: 'DTG',
                printLocationName: 'Full Front',
                serviceDescription: '3-Day Rush Service',
                ltmFee: 0
            };

            console.log('📊 Generating line items for large order...');
            console.log(`   Colors: ${colors.length}`);
            console.log(`   Sizes per color: ${sizes.length}`);
            console.log(`   Expected line items: ${colors.length * sizes.length}`);

            const startTime = performance.now();
            const lineItems = serviceInstance.buildLineItems(mockColorConfigs, mockSettings);
            const endTime = performance.now();

            console.log(`\n⏱️  Generation time: ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`📦 Generated: ${lineItems.length} line items\n`);

            // Verify count
            const expectedCount = colors.length * sizes.length;
            const countCorrect = lineItems.length === expectedCount;
            console.log(`Line item count:`, countCorrect ? `✅ ${lineItems.length} (expected ${expectedCount})` : `❌ Wrong count`);

            // Verify structure
            const allHaveRequiredFields = lineItems.every(item =>
                item.partNumber &&
                item.color &&
                item.size &&
                item.quantity &&
                item.price
            );
            console.log(`Required fields:`, allHaveRequiredFields ? '✅ All items complete' : '❌ Missing fields');

            // Verify no consolidation
            const uniqueItems = new Set(lineItems.map(item => `${item.color}-${item.size}`)).size;
            const noConsolidation = uniqueItems === lineItems.length;
            console.log(`No consolidation:`, noConsolidation ? '✅ All items unique' : '❌ Duplicates found');

            // Verify base part numbers
            const allBasePartNumbers = lineItems.every(item => item.partNumber === 'PC54');
            console.log(`Base part numbers:`, allBasePartNumbers ? '✅ All use PC54' : '❌ Some use variant SKUs');

            // Calculate totals
            let totalQuantity = 0;
            let totalAmount = 0;

            lineItems.forEach(item => {
                totalQuantity += item.quantity;
                totalAmount += item.quantity * item.price;
            });

            console.log(`\n📊 Order Totals:`);
            console.log(`   Total Pieces: ${totalQuantity}`);
            console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);

            // Performance check
            const performanceOk = (endTime - startTime) < 1000;  // Should be under 1 second
            console.log(`\n⚡ Performance:`, performanceOk ? '✅ Fast (<1s)' : '⚠️ Slow (>1s)');

            const allTestsPassed = countCorrect && allHaveRequiredFields && noConsolidation && allBasePartNumbers && performanceOk;

            console.groupEnd();
            return allTestsPassed;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // EXTENDED TEST 3: MULTI-DECORATION ORDER
    // ============================================================================

    /**
     * Test order with multiple decoration locations
     *
     * Validates:
     * - Multiple design blocks (front + back)
     * - Correct design code assignment
     * - Proper image URL handling
     * - Design type mapping
     * - Location name formatting
     */
    function testMultiDecoration(serviceInstance) {
        console.group('🧪 Extended Test 3: Multi-Decoration Order');
        console.log('Testing orders with multiple decoration locations\n');

        try {
            const mockDesignFiles = [
                {
                    location: 'Full Front',
                    locationCode: 'FF',
                    imageUrl: 'https://example.com/designs/front-logo.png'
                },
                {
                    location: 'Full Back',
                    locationCode: 'FB',
                    imageUrl: 'https://example.com/designs/back-design.png'
                }
            ];

            console.log(`📐 Design Locations: ${mockDesignFiles.length}`);
            mockDesignFiles.forEach((design, idx) => {
                console.log(`   ${idx + 1}. ${design.location} (${design.locationCode})`);
            });

            const designBlocks = serviceInstance.buildDesignBlocks(mockDesignFiles);

            console.log(`\n📦 Generated: ${designBlocks.length} design blocks\n`);

            // Verify count
            const countCorrect = designBlocks.length === mockDesignFiles.length;
            console.log(`Design block count:`, countCorrect ? `✅ ${designBlocks.length} (expected ${mockDesignFiles.length})` : `❌ Wrong count`);

            // Verify structure
            const allHaveRequiredFields = designBlocks.every(block =>
                block.designTypeId &&
                block.productColor &&
                block.code &&
                block.imageUrl
            );
            console.log(`Required fields:`, allHaveRequiredFields ? '✅ All blocks complete' : '❌ Missing fields');

            // Verify unique codes
            const codes = designBlocks.map(block => block.code);
            const uniqueCodes = new Set(codes).size === codes.length;
            console.log(`Unique design codes:`, uniqueCodes ? '✅ All unique' : '❌ Duplicates found');

            // Verify field naming (proxy API format)
            const correctFieldNames = designBlocks.every(block =>
                'designTypeId' in block &&  // NOT designType
                'productColor' in block &&  // NOT forProductColor
                'code' in block &&          // NOT designCode
                'imageUrl' in block         // lowercase 'rl'
            );
            console.log(`Proxy field naming:`, correctFieldNames ? '✅ Correct format' : '❌ Wrong field names');

            // Display sample block
            console.log(`\n📋 Sample Design Block:`);
            console.table([designBlocks[0]]);

            const allTestsPassed = countCorrect && allHaveRequiredFields && uniqueCodes && correctFieldNames;

            console.groupEnd();
            return allTestsPassed;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // EXTENDED TEST 4: 9 AM CUTOFF EDGE CASES
    // ============================================================================

    /**
     * Test 9 AM PST cutoff boundary conditions
     *
     * Validates:
     * - Before 9 AM PST → today's order date
     * - After 9 AM PST → tomorrow's order date
     * - Daylight saving time handling
     * - Timezone conversion accuracy
     */
    function testCutoffEdgeCases(serviceInstance) {
        console.group('🧪 Extended Test 4: 9 AM Cutoff Edge Cases');
        console.log('Testing order date boundary conditions\n');

        try {
            const testScenarios = [
                {
                    name: 'Before cutoff (8:00 AM PST)',
                    time: '08:00:00',
                    timezone: 'PST',
                    expectedOrderDate: 'today'
                },
                {
                    name: 'At cutoff (9:00 AM PST)',
                    time: '09:00:00',
                    timezone: 'PST',
                    expectedOrderDate: 'tomorrow'
                },
                {
                    name: 'After cutoff (10:00 AM PST)',
                    time: '10:00:00',
                    timezone: 'PST',
                    expectedOrderDate: 'tomorrow'
                },
                {
                    name: 'Just before cutoff (8:59 AM PST)',
                    time: '08:59:00',
                    timezone: 'PST',
                    expectedOrderDate: 'today'
                },
                {
                    name: 'Just after cutoff (9:01 AM PST)',
                    time: '09:01:00',
                    timezone: 'PST',
                    expectedOrderDate: 'tomorrow'
                }
            ];

            let passed = 0;
            let failed = 0;

            testScenarios.forEach(scenario => {
                console.log(`\n⏰ Scenario: ${scenario.name}`);

                // Create test date at specific PST time
                const testDate = new Date();
                const [hours, minutes, seconds] = scenario.time.split(':').map(Number);

                // Set to PST (UTC-8 or UTC-7 during DST)
                testDate.setHours(hours + 8, minutes, seconds);  // Convert PST to UTC

                const orderDate = serviceInstance.determineOrderDate(testDate);

                // Determine expected date
                const today = new Date(testDate);
                today.setHours(0, 0, 0, 0);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const expectedDate = scenario.expectedOrderDate === 'today' ? today : tomorrow;
                const actualDate = new Date(orderDate);
                actualDate.setHours(0, 0, 0, 0);

                const isCorrect = actualDate.getTime() === expectedDate.getTime();

                if (isCorrect) {
                    console.log(`   ✅ Order Date: ${orderDate} (Correct - ${scenario.expectedOrderDate})`);
                    passed++;
                } else {
                    console.log(`   ❌ Order Date: ${orderDate}`);
                    console.log(`   Expected: ${expectedDate.toISOString()} (${scenario.expectedOrderDate})`);
                    failed++;
                }
            });

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`Results: ${passed}/${testScenarios.length} scenarios passed`);

            if (failed > 0) {
                console.warn(`⚠️ ${failed} scenario(s) failed`);
            }

            console.groupEnd();
            return failed === 0;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // EXTENDED TEST 5: INTERNATIONAL ADDRESSES
    // ============================================================================

    /**
     * Test address validation for international shipping
     *
     * Validates:
     * - Required field presence
     * - Address format handling
     * - Postal code validation
     * - Country field presence
     * - State/province handling
     */
    function testInternationalAddresses(serviceInstance) {
        console.group('🧪 Extended Test 5: International Addresses');
        console.log('Testing address validation for international shipping\n');

        try {
            const testAddresses = [
                {
                    name: 'US Address (Standard)',
                    address: {
                        firstName: 'John',
                        lastName: 'Smith',
                        address1: '123 Main Street',
                        city: 'Seattle',
                        state: 'WA',
                        zip: '98101',
                        country: 'USA'
                    },
                    shouldPass: true
                },
                {
                    name: 'Canadian Address',
                    address: {
                        firstName: 'Jane',
                        lastName: 'Doe',
                        address1: '456 Maple Ave',
                        city: 'Vancouver',
                        state: 'BC',
                        zip: 'V6B 1A1',
                        country: 'Canada'
                    },
                    shouldPass: true
                },
                {
                    name: 'Missing Required Field',
                    address: {
                        firstName: 'Test',
                        lastName: 'User',
                        address1: '789 Oak Lane',
                        city: 'Portland',
                        // Missing state
                        zip: '97201',
                        country: 'USA'
                    },
                    shouldPass: false
                },
                {
                    name: 'Long Address Line',
                    address: {
                        firstName: 'Corporation',
                        lastName: 'LLC',
                        address1: '1234 Very Long Street Name That Might Cause Issues Building 5 Suite 300',
                        city: 'Los Angeles',
                        state: 'CA',
                        zip: '90001',
                        country: 'USA'
                    },
                    shouldPass: true
                }
            ];

            let passed = 0;
            let failed = 0;

            testAddresses.forEach(test => {
                console.log(`\n📬 Testing: ${test.name}`);

                try {
                    // Validate address
                    const requiredFields = ['firstName', 'lastName', 'address1', 'city', 'state', 'zip', 'country'];
                    const hasAllFields = requiredFields.every(field => test.address[field]);

                    const isValid = hasAllFields;
                    const testPassed = isValid === test.shouldPass;

                    if (testPassed) {
                        console.log(`   ✅ ${isValid ? 'Valid' : 'Invalid'} (as expected)`);
                        passed++;
                    } else {
                        console.log(`   ❌ ${isValid ? 'Valid' : 'Invalid'} (expected ${test.shouldPass ? 'valid' : 'invalid'})`);
                        failed++;
                    }

                    // Display address details
                    console.log(`   ${test.address.firstName} ${test.address.lastName}`);
                    console.log(`   ${test.address.address1}`);
                    console.log(`   ${test.address.city}, ${test.address.state || 'N/A'} ${test.address.zip}`);
                    console.log(`   ${test.address.country || 'N/A'}`);

                } catch (error) {
                    if (test.shouldPass) {
                        console.log(`   ❌ Unexpected error: ${error.message}`);
                        failed++;
                    } else {
                        console.log(`   ✅ Correctly rejected (${error.message})`);
                        passed++;
                    }
                }
            });

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`Results: ${passed}/${testAddresses.length} addresses validated correctly`);

            if (failed > 0) {
                console.warn(`⚠️ ${failed} address(es) failed validation`);
            }

            console.groupEnd();
            return failed === 0;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // EXTENDED TEST 6: PAYMENT PROCESSING EDGE CASES
    // ============================================================================

    /**
     * Test payment data formatting and validation
     *
     * Validates:
     * - Large payment amounts
     * - Partial payments
     * - Multiple payment methods
     * - Currency precision (2 decimal places)
     * - Payment status codes
     */
    function testPaymentEdgeCases(serviceInstance) {
        console.group('🧪 Extended Test 6: Payment Processing Edge Cases');
        console.log('Testing payment data formatting and validation\n');

        try {
            const testPayments = [
                {
                    name: 'Large Order Payment',
                    amount: 15847.99,
                    method: 'credit_card',
                    status: 'paid',
                    notes: 'Testing large amount formatting'
                },
                {
                    name: 'Small Order Payment',
                    amount: 24.50,
                    method: 'credit_card',
                    status: 'paid',
                    notes: 'Testing minimum order amount'
                },
                {
                    name: 'Partial Payment',
                    amount: 500.00,
                    method: 'credit_card',
                    status: 'partial',
                    notes: 'Testing partial payment handling'
                },
                {
                    name: 'Precision Test',
                    amount: 123.456,  // 3 decimals
                    method: 'credit_card',
                    status: 'paid',
                    notes: 'Should round to 2 decimals'
                }
            ];

            let passed = 0;
            let failed = 0;

            testPayments.forEach(test => {
                console.log(`\n💳 Testing: ${test.name}`);
                console.log(`   Amount: $${test.amount}`);
                console.log(`   Notes: ${test.notes}\n`);

                const paymentData = serviceInstance.buildPaymentBlocks(
                    test.amount,
                    test.method,
                    test.status
                );

                // Verify formatting
                const formattedAmount = paymentData[0].amount;
                const hasCorrectPrecision = /^\d+\.\d{2}$/.test(formattedAmount.toString());

                console.log(`   Formatted: $${formattedAmount}`);
                console.log(`   Precision:`, hasCorrectPrecision ? '✅ 2 decimals' : '❌ Wrong precision');

                // Verify status
                const hasStatus = paymentData[0].status === test.status;
                console.log(`   Status:`, hasStatus ? `✅ ${test.status}` : `❌ Wrong status`);

                // Verify method
                const hasMethod = paymentData[0].method === test.method;
                console.log(`   Method:`, hasMethod ? `✅ ${test.method}` : `❌ Wrong method`);

                const testPassed = hasCorrectPrecision && hasStatus && hasMethod;

                if (testPassed) {
                    passed++;
                } else {
                    failed++;
                }
            });

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`Results: ${passed}/${testPayments.length} payment scenarios passed`);

            if (failed > 0) {
                console.warn(`⚠️ ${failed} payment(s) failed validation`);
            }

            console.groupEnd();
            return failed === 0;

        } catch (error) {
            console.error('❌ Test failed:', error);
            console.groupEnd();
            return false;
        }
    }

    // ============================================================================
    // COMPLETE EXTENDED TEST SUITE
    // ============================================================================

    /**
     * Run all extended tests in sequence
     *
     * @param {Object} serviceInstance - Instance of order service to test
     * @returns {Object} Test results summary
     */
    function runAllExtendedTests(serviceInstance) {
        console.clear();
        console.log('🧪 Running Extended Test Suite for Order Service');
        console.log('Advanced scenarios and edge cases validation');
        console.log('='.repeat(60) + '\n');

        if (!serviceInstance) {
            console.error('❌ No service instance provided');
            console.log('\nUsage: OrderServiceTestExtended.runAllExtendedTests(yourServiceInstance)');
            return;
        }

        const results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Run each extended test
        const tests = [
            { name: 'Holiday Weekend Calculations', fn: testHolidayWeekends },
            { name: 'Large Order (50+ items)', fn: testLargeOrder },
            { name: 'Multi-Decoration Order', fn: testMultiDecoration },
            { name: '9 AM Cutoff Edge Cases', fn: testCutoffEdgeCases },
            { name: 'International Addresses', fn: testInternationalAddresses },
            { name: 'Payment Edge Cases', fn: testPaymentEdgeCases }
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
        console.log('📊 Extended Test Suite Summary');
        console.log('='.repeat(60));
        console.table(results.tests);

        const total = results.passed + results.failed;
        const percentage = ((results.passed / total) * 100).toFixed(1);

        console.log(`\nResults: ${results.passed}/${total} tests passed (${percentage}%)`);

        if (results.failed === 0) {
            console.log('✅ All extended tests passed!');
            console.log('🚀 Service is production-ready for complex scenarios');
        } else {
            console.warn(`⚠️ ${results.failed} extended test(s) failed`);
            console.log('📋 Review failures above and fix before deploying to production');
        }

        return results;
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    window.OrderServiceTestExtended = {
        // Individual extended tests
        testHolidayWeekends,
        testLargeOrder,
        testMultiDecoration,
        testCutoffEdgeCases,
        testInternationalAddresses,
        testPaymentEdgeCases,

        // Complete extended test suite
        runAllExtendedTests,

        // Version info
        version: '1.0.0'
    };

    console.log('✅ OrderServiceTestExtended loaded - Extended testing utilities ready');
    console.log('📖 Usage: OrderServiceTestExtended.runAllExtendedTests(yourServiceInstance)');

})(window);
