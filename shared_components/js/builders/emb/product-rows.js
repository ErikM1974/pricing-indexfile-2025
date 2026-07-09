/**
 * EMB product-rows module — roadmap 0.4 extraction #10 (2026-07-07).
 *
 * The row machinery, the biggest cluster: product search/autocomplete,
 * addNewRow/onStyleChange, non-SanMar rows, service rows (AL/DECG/monogram/
 * extra-color), the size-category engine (analyzeSizeCategory,
 * detectAndAdjustSizeUI, OSFA/pants/caps), the color picker + child-row
 * (extended-size) machinery, price override, keyboard nav, logo card
 * header, and the date helpers.
 *
 * Moved verbatim from embroidery-quote-builder.js (~3,185-line contiguous
 * cluster). With this cut the monolith is reduced to shared state + the
 * DOMContentLoaded composition root. State stays monolith-declared
 * (config-level writable globals); the 0.5 quote-model migrates it.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global
   escapeHtml, showToast, renderOrderRecap, QuoteOrderSummary, markAsUnsaved,
   Event, cleanProductTitle, getSwatchStyle, productThumbnailModal, formatPrice,
   ProductCategoryFilter, SKUValidationService, SIZE_TO_SUFFIX,
   EXTENDED_SIZE_ORDER */
import { getServicePrice } from './pricing.js';
import { recalculatePricing, updateTaxCalculation, collectProductsFromTable, getOrderPieceCounts, syncALRows, syncDECGRows } from './pricing-sync.js';
import { updateNotesBadge, updateEmbellishmentDropdownLabels, getCapEmbellishmentType } from './logo-config.js';
import { updateAdditionalCharges } from './quote-lifecycle.js';
import { showAddNonSanmarModal } from './shopworks-import.js';
import { embState, SIZE06_EXTENDED_SIZES, sizeDetectionCache, productColorsCache, API_BASE } from './state.js';

export function updateLogoCardHeader(type, designNumber) {
    const cardId = type === 'garment' ? 'garment-logo-card' : 'cap-logo-card';
    const baseTitle = type === 'garment' ? 'Primary Logo' : 'Cap Front Logo';
    const card = document.getElementById(cardId);
    if (!card) return;
    const titleEl = card.querySelector('.logo-card-title');
    if (titleEl) {
        titleEl.textContent = designNumber
            ? `${baseTitle} — Design #${designNumber}`
            : baseTitle;
    }
    // Auto-collapse once a design # is set so the card stops crowding the line items below;
    // expand again if it's cleared so the rep can re-enter. The chevron (toggleLogoCard) still
    // lets them re-open it to tweak position / size / stitches. (Erik 2026-06-05)
    if (designNumber) card.classList.add('collapsed');
    else card.classList.remove('collapsed');
    renderOrderRecap();  // logo changed → refresh the bottom Order Recap
}

/**
 * Order Recap — read-only "order at a glance" (Customer / Ship-To / Logos) shown in the empty space
 * LEFT of the invoice totals, so the who/what/where isn't buried in the right rail. It only MIRRORS
 * the real fields (edits still happen there). Re-rendered from recalculatePricing + the customer/logo
 * handlers. Hidden (CSS .order-recap:empty) until there's something to show. (Erik 2026-06-05)
 */
// [2026-06-07] Native <input type="date"> uses YYYY-MM-DD; the rest of the app + the ShopWorks push use
// MM/DD/YYYY. Convert ONLY at the input boundary so nothing downstream (save, PDF, push) changes. Pure
// string ops — NO new Date() — so there is no UTC/timezone day-shift.
export function dateToInputValue(v) {            // any (ISO / YYYY-MM-DD / MM/DD/YYYY) → YYYY-MM-DD for the date input
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return '';
}
export function dateFromInputValue(v) {          // YYYY-MM-DD (or MM/DD/YYYY) → MM/DD/YYYY for storage / push / PDF
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    return '';
}

// [2026-06-08] Order-summary band (Order Recap + Ship-To card) EXTRACTED to the shared, selector-agnostic
// module shared_components/js/quote-order-summary.js (Phase 0 of the DTF/SCP parity). EMB configures it here;
// the module renders #order-recap + #ship-to-card byte-identically and aliases window.renderOrderRecap /
// renderShipToCard / reestimateShipFromCard, so every existing call site keeps working unchanged.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#shipping-fee', residential: '#ship-residential' },
        recap: {
            company: '#company-name', name: '#customer-name', custNum: '#customer-number', shippingDisplay: '#it-shipping-amt',
            // EMB-only: primaryLogo / capPrimaryLogo are module-scoped here, so the logos callback lives in EMB.
            logos: function () {
                var out = [];
                try {
                    if (typeof embState.primaryLogo !== 'undefined' && embState.primaryLogo && embState.primaryLogo.designNumber) {
                        var pos = document.getElementById('primary-position')?.value || '';
                        out.push({ text: '#' + embState.primaryLogo.designNumber + (pos ? ' · ' + pos : ''), thumbUrl: embState.primaryLogo.thumbnailUrl || '', label: '#' + embState.primaryLogo.designNumber });
                    }
                    if (typeof embState.capPrimaryLogo !== 'undefined' && embState.capPrimaryLogo && embState.capPrimaryLogo.designNumber) {
                        out.push({ text: 'Cap #' + embState.capPrimaryLogo.designNumber, thumbUrl: embState.capPrimaryLogo.thumbnailUrl || '', label: 'Cap #' + embState.capPrimaryLogo.designNumber });
                    }
                } catch (_) {}
                return out;
            }
        },
        estimate: function () { return QuoteOrderSummary.estimateShipping(); },
        reestimateOnclick: 'reestimateShipFromCard()',
        editOnclick: 'openShippingModal()',
        apiBase: API_BASE,
        // [2026-06-08] EMB DRY-rewire: EMB now uses the SHARED estimator (byte-identical copy in quote-order-summary.js);
        // estimateShipping() below is a thin delegate, perBoxForCategory removed. These hooks give the shared estimator
        // EMB's product source + post-apply recalc. (EMB keeps its own openShippingModal/closeShippingModal.)
        estimateHooks: {
            collectProducts: function () { return collectProductsFromTable(); },
            onApplied: function () { updateAdditionalCharges(); updateTaxCalculation(); },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// ============================================================
// DESIGN NUMBER LOOKUP / SEARCH — MOVED to builders/emb/design-search.js
// (roadmap 0.4 extraction #1, 2026-07-07). The builders/emb bundle
// re-exports the entry points onto window before DOMContentLoaded, so
// every call site below and every inline handler keeps working.
// ============================================================
export function setupPrimaryLogoHandlers() {
    // Position and tier dropdown handled by inline onchange handlers
    // (onPrimaryPositionChange, onPrimaryStitchTierChange)

    // Digitizing checkbox
    const digitizingCheckbox = document.getElementById('primary-digitizing');
    if (digitizingCheckbox) {
        digitizingCheckbox.addEventListener('change', function() {
            embState.primaryLogo.needsDigitizing = this.checked;
            recalculatePricing();
        });
    }
}

// (Per-logo card functions removed — AL is now managed via global toggle only)

// Update cap logo section visibility based on caps in quote
export function updateCapLogoSectionVisibility() {
    const hasCaps = document.querySelectorAll('tr[data-is-cap="true"]').length > 0;
    // Use new card element (2026 modernized UI)
    const capCard = document.getElementById('cap-logo-card');
    if (capCard) {
        capCard.style.display = hasCaps ? 'block' : 'none';
        // Update dropdown labels with API prices when showing cap section
        if (hasCaps) {
            updateEmbellishmentDropdownLabels();
        }
    }
    // Also update artwork services visibility
    updateArtworkServicesVisibility();
}

// Update garment logo section visibility based on garments in quote
export function updateGarmentLogoSectionVisibility() {
    const hasGarments = document.querySelectorAll('tr[data-is-cap="false"]').length > 0;
    const garmentCard = document.getElementById('garment-logo-card');
    if (garmentCard) {
        garmentCard.style.display = hasGarments ? 'block' : 'none';
    }
    // Also update artwork services visibility
    updateArtworkServicesVisibility();
}

// Update empty state row visibility based on products
export function updateArtworkServicesVisibility() {
    // Check for rows with data-is-cap attribute (indicates a valid product was added)
    const hasGarments = document.querySelectorAll('tr[data-is-cap="false"]').length > 0;
    const hasCaps = document.querySelectorAll('tr[data-is-cap="true"]').length > 0;
    const hasAnyProducts = hasGarments || hasCaps;
    // Artwork Services panel is now in sidebar (always visible)
    // Just update empty state row visibility
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) {
        emptyStateRow.style.display = hasAnyProducts ? 'none' : '';
    }
}

// Setup cap primary logo event handlers
export function setupCapPrimaryLogoHandlers() {
    // Tier dropdown handled by inline onchange handler (onCapStitchTierChange)
    const digitizingCheckbox = document.getElementById('cap-primary-digitizing');

    if (digitizingCheckbox) {
        digitizingCheckbox.addEventListener('change', function() {
            embState.capPrimaryLogo.needsDigitizing = this.checked;
            recalculatePricing();
        });
    }
}

// ============================================================
// PRODUCT SEARCH & AUTOCOMPLETE (Using ExactMatchSearch module)
// ============================================================

// Module instance - initialized in setupSearchAutocomplete
let exactMatchSearcher = null;

