// ============================================================
// SCREEN PRINT QUOTE BUILDER - Excel-Style Quote Builder
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
const API_BASE = window.APP_CONFIG.API.BASE_URL;

// NOTE: SIZE_MODIFIERS was removed - use SIZE_TO_SUFFIX (line ~1520) instead
// SIZE_TO_SUFFIX contains ALL size suffixes including tall, youth, toddler, etc.

// STANDARD_SIZES — now provided by extended-sizes-config.js

// Extended sizes that get their own line items
// Note: 2XL goes to Size05 (dedicated), all others go to Size06 (Other)
const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping
// Size01-04: Standard sizes (S, M, L, XL) - combined into one line item
// Size05: 2XL only - separate line item
// Size06: ALL others (XS, 3XL, 4XL, 5XL, Youth, Tall, OSFA) - each gets separate line item
const SIZE_TO_SLOT = {
    'S': 'Size01', 'M': 'Size02', 'L': 'Size03', 'XL': 'Size04',
    '2XL': 'Size05',  // 2XL has dedicated slot
    'XS': 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', 'OSFA': 'Size06'
};

// Display labels matching ShopWorks column headers
// Note: Internally we use L/2XL/3XL, but display as LG/XXL/XXXL
const SIZE_DISPLAY_LABELS = {
    'S': 'S', 'M': 'M', 'L': 'LG', 'XL': 'XL',
    '2XL': 'XXL', '3XL': 'XXXL',
    'XS': 'XXXL', '4XL': 'XXXL', '5XL': 'XXXL', '6XL': 'XXXL'
};

// State
let screenPrintPricingService = null;
let quoteService = null;

// Auto-save & Draft Recovery (2026 consolidation)
let spPersistence = null;
let spSession = null;

let products = [];
let rowCounter = 0;
let productCache = {}; // Cache product data for quick lookup
let childRowMap = {}; // Track child rows: { parentRowId: { '2XL': childRowId, '3XL': childRowId } }

// Edit mode state
let editingQuoteId = null;
let editingRevision = null;

// Unsaved changes tracking
let hasChanges = false;

// Screen Print Location Configuration
// Screen Print Configuration State
let printConfig = {
    frontLocation: 'LC',      // LC, FF, JF
    frontColors: 1,           // 1-6
    backLocation: '',         // '', FB, JB
    backColors: 1,            // 1-6
    leftSleeveColors: 0,      // 0 = off, else 1-6 — each sleeve is its OWN additional print location
    rightSleeveColors: 0,     // 0 = off, else 1-6 (may differ from the left)
    sleeveColorsList: [],     // engine-canonical [left?, right?] derived in updatePrintConfig
    isDarkGarment: false,     // Adds white underbase (+1 screen per location, INCLUDING each sleeve)
    isSafetyStripes: false,   // Adds $2/piece/location (front/back only — sleeves get no hi-vis stripe)
    totalScreens: 1,          // Calculated
    setupFee: 30.00           // Calculated: screens × $30
};

const SCREEN_FEE = 30.00; // $30 per screen

// Print location display names
const LOCATION_NAMES = {
    'LC': 'Left Chest',
    'FF': 'Full Front',
    'JF': 'Jumbo Front',
    'FB': 'Full Back',
    'JB': 'Jumbo Back'
};

// updatePrintConfig — MOVED to builders/scp/print-config.js (S1a, 2026-07-08).

// ── Dark-garment underbase nudge (expert audit 2026-07-07) ──────────────────
// The builder defaults isDarkGarment OFF while the standalone calculator defaults
// it ON (screenprint-pricing-v2.js:81), so forgetting the toggle on a black-hoodie
// job silently under-quotes setup by one $30 underbase screen per print location —
// per-piece price is unaffected in the house model, so nothing else looks wrong.
// Non-blocking by design: no-white-ink designs on darks are legitimate, the rep
// stays in charge. Color words mirror the calculator's darkColors list.
const SCP_DARK_COLOR_WORDS = ['black', 'navy', 'charcoal', 'forest', 'maroon', 'purple', 'brown', 'dark'];
let _darkNudgeDismissed = false;

// updateDarkGarmentNudge — MOVED to builders/scp/print-config.js (S1a, 2026-07-08).

// Extended sizes available for Size06 (Other) column
// Note: Actual available sizes are fetched dynamically per product via API
// Includes OSFA for beanies, bags, and other one-size-fits-all items
// All sizes that go in Size06 column (the "Other/Catch-All" column)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
// NOTE: 2XL and XXL are NOT here - they go in Size05 (XXL column)
const SIZE06_EXTENDED_SIZES = [
    // Extended large (3XL and up only - 2XL/XXL go in Size05)
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    // One-size
    'OSFA', 'OSFM',
    // Combos (for fitted caps)
    'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
    // Tall
    'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
    // Youth
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    // Toddler
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    // Big
    'LB', 'XLB', '2XLB',
    // Extra small
    'XXS', '2XS'
];

// EXTENDED_SIZE_ORDER — now provided by extended-sizes-config.js

// SIZE_TO_SUFFIX — now provided by extended-sizes-config.js

// ============================================================
// EXTENDED SIZE PICKER POPUP (for Size06/XXXL column)
// ============================================================

// getAvailableExtendedSizes() — now provided by extended-sizes-config.js (with caching)

// [Extended size functions removed — now in quote-extended-sizes.js]
// openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
// getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
// updateXXXLCellDisplay, updateChildRowPrice

// ============================================================
// AUTO-SAVE & DRAFT RECOVERY (2026 consolidation)
// ============================================================

// ============================================================
// DRAFT PERSISTENCE + EDIT-LOAD + resetQuote — MOVED to
// builders/scp/persistence.js (S1a, 2026-07-08). Bridged via the
// builders/scp bundle before DOMContentLoaded.
// ============================================================

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {

    // Logo status chips — On file / New / TBD (Erik 2026-07-07). SCP's TBD
    // assumption is the COLOR COUNT: the one thing the art changes about price.
    if (typeof initLogoStatusChips === 'function') {
        initLogoStatusChips({
            mountSel: '.logo-section.reference-artwork-section',
            artworkMountSel: '#scp-artwork-mount',
            designFocusId: 'design-number',
            notesSel: '#spc-order-fields .os-notes',
            assumption: () => {
                const front = document.querySelector('input[name="front-colors"]:checked')?.value || '1';
                const backOn = !!(typeof printConfig !== 'undefined' && printConfig && printConfig.backLocation);
                const back = backOn ? (document.querySelector('input[name="back-colors"]:checked')?.value || '1') : null;
                const dark = document.getElementById('dark-garment-toggle')?.checked;
                return `Pricing assumes a ${front}-color front print${back ? ` + ${back}-color back` : ''}${dark ? ' with white underbase' : ''}. Color count is confirmed after artwork review — each added color adds a screen and changes the per-piece price.`;
            }
        });
    }

    // Mid-call method-switch menu (expert audit 2026-07-07) — serializes IDENTITY
    // only (customer + style/color/sizes); the target builder reprices natively.
    if (typeof initMethodSwitchMenu === 'function') {
        initMethodSwitchMenu({
            current: 'scp',
            collect: () => (typeof collectProductsFromTable === 'function' ? collectProductsFromTable() : [])
                .filter(p => !p.isService)
                .map(p => ({
                    style: p.style, color: p.catalogColor || '', colorName: p.color || '',
                    sizeBreakdown: Object.fromEntries(Object.entries(p.sizeBreakdown || {}).filter(([, q]) => (parseInt(q, 10) || 0) > 0))
                }))
                .filter(i => i.style && Object.keys(i.sizeBreakdown).length)
        });
    }

    // Load Caspio Service_Codes (SPSU screen-setup, GRT-75 design) so fees come
    // from the API, not hardcoded literals (Erik's Pricing=API rule). Fire-and-
    // forget — getServicePrice() returns the documented fallback until it resolves,
    // and recalculatePricing() re-reads live values on the next interaction. (2026-06-09)
    if (typeof loadServiceCodePrices === 'function') { loadServiceCodePrices().then(() => {
        // updatePrintConfig() re-derives printConfig.setupFee from the now-live SPSU rate
        // and ends in recalculateAllPrices(); the old bare recalculatePricing() left the
        // stale fallback $30/screen CHARGED while the fee-row label showed the live rate
        // until the rep happened to click a print-config control. (expert audit 2026-07-07)
        try { if (typeof updatePrintConfig === 'function') { updatePrintConfig(); } else { recalculatePricing(); } } catch (_) {}
        // Sync the static "$75/hr", "$10 ea", "$15 ea" labels with the live Service_Codes
        // rates (mirror DTF's #design-rate-label pattern). The math was already API-driven,
        // but a Caspio price change left the on-screen labels contradicting the charged
        // totals. Format money labels to 2 decimals; the /hr rate matches DTF (integer). (2026-07-04)
        try {
            const _designRateEl = document.getElementById('scp-design-rate-label');
            if (_designRateEl) _designRateEl.textContent = String(getServicePrice('GRT-75', 75));
            const _fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2);
            const _vellumRateEl = document.getElementById('scp-vellum-rate-label');
            if (_vellumRateEl) _vellumRateEl.textContent = _fmt(getServicePrice('Vellum', 10));
            const _colorChangeRateEl = document.getElementById('scp-color-change-rate-label');
            if (_colorChangeRateEl) _colorChangeRateEl.textContent = _fmt(getServicePrice('Color Chg', 15));
        } catch (_) {}
    }); }

    // Recommended safety apparel — curated hi-vis top sellers that pair with safety
    // stripes (2026-06-28). Always shown in the SCP view; emphasized when the rep
    // turns safety stripes on. One-click Add drops the style+safety color into the
    // table via the same path as quote-load (rep then enters quantities).
    if (window.SafetyStripeRecs) {
        SafetyStripeRecs.render('scp-safety-recs', {
            variant: 'builder',
            audience: 'staff',
            collapsible: true,
            title: 'Recommended safety apparel',
            subtitle: 'Top hi-vis sellers that pair with safety stripes — click Add, then enter quantities',
            onAdd: function (style, color) {
                try {
                    addProductFromQuote({ styleNumber: style, color: (color && (color.color_name || color.catalog_color)) || '', sizeBreakdown: {} });
                    showToast('Added ' + style + (color && color.color_name ? ' · ' + color.color_name : '') + ' — enter quantities', 'success');
                } catch (e) { console.error('[SCP] safety-rec add failed:', e); }
            }
        });
        // Auto-expand the (collapsed-by-default) recs when the rep turns safety stripes on.
        var _spStripeToggle = document.getElementById('safety-stripes-toggle');
        if (_spStripeToggle) {
            _spStripeToggle.addEventListener('change', function () {
                if (_spStripeToggle.checked) {
                    SafetyStripeRecs.expand('scp-safety-recs');
                    var el = document.getElementById('scp-safety-recs');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }
    }

    // Native leave-page warning while changes are unsaved (EMB-parity 2026-06-10)
    if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();

    // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
    // Adds design name input + per-file placement dropdown so the push payload
    // can carry Designs[{name, Locations[{Location, ImageURL}]}] when the rep
    // is creating a brand-new design (no existing #).
    if (typeof ArtworkUpload !== 'undefined') {
        try {
            window._scpArtwork = ArtworkUpload.attach({
                mountSelector: '#scp-artwork-mount',
                designName: {
                    enabled: true,
                    label: 'Design name (required when uploading new artwork)',
                    placeholder: 'e.g. Acme Corp Logo',
                },
                placements: [
                    { code: 'Front',        label: 'Front' },
                    { code: 'Back',         label: 'Back' },
                    { code: 'Left Chest',   label: 'Left Chest' },
                    { code: 'Right Chest',  label: 'Right Chest' },
                    { code: 'Left Sleeve',  label: 'Left Sleeve' },
                    { code: 'Right Sleeve', label: 'Right Sleeve' },
                    { code: 'Back of Neck', label: 'Back of Neck' },
                ],
                defaultPlacement: 'Front',
            });
            console.log('[SCP] Artwork upload widget mounted (rich mode)');
        } catch (e) {
            console.error('[SCP] Artwork widget mount failed:', e);
        }
    }

    // Phase 11.1 (2026-05-24) — customer-aware design lookup.
    // Wraps #design-number input with autocomplete fetching from
    // proxy /api/designs/by-customer?method=scp (DesignType=1).
    if (typeof CustomerDesignCombobox !== 'undefined') {
        try {
            const designInput = document.getElementById('design-number');
            if (designInput) {
                window._scpDesignCombobox = CustomerDesignCombobox.attach(designInput, {
                    method: 'scp',
                    getCustomerId: () => {
                        const v = document.getElementById('customer-number')?.value?.trim();
                        const n = parseInt(v, 10);
                        return Number.isFinite(n) && n > 0 ? n : null;
                    },
                    onPick: (design) => {
                        console.log('[SCP] Design picked:', design.idDesign, design.designName);
                    },
                });
                const custInput = document.getElementById('customer-number');
                if (custInput) {
                    custInput.addEventListener('change', () => {
                        if (window._scpDesignCombobox) window._scpDesignCombobox.refresh();
                    });
                }
                console.log('[SCP] Design combobox mounted');
            }
        } catch (e) {
            console.error('[SCP] Design combobox mount failed:', e);
        }
    }

    showLoading(true);

    try {
        // Initialize Screen Print pricing service
        screenPrintPricingService = new ScreenPrintPricingService();

        // Initialize quote service for save/load
        quoteService = new ScreenPrintQuoteService();

        // Check for edit mode (loading existing quote for revision)
        const editQuoteId = checkForEditMode();
        // Duplicate mode (?duplicate=SPC-...): load a copy as a NEW quote (EMB/DTF parity 2026-07-05)
        const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
        // Quick Quote handoff (?from=quickquote) — prefill wins over draft recovery
        // for this visit, same as ?edit=/?duplicate=. (item #6, 2026-07-05)
        const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
        if (duplicateQuoteId) {
            await duplicateQuote(duplicateQuoteId);
        } else if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await loadQuoteForEditing(editQuoteId);
        } else if (qqPrefill) {
            initScreenPrintPersistence();
            await applyQuickQuotePrefillScp(qqPrefill);
        } else if (typeof takeMethodSwitchPrefill === 'function' && (window._msPrefillScp = takeMethodSwitchPrefill())) {
            // Mid-call method switch (expert audit 2026-07-07): customer + rows from another builder
            initScreenPrintPersistence();
            await applyMethodSwitchPrefillScp(window._msPrefillScp);
        } else {
            // Initialize auto-save & draft recovery (2026 consolidation)
            initScreenPrintPersistence();

            // Check for draft recovery
            if (spSession && spSession.shouldShowRecovery()) {
                spSession.showRecoveryDialog(
                    (draft) => restoreScreenPrintDraft(draft),
                    () => {
                        if (spPersistence) spPersistence.clearDraft();
                        // No auto-row - user starts with empty state
                    }
                );
            }
            // No auto-row - empty state message guides user to search
        }

        // Setup event listeners (needed for both modes)
        setupSearchAutocomplete();
        setupKeyboardShortcuts();

        // Initialize print configuration
        updatePrintConfig();

        // Auto-select sales rep based on logged-in staff (2026 consolidation)
        if (typeof StaffAuthHelper !== 'undefined') {
            StaffAuthHelper.autoSelectSalesRep('sales-rep');
        }

        // Initialize customer lookup autocomplete
        if (typeof CustomerLookupService !== 'undefined') {
            const customerLookup = new CustomerLookupService();

            // Shared handler — both FIND CUSTOMER box and COMPANY field fill the
            // same downstream fields + surface the same CRM context.
            const applyContact = (contact) => {
                document.getElementById('customer-name').value = contact.ct_NameFull || '';
                document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                document.getElementById('company-name').value = contact.CustomerCompanyName || '';
                // ShopWorks customer # — so the pushed order attaches to the real
                // customer instead of the no-customer fallback (2026-06-01).
                const _custNumEl = document.getElementById('customer-number');
                if (_custNumEl && contact.id_Customer != null) _custNumEl.value = String(contact.id_Customer);

                // [2026-06-08] P0 (Erik's #1 rule): honor tax-exempt customers — the CRM "TAX EXEMPT" chip was
                // cosmetic; the quote/PDF/push still billed WA tax. Mirror EMB. Also restore tax for a taxable
                // customer selected right after an exempt one (else the prior 0% bleeds → under-charge).
                var _wasExempt = !!window._taxExempt;
                window._taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                var _incTax = document.getElementById('include-tax');
                var _rateEl = document.getElementById('tax-rate-input');
                if (window._taxExempt) {
                    if (_incTax) _incTax.checked = false;
                    if (_rateEl) _rateEl.value = '0';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                } else if (_wasExempt) {
                    if (_incTax) _incTax.checked = true;
                    if (_rateEl && _rateEl.value === '0') _rateEl.value = '10.2';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                }

                if (typeof window.surfaceCustomerContext === 'function') {
                    window.surfaceCustomerContext(contact, {
                        warningContainerId: 'customer-warning-banner',
                        taxChipContainerId: 'customer-tax-chip',
                        tierBadgeContainerId: 'customer-tier-badge',
                        phoneInputId: 'customer-phone',
                    });
                }

                showToast('Customer info loaded', 'success');
                if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] refresh recap on customer pick

                // Recent ShopWorks orders panel (advisory re-order aid; silent-skip on failure) —
                // shared showRecentCustomerOrders() in quote-builder-utils.js. SCP has no notes
                // textarea, so [Reference] targets the project-name field. (item #13, 2026-07-05)
                if (typeof showRecentCustomerOrders === 'function' && contact.id_Customer) {
                    showRecentCustomerOrders(contact.id_Customer, {
                        projectId: 'project-name', designId: 'design-number'
                    });
                }
            };

            customerLookup.bindToInput('customer-lookup', {
                onSelect: applyContact,
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                    window._taxExempt = false;  // [2026-06-08] P0: customer cleared → no longer exempt
                    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] empty the recap on lookup clear
                    if (typeof removeRecentOrdersPanel === 'function') removeRecentOrdersPanel();  // item #13: no stale orders for the next customer
                }
            });

            // Erik 2026-05-26: COMPANY field also acts as a search — reps
            // intuitively type the company name there (DTG works that way).
            // Selecting a result keeps the FIND CUSTOMER box in sync.
            customerLookup.bindToInput('company-name', {
                onSelect: (contact) => {
                    const lookupInput = document.getElementById('customer-lookup');
                    if (lookupInput) lookupInput.value = contact.CustomerCompanyName || '';
                    applyContact(contact);
                }
            });
        }

        // Initialize order & shipping fields (shared component)
        renderOrderShippingFields('spc-order-fields');
        initOrderShippingListeners('spc-order-fields', {
            onShippingFeeChange: () => { updateTaxCalculation(); if (window.renderOrderRecap) window.renderOrderRecap(); },  // [2026-06-08] refresh ship-to card on fee change
            onTaxRateChange: (rate) => {
                // [2026-06-08] P0 (#1 rule): exempt/wholesale orders stay 0% — don't let a ZIP DOR lookup re-apply WA tax.
                if (window._taxExempt || window._isWholesale) { const ri = document.getElementById('tax-rate-input'); if (ri) ri.value = '0'; updateTaxCalculation(); return; }
                const rateInput = document.getElementById('tax-rate-input');
                if (rateInput) rateInput.value = rate;
                updateTaxCalculation();
            }
        });
        // [2026-06-08] SCP-local listeners on the shared .os-ship-* panel fields → refresh the order-summary band.
        // The .os-* panel + its tax listeners are SHARED (quote-builder-utils.js) and must NOT be edited; these
        // listeners are attached HERE (SCP-only) after the panel renders. The fee is covered by onShippingFeeChange
        // above. (DTF/SCP parity Phase 3)
        ['.os-ship-address', '.os-ship-city', '.os-ship-state', '.os-ship-zip', '.os-ship-method'].forEach(function (sel) {
            var el = document.querySelector('#spc-order-fields ' + sel);
            if (el) {
                el.addEventListener('input', function () { if (window.renderOrderRecap) window.renderOrderRecap(); });
                el.addEventListener('change', function () { if (window.renderOrderRecap) window.renderOrderRecap(); });
            }
        });

        // Auto-focus search bar for immediate typing (UX improvement)
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        showToast('Ready to build Screen Print quotes!', 'success');

    } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Failed to initialize. Please refresh.', 'error');
    }

    showLoading(false);
});

