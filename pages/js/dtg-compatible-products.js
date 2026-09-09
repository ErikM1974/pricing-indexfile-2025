/* dtg-compatible-products.js — page script (extracted from inline <script>, Rule 3, 2026-09-05).
 * Proxy base from APP_CONFIG (Rule 6) — the page used to hardcode the Heroku host. */
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || '';
if (!API_BASE) console.error('[dtg-compatible-products] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
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

    document.querySelector('.cart-indicator')?.classList.add('btn', 'btn-secondary');
    loadDTGProducts();
});

// Load DTG-compatible products
async function loadDTGProducts() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const productsGrid = document.getElementById('productsGrid');
    const productCount = document.getElementById('productCount');

    loadingIndicator.hidden = false;
    productsGrid.hidden = true;
    productCount.textContent = 'Loading compatible products…';

    const products = [];
    const loadErrors = [];

    // Fetch product details for each DTG-compatible style
    for (const styleNumber of dtgCompatibleStyles) {
        try {
            if (!productCache[styleNumber]) {
                const response = await fetch(`${API_BASE}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`);
                if (!response.ok) throw new Error('Request failed (' + response.status + ')');
                const details = await response.json();
                if (!Array.isArray(details) || details.some(item => !item || typeof item !== 'object' || !item.COLOR_NAME)) throw new Error('Incomplete product response');
                if (details.length > 0) productCache[styleNumber] = details;
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
            loadErrors.push(styleNumber);
        }
    }

    // Update product count
    productCount.textContent = loadErrors.length ? `${products.length} products loaded; ${loadErrors.length} styles unavailable` : `${products.length} products perfect for DTG printing`;

    // Display products
    displayProducts(products);

    loadingIndicator.hidden = true;
    productsGrid.hidden = false;
    if (loadErrors.length) {
        const notice = document.createElement('p');
        notice.className = 'dtg-empty'; notice.setAttribute('role', 'alert');
        notice.innerHTML = (products.length ? 'Some products could not be loaded' : 'Products could not be loaded') + ' (' + esc(loadErrors.join(', ')) + '). <button type="button" class="btn btn-secondary dtg-retry" id="dtg-retry">Retry</button>';
        productsGrid.prepend(notice);
        notice.querySelector('button').addEventListener('click', loadDTGProducts);
    } else if (!products.length) {
        productsGrid.innerHTML = '<p class="product-empty" role="status">No DTG-compatible products are available right now.</p>';
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
    card.addEventListener('click', (event) => { if (!event.target.closest('button')) navigateToProduct(product); });
    card.addEventListener('keydown', (e) => { if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigateToProduct(product); } });

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
            <button type="button" class="btn-sample btn btn-primary" data-style="${esc(product.style)}" data-eligible="pending" data-desc="${esc(product.description)}" aria-label="Request a sample of ${esc(product.description)}">
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
        if (img.dataset.fallback && img.src !== img.dataset.fallback && !img.dataset.fallbackTried) {
            img.dataset.fallbackTried = 'true'; img.src = img.dataset.fallback;
        } else {
            img.removeAttribute('data-onerror'); img.hidden = true;
            const note = document.createElement('p'); note.className = 'image-unavailable'; note.textContent = 'Product image unavailable';
            img.after(note);
        }
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
