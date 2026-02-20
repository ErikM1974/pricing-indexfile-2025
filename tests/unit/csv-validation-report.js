/**
 * SanMar CSV Validation Report
 *
 * Parses the SanMar pricing CSV and validates all styles/sizes
 * against the embroidery quote builder's SIZE_TO_SUFFIX mapping.
 *
 * Usage: node tests/unit/csv-validation-report.js [path-to-csv]
 *
 * @author Claude Code
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Current SIZE_TO_SUFFIX mapping from sku-validation-service.js
// UPDATED 2026-01-04: Includes all 97+ size mappings
const SIZE_TO_SUFFIX = {
    // Standard sizes - no suffix (use base SKU)
    'S': '',
    'M': '',
    'L': '',
    'XL': '',

    // Extended sizes - ShopWorks full-form suffixes (updated Feb 2026)
    'XS': '_XS',
    '2XL': '_2XL',
    '3XL': '_3XL',
    '4XL': '_4XL',
    '5XL': '_5XL',
    '6XL': '_6XL',
    '7XL': '_7XL',
    '8XL': '_8XL',
    '9XL': '_9XL',
    '10XL': '_10XL',

    // Ladies/distinct sizes (NOT aliases)
    'XXL': '_XXL',
    'XXXL': '_XXXL',
    'XXS': '_XXS',
    '2XS': '_2XS',

    // Tall sizes
    'LT': '_LT',
    'XLT': '_XLT',
    '2XLT': '_2XLT',
    '3XLT': '_3XLT',
    '4XLT': '_4XLT',
    'ST': '_ST',
    'MT': '_MT',
    'XST': '_XST',

    // One-size / combination sizes
    'OSFA': '_OSFA',
    'S/M': '_S/M',
    'M/L': '_M/L',
    'L/XL': '_L/XL',
    'S/XL': '_S/XL',
    'XS/S': '_XS/S',
    'X/2X': '_X/2X',
    '2/3X': '_2/3X',
    '3/4X': '_3/4X',
    '4/5X': '_4/5X',
    '2-5X': '_2-5X',
    'T/C': '_T/C',
    'C/Y': '_C/Y',

    // Youth sizes
    'YXS': '_YXS',
    'YS': '_YS',
    'YM': '_YM',
    'YL': '_YL',
    'YXL': '_YXL',

    // Toddler sizes
    '2T': '_2T',
    '3T': '_3T',
    '4T': '_4T',
    '5T': '_5T',
    '6T': '_6T',
    '5/6': '_5/6',
    '5/6T': '_5/6T',

    // Infant sizes
    'NB': '_NB',
    '6M': '_6M',
    '06M': '_06M',
    '12M': '_12M',
    '18M': '_18M',
    '24M': '_24M',
    '306': '_306',
    '612': '_612',

    // Waist-only sizes (shorts)
    'W30': '_W30',
    'W31': '_W31',
    'W32': '_W32',
    'W33': '_W33',
    'W34': '_W34',
    'W35': '_W35',
    'W36': '_W36',
    'W38': '_W38',
    'W40': '_W40',
    'W42': '_W42',
    'W44': '_W44',
    'W46': '_W46',
    'W48': '_W48',
    'W50': '_W50',

    // Regular variants
    'SR': '_SR',
    'MR': '_MR',
    'LR': '_LR',
    'XLR': '_XLR',
    '2XLR': '_2XLR',
    '3XLR': '_3XLR',
    '4XLR': '_4XLR',
    '5XLR': '_5XLR',
    '6XLR': '_6XLR',

    // Long variants
    'ML': '_ML',
    'LL': '_LL',
    'XLL': '_XLL',
    '2XLL': '_2XLL',
    '3XLL': '_3XLL',

    // Short variants
    'MS': '_MS',
    'LS': '_LS',
    'XLS': '_XLS',
    '2XLS': '_2XLS',
    '3XLS': '_3XLS',
    'SS': '_SS',
    'XSS': '_XSS',
    '2XSS': '_2XSS',
    'ss': '_SS',

    // Petite variants
    'SP': '_SP',
    'MP': '_MP',
    'LP': '_LP',
    'XLP': '_XLP',
    'XSP': '_XSP',
    '2XLP': '_2XLP',
    '2XSP': '_2XSP',

    // Numeric sizes
    '0': '_0', '1': '_1', '2': '_2', '3': '_3', '4': '_4',
    '5': '_5', '6': '_6', '7': '_7', '8': '_8', '9': '_9',
    '10': '_10', '11': '_11', '12': '_12', '13': '_13', '14': '_14',
    '16': '_16', '18': '_18', '20': '_20',
    '30': '_30', '32': '_32', '33': '_33', '34': '_34', '35': '_35',
    '36': '_36', '38': '_38', '40': '_40', '42': '_42',

    // Special
    'SM': '_SM'
};

// CSV column indices (0-based)
const COLUMNS = {
    UNIQUE_KEY: 0,
    STYLE: 1,
    PRODUCT_TITLE: 2,
    CATEGORY_NAME: 12,
    SUBCATEGORY_NAME: 13,
    COLOR_NAME: 14,
    SIZE: 18,
    PIECE_PRICE: 21,
    PRODUCT_STATUS: 30,
    CATALOG_COLOR: 54
};

// Stats tracking
const stats = {
    totalRows: 0,
    uniqueStyles: new Set(),
    uniqueSizes: new Set(),
    unmappedSizes: new Map(), // size -> { count, styles: Set, examples: [] }
    stylesBySizeType: {
        standard: new Set(),
        extended: new Set(),
        tall: new Set(),
        youth: new Set(),
        toddler: new Set(),
        infant: new Set(),
        osfa: new Set(),
        combo: new Set(),
        pants4digit: new Set(),
        waistOnly: new Set(),
        unknown: new Set()
    },
    pantsStyles: new Set(),
    corruptedRows: 0,
    emptyCatalogColor: 0,
    styleWithSizes: new Map() // style -> Set of sizes
};

/**
 * Parse a CSV line handling quoted fields with commas
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

/**
 * Classify a size into its type
 */
