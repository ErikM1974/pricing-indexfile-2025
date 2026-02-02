/**
 * Known non-SanMar vendor patterns for embroidery order validation
 * Used to identify products from other vendors that need manual pricing lookup
 *
 * NOTE (Jan 2026): Many Richardson styles (112, 115, etc.) are now in SanMar's
 * catalog and included in SanMar Integration CSV. They will be classified as
 * SANMAR before reaching this vendor check. Only Richardson styles NOT in
 * SanMar will be caught here.
 */

const KNOWN_VENDORS = {
    // Richardson caps - NOTE: Most common styles (112, 115, etc.) are now in SanMar
    // This only catches Richardson styles NOT in the SanMar Integration CSV
    richardson: {
        name: 'Richardson',
        patterns: [
            /^Richardson/i         // Any starting with Richardson (not in SanMar)
        ],
        productType: 'caps'
    },

    // Safety vests and high-vis
    safety: {
        name: 'Safety/Hi-Vis',
        patterns: [
            /^7007$/i,             // Class 3 safety vest
            /^7008$/i,
            /^CSG300$/i,          // CornerStone safety
            /^CSV10[0-9]/i
        ],
        productType: 'safety'
    },

    // American Apparel / Bella Canvas (some AA styles remain)
    americanApparel: {
        name: 'American Apparel',
        patterns: [
            /^TR401(_\w+)?$/i,    // Track shirt
            /^TR408(_\w+)?$/i,    // Tri-blend
            /^2456W?(_\w+)?$/i    // Fine jersey
        ],
        productType: 'apparel'
    },

    // Carhartt accessories (not in SanMar bulk, but in special tables)
    carharttAccessories: {
        name: 'Carhartt Accessories',
        patterns: [
            /^CT89260209(_OSFA)?$/i,  // Carhartt beanie
            /^CTA18(_OSFA)?$/i,       // Carhartt watch cap
            /^CTA205(_OSFA)?$/i       // Carhartt bucket hat
        ],
        productType: 'accessories'
    },

    // Carhartt infant/toddler (CAR prefix with infant/toddler sizes)
    carharttInfant: {
        name: 'Carhartt Infant/Toddler',
        patterns: [
            /^CAR\d+[A-Z]+_(0[36]M|12M|18M|24M|2T|3T|4T|5T)$/i  // CAR78IZH_12M, CAR78TZH_4T
        ],
        productType: 'infant/toddler'
    },

    // Carhartt pants with waist/inseam (CT/CTB prefix with dimensions)
    carharttPants: {
        name: 'Carhartt Pants',
        patterns: [
            /^CT[B]?\d+_\d{4}$/i  // CT103574_3830, CTB151_4432
        ],
        productType: 'pants'
    },

    // Rabbit Skins / LAT infant apparel
    rabbitSkins: {
        name: 'Rabbit Skins/LAT',
        patterns: [
            /^RS\d+_(0[36]M|12M|18M|24M|2T|3T|4T|5T)$/i  // RS4400_06M, RS4400_12M
        ],
        productType: 'infant/toddler'
    },

    // Pacific Headwear
    pacificHeadwear: {
        name: 'Pacific Headwear',
        patterns: [
            /^104C(_OSFA)?$/i,
            /^404M(_OSFA)?$/i,
            /^P101(_OSFA)?$/i
        ],
        productType: 'caps'
    },

    // Flexfit
    flexfit: {
        name: 'Flexfit',
        patterns: [
            /^6277(_\w+)?$/i,     // Flexfit fitted
            /^6511(_\w+)?$/i,     // Flexfit trucker
            /^YP5089(_\w+)?$/i
        ],
        productType: 'caps'
    }
};

/**
 * Check if a part number matches a known non-SanMar vendor
 * @param {string} partNumber - The part number to check
 * @returns {{ vendor: string, productType: string } | null}
 */
function identifyNonSanmarVendor(partNumber) {
    if (!partNumber) return null;

    const normalized = partNumber.trim();

    for (const [vendorKey, vendorInfo] of Object.entries(KNOWN_VENDORS)) {
        for (const pattern of vendorInfo.patterns) {
            if (pattern.test(normalized)) {
                return {
                    vendor: vendorInfo.name,
                    productType: vendorInfo.productType
                };
            }
        }
    }

    return null;
}

/**
 * Get all known vendor names
 * @returns {string[]}
 */
function getKnownVendorNames() {
    return Object.values(KNOWN_VENDORS).map(v => v.name);
}

module.exports = {
    KNOWN_VENDORS,
    identifyNonSanmarVendor,
    getKnownVendorNames
};
