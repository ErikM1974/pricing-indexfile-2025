/**
 * EMB ShopWorks-import module — roadmap 0.4 extraction #3 (2026-07-07).
 *
 * The paste-from-ShopWorks flow: import modal open/close, parse + preview
 * (renderImportPreview), the 999-line confirmShopWorksImport orchestrator
 * (products, services via the SPR modal, EMB config, sales rep, ship-to,
 * tax), per-row product import, the non-SanMar add/re-import modal, and
 * the import summary banner.
 *
 * Moved verbatim from embroidery-quote-builder.js (~2,000-line contiguous
 * cluster). First module with real inter-module imports: spr-modal
 * (showServicePricingReview + getSprEmbConfigOptions) and design-search
 * (applyDesignFromCache) are imported directly instead of via window.
 *
 * pendingShopWorksImport + lastImportMetadata remain DECLARED IN THE
 * MONOLITH (26 outside readers of lastImportMetadata — clusters 6/11);
 * this module reads/writes them through the global scope chain.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global API_BASE, SIZE06_EXTENDED_SIZES, _syncALArrays, addNewRow, createServiceProductRow, dateToInputValue,
   handleCapEmbellishmentChange, hideVariantOnlyParents, isCapProduct, onSizeChange, onStyleChange,
   parseShopWorksDescription, populateNonSanmarRow, reorderRowByProductType, selectColor, selectNonSanmarColor,
   updateCapLogoSectionVisibility, updateLogoCardHeader, updateNonSanmarPriceCell,
   updateNotesBadge, escapeHtml, showToast,
   createOrUpdateExtendedChildRow, ShopWorksImportParser, updateArtworkCharges,
   Event, APP_CONFIG, setLtmControlState, markAsUnsaved */
import { showServicePricingReview, getSprEmbConfigOptions } from './spr-modal.js';
import { lookupTaxRate, onShipMethodChange, recalculatePricing, updateTaxCalculation } from './pricing-sync.js';
import { applyDesignFromCache, lookupDesignNumber } from './design-search.js';


// DECG stitch-count modal DELETED 2026-07-07 (roadmap 0.4 cluster #9 audit):
// openDECGStitchModal had ZERO callers repo-wide (incl. generated markup and
// DOM-id manipulation) — superseded by the SPR review modal, which handles
// DECG/DECC items during import. Static modal markup removed from the HTML.

// ============================================================
// IMPORT PROGRESS INDICATOR
// ============================================================

function updateImportProgress(step, total, message, detail = '') {
    const overlay = document.getElementById('import-progress-overlay');
    const bar = document.getElementById('import-progress-bar');
    const status = document.getElementById('import-progress-status');
    const detailEl = document.getElementById('import-progress-detail');
    if (!overlay) return;
    overlay.classList.add('active');
    const pct = total > 0 ? Math.round((step / total) * 100) : 0;
    bar.style.width = pct + '%';
    status.textContent = message;
    detailEl.textContent = detail;
}

function hideImportProgress() {
    const overlay = document.getElementById('import-progress-overlay');
    if (overlay) overlay.classList.remove('active');
}

// ============================================================
// SHOPWORKS IMPORT MODAL FUNCTIONS
// ============================================================

/**
 * Open the ShopWorks import modal
 */
export function openShopWorksImportModal() {
    const modal = document.getElementById('shopworks-import-modal');
    modal.classList.add('active');

    // Reset state
    document.getElementById('shopworks-paste-area').value = '';
    document.getElementById('shopworks-import-preview').classList.remove('active');
    document.getElementById('btn-parse-import').style.display = '';
    document.getElementById('btn-confirm-import').style.display = 'none';
    pendingShopWorksImport = null;

    // Focus textarea
    setTimeout(() => {
        document.getElementById('shopworks-paste-area').focus();
    }, 100);
}

/**
 * Close the ShopWorks import modal
 */
export function closeShopWorksImportModal() {
    const modal = document.getElementById('shopworks-import-modal');
    modal.classList.remove('active');
    pendingShopWorksImport = null;
}

/**
 * Show the Add Non-SanMar Product modal, pre-filled from row data
 */
export function showAddNonSanmarModal(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const styleNumber = row.dataset.style || row.querySelector('.style-input')?.value?.trim().toUpperCase() || '';
    const importData = row.dataset.importData ? JSON.parse(row.dataset.importData) : {};

    // Pre-parse description from import data
    const description = importData.description || '';
    const parsed = parseShopWorksDescription(description, styleNumber);

    // Fill modal fields
    document.getElementById('ns-modal-row-id').value = rowId;
    document.getElementById('ns-style-number').value = styleNumber;
    document.getElementById('ns-brand').value = parsed.brand || importData.brand || '';
    document.getElementById('ns-product-name').value = parsed.name || '';
    document.getElementById('ns-category').value = parsed.category || '';
    document.getElementById('ns-sell-price').value = importData.unitPrice || '';
    document.getElementById('ns-default-colors').value = parsed.color || importData.color || '';

    // Auto-fill available sizes based on detected category
    if (parsed.category === 'Caps') {
        document.getElementById('ns-available-sizes').value = 'OSFA';
    } else {
        document.getElementById('ns-available-sizes').value = 'S,M,L,XL,2XL,3XL';
    }

    // Collapse "More Options" by default
    const moreSection = document.getElementById('ns-more-options');
    const moreToggle = document.querySelector('.ns-more-options-toggle');
    if (moreSection) moreSection.classList.remove('visible');
    if (moreToggle) moreToggle.classList.remove('expanded');

    // Show modal
    const modal = document.getElementById('add-nonsanmar-modal');
    modal.classList.add('active');

    // Validate fields (enables/disables Save button)
    validateNsModalFields();

    // Focus the brand field (first editable field)
    setTimeout(() => document.getElementById('ns-brand').focus(), 100);
}

/**
 * Close the Add Non-SanMar Product modal
 */
export function closeAddNonSanmarModal() {
    const modal = document.getElementById('add-nonsanmar-modal');
    modal.classList.remove('active');
}

/**
 * Toggle "More Options" collapsible in the Add Non-SanMar modal
 */
export function toggleNsMoreOptions(btn) {
    const section = document.getElementById('ns-more-options');
    const isExpanded = section.classList.toggle('visible');
    btn.classList.toggle('expanded', isExpanded);
}

/**
 * Live validation for the 3 required fields in the Non-SanMar modal.
 * Enables/disables the Save button.
 */
export function validateNsModalFields() {
    const brand = document.getElementById('ns-brand').value.trim();
    const name = document.getElementById('ns-product-name').value.trim();
    const price = parseFloat(document.getElementById('ns-sell-price').value);
    const saveBtn = document.getElementById('btn-save-nonsanmar');
    const isValid = brand && name && price > 0;
    saveBtn.disabled = !isValid;
    saveBtn.title = isValid ? '' : 'Fill Brand, Product Name, and Sell Price';
}

/**
 * Show a post-import summary banner above the product table.
 * Lists non-SanMar products with price status indicators.
 */
function showImportSummaryBanner(sanMarCount, nonSanMarItems) {
    // Remove any existing banner
    const existing = document.getElementById('import-summary-banner');
    if (existing) existing.remove();

    const totalProducts = sanMarCount + nonSanMarItems.length;
    if (totalProducts === 0) return;

    const hasZeroPrice = nonSanMarItems.some(item => !item.price || item.price <= 0);
    const bannerClass = hasZeroPrice ? 'banner-warning' : 'banner-success';

    let html = `<div class="banner-title">Import Complete: ${totalProducts} product${totalProducts !== 1 ? 's' : ''} imported</div>`;
    html += `<div class="banner-detail">`;
    if (sanMarCount > 0) {
        html += `&#8226; ${sanMarCount} SanMar product${sanMarCount !== 1 ? 's' : ''} &mdash; priced automatically<br>`;
    }
    if (nonSanMarItems.length > 0) {
        const zeroCount = nonSanMarItems.filter(i => !i.price || i.price <= 0).length;
        if (zeroCount > 0) {
            html += `&#8226; ${nonSanMarItems.length} non-SanMar product${nonSanMarItems.length !== 1 ? 's' : ''} &mdash; <strong>${zeroCount} need${zeroCount !== 1 ? '' : 's'} pricing</strong><br>`;
        } else {
            html += `&#8226; ${nonSanMarItems.length} non-SanMar product${nonSanMarItems.length !== 1 ? 's' : ''} &mdash; using ShopWorks prices<br>`;
        }
        for (const item of nonSanMarItems) {
            const priceOk = item.price && item.price > 0;
            const icon = priceOk
                ? '<span class="ns-price-ok">&#10003;</span>'
                : '<span class="ns-price-warn">&#9888;</span>';
            const priceStr = priceOk ? `$${item.price.toFixed(2)}` : '$0.00';
            html += `<div class="banner-ns-item" data-row-id="${item.rowId}" onclick="scrollToProductRow(${item.rowId})">`;
            html += `&nbsp;&nbsp;&#9656; ${escapeHtml(item.style)} (${escapeHtml(item.description)}) &mdash; ${priceStr} ${icon}`;
            html += `</div>`;
        }
    }
    html += `</div>`;
    html += `<button class="btn-dismiss-banner" onclick="dismissImportBanner()" title="Dismiss">Dismiss</button>`;

    const banner = document.createElement('div');
    banner.id = 'import-summary-banner';
    banner.className = `import-summary-banner ${bannerClass}`;
    banner.innerHTML = html;

    // Insert before the product table
    const productTable = document.getElementById('product-table');
    if (productTable && productTable.parentElement) {
        productTable.parentElement.insertBefore(banner, productTable);
    }

    // Auto-dismiss after 30s (unless there are $0 products)
    if (!hasZeroPrice) {
        setTimeout(() => dismissImportBanner(), 30000);
    }
}

/**
 * Dismiss the import summary banner
 */
export function dismissImportBanner() {
    const banner = document.getElementById('import-summary-banner');
    if (banner) {
        banner.style.transition = 'opacity 0.2s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 200);
    }
}

/**
 * Scroll to a specific product row and briefly highlight it
 */
export function scrollToProductRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.transition = 'background 0.3s';
    row.style.background = '#ede9fe';
    setTimeout(() => { row.style.background = ''; }, 1500);
}

/**
 * Save non-SanMar product to database and re-populate the row
 */
