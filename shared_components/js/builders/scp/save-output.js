/**
 * SCP save/print/email output module — SCP decomposition S1b (2026-07-08).
 * printQuote + buildScreenprintPricingData (scp-save-parity locks the PDF
 * line math against THIS file), saveAndGetLink/saveQuote, email + clipboard
 * quote text. Moved verbatim.
 */
/* global collectProductsFromTable, recalculatePricing, updateTaxCalculation,
   getScpExtraFees, updateEditModeUI, markAsSaved, assertQuoteEditable,
   showScpPushButton, updateScpPushButtonState, escapeHtml, showToast,
   formatPrice, getLtmControlState, showLoading, EmbroideryInvoiceGenerator,
   getOrderShippingData, getServicePrice, isValidEmail, QuoteShareModal,
   alert, hasUnsavedChanges, emailQuote */
import { scpState, LOCATION_NAMES } from './state.js';

export async function printQuote() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before printing', 'error');
        return;
    }

    // Pricing-loaded guard (ported from DTF dtf-quote-builder.js printQuote, 2026-07-04):
    // if the pricing service never initialized (API down at page load — the form stays
    // interactive) the products would price to $0, so Print would emit a silent $0.00
    // customer PDF with no error. Erik's #1 rule: visible failure, never a silent wrong
    // price. Two-part — (1) pricing loaded, (2) products subtotal > 0.
    if (!window.currentPricingData || typeof scpState.screenPrintPricingService === 'undefined' || !scpState.screenPrintPricingService) {
        showToast('Pricing data is not loaded — cannot print. Please refresh and try again.', 'error');
        return;
    }
    if (!((window.currentPricingData.subtotal || 0) > 0)) {
        showToast('Quote totals computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before printing.', 'error');
        return;
    }

    showLoading(true);

    try {
        // Settle pricing before scraping the DOM — SCP was the only builder printing
        // without a pre-print recalc, leaving a stale-price window (EMB awaits its
        // recalc, DTF prints from state math). (expert audit 2026-07-07)
        await recalculatePricing();

        // Build pricing data structure for invoice generator
        const pricingData = buildScreenprintPricingData(products);

        // Generate and open print window
        const invoiceGenerator = new EmbroideryInvoiceGenerator();
        // Full reference block for the PDF (expert audit 2026-07-07): SCP collected
        // phone / project / PO / ship date / notes on-page and then dropped them ALL
        // from the printed quote — reps promised "the PO number is on the quote" and
        // it was only true on the other builders.
        const _osd = (typeof getOrderShippingData === 'function') ? getOrderShippingData('spc-order-fields') : {};
        const customerData = {
            name: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value || 'Customer',
            company: /** @type {HTMLInputElement|null} */ (document.getElementById('company-name'))?.value || '',
            email: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-email'))?.value || '',
            phone: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-phone'))?.value?.trim() || _osd.phone || '',
            project: /** @type {HTMLInputElement|null} */ (document.getElementById('project-name'))?.value?.trim() || '',
            poNumber: _osd.poNumber || '',
            orderNumber: _osd.orderNumber || '',
            reqShipDate: _osd.reqShipDate || '',
            notes: _osd.notes || '',
            shipping: (_osd.shipAddress || _osd.shipZip)
                ? { address: _osd.shipAddress, city: _osd.shipCity, state: _osd.shipState, zip: _osd.shipZip, method: _osd.shipMethod }
                : null,
            salesRepEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('sales-rep'))?.value || 'sales@nwcustomapparel.com'
        };

        const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);
        const printWindow = window.open('', '_blank');
        // eslint-disable-next-line no-unsanitized/method -- print window: invoiceHTML from embroidery-quote-invoice.js, which esc()-escapes every customer/product field
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 300);

        showToast('Opening print dialog...', 'success');
    } catch (error) {
        console.error('Print error:', error);
        showToast('Error generating PDF', 'error');
    }

    showLoading(false);
}

/**
 * Build pricing data structure for EmbroideryInvoiceGenerator from Screen Print products
 * FIXED: Read unit prices from DOM cells where they're already displayed
 */