export function setupSearchAutocomplete() {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    if (!searchInput || !window.ExactMatchSearch) {
        console.error('[Embroidery] Search input or ExactMatchSearch module not found');
        return;
    }

    // Initialize ExactMatchSearch with full keyboard navigation
    exactMatchSearcher = new window.ExactMatchSearch({
        apiBase: API_BASE,
        debounceMs: 300,  // Standardized debounce

        // Auto-load exact matches immediately
        onExactMatch: (product) => {
            // Exact match found
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Show suggestions dropdown
        onSuggestions: (products) => {
            showSearchSuggestions(products);
        },

        // Keyboard navigation: update visual highlight
        onNavigate: (selectedIndex, _products) => {
            updateSearchSelectionHighlight(selectedIndex);
        },

        // Keyboard navigation: select item via Enter
        onSelect: (product) => {
            // Keyboard selected product
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

    // Search autocomplete initialized
}

/**
 * Show search suggestions dropdown
 */
function showSearchSuggestions(products) {
    const suggestions = document.getElementById('search-suggestions');

    if (!products || products.length === 0) {
        // Not a dead-end: offer the non-SanMar add path right here. The row-level
        // style input already had this; the TOP search just said "No products
        // found" and stranded the rep. (audit ux-flow 2026-06-10)
        const q = (document.getElementById('product-search')?.value || '').trim();
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): only escapeHtml(q) interpolations (nested-ternary shape the rule cannot parse)
        suggestions.innerHTML = `
            <div class="suggestion-item"><span>No SanMar products found${q ? ` for "${escapeHtml(q)}"` : ''}</span></div>
            ${q ? `<div class="suggestion-item suggestion-add-nonsanmar" onclick="addNonSanmarFromSearch()" style="cursor:pointer; color:#16a34a; font-weight:600;"><span><i class="fas fa-plus-circle"></i> Add "${escapeHtml(q)}" as a non-SanMar product…</span></div>` : ''}`;
        suggestions.classList.add('show');
        return;
    }

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): map rows escapeHtml every value (rule cannot trace map/join chains)
    suggestions.innerHTML = products.map(product => {
        // Extract product name (remove style prefix from label)
        const productName = (product.label || '').split(' - ').slice(1).join(' - ') || '';
        return `
            <div class="suggestion-item" onclick="selectProduct('${escapeHtml(product.value)}')">
                <span class="style">${escapeHtml(product.value)}</span>
                <span class="name">${escapeHtml(productName)}</span>
            </div>
        `;
    }).join('');
    suggestions.classList.add('show');

    // Cache product data (convert to expected format)
    products.forEach(p => {
        embState.productCache[p.value] = {
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

export async function selectProduct(styleNumber) {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    searchInput.value = '';
    suggestions.classList.remove('show');

    // Add product to table
    await addProductRow(styleNumber);

    // Mark as having unsaved changes
    markAsUnsaved();
}

// ============================================================
// PRODUCT TABLE MANAGEMENT
// ============================================================

export function addNewRow() {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++embState.rowCounter;

    // Hide empty state message when adding first row
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'new-row';
    row.dataset.rowId = rowId;

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): interpolations escapeHtml-wrapped or numeric at build
    row.innerHTML = `
        <td>
            <input type="text" class="cell-input style-input"
                   placeholder="Style #"
                   data-field="style"
                   onchange="onStyleChange(this, ${rowId})"
                   onkeydown="handleCellKeydown(event, this)">
        </td>
        <td class="thumbnail-col">
            <div class="product-thumbnail no-image qb-thumb-box" id="thumb-${rowId}"
                 title="Select a color to see product image"></div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <input type="text" class="cell-input desc-input"
                       placeholder="(auto)"
                       data-field="description"
                       readonly>
                <span class="cap-badge" id="cap-badge-${rowId}" style="display: none;">
                    <i class="fas fa-hat-cowboy"></i> Cap
                </span>
            </div>
            <div class="pricing-breakdown" id="breakdown-${rowId}"></div>
        </td>
        <td>
            <div class="color-picker-wrapper" data-row-id="${rowId}">
                <div class="color-picker-selected disabled" onclick="toggleColorPicker(${rowId})" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Garment color" onkeydown="handleColorPickerKeydown(event, ${rowId})">
                    <span class="color-swatch empty"></span>
                    <span class="color-name placeholder">Select color...</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" role="listbox" aria-label="Colors" id="color-dropdown-${rowId}"></div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" aria-label="Quantity S" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="M" aria-label="Quantity M" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="L" aria-label="Quantity L" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" aria-label="Quantity XL" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" aria-label="Quantity 2XL" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="text" class="cell-input size-input xxxl-picker-btn" data-size="3XL" aria-label="Quantity 3XL" value="" placeholder="+" readonly onclick="openExtendedSizePopup(${rowId})" onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}" disabled title="Click to add extended sizes (3XL, 4XL, 5XL, XS, etc.)"></td>
        <td class="cell-qty" id="row-qty-${rowId}">0</td>
        <td class="cell-price" id="row-price-${rowId}"
            ondblclick="enablePriceOverride(${rowId})"
            title="Double-click to override price">-</td>
        <td class="cell-total" id="row-total-${rowId}">-</td>
        <td class="cell-actions">
            <button class="btn-duplicate-row" onclick="duplicateRowNewColor(${rowId})" title="Add another color of this style" disabled>
                <i class="fas fa-copy"></i>
            </button>
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

    return rowId;
}

export async function addProductRow(styleNumber) {
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

/**
 * Top-search "no results" → route the typed style into a table row, which runs
 * the existing non-SanMar lookup (and its "Add to Non-SanMar database" button
 * when the style is brand-new). (audit ux-flow 2026-06-10)
 */
export async function addNonSanmarFromSearch() {
    const searchEl = document.getElementById('product-search');
    const q = (searchEl?.value || '').trim();
    if (!q) return;
    document.getElementById('search-suggestions')?.classList.remove('show');
    if (searchEl) searchEl.value = '';
    await addProductRow(q);
}
window.addNonSanmarFromSearch = addNonSanmarFromSearch;

/**
 * Create a service product row (DECG, DECC, AL, FB, CB, MONOGRAM, etc.)
 * These appear as line items in the product table, not as fee rows
 * @param {string} serviceType - Service code: DECG, DECC, AL, FB, CB, CS, MONOGRAM, AS-GARM, AS-CAP
 * @param {Object} data - Service data: { quantity, stitchCount, position, unitPrice, total, isCap }
 * @returns {HTMLElement} The created row element
 */
export function createServiceProductRow(serviceType, data) {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++embState.rowCounter;

    // Hide empty state message
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    // Service type metadata
    const SERVICE_META = {
        'DECG': { description: 'Customer-Supplied Garments', icon: 'fa-tshirt', isCap: false },
        'DECC': { description: 'Customer-Supplied Caps', icon: 'fa-hard-hat', isCap: true },
        'AL': { description: 'Additional Logo', icon: 'fa-plus-circle', isCap: false },
        'AL-CAP': { description: 'Additional Logo Cap', icon: 'fa-plus-circle', isCap: true },
        'FB': { description: 'Full Back Embroidery', icon: 'fa-expand', isCap: false },
        'DECG-FB': { description: 'Full Back Embroidery', icon: 'fa-expand', isCap: false },
        'CB': { description: 'Cap Back Embroidery', icon: 'fa-hat-cowboy', isCap: true },
        'CS': { description: 'Cap Side Embroidery', icon: 'fa-hat-cowboy', isCap: true },
        'Monogram': { description: 'Dir. Embroider Names on Garments', icon: 'fa-font', isCap: false },
        'MONOGRAM': { description: 'Names/Monograms', icon: 'fa-font', isCap: false },
        'Name/Number': { description: 'Name & Number', icon: 'fa-id-badge', isCap: false },
        'NAME': { description: 'Name & Number', icon: 'fa-id-badge', isCap: false }, // Legacy
        'WEIGHT': { description: 'Weight', icon: 'fa-weight-hanging', isCap: false },
        'SEG': { description: 'Sewing (Garment)', icon: 'fa-scissors', isCap: false },
        'SECC': { description: 'Sewing (Cap)', icon: 'fa-scissors', isCap: true },
        'DT': { description: 'Design Transfer', icon: 'fa-exchange-alt', isCap: false },
        'CTR-GARMT': { description: 'Contract (Garment)', icon: 'fa-file-contract', isCap: false },
        'CTR-CAP': { description: 'Contract (Cap)', icon: 'fa-file-contract', isCap: true },
        'AS-Garm': { description: 'Additional Stitches (Garment)', icon: 'fa-layer-group', isCap: false },
        'AS-GARM': { description: 'Additional Stitches (Garment)', icon: 'fa-layer-group', isCap: false },
        'AS-CAP': { description: 'Additional Stitches (Cap)', icon: 'fa-layer-group', isCap: true },
        '3D-EMB': { description: '3D Puff Embroidery', icon: 'fa-cube', isCap: true },
        'Laser Patch': { description: 'Laser Leatherette Patch', icon: 'fa-certificate', isCap: true },
        'GRT-50': { description: 'Logo Mockup & Print Review', icon: 'fa-palette', isCap: false },
        'GRT-75': { description: 'Graphic Design Services', icon: 'fa-pencil-ruler', isCap: false },
        'DD': { description: 'Digitizing Setup', icon: 'fa-cog', isCap: false },
        'RUSH': { description: 'Rush Charge', icon: 'fa-bolt', isCap: false },
        // Synthesized by _syncDecgLtmRow() when customer-supplied qty is under the
        // small-batch threshold; PN 'LTM' is proxy-registered (KNOWN_FEE_PNS) so it
        // pushes as a real ShopWorks line item. (expert audit 2026-07-07)
        'LTM': { description: 'Customer-Supplied Small-Batch Fee', icon: 'fa-exclamation-circle', isCap: false },
        // Extra thread colors from the design badge (addExtraColorSurchargeRow);
        // ShopWorks part 'Color Chg' verbatim (proxy KNOWN_FEE_PNS). (2026-07-07)
        'Color Chg': { description: 'Extra Thread Colors', icon: 'fa-palette', isCap: false }
    };

    const meta = SERVICE_META[serviceType] || { description: serviceType, icon: 'fa-cog', isCap: false };
    const isCap = data.isCap !== undefined ? data.isCap : meta.isCap;
    const quantity = data.quantity || 0;
    const unitPrice = data.unitPrice || 0;
    const total = data.total || (quantity * unitPrice);
    const stitchCount = data.stitchCount || 8000;
    const position = data.position || '';

    // Description with position info
    let displayDescription = meta.description;
    if (position) {
        displayDescription += `: ${position}`;
    }
    if (stitchCount && serviceType !== 'MONOGRAM' && serviceType !== 'Monogram' && serviceType !== 'Laser Patch' && serviceType !== '3D-EMB' && serviceType !== 'GRT-50' && serviceType !== 'GRT-75' && serviceType !== 'DD' && serviceType !== 'RUSH' && serviceType !== 'LTM' && serviceType !== 'Color Chg') {
        displayDescription += ` (${(stitchCount / 1000).toFixed(0)}K stitches)`;
    }

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'service-product-row';
    row.dataset.rowId = rowId;
    row.dataset.productType = 'service';
    row.dataset.serviceType = serviceType.toLowerCase();
    row.dataset.style = serviceType;
    row.dataset.isCap = isCap.toString();
    row.dataset.stitchCount = stitchCount.toString();
    row.dataset.position = position;
    row.dataset.unitPrice = unitPrice.toString();

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): internal service-type enums + numeric qty/rowId only
    row.innerHTML = `
        <td>
            <span class="service-style-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: ${isCap ? '#dbeafe' : '#fef3c7'}; color: ${isCap ? '#1e40af' : '#92400e'}; border-radius: 4px; font-weight: 600; font-size: 12px;">
                <i class="fas ${meta.icon}"></i>
                ${serviceType}
            </span>
        </td>
        <td class="thumbnail-col">
            <div class="service-icon" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: ${isCap ? '#eff6ff' : '#fffbeb'}; border-radius: 6px;">
                <i class="fas ${meta.icon}" style="font-size: 20px; color: ${isCap ? '#3b82f6' : '#f59e0b'};"></i>
            </div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <span class="service-description" style="font-size: 13px; color: #334155;">${escapeHtml(displayDescription)}</span>
                ${isCap ? '<span class="cap-badge" style="display: inline-flex;"><i class="fas fa-hat-cowboy"></i> Cap</span>' : ''}
            </div>
        </td>
        <td>
            <span style="color: #64748b; font-size: 12px;">N/A</span>
        </td>
        <td colspan="6" style="text-align: center; color: #94a3b8; font-size: 11px; font-style: italic;">
            Service item - no size breakdown
        </td>
        <td class="cell-qty">
            <input type="number" class="cell-input service-qty" min="0" max="9999" value="${quantity}"
                   onchange="onServiceQtyChange(${rowId})" onkeydown="handleCellKeydown(event, this)"
                   style="width: 60px; text-align: center;">
        </td>
        <td class="cell-price" id="row-price-${rowId}"
            ${['DECG', 'DECC'].includes(serviceType) ? `ondblclick="enablePriceOverride(${rowId})" title="Double-click to override price"` : ''}>$${unitPrice.toFixed(2)}</td>
        <td class="cell-total" id="row-total-${rowId}">$${total.toFixed(2)}</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="deleteServiceRow(${rowId})" title="Delete service">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert service rows after all regular product rows but before fee rows
    // Find the fees-tbody or append to product-tbody
    const feesTbody = document.getElementById('fees-tbody');
    if (feesTbody && feesTbody.previousElementSibling) {
        // Insert at end of product-tbody, just before fees-tbody
        tbody.appendChild(row);
    } else {
        tbody.appendChild(row);
    }

    return row;
}

// toggleServiceDropdown removed 2026-06-10 — zero callers; its #service-dropdown-menu
// target no longer exists (replaced by the Services bar).

/**
 * Add a manual service row (Monogram, Name/Number, WEIGHT)
 * Called from the Services bar
 */
export function addManualServiceRow(serviceType, priceOverride) {
    // Rush is a single, computed 25%-of-subtotal fee — never add a duplicate
    if (serviceType === 'RUSH' && document.querySelector('#product-tbody tr.service-product-row[data-service-type="rush"]')) {
        showToast('Rush Fee is already on the order', 'info');
        return;
    }

    // Default prices per service type
    const SERVICE_DEFAULTS = {
        'Monogram': { unitPrice: getServicePrice('Monogram', 12.50), quantity: 1 },
        'Name/Number': { unitPrice: getServicePrice('Name/Number', 15.00), quantity: 1 },
        'WEIGHT': { unitPrice: getServicePrice('WEIGHT', 6.25), quantity: 1 },
        'SEG': { unitPrice: getServicePrice('SEG', 10.00), quantity: 1 },
        'DT': { unitPrice: getServicePrice('DT', 50.00), quantity: 1 },
        'CTR-GARMT': { unitPrice: 0, quantity: 1 },
        'CTR-CAP': { unitPrice: 0, quantity: 1 },
        'GRT-50': { unitPrice: getServicePrice('GRT-50', 50), quantity: 1 },
        'GRT-75': { unitPrice: getServicePrice('GRT-75', 75), quantity: 1 },
        'DD': { unitPrice: getServicePrice('DD', 100), quantity: 1 },
        'RUSH': { unitPrice: 0, quantity: 1 }
    };

    const defaults = SERVICE_DEFAULTS[serviceType] || { unitPrice: 0, quantity: 1 };
    // Amount entered in the Services bar for variable-price items (Logo Mockup, Rush)
    const unitPrice = (priceOverride != null && !isNaN(priceOverride)) ? Number(priceOverride) : defaults.unitPrice;

    const row = createServiceProductRow(serviceType, {
        quantity: defaults.quantity,
        unitPrice: unitPrice,
        total: defaults.quantity * unitPrice,
        isCap: false
    });

    if (row) {
        if (serviceType === 'RUSH') {
            // Rush qty is fixed at 1; its price = 25% of subtotal (set live in syncRushRow)
            const q = row.querySelector('.service-qty');
            if (q) { q.value = '1'; q.readOnly = true; }
            markAsUnsaved();
            recalculatePricing();
            showToast('Rush Fee added — 25% of subtotal', 'success');
        } else if (serviceType === 'Monogram' || serviceType === 'Name/Number') {
            // Names capture (expert audit 2026-07-07 F6): "12 monograms" with no
            // names/sizes pairing is an unrunnable production order — the manual
            // path had no prompt, so quotes regularly went out without them.
            markAsUnsaved();
            recalculatePricing();
            openMonogramNamesDialog(row, serviceType);
        } else {
            // Focus the quantity input so user can immediately set count
            const qtyInput = row.querySelector('.service-qty');
            if (qtyInput) {
                setTimeout(() => {
                    qtyInput.focus();
                    qtyInput.select();
                }, 50);
            }
            markAsUnsaved();
            recalculatePricing();
            showToast(`${serviceType} service row added`, 'success');
        }
    }
}

/**
 * Add an Additional Logo line item from the Services bar.
 *   placement : 'Left Chest' | 'Right Sleeve' | 'Full Back' | 'Cap Front' | … (drives pricing path + prints on the line)
 *   stitches  : exact stitch count, e.g. 8000 / 11000 / 55000 (typed or from a Std/Mid/Large chip)
 * The per-piece price is LIVE from the API (EmbroideryPricingService.calculateALPrice —
 * tier-aware + per-1K stitch upcharge). syncALRows() computes/refreshes it on every
 * recalc, so the price tracks the quantity the rep types into the line. Multiples are
 * independent (each row carries its own stitch count + placement/pricing path).
 */
export async function addALLineItem(placement, stitches) {
    // Placement drives the pricing path: Full Back → flat per-1K full-back rate; any Cap
    // placement → cap AL rate; everything else → garment AL rate. The EXACT stitch count
    // (typed or preset chip) feeds calculateALPrice, so any value (11K, 55K, …) prices
    // correctly from the API — no coarse buckets.
    const CAP_PLACEMENTS = ['Cap Front', 'Cap Back', 'Cap Side'];
    let serviceType, priceItemType, isCap;
    if (placement === 'Full Back') {
        serviceType = 'DECG-FB'; priceItemType = 'fullback'; isCap = false;
    } else if (CAP_PLACEMENTS.includes(placement)) {
        serviceType = 'AL-CAP'; priceItemType = 'cap'; isCap = true;
    } else {
        serviceType = 'AL'; priceItemType = 'garment'; isCap = false;
    }
    let stitchCount = parseInt(stitches, 10);
    if (!stitchCount || stitchCount < 1) {
        stitchCount = priceItemType === 'cap' ? 5000 : (priceItemType === 'fullback' ? 25000 : 8000);
    }

    // Auto-tally: a 2nd logo goes on EVERY piece, so default the qty to the order's current
    // garment (or cap) count instead of 1 — reps no longer hand-count. Stays auto-synced to the
    // order total until the rep types a different qty. (Erik 2026-06-05)
    const counts = getOrderPieceCounts();
    const autoQty = (priceItemType === 'cap') ? counts.cap : counts.garment;

    const row = createServiceProductRow(serviceType, {
        quantity: autoQty > 0 ? autoQty : 1,
        unitPrice: 0,      // placeholder — set live by syncALRows()
        total: 0,
        isCap: isCap,
        stitchCount: stitchCount,
        position: placement   // prints on the line + carries to ShopWorks
    });
    if (!row) return;

    // Mark the row for live AL pricing; carry the pricing item type (garment/cap/fullback)
    row.dataset.alPriced = 'true';
    row.dataset.alItemType = priceItemType;
    row.dataset.alQtyAuto = 'true';   // qty tracks the order's piece count until the rep edits it

    // Focus the qty input so the rep can set the count immediately
    const qtyInput = row.querySelector('.service-qty');
    if (qtyInput) setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 50);

    markAsUnsaved();
    await syncALRows();     // pull the live per-piece price from the API (cached) for this row
    recalculatePricing();   // sum it into the totals
    showToast(autoQty > 0
        ? `Additional Logo (${placement}) — qty auto-set to ${autoQty} (all pieces). Adjust if needed.`
        : `Additional Logo (${placement}) added — set the quantity`, 'success');
}

/**
 * Add a Customer-Supplied (DECG / DECC) line item from the Services bar.
 *   itemType : 'garment' (part # DECG) | 'cap' (part # DECC)
 *   stitches : exact stitch count (typed or from a Std/Mid/Large chip)
 * The customer brings their OWN blanks (e.g. corporate buys jackets at Costco), so we charge
 * embroidery ONLY — no garment — at a MUCH higher per-piece rate because there is no garment
 * margin to absorb it. Price is LIVE from the API: EmbroideryPricingService.calculateDECGPrice
 * pulls the qty-tier base + per-1K stitch upcharge from /api/decg-pricing (Caspio Embroidery_Costs
 * DECG-Garmt / DECG-Cap tiers — garment vs cap chosen by itemType). syncDECGRows() refreshes the
 * price whenever the rep changes the quantity. NEVER guesses: API down → visible toast + $0
 * (Erik's #1 rule). The price cell stays double-click-overridable. (2026-06-04)
 */
export async function addDECGLineItem(itemType, stitches, heavyweight) {
    const serviceType = itemType === 'cap' ? 'DECC' : 'DECG';
    let stitchCount = parseInt(stitches, 10);
    if (!stitchCount || stitchCount < 1) stitchCount = 8000;

    const row = createServiceProductRow(serviceType, {
        quantity: 1,
        unitPrice: 0,      // placeholder — set live by syncDECGRows()
        total: 0,
        isCap: itemType === 'cap',
        stitchCount: stitchCount
    });
    if (!row) return;

    // Mark the row for live DECG pricing; carry the item type (garment/cap → tier table).
    row.dataset.decgPriced = 'true';
    row.dataset.decgItemType = itemType === 'cap' ? 'cap' : 'garment';
    row.dataset.decgHeavyweight = heavyweight ? 'true' : 'false';   // +$10/pc Carhartt/canvas/leather

    const qtyInput = row.querySelector('.service-qty');
    if (qtyInput) setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 50);

    markAsUnsaved();
    await syncDECGRows();    // pull the live per-piece price from the API (cached) for this row
    recalculatePricing();    // sum it into the totals
    showToast(`Customer-Supplied ${itemType === 'cap' ? 'Cap (DECC)' : 'Garment (DECG)'} added — set the quantity`, 'success');
}
window.addDECGLineItem = addDECGLineItem;

/**
 * Extra-thread-color surcharge row (expert audit 2026-07-07 F2). The design badge
 * has always WARNED "+N extra colors (+$X/pc)" and then billed nothing — the
 * system announced money it didn't collect. One click adds it as a service row
 * (pushes as ShopWorks part 'Color Chg'); the $/pc comes from the design record
 * (API-sourced), qty auto-tallies to the category piece count and stays editable.
 */
export function addExtraColorSurchargeRow(type, extraColors, perPiece) {
    perPiece = parseFloat(perPiece);
    if (!(perPiece > 0)) return;
    const existing = document.querySelector(`#product-tbody tr.service-product-row[data-extra-colors="${type}"]`);
    if (existing) {
        existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Extra-color surcharge is already on the quote — adjust its quantity there.', 'info');
        return;
    }
    const items = (typeof collectProductsFromTable === 'function') ? collectProductsFromTable() : [];
    const isCapType = type === 'cap';
    const autoQty = items.filter(p => !p.isService && (!!p.isCap === isCapType))
        .reduce((s, p) => s + (p.totalQuantity || 0), 0);
    const row = createServiceProductRow('Color Chg', {
        quantity: autoQty || 1,
        unitPrice: perPiece,
        total: (autoQty || 1) * perPiece,
        isCap: isCapType,
        position: `${extraColors} extra color${extraColors === 1 ? '' : 's'}`
    });
    if (!row) return;
    row.dataset.extraColors = type;
    markAsUnsaved();
    recalculatePricing();
    showToast(autoQty > 0
        ? `Extra-color surcharge added — qty auto-set to ${autoQty} (all ${type} pieces). Adjust if needed.`
        : 'Extra-color surcharge added — set the quantity', 'success');
}
window.addExtraColorSurchargeRow = addExtraColorSurchargeRow;

/**
 * Lightweight names dialog for Monogram / Name-Number rows (expert audit
 * 2026-07-07 F6). One name per line → the count auto-fills the row qty and the
 * list lands in Special Notes under the SAME '--- Names/Monograms ---' header the
 * ShopWorks-import path writes, so print/push/notes downstream already handle it.
 * Skippable — the rep can always type qty by hand like before.
 */
export function openMonogramNamesDialog(row, serviceType) {
    document.getElementById('monogram-names-dialog')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'monogram-names-dialog';
    wrap.className = 'monogram-names-dialog';
    wrap.innerHTML =
        '<div class="mnd-card" role="dialog" aria-modal="true" aria-labelledby="mnd-title">' +
        '  <div id="mnd-title" class="mnd-title"><i class="fas fa-font"></i> ' + escapeHtml(serviceType) + ' — who gets one?</div>' +
        '  <div class="mnd-hint">One name per line (add size/placement after a comma if needed, e.g. "Sarah M, L"). The line count becomes the quantity.</div>' +
        '  <textarea class="mnd-names" rows="6" placeholder="Sarah M&#10;John D, XL&#10;Riley P"></textarea>' +
        '  <div class="mnd-actions">' +
        '    <button type="button" class="mnd-skip">Skip — set qty by hand</button>' +
        '    <button type="button" class="mnd-apply">Add names</button>' +
        '  </div>' +
        '</div>';
    document.body.appendChild(wrap);
    const ta = wrap.querySelector('.mnd-names');
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); focusQty(); } };
    const focusQty = () => {
        const q = row.querySelector('.service-qty');
        if (q) { q.focus(); q.select(); }
    };
    wrap.querySelector('.mnd-skip').addEventListener('click', () => { close(); focusQty(); });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { close(); focusQty(); } });
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.mnd-apply').addEventListener('click', () => {
        const names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
        close();
        if (!names.length) { focusQty(); return; }
        const q = row.querySelector('.service-qty');
        if (q) {
            q.value = String(names.length);
            q.dispatchEvent(new Event('change', { bubbles: true }));   // reprices via onServiceQtyChange
        }
        const notesEl = document.getElementById('notes');
        if (notesEl) {
            notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') +
                '--- Names/Monograms ---\n' + names.join('\n');
            if (typeof updateNotesBadge === 'function') updateNotesBadge();
        }
        const desc = row.querySelector('.service-description');
        if (desc) desc.textContent = desc.textContent.replace(/: \d+ names$/, '') + `: ${names.length} names`;
        markAsUnsaved();
        recalculatePricing();
        showToast(`${names.length} name${names.length === 1 ? '' : 's'} captured — qty set to ${names.length}; list saved to Special Notes.`, 'success');
    });
    setTimeout(() => ta.focus(), 50);
}
window.openMonogramNamesDialog = openMonogramNamesDialog;

