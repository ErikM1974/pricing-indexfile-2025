/**
 * ShopWorks Import Parser
 *
 * Parses ShopWorks order text files and extracts:
 * - Customer information (company, contact, email)
 * - Sales rep info
 * - Products (SanMar and custom)
 * - Service items (digitizing, additional logo, monograms, etc.)
 * - Customer-supplied garments (DECG) and caps (DECC)
 *
 * @version 1.9.1 - Added visible error handling for DECG API failures (CLAUDE.md rule #4)
 * @date 2026-02-04
 */

class ShopWorksImportParser {
    constructor() {
        // API endpoint for service codes
        this.API_BASE_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API?.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // Track if service codes have been loaded from API
        this.serviceCodesLoaded = false;
        this.serviceCodesData = [];

        // DECG pricing from /api/decg-pricing (new 2026-02 API)
        this.decgApiPricing = null;
        this.decgApiLoaded = false;
        this.decgApiFailed = false;  // Track if API call failed (for error display)

        // Size mapping from ShopWorks to quote builder format
        // Includes short forms extracted from part number suffixes (e.g., _4X → '4X' → '4XL')
        this.SIZE_MAP = {
            'XS': 'XS',
            'S': 'S',
            'SM': 'S',
            'MD': 'M',
            'M': 'M',
            'LG': 'L',
            'L': 'L',
            'XL': 'XL',
            'XXL': '2XL',
            '2XL': '2XL',
            '2X': '2XL',       // From _2X suffix extraction
            'XXXL': '3XL',
            '3XL': '3XL',
            '3X': '3XL',       // From _3X suffix extraction
            '4XL': '4XL',
            '4X': '4XL',       // From _4X suffix extraction (103 real occurrences)
            'XXXXL': '4XL',
            '5XL': '5XL',
            '5X': '5XL',       // From _5X suffix extraction
            'XXXXXL': '5XL',
            '6XL': '6XL',
            '6X': '6XL',       // From _6X suffix extraction
            // OSFA/One Size
            'OSFA': 'OSFA',
            'O/S': 'OSFA',
            'ONE SIZE': 'OSFA',
            // Size ranges (caps)
            'S/M': 'S/M',
            'SM/MD': 'S/M',    // From _SM/MD suffix (Richardson caps)
            'M/L': 'M/L',      // From _M/L suffix (New Era, Nike caps)
            'L/XL': 'L/XL',
            'LG/XL': 'L/XL',   // From _LG/XL suffix (Richardson caps)
            // Extra small
            'XXS': 'XXS',
            '2XS': 'XXS',      // Alternate notation for XXS
            // Tall sizes
            'LT': 'LT',
            'MT': 'MT',        // Medium Tall
            'ST': 'ST',        // Small Tall
            'XST': 'XST',     // Extra Small Tall
            'XLT': 'XLT',
            '2XLT': '2XLT',
            '3XLT': '3XLT',
            '4XLT': '4XLT',
            '5XLT': '5XLT',
            // Infant/toddler sizes
            '06M': '06M',
            '12M': '12M',
            '18M': '18M',
            '24M': '24M',
            'NB': 'NB',
            '2T': '2T',
            '3T': '3T',
            '4T': '4T',
            '5T': '5T'
        };

        // DECG (Customer-Supplied Garments) pricing tiers - FALLBACK if API unavailable
        this.DECG_TIERS = {
            '1-2': 45.00,
            '3-5': 40.00,
            '6-11': 38.00,
            '12-23': 32.00,
            '24-71': 30.00,
            '72-143': 25.00,
            '144+': 15.00
        };

        // DECC (Customer-Supplied Caps) pricing tiers - FALLBACK if API unavailable
        this.DECC_TIERS = {
            '1-2': 36.00,
            '3-5': 32.00,
            '6-11': 30.00,
            '12-23': 25.00,
            '24-71': 24.00,
            '72-143': 20.00,
            '144+': 12.00
        };

        // Service code aliases for typo handling (kept in code per Erik's decision)
        // Must stay in sync with caspio-pricing-proxy/src/routes/service-codes.js
        // Updated 2026-02-03: Added COLOR CHG from order classification analysis
        this.SERVICE_CODE_ALIASES = {
            'AONOGRAM': 'MONOGRAM',    // Common typo
            'NNAME': 'NAME',           // Common typo
            'NNAMES': 'NAME',          // Common typo
            'NAMES': 'MONOGRAM',       // Plural "names" = monogramming
            'EJB': 'FB',               // Legacy code for Embroidered Jacket Back
            'FLAG': 'AL',              // Legacy code
            'SETUP': 'GRT-50',         // Shorthand for setup fee
            'SETUP FEE': 'DD',         // Maps to digitizing setup
            'DESIGN PREP': 'GRT-75',   // Shorthand for design/graphic fee
            'EXCESS STITCH': 'AS-GARM', // Additional stitches (garment)
            'SECC': 'DECC',            // Typo for DECC (customer-supplied caps)
            'SEW': 'SEG',              // Alias Sew → SEG (sewing)
            'COLOR CHG': 'COLOR CHANGE' // Typo for color change service
        };

        // Invalid part numbers to skip
        this.INVALID_PARTS = [
            'WEIGHT', 'GIFT CODE', 'DISCOUNT', 'FREIGHT', 'TEST',
            'SPSU', 'SHIPPING', 'TAX', 'TOTAL'
        ];

        // Non-SanMar product patterns (require manual pricing)
        this.NON_SANMAR_PATTERNS = [
            /^MCK\d{5}/,      // Cutter & Buck
            /^MQK\d{5}/,      // Unknown vendor polos
            /^470CB$/,        // Specific cap
            /^PTS\d+$/,       // Richardson fitted caps
            /^110$/,          // Richardson R-Flex
            /^112P$/,         // Richardson Printed
            /^511$/,          // Acrylic-Wool cap
            /^J26\d{3}$/,     // Safety jackets
            /^7007$/,         // Safety vest
            /^8001$/,         // Safety bomber
            /^STK-/           // Stickers (non-apparel)
        ];

        this.CAP_DISCOUNT = 0.20;           // -20% for caps (loaded from API if available)
        this.HEAVYWEIGHT_SURCHARGE = 10.00;  // +$10 for heavyweight (loaded from API if available)
        this.LTM_THRESHOLD = 24;             // Less Than Minimum threshold
        this.LTM_FEE = 50.00;                // LTM fee amount (fallback)
        this.GRT75_RATE = 75.00;             // GRT-75 hourly rate (loaded from API if available)

        // Monogram/Names pricing (fallback)
        this.MONOGRAM_PRICE = 12.50;

        // Known service item patterns
        this.DIGITIZING_CODES = ['DD', 'DGT-001', 'DGT-002', 'DGT-003'];
        this.PATCH_SETUP_CODES = ['GRT-50'];
        this.GRAPHIC_DESIGN_CODES = ['GRT-75'];

        // Part number suffixes to strip
        // Validated against 6,218 real order lines + 15,200 ShopWorks product catalog entries
        this.SIZE_SUFFIXES = [
            // Extended sizes — full forms (ShopWorks product catalog format)
            '_2XL', '_3XL', '_4XL', '_5XL', '_6XL', '_XXXL',
            // Extended sizes — short forms (order text export format)
            '_2X', '_3X', '_4X', '_5X', '_6X', '_XXL',
            // Extra small
            '_XXS', '_2XS', '_XS',
            // Tall sizes (longer suffixes first)
            '_2XLT', '_3XLT', '_4XLT', '_5XLT', '_XLT', '_XST', '_LT', '_MT', '_ST',
            // One size / size ranges
            '_OSFA', '_SM/MD', '_LG/XL', '_S/M', '_M/L', '_L/XL',
            // Infant / toddler
            '_24M', '_18M', '_12M', '_06M', '_NB', '_2T', '_3T', '_4T', '_5T'
        ];
    }

