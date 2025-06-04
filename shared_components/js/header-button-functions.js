/**
 * Header Button Functions
 * Implements missing functions for header buttons
 */

(function() {
    'use strict';

    // Share Quote Function
    window.shareQuote = function() {
        const shareData = {
            title: 'Northwest Custom Apparel - Cap Embroidery Quote',
            text: 'Check out my custom cap embroidery quote',
            url: window.location.href
        };

        // Try native share if available (mobile)
        if (navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('Shared successfully'))
                .catch((error) => {
                    // Fallback to copy URL
                    copyToClipboard(window.location.href);
                });
        } else {
            // Desktop fallback - copy URL to clipboard
            copyToClipboard(window.location.href);
        }
    };

    // Toggle Help Function
    window.toggleHelp = function() {
        // Check if help panel exists
        let helpPanel = document.getElementById('help-panel');
        
        if (!helpPanel) {
            // Create help panel if it doesn't exist
            helpPanel = createHelpPanel();
            document.body.appendChild(helpPanel);
        }
        
        // Toggle visibility
        if (helpPanel.classList.contains('show')) {
            helpPanel.classList.remove('show');
            setTimeout(() => {
                helpPanel.style.display = 'none';
            }, 300);
        } else {
            helpPanel.style.display = 'block';
            setTimeout(() => {
                helpPanel.classList.add('show');
            }, 10);
        }
    };

    // Helper function to copy to clipboard
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Quote link copied to clipboard!');
            }).catch(() => {
                fallbackCopyToClipboard(text);
            });
        } else {
            fallbackCopyToClipboard(text);
        }
    }

    // Fallback copy method
    function fallbackCopyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Quote link copied to clipboard!');
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideUp 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    // Create help panel
    function createHelpPanel() {
        const panel = document.createElement('div');
        panel.id = 'help-panel';
        panel.className = 'help-panel';
        panel.innerHTML = `
            <div class="help-panel-content">
                <div class="help-panel-header">
                    <h3>Keyboard Shortcuts & Help</h3>
                    <button onclick="toggleHelp()" class="help-close-btn">&times;</button>
                </div>
                <div class="help-panel-body">
                    <div class="help-section">
                        <h4>⌨️ Keyboard Shortcuts</h4>
                        <ul class="help-shortcuts">
                            <li><kbd>Alt</kbd> + <kbd>Q</kbd> - Focus quantity input</li>
                            <li><kbd>Alt</kbd> + <kbd>S</kbd> - Save quote</li>
                            <li><kbd>Alt</kbd> + <kbd>P</kbd> - Print quote</li>
                            <li><kbd>Alt</kbd> + <kbd>H</kbd> - Toggle this help</li>
                            <li><kbd>Esc</kbd> - Close dialogs</li>
                            <li><kbd>Tab</kbd> - Navigate form fields</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>💡 Quick Tips</h4>
                        <ul class="help-tips">
                            <li>Click quantity shortcuts for fast selection</li>
                            <li>Your quote auto-saves every 30 seconds</li>
                            <li>Prices update automatically as you type</li>
                            <li>Get better pricing at higher quantities</li>
                            <li>Add a back logo for +$5 per cap</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>📞 Need More Help?</h4>
                        <p>Call us at: <strong>253-922-5793</strong></p>
                        <p>Email: <strong>sales@nwcustomapparel.com</strong></p>
                        <p>Hours: <strong>9AM-5PM PST</strong></p>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        const styles = `
            .help-panel {
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                width: 400px;
                max-width: 100%;
                background: white;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                transform: translateX(100%);
                transition: transform 0.3s ease;
                z-index: 2000;
                display: none;
            }
            
            .help-panel.show {
                transform: translateX(0);
            }
            
            .help-panel-content {
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            
            .help-panel-header {
                padding: 20px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .help-panel-header h3 {
                margin: 0;
                color: #212529;
            }
            
            .help-close-btn {
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #6c757d;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .help-panel-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .help-section {
                margin-bottom: 30px;
            }
            
            .help-section h4 {
                color: #495057;
                margin-bottom: 15px;
            }
            
            .help-shortcuts,
            .help-tips {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .help-shortcuts li,
            .help-tips li {
                padding: 8px 0;
                color: #6c757d;
            }
            
            kbd {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 3px;
                padding: 2px 6px;
                font-family: monospace;
                font-size: 0.9em;
            }
            
            @keyframes slideUp {
                from { transform: translate(-50%, 100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            
            @keyframes slideDown {
                from { transform: translate(-50%, 0); opacity: 1; }
                to { transform: translate(-50%, 100%); opacity: 0; }
            }
            
            @media (max-width: 768px) {
                .help-panel {
                    width: 100%;
                }
            }
        `;
        
        // Add styles to page if not already present
        if (!document.getElementById('help-panel-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'help-panel-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }
        
        return panel;
    }

    console.log('[HEADER-BUTTONS] Functions initialized');

})();