// D3 split (2026-07-09): ONE product's PDF line items, moved VERBATIM out of
// buildScreenprintPricingData's loop. Returns the invoice entry or null.
// NOTE: extracted ALONGSIDE the main fn by scp-save-parity's brace harness —
// keep both self-contained (injected: document, scpState, getServicePrice...).
function _buildScpInvoiceProduct(product) {
    // Build line items from size breakdown
    const lineItems = [];

    // Find the parent row for this product to read its displayed price
    const parentRow = document.querySelector(
        `tr[data-style="${product.style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`
    );
    const rowId = /** @type {HTMLElement|null} */ (parentRow)?.dataset?.rowId;

    // Read base price from parent row's price cell (displayed as $25.99)
    const basePriceCell = document.getElementById(`row-price-${rowId}`);
    const basePriceText = basePriceCell?.textContent || '$0.00';
    const baseUnitPrice = parseFloat(basePriceText.replace('$', '').replace(',', '')) || 0;

    // Base sizes (S, M, L, XL) - Note: L is internal, LG is display.
    // XXL/2XL are NOT base — they live in child rows whose price cell carries
    // any upcharge, so they price via the child-row loop below.
    const baseSizes = ['S', 'M', 'L', 'LG', 'XL'];
    const baseSizeQtys = {};
    let baseQty = 0;

    Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
        // Normalize L to LG for display
        const displaySize = size === 'L' ? 'LG' : size;
        if (baseSizes.includes(size) && qty > 0) {
            baseSizeQtys[displaySize] = qty;
            baseQty += qty;
        }
    });

    // OSFA-only products (beanies, bags) store qty on the PARENT row — no child
    // row exists, so the parent price cell is the right price source. The old
    // childRowMap lookup found nothing and printed the OSFA line at $0.00.
    const osfaQty = product.sizeBreakdown?.['OSFA'] || 0;
    if (osfaQty > 0 && baseQty === 0) {
        lineItems.push({
            description: `OSFA(${osfaQty})`,
            quantity: osfaQty,
            unitPrice: baseUnitPrice,
            total: osfaQty * baseUnitPrice
        });
    } else if (baseQty > 0) {
        // Build description like "S(2) M(3) LG(2)"
        const desc = Object.entries(baseSizeQtys)
            .map(([size, qty]) => `${size}(${qty})`)
            .join(' ');

        lineItems.push({
            description: desc,
            quantity: baseQty,
            unitPrice: baseUnitPrice,
            total: baseQty * baseUnitPrice
        });
    }

    // Extended / non-standard sizes — iterate ALL sizeBreakdown keys (NOT a
    // hardcoded list) so tall (LT/XLT…), youth (YS/YM…), toddler, fitted-cap
    // combos (S/M, L/XL), XS/XXS, 7XL+, pants (3032) and shorts (W30) are not
    // dropped from the PDF while their $ stays in the grand total — the same
    // under-footing the 2026-06-11 DTF audit caught (EMB got this fix 2026-06-04).
    Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
        if (!(qty > 0)) return;
        if (baseSizes.includes(size)) return;             // already in the grouped base line
        if (size === 'OSFA' && baseQty === 0) return;     // OSFA-only handled above
        // Read the child row's price cell (carries any size upcharge)
        const childRowId = scpState.childRowMap[rowId]?.[size];
        const childPriceCell = document.getElementById(`row-price-${childRowId}`);
        const childPriceText = childPriceCell?.textContent || '';
        let unitPrice = parseFloat(childPriceText.replace(/[^0-9.]/g, '')) || 0;
        if (!(unitPrice > 0)) unitPrice = baseUnitPrice;  // no child row (remapped parent size) → parent price

        lineItems.push({
            description: `${size}(${qty})`,
            quantity: qty,
            unitPrice: unitPrice,
            total: qty * unitPrice,
            hasUpcharge: true
        });
    });

    if (lineItems.length === 0) return null;
    return {
            product: {
                style: product.style,
                title: product.productName || product.style,
                color: product.color
            },
            lineItems: lineItems
    };
}

