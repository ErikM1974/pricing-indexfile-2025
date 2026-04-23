// ============================================================
// SCREEN PRINT QUOTE BUILDER - Excel-Style Quote Builder
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
const API_BASE = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// NOTE: SIZE_MODIFIERS was removed - use SIZE_TO_SUFFIX (line ~1520) instead
// SIZE_TO_SUFFIX contains ALL size suffixes including tall, youth, toddler, etc.

// STANDARD_SIZES — now provided by extended-sizes-config.js

// Extended sizes that get their own line items
// Note: 2XL goes to Size05 (dedicated), all others go to Size06 (Other)
const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping
// Size01-04: Standard sizes (S, M, L, XL) - combined into one line item
// Size05: 2XL only - separate line item
// Size06: ALL others (XS, 3XL, 4XL, 5XL, Youth, Tall, OSFA) - each gets separate line item
const SIZE_TO_SLOT = {
    'S': 'Size01', 'M': 'Size02', 'L': 'Size03', 'XL': 'Size04',
    '2XL': 'Size05',  // 2XL has dedicated slot
    'XS': 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', 'OSFA': 'Size06'
};

// Display labels matching ShopWorks column headers
// Note: Internally we use L/2XL/3XL, but display as LG/XXL/XXXL
const SIZE_DISPLAY_LABELS = {
    'S': 'S', 'M': 'M', 'L': 'LG', 'XL': 'XL',
    '2XL': 'XXL', '3XL': 'XXXL',
    'XS': 'XXXL', '4XL': 'XXXL', '5XL': 'XXXL', '6XL': 'XXXL'
};

// State
let screenPrintPricingService = null;
let quoteService = null;

// Auto-save & Draft Recovery (2026 consolidation)
let spPersistence = null;
let spSession = null;

let products = [];
let rowCounter = 0;
let productCache = {}; // Cache product data for quick lookup
let childRowMap = {}; // Track child rows: { parentRowId: { '2XL': childRowId, '3XL': childRowId } }

// Edit mode state
let editingQuoteId = null;
let editingRevision = null;

// Unsaved changes tracking
let hasChanges = false;

// Screen Print Location Configuration
// Screen Print Configuration State
let printConfig = {
    frontLocation: 'LC',      // LC, FF, JF
    frontColors: 1,           // 1-6
    backLocation: '',         // '', FB, JB
    backColors: 1,            // 1-6
    isDarkGarment: false,     // Adds white underbase (+1 screen per location)
    isSafetyStripes: false,   // Adds $2/piece/location
    totalScreens: 1,          // Calculated
    setupFee: 30.00           // Calculated: screens × $30
};

const SCREEN_FEE = 30.00; // $30 per screen

// Print location display names
const LOCATION_NAMES = {
    'LC': 'Left Chest',
    'FF': 'Full Front',
    'JF': 'Jumbo Front',
    'FB': 'Full Back',
    'JB': 'Jumbo Back'
};

// Update print configuration from UI selections
function updatePrintConfig() {
    // Get location selections
    const frontRadio = document.querySelector('input[name="front-location"]:checked');
    const backRadio = document.querySelector('input[name="back-location"]:checked');
    const frontColorsRadio = document.querySelector('input[name="front-colors"]:checked');
    const backColorsRadio = document.querySelector('input[name="back-colors"]:checked');

    printConfig.frontLocation = frontRadio ? frontRadio.value : 'LC';
    printConfig.backLocation = backRadio ? backRadio.value : '';
    printConfig.frontColors = frontColorsRadio ? parseInt(frontColorsRadio.value) : 1;
    printConfig.backColors = backColorsRadio ? parseInt(backColorsRadio.value) : 1;
    printConfig.isDarkGarment = document.getElementById('dark-garment-toggle').checked;
    printConfig.isSafetyStripes = document.getElementById('safety-stripes-toggle').checked;

    // Show/hide back colors section
    const backColorsSection = document.getElementById('back-colors-section');
    const backIcon = document.getElementById('back-icon');
    if (printConfig.backLocation) {
        backColorsSection.style.display = 'block';
        backIcon.className = 'fas fa-check-circle';
        backIcon.style.color = '#28a745';
    } else {
        backColorsSection.style.display = 'none';
        backIcon.className = 'fas fa-plus-circle';
        backIcon.style.color = '#888';
    }

    // Calculate screens
    let frontScreens = printConfig.frontColors;
    let backScreens = printConfig.backLocation ? printConfig.backColors : 0;

    // Add underbase for dark garments
    if (printConfig.isDarkGarment) {
        frontScreens += 1;
        if (printConfig.backLocation) {
            backScreens += 1;
        }
    }

    printConfig.totalScreens = frontScreens + backScreens;
    printConfig.setupFee = printConfig.totalScreens * SCREEN_FEE;

    // Update front setup display
    const frontSetupEl = document.getElementById('front-setup-display');
    if (printConfig.isDarkGarment) {
        frontSetupEl.textContent = `${printConfig.frontColors} + 1 underbase = ${frontScreens} screens × $30 = $${(frontScreens * SCREEN_FEE).toFixed(2)}`;
    } else {
        frontSetupEl.textContent = `${frontScreens} screen${frontScreens > 1 ? 's' : ''} × $30 = $${(frontScreens * SCREEN_FEE).toFixed(2)}`;
    }

    // Update back setup display (if visible)
    if (printConfig.backLocation) {
        const backSetupEl = document.getElementById('back-setup-display');
        if (printConfig.isDarkGarment) {
            backSetupEl.textContent = `${printConfig.backColors} + 1 underbase = ${backScreens} screens × $30 = $${(backScreens * SCREEN_FEE).toFixed(2)}`;
        } else {
            backSetupEl.textContent = `${backScreens} screen${backScreens > 1 ? 's' : ''} × $30 = $${(backScreens * SCREEN_FEE).toFixed(2)}`;
        }
    }

    // Update total setup fee display
    document.getElementById('total-screens-display').textContent = `${printConfig.totalScreens} screen${printConfig.totalScreens > 1 ? 's' : ''} total`;
    document.getElementById('setup-fee-display').textContent = `$${printConfig.setupFee.toFixed(2)}`;

    // Show/hide dark garment note
    const darkNote = document.getElementById('dark-garment-note');
    if (printConfig.isDarkGarment) {
        darkNote.style.display = 'block';
    } else {
        darkNote.style.display = 'none';
    }

    // Recalculate all product prices with new configuration
    recalculateAllPrices();
}

// Extended sizes available for Size06 (Other) column
// Note: Actual available sizes are fetched dynamically per product via API
// Includes OSFA for beanies, bags, and other one-size-fits-all items
// All sizes that go in Size06 column (the "Other/Catch-All" column)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
// NOTE: 2XL and XXL are NOT here - they go in Size05 (XXL column)
const SIZE06_EXTENDED_SIZES = [
    // Extended large (3XL and up only - 2XL/XXL go in Size05)
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    // One-size
    'OSFA', 'OSFM',
    // Combos (for fitted caps)
    'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
    // Tall
    'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
    // Youth
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    // Toddler
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    // Big
    'LB', 'XLB', '2XLB',
    // Extra small
    'XXS', '2XS'
];

// EXTENDED_SIZE_ORDER — now provided by extended-sizes-config.js

// SIZE_TO_SUFFIX — now provided by extended-sizes-config.js

// ============================================================
// EXTENDED SIZE PICKER POPUP (for Size06/XXXL column)
// ============================================================

// getAvailableExtendedSizes() — now provided by extended-sizes-config.js (with caching)

// [Extended size functions removed — now in quote-extended-sizes.js]
// openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
// getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
// updateXXXLCellDisplay, updateChildRowPrice

// ============================================================
// AUTO-SAVE & DRAFT RECOVERY (2026 consolidation)
// ============================================================

function initScreenPrintPersistence() {
    if (typeof QuotePersistence !== 'undefined') {
        spPersistence = new QuotePersistence({
            prefix: 'SPC',
            autoSaveInterval: 30000,
            debug: false
        });

        // Setup auto-save callback
        spPersistence.onAutoSave = () => {
            const data = getScreenPrintQuoteData();
            if (data && (data.products.length > 0 || data.customerName)) {
                spPersistence.save(data);
            }
        };
    }

    if (typeof QuoteSession !== 'undefined' && spPersistence) {
        spSession = new QuoteSession({
            prefix: 'SPC',
            persistence: spPersistence,
            debug: false
        });
    }
}

function getScreenPrintQuoteData() {
    return {
        products: collectProductsFromTable(),
        printConfig: { ...printConfig },
        customerName: document.getElementById('customer-name')?.value || '',
        customerEmail: document.getElementById('customer-email')?.value || '',
        companyName: document.getElementById('company-name')?.value || '',
        salesRep: document.getElementById('sales-rep')?.value || '',
        timestamp: Date.now()
    };
}

function restoreScreenPrintDraft(draft) {
    if (!draft) return;


    // Restore customer info
    if (draft.customerName) {
        const nameEl = document.getElementById('customer-name');
        if (nameEl) nameEl.value = draft.customerName;
    }
    if (draft.customerEmail) {
        const emailEl = document.getElementById('customer-email');
        if (emailEl) emailEl.value = draft.customerEmail;
    }
    if (draft.companyName) {
        const companyEl = document.getElementById('company-name');
        if (companyEl) companyEl.value = draft.companyName;
    }
    if (draft.salesRep) {
        const salesRepEl = document.getElementById('sales-rep');
        if (salesRepEl) salesRepEl.value = draft.salesRep;
    }

    // Restore print configuration
    if (draft.printConfig) {
        // Restore front location
        const frontRadio = document.querySelector(`input[name="front-location"][value="${draft.printConfig.frontLocation}"]`);
        if (frontRadio) frontRadio.checked = true;

        // Restore front colors
        const frontColorsRadio = document.querySelector(`input[name="front-colors"][value="${draft.printConfig.frontColors}"]`);
        if (frontColorsRadio) frontColorsRadio.checked = true;

        // Restore back location
        const backRadio = document.querySelector(`input[name="back-location"][value="${draft.printConfig.backLocation || ''}"]`);
        if (backRadio) backRadio.checked = true;

        // Restore back colors
        if (draft.printConfig.backLocation) {
            const backColorsRadio = document.querySelector(`input[name="back-colors"][value="${draft.printConfig.backColors}"]`);
            if (backColorsRadio) backColorsRadio.checked = true;
        }

        // Restore dark garment toggle
        const darkGarmentToggle = document.getElementById('dark-garment-toggle');
        if (darkGarmentToggle) darkGarmentToggle.checked = draft.printConfig.isDarkGarment || false;

        // Restore safety stripes toggle
        const safetyStripesToggle = document.getElementById('safety-stripes-toggle');
        if (safetyStripesToggle) safetyStripesToggle.checked = draft.printConfig.isSafetyStripes || false;

        // Update config state
        updatePrintConfig();
    }

    // Restore products
    if (draft.products && draft.products.length > 0) {
        // Clear any existing rows first
        const tbody = document.getElementById('product-tbody');
        if (tbody) tbody.innerHTML = '';

        draft.products.forEach(product => {
            // Add product row with saved data
            const rowId = addNewRow();
            const row = document.getElementById(`row-${rowId}`);
            if (!row) return;

            // Set product data
            row.dataset.style = product.style || '';
            row.dataset.catalogColor = product.catalogColor || '';
            row.dataset.colorName = product.color || '';
            row.dataset.description = product.description || '';
            row.dataset.imageUrl = product.imageUrl || '';

            // Update display cells
            const styleCell = row.querySelector('.cell-style');
            if (styleCell) styleCell.textContent = product.style || '';

            const descCell = row.querySelector('.cell-desc');
            if (descCell) descCell.textContent = product.description || '';

            const colorCell = row.querySelector('.cell-color');
            if (colorCell) {
                colorCell.innerHTML = `<span class="color-swatch" style="background: #ccc;"></span>${escapeHtml(product.color || '')}`;
            }

            // Restore size quantities
            if (product.sizes || product.sizeBreakdown) {
                const sizes = product.sizes || product.sizeBreakdown;
                Object.entries(sizes).forEach(([size, qty]) => {
                    if (qty > 0) {
                        const sizeInput = row.querySelector(`input[data-size="${size}"]`);
                        if (sizeInput) {
                            sizeInput.value = qty;
                            updateRowQuantityTotal(rowId);
                        }
                    }
                });
            }
        });

        // Recalculate pricing after restoring products
        recalculatePricing();
    }

    showToast('Draft restored successfully', 'success');
}

function markScreenPrintDirty() {
    if (spPersistence) {
        spPersistence.markDirty();
    }
}

// ============================================================
// EDIT MODE FUNCTIONS
// ============================================================

/**
 * Check URL for edit parameter
 * Returns quote ID if editing, null otherwise
 */
// checkForEditMode(), updateEditModeUI(), populateCustomerInfo() → moved to quote-builder-utils.js

/**
 * Populate additional charges from saved session (2026 fee refactor)
 */
