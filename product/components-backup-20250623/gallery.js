/**
 * Product Gallery Component
 * Handles image display with lazy loading and smooth transitions
 */

export class ProductGallery {
    constructor(container) {
        this.container = container;
        this.currentIndex = 0;
        this.images = [];
        this.imageCache = new Map();
        
        // Create gallery structure
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="gallery-main">
                <img id="main-image" class="main-image" alt="Product image">
                <div class="image-loading">
                    <div class="mini-spinner"></div>
                </div>
            </div>
            <div class="gallery-thumbnails" id="gallery-thumbnails">
                <!-- Thumbnails will be added here -->
            </div>
        `;
        
        // Get references
        this.mainImage = this.container.querySelector('#main-image');
        this.thumbnailsContainer = this.container.querySelector('#gallery-thumbnails');
        this.loadingIndicator = this.container.querySelector('.image-loading');
        
        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.images.length === 0) return;
            
            if (e.key === 'ArrowLeft') {
                this.navigateImage(-1);
            } else if (e.key === 'ArrowRight') {
                this.navigateImage(1);
            }
        });
        
        // Touch support for mobile
        let touchStartX = 0;
        
        this.mainImage.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });
        
        this.mainImage.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.navigateImage(1); // Swipe left, next image
                } else {
                    this.navigateImage(-1); // Swipe right, previous image
                }
            }
        });
    }

    update(colorData) {
        if (!colorData) return;
        
        // Extract images
        this.images = this.extractImages(colorData);
        this.currentIndex = 0;
        
        // Update display
        this.updateGallery();
    }

    extractImages(colorData) {
        const images = [];
        const colorName = colorData.COLOR_NAME || colorData.colorName || colorData.color_name || 'Product';
        
        // Primary product image
        const mainImage = colorData.MAIN_IMAGE_URL || colorData.mainImageUrl || colorData.main_image_url;
        if (mainImage && mainImage.trim()) {
            images.push({
                url: mainImage,
                alt: `${colorName} - Main View`,
                type: 'main'
            });
        }
        
        // Model images
        const modelImages = [
            { url: colorData.FRONT_MODEL || colorData.frontModel, alt: 'Front Model' },
            { url: colorData.BACK_MODEL || colorData.backModel, alt: 'Back Model' },
            { url: colorData.SIDE_MODEL || colorData.sideModel, alt: 'Side Model' }
        ];
        
        modelImages.forEach(img => {
            if (img.url && img.url.trim()) {
                images.push({
                    url: img.url,
                    alt: `${colorName} - ${img.alt}`,
                    type: 'model'
                });
            }
        });
        
        // Flat images
        const flatImages = [
            { url: colorData.FRONT_FLAT || colorData.frontFlat, alt: 'Front Flat' },
            { url: colorData.BACK_FLAT || colorData.backFlat, alt: 'Back Flat' }
        ];
        
        flatImages.forEach(img => {
            if (img.url && img.url.trim()) {
                images.push({
                    url: img.url,
                    alt: `${colorName} - ${img.alt}`,
                    type: 'flat'
                });
            }
        });
        
        // Additional product images (if any)
        for (let i = 1; i <= 6; i++) {
            const imageUrl = colorData[`COLOR_PRODUCT_IMAGE_${i}`] || 
                           colorData[`colorProductImage${i}`] || 
                           colorData[`color_product_image_${i}`];
            if (imageUrl && imageUrl.trim() && !images.find(img => img.url === imageUrl)) {
                images.push({
                    url: imageUrl,
                    alt: `${colorName} - View ${i}`,
                    type: 'product'
                });
            }
        }
        
        return images;
    }

    updateGallery() {
        if (this.images.length === 0) {
            this.showNoImage();
            return;
        }
        
        // Update main image
        this.loadMainImage(this.currentIndex);
        
        // Update thumbnails
        this.updateThumbnails();
    }

    async loadMainImage(index) {
        const image = this.images[index];
        if (!image) return;
        
        // Show loading
        this.showLoading(true);
        
        try {
            // Check cache first
            if (this.imageCache.has(image.url)) {
                this.displayMainImage(image.url, image.alt);
                return;
            }
            
            // Preload image
            await this.preloadImage(image.url);
            
            // Cache it
            this.imageCache.set(image.url, true);
            
            // Display it
            this.displayMainImage(image.url, image.alt);
            
            // Preload next image
            if (index < this.images.length - 1) {
                this.preloadImage(this.images[index + 1].url);
            }
            
        } catch (error) {
            console.error('Failed to load image:', error);
            this.showImageError();
        }
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });
    }

    displayMainImage(url, alt) {
        this.mainImage.src = url;
        this.mainImage.alt = alt;
        this.showLoading(false);
        
        // Smooth fade in
        this.mainImage.style.opacity = '0';
        setTimeout(() => {
            this.mainImage.style.opacity = '1';
        }, 50);
    }

    updateThumbnails() {
        this.thumbnailsContainer.innerHTML = '';
        
        this.images.forEach((image, index) => {
            const thumb = document.createElement('div');
            thumb.className = `thumbnail ${index === this.currentIndex ? 'active' : ''}`;
            thumb.innerHTML = `<img src="${image.url}" alt="${image.alt}">`;
            
            thumb.addEventListener('click', () => {
                this.selectImage(index);
            });
            
            this.thumbnailsContainer.appendChild(thumb);
        });
    }

    selectImage(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentIndex = index;
        this.updateGallery();
    }

    navigateImage(direction) {
        const newIndex = this.currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.images.length) {
            this.selectImage(newIndex);
        }
    }

    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'flex' : 'none';
        this.mainImage.style.opacity = show ? '0.5' : '1';
    }

    showNoImage() {
        this.mainImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
        this.mainImage.alt = 'No image available';
        this.thumbnailsContainer.innerHTML = '';
        this.showLoading(false);
    }

    showImageError() {
        this.mainImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2ZmZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNjMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBFcnJvcjwvdGV4dD48L3N2Zz4=';
        this.mainImage.alt = 'Error loading image';
        this.showLoading(false);
    }
}