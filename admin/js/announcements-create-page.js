/* announcements-create-page.js — extracted 2026-09-06 from an inline <script> in admin/announcements-create.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
var ANNOUN_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var announLog = ANNOUN_LOG_ON ? console.log.bind(console) : function () {};
// Hide loading overlay when Caspio form loads
window.addEventListener('load', function() {
    // Wait for Caspio to load
    let checkInterval = setInterval(() => {
        const caspioForm = document.querySelector('[id^="cbform"]') || 
                          document.querySelector('iframe[name^="cbform"]') ||
                          document.querySelector('.cbFormTable');

        if (caspioForm) {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            clearInterval(checkInterval);
        }
    }, 500);

    // Fallback - hide after 3 seconds regardless
    setTimeout(() => {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }, 3000);
});

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        window.location.href = '/staff-dashboard.html';
    }
});

// Debug Caspio loading
announLog('Announcements Create page loaded');
window.addEventListener('message', function(event) {
    announLog('Received message from:', event.origin);
});