// ============================================================
// PRODUCT SEARCH & AUTOCOMPLETE (Using ExactMatchSearch module)
// ============================================================

// Module instance - initialized in setupSearchAutocomplete
let exactMatchSearcher = null;

// ============================================================
// PRODUCT ROWS + SEARCH + SIZES + COLORS — MOVED to
// builders/scp/product-rows.js (S1a, 2026-07-08).
// ============================================================

// ============================================================
// PRICING CALCULATIONS (Screen Print)
// ============================================================

// Alias for backward compatibility
function recalculateAllPrices() {
    recalculatePricing();
}

// Screen Print tier mapping — FALLBACK ONLY (used when the Caspio-matched tier label
// is unavailable). Boundaries follow the 2026-06-19 remap (24-47/48-71/72-144/145+);
// the old 24-36/37-72/73-144 labels survived here and printed nonexistent tiers on
// failure-path saves/PDFs. (expert audit 2026-07-07)
const SCREENPRINT_TIERS = [
    { label: '24-47', min: 24, max: 47 },
    { label: '48-71', min: 48, max: 71 },
    { label: '72-144', min: 72, max: 144 },
    { label: '145+', min: 145, max: Infinity }
];

function getScreenPrintTier(qty) {
    // Under 24 uses 24-47 pricing (+ LTM fee applied separately)
    if (qty < 24) return SCREENPRINT_TIERS[0];
    for (const tier of SCREENPRINT_TIERS) {
        if (qty >= tier.min && qty <= tier.max) return tier;
    }
    return SCREENPRINT_TIERS[SCREENPRINT_TIERS.length - 1];
}

// Find the pricing tier from the Caspio tiers array for a given qty.
// Clamps to the top tier when qty exceeds all tier maxes — otherwise a
// capped top tier (e.g. ScreenPrint's 145-576) silently reprices anything
// above the cap at the worst tier.
function findPricingTier(tiers, qty) {
    if (!tiers || tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    const match = sorted.find(t =>
        qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)
    );
    if (match) return match;
    const top = sorted[sorted.length - 1];
    if (qty > (top.maxQty ?? Infinity)) return top;
    return sorted[0];
}