function buildScreenprintPricingData(products) {
    const currentPricing = window.currentPricingData || {};
    // No #quote-id element exists in this page — the old DOM read made EVERY printed
    // PDF show a fabricated `SPC-<epoch>` number that matches nothing in Quote Mgmt.
    // Use the real saved id; null lets the shared generator print "DRAFT" when unsaved.
    const quoteId = (typeof scpState.editingQuoteId !== 'undefined' && scpState.editingQuoteId) || (typeof scpState._scpPushQuoteId !== 'undefined' && scpState._scpPushQuoteId) || null;

    // Build products array with line items for invoice
    const invoiceProducts = [];

    products.forEach(product => {
        const e = _buildScpInvoiceProduct(product);
        if (e) invoiceProducts.push(e);
    });

    // Calculate totals from line items
    let subtotal = 0;
    invoiceProducts.forEach(p => {
        p.lineItems.forEach(item => {
            subtotal += item.total;
        });
    });

    // Build print config description for invoice
    const frontDesc = getLocationName(scpState.printConfig.frontLocation) + ` (${scpState.printConfig.frontColors}-color)`;
    const backDesc = scpState.printConfig.backLocation ? getLocationName(scpState.printConfig.backLocation) + ` (${scpState.printConfig.backColors}-color)` : null;
    const sleeveParts = [];
    if (scpState.printConfig.leftSleeveColors > 0) sleeveParts.push(`Left Sleeve (${scpState.printConfig.leftSleeveColors}-color)`);
    if (scpState.printConfig.rightSleeveColors > 0) sleeveParts.push(`Right Sleeve (${scpState.printConfig.rightSleeveColors}-color)`);
    const sleeveDesc = sleeveParts.length ? sleeveParts.join(', ') : null;

    // Calculate safety stripes total for display as separate line item
    const locationCount = scpState.printConfig.backLocation ? 2 : 1;
    const safetyStripesTotal = scpState.printConfig.isSafetyStripes
        ? (currentPricing.totalQuantity * getServicePrice('SP-STRIPE', 2.00) * locationCount)
        : 0;

    // Get art charge and graphic design from UI
    const artChargeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('art-charge-toggle'));
    const artCharge = artChargeToggle?.checked ? parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('art-charge'))?.value || /** @type {any} */ (0)) : 0;
    const graphicDesignHours = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('graphic-design-hours'))?.value || /** @type {any} */ (0));
    const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);

    // Get rush fee and discount from UI
    const rushFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'))?.value || /** @type {any} */ (0));
    // Vellum + Color Change setup parts (Erik's official list, 2026-06-27). Read
    // inline (like art/rush above) rather than via getScpExtraFees() so this PDF
    // function (+ _buildScpInvoiceProduct) stays self-contained for the brace-extracted unit test harness.
    const vellumQtyPdf = Math.max(0, parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('vellum-qty'))?.value || /** @type {any} */ (0), 10) || /** @type {any} */ (0));
    const vellumFeePdf = vellumQtyPdf * getServicePrice('Vellum', 10);
    const colorChangeQtyPdf = Math.max(0, parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('color-change-qty'))?.value || /** @type {any} */ (0), 10) || /** @type {any} */ (0));
    const colorChangeFeePdf = colorChangeQtyPdf * getServicePrice('Color Chg', 15);
    const discountAmount = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('discount-amount'))?.value || /** @type {any} */ (0));
    const discountType = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-type'))?.value || 'fixed';
    const discountReason = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-reason'))?.value || '';
    let discount = discountAmount;
    if (discountType === 'percent' && discountAmount > 0) {
        discount = subtotal * (discountAmount / 100);
    }

    // Read tax + LTM state here (was post-overridden in printQuote pre-3.1.0).
    // '10.2' fallback preserves pre-3.1 behavior: an empty input previously fell
    // through to the generator's hardcoded WA standard rate.
    const taxRateRaw = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value || '10.2';
    const ltmState = getLtmControlState('spc-ltm-panel');
    const ltmDistributed = (ltmState.displayMode === 'builtin');

    const preTaxText = document.getElementById('pre-tax-subtotal')?.textContent || '';
    const preTaxVal = parseFloat(preTaxText.replace(/[$,]/g, ''));

    return window.QuotePricingData.buildPricingData({
        method: 'SCP',
        quoteId: quoteId,
        tier: currentPricing.tier || '24-47',
        products: invoiceProducts,
        subtotal: subtotal,
        grandTotal: currentPricing.grandTotal || subtotal,
        // Authoritative pre-tax adjusted subtotal (base + art/graphic-design/rush
        // + shipping − discount) drives the PDF tax + GRAND TOTAL so the printed
        // total matches the on-screen #grand-total-with-tax.
        preTaxSubtotal: isNaN(preTaxVal) ? undefined : preTaxVal,
        includeTax: document.getElementById('include-tax') ? !!/** @type {HTMLInputElement} */ (document.getElementById('include-tax')).checked : true,
        taxRate: taxRateRaw,
        // Itemized on the PDF so the rows foot to the total (already inside preTaxSubtotal).
        shippingFee: parseFloat(/** @type {HTMLInputElement|null} */ (document.querySelector('#spc-order-fields .os-shipping-fee'))?.value) || 0,
        setupFees: currentPricing.setupFees || scpState.printConfig.setupFee || 0,
        additionalServicesTotal: 0,
        // Empty logos means embroidery specs section will be skipped
        logos: [],
        // Screenprint-specific
        printConfig: {
            front: frontDesc,
            back: backDesc,
            sleeves: sleeveDesc,
            isDarkGarment: scpState.printConfig.isDarkGarment,
            hasSafetyStripes: scpState.printConfig.isSafetyStripes,
            totalScreens: scpState.printConfig.totalScreens || 1
        },
        ltmFee: currentPricing.ltmFee || 0,
        ltmDistributed: ltmDistributed,
        safetyStripesTotal: safetyStripesTotal,
        totalQuantity: currentPricing.totalQuantity || 0,
        artCharge: artCharge,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: rushFee,
        // Screen-print setup parts (Erik's official list, 2026-06-27) — itemized on the PDF
        vellumQty: vellumQtyPdf,
        vellumFee: vellumFeePdf,
        colorChangeQty: colorChangeQtyPdf,
        colorChangeFee: colorChangeFeePdf,
        discount: discount,
        discountReason: discountReason
    });
}

