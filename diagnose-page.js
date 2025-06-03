// Diagnostic script to run in browser console
// Copy and paste this into the browser console on the cap-embroidery page

console.log('=== PAGE DIAGNOSTICS ===');

// Check for white space at top
const body = document.body;
const header = document.querySelector('.universal-header, header');
const firstChild = body.firstElementChild;

console.log('\n--- White Space Check ---');
console.log('Body padding-top:', window.getComputedStyle(body).paddingTop);
console.log('Body margin-top:', window.getComputedStyle(body).marginTop);

if (header) {
    const headerRect = header.getBoundingClientRect();
    console.log('Header distance from top:', headerRect.top + 'px');
    
    // Check for elements before header
    let elementBeforeHeader = header.previousElementSibling;
    let count = 0;
    while (elementBeforeHeader) {
        const rect = elementBeforeHeader.getBoundingClientRect();
        if (rect.height > 0) {
            count++;
            console.log(`Element ${count} before header:`, {
                tag: elementBeforeHeader.tagName,
                id: elementBeforeHeader.id,
                class: elementBeforeHeader.className,
                height: rect.height + 'px',
                display: window.getComputedStyle(elementBeforeHeader).display
            });
        }
        elementBeforeHeader = elementBeforeHeader.previousElementSibling;
    }
    if (count === 0) {
        console.log('No visible elements found before header');
    }
} else {
    console.log('ERROR: Header not found!');
}

// Check for cart elements
console.log('\n--- Cart Elements Check ---');
const cartSelectors = [
    '#cart-navigation',
    '.cart-nav',
    '.view-cart-nav',
    '[id*="cart-nav"]',
    '.view-cart',
    '.view-cart-button',
    'button:contains("View Cart")',
    'a[href*="/cart"]'
];

let cartElements = [];
cartSelectors.forEach(selector => {
    try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none') {
                cartElements.push({
                    selector: selector,
                    element: el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className : ''),
                    visible: el.offsetHeight > 0,
                    display: window.getComputedStyle(el).display,
                    text: el.textContent.trim().substring(0, 50)
                });
            }
        });
    } catch (e) {}
});

if (cartElements.length > 0) {
    console.log('Found cart elements:', cartElements);
} else {
    console.log('No cart elements found');
}

// Check for console errors
console.log('\n--- JavaScript Errors ---');
console.log('Check the console above for any red error messages');

// Check loaded scripts
console.log('\n--- Loaded Scripts ---');
const scripts = Array.from(document.scripts);
const cartScripts = scripts.filter(s => s.src && (s.src.includes('cart.js') || s.src.includes('cart-integration.js')));
if (cartScripts.length > 0) {
    console.log('Cart scripts loaded:', cartScripts.map(s => s.src));
} else {
    console.log('No cart scripts loaded (good!)');
}

console.log('\n=== END DIAGNOSTICS ===');