function populateAdditionalCharges(session) {
    // Art charge
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artChargeInput = document.getElementById('art-charge');
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    if (session.ArtCharge > 0 && artChargeToggle && artChargeInput) {
        artChargeToggle.checked = true;
        artChargeInput.disabled = false;
        artChargeInput.value = session.ArtCharge;
        if (artChargeWrapper) artChargeWrapper.style.opacity = '1';
    }

    // Graphic design hours
    const designHoursInput = document.getElementById('graphic-design-hours');
    if (session.GraphicDesignHours > 0 && designHoursInput) {
        designHoursInput.value = session.GraphicDesignHours;
        // Update the calculated total display
        const designTotalEl = document.getElementById('graphic-design-total');
        if (designTotalEl) {
            designTotalEl.textContent = (session.GraphicDesignHours * 75).toFixed(2);
        }
    }

    // Rush fee
    const rushFeeInput = document.getElementById('rush-fee');
    if (session.RushFee > 0 && rushFeeInput) {
        rushFeeInput.value = session.RushFee;
    }

    // Discount
    const discountAmountInput = document.getElementById('discount-amount');
    const discountTypeSelect = document.getElementById('discount-type');
    const discountReasonInput = document.getElementById('discount-reason');
    const discountPreset = document.getElementById('discount-preset');
    if ((session.Discount > 0 || session.DiscountPercent > 0) && discountAmountInput) {
        if (session.DiscountPercent > 0) {
            if (discountTypeSelect) discountTypeSelect.value = 'percent';
            discountAmountInput.value = session.DiscountPercent;
            // Set preset dropdown based on value
            if (discountPreset) {
                const presetValues = ['5', '10', '15', '20', '25'];
                const percentStr = String(session.DiscountPercent);
                if (presetValues.includes(percentStr)) {
                    discountPreset.value = percentStr;
                } else {
                    discountPreset.value = 'custom';
                }
            }
        } else {
            if (discountTypeSelect) discountTypeSelect.value = 'fixed';
            discountAmountInput.value = session.Discount;
        }
        // Restore discount reason with preset detection
        if (session.DiscountReason) {
            const reasonPreset = document.getElementById('discount-reason-preset');
            if (reasonPreset && discountReasonInput) {
                const presetValues = Array.from(reasonPreset.options)
                    .map(opt => opt.value)
                    .filter(v => v !== 'custom');
                if (presetValues.includes(session.DiscountReason)) {
                    // Exact match to preset
                    reasonPreset.value = session.DiscountReason;
                    discountReasonInput.style.display = 'none';
                    discountReasonInput.value = session.DiscountReason;
                } else {
                    // Custom reason
                    reasonPreset.value = 'custom';
                    discountReasonInput.style.display = 'block';
                    discountReasonInput.value = session.DiscountReason;
                }
            }
        }
        // Update UI to show correct input/preset based on type
        if (typeof updateDiscountType === 'function') {
            updateDiscountType();
        }
        // If custom percentage, ensure input wrapper is visible
        if (session.DiscountPercent > 0 && discountPreset && discountPreset.value === 'custom') {
            const inputWrapper = document.getElementById('discount-input-wrapper');
            const prefix = document.getElementById('discount-prefix');
            if (inputWrapper) inputWrapper.style.display = 'flex';
            if (prefix) prefix.textContent = '%';
        }
    }

    // Update UI displays
    if (typeof updateAdditionalCharges === 'function') {
        updateAdditionalCharges();
    }
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

/**
 * Populate print configuration from session Notes
 */
function populatePrintConfigFromSession(session) {
    try {
        const notes = JSON.parse(session.Notes || '{}');

        // Set front location
        if (notes.frontLocation) {
            const frontRadio = document.querySelector(`input[name="front-location"][value="${notes.frontLocation}"]`);
            if (frontRadio) frontRadio.checked = true;
        }

        // Set front colors
        if (notes.frontColors) {
            const frontColorsRadio = document.querySelector(`input[name="front-colors"][value="${notes.frontColors}"]`);
            if (frontColorsRadio) frontColorsRadio.checked = true;
        }

        // Set back location
        if (notes.backLocation) {
            const backRadio = document.querySelector(`input[name="back-location"][value="${notes.backLocation}"]`);
            if (backRadio) backRadio.checked = true;
        }

        // Set back colors
        if (notes.backColors) {
            const backColorsRadio = document.querySelector(`input[name="back-colors"][value="${notes.backColors}"]`);
            if (backColorsRadio) backColorsRadio.checked = true;
        }

        // Set dark garment toggle
        if (notes.isDarkGarment) {
            document.getElementById('dark-garment-toggle').checked = true;
        }

        // Set safety stripes toggle
        if (notes.hasSafetyStripes) {
            document.getElementById('safety-stripes-toggle').checked = true;
        }

        // Trigger update to recalculate screens and fees
        updatePrintConfig();
    } catch (e) {
        console.warn('[EditMode] Could not parse print config from notes:', e);
    }
}

/**
 * Populate products from line items
 */
async function populateProducts(items) {
    // Filter to only screen print product items
    const productItems = items.filter(item =>
        item.EmbellishmentType === 'screenprint' &&
        item.StyleNumber
    );

    // Group items by StyleNumber + Color to consolidate size quantities
    const productGroups = {};
    for (const item of productItems) {
        const key = `${item.StyleNumber}|${item.Color}`;
        if (!productGroups[key]) {
            productGroups[key] = {
                styleNumber: item.StyleNumber,
                color: item.Color,
                productName: item.ProductName,
                imageUrl: item.ImageURL || '',
                sizeBreakdown: {}
            };
        }
        // Merge size breakdowns
        try {
            const sizes = JSON.parse(item.SizeBreakdown || '{}');
            for (const [size, qty] of Object.entries(sizes)) {
                productGroups[key].sizeBreakdown[size] =
                    (productGroups[key].sizeBreakdown[size] || 0) + qty;
            }
        } catch (e) {
            console.warn('[EditMode] Could not parse SizeBreakdown:', item.SizeBreakdown);
        }
    }

    // Add each product to the table
    for (const product of Object.values(productGroups)) {
        await addProductFromQuote(product);
    }
}

/**
 * Add a product row from loaded quote data
 */
async function addProductFromQuote(product) {
    // Add new row
    addNewRow();
    const row = document.querySelector('tr.new-row');
    if (!row) return;

    const rowId = row.dataset.rowId;
    const styleInput = row.querySelector('.style-input');

    // Set style number and trigger product loading
    styleInput.value = product.styleNumber;
    await onStyleChange(styleInput, parseInt(rowId));

    // Small delay to let colors load
    await new Promise(resolve => setTimeout(resolve, 150));

    // Select the color
    const pickerDropdown = row.querySelector('.color-picker-dropdown');
    if (pickerDropdown) {
        const colorOption = pickerDropdown.querySelector(
            `[data-color-name="${product.color}"], [data-catalog-color="${product.color}"]`
        ) || Array.from(pickerDropdown.querySelectorAll('.color-option')).find(opt =>
            opt.textContent.includes(product.color)
        );
        if (colorOption) {
            selectColor(parseInt(rowId), colorOption);
        }
    }

    // Small delay for color selection to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set size quantities
    for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
        if (qty > 0) {
            // XXL stays as 'XXL' — distinct from 2XL for Ladies/Womens products
            const normalizedSize = size;

            if (['S', 'M', 'L', 'XL', '2XL'].includes(normalizedSize)) {
                const sizeInput = row.querySelector(`input[data-size="${normalizedSize}"]`) ||
                                 row.querySelector(`input[data-size="${size}"]`);
                if (sizeInput) {
                    sizeInput.value = qty;
                    sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
            }
        }
    }
}

/**
 * Load existing quote for editing
 * Populates all form fields with quote data
 */
async function loadQuoteForEditing(quoteId) {
    showToast('Loading quote...', 'info');

    try {
        const result = await quoteService.loadQuote(quoteId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to load quote');
        }

        const session = result.session;
        const items = result.items;

        // Store edit mode state
        editingQuoteId = quoteId;
        editingRevision = session.RevisionNumber || 1;

        // Update page header to show edit mode
        updateEditModeUI(quoteId, editingRevision);

        // Populate customer information
        populateCustomerInfo(session);

        // Populate additional charges (2026 fee refactor)
        populateAdditionalCharges(session);

        // Populate print configuration
        populatePrintConfigFromSession(session);

        // Populate products from line items
        await populateProducts(items);

        // Restore order & shipping fields from saved session
        setOrderShippingData('spc-order-fields', session);

        // Recalculate pricing to update totals
        recalculatePricing();

        showToast(`Editing ${quoteId} (Rev ${editingRevision})`, 'success');

    } catch (error) {
        console.error('[EditMode] Error loading quote:', error);
        showToast('Error loading quote: ' + error.message, 'error');
        // Clear edit mode and start fresh
        editingQuoteId = null;
        editingRevision = null;
        addNewRow();
    }
}

// ============================================
// Unsaved Changes Tracking (UX Improvement)
// ============================================

// markAsUnsaved(), markAsSaved(), hasUnsavedChanges() → moved to quote-builder-utils.js

// ============================================
// New Quote Functionality (UX Improvement)
// ============================================

// confirmNewQuote() → moved to quote-builder-utils.js

function resetQuote() {
    // Clear all product rows and re-add empty state
    const tbody = document.getElementById('product-tbody');
    tbody.innerHTML = `
        <tr id="empty-state-row">
            <td colspan="13" style="text-align: center; padding: 40px 20px; color: #64748b; background: #f8fafc;">
                <div style="font-size: 32px; margin-bottom: 12px;">&#128085;</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Enter a style number to get started</div>
                <div style="font-size: 13px; color: #94a3b8;">Type a style # in the search bar above (e.g., PC54, G500, C112)</div>
            </td>
        </tr>
    `;

    // Reset row counter and product cache
    rowCounter = 0;
    products = [];
    productCache = {};
    childRowMap = {};

    // Reset print config to defaults
    printConfig = {
        frontLocation: 'LC',
        frontColors: 1,
        backLocation: '',
        backColors: 1,
        isDarkGarment: false,
        isSafetyStripes: false,
        totalScreens: 1,
        setupFee: 30.00
    };

    // Reset LTM control panel
    setLtmControlState('spc-ltm-panel', { enabled: true, displayMode: 'builtin' });
    const ltmWrapperReset = document.getElementById('spc-ltm-wrapper');
    if (ltmWrapperReset) ltmWrapperReset.style.display = 'none';

    // Reset UI controls
    document.querySelector('input[name="front-location"][value="LC"]').checked = true;
    document.querySelectorAll('input[name="back-location"]').forEach(r => r.checked = false);
    document.getElementById('front-colors').value = '1';
    document.getElementById('back-colors').value = '1';
    const darkGarmentToggle = document.getElementById('dark-garment');
    const safetyToggle = document.getElementById('safety-stripes');
    if (darkGarmentToggle) darkGarmentToggle.checked = false;
    if (safetyToggle) safetyToggle.checked = false;

    // Reset customer form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('company-name').value = '';
    document.getElementById('customer-lookup').value = '';

    // Reset order & shipping fields
    setOrderShippingData('spc-order-fields', {});
    const taxRateReset = document.getElementById('tax-rate-input');
    if (taxRateReset) taxRateReset.value = '10.1';

    // Reset additional charges
    const rushFee = document.getElementById('rush-fee');
    const discountAmount = document.getElementById('discount-amount');
    const discountReason = document.getElementById('discount-reason');
    if (rushFee) rushFee.value = '';
    if (discountAmount) discountAmount.value = '';
    if (discountReason) discountReason.value = '';

    // Reset artwork services
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = document.getElementById('art-charge');
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    const graphicDesignHours = document.getElementById('graphic-design-hours');
    if (artChargeToggle) artChargeToggle.checked = false;
    if (artCharge) {
        artCharge.value = '0';
        artCharge.disabled = true;
    }
    if (artChargeWrapper) artChargeWrapper.style.opacity = '0.4';
    if (graphicDesignHours) graphicDesignHours.value = '';

    // Clear edit mode
    editingQuoteId = null;
    editingRevision = null;

    // Clear draft storage
    if (typeof screenPrintPersistence !== 'undefined' && screenPrintPersistence) {
        screenPrintPersistence.clearDraft();
    }

    // Mark as saved (no unsaved changes)
    markAsSaved();

    // Update totals display
    updateGrandTotal();
    updateScreenConfig();

    // Focus search bar for immediate typing
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.focus();
    }

    showToast('Started new quote', 'success');
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {

    showLoading(true);

    try {
        // Initialize Screen Print pricing service
        screenPrintPricingService = new ScreenPrintPricingService();

        // Initialize quote service for save/load
        quoteService = new ScreenPrintQuoteService();

        // Check for edit mode (loading existing quote for revision)
        const editQuoteId = checkForEditMode();
        if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await loadQuoteForEditing(editQuoteId);
        } else {
            // Initialize auto-save & draft recovery (2026 consolidation)
            initScreenPrintPersistence();

            // Check for draft recovery
            if (spSession && spSession.shouldShowRecovery()) {
                spSession.showRecoveryDialog(
                    (draft) => restoreScreenPrintDraft(draft),
                    () => {
                        if (spPersistence) spPersistence.clearDraft();
                        // No auto-row - user starts with empty state
                    }
                );
            }
            // No auto-row - empty state message guides user to search
        }

        // Setup event listeners (needed for both modes)
        setupSearchAutocomplete();
        setupKeyboardShortcuts();

        // Initialize print configuration
        updatePrintConfig();

        // Auto-select sales rep based on logged-in staff (2026 consolidation)
        if (typeof StaffAuthHelper !== 'undefined') {
            StaffAuthHelper.autoSelectSalesRep('sales-rep');
        }

        // Initialize customer lookup autocomplete
        if (typeof CustomerLookupService !== 'undefined') {
            const customerLookup = new CustomerLookupService();
            customerLookup.bindToInput('customer-lookup', {
                onSelect: (contact) => {
                    // Auto-fill customer fields
                    document.getElementById('customer-name').value = contact.ct_NameFull || '';
                    document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                    document.getElementById('company-name').value = contact.CustomerCompanyName || '';
                    showToast('Customer info loaded', 'success');
                },
                onClear: () => {
                    // Clear customer fields when lookup cleared
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                }
            });
        }

        // Initialize order & shipping fields (shared component)
        renderOrderShippingFields('spc-order-fields');
        initOrderShippingListeners('spc-order-fields', {
            onShippingFeeChange: () => updateTaxCalculation(),
            onTaxRateChange: (rate) => {
                const rateInput = document.getElementById('tax-rate-input');
                if (rateInput) rateInput.value = rate;
                updateTaxCalculation();
            }
        });

        // Auto-focus search bar for immediate typing (UX improvement)
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        showToast('Ready to build Screen Print quotes!', 'success');

    } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Failed to initialize. Please refresh.', 'error');
    }

    showLoading(false);
});

// ============================================================
// PRODUCT SEARCH & AUTOCOMPLETE (Using ExactMatchSearch module)
// ============================================================

// Module instance - initialized in setupSearchAutocomplete
let exactMatchSearcher = null;

function setupSearchAutocomplete() {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    if (!searchInput || !window.ExactMatchSearch) {
        console.error('[ScreenPrint] Search input or ExactMatchSearch module not found');
        return;
    }

    // Initialize ExactMatchSearch with full keyboard navigation
    exactMatchSearcher = new window.ExactMatchSearch({
        apiBase: API_BASE,
        debounceMs: 300,  // Standardized debounce

        // Auto-load exact matches immediately
        onExactMatch: (product) => {
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Show suggestions dropdown
        onSuggestions: (products) => {
            showSearchSuggestions(products);
        },

        // Keyboard navigation: update visual highlight
        onNavigate: (selectedIndex, products) => {
            updateSearchSelectionHighlight(selectedIndex);
        },

        // Keyboard navigation: select item via Enter
        onSelect: (product) => {
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Keyboard navigation: close dropdown via Escape
        onClose: () => {
            suggestions.classList.remove('show');
        }
    });

    // Wire up search input
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();

        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }

        exactMatchSearcher.search(query);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        // Let ExactMatchSearch handle navigation keys
        if (exactMatchSearcher && exactMatchSearcher.handleKeyDown(e)) {
            return; // Event was handled
        }

        // Handle Enter for immediate search when nothing is selected
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                exactMatchSearcher.searchImmediate(query);
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-input-wrapper')) {
            suggestions.classList.remove('show');
            if (exactMatchSearcher) exactMatchSearcher.resetNavigation();
        }
    });

}

