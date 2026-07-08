/**
 * SCP builder state — SCP decomposition S2 (2026-07-08), mirroring
 * builders/emb/state.js (roadmap 0.5).
 *
 * The single home for the SCP page's mutable state and constants, migrated
 * from the monolith shell's lexical globals. Modules import `scpState` and
 * read/write fields on it (an OBJECT, because ES-module imports are
 * read-only views — `scpState.products = []` works everywhere).
 *
 * Field-for-field faithful to the shell's declarations (same initial
 * values, same comments' intent):
 *   - services:  screenPrintPricingService, quoteService, spPersistence, spSession
 *   - edit mode: editingQuoteId, editingRevision, hasChanges
 *   - rows:      products, rowCounter, productCache, childRowMap, exactMatchSearcher
 *   - config:    printConfig, _darkNudgeDismissed
 *   - push:      _scpPushQuoteId, _scpPushInFlight
 *
 * `quoteState` (builders/shared/quote-model.js) is instantiated here — the
 * canonical line-item store the DOM-row bookkeeping migrates onto as the
 * render layer is typed (products[] and the store coexist during that
 * transition; the store is authoritative for NEW code).
 */
import { QuoteState } from '../shared/quote-model.js';

// ── Constants (verbatim from the shell) ────────────────────────────────────

// Centralized config (config/app.config.js loads in <head>, before this bundle)
export const API_BASE = window.APP_CONFIG.API.BASE_URL;

// Extended sizes that get their own line items
// (2XL goes to Size05 — dedicated; all others go to Size06 "Other")
export const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping — Size01-04 standard, Size05 = 2XL ONLY,
// Size06 = everything else (mis-mapping silently breaks SW line items).
export const SIZE_TO_SLOT = {
    'S': 'Size01', 'M': 'Size02', 'L': 'Size03', 'XL': 'Size04',
    '2XL': 'Size05',  // 2XL has dedicated slot
    'XS': 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', 'OSFA': 'Size06'
};

// Display labels matching ShopWorks column headers
// (internally L/2XL/3XL — displayed LG/XXL/XXXL)
export const SIZE_DISPLAY_LABELS = {
    'S': 'S', 'M': 'M', 'L': 'LG', 'XL': 'XL',
    '2XL': 'XXL', '3XL': 'XXXL',
    'XS': 'XXXL', '4XL': 'XXXL', '5XL': 'XXXL', '6XL': 'XXXL'
};

export const SCREEN_FEE = 30.00; // $30 per screen

// Print location display names
export const LOCATION_NAMES = {
    'LC': 'Left Chest',
    'FF': 'Full Front',
    'JF': 'Jumbo Front',
    'FB': 'Full Back',
    'JB': 'Jumbo Back'
};

// ── Dark-garment underbase nudge (expert audit 2026-07-07) ──────────────────
// Color words mirror the standalone calculator's darkColors list
// (screenprint-pricing-v2.js:81) — see print-config.js for the nudge itself.
export const SCP_DARK_COLOR_WORDS = ['black', 'navy', 'charcoal', 'forest', 'maroon', 'purple', 'brown', 'dark'];

// All sizes that go in the Size06 "Other/Catch-All" column
// (actual availability is fetched per product via the API; 2XL/XXL go in Size05)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
export const SIZE06_EXTENDED_SIZES = [
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

// ── Mutable state (verbatim initial values from the shell) ──────────────────

export const scpState = {
    // services
    screenPrintPricingService: null,
    quoteService: null,
    // Auto-save & Draft Recovery (2026 consolidation)
    spPersistence: null,
    spSession: null,

    // rows
    products: [],
    rowCounter: 0,
    productCache: {},   // Cache product data for quick lookup
    exactMatchSearcher: null,   // ExactMatchSearch instance — initialized in setupSearchAutocomplete

    // edit mode
    editingQuoteId: null,
    editingRevision: null,

    // Screen Print Configuration State
    printConfig: {
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
    },
    _darkNudgeDismissed: false,

    // push
    _scpPushQuoteId: null,
    _scpPushInFlight: false,
};

// ── Window-backed contract fields ───────────────────────────────────────────
// Classic scripts SHARED with the other builders read/write these BARE:
//   - childRowMap: quote-extended-sizes.js tracks child rows on it
//   - hasChanges:  quote-builder-utils.js markAsUnsaved/markAsSaved/hasUnsavedChanges
// With the shell's lexical declarations gone, those bare references resolve
// through the global object — so the ONE shared slot lives on window and
// scpState exposes accessors (same mechanism as builders/emb/state.js).
/* eslint-disable no-restricted-syntax -- window-backed contract fields: classic
   multi-builder consumers (see block comment above) share ONE slot with modules */
window.childRowMap = window.childRowMap || {};
if (typeof window.hasChanges === 'undefined') window.hasChanges = false;

Object.defineProperties(scpState, {
    childRowMap: {
        get() { return window.childRowMap; },
        set(v) { window.childRowMap = v; },
    },
    hasChanges: {
        get() { return window.hasChanges; },
        set(v) { window.hasChanges = v; },
    },
});

// ── Canonical line-item store (roadmap 0.5) ─────────────────────────────────
export const quoteState = new QuoteState();
