/* monogramform-page.js — the page script for /calculators/monogramform.html, extracted 2026-09-06 from its inline <script>
 * (Rule 3). Kept at global scope on purpose: it was global before, and the shared calculator scripts call some
 * of these functions by name. Logging is gated (localhost or ?debug=1); console.error/warn stay live. */
var MONO_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var monoLog = MONO_LOG_ON ? console.log.bind(console) : function () {};

// Wait for JotForm to fully load and apply styling
document.addEventListener('DOMContentLoaded', function() {
    // Monitor for JotForm iframe to ensure proper styling
    const checkAndStyleForm = () => {
        const jotformIframe = document.querySelector('#jotformContainer iframe');
        if (jotformIframe) {
            // Ensure iframe has proper responsive styling
            jotformIframe.style.width = '100%';
            jotformIframe.style.minHeight = '800px';
            jotformIframe.style.border = 'none';
            jotformIframe.style.borderRadius = '0.5rem';
            return true;
        }
        return false;
    };

    // Try to style immediately
    if (!checkAndStyleForm()) {
        // If not loaded yet, check periodically
        const styleInterval = setInterval(() => {
            if (checkAndStyleForm()) {
                clearInterval(styleInterval);
            }
        }, 500);

        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(styleInterval), 10000);
    }
});

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
monoLog('Monogram Embroidery Form loaded successfully');