/**
 * Show search suggestions dropdown
 */
function showSearchSuggestions(products) {
    const suggestions = document.getElementById('search-suggestions');

    if (!products || products.length === 0) {
        suggestions.innerHTML = '<div class="suggestion-item"><span>No products found</span></div>';
        suggestions.classList.add('show');
        return;
    }

    suggestions.innerHTML = products.map(product => {
        // Extract product name (remove style prefix from label)
        const productName = (product.label || '').split(' - ').slice(1).join(' - ') || '';
        return `
            <div class="suggestion-item" onclick="selectProduct('${product.value}')">
                <span class="style">${product.value}</span>
                <span class="name">${productName}</span>
            </div>
        `;
    }).join('');
    suggestions.classList.add('show');

    // Cache product data (convert to expected format)
    products.forEach(p => {
        productCache[p.value] = {
            STYLE: p.value,
            PRODUCT_TITLE: p.label
        };
    });
}

/**
 * Update visual highlight on selected suggestion item
 */
function updateSearchSelectionHighlight(selectedIndex) {
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;

    suggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

async function selectProduct(styleNumber) {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    searchInput.value = '';
    suggestions.classList.remove('show');

    // Add product to table
    await addProductRow(styleNumber);
}

// ============================================================
// PRODUCT TABLE MANAGEMENT
// ============================================================

function addNewRow() {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++rowCounter;

    // Hide empty state message when adding first row
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'new-row';
    row.dataset.rowId = rowId;

    row.innerHTML = `
        <td>
            <input type="text" class="cell-input style-input"
                   placeholder="Style #"
                   data-field="style"
                   onchange="onStyleChange(this, ${rowId})"
                   onkeydown="handleCellKeydown(event, this)">
        </td>
        <td class="thumbnail-col">
            <div class="product-thumbnail no-image" id="thumb-${rowId}"
                 title="Select a color to see product image"
                 style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;"></div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <input type="text" class="cell-input desc-input"
                       placeholder="(auto)"
                       data-field="description"
                       readonly>
            </div>
            <div class="pricing-breakdown" id="breakdown-${rowId}"></div>
        </td>
        <td>
            <div class="color-picker-wrapper" data-row-id="${rowId}">
                <div class="color-picker-selected disabled" onclick="toggleColorPicker(${rowId})" tabindex="0" onkeydown="handleColorPickerKeydown(event, ${rowId})">
                    <span class="color-swatch empty"></span>
                    <span class="color-name placeholder">Select color...</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" id="color-dropdown-${rowId}"></div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="M" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="L" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="text" class="cell-input size-input xxxl-picker-btn" data-size="3XL" value="" placeholder="+" readonly onclick="openExtendedSizePopup(${rowId})" onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}" disabled title="Click to add extended sizes (3XL, 4XL, 5XL, XS, etc.)"></td>
        <td class="cell-qty" id="row-qty-${rowId}">0</td>
        <td class="cell-price" id="row-price-${rowId}">-</td>
        <td class="cell-total" id="row-total-${rowId}">-</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="deleteRow(${rowId})" title="Delete row">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    // Focus on the style input
    setTimeout(() => {
        row.querySelector('.style-input').focus();
    }, 50);

    // Remove the "new-row" highlight after a moment
    setTimeout(() => {
        row.classList.remove('new-row');
    }, 1000);
}

async function addProductRow(styleNumber) {
    // Find or create empty row
    let targetRow = document.querySelector('tr.new-row');
    if (!targetRow) {
        addNewRow();
        targetRow = document.querySelector('tr.new-row');
    }

    const rowId = targetRow.dataset.rowId;
    const styleInput = targetRow.querySelector('.style-input');
    styleInput.value = styleNumber;

    await onStyleChange(styleInput, parseInt(rowId));
}

async function onStyleChange(input, rowId) {
    const styleNumber = input.value.trim().toUpperCase();
    if (!styleNumber) return;

    const row = document.getElementById(`row-${rowId}`);
    const descInput = row.querySelector('[data-field="description"]');
    const pickerWrapper = row.querySelector('.color-picker-wrapper');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    try {
        // Fetch product data using stylesearch API
        let product = productCache[styleNumber];
        if (!product) {
            const response = await fetch(`${API_BASE}/api/stylesearch?term=${styleNumber}`);
            const data = await response.json();
            if (data && data.length > 0) {
                // Find exact match or use first result
                const exactMatch = data.find(p => p.value.toUpperCase() === styleNumber);
                const result = exactMatch || data[0];
                product = {
                    STYLE: result.value,
                    PRODUCT_TITLE: result.label
                };
                productCache[styleNumber] = product;
            }
        }

        if (product) {
            // Pants products (PT20, etc.) are now supported via size picker popup
            // Size category detection will handle waist/inseam sizing

            // Clean product title (remove duplicate style numbers from API response)
            const cleanTitle = cleanProductTitle(product.PRODUCT_TITLE, styleNumber);

            // Update description with clean title
            descInput.value = cleanTitle || styleNumber;

            // Fetch colors using product-colors API (also returns CATEGORY_NAME)
            const colorsResponse = await fetch(`${API_BASE}/api/product-colors?styleNumber=${styleNumber}`);
            const colorsData = await colorsResponse.json();
            const colors = colorsData.colors || [];

            // Store product category from API
            const categoryName = colorsData.CATEGORY_NAME || '';
            row.dataset.category = categoryName;

            // Screen Print can print both garments and caps
            const isCap = isCapProduct(styleNumber, product.PRODUCT_TITLE, categoryName);
            row.dataset.isCap = isCap ? 'true' : 'false';

            if (colors && colors.length > 0) {
                // Populate custom color picker dropdown with swatches
                pickerDropdown.innerHTML = colors.map(c => `
                    <div class="color-picker-option"
                         data-color-name="${escapeHtml(c.COLOR_NAME)}"
                         data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
                         data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
                         data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
                         data-image-url="${escapeHtml(c.MAIN_IMAGE_URL || c.FRONT_MODEL || c.FRONT_FLAT || '')}"
                         onclick="selectColor(${rowId}, this)">
                        <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
                        <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
                    </div>
                `).join('');

                // Enable the picker
                pickerSelected.classList.remove('disabled');

                // Store colors for later (child rows, etc.)
                row.dataset.colors = JSON.stringify(colors);
            }

            // Store product info
            row.dataset.style = styleNumber;
            row.dataset.productName = cleanTitle || styleNumber;

        } else {
            descInput.value = 'Not found';
            showToast(`Style ${styleNumber} not found`, 'error');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'error');
    }
}

// escapeHtml() is now provided by quote-builder-utils.js

/**
 * Update product thumbnail when color is selected
 */
function updateProductThumbnail(rowId, imageUrl, productName, styleNumber, colorName) {
    const thumbContainer = document.getElementById(`thumb-${rowId}`);
    if (!thumbContainer) return;

    if (imageUrl) {
        // Replace placeholder with actual thumbnail
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = productName || styleNumber;
        img.className = 'product-thumbnail';
        img.onclick = () => {
            if (window.productThumbnailModal) {
                productThumbnailModal.open(imageUrl, productName, styleNumber, colorName);
            }
        };
        img.onerror = () => {
            img.classList.add('no-image');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        };

        thumbContainer.replaceWith(img);
        img.id = `thumb-${rowId}`;
    }
}

/**
 * cleanProductTitle() — now provided by quote-builder-utils.js
 */

// Position abbreviation mapping for compact breakdown display
const POSITION_ABBREV = {
    'Left Chest': 'LC', 'Right Chest': 'RC', 'Center Chest': 'CC',
    'Full Front': 'FF', 'Full Back': 'FB', 'Upper Back': 'UB',
    'Left Sleeve': 'LS', 'Right Sleeve': 'RS',
    'CF': 'CF', 'CB': 'CB', 'CL': 'CL', 'CR': 'CR',
    'Cap Front': 'CF', 'Cap Back': 'CB'
};

// Full names for tooltip display
const POSITION_FULL_NAMES = {
    'LC': 'Left Chest', 'RC': 'Right Chest', 'CC': 'Center Chest',
    'FF': 'Full Front', 'FB': 'Full Back', 'UB': 'Upper Back',
    'LS': 'Left Sleeve', 'RS': 'Right Sleeve',
    'CF': 'Cap Front', 'CB': 'Cap Back', 'CL': 'Cap Left Side', 'CR': 'Cap Right Side'
};

// formatPrice() is now provided by quote-builder-utils.js

/**
 * Build pricing breakdown HTML for a product row
 * Shows compact format: └─ LC 10K | Base $23 + Extra $2.50 = $25.50/ea
 * Includes hover tooltip with full calculation details
 *
 * @param {Object} product - Product data with isCap flag
 * @param {Object} lineItem - Line item from pricing calculator
 * @param {Object} logoConfig - Logo configuration (position, stitchCount)
 * @returns {string} HTML string for breakdown
 */
// buildPricingBreakdown() and updateRowBreakdown() removed — dead code (embroidery-specific, never called in screenprint)

/**
 * Check if a style number is a cap/hat product
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @param {string} categoryName - CATEGORY_NAME from SanMar API (most reliable)
 * @returns {boolean} True if cap/hat
 */
function isCapProduct(style, productTitle = '', categoryName = '') {
    // PRIORITY: Flat headwear (beanies, knit caps) use garment pricing, NOT cap pricing
    if (typeof ProductCategoryFilter !== 'undefined' && productTitle) {
        if (ProductCategoryFilter.isFlatHeadwear({ PRODUCT_TITLE: productTitle })) {
            return false;
        }
    }

    // BEST METHOD: Check CATEGORY_NAME from SanMar API
    // SanMar categorizes all caps/hats under "Caps" category
    if (categoryName && categoryName.toLowerCase() === 'caps') {
        return true;
    }

    // FALLBACK: Pattern matching for cases where category isn't available
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Check style patterns:
    // CP* caps (CP80, CP90, etc)
    // NE* caps (NE1000, NE400)
    // C+digit (C112, C118)
    // Richardson styles (112, 110, 115, etc) - numeric only
    if (/^C[P0-9]/.test(styleUpper) || styleUpper.startsWith('NE')) {
        return true;
    }

    // Richardson caps - 2-3 digit numeric styles (100-999)
    if (/^\d{2,3}$/.test(styleUpper)) {
        return true;
    }

    // Check title keywords
    if (titleUpper.includes('CAP') || titleUpper.includes('HAT') ||
        titleUpper.includes('BEANIE') || titleUpper.includes('SNAPBACK') ||
        titleUpper.includes('TRUCKER') || titleUpper.includes('RICHARDSON')) {
        return true;
    }

    return false;
}

/**
 * Check if product is pants (waist/inseam sizing not supported)
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @returns {boolean} True if pants
 */
function isPantsProduct(style, productTitle = '') {
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Red Kap work pants (PT prefix)
    if (styleUpper.startsWith('PT') && /^PT\d/.test(styleUpper)) return true;

    // Title keywords for pants
    if (titleUpper.includes('PANT') || titleUpper.includes('WORK PANT') ||
        titleUpper.includes('CARGO') || titleUpper.includes('TROUSER') ||
        titleUpper.includes('INDUSTRIAL PANT')) {
        return true;
    }

    return false;
}

/**
 * Analyze available sizes and determine the product's size category
 * Handles OSFA, combo sizes, youth, toddler, tall, and standard products
 * @param {string[]} availableSizes - Array of available sizes from API
 * @returns {Object} Category info with display configuration
 */
function analyzeSizeCategory(availableSizes) {
    if (!availableSizes || availableSizes.length === 0) {
        return { category: 'unknown', columns: [], useQtyOnly: false };
    }

    const sizes = availableSizes.map(s => s.toUpperCase());
    const STANDARD = ['S', 'M', 'L', 'XL'];
    const COMBO = ['S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X'];
    const YOUTH = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
    const TODDLER = ['2T', '3T', '4T', '5T', '5/6T', '6T'];
    const TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT'];
    const ONE_SIZE = ['OSFA', 'OSFM'];
    const PANTS_PATTERN = /^\d{4}$/;  // 4-digit waist/inseam codes like 2737, 2830
    const WAIST_ONLY_PATTERN = /^W\d{2}$/;  // Waist-only codes like W30, W32 (PT66 shorts)

    // Count sizes in each category for dominant detection
    const youthCount = sizes.filter(s => YOUTH.includes(s)).length;
    const toddlerCount = sizes.filter(s => TODDLER.includes(s)).length;
    const tallCount = sizes.filter(s => TALL.includes(s)).length;
    const comboCount = sizes.filter(s => COMBO.includes(s)).length;
    const osfaCount = sizes.filter(s => ONE_SIZE.includes(s)).length;
    const standardCount = sizes.filter(s => STANDARD.includes(s)).length;
    const pantsCount = sizes.filter(s => PANTS_PATTERN.test(s)).length;
    const waistOnlyCount = sizes.filter(s => WAIST_ONLY_PATTERN.test(s)).length;

    // Priority 1a: Waist-only shorts (W30, W32, etc. - PT66, CT103542)
    if (waistOnlyCount > 0 && waistOnlyCount >= sizes.length / 2) {
        // Extract all valid waist-only sizes
        const waistSizes = sizes.filter(s => WAIST_ONLY_PATTERN.test(s));
        return {
            category: 'shorts',
            columns: [],
            useQtyOnly: false,
            shortsSizes: waistSizes,
            baseSize: waistSizes[0],
            message: 'Select waist sizes'
        };
    }

    // Priority 1b: Pants (waist/inseam sizes like 3032 for 30x32)
    if (pantsCount > 0 && pantsCount >= sizes.length / 2) {
        // Extract all valid pants sizes (4-digit codes)
        const pantsSizes = sizes.filter(s => PANTS_PATTERN.test(s));
        return {
            category: 'pants',
            columns: [],
            useQtyOnly: false,
            pantsSizes: pantsSizes,
            baseSize: pantsSizes[0],
            message: 'Select waist/inseam sizes'
        };
    }

    // Priority 2: OSFA-only (caps, bags, beanies)
    if (osfaCount > 0 && osfaCount === sizes.length) {
        return {
            category: 'osfa-only',
            columns: [],
            useQtyOnly: true,
            baseSize: sizes[0],
            message: 'One Size Fits All'
        };
    }

    // Priority 3: Combo-only (fitted caps like NE1000)
    if (comboCount > 0 && comboCount === sizes.length) {
        return {
            category: 'combo-only',
            columns: sizes,
            useQtyOnly: false,
            baseSize: sizes[0]
        };
    }

    // Priority 4: Youth-dominant (has youth sizes AND more youth than standard)
    // PC61Y returns both S,M,L,XL AND YS,YM,YL,YXL - youth should win
    if (youthCount > 0 && youthCount >= standardCount) {
        return {
            category: 'youth-only',
            columns: YOUTH.filter(y => sizes.includes(y)),
            useQtyOnly: false,
            baseSize: sizes.find(s => YOUTH.includes(s)) || sizes[0]
        };
    }

    // Priority 5: Toddler-dominant
    if (toddlerCount > 0 && toddlerCount >= standardCount) {
        return {
            category: 'toddler-only',
            columns: TODDLER.filter(t => sizes.includes(t)),
            useQtyOnly: false,
            baseSize: sizes.find(s => TODDLER.includes(s)) || sizes[0]
        };
    }

    // Priority 6: Tall-dominant (LT, XLT without S, M, L, XL)
    if (tallCount > 0 && standardCount === 0) {
        return {
            category: 'tall-only',
            columns: sizes.filter(s => TALL.includes(s) || s === '2XL'),
            useQtyOnly: false,
            baseSize: sizes.find(s => TALL.includes(s)) || sizes[0]
        };
    }

    // Priority 7: Standard (has S, M, L, XL as dominant)
    if (standardCount > 0) {
        return {
            category: 'standard',
            columns: ['S', 'M', 'L', 'XL', '2XL'],
            useQtyOnly: false,
            baseSize: 'S',
            extendedSizes: sizes.filter(s => !STANDARD.includes(s) && s !== '2XL')
        };
    }

    // Fallback for unknown patterns
    return {
        category: 'other',
        columns: sizes.slice(0, 5),
        useQtyOnly: false,
        baseSize: sizes[0]
    };
}

/**
 * Update row UI based on size category
 * Handles OSFA (single qty input), combo sizes, and other non-standard layouts
 * @param {HTMLElement} row - The product row element
 * @param {Object} sizeInfo - Result from analyzeSizeCategory()
 */
function updateRowForSizeCategory(row, sizeInfo) {
    const rowId = row.dataset.rowId;
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Store category info for later use
    row.dataset.sizeCategory = sizeInfo.category;
    row.dataset.baseSize = sizeInfo.baseSize || '';

    // Handle PANTS (waist/inseam sizes) - use size picker popup
    if (sizeInfo.category === 'pants') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.pantsSizes && sizeInfo.pantsSizes.length > 0) {
            row.dataset.pantsSizes = JSON.stringify(sizeInfo.pantsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.pantsSizes); // For compatibility
            xxxlCell.classList.add('pants-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('pants-row');
        row.classList.add('non-standard-sizes');
        showToast('Pants product - click + to select waist/inseam sizes', 'info', 4000);
        return;
    }

    // Handle SHORTS (waist-only sizes like W30, W32) - use size picker popup
    if (sizeInfo.category === 'shorts') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.shortsSizes && sizeInfo.shortsSizes.length > 0) {
            row.dataset.shortsSizes = JSON.stringify(sizeInfo.shortsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.shortsSizes); // For compatibility
            row.dataset.sizeCategory = 'shorts'; // Ensure category is set
            xxxlCell.classList.add('shorts-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('shorts-row');
        row.classList.add('non-standard-sizes');
        showToast('Shorts product - click + to select waist sizes', 'info', 4000);
        return;
    }

    if (sizeInfo.useQtyOnly) {
        // OSFA-only: Hide all size columns, convert to single qty input
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Convert XXXL cell to qty input for OSFA
        if (xxxlCell) {
            xxxlCell.classList.remove('xxxl-picker-btn');
            xxxlCell.classList.add('osfa-qty-input');
            xxxlCell.removeAttribute('readonly');
            xxxlCell.type = 'number';
            xxxlCell.min = '0';
            xxxlCell.placeholder = 'Qty';
            xxxlCell.value = '';
            xxxlCell.disabled = false;
            xxxlCell.onclick = null;
            xxxlCell.onkeydown = null;
            xxxlCell.onchange = () => onOSFAQtyChange(rowId);
            xxxlCell.closest('td').classList.remove('size-disabled');
        }

        // Update header for this row (visual indicator)
        row.classList.add('osfa-only-row');

    } else if (sizeInfo.category === 'tall-only') {
        // TALL products: All sizes via extended size popup (like OSFA but with size picker)
        // Parent row has disabled columns; child rows handle each tall size
        const ALL_TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT'];
        const availableTallSizes = ALL_TALL.filter(s => sizeInfo.columns.includes(s));

        // Disable ALL size columns (parent row doesn't take quantities)
        sizeInputs.forEach((input, index) => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL picker for ALL tall sizes
        if (availableTallSizes.length > 0 && xxxlCell) {
            row.dataset.extendedSizes = JSON.stringify(availableTallSizes);
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('non-standard-sizes');
        row.classList.add('tall-only-row');

    } else if (sizeInfo.category !== 'standard' && sizeInfo.category !== 'unknown') {
        // Non-standard columns (combo, youth, toddler)
        const columns = sizeInfo.columns;

        sizeInputs.forEach((input, index) => {
            if (index < columns.length) {
                // Remap this column to new size
                const newSize = columns[index];
                input.dataset.size = newSize;
                input.disabled = false;
                input.placeholder = '0';
                input.closest('td').classList.remove('size-disabled');

                // Update column header visually
                updateColumnLabel(row, index, newSize);
            } else {
                // Hide extra columns
                input.disabled = true;
                input.value = '';
                input.placeholder = '-';
                input.closest('td').classList.add('size-disabled');
            }
        });

        // Handle XXXL picker based on extended sizes
        if (!sizeInfo.extendedSizes || sizeInfo.extendedSizes.length === 0) {
            if (xxxlCell) {
                xxxlCell.disabled = true;
                xxxlCell.placeholder = '-';
                xxxlCell.closest('td').classList.add('size-disabled');
            }
        }

        // Add visual indicator class
        row.classList.add('non-standard-sizes');
    }
    // Standard category keeps default UI
}

/**
 * Update column label for a specific row's size input
 * Creates inline label overlay showing the actual size name
 */
function updateColumnLabel(row, colIndex, newLabel) {
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const input = sizeInputs[colIndex];
    if (!input) return;

    const td = input.closest('td');

    // Add a label overlay showing the size
    let label = td.querySelector('.size-label-override');
    if (!label) {
        label = document.createElement('span');
        label.className = 'size-label-override';
        td.insertBefore(label, input);
    }
    label.textContent = newLabel;
}

/**
 * Handle quantity change for OSFA-only products
 * Updates dataset, qty display, and triggers pricing recalculation
 */
function onOSFAQtyChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const osfaInput = row.querySelector('.osfa-qty-input');
    const qty = parseInt(osfaInput?.value) || 0;

    // Store OSFA qty in dataset
    row.dataset.osfaQty = qty;
    row.dataset.isOsfaOnly = 'true';

    // Update qty display
    const qtyDisplay = document.getElementById(`row-qty-${rowId}`);
    if (qtyDisplay) qtyDisplay.textContent = qty;

    // Trigger pricing recalculation
    recalculatePricing();
}

/**
 * Fetch available sizes and adjust UI based on product type
 * Called after color selection to determine proper size columns
 */
async function detectAndAdjustSizeUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const styleNumber = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;

    if (!styleNumber || !catalogColor) return;

    // =========================================
    // CAP SPECIAL HANDLING
    // Caps use /api/sizes-by-style-color endpoint
    // =========================================
    if (row.dataset.isCap === 'true') {
        try {
            const capUrl = `${API_BASE}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
            const capResponse = await fetch(capUrl);

            let capSizes = ['OSFA']; // Default fallback
            if (capResponse.ok) {
                const capData = await capResponse.json();
                const sizes = capData.data || capData.sizes || capData;
                if (Array.isArray(sizes) && sizes.length > 0) {
                    capSizes = sizes;
                }
            } else {
                console.warn(`[Cap Sizes] API failed for ${styleNumber}, using OSFA fallback`);
            }


            // Analyze cap sizes and update UI
            const sizeInfo = analyzeSizeCategory(capSizes);

            updateRowForSizeCategory(row, sizeInfo);
            row.dataset.availableSizes = JSON.stringify(capSizes);
            row.dataset.capSizes = JSON.stringify(capSizes);
            return; // Exit - cap handling complete
        } catch (capError) {
            console.error('[Cap Sizes] Error fetching cap sizes:', capError);
            // Fall through to use OSFA
            const osfaInfo = { category: 'osfa-only', columns: [], useQtyOnly: true, baseSize: 'OSFA', message: 'One Size Fits All' };
            updateRowForSizeCategory(row, osfaInfo);
            row.dataset.availableSizes = JSON.stringify(['OSFA']);
            row.dataset.capSizes = JSON.stringify(['OSFA']);
            return;
        }
    }

    // =========================================
    // STANDARD GARMENT HANDLING
    // =========================================
    try {
        // Fetch all available sizes for this style+color
        const url = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Size Detection] API failed for ${styleNumber}:`);
            console.error(`  Status: ${response.status} ${response.statusText}`);
            console.error(`  URL: ${url}`);
            console.error(`  CatalogColor: ${catalogColor}`);

            // Try fallback: fetch without color filter to at least get size info
            try {
                const altUrl = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}`;
                const altResponse = await fetch(altUrl);

                if (altResponse.ok) {
                    const skus = await altResponse.json();
                    if (skus && skus.length > 0) {
                        const allSizes = extractAllSizes(skus);
                        const sizeInfo = analyzeSizeCategory(allSizes);
                        updateRowForSizeCategory(row, sizeInfo);
                        row.dataset.availableSizes = JSON.stringify(allSizes);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('[Size Detection] Fallback also failed:', fallbackError);
            }
            return;
        }

        const skus = await response.json();

        // Extract ALL available sizes (not just Size06)
        const allSizes = extractAllSizes(skus);

        // Analyze and update UI
        const sizeInfo = analyzeSizeCategory(allSizes);

        updateRowForSizeCategory(row, sizeInfo);

        // Store for pricing calculations
        row.dataset.availableSizes = JSON.stringify(allSizes);

        // Validate size availability using SKU service
        validateSizeAvailability(row, allSizes);

    } catch (error) {
        console.error('Error detecting size category:', error);
    }
}

