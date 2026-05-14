/**
 * Image lightbox for the Policies Hub.
 *
 * Click any image inside `.policy-body` → fullscreen overlay with the image
 * centered, plus prev/next navigation through every image in the same body.
 * Esc / overlay-click / × button closes. Arrow keys cycle.
 *
 * Stays out of edit mode — TipTap handles its own image selection/resize
 * affordances, and lightbox-ing during edits would be jarring.
 */
(function () {
    'use strict';

    let currentIndex = 0;
    let images = [];
    let overlay = null;

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function buildOverlay() {
        const el = document.createElement('div');
        el.className = 'pd-lightbox-overlay';
        el.innerHTML = `
            <button type="button" class="pd-lightbox-close" aria-label="Close (Esc)">
                <i class="fas fa-xmark"></i>
            </button>
            <button type="button" class="pd-lightbox-prev" aria-label="Previous image (←)">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button type="button" class="pd-lightbox-next" aria-label="Next image (→)">
                <i class="fas fa-chevron-right"></i>
            </button>
            <div class="pd-lightbox-stage">
                <img class="pd-lightbox-img" src="" alt="">
                <div class="pd-lightbox-caption"></div>
                <div class="pd-lightbox-counter"></div>
            </div>
        `;
        return el;
    }

    function show(index) {
        if (!overlay || images.length === 0) return;
        currentIndex = ((index % images.length) + images.length) % images.length;
        const img = images[currentIndex];
        const target = overlay.querySelector('.pd-lightbox-img');
        const caption = overlay.querySelector('.pd-lightbox-caption');
        const counter = overlay.querySelector('.pd-lightbox-counter');

        target.src = img.src;
        target.alt = img.alt || '';
        caption.textContent = img.alt || '';
        caption.style.display = img.alt ? '' : 'none';
        counter.textContent = images.length > 1 ? `${currentIndex + 1} / ${images.length}` : '';
        counter.style.display = images.length > 1 ? '' : 'none';

        overlay.querySelector('.pd-lightbox-prev').style.display = images.length > 1 ? '' : 'none';
        overlay.querySelector('.pd-lightbox-next').style.display = images.length > 1 ? '' : 'none';
    }

    function open(clickedImg) {
        // Collect every image inside the same policy body so prev/next cycles them
        const body = clickedImg.closest('.policy-body') || document.querySelector('.policy-body');
        if (!body) return;
        images = Array.from(body.querySelectorAll('img'));
        if (images.length === 0) return;
        const startIdx = images.indexOf(clickedImg);

        overlay = buildOverlay();
        document.body.appendChild(overlay);
        // Animate in
        requestAnimationFrame(() => overlay.classList.add('show'));

        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.pd-lightbox-close').addEventListener('click', close);
        overlay.querySelector('.pd-lightbox-prev').addEventListener('click', () => show(currentIndex - 1));
        overlay.querySelector('.pd-lightbox-next').addEventListener('click', () => show(currentIndex + 1));

        document.addEventListener('keydown', onKey);
        // Lock body scroll while open
        document.body.style.overflow = 'hidden';

        show(startIdx >= 0 ? startIdx : 0);
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        setTimeout(() => { if (overlay) { overlay.remove(); overlay = null; } }, 200);
    }

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); show(currentIndex - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); show(currentIndex + 1); }
    }

    // Delegate clicks so we don't have to re-bind every time the body re-renders.
    // Only intercept inside .policy-body when NOT in edit mode (TipTap renders
    // images inside .tt-content, not .policy-body, so the gate is automatic).
    function init() {
        document.addEventListener('click', e => {
            const img = e.target.closest('.policy-body img');
            if (!img) return;
            // Skip images inside links — let the link work
            if (img.closest('a')) return;
            e.preventDefault();
            open(img);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.PolicyLightbox = { open, close };
})();
