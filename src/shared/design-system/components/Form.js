// Form Components
// Phase 6: UI Redesign - Accessible form components

import { tokens } from '../tokens/index.js';
import { Logger } from '../../../core/logger.js';

const logger = new Logger('Form');

/**
 * Base form field component
 * @class
 */
export class FormField {
  constructor(options = {}) {
    this.options = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      label: '',
      helper: '',
      error: '',
      required: false,
      disabled: false,
      className: '',
      ...options
    };
    
    this.container = this.createContainer();
    this.labelElement = null;
    this.inputElement = null;
    this.helperElement = null;
    this.errorElement = null;
  }
  
  /**
   * Create container element
   * @private
   */
  createContainer() {
    const container = document.createElement('div');
    container.className = [
      'form-field',
      this.options.required ? 'form-field-required' : '',
      this.options.disabled ? 'form-field-disabled' : '',
      this.options.error ? 'form-field-error' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    return container;
  }
  
  /**
   * Create label element
   * @protected
   */
  createLabel() {
    if (!this.options.label) return null;
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = this.options.id;
    label.textContent = this.options.label;
    
    if (this.options.required) {
      const required = document.createElement('span');
      required.className = 'form-label-required';
      required.textContent = ' *';
      required.setAttribute('aria-label', 'required');
      label.appendChild(required);
    }
    
    return label;
  }
  
  /**
   * Create helper text element
   * @protected
   */
  createHelper() {
    if (!this.options.helper) return null;
    
    const helper = document.createElement('div');
    helper.className = 'form-helper';
    helper.id = `${this.options.id}-helper`;
    helper.textContent = this.options.helper;
    
    return helper;
  }
  
  /**
   * Create error message element
   * @protected
   */
  createError() {
    const error = document.createElement('div');
    error.className = 'form-error';
    error.id = `${this.options.id}-error`;
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'polite');
    
    if (this.options.error) {
      error.textContent = this.options.error;
    }
    
    return error;
  }
  
  /**
   * Update field state
   * @param {Object} updates - State updates
   */
  update(updates) {
    Object.assign(this.options, updates);
    
    // Update container classes
    this.container.className = [
      'form-field',
      this.options.required ? 'form-field-required' : '',
      this.options.disabled ? 'form-field-disabled' : '',
      this.options.error ? 'form-field-error' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    // Update disabled state
    if (this.inputElement) {
      this.inputElement.disabled = this.options.disabled;
    }
    
    // Update error message
    if (this.errorElement) {
      this.errorElement.textContent = this.options.error || '';
    }
  }
  
  /**
   * Set error message
   * @param {string} error - Error message
   */
  setError(error) {
    this.update({ error });
  }
  
  /**
   * Clear error message
   */
  clearError() {
    this.update({ error: '' });
  }
  
  /**
   * Get field value
   * @returns {*} Field value
   */
  getValue() {
    return this.inputElement ? this.inputElement.value : null;
  }
  
  /**
   * Set field value
   * @param {*} value - Field value
   */
  setValue(value) {
    if (this.inputElement) {
      this.inputElement.value = value;
    }
  }
  
  /**
   * Get the DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.container;
  }
  
  /**
   * Destroy the component
   */
  destroy() {
    this.container.remove();
  }
}

/**
 * Text input component
 * @class
 */
export class TextInput extends FormField {
  constructor(options = {}) {
    super({
      type: 'text',
      placeholder: '',
      maxLength: null,
      pattern: null,
      autocomplete: 'off',
      ...options
    });
    
    this.setupField();
  }
  
