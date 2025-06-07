// Tooltip Component
// Phase 6: UI Redesign - Helpful tooltips for user guidance

export class Tooltip {
  constructor(options = {}) {
    this.options = {
      content: '',
      trigger: 'hover', // hover, click, focus
      placement: 'top', // top, bottom, left, right
      delay: 200,
      offset: 8,
      ...options
    };
    
    this.isVisible = false;
    this.tooltip = null;
    this.target = null;
    this.showTimeout = null;
    this.hideTimeout = null;
  }
  
  attach(targetElement) {
    this.target = targetElement;
    this.target.setAttribute('aria-describedby', this.getTooltipId());
    
    if (this.options.trigger === 'hover') {
      this.target.addEventListener('mouseenter', this.show.bind(this));
      this.target.addEventListener('mouseleave', this.hide.bind(this));
    } else if (this.options.trigger === 'click') {
      this.target.addEventListener('click', this.toggle.bind(this));
    } else if (this.options.trigger === 'focus') {
      this.target.addEventListener('focus', this.show.bind(this));
      this.target.addEventListener('blur', this.hide.bind(this));
    }
    
    // Keyboard support
    this.target.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }
  
  getTooltipId() {
    return `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'ds-tooltip';
    this.tooltip.id = this.getTooltipId();
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.innerHTML = this.options.content;
    
    // Add arrow
    const arrow = document.createElement('div');
    arrow.className = 'ds-tooltip-arrow';
    this.tooltip.appendChild(arrow);
    
    document.body.appendChild(this.tooltip);
  }
  
  positionTooltip() {
    if (!this.tooltip || !this.target) return;
    
    const targetRect = this.target.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const { placement, offset } = this.options;
    
    let top = 0;
    let left = 0;
    
    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + offset;
        break;
    }
    
    // Keep tooltip within viewport
    const padding = 10;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }
    
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    
    // Position arrow
    const arrow = this.tooltip.querySelector('.ds-tooltip-arrow');
    arrow.className = `ds-tooltip-arrow ds-tooltip-arrow-${placement}`;
  }
  
  show() {
    clearTimeout(this.hideTimeout);
    
    this.showTimeout = setTimeout(() => {
      if (!this.tooltip) {
        this.createTooltip();
      }
      
      this.tooltip.style.display = 'block';
      requestAnimationFrame(() => {
        this.positionTooltip();
        this.tooltip.classList.add('ds-tooltip-visible');
      });
      
      this.isVisible = true;
    }, this.options.delay);
  }
  
  hide() {
    clearTimeout(this.showTimeout);
    
    this.hideTimeout = setTimeout(() => {
      if (this.tooltip) {
        this.tooltip.classList.remove('ds-tooltip-visible');
        setTimeout(() => {
          if (this.tooltip) {
            this.tooltip.style.display = 'none';
          }
        }, 200);
      }
      
      this.isVisible = false;
    }, 100);
  }
  
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  destroy() {
    this.hide();
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    
    // Remove event listeners
    if (this.target) {
      this.target.removeEventListener('mouseenter', this.show);
      this.target.removeEventListener('mouseleave', this.hide);
      this.target.removeEventListener('click', this.toggle);
      this.target.removeEventListener('focus', this.show);
      this.target.removeEventListener('blur', this.hide);
    }
  }
  
  static getStyles() {
    return `
      .ds-tooltip {
        position: fixed;
        z-index: 9999;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-gray-900);
        color: white;
        font-size: var(--text-sm);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        opacity: 0;
        transition: opacity var(--duration-200) var(--ease-out);
        pointer-events: none;
        max-width: 250px;
        word-wrap: break-word;
        display: none;
      }
      
      .ds-tooltip-visible {
        opacity: 1;
      }
      
      .ds-tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border: 5px solid transparent;
      }
      
      .ds-tooltip-arrow-top {
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-top-color: var(--color-gray-900);
      }
      
      .ds-tooltip-arrow-bottom {
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: var(--color-gray-900);
      }
      
      .ds-tooltip-arrow-left {
        right: -10px;
        top: 50%;
        transform: translateY(-50%);
        border-left-color: var(--color-gray-900);
      }
      
      .ds-tooltip-arrow-right {
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        border-right-color: var(--color-gray-900);
      }
    `;
  }
}

// Helper function to create tooltips
export function createTooltip(targetElement, options) {
  const tooltip = new Tooltip(options);
  tooltip.attach(targetElement);
  return tooltip;
}