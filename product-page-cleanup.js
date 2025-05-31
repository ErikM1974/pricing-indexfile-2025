// This script will run when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Function to clean up JavaScript code from tab panels
    function cleanupJavaScriptCode() {
        // Get all tab panels
        const tabPanels = [
            document.getElementById('embroidery-panel'),
            document.getElementById('cap-emb-panel'),
            document.getElementById('dtg-panel'),
            document.getElementById('screenprint-panel')
        ];
        
        // Process each panel
        tabPanels.forEach(panel => {
            if (!panel) return;
            
            // Remove any pre elements (which might contain code)
            const preElements = panel.querySelectorAll('pre');
            preElements.forEach(pre => {
                pre.parentNode.removeChild(pre);
            });
            
            // Remove any code elements
            const codeElements = panel.querySelectorAll('code');
            codeElements.forEach(code => {
                code.parentNode.removeChild(code);
            });
            
            // Find and remove any text nodes that contain script code
            function removeScriptTextNodes(element) {
                if (!element) return;
                
                // Check all child nodes
                for (let i = 0; i < element.childNodes.length; i++) {
                    const node = element.childNodes[i];
                    
                    // If it's a text node with script content
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (node.textContent.includes('new function') ||
                            node.textContent.includes('this.appKey') ||
                            node.textContent.includes('function requestDataPage')) {
                            element.removeChild(node);
                            i--; // Adjust index since we removed a node
                        }
                    }
                    // If it's an element node, recursively check its children
                    else if (node.nodeType === Node.ELEMENT_NODE) {
                        removeScriptTextNodes(node);
                    }
                }
            }
            
            // Apply the text node cleanup
            removeScriptTextNodes(panel);
        });
    }
    
    // Run cleanup when page loads
    cleanupJavaScriptCode();
    
    // Also run cleanup when tabs are clicked
    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Run cleanup after a short delay to ensure content is loaded
            setTimeout(cleanupJavaScriptCode, 500);
        });
    });
    
    // Set up a MutationObserver to detect when content changes
    const observer = new MutationObserver(function(mutations) {
        // Run cleanup after content changes
        cleanupJavaScriptCode();
    });
    
    // Observe all tab panels for content changes
    const tabPanels = document.querySelectorAll('.tab-content-panel');
    tabPanels.forEach(panel => {
        observer.observe(panel, {
            childList: true,
            subtree: true,
            characterData: true
        });
    });
});