/**
 * Validate size availability and update UI indicators
 * Uses SKUValidationService to check which sizes exist in ShopWorks
 *
 * @param {HTMLElement} row - Product row element
 * @param {string[]} availableSizes - Sizes available for this product/color
 */
function validateSizeAvailability(row, availableSizes) {
    if (!row || !availableSizes) return;

    const styleNumber = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;
    const skuService = window.skuValidationService || new SKUValidationService();
    window.skuValidationService = skuService; // Cache for reuse

    // Get all size inputs in this row
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Standard size columns (S, M, L, XL, XXL)
    const columnSizes = ['S', 'M', 'L', 'XL', '2XL'];

    sizeInputs.forEach((input, index) => {
        const size = columnSizes[index];
        if (!size) return;

        const isAvailable = availableSizes.includes(size);
        const sku = skuService.sanmarToShopWorksSKU(styleNumber, size);

        // Update input state based on availability
        if (isAvailable) {
            input.classList.add('size-available');
            input.classList.remove('size-unavailable');
            input.disabled = false;
            input.placeholder = '0';
            input.title = `${size} (SKU: ${sku})`;
        } else {
            input.classList.add('size-unavailable');
            input.classList.remove('size-available');
            input.disabled = true;
            input.value = '';
            input.placeholder = 'N/A';
            input.title = `${size} not available for this style/color`;
            input.closest('td')?.classList.add('size-disabled');
        }

        // Store SKU on input for reference
        input.dataset.sku = sku;
    });

    // Update extended size picker (XXXL column) if present
    if (xxxlCell && !xxxlCell.classList.contains('osfa-qty-input')) {
        const extendedSizes = availableSizes.filter(s =>
            !columnSizes.includes(s) && s !== 'OSFA'
        );
        const hasExtended = extendedSizes.length > 0;

        if (hasExtended) {
            xxxlCell.classList.remove('size-unavailable');
            xxxlCell.disabled = false;
            xxxlCell.title = `Extended sizes: ${extendedSizes.join(', ')}`;
            row.dataset.extendedSizes = JSON.stringify(extendedSizes);
        } else {
            xxxlCell.classList.add('size-unavailable');
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.title = 'No extended sizes available';
        }
    }

}

/**
 * Extract ALL sizes from SKU data (Size01-06 fields)
 * Returns sizes in logical display order
 */
