// Quick fix for wrong pricing - run this in console

console.log('🔧 Fixing wrong pricing issue...');

// Force reload the Caspio iframe with correct product
const urlParams = new URLSearchParams(window.location.search);
const styleNumber = urlParams.get('StyleNumber') || '2007W';
const color = urlParams.get('COLOR') || urlParams.get('color') || 'Asphalt';

console.log('Product:', styleNumber, color);

// Remove old iframe if exists
const oldIframe = document.getElementById('screenprint-caspio-iframe');
if (oldIframe) {
    oldIframe.remove();
    console.log('Removed old iframe');
}

// Create new iframe with real Caspio URL
const container = document.getElementById('screenprint-caspio-container') || document.body;
const iframe = document.createElement('iframe');
iframe.id = 'screenprint-caspio-iframe';
iframe.src = `https://c3eku948.caspio.com/dp/a0e150002eb94f9e91e34e2c9990?StyleNumber=${styleNumber}&COLOR=${encodeURIComponent(color)}`;
iframe.width = '1';
iframe.height = '1';
iframe.style.display = 'none';
container.appendChild(iframe);

console.log('✅ Created new iframe with real Caspio data');
console.log('Iframe URL:', iframe.src);
console.log('\n⏳ Wait a few seconds for new pricing to load...');
console.log('The calculator should update with correct 2007W pricing.');

// Also try to clear any cached state
if (window.ScreenPrintAdapter) {
    setTimeout(() => {
        console.log('\n🔄 Triggering pricing refresh...');
        if (window.ScreenPrintAdapter.processPricingData) {
            window.ScreenPrintAdapter.processPricingData();
        }
    }, 3000);
}