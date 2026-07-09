/**
 * DTG inline form — state module (Batch 5, 2026-07-09): the IIFE's constants,
 * caches, and THE `state` object, promoted verbatim. Also:
 *  - dtgIF: the module-level `let`s (reassigned across modules — ESM imports
 *    are read-only, so they live on this shared object)
 *  - dtgState.hasChanges + a window accessor (quote-builder-utils reads the
 *    bare `hasChanges` global — same shim SCP uses)
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).

// API base for the decomposed modules (matches emb/scp/dtf state.js — Rule 6:
// the host comes from APP_CONFIG, never a literal; fail LOUD, not silently wrong).
export const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || (console.error('[DTG] APP_CONFIG missing — API calls will fail'), '');

export const SUBMIT_URL = '/api/submit-order-form'; // relative — same-origin (sanmar-inventory-app)


export const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];


// Sales reps — mirrors pages/order-form/components/paper-form.jsx:2128-2132.
// Tech debt: if a 6th rep joins, edit this list AND the order form's list.
// No /api/sales-reps endpoint today.
export const SALES_REPS = [
    { code: 'nika',     name: 'Nika Lao',       email: 'nika@nwcustomapparel.com' },
    { code: 'erik',     name: 'Erik Mickelson', email: 'erik@nwcustomapparel.com' },
    { code: 'ruth',     name: 'Ruthie Nhoung',  email: 'ruth@nwcustomapparel.com' },
    { code: 'taneisha', name: 'Taneisha Clark', email: 'taneisha@nwcustomapparel.com' },
    { code: 'jim',      name: 'Jim Mickelson',  email: 'jim@nwcustomapparel.com' },
];

// Shipping methods — values match ShopWorks's ship method list EXACTLY
// (no client→server translation needed at submit time, value passes
// through verbatim into payload.ship.method). Erik's curated list
// (2026-05-20): just the 3 we actually use. Order matches dropdown UI
// order. First entry = default.
export const SHIP_METHODS = [
    { code: 'Customer Pickup', label: 'Customer Pickup' },
    { code: 'UPS Ground',      label: 'UPS Ground' },
    { code: 'Priority Mail',   label: 'Priority Mail' },
];

// sessionStorage key prefix + state-shape version (bump if state shape
// changes incompatibly so old restores don't crash).
// v2 (2026-05-20): SHIP_METHODS now uses ShopWorks-canonical names
// ("Customer Pickup" instead of "pickup"); old v1 sessions with
// method='ups'/'pickup' would no longer match the new dropdown values
// and would crash the select. Bumping invalidates old sessions cleanly.
export const STATE_VERSION = 2;

export const STATE_KEY = 'dtg.formState.v' + STATE_VERSION;

export const QUOTEID_KEY = 'dtg.quoteID.v' + STATE_VERSION;


export const LOCATION_LABELS = {
    LC: 'Left Chest',
    FF: 'Full Front',
    JF: 'Jumbo Front',
    FB: 'Full Back',
    JB: 'Jumbo Back',
};

export const FRONT_LOCATIONS = [
    { code: 'LC', label: 'Left Chest', dim: '4″×4″' },
    { code: 'FF', label: 'Full Front', dim: '12″×16″' },
    { code: 'JF', label: 'Jumbo Front', dim: '16″×20″' },
];

export const BACK_LOCATIONS = [
    { code: 'FB', label: 'Full Back', dim: '12″×16″' },
    { code: 'JB', label: 'Jumbo Back', dim: '16″×20″' },
];

// DATA GAP (2026-06-11 parity audit): the pricing layer only supports
// these 4 front+back combos — dtg-pricing-service.js `this.locations`
// and the server whitelist in caspio-pricing-proxy/lib/
// dtg-canonical-pricing.js. DTG_Costs has cost rows for the 5 single
// locations only; combos are synthesized from that fixed list, so
// FF_JB and JF_FB are unpriceable — the live preview rendered them as
// blank/$0 and POST /api/dtg/quote-pricing rejects them with
// bad_input (verified live). Never offer a combo the data can't back.
export const SUPPORTED_COMBOS = ['LC_FB', 'FF_FB', 'JF_JB', 'LC_JB'];

// ----- Caches (same pattern as line-items.jsx in order form) -------------
export const _styleSearchCache = new Map(); // query → [{value,label}]

export const _colorsCache = new Map();      // style → {colors, productTitle}

export const _companySearchCache = new Map(); // query → [{Company_Name, contacts, ...}]

export const _bundleCache = new Map();      // style → bundle (for live preview math)


// ----- State -------------------------------------------------------------
// Restore last-used sales rep from localStorage (per-rep preference,
// not per-quote — survives page refresh AND across quotes).
export const lastRepCode = (function () {
    try { return localStorage.getItem('dtg.lastSalesRep') || ''; }
    catch { return ''; }
})();


export const state = {
    formVersion: STATE_VERSION,
    front: 'LC',
    back: '',
    rows: [],
    customer: {
        company: '',
        companyId: '',  // ManageOrders id_Customer
        contactId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        state: '',      // billing state — flows from company_contacts_2026.State
        city: '',       // billing city  — same source, used as default ship-to city
        po: '',         // customer's purchase order # — passed as info.po → ShopWorks CustomerPurchaseOrder
        designNumber: '',
        terms: 'Prepaid',
        contacts: [],   // populated when a company is picked
        salesRepCode: lastRepCode || 'erik', // A1
        // Curated CRM context (Erik 2026-05-23) — populated by pick()
        // from CompanyContactsMerge2026 fields the proxy now returns.
        // Surfaces in the DTG form as a warning banner, tax chip, and
        // auto-fills the payment terms dropdown. Flows through info.*
        // on submit so the server can suppress tax for exempt customers.
        customerWarning: '',
        isTaxExempt:     false,
        isWholesale:     false,  // [2026-06-08] Phase 1: wholesale/reseller → 0 tax + GL 2203
        taxExemptNumber: '',
        paymentTerms:    '',     // CRM-preferred terms (e.g., "Net 30") — auto-selects in dropdown
        accountTier:     '',     // VIP / GOLD / House — info-only badge
    },
    // Schedule — production due date + customer event ("drop dead") date.
    // Erik's rule (2026-05-20): qty ≤ 24 → 5 business days; qty > 24 → 10
    // business days. Drop dead is optional and only used when the customer
    // has a hard deadline (event, photo shoot, etc.).
    // dueDate / dropDeadDate are ISO strings "YYYY-MM-DD" (matches HTML
    // <input type="date"> format). Backend converts to MM/DD/YYYY for OnSite.
    scheduling: {
        dueDate: '',         // production due date — auto unless rep edits
        dropDeadDate: '',    // optional customer event date
        autoDueDate: true,   // true = recompute on qty change; false = rep manually overrode
    },
    // New-artwork upload (Erik 2026-05-20).
    // Used when the rep has NEW artwork (not in Design_Lookup_2026 / no
    // ShopWorks id_Design yet). Frontend uploads file(s) to Caspio via
    // /api/files/upload; the hosted URLs flow through the submit body as
    // body.files[] → server.js Designs[] gate (now open) → ShopWorks
    // creates a new design with metadata + ImageURL.
    //
    // Mutually exclusive with state.customer.designNumber (the existing-
    // design picker). Readiness panel blocks submit if both are set.
    newArtwork: {
        designName: '',  // required (rep types) — flows to info.newDesignName → base.name in server.js
        files: [],       // [{ fileName, uniqueFileName, hostedUrl, externalKey, fileSize, fileType, placement }]
    },
    shipping: {
        // Default 'Customer Pickup' since ~95% of NWCA orders are local
        // Tacoma-area pickups (Erik 2026-05-20). Reps switch to UPS Ground
        // / Priority Mail only when shipping. Toggling the pickup
        // checkbox flips between this and the prior non-pickup method.
        method: 'Customer Pickup',
        // Ship-to address (only relevant when method !== 'Customer Pickup').
        // Pre-filled from the picked contact's company address; overridable
        // for drop-ships.
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        // Computed tax — populated by the DOR /api/tax-rates/lookup call
        // (in-WA shipping) OR hardcoded to 0.102 (pickup) / 0 (out-of-state).
        // Floats 0..1 (NOT a percentage). Read by recalc + submit. Starts at
        // 10.2% so the first preview render shows a plausible Tacoma-ish
        // estimate even before the rep types a ship-to address; the real
        // rate replaces this as soon as recomputeTaxRate() runs.
        taxRate: 0.102,
        taxRateSource: 'default-pre-lookup',
        // Caspio sales_tax_accounts_2026 row matched to this rate. The DOR
        // lookup endpoint returns these so we can surface the right GL
        // account in the ShopWorks Notes On Order block (Erik applies tax
        // manually post-import — see memory/wa-sales-tax-rules.md).
        taxAccount: '2200.102',
        taxAccountName: 'Wash:10.2%',
        // [2026-06-08] Phase 1 tax-control flags. includeTax: rep can opt the whole quote out of tax.
        // taxRateOverride: null = auto (DOR/pickup/exempt/etc.); a number (percent) = the manual rate the rep typed.
        includeTax: true,
        taxRateOverride: null,
        // [2026-06-09] Phase 2 — billed shipping charge. Shipping is TAXABLE in WA
        // (WAC 458-20-110), so this enters the tax BASE + the total at all 4 sites
        // (screen / submit / PDF / save) via effectiveShipFee() (which zeroes it for
        // pickup). 0 = no charge. Read through effectiveShipFee(), never directly.
        fee: 0,
    },
    submitting: false,
    // C9 dirty-tracking: set to true when the rep touches any form field
    // AFTER the chat last filled it. Cleared when chat re-fills (with
    // confirmation) or when rep resets. Used to gate fillFromQuote()
    // overwrites.
    dirtyAfterChatFill: false,
    // B5 retry: cached payload for the last submit attempt + its pricing
    // result so Retry doesn't re-fetch /api/dtg/quote-pricing.
    lastSubmit: null, // { body, pricing }
};


// ----- DTG Design picker --------------------------------------------------
//
// Per-customer cache of designs fetched from /api/dtg-designs/by-customer.
// Keyed by customerId so switching customers triggers a fresh fetch but
// re-picking the same customer is instant. Cleared on resetForm().
export const _designsCacheByCustomer = new Map();

export const NEW_ARTWORK_MAX_BYTES = 20 * 1024 * 1024;           // 20 MB hard limit

export const NEW_ARTWORK_ACCEPT = /\.(ai|eps|pdf|png|jpe?g|tiff?|psd|svg|webp)$/i;

export const NEW_ARTWORK_PLACEMENTS = [
    { code: 'Left Chest',  label: 'Left Chest' },
    { code: 'Full Front',  label: 'Full Front' },
    { code: 'Full Back',   label: 'Full Back' },
    { code: 'Jumbo Front', label: 'Jumbo Front' },
    { code: 'Jumbo Back',  label: 'Jumbo Back' },
];


// Per-session cache so re-picking the same customer is instant.
export const _historyCacheByCustomer = new Map(); // idCustomer → profile


// Module-level lets from the IIFE — reassigned across modules, so they live here.
export const dtgIF = {
    _saveTimer: null,
    _designComboboxCustomerId: null,
    _lastTier: null,
    _allTiers: null,
    _lastPerPiece: null,
    _priceTimer: null,
};

// Dirty flag — quote-builder-utils reads/writes the bare `hasChanges` global
// (leave-guard). Window accessor keeps that contract (SCP state.js pattern).
export const dtgState = { hasChanges: false };
Object.defineProperty(window, 'hasChanges', {
    get() { return dtgState.hasChanges; },
    set(v) { dtgState.hasChanges = v; },
    configurable: true,
});
