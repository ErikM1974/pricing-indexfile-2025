/**
 * DTF Pricing Calculator Component
 * Main calculator logic for DTF transfer pricing
 */
class DTFPricingCalculator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentData = {
            garmentCost: 0,
            quantity: DTFConfig.settings.defaultQuantity,
            transfers: [],
            freight: 0,
            ltmFee: 0,
            autoCalculateLTM: true  // Automatically calculate LTM based on quantity
        };
        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.checkStaffViewStatus();
        this.addTransferLocation(); // Start with one location
    }

    render() {
        this.container.innerHTML = `
            <div class="dtf-calculator-wrapper">
                <div class="dtf-calculator-main">
                    <div class="quantity-section">
                        <h3>Quantity</h3>
                        <div class="quantity-input-group">
                            <label for="dtf-quantity">Number of Garments:</label>
                            <input type="number" id="dtf-quantity" class="form-control" 
                                   value="${this.currentData.quantity}" 
                                   min="${DTFConfig.settings.minQuantity}" 
                                   step="1">
                        </div>
                        <div class="alert alert-info mt-2">
                            <i class="fas fa-info-circle"></i> Minimum order: ${DTFConfig.settings.minQuantity} pieces
                        </div>
                    </div>

                    <div class="transfers-section">
                        <h3>Transfer Locations</h3>
                        <div id="transfer-locations-container"></div>
                        <button class="btn btn-secondary add-transfer-btn" id="add-transfer-btn">
                            <i class="fas fa-plus"></i> Add Transfer Location
                        </button>
                    </div>

                    <div class="accordion-section">
                        <div class="accordion" id="dtfAccordion">
                            <div class="accordion-item">
                                <h2 class="accordion-header" id="headingOne">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                                            data-bs-target="#collapseOne" aria-expanded="false" aria-controls="collapseOne">
                                        <i class="fas fa-ruler"></i> Size Guide
                                    </button>
                                </h2>
                                <div id="collapseOne" class="accordion-collapse collapse" aria-labelledby="headingOne" 
                                     data-bs-parent="#dtfAccordion">
                                    <div class="accordion-body">
                                        <div class="size-guide">
                                            <p><strong>Small (Up to 5" x 5")</strong><br>
                                            Perfect for logos, small designs, pocket prints, and sleeve designs.</p>
                                            
                                            <p><strong>Medium (Up to 9" x 12")</strong><br>
                                            Ideal for standard front/back designs and larger graphics.</p>
                                            
                                            <p><strong>Large (Up to 12" x 16.5")</strong><br>
                                            Maximum size for full coverage designs and oversized prints.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item internal-only">
                                <h2 class="accordion-header" id="headingTwo">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                                            data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                                        <i class="fas fa-dollar-sign"></i> Pricing Tiers
                                    </button>
                                </h2>
                                <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo" 
                                     data-bs-parent="#dtfAccordion">
                                    <div class="accordion-body">
                                        ${this.generatePricingTiersHTML()}
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item internal-only">
                                <h2 class="accordion-header" id="headingThree">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                                            data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                                        <i class="fas fa-calculator"></i> Pricing Formula
                                    </button>
                                </h2>
                                <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree" 
                                     data-bs-parent="#dtfAccordion">
                                    <div class="accordion-body">
                                        <div class="formula-explanation">
                                            <h5>Total Price Per Shirt = </h5>
                                            <p>Garment Cost (with 40% margin) +<br>
                                            Transfer Costs (based on size and quantity) +<br>
                                            Labor Cost ($2 per location) +<br>
                                            Freight (tiered by quantity) + LTM Fee</p>
                                            
                                            <div class="alert alert-info mt-3">
                                                <i class="fas fa-info-circle"></i> 
                                                Freight is calculated per transfer based on order quantity.
                                            </div>
                                            
                                            <h6 class="mt-3">Freight Tiers:</h6>
                                            <table class="table table-sm">
                                                <tbody>
                                                    <tr><td>10-49 qty:</td><td>$0.50 per transfer</td></tr>
                                                    <tr><td>50-99 qty:</td><td>$0.35 per transfer</td></tr>
                                                    <tr><td>100-199 qty:</td><td>$0.25 per transfer</td></tr>
                                                    <tr><td>200+ qty:</td><td>$0.15 per transfer</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dtf-calculator-summary">
                    <h3>Order Summary</h3>
                    <div id="order-summary-content">
                        <!-- Summary will be populated here -->
                    </div>
                    <div class="staff-view-toggle">
                        <a href="#" id="staff-view-link" class="text-muted">
                            <i class="fas fa-chart-bar"></i> Internal View
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    generatePricingTiersHTML() {
        let html = '<div class="pricing-tiers-grid">';
        
        Object.entries(DTFConfig.transferSizes).forEach(([key, size]) => {
            html += `
                <div class="size-tier-section">
                    <h5>${size.displayName} (${size.name})</h5>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Quantity</th>
                                <th>Price/Transfer</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            size.pricingTiers.forEach(tier => {
                html += `
                    <tr>
                        <td>${tier.range}</td>
                        <td>$${tier.unitPrice.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    addTransferLocation() {
        if (this.currentData.transfers.length >= DTFConfig.settings.maxTransferLocations) {
            alert(`Maximum ${DTFConfig.settings.maxTransferLocations} transfer locations allowed.`);
            return;
        }

        const transferId = Date.now();
        const transferNumber = this.currentData.transfers.length + 1;
        
        this.currentData.transfers.push({
            id: transferId,
            location: '',
            size: '',
            number: transferNumber
        });

        this.renderTransferLocations();
        this.updateSummary();
    }

    renderTransferLocations() {
        const container = document.getElementById('transfer-locations-container');
        container.innerHTML = '';

        this.currentData.transfers.forEach((transfer, index) => {
            const locationOptions = DTFConfig.transferLocations.map(loc => 
                `<option value="${loc.value}" ${transfer.location === loc.value ? 'selected' : ''}>${loc.label}</option>`
            ).join('');

            const allowedSizes = transfer.location ? 
                DTFConfig.helpers.getAllowedSizesForLocation(transfer.location) : [];
            
            const sizeOptions = allowedSizes.map(sizeKey => {
                const size = DTFConfig.transferSizes[sizeKey];
                return `<option value="${sizeKey}" ${transfer.size === sizeKey ? 'selected' : ''}>${size.displayName}</option>`;
            }).join('');

            const transferHTML = `
                <div class="transfer-location-item" data-transfer-id="${transfer.id}">
                    <div class="transfer-header">
                        <span class="transfer-number">${transfer.number}</span>
                        <h4>Transfer Location ${transfer.number}</h4>
                        ${index > 0 ? `<button class="btn-remove-transfer" data-transfer-id="${transfer.id}">
                            <i class="fas fa-times"></i>
                        </button>` : ''}
                    </div>
                    <div class="transfer-inputs">
                        <div class="form-group">
                            <label>Location:</label>
                            <select class="form-control transfer-location-select" data-transfer-id="${transfer.id}">
                                <option value="">Select Location</option>
                                ${locationOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Size:</label>
                            <select class="form-control transfer-size-select" data-transfer-id="${transfer.id}" 
                                    ${!transfer.location ? 'disabled' : ''}>
                                <option value="">Select Size</option>
                                ${sizeOptions}
                            </select>
                        </div>
                    </div>
                </div>
            `;

            container.insertAdjacentHTML('beforeend', transferHTML);
        });

        // Update add button state
        const addBtn = document.getElementById('add-transfer-btn');
        if (this.currentData.transfers.length >= DTFConfig.settings.maxTransferLocations) {
            addBtn.disabled = true;
            addBtn.innerHTML = `<i class="fas fa-times"></i> Maximum Locations Reached`;
        } else {
            addBtn.disabled = false;
            addBtn.innerHTML = `<i class="fas fa-plus"></i> Add Transfer Location`;
        }
    }

    removeTransferLocation(transferId) {
        this.currentData.transfers = this.currentData.transfers.filter(t => t.id !== transferId);
        
        // Renumber remaining transfers
        this.currentData.transfers.forEach((transfer, index) => {
            transfer.number = index + 1;
        });

        this.renderTransferLocations();
        this.updateSummary();
    }

    updateTransferLocation(transferId, field, value) {
        const transfer = this.currentData.transfers.find(t => t.id === transferId);
        if (!transfer) return;

        transfer[field] = value;

        if (field === 'location') {
            // Reset size when location changes
            transfer.size = '';
            this.renderTransferLocations();
        }

        this.updateSummary();
    }

    calculatePricing() {
        const quantity = this.currentData.quantity;
        const garmentCost = this.currentData.garmentCost / DTFConfig.settings.garmentMargin; // 40% margin
        
        // Calculate transfer costs
        let totalTransferCost = 0;
        const transferDetails = [];

        this.currentData.transfers.forEach(transfer => {
            if (transfer.location && transfer.size) {
                const price = DTFConfig.helpers.getTransferPrice(transfer.size, quantity);
                totalTransferCost += price;
                
                const location = DTFConfig.transferLocations.find(l => l.value === transfer.location);
                const size = DTFConfig.transferSizes[transfer.size];
                
                transferDetails.push({
                    number: transfer.number,
                    location: location.label,
                    size: size.displayName.split(' (')[0], // Just show "Small", "Medium", or "Large" in summary
                    price: price
                });
            }
        });

        // Calculate labor cost ($2 per location)
        const locationCount = this.currentData.transfers.filter(t => t.location && t.size).length;
        const laborCost = locationCount > 0 ? DTFConfig.laborCost.getTotalLaborCost(locationCount) : 0;

        // Calculate freight based on quantity and number of transfers
        let freightCost = 0;
        if (DTFConfig.settings.includeFreightInTransfers && locationCount > 0) {
            freightCost = DTFConfig.freightCost.getTotalFreight(quantity, locationCount);
        } else {
            freightCost = this.currentData.freight;
        }

        // Calculate LTM fee if auto-calculate is on
        let ltmFee = this.currentData.ltmFee;
        if (this.currentData.autoCalculateLTM && DTFConfig.settings.showLTMFee) {
            ltmFee = quantity < DTFConfig.settings.ltmFeeThreshold ? DTFConfig.settings.ltmFeeAmount : 0;
        }

        // Total per shirt
        const totalPerShirt = garmentCost + totalTransferCost + laborCost + 
                            freightCost + (ltmFee / quantity);  // Distribute LTM across all pieces

        return {
            quantity,
            garmentCost,
            transferDetails,
            totalTransferCost,
            laborCost,
            locationCount,
            freight: freightCost,
            freightPerTransfer: locationCount > 0 ? DTFConfig.freightCost.getFreightPerTransfer(quantity) : 0,
            ltmFee: ltmFee,
            ltmFeePerShirt: ltmFee / quantity,
            totalPerShirt,
            totalOrder: (garmentCost + totalTransferCost + laborCost + freightCost) * quantity + ltmFee
        };
    }

    updateSummary() {
        const pricing = this.calculatePricing();
        const summaryContainer = document.getElementById('order-summary-content');

        // Check if garment cost is missing or zero
        if (!this.currentData.garmentCost || this.currentData.garmentCost === 0) {
            summaryContainer.innerHTML = `
                <div class="pricing-error-container">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Pricing Unavailable</h4>
                        <p>Unable to retrieve garment pricing at this time.</p>
                        <p><strong>Please call for a quote: (360) 763-7850</strong></p>
                        <button class="btn btn-primary mt-2" onclick="window.location.href='tel:+13607637850'">
                            <i class="fas fa-phone"></i> Call Now
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // Check if no transfers are selected
        if (pricing.transferDetails.length === 0) {
            summaryContainer.innerHTML = `
                <div class="pricing-placeholder">
                    <div class="text-center text-muted p-4">
                        <i class="fas fa-hand-point-up fa-3x mb-3"></i>
                        <h5>Select Transfer Locations</h5>
                        <p>Add at least one transfer location to see pricing</p>
                    </div>
                </div>
            `;
            return;
        }

        let transfersHTML = '';
        if (pricing.transferDetails.length > 0) {
            transfersHTML = pricing.transferDetails.map(detail => `
                <div class="summary-line-item">
                    <span>Transfer ${detail.number}: ${detail.location} (${detail.size})</span>
                    <span>$${detail.price.toFixed(2)}</span>
                </div>
            `).join('');
        } else {
            transfersHTML = '<div class="summary-line-item text-muted">No transfers selected</div>';
        }

        summaryContainer.innerHTML = `
            <div class="summary-section">
                <div class="summary-line-item">
                    <span>Quantity:</span>
                    <span>${pricing.quantity} garments</span>
                </div>
            </div>

            <div class="summary-section internal-only">
                <h5>Garment Cost</h5>
                <div class="summary-line-item">
                    <span>Base Garment (with 40% margin)</span>
                    <span>$${pricing.garmentCost.toFixed(2)}</span>
                </div>
            </div>

            <div class="summary-section internal-only">
                <h5>Transfer Costs</h5>
                ${transfersHTML}
                ${pricing.transferDetails.length > 0 ? `
                    <div class="summary-line-item summary-subtotal">
                        <span>Total Transfers:</span>
                        <span>$${pricing.totalTransferCost.toFixed(2)}</span>
                    </div>
                ` : ''}
            </div>

            <div class="summary-section internal-only">
                <h5>Labor Cost</h5>
                <div class="summary-line-item">
                    <span>Pressing (${pricing.locationCount} location${pricing.locationCount !== 1 ? 's' : ''} × $2)</span>
                    <span>$${pricing.laborCost.toFixed(2)}</span>
                </div>
            </div>

            ${DTFConfig.settings.showFreight || DTFConfig.settings.showLTMFee ? `
                <div class="summary-section internal-only">
                    <h5>Additional Fees</h5>
                    ${DTFConfig.settings.showFreight && DTFConfig.settings.includeFreightInTransfers && pricing.locationCount > 0 ? `
                        <div class="summary-line-item">
                            <span>Freight (${pricing.locationCount} × $${pricing.freightPerTransfer.toFixed(2)})</span>
                            <span>$${pricing.freight.toFixed(2)}</span>
                        </div>
                        <div class="summary-note">
                            <i class="fas fa-info-circle"></i> $${pricing.freightPerTransfer.toFixed(2)} per transfer at ${pricing.quantity} qty
                        </div>
                    ` : DTFConfig.settings.showFreight ? `
                        <div class="summary-line-item">
                            <span>Freight</span>
                            <span>$${pricing.freight.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${DTFConfig.settings.showLTMFee && pricing.ltmFee > 0 ? `
                        <div class="summary-line-item">
                            <span>LTM Fee (under ${DTFConfig.settings.ltmFeeThreshold} pcs)</span>
                            <span>$${pricing.ltmFee.toFixed(2)}</span>
                        </div>
                        <div class="summary-note">
                            <i class="fas fa-info-circle"></i> $${pricing.ltmFee.toFixed(2)} ÷ ${pricing.quantity} shirts = $${pricing.ltmFeePerShirt.toFixed(2)} per shirt
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            ${pricing.ltmFee > 0 ? `
                <div class="summary-section">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <strong>Minimum Order Information</strong><br>
                        Orders under ${DTFConfig.settings.ltmFeeThreshold} pieces include a $${pricing.ltmFee.toFixed(2)} setup fee<br>
                        <small>This adds $${pricing.ltmFeePerShirt.toFixed(2)} per shirt to your order</small>
                    </div>
                </div>
            ` : ''}

            <div class="summary-section summary-total">
                <div class="summary-line-item">
                    <span><strong>Price Per Shirt:</strong></span>
                    <span class="price-highlight">$${pricing.totalPerShirt.toFixed(2)}</span>
                </div>
                <div class="summary-line-item">
                    <span><strong>Total Order:</strong></span>
                    <span class="price-highlight">$${pricing.totalOrder.toFixed(2)}</span>
                </div>
            </div>
        `;

        // Dispatch pricing update event
        this.container.dispatchEvent(new CustomEvent('dtfPricingUpdated', {
            detail: pricing,
            bubbles: true
        }));
    }

    attachEventListeners() {
        // Quantity input
        this.container.addEventListener('input', (e) => {
            if (e.target.id === 'dtf-quantity') {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 0) {
                    this.currentData.quantity = value;
                    this.updateSummary();
                }
            }
        });

        // Quantity blur - enforce minimum on blur
        this.container.addEventListener('blur', (e) => {
            if (e.target.id === 'dtf-quantity') {
                if (parseInt(e.target.value) < DTFConfig.settings.minQuantity) {
                    e.target.value = DTFConfig.settings.minQuantity;
                    this.currentData.quantity = DTFConfig.settings.minQuantity;
                    this.updateSummary();
                }
            }
        });

        // Add transfer button
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('#add-transfer-btn')) {
                this.addTransferLocation();
            }

            // Remove transfer button
            if (e.target.closest('.btn-remove-transfer')) {
                const transferId = parseInt(e.target.closest('.btn-remove-transfer').dataset.transferId);
                this.removeTransferLocation(transferId);
            }
            
            // Staff view toggle
            if (e.target.closest('#staff-view-link')) {
                e.preventDefault();
                this.handleStaffViewToggle();
            }
        });

        // Transfer location and size selects
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('transfer-location-select')) {
                const transferId = parseInt(e.target.dataset.transferId);
                this.updateTransferLocation(transferId, 'location', e.target.value);
            }

            if (e.target.classList.contains('transfer-size-select')) {
                const transferId = parseInt(e.target.dataset.transferId);
                this.updateTransferLocation(transferId, 'size', e.target.value);
            }
        });
    }

    // Public methods for external data updates
    updateGarmentCost(cost) {
        this.currentData.garmentCost = parseFloat(cost) || 0;
        this.updateSummary();
    }

    updateFreight(freight) {
        this.currentData.freight = parseFloat(freight) || 0;
        this.updateSummary();
    }

    updateLTMFee(fee) {
        this.currentData.ltmFee = parseFloat(fee) || 0;
        this.updateSummary();
    }

    updateQuantity(qty) {
        this.currentData.quantity = Math.max(parseInt(qty) || DTFConfig.settings.minQuantity, DTFConfig.settings.minQuantity);
        document.getElementById('dtf-quantity').value = this.currentData.quantity;
        this.updateSummary();
    }
    
    handleStaffViewToggle() {
        // Check if already in staff view
        if (document.body.classList.contains('show-internal')) {
            // Toggle off
            document.body.classList.remove('show-internal');
            sessionStorage.removeItem('dtfStaffView');
            return;
        }
        
        // Prompt for password
        const password = prompt('Enter password for internal view:');
        
        if (password === '1977') {
            // Enable staff view
            document.body.classList.add('show-internal');
            sessionStorage.setItem('dtfStaffView', 'true');
        } else if (password !== null) {
            // Wrong password (but not cancelled)
            alert('Incorrect password');
        }
    }
    
    checkStaffViewStatus() {
        // Check if staff view was previously enabled in this session
        if (sessionStorage.getItem('dtfStaffView') === 'true') {
            document.body.classList.add('show-internal');
        }
    }
}

// Make calculator class available globally
window.DTFPricingCalculator = DTFPricingCalculator;