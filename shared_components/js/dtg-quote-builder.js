/**
 * DTG Quote Builder Main Controller
 * Orchestrates all modules for the DTG quote builder application
 */

class DTGQuoteBuilder {
    constructor() {
        // Initialize services
        this.quoteService = new window.DTGQuoteService();
        this.pricingCalculator = new window.DTGQuotePricing();
        this.productsManager = new window.DTGQuoteProducts();
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // State management
        this.currentPhase = 1;
        this.selectedLocation = null;
        this.selectedLocationName = null;
        this.currentQuoteData = null;
        
        // Initialize elements
        this.initializeElements();
        this.bindEvents();
        
        // Set initial state
        this.updatePhaseNavigation();
        
        console.log('[DTGQuoteBuilder] Initialized');
    }
    
    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Phase sections
        this.locationPhase = document.getElementById('location-phase');
        this.productPhase = document.getElementById('product-phase');
        this.reviewPhase = document.getElementById('review-phase');
        
        // Phase navigation
        this.phase1Nav = document.getElementById('phase-1-nav');
        this.phase2Nav = document.getElementById('phase-2-nav');
        this.phase3Nav = document.getElementById('phase-3-nav');
        this.connector1 = document.getElementById('connector-1');
        this.connector2 = document.getElementById('connector-2');
        
        // Location selection
        this.locationRadios = document.querySelectorAll('input[name="print-location"]');
        this.selectedLocationDisplay = document.getElementById('selected-location-display');
        this.selectedLocationText = document.getElementById('selected-location-text');
        this.continueToProductsBtn = document.getElementById('continue-to-products');
        
        // Product phase
        this.phase2Location = document.getElementById('phase2-location');
        this.styleSearch = document.getElementById('style-search');
        this.styleSuggestions = document.getElementById('style-suggestions');
        this.colorSelect = document.getElementById('color-select');
        this.loadProductBtn = document.getElementById('load-product-btn');
        this.productDisplay = document.getElementById('product-display');
        this.productImage = document.getElementById('product-image');
        this.productName = document.getElementById('product-name');
        this.productDescription = document.getElementById('product-description');
        this.productStyle = document.getElementById('product-style');
        this.productColor = document.getElementById('product-color');
        this.sizeInputsContainer = document.getElementById('size-inputs');
        this.productTotalQty = document.getElementById('product-total-qty');
        this.addToQuoteBtn = document.getElementById('add-to-quote-btn');
        this.productsContainer = document.getElementById('products-container');
        this.aggregateQuantity = document.getElementById('aggregate-quantity');
        this.tierDisplay = document.getElementById('tier-display');
        this.currentTier = document.getElementById('current-tier');
        this.ltmWarning = document.getElementById('ltm-warning');
        this.backToLocationBtn = document.getElementById('back-to-location');
        this.continueToReviewBtn = document.getElementById('continue-to-review');
        
        // Review phase
        this.customerName = document.getElementById('customer-name');
        this.customerEmail = document.getElementById('customer-email');
        this.companyName = document.getElementById('company-name');
        this.customerPhone = document.getElementById('customer-phone');
        this.projectName = document.getElementById('project-name');
        this.salesRep = document.getElementById('sales-rep');
        this.specialNotes = document.getElementById('special-notes');
        this.previewQuoteId = document.getElementById('preview-quote-id');
        this.expiryDate = document.getElementById('expiry-date');
        this.summaryLocation = document.getElementById('summary-location');
        this.quoteItemsSummary = document.getElementById('quote-items-summary');
        this.summaryQuantity = document.getElementById('summary-quantity');
        this.summaryTier = document.getElementById('summary-tier');
        this.summaryTotal = document.getElementById('summary-total');
        this.summaryLtmNote = document.getElementById('summary-ltm-note');
        this.backToProductsBtn = document.getElementById('back-to-products');
        this.saveQuoteBtn = document.getElementById('save-quote-btn');
        this.printQuoteBtn = document.getElementById('print-quote-btn');
        
