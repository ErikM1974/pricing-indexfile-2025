// Button Component
// Phase 6: UI Redesign - Accessible, themeable button component

import { tokens } from '../tokens/index.js';
import { Logger } from '../../../core/logger.js';

const logger = new Logger('Button');

/**
 * Button component with multiple variants and sizes
 * @class
 */
export class Button {
  constructor(options = {}) {
    this.options = {
      variant: 'primary',
      size: 'medium',
      fullWidth: false,
      disabled: false,
      loading: false,
      icon: null,
      iconPosition: 'left',
      type: 'button',
      ariaLabel: null,
      className: '',
      ...options
    };
    
    this.element = this.createElement();
    this.bindEvents();
  }
  
  /**
   * Create the button element
   * @private
   */
  createElement() {
    const button = document.createElement('button');
    button.type = this.options.type;
    
    // Apply base classes
    const classes = [
      'btn',
      `btn-${this.options.variant}`,
      `btn-${this.options.size}`,
      this.options.fullWidth ? 'btn-full' : '',
      this.options.disabled ? 'btn-disabled' : '',
      this.options.loading ? 'btn-loading' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    button.className = classes;
    
    // Set accessibility attributes
    if (this.options.disabled) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    }
    
    if (this.options.ariaLabel) {
      button.setAttribute('aria-label', this.options.ariaLabel);
    }
    
    // Build content
    this.updateContent();
    
    return button;
  }
  
  /**
   * Update button content
   * @private
   */
  updateContent() {
    const fragments = [];
    
    // Loading spinner
    if (this.options.loading) {
      const spinner = document.createElement('span');
      spinner.className = 'btn-spinner';
      spinner.innerHTML = `
        <svg class="btn-spinner-svg" viewBox="0 0 24 24">
          <circle class="btn-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" />
        </svg>
      `;
      fragments.push(spinner);
    }
    
    // Icon
    if (this.options.icon && !this.options.loading) {
      const icon = document.createElement('span');
      icon.className = `btn-icon btn-icon-${this.options.iconPosition}`;
      
      if (typeof this.options.icon === 'string') {
        icon.innerHTML = this.options.icon;
      } else {
        icon.appendChild(this.options.icon);
      }
      
      if (this.options.iconPosition === 'left') {
        fragments.push(icon);
      }
    }
    
    // Text content
    if (this.options.text) {
      const text = document.createElement('span');
      text.className = 'btn-text';
      text.textContent = this.options.text;
      fragments.push(text);
    }
    
    // Right icon
    if (this.options.icon && !this.options.loading && this.options.iconPosition === 'right') {
      const icon = document.createElement('span');
      icon.className = `btn-icon btn-icon-${this.options.iconPosition}`;
      
      if (typeof this.options.icon === 'string') {
        icon.innerHTML = this.options.icon;
      } else {
        icon.appendChild(this.options.icon);
      }
      
      fragments.push(icon);
    }
    
    // Clear and append content
    this.element.innerHTML = '';
    fragments.forEach(fragment => this.element.appendChild(fragment));
  }
  
  /**
   * Bind event handlers
   * @private
   */
  bindEvents() {
    // Click handler
    if (this.options.onClick) {
      this.element.addEventListener('click', (e) => {
        if (!this.options.disabled && !this.options.loading) {
          this.options.onClick(e);
        }
      });
    }
    
    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!this.options.disabled && !this.options.loading) {
          this.element.click();
        }
      }
    });
    
    // Focus management
    this.element.addEventListener('focus', () => {
      this.element.classList.add('btn-focused');
    });
    
    this.element.addEventListener('blur', () => {
      this.element.classList.remove('btn-focused');
    });
  }
  
  /**
   * Update button options
   * @param {Object} options - New options
   */
  update(options) {
    this.options = { ...this.options, ...options };
    
    // Update classes
    const classes = [
      'btn',
      `btn-${this.options.variant}`,
      `btn-${this.options.size}`,
      this.options.fullWidth ? 'btn-full' : '',
      this.options.disabled ? 'btn-disabled' : '',
      this.options.loading ? 'btn-loading' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    this.element.className = classes;
    
    // Update attributes
    this.element.disabled = this.options.disabled;
    this.element.setAttribute('aria-disabled', this.options.disabled ? 'true' : 'false');
    
    if (this.options.loading) {
      this.element.setAttribute('aria-busy', 'true');
    } else {
      this.element.removeAttribute('aria-busy');
    }
    
    // Update content
    this.updateContent();
  }
  
  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    this.update({ loading });
  }
  
  /**
   * Set disabled state
   * @param {boolean} disabled - Disabled state
   */
  setDisabled(disabled) {
    this.update({ disabled });
  }
  
  /**
   * Set button text
   * @param {string} text - Button text
   */
  setText(text) {
    this.update({ text });
  }
  
  /**
   * Get the DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
  
  /**
   * Destroy the component
   */
  destroy() {
    this.element.remove();
  }
}

/**
 * Button group component
 * @class
 */
export class ButtonGroup {
  constructor(options = {}) {
    this.options = {
      buttons: [],
      orientation: 'horizontal', // horizontal | vertical
      size: 'medium',
      className: '',
      ...options
    };
    
    this.element = this.createElement();
    this.buttons = [];
    this.renderButtons();
  }
  