function getLocationName(code) {
    const names = {
        'LC': 'Left Chest',
        'FF': 'Full Front',
        'JF': 'Jumbo Front',
        'FB': 'Full Back',
        'JB': 'Jumbo Back'
    };
    return names[code] || code;
}

/**
 * Save quote and get shareable link
 * Uses ScreenPrintQuoteService and QuoteShareModal
 */
// D3 split (2026-07-09): the save-path extras (charges/discount/artwork/design)
// moved VERBATIM out of saveAndGetLink.
function _collectScpSaveExtras(pricing) {
    // Get additional charges for saving (2026 fee refactor)
    const artChargeToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('art-charge-toggle'));
    const artCharge = artChargeToggle?.checked ? parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('art-charge'))?.value || /** @type {any} */ (0)) : 0;
    const graphicDesignHours = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('graphic-design-hours'))?.value || /** @type {any} */ (0));
    const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);
    const rushFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'))?.value || /** @type {any} */ (0));
    // Vellum + Color Change + Reorder — Erik's official setup parts (2026-06-27).
    // Same getScpExtraFees() source the on-screen math + fee table use, so the
    // saved/pushed total matches what the rep sees (parity rule).
    const _xf = getScpExtraFees();
    const discountAmount = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('discount-amount'))?.value || /** @type {any} */ (0));
    const discountType = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-type'))?.value || 'fixed';
    const discountReason = /** @type {HTMLInputElement|null} */ (document.getElementById('discount-reason'))?.value || '';
    // Calculate discountable subtotal for percentage discount (products + additional services + setup fees)
    const discountableSubtotal = (pricing.subtotal || 0) + artCharge + graphicDesignCharge + rushFee + (scpState.printConfig.setupFee || 0) + (pricing.ltmFee || 0)
        + _xf.vellumFee + _xf.colorChangeFee;
    const discount = discountType === 'percent' ? (discountableSubtotal * discountAmount / 100) : discountAmount;
    const discountPercent = discountType === 'percent' ? discountAmount : 0;

    // Phase 9 — include uploaded reference artwork file refs (if any)
    // Phase 11.3 (2026-05-24) — also pull newDesignName + per-file .placement
    // from the rich-mode widget, so the proxy can emit Designs[{name, Locations[]}]
    // for new-artwork pushes (creates a fresh design record in ShopWorks).
    const referenceArtwork = (window._scpArtwork && typeof window._scpArtwork.getFiles === 'function')
        ? window._scpArtwork.getFiles()
        : [];
    const newDesignName = (window._scpArtwork && typeof window._scpArtwork.getDesignName === 'function')
        ? (window._scpArtwork.getDesignName() || '').trim()
        : '';

    // Phase 11.1 — include design # if rep picked one from the combobox
    const designNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('design-number'))?.value?.trim() || '';
    return { artCharge, graphicDesignHours, graphicDesignCharge, rushFee, _xf,
        discount, discountPercent, discountReason, referenceArtwork, newDesignName, designNumber };
}

