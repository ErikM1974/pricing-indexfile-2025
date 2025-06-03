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

        // Check if DP5 has added colors
        const existingImages = colorGrid.querySelectorAll('img');
        if (existingImages.length > 0 && !transformComplete) {
            console.log('[CLEAN-COLOR] Found', existingImages.length, 'color images from DP5');
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
            // Check if images were added
            let hasImages = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (node.tagName === 'IMG' || node.querySelector?.('img'))) {
                        hasImages = true;
                    }
                });
            });

            if (hasImages && !transformComplete) {
                console.log('[CLEAN-COLOR] DP5 added color images, transforming...');
                setTimeout(transformColors, 100); // Small delay to ensure all images are added
            }
        });

        observer.observe(colorGrid, {
            childList: true,
            subtree: true
        });
    }

    function transformColors() {
        if (transformComplete) return;
        transformComplete = true;

        const colorGrid = document.getElementById('color-swatches');
        if (!colorGrid) return;

        // Add clean grid class
        colorGrid.classList.add('clean-color-grid');

        // Get all images
        const images = Array.from(colorGrid.querySelectorAll('img'));
        console.log('[CLEAN-COLOR] Processing', images.length, 'images');

        // Clear the grid
        colorGrid.innerHTML = '';

        // Process each image
        images.forEach((img, index) => {
            // Extract color info
            const colorName = img.alt || img.title || 'Color ' + (index + 1);
            const imgSrc = img.src;
            const originalOnclick = img.onclick;

            // Create clean swatch structure
            const swatchItem = document.createElement('div');
            swatchItem.className = 'clean-swatch-item';
            swatchItem.setAttribute('data-color-name', colorName);

            const swatchBox = document.createElement('div');
            swatchBox.className = 'clean-swatch-box';

            const swatchImg = document.createElement('img');
            swatchImg.src = imgSrc;
            swatchImg.alt = colorName;

            const swatchName = document.createElement('div');
            swatchName.className = 'clean-swatch-name';
            swatchName.textContent = colorName;

            // Assemble
            swatchBox.appendChild(swatchImg);
            swatchItem.appendChild(swatchBox);
            swatchItem.appendChild(swatchName);

            // Add click handler
            swatchItem.addEventListener('click', function() {
                // Call original onclick if exists
                if (originalOnclick) {
                    originalOnclick.call(img);
                } else if (window.selectColor) {
                    window.selectColor(colorName);
                }

                // Update selected state
                document.querySelectorAll('.clean-swatch-item').forEach(item => {
                    item.classList.remove('selected');
                });
                swatchItem.classList.add('selected');

                // Update selected display
                updateSelectedDisplay(colorName, imgSrc);
            });

            // Add to grid
            colorGrid.appendChild(swatchItem);
        });

        // Select the current color if set
        selectCurrentColor();

        console.log('[CLEAN-COLOR] Transformation complete');
    }

    function updateSelectedDisplay(colorName, imgSrc) {
        const selectedSwatch = document.getElementById('pricing-color-swatch');
        const selectedName = document.getElementById('pricing-color-name');

        if (selectedSwatch) {
            selectedSwatch.innerHTML = '';
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = colorName;
            selectedSwatch.appendChild(img);
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