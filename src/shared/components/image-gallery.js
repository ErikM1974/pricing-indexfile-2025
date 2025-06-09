// ImageGallery - Reusable image gallery component
// Handles product images with zoom, carousel, and color coordination

import { Logger } from '../utils/logger';
import { EventBus } from '../utils/event-bus';

export class ImageGallery {
  constructor(options = {}) {
    this.logger = new Logger('ImageGallery');
    this.eventBus = options.eventBus || new EventBus();
    
    // Configuration
    this.config = {
      container: options.container || '#image-gallery',
      thumbnailSize: options.thumbnailSize || 80,
      enableZoom: options.enableZoom !== false,
      enableFullscreen: options.enableFullscreen !== false,
      autoRotate: options.autoRotate || false,
      rotateInterval: options.rotateInterval || 5000,
      lazyLoad: options.lazyLoad !== false,
      ...options.config
    };
    
    // State
    this.images = [];
    this.currentIndex = 0;
    this.container = null;
    this.elements = {};
    this.rotateTimer = null;
    this.initialized = false;
  }
  
  // Initialize the gallery
  async initialize() {
    this.logger.debug('Initializing image gallery');
    
    // Find container
    this.container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container)
      : this.config.container;
      
    if (!this.container) {
      throw new Error('Image gallery container not found');
    }
    
    // Set up gallery structure
    this.setupGallery();
    
    // Load images if provided
    if (this.config.images) {
      this.setImages(this.config.images);
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.initialized = true;
    this.eventBus.emit('imageGallery:initialized');
  }
  
  // Set up gallery HTML structure
  setupGallery() {
    this.container.classList.add('image-gallery');
    
    // Create gallery HTML
    this.container.innerHTML = `
      <div class="gallery-main">
        <div class="gallery-viewport">
          <img class="gallery-main-image" alt="Product image">
          <div class="gallery-loading">
            <div class="spinner"></div>
          </div>
          <div class="gallery-controls">
            <button class="gallery-prev" aria-label="Previous image">‹</button>
            <button class="gallery-next" aria-label="Next image">›</button>
          </div>
          ${this.config.enableZoom ? '<div class="gallery-zoom-indicator">🔍</div>' : ''}
          ${this.config.enableFullscreen ? '<button class="gallery-fullscreen" aria-label="Fullscreen">⛶</button>' : ''}
        </div>
        <div class="gallery-info">
          <span class="gallery-counter"></span>
        </div>
      </div>
      <div class="gallery-thumbnails"></div>
    `;
    
    // Store element references
    this.elements = {
      viewport: this.container.querySelector('.gallery-viewport'),
      mainImage: this.container.querySelector('.gallery-main-image'),
      thumbnails: this.container.querySelector('.gallery-thumbnails'),
      loading: this.container.querySelector('.gallery-loading'),
      prevBtn: this.container.querySelector('.gallery-prev'),
      nextBtn: this.container.querySelector('.gallery-next'),
      counter: this.container.querySelector('.gallery-counter'),
      fullscreenBtn: this.container.querySelector('.gallery-fullscreen')
    };
    
    // Add styles
    this.addStyles();
  }
  