async function recalculatePricing() {
    // Collect products from table (parent rows only)
    const productList = collectProductsFromTable();

    // Dark-garment reminder — evaluated on every reprice so a navy hoodie added
    // mid-quote still nudges while the underbase toggle is off.
    try { updateDarkGarmentNudge(productList); } catch (_) {}

    if (productList.length === 0) {
        updatePricingDisplay({
            totalQuantity: 0,
            tier: '24-47',
            subtotal: 0,
            ltmFee: 0,
            setupFees: printConfig.setupFee,
            grandTotal: printConfig.setupFee
        });
        // Clear all price and total cells
        document.querySelectorAll('.cell-price').forEach(cell => {
            cell.textContent = '-';
        });
        document.querySelectorAll('.cell-total').forEach(cell => {
            cell.textContent = '-';
        });
        return;
    }

    // Calculate total quantity across all products
    let totalQty = 0;
    productList.forEach(p => {
        totalQty += p.totalQty || 0;
    });

    // Determine tier based on total quantity. NOTE: getScreenPrintTier's labels are a
    // STATIC fallback only — the real displayed/saved tier label is derived below from the
    // matched Caspio bundle tier. SCREENPRINT_TIERS drifted from Caspio's boundaries after the
    // 2026-06-19 remap (it labels qty 48 "37-72" while Caspio prices the "48-71" tier).
    const tier = getScreenPrintTier(totalQty);
    let caspioTierLabel = null;

    // LTM fee — from Caspio Pricing_Tiers.LTM_Fee (the matched qty tier), NOT
    // hardcoded $75/$50 bands. The SCP service exposes `ltmFee` on each
    // primaryLocationPricing tier row (the fee is the same across color counts).
    // Fetch the first product's bundle (cached — the loop re-uses it) to read it.
    // Fall back to the documented bands WITH a warning only if the API is silent,
    // so a Caspio LTM change reaches the builder with no deploy (matches the
    // /pricing/screen-print calculator, which already reads it from the API).
    let baseLtmFee = 0;
    const _ltmStyle = productList.find(p => p.style)?.style;
    if (_ltmStyle) {
        try {
            const _ltmBundle = await screenPrintPricingService.fetchPricingData(_ltmStyle);
            const _plp = _ltmBundle && _ltmBundle.primaryLocationPricing;
            const _anyTiers = _plp ? (Object.values(_plp).find(p => p && Array.isArray(p.tiers))?.tiers || []) : [];
            let _m = _anyTiers.find(t => totalQty >= t.minQty && totalQty <= (t.maxQty ?? Infinity));
            if (!_m && _anyTiers.length) _m = [..._anyTiers].sort((a, b) => a.minQty - b.minQty)[0]; // below lowest tier → use lowest (LTM territory)
            if (_m && Number.isFinite(Number(_m.ltmFee))) baseLtmFee = Number(_m.ltmFee);
        } catch (e) { /* fall through to the warned fallback below */ }
    }
    // Fallback ONLY when the API is silent (rare). Matches the CURRENT Caspio model ($50 LTM at
    // the 24-47 tier; none at 48+) — was the stale pre-2026-06-19 $75/$50 bands. Surfaces a VISIBLE
    // warning (de-duped) so a rep never saves a silently-estimated fee. (2026-06-20 audit SCP-5)
    if (!baseLtmFee && totalQty > 0 && totalQty <= 47) {
        baseLtmFee = 50;
        console.warn('[ScreenPrint] LTM fee unavailable from API — using $' + baseLtmFee + ' fallback');
        if (!window._scpLtmFallbackWarned && typeof showToast === 'function') {
            window._scpLtmFallbackWarned = true;
            showToast('Small-batch fee is an estimate — live pricing didn\'t return it. Verify before saving.', 'warning');
        }
    }
    const wouldHaveLTM = baseLtmFee > 0;

    const ltmWrapper = document.getElementById('spc-ltm-wrapper');
    if (ltmWrapper) {
        if (wouldHaveLTM) {
            ltmWrapper.style.display = '';
            if (!document.querySelector('#spc-ltm-panel .ltm-control-panel')) {
                renderLtmControlPanel('spc-ltm-panel', { feeAmount: baseLtmFee });
                initLtmControlListeners('spc-ltm-panel', () => {
                    recalculatePricing();
                    markScreenPrintDirty();
                });
            } else {
                setLtmControlState('spc-ltm-panel', { feeAmount: baseLtmFee });
            }
        } else {
            ltmWrapper.style.display = 'none';
            setLtmControlState('spc-ltm-panel', { enabled: true, displayMode: 'builtin' });
        }
    }

    // Read LTM control state
    const ltmState = getLtmControlState('spc-ltm-panel');
    const ltmEnabled = wouldHaveLTM ? ltmState.enabled : true;
    const ltmDisplayMode = ltmState.displayMode || 'builtin';
    const ltmFee = (wouldHaveLTM && ltmEnabled) ? baseLtmFee : 0;
    const perUnitLTM = ltmFee > 0 ? Math.floor(ltmFee / totalQty * 100) / 100 : 0;

    // Safety stripes: per-piece-per-location surcharge from Caspio Service_Codes
    // 'SP-STRIPE' (fallback $2). (Pricing=API)
    const locationCount = printConfig.backLocation ? 2 : 1;
    const safetyStripesPerPiece = printConfig.isSafetyStripes ? (getServicePrice('SP-STRIPE', 2.00) * locationCount) : 0;

    let subtotal = 0;
    const pricedProducts = [];
    const droppedProducts = []; // products that couldn't be priced (surfaced after the loop)
    let firstPricing = null;  // Capture first product's pricing for nudge savings calc
    let firstTierData = null;

    try {
        // Process each product
        for (const product of productList) {
            const style = product.style;

            // Fetch Screen Print pricing data for this style
            const pricingData = await screenPrintPricingService.fetchPricingData(style);

            if (!pricingData) {
                console.warn(`No pricing data for ${style}`);
                droppedProducts.push({ style, reason: 'no pricing data returned' });
                continue;
            }

            // Get primary location pricing (garment + print)
            const frontColors = printConfig.frontColors.toString();
            const primaryPricing = pricingData.primaryLocationPricing?.[frontColors];

            if (!primaryPricing || !primaryPricing.tiers) {
                console.warn(`No primary pricing for ${frontColors} colors`);
                droppedProducts.push({ style, reason: `no pricing for ${frontColors}-color front` });
                continue;
            }

            // Find the tier data for this quantity
            const tierData = findPricingTier(primaryPricing.tiers, totalQty);
            if (!tierData) { droppedProducts.push({ style, reason: `no price tier for qty ${totalQty}` }); continue; }

            // Capture first product's pricing for nudge savings calculation
            if (!firstPricing) {
                firstPricing = primaryPricing;
                firstTierData = tierData;
                // Caspio-accurate tier label from the MATCHED bundle tier (not the static
                // SCREENPRINT_TIERS map) — mirrors the engine (quote-cart-engine.js:624-632).
                const _hasMax = tierData.maxQty != null && isFinite(Number(tierData.maxQty));
                caspioTierLabel = _hasMax ? (tierData.minQty + '-' + tierData.maxQty) : (tierData.minQty + '+');
            }

            // Get additional location pricing if back location enabled
            let additionalPricePerPiece = 0;
            if (printConfig.backLocation) {
                const backColors = printConfig.backColors.toString();
                const additionalPricing = pricingData.additionalLocationPricing?.[backColors];
                const additionalTier = (additionalPricing && additionalPricing.tiers)
                    ? findPricingTier(additionalPricing.tiers, totalQty)
                    : null;
                if (!additionalTier || typeof additionalTier.pricePerPiece !== 'number') {
                    // Never silently price the back print at $0 (Rule 4) — same guard the
                    // sleeve loop below already has; the engine hard-throws this case.
                    droppedProducts.push({ style, reason: `no add-location pricing for a ${backColors}-color back print` });
                    continue;
                }
                additionalPricePerPiece = additionalTier.pricePerPiece;
            }

            // Sleeves — each checked sleeve is its OWN additional print location at its own color count,
            // priced like the back (additionalLocationPricing[colors] at the POOLED qty), SUMMED, never
            // re-rounded (pricePerPiece is already HalfDollarCeil'd in the service). Mirrors engine
            // quote-cart-engine.js priceScpGroup so the builder matches the engine/Quick Quote to the cent.
            let sleeveAddlPerPiece = 0;
            let sleeveDropped = false;
            for (const c of (printConfig.sleeveColorsList || [])) {
                const sleevePricing = pricingData.additionalLocationPricing?.[String(c)];
                if (!sleevePricing || !sleevePricing.tiers) {
                    droppedProducts.push({ style, reason: `no add-location pricing for a ${c}-color sleeve` });
                    sleeveDropped = true;
                    break;
                }
                const sleeveTier = findPricingTier(sleevePricing.tiers, totalQty);
                if (!sleeveTier || typeof sleeveTier.pricePerPiece !== 'number') {
                    droppedProducts.push({ style, reason: `no add-location price tier (qty ${totalQty}) for a ${c}-color sleeve` });
                    sleeveDropped = true;
                    break;
                }
                sleeveAddlPerPiece += sleeveTier.pricePerPiece;
            }
            if (sleeveDropped) continue; // never silently price a sleeve at $0 (Rule 4)

            // No silent M/L substitution for an unpriced size — the engine refuses the
            // same case (quote-cart-engine.js:726-731) and substituting drops the
            // extended-size upcharge, so builder and engine would disagree per SKU.
            const unpricedSize = Object.entries(product.sizeBreakdown || {})
                .find(([sz, q]) => q > 0 && typeof tierData.prices?.[sz] !== 'number');
            if (unpricedSize) {
                droppedProducts.push({ style, reason: `no price for size ${unpricedSize[0]} at tier ${caspioTierLabel || (tierData.minQty + '+')}` });
                continue;
            }

            // Find parent row for this product
            const parentRow = document.querySelector(`tr[data-style="${style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`);
            if (!parentRow) continue;

            const rowId = parentRow.dataset.rowId;
            let productSubtotal = 0;      // ALL sizes (for sidebar subtotal)
            let parentOnlySubtotal = 0;   // Standard sizes only (for parent row Total cell)

            // Calculate and display price for each size
            Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
                if (qty <= 0) return;

                // Base price for this size from primary location — guaranteed present by
                // the unpricedSize guard above (no M/L fallback: that silently dropped
                // extended-size upcharges and broke builder↔engine parity).
                let sizePrice = tierData.prices[size];

                // Add additional location price (back)
                sizePrice += additionalPricePerPiece;

                // Add sleeve additional-location price(s) — left + right, each at its own color count
                sizePrice += sleeveAddlPerPiece;

                // Add safety stripes (front/back only — sleeves get no hi-vis stripe)
                sizePrice += safetyStripesPerPiece;

                // Display price: builtin mode adds LTM per-unit, separate mode shows base price
                const displayPrice = (ltmDisplayMode === 'builtin' && perUnitLTM > 0) ? sizePrice + perUnitLTM : sizePrice;
                // Use displayPrice for subtotal so row totals match displayed unit prices
                productSubtotal += displayPrice * qty;

                // Update row price cell (for standard sizes, update parent row)
                // Note: 2XL/XXL are child rows but NOT in SIZE06_EXTENDED_SIZES (they go in Size05 column)
                const isExtendedSize = SIZE06_EXTENDED_SIZES.includes(size) || size === '2XL' || size === 'XXL';
                if (!isExtendedSize) {
                    parentOnlySubtotal += displayPrice * qty;
                }
                if (!isExtendedSize) {
                    const priceCell = document.getElementById(`row-price-${rowId}`);
                    if (priceCell) {
                        priceCell.textContent = `$${displayPrice.toFixed(2)}`;
                    }
                } else {
                    // Extended size - find child row
                    const childRowId = childRowMap[rowId]?.[size];
                    if (childRowId) {
                        const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                        if (childPriceCell) {
                            childPriceCell.textContent = `$${displayPrice.toFixed(2)}`;
                        }
                        // Update child row total (qty × price)
                        const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                        if (childTotalCell) {
                            const childTotal = displayPrice * qty;
                            childTotalCell.textContent = qty > 0 ? `$${childTotal.toFixed(2)}` : '-';
                        }
                    }
                }
            });

            // Update parent row total (standard sizes only — child rows show their own totals)
            const parentTotalCell = document.getElementById(`row-total-${rowId}`);
            if (parentTotalCell) {
                const displayTotal = parentOnlySubtotal > 0 ? parentOnlySubtotal : productSubtotal;
                parentTotalCell.textContent = product.totalQty > 0 ? `$${displayTotal.toFixed(2)}` : '-';
            }

            // Update pricing breakdown for the row
            updateRowBreakdownScreenPrint(rowId, product, tierData);

            subtotal += productSubtotal;
            // Persist a fully-priced, save-ready snapshot. saveAndGetLink() reads
            // these instead of re-scraping the DOM. (The old save map read
            // product.qty/.sizes/.unitPrice — fields collectProductsFromTable never
            // returns — so saved quote_items had empty sizes and $0 unit prices,
            // which the ShopWorks push then under-billed.) unitPrice is the per-
            // product BLENDED price (productSubtotal / qty) so the saved LineTotal and
            // the pushed order total exactly equal the quoted subtotal, even when
            // extended-size upcharges make per-size prices differ within a product.
            const _pqty = product.totalQty || 0;
            pricedProducts.push({
                product,
                prices: tierData.prices,
                tier: caspioTierLabel || tier.label,
                // save-ready fields (consumed by saveAndGetLink → ScreenPrintQuoteService)
                style: product.style,
                productName: product.productName || product.style,
                color: product.color,
                catalogColor: product.catalogColor,
                sizeBreakdown: product.sizeBreakdown,
                totalQty: _pqty,
                unitPrice: _pqty > 0 ? Math.round((productSubtotal / _pqty) * 100) / 100 : 0,
                lineTotal: Math.round(productSubtotal * 100) / 100,
                ltmPerUnit: perUnitLTM,
                imageUrl: product.imageUrl || ''
            });
        }

        // Surface any product that couldn't be priced. It was EXCLUDED from the
        // subtotal/saved/pushed quote with only a console.warn before, so a rep could
        // quote and push a total that silently dropped a line. Erik's #1 rule. (2026-06-01)
        if (droppedProducts.length > 0) {
            const styles = [...new Set(droppedProducts.map(d => d.style))].join(', ');
            showToast(`Could not price ${styles} for the selected colors/quantity — NOT included in the total. Adjust colors/qty or remove before saving.`, 'error');
        }

        // Calculate grand total — in builtin mode LTM is already in subtotal via inflated unit prices
        const setupFees = printConfig.setupFee;
        const grandTotal = (ltmDisplayMode === 'builtin') ? subtotal + setupFees : subtotal + ltmFee + setupFees;

        // Compute per-piece savings for next tier nudge
        let nextTierSavings = null;
        if (pricedProducts.length > 0 && firstPricing?.tiers && firstTierData) {
            try {
                const currentTierIdx = firstPricing.tiers.indexOf(firstTierData);
                if (currentTierIdx >= 0 && currentTierIdx < firstPricing.tiers.length - 1) {
                    const nextTier = firstPricing.tiers[currentTierIdx + 1];
                    const curPrice = firstTierData.prices?.['M'] ?? firstTierData.prices?.['L'] ?? Object.values(firstTierData.prices || {})[0] ?? 0;
                    const nextPrice = nextTier.prices?.['M'] ?? nextTier.prices?.['L'] ?? Object.values(nextTier.prices || {})[0] ?? 0;
                    if (curPrice > nextPrice) nextTierSavings = curPrice - nextPrice;
                }
            } catch (e) { /* graceful fallback */ }
        }

        // Store LTM state for tax/discount calculations
        window.currentPricingData = window.currentPricingData || {};
        window.currentPricingData.ltmFee = ltmFee;
        window.currentPricingData.ltmDisplayMode = ltmDisplayMode;
        window.currentPricingData.nextTierSavings = nextTierSavings;

        // Update pricing display sidebar
        updatePricingDisplay({
            totalQuantity: totalQty,
            tier: caspioTierLabel || tier.label,
            subtotal: subtotal,
            ltmFee: ltmFee,
            ltmDisplayMode: ltmDisplayMode,
            setupFees: setupFees,
            grandTotal: grandTotal,
            products: pricedProducts
        });

    } catch (error) {
        console.error('Screen Print Pricing calculation error:', error);
        showToast('Error calculating prices. Please try again.', 'error');
    }

    // Mark as dirty for auto-save (2026 consolidation)
    markScreenPrintDirty();
}

// Update row breakdown display for Screen Print
function updateRowBreakdownScreenPrint(rowId, product, tierData) {
    const breakdownEl = document.getElementById(`breakdown-${rowId}`);
    if (!breakdownEl) return;

    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    const basePrice = tierData.prices?.['M'] || tierData.prices?.['L'] || 0;

    let breakdownHtml = `
        <span class="breakdown-item">${frontName} (${printConfig.frontColors}-color)</span>
        <span class="breakdown-separator">|</span>
        <span class="breakdown-item">$${basePrice.toFixed(2)}/ea</span>
    `;

    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">${backName} (${printConfig.backColors}-color)</span>
        `;
    }

    if (printConfig.leftSleeveColors > 0) {
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">L Sleeve (${printConfig.leftSleeveColors}-color)</span>
        `;
    }
    if (printConfig.rightSleeveColors > 0) {
        breakdownHtml += `
            <span class="breakdown-separator">+</span>
            <span class="breakdown-item">R Sleeve (${printConfig.rightSleeveColors}-color)</span>
        `;
    }

    breakdownEl.innerHTML = breakdownHtml;
}