/**
 * Handle quantity change for service product rows
 */
export function onServiceQtyChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row || row.dataset.productType !== 'service') return;

    // Additional Logo: per-piece price is tier-based (changes with this row's quantity),
    // so re-price from the API first, then recalc. syncALRows updates this row's cells.
    if (row.dataset.alPriced === 'true') {
        row.dataset.alQtyAuto = 'false';   // rep set the qty by hand — stop auto-tallying to the order total
        syncALRows().then(() => recalculatePricing());
        markAsUnsaved();
        return;
    }

    // Customer-Supplied (DECG/DECC): per-piece price is tier-based (changes with this row's
    // quantity), so re-price from the API first, then recalc. syncDECGRows updates the cells.
    if (row.dataset.decgPriced === 'true') {
        syncDECGRows().then(() => recalculatePricing());
        markAsUnsaved();
        return;
    }

    const qtyInput = row.querySelector('.service-qty');
    const quantity = parseFloat(qtyInput?.value) || 0;  // parseFloat → Graphic Design hours can be fractional (e.g. 0.75)
    // Use sell price override if set, otherwise use original unit price
    const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
    const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);
    const total = quantity * unitPrice;

    // Update price cell with override indicator if applicable
    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (priceCell) {
        if (overridePrice > 0) {
            priceCell.classList.add('price-overridden');
            // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric unit price + rowId only
            priceCell.innerHTML = `<span class="price-override-wrapper">$${unitPrice.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${rowId})" title="Clear override">&times;</button></span>`;
        } else {
            priceCell.classList.remove('price-overridden');
            priceCell.textContent = `$${unitPrice.toFixed(2)}`;
        }
    }

    // Update total display
    const totalCell = document.getElementById(`row-total-${rowId}`);
    if (totalCell) totalCell.textContent = `$${total.toFixed(2)}`;

    // Trigger recalculation
    recalculatePricing();
    markAsUnsaved();
}

