/**
 * DTFQuoteBuilder prototype mixin — summary/print/invoice-contract/email-text/clipboard + error surfaces.
 * Batch 4.2 (2026-07-09): methods moved VERBATIM from quote-builder-class.js
 * (`this.` state intact — the class assembles via Object.assign(prototype, ...)).
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global escapeHtml, alert, EmbroideryInvoiceGenerator, confirm, requestAnimationFrame */

export const outputMethods = {

    showSummary() {
        const modal = document.getElementById('summary-modal');
        if (!modal) return;

        // [2026-06-11] real id when one exists; never a random provisional id
        // (it leaked onto #quote-id, which the printed PDF reads as the quote #)
        const quoteId = this.editingQuoteId || this.lastSavedQuoteId || 'Pending save';
        document.getElementById('quote-id').textContent = quoteId;

        // Build locations summary
        const locationsHTML = this.selectedLocations.map(loc => {
            const config = this.locationConfig[loc];
            return `<span class="summary-badge">${config.label} (${config.size})</span>`;
        }).join('');
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): internal locationConfig labels/sizes only
        document.getElementById('summary-locations').innerHTML = locationsHTML;

        // Build products summary (including child row quantities)
        const productsHTML = this.products.map(p => {
            // Get standard sizes from products array (S, M, LG, XL only)
            const standardSizes = ['S', 'M', 'L', 'XL'];
            const allQuantities = {};
            let totalQty = 0;

            standardSizes.forEach(size => {
                const qty = p.quantities[size] || 0;
                if (qty > 0) {
                    allQuantities[size] = qty;
                    totalQty += qty;
                }
            });

            // Add child row quantities — from JS state, not the DOM (2026-06-11 P2)
            this.getChildRowsForParent(p.id).forEach(child => {
                const qty = child.qty || 0;
                if (qty > 0) {
                    // Normalize display size (XXL->2XL, XXXL->3XL)
                    const displaySize = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    allQuantities[displaySize] = qty;
                    totalQty += qty;
                }
            });

            if (totalQty === 0) return '';

            const sizesStr = Object.entries(allQuantities)
                .map(([size, qty]) => `${size}: ${qty}`)
                .join(', ');

            return `
                <div class="summary-product">
                    <strong>${escapeHtml(p.styleNumber)}</strong> - ${escapeHtml(p.description)}
                    <br><small>Color: ${escapeHtml(p.color || 'Not selected')} | ${escapeHtml(sizesStr)}</small>
                </div>
            `;
        }).filter(Boolean).join('');
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): summary rows escapeHtml style/description/color/sizes at build (stage-1 fix)
        document.getElementById('summary-products').innerHTML = productsHTML || '<div>No products</div>';

        // Build pricing summary
        const totalQty = this.getTotalQuantity();
        const tier = this.getTierForQuantity(totalQty);
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace(/[$,]/g, '') || '0');

        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric totals + internal tier label only
        document.getElementById('summary-pricing').innerHTML = `
            <div class="summary-pricing-row">
                <span>Total Quantity:</span>
                <span>${totalQty} pieces</span>
            </div>
            <div class="summary-pricing-row">
                <span>Pricing Tier:</span>
                <span>${tier}</span>
            </div>
            <div class="summary-pricing-row grand">
                <span>Grand Total:</span>
                <span>$${grandTotal.toFixed(2)}</span>
            </div>
        `;

        modal.style.display = 'flex';
    },

    /**
     * Print professional PDF quote using EmbroideryInvoiceGenerator
     * Transforms DTF product data into the format expected by the invoice generator
     */
    printQuote() {
        // Validate we have products
        if (this.products.length === 0 || this.getTotalQuantity() === 0) {
            this.showError('Add products before printing');
            return;
        }

        // Same money gates as saveAndGetLink (expert audit 2026-07-07): a zero-
        // location quote prints garment-only (~half the real price), and a sub-
        // minimum quote prints an under-collected small-batch fee.
        if (!this.selectedLocations || this.selectedLocations.length === 0) {
            this.showError('Select at least one transfer location — the quote is garment-only right now.');
            return;
        }
        {
            const _printMin = this.getMinimumQuantity();
            if (this.getTotalQuantity() < _printMin) {
                this.showError(`DTF minimum is ${_printMin} pieces — the on-screen price is an estimate and can't be printed as a quote.`);
                return;
            }
        }

        // Pricing-loaded guard (parity with saveAndGetLink L2332/L2342): if the pricing snapshot is
        // missing (API down at page load — init() keeps the form interactive), calculateFromState()
        // returns all zeros, so Print would emit a $0.00 customer PDF with no error. Erik's #1 rule:
        // visible failure, never a silent wrong price. (2026-06-14)
        if (!this.currentPricingData || !this.pricingCalculator) {
            this.showError('Pricing data is not loaded — cannot print. Please refresh and try again.');
            return;
        }
        if (!(this.calculateFromState().subtotal > 0)) {
            this.showError('Quote totals computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before printing.');
            return;
        }

        try {
            // Build pricing data in format expected by EmbroideryInvoiceGenerator
            const pricingData = this.buildPricingDataForInvoice();

            // Customer data from form (includes order fields for PDF header)
            const customerData = {
                name: document.getElementById('customer-name')?.value || 'Customer',
                company: document.getElementById('company-name')?.value || '',
                email: document.getElementById('customer-email')?.value || '',
                phone: document.getElementById('customer-phone')?.value || '',
                salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com',
                // The shared generator reads `.project` — the old `projectName`-only key
                // meant DTF project names NEVER printed. Keep both. (expert audit 2026-07-07)
                project: document.getElementById('project-name')?.value || '',
                projectName: document.getElementById('project-name')?.value || '',
                orderNumber: document.getElementById('order-number')?.value || '',
                poNumber: document.getElementById('po-number')?.value || '',
                reqShipDate: document.getElementById('req-ship-date')?.value || '',
                // SPECIAL NOTES footer on the PDF (shared generator supports it;
                // EMB passes it — DTF never did, so rep notes silently vanished)
                notes: document.getElementById('dtf-notes')?.value?.trim() || ''
            };

            // Generate and open print window
            const invoiceGenerator = new EmbroideryInvoiceGenerator();
            const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);

            const printWindow = window.open('', '_blank');
            // eslint-disable-next-line no-unsanitized/method -- print window: invoiceHTML from embroidery-quote-invoice.js, which esc()-escapes every customer/product field
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 300);

        } catch (error) {
            console.error('Print error:', error);
            this.showError('Error generating PDF. Please try again.');
        }
    },

    /**
     * Build pricing data structure for EmbroideryInvoiceGenerator
     * Transforms DTF products into line items with size breakdowns
     */
    buildPricingDataForInvoice() {
        const totalQty = this.getTotalQuantity();
        // SINGLE SOURCE (2026-06-11): line items, subtotal, fees, tax base ALL come
        // from calculateFromState() + computeFeesAndTotals() — the same math the
        // save path uses. The old code computed line items from DOM-displayed
        // prices + a broken per-product fallback (transferBreakdown[loc] never
        // matched the {breakdown:[],total} shape, so the fallback silently dropped
        // ALL transfer costs and LTM) while taxing the screen's pre-tax subtotal:
        // a real customer PDF printed $15.50/unit lines footing to $493.50 under a
        // $1,018.98 GRAND TOTAL (true unit price $39.50, true subtotal $925.50).
        const stateCalc = this.calculateFromState();
        const totals = this.computeFeesAndTotals(stateCalc);
        // Real quote # chain — lastSavedQuoteId was omitted, so a just-saved NEW
        // quote printed a fabricated `DTF-<epoch>` that matches nothing in Quote
        // Mgmt; null lets the shared generator print "DRAFT" when truly unsaved.
        const quoteId = document.getElementById('quote-id')?.textContent
            || this.editingQuoteId
            || this.lastSavedQuoteId
            || null;

        // Build products array with line items
        const products = [];

        // Get pricing tier info
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        // Iterate through each product row. NO early qty-skip here: a product whose
        // only pieces are extended sizes has all-zero standard quantities, and the
        // old skip dropped it from the PDF entirely — the empty-lineItems guard at
        // the bottom handles truly empty products. (2026-06-11)
        this.products.forEach(product => {
            // Build line items - separate base sizes from extended sizes
            const lineItems = [];

            // Base sizes (S, M, L, XL) - 2XL is handled as child row to prevent double-counting
            const baseSizes = ['S', 'M', 'L', 'XL'];
            const baseSizeQtys = {};
            let baseQty = 0;

            baseSizes.forEach(size => {
                const qty = parseInt(product.quantities[size]) || 0;
                if (qty > 0) {
                    baseSizeQtys[size] = qty;
                    baseQty += qty;
                }
            });

            if (baseQty > 0) {
                // Build description string like "S(2) M(3) LG(1)"
                const desc = Object.entries(baseSizeQtys)
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');

                // Unit price + line total from state math (same source as save) —
                // total uses standardTotal (per-size rounded sum), so lines always
                // foot to stateCalc.subtotal even if per-size prices ever differ
                const calcData = stateCalc.productTotals.get(product.id);
                lineItems.push({
                    description: desc,
                    quantity: baseQty,
                    unitPrice: calcData?.standardUnitPrice || 0,
                    total: calcData?.standardTotal || 0
                });
            }

            // Extended sizes — from this.childRows JS state (2026-06-11 P2:
            // the print path never reads the DOM). Qty from state; price/total
            // from the same stateCalc the save path uses — in separate-LTM
            // display mode the on-screen cell shows the LTM-stripped price
            // while the tax base is LTM-inclusive (rows under-footed).
            const extendedItems = [];  // Collect extended items for sorting
            this.getChildRowsForParent(product.id).forEach(child => {
                const qty = child.qty || 0;
                if (qty > 0) {
                    const childCalcData = stateCalc.childTotals.get(`row-${child.id}`);
                    const unitPrice = childCalcData?.unitPrice || 0;

                    // Normalize size display (XXL→2XL, XXXL→3XL for consistency)
                    const displaySize = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    extendedItems.push({
                        description: `${displaySize}(${qty})`,
                        quantity: qty,
                        unitPrice: unitPrice,
                        total: childCalcData?.total ?? (qty * unitPrice),
                        hasUpcharge: true,
                        _sortKey: child.size  // Keep original size for sorting
                    });
                }
            });

            // Sort extended items by size order (2XL before 3XL, etc.)
            if (window.ExtendedSizesConfig?.getSizeSortIndex) {
                extendedItems.sort((a, b) =>
                    window.ExtendedSizesConfig.getSizeSortIndex(a._sortKey) -
                    window.ExtendedSizesConfig.getSizeSortIndex(b._sortKey)
                );
            }
            // Add sorted extended items to line items
            extendedItems.forEach(item => {
                delete item._sortKey;  // Remove sort key before adding
                lineItems.push(item);
            });

            if (lineItems.length > 0) {
                products.push({
                    product: {
                        style: product.styleNumber,
                        title: product.description,
                        color: product.color || ''
                    },
                    lineItems: lineItems
                });
            }
        });

        // Subtotal/fees/discount/tax all from the shared state math (computed above).
        // Line items were built from the SAME stateCalc, so the printed product rows
        // foot exactly to totals.subtotal and the fee rows foot to preTaxSubtotal.
        const discountReason = document.getElementById('discount-reason')?.value || '';

        return window.QuotePricingData.buildPricingData({
            method: 'DTF',
            quoteId: quoteId,
            tier: tier,
            products: products,
            subtotal: totals.subtotal,
            grandTotal: totals.subtotal,
            // Authoritative pre-tax adjusted subtotal drives the PDF tax + GRAND TOTAL
            // so the printed total matches the on-screen #grand-total-with-tax.
            preTaxSubtotal: totals.preTaxSubtotal,
            includeTax: totals.includeTax,
            // Numeric percent via shared parseRatePercent — the old `value || '10.1'`
            // silently printed 10.1% for a cleared field, and the generator treats
            // values ≤1 as decimals (typing '1' printed 100% tax). String of a
            // finite percent keeps the generator's >1 branch deterministic.
            taxRate: String(totals.taxRatePct),
            setupFees: 0,
            additionalServicesTotal: 0,
            // Empty logos means embroidery specs section will be skipped
            logos: [],
            // DTF-specific info
            selectedLocations: this.selectedLocations,
            locationDetails: this.selectedLocations.map(loc => ({
                code: loc,
                label: this.locationConfig[loc]?.label || loc,
                size: this.locationConfig[loc]?.size || ''
            })),
            ltmFee: this.currentPricingData?.totalLtmFee || 0,
            // ALWAYS true for DTF: the pricing engine bakes LTM into every unit
            // price (both display modes), so a separate $50 fee row would double-
            // display it and the PDF rows would over-foot by the LTM. The screen's
            // "separate" mode row is informational-only ("included"). (2026-06-11)
            ltmDistributed: true,
            totalQuantity: totalQty,
            // Artwork services
            artCharge: totals.artCharge,
            graphicDesignCharge: totals.graphicDesignCharge,
            graphicDesignHours: totals.designHours,
            // Itemized on the PDF so the rows foot to the total (already inside preTaxSubtotal).
            shippingFee: totals.shippingFee,
            // Rush and discount
            rushFee: totals.rushFee,
            discount: totals.discount,
            discountType: totals.discountType,
            discountReason: discountReason
        });
    },

    /**
     * Focus the product search input (called by Add Product button)
     */
    focusProductSearch() {
        const searchInput = document.getElementById('product-search');
        if (searchInput && !searchInput.disabled) {
            searchInput.focus();
            searchInput.select();
        } else if (searchInput && searchInput.disabled) {
            this.showToast('Select a location first', 'warning');
        }
    },

    /**
     * Copy Quote ID to clipboard
     */
    copyQuoteId() {
        const quoteId = document.getElementById('quote-id').textContent;
        if (!quoteId || quoteId === 'DTF----') {
            this.showToast('No quote ID to copy', 'warning');
            return;
        }

        navigator.clipboard.writeText(quoteId).then(() => {
            this.showToast('Quote ID copied!', 'success');
        }).catch(_err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = quoteId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Quote ID copied!', 'success');
        });
    },

    /**
     * Clear all products from the quote
     */
    clearAllProducts() {
        if (this.products.length === 0) {
            this.showToast('No products to clear', 'info');
            return;
        }

        if (!confirm('Remove all products from this quote?')) return;

        // Clear products array
        this.products = [];
        this.productIndex = 0;

        // Clear table
        const tbody = document.getElementById('product-tbody');
        if (tbody) tbody.innerHTML = '';

        // Show empty state
        const emptyMessage = document.getElementById('empty-table-message');
        if (emptyMessage) emptyMessage.style.display = 'block';

        // Update pricing
        this.updatePricing();

        this.showToast('All products cleared', 'success');
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.dtf-toast');
        if (existingToast) existingToast.remove();

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `dtf-toast dtf-toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${escapeHtml(type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle')}"></i>
            <span>${escapeHtml(message)}</span>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    /**
     * Generate plain text quote for clipboard
     */
    generateQuoteText() {
        // [2026-06-11] rebuilt from state math (calculateFromState +
        // computeFeesAndTotals): the old text read the DOM grand total, dropped
        // ALL extended sizes (2XL+), could print blank phantom product lines, and
        // showed a tax-inclusive GRAND TOTAL with no subtotal/fees/tax disclosure.
        const totalQty = this.getTotalQuantity();
        const stateCalc = this.calculateFromState();
        const totals = this.computeFeesAndTotals(stateCalc);
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        let text = '';
        text += `NORTHWEST CUSTOM APPAREL\n`;
        text += `2025 Freeman Road East, Milton, WA 98354\n`;
        text += `Phone: (253) 922-5793 | Email: sales@nwcustomapparel.com\n\n`;

        text += `DTF TRANSFER QUOTE\n`;
        const quoteRef = this.editingQuoteId || this.lastSavedQuoteId;
        if (quoteRef) text += `Quote ID: ${quoteRef}\n`;
        text += `Date: ${new Date().toLocaleDateString()}\n`;
        text += `Valid for: 30 days\n\n`;

        text += `TRANSFER LOCATIONS:\n`;
        this.selectedLocations.forEach(loc => {
            const config = this.locationConfig[loc];
            text += `  - ${config.label} (${config.size})\n`;
        });
        text += `\n`;

        text += `PRODUCTS:\n`;
        const standardSizes = ['S', 'M', 'L', 'XL'];
        this.products.forEach(product => {
            const calcData = stateCalc.productTotals.get(product.id);
            const stdParts = standardSizes
                .filter(s => (product.quantities[s] || 0) > 0)
                .map(s => `${s}(${product.quantities[s]})`);
            const stdQty = standardSizes.reduce((s, sz) => s + (product.quantities[sz] || 0), 0);
            const childLines = [];
            this.childRows.forEach((child, childRowId) => {
                if (Number(child.parentId) === Number(product.id) && child.qty > 0) {
                    const childCalc = stateCalc.childTotals.get(`row-${childRowId}`);
                    childLines.push(`  ${child.size}(${child.qty}) @ $${(childCalc?.unitPrice || 0).toFixed(2)} = $${(childCalc?.total || 0).toFixed(2)}`);
                }
            });
            if (stdQty === 0 && childLines.length === 0) return; // nothing quotable (incl. phantom rows)
            text += `${product.styleNumber} - ${product.description}\n`;
            text += `  Color: ${product.color || 'Not selected'}\n`;
            if (stdQty > 0) {
                text += `  ${stdParts.join(' ')} @ $${(calcData?.standardUnitPrice || 0).toFixed(2)} = $${(calcData?.standardTotal || 0).toFixed(2)}\n`;
            }
            childLines.forEach(l => { text += l + `\n`; });
            text += `\n`;
        });

        text += `PRICING SUMMARY:\n`;
        text += `  Total Quantity: ${totalQty} pieces\n`;
        text += `  Pricing Tier: ${tier}\n`;
        if (this.currentPricingData?.totalLtmFee > 0) {
            text += `  Small Batch Fee: $${this.currentPricingData.totalLtmFee.toFixed(2)} (included in pricing)\n`;
        }
        text += `  Products Subtotal: $${totals.subtotal.toFixed(2)}\n`;
        if (totals.artCharge > 0) text += `  Art/Logo Charge: $${totals.artCharge.toFixed(2)}\n`;
        if (totals.graphicDesignCharge > 0) text += `  Graphic Design: $${totals.graphicDesignCharge.toFixed(2)}\n`;
        if (totals.rushFee > 0) text += `  Rush Fee: $${totals.rushFee.toFixed(2)}\n`;
        if (totals.discount > 0) text += `  Discount: -$${totals.discount.toFixed(2)}\n`;
        if (totals.shippingFee > 0) text += `  Shipping: $${totals.shippingFee.toFixed(2)}\n`;
        text += `  Subtotal: $${totals.preTaxSubtotal.toFixed(2)}\n`;
        if (totals.includeTax) {
            text += `  Sales Tax (${totals.taxRatePct}%): $${totals.taxAmount.toFixed(2)}\n`;
        } else {
            text += `  Sales tax not included\n`;
        }
        text += `  GRAND TOTAL: $${totals.grandTotal.toFixed(2)}\n\n`;

        text += `Thank you for your business!\n`;
        text += `Northwest Custom Apparel | Since 1977\n`;

        return text;
    },

    /**
     * Copy quote to clipboard
     */
    copyQuoteToClipboard() {
        if (this.products.length === 0 || this.getTotalQuantity() === 0) {
            this.showToast('Add products before copying quote', 'warning');
            return;
        }

        if (this.selectedLocations.length === 0) {
            this.showToast('Select locations before copying quote', 'warning');
            return;
        }

        const quoteText = this.generateQuoteText();

        navigator.clipboard.writeText(quoteText).then(() => {
            // Update button feedback
            const copyBtn = document.getElementById('copy-quote-btn');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('success');

                setTimeout(() => {
                    // eslint-disable-next-line no-unsanitized/property -- self-restore of markup captured from this element
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.classList.remove('success');
                }, 2000);
            }

            this.showToast('Quote copied to clipboard!', 'success');
        }).catch(_err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = quoteText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Quote copied to clipboard!', 'success');
        });
    },

    showError(message) {
        const banner = document.getElementById('error-banner');
        if (banner) {
            banner.textContent = message;
            banner.style.display = 'block';
        } else {
            // Fallback to alert if no error banner element
            console.error('[DTFQuoteBuilder] Error:', message);
            alert(message);
        }
    },

    hideError() {
        const banner = document.getElementById('error-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    },
};
