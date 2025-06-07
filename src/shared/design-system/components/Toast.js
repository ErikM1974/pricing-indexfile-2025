// Toast Notification Component
// Phase 6: UI Redesign - Non-intrusive notifications

import { tokens } from '../tokens/index.js';

/**
 * Toast notification component
 * @class
 */
export class Toast {
  constructor(options = {}) {
    this.options = {
      message: '',
      type: 'info', // info | success | warning | error
      duration: 5000, // auto-dismiss after milliseconds (0 = no auto-dismiss)
      position: 'bottom-right', // top-left | top-center | top-right | bottom-left | bottom-center | bottom-right
      dismissible: true,
      action: null, // { text: string, onClick: function }
      icon: true,
      className: '',
      ...options
    };
    
    this.element = null;
    this.timeout = null;
    this.create();
  }
  
  /**
   * Create toast element
   * @private
   */
  create() {
    this.element = document.createElement('div');
    this.element.className = [
      'toast',
      `toast-${this.options.type}`,
      this.options.className
    ].filter(Boolean).join(' ');
    
    this.element.setAttribute('role', 'alert');
    this.element.setAttribute('aria-live', 'polite');
    
    // Toast content wrapper
    const content = document.createElement('div');
    content.className = 'toast-content';
    
    // Icon
    if (this.options.icon) {
      const icon = document.createElement('span');
      icon.className = 'toast-icon';
      icon.innerHTML = this.getIcon();
      content.appendChild(icon);
    }
    
    // Message
    const message = document.createElement('div');
    message.className = 'toast-message';
    message.textContent = this.options.message;
    content.appendChild(message);
    
    this.element.appendChild(content);
    
    // Actions container
    const actions = document.createElement('div');
    actions.className = 'toast-actions';
    
    // Action button
    if (this.options.action) {
      const actionButton = document.createElement('button');
      actionButton.className = 'toast-action';
      actionButton.type = 'button';
      actionButton.textContent = this.options.action.text;
      actionButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.action.onClick();
        this.dismiss();
      });
      actions.appendChild(actionButton);
    }
    
    // Dismiss button
    if (this.options.dismissible) {
      const dismissButton = document.createElement('button');
      dismissButton.className = 'toast-dismiss';
      dismissButton.type = 'button';
      dismissButton.setAttribute('aria-label', 'Dismiss notification');
      dismissButton.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      `;
      dismissButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss();
      });
      actions.appendChild(dismissButton);
    }
    
    if (actions.children.length > 0) {
      this.element.appendChild(actions);
    }
    
    // Click to dismiss
    if (this.options.dismissible) {
      this.element.addEventListener('click', () => this.dismiss());
    }
    
    // Mouse events for auto-dismiss
    if (this.options.duration > 0) {
      this.element.addEventListener('mouseenter', () => this.pauseAutoDismiss());
      this.element.addEventListener('mouseleave', () => this.resumeAutoDismiss());
    }
  }
  
  /**
   * Get icon for toast type
   * @private
   */
  getIcon() {
    const icons = {
      info: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`,
      success: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>`,
      warning: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>`,
      error: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>`
    };
    
    return icons[this.options.type] || icons.info;
  }
  
  /**
   * Show the toast
   */
  show() {
    // Get or create container
    const container = ToastContainer.getInstance(this.options.position);
    container.addToast(this);
    
    // Trigger reflow for animation
    requestAnimationFrame(() => {
      this.element.classList.add('toast-visible');
    });
    
    // Start auto-dismiss
    if (this.options.duration > 0) {
      this.startAutoDismiss();
    }
  }
  
  /**
   * Dismiss the toast
   */
  async dismiss() {
    if (!this.element) return;
    
    // Clear timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    // Hide with animation
    this.element.classList.remove('toast-visible');
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Remove from DOM
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
    
    // Check if container is empty
    const container = this.element?.parentNode;
    if (container && container.children.length === 0) {
      container.remove();
    }
    
    this.element = null;
  }
  
  /**
   * Start auto-dismiss timer
   * @private
   */
  startAutoDismiss() {
    if (this.timeout) clearTimeout(this.timeout);
    
    this.remainingTime = this.options.duration;
    this.startTime = Date.now();
    
    this.timeout = setTimeout(() => {
      this.dismiss();
    }, this.options.duration);
  }
  
  /**
   * Pause auto-dismiss
   * @private
   */
  pauseAutoDismiss() {
    if (!this.timeout) return;
    
    clearTimeout(this.timeout);
    this.remainingTime -= Date.now() - this.startTime;
  }
  
  /**
   * Resume auto-dismiss
   * @private
   */
  resumeAutoDismiss() {
    if (!this.remainingTime || this.remainingTime <= 0) return;
    
    this.startTime = Date.now();
    this.timeout = setTimeout(() => {
      this.dismiss();
    }, this.remainingTime);
  }
  
  /**
   * Get the DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

/**
 * Toast container manager
 * @class
 */
export class ToastContainer {
  static instances = new Map();
  
  constructor(position) {
    this.position = position;
    this.element = this.createElement();
  }
  
  /**
   * Create container element
   * @private
   */
  createElement() {
    const container = document.createElement('div');
    container.className = `toast-container toast-container-${this.position}`;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
    return container;
  }
  
  /**
   * Add toast to container
   * @param {Toast} toast - Toast instance
   */
  addToast(toast) {
    // Add to beginning for top positions, end for bottom positions
    if (this.position.includes('top')) {
      this.element.insertBefore(toast.getElement(), this.element.firstChild);
    } else {
      this.element.appendChild(toast.getElement());
    }
  }
  
  /**
   * Get or create container instance
   * @param {string} position - Container position
   * @returns {ToastContainer}
   */
  static getInstance(position) {
    if (!this.instances.has(position)) {
      this.instances.set(position, new ToastContainer(position));
    }
    return this.instances.get(position);
  }
}

/**
 * Show toast notification
 * @param {string|Object} message - Message or options
 * @param {Object} options - Additional options if message is string
 * @returns {Toast} Toast instance
 */
export function showToast(message, options = {}) {
  let toastOptions;
  
  if (typeof message === 'string') {
    toastOptions = { message, ...options };
  } else {
    toastOptions = message;
  }
  
  const toast = new Toast(toastOptions);
  toast.show();
  return toast;
}

/**
 * Initialize toast system
 */
export function initializeToasts() {
  // Add global styles if not already added
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = toastStyles;
    document.head.appendChild(style);
  }
}

// CSS styles for toasts
export const toastStyles = `
/* Toast Container */
.toast-container {
  position: fixed;
  z-index: var(--z-tooltip);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.toast-container > * {
  pointer-events: auto;
}

/* Container positions */
.toast-container-top-left {
  top: 0;
  left: 0;
  align-items: flex-start;
}

.toast-container-top-center {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.toast-container-top-right {
  top: 0;
  right: 0;
  align-items: flex-end;
}

.toast-container-bottom-left {
  bottom: 0;
  left: 0;
  align-items: flex-start;
}

.toast-container-bottom-center {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.toast-container-bottom-right {
  bottom: 0;
  right: 0;
  align-items: flex-end;
}

/* Toast */
.toast {
  display: flex;
  align-items: stretch;
  min-width: 300px;
  max-width: 500px;
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  cursor: pointer;
  transform: translateX(calc(100% + var(--spacing-4)));
  opacity: 0;
  transition: all var(--duration-300) var(--ease-out);
}

.toast-container-top-left .toast,
.toast-container-bottom-left .toast {
  transform: translateX(calc(-100% - var(--spacing-4)));
}

.toast-container-top-center .toast,
.toast-container-bottom-center .toast {
  transform: translateY(20px);
}

.toast-visible {
  transform: translateX(0) translateY(0);
  opacity: 1;
}

/* Toast content */
.toast-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  flex: 1;
}

.toast-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
}

.toast-icon svg {
  width: 100%;
  height: 100%;
}

.toast-message {
  flex: 1;
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
  color: var(--text-primary);
}

/* Toast actions */
.toast-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-right: var(--spacing-2);
}

.toast-action {
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-200) var(--ease-out);
  white-space: nowrap;
}

