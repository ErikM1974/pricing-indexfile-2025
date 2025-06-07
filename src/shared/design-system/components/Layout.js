// Layout Components
// Phase 6: UI Redesign - Responsive layout system

import { tokens } from '../tokens/index.js';

/**
 * Grid layout component
 * @class
 */
export class Grid {
  constructor(options = {}) {
    this.options = {
      columns: 12, // number | object with breakpoints
      gap: 'medium', // small | medium | large | number
      alignItems: 'stretch', // start | center | end | stretch
      justifyItems: 'stretch', // start | center | end | stretch
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create grid element
   * @private
   */
  createElement() {
    const grid = document.createElement('div');
    grid.className = [
      'layout-grid',
      this.getColumnsClass(),
      this.getGapClass(),
      this.options.className
    ].filter(Boolean).join(' ');
    
    // Apply alignment styles
    if (this.options.alignItems !== 'stretch') {
      grid.style.alignItems = this.options.alignItems;
    }
    
    if (this.options.justifyItems !== 'stretch') {
      grid.style.justifyItems = this.options.justifyItems;
    }
    
    return grid;
  }
  
  /**
   * Get columns class
   * @private
   */
  getColumnsClass() {
    if (typeof this.options.columns === 'number') {
      return `grid-cols-${this.options.columns}`;
    }
    
    // Handle responsive columns
    const classes = [];
    Object.entries(this.options.columns).forEach(([breakpoint, cols]) => {
      if (breakpoint === 'default') {
        classes.push(`grid-cols-${cols}`);
      } else {
        classes.push(`${breakpoint}:grid-cols-${cols}`);
      }
    });
    
    return classes.join(' ');
  }
  
  /**
   * Get gap class
   * @private
   */
  getGapClass() {
    if (typeof this.options.gap === 'number') {
      this.element.style.gap = `${this.options.gap}px`;
      return '';
    }
    
    return `grid-gap-${this.options.gap}`;
  }
  
  /**
   * Add child to grid
   * @param {HTMLElement} child - Child element
   * @param {Object} options - Grid item options
   */
  addChild(child, options = {}) {
    if (options.span) {
      child.classList.add(`col-span-${options.span}`);
    }
    
    if (options.start) {
      child.style.gridColumnStart = options.start;
    }
    
    if (options.end) {
      child.style.gridColumnEnd = options.end;
    }
    
    this.element.appendChild(child);
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
 * Stack layout component
 * @class
 */
export class Stack {
  constructor(options = {}) {
    this.options = {
      direction: 'vertical', // vertical | horizontal
      gap: 'medium', // small | medium | large | number
      align: 'stretch', // start | center | end | stretch | baseline
      justify: 'start', // start | center | end | between | around | evenly
      wrap: false,
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create stack element
   * @private
   */
  createElement() {
    const stack = document.createElement('div');
    stack.className = [
      'layout-stack',
      `stack-${this.options.direction}`,
      this.getGapClass(),
      this.options.wrap ? 'stack-wrap' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    // Apply flex properties
    if (this.options.align !== 'stretch') {
      stack.style.alignItems = this.options.align;
    }
    
    if (this.options.justify !== 'start') {
      stack.style.justifyContent = this.options.justify;
    }
    
    return stack;
  }
  
  /**
   * Get gap class
   * @private
   */
  getGapClass() {
    if (typeof this.options.gap === 'number') {
      this.element.style.gap = `${this.options.gap}px`;
      return '';
    }
    
    return `stack-gap-${this.options.gap}`;
  }
  
  /**
   * Add child to stack
   * @param {HTMLElement} child - Child element
   * @param {Object} options - Stack item options
   */
  addChild(child, options = {}) {
    if (options.grow) {
      child.style.flexGrow = options.grow;
    }
    
    if (options.shrink !== undefined) {
      child.style.flexShrink = options.shrink;
    }
    
    if (options.basis) {
      child.style.flexBasis = options.basis;
    }
    
    if (options.align) {
      child.style.alignSelf = options.align;
    }
    
    this.element.appendChild(child);
  }
  
  /**
   * Add spacer to stack
   * @param {Object} options - Spacer options
   */
  addSpacer(options = {}) {
    const spacer = new Spacer(options);
    this.element.appendChild(spacer.getElement());
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
 * Container component
 * @class
 */
export class Container {
  constructor(options = {}) {
    this.options = {
      size: 'default', // small | medium | large | full | default
      padding: true, // boolean | object with breakpoints
      center: true,
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create container element
   * @private
   */
  createElement() {
    const container = document.createElement('div');
    container.className = [
      'layout-container',
      this.getSizeClass(),
      this.getPaddingClass(),
      this.options.center ? 'container-center' : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    return container;
  }
  
  /**
   * Get size class
   * @private
   */
  getSizeClass() {
    if (this.options.size === 'default') {
      return '';
    }
    
    return `container-${this.options.size}`;
  }
  
  /**
   * Get padding class
   * @private
   */
  getPaddingClass() {
    if (this.options.padding === false) {
      return 'container-no-padding';
    }
    
    if (this.options.padding === true) {
      return 'container-padding';
    }
    
    // Handle responsive padding
    const classes = [];
    Object.entries(this.options.padding).forEach(([breakpoint, hasPadding]) => {
      if (breakpoint === 'default') {
        classes.push(hasPadding ? 'container-padding' : 'container-no-padding');
      } else {
        classes.push(`${breakpoint}:${hasPadding ? 'container-padding' : 'container-no-padding'}`);
      }
    });
    
    return classes.join(' ');
  }
  
  /**
   * Set content
   * @param {HTMLElement|string} content - Container content
   */
  setContent(content) {
    if (typeof content === 'string') {
      this.element.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.element.innerHTML = '';
      this.element.appendChild(content);
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
 * Spacer component
 * @class
 */
export class Spacer {
  constructor(options = {}) {
    this.options = {
      size: 'auto', // auto | small | medium | large | number
      axis: 'both', // horizontal | vertical | both
      className: '',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  /**
   * Create spacer element
   * @private
   */
  createElement() {
    const spacer = document.createElement('div');
    spacer.className = [
      'layout-spacer',
      this.options.className
    ].filter(Boolean).join(' ');
    
    if (this.options.size === 'auto') {
      spacer.style.flex = '1';
    } else if (typeof this.options.size === 'number') {
      if (this.options.axis === 'horizontal') {
        spacer.style.width = `${this.options.size}px`;
      } else if (this.options.axis === 'vertical') {
        spacer.style.height = `${this.options.size}px`;
      } else {
        spacer.style.width = `${this.options.size}px`;
        spacer.style.height = `${this.options.size}px`;
      }
    } else {
      spacer.classList.add(`spacer-${this.options.size}`);
      
      if (this.options.axis !== 'both') {
        spacer.classList.add(`spacer-${this.options.axis}`);
      }
    }
    
    return spacer;
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

// Helper functions
export function createGrid(options) {
  return new Grid(options);
}

export function createStack(options) {
  return new Stack(options);
}

export function createContainer(options) {
  return new Container(options);
}

export function createSpacer(options) {
  return new Spacer(options);
}

// CSS styles for layout components
export const layoutStyles = `
/* Grid Layout */
.layout-grid {
  display: grid;
  width: 100%;
}

/* Grid columns */
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
.grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
.grid-cols-9 { grid-template-columns: repeat(9, minmax(0, 1fr)); }
.grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
.grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }

/* Grid gaps */
.grid-gap-small { gap: var(--spacing-2); }
.grid-gap-medium { gap: var(--spacing-4); }
.grid-gap-large { gap: var(--spacing-6); }

/* Column spans */
.col-span-1 { grid-column: span 1 / span 1; }
.col-span-2 { grid-column: span 2 / span 2; }
.col-span-3 { grid-column: span 3 / span 3; }
.col-span-4 { grid-column: span 4 / span 4; }
.col-span-5 { grid-column: span 5 / span 5; }
.col-span-6 { grid-column: span 6 / span 6; }
.col-span-7 { grid-column: span 7 / span 7; }
.col-span-8 { grid-column: span 8 / span 8; }
.col-span-9 { grid-column: span 9 / span 9; }
.col-span-10 { grid-column: span 10 / span 10; }
.col-span-11 { grid-column: span 11 / span 11; }
.col-span-12 { grid-column: span 12 / span 12; }
.col-span-full { grid-column: 1 / -1; }

/* Stack Layout */
.layout-stack {
  display: flex;
  width: 100%;
}

.stack-vertical {
  flex-direction: column;
}

.stack-horizontal {
  flex-direction: row;
}

.stack-wrap {
  flex-wrap: wrap;
}

/* Stack gaps */
.stack-gap-small { gap: var(--spacing-2); }
.stack-gap-medium { gap: var(--spacing-4); }
.stack-gap-large { gap: var(--spacing-6); }

/* Container */
.layout-container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.container-center {
  margin-left: auto;
  margin-right: auto;
}

/* Container sizes */
.container-small { max-width: var(--container-3xl); }
.container-medium { max-width: var(--container-5xl); }
.container-large { max-width: var(--container-7xl); }
.container-full { max-width: 100%; }

/* Default container has responsive max-width */
.layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
  max-width: 100%;
}

@media (min-width: 640px) {
  .layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
    max-width: 640px;
  }
}

@media (min-width: 768px) {
  .layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
    max-width: 768px;
  }
}

@media (min-width: 1024px) {
  .layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
    max-width: 1024px;
  }
}

@media (min-width: 1280px) {
  .layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
    max-width: 1280px;
  }
}

@media (min-width: 1536px) {
  .layout-container:not(.container-small):not(.container-medium):not(.container-large):not(.container-full) {
    max-width: 1536px;
  }
}

/* Container padding */
.container-padding {
  padding-left: var(--spacing-4);
  padding-right: var(--spacing-4);
}

@media (min-width: 640px) {
  .container-padding {
    padding-left: var(--spacing-6);
    padding-right: var(--spacing-6);
  }
}

@media (min-width: 1024px) {
  .container-padding {
    padding-left: var(--spacing-8);
    padding-right: var(--spacing-8);
  }
}

.container-no-padding {
  padding-left: 0;
  padding-right: 0;
}

/* Spacer */
.layout-spacer {
  flex-shrink: 0;
}

.spacer-small {
  width: var(--spacing-2);
  height: var(--spacing-2);
}

.spacer-medium {
  width: var(--spacing-4);
  height: var(--spacing-4);
}

.spacer-large {
  width: var(--spacing-6);
  height: var(--spacing-6);
}

.spacer-horizontal.spacer-small { width: var(--spacing-2); height: auto; }
.spacer-horizontal.spacer-medium { width: var(--spacing-4); height: auto; }
.spacer-horizontal.spacer-large { width: var(--spacing-6); height: auto; }

.spacer-vertical.spacer-small { width: auto; height: var(--spacing-2); }
.spacer-vertical.spacer-medium { width: auto; height: var(--spacing-4); }
.spacer-vertical.spacer-large { width: auto; height: var(--spacing-6); }

/* Responsive utilities */
@media (min-width: 640px) {
  .sm\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sm\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sm\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .sm\\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .sm\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .sm\\:grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .sm\\:grid-cols-9 { grid-template-columns: repeat(9, minmax(0, 1fr)); }
  .sm\\:grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .sm\\:grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
  .sm\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}

@media (min-width: 768px) {
  .md\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .md\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .md\\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .md\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .md\\:grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .md\\:grid-cols-9 { grid-template-columns: repeat(9, minmax(0, 1fr)); }
  .md\\:grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .md\\:grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
  .md\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .lg\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .lg\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .lg\\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .lg\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .lg\\:grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .lg\\:grid-cols-9 { grid-template-columns: repeat(9, minmax(0, 1fr)); }
  .lg\\:grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .lg\\:grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
  .lg\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}

@media (min-width: 1280px) {
  .xl\\:grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .xl\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .xl\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .xl\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .xl\\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .xl\\:grid-cols-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .xl\\:grid-cols-8 { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .xl\\:grid-cols-9 { grid-template-columns: repeat(9, minmax(0, 1fr)); }
  .xl\\:grid-cols-10 { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .xl\\:grid-cols-11 { grid-template-columns: repeat(11, minmax(0, 1fr)); }
  .xl\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}
`;