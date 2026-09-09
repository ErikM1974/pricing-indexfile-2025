/* inventory-details.js — page module (extracted from inline <script type="module">, Rule 3, 2026-09-05). */
import { API } from '/product/services/api.js';
import { InventoryDisplay } from '/product/components/inventory.js';

// Initialize
const api = new API();
const inventoryDisplay = new InventoryDisplay(document.getElementById('inventory-display'));

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const styleNumber = urlParams.get('style');
const colorCode = urlParams.get('color');

// State
let productData = null;
let selectedColor = colorCode;
let inventoryRequest = 0;

// Update back link
function updateBackLink() {
    const backLink = document.getElementById('back-to-product');
    if (backLink) {
        backLink.href = `/product.html?StyleNumber=${styleNumber}&COLOR=${encodeURIComponent(selectedColor)}`;
    }
}

// Load product data
async function loadProduct() {
    try {
        showLoading(true);
        productData = await api.getProduct(styleNumber);

        if (!productData || !Array.isArray(productData.colors) || !productData.colors.length || productData.colors.some(color => !(color.catalogColor || color.CATALOG_COLOR) || !(color.colorName || color.COLOR_NAME))) {
            throw new Error('Product not found');
        }

        // Update header
        const productName = productData.title || productData.productTitle || productData.PRODUCT_TITLE || styleNumber;
        document.getElementById('header-product-name').textContent = `${productName} (${styleNumber})`;

        // Resolve the selected colour FIRST, then render the options — rendering before the
        // fallback ran left no swatch marked "selected" when the URL carried no COLOR.
        if (productData.colors && productData.colors.length > 0) {
            let selectedColorData = null;
            if (selectedColor) {
                selectedColorData = productData.colors.find(c => 
                    (c.catalogColor || c.CATALOG_COLOR) === selectedColor ||
                    (c.colorName || c.COLOR_NAME) === selectedColor
                );
            }
            if (!selectedColorData) {
                selectedColorData = productData.colors[0];
                selectedColor = selectedColorData.catalogColor || selectedColorData.CATALOG_COLOR;
            }
            updateProductImage(selectedColorData);
        }
        populateColors(productData.colors || []);

        // Load inventory for selected color
        if (selectedColor) {
            await loadInventory(selectedColor);
        }

        updateBackLink();

    } catch (error) {
        console.error('Failed to load product:', error);
        document.getElementById('header-product-name').textContent = styleNumber;
        showError('Failed to load product data', loadProduct);
    } finally {
        showLoading(false);
    }
}

// Populate color options
function populateColors(colors) {
    const container = document.getElementById('color-options');
    container.innerHTML = '';

    colors.forEach(color => {
        const colorCode = color.catalogColor || color.CATALOG_COLOR;
        const colorName = color.colorName || color.COLOR_NAME;

        const option = document.createElement('div');
        option.className = 'color-option';
        option.dataset.color = colorCode;

        if (colorCode === selectedColor) {
            option.classList.add('selected');
        }

        // Create swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';

        if (color.COLOR_SQUARE_IMAGE || color.colorSquareImage) {
            swatch.style.setProperty('--swatch', `url('${color.COLOR_SQUARE_IMAGE || color.colorSquareImage}') center / cover`);
        } else if (color.HEX_CODE || color.hexCode) {
            swatch.style.setProperty('--swatch', color.HEX_CODE || color.hexCode);
        }

        // Create name
        const name = document.createElement('span');
        name.textContent = colorName;

        option.appendChild(swatch);
        option.appendChild(name);

        option.setAttribute('role', 'button');
        option.tabIndex = 0;
        option.setAttribute('aria-pressed', colorCode === selectedColor ? 'true' : 'false');
        option.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); option.click(); } });
        // Click handler
        option.addEventListener('click', () => {
            // Update selection
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-pressed', 'true');

            // Update product image
            updateProductImage(color);

            // Load inventory
            selectedColor = colorCode;
            loadInventory(colorCode);
            updateBackLink();
        });

        container.appendChild(option);
    });
}

// Load inventory
async function loadInventory(colorCode) {
    const request = ++inventoryRequest;
    const display = document.getElementById('inventory-display');
    display.innerHTML = '<p role="status">Loading inventory for ' + esc(colorCode) + '…</p>';
    try {
        const inventory = await api.getInventory(styleNumber, colorCode);
        if (request !== inventoryRequest) return;
        const numbers = values => Array.isArray(values) && values.every(value => typeof value === 'number' && Number.isFinite(value));
        if (!inventory || !Array.isArray(inventory.sizes) || !Array.isArray(inventory.warehouses) ||
            !numbers(inventory.sizeTotals) || inventory.sizeTotals.length !== inventory.sizes.length ||
            typeof inventory.grandTotal !== 'number' || !Number.isFinite(inventory.grandTotal) ||
            inventory.warehouses.some(warehouse => !warehouse || !warehouse.name || !numbers(warehouse.inventory) ||
                warehouse.inventory.length !== inventory.sizes.length || typeof warehouse.total !== 'number' || !Number.isFinite(warehouse.total))) {
            throw new Error('Incomplete inventory response');
        }
        // Catalog size responses carry placeholder zeros, not warehouse quantities.
        if (inventory.source === 'sanmar-bulk' || !inventory.warehouses.length) {
            display.innerHTML = '<div class="inventory-unavailable" role="status"><h2>Warehouse availability unavailable</h2><p>Stock quantities were not supplied for this color.</p><p>Catalog sizes: ' + esc(inventory.sizes.join(', ') || 'Not supplied') + '</p></div>';
        } else {
            inventoryDisplay.update(inventory);
            display.querySelector('.inventory-table')?.classList.add('data-table');
            display.querySelector('.print-inventory')?.classList.add('btn', 'btn-secondary');
            const table = display.querySelector('.table-wrapper');
            if (table) { table.classList.add('table-scroll'); table.tabIndex = 0; table.setAttribute('role', 'region'); table.setAttribute('aria-label', 'Warehouse inventory by size'); }
        }
    } catch (error) {
        if (request !== inventoryRequest) return;
        console.error('Failed to load inventory:', error);
        showError('Failed to load inventory', () => loadInventory(selectedColor));
    }
}