.toast-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-200) var(--ease-out);
}

.toast-dismiss:hover {
  background-color: var(--muted);
  color: var(--text-primary);
}

.toast-dismiss svg {
  width: 1rem;
  height: 1rem;
}

/* Toast types */
.toast-info {
  border-left: 4px solid var(--color-info-main);
}

.toast-info .toast-icon {
  color: var(--color-info-main);
}

.toast-info .toast-action {
  color: var(--color-info-main);
}

.toast-info .toast-action:hover {
  background-color: var(--color-info-light);
}

.toast-success {
  border-left: 4px solid var(--color-success-main);
}

.toast-success .toast-icon {
  color: var(--color-success-main);
}

.toast-success .toast-action {
  color: var(--color-success-main);
}

.toast-success .toast-action:hover {
  background-color: var(--color-success-light);
}

.toast-warning {
  border-left: 4px solid var(--color-warning-main);
}

.toast-warning .toast-icon {
  color: var(--color-warning-main);
}

.toast-warning .toast-action {
  color: var(--color-warning-main);
}

.toast-warning .toast-action:hover {
  background-color: var(--color-warning-light);
}

.toast-error {
  border-left: 4px solid var(--color-error-main);
}

.toast-error .toast-icon {
  color: var(--color-error-main);
}

.toast-error .toast-action {
  color: var(--color-error-main);
}

.toast-error .toast-action:hover {
  background-color: var(--color-error-light);
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .toast-container {
    padding: var(--spacing-3);
  }
  
  .toast {
    min-width: 250px;
    max-width: calc(100vw - var(--spacing-6));
  }
  
  .toast-container-top-center,
  .toast-container-bottom-center {
    left: 0;
    right: 0;
    transform: none;
    align-items: stretch;
  }
  
  .toast-container-top-center .toast,
  .toast-container-bottom-center .toast {
    max-width: none;
  }
}
`;