function extractAllSizes(skus) {
    const sizes = new Set();

    skus.forEach(sku => {
        ['Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06'].forEach(field => {
            if (sku[field] && typeof sku[field] === 'string' && sku[field].trim()) {
                sizes.add(sku[field].trim());
            }
        });
    });

    // Return in logical order
    const ORDER = ['S', 'M', 'L', 'XL', '2XL', 'XS', 'S/M', 'M/L', 'L/XL',
                   'YXS', 'YS', 'YM', 'YL', 'YXL', '2T', '3T', '4T', '5T', '6T',
                   'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'OSFM'];
    return [...sizes].sort((a, b) => {
        const ai = ORDER.indexOf(a);
        const bi = ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

// getSwatchStyle() — now provided by quote-builder-utils.js

// ============================================================
// COLOR PICKER FUNCTIONS
// ============================================================

/**
 * Toggle color picker dropdown open/closed
 */
function toggleColorPicker(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const pickerSelected = row.querySelector('.color-picker-selected');
    const dropdown = row.querySelector('.color-picker-dropdown');

    // Don't open if disabled
    if (pickerSelected.classList.contains('disabled')) return;

    // Close all other open dropdowns first
    document.querySelectorAll('.color-picker-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });

    // Toggle this dropdown
    dropdown.classList.toggle('hidden');

    // Scroll selected option into view if open
    if (!dropdown.classList.contains('hidden')) {
        const selectedOption = dropdown.querySelector('.color-picker-option.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }
}

/**
 * Detect if product is tall/youth/toddler-only and gray out unavailable size columns
 * This improves UX by showing users which sizes actually exist for the product
 */
async function detectProductTypeAndAdjustUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const style = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;
    if (!style || !catalogColor) return;

    try {
        // Fetch available sizes from API
        const availableSizes = await getAvailableExtendedSizes(style, catalogColor);

        // Check for standard sizes (S, M, L, XL)
        const standardSizeLabels = ['S', 'M', 'L', 'XL'];
        const hasStandardSizes = standardSizeLabels.some(s => availableSizes.includes(s));

        // Detect tall/youth/toddler-only products
        const tallSizes = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST'];
        const youthSizes = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
        const toddlerSizes = ['2T', '3T', '4T', '5T', '5/6T', '6T'];

        const hasTallOnly = !hasStandardSizes && availableSizes.some(s => tallSizes.includes(s));
        const hasYouthOnly = !hasStandardSizes && availableSizes.some(s => youthSizes.includes(s));
        const hasToddlerOnly = !hasStandardSizes && availableSizes.some(s => toddlerSizes.includes(s));

        if (hasTallOnly || hasYouthOnly || hasToddlerOnly) {
            // Gray out standard size columns - they don't exist for this product
            standardSizeLabels.forEach(size => {
                const input = row.querySelector(`input[data-size="${size}"]`);
                if (input) {
                    input.disabled = true;
                    input.value = '';
                    input.placeholder = 'N/A';
                    input.style.backgroundColor = '#f0f0f0';
                    input.style.color = '#999';
                    input.title = 'Size not available for this product';
                }
            });

            // Store product type for reference
            row.dataset.productType = hasTallOnly ? 'tall-only' :
                                       hasYouthOnly ? 'youth-only' : 'toddler-only';

            // Focus on the extended size picker instead
            const xxxlInput = row.querySelector('input[data-size="3XL"]');
            if (xxxlInput) xxxlInput.focus();
        }
    } catch (error) {
        console.warn('Could not detect product type for UI adjustment:', error);
    }
}

/**
 * Select a color from the dropdown
 */
function selectColor(rowId, optionEl) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;
    const imageUrl = optionEl.dataset.imageUrl;
    const style = row.dataset.style;

    // Check for duplicate row (same style + color)
    const existingRow = findExistingRow(style, catalogColor, rowId);
    if (existingRow) {
        showToast(`${style} in ${colorName} already exists. Adding to existing row.`, 'info');
        row.querySelector('.color-picker-dropdown').classList.add('hidden');
        const existingFirstSize = existingRow.querySelector('.size-input:not([disabled])');
        if (existingFirstSize) existingFirstSize.focus();
        return;
    }

    // Update selected display with swatch and full color name
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    row.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Store data on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = catalogColor;
    row.dataset.swatchUrl = swatchUrl || '';
    row.dataset.hex = hex || '';
    row.dataset.imageUrl = imageUrl || '';

    // Update product thumbnail
    updateProductThumbnail(rowId, imageUrl, row.dataset.productName, style, colorName);

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Enable size inputs initially (may be disabled by detectAndAdjustSizeUI for special products)
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // Detect size category and adjust UI (OSFA, combo, youth, toddler, tall, standard)
    // This runs async but doesn't block - will update UI when API returns
    detectAndAdjustSizeUI(rowId);

    // Focus first size input (may be overridden by detectAndAdjustSizeUI for special products)
    const firstSize = row.querySelector('.size-input');
    if (firstSize) firstSize.focus();

    // Cascade to child rows if any
    cascadeColorToChildRows(rowId, colorName, catalogColor, swatchUrl, hex);

    recalculatePricing();
}

/**
 * Cascade color selection to child rows (for extended sizes)
 */
function cascadeColorToChildRows(parentRowId, colorName, catalogColor, swatchUrl, hex) {
    if (!childRowMap[parentRowId]) return;

    Object.values(childRowMap[parentRowId]).forEach(childRowId => {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow && childRow.dataset.colorManuallySet !== 'true') {
            childRow.dataset.color = colorName;
            childRow.dataset.catalogColor = catalogColor;

            // Update child row's color picker display if it has one
            const childPicker = childRow.querySelector('.color-picker-selected');
            if (childPicker) {
                const childSwatch = childPicker.querySelector('.color-swatch');
                const childName = childPicker.querySelector('.color-name');
                if (childSwatch && childName) {
                    if (swatchUrl) {
                        childSwatch.style.backgroundImage = `url('${swatchUrl}')`;
                        childSwatch.style.backgroundColor = '';
                    } else {
                        childSwatch.style.backgroundImage = '';
                        childSwatch.style.backgroundColor = hex || '#ccc';
                    }
                    childSwatch.classList.remove('empty');
                    childName.textContent = colorName;
                    childName.classList.remove('placeholder');
                }
            }
        }
    });
    updateChildRowColorIndicators(parentRowId);
}

/**
 * Handle keyboard navigation in color picker
 */
function handleColorPickerKeydown(event, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const dropdown = row.querySelector('.color-picker-dropdown');
    const isOpen = !dropdown.classList.contains('hidden');

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleColorPicker(rowId);
    } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        dropdown.classList.add('hidden');
    } else if (event.key === 'ArrowDown' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, 1);
    } else if (event.key === 'ArrowUp' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, -1);
    } else if (event.key === 'Tab') {
        // Close dropdown on tab
        dropdown.classList.add('hidden');
    }
}

/**
 * Navigate through dropdown options with arrow keys
 */
function navigateOptions(dropdown, direction) {
    const options = dropdown.querySelectorAll('.color-picker-option');
    if (options.length === 0) return;

    let currentIndex = -1;
    options.forEach((opt, i) => {
        if (opt.classList.contains('focused')) currentIndex = i;
    });

    // Remove current focus
    options.forEach(opt => opt.classList.remove('focused'));

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    // Add focus to new option
    options[newIndex].classList.add('focused');
    options[newIndex].scrollIntoView({ block: 'nearest' });
}

// Click outside handler to close all dropdowns
document.addEventListener('click', function(e) {
    if (!e.target.closest('.color-picker-wrapper')) {
        document.querySelectorAll('.color-picker-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

/**
 * Select a color for a child row (extended size)
 * Similar to selectColor but marks color as manually set
 */
function selectChildColor(childRowId, parentRowId, optionEl) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;

    // Update selected display with swatch and full color name
    const pickerSelected = childRow.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    childRow.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Store data on row
    childRow.dataset.color = colorName;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.swatchUrl = swatchUrl || '';
    childRow.dataset.hex = hex || '';
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually changed

    // Close dropdown
    childRow.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Update visual indicator for different color
    updateChildRowColorIndicators(parentRowId);

    recalculatePricing();
}

async function onColorChange(select, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const color = select.value;

    if (!color) return;

    const selectedOption = select.options[select.selectedIndex];
    const catalogColor = selectedOption.dataset.catalog || '';
    const style = row.dataset.style;

    // Check for duplicate row (same style + color)
    const existingRow = findExistingRow(style, catalogColor, rowId);
    if (existingRow) {
        // Show toast and focus on existing row
        showToast(`${style} in ${color} already exists. Adding to existing row.`, 'info');

        // Clear this row's color selection
        select.value = '';

        // Focus on the existing row's first size input
        const existingFirstSize = existingRow.querySelector('.size-input:not([disabled])');
        if (existingFirstSize) existingFirstSize.focus();
        return;
    }

    row.dataset.color = color;
    row.dataset.catalogColor = catalogColor;

    // Enable size inputs
    row.querySelectorAll('.size-input').forEach(input => {
        input.disabled = false;
    });

    // Cascade color change to child rows that haven't been manually edited
    if (childRowMap[rowId]) {
        Object.entries(childRowMap[rowId]).forEach(([size, childRowId]) => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow && childRow.dataset.colorManuallySet !== 'true') {
                // Update child row color
                childRow.dataset.color = color;
                childRow.dataset.catalogColor = catalogColor;

                // Update child row's color dropdown selection
                const childColorSelect = childRow.querySelector('.child-color-select');
                if (childColorSelect) {
                    childColorSelect.value = color;
                }

            }
        });
        updateChildRowColorIndicators(rowId);
    }

    // Focus first size input
    const firstSize = row.querySelector('.size-input');
    if (firstSize) firstSize.focus();
}

/**
 * Handle color change in a child row
 * Updates child row's color and marks it as manually set
 */
function onChildColorChange(select, childRowId, parentRowId) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const color = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const catalogColor = selectedOption.dataset.catalog || '';

    // Update child row data attributes
    childRow.dataset.color = color;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually edited

    // Update visual indicator
    updateChildRowColorIndicators(parentRowId);


    // Recalculate pricing
    recalculatePricing();
}

/**
 * Update visual styling for child rows based on color match with parent
 */
function updateChildRowColorIndicators(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const parentCatalogColor = parentRow.dataset.catalogColor;

    if (childRowMap[parentRowId]) {
        Object.values(childRowMap[parentRowId]).forEach(childRowId => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                if (childRow.dataset.catalogColor !== parentCatalogColor) {
                    childRow.classList.add('different-color');
                } else {
                    childRow.classList.remove('different-color');
                }
            }
        });
    }
}

/**
 * Find an existing row with the same style and catalogColor (excluding current row)
 */
function findExistingRow(style, catalogColor, excludeRowId) {
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row)');
    for (const row of rows) {
        const rowNumericId = parseInt(row.id.replace('row-', ''));
        if (rowNumericId === excludeRowId) continue;
        if (row.dataset.style === style && row.dataset.catalogColor === catalogColor) {
            return row;
        }
    }
    return null;
}

function onSizeChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Skip if this is a child row (child rows don't trigger size changes)
    if (row.classList.contains('child-row')) {
        recalculatePricing();
        return;
    }

    const sizeCategory = row.dataset.sizeCategory;

    // OSFA-only products are handled separately by onOSFAQtyChange()
    if (sizeCategory === 'osfa-only') {
        recalculatePricing();
        return;
    }

    // Calculate total from ONLY parent row's enabled size inputs (excludes disabled 2XL, XXXL picker, OSFA)
    // Child row quantities display separately — don't double-count in parent
    let standardTotal = 0;
    row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
        standardTotal += parseInt(input.value) || 0;
    });

    if (standardTotal > 0) {
        document.getElementById(`row-qty-${rowId}`).textContent = standardTotal;
    } else {
        // Variant-only: show child row total so parent doesn't display "0"
        let childTotal = 0;
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const qtyDisplay = childRow.querySelector('.qty-display');
            childTotal += parseInt(qtyDisplay?.textContent) || 0;
        });
        document.getElementById(`row-qty-${rowId}`).textContent = childTotal;
    }

    // Handle 2XL/XXL size (has direct input) - create/update/remove child rows
    // Note: Size06 sizes (XS, 3XL, 4XL, 5XL, 6XL) are handled by the Extended Size Picker popup
    const xxlInput = row.querySelector('[data-size="2XL"]');
    if (xxlInput) {
        const qty = parseInt(xxlInput.value) || 0;
        // Check for both 2XL and XXL child rows (XXL is distinct for Ladies/Womens products)
        const existingChildId = childRowMap[rowId]?.['2XL'] || childRowMap[rowId]?.['XXL'];
        const existingChildSize = childRowMap[rowId]?.['2XL'] ? '2XL' : (childRowMap[rowId]?.['XXL'] ? 'XXL' : '2XL');

        if (qty > 0) {
            // Need a child row for 2XL (or XXL if that's what exists)
            if (existingChildId) {
                updateChildRow(existingChildId, qty);
            } else {
                createChildRow(rowId, '2XL', qty);
            }
            // Disable the 2XL input in parent and clear value
            xxlInput.disabled = true;
            xxlInput.value = '';  // Clear to prevent visual confusion
            xxlInput.style.background = '#f5f5f5';
            xxlInput.style.color = '#999';

            // Recalculate parent row qty display (standard sizes only — child rows display separately)
            let newTotal = 0;
            row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
                newTotal += parseInt(input.value) || 0;
            });
            document.getElementById(`row-qty-${rowId}`).textContent = newTotal;
        } else {
            // Remove child row if it exists (could be 2XL or XXL)
            if (existingChildId) {
                removeChildRow(rowId, existingChildSize);
            }
            // Re-enable 2XL input in parent
            xxlInput.disabled = false;
            xxlInput.style.background = '';
            xxlInput.style.color = '';
        }
    }

    // Recalculate pricing
    recalculatePricing();
}

/**
 * Generate ShopWorks-compatible part number
 * Uses SIZE_TO_SUFFIX which contains ALL size suffixes (tall, youth, toddler, etc.)
 */
function getPartNumber(baseStyle, size) {
    // For pants sizes (4-digit codes like 3032), append directly with underscore
    if (/^\d{4}$/.test(size)) {
        return `${baseStyle}_${size}`;
    }
    return baseStyle + (SIZE_TO_SUFFIX[size] || '');
}

/**
 * Create a child row for an extended size
 */