        // Modals
        this.successModal = document.getElementById('success-modal');
        this.modalQuoteId = document.getElementById('modal-quote-id');
        this.modalCustomer = document.getElementById('modal-customer');
        this.modalTotal = document.getElementById('modal-total');
        this.loadingOverlay = document.getElementById('loading-overlay');
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Location selection
        this.locationRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleLocationSelection());
        });
        
        this.continueToProductsBtn.addEventListener('click', () => this.moveToPhase(2));
        
        // Product phase
        this.styleSearch.addEventListener('input', (e) => this.handleStyleSearch(e));
        this.styleSearch.addEventListener('focus', () => this.styleSuggestions.style.display = 'block');
        document.addEventListener('click', (e) => {
            if (!this.styleSearch.contains(e.target) && !this.styleSuggestions.contains(e.target)) {
                this.styleSuggestions.style.display = 'none';
            }
        });
        
        this.loadProductBtn.addEventListener('click', () => this.loadProduct());
        this.addToQuoteBtn.addEventListener('click', () => this.addProductToQuote());
        this.backToLocationBtn.addEventListener('click', () => this.moveToPhase(1));
        this.continueToReviewBtn.addEventListener('click', () => this.moveToPhase(3));
        
        // Review phase
        this.backToProductsBtn.addEventListener('click', () => this.moveToPhase(2));
        this.saveQuoteBtn.addEventListener('click', () => this.saveQuote());
        this.printQuoteBtn.addEventListener('click', () => this.printQuote());
        
        // Customer info auto-save
        [this.customerName, this.customerEmail, this.companyName, 
         this.customerPhone, this.projectName, this.specialNotes].forEach(input => {
            input.addEventListener('change', () => this.updateQuoteSummary());
        });
    }
    
    /**
     * Handle location selection
     */
    handleLocationSelection() {
        const selected = document.querySelector('input[name="print-location"]:checked');
        if (selected) {
            this.selectedLocation = selected.value;
            
            // Map location codes to display names
            const locationNames = {
                'LC': 'Left Chest',
                'FF': 'Full Front',
                'FB': 'Full Back',
                'JF': 'Jumbo Front',
                'JB': 'Jumbo Back',
                'LC_FB': 'Left Chest & Full Back',
                'FF_FB': 'Full Front & Full Back',
                'JF_JB': 'Jumbo Front & Jumbo Back',
                'LC_JB': 'Left Chest & Jumbo Back'
            };
            
            this.selectedLocationName = locationNames[this.selectedLocation];
            
            // Update display
            this.selectedLocationText.textContent = this.selectedLocationName;
            this.selectedLocationDisplay.style.display = 'block';
            this.continueToProductsBtn.disabled = false;
            
            console.log('[DTGQuoteBuilder] Location selected:', this.selectedLocation, this.selectedLocationName);
        }
    }
    
    /**
     * Handle style search
     */
    async handleStyleSearch(event) {
        const query = event.target.value.trim();
        
        if (query.length < 2) {
            this.styleSuggestions.innerHTML = '';
            this.styleSuggestions.style.display = 'none';
            return;
        }
        
        try {
            const results = await this.productsManager.searchProducts(query);
            
            if (results.length > 0) {
                this.styleSuggestions.innerHTML = results.map(product => `
                    <div class="suggestion-item" data-style="${product.value || product.styleNumber}">
                        <strong>${product.value || product.styleNumber}</strong> - ${product.label ? product.label.split(' - ')[1] || product.label : product.productName || ''}
                    </div>
                `).join('');
                
                // Add click handlers
                this.styleSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.styleSearch.value = item.dataset.style;
                        this.styleSuggestions.style.display = 'none';
                        this.loadProductColors(item.dataset.style);
                    });
                });
                
                this.styleSuggestions.style.display = 'block';
            } else {
                this.styleSuggestions.innerHTML = '<div class="no-results">No products found</div>';
                this.styleSuggestions.style.display = 'block';
            }
        } catch (error) {
            console.error('[DTGQuoteBuilder] Search error:', error);
        }
    }
    
    /**
     * Load product colors
     */
    async loadProductColors(styleNumber) {
        try {
            const product = await this.productsManager.loadProductDetails(styleNumber);
            
            if (product && product.colors) {
                this.colorSelect.innerHTML = '<option value="">Select a color...</option>';
                product.colors.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color.COLOR_NAME || color;
                    option.textContent = color.COLOR_NAME || color;
                    this.colorSelect.appendChild(option);
                });
                
                this.colorSelect.disabled = false;
                this.loadProductBtn.disabled = false;
                
                // Store current product data
                this.currentProductData = product;
            }
        } catch (error) {
            console.error('[DTGQuoteBuilder] Error loading colors:', error);
        }
    }
    
    /**
     * Load product details and display
     */
    async loadProduct() {
        const styleNumber = this.styleSearch.value.trim();
        const color = this.colorSelect.value;
        
        if (!styleNumber || !color) {
            alert('Please select both style and color');
            return;
        }
        
        this.showLoading();
        
        try {
            // Get available sizes for this style/color combo
            const sizes = await this.productsManager.getAvailableSizes(styleNumber, color);
            
            // Update product display
            this.productName.textContent = this.currentProductData.title || styleNumber;
            this.productDescription.textContent = this.currentProductData.description || '';
            this.productStyle.textContent = styleNumber;
            this.productColor.textContent = color;
            
            // Set product image
            const colorData = this.currentProductData.colors.find(c => 
                (c.COLOR_NAME || c) === color
            );
            if (colorData && colorData.MAIN_IMAGE_URL) {
                this.productImage.src = colorData.MAIN_IMAGE_URL;
            } else {
                this.productImage.src = '/assets/placeholder-product.png';
            }
            
            // Build size inputs
            this.buildSizeInputs(sizes);
            
            // Show product display
            this.productDisplay.style.display = 'block';
            
        } catch (error) {
            console.error('[DTGQuoteBuilder] Error loading product:', error);
            alert('Error loading product details. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Build size input fields
     */
    buildSizeInputs(sizes) {
        this.sizeInputsContainer.innerHTML = '';
        
        sizes.forEach(size => {
            const sizeInput = document.createElement('div');
            sizeInput.className = 'size-input';
            sizeInput.innerHTML = `
                <label>${size}</label>
                <input type="number" 
                       class="size-qty" 
                       data-size="${size}" 
                       min="0" 
                       value="0" 
                       placeholder="0">
            `;
            this.sizeInputsContainer.appendChild(sizeInput);
        });
        
        // Add quantity change listeners
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            input.addEventListener('input', () => this.updateProductTotal());
        });
        
        this.updateProductTotal();
    }
    
    /**
     * Update product total quantity
     */
    updateProductTotal() {
        let total = 0;
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        
        this.productTotalQty.textContent = total;
        this.addToQuoteBtn.disabled = total === 0;
    }
    
    /**
     * Add product to quote
     */
    async addProductToQuote() {
        const styleNumber = this.styleSearch.value.trim();
        const color = this.colorSelect.value;
        
        // Collect size quantities
        const sizeQuantities = {};
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                sizeQuantities[input.dataset.size] = qty;
            }
        });
        
        if (Object.keys(sizeQuantities).length === 0) {
            alert('Please enter at least one quantity');
            return;
        }
        
        // Get product image
        const colorData = this.currentProductData.colors.find(c => 
            (c.COLOR_NAME || c) === color
        );
        
        // Add product
        const productData = {
            styleNumber: styleNumber,
            productName: this.currentProductData.title || styleNumber,
            color: color,
            colorCode: colorData?.COLOR_CODE || '',
            imageUrl: colorData?.MAIN_IMAGE_URL || '',
            sizeQuantities: sizeQuantities,
            pricingData: this.currentProductData.pricingData
        };
        
        await this.productsManager.addProduct(productData);
        
        // Update display
        this.updateProductsList();
        
        // Reset form
        this.resetProductForm();
        
        console.log('[DTGQuoteBuilder] Product added to quote');
    }
    
    /**
     * Update products list display
     */
    updateProductsList() {
        const products = this.productsManager.getAllProducts();
        
        if (products.length === 0) {
            this.productsContainer.innerHTML = '<p class="empty-message">No products added yet</p>';
            this.continueToReviewBtn.disabled = true;
        } else {
            this.productsContainer.innerHTML = products.map(product => 
                this.productsManager.buildProductCard(product)
            ).join('');
            this.continueToReviewBtn.disabled = false;
        }
        
        // Update aggregate quantity
        const totalQty = this.productsManager.getTotalQuantity();
        this.aggregateQuantity.textContent = totalQty;
        
        // Update tier display
        const tier = this.pricingCalculator.getTierForQuantity(totalQty);
        this.currentTier.textContent = tier;
        this.tierDisplay.style.display = 'block';
        
        // Show LTM warning if applicable
        if (totalQty < 24) {
            this.ltmWarning.style.display = 'block';
        } else {
            this.ltmWarning.style.display = 'none';
        }
    }
    
    /**
     * Reset product form
     */
    resetProductForm() {
        this.styleSearch.value = '';
        this.colorSelect.innerHTML = '<option value="">Select style first</option>';
        this.colorSelect.disabled = true;
        this.loadProductBtn.disabled = true;
        this.productDisplay.style.display = 'none';
    }
    
    /**
     * Move to specific phase
     */
    moveToPhase(phase) {
        this.currentPhase = phase;
        
        // Hide all phases
        [this.locationPhase, this.productPhase, this.reviewPhase].forEach(p => {
            p.style.display = 'none';
        });
        
        // Show current phase
        switch (phase) {
            case 1:
                this.locationPhase.style.display = 'block';
                break;
            case 2:
                this.productPhase.style.display = 'block';
                this.phase2Location.textContent = this.selectedLocationName;
                break;
            case 3:
                this.reviewPhase.style.display = 'block';
                this.prepareQuoteSummary();
                break;
        }
        
        // Update navigation
        this.updatePhaseNavigation();
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    /**
     * Update phase navigation indicators
     */
    updatePhaseNavigation() {
        // Reset all phases
        [this.phase1Nav, this.phase2Nav, this.phase3Nav].forEach((nav, index) => {
            nav.classList.remove('active', 'completed');
            if (index + 1 < this.currentPhase) {
                nav.classList.add('completed');
            } else if (index + 1 === this.currentPhase) {
                nav.classList.add('active');
            }
        });
        
        // Update connectors
        this.connector1.classList.toggle('active', this.currentPhase > 1);
        this.connector2.classList.toggle('active', this.currentPhase > 2);
    }
    
    /**
     * Prepare quote summary for review
     */
    async prepareQuoteSummary() {
        const products = this.productsManager.getAllProducts();
        const totalQuantity = this.productsManager.getTotalQuantity();
        
        // Generate quote ID preview
        const quoteId = this.quoteService.generateQuoteID();
        this.previewQuoteId.textContent = quoteId;
        
        // Set expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        this.expiryDate.textContent = expiryDate.toLocaleDateString();
        
        // Set location
        this.summaryLocation.textContent = this.selectedLocationName;
        
        // Calculate pricing for all products
        const quoteTotals = await this.pricingCalculator.calculateQuoteTotals(
            products,
            this.selectedLocation,
            totalQuantity
        );
        
        // Build items summary HTML
        let summaryHTML = '';
        quoteTotals.products.forEach(product => {
            summaryHTML += `
                <div class="quote-item-summary">
                    <div class="item-header">
                        <strong>${product.styleNumber} - ${product.productName}</strong>
                        <span class="item-color">${product.color}</span>
                    </div>
                    <div class="item-sizes">
            `;
            
            // Group sizes by price
            product.sizeGroups.forEach(group => {
                const sizeList = Object.entries(group.sizes || {})
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');
                
                let priceDisplay;
                if (group.ltmPerUnit > 0) {
                    // Show LTM breakdown as requested
                    const basePrice = group.basePrice.toFixed(2);
                    const ltmFee = group.ltmPerUnit.toFixed(2);
                    const finalPrice = group.unitPrice.toFixed(2);
                    priceDisplay = `$${basePrice} + $${ltmFee} small batch fee = $${finalPrice}`;
                } else {
                    priceDisplay = `$${group.unitPrice.toFixed(2)}`;
                }
                
                summaryHTML += `
                    <div class="size-group-line">
                        <span class="sizes">${sizeList}</span>
                        <span class="price">${priceDisplay}</span>
                        <span class="total">$${group.total.toFixed(2)}</span>
                    </div>
                `;
            });
            
            summaryHTML += `
                    </div>
                </div>
            `;
        });
        
        this.quoteItemsSummary.innerHTML = summaryHTML;
        
        // Update totals
        this.summaryQuantity.textContent = `${totalQuantity} pieces`;
        this.summaryTier.textContent = quoteTotals.tier;
        this.summaryTotal.textContent = `$${quoteTotals.total.toFixed(2)}`;
        
        // Show LTM note if applicable
        if (quoteTotals.hasLTM) {
            this.summaryLtmNote.style.display = 'block';
        } else {
            this.summaryLtmNote.style.display = 'none';
        }
        
        // Store current quote data
        this.currentQuoteData = {
            quoteId: quoteId,
            products: quoteTotals.products,
            totalQuantity: totalQuantity,
            subtotal: quoteTotals.subtotal,
            ltmFee: quoteTotals.ltmFee,
            total: quoteTotals.total,
            tier: quoteTotals.tier,
            hasLTM: quoteTotals.hasLTM,
            location: this.selectedLocation,
            locationName: this.selectedLocationName,
            expiryDate: expiryDate
        };
    }
    
    /**
     * Update quote summary when customer info changes
     */
    updateQuoteSummary() {
        // This is called when customer info changes
        // Could be used to update display in real-time
    }
    
    /**
     * Save quote
     */
    async saveQuote() {
        // Validate required fields
        if (!this.validateForm()) {
            return;
        }
        
        this.showLoading();
        
        try {
            // Build complete quote data
            const quoteData = {
                ...this.currentQuoteData,
                customerName: this.customerName.value.trim(),
                customerEmail: this.customerEmail.value.trim(),
                companyName: this.companyName.value.trim(),
                customerPhone: this.customerPhone.value.trim(),
                projectName: this.projectName.value.trim(),
                specialNotes: this.specialNotes.value.trim(),
                salesRep: this.salesRep.value,
                salesRepName: this.getSalesRepName(this.salesRep.value),
                products: this.productsManager.getAllProducts()
            };
            
            // Save to database
            const saveResult = await this.quoteService.saveQuote(quoteData);
            
            if (saveResult.success) {
                console.log('[DTGQuoteBuilder] Quote saved successfully:', saveResult.quoteID);
                
                // Show success modal
                this.showSuccessModal(saveResult.quoteID, quoteData);
                
                // Store for print functionality
                this.lastSavedQuote = quoteData;
                this.lastSavedQuote.quoteId = saveResult.quoteID;
                
            } else {
                throw new Error(saveResult.error || 'Failed to save quote');
            }
            
        } catch (error) {
            console.error('[DTGQuoteBuilder] Error saving quote:', error);
            alert('Error saving quote. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Validate form
     */
    validateForm() {
        const errors = [];
        
        if (!this.customerName.value.trim()) {
            errors.push('Customer name is required');
        }
        
        if (!this.customerEmail.value.trim()) {
            errors.push('Customer email is required');
        } else if (!this.validateEmail(this.customerEmail.value)) {
            errors.push('Please enter a valid email address');
        }
        
        if (!this.salesRep.value) {
            errors.push('Please select a sales representative');
        }
        
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate email format
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Get sales rep name from email
     */
    getSalesRepName(email) {
        const reps = {
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'taylar@nwcustomapparel.com': 'Taylar Hanson',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley Wright',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'art@nwcustomapparel.com': 'Steve Deland'
        };
        
        return reps[email] || 'Sales Team';
    }
    
    /**
     * Show success modal
     */
    showSuccessModal(quoteId, quoteData) {
        this.modalQuoteId.textContent = quoteId;
        this.modalCustomer.textContent = quoteData.customerName;
        this.modalTotal.textContent = `$${quoteData.total.toFixed(2)}`;
        
        this.successModal.style.display = 'flex';
        this.printQuoteBtn.style.display = 'inline-block';
    }
    
    /**
     * Print quote
     */
    printQuote() {
        if (!this.lastSavedQuote) {
            alert('No quote available to print');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const quoteHTML = this.generatePrintHTML(this.lastSavedQuote);
        
        printWindow.document.write(quoteHTML);
        printWindow.document.close();
    }
    
    /**
     * Generate print HTML
     */
    generatePrintHTML(quoteData) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        let itemsHTML = '';
        quoteData.products.forEach(product => {
            const display = this.productsManager.formatProductDisplay(product);
            
            itemsHTML += `
                <div class="print-item">
                    <h4>${display.title}</h4>
                    <p>Color: ${display.color}</p>
                    <p>Sizes: ${display.sizes}</p>
                    <p>Quantity: ${display.quantity} pieces</p>
                </div>
            `;
        });
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Quote ${quoteData.quoteId}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        max-width: 200px;
                        margin-bottom: 20px;
                    }
                    .quote-info {
                        margin-bottom: 30px;
                    }
                    .quote-info h2 {
                        color: #4cb354;
                        margin-bottom: 10px;
                    }
                    .customer-info {
                        background: #f5f5f5;
                        padding: 15px;
                        margin-bottom: 20px;
                    }
                    .print-location {
                        background: #e8f5e9;
                        padding: 10px;
                        margin-bottom: 20px;
                        border-left: 4px solid #4cb354;
                    }
                    .print-item {
                        border-bottom: 1px solid #ddd;
                        padding: 15px 0;
                    }
                    .totals {
                        margin-top: 20px;
                        text-align: right;
                    }
                    .grand-total {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #4cb354;
                    }
                    .ltm-note {
                        font-style: italic;
                        color: #666;
                        margin-top: 10px;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #4cb354;
                        text-align: center;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                         alt="Northwest Custom Apparel" class="logo">
                    <h1>DTG Print Quote</h1>
                </div>
                
                <div class="quote-info">
                    <h2>Quote #${quoteData.quoteId}</h2>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                    <p>Valid Until: ${expiryDate.toLocaleDateString()}</p>
                </div>
                
                <div class="customer-info">
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> ${quoteData.customerName}</p>
                    <p><strong>Email:</strong> ${quoteData.customerEmail}</p>
                    ${quoteData.companyName ? `<p><strong>Company:</strong> ${quoteData.companyName}</p>` : ''}
                    ${quoteData.customerPhone ? `<p><strong>Phone:</strong> ${quoteData.customerPhone}</p>` : ''}
                    ${quoteData.projectName ? `<p><strong>Project:</strong> ${quoteData.projectName}</p>` : ''}
                </div>
                
                <div class="print-location">
                    <strong>Print Location:</strong> ${quoteData.locationName}
                </div>
                
                <h3>Products</h3>
                ${itemsHTML}
                
                <div class="totals">
                    <p>Total Quantity: ${quoteData.totalQuantity} pieces</p>
                    <p>Pricing Tier: ${quoteData.tier}</p>
                    <p class="grand-total">Grand Total: $${quoteData.total.toFixed(2)}</p>
                    ${quoteData.hasLTM ? '<p class="ltm-note">*Orders under 24 pieces include a small batch fee</p>' : ''}
                </div>
                
                ${quoteData.specialNotes ? `
                    <div class="notes">
                        <h3>Special Notes</h3>
                        <p>${quoteData.specialNotes}</p>
                    </div>
                ` : ''}
                
                <div class="footer">
                    <p><strong>Sales Representative:</strong> ${quoteData.salesRepName}</p>
                    <p>Email: ${quoteData.salesRep} | Phone: 253-922-5793</p>
                    <p>Northwest Custom Apparel | Established 1977</p>
                </div>
                
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                <\/script>
            </body>
            </html>
        `;
    }
    
    /**
     * Show loading overlay
     */
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
}

// Global functions for HTML onclick handlers
function copyQuoteId() {
    const quoteId = document.getElementById('modal-quote-id').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        alert('Quote ID copied to clipboard!');
    });
}

function printQuote() {
    if (window.dtgQuoteBuilder) {
        window.dtgQuoteBuilder.printQuote();
    }
}

function createNewQuote() {
    // Reload page to start fresh
    window.location.reload();
}

function removeProductFromQuote(productId) {
    if (window.dtgQuoteBuilder) {
        window.dtgQuoteBuilder.productsManager.removeProduct(productId);
        window.dtgQuoteBuilder.updateProductsList();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.dtgQuoteBuilder = new DTGQuoteBuilder();
    console.log('===================================');
    console.log('🚀 DTG Quote Builder Initialized');
    console.log('📦 Ready to create DTG quotes');
    console.log('===================================');
});