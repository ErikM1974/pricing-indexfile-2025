// Card Component
// Phase 6: UI Redesign - Flexible card component for content organization

import { tokens } from '../tokens/index.js';

/**
 * Card component for organizing content
 * @class
 */
export class Card {
  constructor(options = {}) {
    this.options = {
      variant: 'default', // default | bordered | elevated | interactive
      padding: 'medium', // none | small | medium | large
      className: '',
      ...options
    };
    
    this.element = this.createElement();
    this.header = null;
    this.body = null;
    this.footer = null;
    
    this.setupStructure();
  }
  
  /**
   * Create the card element
   * @private
   */
  createElement() {
    const card = document.createElement('div');
    card.className = [
      'card',
      `card-${this.options.variant}`,
      this.options.padding !== 'none' ? `card-padding-${this.options.padding}` : '',
      this.options.className
    ].filter(Boolean).join(' ');
    
    if (this.options.onClick) {
      card.classList.add('card-clickable');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      
      card.addEventListener('click', this.options.onClick);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.options.onClick(e);
        }
      });
    }
    
    return card;
  }
  
  /**
   * Setup card structure
   * @private
   */
  setupStructure() {
    // Add header if provided
    if (this.options.header) {
      this.setHeader(this.options.header);
    }
    
    // Add body if provided
    if (this.options.body || this.options.content) {
      this.setBody(this.options.body || this.options.content);
    }
    
    // Add footer if provided
    if (this.options.footer) {
      this.setFooter(this.options.footer);
    }
  }
  
  /**
   * Set card header
   * @param {string|HTMLElement|Object} content - Header content
   */
  setHeader(content) {
    // Remove existing header
    if (this.header) {
      this.header.remove();
    }
    
    this.header = document.createElement('div');
    this.header.className = 'card-header';
    
    if (typeof content === 'string') {
      this.header.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.header.appendChild(content);
    } else if (typeof content === 'object') {
      // Handle object with title and subtitle
      if (content.title) {
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = content.title;
        this.header.appendChild(title);
      }
      
      if (content.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'card-subtitle';
        subtitle.textContent = content.subtitle;
        this.header.appendChild(subtitle);
      }
      
      if (content.actions) {
        const actions = document.createElement('div');
        actions.className = 'card-header-actions';
        
        if (Array.isArray(content.actions)) {
          content.actions.forEach(action => {
            actions.appendChild(action);
          });
        } else {
          actions.appendChild(content.actions);
        }
        
        this.header.appendChild(actions);
      }
    }
    
    // Insert at beginning
    this.element.insertBefore(this.header, this.element.firstChild);
  }
  
  /**
   * Set card body
   * @param {string|HTMLElement} content - Body content
   */
  setBody(content) {
    // Remove existing body
    if (this.body) {
      this.body.remove();
    }
    
    this.body = document.createElement('div');
    this.body.className = 'card-body';
    
    if (typeof content === 'string') {
      this.body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.body.appendChild(content);
    }
    
    // Insert after header or at beginning
    if (this.header) {
      this.header.insertAdjacentElement('afterend', this.body);
    } else {
      this.element.insertBefore(this.body, this.element.firstChild);
    }
  }
  
  /**
   * Set card footer
   * @param {string|HTMLElement|Object} content - Footer content
   */
  setFooter(content) {
    // Remove existing footer
    if (this.footer) {
      this.footer.remove();
    }
    
    this.footer = document.createElement('div');
    this.footer.className = 'card-footer';
    
    if (typeof content === 'string') {
      this.footer.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.footer.appendChild(content);
    } else if (typeof content === 'object' && content.actions) {
      // Handle footer with actions
      const actions = document.createElement('div');
      actions.className = 'card-footer-actions';
      
      if (Array.isArray(content.actions)) {
        content.actions.forEach(action => {
          actions.appendChild(action);
        });
      } else {
        actions.appendChild(content.actions);
      }
      
      this.footer.appendChild(actions);
    }
    
    // Append at end
    this.element.appendChild(this.footer);
  }
  
  /**
   * Add loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    if (loading) {
      this.element.classList.add('card-loading');
      
      // Add loading overlay
      const overlay = document.createElement('div');
      overlay.className = 'card-loading-overlay';
      overlay.innerHTML = `
        <div class="card-loading-spinner">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" />
          </svg>
        </div>
      `;
      this.element.appendChild(overlay);
    } else {
      this.element.classList.remove('card-loading');
      const overlay = this.element.querySelector('.card-loading-overlay');
      if (overlay) overlay.remove();
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
 * Card grid component for organizing multiple cards
 * @class
 */