  // Add component styles
  addStyles() {
    const styles = `
      .image-gallery {
        position: relative;
        max-width: 100%;
      }
      
      .gallery-main {
        margin-bottom: 15px;
      }
      
      .gallery-viewport {
        position: relative;
        width: 100%;
        padding-bottom: 100%; /* 1:1 aspect ratio */
        overflow: hidden;
        background-color: #f8f9fa;
        border-radius: 8px;
      }
      
      .gallery-main-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        cursor: zoom-in;
        transition: opacity 0.3s ease;
      }
      
      .gallery-main-image.loading {
        opacity: 0;
      }
      
      .gallery-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: none;
      }
      
      .gallery-loading.active {
        display: block;
      }
      
      .gallery-loading .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e0e0e0;
        border-top-color: #2e5827;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      .gallery-controls {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        transform: translateY(-50%);
        display: flex;
        justify-content: space-between;
        padding: 0 10px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .gallery-viewport:hover .gallery-controls {
        opacity: 1;
      }
      
      .gallery-controls button {
        width: 40px;
        height: 40px;
        border: none;
        background-color: rgba(255, 255, 255, 0.9);
        color: #333;
        font-size: 24px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      
      .gallery-controls button:hover {
        background-color: #fff;
        transform: scale(1.1);
      }
      
      .gallery-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .gallery-zoom-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 14px;
        border-radius: 4px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .gallery-viewport:hover .gallery-zoom-indicator {
        opacity: 1;
      }
      
      .gallery-fullscreen {
        position: absolute;
        bottom: 10px;
        right: 10px;
        width: 36px;
        height: 36px;
        border: none;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 20px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .gallery-fullscreen:hover {
        background-color: rgba(0, 0, 0, 0.9);
      }
      
      .gallery-info {
        text-align: center;
        margin-top: 10px;
        font-size: 14px;
        color: #666;
      }
      
      .gallery-thumbnails {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 10px 0;
      }
      
      .gallery-thumbnail {
        flex-shrink: 0;
        width: ${this.config.thumbnailSize}px;
        height: ${this.config.thumbnailSize}px;
        border: 2px solid transparent;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .gallery-thumbnail:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }
      
      .gallery-thumbnail.active {
        border-color: #2e5827;
      }
      
      .gallery-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      /* Zoom overlay */
      .gallery-zoom-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .gallery-zoom-overlay.active {
        opacity: 1;
      }
      
      .gallery-zoom-image {
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Mobile responsive */
      @media (max-width: 768px) {
        .gallery-controls button {
          width: 35px;
          height: 35px;
          font-size: 20px;
        }
        
        .gallery-thumbnails {
          gap: 5px;
        }
      }
    `;
    
    // Add styles to page if not already present
    if (!document.getElementById('image-gallery-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'image-gallery-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }
  
  // Set gallery images
  setImages(images) {
    this.logger.debug('Setting images:', images.length);
    
    this.images = images.map((image, index) => ({
      id: image.id || `image-${index}`,
      src: image.src || image.url,
      thumb: image.thumb || image.thumbnail || image.src,
      alt: image.alt || `Image ${index + 1}`,
      title: image.title || '',
      colorId: image.colorId || null,
      metadata: image.metadata || {}
    }));
    
    this.currentIndex = 0;
    this.render();
    
    this.eventBus.emit('imageGallery:imagesSet', {
      images: this.images,
      count: this.images.length
    });
  }
  
  // Render gallery
  render() {
    if (this.images.length === 0) {
      this.showPlaceholder();
      return;
    }
    
    // Render thumbnails
    this.renderThumbnails();
    
    // Show first image
    this.showImage(0);
    
    // Update controls
    this.updateControls();
    
    // Start auto-rotate if enabled
    if (this.config.autoRotate && this.images.length > 1) {
      this.startAutoRotate();
    }
  }
  
  // Show placeholder when no images
  showPlaceholder() {
    this.elements.mainImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-family="Arial" font-size="20"%3ENo Image Available%3C/text%3E%3C/svg%3E';
    this.elements.mainImage.alt = 'No image available';
    this.elements.thumbnails.innerHTML = '';
    this.elements.counter.textContent = '';
  }
  
  // Render thumbnail strip
  renderThumbnails() {
    this.elements.thumbnails.innerHTML = '';
    
    this.images.forEach((image, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumbnail';
      thumb.dataset.index = index;
      
      if (index === this.currentIndex) {
        thumb.classList.add('active');
      }
      
      const img = document.createElement('img');
      
      if (this.config.lazyLoad && index > 3) {
        img.dataset.src = image.thumb;
        img.classList.add('lazy');
      } else {
        img.src = image.thumb;
      }
      
      img.alt = image.alt;
      
      thumb.appendChild(img);
      thumb.addEventListener('click', () => this.showImage(index));
      
      this.elements.thumbnails.appendChild(thumb);
    });
    
    // Set up lazy loading if enabled
    if (this.config.lazyLoad) {
      this.setupLazyLoading();
    }
  }
  
  // Show specific image
  showImage(index) {
    if (index < 0 || index >= this.images.length) return;
    
    const image = this.images[index];
    this.currentIndex = index;
    
    // Show loading state
    this.elements.mainImage.classList.add('loading');
    this.elements.loading.classList.add('active');
    
    // Load image
    const img = new Image();
    img.onload = () => {
      this.elements.mainImage.src = image.src;
      this.elements.mainImage.alt = image.alt;
      this.elements.mainImage.classList.remove('loading');
      this.elements.loading.classList.remove('active');
      
      // Emit event
      this.eventBus.emit('imageGallery:imageShown', {
        image,
        index
      });
    };
    
    img.onerror = () => {
      this.logger.error('Failed to load image:', image.src);
      this.elements.mainImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23fee"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23c00" font-family="Arial" font-size="20"%3EFailed to Load%3C/text%3E%3C/svg%3E';
      this.elements.loading.classList.remove('active');
    };
    
    img.src = image.src;
    
    // Update thumbnails
    this.updateThumbnails();
    
    // Update counter
    this.updateCounter();
    
    // Update controls
    this.updateControls();
  }
  
  // Update active thumbnail
  updateThumbnails() {
    this.elements.thumbnails.querySelectorAll('.gallery-thumbnail').forEach((thumb, index) => {
      if (index === this.currentIndex) {
        thumb.classList.add('active');
      } else {
        thumb.classList.remove('active');
      }
    });
  }
  
  // Update counter display
  updateCounter() {
    if (this.images.length > 1) {
      this.elements.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    } else {
      this.elements.counter.textContent = '';
    }
  }
  
  // Update navigation controls
  updateControls() {
    this.elements.prevBtn.disabled = this.currentIndex === 0;
    this.elements.nextBtn.disabled = this.currentIndex === this.images.length - 1;
    
    // Hide controls if only one image
    if (this.images.length <= 1) {
      this.elements.prevBtn.style.display = 'none';
      this.elements.nextBtn.style.display = 'none';
    } else {
      this.elements.prevBtn.style.display = '';
      this.elements.nextBtn.style.display = '';
    }
  }
  
  // Navigate to previous image
  previousImage() {
    if (this.currentIndex > 0) {
      this.showImage(this.currentIndex - 1);
    }
  }
  
  // Navigate to next image
  nextImage() {
    if (this.currentIndex < this.images.length - 1) {
      this.showImage(this.currentIndex + 1);
    }
  }
  
  // Show image by color ID
  showImageByColor(colorId) {
    const index = this.images.findIndex(img => img.colorId === colorId);
    if (index >= 0) {
      this.showImage(index);
    }
  }
  
  // Set up event listeners
  setupEventListeners() {
    // Navigation buttons
    this.elements.prevBtn.addEventListener('click', () => this.previousImage());
    this.elements.nextBtn.addEventListener('click', () => this.nextImage());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.initialized) return;
      
      if (e.key === 'ArrowLeft') {
        this.previousImage();
      } else if (e.key === 'ArrowRight') {
        this.nextImage();
      }
    });
    