function collectProductsFromTable() {
    const products = [];
    // Only collect from parent rows (not child rows or AL config rows)
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row):not(.al-config-row)');

    rows.forEach(row => {
        const rowId = parseInt(row.id.replace('row-', ''));
        const style = row.dataset.style;
        const parentColor = row.dataset.color;
        const parentCatalogColor = row.dataset.catalogColor || '';

        if (!style || !parentColor) return;

        // Group sizes by color - different colors become separate products
        const colorGroups = {};

        // Initialize parent color group
        colorGroups[parentCatalogColor] = {
            color: parentColor,
            catalogColor: parentCatalogColor,
            sizeBreakdown: {},
            totalQty: 0
        };

        // Collect size inputs from parent row (standard or remapped sizes)
        // IMPORTANT: Exclude .xxxl-picker-btn (shows TOTAL) and .osfa-qty-input (handled separately)
        // Note: For non-standard products (combo, youth, toddler, tall), data-size is remapped
        const sizeCategory = row.dataset.sizeCategory;
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            if (qty > 0 && size) {
                colorGroups[parentCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[parentCatalogColor].totalQty += qty;
            }
        });

        // Handle OSFA-only products (beanies, caps, bags)
        // OSFA qty is stored in parent row, not child rows
        if (row.dataset.isOsfaOnly === 'true') {
            const osfaQty = parseInt(row.dataset.osfaQty) || 0;
            if (osfaQty > 0) {
                colorGroups[parentCatalogColor].sizeBreakdown['OSFA'] = osfaQty;
                colorGroups[parentCatalogColor].totalQty += osfaQty;
            }
        }

        // Collect extended sizes from CHILD ROWS - GROUP BY COLOR
        // Child rows may have different colors than parent
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const size = childRow.dataset.extendedSize;
            const childColor = childRow.dataset.color;
            const childCatalogColor = childRow.dataset.catalogColor || '';
            const qtyDisplay = childRow.querySelector('.qty-display');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0 && size) {
                // Initialize color group if different from parent
                if (!colorGroups[childCatalogColor]) {
                    colorGroups[childCatalogColor] = {
                        color: childColor,
                        catalogColor: childCatalogColor,
                        sizeBreakdown: {},
                        totalQty: 0
                    };
                }

                colorGroups[childCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[childCatalogColor].totalQty += qty;
            }
        });

        // Create product entry for each color group with quantities
        Object.entries(colorGroups).forEach(([catalogColor, group]) => {
            if (group.totalQty > 0) {
                products.push({
                    style: style,
                    color: group.color,
                    catalogColor: group.catalogColor,
                    productName: row.dataset.productName || style,
                    sizeBreakdown: group.sizeBreakdown,
                    totalQty: group.totalQty,
                    rowId: rowId
                });
            }
        });
    });

    return products;
}

function updatePricingDisplay(pricing) {
    // Store for toggle reference
    window.currentPricingData = pricing;

    // Update sidebar print configuration display
    updateSidebarPrintConfig();

    // Basic pricing info
    const totalQty = pricing.totalQuantity || 0;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('subtotal').textContent = `$${(pricing.subtotal || 0).toFixed(2)}`;
    updatePerUnitPrice(pricing.subtotal || 0, pricing.totalQuantity || 0);
    updateQuantityNudge(pricing.totalQuantity || 0, 'scp', window.currentPricingData?.nextTierSavings);

    // Small-batch warning banner — Caspio charges the $50 LTM through the 24-47 tier,
    // so the banner must show whenever the fee applies (<48), not just under the
    // 24-piece minimum. The old <24 gate had reps promising "the fee disappears at 24"
    // and getting contradicted by their own 30-piece quote. (expert audit 2026-07-07)
    const minWarning = document.getElementById('min-order-warning');
    if (minWarning) {
        minWarning.style.display = (totalQty > 0 && totalQty < 48) ? 'flex' : 'none';
    }

    // Update pre-tax subtotal for tax calculation (grand total before tax)
    document.getElementById('pre-tax-subtotal').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;
    { const _pb = document.getElementById('pre-tax-subtotal'); if (_pb) _pb.dataset.base = (pricing.grandTotal || 0); }  // [2026-06-08] P1: stable base for updateTaxCalculation (no re-read of its own fee-inflated textContent → double-count)

    // Update tax calculation
    updateTaxCalculation();

    // Pricing tier
    const pricingTierEl = document.getElementById('pricing-tier');
    pricingTierEl.textContent = pricing.tier || '24-47';

    // LTM display — show table row only in "separate" mode
    const ltmTableRow = document.getElementById('ltm-fee-row');
    const ltmTableUnit = document.getElementById('ltm-row-unit');
    const ltmTableTotal = document.getElementById('ltm-row-total');
    const ltmMode = pricing.ltmDisplayMode || 'builtin';

    if (pricing.ltmFee > 0 && ltmMode === 'separate') {
        if (ltmTableRow) {
            ltmTableRow.style.display = 'table-row';
            if (ltmTableUnit) ltmTableUnit.textContent = `$${pricing.ltmFee.toFixed(2)}`;
            if (ltmTableTotal) ltmTableTotal.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
    } else {
        if (ltmTableRow) ltmTableRow.style.display = 'none';
    }

    // Update all fee table rows (setup, art, design, rush, discount)
    updateFeeTableRows();

    // [2026-06-08] keep the order-summary band (recap + ship-to card) current on every recompute
    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
}

// Update sidebar to reflect current print configuration
function updateSidebarPrintConfig() {
    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    document.getElementById('sidebar-front').textContent = `${frontName} (${printConfig.frontColors}-color)`;

    // Back location
    const backRow = document.getElementById('sidebar-back-row');
    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        document.getElementById('sidebar-back').textContent = `${backName} (${printConfig.backColors}-color)`;
        backRow.style.display = 'flex';
    } else {
        backRow.style.display = 'none';
    }

    // Sleeves (each its own color count)
    const sleevesRow = document.getElementById('sidebar-sleeves-row');
    if (sleevesRow) {
        const sleeveBits = [];
        if (printConfig.leftSleeveColors > 0) sleeveBits.push(`L ${printConfig.leftSleeveColors}-color`);
        if (printConfig.rightSleeveColors > 0) sleeveBits.push(`R ${printConfig.rightSleeveColors}-color`);
        if (sleeveBits.length) {
            document.getElementById('sidebar-sleeves').textContent = sleeveBits.join(', ');
            sleevesRow.style.display = 'flex';
        } else {
            sleevesRow.style.display = 'none';
        }
    }

    // Total screens
    document.getElementById('sidebar-screens').textContent = printConfig.totalScreens;

    // Dark garment
    document.getElementById('sidebar-dark-row').style.display = printConfig.isDarkGarment ? 'flex' : 'none';

    // Safety stripes
    const stripesRow = document.getElementById('sidebar-stripes-row');
    if (printConfig.isSafetyStripes) {
        const locationCount = printConfig.backLocation ? 2 : 1;
        document.getElementById('sidebar-stripes-cost').textContent = `+$${(getServicePrice('SP-STRIPE', 2.00) * locationCount).toFixed(2)}/pc`;
        stripesRow.style.display = 'flex';
    } else {
        stripesRow.style.display = 'none';
    }

    // Update fee table rows (includes setup fee)
    updateFeeTableRows();
}

// ============================================================
// TAX CALCULATION & ADDITIONAL CHARGES
// ============================================================

function updateTaxCalculation() {
    const includeTax = document.getElementById('include-tax')?.checked;
    const subtotalEl = document.getElementById('pre-tax-subtotal');
    const taxRowEl = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalEl = document.getElementById('grand-total-with-tax');

    // Get base subtotal from pricing
    // [2026-06-08] P1: read the STABLE base (data-base set by updatePricingDisplay), NOT the textContent this fn writes
    // back — else a 2nd direct call double-adds fees+shipping. Falls back to textContent only before the first recalc.
    let subtotal = parseFloat(subtotalEl?.dataset?.base);
    if (!Number.isFinite(subtotal)) subtotal = parseFloat(subtotalEl?.textContent?.replace(/[$,]/g, '') || 0);

    // Add art charge if enabled
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    subtotal += artCharge;

    // Add graphic design fee
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designFee = designHours * getServicePrice('GRT-75', 75);
    subtotal += designFee;

    // Add rush fee if present
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    subtotal += rushFee;

    // Add Vellum + Color Change setup fees (Erik's official parts, 2026-06-27).
    // Added before discount so a percent discount applies to them (parity with art/rush).
    const _xfTax = getScpExtraFees();
    subtotal += _xfTax.vellumFee + _xfTax.colorChangeFee;

    // Subtract discount if present
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    let discount = 0;
    if (discountType === 'percent') {
        discount = subtotal * (discountAmount / 100);
    } else {
        discount = discountAmount;
    }
    subtotal = Math.max(0, subtotal - discount);

    // Add shipping fee (after discount — shipping not discountable)
    const shippingFee = parseFloat(document.querySelector('#spc-order-fields .os-shipping-fee')?.value) || 0;
    subtotal += shippingFee;

    // Update the pre-tax subtotal display to show adjusted amount
    if (subtotalEl) {
        subtotalEl.textContent = '$' + subtotal.toFixed(2);
    }

    // Dynamic tax rate from ZIP lookup or manual input
    // [2026-06-08] P0 (#1 rule): Number.isFinite so an exempt/out-of-state rate of 0 STAYS 0% — `parseFloat('0')||10.1`
    // is the falsy trap that re-taxed exempt orders at 10.1% on screen when include-tax was still checked.
    const _scpRate = parseFloat(document.getElementById('tax-rate-input')?.value);
    const taxRateInput = Number.isFinite(_scpRate) ? _scpRate : 10.2;
    const taxRate = taxRateInput / 100;

    // Sales Tax row stays visible for invoice transparency; label shows the rate when charged,
    // "(exempt)"/"(not charged)" when $0 (best-of-both level-up 2026-06-14).
    const _scpTaxLabel = document.getElementById('tax-rate-label');
    if (taxRowEl) taxRowEl.style.display = 'flex';
    if (_scpTaxLabel) _scpTaxLabel.textContent = (includeTax && taxRateInput > 0)
        ? `Sales Tax (${taxRateInput}%)`
        : ((window._isWholesale || window._taxExempt) ? 'Sales Tax (exempt)' : 'Sales Tax (not charged)');
    if (includeTax) {
        const tax = Math.round(subtotal * taxRate * 100) / 100;
        taxAmountEl.textContent = '$' + tax.toFixed(2);
        grandTotalEl.textContent = '$' + (subtotal + tax).toFixed(2);
    } else {
        taxAmountEl.textContent = '$0.00';
        grandTotalEl.textContent = '$' + subtotal.toFixed(2);
    }
    // Mirror the grand TOTAL into the sticky sidebar total bar (EMB/DTF parity 2026-06-14) so the rep sees
    // the customer-facing total even though the Subtotal/Tax/TOTAL box moved to the footer invoice band.
    { const _sgt = document.getElementById('sidebar-grand-total'); const _stb = document.getElementById('sidebar-total-bar');
      if (_sgt) _sgt.textContent = grandTotalEl.textContent;
      if (_stb) _stb.hidden = false; }
    // Keep the always-visible Push button + readiness checklist in lock-step with product/fee changes.
    try { if (typeof updateScpPushButtonState === 'function') updateScpPushButtonState(); } catch (_) {}
}

// toggleAdditionalCharges() moved to quote-builder-utils.js

// [2026-06-08] Wholesale / reseller toggle (mirror EMB). Per-order checkbox by the sales tax → 0 tax + push GL 2203.
function toggleWholesale() {
    const cb = document.getElementById('wholesale-checkbox');
    window._isWholesale = !!(cb && cb.checked);
    const incTax = document.getElementById('include-tax');
    const rateInput = document.getElementById('tax-rate-input');
    if (window._isWholesale) {
        if (incTax) incTax.checked = false;
        if (rateInput) rateInput.value = '0';
    } else {
        // [2026-06-08] un-toggle wholesale → re-derive the correct rate for the ship address (parity with DTF's
        // guarded lookupTaxRate) instead of leaving a flat 10.1: exempt stays 0; out-of-state 0; WA re-fetches the DOR rate.
        if (window._taxExempt) {
            if (incTax) incTax.checked = false;
            if (rateInput) rateInput.value = '0';
        } else {
            if (incTax) incTax.checked = true;
            const _st = (document.querySelector('#spc-order-fields .os-ship-state')?.value || 'WA').toUpperCase();
            const _zip = document.querySelector('#spc-order-fields .os-ship-zip');
            if (_st === 'WA') {
                if (rateInput) rateInput.value = '10.2';  // fallback until the async DOR lookup (ZIP blur) returns — Milton 10.2% since 2026-07-06
                if (_zip && (_zip.value || '').trim().length >= 5) { _zip.dispatchEvent(new Event('blur')); }
            } else if (rateInput) {
                rateInput.value = '0';  // out-of-state — no WA tax
            }
        }
    }
    updateTaxCalculation();
}
window.toggleWholesale = toggleWholesale;

function updateAdditionalCharges() {
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const grtRate = getServicePrice('GRT-75', 75);
    // Missing-service-code visible warning — shared helper (quote-builder-utils.js),
    // synced with DTF/EMB (2026-07-04, Erik's #1 rule). Covers the silent case where
    // codes loaded but GRT-75 is absent, so a rep never bills the $75 fallback unwarned.
    if (designHours > 0 && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing('GRT-75', grtRate, 'Graphic-design');
    }
    const designFee = designHours * grtRate;
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const badge = document.getElementById('charges-badge');

    // Vellum + Color Change (Erik's official setup parts, 2026-06-27)
    const _xf = getScpExtraFees();
    const vellumTotalEl = document.getElementById('vellum-charge-total');
    if (vellumTotalEl) vellumTotalEl.textContent = _xf.vellumFee.toFixed(2);
    const colorChangeTotalEl = document.getElementById('color-change-charge-total');
    if (colorChangeTotalEl) colorChangeTotalEl.textContent = _xf.colorChangeFee.toFixed(2);

    const netCharges = artCharge + designFee + rushFee + _xf.vellumFee + _xf.colorChangeFee - discountAmount;
    if (netCharges !== 0) {
        badge.textContent = (netCharges >= 0 ? '+' : '') + '$' + netCharges.toFixed(2);
        badge.classList.remove('hidden');
        // Phase A: panel is collapsed by default — the first non-zero charge
        // (edit-load, draft restore) pops it open ONCE so fees never load hidden.
        if (typeof autoExpandFeesOnFirstCharge === 'function') autoExpandFeesOnFirstCharge();
    } else {
        badge.classList.add('hidden');
    }

    // Update fee table rows
    updateFeeTableRows();

    // Recalculate tax with new charges
    updateTaxCalculation();
}