function classifySize(size) {
    if (!size || size === 'SIZE') return 'header';

    const s = size.toUpperCase().trim();

    // Standard sizes
    if (['S', 'M', 'L', 'XL'].includes(s)) return 'standard';

    // Extended sizes (2XL-10XL)
    if (/^[2-9]XL$/.test(s) || s === '10XL') return 'extended';

    // XS is extended
    if (s === 'XS') return 'extended';

    // Tall sizes
    if (/^[SMLX]T$/.test(s) || /^[2-6]XLT$/.test(s) || s === 'LT' || s === 'MT' || s === 'ST') return 'tall';

    // Youth sizes
    if (/^Y[SMLX]/.test(s)) return 'youth';

    // Toddler sizes
    if (/^[2-6]T$/.test(s) || /^5\/6T?$/.test(s)) return 'toddler';

    // Infant sizes
    if (/^(NB|\d{1,2}M|06M|12M|18M|24M|1824)$/i.test(s)) return 'infant';

    // OSFA
    if (s === 'OSFA') return 'osfa';

    // Combo sizes
    if (/^[SMLX]+\/[SMLX2-6]+$/.test(s) || /^[2-6]\/[2-6]X?$/.test(s)) return 'combo';

    // 4-digit pants sizes (waist+inseam)
    if (/^\d{4}$/.test(s)) return 'pants4digit';

    // Waist-only sizes (W30, W32, etc.)
    if (/^W\d{2}$/.test(s)) return 'waistOnly';

    // Petite/Short/Regular/Long variants
    if (/^[SMLX2-6]+[LPRS]$/.test(s) || /^[SMLX]+L$/.test(s)) return 'variant';

    // Numeric sizes (shoes, numeric pants waist)
    if (/^\d{1,2}$/.test(s)) return 'numeric';

    return 'unknown';
}

/**
 * Check if a size is properly mapped
 */
function isSizeMapped(size) {
    if (!size) return false;
    const s = size.toUpperCase().trim();

    // Check direct mapping
    if (SIZE_TO_SUFFIX.hasOwnProperty(s)) return true;

    // Check if it's a 4-digit pants size (handled dynamically)
    if (/^\d{4}$/.test(s)) return true;

    return false;
}

/**
 * Process the CSV file
 */
