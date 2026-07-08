// ============================================================
// EMBROIDERY POWER QUOTE - Excel-Style Quote Builder
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
const API_BASE = window.APP_CONFIG.API.BASE_URL;

// loadServiceCodePrices() + getServicePrice() MOVED to
// builders/emb/pricing.js (roadmap 0.4 extraction #0, 2026-07-07).
// The builders/emb bundle re-exports both onto window before
// DOMContentLoaded, so every call site below keeps working unchanged.

// API response caches (prevent 429 rate limit errors)
const sizeDetectionCache = new Map();   // key: "style-color" → size detection result
const productColorsCache = new Map();   // key: "style" → colors array

// Embroidery defaults — synced with API values at runtime
const EMB_DEFAULTS = {
    GARMENT_STITCH_COUNT: 8000,
    CAP_STITCH_COUNT: 5000,
    AL_GARMENT_STITCH_COUNT: 8000,
    STITCH_STEP: 1000,
    MAX_STITCH_COUNT: 50000,
    PATCH_SETUP_FEE: 50
};

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

// (removed dead SIZE_DISPLAY_LABELS — unused, and it had an incorrect 'XS'→'XXXL' mapping; review C28 2026-06-05)

// State
let pricingCalculator = null;
let quoteService = null;

// Edit mode state (for revising existing quotes)
let editingQuoteId = null;
let editingRevision = null;

// Unsaved changes tracking (UX improvement)
let hasChanges = false;

// Auto-save & Draft Recovery (2026 consolidation)
let embPersistence = null;
let embSession = null;

// Primary logo configuration
let primaryLogo = {
    position: 'Left Chest',
    stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
    needsDigitizing: false,
    isPrimary: true
};

// Additional logos array (for garments)
let additionalLogos = [];
// Example entry: { id: 'global-al-garment', position: 'AL', stitchCount: 8000, needsDigitizing: false, isPrimary: false }

// Cap Logo Configuration (separate from garment logos)
// Supports multiple embellishment types: 'embroidery', '3d-puff', 'patch'
let capPrimaryLogo = {
    position: 'CF',  // Cap Front (always)
    stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
    needsDigitizing: false,
    isPrimary: true,
    embellishmentType: 'embroidery',  // Default: flat embroidery
    needsSetup: true  // For patches: setup fee (GRT-50)
};
let capAdditionalLogos = [];
// Example entry: { id: 'global-al-cap', position: 'AL-Cap', stitchCount: 5000, needsDigitizing: false, isPrimary: false }

let products = [];
let rowCounter = 0;
let productCache = {}; // Cache product data for quick lookup
let childRowMap = {}; // Track child rows: { parentRowId: { '2XL': childRowId, '3XL': childRowId } }
// Global AL config (applies to all products of type when enabled)
let globalAL = {
    garment: { enabled: false, position: 'AL', stitchCount: EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT, needsDigitizing: false },
    cap: { enabled: false, position: 'AL-Cap', stitchCount: EMB_DEFAULTS.CAP_STITCH_COUNT, needsDigitizing: false }
};

// ============================================================
// LOGO CONFIG UI (stitch estimators/tiers, logo cards, global AL,
// embellishment types, notes badge) — MOVED to
// builders/emb/logo-config.js (roadmap 0.4 extraction #9, 2026-07-07).
// ============================================================

// Extended sizes available for Size06 (Other) column
// Note: Actual available sizes are fetched dynamically per product via API
// Includes OSFA for beanies, bags, and other one-size-fits-all items
// All sizes that go in Size06 column (the "Other/Catch-All" column)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
const SIZE06_EXTENDED_SIZES = [
    // Extended large
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
    'XXS', '2XS', 'XXL'
];

// EXTENDED_SIZE_ORDER — now provided by extended-sizes-config.js

// SIZE_TO_SUFFIX — now provided by extended-sizes-config.js

// ============================================================
// EXTENDED SIZE PICKER POPUP (for Size06/XXXL column)
// ============================================================

// getAvailableExtendedSizes() — now provided by extended-sizes-config.js (with caching)

// ============================================================
// EXTENDED SIZE FUNCTIONS — moved to /shared_components/js/quote-extended-sizes.js
// Functions: openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
//   getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
//   updateXXXLCellDisplay, updateChildRowPrice
// Dependencies that remain here: childRowMap, createChildRow, removeChildRow,
//   recalculatePricing, getAvailableExtendedSizes
// ============================================================

// REMOVED: openExtendedSizePopup — now in quote-extended-sizes.js
// REMOVED: closeExtendedSizePopup — now in quote-extended-sizes.js
// REMOVED: toggleWaistGroup — now in quote-extended-sizes.js
// REMOVED: getExtendedSizeQty — now in quote-extended-sizes.js
// REMOVED: applyExtendedSizes — now in quote-extended-sizes.js
// REMOVED: createOrUpdateExtendedChildRow — now in quote-extended-sizes.js
// REMOVED: updateXXXLCellDisplay — now in quote-extended-sizes.js
// REMOVED: updateChildRowPrice — now in quote-extended-sizes.js

/* PLACEHOLDER — this block replaces ~400 lines of inline functions
   that were byte-for-byte identical across embroidery, DTG, and screenprint.
   The functions are now loaded from quote-extended-sizes.js via <script> tag.
*/