function createChildRow(parentRowId, size, qty) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const childRowId = ++rowCounter;
    const baseStyle = parentRow.dataset.style;
    const partNumber = getPartNumber(baseStyle, size);

    // Get parent's available colors for the dropdown
    const parentColors = parentRow.dataset.colors ? JSON.parse(parentRow.dataset.colors) : [];
    const parentColor = parentRow.dataset.color || '';
    const parentCatalogColor = parentRow.dataset.catalogColor || '';
    const parentSwatchUrl = parentRow.dataset.swatchUrl || '';
    const parentHex = parentRow.dataset.hex || '#ccc';

    // Build color picker options HTML with swatches
    const colorOptionsHtml = parentColors.map(c =>
        `<div class="color-picker-option ${c.COLOR_NAME === parentColor ? 'selected' : ''}"
             data-color-name="${escapeHtml(c.COLOR_NAME)}"
             data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
             data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
             data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
             onclick="selectChildColor(${childRowId}, ${parentRowId}, this)">
            <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
            <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
        </div>`
    ).join('');

    // Build current color display
    const currentSwatchStyle = parentSwatchUrl
        ? `background-image: url('${parentSwatchUrl}'); background-size: cover; background-position: center;`
        : `background-color: ${parentHex};`;

    const childRow = document.createElement('tr');
    childRow.id = `row-${childRowId}`;
    childRow.className = 'child-row';
    childRow.dataset.rowId = childRowId;
    childRow.dataset.parentRowId = parentRowId;
    childRow.dataset.extendedSize = size;
    childRow.dataset.style = partNumber;
    childRow.dataset.baseStyle = baseStyle;
    childRow.dataset.color = parentRow.dataset.color;
    childRow.dataset.catalogColor = parentRow.dataset.catalogColor;
    childRow.dataset.swatchUrl = parentSwatchUrl;
    childRow.dataset.hex = parentHex;
    childRow.dataset.productName = parentRow.dataset.productName;
    childRow.dataset.colorManuallySet = 'false';  // Track if user manually changed color

    // Determine which column this size goes to:
    // - Size05 (XXL column): 2XL and XXL (both map to Size05 in ShopWorks)
    // - Size06 (XXXL column): XS, 3XL, 4XL, 5XL, 6XL, pants sizes, shorts sizes
    const isSize05 = size === '2XL' || size === 'XXL';
    const isPantsSize = /^\d{4}$/.test(size);  // 4-digit pants sizes like 3032
    const isShortsSize = /^W\d{2}$/.test(size);  // Waist-only shorts sizes like W30
    const isSize06 = SIZE06_EXTENDED_SIZES.includes(size) || isPantsSize || isShortsSize;

    // Format display size (pants: "3032" -> "30x32", shorts: "W30" -> "Waist 30", others: keep as-is)
    let displaySize = size;
    if (isPantsSize) {
        const waist = size.substring(0, 2);
        const inseam = size.substring(2, 4);
        displaySize = `${waist}x${inseam}`;
    } else if (isShortsSize) {
        const waist = size.replace('W', '');
        displaySize = `Waist ${waist}`;
    }

    // Create cell content - only the specific size column is editable
    childRow.innerHTML = `
        <td>
            <span class="child-indicator">└</span>
            <span class="style-display">${partNumber}</span>
        </td>
        <td class="thumbnail-col"></td>
        <td>
            <span class="desc-display" style="color: #666; font-size: 12px;">${escapeHtml(parentRow.dataset.productName)} - <strong>${displaySize}</strong></span>
        </td>
        <td>
            <div class="color-picker-wrapper child-color-picker" data-row-id="${childRowId}">
                <div class="color-picker-selected" onclick="toggleColorPicker(${childRowId})" tabindex="0" onkeydown="handleColorPickerKeydown(event, ${childRowId})">
                    <span class="color-swatch" style="${currentSwatchStyle}"></span>
                    <span class="color-name">${escapeHtml(parentColor)}</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" id="color-dropdown-${childRowId}">
                    ${colorOptionsHtml}
                </div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="M" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="L" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" ${isSize05 ? '' : 'disabled'} value="${isSize05 ? qty : ''}" placeholder="${isSize05 ? qty : ''}" style="${isSize05 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td><input type="number" class="cell-input size-input" data-size="${size}" ${isSize06 ? '' : 'disabled'} value="${isSize06 ? qty : ''}" placeholder="${isSize06 ? qty : ''}" style="${isSize06 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td class="cell-qty qty-display" id="row-qty-${childRowId}">${qty}</td>
        <td class="cell-price unit-price-display" id="row-price-${childRowId}">-</td>
        <td class="cell-total" id="row-total-${childRowId}">-</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="clearExtendedSize(${parentRowId}, '${size}')" title="Remove ${displaySize}">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert in correct size order: XS, 2XL, 3XL, 4XL, 5XL, 6XL
    const existingChildren = Array.from(document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`));

    if (existingChildren.length === 0) {
        // No children yet, insert after parent
        parentRow.after(childRow);
    } else {
        // Find correct position based on size order (XS first, then 2XL, 3XL, etc.)
        const newSizeIndex = EXTENDED_SIZE_ORDER.indexOf(size);
        let insertAfter = parentRow;  // Default: after parent (for XS or first size)

        for (const existingChild of existingChildren) {
            const existingSize = existingChild.dataset.extendedSize;
            const existingSizeIndex = EXTENDED_SIZE_ORDER.indexOf(existingSize);

            // If existing size comes before new size in order, insert after this child
            if (existingSizeIndex < newSizeIndex) {
                insertAfter = existingChild;
            } else {
                // Found a size that should come after us, stop here
                break;
            }
        }

        insertAfter.after(childRow);
    }

    // Track child row
    if (!childRowMap[parentRowId]) {
        childRowMap[parentRowId] = {};
    }
    childRowMap[parentRowId][size] = childRowId;

}

/**
 * Update an existing child row quantity
 */
function updateChildRow(childRowId, qty) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const size = childRow.dataset.extendedSize;
    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    if (sizeInput) {
        sizeInput.value = qty;
    }
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;
}

/**
 * Remove a child row
 */
function removeChildRow(parentRowId, size) {
    const childRowId = childRowMap[parentRowId]?.[size];
    if (childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) {
            childRow.remove();
        }
        delete childRowMap[parentRowId][size];
    }
}

/**
 * Handle size change in child row - sync back to parent
 */
function onChildSizeChange(childRowId, parentRowId, size) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!childRow || !parentRow) return;

    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    const qty = parseInt(sizeInput?.value) || 0;

    // Update child row quantity display
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;

    // Sync back to parent row's hidden input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = qty;
    }

    // If qty is 0, remove the child row
    if (qty === 0) {
        clearExtendedSize(parentRowId, size);
    }

    recalculatePricing();
}

/**
 * Clear an extended size (remove child row, enable parent input)
 */
function clearExtendedSize(parentRowId, size) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    // Clear parent input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = '';
        parentInput.disabled = false;
        parentInput.style.background = '';
        parentInput.style.color = '';
    }

    // Remove child row
    removeChildRow(parentRowId, size);

    recalculatePricing();
}

// reorderRowByProductType() removed — dead code (never called)

function deleteRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // If this is a parent row, also remove all child rows
    if (!row.classList.contains('child-row') && childRowMap[rowId]) {
        Object.keys(childRowMap[rowId]).forEach(size => {
            const childRowId = childRowMap[rowId][size];
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                childRow.remove();
            }
        });
        delete childRowMap[rowId];
    }


    row.remove();
    recalculatePricing();

    // Update cap logo section visibility (hide if no caps remain)
    updateCapLogoSectionVisibility();
}

// ============================================================
// KEYBOARD NAVIGATION (Excel-style)
// ============================================================

// setupKeyboardShortcuts() → moved to quote-builder-utils.js

function handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const cells = Array.from(row.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
    const currentIndex = cells.indexOf(input);

    if (event.key === 'Tab' && !event.shiftKey) {
        // Tab to next cell
        if (currentIndex === cells.length - 1) {
            // Last cell in row - add new row
            event.preventDefault();
            addNewRow();
        }
    } else if (event.key === 'Enter') {
        // Enter = next row
        event.preventDefault();

        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex === rows.length - 1) {
            // Last row - add new
            addNewRow();
        } else {
            // Focus same column in next row
            const nextRow = rows[currentRowIndex + 1];
            const nextCells = Array.from(nextRow.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
            if (nextCells[currentIndex]) {
                nextCells[currentIndex].focus();
            } else if (nextCells[0]) {
                nextCells[0].focus();
            }
        }
    } else if (event.key === 'ArrowDown') {
        // Arrow down
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex < rows.length - 1) {
            const nextRow = rows[currentRowIndex + 1];
            const field = input.dataset.field || input.dataset.size;
            const nextInput = nextRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (nextInput && !nextInput.disabled) {
                nextInput.focus();
            }
        }
    } else if (event.key === 'ArrowUp') {
        // Arrow up
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex > 0) {
            const prevRow = rows[currentRowIndex - 1];
            const field = input.dataset.field || input.dataset.size;
            const prevInput = prevRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (prevInput && !prevInput.disabled) {
                prevInput.focus();
            }
        }
    }
}

// ============================================================
// PRICING CALCULATIONS (Screen Print)
// ============================================================

// Alias for backward compatibility
function recalculateAllPrices() {
    recalculatePricing();
}

// Screen Print tier mapping (different from DTG)
const SCREENPRINT_TIERS = [
    { label: '24-36', min: 24, max: 36 },
    { label: '37-72', min: 37, max: 72 },
    { label: '73-144', min: 73, max: 144 },
    { label: '145+', min: 145, max: Infinity }
];

function getScreenPrintTier(qty) {
    // Under 24 uses 24-36 pricing (+ LTM fee applied separately)
    if (qty < 24) return SCREENPRINT_TIERS[0];
    for (const tier of SCREENPRINT_TIERS) {
        if (qty >= tier.min && qty <= tier.max) return tier;
    }
    return SCREENPRINT_TIERS[SCREENPRINT_TIERS.length - 1];
}

// Find the pricing tier from the Caspio tiers array for a given qty.
// Clamps to the top tier when qty exceeds all tier maxes — otherwise a
// capped top tier (e.g. ScreenPrint's 145-576) silently reprices anything
// above the cap at the worst tier.
function findPricingTier(tiers, qty) {
    if (!tiers || tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    const match = sorted.find(t =>
        qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)
    );
    if (match) return match;
    const top = sorted[sorted.length - 1];
    if (qty > (top.maxQty ?? Infinity)) return top;
    return sorted[0];
}

async function recalculatePricing() {
    // Collect products from table (parent rows only)
    const productList = collectProductsFromTable();

    if (productList.length === 0) {
        updatePricingDisplay({
            totalQuantity: 0,
            tier: '24-36',
            subtotal: 0,
            ltmFee: 0,
            setupFees: printConfig.setupFee,
            grandTotal: printConfig.setupFee
        });
        // Clear all price and total cells
        document.querySelectorAll('.cell-price').forEach(cell => {
            cell.textContent = '-';
        });
        document.querySelectorAll('.cell-total').forEach(cell => {
            cell.textContent = '-';
        });
        return;
    }

    // Calculate total quantity across all products
    let totalQty = 0;
    productList.forEach(p => {
        totalQty += p.totalQty || 0;
    });

    // Determine tier based on total quantity
    const tier = getScreenPrintTier(totalQty);

    // LTM control panel — show/hide based on quantity
    let baseLtmFee = 0;
    if (totalQty > 0 && totalQty <= 36) baseLtmFee = 75;
    else if (totalQty <= 71) baseLtmFee = 50;
    const wouldHaveLTM = baseLtmFee > 0;

    const ltmWrapper = document.getElementById('spc-ltm-wrapper');
    if (ltmWrapper) {
        if (wouldHaveLTM) {
            ltmWrapper.style.display = '';
            if (!document.querySelector('#spc-ltm-panel .ltm-control-panel')) {
                renderLtmControlPanel('spc-ltm-panel', { feeAmount: baseLtmFee });
                initLtmControlListeners('spc-ltm-panel', () => {
                    recalculatePricing();
                    markScreenPrintDirty();
                });
            } else {
                setLtmControlState('spc-ltm-panel', { feeAmount: baseLtmFee });
            }
        } else {
            ltmWrapper.style.display = 'none';
            setLtmControlState('spc-ltm-panel', { enabled: true, displayMode: 'builtin' });
        }
    }

    // Read LTM control state
    const ltmState = getLtmControlState('spc-ltm-panel');
    const ltmEnabled = wouldHaveLTM ? ltmState.enabled : true;
    const ltmDisplayMode = ltmState.displayMode || 'builtin';
    const ltmFee = (wouldHaveLTM && ltmEnabled) ? baseLtmFee : 0;
    const perUnitLTM = ltmFee > 0 ? Math.floor(ltmFee / totalQty * 100) / 100 : 0;

    // Safety stripes: $2 per piece per location
    const locationCount = printConfig.backLocation ? 2 : 1;
    const safetyStripesPerPiece = printConfig.isSafetyStripes ? (2.00 * locationCount) : 0;

    let subtotal = 0;
    const pricedProducts = [];
    let firstPricing = null;  // Capture first product's pricing for nudge savings calc
    let firstTierData = null;

    try {
        // Process each product
        for (const product of productList) {
            const style = product.style;

            // Fetch Screen Print pricing data for this style
            const pricingData = await screenPrintPricingService.fetchPricingData(style);

            if (!pricingData) {
                console.warn(`No pricing data for ${style}`);
                continue;
            }

            // Get primary location pricing (garment + print)
            const frontColors = printConfig.frontColors.toString();
            const primaryPricing = pricingData.primaryLocationPricing?.[frontColors];

            if (!primaryPricing || !primaryPricing.tiers) {
                console.warn(`No primary pricing for ${frontColors} colors`);
                continue;
            }

            // Find the tier data for this quantity
            const tierData = findPricingTier(primaryPricing.tiers, totalQty);
            if (!tierData) continue;

            // Capture first product's pricing for nudge savings calculation
            if (!firstPricing) {
                firstPricing = primaryPricing;
                firstTierData = tierData;
            }

            // Get additional location pricing if back location enabled
            let additionalPricePerPiece = 0;
            if (printConfig.backLocation) {
                const backColors = printConfig.backColors.toString();
                const additionalPricing = pricingData.additionalLocationPricing?.[backColors];
                if (additionalPricing && additionalPricing.tiers) {
                    const additionalTier = findPricingTier(additionalPricing.tiers, totalQty);
                    additionalPricePerPiece = additionalTier?.pricePerPiece || 0;
                }
            }

            // Find parent row for this product
            const parentRow = document.querySelector(`tr[data-style="${style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`);
            if (!parentRow) continue;

            const rowId = parentRow.dataset.rowId;
            let productSubtotal = 0;      // ALL sizes (for sidebar subtotal)
            let parentOnlySubtotal = 0;   // Standard sizes only (for parent row Total cell)

            // Calculate and display price for each size
            Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
                if (qty <= 0) return;

                // Get base price for this size from primary location
                let sizePrice = tierData.prices?.[size];
                if (typeof sizePrice !== 'number') {
                    // Try common fallbacks
                    sizePrice = tierData.prices?.['M'] || tierData.prices?.['L'] || 0;
                }

                // Add additional location price
                sizePrice += additionalPricePerPiece;

                // Add safety stripes
                sizePrice += safetyStripesPerPiece;

                // Display price: builtin mode adds LTM per-unit, separate mode shows base price
                const displayPrice = (ltmDisplayMode === 'builtin' && perUnitLTM > 0) ? sizePrice + perUnitLTM : sizePrice;
                // Use displayPrice for subtotal so row totals match displayed unit prices
                productSubtotal += displayPrice * qty;

                // Update row price cell (for standard sizes, update parent row)
                // Note: 2XL/XXL are child rows but NOT in SIZE06_EXTENDED_SIZES (they go in Size05 column)
                const isExtendedSize = SIZE06_EXTENDED_SIZES.includes(size) || size === '2XL' || size === 'XXL';
                if (!isExtendedSize) {
                    parentOnlySubtotal += displayPrice * qty;
                }
                if (!isExtendedSize) {
                    const priceCell = document.getElementById(`row-price-${rowId}`);
                    if (priceCell) {
                        priceCell.textContent = `$${displayPrice.toFixed(2)}`;
                    }
                } else {
                    // Extended size - find child row
                    const childRowId = childRowMap[rowId]?.[size];
                    if (childRowId) {
                        const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                        if (childPriceCell) {
                            childPriceCell.textContent = `$${displayPrice.toFixed(2)}`;
                        }
                        // Update child row total (qty × price)
                        const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                        if (childTotalCell) {
                            const childTotal = displayPrice * qty;
                            childTotalCell.textContent = qty > 0 ? `$${childTotal.toFixed(2)}` : '-';
                        }
                    }
                }
            });

            // Update parent row total (standard sizes only — child rows show their own totals)
            const parentTotalCell = document.getElementById(`row-total-${rowId}`);
            if (parentTotalCell) {
                const displayTotal = parentOnlySubtotal > 0 ? parentOnlySubtotal : productSubtotal;
                parentTotalCell.textContent = product.totalQty > 0 ? `$${displayTotal.toFixed(2)}` : '-';
            }

            // Update pricing breakdown for the row
            updateRowBreakdownScreenPrint(rowId, product, tierData);

            subtotal += productSubtotal;
            pricedProducts.push({
                product,
                prices: tierData.prices,
                tier: tier
            });
        }

        // Calculate grand total — in builtin mode LTM is already in subtotal via inflated unit prices
        const setupFees = printConfig.setupFee;
        const grandTotal = (ltmDisplayMode === 'builtin') ? subtotal + setupFees : subtotal + ltmFee + setupFees;

        // Compute per-piece savings for next tier nudge
        let nextTierSavings = null;
        if (pricedProducts.length > 0 && firstPricing?.tiers && firstTierData) {
            try {
                const currentTierIdx = firstPricing.tiers.indexOf(firstTierData);
                if (currentTierIdx >= 0 && currentTierIdx < firstPricing.tiers.length - 1) {
                    const nextTier = firstPricing.tiers[currentTierIdx + 1];
                    const curPrice = firstTierData.prices?.['M'] ?? firstTierData.prices?.['L'] ?? Object.values(firstTierData.prices || {})[0] ?? 0;
                    const nextPrice = nextTier.prices?.['M'] ?? nextTier.prices?.['L'] ?? Object.values(nextTier.prices || {})[0] ?? 0;
                    if (curPrice > nextPrice) nextTierSavings = curPrice - nextPrice;
                }
            } catch (e) { /* graceful fallback */ }
        }

        // Store LTM state for tax/discount calculations
        window.currentPricingData = window.currentPricingData || {};
        window.currentPricingData.ltmFee = ltmFee;
        window.currentPricingData.ltmDisplayMode = ltmDisplayMode;
        window.currentPricingData.nextTierSavings = nextTierSavings;

        // Update pricing display sidebar
        updatePricingDisplay({
            totalQuantity: totalQty,
            tier: tier.label,
            subtotal: subtotal,
            ltmFee: ltmFee,
            ltmDisplayMode: ltmDisplayMode,
            setupFees: setupFees,
            grandTotal: grandTotal,
            products: pricedProducts
        });

    } catch (error) {
        console.error('Screen Print Pricing calculation error:', error);
        showToast('Error calculating prices. Please try again.', 'error');
    }

    // Mark as dirty for auto-save (2026 consolidation)
    markScreenPrintDirty();
}

