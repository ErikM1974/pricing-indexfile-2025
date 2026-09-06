/* css-diagnostic-page.js — extracted 2026-09-06 from an inline <script> in tools/css-diagnostic.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
var CSSDIA_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var cssdiaLog = CSSDIA_LOG_ON ? console.log.bind(console) : function () {};
// Show current location
document.getElementById('location').textContent = window.location.href;

// Calculate expected CSS path
const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
document.getElementById('css-path').textContent = baseUrl + '/shared_components/css/universal-pricing-header.css';

// Check if CSS loaded
window.onload = function() {
    const testDiv = document.createElement('div');
    testDiv.className = 'universal-pricing-header';
    document.body.appendChild(testDiv);
    const styles = window.getComputedStyle(testDiv);

    if (styles.background.includes('linear-gradient')) {
        cssdiaLog('SUCCESS: CSS is loaded!');
    } else {
        cssdiaLog('FAIL: CSS not loaded');
        cssdiaLog('Background value:', styles.background);
    }

    document.body.removeChild(testDiv);
};
