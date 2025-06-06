// PricingMatrix - Reusable pricing matrix display component
// Handles pricing table rendering with tier highlighting and responsive design

import { Logger } from '../utils/logger';
import { EventBus } from '../utils/event-bus';

export class PricingMatrix {
  constructor(options = {}) {
    this.logger = new Logger('PricingMatrix');
    this.eventBus = options.eventBus || new EventBus();
    
    // Configuration
    this.config = {
      container: options.container || '#pricing-matrix',
      showTierLabels: options.showTierLabels !== false,
      highlightActiveTier: options.highlightActiveTier !== false,
      enableHover: options.enableHover !== false,
      compactMode: options.compactMode || false,
      currency: options.currency || 'USD',
      locale: options.locale || 'en-US',
      ...options.config
    };
    
    // State
    this.pricingData = null;
    this.currentQuantity = 0;
    this.activeTier = null;
    this.container = null;
    this.initialized = false;
  }
  
  // Initialize the pricing matrix
  async initialize() {
    this.logger.debug('Initializing pricing matrix');
    
    // Find container
    this.container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container)
      : this.config.container;
      
    if (!this.container) {
      throw new Error('Pricing matrix container not found');
    }
    
    // Set up container
    this.setupContainer();
    
    // Load pricing data if provided
    if (this.config.pricingData) {
      this.setPricingData(this.config.pricingData);
    }
    