async function processCSV(csvPath) {
    console.log(`\nProcessing: ${csvPath}\n`);

    const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isHeader = true;
    let lineNumber = 0;

    for await (const line of rl) {
        lineNumber++;

        // Skip header
        if (isHeader) {
            isHeader = false;
            continue;
        }

        stats.totalRows++;

        // Parse the line
        const fields = parseCSVLine(line);

        // Get relevant fields
        const style = fields[COLUMNS.STYLE];
        const size = fields[COLUMNS.SIZE];
        const category = fields[COLUMNS.CATEGORY_NAME];
        const catalogColor = fields[COLUMNS.CATALOG_COLOR];
        const productTitle = fields[COLUMNS.PRODUCT_TITLE] || '';

        // Skip if no style
        if (!style) continue;

        // Track unique styles
        stats.uniqueStyles.add(style);

        // Track style -> sizes mapping
        if (!stats.styleWithSizes.has(style)) {
            stats.styleWithSizes.set(style, new Set());
        }
        stats.styleWithSizes.get(style).add(size);

        // Track unique sizes
        if (size) {
            stats.uniqueSizes.add(size);
        }

        // Check for data corruption (prices in category field)
        if (category && /^\d+\.\d+$/.test(category)) {
            stats.corruptedRows++;
        }

        // Check for empty CATALOG_COLOR
        if (!catalogColor || catalogColor.trim() === '') {
            stats.emptyCatalogColor++;
        }

        // Track PT* pants styles
        if (/^L?PT\d+/.test(style)) {
            stats.pantsStyles.add(style);
        }

        // Classify size and track by type
        const sizeType = classifySize(size);
        if (sizeType !== 'header' && stats.stylesBySizeType[sizeType]) {
            stats.stylesBySizeType[sizeType].add(style);
        } else if (sizeType === 'unknown') {
            stats.stylesBySizeType.unknown.add(style);
        }

        // Check if size is mapped
        if (size && !isSizeMapped(size)) {
            if (!stats.unmappedSizes.has(size)) {
                stats.unmappedSizes.set(size, {
                    count: 0,
                    styles: new Set(),
                    examples: []
                });
            }
            const entry = stats.unmappedSizes.get(size);
            entry.count++;
            entry.styles.add(style);
            if (entry.examples.length < 3) {
                entry.examples.push({ style, title: productTitle.substring(0, 50) });
            }
        }

        // Progress indicator
        if (lineNumber % 50000 === 0) {
            console.log(`  Processed ${lineNumber.toLocaleString()} rows...`);
        }
    }

    console.log(`  Completed: ${lineNumber.toLocaleString()} total rows\n`);
}

/**
 * Generate the validation report
 */
