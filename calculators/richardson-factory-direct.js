// ============================================================================
// Richardson Factory Direct Pricing 2026
// Simple real-time pricing lookup (no quote building)
// ============================================================================

const RICHARDSON_API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Data initialization status
let richardsonDataInitialized = false;
let sanmarRichardsonStyles = [];

// Richardson cap data (will be filtered to remove SanMar overlap)
let capData = [
    { style: 'PTS20M', description: 'Pulse Mesh Back R-Flex', price: 8.75 },
    { style: 'PTS205', description: 'Pulse R-Flex', price: 9.50 },
    { style: 'PTS30S', description: 'Ignite LT R-Flex', price: 10.00 },
    { style: 'PTS50S', description: 'Matrix R-Flex', price: 10.00 },
    { style: 'PTS65', description: 'Surge Fitted', price: 10.75 },
    { style: 'R15', description: 'Solid Knit', price: 2.95 },
    { style: 'R18', description: 'Solid Beanie with Cuff', price: 4.00 },
    { style: 'R20', description: 'Microfleece Beanie', price: 4.50 },
    { style: 'R22', description: 'Microfleece Headband', price: 4.25 },
    { style: 'R45', description: 'Garment Washed Visor', price: 4.50 },
    { style: 'R55', description: 'Garment Washed Twill', price: 4.50 },
    { style: 'R65S', description: 'Relaxed Twill', price: 4.00 },
    { style: 'R75S', description: 'Casual Twill', price: 4.25 },
    { style: '110', description: 'R-Flex Trucker', price: 7.65 },
    { style: '111', description: 'Garment Washed Trucker', price: 6.75 },
    { style: '111P', description: 'Garment Washed Printed Trucker', price: 7.50 },
    { style: '111PT', description: 'Relaxed Printed Tactical Trucker', price: 9.00 },
    { style: '111T', description: 'Relaxed Tactical Trucker', price: 8.25 },
    { style: '112', description: 'Trucker Mesh Back', price: 6.50 },
    { style: '112FP', description: 'Five Panel Trucker', price: 6.50 },
    { style: '112FPC', description: 'Five Panel Champ Trucker', price: 6.50 },
    { style: '112FPR', description: 'Five Panel Trucker with Rope', price: 6.75 },
    { style: '112PT', description: 'Printed Tactical Trucker', price: 9.00 },
    { style: '112T', description: 'Tactical Trucker', price: 8.25 },
    { style: '112P', description: 'Printed Trucker', price: 7.75 },
    { style: '112PFP', description: 'Printed Five Panel Trucker', price: 7.75 },
    { style: '112PM', description: 'Printed Mesh Trucker', price: 7.75 },
    { style: '112+', description: 'R-Flex Adjustable Trucker', price: 8.00 },
    { style: '112RE', description: 'Recycled Trucker', price: 7.00 },
    { style: '112WF', description: 'Fremant - Workwear Trucker', price: 7.50 },
    { style: '112WH', description: 'Hawthorne Workwear Trucker', price: 9.50 },
    { style: '112LN', description: 'Linen Trucker', price: 7.50 },
    { style: '113', description: 'Foamie Trucker', price: 6.50 },
    { style: '115', description: 'Low Pro Trucker', price: 6.50 },
    { style: '115CH', description: 'Low Pro Heather Trucker', price: 7.75 },
    { style: '121', description: 'Fleece Beanie', price: 6.00 },
    { style: '126', description: 'Duck Camo Beanie', price: 9.50 },
    { style: '130', description: 'Marled Beanie', price: 5.75 },
    { style: '134', description: 'Striped Beanie', price: 7.75 },
    { style: '135', description: 'Short Pom Beanie', price: 7.75 },
    { style: '137', description: 'Heathered Beanie with Cuff', price: 4.50 },
    { style: '139RE', description: 'Recycled Knit', price: 8.50 },
    { style: '141', description: 'Chunk Twist Knit Beanie', price: 8.75 },
    { style: '143', description: 'Chunk Cable Beanie', price: 7.00 },
    { style: '145', description: 'Scrunch Beanie', price: 5.25 },
    { style: '146', description: 'Waffle Knit Beanie', price: 6.00 },
    { style: '147', description: 'Slouch Knit Beanie', price: 8.25 },
    { style: '148', description: 'Heathered Beanie w/ Pom', price: 6.00 },
    { style: '149', description: 'Super Slouch Knit Beanie', price: 12.00 },
    { style: '154', description: 'Merino Wool Knit', price: 9.50 },
    { style: '157', description: 'Speckled Knit', price: 8.75 },
    { style: '160', description: 'Lite Performance Visor', price: 8.75 },
    { style: '163', description: 'Laser Cut Five Panel Trucker', price: 7.25 },
    { style: '168', description: '7 Panel Trucker', price: 8.25 },
    { style: '168P', description: 'Printed 7 Panel Trucker', price: 9.50 },
    { style: '169', description: '7 Panel Performance Cap', price: 9.25 },
    { style: '172', description: 'Pulse Sportmesh R-Flex', price: 9.25 },
    { style: '173', description: 'Hood River Performance Trucker', price: 9.00 },
    { style: '176', description: 'Ignite LT Performance Cap', price: 8.25 },
    { style: '185', description: 'Twill R-Flex', price: 7.00 },
    { style: '203', description: 'Brushed Chino Twill', price: 5.75 },
    { style: '212', description: 'Pro Twill Snapback', price: 6.50 },
    { style: '213', description: 'Low Pro Foamie Trucker', price: 5.50 },
    { style: '214', description: 'Pro Twill Hook and Loop', price: 7.00 },
    { style: '217', description: 'Macieay 5 Panel Camper Cap', price: 7.50 },
    { style: '220', description: 'Relaxed Performance Lite', price: 7.75 },
    { style: '222', description: 'Airmesh Lite Trucker', price: 7.25 },
    { style: '224RE', description: 'Recycled Performance', price: 7.50 },
    { style: '225', description: 'Casual Performance Lite', price: 7.00 },
    { style: '252', description: 'Premium Cotton Dad Hat', price: 7.00 },
    { style: '252L', description: 'Premium Linen Dad Cap', price: 9.50 },
    { style: '253', description: 'Timberline Corduroy Cap', price: 8.25 },
    { style: '254RE', description: 'Ashland Relaxed Unstructured', price: 6.75 },
    { style: '255', description: 'Pinch Front Structured Snapback', price: 9.00 },
    { style: '256', description: 'Umpqua Gramps Cap', price: 9.25 },
    { style: '256P', description: 'Printed Umpqua Gramps Cap', price: 7.75 },
    { style: '257', description: '7 Panel Twill Strapback', price: 7.25 },
    { style: '258', description: '5 Panel Classic Rope Cap', price: 7.00 },
    { style: '262', description: 'Relaxed 6 Panel Snapback', price: 7.50 },
    { style: '309', description: 'Canvas Duck Cloth', price: 6.75 },
    { style: '312', description: 'Solid Twill Trucker', price: 6.00 },
    { style: '320T', description: 'Toddler Chino', price: 7.00 },
    { style: '323FPC', description: 'Full Fabric 5 Panel Champ', price: 6.25 },
    { style: '324', description: 'Pigment Dyed and Washed', price: 6.75 },
    { style: '324RE', description: 'Odell Garment Washed', price: 6.25 },
    { style: '326', description: 'Garment Washed Brushed Twill', price: 7.75 },
    { style: '336', description: 'Burnside Structured Brushed Canvas', price: 9.75 },
    { style: '355', description: 'Laser Perf Performance Rope Cap', price: 8.50 },
    { style: '380', description: 'Garment Dyed and Washed Twill', price: 7.50 },
    { style: '382', description: 'Snow Washed', price: 8.00 },
    { style: '414', description: 'Pro Mesh Adjustable', price: 9.25 },
    { style: '420', description: 'Surge Adjustable Officials Cap', price: 10.75 },
    { style: '435', description: 'Coos Bay Martexin Wax Water Repellent', price: 8.00 },
    { style: '436', description: 'Santiem Waxed Cotton', price: 9.75 },
    { style: '485', description: 'Pulse R-Flex Officials Cap', price: 9.50 },
    { style: '487', description: 'Pulse R-Flex Officials Cap', price: 8.75 },
    { style: '495', description: 'Pro Mesh R-Flex', price: 8.25 },
    { style: '510', description: 'Acrylic-Wool Blend Flatbill Snapback', price: 7.75 },
    { style: '511', description: 'Wool Blend Trucker', price: 8.25 },
    { style: '512', description: 'Surge Snapback', price: 8.75 },
    { style: '514', description: 'Surge Adjustable Hook and Loop', price: 8.50 },
    { style: '525', description: 'Surge Adjustable Umpire Cap', price: 9.25 },
    { style: '530', description: 'Surge Fitted Umpire Cap', price: 10.00 },
    { style: '533', description: 'Surge R-Flex Umpire Cap', price: 8.50 },
    { style: '535', description: 'Surge Adjustable Umpire Cap', price: 9.25 },
    { style: '540', description: 'Surge Fitted Umpire Cap', price: 10.00 },
    { style: '543', description: 'Surge R-Flex Umpire Cap', price: 8.50 },
    { style: '545', description: 'Surge Adjustable Umpire Cap', price: 9.25 },
    { style: '550', description: 'Surge Fitted Umpire Cap -Wool Blend', price: 9.75 },
    { style: '585', description: 'R-Flex Laser Perf R-Flex Snapback', price: 9.75 },
    { style: '632', description: 'Acrylic', price: 9.75 },
    { style: '633', description: 'Pulse R-Flex Umpire Cap', price: 7.75 },
    { style: '634', description: 'Ignite LT R-Flex Hook & Loop', price: 9.75 },
    { style: '643', description: 'Pulse R-Flex Umpire Cap', price: 9.75 },
    { style: '653', description: 'Pulse R-Flex Umpire Cap', price: 6.50 },
    { style: '707', description: 'Pulse Visor w/ Pro Mesh', price: 8.50 },
    { style: '709', description: 'Ignite LT Visor', price: 7.75 },
    { style: '712', description: 'Trucker Visor', price: 8.50 },
    { style: '715', description: 'Classic Golf Visor', price: 10.25 },
    { style: '733', description: 'Ignite LT R-Flex Umpire Cap', price: 7.25 },
    { style: '740', description: 'Pro Mesh Visor', price: 10.25 },
    { style: '743', description: 'Ignite LT R-Flex Umpire Cap', price: 10.25 },
    { style: '753', description: 'Ignite LT R-Flex Umpire Cap', price: 10.75 },
    { style: '785', description: 'Ignite LT R-Flex Officials Cap', price: 10.75 },
    { style: '787', description: 'Ignite LT R-Flex Officials Cap', price: 18.75 },
    { style: '810', description: 'Lite Wide Brim Hat', price: 18.00 },
    { style: '822', description: 'Straw Safari Hat', price: 17.00 },
    { style: '824', description: 'Classic Gambler Hat', price: 17.00 },
    { style: '827', description: 'Waterman Lined Straw Hat', price: 20.00 },
    { style: '828', description: 'Waterman Straw Hat', price: 8.25 },
    { style: '835', description: 'Tilikum Ripstop', price: 7.75 },
    { style: '840', description: 'Relaxed Twill Camo', price: 7.75 },
    { style: '843', description: 'Casual Twill Camo Strapback', price: 7.75 },
    { style: '862', description: 'Multicam Trucker', price: 9.00 },
    { style: '863', description: 'Structured Multicam', price: 9.75 },
    { style: '865', description: 'R-Flex Multicam', price: 12.00 },
    { style: '870', description: 'Relaxed Performance Camo', price: 9.75 },
    { style: '874', description: 'Casual Performance Camo', price: 9.75 },
    { style: '882', description: 'Blaze Trucker', price: 6.50 },
    { style: '882FP', description: '5 Panel Blaze Trucker', price: 6.50 },
    { style: '884', description: 'Blaze w/ Duck Cloth Visor', price: 7.00 },
    { style: '909', description: 'Mckenzie Brimmed Hat', price: 21.00 },
    { style: '910', description: 'Sunriver Brimmed Hat', price: 23.00 },
    { style: '930', description: 'Troutdale Corduroy Mesh Back', price: 7.25 },
    { style: '931', description: 'Koosah Ripstop', price: 8.25 },
    { style: '932', description: 'PCT 5 Panel Camper Cap', price: 7.25 },
    { style: '933', description: 'Bandon 6 Panel', price: 9.00 },
    { style: '934', description: 'Wildwood', price: 8.50 },
    { style: '935', description: 'Rogue', price: 8.25 },
    { style: '937', description: 'Pioneer 7 Panel', price: 11.50 },
    { style: '938', description: 'ORE 6 Panel', price: 9.00 },
    { style: '939', description: 'Bachelor Pinch Front w/ Rope', price: 7.75 },
    { style: '942', description: 'Sahalie 6 Panel Water Repellent', price: 9.50 },
    { style: '943', description: 'Summit Pack', price: 11.50 }
];

