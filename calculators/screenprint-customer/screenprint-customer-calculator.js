/**
 * Customer Supplied Screen Print Calculator
 * Handles pricing calculations and quote generation for customer supplied screen printing
 *
 * PRICING = API, NEVER HARDCODED (CLAUDE.md Rule 9 — 3 price surfaces = ONE engine).
 * All pricing runs through window.QuoteCartEngine.singleItemPreview() + ScreenPrintPricingService —
 * the SAME authority Quick Quote and the staff Screen Print Quote Builder use, with
 * `customerSuppliedGarment:true` (garment cost forced to $0 via generateManualPricingData(0),
 * since the customer brings their own blank). Zero local price formulas — if the live
 * pricing API is unreachable, this calculator shows a visible error, never a stale/guessed price.
 */
class CustomerScreenPrintCalculator {
    constructor() {
        // SCP pooling group id for this calculator's single-design orders (quote-cart-engine.js groupId convention)
        this.SCP_GROUP_ID = 'scp:customer-supplied';
        // No real garment is ordered — this is a display-only label. Print/tier/LTM data
        // is style-independent, so any reference string works (customerSuppliedGarment
        // mode never looks up a real product by this value).
        this.REFERENCE_STYLE = 'CUSTOMER-SUPPLIED';

        // Initialize elements
        this.initializeElements();

        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        this.emailConfig = {
            serviceId: 'service_jgrave3',
            templateId: 'template_igd6jtm'
        };

        // Initialize quote service
        this.quoteService = new CustomerScreenPrintQuoteService();

        // Store current calculation
        this.currentCalculation = null;
        this.lastQuoteData = null;

        // Guards against out-of-order async pricing responses (a fast second edit
        // must win over a slow first one)
        this.requestSeq = 0;
        this.debounceTimer = null;

        // Attach event listeners
        this.attachEventListeners();

        // Initial display
        this.resetDisplay("Enter Details");
    }

    initializeElements() {
        // Calculator inputs
        this.quantity = document.getElementById('quantity');
        this.frontColors = document.getElementById('frontColors');
        this.backColors = document.getElementById('backColors');
        this.darkShirtToggle = document.getElementById('darkShirtToggle');
        this.safetyStripesToggle = document.getElementById('safetyStripesToggle');
        this.safetyStripesNotice = document.getElementById('safetyStripesNotice');

        // Display elements
        this.priceDisplay = document.getElementById('priceDisplay');
        this.orderSummary = document.getElementById('orderSummary');
        this.tierLadder = document.getElementById('tierLadder');
        this.pricingError = document.getElementById('pricingError');
        this.quoteActions = document.getElementById('quoteActions');

        // Quote form elements
        this.quoteForm = document.getElementById('quoteForm');
        this.customerName = document.getElementById('customerName');
        this.customerEmail = document.getElementById('customerEmail');
        this.customerPhone = document.getElementById('customerPhone');
        this.companyName = document.getElementById('companyName');
        this.projectName = document.getElementById('projectName');
        this.salesRep = document.getElementById('salesRep');
        this.notes = document.getElementById('notes');
        this.saveToDatabase = document.getElementById('saveToDatabase');
        this.quotePreview = document.getElementById('quotePreview');

        // Buttons
        this.sendQuoteBtn = document.getElementById('sendQuoteBtn');
        this.submitQuoteBtn = document.getElementById('submitQuoteBtn');
    }

    attachEventListeners() {
        // Calculator inputs (debounced — each keystroke would otherwise fire a live API call)
        this.quantity.addEventListener('input', () => this.scheduleCalculate());
        this.frontColors.addEventListener('change', () => this.scheduleCalculate());
        this.backColors.addEventListener('change', () => this.scheduleCalculate());
        this.darkShirtToggle.addEventListener('change', () => this.scheduleCalculate());
        this.safetyStripesToggle.addEventListener('change', () => {
            this.safetyStripesNotice.style.display = this.safetyStripesToggle.checked ? 'block' : 'none';
            this.scheduleCalculate();
        });

        // Quote form
        this.sendQuoteBtn.addEventListener('click', () => this.openQuoteModal());
        this.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
    }

