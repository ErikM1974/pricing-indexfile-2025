// ColorSelector - Reusable color selection component
// Handles color swatches, selection, and validation

import { Logger } from '../utils/logger';
import { EventBus } from '../utils/event-bus';

export class ColorSelector {
  constructor(options = {}) {
    this.logger = new Logger('ColorSelector');
    this.eventBus = options.eventBus || new EventBus();
    
    // Configuration
    this.config = {
      container: options.container || '#color-selector',
      swatchSize: options.swatchSize || 40,
      columns: options.columns || 'auto',
      showLabels: options.showLabels !== false,
      allowMultiple: options.allowMultiple || false,
      validateStock: options.validateStock || false,
      ...options.config
    };
    
    // State
    this.colors = [];
    this.selectedColors = new Set();
    this.container = null;
    this.initialized = false;
  }
  
  // Initialize the color selector
  async initialize() {
    this.logger.debug('Initializing color selector');
    
    // Find container
    this.container = typeof this.config.container === 'string' 
      ? document.querySelector(this.config.container)
      : this.config.container;
      
    if (!this.container) {
      throw new Error('Color selector container not found');
    }
    
    // Set up container
    this.setupContainer();
    
    // Load colors if provided
    if (this.config.colors) {
      this.setColors(this.config.colors);
    }
    
    this.initialized = true;
    this.eventBus.emit('colorSelector:initialized');
  }
  
