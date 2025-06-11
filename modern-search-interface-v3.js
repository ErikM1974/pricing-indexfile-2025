// Modern Search Interface JavaScript V3
// Fixed version with better DOM handling

(function() {
    'use strict';

    // Category data - you can customize images and counts
    const categoryData = {
        'T-Shirts': { image: 'https://cdnm.sanmar.com/imglib/catimages/t-shirts.jpg', count: '500+' },
        'Polos/Knits': { image: 'https://cdnm.sanmar.com/imglib/catimages/polos.jpg', count: '200+' },
        'Sweatshirts/Fleece': { image: 'https://cdnm.sanmar.com/imglib/catimages/sweatshirts.jpg', count: '150+' },
        'Activewear': { image: 'https://cdnm.sanmar.com/imglib/catimages/activewear.jpg', count: '180+' },
        'Caps': { image: 'https://cdnm.sanmar.com/imglib/catimages/caps.jpg', count: '120+' },
        'Outerwear': { image: 'https://cdnm.sanmar.com/imglib/catimages/outerwear.jpg', count: '100+' },
        'Bags': { image: 'https://cdnm.sanmar.com/imglib/catimages/bags.jpg', count: '80+' },
        'Accessories': { image: 'https://cdnm.sanmar.com/imglib/catimages/accessories.jpg', count: '60+' }
    };

    // Popular brands for quick filters
    const popularBrands = ['Nike', 'Carhartt', 'Port Authority', 'Sport-Tek', 'District'];

    // Global state
    let modernSearchCreated = false;

    // Main initialization function
    function init() {
        console.log('[Modern Search] Starting initialization...');
        
        // Check if already initialized
        if (modernSearchCreated) {
            console.log('[Modern Search] Already initialized, skipping...');
            return;
        }
        
        // Wait for both DOM and Caspio form
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForCaspio);
        } else {
            waitForCaspio();
        }
    }

    // Wait for Caspio form to be ready
    function waitForCaspio() {
        console.log('[Modern Search] Waiting for Caspio form...');
        
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds
        
        const checkInterval = setInterval(function() {
            attempts++;
            
            // Check for Caspio form elements
            const styleInput = document.querySelector('[id^="Value1_1_"]');
            const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
            const searchButton = document.querySelector('[id^="searchID_"]');
            
            if (styleInput && categoryDropdown && searchButton) {
                clearInterval(checkInterval);
                console.log('[Modern Search] Caspio form found!');
                createModernSearch();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('[Modern Search] Caspio form not found after 10 seconds');
            }
        }, 500);
    }

    // Create the modern search interface
    function createModernSearch() {
        if (modernSearchCreated) return;
        
        console.log('[Modern Search] Creating interface...');
        
        try {
            // Get the gallery container
            const galleryContainer = document.getElementById('gallery-container');
            if (!galleryContainer) {
                console.error('[Modern Search] Gallery container not found!');
                return;
            }
            
            // Create the modern search HTML
            const modernSearchHTML = createSearchHTML();
            
            // Find where to insert (look for the Caspio script)
            const caspioScript = galleryContainer.querySelector('script[src*="caspio.com"]');
            
            if (caspioScript) {
                // Create a div to hold our content
                const modernSearchDiv = document.createElement('div');
                modernSearchDiv.innerHTML = modernSearchHTML;
                
                // Insert before the Caspio script
                caspioScript.parentNode.insertBefore(modernSearchDiv, caspioScript);
                console.log('[Modern Search] Interface inserted before Caspio script');
            } else {
                // Fallback: insert at the beginning
                galleryContainer.insertAdjacentHTML('afterbegin', modernSearchHTML);
                console.log('[Modern Search] Interface inserted at beginning of gallery');
            }
            
            modernSearchCreated = true;
            
            // Continue with setup
            setTimeout(() => {
                populateCategories();
                attachEventHandlers();
                hideOriginalForm();
                console.log('[Modern Search] Setup complete!');
            }, 100);
            
        } catch (error) {
            console.error('[Modern Search] Error creating interface:', error);
        }
    }

    // Create the search interface HTML
    function createSearchHTML() {
        return `
            <div class="modern-search-container">
                <!-- Quick Search Bar -->
                <div class="quick-search-section">
                    <h2 class="quick-search-title">Find Your Perfect Custom Apparel</h2>
                    <div class="quick-search-wrapper">
                        <input type="text" 
                               class="quick-search-input" 
                               id="modernStyleSearch" 
                               placeholder="Search by Style # (e.g., PC54, DT6000)">
                        <button class="quick-search-btn" id="modernSearchBtn">Search</button>
                    </div>
                </div>

                <!-- Category Grid -->
                <div class="category-grid-section">
                    <h3 class="section-title">Shop by Category</h3>
                    <div class="category-grid" id="categoryGrid">
                        <!-- Categories will be inserted here -->
                    </div>
                </div>

                <!-- Quick Filters -->
                <div class="quick-filters-section">
                    <div class="filters-wrapper">
                        <span class="filter-label">Quick Filters:</span>
                        <button class="filter-btn active" data-filter="all">All Products</button>
                        ${popularBrands.map(brand => 
                            `<button class="filter-btn brand-filter" data-brand="${brand}">${brand}</button>`
                        ).join('')}
                        
                        <div class="top-seller-toggle">
                            <label>Top Sellers Only</label>
                            <div class="toggle-switch" id="topSellerToggle">
                                <div class="toggle-slider"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Loading indicator -->
                <div class="search-loading" id="searchLoading">
                    <div class="search-loading-spinner"></div>
                    <p>Finding products...</p>
                </div>
            </div>
        `;
    }

    // Populate category tiles
    function populateCategories() {
        const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
        const categoryGrid = document.getElementById('categoryGrid');
        
        if (!categoryDropdown || !categoryGrid) {
            console.error('[Modern Search] Cannot populate categories - missing elements');
            return;
        }
        
        // Clear existing tiles
        categoryGrid.innerHTML = '';
        
        // Extract categories from dropdown
        const categories = [];
        Array.from(categoryDropdown.options).forEach(option => {
            if (option.value && option.value !== '') {
                categories.push({
                    value: option.value,
                    text: option.text.trim()
                });
            }
        });
        
        console.log(`[Modern Search] Found ${categories.length} categories`);
        
        // Create tiles
        categories.forEach(category => {
            const categoryInfo = categoryData[category.text] || {
                image: `https://via.placeholder.com/300x200/2f661e/ffffff?text=${encodeURIComponent(category.text)}`,
                count: 'View styles'
            };
            
            const tile = document.createElement('div');
            tile.className = 'category-tile';
            tile.setAttribute('data-category', category.value);
            tile.innerHTML = `
                <div class="category-image-wrapper">
                    <img class="category-image" 
                         src="${categoryInfo.image}" 
                         alt="${category.text}"
                         loading="lazy">
                </div>
                <div class="category-info">
                    <h4 class="category-name">${category.text}</h4>
                    <p class="category-count">${categoryInfo.count}</p>
                </div>
            `;
            
            categoryGrid.appendChild(tile);
        });
    }

    // Attach event handlers
    function attachEventHandlers() {
        // Style search
        const searchInput = document.getElementById('modernStyleSearch');
        const searchBtn = document.getElementById('modernSearchBtn');
        
        if (searchInput && searchBtn) {
            searchBtn.addEventListener('click', handleStyleSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleStyleSearch();
            });
        }
        
        // Category tiles (use delegation)
        document.addEventListener('click', (e) => {
            // Category tile click
            const tile = e.target.closest('.category-tile');
            if (tile) {
                const category = tile.getAttribute('data-category');
                if (category) searchByCategory(category);
            }
            
            // Brand filter click
            if (e.target.matches('.filter-btn[data-brand]')) {
                const brand = e.target.getAttribute('data-brand');
                searchByBrand(brand);
            }
            
            // All products filter
            if (e.target.matches('.filter-btn[data-filter="all"]')) {
                clearAllFilters();
            }
        });
        
        // Top seller toggle
        const toggle = document.getElementById('topSellerToggle');
        if (toggle) {
            toggle.addEventListener('click', toggleTopSellers);
        }
    }

    // Hide original Caspio form
    function hideOriginalForm() {
        // Find the Caspio form table
        const formTable = document.querySelector('[id^="cbTable_"]');
        if (formTable) {
            formTable.style.cssText = 'position: absolute !important; left: -9999px !important; top: -9999px !important; visibility: hidden !important;';
            console.log('[Modern Search] Original form hidden');
        }
    }

    // Search handlers
    function handleStyleSearch() {
        const input = document.getElementById('modernStyleSearch');
        const style = input.value.trim();
        
        if (!style) return;
        
        showLoading();
        
        // Fill the hidden Caspio field
        const caspioField = document.querySelector('[id^="Value1_1_"]');
        if (caspioField) {
            // Clear other fields
            clearFormFields();
            
            // Set style value
            caspioField.value = style;
            
            // Trigger search
            triggerSearch();
        }
    }

    function searchByCategory(categoryValue) {
        showLoading();
        
        const dropdown = document.querySelector('[id^="Value2_1_"]');
        if (dropdown) {
            clearFormFields();
            dropdown.value = categoryValue;
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));
            
            setTimeout(triggerSearch, 100);
        }
    }

    function searchByBrand(brandValue) {
        showLoading();
        
        const dropdown = document.getElementById('Value4_1');
        if (dropdown) {
            clearFormFields();
            dropdown.value = brandValue;
            
            // Update UI
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            triggerSearch();
        }
    }

    function toggleTopSellers() {
        const toggle = document.getElementById('topSellerToggle');
        const isActive = toggle.classList.contains('active');
        
        toggle.classList.toggle('active');
        
        // Find radio buttons
        const radios = document.querySelectorAll('[name^="Value5_1"]');
        radios.forEach(radio => {
            if (!isActive && radio.value === 'Y') {
                radio.checked = true;
            } else if (isActive && radio.value === 'A') {
                radio.checked = true;
            }
        });
        
        triggerSearch();
    }

    function clearAllFilters() {
        showLoading();
        clearFormFields();
        
        // Reset UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
        
        // Reset toggle
        const toggle = document.getElementById('topSellerToggle');
        if (toggle) toggle.classList.remove('active');
        
        // Set to "Any"
        const anyRadio = document.querySelector('[name^="Value5_1"][value="A"]');
        if (anyRadio) anyRadio.checked = true;
        
        triggerSearch();
    }

    // Helper functions
    function clearFormFields() {
        // Clear style
        const styleField = document.querySelector('[id^="Value1_1_"]');
        if (styleField) styleField.value = '';
        
        // Clear dropdowns
        const dropdowns = [
            document.querySelector('[id^="Value2_1_"]'),
            document.querySelector('[id^="Value3_1_"]'),
            document.getElementById('Value4_1')
        ];
        
        dropdowns.forEach(dropdown => {
            if (dropdown) dropdown.selectedIndex = 0;
        });
        
        // Clear modern search input
        const modernInput = document.getElementById('modernStyleSearch');
        if (modernInput) modernInput.value = '';
    }

    function triggerSearch() {
        const searchBtn = document.querySelector('[id^="searchID_"]');
        if (searchBtn) {
            searchBtn.click();
            setTimeout(hideLoading, 1500);
        }
    }

    function showLoading() {
        const loading = document.getElementById('searchLoading');
        if (loading) loading.classList.add('active');
    }

    function hideLoading() {
        const loading = document.getElementById('searchLoading');
        if (loading) loading.classList.remove('active');
    }

    // Start initialization
    init();

})();