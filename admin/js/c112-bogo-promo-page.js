/* c112-bogo-promo-page.js — extracted 2026-09-06 from an inline <script> in admin/c112-bogo-promo.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const mainProductImage = document.getElementById('product-image-context');
    const thumbnailGallery = document.getElementById('thumbnailGalleryContainer');

    let currentImageIndex = 0;
    let galleryImages = [];

    // Function to collect all available images
    function collectGalleryImages() {
        galleryImages = [];
        // Add main product image
        if (mainProductImage) {
            galleryImages.push({
                src: mainProductImage.src,
                alt: mainProductImage.alt || 'Product Image'
            });
        }

        // Add all thumbnails
        if (thumbnailGallery) {
            const thumbnails = thumbnailGallery.querySelectorAll('.gallery-thumbnail');
            thumbnails.forEach(thumb => {
                // Avoid duplicates
                if (!galleryImages.some(img => img.src === thumb.src)) {
                    galleryImages.push({
                        src: thumb.src,
                        alt: thumb.alt || 'Product Image'
                    });
                }
            });
        }

        return galleryImages;
    }

    // Function to open modal with specific image
    function openModal(imageSrc, imageAlt) {
        collectGalleryImages();

        // Find the index of the clicked image
        currentImageIndex = galleryImages.findIndex(img => img.src === imageSrc);
        if (currentImageIndex === -1) currentImageIndex = 0;

        modalImage.src = imageSrc;
        modalImage.alt = imageAlt || 'Product Image';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open

        // Show/hide navigation based on gallery size
        if (galleryImages.length <= 1) {
            modalPrev.style.display = 'none';
            modalNext.style.display = 'none';
        } else {
            modalPrev.style.display = 'flex';
            modalNext.style.display = 'flex';
        }
    }

    // Function to close modal
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Function to navigate to previous image
    function showPrevImage() {
        if (galleryImages.length <= 1) return;

        currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
        modalImage.src = galleryImages[currentImageIndex].src;
        modalImage.alt = galleryImages[currentImageIndex].alt;
    }

    // Function to navigate to next image
    function showNextImage() {
        if (galleryImages.length <= 1) return;

        currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
        modalImage.src = galleryImages[currentImageIndex].src;
        modalImage.alt = galleryImages[currentImageIndex].alt;
    }

    // Event listeners
    if (mainProductImage) {
        mainProductImage.addEventListener('click', function() {
            openModal(this.src, this.alt);
        });
    }

    if (thumbnailGallery) {
        thumbnailGallery.addEventListener('click', function(e) {
            if (e.target.classList.contains('gallery-thumbnail')) {
                openModal(e.target.src, e.target.alt);
            }
        });
    }

    modalClose.addEventListener('click', closeModal);

    modalPrev.addEventListener('click', showPrevImage);
    modalNext.addEventListener('click', showNextImage);

    // Close modal when clicking outside the image
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!modal.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'ArrowLeft') {
            showPrevImage();
        } else if (e.key === 'ArrowRight') {
            showNextImage();
        }
    });
});