function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const prefix = document.getElementById('discount-prefix');
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const presetDropdown = document.getElementById('discount-preset');
    const amountInput = document.getElementById('discount-amount');

    if (discountType === 'percent') {
        // Show preset dropdown, hide number input
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (presetDropdown) presetDropdown.style.display = 'block';
        // Set amount from preset (unless custom is selected)
        if (presetDropdown && presetDropdown.value !== 'custom') {
            if (amountInput) amountInput.value = presetDropdown.value;
        }
    } else {
        // Show number input, hide preset dropdown
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (prefix) prefix.textContent = '$';
    }

    updateAdditionalCharges();
}

function handleDiscountPresetChange() {
    const preset = document.getElementById('discount-preset')?.value;
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const amountInput = document.getElementById('discount-amount');
    const prefix = document.getElementById('discount-prefix');

    if (preset === 'custom') {
        // Show number input for custom entry
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (prefix) prefix.textContent = '%';
        if (amountInput) amountInput.focus();
    } else {
        // Use preset value
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (amountInput) amountInput.value = preset;
    }
    updateFeeTableRows();
}

function handleDiscountReasonPresetChange() {
    const preset = document.getElementById('discount-reason-preset')?.value;
    const customInput = document.getElementById('discount-reason');

    if (preset === 'custom') {
        // Show custom input and focus it
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = '';
            customInput.focus();
        }
    } else {
        // Hide custom input and use preset value
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = preset;
        }
    }
    updateFeeTableRows();
}

// ============================================================
// ARTWORK SERVICES FUNCTIONS
// toggleArtworkServices(), toggleArtCharge(), updateArtworkCharges()
// moved to quote-builder-utils.js
// ============================================================

// Vellum + Color Change — Erik's official screen-print setup parts (2026-06-27).
// Prices come from Caspio Service_Codes via getServicePrice so a Caspio price
// change needs no deploy (Pricing=API rule). One source for the tax calc,
// fee-table rows, badge, and save path so they can't disagree.
function getScpExtraFees() {
    const vellumQty = Math.max(0, parseInt(document.getElementById('vellum-qty')?.value || 0, 10) || 0);
    const vellumPrice = getServicePrice('Vellum', 10);
    const colorChangeQty = Math.max(0, parseInt(document.getElementById('color-change-qty')?.value || 0, 10) || 0);
    const colorChangePrice = getServicePrice('Color Chg', 15);
    return {
        vellumQty, vellumPrice, vellumFee: vellumQty * vellumPrice,
        colorChangeQty, colorChangePrice, colorChangeFee: colorChangeQty * colorChangePrice,
    };
}

function updateFeeTableRows() {
    // Setup fee row (always shown for screen print)
    const setupFeeRow = document.getElementById('setup-fee-table-row');
    const setupScreensLabel = document.getElementById('setup-screens-label');
    const setupFeeUnit = document.getElementById('setup-fee-unit');
    const setupFeeTotal = document.getElementById('setup-fee-total');
    if (setupFeeRow && printConfig) {
        const screens = printConfig.totalScreens || 1;
        // Use the already-computed API-driven setup fee so the displayed row
        // (read back into discountableSubtotal) matches the charged value.
        const fee = (printConfig.setupFee != null) ? printConfig.setupFee : screens * SCREEN_FEE;
        // SPSU "Screen Print Set Up Charge" — per-screen price from Caspio (Pricing=API).
        const perScreen = getServicePrice('SPSU', SCREEN_FEE);
        const perEl = document.getElementById('setup-per-screen-label');
        if (perEl) perEl.textContent = '$' + (Number.isInteger(perScreen) ? perScreen : perScreen.toFixed(2));
        setupScreensLabel.textContent = screens + ' screen' + (screens > 1 ? 's' : '');
        setupFeeUnit.textContent = '$' + fee.toFixed(2);
        setupFeeTotal.textContent = '$' + fee.toFixed(2);
    }

    // Art charge row
    const artChargeRow = document.getElementById('art-charge-row');
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    if (artChargeRow) {
        if (artChargeToggle?.checked && artCharge > 0) {
            artChargeRow.style.display = 'table-row';
            document.getElementById('art-charge-unit').textContent = '$' + artCharge.toFixed(2);
            document.getElementById('art-charge-total').textContent = '$' + artCharge.toFixed(2);
        } else {
            artChargeRow.style.display = 'none';
        }
    }

    // Graphic design row
    const graphicDesignRow = document.getElementById('graphic-design-row');
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designTotal = designHours * getServicePrice('GRT-75', 75);
    if (graphicDesignRow) {
        if (designHours > 0) {
            graphicDesignRow.style.display = 'table-row';
            document.getElementById('design-hours-label').textContent = designHours;
            document.getElementById('graphic-design-unit').textContent = '$' + designTotal.toFixed(2);
            document.getElementById('graphic-design-total-row').textContent = '$' + designTotal.toFixed(2);
        } else {
            graphicDesignRow.style.display = 'none';
        }
    }

    // Rush fee row
    const rushFeeRow = document.getElementById('rush-fee-row');
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    if (rushFeeRow) {
        if (rushFee > 0) {
            rushFeeRow.style.display = 'table-row';
            document.getElementById('rush-fee-unit').textContent = '$' + rushFee.toFixed(2);
            document.getElementById('rush-fee-total').textContent = '$' + rushFee.toFixed(2);
        } else {
            rushFeeRow.style.display = 'none';
        }
    }

    // Vellum + Color Change rows (Erik's official setup parts, 2026-06-27)
    const _xf = getScpExtraFees();
    const vellumRow = document.getElementById('vellum-fee-row');
    if (vellumRow) {
        if (_xf.vellumQty > 0) {
            vellumRow.style.display = 'table-row';
            const vql = document.getElementById('vellum-qty-label'); if (vql) vql.textContent = _xf.vellumQty;
            const vpl = document.getElementById('vellum-per-label'); if (vpl) vpl.textContent = '$' + (Number.isInteger(_xf.vellumPrice) ? _xf.vellumPrice : _xf.vellumPrice.toFixed(2));
            const vqc = document.getElementById('vellum-qty-cell'); if (vqc) vqc.textContent = _xf.vellumQty;
            const vu = document.getElementById('vellum-fee-unit'); if (vu) vu.textContent = '$' + _xf.vellumPrice.toFixed(2);
            const vt = document.getElementById('vellum-fee-total'); if (vt) vt.textContent = '$' + _xf.vellumFee.toFixed(2);
        } else {
            vellumRow.style.display = 'none';
        }
    }
    const colorChangeRow = document.getElementById('color-change-fee-row');
    if (colorChangeRow) {
        if (_xf.colorChangeQty > 0) {
            colorChangeRow.style.display = 'table-row';
            const cql = document.getElementById('color-change-qty-label'); if (cql) cql.textContent = _xf.colorChangeQty;
            const cpl = document.getElementById('color-change-per-label'); if (cpl) cpl.textContent = '$' + (Number.isInteger(_xf.colorChangePrice) ? _xf.colorChangePrice : _xf.colorChangePrice.toFixed(2));
            const cqc = document.getElementById('color-change-qty-cell'); if (cqc) cqc.textContent = _xf.colorChangeQty;
            const cu = document.getElementById('color-change-fee-unit'); if (cu) cu.textContent = '$' + _xf.colorChangePrice.toFixed(2);
            const ct = document.getElementById('color-change-fee-total'); if (ct) ct.textContent = '$' + _xf.colorChangeFee.toFixed(2);
        } else {
            colorChangeRow.style.display = 'none';
        }
    }

    // Discount row
    const discountRow = document.getElementById('discount-row');
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    if (discountRow) {
        if (discountAmount > 0) {
            discountRow.style.display = 'table-row';
            // Calculate actual discount
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                // Calculate discountable subtotal (products + additional services + setup fees)
                const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '') || 0);
                const artCharge = document.getElementById('art-charge-toggle')?.checked
                    ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
                const designFee = parseFloat(document.getElementById('graphic-design-hours')?.value || 0) * getServicePrice('GRT-75', 75);
                const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
                const setupFee = parseFloat(document.getElementById('setup-fee-total')?.textContent?.replace(/[$,]/g, '') || 0);
                const ltmFee = window.currentPricingData?.ltmFee || 0;

                const discountableSubtotal = productsSubtotal + artCharge + designFee + rushFee + setupFee + ltmFee
                    + _xf.vellumFee + _xf.colorChangeFee;
                actualDiscount = discountableSubtotal * (discountAmount / 100);
            }
            const reasonLabel = document.getElementById('discount-reason-label');
            if (reasonLabel) {
                let labelParts = [];
                if (discountType === 'percent') {
                    labelParts.push(`${discountAmount}%`);
                }
                if (discountReason) {
                    labelParts.push(discountReason);
                }
                reasonLabel.textContent = labelParts.length > 0 ? `(${labelParts.join(' - ')})` : '';
            }
            document.getElementById('discount-unit').textContent = '-$' + actualDiscount.toFixed(2);
            document.getElementById('discount-total').textContent = '-$' + actualDiscount.toFixed(2);
        } else {
            discountRow.style.display = 'none';
        }
    }
}

// toggleSaveShare() → moved to quote-builder-utils.js

// ============================================================
// ACTIONS (Save, Print, Email, Copy)
// ============================================================

async function printQuote() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before printing', 'error');
        return;
    }

    // Pricing-loaded guard (ported from DTF dtf-quote-builder.js printQuote, 2026-07-04):
    // if the pricing service never initialized (API down at page load — the form stays
    // interactive) the products would price to $0, so Print would emit a silent $0.00
    // customer PDF with no error. Erik's #1 rule: visible failure, never a silent wrong
    // price. Two-part — (1) pricing loaded, (2) products subtotal > 0.
    if (!window.currentPricingData || typeof screenPrintPricingService === 'undefined' || !screenPrintPricingService) {
        showToast('Pricing data is not loaded — cannot print. Please refresh and try again.', 'error');
        return;
    }
    if (!((window.currentPricingData.subtotal || 0) > 0)) {
        showToast('Quote totals computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before printing.', 'error');
        return;
    }

    showLoading(true);

    try {
        // Settle pricing before scraping the DOM — SCP was the only builder printing
        // without a pre-print recalc, leaving a stale-price window (EMB awaits its
        // recalc, DTF prints from state math). (expert audit 2026-07-07)
        await recalculatePricing();

        // Build pricing data structure for invoice generator
        const pricingData = buildScreenprintPricingData(products);

        // Generate and open print window
        const invoiceGenerator = new EmbroideryInvoiceGenerator();
        // Full reference block for the PDF (expert audit 2026-07-07): SCP collected
        // phone / project / PO / ship date / notes on-page and then dropped them ALL
        // from the printed quote — reps promised "the PO number is on the quote" and
        // it was only true on the other builders.
        const _osd = (typeof getOrderShippingData === 'function') ? getOrderShippingData('spc-order-fields') : {};
        const customerData = {
            name: document.getElementById('customer-name')?.value || 'Customer',
            company: document.getElementById('company-name')?.value || '',
            email: document.getElementById('customer-email')?.value || '',
            phone: document.getElementById('customer-phone')?.value?.trim() || _osd.phone || '',
            project: document.getElementById('project-name')?.value?.trim() || '',
            poNumber: _osd.poNumber || '',
            orderNumber: _osd.orderNumber || '',
            reqShipDate: _osd.reqShipDate || '',
            notes: _osd.notes || '',
            shipping: (_osd.shipAddress || _osd.shipZip)
                ? { address: _osd.shipAddress, city: _osd.shipCity, state: _osd.shipState, zip: _osd.shipZip, method: _osd.shipMethod }
                : null,
            salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com'
        };

        const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 300);

        showToast('Opening print dialog...', 'success');
    } catch (error) {
        console.error('Print error:', error);
        showToast('Error generating PDF', 'error');
    }

    showLoading(false);
}

/**
 * Build pricing data structure for EmbroideryInvoiceGenerator from Screen Print products
 * FIXED: Read unit prices from DOM cells where they're already displayed
 */
