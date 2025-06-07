// Tabs Component
// Phase 6: UI Redesign - Accessible tabbed interface

import { tokens } from '../tokens/index.js';

/**
 * Tabs container component
 * @class
 */
export class Tabs {
  constructor(options = {}) {
    this.options = {
      defaultIndex: 0,
      orientation: 'horizontal', // horizontal | vertical
      variant: 'default', // default | pills | underline
      size: 'medium', // small | medium | large
      onChange: null,
      className: '',
      ...options
    };
    
    this.activeIndex = this.options.defaultIndex;
    this.tabList = null;
    this.tabPanels = null;
    this.element = this.createElement();
  }
  
  /**
   * Create tabs container
   * @private
   */
  createElement() {
    const container = document.createElement('div');
    container.className = [
      'tabs',
      `tabs-${this.options.orientation}`,
      `tabs-${this.options.variant}`,
      `tabs-${this.options.size}`,
      this.options.className
    ].filter(Boolean).join(' ');
    
    return container;
  }
  
  /**
   * Set tab list
   * @param {TabList} tabList - Tab list component
   */
  setTabList(tabList) {
    this.tabList = tabList;
    this.tabList.setParent(this);
    this.element.appendChild(tabList.getElement());
  }
  
  /**
   * Set tab panels
   * @param {TabPanels} tabPanels - Tab panels component
   */
  setTabPanels(tabPanels) {
    this.tabPanels = tabPanels;
    this.tabPanels.setParent(this);
    this.element.appendChild(tabPanels.getElement());
  }
  
  /**
   * Get active tab index
   * @returns {number} Active index
   */
  getActiveIndex() {
    return this.activeIndex;
  }
  
  /**
   * Set active tab
   * @param {number} index - Tab index
   */
  setActiveTab(index) {
    if (index === this.activeIndex) return;
    
    const previousIndex = this.activeIndex;
    this.activeIndex = index;
    
    // Update tab list
    if (this.tabList) {
      this.tabList.setActiveTab(index);
    }
    
    // Update panels
    if (this.tabPanels) {
      this.tabPanels.setActivePanel(index);
    }
    
    // Call onChange callback
    if (this.options.onChange) {
      this.options.onChange(index, previousIndex);
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
    if (this.tabList) this.tabList.destroy();
    if (this.tabPanels) this.tabPanels.destroy();
    this.element.remove();
  }
}

/**
 * Tab list component
 * @class
 */
export class TabList {
  constructor(options = {}) {
    this.options = {
      label: 'Tab navigation',
      className: '',
      ...options
    };
    
    this.parent = null;
    this.tabs = [];
    this.element = this.createElement();
  }
  
  /**
   * Create tab list element
   * @private
   */
  createElement() {
    const tabList = document.createElement('div');
    tabList.className = ['tab-list', this.options.className].filter(Boolean).join(' ');
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', this.options.label);
    
    // Set orientation
    if (this.parent?.options.orientation === 'vertical') {
      tabList.setAttribute('aria-orientation', 'vertical');
    }
    
    return tabList;
  }
  
  /**
   * Set parent tabs component
   * @param {Tabs} parent - Parent tabs
   */
  setParent(parent) {
    this.parent = parent;
    
    // Update orientation
    if (parent.options.orientation === 'vertical') {
      this.element.setAttribute('aria-orientation', 'vertical');
    }
  }
  
  /**
   * Add tab to list
   * @param {Tab} tab - Tab component
   */
  addTab(tab) {
    const index = this.tabs.length;
    tab.setIndex(index);
    tab.setParent(this);
    
    // Set initial active state
    if (index === this.parent?.getActiveIndex()) {
      tab.setActive(true);
    }
    
    this.tabs.push(tab);
    this.element.appendChild(tab.getElement());
  }
  
  /**
   * Set active tab
   * @param {number} index - Tab index
   */
  setActiveTab(index) {
    this.tabs.forEach((tab, i) => {
      tab.setActive(i === index);
    });
  }
  
  /**
   * Handle keyboard navigation
   * @param {number} currentIndex - Current tab index
   * @param {string} direction - Navigation direction
   */
  navigate(currentIndex, direction) {
    let newIndex = currentIndex;
    
    switch (direction) {
      case 'next':
        newIndex = (currentIndex + 1) % this.tabs.length;
        break;
      case 'previous':
        newIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
        break;
      case 'first':
        newIndex = 0;
        break;
      case 'last':
        newIndex = this.tabs.length - 1;
        break;
    }
    
    // Find next non-disabled tab
    let attempts = 0;
    while (this.tabs[newIndex].isDisabled() && attempts < this.tabs.length) {
      if (direction === 'next') {
        newIndex = (newIndex + 1) % this.tabs.length;
      } else {
        newIndex = (newIndex - 1 + this.tabs.length) % this.tabs.length;
      }
      attempts++;
    }
    
    if (!this.tabs[newIndex].isDisabled()) {
      this.parent.setActiveTab(newIndex);
      this.tabs[newIndex].focus();
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
    this.tabs.forEach(tab => tab.destroy());
    this.element.remove();
  }
}

/**
 * Individual tab component
 * @class
 */
export class Tab {
  constructor(options = {}) {
    this.options = {
      label: '',
      icon: null,
      disabled: false,
      className: '',
      ...options
    };
    
    this.index = 0;
    this.parent = null;
    this.active = false;
    this.element = this.createElement();
    this.bindEvents();
  }
  
