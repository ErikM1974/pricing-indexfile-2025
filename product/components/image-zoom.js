/**
 * Simple Modal Image Zoom Component
 * Clean, professional zoom like SanMar
 */

window.NWCA = window.NWCA || {};
window.NWCA.ImageZoom = (function() {
    'use strict';

    let isInitialized = false;
    let modal = null;
    let modalImage = null;
    let closeBtn = null;
    let currentImageSrc = null;

    /**
     * Initialize the zoom functionality
     */
    function init() {
        if (isInitialized) {
            console.log('[ImageZoom] Already initialized');
            return;
        }

        console.log('[ImageZoom] Initializing simple modal zoom...');
        
        // Wait for gallery to be ready
        const checkGallery = setInterval(() => {
            const galleryMain = document.querySelector('.gallery-main');
            const mainImage = document.querySelector('.main-image');
            
            if (galleryMain && mainImage && mainImage.src && !mainImage.src.includes('data:image')) {
                clearInterval(checkGallery);
                createModal();
                attachEventListeners();
                isInitialized = true;
                console.log('[ImageZoom] Initialization complete');
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkGallery), 10000);
    }

    /**
     * Create the modal structure
     */
    function createModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="image-zoom-modal" id="imageZoomModal">
                <button class="zoom-close" aria-label="Close zoom">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="zoom-content">
                    <div class="zoom-loader">
                        <div class="spinner"></div>
                    </div>
                    <img class="zoom-image" alt="Zoomed product image">
                </div>
            </div>
        `;
        
        // Add to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Get references
        modal = document.getElementById('imageZoomModal');
        modalImage = modal.querySelector('.zoom-image');
        closeBtn = modal.querySelector('.zoom-close');
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        // Click on gallery images
        document.addEventListener('click', function(e) {
            const mainImage = e.target.closest('.main-image');
            if (mainImage) {
                e.preventDefault();
                openModal(mainImage.src);
            }
        });

        // Close button
        closeBtn.addEventListener('click', closeModal);
        
        // Click outside image to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal || e.target.classList.contains('zoom-content')) {
                closeModal();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });

        // Listen for image updates
        document.addEventListener('imageUpdated', function(e) {
            console.log('[ImageZoom] Image updated event received');
        });
    }

    /**
     * Open the modal with an image
     */
    function openModal(imageSrc) {
        if (!imageSrc || !modal) return;
        
        currentImageSrc = imageSrc;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show loader
        modal.classList.add('loading');
        
        // Load high-res version
        const highResImage = new Image();
        highResImage.onload = function() {
            modalImage.src = this.src;
            modal.classList.remove('loading');
            
            // Smooth fade in
            modalImage.style.opacity = '0';
            setTimeout(() => {
                modalImage.style.opacity = '1';
            }, 50);
        };
        
        highResImage.onerror = function() {
            // Fallback to original image
            modalImage.src = imageSrc;
            modal.classList.remove('loading');
        };
        
        // Try to load higher resolution version
        // Replace common size markers with larger ones
        let highResSrc = imageSrc;
        if (imageSrc.includes('200x200')) {
            highResSrc = imageSrc.replace('200x200', '1200x1200');
        } else if (imageSrc.includes('400x400')) {
            highResSrc = imageSrc.replace('400x400', '1200x1200');
        } else if (imageSrc.includes('_thumb')) {
            highResSrc = imageSrc.replace('_thumb', '');
        }
        
        highResImage.src = highResSrc;
    }

    /**
     * Close the modal
     */
    function closeModal() {
        if (!modal) return;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Clean up
        setTimeout(() => {
            modalImage.src = '';
            currentImageSrc = null;
        }, 300);
    }

    /**
     * Destroy the component
     */
    function destroy() {
        if (modal) {
            modal.remove();
            modal = null;
        }
        
        isInitialized = false;
        console.log('[ImageZoom] Component destroyed');
    }

    // Public API
    return {
        init: init,
        destroy: destroy,
        open: openModal,
        close: closeModal
    };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[ImageZoom] DOM loaded, initializing...');
    window.NWCA.ImageZoom.init();
});