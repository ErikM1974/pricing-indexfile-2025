/**
 * Design View — Public customer-facing page
 * Shows all available images for a design number in a clean gallery.
 * No internal data (stitch counts, pricing, order history, art notes).
 *
 * URL pattern: /design/:designNumber
 * API: GET /api/digitized-designs/lookup?designs=XXXXX (already public)
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        var designNumber = getDesignNumberFromUrl();
        if (!designNumber) {
            showError('Invalid URL', 'No design number found in the URL.');
            return;
        }
        fetchDesign(designNumber);

        // Escape key closes lightbox
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    function getDesignNumberFromUrl() {
        // Match /design/12345 from the URL path
        var match = window.location.pathname.match(/\/design\/(\d+)/);
        return match ? match[1] : null;
    }

    async function fetchDesign(designNumber) {
        try {
            var resp = await fetch(API_BASE + '/api/digitized-designs/lookup?designs=' + encodeURIComponent(designNumber));
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            if (!data.success || !data.designs || !data.designs[designNumber]) {
                showError('Design Not Found', 'Design #' + escapeHtml(designNumber) + ' was not found in our system.');
                return;
            }

            renderDesign(designNumber, data.designs[designNumber]);
        } catch (err) {
            showError('Loading Error', 'Unable to load design data. Please try again later.');
        }
    }

    function renderDesign(designNumber, design) {
        // Update page title
        document.title = 'Design #' + designNumber + ' - Northwest Custom Apparel';

        // Set header info
        document.getElementById('dv-design-number').textContent = 'Design #' + designNumber;

        var companyEl = document.getElementById('dv-company');
        if (design.company) {
            companyEl.textContent = design.company;
        } else {
            companyEl.style.display = 'none';
        }

        var nameEl = document.getElementById('dv-name');
        if (design.designName) {
            nameEl.textContent = design.designName;
        } else {
            nameEl.style.display = 'none';
        }

        // Collect ALL unique images from group + variants
        var images = collectAllImages(design);

        if (images.length === 0) {
            // Show no-images fallback
            document.getElementById('dv-no-images').style.display = 'block';
            document.getElementById('dv-hero').style.display = 'none';
            document.getElementById('dv-image-grid').style.display = 'none';
        } else {
            // Set hero to the first (best) image
            var heroImg = document.getElementById('dv-hero-img');
            heroImg.src = images[0].url;
            heroImg.alt = images[0].label + ' - Design #' + designNumber;

            // Build image grid (all images including the hero)
            if (images.length > 1) {
                renderImageGrid(images, designNumber);
            } else {
                document.getElementById('dv-image-grid').style.display = 'none';
            }
        }

        // Show content, hide loading
        document.getElementById('dv-loading').style.display = 'none';
        document.getElementById('dv-content').style.display = 'block';
    }

    function collectAllImages(design) {
        var seen = {};
        var images = [];

        function addImage(url, label) {
            if (!url || url.length < 10) return;
            var normalized = url.trim();
            if (seen[normalized]) return;
            seen[normalized] = true;
            images.push({ url: normalized, label: label });
        }

        // Group-level images (priority order)
        addImage(design.mockupUrl, 'Mockup');
        addImage(design.dstPreviewUrl, 'DST Preview');
        addImage(design.thumbnailUrl, 'Thumbnail');
        addImage(design.artworkUrl, 'Artwork');

        // Per-variant images (each variant may have different DST preview / thumbnail)
        var variants = design.variants || [];
        for (var i = 0; i < variants.length; i++) {
            var v = variants[i];
            var suffix = variants.length > 1 ? ' (' + (v.dstFilename || 'Variant ' + (i + 1)) + ')' : '';
            addImage(v.dstPreviewUrl, 'DST Preview' + suffix);
            addImage(v.thumbnailUrl, 'Thumbnail' + suffix);
        }

        return images;
    }

    function renderImageGrid(images, designNumber) {
        var grid = document.getElementById('dv-image-grid');
        var html = '';

        for (var i = 0; i < images.length; i++) {
            var img = images[i];
            html += '<div class="dv-grid-item" onclick="setHero(\'' + escapeHtml(img.url) + '\', this)">'
                + '<img src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.label) + ' - Design #' + escapeHtml(designNumber) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">'
                + '<div class="dv-grid-label">' + escapeHtml(img.label) + '</div>'
                + '</div>';
        }

        grid.innerHTML = html;

        // Mark first item as active
        var firstItem = grid.querySelector('.dv-grid-item');
        if (firstItem) firstItem.classList.add('active');
    }

    function showError(title, message) {
        document.getElementById('dv-loading').style.display = 'none';
        document.getElementById('dv-error-title').textContent = title;
        document.getElementById('dv-error-msg').textContent = message;
        document.getElementById('dv-error').style.display = 'block';
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    // --- Global functions (called from HTML onclick) ---

    window.setHero = function (url, thumbEl) {
        var heroImg = document.getElementById('dv-hero-img');
        if (heroImg) heroImg.src = url;

        // Update active state on grid items
        var grid = document.getElementById('dv-image-grid');
        if (grid) {
            grid.querySelectorAll('.dv-grid-item').forEach(function (item) {
                item.classList.remove('active');
            });
        }
        if (thumbEl) thumbEl.classList.add('active');
    };

    window.openLightbox = function (src) {
        if (!src) return;
        var overlay = document.getElementById('dv-lightbox');
        var img = document.getElementById('dv-lightbox-img');
        img.src = src;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeLightbox = function (e) {
        // Don't close if clicking the image itself
        if (e && e.target && e.target.id === 'dv-lightbox-img') return;
        var overlay = document.getElementById('dv-lightbox');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

})();