// D3 split (2026-07-09): the quoteData literal moved VERBATIM out of
// saveAndGetLink (ctx carries the collected fields).
function _buildScpQuoteData(ctx) {
    const { customerName, customerEmail, items, pricing, artCharge, graphicDesignHours,
        graphicDesignCharge, rushFee, _xf, discount, discountPercent, discountReason,
        referenceArtwork, newDesignName, designNumber } = ctx;
    void pricing;
    // Collect quote data
    const quoteData = {
        customerName: customerName,
        customerEmail: customerEmail,
        companyName: /** @type {HTMLInputElement|null} */ (document.getElementById('company-name'))?.value?.trim() || '',
        // ShopWorks customer # — attaches the pushed order to the real customer
        // (else the proxy falls back to the no-customer catch-all 3739).
        customerNumber: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-number'))?.value?.trim() || '',
        salesRep: /** @type {HTMLInputElement|null} */ (document.getElementById('sales-rep'))?.value || 'sales@nwcustomapparel.com',
        referenceArtwork, // → SCP quote-service writes to quote_sessions.Notes JSON
        newDesignName,    // → Notes.newDesignName; proxy reads this for Designs[0].name
        designNumber,     // → SCP quote-service writes to quote_sessions.Notes.designNumber
        items: items,
        totalQuantity: pricing.totalQuantity || items.reduce((sum, p) => sum + p.quantity, 0),
        subtotal: pricing.subtotal || 0,
        ltmFee: pricing.ltmFee || 0,
        setupFees: scpState.printConfig.setupFee || 0,
        grandTotal: pricing.grandTotal || 0,
        frontLocation: scpState.printConfig.frontLocation,
        frontColors: scpState.printConfig.frontColors,
        backLocation: scpState.printConfig.backLocation,
        backColors: scpState.printConfig.backColors,
        leftSleeveColors: scpState.printConfig.leftSleeveColors,
        rightSleeveColors: scpState.printConfig.rightSleeveColors,
        sleeveColorsList: scpState.printConfig.sleeveColorsList,
        totalScreens: scpState.printConfig.totalScreens,
        isDarkGarment: scpState.printConfig.isDarkGarment,
        hasSafetyStripes: scpState.printConfig.isSafetyStripes,
        printSetup: {
            frontLocation: scpState.printConfig.frontLocation,
            frontColors: scpState.printConfig.frontColors,
            backLocation: scpState.printConfig.backLocation,
            backColors: scpState.printConfig.backColors,
            leftSleeveColors: scpState.printConfig.leftSleeveColors,
            rightSleeveColors: scpState.printConfig.rightSleeveColors,
            sleeveColorsList: scpState.printConfig.sleeveColorsList,
            totalScreens: scpState.printConfig.totalScreens,
            isDarkGarment: scpState.printConfig.isDarkGarment,
            isSafetyStripes: scpState.printConfig.isSafetyStripes
        },
        // Additional charges (2026 fee refactor)
        artCharge: artCharge,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: rushFee,
        // Screen-print setup parts (Erik's official list, 2026-06-27)
        vellumQty: _xf.vellumQty,
        vellumFee: _xf.vellumFee,
        colorChangeQty: _xf.colorChangeQty,
        colorChangeFee: _xf.colorChangeFee,
        discount: discount,
        discountPercent: discountPercent,
        discountReason: discountReason,
        // LTM display preferences (2026-03-22)
        ltmDisplayMode: getLtmControlState('spc-ltm-panel').displayMode || 'builtin',
        ltmWaived: !getLtmControlState('spc-ltm-panel').enabled,
        isWholesale: /** @type {HTMLInputElement|null} */ (document.getElementById('wholesale-checkbox'))?.checked || false,  // [2026-06-08] → IsWholesale; push routes to GL 2203
        // [2026-06-08] P0 (review woaaypuz4): the SCP save quoteData NEVER passed taxRate (getOrderShippingData omits it),
        // so the service fell back to 10.1% → every out-of-state / exempt / non-10.1 SCP quote saved TaxRate=10.1 and the
        // /quote + /invoice mirror billed full WA tax. Pass it explicitly (mirror DTF). Erik's #1 rule.
        // [2026-06-14] Gate on the Include Tax checkbox (parity with DTF L1965 / EMB save). Unchecking it shows $0 tax
        // on screen (updateTaxCalculation L3559) + on the PDF (buildScreenprintPricingData includeTax), but save used to
        // pass the raw rate input (still 10.1, since only wholesale/CRM-exempt zero it) → the saved/mirrored/pushed quote
        // billed full WA tax while the rep saw $0 = silent wrong price (Erik's #1 rule). Unchecked → save TaxRate 0.
        taxRate: (document.getElementById('include-tax') && !/** @type {HTMLInputElement} */ (document.getElementById('include-tax')).checked)
            ? 0
            : parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'))?.value || '10.2'),
        // Order & shipping fields (2026-03-22)
        ...getOrderShippingData('spc-order-fields')
    };
    return quoteData;
}