/**
 * Delete a service product row
 */
export function deleteServiceRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        row.remove();
        recalculatePricing();
        markAsUnsaved();
    }
}

export async function onStyleChange(input, rowId) {
    let styleNumber = input.value.trim().toUpperCase();
    if (!styleNumber) return;

    const row = document.getElementById(`row-${rowId}`);
    const descInput = row.querySelector('[data-field="description"]');
    // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
    const pickerWrapper = row.querySelector('.color-picker-wrapper');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    try {
        // Fetch product data using stylesearch API
        let product = embState.productCache[styleNumber];
        if (!product) {
            const response = await fetch(`${API_BASE}/api/stylesearch?term=${styleNumber}`);
            if (!response.ok) throw new Error(`Style search API returned ${response.status}`);
            const data = await response.json();
            if (data && data.length > 0) {
                // Find exact match or use first result
                const exactMatch = data.find(p => p.value.toUpperCase() === styleNumber);
                const result = exactMatch || data[0];
                product = {
                    STYLE: result.value,
                    PRODUCT_TITLE: result.label
                };
                embState.productCache[styleNumber] = product;
            }
        }

        // Generic fallback: if SanMar lookup failed and style has underscore,
        // strip the suffix and retry (handles pants sizes, fit variants, etc.)
        if (!product && styleNumber.includes('_')) {
            const baseStyle = styleNumber.substring(0, styleNumber.lastIndexOf('_'));
            if (baseStyle) {
                const retryResponse = await fetch(`${API_BASE}/api/stylesearch?term=${baseStyle}`);
                const retryData = await retryResponse.json();
                if (retryData && retryData.length > 0) {
                    const exactMatch = retryData.find(p => p.value.toUpperCase() === baseStyle);
                    const result = exactMatch || retryData[0];
                    product = {
                        STYLE: result.value,
                        PRODUCT_TITLE: result.label
                    };
                    embState.productCache[baseStyle] = product;
                    const strippedSuffix = styleNumber.substring(styleNumber.lastIndexOf('_'));
                    row.dataset.originalPartNumber = styleNumber;
                    input.value = baseStyle;
                    styleNumber = baseStyle;
                    showToast(`${row.dataset.originalPartNumber} → imported as ${baseStyle} (suffix ${strippedSuffix} stripped)`, 'info', 5000);
                }
            }
        }

        if (product) {
            // Pants products (PT20, etc.) are now supported via size picker popup
            // Size category detection will handle waist/inseam sizing

            // Clean product title (remove duplicate style numbers from API response)
            const cleanTitle = cleanProductTitle(product.PRODUCT_TITLE, styleNumber);

            // Update description with clean title
            descInput.value = cleanTitle || styleNumber;

            // Fetch colors using product-colors API (also returns CATEGORY_NAME) — cached per style
            let colorsData;
            if (productColorsCache.has(styleNumber)) {
                colorsData = productColorsCache.get(styleNumber);
            } else {
                const colorsResponse = await fetch(`${API_BASE}/api/product-colors?styleNumber=${styleNumber}`);
                if (!colorsResponse.ok) throw new Error(`Colors API returned ${colorsResponse.status}`);
                colorsData = await colorsResponse.json();
                productColorsCache.set(styleNumber, colorsData);
            }
            const colors = colorsData.colors || [];

            // Store product category from API
            const categoryName = colorsData.CATEGORY_NAME || '';
            row.dataset.category = categoryName;

            // Check for cap products using CATEGORY_NAME (definitive) or pattern matching (fallback)
            const isCap = isCapProduct(styleNumber, product.PRODUCT_TITLE, categoryName);
            const capBadge = document.getElementById(`cap-badge-${rowId}`);
            if (isCap) {
                row.dataset.isCap = 'true';
                if (capBadge) capBadge.style.display = 'inline-flex';
                showToast('Cap detected - using cap embroidery pricing', 'info', 3000);
            } else {
                row.dataset.isCap = 'false';
                if (capBadge) capBadge.style.display = 'none';
                // Warn about mixed orders when adding garments to laser-patch quote
                if (getCapEmbellishmentType() === 'laser-patch') {
                    showToast('Warning: Laser patch embellishment is for caps only. Garments will use standard embroidery pricing.', 'warning', 5000);
                }
            }

            // Reorder row: caps go below garments
            reorderRowByProductType(row);

            // Update logo section visibility based on product types
            updateCapLogoSectionVisibility();
            updateGarmentLogoSectionVisibility();

            if (colors && colors.length > 0) {
                // Populate custom color picker dropdown with swatches
                // eslint-disable-next-line no-unsanitized/property -- audited (1.4): COLOR_NAME/CATALOG_COLOR escapeHtml-wrapped; swatch via hardened getSwatchStyle (C32)
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

            // Enable "duplicate row" button now that style is loaded
            // (visual states live in quote-builder-common.css .btn-duplicate-row)
            const dupBtn = row.querySelector('.btn-duplicate-row');
            if (dupBtn) dupBtn.disabled = false;

        } else {
            // SanMar product not found — check Non-SanMar Products database
            try {
                const nsResponse = await fetch(`${API_BASE}/api/non-sanmar-products/style/${encodeURIComponent(styleNumber)}`);
                if (nsResponse.ok) {
                    const nsData = await nsResponse.json();
                    if (nsData.success && nsData.data) {
                        populateNonSanmarRow(row, rowId, nsData.data);
                        return;
                    }
                }
            } catch (nsErr) {
                console.warn('[onStyleChange] Non-SanMar lookup failed:', nsErr.message);
            }

            // Not in SanMar or Non-SanMar database — show "Not found" with Add button
            descInput.value = 'Not found';
            showToast(`Style ${styleNumber} not found — click "Add" to register it`, 'warning');

            // Store import data on the row for the Add modal
            row.dataset.style = styleNumber;
            row.dataset.notFound = 'true';

            // Add "Add Product" button below the description
            const descCell = descInput.closest('td') || descInput.parentElement;
            if (descCell && !descCell.querySelector('.btn-add-nonsanmar')) {
                const btnWrap = document.createElement('div');
                btnWrap.className = 'btn-add-nonsanmar-block';
                const addBtn = document.createElement('button');
                addBtn.className = 'btn-add-nonsanmar pulse';
                addBtn.title = 'Add to Non-SanMar database';
                addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Product';
                addBtn.onclick = () => showAddNonSanmarModal(rowId);
                btnWrap.appendChild(addBtn);
                descCell.appendChild(btnWrap);
                // Stop pulse animation after 5s
                setTimeout(() => addBtn.classList.remove('pulse'), 5000);
            }
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'error');
    }
}

// escapeHtml() is now provided by quote-builder-utils.js

/**
 * Populate a product row from Non_SanMar_Products data
 */
export function populateNonSanmarRow(row, rowId, product) {
    const descInput = row.querySelector('[data-field="description"]');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    // Set description and mark as non-SanMar
    descInput.value = product.ProductName || product.StyleNumber;
    row.dataset.nonSanmar = 'true';
    row.dataset.sellPrice = product.DefaultSellPrice || 0;
    row.dataset.style = product.StyleNumber;
    row.dataset.productName = product.ProductName || product.StyleNumber;

    // Remove any "Add" button if it existed
    const addBtn = row.querySelector('.btn-add-nonsanmar');
    if (addBtn) addBtn.remove();
    delete row.dataset.notFound;

    // Enable "duplicate row" button for non-SanMar products too
    // (visual states live in quote-builder-common.css .btn-duplicate-row)
    const dupBtn = row.querySelector('.btn-duplicate-row');
    if (dupBtn) dupBtn.disabled = false;

    // Detect cap vs garment
    const isCap = isCapProduct(product.StyleNumber, product.ProductName, product.Category || '');
    const capBadge = document.getElementById(`cap-badge-${rowId}`);
    if (isCap) {
        row.dataset.isCap = 'true';
        if (capBadge) capBadge.style.display = 'inline-flex';
        showToast('Non-SanMar cap detected — using sell price override', 'info', 3000);
    } else {
        row.dataset.isCap = 'false';
        if (capBadge) capBadge.style.display = 'none';
    }

    // Reorder and update section visibility
    reorderRowByProductType(row);
    updateCapLogoSectionVisibility();
    updateGarmentLogoSectionVisibility();

    // Populate color dropdown from DefaultColors (comma-separated text)
    const defaultColors = (product.DefaultColors || '').split(',').map(c => c.trim()).filter(Boolean);
    if (defaultColors.length > 0 && pickerDropdown) {
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): COLOR_NAME/CATALOG_COLOR escapeHtml-wrapped; swatch via hardened getSwatchStyle (C32)
        pickerDropdown.innerHTML = defaultColors.map(color => `
            <div class="color-picker-option"
                 data-color-name="${escapeHtml(color)}"
                 data-catalog-color="${escapeHtml(color)}"
                 data-swatch-url=""
                 data-hex="#ccc"
                 data-image-url=""
                 onclick="selectNonSanmarColor(${rowId}, this)">
                <span class="color-swatch" style="background-color: #ccc;"></span>
                <span class="color-name">${escapeHtml(color)}</span>
            </div>
        `).join('');

        pickerSelected.classList.remove('disabled');
        row.dataset.colors = JSON.stringify(defaultColors.map(c => ({ COLOR_NAME: c, CATALOG_COLOR: c })));
    }

    // Enable size inputs based on product type
    if (isCap) {
        setNonSanmarCapSizes(row, rowId, product.AvailableSizes);
    } else {
        setNonSanmarGarmentSizes(row, rowId, product.AvailableSizes);
    }

    // Add non-SanMar badge to style cell
    const styleCell = row.querySelector('.style-input')?.closest('td');
    if (styleCell && !styleCell.querySelector('.non-sanmar-badge')) {
        const badge = document.createElement('span');
        badge.className = 'non-sanmar-badge';
        badge.textContent = 'Custom';
        badge.title = 'Non-SanMar product — sell price override';
        styleCell.appendChild(badge);
    }

    // Remove any btn-add-nonsanmar-block wrapper too
    const addBtnBlock = row.querySelector('.btn-add-nonsanmar-block');
    if (addBtnBlock) addBtnBlock.remove();

    // Add pencil icon to price cell for inline editing
    updateNonSanmarPriceCell(row, rowId);
}

