/**
 * Northwest Custom Apparel - Modern Product Catalog
 * 
 * This application uses direct API calls for product search and display.
 * No more Caspio iframe manipulation or DOM observers needed.
 * 
 * @author Northwest Custom Apparel
 * @version 3.0.0
 */

// Configuration
const DEBUG_MODE = false;

// Debug logging wrapper
const debugLog = (...args) => {
    if (DEBUG_MODE) {
        console.log(...args);
    }
};

// Hardcoded category structure from database - ordered for display
const CATEGORY_DATA = {
    "T-Shirts": ["Ring Spun", "100% Cotton", "6-6.1 100% Cotton", "Long Sleeve", "Fashion", "5-5.6 100% Cotton", "Performance", "Ladies", "Youth", "Tanks", "Specialty", "Tall", "50/50 Blend", "Eco-Friendly", "Workwear", "Juniors & Young Men"],
    "Polos/Knits": ["Ladies", "Performance", "Easy Care", "Fashion", "Tall", "Cotton", "Youth", "Workwear", "Sweaters", "Mock & Turtlenecks", "Silk Touch™", "Basic Knits"],
    "Sweatshirts/Fleece": ["Ladies", "Performance", "Crewnecks", "Hoodie", "Youth", "Fleece", "Heavyweight", "1/2 & 1/4 Zip", "Full Zip", "Tall", "Sweatpants", "Juniors & Young Men"],
    "Caps": ["Performance/ Athletic", "Visors", "Stretch-to-Fit", "Youth", "Fashion", "Fleece/Beanies", "Twill", "Full Brim", "Pigment/Garment Dyed", "Flexfit", "Mesh Back", "Camouflage", "Safety", "Recycled", "Scarves/Gloves", "Canvas", "Racing", "Fitted"],
    "Activewear": ["Ladies", "Youth", "Performance", "Basketball", "Pants & Shorts", "Jerseys", "Tanks", "Athletic/Warm-Ups", "Baseball"],
    "Outerwear": ["Ladies", "Athletic/Warm-Ups", "Corporate Jackets", "Tall", "Insulated Jackets", "Youth", "Polyester Fleece", "Golf Outerwear", "Rainwear", "Work Jackets", "Soft Shells", "Vests", "3-in-1", "Parkas/ Shells/ Systems", "Camouflage"],
    "Bags": ["Golf Bags", "Travel Bags", "Rolling Bags", "Backpacks", "Totes", "Briefcases/ Messengers", "Specialty Bags", "Coolers & Lunch Bags", "Duffels", "Cinch Packs", "Grocery Totes", "Eco-Friendly"],
    "Accessories": ["Other", "Aprons", "Blankets", "Scarves/Gloves", "Robes/Towels", "Golf Towels"],
    "Workwear": ["Medical/Scrubs", "Stain/Soil Resistant", "Aprons", "T-Shirts", "Industrial Work Shirts", "Polos", "Safety", "Industrial Work Pants/Shorts", "Work Jackets"],
    "Woven Shirts": ["Ladies", "Premium Wovens", "Workwear", "Denim", "Cotton", "Easy Care", "Cotton/Poly Blend", "Oxfords", "Camp Shirts", "100% Cotton", "Fishing", "Tall"],
    "Ladies": ["Polos/Knits", "Outerwear", "Activewear", "Fashion", "T-Shirts", "Sweatshirts/Fleece", "Bottoms", "Woven Shirts", "Dresses", "Caps"],
    "Youth": ["Sweatshirts/Fleece", "T-Shirts", "Bottoms", "Activewear", "Outerwear", "Caps", "Polos/Knits"],
    "Infant & Toddler": ["Tops & Bottoms", "Accessories & Caps"],
    "Tall": ["Sweatshirts/Fleece", "Outerwear", "Woven Shirts", "Polos/Knits", "T-Shirts"],
    "Juniors & Young Men": ["T-Shirts", "Pants & Shorts", "Lounge", "Sweatshirts", "Caps"],
    "Personal Protection": ["Medical/Scrubs", "Face Coverings"]
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    debugLog('[App] Initializing modern catalog...');

    // Build category menu from hardcoded data
    buildCategoryMenu();
    
    // Build top navigation categories
    buildTopNavCategories();
    enhanceDropdownInteraction();

    // Setup mobile menu
    setupMobileMenu();

    // Setup category navigation (flyout menus)
    setupCategoryNavigation();
    
    debugLog('[App] Modern catalog initialized successfully');
});

function buildTopNavCategories() {
    const navCategories = document.getElementById('navCategories');
    if (!navCategories) return;
    
    // Create category grid for dropdown
    let html = '';
    Object.keys(CATEGORY_DATA).forEach(categoryName => {
        html += `
            <div class="nav-category-item">
                <h4 class="nav-category-title">${categoryName}</h4>
                <ul class="nav-subcategory-list">
                    ${CATEGORY_DATA[categoryName].slice(0, 4).map(subcat => 
                        `<li><a href="#" data-category="${categoryName}" data-subcategory="${subcat}" class="nav-subcategory-link">${subcat}</a></li>`
                    ).join('')}
                    ${CATEGORY_DATA[categoryName].length > 4 ? 
                        `<li><a href="#" data-category="${categoryName}" class="nav-view-all">View all ${CATEGORY_DATA[categoryName].length} subcategories</a></li>` : ''}
                </ul>
            </div>
        `;
    });
    
    navCategories.innerHTML = html;
    
    // Add click handlers are handled by catalog-search.js
    navCategories.querySelectorAll('.nav-view-all').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const category = link.dataset.category;
            
            // Close dropdown smoothly
            const dropdown = link.closest('.nav-dropdown');
            const navLink = document.querySelector('.nav-products');
            if (dropdown && navLink) {
                navLink.setAttribute('aria-expanded', 'false');
                dropdown.style.opacity = '0';
                dropdown.style.visibility = 'hidden';
                dropdown.style.transform = 'translateY(-10px)';
                dropdown.style.pointerEvents = 'none';
            }
            
            // Click the sidebar category after a short delay
            setTimeout(() => {
                const sidebarCategory = document.querySelector(`[data-category="${category}"]`);
                if (sidebarCategory) {
                    sidebarCategory.click();
                }
            }, 300);
        });
    });
}