    scheduleCalculate() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.calculatePrice(), 300);
    }

    async calculatePrice() {
        const quantity = parseInt(this.quantity.value, 10) || 0;
        const frontColors = parseInt(this.frontColors.value, 10) || 0;
        const backColors = parseInt(this.backColors.value, 10) || 0;
        const isDarkGarment = this.darkShirtToggle.checked;
        const hasSafetyStripes = this.safetyStripesToggle.checked;

        this.hidePricingError();

        if (quantity <= 0) {
            this.resetDisplay("Enter Quantity");
            return;
        }
        if (frontColors < 1) {
            this.resetDisplay("Select Front Colors");
            return;
        }

        const requestId = ++this.requestSeq;
        this.priceDisplay.classList.remove('prompt');
        this.priceDisplay.textContent = 'Pricing…';

        let result;
        try {
            result = await this.priceOrder(quantity, frontColors, backColors, isDarkGarment, hasSafetyStripes);
        } catch (error) {
            if (requestId !== this.requestSeq) return; // superseded by a newer input
            console.error('[ScreenPrintCustomer] Live pricing failed:', error);
            this.showPricingError('Unable to load live pricing. Please refresh the page or call (253) 922-5793 — we never guess a price.');
            this.resetDisplay('Pricing unavailable');
            return;
        }
        if (requestId !== this.requestSeq) return; // superseded by a newer input

        if (!result.ok) {
            const code = result.error && result.error.code;
            if (code === 'BELOW_MINIMUM') {
                this.resetDisplay(`Min ${result.error.minQuantity} pieces`);
            } else {
                this.showPricingError((result.error && result.error.message) || 'Pricing unavailable for this combination. Please call (253) 922-5793.');
                this.resetDisplay('Pricing unavailable');
            }
            return;
        }

        this.renderResult(quantity, frontColors, backColors, isDarkGarment, hasSafetyStripes, result);

        // Tier ladder is a nice-to-have preview — its failure must never block the main price.
        this.renderTierLadder(frontColors, backColors, isDarkGarment, hasSafetyStripes, result).catch((error) => {
            console.error('[ScreenPrintCustomer] Tier ladder failed:', error);
            this.tierLadder.style.display = 'none';
        });
    }

    /**
     * Prices ONE order through the shared engine. `sizes: {S: quantity}` is a synthetic
     * bucket — the S key carries a $0 size upcharge (no garment ⇒ no size-driven cost),
     * so the whole quantity prices as a single flat per-piece rate, matching this
     * calculator's flat-quantity UI (no size breakdown collected).
     */
    async priceOrder(quantity, frontColors, backColors, isDarkGarment, hasSafetyStripes) {
        const engine = window.QuoteCartEngine;
        if (!engine) {
            throw new Error('Pricing engine (QuoteCartEngine) is not loaded.');
        }
        const item = {
            id: '__customer_supplied__',
            styleNumber: this.REFERENCE_STYLE,
            method: 'SCP',
            groupId: this.SCP_GROUP_ID,
            sizes: { S: quantity }
        };
        return engine.singleItemPreview(item, {
            deps: { ScreenPrintPricingService: window.ScreenPrintPricingService },
            groups: {
                [this.SCP_GROUP_ID]: {
                    frontColors: frontColors,
                    backColors: backColors,
                    darkGarment: isDarkGarment,
                    safetyStripes: hasSafetyStripes,
                    customerSuppliedGarment: true
                }
            },
            nudge: false
        });
    }

    renderResult(quantity, frontColors, backColors, isDarkGarment, hasSafetyStripes, result) {
        const line = result.lines[0];
        const perStyle = (result.trace && result.trace.perStyle && result.trace.perStyle[0]) || {};
        const addlPerPiece = Number(perStyle.addlPerPiece) || 0; // back print, $0 if no back colors
        const stripeFee = (result.trace && result.trace.fees && Number(result.trace.fees.stripe)) || 0;
        const frontBackLocations = backColors > 0 ? 2 : 1;
        const stripesPerPiece = hasSafetyStripes ? stripeFee * frontBackLocations : 0;
        // unit = frontPerPiece + addlPerPiece + stripesPerPiece (quote-cart-engine.js priceScpGroup) — back out front's share for display.
        const frontPerPiece = line.baseUnit - addlPerPiece - stripesPerPiece;

        const setupFeeEntry = (result.fees || []).find((f) => f.code === 'SPSU') || { amount: 0, label: 'Screen setup fee' };
        const ltmFeeTotal = (result.ltm && result.ltm.fee) || 0;

        this.currentCalculation = {
            quantity: quantity,
            frontColors: frontColors,
            backColors: backColors,
            isDarkGarment: isDarkGarment,
            hasSafetyStripes: hasSafetyStripes,
            frontPerPiece: frontPerPiece,
            addlPerPiece: addlPerPiece,
            stripesPerPiece: stripesPerPiece,
            pricePerShirt: line.baseUnit,
            totalScreenColors: (result.trace && result.trace.screens) || 0,
            totalSetupFee: setupFeeEntry.amount,
            setupFeeLabel: setupFeeEntry.label,
            ltmFeeTotal: ltmFeeTotal,
            orderSubtotal: result.itemTotal,
            finalTotal: result.groupTotal,
            tierLabel: result.tierLabel
        };

        // Update display
        this.priceDisplay.classList.remove('prompt');
        this.priceDisplay.textContent = `$${line.baseUnit.toFixed(2)}`;

        let summaryHtml = `
            <div class="summary-item">
                <span>Subtotal (${quantity} prints)</span>
                <strong>$${result.itemTotal.toFixed(2)}</strong>
            </div>`;

        if (ltmFeeTotal > 0) {
            summaryHtml += `
            <div class="summary-item">
                <span>Less Than Minimum Fee</span>
                <strong>$${ltmFeeTotal.toFixed(2)}</strong>
            </div>`;
        }

        summaryHtml += `
            <div class="summary-item">
                <span>${escapeHTML(setupFeeEntry.label)}</span>
                <strong>$${setupFeeEntry.amount.toFixed(2)}</strong>
            </div>
            <div class="summary-item total">
                <span>Total Order Cost</span>
                <strong>$${result.groupTotal.toFixed(2)}</strong>
            </div>`;

        this.orderSummary.innerHTML = summaryHtml;
        this.quoteActions.style.display = 'flex';
    }

    /**
     * Pre-submission price-break table (mirrors the pattern already used on
     * product.html's configurator — pdp-configurator.js probeLadder()): probes one
     * representative quantity per live Caspio tier through the SAME engine call, so
     * it can never drift from the headline price above.
     */
    async renderTierLadder(frontColors, backColors, isDarkGarment, hasSafetyStripes, currentResult) {
        const engine = window.QuoteCartEngine;
        const probeQtys = [24, 48, 72, 145]; // one qty per current live SCP tier boundary
        const ladder = this.tierLadder;
        ladder.style.display = 'block';
        ladder.innerHTML = '<div class="tier-ladder-title">Loading price breaks…</div>';

        const probes = await Promise.all(probeQtys.map(async (qty) => {
            try {
                const r = await engine.singleItemPreview({
                    id: '__tier_probe__',
                    styleNumber: this.REFERENCE_STYLE,
                    method: 'SCP',
                    groupId: this.SCP_GROUP_ID,
                    sizes: { S: qty }
                }, {
                    deps: { ScreenPrintPricingService: window.ScreenPrintPricingService },
                    groups: {
                        [this.SCP_GROUP_ID]: {
                            frontColors: frontColors,
                            backColors: backColors,
                            darkGarment: isDarkGarment,
                            safetyStripes: hasSafetyStripes,
                            customerSuppliedGarment: true
                        }
                    },
                    nudge: false
                });
                if (!r.ok) return null;
                return { tierLabel: r.tierLabel, perPiece: r.lines[0].baseUnit, ltmFee: (r.ltm && r.ltm.fee) || 0 };
            } catch (error) {
                return null;
            }
        }));

        // De-dupe consecutive probes landing in the same tier (dark-garment screens don't move
        // the tier boundary, so this is just about the 4 probe qtys occasionally collapsing).
        const seen = new Set();
        const rows = probes.filter(Boolean).filter((r) => {
            if (seen.has(r.tierLabel)) return false;
            seen.add(r.tierLabel);
            return true;
        });

        if (!rows.length) {
            ladder.style.display = 'none';
            return;
        }

        const tableRows = rows.map((r) => {
            const isCurrent = r.tierLabel === currentResult.tierLabel;
            const ltmNote = r.ltmFee > 0 ? ` + $${r.ltmFee.toFixed(0)} LTM` : '';
            return `<tr class="${isCurrent ? 'tier-current' : ''}">
                <td class="tier-qty">${escapeHTML(r.tierLabel)} pcs</td>
                <td class="tier-price">$${r.perPiece.toFixed(2)}/pc${ltmNote}</td>
            </tr>`;
        }).join('');

        ladder.innerHTML = `
            <div class="tier-ladder-title">Order more, pay less per shirt</div>
            <table class="tier-ladder-table">${tableRows}</table>
            <div class="tier-ladder-note">Live pricing for this front/back color setup — updates as you change your selections.</div>
        `;
    }

    showPricingError(message) {
        this.pricingError.textContent = message;
        this.pricingError.style.display = 'block';
    }

    hidePricingError() {
        this.pricingError.style.display = 'none';
        this.pricingError.textContent = '';
    }

    resetDisplay(promptText) {
        this.priceDisplay.textContent = promptText;
        this.priceDisplay.classList.add('prompt');
        this.orderSummary.innerHTML = '';
        this.quoteActions.style.display = 'none';
        this.tierLadder.style.display = 'none';
        this.currentCalculation = null;
    }

    openQuoteModal() {
        if (!this.currentCalculation) return;

        // Update quote preview
        this.updateQuotePreview();

        // Show modal
        document.getElementById('quoteModal').classList.add('active');
    }

    updateQuotePreview() {
        if (!this.currentCalculation) return;

        const calc = this.currentCalculation;
        let previewHtml = `
            <h4 style="margin-top: 0;">Quote Summary</h4>
            <table style="width: 100%;">
                <tr>
                    <th style="background: var(--primary-color); color: white; padding: 8px;">Description</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: center;">Qty</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: right;">Price</th>
                    <th style="background: var(--primary-color); color: white; padding: 8px; text-align: right;">Total</th>
                </tr>`;

        previewHtml += `
                <tr>
                    <td style="padding: 8px;">Front Print - ${calc.frontColors} color${calc.frontColors > 1 ? 's' : ''}${calc.isDarkGarment ? ' <br><small style="color:#666;">(dark garment — white underbase screen in setup fee below)</small>' : ''}</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$${calc.frontPerPiece.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${(calc.frontPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;

        // Show back print if applicable
        if (calc.backColors > 0) {
            previewHtml += `
                <tr>
                    <td style="padding: 8px;">Back Print - ${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$${calc.addlPerPiece.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${(calc.addlPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }

        // Show safety stripes if applicable
        if (calc.hasSafetyStripes) {
            previewHtml += `
                <tr>
                    <td style="padding: 8px;">Safety Stripes</td>
                    <td style="padding: 8px; text-align: center;">${calc.quantity}</td>
                    <td style="padding: 8px; text-align: right;">$${calc.stripesPerPiece.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">$${(calc.stripesPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }

        if (calc.ltmFeeTotal > 0) {
            previewHtml += `
                <tr>
                    <td style="padding: 8px;" colspan="3">Less Than Minimum Fee</td>
                    <td style="padding: 8px; text-align: right;">$${calc.ltmFeeTotal.toFixed(2)}</td>
                </tr>`;
        }

        previewHtml += `
                <tr>
                    <td style="padding: 8px;" colspan="3">${escapeHTML(calc.setupFeeLabel)}</td>
                    <td style="padding: 8px; text-align: right;">$${calc.totalSetupFee.toFixed(2)}</td>
                </tr>
                <tr style="font-weight: bold; border-top: 2px solid var(--primary-color);">
                    <td style="padding: 8px;" colspan="3">Total</td>
                    <td style="padding: 8px; text-align: right;">$${calc.finalTotal.toFixed(2)}</td>
                </tr>
            </table>`;

        this.quotePreview.innerHTML = previewHtml;
    }

    async handleQuoteSubmit(e) {
        e.preventDefault();

        if (!this.validateQuoteForm()) return;
        if (!this.currentCalculation) return;

        try {
            this.showLoading();

            // Build quote data
            const quoteData = {
                // Customer info
                customerName: this.customerName.value.trim(),
                customerEmail: this.customerEmail.value.trim(),
                customerPhone: this.customerPhone.value.trim(),
                companyName: this.companyName.value.trim(),
                projectName: this.projectName.value.trim(),

                // Order details
                quantity: this.currentCalculation.quantity,
                frontColors: this.currentCalculation.frontColors,
                backColors: this.currentCalculation.backColors,
                isDarkGarment: this.currentCalculation.isDarkGarment,
                safetyStripes: this.currentCalculation.hasSafetyStripes,

                // Pricing (live, from QuoteCartEngine — never locally computed)
                pricePerShirt: this.currentCalculation.pricePerShirt,
                orderSubtotal: this.currentCalculation.orderSubtotal,
                ltmFeeTotal: this.currentCalculation.ltmFeeTotal,
                setupFee: this.currentCalculation.totalSetupFee,
                finalTotal: this.currentCalculation.finalTotal,
                tierLabel: this.currentCalculation.tierLabel,

                // Options
                notes: this.notes.value.trim(),

                // Sales rep
                salesRepEmail: this.salesRep.value,
                salesRepName: this.getSalesRepName(this.salesRep.value)
            };

            // Generate quote ID
            const quoteId = this.quoteService.generateQuoteID();
            quoteData.quoteId = quoteId;

            // Save to database if enabled
            if (this.saveToDatabase.checked) {
                const saveResult = await this.quoteService.saveQuote(quoteData);
                if (!saveResult.success) {
                    console.error('Database save failed:', saveResult.error);
                }
            }

            // Send email
            const emailData = this.buildEmailData(quoteData);


            await emailjs.send(
                this.emailConfig.serviceId,
                this.emailConfig.templateId,
                emailData
            );

            // Show success
            this.showSuccessModal(quoteId, quoteData);

            // Close quote modal
            this.closeQuoteModal();

            // Reset form
            this.quoteForm.reset();

        } catch (error) {
            console.error('Quote submission error:', error);
            alert('Failed to send quote. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    buildEmailData(quoteData) {
        return {
            // Email routing
            to_email: quoteData.customerEmail,
            from_name: 'Northwest Custom Apparel',
            reply_to: quoteData.salesRepEmail,

            // Quote identification
            quote_type: 'Customer Supplied Screen Print',
            quote_id: quoteData.quoteId,
            quote_date: new Date().toLocaleDateString(),

            // Customer info
            customer_name: quoteData.customerName,
            customer_email: quoteData.customerEmail,
            company_name: quoteData.companyName || '',
            customer_phone: quoteData.customerPhone || '',
            project_name: quoteData.projectName || '',

            // Pricing
            grand_total: quoteData.finalTotal.toFixed(2),

            // Content
            products_html: this.generateQuoteHTML(quoteData),
            notes: quoteData.notes || 'No special notes for this order',

            // Sales rep
            sales_rep_name: quoteData.salesRepName,
            sales_rep_email: quoteData.salesRepEmail,
            sales_rep_phone: '253-922-5793',

            // Company
            company_year: '1977'
        };
    }

    generateQuoteHTML(quoteData) {
        const calc = this.currentCalculation;

        let html = `
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #4cb354; color: white;">
                        <th style="padding: 12px; text-align: left;">Description</th>
                        <th style="padding: 12px; text-align: center;">Quantity</th>
                        <th style="padding: 12px; text-align: right;">Price</th>
                        <th style="padding: 12px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>`;

        html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                            Front Print - ${calc.frontColors} color${calc.frontColors > 1 ? 's' : ''}
                            ${calc.isDarkGarment ? '<br><small style="color: #666;">(dark garment — white underbase screen in setup fee)</small>' : ''}
                        </td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.frontPerPiece.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(calc.frontPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>`;

        // Show back print if applicable
        if (calc.backColors > 0) {
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">Back Print - ${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.addlPerPiece.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(calc.addlPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>`;
        }

        // Show safety stripes if applicable
        if (calc.hasSafetyStripes) {
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;">Safety Stripes (Pocket/Shoulder)</td>
                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${calc.quantity}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.stripesPerPiece.toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${(calc.stripesPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>`;
        }

        if (calc.ltmFeeTotal > 0) {
            html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">Less Than Minimum Fee</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.ltmFeeTotal.toFixed(2)}</td>
                    </tr>`;
        }

        html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #ddd;" colspan="3">${escapeHTML(calc.setupFeeLabel)}</td>
                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${calc.totalSetupFee.toFixed(2)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold;">
                        <td style="padding: 12px; border-top: 2px solid #4cb354;" colspan="3">Total</td>
                        <td style="padding: 12px; text-align: right; border-top: 2px solid #4cb354;">$${calc.finalTotal.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>`;

        return html;
    }

    validateQuoteForm() {
        const errors = [];

        if (!this.customerName.value.trim()) {
            errors.push('Customer name is required');
        }

        if (!this.validateEmail(this.customerEmail.value)) {
            errors.push('Valid email is required');
        }

        if (errors.length > 0) {
            alert(errors.join('\n'));
            return false;
        }

        return true;
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    getSalesRepName(email) {
        const reps = {
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'taylar@nwcustomapparel.com': 'Taylar',
            'nika@nwcustomapparel.com': 'Nika',
            'erik@nwcustomapparel.com': 'Erik',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley',
            'jim@nwcustomapparel.com': 'Jim',
            'art@nwcustomapparel.com': 'Steve (Artist)',
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
        };
        return reps[email] || 'Sales Team';
    }

    showSuccessModal(quoteId, quoteData) {
        document.getElementById('modalQuoteId').textContent = quoteId;
        document.getElementById('modalCustomerName').textContent = quoteData.customerName;
        document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
        document.getElementById('modalTotalAmount').textContent = `$${quoteData.finalTotal.toFixed(2)}`;

        this.lastQuoteData = quoteData;

        document.getElementById('successModal').classList.add('active');
    }

    closeQuoteModal() {
        document.getElementById('quoteModal').classList.remove('active');
    }

    showLoading() {
        this.submitQuoteBtn.disabled = true;
        this.submitQuoteBtn.innerHTML = '<span class="loading"></span> Sending...';
    }

    hideLoading() {
        this.submitQuoteBtn.disabled = false;
        this.submitQuoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Quote';
    }
}

// Modal functions
function closeQuoteModal() {
    document.getElementById('quoteModal').classList.remove('active');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

function copyQuoteId() {
    const quoteId = document.getElementById('modalQuoteId').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        alert('Quote ID copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy Quote ID');
    });
}

function printQuote() {
    const calculator = window.calculator;
    if (!calculator.lastQuoteData) return;

    const data = calculator.lastQuoteData;
    const calc = calculator.currentCalculation;
    const printWindow = window.open('', '_blank');

    // Build clean invoice HTML
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote ${data.quoteId} - Northwest Custom Apparel</title>
            <style>
                @page {
                    margin: 0.5in;
                    size: letter;
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 12pt;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                }

                /* Header */
                .invoice-header {
                    display: table;
                    width: 100%;
                    margin-bottom: 30px;
                }

                .company-section {
                    display: table-cell;
                    vertical-align: top;
                    width: 60%;
                }

                .invoice-section {
                    display: table-cell;
                    vertical-align: top;
                    width: 40%;
                    text-align: right;
                }

                .company-logo {
                    max-width: 220px;
                    height: auto;
                    margin-bottom: 10px;
                }

                .company-info {
                    font-size: 10pt;
                    color: #555;
                    line-height: 1.3;
                }

                .invoice-title {
                    font-size: 32pt;
                    font-weight: bold;
                    color: #4cb354;
                    margin-bottom: 10px;
                }

                .invoice-details {
                    font-size: 10pt;
                    line-height: 1.5;
                }

                .invoice-details strong {
                    display: inline-block;
                    width: 80px;
                    text-align: right;
                    margin-right: 10px;
                }

                /* Bill To Section */
                .bill-to-section {
                    margin: 30px 0;
                    padding: 15px;
                    border: 1px solid #ddd;
                    background: #f9f9f9;
                }

                .bill-to-title {
                    font-size: 11pt;
                    font-weight: bold;
                    color: #4cb354;
                    margin-bottom: 10px;
                }

                .bill-to-content {
                    font-size: 11pt;
                    line-height: 1.5;
                }

                /* Main Table */
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 30px 0;
                    font-size: 11pt;
                }

                .invoice-table thead {
                    background: #4cb354;
                    color: white;
                }

                .invoice-table th {
                    padding: 10px;
                    text-align: left;
                    font-weight: bold;
                    border: 1px solid #4cb354;
                }

                .invoice-table th:nth-child(2),
                .invoice-table th:nth-child(3),
                .invoice-table th:nth-child(4) {
                    text-align: right;
                    width: 100px;
                }

                .invoice-table tbody td {
                    padding: 8px 10px;
                    border: 1px solid #ddd;
                    vertical-align: top;
                }

                .invoice-table tbody td:nth-child(2),
                .invoice-table tbody td:nth-child(3),
                .invoice-table tbody td:nth-child(4) {
                    text-align: right;
                }

                .description-detail {
                    font-size: 9pt;
                    color: #666;
                    display: block;
                    margin-top: 2px;
                }

                /* Totals Section */
                .totals-section {
                    margin-left: auto;
                    width: 300px;
                    margin-top: 20px;
                }

                .total-row {
                    display: table;
                    width: 100%;
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                }

                .total-label {
                    display: table-cell;
                    text-align: right;
                    padding-right: 20px;
                    font-size: 11pt;
                }

                .total-value {
                    display: table-cell;
                    text-align: right;
                    width: 100px;
                    font-size: 11pt;
                }

                .grand-total {
                    border-top: 2px solid #4cb354;
                    border-bottom: 2px solid #4cb354;
                    padding: 8px 0;
                    margin-top: 5px;
                    font-weight: bold;
                    font-size: 12pt;
                }

                .grand-total .total-value {
                    color: #4cb354;
                    font-size: 14pt;
                }

                /* Notes Section */
                .notes-section {
                    margin: 30px 0;
                    padding: 15px;
                    background: #fff7ed;
                    border: 1px solid #fbbf24;
                }

                .notes-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                    color: #92400e;
                }

                .notes-content {
                    color: #78350f;
                    font-size: 10pt;
                }

                /* Terms Section */
                .terms-section {
                    margin-top: 40px;
                    padding: 15px;
                    background: #fee2e2;
                    border: 1px solid #f87171;
                }

                .terms-title {
                    font-weight: bold;
                    color: #991b1b;
                    margin-bottom: 8px;
                    font-size: 11pt;
                }

                .terms-content {
                    font-size: 10pt;
                    line-height: 1.4;
                    color: #7f1d1d;
                }

                /* Footer */
                .invoice-footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #e5e7eb;
                    text-align: center;
                    font-size: 9pt;
                    color: #666;
                }

                @media print {
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Invoice Header -->
            <div class="invoice-header">
                <div class="company-section">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
                         alt="Northwest Custom Apparel" class="company-logo">
                    <div class="company-info">
                        2025 Freeman Road East<br>
                        Milton, WA 98354<br>
                        Phone: (253) 922-5793<br>
                        Email: sales@nwcustomapparel.com<br>
                        Web: www.nwcustomapparel.com
                    </div>
                </div>
                <div class="invoice-section">
                    <div class="invoice-title">QUOTE</div>
                    <div class="invoice-details">
                        <div><strong>Quote #:</strong> ${data.quoteId}</div>
                        <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
                        <div><strong>Valid Until:</strong> ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            <!-- Bill To Section -->
            <div class="bill-to-section">
                <div class="bill-to-title">BILL TO:</div>
                <div class="bill-to-content">
                    <strong>${data.customerName}</strong><br>
                    ${data.companyName ? data.companyName + '<br>' : ''}
                    ${data.customerEmail}<br>
                    ${data.customerPhone ? 'Phone: ' + data.customerPhone + '<br>' : ''}
                    ${data.projectName ? 'Project: ' + data.projectName : ''}
                </div>
            </div>

            <!-- Main Invoice Table -->
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            Screen Print - Front
                            <span class="description-detail">
                                ${calc.frontColors} color${calc.frontColors > 1 ? 's' : ''}
                                ${calc.isDarkGarment ? ' (dark garment — white underbase screen in setup fee)' : ''}
                            </span>
                        </td>
                        <td>${calc.quantity}</td>
                        <td>$${calc.frontPerPiece.toFixed(2)}</td>
                        <td>$${(calc.frontPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>

                    ${calc.backColors > 0 ? `
                    <tr>
                        <td>
                            Screen Print - Back
                            <span class="description-detail">${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</span>
                        </td>
                        <td>${calc.quantity}</td>
                        <td>$${calc.addlPerPiece.toFixed(2)}</td>
                        <td>$${(calc.addlPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>` : ''}

                    ${calc.hasSafetyStripes ? `
                    <tr>
                        <td>
                            Safety Stripes
                            <span class="description-detail">Pocket/Shoulder placement</span>
                        </td>
                        <td>${calc.quantity}</td>
                        <td>$${calc.stripesPerPiece.toFixed(2)}</td>
                        <td>$${(calc.stripesPerPiece * calc.quantity).toFixed(2)}</td>
                    </tr>` : ''}
                </tbody>
            </table>

            <!-- Totals Section -->
            <div class="totals-section">
                <div class="total-row">
                    <div class="total-label">Subtotal:</div>
                    <div class="total-value">$${calc.orderSubtotal.toFixed(2)}</div>
                </div>

                ${calc.ltmFeeTotal > 0 ? `
                <div class="total-row">
                    <div class="total-label">Less Than Minimum Fee:</div>
                    <div class="total-value">$${calc.ltmFeeTotal.toFixed(2)}</div>
                </div>` : ''}

                <div class="total-row">
                    <div class="total-label">${escapeHTML(calc.setupFeeLabel)}:</div>
                    <div class="total-value">$${calc.totalSetupFee.toFixed(2)}</div>
                </div>

                <div class="total-row grand-total">
                    <div class="total-label">TOTAL:</div>
                    <div class="total-value">$${calc.finalTotal.toFixed(2)}</div>
                </div>
            </div>

            ${data.notes ? `
            <div class="notes-section">
                <div class="notes-title">Notes:</div>
                <div class="notes-content">${data.notes}</div>
            </div>` : ''}

            <!-- Terms & Conditions -->
            <div class="terms-section">
                <div class="terms-title">IMPORTANT NOTICE - Customer Supplied Garments</div>
                <div class="terms-content">
                    Northwest Custom Apparel is not responsible for the damage of ANY customer supplied garments.
                    Should items be damaged while in our facility, we will NOT reimburse you for their value or replace them.
                    A signed garment waiver form is required upon drop-off. This quote is valid for 30 days from the date above.
                    Pricing is subject to change after expiration.
                </div>
            </div>

            <!-- Footer -->
            <div class="invoice-footer">
                <strong>Northwest Custom Apparel</strong><br>
                Family Owned & Operated Since 1977<br>
                Thank you for your business!
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

    printWindow.document.write(printHTML);
    printWindow.document.close();
}