/**
 * Update the price cell display for non-SanMar rows with pencil edit affordance.
 * Shows pencil icon for priced items, warning icon for $0 items.
 */
export function updateNonSanmarPriceCell(row, rowId) {
    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (!priceCell) return;

    const sellPrice = parseFloat(row.dataset.sellPrice) || 0;
    if (sellPrice > 0) {
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric price + rowId only
        priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${rowId})" title="Click to edit price">$${sellPrice.toFixed(2)} <i class="fas fa-pencil-alt"></i></span>`;
        priceCell.classList.remove('ns-price-zero');
    } else {
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric price + rowId only
        priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${rowId})" title="Click to set price">$0.00 &#9888; <i class="fas fa-pencil-alt"></i></span>`;
        priceCell.classList.add('ns-price-zero');
        row.classList.add('price-warning');
    }
}

/**
 * Select color for non-SanMar product (simpler than SanMar — no swatch images)
 */
export function selectNonSanmarColor(rowId, optionEl) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;

    // Update selected display
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');
    swatch.style.backgroundImage = '';
    swatch.style.backgroundColor = '#ccc';
    swatch.classList.remove('empty');
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected
    row.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');
    // 7.2 a11y: mirror the selection into aria-selected
    optionEl.setAttribute('aria-selected', 'true');
    if (optionEl.parentElement) {
        optionEl.parentElement.querySelectorAll('.color-picker-option').forEach((o) => { if (o !== optionEl) o.setAttribute('aria-selected', 'false'); });
    }

    // Store on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = colorName;

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Enable size inputs (non-SanMar skips detectAndAdjustSizeUI API call)
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // For caps, keep only OSFA enabled
    if (row.dataset.isCap === 'true') {
        setNonSanmarCapSizes(row, rowId, row.dataset.availableSizes || 'OSFA');
    }

    // Focus first size input
    const firstSize = row.querySelector('.size-input:not([disabled])');
    if (firstSize) firstSize.focus();

    // Cascade to child rows
    cascadeColorToChildRows(rowId, colorName, colorName, '', '#ccc');
    recalculatePricing();
}

/**
 * Set cap sizes for non-SanMar products (default: OSFA only)
 */
function setNonSanmarCapSizes(row, rowId, availableSizes) {
    const sizes = (availableSizes || 'OSFA').split(',').map(s => s.trim().toUpperCase());
    row.dataset.availableSizes = sizes.join(',');

    // Disable all size inputs first
    row.querySelectorAll('.size-input').forEach(input => input.disabled = true);

    // Enable only the available sizes
    sizes.forEach(size => {
        const input = row.querySelector(`[data-size="${size}"]`);
        if (input) input.disabled = false;
    });
}

/**
 * Set garment sizes for non-SanMar products (default: S-3XL)
 */
function setNonSanmarGarmentSizes(row, rowId, availableSizes) {
    const defaultSizes = 'S,M,L,XL,2XL,3XL';
    const sizes = (availableSizes || defaultSizes).split(',').map(s => s.trim().toUpperCase());
    row.dataset.availableSizes = sizes.join(',');

    // Enable standard sizes
    row.querySelectorAll('.size-input').forEach(input => {
        const size = input.dataset.size;
        input.disabled = !sizes.includes(size);
    });
}

/**
 * Parse ShopWorks description to extract brand, product name, color, and category
 * Patterns:
 *   "Kitchen Skull Cap: Edwards, Black" → Brand: Edwards, Name: Kitchen Skull Cap, Color: Black
 *   "Port Authority Soft Brushed Canvas Cap" → Brand: Port Authority, Name: rest
 */
