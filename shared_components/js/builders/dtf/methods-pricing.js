/**
 * DTFQuoteBuilder prototype mixin — live pricing pass, state math (calculateFromState → computeFeesAndTotals = THE money pipeline), tiers, upcharges.
 * Batch 4.2 (2026-07-09): methods moved VERBATIM from quote-builder-class.js
 * (`this.` state intact — the class assembles via Object.assign(prototype, ...)).
 */
/* global escapeHtml, showToast, updateTaxCalculation, getServicePrice, setLtmControlState,
   getLtmControlState, renderLtmControlPanel, initLtmControlListeners, updatePerUnitPrice,
   updateQuantityNudge, parseRatePercent */

export const pricingMethods = {

    async loadPricingData() {
        try {
            const response = await fetch(`${window.APP_CONFIG.API.BASE_URL}/api/pricing-bundle?method=DTF`);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            this.pricingData = await response.json();
            this.hideError(); // Clear any previous errors
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to load pricing:', error);
            this.showError('Unable to load pricing data. Please refresh the page or try again later.');
            throw error; // Re-throw to prevent silently continuing
        }
    },

    /**
     * Heat-sensitive garment warning (expert audit 2026-07-07): DTF cure temps
     * scorch nylon and delaminate waterproof/PU coatings — a quoted-then-ruined
     * jacket order costs the garments AND the relationship. Non-blocking (the
     * shop may run low-temp film), once per style per session; keyword approach
     * mirrors the cap filter in dtf-quote-products.js.
     */
    _warnHeatSensitiveProducts() {
        if (!this._heatWarnedStyles) this._heatWarnedStyles = new Set();
        const HEAT_WORDS = /nylon|anorak|rain(?:wear|\s?(?:jacket|shell|coat))|waterproof|packable|windbreaker|puffer|pu[-\s]?coated/i;
        (this.products || []).forEach(p => {
            if (!p.styleNumber || this._heatWarnedStyles.has(p.styleNumber)) return;
            const m = HEAT_WORDS.exec(`${p.description || ''} ${p.styleNumber || ''}`);
            if (m) {
                this._heatWarnedStyles.add(p.styleNumber);
                this.showToast(`${p.styleNumber} looks heat-sensitive ("${m[0]}") — confirm DTF low-temp compatibility before quoting.`, 'warning');
            }
        });
    },

    // D2 split (2026-07-09): updatePricing's derive/paint stages moved VERBATIM
    // into the _reprice/_paint siblings below; the orchestrator threads px (the
    // derived pricing inputs). One flagged reorder: the sidebar qty/tier paint
    // now happens AFTER _deriveRepriceInputs (independent DOM nodes).
    _paintZeroQuantityState(totalQty) {
        // Handle zero quantity case
        if (totalQty === 0) {
            document.getElementById('total-qty').textContent = '0';
            document.getElementById('pricing-tier').textContent = '--';
            // Hide LTM table row (sidebar ltm-row doesn't exist in DTF)
            const ltmTableRow = document.getElementById('ltm-fee-row');
            if (ltmTableRow) ltmTableRow.style.display = 'none';
            document.getElementById('subtotal').textContent = '--';
            // DTF uses grand-total-with-tax instead of grand-total
            const grandTotalEl = document.getElementById('grand-total-with-tax');
            if (grandTotalEl) grandTotalEl.textContent = '--';
            // Clear all price and total cells
            document.querySelectorAll('.cell-price').forEach(cell => {
                cell.textContent = '-';
            });
            document.querySelectorAll('.cell-total').forEach(cell => {
                cell.textContent = '-';
            });
            return;
        }
    },

    _deriveRepriceInputs(totalQty, pricingQty, locationCount) {
        // Get tier label from API (use pricingQty for tier lookup)
        const tier = this.pricingCalculator.getTierForQuantity(pricingQty);
        // Calculate costs from API using pricingQty (ensures valid tier pricing)
        const transferBreakdown = this.pricingCalculator.calculateTransferCosts(this.selectedLocations, pricingQty);
        const transferCost = transferBreakdown.total;
        const laborCostPerLoc = this.pricingCalculator.getLaborCostPerLocation();
        const laborCost = laborCostPerLoc * locationCount;
        const freightPerTransfer = this.pricingCalculator.getFreightPerTransfer(pricingQty);
        const freightCost = freightPerTransfer * locationCount;
        const ltmPerUnit = this.pricingCalculator.calculateLTMPerUnit(pricingQty);
        // Get original LTM fee from API (not ltmPerUnit * qty which causes precision loss: $4.16 × 12 = $49.92)
        const tierData = this.pricingCalculator.getTierData(pricingQty);
        const totalLtmFee = tierData.ltmFee || 0;
        // [2026-06-11] keep the static "$50 LTM" banner in sync with the API fee
        const ltmBannerAmt = document.getElementById('ltm-fee-banner-amount');
        if (ltmBannerAmt && totalLtmFee > 0) ltmBannerAmt.textContent = totalLtmFee.toFixed(0);
        const marginDenom = this.pricingCalculator.getMarginDenominator(pricingQty);

        // LTM control panel — show/hide based on whether LTM applies
        const wouldHaveLTM = totalLtmFee > 0 && totalQty > 0;
        const ltmWrapper = document.getElementById('dtf-ltm-wrapper');
        if (ltmWrapper) {
            if (wouldHaveLTM) {
                ltmWrapper.style.display = '';
                if (!document.querySelector('#dtf-ltm-panel .ltm-control-panel')) {
                    renderLtmControlPanel('dtf-ltm-panel', { feeAmount: totalLtmFee });
                    initLtmControlListeners('dtf-ltm-panel', () => {
                        this.updatePricing();
                    });
                } else {
                    setLtmControlState('dtf-ltm-panel', { feeAmount: totalLtmFee });
                }
            } else {
                ltmWrapper.style.display = 'none';
                setLtmControlState('dtf-ltm-panel', { enabled: true, displayMode: 'builtin' });
            }
        }

        // Read LTM control state
        const ltmCtrlState = getLtmControlState('dtf-ltm-panel');
        const ltmEnabled = wouldHaveLTM ? ltmCtrlState.enabled : true;
        const ltmDisplayMode = ltmCtrlState.displayMode || 'builtin';
        const effectiveLtmPerUnit = ltmEnabled ? ltmPerUnit : 0;
        const effectiveLtmFee = ltmEnabled ? totalLtmFee : 0;
        return { tier, transferBreakdown, transferCost, laborCostPerLoc, laborCost,
            freightPerTransfer, freightCost, ltmPerUnit, totalLtmFee, marginDenom,
            ltmEnabled, ltmDisplayMode, effectiveLtmPerUnit, effectiveLtmFee };
    },

    _storePricingAndPaintLtmRow(px, totalQty) {
        const { tier, transferBreakdown, laborCostPerLoc, freightPerTransfer, marginDenom, ltmDisplayMode, effectiveLtmPerUnit, effectiveLtmFee } = px;

        // Store for quote save
        this.currentPricingData = {
            transferBreakdown,
            laborCostPerLoc,
            freightPerTransfer,
            ltmPerUnit: effectiveLtmPerUnit,
            totalLtmFee: effectiveLtmFee,
            marginDenom,
            tier,
            ltmDisplayMode
        };
        // Mirror on window for inline HTML tax/discount functions
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
        window.currentPricingData = window.currentPricingData || {};
        window.currentPricingData.ltmFee = effectiveLtmFee;
        window.currentPricingData.ltmDisplayMode = ltmDisplayMode;

        // LTM display — show table row in "separate" mode as informational (included in price)
        // DTF's pricing engine bakes LTM into the rounded unit price, so the fee row shows
        // the LTM amount but it's already in the subtotal — not added separately
        const ltmTableRow = document.getElementById('ltm-fee-row');
        const ltmTableUnit = document.getElementById('ltm-row-unit');
        const ltmTableTotal = document.getElementById('ltm-row-total');

        if (effectiveLtmFee > 0 && ltmDisplayMode === 'separate') {
            if (ltmTableRow) {
                ltmTableRow.style.display = 'table-row';
                const ltmQtyCell = ltmTableRow.querySelector('.cell-qty');
                if (ltmQtyCell) ltmQtyCell.textContent = totalQty;
                if (ltmTableUnit) ltmTableUnit.textContent = `$${effectiveLtmPerUnit.toFixed(2)}`;
                if (ltmTableTotal) ltmTableTotal.textContent = `(included)`;
                // Update fee label to clarify it's informational
                const feeLabel = ltmTableRow.querySelector('.fee-label');
                if (feeLabel) feeLabel.innerHTML = '<i class="fas fa-info-circle"></i> LTM Fee ($' + escapeHtml(effectiveLtmFee.toFixed(2)) + ' included in unit prices)';
            }
        } else {
            // builtin mode or LTM waived — hide fee row
            if (ltmTableRow) ltmTableRow.style.display = 'none';
        }
    },

    _paintParentRows(px, totalQty) {
        const { transferCost, laborCost, freightCost, marginDenom, ltmDisplayMode, effectiveLtmPerUnit } = px;

        let grandTotal = 0;
        // Process products from the products array (parent rows)
        this.products.forEach(product => {
            const row = /** @type {HTMLElement|null} */ (document.querySelector(`tr[data-product-id="${product.id}"]`));
            if (!row) return;

            // Skip child rows here - they're processed separately below
            if (row.classList.contains('child-row')) return;

            let productTotal = 0;
            let baseUnitPrice = 0; // For display in style column
            let baseDisplayPrice = 0; // Price shown in unit preview (may or may not include LTM)

            // Only count non-extended sizes (S, M, LG, XL) - extended sizes are in child rows
            const standardSizes = ['S', 'M', 'L', 'XL'];
            Object.entries(product.quantities).forEach(([size, qty]) => {
                if (qty > 0 && standardSizes.includes(size)) {
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges);
                    const garmentCost = product.baseCost / marginDenom + upcharge;
                    // Full unit price includes LTM (unless waived) — rounding absorbs LTM
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    // Price without LTM for separate mode display only
                    const priceWithoutLTM = this.pricingCalculator.applyRounding(garmentCost + transferCost + laborCost + freightCost);
                    // Always use roundedPrice for totals (LTM is baked in by pricing engine rounding)
                    // Separate mode fee row is informational — it shows how much LTM is included
                    productTotal += roundedPrice * qty;

                    // Track base unit price for display
                    if (baseUnitPrice === 0 && ['S', 'M', 'L'].includes(size)) {
                        baseUnitPrice = roundedPrice;
                        // Display price: builtin shows full price, separate shows base only
                        const displayPrice = (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') ? roundedPrice : priceWithoutLTM;
                        baseDisplayPrice = displayPrice;
                    }
                }
            });

            // If no base price yet, calculate it for display
            if (baseUnitPrice === 0 && totalQty > 0) {
                const garmentCost = product.baseCost / marginDenom;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                baseUnitPrice = this.pricingCalculator.applyRounding(unitPrice);
                const priceNoLTM = this.pricingCalculator.applyRounding(garmentCost + transferCost + laborCost + freightCost);
                baseDisplayPrice = (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') ? baseUnitPrice : priceNoLTM;
            }

            // Update row price (per-unit, not line total)
            // Support both class-based (.row-price) and ID-based (#row-price-{id}) selectors
            const rowId = row.dataset.rowId || /** @type {HTMLElement} */ (row).dataset.productId || product.id;
            const priceSpan = row.querySelector('.row-price') || document.getElementById(`row-price-${rowId}`);
            if (priceSpan) {
                priceSpan.textContent = `$${baseDisplayPrice.toFixed(2)}`;
                // Separate mode shows the LTM-stripped unit while the Total column is
                // LTM-inclusive — annotate so unit × qty visibly reconciles instead of
                // looking like broken math. (expert audit 2026-07-07)
                /** @type {HTMLElement} */ (priceSpan).title = (baseDisplayPrice !== baseUnitPrice)
                    ? `+$${effectiveLtmPerUnit.toFixed(2)}/pc small-batch fee — itemized in the fee row; the Total column includes it`
                    : '';
            }

            // Update row total (all standard sizes for this product)
            const totalCell = row.querySelector('.cell-total') || document.getElementById(`row-total-${rowId}`);
            if (totalCell) {
                // productTotal includes all standard sizes for this product with rounded prices
                const rowQty = Object.entries(product.quantities)
                    .filter(([size]) => ['S', 'M', 'L', 'XL'].includes(size))
                    .reduce((sum, [, qty]) => sum + (qty || 0), 0);
                totalCell.textContent = rowQty > 0 ? `$${productTotal.toFixed(2)}` : '-';
            }

            grandTotal += productTotal;
        });
        return grandTotal;
    },

    _paintChildRows(px) {
        const { transferCost, laborCost, freightCost, marginDenom, ltmDisplayMode, effectiveLtmPerUnit } = px;

        let grandTotal = 0;
        // Process child rows (extended sizes) - they have different unit prices with upcharges.
        // Money fields (qty/baseCost/upcharges/size) come from this.childRows JS
        // state; the DOM row is located only to PAINT its price/total cells —
        // display-only, mirroring the parent-row loop above. (2026-06-11 P2 closure)
        this.childRows.forEach((child, childRowId) => {
            const qty = child.qty || 0;

            if (qty > 0) {
                // Get size upcharge for this extended size (XXL/2XL, 3XL/XXXL, 4XL, 5XL, 6XL)
                const upcharge = this.getSizeUpcharge(child.size, child.sizeUpcharges);

                // Calculate unit price with upcharge (add AFTER margin, not before)
                const garmentCost = child.baseCost / marginDenom + upcharge;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);

                // Display mode: builtin shows LTM in price, separate shows base only
                let displayPrice;
                if (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') {
                    displayPrice = roundedPrice;
                } else {
                    const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
                    displayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
                }

                // Paint the display row (if present — pricing math doesn't need it)
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const priceCell = childRow.querySelector('.cell-price');
                    if (priceCell) {
                        priceCell.textContent = `$${displayPrice.toFixed(2)}`;
                        /** @type {HTMLElement} */ (priceCell).title = (displayPrice !== roundedPrice)
                            ? `+$${effectiveLtmPerUnit.toFixed(2)}/pc small-batch fee — itemized in the fee row; the Total column includes it`
                            : '';
                    }

                    // Child row total is LTM-INCLUSIVE like parent rows (roundedPrice,
                    // the billed amount) — it painted the stripped displayPrice before,
                    // so in separate mode child totals didn't foot to the subtotal and
                    // the table visibly contradicted itself. (expert audit 2026-07-07)
                    const childTotalCell = childRow.querySelector('.cell-total');
                    if (childTotalCell) {
                        childTotalCell.textContent = `$${(roundedPrice * qty).toFixed(2)}`;
                    }
                }

                // Always use roundedPrice for grand total (LTM baked in by pricing engine rounding)
                grandTotal += roundedPrice * qty;
            }
        });
        return grandTotal;
    },

    _computeNextTierSavings(px, totalQty, locationCount) {
        const { transferBreakdown, transferCost, freightCost, marginDenom } = px;

        // Compute per-piece savings for next tier nudge
        let nextTierSavings = null;
        try {
            const nextBreaks = [10, 24, 48, 72];
            const nextBreak = nextBreaks.find(b => totalQty < b);
            if (nextBreak && totalQty > 0) {
                // eslint-disable-next-line no-unused-vars -- verbatim (D1): unused in monolith
                const nextTierData = this.pricingCalculator.getTierData(nextBreak);
                const curMargin = marginDenom;
                const nextMargin = this.pricingCalculator.getMarginDenominator(nextBreak);
                if (curMargin && nextMargin && curMargin !== nextMargin) {
                    // Approximate: lower margin denom = higher price. Savings ≈ garment * (1/curMargin - 1/nextMargin)
                    // Use a typical $5 garment cost as reference
                    const typicalGarment = 5.0;
                    const curMarkup = typicalGarment / curMargin;
                    const nextMarkup = typicalGarment / nextMargin;
                    if (curMarkup > nextMarkup) nextTierSavings = curMarkup - nextMarkup;
                }
                // Also factor in transfer cost changes
                const nextTransfer = this.pricingCalculator.calculateTransferCosts(this.selectedLocations, nextBreak);
                if (nextTransfer && transferBreakdown) {
                    const transferSavings = (transferCost - nextTransfer.total);
                    nextTierSavings = (nextTierSavings || 0) + transferSavings;
                }
                // Factor in freight savings
                const nextFreight = this.pricingCalculator.getFreightPerTransfer(nextBreak) * locationCount;
                const freightSavings = freightCost - nextFreight;
                if (freightSavings > 0) nextTierSavings = (nextTierSavings || 0) + freightSavings;
                // Ensure positive
                if (nextTierSavings <= 0) nextTierSavings = null;
            }
        } catch (e) { /* graceful fallback */ }
        window.currentPricingData.nextTierSavings = nextTierSavings;
        updateQuantityNudge(totalQty, 'dtf', nextTierSavings);
        return nextTierSavings;
    },

    async updatePricing() {
        const totalQty = this.getTotalQuantity();
        const locationCount = this.selectedLocations.length;

        // Heat-sensitive check on every reprice so edit-load / duplicate / search
        // adds are all covered (warned styles only toast once).
        this._warnHeatSensitiveProducts();

        // Track if under the API-derived minimum (10 today, Caspio-changeable)
        const minQty = this.getMinimumQuantity();
        const isUnderMinimum = totalQty > 0 && totalQty < minQty;

        // Show/hide minimum order warning
        const minOrderWarning = document.getElementById('min-order-warning');
        if (minOrderWarning) {
            minOrderWarning.style.display = isUnderMinimum ? 'block' : 'none';
        }

        if (totalQty === 0) { this._paintZeroQuantityState(totalQty); return; }

        // For quantities under the minimum, price at the minimum tier — on-screen
        // ESTIMATE only so users understand costs; saveAndGetLink() blocks actually
        // saving/pushing a sub-minimum quote. (expert audit 2026-07-07)
        const pricingQty = isUnderMinimum ? minQty : totalQty;

        // Ensure pricing data is loaded from API
        try {
            await this.pricingCalculator.ensureLoaded();
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to load pricing data:', error);
            this.showError('Unable to load pricing data. Please refresh the page.');
            return;
        }

        const px = this._deriveRepriceInputs(totalQty, pricingQty, locationCount);
        const { tier } = px;

        // Update sidebar displays
        document.getElementById('total-qty').textContent = totalQty;
        // Show tier with warning if under minimum
        const tierDisplay = isUnderMinimum ? `${totalQty} (Min ${minQty})` : tier;
        document.getElementById('pricing-tier').textContent = tierDisplay;

        this._storePricingAndPaintLtmRow(px, totalQty);

        // Calculate subtotal and grand total
        let grandTotal = 0;

        grandTotal += this._paintParentRows(px, totalQty);

        grandTotal += this._paintChildRows(px);

        // Update subtotal and grand total
        document.getElementById('subtotal').textContent = `$${grandTotal.toFixed(2)}`;
        updatePerUnitPrice(grandTotal, totalQty);

        const nextTierSavings = this._computeNextTierSavings(px, totalQty, locationCount);
        window.currentPricingData.nextTierSavings = nextTierSavings;
        updateQuantityNudge(totalQty, 'dtf', nextTierSavings);

        // Seed the pre-tax subtotal display; updateTaxCalculation() (below) immediately
        // re-renders it from computeFeesAndTotals() — the ONE money pipeline (Batch 1.3;
        // the old page-side copy read a dataset.base breadcrumb here and drifted).
        const preTaxSubtotal = document.getElementById('pre-tax-subtotal');
        if (preTaxSubtotal) {
            preTaxSubtotal.textContent = `$${grandTotal.toFixed(2)}`;
        }

        // Update tax calculation if the function exists
        if (typeof updateTaxCalculation === 'function') {
            updateTaxCalculation();
        }

        // Enable/disable continue button
        const continueBtn = /** @type {HTMLInputElement|null} */ (document.getElementById('continue-btn'));
        if (continueBtn) {
            continueBtn.disabled = totalQty < this.getMinimumQuantity() || this.selectedLocations.length === 0;
        }
    },

    getTotalQuantity() {
        // Count quantities from products array (only standard sizes - extended in child rows)
        const standardSizes = ['S', 'M', 'L', 'XL'];
        let total = this.products.reduce((sum, p) => {
            // Only count standard sizes to avoid double-counting child rows
            return sum + Object.entries(p.quantities)
                .filter(([size]) => standardSizes.includes(size))
                .reduce((s, [, q]) => s + (q || 0), 0);
        }, 0);

        // Add child row quantities (extended sizes) — from this.childRows JS
        // state, never the DOM (2026-06-11 P2 closure)
        this.childRows.forEach(child => {
            total += child.qty || 0;
        });

        return total;
    },

    getTierForQuantity(qty) {
        const m = this.getMinimumQuantity();
        if (qty < m) return `Min ${m}`;
        if (qty <= 23) return '10-23';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    },

    /**
     * API-derived order minimum (lowest tier's minQuantity; fallback 10 until the
     * bundle loads). Single source for the save gate, the under-minimum clamp,
     * and the tier display. (expert audit 2026-07-07)
     */
    getMinimumQuantity() {
        return (this.pricingCalculator && typeof this.pricingCalculator.getMinimumQuantity === 'function')
            ? this.pricingCalculator.getMinimumQuantity()
            : 10;
    },

    /**
     * Calculate subtotal from internal state (not DOM).
     * Mirrors updatePricing() math but returns numbers for save/print.
     * @returns {{ subtotal: number, productTotals: Map<id, { standardTotal: number, standardUnitPrice: number }>, childTotals: Map<childRowId, { total: number, unitPrice: number }> }}
     */
    calculateFromState() {
        if (!this.currentPricingData || !this.pricingCalculator) {
            return { subtotal: 0, productTotals: new Map(), childTotals: new Map() };
        }

        // Reset the per-run fallback tracker; getSizeUpcharge() repopulates it and
        // _surfaceUpchargeFallbackWarning() (below) surfaces any hardcoded upcharge actually used.
        this._upchargeFallbackSizes = new Set();

        const totalQty = this.getTotalQuantity();
        const locationCount = this.selectedLocations.length;
        const isUnderMinimum = totalQty > 0 && totalQty < this.getMinimumQuantity();
        // eslint-disable-next-line no-unused-vars -- verbatim (D1): unused in monolith
        const pricingQty = isUnderMinimum ? 10 : totalQty;

        const { marginDenom, ltmPerUnit, transferBreakdown, laborCostPerLoc, freightPerTransfer } = this.currentPricingData;
        const transferCost = transferBreakdown?.total ?? 0;
        const laborCost = (laborCostPerLoc ?? 0) * locationCount;
        const freightCost = (freightPerTransfer ?? 0) * locationCount;

        let subtotal = 0;
        const productTotals = new Map();
        const childTotals = new Map();

        // Standard sizes per product (same as updatePricing lines 1524-1595)
        const standardSizes = ['S', 'M', 'L', 'XL'];
        this.products.forEach(product => {
            let productTotal = 0;
            let baseDisplayPrice = 0;

            Object.entries(product.quantities).forEach(([size, qty]) => {
                if (qty > 0 && standardSizes.includes(size)) {
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges);
                    const garmentCost = product.baseCost / marginDenom + upcharge;
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    productTotal += roundedPrice * qty;

                    if (baseDisplayPrice === 0 && ['S', 'M', 'L'].includes(size)) {
                        // Persist the LTM-INCLUSIVE rounded price. This is the SAVE/PRINT
                        // path: the stored FinalUnitPrice is what the ShopWorks push bills
                        // and must reconcile with the LTM-in SubtotalAmount. Stripping LTM
                        // here (priceNoLTM) under-priced every qty<24 DTF order pushed to
                        // ShopWorks by the full LTM fee. (LTM's separate-line presentation
                        // is an on-screen-only concern handled by updatePricing.) (2026-06-01)
                        baseDisplayPrice = roundedPrice;
                    }
                }
            });

            if (baseDisplayPrice === 0 && totalQty > 0) {
                const garmentCost = product.baseCost / marginDenom;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                // LTM-inclusive (see standard-size note above) — persisted price bills the full amount.
                baseDisplayPrice = this.pricingCalculator.applyRounding(unitPrice);
            }

            productTotals.set(product.id, { standardTotal: productTotal, standardUnitPrice: baseDisplayPrice });
            subtotal += productTotal;
        });

        // Child rows (extended sizes) — from this.childRows JS state, NEVER the
        // DOM (2026-06-11 P2 closure: this was the last DOM read in the money
        // path). Keys stay `row-${id}` so save/print lookups are unchanged.
        this.childRows.forEach((child, childRowId) => {
            const qty = child.qty || 0;
            if (qty > 0) {
                const upcharge = this.getSizeUpcharge(child.size, child.sizeUpcharges);
                const garmentCost = child.baseCost / marginDenom + upcharge;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);

                // LTM-inclusive (see standard-size note) — persisted child unit price bills the full amount.
                const displayPrice = roundedPrice;

                const childTotal = roundedPrice * qty;
                childTotals.set(`row-${childRowId}`, { total: childTotal, unitPrice: displayPrice });
                subtotal += childTotal;
            }
        });

        this._surfaceUpchargeFallbackWarning();
        return { subtotal, productTotals, childTotals };
    },

    /**
     * Compute the adjusted pre-tax subtotal, tax, and grand total from state +
     * fee inputs: percent discount applies to products + art + design + rush;
     * discount is clamped at $0; shipping is added AFTER the discount (not
     * discountable, taxable in WA); tax is rounded to cents before summing.
     * THE ONE fee/tax pipeline (Batch 1.3): saveAndGetLink(), buildPricingDataForInvoice(),
     * AND the on-screen display — updateTaxCalculation() (dtf-quote-page.js) renders
     * from this and does no math of its own, so screen/saved/printed cannot drift.
     * (2026-06-11 — the PDF previously taxed the screen's pre-tax subtotal while
     * footing line items from a divergent DOM/fallback path: $493.50 lines under
     * a $1,018.98 grand total on a real customer quote.)
     */
    computeFeesAndTotals(stateCalc) {
        const subtotal = stateCalc.subtotal;
        const artCharge = /** @type {HTMLInputElement|null} */ (document.getElementById('art-charge-toggle'))?.checked
            ? (parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('art-charge'))?.value) || 0) : 0;
        const designHours = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('graphic-design-hours'))?.value) || 0;
        const grtRate = getServicePrice('GRT-75', 75);
        // A load FAILURE already toasts via loadServiceCodePrices(); this covers the silent case
        // where codes loaded but GRT-75 is missing, so a rep never bills the $75 default unwarned.
        if (designHours > 0 && !(window._serviceCodes && window._serviceCodes['GRT-75']) && !window._dtfGrtFallbackWarned) {
            // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
            window._dtfGrtFallbackWarned = true;
            const m = 'Graphic-design rate is an estimate ($' + grtRate.toFixed(2) + '/hr) — live pricing didn\'t return it. Verify before saving.';
            if (typeof this.showToast === 'function') this.showToast(m, 'warning'); else if (typeof showToast === 'function') showToast(m, 'warning');
        }
        const graphicDesignCharge = designHours * grtRate;
        const rushFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'))?.value) || 0;
        const discountAmount = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('discount-amount'))?.value) || 0;
        const discountType = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-type'))?.value || 'fixed';
        // Percent base = products + fees (same as updateTaxCalculation, NOT products-only)
        const discountBase = subtotal + artCharge + graphicDesignCharge + rushFee;
        const discount = discountType === 'percent' ? discountBase * (discountAmount / 100) : discountAmount;
        const shippingFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('dtf-shipping-fee'))?.value) || 0;
        const preTaxSubtotal = Math.max(0, discountBase - discount) + shippingFee;
        const includeTax = document.getElementById('include-tax') ? !!/** @type {HTMLInputElement} */ (document.getElementById('include-tax')).checked : true;
        // Shared parseRatePercent: 0 is a VALID rate; only NaN/empty falls back (2026-06-10 EMB fix, synced)
        const taxRatePct = (typeof parseRatePercent === 'function')
            ? parseRatePercent(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value, 10.2)
            : (Number.isFinite(parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value))
                ? parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value) : 10.2);
        const taxAmount = includeTax ? Math.round(preTaxSubtotal * (taxRatePct / 100) * 100) / 100 : 0;
        const grandTotal = preTaxSubtotal + taxAmount;
        return {
            subtotal, artCharge, designHours, graphicDesignCharge, rushFee,
            discountAmount, discountType, discount, shippingFee,
            preTaxSubtotal, includeTax, taxRatePct, taxAmount, grandTotal
        };
    },

    getSizeUpcharge(size, upcharges) {
        // Documented extended-size fallbacks. Per Erik's #1 rule a hardcoded price is allowed
        // ONLY as a fallback AND must surface a visible warning — so whenever we actually USE
        // one (the API didn't return that size) we flag it via _flagUpchargeFallback();
        // calculateFromState() then shows a toast so a rep never saves/bills a silent estimated
        // upcharge. (The customer engine THROWS PRICE_UNAVAILABLE in the same situation —
        // quote-cart-engine.js dtfSizeUpcharge.)
        const defaults = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00, '5XL': 5.00, '6XL': 6.00 };
        const sizeAliases = { 'XXL': '2XL', 'XXXL': '3XL' };
        const normalizedSize = sizeAliases[size] || size;

        if (!upcharges || Object.keys(upcharges).length === 0) {
            // No API upcharge data at all.
            if (defaults[normalizedSize] != null) this._flagUpchargeFallback(normalizedSize);
            return defaults[normalizedSize] || 0;
        }

        // Helper to get value (uses nullish coalescing to handle 0 values correctly)
        const getValue = (...keys) => {
            for (const key of keys) {
                if (upcharges[key] !== undefined && upcharges[key] !== null) {
                    return upcharges[key];
                }
            }
            return null;
        };

        const apiByKeys = {
            '2XL': getValue('2XL', '2X', 'XXL'),
            '3XL': getValue('3XL', '3X', 'XXXL'),
            '4XL': getValue('4XL', '4X'),
            '5XL': getValue('5XL', '5X'),
            '6XL': getValue('6XL', '6X')
        };

        if (defaults[normalizedSize] != null) {
            // Extended size: prefer the live API upcharge; fall back (flagged) if absent.
            if (apiByKeys[normalizedSize] != null) return apiByKeys[normalizedSize];
            this._flagUpchargeFallback(normalizedSize);
            return defaults[normalizedSize];
        }

        // Sizes outside 2XL-6XL (XS, talls LT/XLT/2XLT…, youth) have no hardcoded default —
        // use the API upcharge directly when present, else 0. (2026-06-11)
        return getValue(normalizedSize) ?? 0;
    },

    /** Record that a hardcoded extended-size upcharge was substituted because live pricing
     *  lacked it. Surfaced as a visible warning by calculateFromState() (Erik's #1 rule). */
    _flagUpchargeFallback(size) {
        if (!this._upchargeFallbackSizes) this._upchargeFallbackSizes = new Set();
        this._upchargeFallbackSizes.add(size);
    },

    /** Show ONE visible warning (de-duped per fallback set) when calculateFromState used any
     *  hardcoded extended-size upcharge fallback this run. */
    _surfaceUpchargeFallbackWarning() {
        const fb = this._upchargeFallbackSizes;
        const key = fb && fb.size > 0 ? [...fb].sort().join(', ') : '';
        if (!key) { this._upchargeWarnShownFor = ''; return; }
        if (key === this._upchargeWarnShownFor) return; // already warned for this exact set
        this._upchargeWarnShownFor = key;
        const msg = 'Size upcharge for ' + key + ' is an ESTIMATE — live pricing didn\'t return it. Verify before saving/printing.';
        if (typeof this.showToast === 'function') this.showToast(msg, 'warning');
        else if (typeof showToast === 'function') showToast(msg, 'warning');
        console.warn('[DTF] ' + msg + ' (sellingPriceDisplayAddOns missing these sizes)');
    },

    /**
     * Recalculate pricing - wrapper for updatePricing()
     * Called from global deleteRow() function
     */
    recalculatePricing() {
        this.updatePricing();
    },

    /**
     * Update pricing from a specific row's DOM data
     * Called from global onSizeChange() function
     * @param {number} rowId - The row ID
     * @param {HTMLElement} row - The row element
     */
    updatePricingFromRow(rowId, row) {
        // [2026-06-11] child rows are priced via their parent + childRowMap —
        // creating a this.products entry for them made phantom products (blank
        // style/desc) that leaked into clipboard text and the email payload,
        // and every money path had to know to filter them.
        if (row && row.classList && row.classList.contains('child-row')) {
            this.updatePricing();
            return;
        }
        // Find or create the product entry in this.products array
        let product = this.products.find(p => p.id === rowId);

        if (!product) {
            // Create new product entry if doesn't exist
            const styleInput = row.querySelector('.style-input');
            const descInput = row.querySelector('.desc-input');
            const baseCost = parseFloat(row.dataset.baseCost) || 0;
            const sizeUpcharges = row.dataset.sizeUpcharges ? JSON.parse(row.dataset.sizeUpcharges) : {};

            product = {
                id: rowId,
                styleNumber: styleInput ? /** @type {HTMLInputElement} */ (styleInput).value : '',
                description: descInput ? /** @type {HTMLInputElement} */ (descInput).value : '',
                baseCost: baseCost,
                sizeUpcharges: sizeUpcharges,
                color: row.dataset.colorName || '',
                catalogColor: row.dataset.catalogColor || '',
                quantities: { XS: 0, S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0, '6XL': 0 }
            };
            this.products.push(product);
        }

        // Update quantities from row inputs (standard sizes)
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn)').forEach(input => {
            const size = /** @type {HTMLElement} */ (input).dataset.size;
            const qty = parseInt(/** @type {HTMLInputElement} */ (input).value) || 0;
            // eslint-disable-next-line no-prototype-builtins -- verbatim (D1): monolith-original hasOwnProperty call
            if (size && product.quantities.hasOwnProperty(size)) {
                product.quantities[size] = qty;
            }
        });

        // Update extended sizes from row data attribute (set by applyExtendedSizes)
        if (row.dataset.extendedSizes) {
            try {
                const extendedQtys = JSON.parse(row.dataset.extendedSizes);
                Object.entries(extendedQtys).forEach(([size, qty]) => {
                    // eslint-disable-next-line no-prototype-builtins -- verbatim (D1): monolith-original hasOwnProperty call
                    if (product.quantities.hasOwnProperty(size)) {
                        product.quantities[size] = qty;
                    }
                });
            } catch (e) {
                console.warn('[DTFQuoteBuilder] Failed to parse extended sizes:', e);
            }
        }

        // Recalculate pricing
        this.updatePricing();
    },
};