  /**
   * Create the button group element
   * @private
   */
  createElement() {
    const group = document.createElement('div');
    group.className = [
      'btn-group',
      `btn-group-${this.options.orientation}`,
      this.options.className
    ].filter(Boolean).join(' ');
    
    group.setAttribute('role', 'group');
    
    if (this.options.ariaLabel) {
      group.setAttribute('aria-label', this.options.ariaLabel);
    }
    
    return group;
  }
  
  /**
   * Render buttons in the group
   * @private
   */
  renderButtons() {
    this.element.innerHTML = '';
    this.buttons = [];
    
    this.options.buttons.forEach((buttonOptions, index) => {
      const button = new Button({
        size: this.options.size,
        ...buttonOptions,
        className: [
          buttonOptions.className || '',
          index === 0 ? 'btn-group-first' : '',
          index === this.options.buttons.length - 1 ? 'btn-group-last' : ''
        ].filter(Boolean).join(' ')
      });
      
      this.buttons.push(button);
      this.element.appendChild(button.getElement());
    });
  }
  
  /**
   * Add a button to the group
   * @param {Object} buttonOptions - Button options
   */
  addButton(buttonOptions) {
    this.options.buttons.push(buttonOptions);
    this.renderButtons();
  }
  
  /**
   * Remove a button from the group
   * @param {number} index - Button index
   */
  removeButton(index) {
    this.options.buttons.splice(index, 1);
    this.renderButtons();
  }
  
  /**
   * Get the DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
  
  /**
   * Destroy the component
   */
  destroy() {
    this.buttons.forEach(button => button.destroy());
    this.element.remove();
  }
}

/**
 * Icon button component
 * @class
 */
export class IconButton extends Button {
  constructor(options = {}) {
    super({
      ...options,
      variant: options.variant || 'ghost',
      className: `btn-icon-only ${options.className || ''}`.trim()
    });
    
    // Ensure aria-label for icon-only buttons
    if (!this.options.ariaLabel && this.options.text) {
      this.element.setAttribute('aria-label', this.options.text);
    }
  }
}

// Helper function to create buttons
export function createButton(options) {
  return new Button(options);
}

export function createButtonGroup(options) {
  return new ButtonGroup(options);
}

export function createIconButton(options) {
  return new IconButton(options);
}

// CSS styles for buttons
export const buttonStyles = `
/* Button Base Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  transition: all var(--duration-200) var(--ease-out);
  position: relative;
  white-space: nowrap;
  outline: none;
}

/* Focus styles */
.btn:focus-visible,
.btn.btn-focused {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Variants */
.btn-primary {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-700);
  border-color: var(--color-primary-700);
}

.btn-secondary {
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  border-color: var(--secondary);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-600);
  border-color: var(--color-secondary-600);
}

.btn-outline {
  background-color: transparent;
  color: var(--primary);
  border-color: var(--border);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--accent);
  border-color: var(--accent-foreground);
}

.btn-ghost {
  background-color: transparent;
  color: var(--text-primary);
  border-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--accent);
  color: var(--accent-foreground);
}

.btn-destructive {
  background-color: var(--destructive);
  color: var(--destructive-foreground);
  border-color: var(--destructive);
}

.btn-destructive:hover:not(:disabled) {
  background-color: var(--color-error-dark);
  border-color: var(--color-error-dark);
}

/* Sizes */
.btn-small {
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--text-sm);
  gap: var(--spacing-1);
}

.btn-medium {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--text-base);
}

.btn-large {
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--text-lg);
  gap: var(--spacing-3);
}

/* States */
.btn:disabled,
.btn.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.btn-loading {
  color: transparent;
}

.btn-full {
  width: 100%;
}

/* Icons */
.btn-icon {
  display: inline-flex;
  align-items: center;
  width: 1.25em;
  height: 1.25em;
}

.btn-icon svg {
  width: 100%;
  height: 100%;
}

.btn-icon-only {
  padding: var(--spacing-2);
  gap: 0;
}

.btn-icon-only.btn-small {
  padding: var(--spacing-1);
}

.btn-icon-only.btn-large {
  padding: var(--spacing-3);
}

/* Spinner */
.btn-spinner {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-spinner-svg {
  width: 1.25em;
  height: 1.25em;
  animation: btn-spin 1s linear infinite;
}

.btn-spinner-circle {
  opacity: 0.25;
}

.btn-spinner-circle {
  stroke-dasharray: 64;
  stroke-dashoffset: 64;
  animation: btn-spinner-dash 1.5s ease-in-out infinite;
}

@keyframes btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes btn-spinner-dash {
  0% {
    stroke-dashoffset: 64;
  }
  50% {
    stroke-dashoffset: 16;
    transform: rotate(135deg);
  }
  100% {
    stroke-dashoffset: 64;
    transform: rotate(450deg);
  }
}

/* Button Group */
.btn-group {
  display: inline-flex;
  isolation: isolate;
}

.btn-group-horizontal {
  flex-direction: row;
}

.btn-group-vertical {
  flex-direction: column;
}

.btn-group > .btn:not(:first-child):not(:last-child) {
  border-radius: 0;
}

.btn-group-horizontal > .btn:first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.btn-group-horizontal > .btn:last-child {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.btn-group-vertical > .btn:first-child {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.btn-group-vertical > .btn:last-child {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.btn-group > .btn:focus {
  z-index: 1;
}
`;