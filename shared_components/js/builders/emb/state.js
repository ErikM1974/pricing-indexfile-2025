/**
 * EMB builder state — roadmap 0.5 (2026-07-08).
 *
 * The single home for the EMB page's mutable state and constants, migrated
 * from the monolith shell's lexical globals. Modules import `embState` and
 * read/write fields on it (an OBJECT, because ES-module imports are
 * read-only views — `import { products }` could never be reassigned by a
 * consumer, but `embState.products = []` works everywhere).
 *
 * Field-for-field faithful to the shell's declarations (same initial
 * values, same comments' intent):
 *   - services:  pricingCalculator, quoteService, embPersistence, embSession
 *   - edit mode: editingQuoteId, editingRevision, hasChanges
 *   - logos:     primaryLogo, additionalLogos, capPrimaryLogo,
 *                capAdditionalLogos, globalAL
 *   - rows:      products, rowCounter, productCache, childRowMap
 *   - push:      _pushQuoteId, _pushAlreadyDone, _pushInFlight
 *   - import:    pendingShopWorksImport, lastImportMetadata
 *
 * `quoteState` (builders/shared/quote-model.js) is instantiated here — the
 * canonical line-item store the DOM-row bookkeeping migrates onto as the
 * render layer is typed (products[] and the store coexist during that
 * transition; the store is authoritative for NEW code).
 */
import { QuoteState } from '../shared/quote-model.js';

// ── Constants (verbatim from the shell) ────────────────────────────────────

// Embroidery defaults — synced with API values at runtime
export const EMB_DEFAULTS = {
    GARMENT_STITCH_COUNT: 8000,
    CAP_STITCH_COUNT: 5000,
    AL_GARMENT_STITCH_COUNT: 8000,
    STITCH_STEP: 1000,
    MAX_STITCH_COUNT: 50000,
    PATCH_SETUP_FEE: 50,
};

// Extended sizes that get their own line items
// (2XL goes to Size05 — dedicated; all others go to Size06 "Other")
export const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping — Size01-04 standard, Size05 = 2XL ONLY,
// Size06 = everything else (mis-mapping silently breaks SW line items).
export const SIZE_TO_SLOT = {
    S: 'Size01', M: 'Size02', L: 'Size03', XL: 'Size04',
    '2XL': 'Size05',
    XS: 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', OSFA: 'Size06',
};

// All sizes that go in the Size06 "Other/Catch-All" column
// (actual availability is fetched per product via the API)
export const SIZE06_EXTENDED_SIZES = [
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    'OSFA', 'OSFM',
    'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
    'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    'LB', 'XLB', '2XLB',
    'XXS', '2XS', 'XXL',
];

// API response caches (prevent 429 rate-limit errors) — mutated in place.
export const sizeDetectionCache = new Map(); // "style-color" → size detection result
export const productColorsCache = new Map(); // "style" → colors array

// Proxy base (was the shell's line-6 const; same eval timing — the bundle
// parses after app.config.js).
export const API_BASE = window.APP_CONFIG.API.BASE_URL;

// ── Mutable state ───────────────────────────────────────────────────────────

export const embState = {
    // Services (pricingCalculator is window-backed — see accessors below)
    quoteService: null,

    // Edit mode (revising existing quotes)
    editingQuoteId: null,
    editingRevision: null,


    // Auto-save & draft recovery
    embPersistence: null,
    embSession: null,

    // Primary logo configuration
    primaryLogo: {
        position: 'Left Chest',
        stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
        needsDigitizing: false,
        isPrimary: true,
    },

    // Additional logos (garments)
    additionalLogos: [],

    // Cap logo configuration (separate from garment logos; embellishment
    // types: 'embroidery' | '3d-puff' | 'patch')
    capPrimaryLogo: {
        position: 'CF',
        stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
        needsDigitizing: false,
        isPrimary: true,
        embellishmentType: 'embroidery',
        needsSetup: true,
    },
    capAdditionalLogos: [],

    // Row bookkeeping (DOM-row era — migrates onto quoteState with the
    // typed render layer)
    products: [],
    rowCounter: 0,
    productCache: {},

    // Global AL config (applies to all products of the type when enabled)
    globalAL: {
        garment: { enabled: false, position: 'AL', stitchCount: EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT, needsDigitizing: false },
        cap: { enabled: false, position: 'AL-Cap', stitchCount: EMB_DEFAULTS.CAP_STITCH_COUNT, needsDigitizing: false },
    },

    // Push state — _pushQuoteId set on save/edit-load; _pushAlreadyDone when
    // this quote already pushed; _pushInFlight = double-click re-entrancy guard.
    _pushQuoteId: null,
    _pushAlreadyDone: false,
    _pushInFlight: false,

    // ShopWorks import state
    pendingShopWorksImport: null,
    lastImportMetadata: null,
};

// ── Window-backed contract fields ──────────────────────────────────────────
// THREE names are read BARE by classic multi-builder scripts that cannot
// import this module:
//   childRowMap       ← quote-extended-sizes.js (EMB/DTG/SP popup, writes it)
//   hasChanges        ← quote-builder-utils.js markDirty/markClean/hasUnsavedChanges
//   pricingCalculator ← embroidery-quote-service.js (guarded digitizing-fee read)
// With the shell's lexical globals gone, their bare reads resolve to WINDOW —
// so these live on window (initialized here at bundle parse, before any
// event-driven classic usage) and embState exposes them as accessors so
// module code uses ONE slot via the same embState.X spelling.
/* eslint-disable no-restricted-syntax -- window-backed contract fields: classic
   multi-builder consumers (see block comment above) share ONE slot with modules */
window.childRowMap = window.childRowMap || {};
if (typeof window.hasChanges === 'undefined') window.hasChanges = false;
if (typeof window.pricingCalculator === 'undefined') window.pricingCalculator = null;
Object.defineProperties(embState, {
    childRowMap: {
        get() { return window.childRowMap; },
        set(v) { window.childRowMap = v; },
    },
    hasChanges: {
        get() { return window.hasChanges; },
        set(v) { window.hasChanges = v; },
    },
    pricingCalculator: {
        get() { return window.pricingCalculator; },
        set(v) { window.pricingCalculator = v; },
    },
});
/* eslint-enable no-restricted-syntax */

// The canonical line-item store (roadmap 0.5) — authoritative for new code.
export const quoteState = new QuoteState();