function buildScreenprintPricingData(products) {
    const currentPricing = window.currentPricingData || {};
    // No #quote-id element exists in this page — the old DOM read made EVERY printed
    // PDF show a fabricated `SPC-<epoch>` number that matches nothing in Quote Mgmt.
    // Use the real saved id; null lets the shared generator print "DRAFT" when unsaved.
    const quoteId = (typeof editingQuoteId !== 'undefined' && editingQuoteId) || (typeof _scpPushQuoteId !== 'undefined' && _scpPushQuoteId) || null;

    // Build products array with line items for invoice
    const invoiceProducts = [];

    products.forEach(product => {
        // Build line items from size breakdown
        const lineItems = [];

        // Find the parent row for this product to read its displayed price
        const parentRow = document.querySelector(
            `tr[data-style="${product.style}"][data-catalog-color="${product.catalogColor}"]:not(.child-row)`
        );
        const rowId = parentRow?.dataset?.rowId;

        // Read base price from parent row's price cell (displayed as $25.99)
        const basePriceCell = document.getElementById(`row-price-${rowId}`);
        const basePriceText = basePriceCell?.textContent || '$0.00';
        const baseUnitPrice = parseFloat(basePriceText.replace('$', '').replace(',', '')) || 0;

        // Base sizes (S, M, L, XL) - Note: L is internal, LG is display.
        // XXL/2XL are NOT base — they live in child rows whose price cell carries
        // any upcharge, so they price via the child-row loop below.
        const baseSizes = ['S', 'M', 'L', 'LG', 'XL'];
        const baseSizeQtys = {};
        let baseQty = 0;

        Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
            // Normalize L to LG for display
            const displaySize = size === 'L' ? 'LG' : size;
            if (baseSizes.includes(size) && qty > 0) {
                baseSizeQtys[displaySize] = qty;
                baseQty += qty;
            }
        });

        // OSFA-only products (beanies, bags) store qty on the PARENT row — no child
        // row exists, so the parent price cell is the right price source. The old
        // childRowMap lookup found nothing and printed the OSFA line at $0.00.
        const osfaQty = product.sizeBreakdown?.['OSFA'] || 0;
        if (osfaQty > 0 && baseQty === 0) {
            lineItems.push({
                description: `OSFA(${osfaQty})`,
                quantity: osfaQty,
                unitPrice: baseUnitPrice,
                total: osfaQty * baseUnitPrice
            });
        } else if (baseQty > 0) {
            // Build description like "S(2) M(3) LG(2)"
            const desc = Object.entries(baseSizeQtys)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ');

            lineItems.push({
                description: desc,
                quantity: baseQty,
                unitPrice: baseUnitPrice,
                total: baseQty * baseUnitPrice
            });
        }

        // Extended / non-standard sizes — iterate ALL sizeBreakdown keys (NOT a
        // hardcoded list) so tall (LT/XLT…), youth (YS/YM…), toddler, fitted-cap
        // combos (S/M, L/XL), XS/XXS, 7XL+, pants (3032) and shorts (W30) are not
        // dropped from the PDF while their $ stays in the grand total — the same
        // under-footing the 2026-06-11 DTF audit caught (EMB got this fix 2026-06-04).
        Object.entries(product.sizeBreakdown || {}).forEach(([size, qty]) => {
            if (!(qty > 0)) return;
            if (baseSizes.includes(size)) return;             // already in the grouped base line
            if (size === 'OSFA' && baseQty === 0) return;     // OSFA-only handled above
            // Read the child row's price cell (carries any size upcharge)
            const childRowId = childRowMap[rowId]?.[size];
            const childPriceCell = document.getElementById(`row-price-${childRowId}`);
            const childPriceText = childPriceCell?.textContent || '';
            let unitPrice = parseFloat(childPriceText.replace(/[^0-9.]/g, '')) || 0;
            if (!(unitPrice > 0)) unitPrice = baseUnitPrice;  // no child row (remapped parent size) → parent price

            lineItems.push({
                description: `${size}(${qty})`,
                quantity: qty,
                unitPrice: unitPrice,
                total: qty * unitPrice,
                hasUpcharge: true
            });
        });

        if (lineItems.length > 0) {
            invoiceProducts.push({
                product: {
                    style: product.style,
                    title: product.productName || product.style,
                    color: product.color
                },
                lineItems: lineItems
            });
        }
    });

    // Calculate totals from line items
    let subtotal = 0;
    invoiceProducts.forEach(p => {
        p.lineItems.forEach(item => {
            subtotal += item.total;
        });
    });

    // Build print config description for invoice
    const frontDesc = getLocationName(printConfig.frontLocation) + ` (${printConfig.frontColors}-color)`;
    const backDesc = printConfig.backLocation ? getLocationName(printConfig.backLocation) + ` (${printConfig.backColors}-color)` : null;
    const sleeveParts = [];
    if (printConfig.leftSleeveColors > 0) sleeveParts.push(`Left Sleeve (${printConfig.leftSleeveColors}-color)`);
    if (printConfig.rightSleeveColors > 0) sleeveParts.push(`Right Sleeve (${printConfig.rightSleeveColors}-color)`);
    const sleeveDesc = sleeveParts.length ? sleeveParts.join(', ') : null;

    // Calculate safety stripes total for display as separate line item
    const locationCount = printConfig.backLocation ? 2 : 1;
    const safetyStripesTotal = printConfig.isSafetyStripes
        ? (currentPricing.totalQuantity * getServicePrice('SP-STRIPE', 2.00) * locationCount)
        : 0;

    // Get art charge and graphic design from UI
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);

    // Get rush fee and discount from UI
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    // Vellum + Color Change setup parts (Erik's official list, 2026-06-27). Read
    // inline (like art/rush above) rather than via getScpExtraFees() so this PDF
    // function stays self-contained for the brace-extracted unit test harness.
    const vellumQtyPdf = Math.max(0, parseInt(document.getElementById('vellum-qty')?.value || 0, 10) || 0);
    const vellumFeePdf = vellumQtyPdf * getServicePrice('Vellum', 10);
    const colorChangeQtyPdf = Math.max(0, parseInt(document.getElementById('color-change-qty')?.value || 0, 10) || 0);
    const colorChangeFeePdf = colorChangeQtyPdf * getServicePrice('Color Chg', 15);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    let discount = discountAmount;
    if (discountType === 'percent' && discountAmount > 0) {
        discount = subtotal * (discountAmount / 100);
    }

    // Read tax + LTM state here (was post-overridden in printQuote pre-3.1.0).
    // '10.1' fallback preserves pre-3.1 behavior: an empty input previously fell
    // through to the generator's hardcoded WA standard rate.
    const taxRateRaw = document.getElementById('tax-rate-input')?.value || '10.2';
    const ltmState = getLtmControlState('spc-ltm-panel');
    const ltmDistributed = (ltmState.displayMode === 'builtin');

    const preTaxText = document.getElementById('pre-tax-subtotal')?.textContent || '';
    const preTaxVal = parseFloat(preTaxText.replace(/[$,]/g, ''));

    return window.QuotePricingData.buildPricingData({
        method: 'SCP',
        quoteId: quoteId,
        tier: currentPricing.tier || '24-47',
        products: invoiceProducts,
        subtotal: subtotal,
        grandTotal: currentPricing.grandTotal || subtotal,
        // Authoritative pre-tax adjusted subtotal (base + art/graphic-design/rush
        // + shipping − discount) drives the PDF tax + GRAND TOTAL so the printed
        // total matches the on-screen #grand-total-with-tax.
        preTaxSubtotal: isNaN(preTaxVal) ? undefined : preTaxVal,
        includeTax: document.getElementById('include-tax') ? !!document.getElementById('include-tax').checked : true,
        taxRate: taxRateRaw,
        // Itemized on the PDF so the rows foot to the total (already inside preTaxSubtotal).
        shippingFee: parseFloat(document.querySelector('#spc-order-fields .os-shipping-fee')?.value) || 0,
        setupFees: currentPricing.setupFees || printConfig.setupFee || 0,
        additionalServicesTotal: 0,
        // Empty logos means embroidery specs section will be skipped
        logos: [],
        // Screenprint-specific
        printConfig: {
            front: frontDesc,
            back: backDesc,
            sleeves: sleeveDesc,
            isDarkGarment: printConfig.isDarkGarment,
            hasSafetyStripes: printConfig.isSafetyStripes,
            totalScreens: printConfig.totalScreens || 1
        },
        ltmFee: currentPricing.ltmFee || 0,
        ltmDistributed: ltmDistributed,
        safetyStripesTotal: safetyStripesTotal,
        totalQuantity: currentPricing.totalQuantity || 0,
        artCharge: artCharge,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: rushFee,
        // Screen-print setup parts (Erik's official list, 2026-06-27) — itemized on the PDF
        vellumQty: vellumQtyPdf,
        vellumFee: vellumFeePdf,
        colorChangeQty: colorChangeQtyPdf,
        colorChangeFee: colorChangeFeePdf,
        discount: discount,
        discountReason: discountReason
    });
}

function getLocationName(code) {
    const names = {
        'LC': 'Left Chest',
        'FF': 'Full Front',
        'JF': 'Jumbo Front',
        'FB': 'Full Back',
        'JB': 'Jumbo Back'
    };
    return names[code] || code;
}

/**
 * Save quote and get shareable link
 * Uses ScreenPrintQuoteService and QuoteShareModal
 */
async function saveAndGetLink(opts = {}) {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products before saving', 'error');
        return;
    }

    // Validate required fields
    const customerName = document.getElementById('customer-name')?.value?.trim();
    const customerEmail = document.getElementById('customer-email')?.value?.trim();

    if (!customerName || !customerEmail) {
        showToast('Please enter customer name and email', 'error');
        if (!customerName) document.getElementById('customer-name')?.focus();
        else if (!customerEmail) document.getElementById('customer-email')?.focus();
        return;
    }

    // Format-validate like EMB/DTF do — SCP was the only builder that saved (then
    // emailed to) a malformed address; EmailJS "succeeds" at shape-valid junk and
    // the follow-up call is "I never got it". (expert audit 2026-07-07)
    if (typeof isValidEmail === 'function' && !isValidEmail(customerEmail)) {
        showToast('Customer email looks invalid — please correct it before saving', 'error');
        document.getElementById('customer-email')?.focus();
        return;
    }

    // Get save button for loading state
    const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
    }

    try {
        // Refresh pricing before saving so the persisted unit prices + line totals
        // match what the rep sees (and what gets pushed to ShopWorks).
        // recalculatePricing() repopulates window.currentPricingData.products with
        // fully-priced, save-ready rows (sizeBreakdown + blended unitPrice).
        await recalculatePricing();
        const pricing = window.currentPricingData || {};
        const pricedRows = Array.isArray(pricing.products) ? pricing.products : [];

        if (pricedRows.length === 0) {
            throw new Error('No priced products to save — please re-check the product table.');
        }

        // Format items for quote service from the priced snapshot (NOT a DOM
        // re-scrape). Each row carries sizeBreakdown + the blended unit price.
        const items = pricedRows.map(row => ({
            styleNumber: row.style,
            productName: row.productName || row.style,
            color: row.color,
            colorCode: row.catalogColor || row.color,
            quantity: row.totalQty,
            sizeBreakdown: row.sizeBreakdown || {},
            basePrice: row.unitPrice || 0,
            unitPrice: row.unitPrice || 0,
            ltmPerUnit: row.ltmPerUnit || 0,
            lineTotal: row.lineTotal || ((row.totalQty || 0) * (row.unitPrice || 0)),
            imageUrl: row.imageUrl || ''
        }));

        // Get additional charges for saving (2026 fee refactor)
        const artChargeToggle = document.getElementById('art-charge-toggle');
        const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
        const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
        const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);
        const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
        // Vellum + Color Change + Reorder — Erik's official setup parts (2026-06-27).
        // Same getScpExtraFees() source the on-screen math + fee table use, so the
        // saved/pushed total matches what the rep sees (parity rule).
        const _xf = getScpExtraFees();
        const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
        const discountType = document.getElementById('discount-type')?.value || 'fixed';
        const discountReason = document.getElementById('discount-reason')?.value || '';
        // Calculate discountable subtotal for percentage discount (products + additional services + setup fees)
        const discountableSubtotal = (pricing.subtotal || 0) + artCharge + graphicDesignCharge + rushFee + (printConfig.setupFee || 0) + (pricing.ltmFee || 0)
            + _xf.vellumFee + _xf.colorChangeFee;
        const discount = discountType === 'percent' ? (discountableSubtotal * discountAmount / 100) : discountAmount;
        const discountPercent = discountType === 'percent' ? discountAmount : 0;

        // Phase 9 — include uploaded reference artwork file refs (if any)
        // Phase 11.3 (2026-05-24) — also pull newDesignName + per-file .placement
        // from the rich-mode widget, so the proxy can emit Designs[{name, Locations[]}]
        // for new-artwork pushes (creates a fresh design record in ShopWorks).
        const referenceArtwork = (window._scpArtwork && typeof window._scpArtwork.getFiles === 'function')
            ? window._scpArtwork.getFiles()
            : [];
        const newDesignName = (window._scpArtwork && typeof window._scpArtwork.getDesignName === 'function')
            ? (window._scpArtwork.getDesignName() || '').trim()
            : '';

        // Phase 11.1 — include design # if rep picked one from the combobox
        const designNumber = document.getElementById('design-number')?.value?.trim() || '';

        // Collect quote data
        const quoteData = {
            customerName: customerName,
            customerEmail: customerEmail,
            companyName: document.getElementById('company-name')?.value?.trim() || '',
            // ShopWorks customer # — attaches the pushed order to the real customer
            // (else the proxy falls back to the no-customer catch-all 3739).
            customerNumber: document.getElementById('customer-number')?.value?.trim() || '',
            salesRep: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com',
            referenceArtwork, // → SCP quote-service writes to quote_sessions.Notes JSON
            newDesignName,    // → Notes.newDesignName; proxy reads this for Designs[0].name
            designNumber,     // → SCP quote-service writes to quote_sessions.Notes.designNumber
            items: items,
            totalQuantity: pricing.totalQuantity || items.reduce((sum, p) => sum + p.quantity, 0),
            subtotal: pricing.subtotal || 0,
            ltmFee: pricing.ltmFee || 0,
            setupFees: printConfig.setupFee || 0,
            grandTotal: pricing.grandTotal || 0,
            frontLocation: printConfig.frontLocation,
            frontColors: printConfig.frontColors,
            backLocation: printConfig.backLocation,
            backColors: printConfig.backColors,
            leftSleeveColors: printConfig.leftSleeveColors,
            rightSleeveColors: printConfig.rightSleeveColors,
            sleeveColorsList: printConfig.sleeveColorsList,
            totalScreens: printConfig.totalScreens,
            isDarkGarment: printConfig.isDarkGarment,
            hasSafetyStripes: printConfig.isSafetyStripes,
            printSetup: {
                frontLocation: printConfig.frontLocation,
                frontColors: printConfig.frontColors,
                backLocation: printConfig.backLocation,
                backColors: printConfig.backColors,
                leftSleeveColors: printConfig.leftSleeveColors,
                rightSleeveColors: printConfig.rightSleeveColors,
                sleeveColorsList: printConfig.sleeveColorsList,
                totalScreens: printConfig.totalScreens,
                isDarkGarment: printConfig.isDarkGarment,
                isSafetyStripes: printConfig.isSafetyStripes
            },
            // Additional charges (2026 fee refactor)
            artCharge: artCharge,
            graphicDesignHours: graphicDesignHours,
            graphicDesignCharge: graphicDesignCharge,
            rushFee: rushFee,
            // Screen-print setup parts (Erik's official list, 2026-06-27)
            vellumQty: _xf.vellumQty,
            vellumFee: _xf.vellumFee,
            colorChangeQty: _xf.colorChangeQty,
            colorChangeFee: _xf.colorChangeFee,
            discount: discount,
            discountPercent: discountPercent,
            discountReason: discountReason,
            // LTM display preferences (2026-03-22)
            ltmDisplayMode: getLtmControlState('spc-ltm-panel').displayMode || 'builtin',
            ltmWaived: !getLtmControlState('spc-ltm-panel').enabled,
            isWholesale: document.getElementById('wholesale-checkbox')?.checked || false,  // [2026-06-08] → IsWholesale; push routes to GL 2203
            // [2026-06-08] P0 (review woaaypuz4): the SCP save quoteData NEVER passed taxRate (getOrderShippingData omits it),
            // so the service fell back to 10.1% → every out-of-state / exempt / non-10.1 SCP quote saved TaxRate=10.1 and the
            // /quote + /invoice mirror billed full WA tax. Pass it explicitly (mirror DTF). Erik's #1 rule.
            // [2026-06-14] Gate on the Include Tax checkbox (parity with DTF L1965 / EMB save). Unchecking it shows $0 tax
            // on screen (updateTaxCalculation L3559) + on the PDF (buildScreenprintPricingData includeTax), but save used to
            // pass the raw rate input (still 10.1, since only wholesale/CRM-exempt zero it) → the saved/mirrored/pushed quote
            // billed full WA tax while the rep saw $0 = silent wrong price (Erik's #1 rule). Unchecked → save TaxRate 0.
            taxRate: (document.getElementById('include-tax') && !document.getElementById('include-tax').checked)
                ? 0
                : parseFloat(document.getElementById('tax-rate-input')?.value || '10.2'),
            // Order & shipping fields (2026-03-22)
            ...getOrderShippingData('spc-order-fields')
        };

        let result;
        if (editingQuoteId) {
            // Update existing quote
            result = await quoteService.updateQuote(editingQuoteId, quoteData);
            if (result && result.success) {
                result.quoteID = editingQuoteId;
                // Update revision number
                editingRevision = result.revision;
                updateEditModeUI(editingQuoteId, editingRevision);
            }
        } else {
            // Create new quote
            result = await quoteService.saveQuote(quoteData);
        }

        if (result.success) {

            // Clear auto-save draft on successful save (2026 consolidation)
            if (spPersistence) {
                spPersistence.clearDraft();
            }

            // Phase 8 (2026-05-23): reveal Push-to-ShopWorks button after save.
            // Gated behind ?enableScpPush=1 query param until Erik confirms
            // OnSite integration IDs in proxy config/manageorders-scp-config.js.
            if (typeof showScpPushButton === 'function') {
                showScpPushButton(result.quoteID);
            }

            // Show success modal with shareable link — SKIPPED on the silent auto-save before a Push
            // (scpPushToShopWorks passes skipShareModal:true; the push preview opens instead).
            if (opts.skipShareModal) {
                /* auto-saved for Push to ShopWorks — no share modal */
            } else if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                QuoteShareModal.show(result.quoteID, editingQuoteId ? `Updated to Rev ${editingRevision}` : null);
            } else {
                // Fallback
                const url = `${window.location.origin}/quote/${result.quoteID}`;
                const message = editingQuoteId
                    ? `Quote updated!\n\nQuote ID: ${result.quoteID}\nRevision: ${editingRevision}\n\nShareable Link:\n${url}`
                    : `Quote saved!\n\nQuote ID: ${result.quoteID}\n\nShareable Link:\n${url}`;
                alert(message);
            }
            // Return the freshly-saved ID so callers (Push) can confirm THIS save
            // succeeded — never rely on a persistent _scpPushQuoteId from an earlier
            // save, which would push a stale revision if this save just failed.
            return result.quoteID;
        } else {
            throw new Error(result.error || 'Failed to save quote');
        }

    } catch (error) {
        console.error('[ScreenPrint] Save error:', error);
        showToast('Error saving quote: ' + error.message, 'error');
        return null; // signal failure to callers (Push must not proceed)
    } finally {
        // Restore button state
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
}