  /**
   * Create tab element
   * @private
   */
  createElement() {
    const tab = document.createElement('button');
    tab.className = ['tab', this.options.className].filter(Boolean).join(' ');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
    
    if (this.options.disabled) {
      tab.disabled = true;
      tab.classList.add('tab-disabled');
    }
    
    // Add icon
    if (this.options.icon) {
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      if (typeof this.options.icon === 'string') {
        icon.innerHTML = this.options.icon;
      } else {
        icon.appendChild(this.options.icon);
      }
      tab.appendChild(icon);
    }
    
    // Add label
    if (this.options.label) {
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = this.options.label;
      tab.appendChild(label);
    }
    
    return tab;
  }
  
  /**
   * Bind event handlers
   * @private
   */
  bindEvents() {
    // Click handler
    this.element.addEventListener('click', () => {
      if (!this.options.disabled && this.parent) {
        this.parent.parent.setActiveTab(this.index);
      }
    });
    
    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      if (this.options.disabled || !this.parent) return;
      
      const isVertical = this.parent.parent.options.orientation === 'vertical';
      
      switch (e.key) {
        case 'ArrowRight':
          if (!isVertical) {
            e.preventDefault();
            this.parent.navigate(this.index, 'next');
          }
          break;
        case 'ArrowLeft':
          if (!isVertical) {
            e.preventDefault();
            this.parent.navigate(this.index, 'previous');
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            this.parent.navigate(this.index, 'next');
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            this.parent.navigate(this.index, 'previous');
          }
          break;
        case 'Home':
          e.preventDefault();
          this.parent.navigate(this.index, 'first');
          break;
        case 'End':
          e.preventDefault();
          this.parent.navigate(this.index, 'last');
          break;
      }
    });
  }
  
  /**
   * Set tab index
   * @param {number} index - Tab index
   */
  setIndex(index) {
    this.index = index;
    this.element.id = `tab-${index}`;
    this.element.setAttribute('aria-controls', `tabpanel-${index}`);
  }
  
  /**
   * Set parent tab list
   * @param {TabList} parent - Parent tab list
   */
  setParent(parent) {
    this.parent = parent;
  }
  
  /**
   * Set active state
   * @param {boolean} active - Active state
   */
  setActive(active) {
    this.active = active;
    this.element.setAttribute('aria-selected', active.toString());
    this.element.setAttribute('tabindex', active ? '0' : '-1');
    
    if (active) {
      this.element.classList.add('tab-active');
    } else {
      this.element.classList.remove('tab-active');
    }
  }
  
  /**
   * Check if tab is disabled
   * @returns {boolean} Disabled state
   */
  isDisabled() {
    return this.options.disabled;
  }
  
