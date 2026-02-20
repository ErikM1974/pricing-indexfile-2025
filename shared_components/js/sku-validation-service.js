/**
 * SKU Validation Service
 *
 * Validates SKUs against ShopWorks inventory and provides
 * SanMar to ShopWorks SKU transformation.
 *
 * CRITICAL: ShopWorks uses _2X/_3X suffix format (NOT _2XL/_3XL)
 * Verified from actual shopworksparts.csv file from ShopWorks.
 *
 * @author Claude Code
 * @version 1.0.0
 */

class SKUValidationService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Standard sizes that use the BASE SKU (no suffix)
     */
    static STANDARD_SIZES = ['S', 'M', 'L', 'XL'];

    /**
     * Styles that use _XXL suffix instead of _2X
     * (Ladies, District, Cornerstone products from ShopWorks)
     * Generated from shopworksparts.csv - 442 active styles
     * ADDED 2026-01-04: Fix for ShopWorks XXL suffix mismatch
     */
    static XXL_STYLES = new Set([
        'CS411', 'CS413', 'CS419', 'CS451',
        'DM104L', 'DM106L', 'DM107L', 'DM108L', 'DM1170L', 'DM1190L', 'DM130L', 'DM1350L', 'DM136L', 'DM138L', 'DM139L', 'DM476', 'DM493',
        'DT110', 'DT1104', 'DT1105', 'DT1309', 'DT1310', 'DT1311', 'DT132L', 'DT135', 'DT1375', 'DT137L', 'DT1390L', 'DT141', 'DT151', 'DT153', 'DT154', 'DT155', 'DT156', 'DT188', 'DT2100', 'DT2800', 'DT296', 'DT456', 'DT488', 'DT5001', 'DT5002', 'DT6001', 'DT6002', 'DT6020', 'DT6021', 'DT6101', 'DT6103', 'DT6105', 'DT6110', 'DT6111', 'DT6201', 'DT6302', 'DT6402', 'DT6503', 'DT664', 'DT665', 'DT671', 'DT672', 'DT673', 'DT7501', 'DT7509', 'DT7510', 'DT8001', 'DT8101', 'DT8103',
        'L100', 'L110', 'L123', 'L130', 'L131', 'L132', 'L151', 'L152', 'L211', 'L216', 'L217', 'L219', 'L222', 'L223', 'L224', 'L226', 'L227', 'L230', 'L231', 'L232', 'L233', 'L235', 'L236', 'L239', 'L248', 'L249', 'L293', 'L298', 'L304', 'L317', 'L318', 'L321', 'L324', 'L325', 'L331', 'L332', 'L333', 'L335', 'L339', 'L344', 'L354', 'L365', 'L405', 'L406', 'L407', 'L420', 'L422', 'L425', 'L428', 'L455', 'L469', 'L474', 'L475', 'L500', 'L500LS', 'L508', 'L510', 'L515', 'L5200', 'L525', 'L527', 'L528', 'L540', 'L540LS', 'L543', 'L5430', 'L545', 'L547', 'L555', 'L562', 'L568', 'L569', 'L570', 'L571', 'L572', 'L573', 'L574', 'L575', 'L576', 'L580', 'L608', 'L612', 'L617', 'L638', 'L640', 'L654', 'L658', 'L659', 'L662', 'L663', 'L664', 'L665', 'L700', 'L701', 'L702', 'L705', 'L706', 'L709', 'L714', 'L717', 'L718', 'L719', 'L720', 'L721', 'L7620', 'L7710', 'L787', 'L790', 'L792', 'L804', 'L805', 'L806', 'L807', 'L814', 'L850', 'L851', 'L852', 'L853', 'L854', 'L900', 'L901', 'L902', 'L903', 'L904', 'L905', 'L906', 'L919', 'L920', 'L921',
        'LK110', 'LK110SV', 'LK111', 'LK112', 'LK200', 'LK200LS', 'LK210', 'LK240', 'LK398', 'LK542', 'LK5431', 'LK5432', 'LK5433', 'LK5434', 'LK5600', 'LK5601', 'LK5602', 'LK582', 'LK583', 'LK584', 'LK585', 'LK587', 'LK595', 'LK600', 'LK646', 'LK682', 'LK683', 'LK6840', 'LK750', 'LK8000', 'LK810', 'LK820', 'LK825', 'LK826', 'LK829', 'LK830', 'LK863', 'LK864', 'LK867', 'LK870', 'LK880', 'LK881', 'LKP1500', 'LKP155',
        'LM1008', 'LM2000',
        'LPC098V', 'LPC099TT', 'LPC099V', 'LPC140P', 'LPC140V', 'LPC147V', 'LPC330V', 'LPC380', 'LPC380TT', 'LPC381V', 'LPC450', 'LPC450V', 'LPC450VLS', 'LPC455V', 'LPC54', 'LPC54LS', 'LPC54TT', 'LPC54V', 'LPC55', 'LPC61', 'LPC78H', 'LPC78ZH',
        'LPST800', 'LPST871', 'LPST880', 'LPST890', 'LPST891', 'LPST95',
        'LSP10', 'LSP11',
        'LST104', 'LST225', 'LST235', 'LST236', 'LST237', 'LST241', 'LST245', 'LST253', 'LST254', 'LST264', 'LST272', 'LST274', 'LST280', 'LST293', 'LST296', 'LST298', 'LST299', 'LST30', 'LST304', 'LST307', 'LST311', 'LST340', 'LST350', 'LST352', 'LST353', 'LST353LS', 'LST356', 'LST357', 'LST358', 'LST360', 'LST361', 'LST362', 'LST380', 'LST390', 'LST396', 'LST397', 'LST40', 'LST400', 'LST400LS', 'LST401', 'LST402', 'LST403', 'LST405', 'LST406', 'LST407', 'LST410', 'LST411', 'LST420', 'LST420LS', 'LST441', 'LST442', 'LST444', 'LST446', 'LST450', 'LST465', 'LST466', 'LST468', 'LST469', 'LST470', 'LST470LS', 'LST475', 'LST484', 'LST485', 'LST486', 'LST490', 'LST520', 'LST530', 'LST535', 'LST550', 'LST560', 'LST561', 'LST562', 'LST570', 'LST590', 'LST6041', 'LST6043', 'LST630', 'LST640', 'LST641', 'LST650', 'LST652', 'LST653', 'LST655', 'LST659', 'LST660', 'LST665', 'LST672', 'LST680', 'LST685', 'LST690', 'LST695', 'LST700', 'LST710', 'LST711', 'LST725', 'LST740', 'LST76', 'LST800', 'LST850', 'LST852', 'LST853', 'LST854', 'LST855', 'LST856', 'LST857', 'LST860', 'LST870', 'LST885', 'LST90', 'LST94', 'LST940', 'LST941', 'LST970', 'LST980',
        'LSW285', 'LSW2850', 'LSW287', 'LSW2870', 'LSW289', 'LSW2890', 'LSW415', 'LSW4150', 'LSW416',
        'LW100', 'LW102', 'LW380', 'LW382', 'LW400', 'LW401', 'LW644', 'LW645', 'LW657', 'LW668', 'LW669', 'LW670', 'LW672', 'LW676', 'LW680', 'LW700', 'LW701', 'LW703', 'LW713', 'LW714', 'LW715', 'LW808', 'LW809', 'LW816', 'LW960', 'LW963',
        'OR322218', 'OR322225', 'OR322226', 'OR322227', 'OR322228', 'OR322229', 'OR322263', 'OR322264', 'OR322265', 'OR322267', 'OR322268',
        'RH79',
        'TTCM3914', 'TTCM4367', 'TTCM4413', 'TTCM4414', 'TTCM4879', 'TTCM5645', 'TTCM5660', 'TTCW5646', 'TTCW5647', 'TTCW6108'
    ]);

    /**
     * Styles that use lowercase _ss suffix in ShopWorks
     * ADDED 2026-01-04: Fix for ShopWorks lowercase suffix
     */
    static LOWERCASE_SS_STYLES = new Set([
        'WW3150S'
    ]);

    /**
     * Styles that use lowercase _xxxl suffix in ShopWorks
     * ADDED 2026-01-04: Fix for ShopWorks lowercase suffix
     */
    static LOWERCASE_XXXL_STYLES = new Set([
        'OR322226', 'OR322227', 'OR322228', 'OR322264', 'OR322267', 'OR322269'
    ]);

    /**
     * Size to ShopWorks suffix mapping
     * VERIFIED from shopworksparts.csv - ShopWorks uses _2X NOT _2XL
     * UPDATED 2026-01-04: Added 97 additional sizes from SanMar CSV validation
     */
    static SIZE_TO_SUFFIX = {
        // Standard sizes - no suffix (use base SKU)
        'S': '',
        'M': '',
        'L': '',
        'XL': '',

        // Extended sizes - ShopWorks full-form format (per Feb 2026 pricelist)
        'XS': '_XS',
        '2XL': '_2XL',     // 2,125 products use _2XL (full form)
        '3XL': '_3XL',     // 2,448 products use _3XL (full form)
        '4XL': '_4XL',
        '5XL': '_5XL',
        '6XL': '_6XL',
        '7XL': '_7XL',     // Extra-extended (S608ES, K500ES)
        '8XL': '_8XL',     // Extra-extended
        '9XL': '_9XL',     // Extra-extended
        '10XL': '_10XL',   // Extra-extended

        // Ladies/Womens sizes — DISTINCT from standard 2XL/3XL (zero overlap)
        'XXL': '_XXL',     // 589 styles use _XXL (ladies/womens 2XL equivalent)
        'XXXL': '_XXXL',   // 6 Outdoor Research products
        'XXS': '_XXS',     // Extra-extra small (18 styles)
        '2XS': '_2XS',     // Alternative extra-extra small (15 styles)

        // Tall sizes
        'LT': '_LT',
        'XLT': '_XLT',
        '2XLT': '_2XLT',
        '3XLT': '_3XLT',
        '4XLT': '_4XLT',
        'ST': '_ST',       // Short tall (WW3150T, WW4750T)
        'MT': '_MT',       // Medium tall (WW4750T, CTTC003)
        'XST': '_XST',     // Extra small tall (WW4750T)

        // One-size / combination sizes
        'OSFA': '_OSFA',
        'S/M': '_S/M',
        'M/L': '_M/L',
        'L/XL': '_L/XL',
        'S/XL': '_S/XL',   // CT102368
        'XS/S': '_XS/S',   // CT106171
        'X/2X': '_X/2X',   // CT106171
        '2/3X': '_2/3X',   // CSV104, CSV101
        '3/4X': '_3/4X',   // CT106171
        '4/5X': '_4/5X',   // CSV104, CSV102
        '2-5X': '_2-5X',   // CT102368
        'T/C': '_T/C',     // Toddler/Child (NE302)
        'C/Y': '_C/Y',     // Child/Youth (NE302)

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
        '6T': '_6T',       // 5100P (was missing)
        '5/6': '_5/6',
        '5/6T': '_5/6T',   // RS3330, RS3321

        // Infant sizes
        'NB': '_NB',
        '6M': '_6M',
        '06M': '_06M',     // With leading zero (CAR78IZH, CAR54I)
        '12M': '_12M',
        '18M': '_18M',
        '24M': '_24M',
        '306': '_306',     // 3-6 months (BC3001B, BC100B)
        '612': '_612',     // 6-12 months (BC100B, BC3001B)
        // ShopWorks 4-digit infant sizes (leading zeros preserved)
        '0003': '_0003',   // 0-3 months
        '0306': '_0306',   // 3-6 months (different from '306')
        '0612': '_0612',   // 6-12 months (different from '612')
        '1218': '_1218',   // 12-18 months
        '1824': '_1824',   // 18-24 months

        // Waist-only sizes (shorts) - PT66, CT103542
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

        // Regular variants (CS10, CS20 - Cornerstone work shirts)
        'SR': '_SR',       // Small Regular
        'MR': '_MR',       // Medium Regular
        'LR': '_LR',       // Large Regular
        'XLR': '_XLR',     // XL Regular
        '2XLR': '_2XLR',   // 2XL Regular
        '3XLR': '_3XLR',   // 3XL Regular
        '4XLR': '_4XLR',   // 4XL Regular
        '5XLR': '_5XLR',   // 5XL Regular
        '6XLR': '_6XLR',   // 6XL Regular

        // Long variants (CS10LONG, CS20LONG - Cornerstone)
        'ML': '_ML',       // Medium Long
        'LL': '_LL',       // Large Long
        'XLL': '_XLL',     // XL Long
        '2XLL': '_2XLL',   // 2XL Long
        '3XLL': '_3XLL',   // 3XL Long

        // Short variants (CTS104393 - Carhartt)
        'MS': '_MS',       // Medium Short
        'LS': '_LS',       // Large Short
        'XLS': '_XLS',     // XL Short
        '2XLS': '_2XLS',   // 2XL Short
        '3XLS': '_3XLS',   // 3XL Short
        'SS': '_SS',       // Small Short (WW3150S)
        'XSS': '_XSS',     // XS Short
        '2XSS': '_2XSS',   // 2XS Short
        'ss': '_ss',       // lowercase variant (WW3150S uses _ss in ShopWorks)
        'xxxl': '_xxxl',   // lowercase variant (OR322226 uses _xxxl in ShopWorks)

        // Petite variants (WW4550P - Wonderwink)
        'SP': '_SP',       // Small Petite
        'MP': '_MP',       // Medium Petite
        'LP': '_LP',       // Large Petite
        'XLP': '_XLP',     // XL Petite
        'XSP': '_XSP',     // XS Petite
        '2XLP': '_2XLP',   // 2XL Petite
        '2XSP': '_2XSP',   // 2XS Petite

        // Numeric belt/shoe sizes (TM1MW454, MM4001, DT2020)
        '0': '_0',
        '1': '_1',
        '2': '_2',
        '3': '_3',
        '4': '_4',
        '5': '_5',
        '6': '_6',
        '7': '_7',
        '8': '_8',
        '9': '_9',
        '10': '_10',
        '11': '_11',
        '12': '_12',
        '13': '_13',
        '14': '_14',
        '16': '_16',
        '18': '_18',
        '20': '_20',
        '30': '_30',
        '32': '_32',
        '33': '_33',
        '34': '_34',
        '35': '_35',
        '36': '_36',
        '38': '_38',
        '40': '_40',
        '42': '_42',

        // Special combo sizes
        'SM': '_SM'        // 212 style
    };

    /**
     * Convert SanMar style + size to ShopWorks SKU format
     *
     * @param {string} style - Base style number (e.g., 'PC54')
     * @param {string} size - Size (e.g., '2XL', 'S', 'OSFA')
     * @returns {string} ShopWorks SKU (e.g., 'PC54_2X', 'PC54', 'C950_OSFA')
     *
     * @example
     * sanmarToShopWorksSKU('PC54', 'M')   // Returns 'PC54'
     * sanmarToShopWorksSKU('PC54', '2XL') // Returns 'PC54_2X'
     * sanmarToShopWorksSKU('C950', 'OSFA') // Returns 'C950_OSFA'
     */
    sanmarToShopWorksSKU(style, size) {
        if (!style || !size) {
            console.warn('[SKUValidationService] Missing style or size:', { style, size });
            return style || '';
        }

        const normalizedSize = size.toUpperCase().trim();

        // Special handling: XXL → _XXL for Ladies/District products
        // These styles use _XXL in ShopWorks instead of the default _2X
        if (normalizedSize === 'XXL' && SKUValidationService.XXL_STYLES.has(style)) {
            return `${style}_XXL`;
        }

        // Special handling: SS → _ss for styles with lowercase suffix in ShopWorks
        if (normalizedSize === 'SS' && SKUValidationService.LOWERCASE_SS_STYLES.has(style)) {
            return `${style}_ss`;
        }

        // Special handling: XXXL → _xxxl for styles with lowercase suffix in ShopWorks
        if (normalizedSize === 'XXXL' && SKUValidationService.LOWERCASE_XXXL_STYLES.has(style)) {
            return `${style}_xxxl`;
        }

        const suffix = SKUValidationService.SIZE_TO_SUFFIX[normalizedSize];

        // Known size with explicit mapping
        if (suffix !== undefined) {
            return suffix ? `${style}${suffix}` : style;
        }

        // Unknown size - construct suffix from size value
        console.warn(`[SKUValidationService] Unknown size "${size}", using fallback suffix`);
        return `${style}_${normalizedSize}`;
    }

    /**
     * Check if a size is a standard size (uses base SKU)
     *
     * @param {string} size - Size to check
     * @returns {boolean} True if standard size (S, M, L, XL)
     */
    isStandardSize(size) {
        return SKUValidationService.STANDARD_SIZES.includes(size.toUpperCase().trim());
    }

    /**
     * Get cache key for a style/color combination
     * @private
     */
    _getCacheKey(styleNumber, catalogColor) {
        return `${styleNumber}:${catalogColor}`.toLowerCase();
    }

    /**
     * Check if cached data is still valid
     * @private
     */
    _isCacheValid(cacheEntry) {
        if (!cacheEntry) return false;
        return (Date.now() - cacheEntry.timestamp) < this.cacheDuration;
    }

    /**
     * Get valid SKUs for a product/color combination from ShopWorks
     *
     * @param {string} styleNumber - Product style (e.g., 'PC54')
     * @param {string} catalogColor - CATALOG_COLOR (e.g., 'BrillOrng')
     * @returns {Promise<Object>} Object with validSizes array and skuMap
     *
     * @example
     * const { validSizes, skuMap } = await getValidSKUs('PC54', 'Ash');
     * // validSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL']
     * // skuMap: { 'S': 'PC54', '2XL': 'PC54_2X', ... }
     */
    async getValidSKUs(styleNumber, catalogColor) {
        const cacheKey = this._getCacheKey(styleNumber, catalogColor);

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (this._isCacheValid(cached)) {
            console.log('[SKUValidationService] Cache hit for', cacheKey);
            return cached.data;
        }

        try {
            // Query the sanmar-shopworks import format endpoint
            const url = `${this.baseURL}/api/sanmar-shopworks/import-format?style=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Process response to extract valid sizes
            const validSizes = [];
            const skuMap = {};

            if (data && data.products) {
                for (const product of data.products) {
                    // Check Size01-Size10 fields for available sizes
                    for (let i = 1; i <= 10; i++) {
                        const sizeField = `Size0${i}`.replace('Size010', 'Size10');
                        const actualField = i < 10 ? `Size0${i}` : `Size${i}`;

                        if (product[actualField] && product[actualField] !== '0' && product[actualField] !== '') {
                            const size = this._normalizeSize(actualField, product);
                            if (size && !validSizes.includes(size)) {
                                validSizes.push(size);
                                skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
                            }
                        }
                    }
                }
            }

            // If no data from API, provide defaults for common products
            if (validSizes.length === 0) {
                console.warn('[SKUValidationService] No sizes found from API, using defaults');
                const defaults = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
                defaults.forEach(size => {
                    validSizes.push(size);
                    skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
                });
            }

            const result = { validSizes, skuMap, styleNumber, catalogColor };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log('[SKUValidationService] Fetched valid sizes:', result);
            return result;

        } catch (error) {
            console.error('[SKUValidationService] Failed to fetch valid SKUs:', error);

            // Return default sizes on error (allow manual entry)
            const defaults = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
            const skuMap = {};
            defaults.forEach(size => {
                skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
            });

            return {
                validSizes: defaults,
                skuMap,
                styleNumber,
                catalogColor,
                error: error.message,
                isDefault: true
            };
        }
    }

    /**
     * Get inventory status for a specific size
     *
     * @param {string} styleNumber - Product style
     * @param {string} catalogColor - CATALOG_COLOR (NOT COLOR_NAME!)
     * @param {string} size - Size to check
     * @returns {Promise<Object>} Inventory status { available, stock, sku, status }
     */
    async getInventoryForSize(styleNumber, catalogColor, size) {
        const sku = this.sanmarToShopWorksSKU(styleNumber, size);

        try {
            const url = `${this.baseURL}/api/inventory?sku=${encodeURIComponent(sku)}&color=${encodeURIComponent(catalogColor)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Inventory API returned ${response.status}`);
            }

            const data = await response.json();

            // Determine inventory status
            const stock = data.quantity || data.stock || 0;
            let status = 'out';
            if (stock > 50) status = 'ok';
            else if (stock > 0) status = 'low';

            return {
                available: stock > 0,
                stock: stock,
                sku: sku,
                status: status,
                size: size
            };

        } catch (error) {
            console.error('[SKUValidationService] Inventory check failed:', error);
            return {
                available: null,
                stock: null,
                sku: sku,
                status: 'unknown',
                size: size,
                error: error.message
            };
        }
    }

    /**
     * Batch check inventory for multiple sizes
     *
     * @param {string} styleNumber - Product style
     * @param {string} catalogColor - CATALOG_COLOR
     * @param {string[]} sizes - Array of sizes to check
     * @returns {Promise<Object>} Map of size -> inventory status
     */
    async getInventoryBatch(styleNumber, catalogColor, sizes) {
        const results = {};

        // Run inventory checks in parallel
        const promises = sizes.map(async (size) => {
            const inventory = await this.getInventoryForSize(styleNumber, catalogColor, size);
            results[size] = inventory;
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Normalize size field name to display size
     * @private
     */
    _normalizeSize(sizeField, product) {
        // Map Size01-Size10 to actual size values based on product data
        // This would need to be enhanced based on actual API response structure
        const sizeMap = {
            'Size01': 'XS',
            'Size02': 'S',
            'Size03': 'M',
            'Size04': 'L',
            'Size05': 'XL',
            'Size06': '2XL',
            'Size07': '3XL',
            'Size08': '4XL',
            'Size09': '5XL',
            'Size10': '6XL'
        };
        return sizeMap[sizeField] || null;
    }

    /**
     * Clear the cache (useful for testing or forced refresh)
     */
    clearCache() {
        this.cache.clear();
        console.log('[SKUValidationService] Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        this.cache.forEach((entry) => {
            if ((now - entry.timestamp) < this.cacheDuration) {
                valid++;
            } else {
                expired++;
            }
        });

        return {
            total: this.cache.size,
            valid,
            expired,
            cacheDuration: this.cacheDuration
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SKUValidationService;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.SKUValidationService = SKUValidationService;
}