  /**
   * Setup field elements
   * @private
   */
  setupField() {
    // Create label
    this.labelElement = this.createLabel();
    if (this.labelElement) {
      this.container.appendChild(this.labelElement);
    }
    
    // Create input wrapper
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'form-input-wrapper';
    
    // Create input
    this.inputElement = document.createElement('input');
    this.inputElement.type = this.options.type;
    this.inputElement.id = this.options.id;
    this.inputElement.name = this.options.name;
    this.inputElement.className = 'form-input';
    this.inputElement.placeholder = this.options.placeholder;
    this.inputElement.disabled = this.options.disabled;
    this.inputElement.required = this.options.required;
    this.inputElement.autocomplete = this.options.autocomplete;
    
    if (this.options.value) {
      this.inputElement.value = this.options.value;
    }
    
    if (this.options.maxLength) {
      this.inputElement.maxLength = this.options.maxLength;
    }
    
    if (this.options.pattern) {
      this.inputElement.pattern = this.options.pattern;
    }
    
    // Set ARIA attributes
    const ariaDescribedBy = [];
    if (this.options.helper) {
      ariaDescribedBy.push(`${this.options.id}-helper`);
    }
    if (this.options.error) {
      ariaDescribedBy.push(`${this.options.id}-error`);
    }
    if (ariaDescribedBy.length > 0) {
      this.inputElement.setAttribute('aria-describedby', ariaDescribedBy.join(' '));
    }
    
    if (this.options.error) {
      this.inputElement.setAttribute('aria-invalid', 'true');
    }
    
    // Add event listeners
    this.inputElement.addEventListener('input', (e) => {
      this.clearError();
      if (this.options.onInput) {
        this.options.onInput(e);
      }
    });
    
    this.inputElement.addEventListener('change', (e) => {
      if (this.options.onChange) {
        this.options.onChange(e);
      }
    });
    
    inputWrapper.appendChild(this.inputElement);
    
    // Add icon if provided
    if (this.options.icon) {
      const icon = document.createElement('span');
      icon.className = 'form-input-icon';
      if (typeof this.options.icon === 'string') {
        icon.innerHTML = this.options.icon;
      } else {
        icon.appendChild(this.options.icon);
      }
      inputWrapper.appendChild(icon);
    }
    
    this.container.appendChild(inputWrapper);
    
    // Create helper text
    this.helperElement = this.createHelper();
    if (this.helperElement) {
      this.container.appendChild(this.helperElement);
    }
    
    // Create error message
    this.errorElement = this.createError();
    this.container.appendChild(this.errorElement);
  }
}

/**
 * Textarea component
 * @class
 */
export class Textarea extends FormField {
  constructor(options = {}) {
    super({
      rows: 4,
      cols: null,
      resize: 'vertical', // none | vertical | horizontal | both
      maxLength: null,
      placeholder: '',
      ...options
    });
    
    this.setupField();
  }
  
  /**
   * Setup field elements
   * @private
   */
  setupField() {
    // Create label
    this.labelElement = this.createLabel();
    if (this.labelElement) {
      this.container.appendChild(this.labelElement);
    }
    
    // Create textarea
    this.inputElement = document.createElement('textarea');
    this.inputElement.id = this.options.id;
    this.inputElement.name = this.options.name;
    this.inputElement.className = 'form-textarea';
    this.inputElement.placeholder = this.options.placeholder;
    this.inputElement.disabled = this.options.disabled;
    this.inputElement.required = this.options.required;
    this.inputElement.rows = this.options.rows;
    
    if (this.options.cols) {
      this.inputElement.cols = this.options.cols;
    }
    
    if (this.options.value) {
      this.inputElement.value = this.options.value;
    }
    
    if (this.options.maxLength) {
      this.inputElement.maxLength = this.options.maxLength;
    }
    
    // Set resize style
    this.inputElement.style.resize = this.options.resize;
    
    // Set ARIA attributes
    const ariaDescribedBy = [];
    if (this.options.helper) {
      ariaDescribedBy.push(`${this.options.id}-helper`);
    }
    if (this.options.error) {
      ariaDescribedBy.push(`${this.options.id}-error`);
    }
    if (ariaDescribedBy.length > 0) {
      this.inputElement.setAttribute('aria-describedby', ariaDescribedBy.join(' '));
    }
    
    if (this.options.error) {
      this.inputElement.setAttribute('aria-invalid', 'true');
    }
    
    // Add event listeners
    this.inputElement.addEventListener('input', (e) => {
      this.clearError();
      if (this.options.onInput) {
        this.options.onInput(e);
      }
    });
    
    this.inputElement.addEventListener('change', (e) => {
      if (this.options.onChange) {
        this.options.onChange(e);
      }
    });
    
    this.container.appendChild(this.inputElement);
    
    // Create helper text
    this.helperElement = this.createHelper();
    if (this.helperElement) {
      this.container.appendChild(this.helperElement);
    }
    
    // Create error message
    this.errorElement = this.createError();
    this.container.appendChild(this.errorElement);
  }
}