export async function saveNonSanmarProduct() {
    const rowId = parseInt(document.getElementById('ns-modal-row-id').value);
    const styleNumber = document.getElementById('ns-style-number').value.trim();
    const brand = document.getElementById('ns-brand').value.trim();
    const productName = document.getElementById('ns-product-name').value.trim();
    const category = document.getElementById('ns-category').value;
    const sellPrice = parseFloat(document.getElementById('ns-sell-price').value) || 0;
    const defaultColors = document.getElementById('ns-default-colors').value.trim();
    const availableSizes = document.getElementById('ns-available-sizes').value.trim();

    // Validate required fields
    if (!brand) {
        showToast('Brand is required', 'error');
        document.getElementById('ns-brand').focus();
        return;
    }
    if (!productName) {
        showToast('Product Name is required', 'error');
        document.getElementById('ns-product-name').focus();
        return;
    }
    if (!sellPrice || sellPrice <= 0) {
        showToast('Sell Price is required — cannot save a $0 product', 'error');
        document.getElementById('ns-sell-price').focus();
        return;
    }

    const saveBtn = document.getElementById('btn-save-nonsanmar');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const payload = {
            StyleNumber: styleNumber,
            Brand: brand,
            ProductName: productName,
            Category: category,
            DefaultSellPrice: sellPrice,
            DefaultColors: defaultColors,
            AvailableSizes: availableSizes,
            PricingMethod: 'FIXED',
            IsActive: true
        };

        const response = await fetch(`${API_BASE}/api/non-sanmar-products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Save failed (${response.status})`);
        }

        // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
        const result = await response.json();
        showToast(`${styleNumber} saved to database`, 'success');

        // Close modal
        closeAddNonSanmarModal();

        // Re-populate the row with the saved product data
        const row = document.getElementById(`row-${rowId}`);
        if (row) {
            populateNonSanmarRow(row, rowId, payload);

            // If we have import data, re-apply color and sizes
            const importData = row.dataset.importData ? JSON.parse(row.dataset.importData) : null;
            if (importData) {
                await reImportNonSanmarRow(row, rowId, importData);
            }
        }

        recalculatePricing();

    } catch (error) {
        console.error('[saveNonSanmarProduct] Error:', error);
        showToast('Failed to save: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save & Apply';
    }
}

/**
 * Re-apply import data (color, sizes) to a non-SanMar row after it's been populated
 */
async function reImportNonSanmarRow(row, rowId, importData) {
    // Select color if available
    if (importData.color) {
        const pickerDropdown = row.querySelector('.color-picker-dropdown');
        if (pickerDropdown) {
            const colorOption = pickerDropdown.querySelector(
                `[data-color-name="${importData.color}"]`
            );
            if (colorOption) {
                selectNonSanmarColor(rowId, colorOption);
            } else {
                // Color not in defaults — add it and select it
                const optHtml = `<div class="color-picker-option selected"
                    data-color-name="${escapeHtml(importData.color)}"
                    data-catalog-color="${escapeHtml(importData.color)}"
                    data-swatch-url="" data-hex="#ccc" data-image-url=""
                    onclick="selectNonSanmarColor(${rowId}, this)">
                    <span class="color-swatch" style="background-color:#ccc"></span>
                    <span class="color-name">${escapeHtml(importData.color)}</span>
                </div>`;
                pickerDropdown.insertAdjacentHTML('afterbegin', optHtml);
                selectNonSanmarColor(rowId, pickerDropdown.querySelector('.color-picker-option'));
            }
        }
    }

    // Set sizes from import data — including extended sizes as child rows
    if (importData.sizes) {
        const IMPORT_EXTENDED_SIZES = [...SIZE06_EXTENDED_SIZES, '2XL'];

        for (const [size, qty] of Object.entries(importData.sizes)) {
            if (qty > 0) {
                let internalSize = size;
                if (size === 'LG') internalSize = 'L';
                if (size === '2X') internalSize = '2XL';
                if (size === 'XXXL' || size === '3X') internalSize = '3XL';
                if (size === 'XXXXL' || size === '4X') internalSize = '4XL';
                if (size === '5X') internalSize = '5XL';
                if (size === '6X') internalSize = '6XL';
                // XXL stays as 'XXL' — distinct from 2XL for Ladies/Womens products

                const sizeInput = row.querySelector(`[data-size="${internalSize}"]`);
                const needsChildRow = IMPORT_EXTENDED_SIZES.includes(internalSize) ||
                                      (sizeInput && sizeInput.disabled);

                if (needsChildRow) {
                    // Create child row for extended sizes (mirrors SanMar import path)
                    createOrUpdateExtendedChildRow(rowId, internalSize, qty);

                    // Set per-size sell price override on child row if available
                    if (importData.sellPriceOverrides && importData.sellPriceOverrides[size]) {
                        const childRow = document.querySelector(`tr.child-row[data-parent-row="${rowId}"][data-size="${internalSize}"]`);
                        if (childRow) {
                            childRow.dataset.sellPrice = importData.sellPriceOverrides[size].toString();
                        }
                    }

                    // For 2XL/XXL: set parent row input so onSizeChange doesn't remove the child row
                    if (internalSize === '2XL' || internalSize === 'XXL') {
                        const parentXxlInput = row.querySelector('[data-size="2XL"]');
                        if (parentXxlInput) {
                            parentXxlInput.value = qty;
                        }
                    }
                } else if (sizeInput && !sizeInput.disabled) {
                    sizeInput.value = qty;
                }
            }
        }
        onSizeChange(rowId);
    }
}

/**
 * Parse pasted text and show preview
 */
export async function parseAndPreviewShopWorks() {
    const text = document.getElementById('shopworks-paste-area').value.trim();

    if (!text) {
        showToast('Please paste ShopWorks order text first', 'warning');
        return;
    }

    try {
        const parser = new ShopWorksImportParser();

        // Load service codes from Caspio API for current pricing
        await parser.loadServiceCodes();

        const result = parser.parse(text);


        // Consolidate products by partNumber + color (merges size-split SKUs like ST253, ST253_2X into one row)
        result.products = parser.consolidateProducts(result.products);
        pendingShopWorksImport = result;

        result.products.forEach((p, _i) => {
            // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
            const totalQty = Object.values(p.sizes).reduce((sum, q) => sum + q, 0);
        });

        // Show preview
        renderImportPreview(result);

        // Show confirm button, hide parse button
        document.getElementById('btn-parse-import').style.display = 'none';
        document.getElementById('btn-confirm-import').style.display = '';

    } catch (error) {
        console.error('Failed to parse ShopWorks text:', error);
        showToast('Failed to parse order text. Check format.', 'error');
    }
}

/**
 * Render the import preview
 */