// Store original cap data for reference (before filtering)
const allRichardsonCaps = [...capData];

// Cap embroidery pricing by stitch count — FALLBACK ONLY; API (method=CAP) is preferred.
// Tier labels MUST match the API + getTier(): 1-7 / 8-23 / 24-47 / 48-71 / 72+.
// (2026 live values from Embroidery_Costs, StitchCount 8000.)
let embroideryCosts = {
    '8000': { '1-7': 17.00, '8-23': 17.00, '24-47': 13.00, '48-71': 11.00, '72+': 9.50 }
};

// Cap margin denominator — FALLBACK ONLY; pulled from API (tiersR[0].MarginDenominator).
let capMarginDenominator = 0.53;

// Laser/leatherette patch — FALLBACK ONLY; pulled from API to MATCH the Embroidery Quote Builder.
// Model: cap embroidery base + flat $5/cap upcharge + $50 one-time setup (GRT-50), no stitches.
let patchUpchargePerCap = 5.00;   // method=PATCH, ItemType='Patch'
let patchSetupFee = 50.00;        // service code GRT-50

// 3D Puff — FALLBACK ONLY; pulled from API (method=CAP-PUFF, ItemType='3D-Puff').
// Model: cap embroidery base + flat $5/cap upcharge (has stitches) + $100 digitizing if a new design.
let puffUpchargePerCap = 5.00;