/**
 * Select component
 * @class
 */
export class Select extends FormField {
  constructor(options = {}) {
    super({
      options: [], // Array of {value, label, disabled}
      placeholder: 'Select an option',
      multiple: false,
      ...options
    });
    
    this.setupField();
  }
  
  /**
   * Setup field elements
   * @private
   */
  setupField() {
    // Create label
    this.labelElement = this.createLabel();
    if (this.labelElement) {
      this.container.appendChild(this.labelElement);
    }
    
    // Create select wrapper
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'form-select-wrapper';
    
    // Create select
    this.inputElement = document.createElement('select');
    this.inputElement.id = this.options.id;
    this.inputElement.name = this.options.name;
    this.inputElement.className = 'form-select';
    this.inputElement.disabled = this.options.disabled;
    this.inputElement.required = this.options.required;
    this.inputElement.multiple = this.options.multiple;
    
    // Add placeholder option
    if (this.options.placeholder && !this.options.multiple) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = this.options.placeholder;
      placeholder.disabled = true;
      placeholder.selected = true;
      this.inputElement.appendChild(placeholder);
    }
    
    // Add options
    this.options.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label || opt.value;
      option.disabled = opt.disabled || false;
      
      if (this.options.value === opt.value || 
          (Array.isArray(this.options.value) && this.options.value.includes(opt.value))) {
        option.selected = true;
      }
      
      this.inputElement.appendChild(option);
    });
    
    // Set ARIA attributes
    const ariaDescribedBy = [];
    if (this.options.helper) {
      ariaDescribedBy.push(`${this.options.id}-helper`);
    }
    if (this.options.error) {
      ariaDescribedBy.push(`${this.options.id}-error`);
    }
    if (ariaDescribedBy.length > 0) {
      this.inputElement.setAttribute('aria-describedby', ariaDescribedBy.join(' '));
    }
    
    if (this.options.error) {
      this.inputElement.setAttribute('aria-invalid', 'true');
    }
    
    // Add event listeners
    this.inputElement.addEventListener('change', (e) => {
      this.clearError();
      if (this.options.onChange) {
        this.options.onChange(e);
      }
    });
    
    selectWrapper.appendChild(this.inputElement);
    
    // Add dropdown icon
    const icon = document.createElement('span');
    icon.className = 'form-select-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    `;
    selectWrapper.appendChild(icon);
    
    this.container.appendChild(selectWrapper);
    
    // Create helper text
    this.helperElement = this.createHelper();
    if (this.helperElement) {
      this.container.appendChild(this.helperElement);
    }
    
    // Create error message
    this.errorElement = this.createError();
    this.container.appendChild(this.errorElement);
  }
  
  /**
   * Update options
   * @param {Array} options - New options
   */
  updateOptions(options) {
    this.options.options = options;
    
    // Clear current options
    this.inputElement.innerHTML = '';
    
    // Re-add placeholder
    if (this.options.placeholder && !this.options.multiple) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = this.options.placeholder;
      placeholder.disabled = true;
      placeholder.selected = true;
      this.inputElement.appendChild(placeholder);
    }
    
    // Add new options
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label || opt.value;
      option.disabled = opt.disabled || false;
      this.inputElement.appendChild(option);
    });
  }
}

/**
 * Checkbox component
 * @class
 */
export class Checkbox extends FormField {
  constructor(options = {}) {
    super({
      checked: false,
      indeterminate: false,
      ...options
    });
    
    this.setupField();
  }
  
