// Modern Search Interface JavaScript V2
// Connects beautiful UI to hidden Caspio form with actual field IDs

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

    // Wait for Caspio form to be fully loaded
    function waitForCaspioForm() {
        const checkInterval = setInterval(function() {
            // Look for the specific Caspio form elements
            const styleInput = document.querySelector('[id^="Value1_1_"]');
            const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
            const searchButton = document.querySelector('[id^="searchID_"]');
            
            if (styleInput && categoryDropdown && searchButton) {
                clearInterval(checkInterval);
                console.log('Caspio form detected, initializing modern search...');
                initializeModernSearch();
            }
        }, 500);
    }

    function initializeModernSearch() {
        console.log('Starting modern search initialization...');
        
        try {
            // Create modern search interface
            createModernSearchUI();
            
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                // Extract categories from Caspio dropdown
                extractAndBuildCategories();
                
                // Set up event handlers
                setupEventHandlers();
                
                // Hide the original Caspio form
                hideCaspioForm();
                
                console.log('Modern search initialization complete!');
            }, 100);
        } catch (error) {
            console.error('Error initializing modern search:', error);
        }
    }

    function hideCaspioForm() {
        // Find the search section by looking for the form table
        const searchTable = document.querySelector('[id^="cbTable_"][id$="_ca743cb5daa1b3"]');
        if (searchTable) {
            // Hide the entire search section
            searchTable.style.position = 'absolute';
            searchTable.style.left = '-9999px';
            searchTable.style.top = '-9999px';
            searchTable.style.visibility = 'hidden';
        }
    }

    function createModernSearchUI() {
        // Check if modern search already exists
        if (document.querySelector('.modern-search-container')) {
            console.log('Modern search interface already exists');
            return;
        }
        
        // Find the gallery container
        const galleryContainer = document.getElementById('gallery-container');
        if (!galleryContainer) {
            console.error('Gallery container not found!');
            return;
        }
        
        // Create modern search HTML
        const modernSearchHTML = `
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
                        <button class="filter-btn" data-filter="all">All Products</button>
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

        // Find the Caspio script tag
        const caspioScript = galleryContainer.querySelector('script[src*="caspio.com"]');
        
        if (caspioScript) {
            // Insert before the Caspio script
            caspioScript.insertAdjacentHTML('beforebegin', modernSearchHTML);
            console.log('Modern search interface created successfully');
        } else {
            // If no script found, insert at the beginning of gallery container
            galleryContainer.insertAdjacentHTML('afterbegin', modernSearchHTML);
            console.log('Modern search interface created at beginning of gallery container');
        }
    }

    function extractAndBuildCategories() {
        // Find the actual category dropdown
        const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
        const categoryGrid = document.getElementById('categoryGrid');
        
        console.log('Category dropdown found:', !!categoryDropdown);
        console.log('Category grid found:', !!categoryGrid);
        
        if (!categoryDropdown || !categoryGrid) {
            console.error('Missing elements - dropdown:', !!categoryDropdown, 'grid:', !!categoryGrid);
            return;
        }

        // Extract categories from dropdown options
        const categories = [];
        Array.from(categoryDropdown.options).forEach(option => {
            if (option.value && option.value !== '') {
                categories.push({
                    value: option.value,
                    text: option.text
                });
            }
        });
        
        console.log('Found categories:', categories.length);

        // Build category tiles
        categories.forEach(category => {
            const categoryInfo = categoryData[category.text] || {
                image: 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(category.text),
                count: 'Many styles'
            };

            const tile = document.createElement('div');
            tile.className = 'category-tile';
            tile.setAttribute('data-category', category.value);
            
            tile.innerHTML = `
                <div class="category-image-wrapper">
                    <img class="category-image" 
                         src="${categoryInfo.image}" 
                         alt="${category.text}"
                         onerror="this.src='https://via.placeholder.com/300x200?text=${encodeURIComponent(category.text)}'">
                </div>
                <div class="category-info">
                    <h4 class="category-name">${category.text}</h4>
                    <p class="category-count">${categoryInfo.count}</p>
                </div>
            `;
            
            categoryGrid.appendChild(tile);
        });
        
        console.log('Category tiles created successfully');
    }

    function setupEventHandlers() {
        // Style search
        const styleSearchInput = document.getElementById('modernStyleSearch');
        const searchBtn = document.getElementById('modernSearchBtn');
        
        if (styleSearchInput && searchBtn) {
            searchBtn.addEventListener('click', handleStyleSearch);
            styleSearchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleStyleSearch();
            });
        }

        // Category tiles
        document.addEventListener('click', function(e) {
            const categoryTile = e.target.closest('.category-tile');
            if (categoryTile) {
                const category = categoryTile.getAttribute('data-category');
                searchByCategory(category);
            }
        });

        // Brand filters
        document.addEventListener('click', function(e) {
            if (e.target.matches('.filter-btn[data-brand]')) {
                const brand = e.target.getAttribute('data-brand');
                searchByBrand(brand);
            } else if (e.target.matches('.filter-btn[data-filter="all"]')) {
                clearAllFilters();
            }
        });

        // Top seller toggle
        const topSellerToggle = document.getElementById('topSellerToggle');
        if (topSellerToggle) {
            topSellerToggle.addEventListener('click', toggleTopSellers);
        }
    }

    function handleStyleSearch() {
        const styleInput = document.getElementById('modernStyleSearch');
        const style = styleInput.value.trim();
        
        if (!style) return;
        
        showLoading();
        
        // Find the actual Caspio style field
        const caspioStyleField = document.querySelector('[id^="Value1_1_"]');
        if (caspioStyleField) {
            caspioStyleField.value = style;
            
            // Clear other fields
            clearDropdowns();
            
            // Trigger search
            triggerCaspioSearch();
        }
    }

    function searchByCategory(categoryValue) {
        showLoading();
        
        const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
        if (categoryDropdown) {
            // Clear other fields first
            clearSearchFields();
            
            // Set category
            categoryDropdown.value = categoryValue;
            categoryDropdown.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Trigger search after a short delay to allow cascading
            setTimeout(triggerCaspioSearch, 100);
        }
    }

    function searchByBrand(brandValue) {
        showLoading();
        
        // The brand dropdown doesn't have a unique suffix in your HTML
        const brandDropdown = document.getElementById('Value4_1');
        if (brandDropdown) {
            // Clear other fields first
            clearSearchFields();
            
            // Set brand
            brandDropdown.value = brandValue;
            
            // Update UI to show active filter
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Trigger search
            triggerCaspioSearch();
        }
    }

    function toggleTopSellers() {
        const toggle = document.getElementById('topSellerToggle');
        const isActive = toggle.classList.contains('active');
        
        toggle.classList.toggle('active');
        
        // Find the radio buttons - they have a pattern like Value5_1X_uniqueid
        const topSellerRadios = document.querySelectorAll('[name^="Value5_1"]');
        
        topSellerRadios.forEach(radio => {
            if (!isActive && radio.value === 'Y') {
                radio.checked = true;
            } else if (isActive && radio.value === 'A') {
                radio.checked = true;
            }
        });
        
        // Trigger search
        triggerCaspioSearch();
    }

    function clearAllFilters() {
        showLoading();
        
        // Clear all form fields
        clearSearchFields();
        clearDropdowns();
        
        // Reset UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
        
        // Reset top seller toggle
        const toggle = document.getElementById('topSellerToggle');
        if (toggle) toggle.classList.remove('active');
        
        // Set top seller to "Any"
        const anyRadio = document.querySelector('[name^="Value5_1"][value="A"]');
        if (anyRadio) anyRadio.checked = true;
        
        // Trigger search
        triggerCaspioSearch();
    }

    function clearSearchFields() {
        const styleField = document.querySelector('[id^="Value1_1_"]');
        if (styleField) styleField.value = '';
        
        const modernStyleField = document.getElementById('modernStyleSearch');
        if (modernStyleField) modernStyleField.value = '';
    }

    function clearDropdowns() {
        // Clear category
        const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
        if (categoryDropdown) categoryDropdown.selectedIndex = 0;
        
        // Clear subcategory
        const subcategoryDropdown = document.querySelector('[id^="Value3_1_"]');
        if (subcategoryDropdown) subcategoryDropdown.selectedIndex = 0;
        
        // Clear brand
        const brandDropdown = document.getElementById('Value4_1');
        if (brandDropdown) brandDropdown.selectedIndex = 0;
    }

    function triggerCaspioSearch() {
        // Find the actual search button with the unique ID
        const searchButton = document.querySelector('[id^="searchID_"]');
        if (searchButton) {
            searchButton.click();
            
            // Hide loading after a delay
            setTimeout(hideLoading, 1500);
            
            // Smooth scroll to results
            setTimeout(() => {
                const results = document.querySelector('[id^="cbOuterAjaxCtnr_"][id$="_68c66164e51458"]');
                if (results) {
                    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);
        }
    }

    function showLoading() {
        const loadingDiv = document.getElementById('searchLoading');
        if (loadingDiv) loadingDiv.classList.add('active');
    }

    function hideLoading() {
        const loadingDiv = document.getElementById('searchLoading');
        if (loadingDiv) loadingDiv.classList.remove('active');
    }

    // Start the process
    waitForCaspioForm();

})();