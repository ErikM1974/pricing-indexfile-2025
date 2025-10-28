/**
 * Generate New Products Update File
 * Creates a CSV file for manual import into Caspio to set isNew flags
 *
 * Usage:
 *   node scripts/generate-new-products-update.js
 *
 * Output:
 *   new-products-manual-update.csv - Import this into Caspio
 */

const fs = require('fs');

// 15 Active products that need isNew flag set
const PRODUCTS_TO_UPDATE = [
    // Outerwear/Jackets (5)
    { style: 'EB120', category: 'Outerwear/Jackets', title: 'Eddie Bauer Adventurer 1/4-Zip' },
    { style: 'EB121', category: 'Outerwear/Jackets', title: 'Eddie Bauer Women\'s Adventurer Full-Zip' },
    { style: 'CT100617', category: 'Outerwear/Jackets', title: 'Carhartt Rain Defender Paxton Sweatshirt' },
    { style: 'CT103828', category: 'Outerwear/Jackets', title: 'Carhartt Duck Detroit Jacket' },
    { style: 'CT104670', category: 'Outerwear/Jackets', title: 'Carhartt Storm Defender Jacket' },

    // Headwear (4)
    { style: 'CT104597', category: 'Headwear', title: 'Carhartt Watch Cap 2.0' },
    { style: 'DT620', category: 'Headwear', title: 'District Spaced-Dyed Beanie' },
    { style: 'DT624', category: 'Headwear', title: 'District Flat Bill Snapback Trucker Cap' },
    { style: 'NE410', category: 'Headwear', title: 'New Era Foam Rope Trucker Cap' },

    // Fleece/Sweatshirts (2)
    { style: 'ST850', category: 'Fleece/Sweatshirts', title: 'Sport-Tek Sport-Wick Stretch 1/4-Zip' },
    { style: 'ST851', category: 'Fleece/Sweatshirts', title: 'Sport-Tek Sport-Wick Stretch 1/2-Zip' },

    // Apparel (3)
    { style: 'BB18200', category: 'Apparel', title: 'Brooks Brothers Pima Cotton Pique Polo' },
    { style: 'CS410', category: 'Apparel', title: 'CornerStone Select Snag-Proof Tactical Polo' },
    { style: 'CS415', category: 'Apparel', title: 'CornerStone Select Snag-Proof Tipped Pocket Polo' },

    // Bags (1)
    { style: 'EB201', category: 'Bags', title: 'Eddie Bauer Women\'s Full-Zip Fleece Jacket' }
];

/**
 * Generate CSV for Caspio import
 */
function generateCSV() {
    console.log('='.repeat(70));
    console.log('GENERATE NEW PRODUCTS UPDATE CSV');
    console.log('='.repeat(70));
    console.log(`Total products: ${PRODUCTS_TO_UPDATE.length}`);
    console.log('='.repeat(70));

    // CSV Header
    const lines = ['StyleNumber,isNew,Category,ExpectedTitle'];

    // Add each product
    PRODUCTS_TO_UPDATE.forEach(product => {
        // Escape any quotes in title
        const safeTitle = product.title.replace(/"/g, '""');
        lines.push(`${product.style},true,${product.category},"${safeTitle}"`);
    });

    // Write to file
    const filename = 'new-products-manual-update.csv';
    fs.writeFileSync(filename, lines.join('\n'), 'utf8');

    console.log(`\n✓ Created: ${filename}`);
    console.log(`\nNext steps:`);
    console.log(`1. Open this file in Excel or text editor`);
    console.log(`2. Log into Caspio DataPages`);
    console.log(`3. Find the Products table`);
    console.log(`4. Use "Import" feature to update records`);
    console.log(`5. Match columns: StyleNumber -> STYLE, isNew -> isNew`);
    console.log(`6. Select "Update existing records" (match on StyleNumber/STYLE)`);
    console.log(`7. Import the file`);
    console.log(`\nAlternatively, you can manually update each product:`);
    console.log('='.repeat(70));

    // Generate manual update instructions
    const instructions = [];
    instructions.push('\n## Manual Update Instructions\n');
    instructions.push('If CSV import doesn\'t work, update each product manually:\n');
    instructions.push('| Style | Category | Set isNew to true |\n');
    instructions.push('|-------|----------|-------------------|\n');

    PRODUCTS_TO_UPDATE.forEach(product => {
        instructions.push(`| ${product.style} | ${product.category} | ☐ |\n`);
    });

    const instructionsFile = 'new-products-manual-instructions.md';
    fs.writeFileSync(instructionsFile, instructions.join(''), 'utf8');
    console.log(`\n✓ Created: ${instructionsFile}`);
    console.log('='.repeat(70));
}

// Run
generateCSV();
