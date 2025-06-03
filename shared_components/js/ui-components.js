/**
 * NWCA UI Components
 * Reusable UI components for loading states, error handling, and user feedback
 * Part of the NWCA namespace
 * 
 * @namespace NWCA.ui
 * @version 1.0.0
 */

(function(NWCA) {
    'use strict';

    // Ensure NWCA namespace exists
    if (!window.NWCA) {
        console.error('[UI-COMPONENTS] NWCA namespace not found. Please include nwca-namespace.js first.');
        return;
    }

    // Ensure ui namespace exists
    NWCA.ui = NWCA.ui || {};

    /**
     * Loading Overlay Component
     * Shows a loading indicator over any container element
     */
    NWCA.ui.LoadingOverlay = {
        overlays: new Map(), // Track overlays by container

        /**
         * Show loading overlay on a container
         * @param {HTMLElement|string} container - Container element or selector
         * @param {string} message - Loading message to display
         * @param {Object} options - Additional options
         * @returns {HTMLElement} The overlay element
         */
        show(container, message = '', options = {}) {
            const containerEl = typeof container === 'string' ? 
                document.querySelector(container) : container;
            
            if (!containerEl) {
                NWCA.utils.logger.error('UI-LOADING', 'Container not found:', container);
                return null;
            }

            // Remove existing overlay if present
            this.hide(containerEl);

            // Set container position if needed
            const position = window.getComputedStyle(containerEl).position;
            if (position === 'static') {
                containerEl.style.position = 'relative';
            }

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'nwca-loading-overlay';
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-live', 'polite');
            
            // Use message from constants or custom
            const displayMessage = message || NWCA.CONSTANTS?.MESSAGES?.LOADING || 'Loading...';
            
            overlay.innerHTML = `
                <div class="nwca-loading-content">
                    <div class="nwca-loading-spinner" aria-hidden="true">
                        <div class="spinner-ring"></div>
                    </div>
                    <p class="nwca-loading-message">${displayMessage}</p>
                </div>
            `;

            // Apply options
            if (options.blur) {
                overlay.classList.add('with-blur');
            }

            // Add to container
            containerEl.appendChild(overlay);
            this.overlays.set(containerEl, overlay);

            // Auto-hide after timeout if specified
            if (options.timeout) {
                setTimeout(() => this.hide(containerEl), options.timeout);
            }

            NWCA.utils.logger.log('UI-LOADING', 'Loading overlay shown:', displayMessage);
            return overlay;
        },

        /**
         * Hide loading overlay
         * @param {HTMLElement|string} container - Container element or selector
         */
        hide(container) {
            const containerEl = typeof container === 'string' ? 
                document.querySelector(container) : container;
            
            if (!containerEl) return;

            const overlay = this.overlays.get(containerEl);
            if (overlay) {
                overlay.remove();
                this.overlays.delete(containerEl);
                NWCA.utils.logger.log('UI-LOADING', 'Loading overlay hidden');
            }
        },

        /**
         * Hide all loading overlays
         */
        hideAll() {
            this.overlays.forEach((overlay, container) => {
                overlay.remove();
            });
            this.overlays.clear();
        }
    };

    /**
     * Error Display Component
     * Shows user-friendly error messages
     */
    NWCA.ui.ErrorDisplay = {
        /**
         * Show error message
         * @param {string} message - Error message
         * @param {Object} options - Display options
         */
        show(message, options = {}) {
            const displayMessage = message || NWCA.CONSTANTS?.MESSAGES?.ERROR_GENERIC || 'An error occurred';
            
            // Remove existing error if replacing
            if (options.container) {
                this.clearContainer(options.container);
            }

            const errorEl = document.createElement('div');
            errorEl.className = 'nwca-error-message';
            errorEl.setAttribute('role', 'alert');
            errorEl.setAttribute('aria-live', 'assertive');
            
            errorEl.innerHTML = `
                <div class="nwca-error-content">
                    <span class="nwca-error-icon" aria-hidden="true">⚠️</span>
                    <p class="nwca-error-text">${displayMessage}</p>
                    ${options.dismissible !== false ? '<button class="nwca-error-dismiss" aria-label="Dismiss error">×</button>' : ''}
                </div>
            `;

            // Add dismiss handler
            if (options.dismissible !== false) {
                errorEl.querySelector('.nwca-error-dismiss').addEventListener('click', () => {
                    errorEl.remove();
                });
            }

            // Add to container or body
            if (options.container) {
                const containerEl = typeof options.container === 'string' ? 
                    document.querySelector(options.container) : options.container;
                if (containerEl) {
                    containerEl.appendChild(errorEl);
                }
            } else {
                // Create floating error
                errorEl.classList.add('nwca-error-floating');
                document.body.appendChild(errorEl);
            }

            // Auto-hide after duration
            const duration = options.duration || NWCA.CONSTANTS?.UI?.ERROR_MESSAGE_DURATION || 5000;
            if (duration > 0) {
                setTimeout(() => errorEl.remove(), duration);
            }

            NWCA.utils.logger.error('UI-ERROR', 'Error displayed:', displayMessage);
            return errorEl;
        },

        /**
         * Clear errors from container
         * @param {HTMLElement|string} container - Container element or selector
         */
        clearContainer(container) {
            const containerEl = typeof container === 'string' ? 
                document.querySelector(container) : container;
            
            if (containerEl) {
                containerEl.querySelectorAll('.nwca-error-message').forEach(el => el.remove());
            }
        }
    };

    /**
     * Success Message Component
     * Shows success feedback to users
     */
    NWCA.ui.SuccessMessage = {
        /**
         * Show success message
         * @param {string} message - Success message
         * @param {Object} options - Display options
         */
        show(message, options = {}) {
            const successEl = document.createElement('div');
            successEl.className = 'nwca-success-message';
            successEl.setAttribute('role', 'status');
            successEl.setAttribute('aria-live', 'polite');
            
            successEl.innerHTML = `
                <div class="nwca-success-content">
                    <span class="nwca-success-icon" aria-hidden="true">✓</span>
                    <p class="nwca-success-text">${message}</p>
                </div>
            `;

            // Position based on options
            if (options.position === 'top') {
                successEl.classList.add('nwca-success-top');
            } else if (options.container) {
                const containerEl = typeof options.container === 'string' ? 
                    document.querySelector(options.container) : options.container;
                if (containerEl) {
                    containerEl.appendChild(successEl);
                }
            } else {
                successEl.classList.add('nwca-success-floating');
                document.body.appendChild(successEl);
            }

            // Animate in
            requestAnimationFrame(() => {
                successEl.classList.add('nwca-success-show');
            });

            // Auto-hide
            const duration = options.duration || NWCA.CONSTANTS?.UI?.SUCCESS_MESSAGE_DURATION || 3000;
            setTimeout(() => {
                successEl.classList.remove('nwca-success-show');
                setTimeout(() => successEl.remove(), 300);
            }, duration);

            NWCA.utils.logger.log('UI-SUCCESS', 'Success message shown:', message);
            return successEl;
        }
    };

    /**
     * Error Boundary Utility
     * Wraps async operations with error handling
     */
    NWCA.ui.errorBoundary = async function(operation, options = {}) {
        const { 
            loadingContainer, 
            loadingMessage,
            errorContainer,
            errorMessage,
            onError,
            showLoading = true 
        } = options;

        try {
            // Show loading if specified
            if (showLoading && loadingContainer) {
                NWCA.ui.LoadingOverlay.show(loadingContainer, loadingMessage);
            }

            // Execute operation
            const result = await operation();

            // Hide loading
            if (showLoading && loadingContainer) {
                NWCA.ui.LoadingOverlay.hide(loadingContainer);
            }

            return result;

        } catch (error) {
            NWCA.utils.logger.error('ERROR-BOUNDARY', 'Operation failed:', error);

            // Hide loading
            if (showLoading && loadingContainer) {
                NWCA.ui.LoadingOverlay.hide(loadingContainer);
            }

            // Show error
            const message = errorMessage || error.message || NWCA.CONSTANTS?.MESSAGES?.ERROR_GENERIC;
            NWCA.ui.ErrorDisplay.show(message, { container: errorContainer });

            // Call custom error handler
            if (onError) {
                onError(error);
            }

            throw error;
        }
    };

    /**
     * Form Validation Feedback
     * Shows validation errors on form fields
     */
    NWCA.ui.ValidationFeedback = {
        /**
         * Show field error
         * @param {HTMLElement|string} field - Field element or selector
         * @param {string} message - Error message
         */
        showFieldError(field, message) {
            const fieldEl = typeof field === 'string' ? 
                document.querySelector(field) : field;
            
            if (!fieldEl) return;

            // Add error class
            fieldEl.classList.add(NWCA.CONSTANTS?.CLASSES?.ERROR || 'has-error');
            fieldEl.setAttribute('aria-invalid', 'true');

            // Find or create error message element
            const errorId = fieldEl.id + '-error';
            let errorEl = document.getElementById(errorId);
            
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.id = errorId;
                errorEl.className = 'nwca-field-error';
                errorEl.setAttribute('role', 'alert');
                fieldEl.parentNode.insertBefore(errorEl, fieldEl.nextSibling);
            }

            errorEl.textContent = message;
            fieldEl.setAttribute('aria-describedby', errorId);
        },

        /**
         * Clear field error
         * @param {HTMLElement|string} field - Field element or selector
         */
        clearFieldError(field) {
            const fieldEl = typeof field === 'string' ? 
                document.querySelector(field) : field;
            
            if (!fieldEl) return;

            fieldEl.classList.remove(NWCA.CONSTANTS?.CLASSES?.ERROR || 'has-error');
            fieldEl.removeAttribute('aria-invalid');
            fieldEl.removeAttribute('aria-describedby');

            const errorEl = document.getElementById(fieldEl.id + '-error');
            if (errorEl) {
                errorEl.remove();
            }
        },

        /**
         * Clear all errors in a form
         * @param {HTMLElement|string} form - Form element or selector
         */
        clearFormErrors(form) {
            const formEl = typeof form === 'string' ? 
                document.querySelector(form) : form;
            
            if (!formEl) return;

            formEl.querySelectorAll('.has-error, [aria-invalid="true"]').forEach(field => {
                this.clearFieldError(field);
            });
        }
    };

    // Log successful load
    console.log('[UI-COMPONENTS] NWCA UI components loaded');

})(window.NWCA);