// New-design one-time setup: $100 digitizing for embroidery + 3D puff (mirrors the EMB DigitizingFee).
const DIGITIZING_FEE = 100.00;

// Small-order (LTM) fee — tier 1-7 only (qty <= 7), matching the embroidery method (NOT < 24).
const CAP_LTM_FEE = 50.00;

// ============================================================================
// API Initialization
// ============================================================================

async function initializeRichardsonData() {
    if (richardsonDataInitialized) return;

    console.log('[Richardson] Initializing data from API...');

    try {
        // Fetch SanMar Richardson styles (to filter out)
        const sanmarResponse = await fetch(`${RICHARDSON_API_BASE}/api/decorated-cap-prices?brand=Richardson&tier=72%2B`);
        if (sanmarResponse.ok) {
            const sanmarData = await sanmarResponse.json();
            sanmarRichardsonStyles = Object.keys(sanmarData.prices || {});
            console.log(`[Richardson] Found ${sanmarRichardsonStyles.length} SanMar Richardson styles to filter out`);

            // Filter capData to only show Richardson-direct styles
            const originalCount = capData.length;
            capData = allRichardsonCaps.filter(cap => !sanmarRichardsonStyles.includes(cap.style));
            console.log(`[Richardson] Filtered caps: ${originalCount} -> ${capData.length}`);
        }

        // Fetch embroidery costs + cap margin from API
        const embResponse = await fetch(`${RICHARDSON_API_BASE}/api/pricing-bundle?method=CAP&styleNumber=112`);
        if (embResponse.ok) {
            const embData = await embResponse.json();
            if (embData.allEmbroideryCostsR && embData.allEmbroideryCostsR.length > 0) {
                const apiCosts = {};
                embData.allEmbroideryCostsR.forEach(cost => {
                    const stitch = cost.StitchCount?.toString() || '8000';
                    const tier = cost.TierLabel;
                    if (!apiCosts[stitch]) apiCosts[stitch] = {};
                    apiCosts[stitch][tier] = parseFloat(cost.EmbroideryCost);
                });
                if (Object.keys(apiCosts).length > 0) {
                    embroideryCosts = apiCosts;
                    console.log('[Richardson] Embroidery costs loaded from API');
                }
            }
            // Cap margin denominator — mirror the Embroidery Quote Builder (tiersR[0].MarginDenominator)
            if (embData.tiersR && embData.tiersR[0] && embData.tiersR[0].MarginDenominator) {
                capMarginDenominator = parseFloat(embData.tiersR[0].MarginDenominator);
                console.log(`[Richardson] Cap margin denominator loaded from API: ${capMarginDenominator}`);
            }
        }

        // Fetch laser/leatherette patch upcharge ($5/cap) — method=PATCH, ItemType='Patch'
        try {
            const patchResponse = await fetch(`${RICHARDSON_API_BASE}/api/pricing-bundle?method=PATCH`);
            if (patchResponse.ok) {
                const patchData = await patchResponse.json();
                const patchRecord = (patchData.allPatchCostsR || []).find(c => c.ItemType === 'Patch');
                if (patchRecord && patchRecord.EmbroideryCost != null) {
                    patchUpchargePerCap = parseFloat(patchRecord.EmbroideryCost);
                    console.log(`[Richardson] Patch upcharge loaded from API: $${patchUpchargePerCap}`);
                }
            }
        } catch (patchError) {
            console.error('[Richardson] Patch upcharge load failed (using fallback):', patchError);
        }

        // Fetch 3D Puff upcharge ($5/cap) — method=CAP-PUFF, ItemType='3D-Puff'
        try {
            const puffResponse = await fetch(`${RICHARDSON_API_BASE}/api/pricing-bundle?method=CAP-PUFF`);
            if (puffResponse.ok) {
                const puffData = await puffResponse.json();
                const puffRecord = (puffData.allEmbroideryCostsR || []).find(c => c.ItemType === '3D-Puff');
                if (puffRecord && puffRecord.EmbroideryCost != null) {
                    puffUpchargePerCap = parseFloat(puffRecord.EmbroideryCost);
                    console.log(`[Richardson] 3D Puff upcharge loaded from API: $${puffUpchargePerCap}`);
                }
            }
        } catch (puffError) {
            console.error('[Richardson] 3D Puff upcharge load failed (using fallback):', puffError);
        }

        // Fetch patch setup fee (GRT-50, $50 one-time) — mirror the Embroidery Quote Builder
        try {
            const codesResponse = await fetch(`${RICHARDSON_API_BASE}/api/service-codes`);
            if (codesResponse.ok) {
                const codesData = await codesResponse.json();
                const grt50 = (codesData.data || []).find(c => c.ServiceCode === 'GRT-50');
                if (grt50 && grt50.SellPrice != null) {
                    patchSetupFee = parseFloat(grt50.SellPrice);
                    console.log(`[Richardson] Patch setup fee (GRT-50) loaded from API: $${patchSetupFee}`);
                }
            }
        } catch (codesError) {
            console.error('[Richardson] GRT-50 setup fee load failed (using fallback):', codesError);
        }

        richardsonDataInitialized = true;
        console.log('[Richardson] Data initialization complete');

    } catch (error) {
        console.error('[Richardson] Error initializing data:', error);
        richardsonDataInitialized = true;
    }
}

