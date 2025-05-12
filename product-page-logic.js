document.addEventListener('DOMContentLoaded', () => {
                console.log("DOM Loaded. Initializing scripts...");
        
                // --- Global State ---
                window.selectedStyleNumber = null;
                window.selectedColorName = null;
                window.selectedCatalogColor = null;
                window.arePricingLinksReady = false; // Flag to control clickability

                // --- API URL ---
                const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
                console.log("API Base URL:", API_PROXY_BASE_URL);
        
                // --- DOM Element References ---
                const styleSearchInput = document.getElementById('style-search-input');
                const searchButton = document.getElementById('search-button');
                const suggestionsList = document.getElementById('style-suggestions-list');
                const productInfoArea = document.getElementById('product-info-area');
                const swatchArea = document.getElementById('swatch-area');
                const inventoryArea = document.getElementById('inventory-area');
                const tabNav = document.querySelector('.tab-nav');
                const tabLinks = document.querySelectorAll('.tab-link');
                const tabContentPanels = document.querySelectorAll('.tab-content-panel');
                const pricingLinks = document.querySelectorAll('.pricing-option-card'); // Select all pricing links globally
                setPricingLinksState(true); // <<< ADDED: Ensure links are disabled immediately on load

                // Add click prevention listeners
                document.querySelectorAll('.pricing-option-card').forEach(link => { // Re-query to be safe
                    link.addEventListener('click', function(event) {
                        if (!window.arePricingLinksReady) {
                            event.preventDefault();
                            // Optionally, briefly show a message to the user
                            // alert("Pricing options are still loading. Please wait a moment.");
                        } else {
                        }
                    });
                });

                // --- Helper Functions ---
                // --- Helper Functions ---
                // (Assuming getUrlParameter and debounce are defined elsewhere or not needed for this specific change)
                // (Assuming DOM element references like pricingLinks are defined in the parent scope)

                function setPricingLinksState(disabled) {
                    const pricingLinksNodeList = document.querySelectorAll('.pricing-option-card'); // Re-query DOM
                    const globalStyleInvalid = !window.selectedStyleNumber || String(window.selectedStyleNumber).includes('{');
                    const globalColorInvalid = !window.selectedCatalogColor || String(window.selectedCatalogColor).includes('{');

                    if (!disabled && (globalStyleInvalid || globalColorInvalid)) {
                        console.warn(`setPricingLinksState: Attempted to enable links, but global state is invalid (Style: ${window.selectedStyleNumber}, Color: ${window.selectedCatalogColor}). Forcing disable.`);
                        disabled = true;
                    }

                    console.log(`Setting pricing links state to: ${disabled ? 'disabled' : 'enabled (if individually validated)'}`);
                    if (disabled) {
                        window.arePricingLinksReady = false; // Set flag when disabling
                    }
                    // Note: Enabling is handled by updatePricingLinks which sets arePricingLinksReady = true

                    pricingLinksNodeList.forEach(link => {
                        if (disabled) {
                            if (!link.classList.contains('pricing-link-disabled')) {
                                link.classList.add('pricing-link-disabled');
                            }
                            // Optional: Reset href to a placeholder if disabling globally
                            // const basePath = (link.getAttribute('href') || '').split('?')[0];
                            // if (basePath) {
                            //    link.setAttribute('href', `${basePath}?StyleNumber={styleNumber}&COLOR={colorCode}`);
                            // }
                        }
                        // *** REMOVED redundant 'else' block. Enabling is solely handled by updatePricingLinks. ***
                    });
                }
                function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
                function sortSizesLogical(sizes) { const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'OSFM']; const knownSizes = sizes.filter(s => s && sizeOrder.includes(s.toUpperCase())).sort((a, b) => sizeOrder.indexOf(a.toUpperCase()) - sizeOrder.indexOf(b.toUpperCase())); const numericSizes = sizes.filter(s => s && !isNaN(parseInt(s))).sort((a, b) => parseInt(a) - parseInt(b)); const otherSizes = sizes.filter(s => s && isNaN(parseInt(s)) && !sizeOrder.includes(s.toUpperCase())).sort(); return [...knownSizes, ...numericSizes, ...otherSizes]; }
        
                // --- Autocomplete Functions ---
                async function fetchStyleSuggestions(searchTerm) {
                     console.log("StyleSearch: fetchStyleSuggestions called with term:", searchTerm); if (!styleSearchInput || !suggestionsList) return; if (!searchTerm || searchTerm.length < 2) { clearSuggestions(); return; } console.log("StyleSearch: Fetching suggestions from API..."); const searchUrl = `${API_PROXY_BASE_URL}/api/stylesearch?term=${encodeURIComponent(searchTerm)}`; console.log("StyleSearch: API URL:", searchUrl); try { const response = await fetch(searchUrl); console.log("StyleSearch: API Response Status:", response.status); if (!response.ok) { const errorText = await response.text(); console.error("StyleSearch: API Response Text:", errorText); throw new Error(`API Error ${response.status}: ${response.statusText}`); } const suggestions = await response.json(); console.log("StyleSearch: Suggestions received from API:", suggestions); displaySuggestions(suggestions); } catch (error) { console.error("StyleSearch: Failed to fetch or parse suggestions:", error); clearSuggestions(); }
                 }
                function displaySuggestions(suggestions) {
                     console.log("StyleSearch: displaySuggestions called with:", suggestions); if (!suggestionsList) return; clearSuggestions(); if (!suggestions || suggestions.length === 0) { console.log("StyleSearch: No suggestions to display."); suggestionsList.classList.replace('suggestions-visible', 'suggestions-hidden'); return; } suggestions.forEach(suggestion => { const div = document.createElement('div'); div.textContent = suggestion.label; div.dataset.styleNumber = suggestion.value; div.addEventListener('click', () => { handleSuggestionSelection(suggestion.value, suggestion.label); }); suggestionsList.appendChild(div); }); suggestionsList.classList.replace('suggestions-hidden', 'suggestions-visible'); console.log("StyleSearch: Suggestions displayed.");
                }
                function clearSuggestions() { if (suggestionsList) { suggestionsList.innerHTML = ''; suggestionsList.classList.replace('suggestions-visible', 'suggestions-hidden'); } }
                function handleSuggestionSelection(selectedStyleNumber, selectedLabel) {
                     console.log("StyleSearch: Style selected:", selectedStyleNumber); if (styleSearchInput) { styleSearchInput.value = selectedStyleNumber; } clearSuggestions();
                     updatePageForStyle(selectedStyleNumber); // Trigger updates
                }
        
                // --- Product Details Functions ---
                async function loadProductInfo(styleNumber, colorName) {
                     console.log(`ProductInfo: Loading details for Style: ${styleNumber}, Color: ${colorName || 'Initial Load'}`);
                     if (!productInfoArea) return;
        
                     // If it's not the initial load (colorName is provided), only update images and color name
                     if (colorName) {
                         console.log("ProductInfo: Updating existing details for new color.");
                         const colorNameSpan = document.getElementById('product-info-color-name');
                         if (colorNameSpan) colorNameSpan.textContent = colorName || 'N/A';
        
                         // Fetch only image details if needed, or assume base details object is sufficient
                         // For simplicity, let's assume we need to fetch again to get color-specific images
                         const catalogColor = window.selectedCatalogColor || colorName;
                         const detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}&COLOR_NAME=${encodeURIComponent(colorName)}&CATALOG_COLOR=${encodeURIComponent(catalogColor)}`;
                         console.log(`ProductInfo: Fetching image details from URL: ${detailApiUrl}`);
                         try {
                             const response = await fetch(detailApiUrl);
                             if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                             const details = await response.json();
                             
                             const mainImageUrl = details.FRONT_MODEL || details.FRONT_FLAT || '';
                             const altText = `Product image for ${details.PRODUCT_TITLE || styleNumber} - ${colorName}`;
                             const thumb1 = details.FRONT_MODEL;
                             const thumb2 = details.BACK_FLAT;
                             const thumb3 = details.BACK_MODEL;
                             const thumb4 = details.FRONT_FLAT;
        
                             // Update only the image elements
                             const mainImage = document.getElementById('main-product-image-dp2');
                             const additionalImagesContainer = productInfoArea.querySelector('.additional-images-dp2');
                             
                             if (mainImage) {
                                 mainImage.src = mainImageUrl;
                                 mainImage.alt = altText;
                             }
                             if (additionalImagesContainer) {
                                 additionalImagesContainer.innerHTML = `
                                     ${createThumbnailHtml(thumb1, altText)}
                                     ${createThumbnailHtml(thumb4, altText)}
                                     ${createThumbnailHtml(thumb2, altText)}
                                     ${createThumbnailHtml(thumb3, altText)}
                                 `;
                                 setupImageGallery(); // Re-setup gallery listeners
                             }
                             console.log("ProductInfo: Images updated for new color.");
        
                         } catch (error) {
                             console.error("ProductInfo: Failed to update images for color:", error);
                             // Optionally display an error message near the images
                         }
                         return; // Exit after updating color-specific parts
                     }
        
                     // --- Initial Load Logic ---
                     console.log("ProductInfo: Performing initial load.");
                     productInfoArea.innerHTML = '<div class="loading-message">Loading product details...</div>';
                     
                     const detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`;
                     console.log(`ProductInfo: Fetching initial details from URL: ${detailApiUrl}`);
                     
                     try {
                         const response = await fetch(detailApiUrl);
                         if (!response.ok) {
                             if (response.status === 404) throw new Error(`Details not found.`);
                             else throw new Error(`API Error: ${response.statusText}`);
                         }
                         
                         const details = await response.json();
                         console.log(`ProductInfo: Received initial data:`, details);
                         
                         const mainImageUrl = details.FRONT_MODEL || details.FRONT_FLAT || '';
                         const altText = `Product image for ${details.PRODUCT_TITLE || styleNumber} - Default`;
                         const thumb1 = details.FRONT_MODEL;
                         const thumb2 = details.BACK_FLAT;
                         const thumb3 = details.BACK_MODEL;
                         const thumb4 = details.FRONT_FLAT;
        
                         // Build the full HTML structure including the inline swatch placeholder
                         productInfoArea.innerHTML = `<div class="product-gallery-container-dp2">
                             <div class="product-info-wrapper-dp2">
                                 <div class="product-image-area-dp2">
                                     <div class="main-image-wrapper-dp2">
                                         <img id="main-product-image-dp2" src="${mainImageUrl}" alt="${altText}" onerror="this.style.display='none';">
                                     </div>
                                     <div class="additional-images-dp2">
                                         ${createThumbnailHtml(thumb1, altText)}
                                         ${createThumbnailHtml(thumb4, altText)}
                                         ${createThumbnailHtml(thumb2, altText)}
                                         ${createThumbnailHtml(thumb3, altText)}
                                     </div>
                                 </div>
                                 <div class="product-details-area-dp2">
                                     <h2>${details.PRODUCT_TITLE || ''}</h2>
                                     <p class="style-number">Style: ${styleNumber}</p>
                                     <p class="selected-color">Color: <span id="product-info-color-name">Select Color</span></p>
                                     <p class="product-description">${details.PRODUCT_DESCRIPTION || ''}</p>
                                     <!-- Inline swatch area - will be populated by loadSwatches function -->
                                     <div id="inline-swatch-area" class="product-swatches"></div>
                                 </div>
                             </div>
                         </div>`;
                         
                         setupImageGallery();
                     } catch (error) {
                         console.error("ProductInfo: Failed to load initial details:", error);
                         if (productInfoArea) productInfoArea.innerHTML = `<div class="error-message">Error loading product details: ${error.message}</div>`;
                     }
                 }
                // --- Thumbnail Click Handler ---
                function handleThumbnailClick(event) {
                    if (!event.target.classList.contains('product-thumbnail-dp2')) return;
                    
                    const clickedThumb = event.target;
                    const mainImage = document.getElementById('main-product-image-dp2');
                    const thumbnailContainer = clickedThumb.closest('.additional-images-dp2');
                    
                    if (!mainImage || !thumbnailContainer) return;
                    
                    const newImageSrc = clickedThumb.getAttribute('src');
                    if (newImageSrc) {
                        mainImage.setAttribute('src', newImageSrc);
                        
                        // Update active thumbnail styling
                        const allThumbnails = thumbnailContainer.querySelectorAll('.product-thumbnail-dp2');
                        allThumbnails.forEach(t => {
                            t.classList.remove('active-thumbnail');
                            t.style.opacity = '0.7';
                            t.style.border = '1px solid #ccc';
                        });
                        
                        clickedThumb.classList.add('active-thumbnail');
                        clickedThumb.style.opacity = '1.0';
                        clickedThumb.style.border = '2px solid #007bff';
                        
                        console.log('ImageGallery: Main image updated.');
                    }
                }
        
                // --- Swatch Functions ---
                async function loadSwatches(styleNumber) {
                     console.log(`Swatches: Loading for Style: ${styleNumber}`);
                     
                     // Target the inline swatch area directly
                     const inlineSwatchArea = document.getElementById('inline-swatch-area');
                     
                     if (!inlineSwatchArea) {
                         // This should ideally not happen if loadProductInfo ran correctly
                         console.error("Swatches: Critical Error - Inline swatch area (#inline-swatch-area) not found in DOM.");
                         // Optionally update the hidden original area as a fallback?
                         const originalSwatchArea = document.getElementById('swatch-area');
                         if (originalSwatchArea) {
                             originalSwatchArea.innerHTML = '<div class="error-message">Error displaying swatches inline.</div>';
                         }
                         return;
                     }
                     
                     console.log("Swatches: Found inline swatch area. Setting loading message.");
                     inlineSwatchArea.innerHTML = '<div class="loading-message">Loading swatches...</div>';
                     
                     // Keep a reference to the target area
                     const swatchArea = inlineSwatchArea;
                     
                     swatchArea.innerHTML = '<div class="loading-message">Loading swatches...</div>';
                     
                     const swatchApiUrl = `${API_PROXY_BASE_URL}/api/color-swatches?styleNumber=${encodeURIComponent(styleNumber)}`;
                     
                     try {
                         const response = await fetch(swatchApiUrl);
                         if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                         
                         const swatches = await response.json();
                         console.log(`Swatches: Data received: ${swatches.length} records`);
                         
                         // Clear the inline area
                         inlineSwatchArea.innerHTML = '';
                         
                         if (!swatches || swatches.length === 0) {
                             inlineSwatchArea.innerHTML = '<p>No color options found.</p>';
                             return;
                         }
                         
                         // Create content directly in the inline area
                         const title = document.createElement('p');
                         title.textContent = 'Available Colors:';
                         inlineSwatchArea.appendChild(title);
                         
                         const container = document.createElement('div');
                         container.className = 'swatch-container';
                         inlineSwatchArea.appendChild(container);
                     // *** FIX: De-duplicate swatches by COLOR_NAME before creating elements ***
                     const uniqueSwatchesMap = new Map();
                     swatches.filter(s => s.COLOR_NAME && s.COLOR_SQUARE_IMAGE) // Ensure valid data
                             .forEach(swatch => {
                                 if (!uniqueSwatchesMap.has(swatch.COLOR_NAME)) {
                                     uniqueSwatchesMap.set(swatch.COLOR_NAME, swatch);
                                 }
                             });
        
                     const uniqueSortedSwatches = Array.from(uniqueSwatchesMap.values())
                                                      .sort((a, b) => a.COLOR_NAME.localeCompare(b.COLOR_NAME));
        
                     console.log(`Swatches: Displaying ${uniqueSortedSwatches.length} unique valid swatches.`);
        
                     // Function to create a swatch element
                     const createSwatchElement = (swatch, targetContainer) => {
                         const swatchWrapper = document.createElement('div');
                         swatchWrapper.className = 'swatch-wrapper';
                         const swatchElement = document.createElement('div');
                         swatchElement.className = 'color-swatch-item';
                         swatchElement.title = swatch.COLOR_NAME;
                         swatchElement.style.backgroundImage = `url('${swatch.COLOR_SQUARE_IMAGE}')`;
                         swatchElement.dataset.colorName = swatch.COLOR_NAME;
                         swatchElement.dataset.catalogColor = swatch.CATALOG_COLOR;
                         swatchElement.addEventListener('click', handleSwatchClick);
                         const colorNameElement = document.createElement('div');
                         colorNameElement.className = 'color-name';
                         colorNameElement.textContent = swatch.COLOR_NAME;
                         swatchWrapper.appendChild(swatchElement);
                         swatchWrapper.appendChild(colorNameElement);
                         targetContainer.appendChild(swatchWrapper);
                         return swatchElement;
                     };
                     
                     // Add swatches to the inline container
                     let firstSwatchElement = null;
                     
                     uniqueSortedSwatches.forEach(swatch => { // Iterate over unique swatches
                         const element = createSwatchElement(swatch, container); // Append to the inline container
                         if (!firstSwatchElement) firstSwatchElement = element;
                     });
                     
                     console.log(`Swatches: Appended ${uniqueSortedSwatches.length} swatch elements to #inline-swatch-area.`);
                     
                     // Auto-click first swatch
                     if (firstSwatchElement) {
                         console.log("Swatches: Auto-clicking first swatch:", firstSwatchElement.dataset.colorName);
                         firstSwatchElement.click();
                     } else {
                         console.log("Swatches: No first swatch element found to auto-click.");
                     }
                     } catch (error) {
                         console.error("Swatches: Failed to load:", error);
                         if (swatchArea) {
                             swatchArea.innerHTML = `<div class="error-message">Error loading swatches: ${error.message}</div>`;
                         }
                     }
                 }
                function handleSwatchClick(event) {
                    const clickedSwatch = event.currentTarget;
                    const colorIndex = clickedSwatch.dataset.colorIndex;
                    
                    // Find the color object in our stored data
                    const colorObject = window.currentProductData.colors[colorIndex] ||
                                      window.currentProductData.colors.find(c =>
                                          c.CATALOG_COLOR === clickedSwatch.dataset.catalogColor ||
                                          c.COLOR_NAME === clickedSwatch.dataset.colorName
                                      );
                    
                    if (!colorObject) {
                        console.error("Swatches: Could not find color object for clicked swatch");
                        return;
                    }
                    
                    console.log(`Swatches: Clicked Color: ${colorObject.COLOR_NAME}, Code: ${colorObject.CATALOG_COLOR}`);
                    
                    // Update active swatch styling
                    const allSwatches = document.querySelectorAll('#swatch-area .color-swatch-item, #inline-swatch-area .color-swatch-item');
                    allSwatches.forEach(sw => sw.classList.remove('active-swatch'));
                    clickedSwatch.classList.add('active-swatch');
                    
                    // Update product display with the selected color
                    updateProductDisplayForColor(colorObject);
                    
                    // Update inventory and pricing
                    loadInventory(window.selectedStyleNumber, colorObject.CATALOG_COLOR);
                    triggerPricingDataPageUpdates(window.selectedStyleNumber, colorObject.CATALOG_COLOR);
                    updatePricingLinks(window.selectedStyleNumber, colorObject.COLOR_NAME);
                }
        
                // --- Inventory Update Function (Using New Tabular API) ---
                 async function loadInventory(styleNumber, catalogColor) {
                      console.log(`Inventory: Loading for Style: ${styleNumber}, Color Code: ${catalogColor || 'ALL'}`);
                      if (!inventoryArea) {
                          console.error("Inventory display area not found!");
                          return;
                      }
                      
                      inventoryArea.innerHTML = '<div class="loading-message">Loading Inventory...</div>';
                      
                      // Use the new endpoint that returns data in tabular format
                      let inventoryApiUrl = `${API_PROXY_BASE_URL}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}`;
                      if (catalogColor) {
                          inventoryApiUrl += `&color=${encodeURIComponent(catalogColor)}`;
                      }
                      console.log("Inventory API URL:", inventoryApiUrl);
                      
                      try {
                           const response = await fetch(inventoryApiUrl);
                           if (!response.ok) {
                               throw new Error(`API Error fetching inventory: ${response.statusText}`);
                           }
                           
                           const data = await response.json();
                           console.log("Inventory data received:", data);
                           
                           if (!data || !data.sizes || data.sizes.length === 0 || !data.warehouses || data.warehouses.length === 0) {
                               inventoryArea.innerHTML = '<div class="info-message" style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #17a2b8; margin: 15px 0;"><p>No inventory data available for this style/color combination.</p></div>';
                               return;
                           }
                           
                           // Extract data from the response
                           const { style, color, sizes, warehouses, sizeTotals, grandTotal } = data;
                           
                           // Build the HTML for the inventory table
                           let tableHtml = `<h4>Inventory Levels (${color})</h4>`;
                           
                           tableHtml += '<table id="inventory-table"><thead><tr><th>Warehouse</th>';
                           
                           // Create table headers with sizes
                           sizes.forEach(size => {
                               tableHtml += `<th>${size}</th>`;
                           });
                           
                           tableHtml += '</tr></thead><tbody>';
                           
                           // Create table rows for each warehouse
                           warehouses.forEach(warehouse => {
                               tableHtml += `<tr><td>${warehouse.name}</td>`;
                               
                               // Add cells for each size's inventory quantity
                               warehouse.inventory.forEach((quantity, index) => {
                                   // Color coding based on quantity
                                   let textColor;
                                   if (quantity <= 0) {
                                       textColor = '#E53935'; // Red for no stock
                                   } else if (quantity < 24) {
                                       textColor = '#F57C00'; // Orange for low stock
                                   } else {
                                       textColor = '#388E3C'; // Green for good stock
                                   }
                                   
                                   tableHtml += `<td style="text-align:center; color: ${textColor}; ${quantity < 24 && quantity > 0 ? 'font-weight: bold;' : ''}">${quantity}</td>`;
                               });
                               
                               tableHtml += '</tr>';
                           });
                           
                           // Add totals row
                           tableHtml += '</tbody><tfoot><tr>';
                           tableHtml += '<td>TOTAL INVENTORY</td>';
                           
                           // Add total cells for each size
                           sizeTotals.forEach(total => {
                               tableHtml += `<td style="text-align:center; font-weight: bold;">${total}</td>`;
                           });
                           
                           tableHtml += '</tr></tfoot></table>';
                           
                           inventoryArea.innerHTML = tableHtml;
                      } catch (error) {
                          console.error("Inventory: Failed to load:", error);
                          if (inventoryArea) {
                              inventoryArea.innerHTML = `<div class="error-message">Error loading inventory: ${error.message}</div>`;
                          }
                      }
                 }
        
                // --- Pricing Calculators Trigger Function ---
                 function triggerPricingDataPageUpdates(styleNumber, catalogColor) {
                      console.log(`Pricing: Triggering update for Style=${styleNumber}, Color=${catalogColor}`);
                      // Set global vars for DPs to read
                      window.selectedStyleNumber = styleNumber;
                      window.selectedCatalogColor = catalogColor;
                      window.selectedColorName = window.selectedColorName; // Keep existing name
                      
                      // Update URL with parameters
                      const url = new URL(window.location);
                      url.searchParams.set('StyleNumber', styleNumber);
                      
                      // Always use the catalog color code for URL parameters instead of color name
                      // This ensures better compatibility with the Caspio datapage
                      if (catalogColor) {
                          console.log(`Using catalog color code for URL parameter: ${catalogColor}`);
                          url.searchParams.set('COLOR', catalogColor);
                      } else if (window.selectedColorName) {
                          console.log(`No catalog color available, using color name: ${window.selectedColorName}`);
                          url.searchParams.set('COLOR', window.selectedColorName);
                      }
                      
                      window.history.replaceState({}, '', url);
                      console.log("URL updated with parameters:", url.search);
        
                      // Call each pricing calculator's init function
                      if (typeof initDp5ApiFetch === 'function') {
                          console.log("Calling initDp5ApiFetch with styleNumber:", styleNumber);
                          initDp5ApiFetch(styleNumber);
                      }
                      if (typeof initDp6ApiFetch === 'function') {
                          console.log("Calling initDp6ApiFetch with styleNumber:", styleNumber);
                          initDp6ApiFetch(styleNumber);
                      }
                      if (typeof initDp7ApiFetch === 'function') {
                          console.log("Calling initDp7ApiFetch with styleNumber:", styleNumber);
                          initDp7ApiFetch(styleNumber);
                      }
                      if (typeof initDp8ApiFetch === 'function') {
                          console.log("Calling initDp8ApiFetch with styleNumber:", styleNumber);
                          initDp8ApiFetch(styleNumber);
                      }
                      if (typeof initDtfApiFetch === 'function') {
                          console.log("Calling initDtfApiFetch with styleNumber:", styleNumber);
                          initDtfApiFetch(styleNumber);
                      }
                 }
                 
                 // --- Update Pricing Links Function ---
                 // --- Update Pricing Links Function ---
                 function updatePricingLinks(styleNumber, colorCode) { // colorCode here is actually COLOR_NAME
                     const pricingLinksNodeList = document.querySelectorAll('.pricing-option-card'); // Re-query DOM
                     console.log(`Updating pricing links for Style=${styleNumber}, Color Name (colorCode arg): ${colorCode || 'N/A'}. Found ${pricingLinksNodeList.length} links.`);
                     let allLinksNowValidAndReady = true; // Initialize flag for readiness check

                     if (!styleNumber) {
                         console.warn("Cannot update pricing links: No style number provided. Disabling links.");
                         setPricingLinksState(true);
                         return;
                     }

                     // *** MODIFIED: Strictly require window.selectedCatalogColor for links ***
                     const catalogColorToUse = window.selectedCatalogColor; // Use only the globally set catalog color

                     if (!catalogColorToUse || String(catalogColorToUse).includes('{')) { // Also check if it's a placeholder
                         console.warn(`Cannot update pricing links: Required 'window.selectedCatalogColor' is invalid or missing (${catalogColorToUse}). Disabling links.`);
                         setPricingLinksState(true); // Ensure links remain disabled (this also sets arePricingLinksReady = false)
                         return;
                     }
                     console.log(`Valid data found (Style: ${styleNumber}, Catalog Color: ${catalogColorToUse}). Updating links.`);
                     // Ensure links are disabled by default while updating hrefs
                     pricingLinksNodeList.forEach(link => {
                         if (!link.classList.contains('pricing-link-disabled')) {
                             link.classList.add('pricing-link-disabled');
                         }
                     });

                     // Removed redundant initialization of allLinksNowValid, using allLinksNowValidAndReady instead

                     pricingLinksNodeList.forEach(link => {
                         const currentHref = link.getAttribute('href') || '';
                         const urlParts = currentHref.split('?');
                         const basePath = urlParts[0];

                         if (!basePath) {
                             console.warn(`Skipping link with invalid base path: ${currentHref}`);
                             allLinksNowValidAndReady = false; // Mark as not ready if any link is bad
                             return;
                         }
             
                         const newHref = `${basePath}?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(catalogColorToUse)}`;
                         link.setAttribute('href', newHref);
                         console.log(`Set href for ${basePath}: ${newHref}`);
             
                         if (newHref.includes('{styleNumber}') || newHref.includes('{colorCode}') || !styleNumber || !catalogColorToUse || String(styleNumber).includes('{') || String(catalogColorToUse).includes('{')) {
                               allLinksNowValidAndReady = false; // Mark as not ready
                               if (!link.classList.contains('pricing-link-disabled')) { // Should already be disabled, but double-check
                                  link.classList.add('pricing-link-disabled');
                              }
                         } else {
                              console.log(`Link ${basePath} is valid. Enabling.`);
                               if (link.classList.contains('pricing-link-disabled')) {
                                  link.classList.remove('pricing-link-disabled');
                               }
                          }
                     });

                     // After iterating through all links, set the global readiness flag
                     if (allLinksNowValidAndReady) {
                         window.arePricingLinksReady = true;
                     } else {
                         window.arePricingLinksReady = false; // Ensure it's false if any link failed validation
                     }
                 }

                // --- New Product Data Loading Function ---
                async function loadProductData(styleNumber) {
                    console.log(`ProductData: Loading data for Style: ${styleNumber}`);
                    if (!productInfoArea) return;

                    // Show loading message
                    productInfoArea.innerHTML = '<div class="loading-message">Loading product details...</div>';
                    
                    // Make a single call to the product-colors endpoint
                    const productApiUrl = `${API_PROXY_BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
                    console.log(`ProductData: Fetching from URL: ${productApiUrl}`);
                    
                    try {
                        const response = await fetch(productApiUrl);
                        if (!response.ok) {
                            if (response.status === 404) throw new Error(`Product not found.`);
                            else throw new Error(`API Error: ${response.statusText}`);
                        }
                        
                        // Store the entire response in a global variable
                        const productData = await response.json();
                        window.currentProductData = productData;
                        console.log(`ProductData: Received data:`, productData);
                        
                        // Check if we have valid data
                        if (!productData || !productData.colors || productData.colors.length === 0) {
                            throw new Error('No product data or colors available.');
                        }
                        
                        // Build the initial product display structure
                        buildProductDisplay(productData, styleNumber);
                        
                        // Generate and display color swatches
                        generateColorSwatches(productData.colors);
                        
                        // Determine initial color to display
                        const urlParams = new URLSearchParams(window.location.search);
                        const colorParam = urlParams.get('COLOR') || urlParams.get('catalogColor');
                        
                        // Find the color in our data
                        let initialColorObject = null;
                        
                        if (colorParam) {
                            // Try to match by CATALOG_COLOR first, then by COLOR_NAME
                            initialColorObject = productData.colors.find(c =>
                                c.CATALOG_COLOR === colorParam || c.COLOR_NAME === colorParam
                            );
                        }
                        
                        // If no color found from URL or no URL parameter, use the first color
                        if (!initialColorObject && productData.colors.length > 0) {
                            initialColorObject = productData.colors[0];
                        }
                        
                        // Update display with the selected color
                        if (initialColorObject) {
                            updateProductDisplayForColor(initialColorObject);
                            
                            // Highlight the corresponding swatch
                            const swatches = document.querySelectorAll('#inline-swatch-area .color-swatch-item');
                            swatches.forEach(swatch => {
                                if (swatch.dataset.catalogColor === initialColorObject.CATALOG_COLOR) {
                                    swatch.classList.add('active-swatch');
                                }
                            });
                            
                            // Update inventory and pricing
                            loadInventory(styleNumber, initialColorObject.CATALOG_COLOR);
                            triggerPricingDataPageUpdates(styleNumber, initialColorObject.CATALOG_COLOR);
                            updatePricingLinks(styleNumber, initialColorObject.COLOR_NAME);
                        }
                        
                    } catch (error) {
                        console.error("ProductData: Failed to load:", error);
                        if (productInfoArea) {
                            productInfoArea.innerHTML = `<div class="error-message">Error loading product data: ${error.message}</div>`;
                        }
                    }
                }

                // --- Helper function to build the initial product display ---
                function buildProductDisplay(productData, styleNumber) {
                    console.log("ProductDisplay: Building initial display");
                    
                    // Create the basic structure
                    productInfoArea.innerHTML = `<div class="product-gallery-container-dp2">
                        <div class="product-info-wrapper-dp2">
                            <div class="product-image-area-dp2">
                                <div class="main-image-wrapper-dp2">
                                    <img id="main-product-image-dp2" src="" alt="Product image" onerror="this.style.display='none';">
                                </div>
                                <div class="additional-images-dp2">
                                    <!-- Thumbnails will be populated by updateProductDisplayForColor -->
                                </div>
                            </div>
                            <div class="product-details-area-dp2">
                                <h2>${productData.productTitle || ''}</h2>
                                <p class="style-number">Style: ${styleNumber}</p>
                                <p class="selected-color">Color: <span id="product-info-color-name">Select Color</span></p>
                                <p class="product-description">${productData.PRODUCT_DESCRIPTION || ''}</p>
                                <!-- Inline swatch area -->
                                <div id="inline-swatch-area" class="product-swatches"></div>
                            </div>
                        </div>
                    </div>`;
                }

                // --- Function to generate color swatches ---
                function generateColorSwatches(colors) {
                    console.log(`Swatches: Generating from ${colors.length} colors`);
                    
                    const inlineSwatchArea = document.getElementById('inline-swatch-area');
                    if (!inlineSwatchArea) {
                        console.error("Swatches: Inline swatch area not found!");
                        return;
                    }
                    
                    // Clear the swatch area
                    inlineSwatchArea.innerHTML = '';
                    
                    if (!colors || colors.length === 0) {
                        inlineSwatchArea.innerHTML = '<p>No color options found.</p>';
                        return;
                    }
                    
                    // Create title
                    const title = document.createElement('p');
                    title.textContent = 'Available Colors:';
                    inlineSwatchArea.appendChild(title);
                    
                    // Create container
                    const container = document.createElement('div');
                    container.className = 'swatch-container';
                    inlineSwatchArea.appendChild(container);
                    
                    // Add swatches
                    colors.forEach(color => {
                        if (!color.COLOR_NAME || !color.COLOR_SQUARE_IMAGE) return;
                        
                        const swatchWrapper = document.createElement('div');
                        swatchWrapper.className = 'swatch-wrapper';
                        
                        const swatchElement = document.createElement('div');
                        swatchElement.className = 'color-swatch-item';
                        swatchElement.title = color.COLOR_NAME;
                        swatchElement.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
                        swatchElement.dataset.colorName = color.COLOR_NAME;
                        swatchElement.dataset.catalogColor = color.CATALOG_COLOR;
                        swatchElement.dataset.colorIndex = colors.indexOf(color); // Store index for easy lookup
                        swatchElement.addEventListener('click', handleSwatchClick);
                        
                        const colorNameElement = document.createElement('div');
                        colorNameElement.className = 'color-name';
                        colorNameElement.textContent = color.COLOR_NAME;
                        
                        swatchWrapper.appendChild(swatchElement);
                        swatchWrapper.appendChild(colorNameElement);
                        container.appendChild(swatchWrapper);
                    });
                    
                    console.log(`Swatches: Generated ${colors.length} swatch elements`);
                }

                // --- Function to update product display for a specific color ---
                function updateProductDisplayForColor(colorObject) {
                    console.log(`ProductDisplay: Updating for color: ${colorObject.COLOR_NAME}`);
                    
                    // Update global variables
                    window.selectedColorName = colorObject.COLOR_NAME;
                    window.selectedCatalogColor = colorObject.CATALOG_COLOR;
                    
                    // Update color name in product info area
                    const colorNameSpan = document.getElementById('product-info-color-name');
                    if (colorNameSpan) colorNameSpan.textContent = colorObject.COLOR_NAME || 'N/A';
                    
                    // Update main product image
                    const mainImage = document.getElementById('main-product-image-dp2');
                    if (mainImage) {
                        // Use the best available image
                        const mainImageUrl = colorObject.MAIN_IMAGE_URL ||
                                           colorObject.FRONT_MODEL ||
                                           colorObject.FRONT_FLAT || '';
                        
                        mainImage.src = mainImageUrl;
                        mainImage.alt = `Product image for ${window.currentProductData.productTitle || window.selectedStyleNumber} - ${colorObject.COLOR_NAME}`;
                    }
                    
                    // Update thumbnails
                    const additionalImagesContainer = document.querySelector('.additional-images-dp2');
                    if (additionalImagesContainer) {
                        const altText = `Product image for ${window.currentProductData.productTitle || window.selectedStyleNumber} - ${colorObject.COLOR_NAME}`;
                        
                        // Create thumbnails from available images
                        additionalImagesContainer.innerHTML = '';
                        
                        // Add thumbnails in priority order
                        const imageSources = [
                            { url: colorObject.FRONT_MODEL, label: 'Front Model' },
                            { url: colorObject.FRONT_FLAT, label: 'Front Flat' },
                            { url: colorObject.BACK_MODEL, label: 'Back Model' },
                            { url: colorObject.BACK_FLAT, label: 'Back Flat' },
                            { url: colorObject.SIDE_MODEL, label: 'Side Model' },
                            { url: colorObject.SIDE_FLAT, label: 'Side Flat' }
                        ];
                        
                        imageSources.forEach(source => {
                            if (source.url && source.url.trim() !== '') {
                                const thumbnail = document.createElement('img');
                                thumbnail.className = 'product-thumbnail-dp2';
                                thumbnail.src = source.url;
                                thumbnail.alt = `${altText} - ${source.label}`;
                                thumbnail.addEventListener('click', handleThumbnailClick);
                                thumbnail.onerror = function() { this.style.display = 'none'; };
                                additionalImagesContainer.appendChild(thumbnail);
                            }
                        });
                        
                        // Activate the first thumbnail
                        const firstThumb = additionalImagesContainer.querySelector('.product-thumbnail-dp2');
                        if (firstThumb) {
                            firstThumb.classList.add('active-thumbnail');
                            firstThumb.style.opacity = '1.0';
                            firstThumb.style.border = '2px solid #007bff';
                        }
                    }
                }

                // --- Main Orchestration Function ---
                async function updatePageForStyle(styleNumber) {
                    console.log(`--- StyleSearch: Updating Page for Style: ${styleNumber} ---`);
                    
                    // Store the style number in global variables
                    window.selectedStyleNumber = styleNumber;
                    window.selectedColorName = null;
                    window.selectedCatalogColor = null;
                    window.currentProductData = null; // Reset product data
                    setPricingLinksState(true); // Disable pricing links when starting a new style search
                    
                    console.log("Global variables reset:", {
                        selectedStyleNumber: window.selectedStyleNumber,
                        selectedColorName: window.selectedColorName,
                        selectedCatalogColor: window.selectedCatalogColor,
                        currentProductData: window.currentProductData
                    });
                    
                    // Update loading indicators
                    if (productInfoArea) {
                        console.log("Updating product info area with loading message");
                        productInfoArea.innerHTML = '<div class="loading-message">Loading product details...</div>';
                    } else {
                        console.error("Product info area not found!");
                    }
                    
                    // Update inventory area with loading message
                    const inventoryAreaElement = document.getElementById('inventory-area');
                    if (inventoryAreaElement) {
                        console.log("Updating inventory area with loading message");
                        inventoryAreaElement.innerHTML = '<p><i>Loading Inventory...</i></p>';
                    } else {
                        console.error("Inventory area not found!");
                    }
                    
                    // Load product data (which will handle swatches and initial color selection)
                    console.log("Calling loadProductData with styleNumber:", styleNumber);
                    await loadProductData(styleNumber);
                    
                    console.log("--- StyleSearch: Initial updates triggered for style", styleNumber);
                }
        
                // --- Tab Switching Logic ---
                function setupTabs() {
                    if (!tabNav) return; // Exit if tab structure not found
        
                    tabNav.addEventListener('click', (e) => {
                        if (e.target && e.target.classList.contains('tab-link')) {
                            e.preventDefault(); // Prevent default anchor link behavior
        
                            const targetPanelSelector = e.target.getAttribute('data-tab-target');
                            if (!targetPanelSelector) return;
        
                            console.log("Tab clicked, target:", targetPanelSelector);
                            
                            // Add a loading spinner near the clicked tab
                            const spinnerDiv = document.createElement('div');
                            spinnerDiv.className = 'loading-spinner';
                            
                            // Get the position of the clicked tab
                            const tabRect = e.target.getBoundingClientRect();
                            
                            // Position the spinner next to the tab
                            spinnerDiv.style.position = 'absolute';
                            spinnerDiv.style.left = `${tabRect.right + 10}px`;
                            spinnerDiv.style.top = `${tabRect.top + (tabRect.height/2) - 15}px`;
                            spinnerDiv.style.width = '30px';
                            spinnerDiv.style.height = '30px';
                            spinnerDiv.style.border = '3px solid rgba(0, 123, 255, 0.3)';
                            spinnerDiv.style.borderTop = '3px solid #007bff';
                            spinnerDiv.style.borderRadius = '50%';
                            spinnerDiv.style.animation = 'spin 1s linear infinite';
                            spinnerDiv.style.zIndex = '9999';
                            
                            // Add keyframe animation for spinner
                            if (!document.getElementById('spinner-style')) {
                                const styleEl = document.createElement('style');
                                styleEl.id = 'spinner-style';
                                styleEl.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                                document.head.appendChild(styleEl);
                            }
                            
                            document.body.appendChild(spinnerDiv);
                            setTimeout(() => spinnerDiv.remove(), 3000); // Remove after 3 seconds
        
                            // Remove active class from all links and panels
                            tabLinks.forEach(link => link.classList.remove('active'));
                            tabContentPanels.forEach(panel => panel.classList.remove('active'));
        
                            // Add active class to clicked link and target panel
                            e.target.classList.add('active');
                            const targetPanel = document.querySelector(targetPanelSelector);
                            if (targetPanel) {
                                targetPanel.classList.add('active');
                                console.log("Activated panel:", targetPanelSelector);
                                
                                // Trigger a refresh/re-init for the newly activated DataPage
                                // This is needed if DPs don't display correctly when initially hidden
                                try {
                                    // Add a loading indicator to the panel to show that it's being refreshed
                                    const refreshContainer = document.createElement('div');
                                    refreshContainer.style.display = 'flex';
                                    refreshContainer.style.alignItems = 'center';
                                    refreshContainer.style.margin = '10px 0';
                                    refreshContainer.style.padding = '10px';
                                    refreshContainer.style.backgroundColor = 'var(--background-light)';
                                    refreshContainer.style.borderRadius = 'var(--radius-sm)';
                                    
                                    // Create spinner
                                    const spinner = document.createElement('div');
                                    spinner.style.width = '20px';
                                    spinner.style.height = '20px';
                                    spinner.style.border = '3px solid rgba(0, 123, 255, 0.3)';
                                    spinner.style.borderTop = '3px solid var(--primary-color)';
                                    spinner.style.borderRadius = '50%';
                                    spinner.style.animation = 'spin 1s linear infinite';
                                    spinner.style.marginRight = '10px';
                                    
                                    // Create text
                                    const text = document.createElement('div');
                                    text.textContent = `Refreshing data for ${targetPanelSelector.substring(1)}...`;
                                    text.style.color = 'var(--primary-color)';
                                    
                                    refreshContainer.appendChild(spinner);
                                    refreshContainer.appendChild(text);
                                    targetPanel.prepend(refreshContainer);
                                    
                                    // Store reference for later removal
                                    const refreshIndicator = refreshContainer;
                                    
                                    // Check if we have a style number
                                    if (!window.selectedStyleNumber) {
                                        console.warn("No style number selected for refresh");
                                        
                                        // Update the container to show error state
                                        refreshContainer.style.backgroundColor = '#fff0f0';
                                        refreshContainer.style.border = '1px solid #ffcccc';
                                        
                                        // Replace spinner with error icon
                                        spinner.style.border = 'none';
                                        spinner.style.animation = 'none';
                                        spinner.style.width = '20px';
                                        spinner.style.height = '20px';
                                        spinner.style.borderRadius = '50%';
                                        spinner.style.backgroundColor = '#c00';
                                        spinner.style.position = 'relative';
                                        
                                        // Add X to error icon
                                        spinner.innerHTML = '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 12px;">!</span>';
                                        
                                        // Update text
                                        text.textContent = "Error: No style number selected";
                                        text.style.color = '#c00';
                                        
                                        setTimeout(() => refreshIndicator.remove(), 3000);
                                        return;
                                    }
                                    
                                    // Debug: Log the selected style number
                                    console.log("DEBUG - Selected Style Number:", window.selectedStyleNumber);
                                    console.log("DEBUG - URL Parameters:", window.location.search);
                                    
                                    // Refresh the appropriate data page
                                    if (targetPanelSelector === '#embroidery-panel' && typeof initDp5ApiFetch === 'function') {
                                        console.log("Refreshing DP5 (Embroidery) data...");
                                        console.log("Using style number:", window.selectedStyleNumber);
                                        initDp5ApiFetch(window.selectedStyleNumber);
                                        refreshIndicator.textContent = `Refreshing DP5 (Embroidery) data for style ${window.selectedStyleNumber}...`;
                                    } else if (targetPanelSelector === '#cap-emb-panel' && typeof initDp7ApiFetch === 'function') {
                                        console.log("Refreshing DP7 (Cap Embroidery) data...");
                                        initDp7ApiFetch(window.selectedStyleNumber);
                                        refreshIndicator.textContent = `Refreshing DP7 (Cap Embroidery) data for style ${window.selectedStyleNumber}...`;
                                    } else if (targetPanelSelector === '#dtg-panel' && typeof initDp6ApiFetch === 'function') {
                                        console.log("Refreshing DP6 (DTG) data...");
                                        initDp6ApiFetch(window.selectedStyleNumber);
                                        refreshIndicator.textContent = `Refreshing DP6 (DTG) data for style ${window.selectedStyleNumber}...`;
                                    } else if (targetPanelSelector === '#screenprint-panel' && typeof initDp8ApiFetch === 'function') {
                                        console.log("Refreshing DP8 (Screen Print) data...");
                                        initDp8ApiFetch(window.selectedStyleNumber);
                                        refreshIndicator.textContent = `Refreshing DP8 (Screen Print) data for style ${window.selectedStyleNumber}...`;
                                    } else if (targetPanelSelector === '#dtf-panel' && typeof initDtfApiFetch === 'function') {
                                        console.log("Refreshing DTF data...");
                                        initDtfApiFetch(window.selectedStyleNumber);
                                        refreshIndicator.textContent = `Refreshing DTF data for style ${window.selectedStyleNumber}...`;
                                    } else if (targetPanelSelector === '#inventory-panel' && typeof loadInventory === 'function') {
                                        console.log("Refreshing Inventory data...");
                                        loadInventory(window.selectedStyleNumber, window.selectedCatalogColor);
                                        refreshIndicator.textContent = `Refreshing Inventory data for style ${window.selectedStyleNumber}...`;
                                    } else {
                                        refreshIndicator.textContent = `No refresh function found for ${targetPanelSelector}`;
                                        refreshIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                                    }
                                    
                                    // Remove the indicator after 3 seconds
                                    setTimeout(() => refreshIndicator.remove(), 3000);
                                } catch (error) {
                                    console.error("Error refreshing data page:", error);
                                    
                                    // Update the container to show error state
                                    refreshContainer.style.backgroundColor = '#fff0f0';
                                    refreshContainer.style.border = '1px solid #ffcccc';
                                    
                                    // Replace spinner with error icon
                                    spinner.style.border = 'none';
                                    spinner.style.animation = 'none';
                                    spinner.style.width = '20px';
                                    spinner.style.height = '20px';
                                    spinner.style.borderRadius = '50%';
                                    spinner.style.backgroundColor = '#c00';
                                    spinner.style.position = 'relative';
                                    
                                    // Add X to error icon
                                    spinner.innerHTML = '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 12px;">!</span>';
                                    
                                    // Update text
                                    text.textContent = `Error refreshing data: ${error.message}`;
                                    text.style.color = '#c00';
                                    
                                    // Keep error visible a bit longer
                                    setTimeout(() => refreshIndicator.remove(), 5000);
                                }
                            } else {
                                console.error("Tab target panel not found:", targetPanelSelector);
                            }
                        }
                    });
                    console.log("Tab system initialized.");
                }
        
        
                // --- Initial Event Listeners Setup ---
                if (styleSearchInput) {
                     // Add input event listener for autocomplete
                     styleSearchInput.addEventListener('input', debounce(async (e) => { await fetchStyleSuggestions(e.target.value); }, 300));
                     
                     // Add keydown event listener for Enter key
                     styleSearchInput.addEventListener('keydown', (e) => {
                         console.log("StyleSearch: Keydown event detected, key:", e.key);
                         
                         if (e.key === 'Enter') {
                             console.log("StyleSearch: Enter key detected");
                             e.preventDefault();
                             
                             // Get the input element directly to ensure we have the latest value
                             const inputElement = document.getElementById('style-search-input');
                             const styleNumber = inputElement ? inputElement.value.trim() : '';
                             console.log("StyleSearch: Style number from input:", styleNumber);
                             
                             if (styleNumber) {
                                 console.log("StyleSearch: Enter key pressed with valid value:", styleNumber);
                                 clearSuggestions();
                                 
                                 // Add a spinner to indicate search is in progress
                                 const spinnerContainer = document.createElement('div');
                                 
                                 // Get the position of the search button
                                 const buttonRect = searchButton.getBoundingClientRect();
                                 
                                 // Position the spinner next to the search button
                                 spinnerContainer.style.position = 'absolute';
                                 spinnerContainer.style.left = `${buttonRect.right + 10}px`;
                                 spinnerContainer.style.top = `${buttonRect.top}px`;
                                 spinnerContainer.style.zIndex = '9999';
                                 spinnerContainer.style.display = 'flex';
                                 spinnerContainer.style.alignItems = 'center';
                                 spinnerContainer.style.padding = '8px 12px';
                                 spinnerContainer.style.backgroundColor = 'white';
                                 spinnerContainer.style.borderRadius = '4px';
                                 spinnerContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                                 
                                 // Create spinner
                                 const spinner = document.createElement('div');
                                 spinner.style.width = '16px';
                                 spinner.style.height = '16px';
                                 spinner.style.border = '2px solid rgba(0, 123, 255, 0.3)';
                                 spinner.style.borderTop = '2px solid var(--primary-color)';
                                 spinner.style.borderRadius = '50%';
                                 spinner.style.animation = 'spin 1s linear infinite';
                                 spinner.style.marginRight = '8px';
                                 
                                 // Create text
                                 const text = document.createElement('div');
                                 text.textContent = `Searching for style: ${styleNumber}...`;
                                 text.style.color = 'var(--primary-color)';
                                 text.style.fontSize = '14px';
                                 
                                 spinnerContainer.appendChild(spinner);
                                 spinnerContainer.appendChild(text);
                                 document.body.appendChild(spinnerContainer);
                                 
                                 // Remove the indicator after 3 seconds
                                 setTimeout(() => spinnerContainer.remove(), 3000);
                                 
                                 // Call the update function
                                 updatePageForStyle(styleNumber);
                             } else {
                                 console.warn("StyleSearch: Empty style number, not processing");
                             }
                         }
                     });
                     
                     // Add search button click event listener
                     const searchButton = document.getElementById('search-button');
                     if (searchButton) {
                         searchButton.addEventListener('click', () => {
                             console.log("StyleSearch: Search button clicked");
                             
                             // Get the input element directly to ensure we have the latest value
                             const inputElement = document.getElementById('style-search-input');
                             if (!inputElement) {
                                 console.error("StyleSearch: Input element not found when button clicked");
                                 return;
                             }
                             
                             const styleNumber = inputElement.value.trim();
                             console.log("StyleSearch: Style number from input:", styleNumber);
                             
                             if (styleNumber) {
                                 console.log("StyleSearch: Search button clicked with valid value:", styleNumber);
                                 clearSuggestions();
                                 
                                 // Add a spinner to indicate search is in progress
                                 const spinnerContainer = document.createElement('div');
                                 
                                 // Get the position of the search input
                                 const inputRect = inputElement.getBoundingClientRect();
                                 
                                 // Position the spinner next to the search input
                                 spinnerContainer.style.position = 'absolute';
                                 spinnerContainer.style.left = `${inputRect.right + 10}px`;
                                 spinnerContainer.style.top = `${inputRect.top}px`;
                                 spinnerContainer.style.zIndex = '9999';
                                 spinnerContainer.style.display = 'flex';
                                 spinnerContainer.style.alignItems = 'center';
                                 spinnerContainer.style.padding = '8px 12px';
                                 spinnerContainer.style.backgroundColor = 'white';
                                 spinnerContainer.style.borderRadius = '4px';
                                 spinnerContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                                 
                                 // Create spinner
                                 const spinner = document.createElement('div');
                                 spinner.style.width = '16px';
                                 spinner.style.height = '16px';
                                 spinner.style.border = '2px solid rgba(0, 123, 255, 0.3)';
                                 spinner.style.borderTop = '2px solid var(--primary-color)';
                                 spinner.style.borderRadius = '50%';
                                 spinner.style.animation = 'spin 1s linear infinite';
                                 spinner.style.marginRight = '8px';
                                 
                                 // Create text
                                 const text = document.createElement('div');
                                 text.textContent = `Searching for style: ${styleNumber}...`;
                                 text.style.color = 'var(--primary-color)';
                                 text.style.fontSize = '14px';
                                 
                                 spinnerContainer.appendChild(spinner);
                                 spinnerContainer.appendChild(text);
                                 document.body.appendChild(spinnerContainer);
                                 
                                 // Remove the indicator after 3 seconds
                                 setTimeout(() => spinnerContainer.remove(), 3000);
                                 
                                 // Call the update function
                                 updatePageForStyle(styleNumber);
                             } else {
                                 console.warn("StyleSearch: Empty style number, not processing");
                             }
                         });
                     } else {
                         console.error("StyleSearch: Button element #search-button not found at init!");
                     }
                 } else { console.error("StyleSearch: Input element #style-search-input not found at init!"); }
                 
                 // Close suggestions when clicking outside
                 document.addEventListener('click', (e) => { if (styleSearchInput && suggestionsList && !styleSearchInput.contains(e.target) && !suggestionsList.contains(e.target)) { clearSuggestions(); } });
        
                 setupTabs(); // Initialize tab switching functionality
         
                 // --- Add this code to handle incoming StyleNumber from URL ---
                 try {
                     console.log("Checking for StyleNumber parameter in URL...");
                     const urlParams = new URLSearchParams(window.location.search); // Gets the '?StyleNumber=ABC' part
                     const styleNumberFromUrl = urlParams.get('StyleNumber'); // Tries to get the value 'ABC'
        
                     if (styleNumberFromUrl) {
                         console.log("Found StyleNumber in URL:", styleNumberFromUrl);
                         console.log("Automatically loading details for this style...");
        
                         // Update the search input field visually (optional, but good user feedback)
                         if (styleSearchInput) {
                              styleSearchInput.value = styleNumberFromUrl;
                         }
        
                         // Call the main function to load all data for this style
                         updatePageForStyle(styleNumberFromUrl);
        
                     } else {
                         console.log("No StyleNumber parameter found in URL. Page will wait for manual search.");
                         // Optionally display a default message if no style is loaded
                          if (productInfoArea && productInfoArea.innerHTML === '') {
                             productInfoArea.innerHTML = '<p><i>Search for a style number above or click a link from the gallery to view product details.</i></p>';
                          }
                          if (inventoryArea && inventoryArea.innerHTML === '') {
                              inventoryArea.innerHTML = '<p><i>Search for a style number to view inventory.</i></p>';
                          }
                     }
                 } catch (error) {
                     console.error("Error processing URL parameters:", error);
                     // Display a general error message if something goes wrong here
                      if (productInfoArea) {
                         productInfoArea.innerHTML = '<div class="error-message">Error reading initial style information from URL. Please try searching manually.</div>';
                      }
                 }
                 // --- End of code to handle incoming StyleNumber ---
        
                 console.log("Page Initialization Complete.");
        
            }); // End DOMContentLoaded listener