function renderImportPreview(data) {
    const preview = document.getElementById('shopworks-import-preview');
    const grid = document.getElementById('preview-grid');
    const products = document.getElementById('preview-products');
    const services = document.getElementById('preview-services');
    const warnings = document.getElementById('preview-warnings');

    // Customer & order info grid
    const pricingIcon = data.pricingSource === 'caspio' ? '✓' : '⚠';
    const pricingColor = data.pricingSource === 'caspio' ? '#28a745' : '#ffc107';
    grid.innerHTML = `
        <div class="preview-item">
            <div class="preview-item-label">Order #</div>
            <div class="preview-item-value">${escapeHtml(data.orderId || 'N/A')}</div>
        </div>
        <div class="preview-item">
            <div class="preview-item-label">Company</div>
            <div class="preview-item-value">${escapeHtml(data.customer.company || 'N/A')}</div>
        </div>
        <div class="preview-item">
            <div class="preview-item-label">Contact</div>
            <div class="preview-item-value">${escapeHtml(data.customer.contactName || 'N/A')}</div>
        </div>
        <div class="preview-item">
            <div class="preview-item-label">Sales Rep</div>
            <div class="preview-item-value">${escapeHtml(data.salesRep.name || 'N/A')}</div>
        </div>
        <div class="preview-item">
            <div class="preview-item-label">Pricing</div>
            <div class="preview-item-value" style="color: ${pricingColor};">${pricingIcon} ${data.pricingSource === 'caspio' ? 'Live API' : 'Fallback'}</div>
        </div>
    `;

    // Products list
    let productsHtml = '';
    if (data.products.length > 0) {
        productsHtml = '<h5>Products (' + data.products.length + ')</h5><div class="preview-products-list">';
        data.products.forEach((product, idx) => {
            const totalQty = Object.values(product.sizes).reduce((sum, q) => sum + q, 0);
            productsHtml += `
                <div class="preview-product-item">
                    <input type="checkbox" class="product-include-check" data-product-index="${idx}" checked
                           style="flex-shrink:0; width:16px; height:16px; cursor:pointer;" title="Uncheck to exclude from import">
                    <span class="preview-product-style">${escapeHtml(product.partNumber)}</span>
                    <span class="preview-product-desc">${escapeHtml(product.description || '')}</span>
                    <span class="preview-product-qty">Qty: ${totalQty}</span>
                </div>
            `;
        });
        productsHtml += '</div>';
    }

    // DECG/DECC items (customer-supplied garments and caps)
    if (data.decgItems.length > 0) {
        const decgGarments = data.decgItems.filter(d => d.serviceType !== 'decc');
        const deccCaps = data.decgItems.filter(d => d.serviceType === 'decc');

        if (decgGarments.length > 0) {
            productsHtml += '<h5 style="margin-top: 12px;">Customer-Supplied Garments (' + decgGarments.length + ')</h5><div class="preview-products-list">';
            for (const decg of decgGarments) {
                const ltmNote = decg.ltmFee > 0 ? ` + $${decg.ltmFee} LTM` : '';
                const tierNote = decg.tier ? ` (Tier ${decg.tier})` : '';
                const stitchNote = `${(decg.stitchCount || 8000).toLocaleString()} stitches`;
                const sourceIcon = decg.pricingSource === 'decg-api' ? '✓' : '⚠';
                productsHtml += `
                    <div class="preview-product-item">
                        <span class="preview-product-style" style="background: #fef3c7; color: #92400e;">DECG</span>
                        <span class="preview-product-desc">${escapeHtml(decg.description || 'Customer garment')} <small style="color:#64748b;">${stitchNote}${tierNote}</small></span>
                        <span class="preview-product-qty">${sourceIcon} Qty: ${decg.quantity} @ $${decg.calculatedUnitPrice.toFixed(2)}${ltmNote}</span>
                    </div>
                `;
            }
            productsHtml += '</div>';
        }

        if (deccCaps.length > 0) {
            productsHtml += '<h5 style="margin-top: 12px;">Customer-Supplied Caps (' + deccCaps.length + ')</h5><div class="preview-products-list">';
            for (const decc of deccCaps) {
                const ltmNote = decc.ltmFee > 0 ? ` + $${decc.ltmFee} LTM` : '';
                const tierNote = decc.tier ? ` (Tier ${decc.tier})` : '';
                const stitchNote = `${(decc.stitchCount || 8000).toLocaleString()} stitches`;
                const sourceIcon = decc.pricingSource === 'decg-api' ? '✓' : '⚠';
                productsHtml += `
                    <div class="preview-product-item">
                        <span class="preview-product-style" style="background: #dbeafe; color: #1e40af;">DECC</span>
                        <span class="preview-product-desc">${escapeHtml(decc.description || 'Customer cap')} <small style="color:#64748b;">${stitchNote}${tierNote}</small></span>
                        <span class="preview-product-qty">${sourceIcon} Qty: ${decc.quantity} @ $${decc.calculatedUnitPrice.toFixed(2)}${ltmNote}</span>
                    </div>
                `;
            }
            productsHtml += '</div>';
        }

        // Add note about stitch count confirmation
        productsHtml += '<p style="font-size: 11px; color: #64748b; margin-top: 8px; font-style: italic;"><i class="fas fa-info-circle"></i> After import, you\'ll be prompted to confirm stitch counts for accurate pricing</p>';
    }

    // Non-SanMar products (require manual pricing)
    if (data.customProducts && data.customProducts.length > 0) {
        productsHtml += '<h5 style="margin-top: 12px; color: #c2410c;">Non-SanMar Products - Manual Pricing Required (' + data.customProducts.length + ')</h5><div class="preview-products-list">';
        for (const product of data.customProducts) {
            const totalQty = Object.values(product.sizes || {}).reduce((sum, q) => sum + q, 0) || product.quantity || 0;
            productsHtml += `
                <div class="preview-product-item" style="border-left: 3px solid #c2410c;">
                    <span class="preview-product-style" style="background: #fed7aa; color: #c2410c;">${escapeHtml(product.partNumber)}</span>
                    <span class="preview-product-desc">${escapeHtml(product.description || product.color || 'Unknown')}</span>
                    <span class="preview-product-qty" style="color: #c2410c;">Qty: ${totalQty} - MANUAL</span>
                </div>
            `;
        }
        productsHtml += '</div>';
    }
    products.innerHTML = productsHtml;

    // Services badges
    let servicesHtml = '';
    if (data.services.digitizing) {
        const codes = data.services.digitizingCodes || ['DD'];
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-cog"></i> Digitizing (${codes.join(', ')})</span>`;
    }
    if (data.services.patchSetup) {
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-layer-group"></i> Patch Setup ($${Number.isFinite(parseFloat(pricingCalculator?.patchSetupFee)) ? parseFloat(pricingCalculator.patchSetupFee) : 50})</span>`;
    }

    // Handle new additionalLogos array
    const additionalLogos = data.services.additionalLogos || [];
    if (data.services.additionalLogo && !additionalLogos.some(al => al.position === data.services.additionalLogo.position)) {
        additionalLogos.push(data.services.additionalLogo);
    }
    for (const al of additionalLogos) {
        const typeLabel = al.type === 'fb' ? 'Full Back' :
                         al.type === 'cb' ? 'Cap Back' :
                         al.position || 'Additional Logo';
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-plus-circle"></i> ${escapeHtml(typeLabel)}</span>`;
    }

    if (data.services.monograms.length > 0) {
        const totalNames = data.services.monograms.reduce((sum, m) => sum + m.quantity, 0);
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-font"></i> Monograms: ${totalNames} names</span>`;
    }
    if (data.services.designTransfer && data.services.designTransfer.length > 0) {
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-exchange-alt"></i> Design Transfer: $${data.services.designTransfer.reduce((s, dt) => s + (dt.unitPrice || 50), 0).toFixed(2)}</span>`;
    }
    if (data.services.contract && data.services.contract.length > 0) {
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-file-contract"></i> Contract: ${data.services.contract.length} item(s)</span>`;
    }
    if (data.services.sewing && data.services.sewing.length > 0) {
        const totalSewQty = data.services.sewing.reduce((sum, s) => sum + (s.quantity || 0), 0);
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-scissors"></i> Sewing: ${totalSewQty} items</span>`;
    }
    if (data.services.weights && data.services.weights.length > 0) {
        const totalWeightQty = data.services.weights.reduce((sum, w) => sum + (w.quantity || 0), 0);
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-weight-hanging"></i> Weight: ${totalWeightQty} items</span>`;
    }
    if (data.services.capEmbellishments && data.services.capEmbellishments.length > 0) {
        const ceTypes = data.services.capEmbellishments.map(ce => ce.partNumber).join(', ');
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-hat-cowboy"></i> Cap Embellishment: ${escapeHtml(ceTypes)}</span>`;
    }
    if (data.services.rush) {
        servicesHtml += `<span class="preview-service-badge warning"><i class="fas fa-bolt"></i> Rush Fee: $${data.services.rush.amount.toFixed(2)}</span>`;
    }
    if (data.services.artCharges) {
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-palette"></i> Art Charge: $${data.services.artCharges.amount.toFixed(2)}</span>`;
    }
    if (data.services.graphicDesign) {
        servicesHtml += `<span class="preview-service-badge"><i class="fas fa-pencil-ruler"></i> Design: ${data.services.graphicDesign.hours} hrs</span>`;
    }
    if (data.services.ltmFee) {
        servicesHtml += `<span class="preview-service-badge warning"><i class="fas fa-exclamation-circle"></i> LTM Fee: $${data.services.ltmFee.amount.toFixed(2)}</span>`;
    }

    if (servicesHtml) {
        services.innerHTML = '<h5>Services</h5><div class="preview-services-list">' + servicesHtml + '</div>';
    } else {
        services.innerHTML = '';
    }

    // Warnings - highlight DECG API failures prominently (CLAUDE.md rule #4)
    if (data.warnings.length > 0 || data.notes.length > 0) {
        let warningsHtml = '<h5><i class="fas fa-exclamation-triangle"></i> Notes & Warnings</h5>';

        // Show DECG API failure as prominent error banner
        if (data.decgApiFailed) {
            warningsHtml += `
                <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; color: #b91c1c;">
                    <strong><i class="fas fa-exclamation-circle"></i> DECG API Error:</strong> Unable to load current pricing from server.
                    Prices shown are <em>fallback estimates</em> and may be incorrect.
                    <strong>Verify DECG prices manually before sending quote.</strong>
                </div>`;
        }

        warningsHtml += '<ul>';
        for (const warning of data.warnings) {
            // Skip the DECG warning since we displayed it prominently above
            if (warning.includes('DECG API unavailable')) continue;
            warningsHtml += `<li>${escapeHtml(warning)}</li>`;
        }
        for (const note of data.notes) {
            warningsHtml += `<li>${escapeHtml(note)}</li>`;
        }
        warningsHtml += '</ul>';
        warnings.innerHTML = warningsHtml;
        warnings.style.display = '';
    } else {
        warnings.style.display = 'none';
    }

    // Build combined review list from multiple sources (invalid items, AS-GARM/CAP, LTM)
    const allReviewItems = [...(data.reviewItems || [])];

    // Add AS-GARM/AS-CAP stitch fees
    if (data.services.additionalStitches && data.services.additionalStitches.length > 0) {
        data.services.additionalStitches.forEach(s => {
            allReviewItems.push({
                partNumber: s.type === 'cap' ? 'AS-CAP' : 'AS-Garm',
                description: s.description || 'Additional Stitches',
                quantity: s.quantity,
                unitPrice: s.unitPrice || 0,
                source: 'additional-stitches'
            });
        });
    }

    // Add LTM fee
    if (data.services.ltmFee) {
        allReviewItems.push({
            partNumber: 'LTM',
            description: 'Less Than Minimum Fee',
            quantity: 1,
            unitPrice: data.services.ltmFee.amount || 0,
            source: 'ltm'
        });
    }

    // Show "Items for Review" section with checkboxes
    if (allReviewItems.length > 0) {
        let reviewHtml = '<h5 style="margin-top: 12px; color: #b45309;"><i class="fas fa-search"></i> Items for Review — Check to Import as Notes</h5>';
        reviewHtml += '<div style="max-height: 150px; overflow-y: auto; padding: 4px 0;">';
        allReviewItems.forEach((item, i) => {
            const hasPrice = item.unitPrice > 0;
            reviewHtml += `<label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; cursor: pointer;">
                <input type="checkbox" class="review-item-check" data-index="${i}" ${hasPrice ? 'checked' : ''}>
                <span><strong>${escapeHtml(item.partNumber || '(no PN)')}</strong>: ${escapeHtml(item.description || '')}${hasPrice ? ' — $' + item.unitPrice.toFixed(2) + '/ea × ' + (item.quantity || 1) : ''}</span>
            </label>`;
        });
        reviewHtml += '</div>';
        warnings.innerHTML = (warnings.innerHTML || '') + reviewHtml;
        warnings.style.display = '';
    }

    // Store combined list on data object for import step
    data._allReviewItems = allReviewItems;

    preview.classList.add('active');
}

/**
 * Confirm and execute the import
 */
