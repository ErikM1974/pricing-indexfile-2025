/**
 * Universal Image Gallery Component
 * Brings DTG's advanced image gallery features to all pricing pages
 * Features: thumbnail navigation, zoom modal, loading states, responsive design
 */

(function() {
    'use strict';

    console.log('[UNIVERSAL-GALLERY] Loading universal image gallery component...');

    // Gallery configuration
    const GALLERY_CONFIG = {
        animationDuration: 300,
        loadingDelay: 100,
        thumbnailSize: 80,
        zoomModalZIndex: 1000
    };

    // Universal Image Gallery Class
    class UniversalImageGallery {
        constructor(containerId, options = {}) {
            this.containerId = containerId;
            this.container = document.getElementById(containerId);
            this.options = {
                enableZoom: true,
                enableThumbnails: true,
                enableLoading: true,
                ...options
            };
            
            this.currentImageIndex = 0;
            this.images = [];
            this.initialized = false;

            if (this.container) {
                this.init();
            } else {
                console.warn(`[UNIVERSAL-GALLERY] Container '${containerId}' not found`);
            }
        }

        init() {
            console.log('[UNIVERSAL-GALLERY] Initializing gallery for:', this.containerId);
            this.setupGalleryStructure();
            this.bindEvents();
            this.initialized = true;
        }

        // Create the gallery HTML structure if it doesn't exist
        setupGalleryStructure() {
            if (!this.container.querySelector('.main-image-container')) {
                this.container.innerHTML = `
                    <div class="main-image-container" id="main-image-container">
                        <img id="product-image-main" src="" alt="Product Image" class="product-image">
                        <div class="image-loading-spinner"></div>
                        ${this.options.enableZoom ? `
                        <div class="image-zoom-overlay">
                            <span class="zoom-icon">🔍</span>
                        </div>` : ''}
                    </div>
                    ${this.options.enableThumbnails ? `
                    <div class="image-thumbnails" id="image-thumbnails">
                        <!-- Thumbnails will be dynamically added here -->
                    </div>` : ''}
                `;
            }

            this.mainImageContainer = this.container.querySelector('.main-image-container');
            this.mainImage = this.container.querySelector('#product-image-main');
            this.loadingSpinner = this.container.querySelector('.image-loading-spinner');
            this.thumbnailsContainer = this.container.querySelector('#image-thumbnails');
            this.zoomOverlay = this.container.querySelector('.image-zoom-overlay');

            // Create zoom modal if it doesn't exist
            if (this.options.enableZoom && !document.getElementById('image-modal')) {
                this.createZoomModal();
            }
        }

        // Create zoom modal for full-screen image viewing
        createZoomModal() {
            const modal = document.createElement('div');
            modal.id = 'image-modal';
            modal.className = 'universal-image-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <img id="modal-image" alt="Product Image">
                    <div id="modal-caption"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // Bind modal events
            const closeBtn = modal.querySelector('.close-modal');
            closeBtn.addEventListener('click', () => this.closeModal());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        // Bind all event listeners
        bindEvents() {
            // Main image click for zoom
            if (this.mainImage && this.options.enableZoom) {
                this.mainImage.addEventListener('click', () => this.openModal());
            }

            // Zoom overlay click
            if (this.zoomOverlay) {
                this.zoomOverlay.addEventListener('click', () => this.openModal());
            }

            // Image load events
            if (this.mainImage) {
                this.mainImage.addEventListener('load', () => this.onImageLoad());
                this.mainImage.addEventListener('error', () => this.onImageError());
            }
        }

        // Load images into the gallery
        loadImages(imageArray) {
            console.log('[UNIVERSAL-GALLERY] Loading images:', imageArray.length);
            this.images = imageArray || [];
            
            if (this.images.length > 0) {
                this.currentImageIndex = 0;
                this.displayImage(0);
                if (this.options.enableThumbnails) {
                    this.generateThumbnails();
                }
            } else {
                this.showNoImagesMessage();
            }
        }

        // Display image at specific index
        displayImage(index) {
            if (!this.images[index]) return;

            const image = this.images[index];
            this.currentImageIndex = index;

            // Show loading state
            if (this.options.enableLoading) {
                this.showLoading();
            }

            // Update main image
            this.mainImage.src = image.url || image.src || image;
            this.mainImage.alt = image.alt || image.name || `Product Image ${index + 1}`;

            // Update active thumbnail
            this.updateActiveThumbnail(index);
        }

        // Generate thumbnail navigation
        generateThumbnails() {
            if (!this.thumbnailsContainer || !this.images.length) return;

            this.thumbnailsContainer.innerHTML = '';

            this.images.forEach((image, index) => {
                const thumbnailItem = document.createElement('div');
                thumbnailItem.className = 'thumbnail-item';
                thumbnailItem.dataset.index = index;
                
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = image.thumbnailUrl || image.url || image.src || image;
                thumbnailImg.alt = image.alt || image.name || `Thumbnail ${index + 1}`;
                
                const thumbnailLabel = document.createElement('div');
                thumbnailLabel.className = 'thumbnail-label';
                thumbnailLabel.textContent = image.label || image.name || `View ${index + 1}`;

                thumbnailItem.appendChild(thumbnailImg);
                thumbnailItem.appendChild(thumbnailLabel);

                // Click event for thumbnail
                thumbnailItem.addEventListener('click', () => {
                    this.displayImage(index);
                });

                this.thumbnailsContainer.appendChild(thumbnailItem);
            });

            // Set first thumbnail as active
            this.updateActiveThumbnail(0);
        }

        // Update active thumbnail styling
        updateActiveThumbnail(activeIndex) {
            if (!this.thumbnailsContainer) return;

            const thumbnails = this.thumbnailsContainer.querySelectorAll('.thumbnail-item');
            thumbnails.forEach((thumb, index) => {
                thumb.classList.toggle('active', index === activeIndex);
            });
        }

        // Show loading state
        showLoading() {
            if (this.mainImageContainer && this.options.enableLoading) {
                this.mainImageContainer.classList.add('loading');
            }
        }

        // Hide loading state
        hideLoading() {
            if (this.mainImageContainer) {
                this.mainImageContainer.classList.remove('loading');
            }
        }

        // Handle successful image load
        onImageLoad() {
            console.log('[UNIVERSAL-GALLERY] Image loaded successfully');
            this.hideLoading();
        }

        // Handle image load error
        onImageError() {
            console.warn('[UNIVERSAL-GALLERY] Failed to load image');
            this.hideLoading();
            this.mainImage.src = '/shared_components/images/placeholder-product.png'; // Fallback image
        }

        // Open zoom modal
        openModal() {
            const modal = document.getElementById('image-modal');
            const modalImage = document.getElementById('modal-image');
            const modalCaption = document.getElementById('modal-caption');

            if (modal && modalImage) {
                modalImage.src = this.mainImage.src;
                modalImage.alt = this.mainImage.alt;
                if (modalCaption) {
                    modalCaption.textContent = this.images[this.currentImageIndex]?.name || this.mainImage.alt;
                }
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            }
        }

        // Close zoom modal
        closeModal() {
            const modal = document.getElementById('image-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = ''; // Restore scrolling
            }
        }

        // Show message when no images are available
        showNoImagesMessage() {
            if (this.mainImage) {
                this.mainImage.style.display = 'none';
            }
            
            if (!this.container.querySelector('.no-images-message')) {
                const message = document.createElement('div');
                message.className = 'no-images-message';
                message.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                        <div style="font-size: 3em; margin-bottom: 20px;">📷</div>
                        <h3>No Images Available</h3>
                        <p>Product images will appear here when available.</p>
                    </div>
                `;
                this.container.appendChild(message);
            }
        }

        // Public API methods
        nextImage() {
            const nextIndex = (this.currentImageIndex + 1) % this.images.length;
            this.displayImage(nextIndex);
        }

        previousImage() {
            const prevIndex = (this.currentImageIndex - 1 + this.images.length) % this.images.length;
            this.displayImage(prevIndex);
        }

        getCurrentImage() {
            return this.images[this.currentImageIndex];
        }

        addImage(imageData) {
            this.images.push(imageData);
            if (this.options.enableThumbnails) {
                this.generateThumbnails();
            }
        }

        removeImage(index) {
            if (this.images[index]) {
                this.images.splice(index, 1);
                if (this.currentImageIndex >= this.images.length) {
                    this.currentImageIndex = Math.max(0, this.images.length - 1);
                }
                if (this.options.enableThumbnails) {
                    this.generateThumbnails();
                }
                if (this.images.length > 0) {
                    this.displayImage(this.currentImageIndex);
                } else {
                    this.showNoImagesMessage();
                }
            }
        }

        // Destroy the gallery
        destroy() {
            if (this.container) {
                this.container.innerHTML = '';
            }
            const modal = document.getElementById('image-modal');
            if (modal) {
                modal.remove();
            }
            this.initialized = false;
        }
    }

    // Static helper methods
    UniversalImageGallery.createFromProductData = function(containerId, productData, options = {}) {
        const gallery = new UniversalImageGallery(containerId, options);
        
        if (productData) {
            const images = [];
            
            // Handle different product data formats
            if (productData.images && Array.isArray(productData.images)) {
                images.push(...productData.images);
            } else if (productData.image_url || productData.imageUrl) {
                images.push({
                    url: productData.image_url || productData.imageUrl,
                    name: productData.product_name || productData.name || 'Product Image'
                });
            } else if (productData.IMAGEURL) {
                images.push({
                    url: productData.IMAGEURL,
                    name: productData.PRODUCT_NAME || 'Product Image'
                });
            }

            if (images.length > 0) {
                gallery.loadImages(images);
            }
        }
        
        return gallery;
    };

    // Export to global scope
    window.UniversalImageGallery = UniversalImageGallery;

    // Auto-initialize galleries with data-gallery attribute
    document.addEventListener('DOMContentLoaded', function() {
        const galleryElements = document.querySelectorAll('[data-gallery="auto"]');
        galleryElements.forEach(element => {
            console.log('[UNIVERSAL-GALLERY] Auto-initializing gallery:', element.id);
            new UniversalImageGallery(element.id);
        });
    });

    console.log('[UNIVERSAL-GALLERY] Universal image gallery component loaded successfully');

})();