// [functions removed — now in quote-extended-sizes.js]
// openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
// getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
// updateXXXLCellDisplay, updateChildRowPrice
// ~390 lines moved to shared module — see quote-extended-sizes.js

// ============================================================
// AUTO-SAVE & DRAFT RECOVERY (2026 consolidation)
// ============================================================

// ============================================================
// DRAFT PERSISTENCE + EDIT-LOAD (autosave wiring, draft restore,
// loadQuoteForEditing, duplicateQuote, populate*) — MOVED to
// builders/emb/persistence.js (roadmap 0.4 extraction #4, 2026-07-07).
// Bridged via the builders/emb bundle before DOMContentLoaded.
// ============================================================

// ============================================================
// INITIALIZATION
// ============================================================

// ============================================================
// INITIALIZATION — MOVED to builders/emb/adapter.js (EmbAdapter) driven
// by builders/shared/quote-builder-base.js (QuoteBuilderBase), wired in
// builders/emb/index.js (roadmap 0.4 base+adapter, 2026-07-07).
// This file now holds ONLY shared state declarations (0.5 migrates them).
// ============================================================

// ============================================================
// LOGO PRESETS
// ============================================================

// ============================================================
// STITCH TIER BADGE
// ============================================================

// ============================================================
// PRIMARY LOGO HANDLERS
// ============================================================

// ============================================================
// PRODUCT ROWS + SEARCH + SIZES + COLORS (setup handlers, autocomplete,
// addNewRow/onStyleChange, size-category machinery, color picker, child
// rows, price override, service rows, logo card header, date helpers) —
// MOVED to builders/emb/product-rows.js (roadmap 0.4 extraction #10,
// 2026-07-07). The monolith is now state + the DOMContentLoaded
// composition root; every behavior lives in builders/emb modules.
// ============================================================

// ============================================================
// PRICING CALCULATIONS
// ============================================================

// ============================================================
// PRICING SYNC + DISPLAY (recalculatePricing, collectProductsFromTable,
// updatePricingDisplay, AL/DECG/rush sync, tax + shipping UI) — MOVED to
// builders/emb/pricing-sync.js (roadmap 0.4 extraction #8, 2026-07-07).
// The wrapWithRepricingIndicator rewrap moved WITH it (live export let).
// ============================================================

// ============================================================
// ACTIONS (Save, Print, Email, Copy)
// ============================================================

// ============================================================
// SAVE + SHOPWORKS PUSH (saveAndGetLink/_saveAndGetLinkInner/saveQuote,
// push readiness/preview/confirm) — MOVED to builders/emb/save-push.js
// (roadmap 0.4 extraction #6, 2026-07-07). Push STATE stays declared
// below (persistence/output modules + monolith read it via the global
// scope chain).
// ============================================================
// _pushQuoteId: set once the quote is saved (or when editing a saved quote).
// _pushAlreadyDone: true when this quote has already been pushed to ShopWorks.
let _pushQuoteId = null;
let _pushAlreadyDone = false;
// One-click "Push to ShopWorks": auto-SAVE first (so the rep never has to hunt for a separate
// "Save & Share" step), then open the review-and-confirm preview. saveAndGetLink() validates +
// sets _pushQuoteId on success; on failure it already surfaced the error and we bail. (Erik 2026-06-05)
let _pushInFlight = false;  // re-entrancy guard — a rapid double-click must not create 2 sessions / 2 SW orders (round-2 fix)

// NOTE: pushToShopWorks() (defined above) now AUTO-SAVES then opens the push preview. The old
// back-compat alias that just called openPushPreview() was removed so the auto-save wrapper wins
// (a later same-name function declaration would otherwise override it). (Erik 2026-06-05)

// embEmailQuote() — single definition lives later in this file (the earlier
// byte-identical duplicate was removed 2026-06-07; the later one wins via hoisting).

// ============================================
// Additional Charges Section Functions
// ============================================

// ============================================================
// QUOTE LIFECYCLE (resetQuote, discounts, additional charges/fee
// table, unsaved-changes tracking) — MOVED to
// builders/emb/quote-lifecycle.js (roadmap 0.4 extraction #7, 2026-07-07).
// ============================================================

// ============================================================
// UTILITIES
// ============================================================

// showLoading(), showToast() → provided by quote-builder-utils.js

// ============================================================
// SHOPWORKS IMPORT FUNCTIONS
// ============================================================

// Store parsed data for confirmation
let pendingShopWorksImport = null;

// Store import metadata for Caspio save (designNumbers, warnings, unmatchedLines)
let lastImportMetadata = null;
// ============================================================
// SHOPWORKS IMPORT (modal, parse/preview/confirm, non-SanMar modal,
// import banner) — MOVED to builders/emb/shopworks-import.js
// (roadmap 0.4 extraction #3, 2026-07-07). Bridged via the builders/emb
// bundle. pendingShopWorksImport + lastImportMetadata stay declared above
// (26 outside readers of lastImportMetadata — they migrate with clusters
// 6/11); the module reaches them through the global scope chain.
// ============================================================

// ============================================================
// OUTPUT & DIAGNOSTICS (diagnoseQuote, buildEmbroideryPricingData,
// copy/print/email quote) — MOVED to builders/emb/output.js
// (roadmap 0.4 extraction #5, 2026-07-07). Bridged via the builders/emb
// bundle before DOMContentLoaded.
// ============================================================