// Legacy function - redirects to saveAndGetLink
async function saveQuote() {
    return saveAndGetLink();
}

async function spcEmailQuote() {
    // editingQuoteId only exists on ?edit= loads — a fresh save never set it, so Email
    // was a dead end on every NEW quote ("save first" loop). Mirror EMB embEmailQuote:
    // accept the just-saved id, and auto-save when unsaved OR edited-since-save so the
    // customer never receives a stale revision. (expert audit 2026-07-07)
    let quoteId = editingQuoteId || _scpPushQuoteId;
    const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : false;
    if (!quoteId || dirty) {
        showToast('Saving quote before emailing…', 'info', 2500);
        quoteId = await saveAndGetLink({ skipShareModal: true });
        if (!quoteId) return;   // save failed/blocked — its error is already on screen
    }
    await emailQuote({
        quoteId,
        customerEmail: document.getElementById('customer-email')?.value?.trim(),
        customerName: document.getElementById('customer-name')?.value?.trim(),
        salesRepEmail: document.getElementById('sales-rep')?.value
    });
}

async function copyToClipboard() {
    const products = collectProductsFromTable();
    if (products.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    try {
        // Get current pricing from sidebar
        const pricing = window.currentPricingData || {
            totalQuantity: 0,
            tier: '24-47',
            subtotal: 0,
            ltmFee: 0,
            setupFees: printConfig.setupFee,
            grandTotal: printConfig.setupFee
        };

        const text = generateQuoteText(products, pricing);
        await navigator.clipboard.writeText(text);

        showToast('Quote copied to clipboard!', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Error copying to clipboard', 'error');
    }
}

function generateQuoteText(products, pricing) {
    const lines = [
        'NORTHWEST CUSTOM APPAREL - SCREEN PRINT QUOTE',
        '================================================',
        `Date: ${new Date().toLocaleDateString()}`,
        `Customer: ${document.getElementById('customer-name')?.value || 'N/A'}`,
        `Company: ${document.getElementById('company-name')?.value || 'N/A'}`,
    ];

    // Print Configuration
    lines.push('');
    lines.push('PRINT CONFIGURATION:');
    const frontName = LOCATION_NAMES[printConfig.frontLocation] || printConfig.frontLocation;
    lines.push(`  Front: ${frontName} (${printConfig.frontColors}-color)`);
    if (printConfig.backLocation) {
        const backName = LOCATION_NAMES[printConfig.backLocation] || printConfig.backLocation;
        lines.push(`  Back: ${backName} (${printConfig.backColors}-color)`);
    }
    // Sleeve locations — mirror buildScreenprintPricingData's sleeveDesc so the copied
    // text lists them (were silently omitted; sleeves are their own print locations). (2026-07-04)
    if (printConfig.leftSleeveColors > 0) {
        lines.push(`  Left Sleeve: (${printConfig.leftSleeveColors}-color)`);
    }
    if (printConfig.rightSleeveColors > 0) {
        lines.push(`  Right Sleeve: (${printConfig.rightSleeveColors}-color)`);
    }
    if (printConfig.isDarkGarment) {
        lines.push(`  Dark Garment: Yes (includes white underbase)`);
    }
    if (printConfig.isSafetyStripes) {
        const locationCount = printConfig.backLocation ? 2 : 1;
        lines.push(`  Safety Stripes: +$${(getServicePrice('SP-STRIPE', 2.00) * locationCount).toFixed(2)}/piece`);
    }
    lines.push(`  Total Screens: ${printConfig.totalScreens}`);
    lines.push(`  Setup Fee: $${printConfig.setupFee.toFixed(2)}`);

    // Products
    lines.push('');
    lines.push('PRODUCTS:');
    lines.push('------------------------------------------------');
    products.forEach(p => {
        const sizes = Object.entries(p.sizeBreakdown || {})
            .filter(([s, q]) => q > 0)
            .map(([s, q]) => `${s}:${q}`)
            .join(' ');
        lines.push(`${p.style} - ${p.color} | ${sizes} | Qty: ${p.totalQty || 0}`);
    });

    // Summary
    lines.push('');
    lines.push('------------------------------------------------');
    lines.push(`Total Pieces: ${pricing.totalQuantity || 0}`);
    lines.push(`Pricing Tier: ${pricing.tier || '24-47'}`);
    lines.push(`Products Subtotal: $${(pricing.subtotal || 0).toFixed(2)}`);
    lines.push(`Setup Fee (${printConfig.totalScreens} screens): $${(pricing.setupFees || 0).toFixed(2)}`);
    if (pricing.ltmFee > 0) {
        lines.push(`Less Than Minimum Fee: $${pricing.ltmFee.toFixed(2)}`);
    }

    // Itemize the SAME fee set the on-screen footer / PDF / saved total charge
    // (were all omitted here → copied TOTAL disagreed with the invoice). Read the
    // fees from the same UI inputs buildScreenprintPricingData() uses. (2026-07-04)
    const _artCharge = document.getElementById('art-charge-toggle')?.checked
        ? (parseFloat(document.getElementById('art-charge')?.value || 0) || 0) : 0;
    if (_artCharge > 0) lines.push(`Logo Mockup & Review: $${_artCharge.toFixed(2)}`);
    const _designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0) || 0;
    const _designFee = _designHours * getServicePrice('GRT-75', 75);
    if (_designFee > 0) lines.push(`Graphic Design (${_designHours} hr): $${_designFee.toFixed(2)}`);
    const _rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0) || 0;
    if (_rushFee > 0) lines.push(`Rush Fee: $${_rushFee.toFixed(2)}`);
    const _xfCopy = getScpExtraFees();
    if (_xfCopy.vellumFee > 0) lines.push(`Vellum Print (${_xfCopy.vellumQty}): $${_xfCopy.vellumFee.toFixed(2)}`);
    if (_xfCopy.colorChangeFee > 0) lines.push(`Color Change (${_xfCopy.colorChangeQty}): $${_xfCopy.colorChangeFee.toFixed(2)}`);
    const _shipFee = parseFloat(document.querySelector('#spc-order-fields .os-shipping-fee')?.value) || 0;
    if (_shipFee > 0) lines.push(`Shipping: $${_shipFee.toFixed(2)}`);
    // Discount row (mirrors the on-screen #discount-total after % is resolved).
    const _discTotalText = document.getElementById('discount-total')?.textContent || '';
    const _discRow = document.getElementById('discount-row');
    if (_discRow && _discRow.style.display !== 'none' && _discTotalText) {
        lines.push(`Discount: ${_discTotalText}`);
    }

    lines.push('');
    // Totals — read the DISPLAYED footer values (Subtotal / Tax / TOTAL) so the copied
    // text always agrees with the on-screen footer, PDF, and saved total. Recomputing
    // here previously excluded art/design/rush/vellum/color-change/tax → mismatch. (2026-07-04)
    const _subEl = document.getElementById('pre-tax-subtotal');
    const _taxEl = document.getElementById('tax-amount');
    const _totalEl = document.getElementById('grand-total-with-tax');
    const _subText = _subEl?.textContent?.trim();
    const _taxText = _taxEl?.textContent?.trim();
    const _totalText = _totalEl?.textContent?.trim();
    // Fall back to the pricing object only if the footer isn't rendered yet.
    lines.push(`Subtotal: ${_subText || ('$' + (pricing.grandTotal || 0).toFixed(2))}`);
    const _taxLabelEl = document.getElementById('tax-rate-label');
    lines.push(`${(_taxLabelEl?.textContent?.trim() || 'Sales Tax')}: ${_taxText || '$0.00'}`);
    lines.push(`TOTAL: ${_totalText || ('$' + (pricing.grandTotal || 0).toFixed(2))}`);
    lines.push('');
    lines.push('Northwest Custom Apparel | 253-922-5793');

    return lines.join('\n');
}

// ============================================================
// UTILITIES
// ============================================================

// showLoading(), showToast() → provided by quote-builder-utils.js


// =====================================================
// Push to ShopWorks (Phase 8 — 2026-05-23; gate lifted same day)
// =====================================================
// Mirrors the EMB/DTF pushToShopWorks() pattern: save the quote, then POST the
// quoteId to /api/scp-push/push-quote (the proxy reads it back, transforms it,
// and pushes to ShopWorks OnSite). The button is revealed after a successful save.
//
// NOTE: until Erik creates a dedicated SCP OnSite integration, pushed orders land
// under the EMB integration customer (id=3739) / order type 21 — see
// caspio-pricing-proxy/config/manageorders-scp-config.js. ExtSource 'NWCA-SCP'
// already tags them as screen print.

let _scpPushQuoteId = null;

function showScpPushButton(quoteId) {
    _scpPushQuoteId = quoteId;
    // The Push button is ALWAYS visible now (disabled-until-ready, EMB parity 2026-06-14); this just
    // records the saved quote id (the /preview endpoint needs it) and re-gates the button.
    if (typeof updateScpPushButtonState === 'function') updateScpPushButtonState();
}

