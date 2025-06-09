/**
 * Clean Color Adapter
 * Simple, fast adapter that waits for DP5 to populate colors
 * Then transforms them into clean 4-column layout
 */

(function() {
    'use strict';

    console.log('[CLEAN-COLOR] Initializing clean color adapter...');

    let observerStarted = false;
    let transformComplete = false;

    // Wait for DP5 helper to populate colors
    function waitForColors() {
        const colorGrid = document.getElementById('color-swatches');
        if (!colorGrid) {
            setTimeout(waitForColors, 100);
            return;
        }

        // Check if DP5 has added colors - look for color-swatch divs, not images
        const existingSwatches = colorGrid.querySelectorAll('.color-swatch');
        if (existingSwatches.length > 0 && !transformComplete) {
            console.log('[CLEAN-COLOR] Found', existingSwatches.length, 'color swatches from DP5');
            transformColors();
        } else if (!observerStarted) {
            // Start observing for changes
            observerStarted = true;
            observeColorGrid(colorGrid);
        }
    }

    function observeColorGrid(colorGrid) {
        console.log('[CLEAN-COLOR] Starting observer for color grid');
        
        const observer = new MutationObserver((mutations) => {
            // Check if color swatches were added
            let hasSwatches = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (node.classList?.contains('swatch-wrapper') || node.classList?.contains('color-swatch'))) {
                        hasSwatches = true;
                    }
                });
            });

            if (hasSwatches && !transformComplete) {
                console.log('[CLEAN-COLOR] DP5 added color swatches, transforming...');
                setTimeout(transformColors, 100); // Small delay to ensure all swatches are added
            }
        });

        observer.observe(colorGrid, {
            childList: true,
            subtree: true
        });
    }

    function transformColors() {
        if (transformComplete) return;
        
        const colorGrid = document.getElementById('color-swatches');
        if (!colorGrid) return;

        // Check if we've already transformed
        if (colorGrid.classList.contains('clean-color-grid')) {
            console.log('[CLEAN-COLOR] Already transformed, skipping...');
            transformComplete = true;
            return;
        }

        transformComplete = true;

        // Add clean grid class
        colorGrid.classList.add('clean-color-grid');

        // Get all swatch wrappers created by dp5-helper
        const swatchWrappers = Array.from(colorGrid.querySelectorAll('.swatch-wrapper'));
        console.log('[CLEAN-COLOR] Processing', swatchWrappers.length, 'color swatches');

        // Clear the grid
        colorGrid.innerHTML = '';

        // Process each swatch
        swatchWrappers.forEach((wrapper, index) => {
            const colorSwatch = wrapper.querySelector('.color-swatch');
            const colorNameEl = wrapper.querySelector('.color-name');
            
            if (!colorSwatch) return;

            // Extract color info from dp5-helper's data attributes
            const colorName = colorSwatch.dataset.colorName || colorNameEl?.textContent || 'Color ' + (index + 1);
            const catalogColor = colorSwatch.dataset.catalogColor || colorName;
            const colorSquareImage = colorSwatch.dataset.colorSquareImage;
            const colorSwatchImage = colorSwatch.dataset.colorSwatchImageUrl;
            const hexCode = colorSwatch.dataset.hexCode;
            
            // Get the image URL from the background image style if it exists
            let imgSrc = null;
            let useBackgroundColor = false;
            
            // Check if there's a background image set by dp5-helper
            const bgImage = colorSwatch.style.backgroundImage;
            if (bgImage && bgImage !== 'none' && bgImage !== '') {
                // Extract URL from background-image: url('...')
                const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (match) {
                    imgSrc = match[1];
                }
            }
            
            // Fall back to data attributes if no background image
            if (!imgSrc) {
                imgSrc = colorSquareImage || colorSwatchImage;
            }
            
            // Check for background color
            const bgColor = colorSwatch.style.backgroundColor;
            if (!imgSrc && (bgColor || hexCode)) {
                useBackgroundColor = true;
            }

            // Get the wrapper's click handler
            const originalClickHandler = wrapper.onclick;

            // Create clean swatch structure
            const swatchItem = document.createElement('div');
            swatchItem.className = 'clean-swatch-item';
            swatchItem.setAttribute('data-color-name', colorName);
            swatchItem.setAttribute('data-catalog-color', catalogColor);

            const swatchBox = document.createElement('div');
            swatchBox.className = 'clean-swatch-box';

            if (imgSrc) {
                const swatchImg = document.createElement('img');
                swatchImg.src = imgSrc;
                swatchImg.alt = colorName;
                swatchBox.appendChild(swatchImg);
            } else if (useBackgroundColor) {
                // Use the actual background color from the element or the hex code
                swatchBox.style.backgroundColor = bgColor || hexCode;
            }

            const swatchName = document.createElement('div');
            swatchName.className = 'clean-swatch-name';
            swatchName.textContent = colorName;

            // Assemble
            swatchItem.appendChild(swatchBox);
            swatchItem.appendChild(swatchName);

            // Add click handler
            swatchItem.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Update selected state
                document.querySelectorAll('.clean-swatch-item').forEach(item => {
                    item.classList.remove('selected');
                });
                swatchItem.classList.add('selected');

                // Update selected display
                updateSelectedDisplay(colorName, imgSrc || null, bgColor || hexCode);
                
                // Call the pricing page color handler directly instead of triggering dp5's click
                if (window.PricingPageUI && typeof window.PricingPageUI.handleColorSwatchClick === 'function') {
                    const colorData = {
                        COLOR_NAME: colorName,
                        CATALOG_COLOR: catalogColor,
                        MAIN_IMAGE_URL: colorSwatch.dataset.mainImageUrl,
                        FRONT_MODEL: colorSwatch.dataset.frontModelUrl,
                        COLOR_SQUARE_IMAGE: colorSquareImage,
                        COLOR_SWATCH_IMAGE_URL: colorSwatchImage,
                        HEX_CODE: hexCode
                    };
                    window.PricingPageUI.handleColorSwatchClick(colorData);
                }
            });

            // Check if this was the active swatch
            if (colorSwatch.classList.contains('active')) {
                swatchItem.classList.add('selected');
                updateSelectedDisplay(colorName, imgSrc || null, bgColor || hexCode);
            }

            // Add to grid
            colorGrid.appendChild(swatchItem);
        });

        // Select the current color if set
        selectCurrentColor();

        console.log('[CLEAN-COLOR] Transformation complete');
    }

    function updateSelectedDisplay(colorName, imgSrc, hexCode) {
        const selectedSwatch = document.getElementById('pricing-color-swatch');
        const selectedName = document.getElementById('pricing-color-name');

        if (selectedSwatch) {
            selectedSwatch.innerHTML = '';
            if (imgSrc) {
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = colorName;
                selectedSwatch.appendChild(img);
            } else if (hexCode) {
                selectedSwatch.style.backgroundColor = hexCode;
            }
        }

        if (selectedName) {
            selectedName.textContent = colorName;
        }
    }

    function selectCurrentColor() {
        // Check if there's a selected color from URL or global variable
        const urlParams = new URLSearchParams(window.location.search);
        const colorFromUrl = urlParams.get('COLOR') || urlParams.get('color');
        const selectedColorName = window.selectedColorName || colorFromUrl;

        if (selectedColorName) {
            // Find and click the matching swatch
            const swatches = document.querySelectorAll('.clean-swatch-item');
            swatches.forEach(swatch => {
                const swatchColorName = swatch.getAttribute('data-color-name');
                if (swatchColorName && swatchColorName.toLowerCase().includes(selectedColorName.toLowerCase())) {
                    swatch.click();
                }
            });
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForColors);
    } else {
        setTimeout(waitForColors, 500);
    }

})();