    this.initialized = true;
    this.eventBus.emit('pricingMatrix:initialized');
  }
  
  // Set up container
  setupContainer() {
    this.container.classList.add('pricing-matrix');
    if (this.config.compactMode) {
      this.container.classList.add('compact');
    }
    
    // Add styles
    this.addStyles();
  }
  
  // Add component styles
  addStyles() {
    const styles = `
      .pricing-matrix {
        width: 100%;
        overflow-x: auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .pricing-matrix-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      
      .pricing-matrix.compact .pricing-matrix-table {
        font-size: 13px;
      }
      
      .pricing-matrix-table th,
      .pricing-matrix-table td {
        padding: 12px;
        text-align: center;
        border: 1px solid #e0e0e0;
      }
      
      .pricing-matrix.compact .pricing-matrix-table th,
      .pricing-matrix.compact .pricing-matrix-table td {
        padding: 8px;
      }
      
      .pricing-matrix-table thead th {
        background-color: #2e5827;
        color: white;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .pricing-matrix-table tbody th {
        background-color: #f8f9fa;
        font-weight: 600;
        text-align: left;
        white-space: nowrap;
      }
      
      .pricing-matrix-table tbody td {
        background-color: white;
        transition: all 0.2s ease;
      }
      
      .pricing-matrix-table tbody tr:hover td {
        background-color: #f0f5ef;
      }
      
      .pricing-matrix-table .price-cell {
        font-weight: 500;
        position: relative;
      }
      
      .pricing-matrix-table .price-cell.active-tier {
        background-color: #2e5827 !important;
        color: white;
        font-weight: 700;
      }
      
      .pricing-matrix-table .price-cell.active-tier::after {
        content: '✓';
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 12px;
      }
      
      .pricing-matrix-table .price-cell.hover-preview {
        background-color: #e8f5e9;
        cursor: pointer;
      }
      
      .pricing-matrix-header {
        padding: 20px;
        background-color: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .pricing-matrix-header h3 {
        margin: 0 0 10px 0;
        color: #2e5827;
      }
      
      .pricing-matrix-legend {
        display: flex;
        gap: 20px;
        margin-top: 15px;
        font-size: 13px;
      }
      
      .pricing-matrix-legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .pricing-matrix-legend-color {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        border: 1px solid #ddd;
      }
      
      .tier-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .tier-range {
        font-weight: 600;
      }
      
      .tier-description {
        font-size: 12px;
        color: #666;
      }
      
      .ltm-indicator {
        display: inline-block;
        padding: 2px 6px;
        background-color: #fff3cd;
        color: #856404;
        font-size: 11px;
        border-radius: 3px;
        margin-left: 5px;
      }
      
      .savings-badge {
        display: inline-block;
        padding: 2px 6px;
        background-color: #d4edda;
        color: #155724;
        font-size: 11px;
        border-radius: 3px;
        margin-left: 5px;
      }
      
      .pricing-matrix-footer {
        padding: 15px 20px;
        background-color: #f8f9fa;
        border-top: 1px solid #e0e0e0;
        font-size: 13px;
        color: #666;
      }
      
      .pricing-matrix-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
      }
      
      .pricing-matrix-empty {
        text-align: center;
        padding: 60px;
        color: #999;
      }
      
      /* Responsive */
      @media (max-width: 768px) {
        .pricing-matrix-table {
          font-size: 12px;
        }
        
        .pricing-matrix-table th,
        .pricing-matrix-table td {
          padding: 8px 6px;
        }
        
        .tier-description {
          display: none;
        }
      }
      
      /* Print styles */
      @media print {
        .pricing-matrix {
          box-shadow: none;
          page-break-inside: avoid;
        }
        
        .pricing-matrix-table thead th {
          background-color: #2e5827 !important;
          color: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .pricing-matrix-table .price-cell.active-tier {
          background-color: #2e5827 !important;
          color: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;
    
    // Add styles to page if not already present
    if (!document.getElementById('pricing-matrix-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'pricing-matrix-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }
  
  // Set pricing data
  setPricingData(data) {
    this.logger.debug('Setting pricing data:', data);
    
    this.pricingData = data;
    this.render();
    
    this.eventBus.emit('pricingMatrix:dataSet', {
      data: this.pricingData
    });
  }
  
  // Render the pricing matrix
  render() {
    if (!this.container) return;
    
    if (!this.pricingData) {
      this.showEmpty();
      return;
    }
    
    // Extract data structure
    const { headers, tiers, prices } = this.extractDataStructure();
    
    if (headers.length === 0 || tiers.length === 0) {
      this.showEmpty();
      return;
    }
    
    // Build matrix HTML
    let html = '';
    
    // Add header if configured
    if (this.config.showHeader) {
      html += this.renderHeader();
    }
    
    // Add table
    html += '<div class="pricing-matrix-wrapper">';
    html += '<table class="pricing-matrix-table">';
    
    // Table header
    html += '<thead><tr>';
    html += '<th>Quantity</th>';
    headers.forEach(header => {
      html += `<th>${this.escapeHtml(header)}</th>`;
    });
    html += '</tr></thead>';
    
    // Table body
    html += '<tbody>';
    tiers.forEach(tier => {
      html += this.renderTierRow(tier, headers, prices);
    });
    html += '</tbody>';
    
    html += '</table>';
    html += '</div>';
    
    // Add footer if configured
    if (this.config.showFooter) {
      html += this.renderFooter();
    }
    
    this.container.innerHTML = html;
    
    // Set up interactions
    this.setupInteractions();
  }
  
  // Extract data structure from pricing data
  extractDataStructure() {
    let headers = [];
    let tiers = [];
    let prices = {};
    
    // Handle different data formats
    if (this.pricingData.headers && this.pricingData.prices) {
      // Format 1: Explicit headers and prices
      headers = this.pricingData.headers;
      prices = this.pricingData.prices;
      
      // Extract tiers from tier data or price structure
      if (this.pricingData.tiers || this.pricingData.tierData) {
        const tierData = this.pricingData.tiers || this.pricingData.tierData;
        tiers = Object.entries(tierData).map(([key, value]) => ({
          key,
          ...value
        }));
      } else {
        // Extract from first size
        const firstSize = headers[0];
        if (prices[firstSize]) {
          tiers = Object.keys(prices[firstSize]).map(tierKey => ({
            key: tierKey,
            label: tierKey
          }));
        }
      }
    } else if (Array.isArray(this.pricingData)) {
      // Format 2: Array of tier objects
      this.pricingData.forEach(tier => {
        if (!tiers.find(t => t.key === tier.tier)) {
          tiers.push({
            key: tier.tier,
            label: tier.tier,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity
          });
        }
        
        if (!headers.includes(tier.size)) {
          headers.push(tier.size);
        }
        
        if (!prices[tier.size]) prices[tier.size] = {};
        prices[tier.size][tier.tier] = tier.price;
      });
    } else {
      // Format 3: Direct size -> tier -> price mapping
      headers = Object.keys(this.pricingData);
      if (headers.length > 0) {
        const firstSize = headers[0];
        tiers = Object.keys(this.pricingData[firstSize]).map(tierKey => ({
          key: tierKey,
          label: tierKey
        }));
        prices = this.pricingData;
      }
    }
    
    // Sort tiers by minimum quantity
    tiers.sort((a, b) => {
      const aMin = a.minQuantity || parseInt(a.key) || 0;
      const bMin = b.minQuantity || parseInt(b.key) || 0;
      return aMin - bMin;
    });
    
    return { headers, tiers, prices };
  }
  
  // Render tier row
  renderTierRow(tier, headers, prices) {
    let html = '<tr>';
    
    // Tier label cell
    html += '<th>';
    if (this.config.showTierLabels) {
      html += '<div class="tier-label">';
      html += `<span class="tier-range">${this.formatTierLabel(tier)}</span>`;
      
      if (tier.description) {
        html += `<span class="tier-description">${tier.description}</span>`;
      }
      
      if (tier.ltmFee || tier.LTM_Fee) {
        html += `<span class="ltm-indicator">+$${tier.ltmFee || tier.LTM_Fee} LTM</span>`;
      }
      
      html += '</div>';
    } else {
      html += this.formatTierLabel(tier);
    }
    html += '</th>';
    
    // Price cells
    headers.forEach(header => {
      const price = prices[header] && prices[header][tier.key];
      const isActive = this.isActiveTier(tier);
      
      html += `<td class="price-cell${isActive ? ' active-tier' : ''}" 
                   data-tier="${tier.key}" 
                   data-size="${header}"
                   data-price="${price || 0}">`;
      
      if (price !== undefined && price !== null) {
        html += this.formatPrice(price);
        
        // Add savings indicator
        if (tier.savings) {
          html += `<span class="savings-badge">${tier.savings}% off</span>`;
        }
      } else {
        html += '-';
      }
      
      html += '</td>';
    });
    
    html += '</tr>';
    return html;
  }
  
  // Format tier label
  formatTierLabel(tier) {
    if (tier.label) {
      return tier.label;
    }
    
    if (tier.minQuantity !== undefined) {
      if (tier.maxQuantity && tier.maxQuantity !== Infinity) {
        return `${tier.minQuantity}-${tier.maxQuantity}`;
      } else {
        return `${tier.minQuantity}+`;
      }
    }
    
    return tier.key;
  }
  
  // Check if tier is active
  isActiveTier(tier) {
    if (!this.config.highlightActiveTier) return false;
    
    if (this.activeTier) {
      return tier.key === this.activeTier;
    }
    
    if (this.currentQuantity && tier.minQuantity !== undefined) {
      const max = tier.maxQuantity || Infinity;
      return this.currentQuantity >= tier.minQuantity && this.currentQuantity <= max;
    }
    
    return false;
  }
  
  // Format price
  formatPrice(price) {
    const formatter = new Intl.NumberFormat(this.config.locale, {
      style: 'currency',
      currency: this.config.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return formatter.format(price);
  }
  
  // Render header section
  renderHeader() {
    return `
      <div class="pricing-matrix-header">
        <h3>Pricing Matrix</h3>
        ${this.currentQuantity ? `<p>Current quantity: <strong>${this.currentQuantity}</strong></p>` : ''}
        <div class="pricing-matrix-legend">
          <div class="pricing-matrix-legend-item">
            <div class="pricing-matrix-legend-color" style="background-color: #2e5827;"></div>
            <span>Your Price</span>
          </div>
          <div class="pricing-matrix-legend-item">
            <div class="pricing-matrix-legend-color" style="background-color: #fff3cd;"></div>
            <span>Less Than Minimum Fee Applies</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Render footer section
  renderFooter() {
    return `
      <div class="pricing-matrix-footer">
        <p>* Prices shown are per unit. Minimum order quantities may apply.</p>
        ${this.pricingData.notes ? `<p>${this.pricingData.notes}</p>` : ''}
      </div>
    `;
  }
  
  // Show empty state
  showEmpty() {
    this.container.innerHTML = `
      <div class="pricing-matrix-empty">
        <p>No pricing data available</p>
      </div>
    `;
  }
  
  // Show loading state
  showLoading() {
    this.container.innerHTML = `
      <div class="pricing-matrix-loading">
        <div class="spinner"></div>
      </div>
    `;
  }
  
  // Set up interactions
  setupInteractions() {
    if (!this.config.enableHover) return;
    
    // Add hover effects
    const priceCells = this.container.querySelectorAll('.price-cell');
    priceCells.forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        const tier = cell.dataset.tier;
        const size = cell.dataset.size;
        const price = cell.dataset.price;
        
        cell.classList.add('hover-preview');
        
        this.eventBus.emit('pricingMatrix:cellHover', {
          tier,
          size,
          price: parseFloat(price)
        });
      });
      
      cell.addEventListener('mouseleave', () => {
        cell.classList.remove('hover-preview');
      });
      
      cell.addEventListener('click', () => {
        const tier = cell.dataset.tier;
        const size = cell.dataset.size;
        const price = cell.dataset.price;
        
        this.eventBus.emit('pricingMatrix:cellClick', {
          tier,
          size,
          price: parseFloat(price)
        });
      });
    });
  }
  
  // Update current quantity
  setCurrentQuantity(quantity) {
    this.currentQuantity = quantity;
    
    // Update active tier highlighting
    const { tiers } = this.extractDataStructure();
    let newActiveTier = null;
    
    for (const tier of tiers) {
      if (tier.minQuantity !== undefined) {
        const max = tier.maxQuantity || Infinity;
        if (quantity >= tier.minQuantity && quantity <= max) {
          newActiveTier = tier.key;
          break;
        }
      }
    }
    
    if (newActiveTier !== this.activeTier) {
      this.activeTier = newActiveTier;
      this.updateActiveTierHighlight();
    }
    
    this.eventBus.emit('pricingMatrix:quantityChanged', {
      quantity,
      activeTier: this.activeTier
    });
  }
  
  // Update active tier highlighting
  updateActiveTierHighlight() {
    const priceCells = this.container.querySelectorAll('.price-cell');
    
    priceCells.forEach(cell => {
      if (cell.dataset.tier === this.activeTier) {
        cell.classList.add('active-tier');
      } else {
        cell.classList.remove('active-tier');
      }
    });
  }
  
  // Export pricing data
  exportData(format = 'csv') {
    const { headers, tiers, prices } = this.extractDataStructure();
    
    switch (format) {
      case 'csv':
        return this.exportCSV(headers, tiers, prices);
      case 'json':
        return JSON.stringify({ headers, tiers, prices }, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  // Export as CSV
  exportCSV(headers, tiers, prices) {
    const rows = [];
    
    // Header row
    rows.push(['Quantity', ...headers].join(','));
    
    // Data rows
    tiers.forEach(tier => {
      const row = [this.formatTierLabel(tier)];
      headers.forEach(header => {
        const price = prices[header] && prices[header][tier.key];
        row.push(price || '');
      });
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }
  
  // Escape HTML
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  // Destroy the component
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.remove('pricing-matrix', 'compact');
    }
    
    this.pricingData = null;
    this.currentQuantity = 0;
    this.activeTier = null;
    this.initialized = false;
    
    this.logger.debug('Pricing matrix destroyed');
  }
}