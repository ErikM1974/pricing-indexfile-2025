/* diagnose-search-issue-page.js — extracted 2026-09-06 from an inline <script> in tools/diagnose-search-issue.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
var DIAGNO_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var diagnoLog = DIAGNO_LOG_ON ? console.log.bind(console) : function () {};
const output = document.getElementById('consoleOutput');
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    output.innerHTML += '[LOG] ' + args.join(' ') + '\n';
};

console.error = function(...args) {
    originalError.apply(console, args);
    output.innerHTML += '[ERROR] ' + args.join(' ') + '\n';
};

function checkPageElements() {
    const pageCheck = document.getElementById('pageCheck');
    let html = '';

    // Check gallery container
    const galleryContainer = document.getElementById('gallery-container');
    if (galleryContainer) {
        html += '<div class="found">✓ Gallery container found</div>';
    } else {
        html += '<div class="not-found">✗ Gallery container NOT found</div>';
    }

    // Check for existing modern search
    const modernSearch = document.querySelector('.modern-search-container');
    if (modernSearch) {
        html += '<div class="warning">⚠ Modern search already exists</div>';
    } else {
        html += '<div class="found">✓ Modern search not present (ready to create)</div>';
    }

    pageCheck.innerHTML = html;
}

function checkCaspioElements() {
    const caspioCheck = document.getElementById('caspioCheck');
    let html = '';

    // Check form elements
    const elements = [
        { name: 'Style Input', selector: '[id^="Value1_1_"]' },
        { name: 'Category Dropdown', selector: '[id^="Value2_1_"]' },
        { name: 'Subcategory Dropdown', selector: '[id^="Value3_1_"]' },
        { name: 'Brand Dropdown', selector: '#Value4_1' },
        { name: 'Top Seller Radio', selector: '[name^="Value5_1"]' },
        { name: 'Search Button', selector: '[id^="searchID_"]' },
        { name: 'Caspio Form Table', selector: '[id^="cbTable_"]' }
    ];

    elements.forEach(el => {
        const found = document.querySelector(el.selector);
        if (found) {
            html += `<div class="found">✓ ${el.name}: ${found.id || found.name || 'found'}</div>`;
        } else {
            html += `<div class="not-found">✗ ${el.name}: NOT FOUND</div>`;
        }
    });

    // Check category dropdown options
    const categoryDropdown = document.querySelector('[id^="Value2_1_"]');
    if (categoryDropdown) {
        html += `<div class="found">✓ Category dropdown has ${categoryDropdown.options.length} options</div>`;
    }

    caspioCheck.innerHTML = html;
}

function testCreateUI() {
    const createTest = document.getElementById('createTest');

    try {
        // Create a simple test div
        const testHTML = `
            <div class="modern-search-container" style="background: #333; padding: 20px; margin: 20px 0;">
                <h2 style="color: white;">TEST: Modern Search Interface</h2>
                <p style="color: white;">If you see this, HTML insertion is working!</p>
            </div>
        `;

        // Try to insert it
        const body = document.body;
        const caspioScript = document.querySelector('script[src*="caspio.com"]');

        if (caspioScript) {
            caspioScript.insertAdjacentHTML('beforebegin', testHTML);
            createTest.innerHTML = '<div class="found">✓ Test UI created successfully!</div>';
        } else {
            body.insertAdjacentHTML('beforeend', testHTML);
            createTest.innerHTML = '<div class="warning">⚠ Test UI created at end of body (no Caspio script found)</div>';
        }
    } catch (error) {
        createTest.innerHTML = `<div class="not-found">✗ Error creating UI: ${error.message}</div>`;
    }
}

// Run checks after page loads
setTimeout(() => {
    diagnoLog('=== Starting diagnostics ===');
    checkPageElements();
    checkCaspioElements();
    diagnoLog('=== Diagnostics complete ===');
}, 2000);
