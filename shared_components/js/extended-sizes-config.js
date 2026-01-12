/**
 * Extended Sizes Configuration - Shared Module for Quote Builders
 *
 * Used by: DTG, Screen Print, DTF, and Embroidery Quote Builders
 *
 * This module provides a unified configuration for extended sizes,
 * ensuring consistency across all quote builders.
 *
 * IMPORTANT: All 4 quote builders should import these constants
 * instead of defining their own. This prevents drift and ensures
 * consistent part number generation.
 *
 * @version 1.0.0
 * @created 2026-01-07
 */

/**
 * Extended Size Sort Order
 * Controls the display order of child rows in the quote table.
 * Sizes earlier in the array appear first below the parent row.
 *
 * Categories:
 * - Extra Small: XXS, 2XS, XS, XS/S
 * - Combo Sizes: S/M, M/L, L/XL, X/2X, S/XL
 * - Plus Sizes: 2XL through 10XL
 * - Tall Sizes: ST, MT, XST, LT, XLT, 2XLT-6XLT
 * - Big Sizes: LB, XLB, 2XLB
 * - Youth Sizes: YXS, YS, YM, YL, YXL
 * - Toddler Sizes: 2T, 3T, 4T, 5T, 5/6T, 6T
 * - One Size: OSFA, OSFM
 */
const EXTENDED_SIZE_ORDER = [
    // Extra small
    'XXS', '2XS', 'XS', 'XS/S',
    // Combo sizes
    'S/M', 'M/L', 'L/XL', 'X/2X', 'S/XL',
    // Plus sizes (2XL through 10XL)
    '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    // Tall sizes
    'ST', 'MT', 'XST', 'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT',
    // Big sizes
    'LB', 'XLB', '2XLB',
    // Youth sizes
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    // Toddler sizes
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    // One size fits all
    'OSFA', 'OSFM'
];

/**
 * Size to Part Number Suffix Mapping
 * Used to generate ShopWorks-compatible part numbers.
 *
 * Example: Style PC61 + Size 3XL = PC61_3X
 *
 * CRITICAL: Standard sizes (S, M, L, XL) have empty suffix
 * because they use the base style number.
 *
 * NOTE: 2XL and XXL are DIFFERENT sizes in some product lines:
 * - 2XL: Standard plus size (most common)
 * - XXL: Some brands use this instead of 2XL
 * Both map to '_2X' for backward compatibility.
 */
const SIZE_TO_SUFFIX = {
    // Standard sizes (no suffix - use base style)
    'S': '',
    'M': '',
    'L': '',
    'XL': '',

    // Plus sizes
    '2XL': '_2X',
    'XXL': '_2X',      // Alias for 2XL (most products treat XXL as 2XL)
    '3XL': '_3X',
    'XXXL': '_3X',     // Alias for 3XL
    '4XL': '_4X',
    '5XL': '_5X',
    '6XL': '_6X',
    '7XL': '_7XL',
    '8XL': '_8XL',
    '9XL': '_9XL',
    '10XL': '_10XL',

    // Extra small sizes
    'XS': '_XS',
    'XXS': '_XXS',
    '2XS': '_2XS',

    // One size fits all
    'OSFA': '_OSFA',
    'OSFM': '_OSFM',

    // Combo sizes
    'S/M': '_S/M',
    'M/L': '_M/L',
    'L/XL': '_L/XL',
    'XS/S': '_XS/S',
    'X/2X': '_X/2X',
    'S/XL': '_S/XL',

    // Tall sizes
    'ST': '_ST',
    'MT': '_MT',
    'XST': '_XST',
    'LT': '_LT',
    'XLT': '_XLT',
    '2XLT': '_2XLT',
    '3XLT': '_3XLT',
    '4XLT': '_4XLT',
    '5XLT': '_5XLT',
    '6XLT': '_6XLT',

    // Big sizes
    'LB': '_LB',
    'XLB': '_XLB',
    '2XLB': '_2XLB',

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
    '5/6T': '_5/6T',
    '6T': '_6T'
};

/**
 * Standard sizes that display in the parent row columns
 * All other sizes become child rows
 */
const STANDARD_SIZES = ['S', 'M', 'L', 'XL'];

/**
 * Size categories for grouping in the extended size popup
 */
const SIZE_CATEGORIES = {
    extraSmall: ['XXS', '2XS', 'XS', 'XS/S'],
    combo: ['S/M', 'M/L', 'L/XL', 'X/2X', 'S/XL'],
    plus: ['2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'],
    tall: ['ST', 'MT', 'XST', 'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT'],
    big: ['LB', 'XLB', '2XLB'],
    youth: ['YXS', 'YS', 'YM', 'YL', 'YXL'],
    toddler: ['2T', '3T', '4T', '5T', '5/6T', '6T'],
    oneSize: ['OSFA', 'OSFM']
};

/**
 * Sizes that go in the Size05 column (2XL/XXL only)
 * All other extended sizes go to Size06 column
 */
const SIZE05_SIZES = ['2XL', 'XXL'];

/**
 * Get the part number suffix for a size
 * @param {string} size - The size (e.g., '3XL')
 * @returns {string} The suffix (e.g., '_3X') or empty string
 */
