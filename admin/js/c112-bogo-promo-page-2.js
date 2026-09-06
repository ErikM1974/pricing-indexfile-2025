/* c112-bogo-promo-page-2.js — extracted 2026-09-06 from an inline <script> in admin/c112-bogo-promo.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
document.addEventListener('DOMContentLoaded', function() {
    const backToTopButton = document.getElementById('backToTop');

    // Show/hide button based on scroll position
    function toggleBackToTopButton() {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    }

    // Smooth scroll to top when button is clicked
    function scrollToTop(e) {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Add event listeners
    window.addEventListener('scroll', toggleBackToTopButton);
    backToTopButton.addEventListener('click', scrollToTop);

    // Initial check in case page is loaded scrolled down
    toggleBackToTopButton();
});