    /**
     * Load service codes from Caspio API
     * Call this before parsing to get current pricing
     * Also loads DECG pricing from dedicated endpoint
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async loadServiceCodes() {
        if (this.serviceCodesLoaded) {
            console.log('[ShopWorksImportParser] Service codes already loaded');
            return true;
        }

        // Load both service codes and DECG pricing in parallel
        const results = await Promise.allSettled([
            this._loadServiceCodesInternal(),
            this.loadDECGPricing()
        ]);

        // Check if service codes loaded
        const serviceCodesOk = results[0].status === 'fulfilled' && results[0].value === true;
        const decgPricingOk = results[1].status === 'fulfilled' && results[1].value === true;

        console.log(`[ShopWorksImportParser] Loading complete - Service codes: ${serviceCodesOk ? 'OK' : 'FALLBACK'}, DECG pricing: ${decgPricingOk ? 'OK' : 'FALLBACK'}`);

        return serviceCodesOk;
    }

    /**
     * Internal helper to load service codes
     * @private
     */
    async _loadServiceCodesInternal() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/service-codes`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                this.serviceCodesData = data.data;
                this._buildPricingTables();
                this.serviceCodesLoaded = true;
                console.log(`[ShopWorksImportParser] Loaded ${data.data.length} service codes from API`);
                return true;
            }
        } catch (error) {
            console.warn('[ShopWorksImportParser] Failed to load service codes from API, using fallback:', error.message);
        }

        return false;
    }

    /**
     * Build pricing lookup tables from API data
     * @private
     */
    _buildPricingTables() {
        // Build DECG tiers from API data
        const decgRecords = this.serviceCodesData.filter(sc => sc.ServiceCode === 'DECG');
        if (decgRecords.length > 0) {
            this.DECG_TIERS = {};
            for (const record of decgRecords) {
                if (record.TierLabel) {
                    this.DECG_TIERS[record.TierLabel] = record.SellPrice;
                }
            }
            console.log('[ShopWorksImportParser] Built DECG tiers from API:', Object.keys(this.DECG_TIERS).length);
        }

        // Build DECC tiers from API data
        const deccRecords = this.serviceCodesData.filter(sc => sc.ServiceCode === 'DECC');
        if (deccRecords.length > 0) {
            this.DECC_TIERS = {};
            for (const record of deccRecords) {
                if (record.TierLabel) {
                    this.DECC_TIERS[record.TierLabel] = record.SellPrice;
                }
            }
            console.log('[ShopWorksImportParser] Built DECC tiers from API:', Object.keys(this.DECC_TIERS).length);
        }

        // Get Monogram price from API
        const monogramRecord = this.serviceCodesData.find(sc =>
            sc.ServiceCode === 'Monogram' || sc.ServiceCode === 'Name'
        );
        if (monogramRecord && monogramRecord.SellPrice) {
            this.MONOGRAM_PRICE = monogramRecord.SellPrice;
            console.log('[ShopWorksImportParser] Monogram price from API:', this.MONOGRAM_PRICE);
        }

        // Get LTM fee from API
        const ltmRecord = this.serviceCodesData.find(sc => sc.ServiceCode === 'LTM');
        if (ltmRecord && ltmRecord.SellPrice) {
            this.LTM_FEE = ltmRecord.SellPrice;
            console.log('[ShopWorksImportParser] LTM fee from API:', this.LTM_FEE);
        }

        // Get CAP_DISCOUNT from API (2026-02-01 pricing audit)
        const capDiscountRecord = this.serviceCodesData.find(sc => sc.ServiceCode === 'CAP-DISCOUNT');
        if (capDiscountRecord && capDiscountRecord.SellPrice) {
            this.CAP_DISCOUNT = capDiscountRecord.SellPrice;
            console.log('[ShopWorksImportParser] CAP_DISCOUNT from API:', this.CAP_DISCOUNT);
        }

        // Get HEAVYWEIGHT_SURCHARGE from API (2026-02-01 pricing audit)
        const heavyRecord = this.serviceCodesData.find(sc => sc.ServiceCode === 'HEAVYWEIGHT-SURCHARGE');
        if (heavyRecord && heavyRecord.SellPrice) {
            this.HEAVYWEIGHT_SURCHARGE = heavyRecord.SellPrice;
            console.log('[ShopWorksImportParser] HEAVYWEIGHT_SURCHARGE from API:', this.HEAVYWEIGHT_SURCHARGE);
        }

        // Get GRT-75 rate from API (2026-02-01 pricing audit)
        const grt75Record = this.serviceCodesData.find(sc => sc.ServiceCode === 'GRT-75');
        if (grt75Record && grt75Record.SellPrice) {
            this.GRT75_RATE = grt75Record.SellPrice;
            console.log('[ShopWorksImportParser] GRT75_RATE from API:', this.GRT75_RATE);
        }
    }

    /**
     * Load DECG/DECC pricing from dedicated /api/decg-pricing endpoint
     * This provides accurate tier-based pricing matching the DECG calculator
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async loadDECGPricing() {
        if (this.decgApiLoaded) {
            console.log('[ShopWorksImportParser] DECG API pricing already loaded');
            return true;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/api/decg-pricing`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.decgApiPricing = data;
            this.decgApiLoaded = true;