// This script runs immediately to hide script content and handle loading messages
(function() {
    // TARGETED FIX FOR CASPIO LOADING MESSAGE
    function setupCaspioLoadingMessageFix() {
        console.log("Setting up Caspio loading message fix");
        
        // Function to hide all loading messages
        function hideAllLoadingMessages() {
            const loadingMessages = document.querySelectorAll('.loading-message');
            loadingMessages.forEach(function(msg) {
                console.log('Hiding loading message:', msg);
                msg.style.display = 'none';
            });
        }
        
        // Function to check if Caspio table is loaded
        function checkCaspioTableLoaded() {
            // Check for various indicators that Caspio content has loaded
            const hasCaspioTable = !!document.querySelector('.matrix-price-table') ||
                                  !!document.querySelector('.cbResultSetTable') ||
                                  !!document.querySelector('#matrix-price-body') ||
                                  !!document.querySelector('.cbResultSet');
            
            if (hasCaspioTable) {
                console.log('Caspio table detected, hiding loading messages');
                hideAllLoadingMessages();
                return true;
            }
            return false;
        }
        
        // Set up a MutationObserver to detect when Caspio content is added
        const observer = new MutationObserver(function(mutations) {
            if (checkCaspioTableLoaded()) {
                // If we found the table, disconnect the observer
                observer.disconnect();
            }
        });
        
        // Start observing the document with the configured parameters
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Also check immediately in case the table is already loaded
        checkCaspioTableLoaded();
        
        // Set up periodic checks to ensure loading message is hidden
        const checkIntervals = [1000, 2000, 3000, 5000, 8000, 10000];
        checkIntervals.forEach(interval => {
            setTimeout(() => {
                if (document.querySelector('.loading-message')) {
                    console.log(`Checking for Caspio table after ${interval}ms`);
                    if (checkCaspioTableLoaded()) {
                        console.log(`Found Caspio table after ${interval}ms`);
                    } else {
                        // If we still have loading messages but no table after 5+ seconds,
                        // hide them anyway as a fallback
                        if (interval >= 5000) {
                            console.log(`No Caspio table found after ${interval}ms, hiding loading messages anyway`);
                            hideAllLoadingMessages();
                        }
                    }
                }
            }, interval);
        });
    }
    
    // Call the setup function immediately
    setupCaspioLoadingMessageFix();
    
    // Also call it when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', setupCaspioLoadingMessageFix);
    // Create a style element to hide script content
    const styleEl = document.createElement('style');
    styleEl.id = 'hide-script-content-style';
    styleEl.textContent = `
        /* SPECIAL EXCEPTION FOR INVENTORY PANEL - DON'T HIDE ANYTHING */
        #inventory-panel, #inventory-panel *, #inventory-area, #inventory-area * {
            visibility: visible !important;
            display: initial !important;
            position: static !important;
            height: auto !important;
            width: auto !important;
            overflow: visible !important;
            opacity: 1 !important;
        }
        
        /* Fix table display specifically */
        #inventory-table {
            display: table !important;
            width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            margin-top: 15px !important;
        }
        #inventory-table thead {
            display: table-header-group !important;
        }
        #inventory-table tbody {
            display: table-row-group !important;
        }
        #inventory-table tfoot {
            display: table-footer-group !important;
        }
        #inventory-table tr {
            display: table-row !important;
        }
        #inventory-table th, #inventory-table td {
            display: table-cell !important;
            padding: 8px !important;
            text-align: left !important;
        }
        
        /* Hide script content in other panels */
        #embroidery-panel > *:not(#dp5-wrapper):not(.loading-message):not(.iframe-container),
        #cap-emb-panel > *:not(#dp7-wrapper):not(.loading-message):not(.iframe-container),
        #dtg-panel > *:not(#dp6-wrapper):not(.loading-message):not(.iframe-container),
        #screenprint-panel > *:not(#dp8-wrapper):not(.loading-message):not(.iframe-container),
        #dtf-panel > *:not(#dtf-wrapper):not(.loading-message):not(.iframe-container) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
        }
        
        /* Ensure iframe is visible */
        iframe {
            display: block !important;
            visibility: visible !important;
            height: 600px !important;
            width: 100% !important;
            border: none !important;
        }
        
        /* IMPORTANT: Hide loading messages when Caspio table is present */
        .loading-message:has(+ .matrix-price-table),
        .loading-message:has(+ .cbResultSetTable),
        .loading-message:has(~ .matrix-price-table),
        .loading-message:has(~ .cbResultSetTable),
        .loading-message:has(+ iframe),
        .loading-message:has(~ iframe) {
            display: none !important;
        }
        
        /* Hide loading messages in wrapper divs that contain Caspio content */
        #dp5-wrapper:has(.matrix-price-table) .loading-message,
        #dp5-wrapper:has(.cbResultSetTable) .loading-message,
        #dp5-wrapper:has(iframe) .loading-message,
        #dp6-wrapper:has(.matrix-price-table) .loading-message,
        #dp6-wrapper:has(.cbResultSetTable) .loading-message,
        #dp6-wrapper:has(iframe) .loading-message,
        #dp7-wrapper:has(.matrix-price-table) .loading-message,
        #dp7-wrapper:has(.cbResultSetTable) .loading-message,
        #dp7-wrapper:has(iframe) .loading-message,
        #dp8-wrapper:has(.matrix-price-table) .loading-message,
        #dp8-wrapper:has(.cbResultSetTable) .loading-message,
        #dp8-wrapper:has(iframe) .loading-message,
        #dtf-wrapper:has(.matrix-price-table) .loading-message,
        #dtf-wrapper:has(.cbResultSetTable) .loading-message,
        #dtf-wrapper:has(iframe) .loading-message {
            display: none !important;
        }
    `;
    document.head.appendChild(styleEl);
    
    // Function to clean up script content
    function aggressiveCleanup() {
        // Get all tab panels
        const tabPanels = [
            document.getElementById('embroidery-panel'),
            document.getElementById('cap-emb-panel'),
            document.getElementById('dtg-panel'),
            document.getElementById('screenprint-panel')
        ];
        
        tabPanels.forEach(panel => {
            if (!panel) return;
            
            // Get all elements in the panel
            const allElements = panel.querySelectorAll('*');
            
            // Check each element
            allElements.forEach(el => {
                // Skip specific elements we want to keep
                if (el.id === 'dp5-wrapper' || el.id === 'dp6-wrapper' ||
                    el.id === 'dp7-wrapper' || el.id === 'dp8-wrapper' ||
                    el.classList.contains('loading-message') ||
                    el.classList.contains('iframe-container') ||
                    el.tagName === 'IFRAME') {
                    return;
                }
                
                // Check if the element contains script-like content
                const text = el.textContent || '';
                if (text.includes('new function') ||
                    text.includes('this.appKey') ||
                    text.includes('function requestDataPage') ||
                    text.includes('subdomain') ||
                    text.includes('isDotNet') ||
                    text.includes('userQuery')) {
                    
                    // Hide the element
                    el.style.display = 'none';
                    el.style.visibility = 'hidden';
                    el.style.height = '0';
                    el.style.width = '0';
                    el.style.overflow = 'hidden';
                    el.style.position = 'absolute';
                    el.style.left = '-9999px';
                    
                    // Remove the element's content
                    el.innerHTML = '';
                    el.textContent = '';
                }
            });
        });
    }
    
    // Run cleanup immediately
    aggressiveCleanup();
    
    // Run cleanup when DOM is loaded
    document.addEventListener('DOMContentLoaded', aggressiveCleanup);
    
    // Run cleanup when tabs are clicked
    document.addEventListener('DOMContentLoaded', function() {
        const tabLinks = document.querySelectorAll('.tab-link');
        tabLinks.forEach(link => {
            link.addEventListener('click', function() {
                // Run cleanup after a short delay
                setTimeout(aggressiveCleanup, 100);
                
                // Run cleanup again after iframe loads
                setTimeout(aggressiveCleanup, 1000);
                setTimeout(aggressiveCleanup, 2000);
            });
        });
    });
    // Run the original script content hiding logic
})();

