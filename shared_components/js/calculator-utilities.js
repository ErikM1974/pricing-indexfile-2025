/**
 * Shared Calculator Utilities
 * Common functions used across all NWCA calculators
 */

// =============================================================================
// SECURITY: HTML Escaping Utilities
// =============================================================================

/**
 * Escape HTML special characters to prevent XSS
 * Use this when inserting user-provided or external data into HTML
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for HTML insertion
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Create a text node safely (alternative to innerHTML for plain text)
 * @param {string} text - Text content
 * @returns {Text} - Text node
 */
function safeTextNode(text) {
    return document.createTextNode(text || '');
}

// Make escapeHTML available globally
window.escapeHTML = escapeHTML;
window.safeTextNode = safeTextNode;

// Common Configuration
const NWCA_CONFIG = {
    emailjs: {
        publicKey: '4qSbDO-SQs19TbP80',
        serviceId: 'service_1c4k67j'
    },
    company: {
        name: 'Northwest Custom Apparel',
        phone: '253-922-5793',
        year: '1977',
        logo: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1'
    }
};

// Sales Representatives Directory
const SALES_REPS = {
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team',
    'ruth@nwcustomapparel.com': 'Ruth Nhong',
    'taylar@nwcustomapparel.com': 'Taylar Hanson',
    'nika@nwcustomapparel.com': 'Nika Lao',
    'erik@nwcustomapparel.com': 'Erik Mickelson',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'bradley@nwcustomapparel.com': 'Bradley Wright',
    'jim@nwcustomapparel.com': 'Jim Mickelson',
    'art@nwcustomapparel.com': 'Steve Deland'
};

/**
 * Calculator Utilities Class
 * Common functionality for all calculators
 */
class CalculatorUtilities {
    
    /**
     * Copy text to clipboard with visual feedback
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button element for feedback
     */
    static copyToClipboard(text, button = null) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showCopyFeedback(button);
            }).catch(err => {
                console.error('Failed to copy:', err);
                this.fallbackCopy(text, button);
            });
        } else {
            this.fallbackCopy(text, button);
        }
    }
    
    /**
     * Fallback copy method for older browsers
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button element for feedback
     */
    static fallbackCopy(text, button = null) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback(button);
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }
    
    /**
     * Show visual feedback for copy action
     * @param {HTMLElement} button - Button element for feedback
     */
    static showCopyFeedback(button) {
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }
    }
    
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} - True if valid
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * Format currency display
     * @param {number} amount - Amount to format
     * @param {boolean} includeCents - Include cents (default true)
     * @returns {string} - Formatted currency string
     */
    static formatCurrency(amount, includeCents = true) {
        const formatted = includeCents ? amount.toFixed(2) : Math.round(amount).toString();
        return `$${formatted}`;
    }
    
    /**
     * Format date for Caspio (ISO without milliseconds)
     * @param {Date} date - Date to format
     * @returns {string} - Caspio-compatible date string
     */
    static formatDateForCaspio(date = new Date()) {
        return date.toISOString().replace(/\.\d{3}Z$/, '');
    }
    
    /**
     * Get sales rep name from email
     * @param {string} email - Sales rep email
     * @returns {string} - Sales rep display name
     */
    static getSalesRepName(email) {
        return SALES_REPS[email] || 'Sales Team';
    }
    
    /**
     * Generate session storage key for quote sequences
     * @param {string} prefix - Quote prefix (e.g., 'DTG', 'EMB')
     * @returns {string} - Storage key for today's sequence
     */
    static generateSequenceKey(prefix) {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        return `${prefix}_quote_sequence_${dateKey}`;
    }
    
    /**
     * Clean up old quote sequences from session storage
     * @param {string} prefix - Quote prefix to clean
     * @param {string} currentDateKey - Current date key to preserve
     */
    static cleanupOldSequences(prefix, currentDateKey) {
        const searchKey = `${prefix}_quote_sequence_`;
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(searchKey) && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    /**
     * Show loading state on button
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - True to show loading, false to hide
     * @param {string} loadingText - Text to show when loading
     * @param {string} defaultText - Default button text
     */
    static setButtonLoading(button, loading, loadingText = 'Loading...', defaultText = 'Submit') {
        if (loading) {
            button.disabled = true;
            button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = defaultText;
        }
    }
    
    /**
     * Show error message with auto-hide
     * @param {string} message - Error message
     * @param {number} duration - Duration in milliseconds (default 5000)
     */
    static showError(message, duration = 5000) {
        const errorElement = document.getElementById('errorMessage') || this.createErrorElement();
        const errorText = errorElement.querySelector('.error-text') || errorElement;
        
        errorText.textContent = message;
        errorElement.classList.add('show');
        
        setTimeout(() => {
            errorElement.classList.remove('show');
        }, duration);
    }
    
    /**
     * Show success message with auto-hide
     * @param {string} message - Success message
     * @param {number} duration - Duration in milliseconds (default 10000)
     */
    static showSuccess(message, duration = 10000) {
        const successElement = document.getElementById('successMessage') || this.createSuccessElement();
        const successText = successElement.querySelector('.success-text') || successElement;
        
        successText.textContent = message;
        successElement.classList.add('show');
        
        setTimeout(() => {
            successElement.classList.remove('show');
        }, duration);
    }
    
    /**
     * Create default error element if it doesn't exist
     * @returns {HTMLElement} - Error element
     */
    static createErrorElement() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.className = 'alert alert-error';
        errorDiv.innerHTML = '<span class="error-text"></span>';
        document.body.appendChild(errorDiv);
        return errorDiv;
    }
    
    /**
     * Create default success element if it doesn't exist
     * @returns {HTMLElement} - Success element
     */
    static createSuccessElement() {
        const successDiv = document.createElement('div');
        successDiv.id = 'successMessage';
        successDiv.className = 'alert alert-success';
        successDiv.innerHTML = '<span class="success-text"></span>';
        document.body.appendChild(successDiv);
        return successDiv;
    }
    
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Get device type for responsive behavior
     * @returns {string} - 'mobile', 'tablet', or 'desktop'
     */
    static getDeviceType() {
        const width = window.innerWidth;
        if (width <= 768) return 'mobile';
        if (width <= 1024) return 'tablet';
        return 'desktop';
    }
    
    /**
     * Smooth scroll to element
     * @param {string|HTMLElement} target - Element or selector to scroll to
     * @param {number} offset - Offset from top (default 0)
     */
    static scrollTo(target, offset = 0) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (element) {
            const top = element.offsetTop - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }
    
    /**
     * Initialize calculator common functionality
     * Sets up EmailJS and any global utilities
     */
    static initializeCalculator() {
        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(NWCA_CONFIG.emailjs.publicKey);
        }
        
        // Add global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal-overlay.active, .modal-overlay.show');
                if (activeModal && typeof closeModal === 'function') {
                    closeModal();
                }
            }
        });
    }
}

