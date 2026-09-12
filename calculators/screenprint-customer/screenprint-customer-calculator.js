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
        if (typeof emailjs !== 'undefined') emailjs.init(((typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.EMAIL && window.APP_CONFIG.EMAIL.PUBLIC_KEY) || ''));
        this.emailConfig = {
            serviceId: ((typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.EMAIL && window.APP_CONFIG.EMAIL.SERVICE_ID) || ''),
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

    openDialog(id) {
        const dialog = document.getElementById(id);
        if (dialog.open) return;
        dialog.returnFocus = document.activeElement;
        dialog.showModal();
    }

    closeDialog(id) {
        if (this.submitting) return;
        const dialog = document.getElementById(id);
        if (!dialog.open) return;
        dialog.close();
        if (dialog.returnFocus && dialog.returnFocus.isConnected) dialog.returnFocus.focus();
    }

    setFeedback(id, message) {
        const node = document.getElementById(id);
        node.textContent = message;
        node.hidden = !message;
    }

    async submitCapturedQuote() {
        if (this.submitting || !this.submission) return;
        const submission = this.submission;
        this.showLoading();
        this.setFeedback('quoteSubmitStatus', '');
        this.setFeedback('quoteDeliveryStatus', '');
        try {
            if (submission.saveRequested && !submission.saved) {
                try {
                    submission.saveResult = await this.quoteService.saveQuote(submission.quoteData);
                    submission.saved = !!submission.saveResult.success;
                } catch (error) {
                    console.error('[ScreenPrintCustomer] Save not confirmed:', error);
                    submission.saveResult = {success: false};
                }
            }
            if (!submission.emailed) {
                try {
                    await emailjs.send(this.emailConfig.serviceId, this.emailConfig.templateId, this.buildEmailData(submission.quoteData));
                    submission.emailed = true;
                } catch (error) {
                    console.error('[ScreenPrintCustomer] Email not confirmed:', error);
                }
            }
        } finally {
            this.hideLoading();
        }
        if (submission.saved || submission.emailed) {
            this.closeQuoteModal();
            this.showSuccessModal(submission.quoteData.quoteId, submission.quoteData);
            if (submission.emailed && (!submission.saveRequested || submission.saved)) this.quoteForm.reset();
        } else {
            this.setFeedback('quoteSubmitStatus', 'Quote delivery and saving were not confirmed. Your details are retained. Retry or call (253) 922-5793.');
        }
    }

    attachEventListeners() {
        // Calculator inputs (debounced — each keystroke would otherwise fire a live API call)
        this.quantity.addEventListener('input', () => this.scheduleCalculate());
        this.frontColors.addEventListener('change', () => this.scheduleCalculate());
        this.backColors.addEventListener('change', () => this.scheduleCalculate());
        this.darkShirtToggle.addEventListener('change', () => this.scheduleCalculate());
        this.safetyStripesToggle.addEventListener('change', () => {
            this.safetyStripesNotice.hidden = !this.safetyStripesToggle.checked;
            this.scheduleCalculate();
        });

        // Native dialogs own keyboard focus; pending requests keep their captured draft.
        for (const id of ['quoteModal', 'successModal']) {
            const dialog = document.getElementById(id);
            dialog.addEventListener('cancel', e => { e.preventDefault(); this.closeDialog(id); });
            dialog.addEventListener('keydown', e => {
                if (e.key !== 'Tab') return;
                const nodes = [...dialog.querySelectorAll('input, select, textarea, button, [tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
                if (!nodes.length) { e.preventDefault(); return; }
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (e.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        }
        document.getElementById('retryQuoteBtn').addEventListener('click', () => this.submitCapturedQuote());

        // Quote form
        document.getElementById('retryPricingBtn').addEventListener('click', () => this.calculatePrice());
        this.sendQuoteBtn.addEventListener('click', () => this.openQuoteModal());
        this.quoteForm.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
    }

    scheduleCalculate() {
        if (this.submitting) return;
        clearTimeout(this.debounceTimer);
        ++this.requestSeq;
        this.resetDisplay('Updating quote…');
        this.debounceTimer = setTimeout(() => this.calculatePrice(), 300);
    }

    async calculatePrice() {
        if (this.submitting) return;
        clearTimeout(this.debounceTimer);
        const requestId = ++this.requestSeq;
        this.resetDisplay('Pricing…');
        const quantity = parseInt(this.quantity.value, 10) || 0;
        const frontColors = parseInt(this.frontColors.value, 10) || 0;
        const backColors = parseInt(this.backColors.value, 10) || 0;
        const isDarkGarment = this.darkShirtToggle.checked;
        const hasSafetyStripes = this.safetyStripesToggle.checked;

        if (quantity <= 0) {
            this.resetDisplay("Enter Quantity");
            return;
        }
        if (frontColors < 1) {
            this.resetDisplay("Select Front Colors");
            return;
        }

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
                this.showPricingError('Live pricing is unavailable for this selection. Retry pricing or call (253) 922-5793.');
                this.resetDisplay('Pricing unavailable');
            }
            return;
        }

        this.hidePricingError();
        this.renderResult(quantity, frontColors, backColors, isDarkGarment, hasSafetyStripes, result);

        // Tier ladder is a nice-to-have preview — its failure must never block the main price.
        this.renderTierLadder(frontColors, backColors, isDarkGarment, hasSafetyStripes, result, requestId).catch((error) => {
            if (requestId !== this.requestSeq) return;
            console.error('[ScreenPrintCustomer] Tier ladder failed:', error);
            this.tierLadder.textContent = 'Price breaks are unavailable. Your current quote above remains valid.';
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

        // The big per-piece number is baseUnit — LTM-EXCLUDED — whereas Quick Quote /
        // the product-page headline show the all-in per-piece ((groupTotal−oneTime)/qty,
        // LTM baked in). Do NOT change the number (totals are parity-locked); instead
        // surface a small "+ $NN small-batch fee" note beside it so a customer comparing
        // the two surfaces understands the difference. Toggled off when no LTM applies.
        this._setSmallBatchNote(ltmFeeTotal);

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
        this.quoteActions.hidden = false;
        document.getElementById('printSelection').textContent = quantity + ' garments · Front: ' + frontColors + ' colors · Back: ' + backColors + ' colors · Dark garment: ' + (isDarkGarment ? 'Yes' : 'No') + ' · Safety stripes: ' + (hasSafetyStripes ? 'Yes' : 'No');
    }

    /**
     * Show/hide a small "+ $NN small-batch fee" note next to the big per-piece number.
     * The headline shows baseUnit (LTM-excluded); this note tells the customer a flat
     * small-batch fee is added on top, so they don't misread it against Quick Quote /
     * the product page (which fold LTM into their per-piece). Display-only — never
     * touches a dollar total. The note node is created once and reused/toggled; it's
     * injected right after #priceDisplay so it sits beside the price without needing an
     * HTML edit (this file may only touch JS).
     */
    _setSmallBatchNote(ltmFeeTotal) {
        const fee = Number(ltmFeeTotal) || 0;
        if (!this._smallBatchNote) {
            const note = document.createElement('div');
            note.className = 'price-display-smallbatch';
            note.id = 'priceSmallBatchNote';
            // Typography and color belong to the page stylesheet.
            if (this.priceDisplay && this.priceDisplay.parentNode) {
                this.priceDisplay.insertAdjacentElement('afterend', note);
            }
            this._smallBatchNote = note;
        }
        if (fee > 0) {
            this._smallBatchNote.textContent = `+ $${fee.toFixed(2)} small-batch fee`;
            this._smallBatchNote.hidden = false;
        } else {
            this._smallBatchNote.textContent = '';
            this._smallBatchNote.hidden = true;
        }
    }

    /**
     * Pre-submission price-break table (mirrors the pattern already used on
     * product.html's configurator — pdp-configurator.js probeLadder()): probes one
     * representative quantity per live Caspio tier through the SAME engine call, so
     * it can never drift from the headline price above.
     */
    async renderTierLadder(frontColors, backColors, isDarkGarment, hasSafetyStripes, currentResult, requestId = this.requestSeq) {
        const engine = window.QuoteCartEngine;
        const probeQtys = [24, 48, 72, 145]; // one qty per current live SCP tier boundary
        const ladder = this.tierLadder;
        ladder.hidden = false;
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

        if (requestId !== this.requestSeq) return;
        if (probes.some(row => !row)) {
            ladder.textContent = 'Price breaks are unavailable. Your current quote above remains valid.';
            return;
        }

        // De-dupe consecutive probes landing in the same tier (dark-garment screens don't move
        // the tier boundary, so this is just about the 4 probe qtys occasionally collapsing).
        const seen = new Set();
        const rows = probes.filter(Boolean).filter((r) => {
            if (seen.has(r.tierLabel)) return false;
            seen.add(r.tierLabel);
            return true;
        });

        if (!rows.length) {
            ladder.hidden = true;
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
        this.pricingError.hidden = false;
        document.getElementById('retryPricingBtn').hidden = false;
    }

    hidePricingError() {
        this.pricingError.hidden = true;
        document.getElementById('retryPricingBtn').hidden = true;
        this.pricingError.textContent = '';
    }

    resetDisplay(promptText) {
        this.priceDisplay.textContent = promptText;
        this.priceDisplay.classList.add('prompt');
        this.orderSummary.innerHTML = '';
        this.quoteActions.hidden = true;
        this.tierLadder.hidden = true;
        this._setSmallBatchNote(0); // clear the "+ small-batch fee" note
        this.currentCalculation = null;
        document.getElementById('printSelection').textContent = 'Estimate unavailable — enter valid print details.';
    }

    openQuoteModal() {
        if (!this.currentCalculation || this.submitting) return;
        this.updateQuotePreview();
        this.setFeedback('quoteSubmitStatus', '');
        this.openDialog('quoteModal');
    }

    updateQuotePreview() {
        if (!this.currentCalculation) return;

        const calc = this.currentCalculation;
        let previewHtml = `
            <h3>Quote Summary</h3>
            <table>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>`;

        previewHtml += `
                <tr>
                    <td>Front Print - ${calc.frontColors} color${calc.frontColors > 1 ? 's' : ''}${calc.isDarkGarment ? ' <br><small>(dark garment — white underbase screen in setup fee below)</small>' : ''}</td>
                    <td>${calc.quantity}</td>
                    <td>$${calc.frontPerPiece.toFixed(2)}</td>
                    <td>$${(calc.frontPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;

        // Show back print if applicable
        if (calc.backColors > 0) {
            previewHtml += `
                <tr>
                    <td>Back Print - ${calc.backColors} color${calc.backColors > 1 ? 's' : ''}</td>
                    <td>${calc.quantity}</td>
                    <td>$${calc.addlPerPiece.toFixed(2)}</td>
                    <td>$${(calc.addlPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }

        // Show safety stripes if applicable
        if (calc.hasSafetyStripes) {
            previewHtml += `
                <tr>
                    <td>Safety Stripes</td>
                    <td>${calc.quantity}</td>
                    <td>$${calc.stripesPerPiece.toFixed(2)}</td>
                    <td>$${(calc.stripesPerPiece * calc.quantity).toFixed(2)}</td>
                </tr>`;
        }

        if (calc.ltmFeeTotal > 0) {
            previewHtml += `
                <tr>
                    <td colspan="3">Less Than Minimum Fee</td>
                    <td>$${calc.ltmFeeTotal.toFixed(2)}</td>
                </tr>`;
        }

        previewHtml += `
                <tr>
                    <td colspan="3">${escapeHTML(calc.setupFeeLabel)}</td>
                    <td>$${calc.totalSetupFee.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="3">Total</td>
                    <td>$${calc.finalTotal.toFixed(2)}</td>
                </tr>
            </table>`;

        this.quotePreview.innerHTML = previewHtml;
    }

    async handleQuoteSubmit(e) {
        e.preventDefault();
        if (this.submitting || !this.currentCalculation || !this.validateQuoteForm()) return;
        const calc = { ...this.currentCalculation };
        const quoteData = {
            customerName: this.customerName.value.trim(),
            customerEmail: this.customerEmail.value.trim(),
            customerPhone: this.customerPhone.value.trim(),
            companyName: this.companyName.value.trim(),
            projectName: this.projectName.value.trim(),
            quantity: calc.quantity,
            frontColors: calc.frontColors,
            backColors: calc.backColors,
            isDarkGarment: calc.isDarkGarment,
            safetyStripes: calc.hasSafetyStripes,
            pricePerShirt: calc.pricePerShirt,
            orderSubtotal: calc.orderSubtotal,
            ltmFeeTotal: calc.ltmFeeTotal,
            setupFee: calc.totalSetupFee,
            finalTotal: calc.finalTotal,
            tierLabel: calc.tierLabel,
            notes: this.notes.value.trim(),
            salesRepEmail: this.salesRep.value,
            salesRepName: this.getSalesRepName(this.salesRep.value),
            calculation: calc
        };
        const saveRequested = this.saveToDatabase.checked;
        const key = JSON.stringify({quoteData, saveRequested});
        // An exact retry keeps its quote ID and only repeats the unfinished operation.
        if (!this.submission || this.submission.key !== key || (this.submission.emailed && (!this.submission.saveRequested || this.submission.saved))) {
            quoteData.quoteId = this.quoteService.generateQuoteID();
            quoteData.createdAt = Date.now();
            this.submission = {key, quoteData, saveRequested, saved: false, emailed: false};
        }
        await this.submitCapturedQuote();
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
        const calc = quoteData.calculation || this.currentCalculation;

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
        if (!this.quoteForm.reportValidity()) return false;
        if (!this.customerName.value.trim() || !this.validateEmail(this.customerEmail.value.trim())) {
            this.setFeedback('quoteSubmitStatus', 'Enter a customer name and valid email address.');
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
        const {saved, emailed, saveRequested, saveResult} = this.submission;
        document.getElementById('modalQuoteId').textContent = quoteId;
        document.getElementById('modalCustomerName').textContent = quoteData.customerName;
        document.getElementById('modalCustomerEmail').textContent = quoteData.customerEmail;
        document.getElementById('modalTotalAmount').textContent = `$${quoteData.finalTotal.toFixed(2)}`;
        document.getElementById('quoteSuccessTitle').textContent = emailed ? 'Quote sent' : 'Quote saved';
        document.getElementById('quoteRecipientLabel').textContent = emailed ? 'Your quote has been sent to:' : 'Your quote is saved for:';
        let message = '';
        if (!emailed) message = 'Email delivery was not confirmed. Retry email or share the saved quote ID with your sales representative.';
        else if (saveRequested && !saved) message = saveResult && saveResult.sessionSaved ? 'Email sent. The saved quote is incomplete. Retry saving the missing details.' : 'Email sent. Saving was not confirmed. Retry saving for your sales representative.';
        this.setFeedback('quoteDeliveryStatus', message);
        const retry = document.getElementById('retryQuoteBtn');
        retry.hidden = !message;
        retry.textContent = !emailed ? 'Retry email' : 'Retry saving';
        this.lastQuoteData = quoteData;
        this.copyGeneration = (this.copyGeneration || 0) + 1;
        this.setFeedback('quoteCopyStatus', '');
        this.openDialog('successModal');
        document.getElementById('quoteSuccessTitle').focus();
    }

    closeQuoteModal() {
        this.closeDialog('quoteModal');
    }

    showLoading() {
        this.submitting = true;
        this.pendingControls = [...document.querySelectorAll('input, select, textarea, button')].map(node => ({node, disabled: node.disabled}));
        this.pendingControls.forEach(({node}) => { node.disabled = true; });
        this.submitQuoteBtn.textContent = 'Sending…';
        const retry = document.getElementById('retryQuoteBtn');
        this.retryLabel = retry.textContent;
        retry.textContent = 'Completing quote…';
        document.getElementById('quoteForm').setAttribute('aria-busy', 'true');
    }

    hideLoading() {
        this.submitting = false;
        (this.pendingControls || []).forEach(({node, disabled}) => { node.disabled = disabled; });
        this.pendingControls = [];
        this.submitQuoteBtn.textContent = 'Send Quote';
        document.getElementById('retryQuoteBtn').textContent = this.retryLabel || 'Retry';
        document.getElementById('quoteForm').setAttribute('aria-busy', 'false');
    }
}

// Page actions remain compatible with the shared data-call delegator.
function closeQuoteModal() { window.calculator.closeQuoteModal(); }
function closeSuccessModal() { window.calculator.closeDialog('successModal'); }
function printEstimate() { if (window.calculator.currentCalculation && !window.calculator.submitting) window.print(); }
async function copyQuoteId() {
    const calculator = window.calculator;
    const generation = calculator.copyGeneration;
    const quoteId = document.getElementById('modalQuoteId').textContent;
    try {
        await navigator.clipboard.writeText(quoteId);
        if (generation === calculator.copyGeneration) calculator.setFeedback('quoteCopyStatus', 'Quote ID copied.');
    } catch (error) {
        if (generation === calculator.copyGeneration) calculator.setFeedback('quoteCopyStatus', 'Copy failed. Select and copy quote ID ' + quoteId + '.');
    }
}

function printQuote() {
    const calculator = window.calculator;
    if (!calculator.lastQuoteData) return;

    const data = calculator.lastQuoteData;
    const calc = data.calculation;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        calculator.setFeedback('quoteCopyStatus', 'The print window could not open. Allow pop-ups for this page and try again.');
        return;
    }
    const assetRoot = window.location.origin;
    printWindow.addEventListener('load', async () => {
        await printWindow.document.fonts.ready;
        await Promise.all([...printWindow.document.images].map(img => img.decode().catch(() => {})));
        printWindow.print();
    }, {once: true});

    // Build clean invoice HTML
    const printHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Quote ${data.quoteId} - Northwest Custom Apparel</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="${assetRoot}/shared_components/css/tokens.css?v=2026.09.11.6">
            <link rel="stylesheet" href="${assetRoot}/shared_components/css/components.css?v=2026.09.11.6">
            <link rel="stylesheet" href="${assetRoot}/calculators/screenprint-customer/screenprint-customer-invoice.css?v=2026.09.11.6">
        </head>
        <body data-ui="unified" class="screenprint-invoice">
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
                        <div><strong>Date:</strong> ${new Date(data.createdAt).toLocaleDateString()}</div>
                        <div><strong>Valid Until:</strong> ${new Date(data.createdAt + 30*24*60*60*1000).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            <!-- Bill To Section -->
            <div class="bill-to-section">
                <div class="bill-to-title">BILL TO:</div>
                <div class="bill-to-content">
                    <strong>${escapeHTML(data.customerName)}</strong><br>
                    ${data.companyName ? escapeHTML(data.companyName) + '<br>' : ''}
                    ${escapeHTML(data.customerEmail)}<br>
                    ${data.customerPhone ? 'Phone: ' + escapeHTML(data.customerPhone) + '<br>' : ''}
                    ${data.projectName ? 'Project: ' + escapeHTML(data.projectName) : ''}
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
                <div class="notes-content">${escapeHTML(data.notes)}</div>
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

            <!-- Printing is requested by the opener once this document and its images are ready. -->
        </body>
        </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
}
