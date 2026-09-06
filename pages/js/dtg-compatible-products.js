/* dtg-compatible-products.js — page script (extracted from inline <script>, Rule 3, 2026-09-05).
 * Proxy base from APP_CONFIG (Rule 6) — the page used to hardcode the Heroku host. */
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
// DTG-compatible products (high cotton content)
const dtgCompatibleStyles = [
    'PC54', 'PC450', 'PC61', 'PC78H', 'PC55', 'PC61LS', 'PC600',
    'PC90H', 'BC3001', 'PC54LS', 'CTK87'
];

// Product cache
const productCache = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize universal header
    window.universalCartHeader = new UniversalCartHeader({
        isCartPage: false,
        showContactInfo: true
    });

    loadDTGProducts();
});

// Load DTG-compatible products
async function loadDTGProducts() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const productsGrid = document.getElementById('productsGrid');
    const productCount = document.getElementById('productCount');

    loadingIndicator.hidden = false;
    productsGrid.hidden = true;

    const products = [];
    let loadErrors = '';

    // Fetch product details for each DTG-compatible style
    for (const styleNumber of dtgCompatibleStyles) {
        try {
            if (!productCache[styleNumber]) {
                const response = await fetch(`${API_BASE}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`);
                if (response.ok) {
                    const details = await response.json();
                    if (details && details.length > 0) {
                        productCache[styleNumber] = details;
                    }
                }
            }

            if (productCache[styleNumber]) {
                const firstProduct = productCache[styleNumber][0];
                products.push({
                    style: styleNumber,
                    description: firstProduct.PRODUCT_TITLE?.split('.')[0]?.trim() || 'Unknown Product',
                    brand: firstProduct.MILL || 'Unknown Brand',
                    details: productCache[styleNumber]
                });
            }
        } catch (error) {
            console.error(`Error fetching ${styleNumber}:`, error);
            loadErrors = error.message || 'request failed';
        }
    }

    // Update product count
    productCount.textContent = `${products.length} products perfect for DTG printing`;

    // Display products
    displayProducts(products);

    loadingIndicator.hidden = true;
    productsGrid.hidden = false;
    if (!products.length) {
        // Erik's #1 rule: a failed catalogue read must not look like an empty catalogue
        productsGrid.innerHTML = '<p class="dtg-empty" role="alert">Products could not be loaded' + (loadErrors ? ' (' + esc(loadErrors) + ')' : '') + '. <button type="button" class="btn-sample dtg-retry" id="dtg-retry">Retry</button></p>';
        const rb = document.getElementById('dtg-retry'); if (rb) rb.addEventListener('click', loadDTGProducts);
    }

    // Check sample eligibility after products load
    setTimeout(() => {
        if (window.sampleCart && typeof window.sampleCart.checkAllProductEligibility === 'function') {
            window.sampleCart.checkAllProductEligibility();
        }
    }, 500);
}

// Display products
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = '';

    products.forEach(product => {
        const card = createProductCard(product);
        if (card) {
            productsGrid.appendChild(card);
        }
    });
}

// Create product card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    if (!product.details || product.details.length === 0) {
        return null;
    }

    const firstProduct = product.details[0];

    // Get unique colors
    const uniqueColors = [];
    const seenColors = new Set();

    for (const item of product.details) {
        if (item.COLOR_NAME && !seenColors.has(item.COLOR_NAME)) {
            seenColors.add(item.COLOR_NAME);
            uniqueColors.push(item);
        }
    }

    const colorsToShow = uniqueColors.slice(0, 5);

    card.setAttribute('role', 'link');
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${product.description} — style ${product.style}`);
    card.addEventListener('click', () => navigateToProduct(product));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToProduct(product); } });

    const imageUrl = firstProduct.FRONT_MODEL ||
                    firstProduct.FRONT_FLAT ||
                    firstProduct.PRODUCT_IMAGE;

    card.innerHTML = `
        <div class="product-image">
            <div class="product-badge">
                <i class="fas fa-check-circle" aria-hidden="true"></i> DTG-Compatible
            </div>
            <img src="${esc(imageUrl || '')}"
                 alt="${esc(product.description)}"
                 data-fallback="${esc(firstProduct.PRODUCT_IMAGE || '')}"
                 data-onerror="fallback">
        </div>
        <div class="product-info">
            <div class="product-style">Style #${esc(product.style)}</div>
            <div class="product-name">${esc(product.description)}</div>
            <div class="color-swatches">
                ${colorsToShow.map(c => `
                    <div class="color-swatch" title="${esc(c.COLOR_NAME)}">
                        <img src="${esc(c.COLOR_SQUARE_IMAGE)}" alt="${esc(c.COLOR_NAME)}">
                    </div>
                `).join('')}
                ${uniqueColors.length > 5 ? `
                    <div class="more-colors">+${uniqueColors.length - 5}</div>
                ` : ''}
            </div>
            <button type="button" class="btn-sample" data-style="${esc(product.style)}" data-eligible="pending" data-desc="${esc(product.description)}" aria-label="Request a sample of ${esc(product.description)}">
                <i class="fas fa-box-open" aria-hidden="true"></i> Request Sample
            </button>
        </div>
    `;

    return card;
}

// Sample buttons + broken images (delegated — cards are re-rendered)
document.addEventListener('click', (e) => {
    const b = e.target.closest('.btn-sample[data-style]');
    if (!b || b.id === 'dtg-retry') return;
    e.stopPropagation();
    navigateToProduct({ style: b.dataset.style, description: b.dataset.desc || '' });
});
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset && img.dataset.onerror === 'fallback') {
        img.removeAttribute('data-onerror');
        if (img.dataset.fallback) img.src = img.dataset.fallback; else img.hidden = true;
    }
}, true);

function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Navigate to product page (modern PDP — "Order a sample" CTA lives there)
function navigateToProduct(product) {
    const params = new URLSearchParams({ style: product.style });
    window.location.href = `/product.html?${params.toString()}`;
}

// Detect brand from product name
function detectBrand(name) {
    if (!name) return '';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('port & company')) return 'Port & Company';
    if (nameLower.includes('bella')) return 'BellaCanvas';
    if (nameLower.includes('carhartt')) return 'Carhartt';
    return '';
}
