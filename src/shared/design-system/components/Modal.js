// Modal Component
// Phase 6: UI Redesign - Accessible modal/dialog component

import { tokens } from '../tokens/index.js';
import { Logger } from '../../../core/logger.js';

const logger = new Logger('Modal');

/**
 * Modal component for overlays and dialogs
 * @class
 */
export class Modal {
  constructor(options = {}) {
    this.options = {
      title: '',
      content: '',
      size: 'medium', // small | medium | large | full
      closeButton: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      autoFocus: true,
      preventScroll: true,
      animation: true,
      className: '',
      ...options
    };
    
    this.isOpen = false;
    this.previousActiveElement = null;
    this.backdrop = null;
    this.modal = null;
    this.header = null;
    this.body = null;
    this.footer = null;
    
    this.create();
    this.bindEvents();
  }
  
  /**
   * Create modal elements
   * @private
   */
  create() {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = [
      'modal',
      `modal-${this.options.size}`,
      this.options.animation ? 'modal-animated' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-hidden', 'true');
    
    if (this.options.title) {
      this.modal.setAttribute('aria-labelledby', 'modal-title');
    }
    
    if (this.options.description) {
      this.modal.setAttribute('aria-describedby', 'modal-description');
    }
    
    // Create modal content wrapper
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Create header if title provided
    if (this.options.title || this.options.closeButton) {
      this.header = document.createElement('div');
      this.header.className = 'modal-header';
      
      if (this.options.title) {
        const title = document.createElement('h2');
        title.id = 'modal-title';
        title.className = 'modal-title';
        title.textContent = this.options.title;
        this.header.appendChild(title);
      }
      
      if (this.options.closeButton) {
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close dialog');
        closeButton.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        `;
        closeButton.addEventListener('click', () => this.close());
        this.header.appendChild(closeButton);
      }
      
      modalContent.appendChild(this.header);
    }
    
    // Create body
    this.body = document.createElement('div');
    this.body.className = 'modal-body';
    
    if (this.options.description) {
      this.body.id = 'modal-description';
    }
    
    this.setContent(this.options.content);
    modalContent.appendChild(this.body);
    
    // Create footer if provided
    if (this.options.footer) {
      this.setFooter(this.options.footer);
      modalContent.appendChild(this.footer);
    }
    
    this.modal.appendChild(modalContent);
  }
  
  /**
   * Bind event handlers
   * @private
   */
  bindEvents() {
    // Backdrop click
    if (this.options.closeOnBackdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }
    
    // Prevent modal content clicks from closing
    this.modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Escape key
    if (this.options.closeOnEscape) {
      this.escapeHandler = (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
    }
    
    // Focus trap
    this.focusTrapHandler = (e) => {
      if (!this.isOpen || e.key !== 'Tab') return;
      
      const focusableElements = this.modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    };
  }
  
  /**
   * Set modal content
   * @param {string|HTMLElement} content - Modal content
   */
  setContent(content) {
    if (typeof content === 'string') {
      this.body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.body.innerHTML = '';
      this.body.appendChild(content);
    }
  }
  
  /**
   * Set modal footer
   * @param {string|HTMLElement|Array} footer - Footer content
   */
  setFooter(footer) {
    if (!this.footer) {
      this.footer = document.createElement('div');
      this.footer.className = 'modal-footer';
      this.modal.querySelector('.modal-content').appendChild(this.footer);
    }
    
    this.footer.innerHTML = '';
    
    if (typeof footer === 'string') {
      this.footer.innerHTML = footer;
    } else if (footer instanceof HTMLElement) {
      this.footer.appendChild(footer);
    } else if (Array.isArray(footer)) {
      footer.forEach(item => {
        if (typeof item === 'string') {
          const span = document.createElement('span');
          span.innerHTML = item;
          this.footer.appendChild(span);
        } else {
          this.footer.appendChild(item);
        }
      });
    }
  }
  
  /**
   * Open the modal
   * @returns {Promise} Resolves when modal is opened
   */
  async open() {
    if (this.isOpen) return;
    
    this.isOpen = true;
    
    // Store current focus
    this.previousActiveElement = document.activeElement;
    
    // Add to DOM
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.modal);
    
    // Prevent body scroll
    if (this.options.preventScroll) {
      document.body.style.overflow = 'hidden';
    }
    
    // Add event listeners
    if (this.escapeHandler) {
      document.addEventListener('keydown', this.escapeHandler);
    }
    document.addEventListener('keydown', this.focusTrapHandler);
    
    // Trigger reflow for animation
    if (this.options.animation) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    // Show modal
    this.backdrop.classList.add('modal-backdrop-visible');
    this.modal.classList.add('modal-visible');
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.modal.setAttribute('aria-hidden', 'false');
    
    // Auto focus
    if (this.options.autoFocus) {
      const focusTarget = this.modal.querySelector('[autofocus]') || 
                         this.modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusTarget) {
        focusTarget.focus();
      }
    }
    
    // Dispatch open event
    this.modal.dispatchEvent(new CustomEvent('modal:open'));
    
    // Wait for animation
    if (this.options.animation) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  /**
   * Close the modal
   * @returns {Promise} Resolves when modal is closed
   */
  async close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    
    // Hide modal
    this.backdrop.classList.remove('modal-backdrop-visible');
    this.modal.classList.remove('modal-visible');
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.modal.setAttribute('aria-hidden', 'true');
    
    // Wait for animation
    if (this.options.animation) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Remove from DOM
    this.backdrop.remove();
    this.modal.remove();
    
    // Restore body scroll
    if (this.options.preventScroll) {
      document.body.style.overflow = '';
    }
    
    // Remove event listeners
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
    document.removeEventListener('keydown', this.focusTrapHandler);
    
    // Restore focus
    if (this.previousActiveElement && this.previousActiveElement.focus) {
      this.previousActiveElement.focus();
    }
    
    // Dispatch close event
    this.modal.dispatchEvent(new CustomEvent('modal:close'));
  }
  
  /**
   * Update modal options
   * @param {Object} options - New options
   */
  update(options) {
    Object.assign(this.options, options);
    
    if (options.title && this.header) {
      const title = this.header.querySelector('.modal-title');
      if (title) {
        title.textContent = options.title;
      }
    }
    
    if (options.content !== undefined) {
      this.setContent(options.content);
    }
    
    if (options.footer !== undefined) {
      this.setFooter(options.footer);
    }
    
    if (options.size) {
      this.modal.className = [
        'modal',
        `modal-${options.size}`,
        this.options.animation ? 'modal-animated' : '',
        this.options.className
      ].filter(Boolean).join(' ');
    }
  }
  
  /**
   * Destroy the modal
   */
  destroy() {
    this.close();
    this.backdrop = null;
    this.modal = null;
  }
}

/**
 * Confirm dialog helper
 * @param {Object} options - Dialog options
 * @returns {Promise<boolean>} User choice
 */
export async function confirm(options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title || 'Confirm',
      content: options.message || 'Are you sure?',
      size: 'small',
      closeOnBackdrop: false,
      closeOnEscape: false,
      footer: [
        createButton({
          text: options.cancelText || 'Cancel',
          variant: 'outline',
          onClick: () => {
            modal.close();
            resolve(false);
          }
        }),
        createButton({
          text: options.confirmText || 'Confirm',
          variant: options.dangerous ? 'destructive' : 'primary',
          onClick: () => {
            modal.close();
            resolve(true);
          }
        })
      ],
      ...options
    });
    
    modal.open();
  });
}

/**
 * Alert dialog helper
 * @param {Object} options - Dialog options
 * @returns {Promise} Resolves when closed
 */
export async function alert(options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title || 'Alert',
      content: options.message || '',
      size: 'small',
      footer: createButton({
        text: options.buttonText || 'OK',
        variant: 'primary',
        onClick: () => {
          modal.close();
          resolve();
        }
      }),
      ...options
    });
    
    modal.open();
  });
}

/**
 * Prompt dialog helper
 * @param {Object} options - Dialog options
 * @returns {Promise<string|null>} User input or null
 */
export async function prompt(options = {}) {
  return new Promise((resolve) => {
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.value = options.defaultValue || '';
    input.placeholder = options.placeholder || '';
    input.autofocus = true;
    
    // Create content wrapper
    const content = document.createElement('div');
    if (options.message) {
      const message = document.createElement('p');
      message.textContent = options.message;
      message.style.marginBottom = 'var(--spacing-4)';
      content.appendChild(message);
    }
    content.appendChild(input);
    
    const modal = new Modal({
      title: options.title || 'Input',
      content: content,
      size: 'small',
      closeOnBackdrop: false,
      closeOnEscape: false,
      footer: [
        createButton({
          text: options.cancelText || 'Cancel',
          variant: 'outline',
          onClick: () => {
            modal.close();
            resolve(null);
          }
        }),
        createButton({
          text: options.submitText || 'Submit',
          variant: 'primary',
          onClick: () => {
            modal.close();
            resolve(input.value);
          }
        })
      ],
      ...options
    });
    
    // Handle enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        modal.close();
        resolve(input.value);
      }
    });
    
    modal.open();
  });
}

// Import createButton for dialog helpers
import { createButton } from './Button.js';

// CSS styles for modals
export const modalStyles = `
/* Modal Backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: var(--color-neutral-900);
  opacity: 0;
  transition: opacity var(--duration-300) var(--ease-out);
  z-index: var(--z-modal-backdrop);
}

.modal-backdrop-visible {
  opacity: 0.8;
}

/* Modal Container */
.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.95);
  background-color: var(--background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  opacity: 0;
  transition: all var(--duration-300) var(--ease-out);
  z-index: var(--z-modal);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-visible {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* Modal Sizes */
.modal-small {
  width: 90vw;
  max-width: 400px;
}

.modal-medium {
  width: 90vw;
  max-width: 600px;
}

.modal-large {
  width: 90vw;
  max-width: 800px;
}

.modal-full {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-radius: 0;
}

/* Modal Content */
.modal-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  padding-right: var(--spacing-4);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-200) var(--ease-out);
  outline: none;
}

.modal-close:hover {
  background-color: var(--muted);
  color: var(--text-primary);
}

.modal-close:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.modal-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Modal Body */
.modal-body {
  flex: 1;
  padding: var(--spacing-6);
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* Scrollbar Styling */
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: var(--muted);
  border-radius: var(--radius-full);
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-full);
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Animation disabled */
.modal:not(.modal-animated) {
  transition: none;
}

.modal:not(.modal-animated) + .modal-backdrop {
  transition: none;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .modal-small,
  .modal-medium,
  .modal-large {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--spacing-4);
  }
}
`;