// ============================================================================
// Price Lookup Calculator
// ============================================================================

class RichardsonPricingLookup {
    constructor() {
        this.selectedCap = null;
        this.currentCategory = 'all';
        this.currentSearch = '';
        this.capBrowserRendered = false;

        this.initializeElements();
        this.bindEvents();
        this.initCapBrowser();
        this.updateCapCount();

        console.log('[Richardson] Price lookup initialized with', capData.length, 'caps');
    }

    initializeElements() {
        // Form elements
        this.capStyleInput = document.getElementById('capStyle');
        this.styleAutocomplete = document.getElementById('styleAutocomplete');
        this.styleValidation = document.getElementById('styleValidation');
        this.styleDescription = document.getElementById('styleDescription');
        this.quantityInput = document.getElementById('quantity');
        this.quantityTier = document.getElementById('quantityTier');
        this.embellishmentRadios = document.querySelectorAll('input[name="embellishment"]');

        // Price display elements
        this.pricePlaceholder = document.getElementById('pricePlaceholder');
        this.priceBreakdown = document.getElementById('priceBreakdown');
        this.ltmNotice = document.getElementById('ltmNotice');
        this.ltmPerUnit = document.getElementById('ltmPerUnit');
        this.setupNotice = document.getElementById('setupNotice');
        this.setupLabel = document.getElementById('setupLabel');
        this.setupPerUnit = document.getElementById('setupPerUnit');
        this.newDesignCheckbox = document.getElementById('newDesign');
        this.pricePerCap = document.getElementById('pricePerCap');
        this.lineTotal = document.getElementById('lineTotal');

        // Cap browser elements
        this.capBrowserToggle = document.getElementById('capBrowserToggle');
        this.capBrowserContent = document.getElementById('capBrowserContent');
        this.capSearchInput = document.getElementById('capSearchInput');
        this.clearCapSearch = document.getElementById('clearCapSearch');
        this.categoryChips = document.querySelectorAll('.category-chip');
        this.capGrid = document.getElementById('capGrid');
        this.capCountBadge = document.getElementById('capCountBadge');
    }