// Always-visible Push button + "Before you push" readiness checklist gate (EMB parity 2026-06-14).
// Uses the shared renderBuilderPushReadiness() (quote-builder-utils.js) — gates: Customer #, ≥1 item,
// customer name, customer email — so the button is enabled only when a push/save can actually succeed.
function updateScpPushButtonState() {
    if (typeof renderBuilderPushReadiness !== 'function') return;
    renderBuilderPushReadiness({
        btnId: 'scp-push-shopworks-btn',
        hasProducts: () => { try { return collectProductsFromTable().length > 0; } catch (_) { return false; } }
    });
}
window.updateScpPushButtonState = updateScpPushButtonState;

// One-click Push: auto-SAVE first (silent — no share modal), then open the review/confirm preview.
// The button is gated by the checklist, so we only reach here when ready. The proxy's PushedToShopWorks
// 409 guard prevents a duplicate order if it is somehow clicked twice. (EMB-parity pushToShopWorks)
let _scpPushInFlight = false;
async function scpPushToShopWorks() {
    if (_scpPushInFlight) return;                 // re-entrancy guard (a double-click must not save/push twice)
    _scpPushInFlight = true;
    const label = document.getElementById('scp-push-shopworks-label');
    if (label) label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    try {
        // NOTE: do NOT disable the button here — openScpPushPreview() bails if the button is disabled.
        // Gate the push on THIS save's return value — not the persistent _scpPushQuoteId,
        // which survives from an edit-load/earlier save and would let a failed re-save
        // push the previous (stale) revision to ShopWorks.
        const savedId = await saveAndGetLink({ skipShareModal: true });
        if (!savedId) return;                              // this save failed / was blocked (error already shown)
        await openScpPushPreview();
    } finally {
        _scpPushInFlight = false;
        const _b = document.getElementById('scp-push-shopworks-btn');
        // Don't clobber the "Pushed ✓" success label once the push completed.
        if (label && (!_b || _b.dataset.pushed !== '1')) label.textContent = 'Push to ShopWorks';
        updateScpPushButtonState();   // renderBuilderPushReadiness skips re-gating when dataset.pushed==='1'
    }
}
window.scpPushToShopWorks = scpPushToShopWorks;

// Minimal HTML escaper for preview output (self-contained — no util dependency).
function _scpEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Open the preview-and-confirm modal — parity with EMB's openPushPreview().
// Fetches the exact ExternalOrderJson the backend would push (read-only /preview
// endpoint) so the rep reviews line items, order type and total before the order
// is created. If the modal or preview can't load, falls back to a direct
// confirm()-push so the rep is never blocked.
async function openScpPushPreview() {
    const btn = document.getElementById('scp-push-shopworks-btn');
    if (!btn || btn.disabled || !_scpPushQuoteId) return;
    // Warn before pushing with no ShopWorks Customer # — the order would silently
    // attach to placeholder customer 3739 instead of the real customer. EMB gates its
    // button on this; SCP/DTF warn at push time for parity. (2026-06-01)
    const _scpCust = document.getElementById('customer-number')?.value?.trim();
    if (!_scpCust && !confirm('No ShopWorks Customer # is set.\n\nThis order will attach to the placeholder customer (3739) instead of the real customer. Continue anyway?')) {
        return;
    }

    const modal = document.getElementById('scp-push-modal');
    const statusEl = document.getElementById('scp-push-status');
    const previewEl = document.getElementById('scp-push-preview');
    const confirmBtn = document.getElementById('scp-push-confirm');
    if (!modal || !previewEl || !confirmBtn) {
        return confirmScpPush(true); // modal markup missing → legacy direct push
    }

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('show');

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/scp-push/preview/${encodeURIComponent(_scpPushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderScpPushPreview(data.orderJson || {});
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (err) {
        console.error('[SCP Push] Preview error:', err);
        previewEl.innerHTML = '<div style="padding:16px; color:#b91c1c;">' +
            '<i class="fas fa-exclamation-triangle"></i> Could not load preview: ' + _scpEsc(err.message) +
            '<br><span style="color:#64748b;">You can still push below.</span></div>';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    }
}

// Render the modal body from the /preview orderJson.
function renderScpPushPreview(o) {
    const previewEl = document.getElementById('scp-push-preview');
    if (!previewEl) return;
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    const shipping = parseFloat(o.cur_Shipping) || 0;
    const discount = parseFloat(o.TotalDiscounts) || 0;
    const lineSum = lines.reduce((s, l) => s + (parseFloat(l.Price) || 0) * (parseFloat(l.Qty) || 0), 0);
    const preTax = lineSum + shipping - discount;

    let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:13px;">';
    html += '<div><span style="color:#64748b;">ShopWorks Order:</span> <strong>' + _scpEsc(o.ExtOrderID || '') + '</strong></div>';
    html += '<div><span style="color:#64748b;">Order type:</span> <strong>' + _scpEsc(String(o.id_OrderType || '')) + '</strong> <span style="color:#64748b;">(13 = Screen Print)</span></div>';
    html += '<div><span style="color:#64748b;">Customer #:</span> ' + _scpEsc(String(o.id_Customer || '')) + '</div>';
    html += '<div><span style="color:#64748b;">Designs:</span> ' + designs.length + '</div>';
    html += '</div>';

    html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<thead><tr style="text-align:left; border-bottom:1px solid #e5e7eb; color:#64748b;">' +
        '<th style="padding:4px;">Part</th><th style="padding:4px;">Description</th>' +
        '<th style="padding:4px; text-align:center;">Size</th><th style="padding:4px; text-align:right;">Qty</th>' +
        '<th style="padding:4px; text-align:right;">Price</th></tr></thead><tbody>';
    if (lines.length === 0) {
        html += '<tr><td colspan="5" style="padding:8px; color:#b91c1c;">No line items</td></tr>';
    } else {
        for (const l of lines) {
            html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="padding:4px; font-weight:600;">' + _scpEsc(l.PartNumber || '') + '</td>' +
                '<td style="padding:4px;">' + _scpEsc(l.Description || '') + '</td>' +
                '<td style="padding:4px; text-align:center;">' + _scpEsc(l.Size || '') + '</td>' +
                '<td style="padding:4px; text-align:right;">' + _scpEsc(String(l.Qty || '')) + '</td>' +
                '<td style="padding:4px; text-align:right;">$' + (parseFloat(l.Price) || 0).toFixed(2) + '</td></tr>';
        }
    }
    html += '</tbody></table>';
    html += '<div style="text-align:right; margin-top:10px; font-size:14px; font-weight:700;">' +
        'Order total (pre-tax): $' + preTax.toFixed(2) + '</div>';
    if (designs.length === 0) {
        html += '<div style="margin-top:10px; padding:8px 10px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:12px; color:#92400e;">' +
            '<i class="fas fa-exclamation-triangle"></i> No design linked — a rep must assign the design + screens in ShopWorks.</div>';
    }
    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). directFallback=true is the legacy
// path used when the modal couldn't open.
async function confirmScpPush(directFallback) {
    const mainBtn = document.getElementById('scp-push-shopworks-btn');
    const mainLabel = document.getElementById('scp-push-shopworks-label');
    const confirmBtn = document.getElementById('scp-push-confirm');
    const statusEl = document.getElementById('scp-push-status');
    if (!_scpPushQuoteId) return;

    if (directFallback) {
        if (!confirm(`Push quote ${_scpPushQuoteId} to ShopWorks?\n\nThis creates a new screen print order in OnSite.`)) return;
        if (mainBtn) { mainBtn.disabled = true; mainBtn.style.opacity = '0.6'; }
        if (mainLabel) mainLabel.textContent = 'Pushing...';
    } else if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';
    }

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const response = await fetch(`${apiBase}/api/scp-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: _scpPushQuoteId, isTest: false, force: false }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:6px;">Already pushed to ShopWorks.</div>';
                if (mainLabel) mainLabel.textContent = 'Already Pushed';
                if (mainBtn) mainBtn.style.background = '#28a745';
                if (typeof showToast === 'function') showToast('Already pushed to ShopWorks', 'info');
                closeScpPushPreview();
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // Success
        if (mainLabel) mainLabel.textContent = `Pushed ✓ (${data.extOrderId})`;
        if (mainBtn) { mainBtn.style.background = '#28a745'; mainBtn.disabled = true; mainBtn.dataset.pushed = '1'; }
        if (typeof showToast === 'function') showToast(`Pushed to ShopWorks as ${data.extOrderId}`, 'success');
        console.log('[SCP Push] Success:', data);
        closeScpPushPreview();

    } catch (error) {
        console.error('[SCP Push] Push error:', error);
        if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#b91c1c;">Push failed: ' + _scpEsc(error.message) + '</div>';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks'; }
        if (mainBtn) { mainBtn.disabled = false; mainBtn.style.opacity = '1'; }
        if (mainLabel) mainLabel.textContent = 'Push to ShopWorks';
        if (typeof showToast === 'function') showToast(`Push failed: ${error.message}`, 'error');
    }
}

function closeScpPushPreview() {
    const modal = document.getElementById('scp-push-modal');
    if (modal) modal.classList.remove('show');
}

// NOTE: scpPushToShopWorks (async, auto-save → preview) is declared above near the
// button-state helper and is the ONE bound to window.scpPushToShopWorks + the HTML
// onclick. Do NOT re-declare a back-compat alias here — a second `function
// scpPushToShopWorks()` at module scope hoists OVER the async version, so the button
// would call openScpPushPreview() WITHOUT the auto-save and silently no-op on a
// never-saved quote (_scpPushQuoteId === null). Call openScpPushPreview() directly if
// you need the bare preview. (regression fixed 2026-06-14)

// Expose for HTML onclick + cross-file callers
window.openScpPushPreview = openScpPushPreview;
window.renderScpPushPreview = renderScpPushPreview;
window.confirmScpPush = confirmScpPush;
window.closeScpPushPreview = closeScpPushPreview;
window.showScpPushButton = showScpPushButton;

// [2026-06-08] Shared order-summary band (Order Recap + Ship-To card) — DTF/SCP parity Phase 3.
// SCP ship fields are CLASS-based (.os-*) inside the single #spc-order-fields panel rendered by the shared
// renderOrderShippingFields(); selectors are scoped to that container so getShipFields()'s querySelector resolves
// uniquely. Fee class is .os-shipping-fee. No #it-shipping-amt (recap drops the Shipping row), no logo model.
// Estimator IS wired (estimateHooks below → Re-estimate shows); no modal → editOnclick omitted → no Edit. The .os-* panel + its tax
// listeners are SHARED (quote-builder-utils.js) and were NOT touched — the ship-field render hooks are SCP-local
// listeners attached in init (the .os-ship-* forEach). quote-order-summary.js loads before this file.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: {
            address: '#spc-order-fields .os-ship-address',
            city:    '#spc-order-fields .os-ship-city',
            state:   '#spc-order-fields .os-ship-state',
            zip:     '#spc-order-fields .os-ship-zip',
            method:  '#spc-order-fields .os-ship-method',
            fee:     '#spc-order-fields .os-shipping-fee',
            residential: '#ship-residential',
        },
        recap: {
            company: '#company-name',
            name:    '#customer-name',
            custNum: '#customer-number',
        },
        // [2026-06-08] Commit 6: SCP adopts the shared UPS-Ground estimator. configure() auto-points _cfg.estimate
        // at the module estimator (Re-estimate auto-lights). collectProductsFromTable returns {style, sizeBreakdown};
        // the module filters p.style && !isService (SCP rows have no isService flag → p.style is the real guard).
        estimateHooks: {
            collectProducts: function () { return (typeof collectProductsFromTable === 'function') ? collectProductsFromTable() : []; },
            onApplied: function () { if (typeof recalculatePricing === 'function') recalculatePricing(); },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// In-flight reprice pill (old-audit price-display #5, 2026-07-07): wrap the
// recalc entry point so slow /api/pricing-bundle refreshes show "Updating
// prices…" instead of silently displaying the previous numbers.
if (typeof wrapWithRepricingIndicator === 'function') {
    recalculatePricing = wrapWithRepricingIndicator(recalculatePricing);
}

/**
 * "auto %" rush chip (old-audit P2, 2026-07-07): the rush box was CSR mental
 * math on a moving subtotal — inconsistent rep-to-rep and stale after quote
 * changes. Fills the input from the live Caspio RUSH rate × everything-except-
 * rush (same base the % discount uses); the value stays a plain editable
 * dollar amount, so re-click after the quote changes.
 */
function applyRushPercent() {
    const rate = (typeof getSharedRushRate === 'function') ? getSharedRushRate() : 0.25;
    const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '')) || 0;
    if (!(productsSubtotal > 0)) { showToast('Add products first — rush is a % of the quote.', 'info'); return; }
    const artCharge = document.getElementById('art-charge-toggle')?.checked
        ? (parseFloat(document.getElementById('art-charge')?.value) || 0) : 0;
    const designFee = (parseFloat(document.getElementById('graphic-design-hours')?.value) || 0) * getServicePrice('GRT-75', 75);
    const setupFee = parseFloat(document.getElementById('setup-fee-total')?.textContent?.replace(/[$,]/g, '')) || 0;
    const xf = (typeof getScpExtraFees === 'function') ? getScpExtraFees() : { vellumFee: 0, colorChangeFee: 0 };
    const base = productsSubtotal + artCharge + designFee + setupFee + xf.vellumFee + xf.colorChangeFee;
    const el = document.getElementById('rush-fee');
    if (!el) return;
    el.value = (base * rate).toFixed(2);
    el.dispatchEvent(new Event('change', { bubbles: true }));   // runs updateAdditionalCharges()
    showToast(`Rush set to ${(rate * 100).toFixed(0)}% of $${base.toFixed(2)} — adjust if needed; re-click if the quote changes.`, 'success');
}
window.applyRushPercent = applyRushPercent;
