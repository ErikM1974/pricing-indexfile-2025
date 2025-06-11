// Modern Search Interface JavaScript
// Connects beautiful UI to hidden Caspio form

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Watch for Caspio form to load
        waitForCaspioForm();
    });

    // Category data - you can customize images and counts
    const categoryData = {
        'T-Shirts': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=T-Shirts', count: '500+' },
        'Polos': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Polos', count: '200+' },
        'Sweatshirts': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Sweatshirts', count: '150+' },
        'Hoodies': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Hoodies', count: '180+' },
        'Caps': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Caps', count: '120+' },
        'Jackets': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Jackets', count: '100+' },
        'Bags': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Bags', count: '80+' },
        'Accessories': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Accessories', count: '60+' },
        'Activewear': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Activewear', count: '150+' },
        'Infant & Toddler': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Infant+Toddler', count: '100+' },
        'Ladies': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Ladies', count: '250+' },
        'Outerwear': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Outerwear', count: '120+' },
        'Polos/Knits': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Polos+Knits', count: '200+' },
        'Sweatshirts/Fleece': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Sweatshirts', count: '180+' },
        'Woven Shirts': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Woven+Shirts', count: '150+' },
        'Youth': { image: 'https://via.placeholder.com/300x200/2f661e/ffffff?text=Youth', count: '200+' }
    };

    // Popular brands for quick filters
    const popularBrands = ['Nike', 'Carhartt', 'Port Authority', 'Sport-Tek', 'District'];

    function waitForCaspioForm() {
        // Check if Caspio form exists
        const checkInterval = setInterval(function() {
            const caspioTable = document.querySelector('[id^="cbTable_"]');
            const searchButton = document.querySelector('.cbSearchButton');
            
            if (caspioTable && searchButton) {
                clearInterval(checkInterval);
                console.log('Caspio form found, initializing modern search...');
                initializeModernSearch();
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(function() {
            clearInterval(checkInterval);
            console.error('Caspio form not found after 10 seconds');
        }, 10000);
    }

    function initializeModernSearch() {
        // The Caspio form is in a section with data-cb-name="cbTable"
        const caspioForm = document.querySelector('section[data-cb-name="cbTable"]');
        if (!caspioForm || !caspioForm.classList.contains('cbFormSection_')) {
            console.log('Caspio form structure not complete yet...');
            return;
        }

        console.log('Initializing modern search interface...');
        
        // Create modern search interface
        createModernSearchUI();
        
        // Extract categories from Caspio dropdown
        extractAndBuildCategories();
        
        // Set up event handlers
        setupEventHandlers();
    }

    function createModernSearchUI() {
        // Find the gallery container  
        const galleryContainer = document.getElementById('gallery-container');
        if (!galleryContainer) {
            console.error('Gallery container not found');
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

        // Check if modern search already exists
        if (document.querySelector('.modern-search-container')) {
            console.log('Modern search interface already exists');
            return;
        }
        
        // Remove the existing paragraph and h2
        const existingP = galleryContainer.querySelector('p');
        const existingH2 = galleryContainer.querySelector('h2');
        if (existingP) existingP.remove();
        if (existingH2) existingH2.remove();
        
        // Insert at the beginning of gallery container
        galleryContainer.insertAdjacentHTML('afterbegin', modernSearchHTML);
    }

    function extractAndBuildCategories() {
        // Try to get categories from Caspio dropdown
        const categoryDropdown = document.querySelector('select[name="cbParamVirtual2"]');
        const categoryGrid = document.getElementById('categoryGrid');
        
        if (!categoryDropdown || !categoryGrid) return;

        // Extract categories
        const categories = [];
        Array.from(categoryDropdown.options).forEach(option => {
            if (option.value && option.value !== '') {
                categories.push({
                    value: option.value,
                    text: option.text
                });
            }
        });

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
        
        // Find and fill the hidden Caspio style field
        const caspioStyleField = document.querySelector('input[name="cbParamVirtual1"]');
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
        
        const categoryDropdown = document.querySelector('select[name="cbParamVirtual2"]');
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
        
        const brandDropdown = document.querySelector('select[name="cbParamVirtual4"]');
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
        
        // Find the radio buttons
        const topSellerRadios = document.querySelectorAll('input[name="cbParamVirtual5"]');
        
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
        const anyRadio = document.querySelector('input[name="cbParamVirtual5"][value="A"]');
        if (anyRadio) anyRadio.checked = true;
        
        // Trigger search
        triggerCaspioSearch();
    }

    function clearSearchFields() {
        const styleField = document.querySelector('input[name="cbParamVirtual1"]');
        if (styleField) styleField.value = '';
        
        const modernStyleField = document.getElementById('modernStyleSearch');
        if (modernStyleField) modernStyleField.value = '';
    }

    function clearDropdowns() {
        const dropdowns = ['cbParamVirtual2', 'cbParamVirtual3', 'cbParamVirtual4'];
        dropdowns.forEach(name => {
            const dropdown = document.querySelector(`select[name="${name}"]`);
            if (dropdown) dropdown.selectedIndex = 0;
        });
    }

    function triggerCaspioSearch() {
        const searchButton = document.querySelector('.cbSearchButton');
        if (searchButton) {
            searchButton.click();
            
            // Hide loading after a delay
            setTimeout(hideLoading, 1500);
            
            // Smooth scroll to results
            setTimeout(() => {
                const results = document.getElementById('cbOuterAjaxCtnr');
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

})();