// Beta Feature Analytics Tracker
// Add this to your product page to track beta button usage

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        const betaButton = document.getElementById('cap-embroidery-beta');
        
        if (!betaButton) {
            console.warn('Beta button not found for analytics tracking');
            return;
        }
        
        // Track button visibility
        trackEvent('Beta Button', 'impression', 'Cap Embroidery Beta Shown');
        
        // Track button clicks
        betaButton.addEventListener('click', function(e) {
            const styleNumber = window.selectedStyleNumber || 'unknown';
            const color = window.selectedCatalogColor || 'unknown';
            
            // Google Analytics (GA4)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'beta_feature_click', {
                    'feature_name': 'cap_embroidery_new_system',
                    'product_style': styleNumber,
                    'product_color': color,
                    'timestamp': new Date().toISOString()
                });
            }
            
            // Google Analytics (Universal Analytics)
            if (typeof ga !== 'undefined') {
                ga('send', 'event', 'Beta Features', 'click', 'Cap Embroidery New System', {
                    'dimension1': styleNumber,
                    'dimension2': color
                });
            }
            
            // Custom analytics endpoint (if you have one)
            try {
                fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        event: 'beta_button_click',
                        feature: 'cap_embroidery',
                        style: styleNumber,
                        color: color,
                        timestamp: Date.now()
                    })
                }).catch(err => console.log('Analytics tracking failed:', err));
            } catch (err) {
                // Fail silently
            }
            
            // Console log for debugging
            console.log('Beta button clicked:', {
                style: styleNumber,
                color: color,
                href: betaButton.href
            });
        });
        
        // Track hover intent (optional)
        let hoverTimer;
        betaButton.addEventListener('mouseenter', function() {
            hoverTimer = setTimeout(function() {
                trackEvent('Beta Button', 'hover_intent', 'Cap Embroidery Beta Hover');
            }, 1000); // Track if hovered for 1 second
        });
        
        betaButton.addEventListener('mouseleave', function() {
            clearTimeout(hoverTimer);
        });
    });
    
    // Helper function to track events
    function trackEvent(category, action, label) {
        // GA4
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                'event_category': category,
                'event_label': label
            });
        }
        
        // Universal Analytics
        if (typeof ga !== 'undefined') {
            ga('send', 'event', category, action, label);
        }
        
        // Console log for debugging
        console.log('Analytics Event:', category, action, label);
    }
})();

// Performance tracking for the beta page
if (window.location.pathname.includes('cap-embroidery-pricing-integrated.html')) {
    // Track page load time
    window.addEventListener('load', function() {
        if (window.performance && window.performance.timing) {
            const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'timing_complete', {
                    'name': 'beta_page_load',
                    'value': loadTime,
                    'event_category': 'Beta Performance'
                });
            }
            
            console.log('Beta page load time:', loadTime + 'ms');
        }
    });
}