// Additional cleanup for any remaining loading messages after a delay
setTimeout(function() {
    console.log('Final check for loading messages');
    const allLoadingMessages = document.querySelectorAll('.loading-message');
    if (allLoadingMessages.length > 0) {
        console.log(`Found ${allLoadingMessages.length} loading messages still visible, hiding them`);
        allLoadingMessages.forEach(function(msg) {
            msg.style.display = 'none';
        });
    } else {
        console.log('No loading messages found');
    }
}, 5000); // Check after 5 seconds

// Add a more aggressive final cleanup
setTimeout(function() {
    console.log('FINAL AGGRESSIVE CLEANUP');
    // Force hide ALL loading messages regardless of context
    const allLoadingMessages = document.querySelectorAll('.loading-message');
    allLoadingMessages.forEach(function(msg) {
        console.log('Forcibly hiding loading message:', msg);
        msg.style.display = 'none';
        msg.style.visibility = 'hidden';
        msg.style.opacity = '0';
        msg.style.height = '0';
        msg.style.overflow = 'hidden';
    });
    
    // Also try to find any elements that might contain "loading" text
    const allElements = document.querySelectorAll('*');
    allElements.forEach(function(el) {
        if (el.textContent && el.textContent.toLowerCase().includes('loading')) {
            const isVisible = window.getComputedStyle(el).display !== 'none';
            if (isVisible && !el.querySelector('iframe') && !el.closest('iframe')) {
                console.log('Found element with loading text, hiding:', el);
                el.style.display = 'none';
            }
        }
    });
}, 12000); // Final aggressive cleanup after 12 seconds