export function parseShopWorksDescription(description, _partNumber) {
    const result = { brand: '', name: '', color: '', category: '' };
    if (!description) return result;

    const desc = description.trim();

    // Pattern 1: "ProductName: Brand, Color" (colon format)
    const colonMatch = desc.match(/^(.+?):\s*(.+?)(?:,\s*(.+))?$/);
    if (colonMatch) {
        result.name = colonMatch[1].trim();
        result.brand = colonMatch[2].trim();
        result.color = (colonMatch[3] || '').trim();
    } else {
        // Pattern 2: Known brand prefix
        const knownBrands = ['Port Authority', 'Port & Company', 'Sport-Tek', 'CornerStone',
            'The North Face', 'Nike', 'Carhartt', 'Brooks Brothers', 'TravisMathew',
            'Under Armour', 'New Era', 'OGIO', 'Red House', 'Mercer+Mettle',
            'Edwards', 'Richardson', 'Outdoor Cap', 'Pacific Headwear'];

        let matched = false;
        for (const brand of knownBrands) {
            if (desc.toLowerCase().startsWith(brand.toLowerCase())) {
                result.brand = brand;
                const rest = desc.substring(brand.length).replace(/^\s+/, '');
                // Check for trailing color after comma
                const commaIdx = rest.lastIndexOf(',');
                if (commaIdx > 0) {
                    result.name = rest.substring(0, commaIdx).trim();
                    result.color = rest.substring(commaIdx + 1).trim();
                } else {
                    result.name = rest;
                }
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Fallback: check for trailing color after last comma
            const commaIdx = desc.lastIndexOf(',');
            if (commaIdx > 0) {
                result.name = desc.substring(0, commaIdx).trim();
                const possibleColor = desc.substring(commaIdx + 1).trim();
                if (isCommonColor(possibleColor)) {
                    result.color = possibleColor;
                } else {
                    result.name = desc; // Not a color, keep full desc
                }
            } else {
                result.name = desc;
            }
        }
    }

    // Category detection from keywords
    const combined = `${result.name} ${desc}`.toLowerCase();
    if (/\b(cap|hat|beanie|visor|snapback|trucker|headwear|skull cap)\b/.test(combined)) {
        result.category = 'Caps';
    } else if (/\b(tee|t-shirt|tshirt)\b/.test(combined)) {
        result.category = 'T-Shirts';
    } else if (/\b(polo|pique)\b/.test(combined)) {
        result.category = 'Polos/Knits';
    } else if (/\b(jacket|coat|parka|outerwear)\b/.test(combined)) {
        result.category = 'Outerwear';
    } else if (/\b(fleece|hoodie|hooded|sweatshirt|pullover)\b/.test(combined)) {
        result.category = 'Fleece';
    } else if (/\b(button|dress shirt|oxford|woven)\b/.test(combined)) {
        result.category = 'Woven Shirts';
    }

    return result;
}

/**
 * Check if a string is a common garment color name
 */
function isCommonColor(str) {
    const colors = ['black', 'white', 'navy', 'royal', 'red', 'grey', 'gray', 'charcoal',
        'khaki', 'tan', 'brown', 'green', 'olive', 'blue', 'pink', 'purple', 'orange',
        'yellow', 'teal', 'burgundy', 'maroon', 'cream', 'ivory', 'silver', 'gold',
        'heather', 'camo', 'natural', 'stone', 'steel', 'slate', 'smoke', 'iron'];
    return colors.some(c => str.toLowerCase().includes(c));
}

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
export function buildPricingBreakdown(product, lineItem, logoConfig) {
    if (!lineItem) return '';

    const isCap = product?.isCap || false;
    const logoPos = logoConfig?.position || (isCap ? 'CF' : 'Left Chest');
    const stitchCount = logoConfig?.stitchCount || 8000;
    const stitchK = Math.round(stitchCount / 1000);

    // Check if this is a cap with laser-patch embellishment
    const capEmbellishment = isCap ? getCapEmbellishmentType() : null;
    const isLaserPatch = isCap && capEmbellishment === 'laser-patch';

    // Get abbreviated position name
    const posAbbrev = POSITION_ABBREV[logoPos] || logoPos.substring(0, 2).toUpperCase();
    const posFullName = POSITION_FULL_NAMES[posAbbrev] || logoPos;

    const basePrice = lineItem.basePrice || 0;
    const extraStitchCost = lineItem.extraStitchCost || 0;
    const alCost = lineItem.alCost || 0;
    const unitPrice = lineItem.unitPrice || 0;

    // Calculate extra stitches for tooltip
    const baseStitches = isCap ? 8000 : 8000;
    const extraK = stitchCount > baseStitches ? Math.round((stitchCount - baseStitches) / 1000) : 0;
    const rate = isCap ? 1.00 : 1.25;

    // Build tooltip text with full formula (&#10; = newline in title attribute)
    let tooltipParts = [];
    if (isLaserPatch) {
        // Laser patch tooltip - no stitches
        tooltipParts = [`Type: Laser Leatherette Patch`, `Position: Cap Front`];
    } else {
        tooltipParts = [`Position: ${posFullName}`, `Stitches: ${stitchCount.toLocaleString()}`];
    }
    tooltipParts.push(`Base: $${basePrice.toFixed(2)}`);
    if (extraStitchCost > 0 && !isLaserPatch) {
        tooltipParts.push(`Extra: ${extraK}K × $${rate.toFixed(2)} = $${extraStitchCost.toFixed(2)}`);
    }
    if (alCost > 0) {
        tooltipParts.push(`AL: $${alCost.toFixed(2)}`);
    }
    tooltipParts.push(`Unit: $${unitPrice.toFixed(2)}`);
    const tooltipText = tooltipParts.join('&#10;');

    // Build visible breakdown with compact format
    let html = `<span class="breakdown-wrapper" title="${tooltipText}">`;
    html += `<span class="breakdown-icon">└─</span>`;
    // For laser patches, show "Laser Patch" instead of stitch count
    if (isLaserPatch) {
        html += `<span class="breakdown-pos">Laser Patch</span>`;
    } else {
        html += `<span class="breakdown-pos">${posAbbrev} ${stitchK}K</span>`;
    }

    // CHANGED 2026-01-14: Show BASE price only (extra stitches and AL are separate sidebar line items)
    // Show base price with optional upcharge note
    if (lineItem.hasUpcharge && lineItem.upcharge > 0) {
        // Extended size with upcharge - show breakdown
        html += ` <span class="breakdown-sep">|</span> `;
        html += `<span class="breakdown-base">Base $${formatPrice(basePrice - lineItem.upcharge)} + Upcharge $${formatPrice(lineItem.upcharge)}</span>`;
        html += ` <span class="breakdown-eq">=</span> `;
        html += `<span class="breakdown-total">$${formatPrice(basePrice)}/ea</span>`;
    } else {
        // Standard size - just show base price
        html += ` <span class="breakdown-sep">|</span> <span class="breakdown-total">$${formatPrice(basePrice)}/ea</span>`;
    }

    html += `</span>`;
    return html;
}

/**
 * Update the pricing breakdown display for a product row
 * @param {number} rowId - Row ID
 * @param {Object} product - Product data
 * @param {Object} lineItem - Line item from pricing calculator
 * @param {Object} logoConfig - Logo configuration
 */
export function updateRowBreakdown(rowId, product, lineItem, logoConfig) {
    const breakdownEl = document.getElementById(`breakdown-${rowId}`);
    if (!breakdownEl) return;

    const breakdownHtml = buildPricingBreakdown(product, lineItem, logoConfig);
    if (breakdownHtml) {
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): formatPrice output + internal position labels + numerics only
        breakdownEl.innerHTML = breakdownHtml;
        breakdownEl.classList.add('visible');
    } else {
        breakdownEl.innerHTML = '';
        breakdownEl.classList.remove('visible');
    }
}

/**
 * Check if a style number is a cap/hat product
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @param {string} categoryName - CATEGORY_NAME from SanMar API (most reliable)
 * @returns {boolean} True if cap/hat
 */
