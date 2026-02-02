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
 * @version 1.8.0 - Loads CAP-DISCOUNT, HEAVYWEIGHT-SURCHARGE, GRT-75 from API
 * @date 2026-02-01
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

        // Size mapping from ShopWorks to quote builder format
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
            'XXXL': '3XL',
            '3XL': '3XL',
            '4XL': '4XL',
            'XXXXL': '4XL',
            '5XL': '5XL',
            'XXXXXL': '5XL',
            '6XL': '6XL',
            // OSFA/One Size
            'OSFA': 'OSFA',
            'O/S': 'OSFA',
            'ONE SIZE': 'OSFA',
            // Size ranges (caps)
            'S/M': 'S/M',
            'L/XL': 'L/XL',
            // Tall sizes
            'LT': 'LT',
            'XLT': 'XLT',
            '2XLT': '2XLT',
            '3XLT': '3XLT',
            '4XLT': '4XLT'
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
            'SEW': 'SEG'               // Alias Sew → SEG (sewing)
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
        this.SIZE_SUFFIXES = ['_2X', '_3X', '_4X', '_5X', '_6X', '_XS', '_LT', '_XLT', '_2XLT', '_3XLT', '_4XLT', '_OSFA', '_S/M', '_L/XL'];
    }

    /**
     * Load service codes from Caspio API
     * Call this before parsing to get current pricing
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async loadServiceCodes() {
        if (this.serviceCodesLoaded) {
            console.log('[ShopWorksImportParser] Service codes already loaded');
            return true;
        }

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
                // Customer-supplied garment
                const isCapDecg = this._isCapFromDescription(item.description);
                const isHeavyweight = this._isHeavyweightFromDescription(item.description);
                const decgPricing = this.calculateDECGPrice(item.quantity, isCapDecg, isHeavyweight);

                result.decgItems.push({
                    ...item,
                    serviceType: 'decg',
                    isCap: isCapDecg,
                    isHeavyweight: isHeavyweight,
                    calculatedUnitPrice: decgPricing.unitPrice,
                    ltmFee: decgPricing.ltmFee
                });
                break;

            case 'decc':
                // Customer-supplied caps (DECC/SECC)
                const deccPricing = this.calculateDECCPrice(item.quantity);

                result.decgItems.push({
                    ...item,
                    serviceType: 'decc',
                    isCap: true,
                    isHeavyweight: false,
                    calculatedUnitPrice: deccPricing.unitPrice,
                    ltmFee: deccPricing.ltmFee
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
     * Calculate DECG pricing based on quantity and modifiers
     * @param {number} quantity - Number of garments
     * @param {boolean} isCap - Is this a cap?
     * @param {boolean} isHeavyweight - Is this a heavyweight garment?
     * @returns {Object} { unitPrice, ltmFee }
     */
    calculateDECGPrice(quantity, isCap = false, isHeavyweight = false) {
        // Get base tier price
        let basePrice = 0;
        if (quantity >= 144) basePrice = this.DECG_TIERS['144+'];
        else if (quantity >= 72) basePrice = this.DECG_TIERS['72-143'];
        else if (quantity >= 24) basePrice = this.DECG_TIERS['24-71'];
        else if (quantity >= 12) basePrice = this.DECG_TIERS['12-23'];
        else if (quantity >= 6) basePrice = this.DECG_TIERS['6-11'];
        else if (quantity >= 3) basePrice = this.DECG_TIERS['3-5'];
        else basePrice = this.DECG_TIERS['1-2'];

        // Apply cap discount
        if (isCap) {
            basePrice = basePrice * (1 - this.CAP_DISCOUNT);
        }

        // Apply heavyweight surcharge
        if (isHeavyweight && !isCap) {
            basePrice += this.HEAVYWEIGHT_SURCHARGE;
        }

        // Calculate LTM fee
        let ltmFee = 0;
        if (quantity < this.LTM_THRESHOLD) {
            ltmFee = this.LTM_FEE;
        }

        return {
            unitPrice: basePrice,
            ltmFee: ltmFee,
            totalPerPiece: basePrice + (ltmFee / quantity)
        };
    }

    /**
     * Calculate DECC (customer-supplied cap) pricing based on quantity
     * Uses DECC_TIERS which are ~20% lower than DECG
     * @param {number} quantity - Number of caps
     * @returns {Object} { unitPrice, ltmFee }
     */
    calculateDECCPrice(quantity) {
        // Get tier price from DECC tiers
        let basePrice = 0;
        if (quantity >= 144) basePrice = this.DECC_TIERS['144+'];
        else if (quantity >= 72) basePrice = this.DECC_TIERS['72-143'];
        else if (quantity >= 24) basePrice = this.DECC_TIERS['24-71'];
        else if (quantity >= 12) basePrice = this.DECC_TIERS['12-23'];
        else if (quantity >= 6) basePrice = this.DECC_TIERS['6-11'];
        else if (quantity >= 3) basePrice = this.DECC_TIERS['3-5'];
        else basePrice = this.DECC_TIERS['1-2'];

        // Calculate LTM fee
        let ltmFee = 0;
        if (quantity < this.LTM_THRESHOLD) {
            ltmFee = this.LTM_FEE;
        }

        return {
            unitPrice: basePrice,
            ltmFee: ltmFee,
            totalPerPiece: basePrice + (ltmFee / quantity)
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

console.log('[ShopWorksImportParser] Module loaded v1.8.0 - API pricing for CAP-DISCOUNT, HEAVYWEIGHT-SURCHARGE, GRT-75');