export async function saveAndGetLink(opts = {}) {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before saving', 'error');
        return;
    }

    // Validate required fields
    const customerName = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value?.trim();
    const customerEmail = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-email'))?.value?.trim();

    if (!customerName || !customerEmail) {
        showToast('Please enter customer name and email', 'error');
        if (!customerName) document.getElementById('customer-name')?.focus();
        else if (!customerEmail) document.getElementById('customer-email')?.focus();
        return;
    }

    // Format-validate like EMB/DTF do — SCP was the only builder that saved (then
    // emailed to) a malformed address; EmailJS "succeeds" at shape-valid junk and
    // the follow-up call is "I never got it". (expert audit 2026-07-07)
    if (typeof isValidEmail === 'function' && !isValidEmail(customerEmail)) {
        showToast('Customer email looks invalid — please correct it before saving', 'error');
        document.getElementById('customer-email')?.focus();
        return;
    }

    // Get save button for loading state
    const saveBtn = /** @type {HTMLInputElement|null} */ (document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]'));
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
    }

    try {
        // Refresh pricing before saving so the persisted unit prices + line totals
        // match what the rep sees (and what gets pushed to ShopWorks).
        // recalculatePricing() repopulates window.currentPricingData.products with
        // fully-priced, save-ready rows (sizeBreakdown + blended unitPrice).
        await recalculatePricing();
        const pricing = window.currentPricingData || {};
        const pricedRows = Array.isArray(pricing.products) ? pricing.products : [];

        if (pricedRows.length === 0) {
            throw new Error('No priced products to save — please re-check the product table.');
        }

        // Format items for quote service from the priced snapshot (NOT a DOM
        // re-scrape). Each row carries sizeBreakdown + the blended unit price.
        const items = pricedRows.map(row => ({
            styleNumber: row.style,
            productName: row.productName || row.style,
            color: row.color,
            colorCode: row.catalogColor || row.color,
            quantity: row.totalQty,
            sizeBreakdown: row.sizeBreakdown || {},
            basePrice: row.unitPrice || 0,
            unitPrice: row.unitPrice || 0,
            ltmPerUnit: row.ltmPerUnit || 0,
            lineTotal: row.lineTotal || ((row.totalQty || 0) * (row.unitPrice || 0)),
            imageUrl: row.imageUrl || ''
        }));

        const extras = _collectScpSaveExtras(pricing);

        const quoteData = _buildScpQuoteData({ customerName, customerEmail, items, pricing, ...extras });

        let result;
        if (scpState.editingQuoteId) {
            // Update existing quote
            result = await scpState.quoteService.updateQuote(scpState.editingQuoteId, quoteData);
            if (result && result.success) {
                result.quoteID = scpState.editingQuoteId;
                // Update revision number
                scpState.editingRevision = result.revision;
                updateEditModeUI(scpState.editingQuoteId, scpState.editingRevision);
            }
        } else {
            // Create new quote
            result = await scpState.quoteService.saveQuote(quoteData);
        }

        if (result.success) {

            // Clear auto-save draft on successful save (2026 consolidation)
            if (scpState.spPersistence) {
                scpState.spPersistence.clearDraft();
            }

            // Phase 8 (2026-05-23): reveal Push-to-ShopWorks button after save.
            // Gated behind ?enableScpPush=1 query param until Erik confirms
            // OnSite integration IDs in proxy config/manageorders-scp-config.js.
            if (typeof showScpPushButton === 'function') {
                showScpPushButton(result.quoteID);
            }

            // Show success modal with shareable link — SKIPPED on the silent auto-save before a Push
            // (scpPushToShopWorks passes skipShareModal:true; the push preview opens instead).
            if (opts.skipShareModal) {
                /* auto-saved for Push to ShopWorks — no share modal */
            } else if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                QuoteShareModal.show(result.quoteID, scpState.editingQuoteId ? `Updated to Rev ${scpState.editingRevision}` : null);
            } else {
                // Fallback
                const url = `${window.location.origin}/quote/${result.quoteID}`;
                const message = scpState.editingQuoteId
                    ? `Quote updated!\n\nQuote ID: ${result.quoteID}\nRevision: ${scpState.editingRevision}\n\nShareable Link:\n${url}`
                    : `Quote saved!\n\nQuote ID: ${result.quoteID}\n\nShareable Link:\n${url}`;
                alert(message);
            }
            // Return the freshly-saved ID so callers (Push) can confirm THIS save
            // succeeded — never rely on a persistent _scpPushQuoteId from an earlier
            // save, which would push a stale revision if this save just failed.
            return result.quoteID;
        } else {
            throw new Error(result.error || 'Failed to save quote');
        }

    } catch (error) {
        console.error('[ScreenPrint] Save error:', error);
        showToast('Error saving quote: ' + error.message, 'error');
        return null; // signal failure to callers (Push must not proceed)
    } finally {
        // Restore button state
        if (saveBtn) {
            // eslint-disable-next-line no-unsanitized/property -- self-restore of markup captured from this element
            saveBtn.innerHTML = originalText;
            /** @type {HTMLInputElement} */ (saveBtn).disabled = false;
        }
    }
}

