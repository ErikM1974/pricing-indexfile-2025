/**
 * Universal Pricing Grid Component
 * A modular component for displaying pricing tiers with inventory indicators
 * Supports loading animations, inventory checking, and dynamic updates
 */

class UniversalPricingGrid {
    constructor(config = {}) {
        // Configuration
        this.config = {
            containerId: config.containerId || 'pricing-grid-container',
            showInventory: config.showInventory !== false,
            inventoryThreshold: config.inventoryThreshold || 10,
            loadingAnimation: config.loadingAnimation !== false,
            showColorIndicator: config.showColorIndicator !== false,
            onTierClick: config.onTierClick || null,
            apiBaseUrl: config.apiBaseUrl || window.API_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
            ...config
        };

        // State
        this.state = {
            pricingData: null,
            inventoryData: null,
            selectedColor: null,
            selectedColorSwatch: null,
            isLoading: false,
            loadingStep: 0
        };

        // Initialize
        this.initialize();
    }

    initialize() {
        console.log('[UniversalPricingGrid] Initializing with config:', this.config);
        
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }

        // Listen for events
        this.setupEventListeners();
    }

    render() {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error('[UniversalPricingGrid] Container not found:', this.config.containerId);
            return;
        }

        // Generate initial HTML structure
        container.innerHTML = this.generateHTML();
        
        // Cache elements
        this.cacheElements();
        
        // Show initial loading state if configured
        if (this.config.loadingAnimation) {
            this.showLoading();
        }
    }

    generateHTML() {
        return `
            <div class="universal-pricing-grid">
                ${this.config.showColorIndicator ? this.generateColorIndicatorHTML() : ''}
                
                <div class="pricing-grid-container">
                    <!-- Initial loading state -->
                    <div id="${this.config.containerId}-initial-state" class="enhanced-loading-container" style="display: ${this.config.loadingAnimation ? 'block' : 'none'};">
                        <div class="loading-content">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2e5827" stroke-width="2" style="margin-bottom: 20px;">
                                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                                <path d="M12 8v4m0 4h.01"/>
                            </svg>
                            <h3 style="color: #2e5827; font-size: 1.5em; margin: 0 0 10px 0; font-weight: 600;">Loading Pricing</h3>
                            <p style="color: #666; margin: 0; font-size: 1.1em;">Preparing your custom pricing data...</p>
                        </div>
                    </div>
                    
                    <!-- Enhanced loading state -->
                    <div id="${this.config.containerId}-loading" style="display: none;">
                        <div class="enhanced-loading-container">
                            <div class="loading-content">
                                <div class="loading-spinner-dual">
                                    <div class="loading-spinner-outer"></div>
                                    <div class="loading-spinner-inner"></div>
                                </div>
                                <div class="loading-status" id="${this.config.containerId}-loading-status">Loading your custom pricing...</div>
                                <div class="loading-step" id="${this.config.containerId}-loading-step">Connecting to pricing database...</div>
                                <div class="loading-progress">
                                    <div class="loading-progress-bar" id="${this.config.containerId}-loading-progress" style="width: 0%;"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Skeleton table preview -->
                        <div style="margin-top: 20px;">
                            <div class="skeleton-table">
                                ${this.generateSkeletonRows()}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actual pricing table -->
                    <table class="pricing-grid" id="${this.config.containerId}-table" style="display: none; opacity: 0; transform: translateY(20px); transition: all 0.5s ease;">
                        <thead>
                            <tr id="${this.config.containerId}-header-row">
                                <th>Quantity</th>
                                <!-- Size headers will be dynamically populated -->
                            </tr>
                        </thead>
                        <tbody id="${this.config.containerId}-tbody">
                            <!-- Pricing data will be dynamically added here -->
                        </tbody>
                    </table>
                    
                    <!-- Pricing notes -->
                    <div class="pricing-explanation" style="margin-top: 10px; font-size: 0.9em; color: #666; display: none;" id="${this.config.containerId}-notes">
                        <p><strong>Note:</strong> <span id="${this.config.containerId}-pricing-note">Prices shown are per item.</span></p>
                    </div>
                    
                    ${this.config.showInventory ? this.generateInventoryLegendHTML() : ''}
                </div>
            </div>
        `;
    }

    generateColorIndicatorHTML() {
        return `
            <div class="pricing-header" style="margin-bottom: 20px;">
                <h3 class="section-title" style="font-size: 1.3em; margin: 0;">Detailed Pricing Tiers</h3>
                <div class="selected-color-indicator">
                    <span>Selected Color:</span>
                    <div class="mini-color-swatch clickable" id="${this.config.containerId}-color-swatch" title="Click to view this color"></div>
                    <strong id="${this.config.containerId}-color-name">Color Name</strong>
                </div>
            </div>
        `;
    }

    generateInventoryLegendHTML() {
        return `
            <div class="inventory-indicator-legend" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 0.85em; display: none;">
                <span style="font-weight: bold;">Inventory Status:</span>
                <span class="legend-item">
                    <span class="inventory-indicator inventory-low" style="position: relative; top: 2px;"></span> Low Stock
                </span>
                <span class="legend-item" style="margin-left: 15px;">
                    <span class="inventory-indicator inventory-none" style="position: relative; top: 2px;"></span> Out of Stock
                </span>
            </div>
        `;
    }

    generateSkeletonRows() {
        let html = '';
        for (let i = 0; i < 5; i++) {
            html += `
                <div class="skeleton-row ${i === 0 ? 'skeleton-header' : ''}">
                    <div class="skeleton-cell"></div>
                    <div class="skeleton-cell"></div>
                    <div class="skeleton-cell"></div>
                    <div class="skeleton-cell"></div>
                </div>
            `;
        }
        return html;
    }

    cacheElements() {
        const containerId = this.config.containerId;
        this.elements = {
            container: document.getElementById(containerId),
            initialState: document.getElementById(`${containerId}-initial-state`),
            loadingState: document.getElementById(`${containerId}-loading`),
            loadingStatus: document.getElementById(`${containerId}-loading-status`),
            loadingStep: document.getElementById(`${containerId}-loading-step`),
            loadingProgress: document.getElementById(`${containerId}-loading-progress`),
            table: document.getElementById(`${containerId}-table`),
            headerRow: document.getElementById(`${containerId}-header-row`),
            tbody: document.getElementById(`${containerId}-tbody`),
            notes: document.getElementById(`${containerId}-notes`),
            pricingNote: document.getElementById(`${containerId}-pricing-note`),
            colorSwatch: document.getElementById(`${containerId}-color-swatch`),
            colorName: document.getElementById(`${containerId}-color-name`),
            inventoryLegend: document.querySelector('.inventory-indicator-legend')
        };
    }

    setupEventListeners() {
        // Listen for pricing data updates
        window.addEventListener('pricingDataLoaded', (event) => {
            console.log('[UniversalPricingGrid] Pricing data loaded event received');
            this.updatePricingData(event.detail);
        });

        // Listen for color changes
        window.addEventListener('colorChanged', (event) => {
            console.log('[UniversalPricingGrid] Color changed event received');
            if (event.detail) {
                this.updateSelectedColor(event.detail.COLOR_NAME, event.detail);
            }
        });

        // Setup mini color swatch click handler
        if (this.elements.colorSwatch) {
            this.elements.colorSwatch.addEventListener('click', () => {
                this.handleColorSwatchClick();
            });
        }

        // Initialize color from global state if available
        if (window.selectedColorName && this.config.showColorIndicator) {
            console.log('[UniversalPricingGrid] Initializing color from global state:', window.selectedColorName);
            const colorData = {
                COLOR_NAME: window.selectedColorName,
                HEX_CODE: window.selectedColorHex || null,
                COLOR_SQUARE_IMAGE: window.selectedColorImage || null
            };
            this.updateSelectedColor(window.selectedColorName, colorData);
        }
    }

    showLoading() {
        this.state.isLoading = true;
        
        if (this.elements.initialState) {
            this.elements.initialState.style.display = 'none';
        }
        if (this.elements.loadingState) {
            this.elements.loadingState.style.display = 'block';
        }
        if (this.elements.table) {
            this.elements.table.style.display = 'none';
        }

        // Start loading animation
        this.animateLoading();
    }

    animateLoading() {
        const loadingSteps = [
            { progress: 15, status: 'Loading your custom pricing...', step: 'Connecting to pricing database...' },
            { progress: 30, status: 'Processing your request...', step: 'Fetching pricing data...' },
            { progress: 50, status: 'Calculating pricing tiers...', step: 'Processing quantity discounts...' },
            { progress: 70, status: 'Loading size information...', step: 'Preparing size-specific pricing...' },
            { progress: 85, status: 'Finalizing your pricing...', step: 'Applying final calculations...' },
            { progress: 100, status: 'Complete!', step: 'Your pricing is ready' }
        ];

        let currentStep = 0;
        
        const updateProgress = () => {
            if (!this.state.isLoading || currentStep >= loadingSteps.length) return;
            
            const step = loadingSteps[currentStep];
            if (this.elements.loadingStatus) {
                this.elements.loadingStatus.textContent = step.status;
            }
            if (this.elements.loadingStep) {
                this.elements.loadingStep.textContent = step.step;
            }
            if (this.elements.loadingProgress) {
                this.elements.loadingProgress.style.width = step.progress + '%';
            }
            
            currentStep++;
            
            if (currentStep < loadingSteps.length && this.state.isLoading) {
                setTimeout(updateProgress, 800 + Math.random() * 400);
            }
        };
        
        setTimeout(updateProgress, 500);
    }

    hideLoading() {
        this.state.isLoading = false;
        
        if (this.elements.initialState) {
            this.elements.initialState.style.display = 'none';
        }
        if (this.elements.loadingState) {
            this.elements.loadingState.style.display = 'none';
        }
        if (this.elements.table) {
            this.elements.table.style.display = 'table';
            // Trigger animation
            setTimeout(() => {
                this.elements.table.style.opacity = '1';
                this.elements.table.style.transform = 'translateY(0)';
            }, 100);
        }
        if (this.elements.notes) {
            this.elements.notes.style.display = 'block';
        }
    }

    updatePricingData(data) {
        if (!data || !data.headers || !data.prices) {
            console.warn('[UniversalPricingGrid] Invalid pricing data received');
            return;
        }

        console.log('[UniversalPricingGrid] Updating pricing data', data);
        this.state.pricingData = data;

        // Update the table
        this.buildPricingTable();

        // Load inventory if we have style and color
        if (this.config.showInventory && data.styleNumber && data.color) {
            this.updateInventory(data.styleNumber, data.color);
        }

        // Update pricing note if embellishment type is embroidery
        if (this.elements.pricingNote && data.embellishmentType === 'embroidery') {
            this.elements.pricingNote.textContent = 'Prices shown are per item and include an 8,000 stitch embroidered logo.';
        }

        // Hide loading and show table
        this.hideLoading();
    }

    buildPricingTable() {
        if (!this.state.pricingData) return;

        const { headers, prices, tierData } = this.state.pricingData;

        // Update headers
        if (this.elements.headerRow) {
            // Clear existing headers except the first one
            while (this.elements.headerRow.children.length > 1) {
                this.elements.headerRow.removeChild(this.elements.headerRow.lastChild);
            }
            
            // Add size headers
            headers.forEach(sizeHeader => {
                const th = document.createElement('th');
                th.textContent = sizeHeader;
                this.elements.headerRow.appendChild(th);
            });
        }

        // Update tbody
        if (this.elements.tbody) {
            this.elements.tbody.innerHTML = '';

            // Sort tiers by minimum quantity
            const tierKeys = Object.keys(tierData || {});
            tierKeys.sort((a, b) => {
                const tierA = tierData[a];
                const tierB = tierData[b];
                return (tierA.MinQuantity || 0) - (tierB.MinQuantity || 0);
            });

            // Build rows
            tierKeys.forEach((tierKey, index) => {
                const tier = tierData[tierKey];
                const row = document.createElement('tr');
                
                // Add stagger animation
                row.classList.add('stagger-animation');
                row.style.animationDelay = `${index * 100}ms`;

                // Quantity cell
                const tierCell = document.createElement('td');
                let tierLabel = '';
                if (tier.MaxQuantity && tier.MinQuantity) {
                    tierLabel = `${tier.MinQuantity}-${tier.MaxQuantity}`;
                } else if (tier.MinQuantity) {
                    tierLabel = `${tier.MinQuantity}+`;
                }
                tierCell.textContent = tierLabel;
                row.appendChild(tierCell);

                // Price cells
                headers.forEach(sizeGroup => {
                    const priceCell = document.createElement('td');
                    priceCell.className = 'price-cell';
                    
                    const price = prices[sizeGroup] && prices[sizeGroup][tierKey] !== undefined ?
                        prices[sizeGroup][tierKey] : null;
                    
                    if (price !== null && price !== undefined) {
                        const priceNum = parseFloat(price);
                        let formattedPrice;
                        if (!isNaN(priceNum)) {
                            formattedPrice = priceNum % 1 === 0 ? `$${priceNum}` : `$${priceNum.toFixed(2)}`;
                        } else {
                            formattedPrice = 'N/A';
                        }
                        priceCell.innerHTML = formattedPrice;
                        
                        // Add inventory indicator if available
                        if (this.state.inventoryData && this.state.inventoryData.sizes) {
                            this.addInventoryIndicator(priceCell, sizeGroup);
                        }
                    } else {
                        priceCell.textContent = 'N/A';
                    }
                    
                    row.appendChild(priceCell);
                });

                this.elements.tbody.appendChild(row);
            });

            // Mark best prices
            this.markBestPrices();
            
            // Add tier badges
            this.addTierBadges();
        }
    }

    addInventoryIndicator(priceCell, sizeGroup) {
        if (priceCell.querySelector('.inventory-indicator')) return;
        
        const { sizes, sizeTotals } = this.state.inventoryData;
        
        // Determine which sizes to check based on size group
        let sizesToCheck = [];
        if (sizeGroup === 'S-XL') {
            sizesToCheck = ['S', 'M', 'L', 'XL'];
        } else if (sizeGroup.includes('/')) {
            sizesToCheck = sizeGroup.split('/');
        } else {
            sizesToCheck = [sizeGroup];
        }
        
        // Find lowest inventory among sizes in group
        let lowestInventory = Infinity;
        let hasInventoryData = false;
        
        sizesToCheck.forEach(size => {
            const sizeIndex = sizes.indexOf(size);
            if (sizeIndex !== -1) {
                hasInventoryData = true;
                const sizeTotal = sizeTotals[sizeIndex];
                if (sizeTotal < lowestInventory) {
                    lowestInventory = sizeTotal;
                }
            }
        });
        
        // Add indicator if low or out of stock
        if (hasInventoryData && (lowestInventory === 0 || lowestInventory < this.config.inventoryThreshold)) {
            const indicator = document.createElement('span');
            indicator.className = 'inventory-indicator';
            
            if (lowestInventory === 0) {
                indicator.classList.add('inventory-none');
                indicator.title = 'Out of stock';
            } else {
                indicator.classList.add('inventory-low');
                indicator.title = `Low stock: ${lowestInventory} available`;
            }
            
            priceCell.appendChild(indicator);
            
            // Show inventory legend
            if (this.elements.inventoryLegend) {
                this.elements.inventoryLegend.style.display = 'block';
            }
        }
    }

    markBestPrices() {
        if (!this.elements.tbody) return;
        
        const rows = this.elements.tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const priceCells = row.querySelectorAll('.price-cell');
            let lowestPrice = Infinity;
            let bestCell = null;

            priceCells.forEach(cell => {
                const priceText = cell.textContent.trim();
                const price = parseFloat(priceText.replace('$', ''));
                if (!isNaN(price) && price < lowestPrice) {
                    lowestPrice = price;
                    bestCell = cell;
                }
            });

            if (bestCell) {
                bestCell.classList.add('best-price');
            }
        });
    }

    addTierBadges() {
        if (!this.elements.tbody) return;
        
        const rows = this.elements.tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const firstCell = row.querySelector('td:first-child');
            if (firstCell) {
                // Add badges based on tier position
                if (index === 0 && rows.length > 2) {
                    const badge = document.createElement('span');
                    badge.className = 'tier-badge popular';
                    badge.textContent = 'Popular';
                    firstCell.appendChild(badge);
                } else if (index === rows.length - 1 && rows.length > 1) {
                    const badge = document.createElement('span');
                    badge.className = 'tier-badge best-value';
                    badge.textContent = 'Best Value';
                    firstCell.appendChild(badge);
                }
            }
        });
    }

    async updateInventory(styleNumber, color) {
        if (!styleNumber || !color) {
            console.warn('[UniversalPricingGrid] Missing style or color for inventory check');
            return;
        }

        console.log(`[UniversalPricingGrid] Loading inventory for ${styleNumber}, ${color}`);

        try {
            const response = await fetch(
                `${this.config.apiBaseUrl}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
            );
            
            if (!response.ok) {
                throw new Error(`Inventory API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (Array.isArray(data) && data.length > 0) {
                // Process inventory data
                const sizes = [];
                const sizeTotals = [];
                
                data.forEach(item => {
                    if (item.size && !sizes.includes(item.size)) {
                        sizes.push(item.size);
                        const total = data
                            .filter(i => i.size === item.size)
                            .reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0);
                        sizeTotals.push(total);
                    }
                });
                
                this.state.inventoryData = {
                    styleNumber,
                    color,
                    sizes,
                    sizeTotals,
                    timestamp: new Date().toISOString()
                };
                
                console.log('[UniversalPricingGrid] Inventory data processed:', sizes);
                
                // Refresh the table to add indicators
                if (this.state.pricingData) {
                    this.buildPricingTable();
                }
            }
        } catch (error) {
            console.error('[UniversalPricingGrid] Error fetching inventory:', error);
        }
    }

    updateSelectedColor(colorName, colorData) {
        this.state.selectedColor = colorName;
        this.state.selectedColorSwatch = colorData;

        if (this.elements.colorName) {
            this.elements.colorName.textContent = colorName;
        }

        if (this.elements.colorSwatch && colorData) {
            // Update mini swatch appearance
            this.elements.colorSwatch.style.backgroundImage = '';
            this.elements.colorSwatch.style.backgroundColor = '#ccc';
            
            if (colorData.COLOR_SQUARE_IMAGE || colorData.COLOR_SWATCH_IMAGE_URL) {
                const swatchUrl = colorData.COLOR_SQUARE_IMAGE || colorData.COLOR_SWATCH_IMAGE_URL;
                this.elements.colorSwatch.style.backgroundImage = `url('${swatchUrl}')`;
            } else if (colorData.HEX_CODE) {
                this.elements.colorSwatch.style.backgroundColor = colorData.HEX_CODE;
            } else {
                // Fallback color based on name
                this.elements.colorSwatch.style.backgroundColor = this.getColorFallback(colorName);
            }
        }
    }

    handleColorSwatchClick() {
        // Find and scroll to the main color swatches
        const colorSwatches = document.querySelectorAll('.color-swatch');
        const targetSwatch = Array.from(colorSwatches).find(s => 
            s.dataset.colorName === this.state.selectedColor ||
            s.dataset.catalogColor === this.state.selectedColor
        );
        
        if (targetSwatch) {
            targetSwatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetSwatch.classList.add('pulse-highlight');
            setTimeout(() => targetSwatch.classList.remove('pulse-highlight'), 2000);
        }
    }

    getColorFallback(colorName) {
        const colorMap = {
            'white': '#FFFFFF', 'black': '#000000', 'navy': '#001F3F', 'blue': '#0074D9',
            'red': '#FF4136', 'green': '#2ECC40', 'yellow': '#FFDC00', 'gray': '#AAAAAA',
            'grey': '#AAAAAA', 'purple': '#B10DC9', 'orange': '#FF851B', 'pink': '#FF69B4',
            'brown': '#8B4513', 'maroon': '#800000', 'forest': '#228B22', 'royal': '#4169E1',
            'cardinal': '#C41E3A', 'kelly': '#4CBB17', 'hunter': '#355E3B', 'burgundy': '#800020',
            'charcoal': '#36454F', 'heather': '#B0C4DE', 'stone': '#928E85', 'sand': '#C2B280',
            'khaki': '#F0E68C'
        };
        
        const normalizedName = colorName.toLowerCase();
        for (const [key, value] of Object.entries(colorMap)) {
            if (normalizedName.includes(key)) return value;
        }
        return '#CCCCCC'; // Default gray
    }

    highlightActiveTier(quantity) {
        if (!this.state.pricingData || !this.elements.tbody) return;
        
        const { tierData } = this.state.pricingData;
        
        // Remove previous highlights
        this.elements.tbody.querySelectorAll('tr.current-pricing-level-highlight').forEach(row => {
            row.classList.remove('current-pricing-level-highlight');
        });
        
        // Find and highlight the current tier
        const tierKeys = Object.keys(tierData || {});
        for (const tierKey of tierKeys) {
            const tier = tierData[tierKey];
            if (quantity >= tier.MinQuantity && (!tier.MaxQuantity || quantity <= tier.MaxQuantity)) {
                // Find the row with this tier
                const rows = this.elements.tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const firstCell = row.querySelector('td:first-child');
                    if (firstCell) {
                        const cellText = firstCell.textContent.trim();
                        const tierLabel = tier.MaxQuantity ? 
                            `${tier.MinQuantity}-${tier.MaxQuantity}` : 
                            `${tier.MinQuantity}+`;
                        
                        if (cellText === tierLabel) {
                            row.classList.add('current-pricing-level-highlight');
                        }
                    }
                });
                break;
            }
        }
    }
}

// Export for use
window.UniversalPricingGrid = UniversalPricingGrid;