// Common Modal Functions
// These are global functions that work with standard modal structures

/**
 * Open email modal
 */
function openEmailModal() {
    const modal = document.getElementById('emailModal');
    if (modal) {
        modal.classList.add('active');
        const firstInput = modal.querySelector('input[required], input[type="text"], input[type="email"]');
        if (firstInput) firstInput.focus();
    }
}

/**
 * Close email modal
 */
function closeEmailModal() {
    const modal = document.getElementById('emailModal');
    if (modal) {
        modal.classList.remove('active');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

/**
 * Close success modal
 */
function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active', 'show');
    }
}

/**
 * Copy quote ID to clipboard (commonly used in success modals)
 */
function copyQuoteID() {
    const quoteIdElement = document.getElementById('successQuoteID') || 
                          document.getElementById('modalQuoteId') ||
                          document.getElementById('quoteIdDisplay');
    
    if (quoteIdElement) {
        const quoteId = quoteIdElement.textContent;
        const copyBtn = event?.target?.closest('button');
        CalculatorUtilities.copyToClipboard(quoteId, copyBtn);
    }
}

/**
 * Toggle accordion items
 * @param {HTMLElement} item - Accordion item element
 */
function toggleAccordion(item) {
    const isActive = item.classList.contains('active');
    
    // Close all accordion items in the same container
    const container = item.closest('.accordion');
    if (container) {
        container.querySelectorAll('.accordion-item.active').forEach(activeItem => {
            if (activeItem !== item) {
                activeItem.classList.remove('active');
            }
        });
    }
    
    // Toggle current item
    item.classList.toggle('active', !isActive);
}

// Initialize utilities when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CalculatorUtilities.initializeCalculator);
} else {
    CalculatorUtilities.initializeCalculator();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalculatorUtilities, NWCA_CONFIG, SALES_REPS };
}