// Legacy function - redirects to saveAndGetLink
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1b).
async function saveQuote() {
    return saveAndGetLink();
}

export async function spcEmailQuote() {
    // editingQuoteId only exists on ?edit= loads — a fresh save never set it, so Email
    // was a dead end on every NEW quote ("save first" loop). Mirror EMB embEmailQuote:
    // accept the just-saved id, and auto-save when unsaved OR edited-since-save so the
    // customer never receives a stale revision. (expert audit 2026-07-07)
    let quoteId = scpState.editingQuoteId || scpState._scpPushQuoteId;
    const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : false;
    if (!quoteId || dirty) {
        showToast('Saving quote before emailing…', 'info', 2500);
        quoteId = await saveAndGetLink({ skipShareModal: true });
        if (!quoteId) return;   // save failed/blocked — its error is already on screen
    }
    await emailQuote({
        quoteId,
        customerEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-email'))?.value?.trim(),
        customerName: /** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value?.trim(),
        salesRepEmail: /** @type {HTMLInputElement|null} */ (document.getElementById('sales-rep'))?.value
    });
}

export async function copyToClipboard() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    try {
        // Get current pricing from sidebar
        const pricing = window.currentPricingData || {
            totalQuantity: 0,
            tier: '24-47',
            subtotal: 0,
            ltmFee: 0,
            setupFees: scpState.printConfig.setupFee,
            grandTotal: scpState.printConfig.setupFee
        };

        const text = generateQuoteText(products, pricing);
        await navigator.clipboard.writeText(text);

        showToast('Quote copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Error copying to clipboard', 'error');
    }
}

