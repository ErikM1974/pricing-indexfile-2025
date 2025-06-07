// Loading Components
// Phase 6: UI Redesign - Loading states and skeletons

import { tokens } from '../tokens/index.js';

/**
 * Spinner component
 * @class
 */
export class Spinner {
  constructor(options = {}) {
    this.options = {
      size: 'medium', // small | medium | large | number
      color: 'primary', // primary | secondary | current | custom color
      thickness: 3,
      speed: '1s',
      label: 'Loading...',
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create spinner element
   * @private
   */
  createElement() {
    const spinner = document.createElement('div');
    spinner.className = [
      'spinner',
      typeof this.options.size === 'string' ? `spinner-${this.options.size}` : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-label', this.options.label);
    
    // SVG spinner
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 50 50');
    svg.classList.add('spinner-svg');
    
    if (typeof this.options.size === 'number') {
      svg.style.width = `${this.options.size}px`;
      svg.style.height = `${this.options.size}px`;
    }
    
    svg.style.animationDuration = this.options.speed;
    
    // Circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '25');
    circle.setAttribute('cy', '25');
    circle.setAttribute('r', '20');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', this.options.thickness.toString());
    circle.classList.add('spinner-circle');
    
    // Set color
    if (this.options.color === 'primary') {
      circle.style.stroke = 'var(--primary)';
    } else if (this.options.color === 'secondary') {
      circle.style.stroke = 'var(--secondary)';
    } else if (this.options.color === 'current') {
      circle.style.stroke = 'currentColor';
    } else {
      circle.style.stroke = this.options.color;
    }
    
    svg.appendChild(circle);
    spinner.appendChild(svg);
    
    // Screen reader text
    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = this.options.label;
    spinner.appendChild(srText);
    
    return spinner;
  }
  
  /**
   * Update spinner options
   * @param {Object} options - New options
   */
  update(options) {
    Object.assign(this.options, options);
    
    const svg = this.element.querySelector('.spinner-svg');
    const circle = this.element.querySelector('.spinner-circle');
    
    if (options.size) {
      this.element.className = [
        'spinner',
        typeof options.size === 'string' ? `spinner-${options.size}` : '',
        this.options.className
      ].filter(Boolean).join(' ');
      
      if (typeof options.size === 'number') {
        svg.style.width = `${options.size}px`;
        svg.style.height = `${options.size}px`;
      }
    }
    
    if (options.speed) {
      svg.style.animationDuration = options.speed;
    }
    
    if (options.thickness) {
      circle.setAttribute('stroke-width', options.thickness.toString());
    }
    
    if (options.color) {
      if (options.color === 'primary') {
        circle.style.stroke = 'var(--primary)';
      } else if (options.color === 'secondary') {
        circle.style.stroke = 'var(--secondary)';
      } else if (options.color === 'current') {
        circle.style.stroke = 'currentColor';
      } else {
        circle.style.stroke = options.color;
      }
    }
    
    if (options.label) {
      this.element.setAttribute('aria-label', options.label);
      const srText = this.element.querySelector('.sr-only');
      if (srText) srText.textContent = options.label;
    }
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
 * Skeleton loader component
 * @class
 */
export class Skeleton {
  constructor(options = {}) {
    this.options = {
      variant: 'text', // text | circular | rectangular | button
      width: '100%',
      height: 'auto',
      animation: 'pulse', // pulse | wave | none
      lines: 1, // for text variant
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create skeleton element
   * @private
   */
  createElement() {
    const skeleton = document.createElement('div');
    skeleton.className = [
      'skeleton',
      `skeleton-${this.options.variant}`,
      this.options.animation !== 'none' ? `skeleton-${this.options.animation}` : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    skeleton.setAttribute('aria-hidden', 'true');
    
    // Set dimensions
    if (this.options.width) {
      skeleton.style.width = typeof this.options.width === 'number' ? 
        `${this.options.width}px` : this.options.width;
    }
    
    if (this.options.height && this.options.height !== 'auto') {
      skeleton.style.height = typeof this.options.height === 'number' ? 
        `${this.options.height}px` : this.options.height;
    }
    
    // Handle text variant with multiple lines
    if (this.options.variant === 'text' && this.options.lines > 1) {
      skeleton.innerHTML = '';
      for (let i = 0; i < this.options.lines; i++) {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        
        // Make last line shorter
        if (i === this.options.lines - 1) {
          line.style.width = '80%';
        }
        
        skeleton.appendChild(line);
      }
    }
    
    return skeleton;
  }
  
  /**
   * Update skeleton options
   * @param {Object} options - New options
   */
  update(options) {
    Object.assign(this.options, options);
    
    // Update classes
    this.element.className = [
      'skeleton',
      `skeleton-${this.options.variant}`,
      this.options.animation !== 'none' ? `skeleton-${this.options.animation}` : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    // Update dimensions
    if (options.width !== undefined) {
      this.element.style.width = typeof options.width === 'number' ? 
        `${options.width}px` : options.width;
    }
    
    if (options.height !== undefined) {
      this.element.style.height = typeof options.height === 'number' ? 
        `${options.height}px` : options.height;
    }
    
    // Update lines for text variant
    if (options.variant === 'text' || options.lines !== undefined) {
      if (this.options.variant === 'text' && this.options.lines > 1) {
        this.element.innerHTML = '';
        for (let i = 0; i < this.options.lines; i++) {
          const line = document.createElement('div');
          line.className = 'skeleton-line';
          
          if (i === this.options.lines - 1) {
            line.style.width = '80%';
          }
          
          this.element.appendChild(line);
        }
      }
    }
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
 * Loading overlay component
 * @class
 */
export class LoadingOverlay {
  constructor(options = {}) {
    this.options = {
      target: document.body,
      message: '',
      spinner: true,
      spinnerOptions: {},
      blur: true,
      opacity: 0.75,
      className: '',
      ...options
    };
    
    this.overlay = null;
    this.isVisible = false;
  }
  
  /**
   * Create overlay element
   * @private
   */
  createElement() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = [
      'loading-overlay',
      this.options.blur ? 'loading-overlay-blur' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    this.overlay.style.opacity = '0';
    this.overlay.style.backgroundColor = `rgba(255, 255, 255, ${this.options.opacity})`;
    
    // Dark mode background
    if (document.documentElement.classList.contains('theme-dark')) {
      this.overlay.style.backgroundColor = `rgba(0, 0, 0, ${this.options.opacity})`;
    }
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'loading-overlay-content';
    
    // Add spinner
    if (this.options.spinner) {
      const spinner = new Spinner({
        size: 'large',
        ...this.options.spinnerOptions
      });
      content.appendChild(spinner.getElement());
    }
    
    // Add message
    if (this.options.message) {
      const message = document.createElement('div');
      message.className = 'loading-overlay-message';
      message.textContent = this.options.message;
      content.appendChild(message);
    }
    
    this.overlay.appendChild(content);
    
    return this.overlay;
  }
  
  /**
   * Show the overlay
   */
  show() {
    if (this.isVisible) return;
    
    if (!this.overlay) {
      this.createElement();
    }
    
    // Position overlay
    const target = this.options.target;
    if (target === document.body) {
      this.overlay.style.position = 'fixed';
      this.overlay.style.inset = '0';
    } else {
      // Make target relative if not already positioned
      const position = window.getComputedStyle(target).position;
      if (position === 'static') {
        target.style.position = 'relative';
      }
      
      this.overlay.style.position = 'absolute';
      this.overlay.style.inset = '0';
    }
    
    // Add to target
    target.appendChild(this.overlay);
    
    // Trigger reflow
    this.overlay.offsetHeight;
    
    // Animate in
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
    });
    
    this.isVisible = true;
    
    // Prevent interaction with target
    if (target !== document.body) {
      target.setAttribute('aria-busy', 'true');
    }
  }
  
  /**
   * Hide the overlay
   */
  async hide() {
    if (!this.isVisible || !this.overlay) return;
    
    // Animate out
    this.overlay.style.opacity = '0';
    
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Remove from DOM
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.remove();
    }
    
    this.isVisible = false;
    
    // Restore interaction
    const target = this.options.target;
    if (target !== document.body) {
      target.removeAttribute('aria-busy');
    }
  }
  
  /**
   * Update message
   * @param {string} message - New message
   */
  updateMessage(message) {
    this.options.message = message;
    
    if (this.overlay) {
      const messageElement = this.overlay.querySelector('.loading-overlay-message');
      if (messageElement) {
        messageElement.textContent = message;
      } else if (message) {
        const newMessage = document.createElement('div');
        newMessage.className = 'loading-overlay-message';
        newMessage.textContent = message;
        this.overlay.querySelector('.loading-overlay-content').appendChild(newMessage);
      }
    }
  }
  
  /**
   * Destroy the overlay
   */
  destroy() {
    this.hide();
    this.overlay = null;
  }
}

// Helper functions
export function createSpinner(options) {
  return new Spinner(options);
}

export function createSkeleton(options) {
  return new Skeleton(options);
}

export function createLoadingOverlay(options) {
  return new LoadingOverlay(options);
}

// CSS styles for loading components
export const loadingStyles = `
/* Spinner */
.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner-svg {
  animation: spinner-rotate 1s linear infinite;
}

.spinner-circle {
  stroke-dasharray: 125.66;
  stroke-dashoffset: 125.66;
  animation: spinner-dash 1.5s ease-in-out infinite;
  stroke-linecap: round;
}

/* Spinner sizes */
.spinner-small .spinner-svg {
  width: 1rem;
  height: 1rem;
}

.spinner-medium .spinner-svg {
  width: 1.5rem;
  height: 1.5rem;
}

.spinner-large .spinner-svg {
  width: 2.5rem;
  height: 2.5rem;
}

/* Spinner animations */
@keyframes spinner-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes spinner-dash {
  0% {
    stroke-dashoffset: 125.66;
  }
  50% {
    stroke-dashoffset: 31.415;
    transform: rotate(135deg);
  }
  100% {
    stroke-dashoffset: 125.66;
    transform: rotate(450deg);
  }
}

/* Skeleton */
.skeleton {
  background-color: var(--muted);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
}

/* Skeleton variants */
.skeleton-text {
  height: 1em;
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-2);
}

.skeleton-text:last-child {
  margin-bottom: 0;
}

.skeleton-line {
  height: 1em;
  background-color: var(--muted);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-2);
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.skeleton-circular {
  border-radius: 50%;
  width: 40px;
  height: 40px;
}

.skeleton-rectangular {
  border-radius: var(--radius-md);
}

.skeleton-button {
  height: 2.5rem;
  border-radius: var(--radius-md);
  width: 100px;
}

/* Skeleton animations */
.skeleton-pulse::after {
  animation: skeleton-pulse 2s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
}

.theme-dark .skeleton-pulse::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}

.skeleton-wave::after {
  animation: skeleton-wave 1.6s linear infinite;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
}

.theme-dark .skeleton-wave::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}

@keyframes skeleton-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

@keyframes skeleton-wave {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Loading Overlay */
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.75);
  z-index: var(--z-modal);
  transition: opacity var(--duration-300) var(--ease-out);
}

.theme-dark .loading-overlay {
  background-color: rgba(0, 0, 0, 0.75);
}

.loading-overlay-blur {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.loading-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
}

.loading-overlay-message {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  text-align: center;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;