export async function confirmShopWorksImport() {
    if (!pendingShopWorksImport) {
        showToast('No import data available', 'error');
        return;
    }

    const data = pendingShopWorksImport;
    const btn = document.getElementById('btn-confirm-import');

    // Filter products by exclude checkboxes
    const excludedIndices = new Set();
    document.querySelectorAll('.product-include-check:not(:checked)').forEach(cb => {
        excludedIndices.add(parseInt(cb.dataset.productIndex));
    });
    if (excludedIndices.size > 0) {
        data.products = data.products.filter((_, idx) => !excludedIndices.has(idx));
    }

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Importing...';

    try {
        // Calculate total steps for progress
        const totalProducts = (data.products?.length || 0) + (data.customProducts?.length || 0);
        const totalSteps = totalProducts + 5; // +5 for customer, services, CRM, validation, cleanup
        let currentStep = 0;

        updateImportProgress(currentStep, totalSteps, 'Setting up customer info...', '');

        // 1. Populate customer info
        if (data.customer.contactName) {
            document.getElementById('customer-name').value = data.customer.contactName;
        }
        if (data.customer.email) {
            document.getElementById('customer-email').value = data.customer.email;
        }
        if (data.customer.company) {
            document.getElementById('company-name').value = data.customer.company;
        }

        // Also populate customer lookup search field for easy CRM lookup
        const customerLookupInput = document.getElementById('customer-lookup');
        if (customerLookupInput && data.customer.email) {
            customerLookupInput.value = data.customer.email;

            // Direct API call to find customer by email (bypass debounced dropdown)
            // This avoids timing issues with modal close/blur events
            if (window.customerLookupInstance) {
                try {
                    const results = await window.customerLookupInstance.search(data.customer.email);

                    if (results.length > 0) {
                        // [A6] (audit 2026-06-06): search() is FUZZY, so results[0] can be a DIFFERENT customer.
                        // Only trust a match whose email EXACTLY equals the imported one — otherwise fall back to
                        // an empty object so the import data is used and id_Customer / company / address are NOT
                        // filled from a wrong account (which would silently push the order to the wrong customer).
                        const _wantEmail = (data.customer.email || '').toLowerCase().trim();
                        const _exact = results.find(c => (c.ContactNumbersEmail || '').toLowerCase().trim() === _wantEmail);
                        if (!_exact) showToast('No exact CRM email match for the imported customer — using imported values (verify the Customer # before pushing).', 'info');
                        // Parser already populated these during import; CRM supplements, doesn't replace.
                        const contact = _exact || {};
                        const nameEl = document.getElementById('customer-name');
                        const emailEl = document.getElementById('customer-email');
                        const companyEl = document.getElementById('company-name');
                        const custNumEl = document.getElementById('customer-number');
                        const phoneEl = document.getElementById('customer-phone');
                        if (!nameEl.value.trim()) nameEl.value = contact.ct_NameFull || data.customer.contactName || '';
                        if (!emailEl.value.trim()) emailEl.value = contact.ContactNumbersEmail || data.customer.email || '';
                        if (!companyEl.value.trim()) companyEl.value = contact.CustomerCompanyName || data.customer.company || '';
                        // Fill customer # (ShopWorks ID) from CRM if empty
                        if (custNumEl && !custNumEl.value.trim() && contact.id_Customer) {
                            custNumEl.value = contact.id_Customer;
                        }
                        if (phoneEl && !phoneEl.value.trim() && contact.Phone) {
                            phoneEl.value = contact.Phone;
                        }
                        // Auto-fill Ship To from CRM contact address
                        if (contact.State) {
                            const stateInput = document.getElementById('ship-state');
                            if (stateInput && !stateInput.value) stateInput.value = contact.State;
                        }
                        if (contact.City) {
                            const cityInput = document.getElementById('ship-city');
                            if (cityInput && !cityInput.value.trim()) cityInput.value = contact.City;
                        }
                        if (contact.Zip) {
                            const zipInput = document.getElementById('ship-zip');
                            if (zipInput && !zipInput.value.trim()) {
                                zipInput.value = contact.Zip;
                                lookupTaxRate(); // Auto-trigger tax lookup
                            }
                        }
                        if (contact.Address) {
                            const addrInput = document.getElementById('ship-address');
                            if (addrInput && !addrInput.value.trim()) addrInput.value = contact.Address;
                        }
                        showToast('Customer info loaded from CRM', 'success');
                    } else {
                        // Show that lookup ran but found nothing - not an error
                        showToast('Customer not found in CRM - using imported values', 'info');
                    }
                } catch (err) {
                    console.warn('[ShopWorks Import] CRM lookup failed:', err);
                    showToast('CRM lookup failed - using imported values', 'warning');
                }
            }

            // Customer section is now always visible at top of sidebar — no need to expand
        }

        // 2. Select sales rep by email
        if (data.salesRep.email) {
            selectSalesRepByEmail(data.salesRep.email);
        }

        // 3. Digitizing is now configured in the Review Import Pricing modal (embroidery config section)

        // 4. Handle patch setup + GRT-50 art charge fee
        if (data.services.patchSetup) {
            const patchSetupCheckbox = document.getElementById('cap-patch-setup');
            if (patchSetupCheckbox) {
                patchSetupCheckbox.checked = true;
                const wrapper = patchSetupCheckbox.closest('.digitizing-checkbox');
                if (wrapper) wrapper.classList.add('checked');
            }
            // Also set art charge input so GRT-50 fee is persisted on save
            // (_saveFeeLineItems saves GRT-50 only when ArtCharge > 0)
            const grt50Amount = data.services.grt50Amount || 150;
            const artToggle = document.getElementById('art-charge-toggle');
            const artInput = document.getElementById('art-charge');
            if (artToggle && artInput) {
                artToggle.checked = true;
                artInput.disabled = false;
                artInput.value = grt50Amount.toFixed(2);
                const artWrapper = document.getElementById('art-charge-wrapper');
                if (artWrapper) artWrapper.style.opacity = '1';
                updateArtworkCharges();
            }
        }

        // 5. Collect additional logos for service pricing review
        const additionalLogos = data.services.additionalLogos || [];
        // Add legacy single additionalLogo if exists and not already in array
        if (data.services.additionalLogo && !additionalLogos.some(al => al.position === data.services.additionalLogo.position)) {
            additionalLogos.push(data.services.additionalLogo);
        }

        // 6. Handle art charges
        if (data.services.artCharges) {
            const artToggle = document.getElementById('art-charge-toggle');
            const artInput = document.getElementById('art-charge');
            if (artToggle && artInput) {
                artToggle.checked = true;
                artInput.disabled = false;
                artInput.value = data.services.artCharges.amount.toFixed(2);
                updateArtworkCharges();
            }
        }

        // 6b. Rush fee → fee table input
        if (data.services.rush) {
            const rushInput = document.getElementById('rush-fee');
            if (rushInput) {
                rushInput.value = data.services.rush.amount.toFixed(2);
                rushInput.dispatchEvent(new Event('input'));
            }
        }

        // 6c. Shipping fee
        if (data.services.shipping) {
            const shippingInput = document.getElementById('shipping-fee');
            if (shippingInput) {
                shippingInput.value = data.services.shipping.amount.toFixed(2);
                shippingInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // 6d. Populate Order Details fields
        if (data.purchaseOrderNumber) document.getElementById('po-number').value = data.purchaseOrderNumber;
        if (data.orderId) document.getElementById('order-number').value = data.orderId;
        if (data.customer.customerId) document.getElementById('customer-number').value = data.customer.customerId;
        if (data.shipping?.method) {
            const shipMethodEl = document.getElementById('ship-method');
            const importedMethod = data.shipping.method;
            // Check if imported value matches a predefined dropdown option
            const matchingOption = Array.from(shipMethodEl.options).find(
                opt => opt.value.toLowerCase() === importedMethod.toLowerCase()
            );
            if (matchingOption) {
                shipMethodEl.value = matchingOption.value;
            } else {
                // Non-standard method — use "Other" with text input
                shipMethodEl.value = 'Other';
                document.getElementById('ship-method-other').value = importedMethod;
            }
            onShipMethodChange();
        }
        if (data.customer.phone) document.getElementById('customer-phone').value = data.customer.phone;
        if (data.dateOrderPlaced) document.getElementById('date-order-placed').value = dateToInputValue(data.dateOrderPlaced);
        if (data.reqShipDate) document.getElementById('req-ship-date').value = dateToInputValue(data.reqShipDate);
        if (data.dropDeadDate) document.getElementById('drop-dead-date').value = dateToInputValue(data.dropDeadDate);
        if (data.paymentTerms) document.getElementById('payment-terms').value = data.paymentTerms;

        // Auto-expand Order Details panel if any field populated
        const hasOrderDetails = data.purchaseOrderNumber || data.orderId || data.customer.customerId ||
            data.shipping?.method || data.dateOrderPlaced || data.reqShipDate ||
            data.dropDeadDate || data.paymentTerms;
        if (hasOrderDetails) {
            const odContent = document.getElementById('order-details-content');
            const odChevron = document.getElementById('order-details-chevron');
            const odBadge = document.getElementById('order-details-badge');
            if (odContent) odContent.style.display = 'block';
            if (odChevron) odChevron.style.transform = 'rotate(180deg)';
            if (odBadge) odBadge.style.display = 'inline';
        }

        // 6e. Populate Ship To address and auto-lookup tax rate
        if (data.shipping) {
            if (data.shipping.street) document.getElementById('ship-address').value = data.shipping.street;
            if (data.shipping.city) document.getElementById('ship-city').value = data.shipping.city;
            if (data.shipping.state) document.getElementById('ship-state').value = data.shipping.state;
            if (data.shipping.zip) document.getElementById('ship-zip').value = data.shipping.zip;

            // Customer Pickup = local pickup at Milton, WA — auto-set for tax lookup
            if (data.shipping.method && data.shipping.method.toLowerCase().includes('pickup') && !data.shipping.zip) {
                document.getElementById('ship-state').value = 'WA';
                document.getElementById('ship-zip').value = '98354';
                document.getElementById('ship-city').value = 'Milton';
            }

            // Use DOR API to get precise tax rate from address
            const lookupOk = await lookupTaxRate();
            // If lookup failed and we have a back-calculated rate, use it as fallback
            if (!lookupOk && data.orderSummary && data.orderSummary.taxRate) {
                document.getElementById('tax-rate-input').value = data.orderSummary.taxRate.toFixed(1);
                document.getElementById('include-tax').checked = true;
                updateTaxCalculation();
            }
        } else if (data.orderSummary && data.orderSummary.taxRate) {
            // Fallback: use back-calculated tax rate from Order Summary
            const taxInput = document.getElementById('tax-rate-input');
            if (taxInput) {
                taxInput.value = data.orderSummary.taxRate.toFixed(1);
            }
            const taxCheckbox = document.getElementById('include-tax');
            if (taxCheckbox) {
                taxCheckbox.checked = true;
            }
            updateTaxCalculation();
        }

        // 7. Handle graphic design hours
        if (data.services.graphicDesign) {
            const designHoursInput = document.getElementById('graphic-design-hours');
            if (designHoursInput) {
                designHoursInput.value = data.services.graphicDesign.hours;
                updateArtworkCharges();
            }
        }

        // 8. Collect product items for pricing review (deferred import)
        const productReviewItems = [];
        const totalProductQty = data.products.reduce((sum, p) => {
            return sum + Object.values(p.sizes || {}).reduce((s, q) => s + q, 0);
        }, 0);

        for (const product of data.products) {
            const isCap = isCapProduct(product.partNumber, product.description || '');
            let sizePrices = null;
            if (pricingCalculator) {
                try {
                    sizePrices = await pricingCalculator.getProductSizePrices(
                        product.partNumber, totalProductQty, isCap
                    );
                } catch (e) {
                    console.warn(`[ShopWorks Import] Could not get API prices for ${product.partNumber}:`, e);
                }
            }

            productReviewItems.push({
                partNumber: product.partNumber,
                color: product.color || '',
                description: product.description || '',
                sizes: product.sizes,
                unitPrice: product.unitPrice || 0,
                isCap: isCap,
                sizePrices: sizePrices,
                totalQty: Object.values(product.sizes || {}).reduce((s, q) => s + q, 0),
                brand: product.brand || '',
                // Pass through full product for importProductRow()
                _importData: product
            });
        }

        // 9. Collect all service items for pricing review modal
        const serviceReviewItems = [];

        // 9a. Collect AL items
        if (additionalLogos.length > 0) {
            const alQty = additionalLogos.reduce((sum, al) => sum + al.quantity, 0);
            const firstAL = additionalLogos[0];
            const alStitchCount = firstAL.stitchCount || 8000;
            const swPrice = firstAL.unitPrice || 0;
            const apiPrice = pricingCalculator
                ? pricingCalculator.getServiceUnitPrice('al', alStitchCount, alQty, false)
                : null;

            serviceReviewItems.push({
                type: 'AL',
                quantity: alQty,
                stitchCount: alStitchCount,
                isCap: false,
                shopWorksPrice: swPrice,
                apiPrice: apiPrice,
                label: 'Additional Logo',
                originalData: { additionalLogos, needsDigitizing: firstAL.needsDigitizing }
            });
        }

        // 9b. Collect DECG/DECC items
        if (data.decgItems && data.decgItems.length > 0) {
            const decgGarments = data.decgItems.filter(d => d.serviceType !== 'decc');
            const deccCaps = data.decgItems.filter(d => d.serviceType === 'decc');

            if (decgGarments.length > 0) {
                let totalQty = 0, avgStitchCount = 0;
                decgGarments.forEach(d => {
                    totalQty += d.quantity;
                    avgStitchCount += (d.stitchCount || 8000) * d.quantity;
                });
                avgStitchCount = totalQty > 0 ? Math.round(avgStitchCount / totalQty) : 8000;

                const swTotal = decgGarments.reduce((sum, d) => sum + (d.unitPrice || 0) * d.quantity, 0);
                const swAvg = totalQty > 0 ? swTotal / totalQty : 0;

                const apiTotal = decgGarments.reduce((sum, d) => sum + (d.calculatedUnitPrice || 0) * d.quantity, 0);
                const apiAvg = totalQty > 0 ? apiTotal / totalQty : 0;

                serviceReviewItems.push({
                    type: 'DECG',
                    quantity: totalQty,
                    stitchCount: avgStitchCount,
                    isCap: false,
                    shopWorksPrice: swAvg,
                    apiPrice: apiAvg > 0 ? apiAvg : null,
                    label: 'Customer-Supplied Garments',
                    originalData: { items: decgGarments }
                });
            }

            if (deccCaps.length > 0) {
                let totalQty = 0, avgStitchCount = 0;
                deccCaps.forEach(d => {
                    totalQty += d.quantity;
                    avgStitchCount += (d.stitchCount || 8000) * d.quantity;
                });
                avgStitchCount = totalQty > 0 ? Math.round(avgStitchCount / totalQty) : 8000;

                const swTotal = deccCaps.reduce((sum, d) => sum + (d.unitPrice || 0) * d.quantity, 0);
                const swAvg = totalQty > 0 ? swTotal / totalQty : 0;

                const apiTotal = deccCaps.reduce((sum, d) => sum + (d.calculatedUnitPrice || 0) * d.quantity, 0);
                const apiAvg = totalQty > 0 ? apiTotal / totalQty : 0;

                serviceReviewItems.push({
                    type: 'DECC',
                    quantity: totalQty,
                    stitchCount: avgStitchCount,
                    isCap: true,
                    shopWorksPrice: swAvg,
                    apiPrice: apiAvg > 0 ? apiAvg : null,
                    label: 'Customer-Supplied Caps',
                    originalData: { items: deccCaps }
                });
            }
        }

        // 9c. Collect Monogram items
        if (data.services.monograms && data.services.monograms.length > 0) {
            const totalNames = data.services.monograms.reduce((sum, m) => sum + m.quantity, 0);
            const monogramApiPrice = pricingCalculator
                ? pricingCalculator.getServiceUnitPrice('monogram', 0, totalNames, false)
                : 12.50;

            serviceReviewItems.push({
                type: 'Monogram',
                quantity: totalNames,
                stitchCount: 0,
                isCap: false,
                shopWorksPrice: 12.50,
                apiPrice: monogramApiPrice,
                label: 'Monogram/Name',
                originalData: { monograms: data.services.monograms }
            });
        }

        // 10. Build embroidery configuration options for the modal
        const totalProductQtyForConfig = productReviewItems.reduce((sum, p) => {
            return sum + Object.values(p.sizes || {}).reduce((s, q) => s + q, 0);
        }, 0) + (data.decgItems ? data.decgItems.reduce((s, d) => s + d.quantity, 0) : 0);

        const hasGarmentProducts = productReviewItems.some(p => !p.isCap) ||
            (data.decgItems && data.decgItems.some(d => d.serviceType === 'decg'));
        const hasCapProducts = productReviewItems.some(p => p.isCap) ||
            (data.decgItems && data.decgItems.some(d => d.serviceType === 'decc'));
        const allProductsHaveSwPrice = productReviewItems.length > 0 &&
            productReviewItems.every(p => (p.unitPrice || 0) > 0);

        // Extract design info from notes
        let designInfo = null;
        if (data.notes && data.notes.length > 0) {
            const designMatch = data.notes.join(' ').match(/Design\s*#?\s*:?\s*(\d+)\s*[-–—]\s*(.+)/i);
            if (designMatch) {
                designInfo = `Design #${designMatch[1]} — ${designMatch[2].trim()}`;
            }
        }

        // Look up design stitch counts from Digitized Designs database
        let designLookup = null;
        if (data.designNumbersRaw && data.designNumbersRaw.length > 0) {
            currentStep++;
            updateImportProgress(currentStep, totalSteps, 'Looking up design stitch counts...', data.designNumbersRaw.join(', '));
            try {
                const lookupUrl = `${APP_CONFIG.API.BASE_URL}/api/digitized-designs/lookup?designs=${encodeURIComponent(data.designNumbersRaw.join(','))}`;
                const lookupResp = await Promise.race([
                    fetch(lookupUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
                ]);
                if (lookupResp.ok) {
                    const lookupData = await lookupResp.json();
                    if (lookupData.success) {
                        designLookup = lookupData;
                    }
                }
            } catch (err) {
                console.warn('[ShopWorks Import] Design stitch lookup failed (will use manual selection):', err.message);
            }

            // Fallback: look up not-found designs in ShopWorks_Designs table
            if (designLookup?.notFound?.length > 0) {
                try {
                    const fallbackUrl = `${APP_CONFIG.API.BASE_URL}/api/digitized-designs/fallback?designs=${encodeURIComponent(designLookup.notFound.join(','))}`;
                    const fbResp = await Promise.race([
                        fetch(fallbackUrl),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                    ]);
                    if (fbResp.ok) {
                        const fbData = await fbResp.json();
                        if (fbData.success && fbData.count > 0) {
                            designLookup.fallbackDesigns = fbData.designs;
                            designLookup.notFound = fbData.notFound; // update to truly-not-found
                        }
                    }
                } catch (err) {
                    console.warn('[ShopWorks Import] Fallback design lookup failed (non-critical):', err.message);
                }
            }
        }

        const embConfigOptions = {
            hasGarments: hasGarmentProducts,
            hasCaps: hasCapProducts,
            totalQty: totalProductQtyForConfig,
            digitizing: data.services.digitizing || false,
            designInfo: designInfo,
            allProductsHaveSwPrice: allProductsHaveSwPrice,
            designLookup: designLookup,
            designNumbers: data.designNumbers || [],
            designNumbersRaw: data.designNumbersRaw || []
        };

        // Show pricing review modal with embroidery config
        hideImportProgress();  // overlay (z-index 10001) blocks modal (z-index 10000)
        let reviewResults = null;
        if (productReviewItems.length > 0 || serviceReviewItems.length > 0 || embConfigOptions.hasGarments || embConfigOptions.hasCaps) {
            reviewResults = await showServicePricingReview(serviceReviewItems, productReviewItems, embConfigOptions);
        }

        // If user cancelled, abort entire import
        if (reviewResults === null) {
            closeShopWorksImportModal();
            showToast('Import cancelled', 'info');
            return;
        }

        const serviceResults = reviewResults ? reviewResults.services : [];
        const productResults = reviewResults ? reviewResults.products : [];

        // 10b. Apply embroidery configuration from modal
        const embConfig = reviewResults ? reviewResults.embConfig : null;
        if (embConfig) {
            // Garment logo config
            primaryLogo.position = embConfig.garmentPosition;
            primaryLogo.stitchCount = embConfig.garmentStitchTier;
            primaryLogo.needsDigitizing = embConfig.garmentDigitizing;
            document.getElementById('primary-position').value = embConfig.garmentPosition;
            document.getElementById('primary-stitches').value = embConfig.garmentStitchTier;
            const digitizingEl = document.getElementById('primary-digitizing');
            if (digitizingEl) {
                digitizingEl.checked = embConfig.garmentDigitizing;
                const wrapper = digitizingEl.closest('.digitizing-checkbox');
                if (wrapper) wrapper.classList.toggle('checked', embConfig.garmentDigitizing);
            }
            // Handle Full Back position sync
            if (embConfig.garmentPosition === 'Full Back') {
                document.getElementById('primary-position').disabled = true;
                const fbField = document.getElementById('fb-stitch-count-field');
                const fbInput = document.getElementById('fb-stitch-count');
                if (fbField) fbField.style.display = '';
                if (fbInput) fbInput.value = embConfig.garmentStitchTier;
                // Attach design-specific FB tier pricing for pricing engine
                primaryLogo.fbPriceTiers = embConfig.fbPriceTiers || null;
            } else {
                primaryLogo.fbPriceTiers = null;
            }

            // Cap config
            if (embConfig.capEmbellishment) {
                const capEmbEl = document.getElementById('cap-embellishment-type');
                if (capEmbEl) {
                    capEmbEl.value = embConfig.capEmbellishment;
                    handleCapEmbellishmentChange();
                }
                if (typeof capPrimaryLogo !== 'undefined') {
                    capPrimaryLogo.stitchCount = embConfig.capStitchTier;
                    const capStitchEl = document.getElementById('cap-primary-stitches');
                    if (capStitchEl) capStitchEl.value = embConfig.capStitchTier;
                }
                const capDigitizingEl = document.getElementById('cap-primary-digitizing');
                if (capDigitizingEl) {
                    capDigitizingEl.checked = embConfig.capDigitizing;
                    const wrapper = capDigitizingEl.closest('.digitizing-checkbox');
                    if (wrapper) wrapper.classList.toggle('checked', embConfig.capDigitizing);
                }
            }

            // LTM override
            setLtmControlState('emb-ltm-panel', { enabled: embConfig.ltmEnabled });

            // Store design number assignments on logo objects + update card headers + input fields
            // Use cached design lookup data to avoid redundant API calls
            const _importDesignLookup = getSprEmbConfigOptions()?.designLookup;
            if (embConfig.garmentDesignNumber) {
                primaryLogo.designNumber = embConfig.garmentDesignNumber;
                primaryLogo.designName = embConfig.garmentDesignName || '';
                updateLogoCardHeader('garment', embConfig.garmentDesignNumber);
                const gdi = document.getElementById('garment-design-number');
                if (gdi) gdi.value = embConfig.garmentDesignNumber;
                const gcb = document.getElementById('garment-design-clear');
                if (gcb) gcb.style.display = 'inline-flex';
                // Use cached data if available (no API call), fallback to lookup
                const gDesignData = _importDesignLookup?.designs?.[embConfig.garmentDesignNumber];
                if (gDesignData) {
                    applyDesignFromCache('garment', gDesignData);
                } else {
                    lookupDesignNumber('garment');
                }
            }
            if (embConfig.capDesignNumber) {
                capPrimaryLogo.designNumber = embConfig.capDesignNumber;
                capPrimaryLogo.designName = embConfig.capDesignName || '';
                updateLogoCardHeader('cap', embConfig.capDesignNumber);
                const cdi = document.getElementById('cap-design-number');
                if (cdi) cdi.value = embConfig.capDesignNumber;
                const ccb = document.getElementById('cap-design-clear');
                if (ccb) ccb.style.display = 'inline-flex';
                const cDesignData = _importDesignLookup?.designs?.[embConfig.capDesignNumber];
                if (cDesignData) {
                    applyDesignFromCache('cap', cDesignData);
                } else {
                    lookupDesignNumber('cap');
                }
            }
        }

        // 11. Pre-merge extended-size products before import
        // Parser returns LST700 and LST700_3XL as separate products — merge their sizes
        // so importProductRow creates ONE parent row with proper child rows
        const mergedProductResults = [];
        const baseMap = new Map(); // "PARTNUM|COLOR" → index in mergedProductResults

        for (const prodResult of productResults) {
            const product = prodResult._importData;
            const key = `${(product.partNumber || '').toUpperCase()}|${(product.color || '').toUpperCase()}`;

            if (baseMap.has(key)) {
                // Merge sizes into existing entry
                const mergedEntry = mergedProductResults[baseMap.get(key)];
                const baseProduct = mergedEntry._importData;
                for (const [size, qty] of Object.entries(product.sizes || {})) {
                    baseProduct.sizes[size] = (baseProduct.sizes[size] || 0) + qty;
                }
                // Preserve per-size sell price overrides from extended-size variants
                // e.g., CC8C_2X has a different sell price than CC8C base
                if (prodResult.overridePrice > 0) {
                    if (!mergedEntry.sellPriceOverrides) mergedEntry.sellPriceOverrides = {};
                    for (const size of Object.keys(product.sizes || {})) {
                        mergedEntry.sellPriceOverrides[size] = prodResult.overridePrice;
                    }
                }
            } else {
                baseMap.set(key, mergedProductResults.length);
                // Deep copy to avoid mutating original
                const entry = {
                    ...prodResult,
                    _importData: { ...product, sizes: { ...(product.sizes || {}) } }
                };
                // Store base product's override price for its sizes too
                if (prodResult.overridePrice > 0) {
                    entry.sellPriceOverrides = {};
                    for (const size of Object.keys(product.sizes || {})) {
                        entry.sellPriceOverrides[size] = prodResult.overridePrice;
                    }
                }
                mergedProductResults.push(entry);
            }
        }

        // 12. Import products (deferred from step 8)
        currentStep++;
        updateImportProgress(currentStep, totalSteps, 'Importing products...', `0 of ${mergedProductResults.length}`);
        let productsImported = 0;
        for (let i = 0; i < mergedProductResults.length; i++) {
            const prodResult = mergedProductResults[i];
            try {
                await importProductRow(prodResult._importData, prodResult.overridePrice || 0, prodResult.sellPriceOverrides || null);
                productsImported++;
            } catch (err) {
                console.warn(`Failed to import product ${prodResult.partNumber}:`, err);
            }
            currentStep++;
            updateImportProgress(currentStep, totalSteps, 'Importing products...', `${i + 1} of ${mergedProductResults.length}: ${prodResult.partNumber || 'product'}`);
            // Small delay between imports to reduce API rate limiting
            if (i < mergedProductResults.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }

        // 12. Process service results
        currentStep++;
        updateImportProgress(currentStep, totalSteps, 'Processing services...', '');
        if (serviceResults && serviceResults.length > 0) {
            for (const result of serviceResults) {
                const typeUpper = result.type.toUpperCase();

                if (typeUpper === 'AL') {
                    if (data.products.length > 0 || (data.customProducts && data.customProducts.length > 0)) {
                        globalAL.garment.enabled = true;
                        globalAL.garment.position = 'AL';
                        globalAL.garment.stitchCount = result.stitchCount;
                        if (result.originalData && result.originalData.needsDigitizing) {
                            globalAL.garment.needsDigitizing = true;
                        }

                        const alToggle = document.getElementById('garment-al-toggle');
                        const alSwitch = document.getElementById('garment-al-switch');
                        const alLabel = document.getElementById('garment-al-label');
                        const alConfig = document.getElementById('garment-al-config-new');
                        if (alToggle) alToggle.checked = true;
                        if (alSwitch) alSwitch.classList.add('active');
                        if (alLabel) alLabel.classList.add('active');
                        if (alConfig) alConfig.classList.add('visible');

                        const digitizingEl = document.getElementById('garment-al-digitizing-checkbox');
                        if (digitizingEl) digitizingEl.checked = globalAL.garment.needsDigitizing;

                        if (result.originalData && result.originalData.additionalLogos && result.originalData.additionalLogos.length > 1) {
                            const positions = result.originalData.additionalLogos.map(al => al.position || 'Additional Location');
                            const notesEl = document.getElementById('notes');
                            if (notesEl) {
                                const alNote = `Additional logo positions: ${positions.join(', ')}`;
                                notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') + alNote;
                            }
                        }

                        _syncALArrays();
                    }

                    if (data.products.length === 0 && (!data.customProducts || data.customProducts.length === 0)) {
                        createServiceProductRow('AL', {
                            quantity: result.quantity,
                            unitPrice: result.unitPrice,
                            total: result.quantity * result.unitPrice,
                            isCap: false,
                            position: 'Additional Location'
                        });
                    }
                } else if (typeUpper === 'DECG') {
                    createServiceProductRow('DECG', {
                        quantity: result.quantity,
                        stitchCount: result.stitchCount,
                        unitPrice: result.unitPrice,
                        total: result.quantity * result.unitPrice,
                        isCap: false
                    });
                } else if (typeUpper === 'DECC') {
                    createServiceProductRow('DECC', {
                        quantity: result.quantity,
                        stitchCount: result.stitchCount,
                        unitPrice: result.unitPrice,
                        total: result.quantity * result.unitPrice,
                        isCap: true
                    });
                } else if (typeUpper === 'MONOGRAM') {
                    createServiceProductRow('Monogram', {
                        quantity: result.quantity,
                        unitPrice: result.unitPrice,
                        total: result.quantity * result.unitPrice,
                        isCap: false
                    });

                    if (result.originalData && result.originalData.monograms) {
                        const nameDetails = result.originalData.monograms
                            .filter(m => m.description)
                            .map(m => m.description)
                            .join('\n');
                        if (nameDetails) {
                            const notesEl = document.getElementById('notes');
                            if (notesEl) {
                                notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') +
                                                '--- Names/Monograms ---\n' + nameDetails;
                            }
                        }
                    }
                }
            }
        }

        // 13. LTM fee handled via review items (preview checkboxes → notes)
        // Previously targeted non-existent #additional-charges element

        // 14. Handle non-SanMar products — import as real rows (uses Non_SanMar_Products DB or "Add" button)
        let customProductsImported = 0;
        if (data.customProducts && data.customProducts.length > 0) {
            for (const product of data.customProducts) {
                await importProductRow(product, product.unitPrice || 0);
                customProductsImported++;
            }

            showToast(`${customProductsImported} non-SanMar product(s) imported — verify pricing`, 'info', 5000);
        }

        // Hide variant-only parents (products with no standard sizes, only extended children)
        hideVariantOnlyParents();

        // 15. Populate notes from import (employee names, warnings, etc.)
        if (data.notes && data.notes.length > 0) {
            const notesEl = document.getElementById('notes');
            if (notesEl) {
                const importNotes = '--- ShopWorks Import Notes ---\n' + data.notes.join('\n');
                notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') + importNotes;
            }
        }

        // 16. Create service rows for sewing items (SEG/SECC)
        if (data.services.sewing && data.services.sewing.length > 0) {
            for (const s of data.services.sewing) {
                const sewPartNumber = s.partNumber || (s.isCap ? 'SECC' : 'SEG');
                createServiceProductRow(sewPartNumber, {
                    quantity: s.quantity || 0,
                    unitPrice: s.unitPrice || 10.00,
                    total: (s.quantity || 0) * (s.unitPrice || 10.00),
                    isCap: s.isCap || false
                });
            }
        }

        // 16b. Create service rows for weight items
        if (data.services.weights && data.services.weights.length > 0) {
            for (const w of data.services.weights) {
                createServiceProductRow('WEIGHT', {
                    quantity: w.quantity || 0,
                    unitPrice: w.unitPrice || 6.25,
                    total: (w.quantity || 0) * (w.unitPrice || 6.25),
                    isCap: false
                });
            }
        }

        // 16c. Create service rows for design transfer items
        if (data.services.designTransfer && data.services.designTransfer.length > 0) {
            for (const dt of data.services.designTransfer) {
                createServiceProductRow('DT', {
                    quantity: dt.quantity || 1,
                    unitPrice: dt.unitPrice || 50.00,
                    total: (dt.quantity || 1) * (dt.unitPrice || 50.00),
                    isCap: false
                });
            }
        }

        // 16d. Create service rows for contract items
        if (data.services.contract && data.services.contract.length > 0) {
            for (const ctr of data.services.contract) {
                const ctrPN = ctr.isCap ? 'CTR-CAP' : 'CTR-GARMT';
                createServiceProductRow(ctrPN, {
                    quantity: ctr.quantity || 1,
                    unitPrice: ctr.unitPrice || 0,
                    total: (ctr.quantity || 1) * (ctr.unitPrice || 0),
                    isCap: ctr.isCap || false
                });
            }
        }

        // 16e. Auto-set cap embellishment type if detected (3D-EMB or Laser Patch)
        if (data.services.capEmbellishments && data.services.capEmbellishments.length > 0) {
            const ce = data.services.capEmbellishments[0]; // Use first detected type
            const capEmbEl = document.getElementById('cap-embellishment-type');
            if (capEmbEl && ce.type) {
                capEmbEl.value = ce.type;
                handleCapEmbellishmentChange();
            }
        }

        // 17. Import checked review items as notes (invalid items, AS-GARM/CAP, LTM)
        if (data._allReviewItems && data._allReviewItems.length > 0) {
            const checkedItems = [];
            document.querySelectorAll('.review-item-check:checked').forEach(cb => {
                const idx = parseInt(cb.dataset.index);
                if (data._allReviewItems[idx]) checkedItems.push(data._allReviewItems[idx]);
            });
            if (checkedItems.length > 0) {
                const notesEl = document.getElementById('notes');
                if (notesEl) {
                    const reviewNotes = checkedItems.map(item => {
                        const priceStr = item.unitPrice > 0
                            ? ` — $${item.unitPrice.toFixed(2)}/ea × ${item.quantity || 1}`
                            : '';
                        return `${item.partNumber || '(no PN)'}: ${item.description || ''}${priceStr}`;
                    }).join('\n');
                    notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') +
                        '--- Imported Review Items ---\n' + reviewNotes;
                }
            }
        }

        // 18. Catch-all: dump any unprocessed service data into notes
        const handledServiceKeys = [
            'digitizing', 'digitizingCodes', 'digitizingCount', 'digitizingFees',
            'patchSetup', 'additionalLogo', 'additionalLogos',
            'artCharges', 'graphicDesign', 'monograms',
            'rush', 'ltmFee', 'sewing', 'additionalStitches',
            'shipping', 'weights',
            'designTransfer', 'contract',
            'capEmbellishments'
        ];
        const unhandled = Object.entries(data.services || {})
            .filter(([key, val]) => !handledServiceKeys.includes(key) && val != null)
            .filter(([_key, val]) => {
                if (Array.isArray(val) && val.length === 0) return false;
                if (val === false) return false;
                if (typeof val === 'number' && val === 0) return false;
                return true;
            });
        if (unhandled.length > 0) {
            const notesEl = document.getElementById('notes');
            if (notesEl) {
                const lines = unhandled.map(([key, val]) => {
                    if (Array.isArray(val)) {
                        return val.map(item =>
                            `${key.toUpperCase()}: ${item.description || item.partNumber || ''} — Qty: ${item.quantity || ''}, $${(item.unitPrice || 0).toFixed(2)}/ea`
                        ).join('\n');
                    }
                    if (typeof val === 'object' && val.amount !== undefined) {
                        return `${key.toUpperCase()}: $${val.amount.toFixed(2)}${val.description ? ' — ' + val.description : ''}`;
                    }
                    return `${key.toUpperCase()}: ${JSON.stringify(val)}`;
                }).join('\n');
                notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') +
                    '--- Unrecognized Services ---\n' + lines;
            }
        }

        // Auto-show notes section if any notes were written (import notes, AL positions, monogram names, DECG stitch counts, sewing)
        const finalNotesEl = document.getElementById('notes');
        if (finalNotesEl && finalNotesEl.value.trim()) {
            const section = document.getElementById('notes-section');
            if (section && section.classList.contains('collapsed')) {
                section.classList.remove('collapsed');
                const body = section.querySelector('.notes-body');
                const icon = section.querySelector('.notes-toggle-icon');
                if (body) body.style.display = 'block';
                if (icon) icon.style.transform = 'rotate(180deg)';
            }
            updateNotesBadge();
        }

        // Recalculate pricing
        recalculatePricing();
        markAsUnsaved();

        // Store import metadata for Caspio save (design numbers, warnings, unmatched lines)
        lastImportMetadata = {
            designNumbers: data.designNumbers || [],
            digitizingCodes: data.services?.digitizingCodes || [],
            warnings: data.warnings || [],
            reviewItems: (data.reviewItems || []).map(r => `${r.partNumber || '(no PN)'}: ${r.description || ''}`),
            unmatchedLines: (data.unmatchedLines || []).map(u => `[${u.section}] ${u.line}`),
            paidToDate: data.orderSummary?.paidToDate || 0,
            balanceAmount: data.orderSummary?.balance || 0,
            orderNotes: data.orderNotes || '',
            swTotal: data.orderSummary?.total || 0,
            swSubtotal: data.orderSummary?.subtotal || 0,
            carrier: Array.isArray(data.packageTracking) ? data.packageTracking.map(t => t.carrier).filter(Boolean).join(', ') : '',
            trackingNumber: Array.isArray(data.packageTracking) ? data.packageTracking.map(t => t.trackingNumber).filter(Boolean).join(', ') : '',
            parsedServices: {
                additionalLogos: data.services?.additionalLogos || [],
                monograms: data.services?.monograms || [],
                weights: data.services?.weights || [],
                digitizingFees: data.services?.digitizingFees || [],
                decgItems: data.decgItems || []
            },
            designLookup: designLookup || null
        };

        // Post-import validation: detect silently dropped rows
        const expectedProducts = (productsImported || 0) + (customProductsImported || 0);
        const productRows = document.querySelectorAll('#product-tbody tr[data-style]:not(.child-row)');
        const validProducts = Array.from(productRows).filter(r =>
            r.dataset.color || r.dataset.nonSanmar === 'true'
        ).length;
        if (validProducts < expectedProducts) {
            const dropped = expectedProducts - validProducts;
            console.warn(`[ShopWorks Import] ${dropped} of ${expectedProducts} product rows may be incomplete (missing color). Check rows for issues.`);
            showToast(`Warning: ${dropped} product(s) may not have imported correctly. Review rows for missing colors.`, 'warning', 8000);
        }

        // Flag non-SanMar products with $0 pricing + collect for summary banner
        const nonSanMarBannerItems = [];
        document.querySelectorAll('#product-tbody tr[data-non-sanmar="true"]').forEach(nsRow => {
            const nsRowId = parseInt(nsRow.dataset.rowId);
            const sellPrice = parseFloat(nsRow.dataset.sellPrice) || 0;
            const nsStyle = nsRow.dataset.style || '';
            const nsDesc = nsRow.dataset.productName || nsRow.querySelector('[data-field="description"]')?.value || '';

            nonSanMarBannerItems.push({
                rowId: nsRowId,
                style: nsStyle,
                description: nsDesc,
                price: sellPrice
            });

            // Update price cell with pencil icon affordance
            updateNonSanmarPriceCell(nsRow, nsRowId);
        });

        // Finalize progress
        updateImportProgress(totalSteps, totalSteps, 'Import complete!', '');

        // Close modal and show success
        hideImportProgress();
        closeShopWorksImportModal();

        // Show import summary banner (non-SanMar detail)
        // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
        const sanMarProductCount = productsImported - nonSanMarBannerItems.filter(i =>
            productResults.some(pr => pr.partNumber === i.style)
        ).length;
        // Count SanMar vs non-SanMar among all imported product rows
        const allImportedRows = document.querySelectorAll('#product-tbody tr[data-style]:not(.child-row):not(.service-product-row):not(.fee-row)');
        const sanMarRowCount = Array.from(allImportedRows).filter(r => r.dataset.nonSanmar !== 'true').length;
        if (nonSanMarBannerItems.length > 0) {
            showImportSummaryBanner(sanMarRowCount, nonSanMarBannerItems);
        }

        const summary = [];
        if (productsImported > 0) {
            const overrideCount = productResults.filter(p => p.overridePrice > 0).length;
            summary.push(`${productsImported} products` + (overrideCount > 0 ? ` (${overrideCount} price override)` : ''));
        }
        if (customProductsImported > 0) summary.push(`${customProductsImported} non-SanMar`);
        if (data.services.digitizing) summary.push('digitizing');
        if (serviceResults && serviceResults.length > 0) {
            const serviceTypes = serviceResults.map(r => r.type);
            if (serviceTypes.includes('AL')) summary.push('additional logo(s)');
            if (serviceTypes.includes('DECG') || serviceTypes.includes('DECC')) summary.push('customer-supplied items');
            if (serviceTypes.includes('Monogram') || serviceTypes.includes('MONOGRAM')) summary.push('monogram/names');
        }

        showToast(`Imported: ${summary.join(', ')}`, 'success', 5000);

        // Persistent warning if DECG prices used fallback values (API was down during parse)
        if (data.decgApiFailed) {
            showToast('DECG prices may be outdated — API was unavailable during import. Verify prices before sending.', 'warning');
        }

    } catch (error) {
        console.error('Import failed:', error);
        showToast('Import failed: ' + error.message, 'error');
    } finally {
        hideImportProgress();
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Import Items';
    }
}

/**
 * Select sales rep by email address
 */
function selectSalesRepByEmail(email) {
    const select = document.getElementById('sales-rep');
    if (!select || !email) return;

    const lowerEmail = email.toLowerCase();
    for (const option of select.options) {
        if (option.value.toLowerCase() === lowerEmail) {
            select.value = option.value;
            return;
        }
    }
}

/**
 * Import a single product row from ShopWorks data
 */
async function importProductRow(product, sellPriceOverride = 0, sellPriceOverrides = null) {
    // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
    const totalQty = Object.values(product.sizes).reduce((sum, q) => sum + q, 0);

    // Add a new row
    addNewRow();
    const row = document.querySelector('tr.new-row');
    if (!row) throw new Error('Failed to create row');
    row.classList.remove('new-row');  // Remove immediately to prevent collision with next import

    const rowId = parseInt(row.dataset.rowId);
    const styleInput = row.querySelector('.style-input');

    // Store import data on the row (for non-SanMar "Add" modal pre-fill and re-import)
    row.dataset.importData = JSON.stringify({
        partNumber: product.partNumber,
        color: product.color || '',
        description: product.description || '',
        sizes: product.sizes,
        unitPrice: product.unitPrice || 0,
        brand: product.brand || ''
    });

    // Store ShopWorks unit price for pricing audit (survives selectColor which only clears sellPrice)
    row.dataset.swUnitPrice = (product.unitPrice || 0).toString();

    // Set sell price override BEFORE any pricing calls (selectColor, onSizeChange, etc.)
    if (sellPriceOverride > 0) {
        row.dataset.sellPrice = sellPriceOverride.toString();
    }

    // 1. Set the style number and trigger load
    if (product.partNumber) {
        styleInput.value = product.partNumber;
        await onStyleChange(styleInput, rowId);

        // Re-apply — onStyleChange may overwrite sellPrice for non-SanMar products
        if (sellPriceOverride > 0) {
            row.dataset.sellPrice = sellPriceOverride.toString();
        }
    } else {
        // Empty PN (e.g., "drinkware laser logo setup") — skip API lookup,
        // go straight to notFound handler below
        row.dataset.notFound = 'true';
        row.dataset.style = product.description || 'Custom Item';
        const descInput = row.querySelector('[data-field="description"]');
        if (descInput) {
            descInput.value = product.description || 'Custom Item';
            descInput.readOnly = false;
        }
        row.dataset.productName = product.description || 'Custom Item';
    }

    // 2. Wait for colors to populate dropdown
    await new Promise(resolve => setTimeout(resolve, 600));

    // 3. Check if this row was populated as non-SanMar
    const isNonSanmar = row.dataset.nonSanmar === 'true';

    if (isNonSanmar) {
        // Non-SanMar row — use simplified color/size import
        await reImportNonSanmarRow(row, rowId, {
            color: product.color,
            sizes: product.sizes,
            sellPriceOverrides: sellPriceOverrides
        });
        return row;
    }

    // Row is still "Not found" — force-import as non-SanMar so sizes work
    if (row.dataset.notFound === 'true') {
        // Auto-create non-SanMar product in Caspio for future imports
        if (product.partNumber) {
            try {
                const parsed = parseShopWorksDescription(product.description || '', product.partNumber);
                const createPayload = {
                    StyleNumber: product.partNumber,
                    Brand: parsed.brand || product.brand || 'Unknown',
                    ProductName: parsed.name || product.description || product.partNumber,
                    Category: parsed.category || '',
                    DefaultSellPrice: sellPriceOverride || product.unitPrice || 0,
                    DefaultColors: product.color || '',
                    AvailableSizes: Object.keys(product.sizes || {}).join(','),
                    PricingMethod: 'FIXED',
                    Notes: 'Auto-created from ShopWorks import'
                };
                const resp = await fetch(`${APP_CONFIG.API.BASE_URL}/api/non-sanmar-products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createPayload)
                });
                if (resp.ok) {
                    showToast(`Auto-added ${product.partNumber} to product database`, 'success', 3000);
                }
                // If POST fails (duplicate, etc.), continue silently — force-import still works
            } catch (e) {
                console.warn(`[Import] Auto-create non-SanMar failed for ${product.partNumber}:`, e.message);
            }
        }

        // Convert from "Not Found" to non-SanMar so size inputs get enabled
        row.dataset.nonSanmar = 'true';
        delete row.dataset.notFound;

        // Remove the "Add" button (no longer needed since we're force-importing)
        const addBtn = row.querySelector('.btn-add-nonsanmar');
        if (addBtn) addBtn.remove();

        // Set sell price from pricing review modal
        if (sellPriceOverride > 0) {
            row.dataset.sellPrice = sellPriceOverride.toString();
        }

        // Preserve ShopWorks description as ProductName for all output paths
        const importData = JSON.parse(row.dataset.importData || '{}');
        if (importData.description) {
            const descInput = row.querySelector('[data-field="description"]');
            if (descInput) descInput.value = importData.description;
            row.dataset.productName = importData.description;
        }

        // Detect cap vs garment and enable appropriate size inputs
        const isCap = isCapProduct(product.partNumber, product.description || '');
        if (isCap) {
            row.dataset.isCap = 'true';
            const capBadge = document.getElementById(`cap-badge-${rowId}`);
            if (capBadge) capBadge.style.display = 'inline-flex';
        } else {
            row.dataset.isCap = 'false';
        }

        // OSFA detection — works for caps, beanies, bags (independent of isCap)
        const hasOSFA = product.sizes && product.sizes['OSFA'];
        const sizeKeys = product.sizes ? Object.keys(product.sizes) : [];
        const isOsfaOnly = hasOSFA && sizeKeys.length === 1;
        if (isOsfaOnly) {
            row.dataset.sizeCategory = 'osfa-only';
            row.dataset.isOsfaOnly = 'true';
            row.dataset.osfaQty = product.sizes['OSFA'];
            row.dataset.availableSizes = JSON.stringify(['OSFA']);
            if (isCap) row.dataset.capSizes = JSON.stringify(['OSFA']);
            const qtyDisplay = document.getElementById(`row-qty-${rowId}`);
            if (qtyDisplay) qtyDisplay.textContent = product.sizes['OSFA'];
        } else {
            // Standard sizes (S, M, L, etc.) — enable all size inputs
            row.querySelectorAll('.size-input').forEach(input => input.disabled = false);
        }

        // Reorder row into correct section (caps vs garments)
        reorderRowByProductType(row);
        updateCapLogoSectionVisibility();

        // Now apply color and sizes — inputs are enabled so quantities will set
        // For OSFA caps, sizes are already set above; reImportNonSanmarRow
        // handles color and any non-OSFA sizes
        const importColor = product.color || 'N/A';
        row.dataset.color = importColor;
        row.dataset.catalogColor = importColor;

        await reImportNonSanmarRow(row, rowId, {
            color: importColor,
            sizes: product.sizes,
            sellPriceOverrides: sellPriceOverrides
        });

        // Trigger size change to update qty display and pricing
        onSizeChange(rowId);
        return row;
    }

    // 4. SELECT COLOR for SanMar products (this enables size inputs!)
    if (product.color) {
        const pickerDropdown = row.querySelector('.color-picker-dropdown');
        if (pickerDropdown) {
            // Try exact match first on COLOR_NAME or CATALOG_COLOR
            let colorOption = pickerDropdown.querySelector(
                `[data-color-name="${product.color}"], [data-catalog-color="${product.color}"]`
            );

            // Fallback: partial/fuzzy match for abbreviated colors
            // e.g., "Athletic Hthr" should match "Athletic Heather"
            if (!colorOption) {
                const options = pickerDropdown.querySelectorAll('.color-picker-option');
                const searchColor = product.color.toLowerCase().replace(/\s+/g, '');
                for (const opt of options) {
                    const optColorName = (opt.dataset.colorName || '').toLowerCase().replace(/\s+/g, '');
                    const optCatalogColor = (opt.dataset.catalogColor || '').toLowerCase().replace(/\s+/g, '');
                    // Check COLOR_NAME or CATALOG_COLOR for fuzzy match
                    if (optColorName.includes(searchColor) ||
                        searchColor.includes(optColorName.split(/\s/)[0]) ||
                        optColorName.startsWith(searchColor.substring(0, 5)) ||
                        optCatalogColor.includes(searchColor) ||
                        searchColor.includes(optCatalogColor)) {
                        colorOption = opt;
                        break;
                    }
                }
            }

            if (colorOption) {
                selectColor(rowId, colorOption, true);
                // Wait for detectAndAdjustSizeUI to complete
                await new Promise(resolve => setTimeout(resolve, 300));
                // Re-apply — selectColor() clears sellPrice for SanMar products (line 4668)
                if (sellPriceOverride > 0) {
                    row.dataset.sellPrice = sellPriceOverride.toString();
                }
            } else {
                console.warn(`[ShopWorks Import] Color "${product.color}" not found for ${product.partNumber} — row may be excluded from quote output`);
            }
        }
    }

    // 5. Set sizes (inputs should now be enabled from selectColor)
    // Extended sizes (from SIZE06_EXTENDED_SIZES) need child rows, not direct input
    // Also: 2XL typically uses Size05 column, but if disabled, treat it as extended size
    const IMPORT_EXTENDED_SIZES = [...SIZE06_EXTENDED_SIZES, '2XL'];

    // Detect if this is a cap product for size mapping
    const isCapRow = row.dataset.isCap === 'true' ||
                     isCapProduct(product.partNumber, product.description || '');

    // Cap size mapping: ShopWorks uses S, M, L but caps have S/M, M/L, L/XL, OSFA
    const CAP_SIZE_MAP = {
        'S': 'S/M',
        'M': 'M/L',
        'L': 'L/XL',
        'XL': 'L/XL',
        'S/M': 'S/M',
        'M/L': 'M/L',
        'L/XL': 'L/XL',
        'SM/MD': 'S/M',
        'LG/XL': 'L/XL',
        'OSFA': 'OSFA',
        'ONE SIZE': 'OSFA'
    };

    for (const [size, qty] of Object.entries(product.sizes)) {
        if (qty > 0) {
            // Map imported size to our internal format
            let internalSize = size;
            if (size === 'LG') internalSize = 'L';
            if (size === '2X') internalSize = '2XL';
            // XXL stays as 'XXL' — distinct size for Ladies/Womens products (589 products use _XXL, not _2XL)
            if (size === 'XXXL' || size === '3X') internalSize = '3XL';
            if (size === 'XXXXL' || size === '4X') internalSize = '4XL';
            if (size === '5X') internalSize = '5XL';
            if (size === '6X') internalSize = '6XL';

            // Apply cap size mapping if this is a cap
            if (isCapRow && CAP_SIZE_MAP[internalSize.toUpperCase()]) {
                const capSize = CAP_SIZE_MAP[internalSize.toUpperCase()];
                internalSize = capSize;
            }

            // OSFA-only products (beanies, caps, bags): put qty in parent row directly
            // Matches popup behavior at applyExtendedSizes() line 1804
            if (internalSize === 'OSFA' && row.dataset.sizeCategory === 'osfa-only') {
                row.dataset.osfaQty = qty;
                row.dataset.isOsfaOnly = 'true';
                document.getElementById(`row-qty-${rowId}`).textContent = qty;
                continue;
            }

            // Check if this is an extended size that needs a child row
            // These sizes are readonly/disabled in the parent row and must use child rows
            const sizeInput = row.querySelector(`[data-size="${internalSize}"]`);
            const needsChildRow = IMPORT_EXTENDED_SIZES.includes(internalSize) ||
                                  (sizeInput && sizeInput.disabled);


            if (needsChildRow) {
                // Use the existing extended size function to create child row
                createOrUpdateExtendedChildRow(rowId, internalSize, qty);

                // Set per-size sell price override on child row if available
                // recalculatePricing() already reads childRow.dataset.sellPrice (lines 6683-6710)
                if (sellPriceOverrides && sellPriceOverrides[size]) {
                    const childRow = document.querySelector(`tr.child-row[data-parent-row="${rowId}"][data-size="${internalSize}"]`);
                    if (childRow) {
                        childRow.dataset.sellPrice = sellPriceOverrides[size].toString();
                    }
                } else if (sellPriceOverride > 0) {
                    // Fallback: use the flat override for all child rows
                    const childRow = document.querySelector(`tr.child-row[data-parent-row="${rowId}"][data-size="${internalSize}"]`);
                    if (childRow) {
                        childRow.dataset.sellPrice = sellPriceOverride.toString();
                    }
                }

                // For 2XL/XXL: Also set parent row's 2XL input so onSizeChange doesn't remove the child row
                // onSizeChange checks parent input value and removes child row if value=0
                if (internalSize === '2XL' || internalSize === 'XXL') {
                    const parentXxlInput = row.querySelector('[data-size="2XL"]');
                    if (parentXxlInput) {
                        parentXxlInput.value = qty;
                    }
                }
            } else if (sizeInput) {
                // Standard size - set directly on parent row
                sizeInput.value = qty;
            } else {
                console.warn(`[ShopWorks Import] No input found for size ${internalSize}`);
            }
        }
    }

    // 6. Trigger size change to recalculate
    onSizeChange(rowId);
    return row;
}