// Show/hide loading
function showLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

// Show error
function showError(message, retry) {
    const display = document.getElementById('inventory-display');
    display.innerHTML = '<div class="inventory-error" role="alert"><p>' + esc(message) + '</p></div>';
    if (retry) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = 'Retry';
        button.addEventListener('click', () => { api.clearCache(); retry(); });
        display.firstElementChild.appendChild(button);
    }
}

// Update product image
function updateProductImage(colorData) {
    const productImage = document.getElementById('sidebar-product-image');
    productImage.hidden = false;
    document.querySelector('.image-unavailable')?.remove();
    if (colorData && (colorData.MAIN_IMAGE_URL || colorData.mainImageUrl)) {
        productImage.src = colorData.MAIN_IMAGE_URL || colorData.mainImageUrl;
        productImage.alt = `${productData.title || productData.productTitle || 'Product'} - ${colorData.colorName || colorData.COLOR_NAME}`;
    }
}

document.getElementById('sidebar-product-image').addEventListener('error', event => {
    const img = event.target; img.hidden = true;
    if (!img.parentElement.querySelector('.image-unavailable')) {
        const note = document.createElement('p'); note.className = 'image-unavailable'; note.textContent = 'Product image unavailable'; img.after(note);
    }
});

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('header-style-search');
    const searchResults = document.getElementById('header-search-results');
    let searchTimeout = null;
    let searchRequest = 0;

    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        const request = ++searchRequest;

        clearTimeout(searchTimeout);
        searchResults.classList.add('hidden');

        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const results = await api.searchProducts(query);
                if (request !== searchRequest) return;
                if (!Array.isArray(results)) throw new Error('Incomplete search response');
                displaySearchResults(results);
            } catch (error) {
                if (request !== searchRequest) return;
                console.error('[Inventory Search] Failed:', error);
                searchResults.innerHTML = '<div class="search-msg search-msg--error" role="alert">Search failed. Please try again.</div>';
                searchResults.classList.remove('hidden');
            }
        }, 300);
    });

    searchInput.addEventListener('keydown', event => { if (event.key === 'Escape') { searchRequest++; clearTimeout(searchTimeout); searchResults.classList.add('hidden'); } });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchRequest++; clearTimeout(searchTimeout);
            searchResults.classList.add('hidden');
        }
    });
}

// Display search results
function displaySearchResults(results) {
    const searchResults = document.getElementById('header-search-results');

    if (!results || results.length === 0) {
        searchResults.innerHTML = '<div class="search-msg" role="status">No products found</div>';
        searchResults.classList.remove('hidden');
        return;
    }


    const html = results.slice(0, 5).map(product => {
        // Handle different API response formats
        const styleNumber = product.value || product.STYLE_NUMBER || product.styleNumber || product.style_number || 'Unknown';
        const productName = product.label || product.PRODUCT_NAME || product.PRODUCT_TITLE || product.productTitle || product.productName || product.title || product.name || 'Product';

        return `
            <button type="button" class="search-result-item" data-style="${esc(styleNumber)}">
                <div class="search-result-style">${esc(styleNumber)}</div>
                <div class="search-result-name">${esc(productName)}</div>
            </button>
        `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.classList.remove('hidden');
}

function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Navigate to product (search results are buttons carrying data-style)
function navigateToProduct(style) {
    window.location.href = `/inventory-details.html?style=${encodeURIComponent(style)}`;
}
document.getElementById('header-search-results').addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item[data-style]');
    if (item) navigateToProduct(item.dataset.style);
});

// Pricing dropdown (was an inline handler; now a real disclosure)
const pricingBtn = document.querySelector('.btn-pricing');
const pricingMenu = document.getElementById('pricing-dropdown-menu');
function setPricingOpen(open) {
    if (!pricingMenu) return;
    pricingMenu.classList.toggle('show', open);
    if (pricingBtn) pricingBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
if (pricingBtn) pricingBtn.addEventListener('click', () => setPricingOpen(!pricingMenu.classList.contains('show')));
document.querySelectorAll('.dropdown-item[data-pricing]').forEach((a) => {
    a.addEventListener('click', (e) => {
        e.preventDefault();
        const type = a.dataset.pricing;
        const baseUrl = type === 'cap-embroidery' ? '/cap-embroidery-pricing-integrated.html' : `/${type}-pricing.html`;
        const params = `?StyleNumber=${encodeURIComponent(styleNumber || '')}&COLOR=${encodeURIComponent(selectedColor || '')}`;
        window.location.href = baseUrl + params;
    });
});
const printBtn = document.querySelector('.print-btn');
if (printBtn) printBtn.addEventListener('click', () => window.print());

// Close dropdown when clicking outside / on Escape
document.addEventListener('click', (e) => {
    if (!pricingMenu) return;
    const button = e.target.closest('.btn-pricing');
    if (!button && !pricingMenu.contains(e.target)) setPricingOpen(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPricingOpen(false); });

// Initialize on load
if (styleNumber) {
    loadProduct();
    initializeSearch();
} else {
    showError('No product specified');
}
