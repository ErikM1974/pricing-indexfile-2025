/**
 * DTG Product Recommendations Modal
 * Provides tested and proven product suggestions for DTG printing in a modal
 */

(function() {
    'use strict';

    console.log('[DTG-Recommendations] Initializing DTG product recommendations modal');

    // Product data based on actual sales and testing
    const DTG_PRODUCTS = {
        tshirts: [
            {
                styleNumber: 'PC54',
                name: 'Core Cotton Tee',
                brand: 'Port & Company',
                fabric: '100% Cotton',
                salesData: '18,753+ units sold',
                rating: 5,
                rank: 'Top Seller',
                image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/Clyde%27s%20Water%20Slide%20Website%20Image%20300x300.png?ver=1',
                bestColors: ['Jet Black', 'Dk Hthr Grey', 'Navy', 'White'],
                notes: 'Best overall quality and consistency'
            },
            {
                styleNumber: 'PC61',
                name: 'Essential Tee',
                brand: 'Port & Company',
                fabric: '100% Cotton',
                salesData: '15,621+ units sold',
                rating: 5,
                rank: 'Top Seller',
                image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9042891',
                bestColors: ['Jet Black', 'Navy', 'Athletic Heather'],
                warnings: '⚠️ Avoid Red color - causes staining, needs 24hr drying'
            },
            {
                styleNumber: 'PC450',
                name: 'Fan Favorite Tee',
                brand: 'Port & Company',
                fabric: 'Soft Cotton Blend',
                salesData: '10,006+ units sold',
                rating: 5,
                rank: 'Top Seller',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2019/f19/PC450_jetblack_model_front_012019.jpg',
                bestColors: ['Jet Black', 'Heather Navy', 'Dark Heather Grey']
            },
            {
                styleNumber: 'PC55',
                name: 'Core Blend Tee',
                brand: 'Port & Company',
                fabric: 'Cotton/Poly Blend',
                salesData: '6,932+ units sold',
                rating: 4,
                rank: 'Popular Choice',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2021/f21/PC55_jetblack_model_front_032021.jpg',
                bestColors: ['Jet Black', 'Navy', 'Athletic Maroon']
            },
            {
                styleNumber: 'BC3001',
                name: 'Unisex Jersey Tee',
                brand: 'BELLA+CANVAS',
                fabric: '100% Cotton',
                salesData: 'Premium soft feel',
                rating: 4,
                rank: 'Popular Choice',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2020/f20/BC3001_black_model_front_072019.jpg',
                bestColors: ['Black', 'Navy', 'Dark Grey Heather']
            },
            {
                styleNumber: 'DT6000',
                name: 'Very Important Tee',
                brand: 'District',
                fabric: 'Light weight cotton',
                salesData: '1,770+ units sold',
                rating: 4,
                rank: 'Popular Choice',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2019/f19/DT6000_charcoal_model_front_072018.jpg',
                bestColors: ['Charcoal', 'New Navy', 'Black']
            }
        ],
        hoodies: [
            {
                styleNumber: 'PC78H',
                name: 'Core Fleece Hoodie',
                brand: 'Port & Company',
                fabric: '50/50 Cotton/Poly',
                salesData: '5,432+ units sold',
                rating: 5,
                rank: 'Best Seller',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2020/f20/PC78H_jetblack_model_front_022020.jpg',
                bestColors: ['Jet Black', 'Navy', 'Dark Heather Grey'],
                warnings: '⚠️ Avoid White - completely unprintable'
            },
            {
                styleNumber: 'PC850H',
                name: 'Fan Favorite Fleece',
                brand: 'Port & Company',
                fabric: '80% Cotton',
                salesData: '3,215+ units sold',
                rating: 5,
                rank: 'Top Choice',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2021/f21/PC850H_jetblack_model_front_022021.jpg',
                bestColors: ['Jet Black', 'True Royal', 'Heather Grey']
            }
        ],
        performance: [
            {
                styleNumber: 'ST350',
                name: 'PosiCharge Tee',
                brand: 'Sport-Tek',
                fabric: '100% Polyester',
                salesData: '2,156+ units sold',
                rating: 4,
                rank: 'Athletic Favorite',
                image: 'https://cdnm.sanmar.com/imglib/mresjpg/2019/f19/ST350_black_model_front_012019.jpg',
                bestColors: ['Black', 'True Navy', 'Iron Grey'],
                notes: 'Great for sports teams'
            }
        ]
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        injectModal();
        setupEventListeners();
    }

    function injectModal() {
        const modalHTML = `
            <div id="dtg-recommendations-modal" class="dtg-modal">
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>
                            <i class="fas fa-star"></i>
                            DTG Product Recommendations
                        </h2>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <p class="recommendations-subtitle">
                            Based on 50,000+ successful DTG prints
                        </p>
                        
                        <div class="dtg-rec-product-tabs">
                            <button class="tab-button active" data-category="tshirts">
                                T-Shirts (${DTG_PRODUCTS.tshirts.length})
                            </button>
                            <button class="tab-button" data-category="hoodies">
                                Hoodies (${DTG_PRODUCTS.hoodies.length})
                            </button>
                            <button class="tab-button" data-category="performance">
                                Performance (${DTG_PRODUCTS.performance.length})
                            </button>
                        </div>
                        
                        <div class="products-grid" id="products-grid">
                            ${renderProducts('tshirts')}
                        </div>
                        
                        <div class="avoid-section">
                            <h3>⚠️ Products to Avoid</h3>
                            <ul>
                                <li><strong>Gildan Products:</strong> Special coating makes prints dull</li>
                                <li><strong>PC78H White:</strong> Completely unprintable</li>
                                <li><strong>PC61 Red:</strong> Requires 24hr+ drying time</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        addStyles();
    }

    function renderProducts(category) {
        const products = DTG_PRODUCTS[category] || [];
        return products.map(product => `
            <div class="dtg-rec-product-card" data-style="${product.styleNumber}">
                <div class="dtg-rec-product-image">
                    <img src="${product.image}" alt="${product.name}">
                    ${product.rank ? `<span class="dtg-rec-product-badge">${product.rank}</span>` : ''}
                </div>
                <div class="dtg-rec-product-info">
                    <h4>${product.styleNumber} - ${product.name}</h4>
                    <p class="dtg-rec-product-brand">${product.brand} | ${product.fabric}</p>
                    ${product.salesData ? `<p class="dtg-rec-product-sales">${product.salesData}</p>` : ''}
                    ${renderStars(product.rating)}
                    ${product.bestColors ? `
                        <div class="best-colors">
                            <strong>Best printing colors:</strong><br>
                            ${product.bestColors.join(', ')}
                        </div>
                    ` : ''}
                    ${product.warnings ? `<p class="dtg-rec-product-warning">${product.warnings}</p>` : ''}
                    ${product.notes ? `<p class="dtg-rec-product-notes">${product.notes}</p>` : ''}
                    <button class="select-product-btn" onclick="window.DTGRecommendations.selectProduct('${product.styleNumber}')">
                        Select This Style
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderStars(rating) {
        const stars = '⭐'.repeat(rating);
        return `<div class="dtg-rec-product-rating">${stars}</div>`;
    }

    function setupEventListeners() {
        // Modal close button
        const closeBtn = document.querySelector('#dtg-recommendations-modal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        // Overlay click
        const overlay = document.querySelector('#dtg-recommendations-modal .modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeModal);
        }

        // Tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                switchTab(category);
            });
        });

        // Listen for toggle event
        window.addEventListener('toggleDTGRecommendations', openModal);
    }

    function openModal() {
        const modal = document.getElementById('dtg-recommendations-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal() {
        const modal = document.getElementById('dtg-recommendations-modal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function switchTab(category) {
        // Update active tab
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        // Update products grid
        const grid = document.getElementById('products-grid');
        if (grid) {
            grid.innerHTML = renderProducts(category);
        }
    }

    function selectProduct(styleNumber) {
        console.log('[DTG-Recommendations] Product selected:', styleNumber);
        // Here you can integrate with your product selection system
        closeModal();
        // Optionally redirect or update the page with the selected product
        if (window.location.pathname.includes('dtg')) {
            window.location.href = `/pricing/dtg?StyleNumber=${styleNumber}`;
        }
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Modal Container */
            .dtg-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }

            .dtg-modal.open {
                display: block;
            }

            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                animation: fadeIn 0.3s ease;
            }

            .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                max-width: 1000px;
                width: 90%;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translate(-50%, -45%);
                }
                to { 
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }

            /* Modal Header */
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 24px 30px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8faf9;
            }

            .modal-header h2 {
                margin: 0;
                color: #2e5827;
                font-size: 24px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .modal-header i {
                color: #ffc107;
            }

            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #666;
                cursor: pointer;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .modal-close:hover {
                background: #e0e0e0;
                color: #333;
            }

            /* Modal Body */
            .modal-body {
                padding: 30px;
                overflow-y: auto;
                max-height: calc(90vh - 80px);
            }

            .recommendations-subtitle {
                text-align: center;
                color: #666;
                margin-bottom: 24px;
                font-size: 16px;
            }

            /* Tabs */
            .dtg-rec-product-tabs {
                display: flex;
                gap: 12px;
                margin-bottom: 30px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .tab-button {
                padding: 10px 20px;
                border: 2px solid #e0e0e0;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 15px;
                font-weight: 500;
            }

            .tab-button:hover {
                border-color: #2e5827;
                color: #2e5827;
            }

            .tab-button.active {
                background: #2e5827;
                color: white;
                border-color: #2e5827;
            }

            /* Products Grid */
            .products-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }

            .dtg-rec-product-card {
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
                transition: all 0.3s;
                background: white;
            }

            .dtg-rec-product-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                border-color: #2e5827;
            }

            .dtg-rec-product-image {
                position: relative;
                height: 200px;
                background: #f5f5f5;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .dtg-rec-product-image img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }

            .dtg-rec-product-badge {
                position: absolute;
                top: 10px;
                right: 10px;
                background: #2e7d32;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }

            .dtg-rec-product-info {
                padding: 16px;
            }

            .dtg-rec-product-info h4 {
                margin: 0 0 8px;
                color: #333;
                font-size: 16px;
            }

            .dtg-rec-product-brand {
                color: #666;
                font-size: 14px;
                margin: 0 0 8px;
            }

            .dtg-rec-product-sales {
                color: #2e5827;
                font-weight: 600;
                margin: 0 0 8px;
                font-size: 14px;
            }

            .dtg-rec-product-rating {
                margin: 8px 0;
                font-size: 14px;
            }

            .best-colors {
                font-size: 13px;
                color: #666;
                margin: 12px 0;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
            }

            .best-colors strong {
                color: #333;
            }

            .dtg-rec-product-warning {
                color: #e67e22;
                font-size: 13px;
                margin: 12px 0;
                padding: 8px 12px;
                background: #fff3cd;
                border-radius: 6px;
            }

            .dtg-rec-product-notes {
                color: #666;
                font-size: 13px;
                font-style: italic;
                margin: 8px 0;
            }

            .select-product-btn {
                width: 100%;
                padding: 10px;
                background: #2e5827;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 12px;
            }

            .select-product-btn:hover {
                background: #1e3a1e;
                transform: translateY(-1px);
            }

            /* Avoid Section */
            .avoid-section {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                margin-top: 30px;
            }

            .avoid-section h3 {
                margin: 0 0 12px;
                color: #856404;
                font-size: 18px;
            }

            .avoid-section ul {
                margin: 0;
                padding-left: 20px;
            }

            .avoid-section li {
                color: #856404;
                margin-bottom: 8px;
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .modal-content {
                    width: 95%;
                    max-height: 95vh;
                }

                .modal-header {
                    padding: 20px;
                }

                .modal-body {
                    padding: 20px;
                }

                .products-grid {
                    grid-template-columns: 1fr;
                }

                .dtg-rec-product-tabs {
                    flex-direction: column;
                    width: 100%;
                }

                .tab-button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Expose API
    window.DTGRecommendations = {
        open: openModal,
        close: closeModal,
        selectProduct: selectProduct
    };

})();