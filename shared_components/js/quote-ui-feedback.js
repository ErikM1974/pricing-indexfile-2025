/**
 * Quote Builder UI Feedback System
 * Provides loading overlays, toast notifications, and progress indicators
 */

class QuoteUIFeedback {
    constructor(config = {}) {
        this.config = {
            toastDuration: 3000,
            toastPosition: 'bottom-right',
            loadingText: 'Processing...',
            confirmBeforeDelete: true,
            ...config
        };
        
        this.activeToasts = [];
        this.loadingCount = 0;
        this.initializeUI();
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Create loading overlay if it doesn't exist
        if (!document.getElementById('loading-overlay')) {
            this.createLoadingOverlay();
        }
        
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.createToastContainer();
        }
        
        // Create unsaved indicator if it doesn't exist
        if (!document.getElementById('unsaved-indicator')) {
            this.createUnsavedIndicator();
        }
        
        // Set up global functions for backward compatibility
        window.showToast = (message, type) => this.showToast(message, type);
        window.showLoading = (show, text) => show ? this.showLoading(text) : this.hideLoading();
        window.showError = (message) => this.showToast(message, 'error');
        window.showSuccess = (message) => this.showToast(message, 'success');
    }

    /**
     * Create loading overlay element
     */
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${this.config.loadingText}</div>
                <div class="loading-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Create toast notification container
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = `toast-container toast-${this.config.toastPosition}`;
        document.body.appendChild(container);
    }

    /**
     * Create unsaved changes indicator
     */
    createUnsavedIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'unsaved-indicator';
        indicator.className = 'unsaved-indicator';
        indicator.innerHTML = `
            <span class="pulse-dot"></span>
            <span>Unsaved changes</span>
        `;
        document.body.appendChild(indicator);
    }

    /**
     * Show loading overlay
     */
    showLoading(text = null) {
        this.loadingCount++;
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            if (text) {
                const textElement = overlay.querySelector('.loading-text');
                if (textElement) {
                    textElement.textContent = text;
                }
            }
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.loadingCount--;
        if (this.loadingCount <= 0) {
            this.loadingCount = 0;
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
                // Reset progress if shown
                const progressDiv = overlay.querySelector('.loading-progress');
                if (progressDiv) {
                    progressDiv.style.display = 'none';
                }
            }
        }
    }

    /**
     * Show loading with progress
     */
    showLoadingWithProgress(text = null) {
        this.showLoading(text);
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const progressDiv = overlay.querySelector('.loading-progress');
            if (progressDiv) {
                progressDiv.style.display = 'block';
            }
        }
    }

    /**
     * Update loading progress
     */
    updateProgress(percent, text = null) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const progressFill = overlay.querySelector('.progress-fill');
            const progressText = overlay.querySelector('.progress-text');
            
            if (progressFill) {
                progressFill.style.width = `${percent}%`;
            }
            
            if (progressText) {
                progressText.textContent = `${Math.round(percent)}%`;
            }
            
            if (text) {
                const loadingText = overlay.querySelector('.loading-text');
                if (loadingText) {
                    loadingText.textContent = text;
                }
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = null) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Add icon based on type
        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${this.escapeHtml(message)}</span>
                <button class="toast-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        // Add to container
        container.appendChild(toast);
        this.activeToasts.push(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto remove after duration
        const toastDuration = duration || this.config.toastDuration;
        setTimeout(() => {
            this.removeToast(toast);
        }, toastDuration);
        
        return toast;
    }

    /**
     * Remove toast notification
     */
    removeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
            const index = this.activeToasts.indexOf(toast);
            if (index > -1) {
                this.activeToasts.splice(index, 1);
            }
        }, 300);
    }

    /**
     * Get toast icon based on type
     */
    getToastIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Show confirmation dialog
     */
    async showConfirm(message, title = 'Confirm', options = {}) {
        return new Promise((resolve) => {
            // Create modal overlay
            const modal = document.createElement('div');
            modal.className = 'confirm-modal-overlay';
            
            modal.innerHTML = `
                <div class="confirm-modal">
                    <div class="confirm-header">
                        <h3>${this.escapeHtml(title)}</h3>
                    </div>
                    <div class="confirm-body">
                        <p>${this.escapeHtml(message)}</p>
                    </div>
                    <div class="confirm-footer">
                        <button class="btn btn-secondary confirm-cancel">
                            ${options.cancelText || 'Cancel'}
                        </button>
                        <button class="btn btn-primary confirm-ok">
                            ${options.confirmText || 'OK'}
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            const cancelBtn = modal.querySelector('.confirm-cancel');
            const okBtn = modal.querySelector('.confirm-ok');
            
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            okBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            // Close on escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', escapeHandler);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // Add to body
            document.body.appendChild(modal);
            
            // Focus OK button
            okBtn.focus();
        });
    }

    /**
     * Show progress steps indicator
     */
    showProgressSteps(steps, currentStep) {
        let progressContainer = document.getElementById('progress-steps');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'progress-steps';
            progressContainer.className = 'progress-steps';
            
            // Insert at top of main content
            const mainContent = document.querySelector('main, .container, body');
            mainContent.insertBefore(progressContainer, mainContent.firstChild);
        }
        
        // Build steps HTML
        const stepsHTML = steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            
            return `
                <div class="progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                    <div class="step-number">${isCompleted ? '✓' : stepNumber}</div>
                    <div class="step-label">${step}</div>
                </div>
            `;
        }).join('');
        
        progressContainer.innerHTML = stepsHTML;
    }

    /**
     * Show/hide unsaved indicator
     */
    showUnsavedIndicator(show = true) {
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            if (show) {
                indicator.classList.add('show');
            } else {
                indicator.classList.remove('show');
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show inline error message
     */
    showInlineError(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Remove existing error if any
        const existingError = element.parentElement.querySelector('.inline-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Create error element
        const error = document.createElement('div');
        error.className = 'inline-error';
        error.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        // Insert after the element
        element.parentElement.insertBefore(error, element.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (error.parentElement) {
                error.remove();
            }
        }, 5000);
    }

    /**
     * Show inline success message
     */
    showInlineSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Remove existing message if any
        const existingMsg = element.parentElement.querySelector('.inline-success');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        // Create success element
        const success = document.createElement('div');
        success.className = 'inline-success';
        success.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        // Insert after the element
        element.parentElement.insertBefore(success, element.nextSibling);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (success.parentElement) {
                success.remove();
            }
        }, 3000);
    }

    /**
     * Pulse an element to draw attention
     */
    pulseElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.classList.add('pulse-attention');
        setTimeout(() => {
            element.classList.remove('pulse-attention');
        }, 2000);
    }

    /**
     * Clear all active UI feedback
     */
    clearAllFeedback() {
        // Clear toasts
        this.activeToasts.forEach(toast => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        });
        this.activeToasts = [];
        
        // Hide loading
        this.loadingCount = 0;
        this.hideLoading();
        
        // Hide unsaved indicator
        this.showUnsavedIndicator(false);
        
        // Clear inline messages
        document.querySelectorAll('.inline-error, .inline-success').forEach(msg => {
            msg.remove();
        });
    }
}

// Export for use in quote builders
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteUIFeedback;
}