  /**
   * Setup field elements
   * @private
   */
  setupField() {
    // Create wrapper
    const wrapper = document.createElement('label');
    wrapper.className = 'form-checkbox-wrapper';
    wrapper.htmlFor = this.options.id;
    
    // Create checkbox
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'checkbox';
    this.inputElement.id = this.options.id;
    this.inputElement.name = this.options.name;
    this.inputElement.className = 'form-checkbox';
    this.inputElement.disabled = this.options.disabled;
    this.inputElement.required = this.options.required;
    this.inputElement.checked = this.options.checked;
    this.inputElement.indeterminate = this.options.indeterminate;
    
    if (this.options.value !== undefined) {
      this.inputElement.value = this.options.value;
    }
    
    // Set ARIA attributes
    if (this.options.error) {
      this.inputElement.setAttribute('aria-invalid', 'true');
      this.inputElement.setAttribute('aria-describedby', `${this.options.id}-error`);
    }
    
    // Add event listeners
    this.inputElement.addEventListener('change', (e) => {
      this.clearError();
      if (this.options.onChange) {
        this.options.onChange(e);
      }
    });
    
    wrapper.appendChild(this.inputElement);
    
    // Add label text
    if (this.options.label) {
      const labelText = document.createElement('span');
      labelText.className = 'form-checkbox-label';
      labelText.innerHTML = this.options.label;
      
      if (this.options.required) {
        const required = document.createElement('span');
        required.className = 'form-label-required';
        required.textContent = ' *';
        required.setAttribute('aria-label', 'required');
        labelText.appendChild(required);
      }
      
      wrapper.appendChild(labelText);
    }
    
    this.container.appendChild(wrapper);
    
    // Create helper text
    this.helperElement = this.createHelper();
    if (this.helperElement) {
      this.container.appendChild(this.helperElement);
    }
    
    // Create error message
    this.errorElement = this.createError();
    this.container.appendChild(this.errorElement);
  }
  
  /**
   * Get field value
   * @returns {boolean} Checked state
   */
  getValue() {
    return this.inputElement ? this.inputElement.checked : false;
  }
  
  /**
   * Set field value
   * @param {boolean} checked - Checked state
   */
  setValue(checked) {
    if (this.inputElement) {
      this.inputElement.checked = checked;
    }
  }
}

/**
 * Radio group component
 * @class
 */
export class RadioGroup extends FormField {
  constructor(options = {}) {
    super({
      options: [], // Array of {value, label, disabled}
      ...options
    });
    
    this.radioElements = [];
    this.setupField();
  }
  
  /**
   * Setup field elements
   * @private
   */
  setupField() {
    // Create fieldset
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'form-radio-group';
    
    // Create legend
    if (this.options.label) {
      const legend = document.createElement('legend');
      legend.className = 'form-radio-legend';
      legend.textContent = this.options.label;
      
      if (this.options.required) {
        const required = document.createElement('span');
        required.className = 'form-label-required';
        required.textContent = ' *';
        required.setAttribute('aria-label', 'required');
        legend.appendChild(required);
      }
      
      fieldset.appendChild(legend);
    }
    
    // Create radio buttons
    const radioContainer = document.createElement('div');
    radioContainer.className = 'form-radio-options';
    
    this.options.options.forEach((opt, index) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'form-radio-wrapper';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.id = `${this.options.id}-${index}`;
      radio.name = this.options.name || this.options.id;
      radio.className = 'form-radio';
      radio.value = opt.value;
      radio.disabled = this.options.disabled || opt.disabled;
      radio.required = this.options.required && index === 0;
      radio.checked = this.options.value === opt.value;
      
      // Set ARIA attributes
      if (this.options.error) {
        radio.setAttribute('aria-invalid', 'true');
      }
      
      // Add event listeners
      radio.addEventListener('change', (e) => {
        this.clearError();
        if (this.options.onChange) {
          this.options.onChange(e);
        }
      });
      
      this.radioElements.push(radio);
      wrapper.appendChild(radio);
      
      const labelText = document.createElement('span');
      labelText.className = 'form-radio-label';
      labelText.textContent = opt.label || opt.value;
      wrapper.appendChild(labelText);
      
      radioContainer.appendChild(wrapper);
    });
    
    fieldset.appendChild(radioContainer);
    this.container.appendChild(fieldset);
    
    // Create helper text
    this.helperElement = this.createHelper();
    if (this.helperElement) {
      this.container.appendChild(this.helperElement);
    }
    
