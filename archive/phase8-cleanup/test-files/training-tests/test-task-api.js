/**
 * API Test Script for Task Tracking System
 * Tests the complete flow: session creation, task saving, and data retrieval
 */

class TaskAPITester {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.testPrefix = 'TEST';
        this.testEmail = 'test@nwcustomapparel.com';
        this.testResults = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(logEntry);
        this.testResults.push({ timestamp, type, message });
    }

    async runAllTests() {
        this.log('🧪 Starting API Test Suite for Task Tracking System');
        this.log('=' .repeat(60));

        try {
            // Test 1: Session Creation
            await this.testSessionCreation();
            
            // Test 2: Task Saving (the main fix)
            await this.testTaskSaving();
            
            // Test 3: Task Retrieval
            await this.testTaskRetrieval();
            
            // Test 4: Data Integrity
            await this.testDataIntegrity();
            
            // Clean up
            await this.cleanup();
            
            this.log('✅ All tests completed successfully!');
            this.printSummary();
            
        } catch (error) {
            this.log(`❌ Test suite failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async testSessionCreation() {
        this.log('Test 1: Session Creation');
        
        const testQuoteID = this.generateTestQuoteID();
        const sessionData = {
            QuoteID: testQuoteID,
            SessionID: `test_sess_${Date.now()}`,
            CustomerEmail: this.testEmail,
            CustomerName: 'Test User - API Test',
            CompanyName: 'API Test Company',
            Phone: '555-0123',
            TotalQuantity: 0,
            SubtotalAmount: 0,
            LTMFeeTotal: 0,
            TotalAmount: 0,
            Status: 'In Progress',
            ExpiresAt: this.getEndOfDay(),
            Notes: 'API Test Session'
        };

        const response = await fetch(`${this.baseURL}/api/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Session creation failed: ${response.status} - ${errorText}`);
        }

        this.testQuoteID = testQuoteID;
        this.log(`✅ Session created successfully: ${testQuoteID}`);
    }

    async testTaskSaving() {
        this.log('Test 2: Task Saving (SizeBreakdown Fix)');
        
        // Create mock task data similar to real timer data
        const mockTaskData = {
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            totalSeconds: 450, // 7.5 minutes
            count: 3,
            timerSessions: [
                { start: new Date().toISOString(), duration: 180 },
                { start: new Date().toISOString(), duration: 270 }
            ],
            details: { difficulty: 'medium', notes: 'API test task' },
            notes: 'This is a test task from API'
        };

        // Create the exact data structure our fixed service uses
        const timerData = {
            startTime: mockTaskData.startTime,
            endTime: mockTaskData.endTime,
            totalSeconds: mockTaskData.totalSeconds,
            totalMinutes: Math.round(mockTaskData.totalSeconds / 60),
            timerSessions: mockTaskData.timerSessions,
            details: mockTaskData.details,
            notes: mockTaskData.notes
        };

        const itemData = {
            QuoteID: this.testQuoteID,
            LineNumber: 1,
            StyleNumber: '1', // Simplified format from our fix
            ProductName: 'API Test Task - Customer Notifications',
            Color: 'Completed',
            ColorCode: JSON.stringify(timerData), // Our fix: store in ColorCode
            EmbellishmentType: 'task',
            PrintLocation: 'Office',
            PrintLocationName: 'Office Tasks',
            Quantity: parseInt(mockTaskData.count),
            HasLTM: 'No',
            BaseUnitPrice: Math.round(mockTaskData.totalSeconds / mockTaskData.count),
            LTMPerUnit: 0,
            FinalUnitPrice: Math.round(mockTaskData.totalSeconds / mockTaskData.count),
            LineTotal: mockTaskData.totalSeconds,
            SizeBreakdown: '{}', // Our fix: empty object string
            PricingTier: 'Daily',
            ImageURL: '',
            AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
        };

        this.log('Attempting to save task with fixed data structure...');
        this.log(`ColorCode length: ${itemData.ColorCode.length} characters`);
        this.log(`SizeBreakdown: ${itemData.SizeBreakdown}`);

        const response = await fetch(`${this.baseURL}/api/quote_items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Task saving failed: ${response.status} - ${errorText}`);
        }

        this.log('✅ Task saved successfully with new data structure!');
        this.testItemData = itemData;
    }

    async testTaskRetrieval() {
        this.log('Test 3: Task Retrieval');
        
        const response = await fetch(`${this.baseURL}/api/quote_items?quoteID=${this.testQuoteID}`);
        
        if (!response.ok) {
            throw new Error(`Task retrieval failed: ${response.status}`);
        }

        const items = await response.json();
        
        if (items.length === 0) {
            throw new Error('No tasks found after saving');
        }

        this.log(`✅ Retrieved ${items.length} task(s)`);
        this.retrievedItems = items;
    }

    async testDataIntegrity() {
        this.log('Test 4: Data Integrity Check');
        
        const item = this.retrievedItems[0];
        
        // Check that SizeBreakdown is the simple string we expect
        if (item.SizeBreakdown !== '{}') {
            throw new Error(`SizeBreakdown integrity check failed. Expected: '{}', Got: '${item.SizeBreakdown}'`);
        }
        this.log('✅ SizeBreakdown correctly stored as simple string');

        // Check that ColorCode contains our timer data
        let timerData;
        try {
            timerData = JSON.parse(item.ColorCode);
        } catch (e) {
            throw new Error(`ColorCode parsing failed: ${e.message}`);
        }

        // Verify essential timer data fields
        const requiredFields = ['startTime', 'endTime', 'totalSeconds', 'totalMinutes', 'timerSessions'];
        for (const field of requiredFields) {
            if (!(field in timerData)) {
                throw new Error(`Missing required field in timer data: ${field}`);
            }
        }
        this.log('✅ Timer data integrity verified');

        // Check calculated values
        if (timerData.totalMinutes !== Math.round(timerData.totalSeconds / 60)) {
            throw new Error('Calculated minutes don\'t match');
        }
        this.log('✅ Calculated values are correct');

        // Check that we can simulate the parsing our app will do
        const parsedTask = {
            taskNumber: item.LineNumber,
            taskName: item.ProductName,
            completed: item.Color === 'Completed',
            count: item.Quantity,
            totalSeconds: item.LineTotal,
            totalMinutes: Math.round(item.LineTotal / 60),
            details: timerData, // This is what our fixed app will get
            pkId: item.PK_ID
        };

        this.log('✅ Data can be correctly parsed by application');
        this.log(`Parsed task: ${parsedTask.taskName}, ${parsedTask.totalMinutes} min, ${parsedTask.count} count`);
    }

    async cleanup() {
        this.log('Test 5: Cleanup');
        
        try {
            // Get the session to find its PK_ID
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${this.testQuoteID}`);
            const sessions = await sessionResponse.json();
            
            if (sessions.length > 0) {
                const sessionId = sessions[0].PK_ID;
                
                // Delete the test session
                const deleteResponse = await fetch(`${this.baseURL}/api/quote_sessions/${sessionId}`, {
                    method: 'DELETE'
                });
                
                if (deleteResponse.ok) {
                    this.log('✅ Test data cleaned up successfully');
                } else {
                    this.log('⚠️ Could not clean up test session (not critical)', 'warn');
                }
            }
        } catch (error) {
            this.log(`⚠️ Cleanup warning: ${error.message}`, 'warn');
        }
    }

    generateTestQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const timestamp = now.getTime().toString().slice(-4); // Last 4 digits for uniqueness
        return `${this.testPrefix}${month}${day}-${timestamp}`;
    }

    getEndOfDay() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return end.toISOString().replace(/\.\d{3}Z$/, '');
    }

    printSummary() {
        this.log('=' .repeat(60));
        this.log('📊 TEST SUMMARY');
        this.log('=' .repeat(60));
        
        const testCounts = {
            info: this.testResults.filter(r => r.type === 'info').length,
            error: this.testResults.filter(r => r.type === 'error').length,
            warn: this.testResults.filter(r => r.type === 'warn').length
        };
        
        this.log(`Total log entries: ${this.testResults.length}`);
        this.log(`✅ Success entries: ${testCounts.info}`);
        this.log(`⚠️ Warning entries: ${testCounts.warn}`);
        this.log(`❌ Error entries: ${testCounts.error}`);
        
        if (testCounts.error === 0) {
            this.log('🎉 ALL TESTS PASSED! The SizeBreakdown fix is working correctly.');
        }
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskAPITester;
}

// Auto-run if called directly in browser or node
if (typeof window !== 'undefined') {
    // Browser environment
    window.TaskAPITester = TaskAPITester;
    
    // Add a global function to run tests
    window.runTaskAPITests = async function() {
        const tester = new TaskAPITester();
        try {
            await tester.runAllTests();
            return { success: true, results: tester.testResults };
        } catch (error) {
            console.error('Test failed:', error);
            return { success: false, error: error.message, results: tester.testResults };
        }
    };
    
    console.log('🧪 Task API Tester loaded. Run window.runTaskAPITests() to start testing.');
}

// Node.js environment
if (typeof process !== 'undefined' && process.argv) {
    // Check if this script is being run directly
    if (require.main === module) {
        (async () => {
            const tester = new TaskAPITester();
            try {
                await tester.runAllTests();
                process.exit(0);
            } catch (error) {
                console.error('Test failed:', error);
                process.exit(1);
            }
        })();
    }
}