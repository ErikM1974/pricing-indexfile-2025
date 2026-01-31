/**
 * ShopWorks Import Parser
 *
 * Parses ShopWorks order text files and extracts:
 * - Customer information (company, contact, email)
 * - Sales rep info
 * - Products (SanMar and custom)
 * - Service items (digitizing, additional logo, monograms, etc.)
 * - Customer-supplied garments (DECG)
 *
 * @version 1.5.0 - Improved email extraction with fallback regex
 * @date 2026-01-31
 */

class ShopWorksImportParser {
    constructor() {
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

        // DECG (Customer-Supplied Garments) pricing tiers
        this.DECG_TIERS = {
            '1-2': 45.00,
            '3-5': 40.00,
            '6-11': 38.00,
            '12-23': 32.00,
            '24-71': 30.00,
            '72-143': 25.00,
            '144+': 15.00
        };

        this.CAP_DISCOUNT = 0.20;           // -20% for caps
        this.HEAVYWEIGHT_SURCHARGE = 10.00;  // +$10 for heavyweight
        this.LTM_THRESHOLD = 24;             // Less Than Minimum threshold
        this.LTM_FEE = 50.00;                // LTM fee amount

        // Monogram/Names pricing
        this.MONOGRAM_PRICE = 12.50;

        // Known service item patterns
        this.DIGITIZING_CODES = ['DD', 'DGT-001', 'DGT-002', 'DGT-003'];
        this.PATCH_SETUP_CODES = ['GRT-50'];
        this.GRAPHIC_DESIGN_CODES = ['GRT-75'];

        // Part number suffixes to strip
        this.SIZE_SUFFIXES = ['_2X', '_3X', '_4X', '_5X', '_6X', '_XS', '_LT', '_XLT', '_2XLT', '_3XLT', '_4XLT', '_OSFA', '_S/M', '_L/XL'];
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
            rawItems: []            // All parsed items for debugging
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
                break;

            case 'patch-setup':
                result.services.patchSetup = true;
                break;

            case 'graphic-design':
                // GRT-75 is $75/hr, parse hours from quantity or description
                const hours = item.quantity || 1;
                result.services.graphicDesign = {
                    hours: hours,
                    amount: hours * 75
                };
                break;

            case 'al':
                // Additional Logo - parse position from description
                const position = this._parseALPosition(item.description);
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

            case 'decg':
                // Customer-supplied garment
                const isCap = this._isCapFromDescription(item.description);
                const isHeavyweight = this._isHeavyweightFromDescription(item.description);
                const decgPricing = this.calculateDECGPrice(item.quantity, isCap, isHeavyweight);

                result.decgItems.push({
                    ...item,
                    isCap: isCap,
                    isHeavyweight: isHeavyweight,
                    calculatedUnitPrice: decgPricing.unitPrice,
                    ltmFee: decgPricing.ltmFee
                });
                break;

            case 'comment':
                // Note/comment row
                if (item.description) {
                    result.notes.push(item.description);
                }
                break;

            case 'product':
            default:
                // Regular product - try SanMar lookup
                // Part number already cleaned in _parseItemBlock if it had a size suffix
                // Still call cleanPartNumber for any edge cases, but it's likely already clean
                const cleanedPartNumber = this.cleanPartNumber(item.partNumber);
                result.products.push({
                    ...item,
                    originalPartNumber: item.partNumber,
                    partNumber: cleanedPartNumber,
                    needsLookup: true
                });
                break;
        }
    }

    /**
     * Classify a part number by type
     * @param {string} partNumber - The part number to classify
     * @returns {string} Type: 'product', 'digitizing', 'decg', 'al', 'monogram', 'rush', 'art', 'patch-setup', 'graphic-design', 'comment'
     */
    classifyPartNumber(partNumber) {
        if (!partNumber || partNumber.trim() === '') {
            return 'comment';
        }

        const pn = partNumber.toUpperCase().trim();

        // Digitizing/Setup fees
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

        // Additional Logo
        if (pn === 'AL') {
            return 'al';
        }

        // Customer-supplied garments
        if (pn === 'DECG') {
            return 'decg';
        }

        // Monogram/Names
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
     * Parse Additional Logo position from description
     */
    _parseALPosition(description) {
        if (!description) return 'Additional Location';

        const desc = description.toLowerCase();

        // Common positions
        if (desc.includes('left sleeve')) return 'Left Sleeve';
        if (desc.includes('right sleeve')) return 'Right Sleeve';
        if (desc.includes('left chest')) return 'Left Chest';
        if (desc.includes('right chest')) return 'Right Chest';
        if (desc.includes('back yoke')) return 'Back Yoke';
        if (desc.includes('center back')) return 'Center Back';
        if (desc.includes('back')) return 'Back';
        if (desc.includes('cap back')) return 'Cap Back';
        if (desc.includes('cap left')) return 'Cap Left';
        if (desc.includes('cap right')) return 'Cap Right';

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

        const services = [];
        if (parseResult.services.digitizing) services.push('Digitizing');
        if (parseResult.services.patchSetup) services.push('Patch Setup');
        if (parseResult.services.additionalLogo) services.push('Additional Logo');
        if (parseResult.services.rush) services.push('Rush Fee');
        if (parseResult.services.artCharges) services.push('Art Charges');
        if (parseResult.services.graphicDesign) services.push('Graphic Design');
        if (totalMonograms > 0) services.push(`Monograms (${totalMonograms})`);

        return {
            orderId: parseResult.orderId,
            customer: parseResult.customer.company || parseResult.customer.contactName,
            salesRep: parseResult.salesRep.name,
            productCount: totalProducts,
            decgCount: totalDecg,
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

console.log('[ShopWorksImportParser] Module loaded v1.5.0');
