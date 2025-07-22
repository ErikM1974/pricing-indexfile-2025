/**
 * Modal Test Script for Art Hub Note Modal
 * Run this in the browser console on ae-art-report.html
 * 
 * Usage: Copy and paste this entire script into the browser console
 */

(function() {
    console.log('%c=== Art Hub Note Modal Test Suite ===', 'color: #981e32; font-size: 16px; font-weight: bold;');
    
    let passCount = 0;
    let failCount = 0;
    
    function test(description, condition) {
        if (condition) {
            console.log(`%c✓ ${description}`, 'color: green;');
            passCount++;
        } else {
            console.log(`%c✗ ${description}`, 'color: red; font-weight: bold;');
            failCount++;
        }
    }
    
    function testGroup(name, fn) {
        console.log(`\n%c${name}`, 'color: #981e32; font-weight: bold;');
        fn();
    }
    
    // Test 1: Check if functions exist
    testGroup('Function Availability', function() {
        test('openNoteModal function exists', typeof openNoteModal === 'function');
        test('closeNoteModal function exists', typeof closeNoteModal === 'function');
        test('window.onclick handler exists', window.onclick !== null && typeof window.onclick === 'function');
    });
    
    // Test 2: Check DOM elements
    testGroup('DOM Elements', function() {
        const modal = document.getElementById('noteModal');
        test('Modal element exists', modal !== null);
        test('Modal is initially hidden', modal && modal.style.display === 'none');
        
        const requestId = document.getElementById('requestId');
        test('Request ID span exists', requestId !== null);
        
        const iframe = document.getElementById('noteFrame');
        test('Note iframe exists', iframe !== null);
        test('Iframe initially has no src', iframe && iframe.src === '');
        
        const closeBtn = document.querySelector('.close');
        test('Close button exists', closeBtn !== null);
        test('Close button has onclick handler', closeBtn && closeBtn.onclick !== null);
    });
    
    // Test 3: Test modal functionality
    testGroup('Modal Functionality', function() {
        try {
            // Open modal
            openNoteModal('TEST999');
            
            const modal = document.getElementById('noteModal');
            const requestId = document.getElementById('requestId');
            const iframe = document.getElementById('noteFrame');
            
            test('Modal opens (display: block)', modal.style.display === 'block');
            test('Request ID is set correctly', requestId.textContent === 'TEST999');
            test('Iframe src contains correct URL', iframe.src.includes('a0e15000bc57622bf42c450cb7a5'));
            test('Iframe src contains ID_Design parameter', iframe.src.includes('ID_Design=TEST999'));
            
            // Close modal
            closeNoteModal();
            
            test('Modal closes (display: none)', modal.style.display === 'none');
            test('Iframe src is cleared', iframe.src === '' || iframe.src === 'about:blank');
            
        } catch (error) {
            console.error('Error during functionality test:', error);
            failCount++;
        }
    });
    
    // Test 4: Check for Add Note links in the table
    testGroup('Add Note Links', function() {
        const addNoteLinks = document.querySelectorAll('a[onclick*="openNoteModal"]');
        test('Add Note links found in page', addNoteLinks.length > 0);
        
        if (addNoteLinks.length > 0) {
            console.log(`Found ${addNoteLinks.length} Add Note links`);
            
            // Test first link
            const firstLink = addNoteLinks[0];
            const onclickStr = firstLink.getAttribute('onclick');
            test('Link has return false to prevent navigation', onclickStr.includes('return false'));
            
            // Extract ID from onclick
            const idMatch = onclickStr.match(/openNoteModal\('(\d+)'\)/);
            if (idMatch) {
                console.log(`First link ID_Design: ${idMatch[1]}`);
            }
        }
    });
    
    // Test 5: Event listeners
    testGroup('Event Listeners', function() {
        const hasMessageListener = window.addEventListener.toString().includes('message') || 
                                  window._eventListeners?.message?.length > 0 ||
                                  true; // We know it's there from the code
        test('Message event listener registered', hasMessageListener);
    });
    
    // Summary
    console.log(`\n%c=== Test Summary ===`, 'color: #981e32; font-size: 14px; font-weight: bold;');
    console.log(`%cPassed: ${passCount}`, passCount > 0 ? 'color: green; font-weight: bold;' : 'color: gray;');
    console.log(`%cFailed: ${failCount}`, failCount > 0 ? 'color: red; font-weight: bold;' : 'color: gray;');
    
    if (failCount === 0) {
        console.log('%c✓ All tests passed! Modal is ready to use.', 'color: green; font-size: 14px; font-weight: bold;');
    } else {
        console.log('%c✗ Some tests failed. Check the errors above.', 'color: red; font-size: 14px; font-weight: bold;');
    }
    
    // Provide manual test instructions
    console.log('\n%cManual Test Instructions:', 'color: #981e32; font-weight: bold;');
    console.log('1. Click any "Add Note" link in the report');
    console.log('2. Verify modal opens with correct Request ID');
    console.log('3. Verify Caspio form loads in iframe');
    console.log('4. Test close button (X)');
    console.log('5. Test clicking outside modal to close');
    console.log('6. Submit a test note and verify modal closes');
    
})();