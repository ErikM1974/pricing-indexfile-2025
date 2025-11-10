const ourStyles = ['EB120','EB121','CT100617','CT103828','CT104670','CT104597','DT620','DT624','NE410','ST850','ST851','BB18200','CS410','CS415','EB201'];

fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/new?limit=2000')
    .then(r => r.json())
    .then(data => {
        const allStyles = new Set(data.products.map(p => p.STYLE));
        const found = ourStyles.filter(s => allStyles.has(s));
        const missing = ourStyles.filter(s => !allStyles.has(s));

        console.log('Total products returned:', data.products.length);
        console.log(`\nFound ${found.length} of 15 products marked as new:`);
        found.forEach(s => console.log(`  ✓ ${s}`));

        if (missing.length > 0) {
            console.log(`\nMissing ${missing.length} products:`);
            missing.forEach(s => console.log(`  ✗ ${s}`));
        } else {
            console.log('\n✓✓✓ ALL 15 PRODUCTS ARE MARKED AS NEW!');
        }

        console.log(`\nCached: ${data.cached}\n`);
    })
    .catch(err => console.error('Error:', err.message));
