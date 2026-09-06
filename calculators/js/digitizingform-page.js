/* digitizingform-page.js — the page script for /calculators/digitizingform.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var DIGI_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var digiLog = DIGI_LOG_ON ? console.log.bind(console) : function () {};

// Hide loading overlay when iframe loads
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// The embedded form used to carry onload="hideLoading()" — a listener does the same job
var digiFrame = document.getElementById('JotFormIFrame-241687786443168');
if (digiFrame) digiFrame.addEventListener('load', hideLoading);

// Handle iframe loading timeout
setTimeout(() => {
    hideLoading();
}, 10000); // Hide loading after 10 seconds regardless

// Add smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Log page load for analytics
digiLog('Digitizing Order Form loaded successfully');