function getSizeSuffix(size) {
    return SIZE_TO_SUFFIX[size] || '';
}

/**
 * Get the full part number for a style + size combination
 * @param {string} baseStyle - The base style number (e.g., 'PC61')
 * @param {string} size - The size (e.g., '3XL')
 * @returns {string} The full part number (e.g., 'PC61_3X')
 */
function getPartNumber(baseStyle, size) {
    const suffix = getSizeSuffix(size);
    return suffix ? `${baseStyle}${suffix}` : baseStyle;
}

/**
 * Check if a size is an extended size (goes in child row)
 * @param {string} size - The size to check
 * @returns {boolean} True if extended size
 */
function isExtendedSize(size) {
    return !STANDARD_SIZES.includes(size);
}

/**
 * Check if a size goes in the Size05 column
 * @param {string} size - The size to check
 * @returns {boolean} True if Size05, false if Size06
 */
function isSize05(size) {
    return SIZE05_SIZES.includes(size);
}

/**
 * Get the sort index for a size (for ordering child rows)
 * @param {string} size - The size
 * @returns {number} Sort index (lower = earlier)
 */
function getSizeSortIndex(size) {
    const index = EXTENDED_SIZE_ORDER.indexOf(size);
    return index !== -1 ? index : 999; // Unknown sizes go at end
}

/**
 * Sort an array of sizes according to EXTENDED_SIZE_ORDER
 * @param {string[]} sizes - Array of sizes to sort
 * @returns {string[]} Sorted array
 */
function sortSizes(sizes) {
    return [...sizes].sort((a, b) => getSizeSortIndex(a) - getSizeSortIndex(b));
}

/**
 * Get the size category for display grouping
 * @param {string} size - The size
 * @returns {string|null} Category name or null if not categorized
 */
function getSizeCategory(size) {
    for (const [category, sizes] of Object.entries(SIZE_CATEGORIES)) {
        if (sizes.includes(size)) return category;
    }
    return null;
}

/**
 * Fetch available extended sizes for a product from the API
 * Uses the SanMar/ShopWorks import format endpoint
 *
 * @param {string} styleNumber - The style number (e.g., 'PC61')
 * @param {string} color - The catalog color (e.g., 'Dark Heather Grey') - REQUIRED by API
 * @returns {Promise<string[]>} Array of available extended sizes
 */
async function getAvailableExtendedSizes(styleNumber, color = '') {
    const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    try {
        const response = await fetch(
            `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color || '')}`
        );

        if (!response.ok) {
            console.warn(`[ExtendedSizes] API error for ${styleNumber}:`, response.status);
            return [];
        }

        const data = await response.json();

        // Extract unique sizes from the response
        const allSizes = new Set();

        if (Array.isArray(data)) {
            data.forEach(item => {
                // Check for size fields in ShopWorks format
                ['Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06'].forEach(field => {
                    if (item[field] && item[field].trim()) {
                        allSizes.add(item[field].trim());
                    }
                });

                // Also check for SIZE field (alternate format)
                if (item.SIZE && item.SIZE.trim()) {
                    allSizes.add(item.SIZE.trim());
                }
            });
        }

        // Filter to only extended sizes (not standard S, M, L, XL)
        const extendedSizes = [...allSizes].filter(size => isExtendedSize(size));

        // Filter to only sizes we have suffix mappings for
        const supportedSizes = extendedSizes.filter(size => SIZE_TO_SUFFIX.hasOwnProperty(size));

        // Sort by our defined order
        const sortedSizes = sortSizes(supportedSizes);

        console.log(`[ExtendedSizes] ${styleNumber} available:`, sortedSizes);
        return sortedSizes;

    } catch (error) {
        console.error(`[ExtendedSizes] Failed to fetch sizes for ${styleNumber}:`, error);
        return [];
    }
}

/**
 * Get all supported extended sizes (for fallback when API unavailable)
 * @returns {string[]} All extended sizes in EXTENDED_SIZE_ORDER
 */
function getAllExtendedSizes() {
    return EXTENDED_SIZE_ORDER.filter(size => isExtendedSize(size));
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EXTENDED_SIZE_ORDER,
        SIZE_TO_SUFFIX,
        STANDARD_SIZES,
        SIZE_CATEGORIES,
        SIZE05_SIZES,
        getSizeSuffix,
        getPartNumber,
        isExtendedSize,
        isSize05,
        getSizeSortIndex,
        sortSizes,
        getSizeCategory,
        getAvailableExtendedSizes,
        getAllExtendedSizes
    };
}

// Make available globally
window.ExtendedSizesConfig = {
    EXTENDED_SIZE_ORDER,
    SIZE_TO_SUFFIX,
    STANDARD_SIZES,
    SIZE_CATEGORIES,
    SIZE05_SIZES,
    getSizeSuffix,
    getPartNumber,
    isExtendedSize,
    isSize05,
    getSizeSortIndex,
    sortSizes,
    getSizeCategory,
    getAvailableExtendedSizes,
    getAllExtendedSizes
};

console.log('[ExtendedSizesConfig] Module loaded with', EXTENDED_SIZE_ORDER.length, 'extended sizes');