    // Create error message
    this.errorElement = this.createError();
    this.container.appendChild(this.errorElement);
  }
  
  /**
   * Get field value
   * @returns {string} Selected value
   */
  getValue() {
    const checked = this.radioElements.find(radio => radio.checked);
    return checked ? checked.value : null;
  }
  
  /**
   * Set field value
   * @param {string} value - Value to select
   */
  setValue(value) {
    this.radioElements.forEach(radio => {
      radio.checked = radio.value === value;
    });
  }
}

// Helper functions
export function createTextInput(options) {
  return new TextInput(options);
}

export function createTextarea(options) {
  return new Textarea(options);
}

export function createSelect(options) {
  return new Select(options);
}

export function createCheckbox(options) {
  return new Checkbox(options);
}

export function createRadioGroup(options) {
  return new RadioGroup(options);
}

// CSS styles for forms
export const formStyles = `
/* Form Field Base */
.form-field {
  margin-bottom: var(--spacing-6);
}

.form-field:last-child {
  margin-bottom: 0;
}

/* Labels */
.form-label,
.form-radio-legend {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-2);
}

.form-label-required {
  color: var(--destructive);
}

/* Input Base */
.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--text-base);
  font-family: inherit;
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background-color: var(--background);
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  transition: all var(--duration-200) var(--ease-out);
  outline: none;
}

.form-input:hover:not(:disabled),
.form-textarea:hover:not(:disabled),
.form-select:hover:not(:disabled) {
  border-color: var(--border);
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(var(--ring), 0.1);
}

.form-input:disabled,
.form-textarea:disabled,
.form-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--muted);
}

/* Input Wrapper */
.form-input-wrapper {
  position: relative;
}

.form-input-icon {
  position: absolute;
  right: var(--spacing-3);
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-muted);
  pointer-events: none;
}

.form-input-icon svg {
  width: 100%;
  height: 100%;
}

/* Textarea */
.form-textarea {
  min-height: calc(var(--spacing-8) * 3);
}

/* Select */
.form-select-wrapper {
  position: relative;
}

.form-select {
  appearance: none;
  padding-right: var(--spacing-10);
  cursor: pointer;
}

.form-select:disabled {
  cursor: not-allowed;
}

.form-select-icon {
  position: absolute;
  right: var(--spacing-3);
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-muted);
  pointer-events: none;
}

.form-select-icon svg {
  width: 100%;
  height: 100%;
}

/* Checkbox & Radio */
.form-checkbox-wrapper,
.form-radio-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.form-checkbox-wrapper:hover .form-checkbox:not(:disabled),
.form-radio-wrapper:hover .form-radio:not(:disabled) {
  border-color: var(--primary);
}

.form-checkbox,
.form-radio {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  margin-right: var(--spacing-2);
  flex-shrink: 0;
  accent-color: var(--primary);
  cursor: pointer;
}

.form-checkbox:disabled,
.form-radio:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.form-checkbox-label,
.form-radio-label {
  font-size: var(--text-base);
  color: var(--text-primary);
}

/* Radio Group */
.form-radio-group {
  border: none;
  padding: 0;
  margin: 0;
}

.form-radio-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Helper & Error */
.form-helper {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-1);
}

.form-error {
  font-size: var(--text-sm);
  color: var(--destructive);
  margin-top: var(--spacing-1);
  min-height: 1.25rem;
}

.form-error:empty {
  display: none;
}

/* Error State */
.form-field-error .form-input,
.form-field-error .form-textarea,
.form-field-error .form-select {
  border-color: var(--destructive);
}

.form-field-error .form-input:focus,
.form-field-error .form-textarea:focus,
.form-field-error .form-select:focus {
  border-color: var(--destructive);
  box-shadow: 0 0 0 3px rgba(var(--destructive), 0.1);
}

/* Disabled State */
.form-field-disabled {
  opacity: 0.6;
}

.form-field-disabled .form-label,
.form-field-disabled .form-checkbox-label,
.form-field-disabled .form-radio-label {
  cursor: not-allowed;
}
`;