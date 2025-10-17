/**
 * Quote Builder Base Class
 * Provides essential safety features for all NWCA quote builders
 * Features: Auto-save, error handling, validation, user feedback
 */

class QuoteBuilderBase {
    constructor(config) {
        this.config = {
            prefix: config.prefix || 'QUOTE',
            autoSaveInterval: 30000, // 30 seconds
            ...config
        };
        this.products = [];
        this.isDirty = false;
        this.lastSave = null;
        this.initializeAutoSave();
        this.initializeErrorHandling();
        this.initializeBeforeUnload();
    }

    // ============================================
    // ERROR HANDLING & SAFETY
    // ============================================
    
    /**
     * Wrapper for all async operations with error handling
     */
    async safeExecute(fn, errorMessage = 'An error occurred') {
        try {
            this.showLoading(true);
            const result = await fn();
            this.showLoading(false);
            return result;
        } catch (error) {
            console.error(errorMessage, error);
            this.showError(errorMessage + '. Please try again or contact support.');
            this.showLoading(false);
            
            // Save to localStorage as backup
            this.saveToStorage();
            
            return null;
        }
    }

    /**
     * Global error handler initialization
     */
    initializeErrorHandling() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Your work has been saved locally.');
            this.saveToStorage();
            event.preventDefault();
        });

        // Catch general JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.showError('A technical error occurred. Your work has been saved locally.');
            this.saveToStorage();
        });
    }

    // ============================================
    // AUTO-SAVE FUNCTIONALITY
    // ============================================
    
    /**
     * Initialize auto-save system
     */
    initializeAutoSave() {
        // Load from localStorage on init
        this.loadFromStorage();
        
        // Save periodically
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty) {
                this.saveToStorage();
            }
        }, this.config.autoSaveInterval);

        // Show unsaved indicator
        this.updateUnsavedIndicator();
    }

    /**
     * Save current state to localStorage
     */
    saveToStorage() {
        try {
            const data = {
                products: this.products,
                customerInfo: this.getCustomerInfo(),
                timestamp: Date.now(),
                version: '1.0'
            };
            
            const key = `${this.config.prefix}_draft`;
            localStorage.setItem(key, JSON.stringify(data));
            
            this.isDirty = false;
            this.lastSave = Date.now();
            this.updateUnsavedIndicator();
            
            // Don't show toast for auto-saves, only manual saves
            if (!this.silentSave) {
                this.showToast('Draft saved automatically', 'success', 2000);
            }
            
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            
            // Check if quota exceeded
            if (e.name === 'QuotaExceededError') {
                this.showError('Storage full. Please clear some browser data.');
                this.clearOldDrafts();
            }
            
            return false;
        }
    }

    /**
     * Load saved state from localStorage
     */
    loadFromStorage() {
        try {
            const key = `${this.config.prefix}_draft`;
            const saved = localStorage.getItem(key);

            if (!saved) return false;

            const data = JSON.parse(saved);

            // Check if data is less than 24 hours old
            const ageInHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);

            if (ageInHours < 24) {
                // Check if user has disabled restore prompts
                const disablePrompts = localStorage.getItem('qb_disable_restore_prompts');

                if (disablePrompts === 'true') {
                    // Silently restore without prompt
                    this.restoreDraft(data);
                    this.showToast('Previous draft restored', 'info', 2000);
                    return true;
                }

                // Show custom modal with "Don't ask again" option
                this.showRestoreModal(data, key);
                return false; // Will be handled by modal callbacks
            } else {
                // Clear old drafts
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Failed to restore from localStorage:', e);
            // Clear corrupted data
            localStorage.removeItem(`${this.config.prefix}_draft`);
        }

        return false;
    }

    /**
     * Restore draft data to form
     */
    restoreDraft(data) {
        // Restore customer info
        if (data.customerInfo) {
            const fields = ['customer-name', 'customer-email', 'customer-phone',
                          'company-name', 'project-name', 'sales-rep'];

            fields.forEach(field => {
                const element = document.getElementById(field);
                if (element && data.customerInfo[field]) {
                    element.value = data.customerInfo[field];
                }
            });
        }

        // Restore products (implement in child classes)
        if (data.products && data.products.length > 0) {
            this.products = data.products;
            if (typeof this.renderProducts === 'function') {
                this.renderProducts();
            }
        }
    }

    /**
     * Show restore draft modal with "Don't ask again" option
     */
    showRestoreModal(data, draftKey) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'qb-restore-modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'restore-modal-title');
        modal.setAttribute('aria-modal', 'true');

        const formattedDate = new Date(data.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        modal.innerHTML = `
            <div class="qb-restore-modal">
                <div class="qb-restore-modal-header">
                    <i class="fas fa-save" style="font-size: 32px; color: #3a7c52; margin-bottom: 12px;"></i>
                    <h3 id="restore-modal-title">Unsaved Quote Found</h3>
                </div>

                <div class="qb-restore-modal-body">
                    <p>Found an unsaved quote from <strong>${formattedDate}</strong>.</p>
                    <p>Would you like to restore it and continue where you left off?</p>

                    <label class="qb-restore-modal-checkbox">
                        <input type="checkbox" id="qb-dont-ask-again">
                        <span>Don't ask again (always restore automatically)</span>
                    </label>
                </div>

                <div class="qb-restore-modal-footer">
                    <button class="qb-btn-secondary" id="qb-discard-draft">
                        <i class="fas fa-times"></i> Start Fresh
                    </button>
                    <button class="qb-btn-primary" id="qb-restore-draft">
                        <i class="fas fa-check"></i> Restore Quote
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus trap and accessibility
        const focusableElements = modal.querySelectorAll('button, input[type="checkbox"]');
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Focus first button
        setTimeout(() => document.getElementById('qb-restore-draft').focus(), 100);

        // Trap focus within modal
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }

            // ESC key closes modal (same as discard)
            if (e.key === 'Escape') {
                handleDiscard();
            }
        });

        // Handle restore button
        const handleRestore = () => {
            const dontAskAgain = document.getElementById('qb-dont-ask-again').checked;

            if (dontAskAgain) {
                localStorage.setItem('qb_disable_restore_prompts', 'true');
                this.showToast('Auto-restore enabled. Future drafts will load automatically.', 'success', 4000);
            }

            modal.remove();
            this.restoreDraft(data);
            this.showToast('Previous draft restored', 'info', 3000);
        };

        // Handle discard button
        const handleDiscard = () => {
            localStorage.removeItem(draftKey);
            modal.remove();
            this.showToast('Starting with a fresh quote', 'info', 2000);
        };

        // Attach event listeners
        document.getElementById('qb-restore-draft').onclick = handleRestore;
        document.getElementById('qb-discard-draft').onclick = handleDiscard;

        // Click outside to dismiss (same as discard)
        modal.onclick = (e) => {
            if (e.target === modal) {
                handleDiscard();
            }
        };
    }

    /**
     * Get customer info from form
     */
    getCustomerInfo() {
        return {
            'customer-name': document.getElementById('customer-name')?.value || '',
            'customer-email': document.getElementById('customer-email')?.value || '',
            'customer-phone': document.getElementById('customer-phone')?.value || '',
            'company-name': document.getElementById('company-name')?.value || '',
            'project-name': document.getElementById('project-name')?.value || '',
            'sales-rep': document.getElementById('sales-rep')?.value || ''
        };
    }

    /**
     * Mark form as dirty (has unsaved changes)
     */
    markDirty() {
        this.isDirty = true;
        this.updateUnsavedIndicator();
    }

    /**
     * Mark form as clean (all changes saved)
     */
    markClean() {
        this.isDirty = false;
        this.updateUnsavedIndicator();
    }

    /**
     * Update unsaved changes indicator
     */
    updateUnsavedIndicator() {
        // Don't show indicator if there's nothing to save yet
        if (!this.isDirty && this.products.length === 0) {
            return;
        }

        let indicator = document.getElementById('unsaved-indicator');

        if (!indicator) {
            // Create indicator if doesn't exist
            indicator = document.createElement('div');
            indicator.id = 'unsaved-indicator';
            indicator.className = 'unsaved-indicator';
            indicator.innerHTML = '<span>Unsaved changes</span>';
            document.body.appendChild(indicator);
        }

        if (this.isDirty) {
            indicator.classList.add('show');
        } else {
            indicator.classList.remove('show');
        }
    }

    /**
     * Clear old drafts from localStorage
     */
    clearOldDrafts() {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        
        keys.forEach(key => {
            if (key.includes('_draft')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    const ageInDays = (now - data.timestamp) / (1000 * 60 * 60 * 24);
                    
                    if (ageInDays > 7) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Remove corrupted data
                    localStorage.removeItem(key);
                }
            }
        });
    }

    // ============================================
    // UNSAVED CHANGES WARNING
    // ============================================
    
    /**
     * Warn user before leaving with unsaved changes
     */
    initializeBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                const message = 'You have unsaved changes. Are you sure you want to leave?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });
    }

    // ============================================
    // UI FEEDBACK METHODS
    // ============================================
    
    /**
     * Show/hide loading overlay
     */
    showLoading(show, message = 'Processing...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            // Create loading overlay if doesn't exist
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        // Update message
        const textElement = overlay.querySelector('.loading-text');
        if (textElement) {
            textElement.textContent = message;
        }
        
        overlay.style.display = show ? 'flex' : 'none';
        
        // Announce to screen readers
        if (show) {
            this.announceToScreenReader(`Loading: ${message}`);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showToast(message, 'error', 5000);
        this.announceToScreenReader(`Error: ${message}`);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showToast(message, 'success', 3000);
        this.announceToScreenReader(`Success: ${message}`);
    }

    /**
     * Show info message
     */
    showInfo(message) {
        this.showToast(message, 'info', 3000);
    }

    /**
     * Show warning message
     */
    showWarning(message) {
        this.showToast(message, 'warning', 4000);
        this.announceToScreenReader(`Warning: ${message}`);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        // Create or get toast container
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Add icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Announce to screen readers
     */
    announceToScreenReader(message) {
        let announcer = document.getElementById('screen-reader-announcements');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'screen-reader-announcements';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            document.body.appendChild(announcer);
        }
        
        announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }

    // ============================================
    // VALIDATION METHODS
    // ============================================
    
    /**
     * Validate email format
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate phone number (10 digits)
     */
    validatePhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10;
    }

    /**
     * Format phone number
     */
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.substr(0,3)}) ${cleaned.substr(3,3)}-${cleaned.substr(6)}`;
        }
        return phone;
    }

    /**
     * Validate entire form
     */
    validateForm() {
        const errors = [];
        let firstErrorField = null;
        
        // Check customer name
        const nameField = document.getElementById('customer-name');
        if (!nameField?.value?.trim()) {
            errors.push('Customer name is required');
            this.markFieldInvalid(nameField, 'Customer name is required');
            if (!firstErrorField) firstErrorField = nameField;
        } else {
            this.markFieldValid(nameField);
        }
        
        // Check email
        const emailField = document.getElementById('customer-email');
        if (emailField?.value && !this.validateEmail(emailField.value)) {
            errors.push('Please enter a valid email address');
            this.markFieldInvalid(emailField, 'Please enter a valid email address');
            if (!firstErrorField) firstErrorField = emailField;
        } else if (emailField?.value) {
            this.markFieldValid(emailField);
        }
        
        // Check phone
        const phoneField = document.getElementById('customer-phone');
        if (phoneField?.value && !this.validatePhone(phoneField.value)) {
            errors.push('Phone number must be 10 digits');
            this.markFieldInvalid(phoneField, 'Phone number must be 10 digits');
            if (!firstErrorField) firstErrorField = phoneField;
        } else if (phoneField?.value) {
            this.markFieldValid(phoneField);
        }
        
        // Check products
        if (this.products.length === 0) {
            errors.push('At least one product is required');
        }
        
        // Show errors and focus first error field
        if (errors.length > 0) {
            this.showError(errors[0]); // Show first error
            if (firstErrorField) {
                firstErrorField.focus();
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }
        
        return true;
    }

    /**
     * Mark field as invalid
     */
    markFieldInvalid(field, message) {
        if (!field) return;
        
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        
        // Update or create error message
        let feedback = field.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentNode.insertBefore(feedback, field.nextSibling);
        }
        feedback.textContent = message;
    }

    /**
     * Mark field as valid
     */
    markFieldValid(field) {
        if (!field) return;
        
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        
        // Remove error message
        const feedback = field.nextElementSibling;
        if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.remove();
        }
    }

    /**
     * Clear all validation states
     */
    clearValidation() {
        document.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        document.querySelectorAll('.is-valid').forEach(el => {
            el.classList.remove('is-valid');
        });
        document.querySelectorAll('.invalid-feedback').forEach(el => {
            el.remove();
        });
    }

    // ============================================
    // SECURITY & SANITIZATION
    // ============================================
    
    /**
     * Sanitize user input to prevent XSS
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Safe DOM manipulation - always use textContent
     */
    setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text; // Never use innerHTML with user input
        }
    }

    /**
     * Safe HTML insertion (for trusted content only)
     */
    setElementHTML(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            // Sanitize first if contains user input
            element.innerHTML = DOMPurify ? DOMPurify.sanitize(html) : html;
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================
    
    /**
     * Debounce function for input events
     */
    debounce(func, wait) {
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
     * Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    /**
     * Parse currency string to number
     */
    parseCurrency(str) {
        return parseFloat(str.replace(/[^0-9.-]+/g, ''));
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Check if mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // Save final state
        if (this.isDirty) {
            this.saveToStorage();
        }
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteBuilderBase;
}