    bindEvents() {
        // Style input with autocomplete
        this.capStyleInput.addEventListener('input', () => this.handleStyleInput());
        this.capStyleInput.addEventListener('blur', () => {
            setTimeout(() => this.styleAutocomplete.classList.add('hidden'), 200);
        });

        // Quantity input - real-time update
        this.quantityInput.addEventListener('input', () => {
            this.updateQuantityTier();
            this.updatePricing();
        });

        // Embellishment type - real-time update
        this.embellishmentRadios.forEach(radio => {
            radio.addEventListener('change', () => this.updatePricing());
        });

        // New-design toggle - real-time update
        if (this.newDesignCheckbox) {
            this.newDesignCheckbox.addEventListener('change', () => this.updatePricing());
        }

        // Cap browser toggle
        if (this.capBrowserToggle) {
            this.capBrowserToggle.addEventListener('click', () => this.toggleCapBrowser());
        }

        // Cap browser search
        if (this.capSearchInput) {
            this.capSearchInput.addEventListener('input', (e) => {
                this.currentSearch = e.target.value.toLowerCase();
                this.filterAndRenderCaps();
                this.clearCapSearch.classList.toggle('hidden', !this.currentSearch);
            });
        }

        if (this.clearCapSearch) {
            this.clearCapSearch.addEventListener('click', () => {
                this.capSearchInput.value = '';
                this.currentSearch = '';
                this.clearCapSearch.classList.add('hidden');
                this.filterAndRenderCaps();
            });
        }

        // Category filters
        this.categoryChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.categoryChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentCategory = chip.dataset.category;
                this.filterAndRenderCaps();
            });
        });
    }

    handleStyleInput() {
        const value = this.capStyleInput.value.trim().toUpperCase();
        this.styleAutocomplete.innerHTML = '';

        if (!value) {
            this.styleAutocomplete.classList.add('hidden');
            this.clearSelection();
            return;
        }

        // Find matching caps
        const matches = capData.filter(cap =>
            cap.style.toUpperCase().includes(value) ||
            cap.description.toUpperCase().includes(value)
        ).slice(0, 10);

        if (matches.length === 0) {
            this.styleAutocomplete.classList.add('hidden');
            this.styleValidation.textContent = '';
            this.styleValidation.className = 'validation-indicator';
            return;
        }

        // Show autocomplete
        matches.forEach(cap => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <span class="autocomplete-style">${cap.style}</span>
                <span class="autocomplete-description">${cap.description}</span>
            `;
            item.addEventListener('click', () => this.selectCap(cap));
            this.styleAutocomplete.appendChild(item);
        });

        this.styleAutocomplete.classList.remove('hidden');

        // Check for exact match
        const exactMatch = capData.find(cap => cap.style.toUpperCase() === value);
        if (exactMatch) {
            this.selectCap(exactMatch, false);
        }
    }

    selectCap(cap, hideAutocomplete = true) {
        this.selectedCap = cap;
        this.capStyleInput.value = cap.style;
        this.styleDescription.textContent = `${cap.description} - $${cap.price.toFixed(2)} blank`;
        this.styleValidation.textContent = '✓';
        this.styleValidation.className = 'validation-indicator valid';

        if (hideAutocomplete) {
            this.styleAutocomplete.classList.add('hidden');
        }

        this.updatePricing();
    }

    clearSelection() {
        this.selectedCap = null;
        this.styleDescription.textContent = '';
        this.styleValidation.textContent = '';
        this.styleValidation.className = 'validation-indicator';
        this.showPlaceholder();
    }

    getSelectedEmbellishment() {
        const selected = document.querySelector('input[name="embellishment"]:checked');
        return selected ? selected.value : 'embroidery';
    }

    getTier(quantity) {
        if (quantity <= 7) return '1-7';
        if (quantity <= 23) return '8-23';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    updateQuantityTier() {
        const quantity = parseInt(this.quantityInput.value) || 0;
        const tier = this.getTier(quantity);
        this.quantityTier.textContent = `Tier: ${tier}`;
    }

    updatePricing() {
        if (!this.selectedCap) {
            this.showPlaceholder();
            return;
        }

        const quantity = parseInt(this.quantityInput.value) || 0;
        if (quantity < 1) {
            this.showPlaceholder();
            return;
        }

        const tier = this.getTier(quantity);
        const type = this.getSelectedEmbellishment();
        const isPatch = type === 'leatherette';
        const isPuff = type === 'puff';
        const isNewDesign = this.newDesignCheckbox ? this.newDesignCheckbox.checked : true;

        // Decoration base = cap embroidery cost for the tier — SAME base for embroidery, 3D puff, and laser patch.
        // Mirrors the Embroidery Quote Builder.
        const embBase = (embroideryCosts['8000'] && embroideryCosts['8000'][tier]) || 13.00;

        // Per-cap decorated unit price: garment marked up + embroidery base, rounded up to the dollar (CeilDollar).
        const markedUpGarment = this.selectedCap.price / capMarginDenominator;
        const decoratedRounded = Math.ceil(markedUpGarment + embBase);

        // Flat +$5/cap upcharge: laser patch (PATCH) or 3D puff (CAP-PUFF). Plain embroidery has none.
        const upchargePerCap = isPatch ? patchUpchargePerCap : (isPuff ? puffUpchargePerCap : 0);

        // One-time setup — only when it's a new design:
        //   leatherette -> $50 patch setup (GRT-50);  embroidery / 3D puff -> $100 digitizing.
        const setupFee = isNewDesign ? (isPatch ? patchSetupFee : DIGITIZING_FEE) : 0;

        // Small-order (LTM) fee — tier 1-7 only (qty <= 7).
        const hasLTM = quantity <= 7;
        const ltmFee = hasLTM ? CAP_LTM_FEE : 0;

        const finalPrice = decoratedRounded + upchargePerCap + (setupFee + ltmFee) / quantity;
        const total = finalPrice * quantity;

        // Update display
        this.pricePlaceholder.classList.add('hidden');
        this.priceBreakdown.classList.remove('hidden');

        // Small-order (LTM) fee — tier 1-7 only
        if (hasLTM) {
            this.ltmNotice.classList.remove('hidden');
            this.ltmPerUnit.textContent = `(+$${(ltmFee / quantity).toFixed(2)}/cap)`;
        } else {
            this.ltmNotice.classList.add('hidden');
        }

        // One-time setup notice — shown when a new-design setup applies
        if (this.setupNotice) {
            if (setupFee > 0) {
                this.setupNotice.classList.remove('hidden');
                if (this.setupLabel) {
                    this.setupLabel.textContent = isPatch
                        ? `Patch setup: $${setupFee.toFixed(2)} one-time (GRT-50)`
                        : `Digitizing: $${setupFee.toFixed(2)} one-time (new design)`;
                }
                if (this.setupPerUnit) {
                    this.setupPerUnit.textContent = `(+$${(setupFee / quantity).toFixed(2)}/cap)`;
                }
            } else {
                this.setupNotice.classList.add('hidden');
            }
        }

        this.pricePerCap.textContent = `$${finalPrice.toFixed(2)}`;
        this.lineTotal.textContent = `$${total.toFixed(2)}`;
    }

    showPlaceholder() {
        this.pricePlaceholder.classList.remove('hidden');
        this.priceBreakdown.classList.add('hidden');
    }

    // ========================================================================
    // Cap Browser
    // ========================================================================

    initCapBrowser() {
        this.updateCapCount();
    }

    updateCapCount() {
        if (this.capCountBadge) {
            this.capCountBadge.textContent = `${capData.length} styles`;
        }
    }

    toggleCapBrowser() {
        const isExpanded = this.capBrowserContent.classList.contains('expanded');

        if (isExpanded) {
            this.capBrowserContent.classList.remove('expanded');
            this.capBrowserToggle.setAttribute('aria-expanded', 'false');
        } else {
            this.capBrowserContent.classList.add('expanded');
            this.capBrowserToggle.setAttribute('aria-expanded', 'true');

            if (!this.capBrowserRendered) {
                this.filterAndRenderCaps();
                this.capBrowserRendered = true;
            }
        }
    }

    getCapCategory(cap) {
        const style = cap.style.toUpperCase();
        const desc = cap.description.toLowerCase();

        if (desc.includes('trucker') || style.includes('112') || style.includes('113') ||
            style.includes('115') || style.includes('163') || style.includes('168') ||
            style.includes('222') || style.includes('312')) {
            return 'trucker';
        }
        if (desc.includes('beanie') || desc.includes('knit') || desc.includes('cuff') ||
            style.startsWith('R15') || style.startsWith('R18') || style.startsWith('R20') ||
            style.match(/^1[234]\d$/)) {
            return 'beanie';
        }
        if (desc.includes('visor') || style.includes('R45') || style.includes('160') ||
            style.includes('707') || style.includes('709') || style.includes('712') ||
            style.includes('715') || style.includes('740')) {
            return 'visor';
        }
        if (desc.includes('camo') || desc.includes('duck') || style.includes('840') ||
            style.includes('846') || style.includes('862') || style.includes('863') ||
            style.includes('865') || style.includes('870') || style.includes('874') ||
            style.includes('882') || style.includes('884')) {
            return 'camo';
        }
        if (desc.includes('performance') || desc.includes('pulse') || desc.includes('ignite') ||
            desc.includes('matrix') || style.includes('PTS') || style.includes('176')) {
            return 'performance';
        }
        if (desc.includes('r-flex') || desc.includes('fitted') || style.includes('185') ||
            style.includes('PTS65')) {
            return 'fitted';
        }

        return 'other';
    }

    filterAndRenderCaps() {
        let filteredCaps = capData.filter(cap => {
            // Search filter
            if (this.currentSearch) {
                const searchMatch = cap.style.toLowerCase().includes(this.currentSearch) ||
                                   cap.description.toLowerCase().includes(this.currentSearch);
                if (!searchMatch) return false;
            }

            // Category filter
            if (this.currentCategory !== 'all') {
                const capCategory = this.getCapCategory(cap);
                if (capCategory !== this.currentCategory) return false;
            }

            return true;
        });

        this.renderCapGrid(filteredCaps);
    }

    renderCapGrid(caps) {
        if (!this.capGrid) return;

        const noResults = document.getElementById('noResultsMessage');

        if (caps.length === 0) {
            this.capGrid.innerHTML = '';
            if (noResults) noResults.classList.remove('hidden');
            return;
        }

        if (noResults) noResults.classList.add('hidden');

        const html = caps.map(cap => {
            const category = this.getCapCategory(cap);
            const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

            return `
                <div class="cap-card" data-style="${cap.style}">
                    <div class="cap-card-header">
                        <span class="cap-style">${cap.style}</span>
                        <span class="cap-category-badge">${categoryLabel}</span>
                    </div>
                    <div class="cap-card-body">
                        <p class="cap-description">${cap.description}</p>
                        <p class="cap-price">$${cap.price.toFixed(2)} blank</p>
                    </div>
                    <button type="button" class="quick-select-btn" onclick="window.richardsonPricing.quickSelectCap('${cap.style}')">
                        <i class="fas fa-check"></i> Select
                    </button>
                </div>
            `;
        }).join('');

        this.capGrid.innerHTML = html;
    }

    quickSelectCap(styleNumber) {
        const cap = capData.find(c => c.style === styleNumber);
        if (!cap) return;

        // Set the cap in the lookup form
        this.selectCap(cap);

        // Scroll to top and focus quantity
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            this.quantityInput.focus();
            this.quantityInput.select();
        }, 300);
    }
}

// ============================================================================
// Initialize on DOM Ready
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Richardson] Starting initialization...');
    await initializeRichardsonData();
    window.richardsonPricing = new RichardsonPricingLookup();
    console.log('[Richardson] Factory Direct pricing ready');
});