    // Touch gestures
    let touchStartX = 0;
    let touchEndX = 0;
    
    this.elements.viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });
    
    this.elements.viewport.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.nextImage();
        } else {
          this.previousImage();
        }
      }
    });
    
    // Zoom functionality
    if (this.config.enableZoom) {
      this.elements.mainImage.addEventListener('click', () => this.showZoom());
    }
    
    // Fullscreen functionality
    if (this.config.enableFullscreen && this.elements.fullscreenBtn) {
      this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    
    // Listen for color selection events
    this.eventBus.on('colorSelector:selected', (data) => {
      if (data.color && data.color.id) {
        this.showImageByColor(data.color.id);
      }
    });
  }
  
  // Show zoom overlay
  showZoom() {
    const currentImage = this.images[this.currentIndex];
    if (!currentImage) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'gallery-zoom-overlay';
    
    const img = document.createElement('img');
    img.className = 'gallery-zoom-image';
    img.src = currentImage.src;
    img.alt = currentImage.alt;
    
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    
    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
    
    // Close on click
    overlay.addEventListener('click', () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    });
    
    // Close on escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  
  // Toggle fullscreen mode
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen().catch(err => {
        this.logger.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }
  
  // Set up lazy loading for thumbnails
  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });
      
      this.elements.thumbnails.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback: load all images
      this.elements.thumbnails.querySelectorAll('img.lazy').forEach(img => {
        img.src = img.dataset.src;
        img.classList.remove('lazy');
      });
    }
  }
  
  // Start auto-rotate
  startAutoRotate() {
    this.stopAutoRotate();
    
    this.rotateTimer = setInterval(() => {
      if (this.currentIndex < this.images.length - 1) {
        this.nextImage();
      } else {
        this.showImage(0);
      }
    }, this.config.rotateInterval);
  }
  
  // Stop auto-rotate
  stopAutoRotate() {
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  }
  
  // Destroy gallery
  destroy() {
    this.stopAutoRotate();
    
    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.remove('image-gallery');
    }
    
    this.images = [];
    this.currentIndex = 0;
    this.initialized = false;
    
    this.logger.debug('Image gallery destroyed');
  }
}