export function isCapProduct(style, productTitle = '', categoryName = '') {
    // PRIORITY: Flat headwear (beanies, knit caps) use garment pricing, NOT cap pricing
    // Matches ProductCategoryFilter used by calculator pages
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

    // Check title keywords — but first strip DECG/service prefixes so
    // "Di. Embroider Cap - T-shirt" doesn't match on "Cap" in the prefix
    const strippedTitle = titleUpper.replace(/^DI\.\s*EMBROIDER\s+(CAP|GARMENT)\s*-\s*/i, '');
    if (strippedTitle.includes('CAP') || strippedTitle.includes('HAT') ||
        strippedTitle.includes('BEANIE') || strippedTitle.includes('SNAPBACK') ||
        strippedTitle.includes('TRUCKER') || strippedTitle.includes('RICHARDSON')) {
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
// eslint-disable-next-line no-unused-vars -- kept with its cluster: size-category taxonomy helper, no live callers after the 2026-06 remap (candidate cleanup)
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
// D4 split (2026-07-09): pants/shorts picker-row configs moved VERBATIM out of
// updateRowForSizeCategory (SCP-twin cut; each early-returned).
function _configurePantsRow(row, sizeInfo, sizeInputs, xxxlCell) {
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
}

function _configureShortsRow(row, sizeInfo, sizeInputs, xxxlCell) {
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
}

function updateRowForSizeCategory(row, sizeInfo) {
    const rowId = row.dataset.rowId;
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Store category info for later use
    row.dataset.sizeCategory = sizeInfo.category;
    row.dataset.baseSize = sizeInfo.baseSize || '';

    if (sizeInfo.category === 'pants') { _configurePantsRow(row, sizeInfo, sizeInputs, xxxlCell); return; }
    if (sizeInfo.category === 'shorts') { _configureShortsRow(row, sizeInfo, sizeInputs, xxxlCell); return; }

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
        sizeInputs.forEach((input, _index) => {
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
export async function detectAndAdjustSizeUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const styleNumber = row.dataset.style;
     
    const catalogColor = row.dataset.catalogColor;

    if (!styleNumber || !catalogColor) return;

    // Stale guard: if the rep changes style/color while a lookup is in flight, the
    // older response must NOT overwrite the newer row state. Checked after each await.
    const isStale = () => row.dataset.style !== styleNumber || row.dataset.catalogColor !== catalogColor;

    // =========================================
    // CAP SPECIAL HANDLING
    // Caps use /api/sizes-by-style-color endpoint
    // =========================================
    if (row.dataset.isCap === 'true') {
        try {
            const capCacheKey = `cap-${styleNumber}-${catalogColor}`;
            if (sizeDetectionCache.has(capCacheKey)) {
                const cached = sizeDetectionCache.get(capCacheKey);
                const sizeInfo = analyzeSizeCategory(cached);
                updateRowForSizeCategory(row, sizeInfo);
                row.dataset.availableSizes = JSON.stringify(cached);
                row.dataset.capSizes = JSON.stringify(cached);
                return;
            }

            const capUrl = `${API_BASE}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
            const capResponse = await fetch(capUrl);
            if (isStale()) return;

            let capSizes = ['OSFA']; // Default fallback
            if (capResponse.ok) {
                const capData = await capResponse.json();
                const sizes = capData.data || capData.sizes || capData;
                if (Array.isArray(sizes) && sizes.length > 0) {
                    capSizes = sizes;
                }
            } else {
                console.warn(`[Cap Sizes] API failed for ${styleNumber}, using OSFA fallback`);
                showToast(`Cap sizes unavailable for ${styleNumber}, defaulting to OSFA`, 'warning');
            }


            // Cache and update UI
            sizeDetectionCache.set(capCacheKey, capSizes);
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
    const garmentCacheKey = `garment-${styleNumber}-${catalogColor}`;
    if (sizeDetectionCache.has(garmentCacheKey)) {
        const cached = sizeDetectionCache.get(garmentCacheKey);
        const sizeInfo = analyzeSizeCategory(cached);
        updateRowForSizeCategory(row, sizeInfo);
        row.dataset.availableSizes = JSON.stringify(cached);
        validateSizeAvailability(row, cached);
        return;
    }

    try {
        // Fetch all available sizes for this style+color
        const url = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
        const response = await fetch(url);
        if (isStale()) return;

        if (!response.ok) {
            console.error(`[Size Detection] API failed for ${styleNumber}:`);
            console.error(`  Status: ${response.status} ${response.statusText}`);
            console.error(`  URL: ${url}`);
            console.error(`  CatalogColor: ${catalogColor}`);

            // Try fallback: fetch without color filter to at least get size info
            try {
                const altUrl = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}`;
                const altResponse = await fetch(altUrl);
                if (isStale()) return;

                if (altResponse.ok) {
                    const skus = await altResponse.json();
                    if (skus && skus.length > 0) {
                        const allSizes = extractAllSizes(skus);
                        const sizeInfo = analyzeSizeCategory(allSizes);
                        updateRowForSizeCategory(row, sizeInfo);
                        row.dataset.availableSizes = JSON.stringify(allSizes);
                        showToast(`Size check for ${styleNumber} used style-level data (color lookup failed) — some sizes may not exist in ${row.dataset.color || 'this color'}.`, 'warning', 6000);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('[Size Detection] Fallback also failed:', fallbackError);
            }
            // Both lookups failed — the row keeps the default S–XL+extended grid, which may
            // not map to real SKUs for this product. Say so (Erik's #1 rule: never silent).
            showToast(`Couldn't verify available sizes for ${styleNumber} — using the standard size grid. Double-check sizes before saving.`, 'warning', 7000);
            return;
        }

        const skus = await response.json();

        // Extract ALL available sizes (not just Size06)
        const allSizes = extractAllSizes(skus);

        // Cache for future use (same style+color won't re-fetch)
        sizeDetectionCache.set(garmentCacheKey, allSizes);

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
    // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
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
export function toggleColorPicker(rowId) {
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

    // 7.2 a11y: listbox semantics. Options are populated dynamically, so stamp
    // role/id/aria-selected lazily on open; keep aria-expanded truthful.
    const nowOpen = !dropdown.classList.contains('hidden');
    pickerSelected.setAttribute('aria-expanded', String(nowOpen));
    if (nowOpen) {
        dropdown.querySelectorAll('.color-picker-option').forEach((opt, oi) => {
            opt.setAttribute('role', 'option');
            if (!opt.id) opt.id = `${dropdown.id || 'color-dropdown'}-opt-${oi}`;
            opt.setAttribute('aria-selected', String(opt.classList.contains('selected')));
        });
    } else {
        pickerSelected.removeAttribute('aria-activedescendant');
    }

    // Scroll selected option into view if open
    if (!dropdown.classList.contains('hidden')) {
        const selectedOption = dropdown.querySelector('.color-picker-option.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }
}

/**
 * Select a color from the dropdown
 */
export function selectColor(rowId, optionEl, skipDuplicateCheck) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;
    const imageUrl = optionEl.dataset.imageUrl;
    const style = row.dataset.style;

    // Check for duplicate row (same style + color) — skip during import where same style+color at different prices is legitimate
    if (!skipDuplicateCheck) {
        const existingRow = findExistingRow(style, catalogColor, rowId);
        if (existingRow) {
            showToast(`${style} in ${colorName} already exists. Adding to existing row.`, 'info');
            row.querySelector('.color-picker-dropdown').classList.add('hidden');
            const existingFirstSize = existingRow.querySelector('.size-input:not([disabled])');
            if (existingFirstSize) existingFirstSize.focus();
            return;
        }
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
    // 7.2 a11y: mirror the selection into aria-selected
    optionEl.setAttribute('aria-selected', 'true');
    if (optionEl.parentElement) {
        optionEl.parentElement.querySelectorAll('.color-picker-option').forEach((o) => { if (o !== optionEl) o.setAttribute('aria-selected', 'false'); });
    }

    // Clear manual price override when color changes (new color = different product cost)
    if (row.dataset.nonSanmar !== 'true' && row.dataset.sellPrice) {
        delete row.dataset.sellPrice;
    }

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

    // Phase 10.1 (2026-05-23) — fire SanMar inventory check + render badges
    // next to each size input. Uses shared InventoryBadges wrapper.
    // Graceful: silently no-ops if scripts missing or non-SanMar product.
    if (window.InventoryBadges && typeof window.InventoryBadges.attach === 'function'
        && catalogColor && row.dataset.nonSanmar !== 'true') {
        window.InventoryBadges.attach(row, {
            style: style,
            catalogColor: catalogColor,
            sizeCellSelector: 'input.size-input',
        });
    }

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
    if (!embState.childRowMap[parentRowId]) return;

    Object.values(embState.childRowMap[parentRowId]).forEach(childRowId => {
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
export function handleColorPickerKeydown(event, rowId) {
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
    // 7.2 a11y: point the combobox at the visually-focused option
    const navTrigger = dropdown.closest('.color-picker-wrapper') && dropdown.closest('.color-picker-wrapper').querySelector('.color-picker-selected');
    if (navTrigger && options[newIndex].id) navTrigger.setAttribute('aria-activedescendant', options[newIndex].id);
    options[newIndex].scrollIntoView({ block: 'nearest' });
}

// Click outside handler to close all dropdowns
document.addEventListener('click', function(e) {
    if (!e.target.closest('.color-picker-wrapper')) {
        document.querySelectorAll('.color-picker-dropdown').forEach(d => d.classList.add('hidden'));
        document.querySelectorAll('.color-picker-selected[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    }
});

/**
 * Select a color for a child row (extended size)
 * Similar to selectColor but marks color as manually set
 */
export function selectChildColor(childRowId, parentRowId, optionEl) {
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
    // 7.2 a11y: mirror the selection into aria-selected
    optionEl.setAttribute('aria-selected', 'true');
    if (optionEl.parentElement) {
        optionEl.parentElement.querySelectorAll('.color-picker-option').forEach((o) => { if (o !== optionEl) o.setAttribute('aria-selected', 'false'); });
    }

    // Store data on row
    childRow.dataset.color = colorName;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.swatchUrl = swatchUrl || '';
    childRow.dataset.hex = hex || '';
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually changed

    // Clear per-size price override on color change (new color = new product cost)
    delete childRow.dataset.sellPrice;

    // Close dropdown
    childRow.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Update visual indicator for different color
    updateChildRowColorIndicators(parentRowId);

    recalculatePricing();
}

/**
 * Update visual styling for child rows based on color match with parent
 */
function updateChildRowColorIndicators(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const parentCatalogColor = parentRow.dataset.catalogColor;

    if (embState.childRowMap[parentRowId]) {
        Object.values(embState.childRowMap[parentRowId]).forEach(childRowId => {
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

export function onSizeChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Mark as having unsaved changes
    markAsUnsaved();

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

    // IMPORTANT: Handle 2XL/XXL child row FIRST (before quantity calculation)
    // This ensures the 2XL input is disabled before we sum enabled inputs,
    // preventing the 2XL value from being counted twice (in parent AND child)
    // Bug fix: 2026-01-14 - Parent row showed 16 instead of 14 for S/M/L/XL
    const xxlInput = row.querySelector('[data-size="2XL"]');
    if (xxlInput) {
        const qty = parseInt(xxlInput.value) || 0;
        // Check for both 2XL and XXL child rows (XXL is distinct for Ladies/Womens products)
        const existingChildId = embState.childRowMap[rowId]?.['2XL'] || embState.childRowMap[rowId]?.['XXL'];
        const existingChildSize = embState.childRowMap[rowId]?.['2XL'] ? '2XL' : (embState.childRowMap[rowId]?.['XXL'] ? 'XXL' : '2XL');

        if (qty > 0) {
            // Need a child row for 2XL (or XXL if that's what exists)
            if (existingChildId) {
                updateChildRow(existingChildId, qty);
            } else {
                createChildRow(rowId, '2XL', qty);
            }
            // Disable the 2XL input in parent BEFORE quantity calculation
            xxlInput.disabled = true;
            xxlInput.value = '';  // Clear to prevent visual confusion
            xxlInput.style.background = '#f5f5f5';
            xxlInput.style.color = '#999';
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

    // Update parent row quantity display
    // Shows standard sizes total when > 0, or child row total for variant-only products
    // Bug fix 2026-01-14: Standard total excludes disabled 2XL (counted in child row)
    // Enhancement 2026-02-06: Variant-only products show child total instead of "0"
    updateParentQtyDisplay(rowId);

    // Recalculate pricing
    recalculatePricing();
}

/**
 * Update parent row Qty display.
 * Shows standard size total when > 0, otherwise shows sum of child row quantities.
 * DISPLAY-ONLY: collectProductsFromTable(), pricing engine, save/load, and
 * ShopWorks Entry Guide all read size inputs and child .qty-display directly,
 * never this cell. Safe to update without affecting data.
 */
function updateParentQtyDisplay(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    if (row.classList.contains('child-row')) return;
    if (row.dataset.isOsfaOnly === 'true') return; // OSFA-only already handled directly

    let standardTotal = 0;
    row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
        standardTotal += parseInt(input.value) || 0;
    });

    if (standardTotal > 0) {
        // Normal case: parent has standard sizes, show their total
        document.getElementById(`row-qty-${rowId}`).textContent = standardTotal;
    } else {
        // Variant-only: show child row total so parent doesn't display "0"
        let childTotal = 0;
        if (embState.childRowMap[rowId]) {
            Object.values(embState.childRowMap[rowId]).forEach(childRowId => {
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const qtyDisplay = childRow.querySelector('.qty-display');
                    childTotal += parseInt(qtyDisplay?.textContent) || 0;
                }
            });
        }
        document.getElementById(`row-qty-${rowId}`).textContent = childTotal;
    }
}

/**
 * Post-import: Hide parent rows that have zero standard sizes (variant-only).
 * Promotes child rows to look like normal product rows (standalone-child class).
 * Called once after all products are imported in confirmShopWorksImport().
 */
export function hideVariantOnlyParents() {
    const tbody = document.getElementById('product-tbody');
    if (!tbody) return;

    const parentRows = tbody.querySelectorAll('tr:not(.child-row):not(.service-product-row)');
    parentRows.forEach(parentRow => {
        const rowId = parseInt(parentRow.dataset.rowId);
        if (!rowId || !embState.childRowMap[rowId]) return;
        if (parentRow.dataset.isOsfaOnly === 'true') return;

        // Check if ALL standard size inputs are empty/zero
        let standardTotal = 0;
        parentRow.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            standardTotal += parseInt(input.value) || 0;
        });

        if (standardTotal > 0) return; // Has standard sizes — keep parent visible

        // This is a variant-only parent — hide it and promote children
        parentRow.classList.add('variant-only-parent');
        parentRow.dataset.variantOnlyHidden = 'true';

        // Promote each child row to standalone
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            childRow.classList.add('standalone-child');

            // Copy thumbnail from parent to child
            const parentThumbCell = parentRow.querySelector('.thumbnail-col');
            const childThumbCell = childRow.querySelector('.thumbnail-col');
            if (parentThumbCell && childThumbCell && parentThumbCell.innerHTML.trim()) {
                // eslint-disable-next-line no-unsanitized/property -- copy of already-rendered sibling DOM
                childThumbCell.innerHTML = parentThumbCell.innerHTML;
            }
        });

    });
}

/**
 * Unhide a variant-only parent row (called when its last child is deleted).
 */
function unhideVariantOnlyParent(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow || parentRow.dataset.variantOnlyHidden !== 'true') return;

    parentRow.classList.remove('variant-only-parent');
    parentRow.dataset.variantOnlyHidden = 'false';
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
export function createChildRow(parentRowId, size, qty) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const childRowId = ++embState.rowCounter;
    const baseStyle = parentRow.dataset.style;
    const partNumber = getPartNumber(baseStyle, size);

    // Get parent's available colors for the dropdown
    const parentColors = parentRow.dataset.colors ? JSON.parse(parentRow.dataset.colors) : [];
    const parentColor = parentRow.dataset.color || '';
    // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
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

    // Build current color display — sanitize before interpolating into (CSS/attribute
    // breakout); mirrors the hardened getSwatchStyle(). (review C32)
    const _swUrl = String(parentSwatchUrl || '').replace(/["'()\\\s]/g, '');
    const _swHex = (parentHex && /^#[0-9a-fA-F]{3,8}$/.test(parentHex)) ? parentHex : '#ccc';
    const currentSwatchStyle = /^https?:\/\//i.test(_swUrl)
        ? `background-image: url('${_swUrl}'); background-size: cover; background-position: center;`
        : `background-color: ${_swHex};`;

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
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): colorOptionsHtml escapes colors (C32); partNumber/size internal codes; qty numeric
    childRow.innerHTML = `
        <td>
            <span class="child-indicator">└</span>
            <span class="style-display">${partNumber}</span>
        </td>
        <td class="thumbnail-col"></td>
        <td>
            <span class="desc-display qb-muted-12">${escapeHtml(parentRow.dataset.productName)} - <strong>${displaySize}</strong></span>
        </td>
        <td>
            <div class="color-picker-wrapper child-color-picker" data-row-id="${childRowId}">
                <div class="color-picker-selected" onclick="toggleColorPicker(${childRowId})" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Garment color" onkeydown="handleColorPickerKeydown(event, ${childRowId})">
                    <span class="color-swatch" style="${currentSwatchStyle}"></span>
                    <span class="color-name">${escapeHtml(parentColor)}</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" role="listbox" aria-label="Colors" id="color-dropdown-${childRowId}">
                    ${colorOptionsHtml}
                </div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="S" aria-label="Quantity S" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="M" aria-label="Quantity M" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="L" aria-label="Quantity L" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="XL" aria-label="Quantity XL" disabled value=""></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" aria-label="Quantity 2XL" ${isSize05 ? '' : 'disabled'} value="${isSize05 ? qty : ''}" placeholder="${isSize05 ? qty : ''}" style="${isSize05 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td><input type="number" class="cell-input size-input" data-size="${size}" aria-label="Quantity ${size}" ${isSize06 ? '' : 'disabled'} value="${isSize06 ? qty : ''}" placeholder="${isSize06 ? qty : ''}" style="${isSize06 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td class="cell-qty qty-display" id="row-qty-${childRowId}">${qty}</td>
        <td class="cell-price unit-price-display" id="row-price-${childRowId}"
            ondblclick="enablePriceOverride(${childRowId})"
            title="Double-click to override price">-</td>
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
    if (!embState.childRowMap[parentRowId]) {
        embState.childRowMap[parentRowId] = {};
    }
    embState.childRowMap[parentRowId][size] = childRowId;

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
export function removeChildRow(parentRowId, size) {
    const childRowId = embState.childRowMap[parentRowId]?.[size];
    if (childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) {
            childRow.remove();
        }
        delete embState.childRowMap[parentRowId][size];
    }
}

/**
 * Handle size change in child row - sync back to parent
 */
export function onChildSizeChange(childRowId, parentRowId, size) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!childRow || !parentRow) return;

    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    const qty = parseInt(sizeInput?.value) || 0;

    // Update child row quantity display
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;

    // Update parent Qty display (reflects child changes for variant-only rows)
    updateParentQtyDisplay(parseInt(parentRowId));

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
export function clearExtendedSize(parentRowId, size) {
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

    // If parent was hidden (variant-only) and has no more children, unhide it
    if (parentRow.dataset.variantOnlyHidden === 'true') {
        const remainingChildren = document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`);
        if (remainingChildren.length === 0) {
            unhideVariantOnlyParent(parentRowId);
        }
    }

    // Update parent Qty display (may revert to 0 if no children remain)
    updateParentQtyDisplay(parentRowId);

    recalculatePricing();
}

/**
 * Reorder a product row based on type: garments first, caps below
 * Called after cap detection to maintain visual organization
 */
function reorderRowByProductType(row) {
    if (!row) return;

    const tbody = document.getElementById('product-tbody');
    if (!tbody) return;

    const isCap = row.dataset.isCap === 'true';

    if (isCap) {
        // Cap rows go at the end (after all other rows)
        tbody.appendChild(row);
    } else {
        // Garment rows go before any cap rows
        const firstCapRow = tbody.querySelector('tr[data-is-cap="true"]:not(.child-row)');
        if (firstCapRow) {
            tbody.insertBefore(row, firstCapRow);
        }
        // If no cap rows yet, row stays where it is (already at end)
    }
}

export function deleteRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // If this is a parent row, also remove all child rows
    if (!row.classList.contains('child-row') && embState.childRowMap[rowId]) {
        Object.keys(embState.childRowMap[rowId]).forEach(size => {
            const childRowId = embState.childRowMap[rowId][size];
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                childRow.remove();
            }
        });
        delete embState.childRowMap[rowId];
    }


    row.remove();
    recalculatePricing();

    // Update logo section visibility (hide if no products of that type remain)
    updateCapLogoSectionVisibility();
    updateGarmentLogoSectionVisibility();
}

/**
 * Duplicate a product row for a different color of the same style.
 * Pre-populates the style number and triggers onStyleChange() so
 * the color picker loads — user just picks the new color.
 */
export async function duplicateRowNewColor(sourceRowId) {
    const sourceRow = document.getElementById(`row-${sourceRowId}`);
    if (!sourceRow) return;

    const style = sourceRow.dataset.style;
    if (!style) {
        showToast('No style loaded on this row', 'error');
        return;
    }

    // Create a new row. Find it via lastElementChild, NOT 'tr.new-row' — the
    // .new-row highlight class lives on ANY row created in the last 1s, so a
    // quick second duplicate used to grab the wrong (earlier) row and leave
    // the new one empty. addNewRow() appends synchronously; last row wins.
    addNewRow();
    const newRow = document.getElementById('product-tbody').lastElementChild;
    if (!newRow || !newRow.dataset.rowId) return;

    const newRowId = parseInt(newRow.dataset.rowId);
    const styleInput = newRow.querySelector('.style-input');
    if (styleInput) {
        styleInput.value = style;
        await onStyleChange(styleInput, newRowId);
        showToast(`Select a new color for ${style}`, 'info', 3000);
    }
}

// ============================================================
// PRICE OVERRIDE (double-click to edit)
// ============================================================

/**
 * Enable price override on a product row via double-click.
 * Replaces price cell content with an editable input.
 * Enter/blur commits the override; Escape cancels.
 */
export function enablePriceOverride(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Only allow override on product rows and DECG/DECC service rows
    if (row.dataset.productType === 'service') {
        const sType = (row.dataset.serviceType || '').toUpperCase();
        if (sType !== 'DECG' && sType !== 'DECC') return;
    }

    // Don't allow override on empty product rows (no style or no quantities yet)
    // Child rows inherit style/color from parent, so allow them through
    // Non-SanMar rows may not have color set yet, but should still allow price edit
    const isChildRow = row.classList.contains('child-row');
    const isNonSanmar = row.dataset.nonSanmar === 'true';
    if (row.dataset.productType !== 'service' && !isChildRow && !isNonSanmar && (!row.dataset.style || !row.dataset.color)) return;

    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (!priceCell) return;

    // Already editing — don't re-enter
    if (priceCell.querySelector('.price-override-input')) return;

    // Read current displayed price (strip $ and any reset button text)
    const currentText = priceCell.textContent.replace(/[^0-9.]/g, '');
    const currentPrice = parseFloat(currentText) || 0;

    // Replace cell content with input
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric price value + rowId only
    priceCell.innerHTML = `<input type="number" class="price-override-input"
        step="0.01" min="0" value="${currentPrice.toFixed(2)}">`;

    const input = priceCell.querySelector('.price-override-input');
    input.focus();
    input.select();

    // Commit on Enter or blur
    function commitOverride() {
        const newPrice = parseFloat(input.value);
        if (isNaN(newPrice) || newPrice <= 0) {
            cancelOverride();
            return;
        }

        // Set the sell price override on the row
        row.dataset.sellPrice = newPrice.toString();
        markAsUnsaved();
        recalculatePricing();
    }

    // Cancel on Escape — restore original display
    function cancelOverride() {
        // Remove input, let recalculatePricing restore the cell
        // If there was an existing override, keep it; otherwise clear
        recalculatePricing();
    }

    let committed = false;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            committed = true;
            commitOverride();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            cancelOverride();
        }
    });

    input.addEventListener('blur', () => {
        if (!committed) {
            commitOverride();
        }
    });
}

/**
 * Clear price override on a product row — revert to formula-calculated price.
 */
export function clearPriceOverride(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Remove override
    delete row.dataset.sellPrice;

    markAsUnsaved();
    recalculatePricing();
}

// ============================================================
// KEYBOARD NAVIGATION (Excel-style)
// ============================================================

// setupKeyboardShortcuts() → moved to quote-builder-utils.js (now includes Ctrl+P for print)

export function handleCellKeydown(event, input) {
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
