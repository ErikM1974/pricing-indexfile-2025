/**
 * Quote Builder Validation System
 * Provides real-time input validation, formatting, and user feedback
 */

class QuoteValidation {
    constructor(config = {}) {
        this.config = {
            phoneFormat: 'US', // US format: (xxx) xxx-xxxx
            emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            requiredFields: config.requiredFields || ['customer-name', 'customer-email', 'sales-rep'],
            autoFormat: true,
            realTimeValidation: true,
            ...config
        };
        
        this.isDirty = false;
        this.validationErrors = new Map();
        this.initializeValidation();
    }

    /**
     * Initialize validation listeners
     */
    initializeValidation() {
        // Phone number formatting
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput && this.config.autoFormat) {
            phoneInput.addEventListener('input', (e) => this.formatPhone(e));
            phoneInput.addEventListener('blur', (e) => this.validatePhone(e));
        }

        // Email validation
        const emailInput = document.getElementById('customer-email');
        if (emailInput && this.config.realTimeValidation) {
            emailInput.addEventListener('input', (e) => this.validateEmailRealTime(e));
            emailInput.addEventListener('blur', (e) => this.validateEmail(e));
        }

        // Required fields validation
        this.config.requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', (e) => this.validateRequired(e));
                field.addEventListener('input', () => {
                    this.isDirty = true;
                    this.showUnsavedIndicator();
                });
            }
        });

        // Track all input changes for dirty state
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('change', () => {
                this.isDirty = true;
                this.showUnsavedIndicator();
            });
        });

        // Warn before leaving with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    /**
     * Format phone number as user types
     */
    formatPhone(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        // Limit to 10 digits
        value = value.substring(0, 10);
        
        // Format based on length
        if (value.length >= 6) {
            value = `(${value.slice(0,3)}) ${value.slice(3,6)}-${value.slice(6)}`;
        } else if (value.length >= 3) {
            value = `(${value.slice(0,3)}) ${value.slice(3)}`;
        }
        
        input.value = value;
        
        // Update cursor position for better UX
        const cursorPosition = input.selectionStart;
        setTimeout(() => {
            input.setSelectionRange(cursorPosition, cursorPosition);
        }, 0);
    }

    /**
     * Validate phone number format
     */
    validatePhone(event) {
        const input = event.target;
        const value = input.value.replace(/\D/g, '');
        
        if (value.length === 0) {
            // Phone is optional, so empty is valid
            this.setFieldValid(input);
            return true;
        }
        
        if (value.length === 10) {
            this.setFieldValid(input);
            this.validationErrors.delete('customer-phone');
            return true;
        } else {
            this.setFieldInvalid(input, 'Phone number must be 10 digits');
            this.validationErrors.set('customer-phone', 'Invalid phone number');
            return false;
        }
    }

    /**
     * Real-time email validation with debouncing
     */
    validateEmailRealTime(event) {
        const input = event.target;
        clearTimeout(this.emailTimeout);
        
        this.emailTimeout = setTimeout(() => {
            this.validateEmail({ target: input });
        }, 500); // Debounce for 500ms
    }

    /**
     * Validate email format
     */
    validateEmail(event) {
        const input = event.target;
        const value = input.value.trim();
        
        if (value.length === 0 && this.config.requiredFields.includes('customer-email')) {
            this.setFieldInvalid(input, 'Email is required');
            this.validationErrors.set('customer-email', 'Email is required');
            return false;
        }
        
        if (value.length > 0 && !this.config.emailRegex.test(value)) {
            this.setFieldInvalid(input, 'Please enter a valid email address');
            this.validationErrors.set('customer-email', 'Invalid email format');
            return false;
        }
        
        this.setFieldValid(input);
        this.validationErrors.delete('customer-email');
        return true;
    }

    /**
     * Validate required fields
     */
    validateRequired(event) {
        const input = event.target;
        const value = input.value.trim();
        
        if (value.length === 0) {
            const fieldName = input.getAttribute('placeholder') || input.id.replace(/-/g, ' ');
            this.setFieldInvalid(input, `${this.titleCase(fieldName)} is required`);
            this.validationErrors.set(input.id, `${fieldName} is required`);
            return false;
        }
        
        this.setFieldValid(input);
        this.validationErrors.delete(input.id);
        return true;
    }

    /**
     * Set field as valid with visual feedback
     */
    setFieldValid(input) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        
        // Remove error message if exists
        const errorDiv = input.parentElement.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        // Add checkmark icon
        this.addValidationIcon(input, 'valid');
    }

    /**
     * Set field as invalid with visual feedback
     */
    setFieldInvalid(input, message) {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        
        // Show or create error message
        let errorDiv = input.parentElement.querySelector('.invalid-feedback');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            input.parentElement.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Add error icon
        this.addValidationIcon(input, 'invalid');
    }

    /**
     * Add validation icon to input
     */
    addValidationIcon(input, state) {
        // Remove existing icon if any
        const existingIcon = input.parentElement.querySelector('.validation-icon');
        if (existingIcon) {
            existingIcon.remove();
        }
        
        // Add new icon
        const icon = document.createElement('span');
        icon.className = `validation-icon validation-icon-${state}`;
        icon.innerHTML = state === 'valid' 
            ? '<i class="fas fa-check-circle"></i>' 
            : '<i class="fas fa-exclamation-circle"></i>';
        
        // Position icon
        icon.style.position = 'absolute';
        icon.style.right = '10px';
        icon.style.top = '50%';
        icon.style.transform = 'translateY(-50%)';
        icon.style.color = state === 'valid' ? '#28a745' : '#dc3545';
        icon.style.pointerEvents = 'none';
        
        // Make parent relative if not already
        if (input.parentElement.style.position !== 'relative') {
            input.parentElement.style.position = 'relative';
        }
        
        input.parentElement.appendChild(icon);
    }

    /**
     * Show unsaved changes indicator
     */
    showUnsavedIndicator() {
        let indicator = document.getElementById('unsaved-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'unsaved-indicator';
            indicator.className = 'unsaved-indicator';
            indicator.innerHTML = '<i class="fas fa-circle"></i> Unsaved changes';
            document.body.appendChild(indicator);
        }
        indicator.classList.add('show');
    }

    /**
     * Hide unsaved changes indicator
     */
    hideUnsavedIndicator() {
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.classList.remove('show');
        }
        this.isDirty = false;
    }

    /**
     * Validate entire form
     */
    validateForm() {
        let isValid = true;
        this.validationErrors.clear();
        
        // Validate required fields
        this.config.requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                const event = { target: field };
                
                if (fieldId === 'customer-email') {
                    if (!this.validateEmail(event)) isValid = false;
                } else if (fieldId === 'customer-phone') {
                    if (!this.validatePhone(event)) isValid = false;
                } else {
                    if (!this.validateRequired(event)) isValid = false;
                }
            }
        });
        
        // Show summary of errors if invalid
        if (!isValid) {
            this.showValidationSummary();
        }
        
        return isValid;
    }

    /**
     * Show validation error summary
     */
    showValidationSummary() {
        const errors = Array.from(this.validationErrors.values());
        const message = 'Please fix the following errors:\n' + errors.join('\n');
        
        // Use toast notification if available
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * Format currency values
     */
    formatCurrency(value) {
        const num = parseFloat(value) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    /**
     * Sanitize input to prevent XSS
     */
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Title case helper
     */
    titleCase(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Reset form and validation state
     */
    resetForm() {
        // Clear all validation states
        document.querySelectorAll('.is-valid, .is-invalid').forEach(element => {
            element.classList.remove('is-valid', 'is-invalid');
        });
        
        // Remove validation icons
        document.querySelectorAll('.validation-icon').forEach(icon => {
            icon.remove();
        });
        
        // Hide error messages
        document.querySelectorAll('.invalid-feedback').forEach(error => {
            error.style.display = 'none';
        });
        
        // Clear validation errors
        this.validationErrors.clear();
        
        // Reset dirty state
        this.hideUnsavedIndicator();
    }

    /**
     * Get form data with sanitization
     */
    getFormData() {
        const data = {};
        
        // Get all form inputs
        document.querySelectorAll('input, select, textarea').forEach(element => {
            if (element.id && element.value) {
                // Sanitize text inputs
                if (element.type === 'text' || element.type === 'email' || element.tagName === 'TEXTAREA') {
                    data[element.id] = this.sanitizeInput(element.value.trim());
                } else {
                    data[element.id] = element.value;
                }
            }
        });
        
        return data;
    }
}

// Export for use in quote builders
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteValidation;
}