function enhanceDropdownInteraction() {
    const productsNavItem = document.querySelector('.nav-products').parentElement;
    const dropdown = productsNavItem.querySelector('.nav-dropdown');
    let closeTimeout;
    let isDropdownOpen = false;

    // Prevent dropdown from closing when hovering between trigger and dropdown
    productsNavItem.addEventListener('mouseenter', () => {
        clearTimeout(closeTimeout);
        dropdown.style.pointerEvents = 'auto';
        isDropdownOpen = true;
    });

    productsNavItem.addEventListener('mouseleave', () => {
        closeTimeout = setTimeout(() => {
            if (!isDropdownOpen) {
                dropdown.style.pointerEvents = 'none';
            }
        }, 200);
    });

    dropdown.addEventListener('mouseenter', () => {
        clearTimeout(closeTimeout);
        isDropdownOpen = true;
    });

    dropdown.addEventListener('mouseleave', () => {
        closeTimeout = setTimeout(() => {
            dropdown.style.pointerEvents = 'none';
            isDropdownOpen = false;
        }, 200);
    });

    // Add keyboard navigation support
    const navLink = productsNavItem.querySelector('.nav-link');
    navLink.setAttribute('aria-haspopup', 'true');
    navLink.setAttribute('aria-expanded', 'false');

    navLink.addEventListener('click', (e) => {
        e.preventDefault();
        const isExpanded = navLink.getAttribute('aria-expanded') === 'true';
        navLink.setAttribute('aria-expanded', !isExpanded);
        
        if (!isExpanded) {
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.transform = 'translateY(0)';
            dropdown.style.pointerEvents = 'auto';
        } else {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
            dropdown.style.pointerEvents = 'none';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!productsNavItem.contains(e.target)) {
            navLink.setAttribute('aria-expanded', 'false');
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
            dropdown.style.pointerEvents = 'none';
        }
    });
}

function buildCategoryMenu() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    // Build menu from CATEGORY_DATA
    Object.keys(CATEGORY_DATA).forEach(categoryName => {
        const li = document.createElement('li');
        li.className = 'category-item';

        const link = document.createElement('a');
        link.className = 'category-link';
        link.href = '#';
        link.dataset.category = categoryName;
        link.textContent = categoryName;

        // Add arrow indicator if has subcategories
        if (CATEGORY_DATA[categoryName].length > 0) {
            link.classList.add('has-subcategories');
        }

        li.appendChild(link);
        categoryList.appendChild(li);
    });
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
}

function setupCategoryNavigation() {
    // Create flyout menu container
    const flyoutMenu = document.createElement('div');
    flyoutMenu.className = 'category-flyout';
    flyoutMenu.id = 'categoryFlyout';
    document.body.appendChild(flyoutMenu);

    const categoryLinks = document.querySelectorAll('.category-link');
    let hoverTimer = null;
    let activeLink = null;

    categoryLinks.forEach(link => {
        const categoryItem = link.closest('.category-item');
        const categoryName = link.dataset.category;

        // Hover to show flyout menu
        categoryItem.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimer);
            
            const subcategories = CATEGORY_DATA[categoryName];
            
            // Update active link
            if (activeLink) {
                activeLink.classList.remove('hovering');
            }
            activeLink = link;
            link.classList.add('hovering');
            
            if (subcategories && subcategories.length > 0) {
                // Update flyout content
                updateFlyoutMenu(categoryName, subcategories);
                
                // Position flyout next to the category
                const rect = categoryItem.getBoundingClientRect();
                const sidebar = document.querySelector('.sidebar');
                const sidebarRect = sidebar.getBoundingClientRect();
                
                flyoutMenu.style.top = rect.top + 'px';
                flyoutMenu.style.left = sidebarRect.right + 'px';
                flyoutMenu.classList.add('show');
            }
        });

        // Mouse leave - hide flyout after delay
        categoryItem.addEventListener('mouseleave', () => {
            hoverTimer = setTimeout(() => {
                flyoutMenu.classList.remove('show');
                link.classList.remove('hovering');
                if (activeLink === link) {
                    activeLink = null;
                }
            }, 200);
        });
    });
    
    // Handle flyout menu hover
    flyoutMenu.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
    });
    
    flyoutMenu.addEventListener('mouseleave', () => {
        hoverTimer = setTimeout(() => {
            flyoutMenu.classList.remove('show');
            if (activeLink) {
                activeLink.classList.remove('hovering');
                activeLink = null;
            }
        }, 200);
    });
}

function updateFlyoutMenu(category, subcategories) {
    const flyout = document.getElementById('categoryFlyout');
    
    let html = `
        <div class="flyout-header">${category}</div>
        <div class="flyout-content">
    `;
    
    subcategories.forEach(subcat => {
        html += `<a href="#" class="flyout-item" data-category="${category}" data-subcategory="${subcat}">${subcat}</a>`;
    });
    
    html += '</div>';
    flyout.innerHTML = html;
}

// Export category data for use by other modules
window.CATEGORY_DATA = CATEGORY_DATA;