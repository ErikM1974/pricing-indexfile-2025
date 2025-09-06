        // Richardson cap data
        const capData = [
            { style: 'PTS20M', description: 'Pulse Mesh Back R-Flex', price: 8.75 }, 
            { style: 'PTS205', description: 'Pulse R-Flex', price: 9.50 }, 
            { style: 'PTS30S', description: 'Ignite LT R-Flex', price: 10.00 }, 
            { style: 'PTS50S', description: 'Matrix R-Flex', price: 10.00 }, 
            { style: 'PTS65', description: 'Surge Fitted', price: 10.75 }, 
            { style: 'R15', description: 'Solid Knit', price: 2.95 }, 
            { style: 'R18', description: 'Solid Beanie with Cuff', price: 4.00 }, 
            { style: 'R20', description: 'Microfleece Beanie', price: 4.50 }, 
            { style: 'R22', description: 'Microfleece Headband', price: 4.25 }, 
            { style: 'R45', description: 'Garment Washed Visor', price: 4.50 }, 
            { style: 'R55', description: 'Garment Washed Twill', price: 4.50 }, 
            { style: 'R65S', description: 'Relaxed Twill', price: 4.00 }, 
            { style: 'R75S', description: 'Casual Twill', price: 4.25 }, 
            { style: '110', description: 'R-Flex Trucker', price: 7.65 }, 
            { style: '111', description: 'Garment Washed Trucker', price: 6.75 }, 
            { style: '111P', description: 'Garment Washed Printed Trucker', price: 7.50 }, 
            { style: '111PT', description: 'Relaxed Printed Tactical Trucker', price: 9.00 }, 
            { style: '111T', description: 'Relaxed Tactical Trucker', price: 8.25 }, 
            { style: '112', description: 'Trucker Mesh Back', price: 6.50 }, 
            { style: '112FP', description: 'Five Panel Trucker', price: 6.50 }, 
            { style: '112FPC', description: 'Five Panel Champ Trucker', price: 6.50 }, 
            { style: '112FPR', description: 'Five Panel Trucker with Rope', price: 6.75 }, 
            { style: '112PT', description: 'Printed Tactical Trucker', price: 9.00 }, 
            { style: '112T', description: 'Tactical Trucker', price: 8.25 }, 
            { style: '112P', description: 'Printed Trucker', price: 7.75 }, 
            { style: '112PFP', description: 'Printed Five Panel Trucker', price: 7.75 }, 
            { style: '112PM', description: 'Printed Mesh Trucker', price: 7.75 }, 
            { style: '112+', description: 'R-Flex Adjustable Trucker', price: 8.00 }, 
            { style: '112RE', description: 'Recycled Trucker', price: 7.00 }, 
            { style: '112WF', description: 'Fremant - Workwear Trucker', price: 7.50 }, 
            { style: '112WH', description: 'Hawthorne Workwear Trucker', price: 9.50 }, 
            { style: '112LN', description: 'Linen Trucker', price: 7.50 }, 
            { style: '113', description: 'Foamie Trucker', price: 6.50 }, 
            { style: '115', description: 'Low Pro Trucker', price: 6.50 }, 
            { style: '115CH', description: 'Low Pro Heather Trucker', price: 7.75 }, 
            { style: '121', description: 'Fleece Beanie', price: 6.00 }, 
            { style: '126', description: 'Duck Camo Beanie', price: 9.50 }, 
            { style: '130', description: 'Marled Beanie', price: 5.75 }, 
            { style: '134', description: 'Striped Beanie', price: 7.75 }, 
            { style: '135', description: 'Short Pom Beanie', price: 7.75 }, 
            { style: '137', description: 'Heathered Beanie with Cuff', price: 4.50 }, 
            { style: '139RE', description: 'Recycled Knit', price: 8.50 }, 
            { style: '141', description: 'Chunk Twist Knit Beanie', price: 8.75 }, 
            { style: '143', description: 'Chunk Cable Beanie', price: 7.00 }, 
            { style: '145', description: 'Scrunch Beanie', price: 5.25 }, 
            { style: '146', description: 'Waffle Knit Beanie', price: 6.00 }, 
            { style: '147', description: 'Slouch Knit Beanie', price: 8.25 }, 
            { style: '148', description: 'Heathered Beanie w/ Pom', price: 6.00 }, 
            { style: '149', description: 'Super Slouch Knit Beanie', price: 12.00 }, 
            { style: '154', description: 'Merino Wool Knit', price: 9.50 }, 
            { style: '157', description: 'Speckled Knit', price: 8.75 }, 
            { style: '160', description: 'Lite Performance Visor', price: 8.75 }, 
            { style: '163', description: 'Laser Cut Five Panel Trucker', price: 7.25 }, 
            { style: '168', description: '7 Panel Trucker', price: 8.25 }, 
            { style: '168P', description: 'Printed 7 Panel Trucker', price: 9.50 }, 
            { style: '169', description: '7 Panel Performance Cap', price: 9.25 }, 
            { style: '172', description: 'Pulse Sportmesh R-Flex', price: 9.25 }, 
            { style: '173', description: 'Hood River Performance Trucker', price: 9.00 }, 
            { style: '176', description: 'Ignite LT Performance Cap', price: 8.25 }, 
            { style: '185', description: 'Twill R-Flex', price: 7.00 }, 
            { style: '203', description: 'Brushed Chino Twill', price: 5.75 }, 
            { style: '212', description: 'Pro Twill Snapback', price: 6.50 }, 
            { style: '213', description: 'Low Pro Foamie Trucker', price: 5.50 }, 
            { style: '214', description: 'Pro Twill Hook and Loop', price: 7.00 }, 
            { style: '217', description: 'Macieay 5 Panel Camper Cap', price: 7.50 }, 
            { style: '220', description: 'Relaxed Performance Lite', price: 7.75 }, 
            { style: '222', description: 'Airmesh Lite Trucker', price: 7.25 }, 
            { style: '224RE', description: 'Recycled Performance', price: 7.50 }, 
            { style: '225', description: 'Casual Performance Lite', price: 7.00 }, 
            { style: '252', description: 'Premium Cotton Dad Hat', price: 7.00 }, 
            { style: '252L', description: 'Premium Linen Dad Cap', price: 9.50 }, 
            { style: '253', description: 'Timberline Corduroy Cap', price: 8.25 }, 
            { style: '254RE', description: 'Ashland Relaxed Unstructured', price: 6.75 }, 
            { style: '255', description: 'Pinch Front Structured Snapback', price: 9.00 }, 
            { style: '256', description: 'Umpqua Gramps Cap', price: 9.25 }, 
            { style: '256P', description: 'Printed Umpqua Gramps Cap', price: 7.75 }, 
            { style: '257', description: '7 Panel Twill Strapback', price: 7.25 }, 
            { style: '258', description: '5 Panel Classic Rope Cap', price: 7.00 }, 
            { style: '262', description: 'Relaxed 6 Panel Snapback', price: 7.50 }, 
            { style: '309', description: 'Canvas Duck Cloth', price: 6.75 }, 
            { style: '312', description: 'Solid Twill Trucker', price: 6.00 }, 
            { style: '320T', description: 'Toddler Chino', price: 7.00 }, 
            { style: '323FPC', description: 'Full Fabric 5 Panel Champ', price: 6.25 }, 
            { style: '324', description: 'Pigment Dyed and Washed', price: 6.75 }, 
            { style: '324RE', description: 'Odell Garment Washed', price: 6.25 }, 
            { style: '326', description: 'Garment Washed Brushed Twill', price: 7.75 }, 
            { style: '336', description: 'Burnside Structured Brushed Canvas', price: 9.75 }, 
            { style: '355', description: 'Laser Perf Performance Rope Cap', price: 8.50 }, 
            { style: '380', description: 'Garment Dyed and Washed Twill', price: 7.50 }, 
            { style: '382', description: 'Snow Washed', price: 8.00 }, 
            { style: '414', description: 'Pro Mesh Adjustable', price: 9.25 }, 
            { style: '420', description: 'Surge Adjustable Officials Cap', price: 10.75 }, 
            { style: '435', description: 'Coos Bay Martexin Wax Water Repellent', price: 8.00 }, 
            { style: '436', description: 'Santiem Waxed Cotton', price: 9.75 }, 
            { style: '485', description: 'Pulse R-Flex Officials Cap', price: 9.50 }, 
            { style: '487', description: 'Pulse R-Flex Officials Cap', price: 8.75 }, 
            { style: '495', description: 'Pro Mesh R-Flex', price: 8.25 }, 
            { style: '510', description: 'Acrylic-Wool Blend Flatbill Snapback', price: 7.75 }, 
            { style: '511', description: 'Wool Blend Trucker', price: 8.25 }, 
            { style: '512', description: 'Surge Snapback', price: 8.75 }, 
            { style: '514', description: 'Surge Adjustable Hook and Loop', price: 8.50 }, 
            { style: '525', description: 'Surge Adjustable Umpire Cap', price: 9.25 }, 
            { style: '530', description: 'Surge Fitted Umpire Cap', price: 10.00 }, 
            { style: '533', description: 'Surge R-Flex Umpire Cap', price: 8.50 }, 
            { style: '535', description: 'Surge Adjustable Umpire Cap', price: 9.25 }, 
            { style: '540', description: 'Surge Fitted Umpire Cap', price: 10.00 }, 
            { style: '543', description: 'Surge R-Flex Umpire Cap', price: 8.50 }, 
            { style: '545', description: 'Surge Adjustable Umpire Cap', price: 9.25 }, 
            { style: '550', description: 'Surge Fitted Umpire Cap -Wool Blend', price: 9.75 }, 
            { style: '585', description: 'R-Flex Laser Perf R-Flex Snapback', price: 9.75 }, 
            { style: '632', description: 'Acrylic', price: 9.75 }, 
            { style: '633', description: 'Pulse R-Flex Umpire Cap', price: 7.75 }, 
            { style: '634', description: 'Ignite LT R-Flex Hook & Loop', price: 9.75 }, 
            { style: '643', description: 'Pulse R-Flex Umpire Cap', price: 9.75 }, 
            { style: '653', description: 'Pulse R-Flex Umpire Cap', price: 6.50 }, 
            { style: '707', description: 'Pulse Visor w/ Pro Mesh', price: 8.50 }, 
            { style: '709', description: 'Ignite LT Visor', price: 7.75 }, 
            { style: '712', description: 'Trucker Visor', price: 8.50 }, 
            { style: '715', description: 'Classic Golf Visor', price: 10.25 }, 
            { style: '733', description: 'Ignite LT R-Flex Umpire Cap', price: 7.25 }, 
            { style: '740', description: 'Pro Mesh Visor', price: 10.25 }, 
            { style: '743', description: 'Ignite LT R-Flex Umpire Cap', price: 10.25 }, 
            { style: '753', description: 'Ignite LT R-Flex Umpire Cap', price: 10.75 }, 
            { style: '785', description: 'Ignite LT R-Flex Officials Cap', price: 10.75 }, 
            { style: '787', description: 'Ignite LT R-Flex Officials Cap', price: 18.75 }, 
            { style: '810', description: 'Lite Wide Brim Hat', price: 18.00 }, 
            { style: '822', description: 'Straw Safari Hat', price: 17.00 }, 
            { style: '824', description: 'Classic Gambler Hat', price: 17.00 }, 
            { style: '827', description: 'Waterman Lined Straw Hat', price: 20.00 }, 
            { style: '828', description: 'Waterman Straw Hat', price: 8.25 }, 
            { style: '835', description: 'Tilikum Ripstop', price: 7.75 }, 
            { style: '840', description: 'Relaxed Twill Camo', price: 7.75 }, 
            { style: '843', description: 'Casual Twill Camo Strapback', price: 7.75 }, 
            { style: '862', description: 'Multicam Trucker', price: 9.00 }, 
            { style: '863', description: 'Structured Multicam', price: 9.75 }, 
            { style: '865', description: 'R-Flex Multicam', price: 12.00 }, 
            { style: '870', description: 'Relaxed Performance Camo', price: 9.75 }, 
            { style: '874', description: 'Casual Performance Camo', price: 9.75 }, 
            { style: '882', description: 'Blaze Trucker', price: 6.50 }, 
            { style: '882FP', description: '5 Panel Blaze Trucker', price: 6.50 }, 
            { style: '884', description: 'Blaze w/ Duck Cloth Visor', price: 7.00 }, 
            { style: '909', description: 'Mckenzie Brimmed Hat', price: 21.00 }, 
            { style: '910', description: 'Sunriver Brimmed Hat', price: 23.00 }, 
            { style: '930', description: 'Troutdale Corduroy Mesh Back', price: 7.25 }, 
            { style: '931', description: 'Koosah Ripstop', price: 8.25 }, 
            { style: '932', description: 'PCT 5 Panel Camper Cap', price: 7.25 }, 
            { style: '933', description: 'Bandon 6 Panel', price: 9.00 }, 
            { style: '934', description: 'Wildwood', price: 8.50 }, 
            { style: '935', description: 'Rogue', price: 8.25 }, 
            { style: '937', description: 'Pioneer 7 Panel', price: 11.50 }, 
            { style: '938', description: 'ORE 6 Panel', price: 9.00 }, 
            { style: '939', description: 'Bachelor Pinch Front w/ Rope', price: 7.75 }, 
            { style: '942', description: 'Sahalie 6 Panel Water Repellent', price: 9.50 }, 
            { style: '943', description: 'Summit Pack', price: 11.50 }
        ];

        // Embroidery pricing by stitch count
        const embroideryCosts = {
            '5000': { '1-23': 9.75, '24-47': 8.75, '48-71': 7.75, '72+': 6.75 },
            '8000': { '1-23': 12.00, '24-47': 11.00, '48-71': 10.00, '72+': 8.50 },
            '10000': { '1-23': 13.50, '24-47': 12.50, '48-71': 11.50, '72+': 11.00 }
        };

        // Leatherette patch pricing (flat rate)
        const leatherettePricing = {
            '1-23': 8.40,
            '24-47': 7.34,
            '48-71': 7.34,
            '72+': 6.03
        };

        // Leatherette labor costs (tiered by quantity)
        const leatheretteLabor = {
            '1-23': 4.00,
            '24-47': 4.00,
            '48-71': 3.00,
            '72+': 2.75
        };

        // Richardson Calculator Class
        class RichardsonCalculator {
            constructor() {
                this.lineItems = [];
                this.currentQuote = null;
                this.quoteService = new RichardsonQuoteService();
                
                // Initialize EmailJS
                emailjs.init('4qSbDO-SQs19TbP80');
                
                this.initializeElements();
                this.bindEvents();
                this.addInitialLineItem();
            }

            initializeElements() {
                // Form elements
                this.form = document.getElementById('pricingForm');
                this.customerNameInput = document.getElementById('customerName');
                this.mainSalesRep = document.getElementById('mainSalesRep');
                this.stitchCountSelect = document.getElementById('stitchCount');
                this.stitchCountGroup = document.getElementById('stitchCountGroup');
                this.lineItemsContainer = document.getElementById('lineItemsContainer');
                this.addStyleBtn = document.getElementById('addStyleBtn');
                this.embellishmentRadios = document.querySelectorAll('input[name="embellishment"]');
                
                // Setup fee elements
                this.digitizingFeeCheckbox = document.getElementById('digitizingFee');
                this.graphicDesignFeeSelect = document.getElementById('graphicDesignFee');
                this.graphicDesignCustomInput = document.getElementById('graphicDesignCustom');
                this.additionalFeesContainer = document.getElementById('additionalFeesContainer');
                this.addFeeBtn = document.getElementById('addFeeBtn');
                this.quoteNotesTextarea = document.getElementById('quoteNotes');
                this.additionalFees = [];
                
                // Results elements
                this.emptyState = document.getElementById('emptyState');
                this.resultsDisplay = document.getElementById('resultsDisplay');
                this.resultsSection = document.getElementById('resultsSection');
                this.errorDisplay = document.getElementById('errorDisplay');
                this.errorMessage = document.getElementById('errorMessage');
                
                // Modal elements
                this.modal = document.getElementById('quoteModal');
                this.modalClose = document.getElementById('modalClose');
                this.quoteForm = document.getElementById('quoteForm');
                this.quoteCustomerName = document.getElementById('quoteCustomerName');
                this.customerEmail = document.getElementById('customerEmail');
                this.customerPhone = document.getElementById('customerPhone');
                this.companyName = document.getElementById('companyName');
                this.salesRep = document.getElementById('salesRep');
                this.notes = document.getElementById('notes');
                this.quotePreview = document.getElementById('quotePreview');
                this.successMessage = document.getElementById('successMessage');
                this.errorMessage = document.getElementById('errorMessage');
                this.errorText = document.getElementById('errorText');
            }

            bindEvents() {
                this.form.addEventListener('submit', (e) => this.handleCalculate(e));
                this.addStyleBtn.addEventListener('click', () => this.addLineItem());
                this.modalClose.addEventListener('click', () => this.closeModal());
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) this.closeModal();
                });
                this.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
                
                // Update customer name in modal when main form changes
                this.customerNameInput.addEventListener('input', () => {
                    this.quoteCustomerName.value = this.customerNameInput.value;
                });

                // Handle embellishment type change
                this.embellishmentRadios.forEach(radio => {
                    radio.addEventListener('change', () => {
                        console.log('[Richardson] Embellishment changed to:', this.getSelectedEmbellishment());
                    });
                });
                
                // Handle graphic design fee change
                this.graphicDesignFeeSelect.addEventListener('change', () => {
                    const isCustom = this.graphicDesignFeeSelect.value === 'custom';
                    this.graphicDesignCustomInput.style.display = isCustom ? 'block' : 'none';
                    if (!isCustom) {
                        this.graphicDesignCustomInput.value = '';
                    }
                });
                
                // Handle add fee button
                this.addFeeBtn.addEventListener('click', () => this.addAdditionalFee());
            }

            addInitialLineItem() {
                this.addLineItem();
            }
            
            addAdditionalFee() {
                const feeId = `fee_${Date.now()}`;
                const feeHtml = `
                    <div class="additional-fee-item" data-fee-id="${feeId}">
                        <input type="text" class="form-input" placeholder="Fee name" data-fee-name>
                        <input type="number" class="form-input" placeholder="Amount" data-fee-amount min="0" step="0.01">
                        <button type="button" class="remove-fee-btn" onclick="window.richardsonCalculator.removeAdditionalFee('${feeId}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                this.additionalFeesContainer.insertAdjacentHTML('beforeend', feeHtml);
            }
            
            removeAdditionalFee(feeId) {
                const feeElement = this.additionalFeesContainer.querySelector(`[data-fee-id="${feeId}"]`);
                if (feeElement) {
                    feeElement.remove();
                }
            }
            
            calculateSetupFees() {
                const fees = {
                    digitizing: 0,
                    graphicDesign: 0,
                    additional: [],
                    total: 0
                };
                
                // Digitizing fee
                if (this.digitizingFeeCheckbox.checked) {
                    fees.digitizing = 100.00;
                }
                
                // Graphic design fee
                const graphicDesignValue = this.graphicDesignFeeSelect.value;
                if (graphicDesignValue === 'custom') {
                    fees.graphicDesign = parseFloat(this.graphicDesignCustomInput.value) || 0;
                } else {
                    fees.graphicDesign = parseFloat(graphicDesignValue) || 0;
                }
                
                // Additional fees
                const additionalFeeElements = this.additionalFeesContainer.querySelectorAll('.additional-fee-item');
                additionalFeeElements.forEach(element => {
                    const nameInput = element.querySelector('[data-fee-name]');
                    const amountInput = element.querySelector('[data-fee-amount]');
                    const name = nameInput.value.trim();
                    const amount = parseFloat(amountInput.value) || 0;
                    
                    if (name && amount > 0) {
                        fees.additional.push({ name, amount });
                    }
                });
                
                // Calculate total
                fees.total = fees.digitizing + fees.graphicDesign;
                fees.additional.forEach(fee => {
                    fees.total += fee.amount;
                });
                
                return fees;
            }

            addLineItem() {
                const lineItemId = `line-${Date.now()}`;
                const lineItem = document.createElement('div');
                lineItem.className = 'line-item';
                lineItem.id = lineItemId;
                
                lineItem.innerHTML = `
                    <div class="style-input-group">
                        <label>Style Number</label>
                        <div class="autocomplete-wrapper">
                            <input type="text" 
                                   class="form-input style-input" 
                                   placeholder="Type style number..." 
                                   autocomplete="off">
                            <div class="autocomplete-list hidden"></div>
                        </div>
                    </div>
                    <div class="quantity-input-group">
                        <label>Quantity</label>
                        <input type="number" 
                               class="form-input quantity-input" 
                               placeholder="Enter quantity" 
                               min="1">
                    </div>
                    <button type="button" class="remove-btn remove-style-btn" aria-label="Remove item">
                        <i class="fas fa-times"></i>
                        <span>Remove</span>
                    </button>
                `;
                
                this.lineItemsContainer.appendChild(lineItem);
                
                // Bind autocomplete
                const styleInput = lineItem.querySelector('.style-input');
                const autocompleteList = lineItem.querySelector('.autocomplete-list');
                this.setupAutocomplete(styleInput, autocompleteList);
                
                // Bind remove button
                const removeBtn = lineItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', () => {
                    lineItem.remove();
                });
                
                // Focus on new input
                styleInput.focus();
            }

            setupAutocomplete(input, list) {
                input.addEventListener('input', () => {
                    const value = input.value.trim().toUpperCase();
                    list.innerHTML = '';
                    
                    if (!value) {
                        list.classList.add('hidden');
                        return;
                    }
                    
                    const matches = capData.filter(cap => 
                        cap.style.toUpperCase().startsWith(value)
                    ).slice(0, 10);
                    
                    if (matches.length === 0) {
                        list.classList.add('hidden');
                        return;
                    }
                    
                    matches.forEach(cap => {
                        const item = document.createElement('div');
                        item.className = 'autocomplete-item';
                        item.innerHTML = `
                            <div class="autocomplete-style">${cap.style}</div>
                            <div class="autocomplete-description">${cap.description}</div>
                        `;
                        
                        item.addEventListener('click', () => {
                            input.value = cap.style;
                            input.dataset.style = cap.style;
                            input.dataset.description = cap.description;
                            input.dataset.price = cap.price;
                            list.classList.add('hidden');
                            
                            // Move to quantity input if it exists
                            const quantityInput = input.parentElement.parentElement.querySelector('.quantity-input');
                            if (quantityInput) {
                                quantityInput.focus();
                            }
                        });
                        
                        list.appendChild(item);
                    });
                    
                    list.classList.remove('hidden');
                });
                
                // Hide on blur
                input.addEventListener('blur', () => {
                    setTimeout(() => list.classList.add('hidden'), 200);
                });
                
                // Hide on escape
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        list.classList.add('hidden');
                    }
                });
            }

            getSelectedEmbellishment() {
                const selected = document.querySelector('input[name="embellishment"]:checked');
                return selected ? selected.value : 'embroidery';
            }

            getEmbellishmentCost(quantity) {
                const embellishmentType = this.getSelectedEmbellishment();
                
                if (embellishmentType === 'embroidery') {
                    // Get stitch count and corresponding pricing
                    const stitchCount = this.stitchCountSelect.value;
                    const tiers = embroideryCosts[stitchCount];
                    
                    // Find the appropriate tier
                    if (quantity <= 23) return tiers['1-23'];
                    if (quantity <= 47) return tiers['24-47'];
                    if (quantity <= 71) return tiers['48-71'];
                    return tiers['72+'];
                } else {
                    // Leatherette pricing (patch + labor)
                    if (quantity <= 23) return leatherettePricing['1-23'] + leatheretteLabor['1-23'];
                    if (quantity <= 47) return leatherettePricing['24-47'] + leatheretteLabor['24-47'];
                    if (quantity <= 71) return leatherettePricing['48-71'] + leatheretteLabor['48-71'];
                    return leatherettePricing['72+'] + leatheretteLabor['72+'];
                }
            }

            handleCalculate(e) {
                e.preventDefault();
                
                // Clear previous results
                this.currentQuote = null;
                
                // Get form values
                const customerName = this.customerNameInput.value.trim();
                const stitchCount = '8000'; // Always 8000
                const stitchCountText = 'Up to 8,000 stitches';
                
                console.log('[Richardson] Starting calculation with:', {
                    customer: customerName,
                    embellishment: this.getSelectedEmbellishment(),
                    stitchCount: stitchCount
                });
                
                // Collect line items
                const lineItems = [];
                const lineItemElements = this.lineItemsContainer.querySelectorAll('.line-item');
                
                let totalQuantity = 0;
                let hasErrors = false;
                
                lineItemElements.forEach(element => {
                    const styleInput = element.querySelector('.style-input');
                    const quantityInput = element.querySelector('.quantity-input');
                    
                    const style = styleInput.value.trim().toUpperCase();
                    const quantity = parseInt(quantityInput.value) || 0;
                    
                    if (!style || quantity < 1) {
                        hasErrors = true;
                        return;
                    }
                    
                    // Find cap data
                    const capInfo = capData.find(cap => cap.style === style);
                    if (!capInfo) {
                        hasErrors = true;
                        alert(`Style "${style}" not found. Please select from the list.`);
                        return;
                    }
                    
                    lineItems.push({
                        styleNumber: capInfo.style,
                        description: capInfo.description,
                        capPrice: capInfo.price,
                        quantity: quantity
                    });
                    
                    totalQuantity += quantity;
                });
                
                if (hasErrors || lineItems.length === 0) {
                    alert('Please add at least one valid style with quantity.');
                    return;
                }
                
                // Get embellishment cost based on total quantity
                const embellishmentType = this.getSelectedEmbellishment();
                const embellishmentPrice = this.getEmbellishmentCost(totalQuantity);
                
                // Calculate LTM fee
                let ltmFeeTotal = 0;
                let ltmPerUnit = 0;
                if (totalQuantity < 24) {
                    ltmFeeTotal = 50.00;
                    ltmPerUnit = ltmFeeTotal / totalQuantity;
                }
                
                // Calculate pricing for each item
                const marginDenominator = 0.6;
                let subtotal = 0;
                
                lineItems.forEach(item => {
                    const markedUpGarment = item.capPrice / marginDenominator;
                    const decoratedPrice = markedUpGarment + embellishmentPrice;
                    const basePricePerCap = Math.ceil(decoratedPrice);
                    const finalPricePerCap = basePricePerCap + ltmPerUnit;
                    const lineTotal = finalPricePerCap * item.quantity;
                    
                    item.embellishmentPrice = embellishmentPrice;
                    item.pricePerPiece = finalPricePerCap;
                    item.lineTotal = lineTotal;
                    item.ltmPerUnit = ltmPerUnit;
                    
                    subtotal += lineTotal;
                });
                
                // Calculate setup fees
                const setupFees = this.calculateSetupFees();
                const grandTotal = subtotal + setupFees.total;
                
                console.log('[Richardson] Calculation complete:', {
                    totalQuantity,
                    ltmFee: ltmFeeTotal,
                    subtotal,
                    setupFees: setupFees.total,
                    grandTotal
                });
                
                // Get sales rep information
                const salesRepEmail = this.mainSalesRep.value;
                const salesRepName = this.mainSalesRep.options[this.mainSalesRep.selectedIndex].text.split(':')[0].trim();
                
                // Get notes
                const notes = this.quoteNotesTextarea.value.trim();
                
                // Store quote data
                this.currentQuote = {
                    customerName,
                    stitchCount,
                    stitchCountText,
                    embellishmentType,
                    items: lineItems,
                    totalQuantity,
                    ltmFeeTotal,
                    subtotal,
                    setupFees,
                    grandTotal,
                    salesRepEmail,
                    salesRepName,
                    notes
                };
                
                // Save quote to database immediately
                this.saveQuoteToDatabase();
            }

            displayResults() {
                if (!this.currentQuote) return;
                
                const { items, totalQuantity, stitchCountText, embellishmentType, ltmFeeTotal, subtotal, setupFees, grandTotal, notes, quoteId } = this.currentQuote;
                
                // Use the better display method if we have a quote ID
                if (quoteId) {
                    this.displayResultsWithQuoteId();
                    return;
                }
                
                console.log('[Richardson] Displaying results (no quote ID yet)');
                
                // Build items table
                let itemsHtml = '';
                items.forEach(item => {
                    itemsHtml += `
                        <tr>
                            <td>
                                <div class="style-info">${item.styleNumber}</div>
                                <div class="style-description">${item.description}</div>
                            </td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">$${item.pricePerPiece.toFixed(2)}</td>
                            <td class="text-right">$${item.lineTotal.toFixed(2)}</td>
                        </tr>
                    `;
                });
                
                // Build embellishment display text
                let embellishmentDisplay = '';
                if (embellishmentType === 'embroidery') {
                    embellishmentDisplay = `Embroidery: ${stitchCountText}`;
                } else {
                    embellishmentDisplay = 'Leatherette Patch: 4" x 2.5"';
                }
                
                // Build complete results HTML with professional sections
                let resultsHtml = `
                    <!-- Quote Overview Section -->
                    <div class="quote-section">
                        <div class="section-header">
                            <i class="fas fa-info-circle"></i>
                            <h3>Quote Overview</h3>
                        </div>
                        <div class="quote-overview">
                            <div class="overview-item">
                                <span class="overview-label">Total Quantity</span>
                                <span class="overview-value">${totalQuantity} pieces</span>
                            </div>
                            <div class="overview-item">
                                <span class="overview-label">Embellishment Type</span>
                                <span class="overview-value" style="font-weight: 600; color: #4cb354; text-transform: uppercase;">
                                    ${embellishmentType === 'embroidery' ? 
                                        `EMBROIDERY - ${stitchCountText}` : 
                                        'LEATHERETTE PATCH - 4" x 2.5"'}
                                </span>
                            </div>
                        </div>
                        ${ltmFeeTotal > 0 ? `
                            <div class="ltm-warning" style="margin-top: 1rem;">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Less than minimum charge of $${ltmFeeTotal.toFixed(2)} has been applied ($${(ltmFeeTotal/totalQuantity).toFixed(2)}/piece)</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Products Section -->
                    <div class="quote-section products-section">
                        <div class="section-header">
                            <i class="fas fa-tshirt"></i>
                            <h3>Cap Pricing Details</h3>
                        </div>
                        <table class="quote-table">
                            <thead>
                                <tr>
                                    <th>Style</th>
                                    <th class="text-center">Qty</th>
                                    <th class="text-right">Each</th>
                                    <th class="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                        <div class="products-subtotal">
                            <span class="products-subtotal-label">Products Subtotal:</span>
                            <span class="products-subtotal-amount">$${subtotal.toFixed(2)}</span>
                        </div>
                    </div>
                `;
                
                // Add setup fees section if any
                if (setupFees.total > 0) {
                    resultsHtml += `
                        <!-- Setup Fees Section -->
                        <div class="quote-section">
                            <div class="section-header">
                                <i class="fas fa-cogs"></i>
                                <h3>Setup & Additional Fees</h3>
                            </div>
                            <div class="setup-fees-section">
                    `;
                    
                    if (setupFees.digitizing > 0) {
                        resultsHtml += `
                            <div class="fee-item">
                                <span class="fee-label">Digitizing Fee</span>
                                <span class="fee-amount">$${setupFees.digitizing.toFixed(2)}</span>
                            </div>
                        `;
                    }
                    
                    if (setupFees.graphicDesign > 0) {
                        resultsHtml += `
                            <div class="fee-item">
                                <span class="fee-label">Graphic Design Fee</span>
                                <span class="fee-amount">$${setupFees.graphicDesign.toFixed(2)}</span>
                            </div>
                        `;
                    }
                    
                    setupFees.additional.forEach(fee => {
                        resultsHtml += `
                            <div class="fee-item">
                                <span class="fee-label">${fee.name}</span>
                                <span class="fee-amount">$${fee.amount.toFixed(2)}</span>
                            </div>
                        `;
                    });
                    
                    resultsHtml += `
                                <div class="fees-subtotal">
                                    <span>Setup Fees Total:</span>
                                    <span>$${setupFees.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Add notes section if any
                if (notes) {
                    resultsHtml += `
                        <!-- Notes Section -->
                        <div class="quote-section">
                            <div class="notes-section">
                                <div class="notes-header">
                                    <i class="fas fa-sticky-note"></i>
                                    <span>Notes</span>
                                </div>
                                <div class="notes-content">${notes}</div>
                            </div>
                        </div>
                    `;
                }
                
                // Grand Total Section
                resultsHtml += `
                    <!-- Grand Total Section -->
                    <div class="quote-section">
                        <div class="grand-total-section">
                            <div class="grand-total-label">Your Total Quote Amount</div>
                            <div class="grand-total-amount">$${grandTotal.toFixed(2)}</div>
                        </div>
                    </div>
                `;
                
                // Update display
                this.resultsDisplay.innerHTML = resultsHtml;
                this.resultsDisplay.classList.remove('hidden');
                if (this.emptyState) {
                    this.emptyState.classList.add('hidden');
                }
                this.hideError();
                
                // Show the results section
                if (this.resultsSection) {
                    this.resultsSection.style.display = 'block';
                }
            }

            async saveQuoteToDatabase() {
                if (!this.currentQuote) return;
                
                try {
                    // Show loading state
                    this.showGeneratingState();
                    
                    // Build quote data for database
                    const quoteData = {
                        customerName: this.currentQuote.customerName,
                        customerEmail: this.customerNameInput.value, // Will be filled from form
                        companyName: '', // Will be filled from form
                        customerPhone: '', // Will be filled from form
                        items: this.currentQuote.items,
                        totalQuantity: this.currentQuote.totalQuantity,
                        subtotal: this.currentQuote.subtotal,
                        setupFees: this.currentQuote.setupFees,
                        ltmFeeTotal: this.currentQuote.ltmFeeTotal,
                        grandTotal: this.currentQuote.grandTotal,
                        embellishmentType: this.currentQuote.embellishmentType,
                        stitchCount: this.currentQuote.stitchCount,
                        notes: this.currentQuote.notes,
                        salesRepEmail: this.currentQuote.salesRepEmail,
                        salesRepName: this.currentQuote.salesRepName
                    };
                    
                    // Save to database
                    const saveResult = await this.quoteService.saveQuote(quoteData);
                    
                    if (saveResult.success) {
                        // Store quote ID
                        this.currentQuote.quoteId = saveResult.quoteID;
                        
                        // Update display with quote ID
                        this.displayResults();
                        
                        // Update button states
                        this.enableQuoteActions();
                        
                        console.log('[Richardson] Quote saved successfully with ID:', saveResult.quoteID);
                        console.log('[Richardson] Quote details:', {
                            id: saveResult.quoteID,
                            items: this.currentQuote.items.length,
                            total: this.currentQuote.grandTotal
                        });
                    } else {
                        console.error('[Richardson] Failed to save quote:', saveResult.error);
                        this.showError('Failed to save quote. Please try again.');
                    }
                } catch (error) {
                    console.error('[Richardson] Error saving quote:', error);
                    this.showError('Error saving quote. Please try again.');
                }
            }

            showGeneratingState() {
                // Show loading state in results
                this.resultsDisplay.innerHTML = `
                    <div class="generating-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <h3>Generating Quote...</h3>
                        <p>Calculating pricing and saving to database</p>
                    </div>
                `;
                this.resultsDisplay.classList.remove('hidden');
                if (this.emptyState) {
                    if (this.emptyState) {
                        this.emptyState.classList.add('hidden');
                    }
                }
                this.hideError();
            }

            displayResultsWithQuoteId() {
                if (!this.currentQuote) return;
                
                const { items, totalQuantity, stitchCountText, embellishmentType, ltmFeeTotal, subtotal, setupFees, grandTotal, notes, quoteId } = this.currentQuote;
                
                console.log('[Richardson] Displaying results with Quote ID:', quoteId);
                
                // Build items table with clean structure
                let itemsHtml = '';
                items.forEach(item => {
                    itemsHtml += `
                        <tr>
                            <td class="style-column">
                                <div class="style-number">${item.styleNumber}</div>
                                <div class="style-description">${item.description}</div>
                            </td>
                            <td class="quantity-column">${item.quantity}</td>
                            <td class="price-column">$${item.pricePerPiece.toFixed(2)}</td>
                            <td class="total-column">$${item.lineTotal.toFixed(2)}</td>
                        </tr>
                    `;
                });

                // Build setup fees HTML with modern card design
                let setupFeesHtml = '';
                if (setupFees && setupFees.total > 0) {
                    setupFeesHtml += `
                        <div class="quote-card setup-fees-card">
                            <div class="card-header">
                                <h3 class="card-title">Setup Fees</h3>
                            </div>
                            <div class="fees-list">
                    `;
                    
                    if (setupFees.digitizing > 0) {
                        setupFeesHtml += `
                            <div class="fee-row">
                                <span class="fee-label">Digitizing Fee</span>
                                <span class="fee-amount">$${setupFees.digitizing.toFixed(2)}</span>
                            </div>
                        `;
                    }
                    
                    if (setupFees.graphicDesign > 0) {
                        setupFeesHtml += `
                            <div class="fee-row">
                                <span class="fee-label">Graphic Design Fee</span>
                                <span class="fee-amount">$${setupFees.graphicDesign.toFixed(2)}</span>
                            </div>
                        `;
                    }
                    
                    if (setupFees.additional && setupFees.additional.length > 0) {
                        setupFees.additional.forEach(fee => {
                            setupFeesHtml += `
                                <div class="fee-row">
                                    <span class="fee-label">${fee.name}</span>
                                    <span class="fee-amount">$${fee.amount.toFixed(2)}</span>
                                </div>
                            `;
                        });
                    }
                    
                    setupFeesHtml += `
                                <div class="fee-total-row">
                                    <span class="fee-total-label">Total Setup Fees</span>
                                    <span class="fee-total-amount">$${setupFees.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // Build notes HTML with clean design
                let notesHtml = '';
                if (notes) {
                    notesHtml = `
                        <div class="quote-card notes-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="fas fa-sticky-note"></i>
                                    Notes
                                </h3>
                            </div>
                            <div class="notes-content">
                                ${notes}
                            </div>
                        </div>
                    `;
                }

                // Build complete results HTML with modern layout
                const resultsHtml = `
                    <!-- Quote Overview Card -->
                    <div class="quote-card customer-info-card">
                        <div class="card-header">
                            <h3 class="card-title">Quote Overview</h3>
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Total Quantity</span>
                                <span class="info-value">${totalQuantity} pieces</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Embellishment Type</span>
                                <span class="info-value" style="font-weight: 600; color: var(--primary-green); text-transform: uppercase;">
                                    ${embellishmentType === 'embroidery' ? 
                                        `EMBROIDERY - ${stitchCountText}` : 
                                        'LEATHERETTE PATCH - 4" x 2.5"'}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${ltmFeeTotal > 0 ? `
                        <div class="ltm-notice">
                            <i class="fas fa-info-circle"></i>
                            <div class="ltm-content">
                                <strong>Less Than Minimum Fee Applied</strong>
                                <p>A fee of $${ltmFeeTotal.toFixed(2)} has been added ($${(ltmFeeTotal/totalQuantity).toFixed(2)} per piece) for orders under 24 pieces.</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Pricing Table Card -->
                    <div class="quote-card pricing-card">
                        <div class="card-header">
                            <h3 class="card-title">Cap Pricing Details</h3>
                        </div>
                        <div class="pricing-table-wrapper">
                            <table class="pricing-table">
                                <thead>
                                    <tr>
                                        <th class="style-column">Style</th>
                                        <th class="quantity-column">Qty</th>
                                        <th class="price-column">Each</th>
                                        <th class="total-column">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                                <tfoot>
                                    <tr class="subtotal-row">
                                        <td colspan="3" class="subtotal-label">Products Subtotal:</td>
                                        <td class="subtotal-amount">$${subtotal.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    ${setupFeesHtml}
                    
                    <!-- Compact Price Summary Bar -->
                    <div class="quote-summary-bar">
                        <div class="summary-item">
                            <span class="summary-label">Type:</span>
                            <span class="summary-value" style="font-weight: 600;">
                                ${embellishmentType === 'embroidery' ? 'EMBROIDERY' : 'LEATHERETTE'}
                            </span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Quantity:</span>
                            <span class="summary-value">${totalQuantity} caps</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Price per cap:</span>
                            <span class="summary-value">$${(grandTotal/totalQuantity).toFixed(2)}</span>
                        </div>
                        <div class="summary-total">
                            <span class="total-label">Total:</span>
                            <span class="total-value">$${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    ${notesHtml}
                    
                    <!-- Action Buttons -->
                    <div class="action-buttons">
                        <button type="button" class="btn btn-print" id="printQuoteBtn">
                            <i class="fas fa-print"></i>
                            <span>Print Quote</span>
                            <span class="quote-ref">${quoteId}</span>
                        </button>
                        <button type="button" class="btn btn-send" id="sendQuoteBtn">
                            <i class="fas fa-paper-plane"></i>
                            <span>Send Quote</span>
                            <span class="quote-ref">${quoteId}</span>
                        </button>
                        <button type="button" class="btn btn-new" id="newQuoteBtn">
                            <i class="fas fa-plus"></i>
                            <span>New Quote</span>
                        </button>
                    </div>
                `;
                
                // Update display
                this.resultsDisplay.innerHTML = resultsHtml;
                this.resultsDisplay.classList.remove('hidden');
                if (this.emptyState) {
                    this.emptyState.classList.add('hidden');
                }
                this.hideError();
                
                // Show the results section
                if (this.resultsSection) {
                    this.resultsSection.style.display = 'block';
                }
                
                // Bind quote action buttons with proper checks to avoid duplicates
                const printBtn = document.getElementById('printQuoteBtn');
                const sendBtn = document.getElementById('sendQuoteBtn');
                const newBtn = document.getElementById('newQuoteBtn');
                
                if (printBtn && !printBtn.hasAttribute('data-listener-added')) {
                    printBtn.setAttribute('data-listener-added', 'true');
                    printBtn.addEventListener('click', () => {
                        console.log('[Richardson] Print button clicked');
                        this.printQuote();
                    });
                }
                
                if (sendBtn && !sendBtn.hasAttribute('data-listener-added')) {
                    sendBtn.setAttribute('data-listener-added', 'true');
                    sendBtn.addEventListener('click', () => {
                        console.log('[Richardson] Send button clicked');
                        this.openModal();
                    });
                }
                
                if (newBtn && !newBtn.hasAttribute('data-listener-added')) {
                    newBtn.setAttribute('data-listener-added', 'true');
                    newBtn.addEventListener('click', () => {
                        console.log('[Richardson] New Quote button clicked');
                        this.startNewQuote();
                    });
                }
            }

            enableQuoteActions() {
                // This function is no longer needed since buttons are enabled by default
                // Kept for backward compatibility but does nothing
                console.log('[Richardson] Quote actions are already enabled');
            }

            printQuote() {
                if (!this.currentQuote || !this.currentQuote.quoteId) {
                    alert('Please generate a quote first');
                    return;
                }
                
                // Create a new window for printing
                const printWindow = window.open('', '_blank');
                const quote = this.currentQuote;
                const quoteID = quote.quoteId;
                
                // Calculate pricing details
                const hasLTM = quote.totalQuantity < 24;
                let basePricePerCap = 0;
                let ltmPerUnit = 0;
                
                if (hasLTM && quote.items.length > 0) {
                    ltmPerUnit = quote.items[0].ltmPerUnit || 0;
                    basePricePerCap = quote.items[0].pricePerPiece - ltmPerUnit;
                }

                // Generate items HTML
                const itemsHtml = quote.items.map(item => `
                    <tr>
                        <td><strong>${item.styleNumber}</strong> - ${item.description}</td>
                        <td style="text-align: center;">${item.quantity}</td>
                        <td style="text-align: right;">$${item.pricePerPiece.toFixed(2)}</td>
                        <td style="text-align: right;">$${item.lineTotal.toFixed(2)}</td>
                    </tr>
                `).join('');

                // Setup fees in table rows
                let setupFeesRows = '';
                if (quote.setupFees && quote.setupFees.total > 0) {
                    if (quote.setupFees.digitizing > 0) {
                        setupFeesRows += `
                            <tr>
                                <td colspan="3" style="text-align: right;">Digitizing Fee:</td>
                                <td style="text-align: right;">$${quote.setupFees.digitizing.toFixed(2)}</td>
                            </tr>
                        `;
                    }
                    if (quote.setupFees.graphicDesign > 0) {
                        setupFeesRows += `
                            <tr>
                                <td colspan="3" style="text-align: right;">Graphic Design Fee:</td>
                                <td style="text-align: right;">$${quote.setupFees.graphicDesign.toFixed(2)}</td>
                            </tr>
                        `;
                    }
                    quote.setupFees.additional.forEach(fee => {
                        setupFeesRows += `
                            <tr>
                                <td colspan="3" style="text-align: right;">${fee.name}:</td>
                                <td style="text-align: right;">$${fee.amount.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                }

                // LTM info for notes
                let ltmNote = '';
                if (hasLTM) {
                    ltmNote = `Price includes $${ltmPerUnit.toFixed(2)} per unit minimum order adjustment. `;
                }

                // Notes text
                let notesText = ltmNote;
                if (quote.notes) {
                    notesText += quote.notes;
                }
                
                // Build compact invoice-style HTML
                const printHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Quote ${quoteID} - Northwest Custom Apparel</title>
                        <style>
                            @page { 
                                margin: 0.5in;
                                size: letter;
                            }
                            body { 
                                font-family: Arial, sans-serif; 
                                font-size: 12px;
                                line-height: 1.4; 
                                color: #333;
                                margin: 0;
                            }
                            /* Compact header */
                            .invoice-header {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-start;
                                margin-bottom: 20px;
                                padding-bottom: 10px;
                                border-bottom: 2px solid #4cb354;
                            }
                            .company-info {
                                flex: 1;
                            }
                            .logo {
                                max-width: 150px;
                                height: auto;
                                margin-bottom: 5px;
                            }
                            .company-info p {
                                margin: 2px 0;
                                font-size: 11px;
                                color: #555;
                            }
                            .invoice-title {
                                text-align: right;
                                flex: 1;
                            }
                            .invoice-title h1 {
                                margin: 0;
                                font-size: 24px;
                                color: #333;
                            }
                            .invoice-title .quote-id {
                                font-size: 16px;
                                color: #4cb354;
                                margin: 5px 0;
                            }
                            .invoice-title p {
                                margin: 2px 0;
                                font-size: 11px;
                                color: #555;
                            }
                            
                            /* Customer info box */
                            .info-row {
                                display: flex;
                                gap: 20px;
                                margin-bottom: 20px;
                            }
                            .info-box {
                                flex: 1;
                                background: #f8f9fa;
                                padding: 10px;
                                border-radius: 4px;
                            }
                            .info-box h3 {
                                margin: 0 0 5px 0;
                                font-size: 12px;
                                color: #4cb354;
                                text-transform: uppercase;
                            }
                            .info-box p {
                                margin: 2px 0;
                                font-size: 11px;
                            }
                            
                            /* Compact table */
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 20px;
                            }
                            th, td {
                                padding: 6px 8px;
                                text-align: left;
                                border: 1px solid #ddd;
                                font-size: 11px;
                            }
                            th {
                                background: #4cb354;
                                color: white;
                                font-weight: bold;
                                text-transform: uppercase;
                            }
                            .subtotal-row td {
                                border-top: 2px solid #ddd;
                                font-weight: bold;
                            }
                            .total-row td {
                                background: #f8f9fa;
                                font-weight: bold;
                                font-size: 13px;
                                border-top: 2px solid #4cb354;
                            }
                            
                            /* Notes section */
                            .notes-section {
                                background: #fff3cd;
                                border: 1px solid #ffeaa7;
                                padding: 8px;
                                border-radius: 4px;
                                margin-bottom: 20px;
                                font-size: 11px;
                            }
                            .notes-section h4 {
                                margin: 0 0 4px 0;
                                font-size: 12px;
                                color: #856404;
                            }
                            
                            /* Compact footer */
                            .footer {
                                text-align: center;
                                font-size: 10px;
                                color: #666;
                                border-top: 1px solid #ddd;
                                padding-top: 10px;
                            }
                            .footer p {
                                margin: 2px 0;
                            }
                            
                            @media print {
                                body { 
                                    print-color-adjust: exact; 
                                    -webkit-print-color-adjust: exact; 
                                }
                                .invoice-header {
                                    break-after: avoid;
                                }
                                table {
                                    break-inside: avoid;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <!-- Compact header with logo and invoice info side by side -->
                        <div class="invoice-header">
                            <div class="company-info">
                                <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                                     alt="Northwest Custom Apparel" class="logo">
                                <p>2025 Freeman Road East, Milton, WA 98354</p>
                                <p>Phone: 253-922-5793 | sales@nwcustomapparel.com</p>
                            </div>
                            <div class="invoice-title">
                                <h1>QUOTE</h1>
                                <div class="quote-id">${quoteID}</div>
                                <p>Date: ${new Date().toLocaleDateString()}</p>
                                <p>Valid for: 30 days</p>
                            </div>
                        </div>
                        
                        <!-- Customer info in compact box -->
                        <div class="info-row">
                            <div class="info-box">
                                <h3>Bill To</h3>
                                <p><strong>${quote.customerName || 'Customer'}</strong></p>
                                ${quote.companyName ? `<p>${quote.companyName}</p>` : ''}
                                ${quote.customerEmail ? `<p>${quote.customerEmail}</p>` : ''}
                                ${quote.customerPhone ? `<p>${quote.customerPhone}</p>` : ''}
                            </div>
                        </div>
                        
                        <!-- Embellishment Type Section -->
                        <div style="background: #f0f7f1; border: 2px solid #4cb354; border-radius: 6px; padding: 10px; margin: 15px 0;">
                            <h3 style="margin: 0 0 5px 0; color: #4cb354; font-size: 14px;">EMBELLISHMENT TYPE</h3>
                            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                                ${quote.embellishmentType === 'embroidery' ? 
                                    `EMBROIDERY - ${quote.stitchCountText || 'Up to 8,000 stitches'}` : 
                                    'LEATHERETTE PATCH - 4" x 2.5" Premium Patch'}
                            </p>
                        </div>
                        
                        <!-- Compact pricing table -->
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50%;">Description</th>
                                    <th style="width: 15%; text-align: center;">Qty</th>
                                    <th style="width: 17.5%; text-align: right;">Unit Price</th>
                                    <th style="width: 17.5%; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                                <tr class="subtotal-row">
                                    <td colspan="3" style="text-align: right;">Products Subtotal:</td>
                                    <td style="text-align: right;">$${quote.subtotal.toFixed(2)}</td>
                                </tr>
                                ${setupFeesRows}
                                <tr class="total-row">
                                    <td colspan="3" style="text-align: right;">GRAND TOTAL:</td>
                                    <td style="text-align: right;">$${quote.grandTotal.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>

                        ${notesText ? `
                        <div class="notes-section">
                            <h4>Notes</h4>
                            <p>${notesText}</p>
                        </div>
                        ` : ''}
                        
                        <div class="footer">
                            <p><strong>Northwest Custom Apparel</strong> | Family Owned & Operated Since 1977</p>
                            <p>www.nwcustomapparel.com</p>
                        </div>
                    </body>
                    </html>
                `;
                
                printWindow.document.write(printHTML);
                printWindow.document.close();
                
                // Wait for content to load then print
                printWindow.onload = function() {
                    printWindow.print();
                    // Close the window after printing
                    printWindow.onafterprint = function() {
                        printWindow.close();
                    };
                };
            }

            showError(message) {
                // Use error display div if available, otherwise fallback to alert
                if (this.errorDisplay && this.errorMessage) {
                    this.errorMessage.textContent = message;
                    this.errorDisplay.classList.remove('hidden');
                    console.error('[Richardson] Error displayed:', message);
                } else {
                    alert(message);
                }
            }
            
            hideError() {
                if (this.errorDisplay) {
                    this.errorDisplay.classList.add('hidden');
                }
            }

            openModal() {
                // Pre-fill customer name
                this.quoteCustomerName.value = this.customerNameInput.value;
                
                // Pre-fill sales rep from main form
                if (this.mainSalesRep && this.salesRep) {
                    this.salesRep.value = this.mainSalesRep.value;
                }
                
                // Show quote preview
                this.updateQuotePreview();
                
                // Reset messages
                this.successMessage.classList.add('hidden');
                this.errorMessage.classList.add('hidden');
                
                // Show modal
                this.modal.classList.add('active');
                
                // Focus on email field if name is filled
                if (this.quoteCustomerName.value) {
                    this.customerEmail.focus();
                } else {
                    this.quoteCustomerName.focus();
                }
            }

            closeModal() {
                this.modal.classList.remove('active');
            }

            updateQuotePreview() {
                if (!this.currentQuote) return;
                
                const { totalQuantity, grandTotal } = this.currentQuote;
                
                this.quotePreview.innerHTML = `
                    <div class="summary-row">
                        <span class="summary-label">Items:</span>
                        <span class="summary-value">${this.currentQuote.items.length} styles</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">Total Quantity:</span>
                        <span class="summary-value">${totalQuantity} pieces</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">Total:</span>
                        <span class="summary-value">$${grandTotal.toFixed(2)}</span>
                    </div>
                `;
            }

            generateSetupFeesHTML(setupFees) {
                if (!setupFees || setupFees.total === 0) return '';
                
                let html = '<div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">';
                html += '<h4 style="margin: 0 0 10px 0; font-size: 16px;">Setup Fees</h4>';
                
                if (setupFees.digitizing > 0) {
                    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Digitizing Fee:</span>
                        <span>$${setupFees.digitizing.toFixed(2)}</span>
                    </div>`;
                }
                
                if (setupFees.graphicDesign > 0) {
                    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Graphic Design Fee:</span>
                        <span>$${setupFees.graphicDesign.toFixed(2)}</span>
                    </div>`;
                }
                
                if (setupFees.additional && setupFees.additional.length > 0) {
                    setupFees.additional.forEach(fee => {
                        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>${fee.name}:</span>
                            <span>$${fee.amount.toFixed(2)}</span>
                        </div>`;
                    });
                }
                
                html += `<div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #dee2e6; font-weight: bold;">
                    <span>Setup Fees Total:</span>
                    <span>$${setupFees.total.toFixed(2)}</span>
                </div>`;
                
                html += '</div>';
                return html;
            }

            async handleQuoteSubmit(e) {
                e.preventDefault();
                
                if (!this.currentQuote || !this.currentQuote.quoteId) {
                    alert('Please generate a quote first before emailing');
                    return;
                }
                
                // Show loading state
                const submitBtn = this.quoteForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
                submitBtn.disabled = true;
                
                try {
                    // Get selected sales rep
                    const selectedRep = this.salesRep.value;
                    if (!selectedRep) {
                        throw new Error('Please select a sales representative');
                    }
                    
                    // Map sales rep emails to names
                    const salesRepNames = {
                        'ruth@nwcustomapparel.com': 'Ruth Nhong',
                        'taylar@nwcustomapparel.com': 'Taylar Hanson',
                        'nika@nwcustomapparel.com': 'Nika Lao',
                        'taneisha@nwcustomapparel.com': 'Taneisha Clark',
                        'erik@nwcustomapparel.com': 'Erik Mickelson',
                        'adriyella@nwcustomapparel.com': 'Adriyella',
                        'bradley@nwcustomapparel.com': 'Bradley Wright',
                        'jim@nwcustomapparel.com': 'Jim Mickelson',
                        'art@nwcustomapparel.com': 'Steve Deland',
                        'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
                    };
                    
                    // Use existing saved quote - no need to save again
                    const quoteData = {
                        ...this.currentQuote,
                        customerEmail: this.customerEmail.value,
                        customerName: this.quoteCustomerName.value,
                        customerPhone: this.customerPhone.value,
                        companyName: this.companyName.value,
                        notes: this.notes.value,
                        salesRepEmail: selectedRep,
                        salesRepName: salesRepNames[selectedRep]
                    };
                    
                    // Build items table for email
                    let itemsHtml = '';
                    this.currentQuote.items.forEach(item => {
                        itemsHtml += `
                            <tr>
                                <td>
                                    <strong>${item.styleNumber}</strong><br>
                                    ${item.description}
                                </td>
                                <td style="text-align: center;">${item.quantity}</td>
                                <td style="text-align: right;">$${item.pricePerPiece.toFixed(2)}</td>
                                <td style="text-align: right;">$${item.lineTotal.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                    
                    // Build embellishment summary for email
                    let embellishmentSummary = '';
                    if (this.currentQuote.embellishmentType === 'embroidery') {
                        embellishmentSummary = `${this.currentQuote.totalQuantity} pieces with ${this.currentQuote.stitchCountText.toLowerCase()}`;
                    } else {
                        embellishmentSummary = `${this.currentQuote.totalQuantity} pieces with leatherette patch`;
                    }
                    
                    // Build price breakdown HTML for email
                    let priceBreakdownHtml = '';
                    if (this.currentQuote.totalQuantity < 24 && this.currentQuote.items.length > 0) {
                        const ltmPerUnit = this.currentQuote.items[0].ltmPerUnit || 0;
                        const basePricePerCap = this.currentQuote.items[0].pricePerPiece - ltmPerUnit;
                        
                        priceBreakdownHtml = `
                            <div style="background-color: #f0f7f1; padding: 15px; margin: 20px 0; border: 1px solid #c6e9d0; border-radius: 6px;">
                                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1f2937;">Price Breakdown:</h4>
                                <table style="width: 100%; font-size: 13px;">
                                    <tr>
                                        <td>Base cap with ${this.currentQuote.embellishmentType === 'embroidery' ? 'embroidery' : 'leatherette patch'}:</td>
                                        <td style="text-align: right;">$${basePricePerCap.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td>Minimum order adjustment:</td>
                                        <td style="text-align: right;">$${ltmPerUnit.toFixed(2)}</td>
                                    </tr>
                                    <tr style="font-weight: bold; border-top: 1px solid #c6e9d0;">
                                        <td style="padding-top: 5px;">Your price per cap:</td>
                                        <td style="text-align: right; padding-top: 5px;">$${this.currentQuote.items[0].pricePerPiece.toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>
                        `;
                    }
                    
                    // Prepare email data using existing quote ID
                    const emailData = {
                        to_email: this.customerEmail.value,
                        reply_to: quoteData.salesRepEmail,
                        from_name: 'Northwest Custom Apparel',
                        customer_name: this.quoteCustomerName.value,
                        company_name: this.companyName.value || '',
                        customer_email: this.customerEmail.value,
                        customer_phone: this.customerPhone.value || '',
                        project_name: 'Richardson Cap Quote',
                        quote_id: this.currentQuote.quoteId, // Use existing quote ID
                        quote_date: new Date().toLocaleDateString(),
                        quote_type: 'Richardson Caps',
                        total_quantity: this.currentQuote.totalQuantity,
                        embellishment_type: this.currentQuote.embellishmentType === 'embroidery' ? 'Embroidery' : 'Leatherette Patch',
                        stitch_count: this.currentQuote.stitchCountText || '',
                        quote_summary: embellishmentSummary,
                        quote_items_html: itemsHtml,
                        products_subtotal: `$${this.currentQuote.subtotal.toFixed(2)}`,
                        subtotal: `$${this.currentQuote.subtotal.toFixed(2)}`,
                        ltm_fee_total: this.currentQuote.ltmFeeTotal > 0 ? `$${this.currentQuote.ltmFeeTotal.toFixed(2)}` : '',
                        ltm_note: this.currentQuote.ltmFeeTotal > 0 ? `*Includes less than minimum charge of $${this.currentQuote.ltmFeeTotal.toFixed(2)} ($${(this.currentQuote.ltmFeeTotal/this.currentQuote.totalQuantity).toFixed(2)}/piece)` : '',
                        setup_fees_html: this.generateSetupFeesHTML(this.currentQuote.setupFees),
                        setup_fees_total: this.currentQuote.setupFees?.total > 0 ? `$${this.currentQuote.setupFees.total.toFixed(2)}` : '',
                        digitizing_fee: this.currentQuote.setupFees?.digitizing > 0 ? `$${this.currentQuote.setupFees.digitizing.toFixed(2)}` : '',
                        graphic_design_fee: this.currentQuote.setupFees?.graphicDesign > 0 ? `$${this.currentQuote.setupFees.graphicDesign.toFixed(2)}` : '',
                        price_breakdown_html: priceBreakdownHtml,
                        grand_total: `$${this.currentQuote.grandTotal.toFixed(2)}`,
                        sales_rep_name: quoteData.salesRepName,
                        sales_rep_email: quoteData.salesRepEmail,
                        sales_rep_phone: '253-922-5793',
                        company_year: '1977',
                        notes: this.notes.value || 'No special notes for this order',
                        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
                    };
                    
                    // Send email
                    await emailjs.send(
                        'service_1c4k67j',
                        'Richardson_Template',
                        emailData
                    );
                    
                    // Show success
                    this.successMessage.classList.remove('hidden');
                    this.errorMessage.classList.add('hidden');
                    
                    // Update success message to show quote ID
                    const successText = this.successMessage.querySelector('p') || this.successMessage;
                    successText.innerHTML = `Quote sent successfully!<br><strong>Quote ID: ${this.currentQuote.quoteId}</strong>`;
                    
                    // Update quote status to show it was emailed
                    this.updateQuoteStatus('emailed', `Emailed to ${this.customerEmail.value}`);
                    
                    // Reset form after delay
                    setTimeout(() => {
                        this.closeModal();
                        this.quoteForm.reset();
                    }, 3000);
                    
                } catch (error) {
                    console.error('Error sending quote:', error);
                    this.errorText.textContent = 'Failed to send quote. Please try again.';
                    this.errorMessage.classList.remove('hidden');
                    this.successMessage.classList.add('hidden');
                } finally {
                    // Restore button
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }

            startNewQuote() {
                // Confirm if the user wants to start a new quote
                if (confirm('Are you sure you want to start a new quote? This will clear your current quote and reset the form.')) {
                    // Reset the current quote
                    this.currentQuote = null;
                    
                    // Reset the form
                    this.calculatorForm.reset();
                    
                    // Clear the results display
                    this.resultsDisplay.innerHTML = '';
                    this.resultsDisplay.classList.add('hidden');
                    if (this.emptyState) {
                        this.emptyState.classList.remove('hidden');
                    }
                    
                    // Reset line items to just one
                    this.lineItems = [];
                    this.addInitialLineItem();
                    
                    // Reset customer name
                    this.customerNameInput.value = '';
                    
                    // Reset sales rep
                    this.mainSalesRep.value = '';
                    
                    // Show success message
                    const notification = document.createElement('div');
                    notification.className = 'notification success';
                    notification.innerHTML = '<i class="fas fa-check-circle"></i> New quote started! You can now enter new quote details.';
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #d4edda;
                        color: #155724;
                        padding: 1rem 1.5rem;
                        border-radius: 6px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        z-index: 1000;
                        max-width: 300px;
                        border: 1px solid #c3e6cb;
                    `;
                    
                    document.body.appendChild(notification);
                    
                    // Remove notification after 3 seconds
                    setTimeout(() => {
                        notification.remove();
                    }, 3000);
                }
            }

            updateQuoteStatus(status, message) {
                const statusElement = document.getElementById('quoteStatus');
                if (statusElement) {
                    statusElement.className = `quote-status-value ${status}`;
                    statusElement.textContent = message;
                    
                    // Update the icon based on status
                    const statusIcon = statusElement.closest('.quote-status-content').querySelector('i');
                    if (statusIcon) {
                        statusIcon.className = status === 'emailed' ? 'fas fa-envelope' : 'fas fa-check-circle';
                    }
                }
            }
        }
