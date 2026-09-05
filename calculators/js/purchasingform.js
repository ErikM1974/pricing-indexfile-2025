/* purchasingform.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in calculators/purchasingform.html (Rule 3, 2026.09.05.7) ──
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
        console.log('Purchasing Request Form loaded successfully');