export class CardGrid {
  constructor(options = {}) {
    this.options = {
      columns: 'auto', // auto | 1 | 2 | 3 | 4 | 6
      gap: 'medium', // small | medium | large
      className: '',
      ...options
    };
    
    this.element = this.createElement();
    this.cards = [];
  }
  
  /**
   * Create the grid element
   * @private
   */
  createElement() {
    const grid = document.createElement('div');
    grid.className = [
      'card-grid',
      `card-grid-cols-${this.options.columns}`,
      `card-grid-gap-${this.options.gap}`,
      this.options.className
    ].filter(Boolean).join(' ');
    
    return grid;
  }
  
  /**
   * Add a card to the grid
   * @param {Card|Object} card - Card instance or options
   */
  addCard(card) {
    let cardInstance;
    
    if (card instanceof Card) {
      cardInstance = card;
    } else {
      cardInstance = new Card(card);
    }
    
    this.cards.push(cardInstance);
    this.element.appendChild(cardInstance.getElement());
  }
  
  /**
   * Remove a card from the grid
   * @param {number} index - Card index
   */
  removeCard(index) {
    const card = this.cards[index];
    if (card) {
      card.destroy();
      this.cards.splice(index, 1);
    }
  }
  
  /**
   * Clear all cards
   */
  clear() {
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    this.element.innerHTML = '';
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
    this.clear();
    this.element.remove();
  }
}

// Helper functions
export function createCard(options) {
  return new Card(options);
}

export function createCardGrid(options) {
  return new CardGrid(options);
}

// CSS styles for cards
export const cardStyles = `
/* Card Base Styles */
.card {
  background-color: var(--card);
  color: var(--card-foreground);
  border-radius: var(--radius-lg);
  position: relative;
  transition: all var(--duration-200) var(--ease-out);
}

/* Variants */
.card-default {
  border: 1px solid var(--border);
}

.card-bordered {
  border: 2px solid var(--border);
}

.card-elevated {
  box-shadow: var(--shadow-md);
  border: none;
}

.card-interactive {
  border: 1px solid var(--border);
  cursor: pointer;
}

.card-interactive:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.card-clickable {
  cursor: pointer;
  outline: none;
}

.card-clickable:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Padding */
.card-padding-small > :not(.card-loading-overlay) {
  padding: var(--spacing-3);
}

.card-padding-medium > :not(.card-loading-overlay) {
  padding: var(--spacing-6);
}

.card-padding-large > :not(.card-loading-overlay) {
  padding: var(--spacing-8);
}

/* Card sections */
.card-header {
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.card-header + .card-body {
  border-top: none;
}

.card-body {
  flex: 1;
}

.card-footer {
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-3);
}

/* Card content */
.card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0;
  color: var(--text-primary);
}

.card-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: var(--spacing-1) 0 0 0;
}

.card-header-actions,
.card-footer-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* Loading state */
.card-loading {
  overflow: hidden;
}

.card-loading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: inherit;
}

.theme-dark .card-loading-overlay {
  background-color: rgba(0, 0, 0, 0.8);
}

.card-loading-spinner {
  width: 2rem;
  height: 2rem;
  color: var(--primary);
}

.card-loading-spinner svg {
  width: 100%;
  height: 100%;
  animation: card-spin 1s linear infinite;
}

.card-loading-spinner circle {
  stroke-dasharray: 64;
  stroke-dashoffset: 64;
  animation: card-dash 1.5s ease-in-out infinite;
  opacity: 0.25;
}

@keyframes card-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes card-dash {
  0% { stroke-dashoffset: 64; }
  50% { stroke-dashoffset: 16; }
  100% { stroke-dashoffset: 64; }
}

/* Card Grid */
.card-grid {
  display: grid;
  width: 100%;
}

.card-grid-cols-auto {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.card-grid-cols-1 {
  grid-template-columns: repeat(1, 1fr);
}

.card-grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.card-grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.card-grid-cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.card-grid-cols-6 {
  grid-template-columns: repeat(6, 1fr);
}

/* Responsive grid */
@media (max-width: 640px) {
  .card-grid-cols-2,
  .card-grid-cols-3,
  .card-grid-cols-4,
  .card-grid-cols-6 {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 641px) and (max-width: 768px) {
  .card-grid-cols-3,
  .card-grid-cols-4,
  .card-grid-cols-6 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .card-grid-cols-4,
  .card-grid-cols-6 {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Grid gaps */
.card-grid-gap-small {
  gap: var(--spacing-3);
}

.card-grid-gap-medium {
  gap: var(--spacing-6);
}

.card-grid-gap-large {
  gap: var(--spacing-8);
}
`;