  // Set up container element
  setupContainer() {
    this.container.classList.add('color-selector');
    
    // Add styles
    const styles = `
      .color-selector {
        display: grid;
        grid-template-columns: ${this.getGridColumns()};
        gap: 10px;
        padding: 15px;
      }
      
      .color-swatch {
        position: relative;
        width: ${this.config.swatchSize}px;
        height: ${this.config.swatchSize}px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .color-swatch:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .color-swatch.selected {
        border-color: #2e5827;
        box-shadow: 0 0 0 3px rgba(46, 88, 39, 0.2);
      }
      
      .color-swatch.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .color-swatch.disabled:hover {
        transform: none;
      }
      
      .color-label {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        white-space: nowrap;
        color: #666;
      }
      
      .color-stock-indicator {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #28a745;
      }
      
      .color-stock-indicator.low {
        background-color: #ffc107;
      }
      
      .color-stock-indicator.out {
        background-color: #dc3545;
      }
      
      .color-pattern {
        width: 100%;
        height: 100%;
        border-radius: 2px;
      }
    `;
    
    // Add styles to page if not already present
    if (!document.getElementById('color-selector-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'color-selector-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }
  
  // Get grid columns configuration
  getGridColumns() {
    if (this.config.columns === 'auto') {
      return `repeat(auto-fill, minmax(${this.config.swatchSize}px, 1fr))`;
    }
    return `repeat(${this.config.columns}, 1fr)`;
  }
  
  // Set available colors
  setColors(colors) {
    this.logger.debug('Setting colors:', colors.length);
    
    this.colors = colors.map(color => ({
      id: color.id || color.code || color.name,
      name: color.name,
      code: color.code || color.hex || color.value,
      hex: color.hex || color.value || color.code,
      pattern: color.pattern || null,
      image: color.image || null,
      stock: color.stock !== undefined ? color.stock : 'in',
      metadata: color.metadata || {}
    }));
    
    this.render();
    
    this.eventBus.emit('colorSelector:colorsSet', {
      colors: this.colors
    });
  }
  
  // Render color swatches
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    
    this.colors.forEach(color => {
      const swatch = this.createSwatch(color);
      this.container.appendChild(swatch);
    });
  }
  
  // Create a color swatch element
  createSwatch(color) {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.dataset.colorId = color.id;
    
    // Set background
    if (color.image) {
      swatch.style.backgroundImage = `url(${color.image})`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.backgroundPosition = 'center';
    } else if (color.pattern) {
      // Handle patterns (stripes, dots, etc.)
      const pattern = this.createPattern(color);
      swatch.appendChild(pattern);
    } else {
      swatch.style.backgroundColor = color.hex || color.code;
    }
    
    // Add stock indicator
    if (this.config.validateStock && color.stock !== 'in') {
      const indicator = document.createElement('div');
      indicator.className = `color-stock-indicator ${color.stock}`;
      indicator.title = color.stock === 'out' ? 'Out of Stock' : 'Low Stock';
      swatch.appendChild(indicator);
    }
    
    // Add label
    if (this.config.showLabels) {
      const label = document.createElement('div');
      label.className = 'color-label';
      label.textContent = color.name;
      swatch.appendChild(label);
    }
    
    // Add disabled state
    if (color.stock === 'out') {
      swatch.classList.add('disabled');
    }
    
    // Add selected state
    if (this.selectedColors.has(color.id)) {
      swatch.classList.add('selected');
    }
    
    // Add click handler
    swatch.addEventListener('click', () => this.handleSwatchClick(color));
    
    // Add accessibility
    swatch.setAttribute('role', 'button');
    swatch.setAttribute('aria-label', `Select ${color.name}`);
    swatch.setAttribute('aria-pressed', this.selectedColors.has(color.id));
    swatch.tabIndex = 0;
    
    // Keyboard support
    swatch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleSwatchClick(color);
      }
    });
    
    return swatch;
  }
  
  // Create pattern element
  createPattern(color) {
    const pattern = document.createElement('div');
    pattern.className = 'color-pattern';
    
    switch (color.pattern.type) {
      case 'stripes':
        pattern.style.background = `repeating-linear-gradient(
          45deg,
          ${color.pattern.colors[0]},
          ${color.pattern.colors[0]} 10px,
          ${color.pattern.colors[1]} 10px,
          ${color.pattern.colors[1]} 20px
        )`;
        break;
        
      case 'dots':
        pattern.style.background = `radial-gradient(
          circle,
          ${color.pattern.colors[1]} 30%,
          ${color.pattern.colors[0]} 30%
        )`;
        pattern.style.backgroundSize = '10px 10px';
        break;
        
      case 'gradient':
        pattern.style.background = `linear-gradient(
          to right,
          ${color.pattern.colors.join(', ')}
        )`;
        break;
        
      default:
        pattern.style.backgroundColor = color.hex || '#ccc';
    }
    
    return pattern;
  }
  
  // Handle swatch click
  handleSwatchClick(color) {
    // Check if disabled
    if (color.stock === 'out') {
      this.eventBus.emit('colorSelector:stockError', {
        color,
        message: `${color.name} is out of stock`
      });
      return;
    }
    
    // Handle selection
    if (this.config.allowMultiple) {
      if (this.selectedColors.has(color.id)) {
        this.deselectColor(color);
      } else {
        this.selectColor(color);
      }
    } else {
      // Single selection - clear others first
      this.clearSelection();
      this.selectColor(color);
    }
  }
  
  // Select a color
  selectColor(color) {
    this.selectedColors.add(color.id);
    
    // Update UI
    const swatch = this.container.querySelector(`[data-color-id="${color.id}"]`);
    if (swatch) {
      swatch.classList.add('selected');
      swatch.setAttribute('aria-pressed', 'true');
    }
    
    this.logger.debug('Color selected:', color);
    
    // Emit event
    this.eventBus.emit('colorSelector:selected', {
      color,
      selectedColors: this.getSelectedColors()
    });
  }
  
  // Deselect a color
  deselectColor(color) {
    this.selectedColors.delete(color.id);
    
    // Update UI
    const swatch = this.container.querySelector(`[data-color-id="${color.id}"]`);
    if (swatch) {
      swatch.classList.remove('selected');
      swatch.setAttribute('aria-pressed', 'false');
    }
    
    this.logger.debug('Color deselected:', color);
    
    // Emit event
    this.eventBus.emit('colorSelector:deselected', {
      color,
      selectedColors: this.getSelectedColors()
    });
  }
  
  // Clear all selections
  clearSelection() {
    const previousSelections = this.getSelectedColors();
    
    this.selectedColors.clear();
    
    // Update UI
    this.container.querySelectorAll('.color-swatch.selected').forEach(swatch => {
      swatch.classList.remove('selected');
      swatch.setAttribute('aria-pressed', 'false');
    });
    
    // Emit event if there were selections
    if (previousSelections.length > 0) {
      this.eventBus.emit('colorSelector:cleared', {
        previousSelections
      });
    }
  }
  
  // Get selected colors
  getSelectedColors() {
    return this.colors.filter(color => this.selectedColors.has(color.id));
  }
  
  // Set selected colors programmatically
  setSelectedColors(colorIds) {
    this.clearSelection();
    
    const ids = Array.isArray(colorIds) ? colorIds : [colorIds];
    ids.forEach(id => {
      const color = this.colors.find(c => c.id === id);
      if (color) {
        this.selectColor(color);
      }
    });
  }
  
  // Update color stock
  updateColorStock(colorId, stock) {
    const color = this.colors.find(c => c.id === colorId);
    if (color) {
      color.stock = stock;
      
      // Re-render swatch
      const oldSwatch = this.container.querySelector(`[data-color-id="${colorId}"]`);
      if (oldSwatch) {
        const newSwatch = this.createSwatch(color);
        oldSwatch.replaceWith(newSwatch);
      }
      
      this.eventBus.emit('colorSelector:stockUpdated', {
        color,
        stock
      });
    }
  }
  
  // Filter colors
  filterColors(predicate) {
    const swatches = this.container.querySelectorAll('.color-swatch');
    
    swatches.forEach(swatch => {
      const colorId = swatch.dataset.colorId;
      const color = this.colors.find(c => c.id === colorId);
      
      if (color && predicate(color)) {
        swatch.style.display = '';
      } else {
        swatch.style.display = 'none';
      }
    });
  }
  
  // Reset filter
  resetFilter() {
    const swatches = this.container.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.style.display = '';
    });
  }
  
  // Destroy the color selector
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.remove('color-selector');
    }
    
    this.colors = [];
    this.selectedColors.clear();
    this.initialized = false;
    
    this.logger.debug('Color selector destroyed');
  }
}