// Update row breakdown display for Screen Print
function updateRowBreakdownScreenPrint(rowId, product, tierData) {
    const breakdownEl = document.getElementById(`breakdown-${rowId}`);
    if (!breakdownEl) return;

    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    const basePrice = tierData.prices?.['M'] || tierData.prices?.['L'] || 0;

    let breakdownHtml = `
        <span class="breakdown-item">${frontName} (${printConfig.frontColors}-color)</span>
        <span class="breakdown-separator">|</span>
        <span class="breakdown-item">$${basePrice.toFixed(2)}/ea</span>
    `;

    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">${backName} (${printConfig.backColors}-color)</span>
        `;
    }

    breakdownEl.innerHTML = breakdownHtml;
}

function collectProductsFromTable() {
    const products = [];
    // Only collect from parent rows (not child rows or AL config rows)
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row):not(.al-config-row)');

    rows.forEach(row => {
        const rowId = parseInt(row.id.replace('row-', ''));
        const style = row.dataset.style;
        const parentColor = row.dataset.color;
        const parentCatalogColor = row.dataset.catalogColor || '';

        if (!style || !parentColor) return;

        // Group sizes by color - different colors become separate products
        const colorGroups = {};

        // Initialize parent color group
        colorGroups[parentCatalogColor] = {
            color: parentColor,
            catalogColor: parentCatalogColor,
            sizeBreakdown: {},
            totalQty: 0
        };

        // Collect size inputs from parent row (standard or remapped sizes)
        // IMPORTANT: Exclude .xxxl-picker-btn (shows TOTAL) and .osfa-qty-input (handled separately)
        // Note: For non-standard products (combo, youth, toddler, tall), data-size is remapped
        const sizeCategory = row.dataset.sizeCategory;
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            if (qty > 0 && size) {
                colorGroups[parentCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[parentCatalogColor].totalQty += qty;
            }
        });

        // Handle OSFA-only products (beanies, caps, bags)
        // OSFA qty is stored in parent row, not child rows
        if (row.dataset.isOsfaOnly === 'true') {
            const osfaQty = parseInt(row.dataset.osfaQty) || 0;
            if (osfaQty > 0) {
                colorGroups[parentCatalogColor].sizeBreakdown['OSFA'] = osfaQty;
                colorGroups[parentCatalogColor].totalQty += osfaQty;
            }
        }

        // Collect extended sizes from CHILD ROWS - GROUP BY COLOR
        // Child rows may have different colors than parent
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const size = childRow.dataset.extendedSize;
            const childColor = childRow.dataset.color;
            const childCatalogColor = childRow.dataset.catalogColor || '';
            const qtyDisplay = childRow.querySelector('.qty-display');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0 && size) {
                // Initialize color group if different from parent
                if (!colorGroups[childCatalogColor]) {
                    colorGroups[childCatalogColor] = {
                        color: childColor,
                        catalogColor: childCatalogColor,
                        sizeBreakdown: {},
                        totalQty: 0
                    };
                }

                colorGroups[childCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[childCatalogColor].totalQty += qty;
            }
        });

        // Create product entry for each color group with quantities
        Object.entries(colorGroups).forEach(([catalogColor, group]) => {
            if (group.totalQty > 0) {
                products.push({
                    style: style,
                    color: group.color,
                    catalogColor: group.catalogColor,
                    productName: row.dataset.productName || style,
                    sizeBreakdown: group.sizeBreakdown,
                    totalQty: group.totalQty,
                    rowId: rowId
                });
            }
        });
    });

    return products;
}

function updatePricingDisplay(pricing) {
    // Store for toggle reference
    window.currentPricingData = pricing;

    // Update sidebar print configuration display
    updateSidebarPrintConfig();

    // Basic pricing info
    const totalQty = pricing.totalQuantity || 0;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('subtotal').textContent = `$${(pricing.subtotal || 0).toFixed(2)}`;
    updatePerUnitPrice(pricing.subtotal || 0, pricing.totalQuantity || 0);
    updateQuantityNudge(pricing.totalQuantity || 0, 'scp', window.currentPricingData?.nextTierSavings);

    // Minimum order warning banner (show when qty > 0 but < 24)
    const minWarning = document.getElementById('min-order-warning');
    if (minWarning) {
        minWarning.style.display = (totalQty > 0 && totalQty < 24) ? 'flex' : 'none';
    }

    // Update pre-tax subtotal for tax calculation (grand total before tax)
    document.getElementById('pre-tax-subtotal').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;

    // Update tax calculation
    updateTaxCalculation();

    // Pricing tier
    const pricingTierEl = document.getElementById('pricing-tier');
    pricingTierEl.textContent = pricing.tier || '24-36';

    // LTM display — show table row only in "separate" mode
    const ltmTableRow = document.getElementById('ltm-fee-row');
    const ltmTableUnit = document.getElementById('ltm-row-unit');
    const ltmTableTotal = document.getElementById('ltm-row-total');
    const ltmMode = pricing.ltmDisplayMode || 'builtin';

    if (pricing.ltmFee > 0 && ltmMode === 'separate') {
        if (ltmTableRow) {
            ltmTableRow.style.display = 'table-row';
            if (ltmTableUnit) ltmTableUnit.textContent = `$${pricing.ltmFee.toFixed(2)}`;
            if (ltmTableTotal) ltmTableTotal.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
    } else {
        if (ltmTableRow) ltmTableRow.style.display = 'none';
    }

    // Update all fee table rows (setup, art, design, rush, discount)
    updateFeeTableRows();
}

// Update sidebar to reflect current print configuration
function updateSidebarPrintConfig() {
    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    document.getElementById('sidebar-front').textContent = `${frontName} (${printConfig.frontColors}-color)`;

    // Back location
    const backRow = document.getElementById('sidebar-back-row');
    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        document.getElementById('sidebar-back').textContent = `${backName} (${printConfig.backColors}-color)`;
        backRow.style.display = 'flex';
    } else {
        backRow.style.display = 'none';
    }

    // Total screens
    document.getElementById('sidebar-screens').textContent = printConfig.totalScreens;

    // Dark garment
    document.getElementById('sidebar-dark-row').style.display = printConfig.isDarkGarment ? 'flex' : 'none';

    // Safety stripes
    const stripesRow = document.getElementById('sidebar-stripes-row');
    if (printConfig.isSafetyStripes) {
        const locationCount = printConfig.backLocation ? 2 : 1;
        document.getElementById('sidebar-stripes-cost').textContent = `+$${(2.00 * locationCount).toFixed(2)}/pc`;
        stripesRow.style.display = 'flex';
    } else {
        stripesRow.style.display = 'none';
    }

    // Update fee table rows (includes setup fee)
    updateFeeTableRows();
}

// ============================================================
// TAX CALCULATION & ADDITIONAL CHARGES
// ============================================================

function updateTaxCalculation() {
    const includeTax = document.getElementById('include-tax')?.checked;
    const subtotalEl = document.getElementById('pre-tax-subtotal');
    const taxRowEl = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalEl = document.getElementById('grand-total-with-tax');

    // Get base subtotal from pricing
    let subtotal = parseFloat(subtotalEl?.textContent?.replace(/[$,]/g, '') || 0);

    // Add art charge if enabled
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    subtotal += artCharge;

    // Add graphic design fee
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designFee = designHours * 75;
    subtotal += designFee;

    // Add rush fee if present
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    subtotal += rushFee;

    // Subtract discount if present
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    let discount = 0;
    if (discountType === 'percent') {
        discount = subtotal * (discountAmount / 100);
    } else {
        discount = discountAmount;
    }
    subtotal = Math.max(0, subtotal - discount);

    // Add shipping fee (after discount — shipping not discountable)
    const shippingFee = parseFloat(document.querySelector('#spc-order-fields .os-shipping-fee')?.value) || 0;
    subtotal += shippingFee;

    // Update the pre-tax subtotal display to show adjusted amount
    if (subtotalEl) {
        subtotalEl.textContent = '$' + subtotal.toFixed(2);
    }

    // Dynamic tax rate from ZIP lookup or manual input
    const taxRateInput = parseFloat(document.getElementById('tax-rate-input')?.value) || 10.1;
    const taxRate = taxRateInput / 100;

    if (includeTax) {
        const tax = Math.round(subtotal * taxRate * 100) / 100;
        const total = subtotal + tax;
        taxRowEl.style.display = 'flex';
        taxAmountEl.textContent = '$' + tax.toFixed(2);
        grandTotalEl.textContent = '$' + total.toFixed(2);
    } else {
        taxRowEl.style.display = 'none';
        grandTotalEl.textContent = '$' + subtotal.toFixed(2);
    }
}

// toggleAdditionalCharges() moved to quote-builder-utils.js

function updateAdditionalCharges() {
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designFee = designHours * 75;
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const badge = document.getElementById('charges-badge');

    const netCharges = artCharge + designFee + rushFee - discountAmount;
    if (netCharges !== 0) {
        badge.textContent = (netCharges >= 0 ? '+' : '') + '$' + netCharges.toFixed(2);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    // Update fee table rows
    updateFeeTableRows();

    // Recalculate tax with new charges
    updateTaxCalculation();
}

function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const prefix = document.getElementById('discount-prefix');
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const presetDropdown = document.getElementById('discount-preset');
    const amountInput = document.getElementById('discount-amount');

    if (discountType === 'percent') {
        // Show preset dropdown, hide number input
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (presetDropdown) presetDropdown.style.display = 'block';
        // Set amount from preset (unless custom is selected)
        if (presetDropdown && presetDropdown.value !== 'custom') {
            if (amountInput) amountInput.value = presetDropdown.value;
        }
    } else {
        // Show number input, hide preset dropdown
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (prefix) prefix.textContent = '$';
    }

    updateAdditionalCharges();
}

function handleDiscountPresetChange() {
    const preset = document.getElementById('discount-preset')?.value;
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const amountInput = document.getElementById('discount-amount');
    const prefix = document.getElementById('discount-prefix');

    if (preset === 'custom') {
        // Show number input for custom entry
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (prefix) prefix.textContent = '%';
        if (amountInput) amountInput.focus();
    } else {
        // Use preset value
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (amountInput) amountInput.value = preset;
    }
    updateFeeTableRows();
}

function handleDiscountReasonPresetChange() {
    const preset = document.getElementById('discount-reason-preset')?.value;
    const customInput = document.getElementById('discount-reason');

    if (preset === 'custom') {
        // Show custom input and focus it
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = '';
            customInput.focus();
        }
    } else {
        // Hide custom input and use preset value
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = preset;
        }
    }
    updateFeeTableRows();
}

// ============================================================
// ARTWORK SERVICES FUNCTIONS
// toggleArtworkServices(), toggleArtCharge(), updateArtworkCharges()
// moved to quote-builder-utils.js
// ============================================================

function updateFeeTableRows() {
    // Setup fee row (always shown for screen print)
    const setupFeeRow = document.getElementById('setup-fee-table-row');
    const setupScreensLabel = document.getElementById('setup-screens-label');
    const setupFeeUnit = document.getElementById('setup-fee-unit');
    const setupFeeTotal = document.getElementById('setup-fee-total');
    if (setupFeeRow && printConfig) {
        const screens = printConfig.totalScreens || 1;
        const fee = screens * SCREEN_FEE;
        setupScreensLabel.textContent = screens + ' screen' + (screens > 1 ? 's' : '');
        setupFeeUnit.textContent = '$' + fee.toFixed(2);
        setupFeeTotal.textContent = '$' + fee.toFixed(2);
    }

    // Art charge row
    const artChargeRow = document.getElementById('art-charge-row');
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    if (artChargeRow) {
        if (artChargeToggle?.checked && artCharge > 0) {
            artChargeRow.style.display = 'table-row';
            document.getElementById('art-charge-unit').textContent = '$' + artCharge.toFixed(2);
            document.getElementById('art-charge-total').textContent = '$' + artCharge.toFixed(2);
        } else {
            artChargeRow.style.display = 'none';
        }
    }

    // Graphic design row
    const graphicDesignRow = document.getElementById('graphic-design-row');
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designTotal = designHours * 75;
    if (graphicDesignRow) {
        if (designHours > 0) {
            graphicDesignRow.style.display = 'table-row';
            document.getElementById('design-hours-label').textContent = designHours;
            document.getElementById('graphic-design-unit').textContent = '$' + designTotal.toFixed(2);
            document.getElementById('graphic-design-total-row').textContent = '$' + designTotal.toFixed(2);
        } else {
            graphicDesignRow.style.display = 'none';
        }
    }

    // Rush fee row
    const rushFeeRow = document.getElementById('rush-fee-row');
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    if (rushFeeRow) {
        if (rushFee > 0) {
            rushFeeRow.style.display = 'table-row';
            document.getElementById('rush-fee-unit').textContent = '$' + rushFee.toFixed(2);
            document.getElementById('rush-fee-total').textContent = '$' + rushFee.toFixed(2);
        } else {
            rushFeeRow.style.display = 'none';
        }
    }

    // Discount row
    const discountRow = document.getElementById('discount-row');
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    if (discountRow) {
        if (discountAmount > 0) {
            discountRow.style.display = 'table-row';
            // Calculate actual discount
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                // Calculate discountable subtotal (products + additional services + setup fees)
                const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '') || 0);
                const artCharge = document.getElementById('art-charge-toggle')?.checked
                    ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
                const designFee = parseFloat(document.getElementById('graphic-design-hours')?.value || 0) * 75;
                const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
                const setupFee = parseFloat(document.getElementById('setup-fee-total')?.textContent?.replace(/[$,]/g, '') || 0);
                const ltmFee = window.currentPricingData?.ltmFee || 0;

                const discountableSubtotal = productsSubtotal + artCharge + designFee + rushFee + setupFee + ltmFee;
                actualDiscount = discountableSubtotal * (discountAmount / 100);
            }
            const reasonLabel = document.getElementById('discount-reason-label');
            if (reasonLabel) {
                let labelParts = [];
                if (discountType === 'percent') {
                    labelParts.push(`${discountAmount}%`);
                }
                if (discountReason) {
                    labelParts.push(discountReason);
                }
                reasonLabel.textContent = labelParts.length > 0 ? `(${labelParts.join(' - ')})` : '';
            }
            document.getElementById('discount-unit').textContent = '-$' + actualDiscount.toFixed(2);
            document.getElementById('discount-total').textContent = '-$' + actualDiscount.toFixed(2);
        } else {
            discountRow.style.display = 'none';
        }
    }
}

// toggleSaveShare() → moved to quote-builder-utils.js

// ============================================================
// ACTIONS (Save, Print, Email, Copy)
// ============================================================

async function printQuote() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before printing', 'error');
        return;
    }

    showLoading(true);

    try {
        // Build pricing data structure for invoice generator
        const pricingData = buildScreenprintPricingData(products);

        // Generate and open print window
        const invoiceGenerator = new EmbroideryInvoiceGenerator();
        const customerData = {
            name: document.getElementById('customer-name')?.value || 'Customer',
            company: document.getElementById('company-name')?.value || '',
            email: document.getElementById('customer-email')?.value || '',
            salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com'
        };

        // LTM display mode: builtin = baked into prices, separate = shown as line item
        const ltmState = getLtmControlState('spc-ltm-panel');
        pricingData.ltmDistributed = (ltmState.displayMode === 'builtin');

        const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);
        const printWindow = window.open('', '_blank');
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
function buildScreenprintPricingData(products) {
    const currentPricing = window.currentPricingData || {};
    const quoteId = document.getElementById('quote-id')?.textContent || `SPC-${Date.now()}`;

    // Build products array with line items for invoice
    const invoiceProducts = [];

    products.forEach(product => {
        // Build line items from size breakdown
        const lineItems = [];

        // Find the parent row for this product to read its displayed price
        const parentRow = document.querySelector(
            `tr[data-style="${product.style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`
        );
        const rowId = parentRow?.dataset?.rowId;

        // Read base price from parent row's price cell (displayed as $25.99)
        const basePriceCell = document.getElementById(`row-price-${rowId}`);
        const basePriceText = basePriceCell?.textContent || '$0.00';
        const baseUnitPrice = parseFloat(basePriceText.replace('$', '').replace(',', '')) || 0;

        // Base sizes (S, M, L, XL, XXL) - Note: L is internal, LG is display
        // 2XL is NOT a base size - it goes in extendedSizes with its own upcharge
        const baseSizes = ['S', 'M', 'L', 'LG', 'XL', 'XXL'];
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

        if (baseQty > 0) {
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

        // Extended sizes - read from child row price cells (includes 2XL which has upcharge)
        const extendedSizes = ['2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA'];
        extendedSizes.forEach(size => {
            const qty = product.sizeBreakdown[size] || 0;
            if (qty > 0) {
                // Find child row's price cell
                const childRowId = childRowMap[rowId]?.[size];
                const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                const childPriceText = childPriceCell?.textContent || '$0.00';
                const unitPrice = parseFloat(childPriceText.replace('$', '').replace(',', '')) || 0;

                lineItems.push({
                    description: `${size}(${qty})`,
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: qty * unitPrice,
                    hasUpcharge: true
                });
            }
        });

        if (lineItems.length > 0) {
            invoiceProducts.push({
                product: {
                    style: product.style,
                    title: product.productName || product.style,
                    color: product.color
                },
                lineItems: lineItems
            });
        }
    });

    // Calculate totals from line items
    let subtotal = 0;
    invoiceProducts.forEach(p => {
        p.lineItems.forEach(item => {
            subtotal += item.total;
        });
    });

    // Build print config description for invoice
    const frontDesc = getLocationName(printConfig.frontLocation) + ` (${printConfig.frontColors}-color)`;
    const backDesc = printConfig.backLocation ? getLocationName(printConfig.backLocation) + ` (${printConfig.backColors}-color)` : null;

    // Calculate safety stripes total for display as separate line item
    const locationCount = printConfig.backLocation ? 2 : 1;
    const safetyStripesTotal = printConfig.isSafetyStripes
        ? (currentPricing.totalQuantity * 2.00 * locationCount)
        : 0;

    // Get art charge and graphic design from UI
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const graphicDesignCharge = graphicDesignHours * 75;

    // Get rush fee and discount from UI
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    let discount = discountAmount;
    if (discountType === 'percent' && discountAmount > 0) {
        discount = subtotal * (discountAmount / 100);
    }

    return {
        quoteId: quoteId,
        tier: currentPricing.tier || '24-36',
        products: invoiceProducts,
        subtotal: subtotal,
        grandTotal: currentPricing.grandTotal || subtotal,
        setupFees: currentPricing.setupFees || printConfig.setupFee || 0,
        additionalServicesTotal: 0,
        // Empty logos means embroidery specs section will be skipped
        logos: [],
        // Screenprint-specific
        isScreenprint: true,
        printConfig: {
            front: frontDesc,
            back: backDesc,
            isDarkGarment: printConfig.isDarkGarment,
            hasSafetyStripes: printConfig.isSafetyStripes,
            totalScreens: printConfig.totalScreens || 1
        },
        ltmFee: currentPricing.ltmFee || 0,
        safetyStripesTotal: safetyStripesTotal,
        totalQuantity: currentPricing.totalQuantity || 0,
        // New fee fields
        artCharge: artCharge,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: rushFee,
        discount: discount,
        discountReason: discountReason
    };
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
async function saveAndGetLink() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before saving', 'error');
        return;
    }

    // Validate required fields
    const customerName = document.getElementById('customer-name')?.value?.trim();
    const customerEmail = document.getElementById('customer-email')?.value?.trim();

    if (!customerName || !customerEmail) {
        showToast('Please enter customer name and email', 'error');
        if (!customerName) document.getElementById('customer-name')?.focus();
        else if (!customerEmail) document.getElementById('customer-email')?.focus();
        return;
    }

    // Get save button for loading state
    const saveBtn = document.querySelector('.btn-save-quote');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
    }

    try {
        // Get current pricing data
        const pricing = window.currentPricingData || {};

        // Format items for quote service
        const items = products.map(product => ({
            styleNumber: product.style,
            productName: product.description || product.style,
            color: product.color,
            colorCode: product.catalogColor || product.color,
            quantity: product.qty,
            sizeBreakdown: product.sizes || {},
            basePrice: product.basePrice || 0,
            unitPrice: product.unitPrice || 0,
            ltmPerUnit: product.ltmPerUnit || 0,
            lineTotal: product.lineTotal || (product.qty * (product.unitPrice || 0)),
            imageUrl: product.imageUrl || ''
        }));

        // Get additional charges for saving (2026 fee refactor)
        const artChargeToggle = document.getElementById('art-charge-toggle');
        const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
        const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
        const graphicDesignCharge = graphicDesignHours * 75;
        const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
        const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
        const discountType = document.getElementById('discount-type')?.value || 'fixed';
        const discountReason = document.getElementById('discount-reason')?.value || '';
        // Calculate discountable subtotal for percentage discount (products + additional services + setup fees)
        const discountableSubtotal = (pricing.subtotal || 0) + artCharge + graphicDesignCharge + rushFee + (printConfig.setupFee || 0) + (pricing.ltmFee || 0);
        const discount = discountType === 'percent' ? (discountableSubtotal * discountAmount / 100) : discountAmount;
        const discountPercent = discountType === 'percent' ? discountAmount : 0;

        // Collect quote data
        const quoteData = {
            customerName: customerName,
            customerEmail: customerEmail,
            companyName: document.getElementById('company-name')?.value?.trim() || '',
            salesRep: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com',
            items: items,
            totalQuantity: pricing.totalQuantity || items.reduce((sum, p) => sum + p.quantity, 0),
            subtotal: pricing.subtotal || 0,
            ltmFee: pricing.ltmFee || 0,
            setupFees: printConfig.setupFee || 0,
            grandTotal: pricing.grandTotal || 0,
            frontLocation: printConfig.frontLocation,
            frontColors: printConfig.frontColors,
            backLocation: printConfig.backLocation,
            backColors: printConfig.backColors,
            isDarkGarment: printConfig.isDarkGarment,
            hasSafetyStripes: printConfig.isSafetyStripes,
            printSetup: {
                frontLocation: printConfig.frontLocation,
                frontColors: printConfig.frontColors,
                backLocation: printConfig.backLocation,
                backColors: printConfig.backColors,
                isDarkGarment: printConfig.isDarkGarment,
                isSafetyStripes: printConfig.isSafetyStripes
            },
            // Additional charges (2026 fee refactor)
            artCharge: artCharge,
            graphicDesignHours: graphicDesignHours,
            graphicDesignCharge: graphicDesignCharge,
            rushFee: rushFee,
            discount: discount,
            discountPercent: discountPercent,
            discountReason: discountReason,
            // LTM display preferences (2026-03-22)
            ltmDisplayMode: getLtmControlState('spc-ltm-panel').displayMode || 'builtin',
            ltmWaived: !getLtmControlState('spc-ltm-panel').enabled,
            // Order & shipping fields (2026-03-22)
            ...getOrderShippingData('spc-order-fields')
        };

        let result;
        if (editingQuoteId) {
            // Update existing quote
            result = await quoteService.updateQuote(editingQuoteId, quoteData);
            if (result && result.success) {
                result.quoteID = editingQuoteId;
                // Update revision number
                editingRevision = result.revision;
                updateEditModeUI(editingQuoteId, editingRevision);
            }
        } else {
            // Create new quote
            result = await quoteService.saveQuote(quoteData);
        }

        if (result.success) {

            // Clear auto-save draft on successful save (2026 consolidation)
            if (spPersistence) {
                spPersistence.clearDraft();
            }

            // Show success modal with shareable link
            if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                QuoteShareModal.show(result.quoteID, editingQuoteId ? `Updated to Rev ${editingRevision}` : null);
            } else {
                // Fallback
                const url = `${window.location.origin}/quote/${result.quoteID}`;
                const message = editingQuoteId
                    ? `Quote updated!\n\nQuote ID: ${result.quoteID}\nRevision: ${editingRevision}\n\nShareable Link:\n${url}`
                    : `Quote saved!\n\nQuote ID: ${result.quoteID}\n\nShareable Link:\n${url}`;
                alert(message);
            }
        } else {
            throw new Error(result.error || 'Failed to save quote');
        }

    } catch (error) {
        console.error('[ScreenPrint] Save error:', error);
        showToast('Error saving quote: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
}

// Legacy function - redirects to saveAndGetLink
async function saveQuote() {
    return saveAndGetLink();
}

async function spcEmailQuote() {
    const quoteId = editingQuoteId;
    if (!quoteId) {
        showToast('Please save the quote first before emailing', 'error');
        return;
    }
    await emailQuote({
        quoteId,
        customerEmail: document.getElementById('customer-email')?.value?.trim(),
        customerName: document.getElementById('customer-name')?.value?.trim(),
        salesRepEmail: document.getElementById('sales-rep')?.value
    });
}

async function copyToClipboard() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    try {
        // Get current pricing from sidebar
        const pricing = window.currentPricingData || {
            totalQuantity: 0,
            tier: '24-36',
            subtotal: 0,
            ltmFee: 0,
            setupFees: printConfig.setupFee,
            grandTotal: printConfig.setupFee
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
        `Customer: ${document.getElementById('customer-name')?.value || 'N/A'}`,
        `Company: ${document.getElementById('company-name')?.value || 'N/A'}`,
    ];

    // Print Configuration
    lines.push('');
    lines.push('PRINT CONFIGURATION:');
    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    lines.push(`  Front: ${frontName} (${printConfig.frontColors}-color)`);
    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        lines.push(`  Back: ${backName} (${printConfig.backColors}-color)`);
    }
    if (printConfig.isDarkGarment) {
        lines.push(`  Dark Garment: Yes (includes white underbase)`);
    }
    if (printConfig.isSafetyStripes) {
        const locationCount = printConfig.backLocation ? 2 : 1;
        lines.push(`  Safety Stripes: +$${(2.00 * locationCount).toFixed(2)}/piece`);
    }
    lines.push(`  Total Screens: ${printConfig.totalScreens}`);
    lines.push(`  Setup Fee: $${printConfig.setupFee.toFixed(2)}`);

    // Products
    lines.push('');
    lines.push('PRODUCTS:');
    lines.push('------------------------------------------------');
    products.forEach(p => {
        const sizes = Object.entries(p.sizeBreakdown || {})
            .filter(([s, q]) => q > 0)
            .map(([s, q]) => `${s}:${q}`)
            .join(' ');
        lines.push(`${p.style} - ${p.color} | ${sizes} | Qty: ${p.totalQty || 0}`);
    });

    // Summary
    lines.push('');
    lines.push('------------------------------------------------');
    lines.push(`Total Pieces: ${pricing.totalQuantity || 0}`);
    lines.push(`Pricing Tier: ${pricing.tier || '24-36'}`);
    lines.push(`Products Subtotal: $${(pricing.subtotal || 0).toFixed(2)}`);
    lines.push(`Setup Fee (${printConfig.totalScreens} screens): $${(pricing.setupFees || 0).toFixed(2)}`);
    if (pricing.ltmFee > 0) {
        lines.push(`Less Than Minimum Fee: $${pricing.ltmFee.toFixed(2)}`);
    }
    lines.push(`TOTAL: $${(pricing.grandTotal || 0).toFixed(2)}`);
    lines.push('');
    lines.push('Northwest Custom Apparel | 253-922-5793');

    return lines.join('\n');
}

// ============================================================
// UTILITIES
// ============================================================

// showLoading(), showToast() → provided by quote-builder-utils.js