  /**
   * Focus the tab
   */
  focus() {
    this.element.focus();
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
 * Tab panels container
 * @class
 */
export class TabPanels {
  constructor(options = {}) {
    this.options = {
      className: '',
      ...options
    };
    
    this.parent = null;
    this.panels = [];
    this.element = this.createElement();
  }
  
  /**
   * Create panels container
   * @private
   */
  createElement() {
    const container = document.createElement('div');
    container.className = ['tab-panels', this.options.className].filter(Boolean).join(' ');
    return container;
  }
  
  /**
   * Set parent tabs component
   * @param {Tabs} parent - Parent tabs
   */
  setParent(parent) {
    this.parent = parent;
  }
  
  /**
   * Add panel
   * @param {TabPanel} panel - Panel component
   */
  addPanel(panel) {
    const index = this.panels.length;
    panel.setIndex(index);
    
    // Set initial visibility
    if (index === this.parent?.getActiveIndex()) {
      panel.setActive(true);
    }
    
    this.panels.push(panel);
    this.element.appendChild(panel.getElement());
  }
  
  /**
   * Set active panel
   * @param {number} index - Panel index
   */
  setActivePanel(index) {
    this.panels.forEach((panel, i) => {
      panel.setActive(i === index);
    });
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
    this.panels.forEach(panel => panel.destroy());
    this.element.remove();
  }
}

/**
 * Individual tab panel
 * @class
 */
export class TabPanel {
  constructor(options = {}) {
    this.options = {
      content: '',
      className: '',
      ...options
    };
    
    this.index = 0;
    this.active = false;
    this.element = this.createElement();
  }
  
  /**
   * Create panel element
   * @private
   */
  createElement() {
    const panel = document.createElement('div');
    panel.className = ['tab-panel', this.options.className].filter(Boolean).join(' ');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('tabindex', '0');
    panel.hidden = true;
    
    this.setContent(this.options.content);
    
    return panel;
  }
  
  /**
   * Set panel index
   * @param {number} index - Panel index
   */
  setIndex(index) {
    this.index = index;
    this.element.id = `tabpanel-${index}`;
    this.element.setAttribute('aria-labelledby', `tab-${index}`);
  }
  
  /**
   * Set active state
   * @param {boolean} active - Active state
   */
  setActive(active) {
    this.active = active;
    this.element.hidden = !active;
    
    if (active) {
      this.element.classList.add('tab-panel-active');
    } else {
      this.element.classList.remove('tab-panel-active');
    }
  }
  
  /**
   * Set panel content
   * @param {string|HTMLElement} content - Panel content
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

// Helper function to create tabs
export function createTabs(options) {
  const tabs = new Tabs(options);
  const tabList = new TabList();
  const tabPanels = new TabPanels();
  
  tabs.setTabList(tabList);
  tabs.setTabPanels(tabPanels);
  
  return { tabs, tabList, tabPanels };
}

// CSS styles for tabs
export const tabStyles = `
/* Tabs Container */
.tabs {
  width: 100%;
}

.tabs-horizontal {
  display: flex;
  flex-direction: column;
}

.tabs-vertical {
  display: flex;
  flex-direction: row;
  gap: var(--spacing-6);
}

/* Tab List */
.tab-list {
  display: flex;
  position: relative;
}

.tabs-horizontal .tab-list {
  flex-direction: row;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.tabs-vertical .tab-list {
  flex-direction: column;
  border-right: 1px solid var(--border);
  min-width: 200px;
}

/* Tab Button */
.tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  background: transparent;
  border: none;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-200) var(--ease-out);
  position: relative;
  outline: none;
}

.tab:hover:not(:disabled) {
  color: var(--text-primary);
}

.tab:focus-visible {
  box-shadow: inset 0 0 0 2px var(--ring);
  z-index: 1;
}

.tab-active {
  color: var(--primary);
}

.tab-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Tab Icon */
.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
}

.tab-icon svg {
  width: 100%;
  height: 100%;
}

/* Tab Variants */
/* Default variant */
.tabs-default .tab-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--primary);
}

.tabs-horizontal.tabs-default .tab-active::after {
  bottom: -1px;
}

.tabs-vertical.tabs-default .tab-active::after {
  top: 0;
  bottom: 0;
  right: -1px;
  width: 2px;
  height: auto;
}

/* Pills variant */
.tabs-pills .tab {
  border-radius: var(--radius-md);
  margin: var(--spacing-1);
}

.tabs-pills .tab-active {
  background-color: var(--primary);
  color: var(--primary-foreground);
}

.tabs-pills .tab:hover:not(:disabled):not(.tab-active) {
  background-color: var(--muted);
}

/* Underline variant */
.tabs-underline .tab-list {
  border-bottom: none;
  gap: var(--spacing-4);
}

.tabs-underline .tab {
  padding-bottom: var(--spacing-3);
  border-bottom: 2px solid transparent;
}

.tabs-underline .tab-active {
  border-bottom-color: var(--primary);
}

/* Tab Sizes */
.tabs-small .tab {
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--text-sm);
}

.tabs-large .tab {
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--text-lg);
}

/* Tab Panels */
.tab-panels {
  flex: 1;
}

.tab-panel {
  padding: var(--spacing-6);
  outline: none;
}

.tab-panel:focus-visible {
  box-shadow: inset 0 0 0 2px var(--ring);
}

.tabs-vertical .tab-panel {
  padding-left: 0;
}

/* Animations */
.tab-panel {
  animation: tab-panel-enter var(--duration-200) var(--ease-out);
}

@keyframes tab-panel-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .tabs-vertical {
    flex-direction: column;
  }
  
  .tabs-vertical .tab-list {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border);
    min-width: auto;
    overflow-x: auto;
  }
  
  .tabs-vertical.tabs-default .tab-active::after {
    bottom: -1px;
    right: 0;
    width: auto;
    height: 2px;
  }
  
  .tabs-vertical .tab-panel {
    padding-left: var(--spacing-6);
  }
}

/* Scrollbar styling */
.tab-list::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}

.tab-list::-webkit-scrollbar-track {
  background: var(--muted);
}

.tab-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-full);
}

.tab-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
`;