            // Update internal tier tables from API data for consistency
            if (data.garments && data.garments.basePrices) {
                this.DECG_TIERS_API = data.garments.basePrices;
                this.DECG_UPCHARGE = data.garments.perThousandUpcharge || 1.25;
                this.DECG_LTM_FEE = data.garments.ltmFee || 50.00;
                this.DECG_LTM_THRESHOLD = data.garments.ltmThreshold || 7;
                console.log('[ShopWorksImportParser] DECG garment tiers from API:', Object.keys(this.DECG_TIERS_API).length);
            }

            if (data.caps && data.caps.basePrices) {
                this.DECC_TIERS_API = data.caps.basePrices;
                this.DECC_UPCHARGE = data.caps.perThousandUpcharge || 1.00;
                this.DECC_LTM_FEE = data.caps.ltmFee || 50.00;
                this.DECC_LTM_THRESHOLD = data.caps.ltmThreshold || 7;
                console.log('[ShopWorksImportParser] DECC cap tiers from API:', Object.keys(this.DECC_TIERS_API).length);
            }

            if (data.heavyweightSurcharge) {
                this.HEAVYWEIGHT_SURCHARGE = data.heavyweightSurcharge;
            }

            console.log('[ShopWorksImportParser] DECG API pricing loaded successfully');
            this.decgApiFailed = false;
            return true;
        } catch (error) {
            console.warn('[ShopWorksImportParser] Failed to load DECG API pricing, using fallback:', error.message);
            this.decgApiFailed = true;  // Track failure for error display
            return false;
        }
    }

    /**
     * Check if DECG API failed and fallback pricing is being used
     * @returns {boolean} True if DECG API failed
     */
    isDECGApiUsingFallback() {
        return this.decgApiFailed || !this.decgApiLoaded;
    }

    /**
     * Get DECG tier label from quantity (embroidery tier structure)
     * Tiers: 1-7 (LTM), 8-23, 24-47, 48-71, 72+
     * @param {number} quantity - Number of pieces
     * @returns {string} Tier label
     */
    getDECGTier(quantity) {
        if (quantity <= 7) return '1-7';
        if (quantity <= 23) return '8-23';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    /**
     * Get service code data by code name
     * @param {string} code - Service code (e.g., 'DGT-001', 'AL', 'DECG')
     * @returns {Array} Matching service code records
     */
    getServiceCode(code) {
        if (!this.serviceCodesLoaded || !code) return [];
        return this.serviceCodesData.filter(sc =>
            sc.ServiceCode && sc.ServiceCode.toUpperCase() === code.toUpperCase()
        );
    }

    /**
     * Get tier pricing for a tiered service code
     * @param {string} code - Service code (e.g., 'AL', 'DECG', 'DECC')
     * @param {number} quantity - Quantity to price
     * @returns {Object|null} Matching tier record or null
     */
    getTierPricing(code, quantity) {
        const tiers = this.getServiceCode(code).filter(sc => sc.PricingMethod === 'TIERED');
        if (tiers.length === 0) return null;

        for (const tier of tiers) {
            const label = tier.TierLabel;
            if (!label) continue;

            if (label.endsWith('+')) {
                const min = parseInt(label.replace('+', ''));
                if (quantity >= min) return tier;
            } else if (label.includes('-')) {
                const [min, max] = label.split('-').map(n => parseInt(n));
                if (quantity >= min && quantity <= max) return tier;
            }
        }

        // Fallback to highest tier
        return tiers[tiers.length - 1];
    }

    /**
     * Parse ShopWorks order text into structured data
     * @param {string} text - Raw text from ShopWorks order
     * @returns {Object} Parsed order data
     */
    parse(text) {
        const result = {
            orderId: null,
            customer: {
                customerId: null,
                company: null,
                contactName: null,
                email: null
            },
            salesRep: {
                name: null,
                email: null
            },
            products: [],           // SanMar products to look up
            customProducts: [],     // Non-SanMar products (need manual pricing)
            decgItems: [],          // Customer-supplied garments
            services: {
                digitizing: false,
                digitizingCount: 0,
                additionalLogo: null,    // { position, quantity }
                monograms: [],           // { quantity, description }
                rush: null,              // { amount }
                artCharges: null,        // { amount }
                patchSetup: false,
                graphicDesign: null      // { hours, amount }
            },
            notes: [],              // Comment rows
            warnings: [],           // Import warnings
            rawItems: [],           // All parsed items for debugging
            pricingSource: this.serviceCodesLoaded ? 'caspio' : 'fallback'
        };

        // Split into sections by the asterisk divider
        const sections = text.split(/\*{10,}/);

        // Parse each section
        for (const section of sections) {
            const trimmed = section.trim();
            if (!trimmed) continue;

            // Check section type and parse accordingly
            if (trimmed.includes('Order #:')) {
                this._parseOrderHeader(trimmed, result);
            } else if (trimmed.includes('Customer #:') || trimmed.includes('Company:')) {
                this._parseCompanyInfo(trimmed, result);
            } else if (trimmed.includes('Ordered by:') || trimmed.includes('Order Information')) {
                this._parseOrderInfo(trimmed, result);
            } else if (trimmed.includes('Items Purchased') || trimmed.includes('Part Number:')) {
                this._parseItems(trimmed, result);
            }
        }

        // After all section parsing, if no customer email found, try regex fallback
        if (!result.customer.email) {
            result.customer.email = this._extractEmailFallback(text, result.salesRep.email);
        }

        // Debug logging for email extraction
        console.log('[ShopWorksImportParser] Extracted customer email:', result.customer.email || 'NOT FOUND');
        console.log('[ShopWorksImportParser] Extracted customer name:', result.customer.contactName || 'NOT FOUND');

        // Add warning if DECG API failed and order has DECG items (per CLAUDE.md rule #4)
        if (this.isDECGApiUsingFallback() && result.decgItems.length > 0) {
            result.warnings.push('DECG API unavailable - using fallback pricing. Verify DECG prices before sending quote.');
            result.decgApiFailed = true;
        }

        return result;
    }

    /**
     * Fallback email extraction using regex patterns
     * Searches for email patterns near customer-related keywords
     * @param {string} text - Full order text
     * @param {string} salesRepEmail - Salesperson email to exclude
     * @returns {string|null} Extracted email or null
     */
    _extractEmailFallback(text, salesRepEmail) {
        // Email regex pattern
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        // Find all emails in the text
        const allEmails = text.match(emailPattern) || [];

        // Filter out salesperson email and common system emails
        const candidateEmails = allEmails.filter(email => {
            const lower = email.toLowerCase();
            // Exclude salesperson email
            if (salesRepEmail && lower === salesRepEmail.toLowerCase()) return false;
            // Exclude common system/company emails
            if (lower.includes('noreply') || lower.includes('no-reply')) return false;
            if (lower.includes('support@') || lower.includes('info@')) return false;
            if (lower.includes('orders@') || lower.includes('sales@')) return false;
            return true;
        });

        if (candidateEmails.length === 0) return null;

        // If only one candidate after filtering, use it
        if (candidateEmails.length === 1) {
            console.log('[ShopWorksImportParser] Email extracted via fallback (single candidate):', candidateEmails[0]);
            return candidateEmails[0];
        }

        // Look for email near customer-related keywords
        const customerKeywords = ['ordered by', 'contact', 'customer', 'bill to', 'ship to'];
        for (const keyword of customerKeywords) {
            const keywordIndex = text.toLowerCase().indexOf(keyword);
            if (keywordIndex !== -1) {
                // Look for email within 200 chars after the keyword
                const searchArea = text.substring(keywordIndex, keywordIndex + 200);
                const nearbyEmail = searchArea.match(emailPattern);
                if (nearbyEmail && nearbyEmail[0]) {
                    // Make sure it's not the sales rep email
                    if (!salesRepEmail || nearbyEmail[0].toLowerCase() !== salesRepEmail.toLowerCase()) {
                        console.log('[ShopWorksImportParser] Email extracted via fallback (near "' + keyword + '"):', nearbyEmail[0]);
                        return nearbyEmail[0];
                    }
                }
            }
        }

        // Last resort: return the first non-salesperson email that appears after the first email
        // (First email is usually salesperson, second is often customer)
        if (candidateEmails.length >= 1) {
            console.log('[ShopWorksImportParser] Email extracted via fallback (first candidate):', candidateEmails[0]);
            return candidateEmails[0];
        }

        return null;
    }

    /**
     * Parse order header section (Order #, Salesperson, Email)
     */
    _parseOrderHeader(text, result) {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('Order #:')) {
                result.orderId = trimmed.replace('Order #:', '').trim();
            } else if (trimmed.startsWith('Salesperson:')) {
                result.salesRep.name = trimmed.replace('Salesperson:', '').trim();
            } else if (trimmed.startsWith('Email:') && !result.salesRep.email) {
                // First Email in header is salesperson email
                result.salesRep.email = trimmed.replace('Email:', '').trim();
            }
        }
    }

    /**
     * Parse company/customer info section
     */
    _parseCompanyInfo(text, result) {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('Customer #:')) {
                result.customer.customerId = trimmed.replace('Customer #:', '').trim();
            } else if (trimmed.startsWith('Company:')) {
                result.customer.company = trimmed.replace('Company:', '').trim();
            }
        }
    }

    /**
     * Parse order information section (Ordered by, customer email)
     */
    _parseOrderInfo(text, result) {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('Ordered by:')) {
                result.customer.contactName = trimmed.replace('Ordered by:', '').trim();
            } else if (trimmed.startsWith('Email:')) {
                // This is the customer email (different from salesperson)
                result.customer.email = trimmed.replace('Email:', '').trim();
            }
        }
    }

    /**
     * Parse items purchased section
     */
    _parseItems(text, result) {
        // Split by "Item X of Y" pattern to get individual items
        const itemBlocks = text.split(/Item \d+ of \d+/);

        for (const block of itemBlocks) {
            if (!block.trim()) continue;

            const item = this._parseItemBlock(block);
            if (!item) continue;

            result.rawItems.push(item);

            // Classify and add to appropriate array
            this._classifyAndAddItem(item, result);
        }
    }

    /**
     * Parse a single item block
     */
    _parseItemBlock(block) {
        const lines = block.split('\n');
        const item = {
            partNumber: null,
            description: null,
            unitPrice: null,
            quantity: 0,
            sizes: {}
        };

        let inSizeSection = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('Part Number:')) {
                item.partNumber = trimmed.replace('Part Number:', '').trim();
            } else if (trimmed.startsWith('Description:')) {
                const fullDesc = trimmed.replace('Description:', '').trim();
                item.description = fullDesc;

                // Extract color from description
                // Format: "Product Name, Color Name" (e.g., "Sport-Tek Womens 1/4-Zip Sweatshirt, Athletic Hthr")
                item.color = this._extractColorFromDescription(fullDesc);
            } else if (trimmed.startsWith('Unit Price:')) {
                item.unitPrice = parseFloat(trimmed.replace('Unit Price:', '').trim()) || 0;
            } else if (trimmed.startsWith('Item Quantity:')) {
                item.quantity = parseInt(trimmed.replace('Item Quantity:', '').trim()) || 0;
            } else if (trimmed === 'Adult:Quantity' || trimmed === 'Youth:Quantity' || trimmed === 'Other:Quantity') {
                inSizeSection = true;
            } else if (inSizeSection && trimmed.includes(':')) {
                // Parse size:quantity pairs
                const [size, qty] = trimmed.split(':');
                const normalizedSize = this._normalizeSize(size.trim());
                const quantity = parseInt(qty.trim()) || 0;

                if (normalizedSize && quantity > 0) {
                    item.sizes[normalizedSize] = (item.sizes[normalizedSize] || 0) + quantity;
                }
            }
        }

        // Only return if we have a part number or it's a comment row
        if (item.partNumber || item.description) {
            // Extract size from part number suffix (handles LST253_XS, ST253_3X, etc.)
            // This must happen BEFORE returning, so consolidation has the sizes
            const extracted = this.extractSizeFromPartNumber(item.partNumber);
            if (extracted.size) {
                const normalizedSize = this._normalizeSize(extracted.size);
                if (normalizedSize && item.quantity > 0) {
                    // CLEAR sizes from size section - they're placeholders (e.g., "XXXL (Other):1")
                    // The real size comes from the part number suffix
                    item.sizes = {};
                    // Add the size from the suffix with the item quantity
                    item.sizes[normalizedSize] = item.quantity;
                    console.log(`[ShopWorksImportParser] Extracted size ${normalizedSize} (qty: ${item.quantity}) from part number ${item.partNumber}`);
                }
                // Clean the part number (remove the suffix)
                item.partNumber = extracted.cleanedPartNumber;
            }
            return item;
        }
        return null;
    }

    /**
     * Normalize size from ShopWorks to quote builder format
     * Note: Does NOT filter "(Other)" entries - that filtering happens in _parseItemBlock()
     * only when a size suffix is extracted from the part number
     */
    _normalizeSize(size) {
        if (!size) return null;

        // Clean "(Other)" suffix but don't filter - just extract the base size
        // The clearing of placeholder sizes happens in _parseItemBlock when a suffix is found
        const cleanSize = size.replace(/\s*\(Other\)\s*/i, '').toUpperCase().trim();

        // If nothing left after cleaning, return null
        if (!cleanSize) return null;

        return this.SIZE_MAP[cleanSize] || cleanSize;
    }

    /**
     * Classify an item and add to the appropriate result array
     */
    _classifyAndAddItem(item, result) {
        const type = this.classifyPartNumber(item.partNumber);

        switch (type) {
            case 'digitizing':
                result.services.digitizing = true;
                result.services.digitizingCount++;
                // Store digitizing code for proper fee lookup
                if (!result.services.digitizingCodes) {
                    result.services.digitizingCodes = [];
                }
                result.services.digitizingCodes.push(item.partNumber.toUpperCase());
                break;

            case 'patch-setup':
                result.services.patchSetup = true;
                break;

            case 'graphic-design':
                // GRT-75 rate from API (fallback to $75/hr)
                const hours = item.quantity || 1;
                result.services.graphicDesign = {
                    hours: hours,
                    amount: hours * (this.GRT75_RATE || 75)
                };
                break;

            case 'fb':
                // Full Back embroidery - treated as additional logo with specific position
                if (!result.services.additionalLogos) {
                    result.services.additionalLogos = [];
                }
                result.services.additionalLogos.push({
                    position: 'Full Back',
                    type: 'fb',
                    quantity: item.quantity,
                    description: item.description
                });
                break;

            case 'cb':
                // Cap Back embroidery - treated as additional logo
                if (!result.services.additionalLogos) {
                    result.services.additionalLogos = [];
                }
                result.services.additionalLogos.push({
                    position: 'Cap Back',
                    type: 'cb',
                    quantity: item.quantity,
                    description: item.description
                });
                break;

            case 'al':
                // Additional Logo - parse position from description
                const position = this._parseALPosition(item.description);
                // Support multiple additional logos
                if (!result.services.additionalLogos) {
                    result.services.additionalLogos = [];
                }
                result.services.additionalLogos.push({
                    position: position,
                    type: 'al',
                    quantity: item.quantity,
                    description: item.description
                });
                // Keep backward compatibility with single additionalLogo
                result.services.additionalLogo = {
                    position: position,
                    quantity: item.quantity,
                    description: item.description
                };
                break;

            case 'monogram':
                result.services.monograms.push({
                    quantity: item.quantity,
                    description: item.description,
                    unitPrice: this.MONOGRAM_PRICE,
                    total: item.quantity * this.MONOGRAM_PRICE
                });
                break;

            case 'rush':
                result.services.rush = {
                    amount: item.unitPrice * item.quantity,
                    description: item.description
                };
                break;

            case 'art':
                result.services.artCharges = {
                    amount: item.unitPrice * item.quantity,
                    description: item.description
                };
                break;

            case 'ltm':
                // Less Than Minimum fee
                result.services.ltmFee = {
                    amount: item.unitPrice * item.quantity || this.LTM_FEE,
                    description: item.description
                };
                break;

            case 'decg':
                // Customer-supplied garment - uses DECG API pricing with stitch count
                const isCapDecg = this._isCapFromDescription(item.description);
                const isHeavyweight = this._isHeavyweightFromDescription(item.description);
                // Default to 8K stitches - user can update via modal after import
                const decgStitchCount = 8000;
                const decgPricing = this.calculateDECGPrice(item.quantity, isCapDecg, isHeavyweight, decgStitchCount);

                result.decgItems.push({
                    ...item,
                    serviceType: 'decg',
                    isCap: isCapDecg,
                    isHeavyweight: isHeavyweight,
                    stitchCount: decgStitchCount,
                    calculatedUnitPrice: decgPricing.unitPrice,
                    ltmFee: decgPricing.ltmFee,
                    tier: decgPricing.tier,
                    pricingSource: decgPricing.pricingSource,
                    breakdown: decgPricing.breakdown,
                    needsStitchCountConfirmation: true  // Flag for post-import modal
                });
                break;

            case 'decc':
                // Customer-supplied caps (DECC/SECC) - uses DECG API pricing (caps table)
                // Default to 8K stitches - user can update via modal after import
                const deccStitchCount = 8000;
                const deccPricing = this.calculateDECCPrice(item.quantity, deccStitchCount);

                result.decgItems.push({
                    ...item,
                    serviceType: 'decc',
                    isCap: true,
                    isHeavyweight: false,
                    stitchCount: deccStitchCount,
                    calculatedUnitPrice: deccPricing.unitPrice,
                    ltmFee: deccPricing.ltmFee,
                    tier: deccPricing.tier,
                    pricingSource: deccPricing.pricingSource,
                    breakdown: deccPricing.breakdown,
                    needsStitchCountConfirmation: true  // Flag for post-import modal
                });
                break;

            case 'sewing':
                // Sewing service (SEG - Sew Emblems to Garments) - manual pricing
                if (!result.services.sewing) {
                    result.services.sewing = [];
                }
                result.services.sewing.push({
                    quantity: item.quantity,
                    description: item.description,
                    unitPrice: item.unitPrice || 0,
                    needsManualPricing: true
                });
                break;

            case 'cs':
                // Cap Side logo - same pricing as Cap Back
                if (!result.services.additionalLogos) {
                    result.services.additionalLogos = [];
                }
                result.services.additionalLogos.push({
                    position: 'Cap Side',
                    type: 'cs',
                    quantity: item.quantity,
                    description: item.description
                });
                break;

            case 'additional-stitches':
                // Additional stitches (AS-Garm or AS-CAP) - manual pricing
                if (!result.services.additionalStitches) {
                    result.services.additionalStitches = [];
                }
                const stitchType = item.partNumber.toUpperCase().includes('CAP') ? 'cap' : 'garment';
                result.services.additionalStitches.push({
                    type: stitchType,
                    quantity: item.quantity,
                    description: item.description,
                    unitPrice: item.unitPrice || 0,
                    needsManualPricing: true
                });
                break;

            case 'invalid':
                // Invalid/skipped items - add to warnings
                result.warnings.push(`Skipped invalid item: ${item.partNumber}`);
                break;

            case 'comment':
                // Note/comment row
                if (item.description) {
                    result.notes.push(item.description);
                }
                break;

            case 'product':
            default:
                // Regular product - check if non-SanMar first
                const cleanedPartNumber = this.cleanPartNumber(item.partNumber);
                const isNonSanMar = this._isNonSanMarProduct(cleanedPartNumber);

                if (isNonSanMar) {
                    // Non-SanMar product - requires manual pricing
                    result.customProducts.push({
                        ...item,
                        originalPartNumber: item.partNumber,
                        partNumber: cleanedPartNumber,
                        needsManualPricing: true,
                        reason: 'Non-SanMar product'
                    });
                } else {
                    // Regular product - try SanMar lookup
                    result.products.push({
                        ...item,
                        originalPartNumber: item.partNumber,
                        partNumber: cleanedPartNumber,
                        needsLookup: true
                    });
                }
                break;
        }
    }

    /**
     * Check if a part number matches non-SanMar patterns
     * @param {string} partNumber - Cleaned part number
     * @returns {boolean} True if this is a known non-SanMar product
     */
    _isNonSanMarProduct(partNumber) {
        if (!partNumber) return false;
        const pn = partNumber.toUpperCase();
        return this.NON_SANMAR_PATTERNS.some(pattern => pattern.test(pn));
    }

    /**
     * Classify a part number by type
     * @param {string} partNumber - The part number to classify
     * @returns {string} Type: 'product', 'digitizing', 'decg', 'decc', 'al', 'fb', 'cb', 'monogram', 'rush', 'art', 'patch-setup', 'graphic-design', 'setup-fee', 'ltm', 'invalid', 'comment'
     */
    classifyPartNumber(partNumber) {
        if (!partNumber || partNumber.trim() === '') {
            return 'comment';
        }

        let pn = partNumber.toUpperCase().trim();

        // Check for invalid part numbers first
        if (this.INVALID_PARTS.includes(pn) || /^\d+\.\d{2}\s*$/.test(pn)) {
            return 'invalid';
        }

        // Apply aliases (typo correction)
        if (this.SERVICE_CODE_ALIASES[pn]) {
            pn = this.SERVICE_CODE_ALIASES[pn];
        }

        // Digitizing/Setup fees (DD or any DGT-XXX code)
        if (pn === 'DD' || pn.startsWith('DGT-')) {
            return 'digitizing';
        }

        // Patch setup
        if (pn === 'GRT-50') {
            return 'patch-setup';
        }

        // Graphic design
        if (pn === 'GRT-75') {
            return 'graphic-design';
        }

        // Full Back embroidery (large back design)
        if (pn === 'FB') {
            return 'fb';
        }

        // Cap Back embroidery
        if (pn === 'CB') {
            return 'cb';
        }

        // Additional Logo (standard positions)
        if (pn === 'AL') {
            return 'al';
        }

        // Customer-supplied garments
        if (pn === 'DECG') {
            return 'decg';
        }

        // Customer-supplied caps
        if (pn === 'DECC' || pn === 'SECC') {
            return 'decc';
        }

        // Monogram/Names (includes typo variants via aliases)
        if (pn === 'MONOGRAM' || pn === 'NAME' || pn === 'NAMES') {
            return 'monogram';
        }

        // Rush charge
        if (pn === 'RUSH') {
            return 'rush';
        }

        // Art charges
        if (pn === 'ART' || pn === 'ART-CHARGE') {
            return 'art';
        }

        // LTM (Less Than Minimum) fee
        if (pn === 'LTM') {
            return 'ltm';
        }

        // Sewing services (SEG = Sew Emblems to Garments)
        if (pn === 'SEG') {
            return 'sewing';
        }

        // Cap Side logo (same pricing as Cap Back)
        if (pn === 'CS') {
            return 'cs';
        }

        // Additional stitches (garment or cap) - manual pricing
        if (pn === 'AS-GARM' || pn === 'AS-CAP') {
            return 'additional-stitches';
        }

        // Everything else is a product
        return 'product';
    }

    /**
     * Clean a part number by stripping size suffixes
     * @param {string} partNumber - The part number to clean
     * @returns {string} Cleaned part number
     */
    cleanPartNumber(partNumber) {
        if (!partNumber) return '';

        let cleaned = partNumber.toUpperCase().trim();

        // Strip size suffixes
        for (const suffix of this.SIZE_SUFFIXES) {
            if (cleaned.endsWith(suffix.toUpperCase())) {
                cleaned = cleaned.slice(0, -suffix.length);
                break;
            }
        }

        return cleaned;
    }

    /**
     * Extract size from part number suffix (e.g., LST253_XS → {size: 'XS', cleanedPartNumber: 'LST253'})
     * This handles ShopWorks SKUs where size is embedded in part number rather than size fields
     * @param {string} partNumber - Original part number
     * @returns {Object} { size: string|null, cleanedPartNumber: string }
     */
    extractSizeFromPartNumber(partNumber) {
        if (!partNumber) return { size: null, cleanedPartNumber: '' };

        let cleaned = partNumber.toUpperCase().trim();
        let extractedSize = null;

        for (const suffix of this.SIZE_SUFFIXES) {
            if (cleaned.endsWith(suffix.toUpperCase())) {
                // Extract size from suffix (remove leading underscore)
                extractedSize = suffix.substring(1).toUpperCase();
                // Clean the part number
                cleaned = cleaned.slice(0, -suffix.length);
                break;
            }
        }

        return {
            size: extractedSize,
            cleanedPartNumber: cleaned
        };
    }

    /**
     * Parse Additional Logo position from description or part number
     * @param {string} description - Item description
     * @param {string} partNumber - Optional part number for direct position codes
     * @returns {string} Position name
     */
    _parseALPosition(description, partNumber = null) {
        // Check part number for direct position codes
        if (partNumber) {
            const pn = partNumber.toUpperCase().trim();
            if (pn === 'FB' || pn === 'EJB') return 'Full Back';
            if (pn === 'CB') return 'Cap Back';
            if (pn === 'FLAG') return 'Left Chest';  // Default for FLAG
        }

        if (!description) return 'Additional Location';

        const desc = description.toLowerCase();

        // Common positions - check most specific first
        if (desc.includes('full back')) return 'Full Back';
        if (desc.includes('left sleeve')) return 'Left Sleeve';
        if (desc.includes('right sleeve')) return 'Right Sleeve';
        if (desc.includes('left chest')) return 'Left Chest';
        if (desc.includes('right chest')) return 'Right Chest';
        if (desc.includes('back yoke')) return 'Back Yoke';
        if (desc.includes('center back')) return 'Center Back';
        if (desc.includes('jacket back')) return 'Full Back';
        if (desc.includes('back')) return 'Back';
        if (desc.includes('cap back')) return 'Cap Back';
        if (desc.includes('cap left')) return 'Cap Left';
        if (desc.includes('cap right')) return 'Cap Right';
        if (desc.includes('front')) return 'Front';

        return 'Additional Location';
    }

    /**
     * Check if description indicates a cap
     */
    _isCapFromDescription(description) {
        if (!description) return false;
        const desc = description.toLowerCase();
        return desc.includes('cap') || desc.includes('hat') || desc.includes('beanie');
    }

    /**
     * Check if description indicates heavyweight garment
     */
    _isHeavyweightFromDescription(description) {
        if (!description) return false;
        const desc = description.toLowerCase();
        return desc.includes('heavyweight') || desc.includes('heavy weight') ||
               desc.includes('hoodie') || desc.includes('sweatshirt') ||
               desc.includes('jacket') || desc.includes('fleece');
    }

    /**
     * Extract color from description
     * Format: "Product Name, Color Name" (e.g., "Sport-Tek Womens 1/4-Zip Sweatshirt, Athletic Hthr")
     * @param {string} description - Full description text
     * @returns {string|null} Extracted color or null
     */
    _extractColorFromDescription(description) {
        if (!description) return null;

        // Pattern: "Product Name, Color" (most common in ShopWorks)
        const commaIndex = description.lastIndexOf(',');
        if (commaIndex > 0 && commaIndex < description.length - 1) {
            return description.substring(commaIndex + 1).trim();
        }

        return null;
    }

    /**
     * Calculate DECG pricing based on quantity, stitch count, and modifiers
     * Uses /api/decg-pricing tiers (2026 embroidery structure: 1-7, 8-23, 24-47, 48-71, 72+)
     *
     * @param {number} quantity - Number of garments
     * @param {boolean} isCap - Is this a cap? (ignored, use calculateDECCPrice for caps)
     * @param {boolean} isHeavyweight - Is this a heavyweight garment?
     * @param {number} stitchCount - Stitch count (default 8000)
     * @returns {Object} { unitPrice, ltmFee, tier, stitchCount, pricingSource }
     */
    calculateDECGPrice(quantity, isCap = false, isHeavyweight = false, stitchCount = 8000) {
        const tier = this.getDECGTier(quantity);

        // Use API pricing if available, otherwise fall back to legacy tiers
        let basePrice = 0;
        let upchargeRate = this.DECG_UPCHARGE || 1.25;
        let ltmFee = 0;
        let ltmThreshold = this.DECG_LTM_THRESHOLD || 7;
        let ltmFeeAmount = this.DECG_LTM_FEE || 50.00;
        let pricingSource = 'fallback';

        if (this.decgApiLoaded && this.DECG_TIERS_API && this.DECG_TIERS_API[tier] !== undefined) {
            // Use API pricing (new 2026 tiers)
            basePrice = this.DECG_TIERS_API[tier];
            pricingSource = 'decg-api';
        } else {
            // Fallback to legacy tiers (old structure, less accurate)
            if (quantity >= 144) basePrice = this.DECG_TIERS['144+'] || 15.00;
            else if (quantity >= 72) basePrice = this.DECG_TIERS['72-143'] || 25.00;
            else if (quantity >= 24) basePrice = this.DECG_TIERS['24-71'] || 30.00;
            else if (quantity >= 12) basePrice = this.DECG_TIERS['12-23'] || 32.00;
            else if (quantity >= 6) basePrice = this.DECG_TIERS['6-11'] || 38.00;
            else if (quantity >= 3) basePrice = this.DECG_TIERS['3-5'] || 40.00;
            else basePrice = this.DECG_TIERS['1-2'] || 45.00;
            pricingSource = 'fallback-legacy';
        }

        // Calculate extra stitch charge (above 8K base)
        const baseStitches = 8000;
        const extraK = Math.max(0, (stitchCount - baseStitches) / 1000);
        const extraCharge = extraK * upchargeRate;

        // Unit price = base + extra stitches
        let unitPrice = basePrice + extraCharge;

        // Apply heavyweight surcharge (not for caps)
        if (isHeavyweight && !isCap) {
            unitPrice += this.HEAVYWEIGHT_SURCHARGE || 10.00;
        }

        // Calculate LTM fee (embroidery uses ≤7 threshold)
        if (quantity <= ltmThreshold) {
            ltmFee = ltmFeeAmount;
        }

        console.log(`[ShopWorksImportParser] DECG calc: qty=${quantity}, tier=${tier}, stitches=${stitchCount}, base=$${basePrice}, extra=$${extraCharge.toFixed(2)}, unit=$${unitPrice.toFixed(2)}, LTM=$${ltmFee}, source=${pricingSource}`);

        return {
            unitPrice: parseFloat(unitPrice.toFixed(2)),
            ltmFee: ltmFee,
            tier: tier,
            stitchCount: stitchCount,
            totalPerPiece: parseFloat((unitPrice + (ltmFee / quantity)).toFixed(2)),
            pricingSource: pricingSource,
            breakdown: {
                basePrice: basePrice,
                extraStitches: extraK * 1000,
                upchargeRate: upchargeRate,
                extraCharge: parseFloat(extraCharge.toFixed(2)),
                heavyweightSurcharge: (isHeavyweight && !isCap) ? (this.HEAVYWEIGHT_SURCHARGE || 10.00) : 0
            }
        };
    }

    /**
     * Calculate DECC (customer-supplied cap) pricing based on quantity and stitch count
     * Uses /api/decg-pricing caps tiers (2026 structure: 1-7, 8-23, 24-47, 48-71, 72+)
     *
     * @param {number} quantity - Number of caps
     * @param {number} stitchCount - Stitch count (default 8000)
     * @returns {Object} { unitPrice, ltmFee, tier, stitchCount, pricingSource }
     */
    calculateDECCPrice(quantity, stitchCount = 8000) {
        const tier = this.getDECGTier(quantity);

        // Use API pricing if available, otherwise fall back to legacy tiers
        let basePrice = 0;
        let upchargeRate = this.DECC_UPCHARGE || 1.00;
        let ltmFee = 0;
        let ltmThreshold = this.DECC_LTM_THRESHOLD || 7;
        let ltmFeeAmount = this.DECC_LTM_FEE || 50.00;
        let pricingSource = 'fallback';

        if (this.decgApiLoaded && this.DECC_TIERS_API && this.DECC_TIERS_API[tier] !== undefined) {
            // Use API pricing (new 2026 tiers)
            basePrice = this.DECC_TIERS_API[tier];
            pricingSource = 'decg-api';
        } else {
            // Fallback to legacy tiers
            if (quantity >= 144) basePrice = this.DECC_TIERS['144+'] || 12.00;
            else if (quantity >= 72) basePrice = this.DECC_TIERS['72-143'] || 20.00;
            else if (quantity >= 24) basePrice = this.DECC_TIERS['24-71'] || 24.00;
            else if (quantity >= 12) basePrice = this.DECC_TIERS['12-23'] || 25.00;
            else if (quantity >= 6) basePrice = this.DECC_TIERS['6-11'] || 30.00;
            else if (quantity >= 3) basePrice = this.DECC_TIERS['3-5'] || 32.00;
            else basePrice = this.DECC_TIERS['1-2'] || 36.00;
            pricingSource = 'fallback-legacy';
        }

        // Calculate extra stitch charge (above 8K base)
        const baseStitches = 8000;
        const extraK = Math.max(0, (stitchCount - baseStitches) / 1000);
        const extraCharge = extraK * upchargeRate;

        // Unit price = base + extra stitches
        const unitPrice = basePrice + extraCharge;

        // Calculate LTM fee (embroidery uses ≤7 threshold)
        if (quantity <= ltmThreshold) {
            ltmFee = ltmFeeAmount;
        }

        console.log(`[ShopWorksImportParser] DECC calc: qty=${quantity}, tier=${tier}, stitches=${stitchCount}, base=$${basePrice}, extra=$${extraCharge.toFixed(2)}, unit=$${unitPrice.toFixed(2)}, LTM=$${ltmFee}, source=${pricingSource}`);

        return {
            unitPrice: parseFloat(unitPrice.toFixed(2)),
            ltmFee: ltmFee,
            tier: tier,
            stitchCount: stitchCount,
            totalPerPiece: parseFloat((unitPrice + (ltmFee / quantity)).toFixed(2)),
            pricingSource: pricingSource,
            breakdown: {
                basePrice: basePrice,
                extraStitches: extraK * 1000,
                upchargeRate: upchargeRate,
                extraCharge: parseFloat(extraCharge.toFixed(2))
            }
        };
    }

    /**
     * Consolidate products by partNumber + color, merging size quantities
     * This handles ShopWorks orders that split the same product into multiple items by size SKU
     * (e.g., ST253, ST253_2X, ST253_3X all become one ST253 row)
     * @param {Array} products - Array of parsed products
     * @returns {Array} Consolidated products with merged sizes
     */
    consolidateProducts(products) {
        const groups = {};

        for (const product of products) {
            // Key: cleaned partNumber + color (lowercase for consistency)
            const colorKey = (product.color || '').toLowerCase().trim();
            const key = `${product.partNumber}|${colorKey}`;

            if (!groups[key]) {
                // First occurrence - clone the product
                groups[key] = {
                    ...product,
                    sizes: { ...product.sizes },
                    quantity: 0  // Will recalculate from sizes
                };
            } else {
                // Merge sizes from duplicate entry
                for (const [size, qty] of Object.entries(product.sizes)) {
                    groups[key].sizes[size] = (groups[key].sizes[size] || 0) + qty;
                }
            }

            // Recalculate total quantity from sizes
            groups[key].quantity = Object.values(groups[key].sizes).reduce((sum, q) => sum + q, 0);
        }

        const consolidated = Object.values(groups);

        // Log consolidation results for debugging
        if (consolidated.length < products.length) {
            console.log(`[ShopWorksImportParser] Consolidated ${products.length} items → ${consolidated.length} products`);
        }

        return consolidated;
    }

    /**
     * Get a summary of parsed data for display
     * @param {Object} parseResult - Result from parse()
     * @returns {Object} Summary for UI display
     */
    getSummary(parseResult) {
        const totalProducts = parseResult.products.length;
        const totalDecg = parseResult.decgItems.length;
        const totalMonograms = parseResult.services.monograms.reduce((sum, m) => sum + m.quantity, 0);
        const totalAdditionalLogos = parseResult.services.additionalLogos?.length || 0;

        const services = [];
        if (parseResult.services.digitizing) {
            const codes = parseResult.services.digitizingCodes || [];
            services.push(`Digitizing (${codes.join(', ') || 'DD'})`);
        }
        if (parseResult.services.patchSetup) services.push('Patch Setup ($50)');
        if (parseResult.services.graphicDesign) {
            services.push(`Graphic Design ($${parseResult.services.graphicDesign.amount})`);
        }
        if (totalAdditionalLogos > 0) {
            const positions = parseResult.services.additionalLogos.map(al => al.position);
            services.push(`Additional Logo: ${positions.join(', ')}`);
        }
        if (parseResult.services.rush) services.push('Rush Fee');
        if (parseResult.services.artCharges) services.push('Art Charges');
        if (parseResult.services.ltmFee) services.push('LTM Fee');
        if (totalMonograms > 0) services.push(`Monograms (${totalMonograms})`);

        // Separate DECG and DECC counts
        const decgGarments = parseResult.decgItems.filter(d => d.serviceType === 'decg').length;
        const deccCaps = parseResult.decgItems.filter(d => d.serviceType === 'decc').length;

        return {
            orderId: parseResult.orderId,
            customer: parseResult.customer.company || parseResult.customer.contactName,
            salesRep: parseResult.salesRep.name,
            productCount: totalProducts,
            decgCount: decgGarments,
            deccCount: deccCaps,
            customProductCount: parseResult.customProducts.length,
            services: services,
            noteCount: parseResult.notes.length,
            warningCount: parseResult.warnings.length
        };
    }
}

// Export for use in quote builders (browser) and Node.js (testing)
if (typeof window !== 'undefined') {
    window.ShopWorksImportParser = ShopWorksImportParser;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopWorksImportParser;
}

console.log('[ShopWorksImportParser] Module loaded v1.9.1 - DECG/DECC pricing via /api/decg-pricing (+ visible error handling)');
