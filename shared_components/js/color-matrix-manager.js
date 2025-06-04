// Color Matrix Manager
// Handles adding multiple colors of the same cap style at once
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';

    class ColorMatrixManager {
        constructor() {
            this.isOpen = false;
            this.currentStyle = null;
            this.selectedColors = new Map();
            this.init();
        }

        init() {
            // Create the color matrix modal
            this.createColorMatrixModal();
            
            // Listen for color matrix trigger events
            document.addEventListener('openColorMatrix', (e) => {
                this.openColorMatrix(e.detail);
            });
        }

        createColorMatrixModal() {
            const modal = document.createElement('div');
            modal.id = 'color-matrix-modal';
            modal.className = 'color-matrix-modal';
            modal.innerHTML = `
                <div class="color-matrix-content">
                    <div class="color-matrix-header">
                        <h2>Select Multiple Colors</h2>
                        <button class="color-matrix-close" onclick="colorMatrixManager.close()">×</button>
                    </div>
                    
                    <div class="color-matrix-style-info">
                        <img id="matrix-style-image" src="" alt="">
                        <div>
                            <h3 id="matrix-style-name"></h3>
                            <p id="matrix-style-number"></p>
                        </div>
                    </div>
                    
                    <div class="color-matrix-colors" id="color-matrix-colors">
                        <!-- Colors will be populated here -->
                    </div>
                    
                    <div class="color-matrix-quantity">
                        <label>Quantity per color:</label>
                        <input type="number" id="matrix-quantity-per-color" min="1" value="12">
                        <span class="help-text">You can adjust individual quantities after adding</span>
                    </div>
                    
                    <div class="color-matrix-summary">
                        <div id="matrix-selection-summary">
                            <p>No colors selected</p>
                        </div>
                    </div>
                    
                    <div class="color-matrix-actions">
                        <button class="btn-secondary" onclick="colorMatrixManager.close()">Cancel</button>
                        <button class="btn-primary" onclick="colorMatrixManager.addSelectedColors()">
                            Add <span id="matrix-color-count">0</span> Colors to Quote
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'color-matrix-backdrop';
            backdrop.className = 'color-matrix-backdrop';
            backdrop.onclick = () => this.close();
            document.body.appendChild(backdrop);
        }

        openColorMatrix(styleData) {
            this.currentStyle = styleData;
            this.selectedColors.clear();
            
            // Populate style info
            document.getElementById('matrix-style-name').textContent = styleData.productName;
            document.getElementById('matrix-style-number').textContent = `Style: ${styleData.styleNumber}`;
            
            if (styleData.imageUrl) {
                document.getElementById('matrix-style-image').src = styleData.imageUrl;
            }
            
            // Populate colors
            this.populateColors(styleData.colors);
            
            // Reset quantity
            document.getElementById('matrix-quantity-per-color').value = 12;
            
            // Show modal
            document.getElementById('color-matrix-modal').classList.add('open');
            document.getElementById('color-matrix-backdrop').classList.add('visible');
            this.isOpen = true;
            
            // Update summary
            this.updateSelectionSummary();
        }

        populateColors(colors) {
            const container = document.getElementById('color-matrix-colors');
            container.innerHTML = '';
            
            colors.forEach((color, index) => {
                const colorItem = document.createElement('div');
                colorItem.className = 'color-matrix-item';
                colorItem.innerHTML = `
                    <label>
                        <input type="checkbox" 
                               value="${color.code}" 
                               data-color-name="${color.name}"
                               onchange="colorMatrixManager.toggleColor('${color.code}', '${color.name}', this.checked)">
                        <div class="color-swatch" style="background-color: ${color.hex || '#ccc'}"></div>
                        <span class="color-name">${color.name}</span>
                    </label>
                `;
                container.appendChild(colorItem);
            });
        }

        toggleColor(colorCode, colorName, isChecked) {
            if (isChecked) {
                this.selectedColors.set(colorCode, colorName);
            } else {
                this.selectedColors.delete(colorCode);
            }
            this.updateSelectionSummary();
        }

        updateSelectionSummary() {
            const count = this.selectedColors.size;
            const quantity = parseInt(document.getElementById('matrix-quantity-per-color').value) || 1;
            const totalQuantity = count * quantity;
            
            document.getElementById('matrix-color-count').textContent = count;
            
            const summaryEl = document.getElementById('matrix-selection-summary');
            if (count === 0) {
                summaryEl.innerHTML = '<p>No colors selected</p>';
            } else {
                const colorList = Array.from(this.selectedColors.values()).join(', ');
                summaryEl.innerHTML = `
                    <p><strong>${count} colors selected:</strong> ${colorList}</p>
                    <p><strong>Total quantity:</strong> ${totalQuantity} pieces (${quantity} per color)</p>
                `;
            }
        }

        async addSelectedColors() {
            if (this.selectedColors.size === 0) {
                this.showNotification('Please select at least one color', 'warning');
                return;
            }
            
            const quantity = parseInt(document.getElementById('matrix-quantity-per-color').value) || 1;
            const quoteAdapter = window.capEmbroideryQuoteAdapter || window.currentQuoteAdapter;
            
            if (!quoteAdapter) {
                console.error('[COLOR-MATRIX] Quote adapter not found');
                this.showNotification('Error: Quote system not initialized', 'error');
                return;
            }
            
            // Disable the add button to prevent double-clicking
            const addButton = document.querySelector('.color-matrix-actions .btn-primary');
            addButton.disabled = true;
            addButton.textContent = 'Adding colors...';
            
            try {
                // Add each selected color to the quote
                let addedCount = 0;
                for (const [colorCode, colorName] of this.selectedColors) {
                    const item = {
                        styleNumber: this.currentStyle.styleNumber,
                        productName: this.currentStyle.productName,
                        color: colorName,
                        colorCode: colorCode,
                        quantity: quantity,
                        embellishmentType: 'Cap Embroidery',
                        imageURL: this.currentStyle.imageUrl,
                        // These will be set by the quote adapter
                        stitchCount: this.currentStyle.stitchCount || 8000,
                        hasBackLogo: false,
                        backLogoStitchCount: 0
                    };
                    
                    // Add item to quote
                    quoteAdapter.addItem(item);
                    addedCount++;
                    
                    // Small delay to prevent overwhelming the system
                    if (addedCount < this.selectedColors.size) {
                        await this.delay(50);
                    }
                }
                
                this.showNotification(`Added ${addedCount} colors to quote`, 'success');
                this.close();
                
                // Trigger quote update event
                document.dispatchEvent(new CustomEvent('quoteUpdated', {
                    detail: { source: 'colorMatrix' }
                }));
                
            } catch (error) {
                console.error('[COLOR-MATRIX] Error adding colors:', error);
                this.showNotification('Error adding colors to quote', 'error');
            } finally {
                // Re-enable button
                addButton.disabled = false;
                addButton.innerHTML = `Add <span id="matrix-color-count">${this.selectedColors.size}</span> Colors to Quote`;
            }
        }

        close() {
            document.getElementById('color-matrix-modal').classList.remove('open');
            document.getElementById('color-matrix-backdrop').classList.remove('visible');
            this.isOpen = false;
            this.selectedColors.clear();
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        showNotification(message, type = 'info') {
            // Use simple toast notification
            const notification = document.createElement('div');
            notification.className = 'add-to-quote-success';
            notification.innerHTML = `
                <span>${type === 'success' ? '✓' : '⚠️'}</span>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 10);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2500);
        }
    }

    // Create singleton instance
    const colorMatrixManager = new ColorMatrixManager();

    // Export to global scope
    window.ColorMatrixManager = ColorMatrixManager;
    window.colorMatrixManager = colorMatrixManager;

    console.log('[COLOR-MATRIX] Color Matrix Manager initialized');

})();