function generateQuoteText(products, pricing) {
    const lines = [
        'NORTHWEST CUSTOM APPAREL - SCREEN PRINT QUOTE',
        '================================================',
        `Date: ${new Date().toLocaleDateString()}`,
        `Customer: ${/** @type {HTMLInputElement|null} */ (document.getElementById('customer-name'))?.value || 'N/A'}`,
        `Company: ${/** @type {HTMLInputElement|null} */ (document.getElementById('company-name'))?.value || 'N/A'}`,
    ];

    // Print Configuration
    lines.push('');
    lines.push('PRINT CONFIGURATION:');
    const frontName = LOCATION_NAMES[scpState.printConfig.frontLocation] || scpState.printConfig.frontLocation;
    lines.push(`  Front: ${frontName} (${scpState.printConfig.frontColors}-color)`);
    if (scpState.printConfig.backLocation) {
        const backName = LOCATION_NAMES[scpState.printConfig.backLocation] || scpState.printConfig.backLocation;
        lines.push(`  Back: ${backName} (${scpState.printConfig.backColors}-color)`);
    }
    // Sleeve locations — mirror buildScreenprintPricingData's sleeveDesc so the copied
    // text lists them (were silently omitted; sleeves are their own print locations). (2026-07-04)
    if (scpState.printConfig.leftSleeveColors > 0) {
        lines.push(`  Left Sleeve: (${scpState.printConfig.leftSleeveColors}-color)`);
    }
    if (scpState.printConfig.rightSleeveColors > 0) {
        lines.push(`  Right Sleeve: (${scpState.printConfig.rightSleeveColors}-color)`);
    }
    if (scpState.printConfig.isDarkGarment) {
        lines.push(`  Dark Garment: Yes (includes white underbase)`);
    }
    if (scpState.printConfig.isSafetyStripes) {
        const locationCount = scpState.printConfig.backLocation ? 2 : 1;
        lines.push(`  Safety Stripes: +$${(getServicePrice('SP-STRIPE', 2.00) * locationCount).toFixed(2)}/piece`);
    }
    lines.push(`  Total Screens: ${scpState.printConfig.totalScreens}`);
    lines.push(`  Setup Fee: $${scpState.printConfig.setupFee.toFixed(2)}`);

    // Products
    lines.push('');
    lines.push('PRODUCTS:');
    lines.push('------------------------------------------------');
    products.forEach(p => {
        const sizes = Object.entries(p.sizeBreakdown || {})
            // eslint-disable-next-line no-unused-vars -- verbatim (S1b): destructured size unused in filter
            .filter(([s, q]) => q > 0)
            .map(([s, q]) => `${s}:${q}`)
            .join(' ');
        lines.push(`${p.style} - ${p.color} | ${sizes} | Qty: ${p.totalQty || 0}`);
    });

    // Summary
    lines.push('');
    lines.push('------------------------------------------------');
    lines.push(`Total Pieces: ${pricing.totalQuantity || 0}`);
    lines.push(`Pricing Tier: ${pricing.tier || '24-47'}`);
    lines.push(`Products Subtotal: $${(pricing.subtotal || 0).toFixed(2)}`);
    lines.push(`Setup Fee (${scpState.printConfig.totalScreens} screens): $${(pricing.setupFees || 0).toFixed(2)}`);
    if (pricing.ltmFee > 0) {
        lines.push(`Less Than Minimum Fee: $${pricing.ltmFee.toFixed(2)}`);
    }

    // Itemize the SAME fee set the on-screen footer / PDF / saved total charge
    // (were all omitted here → copied TOTAL disagreed with the invoice). Read the
    // fees from the same UI inputs buildScreenprintPricingData() uses. (2026-07-04)
    const _artCharge = /** @type {HTMLInputElement|null} */ (document.getElementById('art-charge-toggle'))?.checked
        ? (parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('art-charge'))?.value || /** @type {any} */ (0)) || 0) : 0;
    if (_artCharge > 0) lines.push(`Logo Mockup & Review: $${_artCharge.toFixed(2)}`);
    const _designHours = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('graphic-design-hours'))?.value || /** @type {any} */ (0)) || 0;
    const _designFee = _designHours * getServicePrice('GRT-75', 75);
    if (_designFee > 0) lines.push(`Graphic Design (${_designHours} hr): $${_designFee.toFixed(2)}`);
    const _rushFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.getElementById('rush-fee'))?.value || /** @type {any} */ (0)) || 0;
    if (_rushFee > 0) lines.push(`Rush Fee: $${_rushFee.toFixed(2)}`);
    const _xfCopy = getScpExtraFees();
    if (_xfCopy.vellumFee > 0) lines.push(`Vellum Print (${_xfCopy.vellumQty}): $${_xfCopy.vellumFee.toFixed(2)}`);
    if (_xfCopy.colorChangeFee > 0) lines.push(`Color Change (${_xfCopy.colorChangeQty}): $${_xfCopy.colorChangeFee.toFixed(2)}`);
    const _shipFee = parseFloat(/** @type {HTMLInputElement|null} */ (document.querySelector('#spc-order-fields .os-shipping-fee'))?.value) || 0;
    if (_shipFee > 0) lines.push(`Shipping: $${_shipFee.toFixed(2)}`);
    // Discount row (mirrors the on-screen #discount-total after % is resolved).
    const _discTotalText = document.getElementById('discount-total')?.textContent || '';
    const _discRow = document.getElementById('discount-row');
    if (_discRow && _discRow.style.display !== 'none' && _discTotalText) {
        lines.push(`Discount: ${_discTotalText}`);
    }

    lines.push('');
    // Totals — read the DISPLAYED footer values (Subtotal / Tax / TOTAL) so the copied
    // text always agrees with the on-screen footer, PDF, and saved total. Recomputing
    // here previously excluded art/design/rush/vellum/color-change/tax → mismatch. (2026-07-04)
    const _subEl = document.getElementById('pre-tax-subtotal');
    const _taxEl = document.getElementById('tax-amount');
    const _totalEl = document.getElementById('grand-total-with-tax');
    const _subText = _subEl?.textContent?.trim();
    const _taxText = _taxEl?.textContent?.trim();
    const _totalText = _totalEl?.textContent?.trim();
    // Fall back to the pricing object only if the footer isn't rendered yet.
    lines.push(`Subtotal: ${_subText || ('$' + (pricing.grandTotal || 0).toFixed(2))}`);
    const _taxLabelEl = document.getElementById('tax-rate-label');
    lines.push(`${(_taxLabelEl?.textContent?.trim() || 'Sales Tax')}: ${_taxText || '$0.00'}`);
    lines.push(`TOTAL: ${_totalText || ('$' + (pricing.grandTotal || 0).toFixed(2))}`);
    lines.push('');
    lines.push('Northwest Custom Apparel | 253-922-5793');

    return lines.join('\n');
}