function generateReport() {
    console.log('=' .repeat(80));
    console.log('SANMAR CSV VALIDATION REPORT');
    console.log('=' .repeat(80));

    // Summary
    console.log('\n## SUMMARY\n');
    console.log(`Total Rows:          ${stats.totalRows.toLocaleString()}`);
    console.log(`Unique Styles:       ${stats.uniqueStyles.size.toLocaleString()}`);
    console.log(`Unique Size Values:  ${stats.uniqueSizes.size.toLocaleString()}`);
    console.log(`Corrupted Rows:      ${stats.corruptedRows.toLocaleString()} (${(stats.corruptedRows/stats.totalRows*100).toFixed(1)}%)`);
    console.log(`Empty CATALOG_COLOR: ${stats.emptyCatalogColor.toLocaleString()}`);

    // Pants styles
    console.log('\n## PT* PANTS STYLES FOUND\n');
    const pantsArray = Array.from(stats.pantsStyles).sort();
    console.log(`Total: ${pantsArray.length} styles`);
    console.log(pantsArray.join(', '));

    // Styles by size type
    console.log('\n## STYLES BY SIZE TYPE\n');
    const sizeTypes = [
        ['Standard (S-XL)', 'standard'],
        ['Extended (XS, 2XL-6XL)', 'extended'],
        ['Tall (LT, XLT, etc.)', 'tall'],
        ['Youth (YS-YXL)', 'youth'],
        ['Toddler (2T-6T)', 'toddler'],
        ['Infant (NB, 6M-24M)', 'infant'],
        ['OSFA', 'osfa'],
        ['Combo (S/M, L/XL)', 'combo'],
        ['Pants 4-digit', 'pants4digit'],
        ['Waist-only (W30-W50)', 'waistOnly'],
        ['Unknown/Other', 'unknown']
    ];

    for (const [label, key] of sizeTypes) {
        const count = stats.stylesBySizeType[key]?.size || 0;
        console.log(`${label.padEnd(25)} ${count.toString().padStart(5)} styles`);
    }

    // Unmapped sizes - THE CRITICAL SECTION
    console.log('\n## UNMAPPED SIZES (NEED TO ADD TO SIZE_TO_SUFFIX)\n');

    if (stats.unmappedSizes.size === 0) {
        console.log('All sizes are properly mapped!');
    } else {
        // Sort by count descending
        const sortedUnmapped = Array.from(stats.unmappedSizes.entries())
            .sort((a, b) => b[1].count - a[1].count);

        console.log(`Total unmapped size values: ${sortedUnmapped.length}\n`);
        console.log('Size'.padEnd(12) + 'Rows'.padStart(8) + 'Styles'.padStart(8) + '  Example Products');
        console.log('-'.repeat(80));

        for (const [size, data] of sortedUnmapped) {
            const exampleStr = data.examples.map(e => e.style).join(', ');
            console.log(
                size.padEnd(12) +
                data.count.toString().padStart(8) +
                data.styles.size.toString().padStart(8) +
                '  ' + exampleStr.substring(0, 45)
            );
        }

        // Generate suggested SIZE_TO_SUFFIX additions
        console.log('\n## SUGGESTED SIZE_TO_SUFFIX ADDITIONS\n');
        console.log('Copy this to sku-validation-service.js:\n');
        console.log('```javascript');

        // Group by type
        const extended = sortedUnmapped.filter(([s]) => /^[7-9]XL$|^10XL$/.test(s));
        const waist = sortedUnmapped.filter(([s]) => /^W\d{2}$/.test(s));
        const variant = sortedUnmapped.filter(([s]) => /^[SMLX2-6]+[LPRS]$/.test(s));
        const tall = sortedUnmapped.filter(([s]) => /^[2-6]XLT$|^[SM]T$/.test(s));
        const toddler = sortedUnmapped.filter(([s]) => /^6T$/.test(s));
        const infant = sortedUnmapped.filter(([s]) => /^06M$|^1824$/.test(s));
        const combo = sortedUnmapped.filter(([s]) => /\//.test(s));
        const other = sortedUnmapped.filter(([s]) => {
            return !extended.some(([e]) => e === s) &&
                   !waist.some(([e]) => e === s) &&
                   !variant.some(([e]) => e === s) &&
                   !tall.some(([e]) => e === s) &&
                   !toddler.some(([e]) => e === s) &&
                   !infant.some(([e]) => e === s) &&
                   !combo.some(([e]) => e === s);
        });

        if (extended.length > 0) {
            console.log('// Extra-extended sizes');
            for (const [size] of extended) {
                const suffix = size.replace('XL', 'X');
                console.log(`'${size}': '_${suffix}',`);
            }
            console.log('');
        }

        if (waist.length > 0) {
            console.log('// Waist-only sizes (shorts)');
            for (const [size] of waist.sort((a, b) => parseInt(a[0].slice(1)) - parseInt(b[0].slice(1)))) {
                console.log(`'${size}': '_${size}',`);
            }
            console.log('');
        }

        if (tall.length > 0) {
            console.log('// Additional tall sizes');
            for (const [size] of tall) {
                console.log(`'${size}': '_${size}',`);
            }
            console.log('');
        }

        if (variant.length > 0) {
            console.log('// Petite/Short/Regular/Long variants');
            for (const [size] of variant) {
                console.log(`'${size}': '_${size}',`);
            }
            console.log('');
        }

        if (toddler.length > 0) {
            console.log('// Missing toddler sizes');
            for (const [size] of toddler) {
                console.log(`'${size}': '_${size}',`);
            }
            console.log('');
        }

        if (infant.length > 0) {
            console.log('// Missing infant sizes');
            for (const [size] of infant) {
                console.log(`'${size}': '_${size}',`);
            }
            console.log('');
        }

        if (combo.length > 0) {
            console.log('// Combo sizes');
            for (const [size] of combo) {
                console.log(`'${size}': '_${size.replace('/', '-')}',`);
            }
            console.log('');
        }

        if (other.length > 0) {
            console.log('// Other sizes (review manually)');
            for (const [size] of other) {
                console.log(`'${size}': '_${size}',  // Used in ${sortedUnmapped.find(([s]) => s === size)[1].styles.size} styles`);
            }
        }

        console.log('```');
    }

    // Summary of pants styles with their sizes
    console.log('\n## PANTS STYLE SIZE ANALYSIS\n');
    for (const pantsStyle of Array.from(stats.pantsStyles).sort()) {
        const sizes = stats.styleWithSizes.get(pantsStyle);
        if (sizes) {
            const sizeArray = Array.from(sizes).filter(s => s).sort();
            const sizeType = sizeArray.length > 0 ? classifySize(sizeArray[0]) : 'unknown';
            console.log(`${pantsStyle}: ${sizeArray.length} sizes (${sizeType})`);
            if (sizeArray.length <= 20) {
                console.log(`  Sizes: ${sizeArray.join(', ')}`);
            } else {
                console.log(`  Sizes: ${sizeArray.slice(0, 10).join(', ')}... and ${sizeArray.length - 10} more`);
            }
        }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('END OF REPORT');
    console.log('=' .repeat(80));
}

// Main execution
async function main() {
    // Get CSV path from command line or use default
    const csvPath = process.argv[2] || '/mnt/c/Users/erik/Downloads/Sanmar New Pricing 1-4-26.csv';

    // Check if file exists
    if (!fs.existsSync(csvPath)) {
        console.error(`ERROR: CSV file not found: ${csvPath}`);
        console.error('\nUsage: node csv-validation-report.js [path-to-csv]');
        process.exit(1);
    }

    try {
        await processCSV(csvPath);
        generateReport();
    } catch (error) {
        console.error('ERROR processing CSV:', error);
        process.exit(1);
    }
}

main();
