/* api-test-runner.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/api-test-runner.html (Rule 3, 2026.09.05.11) ──
const outputEl = document.getElementById('output');
        const statusEl = document.getElementById('status');
        const runButton = document.getElementById('runTests');
        
        // Override console.log to capture output
        const originalLog = console.log;
        console.log = function(...args) {
            originalLog.apply(console, args);
            const message = args.join(' ');
            outputEl.textContent += message + '\n';
            outputEl.scrollTop = outputEl.scrollHeight;
        };
        
        async function runTests() {
            runButton.disabled = true;
            clearOutput();
            
            showStatus('🔄 Running API tests...', 'running');
            
            try {
                const result = await window.runTaskAPITests();
                
                if (result.success) {
                    showStatus('✅ All tests passed! The SizeBreakdown fix is working correctly.', 'success');
                    console.log('\n🎉 SUCCESS: The task saving functionality has been fixed!');
                    console.log('💡 You can now save tasks without the 500 error.');
                } else {
                    showStatus('❌ Tests failed. Check output for details.', 'error');
                    console.log('\n❌ FAILURE: ' + result.error);
                }
            } catch (error) {
                showStatus('❌ Test execution failed.', 'error');
                console.log('\n💥 CRITICAL ERROR: ' + error.message);
                console.log('Stack trace: ' + error.stack);
            } finally {
                runButton.disabled = false;
            }
        }
        
        function showStatus(message, type) {
            statusEl.textContent = message;
            statusEl.className = `status ${type}`;
            statusEl.style.display = 'block';
        }
        
        function clearOutput() {
            outputEl.textContent = '';
            statusEl.style.display = 'none';
        }
        
        // Show initial instructions
        console.log('🧪 Task API Test Runner Loaded');
        console.log('=' .repeat(50));
        console.log('This test will verify that the SizeBreakdown fix is working correctly.');
        console.log('It will test the complete flow from session creation to task saving.');
        console.log('Click "Run API Tests" to begin...');
        console.log('');
